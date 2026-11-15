export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) { rest -= need; level++; need = 100 + 50 * (level - 1); }
  return { level, into: rest, need };
}

// Total XP you need in order to reach a level (level 1 = 0).
export const xpToReach = (level: number): number => { const n = Math.max(1, Math.floor(level)) - 1; return 100 * n + 25 * n * (n - 1); };

// A title that grows with your level.
const TITLES: [number, string][] = [[1, 'Newcomer'], [3, 'Apprentice'], [5, 'Coder'], [8, 'Builder'], [12, 'Debugger'], [16, 'Engineer'], [21, 'Architect'], [27, 'Wizard'], [35, 'Legend']];
export const levelTitle = (level: number): string => [...TITLES].reverse().find(([from]) => level >= from)?.[1] ?? TITLES[0][1];
// The next title and the level where you get it (null at the top).
export const nextTitle = (level: number): { level: number; title: string } | null => { const t = TITLES.find(([from]) => from > level); return t ? { level: t[0], title: t[1] } : null; };
