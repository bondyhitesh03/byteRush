// Local settings store (API key + model). Lives only on this computer in backend/data/ (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = path.join(DIR, 'settings.json');

export function getSettings() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function save(s) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s), { mode: 0o600 });
}
export const setApiKey = (key) => save({ ...getSettings(), apiKey: key });
export function clearApiKey() { const s = getSettings(); delete s.apiKey; save(s); }
export function setModel(model) { const s = getSettings(); if (model) s.model = model; else delete s.model; save(s); }
