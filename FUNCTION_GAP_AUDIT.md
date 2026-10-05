# Original Function Gap Audit

This audit compares the original SendQ PHP dashboard in `.source/SendQ-Dash/SendQ---APP-dev` and `ORIGINAL_UI_MIGRATION_MAP.md` with the current Node + React project.

Status labels:

- `Present`: route/page/API exists and has real behavior.
- `Partial`: a route or page exists, but not the full original workflow.
- `UI-only`: the screen exists, but actions are alerts, local state, placeholder messages, or static layout.
- `Missing backend`: the frontend route exists, but no matching backend API module exists.
- `Missing UI`: the original function exists, but no current React route/page exists.
- `Dead end`: a button/link is clickable but ends at a placeholder, generic empty page, or no useful action.

> Re-verified 2026-06-14 against current code. Several areas previously listed as
> missing/UI-only are now backend-backed (auth password reset + activation, templates,
> account, admin core, campaign wizard, BullMQ job queue, real SMTP send engine).

## Summary

The current project has the main SaaS shell plus a working core send platform: auth
(incl. password reset + email activation), dashboard, campaign CRUD + 5-step wizard,
a BullMQ-backed campaign send worker with a real SMTP/SES/Gmail dispatcher, lists with
settings/fields/segments/forms/import/export, subscriber CRUD, template CRUD, sending
domain CRUD+verify, account (profile/contact/users/roles/subscription/logs), and an
admin panel with ~14 real modules.

The biggest remaining gaps compared to the original project are:

- Admin panel breadth: 37 of 51 admin routes are `emptyModule()` placeholders (settings,
  languages, currencies, sending servers, bounce/FBL handlers, system logs, etc.).
- Payments: no gateway code at all (Stripe/Braintree/PayPal/etc.) — billing models exist only.
- Email warmup: no controller/engine (models only); UI is static.
- Email verification engines (ZeroBounce/NeverBounce/Emailable) and bounce/FBL processing.
- Additional API-based email providers (Mailgun, SendGrid, SparkPost, ElasticEmail, Brevo…).
- Automation depth: 28-line engine stub; no visual builder, triggers, wait/condition steps.
- Visual builders (template drag-drop, form/page builder), analytics drilldowns, i18n.
- E-commerce/store/funnels and integration website-connection backend.

## Backend Coverage

Current mounted backend modules in `backend/src/bootstrap/app.js`:

- `Present`: `/api/auth` (login, register, verify-email, resend-verification, forgot/reset-password, me, api-token renew, logout)
- `Partial`: `/api/campaigns` (CRUD, run, pause, resume, unschedule, send)
- `Partial`: `/api/subscribers` (CRUD)
- `Partial`: `/api/analytics` (dashboard, campaign — no drilldowns)
- `Partial`: `/api/automation` (index, store, trigger — engine is a stub)
- `Partial`: `/api/billing` (current, static plans)
- `Present`: `/api/account` (overview, profile, contact, users, roles, subscription, logs)
- `Partial`: `/api/admin` (14 real modules + 37 `emptyModule` stubs)
- `Present`: `/track/open`, `/track/click`, `/track/unsubscribe`
- `Partial`: `/api/v1` legacy routes (dashboard, campaigns, lists+settings/fields/segments/forms/import/export, templates, sending-domains)
- Infra: BullMQ queue (`src/queues/`) + worker (`src/workers/campaign.worker.js`); email engine (`src/modules/email-engine/`)

Backend API areas still missing compared with the original PHP project:

- Payment gateways (Stripe et al.), invoices/payment methods/credits checkout
- Tracking domains, email verification servers, blacklist, signatures (admin stubs only)
- Email warmup accounts/plans/templates/progress + warmup jobs
- Email verification jobs/engines; bounce + feedback-loop handlers
- Additional API email providers
- Websites/integration connection CRUD
- Two-factor auth, Google/Facebook OAuth
- Campaign logs/report drilldowns, copy/archive/test-send actions
- Most admin modules (settings, languages, currencies, sending servers, system logs, etc.)
- E-commerce/store module

## Frontend Function Gaps

| Module | Original function | Current status | Gap / dead end | Current target files |
| --- | --- | --- | --- | --- |
| Auth | Login/register/current user | `Present` | Login works if backend, DB, and role seed are valid. Rate limit can block repeated login attempts. | `frontend/src/pages/auth/*`, `backend/src/modules/auth/*` |
| RBAC | Admin group permissions, user roles | `Partial` | RBAC seed exists, but most UI pages do not enforce permissions yet. | `backend/src/modules/auth/rbac.js`, `backend/scripts/seed-rbac.js` |
| Dashboard | Credits, recent campaign, statistics, performance, countries, growth, activities | `Partial` | Visuals exist, but many chart/log links do not map to full original report pages. | `frontend/src/pages/dashboard/DashboardPage.jsx` |
| Campaigns | List/filter/search campaigns | `Partial` | List UI exists; filtering/search depends on current API coverage. | `frontend/src/pages/campaigns/CampaignsPage.jsx` |
| Campaigns | Create campaign wizard | `Partial` | 5-step wizard exists (`wizard/`) and posts to campaign API; send runs via BullMQ worker. Original A/B types, attachments, headers, signature, spam-score, test-send still missing. | `frontend/src/pages/campaigns/wizard/*`, `campaign.controller.js`, `workers/campaign.worker.js` |
| Campaigns | Edit campaign | `Partial` / `Dead end` | Edit buttons exist visually in some screens, but original edit workflow is not fully implemented. | `CampaignsPage.jsx` |
| Campaigns | Campaign statistics overview | `Partial` | Statistics page exists, but original logs, countries, performance, open/click/bounce/report/unsubscribe drilldowns are not fully wired. | `CampaignStatisticsPage.jsx` |
| Campaigns | Pause/resume/run/delete/copy/dropdown actions | `Partial` | Some backend endpoints exist, but UI coverage is incomplete and not all original dropdown actions are matched. | `campaign.routes.js`, `CampaignsPage.jsx` |
| Lists overview | Audience summary, audience growth, quick actions | `Partial` | Layout exists; relies on limited dashboard/list data. Quick action flows are only partly cloned. | `ListsOverviewPage.jsx` |
| Lists | My lists index | `Partial` | List rows and statistics navigation exist. Create/edit/delete/actions are not fully original. | `ListsPage.jsx` |
| List detail | Overview tab | `Partial` | Visual statistics/growth exist, but not all original activity/geography/log drilldowns are complete. | `ListDetailOverviewPage.jsx`, `ListStatisticsPage.jsx` |
| List detail | Settings tab | `Present` | Settings page loads and saves real `MailList` settings. | `ListEmptyTabPage.jsx`, `legacy/list.controller.js` |
| List detail | Subscribers dropdown: View all | `Present` | Contacts/subscribers list loads list-specific subscribers and edit/delete use real subscriber API. | `SubscribersPage.jsx`, `ListDetailTabs.jsx`, `subscriber.controller.js` |
| List detail | Subscribers dropdown: Add | `Present` | New subscriber modal creates a real list-owned subscriber. | `SubscribersPage.jsx`, `subscriber.controller.js` |
| List detail | Subscribers dropdown: Import | `Present` | CSV import posts to the selected list and creates/updates list-owned subscribers. | `ListDetailTabs.jsx`, `legacy/list.controller.js` |
| List detail | Subscribers dropdown: Export | `Present` | Export downloads list-specific subscribers as CSV. | `ListDetailTabs.jsx`, `legacy/list.controller.js` |
| List detail | Segments dropdown: View all | `Present` | Segment page loads persisted segments for the selected list. | `SegmentsPage.jsx`, `legacy/list.controller.js` |
| List detail | Segments dropdown: Add | `Partial` | Add creates a persisted segment. The original condition-builder UI is still not fully cloned. | `SegmentsPage.jsx`, `legacy/list.controller.js` |
| List detail | Forms / Pages dropdown | `Partial` | Forms page loads and creates persisted forms/pages. The original visual builders for each form/email page still need deeper matching. | `FormsPage.jsx`, `CreateFormPage.jsx`, `legacy/list.controller.js` |
| List detail | Manage list fields | `Present` | Page loads default fields and supports persisted custom field add/delete. | `ListEmptyTabPage.jsx`, `legacy/list.controller.js` |
| List detail | Email verification | `Partial` | Layout exists, but server selection/process/reset actions are not backed by original verification jobs. | `EmailVerificationPage.jsx` |
| List detail | Webhook modal JSON/Form POST | `Present` | Modal layout/copy buttons exist and public subscriber endpoint creates list-owned subscribers. | `WebhookModal.jsx`, `legacy/list.controller.js` |
| Templates | My templates / base gallery | `Partial` | Template backend now exists (`templateController`: index/store/show/update/destroy/copy). Gallery wiring + categories still need depth. | `TemplatesPage.jsx`, `controllers/templateController.js` |
| Templates | Create / edit template | `Partial` | Create + editor page wired to template API. Drag-drop PRO builder still missing. | `TemplatesPage.jsx`, `TemplateEditorPage.jsx` |
| Templates | Copy / delete | `Present` | Backed by `/templates/:uid/copy` and delete endpoints. | `templateController.js` |
| Templates | Upload HTML / preview / export / categories / layouts | `Partial` / `Missing` | Core CRUD exists; upload/export/category/layout flows not yet matched. | `TemplatesPage.jsx` |
| Sending | Sending domains index | `Partial` | Visual list/detail/create pages exist. Backend sending-domain API is missing. | `SendingDomainsPage.jsx` |
| Sending | New sending domain | `UI-only` / `Missing backend` | Form exists; save requires real sender/domain API. | `NewSendingDomainPage.jsx` |
| Sending | View sending domain DNS records | `Partial` | Detail page exists visually. Verify/delete are not fully original-backed. | `SendingDomainDetailPage.jsx` |
| Sending | Tracking domains | `UI-only` | Generic empty section page only. | `SendingEmptySectionPage.jsx` |
| Sending | Email verification servers | `UI-only` | Generic empty section page only. | `SendingEmptySectionPage.jsx` |
| Sending | Blacklist | `UI-only` | Generic empty section page only. No import/search/delete backend. | `SendingEmptySectionPage.jsx` |
| Sending | Signatures | `UI-only` | Generic empty section page only. No signature editor. | `SendingEmptySectionPage.jsx` |
| Email warmup | Dashboard metrics/charts | `UI-only` | Layout exists with empty/static values. No warmup API. | `EmailWarmupPage.jsx` |
| Email warmup | SMTP accounts | `UI-only` | Add account modal exists; save disabled/no backend. | `EmailWarmupPage.jsx` |
| Email warmup | Warmup plans | `UI-only` | Empty section only. | `EmailWarmupPage.jsx` |
| Email warmup | Email templates | `UI-only` | Empty section only. | `EmailWarmupPage.jsx` |
| Integration | Add your website | `Partial` / `Missing backend` | Layout exists, but get-code/save flow is not backed by website API. | `AddWebsitePage.jsx` |
| Integration | Manage connections/sites | `Partial` / `Missing backend` | Empty/list layout exists; no site CRUD/show/connect backend. | `ManageConnectionsPage.jsx` |
| Campaign API / Account | API docs, endpoint, token copy, renew token | `Partial` | Token renew exists; docs URL depends on env. | `CampaignApiPage.jsx`, `auth.routes.js` |
| Campaign API / Account | My profile | `Partial` | Profile form now reads/saves user and customer names/timezone. Original image/password/2FA preferences still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Campaign API / Account | Contact information | `Partial` | Contact form now reads/saves email and names. Original full contact/address fields still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Campaign API / Account | Users | `Partial` | Users list and create user are wired to backend. Original invite/edit/delete/role assignment management still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Campaign API / Account | Roles | `Partial` | Roles and permission counts now load from DB. Original role editor/permission matrix still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Campaign API / Account | Subscription & Credits | `Partial` | Subscriptions/plans now load from DB. Original change plan/payment/credit purchase flow still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Campaign API / Account | Billing | `Partial` | Billing tab now lists current subscription records. Original invoices/payment methods/billing address still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Campaign API / Account | Logs | `Partial` | Logs tab now derives recent campaign/list/subscriber activity from DB. Original dedicated activity-log model still missing. | `CampaignApiPage.jsx`, `account.routes.js` |
| Billing | Plans/current billing | `Partial` | Minimal backend exists, but original billing/payment UI is not cloned. | `BillingPage.jsx`, `billing.routes.js` |
| Automation | Automation list/triggers/actions | `Partial` | Basic backend exists; original automation builder/workflow UI is not complete. | `AutomationPage.jsx`, `automation.routes.js` |
| Analytics | Dashboard/campaign aggregate | `Partial` | Basic endpoints exist; original report drilldowns are missing. | `AnalyticsPage.jsx`, `analytics.routes.js` |
| Activities | Activities page/drawer | `Partial` | Activity drawer/page exists, but many actions are local/static and not original log-backed. | `ActivitiesPage.jsx`, `AppLayout.jsx` |
| Admin | Administrator dashboard and admin modules | `Missing UI` / `Missing backend` | RBAC seed exists, but the original admin panel modules are not implemented. | Need `/admin` frontend and backend modules |

## Original Admin Functions Not Yet Matched

The original project treats `admin_group_id = 1` as the Administrator group with full permissions. The current project has RBAC seed scaffolding, but not the full admin UI/API.

Original admin areas still missing or incomplete:

- Admin dashboard
- Admin users
- Admin groups and permissions editor
- Customers/tenants management
- Subscription management
- Plan management
- Payment method/payment service management
- Sending server management
- Bounce handler and feedback loop handler management
- Sending identity/domain/server administration
- Template/layout management
- Application settings
- Languages
- Currencies
- Reports and system logs

## Dead-End Patterns Found

These are current code patterns that indicate a function is not truly implemented yet:

- Buttons that call `window.alert('... ready for backend wiring.')` outside the Lists module.
- Generic placeholder pages such as `SendingEmptySectionPage.jsx` and `ListEmptyTabPage.jsx`.
- Account tabs in `CampaignApiPage.jsx` that show “layout is ready” or empty cards.
- Template action dropdowns that only alert for preview/upload/create/export/copy/category/builder.
- Warmup Add Account modal where save is disabled.
- Pages that render empty arrays without API calls.

## Recommended Matching Order

To match the original project safely, implement in this order:

1. Account and admin foundation: profile/contact/users/roles/logs/admin panel with RBAC enforcement.
2. Lists advanced workflows: email verification jobs and deeper form/segment builders.
3. Sending module: sending domains backend, tracking domains, verification servers, blacklist, signatures.
4. Templates: data model, upload/create/gallery/actions/builders.
5. Campaign workflows: create/edit/schedule/copy/delete/dropdowns/stat logs/drilldowns.
6. Email warmup: accounts, plans, templates, progress metrics.
7. Integration/websites: get-code flow, site CRUD, connection management.
8. Dashboard/report/activity drilldowns.

This file should be used as the checklist for matching every original click, route, and function.
