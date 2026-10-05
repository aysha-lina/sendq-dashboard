import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { billingApi } from '../../api/services';
import { useTranslation } from '../../i18n';

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

// Shown only while an admin is impersonating a customer ("Login as"). A vertical tab
// pinned to the right edge opens the Admin Area panel → "Back to Admin" restores the
// admin session and returns to the customers list.
export default function ImpersonationBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const stopImpersonating = useAuthStore((s) => s.stopImpersonating);
  const impersonating = typeof localStorage !== 'undefined' && !!localStorage.getItem('sendq_admin_token');
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!impersonating) return null;

  const name = user?.customer
    ? `${user.customer.first_name || ''} ${user.customer.last_name || ''}`.trim()
    : (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.email || 'customer'));

  const openPanel = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await billingApi.current();
      setInfo(data);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const backToAdmin = () => {
    stopImpersonating();
    setOpen(false);
    navigate('/admin/customers');
  };

  const sub = info?.subscription;

  return (
    <>
      <button type="button" className="imp-tab" onClick={openPanel} title={t('imp.admin_area', null, 'Admin Area')}>
        <span className="imp-tab-text">{t('imp.admin_area', null, 'Admin Area')}</span>
      </button>

      {open && (
        <div className="imp-backdrop" onClick={() => setOpen(false)}>
          <div className="imp-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="imp-close" onClick={() => setOpen(false)} aria-label={t('common.cancel', null, 'Close')}>✕</button>
            <h2 className="imp-title">{t('imp.admin_area', null, 'Admin Area')}</h2>

            <div className="imp-note">
              <span className="material-symbols-rounded">info</span>
              <span>{t('imp.logged_in_as', { name }, `You are currently logged in as ${name}`)}</span>
            </div>

            <h3 className="imp-sub-title">{t('imp.subscription', { name }, `${name}'s subscription`)}</h3>

            {loading ? (
              <p className="imp-loading">{t('common.loading', null, 'Loading…')}</p>
            ) : (
              <div className="imp-rows">
                <div className="imp-row"><span>{t('imp.plan_name', null, 'Plan name')}</span><strong>{info?.plan?.name || t('bil.free', null, 'Free')}</strong></div>
                <div className="imp-row"><span>{t('common.status', null, 'Status')}</span><span className="imp-badge">{String(sub?.status || 'active').toUpperCase()}</span></div>
                <div className="imp-row"><span>{t('imp.start_from', null, 'Start from')}</span><span>{fmtDate(sub?.starts_at || sub?.created_at)}</span></div>
                <div className="imp-row"><span>{t('imp.next_billing', null, 'Next billing date')}</span><span>{fmtDate(sub?.current_period_ends_at || sub?.ends_at)}</span></div>
              </div>
            )}

            <div className="imp-actions">
              <button type="button" className="btn-secondary imp-back" onClick={backToAdmin}>{t('imp.back_to_admin', null, 'Back to Admin')}</button>
              <button type="button" className="imp-link" onClick={() => setOpen(false)}>{t('common.cancel', null, 'Close')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
