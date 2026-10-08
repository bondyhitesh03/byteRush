import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import type { CompileError } from '../types/run';

interface Props { language?: string; highlightLine?: number | null; theme: 'dark' | 'light'; value: string; onChange: (v: string) => void; onRun: () => void; errors: CompileError[] }

export default function CodeEditor({ language, highlightLine, theme, value, onChange, onRun, errors }: Props) {
  const ed = useRef<Parameters<OnMount>[0] | null>(null);
  const mo = useRef<Parameters<OnMount>[1] | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;

  useEffect(() => {
    const model = ed.current?.getModel();
    const monaco = mo.current;
    if (!model || !monaco) return;
    monaco.editor.setModelMarkers(model, 'javac', errors.map((e) => {
      const line = Math.min(Math.max(e.line, 1), model.getLineCount());
      return { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: model.getLineMaxColumn(line),
        message: e.message, severity: monaco.MarkerSeverity.Error };
    }));
  }, [errors]);

  const decos = useRef<string[]>([]);
  useEffect(() => {
    const e = ed.current;
    if (!e) return;
    decos.current = e.deltaDecorations(decos.current, highlightLine
      ? [{ range: { startLineNumber: highlightLine, startColumn: 1, endLineNumber: highlightLine, endColumn: 1 }, options: { isWholeLine: true, className: 'exec-line' } }] : []);
    if (highlightLine) e.revealLineInCenterIfOutsideViewport(highlightLine);
  }, [highlightLine]);

  return (
    <Editor height="100%" language={language ?? 'java'} theme={theme === 'light' ? 'light' : 'vs-dark'} value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={(editor, monaco) => {
        ed.current = editor; mo.current = monaco;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
      }}
      options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 }, automaticLayout: true }} />
  );
}
