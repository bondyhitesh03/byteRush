import { useState } from 'react';
import CodeEditor from './CodeEditor';
import OutputPanel from './OutputPanel';
import InputPanel from './InputPanel';
import TestsPanel from './TestsPanel';
import ErrorCoach from './ErrorCoach';
import CodeBlock from './CodeBlock';
import { analyzeCode, finalizeScore, gradeCode, runCode } from '../services/api';
import { normalizeCode } from '../utils/formatJava';
import type { RunResult } from '../types/run';
import type { FinalScore, GradeResult } from '../types/practice';
import type { PracticeProblem } from '../types/question';
import { DIFF_ICON } from '../types/question';

interface Props {
  theme: 'dark' | 'light'; problem: PracticeProblem;
  onRunStatus: (status: string) => void; onSolved: (key: string, concepts: string[]) => void; onScore: (score: number) => void; onOpenProgress: () => void;
  onPrint: (withSolution: boolean) => void; onGetSolution: (statement: string) => void; onBack: () => void;
}

export default function PracticeView({ theme, problem, onRunStatus, onSolved, onScore, onOpenProgress, onPrint, onGetSolution, onBack }: Props) {
  const [code, setCode] = useState(normalizeCode(problem.starterCode));
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [hints, setHints] = useState(0);
  const [showSol, setShowSol] = useState(false);
  const [stdin, setStdin] = useState(problem.sampleInput ?? '');
  const [tab, setTab] = useState<'input' | 'output' | 'tests'>('output');
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [gErr, setGErr] = useState('');
  const [final, setFinal] = useState<FinalScore | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const gradable = (problem.testCount ?? 0) >= 3;

  const run = async () => {
    if (running) return;
    setTab('output');
    if (!code.trim()) return setResult({ status: 'error', message: 'The editor is empty - write some Java first.' });
    setRunning(true); const r = await runCode('java', code, stdin); setResult(r); setRunning(false); onRunStatus(r.status);
  };

  const submit = async () => {
    if (grading) return;
    setTab('tests'); setGErr(''); setFinal(null); setGrade(null);
    if (!gradable) return;
    if (!code.trim()) { setGErr('The editor is empty - write some Java first.'); return; }
    setGrading(true);
    const r = await gradeCode(problem.statement, code);
    setGrading(false);
    if (!r.ok) { setGErr(r.message); return; }
    setGrade(r);
    if (!r.compileError && r.passed === r.total) onSolved(problem.statement, problem.concepts);
  };

  const finalize = async () => {
    if (!grade || finalizing) return;
    setFinalizing(true); setGErr('');
    const a = await analyzeCode(code);
    if (!a.ok) { setGErr(a.message); setFinalizing(false); return; }
    const q = a.analysis.codeQuality?.score ?? a.analysis.efficiency.score;
    const s = await finalizeScore(problem.statement, grade.attemptId, a.analysis.efficiency.score, q);
    setFinalizing(false);
    if (!s.ok) { setGErr(s.message); return; }
    setFinal({ score: s.score, correctness: s.correctness, efficiency: s.efficiency, quality: s.quality, time: a.analysis.timeComplexity.notation, space: a.analysis.spaceComplexity.notation,
      effVerdict: a.analysis.efficiency.verdict, qualityVerdict: a.analysis.codeQuality?.verdict ?? '' });
    onScore(s.score);
  };

  const allHints = problem.hints ?? [];
  const tabBtn = (t: 'input' | 'output' | 'tests', text: string) => <button className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{text}</button>;

  return (
    <div className="practice">
      <section className="problem">
        <button onClick={onBack}>← Back to question</button>
        <h2>{DIFF_ICON[problem.difficulty]} {problem.title}</h2>
        <div>{problem.concepts.map((c) => <span className="chip" key={c}>{c}</span>)}</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{problem.statement}</p>
        {problem.examples?.map((e, i) => <div key={i}><b>Example {i + 1}</b><pre>Input: {e.input}{'\n'}Output: {e.output}</pre></div>)}
        <p className="muted">Use <b>Run</b> to try your code with your own input, and <b>Submit</b> to grade it against all tests{gradable ? '' : ' (not available for this question yet)'}.</p>
        {allHints.slice(0, hints).map((h, i) => <div className="hint" key={i}>💡 {h}</div>)}
        <div className="row">
          {hints < allHints.length && <button onClick={() => setHints(hints + 1)}>Hint ({hints}/{allHints.length})</button>}
          <button onClick={() => onPrint(false)}>🖨 Print</button>
          {problem.solution
            ? <button onClick={() => setShowSol(!showSol)}>{showSol ? 'Hide solution' : 'Reveal solution'}</button>
            : <button onClick={() => onGetSolution(problem.statement)}>Generate solution</button>}
        </div>
        {showSol && problem.solution && <><CodeBlock code={problem.solution.code} /><p>{problem.solution.explanation}</p></>}
      </section>
      <section className="work">
        <div className="editor"><CodeEditor theme={theme} value={code} onChange={setCode} onRun={run} errors={result?.status === 'compile_error' ? result.errors ?? [] : []} /></div>
        <div className="actions">
          <button onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
          <button className="primary" onClick={submit} disabled={grading}>{grading ? 'Grading…' : '✅ Submit'}</button>
          <button onClick={() => { setCode(normalizeCode(problem.starterCode)); setResult(null); }}>Reset</button>
        </div>
        <div className="ptabs">{tabBtn('input', stdin.trim() ? 'Input •' : 'Input')}{tabBtn('output', 'Output')}{tabBtn('tests', grade ? `Tests ${grade.passed}/${grade.total}` : 'Tests')}</div>
        <div className="outwrap">
          {tab === 'input' && <InputPanel value={stdin} onChange={setStdin} examples={problem.examples} />}
          {tab === 'output' && <OutputPanel result={result} running={running}
            extra={result ? <ErrorCoach key={`${result.status}|${result.stderr}|${code.length}`} code={code} result={result} /> : null} />}
          {tab === 'tests' && <TestsPanel gradable={gradable} grading={grading} grade={grade} error={gErr} final={final} finalizing={finalizing} onFinalize={finalize} onOpenProgress={onOpenProgress} />}
        </div>
      </section>
    </div>
  );
}
