import { Router } from '../middleware/safeRouter.js';
import { clearEntries, deleteEntry, getEntry, listEntries, toPublic } from '../services/historyStore.js';

const router = Router();

router.get('/', async (req, res) => {
  const items = await listEntries(req.scope);
  res.json({ status: 'ok', items: items.map((e) => ({
    id: e.id, title: e.title, question: e.question.slice(0, 160), createdAt: e.createdAt, updatedAt: e.updatedAt,
    difficulty: e.solution?.difficulty, hasSolution: Boolean(e.solution), hasRelated: Boolean(e.related) })) });
});
router.get('/:id', async (req, res) => {
  const entry = await getEntry(req.scope, req.params.id);
  entry ? res.json({ status: 'ok', entry: toPublic(entry) }) : res.status(404).json({ status: 'error', message: 'That question is no longer in your history.' });
});
router.delete('/:id', async (req, res) => { await deleteEntry(req.scope, req.params.id); res.json({ status: 'ok' }); });
router.delete('/', async (req, res) => { await clearEntries(req.scope); res.json({ status: 'ok' }); });

export default router;
