import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { toast } from '../../components/ui';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n';

const EVENTS = [
  { value: 'customer.subscribed', title: 'Customer Subscribed to Plan', desc: 'Triggered when a customer subscribes to a plan.' },
  { value: 'customer.canceled', title: 'Customer Canceled Plan', desc: 'Triggered when a customer cancels their subscription plan.' },
  { value: 'customer.registered', title: 'New Customer Registered', desc: 'Triggered when a new customer registers.' },
  { value: 'customer.changed_plan', title: 'Customer Changed Plan', desc: 'Triggered when a customer changes their subscription plan.' },
  { value: 'customer.terminated', title: 'Customer Subscription Terminated', desc: "Triggered when a customer's subscription is terminated." },
  { value: 'automation', title: 'Automation Webhook', desc: 'An webhook in an automation that is triggered by the automation.' },
];

const WebhookEditorPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [event, setEvent] = useState(EVENTS[0]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ddRef = useRef(null);
  useClickOutside(ddRef, () => setOpen(false), open);

  const evTitle = (e) => t(`ase.event_${e.value}_title`, null, e.title);
  const evDesc = (e) => t(`ase.event_${e.value}_desc`, null, e.desc);

  const save = async () => {
    if (!name.trim()) { toast.error(t('ase.webhook_name_is_required', null, 'Webhook name is required.')); return; }
    setSaving(true);
    try {
      await adminApi.createWebhook({ name: name.trim(), event: event.value });
      toast.success(t('ase.webhook_added', null, 'Webhook added.'));
      navigate('/admin/webhooks');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ase.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ase.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/webhooks')}>{t('ase.webhooks', null, 'Webhooks')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{t('ase.add_a_new_webhook', null, 'Add a new webhook')}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">{t('ase.webhooks_intro', null, 'The Webhooks Management feature lets users integrate their system with external services by creating custom webhooks for specific events. Events include actions like subscribing to a plan, canceling a plan, or subscribing to a list. This enables real-time notifications and seamless automation, ensuring efficient workflows and synchronized systems.')}</p>

          <label className="form-label fw-semibold wh-lbl">{t('ase.webhook_name', null, 'Webhook name')} <em className="wh-req">*</em></label>
          <input className="input wh-name-input" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="form-label fw-semibold wh-lbl">{t('ase.select_event', null, 'Select event')} <em className="wh-req">*</em></label>
          <div ref={ddRef} className="wh-event-dd">
            <button type="button" className="wh-event-selected" onClick={() => setOpen((v) => !v)}>
              <div><strong>{evTitle(event)}</strong><p>{evDesc(event)}</p></div>
              <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
              <div className="wh-event-menu">
                {EVENTS.map((e) => (
                  <button type="button" key={e.value} className={`wh-event-opt ${e.value === event.value ? 'is-active' : ''}`} onClick={() => { setEvent(e); setOpen(false); }}>
                    <strong>{evTitle(e)}</strong><p>{evDesc(e)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="wh-actions">
            <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('ase.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/webhooks')}>{t('common.cancel', null, 'Cancel')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default WebhookEditorPage;
