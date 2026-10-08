import { useState } from 'react';
import { MASTERED, SKILLS, skillState } from '../utils/skills';
import type { Progress } from '../utils/progress';

export default function SkillTree({ progress, onPractice }: { progress: Progress; onPractice: (prompt: string) => void }) {
  const [sel, setSel] = useState('variables');
  const skill = SKILLS.find((s) => s.id === sel) ?? SKILLS[0];
  const st = skillState(progress, skill);
  const needs = skill.req.map((r) => { const name = SKILLS.find((x) => x.id === r.id)?.name ?? r.id; return `${name} ×${r.min} (you have ${progress.skills[r.id] ?? 0})`; });

  return (
    <div>
      <div className="tree">
        {[0, 1, 2, 3].map((tier) => (
          <div key={tier} className="tier">
            {SKILLS.filter((s) => s.tier === tier).map((s) => {
              const x = skillState(progress, s);
              return (
                <button key={s.id} className={`node ${x.unlocked ? '' : 'locked'} ${x.points >= MASTERED ? 'mastered' : ''} ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
                  <span className="nicon">{x.unlocked ? s.icon : '🔒'}</span><b>{s.name}</b>
                  <span className="xpbar"><span style={{ width: `${x.pct}%` }} /></span><small>{x.label}</small>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>{skill.icon} {skill.name} <span className="chip">{st.label}</span></h3>
        <p>{skill.desc}</p>
        <p className="muted">Practice points: <b>{st.points}</b> / {MASTERED} to master. You earn points by passing all tests on a problem or analyzing code that uses this skill.</p>
        {!st.unlocked && <div className="okbox">🔒 Unlocks with: {needs.join(' and ')}.</div>}
        <button className="primary" disabled={!st.unlocked} onClick={() => onPractice(`Write a beginner-friendly Java program that practices: ${skill.name}. It should read its input from the user and print a result.`)}>
          Get a practice question for this skill
        </button>
      </div>
    </div>
  );
}
