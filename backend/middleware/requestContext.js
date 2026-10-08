import { aiContext } from '../services/ai/context.js';
import { isPublicMode } from '../services/publicMode.js';

const KEY_RE = /^[^\s'"]{20,300}$/;
const MODEL_RE = /^[\w.:/-]{2,100}$/;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Local mode: one owner ("local"), server-side key. Public mode: owner = browser id, key = the visitor's own key.
export function requestContext(req, res, next) {
  if (!isPublicMode()) { req.owner = 'local'; return next(); }
  const id = String(req.get('x-client-id') || '');
  if (!ID_RE.test(id)) return res.status(400).json({ status: 'error', code: 'client_id', message: 'Missing browser ID. Please reload the page.' });
  req.owner = id.toLowerCase();
  const key = String(req.get('x-ai-key') || '');
  const model = String(req.get('x-ai-model') || '');
  aiContext.run({ key: KEY_RE.test(key) ? key : '', model: MODEL_RE.test(model) ? model : '' }, next);
}
