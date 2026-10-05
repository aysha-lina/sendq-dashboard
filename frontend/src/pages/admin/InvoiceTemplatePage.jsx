import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { adminApi } from '../../api/services';
import { Spinner, toast } from '../../components/ui';
import { useTranslation } from '../../i18n';
import '../templates/templateBuilder.css';
import './invoiceTemplate.css';

// ─── Self-hosted TinyMCE (no cloud / API key) ────────────────────────────────────
import 'tinymce/tinymce';
import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/models/dom';
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/link';
import 'tinymce/plugins/image';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/media';
import 'tinymce/plugins/table';
import 'tinymce/plugins/wordcount';
import 'tinymce/plugins/emoticons';
import 'tinymce/plugins/emoticons/js/emojis';
import 'tinymce/plugins/directionality';
import 'tinymce/plugins/save';
// Styles applied inside the editor iframe.
import contentUiCss from 'tinymce/skins/ui/oxide/content.min.css?inline';
import contentDefaultCss from 'tinymce/skins/content/default/content.min.css?inline';

const MaterialIcon = ({ name }) => <span className="material-symbols-rounded">{name}</span>;
const SendQLogo = () => <img className="tb-logo" src="/assets/3.png" alt="SendQ" />;

const TAGS = [
  'COMPANY_NAME', 'COMPANY_ADDRESS', 'COMPANY_EMAIL', 'COMPANY_PHONE',
  'FIRST_NAME', 'LAST_NAME', 'ADDRESS', 'COUNTRY', 'EMAIL', 'PHONE',
  'INVOICE_NUMBER', 'CURRENT_DATETIME', 'INVOICE_DUE_DATE', 'ITEMS', 'CUSTOMER_ADDRESS',
];

// Default invoice layout shown when no template has been saved yet.
const DEFAULT_TEMPLATE = `
<div style="max-width:900px;margin:0 auto;padding:0 4px 40px;font-family:'Noto Sans',Arial,Helvetica,sans-serif;color:#333333;">
  <div style="height:18px;background:#ff0000;"></div>
  <div style="padding-top:18px;">
    <img src="/assets/1.png" alt="SendQ" style="height:46px;" />
    <h1 style="color:#ff0000;font-size:30px;margin:18px 0 24px;">TAX INVOICE</h1>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tbody><tr>
      <td style="vertical-align:top;width:55%;padding-right:24px;">
        <p style="font-weight:bold;font-size:16px;margin:0 0 8px;">{COMPANY_NAME}</p>
        <p style="margin:3px 0;color:#9aa0a6;">{COMPANY_ADDRESS}</p>
        <p style="margin:3px 0;color:#9aa0a6;">{COMPANY_EMAIL}</p>
        <p style="margin:3px 0;color:#9aa0a6;">{COMPANY_PHONE}</p>
      </td>
      <td style="vertical-align:top;">
        <table style="width:100%;border-collapse:collapse;color:#9aa0a6;">
          <tbody>
          <tr>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eeeeee;">Invoice #:</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eeeeee;color:#333333;font-weight:bold;">{INVOICE_NUMBER}</td>
          </tr>
          <tr>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eeeeee;">Created at:</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eeeeee;color:#333333;">{CURRENT_DATETIME}</td>
          </tr>
          <tr>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eeeeee;">Due date:</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eeeeee;color:#333333;">{INVOICE_DUE_DATE}</td>
          </tr>
          </tbody>
        </table>
      </td>
    </tr></tbody>
  </table>
  <div style="margin-top:34px;">
    <p style="color:#ff0000;font-weight:bold;font-size:12px;letter-spacing:1px;margin:0 0 10px;">BILL TO</p>
    <p style="font-weight:bold;margin:0 0 8px;">{FIRST_NAME} {LAST_NAME}</p>
    <p style="margin:3px 0;color:#9aa0a6;">{ADDRESS}, {COUNTRY}</p>
    <p style="margin:3px 0;color:#9aa0a6;">{EMAIL}</p>
    <p style="margin:3px 0;color:#9aa0a6;">{PHONE}</p>
  </div>
  <div style="margin-top:28px;border-top:1px solid #eeeeee;padding-top:18px;min-height:60px;">{ITEMS}</div>
  <p style="text-align:center;color:#ff4d6d;margin-top:48px;">Thanks for your purchase.</p>
</div>`;

const InvoiceTemplatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const [initialContent, setInitialContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi.invoiceTemplate()
      .then(({ data }) => {
        if (cancelled) return;
        setInitialContent(data.content || DEFAULT_TEMPLATE);
        setLoading(false);
      })
      .catch(() => {
        toast.error(t('atp.failed_load_invoice_template', null, 'Failed to load invoice template.'));
        navigate('/admin/taxes');
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const insertTag = (tag) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.insertContent(`{${tag}}`);
    editor.focus();
  };

  const resetDefault = () => {
    if (!window.confirm(t('atp.reset_invoice_confirm', null, 'Reset the invoice template to the default layout?'))) return;
    editorRef.current?.setContent(DEFAULT_TEMPLATE);
    toast.success(t('atp.reset_default_layout', null, 'Reset to default layout.'));
  };

  const save = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setSaving(true);
    try {
      await adminApi.updateInvoiceTemplate({ content: editor.getContent() });
      toast.success(t('atp.invoice_template_saved', null, 'Invoice template saved.'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('atp.save_failed_dot', null, 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <div className="tb-page">
      <header className="tb-topbar">
        <div className="tb-topbar-left">
          <SendQLogo />
          <span className="tb-name">{t('atp.invoice_template', null, 'Invoice template')}</span>
        </div>
        <div className="tb-topbar-right">
          <button type="button" className="tb-saveclose" onClick={() => navigate('/admin/taxes')}>
            <MaterialIcon name="arrow_back" /> {t('atp.go_back', null, 'Go back')}
          </button>
          <button type="button" className="tb-saveclose" onClick={resetDefault} disabled={loading}>{t('atp.reset_to_default', null, 'Reset to Default')}</button>
          <button type="button" className="btn-primary tb-save" onClick={save} disabled={saving || loading}>
            {saving ? <Spinner size="sm" /> : <MaterialIcon name="save" />} {t('common.save', null, 'Save')}
          </button>
          <button type="button" className="tb-close" onClick={() => navigate('/admin/taxes')} aria-label="Close">✕</button>
        </div>
      </header>

      {loading && <div className="tb-loading"><Spinner size="lg" /></div>}

      <div className="inv-body" style={loading ? { visibility: 'hidden' } : undefined}>
        <div className="tb-editor-wrap inv-editor-wrap">
          {initialContent !== null && (
            <Editor
              licenseKey="gpl"
              onInit={(evt, editor) => { editorRef.current = editor; }}
              initialValue={initialContent}
              init={{
                height: '100%',
                menubar: 'file edit view insert format tools table',
                branding: false,
                promotion: false,
                skin: false,
                content_css: false,
                plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table wordcount emoticons directionality save',
                toolbar: [
                  'customtags | undo redo | bold italic underline strikethrough | fontfamily fontsize blocks | alignleft aligncenter alignright alignjustify',
                  'bullist numlist outdent indent | forecolor backcolor removeformat | hr charmap emoticons | fullscreen preview save print | image media anchor link | code | ltr rtl',
                ].join(' | '),
                font_family_formats: "Noto Sans=Noto Sans,sans-serif;Andale Mono=andale mono,times;Arial=arial,helvetica,sans-serif;Arial Black=arial black,avant garde;Book Antiqua=book antiqua,palatino;Comic Sans MS=comic sans ms,sans-serif;Courier New=courier new,courier;Georgia=georgia,palatino;Helvetica=helvetica;Tahoma=tahoma,arial,helvetica,sans-serif;Times New Roman=times new roman,times;Verdana=verdana,geneva",
                font_size_formats: '8px 10px 12px 14px 16px 18px 24px 36px 48px',
                font_family: "Noto Sans,sans-serif",
                font_size: '12px',
                content_style: `${contentUiCss}\n${contentDefaultCss}\nbody{font-family:'Noto Sans',sans-serif;font-size:12px;}`,
                setup: (editor) => {
                  editor.ui.registry.addMenuButton('customtags', {
                    text: t('atp.insert_custom_tags', null, 'Insert Custom Tags'),
                    fetch: (callback) => {
                      callback(TAGS.map((tag) => ({
                        type: 'menuitem',
                        text: `{${tag}}`,
                        onAction: () => editor.insertContent(`{${tag}}`),
                      })));
                    },
                  });
                },
              }}
            />
          )}
        </div>
        <aside className="inv-tags">
          <h3>{t('atp.available_tags', null, 'Available tags:')}</h3>
          <div className="inv-tags-grid">
            {TAGS.map((tag) => (
              <button key={tag} type="button" className="inv-tag" onClick={() => insertTag(tag)} title={t('atp.insert_tag', { tag: `{${tag}}` }, 'Insert {tag}')}>
                {`{${tag}}`}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default InvoiceTemplatePage;
