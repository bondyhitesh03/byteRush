import 'dotenv/config'; // must stay first so env vars are loaded before other modules read them
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import runRoute from './routes/run.js';
import questionRoute from './routes/question.js';
import settingsRoute from './routes/settings.js';
import historyRoute from './routes/history.js';
import analyzeRoute from './routes/analyze.js';
import practiceRoute from './routes/practice.js';
import tutorRoute from './routes/tutor.js';
import notebookRoute from './routes/notebook.js';
import { aiConfig } from './services/ai/client.js';
import { isPublicMode } from './services/publicMode.js';
import { cleanupOldUsers } from './services/historyStore.js';
import { cleanupOldNotebooks } from './services/notebookStore.js';
import { rateLimit } from './middleware/rateLimit.js';
import { requestContext } from './middleware/requestContext.js';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // only behind a proxy/tunnel
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); next();
});
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json(isPublicMode()
  ? { ok: true, publicMode: true }
  : { ok: true, publicMode: false, ai: { provider: aiConfig().name, model: aiConfig().model, ready: aiConfig().ready } }));

if (isPublicMode()) {
  app.use('/api', rateLimit({ windowMs: 60_000, max: 300 }));
  // Code execution and AI calls are the expensive ones.
  app.use(['/api/run', '/api/grade', '/api/question', '/api/analyze', '/api/coach', '/api/trace', '/api/compare', '/api/settings/test', '/api/notebook/:id/analyze', '/api/notebook/:id/similar'], rateLimit({ windowMs: 60_000, max: 20 }));
  const cleanup = () => { cleanupOldUsers(30); cleanupOldNotebooks(30); };
  cleanup();
  setInterval(cleanup, 24 * 3600 * 1000).unref();
}
app.use('/api', requestContext);

app.use('/api/run', runRoute);
app.use('/api/question', questionRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/history', historyRoute);
app.use('/api/notebook', notebookRoute);
app.use('/api/analyze', analyzeRoute);
app.use('/api', practiceRoute);
app.use('/api', tutorRoute);

// If the frontend was built (npm run build in frontend/), serve it from here so one process is enough.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('*', (req, res) => (req.path.startsWith('/api') ? res.status(404).json({ status: 'error', message: 'Not found' }) : res.sendFile(path.join(dist, 'index.html'))));
}

app.use((err, _req, res, _next) => { // e.g. malformed JSON
  res.status(err.status && err.status < 500 ? err.status : 500).json({ status: 'error', message: 'Bad request.' });
});

// Localhost only by default. On a server behind a reverse proxy set HOST=0.0.0.0.
const host = process.env.HOST || '127.0.0.1';
app.listen(process.env.PORT || 3001, host, () => console.log(`ByteRush backend on ${host}:${process.env.PORT || 3001}${isPublicMode() ? ' (PUBLIC MODE)' : ''}`));
