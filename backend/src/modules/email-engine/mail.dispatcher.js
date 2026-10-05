const path = require('path');
const prisma = require('../../config/database.config');
const { sendMail } = require('./smtp.service');
const { descriptorFor } = require('./api.senders');
const { hooks } = require('../plugins/hook-manager');

const baseUrl = () => process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

const webViewUrl = ({ campaign, subscriber }) =>
  `${baseUrl()}/track/webview?c=${campaign.uid}&s=${subscriber?.uid || ''}`;

// Read the additive `options` JSON (custom headers + attachments) for a campaign.
// Resolved once per run by the sender and passed in; falls back to inline lookup.
const resolveExtras = async (campaign) => {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT options FROM sendq_campaigns WHERE id = ?', campaign.id);
    const opts = rows?.[0]?.options ? JSON.parse(rows[0].options) : {};
    return {
      customHeaders: Array.isArray(opts.custom_headers) ? opts.custom_headers : [],
      attachments: Array.isArray(opts.attachments) ? opts.attachments : [],
    };
  } catch {
    return { customHeaders: [], attachments: [] };
  }
};

const trackingOpenUrl = ({ campaign, subscriber }) =>
  `${baseUrl()}/track/open?campaignId=${campaign.id}&subscriberId=${subscriber?.id || ''}`;

const unsubscribeUrl = ({ campaign, subscriber }) =>
  `${baseUrl()}/track/unsubscribe?token=${subscriber.uid}&campaignId=${campaign.id}`;

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const preferencesUrl = ({ subscriber }) => `${frontendUrl()}/profile/${subscriber.uid}`;

const appendTrackingPixel = (html, campaign, subscriber) => {
  if (!campaign.track_open) return html;
  const pixel = `<img src="${trackingOpenUrl({ campaign, subscriber })}" width="1" height="1" alt="" />`;
  return `${html || ''}${pixel}`;
};

const injectUnsubscribeLink = (html, url, prefsUrl) => {
  let out = html || '';
  const tag = '{{unsubscribe_url}}';
  if (out.includes(tag)) out = out.split(tag).join(url);
  if (out.includes('{{preferences_url}}')) out = out.split('{{preferences_url}}').join(prefsUrl || '#');
  if (out.includes(tag) || html?.includes('{{unsubscribe_url}}')) return out;

  const footer = `<div style="text-align:center;padding:20px 16px 8px;font-size:12px;color:#999;font-family:sans-serif;">
<p style="margin:0 0 6px;">You received this email because you subscribed to our mailing list.</p>
<p style="margin:0;"><a href="${url}" style="color:#999;">Unsubscribe</a>${prefsUrl ? ` &nbsp;·&nbsp; <a href="${prefsUrl}" style="color:#999;">Manage preferences</a>` : ''}</p>
</div>`;
  return `${out}${footer}`;
};

// Hidden preview text shown by inbox clients next to the subject line.
const injectPreheader = (html, preheader) => {
  if (!preheader) return html;
  const hidden = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>`;
  return `${hidden}${html || ''}`;
};

// Map a SendingServer record to a transport descriptor. API ("*-api") types resolve to
// an HTTP-API descriptor ({ api: … }); SMTP/SES types resolve to an SMTP shape that
// smtp.factory understands. Centralised in api.senders for reuse by the test endpoints.
const providerFromServer = (s) => descriptorFor(s);

// Resolve DKIM signing config for a campaign: only when sign_dkim is on AND the
// customer has a verified sending domain matching the From address's domain that
// carries a stored private key + selector. Returns null otherwise (no signing).
const resolveDkim = async (campaign) => {
  if (!campaign?.sign_dkim) return null;
  const domainName = String(campaign.from_email || '').split('@')[1]?.toLowerCase();
  if (!domainName) return null;
  try {
    const sd = await prisma.sendingDomain.findFirst({
      where: { customer_id: campaign.customer_id, name: domainName },
    });
    // Only sign once the published DKIM record is verified — signing against an
    // unpublished key yields a FAILING signature, which hurts deliverability.
    if (sd?.dkim_verified && sd?.dkim_private && sd?.dkim_selector) {
      return { domainName, keySelector: sd.dkim_selector, privateKey: sd.dkim_private };
    }
  } catch { /* no signing on lookup failure */ }
  return null;
};

// Resolve the active sending server for a campaign — the customer's own first,
// then any global/admin server. Returns undefined to fall back to env SMTP.
const resolveProvider = async (customerId) => {
  try {
    const server = (customerId && await prisma.sendingServer.findFirst({
      where: { customer_id: customerId, status: 'active' },
      orderBy: [{ custom_order: 'asc' }, { id: 'asc' }],
    })) || await prisma.sendingServer.findFirst({
      where: { customer_id: null, status: 'active' },
      orderBy: [{ custom_order: 'asc' }, { id: 'asc' }],
    });
    return server ? providerFromServer(server) : undefined;
  } catch {
    return undefined;
  }
};

const dispatchCampaignEmail = async ({ campaign, subscriber, provider, dkim, extras }) => {
  const sendProvider = provider === undefined ? await resolveProvider(campaign.customer_id) : provider;
  // dkim/extras undefined → resolve inline (e.g. test send); the bulk sender resolves once and passes them.
  const signing = dkim === undefined ? await resolveDkim(campaign) : dkim;
  const extra = extras === undefined ? await resolveExtras(campaign) : extras;
  const unsubUrl = unsubscribeUrl({ campaign, subscriber });
  const withPreheader = injectPreheader(campaign.html, campaign.preheader);
  const withWebview = String(withPreheader || '').split('{{webview_url}}').join(webViewUrl({ campaign, subscriber }));
  const rawHtml = appendTrackingPixel(withWebview, campaign, subscriber);
  const finalHtml = injectUnsubscribeLink(rawHtml, unsubUrl, preferencesUrl({ subscriber }));

  // Custom headers (from campaign options) layered onto the required list headers.
  const customHeaders = {};
  (extra?.customHeaders || []).forEach((h) => {
    if (h?.name) customHeaders[String(h.name).slice(0, 200)] = String(h.value ?? '').slice(0, 1000);
  });

  // Attachments stored under uploads/attachments (paths saved in campaign options).
  const attachments = (extra?.attachments || [])
    .filter((a) => a?.path)
    .map((a) => ({ filename: a.filename || path.basename(a.path), path: path.join(process.cwd(), a.path.replace(/^\//, '')) }));

  const baseMessage = {
    from: `"${campaign.from_name}" <${campaign.from_email}>`,
    to: subscriber.email,
    replyTo: campaign.reply_to || campaign.from_email,
    subject: campaign.subject,
    text: campaign.plain || undefined,
    html: finalHtml,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...customHeaders,
    },
    ...(attachments.length ? { attachments } : {}),
    ...(signing ? { dkim: signing } : {}),
  };
  // Plugin hook: let plugins transform the outgoing message (headers, subject, body…).
  const message = await hooks.applyFilters('email.message', baseMessage, { campaign, subscriber });

  const log = await prisma.emailLog.create({
    data: {
      campaign_id: campaign.id,
      customer_id: campaign.customer_id,
      subscriber_id: subscriber.id,
      status: 'queued',
    },
  });

  try {
    const result = await sendMail({ provider: sendProvider, message });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'sent',
        message_id: result.messageId,
        sent_at: new Date(),
      },
    });
    return result;
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: err.message },
    });
    throw err;
  }
};

module.exports = { dispatchCampaignEmail, resolveProvider, resolveDkim, resolveExtras, providerFromServer };
