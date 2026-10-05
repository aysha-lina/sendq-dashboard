import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api/services';
import { Spinner } from '../../../components/ui';
import { useTranslation } from '../../../i18n';

// Verification-status delivery options (matches PHP "Delivery settings").
const VERIFY_OPTIONS = [
  { key: 'none', labelKey: 'wiz.verify_none', label: 'No verification status', descKey: 'wiz.verify_none_desc', desc: "Contacts whose emails are not checked against a verification service yet. Normally, it is fine to send to these contacts if you are quite sure about your list" },
  { key: 'deliverable', labelKey: 'wiz.verify_deliverable', label: 'Deliverable', descKey: 'wiz.verify_deliverable_desc', desc: 'The email verification process determined the address is valid and can receive email.' },
  { key: 'risky', labelKey: 'wiz.verify_risky', label: 'Risky', descKey: 'wiz.verify_risky_desc', desc: 'The email address is valid but poses potential risks for email delivery. They are possibly role-based (e.g., info@, support@) or temporary or disposable addresses…' },
  { key: 'unknown', labelKey: 'wiz.verify_unknown', label: 'Unknown', descKey: 'wiz.verify_unknown_desc', desc: 'The email verification process could not determine the status of the email address, due to server unresponsiveness or they do not allow verification checks' },
  { key: 'undeliverable', labelKey: 'wiz.verify_undeliverable', label: 'Undeliverable', descKey: 'wiz.verify_undeliverable_desc', desc: 'The email address is invalid or cannot receive emails. Sending emails to this address will result in delivery failures' },
];

export default function WizardStep2Recipients({ form, update, onNext, saving }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [selectedListUid, setSelectedListUid] = useState(form.mail_list_uid || '');
  const [selectedSegmentId, setSelectedSegmentId] = useState(form.segment_id || '');
  const [extraListUids, setExtraListUids] = useState(form.extra_list_uids || []);
  const [verify, setVerify] = useState(form.verification_filter || { none: true, deliverable: true, risky: false, unknown: false, undeliverable: false });
  const [error, setError] = useState('');

  const toggleExtra = (uid) => setExtraListUids((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur, uid]));

  useEffect(() => {
    api.mailLists.list({ per_page: 100 })
      .then((res) => setLists(res.data?.data || res.data || []))
      .catch(() => setLists([]))
      .finally(() => setLoadingLists(false));
  }, []);

  useEffect(() => {
    if (!selectedListUid) { setSegments([]); return; }
    api.mailLists.segments(selectedListUid)
      .then((res) => setSegments(res.data?.data || res.data || []))
      .catch(() => setSegments([]));
  }, [selectedListUid]);

  const toggleVerify = (key) => setVerify((v) => ({ ...v, [key]: !v[key] }));

  const handleNext = () => {
    if (!selectedListUid) { setError(t('wiz.err_choose_list', null, 'Please choose a list to send to.')); return; }
    const list = lists.find((l) => l.uid === selectedListUid);
    const segment = segments.find((s) => String(s.id) === String(selectedSegmentId));
    update({ verification_filter: verify });
    onNext({
      mail_list_id: list?.id || null,
      mail_list_uid: list?.uid || '',
      mail_list_name: list?.name || '',
      segment_id: segment?.id || null,
      segment_name: segment?.name || '',
      extra_list_uids: extraListUids.filter((u) => u !== selectedListUid),
      verification_filter: verify,
    });
  };

  return (
    <div className="cw-step">
      <h2 className="cw-step-title">{t('wiz.recipients_title', null, 'Choose one or more lists/segments for sending email')}</h2>

      <div className="cw-recipients-row">
        <div className="cw-default-col">
          <span className="cw-label">{t('wiz.set_default_list', null, 'Set as default list')}</span>
          <label className="cw-radio">
            <input type="radio" checked readOnly />
            <span>{t('wiz.default', null, 'Default')}</span>
          </label>
        </div>
        <div className="cw-list-col">
          <span className="cw-label">{t('wiz.which_list', null, 'To which list shall we send?')}</span>
          {loadingLists ? <Spinner size="sm" /> : (
            <select
              className="input cw-select"
              value={selectedListUid}
              onChange={(e) => { setSelectedListUid(e.target.value); setSelectedSegmentId(''); setError(''); }}
            >
              <option value="">{t('wiz.choose', null, 'Choose')}</option>
              {lists.map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
            </select>
          )}
          {segments.length > 0 && (
            <select className="input cw-select" style={{ marginTop: 10 }} value={selectedSegmentId} onChange={(e) => setSelectedSegmentId(e.target.value)}>
              <option value="">{t('wiz.all_subscribers_in_list', null, 'All subscribers in this list')}</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {error && <p className="cw-field-error">{error}</p>}
        </div>
      </div>

      {selectedListUid && lists.filter((l) => l.uid !== selectedListUid).length > 0 && (
        <div className="cw-extra-lists">
          <span className="cw-label">{t('wiz.also_send_to', null, 'Also send to these lists (optional)')}</span>
          <div className="cw-extra-grid">
            {lists.filter((l) => l.uid !== selectedListUid).map((l) => (
              <label key={l.uid} className="cw-extra-item">
                <input type="checkbox" checked={extraListUids.includes(l.uid)} onChange={() => toggleExtra(l.uid)} />
                <span>{l.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="btn-secondary cw-newlist-btn" onClick={() => navigate('/lists/all')}>
        <span className="material-symbols-rounded">add</span> {t('wiz.new_list_segment', null, 'New list/segment')}
      </button>

      <h3 className="cw-section-title">{t('wiz.delivery_settings', null, 'Delivery settings')}</h3>
      <p className="cw-section-intro">
        {t('wiz.delivery_settings_intro', null, 'By default, we send emails to contacts with no verification status, or with verification status of deliverable only. However, you can consider sending to contacts with verification status of risky and unknown too. Be well aware that it might impact your sending domain or IP.')}
      </p>

      <div className="cw-verify-list">
        {VERIFY_OPTIONS.map((o) => (
          <label key={o.key} className="cw-verify-item">
            <input type="checkbox" checked={!!verify[o.key]} onChange={() => toggleVerify(o.key)} />
            <div>
              <strong>{t(o.labelKey, null, o.label)}</strong>
              <p>{t(o.descKey, null, o.desc)}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="cw-nav cw-nav-end">
        <button className="btn-primary" onClick={handleNext} disabled={saving || loadingLists}>
          {t('wiz.save_next', null, 'Save & Next')} <span className="material-symbols-rounded">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
