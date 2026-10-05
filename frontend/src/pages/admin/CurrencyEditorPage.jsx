import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const CurrencyEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', code: '', format: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.currencies({ per_page: 200 })
      .then(({ data }) => {
        const cur = (data.data || []).find((c) => String(c.id) === String(id));
        if (!cur) { navigate('/admin/currencies'); return; }
        setForm({ name: cur.name || '', code: cur.code || '', format: cur.format || '' });
      })
      .catch(() => navigate('/admin/currencies'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.format.trim()) { toast.error(t('cfg.currency_required', null, 'Name, code and format are required.')); return; }
    setSaving(true);
    try {
      await adminApi.updateCurrency(id, form);
      toast.success(t('cfg.currency_saved', null, 'Currency saved.'));
      navigate('/admin/currencies');
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/currencies')}>{t('cfg.currencies', null, 'Currencies')}</button>
            <span>›</span>
            <span>{t('cfg.update', null, 'Update')}</span>
          </nav>
          {!loading && <h1><span className="material-symbols-rounded">paid</span>{form.name || t('cfg.currency', null, 'Currency')}</h1>}
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <>
              <div className="currency-edit-grid">
                <label className="admin-detail-field"><span>{t('cfg.name_required', null, 'Name *')}</span>
                  <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('cfg.code_required', null, 'Code *')}</span>
                  <input className="input" value={form.code} onChange={(e) => set('code', e.target.value)} /></label>
                <label className="admin-detail-field"><span>{t('cfg.format_required', null, 'Format *')}</span>
                  <input className="input" value={form.format} onChange={(e) => set('format', e.target.value)} /></label>
              </div>
              <div className="currency-edit-actions">
                <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('cfg.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default CurrencyEditorPage;
