import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n/index.jsx';

const MaterialIcon = ({ name, className = '' }) => (
  <span className={`material-symbols-rounded ${className}`}>{name}</span>
);

const TemplateCard = ({ wide }) => {
  const { t } = useTranslation();
  return (
    <button className="h-[218px] rounded-md bg-white text-left text-black shadow-sm transition-transform hover:-translate-y-0.5" type="button">
      <div className={wide ? 'h-16 bg-[#d9d5cd]' : 'float-right h-full w-[32%] bg-[#d9d5cd]'} />
      <div className="p-8">
        <h3 className="mb-5 text-xl leading-6">{t('frm.preview_title')}</h3>
        <label className="text-xs">{t('frm.email_address')}</label>
        <div className="mt-1 h-7 rounded border border-[#bfbfbf]" />
        <div className="mt-4 h-7 w-24 rounded bg-[#292929] text-center text-xs leading-7 text-white">{t('frm.sign_up')}</div>
      </div>
    </button>
  );
};

const CreateFormPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lists, setLists] = useState([]);
  const [name, setName] = useState(t('frm.untitled_form'));
  const [selectedList, setSelectedList] = useState('');
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    listsApi.list({ page: 1, per_page: 100 })
      .then(({ data }) => {
        const nextLists = data.data || [];
        setLists(nextLists);
        setSelectedList(nextLists[0]?.uid || '');
      })
      .catch(() => setLists([]));
  }, []);

  const startDesign = async () => {
    if (!selectedList || !name.trim()) return;
    setMessage('');
    try {
      const { data } = await listsApi.createForm(selectedList, {
        name: name.trim(),
        type: searchParams.get('type') || 'embedded_form',
        content: {},
      });
      // Jump straight into the builder for the new form.
      navigate(`/lists/forms/${selectedList}/${data.uid}/edit`);
    } catch (error) {
      setMessage(error.response?.data?.message || t('frm.create_failed'));
    }
  };

  return (
    <AppLayout>
      <div className="sq-page px-8 py-5">
        <p className="mb-8 text-lg font-normal">{t('common.home')} &gt; {t('frm.forms_popups')}</p>
        <h1 className="sq-section-title mb-16 flex items-center gap-5 text-[40px]">
          <MaterialIcon name="add" className="text-[40px]" /> {t('frm.create_form')}
        </h1>

        <div className="mb-8 max-w-[724px]">
          <label className="label text-lg text-white">{t('frm.enter_form_name')} <span className="text-[#e0414b]">*</span></label>
          <input className="input h-11 text-lg" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="mb-20 max-w-[724px]">
          <label className="label text-lg text-white">{t('frm.select_mail_list')} <span className="text-[#e0414b]">*</span></label>
          <select className="input h-11 text-lg" value={selectedList} onChange={(event) => setSelectedList(event.target.value)}>
            <option value="">--</option>
            {lists.map((list) => (
              <option key={list.uid} value={list.uid}>{list.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <h2 className="sq-section-title text-[30px]">{t('frm.select_base_template')}</h2>
          <button className="btn-primary h-11 text-lg font-normal" type="button" onClick={startDesign} disabled={!selectedList || !name.trim()}>{t('frm.start_design')}</button>
        </div>
        {message && <p className="mb-5 text-lg text-[#bfc0ca]">{message}</p>}

        <h3 className="mb-6 border-b border-[#303044] pb-6 text-[34px] font-normal text-[rgba(197,192,142,0.22)]">{t('frm.default')}</h3>

        <div className="mb-9 flex flex-wrap items-center gap-3">
          <span className="text-lg font-normal text-[#b9b9c4]">{t('frm.sort_by')}</span>
          <select className="input h-11 max-w-[106px] text-lg"><option>{t('frm.default')}</option></select>
          <button className="btn-secondary h-11 w-11 px-0" type="button"><MaterialIcon name="sort" className="text-[22px]" /></button>
          <div className="relative">
            <input className="input h-11 w-[250px] pr-10 text-lg" placeholder={t('frm.type_to_search')} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <MaterialIcon name="search" className="absolute right-3 top-2.5 text-[22px] text-[#b9b9c4]" />
          </div>
        </div>

        <div className="grid gap-14 md:grid-cols-2 xl:grid-cols-4">
          <TemplateCard />
          <TemplateCard />
          <TemplateCard wide />
          <TemplateCard wide />
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateFormPage;
