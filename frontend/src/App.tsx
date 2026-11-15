import { useEffect, useRef, useState } from 'react';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';
import AnalysisPanel from './components/AnalysisPanel';
import TracePanel from './components/TracePanel';
import ErrorCoach from './components/ErrorCoach';
import QuestionSolver from './components/QuestionSolver';
import PracticeView from './components/PracticeView';
import PrintSheet from './components/PrintSheet';
import SettingsPage from './components/SettingsPage';
import NotebookPage from './components/NotebookPage';
import NotesPage from './components/NotesPage';
import WebPlayground from './components/WebPlayground';
import JsPlayground from './components/JsPlayground';
import CodePlayground from './components/CodePlayground';
import Logo from './components/Logo';
import LanguageMenu, { type Lang } from './components/LanguageMenu';
import ProgressPage from './components/ProgressPage';
import ProgressChip from './components/ProgressChip';
import Toasts from './components/Toasts';
import InputPanel from './components/InputPanel';
import Watermark from './components/Watermark';
import { useProgress } from './hooks/useProgress';
import { useTheme } from './hooks/useTheme';
import { analyzeCode, createMyNote, deleteEntry, findSimilar, getEntry, getHealth, getNote as getNotebookNote, listHistory, listLinkedNotes, readQuestionImage, runCode, setApiLanguage, solveQuestion, traceCode } from './services/api';
import { LangContext } from './utils/LangContext';
import { starterFor, type QLang } from './utils/languages';
import type { NoteLink } from './types/notes';
import { prepareImage } from './utils/image';
import { getKey } from './utils/clientStore';
import type { RunResult } from './types/run';
import type { Analysis } from './types/analysis';
import type { Trace } from './types/practice';
import { entryToPractice, relatedToPractice, type Entry, type HistoryItem, type PracticeProblem } from './types/question';

const STARTER = `public class Main {
    public static void main(String[] args) {
        // Write your code here

    }
}
`;
type View = 'playground' | 'solver' | 'notebook' | 'notes' | 'practice' | 'progress' | 'settings';
type Panel = 'input' | 'output' | 'analysis' | 'trace';

export default function App() {
  const { theme, setTheme, resolved } = useTheme();
  const { progress, today, level, streak, streakState, dayXp, quests, toasts, record, reset } = useProgress();

  const [view, setView] = useState<View>('playground');
  const [lang, setLang] = useState<Lang>(() => { try { const v = localStorage.getItem('algocoach-lang'); return v === 'web' || v === 'js' || v === 'python' || v === 'c' || v === 'cpp' ? v : 'java'; } catch { return 'java'; } });
  useEffect(() => { try { localStorage.setItem('algocoach-lang', lang); } catch { /* storage unavailable */ } }, [lang]);
  // The language that questions, notebook and practice use (HTML pages have none, so they fall back to Java). Sent with every request.
  const qlang: QLang = lang === 'web' ? 'java' : lang;
  setApiLanguage(qlang);
  const [notesTarget, setNotesTarget] = useState<{ id: string; n: number } | undefined>(); // the note to open when Notes opens
  const [nbTarget, setNbTarget] = useState<{ id: string; n: number } | undefined>(); // the notebook page to open
  const targetSeq = useRef(0);
  const [pgNonce, setPgNonce] = useState(0); // bumps to reload a playground with code opened from a solution
  const [code, setCode] = useState(STARTER);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [panel, setPanel] = useState<Panel>('output');

  // Playground analysis (cached per exact code so re-analyzing the same code costs nothing)
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisFor, setAnalysisFor] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aErr, setAErr] = useState('');
  const [aErrCode, setAErrCode] = useState('');
  const analysisCache = useRef(new Map<string, Analysis>());

  // Step-by-step trace (cached per code + input)
  const [trace, setTrace] = useState<Trace | null>(null);
  const [traceFor, setTraceFor] = useState('');
  const [tracing, setTracing] = useState(false);
  const [tErr, setTErr] = useState('');
  const [tErrCode, setTErrCode] = useState('');
  const [tStep, setTStep] = useState(0);
  const traceCache = useRef(new Map<string, Trace>());
  const traceKey = `${code}\u0000${stdin}`;

  // Question solver
  const [qText, setQText] = useState('');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState<'solve' | 'related' | null>(null);
  const [err, setErr] = useState('');
  const [errCode, setErrCode] = useState('');
  const [practice, setPractice] = useState<PracticeProblem | null>(null);
  const [printJob, setPrintJob] = useState<{ p: PracticeProblem; withSolution: boolean } | null>(null);

  const [publicMode, setPublicMode] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [, setKeyTick] = useState(0); // re-render after the key changes in Settings
  const [reading, setReading] = useState(false);
  const [photo, setPhoto] = useState('');
  const [autoSolve, setAutoSolve] = useState(true);
  const refreshHistory = async () => setHistory(await listHistory());
  useEffect(() => { void refreshHistory(); void getHealth().then((h) => { setPublicMode(h.publicMode); setPersistent(h.persistent); }); }, [qlang]);
  // Each language has its own questions and notebook: start fresh when the language changes.
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) { firstLang.current = false; return; }
    setEntry(null); setQText(''); setErr(''); setErrCode(''); setPractice(null); setPhoto('');
    setView((v) => (v === 'practice' ? 'solver' : v));
  }, [qlang]);

  // Called after every run in every editor. The code lets progress ignore the empty template and see which skills the program uses.
  const runStatus = (status: string, runCode?: string) => {
    if (status === 'ok') record({ type: 'run_ok', lang: qlang, code: runCode });
    else if (['compile_error', 'runtime_error', 'timeout'].includes(status)) record({ type: 'run_fail', lang: qlang });
  };

  const run = async () => {
    if (running) return;
    setPanel('output');
    if (!code.trim()) return setResult({ status: 'error', message: 'The editor is empty - write some Java first.' });
    setRunning(true);
    const r = await runCode('java', code, stdin);
    setResult(r); setRunning(false); runStatus(r.status, code);
  };

  const analyze = async () => {
    if (analyzing) return;
    setPanel('analysis'); setAErr(''); setAErrCode('');
    if (!code.trim()) { setAErr('The editor is empty - write some Java first.'); return; }
    const cached = analysisCache.current.get(code);
    if (cached) { setAnalysis(cached); setAnalysisFor(code); return; }
    setAnalyzing(true);
    const r = await analyzeCode(code);
    setAnalyzing(false);
    if (!r.ok) { setAErr(r.message); setAErrCode(r.code ?? ''); return; }
    analysisCache.current.set(code, r.analysis);
    setAnalysis(r.analysis); setAnalysisFor(code);
    record({ type: 'analyze', concepts: r.analysis.concepts, lang: qlang });
  };

  const visualize = async () => {
    if (tracing) return;
    setPanel('trace'); setTErr(''); setTErrCode('');
    if (!code.trim()) { setTErr('The editor is empty - write some Java first.'); return; }
    const cached = traceCache.current.get(traceKey);
    if (cached) { setTrace(cached); setTraceFor(traceKey); setTStep(0); return; }
    setTracing(true);
    const r = await traceCode(code, stdin);
    setTracing(false);
    if (!r.ok) { setTErr(r.message); setTErrCode(r.code ?? ''); return; }
    traceCache.current.set(traceKey, r.trace);
    setTrace(r.trace); setTraceFor(traceKey); setTStep(0);
  };

  // kind 'solve' = solution only, 'related' = similar questions only. One AI request each (or free from history).
  const ask = async (kind: 'solve' | 'related', text: string, force = false, thenPractice = false) => {
    if (busy) return;
    setQText(text); setView('solver'); setBusy(kind); setErr(''); setErrCode('');
    const r = kind === 'solve' ? await solveQuestion(text, force) : await findSimilar(text, force);
    setBusy(null);
    if (!r.ok) { setErr(r.message); setErrCode(r.code ?? ''); return; }
    setEntry(r.entry); void refreshHistory();
    if (!r.cached) record({ type: 'question', lang: qlang });
    if (thenPractice && r.entry.solution) { setPractice(entryToPractice(r.entry, qlang)); setView('practice'); }
  };

  // Photo of a question: read it into text (one AI request), then optionally get the solution straight away.
  const readImage = async (file: File) => {
    if (reading || busy) return;
    setView('solver'); setErr(''); setErrCode(''); setReading(true);
    let dataUrl = '';
    try { dataUrl = await prepareImage(file); } catch (e) { setReading(false); setErr(e instanceof Error ? e.message : 'Could not open that image.'); return; }
    setPhoto(dataUrl);
    const r = await readQuestionImage(dataUrl);
    setReading(false);
    if (!r.ok) { setErr(r.message); setErrCode(r.code ?? ''); return; }
    setEntry(null); setQText(r.question);
    if (autoSolve) void ask('solve', r.question);
  };

  const openEntry = async (id: string) => {
    const e = await getEntry(id);
    if (!e) { void refreshHistory(); return; }
    setEntry(e); setQText(e.question); setErr(''); setErrCode(''); setView('solver');
  };
  const removeEntry = async (id: string) => {
    if (!window.confirm('Delete this question from your history?')) return;
    await deleteEntry(id);
    if (entry?.id === id) setEntry(null);
    void refreshHistory();
  };
  const newQuestion = () => { setEntry(null); setQText(''); setErr(''); setErrCode(''); setPhoto(''); };
  const practiceSkill = (prompt: string) => { setEntry(null); setQText(prompt); setErr(''); setErrCode(''); setView('solver'); };

  const print = (p: PracticeProblem, withSolution: boolean) => {
    setPrintJob({ p, withSolution });
    setTimeout(() => window.print(), 150);
  };

  // Notes <-> questions. From a question or notebook page: open its note, or start one that is linked to it. Returns an error message on failure.
  const openNotesFor = async (link: NoteLink, seedBody: string): Promise<string | null> => {
    const existing = await listLinkedNotes(link.kind, link.id);
    let noteId = existing[0]?.id; // the list is newest first
    if (!noteId) {
      const r = await createMyNote({ title: link.title.slice(0, 120) || 'Untitled note', body: seedBody, code: starterFor(qlang), stdin: '', tags: [], pinned: false, link });
      if (!r.ok) return r.message;
      noteId = r.note.id;
    }
    setNotesTarget({ id: noteId, n: ++targetSeq.current }); setView('notes');
    return null;
  };
  // From a note: go to the question or notebook page it is linked to. Returns an error message if that entry is gone.
  const openLinked = async (link: NoteLink): Promise<string | null> => {
    if (link.kind === 'question') {
      const e = await getEntry(link.id);
      if (!e) return 'That question is no longer in your history.';
      setEntry(e); setQText(e.question); setErr(''); setErrCode(''); setView('solver');
      return null;
    }
    if (!(await getNotebookNote(link.id))) return 'That page is no longer in your notebook.';
    setNbTarget({ id: link.id, n: ++targetSeq.current }); setView('notebook');
    return null;
  };

  const tab = (v: View, label: string) => <button className={`tab ${view === v ? 'on' : ''}`} onClick={() => { if (v === 'notes') setNotesTarget(undefined); setView(v); }}>{label}</button>;
  const ptab = (v: Panel, label: string) => <button className={`tab ${panel === v ? 'on' : ''}`} onClick={() => setPanel(v)}>{label}</button>;
  const highlightLine = view === 'playground' && panel === 'trace' && trace && traceFor === traceKey ? trace.steps[Math.min(tStep, trace.steps.length - 1)]?.line ?? null : null;

  return (<LangContext.Provider value={qlang}>
    <div className="app">
      <header>
        <div className="brand"><span className="logo-wrap"><Logo /><span className="logo">ByteRush</span></span><span className="tag">Learn. Code. Debug. Level Up.</span></div>
        <nav>{tab('playground', 'Playground')}{tab('solver', 'Questions')}{tab('notebook', 'Notebook')}{tab('notes', 'Notes')}{practice && tab('practice', 'Practice')}{tab('progress', 'Progress')}{tab('settings', 'Settings')}</nav>
        <div className="right">
          <ProgressChip streak={streak} streakState={streakState} level={level} dayXp={dayXp} quests={quests} onClick={() => setView('progress')} />
          <button className="iconbtn" aria-label="Toggle light and dark mode" title="Toggle theme" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>{resolved === 'dark' ? '☀️' : '🌙'}</button>
          <LanguageMenu value={lang} onChange={(l) => { setLang(l); setView('playground'); }} />
        </div>
      </header>
      {publicMode && !getKey() && view !== 'settings' && (
        <div className="keybar">👋 Add your own free Gemini key to unlock the AI features. Running Java works without it.
          <button className="primary" onClick={() => setView('settings')}>Add my key</button></div>
      )}

      {publicMode && !persistent && ['solver', 'notebook', 'practice'].includes(view) && (
        <div className="keybar">ℹ️ Heads up: questions saved on this site live on a temporary server disk and may be cleared when the site restarts. Download anything you want to keep.</div>
      )}
      {lang === 'web' && ['solver', 'notebook', 'practice'].includes(view) && (
        <div className="keybar">ℹ️ Questions, Notebook and Practice need a programming language. Choose Java, Python, C, C++ or JavaScript from the menu.
          <button onClick={() => setLang('java')}>Switch to Java</button></div>
      )}
      {view === 'playground' && lang === 'web' && <WebPlayground theme={resolved} />}
      {view === 'playground' && lang === 'js' && <JsPlayground key={`js-${pgNonce}`} theme={resolved} onRunStatus={runStatus} />}
      {view === 'playground' && (lang === 'python' || lang === 'c' || lang === 'cpp') && <CodePlayground key={`${lang}-${pgNonce}`} lang={lang} theme={resolved} onRunStatus={runStatus} />}
      {view === 'playground' && lang === 'java' && (
        <main>
          <section className="editor"><CodeEditor highlightLine={highlightLine} theme={resolved} value={code} onChange={setCode} onRun={run} errors={result?.status === 'compile_error' ? result.errors ?? [] : []} /></section>
          <section className="side">
            <div className="actions">
              <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
              <button onClick={analyze} disabled={analyzing} title="One AI request">{analyzing ? 'Analyzing…' : '✨ Analyze'}</button>
              <button onClick={visualize} disabled={tracing} title="One AI request">{tracing ? 'Tracing…' : '👣 Visualize'}</button>
              <button onClick={() => { setCode(''); setResult(null); }}>Clear</button>
            </div>
            <div className="ptabs">{ptab('input', stdin.trim() ? 'Input •' : 'Input')}{ptab('output', 'Output')}{ptab('analysis', 'Analysis')}{ptab('trace', 'Trace')}</div>
            {panel === 'input' && <InputPanel value={stdin} onChange={setStdin} onRun={run} />}
            {panel === 'output' && <OutputPanel result={result} running={running} dayXp={dayXp}
              extra={result ? <ErrorCoach key={`${result.status}|${result.stderr}|${code.length}`} code={code} result={result} /> : null} />}
            {panel === 'analysis' && <AnalysisPanel analysis={analysis} loading={analyzing} error={aErr} errorCode={aErrCode} stale={Boolean(analysis) && analysisFor !== code}
              onAnalyze={analyze} onOpenSettings={() => setView('settings')} />}
            {panel === 'trace' && <TracePanel trace={trace} code={code} loading={tracing} error={tErr} errorCode={tErrCode} stale={Boolean(trace) && traceFor !== traceKey}
              step={tStep} onStep={setTStep} onGenerate={visualize} onOpenSettings={() => setView('settings')} />}
          </section>
        </main>
      )}
      {view === 'solver' && (
        <QuestionSolver text={qText} onText={setQText} entry={entry} history={history} busy={busy} error={err} errorCode={errCode}
          onOpenSettings={() => setView('settings')}
          onSolve={(force, t) => void ask('solve', t ?? qText, force)}
          onSimilar={(force, t) => void ask('related', t ?? qText, force)}
          onSolveRelated={(st) => void ask('solve', st)}
          onPractice={() => { if (entry) { setPractice(entryToPractice(entry, qlang)); setView('practice'); } }}
          onPracticeRelated={(r) => { setPractice(relatedToPractice(r, qlang)); setView('practice'); }}
          onPrint={(w) => { if (entry) print(entryToPractice(entry, qlang), w); }}
          onOpenPlayground={(c, i) => {
            if (qlang === 'java') { setCode(c); setStdin(i ?? ''); setResult(null); setPanel('output'); }
            else { // the other playgrounds read their code and input from storage when they open
              try { localStorage.setItem(qlang === 'js' ? 'algocoach-js-code' : `algocoach-code-${qlang}`, c); localStorage.setItem(`algocoach-stdin-${qlang}`, i ?? ''); } catch { /* storage unavailable */ }
              setPgNonce((n) => n + 1);
            }
            setView('playground');
          }}
          onOpenEntry={(id) => void openEntry(id)} onDeleteEntry={(id) => void removeEntry(id)} onNew={newQuestion}
          onOpenNotes={openNotesFor}
          onImage={(f) => void readImage(f)} reading={reading} photo={photo} onClearPhoto={() => setPhoto('')} autoSolve={autoSolve} onAutoSolve={setAutoSolve} />
      )}
      {/* Kept mounted (just hidden) so an unsaved notebook page survives switching tabs */}
      <div style={{ display: view === 'notebook' ? 'contents' : 'none' }}>
        <NotebookPage key={qlang} lang={qlang} theme={resolved} onOpenSettings={() => setView('settings')} onRunStatus={runStatus} active={view === 'notebook'} target={nbTarget} onOpenNotes={openNotesFor}
          onAnalyzed={(concepts) => record({ type: 'analyze', concepts, lang: qlang })} onPractice={(p) => { setPractice(p); setView('practice'); }} />
      </div>
      {view === 'notes' && <NotesPage key={qlang} lang={qlang} theme={resolved} onRunStatus={runStatus} target={notesTarget} onOpenLink={openLinked} />}
      {view === 'practice' && practice && (
        <PracticeView key={qlang + practice.title + (practice.solution ? '1' : '0') + (practice.testCount ?? 0)} lang={qlang} theme={resolved} problem={practice}
          onRunStatus={runStatus} onSolved={(key, concepts) => record({ type: 'solve', key, concepts, lang: qlang })} onScore={(score) => record({ type: 'score', score })}
          onOpenProgress={() => setView('progress')}
          onPrint={(w) => print(practice, w)} onGetSolution={(st) => void ask('solve', st, false, true)} onBack={() => setView('solver')} />
      )}
      {view === 'progress' && <ProgressPage progress={progress} today={today} level={level} streak={streak} streakState={streakState} dayXp={dayXp} quests={quests} onPracticeSkill={practiceSkill} onStart={() => setView('solver')} onReset={reset} />}
      {view === 'settings' && <SettingsPage theme={theme} onTheme={setTheme} onChanged={() => setKeyTick((t) => t + 1)} />}
    </div>
    <Toasts toasts={toasts} />
    <Watermark />
    <PrintSheet problem={printJob?.p ?? null} withSolution={printJob?.withSolution ?? false} />
  </LangContext.Provider>);
}
