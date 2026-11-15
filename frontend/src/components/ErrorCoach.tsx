import { useState } from 'react';
import { coachError } from '../services/api';
import type { Coach } from '../types/practice';
import type { RunResult } from '../types/run';
import CodeBlock from './CodeBlock';

// Progressive help: understand the error first, then a small hint, a stronger hint, and only then the fix.
export default function ErrorCoach({ code, result, language = 'java' }: { code: string; result: RunResult; language?: string }) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(0); // 1 explanation, 2 hint, 3 stronger hint, 4 fix

  const explain = async () => {
    setLoading(true); setErr('');
    const r = await coachError(code, result.stderr ?? result.message ?? '', result.status, language);
    setLoading(false);
    if (!r.ok) { setErr(r.message + (['quota', 'invalid_key', 'no_key', 'model'].includes(r.code ?? '') ? ' Open Settings → API key.' : '')); return; }
    setCoach(r.coach); setStep(1);
  };

  if (!coach) return (
    <div className="coach">
      <button className="primary" onClick={explain} disabled={loading}>{loading ? 'Thinking…' : '🧑‍🏫 Explain this error'}</button>
      <span className="muted"> One AI request. Hints come step by step.</span>
      {loading && <><div className="skel w80" /><div className="skel w60" /></>}
      {err && <div className="err">{err}</div>}
    </div>
  );
  return (
    <div className="coach rise">
      <h4>What happened</h4><p>{coach.what}</p>
      <h4>Why</h4><p>{coach.why}</p>
      {step >= 2 && <div className="hint">💡 {coach.hint1}</div>}
      {step >= 3 && <div className="hint">🔎 {coach.hint2}</div>}
      {step >= 4 && <><h4>The fix</h4><p>{coach.fix.explanation}</p><CodeBlock code={coach.fix.code} /></>}
      <div className="row">
        {step < 4 && <button className="primary" onClick={() => setStep(step + 1)}>{step === 1 ? '💡 Give me a hint' : step === 2 ? '🔎 Stronger hint' : 'Reveal the fix'}</button>}
        {step < 4 && <span className="muted">Try fixing it yourself first, then press Run again.</span>}
      </div>
    </div>
  );
}
