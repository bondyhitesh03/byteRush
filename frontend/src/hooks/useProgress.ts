import { useCallback, useRef, useState } from 'react';
import { applyEvent, displayStreak, emptyProgress, emptyStats, levelInfo, todayKey, type GameEvent, type Progress, type ToastData } from '../utils/progress';

const KEY = 'algocoach-progress';
export interface Toast extends ToastData { id: number }

function load(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress>;
    const base = emptyProgress();
    return { ...base, ...raw, counts: raw.counts ?? {}, stats: { ...emptyStats(), ...raw.stats }, skills: raw.skills ?? {}, solvedKeys: raw.solvedKeys ?? [], achievements: raw.achievements ?? {} };
  } catch { return emptyProgress(); }
}

export function useProgress() {
  const ref = useRef<Progress>(load());
  const [progress, setProgress] = useState<Progress>(ref.current);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const record = useCallback((ev: GameEvent) => {
    const { next, toasts: fresh } = applyEvent(ref.current, ev, todayKey());
    ref.current = next; setProgress(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    fresh.forEach((t, i) => {
      const id = ++seq.current;
      setTimeout(() => {
        setToasts((cur) => [...cur.slice(-3), { ...t, id }]);
        setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 3000);
      }, i * 450);
    });
  }, []);

  const today = todayKey();
  return { progress, level: levelInfo(progress.xp), streak: displayStreak(progress, today), dayXp: progress.day === today ? progress.dayXp : 0, toasts, record };
}
