// Seed the Custom Emails & Pages templates with the exact content (in order),
// each opening in the GrapesJS editor. Run:
//   node scripts/reseed-custom-templates.js
const prisma = require('../src/config/database.config');
const { randomUUID } = require('crypto');

const PAGE = (title, body) => `<div style="background:#2b4a52;padding:54px 20px;font-family:Poppins,Arial,sans-serif">
  <div style="text-align:center;margin-bottom:26px"><img src="/assets/3.png" alt="SendQ" style="height:46px"/></div>
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:8px;padding:34px 38px;color:#1f2937">
    <h2 style="margin:0 0 18px;font-weight:600">${title}</h2>
    <hr style="border:0;border-top:1px solid #eee;margin:0 0 18px"/>
    ${body}
  </div>
  <div style="text-align:center;color:#cdd6da;margin-top:28px;font-size:13px">Copyright © 2025. All rights reserved.</div>
</div>`;

const EMAIL = (body, footer = '© 2026. SendQ - Powered by Tamimah Digital') =>
  `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;padding:8px 4px">${body}
   <p style="color:#6b7280;margin-top:28px">${footer}</p></div>`;

const LOGO = `<img src="/assets/3.png" alt="SendQ" style="height:40px;margin-bottom:22px"/>`;
const BTN = (label, color = '#9cc6b6') => `<a href="#" style="display:inline-block;background:${color};color:#1f2937;padding:9px 18px;border-radius:5px;text-decoration:none">${label}</a>`;

const T = [
  ['Final "Welcome" email', 'Sign-up', 'email', 'Welcome aboard',
    EMAIL(`<h2>Hello {CUSTOMER_NAME}, welcome aboard</h2><p>Your account has been created successfully. We're glad to have you on board.</p>`)],
  ['Registration confirmation email', 'Subscription', 'email', 'Registration confirmation',
    EMAIL(`<h2>Hello {CUSTOMER_NAME}, welcome aboard</h2><h3>Please Confirm Registration</h3><hr/><p>Click the link below to activate your account:</p><p><a href="{ACTIVATION_URL}">{ACTIVATION_URL}</a></p>`)],
  ['Update profile email sent', 'Update profile', 'page', 'Update profile',
    PAGE('Email sent', `<p>For security, we've sent an email to your inbox that contains a link to update your preferences.</p>`)],
  ['Update profile success page', 'Update profile', 'page', 'Update profile',
    PAGE('Profile Updated', `<p>Your profile information has been updated. For your records, here is a copy of the information you submitted to us...</p><p>{SUBSCRIBER_SUMMARY}</p>`)],
  ['Update profile form', 'Update profile', 'page', 'Update profile',
    PAGE('Update your preferences', `<p>{FIELDS}</p><p>{UPDATE_PROFILE_BUTTON} or ${BTN('Unsubscribe')}</p>`)],
  ['Update profile email', 'Update profile', 'email', 'Update profile',
    EMAIL(`${LOGO}<p>We received a request to change your subscription preferences for our list.</p><p>If you made this request, and would like to change your preferences, use the link below</p><p><a href="#">Update your preferences</a></p><p>If you did not make this request, it was probably submitted by someone else by mistake. You can ignore this email, and no changes will be made to your subscription preferences.</p>`, 'Copyright © 2026. All rights reserved.')],
  ['Unsubscribe "Goodbye" email', 'Unsubscribe', 'email', 'Unsubscribed',
    EMAIL(`${LOGO}<h3>We have removed your email address from our list.</h3><hr/><p>We're sorry to see you go.</p><p>Was this a mistake? Did you forward one of our emails to a friend, and they clicked the unsubscribe link not realizing they were in fact unsubscribing you from this list? If this was a mistake, you can re-subscribe at:</p><p><a href="#">Subscribe</a></p>`, 'Copyright © 2025. All rights reserved.')],
  ['Unsubscribe confirmation page', 'Unsubscribe', 'page', 'Unsubscribed',
    PAGE('Unsubscribe Successful', `<p>You have been removed from SendQ mail database.</p>`)],
  ['Unsubscribe page', 'Unsubscribe', 'page', 'Unsubscribe',
    PAGE('Unsubscribe', `<p>You are going to opt out of mail database of SendQ, please click the button below to confirm. Really sorry to let you go!</p><p>{UNSUBSCRIBE_BUTTON}</p>`)],
  ['Subscription confirmed page', 'Subscription', 'page', 'Thank you',
    PAGE('Subscription Confirmed', `<p>Your subscription to our list has been confirmed.</p><p>Thank you for subscribing!</p><p>${BTN('Manage your preferences')}</p>`)],
  ['Almost finished page', 'Subscription', 'page', 'Thank you',
    PAGE('Almost finished...', `<p>We need to confirm your email address.</p><p>To complete the subscription process, please click the link in the email we just sent you.</p>`)],
  ['Sign up page', 'Sign-up', 'page', 'Sign up',
    PAGE('Welcome to SendQ', `<p>{FIELDS}</p><p>{SUBSCRIBE_BUTTON}</p>`)],
  ['Verify sender identity email', 'Verification', 'email', 'Verify your sender identity',
    EMAIL(`<h1>Identify Verification</h1><p>Dear {USER_NAME}</p><p>Thank you for registering your email ({USER_EMAIL}) with us. Please click the link below to verify your email address against our service. If you do not request this verification, please just ignore this email</p><p>{VERIFICATION_LINK}</p>`, '')],
  ['Subscription notification email', 'Notification', 'email', 'Subscription Notification',
    EMAIL(`<h1>Subscription notification</h1><p>Dear List Owner</p><p>User <b>{EMAIL}</b> has recently subscribed to your mail list <b>{LIST_NAME}</b></p>`, '')],
  ['Unsubscribe notification email', 'Notification', 'email', 'Unsubscribe notification',
    EMAIL(`<h1>Unsubscribe notification</h1><p>Dear List Owner</p><p>User <b>{EMAIL}</b> has unsubscribed from your mail list <b>{LIST_NAME}</b></p>`, '')],
];

(async () => {
  // add subject column if missing
  const has = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sendq_custom_templates' AND column_name='subject'`);
  if (Number(has[0].c) === 0) {
    await prisma.$executeRawUnsafe('ALTER TABLE sendq_custom_templates ADD COLUMN subject VARCHAR(255) NULL AFTER type');
    console.log('Added subject column.');
  }
  await prisma.$executeRawUnsafe('DELETE FROM sendq_custom_templates');
  for (const [name, group, type, subject, content] of T) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO sendq_custom_templates (uid, name, group_label, type, subject, content, custom_page_count, created_at, updated_at) VALUES (?,?,?,?,?,?,0,NOW(3),NOW(3))',
      randomUUID(), name, group, type, subject, content);
  }
  console.log(`Reseeded ${T.length} custom email/page templates.`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
