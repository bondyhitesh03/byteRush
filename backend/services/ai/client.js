// AI client for OpenAI-compatible endpoints. Default: Google Gemini with the key saved in Settings.
import { getSettings } from '../settings.js';
import { aiContext } from './context.js';
import { isPublicMode } from '../publicMode.js';

export class AIError extends Error {
  constructor(message, status = 502, code = 'error') { super(message); this.status = status; this.code = code; }
}

export const GEMINI = { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest' }; // alias that follows Google's current Flash model
const PRESETS = {
  gemini: { ...GEMINI, needsKey: true },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', needsKey: true },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder:7b', needsKey: false },
};
const trim = (u) => u.replace(/\/$/, '');

export function aiConfig() {
  if (isPublicMode()) { // never fall back to a server-side key: strangers must bring their own
    const ctx = aiContext.getStore();
    return { name: 'gemini', baseUrl: trim(process.env.AI_BASE_URL || GEMINI.baseUrl), model: ctx?.model || GEMINI.model, key: ctx?.key || '', ready: Boolean(ctx?.key), source: ctx?.key ? 'browser' : null, pinned: Boolean(ctx?.model) };
  }
  const s = getSettings();
  if (s.apiKey) { // a key saved in Settings always means Gemini
    return { name: 'gemini', baseUrl: trim(process.env.AI_BASE_URL || GEMINI.baseUrl), model: s.model || GEMINI.model, key: s.apiKey, ready: true, source: 'settings', pinned: Boolean(s.model) };
  }
  const name = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const preset = PRESETS[name] || { baseUrl: '', model: '', needsKey: true };
  const key = process.env.AI_API_KEY || (preset.needsKey ? '' : 'ollama');
  return { name, baseUrl: trim(process.env.AI_BASE_URL || preset.baseUrl), model: s.model || process.env.AI_MODEL || preset.model, key, ready: Boolean(key), source: process.env.AI_API_KEY ? 'env' : null, pinned: Boolean(s.model) };
}

const post = (cfg, body) => fetch(`${cfg.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120_000),
});

async function errorDetail(res) {
  let text = '';
  try { text = await res.text(); } catch { /* ignore */ }
  try { const j = JSON.parse(text); const e = Array.isArray(j) ? j[0]?.error : j.error; return String(e?.message || text).slice(0, 300); }
  catch { return text.slice(0, 300); }
}

function classify(status, detail, cfg) {
  if (/location is not supported/i.test(detail))
    return new AIError("Gemini isn't available from your current location or network.", 502, 'error');
  if (status === 401 || status === 403 || /api key|api_key|unauthenticated|permission denied/i.test(detail))
    return new AIError('Your API key was rejected. It may be wrong, expired or deleted. Open Settings and paste a new key.', 401, 'invalid_key');
  if (status === 429 || /quota|rate.?limit|exhausted/i.test(detail))
    return new AIError('Your free Gemini limit is used up for now. It may reset in a minute (per-minute limit) or by tomorrow (daily limit). To keep going right now, open Settings and paste a new key.', 429, 'quota');
  if (status === 503 || /high demand|overloaded|temporarily unavailable/i.test(detail))
    return new AIError("Google's AI servers are busy right now. This is temporary and not a problem with your key. Wait a minute and try again.", 503, 'busy');
  if (status === 404)
    return new AIError(`The model "${cfg.model}" was not found. Open Settings and change the model name.`, 502, 'model');
  return new AIError(`AI error ${status} (${cfg.name}, model "${cfg.model}"): ${detail || 'no details'}`, 502, 'error');
}

const RETRYABLE = new Set([500, 502, 503, 504]);
const FALLBACKS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']; // tried only if you haven't pinned a model in Settings
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(cfg, model, body) {
  const b = { ...body, model };
  let res = await post(cfg, { ...b, response_format: { type: 'json_object' } });
  if (res.status === 400 && !/api key|api_key/i.test(await errorDetail(res.clone()))) res = await post(cfg, b); // no JSON mode
  return res;
}

// images: optional data URLs (photos). Gemini reads them; other providers may not support images.
export async function callAI(system, user, maxTokens = 8192, images = []) {
  const cfg = aiConfig();
  if (!cfg.ready) throw new AIError('No API key yet. Open Settings and paste your own free Gemini key.', 503, 'no_key');
  if (!cfg.baseUrl || !cfg.model) throw new AIError('The AI provider is not set up. Open Settings and add a Gemini key.', 503, 'no_key');
  const body = { max_tokens: maxTokens, temperature: 0.3,
    messages: [{ role: 'system', content: system },
      { role: 'user', content: images.length ? [{ type: 'text', text: user }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))] : user }] };

  const models = [cfg.model];
  if (cfg.name === 'gemini' && !cfg.pinned) for (const m of FALLBACKS) if (!models.includes(m)) models.push(m);
  const wait = Number(process.env.AI_RETRY_MS || 1500);

  let last = { status: 502, detail: '', model: cfg.model };
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) { // temporary "high demand" errors: retry with a short pause
      let res;
      try { res = await request(cfg, model, body); }
      catch { throw new AIError(cfg.name === 'ollama' ? 'Could not reach Ollama. Is it running?' : 'Could not reach the AI service. Check your internet connection and try again.', 502, 'network'); }
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content ?? '';
      }
      last = { status: res.status, detail: await errorDetail(res), model };
      console.error(`AI error ${last.status} (${cfg.name}, ${model}): ${last.detail}`);
      if (RETRYABLE.has(last.status) && attempt < 2) { await sleep(wait * (attempt + 1)); continue; }
      break;
    }
    // Key problems stop here; busy / quota / unknown-model errors move on to the next model.
    if (!(RETRYABLE.has(last.status) || last.status === 404 || last.status === 429)) break;
  }
  throw classify(last.status, last.detail, { ...cfg, model: last.model });
}

export function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('AI reply contained no JSON');
  return JSON.parse(text.slice(s, e + 1));
}
