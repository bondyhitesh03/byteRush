// Question history for one owner. Storage is handled by services/storage.js.
import { randomUUID } from 'node:crypto';
import { readDoc, writeDoc } from './storage.js';

const KIND = 'history';
const MAX_ENTRIES = 200;
const norm = (q) => q.toLowerCase().replace(/\s+/g, ' ').trim();
const load = async (owner) => { const d = await readDoc(owner, KIND, []); return Array.isArray(d) ? d : []; };

export const listEntries = (owner) => load(owner);
export const getEntry = async (owner, id) => (await load(owner)).find((e) => e.id === id) || null;
export const findByQuestion = async (owner, q) => (await load(owner)).find((e) => norm(e.question) === norm(q)) || null;
export function newEntry(question) {
  const now = new Date().toISOString();
  return { id: randomUUID(), question, title: question.replace(/\s+/g, ' ').slice(0, 70), createdAt: now, updatedAt: now };
}
export async function saveEntry(owner, entry) {
  const saved = { ...entry, updatedAt: new Date().toISOString() };
  await writeDoc(owner, KIND, [saved, ...(await load(owner)).filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES));
  return saved;
}
export async function deleteEntry(owner, id) {
  const list = await load(owner);
  const next = list.filter((e) => e.id !== id);
  await writeDoc(owner, KIND, next);
  return next.length !== list.length;
}
export const clearEntries = (owner) => writeDoc(owner, KIND, []);

// What the browser may see: no hidden tests and no attempt code (those stay on the server).
export function toPublic(e) {
  if (!e) return e;
  const { attempts, ...rest } = e;
  const out = { ...rest, attemptCount: (attempts || []).length };
  if (e.solution) { const { tests, ...s } = e.solution; out.solution = { ...s, testCount: (tests || []).length }; }
  return out;
}
