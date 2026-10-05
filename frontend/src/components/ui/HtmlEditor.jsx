import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

const EXTENSIONS = [html()];

export default function HtmlEditor({ value, onChange, height = '420px', style }) {
  return (
    <CodeMirror
      value={value}
      height={height}
      extensions={EXTENSIONS}
      theme={oneDark}
      onChange={onChange}
      style={style}
    />
  );
}
