import { Router } from 'express';
import { runJava } from '../services/java-execution/runner.js';

const router = Router();
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_RUNS || 4);
let active = 0;

router.post('/', async (req, res) => {
  const { language, code } = req.body ?? {};
  const stdin = typeof req.body?.stdin === 'string' ? req.body.stdin : '';
  if (language !== 'java') return res.status(400).json({ status: 'error', message: 'Only Java is supported right now.' });
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ status: 'error', message: 'The editor is empty - write some Java first.' });
  if (code.length > 50_000) return res.status(413).json({ status: 'error', message: 'Code is too long (50 KB max).' });
  if (stdin.length > 20_000) return res.status(413).json({ status: 'error', message: 'Input is too long (20,000 characters max).' });
  if (active >= MAX_CONCURRENT) return res.status(429).json({ status: 'error', message: 'The runner is busy. Try again in a moment.' });
  active++;
  try { res.json(await runJava(code, stdin)); }
  catch (e) { console.error(e); res.status(500).json({ status: 'error', message: 'Unexpected runner failure.' }); }
  finally { active--; }
});

export default router;
