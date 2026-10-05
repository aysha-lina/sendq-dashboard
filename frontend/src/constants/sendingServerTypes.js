// Sending server provider types — mirrors the original SendQ "Select sending server type".
// Each type defines its display metadata + the credential fields shown in the editor.
const F = {
  api_key: { key: 'api_key', label: 'API Key', type: 'password', required: true },
  api_secret_key: { key: 'api_secret_key', label: 'API Secret Key', type: 'password' },
  domain: { key: 'domain', label: 'Domain', type: 'text', required: true },
  host: { key: 'host', label: 'Hostname', type: 'text', required: true },
  smtp_port: { key: 'smtp_port', label: 'SMTP Port', type: 'number', required: true },
  smtp_username: { key: 'smtp_username', label: 'SMTP Username', type: 'text', required: true },
  smtp_password: { key: 'smtp_password', label: 'SMTP Password', type: 'password', required: true },
  smtp_protocol: { key: 'smtp_protocol', label: 'SMTP Encryption Method', type: 'select', options: ['', 'tls', 'ssl'] },
  aws_access_key_id: { key: 'aws_access_key_id', label: 'Access Key ID', type: 'text', required: true },
  aws_secret_access_key: { key: 'aws_secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
  aws_region: { key: 'aws_region', label: 'Region', type: 'text', required: true },
  sendmail_path: { key: 'sendmail_path', label: 'Sendmail path', type: 'text', required: true },
  username: { key: 'username', label: 'Username', type: 'text', required: true },
};

const SMTP_FIELDS = [F.host, F.smtp_username, F.smtp_password, F.smtp_port, F.smtp_protocol];
const AWS_FIELDS = [F.aws_access_key_id, F.aws_secret_access_key, F.aws_region];
const BLASTENGINE_SMTP_FIELDS = [F.api_key, F.host, F.smtp_username, F.smtp_password, F.smtp_port, F.smtp_protocol];

// Local (SMTP-style) types: webhook callout + bounce/feedback selects + editable delivery-domain
// identity (Add/Delete + 3 checkboxes). API types: provider verified-domains table (read-only +
// single "allow verify own domains" checkbox + "Go to <provider> dashboard").
const LOCAL = { identityKind: 'local', webhook: true, handlers: true };
const PROVIDER = (dashboard) => ({ identityKind: 'provider', webhook: false, handlers: false, dashboard });

export const SENDING_SERVER_TYPES = [
  { key: 'amazon-smtp', name: 'Amazon Web Service SMTP', desc: "Amazon's Simple Email service through SMTP protocol", icon: 'AWS', color: '#ff9900', creds: SMTP_FIELDS, ...LOCAL },
  { key: 'amazon-api', name: 'Amazon Web Service API', desc: "Amazon's Simple Email service through Web API", icon: 'AWS', color: '#ff9900', creds: AWS_FIELDS, ...PROVIDER('Amazon SES') },
  { key: 'sendgrid-smtp', name: 'SendGrid SMTP', desc: "SendGrid's Email service through SMTP protocol", icon: 'SG', color: '#1a82e2', creds: SMTP_FIELDS, ...LOCAL },
  { key: 'sendgrid-api', name: 'SendGrid API', desc: "SendGrid's Email service through Web API v3", icon: 'SG', color: '#1a82e2', creds: [F.api_key], ...PROVIDER('Sendgrid') },
  { key: 'mailgun-api', name: 'Mailgun API', desc: "Mailgun's Email service through Web API", icon: 'MG', color: '#c02126', creds: [F.api_key, F.domain], ...PROVIDER('Mailgun') },
  { key: 'mailgun-smtp', name: 'Mailgun SMTP', desc: "Mailgun's Email service through SMTP protocol", icon: 'MG', color: '#c02126', creds: SMTP_FIELDS, ...LOCAL },
  { key: 'elasticemail-api', name: 'ElasticEmail API', desc: "Elastic Email's service through Web API v2", icon: 'EE', color: '#2563eb', creds: [F.api_key], ...PROVIDER('Elastic Email') },
  { key: 'elasticemail-smtp', name: 'ElasticEmail SMTP', desc: "Elastic Email's service through SMTP protocol", icon: 'EE', color: '#2563eb', creds: SMTP_FIELDS, ...LOCAL },
  { key: 'sparkpost-api', name: 'SparkPost API', desc: "Sparkpost's Email service through Web API v1", icon: 'SP', color: '#fa6423', creds: [F.api_key], ...PROVIDER('SparkPost') },
  { key: 'sparkpost-smtp', name: 'SparkPost SMTP', desc: "Sparkpost's Email service through SMTP protocol", icon: 'SP', color: '#fa6423', creds: SMTP_FIELDS, ...LOCAL },
  { key: 'blastengine-api', name: 'BlastEngine API', desc: "BlastEngine's Email service through Web API", icon: 'BE', color: '#0b8457', creds: [F.username, F.api_key], ...PROVIDER('Blastengine'), webhook: true },
  { key: 'blastengine-smtp', name: 'BlastEngine SMTP', desc: "BlastEngine's Email service through SMTP protocol", icon: 'BE', color: '#0b8457', creds: BLASTENGINE_SMTP_FIELDS, ...PROVIDER('Blastengine') },
  { key: 'smtp', name: 'SMTP', desc: 'Standard SMTP connection to any mail server', icon: 'SMTP', color: '#f59e0b', creds: SMTP_FIELDS, ...LOCAL },
  // php-mail removed: PHP's mail() has no Node equivalent — use "SendMail (UNIX)" instead.
  { key: 'sendmail', name: 'SendMail (UNIX)', desc: "Use the hosting server's Sendmail binary", icon: 'SM', color: '#6b7280', creds: [F.sendmail_path], identityKind: 'local', webhook: false, handlers: true },
];

export const getServerType = (key) => SENDING_SERVER_TYPES.find((t) => t.key === key) || SENDING_SERVER_TYPES.find((t) => t.key === 'smtp');

// Speed-limit presets → quota_value / quota_base / quota_unit.
export const SPEED_LIMITS = [
  { label: 'Unlimited', value: 0, base: 1, unit: 'minute' },
  { label: '50 emails per 1 minute', value: 50, base: 1, unit: 'minute' },
  { label: '100 emails per 1 minute', value: 100, base: 1, unit: 'minute' },
  { label: '120 emails per 1 minute', value: 120, base: 1, unit: 'minute' },
  { label: '150 emails per 1 minute', value: 150, base: 1, unit: 'minute' },
  { label: '500 emails per 1 hour', value: 500, base: 1, unit: 'hour' },
  { label: '1000 emails per 1 hour', value: 1000, base: 1, unit: 'hour' },
  { label: '5000 emails per 1 hour', value: 5000, base: 1, unit: 'hour' },
  { label: '10000 emails per 1 day', value: 10000, base: 1, unit: 'day' },
];
export const speedLabel = (value, base, unit) => {
  const m = SPEED_LIMITS.find((s) => s.value === Number(value) && s.unit === unit);
  return m ? m.label : `${value} emails per ${base} ${unit}`;
};
