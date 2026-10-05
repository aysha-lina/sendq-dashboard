import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

const CreditPlanEditorPage = () => {
  const { t } = useTranslation();
  const { uid } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(uid);

  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', credits: '', price: '', currency_id: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const reqs = [adminApi.currencies({ per_page: 100 })];
    if (editing) reqs.push(adminApi.sendingCreditPlanDetail(uid));
    Promise.all(reqs)
      .then(([{ data: cur }, detail]) => {
        const list = cur.data || [];
        setCurrencies(list);
        if (editing && detail) {
          const p = detail.data;
          setForm({
            name: p.name || '', description: p.description || '',
            credits: p.credits ?? '', price: p.price ?? '',
            currency_id: p.currency_id ? String(p.currency_id) : '',
          });
        } else {
          const omr = list.find((c) => (c.code || '').toUpperCase() === 'OMR');
          setForm((f) => ({ ...f, currency_id: String((omr || list[0])?.id || '') }));
        }
      })
      .catch(() => navigate('/admin/sending-credit-plans'))
      .finally(() => setLoading(false));
  }, [uid, editing, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('ade.cp.name_required', null, 'Plan name is required.')); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, description: form.description, credits: form.credits, price: form.price, currency_id: form.currency_id || null };
      if (editing) await adminApi.updateSendingCreditPlan(uid, payload);
      else await adminApi.createSendingCreditPlan(payload);
      toast.success(editing ? t('ade.cp.saved', null, 'Plan saved.') : t('ade.cp.created', null, 'Plan created.'));
      navigate('/admin/sending-credit-plans');
    } catch (err) {
      toast.error(err.response?.data?.message || t('ade.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('ade.breadcrumb_home', null, 'Home')}</button>
            <span>›</span>
            <button type="button" onClick={() => navigate('/admin/sending-credit-plans')}>{t('ade.cp.breadcrumb', null, 'Sending Credit plans')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">send</span>{editing ? (form.name || t('ade.cp.edit_plan', null, 'Edit plan')) : t('ade.cp.add_plan', null, 'Add new Plan')}</h1>
        </header>

        <section className="admin-content">
          {loading ? (
            <div className="admin-empty"><Spinner size="lg" /></div>
          ) : (
            <div className="admin-detail-form admin-detail-narrow">
              <h2 className="sq-section-title">{t('ade.cp.plan_details', null, 'Plan details')}</h2>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.cp.plan_name', null, 'Plan name')}</span>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.cp.description', null, 'Description')}</span>
                <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.cp.credits', null, 'Credits')}</span>
                <input className="input" type="number" value={form.credits} onChange={(e) => set('credits', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.cp.price', null, 'Price')}</span>
                <input className="input" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>{t('ade.cp.currency', null, 'Currency')}</span>
                <select className="input" value={form.currency_id} onChange={(e) => set('currency_id', e.target.value)}>
                  {currencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
              <div className="admin-detail-actions">
                <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('ade.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
                <button type="button" className="btn-secondary" onClick={() => navigate('/admin/sending-credit-plans')} disabled={saving}>{t('common.cancel', null, 'Cancel')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default CreditPlanEditorPage;
