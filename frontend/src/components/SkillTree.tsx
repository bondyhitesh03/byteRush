import { useState } from 'react';
import { MASTERED, SKILLS, skillState } from '../utils/skills';
import type { Progress } from '../utils/progress';
import { RUN_SKILL_DAY_CAP } from '../utils/progress';
import { LANGS } from '../utils/languages';
import { useLang } from '../utils/LangContext';

export default function SkillTree({ progress, onPractice }: { progress: Progress; onPractice: (prompt: string) => void }) {
  const lang = useLang();
  const [sel, setSel] = useState('variables');
  const skill = SKILLS.find((s) => s.id === sel) ?? SKILLS[0];
  const st = skillState(progress, skill);
  const needs = skill.req.map((r) => { const name = SKILLS.find((x) => x.id === r.id)?.name ?? r.id; return `${name} ×${r.min} (you have ${progress.skills[r.id] ?? 0})`; });
  const left = Math.max(0, MASTERED - st.points);

  return (
    <div>
      <div className="tree">
        {[0, 1, 2, 3].map((tier) => (
          <div key={tier} className="tier">
            {SKILLS.filter((s) => s.tier === tier).map((s) => {
              const x = skillState(progress, s);
              return (
                <button key={s.id} className={`node ${x.unlocked ? '' : 'locked'} ${x.points >= MASTERED ? 'mastered' : ''} ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)} aria-pressed={sel === s.id}>
                  <span className="nicon">{x.unlocked ? s.icon : '🔒'}</span><b>{s.name}</b>
                  <span className="xpbar"><span style={{ width: `${x.pct}%` }} /></span><small>{x.label} · {x.points}/{MASTERED}</small>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>{skill.icon} {skill.name} <span className="chip">{st.label}</span></h3>
        <p>{skill.desc}</p>
        <p className="muted">Practice points: <b>{st.points}</b> / {MASTERED} to master{left > 0 ? ` (${left} to go)` : ' ✓'}.</p>
        <ul className="muted howto">
          <li>Run a program that uses it: +1 (once per different program, up to {RUN_SKILL_DAY_CAP} a day). Works in every language.</li>
          <li>Pass all tests on a problem about it: +2.</li>
          <li>Analyze code that uses it with AI: +1.</li>
        </ul>
        {!st.unlocked && <div className="okbox">🔒 Unlocks with: {needs.join(' and ')}.</div>}
        <button className="primary" disabled={!st.unlocked} onClick={() => onPractice(`Write a beginner-friendly ${LANGS[lang].name} program that practices: ${skill.name}. It should read its input from the user and print a result.`)}>
          Get a {LANGS[lang].name} practice question for this skill
        </button>
      </div>
    </div>
  );
}
