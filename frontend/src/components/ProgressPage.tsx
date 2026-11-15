import { useEffect, useState, type CSSProperties } from 'react';
import { getStats } from '../services/api';
import type { Stats as ServerStats } from '../types/practice';
import { ACHIEVEMENTS } from '../utils/achievements';
import { DAILY_GOAL, activeDays, heatmap, langBreakdown, weekDays, type Progress, type StreakState } from '../utils/progress';
import { levelTitle, nextTitle } from '../utils/level';
import type { QuestState } from '../utils/quests';
import { SKILLS, skillState } from '../utils/skills';
import { LANGS } from '../utils/languages';
import { useLang } from '../utils/LangContext';
import SkillTree from './SkillTree';
import Attempts from './Attempts';
import { AchievementsView, Heatmap, LanguagePanel, QuestPanel, WeekPanel } from './ProgressWidgets';

interface Props {
  progress: Progress; today: string; level: { level: number; into: number; need: number }; streak: number; streakState: StreakState; dayXp: number; quests: QuestState[];
  onPracticeSkill: (prompt: string) => void; onStart: () => void; onReset: () => void;
}
type Tab = 'overview' | 'skills' | 'achievements' | 'attempts';

const STREAK_LINE = (streak: number, s: StreakState): string => {
  if (s === 'done') return `🔥 ${streak}-day streak. You practiced today, so it is safe.`;
  if (s === 'open') return `Practice today to make your streak ${streak + 1} days.`;
  if (s === 'grace') return `You missed a day. Practice today and your ${streak}-day streak survives.`;
  return 'Practice today to start a streak. One missed day never breaks it.';
};

export default function ProgressPage({ progress, today, level, streak, streakState, dayXp, quests, onPracticeSkill, onStart, onReset }: Props) {
  const lang = useLang();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<ServerStats | null>(null);
  useEffect(() => { void getStats().then(setStats); }, [lang]);

  const pct = Math.round((level.into / level.need) * 100);
  const unlocked = ACHIEVEMENTS.filter((a) => progress.achievements[a.id]).length;
  const questsDone = quests.filter((q) => q.done).length;
  const upcoming = nextTitle(level.level);
  const seg = (t: Tab, text: string) => <button className={tab === t ? 'on' : ''} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>{text}</button>;

  return (
    <div className="scroll"><div className="pg">
      <section className="hero">
        <div className="ring big" style={{ '--p': pct } as CSSProperties}><span><b>{level.level}</b><small>LEVEL</small></span></div>
        <div className="herotext">
          <h2>{levelTitle(level.level)}</h2>
          <p className="muted">{level.need - level.into} XP to level {level.level + 1}{upcoming ? ` · ${upcoming.title} at level ${upcoming.level}` : ''}</p>
          <div className="xpbar thick"><span style={{ width: `${pct}%` }} /></div>
          <small className="muted">{level.into} / {level.need} XP · {progress.xp} XP in total</small>
        </div>
        <div className="herostats">
          <div className="hs"><span>🔥</span><b>{streak}</b><small>day streak{progress.best > streak ? ` · best ${progress.best}` : ''}</small></div>
          <div className="hs"><span>🎯</span><b>{Math.min(dayXp, DAILY_GOAL)}/{DAILY_GOAL}</b><small>today's XP</small></div>
          <div className="hs"><span>✅</span><b>{questsDone}/{quests.length}</b><small>quests today</small></div>
          <div className="hs"><span>🏆</span><b>{unlocked}/{ACHIEVEMENTS.length}</b><small>achievements</small></div>
        </div>
        <div className="goalline"><small className={streakState === 'grace' ? 'warn' : 'muted'}>{STREAK_LINE(streak, streakState)}</small></div>
      </section>

      <div className="seg tabs" role="tablist">{seg('overview', '📊 Overview')}{seg('skills', '🌳 Skill tree')}{seg('achievements', '🏆 Achievements')}{seg('attempts', '🕓 Attempts')}</div>

      {tab === 'overview' && (<>
        <QuestPanel quests={quests} dayXp={dayXp} />
        <div className="cols">
          <WeekPanel days={weekDays(progress, today)} />
          <LanguagePanel rows={langBreakdown(progress)} />
        </div>
        <Heatmap weeks={heatmap(progress, today, 26)} total={activeDays(progress)} best={progress.best} />

        <p className="muted">Problems, accuracy and attempts below are for <span className="qlang">{LANGS[lang].icon} {LANGS[lang].name}</span>. XP, level, streak, quests and achievements count every language.</p>
        <div className="sgrid">
          <div className="scard"><span className="si">✅</span><b>{stats?.solved ?? 0}</b><small>problems solved · {stats?.attempted ?? 0} attempted</small></div>
          <div className="scard"><span className="si">🎯</span><b>{stats?.accuracy ?? 0}%</b><small>of test cases passed</small></div>
          <div className="scard"><span className="si">⭐</span><b>{stats?.avgScore ?? '–'}</b><small>{stats?.bestScore != null ? `average score · best ${stats.bestScore}` : 'average score · finish a scored attempt'}</small></div>
          <div className="scard"><span className="si">🧪</span><b>{stats?.attempts ?? 0}</b><small>submissions in total</small></div>
        </div>
        {stats && stats.attempts === 0 && (
          <div className="panel emptypanel"><div className="big">👀</div><h3>Your first solve is waiting for you</h3><p className="muted">Practice a question and submit it to fill this page with stats.</p>
            <button className="primary" onClick={onStart}>Start practicing</button></div>
        )}

        <section className="panel"><div className="phead"><h3>Skills</h3><button onClick={() => setTab('skills')}>Open the skill tree</button></div>
          <p className="muted">Run programs, solve problems and analyze code to grow them.</p>
          {SKILLS.map((s) => { const x = skillState(progress, s); return (
            <div key={s.id} className="srow"><span>{x.unlocked ? s.icon : '🔒'} {s.name}</span><span className="xpbar"><span style={{ width: `${x.pct}%` }} /></span><small className="badge">{x.label}</small></div>); })}
        </section>

        <div className="resetrow"><small className="muted">Progress is saved in this browser.</small>
          <button onClick={() => { if (window.confirm('Reset ALL progress (XP, level, streak, quests, skills and achievements)? This cannot be undone.')) onReset(); }}>Reset progress</button></div>
      </>)}

      {tab === 'skills' && <section className="panel"><h3>Skill tree</h3><p className="muted">Skills unlock as you practice the ones before them.</p><SkillTree progress={progress} onPractice={onPracticeSkill} /></section>}

      {tab === 'achievements' && <AchievementsView progress={progress} today={today} />}

      {tab === 'attempts' && <section className="panel"><h3>Your attempts</h3><p className="muted">Pick a question, tick two attempts and compare them.</p><Attempts questions={stats?.per ?? []} /></section>}
    </div></div>
  );
}
