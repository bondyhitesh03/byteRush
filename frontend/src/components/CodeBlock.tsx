import { useState } from 'react';
import { normalizeCode } from '../utils/formatJava';
import { toLines, tokenize, type Token } from '../utils/highlight';
import { useLang } from '../utils/LangContext';
import type { QLang } from '../utils/languages';

// lang: the language to colour (default: the learner's current language), or null for plain text.
// raw: show the code exactly as written (the default tidies Java the way solutions are shown).
export default function CodeBlock({ code, numbers = true, lang: forced, raw = false }: { code: string; numbers?: boolean; lang?: QLang | null; raw?: boolean }) {
  const [copied, setCopied] = useState(false);
  const current = useLang();
  const lang = forced === undefined ? current : forced;
  const text = raw || lang === null ? code : normalizeCode(code, lang);
  const lines: Token[][] = lang === null ? text.split('\n').map((t) => (t ? [{ t }] : [])) : toLines(tokenize(text, lang));
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
