import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import en from './locales/en';
import de from './locales/de';
import es from './locales/es';
import it from './locales/it';
import pt from './locales/pt';
import tr from './locales/tr';
import ja from './locales/ja';
import ar from './locales/ar';

const dicts = { en, de, es, it, pt, tr, ja, ar };

// Matches the locales shipped by the original PHP app (resources/lang).
export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ja', label: '日本語' },
  { code: 'ar', label: 'العربية', rtl: true },
];

const RTL = ['ar'];
const STORAGE_KEY = 'sendq.locale';

// Derive a stable key from an English label (for translating existing UI strings
// without restructuring components): "Forms & Popups" -> "nav.forms_popups".
export const navKey = (label) => `nav.${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

const I18nContext = createContext({ locale: 'en', setLocale: () => {}, t: (k) => k });

export const I18nProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en');
  // Admin-edited overrides (Languages → Translate), keyed by locale, layered on top of file dicts.
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/public/translations/${locale}`)
      .then((r) => (r.ok ? r.json() : { translations: {} }))
      .then((d) => { if (!cancelled) setOverrides((o) => ({ ...o, [locale]: d.translations || {} })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [locale]);

  const setLocale = useCallback((code) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLocaleState(code);
  }, []);

  // t(key, vars, fallback): dict[locale] -> en -> fallback -> key. Supports {var} interpolation.
  const t = useCallback((key, vars, fallback) => {
    const dict = dicts[locale] || {};
    const ov = overrides[locale] || {};
    let str = ov[key] ?? dict[key] ?? en[key] ?? fallback ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { str = str.split(`{${k}}`).join(v); });
    return str;
  }, [locale, overrides]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => useContext(I18nContext);
