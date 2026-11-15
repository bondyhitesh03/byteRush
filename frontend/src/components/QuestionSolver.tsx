import { useRef } from 'react';
import type { Entry, HistoryItem, Related } from '../types/question';
import { DIFF_ICON } from '../types/question';
import CodeBlock from './CodeBlock';
import NotesLinkButton from './NotesLinkButton';
import { useLinkedNotes } from '../hooks/useLinkedNotes';
import type { NoteLink } from '../types/notes';
import HistoryPanel from './HistoryPanel';
import { normalizeCode } from '../utils/formatJava';
import { LANGS } from '../utils/languages';
import { useLang } from '../utils/LangContext';

interface Props {
  text: string; onText: (t: string) => void; entry: Entry | null; history: HistoryItem[];
  busy: 'solve' | 'related' | null; error: string; errorCode: string; onOpenSettings: () => void;
  onSolve: (force: boolean, text?: string) => void; onSimilar: (force: boolean, text?: string) => void; onSolveRelated: (statement: string) => void;
  onPractice: () => void; onPracticeRelated: (r: Related) => void; onPrint: (withSolution: boolean) => void; onOpenPlayground: (code: string, input?: string) => void;
  onOpenEntry: (id: string) => void; onDeleteEntry: (id: string) => void; onNew: () => void;
  onOpenNotes: (link: NoteLink, seedBody: string) => Promise<string | null>;
  onImage: (file: File) => void; reading: boolean; photo: string; onClearPhoto: () => void; autoSolve: boolean; onAutoSolve: (v: boolean) => void;
}

export default function QuestionSolver(p: Props) {
  const e = p.entry;
  const sol = e?.solution;
  const lang = useLang();
  const linked = useLinkedNotes('question', e?.id);
  const noteLink: NoteLink | null = e ? { kind: 'question', id: e.id, title: sol?.title ?? e.title } : null;
  const noteSeed = e ? `## Question\n\n${e.question.trim().split('\n').map((l) => `> ${l}`).join('\n').slice(0, 1200)}\n\n## My notes\n\n` : '';
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = p.busy !== null || p.reading || p.text.trim().length < 10;
  const imageFrom = (files: FileList | null | undefined) => Array.from(files ?? []).find((f) => f.type.startsWith('image/'));
  const settingsErr = ['quota', 'invalid_key', 'no_key', 'model'].includes(p.errorCode);

  return (
    <div className="solver-layout">
      <HistoryPanel items={p.history} activeId={e?.id} onOpen={p.onOpenEntry} onDelete={p.onDeleteEntry} onNew={p.onNew} />
      <div className="scroll"><div className="solver">
        <h2>Paste a question</h2>
        <p className="muted small">Solutions and similar questions are for <span className="qlang">{LANGS[lang].icon} {LANGS[lang].name}</span>. Change the language from the menu in the top right.</p>
        <textarea value={p.text} onChange={(ev) => p.onText(ev.target.value)} rows={6} placeholder="e.g. Write a program that reverses a string without using StringBuilder.reverse()"
          onPaste={(ev) => { const f = imageFrom(ev.clipboardData.files); if (f) { ev.preventDefault(); p.onImage(f); } }}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => { const f = imageFrom(ev.dataTransfer.files); if (f) { ev.preventDefault(); p.onImage(f); } }} />
        <div className="photo">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) p.onImage(f); ev.target.value = ''; }} />
          <button disabled={p.reading || p.busy !== null} onClick={() => fileRef.current?.click()}>{p.reading ? 'Reading photo…' : '📷 Upload a photo of the question'}</button>
          <label className="photoauto"><input type="checkbox" checked={p.autoSolve} onChange={(ev) => p.onAutoSolve(ev.target.checked)} /> Get the solution right after reading</label>
          {p.photo && <span className="thumb"><img src={p.photo} alt="Your uploaded question" /><button aria-label="Remove the photo" onClick={p.onClearPhoto}>✕</button></span>}
        </div>
        <p className="muted small">You can also paste or drop an image into the box. Your photo is sent to Google (through this server) to be read and is not saved. Check the text it reads before relying on the answer.</p>
        <div className="row">
          <button className="primary" disabled={disabled} onClick={() => p.onSolve(false)}>{p.busy === 'solve' ? 'Solving…' : '✨ Get solution'}</button>
          <button disabled={disabled} onClick={() => p.onSimilar(false)}>{p.busy === 'related' ? 'Finding…' : '🔎 Find similar questions'}</button>
        </div>
        <p className="muted">Each button makes one AI request. Questions you've already asked are loaded from History for free.</p>
        {p.error && (
          <div className="err">{p.error}
            {settingsErr && <div className="row"><button className="primary" onClick={p.onOpenSettings}>Open Settings</button>
              <a className="btnlink" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get a new free key ↗</a></div>}
          </div>
        )}
        {p.reading && <div className="card"><div className="muted">Reading your photo…</div><div className="skel w80" /><div className="skel w60" /><div className="skel w90" /></div>}
        {p.busy && <div className="card"><div className="muted">{p.busy === 'solve' ? 'Reading your question, writing the solution and preparing test cases…' : 'Finding similar questions…'}</div><div className="skel w80" /><div className="skel w60" /><div className="skel w90" /></div>}

        {e && sol && (
          <div className="card">
            <h3>{DIFF_ICON[sol.difficulty]} {sol.title}</h3>
            <div>{sol.concepts.map((c) => <span className="chip" key={c}>{c}</span>)}</div>
            <div className="row">
              <button className="primary" onClick={p.onPractice}>▶ Practice this question</button>
              <button onClick={() => p.onPrint(false)}>🖨 Print question</button>
              <button onClick={() => p.onPrint(true)}>🖨 Print with solution</button>
              {noteLink && <NotesLinkButton notes={linked} link={noteLink} seedBody={noteSeed} onOpen={p.onOpenNotes} />}
            </div>
            <h4>Approach</h4><p>{sol.approach}</p>
            <h4>Solution</h4>
            <CodeBlock code={sol.solution.code} />
            <p>{sol.solution.explanation}</p>
            <p className="muted">Time {sol.timeComplexity} · Space {sol.spaceComplexity}</p>
            <div className="row">
              <button onClick={() => p.onOpenPlayground(normalizeCode(sol.solution.code, lang), sol.sampleInput)}>Open in Playground to run it</button>
              <button disabled={p.busy !== null} onClick={() => p.onSolve(true, e.question)} title="Uses one AI request">↻ Regenerate solution</button>
            </div>
          </div>
        )}
        {e && !sol && !p.busy && (
          <div className="card"><b>{e.title}</b><p className="muted">No solution yet for this question.</p>
            <div className="row"><button className="primary" onClick={() => p.onSolve(false, e.question)}>✨ Get solution</button>
              {noteLink && <NotesLinkButton notes={linked} link={noteLink} seedBody={noteSeed} onOpen={p.onOpenNotes} />}</div></div>
        )}

        {e && e.related && (<>
          <h3>Similar questions</h3>
          {e.related.map((r) => (
            <div className="card" key={r.title}>
              <b>{DIFF_ICON[r.difficulty]} {r.title}</b> {r.concepts.map((c) => <span className="chip" key={c}>{c}</span>)}
              <p style={{ whiteSpace: 'pre-wrap' }}>{r.statement}</p>
              <div className="row">
                <button onClick={() => p.onPracticeRelated(r)}>Practice</button>
                <button disabled={p.busy !== null} onClick={() => p.onSolveRelated(r.statement)}>Solve this one</button>
              </div>
            </div>
          ))}
          {e.leetcode && e.leetcode.length > 0 && (<>
            <h3>LeetCode practice</h3>
            {e.leetcode.map((l) => (
              <div className="card" key={l.slug}>
                <a className="lclink" href={`https://leetcode.com/problems/${l.slug}/`} target="_blank" rel="noopener noreferrer">
                  <b>#{l.number} · {l.title}</b><span>{DIFF_ICON[l.difficulty]} {l.difficulty} ↗</span></a>
                {l.why && <p className="muted">{l.why}</p>}
                <a className="small" href={`https://leetcode.com/problemset/?search=${encodeURIComponent(l.title)}`} target="_blank" rel="noopener noreferrer">Link not working? Search it on LeetCode ↗</a>
              </div>
            ))}
            <p className="muted">LeetCode picks are AI suggestions. When one opens, check that the number and title match.</p>
          </>)}
          <button disabled={p.busy !== null} onClick={() => p.onSimilar(true, e.question)} title="Uses one AI request">↻ Find different ones</button>
        </>)}
        {e && sol && !e.related && !p.busy && (
          <div className="card"><b>Want more practice?</b><p className="muted">Get 3 similar questions plus LeetCode picks on the same concept (one AI request).</p>
            <button className="primary" onClick={() => p.onSimilar(false, e.question)}>🔎 Find similar questions</button></div>
        )}
      </div></div>
    </div>
  );
}
