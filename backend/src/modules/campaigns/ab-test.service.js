// Pure A/B-test helpers (no I/O) so the split + winner logic is unit-testable.
//
// An A/B campaign sends 2+ subject/content VARIANTS to a small TEST COHORT (a % of the
// audience, split evenly across variants), waits, then sends the winning variant — the one
// with the best open/click rate among its test recipients — to the remaining HOLDOUT.

const VARIANT_KEYS = ['A', 'B', 'C', 'D'];

// Validate + normalise a raw ab_test config (from the wizard) into a stored shape.
// Returns null when A/B is not enabled or there are fewer than 2 usable variants.
const normalizeAbConfig = (raw) => {
  if (!raw || raw.enabled === false) return null;
  const variants = (Array.isArray(raw.variants) ? raw.variants : [])
    .map((v, i) => ({
      key: v.key || VARIANT_KEYS[i] || `V${i + 1}`,
      subject: String(v.subject || '').trim(),
      from_name: v.from_name ? String(v.from_name).trim() : undefined,
      html: v.html != null ? String(v.html) : undefined,
    }))
    .filter((v) => v.subject); // a variant must at least vary the subject
  if (variants.length < 2) return null;

  const testPercent = Math.min(90, Math.max(5, Number(raw.test_percent) || 30));
  const winnerMetric = raw.winner_metric === 'clicks' ? 'clicks' : 'opens';
  const winnerWaitHours = Math.min(168, Math.max(0, Number(raw.winner_wait_hours) || 4));
  return {
    enabled: true,
    variants,
    test_percent: testPercent,
    winner_metric: winnerMetric,
    winner_wait_hours: winnerWaitHours,
    // optional fast-path used by tests; ignored by the UI
    ...(raw.winner_wait_ms != null ? { winner_wait_ms: Number(raw.winner_wait_ms) } : {}),
  };
};

// Delay (ms) before the winner is chosen + sent.
const winnerDelayMs = (cfg) => (cfg.winner_wait_ms != null
  ? Math.max(0, Number(cfg.winner_wait_ms))
  : Math.round((Number(cfg.winner_wait_hours) || 0) * 3600 * 1000));

// Split recipient ids into per-variant test cohorts + a holdout, deterministically
// (by input order). testPercent of the audience is tested, evenly across variants.
const splitRecipients = (ids, { testPercent, variantKeys }) => {
  const list = Array.isArray(ids) ? ids.slice() : [];
  const keys = variantKeys.slice();
  const n = list.length;
  // at least one per variant when the audience is big enough; never exceed n
  let testTotal = Math.floor((n * testPercent) / 100);
  testTotal = Math.max(testTotal, Math.min(n, keys.length));
  testTotal = Math.min(testTotal, n);

  const cohorts = Object.fromEntries(keys.map((k) => [k, []]));
  for (let i = 0; i < testTotal; i += 1) cohorts[keys[i % keys.length]].push(list[i]);
  const holdout = list.slice(testTotal);
  return { cohorts, holdout, testTotal };
};

// Pick the winning variant key from per-variant stats. rate = metric / max(sent,1);
// ties break on raw metric count, then variant key order.
const pickWinner = (stats, metric) => {
  const m = metric === 'clicks' ? 'clicks' : 'opens';
  let best = null;
  for (const [key, s] of Object.entries(stats)) {
    const sent = Math.max(1, Number(s.sent) || 0);
    const count = Number(s[m]) || 0;
    const rate = count / sent;
    const cand = { key, rate, count };
    if (!best
      || cand.rate > best.rate
      || (cand.rate === best.rate && cand.count > best.count)
      || (cand.rate === best.rate && cand.count === best.count && cand.key < best.key)) {
      best = cand;
    }
  }
  return best ? best.key : null;
};

// Clone a campaign with a variant's subject / from_name / html overrides applied,
// so the shared dispatcher sends the variant while still tracking the real campaign id.
const variantCampaign = (campaign, variant) => ({
  ...campaign,
  subject: variant.subject || campaign.subject,
  from_name: variant.from_name || campaign.from_name,
  html: variant.html != null ? variant.html : campaign.html,
});

module.exports = { VARIANT_KEYS, normalizeAbConfig, winnerDelayMs, splitRecipients, pickWinner, variantCampaign };
