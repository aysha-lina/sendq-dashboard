import { useState } from 'react';
import { useTranslation } from '../../../i18n';

export default function WizardStep4Schedule({ form, onNext, onBack, saving }) {
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState(form.schedule || 'now');
  const [scheduledAt, setScheduledAt] = useState(form.scheduled_at || '');
  const [error, setError] = useState('');

  const minDate = new Date();
  minDate.setMinutes(minDate.getMinutes() + 5);
  const minDateStr = minDate.toISOString().slice(0, 16);

  const handleNext = () => {
    if (schedule === 'later' && !scheduledAt) {
      setError(t('wiz.err_select_datetime', null, 'Please select a date and time to schedule.'));
      return;
    }
    onNext({ schedule, scheduled_at: schedule === 'later' ? scheduledAt : '' });
  };

  const SaveNext = () => (
    <button className="btn-primary cw-sched-next" onClick={handleNext} disabled={saving}>
      {t('wiz.save_next', null, 'Save & Next')} <span className="material-symbols-rounded">arrow_forward</span>
    </button>
  );

  return (
    <div className="cw-step">
      <div className="cw-sched-opt">
        <label className="cw-sched-head">
          <input type="radio" name="schedule" checked={schedule === 'now'} onChange={() => { setSchedule('now'); setError(''); }} />
          <strong>{t('wiz.send_immediately', null, 'Send immediately')}</strong>
        </label>
        <p className="cw-sched-desc">{t('wiz.send_immediately_desc', null, 'Launch the campaign immediately upon completing its setup.')}</p>
        {schedule === 'now' && <SaveNext />}
      </div>

      <div className="cw-sched-opt">
        <label className="cw-sched-head">
          <input type="radio" name="schedule" checked={schedule === 'later'} onChange={() => { setSchedule('later'); setError(''); }} />
          <strong>{t('wiz.send_at_datetime', null, 'Send at a specified date and time')}</strong>
        </label>
        <p className="cw-sched-desc">{t('wiz.send_at_datetime_desc', null, 'Specify the date and time for the campaign to commence sending emails.')}</p>
        {schedule === 'later' && (
          <div className="cw-sched-when">
            <input type="datetime-local" className="input cw-select" value={scheduledAt} min={minDateStr} onChange={(e) => { setScheduledAt(e.target.value); setError(''); }} style={{ maxWidth: 320 }} />
            {error && <p className="cw-field-error">{error}</p>}
            <SaveNext />
          </div>
        )}
      </div>

      <div className="cw-nav" style={{ marginTop: 28 }}>
        <button className="btn-secondary" onClick={onBack} disabled={saving}>
          <span className="material-symbols-rounded">arrow_back</span> {t('common.back', null, 'Back')}
        </button>
      </div>
    </div>
  );
}
