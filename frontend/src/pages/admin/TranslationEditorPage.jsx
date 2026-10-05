import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import en from '../../i18n/locales/en';
import de from '../../i18n/locales/de';
import es from '../../i18n/locales/es';
import it from '../../i18n/locales/it';
import pt from '../../i18n/locales/pt';
import tr from '../../i18n/locales/tr';
import ja from '../../i18n/locales/ja';
import ar from '../../i18n/locales/ar';

const DICTS = { en, de, es, it, pt, tr, ja, ar };

// English is the canonical key set — every other locale translates these keys.
const ALL_KEYS = Object.keys(en).sort();

const TranslationEditorPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const base = DICTS[code] || {};

  const [values, setValues] = useState({});       // key -> current input value
  const [initial, setInitial] = useState({});     // key -> file/override baseline (for dirty + clearing)
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [onlyTranslated, setOnlyTranslated] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminApi.getTranslations(code)
      .then(({ data }) => {
        const ov = data.translations || {};
        const seed = {};
        ALL_KEYS.forEach((k) => { seed[k] = ov[k] ?? base[k] ?? ''; });
        setValues(seed);
        setInitial(seed);
      })
      .catch(() => toast.error(t('cfg.translations_load_failed', null, 'Failed to load translations.')))
      .finally(() => setLoading(false));
     
  }, [code]);

  const dirtyCount = useMemo(
    () => ALL_KEYS.filter((k) => (values[k] || '') !== (initial[k] || '')).length,
    [values, initial],
  );

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return ALL_KEYS.filter((k) => {
      if (onlyTranslated && !(values[k] || '').trim()) return false;
      if (!kw) return true;
      return k.toLowerCase().includes(kw) || String(en[k]).toLowerCase().includes(kw) || String(values[k] || '').toLowerCase().includes(kw);
    });
  }, [keyword, onlyTranslated, values]);

  const save = async () => {
    setBusy(true);
    try {
      // Send the full set: values matching the file baseline are sent empty so the
      // backend drops the override and the app falls back to the shipped string.
      const translations = {};
      ALL_KEYS.forEach((k) => {
        const v = values[k] || '';
        translations[k] = v && v !== (base[k] || '') ? v : '';
      });
      const { data } = await adminApi.saveTranslations(code, { translations });
      setInitial({ ...values });
      toast.success(data.message || t('cfg.translations_saved', null, 'Translations saved.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.save_failed', null, 'Save failed.'));
    } finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button>
            <span> / </span>
            <button type="button" onClick={() => navigate('/admin/languages')}>{t('cfg.languages', null, 'Languages')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">translate</span>{t('cfg.translate', null, 'Translate')} · {code?.toUpperCase()}</h1>
        </header>

        <section className="admin-content">
          <p className="set-intro">
            {t('cfg.translate_intro', null, 'Customize the user interface text for this language. Edit any string below; leave a field matching the English reference to keep the shipped translation. Changes apply across the app for users on this language.')}
          </p>

          <div className="admin-filter-bar">
            <div className="admin-filter-search">
              <input className="input" placeholder={t('cfg.search_key_or_text', null, 'Search key or text')} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              <span className="material-symbols-rounded">search</span>
            </div>
            <label className="tr-check">
              <input type="checkbox" checked={onlyTranslated} onChange={(e) => setOnlyTranslated(e.target.checked)} /> {t('cfg.only_filled', null, 'Only filled')}
            </label>
            <span className="tr-spacer" />
            <span className="tr-dirty">{t('cfg.unsaved_count', { count: dirtyCount }, '{count} unsaved')}</span>
            <button type="button" className="btn-secondary wp-create-btn" onClick={save} disabled={busy || loading}>
              {busy ? t('cfg.saving', null, 'Saving…') : t('cfg.save_changes', null, 'Save changes')}
            </button>
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : (
            <>
              <div className="tr-table">
                <div className="tr-head">
                  <span>{t('cfg.key', null, 'Key')}</span>
                  <span>{t('cfg.english_reference', null, 'English (reference)')}</span>
                  <span>{t('cfg.code_translation', { code: code?.toUpperCase() }, '{code} translation')}</span>
                </div>
                {rows.map((k) => {
                  const changed = (values[k] || '') !== (initial[k] || '');
                  return (
                    <div className={`tr-row${changed ? ' is-changed' : ''}`} key={k}>
                      <code className="tr-key">{k}</code>
                      <span className="tr-en">{en[k]}</span>
                      <input
                        className="input tr-input"
                        value={values[k] ?? ''}
                        placeholder={en[k]}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                      />
                    </div>
                  );
                })}
                {!rows.length && <div className="admin-empty">{t('cfg.no_matching_strings', null, 'No matching strings.')}</div>}
              </div>
              <div className="admin-cur-footer"><span>{t('cfg.strings_count', { shown: rows.length, total: ALL_KEYS.length }, '{shown} of {total} strings')}</span></div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default TranslationEditorPage;
