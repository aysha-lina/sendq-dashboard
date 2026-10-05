const prisma = require('../../config/database.config');

const transparentGif = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

const unsubscribePage = (state, detail = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${state === 'success' ? 'Unsubscribed' : state === 'already' ? 'Already unsubscribed' : 'Invalid link'}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7fb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .icon{font-size:3rem;margin-bottom:20px}
  h1{font-size:1.4rem;font-weight:700;color:#172033;margin-bottom:10px}
  p{font-size:0.95rem;color:#64748b;line-height:1.6}
  .sub{margin-top:8px;font-size:0.82rem;color:#94a3b8}
</style>
</head>
<body>
<div class="card">
  ${state === 'success'
    ? '<div class="icon">✅</div><h1>You\'ve been unsubscribed</h1><p>You will no longer receive emails from this mailing list.</p>'
    : state === 'already'
      ? '<div class="icon">ℹ️</div><h1>Already unsubscribed</h1><p>This address is already opted out of this mailing list.</p>'
      : '<div class="icon">⚠️</div><h1>Invalid link</h1><p>This unsubscribe link is invalid or has expired.</p>'}
  ${detail ? `<p class="sub">${detail}</p>` : ''}
</div>
</body>
</html>`;

const getTrackingData = (req) => ({
  campaign_id: Number(req.query.campaignId || req.query.campaign_id),
  subscriber_id: req.query.subscriberId || req.query.subscriber_id
    ? Number(req.query.subscriberId || req.query.subscriber_id)
    : null,
  ip: req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress,
  user_agent: req.headers['user-agent'] || '',
});

exports.open = async (req, res) => {
  const data = getTrackingData(req);
  if (data.campaign_id) {
    await prisma.openLog.create({ data }).catch((err) => console.error('Open tracking error:', err));
  }

  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(transparentGif);
};

exports.click = async (req, res) => {
  const data = { ...getTrackingData(req), url: req.query.url || '' };
  if (data.campaign_id) {
    await prisma.clickLog.create({ data }).catch((err) => console.error('Click tracking error:', err));
  }

  res.redirect(data.url || '/');
};

exports.unsubscribe = async (req, res) => {
  const { token, campaignId } = req.query;

  if (!token) {
    return res.status(400).send(unsubscribePage('error'));
  }

  const subscriber = await prisma.subscriber.findFirst({
    where: { uid: token },
  }).catch(() => null);

  if (!subscriber) {
    return res.status(404).send(unsubscribePage('error'));
  }

  if (subscriber.status === 'unsubscribed') {
    return res.send(unsubscribePage('already'));
  }

  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { status: 'unsubscribed' },
  });

  await prisma.unsubscribeLog.create({
    data: {
      subscriber_id: subscriber.id,
      customer_id: subscriber.customer_id,
      campaign_id: campaignId ? Number(campaignId) : null,
      ip_address: req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    },
  }).catch(() => {});

  res.send(unsubscribePage('success'));
};

// ─── GET /track/webview?c=<campaignUid>&s=<subscriberUid> ────────────────────
// "View in browser" — renders a campaign's HTML with merge tags resolved.
const mergeTags = (html, subscriber, links) => String(html || '')
  .split('{{webview_url}}').join('#')
  .split('{{unsubscribe_url}}').join(links.unsub || '#')
  .split('{{preferences_url}}').join(links.prefs || '#')
  .split('{{first_name}}').join(subscriber?.first_name || '')
  .split('{{last_name}}').join(subscriber?.last_name || '')
  .split('{{email}}').join(subscriber?.email || '');

exports.webView = async (req, res) => {
  const campaign = req.query.c
    ? await prisma.campaign.findFirst({ where: { uid: String(req.query.c) } })
    : null;
  if (!campaign) return res.status(404).send('Email not found.');

  const subscriber = req.query.s
    ? await prisma.subscriber.findFirst({ where: { uid: String(req.query.s) } })
    : null;

  const api = (process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const links = {
    unsub: subscriber ? `${api}/track/unsubscribe?token=${subscriber.uid}&campaignId=${campaign.id}` : '#',
    prefs: subscriber ? `${frontend}/profile/${subscriber.uid}` : '#',
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(mergeTags(campaign.html, subscriber, links));
};

module.exports.mergeTags = mergeTags;
