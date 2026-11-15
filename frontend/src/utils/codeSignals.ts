// Looks at a program's source (not its output) to tell what it practices. No AI and no network, so progress works offline.
import { LANGS, type QLang } from './languages';

// Removes comments and replaces the inside of strings, so keywords in text or comments are not counted.
export function stripNoise(code: string, lang: string): string {
  const py = lang === 'python';
  const n = code.length;
  let out = '';
  let i = 0;
  while (i < n) {
    const c = code[i];
    const d = code[i + 1];
    if (py) {
      if (c === '#') { while (i < n && code[i] !== '\n') i++; continue; }
      if ((c === '"' || c === "'") && code.startsWith(c.repeat(3), i)) { const end = code.indexOf(c.repeat(3), i + 3); i = end < 0 ? n : end + 3; out += '""'; continue; }
    } else {
      if (c === '/' && d === '/') { while (i < n && code[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { const end = code.indexOf('*/', i + 2); i = end < 0 ? n : end + 2; out += ' '; continue; }
      if (lang === 'js' && c === '`') { let j = i + 1; while (j < n && code[j] !== '`') { if (code[j] === '\\') j++; j++; } i = j + 1; out += '""'; continue; }
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && code[j] !== c && code[j] !== '\n') { if (code[j] === '\\') j++; j++; }
      i = j + 1; out += c + c; continue;
    }
    out += c; i++;
  }
  return out;
}

const compact = (s: string): string => s.replace(/\s+/g, '');

// The untouched starter template (or an empty editor) is not a program: it earns nothing.
export function isTrivialCode(code: string, lang: string): boolean {
  const mine = compact(stripNoise(code, lang));
  if (!mine) return true;
  const starter = LANGS[lang as QLang]?.starter;
  return Boolean(starter) && mine === compact(stripNoise(starter, lang));
}

// A short fingerprint of the program's structure: comments, spacing and the text inside strings do not change it,
// so re-running the same program (or changing only what it prints) cannot be farmed for skill points.
export function codeHash(code: string, lang: string): string {
  const s = `${lang}:${compact(stripNoise(code, lang))}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'do', 'try', 'synchronized', 'sizeof', 'new', 'throw', 'case', 'typeof', 'await']);

// Names of the functions/methods the learner wrote (main is not counted).
export function userFunctions(stripped: string, lang: string): string[] {
  const names: string[] = [];
  const grab = (re: RegExp, group = 1) => { for (const m of stripped.matchAll(re)) if (m[group]) names.push(m[group]); };
  if (lang === 'python') grab(/^[ \t]*(?:async\s+)?def\s+(\w+)/gm);
  else if (lang === 'js') {
    grab(/\bfunction\s*\*?\s*(\w+)\s*\(/g);
    grab(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/g);
  } else {
    for (const m of stripped.matchAll(/((?:[\w:<>[\]*&,.?]+\s+)+)(\w+)\s*\(([^;(){}]*)\)\s*(?:const\s*)?(?:throws\s+[\w.,\s]+)?\{/g)) {
      const types = m[1].trim().split(/\s+/);
      if (!CONTROL.has(m[2]) && !types.some((t) => CONTROL.has(t))) names.push(m[2]);
    }
  }
  return names.filter((x) => x !== 'main');
}

// Is there a loop inside another loop?
export function hasNestedLoops(stripped: string, lang: string): boolean {
  if (lang === 'python') {
    const open: number[] = [];
    for (const line of stripped.split('\n')) {
      if (!line.trim()) continue;
      if (/\bfor\b[^\n]*\bin\b[^\n]*\bfor\b[^\n]*\bin\b/.test(line) && /[[({]/.test(line)) return true; // [x for a in A for b in B]
      const indent = line.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length;
      while (open.length && indent <= open[open.length - 1]) open.pop();
      if (/^\s*(?:for|while)\b/.test(line)) { if (open.length) return true; open.push(indent); }
    }
    return false;
  }
  const stack: boolean[] = []; // one entry per open "{": is it a loop body?
  let inLoops = 0;
  let pending = false; // a loop header was seen and its body has not started
  let i = 0;
  const n = stripped.length;
  const word = /^(for|while|do)\b/;
  while (i < n) {
    const c = stripped[i];
    if (/[a-z]/i.test(c) && (i === 0 || !/[\w$]/.test(stripped[i - 1]))) {
      const m = word.exec(stripped.slice(i, i + 6));
      if (m) {
        if (inLoops > 0 || pending) return true;
        pending = true; i += m[1].length;
        if (m[1] !== 'do') { // skip the (...) header, which may contain semicolons
          while (i < n && stripped[i] !== '(') i++;
          let depth = 0;
          for (; i < n; i++) { if (stripped[i] === '(') depth++; else if (stripped[i] === ')' && --depth === 0) { i++; break; } }
        }
        continue;
      }
      while (i < n && /[\w$]/.test(stripped[i])) i++;
      continue;
    }
    if (c === '{') { stack.push(pending); if (pending) inLoops++; pending = false; }
    else if (c === '}') { if (stack.pop()) inLoops--; }
    else if (c === ';') pending = false; // a one-line loop body (or the end of do { } while (...);)
    i++;
  }
  return false;
}
