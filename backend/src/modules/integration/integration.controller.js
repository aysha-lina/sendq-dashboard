const prisma = require('../../config/database.config');

const apiBase = () => process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

const findWebsite = (req) => prisma.website.findFirst({
  where: { uid: req.params.uid, customer_id: req.customer.id },
});

const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

// ─── Websites CRUD (customer-scoped) ─────────────────────────────────────────────
exports.websites = async (req, res) => {
  const data = await prisma.website.findMany({
    where: { customer_id: req.customer.id },
    orderBy: { created_at: 'desc' },
  });
  res.json({ data });
};

exports.createWebsite = async (req, res) => {
  const title = String(req.body.title || '').trim();
  const url = normalizeUrl(req.body.url);
  if (!title || !url) return res.status(422).json({ message: 'Title and URL are required.' });
  const website = await prisma.website.create({
    data: { customer_id: req.customer.id, title, url, status: 'active' },
  });
  res.status(201).json(website);
};

exports.updateWebsite = async (req, res) => {
  const website = await findWebsite(req);
  if (!website) return res.status(404).json({ message: 'Website not found.' });
  const data = {};
  if (req.body.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body.url !== undefined) data.url = normalizeUrl(req.body.url);
  if (req.body.status !== undefined) data.status = req.body.status;
  res.json(await prisma.website.update({ where: { id: website.id }, data }));
};

exports.deleteWebsite = async (req, res) => {
  const website = await findWebsite(req);
  if (!website) return res.status(404).json({ message: 'Website not found.' });
  await prisma.website.delete({ where: { id: website.id } });
  res.json({ message: 'Website disconnected.' });
};

// Embed snippet the customer drops into their site's <head>.
exports.websiteCode = async (req, res) => {
  const website = await findWebsite(req);
  if (!website) return res.status(404).json({ message: 'Website not found.' });
  const snippet = `<!-- SendQ tracking -->\n<script async src="${apiBase()}/track/site/${website.uid}.js"></script>`;
  res.json({ uid: website.uid, snippet });
};

// ─── Public tracking script + event collector ────────────────────────────────────
// GET /track/site/:uid.js — the JS visitors load.
exports.siteScript = async (req, res) => {
  const uid = String(req.params.uid || '').replace(/\.js$/, '');
  const website = await prisma.website.findFirst({ where: { uid } });
  res.type('application/javascript');
  if (!website || website.status !== 'active') {
    return res.send('/* SendQ: unknown or inactive site */');
  }
  const endpoint = `${apiBase()}/track/site/${uid}/event`;
  res.send(`(function(){
  function send(name, data){
    try{
      navigator.sendBeacon
        ? navigator.sendBeacon(${JSON.stringify(endpoint)}, JSON.stringify({name:name,data:data,url:location.href}))
        : fetch(${JSON.stringify(endpoint)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,data:data,url:location.href}),keepalive:true});
    }catch(e){}
  }
  window.sendq = window.sendq || {};
  window.sendq.track = send;
  window.sendq.identify = function(email, fields){ send('identify', Object.assign({email:email}, fields||{})); };
  send('pageview', {});
})();`);
};

// POST /track/site/:uid/event — record a tracking event (no new table; uses AuditLog).
exports.siteEvent = async (req, res) => {
  const website = await prisma.website.findFirst({ where: { uid: req.params.uid } });
  if (!website || !website.customer_id) return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  await prisma.auditLog.create({
    data: {
      customer_id: website.customer_id,
      type: 'site_event',
      name: String(body?.name || 'event').slice(0, 255),
      data: JSON.stringify({ site: website.uid, url: body?.url, ...(body?.data || {}) }).slice(0, 60000),
    },
  }).catch(() => {});

  res.status(204).end();
};
