import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEvent, displayStreak, emptyProgress, levelInfo, normalize, streakState, todayKey, type GameEvent, type Progress, type ToastData } from '../utils/progress';
import { questStates } from '../utils/quests';

const KEY = 'algocoach-progress';
export interface Toast extends ToastData { id: number }

function load(): Progress {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return emptyProgress(); }
}
const save = (p: Progress): void => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } };

export function useProgress() {
  const ref = useRef<Progress>(load());
  const [progress, setProgress] = useState<Progress>(ref.current);
  const [today, setToday] = useState(todayKey);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  // A new day starts at midnight even if the page stays open.
  useEffect(() => {
    const id = setInterval(() => setToday((t) => { const now = todayKey(); return now === t ? t : now; }), 30000);
    return () => clearInterval(id);
  }, []);

  const record = useCallback((ev: GameEvent) => {
    const { next, toasts: fresh } = applyEvent(ref.current, ev, todayKey());
    ref.current = next; setProgress(next); save(next);
    fresh.forEach((t, i) => {
      const id = ++seq.current;
      setTimeout(() => {
        setToasts((cur) => [...cur.slice(-3), { ...t, id }]);
        setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 3200);
      }, i * 450);
    });
  }, []);

  const reset = useCallback(() => { const fresh = emptyProgress(); ref.current = fresh; setProgress(fresh); save(fresh); }, []);

  const day = progress.daily[today];
  const quests = questStates(today, day);
  return {
    progress, today, toasts, record, reset, quests,
    level: levelInfo(progress.xp), streak: displayStreak(progress, today), streakState: streakState(progress, today), dayXp: day?.xp ?? 0,
  };
}
