// Parse raw bounce / feedback-loop emails into suppression events (BUG-6).
// Works off the raw RFC822 source (robust across MTAs) rather than MIME structure:
//   - DSN  (RFC 3464): Final-Recipient / Status: 5.x.x (hard) | 4.x.x (soft)
//   - ARF  (RFC 5965): Feedback-Type + Original-Rcpt-To  (complaints)
//   - Heuristic fallback: X-Failed-Recipients header

const extractEmail = (s) => {
  const m = String(s || '').match(/<?([^\s<>"]+@[^\s<>",;]+)>?/);
  return m ? m[1].toLowerCase().replace(/[.,;>]+$/, '') : null;
};

const FINAL_RECIPIENT = /Final-Recipient:\s*[^;]*;\s*(.+)/i;
const ORIGINAL_RECIPIENT = /Original-Recipient:\s*[^;]*;\s*(.+)/i;
const X_FAILED = /X-Failed-Recipients:\s*(.+)/i;
const STATUS = /Status:\s*([245])\.\d+\.\d+/i;
const DIAGNOSTIC = /Diagnostic-Code:\s*(.+)/i;
const ARF_RCPT = /Original-Rcpt-To:\s*(.+)/i;
const FEEDBACK_TYPE = /Feedback-Type:\s*(\S+)/i;

// ARF complaint? Returns { kind:'complaint', email, type } or null.
const parseComplaint = (raw) => {
  const text = String(raw || '');
  if (!/feedback-report/i.test(text) && !FEEDBACK_TYPE.test(text)) return null;
  const rcpt = text.match(ARF_RCPT) || text.match(ORIGINAL_RECIPIENT) || text.match(FINAL_RECIPIENT);
  const email = rcpt ? extractEmail(rcpt[1]) : null;
  if (!email) return null;
  const ft = text.match(FEEDBACK_TYPE);
  return { kind: 'complaint', email, type: (ft ? ft[1] : 'abuse').toLowerCase() };
};

// DSN / generic bounce? Returns { kind:'bounce', email, hard, reason } or null.
const parseBounce = (raw) => {
  const text = String(raw || '');
  const fr = text.match(FINAL_RECIPIENT) || text.match(ORIGINAL_RECIPIENT) || text.match(X_FAILED);
  const email = fr ? extractEmail(fr[1]) : null;
  if (!email) return null;
  const status = text.match(STATUS);
  const code = status ? status[1] : null;
  const hard = code ? code === '5' : true; // unknown class → treat as hard (conservative suppression)
  const diag = text.match(DIAGNOSTIC);
  const reason = [code ? `${code}.x.x` : null, diag ? diag[1].trim().slice(0, 200) : null]
    .filter(Boolean).join(' ') || 'Bounce';
  return { kind: 'bounce', email, hard, reason };
};

// Classify a full raw message. Complaints (ARF) take priority over bounces.
const parseDeliveryEvent = (raw) => {
  const complaint = parseComplaint(raw);
  if (complaint) return complaint;
  const text = String(raw || '');
  if (/delivery-status|Final-Recipient|Original-Recipient|X-Failed-Recipients|Status:\s*[45]\.\d/i.test(text)) {
    return parseBounce(raw);
  }
  return null;
};

module.exports = { parseDeliveryEvent, parseBounce, parseComplaint, extractEmail };
