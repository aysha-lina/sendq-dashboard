# Original SendQ UI Migration Map

Original UI source:

`D:\sendq-nodejs-react\.source\SendQ-Dash\SendQ---APP-dev`

Use this folder as the source of truth for layout, spacing, labels, dropdowns, actions, icons, and page structure.

## Shared Layout

| React target | Original source |
| --- | --- |
| `frontend/src/components/layout/AppLayout.jsx` | `resources/views/layouts/core/frontend.blade.php` |
| Sidebar/menu | `resources/views/layouts/core/_menu_frontend_saas.blade.php` |
| Header/search/theme controls | `resources/views/layouts/core/_headbar_frontend.blade.php`, `resources/views/search/*.blade.php` |
| Footer | `resources/views/layouts/core/_footer.blade.php` |
| Theme CSS | `public/core/css/theme/*.css`, `resources/views/layouts/core/_custom_theme.blade.php` |
| Logos/assets | `public/images/logo_light.svg`, `public/images/logo_dark.svg`, `public/images/logo_goodmail_*.svg` |

## Lists Module

| React target | Original source |
| --- | --- |
| `frontend/src/pages/lists/ListDetailTabs.jsx` | `resources/views/lists/_menu.blade.php` |
| `frontend/src/pages/lists/ListDetailOverviewPage.jsx` | `resources/views/lists/overview.blade.php`, `resources/views/lists/_stat.blade.php`, `resources/views/lists/_growth_chart.blade.php` |
| `frontend/src/pages/lists/ListsOverviewPage.jsx` | `resources/views/lists/index.blade.php`, `resources/views/lists/_quick_view.blade.php` |
| `frontend/src/pages/lists/ListsPage.jsx` | `resources/views/lists/index.blade.php`, `resources/views/lists/_list.blade.php` |
| `frontend/src/pages/subscribers/SubscribersPage.jsx` | `resources/views/subscribers/index.blade.php`, `resources/views/subscribers/_list.blade.php` |
| `frontend/src/pages/lists/SegmentsPage.jsx` | `resources/views/segments/index.blade.php` |
| `frontend/src/pages/lists/FormsPage.jsx` | `resources/views/lists/embedded_form.blade.php`, `resources/views/pages/*.blade.php` |
| `frontend/src/pages/lists/EmailVerificationPage.jsx` | `resources/views/lists/email_verification.blade.php`, `resources/views/lists/email_verification_progress.blade.php` |
| `frontend/src/pages/lists/WebhookModal.jsx` | `resources/views/lists/webhookJson.blade.php`, `resources/views/lists/webhookForm.blade.php`, `resources/views/lists/webhookExample.blade.php` |

Original list tab menu source:

`resources/views/lists/_menu.blade.php`

This defines the exact top list tabs:

- Overview
- Settings
- Subscribers dropdown: View all, Add, Import, Export
- Segments dropdown: View all, Add
- Forms / Pages dropdown: Embedded form, Subscribe pages/emails, Unsubscribe pages/emails, Update profile pages/emails
- Manage list fields
- Email verification

## Sending Module

| React target | Original source |
| --- | --- |
| `frontend/src/pages/sending/SendingDomainsPage.jsx` | `resources/views/senders/index.blade.php`, `resources/views/senders/_list.blade.php`, `resources/views/senders/_menu.blade.php` |
| `frontend/src/pages/sending/NewSendingDomainPage.jsx` | `resources/views/senders/create.blade.php`, `resources/views/senders/_form.blade.php` |
| `frontend/src/pages/sending/SendingDomainDetailPage.jsx` | `resources/views/senders/show.blade.php`, `resources/views/senders/verified.blade.php`, `resources/views/senders/failed.blade.php` |
| Tracking domains | `resources/views/tracking_domains/*.blade.php` |
| Email verification servers | `resources/views/email_verification_servers/*.blade.php` |
| Blacklist | `resources/views/blacklists/*.blade.php` |
| Signatures | `resources/views/signatures/*.blade.php` |

## Email Warmup

| React target | Original source |
| --- | --- |
| `frontend/src/pages/email-warmup/EmailWarmupPage.jsx` | `resources/views/warmup/index.blade.php`, `resources/views/warmup/_menu.blade.php` |
| SMTP accounts | `resources/views/warmup/accounts/index.blade.php`, `_list.blade.php`, `_form.blade.php` |
| Warmup plans | `resources/views/warmup/plans/index.blade.php` |
| Email templates | `resources/views/warmup/emails/index.blade.php` |

## Integration / Websites

| React target | Original source |
| --- | --- |
| `frontend/src/pages/integration/AddWebsitePage.jsx` | `resources/views/websites/index.blade.php`, `create.blade.php`, `connectJs.blade.php` |
| `frontend/src/pages/integration/ManageConnectionsPage.jsx` | `resources/views/websites/list.blade.php`, `show.blade.php` |

## Campaigns

| React target | Original source |
| --- | --- |
| `frontend/src/pages/campaigns/CampaignsPage.jsx` | `resources/views/campaigns/index.blade.php`, `_list.blade.php`, `_menu.blade.php` |
| Campaign statistics | `resources/views/campaigns/overview.blade.php`, statistics/log partials |

## Templates

| React target | Original source |
| --- | --- |
| `frontend/src/pages/templates/TemplatesPage.jsx` | `resources/views/templates/index.blade.php`, template list/gallery partials |
| Base template gallery | `database/templates/basic/**`, `resources/views/templates/**` |

## Account / Campaign API

| React target | Original source |
| --- | --- |
| `frontend/src/pages/campaign-api/CampaignApiPage.jsx` | `resources/views/account/api.blade.php`, account menu partials |
| Billing/subscription | `resources/views/account/subscription*.blade.php`, `resources/views/sending_credit_plans/*.blade.php` |

## Working Rule

For every UI migration request:

1. Read the original Blade file(s) listed here.
2. Read any included partials from the same module.
3. Copy structure, labels, spacing, menus, and empty states into React.
4. Keep existing React API calls where available.
5. Do not invent data. Use real API data or neutral placeholders like `-`.
6. Run `npm run build` in `frontend` after edits.
