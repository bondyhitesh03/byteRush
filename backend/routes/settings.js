import { Router } from 'express';
import { aiConfig, callAI, AIError, GEMINI } from '../services/ai/client.js';
import { getSettings, setApiKey, clearApiKey, setModel } from '../services/settings.js';
import { isPublicMode } from '../services/publicMode.js';

const router = Router();
const ok = (res, message, extra = {}) => res.json({ status: 'ok', message, ...extra });
const fail = (res, code, message, http = 400) => res.status(http).json({ status: 'error', code, message });

// Public mode: the server's own settings can't be changed by visitors (their key lives in their browser).
router.use((req, res, next) => (isPublicMode() && ['PUT', 'DELETE'].includes(req.method)
  ? fail(res, 'public_mode', 'This server is in public mode. Your key is saved in your own browser in Settings.', 403) : next()));

router.get('/', (_req, res) => {
  if (isPublicMode()) return res.json({ status: 'ok', publicMode: true, provider: 'gemini', model: GEMINI.model, defaultModel: GEMINI.model, hasKey: false, keyHint: '', source: null });
  const cfg = aiConfig();
  const s = getSettings();
  const key = s.apiKey || process.env.AI_API_KEY || '';
  res.json({ status: 'ok', provider: cfg.name, model: cfg.model, defaultModel: GEMINI.model,
    hasKey: Boolean(key), keyHint: key ? `…${key.slice(-4)}` : '', source: s.apiKey ? 'settings' : process.env.AI_API_KEY ? 'env' : null });
});

router.put('/key', (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
  if (!/^[^\s'"]{20,300}$/.test(key)) return fail(res, 'bad_key', "That doesn't look like an API key. Copy the whole key from Google AI Studio (no spaces or quotes).");
  setApiKey(key);
  ok(res, 'Key saved. Press "Test key" to check it works.');
});

router.delete('/key', (_req, res) => { clearApiKey(); ok(res, 'Key removed.'); });

router.put('/model', (req, res) => {
  const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
  if (model && !/^[\w.:/-]{2,100}$/.test(model)) return fail(res, 'bad_model', 'That model name has unusual characters.');
  setModel(model);
  ok(res, model ? `Model set to ${model}.` : 'Model reset to the default.');
});

router.post('/test', async (_req, res) => {
  try {
    await callAI('Reply with the JSON object {"ok": true}.', 'ping', 200);
    ok(res, '✓ Your key works.');
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError('Test failed.');
    fail(res, err.code, err.message, err.status);
  }
});

export default router;
