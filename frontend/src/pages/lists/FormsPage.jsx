import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner, toast } from '../../components/ui';
import { listsApi } from '../../api/services';
import useClickOutside from '../../hooks/useClickOutside';
import { useTranslation } from '../../i18n/index.jsx';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

// Mini wireframe preview shown in the thumbnail cell (mirrors the PHP form thumb).
const FormThumb = () => {
  const { t } = useTranslation();
  return (
    <div className="form-thumb-mock">
      <span className="ftm-title">{t('frm.preview_title')}</span>
      <span className="ftm-label">{t('frm.email_address')}</span>
      <span className="ftm-input" />
      <span className="ftm-btn">{t('frm.sign_up')}</span>
      <span className="ftm-foot">{t('frm.powered_by')}</span>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const s = (status || 'draft').toLowerCase();
  return <span className={`form-status-badge form-status-${s}`}>{s}</span>;
};

const RowMenu = ({ form, onDelete }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-secondary forms-caret" onClick={() => setOpen((v) => !v)} aria-label={t('frm.more')}>⌄</button>
      {open && (
        <div className="forms-row-dropdown">
          <button type="button" onClick={() => { setOpen(false); window.open(`/forms/${form.uid}`, '_blank'); }}>
            <MaterialIcon name="launch" /> {t('frm.view_on_site')}
          </button>
          <button type="button" onClick={() => { setOpen(false); onDelete(form); }}>
            <MaterialIcon name="delete_outline" /> {t('common.delete')}
          </button>
        </div>
      )}
    </div>
  );
};

const PER_PAGE_OPTIONS = [15, 30, 50, 100];

const FormsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [perPage, setPerPage] = useState(15);
  const [page, setPage] = useState(1);

  // Load every list, then pull each list's forms and merge into one collection.
  const loadForms = async () => {
    setLoading(true);
    try {
      const { data } = await listsApi.list({ page: 1, per_page: 100 });
      const allLists = data.data || [];
      setLists(allLists);
      const perList = await Promise.all(
        allLists.map((l) =>
          listsApi.forms(l.uid)
            .then(({ data: fd }) => (fd.data || []).map((f) => ({ ...f, listUid: l.uid, listName: l.name })))
            .catch(() => []),
        ),
      );
      setForms(perList.flat());
    } catch {
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadForms(); }, []);

  const visible = useMemo(() => {
    let rows = forms;
    if (selectedList) rows = rows.filter((f) => f.listUid === selectedList);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      rows = rows.filter((f) => (f.name || '').toLowerCase().includes(kw) || (f.listName || '').toLowerCase().includes(kw));
    }
    rows = [...rows].sort((a, b) => {
      const av = sortOrder === 'name' ? (a.name || '') : (a.created_at || '');
      const bv = sortOrder === 'name' ? (b.name || '') : (b.created_at || '');
      const cmp = String(av).localeCompare(String(bv));
      return sortDirection === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [forms, selectedList, keyword, sortOrder, sortDirection]);

  const total = visible.length;
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const currentPage = Math.min(page, totalPages);
  const pageRows = visible.slice((currentPage - 1) * perPage, currentPage * perPage);
  const fromN = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const toN = Math.min(currentPage * perPage, total);

  useEffect(() => { setPage(1); }, [selectedList, keyword, perPage, sortOrder, sortDirection]);

  const openBuilder = (form) => navigate(`/lists/forms/${form.listUid}/${form.uid}/edit`);

  const togglePublish = async (form) => {
    const publish = (form.status || '').toLowerCase() !== 'active';
    try {
      await listsApi.updateForm(form.listUid, form.uid, { status: publish ? 'active' : 'draft' });
      toast.success(publish ? t('frm.form_published') : t('frm.form_unpublished'));
      loadForms();
    } catch (err) {
      toast.error(err.response?.data?.message || t('frm.update_failed'));
    }
  };

  const deleteForm = async (form) => {
    if (!window.confirm(t('frm.delete_confirm', { name: form.name }))) return;
    try {
      await listsApi.deleteForm(form.listUid, form.uid);
      toast.success(t('frm.form_deleted'));
      loadForms();
    } catch (err) {
      toast.error(err.response?.data?.message || t('frm.delete_failed'));
    }
  };

  return (
    <AppLayout>
      <div className="sq-page forms-page px-8 py-6 lg:px-14">
        <p className="mb-4 text-lg font-normal">{t('common.home')}</p>
        <h1 className="sq-section-title mb-12 flex items-center gap-4 text-[40px]">
          <MaterialIcon name="format_list_bulleted" className="text-[40px]" /> {t('frm.forms_popups')}
        </h1>

        <div className="forms-filter-bar">
          <input type="checkbox" className="forms-check" />
          <span className="forms-filter-label">{t('frm.sort_by')}</span>
          <select className="input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="created_at">{t('frm.created_at')}</option>
            <option value="name">{t('common.name')}</option>
          </select>
          <button type="button" className="btn-secondary forms-sortdir" title={t('frm.change_sort_direction')} onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}>
            <MaterialIcon name="sort" />
          </button>
          <span className="forms-filter-label">{t('frm.from')}</span>
          <select className="input" value={selectedList} onChange={(e) => setSelectedList(e.target.value)}>
            <option value="">{t('frm.all_mail_lists')}</option>
            {lists.map((l) => <option key={l.uid} value={l.uid}>{l.name}</option>)}
          </select>
          <span className="forms-filter-label">{t('frm.site')}</span>
          <select className="input" disabled title={t('frm.no_connected_sites')}>
            <option>{t('frm.all_sites')}</option>
          </select>
          <div className="forms-search">
            <input className="input" placeholder={t('frm.type_to_search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <MaterialIcon name="search" />
          </div>
          <button type="button" className="btn-secondary forms-create" onClick={() => navigate('/lists/forms/create')}>
            <MaterialIcon name="add" /> {t('frm.create_form')}
          </button>
        </div>

        <div className="forms-table">
          {loading ? (
            <div className="forms-empty"><Spinner size="lg" /></div>
          ) : pageRows.length === 0 ? (
            <div className="forms-empty">
              <MaterialIcon name="auto_awesome" className="forms-empty-icon" />
              <p>{keyword || selectedList ? t('frm.no_matching_forms') : t('frm.no_forms_yet')}</p>
            </div>
          ) : (
            pageRows.map((form) => (
              <div key={form.uid} className="forms-row">
                <input type="checkbox" className="forms-check" />
                <button type="button" className="forms-thumb-link" onClick={() => window.open(`/forms/${form.uid}`, '_blank')} title={t('frm.preview')}>
                  <FormThumb />
                </button>
                <div className="forms-name-cell">
                  <button type="button" className="forms-name" onClick={() => openBuilder(form)}>{form.name || t('frm.untitled_form')}</button>
                  <span className="forms-list">{form.listName || form.type}</span>
                </div>
                <div className="forms-site-cell">
                  <span className="forms-site">--</span>
                  <span className="forms-site-label">{t('frm.connected_site')}</span>
                </div>
                <div className="forms-status-cell">
                  <StatusBadge status={form.status} />
                </div>
                <div className="forms-actions">
                  <button type="button" className="forms-builder" onClick={() => openBuilder(form)}>
                    <MaterialIcon name="handyman" /> {t('frm.builder')}
                  </button>
                  <button type="button" className="btn-secondary forms-publish" onClick={() => togglePublish(form)}>
                    <MaterialIcon name={(form.status || '').toLowerCase() === 'active' ? 'do_disturb_on' : 'task_alt'} />
                    {(form.status || '').toLowerCase() === 'active' ? t('frm.unpublish') : t('frm.publish')}
                  </button>
                  <button type="button" className="btn-secondary forms-preview" onClick={() => window.open(`/forms/${form.uid}`, '_blank')} title={t('frm.preview')}>
                    <MaterialIcon name="zoom_in" />
                  </button>
                  <RowMenu form={form} onDelete={deleteForm} />
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && (
          <div className="forms-footer">
            <select className="input forms-perpage" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
              {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="forms-footer-text">
              {t('frm.items_per_page')}&nbsp; | &nbsp;{t('frm.records_range', { from: fromN, to: toN, total })}
            </span>
            <div className="forms-pager">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>{t('frm.prev')}</button>
              <span>{t('frm.page_of', { current: currentPage, total: totalPages })}</span>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default FormsPage;
