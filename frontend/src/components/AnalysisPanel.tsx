import { useState, type CSSProperties } from 'react';
import type { Analysis } from '../types/analysis';

interface Props {
  analysis: Analysis | null; loading: boolean; error: string; errorCode: string; stale: boolean;
  onAnalyze: () => void; onOpenSettings: () => void;
}
const ICON = { info: 'ℹ️', warning: '⚠️', bug: '🐛' } as const;

export default function AnalysisPanel({ analysis: a, loading, error, errorCode, stale, onAnalyze, onOpenSettings }: Props) {
  const [open, setOpen] = useState<'time' | 'space' | 'mem'>('time');

  if (loading) return (
    <div className="out"><div className="muted">Analyzing your code…</div>
      <div className="skel w60" /><div className="skel w90" /><div className="skel w80" /><div className="skel w40" /></div>
  );
  if (error) return (
    <div className="out"><div className="err">{error}
      {['quota', 'invalid_key', 'no_key', 'model'].includes(errorCode) && <div className="row"><button className="primary" onClick={onOpenSettings}>Open Settings</button>
        <a className="btnlink" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get a new free key ↗</a></div>}</div></div>
  );
  if (!a) return (
    <div className="out empty"><div className="big">✨</div><p>Press <b>Analyze</b> to see how efficient your code is and roughly how much memory it uses.</p></div>
  );

  const detail = open === 'time' ? a.timeComplexity.explanation : open === 'space' ? a.spaceComplexity.explanation : a.memory.explanation;
  return (
    <div className="out rise">
      {stale && <div className="okbox">Your code changed since this analysis. <button onClick={onAnalyze}>Re-analyze</button></div>}
      <div className="score">
        <div className="ring" style={{ '--p': a.efficiency.score } as CSSProperties}><span>{a.efficiency.score}</span></div>
        <div><b>{a.efficiency.rating}</b><p className="muted">{a.efficiency.verdict}</p></div>
      </div>
      <h4>What it does</h4><p>{a.summary}</p>
      {a.codeQuality && <p><b>Code quality {a.codeQuality.score}/100.</b> <span className="muted">{a.codeQuality.verdict}</span></p>}
      <h4>Efficiency <span className="muted">(tap to learn more)</span></h4>
      <div className="metrics">
        <button className={open === 'time' ? 'on' : ''} onClick={() => setOpen('time')}><small>Time</small><b>{a.timeComplexity.notation}</b></button>
        <button className={open === 'space' ? 'on' : ''} onClick={() => setOpen('space')}><small>Space</small><b>{a.spaceComplexity.notation}</b></button>
        <button className={open === 'mem' ? 'on' : ''} onClick={() => setOpen('mem')}><small>Memory (estimate)</small><b>{a.memory.estimate}</b></button>
      </div>
      <div className="detail">{detail}</div>
      {a.issues.length > 0 && <><h4>Things to check</h4>{a.issues.map((i, k) => <div className={`issue ${i.severity}`} key={k}>{ICON[i.severity]} {i.message}</div>)}</>}
      {a.suggestions.length > 0 && <><h4>Ideas to improve</h4><ul>{a.suggestions.map((s, k) => <li key={k}>{s}</li>)}</ul></>}
      {a.concepts.length > 0 && <div>{a.concepts.map((c) => <span className="chip" key={c}>{c}</span>)}</div>}
      <p className="muted">Complexity and memory figures are AI estimates (JVM baseline memory excluded), not measurements.</p>
    </div>
  );
}
