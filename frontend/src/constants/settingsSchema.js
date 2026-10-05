// Field definitions for the admin All Settings tabs. Each field binds to a key in
// the sendq_settings key/value store. `def` is the default shown when unset.
// Types: text | password | number | textarea | toggle | select | color | file | heading

// General tab is two independent columns matching the original layout exactly.
export const GENERAL_LEFT = [
  { key: 'site_name', label: 'Site name', type: 'text', def: 'SendQ - Send with Unlimited Confidence' },
  { key: 'site_logo_dark', label: 'Site logo (for dark background)', type: 'file' },
  { key: 'site_favicon', label: 'Site favicon', type: 'file' },
  { key: 'offline_message', label: 'Offline message', type: 'textarea', def: 'Application currently offline. We will come back soon!' },
  { key: 'default_language', label: 'Default language', type: 'select', def: 'English', options: ['English'] },
  { key: 'default_admin_view_scheme', label: 'Default admin view scheme', type: 'select', def: 'Green', options: ['Green', 'Blue', 'Red', 'Purple'] },
  { type: 'spacer' }, { type: 'spacer' }, { type: 'spacer' },
  { key: 'captcha', label: 'Captcha', type: 'toggle', def: '1', help: 'Enable captcha to block spammers and bots from accessing the webapp.' },
  { key: 'captcha_list_signup', label: 'Captcha for List Sign-Up Form', type: 'toggle', def: '0', help: 'Enabling the captcha will ensure that the list sign-up page cannot be spammed.' },
  { key: 'registration_recaptcha', label: 'Registration captcha', type: 'toggle', def: 'no', onVal: 'yes', offVal: 'no', help: 'Enable captcha for registration to block spammers and bots from accessing the webapp. Requires a Site Key and Secret Key below.' },
  { key: 'builder', label: 'Builder', type: 'select', def: 'Pro', options: ['Pro', 'Classic'] },
  { key: 'invoice_number_format', label: 'Invoice number format', type: 'text', def: '%08d' },
  { key: 'enable_https_tracking', label: 'Enable HTTPS for the tracking domain', type: 'toggle', def: '1', help: 'A tracking domain tracks user interactions within email content. Enabling HTTPS secures the tracking domain, protecting data and ensuring trust.' },
  { key: 'allow_campaign_duplication', label: 'Allow campaign duplication', type: 'toggle', def: '1', help: 'This setting allows customers to duplicate existing campaigns, making it easier to reuse campaign structures or content.' },
  { key: 'skip_failed_emails', label: 'Skip failed email messages', type: 'toggle', def: '1', help: 'This setting allows the system to skip sending emails that have previously failed. It helps avoid repeated attempts and improves overall email processing efficiency.' },
  { key: 'require_dkim', label: 'Require DKIM for domain verification', type: 'toggle', def: '0', help: 'When enabled, sending domains must have a valid DKIM TXT record before they can be marked as Active. When disabled, only the identity TXT record is required — DKIM records will still be generated and displayed so users can add them voluntarily, but they will not block verification.' },
  { key: 'smtp_emails_per_connection', label: 'SMTP emails per connection', type: 'inline-number', def: '900', help: 'Maximum number of emails to send through a single SMTP connection before reconnecting. Reusing connections dramatically speeds up sending. Most SMTP providers support up to 1,000. Set to 0 to disable connection reuse. Default: 900.' },
  { key: 'max_tracked_links', label: 'Max tracked links per email (SMTP)', type: 'inline-select', def: 'First 5', options: ['First 5', 'First 10', 'First 15', 'First 20', 'All'], help: 'For SMTP sending servers, only track clicks on the first N links in each email. Fewer tracked links reduces spam score. This setting does not apply when using provider tracking (SendGrid).' },
  { key: 'user_global_blacklist', label: 'User Global Blacklist', type: 'toggle', def: '0', help: 'Enable this option to apply the global email blacklist to all campaigns, preventing emails from being sent to blacklisted addresses.' },
  { type: 'spacer' },
];

export const GENERAL_RIGHT = [
  { key: 'site_keyword', label: 'Site keyword', type: 'text', def: 'SendQ' },
  { key: 'site_logo_light', label: 'Site logo (for light background)', type: 'file' },
  { key: 'online_status', label: 'Online status', type: 'toggle', def: '1', help: 'Set the website status to offline. Display the site offline messages.' },
  { key: 'site_description', label: 'Site description', type: 'text', def: 'Powered by Tamimah Digital' },
  { key: 'campaign_view_scheme', label: 'Campaign view scheme', type: 'select', def: 'Blue', options: ['Blue', 'Green', 'Red', 'Purple'] },
  { key: 'captcha_engine', label: 'Captcha provider', type: 'select', def: 'recaptcha', options: [{ value: 'recaptcha', label: 'reCAPTCHA v2' }, { value: 'recaptcha_v3', label: 'reCAPTCHA v3' }, { value: 'hcaptcha', label: 'hCaptcha' }] },
  { key: 'recaptcha_site_key', label: 'reCAPTCHA / hCaptcha Site Key', type: 'text' },
  { key: 'recaptcha_secret_key', label: 'reCAPTCHA / hCaptcha Secret Key', type: 'password' },
  { type: 'note', text: 'reCAPTCHA keys must match the reCAPTCHA version (v2 or v3). Make sure the keys are for the correct version.' },
  { key: 'embedded_form_captcha', label: 'Embedded form captcha', type: 'toggle', def: '0', help: 'Enable captcha for embedded form to block spammers and bots from accessing the webapp.' },
  { key: 'enable_customer_registration', label: 'Enable customer registration', type: 'toggle', def: '1', help: 'Enable this option to allow visitors to create a new customer account and register for a plan.' },
  { key: 'custom_scripts', label: 'Copy and paste your custom scripts in the box below. It will be included in every page. For example, you can include your Google Analysis code here to track your website statistics.', type: 'textarea' },
  { key: 'current_invoice_number', label: 'Current invoice number (it will be increased by 1 when a new invoice added)', type: 'number', def: '33' },
  { key: 'enable_2fa', label: 'Enable 2FA', type: 'toggle', def: '0', help: 'Two-Factor Authentication (2FA) with email adds an extra layer of security by requiring users to verify their identity through a unique code sent to their email, enhancing the protection of online accounts from unauthorized access.' },
  { key: 'enable_oneclick_unsubscribe', label: 'Enable one-click unsubscribe headers', type: 'toggle', def: '1', help: 'This setting enables one-click unsubscribe headers in emails, allowing recipients to easily opt out of future messages.' },
  { key: 'default_double_optin', label: 'Default double opt-in for new lists', type: 'toggle', def: '0', help: 'This setting allows the system to skip sending emails that have previously failed. It helps avoid repeated attempts and improves overall email processing efficiency.' },
  { key: 'email_signature', label: 'Email Signature', type: 'toggle', def: '1', help: 'Enable email signatures, allowing users to create and insert them into their email content.' },
  { key: 'disable_data_caching', label: 'Disable data caching (live counts)', type: 'toggle', def: '1', help: 'When enabled, subscriber counts and list statistics are computed live from the database on every page load instead of using cached values. This ensures counts are always accurate but may slow down page loads for large lists (10,000+ subscribers). Recommended only for small to medium accounts.' },
  { key: 'use_provider_tracking', label: 'Use provider tracking (SendGrid)', type: 'toggle', def: '1', help: 'When enabled and sending via SendGrid API, open and click tracking is handled by SendGrid instead of injecting tracking pixels and rewriting links in the email body. This improves deliverability with Gmail and other providers.' },
  { key: 'auto_blacklist', label: 'Auto-blacklist on bounce/spam report', type: 'toggle', def: '1', help: 'When enabled, subscribers are automatically blacklisted when a hard bounce or spam report is received. Disable this if valid emails are being incorrectly blacklisted. Bounce and spam events are still logged regardless of this setting.' },
  { key: 'enable_automation_webhook', label: 'Enable Automation Outgoing Webhook', type: 'toggle', def: '1', help: "Include an outgoing webhook as one of the available actions in the automation's actions list, allowing seamless integration with external services." },
  { type: 'link', text: 'View hidden configuration settings' },
];

export const SYSTEM_EMAIL_FIELDS = [
  { key: 'sysmail_method', label: 'Method for sending system mail', type: 'select', def: 'SMTP', options: ['SMTP', 'Sendmail', 'PHP Mail'], full: true },
  { key: 'sysmail_host', label: 'Hostname', type: 'text' },
  { key: 'sysmail_port', label: 'Port', type: 'text', def: '465' },
  { key: 'sysmail_encryption', label: 'Encryption', type: 'text', def: 'ssl' },
  { key: 'sysmail_username', label: 'Username', type: 'text' },
  { key: 'sysmail_password', label: 'Password', type: 'password' },
  { key: 'sysmail_from_email', label: 'From email', type: 'text' },
  { key: 'sysmail_from_name', label: 'From name', type: 'text' },
];

export const SYSTEM_URL_FIELDS = [
  { key: 'app_url', label: 'Application URL', type: 'text', full: true },
  { key: 'frontend_url', label: 'Frontend URL', type: 'text' },
  { key: 'backend_url', label: 'Backend / Admin URL', type: 'text' },
  { key: 'tracking_url', label: 'Tracking URL', type: 'text' },
  { key: 'api_url', label: 'API URL', type: 'text' },
];

export const PHP_PATHS = ['/usr/bin/php', '/bin/php', '/usr/lib/php', '/etc/php', '/usr/include/php', '/usr/share/php', 'Other path'];

// Login & Signup Design — colour groups.
export const DESIGN_GROUPS = [
  { title: 'Login & Signup Interface', sub: 'Page Layout', fields: [
    { key: 'd_page_bg', label: 'Page Background', def: '#ffffff', help: 'Full page background color' },
    { key: 'd_card_bg', label: 'Card Background', def: '#eff3f5', help: 'Form card background' },
    { key: 'd_copyright', label: 'Copyright Text Color', def: '#9ca3af', help: 'Bottom copyright text' },
  ] },
  { sub: 'Form Text & Labels', fields: [
    { key: 'd_title', label: 'Title Color', def: '#1a1a2e', help: '"Sign In", "Create Account" etc.' },
    { key: 'd_subtitle', label: 'Subtitle Color', def: '#6b7280', help: 'Description text below title' },
    { key: 'd_label', label: 'Label Color', def: '#5e5c64', help: 'Form field labels' },
    { key: 'd_form_text', label: 'Form Text Color', def: '#000000', help: 'Input text color' },
  ] },
  { sub: 'Input Fields', fields: [
    { key: 'd_input_bg', label: 'Input Background', def: '#ffffff' },
    { key: 'd_input_border', label: 'Input Border Color', def: '#e0e0e0' },
    { key: 'd_input_focus', label: 'Input Focus Color', def: '#d32f2f', help: 'Border color on focus' },
  ] },
  { sub: 'Buttons & Links', fields: [
    { key: 'd_button', label: 'Button Color', def: '#e01b24', help: 'Primary action button' },
    { key: 'd_button_hover', label: 'Button Hover Color', def: '#b71c1c' },
    { key: 'd_link', label: 'Link Color', def: '#d32f2f', help: '"Sign Up", "Forgot Password" links' },
  ] },
  { sub: 'Slider Panel (Right Side)', fields: [
    { key: 'd_slider_bg', label: 'Slider Background', def: '#ffffff' },
    { key: 'd_slider_heading', label: 'Slider Heading Color', def: '#1a1a2e' },
    { key: 'd_slider_subtitle', label: 'Slider Subtitle Color', def: '#6b7280' },
    { key: 'd_slider_list', label: 'Slider List Text Color', def: '#374151' },
    { key: 'd_slider_accent', label: 'Slider Accent Color', def: '#d32f2f', help: 'Check icons & active pager dot' },
    { key: 'd_slider_text', label: 'Slider Text Color', def: '#000000', help: 'General slider text' },
    { key: 'd_pager_dot', label: 'Pager Dot Color', def: '#d1d5db', help: 'Inactive pager dots' },
    { key: 'd_pager_active', label: 'Pager Active Color', def: '#d32f2f' },
  ] },
];

export const BACKEND_DESIGN_GROUPS = [
  { title: 'Backend Panel (Admin & Customer)', sub: 'Buttons & Links', fields: [
    { key: 'b_primary', label: 'Primary Button Color', def: '#d32f2f' },
    { key: 'b_primary_hover', label: 'Primary Button Hover', def: '#b82222' },
    { key: 'b_info', label: 'Info Button Color', def: '#97b5c9' },
    { key: 'b_link', label: 'Link Color', def: '#247593' },
    { key: 'b_link_hover', label: 'Link Hover Color', def: '#1a5a72' },
  ] },
  { sub: 'Navigation & Layout', fields: [
    { key: 'b_navbar', label: 'Navbar Color', def: '#000000', help: 'Top navigation bar' },
    { key: 'b_sidebar_active', label: 'Sidebar Active Color', def: '#00a7f4' },
    { key: 'b_tab_active', label: 'Tab Active Color', def: '#247593' },
    { key: 'b_page_bg', label: 'Page Background', def: '#ffffff' },
  ] },
  { sub: 'Text & Headings', fields: [
    { key: 'b_body_text', label: 'Body Text Color', def: '#333333' },
    { key: 'b_heading', label: 'Heading Color', def: '#333333' },
  ] },
];
