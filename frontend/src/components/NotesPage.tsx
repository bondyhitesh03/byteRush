import { useEffect, useMemo, useRef, useState } from 'react';
import CodeEditor from './CodeEditor';
import OutputPanel from './OutputPanel';
import InputPanel from './InputPanel';
import ErrorCoach from './ErrorCoach';
import Markdown from './Markdown';
import { createMyNote, deleteMyNote, getMyNote, listMyNotes, runCode, saveMyNote } from '../services/api';
import { LANGS, starterFor, type QLang } from '../utils/languages';
import { MAX_TAGS, MAX_TAG_LEN, addTags, tagCounts } from '../utils/noteTags';
import type { MyNote, MyNoteFields, MyNoteSummary, NoteLink } from '../types/notes';
import type { RunResult } from '../types/run';

type Status = 'saved' | 'saving' | 'unsaved' | 'error';
type Mode = 'write' | 'preview';
const NO_ERRORS: { line: number; message: string }[] = [];
const EMPTY: MyNoteFields = { title: '', body: '', code: '', stdin: '', tags: [], pinned: false, link: null };
const same = (a: MyNoteFields, b: MyNoteFields) => a.title === b.title && a.body === b.body && a.code === b.code && a.stdin === b.stdin
  && a.pinned === b.pinned && a.tags.join('\n') === b.tags.join('\n') && (a.link?.kind ?? '') === (b.link?.kind ?? '') && (a.link?.id ?? '') === (b.link?.id ?? '');
const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const STATUS_TEXT: Record<Status, string> = { saved: 'Saved ✓', saving: 'Saving…', unsaved: 'Unsaved changes…', error: "Couldn't save" };
const MODE_KEY = 'algocoach-notes-mode';
const readMode = (): Mode => { try { return localStorage.getItem(MODE_KEY) === 'preview' ? 'preview' : 'write'; } catch { return 'write'; } };
const LINK_NAME: Record<NoteLink['kind'], string> = { question: 'question', notebook: 'notebook page' };

interface Props {
  lang: QLang; theme: 'dark' | 'light'; onRunStatus: (status: string, code?: string) => void;
  target?: { id: string; n: number }; // open this note first (used when you come from a question or notebook page)
  onOpenLink: (link: NoteLink) => Promise<string | null>; // go to the linked question / notebook page; returns an error message if it is gone
}

// Notes: a title, Markdown text (with a preview), tags, a pin and a code template (in the chosen language) you can run, saved automatically.
// Each language keeps its own notes.
export default function NotesPage({ lang, theme, onRunStatus, target, onOpenLink }: Props) {
  const L = LANGS[lang];
  const [list, setList] = useState<MyNoteSummary[]>([]);
  const [listReady, setListReady] = useState(false);
  const [query, setQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [id, setId] = useState(''); // the open note ('' = none)
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [link, setLink] = useState<NoteLink | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [mode, setModeState] = useState<Mode>(readMode);
  const [status, setStatus] = useState<Status>('saved');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'input' | 'output'>('output');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* storage unavailable */ } };

  // The saving logic works on refs, so a save never uses stale text and a slow save can't undo newer typing.
  const idRef = useRef('');
  const savedRef = useRef<MyNoteFields | null>(null); // what the server has
  const draftRef = useRef<MyNoteFields>(EMPTY); // what is on screen
  draftRef.current = { title, body, code, stdin, tags, pinned, link };

  const refresh = async () => setList(await listMyNotes());

  const saveNow = async (): Promise<boolean> => {
    const noteId = idRef.current;
    if (!noteId) return true;
    const draft = draftRef.current;
    if (savedRef.current && same(savedRef.current, draft)) return true;
    setStatus('saving');
    const r = await saveMyNote(noteId, draft);
    if (idRef.current !== noteId) return true; // another note was opened meanwhile
    if (!r.ok) { setStatus('error'); setMsg(r.message); return false; }
    savedRef.current = draft; setMsg('');
    setStatus(same(draftRef.current, draft) ? 'saved' : 'unsaved');
    void refresh();
    return true;
  };
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;

  const show = (n: MyNote | null) => {
    const f: MyNoteFields = n ? { title: n.title, body: n.body, code: n.code, stdin: n.stdin, tags: n.tags ?? [], pinned: Boolean(n.pinned), link: n.link ?? null } : EMPTY;
    idRef.current = n?.id ?? ''; savedRef.current = n ? f : null;
    setId(n?.id ?? ''); setTitle(f.title); setBody(f.body); setCode(f.code); setStdin(f.stdin); setTags(f.tags); setPinned(f.pinned); setLink(f.link);
    setTagDraft(''); setResult(null); setStatus('saved'); setMsg('');
  };

  // First visit: load the list and open the note you came for, or else the most recently edited one.
  useEffect(() => {
    void (async () => {
      const items = await listMyNotes();
      setList(items); setListReady(true);
      const want = items.find((i) => i.id === target?.id)?.id ?? items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id;
      if (want) { const n = await getMyNote(want); if (n) show(n); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave shortly after you stop typing; save when leaving this page; warn before closing the tab with unsaved text.
  useEffect(() => {
    if (!idRef.current || !savedRef.current || same(savedRef.current, { title, body, code, stdin, tags, pinned, link })) return;
    setStatus('unsaved');
    const t = setTimeout(() => void saveRef.current(), 1200);
    return () => clearTimeout(t);
  }, [title, body, code, stdin, tags, pinned, link]);
  useEffect(() => () => { void saveRef.current(); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (savedRef.current && !same(savedRef.current, draftRef.current)) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const openNote = async (nid: string) => {
    if (nid === idRef.current) return;
    await saveRef.current();
    const n = await getMyNote(nid);
    if (n) show(n); else void refresh();
  };
  const newNote = async () => {
    if (busy) return;
    setBusy(true);
    await saveRef.current();
    const r = await createMyNote({ title: 'Untitled note', body: '', code: starterFor(lang), stdin: '', tags: filterTags, pinned: false, link: null }); // new notes inherit the tags you are filtering by
    setBusy(false);
    if (!r.ok) { setStatus('error'); setMsg(r.message); return; }
    show(r.note); void refresh();
    setTimeout(() => titleRef.current?.select(), 0);
  };
  const removeNote = async () => {
    if (!id || !window.confirm(`Delete “${title || 'this note'}”? This can't be undone.`)) return;
    await deleteMyNote(id);
    show(null);
    const items = await listMyNotes();
    setList(items);
    if (items[0]) { const n = await getMyNote(items[0].id); if (n) show(n); }
  };
  const togglePin = () => { setPinned((p) => !p); setTimeout(() => void saveRef.current(), 0); }; // the list should reorder right away
  const openLinked = async () => {
    if (!link) return;
    await saveRef.current();
    const problem = await onOpenLink(link);
    if (problem) setMsg(problem);
  };

  const commitTag = (raw: string) => { const next = addTags(tags, raw); if (next !== tags) setTags(next); setTagDraft(''); };

  const run = async () => {
    if (running) return;
    setTab('output');
    if (!code.trim()) { setResult({ status: 'error', message: `The editor is empty - write some ${L.name} first.` }); return; }
    setRunning(true);
    const r = await runCode(lang, code, stdin);
    setResult(r); setRunning(false); onRunStatus(r.status, code);
  };

  const allTags = useMemo(() => tagCounts(list.map((n) => n.tags)), [list]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((n) => filterTags.every((t) => n.tags.includes(t))
      && (!q || `${n.title} ${n.preview} ${n.tags.join(' ')} ${n.link?.title ?? ''}`.toLowerCase().includes(q)));
  }, [list, query, filterTags]);
  const pinnedItems = filtered.filter((n) => n.pinned);
  const otherItems = filtered.filter((n) => !n.pinned);
  const toggleFilter = (t: string) => setFilterTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const item = (n: MyNoteSummary) => (
    <button key={n.id} className={`notes-item ${n.id === id ? 'on' : ''}`} onClick={() => void openNote(n.id)}>
      <b>{n.pinned && <span aria-label="Pinned">📌 </span>}{n.link && <span aria-label="Linked">🔗 </span>}{n.title}</b>
      <small className="muted">{n.preview || 'No text yet'}</small>
      {n.tags.length > 0 && <span className="notes-tagrow">{n.tags.slice(0, 4).map((t) => <i key={t}>#{t}</i>)}{n.tags.length > 4 && <i>+{n.tags.length - 4}</i>}</span>}
      <small className="muted">edited {when(n.updatedAt)}</small>
    </button>
  );

  return (
    <div className="notes-layout">
      <aside className="notes-index">
        <div className="notes-ihead"><b>📝 Notes</b><button className="primary" onClick={() => void newNote()} disabled={busy}>＋ New</button></div>
        <input className="notes-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes and tags" aria-label="Search notes" />
        {allTags.length > 0 && (
          <div className="tagfilter" role="group" aria-label="Filter by tag">
            {allTags.map(({ tag, count }) => (
              <button key={tag} className={filterTags.includes(tag) ? 'on' : ''} aria-pressed={filterTags.includes(tag)} onClick={() => toggleFilter(tag)}>#{tag} <small>{count}</small></button>
            ))}
            {filterTags.length > 0 && <button className="clear" onClick={() => setFilterTags([])}>Clear</button>}
          </div>
        )}
        {listReady && list.length === 0 && <p className="muted small">No notes yet. Press “＋ New” to write your first one.</p>}
        {(query || filterTags.length > 0) && list.length > 0 && filtered.length === 0 && <p className="muted small">No notes match{query ? ` “${query}”` : ''}{filterTags.length ? ` ${filterTags.map((t) => '#' + t).join(' ')}` : ''}.</p>}
        {pinnedItems.length > 0 && otherItems.length > 0 && <div className="notes-group">Pinned</div>}
        {pinnedItems.map(item)}
        {pinnedItems.length > 0 && otherItems.length > 0 && <div className="notes-group">Notes</div>}
        {otherItems.map(item)}
      </aside>

      <section className="notes-main">
        {!id ? (
          <div className="notes-empty"><div className="emptypanel">
            <div className="big">📝</div><h3>Your notes live here</h3>
            <p className="muted">Give a note a title, write what you learned in Markdown, and keep a {L.name} template next to it that you can run.</p>
            <button className="primary" onClick={() => void newNote()} disabled={busy}>＋ Create a note</button>
          </div></div>
        ) : (<>
          <div className="notes-head">
            <input ref={titleRef} className="notes-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Title of your note" aria-label="Note title" />
            <span className={`notes-status ${status}`}>{STATUS_TEXT[status]}</span>
            <button className={`notes-pin ${pinned ? 'on' : ''}`} onClick={togglePin} aria-pressed={pinned} title={pinned ? 'Unpin this note' : 'Pin this note to the top of the list'}>📌 {pinned ? 'Pinned' : 'Pin'}</button>
            <button onClick={() => void saveRef.current()} disabled={status === 'saving'}>💾 Save</button>
            <button onClick={() => void removeNote()}>🗑 Delete</button>
          </div>
          <div className="notes-tags">
            {tags.map((t) => <span key={t} className="tagchip">#{t}<button aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>✕</button></span>)}
            {tags.length < MAX_TAGS && (
              <input className="tag-input" list="notes-taglist" value={tagDraft} maxLength={MAX_TAG_LEN + 1} aria-label="Add a tag"
                placeholder={tags.length ? 'Add tag' : 'Add a tag, press Enter'}
                onChange={(e) => { const v = e.target.value; if (v.includes(',')) commitTag(v); else setTagDraft(v); }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') { e.preventDefault(); commitTag(tagDraft); }
                  else if (e.key === 'Backspace' && !tagDraft && tags.length) setTags(tags.slice(0, -1));
                }}
                onBlur={() => { if (tagDraft.trim()) commitTag(tagDraft); }} />
            )}
            <datalist id="notes-taglist">{allTags.filter((t) => !tags.includes(t.tag)).map((t) => <option key={t.tag} value={t.tag} />)}</datalist>
          </div>
          {link && (
            <div className="notes-link">
              <span>🔗 Linked to {LINK_NAME[link.kind]}: <b>{link.title || 'Untitled'}</b></span>
              <button onClick={() => void openLinked()}>Open {LINK_NAME[link.kind]}</button>
              <button onClick={() => setLink(null)} title="Keep the note but remove the link">Unlink</button>
            </div>
          )}
          {msg && <div className="err notes-err">{msg}</div>}
          <div className="notes-work">
            <div className="notes-left">
              <div className="notes-modebar">
                <label className="notes-label" htmlFor="notes-body">Notes <span className="notes-md" title="Markdown works here: # heading, - list, **bold**, `code`, ``` code block ```, > quote, [link](https://...)">Markdown</span></label>
                <div className="seg small" role="tablist" aria-label="Write or preview">
                  <button role="tab" aria-selected={mode === 'write'} className={mode === 'write' ? 'on' : ''} onClick={() => setMode('write')}>✏️ Write</button>
                  <button role="tab" aria-selected={mode === 'preview'} className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>👁 Preview</button>
                </div>
              </div>
              {mode === 'write'
                ? <textarea id="notes-body" className="notes-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Write what you learned, steps, formulas or reminders…\n\n# Heading\n- a list\n```\ncode\n```'} />
                : <div className="notes-preview" aria-label="Preview of your notes">{body.trim()
                  ? <Markdown text={body} lang={lang} />
                  : <p className="muted">Nothing to preview yet. Switch to Write and type some Markdown.</p>}</div>}
              <div className="notes-label">{L.name} template</div>
              <div className="notes-code">
                <CodeEditor language={L.monaco} theme={theme} value={code} onChange={setCode} onRun={run} errors={result?.status === 'compile_error' ? result.errors ?? NO_ERRORS : NO_ERRORS} />
              </div>
            </div>
            <div className="side notes-side">
              <div className="actions">
                <button className="primary" onClick={() => void run()} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
                <button onClick={() => setResult(null)}>Clear output</button>
                <button onClick={() => { if (window.confirm(`Reset the code to the empty ${L.name} template?`)) setCode(starterFor(lang)); }}>↺ Template</button>
              </div>
              <div className="ptabs">
                <button className={`tab ${tab === 'input' ? 'on' : ''}`} onClick={() => setTab('input')}>{stdin.trim() ? 'Input •' : 'Input'}</button>
                <button className={`tab ${tab === 'output' ? 'on' : ''}`} onClick={() => setTab('output')}>Output</button>
              </div>
              {tab === 'input'
                ? <InputPanel value={stdin} onChange={setStdin} lang={lang} onRun={run} />
                : <OutputPanel result={result} running={running}
                    extra={result ? <ErrorCoach key={`${result.status}|${result.stderr}|${code.length}`} code={code} result={result} language={lang} /> : null} />}
            </div>
          </div>
        </>)}
      </section>
    </div>
  );
}
