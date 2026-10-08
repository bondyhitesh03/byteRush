import type { ReactNode } from 'react';
import type { RunResult } from '../types/run';
import { DAILY_GOAL } from '../utils/progress';

export default function OutputPanel({ result, running, dayXp, extra }: { result: RunResult | null; running: boolean; dayXp?: number; extra?: ReactNode }) {
  const failed = !running && result !== null && ['compile_error', 'runtime_error', 'timeout'].includes(result.status);
  return <div className="outcol"><OutputBody result={result} running={running} dayXp={dayXp} />{failed && extra}</div>;
}

function OutputBody({ result, running, dayXp }: { result: RunResult | null; running: boolean; dayXp?: number }) {
  if (running) return <div className="out muted pulse">Compiling and running in the sandbox…</div>;
  if (!result) return (
    <div className="out empty"><div className="big">▶</div>
      <p>Press <b>Run</b> <kbd>Ctrl/⌘ + Enter</kbd> to see your output here.</p>
      {dayXp !== undefined && <div className="goal"><div className="goalbar"><span style={{ width: `${Math.min(100, (dayXp / DAILY_GOAL) * 100)}%` }} /></div>
        <small>{dayXp >= DAILY_GOAL ? 'Daily goal complete ✓' : `Daily goal: ${dayXp} / ${DAILY_GOAL} XP`}</small></div>}
    </div>);
  const t = result.timeMs != null ? `${result.timeMs} ms` : '';
  switch (result.status) {
    case 'ok':
      return <div className="out"><div className="label">OUTPUT</div>
        <pre>{result.stdout || '(no output)'}</pre>
        {result.truncated && <div className="warn">Output truncated at 64 KB.</div>}
        <div className="ok">✓ Executed successfully · {t} <span className="muted">(includes container startup)</span></div></div>;
    case 'compile_error':
      return <div className="out"><div className="label bad">COMPILATION ERROR</div>
        <p>Your code couldn't compile yet. Let's figure out why.</p>
        {result.errors?.map((e, i) => <div key={i} className="err">Line {e.line}: {e.message}</div>)}
        <pre className="bad">{result.stderr}</pre></div>;
    case 'runtime_error':
      return <div className="out"><div className="label bad">RUNTIME ERROR</div>
        {result.stdout && <pre>{result.stdout}</pre>}<pre className="bad">{result.stderr}</pre>
        {/NoSuchElement|InputMismatch/.test(result.stderr ?? '') && <div className="hint">💡 Your program is waiting for input. Add it in the <b>Input</b> tab, then run again.</div>}</div>;
    case 'timeout':
      return <div className="out"><div className="label bad">TIME LIMIT EXCEEDED</div>
        {result.stdout && <pre>{result.stdout}</pre>}<p className="bad">{result.stderr}</p></div>;
    default:
      return <div className="out"><div className="label bad">{result.status === 'unavailable' ? 'RUNNER UNAVAILABLE' : 'ERROR'}</div>
        <p className="bad">{result.message}</p>
        {result.status === 'unavailable' && <p className="muted">Check that Docker is running and the Java image is pulled (see README).</p>}</div>;
  }
}
