// XP / level / streak / daily quests / skills / achievements. Pure functions, so they are easy to test and to change.
import { ACHIEVEMENTS, achievementProgress } from './achievements';
import { codeHash, isTrivialCode } from './codeSignals';
import { addDays, dayDiff, todayKey, weekStart } from './dates';
import { levelInfo, levelTitle } from './level';
import { QUEST_BONUS, questStates, questsFor } from './quests';
import { SKILLS, detectSkills, matchSkills, skillState, type SkillLabel } from './skills';
export { levelInfo, todayKey, dayDiff };

export type XpKind = 'run_ok' | 'analyze' | 'question' | 'solve';
export interface Stats { runsOk: number; analyses: number; questions: number; solved: number; bugsFixed: number; bestScore: number; lastRunFailed: boolean; questsDone: number; questDays: number }
// Everything that happened on one calendar day. Drives the daily goal, the quests, the week view and the activity map.
export interface DayLog {
  xp: number; questXp: number; // xp = everything earned that day, questXp = the part that came from quest rewards
  runs: number; fixes: number; solves: number; analyses: number; questions: number;
  counts: Partial<Record<XpKind, number>>; // XP-earning actions so far, for the daily caps
  langs: string[]; skills: string[]; // languages run and skills practiced that day
  skillRun: Record<string, number>; // skill points that came from running code (capped per day)
  claimed: string[]; bonus: boolean; // quests already paid out, and the all-three bonus
}
export interface LangStat { xp: number; runs: number; solves: number }
export interface Progress {
  xp: number; streak: number; best: number; lastDay: string;
  stats: Stats; skills: Record<string, number>; solvedKeys: string[]; achievements: Record<string, string>;
  daily: Record<string, DayLog>; langs: Record<string, LangStat>; seen: string[];
}
export interface ToastData { text: string; tone: 'xp' | 'level' | 'streak' | 'goal' | 'quest' | 'skill' }
export type GameEvent =
  | { type: 'run_ok'; lang?: string; code?: string } | { type: 'run_fail'; lang?: string } | { type: 'question'; lang?: string }
  | { type: 'analyze'; concepts: string[]; lang?: string }
  | { type: 'solve'; key: string; concepts: string[]; lang?: string }
  | { type: 'score'; score: number };

// Real actions only; each is capped per day so XP can't be farmed by spamming.
export const XP_RULES: Record<XpKind, { xp: number; cap: number }> = {
  run_ok: { xp: 5, cap: 10 },
  analyze: { xp: 10, cap: 5 },
  question: { xp: 10, cap: 5 },
  solve: { xp: 40, cap: 5 },
};
export const DAILY_GOAL = 30;
export const WEEKLY_DAYS_GOAL = 5; // days with any XP, out of 7
export const RUN_SKILL_DAY_CAP = 2; // skill points per skill per day that running code can give
const SEEN_MAX = 80; // programs remembered, so the same one cannot give skill points twice
const KEEP_DAYS = 190; // a bit more than the 26 weeks the activity map shows

export const emptyStats = (): Stats => ({ runsOk: 0, analyses: 0, questions: 0, solved: 0, bugsFixed: 0, bestScore: 0, lastRunFailed: false, questsDone: 0, questDays: 0 });
export const emptyDay = (): DayLog => ({ xp: 0, questXp: 0, runs: 0, fixes: 0, solves: 0, analyses: 0, questions: 0, counts: {}, langs: [], skills: [], skillRun: {}, claimed: [], bonus: false });
export const emptyProgress = (): Progress => ({ xp: 0, streak: 0, best: 0, lastDay: '', stats: emptyStats(), skills: {}, solvedKeys: [], achievements: {}, daily: {}, langs: {}, seen: [] });

const cloneDay = (d: DayLog | undefined): DayLog => { const b = d ?? emptyDay(); return { ...b, counts: { ...b.counts }, langs: [...b.langs], skills: [...b.skills], skillRun: { ...b.skillRun }, claimed: [...b.claimed] }; };

// Reads saved data of any age (including the first version, which had no daily log) into the current shape.
export function normalize(input: unknown): Progress {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const base = emptyProgress();
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const nums = (v: unknown): Record<string, number> => Object.fromEntries(Object.entries(obj(v)).filter(([, x]) => typeof x === 'number' && Number.isFinite(x)).map(([k, x]) => [k, x as number]));

  const st = obj(raw.stats);
  const stats: Stats = { ...base.stats };
  for (const k of Object.keys(stats) as (keyof Stats)[]) { if (k === 'lastRunFailed') stats[k] = Boolean(st[k]); else stats[k] = num(st[k]); }

  const daily: Record<string, DayLog> = {};
  for (const [key, v] of Object.entries(obj(raw.daily))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const d = obj(v);
    daily[key] = { xp: num(d.xp), questXp: num(d.questXp), runs: num(d.runs), fixes: num(d.fixes), solves: num(d.solves), analyses: num(d.analyses), questions: num(d.questions),
      counts: nums(d.counts), langs: strs(d.langs), skills: strs(d.skills), skillRun: nums(d.skillRun), claimed: strs(d.claimed), bonus: Boolean(d.bonus) };
  }
  if (!Object.keys(daily).length && typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day) && num(raw.dayXp) > 0) { // version 1 kept only today's numbers
    daily[raw.day] = { ...emptyDay(), xp: num(raw.dayXp), counts: nums(raw.counts) };
  }

  const langs: Record<string, LangStat> = {};
  for (const [k, v] of Object.entries(obj(raw.langs))) { const l = obj(v); langs[k] = { xp: num(l.xp), runs: num(l.runs), solves: num(l.solves) }; }
  const ach: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(raw.achievements))) if (typeof v === 'string') ach[k] = v;

  return { xp: num(raw.xp), streak: num(raw.streak), best: num(raw.best), lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : '', stats, skills: nums(raw.skills),
    solvedKeys: strs(raw.solvedKeys), achievements: ach, daily, langs, seen: strs(raw.seen).slice(-SEEN_MAX) };
}

// ---- Streak ----
// A streak survives ONE missed day; after two or more missed days it resets.
export function displayStreak(p: Progress, today: string): number {
  return p.lastDay && dayDiff(p.lastDay, today) <= 2 ? p.streak : 0;
}
export type StreakState = 'none' | 'done' | 'open' | 'grace';
// done = you already practiced today, open = practice today to make it longer, grace = you missed yesterday, today still saves it
export function streakState(p: Progress, today: string): StreakState {
  if (!p.lastDay || p.streak <= 0) return 'none';
  const d = dayDiff(p.lastDay, today);
  return d <= 0 ? 'done' : d === 1 ? 'open' : d === 2 ? 'grace' : 'none';
}

// ---- The event handler ----
export function applyEvent(p0: Progress, ev: GameEvent, today: string): { next: Progress; toasts: ToastData[] } {
  const lang = ev.type === 'score' ? '' : ev.lang ?? 'java';
  const n: Progress = { ...p0, stats: { ...p0.stats }, skills: { ...p0.skills }, solvedKeys: [...p0.solvedKeys], achievements: { ...p0.achievements }, langs: { ...p0.langs }, seen: [...p0.seen], daily: { ...p0.daily } };
  const day = cloneDay(n.daily[today]);
  n.daily[today] = day;
  const L: LangStat | null = lang ? (n.langs[lang] = { ...(n.langs[lang] ?? { xp: 0, runs: 0, solves: 0 }) }) : null;
  const toasts: ToastData[] = [];
  const levelBefore = levelInfo(n.xp).level;
  const dayXpBefore = day.xp;
  const labelBefore = Object.fromEntries(SKILLS.map((s) => [s.id, skillState(n, s).label])) as Record<string, SkillLabel>;
  let actionXp = 0;

  const award = (kind: XpKind): boolean => {
    const rule = XP_RULES[kind];
    if ((day.counts[kind] ?? 0) >= rule.cap) return false;
    day.counts[kind] = (day.counts[kind] ?? 0) + 1;
    n.xp += rule.xp; day.xp += rule.xp; actionXp += rule.xp;
    if (L) L.xp += rule.xp;
    return true;
  };
  const grant = (ids: string[], points: number) => {
    for (const id of ids) { n.skills[id] = (n.skills[id] ?? 0) + points; if (!day.skills.includes(id)) day.skills.push(id); }
  };

  switch (ev.type) {
    case 'run_ok': {
      if (ev.code !== undefined && isTrivialCode(ev.code, lang)) break; // the untouched template is not a program
      n.stats.runsOk++; day.runs++; if (L) L.runs++;
      if (!day.langs.includes(lang)) day.langs.push(lang);
      award('run_ok');
      if (n.stats.lastRunFailed) { n.stats.bugsFixed++; day.fixes++; n.stats.lastRunFailed = false; }
      if (ev.code) { // running real code moves the skill tree, once per different program
        const h = codeHash(ev.code, lang);
        if (!n.seen.includes(h)) {
          n.seen.push(h);
          if (n.seen.length > SEEN_MAX) n.seen.splice(0, n.seen.length - SEEN_MAX);
          const ids = detectSkills(ev.code, lang).filter((id) => (day.skillRun[id] ?? 0) < RUN_SKILL_DAY_CAP);
          for (const id of ids) day.skillRun[id] = (day.skillRun[id] ?? 0) + 1;
          grant(ids, 1);
        }
      }
      break;
    }
    case 'run_fail': n.stats.lastRunFailed = true; break;
    case 'question': n.stats.questions++; day.questions++; award('question'); break;
    case 'analyze': if (award('analyze')) { n.stats.analyses++; day.analyses++; grant(matchSkills(ev.concepts), 1); } break;
    case 'solve':
      if (!n.solvedKeys.includes(ev.key)) { // XP once per problem
        n.solvedKeys.push(ev.key); n.stats.solved++; day.solves++; if (L) L.solves++;
        award('solve'); grant(matchSkills(ev.concepts), 2);
      }
      break;
    case 'score': n.stats.bestScore = Math.max(n.stats.bestScore, Math.round(ev.score)); break;
  }
  if (actionXp > 0) toasts.push({ text: `+${actionXp} XP`, tone: 'xp' });

  // The streak grows on the first day you earn any XP.
  if (day.xp > 0 && n.lastDay !== today) {
    n.streak = n.lastDay && dayDiff(n.lastDay, today) <= 2 ? n.streak + 1 : 1;
    n.lastDay = today; n.best = Math.max(n.best, n.streak);
    if (n.streak > 1) toasts.push({ text: `🔥 ${n.streak} day streak!`, tone: 'streak' });
  }

  // Daily quests pay out the moment they are finished.
  for (const q of questStates(today, day)) {
    if (!q.done || q.claimed) continue;
    day.claimed.push(q.quest.id); day.xp += q.quest.reward; day.questXp += q.quest.reward; n.xp += q.quest.reward; n.stats.questsDone++;
    toasts.push({ text: `🎯 Quest done: ${q.quest.title} (+${q.quest.reward} XP)`, tone: 'quest' });
  }
  if (!day.bonus && questsFor(today).every((q) => day.claimed.includes(q.id))) {
    day.bonus = true; day.xp += QUEST_BONUS; day.questXp += QUEST_BONUS; n.xp += QUEST_BONUS; n.stats.questDays++;
    toasts.push({ text: `🌟 All quests done! +${QUEST_BONUS} XP bonus`, tone: 'quest' });
  }

  for (const s of SKILLS) {
    const after = skillState(n, s).label;
    if (after === labelBefore[s.id]) continue;
    if (after === 'Learning') toasts.push({ text: `🌱 Skill started: ${s.name}`, tone: 'skill' });
    else if (after === 'Practicing') toasts.push({ text: `📈 ${s.name}: Practicing`, tone: 'skill' });
    else if (after === 'Mastered') toasts.push({ text: `🌟 ${s.name} mastered!`, tone: 'skill' });
  }

  const levelAfter = levelInfo(n.xp).level;
  if (levelAfter > levelBefore) toasts.push({ text: `LEVEL UP! 🚀 Level ${levelAfter} · ${levelTitle(levelAfter)}`, tone: 'level' });
  if (dayXpBefore < DAILY_GOAL && day.xp >= DAILY_GOAL) toasts.push({ text: 'Daily goal complete ✓', tone: 'goal' });

  for (const a of ACHIEVEMENTS) {
    if (!n.achievements[a.id] && achievementProgress(a, n, today).done) { n.achievements[a.id] = today; toasts.push({ text: `🏆 Achievement unlocked: ${a.name}`, tone: 'level' }); }
  }

  const cutoff = addDays(today, -KEEP_DAYS);
  for (const k of Object.keys(n.daily)) if (k < cutoff) delete n.daily[k];
  return { next: n, toasts };
}

// ---- Views of the data, for the Progress page ----
export interface DayCell { date: string; xp: number; active: boolean; today: boolean; future: boolean }
const cell = (p: Progress, date: string, today: string): DayCell => { const xp = p.daily[date]?.xp ?? 0; return { date, xp, active: xp > 0, today: date === today, future: date > today }; };
// Monday to Sunday of the current week.
export const weekDays = (p: Progress, today: string): DayCell[] => { const start = weekStart(today); return Array.from({ length: 7 }, (_, i) => cell(p, addDays(start, i), today)); };
// The last `weeks` weeks as columns (each Monday to Sunday), for the activity map.
export const heatmap = (p: Progress, today: string, weeks = 26): DayCell[][] => {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => cell(p, addDays(start, w * 7 + d), today)));
};
export const heatLevel = (xp: number): 0 | 1 | 2 | 3 | 4 => (xp <= 0 ? 0 : xp < 15 ? 1 : xp < DAILY_GOAL ? 2 : xp < 60 ? 3 : 4);
export const activeDays = (p: Progress): number => Object.values(p.daily).filter((d) => d.xp > 0).length;
export const langBreakdown = (p: Progress): { lang: string; xp: number; runs: number; solves: number }[] =>
  Object.entries(p.langs).map(([lang, s]) => ({ lang, ...s })).filter((l) => l.xp + l.runs + l.solves > 0).sort((a, b) => b.xp - a.xp || b.runs - a.runs);
