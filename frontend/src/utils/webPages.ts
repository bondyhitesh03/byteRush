// Saved HTML & CSS pages live in this browser (localStorage), so they are private to each visitor and need no server.
export interface SavedPage { id: string; name: string; html: string; css: string; js: string; createdAt: string; updatedAt: string }
export const MAX_PAGES = 50;
const KEY = 'algocoach-web-pages';
const CURRENT = 'algocoach-web-current';

const isPage = (p: unknown): p is SavedPage => { // js is optional here (older saves)
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return ['id', 'name', 'html', 'css', 'createdAt', 'updatedAt'].every((k) => typeof o[k] === 'string');
};
export function parsePages(raw: string | null): SavedPage[] {
  try {
    const d: unknown = JSON.parse(raw ?? '[]');
    // Pages saved before JavaScript existed have no "js" yet: they get an empty one.
    return Array.isArray(d) ? d.filter(isPage).slice(0, MAX_PAGES).map((p) => ({ ...p, js: typeof (p as { js?: unknown }).js === 'string' ? p.js : '' })) : [];
  } catch { return []; }
}
export function loadPages(): SavedPage[] {
  try { return parsePages(localStorage.getItem(KEY)); } catch { return []; }
}
export function savePages(pages: SavedPage[]): { ok: true } | { ok: false; message: string } {
  try { localStorage.setItem(KEY, JSON.stringify(pages)); return { ok: true }; }
  catch { return { ok: false, message: "Couldn't save: your browser's storage is full or blocked. Delete a page, or download your files instead." }; }
}
export const loadCurrentId = (): string => { try { return localStorage.getItem(CURRENT) ?? ''; } catch { return ''; } };
export const saveCurrentId = (id: string): void => { try { if (id) localStorage.setItem(CURRENT, id); else localStorage.removeItem(CURRENT); } catch { /* storage unavailable */ } };
export const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
export const byRecent = (pages: SavedPage[]): SavedPage[] => [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
