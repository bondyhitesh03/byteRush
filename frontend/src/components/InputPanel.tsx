import type { ReactNode } from 'react';
import type { Example } from '../types/question';
import type { QLang } from '../utils/languages';

interface Props { value: string; onChange: (v: string) => void; examples?: Example[]; title?: string; hint?: ReactNode; lang?: QLang; onRun?: () => void }

const SPACED = 'Put each value on its own line or separate values with spaces. Leave it empty if your program needs no input.';
const HINTS: Record<QLang, ReactNode> = {
  java: <>This is what <code>Scanner(System.in)</code> reads. {SPACED}</>,
  c: <>This is what <code>scanf</code> reads. {SPACED}</>,
  cpp: <>This is what <code>cin</code> reads. {SPACED}</>,
  python: <>This is what <code>input()</code> reads, one line per call. Leave it empty if your script needs no input.</>,
  js: <>Read what you type here with <code>input()</code> (one line per call, or <code>null</code> when there are no more lines). <code>inputAll()</code> gives everything at once.</>,
};

export default function InputPanel({ value, onChange, examples, title, hint, lang, onRun }: Props) {
  return (
    <div className="out">
      <div className="label">{title ?? 'PROGRAM INPUT (stdin)'}</div>
      <textarea className="stdin" value={value} onChange={(e) => onChange(e.target.value)} rows={7} spellCheck={false}
        onKeyDown={(e) => { if (onRun && e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); if (!e.repeat) onRun(); } }}
        placeholder={'Type what your program reads, e.g.\n5\n1 2 3 4 5'} />
      <p className="muted">{hint ?? HINTS[lang ?? 'java']}</p>
      <div className="row">
        {examples?.map((ex, i) => <button key={i} onClick={() => onChange(ex.input)}>Use example {i + 1}</button>)}
        {value && <button onClick={() => onChange('')}>Clear input</button>}
      </div>
    </div>
  );
}
