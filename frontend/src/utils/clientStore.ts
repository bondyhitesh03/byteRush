// Per-browser storage: a random browser id (keeps each visitor's history separate) and, in public mode, the visitor's own AI key.
const ID = 'algocoach-client';
const KEY = 'algocoach-gemini-key';
const MODEL = 'algocoach-gemini-model';
export const KEY_RE = /^[^\s'"]{20,300}$/;
export const MODEL_RE = /^[\w.:/-]{2,100}$/;

const get = (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const set = (k: string, v: string): void => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* storage unavailable */ } };
const uuid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

export function clientId(): string {
  let id = get(ID);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { id = uuid(); set(ID, id); }
  return id;
}
export const getKey = (): string => get(KEY);
export const setKey = (v: string): void => set(KEY, v.trim());
export const clearKey = (): void => set(KEY, '');
export const getModel = (): string => get(MODEL);
export const setModel = (v: string): void => set(MODEL, v.trim());
