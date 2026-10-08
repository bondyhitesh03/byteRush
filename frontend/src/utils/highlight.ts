// Tiny Java syntax highlighter (VS Code dark-style colours via CSS classes). No dependencies.
export interface Token { t: string; c?: string }

const CONTROL = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'throws']);
const KEYWORDS = new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'class', 'interface', 'enum', 'extends', 'implements',
  'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'import', 'package', 'new', 'this', 'super', 'true', 'false', 'null',
  'instanceof', 'var', 'synchronized', 'volatile', 'transient']);
const RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*(?:\.\d+)?[LlFfDd]?\b)|([A-Za-z_$][\w$]*)/g;

export function tokenize(code: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: code.slice(last, i) });
    const text = m[0];
    let c: string | undefined;
    if (m[1]) c = 'com';
    else if (m[2]) c = 'str';
    else if (m[3]) c = 'num';
    else if (CONTROL.has(text)) c = 'ctl';
    else if (KEYWORDS.has(text)) c = 'kw';
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
