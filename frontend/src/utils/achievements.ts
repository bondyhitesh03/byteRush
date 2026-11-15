import type { Progress } from './progress';
import { levelInfo } from './level';
import { MASTERED } from './skills';
import { activeDaysInWeek } from './dates';

export type AchGroup = 'Getting started' | 'Practice' | 'Consistency' | 'Mastery';
export const ACH_GROUPS: AchGroup[] = ['Getting started', 'Practice', 'Consistency', 'Mastery'];
export interface Achievement { id: string; icon: string; name: string; desc: string; group: AchGroup; measure: (p: Progress, today: string) => { value: number; target: number } }

const m = (value: number, target: number) => ({ value: Math.min(value, target), target });
const count = (o: Record<string, number>, min: number) => Object.values(o).filter((v) => v >= min).length;
const langsRun = (p: Progress) => Object.values(p.langs).filter((l) => l.runs > 0).length;

// Every condition is based on real tracked actions. Each one reports how far along you are.
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_program', icon: '🏆', name: 'First Program', desc: 'Run a program successfully', group: 'Getting started', measure: (p) => m(p.stats.runsOk, 1) },
  { id: 'bug_hunter', icon: '🐛', name: 'Bug Hunter', desc: 'Get a failing program to run', group: 'Getting started', measure: (p) => m(p.stats.bugsFixed, 1) },
  { id: 'curious', icon: '💡', name: 'Curious Mind', desc: 'Ask 5 questions', group: 'Getting started', measure: (p) => m(p.stats.questions, 5) },
  { id: 'beginner', icon: '☕', name: 'Level 2', desc: 'Reach level 2', group: 'Getting started', measure: (p) => m(levelInfo(p.xp).level, 2) },
  { id: 'quest_first', icon: '🎯', name: 'Quest Taker', desc: 'Finish a daily quest', group: 'Getting started', measure: (p) => m(p.stats.questsDone, 1) },
  { id: 'polyglot', icon: '🌍', name: 'Polyglot', desc: 'Run programs in 3 different languages', group: 'Getting started', measure: (p) => m(langsRun(p), 3) },

  { id: 'runs50', icon: '⚙️', name: 'Run Machine', desc: 'Run 50 programs successfully', group: 'Practice', measure: (p) => m(p.stats.runsOk, 50) },
  { id: 'analyst', icon: '🔎', name: 'Code Analyst', desc: 'Analyze your code 10 times', group: 'Practice', measure: (p) => m(p.stats.analyses, 10) },
  { id: 'logic5', icon: '🧠', name: 'Logic Master', desc: 'Pass all tests on 5 problems', group: 'Practice', measure: (p) => m(p.stats.solved, 5) },
  { id: 'solved10', icon: '🚀', name: '10 Problems Solved', desc: 'Pass all tests on 10 problems', group: 'Practice', measure: (p) => m(p.stats.solved, 10) },
  { id: 'solved25', icon: '🛠️', name: 'Problem Crusher', desc: 'Pass all tests on 25 problems', group: 'Practice', measure: (p) => m(p.stats.solved, 25) },
  { id: 'perfect', icon: '💯', name: 'Perfect Score', desc: 'Score 100 / 100 on a problem', group: 'Practice', measure: (p) => m(p.stats.bestScore, 100) },

  { id: 'streak3', icon: '✨', name: '3 Day Streak', desc: 'Practice 3 days in a row', group: 'Consistency', measure: (p) => m(p.best, 3) },
  { id: 'streak7', icon: '🔥', name: '7 Day Streak', desc: 'Practice 7 days in a row', group: 'Consistency', measure: (p) => m(p.best, 7) },
  { id: 'streak30', icon: '🌋', name: '30 Day Streak', desc: 'Practice 30 days in a row', group: 'Consistency', measure: (p) => m(p.best, 30) },
  { id: 'week5', icon: '📅', name: 'Week Warrior', desc: 'Practice on 5 days of one week', group: 'Consistency', measure: (p, today) => m(activeDaysInWeek(p.daily, today), 5) },
  { id: 'quest_days7', icon: '🌟', name: 'Quest Master', desc: 'Finish all three quests on 7 days', group: 'Consistency', measure: (p) => m(p.stats.questDays, 7) },

  { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Practice 3 different skills', group: 'Mastery', measure: (p) => m(count(p.skills, 1), 3) },
  { id: 'all_skills', icon: '🌳', name: 'Well Rounded', desc: 'Practice every skill in the tree', group: 'Mastery', measure: (p) => m(count(p.skills, 1), 8) },
  { id: 'master', icon: '🎓', name: 'Skill Master', desc: `Master a skill (${MASTERED} practice points)`, group: 'Mastery', measure: (p) => m(count(p.skills, MASTERED), 1) },
  { id: 'level10', icon: '🔟', name: 'Level 10', desc: 'Reach level 10', group: 'Mastery', measure: (p) => m(levelInfo(p.xp).level, 10) },
  { id: 'xp1000', icon: '🏅', name: '1000 XP', desc: 'Earn 1000 XP', group: 'Mastery', measure: (p) => m(p.xp, 1000) },
  { id: 'xp5000', icon: '👑', name: '5000 XP', desc: 'Earn 5000 XP', group: 'Mastery', measure: (p) => m(p.xp, 5000) },
];

export const achievementProgress = (a: Achievement, p: Progress, today: string) => { const { value, target } = a.measure(p, today); return { value, target, pct: Math.round((value / target) * 100), done: value >= target }; };
