import { Router } from 'express';
import { clearEntries, deleteEntry, getEntry, listEntries, toPublic } from '../services/historyStore.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', items: listEntries(req.owner).map((e) => ({
    id: e.id, title: e.title, question: e.question.slice(0, 160), createdAt: e.createdAt, updatedAt: e.updatedAt,
    difficulty: e.solution?.difficulty, hasSolution: Boolean(e.solution), hasRelated: Boolean(e.related) })) });
});
router.get('/:id', (req, res) => {
  const entry = getEntry(req.owner, req.params.id);
  entry ? res.json({ status: 'ok', entry: toPublic(entry) }) : res.status(404).json({ status: 'error', message: 'That question is no longer in your history.' });
});
router.delete('/:id', (req, res) => { deleteEntry(req.owner, req.params.id); res.json({ status: 'ok' }); });
router.delete('/', (_req, res) => { clearEntries(req.owner); res.json({ status: 'ok' }); });

export default router;
