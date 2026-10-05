import { useEffect, useState } from 'react';
import { sendingApi } from '../../../api/services';
import { useTranslation } from '../../../i18n';

const TOGGLES = [
  { key: 'track_open', labelKey: 'wiz.toggle_track_open', label: 'Track opens', descKey: 'wiz.toggle_track_open_desc', desc: 'Discover who opens your campaigns by tracking the number of times an invisible web beacon embedded in the campaign is downloaded.' },
  { key: 'track_click', labelKey: 'wiz.toggle_track_click', label: 'Track clicks', descKey: 'wiz.toggle_track_click_desc', desc: 'Discover which campaign links were clicked, how many times they were clicked, and who did the clicking.' },
  { key: 'sign_dkim', labelKey: 'wiz.toggle_dkim', label: 'Add DKIM signature', descKey: 'wiz.toggle_dkim_desc', desc: 'Sign your email with your sending domain (if any), telling receiving email servers that your email is actually coming from you. This is to help establish the authenticity of your email, improving delivery rate.' },
  { key: 'custom_tracking_domain', labelKey: 'wiz.toggle_tracking_domain', label: 'Custom Tracking Domain', descKey: 'wiz.toggle_tracking_domain_desc', desc: "Using a tracking domain causes all the links and URLs in your emails to be overwritten as if they come from your own brand's domain (rather than from this application hostname), making your email more authentic and more likely to reach recipients INBOX." },
  { key: 'skip_failed', labelKey: 'wiz.toggle_skip_failed', label: 'Skip failed messages', descKey: 'wiz.toggle_skip_failed_desc', desc: 'Enable this option to skip failed message and continue with the remaining instead of stopping the whole campaign.' },
];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function WizardStep1Setup({ form, onNext, onBack, saving }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState({
    name: form.name && form.name !== 'Untitled' ? form.name : '',
    type: form.type,
    subject: form.subject,
    preheader: form.preheader,
    from_email: form.from_email,
    from_name: form.from_name,
    reply_to: form.reply_to,
    track_open: form.track_open,
    track_click: form.track_click,
    sign_dkim: form.sign_dkim ?? true,
    custom_tracking_domain: form.custom_tracking_domain ?? false,
    skip_failed: form.skip_failed ?? true,
    ab_test: form.ab_test || { enabled: false, subjectB: '', test_percent: 30, winner_metric: 'opens', winner_wait_hours: 4 },
  });
  const [errors, setErrors] = useState({});
  const ab = local.ab_test;
  const abLocked = ab.phase === 'testing' || ab.phase === 'done'; // running/finished → read-only
  const setAb = (k, v) => setLocal((f) => ({ ...f, ab_test: { ...f.ab_test, [k]: v } }));
  const [domainAuth, setDomainAuth] = useState({ status: 'idle' });

  // Live SPF/DKIM/DMARC check on the From domain so the user is warned before
  // sending from an unauthenticated domain (which gets spam-filed).
  useEffect(() => {
    if (!isEmail(local.from_email)) { setDomainAuth({ status: 'idle' }); return undefined; }
    setDomainAuth({ status: 'loading' });
    const id = setTimeout(() => {
      sendingApi.checkDomainAuth(local.from_email)
        .then(({ data }) => setDomainAuth({ status: 'done', data }))
        .catch(() => setDomainAuth({ status: 'error' }));
    }, 700);
    return () => clearTimeout(id);
  }, [local.from_email]);

  const set = (k, v) => setLocal((f) => {
    const next = { ...f, [k]: v };
    if (k === 'from_email' && (!f.reply_to || f.reply_to === f.from_email)) next.reply_to = v;
    return next;
  });
  const toggle = (k) => setLocal((f) => ({ ...f, [k]: !f[k] }));

  const validate = () => {
    const e = {};
    if (!local.name.trim()) e.name = t('wiz.err_name_required', null, 'Campaign name is required');
    if (!local.subject.trim()) e.subject = t('wiz.err_subject_required', null, 'Subject is required');
    if (!local.from_name.trim()) e.from_name = t('wiz.err_from_name_required', null, 'From name is required');
    if (!local.from_email.trim()) e.from_email = t('wiz.err_from_email_required', null, 'From email is required');
    else if (!isEmail(local.from_email)) e.from_email = t('wiz.err_valid_email', null, 'Enter a valid email');
    if (local.reply_to && !isEmail(local.reply_to)) e.reply_to = t('wiz.err_valid_email', null, 'Enter a valid email');
    if (local.ab_test.enabled && !abLocked && !String(local.ab_test.subjectB || '').trim()) {
      e.subjectB = t('wiz.ab_err_subject_b', null, 'Variant B subject is required for an A/B test');
    }
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext(local);
  };

  return (
    <div className="cw-step">
      <div className="cw-setup-grid">
        {/* Left — sender + content details */}
        <div className="cw-setup-left">
          <label className="cw-field">
            <span>{t('wiz.label_name', null, 'Name your campaign')} <em>*</em></span>
            <input className="input" value={local.name} onChange={(e) => set('name', e.target.value)} placeholder={t('wiz.untitled', null, 'Untitled')} />
            {errors.name && <p className="cw-field-error">{errors.name}</p>}
          </label>

          <label className="cw-field">
            <span>{t('wiz.label_subject', null, 'Email subject')} <em>*</em></span>
            <div className="cw-subject-wrap">
              <input className="input" value={local.subject} onChange={(e) => set('subject', e.target.value)} />
              <span className="material-symbols-rounded cw-subject-emoji" title={t('wiz.insert_emoji', null, 'Insert emoji')}>mood</span>
            </div>
            {errors.subject && <p className="cw-field-error">{errors.subject}</p>}
          </label>

          <label className="cw-field">
            <span>{t('wiz.label_from_name', null, 'From name')} <em>*</em></span>
            <input className="input" value={local.from_name} onChange={(e) => set('from_name', e.target.value)} />
            {errors.from_name && <p className="cw-field-error">{errors.from_name}</p>}
          </label>

          <label className="cw-field">
            <span>{t('wiz.label_from_email', null, 'From email')} <em>*</em></span>
            <input className="input" value={local.from_email} onChange={(e) => set('from_email', e.target.value)} placeholder="you@yourdomain.com" />
            {errors.from_email && <p className="cw-field-error">{errors.from_email}</p>}
            {isEmail(local.from_email) && domainAuth.status === 'loading' && (
              <div className="cw-sender-notice">
                <span className="material-symbols-rounded cw-spin">progress_activity</span>
                <span>{t('wiz.checking_domain_auth', null, 'Checking domain authentication…')}</span>
              </div>
            )}
            {isEmail(local.from_email) && domainAuth.status === 'done' && domainAuth.data.level === 'good' && (
              <div className="cw-sender-notice cw-sender-good">
                <span className="material-symbols-rounded">verified</span>
                <span>
                  <strong>{domainAuth.data.domain}</strong> {t('wiz.domain_good_pre', null, 'is authenticated — SPF & DKIM')}
                  {domainAuth.data.dmarc.ok ? t('wiz.domain_dmarc_suffix', null, ' & DMARC') : ''} {t('wiz.domain_good_post', null, 'found. Good inbox deliverability.')}
                </span>
              </div>
            )}
            {isEmail(local.from_email) && domainAuth.status === 'done' && domainAuth.data.level === 'warn' && (
              <div className="cw-sender-notice cw-sender-warn">
                <span className="material-symbols-rounded">warning</span>
                <span>
                  {t('wiz.domain_warn_pre', null, 'SPF is set but')} <strong>{t('wiz.domain_dkim_missing', null, 'DKIM is missing')}</strong> {t('wiz.domain_for', null, 'for')} <strong>{domainAuth.data.domain}</strong>. {t('wiz.domain_warn_mid', null, 'Emails may land in spam. Enable DKIM in your DNS (and DMARC)')}{' '}
                  <a href="/sending/domains" target="_blank" rel="noreferrer">{t('wiz.manage_sending_domains', null, 'manage sending domains')}</a>. {t('wiz.domain_can_proceed', null, 'You can still proceed.')}
                </span>
              </div>
            )}
            {isEmail(local.from_email) && domainAuth.status === 'done' && domainAuth.data.level === 'bad' && (
              <div className="cw-sender-notice cw-sender-bad">
                <span className="material-symbols-rounded">error</span>
                <span>
                  <strong>{domainAuth.data.domain}</strong> {t('wiz.domain_bad_mid', null, 'has no SPF/DKIM records. Emails will likely be rejected or spam-filed. Set up a verified sending domain')}{' '}
                  <a href="/sending/domains" target="_blank" rel="noreferrer">{t('wiz.here', null, 'here')}</a> {t('wiz.domain_before_sending', null, 'before sending.')}
                </span>
              </div>
            )}
            {isEmail(local.from_email) && domainAuth.status === 'error' && (
              <div className="cw-sender-notice">
                <span className="material-symbols-rounded">info</span>
                <span>{t('wiz.domain_check_error', null, 'Could not check domain authentication. You can proceed, but verify SPF/DKIM if mail lands in spam.')}</span>
              </div>
            )}
          </label>

          <label className="cw-field">
            <span>{t('wiz.label_reply_to', null, 'Reply to')} <em>*</em></span>
            <input className="input" value={local.reply_to} onChange={(e) => set('reply_to', e.target.value)} placeholder={t('wiz.label_reply_to', null, 'Reply to')} />
            {errors.reply_to && <p className="cw-field-error">{errors.reply_to}</p>}
          </label>
        </div>

        {/* Right — delivery/tracking toggles */}
        <div className="cw-setup-right">
          {TOGGLES.map((tg) => (
            <div key={tg.key} className="cw-toggle-row">
              <div className="cw-toggle-text">
                <strong>{t(tg.labelKey, null, tg.label)}</strong>
                <p>{t(tg.descKey, null, tg.desc)}</p>
              </div>
              <button
                type="button"
                className={`admin-switch ${local[tg.key] ? 'is-on' : ''}`}
                onClick={() => toggle(tg.key)}
                aria-pressed={!!local[tg.key]}
              >
                <span />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* A/B test — split subject lines, send the winner to the rest */}
      <div className="cw-ab-panel">
        <div className="cw-ab-head">
          <div className="cw-ab-title">
            <span className="material-symbols-rounded">science</span>
            <div>
              <strong>{t('wiz.ab_title', null, 'A/B test')}</strong>
              <p>{t('wiz.ab_desc', null, 'Send two subject lines to a sample of your audience, then automatically send the best-performing one to everyone else.')}</p>
            </div>
          </div>
          <button
            type="button"
            className={`admin-switch ${ab.enabled ? 'is-on' : ''}`}
            onClick={() => !abLocked && setAb('enabled', !ab.enabled)}
            aria-pressed={!!ab.enabled}
            disabled={abLocked}
          >
            <span />
          </button>
        </div>

        {ab.enabled && abLocked && (
          <div className="cw-sender-notice">
            <span className="material-symbols-rounded">info</span>
            <span>
              {ab.phase === 'done'
                ? t('wiz.ab_done', null, 'A/B test complete — winner:') + ` ${ab.winner_key || '—'}`
                : t('wiz.ab_running', null, 'A/B test is running; the winner will be sent automatically.')}
            </span>
          </div>
        )}

        {ab.enabled && !abLocked && (
          <div className="cw-ab-body">
            <div className="cw-ab-variants">
              <label className="cw-field">
                <span>{t('wiz.ab_variant_a', null, 'Variant A subject (your subject above)')}</span>
                <input className="input" value={local.subject} disabled readOnly />
              </label>
              <label className="cw-field">
                <span>{t('wiz.ab_variant_b', null, 'Variant B subject')} <em>*</em></span>
                <input className="input" value={ab.subjectB} onChange={(e) => setAb('subjectB', e.target.value)} placeholder={t('wiz.ab_variant_b_ph', null, 'A different subject line to test')} />
                {errors.subjectB && <p className="cw-field-error">{errors.subjectB}</p>}
              </label>
            </div>
            <div className="cw-ab-opts">
              <label className="cw-field">
                <span>{t('wiz.ab_test_percent', null, 'Test audience %')}</span>
                <input className="input" type="number" min="5" max="90" value={ab.test_percent} onChange={(e) => setAb('test_percent', e.target.value)} />
              </label>
              <label className="cw-field">
                <span>{t('wiz.ab_winner_metric', null, 'Winner by')}</span>
                <select className="input" value={ab.winner_metric} onChange={(e) => setAb('winner_metric', e.target.value)}>
                  <option value="opens">{t('wiz.ab_metric_opens', null, 'Opens')}</option>
                  <option value="clicks">{t('wiz.ab_metric_clicks', null, 'Clicks')}</option>
                </select>
              </label>
              <label className="cw-field">
                <span>{t('wiz.ab_wait_hours', null, 'Wait before winner (hours)')}</span>
                <input className="input" type="number" min="0" max="168" value={ab.winner_wait_hours} onChange={(e) => setAb('winner_wait_hours', e.target.value)} />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="cw-nav cw-nav-split">
        <button className="btn-secondary" onClick={onBack} disabled={saving}>
          <span className="material-symbols-rounded">arrow_back</span> {t('common.back', null, 'Back')}
        </button>
        <button className="btn-primary" onClick={handleNext} disabled={saving}>
          {t('wiz.save_next', null, 'Save & Next')} <span className="material-symbols-rounded">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
