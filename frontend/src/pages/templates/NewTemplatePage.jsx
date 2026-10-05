import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Spinner } from '../../components/ui';
import { templatesApi } from '../../api/services';
import { BASE_TEMPLATES, getBaseContent } from './templateBases';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;

// Mini wireframe preview shown on each base-template card.
const BaseThumb = ({ kind }) => (
  <div className={`new-template-thumb new-template-thumb-${kind}`}>
    {kind === 'blank' ? (
      <span className="new-template-thumb-blank"><MaterialIcon name="crop_square" /></span>
    ) : (
      <>
        <span className="ntt-bar ntt-bar-lg" />
        <span className="ntt-bar" />
        <span className="ntt-block" />
        <span className="ntt-bar" />
      </>
    )}
  </div>
);

const NewTemplatePage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('Untitled template');
  const [selected, setSelected] = useState('blank');
  const [keyword, setKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const visible = BASE_TEMPLATES.filter((t) => t.label.toLowerCase().includes(keyword.trim().toLowerCase()));

  const startDesign = async () => {
    if (!name.trim()) { setError("Please enter your template's name."); return; }
    setError('');
    setSaving(true);
    try {
      const { data } = await templatesApi.create({ name: name.trim(), content: getBaseContent(selected) });
      const uid = data.uid || data.template?.uid;
      navigate(`/templates/${uid}/builder`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the template.');
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="templates-page new-template-page">
        <header className="templates-page-title">
          <nav>
            <button type="button" onClick={() => navigate('/dashboard')}>Home</button>
            <span> › </span>
            <button type="button" onClick={() => navigate('/templates')}>Templates</button>
          </nav>
          <div className="templates-title-row">
            <h1><MaterialIcon name="note_add" /> New template</h1>
          </div>
        </header>

        <div className="new-template-name">
          <label>Enter your template's name here <em>*</em></label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled template"
          />
          {error && <p className="new-template-error">{error}</p>}
        </div>

        <div className="new-template-select-head">
          <h2 className="sq-section-title">Select one from the base templates below</h2>
          <button type="button" className="btn-secondary" onClick={startDesign} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Creating…' : 'Start Design'}
          </button>
        </div>

        <h3 className="new-template-group">Basic</h3>

        <div className="templates-top-controls new-template-controls">
          <div className="templates-filter-box">
            <span className="campaign-log-sortlabel">Sort by</span>
            <select defaultValue="default"><option value="default">Default</option></select>
            <div className="templates-search">
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Type to search" />
              <MaterialIcon name="search" />
            </div>
          </div>
        </div>

        <div className="new-template-grid">
          {visible.map((tpl) => (
            <button
              type="button"
              key={tpl.key}
              className={`new-template-card ${selected === tpl.key ? 'is-selected' : ''}`}
              onClick={() => setSelected(tpl.key)}
              onDoubleClick={startDesign}
            >
              <BaseThumb kind={tpl.key} />
              <span className="new-template-card-label">{tpl.label}</span>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default NewTemplatePage;
