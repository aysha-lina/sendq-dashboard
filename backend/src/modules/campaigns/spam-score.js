// Heuristic spam-score checker (no external service). Returns a 0–100 score
// (higher = better/cleaner) plus a list of issues, similar to the original's
// pre-send spam check. Deliberately conservative and explainable.

const SPAMMY_WORDS = [
  'free', 'guarantee', 'guaranteed', 'winner', 'win', 'cash', 'prize', 'urgent',
  'act now', 'limited time', 'click here', 'buy now', 'order now', 'risk-free',
  '100%', 'cheap', 'congratulations', 'no cost', 'double your', 'extra income',
  'earn money', 'make money', 'lowest price', 'viagra', 'casino', 'lottery',
];

const stripTags = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const analyzeSpam = ({ subject = '', html = '', plain = '' } = {}) => {
  const issues = [];
  let penalty = 0;

  const text = plain || stripTags(html);
  const haystack = `${subject} ${text}`.toLowerCase();

  // Spammy trigger words
  const hits = SPAMMY_WORDS.filter((w) => haystack.includes(w));
  if (hits.length) {
    penalty += Math.min(hits.length * 5, 30);
    issues.push({ level: hits.length > 3 ? 'high' : 'medium', message: `Contains spam-trigger words: ${hits.slice(0, 6).join(', ')}${hits.length > 6 ? '…' : ''}.` });
  }

  // Subject checks
  if (!subject.trim()) {
    penalty += 20; issues.push({ level: 'high', message: 'Subject line is empty.' });
  } else {
    const letters = subject.replace(/[^a-z]/gi, '');
    const caps = subject.replace(/[^A-Z]/g, '');
    if (letters.length > 6 && caps.length / letters.length > 0.6) {
      penalty += 12; issues.push({ level: 'medium', message: 'Subject is mostly uppercase (shouting).' });
    }
    if ((subject.match(/!/g) || []).length >= 2) {
      penalty += 8; issues.push({ level: 'medium', message: 'Subject has multiple exclamation marks.' });
    }
    if (subject.length > 90) {
      penalty += 5; issues.push({ level: 'low', message: 'Subject is very long (>90 chars).' });
    }
  }

  // Body checks
  if (!text || text.length < 20) {
    penalty += 15; issues.push({ level: 'high', message: 'Email body has very little text content.' });
  }

  const imgCount = (html.match(/<img/gi) || []).length;
  if (imgCount > 0 && text.length < 200) {
    penalty += 12; issues.push({ level: 'medium', message: 'High image-to-text ratio — add more text.' });
  }

  if (!/\{\{\s*unsubscribe_url\s*\}\}/.test(html) && !/unsubscribe/i.test(html)) {
    penalty += 15; issues.push({ level: 'high', message: 'No unsubscribe link found (required for compliance).' });
  }

  const linkCount = (html.match(/<a\s/gi) || []).length;
  if (linkCount > 20) {
    penalty += 8; issues.push({ level: 'low', message: `Large number of links (${linkCount}).` });
  }

  if (/https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(html)) {
    penalty += 15; issues.push({ level: 'high', message: 'Links using raw IP addresses look suspicious.' });
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const rating = score >= 80 ? 'good' : score >= 55 ? 'fair' : 'poor';
  if (!issues.length) issues.push({ level: 'low', message: 'No common spam signals detected.' });

  return { score, rating, issues };
};

module.exports = { analyzeSpam };
