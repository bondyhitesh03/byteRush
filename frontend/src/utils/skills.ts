import type { Progress } from './progress';

export interface Skill { id: string; name: string; icon: string; desc: string; tier: number; req: { id: string; min: number }[]; pattern: RegExp }
export const MASTERED = 5;

// Skills unlock as their prerequisites get practice points. Points come from solved problems and analyses.
export const SKILLS: Skill[] = [
  { id: 'variables', name: 'Variables & Types', icon: '📦', tier: 0, req: [], desc: 'Store and combine values with variables, data types and operators.', pattern: /variable|data type|integer|arithmetic|operator|input|output|primitive/ },
  { id: 'conditionals', name: 'If / Else', icon: '🔀', tier: 1, req: [{ id: 'variables', min: 1 }], desc: 'Make decisions in code with if, else and switch.', pattern: /\b(if|else|switch|conditionals?|conditions?|branching)\b/ },
  { id: 'loops', name: 'Loops', icon: '🔁', tier: 1, req: [{ id: 'variables', min: 1 }], desc: 'Repeat work with for and while loops.', pattern: /\b(loops?|for|while)\b|iterat/ },
  { id: 'strings', name: 'Strings', icon: '🔤', tier: 1, req: [{ id: 'variables', min: 1 }], desc: 'Work with text: characters, searching, building and reversing.', pattern: /string|char/ },
  { id: 'arrays', name: 'Arrays', icon: '🧱', tier: 2, req: [{ id: 'loops', min: 1 }], desc: 'Hold many values together and process them with loops.', pattern: /array|list|matrix|sort|search|collection/ },
  { id: 'methods', name: 'Methods', icon: '🧩', tier: 2, req: [{ id: 'conditionals', min: 1 }], desc: 'Split code into reusable methods with parameters and return values.', pattern: /method|function|recursion|parameter|return/ },
  { id: 'nested', name: 'Nested Loops', icon: '🌀', tier: 2, req: [{ id: 'loops', min: 2 }], desc: 'Loops inside loops: patterns, tables and 2D data.', pattern: /nested|pattern|matrix|2d/ },
  { id: 'oop', name: 'OOP', icon: '🏗️', tier: 3, req: [{ id: 'methods', min: 2 }], desc: 'Model things with classes and objects.', pattern: /\bclass(es)?\b|\bobjects?\b|\boop\b|inheritance|polymorphism|encapsulation|\binterfaces?\b/ },
];

export const matchSkills = (concepts: string[]): string[] => {
  const text = concepts.join(' | ').toLowerCase();
  return SKILLS.filter((s) => s.pattern.test(text)).map((s) => s.id);
};

export function skillState(p: Pick<Progress, 'skills'>, s: Skill) {
  const points = p.skills[s.id] ?? 0;
  const unlocked = s.req.every((r) => (p.skills[r.id] ?? 0) >= r.min);
  const label = points >= MASTERED ? 'Mastered' : points >= 3 ? 'Practicing' : points >= 1 ? 'Learning' : unlocked ? 'Ready' : 'Locked';
  return { points, unlocked, label, pct: Math.min(100, (points / MASTERED) * 100) };
}
