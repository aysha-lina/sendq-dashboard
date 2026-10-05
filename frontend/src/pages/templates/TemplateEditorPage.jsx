import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { templatesApi } from '../../api/services';
import { HtmlEditor, Spinner } from '../../components/ui';

const MaterialIcon = ({ name }) => (
  <span className="material-symbols-rounded">{name}</span>
);

const SaveStatus = ({ saving, saved, error }) => {
  if (error) return <span className="ted-save-status ted-save-error"><MaterialIcon name="error" /> {error}</span>;
  if (saving) return <span className="ted-save-status ted-saving"><MaterialIcon name="sync" /> Saving…</span>;
  if (saved) return <span className="ted-save-status ted-saved"><MaterialIcon name="check_circle" /> Saved</span>;
  return <span className="ted-save-status ted-unsaved"><MaterialIcon name="edit" /> Unsaved</span>;
};

const TemplateEditorPage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [content, setContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const autoSaveTimer = useRef(null);
  const previewTimer = useRef(null);
  const latestContent = useRef('');
  const latestName = useRef('');

  useEffect(() => {
    templatesApi.get(uid)
      .then(({ data }) => {
        setName(data.name || '');
        setOriginalName(data.name || '');
        setContent(data.content || '');
        setPreviewHtml(data.content || '');
        latestContent.current = data.content || '';
        latestName.current = data.name || '';
        setSaved(true);
      })
      .catch(() => navigate('/templates'))
      .finally(() => setLoading(false));

    return () => {
      clearTimeout(autoSaveTimer.current);
      clearTimeout(previewTimer.current);
    };
  }, [uid, navigate]);

  const doSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      await templatesApi.update(uid, {
        name: latestName.current,
        content: latestContent.current,
      });
      setSaved(true);
    } catch {
      setSaveError('Save failed');
    } finally {
      setSaving(false);
    }
  }, [uid]);

  const scheduleAutoSave = () => {
    setSaved(false);
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doSave, 1500);
  };

  const handleContentChange = (value) => {
    setContent(value);
    latestContent.current = value;
    scheduleAutoSave();

    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewHtml(value), 400);
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    latestName.current = e.target.value;
    setSaved(false);
  };

  const handleNameBlur = () => {
    if (latestName.current.trim() && latestName.current !== originalName) {
      setOriginalName(latestName.current);
      scheduleAutoSave();
    }
  };

  const handleSaveNow = () => {
    clearTimeout(autoSaveTimer.current);
    doSave();
  };

  if (loading) {
    return (
      <div className="ted-page">
        <div className="ted-header">
          <button className="ted-back" onClick={() => navigate('/templates')}>
            <MaterialIcon name="arrow_back" /> Templates
          </button>
        </div>
        <div className="ted-loading">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="ted-page">
      <div className="ted-header">
        <button className="ted-back" onClick={() => navigate('/templates')}>
          <MaterialIcon name="arrow_back" /> Templates
        </button>

        <input
          className="ted-name-input"
          value={name}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          placeholder="Template name"
          spellCheck={false}
        />

        <SaveStatus saving={saving} saved={saved} error={saveError} />

        <button className="btn-primary ted-save-btn" onClick={handleSaveNow} disabled={saving}>
          <MaterialIcon name="save" />
          Save
        </button>
      </div>

      <div className="ted-body">
        <div className="ted-code-panel">
          <div className="ted-panel-label">
            <MaterialIcon name="code" /> HTML
          </div>
          <HtmlEditor
            value={content}
            onChange={handleContentChange}
            height="100%"
            style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
          />
        </div>

        <div className="ted-preview-panel">
          <div className="ted-panel-label">
            <MaterialIcon name="visibility" /> Preview
          </div>
          <iframe
            className="ted-preview-frame"
            srcDoc={previewHtml || '<p style="color:#aaa;padding:24px;font-family:sans-serif">No content yet — start typing in the editor.</p>'}
            title="Template preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorPage;
