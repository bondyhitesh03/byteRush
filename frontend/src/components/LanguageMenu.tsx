import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export type Lang = 'java' | 'python' | 'c' | 'cpp' | 'js' | 'web';
const OPTIONS: { id: Lang; icon: string; name: string; hint: string }[] = [
  { id: 'java', icon: '☕', name: 'Java', hint: 'Run, practice, notebook' },
  { id: 'python', icon: '🐍', name: 'Python', hint: 'Run scripts' },
  { id: 'c', icon: '🔵', name: 'C', hint: 'Compile and run' },
  { id: 'cpp', icon: '🟣', name: 'C++', hint: 'Compile and run' },
  { id: 'js', icon: '🟨', name: 'JavaScript', hint: 'Run in the console' },
  { id: 'web', icon: '🌐', name: 'HTML, CSS & JS', hint: 'Live preview' },
];

// A small custom dropdown: clean pill, soft popover, keyboard friendly (↑ ↓ Enter Esc).
export default function LanguageMenu({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const toggle = () => { setFocus(Math.max(0, OPTIONS.findIndex((o) => o.id === value))); setOpen((o) => !o); };
  const pick = (l: Lang) => { onChange(l); setOpen(false); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { toggle(); return; }
      setFocus((f) => (f + (e.key === 'ArrowDown' ? 1 : OPTIONS.length - 1)) % OPTIONS.length);
    } else if (e.key === 'Enter' && open) { e.preventDefault(); pick(OPTIONS[focus].id); }
  };

  return (
    <div className="lm" ref={root} onKeyDown={onKey}>
      <button className="lm-btn" onClick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label={`Language: ${current.name}`} title="Choose a language">
        <span>{current.icon}</span><span>{current.name}</span><span className="lm-chev" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="lm-menu" role="listbox" aria-label="Language">
          {OPTIONS.map((o, i) => (
            <button key={o.id} role="option" aria-selected={o.id === value} className={`lm-item ${o.id === value ? 'on' : ''} ${i === focus ? 'focus' : ''}`}
              onMouseEnter={() => setFocus(i)} onClick={() => pick(o.id)}>
              <span className="lm-icon">{o.icon}</span>
              <span className="lm-text"><span className="lm-name">{o.name}</span><span className="lm-hint">{o.hint}</span></span>
              {o.id === value && <span className="lm-check" aria-hidden="true">✓</span>}
            </button>
          ))}
          <div className="lm-soon">More languages coming soon</div>
        </div>
      )}
    </div>
  );
}
