import type { QLang } from './languages';
// Makes AI-generated Java readable: restores line breaks/indentation when code arrives on one line.

function reformat(src: string): string {
  const out: string[] = [];
  const kinds: boolean[] = []; // one entry per open "{": true = array initializer, false = code block
  let line = '';
  let indent = 0;
  let paren = 0;
  let i = 0;
  const n = src.length;

  const push = (): void => {
    const t = line.trim();
    if (t) out.push('    '.repeat(Math.max(indent, 0)) + t);
    line = '';
  };
  const lastChar = (): string => {
    const t = line.trimEnd();
    if (t) return t[t.length - 1];
    return out.length ? out[out.length - 1].trimEnd().slice(-1) : '';
  };
  const inInit = (): boolean => kinds.length > 0 && kinds[kinds.length - 1];

  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { // string / char literal: copy untouched
      let j = i + 1;
      while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
      line += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === '/' && src[i + 1] === '/') { // line comment ends its line
      let j = src.indexOf('\n', i); if (j < 0) j = n;
      line += src.slice(i, j); push(); i = j + 1; continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
      line += src.slice(i, j); i = j; continue;
    }
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      if (line && !line.endsWith(' ')) line += ' ';
      i++; continue;
    }
    if (ch === '(') { paren++; line += ch; i++; continue; }
    if (ch === ')') { paren--; line += ch; i++; continue; }
    if (ch === '{') {
      const p = lastChar();
      const init = p === '=' || p === ',' || p === ']' || p === '(' || inInit();
      kinds.push(init);
      if (init) { line += '{'; }
      else { line += !line.trim() || line.endsWith(' ') ? '{' : ' {'; push(); indent++; }
      i++; continue;
    }
    if (ch === '}') {
      const init = kinds.pop();
      i++;
      if (init) { line += '}'; continue; }
      push(); indent--; line = '}';
      let k = i;
      while (k < n && /\s/.test(src[k])) k++;
      if (/^(else|catch|finally)\b/.test(src.slice(k, k + 8))) { line += ' '; i = k; }
      else if (k < n && /[;,)]/.test(src[k])) { i = k; }
      else push();
      continue;
    }
    if (ch === ';' && paren <= 0 && !inInit()) { line += ';'; push(); i++; continue; }
    line += ch; i++;
  }
  push();
  return out.join('\n');
}

export function normalizeCode(input: string, lang: QLang = 'java'): string {
  let code = (input ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/^```\w*\n?/, '').replace(/\n?```\s*$/, '');
  // Some models send newlines as the two characters "\" "n" instead of real line breaks.
  const escaped = (code.match(/\\n/g) ?? []).length;
  if (code.split('\n').length < 3 && escaped >= 3) code = code.replace(/\\n/g, '\n').replace(/\\t/g, '    ');
  const lines = code.split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  const collapsed = lines.length <= 3 && code.length > 60;
  const unindented = lines.length > 3 && /\{/.test(code) && !lines.some((l) => /^\s+\S/.test(l));
  // Python's indentation means something, #include lines can't be rebuilt from one line, and template strings confuse the brace logic.
  const canReformat = lang === 'java' || (lang === 'js' && !code.includes('`')) || ((lang === 'c' || lang === 'cpp') && !/^\s*#/m.test(code));
  if (canReformat && (collapsed || unindented || longest > 160)) code = reformat(code);
  return code.replace(/[ \t]+$/gm, '').trim();
}
