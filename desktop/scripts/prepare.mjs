// Copies the server (backend + built website) into desktop/server so electron-builder can bundle it.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(DESKTOP, '..');
const OUT = path.join(DESKTOP, 'server');
const dist = path.join(ROOT, 'frontend', 'dist', 'index.html');
if (!fs.existsSync(dist)) { console.error('Build the website first: cd frontend && npm install && npm run build'); process.exit(1); }

fs.rmSync(OUT, { recursive: true, force: true });
const skip = new Set(['node_modules', 'data', '.env', '.DS_Store']);
fs.cpSync(path.join(ROOT, 'backend'), path.join(OUT, 'backend'), { recursive: true, filter: (src) => !skip.has(path.basename(src)) });
fs.cpSync(path.join(ROOT, 'frontend', 'dist'), path.join(OUT, 'frontend', 'dist'), { recursive: true });
execSync('npm install --omit=dev --no-audit --no-fund', { cwd: path.join(OUT, 'backend'), stdio: 'inherit' });
if (!fs.existsSync(path.join(DESKTOP, 'jdk', 'bin'))) {
  console.warn('\n⚠️  desktop/jdk is missing: the app will use the Java installed on the computer (if any).');
  fs.mkdirSync(path.join(DESKTOP, 'jdk'), { recursive: true });
}
console.log('✓ Server prepared in desktop/server');
