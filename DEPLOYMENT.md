# SendQ — Production Deployment & Operations Guide

This is the turnkey checklist for taking SendQ live. The app is feature-complete; what
remains is **operational configuration** (env vars, gateway keys, webhooks, mailboxes).
Nothing here requires code changes.

> Templates: `backend/.env.production.example` and `frontend/.env.production.example`.
> A strong `INBOUND_WEBHOOK_TOKEN` is already generated in the backend template.

---

## 1. Prerequisites on the server
- **Node.js 18+** (the app uses `--env-file` / modern Node).
- **MySQL** reachable with the `sendqom` schema (the shared `sendq_`-prefixed DB).
- **Redis** (required — BullMQ runs campaign send, import, verification, and bounce polling).
- **A reverse proxy** (nginx/Caddy) terminating TLS and serving the SPA + proxying the API.
- *(Optional)* **A Chromium browser** (Edge/Chrome) if you want invoice PDFs rendered from the
  custom HTML template. Without one, invoices fall back to the built-in pdfkit layout — no error.

---

## 2. Environment configuration
1. **Backend:** copy `backend/.env.production.example` → `backend/.env`, fill every `CHANGE_ME`.
   The **required** ones: `NODE_ENV=production`, `API_URL`, `FRONTEND_URL`, `DATABASE_URL`,
   `JWT_SECRET`, `REDIS_HOST`, `SMTP_*`.
   - `API_URL` = public URL of the backend (used in email open/click/unsubscribe links).
   - `FRONTEND_URL` = public URL of the SPA. **This is the CORS allow-origin** (only this origin
     may call the API) **and** the redirect target for Stripe/PayPal/Paymob + email preference links.
     Getting it wrong breaks both API calls from the browser and post-payment redirects.
   - Generate `JWT_SECRET` with `openssl rand -hex 48`.
2. **Frontend:** copy `frontend/.env.production.example` → `frontend/.env.production`, set
   `VITE_API_URL` (leave `/api` if the proxy serves SPA + API on one origin). **These bake in at
   build time** — set them before `npm run build`.

---

## 3. Build & run
```bash
# Backend
cd backend
npm ci
npx prisma generate          # see §9 — also makes the additive columns native
node server.js               # or via a process manager (below)

# Frontend
cd ../frontend
npm ci
npm run build                # outputs static files to frontend/dist
```
Run the backend under a process manager so it restarts on crash/boot. The single
`node server.js` process serves the API **and** starts the BullMQ workers (campaign send,
import, verification, bounce poll) in-process — no separate worker command needed.

**pm2 example:**
```bash
pm2 start backend/server.js --name sendq-api --time
pm2 save && pm2 startup
```

---

## 4. Reverse proxy (nginx sketch)
Serve the SPA, proxy the API/tracking/uploads to the backend, and **preserve the raw body for
the Stripe webhook** (the app already mounts it with `express.raw` before JSON parsing — just
don't let the proxy rewrite it).
```nginx
server {
  server_name app.your-domain.com;          # FRONTEND_URL host
  root /var/www/sendq/frontend/dist;
  location / { try_files $uri /index.html; } # SPA fallback
}
server {
  server_name api.your-domain.com;           # API_URL host
  client_max_body_size 12m;                  # matches the 10mb JSON limit + uploads
  location /api    { proxy_pass http://127.0.0.1:5000; }
  location /track  { proxy_pass http://127.0.0.1:5000; }  # open/click/unsubscribe pixels
  location /uploads{ proxy_pass http://127.0.0.1:5000; }  # avatars / setting images
  location /health { proxy_pass http://127.0.0.1:5000; }
}
```
(If you serve SPA + API on the **same** origin, keep `VITE_API_URL=/api` and proxy `/api`,
`/track`, `/uploads` to the backend from the one server block.)

---

## 5. Payment gateways (configured in the Admin UI — no redeploy)
Gateway keys are stored in the DB and read live, so you can set/rotate them anytime in
**Admin → Payment gateways → Edit**:
- **Paymob** (the live card gateway for Oman/MENA): enter `region`, `integration_ids`,
  `public_key`, `secret_key`, `hmac_secret`. Set the Paymob dashboard callback URL to
  `${FRONTEND_URL}/billing?gateway=paymob`.
- **PayPal**: enter a valid REST `client_id` + `secret` and set `environment` to match the keys
  (`sandbox` or `production`). Returns to `${FRONTEND_URL}/billing?gateway=paypal`.
- **Stripe** (env-only): set `STRIPE_SECRET_KEY` (`sk_live_…`) — **note Stripe isn't available in
  Oman**, so it's optional there; Paymob is the real gateway. Also set the webhook secret (§6).
- **Offline**: always available (admin approves the pending invoice).

Whichever gateways are configured determine which "Pay with …" buttons appear at checkout.

---

## 6. Stripe webhook (only if using Stripe live)
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
   `https://api.your-domain.com/api/billing/webhook`
2. Subscribe to: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.paid`,
   `customer.subscription.deleted`.
3. Copy the endpoint's **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
> In production the webhook **fails closed** — without `STRIPE_WEBHOOK_SECRET` it returns 503
> and ignores unsigned events (so unsigned/forged payment events can't activate plans).
> Local testing: `stripe listen --forward-to localhost:5000/api/billing/webhook`.

---

## 7. Inbound bounce/complaint webhooks
`POST /api/inbound/{events,bounce,complaint}` ingests provider notifications (Amazon SNS/SES,
Mailgun, SendGrid, or a simple `{email,campaign_uid,reason}` body). It's protected by
`INBOUND_WEBHOOK_TOKEN` — the sender must pass `?token=<token>` or an `x-webhook-token` header.
Point your ESP's event webhook at this URL with the token. Hard bounces → suppressed + subscriber
marked `bounced`; complaints → `spam-reported`.

---

## 8. Bounce / feedback-loop mailbox polling (IMAP)
For ESPs that deliver bounces to a mailbox instead of a webhook:
1. **Admin → Sending servers** → add a **bounce handler** (and/or feedback-loop handler) with the
   mailbox `host`, `port`, `username`, `password`, `encryption`, `protocol=imap`, `status=active`.
2. Set `BOUNCE_POLL_ENABLED=1` and restart. The worker drains UNSEEN messages every
   `BOUNCE_POLL_INTERVAL_MS` (default 5 min), parses DSN/ARF, suppresses, and marks messages seen.
> Validated end-to-end against a disposable IMAP server; in production just point it at the
> real mailboxes.

---

## 9. Prisma client regeneration (one-time housekeeping)
A few additive columns (`campaigns.options`, `blacklists.customer_id`) are read/written via raw
SQL because the generated Prisma client predates them. This works as-is. With the backend
**stopped**, run `npx prisma generate` once so they become native (harmless; no schema change,
and **never** run `prisma migrate`/`db push` against the shared DB).

---

## 10. Post-deploy smoke checks
- `curl https://api.your-domain.com/health` → `{"status":"ok"}`.
- Log in via the SPA (confirms FRONTEND_URL/CORS + JWT).
- Send a test campaign email (confirms SMTP / sending server).
- `node tools/parity-check.js` → 0 dead-ends / 0 broken API calls.
- *(Optional)* `BASE=<spa-url> node tools/crawl.js` → page-render baseline.

---

## Go-live checklist
- [ ] `backend/.env` filled (NODE_ENV=production, API_URL, FRONTEND_URL, DATABASE_URL, JWT_SECRET, REDIS, SMTP)
- [ ] `frontend/.env.production` set, `npm run build` done, `dist/` served
- [ ] Reverse proxy: SPA + `/api` `/track` `/uploads` proxied; TLS on
- [ ] Redis running; backend under pm2/systemd (workers start in-process)
- [ ] Payment gateway keys entered in Admin → Payment gateways (Paymob for Oman)
- [ ] `STRIPE_WEBHOOK_SECRET` set + endpoint registered (if using Stripe)
- [ ] `INBOUND_WEBHOOK_TOKEN` set + ESP event webhook pointed at `/api/inbound/*`
- [ ] Bounce mailboxes added + `BOUNCE_POLL_ENABLED=1` (if polling)
- [ ] `npx prisma generate` run once (backend stopped)
- [ ] `/health` green; login + test send verified

---

## 11. Handover: replace ALL borrowed third-party credentials ⚠️
The app currently runs on credentials **inherited from the original SendQ setup** (stored in the
shared DB / `.env`). They belong to someone else's accounts and are often domain/account-locked,
so they will **misbehave, fail, or leak cost onto the original owner** once the project is handed
over or moved to a new domain. Before handover, the new owner must **re-key every one** with their
own accounts:

| Credential | Where it lives | How to replace |
|---|---|---|
| **reCAPTCHA** (site + secret) | DB `sendq_settings` (`recaptcha_site_key/secret_key`) | Create keys at `google.com/recaptcha/admin` for your domain → Admin → Settings → Captcha. Or disable: `registration_recaptcha = no`. |
| **Transactional SMTP** (password reset / verification / sender-verify) | `backend/.env` `SMTP_*` | Set to the company's own transactional mail server, then restart. NOT admin-editable by design (the admin "Mail settings" form is hidden — it wasn't wired). |
| **Marketing / campaign SMTP** (bulk sends) | Admin → Sending servers | Add the company's SendGrid SMTP pool(s) / ESP here. Fully website-configurable, kept separate from transactional on purpose. |
| **Google Maps** API key | `frontend/.env` `VITE_GOOGLE_MAPS_API_KEY` | Create a key in the company's Google Cloud project. |
| **Payment gateways** (Stripe/PayPal/Paymob) | Admin → Payment gateways + `.env` | Enter the company's own live keys + webhook secrets. |
| **JWT_SECRET / INBOUND_WEBHOOK_TOKEN** | `backend/.env` | Rotate to fresh random values (invalidates old tokens — intended). |
| **SSH deploy key** (`~/.ssh/*_deploy`) | dev machine + server `authorized_keys` | Rotate; grant the company their own root/deploy key, revoke the old one. |

**Also on handover:**
- **Database:** the app shares the live PHP app's DB (`sendqom` on `192.168.90.47`). Decide whether the company keeps this shared DB or migrates to their own — either way the credentials above must be reconfigured.
- **`.source/`** (the original PHP/CodeCanyon app) is **licensed third-party code** — it's git-ignored and must **not** be shipped/published. Remove it from any handover bundle.
- **Sending credits:** paid credit packs create a *pending* invoice and only grant credits when the invoice is approved (Admin → Invoices) or paid via gateway — do not treat "buy" as instant fulfilment for paid packs.

## Security hardening already in place (2026-07-02)
- Campaign attachment uploads are **allowlisted** (PDF/images/Office/CSV/TXT/ZIP only — no executables/scripts/HTML/SVG).
- Outbound + per-campaign **webhooks block private/internal/metadata IPs** (SSRF guard).
- **Rate limits:** auth (login/register), public endpoints, and email-sending endpoints (verify / send-confirmation / sender-verify) are throttled per-IP.
