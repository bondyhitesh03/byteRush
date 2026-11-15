// Tiny syntax highlighter (VS Code dark-style colours via CSS classes) for Java, Python, C, C++ and JavaScript. No dependencies.
import type { QLang } from './languages';

export interface Token { t: string; c?: string }
interface Cfg { control: Set<string>; keywords: Set<string>; re: RegExp }
const words = (s: string): Set<string> => new Set(s.split(' '));

// Groups: 1 comment, 2 string, 3 number, 4 identifier, 5 preprocessor line (C and C++)
const SLASH = '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)';
const QUOTES = '("(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')';
const NUM = '(\\b\\d[\\d_]*(?:\\.\\d+)?[LlFfDdUu]*\\b)';
const IDENT = '([A-Za-z_$][\\w$]*)';
const JAVA_RE = new RegExp(`${SLASH}|${QUOTES}|${NUM}|${IDENT}`, 'g');
const C_RE = new RegExp(`${SLASH}|${QUOTES}|${NUM}|([A-Za-z_]\\w*)|(^[ \\t]*#[ \\t]*\\w+(?:[ \\t]*(?:<[^>\\n]*>|"[^"\\n]*"))?)`, 'gm');
const JS_RE = new RegExp(`${SLASH}|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|${NUM}|${IDENT}`, 'g');
const PY_RE = new RegExp(`(#[^\\n]*)|("""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*')|${NUM}|([A-Za-z_]\\w*)`, 'g');

const C_CONTROL = 'if else for while do switch case default break continue return goto';
const C_KEYWORDS = 'int char float double long short void unsigned signed const static struct union enum typedef sizeof extern register volatile inline auto NULL';
const CFG: Record<QLang, Cfg> = {
  java: { re: JAVA_RE, control: words('if else for while do switch case default break continue return try catch finally throw throws'),
    keywords: words('public private protected static final abstract class interface enum extends implements void int long double float boolean char byte short import package new this super true false null instanceof var synchronized volatile transient') },
  python: { re: PY_RE, control: words('if elif else for while break continue return try except finally raise with yield pass assert'),
    keywords: words('def class import from as lambda None True False and or not in is global nonlocal del async await') },
  c: { re: C_RE, control: words(C_CONTROL), keywords: words(C_KEYWORDS) },
  cpp: { re: C_RE, control: words(`${C_CONTROL} try catch throw`),
    keywords: words(`${C_KEYWORDS} class public private protected namespace using template typename new delete this virtual override nullptr true false bool operator constexpr final explicit friend mutable static_cast dynamic_cast const_cast reinterpret_cast decltype noexcept`) },
  js: { re: JS_RE, control: words('if else for while do switch case default break continue return try catch finally throw'),
    keywords: words('const let var function class extends new this super import export from async await typeof instanceof in of null undefined true false yield static get set delete void') },
};

export function tokenize(code: string, lang: QLang = 'java'): Token[] {
  const cfg = CFG[lang] ?? CFG.java;
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(cfg.re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: code.slice(last, i) });
    const text = m[0];
    let c: string | undefined;
    if (m[1]) c = 'com';
    else if (m[2]) c = 'str';
    else if (m[3]) c = 'num';
    else if (m[5]) c = 'ctl';
    else if (cfg.control.has(text)) c = 'ctl';
    else if (cfg.keywords.has(text)) c = 'kw';
    else if (/^[A-Z]/.test(text)) c = 'type';
    else if (code[i + text.length] === '(') c = 'fn';
    out.push({ t: text, c });
    last = i + text.length;
  }
  if (last < code.length) out.push({ t: code.slice(last) });
  return out;
}

export function toLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const tok of tokens) {
    tok.t.split('\n').forEach((part, k) => {
      if (k > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ t: part, c: tok.c });
    });
  }
  return lines;
}
