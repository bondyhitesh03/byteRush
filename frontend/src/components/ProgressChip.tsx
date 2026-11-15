import { DAILY_GOAL, type StreakState } from '../utils/progress';
import { levelTitle } from '../utils/level';
import type { QuestState } from '../utils/quests';

interface Props {
  streak: number; streakState: StreakState; level: { level: number; into: number; need: number }; dayXp: number; quests: QuestState[]; onClick: () => void;
}

const STREAK_HINT: Record<StreakState, string> = {
  none: 'Practice today to start a streak',
  done: 'Streak is safe for today',
  open: 'Practice today to keep your streak growing',
  grace: 'You missed a day. Practice today to save your streak',
};

// The header badge: streak, level with an XP bar, and a dot for each of today's quests.
export default function ProgressChip({ streak, streakState, level, dayXp, quests, onClick }: Props) {
  const done = quests.filter((q) => q.done).length;
  const hint = [
    `Level ${level.level} · ${levelTitle(level.level)} · ${level.into}/${level.need} XP`,
    `Today: ${Math.min(dayXp, DAILY_GOAL)}/${DAILY_GOAL} XP goal · ${done}/${quests.length} quests`,
    `Streak: ${streak} day${streak === 1 ? '' : 's'}. ${STREAK_HINT[streakState]}`,
    'Click to open Progress',
  ].join('\n');
  return (
    <button className="pchip" onClick={onClick} aria-label={`Open your progress. Level ${level.level}, ${streak} day streak, ${done} of ${quests.length} quests done today`} title={hint}>
      <span className={`streak ${streak > 0 ? 'on' : ''} ${streak > 0 && (streakState === 'open' || streakState === 'grace') ? 'risk' : ''}`}>🔥 {streak}</span>
      <span className="lvl">Lv {level.level}</span>
      <span className="xpbar"><span style={{ width: `${(level.into / level.need) * 100}%` }} /></span>
      <span className="qpips" aria-hidden="true">{quests.map((q) => <i key={q.quest.id} className={q.done ? 'on' : ''} />)}</span>
    </button>
  );
}
