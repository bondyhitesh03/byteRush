// "Notes": a title, some text (Markdown), a code template, tags, a pin and an optional link to a question per note.
// Same storage as the notebook (one document per owner and language).
import { randomUUID } from 'node:crypto';
import { readDoc, writeDoc } from './storage.js';

const KIND = 'notes';
export const MAX_NOTES = 300;
export const LIMITS = { title: 120, body: 20000, code: 20000, stdin: 5000 };
export const MAX_TAGS = 8;
export const MAX_TAG_LEN = 24;
export const LINK_KINDS = ['question', 'notebook']; // what a note can be linked to: a Questions entry or a Notebook page

// A tag is lower case, without "#", one line, at most MAX_TAG_LEN characters.
export const cleanTag = (t) => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/^[#\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_TAG_LEN).trim();
export function cleanTags(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) { const c = cleanTag(t); if (c && !out.includes(c)) out.push(c); if (out.length >= MAX_TAGS) break; }
  return out;
}
const cleanLink = (l) => {
  if (!l || typeof l !== 'object') return null;
  const kind = LINK_KINDS.includes(l.kind) ? l.kind : '';
  const id = typeof l.id === 'string' && /^[\w-]{1,100}$/.test(l.id) ? l.id : '';
  if (!kind || !id) return null;
  return { kind, id, title: (typeof l.title === 'string' ? l.title : '').replace(/\s+/g, ' ').trim().slice(0, 120) };
};
const sameLink = (a, b) => (a?.kind ?? '') === (b?.kind ?? '') && (a?.id ?? '') === (b?.id ?? '');
const sameTags = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);

// Older notes have no tags, pin or link yet.
const normalize = (n) => ({ ...n, tags: cleanTags(n.tags), pinned: n.pinned === true, link: cleanLink(n.link) });
const load = async (scope) => { const d = await readDoc(scope, KIND, null); return Array.isArray(d?.items) ? d.items.map(normalize) : []; };
const save = (scope, items) => writeDoc(scope, KIND, { items: [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }); // newest first

// Pinned notes first; inside each group the newest first (the sort is stable).
export const listNotes = async (scope) => (await load(scope)).sort((a, b) => Number(b.pinned) - Number(a.pinned));
export const getNote = async (scope, id) => (await load(scope)).find((n) => n.id === id) || null;
export const findByLink = async (scope, kind, id) => (await listNotes(scope)).filter((n) => n.link && n.link.kind === kind && n.link.id === id);

// Returns { fields } or { error, status }. tags / pinned / link are only present when the request sent them,
// so an older page that does not know about them can never wipe them.
export function cleanFields(f) {
  const text = (v) => (typeof v === 'string' ? v : '');
  const out = { title: text(f?.title).replace(/\s+/g, ' ').trim() || 'Untitled note', body: text(f?.body), code: text(f?.code), stdin: text(f?.stdin) };
  for (const k of Object.keys(LIMITS)) if (out[k].length > LIMITS[k]) return { error: `The ${k === 'stdin' ? 'input' : k} is too long (${LIMITS[k].toLocaleString('en-US')} characters max).`, status: 413 };
  if (f && 'tags' in f) {
    if (!Array.isArray(f.tags)) return { error: 'Tags must be a list.', status: 400 };
    out.tags = cleanTags(f.tags);
  }
  if (f && 'pinned' in f) out.pinned = f.pinned === true;
  if (f && 'link' in f) {
    if (f.link !== null && !cleanLink(f.link)) return { error: 'That link is not valid.', status: 400 };
    out.link = cleanLink(f.link);
  }
  return { fields: out };
}

export async function createNote(scope, f) {
  const c = cleanFields(f); if (c.error) return c;
  const items = await load(scope);
  if (items.length >= MAX_NOTES) return { error: `You can keep up to ${MAX_NOTES} notes. Delete some to add more.`, status: 409 };
  const now = new Date().toISOString();
  const note = { id: randomUUID(), tags: [], pinned: false, link: null, ...c.fields, createdAt: now, updatedAt: now };
  await save(scope, [note, ...items]);
  return { note };
}
export async function updateNote(scope, id, f) {
  const c = cleanFields(f); if (c.error) return c;
  const items = await load(scope);
  const i = items.findIndex((n) => n.id === id);
  if (i < 0) return { error: 'That note no longer exists.', status: 404 };
  const old = items[i];
  const note = { ...old, ...c.fields };
  // Pinning or unpinning is not an edit: it must not change "edited" time or the order inside the group.
  const edited = ['title', 'body', 'code', 'stdin'].some((k) => note[k] !== old[k]) || !sameTags(note.tags, old.tags) || !sameLink(note.link, old.link);
  note.updatedAt = edited ? new Date().toISOString() : old.updatedAt;
  items[i] = note; await save(scope, items);
  return { note };
}
export async function deleteNote(scope, id) {
  const items = await load(scope);
  const next = items.filter((n) => n.id !== id);
  if (next.length === items.length) return false;
  await save(scope, next); return true;
}
