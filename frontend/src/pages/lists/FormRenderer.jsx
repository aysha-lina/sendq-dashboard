import { useState } from 'react';
import { listsApi } from '../../api/services';
import { useTranslation } from '../../i18n/index.jsx';

// Renders a subscribe form from builder content. When `live` + `listUid` are set
// it actually submits to the public subscribe endpoint; otherwise it's a preview.
const FormRenderer = ({ content, listUid, live = false }) => {
  const { t } = useTranslation();
  const theme = content.theme || {};
  const enabledFields = (content.fields || []).filter((f) => f.enabled);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [error, setError] = useState('');

  const setField = (tag, v) => setValues((prev) => ({ ...prev, [tag]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!live) return;
    setStatus('submitting');
    setError('');
    try {
      await listsApi.publicSubscribe({ list_uid: listUid, ...values });
      setStatus('done');
    } catch (err) {
      setError(err.response?.data?.message || t('frm.something_went_wrong'));
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div style={{ background: theme.background, color: theme.text, padding: 28, borderRadius: 8, textAlign: 'center' }}>
        <p style={{ fontSize: 18, margin: 0 }}>{content.successMessage || t('frm.thanks_subscribing')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: theme.background, color: theme.text, padding: 28, borderRadius: 8 }}>
      {content.title && <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>{content.title}</h3>}
      {content.description && <p style={{ margin: '0 0 16px', fontSize: 14, opacity: 0.8 }}>{content.description}</p>}

      {enabledFields.map((field) => (
        <div key={field.tag} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            {field.label}{field.required ? ' *' : ''}
          </label>
          <input
            type={field.tag === 'EMAIL' ? 'email' : 'text'}
            required={field.required}
            value={values[field.tag] || ''}
            onChange={(e) => setField(field.tag, e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 6,
              border: '1px solid #bfbfbf', background: '#fff', color: '#111', boxSizing: 'border-box',
            }}
          />
        </div>
      ))}

      {error && <p style={{ color: '#e0414b', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          width: '100%', padding: '12px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: theme.button, color: theme.buttonText, fontSize: 15, fontWeight: 600,
        }}
      >
        {status === 'submitting' ? t('frm.submitting') : (content.submitText || t('frm.sign_up'))}
      </button>
    </form>
  );
};

export default FormRenderer;
