import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { storeApi } from '../../api/services';

const Icon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;

// Tab configs: which store resource, columns, and form fields.
const TABS = {
  products: {
    label: 'Products', api: () => storeApi.products,
    columns: [
      { key: 'title', label: 'Title', render: (r) => r.title || '-' },
      { key: 'price', label: 'Price', render: (r) => (r.price != null ? r.price : '-') },
      { key: 'created_at', label: 'Created', render: (r) => fmt(r.created_at) },
    ],
    fields: [
      { name: 'title', label: 'Title', required: true },
      { name: 'price', label: 'Price', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'content', label: 'Content (HTML)', type: 'textarea' },
    ],
  },
  categories: {
    label: 'Categories', api: () => storeApi.categories,
    columns: [
      { key: 'name', label: 'Name', render: (r) => r.name },
      { key: 'description', label: 'Description', render: (r) => r.description || '-' },
    ],
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  attributes: {
    label: 'Attributes', api: () => storeApi.attributes,
    columns: [
      { key: 'name', label: 'Name', render: (r) => r.name },
      { key: 'category', label: 'Category', render: (r) => r.category?.name || r.category_id },
      { key: 'status', label: 'Status', render: (r) => r.status || '-' },
    ],
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'category_id', label: 'Category ID', type: 'number', required: true },
      { name: 'status', label: 'Status' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  orders: {
    label: 'Orders', api: () => storeApi.orders,
    columns: [
      { key: 'name', label: 'Order', render: (r) => r.name || '-' },
      { key: 'total', label: 'Total', render: (r) => (r.total != null ? r.total : '-') },
      { key: 'status', label: 'Status', render: (r) => r.status || '-' },
      { key: 'created_at', label: 'Date', render: (r) => fmt(r.created_at) },
    ],
    fields: [
      { name: 'name', label: 'Order name', required: true },
      { name: 'receive_name', label: 'Recipient name' },
      { name: 'receive_address', label: 'Recipient address' },
      { name: 'receive_phone', label: 'Recipient phone' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'tax', label: 'Tax', type: 'number' },
      { name: 'total', label: 'Total', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'paid', 'completed', 'cancelled'], default: 'pending' },
    ],
  },
  funnels: {
    label: 'Funnels', api: () => storeApi.funnels,
    columns: [
      { key: 'name', label: 'Name', render: (r) => r.name || '-' },
      { key: 'status', label: 'Status', render: (r) => r.status || '-' },
      { key: 'created_at', label: 'Created', render: (r) => fmt(r.created_at) },
    ],
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'message', label: 'Message', type: 'textarea' },
      { name: 'content', label: 'Content (HTML)', type: 'textarea' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'inactive'], default: 'draft' },
    ],
  },
};

function fmt(v) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
}

const ResourceModal = ({ config, record, onClose, onSave }) => {
  const [form, setForm] = useState(() => config.fields.reduce((a, f) => {
    a[f.name] = record?.[f.name] ?? f.default ?? '';
    return a;
  }, {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const missing = config.fields.filter((f) => f.required && !String(form[f.name] ?? '').trim());
    if (missing.length) { setError(`${missing.map((f) => f.label).join(', ')} required.`); return; }
    setSaving(true); setError('');
    try { await onSave(form); } catch (err) { setError(err.response?.data?.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <div className="store-modal-backdrop" onClick={onClose} style={backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{record ? 'Edit' : 'New'} {config.label.replace(/s$/, '').toLowerCase()}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 0, color: '#aaa', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        {config.fields.map((f) => (
          <label key={f.name} style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{f.label}{f.required ? ' *' : ''}</span>
            {f.type === 'textarea' ? (
              <textarea className="input" rows={3} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} style={{ width: '100%' }} />
            ) : f.type === 'select' ? (
              <select className="input" value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} style={{ width: '100%' }}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" type={f.type === 'number' ? 'number' : 'text'} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} style={{ width: '100%' }} />
            )}
          </label>
        ))}
        {error && <p style={{ color: '#e0414b' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 };
const modal = { width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: 8, padding: 24, color: '#1f2a37', border: '1px solid #d7dde5' };

const StorePage = () => {
  const [tab, setTab] = useState('products');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const config = TABS[tab];

  const load = useCallback(async () => {
    setLoading(true); setNotice('');
    try {
      const { data } = await config.api().list();
      setRows(data.data || []);
    } catch (err) {
      setRows([]);
      setNotice(err.response?.data?.message || 'Unable to load.');
    } finally { setLoading(false); }
  }, [config]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { storeApi.summary().then(({ data }) => setSummary(data)).catch(() => setSummary(null)); }, []);

  const save = async (formData) => {
    if (modal.record) await config.api().update(modal.record.id, formData);
    else await config.api().create(formData);
    setModal(null);
    storeApi.summary().then(({ data }) => setSummary(data)).catch(() => {});
    load();
  };

  const remove = async (row) => {
    if (!window.confirm('Delete this record?')) return;
    try { await config.api().remove(row.id); load(); } catch (err) { setNotice(err.response?.data?.message || 'Delete failed.'); }
  };

  const cards = useMemo(() => ([
    { label: 'Products', value: summary?.products ?? '–' },
    { label: 'Orders', value: summary?.orders ?? '–' },
    { label: 'Funnels', value: summary?.funnels ?? '–' },
    { label: 'Revenue', value: summary?.revenue ?? '–' },
  ]), [summary]);

  return (
    <AppLayout>
      <div className="sq-page px-8 py-8 lg:px-14">
        <h1 className="mb-8 text-[40px] font-normal text-[rgba(197,192,142,0.22)]">Store</h1>

        <section className="mb-8 grid gap-6 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-[#23233a] px-6 py-5">
              <p className="text-[#bebeca]">{c.label}</p>
              <p className="text-3xl font-semibold text-white">{c.value}</p>
            </div>
          ))}
        </section>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-[#33334a]">
          {Object.entries(TABS).map(([key, cfg]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-lg ${tab === key ? 'border-b-2 border-[#1aa0b8] text-white' : 'text-[#9a9aa8]'}`}>
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex justify-end">
          <button className="btn-primary" onClick={() => setModal({ record: null })}>
            <Icon name="add" /> New {config.label.replace(/s$/, '').toLowerCase()}
          </button>
        </div>

        {notice && <p className="mb-4 text-base text-[#e6a23c]">{notice}</p>}

        {loading ? (
          <p className="py-10 text-center text-[#9a9aa8]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[#9a9aa8]">No {config.label.toLowerCase()} yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-[#1c1c30]">
            <table className="w-full min-w-[700px] text-left text-base">
              <thead className="text-[#9a9aa8]">
                <tr>{config.columns.map((c) => <th key={c.key} className="px-5 py-3">{c.label}</th>)}<th className="px-5 py-3">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#2c2c44]">
                    {config.columns.map((c) => <td key={c.key} className="px-5 py-3 text-[#d4d4e0]">{c.render(row)}</td>)}
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary h-9 px-3 text-sm" onClick={() => setModal({ record: row })}>Edit</button>
                        <button className="btn-danger h-9 px-3 text-sm" onClick={() => remove(row)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <ResourceModal config={config} record={modal.record} onClose={() => setModal(null)} onSave={save} />}
    </AppLayout>
  );
};

export default StorePage;
