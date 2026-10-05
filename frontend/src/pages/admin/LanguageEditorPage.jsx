import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { toast } from '../../components/ui';
import { useTranslation } from '../../i18n';

// ISO 639-1 language codes (code / name), shown as "AA / Afar".
const LANG_CODES = [
  ['aa', 'Afar'], ['ab', 'Abkhazian'], ['af', 'Afrikaans'], ['am', 'Amharic'], ['ar', 'Arabic'],
  ['az', 'Azerbaijani'], ['be', 'Belarusian'], ['bg', 'Bulgarian'], ['bn', 'Bengali'], ['bs', 'Bosnian'],
  ['ca', 'Catalan'], ['cs', 'Czech'], ['cy', 'Welsh'], ['da', 'Danish'], ['de', 'German'],
  ['el', 'Greek'], ['en', 'English'], ['es', 'Spanish'], ['et', 'Estonian'], ['eu', 'Basque'],
  ['fa', 'Persian'], ['fi', 'Finnish'], ['fr', 'French'], ['ga', 'Irish'], ['gl', 'Galician'],
  ['gu', 'Gujarati'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['hr', 'Croatian'], ['hu', 'Hungarian'],
  ['hy', 'Armenian'], ['id', 'Indonesian'], ['is', 'Icelandic'], ['it', 'Italian'], ['ja', 'Japanese'],
  ['ka', 'Georgian'], ['kk', 'Kazakh'], ['km', 'Khmer'], ['kn', 'Kannada'], ['ko', 'Korean'],
  ['ku', 'Kurdish'], ['lt', 'Lithuanian'], ['lv', 'Latvian'], ['mk', 'Macedonian'], ['ml', 'Malayalam'],
  ['mn', 'Mongolian'], ['mr', 'Marathi'], ['ms', 'Malay'], ['mt', 'Maltese'], ['nb', 'Norwegian Bokmål'],
  ['ne', 'Nepali'], ['nl', 'Dutch'], ['no', 'Norwegian'], ['pa', 'Punjabi'], ['pl', 'Polish'],
  ['pt', 'Portuguese'], ['ro', 'Romanian'], ['ru', 'Russian'], ['si', 'Sinhala'], ['sk', 'Slovak'],
  ['sl', 'Slovenian'], ['sq', 'Albanian'], ['sr', 'Serbian'], ['sv', 'Swedish'], ['sw', 'Swahili'],
  ['ta', 'Tamil'], ['te', 'Telugu'], ['th', 'Thai'], ['tr', 'Turkish'], ['uk', 'Ukrainian'],
  ['ur', 'Urdu'], ['uz', 'Uzbek'], ['vi', 'Vietnamese'], ['zh', 'Chinese'], ['zu', 'Zulu'],
];

const LanguageEditorPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('aa');
  const [region, setRegion] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error(t('cfg.name_is_required', null, 'Name is required.')); return; }
    if (!code) { toast.error(t('cfg.code_is_required', null, 'Code is required.')); return; }
    setSaving(true);
    try {
      await adminApi.createLanguage({ name: name.trim(), code, region_code: region.trim() || null });
      toast.success(t('cfg.language_added', null, 'Language added.'));
      navigate('/admin/languages');
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>{t('cfg.home', null, 'Home')}</button>
          </nav>
          <h1><span className="material-symbols-rounded">add</span>{t('cfg.new_language', null, 'New language')}</h1>
        </header>

        <section className="admin-content">
          <div className="lang-edit-grid">
            <label className="admin-detail-field"><span>{t('cfg.name_required', null, 'Name *')}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="admin-detail-field"><span>{t('cfg.code_required', null, 'Code *')}</span>
              <select className="input" value={code} onChange={(e) => setCode(e.target.value)}>
                {LANG_CODES.map(([c, n]) => <option key={c} value={c}>{c.toUpperCase()} / {n}</option>)}
              </select></label>
            <label className="admin-detail-field"><span>{t('cfg.region_code', null, 'Region code')}</span>
              <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} /></label>
          </div>
          <div className="lang-edit-actions">
            <button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('cfg.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/languages')}>{t('common.cancel', null, 'Cancel')}</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default LanguageEditorPage;
