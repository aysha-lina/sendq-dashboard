// Base templates for the "New template" gallery (mirrors the PHP "Basic" group).
// Each `content` is email-safe HTML loaded into the GrapesJS builder as a starting point.

const wrap = (inner) => `
<table align="center" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#333333;" cellpadding="0" cellspacing="0">
  <tr><td style="padding:24px;">${inner}</td></tr>
</table>`;

const heading = '<h1 style="margin:0 0 12px;font-size:24px;color:#222222;">Your headline here</h1>';
const para = '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#555555;">Replace this with your own content. Drag widgets from the right panel to build your email.</p>';
const button = '<table cellpadding="0" cellspacing="0"><tr><td style="background:#00698f;border-radius:4px;"><a href="#" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;">Call to action</a></td></tr></table>';

const col = (content) => `<td valign="top" style="padding:8px;font-size:14px;line-height:1.6;color:#555555;">${content}</td>`;

export const BASE_TEMPLATES = [
  {
    key: 'blank',
    label: 'Blank',
    content: wrap('<p style="margin:0;color:#999999;font-size:14px;">Start from scratch — drag widgets here.</p>'),
  },
  {
    key: 'pricing',
    label: 'Pricing Table',
    content: wrap(`${heading}${para}
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${col('<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;text-align:center;"><h3 style="margin:0 0 8px;">Starter</h3><p style="font-size:28px;margin:0 0 8px;color:#00698f;">$9</p>' + button + '</div>')}
        ${col('<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;text-align:center;"><h3 style="margin:0 0 8px;">Pro</h3><p style="font-size:28px;margin:0 0 8px;color:#00698f;">$29</p>' + button + '</div>')}
        ${col('<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;text-align:center;"><h3 style="margin:0 0 8px;">Business</h3><p style="font-size:28px;margin:0 0 8px;color:#00698f;">$99</p>' + button + '</div>')}
      </tr></table>`),
  },
  {
    key: 'lists',
    label: 'Lists & Tables',
    content: wrap(`${heading}${para}
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr style="background:#f4f6f9;"><th align="left" style="border:1px solid #e5e7eb;">Item</th><th align="left" style="border:1px solid #e5e7eb;">Detail</th></tr>
        <tr><td style="border:1px solid #e5e7eb;">Row one</td><td style="border:1px solid #e5e7eb;">Description</td></tr>
        <tr><td style="border:1px solid #e5e7eb;">Row two</td><td style="border:1px solid #e5e7eb;">Description</td></tr>
        <tr><td style="border:1px solid #e5e7eb;">Row three</td><td style="border:1px solid #e5e7eb;">Description</td></tr>
      </table>`),
  },
  {
    key: 'one-col',
    label: 'One column layout',
    content: wrap(`${heading}${para}${button}`),
  },
  {
    key: 'two-col',
    label: '1-2 column layout',
    content: wrap(`${heading}
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${col(para)}
        ${col(para)}
      </tr></table>`),
  },
  {
    key: 'one-two-one-col',
    label: '1-2-1 column layout',
    content: wrap(`${heading}${para}
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${col(para)}
        ${col(para)}
      </tr></table>
      <div style="margin-top:8px;">${button}</div>`),
  },
];

export const getBaseContent = (key) =>
  (BASE_TEMPLATES.find((t) => t.key === key) || BASE_TEMPLATES[0]).content;
