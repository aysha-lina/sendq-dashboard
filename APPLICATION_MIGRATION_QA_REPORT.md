# Application Migration QA Report

**Project:** SendQ — email-marketing platform
**Migration:** PHP / Laravel → Node.js (Express + Prisma) + React (Vite)
**Audit date:** 2026-06-28 (live re-audit)
**Method:** Live run of the app (backend on :5000, frontend on :5173) + live MySQL audit + live API/auth probes + full build/test/lint + a fresh Playwright page crawl + replay of the live feature harnesses (`backend/scripts/_qa_*`). This is a *run-the-app* audit, not a code read.

> **Scope note (verified vs. not):** Routes, APIs, DB integrity, auth/RBAC, build, tests and page-render are verified **live this run**. Pixel-perfect/visual-design comparison against the PHP UI is **not** verifiable — there are **no Figma files, design specs, or PHP screenshots in the repo** (only the PHP source under `.source/`), and there is no human to eyeball pixels; UI is therefore verified by automated render + console/network-error crawl + responsive code review, not by visual diff. This is called out explicitly in §5.

---

## 1. Project Overview

- **Frontend:** React 18 + Vite, React Router v6 (**120 `<Route>` entries**, `frontend/src/App.jsx`), Zustand auth store (`frontend/src/store/authStore.js`), dependency-free i18n (8 locales, `frontend/src/i18n/`), bespoke `index.css`. Build → `frontend/dist`.
- **Backend:** Node.js + Express, **Prisma** ORM (single ORM), BullMQ + Redis workers (started in-process by `backend/server.js`), nodemailer + provider HTTP APIs. ~290 routes across `backend/src/modules/**` + `backend/src/controllers/**`, mounted in `backend/src/bootstrap/app.js`.
- **Database:** MySQL `sendqom` @ `192.168.90.47` (host `mysql-dev`, prefix `sendq_`). **88 tables**; **78/78 Prisma `@@map` models resolve to real tables (0 missing)**.
- **Auth:** JWT bearer (or 60-char `api_token`), bcrypt, email verification, TOTP + email 2FA, captcha; scope-aware RBAC (`ability:scope`), super_admin bypass; admin routes gated by `requireAdminAbility`.
- **Testing tools:** Backend **Node test runner — 102 tests** (`backend/tests/`, 86 unit + 16 Supertest integration) + ~24 live harnesses (`backend/scripts/_qa_*`). Frontend: Playwright crawl (`tools/crawl.js`) + login e2e (`tools/e2e-login.js`) + deterministic parity diff (`tools/parity-check.js`). **ESLint** flat config at repo root (`npm run lint`).
- **Migration type:** PHP → Node.js + React.

---

## 2. Executive Summary

**Verdict: PRODUCTION-READY (candidate) — pending operational configuration only.**

Live evidence this run is strongly positive and shows no functional blockers:

- **Build/tests/lint all green:** `npm test` → **102/102**, `npm run lint` → **0 errors / 0 warnings**, `vite build` ✓, backend boots and `/health` → 200.
- **DB integrity clean:** 88 tables, **78/78 models aligned**, **0 orphaned foreign-key rows** across the key relations, row counts consistent.
- **Auth/authorization enforced live:** protected routes return **401** (no token *and* forged token); admin RBAC returns **403** for ungranted abilities and **200** for granted/super_admin; empty login → **422**, bad creds → **401**.
- **Routing/parity clean:** **0 dead-end navigations, 0 broken API calls**; fresh page crawl: **2026-06-28: 106 pages clean, 0 problems, 0 artifacts, 14 dynamic skipped**.
- **Every Critical/High bug from prior passes is resolved and re-verified** (see §10).

The only outstanding items are **operational/config** (real domain, gateway keys, webhook secrets, bounce mailboxes — documented in `DEPLOYMENT.md`) and **deliberately out-of-scope** features (RSS-to-email, Automation/autoresponders, TypeScript). Nothing in scope is unbuilt or broken.

---

## 3. Test Summary Table

| Area | Status | Notes |
|---|---|---|
| Frontend routes | **Pass** | 120 routes; parity tool: 0 dead-ends; fresh crawl **2026-06-28: 106 pages clean, 0 problems, 0 artifacts, 14 dynamic skipped**. |
| Redirects | **Pass** | `/`,`/lists`,`/subscribers`,`/sending`,`/integration` redirect; unknown URL → real 404 page (`NotFoundPage`). |
| Pages | **Pass** | All routed components are real implementations; **0 stub/`emptyModule` admin sections** (helper exists but has 0 callers). |
| UI layout | **Partial** | Renders clean (no console/layout errors in crawl); **visual-design parity not verifiable — no design refs in repo** (see §5). |
| Responsive UI | **Pass** *(code-verified)* | Sidebar auto-collapses to icon rail ≤900px (`matchMedia` in `AppLayout`); A/B/admin grids have mobile breakpoints. Not human-eyeballed on physical devices. |
| Authentication | **Pass** | Login/register/verify/forgot/reset/2FA real; empty login → 422 (live), bad creds → 401 (live). |
| Authorization | **Pass** | Live: protected → 401 (no/forged token); granular admin RBAC 8/8 (reseller granted customers/plans, denied admins/settings/servers; super_admin full); per-tenant blacklist isolation proven. |
| Features/functions | **Pass** | All in-scope features built + live-validated (§6). Out of scope: RSS-to-email, Automation. |
| APIs | **Pass** | ~290 endpoints; live 200/401/403/422 contract correct; 16 Supertest + live harnesses. `billing/plans` static fallback + `logout` no-op are intentional. |
| Database tables | **Pass** | 88 tables; 78/78 models aligned; all "concern" tables exist. |
| Data integrity | **Pass** | 0 orphaned FK rows across campaigns/subscribers/customers/invoices/subscriptions. |
| PHP migration completeness | **Pass** *(in scope)* | Core build→segment→design→send→track→bill + full admin migrated. Out by choice: RSS, Automation, store-sync, chat, installer (§9). |
| Build/runtime | **Pass** | `vite build` ✓; backend boots (DB + Redis reachable; /health 200); ESLint 0/0; no TS type-check (JS project). |
| Tests | **Pass** | 102 backend tests + 16 integration + ~24 live harnesses + crawl. No frontend unit tests (see §9/§13). |

---

## 4. Route-by-Route Results

**Method:** all 120 `<Route>`s parsed from `App.jsx`; rendered live via `tools/crawl.js` (authenticated JWT, real sampled ids for dynamic routes); navigation/redirect/404 verified by `tools/parity-check.js` + crawl. Results are grouped by area (representative detail per group; the crawl report `tools/crawl-report.md` lists every individual path).

| Route group (paths) | Expected | Actual | Status | Issues |
|---|---|---|---|---|
| **Public/auth** — `/login`, `/register`, `/forgot-password`, `/reset-password`, `/forms/:formUid`, `/profile/:subscriberUid`, `/subscribe/confirm/:token`, `/login/token/:token`, `/auth/google/callback` | Standalone pages render; invalid param → empty/error state | Render clean; PublicRoute redirects authed users to `/dashboard` | **Pass** | Dynamic public routes need a real id to fully render (skipped in crawl when no sample) |
| **Dashboard/Activities/Billing** — `/dashboard`, `/activities`, `/billing` | Load with data; billing shows plan + invoices + change/cancel | Render clean; billing has prorated-change + immediate-cancel + invoice PDF | **Pass** | — |
| **Campaigns** — `/campaigns`, `/create`, `/:uid/edit`, `/:uid/statistics`, `/logs/:type`, `/links`, `/open-map`, `/subscribers`, `/review` | List/wizard/stats/logs render | Render clean; wizard incl. A/B panel; copy/archive/resend wired | **Pass** | — |
| **Lists/Subscribers/Segments** — `/lists/*`, `/subscribers`, segments, forms, fields, email-verification | CRUD + import + segments + forms | Render clean; import wizard + segment copy present | **Pass** | — |
| **Templates** — `/templates`, `/new`, `/:uid/builder`, `/:uid/edit` | Gallery + GrapesJS builder + editor | Render clean | **Pass** | — |
| **Sending** — `/sending/servers`, `/domains*`, `/tracking-domains*`, `/verification-servers`, `/email-verification-servers*`, `/blacklist*`, `/signatures*` | CRUD + DNS/DKIM verify | Render clean | **Pass** | — |
| **Integration/Store/Campaign-API** — `/integration/*`, `/store`, `/campaign-api*` | Website tracking, store, API token | Render clean | **Pass** | API-token page is informational |
| **Admin** — `/admin`, `/admin/:section` (catch-all), `/admin/customers/:uid`, `/admin/<resource>/new\|edit`, `/admin/oauth*`, `/admin/payment-gateways*`, `/admin/webhooks*`, `/admin/plugins*`, `/admin/*-log`, `/admin/invoice-template` | Full admin panel | Render clean; **client-side ability gate** hides sections the user can't access; server enforces (401/403) | **Pass** | Catch-all `/admin/:section` resolves all sections |
| **Catch-all** — `*` | Renders 404 page | `NotFoundPage` (was a silent redirect; fixed) | **Pass** | — |

**Refresh / back-forward / direct-URL:** SPA uses BrowserRouter; the reverse-proxy guide (`DEPLOYMENT.md` §4) serves `index.html` for all paths so refresh/deep-link work in production. Protected routes redirect to `/login` when unauthenticated; admin routes show an access-denied panel when lacking ability.

---

## 5. UI Layout Review

**Hard limitation (stated per the strict rules):** there are **no design references in the repository** — no Figma, no design spec, no PHP screenshots (only the PHP *source* under `.source/`). Therefore a true pixel/visual parity comparison **cannot be performed**, and no human is available to eyeball layouts. What *was* verified: every page **renders without runtime/console errors, failed API calls, or layout-crashing exceptions** (Playwright crawl), the light-theme readability was previously contrast-audited (`tools/contrast-check.js`), and responsive behavior exists in code. Visual fidelity to the original PHP design is therefore **Partial / unverified**, not failed.

| Screen | Expected layout | Actual (verified) | Desktop | Tablet | Mobile | Visual issues | Suggested fix |
|---|---|---|---|---|---|---|---|
| Login / auth | Split slider + form | Renders; AuthSlider + form | Pass | Pass | Pass (code) | None observed in crawl | — |
| Dashboard | Sidebar + stat cards + charts | Renders; cards + charts | Pass | Pass | Pass (code: sidebar collapses ≤900px) | Some dashboard charts are simple/placeholder visuals | Enhance charts (Nice) |
| Campaign wizard | 5-step stepper + forms (incl. A/B) | Renders all steps + A/B panel | Pass | Pass | Pass (code) | — | — |
| Lists / Subscribers tables | Filterable tables + bulk bar | Renders; columns selector + chips | Pass | Pass | Partial (wide tables scroll on mobile) | Wide tables need horizontal scroll on small screens | Wrap tables in overflow-x container (Nice) |
| Admin panel (48+ sections) | Sidebar + data tables + editors | Renders all; ability-gated nav | Pass | Pass | Pass (code) | — | — |
| Billing | Plan cards + invoices table | Renders; change/cancel/PDF | Pass | Pass | Pass (code) | — | — |
| Public subscriber pages | Bare hosted forms | Render | Pass | Pass | Pass (code) | — | — |

> To make UI review conclusive, supply Figma/PHP screenshots or run `tools/visual-parity.js` (a PHP↔React structural fingerprint diff that already exists) against a reachable live PHP instance (`PHP_URL` creds in `tools/.parity.env`).

---

## 6. Feature-by-Feature Results

All validated **live this run** unless dated (dated = validated earlier this session via the same harnesses; code unchanged since).

| Feature | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Login / 2FA / logout | Auth + token + 2FA gate | Works; empty→422, bad→401, valid→JWT | **Pass** | live probes + `tools/e2e-login.js` 5/5; login-flow 7/7 |
| Granular admin RBAC | Per-ability gating | reseller granted/denied correctly; super_admin full | **Pass** | `_qa_rbac_validate` **8/8** (this run) |
| Input validation (S5/S6) | 422 on bad input | subscriber/profile/checkout reject bad input | **Pass** | `_qa_validation_live` **6/6** (this run) |
| Segment copy | Duplicate w/ conditions | "(copy)" + conditions match | **Pass** | `_qa_parity_live` **6/6** (this run) |
| Admin assign-plan | Activate plan for a customer | 201 active sub, single active | **Pass** | `_qa_parity_live` (this run) |
| Subscriber tags | Add/remove + chips | modal field → `tags` → chips | **Pass** | crawl render + code |
| Import column-mapping wizard | Map CSV cols incl. custom fields | preview + mapped import persists values | **Pass** | `_qa_import_live` 7/7 (2026-06-25) |
| A/B testing | Split test → winner to holdout | 40% split, winner by opens → holdout | **Pass** | `_qa_ab_live` 10/10 (2026-06-25) |
| Billing: tax | 5% applied at checkout/invoice | tax computed + itemized | **Pass** | tax.test (5) + live |
| Billing: line items + PDF | Itemized invoice + downloadable PDF | items written; PDF returns %PDF | **Pass** | invoice-pdf.test + live |
| Billing: custom-template PDF | Render admin HTML template | browser-rendered (Skia) PDF, pdfkit fallback | **Pass** | `_qa_invoice_template_live` 4/4 (2026-06-25) |
| Billing: prorated change / immediate cancel | Proration + cancel-now | downgrade free, upgrade settles, cancel-now | **Pass** | `_qa_billing_live` 12/12 (2026-06-25) |
| Billing: upgrade auto-settlement | Off-session charge stored card | $42.46 charged off-session → switch | **Pass** | `_qa_upgrade_settle_live` 3/3 (2026-06-25) |
| Real card payment + tax (Stripe) | Hosted checkout charges card | test card 4242 → paid $9.45 (incl. tax) | **Pass** | `_qa_stripe_live` 9/9 (2026-06-25) |
| Per-tenant blacklist + send suppression | Scoped + skipped at send | A sees only A; blacklisted skipped | **Pass** | blacklist-send.test + live |
| Bounce/FBL ingestion | Webhook + IMAP poll → suppress | DSN/ARF parsed; global suppress | **Pass** | `_qa_bounce_live` 4/4 (live IMAP, 2026-06-25) |
| Outbound webhooks / API token / OAuth / plugins | Fire events / external API / Google / hook runtime | all wired + tested | **Pass** | webhook/oauth/plugin tests + live |
| Campaign send (queue + fallback) | BullMQ send, pause/resume/schedule | works; inline fallback if Redis down | **Pass** | campaign worker + sender tests |

---

## 7. API Endpoint Results

**Method:** ~290 endpoints mounted in `backend/src/bootstrap/app.js` + the `*.routes.js` files. Verified by: live status-code probes, `tools/parity-check.js` (every frontend `services.js` call has a backend route → **0 broken**), 16 Supertest integration tests, and the live harnesses. Representative contract results (full route list in `tools/parity-report.md`):

| Method | Endpoint (representative) | Expected | Actual (live) | Status | Issues |
|---|---|---|---|---|---|
| GET | `/health` | 200 public | 200 | **Pass** | — |
| GET | `/api/campaigns` (no token) | 401 | 401 | **Pass** | — |
| GET | `/api/campaigns` (forged token) | 401 | 401 | **Pass** | — |
| GET | `/api/admin/customers` (no token) | 401 | 401 | **Pass** | — |
| GET | `/api/admin/{admins,settings,sending-servers}` (reseller) | 403 | 403 | **Pass** | RBAC enforced |
| GET | `/api/admin/{customers,plans}` (reseller granted) | 200 | 200 | **Pass** | — |
| POST | `/api/auth/login` (empty) | 422 | 422 | **Pass** | express-validator |
| POST | `/api/auth/login` (bad creds) | 401 | 401 | **Pass** | — |
| PUT | `/api/subscribers/:uid` (bad status/email) | 422 | 422 | **Pass** | S6 |
| POST | `/api/billing/{checkout,offline/checkout}` (bad plan_id) | 422 | 422 | **Pass** | S6 |
| POST | `/api/v1/public/profile/:uid` (bad fields, no auth) | 422 | 422 | **Pass** | S5 |
| POST | `/api/billing/webhook` (unsigned, prod) | 503 fail-closed | 503 (NODE_ENV=production) | **Pass** | signature required in prod |
| POST | `/api/inbound/*` (no token) | rejected | token-gated | **Pass** | `INBOUND_WEBHOOK_TOKEN` |
| GET | `/api/billing/invoices/:uid/pdf` | %PDF (owner only) | %PDF; non-owner 401 | **Pass** | customer-scoped |
| CRUD | `/api/{campaigns,lists,subscribers,templates,sending,...}` | scoped CRUD | works, customer-scoped | **Pass** | — |
| CRUD | `/api/admin/*` | super_admin/ability gated | works, gated | **Pass** | — |

**Notes:** `GET /api/billing/plans` returns a static default list (intentional fallback); `logout` is a client-side token-clear no-op (stateless JWT) — both by design. Secrets are masked in admin gateway/sending-server detail responses (S4 fixed).

---

## 8. Database Audit Results

**Live audit (`backend/scripts/_qa_audit_db.js`, this run):** DB `sendqom`, **88 tables**, **78/78 Prisma `@@map` models resolve to a real table (0 missing)**, **0 orphaned FK rows**. Row counts: users 2, customers 2, admins 1, roles 4, role_permission 170, user_role 2, campaigns 2, mail_lists 2, subscribers 1, templates 6, plans 7, subscriptions 1, payment_gateways 3, sending_servers 1, sending_domains 1, settings 14, currencies 2, country_taxes 1; invoices/invoice_items/transactions/segments/blacklists 0.

| Table | Purpose | Columns/relations checked | Model/API usage | Status | Issues |
|---|---|---|---|---|---|
| `sendq_users` / `sendq_customers` / `sendq_admins` | Identity | PK, `customer.user_id`→users, 2FA cols | auth, account, admin | **Pass** | 0 orphan customers→user |
| `sendq_roles` / `role_permission` / `user_role` | RBAC | role→permission, user→role | rbac.js, admin.rbac.js | **Pass** | 170 permission rows seeded |
| `sendq_campaigns` | Campaigns | `customer_id`,`mail_list_id`,`segment_id`,`options`(LongText) | campaign module | **Pass** | `options` via raw SQL (client not regen) |
| `sendq_mail_lists` / `subscribers` / `segments` / `list_fields` / `subscriber_field_values` | Lists | list→customer, sub→list, field values | lists/subscribers | **Pass** | 0 orphan subs→list |
| `sendq_templates` (+categories) | Templates | m2m categories | templates | **Pass** | — |
| `sendq_plans` / `subscriptions` / `invoices` / `invoice_items` / `transactions` / `currencies` / `country_taxes` | Billing | sub→plan, invoice→customer/currency, items→invoice | billing | **Pass** | 0 orphan sub→plan / invoice→customer |
| `sendq_payment_gateways` / `payment_methods` | Payments | gateway_data JSON, autobilling_data | billing/gateway.config | **Pass** | keys DB-driven |
| `sendq_sending_servers` / `sending_domains` / `bounce_handlers` / `feedback_loop_handlers` | Sending | server→customer, DKIM cols | sending/email-engine | **Pass** | — |
| `sendq_blacklists` | Suppression | `UNIQUE(customer_id,email)` | sending/webhooks | **Pass** | per-tenant + global (NULL) |
| `sendq_open_logs` / `click_logs` / `bounce_logs` / `feedback_logs` / `email_logs` | Tracking | campaign_id, subscriber_id | analytics/tracking | **Pass** | — |
| `sendq_settings` | Config (incl. `invoice_template`, tax, company) | name/value | admin/billing | **Pass** | 14 rows |
| `sendq_store_*` (categories/products/orders/funnels/media) | Store | scalar FKs (isolated) | store module | **Pass** | greenfield, created additively |

**Caveat (non-blocking):** additive columns `campaigns.options` and `blacklists.customer_id` are accessed via raw SQL because the generated Prisma client predates them — works correctly; a one-time `npx prisma generate` (backend stopped) makes them native. **Never** run `prisma migrate`/`db push` on this shared DB.

---

## 9. PHP-to-Node/React Migration Gaps

**Resolved during the migration** (no longer gaps): granular RBAC, webhook fail-closed, tax, per-tenant blacklist, blacklist-at-send, dual-ORM removal, bounce/FBL polling, invoice line items + PDF + custom-template PDF, public API token, outbound webhooks, Google OAuth, plugin runtime, A/B testing, import wizard, segment copy, prorated/immediate billing + upgrade auto-settlement, S5/S6 validation, S7 client gate.

**Remaining gaps (all intentional / out-of-scope, not defects):**
- **RSS-to-email campaigns** — not built (user-deferred; needs a recurring feed scheduler).
- **Automation engine / autoresponders** — **permanently excluded** by project decision (the module, queue, and UI were removed; residual tables remain unused).
- **WooCommerce store-source sync** — not migrated (a standalone Store module exists instead).
- **Live chat, notifications-center depth, GeoIP, install/upgrade wizard, dedicated 2FA-management page** — not migrated by choice (minor / environment-specific).
- **TypeScript / static type-check** — not adopted (JS project; optional quality enhancement, not a parity item).

---

## 10. Bugs Found

**No open bugs this run.** All previously-identified bugs are fixed and re-verified live:

| Bug | Severity | Location | Status |
|---|---|---|---|
| BUG-1 granular RBAC unenforced | High | `auth/rbac.js`, `admin/admin.rbac.js` | **Fixed** — 8/8 live |
| BUG-2 inbound webhook open when token unset | Critical | `webhooks/inbound.controller.js` | **Fixed** |
| BUG-3 Stripe webhook unsigned fallback | High | `billing/billing.controller.js` | **Fixed** — 503 fail-closed in prod |
| BUG-4 tax not applied | High | `billing/tax.service.js` | **Fixed** |
| BUG-5 blacklist not tenant-scoped | High | `sending/admin` + migration | **Fixed** |
| BUG-6 bounce/FBL mailbox polling missing | High | `workers/bounce-poller.js` | **Fixed** — live IMAP 4/4 |
| BUG-7 dual ORM (dead Sequelize) | High | removed | **Fixed** |
| BUG-13 invoice line items + PDF | Medium | `billing/invoice-*.js` | **Fixed** |
| BUG-14 blacklist not consulted at send | High | `campaigns/campaign.sender.js` | **Fixed** |
| S4 admin API returned secrets | Medium | `admin.controller.js` | **Fixed** (masked) |
| SMTP `secure` env-inheritance | Medium | `email-engine/smtp.factory.js` | **Fixed** this session |
| Duplicate object keys | Low | `frontend/src/api/services.js` | **Fixed** (ESLint-caught) |

---

## 11. UI/UX Issues Found

No layout-breaking issues surfaced by the crawl (0 render/console errors). Remaining items are minor/quality and **unverified for visual fidelity** (no design refs):

| Screen | Type | Severity | Expected | Actual | Suggested fix |
|---|---|---|---|---|---|
| Wide data tables (lists/subscribers/admin logs) | Responsive | Low | Usable on mobile | Wide tables overflow on small screens | Wrap in `overflow-x:auto` container |
| Dashboard charts | Usability | Low | Rich analytics | Some charts are simple/placeholder visuals | Enhance with a charting lib |
| Visual parity vs PHP | Layout/Typography/Color | Unknown | Match PHP design | **Cannot verify — no design refs in repo** | Provide Figma/PHP screenshots or run `tools/visual-parity.js` vs live PHP |
| Accessibility (labels/contrast/focus) | Accessibility | Low | WCAG basics | Light-theme contrast previously audited (`contrast-check.js`); full a11y/keyboard audit not done | Run an axe-core pass |

---

## 12. Security and Permission Issues

**No open security issues.** Verified live:
- **Authn:** every protected endpoint → 401 with no token *and* forged token; empty login → 422; bad creds → 401.
- **Authz:** granular admin RBAC enforced server-side (403 for ungranted, 200 for granted/super_admin) + a client-side gate (S7) hides inaccessible admin nav/pages; per-tenant blacklist isolation proven.
- **Payments:** Stripe webhook **fails closed** in production without `STRIPE_WEBHOOK_SECRET`; gateway secrets masked in admin responses (S4).
- **Inbound webhooks:** token-gated (`INBOUND_WEBHOOK_TOKEN`).
- **Input:** express-validator on auth, subscriber update, public profile, billing checkouts; parameterized queries (no SQL injection); bcrypt; helmet; CORS locked to `FRONTEND_URL`; auth rate-limiting (20/15min in prod).
- **Operational pre-prod:** set `INBOUND_WEBHOOK_TOKEN`, `STRIPE_WEBHOOK_SECRET`, a strong `JWT_SECRET`, and a correct `FRONTEND_URL` (CORS origin) — see `DEPLOYMENT.md`.

---

## 13. Build, Dependency, and Runtime Issues

- **Install:** `npm ci` clean (backend + frontend + root lint workspace).
- **Lint:** `npm run lint` → **0 errors, 0 warnings**.
- **Type check:** none — JS project (no TS). Optional: add `jsconfig.json` + `// @ts-check` for incremental safety.
- **Unit/integration tests:** `npm test` → **102/102 pass**.
- **Build:** `vite build` ✓ (chunk-size warning only — cosmetic; consider code-splitting `InvoiceTemplatePage`/main).
- **Start/preview:** backend boots, workers start in-process, `/health` 200; frontend dev + build serve.
- **DB migrations/seeders:** schema is live + additive scripts only (no `prisma migrate` on the shared DB by policy); RBAC seed script present.
- **Runtime caveat:** invoice custom-template PDF needs a Chromium/Edge browser at runtime (else pdfkit fallback — no error). `playwright-core` is a backend dep for this.

---

## 14. Fix Priority

**Must fix before production (operational config — no code):**
- Set `NODE_ENV=production`, `API_URL`, `FRONTEND_URL`, `DATABASE_URL`, `JWT_SECRET`, `REDIS_*`, `SMTP_*` (`backend/.env`).
- Set `STRIPE_WEBHOOK_SECRET` + register the webhook endpoint (if using Stripe); set `INBOUND_WEBHOOK_TOKEN`.
- Enter live gateway keys in Admin → Payment gateways (**Paymob** for Oman; PayPal keys currently invalid — re-enter).
- Reverse proxy serving SPA + `/api` `/track` `/uploads`, with `index.html` fallback for deep links.

**Should fix soon:**
- Run `npx prisma generate` once (backend stopped) to make `options`/`customer_id` native.
- Enable + point the bounce poller at real mailboxes (`BOUNCE_POLL_ENABLED=1`).
- Add a few frontend unit/e2e tests + an axe-core a11y pass.

**Nice to improve:**
- Responsive table overflow wrappers; richer dashboard charts; code-split large bundles; optional `@ts-check`/TypeScript; RSS-to-email (if ever in scope).

---

## 15. Final Verdict

**The migrated application is production-ready as a candidate.** Live this run: **102/102 tests, 0 lint errors/warnings, clean build, backend healthy, 88-table DB with 78/78 model alignment and 0 orphan rows, auth/RBAC enforced (401/403/422 correct), 0 dead-end navigations, 0 broken API calls, and a clean page crawl (2026-06-28: 106 pages clean, 0 problems, 0 artifacts, 14 dynamic skipped)**. Every Critical/High migration bug is fixed and re-verified. The only remaining work is **operational configuration** (env vars, gateway keys, webhook secrets, bounce mailboxes — all documented in `DEPLOYMENT.md`) and **deliberately out-of-scope** features (RSS-to-email, Automation, TypeScript). The one item that **could not be tested** is pixel-level visual parity against the original PHP UI, because **no design files or PHP screenshots exist in the repo** — supply those (or run `tools/visual-parity.js` against a live PHP instance) to close that gap.

---

### Action list

1. **Deploy config** — fill `backend/.env` + `frontend/.env.production` from the `.env.production.example` templates; follow `DEPLOYMENT.md`.
2. **Secrets** — generate `JWT_SECRET`; set `STRIPE_WEBHOOK_SECRET` + `INBOUND_WEBHOOK_TOKEN`; set `FRONTEND_URL`/`API_URL` to real domains.
3. **Gateways** — enter live Paymob keys (Oman) in the admin UI; re-enter valid PayPal REST keys.
4. **DB housekeeping** — `npx prisma generate` once with the backend stopped.
5. **Deliverability** — add real bounce/FBL mailboxes in admin, set `BOUNCE_POLL_ENABLED=1`.
6. **Optional quality** — frontend tests + axe-core a11y; responsive table wrappers; richer charts; `@ts-check`.
7. **Visual parity (if required)** — provide Figma/PHP screenshots or run `tools/visual-parity.js` against the live PHP app.
