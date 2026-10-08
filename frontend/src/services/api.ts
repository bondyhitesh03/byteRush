import type { Language, RunResult } from '../types/run';
import type { Entry, HistoryItem } from '../types/question';
import { clientId, getKey, getModel } from '../utils/clientStore';

// Every request carries this browser's id (separate history per visitor) and, in public mode, the visitor's own key.
function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const h = new Headers(init.headers);
  h.set('x-client-id', clientId());
  const key = getKey();
  if (key) h.set('x-ai-key', key);
  const model = getModel();
  if (model) h.set('x-ai-model', model);
  return fetch(input, { ...init, headers: h });
}
export async function getHealth(): Promise<{ publicMode: boolean }> {
  try { const d = await (await fetch('/api/health')).json(); return { publicMode: Boolean(d.publicMode) }; } catch { return { publicMode: false }; }
}

const OFFLINE = "Can't reach the backend. Is it running on port 3001?";

export async function runCode(language: Language, code: string, stdin = ''): Promise<RunResult> {
  try {
    const res = await apiFetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language, code, stdin }) });
    return (await res.json()) as RunResult;
  } catch {
    return { status: 'error', message: OFFLINE };
  }
}

// ---- Questions (each call = at most one AI request; repeats are served from history) ----
export type EntryResult = { ok: true; entry: Entry; cached: boolean } | { ok: false; message: string; code?: string };

async function postQuestion(path: string, question: string, force: boolean): Promise<EntryResult> {
  try {
    const res = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, force }) });
    const data = await res.json();
    return data.status === 'ok' ? { ok: true, entry: data.entry as Entry, cached: Boolean(data.cached) } : { ok: false, message: data.message ?? 'Something went wrong.', code: data.code };
  } catch {
    return { ok: false, message: OFFLINE, code: 'network' };
  }
}
export const solveQuestion = (question: string, force = false) => postQuestion('/api/question/solve', question, force);
export const findSimilar = (question: string, force = false) => postQuestion('/api/question/related', question, force);

// ---- History ----
export async function listHistory(): Promise<HistoryItem[]> {
  try { const d = await (await apiFetch('/api/history')).json(); return (d.items ?? []) as HistoryItem[]; } catch { return []; }
}
export async function getEntry(id: string): Promise<Entry | null> {
  try { const d = await (await apiFetch(`/api/history/${id}`)).json(); return d.status === 'ok' ? (d.entry as Entry) : null; } catch { return null; }
}
export async function deleteEntry(id: string): Promise<void> {
  try { await apiFetch(`/api/history/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
}

// ---- Settings ----
export interface AiSettings { publicMode?: boolean; provider: string; model: string; defaultModel: string; hasKey: boolean; keyHint: string; source: 'settings' | 'env' | null }
export interface ActionResult { ok: boolean; message: string }

async function call(method: string, path: string, body?: unknown): Promise<ActionResult & { data: Record<string, unknown> }> {
  try {
    const res = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.status !== 'error', message: (data.message as string) ?? (res.ok ? 'Done.' : 'Something went wrong.'), data };
  } catch {
    return { ok: false, message: OFFLINE, data: {} };
  }
}
export async function getSettings(): Promise<AiSettings | null> { const r = await call('GET', '/api/settings'); return r.ok ? (r.data as unknown as AiSettings) : null; }
export const saveKey = (key: string) => call('PUT', '/api/settings/key', { key });
export const removeKey = () => call('DELETE', '/api/settings/key');
export const saveModel = (model: string) => call('PUT', '/api/settings/model', { model });
export const testKey = () => call('POST', '/api/settings/test');

// ---- Code analysis ----
import type { Analysis } from '../types/analysis';
export async function analyzeCode(code: string): Promise<{ ok: true; analysis: Analysis } | { ok: false; message: string; code?: string }> {
  try {
    const res = await apiFetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json();
    return data.status === 'ok' ? { ok: true, analysis: data.analysis as Analysis } : { ok: false, message: data.message ?? 'Something went wrong.', code: data.code };
  } catch {
    return { ok: false, message: OFFLINE, code: 'network' };
  }
}

// ---- Grading, coach, trace, stats ----
import type { Attempt, Coach, Compare, FinalScore, GradeResult, Stats, Trace } from '../types/practice';
type Fail = { ok: false; message: string; code?: string };

async function req(method: string, path: string, body?: unknown): Promise<{ ok: true; data: Record<string, unknown> } | Fail> {
  try {
    const res = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return data.status === 'ok' ? { ok: true, data } : { ok: false, message: data.message ?? 'Something went wrong.', code: data.code };
  } catch {
    return { ok: false, message: OFFLINE, code: 'network' };
  }
}

export async function gradeCode(question: string, code: string): Promise<({ ok: true } & GradeResult) | Fail> {
  const r = await req('POST', '/api/grade', { question, code });
  return r.ok ? { ok: true, ...(r.data as unknown as GradeResult) } : r;
}
export async function finalizeScore(question: string, attemptId: string, efficiency: number, quality: number): Promise<({ ok: true } & Pick<FinalScore, 'score' | 'correctness' | 'efficiency' | 'quality'>) | Fail> {
  const r = await req('POST', '/api/grade/score', { question, attemptId, efficiency, quality });
  return r.ok ? { ok: true, score: r.data.score as number, correctness: r.data.correctness as number, efficiency: r.data.efficiency as number, quality: r.data.quality as number } : r;
}
export async function coachError(code: string, error: string, kind: string): Promise<{ ok: true; coach: Coach } | Fail> {
  const r = await req('POST', '/api/coach', { code, error, kind });
  return r.ok ? { ok: true, coach: r.data.coach as Coach } : r;
}
export async function traceCode(code: string, stdin: string): Promise<{ ok: true; trace: Trace } | Fail> {
  const r = await req('POST', '/api/trace', { code, stdin });
  return r.ok ? { ok: true, trace: r.data.trace as Trace } : r;
}
export async function getStats(): Promise<Stats | null> {
  const r = await req('GET', '/api/stats');
  return r.ok ? (r.data as unknown as Stats) : null;
}
export async function getAttempts(entryId: string): Promise<Attempt[]> {
  const r = await req('GET', `/api/attempts/${entryId}`);
  return r.ok ? (r.data.attempts as Attempt[]) : [];
}
export async function compareAttempts(entryId: string, aId: string, bId: string): Promise<{ ok: true; compare: Compare } | Fail> {
  const r = await req('POST', '/api/compare', { entryId, aId, bId });
  return r.ok ? { ok: true, compare: r.data.compare as Compare } : r;
}

// ---- Notebook ----
import type { Folder, Note, NoteSummary } from '../types/notebook';
export type NoteResult = { ok: true; note: Note; cached: boolean } | Fail;

const asNote = (r: Awaited<ReturnType<typeof req>>): NoteResult => (r.ok ? { ok: true, note: r.data.note as Note, cached: Boolean(r.data.cached) } : r);
export async function listNotes(): Promise<{ items: NoteSummary[]; folders: Folder[] }> {
  const r = await req('GET', '/api/notebook');
  return r.ok ? { items: r.data.items as NoteSummary[], folders: r.data.folders as Folder[] } : { items: [], folders: [{ id: 'general', name: 'General', builtin: true }] };
}
export async function getNote(id: string): Promise<Note | null> {
  const r = await req('GET', `/api/notebook/${id}`);
  return r.ok ? (r.data.note as Note) : null;
}
export const createNote = async (question: string, code: string, stdin: string, folderId = 'general', starred = false): Promise<NoteResult> =>
  asNote(await req('POST', '/api/notebook', { question, code, stdin, folderId, starred }));
export const updateNote = async (id: string, question: string, code: string, stdin: string): Promise<NoteResult> => asNote(await req('PUT', `/api/notebook/${id}`, { question, code, stdin }));
export async function deleteNote(id: string): Promise<boolean> { return (await req('DELETE', `/api/notebook/${id}`)).ok; }
export const analyzeNote = async (id: string, force = false): Promise<NoteResult> => asNote(await req('POST', `/api/notebook/${id}/analyze`, { force }));
export const similarNotes = async (id: string, force = false): Promise<NoteResult> => asNote(await req('POST', `/api/notebook/${id}/similar`, { force }));

// Folders and the important (star) mark
export const setNoteMeta = async (id: string, meta: { folderId?: string; starred?: boolean }): Promise<NoteResult> => asNote(await req('PATCH', `/api/notebook/${id}/meta`, meta));
export async function createFolder(name: string): Promise<{ ok: true; folder: Folder } | Fail> {
  const r = await req('POST', '/api/notebook/folders', { name });
  return r.ok ? { ok: true, folder: r.data.folder as Folder } : r;
}
export async function renameFolder(id: string, name: string): Promise<{ ok: true; folder: Folder } | Fail> {
  const r = await req('PUT', `/api/notebook/folders/${id}`, { name });
  return r.ok ? { ok: true, folder: r.data.folder as Folder } : r;
}
export async function deleteFolder(id: string): Promise<{ ok: true; moved: number } | Fail> {
  const r = await req('DELETE', `/api/notebook/folders/${id}`);
  return r.ok ? { ok: true, moved: Number(r.data.moved) || 0 } : r;
}
