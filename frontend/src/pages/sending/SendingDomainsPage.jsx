import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { sendingDomainsApi } from '../../api/services';
import { useTranslation } from '../../i18n';

export const formatSendingDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (part) => `${part}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const MaterialIcon = ({ children, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{children}</span>
);

const SendingHeader = () => {
  const { t } = useTranslation();
  return (
    <header className="sending-page-title">
      <nav>
        <span>{t('common.home')}</span>
        <span>&gt;</span>
        <span>{t('snd.domains')}</span>
      </nav>
      <h1>{t('snd.sending_identity')}</h1>
    </header>
  );
};

export const SendingDomainsTab = () => {
  const { t } = useTranslation();
  return (
    <div className="sending-tabs">
      <button type="button" className="active">
        <MaterialIcon>alternate_email</MaterialIcon>
        <span>{t('snd.domains')}</span>
      </button>
    </div>
  );
};

const SendingDomainStatus = ({ verified }) => {
  const { t } = useTranslation();
  return (
    <span className={verified ? 'sending-status sending-status-active' : 'sending-status'}>
      {verified ? t('snd.active') : t('snd.inactive')}
    </span>
  );
};

const VerifyCell = ({ label, verified }) => (
  <div className="sending-verification-cell">
    <MaterialIcon className={verified ? 'sending-ok' : 'sending-blocked'}>
      {verified ? 'task_alt' : 'not_interested'}
    </MaterialIcon>
    <span>{label}</span>
  </div>
);

const EmptyDomains = () => {
  const { t } = useTranslation();
  return (
    <div className="sending-empty-list">
      <MaterialIcon>public</MaterialIcon>
      <p>{t('snd.no_sending_domains')}</p>
    </div>
  );
};

const SendingDomainsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [dir, setDir] = useState('desc');
  const [selected, setSelected] = useState(() => new Set());
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    sendingDomainsApi.list()
      .then(({ data }) => setDomains(data.data || []))
      .catch(() => setDomains([]))
      .finally(() => setLoading(false));
  }, []);

  // Close the open row menu when clicking outside any row menu.
  useEffect(() => {
    if (openMenuId === null) return undefined;
    const onPointerDown = (event) => {
      if (!event.target.closest('.sending-row-menu')) setOpenMenuId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openMenuId]);

  const visibleDomains = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    let v = term ? domains.filter((domain) => domain.name?.toLowerCase().includes(term)) : domains;
    v = [...v].sort((a, b) => {
      const av = String((sort === 'name' ? a.name : a[sort]) || a.createdAt || '');
      const bv = String((sort === 'name' ? b.name : b[sort]) || b.createdAt || '');
      const cmp = av.localeCompare(bv);
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [domains, keyword, sort, dir]);

  const allSel = visibleDomains.length > 0 && visibleDomains.every((d) => selected.has(d.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(visibleDomains.map((d) => d.id)));
  const toggleRow = (id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const deleteDomain = async (domainId) => {
    if (!window.confirm(t('snd.confirm_delete_domain'))) return;
    try {
      await sendingDomainsApi.delete(domainId);
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
    } catch {}
    setOpenMenuId(null);
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(t('snd.confirm_delete_selected_domains', { count: ids.length }))) return;
    await Promise.allSettled(ids.map((id) => sendingDomainsApi.delete(id)));
    setDomains((prev) => prev.filter((d) => !selected.has(d.id)));
    setSelected(new Set());
  };

  return (
    <AppLayout>
      <div className="sending-page">
        <SendingHeader />
        <SendingDomainsTab />

        <section className="sending-intro">
          <h2>{t('snd.domains')}</h2>
          <p>
            {t('snd.sending_domain_intro_pre')}{' '}
            <span>{t('snd.from')}</span> {t('snd.sending_domain_intro_post')}
          </p>
        </section>

        <form className="sending-listing-form" onSubmit={(event) => event.preventDefault()}>
          <div className="sending-top-controls">
            <div className="sending-filter-box">
              <label className="sending-checkbox">
                <input type="checkbox" checked={allSel} onChange={toggleAll} />
              </label>
              <span className="sending-filter-title">{t('common.sort_by')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="createdAt">{t('common.created_at')}</option>
                <option value="name">{t('common.name')}</option>
                <option value="updatedAt">{t('common.updated_at')}</option>
              </select>
              <button type="button" className="sending-sort-button" title={t('snd.sort')} onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
                <MaterialIcon>sort</MaterialIcon>
              </button>
              {selected.size > 0 && (
                <button type="button" className="btn-danger" onClick={deleteSelected} style={{ marginLeft: 8 }}>
                  <MaterialIcon>delete_outline</MaterialIcon> {t('snd.delete_count', { count: selected.size })}
                </button>
              )}
              <label className="sending-search">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t('common.type_to_search')}
                />
                <MaterialIcon>search</MaterialIcon>
              </label>
            </div>
            <button type="button" onClick={() => navigate('/sending/domains/new')} className="btn-primary sending-create-button">
              <MaterialIcon>add</MaterialIcon>
              {t('snd.new_sending_domain')}
            </button>
          </div>

          {loading ? (
            <div className="sending-empty-list">
              <p>{t('common.loading')}</p>
            </div>
          ) : visibleDomains.length === 0 ? (
            <EmptyDomains />
          ) : (
            <table className="sending-table">
              <tbody>
                {visibleDomains.map((domain) => (
                  <tr key={domain.id}>
                    <td className="sending-check-cell">
                      <label className="sending-checkbox">
                        <input type="checkbox" checked={selected.has(domain.id)} onChange={() => toggleRow(domain.id)} />
                      </label>
                    </td>
                    <td className="sending-name-cell">
                      <button type="button" onClick={() => navigate(`/sending/domains/${domain.id}`)} className="sending-title-link">
                        {domain.name}
                      </button>
                      <span className="sending-muted">{t('snd.created_at_label')} {formatSendingDate(domain.createdAt)}</span>
                    </td>
                    <td><VerifyCell label={t('snd.domain_verification')} verified={domain.identityVerified} /></td>
                    <td><VerifyCell label={t('snd.spf_verification')} verified={domain.spfVerified} /></td>
                    <td><VerifyCell label={t('snd.dkim_verification', null, 'DKIM')} verified={domain.dkimVerified} /></td>
                    <td><VerifyCell label={t('snd.dmarc_verification', null, 'DMARC')} verified={domain.dmarcVerified} /></td>
                    <td><SendingDomainStatus verified={domain.identityVerified && domain.spfVerified} /></td>
                    <td className="sending-actions-cell">
                      <div className="sending-actions">
                        <button type="button" onClick={() => navigate(`/sending/domains/${domain.id}`)} className="btn-primary">
                          {t('snd.view')}
                        </button>
                        <div className="sending-row-menu">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId((current) => (current === domain.id ? null : domain.id))}
                            className="sending-caret-button"
                            aria-label={t('snd.more_actions_for', { name: domain.name })}
                          >
                            ⌄
                          </button>
                          {openMenuId === domain.id && (
                            <div className="sending-dropdown-menu">
                              <button type="button" onClick={() => deleteDomain(domain.id)}>
                                <MaterialIcon>delete</MaterialIcon>
                                {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </form>

        <div className="sending-pagination-row">
          <select>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <span>{t('snd.items_per_page')} | {t('snd.pagination_range', { from: visibleDomains.length ? 1 : 0, to: visibleDomains.length, total: visibleDomains.length })}</span>
          <span>{t('snd.page_of', { current: 1, total: 1 })}</span>
        </div>

        <footer className="sending-footer">{t('common.copyright')}</footer>
      </div>
    </AppLayout>
  );
};

export default SendingDomainsPage;
