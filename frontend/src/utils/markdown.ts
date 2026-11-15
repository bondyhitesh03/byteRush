// A small, safe Markdown parser for notes. It produces a tree (never HTML), so nothing a note contains can run as markup.
// Supported: # headings, paragraphs, **bold**, *italic*, ~~strike~~, `code`, ``` code blocks ```, - / 1. lists (nested, with [ ] tasks),
// > quotes, --- rules, | tables |, [links](https://...) and plain https:// links.

export type Inline =
  | { t: 'text'; v: string } | { t: 'code'; v: string } | { t: 'br' }
  | { t: 'strong' | 'em' | 'del'; c: Inline[] } | { t: 'link'; href: string; c: Inline[] };
export interface ListItem { task: boolean | null; c: Block[] }
export type Align = 'left' | 'center' | 'right' | null;
export type Block =
  | { t: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; c: Inline[] }
  | { t: 'para'; c: Inline[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'quote'; c: Block[] }
  | { t: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { t: 'hr' }
  | { t: 'table'; head: Inline[][]; align: Align[]; rows: Inline[][][] };

// Only web and mail links are allowed. javascript:, data: and the like are shown as plain text.
export const safeUrl = (u: string): string | null => (/^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(u.trim()) ? u.trim() : null);

// ---------- inline ----------
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~>]/;
const isWord = (c: string | undefined): boolean => c !== undefined && /[A-Za-z0-9]/.test(c);

// Index of the closing delimiter that matches an opener whose content starts at `from`, or -1.
function findClose(src: string, from: number, delim: string): number {
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (c === '`') { const m = /^(`+)[\s\S]*?[^`]\1(?!`)/.exec(src.slice(i)); if (m) { i += m[0].length - 1; continue; } }
    if (src.startsWith(delim, i) && i > from && !/\s/.test(src[i - 1])) {
      if (delim.length === 1 && (src[i + 1] === delim || src[i - 1] === delim)) continue; // part of ** or __
      return i;
    }
  }
  return -1;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length && ESCAPABLE.test(src[i + 1])) { buf += src[i + 1]; i += 2; continue; }
    if (c === '\n') { flush(); out.push({ t: 'br' }); i++; continue; }
    if (c === '`') {
      const m = /^(`+)([\s\S]*?[^`])\1(?!`)/.exec(src.slice(i));
      if (m) { flush(); out.push({ t: 'code', v: m[2].replace(/^ (.*) $/, '$1') }); i += m[0].length; continue; }
    }
    if (c === '!' && src[i + 1] === '[') { // images are not loaded: show the alt text as a link
      const m = /^!\[((?:[^[\]\\]|\\.)*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/.exec(src.slice(i));
      if (m) { flush(); const href = safeUrl(m[2]); const alt = [{ t: 'text', v: `🖼 ${m[1] || 'image'}` } as Inline]; out.push(href ? { t: 'link', href, c: alt } : alt[0]); i += m[0].length; continue; }
    }
    if (c === '[') {
      const m = /^\[((?:[^[\]\\]|\\.)*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/.exec(src.slice(i));
      if (m) {
        flush(); const href = safeUrl(m[2]); const inner = parseInline(m[1]);
        if (href) out.push({ t: 'link', href, c: inner }); else out.push(...inner);
        i += m[0].length; continue;
      }
    }
    if ((c === 'h' || c === 'H') && /^https?:\/\//i.test(src.slice(i, i + 8)) && !isWord(src[i - 1])) {
      const m = /^https?:\/\/[^\s<]+/i.exec(src.slice(i));
      if (m) {
        const url = m[0].replace(/[.,;:!?)\]]+$/, '');
        const href = safeUrl(url);
        if (href) { flush(); out.push({ t: 'link', href, c: [{ t: 'text', v: url }] }); i += url.length; continue; }
      }
    }
    let matched = false;
    for (const [delim, t] of [['**', 'strong'], ['__', 'strong'], ['~~', 'del'], ['*', 'em'], ['_', 'em']] as const) {
      if (!src.startsWith(delim, i)) continue;
      if (delim === '_' && isWord(src[i - 1])) break; // snake_case is not italic
      if (delim.length === 1 && src[i + 1] === delim) break;
      if (/\s/.test(src[i + delim.length] ?? ' ')) break; // an opener is followed by text
      const end = findClose(src, i + delim.length, delim);
      if (end < 0 || (delim === '_' && isWord(src[end + 1]))) break;
      flush(); out.push({ t, c: parseInline(src.slice(i + delim.length, end)) }); i = end + delim.length; matched = true;
      break;
    }
    if (matched) continue;
    buf += c; i++;
  }
  flush();
  return out;
}

// ---------- blocks ----------
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const indentOf = (s: string): number => s.replace(/\t/g, '    ').length;
const cells = (line: string): string[] => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

const startsBlock = (lines: string[], i: number): boolean => {
  const l = lines[i];
  return FENCE.test(l) || HEADING.test(l) || HR.test(l) || QUOTE.test(l) || LIST.test(l) || (l.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-'));
};

function parseList(lines: string[], start: number): [Block, number] {
  const first = LIST.exec(lines[start])!;
  const base = indentOf(first[1]);
  const ordered = /\d/.test(first[2]);
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const m = LIST.exec(lines[i]);
    if (!m || indentOf(m[1]) !== base || /\d/.test(m[2]) !== ordered) break;
    let text = m[3];
    let task: boolean | null = null;
    const tm = /^\[( |x|X)\]\s+(.*)$/.exec(text);
    if (tm) { task = tm[1] !== ' '; text = tm[2]; }
    const body: string[] = [text];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { // a blank line only continues the item when more indented text follows
        let j = i; while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && indentOf(lines[j].match(/^\s*/)![0]) > base) { body.push(''); i++; continue; }
        break;
      }
      const ind = indentOf(l.match(/^\s*/)![0]);
      if (ind <= base) break; // next item, a parent item or normal text
      body.push(l.replace(/\t/g, '    ').slice(Math.min(ind, base + 2)));
      i++;
    }
    items.push({ task, c: parseBlocks(body) });
    while (i < lines.length && !lines[i].trim()) { // blank lines between items: keep the list going if another item follows
      let j = i; while (j < lines.length && !lines[j].trim()) j++;
      const nm = j < lines.length ? LIST.exec(lines[j]) : null;
      if (nm && indentOf(nm[1]) === base && /\d/.test(nm[2]) === ordered) i = j; else break;
    }
  }
  return [{ t: 'list', ordered, start: ordered ? Number.parseInt(first[2], 10) : 1, items }, i];
}

function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m = FENCE.exec(line);
    if (m) {
      const fence = m[1];
      const close = new RegExp(`^\\s{0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++]);
      i++; // the closing fence (a block that is never closed runs to the end)
      out.push({ t: 'code', lang: m[2].toLowerCase(), v: buf.join('\n') });
      continue;
    }
    m = HEADING.exec(line);
    if (m) { out.push({ t: 'heading', level: m[1].length as 1 | 2 | 3 | 4 | 5 | 6, c: parseInline(m[2]) }); i++; continue; }
    if (HR.test(line)) { out.push({ t: 'hr' }); i++; continue; }
    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) buf.push(lines[i++].replace(QUOTE, ''));
      out.push({ t: 'quote', c: parseBlocks(buf) });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c): Align => (/^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : /^:-+$/.test(c) ? 'left' : null));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { rows.push(head.map((_, k) => parseInline(cells(lines[i])[k] ?? ''))); i++; }
      out.push({ t: 'table', head: head.map((h) => parseInline(h)), align: head.map((_, k) => align[k] ?? null), rows });
      continue;
    }
    if (LIST.test(line)) { const [b, next] = parseList(lines, i); out.push(b); i = next; continue; }
    const buf: string[] = [line.trimEnd()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) buf.push(lines[i++].trimEnd());
    out.push({ t: 'para', c: parseInline(buf.join('\n').trim()) });
  }
  return out;
}

export const parseMarkdown = (src: string): Block[] => parseBlocks(src.replace(/\r\n?/g, '\n').split('\n'));
