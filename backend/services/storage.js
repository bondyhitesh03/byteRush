// Per-owner JSON documents (kind: "history" | "notebook").
//  - files driver (default): backend/data/*.json. Fine on your own computer; on free hosts the disk is wiped on restart.
//  - supabase driver: set SUPABASE_URL + SUPABASE_SERVICE_KEY (server-side secrets) for permanent storage on a free host.
import fs from 'node:fs/promises';
import path from 'node:path';
import { isPublicMode } from './publicMode.js';
import { DATA_DIR as DIR } from './dataDir.js';

const TABLE = 'byterush_docs';
const SAFE_OWNER = /^(local|[0-9a-f-]{36})$/i;
const LANGS = ['java', 'python', 'c', 'cpp', 'js'];

// A "scope" is the owner plus the language ("abc~python"). Java is the default and keeps the original file names.
function parseScope(scope) {
  const [owner, lang = 'java'] = String(scope).split('~');
  if (!SAFE_OWNER.test(owner) || !LANGS.includes(lang)) throw storageError('Bad owner.');
  return { owner, lang, suffix: lang === 'java' ? '' : `-${lang}`, kindKey: (kind) => (lang === 'java' ? kind : `${kind}:${lang}`) };
}
// Each kind of document: the file name on your own computer, and the folder used for visitors on a public site.
const LAYOUT = { history: ['history', 'users'], notebook: ['notebook', 'notebooks'], notes: ['notes', 'notes'] };
const pathFor = (owner, kind, suffix) => {
  const [file, dir] = LAYOUT[kind] ?? LAYOUT.notebook;
  return owner === 'local' ? path.join(DIR, `${file}${suffix}.json`) : path.join(DIR, dir, `${owner}${suffix}.json`);
};

const supa = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? { url: process.env.SUPABASE_URL.replace(/\/$/, ''), key: process.env.SUPABASE_SERVICE_KEY } : null);
export const storageDriver = () => (supa() ? 'supabase' : 'files');
// On your own computer files persist. On a public host they only persist with Supabase.
export const isPersistent = () => storageDriver() === 'supabase' || !isPublicMode();

function storageError(message) { const e = new Error(message); e.code = 'storage'; return e; }

async function sb(method, pathAndQuery, body, headers = {}) {
  const c = supa();
  let res;
  try {
    res = await fetch(`${c.url}/rest/v1/${pathAndQuery}`, {
      method, signal: AbortSignal.timeout(15_000),
      headers: { apikey: c.key, authorization: `Bearer ${c.key}`, 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw storageError('Could not reach the database.'); }
  if (!res.ok) { console.error('Supabase error', res.status, (await res.text().catch(() => '')).slice(0, 200)); throw storageError(`Database error (${res.status}).`); }
  return res;
}

export async function readDoc(scope, kind, fallback) {
  const { owner, suffix, kindKey } = parseScope(scope);
  if (supa()) {
    const rows = await (await sb('GET', `${TABLE}?owner=eq.${encodeURIComponent(owner)}&kind=eq.${encodeURIComponent(kindKey(kind))}&select=data`)).json();
    return rows?.[0]?.data ?? fallback;
  }
  try { return JSON.parse(await fs.readFile(pathFor(owner, kind, suffix), 'utf8')); } catch { return fallback; }
}

export async function writeDoc(scope, kind, data) {
  const { owner, suffix, kindKey } = parseScope(scope);
  if (supa()) {
    await sb('POST', `${TABLE}?on_conflict=owner,kind`, { owner, kind: kindKey(kind), data, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    return;
  }
  const f = pathFor(owner, kind, suffix);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f + '.tmp', JSON.stringify(data));
  await fs.rename(f + '.tmp', f);
}

// Public mode: forget visitors who haven't been back for a while.
export async function cleanupOld(days = 30) {
  try {
    if (supa()) { await sb('DELETE', `${TABLE}?updated_at=lt.${encodeURIComponent(new Date(Date.now() - days * 86400000).toISOString())}`, undefined, { Prefer: 'return=minimal' }); return; }
    for (const sub of ['users', 'notebooks', 'notes']) {
      const dir = path.join(DIR, sub);
      for (const f of await fs.readdir(dir).catch(() => [])) {
        const p = path.join(dir, f);
        if (Date.now() - (await fs.stat(p)).mtimeMs > days * 86400000) await fs.rm(p, { force: true });
      }
    }
  } catch (e) { console.error('cleanup failed:', e.message); }
}
