import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { COUNTRIES } from '../../constants/countries';
import { useTranslation } from '../../i18n';

const TaxSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState('');
  const [countries, setCountries] = useState([]);
  const [savingRate, setSavingRate] = useState(false);

  const [pickCountry, setPickCountry] = useState('');
  const [pickRate, setPickRate] = useState('');
  const [adding, setAdding] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editRate, setEditRate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => adminApi.taxSettings().then(({ data }) => {
    setEnabled(Boolean(data.enabled));
    setRate(data.rate != null ? String(data.rate) : '');
    setCountries(data.countries || []);
  });

  useEffect(() => {
    load().catch(() => toast.error(t('cfg.tax_load_failed', null, 'Failed to load tax settings.'))).finally(() => setLoading(false));
  }, []);

  const saveGlobal = async (nextEnabled = enabled) => {
    setSavingRate(true);
    try {
      await adminApi.updateTaxSettings({ enabled: nextEnabled, rate: rate === '' ? 0 : Number(rate) });
      toast.success(t('cfg.tax_settings_saved', null, 'Tax settings saved.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.save_failed', null, 'Save failed.'));
    } finally { setSavingRate(false); }
  };

  const toggleEnabled = (checked) => { setEnabled(checked); saveGlobal(checked); };

  const addCountry = async () => {
    if (!pickCountry) { toast.error(t('cfg.choose_country', null, 'Choose a country.')); return; }
    setAdding(true);
    try {
      await adminApi.addCountryTax({ country: pickCountry, rate: pickRate === '' ? 0 : Number(pickRate) });
      setPickCountry(''); setPickRate('');
      await load();
      toast.success(t('cfg.country_tax_added', null, 'Country tax added.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.could_not_add_country', null, 'Could not add country.'));
    } finally { setAdding(false); }
  };

  const startEdit = (row) => { setEditRow(row); setEditRate(String(row.rate)); };
  const saveEdit = async () => {
    if (!editRow) return;
    setSavingEdit(true);
    try {
      await adminApi.updateCountryTax(editRow.id, { rate: editRate === '' ? 0 : Number(editRate) });
      setEditRow(null);
      await load();
      toast.success(t('cfg.tax_rate_updated', null, 'Tax rate updated.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.update_failed', null, 'Update failed.'));
    } finally { setSavingEdit(false); }
  };

  const removeCountry = async (id) => {
    if (!window.confirm(t('cfg.remove_country_tax_confirm', null, 'Remove this country tax rate?'))) return;
    try {
      await adminApi.deleteCountryTax(id);
      await load();
      toast.success(t('cfg.country_tax_removed', null, 'Country tax removed.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.remove_failed', null, 'Remove failed.'));
    }
  };

  const usedCountries = new Set(countries.map((c) => c.country));
  const available = COUNTRIES.filter((c) => !usedCountries.has(c));

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">request_quote</span>{t('cfg.tax_settings', null, 'Tax settings')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="tax-settings">
              <label className="tax-enable">
                <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
                <span>
                  <strong>{t('cfg.enable_tax', null, 'Enable tax')}</strong>
                  <em>{t('cfg.enable_tax_help', null, 'Specify a tax rate to apply to all your users payment')}</em>
                </span>
              </label>

              <div className="tax-default-row">
                <label>{t('cfg.default_tax_rate', null, 'Default tax rate')}</label>
                <input className="input tax-rate-input" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
                <span className="tax-pct">%</span>
                <button type="button" className="btn-danger" onClick={() => saveGlobal()} disabled={savingRate}>{savingRate ? t('cfg.saving', null, 'Saving…') : t('cfg.set', null, 'Set')}</button>
              </div>

              <hr className="tax-divider" />

              <p className="tax-help">{t('cfg.tax_country_help', null, 'If you want to set up a different tax rate to a country, specify it in the list below')}</p>

              <div className="tax-country-add">
                <label>{t('cfg.tax_by_country', null, 'Tax by country')}</label>
                <select className="input tax-country-select" value={pickCountry} onChange={(e) => setPickCountry(e.target.value)}>
                  <option value="">{t('cfg.choose', null, 'Choose')}</option>
                  {available.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="input tax-rate-input" type="number" min="0" step="0.01" placeholder={t('cfg.rate_pct', null, 'Rate %')} value={pickRate} onChange={(e) => setPickRate(e.target.value)} />
                <button type="button" className="btn-secondary" onClick={addCountry} disabled={adding || !pickCountry}>{t('cfg.add', null, 'Add')}</button>
              </div>

              <table className="tax-table">
                <thead>
                  <tr><th>{t('cfg.country', null, 'Country')}</th><th>{t('cfg.tax_rate', null, 'Tax rate')}</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {countries.length === 0 ? (
                    <tr><td colSpan={3} className="tax-empty">{t('cfg.no_country_tax', null, 'No country-specific tax rates.')}</td></tr>
                  ) : countries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.country}</td>
                      <td>{row.rate}%</td>
                      <td className="tax-actions">
                        <button type="button" className="tax-link" onClick={() => startEdit(row)}>{t('common.edit', null, 'Edit')}</button>
                        <span>|</span>
                        <button type="button" className="tax-link" onClick={() => removeCountry(row.id)}>{t('cfg.remove', null, 'Remove')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editRow && (
        <div className="tax-modal-overlay" onClick={() => setEditRow(null)}>
          <div className="tax-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tax-modal-close" onClick={() => setEditRow(null)} aria-label="Close">✕</button>
            <div className="tax-modal-body">
              <p className="tax-modal-title">{t('cfg.select_tax_rate_in', null, 'Select tax rate in')} <strong>{editRow.country}</strong></p>
              <div className="tax-modal-rate">
                <input className="input tax-rate-input" type="number" min="0" step="0.01" value={editRate}
                  onChange={(e) => setEditRate(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }} />
                <span className="tax-pct">%</span>
              </div>
              <button type="button" className="btn-secondary tax-modal-save" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? t('cfg.saving', null, 'Saving…') : t('common.save', null, 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default TaxSettingsPage;
