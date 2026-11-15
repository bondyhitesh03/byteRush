import { Router } from '../middleware/safeRouter.js';
import { createNote, deleteNote, findByLink, getNote, listNotes, updateNote, LINK_KINDS } from '../services/notesStore.js';
import { QUESTION_LANGS } from '../services/languages.js';

const router = Router();
const NOTES_LANGUAGES = Object.keys(QUESTION_LANGS); // Java, Python, C, C++ and JavaScript; each language keeps its own notes
const bad = (res, message, http = 400) => res.status(http).json({ status: 'error', message });
const allowed = (req, res) => NOTES_LANGUAGES.includes(req.language) || (bad(res, 'Notes are not available for this language.'), false);
const summary = (n) => ({ id: n.id, title: n.title, preview: n.body.replace(/\s+/g, ' ').trim().slice(0, 160), updatedAt: n.updatedAt, tags: n.tags, pinned: n.pinned, link: n.link });
const reply = (res, r) => (r.error ? bad(res, r.error, r.status || 400) : res.json({ status: 'ok', note: r.note }));

// GET /api/notes                      every note (pinned first)
// GET /api/notes?kind=question&id=ID  only the notes linked to that question / notebook page
router.get('/', async (req, res) => {
  if (!allowed(req, res)) return;
  const { kind, id } = req.query;
  if (kind !== undefined || id !== undefined) {
    if (typeof kind !== 'string' || typeof id !== 'string' || !LINK_KINDS.includes(kind) || !/^[\w-]{1,100}$/.test(id)) return bad(res, 'Bad link.');
    return res.json({ status: 'ok', items: (await findByLink(req.scope, kind, id)).map(summary) });
  }
  res.json({ status: 'ok', items: (await listNotes(req.scope)).map(summary) });
});
router.get('/:id', async (req, res) => {
  if (!allowed(req, res)) return;
  const note = await getNote(req.scope, req.params.id);
  note ? res.json({ status: 'ok', note }) : bad(res, 'That note no longer exists.', 404);
});
router.post('/', async (req, res) => { if (allowed(req, res)) reply(res, await createNote(req.scope, req.body)); });
router.put('/:id', async (req, res) => { if (allowed(req, res)) reply(res, await updateNote(req.scope, req.params.id, req.body)); });
router.delete('/:id', async (req, res) => { if (!allowed(req, res)) return; await deleteNote(req.scope, req.params.id); res.json({ status: 'ok' }); });

export default router;
