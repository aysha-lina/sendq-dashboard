import { useEffect, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner, toast } from '../../components/ui';
import { sendingApi } from '../../api/services';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;

const StatusPill = ({ status }) => {
  const map = {
    verified: { bg: '#e5f6ed', color: '#15794a', label: 'Verified' },
    unverified: { bg: '#fdf0e3', color: '#a15c15', label: 'Pending verification' },
  };
  const s = map[status] || map.unverified;
  return <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{s.label}</span>;
};

const SendersPage = () => {
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    sendingApi.senders()
      .then(({ data }) => setSenders(data.data || []))
      .catch(() => setSenders([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const { data } = await sendingApi.createSender(form);
      toast.success(data.verification_sent ? 'Sender added — verification email sent.' : 'Sender added (verification email could not be sent).');
      setForm({ name: '', email: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add sender.');
    } finally {
      setSaving(false);
    }
  };

  const resend = async (s) => {
    try {
      const { data } = await sendingApi.resendSenderVerify(s.uid);
      toast.success(data.message || 'Verification email sent.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend.');
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete sender "${s.email}"?`)) return;
    try {
      await sendingApi.deleteSender(s.uid);
      setSenders((cur) => cur.filter((x) => x.uid !== s.uid));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete.');
    }
  };

  return (
    <AppLayout>
      <div className="sq-page px-8 py-8 lg:px-14">
        <div className="mb-8">
          <p className="text-lg">Home &gt; Sending</p>
          <h1 className="sq-section-title mt-6 text-[32px]">Senders</h1>
          <p className="mt-2 max-w-[720px] text-lg text-[#6b7280]">
            Verified From-addresses. Add an address, then click the link in the verification email before using it as a campaign sender.
          </p>
        </div>

        <form onSubmit={create} className="sq-panel mb-8 flex flex-wrap items-end gap-3 p-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Sender name</span>
            <input className="input h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Marketing Team" required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Email address</span>
            <input className="input h-11" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hello@yourdomain.com" required />
          </label>
          <button type="submit" className="btn-primary h-11" disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="add" />} Add sender
          </button>
        </form>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner size="lg" /></div>
        ) : senders.length === 0 ? (
          <div className="sq-panel flex h-40 items-center justify-center text-lg text-[#6b7280]">No senders yet.</div>
        ) : (
          <div className="sending-table-wrap sq-panel overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {senders.map((s) => (
                  <tr key={s.uid} className="border-t border-[#e6e8ef]">
                    <td className="p-4">{s.name}</td>
                    <td className="p-4">{s.email}</td>
                    <td className="p-4"><StatusPill status={s.status} /></td>
                    <td className="p-4 text-right">
                      {s.status !== 'verified' && (
                        <button type="button" className="btn-secondary mr-2" onClick={() => resend(s)}>Resend</button>
                      )}
                      <button type="button" className="btn-secondary" onClick={() => remove(s)}>
                        <MaterialIcon name="delete_outline" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SendersPage;
