# SendQ Migration Gap Analysis
# PHP (Laravel) → Node.js + React

> Regenerated: 2026-06-14 (verified against current code, supersedes earlier 18–22% estimate)
> Original: `.source/SendQ-Dash/SendQ---APP-dev` (Laravel 12, PHP 8.x)
> Migration: `backend/` (Express.js + Prisma + BullMQ) + `frontend/` (React + Vite)

---

## Executive Summary

The earlier version of this document was written **before** the job queue, admin/account/template/email-engine backends, the campaign wizard, and the password-reset flow landed. Those are now present and working. The numbers below are verified against the current source.

| Metric | Original PHP | Node.js Migration | Notes |
|--------|-------------|-------------------|-------|
| App controllers | 145 | ~25 controllers/modules | Many PHP controllers are admin sub-pages |
| Web/API routes | ~1,060 | ~136 (incl. ~37 admin stubs) | Route count is a poor parity proxy |
| Database models | ~134 | **71 (Prisma)** | ~53% of the data model exists |
| Background jobs | 37 | BullMQ queue + campaign worker | Infra present; few job types implemented |
| Email providers | 13+ | 3 (SMTP / SES-SMTP / Gmail) | API-based providers missing |
| Payment gateways | 6+ | **0** | Models exist, no gateway code |
| **Practical feature parity** | — | — | **~50–55%** (core engine ~80%, long tail ~10%) |

**Two framings of "how much is left":**
- *By raw route count:* ~13% (misleading — PHP's ~1,000 web routes are dominated by the admin panel).
- *By functional weight:* core send platform ~75–85% done; admin panel ~20%; billing/payments ~10%; warmup/verification/e-commerce/i18n ~0–5%. Blended ≈ **50–55%**.

---

## What Is DONE (verified working backend + UI)

| Capability | Backend | Frontend |
|---|---|---|
| Email/password login, registration, JWT, logout | ✅ `auth.controller.js` | ✅ `LoginPage`, `RegisterPage` |
| **Password reset (forgot/reset)** | ✅ `/api/auth/forgot-password`, `/reset-password` | ✅ `ForgotPasswordPage`, `ResetPasswordPage` |
| **Email activation / resend verification** | ✅ `/verify-email`, `/resend-verification` | ✅ |
| API token management / renew | ✅ `/api/auth/api-token/renew` | ✅ `CampaignApiPage` |
| **Background job queue (BullMQ + Redis)** | ✅ `queues/`, `workers/campaign.worker.js` | n/a |
| **Real email sending engine** | ✅ `email-engine/mail.dispatcher.js`, `campaign.sender.js` (batch 50, pause/resume, tracking pixel, unsubscribe injection) | n/a |
| Campaign CRUD + run/pause/resume/unschedule/send | ✅ `campaign.controller.js` (233 lines) | ✅ `CampaignsPage` |
| **Campaign wizard (5 steps)** | ✅ (uses campaign API) | ✅ `wizard/` Setup→Recipients→Content→Schedule→Confirm |
| Open/click/unsubscribe tracking | ✅ `tracking.controller.js` | n/a |
| Mail list CRUD, settings, fields, segments, forms | ✅ `legacy/list.controller.js` (516 lines) | ✅ lists pages |
| Subscriber CRUD + CSV import/export + public subscribe | ✅ | ✅ `SubscribersPage` |
| **Template CRUD + copy** | ✅ `controllers/templateController.js` | ✅ `TemplatesPage`, `TemplateEditorPage` |
| Sending domain CRUD + verify | ✅ `controllers/sendingDomainController.js` | ✅ `SendingDomainsPage` |
| Account: profile/contact/users/roles/subscription/logs | ✅ `account.controller.js` (406 lines) | ✅ `CampaignApiPage` sections |
| Admin: dashboard/users/admins/groups/roles/customers/subscriptions/plans/reports | ✅ `admin.controller.js` (369 lines) | ✅ `AdminPage` |
| RBAC seed + middleware | ✅ `auth/rbac.js`, `seed-rbac.js` | partial enforcement |

---

## What Is PARTIAL (exists but shallow vs original)

| Capability | Status | Gap |
|---|---|---|
| Analytics | 2 endpoints (`/dashboard`, `/campaign/:id`) | No log drilldowns, country/device/geo breakdowns, 24h chart |
| Automation | 3 endpoints; `automation.engine.js` is 28 lines | No visual builder, trigger types, wait/condition/branch steps, async runner |
| Billing | `/current`, `/plans` (static) | No checkout, invoices, payment methods, credit purchase |
| Segments / Forms | Persisted CRUD | No visual condition builder / form builder |
| Email verification (list) | UI layout | No verification jobs/engine behind it |
| Activities / logs | Derived from recent records | No dedicated activity-log model |

---

## What Is MISSING (no real implementation)

### Admin panel — 37 of 51 routes are `emptyModule()` stubs
Real: dashboard, users, admins, admin-groups, roles, customers (+update), subscriptions (+assign/update), plans (CRUD), reports.
Stubs (return placeholder): invoices, domains, hosting, payments, payment-methods, payment-services, taxes, invoice-templates, public-view, email-verification-plans, sending-credit-plans, sending-servers, sending-domains, tracking-domains, email-verification-servers, blacklist, signatures, email-warmup, mta-monitor, templates, settings, mail-settings, captcha, appearance, license, plugins, languages, currencies, notifications, system-logs, tracking-log, open-log, click-log, bounce-log, feedback-log, unsubscribe-log.

### Entire feature areas absent
- **Payment gateways** — Stripe/Braintree/PayPal/Square/CoinPayments/Razorpay/Paystack: **none** (no SDK, no code)
- **Email warmup** — no controller/engine (models `WarmupPlan`/`WarmupPlanDay` exist only)
- **Email verification engines** — no ZeroBounce/NeverBounce/Emailable/AthenaEVS integration
- **Bounce handler / feedback-loop handler** — models exist, no processing logic
- **Additional email providers (API)** — Mailgun, SendGrid, SparkPost, ElasticEmail, Blastengine, Brevo, Sendmail
- **Tracking domain (CNAME) management** — admin stub only
- **Two-factor auth** (email + Google Authenticator), Google/Facebook OAuth
- **E-commerce / Store / funnels / WooCommerce / product catalog / lead popups**
- **Multi-language UI** (20+ locales), installer wizard
- **Webhooks management / HTTP API callbacks** (campaign webhook model exists; no management UI/jobs)
- **Visual builders**: drag-drop template builder, form/page builder, automation canvas

---

## Job Queue Status (was the #1 flagged gap — now partially solved)

| Layer | Status |
|---|---|
| Queue infra (BullMQ + ioredis) | ✅ `queues/connection.js`, `queues/index.js` |
| Worker runtime | ✅ `workers/index.js`, `workers/campaign.worker.js` |
| Campaign send job | ✅ batched, pause/resume aware |
| Import / export / verify / bounce / FBL / warmup / webhook / automation jobs | ❌ not implemented |

The PHP app has 37 queue jobs; the Node app has the infrastructure plus the campaign-send job. Remaining job *types* still need porting.

---

## Recommended Roadmap (by leverage)

1. **Finish admin panel** — convert the 37 `emptyModule` stubs to real CRUD against existing models. Highest count, lowest risk (routes + schema already exist).
2. **Stripe billing** — wire `Plan`/`Subscription`/`Invoice`/`Transaction` to checkout + webhooks. The only gateway most clones need first.
3. **Bounce + feedback-loop handlers** — small, plug into existing BullMQ infra; critical for deliverability.
4. **Automation engine** — grow the 28-line stub into a real workflow runner on the queue; add trigger/wait/condition steps + builder UI.
5. **Analytics drilldowns** — open/click/bounce/unsubscribe logs, country/device charts.
6. **Defer / decide:** email warmup, third-party verification, e-commerce/store, multi-language. Large, market-segment-specific — build only on demand.

> Use `FUNCTION_GAP_AUDIT.md` for the click-by-click frontend checklist.
