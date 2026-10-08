import { useState } from 'react';
import { compareAttempts, getAttempts } from '../services/api';
import type { Attempt, Compare, QuestionStat } from '../types/practice';
import CodeBlock from './CodeBlock';

const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Attempts({ questions }: { questions: QuestionStat[] }) {
  const [open, setOpen] = useState<QuestionStat | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [cmp, setCmp] = useState<Compare | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const choose = async (q: QuestionStat) => {
    setOpen(q); setPicked([]); setCmp(null); setErr('');
    setAttempts(await getAttempts(q.entryId));
  };
  const toggle = (id: string) => { setCmp(null); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2))); };
  const pair = picked.map((id) => attempts.find((a) => a.id === id)).filter((a): a is Attempt => Boolean(a))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const explain = async () => {
    if (!open || pair.length !== 2) return;
    setBusy(true); setErr('');
    const r = await compareAttempts(open.entryId, pair[0].id, pair[1].id);
    setBusy(false);
    if (r.ok) setCmp(r.compare); else setErr(r.message);
  };

  if (questions.length === 0) return <div className="emptypanel"><div className="big">🧪</div><p>Submit a practice problem to see your attempts here.</p></div>;
  return (
    <div>
      <div className="qpills">{questions.map((q) => (
        <button key={q.entryId} className={open?.entryId === q.entryId ? 'primary' : ''} onClick={() => void choose(q)}>
          {q.solved ? '✅' : '🕓'} {q.title} · {q.attempts}
        </button>))}</div>
      {open && (
        <div className="subpanel">
          <h3>{open.title}</h3>
          {attempts.length < 2 && <p className="muted">Submit this problem at least twice to compare attempts.</p>}
          {attempts.map((a) => (
            <label key={a.id} className="arow">
              <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} />
              <span>{when(a.createdAt)}</span><b>{a.passed}/{a.total} tests</b><span className="muted">{a.score != null ? `score ${a.score}` : `correctness ${a.correctness}/70`}</span>
            </label>
          ))}
          {pair.length === 2 && (<>
            <div className="cmp">{pair.map((a, i) => (
              <div key={a.id}><h4>{i === 0 ? 'Earlier attempt' : 'Later attempt'} · {a.passed}/{a.total} tests{a.score != null ? ` · ${a.score}` : ''}</h4><CodeBlock code={a.code} /></div>))}</div>
            <div className="row"><button className="primary" disabled={busy} onClick={() => void explain()}>{busy ? 'Comparing…' : '✨ Explain the difference (1 AI request)'}</button></div>
          </>)}
          {err && <div className="err">{err}</div>}
          {cmp && <div className="okbox rise"><p>{cmp.summary}</p>{cmp.improvements.length > 0 && <ul>{cmp.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>}</div>}
        </div>
      )}
    </div>
  );
}
