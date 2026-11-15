import type { LeetCode, Related } from '../types/question';
import { DIFF_ICON } from '../types/question';

interface Props {
  related?: Related[]; leetcode?: LeetCode[]; loading: boolean; error: string; errorCode: string;
  onFind: (force: boolean) => void; onOpenSettings: () => void; onPractice: (r: Related) => void; onAdd: (r: Related) => void;
}

export default function SimilarList({ related, leetcode, loading, error, errorCode, onFind, onOpenSettings, onPractice, onAdd }: Props) {
  if (loading) return <div className="out"><div className="muted">Finding similar questions…</div><div className="skel w80" /><div className="skel w60" /><div className="skel w90" /></div>;
  if (error) return (
    <div className="out"><div className="err">{error}
      {['quota', 'invalid_key', 'no_key', 'model'].includes(errorCode) && <div className="row"><button className="primary" onClick={onOpenSettings}>Open Settings</button>
        <a className="btnlink" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get a free key ↗</a></div>}</div></div>
  );
  if (!related) return (
    <div className="out empty"><div className="big">🔎</div><p>Find 3 similar questions plus LeetCode picks on the same concept.</p>
      <button className="primary" onClick={() => onFind(false)}>Find similar questions</button><p className="muted">Uses one AI request</p></div>
  );
  return (
    <div className="out rise">
      {related.map((r) => (
        <div className="card" key={r.title}>
          <b>{DIFF_ICON[r.difficulty]} {r.title}</b> {r.concepts.map((c) => <span className="chip" key={c}>{c}</span>)}
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.statement}</p>
          <div className="row"><button onClick={() => onPractice(r)}>Practice</button><button onClick={() => onAdd(r)}>📒 Add to notebook</button></div>
        </div>
      ))}
      {leetcode && leetcode.length > 0 && (<>
        <h4>LeetCode practice</h4>
        {leetcode.map((l) => (
          <div className="card" key={l.slug}>
            <a className="lclink" href={`https://leetcode.com/problems/${l.slug}/`} target="_blank" rel="noopener noreferrer"><b>#{l.number} · {l.title}</b><span>{DIFF_ICON[l.difficulty]} {l.difficulty} ↗</span></a>
            {l.why && <p className="muted">{l.why}</p>}
            <a className="small" href={`https://leetcode.com/problemset/?search=${encodeURIComponent(l.title)}`} target="_blank" rel="noopener noreferrer">Link not working? Search it on LeetCode ↗</a>
          </div>
        ))}
        <p className="muted">LeetCode picks are AI suggestions. Check that the number and title match when one opens.</p>
      </>)}
      <button onClick={() => onFind(true)}>↻ Find different ones</button>
    </div>
  );
}
