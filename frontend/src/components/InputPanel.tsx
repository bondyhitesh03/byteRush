import type { Example } from '../types/question';

interface Props { value: string; onChange: (v: string) => void; examples?: Example[] }

export default function InputPanel({ value, onChange, examples }: Props) {
  return (
    <div className="out">
      <div className="label">PROGRAM INPUT (stdin)</div>
      <textarea className="stdin" value={value} onChange={(e) => onChange(e.target.value)} rows={7} spellCheck={false}
        placeholder={'Type what your program reads, e.g.\n5\n1 2 3 4 5'} />
      <p className="muted">This is what <code>Scanner(System.in)</code> reads. Put each value on its own line or separate values with spaces. Leave it empty if your program needs no input.</p>
      <div className="row">
        {examples?.map((ex, i) => <button key={i} onClick={() => onChange(ex.input)}>Use example {i + 1}</button>)}
        {value && <button onClick={() => onChange('')}>Clear input</button>}
      </div>
    </div>
  );
}
