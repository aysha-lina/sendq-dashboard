// Adds an EDITABLE code popup to a GrapesJS editor. The `tb-edit-code` command
// opens the full HTML/CSS in a textarea with a "Save & apply" button that renders
// changes back to the canvas. It also overrides the built-in (read-only)
// `export-template` command so any existing code button becomes editable.
//
// Requires the `.tb-code-*` styles from pages/templates/templateBuilder.css and
// the `grapesjs-custom-code` + `grapesjs-style-bg` plugins for the "Embed code"
// block + background styler (registered by the caller).
// Return SELF-CONTAINED source: styles inlined on each element when the editor
// supports it (newsletter/email preset), so copied/pasted code renders the same
// everywhere — email clients strip <style> blocks, which is why a style-block
// export looks different once it leaves the editor. Falls back to <style>+HTML.
const getSelfContainedHtml = (editor) => {
  try {
    const inlined = editor.runCommand('gjs-get-inlined-html');
    if (inlined) return inlined;
  } catch { /* command not available for this preset */ }
  const css = editor.getCss();
  const html = editor.getHtml();
  return css ? `<style>\n${css}\n</style>\n${html}` : html;
};

export const registerCodeEditor = (editor, { applyLabel = 'Save & apply', title = 'Edit code' } = {}) => {
  const open = () => {
    const wrap = document.createElement('div');
    wrap.className = 'tb-code-modal';
    const ta = document.createElement('textarea');
    ta.className = 'tb-code-textarea';
    ta.spellcheck = false;
    ta.value = getSelfContainedHtml(editor);
    const actions = document.createElement('div');
    actions.className = 'tb-code-actions';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'tb-code-apply';
    apply.textContent = applyLabel;
    apply.addEventListener('click', () => { editor.setComponents(ta.value); editor.Modal.close(); });
    actions.appendChild(apply);
    wrap.appendChild(ta);
    wrap.appendChild(actions);
    editor.Modal.open({ title, content: wrap });
  };
  editor.Commands.add('tb-edit-code', { run: open });
  editor.Commands.add('export-template', { run: open });
};

export default registerCodeEditor;
