const dns = require('dns').promises;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database.config');

const parseOptions = (d) => {
  try { return d.options ? JSON.parse(d.options) : {}; } catch { return {}; }
};

// Generate a DKIM selector + 2048-bit RSA keypair (modern best practice).
// dkim_public is stored as the DNS-ready base64 body (no PEM header/whitespace).
const generateDkim = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const pub = publicKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return { dkim_private: privateKey, dkim_public: pub, dkim_selector: `sq${crypto.randomBytes(3).toString('hex')}` };
};

// A 2048-bit public key exceeds the 255-char DNS TXT string limit, so a TXT record
// must hold multiple quoted strings. This is the raw zone-file representation; most
// DNS provider web UIs also accept the single joined value and split it internally.
const toZoneStrings = (value) => {
  const parts = [];
  for (let i = 0; i < value.length; i += 255) parts.push(value.slice(i, i + 255));
  return parts.map((p) => `"${p}"`).join(' ');
};

const toResponse = (d) => {
  const opts = parseOptions(d);
  const selector = d.dkim_selector || 'sq';
  return {
    id: d.id,
    uid: d.uid,
    name: d.name,
    status: d.status,
    identityVerified: d.domain_verified,
    spfVerified: d.spf_verified,
    dkimVerified: d.dkim_verified,
    dmarcVerified: Boolean(opts.dmarc_verified),
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    mxHost: `_sendq-verify.${d.name}`,
    mxValue: `sendq-site-verification=${d.verification_token}`,
    spfHost: d.name,
    spfValue: 'v=spf1 ~all',
    dkimHost: `${selector}._domainkey.${d.name}`,
    dkimValue: d.dkim_public ? `v=DKIM1; k=rsa; p=${d.dkim_public}` : 'v=DKIM1; k=rsa; p=…',
    dkimValueZone: d.dkim_public ? toZoneStrings(`v=DKIM1; k=rsa; p=${d.dkim_public}`) : '',
    dmarcHost: `_dmarc.${d.name}`,
    dmarcValue: 'v=DMARC1; p=none;',
  };
};

// ─── GET /api/v1/sending-domains ─────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const domains = await prisma.sendingDomain.findMany({
      where: { customer_id: req.customer.id },
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: domains.map(toResponse) });
  } catch (err) {
    console.error('SendingDomain index error:', err);
    res.status(500).json({ message: 'Server error fetching domains.' });
  }
};

// ─── POST /api/v1/sending-domains ────────────────────────────────────────────
exports.store = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(422).json({ message: 'Domain name is required.' });

  const cleanName = name.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');

  try {
    const existing = await prisma.sendingDomain.findFirst({
      where: { name: cleanName, customer_id: req.customer.id },
    });
    if (existing) return res.status(422).json({ message: 'This domain has already been added.' });

    const token = crypto.randomBytes(20).toString('hex');
    const dkim = generateDkim();

    const domain = await prisma.sendingDomain.create({
      data: {
        uid: uuidv4(),
        customer_id: req.customer.id,
        name: cleanName,
        verification_token: token,
        domain_verified: false,
        spf_verified: false,
        dkim_verified: false,
        ...dkim,
        status: 'unverified',
        custom_order: 0,
      },
    });

    res.status(201).json(toResponse(domain));
  } catch (err) {
    console.error('SendingDomain store error:', err);
    res.status(500).json({ message: 'Server error creating domain.' });
  }
};

// ─── GET /api/v1/sending-domains/:id ─────────────────────────────────────────
exports.show = async (req, res) => {
  try {
    const domain = await prisma.sendingDomain.findFirst({
      where: { id: Number.parseInt(req.params.id, 10) || -1, customer_id: req.customer.id },
    });
    if (!domain) return res.status(404).json({ message: 'Domain not found.' });
    res.json(toResponse(domain));
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── DELETE /api/v1/sending-domains/:id ──────────────────────────────────────
exports.destroy = async (req, res) => {
  try {
    const domain = await prisma.sendingDomain.findFirst({
      where: { id: Number.parseInt(req.params.id, 10) || -1, customer_id: req.customer.id },
    });
    if (!domain) return res.status(404).json({ message: 'Domain not found.' });

    await prisma.sendingDomain.delete({ where: { id: domain.id } });
    res.json({ message: 'Domain deleted.' });
  } catch (err) {
    console.error('SendingDomain destroy error:', err);
    res.status(500).json({ message: 'Server error deleting domain.' });
  }
};

// ─── POST /api/v1/sending-domains/:id/verify ─────────────────────────────────
exports.verify = async (req, res) => {
  try {
    const domain = await prisma.sendingDomain.findFirst({
      where: { id: Number.parseInt(req.params.id, 10) || -1, customer_id: req.customer.id },
    });
    if (!domain) return res.status(404).json({ message: 'Domain not found.' });

    // Backfill DKIM keys for domains created before DKIM support.
    let dkimData = {};
    if (!domain.dkim_selector || !domain.dkim_public) {
      dkimData = generateDkim();
      Object.assign(domain, dkimData);
    }

    let domainVerified = false;
    let spfVerified = false;
    let dkimVerified = false;
    let dmarcVerified = false;

    try {
      const verificationHost = `_sendq-verify.${domain.name}`;
      const expected = `sendq-site-verification=${domain.verification_token}`;
      const records = await dns.resolveTxt(verificationHost);
      domainVerified = records.some((r) => r.join('').includes(expected));
    } catch {}

    try {
      const records = await dns.resolveTxt(domain.name);
      spfVerified = records.some((r) => r.join('').includes('v=spf1'));
    } catch {}

    try {
      const records = await dns.resolveTxt(`${domain.dkim_selector}._domainkey.${domain.name}`);
      const joined = records.map((r) => r.join('')).join(' ');
      dkimVerified = joined.includes('v=DKIM1') && (!domain.dkim_public || joined.includes(domain.dkim_public.slice(0, 50)));
    } catch {}

    try {
      const records = await dns.resolveTxt(`_dmarc.${domain.name}`);
      dmarcVerified = records.some((r) => r.join('').toUpperCase().includes('V=DMARC1'));
    } catch {}

    const status = domainVerified && spfVerified ? 'active' : 'unverified';
    const options = JSON.stringify({ ...parseOptions(domain), dmarc_verified: dmarcVerified });

    const updated = await prisma.sendingDomain.update({
      where: { id: domain.id },
      data: {
        domain_verified: domainVerified,
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        options,
        status,
        ...dkimData,
      },
    });

    res.json(toResponse(updated));
  } catch (err) {
    console.error('SendingDomain verify error:', err);
    res.status(500).json({ message: 'Server error verifying domain.' });
  }
};
