// Notebook: the learner's own questions + code, organised in folders, with ⭐ important marks.
// Storage is handled by services/storage.js (one document per owner).
import { randomUUID } from 'node:crypto';
import { readDoc, writeDoc } from './storage.js';

const KIND = 'notebook';
const MAX_NOTES = 200;
const MAX_FOLDERS = 30;
export const GENERAL = { id: 'general', name: 'General', builtin: true }; // always exists, can't be renamed or deleted
const titleOf = (q) => q.replace(/\s+/g, ' ').trim().slice(0, 70);
const cleanName = (n) => String(n ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

async function load(owner) {
  const d = (await readDoc(owner, KIND, null)) ?? {};
  const folders = (Array.isArray(d.folders) ? d.folders : []).filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string' && f.id !== 'general');
  const ids = new Set(['general', ...folders.map((f) => f.id)]);
  // Older notebooks have no folders/stars yet: everything lands in General, unstarred.
  const items = (Array.isArray(d.items) ? d.items : []).map((n) => ({ ...n, folderId: ids.has(n.folderId) ? n.folderId : 'general', starred: Boolean(n.starred) }));
  return { nextNumber: Number(d.nextNumber) || 1, items, folders };
}
const save = (owner, data) => writeDoc(owner, KIND, data);
const folderOk = (d, id) => id === 'general' || d.folders.some((f) => f.id === id);

export const listNotes = async (owner) => (await load(owner)).items;
export const listFolders = async (owner) => [GENERAL, ...(await load(owner)).folders];
export const getNote = async (owner, id) => (await load(owner)).items.find((n) => n.id === id) || null;

// Question numbers only go up: deleting Q3 never gives its number to a later question.
export async function createNote(owner, { question, code, stdin, folderId = 'general', starred = false }) {
  const d = await load(owner);
  if (d.items.length >= MAX_NOTES) return null;
  const now = new Date().toISOString();
  const note = { id: randomUUID(), number: d.nextNumber, title: titleOf(question), question, code, stdin, folderId: folderOk(d, folderId) ? folderId : 'general', starred: Boolean(starred), createdAt: now, updatedAt: now };
  d.nextNumber += 1; d.items.push(note); await save(owner, d);
  return note;
}
export async function patchNote(owner, id, fields) {
  const d = await load(owner);
  const i = d.items.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const next = { ...d.items[i], ...fields, updatedAt: new Date().toISOString() };
  if (typeof fields.question === 'string') next.title = titleOf(fields.question);
  d.items[i] = next; await save(owner, d);
  return next;
}
// Moving to a folder or starring doesn't count as "editing" the note, so updatedAt stays as it was.
export async function setMeta(owner, id, { folderId, starred }) {
  const d = await load(owner);
  const i = d.items.findIndex((n) => n.id === id);
  if (i < 0) return { error: 'That question is no longer in your notebook.', status: 404 };
  if (folderId !== undefined) { if (!folderOk(d, folderId)) return { error: 'That folder no longer exists.', status: 404 }; d.items[i].folderId = folderId; }
  if (starred !== undefined) d.items[i].starred = Boolean(starred);
  await save(owner, d);
  return { note: d.items[i] };
}
export async function deleteNote(owner, id) {
  const d = await load(owner);
  const items = d.items.filter((n) => n.id !== id);
  if (items.length === d.items.length) return false;
  d.items = items; await save(owner, d);
  return true;
}

export async function createFolder(owner, name) {
  const d = await load(owner);
  const clean = cleanName(name);
  if (!clean) return { error: 'Give the folder a name (up to 40 characters).' };
  if (d.folders.length >= MAX_FOLDERS) return { error: `You can have up to ${MAX_FOLDERS} folders.` };
  if (same(clean, GENERAL.name) || d.folders.some((f) => same(f.name, clean))) return { error: 'A folder with that name already exists.' };
  const folder = { id: randomUUID(), name: clean };
  d.folders.push(folder); await save(owner, d);
  return { folder };
}
export async function renameFolder(owner, id, name) {
  if (id === 'general') return { error: "The General folder can't be renamed." };
  const d = await load(owner);
  const f = d.folders.find((x) => x.id === id);
  if (!f) return { error: 'Folder not found.', status: 404 };
  const clean = cleanName(name);
  if (!clean) return { error: 'Give the folder a name (up to 40 characters).' };
  if (same(clean, GENERAL.name) || d.folders.some((x) => x.id !== id && same(x.name, clean))) return { error: 'A folder with that name already exists.' };
  f.name = clean; await save(owner, d);
  return { folder: f };
}
// Deleting a folder never deletes questions: they move to General.
export async function deleteFolder(owner, id) {
  if (id === 'general') return { error: "The General folder can't be deleted." };
  const d = await load(owner);
  if (!d.folders.some((f) => f.id === id)) return { error: 'Folder not found.', status: 404 };
  d.folders = d.folders.filter((f) => f.id !== id);
  let moved = 0;
  d.items = d.items.map((n) => (n.folderId === id ? (moved++, { ...n, folderId: 'general' }) : n));
  await save(owner, d);
  return { ok: true, moved };
}
