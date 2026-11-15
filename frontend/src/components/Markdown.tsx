import { Fragment, useMemo, type ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from '../utils/markdown';
import type { QLang } from '../utils/languages';
import CodeBlock from './CodeBlock';

// ```lang tags people write -> the highlighter's languages. '' (no tag) uses the note's own language; anything else is plain text.
const TAGS: Record<string, QLang> = { java: 'java', py: 'python', python: 'python', python3: 'python', c: 'c', h: 'c', cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', js: 'js', javascript: 'js', node: 'js', jsx: 'js', ts: 'js', typescript: 'js' };
export const codeLang = (tag: string, fallback: QLang): QLang | null => (tag === '' ? fallback : TAGS[tag] ?? null);

function inline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text': return <Fragment key={i}>{n.v}</Fragment>;
      case 'br': return <br key={i} />;
      case 'code': return <code key={i} className="md-code">{n.v}</code>;
      case 'strong': return <strong key={i}>{inline(n.c)}</strong>;
      case 'em': return <em key={i}>{inline(n.c)}</em>;
      case 'del': return <del key={i}>{inline(n.c)}</del>;
      case 'link': return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow">{inline(n.c)}</a>;
    }
  });
}

function blocks(list: Block[], lang: QLang): ReactNode {
  return list.map((b, i) => {
    switch (b.t) {
      case 'heading': { const H = `h${b.level}` as 'h1'; return <H key={i} className={`md-h md-h${b.level}`}>{inline(b.c)}</H>; }
      case 'para': return <p key={i}>{inline(b.c)}</p>;
      case 'code': return <div key={i} className="md-block"><CodeBlock code={b.v} lang={codeLang(b.lang, lang)} raw numbers={false} /></div>;
      case 'quote': return <blockquote key={i}>{blocks(b.c, lang)}</blockquote>;
      case 'hr': return <hr key={i} />;
      case 'list': {
        const items = b.items.map((it, k) => (
          <li key={k} className={it.task === null ? undefined : 'md-task'}>
            {it.task !== null && <span className={`md-box ${it.task ? 'on' : ''}`} aria-label={it.task ? 'done' : 'not done'}>{it.task ? '☑' : '☐'}</span>}
            <div className="md-li">{blocks(it.c, lang)}</div>
          </li>));
        return b.ordered ? <ol key={i} start={b.start}>{items}</ol> : <ul key={i}>{items}</ul>;
      }
      case 'table': return (
        <div key={i} className="md-table"><table>
          <thead><tr>{b.head.map((h, k) => <th key={k} style={{ textAlign: b.align[k] ?? undefined }}>{inline(h)}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} style={{ textAlign: b.align[j] ?? undefined }}>{inline(c)}</td>)}</tr>)}</tbody>
        </table></div>
      );
    }
  });
}

// Renders Markdown as React elements (no HTML string is ever injected), so nothing in a note can run code.
export default function Markdown({ text, lang }: { text: string; lang: QLang }) {
  const tree = useMemo(() => parseMarkdown(text), [text]);
  return <div className="md">{blocks(tree, lang)}</div>;
}
