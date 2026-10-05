# SendQ Migration — Parity Sweep (2026-06-30)

PHP/Laravel source (`.source/SendQ-Dash`) vs current Node.js (Express+Prisma) + React migration.

**Method:** (1) deterministic route/connection checker (`tools/parity-check.js`); (2) eight parallel semantic audit agents, one per functional domain, each comparing PHP controllers/routes against the Node modules + React pages. *Automation* (incl. autoresponders, RSS-to-email) is permanently excluded by decision and not counted as a gap.

---

## Headline

- **Deterministic layer is clean:** 0 dead-end navigations, 0 broken API calls. Every React route resolves; every frontend API call hits a real backend route. (15 orphan backend routes = endpoints with no caller, info-only.)
- **Core product workflow** — build → segment → design (GrapesJS) → send → track → bill — is at **high parity** and works end-to-end. Billing and Campaign lifecycle are the strongest domains.
- **Full-surface feature count** (enumerating every PHP endpoint, including minor/admin-depth ones) is more sobering than the headline "~90%": of ~268 discrete features audited, **~141 DONE (53%)**, **~62 PARTIAL (23%)**, **~65 MISSING (24%)** — but **~13 of the MISSING are deliberate by-choice omissions**. Excluding those, done-or-partial ≈ **80%**.

> Two valid lenses: **weighted by importance**, the core app is ~90% there; **by raw endpoint count**, ~53% fully done / ~76% done-or-partial. The gaps live in the long tail of secondary + admin-depth features, not the core.

---

## Per-domain breakdown

| Domain | DONE | PARTIAL | MISSING | Top real gaps |
|---|---|---|---|---|
| Auth / Account / 2FA | 18 | 7 | 4 | Facebook OAuth; edit/delete account-user; login captcha + 5-attempt lockout not enforced; UI-pref/theme wizards |
| Campaigns / Templates / Forms / Pages | 38 | 14 | 16 | Attachments; web-view (view-in-browser); preview-as-subscriber; per-campaign webhooks; custom headers; log CSV export; admin Layouts + Monitor-Campaigns |
| Lists / Subscribers / Segments | 19 | 11 | 11 | **Audience backend** (growth chart/tiles are placeholders); **list-level verification** (UI shell, no backend); bulk ops (assign-values/tags/blacklist); custom-field values not saved on subscriber create/update |
| Sending / Deliverability / Verification | 14 | 4 | 7 | **Warmup entirely absent** (regression); **MTA Monitor**; **Senders** (verified From-address CRUD) |
| Billing / Payments / Plans | 22 | 3 | 4 | Customer **sending-credit purchase** flow; enable-recurring; invoice logs; remove-payment-method |
| Analytics / Logs / Tracking | 14 | 9 | 7 | Stats-page geo/email-client panels are **empty placeholders**; log search/sort/export client-side only; pixel lacks signed message_id |
| Admin breadth | 6 | 8 | 8 | **MTA Monitor**; **License/upgrade/patch wizard**; admin global search; GeoIP admin; install wizard; menu builder; Settings is flat key/value vs structured tabs |
| Store / Integration / Misc | 10 | 6 | 8 | Token-auth **public developer API** (`/api/v1` is session-protected only); thin store CRUD; website verify round-trip |

---

## Real gaps, prioritized (excluding by-choice + Automation)

### High — user-visible or product-significant
1. **Warmup subsystem — fully absent (regression).** No backend module, page, route, or API. Project memory claimed it was built; it is not present now. Decide: rebuild or formally drop.
2. **Audience analytics backend missing.** Lists-overview tiles (active %, forms, blacklisted) and the 16-month growth chart are **hardcoded placeholders** — no `AudienceController` equivalent.
3. **Per-campaign stats page has empty placeholder panels** (top countries opens/clicks, top locations, top subscribers, email-client/OS) — some data exists server-side (`campaignBreakdown.countries/links`) but is never passed to the UI. Quick win.
4. **List-level email verification** has a UI shell but **zero backend** (start/stop/progress/reset).
5. **Customer sending-credit purchase flow** absent — admins define credit plans, customers can't buy them.

### Medium — secondary features
6. **Campaign extras:** attachments, web-view/view-in-browser, preview-as-subscriber, custom email headers, per-campaign delivery webhooks.
7. **Log export:** 6 PHP CSV-download endpoints missing; current log search/sort/export are client-side over the current page only.
8. **Bulk subscriber ops:** assign-field-values, add/remove tags, move-to-blacklist; import lacks cancel/log-download; export lacks async job + segment filter.
9. **Correctness:** subscriber create/update doesn't persist **custom field values** (only the public-profile endpoint does); list create/update omits **per-list sending-server assignment**.
10. **Token-authenticated public developer API** — `/api/v1/*` uses session `protect`, not an API-token guard, so programmatic API parity is missing.
11. **Senders** (verified From-address CRUD + verification) — absent.

### Lower — admin depth & polish
12. **MTA Monitor** (PowerMTA/Prometheus dashboards) — whole admin subsystem absent.
13. **License / upgrade / patch wizard** — license is read-only; no activation/upgrade path.
14. Admin **global search**, **GeoIP admin**, **install wizard**, **menu builder**, **HTTP-config request logs**, notifications-popup.
15. **Settings** is a flat key/value store vs PHP's structured tabs (general/appearance/slider/cronjob/advanced).
16. **Auth security:** login captcha enforced on register only; 5-attempt/2-min lockout replaced by a generic IP limiter.
17. Misc: Facebook OAuth, edit/delete account-user, theme/UI-preference wizards, template export, thumb-by-URL, dashboard activity feed is synthesized (not a real event log).

---

## By-choice omissions (not counted as gaps)
WooCommerce/source sync · storefront site-builder · chat/support · customer notifications center · admin global search¹ · extra payment gateways (Razorpay/Paystack/Braintree) · audience-growth (now flagged as a real gap above) · Automation (permanently excluded).

¹ listed under by-choice in Store domain; appears again under admin depth — same feature.

---

## Where the migration is *ahead* of PHP
- **Deliverability ingestion:** added provider webhooks (SES/SNS, Mailgun, SendGrid, generic) **alongside** the IMAP bounce/FBL poller — PHP was mailbox-only.
- **Segments:** live preview subscriber count.
- **Paymob** gateway (no PHP equivalent), DKIM 2048-bit + DMARC live checks, prorated plan changes with off-session upgrade settlement.

---

## Recommended next actions
1. **Decide Warmup:** rebuild the subsystem or formally remove it from scope (and the customer nav, if any remnant).
2. **Quick win:** wire the existing `campaignBreakdown` data into the stats-page geo/links panels (data already computed; UI just isn't fed).
3. **Audience backend:** add an overview/growth endpoint to replace the hardcoded placeholders.
4. Triage the Medium list against business priority (log export, bulk ops, custom-field-on-update correctness, developer API token).

*Generated by automated parity sweep — deterministic checker + 8 domain audit agents.*
