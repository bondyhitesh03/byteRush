import type { ReactNode } from 'react';
import type { ConsoleEntry } from '../utils/jsRunner';

const MARK: Record<ConsoleEntry['level'], string> = { log: '›', info: 'ℹ', warn: '⚠', error: '✖' };

// A developer-console style list of messages (console.log, warnings, errors).
export default function ConsolePanel({ entries, footer, emptyText, compact }: { entries: ConsoleEntry[]; footer?: ReactNode; emptyText?: string; compact?: boolean }) {
  return (
    <div className={`out jsconsole ${compact ? 'compact' : ''}`}>
      {entries.length === 0 && !footer && <p className="muted">{emptyText ?? 'Console output appears here.'}</p>}
      {entries.map((e, i) => <div key={i} className={`cline ${e.level}`}><span className="cmark" aria-hidden="true">{MARK[e.level]}</span><span className="ctext">{e.text}</span></div>)}
      {footer}
    </div>
  );
}
