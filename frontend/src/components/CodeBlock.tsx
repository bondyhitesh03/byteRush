import { useState } from 'react';
import { normalizeCode } from '../utils/formatJava';
import { toLines, tokenize } from '../utils/highlight';

export default function CodeBlock({ code, numbers = true }: { code: string; numbers?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = normalizeCode(code);
  const lines = toLines(tokenize(text));
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="code">
      <button className="copy" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      <div className="code-body">
        {lines.map((ln, i) => (
          <div className="cl" key={i}>
            {numbers && <span className="ln">{i + 1}</span>}
            <span>{ln.length ? ln.map((tk, j) => <span key={j} className={tk.c}>{tk.t}</span>) : '\u200b'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
