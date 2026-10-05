// Helpers for the GrapesJS-based form builder. Forms are stored in ListForm.content
// as an HTML string (new) or the legacy structured object. These convert/seed HTML.

export const isHtmlContent = (content) => typeof content === 'string' && content.trim().length > 0;

const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// A field block as email-safe, functional HTML. Inputs are named by their tag so
// the public page can collect and submit them.
const fieldHtml = (tag, label, required, type = 'text') => `
  <div class="sq-form-field" style="margin-bottom:14px;">
    <label style="display:block;font-size:13px;margin-bottom:4px;">${esc(label)}${required ? ' *' : ''}</label>
    <input name="${esc(tag)}" type="${type}"${required ? ' required' : ''}
      style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #bfbfbf;box-sizing:border-box;" />
  </div>`;

// Default subscribe form used to seed a brand-new form.
export const defaultFormHtml = () => `
<form class="sq-form" style="max-width:480px;margin:0 auto;background:#ffffff;color:#1a1a1a;padding:28px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
  <h3 style="margin:0 0 8px;font-size:22px;">Subscribe to our newsletter</h3>
  <p style="margin:0 0 16px;font-size:14px;opacity:.8;">Get the latest updates straight to your inbox.</p>
  ${fieldHtml('EMAIL', 'Email Address', true, 'email')}
  <button type="submit" style="width:100%;padding:12px;border:none;border-radius:6px;cursor:pointer;background:#00698f;color:#ffffff;font-size:15px;font-weight:600;">Sign Up</button>
  <p style="margin:14px 0 0;text-align:center;font-size:11px;color:#999;">Powered by SendQ</p>
</form>`;

// Convert a legacy structured form blob into HTML so old forms open in the builder.
export const structuredToHtml = (content) => {
  const theme = content.theme || {};
  const fields = (content.fields || []).filter((f) => f.enabled);
  const fieldsHtml = fields.map((f) => fieldHtml(f.tag, f.label, f.required, f.tag === 'EMAIL' ? 'email' : 'text')).join('');
  return `
<form class="sq-form" style="max-width:480px;margin:0 auto;background:${theme.background || '#fff'};color:${theme.text || '#1a1a1a'};padding:28px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
  ${content.title ? `<h3 style="margin:0 0 8px;font-size:22px;">${esc(content.title)}</h3>` : ''}
  ${content.description ? `<p style="margin:0 0 16px;font-size:14px;opacity:.8;">${esc(content.description)}</p>` : ''}
  ${fieldsHtml}
  <button type="submit" style="width:100%;padding:12px;border:none;border-radius:6px;cursor:pointer;background:${theme.button || '#00698f'};color:${theme.buttonText || '#fff'};font-size:15px;font-weight:600;">${esc(content.submitText || 'Sign Up')}</button>
</form>`;
};

// Resolve whatever is stored into builder-ready HTML.
export const toBuilderHtml = (content) => {
  if (isHtmlContent(content)) return content;
  if (content && typeof content === 'object') return structuredToHtml(content);
  return defaultFormHtml();
};
