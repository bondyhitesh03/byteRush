import { useEffect, useState } from 'react';
import CodeEditor from './CodeEditor';
import { buildPreview, CSS_STARTER, HTML_STARTER, withStylesheetLink } from '../utils/web';
import { downloadViaLink, saveFile } from '../utils/download';
import { byRecent, loadCurrentId, loadPages, MAX_PAGES, newId, saveCurrentId, savePages, type SavedPage } from '../utils/webPages';

const LS_HTML = 'algocoach-web-html';
const LS_CSS = 'algocoach-web-css';
const NO_ERRORS: { line: number; message: string }[] = [];
const read = (k: string, d: string): string => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
type Which = 'html' | 'css';
type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '375px' };
const SANDBOX = 'allow-scripts allow-forms allow-modals'; // no allow-same-origin: previews can't touch the app's storage

export default function WebPlayground({ theme }: { theme: 'dark' | 'light' }) {
  const [html, setHtml] = useState(() => read(LS_HTML, HTML_STARTER));
  const [css, setCss] = useState(() => read(LS_CSS, CSS_STARTER));
  const [collapsed, setCollapsed] = useState<Record<Which, boolean>>({ html: false, css: false });
  const [doc, setDoc] = useState(() => buildPreview(html, css));
  const [msg, setMsg] = useState('');

  const [pages, setPages] = useState<SavedPage[]>(() => loadPages());
  const [currentId, setCurrentId] = useState(() => { const id = loadCurrentId(); return loadPages().some((p) => p.id === id) ? id : ''; });
  const [showList, setShowList] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const [full, setFull] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');

  const current = pages.find((p) => p.id === currentId) ?? null;
  const dirty = current ? current.html !== html || current.css !== css : html !== HTML_STARTER || css !== CSS_STARTER;
  const okToLeave = () => !dirty || window.confirm('You have unsaved changes. Discard them?');

  // Live preview (short pause while typing) + keep the work-in-progress when the page is reloaded
  useEffect(() => {
    const id = setTimeout(() => { setDoc(buildPreview(html, css)); write(LS_HTML, html); write(LS_CSS, css); }, 250);
    return () => clearTimeout(id);
  }, [html, css]);

  // Esc closes the full page preview
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  // Only one editor can be minimized at a time, so there is always something to type in.
  const toggle = (which: Which) => setCollapsed((c) => {
    const other: Which = which === 'html' ? 'css' : 'html';
    const next = { ...c, [which]: !c[which] };
    if (next[which] && next[other]) next[other] = false;
    return next;
  });

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
    const page: SavedPage = { id: newId(), name: name.trim().slice(0, 60) || 'Untitled page', html, css, createdAt: now, updatedAt: now };
    if (persist([page, ...pages])) { select(page.id); setMsg(`Saved “${page.name}” ✓`); }
  };
  const onSave = () => {
    if (!current) { setNameDraft(''); setNaming(true); return; }
    const now = new Date().toISOString();
    if (persist(pages.map((p) => (p.id === current.id ? { ...p, html, css, updatedAt: now } : p)))) setMsg('Saved ✓');
  };
  const onSaveCopy = () => { setNameDraft(current ? `${current.name} copy` : ''); setNaming(true); };
  const confirmName = () => { saveNew(nameDraft); setNaming(false); };
  const openPage = (p: SavedPage) => {
    if (p.id !== currentId && !okToLeave()) return;
    setHtml(p.html); setCss(p.css); select(p.id); setShowList(false); setMsg(`Opened “${p.name}”`);
  };
  const newPage = () => {
    if (!okToLeave()) return;
    setHtml(HTML_STARTER); setCss(CSS_STARTER); select(''); setMsg('Started a new page');
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
  const download = async (which: Which | 'both') => {
    const htmlFile = withStylesheetLink(html);
    if (which === 'both') {
      downloadViaLink('index.html', htmlFile, 'text/html'); downloadViaLink('style.css', css, 'text/css');
      setMsg('index.html and style.css were downloaded. Keep them in the same folder so the styles load.');
      return;
    }
    const name = which === 'html' ? 'index.html' : 'style.css';
    const r = await saveFile(name, which === 'html' ? htmlFile : css, which === 'html' ? 'text/html' : 'text/css');
    setMsg(r === 'saved' ? `Saved ${name} ✓` : r === 'downloaded' ? `${name} was downloaded to your browser's Downloads folder.` : '');
  };

  const panel = (which: Which, title: string, file: string, value: string, set: (v: string) => void) => (
    <div className={`web-panel ${collapsed[which] ? 'min' : ''}`}>
      <div className="web-phead">
        <span><b>{title}</b> <small className="muted">{file}</small></span>
        <button className="iconbtn" onClick={() => toggle(which)} aria-expanded={!collapsed[which]}
          aria-label={`${collapsed[which] ? 'Maximize' : 'Minimize'} the ${title} editor`} title={collapsed[which] ? `Show ${title}` : `Hide ${title}`}>{collapsed[which] ? '⌃' : '⌄'}</button>
      </div>
      <div className="web-pbody" style={{ display: collapsed[which] ? 'none' : 'block' }}>
        <CodeEditor language={which} theme={theme} value={value} onChange={set} onRun={() => setDoc(buildPreview(html, css))} errors={NO_ERRORS} />
      </div>
    </div>
  );

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
          <button onClick={() => void download('css')} title="Save style.css (Chrome lets you pick the Desktop)">⬇ style.css</button>
          <button onClick={() => void download('both')} title="Download both files to your Downloads folder">⬇ Both</button>
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
        {panel('html', 'HTML', 'index.html', html, setHtml)}
        {panel('css', 'CSS', 'style.css', css, setCss)}
      </section>
      <section className="web-right">
        <div className="web-rhead"><b>👁 Live preview</b><small className="muted">updates as you type</small>
          <button className="fullbtn" onClick={() => setFull(true)} title="Open the preview full page (Esc to close)">⛶ Full page</button></div>
        <div className="web-framewrap">
          <iframe className="web-frame" title="Preview" srcDoc={doc} sandbox={SANDBOX} referrerPolicy="no-referrer" />
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
            <iframe className="web-fullframe" style={{ width: DEVICE_WIDTH[device] }} title="Full page preview" srcDoc={doc} sandbox={SANDBOX} referrerPolicy="no-referrer" />
          </div>
        </div>
      )}
    </main>
  );
}
