import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';
const KEY = 'algocoach-theme';
const resolve = (t: Theme): 'dark' | 'light' => (t === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t);

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'system' ? v : 'dark'; } catch { return 'dark'; }
  });
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => resolve(theme));

  useEffect(() => {
    const apply = () => { const r = resolve(theme); setResolved(r); document.documentElement.dataset.theme = r; };
    apply();
    try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return { theme, setTheme, resolved };
}
