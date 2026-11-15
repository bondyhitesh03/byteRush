// Calendar days as local-time "YYYY-MM-DD" keys (a day ends at your own midnight).
export const toKey = (d: Date): string => d.toLocaleDateString('en-CA');
export const todayKey = (): string => toKey(new Date());
const parse = (key: string): Date => new Date(`${key}T12:00:00`); // noon: daylight-saving changes cannot shift the date
export const dayDiff = (a: string, b: string): number => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
export const addDays = (key: string, n: number): string => { const d = parse(key); d.setDate(d.getDate() + n); return toKey(d); };
export const weekday = (key: string): number => (parse(key).getDay() + 6) % 7; // Monday = 0
export const weekStart = (key: string): string => addDays(key, -weekday(key)); // the Monday of that week
export const prettyDay = (key: string): string => parse(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

// How many days of this (Monday to Sunday) week you earned XP.
export function activeDaysInWeek(daily: Record<string, { xp: number }>, today: string): number {
  const start = weekStart(today);
  let n = 0;
  for (let i = 0; i < 7; i++) if ((daily[addDays(start, i)]?.xp ?? 0) > 0) n++;
  return n;
}
