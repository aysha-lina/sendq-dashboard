import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api/services';
import AppLayout from '../../../components/layout/AppLayout';
import WizardStep1Setup from './WizardStep1Setup';
import WizardStep2Recipients from './WizardStep2Recipients';
import WizardStep3Content from './WizardStep3Content';
import WizardStep4Schedule from './WizardStep4Schedule';
import WizardStep5Confirm from './WizardStep5Confirm';
import { Spinner } from '../../../components/ui';
import { useTranslation } from '../../../i18n';

const STEPS = [
  { label: 'Recipients', labelKey: 'wiz.step_recipients', icon: 'group' },
  { label: 'Setup', labelKey: 'wiz.step_setup', icon: 'settings' },
  { label: 'Template', labelKey: 'wiz.step_template', icon: 'dashboard' },
  { label: 'Schedule', labelKey: 'wiz.step_schedule', icon: 'schedule' },
  { label: 'Confirm', labelKey: 'wiz.step_confirm', icon: 'task_alt' },
];

const SENDABLE_STATUSES = ['new', 'ready', 'scheduled'];

const blankForm = {
  name: '',
  type: 'regular',
  subject: '',
  preheader: '',
  from_email: '',
  from_name: '',
  reply_to: '',
  mail_list_id: null,
  mail_list_uid: '',
  mail_list_name: '',
  segment_id: null,
  segment_name: '',
  html: '',
  plain: '',
  schedule: 'now',
  scheduled_at: '',
  track_open: true,
  track_click: true,
  sign_dkim: true,
  verification_filter: { none: true, deliverable: true, risky: false, unknown: false, undeliverable: false },
  // A/B test: variant A uses the main `subject`; variant B uses `subjectB`.
  ab_test: { enabled: false, subjectB: '', test_percent: 30, winner_metric: 'opens', winner_wait_hours: 4 },
  custom_headers: [],
  webhooks: [],
};

export default function CampaignWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid: editUid } = useParams();
  const isEdit = Boolean(editUid);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blankForm);
  const [campaignUid, setCampaignUid] = useState(editUid || null);
  const [editStatus, setEditStatus] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.campaigns.get(editUid)
      .then(({ data }) => {
        setEditStatus(data.status);
        setForm({
          name: data.name || '',
          type: data.type || 'regular',
          subject: data.subject || '',
          preheader: data.preheader || '',
          from_email: data.from_email || '',
          from_name: data.from_name || '',
          reply_to: data.reply_to || '',
          mail_list_id: data.mail_list_id || null,
          mail_list_uid: data.mailList?.uid || '',
          mail_list_name: data.mailList?.name || '',
          segment_id: data.segment_id || null,
          segment_name: '',
          html: data.html || '',
          plain: data.plain || '',
          schedule: data.scheduled_at ? 'later' : 'now',
          scheduled_at: data.scheduled_at
            ? new Date(data.scheduled_at).toISOString().slice(0, 16)
            : '',
          track_open: data.track_open ?? true,
          track_click: data.track_click ?? true,
          ab_test: data.ab_test && data.ab_test.enabled
            ? {
              enabled: true,
              subjectB: data.ab_test.variants?.[1]?.subject || '',
              test_percent: data.ab_test.test_percent ?? 30,
              winner_metric: data.ab_test.winner_metric || 'opens',
              winner_wait_hours: data.ab_test.winner_wait_hours ?? 4,
              phase: data.ab_test.phase,
              winner_key: data.ab_test.winner_key,
            }
            : { enabled: false, subjectB: '', test_percent: 30, winner_metric: 'opens', winner_wait_hours: 4 },
          custom_headers: data.options?.custom_headers || [],
          webhooks: data.options?.webhooks || [],
        });
      })
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false));
  }, [isEdit, editUid, navigate]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Persist multiple list targets (via the campaign `options` column). No-op for the
  // common single-list case, so default sending behaviour is unchanged.
  const syncTargets = async (uid, merged) => {
    if (!uid) return;
    const extras = Array.isArray(merged.extra_list_uids) ? merged.extra_list_uids : [];
    if (!extras.length) return;
    const targets = [
      { list_uid: merged.mail_list_uid, segment_id: merged.segment_id || undefined },
      ...extras.map((u) => ({ list_uid: u })),
    ];
    try { await api.campaigns.setTargets(uid, targets); } catch { /* non-fatal */ }
  };

  const handleNext = async (stepData) => {
    setError('');
    setSaving(true);
    try {
      const merged = { ...form, ...stepData };
      setForm(merged);

      // Step 0 = Recipients. Create the draft "Untitled" campaign here (PHP flow).
      if (step === 0 && !isEdit) {
        const res = await api.campaigns.create({
          name: 'Untitled',
          type: merged.type,
          mail_list_id: merged.mail_list_id,
          segment_id: merged.segment_id,
          track_open: merged.track_open,
          track_click: merged.track_click,
        });
        setCampaignUid(res.data.uid);
        await syncTargets(res.data.uid, merged);
      } else {
        const payload = buildStepPayload(step, merged, isEdit);
        if (Object.keys(payload).length > 0) {
          await api.campaigns.update(campaignUid, payload);
        }
        if (step === 0) await syncTargets(campaignUid, merged);
      }

      setStep((s) => s + 1);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || t('wiz.err_generic', null, 'Something went wrong.'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setError('');
    setStep((s) => s - 1);
  };

  const handleSend = async () => {
    setError('');
    setSaving(true);
    try {
      if (form.schedule === 'later' && form.scheduled_at) {
        await api.campaigns.update(campaignUid, { scheduled_at: form.scheduled_at });
      } else if (isEdit) {
        await api.campaigns.update(campaignUid, { scheduled_at: null });
      }
      await api.campaigns.run(campaignUid);
      navigate('/campaigns');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || t('wiz.err_send', null, 'Failed to send campaign.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    setError('');
    setSaving(true);
    try {
      const scheduledAt = form.schedule === 'later' && form.scheduled_at ? form.scheduled_at : null;
      await api.campaigns.update(campaignUid, { scheduled_at: scheduledAt });
      navigate('/campaigns');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || t('wiz.err_save', null, 'Failed to save campaign.'));
    } finally {
      setSaving(false);
    }
  };

  const canSend = !isEdit || SENDABLE_STATUSES.includes(editStatus);
  const stepProps = { form, update, campaignUid, onNext: handleNext, onBack: handleBack, saving, error };

  if (loading) {
    return (
      <AppLayout>
        <div className="cw-page"><div className="cw-loading"><Spinner size="lg" /></div></div>
      </AppLayout>
    );
  }

  const campaignName = form.name && form.name.trim() ? form.name : t('wiz.untitled', null, 'Untitled');

  return (
    <AppLayout>
      <div className="cw-page">
        <p className="cw-breadcrumb">
          <button type="button" onClick={() => navigate('/dashboard')}>{t('wiz.breadcrumb_home', null, 'Home')}</button>
          <span>›</span>
          <button type="button" onClick={() => navigate('/campaigns')}>{t('wiz.breadcrumb_campaigns', null, 'Campaigns')}</button>
        </p>
        <h1 className="cw-campaign-title">
          <span className="material-symbols-rounded">mail</span> {campaignName}
        </h1>

        <div className="cw-stepbar">
          {STEPS.map((s, i) => (
            <div key={s.label} className="cw-stepbar-item">
              <button
                type="button"
                className={`cw-stepbar-tab ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                onClick={() => { if (i < step) setStep(i); }}
                disabled={i > step}
              >
                <span className="material-symbols-rounded">{s.icon}</span>
                <span>{t(s.labelKey, null, s.label)}</span>
              </button>
              {i < STEPS.length - 1 && <span className="material-symbols-rounded cw-stepbar-sep">chevron_right</span>}
            </div>
          ))}
        </div>

        <div className="cw-body">
          {error && step < 4 && (
            <div className="wizard-error-banner">
              <span className="material-symbols-rounded">error</span>
              {error}
            </div>
          )}
          {step === 0 && <WizardStep2Recipients {...stepProps} />}
          {step === 1 && <WizardStep1Setup {...stepProps} />}
          {step === 2 && <WizardStep3Content {...stepProps} />}
          {step === 3 && <WizardStep4Schedule {...stepProps} />}
          {step === 4 && (
            <WizardStep5Confirm
              {...stepProps}
              campaignUid={campaignUid}
              onEdit={(i) => setStep(i)}
              onSend={handleSend}
              onSaveOnly={isEdit ? handleSaveOnly : null}
              isEdit={isEdit}
              canSend={canSend}
            />
          )}
        </div>
      </div>

      {saving && <div className="wizard-saving-overlay"><Spinner size="lg" /></div>}
    </AppLayout>
  );
}

function buildStepPayload(step, form) {
  // Step 0 = Recipients, Step 1 = Setup, Step 2 = Template.
  if (step === 0) return { mail_list_id: form.mail_list_id, segment_id: form.segment_id };
  if (step === 1) {
    const ab = form.ab_test || {};
    const abPayload = ab.enabled
      ? {
        enabled: true,
        variants: [
          { key: 'A', subject: form.subject },
          { key: 'B', subject: ab.subjectB },
        ],
        test_percent: Number(ab.test_percent) || 30,
        winner_metric: ab.winner_metric === 'clicks' ? 'clicks' : 'opens',
        winner_wait_hours: Number(ab.winner_wait_hours) || 4,
      }
      : { enabled: false };
    return {
      name: form.name,
      type: ab.enabled ? 'ab-test' : form.type,
      subject: form.subject,
      preheader: form.preheader,
      from_email: form.from_email,
      from_name: form.from_name,
      reply_to: form.reply_to || form.from_email,
      track_open: form.track_open,
      track_click: form.track_click,
      sign_dkim: form.sign_dkim,
      ab_test: abPayload,
    };
  }
  if (step === 2) {
    return {
      html: form.html,
      plain: form.plain,
      preheader: form.preheader,
      custom_headers: (form.custom_headers || []).filter((h) => h && h.name),
      webhooks: (form.webhooks || []).filter((w) => w && w.url),
    };
  }
  return {};
}
