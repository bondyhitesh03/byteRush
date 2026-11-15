import type { HistoryItem } from '../types/question';
import { DIFF_ICON } from '../types/question';

interface Props { items: HistoryItem[]; activeId?: string; onOpen: (id: string) => void; onDelete: (id: string) => void; onNew: () => void }

export default function HistoryPanel({ items, activeId, onOpen, onDelete, onNew }: Props) {
  return (
    <aside className="history">
      <div className="hhead"><b>History</b><button onClick={onNew}>+ New</button></div>
      {items.length === 0 && <p className="muted">Your first question is waiting for you 👀</p>}
      {items.map((it) => (
        <div key={it.id} className={`hitem ${it.id === activeId ? 'on' : ''}`} role="button" tabIndex={0}
          onClick={() => onOpen(it.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(it.id); }}>
          <div className="htitle">{it.difficulty ? `${DIFF_ICON[it.difficulty]} ` : ''}{it.title}</div>
          <div className="hmeta">
            {new Date(it.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {it.hasSolution ? ' · solution' : ''}{it.hasRelated ? ' · similar' : ''}
          </div>
          <button className="x" title="Delete" aria-label="Delete question" onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}>×</button>
        </div>
      ))}
    </aside>
  );
}
