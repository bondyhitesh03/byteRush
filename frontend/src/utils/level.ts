export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) { rest -= need; level++; need = 100 + 50 * (level - 1); }
  return { level, into: rest, need };
}
