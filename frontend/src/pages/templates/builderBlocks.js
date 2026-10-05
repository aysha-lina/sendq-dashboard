// Prebuilt "section" blocks for the PRO builder. These are the ready-made,
// drag-in chunks that make the editor feel like a modern page builder.
//
// Two sets are provided:
//   - email: table-based, inline-styled HTML that survives Gmail/Outlook.
//   - page:  flex/div-based modern HTML for landing / web pages.
//
// registerSections(editor, mode) clears any previously-added custom sections
// and adds the set for the active mode under a "Sections" category.

const ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6">
  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/></svg>`;

const ACCENT = '#1f8fb0';

// ─── Email-safe sections (tables + inline styles) ─────────────────────────────
const EMAIL_SECTIONS = [
  {
    id: 'sec-email-header',
    label: 'Header',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td style="padding:24px 30px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:22px;font-weight:bold;color:#1f2733;">Your Brand</td>
      <td align="right" style="font-size:14px;color:#5b6675;">Home &nbsp; Products &nbsp; Contact</td>
    </tr></table>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-hero',
    label: 'Hero',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1b2d;">
  <tr><td align="center" style="padding:54px 30px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="margin:0 0 14px;font-size:30px;line-height:1.25;color:#ffffff;">Build something great</h1>
    <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#c7d0db;">A clear, compelling sentence that tells readers exactly what you offer.</p>
    <a href="#" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 30px;border-radius:6px;">Get started</a>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-image',
    label: 'Image (full width)',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:20px 30px;">
    <img src="https://via.placeholder.com/560x280?text=Click+to+set+image" width="100%" style="display:block;max-width:560px;border-radius:6px;" alt=""/>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-article',
    label: 'Image + text',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td style="padding:30px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="45%" valign="top" style="padding-right:20px;">
        <img src="https://via.placeholder.com/260x180?text=Image" width="100%" style="display:block;border-radius:6px;" alt=""/>
      </td>
      <td valign="top" style="font-size:15px;line-height:1.6;color:#3a4451;">
        <h2 style="margin:0 0 10px;font-size:20px;color:#1f2733;">Section title</h2>
        Write a short paragraph here describing the feature or story you want to highlight to your readers.
      </td>
    </tr></table>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-cols',
    label: 'Two columns',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td style="padding:30px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" valign="top" style="padding-right:14px;font-size:15px;line-height:1.6;color:#3a4451;">
        <h3 style="margin:0 0 8px;font-size:17px;color:#1f2733;">Column one</h3>
        Short supporting copy for the first column goes right here.
      </td>
      <td width="50%" valign="top" style="padding-left:14px;font-size:15px;line-height:1.6;color:#3a4451;">
        <h3 style="margin:0 0 8px;font-size:17px;color:#1f2733;">Column two</h3>
        Short supporting copy for the second column goes right here.
      </td>
    </tr></table>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-cta',
    label: 'Call to action',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;">
  <tr><td align="center" style="padding:40px 30px;font-family:Arial,Helvetica,sans-serif;">
    <h2 style="margin:0 0 18px;font-size:22px;color:#1f2733;">Ready to get started?</h2>
    <a href="#" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 34px;border-radius:6px;">Sign up now</a>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-threecols',
    label: 'Three columns',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td style="padding:30px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${[1, 2, 3].map((i) => `
      <td width="33%" valign="top" style="padding:0 8px;text-align:center;font-size:14px;line-height:1.6;color:#3a4451;">
        <img src="https://via.placeholder.com/80?text=${i}" width="64" style="display:block;margin:0 auto 10px;border-radius:8px;" alt=""/>
        <h4 style="margin:0 0 6px;font-size:15px;color:#1f2733;">Item ${i}</h4>
        Brief supporting text for this item.
      </td>`).join('')}
    </tr></table>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-divider',
    label: 'Divider + spacer',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td style="padding:14px 30px;"><div style="height:1px;line-height:1px;background:#e3e7ee;font-size:0;">&nbsp;</div></td></tr>
  <tr><td style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>
</table>`,
  },
  {
    id: 'sec-email-testimonial',
    label: 'Testimonial',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;">
  <tr><td align="center" style="padding:44px 40px;font-family:Arial,Helvetica,sans-serif;">
    <p style="margin:0 0 16px;font-size:19px;line-height:1.5;color:#1f2733;font-style:italic;">&ldquo;This product completely changed how our team works. Highly recommended.&rdquo;</p>
    <div style="font-size:14px;color:#5b6675;">— Jordan Smith, Acme Inc.</div>
  </td></tr>
</table>`,
  },
  {
    id: 'sec-email-footer',
    label: 'Footer',
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1b2d;">
  <tr><td align="center" style="padding:30px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#9fb0c3;">
    <div style="margin-bottom:8px;">Your Brand · 123 Street · City</div>
    <div><a href="#" style="color:#9fb0c3;">Facebook</a> &nbsp; <a href="#" style="color:#9fb0c3;">Twitter</a> &nbsp; <a href="#" style="color:#9fb0c3;">Instagram</a></div>
    <div style="margin-top:10px;"><a href="{unsubscribe_url}" style="color:#6f8298;">Unsubscribe</a></div>
  </td></tr>
</table>`,
  },
];

// ─── Web / landing-page sections (modern flex + div) ──────────────────────────
const PAGE_SECTIONS = [
  {
    id: 'sec-page-navbar',
    label: 'Navbar',
    content: `
<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 40px;background:#ffffff;border-bottom:1px solid #e6e8ef;font-family:Arial,Helvetica,sans-serif;">
  <div style="font-size:20px;font-weight:700;color:#1f2733;">Your Brand</div>
  <div style="display:flex;gap:26px;font-size:15px;color:#5b6675;">
    <a href="#" style="color:#5b6675;text-decoration:none;">Features</a>
    <a href="#" style="color:#5b6675;text-decoration:none;">Pricing</a>
    <a href="#" style="color:#5b6675;text-decoration:none;">About</a>
  </div>
</div>`,
  },
  {
    id: 'sec-page-hero',
    label: 'Hero',
    content: `
<div style="text-align:center;padding:90px 40px;background:linear-gradient(135deg,#0f1b2d,#16314f);font-family:Arial,Helvetica,sans-serif;">
  <h1 style="margin:0 0 16px;font-size:44px;line-height:1.15;color:#ffffff;">A headline that sells</h1>
  <p style="margin:0 auto 30px;max-width:560px;font-size:18px;line-height:1.6;color:#c7d0db;">Explain your product's value in one or two clear, confident sentences.</p>
  <a href="#" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 38px;border-radius:8px;">Get started free</a>
</div>`,
  },
  {
    id: 'sec-page-image',
    label: 'Image (full width)',
    content: `
<div style="padding:30px 40px;background:#ffffff;text-align:center;">
  <img src="https://via.placeholder.com/900x400?text=Click+to+set+image" style="display:block;max-width:100%;margin:0 auto;border-radius:10px;" alt=""/>
</div>`,
  },
  {
    id: 'sec-page-features',
    label: 'Feature grid',
    content: `
<div style="padding:70px 40px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:flex;gap:28px;flex-wrap:wrap;justify-content:center;">
    ${[1, 2, 3].map(() => `
    <div style="flex:1;min-width:220px;max-width:320px;text-align:center;padding:24px;border:1px solid #eef0f4;border-radius:12px;">
      <div style="width:52px;height:52px;margin:0 auto 16px;border-radius:12px;background:#e8f4f8;"></div>
      <h3 style="margin:0 0 10px;font-size:19px;color:#1f2733;">Feature title</h3>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#5b6675;">A concise description of this feature and why it matters.</p>
    </div>`).join('')}
  </div>
</div>`,
  },
  {
    id: 'sec-page-cta',
    label: 'CTA banner',
    content: `
<div style="text-align:center;padding:60px 40px;background:#0f1b2d;font-family:Arial,Helvetica,sans-serif;">
  <h2 style="margin:0 0 20px;font-size:30px;color:#ffffff;">Start building today</h2>
  <a href="#" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 40px;border-radius:8px;">Create your account</a>
</div>`,
  },
  {
    id: 'sec-page-pricing',
    label: 'Pricing',
    content: `
<div style="padding:70px 40px;background:#f7f8fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;">
    ${['Starter|0', 'Pro|29', 'Business|99'].map((p) => {
      const [tier, price] = p.split('|');
      return `
    <div style="flex:1;min-width:240px;max-width:320px;background:#ffffff;border:1px solid #e6e8ef;border-radius:14px;padding:30px;text-align:center;">
      <h3 style="margin:0 0 6px;font-size:18px;color:#1f2733;">${tier}</h3>
      <div style="font-size:40px;font-weight:700;color:#1f2733;margin:10px 0;">$${price}<span style="font-size:15px;font-weight:400;color:#8a94a3;">/mo</span></div>
      <a href="#" style="display:inline-block;margin-top:14px;background:${ACCENT};color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 26px;border-radius:7px;">Choose</a>
    </div>`;
    }).join('')}
  </div>
</div>`,
  },
  {
    id: 'sec-page-stats',
    label: 'Stats',
    content: `
<div style="padding:60px 40px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;text-align:center;">
    ${['10k+|Customers', '99.9%|Uptime', '24/7|Support', '4.9★|Rating'].map((s) => {
      const [num, lbl] = s.split('|');
      return `
    <div style="flex:1;min-width:150px;">
      <div style="font-size:38px;font-weight:700;color:#1f2733;">${num}</div>
      <div style="font-size:14px;color:#8a94a3;margin-top:4px;">${lbl}</div>
    </div>`;
    }).join('')}
  </div>
</div>`,
  },
  {
    id: 'sec-page-testimonial',
    label: 'Testimonial',
    content: `
<div style="padding:70px 40px;background:#f7f8fb;text-align:center;font-family:Arial,Helvetica,sans-serif;">
  <p style="margin:0 auto 18px;max-width:680px;font-size:24px;line-height:1.45;color:#1f2733;font-style:italic;">&ldquo;The smoothest builder we've used — our team ships campaigns twice as fast now.&rdquo;</p>
  <div style="font-size:15px;color:#5b6675;">— Jordan Smith, Head of Marketing at Acme</div>
</div>`,
  },
  {
    id: 'sec-page-faq',
    label: 'FAQ',
    content: `
<div style="padding:70px 40px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;">
  <h2 style="margin:0 0 26px;font-size:28px;color:#1f2733;text-align:center;">Frequently asked questions</h2>
  ${['Is there a free plan?', 'Can I cancel anytime?', 'Do you offer support?'].map((q) => `
  <div style="border-bottom:1px solid #eef0f4;padding:18px 0;">
    <h4 style="margin:0 0 6px;font-size:17px;color:#1f2733;">${q}</h4>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#5b6675;">A clear, reassuring answer to this common question goes here.</p>
  </div>`).join('')}
</div>`,
  },
  {
    id: 'sec-page-footer',
    label: 'Footer',
    content: `
<div style="padding:40px;background:#0f1b2d;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#9fb0c3;font-size:14px;line-height:1.8;">
  <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:8px;">Your Brand</div>
  <div><a href="#" style="color:#9fb0c3;text-decoration:none;">Privacy</a> · <a href="#" style="color:#9fb0c3;text-decoration:none;">Terms</a> · <a href="#" style="color:#9fb0c3;text-decoration:none;">Contact</a></div>
  <div style="margin-top:10px;color:#6f8298;">© Your Brand. All rights reserved.</div>
</div>`,
  },
];

export const registerSections = (editor, mode) => {
  const bm = editor.BlockManager;
  const sections = mode === 'page' ? PAGE_SECTIONS : EMAIL_SECTIONS;

  // Remove any sections from a previous mode so the panel stays clean.
  [...EMAIL_SECTIONS, ...PAGE_SECTIONS].forEach((s) => {
    if (bm.get(s.id)) bm.remove(s.id);
  });

  sections.forEach((s) => {
    bm.add(s.id, {
      label: `<div class="tb-sec-icon">${ICON}</div><div class="tb-sec-label">${s.label}</div>`,
      category: 'Sections',
      content: s.content,
      attributes: { class: 'tb-sec-block' },
    });
  });
};

export default registerSections;
