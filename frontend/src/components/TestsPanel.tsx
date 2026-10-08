import type { CSSProperties } from 'react';
import type { FinalScore, GradeResult } from '../types/practice';

interface Props {
  gradable: boolean; grading: boolean; grade: GradeResult | null; error: string;
  final: FinalScore | null; finalizing: boolean; onFinalize: () => void; onOpenProgress: () => void;
}
const label = (s: number) => (s >= 90 ? 'Excellent! 🔥' : s >= 75 ? 'Great work!' : s >= 50 ? 'Good progress' : 'Keep going');

export default function TestsPanel({ gradable, grading, grade, error, final, finalizing, onFinalize, onOpenProgress }: Props) {
  if (!gradable) return (
    <div className="out empty"><div className="big">🧪</div>
      <p>Auto-grading isn't available for this question yet.</p>
      <p className="muted">Open it in <b>Questions</b> and press <b>Get solution</b> (or <b>↻ Regenerate solution</b>) to prepare verified test cases.</p></div>
  );
  if (grading) return <div className="out"><div className="muted">Running tests…</div>{[1, 2, 3, 4].map((i) => <div key={i} className="skel w90" />)}</div>;
  if (error) return <div className="out"><div className="err">{error}</div></div>;
  if (!grade) return <div className="out empty"><div className="big">✅</div><p>Press <b>Submit</b> to run your code against all test cases.</p></div>;
  if (grade.compileError) return (
    <div className="out"><div className="label bad">COMPILATION ERROR</div><p>Your code couldn't compile yet, so no tests ran.</p>
      {grade.compileError.errors.map((e, i) => <div key={i} className="err">Line {e.line}: {e.message}</div>)}</div>
  );
  const all = grade.passed === grade.total;
  return (
    <div className="out rise">
      <div className={`scorecard ${all ? 'win' : ''}`}>
        <div className="big-score">{final ? final.score : grade.correctness}<small> / {final ? 100 : 70}</small></div>
        <div><b>{final ? label(final.score) : all ? 'All tests passed! ✨' : 'Not quite — keep going'}</b>
          <p className="muted">{grade.passed} / {grade.total} tests passed{!final && ' · correctness only'}</p></div>
      </div>
      {final && (
        <div className="breakdown">
          <div><small>Correctness</small><b>{final.correctness}/70</b></div>
          <div><small>Efficiency</small><b>{final.efficiency}/15</b></div>
          <div><small>Code quality</small><b>{final.quality}/15</b></div>
          <p className="muted">Time {final.time} · Space {final.space}. {final.effVerdict} {final.qualityVerdict}</p>
        </div>
      )}
      {!final && <div className="row"><button className="primary" disabled={finalizing} onClick={onFinalize}>{finalizing ? 'Scoring…' : '➕ Add efficiency & code quality (1 AI request)'}</button></div>}
      {grade.results.map((r, i) => (
        <details key={r.n} className={`trow ${r.passed ? 'pass' : 'fail'}`} style={{ '--i': i } as CSSProperties}>
          <summary>{r.passed ? '✓' : '✗'} Test {r.n} <span className="muted">{r.visible ? '(example)' : '(hidden)'}{r.status !== 'ok' ? ` · ${r.status.replace('_', ' ')}` : ''}</span></summary>
          {r.visible
            ? <div className="tdetail"><small>Input</small><pre>{r.input || '(none)'}</pre><small>Expected</small><pre>{r.expected}</pre><small>Your output</small><pre className={r.passed ? '' : 'bad'}>{r.actual || '(nothing)'}</pre></div>
            : <div className="tdetail muted">Hidden test. The details stay hidden so you solve the general case.</div>}
        </details>
      ))}
      {grade.attemptId && <p className="muted">Attempt saved. <button onClick={onOpenProgress}>Compare attempts in Progress</button></p>}
    </div>
  );
}
