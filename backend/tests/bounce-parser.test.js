const { test } = require('node:test');
const assert = require('node:assert');
const { parseDeliveryEvent, parseBounce, parseComplaint, extractEmail } = require('../src/modules/webhooks/bounce-parser');

const DSN_HARD = `Content-Type: multipart/report; report-type=delivery-status; boundary="b"

--b
Content-Type: message/delivery-status

Reporting-MTA: dns; mail.example.com
Final-Recipient: rfc822; bounced@example.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550 5.1.1 <bounced@example.com> User unknown
--b--`;

const DSN_SOFT = `Content-Type: message/delivery-status

Final-Recipient: rfc822; full@example.com
Action: delayed
Status: 4.2.2
Diagnostic-Code: smtp; 452 Mailbox full`;

const ARF = `Content-Type: multipart/report; report-type=feedback-report; boundary="b"

--b
Content-Type: message/feedback-report

Feedback-Type: abuse
User-Agent: SomeFBL/1.0
Version: 1
Original-Rcpt-To: complainer@example.com
--b--`;

const X_FAILED = `Subject: Delivery failure
X-Failed-Recipients: failed@example.com
To: postmaster@x.com

The following message could not be delivered.`;

const NORMAL = `Subject: Hello
From: friend@example.com

Just saying hi, not a bounce.`;

test('DSN hard bounce → bounce, hard, correct recipient (BUG-6)', () => {
  const ev = parseDeliveryEvent(DSN_HARD);
  assert.strictEqual(ev.kind, 'bounce');
  assert.strictEqual(ev.email, 'bounced@example.com');
  assert.strictEqual(ev.hard, true);
});

test('DSN soft bounce (4.x.x) → bounce, NOT hard', () => {
  const ev = parseDeliveryEvent(DSN_SOFT);
  assert.strictEqual(ev.kind, 'bounce');
  assert.strictEqual(ev.email, 'full@example.com');
  assert.strictEqual(ev.hard, false);
});

test('ARF feedback report → complaint (takes priority over bounce)', () => {
  const ev = parseDeliveryEvent(ARF);
  assert.strictEqual(ev.kind, 'complaint');
  assert.strictEqual(ev.email, 'complainer@example.com');
  assert.strictEqual(ev.type, 'abuse');
});

test('X-Failed-Recipients heuristic fallback', () => {
  const ev = parseDeliveryEvent(X_FAILED);
  assert.strictEqual(ev.kind, 'bounce');
  assert.strictEqual(ev.email, 'failed@example.com');
});

test('normal email → null (not a bounce/complaint)', () => {
  assert.strictEqual(parseDeliveryEvent(NORMAL), null);
  assert.strictEqual(parseDeliveryEvent(''), null);
});

test('extractEmail normalizes brackets/case/trailing punctuation', () => {
  assert.strictEqual(extractEmail('<User@Example.com>;'), 'user@example.com');
  assert.strictEqual(extractEmail('rfc822; a@b.com'), 'a@b.com');
  assert.strictEqual(extractEmail('no email here'), null);
});

test('parseBounce/parseComplaint are independently addressable', () => {
  assert.strictEqual(parseBounce(DSN_HARD).hard, true);
  assert.strictEqual(parseComplaint(ARF).type, 'abuse');
  assert.strictEqual(parseComplaint(DSN_HARD), null); // a bounce is not a complaint
});
