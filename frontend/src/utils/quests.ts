// Daily quests: three small goals a day, the same for everyone on the same date. Finishing them gives bonus XP.
import type { DayLog } from './progress';

export interface Quest { id: string; icon: string; title: string; target: number; reward: number; ai: boolean; value: (d: DayLog) => number }
export const QUEST_BONUS = 20; // for finishing all three

// "ai" quests need a Gemini key, so most of the day's quests are picked from the others.
export const QUEST_POOL: Quest[] = [
  { id: 'run3', icon: '▶️', title: 'Run 3 programs successfully', target: 3, reward: 10, ai: false, value: (d) => d.runs },
  { id: 'run5', icon: '🏃', title: 'Run 5 programs successfully', target: 5, reward: 15, ai: false, value: (d) => d.runs },
  { id: 'fix', icon: '🐛', title: 'Fix a program that failed', target: 1, reward: 15, ai: false, value: (d) => d.fixes },
  { id: 'lang2', icon: '🌍', title: 'Run code in 2 different languages', target: 2, reward: 15, ai: false, value: (d) => d.langs.length },
  { id: 'skills2', icon: '🌳', title: 'Practice 2 different skills', target: 2, reward: 15, ai: false, value: (d) => d.skills.length },
  { id: 'xp40', icon: '⚡', title: 'Earn 40 XP from your own work', target: 40, reward: 10, ai: false, value: (d) => d.xp - d.questXp },
  { id: 'ask', icon: '💡', title: 'Ask a question', target: 1, reward: 10, ai: true, value: (d) => d.questions },
  { id: 'analyze', icon: '✨', title: 'Analyze your code', target: 1, reward: 10, ai: true, value: (d) => d.analyses },
  { id: 'solve', icon: '✅', title: 'Pass all tests on a problem', target: 1, reward: 25, ai: true, value: (d) => d.solves },
];

const seedOf = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// The same three quests for a given date, easiest (lowest reward) first.
export function questsFor(day: string): Quest[] {
  const rand = rng(seedOf(`byterush-${day}`));
  const pick = (list: Quest[]) => list[Math.floor(rand() * list.length)];
  const free = QUEST_POOL.filter((q) => !q.ai);
  const first = pick(free);
  const second = pick(free.filter((q) => q.id !== first.id));
  const third = pick(QUEST_POOL.filter((q) => q.id !== first.id && q.id !== second.id));
  return [first, second, third].sort((a, b) => a.reward - b.reward);
}

export interface QuestState { quest: Quest; value: number; done: boolean; claimed: boolean }
export function questStates(day: string, log: DayLog | undefined): QuestState[] {
  return questsFor(day).map((quest) => {
    const value = log ? Math.min(quest.target, quest.value(log)) : 0;
    return { quest, value, done: value >= quest.target, claimed: Boolean(log?.claimed.includes(quest.id)) };
  });
}
