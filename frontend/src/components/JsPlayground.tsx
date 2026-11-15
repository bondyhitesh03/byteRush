import { useEffect, useMemo, useState } from 'react';
import CodeEditor from './CodeEditor';
import InputPanel from './InputPanel';
import ConsolePanel from './ConsolePanel';
import { runJs, type ConsoleEntry, type JsResult } from '../utils/jsRunner';
import { downloadViaLink } from '../utils/download';

const LS = 'algocoach-js-code';
const STARTER = `// Write your code here
// Tip: console.log() shows output in the console. Use input() to read a line from the Input tab.

`;
const read = (): string => { try { return localStorage.getItem(LS) ?? STARTER; } catch { return STARTER; } };
const NO_ERRORS: { line: number; message: string }[] = [];

export default function JsPlayground({ theme, onRunStatus }: { theme: 'dark' | 'light'; onRunStatus: (status: string, code?: string) => void }) {
  const [code, setCode] = useState(read);
  const [stdin, setStdin] = useState(() => { try { return localStorage.getItem('algocoach-stdin-js') ?? ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem('algocoach-stdin-js', stdin); } catch { /* storage unavailable */ } }, [stdin]);
  const [tab, setTab] = useState<'input' | 'console'>('console');
  const [result, setResult] = useState<JsResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => { const id = setTimeout(() => { try { localStorage.setItem(LS, code); } catch { /* storage unavailable */ } }, 300); return () => clearTimeout(id); }, [code]);

  const run = async () => {
    if (running) return;
    setTab('console');
    if (!code.trim()) { setResult({ entries: [], error: { message: 'The editor is empty - write some JavaScript first.' }, timedOut: false, ms: 0 }); return; }
    setRunning(true);
    const r = await runJs(code, stdin);
    setResult(r); setRunning(false);
    onRunStatus(r.timedOut ? 'timeout' : r.error ? 'runtime_error' : 'ok', code);
  };

  const markers = useMemo(() => (result?.error?.line ? [{ line: result.error.line, message: result.error.message }] : NO_ERRORS), [result]);
  const entries: ConsoleEntry[] = result ? [...result.entries, ...(result.error ? [{ level: 'error' as const, text: result.error.message + (result.error.line ? `  (line ${result.error.line})` : '') }] : [])] : [];
  const footer = running ? <div className="cfoot muted pulse">Running…</div>
    : result ? (result.timedOut ? <div className="cfoot warn">⏱ Stopped after 5 seconds. A loop or timer (setInterval) was still running.</div>
      : result.error ? <div className="cfoot bad">✗ Finished with an error · {result.ms} ms</div> : <div className="cfoot ok">✓ Finished · {result.ms} ms</div>) : null;

  return (
    <main>
      <section className="editor"><CodeEditor language="javascript" theme={theme} value={code} onChange={setCode} onRun={run} errors={markers} /></section>
      <section className="side">
        <div className="actions">
          <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
          <button onClick={() => setResult(null)}>Clear console</button>
          <button onClick={() => downloadViaLink('script.js', code, 'text/javascript')} title="Download your code as script.js">⬇ script.js</button>
          <button onClick={() => { if (window.confirm('Clear the editor?')) { setCode(''); setResult(null); } }}>Clear</button>
        </div>
        <div className="ptabs">
          <button className={`tab ${tab === 'input' ? 'on' : ''}`} onClick={() => setTab('input')}>{stdin.trim() ? 'Input •' : 'Input'}</button>
          <button className={`tab ${tab === 'console' ? 'on' : ''}`} onClick={() => setTab('console')}>Console</button>
        </div>
        {tab === 'input'
          ? <InputPanel value={stdin} onChange={setStdin} onRun={run} title="INPUT FOR YOUR PROGRAM"
              hint={<>Read what you type here with <code>input()</code> (one line per call, or <code>null</code> when there are no more lines). <code>inputAll()</code> gives everything at once.</>} />
          : <ConsolePanel entries={entries} footer={footer} emptyText="Press Run (Ctrl/⌘ + Enter) to see your console output here." />}
      </section>
    </main>
  );
}
