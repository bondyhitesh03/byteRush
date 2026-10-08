import { useEffect, useState } from 'react';
import type { Trace } from '../types/practice';

interface Props {
  trace: Trace | null; code: string; loading: boolean; error: string; errorCode: string; stale: boolean;
  step: number; onStep: (n: number) => void; onGenerate: () => void; onOpenSettings: () => void;
}

export default function TracePanel({ trace, code, loading, error, errorCode, stale, step, onStep, onGenerate, onOpenSettings }: Props) {
  const [playing, setPlaying] = useState(false);
  const last = trace ? trace.steps.length - 1 : 0;

  useEffect(() => {
    if (!playing || !trace) return;
    if (step >= last) { setPlaying(false); return; }
    const id = setTimeout(() => onStep(step + 1), 1300);
    return () => clearTimeout(id);
  }, [playing, step, trace, last, onStep]);

  if (loading) return <div className="out"><div className="muted">Getting the show ready… 🎬</div><div className="skel w60" /><div className="skel w90" /><div className="skel w80" /></div>;
  if (error) return (
    <div className="out"><div className="err">{error}
      {['quota', 'invalid_key', 'no_key', 'model'].includes(errorCode) && <div className="row"><button className="primary" onClick={onOpenSettings}>Open Settings</button></div>}</div></div>
  );
  if (!trace) return (
    <div className="out empty">
      <div className="big">👣</div><h3>Watch your code run!</h3>
      <p>See what the computer does, one tiny step at a time.</p>
      <ul className="legend"><li>📦 A <b>box</b> holds a value (programmers call it a variable)</li><li>👀 The computer reads <b>one line</b> at a time</li><li>🖥️ The <b>screen</b> shows what your program prints</li></ul>
      <button className="primary" onClick={onGenerate}>Show me!</button><p className="muted">Uses one AI request</p>
    </div>
  );

  const s = trace.steps[Math.min(step, last)];
  const prev = step > 0 ? trace.steps[step - 1].vars : {};
  const entries = Object.entries(s.vars);
  const anyChange = entries.some(([k, v]) => prev[k] !== v);
  const icon = s.output ? '🖨️' : anyChange ? '📦' : '👀';
  const lineText = code.split('\n')[s.line - 1] ?? '';
  const printed = trace.steps.slice(0, step + 1).map((x) => x.output).filter(Boolean).join('');
  const pct = last > 0 ? (step / last) * 100 : 100;

  return (
    <div className="out rise trace">
      {stale && <div className="okbox">Your code changed since this show. <button onClick={onGenerate}>Watch again</button></div>}
      <p className="tsummary">📖 {trace.summary}</p>

      <div className="tprog"><div className="tbar"><span style={{ width: `${pct}%` }} /></div><small>Step {step + 1} of {trace.steps.length}</small></div>
      <div className="tctl">
        <button onClick={() => { setPlaying(false); onStep(0); }} aria-label="Back to the start">⏮ Start</button>
        <button onClick={() => { setPlaying(false); onStep(Math.max(0, step - 1)); }}>◀ Back</button>
        <button className="primary" onClick={() => { if (step >= last) onStep(0); setPlaying(!playing); }}>{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setPlaying(false); onStep(Math.min(last, step + 1)); }}>Next ▶</button>
      </div>
      <input type="range" min={0} max={last} value={step} onChange={(e) => { setPlaying(false); onStep(Number(e.target.value)); }} className="tslider" aria-label="Step" />

      <div className="tbubble" key={step}><span className="temoji">{icon}</span><p>{s.note || 'The computer moves on to the next line.'}</p></div>
      <div className="tread"><small>👀 The computer is reading line {s.line}</small><code>{lineText.trim() || '…'}</code></div>

      <h4>📦 Boxes <span className="muted">(variables)</span></h4>
      {entries.length === 0
        ? <p className="muted">No boxes yet. The computer hasn't made any.</p>
        : <div className="boxes">{entries.map(([k, v]) => {
          const was = prev[k];
          const changed = was !== v;
          return <div key={`${k}:${v}`} className={`vbox ${changed ? 'new' : ''}`}><span className="vname">{k}</span><b>{v}</b>{changed && <small>{was === undefined ? '✨ new box!' : `was ${was}`}</small>}</div>;
        })}</div>}

      <h4>🖥️ Screen</h4>
      <div className="screen">{printed || <span className="dim">Nothing printed yet…</span>}</div>
      {step >= last && <div className="done">🎉 All done! The program finished.</div>}
      <p className="muted">{trace.truncated ? 'Long loops are shortened to the important steps. ' : ''}This show is made by AI (it is not a real debugger), so very tricky programs may be a little off.</p>
    </div>
  );
}
