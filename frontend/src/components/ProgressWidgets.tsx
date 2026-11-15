import { ACH_GROUPS, ACHIEVEMENTS, achievementProgress } from '../utils/achievements';
import { prettyDay } from '../utils/dates';
import { LANGS, type QLang } from '../utils/languages';
import { DAILY_GOAL, WEEKLY_DAYS_GOAL, heatLevel, type DayCell, type Progress } from '../utils/progress';
import { QUEST_BONUS, type QuestState } from '../utils/quests';

const bar = (pct: number) => <span className="xpbar"><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>;

// Today: the daily XP goal and the three quests.
export function QuestPanel({ quests, dayXp }: { quests: QuestState[]; dayXp: number }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <section className="panel">
      <div className="phead"><h3>Today</h3><span className="chip">{done}/{quests.length} quests</span></div>
      <div className="goalrow">
        <span>🎯 Daily goal</span>{bar((dayXp / DAILY_GOAL) * 100)}
        <small className={dayXp >= DAILY_GOAL ? 'ok' : 'muted'}>{dayXp >= DAILY_GOAL ? 'Complete ✓' : `${Math.min(dayXp, DAILY_GOAL)} / ${DAILY_GOAL} XP`}</small>
      </div>
      <div className="quests">
        {quests.map(({ quest: q, value, done: ok }) => (
          <div key={q.id} className={`qrow ${ok ? 'complete' : ''}`}>
            <span className="qicon" aria-hidden="true">{ok ? '✅' : q.icon}</span>
            <div className="qbody"><b>{q.title}</b>{q.ai && <small className="muted">uses an AI request</small>}{bar((value / q.target) * 100)}</div>
            <small className="qval">{value}/{q.target}</small>
            <span className="badge">+{q.reward} XP</span>
          </div>
        ))}
      </div>
      <p className="muted small">{done === quests.length ? `All quests done. You earned the +${QUEST_BONUS} XP bonus. ✓` : `Finish all three for a +${QUEST_BONUS} XP bonus. New quests every day at midnight.`}</p>
    </section>
  );
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// This week, Monday to Sunday: XP per day and how many days you practiced.
export function WeekPanel({ days }: { days: DayCell[] }) {
  const active = days.filter((d) => d.active).length;
  const max = Math.max(DAILY_GOAL, ...days.map((d) => d.xp));
  return (
    <section className="panel">
      <div className="phead"><h3>This week</h3><span className="chip">{active}/{WEEKLY_DAYS_GOAL} days</span></div>
      <div className="week" role="img" aria-label={`${active} of ${WEEKLY_DAYS_GOAL} practice days this week`}>
        {days.map((d, i) => (
          <div key={d.date} className={`wday ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}`} title={`${prettyDay(d.date)}: ${d.xp} XP`}>
            <small className="muted">{d.xp > 0 ? d.xp : ' '}</small>
            <div className="wtrack"><span className={d.xp >= DAILY_GOAL ? 'goal' : ''} style={{ height: `${d.xp > 0 ? Math.max(8, (d.xp / max) * 100) : 0}%` }} /></div>
            <em>{LETTERS[i]}</em>
          </div>
        ))}
      </div>
      <div className="goalrow slim">{bar((active / WEEKLY_DAYS_GOAL) * 100)}<small className={active >= WEEKLY_DAYS_GOAL ? 'ok' : 'muted'}>{active >= WEEKLY_DAYS_GOAL ? 'Weekly goal complete ✓' : `${WEEKLY_DAYS_GOAL - active} more day${WEEKLY_DAYS_GOAL - active === 1 ? '' : 's'} for the weekly goal`}</small></div>
    </section>
  );
}

// A calendar of the last weeks: the darker the square, the more XP that day.
export function Heatmap({ weeks, total, best }: { weeks: DayCell[][]; total: number; best: number }) {
  return (
    <section className="panel">
      <div className="phead"><h3>Activity</h3><span className="chip">{total} active day{total === 1 ? '' : 's'} · best streak {best}</span></div>
      <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} role="img" aria-label="Your practice activity over the last weeks">
        {weeks.map((w) => w.map((d) => (
          <i key={d.date} className={`hm${d.future ? 'f' : heatLevel(d.xp)} ${d.today ? 'today' : ''}`} title={d.future ? prettyDay(d.date) : `${prettyDay(d.date)}: ${d.xp} XP`} />
        )))}
      </div>
      <div className="heatkey muted"><small>Less</small>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hm${l}`} />)}<small>More</small></div>
    </section>
  );
}

const langInfo = (id: string) => LANGS[id as QLang] ?? { name: id, icon: '💻' };
// XP and runs per language.
export function LanguagePanel({ rows }: { rows: { lang: string; xp: number; runs: number; solves: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.xp));
  return (
    <section className="panel">
      <h3>Languages</h3>
      {rows.length === 0 ? <p className="muted">Run a program in any language and it shows up here.</p> : rows.map((r) => (
        <div key={r.lang} className="lrow">
          <span>{langInfo(r.lang).icon} {langInfo(r.lang).name}</span>{bar((r.xp / max) * 100)}
          <small className="muted">{r.xp} XP · {r.runs} run{r.runs === 1 ? '' : 's'}{r.solves ? ` · ${r.solves} solved` : ''}</small>
        </div>
      ))}
    </section>
  );
}

// Every achievement, grouped, with how far along you are.
export function AchievementsView({ progress, today }: { progress: Progress; today: string }) {
  const rows = ACHIEVEMENTS.map((a) => ({ a, ...achievementProgress(a, progress, today), got: progress.achievements[a.id] }));
  const unlocked = rows.filter((r) => r.got).length;
  const next = rows.filter((r) => !r.got).sort((x, y) => y.pct - x.pct).slice(0, 3);
  return (<>
    <section className="panel"><h3>{unlocked} of {ACHIEVEMENTS.length} unlocked</h3>{bar((unlocked / ACHIEVEMENTS.length) * 100)}
      {next.length > 0 && (<div className="nextup"><h4>Closest to unlocking</h4>
        {next.map((r) => <div key={r.a.id} className="nrow"><span>{r.a.icon} {r.a.name}</span>{bar(r.pct)}<small className="muted">{r.value}/{r.target}</small></div>)}</div>)}
    </section>
    {ACH_GROUPS.map((g) => (
      <section key={g} className="achgroup"><h4>{g}</h4>
        <div className="ach">{rows.filter((r) => r.a.group === g).map((r) => (
          <div key={r.a.id} className={`achcard ${r.got ? 'got' : ''}`}>
            <span className="aicon">{r.got ? r.a.icon : '🔒'}</span><b>{r.a.name}</b><small>{r.a.desc}</small>
            {r.got ? <small className="ok">Unlocked {r.got}</small> : <div className="achprog">{bar(r.pct)}<small>{r.value}/{r.target}</small></div>}
          </div>))}
        </div>
      </section>
    ))}
  </>);
}
