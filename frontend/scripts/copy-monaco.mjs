// Copies the Monaco code editor into the built website (dist/monaco/vs), so the editor loads from ByteRush itself
// instead of the internet. This is what makes the editor work in the offline desktop app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(ROOT, 'node_modules', 'monaco-editor', 'min', 'vs');
if (!fs.existsSync(path.join(src, 'loader.js'))) { console.error(`Monaco editor not found at ${src}. Run npm install first.`); process.exit(1); }
const out = path.join(ROOT, 'dist', 'monaco', 'vs');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
console.log('✓ Monaco editor copied to dist/monaco/vs');
