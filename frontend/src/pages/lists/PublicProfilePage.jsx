import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n';

// Public subscriber self-service: update name + custom field values.
const PublicProfilePage = () => {
  const { t } = useTranslation();
  const { subscriberUid } = useParams();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', fields: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    listsApi.getPublicProfile(subscriberUid)
      .then(({ data: res }) => {
        setData(res);
        setForm({
          first_name: res.subscriber.first_name || '',
          last_name: res.subscriber.last_name || '',
          fields: Object.fromEntries((res.fields || []).map((f) => [f.tag, f.value || ''])),
        });
      })
      .catch((err) => setError(err.response?.data?.message || t('pub.page_unavailable')))
      .finally(() => setLoading(false));
  }, [subscriberUid]);

  const setField = (tag, v) => setForm((p) => ({ ...p, fields: { ...p.fields, [tag]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await listsApi.updatePublicProfile(subscriberUid, form);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || t('pub.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', padding: 20 };
  const card = { width: '100%', maxWidth: 480, background: '#fff', color: '#1a1a1a', borderRadius: 10, padding: 32 };
  const input = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 14, boxSizing: 'border-box' };

  if (loading) return <div style={wrap}><p style={{ color: '#b9b9c4' }}>{t('common.loading')}</p></div>;
  if (error && !data) return <div style={wrap}><p style={{ color: '#e0414b' }}>{error}</p></div>;

  return (
    <div style={wrap}>
      <div style={card}>
        {done ? (
          <p style={{ textAlign: 'center', fontSize: 18 }}>✅ {t('pub.preferences_updated')}</p>
        ) : (
          <form onSubmit={save}>
            <h2 style={{ margin: '0 0 4px' }}>{t('pub.update_preferences')}</h2>
            <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: 14 }}>
              {data.subscriber.email}{data.list ? ` · ${data.list.name}` : ''}
            </p>

            <label style={{ fontSize: 13 }}>{t('auth.first_name')}</label>
            <input style={input} value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
            <label style={{ fontSize: 13 }}>{t('auth.last_name')}</label>
            <input style={input} value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />

            {(data.fields || []).map((f) => (
              <div key={f.uid}>
                <label style={{ fontSize: 13 }}>{f.label}{f.required ? ' *' : ''}</label>
                <input
                  style={input}
                  type={f.type === 'number' ? 'number' : 'text'}
                  required={f.required}
                  value={form.fields[f.tag] || ''}
                  onChange={(e) => setField(f.tag, e.target.value)}
                />
              </div>
            ))}

            {error && <p style={{ color: '#e0414b', fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#00698f', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? t('subs.saving') : t('pub.save_preferences')}
            </button>
          </form>
        )}
        <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 16, fontSize: 12 }}>{t('pub.powered_by')}</p>
      </div>
    </div>
  );
};

export default PublicProfilePage;
