import { useEffect, useRef, useState } from 'react';
import CodeEditor from './CodeEditor';
import ConsolePanel from './ConsolePanel';
import { buildPreview, CSS_STARTER, HTML_STARTER, JS_STARTER, withAssetLinks } from '../utils/web';
import { downloadViaLink, saveFile } from '../utils/download';
import { makeZip } from '../utils/zip';
import type { ConsoleEntry } from '../utils/jsRunner';
import { byRecent, loadCurrentId, loadPages, MAX_PAGES, newId, saveCurrentId, savePages, type SavedPage } from '../utils/webPages';

const LS = { html: 'algocoach-web-html', css: 'algocoach-web-css', js: 'algocoach-web-js', lower: 'algocoach-web-lower' };
const NO_ERRORS: { line: number; message: string }[] = [];
const read = (k: string, d: string): string => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
type Which = 'html' | 'css' | 'js';
type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '375px' };
const SANDBOX = 'allow-scripts allow-forms allow-modals'; // no allow-same-origin: previews can't touch the app's storage
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'my-website';
const META: Record<Which, { title: string; file: string; language: string; mime: string }> = {
  html: { title: 'HTML', file: 'index.html', language: 'html', mime: 'text/html' },
  css: { title: 'CSS', file: 'style.css', language: 'css', mime: 'text/css' },
  js: { title: 'JavaScript', file: 'script.js', language: 'javascript', mime: 'text/javascript' },
};

export default function WebPlayground({ theme }: { theme: 'dark' | 'light' }) {
  const [code, setCode] = useState<Record<Which, string>>(() => ({ html: read(LS.html, HTML_STARTER), css: read(LS.css, CSS_STARTER), js: read(LS.js, JS_STARTER) }));
  const { html, css, js } = code;
  const [collapsed, setCollapsed] = useState<Record<Which, boolean>>({ html: false, css: false, js: false });
  const [lowerRow, setLowerRow] = useState(() => read(LS.lower, 'row') !== 'col'); // CSS and JavaScript side by side, or stacked
  const [doc, setDoc] = useState(() => buildPreview(html, css, js));
  const [msg, setMsg] = useState('');
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fullRef = useRef<HTMLIFrameElement>(null);

  const [pages, setPages] = useState<SavedPage[]>(() => loadPages());
  const [currentId, setCurrentId] = useState(() => { const id = loadCurrentId(); return loadPages().some((p) => p.id === id) ? id : ''; });
  const [showList, setShowList] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [full, setFull] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');

  const current = pages.find((p) => p.id === currentId) ?? null;
  const dirty = current ? current.html !== html || current.css !== css || current.js !== js : html !== HTML_STARTER || css !== CSS_STARTER || js !== JS_STARTER;
  const okToLeave = () => !dirty || window.confirm('You have unsaved changes. Discard them?');
  const setOne = (which: Which) => (v: string) => setCode((c) => ({ ...c, [which]: v }));

  // Live preview (short pause while typing) + keep the work-in-progress when the page is reloaded
  useEffect(() => {
    const id = setTimeout(() => { setDoc(buildPreview(html, css, js)); setLogs([]); write(LS.html, html); write(LS.css, css); write(LS.js, js); }, 250);
    return () => clearTimeout(id);
  }, [html, css, js]);

  // Console messages from the preview page (only from the frame that is on screen)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { byterush?: string; level?: ConsoleEntry['level']; text?: unknown } | null;
      if (!d || d.byterush !== 'web-console') return;
      const active = fullRef.current ?? frameRef.current;
      if (!active || e.source !== active.contentWindow) return;
      setLogs((l) => [...l.slice(-299), { level: d.level ?? 'log', text: String(d.text) }]);
      if (d.level === 'error') setConsoleOpen(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Esc closes the full page preview
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  // At least one editor always stays open, so there is always something to type in.
  const toggle = (which: Which) => setCollapsed((c) => {
    const next = { ...c, [which]: !c[which] };
    if (next.html && next.css && next.js) next[which] = false;
    return next;
  });
  const flipLower = () => setLowerRow((r) => { write(LS.lower, r ? 'col' : 'row'); return !r; });

  // ---- Saved pages ----
  const persist = (next: SavedPage[]): boolean => {
    const r = savePages(next);
    if (!r.ok) { setMsg(r.message); return false; }
    setPages(next); return true;
  };
  const select = (id: string) => { setCurrentId(id); saveCurrentId(id); };
  const saveNew = (name: string) => {
    if (pages.length >= MAX_PAGES) { setMsg(`You can keep up to ${MAX_PAGES} saved pages. Delete one first.`); return; }
    const now = new Date().toISOString();
    const page: SavedPage = { id: newId(), name: name.trim().slice(0, 60) || 'Untitled page', html, css, js, createdAt: now, updatedAt: now };
    if (persist([page, ...pages])) { select(page.id); setMsg(`Saved “${page.name}” ✓`); }
  };
  const onSave = () => {
    if (!current) { setNameDraft(''); setNaming(true); return; }
    const now = new Date().toISOString();
    if (persist(pages.map((p) => (p.id === current.id ? { ...p, html, css, js, updatedAt: now } : p)))) setMsg('Saved ✓');
  };
  const onSaveCopy = () => { setNameDraft(current ? `${current.name} copy` : ''); setNaming(true); };
  const confirmName = () => { saveNew(nameDraft); setNaming(false); };
  const openPage = (p: SavedPage) => {
    if (p.id !== currentId && !okToLeave()) return;
    setCode({ html: p.html, css: p.css, js: p.js }); select(p.id); setShowList(false); setMsg(`Opened “${p.name}”`);
  };
  const newPage = () => {
    if (!okToLeave()) return;
    setCode({ html: HTML_STARTER, css: CSS_STARTER, js: JS_STARTER }); select(''); setMsg('Started a new page');
  };
  const rename = (p: SavedPage) => {
    const name = window.prompt('Rename page', p.name)?.trim();
    if (name) persist(pages.map((x) => (x.id === p.id ? { ...x, name: name.slice(0, 60) } : x)));
  };
  const remove = (p: SavedPage) => {
    if (!window.confirm(`Delete “${p.name}”? This can't be undone.`)) return;
    if (persist(pages.filter((x) => x.id !== p.id)) && p.id === currentId) select('');
  };

  // ---- Downloads ----
  const fileContent = (which: Which): string => (which === 'html' ? withAssetLinks(html) : which === 'css' ? css : js);
  const download = async (which: Which | 'all') => {
    if (which === 'all') {
      const name = `${slug(current?.name ?? '')}.zip`;
      downloadViaLink(name, makeZip((['html', 'css', 'js'] as Which[]).map((w) => ({ name: META[w].file, content: fileContent(w) }))), 'application/zip');
      setMsg(`Downloaded ${name}. Unzip it and open index.html.`);
      return;
    }
    const m = META[which];
    const r = await saveFile(m.file, fileContent(which), m.mime);
    setMsg(r === 'saved' ? `Saved ${m.file} ✓` : r === 'downloaded' ? `${m.file} was downloaded to your browser's Downloads folder.` : '');
  };

  const bothLowerMin = collapsed.css && collapsed.js;
  const panel = (which: Which) => {
    const m = META[which];
    const vertical = which !== 'html' && lowerRow && collapsed[which] && !bothLowerMin;
    return (
      <div className={`web-panel ${collapsed[which] ? 'min' : ''} ${vertical ? 'vmin' : ''}`}>
        <div className="web-phead">
          <span><b>{m.title}</b> <small className="muted">{m.file}</small></span>
          <button className="iconbtn" onClick={() => toggle(which)} aria-expanded={!collapsed[which]}
            aria-label={`${collapsed[which] ? 'Maximize' : 'Minimize'} the ${m.title} editor`} title={collapsed[which] ? `Show ${m.title}` : `Hide ${m.title}`}>{collapsed[which] ? '⌃' : '⌄'}</button>
        </div>
        <div className="web-pbody" style={{ display: collapsed[which] ? 'none' : 'block' }}>
          <CodeEditor language={m.language} theme={theme} value={code[which]} onChange={setOne(which)} onRun={() => { setDoc(buildPreview(html, css, js)); setLogs([]); }} errors={NO_ERRORS} />
        </div>
      </div>
    );
  };

  return (
    <main className="web">
      <section className="web-left">
        <div className="web-toolbar">
          <button className="primary" onClick={onSave}>💾 {current ? 'Save' : 'Save page'}</button>
          {current && <button onClick={onSaveCopy}>Save as copy</button>}
          <button onClick={() => setShowList((s) => !s)} aria-expanded={showList}>📁 My pages ({pages.length})</button>
          <button onClick={newPage}>＋ New</button>
        </div>
        <div className="web-toolbar sub">
          <button onClick={() => void download('html')} title="Save index.html (Chrome lets you pick the Desktop)">⬇ index.html</button>
          <button onClick={() => void download('css')} title="Save style.css">⬇ style.css</button>
          <button onClick={() => void download('js')} title="Save script.js">⬇ script.js</button>
          <button onClick={() => void download('all')} title="All three files in one .zip">⬇ All (.zip)</button>
          <button onClick={flipLower} title="Show CSS and JavaScript side by side, or one above the other">{lowerRow ? '▤ Stack CSS / JS' : '▥ CSS / JS side by side'}</button>
        </div>
        <div className="web-status">
          {current ? <>Editing <b>{current.name}</b> {dirty ? <span className="warn">● unsaved changes</span> : <span className="ok">✓ saved</span>}</> : <span className="muted">This page isn't saved yet{dirty ? ' · ● unsaved changes' : ''}</span>}
          {msg && <small className="muted"> · {msg}</small>}
        </div>
        {naming && (
          <div className="web-name">
            <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Name your page, e.g. Portfolio" maxLength={60}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmName(); if (e.key === 'Escape') setNaming(false); }} />
            <button className="primary" onClick={confirmName}>Save</button><button onClick={() => setNaming(false)}>Cancel</button>
          </div>
        )}
        {showList && (
          <div className="web-list">
            {pages.length === 0 && <p className="muted">No saved pages yet. Press “Save page” to keep your work here.</p>}
            {byRecent(pages).map((p) => (
              <div key={p.id} className={`web-item ${p.id === currentId ? 'on' : ''}`}>
                <button className="web-open" onClick={() => openPage(p)}><b>{p.name}</b><small className="muted">edited {when(p.updatedAt)}</small></button>
                <button className="iconbtn" onClick={() => rename(p)} aria-label={`Rename ${p.name}`} title="Rename">✏️</button>
                <button className="iconbtn" onClick={() => remove(p)} aria-label={`Delete ${p.name}`} title="Delete">🗑</button>
              </div>
            ))}
            <p className="muted small">Saved in this browser only. Download the files to keep a copy elsewhere.</p>
          </div>
        )}
        {panel('html')}
        <div className={`web-lower ${lowerRow ? 'row' : 'col'} ${bothLowerMin ? 'allmin' : ''}`}>
          {panel('css')}
          {panel('js')}
        </div>
      </section>
      <section className="web-right">
        <div className="web-rhead"><b>👁 Live preview</b><small className="muted">updates as you type</small>
          <button className="fullbtn" onClick={() => { setLogs([]); setFull(true); }} title="Open the preview full page (Esc to close)">⛶ Full page</button></div>
        <div className="web-framewrap">
          <iframe ref={frameRef} className="web-frame" title="Preview" srcDoc={doc} sandbox={SANDBOX} referrerPolicy="no-referrer" />
        </div>
        <div className={`web-console ${consoleOpen ? 'open' : ''}`}>
          <div className="web-chead">
            <button className="web-ctoggle" onClick={() => setConsoleOpen((o) => !o)} aria-expanded={consoleOpen}>{consoleOpen ? '⌄' : '⌃'} Console {logs.length > 0 && <span className={`cbadge ${logs.some((l) => l.level === 'error') ? 'err' : ''}`}>{logs.length}</span>}</button>
            {logs.length > 0 && <button className="iconbtn" onClick={() => setLogs([])}>Clear</button>}
          </div>
          {consoleOpen && <ConsolePanel compact entries={logs} emptyText="console.log() messages and errors from your page show up here." />}
        </div>
      </section>

      {full && (
        <div className="web-full" role="dialog" aria-label="Full page preview">
          <div className="web-fullbar">
            <b>👁 Full page preview</b>
            <div className="seg" role="group" aria-label="Preview width">
              {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
                <button key={d} className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>{d === 'desktop' ? '🖥 Desktop' : d === 'tablet' ? '📱 Tablet' : '📲 Mobile'}</button>
              ))}
            </div>
            <button className="primary" onClick={() => setFull(false)}>✕ Close <kbd>Esc</kbd></button>
          </div>
          <div className="web-fullstage">
            <iframe ref={fullRef} className="web-fullframe" style={{ width: DEVICE_WIDTH[device] }} title="Full page preview" srcDoc={doc} sandbox={SANDBOX} referrerPolicy="no-referrer" />
          </div>
        </div>
      )}
    </main>
  );
}
