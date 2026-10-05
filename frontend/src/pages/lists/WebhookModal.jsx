import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.jsx';

const Icon = ({ children, className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    {children}
  </svg>
);

const fields = [
  { labelKey: 'frm.field_email', key: 'EMAIL', value: 'EMAIL' },
  { labelKey: 'frm.field_first_name', key: 'FIRST_NAME', value: 'FIRST_NAME' },
  { labelKey: 'frm.field_last_name', key: 'LAST_NAME', value: 'LAST_NAME' },
  { labelKey: 'frm.field_tag', key: 'TAG', value: 'TAG' },
];

const WebhookModal = ({ onClose, listUid }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('json');
  const [selectedFields, setSelectedFields] = useState(fields.map((field) => field.key));
  const [copyMessage, setCopyMessage] = useState('');

  const endpoint = `${window.location.origin}/api/v1/public/subscribers`;
  const uid = listUid || 'YOUR_LIST_UID';

  const payload = useMemo(() => {
    const fieldPayload = selectedFields.reduce((result, key) => {
      const field = fields.find((item) => item.key === key);
      if (field) result[field.key] = field.value;
      return result;
    }, {});

    return {
      list_uid: uid,
      ...fieldPayload,
    };
  }, [selectedFields, uid]);

  const curl = useMemo(() => {
    if (mode === 'json') {
      return [
        `curl -X POST ${endpoint} \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '${JSON.stringify(payload)}'`,
      ].join('\n');
    }

    const dataLines = Object.entries(payload).map(([key, value], index, items) => {
      const suffix = index === items.length - 1 ? '' : ' \\';
      return `  -d ${key}='${value}'${suffix}`;
    });

    return [
      `curl -X POST ${endpoint} \\`,
      `  -H 'Content-Type: application/x-www-form-urlencoded' \\`,
      ...dataLines,
    ].join('\n');
  }, [endpoint, mode, payload]);

  const copyText = async (value, label) => {
    await navigator.clipboard?.writeText(value);
    setCopyMessage(t('frm.copied', { label }));
    window.setTimeout(() => setCopyMessage(''), 1600);
  };

  const toggleField = (key) => {
    setSelectedFields((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 px-4 py-5">
      <div className="mx-auto flex max-h-[92vh] max-w-[1424px] flex-col overflow-hidden rounded-md bg-[#1b1b31] shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-[#45445a] px-5">
          <button className="text-[#0c85a3]" onClick={onClose} title={t('common.back')}>
            <Icon className="h-7 w-7"><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>
          </button>
          <button className="text-[#9b9ca8]" onClick={onClose} title={t('frm.close')}>
            <Icon className="h-8 w-8"><path d="M18 6 6 18M6 6l12 12" /></Icon>
          </button>
        </div>

        <div className="overflow-y-auto px-8 py-10 lg:px-14">
          <h2 className="sq-section-title mb-6 text-[36px]">{t('frm.webhook_integration')}</h2>
          <p className="mb-9 max-w-[1280px] text-xl font-semibold leading-relaxed text-[#d8d8e4]">
            {t('frm.webhook_intro', { contentType: mode === 'json' ? 'application/json' : 'application/x-www-form-urlencoded' })}
          </p>

          <div className="mb-6 flex gap-8 border-b border-[#555467]">
            <button
              className={`flex items-center gap-2 border-b-2 pb-4 text-lg font-bold ${
                mode === 'json' ? 'border-[#1aa0b8] text-white' : 'border-transparent text-[#aaaab6]'
              }`}
              onClick={() => setMode('json')}
            >
              <span>{'{ }'}</span>
              {t('frm.json_post')}
            </button>
            <button
              className={`flex items-center gap-2 border-b-2 pb-4 text-lg font-bold ${
                mode === 'form' ? 'border-[#1aa0b8] text-white' : 'border-transparent text-[#aaaab6]'
              }`}
              onClick={() => setMode('form')}
            >
              <Icon><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></Icon>
              {t('frm.form_post')}
            </button>
          </div>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section>
              <h3 className="mb-6 text-xl font-bold text-[#d8d8e4]">
                {t('frm.webhook_get_data')}
              </h3>

              <div className="mb-9 flex gap-3">
                <input className="input h-11 text-lg" value={endpoint} readOnly />
                <button className="btn-primary h-11 px-5 text-lg" onClick={() => copyText(endpoint, t('frm.endpoint'))}>{t('frm.copy')}</button>
              </div>

              <h3 className="mb-5 text-xl font-bold text-[#d8d8e4]">{t('frm.curl_example')}</h3>

              <div className="overflow-hidden border border-[#5b5b70] bg-[#28283d]">
                <div className="border-b border-[#404055] px-5 py-4 text-lg font-bold text-[#d8d8e4]">
                  {t('frm.posting_with_curl', { format: mode === 'json' ? 'JSON' : 'FORM' })}
                </div>
                <pre className="max-h-[190px] overflow-auto px-5 py-4 text-sm font-semibold leading-6 text-white">
                  {curl}
                </pre>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <button className="btn-primary h-11 px-5 text-lg" onClick={() => copyText(curl, t('frm.curl'))}>{t('frm.copy')}</button>
                {copyMessage && <span className="text-lg font-semibold text-[#bfc0ca]">{copyMessage}</span>}
              </div>
            </section>

            <aside>
              <h3 className="mb-7 text-xl font-bold leading-relaxed text-[#d8d8e4]">
                {t('frm.available_fields')}
              </h3>
              <div className="flex flex-wrap gap-3">
                {fields.map((field) => {
                  const selected = selectedFields.includes(field.key);
                  return (
                    <button
                      key={field.key}
                      className={`rounded-full px-5 py-3 text-lg font-bold transition-colors ${
                        selected ? 'bg-[#5c5c70] text-white' : 'bg-[#343449] text-[#aaaab6]'
                      }`}
                      onClick={() => toggleField(field.key)}
                    >
                      {t(field.labelKey)}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookModal;
