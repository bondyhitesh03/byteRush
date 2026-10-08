// Question history, one JSON file per owner: backend/data/history.json (local mode) or backend/data/users/<browser-id>.json (public mode).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const MAX_ENTRIES = 200;
const norm = (q) => q.toLowerCase().replace(/\s+/g, ' ').trim();
const fileFor = (owner) => (owner === 'local' ? path.join(DIR, 'history.json') : path.join(DIR, 'users', `${owner}.json`));

function load(owner) {
  try { const d = JSON.parse(fs.readFileSync(fileFor(owner), 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; }
}
function save(owner, list) {
  const file = fileFor(owner);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(list));
  fs.renameSync(file + '.tmp', file);
}

export const listEntries = (owner) => load(owner);
export const getEntry = (owner, id) => load(owner).find((e) => e.id === id) || null;
export const findByQuestion = (owner, q) => load(owner).find((e) => norm(e.question) === norm(q)) || null;
export function newEntry(question) {
  const now = new Date().toISOString();
  return { id: randomUUID(), question, title: question.replace(/\s+/g, ' ').slice(0, 70), createdAt: now, updatedAt: now };
}
export function saveEntry(owner, entry) {
  const saved = { ...entry, updatedAt: new Date().toISOString() };
  save(owner, [saved, ...load(owner).filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES));
  return saved;
}
export function deleteEntry(owner, id) {
  const list = load(owner); const next = list.filter((e) => e.id !== id); save(owner, next); return next.length !== list.length;
}
export const clearEntries = (owner) => save(owner, []);

// Public mode: forget visitors who haven't been back for a while.
export function cleanupOldUsers(days = 30) {
  const dir = path.join(DIR, 'users');
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (Date.now() - fs.statSync(p).mtimeMs > days * 86400000) fs.rmSync(p, { force: true });
    }
  } catch { /* no users yet */ }
}

// What the browser may see: no hidden tests and no attempt code (those stay on the server).
export function toPublic(e) {
  if (!e) return e;
  const { attempts, ...rest } = e;
  const out = { ...rest, attemptCount: (attempts || []).length };
  if (e.solution) { const { tests, ...s } = e.solution; out.solution = { ...s, testCount: (tests || []).length }; }
  return out;
}
