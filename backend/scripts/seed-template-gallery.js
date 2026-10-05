// Seeds the admin Template Gallery (shared templates, customer_id NULL) with a set
// of clean, self-contained, email-safe base templates. Idempotent: skips any
// template whose name already exists in the gallery. Run:
//   node scripts/seed-template-gallery.js
const { randomUUID } = require('crypto');
const prisma = require('../src/config/database.config');

const wrap = (title, inner, bg = '#f4f6fa') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
      ${inner}
      <tr><td style="padding:22px 30px;background:#0f1b2d;color:#9fb0c3;font-size:12px;line-height:1.7;text-align:center;">
        Your Brand · 123 Street · City<br/>
        <a href="{unsubscribe_url}" style="color:#7d8ea3;">Unsubscribe</a> · <a href="{{preferences_url}}" style="color:#7d8ea3;">Manage preferences</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

const hero = (bg, h, p, cta) => `<tr><td style="padding:0;">
  <div style="background:${bg};padding:48px 30px;text-align:center;">
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.25;color:#ffffff;">${h}</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#dbe4ee;">${p}</p>
    ${cta ? `<a href="#" style="display:inline-block;background:#ffffff;color:#0f1b2d;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 30px;border-radius:6px;">${cta}</a>` : ''}
  </div></td></tr>`;

const textBlock = (h, body) => `<tr><td style="padding:30px;">
  ${h ? `<h2 style="margin:0 0 12px;font-size:20px;color:#1f2733;">${h}</h2>` : ''}
  <p style="margin:0;font-size:15px;line-height:1.7;color:#3a4451;">${body}</p></td></tr>`;

const button = (label) => `<tr><td align="center" style="padding:8px 30px 34px;">
  <a href="#" style="display:inline-block;background:#1f8fb0;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 34px;border-radius:6px;">${label}</a></td></tr>`;

const TEMPLATES = [
  { category: 'Featured', name: 'Welcome email', html: wrap('Welcome',
    hero('linear-gradient(135deg,#0f1b2d,#1f8fb0)', 'Welcome aboard! 🎉', 'We\'re thrilled to have you. Here\'s how to get the most out of your new account.', 'Get started')
    + textBlock('You\'re all set', 'Explore your dashboard, set up your first project, and reach out any time — our team is here to help you succeed.')
    + button('Open my dashboard')) },

  { category: 'Featured', name: 'Product launch', html: wrap('Product launch',
    hero('#16314f', 'Introducing something new', 'A better way to do what you do — now available to everyone.', 'See what\'s new')
    + textBlock('Built for you', 'Faster, cleaner, and more powerful. We rebuilt the experience from the ground up based on your feedback.')
    + button('Explore the update')) },

  { category: 'Featured', name: 'Sale / promotion', html: wrap('Sale',
    `<tr><td style="background:#e0414b;padding:44px 30px;text-align:center;">
      <h1 style="margin:0 0 8px;font-size:34px;color:#fff;">30% OFF</h1>
      <p style="margin:0;font-size:16px;color:#ffe3e5;">Limited time only — this weekend</p></td></tr>`
    + textBlock('Don\'t miss out', 'Use code <strong>SAVE30</strong> at checkout for 30% off everything. Offer ends Sunday at midnight.')
    + button('Shop the sale')) },

  { category: 'Featured', name: 'Event invitation', html: wrap('Event',
    hero('#2d5560', 'You\'re invited', 'Join us for an evening of insights, networking, and great conversation.', 'RSVP now')
    + textBlock('Event details', '<strong>When:</strong> Friday, 7:00 PM<br/><strong>Where:</strong> The Grand Hall, City Center<br/><strong>Dress:</strong> Smart casual')
    + button('Reserve my seat')) },

  { category: 'Basic', name: 'Simple newsletter', html: wrap('Newsletter',
    `<tr><td style="padding:30px 30px 8px;"><h1 style="margin:0;font-size:24px;color:#1f2733;">This week\'s highlights</h1><p style="margin:6px 0 0;color:#8a94a3;font-size:13px;">Issue #12</p></td></tr>`
    + textBlock('Headline story', 'A short, engaging summary of your most important update this week goes right here to draw readers in.')
    + textBlock('In other news', 'A second story or update — keep it concise and link out to the full article for readers who want more.')
    + button('Read the full issue')) },

  { category: 'Basic', name: 'One-column announcement', html: wrap('Announcement',
    textBlock('An important update', 'We\'re writing to let you know about an important change to your account. Please review the details below and reach out if you have any questions.')
    + button('Learn more')) },

  { category: 'Basic', name: 'Two columns', html: wrap('Two columns',
    hero('#0f1b2d', 'Two great things', 'Highlight a pair of features or stories side by side.', '')
    + `<tr><td style="padding:30px;"><table role="presentation" width="100%"><tr>
        <td width="50%" valign="top" style="padding-right:14px;font-size:14px;line-height:1.6;color:#3a4451;">
          <h3 style="margin:0 0 8px;font-size:16px;color:#1f2733;">Column one</h3>Short supporting copy for the first column.</td>
        <td width="50%" valign="top" style="padding-left:14px;font-size:14px;line-height:1.6;color:#3a4451;">
          <h3 style="margin:0 0 8px;font-size:16px;color:#1f2733;">Column two</h3>Short supporting copy for the second column.</td>
      </tr></table></td></tr>`) },

  { category: 'Basic', name: 'Plain text', html: wrap('Plain',
    `<tr><td style="padding:34px 30px;font-size:15px;line-height:1.8;color:#2b3542;">
      Hi {{first_name}},<br/><br/>
      A simple, personal, text-style email often gets the best response. Write naturally, keep it short, and include one clear call to action.<br/><br/>
      Thanks,<br/>The Team</td></tr>`, '#ffffff') },

  { category: 'Themes', name: 'Order receipt', html: wrap('Receipt',
    `<tr><td style="padding:30px 30px 6px;"><h1 style="margin:0;font-size:22px;color:#1f2733;">Thanks for your order</h1><p style="margin:6px 0 0;color:#8a94a3;font-size:13px;">Order #10245</p></td></tr>`
    + `<tr><td style="padding:16px 30px;"><table role="presentation" width="100%" style="font-size:14px;color:#3a4451;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eef0f4;">Product A</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef0f4;">$29.00</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eef0f4;">Product B</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef0f4;">$15.00</td></tr>
        <tr><td style="padding:12px 0;font-weight:bold;">Total</td><td align="right" style="padding:12px 0;font-weight:bold;">$44.00</td></tr>
      </table></td></tr>`
    + button('View order')) },

  { category: 'Themes', name: 're-engagement', html: wrap('We miss you',
    hero('#6a3fb0', 'We miss you 👋', 'It\'s been a while — here\'s something to welcome you back.', 'Come back')
    + textBlock('A little gift', 'Enjoy 15% off your next order with code <strong>WELCOME15</strong>. We\'d love to see you again.')
    + button('Redeem my offer')) },

  { category: 'Themes', name: 'Feedback survey', html: wrap('Survey',
    hero('#1f8fb0', 'How are we doing?', 'Your feedback takes 60 seconds and helps us improve.', 'Start the survey')
    + textBlock('', 'On a scale of 1–10, how likely are you to recommend us to a friend or colleague? Tap below to let us know.')) },
];

(async () => {
  // Ensure categories exist.
  const catNames = [...new Set(TEMPLATES.map((t) => t.category))];
  const catByName = {};
  for (const name of catNames) {
    let cat = await prisma.templateCategory.findFirst({ where: { name } });
    if (!cat) cat = await prisma.templateCategory.create({ data: { uid: randomUUID(), name } });
    catByName[name] = cat.id;
  }

  let created = 0;
  let skipped = 0;
  for (const tpl of TEMPLATES) {
    const existing = await prisma.template.findFirst({ where: { customer_id: null, name: tpl.name } });
    if (existing) { skipped += 1; continue; }
    await prisma.template.create({
      data: {
        uid: randomUUID(),
        customer_id: null,
        admin_id: null,
        name: tpl.name,
        content: tpl.html,
        shared: true,
        custom_order: 0,
        categories: { connect: [{ id: catByName[tpl.category] }] },
      },
    });
    created += 1;
  }

  console.log(`Template gallery seeded: ${created} created, ${skipped} already existed.`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
