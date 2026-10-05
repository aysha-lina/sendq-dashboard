import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { listsApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import ImportWizard from './ImportWizard';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const downloadCsv = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadSubscribersCsv = async () => {
  const { data } = await listsApi.list({ page: 1, per_page: 1 });
  const list = data.data?.[0];
  if (!list?.uid) {
    downloadCsv(new Blob(['email,first_name,last_name,status,created_at\n'], { type: 'text/csv;charset=utf-8' }), 'subscribers.csv');
    return;
  }
  const response = await listsApi.exportSubscribers(list.uid);
  downloadCsv(response.data, `${list.uid}-subscribers.csv`);
};

// `label` is the stable English matching key (callers pass it via `activeLabel`); `tKey`
// is the i18n key for the DISPLAYED text. Menu items use `tKey` for their visible label.
const tabs = [
  { label: 'Overview', tKey: 'ld.tab_overview', to: '/lists/detail-overview', icon: 'auto_graph' },
  { label: 'Settings', tKey: 'ld.tab_settings', to: '/lists/settings', icon: 'settings' },
  {
    label: 'Subscribers',
    tKey: 'common.subscribers',
    to: '/lists/contacts',
    icon: 'people',
    menu: [
      { label: 'View all', tKey: 'ld.menu_view_all', to: '/lists/contacts', icon: 'format_list_bulleted' },
      { label: 'Add', tKey: 'ld.menu_add', to: '/lists/contacts?action=add-subscriber', icon: 'add' },
      { label: 'Import', tKey: 'ld.menu_import', action: 'import', icon: 'file_upload' },
      { label: 'Export', tKey: 'ld.menu_export', action: 'export', icon: 'file_download' },
    ],
  },
  {
    label: 'Segments',
    tKey: 'ld.tab_segments',
    to: '/lists/segments',
    icon: 'splitscreen',
    menu: [
      { label: 'View all', tKey: 'ld.menu_view_all', to: '/lists/segments', icon: 'format_list_bulleted' },
      { label: 'Add', tKey: 'ld.menu_add', to: '/lists/segments?action=create-segment', icon: 'add' },
    ],
  },
  {
    label: 'Forms / Pages',
    tKey: 'ld.tab_forms_pages',
    to: '/lists/forms',
    icon: 'web',
    wide: true,
    menu: [
      { label: 'Embedded form', tKey: 'ld.menu_embedded_form', to: '/lists/forms', icon: 'dashboard' },
      { label: 'Subscribe', tKey: 'ld.menu_subscribe', heading: true, icon: 'add_task' },
      { label: 'Sign-up form', tKey: 'ld.menu_signup_form', to: '/lists/forms/create?type=sign_up_form' },
      { label: 'Sign-up "Thank you" page', tKey: 'ld.menu_signup_thankyou_page', to: '/lists/forms/create?type=sign_up_thankyou_page' },
      { label: 'Sign-up confirmation email', tKey: 'ld.menu_signup_confirmation_email', to: '/lists/forms/create?type=sign_up_confirmation_email' },
      { label: 'Confirmation "Thank you" page', tKey: 'ld.menu_confirmation_thankyou_page', to: '/lists/forms/create?type=sign_up_confirmation_thankyou' },
      { label: 'Final "Welcome" email', tKey: 'ld.menu_welcome_email', to: '/lists/forms/create?type=sign_up_welcome_email' },
      { label: 'Unsubscribe', tKey: 'ld.menu_unsubscribe', heading: true, icon: 'logout' },
      { label: 'Unsubscribe form', tKey: 'ld.menu_unsubscribe_form', to: '/lists/forms/create?type=unsubscribe_form' },
      { label: 'Unsubscribe success page', tKey: 'ld.menu_unsubscribe_success_page', to: '/lists/forms/create?type=unsubscribe_success_page' },
      { label: 'Unsubscribe "Goodbye" email', tKey: 'ld.menu_unsubscribe_goodbye_email', to: '/lists/forms/create?type=unsubscribe_goodbye_email' },
      { label: 'Update profile', tKey: 'ld.menu_update_profile', heading: true, icon: 'person_outline' },
      { label: 'Update profile email sent', tKey: 'ld.menu_update_profile_email_sent', to: '/lists/forms/create?type=profile_update_email_sent' },
      { label: 'Update profile email', tKey: 'ld.menu_update_profile_email', to: '/lists/forms/create?type=profile_update_email' },
      { label: 'Update profile form', tKey: 'ld.menu_update_profile_form', to: '/lists/forms/create?type=profile_update_form' },
      { label: 'Update profile success page', tKey: 'ld.menu_update_profile_success_page', to: '/lists/forms/create?type=profile_update_success_page' },
    ],
  },
  { label: 'Manage list fields', tKey: 'ld.tab_manage_fields', to: '/lists/fields', icon: 'fact_check' },
  { label: 'Email verification', tKey: 'ld.tab_email_verification', to: '/lists/email-verification', icon: 'mark_email_read' },
];

const ListDetailTabs = ({ activeLabel, overviewTo = '/lists/detail-overview' }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const [menuRect, setMenuRect] = useState(null);
  const [currentList, setCurrentList] = useState(null);
  const [wizard, setWizard] = useState(null); // { csv, preview }
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const detailTabs = tabs.map((tab) => (tab.label === 'Overview' ? { ...tab, to: overviewTo } : tab));

  // Position a fixed-positioned dropdown under its tab so the horizontally-scrollable
  // tab strip (overflow-x-auto) doesn't clip it into a tiny scrollable box.
  const openMenuAt = (tab, event) => {
    const container = event.currentTarget.closest('.list-tab') || event.currentTarget;
    const rect = container.getBoundingClientRect();
    const width = tab.wide ? 324 : 200;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setMenuRect({ left, top: rect.bottom + 2, width });
    setOpenMenu(tab.label);
  };

  useEffect(() => {
    let mounted = true;
    listsApi.list({ page: 1, per_page: 1 })
      .then(({ data }) => {
        if (mounted) setCurrentList(data.data?.[0] || null);
      })
      .catch(() => {
        if (mounted) setCurrentList(null);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!openMenu) return undefined;
    const close = (event) => {
      if (wrapperRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpenMenu(null);
    };
    const dismiss = () => setOpenMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [openMenu]);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname, location.search]);

  const runMenuItem = (item) => {
    if (item.heading) return;
    if (item.to) {
      navigate(item.to);
      return;
    }
    if (item.action === 'import') fileInputRef.current?.click();
    if (item.action === 'export') {
      downloadSubscribersCsv().catch(() => {
        downloadCsv(new Blob(['email,first_name,last_name,status,created_at\n'], { type: 'text/csv;charset=utf-8' }), 'subscribers.csv');
      });
    }
    setOpenMenu(null);
  };

  // Read the CSV, fetch a column preview, and open the mapping wizard.
  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!currentList?.uid) { toast.error(t('ld.no_list_to_import')); return; }
    try {
      const csv = await file.text();
      const { data: preview } = await listsApi.importSubscribersPreview(currentList.uid, { csv });
      setWizard({ csv, preview });
    } catch (err) {
      toast.error(err.response?.data?.message || t('ld.import_failed'));
    }
  };

  // Called by the wizard once the mapped import completes.
  const onImported = (data) => {
    if (data?.queued) {
      toast.success(t('ld.import_queued', { total: data.total }));
    } else {
      const created = data?.created ?? 0;
      const updated = data?.updated ?? 0;
      const failed = data?.errors?.length || 0;
      if (created === 0 && updated === 0 && failed > 0) {
        const reason = data.errors[0]?.message || t('ld.import_email_column_hint');
        toast.error(t('ld.import_nothing', { failed, reason }));
      } else {
        toast.success(failed
          ? t('ld.import_done_skipped', { created, updated, failed })
          : t('ld.import_done', { created, updated }));
      }
    }
    // Bump a query token so the contacts list refetches even if we're already on it.
    navigate(`/lists/contacts?imported=${Date.now()}`);
  };

  return (
    <div ref={wrapperRef} className="relative mb-10 w-full border-b border-[#555467]">
      <input ref={fileInputRef} type="file" accept=".csv,.txt" className="sr-only" onChange={importCsv} />
      {wizard && (
        <ImportWizard
          listUid={currentList?.uid}
          csv={wizard.csv}
          preview={wizard.preview}
          onClose={() => setWizard(null)}
          onImported={onImported}
        />
      )}
      <div className="flex flex-nowrap items-end gap-x-10 overflow-x-auto">
        {detailTabs.map((tab) => {
          const isActive = activeLabel ? activeLabel === tab.label : location.pathname === tab.to;
          const isOpen = openMenu === tab.label;

          return (
            <div
              key={tab.label}
              className={`list-tab relative flex h-12 shrink-0 items-center border-b-2 ${
                isActive || isOpen ? 'border-[#1aa0b8]' : 'border-transparent'
              }`}
            >
              <NavLink
                to={tab.to}
                className="flex h-full items-center gap-2 whitespace-nowrap text-[18px] font-normal text-[#c7c6d2] hover:text-white"
              >
                <MaterialIcon name={tab.icon} className="text-[21px]" />
                <span>{t(tab.tKey)}</span>
              </NavLink>

              {tab.menu && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    if (openMenu === tab.label) setOpenMenu(null);
                    else openMenuAt(tab, event);
                  }}
                  className="ml-2 inline-flex h-full items-center text-[18px] leading-none text-[#8f90a0] hover:text-white"
                  aria-label={t('ld.tab_menu_aria', { tab: t(tab.tKey) })}
                  aria-expanded={isOpen}
                >
                  <span className={`sendq-nav-arrow-icon inline-block ${isOpen ? 'is-open' : ''}`}>›</span>
                </button>
              )}

              {isOpen && menuRect && createPortal(
                <div
                  ref={menuRef}
                  style={{ position: 'fixed', left: menuRect.left, top: menuRect.top, width: menuRect.width, zIndex: 1000 }}
                  className="rounded-md border border-[#444459] bg-[#19192f] py-1 shadow-2xl"
                >
                  {tab.menu.map((item) => (
                    <button
                      key={`${tab.label}-${item.label}`}
                      type="button"
                      onClick={() => runMenuItem(item)}
                      className={`flex w-full items-center gap-3 px-5 text-left text-[18px] text-white hover:bg-[#28283e] ${
                        item.heading ? 'border-y border-[#2e2e43] py-3 font-semibold' : 'py-3 font-normal'
                      }`}
                    >
                      {item.icon && <MaterialIcon name={item.icon} className="text-[21px] text-[#d2d3dc]" />}
                      <span>{t(item.tKey)}</span>
                    </button>
                  ))}
                </div>,
                document.querySelector('main') || document.body,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ListDetailTabs;
