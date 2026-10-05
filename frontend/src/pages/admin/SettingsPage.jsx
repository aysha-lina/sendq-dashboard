import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import {
  GENERAL_LEFT, GENERAL_RIGHT, SYSTEM_EMAIL_FIELDS, PHP_PATHS,
  DESIGN_GROUPS, BACKEND_DESIGN_GROUPS,
} from '../../constants/settingsSchema';

const TABS = [
  { id: 'general', label: 'General', icon: 'tune' },
  { id: 'system-email', label: 'System Email', icon: 'mail' },
  { id: 'system-urls', label: 'System URLs', icon: 'link' },
  { id: 'background-job', label: 'Background Job', icon: 'schedule' },
  { id: 'login-design', label: 'Login & Signup Design', icon: 'palette' },
  { id: 'login-slider', label: 'Login Slider', icon: 'slideshow' },
  { id: 'license', label: 'License', icon: 'key' },
  { id: 'upgrade', label: 'Upgrade Manager', icon: 'cloud_upload' },
];

// Upload a settings image to the backend and return its stored URL. Images must NOT be
// stored as base64 in setting.value — that column is TEXT-capped (64KB) and overflows.
const uploadImage = async (file) => {
  const { data } = await adminApi.uploadSettingImage(file);
  return data.url;
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'general';

  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testForm, setTestForm] = useState({ to: '', subject: t('cfg.test_email_subject', null, 'SendQ test email'), content: t('cfg.test_email_content', null, 'This is a test email from SendQ system mail.') });
  const [testBusy, setTestBusy] = useState(false);

  const sendTestEmail = async () => {
    if (!testForm.to.trim()) { toast.error(t('cfg.enter_recipient', null, 'Enter a recipient (To) email.')); return; }
    setTestBusy(true);
    try {
      const { data } = await adminApi.testSystemEmail(testForm);
      toast.success(data.message || t('cfg.test_email_sent', null, 'Test email sent.'));
      setTestOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.test_email_failed', null, 'Could not send test email.'));
    } finally { setTestBusy(false); }
  };

  useEffect(() => {
    adminApi.settings()
      .then(({ data }) => {
        const map = {};
        (data.data || []).forEach((s) => { map[s.name] = s.value; });
        setValues(map);
      })
      .catch(() => toast.error(t('cfg.settings_load_failed', null, 'Failed to load settings.')))
      .finally(() => setLoading(false));
  }, []);

  const val = (key, def = '') => (values[key] !== undefined && values[key] !== null ? values[key] : def);
  const set = (key, v) => setValues((p) => ({ ...p, [key]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(values);
      toast.success(t('cfg.settings_saved', null, 'Settings saved.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('cfg.save_failed', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  const setTab = (id) => setParams({ tab: id });

  // ── Field renderers ────────────────────────────────────────────────
  const renderField = (f) => {
    if (f.type === 'spacer') return <div className="set-cell-spacer" />;
    if (f.heading) return <h3 key={f.heading} className="set-subhead">{f.heading}</h3>;
    if (f.type === 'note') return <div key={f.text} className="set-note set-note-inline"><span className="material-symbols-rounded">info</span> {f.text}</div>;
    const v = val(f.key, f.def);
    if (f.type === 'toggle') {
      const onVal = f.onVal || '1';
      const offVal = f.offVal || '0';
      const on = v === onVal || v === '1' || v === 1 || v === true || v === 'yes';
      return (
        <div key={f.key} className="set-toggle-row">
          <div><strong>{f.label}</strong>{f.help && <p>{f.help}</p>}</div>
          <button type="button" className={`admin-switch ${on ? 'is-on' : ''}`} onClick={() => set(f.key, on ? offVal : onVal)} aria-pressed={on}><span /></button>
        </div>
      );
    }
    if (f.type === 'inline-number' || f.type === 'inline-select') {
      return (
        <div key={f.key} className="set-toggle-row">
          <div><strong>{f.label}</strong>{f.help && <p>{f.help}</p>}</div>
          {f.type === 'inline-number'
            ? <input className="input set-inline-input" type="number" value={v} onChange={(e) => set(f.key, e.target.value)} />
            : <select className="input set-inline-input" value={v} onChange={(e) => set(f.key, e.target.value)}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>}
        </div>
      );
    }
    return (
      <label key={f.key} className={`admin-detail-field set-field ${f.full ? 'admin-detail-field-full' : ''}`}>
        <span>{f.label}</span>
        {f.type === 'textarea' ? (
          <textarea className="input" rows={3} value={v} onChange={(e) => set(f.key, e.target.value)} />
        ) : f.type === 'select' ? (
          <select className="input" value={v} onChange={(e) => set(f.key, e.target.value)}>
            {f.options.map((o) => (typeof o === 'object'
              ? <option key={o.value} value={o.value}>{o.label}</option>
              : <option key={o} value={o}>{o}</option>))}
          </select>
        ) : f.type === 'file' ? (
          <div className="set-file">
            <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { set(f.key, await uploadImage(file)); } catch (err) { toast.error(err.response?.data?.message || 'Image upload failed.'); } }} />
            {v && <img src={v} alt="" className="set-file-preview" />}
          </div>
        ) : (
          <input className="input" type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'} value={v} onChange={(e) => set(f.key, e.target.value)} />
        )}
        {f.help && f.type !== 'toggle' && <small className="set-help">{f.help}</small>}
      </label>
    );
  };

  const renderColor = (f) => {
    const v = val(f.key, f.def);
    return (
      <div key={f.key} className="set-color">
        <span className="set-color-label">{f.label}</span>
        <div className="set-color-row">
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : (f.def || '#ffffff')} onChange={(e) => set(f.key, e.target.value)} />
          <input className="input" value={v} onChange={(e) => set(f.key, e.target.value)} placeholder={f.def} />
        </div>
        {f.help && <small className="set-help">{f.help}</small>}
      </div>
    );
  };

  // ── Tab bodies ─────────────────────────────────────────────────────
  const renderTab = () => {
    if (activeTab === 'general') {
      const rows = Math.max(GENERAL_LEFT.length, GENERAL_RIGHT.length);
      const cells = [];
      for (let i = 0; i < rows; i += 1) {
        cells.push(<div key={`l${i}`} className="set-cell">{renderField(GENERAL_LEFT[i] || { type: 'spacer' })}</div>);
        cells.push(<div key={`r${i}`} className="set-cell">{renderField(GENERAL_RIGHT[i] || { type: 'spacer' })}</div>);
      }
      return (
        <>
          <h2 className="set-edit-title">{t('cfg.edit_app_settings', null, 'Edit application settings')}</h2>
          <h3 className="set-subhead set-subhead-top">{t('cfg.general', null, 'General')}</h3>
          <div className="set-general-grid">{cells}</div>
          <div className="set-actions"><button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? t('cfg.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button></div>
        </>
      );
    }
    if (activeTab === 'system-email') {
      const fld = (key) => SYSTEM_EMAIL_FIELDS.find((f) => f.key === key);
      return (
        <>
          <p className="set-intro">{t('cfg.system_email_intro', null, 'Configure email service which is used by the system to send transactional emails like user verification, application notification, etc.')}</p>
          {renderField(fld('sysmail_method'))}
          <div className="set-grid-3">
            {renderField(fld('sysmail_host'))}
            {renderField(fld('sysmail_port'))}
            {renderField(fld('sysmail_encryption'))}
          </div>
          <div className="set-grid-2">
            {renderField(fld('sysmail_username'))}
            {renderField(fld('sysmail_password'))}
          </div>
          <div className="set-grid-2">
            {renderField(fld('sysmail_from_email'))}
            {renderField(fld('sysmail_from_name'))}
          </div>
          <div className="set-actions">
            <button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? t('cfg.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
            <button type="button" className="btn-secondary" onClick={() => setTestOpen(true)}>{t('cfg.send_test_email', null, 'Send a test email')}</button>
          </div>
        </>
      );
    }
    if (activeTab === 'system-urls') {
      const base = window.location.origin;
      const urls = [
        ['Frontend URL', base],
        ['Backend URL', `${base}/admin`],
        ['List subscribe page', `${base}/lists/LIST_UID/subscribe`],
        ['List unsubscribe page', `${base}/lists/LIST_UID/unsubscribe/SUBSCRIBER_UID`],
        ['Update profile page', `${base}/lists/LIST_UID/update-profile/SUBSCRIBER_UID`],
        ['Open tracking URL', `${base}/open/MESSAGE_ID`],
        ['Click tracking URL', `${base}/click/MESSAGE_ID?url=URL`],
        ['Campaign web view', `${base}/campaigns/MESSAGE_ID/web-view`],
      ];
      const hl = (u) => u.split(/(LIST_UID|SUBSCRIBER_UID|MESSAGE_ID|SECURE_CODE|URL)/g)
        .map((p, i) => (['LIST_UID', 'SUBSCRIBER_UID', 'MESSAGE_ID', 'SECURE_CODE', 'URL'].includes(p)
          ? <span key={i} className="su-token">{p}</span> : <span key={i}>{p}</span>));
      return (
        <>
          <h2 className="set-edit-title">System URLs</h2>
          <p className="set-intro">Below are the URLs the application uses to build links across emails, tracking and public pages. They are derived from your installation address.</p>
          <ul className="su-list">
            {urls.map(([label, url]) => (
              <li key={label} className="su-item">
                <span className="material-symbols-rounded">link</span>
                <div>
                  <h5 className="su-url">{hl(url)}</h5>
                  <p className="su-label">{label}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      );
    }
    if (activeTab === 'background-job') {
      const phpPath = val('php_executable_path', '/usr/bin/php');
      const cron = `* * * * * ${phpPath} -q /var/www/sendq/html/artisan schedule:run 2>&1`;
      return (
        <>
          <h2 className="set-edit-title">Background Job Setup</h2>
          <p className="set-label-strong">Please specify the PHP executable path on your system:</p>
          <div className="set-radios">
            {PHP_PATHS.map((p) => (
              <label key={p} className="set-radio">
                <input type="radio" name="php_path" checked={phpPath === p} onChange={() => set('php_executable_path', p)} /> {p}
              </label>
            ))}
          </div>
          <p className="set-cron-note">Insert the following line to your system's crontab.<br />Please note, below timings for running the cron jobs are the recommended, you can change it if you want.</p>
          <div className="set-cron-row">
            <code className="set-cron">{cron}</code>
            <button type="button" className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(cron); toast.success('Copied.'); }}>
              <span className="material-symbols-rounded">content_copy</span> Copy
            </button>
          </div>
          <div className="set-actions"><button type="button" className="btn-danger" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
        </>
      );
    }
    if (activeTab === 'login-design') {
      return (
        <>
          <h2 className="set-edit-title">Appearance &amp; Theme Customization</h2>
          <p className="set-intro">Customize the look and feel of your entire application. Leave any field empty to use the default value.</p>
          {DESIGN_GROUPS.map((g, gi) => (
            <div key={gi} className="set-design-group">
              {g.title && <h3 className="set-group-title">{g.title}</h3>}
              {g.sub && <h4 className="set-group-sub">{g.sub}</h4>}
              <div className="set-color-grid">{g.fields.map(renderColor)}</div>
            </div>
          ))}

          <div className="set-design-group">
            <label className="admin-detail-field set-field" style={{ maxWidth: 420 }}><span>Slider Background Image</span>
              <div className="set-file">
                <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { set('d_slider_bg_image', await uploadImage(file)); } catch (err) { toast.error(err.response?.data?.message || 'Image upload failed.'); } }} />
                {val('d_slider_bg_image') && <img src={val('d_slider_bg_image')} alt="" className="set-file-preview" />}
              </div>
              <small className="set-help">Optional background image for slider panel</small>
            </label>
          </div>

          <div className="set-design-group">
            <h4 className="set-group-sub">Preview</h4>
            <div className="set-preview" style={{ background: val('d_page_bg', '#ffffff') }}>
              <div className="set-preview-form" style={{ background: val('d_card_bg', '#eff3f5') }}>
                <h3 style={{ color: val('d_title', '#1a1a2e') }}>Sign In</h3>
                <p style={{ color: val('d_subtitle', '#6b7280') }}>Welcome back!</p>
                <label style={{ color: val('d_label', '#5e5c64') }}>Email</label>
                <div className="set-preview-input" style={{ background: val('d_input_bg', '#fff'), borderColor: val('d_input_border', '#e0e0e0'), color: val('d_form_text', '#000') }}>you@example.com</div>
                <label style={{ color: val('d_label', '#5e5c64') }}>Password</label>
                <div className="set-preview-input set-preview-input-focus" style={{ background: val('d_input_bg', '#fff'), borderColor: val('d_input_focus', '#d32f2f'), color: val('d_form_text', '#000'), boxShadow: `0 0 0 2px ${val('d_input_focus', '#d32f2f')}33` }}>••••••••</div>
                <div className="set-preview-row">
                  <span className="set-preview-btn" style={{ background: val('d_button', '#e01b24') }}>Sign In</span>
                  <span style={{ color: val('d_link', '#d32f2f') }}>Forgot?</span>
                </div>
                <p className="set-preview-copyright" style={{ color: val('d_copyright', '#9ca3af') }}>© {val('site_name', 'SendQ')} — All Rights Reserved.</p>
              </div>
              <div className="set-preview-slider" style={{ background: val('d_slider_bg', '#fff'), backgroundImage: val('d_slider_bg_image') ? `url(${val('d_slider_bg_image')})` : 'none', color: val('d_slider_text', '#000') }}>
                <h4 style={{ color: val('d_slider_heading', '#1a1a2e') }}>Slide Title</h4>
                <p style={{ color: val('d_slider_subtitle', '#6b7280') }}>Subtitle text here</p>
                <p style={{ color: val('d_slider_list', '#374151') }}><span style={{ color: val('d_slider_accent', '#d32f2f') }}>✓</span> Feature item</p>
                <div className="set-preview-dots">
                  <span style={{ background: val('d_pager_active', val('d_slider_accent', '#d32f2f')) }} />
                  <span style={{ background: val('d_pager_dot', '#d1d5db') }} />
                  <span style={{ background: val('d_pager_dot', '#d1d5db') }} />
                </div>
              </div>
            </div>
          </div>

          {BACKEND_DESIGN_GROUPS.map((g, gi) => (
            <div key={gi} className="set-design-group">
              {g.title && <h3 className="set-group-title">{g.title}</h3>}
              {g.sub && <h4 className="set-group-sub">{g.sub}</h4>}
              <div className="set-color-grid">{g.fields.map(renderColor)}</div>
            </div>
          ))}
          <div className="set-design-group">
            <h4 className="set-group-sub">Custom CSS</h4>
            <label className="admin-detail-field admin-detail-field-full set-field"><span>Additional CSS (advanced)</span>
              <textarea className="input" rows={6} value={val('custom_css')} onChange={(e) => set('custom_css', e.target.value)} placeholder="/* Your custom CSS here — applied globally across all pages */" /></label>
          </div>
          <div className="set-actions"><button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
        </>
      );
    }
    if (activeTab === 'login-slider') {
      return (
        <>
          <h2 className="set-edit-title">Login &amp; Signup Slider</h2>
          <p className="set-intro">Upload up to 5 slide images and configure slider display settings. These slides appear on the right side of the login, register, forgot password, and reset password pages.</p>
          <div className="set-note"><span className="material-symbols-rounded">info</span> <strong>Image Guidelines:</strong> Upload PNG, JPG, or SVG images for each slide. Recommended dimensions match your configured slide height. Transparent PNG/SVG works best. Leave empty to skip a slide position.</div>
          <div className="set-slider-grid">
            {[1, 2, 3, 4, 5].map((n) => {
              const key = `slide_image_${n}`;
              const v = val(key);
              return (
                <div key={n} className="set-slide-card">
                  <div className="set-slide-head">{n}</div>
                  <div className="set-slide-img">{v ? <img src={v} alt="" /> : <span className="material-symbols-rounded">add_photo_alternate</span>}</div>
                  <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { set(key, await uploadImage(file)); } catch (err) { toast.error(err.response?.data?.message || 'Image upload failed.'); } }} />
                  {v && <label className="set-slide-remove"><input type="checkbox" onChange={(e) => { if (e.target.checked) set(key, ''); }} /> Remove this slide</label>}
                </div>
              );
            })}
          </div>

          <h3 className="set-group-title">Slide Display Settings</h3>
          <div className="set-grid-3">
            <div className="set-toggle-row"><div><strong>Enable autoplay</strong><p>Automatically cycle through slides.</p></div>
              <button type="button" className={`admin-switch ${val('slider_autoplay', '1') === '1' ? 'is-on' : ''}`} onClick={() => set('slider_autoplay', val('slider_autoplay', '1') === '1' ? '0' : '1')}><span /></button></div>
            <label className="admin-detail-field set-field"><span>Autoplay interval (seconds)</span>
              <input className="input" type="number" min="1" value={val('slider_interval', '5')} onChange={(e) => set('slider_interval', e.target.value)} /></label>
            <label className="admin-detail-field set-field"><span>Slide height (px)</span>
              <input className="input" type="number" min="100" value={val('slider_height', '600')} onChange={(e) => set('slider_height', e.target.value)} /></label>
            <div className="set-toggle-row"><div><strong>Show navigation dots</strong><p>Display the pager dots below slides.</p></div>
              <button type="button" className={`admin-switch ${val('slider_show_dots', '1') === '1' ? 'is-on' : ''}`} onClick={() => set('slider_show_dots', val('slider_show_dots', '1') === '1' ? '0' : '1')}><span /></button></div>
            <label className="admin-detail-field set-field"><span>Transition effect</span>
              <select className="input" value={val('slider_effect', 'fade')} onChange={(e) => set('slider_effect', e.target.value)}>
                <option value="fade">Fade</option><option value="slide">Slide</option>
              </select></label>
          </div>

          <div className="set-actions"><button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
        </>
      );
    }
    if (activeTab === 'license') {
      const key = val('license_key');
      return (
        <>
          <h2 className="set-edit-title">Your current license</h2>
          <p className="set-intro">The current application is registered with the key below, also known as Purchase Code. License type is: <strong>Extended License</strong></p>
          {key ? (
            <div className="set-license-box">
              <span><span className="material-symbols-rounded">verified</span> {key}</span>
              <button type="button" className="btn-secondary" onClick={async () => {
                const { license_input, ...rest } = values;
                const next = { ...rest, license_key: '' };
                setValues((p) => ({ ...p, license_key: '' }));
                try { await adminApi.updateSettings(next); toast.success('License removed.'); }
                catch (err) { toast.error(err.response?.data?.message || 'Remove failed.'); }
              }}>
                <span className="material-symbols-rounded">delete</span> Remove
              </button>
            </div>
          ) : <p className="set-muted">No license key registered.</p>}
          <h3 className="set-subhead">License types</h3>
          <p className="set-muted">When you purchase the application license from Envato website, you are actually purchasing a license to use the product. There are 2 types of license that are issued.</p>
          <p><strong>Regular License</strong><br /><span className="set-muted">All features are available, for a single end product which end users are NOT charged for.</span></p>
          <p><strong>Extended License</strong><br /><span className="set-muted">All features are available, for a single end product which end users can be charged for (software as a service).</span></p>
          <h3 className="set-subhead">Update your license</h3>
          <p className="set-muted">Enter the licence key (purchase code) then hit the Verify/Update button.</p>
          <div className="set-license-update">
            <input className="input" placeholder="Purchase code" value={val('license_input')} onChange={(e) => set('license_input', e.target.value)} />
            <button type="button" className="btn-secondary" onClick={async () => {
              const code = val('license_input');
              if (!code) { toast.error('Enter a purchase code first.'); return; }
              const { license_input, ...rest } = values;
              const next = { ...rest, license_key: code };
              setValues((p) => { const { license_input: _drop, ...r } = p; return { ...r, license_key: code }; });
              try { await adminApi.updateSettings(next); toast.success('License updated.'); }
              catch (err) { toast.error(err.response?.data?.message || 'Update failed.'); }
            }}>Update your license</button>
          </div>
          <div className="set-actions"><button type="button" className="btn-secondary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
        </>
      );
    }
    if (activeTab === 'upgrade') {
      return (
        <>
          <h2 className="set-edit-title">Your current version</h2>
          <p className="set-intro">You are currently running SendQ <span className="set-version">v1.0.0</span> (Node.js / React build).</p>
          <div className="set-note set-note-inline"><span className="material-symbols-rounded">info</span>
            This build is upgraded through your deployment pipeline (pull the latest source, run database
            migrations, then restart the backend and rebuild the frontend) — not by uploading a patch package
            from this screen. The legacy in-app patch uploader from the PHP edition does not apply here.</div>
          <h3 className="set-subhead">Recommended upgrade steps</h3>
          <ul className="set-upgrade-list">
            <li>Back up the database and pull the latest source.</li>
            <li>Install dependencies: <span className="set-version">npm install</span> (backend &amp; frontend).</li>
            <li>Apply any additive DB scripts under <span className="set-version">backend/scripts</span>.</li>
            <li>Rebuild the frontend (<span className="set-version">npm run build</span>) and restart the backend.</li>
          </ul>
        </>
      );
    }
    return null;
  };

  const activeMeta = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-header">
          <nav><button type="button" onClick={() => navigate('/dashboard')}>Home</button></nav>
          <h1><span className="material-symbols-rounded">{activeMeta.icon}</span>{activeMeta.label === 'General' ? 'Settings' : activeMeta.label}</h1>
        </header>

        <section className="admin-content">
          <div className="set-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`set-tab ${activeTab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
                <span className="material-symbols-rounded">{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {loading ? <div className="admin-empty"><Spinner size="lg" /></div> : <div className="set-body">{renderTab()}</div>}
        </section>
      </div>

      {testOpen && (
        <div className="tax-modal-overlay" onClick={() => setTestOpen(false)}>
          <div className="tax-modal sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-head"><h3>Sending a test message</h3><button type="button" onClick={() => setTestOpen(false)} aria-label="Close">✕</button></div>
            <div className="sa-modal-body">
              <p className="set-muted">Fill in the form below and hit the Send button to test your server.</p>
              <label className="admin-detail-field admin-detail-field-full"><span>From email *</span><input className="input" defaultValue={val('sysmail_from_email')} disabled /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>To email *</span><input className="input" value={testForm.to} onChange={(e) => setTestForm((f) => ({ ...f, to: e.target.value }))} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>Subject *</span><input className="input" value={testForm.subject} onChange={(e) => setTestForm((f) => ({ ...f, subject: e.target.value }))} /></label>
              <label className="admin-detail-field admin-detail-field-full"><span>Content *</span><textarea className="input" rows={3} value={testForm.content} onChange={(e) => setTestForm((f) => ({ ...f, content: e.target.value }))} /></label>
            </div>
            <div className="sa-modal-foot">
              <button type="button" className="btn-secondary" onClick={sendTestEmail} disabled={testBusy}>{testBusy ? 'Sending…' : 'Send'}</button>
              <button type="button" className="btn-danger" onClick={() => setTestOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default SettingsPage;
