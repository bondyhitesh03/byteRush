import { useEffect, useMemo, useState, type ReactNode } from 'react';
import CodeEditor from './CodeEditor';
import OutputPanel from './OutputPanel';
import InputPanel from './InputPanel';
import ErrorCoach from './ErrorCoach';
import { runCode } from '../services/api';
import { downloadViaLink } from '../utils/download';
import { starterFor } from '../utils/languages';
import type { RunResult } from '../types/run';

type Lang = 'c' | 'cpp' | 'python';
const SPEC: Record<Lang, { name: string; monaco: string; file: string; mime: string; starter: string; hint: ReactNode }> = {
  c: { name: 'C', monaco: 'c', file: 'main.c', mime: 'text/x-c', starter: '',
    hint: <>This is what <code>scanf</code> reads. Put each value on its own line or separate values with spaces. Leave it empty if your program needs no input.</> },
  cpp: { name: 'C++', monaco: 'cpp', file: 'main.cpp', mime: 'text/x-c++src', starter: '',
    hint: <>This is what <code>cin</code> reads. Put each value on its own line or separate values with spaces. Leave it empty if your program needs no input.</> },
  python: { name: 'Python', monaco: 'python', file: 'main.py', mime: 'text/x-python', starter: '',
    hint: <>This is what <code>input()</code> reads, one line per call. Leave it empty if your script needs no input.</> },
};
const NO_ERRORS: { line: number; message: string }[] = [];

// A Java-style playground for C, C++ and Python: write code, run it, type input, see output and errors.
export default function CodePlayground({ lang, theme, onRunStatus }: { lang: Lang; theme: 'dark' | 'light'; onRunStatus: (status: string, code?: string) => void }) {
  const spec = { ...SPEC[lang], starter: starterFor(lang) };
  const store = `algocoach-code-${lang}`;
  const [code, setCode] = useState(() => { try { return localStorage.getItem(store) ?? spec.starter; } catch { return spec.starter; } });
  const stdinKey = `algocoach-stdin-${lang}`;
  const [stdin, setStdin] = useState(() => { try { return localStorage.getItem(stdinKey) ?? ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem(stdinKey, stdin); } catch { /* storage unavailable */ } }, [stdin, stdinKey]);
  const [tab, setTab] = useState<'input' | 'output'>('output');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => { const id = setTimeout(() => { try { localStorage.setItem(store, code); } catch { /* storage unavailable */ } }, 300); return () => clearTimeout(id); }, [code, store]);

  const run = async () => {
    if (running) return;
    setTab('output');
    if (!code.trim()) { setResult({ status: 'error', message: 'The editor is empty - write some code first.' }); return; }
    setRunning(true);
    const r = await runCode(lang, code, stdin);
    setResult(r); setRunning(false); onRunStatus(r.status, code);
  };

  const markers = useMemo(() => (result?.status === 'compile_error' ? result.errors ?? NO_ERRORS : NO_ERRORS), [result]);

  return (
    <main>
      <section className="editor"><CodeEditor language={spec.monaco} theme={theme} value={code} onChange={setCode} onRun={run} errors={markers} /></section>
      <section className="side">
        <div className="actions">
          <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
          <button onClick={() => setResult(null)}>Clear output</button>
          <button onClick={() => downloadViaLink(spec.file, code, spec.mime)} title={`Download your code as ${spec.file}`}>⬇ {spec.file}</button>
          <button onClick={() => { if (window.confirm('Reset the editor to the empty template?')) { setCode(spec.starter); setResult(null); } }}>Reset</button>
        </div>
        <div className="ptabs">
          <button className={`tab ${tab === 'input' ? 'on' : ''}`} onClick={() => setTab('input')}>{stdin.trim() ? 'Input •' : 'Input'}</button>
          <button className={`tab ${tab === 'output' ? 'on' : ''}`} onClick={() => setTab('output')}>Output</button>
        </div>
        {tab === 'input'
          ? <InputPanel value={stdin} onChange={setStdin} hint={spec.hint} onRun={run} />
          : <OutputPanel result={result} running={running}
              extra={result ? <ErrorCoach key={`${result.status}|${result.stderr}|${code.length}`} code={code} result={result} language={lang} /> : null} />}
      </section>
    </main>
  );
}
