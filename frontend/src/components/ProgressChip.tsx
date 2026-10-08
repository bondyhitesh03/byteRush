import { DAILY_GOAL } from '../utils/progress';

interface Props { streak: number; level: { level: number; into: number; need: number }; dayXp: number; onClick: () => void }

export default function ProgressChip({ streak, level, dayXp, onClick }: Props) {
  return (
    <button className="pchip" onClick={onClick} aria-label="Open your progress"
      title={`Level ${level.level} · ${level.into}/${level.need} XP · Today ${Math.min(dayXp, DAILY_GOAL)}/${DAILY_GOAL} XP · Click to open Progress`}>
      <span className={streak > 0 ? 'streak on' : 'streak'}>🔥 {streak}</span>
      <span className="lvl">Lv {level.level}</span>
      <span className="xpbar"><span style={{ width: `${(level.into / level.need) * 100}%` }} /></span>
    </button>
  );
}
