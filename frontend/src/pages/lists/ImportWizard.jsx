import { useMemo, useState } from 'react';
import { Modal, Spinner, toast } from '../../components/ui';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n/index.jsx';

// Column-mapping wizard: shows the CSV's detected columns + sample rows and lets the
// user map each one to a subscriber field (email / first / last / status) or a list
// custom field, then imports with that explicit mapping.
export default function ImportWizard({ listUid, csv, preview, onClose, onImported }) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState(() => preview.suggested || preview.columns.map(() => ''));
  const [importing, setImporting] = useState(false);

  // Build the dropdown options: standard fields first, then this list's custom fields.
  const options = useMemo(() => ([
    { value: '', label: t('imp.skip_column') },
    ...preview.standardFields.map((f) => ({ value: f, label: t(`imp.field_${f}`) })),
    ...preview.customFields.map((f) => ({ value: f.tag, label: `${f.label} (${t('imp.custom')})` })),
  ]), [preview, t]);

  const emailMapped = mapping.includes('email');

  const setCol = (i, value) => setMapping((m) => m.map((v, idx) => (idx === i ? value : v)));

  const runImport = async () => {
    if (!emailMapped) { toast.error(t('imp.email_required')); return; }
    setImporting(true);
    try {
      const { data } = await listsApi.importSubscribers(listUid, { csv, mapping });
      onImported(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('imp.failed'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('imp.title')}>
      <div className="import-wizard">
        <p className="import-wizard-intro">
          {t('imp.intro', { rows: preview.rowCount })}
          {!preview.hasHeader && ` ${t('imp.no_header_note')}`}
        </p>

        <div className="import-wizard-table-wrap">
          <table className="import-wizard-table">
            <thead>
              <tr>
                <th>{t('imp.csv_column')}</th>
                <th>{t('imp.sample')}</th>
                <th>{t('imp.maps_to')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.columns.map((col, i) => (
                <tr key={`${col}-${i}`}>
                  <td className="import-wizard-col">{col}</td>
                  <td className="import-wizard-samples">
                    {(preview.sample || []).slice(0, 3).map((row, ri) => (
                      <span key={ri} className="import-wizard-sample">{row[i] || <em>—</em>}</span>
                    ))}
                  </td>
                  <td>
                    <select value={mapping[i] || ''} onChange={(e) => setCol(i, e.target.value)} className="import-wizard-select">
                      {options.map((o) => (
                        // Prevent mapping two columns to the same standard field.
                        <option key={o.value} value={o.value}
                          disabled={o.value && o.value !== mapping[i] && preview.standardFields.includes(o.value) && mapping.includes(o.value)}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!emailMapped && <p className="import-wizard-warn">{t('imp.email_required')}</p>}

        <div className="import-wizard-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={importing}>{t('imp.cancel')}</button>
          <button type="button" className="btn-primary" onClick={runImport} disabled={importing || !emailMapped}>
            {importing ? <Spinner size="sm" /> : t('imp.import_count', { rows: preview.rowCount })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
