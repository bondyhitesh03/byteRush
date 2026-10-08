import type { Progress } from './progress';
import { levelInfo } from './level';

export interface Achievement { id: string; icon: string; name: string; desc: string; check: (p: Progress) => boolean }

// Every condition is based on real tracked actions.
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_program', icon: '🏆', name: 'First Program', desc: 'Run a program successfully', check: (p) => p.stats.runsOk >= 1 },
  { id: 'bug_hunter', icon: '🐛', name: 'Bug Hunter', desc: 'Get a failing program to run', check: (p) => p.stats.bugsFixed >= 1 },
  { id: 'curious', icon: '💡', name: 'Curious Mind', desc: 'Ask 5 questions', check: (p) => p.stats.questions >= 5 },
  { id: 'beginner', icon: '☕', name: 'Java Beginner', desc: 'Reach level 2', check: (p) => levelInfo(p.xp).level >= 2 },
  { id: 'explorer', icon: '🧭', name: 'Java Explorer', desc: 'Practice 3 different skills', check: (p) => Object.values(p.skills).filter((v) => v > 0).length >= 3 },
  { id: 'logic5', icon: '🧠', name: 'Logic Master', desc: 'Pass all tests on 5 problems', check: (p) => p.stats.solved >= 5 },
  { id: 'streak7', icon: '🔥', name: '7 Day Streak', desc: 'Code 7 days in a row', check: (p) => p.best >= 7 },
  { id: 'perfect', icon: '💯', name: 'Perfect Score', desc: 'Score 100 / 100 on a problem', check: (p) => p.stats.bestScore >= 100 },
  { id: 'solved10', icon: '🚀', name: '10 Problems Solved', desc: 'Pass all tests on 10 problems', check: (p) => p.stats.solved >= 10 },
  { id: 'xp1000', icon: '🏅', name: '1000 XP', desc: 'Earn 1000 XP', check: (p) => p.xp >= 1000 },
];
