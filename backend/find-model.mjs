// Finds a Gemini model your saved key can really use, and saves it as your model in Settings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'settings.json');
let s = {};
try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none */ }
if (!s.apiKey) { console.log('No key saved yet. Save it in the app first: Settings -> API key.'); process.exit(1); }
const key = s.apiKey;

let listed = [];
try {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  if (!r.ok) console.log(`Google could not list models (status ${r.status}):`, (await r.text()).slice(0, 300));
  else listed = (await r.json()).models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => /flash/i.test(n) && !/tts|image|live|audio|embedding|robotics|computer/i.test(n));
} catch (e) { console.log('Could not reach Google:', e.message); }
console.log('Flash models your key can see:', listed.join(', ') || '(none found)', '\n');

const prefer = ['gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const candidates = [...new Set([...prefer.filter((m) => !listed.length || listed.includes(m)), ...listed])];
for (const model of candidates) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 50, messages: [{ role: 'user', content: 'Say hello' }] }),
  });
  const d = await r.json().catch(() => ({}));
  const good = r.ok && d.choices?.[0];
  console.log(good ? 'WORKS ' : 'fails ', model, good ? '' : `(${r.status})`);
  if (good) {
    s.model = model; fs.writeFileSync(file, JSON.stringify(s), { mode: 0o600 });
    console.log(`\nSaved model "${model}". Now press "Test key" in the app Settings.`);
    process.exit(0);
  }
}
console.log('\nNo model worked. Send me the lines above (they contain no key).');
