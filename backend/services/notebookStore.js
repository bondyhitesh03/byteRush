// Notebook: the learner's own questions + code, organised in folders, with ⭐ important marks.
// One JSON file per owner: backend/data/notebook.json (local mode) or backend/data/notebooks/<browser-id>.json (public mode).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const MAX_NOTES = 200;
const MAX_FOLDERS = 30;
export const GENERAL = { id: 'general', name: 'General', builtin: true }; // always exists, can't be renamed or deleted
const fileFor = (owner) => (owner === 'local' ? path.join(DIR, 'notebook.json') : path.join(DIR, 'notebooks', `${owner}.json`));
const titleOf = (q) => q.replace(/\s+/g, ' ').trim().slice(0, 70);
const cleanName = (n) => String(n ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

function load(owner) {
  try {
    const d = JSON.parse(fs.readFileSync(fileFor(owner), 'utf8'));
    const folders = (Array.isArray(d.folders) ? d.folders : []).filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string' && f.id !== 'general');
    const ids = new Set(['general', ...folders.map((f) => f.id)]);
    // Older notebooks have no folders/stars yet: everything lands in General, unstarred.
    const items = (Array.isArray(d.items) ? d.items : []).map((n) => ({ ...n, folderId: ids.has(n.folderId) ? n.folderId : 'general', starred: Boolean(n.starred) }));
    return { nextNumber: Number(d.nextNumber) || 1, items, folders };
  } catch { return { nextNumber: 1, items: [], folders: [] }; }
}
function save(owner, data) {
  const f = fileFor(owner);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f + '.tmp', JSON.stringify(data));
  fs.renameSync(f + '.tmp', f);
}
const folderOk = (d, id) => id === 'general' || d.folders.some((f) => f.id === id);

export const listNotes = (owner) => load(owner).items;
export const listFolders = (owner) => [GENERAL, ...load(owner).folders];
export const getNote = (owner, id) => load(owner).items.find((n) => n.id === id) || null;

// Question numbers only go up: deleting Q3 never gives its number to a later question.
export function createNote(owner, { question, code, stdin, folderId = 'general', starred = false }) {
  const d = load(owner);
  if (d.items.length >= MAX_NOTES) return null;
  const now = new Date().toISOString();
  const note = { id: randomUUID(), number: d.nextNumber, title: titleOf(question), question, code, stdin, folderId: folderOk(d, folderId) ? folderId : 'general', starred: Boolean(starred), createdAt: now, updatedAt: now };
  d.nextNumber += 1; d.items.push(note); save(owner, d);
  return note;
}
export function patchNote(owner, id, fields) {
  const d = load(owner);
  const i = d.items.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const next = { ...d.items[i], ...fields, updatedAt: new Date().toISOString() };
  if (typeof fields.question === 'string') next.title = titleOf(fields.question);
  d.items[i] = next; save(owner, d);
  return next;
}
// Moving to a folder or starring doesn't count as "editing" the note, so updatedAt stays as it was.
export function setMeta(owner, id, { folderId, starred }) {
  const d = load(owner);
  const i = d.items.findIndex((n) => n.id === id);
  if (i < 0) return { error: 'That question is no longer in your notebook.', status: 404 };
  if (folderId !== undefined) { if (!folderOk(d, folderId)) return { error: 'That folder no longer exists.', status: 404 }; d.items[i].folderId = folderId; }
  if (starred !== undefined) d.items[i].starred = Boolean(starred);
  save(owner, d);
  return { note: d.items[i] };
}
export function deleteNote(owner, id) {
  const d = load(owner);
  const items = d.items.filter((n) => n.id !== id);
  if (items.length === d.items.length) return false;
  d.items = items; save(owner, d);
  return true;
}

export function createFolder(owner, name) {
  const d = load(owner);
  const clean = cleanName(name);
  if (!clean) return { error: 'Give the folder a name (up to 40 characters).' };
  if (d.folders.length >= MAX_FOLDERS) return { error: `You can have up to ${MAX_FOLDERS} folders.` };
  if (same(clean, GENERAL.name) || d.folders.some((f) => same(f.name, clean))) return { error: 'A folder with that name already exists.' };
  const folder = { id: randomUUID(), name: clean };
  d.folders.push(folder); save(owner, d);
  return { folder };
}
export function renameFolder(owner, id, name) {
  if (id === 'general') return { error: "The General folder can't be renamed." };
  const d = load(owner);
  const f = d.folders.find((x) => x.id === id);
  if (!f) return { error: 'Folder not found.', status: 404 };
  const clean = cleanName(name);
  if (!clean) return { error: 'Give the folder a name (up to 40 characters).' };
  if (same(clean, GENERAL.name) || d.folders.some((x) => x.id !== id && same(x.name, clean))) return { error: 'A folder with that name already exists.' };
  f.name = clean; save(owner, d);
  return { folder: f };
}
// Deleting a folder never deletes questions: they move to General.
export function deleteFolder(owner, id) {
  if (id === 'general') return { error: "The General folder can't be deleted." };
  const d = load(owner);
  if (!d.folders.some((f) => f.id === id)) return { error: 'Folder not found.', status: 404 };
  d.folders = d.folders.filter((f) => f.id !== id);
  let moved = 0;
  d.items = d.items.map((n) => (n.folderId === id ? (moved++, { ...n, folderId: 'general' }) : n));
  save(owner, d);
  return { ok: true, moved };
}

export function cleanupOldNotebooks(days = 30) {
  const dir = path.join(DIR, 'notebooks');
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (Date.now() - fs.statSync(p).mtimeMs > days * 86400000) fs.rmSync(p, { force: true });
    }
  } catch { /* none yet */ }
}
