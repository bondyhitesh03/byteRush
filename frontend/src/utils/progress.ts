// XP / level / streak / skills / achievements. Pure functions, so they are easy to test and to change.
import { ACHIEVEMENTS } from './achievements';
import { matchSkills } from './skills';
import { levelInfo } from './level';
export { levelInfo };

export type XpKind = 'run_ok' | 'analyze' | 'question' | 'solve';
export interface Stats { runsOk: number; analyses: number; questions: number; solved: number; bugsFixed: number; bestScore: number; lastRunFailed: boolean }
export interface Progress {
  xp: number; streak: number; best: number; lastDay: string; day: string; dayXp: number; counts: Record<string, number>;
  stats: Stats; skills: Record<string, number>; solvedKeys: string[]; achievements: Record<string, string>;
}
export interface ToastData { text: string; tone: 'xp' | 'level' | 'streak' | 'goal' }
export type GameEvent =
  | { type: 'run_ok' } | { type: 'run_fail' } | { type: 'question' }
  | { type: 'analyze'; concepts: string[] }
  | { type: 'solve'; key: string; concepts: string[] }
  | { type: 'score'; score: number };

// Real actions only; each is capped per day so XP can't be farmed by spamming.
export const XP_RULES: Record<XpKind, { xp: number; cap: number }> = {
  run_ok: { xp: 5, cap: 10 },
  analyze: { xp: 10, cap: 5 },
  question: { xp: 10, cap: 5 },
  solve: { xp: 40, cap: 5 },
};
export const DAILY_GOAL = 30;
export const emptyStats = (): Stats => ({ runsOk: 0, analyses: 0, questions: 0, solved: 0, bugsFixed: 0, bestScore: 0, lastRunFailed: false });
export const emptyProgress = (): Progress => ({ xp: 0, streak: 0, best: 0, lastDay: '', day: '', dayXp: 0, counts: {}, stats: emptyStats(), skills: {}, solvedKeys: [], achievements: {} });

export const dayDiff = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const todayKey = (): string => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

// A streak survives ONE missed day; after two or more missed days it resets.
export function displayStreak(p: Progress, today: string): number {
  return p.lastDay && dayDiff(p.lastDay, today) <= 2 ? p.streak : 0;
}

export function applyAward(p: Progress, kind: XpKind, today: string): { next: Progress; toasts: ToastData[]; gained: number } {
  const n: Progress = { ...p, counts: { ...p.counts } };
  if (n.day !== today) { n.day = today; n.dayXp = 0; n.counts = {}; }
  const rule = XP_RULES[kind];
  if ((n.counts[kind] ?? 0) >= rule.cap) return { next: n, toasts: [], gained: 0 };
  const dayXpBefore = n.dayXp;
  const levelBefore = levelInfo(n.xp).level;
  n.xp += rule.xp; n.dayXp += rule.xp; n.counts[kind] = (n.counts[kind] ?? 0) + 1;
  const toasts: ToastData[] = [{ text: `+${rule.xp} XP`, tone: 'xp' }];
  if (n.lastDay !== today) {
    n.streak = n.lastDay && dayDiff(n.lastDay, today) <= 2 ? n.streak + 1 : 1;
    n.lastDay = today; n.best = Math.max(n.best, n.streak);
    if (n.streak > 1) toasts.push({ text: `🔥 ${n.streak} day streak!`, tone: 'streak' });
  }
  const levelAfter = levelInfo(n.xp).level;
  if (levelAfter > levelBefore) toasts.push({ text: `LEVEL UP! 🚀 Level ${levelAfter}`, tone: 'level' });
  if (dayXpBefore < DAILY_GOAL && n.dayXp >= DAILY_GOAL) toasts.push({ text: 'Daily goal complete ✓', tone: 'goal' });
  return { next: n, toasts, gained: rule.xp };
}

const addSkills = (n: Progress, concepts: string[]): ToastData[] => {
  const out: ToastData[] = [];
  for (const id of matchSkills(concepts)) {
    const before = n.skills[id] ?? 0;
    n.skills[id] = before + 1;
    if (before === 0) out.push({ text: `🔓 Skill started: ${id}`, tone: 'goal' });
  }
  return out;
};

export function applyEvent(p: Progress, ev: GameEvent, today: string): { next: Progress; toasts: ToastData[] } {
  let kind: XpKind | null = null;
  if (ev.type === 'run_ok') kind = 'run_ok';
  else if (ev.type === 'analyze') kind = 'analyze';
  else if (ev.type === 'question') kind = 'question';
  else if (ev.type === 'solve' && !p.solvedKeys.includes(ev.key)) kind = 'solve'; // XP once per problem

  let cur = p;
  let toasts: ToastData[] = [];
  let gained = 0;
  if (kind) { const r = applyAward(p, kind, today); cur = r.next; toasts = r.toasts; gained = r.gained; }

  const n: Progress = { ...cur, stats: { ...cur.stats }, skills: { ...cur.skills }, solvedKeys: [...cur.solvedKeys], achievements: { ...cur.achievements } };
  if (ev.type === 'run_ok') { n.stats.runsOk++; if (n.stats.lastRunFailed) { n.stats.bugsFixed++; n.stats.lastRunFailed = false; } }
  else if (ev.type === 'run_fail') n.stats.lastRunFailed = true;
  else if (ev.type === 'question') n.stats.questions++;
  else if (ev.type === 'analyze' && gained > 0) { n.stats.analyses++; addSkills(n, ev.concepts); }
  else if (ev.type === 'solve' && !n.solvedKeys.includes(ev.key)) { n.solvedKeys.push(ev.key); n.stats.solved++; addSkills(n, ev.concepts); }
  else if (ev.type === 'score') n.stats.bestScore = Math.max(n.stats.bestScore, Math.round(ev.score));

  for (const a of ACHIEVEMENTS) {
    if (!n.achievements[a.id] && a.check(n)) { n.achievements[a.id] = today; toasts.push({ text: `🏆 Achievement unlocked: ${a.name}`, tone: 'level' }); }
  }
  return { next: n, toasts };
}
