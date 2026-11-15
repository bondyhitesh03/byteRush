import { Router } from '../middleware/safeRouter.js';
import { askAI, failJson } from '../services/ai/ask.js';
import { validateAnalysis, validateRelated } from '../services/ai/schemas.js';
import { langName } from '../services/languages.js';
import { SYSTEM as ANALYZE_SYSTEM } from './analyze.js';
import { RELATED_SYSTEM } from './question.js';
import { createFolder, createNote, deleteFolder, deleteNote, getNote, listFolders, listNotes, patchNote, renameFolder, setMeta } from '../services/notebookStore.js';

const router = Router();
const bad = (res, message, http = 400) => res.status(http).json({ status: 'error', message });
const summary = (n) => ({ id: n.id, number: n.number, title: n.title, updatedAt: n.updatedAt, folderId: n.folderId, starred: Boolean(n.starred), hasAnalysis: Boolean(n.analysis), hasSimilar: Boolean(n.related) });

function readFields(req, res) {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const stdin = typeof req.body?.stdin === 'string' ? req.body.stdin : '';
  if (question.length < 3) { bad(res, 'Paste the question first.'); return null; }
  if (question.length > 5000) { bad(res, 'The question is too long (5000 characters max).', 413); return null; }
  if (code.length > 20000) { bad(res, 'The code is too long (20,000 characters max).', 413); return null; }
  if (stdin.length > 20000) { bad(res, 'The input is too long (20,000 characters max).', 413); return null; }
  return { question, code, stdin };
}

router.get('/', async (req, res) => {
  const [items, folders] = await Promise.all([listNotes(req.scope), listFolders(req.scope)]);
  res.json({ status: 'ok', items: items.map(summary), folders });
});

// Folders (declared before '/:id' so "folders" is never mistaken for a note id)
const folderReply = (res, r) => (r.error ? bad(res, r.error, r.status || 400) : res.json({ status: 'ok', ...r }));
router.post('/folders', async (req, res) => folderReply(res, await createFolder(req.scope, req.body?.name)));
router.put('/folders/:fid', async (req, res) => folderReply(res, await renameFolder(req.scope, req.params.fid, req.body?.name)));
router.delete('/folders/:fid', async (req, res) => folderReply(res, await deleteFolder(req.scope, req.params.fid)));

router.get('/:id', async (req, res) => {
  const note = await getNote(req.scope, req.params.id);
  note ? res.json({ status: 'ok', note }) : bad(res, 'That question is no longer in your notebook.', 404);
});

router.post('/', async (req, res) => {
  const f = readFields(req, res); if (!f) return;
  const folderId = typeof req.body?.folderId === 'string' ? req.body.folderId : 'general';
  const note = await createNote(req.scope, { ...f, folderId, starred: req.body?.starred === true });
  note ? res.json({ status: 'ok', note }) : bad(res, 'Your notebook is full (200 questions). Delete some to add more.', 409);
});

router.put('/:id', async (req, res) => {
  const f = readFields(req, res); if (!f) return;
  const note = await patchNote(req.scope, req.params.id, f);
  note ? res.json({ status: 'ok', note }) : bad(res, 'That question is no longer in your notebook.', 404);
});

// Move to a folder and/or mark as important (⭐). Doesn't need the question text.
router.patch('/:id/meta', async (req, res) => {
  const meta = {};
  if (typeof req.body?.folderId === 'string') meta.folderId = req.body.folderId;
  if (typeof req.body?.starred === 'boolean') meta.starred = req.body.starred;
  const r = await setMeta(req.scope, req.params.id, meta);
  r.error ? bad(res, r.error, r.status || 400) : res.json({ status: 'ok', note: r.note });
});

router.delete('/:id', async (req, res) => { await deleteNote(req.scope, req.params.id); res.json({ status: 'ok' }); });

// One AI request. Free if the saved code hasn't changed since the last analysis.
router.post('/:id/analyze', async (req, res) => {
  const note = await getNote(req.scope, req.params.id);
  if (!note) return bad(res, 'That question is no longer in your notebook.', 404);
  if (!note.code.trim()) return bad(res, 'Add some code first.');
  if (note.analysis && note.analyzedCode === note.code && !req.body?.force) return res.json({ status: 'ok', cached: true, note });
  try {
    const analysis = await askAI(ANALYZE_SYSTEM, `LANGUAGE: ${langName(req.language)}\nQUESTION (context only):\n"""\n${note.question}\n"""\n\nCODE:\n"""\n${note.code}\n"""`, validateAnalysis);
    res.json({ status: 'ok', cached: false, note: (await patchNote(req.scope, note.id, { analysis, analyzedCode: note.code })) ?? note });
  } catch (e) { failJson(res, e); }
});

// One AI request: 3 similar questions + LeetCode picks.
router.post('/:id/similar', async (req, res) => {
  const note = await getNote(req.scope, req.params.id);
  if (!note) return bad(res, 'That question is no longer in your notebook.', 404);
  if (note.related && !req.body?.force) return res.json({ status: 'ok', cached: true, note });
  try {
    const ctx = note.code.trim() ? `\nSTUDENT CODE (context only):\n${note.code.slice(0, 1500)}` : '';
    const { related, leetcode } = await askAI(RELATED_SYSTEM, `LANGUAGE: ${langName(req.language)}\nQUESTION:\n"""\n${note.question}\n"""${ctx}`, validateRelated);
    res.json({ status: 'ok', cached: false, note: (await patchNote(req.scope, note.id, { related, leetcode })) ?? note });
  } catch (e) { failJson(res, e); }
});

export default router;
