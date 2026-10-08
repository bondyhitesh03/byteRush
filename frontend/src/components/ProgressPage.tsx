import { useEffect, useState, type CSSProperties } from 'react';
import { getStats } from '../services/api';
import type { Stats as ServerStats } from '../types/practice';
import type { Progress } from '../utils/progress';
import { ACHIEVEMENTS } from '../utils/achievements';
import { DAILY_GOAL } from '../utils/progress';
import { SKILLS, skillState } from '../utils/skills';
import SkillTree from './SkillTree';
import Attempts from './Attempts';

interface Props {
  progress: Progress; level: { level: number; into: number; need: number }; streak: number; dayXp: number;
  onPracticeSkill: (prompt: string) => void; onStart: () => void;
}
type Tab = 'overview' | 'skills' | 'achievements' | 'attempts';

export default function ProgressPage({ progress, level, streak, dayXp, onPracticeSkill, onStart }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<ServerStats | null>(null);
  useEffect(() => { void getStats().then(setStats); }, []);

  const pct = Math.round((level.into / level.need) * 100);
  const goalPct = Math.min(100, (dayXp / DAILY_GOAL) * 100);
  const unlocked = ACHIEVEMENTS.filter((a) => progress.achievements[a.id]).length;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toLocaleDateString('en-CA'); });
  const counts = days.map((d) => (stats?.activity ?? []).filter((a) => new Date(a).toLocaleDateString('en-CA') === d).length);
  const max = Math.max(1, ...counts);
  const seg = (t: Tab, text: string) => <button className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{text}</button>;

  return (
    <div className="scroll"><div className="pg">
      <section className="hero">
        <div className="ring big" style={{ '--p': pct } as CSSProperties}><span><b>{level.level}</b><small>LEVEL</small></span></div>
        <div className="herotext">
          <h2>Level {level.level}</h2>
          <p className="muted">{level.need - level.into} XP to reach level {level.level + 1}</p>
          <div className="xpbar thick"><span style={{ width: `${pct}%` }} /></div>
          <small className="muted">{level.into} / {level.need} XP · {progress.xp} XP in total</small>
        </div>
        <div className="herostats">
          <div className="hs"><span>🔥</span><b>{streak}</b><small>day streak</small></div>
          <div className="hs"><span>🎯</span><b>{Math.min(dayXp, DAILY_GOAL)}/{DAILY_GOAL}</b><small>today's XP goal</small></div>
          <div className="hs"><span>🏆</span><b>{unlocked}/{ACHIEVEMENTS.length}</b><small>achievements</small></div>
        </div>
        <div className="goalline"><div className="xpbar"><span style={{ width: `${goalPct}%` }} /></div>
          <small className="muted">{dayXp >= DAILY_GOAL ? 'Daily goal complete ✓' : `${DAILY_GOAL - dayXp} XP left for today's goal. Missing one day never breaks your streak.`}</small></div>
      </section>

      <div className="seg tabs" role="tablist">{seg('overview', '📊 Overview')}{seg('skills', '🌳 Skill tree')}{seg('achievements', '🏆 Achievements')}{seg('attempts', '🕓 Attempts')}</div>

      {tab === 'overview' && (<>
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
        <div className="cols">
          <section className="panel"><h3>Activity</h3><p className="muted">Submissions in the last 14 days</p>
            <div className="chart" aria-label="Submissions per day">{counts.map((c, i) => (
              <div key={days[i]} className="col" title={`${days[i]}: ${c} submission${c === 1 ? '' : 's'}`}>
                <div className="track"><span style={{ height: `${(c / max) * 100}%` }} /></div><em>{Number(days[i].slice(8))}</em></div>))}</div>
          </section>
          <section className="panel"><h3>Skills</h3><p className="muted">Open the Skill tree to practice them</p>
            {SKILLS.map((s) => { const x = skillState(progress, s); return (
              <div key={s.id} className="srow"><span>{x.unlocked ? s.icon : '🔒'} {s.name}</span><span className="xpbar"><span style={{ width: `${x.pct}%` }} /></span><small className="badge">{x.label}</small></div>); })}
          </section>
        </div>
      </>)}

      {tab === 'skills' && <section className="panel"><h3>Java skill tree</h3><p className="muted">Skills unlock as you practice the ones before them.</p><SkillTree progress={progress} onPractice={onPracticeSkill} /></section>}

      {tab === 'achievements' && (<>
        <section className="panel"><h3>{unlocked} of {ACHIEVEMENTS.length} unlocked</h3>
          <div className="xpbar thick"><span style={{ width: `${(unlocked / ACHIEVEMENTS.length) * 100}%` }} /></div></section>
        <div className="ach">{ACHIEVEMENTS.map((a) => { const got = progress.achievements[a.id]; return (
          <div key={a.id} className={`achcard ${got ? 'got' : ''}`}><span className="aicon">{got ? a.icon : '🔒'}</span><b>{a.name}</b><small>{a.desc}</small>{got && <small className="ok">Unlocked {got}</small>}</div>); })}</div>
      </>)}

      {tab === 'attempts' && <section className="panel"><h3>Your attempts</h3><p className="muted">Pick a question, tick two attempts and compare them.</p><Attempts questions={stats?.per ?? []} /></section>}
    </div></div>
  );
}
