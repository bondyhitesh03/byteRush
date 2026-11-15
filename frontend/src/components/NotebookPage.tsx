import { useEffect, useRef, useState } from 'react';
import CodeEditor from './CodeEditor';
import OutputPanel from './OutputPanel';
import AnalysisPanel from './AnalysisPanel';
import TracePanel from './TracePanel';
import ErrorCoach from './ErrorCoach';
import SimilarList from './SimilarList';
import NotesLinkButton from './NotesLinkButton';
import { useLinkedNotes } from '../hooks/useLinkedNotes';
import type { NoteLink } from '../types/notes';
import { analyzeNote, createFolder, createNote, deleteFolder, deleteNote, getNote, listNotes, renameFolder, runCode, setNoteMeta, similarNotes, traceCode, updateNote } from '../services/api';
import type { RunResult } from '../types/run';
import type { Trace } from '../types/practice';
import type { Folder, Note, NoteSummary } from '../types/notebook';
import { relatedToPractice, type PracticeProblem, type Related } from '../types/question';
import { LANGS, starterFor, type QLang } from '../utils/languages';

type Tab = 'output' | 'analysis' | 'dry' | 'similar';
interface Props {
  lang: QLang; theme: 'dark' | 'light'; onOpenSettings: () => void; onRunStatus: (status: string, code?: string) => void;
  onAnalyzed: (concepts: string[]) => void; onPractice: (p: PracticeProblem) => void;
  active: boolean; // this page is on screen (it stays mounted while hidden)
  target?: { id: string; n: number }; // open this saved page (when you come from a note)
  onOpenNotes: (link: NoteLink, seedBody: string) => Promise<string | null>;
}

export default function NotebookPage({ lang, theme, onOpenSettings, onRunStatus, onAnalyzed, onPractice, active, target, onOpenNotes }: Props) {
  const STARTER = starterFor(lang);
  const [list, setList] = useState<NoteSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([{ id: 'general', name: 'General', builtin: true }]);
  const [activeFolder, setActiveFolder] = useState('general'); // where new questions go
  const [closed, setClosed] = useState<Record<string, boolean>>({}); // collapsed sections in the sidebar
  const [folderId, setFolderId] = useState('general'); // folder of the page being edited
  const [starred, setStarred] = useState(false);
  const [adding, setAdding] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [fErr, setFErr] = useState('');
  const [note, setNote] = useState<Note | null>(null); // the saved version (null = a new page)
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState(STARTER);
  const [stdin, setStdin] = useState('');
  const [tab, setTab] = useState<Tab>('output');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<'analyze' | 'similar' | null>(null);
  const [aErr, setAErr] = useState('');
  const [aCode, setACode] = useState('');
  const [sErr, setSErr] = useState('');
  const [sCode, setSCode] = useState('');

  const [trace, setTrace] = useState<Trace | null>(null);
  const [traceFor, setTraceFor] = useState('');
  const [tracing, setTracing] = useState(false);
  const [tErr, setTErr] = useState('');
  const [tCode, setTCode] = useState('');
  const [tStep, setTStep] = useState(0);
  const traceCache = useRef(new Map<string, Trace>());
  const traceKey = `${code}\u0000${stdin}`;

  const refresh = async () => { const d = await listNotes(); setList(d.items); setFolders(d.folders); };
  useEffect(() => { void refresh(); }, []);

  const blank = !note && !question.trim() && code === STARTER && !stdin;
  const dirty = note ? note.question !== question || note.code !== code || note.stdin !== stdin : !blank;
  const okToLeave = () => !dirty || window.confirm('You have unsaved changes on this page. Discard them?');

  const load = (n: Note | null) => {
    setFolderId(n?.folderId ?? activeFolder); setStarred(Boolean(n?.starred));
    setNote(n); setQuestion(n?.question ?? ''); setCode(n?.code ?? STARTER); setStdin(n?.stdin ?? '');
    setResult(null); setTab('output'); setMsg(''); setAErr(''); setSErr(''); setTrace(null); setTErr('');
  };
  const newPage = () => { if (okToLeave()) load(null); };
  const openNote = async (id: string) => {
    if (!okToLeave()) return;
    const n = await getNote(id);
    if (n) load(n); else void refresh();
  };

  useEffect(() => { if (target) void openNote(target.id); }, [target?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const linked = useLinkedNotes('notebook', note?.id, active);

  const save = async (): Promise<Note | null> => {
    if (question.trim().length < 3) { setMsg('Paste the question first.'); return null; }
    setSaving(true); setMsg('');
    const r = note ? await updateNote(note.id, question, code, stdin) : await createNote(question, code, stdin, folderId, starred);
    setSaving(false);
    if (!r.ok) { setMsg(r.message); return null; }
    setNote(r.note); setMsg('Saved ✓'); void refresh();
    return r.note;
  };

  const remove = async () => {
    if (!note || !window.confirm(`Delete Question ${note.number} from your notebook?`)) return;
    await deleteNote(note.id);
    load(null); void refresh();
  };

  const run = async () => {
    if (running) return;
    setTab('output');
    if (!code.trim()) return setResult({ status: 'error', message: 'The editor is empty - write some Java first.' });
    setRunning(true);
    const r = await runCode(lang, code, stdin);
    setResult(r); setRunning(false); onRunStatus(r.status, code);
  };

  const analyze = async (force = false) => {
    if (busy) return;
    setTab('analysis'); setAErr(''); setACode('');
    if (!code.trim()) { setAErr('Write or paste some code first.'); return; }
    setBusy('analyze');
    const saved = await save();
    if (!saved) { setBusy(null); setAErr('Save failed: ' + (question.trim().length < 3 ? 'paste the question first.' : 'please try again.')); return; }
    const r = await analyzeNote(saved.id, force);
    setBusy(null);
    if (!r.ok) { setAErr(r.message); setACode(r.code ?? ''); return; }
    setNote(r.note); void refresh();
    if (!r.cached && r.note.analysis) onAnalyzed(r.note.analysis.concepts);
  };

  const similar = async (force = false) => {
    if (busy) return;
    setTab('similar'); setSErr(''); setSCode('');
    setBusy('similar');
    const saved = await save();
    if (!saved) { setBusy(null); setSErr('Paste the question first, then try again.'); return; }
    const r = await similarNotes(saved.id, force);
    setBusy(null);
    if (!r.ok) { setSErr(r.message); setSCode(r.code ?? ''); return; }
    setNote(r.note); void refresh();
  };

  const dryRun = async () => {
    if (tracing) return;
    setTab('dry'); setTErr(''); setTCode('');
    if (!code.trim()) { setTErr('Write or paste some code first.'); return; }
    const cached = traceCache.current.get(traceKey);
    if (cached) { setTrace(cached); setTraceFor(traceKey); setTStep(0); return; }
    setTracing(true);
    const r = await traceCode(code, stdin);
    setTracing(false);
    if (!r.ok) { setTErr(r.message); setTCode(r.code ?? ''); return; }
    traceCache.current.set(traceKey, r.trace);
    setTrace(r.trace); setTraceFor(traceKey); setTStep(0);
  };

  const addToNotebook = async (r: Related) => {
    if (!okToLeave()) return;
    const created = await createNote(r.statement, STARTER, '', activeFolder);
    if (!created.ok) { setMsg(created.message); return; }
    load(created.note); void refresh();
  };

  // ---- Folders and ⭐ important ----
  const applyMeta = (updated: Note) => { if (note?.id === updated.id) { setNote((cur) => (cur ? { ...cur, folderId: updated.folderId, starred: updated.starred } : cur)); setFolderId(updated.folderId); setStarred(updated.starred); } void refresh(); };
  const toggleStarOf = async (id: string, value: boolean) => { const r = await setNoteMeta(id, { starred: value }); if (r.ok) applyMeta(r.note); else setMsg(r.message); };
  const toggleStarHere = () => { if (note) void toggleStarOf(note.id, !starred); else setStarred(!starred); };
  const changeFolder = async (id: string) => {
    if (!note) { setFolderId(id); return; }
    const r = await setNoteMeta(note.id, { folderId: id });
    if (r.ok) applyMeta(r.note); else setMsg(r.message);
  };
  const isClosed = (id: string) => Boolean(closed[id]);
  const toggleSection = (id: string) => setClosed((c) => ({ ...c, [id]: !c[id] }));
  const addFolder = async () => {
    const r = await createFolder(folderName);
    if (!r.ok) { setFErr(r.message); return; }
    setFolderName(''); setFErr(''); setAdding(false); setActiveFolder(r.folder.id); setClosed((c) => ({ ...c, [r.folder.id]: false })); await refresh();
  };
  const renameFolderUi = async (f: Folder) => {
    const name = window.prompt('Rename folder', f.name)?.trim();
    if (!name) return;
    const r = await renameFolder(f.id, name);
    if (r.ok) await refresh(); else setFErr(r.message);
  };
  const deleteFolderUi = async (f: Folder) => {
    const count = list.filter((i) => i.folderId === f.id).length;
    if (!window.confirm(`Delete the folder “${f.name}”?${count ? ` Its ${count} question${count === 1 ? '' : 's'} will move to General.` : ''}`)) return;
    const r = await deleteFolder(f.id);
    if (!r.ok) { setFErr(r.message); return; }
    if (activeFolder === f.id) setActiveFolder('general');
    if (note?.folderId === f.id) { setNote({ ...note, folderId: 'general' }); setFolderId('general'); }
    await refresh();
  };

  const item = (it: NoteSummary) => (
    <div key={it.id} className={`nb-item ${note?.id === it.id ? 'on' : ''}`} role="button" tabIndex={0}
      onClick={() => void openNote(it.id)} onKeyDown={(e) => { if (e.key === 'Enter') void openNote(it.id); }}>
      <span className="nb-num">Q{it.number}</span><span className="nb-ititle">{it.title}</span>
      <button className={`nb-star ${it.starred ? 'on' : ''}`} aria-pressed={it.starred} aria-label={it.starred ? 'Remove from important' : 'Mark as important'}
        onClick={(e) => { e.stopPropagation(); void toggleStarOf(it.id, !it.starred); }}>{it.starred ? '★' : '☆'}</button>
    </div>
  );
  const starredItems = list.filter((i) => i.starred);

  const highlightLine = tab === 'dry' && trace && traceFor === traceKey ? trace.steps[Math.min(tStep, trace.steps.length - 1)]?.line ?? null : null;
  const tabBtn = (t: Tab, label: string) => <button className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{label}</button>;

  return (
    <div className="nb-layout">
      <aside className="nb-index">
        <div className="nb-ihead"><b>📒 Notebook</b><button onClick={newPage}>+ New</button></div>

        <div className="nb-fhead star">
          <button className="nb-fbtn" onClick={() => toggleSection('starred')} aria-expanded={!isClosed('starred')}>
            <span className="nb-chev">{isClosed('starred') ? '▸' : '▾'}</span> ⭐ Starred <small>{starredItems.length}</small>
          </button>
        </div>
        {!isClosed('starred') && (starredItems.length ? starredItems.map(item) : <p className="muted small nb-hint">Tap ☆ on a question to keep it here.</p>)}

        {folders.map((f) => {
          const inside = list.filter((i) => i.folderId === f.id);
          return (
            <div key={f.id}>
              <div className={`nb-fhead ${activeFolder === f.id ? 'active' : ''}`}>
                <button className="nb-fbtn" onClick={() => { setActiveFolder(f.id); toggleSection(f.id); }} aria-expanded={!isClosed(f.id)} title="New questions go into the highlighted folder">
                  <span className="nb-chev">{isClosed(f.id) ? '▸' : '▾'}</span> {f.builtin ? '📂' : '📁'} <span className="nb-fname">{f.name}</span> <small>{inside.length}</small>
                </button>
                {!f.builtin && <>
                  <button className="nb-ficon" onClick={() => void renameFolderUi(f)} aria-label={`Rename ${f.name}`} title="Rename folder">✏️</button>
                  <button className="nb-ficon" onClick={() => void deleteFolderUi(f)} aria-label={`Delete ${f.name}`} title="Delete folder">🗑</button>
                </>}
              </div>
              {!isClosed(f.id) && (inside.length ? inside.map(item) : <p className="muted small nb-hint">{f.builtin ? 'Random questions live here.' : 'Empty. Move questions here from a page.'}</p>)}
            </div>
          );
        })}

        {adding ? (
          <div className="nb-newfolder">
            <input autoFocus value={folderName} maxLength={40} placeholder="Folder name, e.g. Arrays" onChange={(e) => { setFolderName(e.target.value); setFErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void addFolder(); if (e.key === 'Escape') { setAdding(false); setFErr(''); } }} />
            <div className="row"><button className="primary" onClick={() => void addFolder()}>Create</button><button onClick={() => { setAdding(false); setFErr(''); }}>Cancel</button></div>
          </div>
        ) : <button className="nb-addfolder" onClick={() => setAdding(true)}>＋ New folder</button>}
        {fErr && <div className="err small">{fErr}</div>}
      </aside>

      <div className="scroll"><div className="nb-page">
        <div className="nb-spiral" aria-hidden="true" />
        <div className="nb-head">
          <h2>{note ? <><span className="nb-num big">Q{note.number}</span> Question {note.number}</> : '✏️ New question'} <span className="qlang">{LANGS[lang].icon} {LANGS[lang].name}</span></h2>
          <span className={dirty ? 'warn' : 'ok'}>{dirty ? '● Unsaved changes' : msg}</span>
        </div>
        <div className="nb-meta">
          <button className={`nb-starbtn ${starred ? 'on' : ''}`} onClick={toggleStarHere} aria-pressed={starred} title="Mark this question as important">{starred ? '★ Important' : '☆ Mark important'}</button>
          <label className="nb-folderpick">📁 <select value={folderId} onChange={(e) => void changeFolder(e.target.value)} aria-label="Folder">
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          {note && <NotesLinkButton notes={linked} link={{ kind: 'notebook', id: note.id, title: `Q${note.number}: ${note.title}` }} seedBody={`## Question\n\n${note.question.trim().split('\n').map((l) => `> ${l}`).join('\n').slice(0, 1200)}\n\n## My notes\n\n`} onOpen={onOpenNotes} />}
        </div>

        <label className="nb-label" htmlFor="nb-q">📌 The question</label>
        <textarea id="nb-q" className="nb-ruled" rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Paste the question here…" />

        <label className="nb-label">💻 My code</label>
        <div className="nb-codewrap"><div className="nb-code">
          <CodeEditor language={LANGS[lang].monaco} highlightLine={highlightLine} theme={theme} value={code} onChange={setCode} onRun={run} errors={result?.status === 'compile_error' ? result.errors ?? [] : []} />
        </div></div>

        <label className="nb-label" htmlFor="nb-in">⌨️ Input <span className="muted">(what Scanner reads, optional)</span></label>
        <textarea id="nb-in" className="nb-ruled" rows={2} value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder={'e.g.\n5\n1 2 3 4 5'} spellCheck={false}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); if (!e.repeat) void run(); } }} />

        <div className="nb-toolbar">
          <button className="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</button>
          <button onClick={() => void run()} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
          <button onClick={() => void analyze(false)} disabled={busy !== null} title="One AI request">{busy === 'analyze' ? 'Analyzing…' : '✨ Analyze'}</button>
          <button onClick={() => void dryRun()} disabled={tracing} title="One AI request">{tracing ? 'Tracing…' : '👣 Dry run'}</button>
          <button onClick={() => void similar(false)} disabled={busy !== null} title="One AI request">{busy === 'similar' ? 'Finding…' : '🔎 Similar'}</button>
          {note && <button onClick={() => void remove()}>🗑 Delete</button>}
        </div>
        {msg && dirty && <p className="err">{msg}</p>}

        <div className="nb-tabs">{tabBtn('output', 'Output')}{tabBtn('analysis', 'Analysis')}{tabBtn('dry', 'Dry run')}{tabBtn('similar', 'Similar questions')}</div>
        <div className="nb-result">
          {tab === 'output' && <OutputPanel result={result} running={running}
            extra={result ? <ErrorCoach key={`${result.status}|${result.stderr}|${code.length}`} code={code} result={result} language={lang} /> : null} />}
          {tab === 'analysis' && <AnalysisPanel analysis={note?.analysis ?? null} loading={busy === 'analyze'} error={aErr} errorCode={aCode}
            stale={Boolean(note?.analysis) && note?.analyzedCode !== code} onAnalyze={() => void analyze(true)} onOpenSettings={onOpenSettings} />}
          {tab === 'dry' && <TracePanel trace={trace} code={code} loading={tracing} error={tErr} errorCode={tCode} stale={Boolean(trace) && traceFor !== traceKey}
            step={tStep} onStep={setTStep} onGenerate={() => void dryRun()} onOpenSettings={onOpenSettings} />}
          {tab === 'similar' && <SimilarList related={note?.related} leetcode={note?.leetcode} loading={busy === 'similar'} error={sErr} errorCode={sCode}
            onFind={(force) => void similar(force)} onOpenSettings={onOpenSettings} onPractice={(r) => onPractice(relatedToPractice(r, lang))} onAdd={(r) => void addToNotebook(r)} />}
        </div>
      </div></div>
    </div>
  );
}
