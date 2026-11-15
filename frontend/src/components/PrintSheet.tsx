import type { PracticeProblem } from '../types/question';
import { DIFF_ICON } from '../types/question';
import { normalizeCode } from '../utils/formatJava';
import { toLines, tokenize } from '../utils/highlight';
import { useLang } from '../utils/LangContext';

function PrintCode({ code }: { code: string }) {
  const lang = useLang();
  const lines = toLines(tokenize(normalizeCode(code, lang), lang));
  return (
    <div className="ps-code">
      {lines.map((ln, i) => (
        <div className="ps-line" key={i}><span className="ps-ln">{i + 1}</span><span>{ln.length ? ln.map((t, j) => <span key={j} className={t.c}>{t.t}</span>) : '\u200b'}</span></div>
      ))}
    </div>
  );
}

export default function PrintSheet({ problem, withSolution }: { problem: PracticeProblem | null; withSolution: boolean }) {
  if (!problem) return null;
  const date = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="print-sheet">
      <div className="ps-banner"><div><img className="ps-mark" src="/logo-mark.png" alt="" /><span className="ps-logo">ByteRush</span><span className="ps-tag">Learn. Code. Debug. Level Up.</span></div><span className="ps-lang">☕ Java</span></div>
      <h1 className="ps-title">{problem.title}</h1>
      <div className="ps-meta">
        <span className={`ps-diff ${problem.difficulty}`}>{DIFF_ICON[problem.difficulty]} {problem.difficulty}</span>
        {problem.concepts.map((c) => <span className="ps-chip" key={c}>{c}</span>)}
      </div>
      <section className="ps-sec"><h2>Question</h2><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{problem.statement}</p></section>
      {problem.examples && problem.examples.length > 0 && (
        <section className="ps-sec ex"><h2>Examples</h2>
          {problem.examples.map((e, i) => (
            <div className="ps-ex" key={i}><div><b>Input</b><pre>{e.input || '(none)'}</pre></div><div><b>Output</b><pre>{e.output}</pre></div></div>
          ))}
        </section>
      )}
      {withSolution && problem.solution
        ? <section className="ps-sec sol"><h2>Solution</h2><PrintCode code={problem.solution.code} /><p style={{ margin: '6px 0 0' }}>{problem.solution.explanation}</p></section>
        : <section className="ps-sec ans"><h2>Your answer</h2><div className="ps-ruled" /></section>}
      <div className="ps-foot"><span>Printed {date}</span><span className="ps-wm">~By Hitesh</span></div>
    </div>
  );
}
