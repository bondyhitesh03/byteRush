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
import notesRoute from './routes/notes.js';
import { aiConfig } from './services/ai/client.js';
import { isPublicMode } from './services/publicMode.js';
import { cleanupOld, isPersistent, storageDriver } from './services/storage.js';
import { runnerMode } from './services/java-execution/runner.js';
import { localInfo } from './services/java-execution/local.js';
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
app.use('/api/question/read-image', express.json({ limit: '6mb' })); // photos are bigger than normal requests
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json(isPublicMode()
  ? { ok: true, app: 'ByteRush', publicMode: true, persistent: isPersistent() }
  : { ok: true, app: 'ByteRush', publicMode: false, persistent: true, ai: { provider: aiConfig().name, model: aiConfig().model, ready: aiConfig().ready } }));

if (isPublicMode()) {
  app.use('/api', rateLimit({ windowMs: 60_000, max: 300 }));
  // Code execution and AI calls are the expensive ones.
  app.use(['/api/run', '/api/grade', '/api/question', '/api/analyze', '/api/coach', '/api/trace', '/api/compare', '/api/settings/test', '/api/notebook/:id/analyze', '/api/notebook/:id/similar'], rateLimit({ windowMs: 60_000, max: 20 }));
  const cleanup = () => { void cleanupOld(30); };
  cleanup();
  setInterval(cleanup, 24 * 3600 * 1000).unref();
}
app.use('/api', requestContext);

app.use('/api/run', runRoute);
app.use('/api/question', questionRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/history', historyRoute);
app.use('/api/notebook', notebookRoute);
app.use('/api/notes', notesRoute);
app.use('/api/analyze', analyzeRoute);
app.use('/api', practiceRoute);
app.use('/api', tutorRoute);

// If the frontend was built (npm run build in frontend/), serve it from here so one process is enough.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('*', (req, res) => (req.path.startsWith('/api') ? res.status(404).json({ status: 'error', message: 'Not found' }) : res.sendFile(path.join(dist, 'index.html'))));
}

app.use((err, _req, res, _next) => { // malformed JSON, storage problems, anything unexpected
  if (err.code === 'storage') return res.status(503).json({ status: 'error', code: 'storage', message: 'Saving is unavailable right now. Please try again in a moment.' });
  if (!err.status || err.status >= 500) console.error('Unhandled error:', err.message);
  res.status(err.status && err.status < 500 ? err.status : 500).json({ status: 'error', message: err.status && err.status < 500 ? 'Bad request.' : 'Something went wrong on the server.' });
});
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e?.message ?? e));

// Localhost only by default. On a server behind a reverse proxy set HOST=0.0.0.0.
const host = process.env.HOST || '127.0.0.1';
app.listen(process.env.PORT || 3001, host, () => {
  console.log(`ByteRush backend on ${host}:${process.env.PORT || 3001}${isPublicMode() ? ' (PUBLIC MODE)' : ''}`);
  console.log(`Java runner: ${runnerMode()}${runnerMode() === 'local' ? ' ' + JSON.stringify(localInfo()) : ''} | storage: ${storageDriver()}${isPersistent() ? '' : ' (temporary: resets when the host restarts)'}`);
});
