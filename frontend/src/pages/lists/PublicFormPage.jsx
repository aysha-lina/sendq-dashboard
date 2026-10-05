import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listsApi } from '../../api/services';
import { normalizeContent } from './formSchema';
import { isHtmlContent } from './formHtml';
import FormRenderer from './FormRenderer';
import { useTranslation } from '../../i18n';

// Renders a GrapesJS-built form (HTML string). Intercepts submit and posts the
// named fields to the public subscribe endpoint.
const HtmlForm = ({ html, listUid }) => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const root = ref.current;
    const form = root?.querySelector('form');
    if (!form) return undefined;
    const onSubmit = async (e) => {
      e.preventDefault();
      setStatus('submitting'); setError('');
      const values = {};
      root.querySelectorAll('input[name], textarea[name], select[name]').forEach((el) => {
        if (el.type === 'checkbox') values[el.name] = el.checked ? (el.value || 'on') : '';
        else values[el.name] = el.value;
      });
      try {
        await listsApi.publicSubscribe({ list_uid: listUid, ...values });
        setStatus('done');
      } catch (err) {
        setError(err.response?.data?.message || t('pub.generic_error'));
        setStatus('error');
      }
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [html, listUid]);

  if (status === 'done') {
    return (
      <div style={{ background: '#fff', color: '#1a1a1a', padding: 28, borderRadius: 8, textAlign: 'center' }}>
        <p style={{ fontSize: 18, margin: 0 }}>✅ {t('pub.thanks_subscribing')}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {status === 'submitting' && <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{t('pub.submitting')}</p>}
      {error && <p style={{ color: '#e0414b', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{error}</p>}
    </>
  );
};

// Standalone, unauthenticated hosted subscribe form at /forms/:formUid.
const PublicFormPage = () => {
  const { t } = useTranslation();
  const { formUid } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listsApi.getPublicForm(formUid)
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.message || t('pub.form_unavailable')))
      .finally(() => setLoading(false));
  }, [formUid]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f4f6f9', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {loading ? (
          <p style={{ color: '#b9b9c4', textAlign: 'center' }}>{t('common.loading')}</p>
        ) : error ? (
          <p style={{ color: '#e0414b', textAlign: 'center' }}>{error}</p>
        ) : (
          isHtmlContent(data.form.content)
            ? <HtmlForm html={data.form.content} listUid={data.list.uid} />
            : <FormRenderer content={normalizeContent(data.form.content)} listUid={data.list.uid} live />
        )}
        <p style={{ color: '#55556a', textAlign: 'center', marginTop: 16, fontSize: 12 }}>{t('pub.powered_by')}</p>
      </div>
    </div>
  );
};

export default PublicFormPage;
