#!/usr/bin/env node
// ByteRush launcher: the only thing the "Start ByteRush" files run.
// Checks Java, sets things up on the first run, starts ByteRush, and opens your browser.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const say = (m = '') => console.log(m);

// ---------- helpers (exported so they can be tested) ----------
export function hashFiles(root, entries) {
  const h = crypto.createHash('sha256');
  const walk = (p) => {
    const full = path.join(root, p);
    if (!fs.existsSync(full)) return;
    if (fs.statSync(full).isDirectory()) { for (const f of fs.readdirSync(full).sort()) walk(path.join(p, f)); return; }
    h.update(p.replace(/\\/g, '/')); h.update(fs.readFileSync(full));
  };
  entries.forEach(walk);
  return h.digest('hex');
}

const hasFiles = (dir) => { try { return fs.readdirSync(dir).length > 0; } catch { return false; } };
// Copies data from an older ByteRush/AlgoCoach folder the first time, so nothing is lost when moving to the new download.
export function migrateData(dataDir, candidates) {
  if (hasFiles(dataDir)) return null;
  for (const c of candidates) {
    if (hasFiles(c)) { fs.mkdirSync(dataDir, { recursive: true }); fs.cpSync(c, dataDir, { recursive: true }); return c; }
  }
  return null;
}

export function findFreePort(start = 3001, end = 3020) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      if (p > end) return resolve(0);
      const s = net.createServer();
      s.once('error', () => tryPort(p + 1));
      s.once('listening', () => s.close(() => resolve(p)));
      s.listen(p, '127.0.0.1');
    };
    tryPort(start);
  });
}

export function healthCheck(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
      let b = ''; res.on('data', (d) => (b += d));
      res.on('end', () => { try { const j = JSON.parse(b); resolve(j.ok ? j : null); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
export async function findRunning(start = 3001, end = 3020) {
  for (let p = start; p <= end; p++) { const h = await healthCheck(p); if (h && h.app === 'ByteRush') return p; }
  return 0;
}
export async function waitForServer(port, ms = 30000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (await healthCheck(port)) return true; await new Promise((r) => setTimeout(r, 400)); }
  return false;
}

export function openBrowser(url) {
  if (process.env.BYTERUSH_NO_BROWSER) return;
  try {
    const [cmd, args] = IS_MAC ? ['open', [url]] : IS_WIN ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch { /* the address is printed anyway */ }
}

// Is the internet reachable? (Any answer from npm's server counts.) Checked up front so offline users get a clear message
// instead of waiting minutes for npm to give up.
export function isOnline(ms = 6000) {
  return new Promise((resolve) => {
    const req = https.get('https://registry.npmjs.org/', { timeout: ms }, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
const NPM_FLAGS = ['--no-audit', '--no-fund', '--fetch-retries=2', '--fetch-retry-mintimeout=2000', '--fetch-retry-maxtimeout=10000', '--fetch-timeout=60000'];

const has = (cmd) => spawnSync(IS_WIN ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: IS_WIN }).status;
export function javaState() {
  if (IS_MAC) { // avoid /usr/bin/java, which pops up an "install Java" dialog when no JDK exists
    const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' });
    const home = r.status === 0 ? r.stdout.trim() : '';
    return home && fs.existsSync(path.join(home, 'bin', 'javac')) ? { ok: true, home } : { ok: false };
  }
  return { ok: spawnSync('javac', ['-version'], { stdio: 'ignore', shell: IS_WIN }).status === 0 };
}

// ---------- interactive bits ----------
const ask = (q) => new Promise((resolve) => {
  if (!process.stdin.isTTY) return resolve('');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
});
const confirm = async (q) => { const a = await ask(`${q} [Y/n] `); return a === '' || /^y/i.test(a); };
const pause = () => ask('\nPress Enter to close this window. ');
async function fatal(msg) { say(`\n✗ ${msg}`); await pause(); process.exit(1); }

async function ensureJava() {
  let st = javaState();
  if (st.ok) return st;
  say('\n☕ Running Java programs needs the free Java Development Kit (JDK).');
  say('   Everything else in ByteRush (notebook, HTML & CSS, progress) works without it.');
  if (IS_MAC && has('brew')) {
    if (await confirm('Install it now with Homebrew? It takes a few minutes.')) { run('brew', ['install', '--cask', 'temurin@21']); st = javaState(); }
  } else if (IS_WIN && has('winget')) {
    if (await confirm('Install it now with Windows Package Manager?')) {
      run('winget', ['install', '-e', '--id', 'EclipseAdoptium.Temurin.21.JDK', '--accept-package-agreements', '--accept-source-agreements']);
      say('\nDone. Please close this window and double-click "Start ByteRush" again so Windows notices the new Java.');
      await pause(); process.exit(0);
    }
  } else {
    say('   Download it free: https://adoptium.net  (pick the latest LTS), install it, then start ByteRush again.');
    if (await confirm('Open the download page now?')) openBrowser('https://adoptium.net/temurin/releases/');
  }
  if (!st.ok) say('\n   Continuing without Java. You can install it later and just restart ByteRush.');
  return st;
}

// ---------- optional tools for C, C++ and Python ----------
const probeOk = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore', timeout: 8000, shell: IS_WIN }).status === 0;
const whichPath = (cmd) => String(spawnSync('which', [cmd], { encoding: 'utf8' }).stdout || '').trim();
export function toolStatus() {
  if (IS_MAC) { // /usr/bin/gcc and /usr/bin/python3 are only stubs until Apple's Command Line Tools are installed
    const clt = spawnSync('xcode-select', ['-p'], { stdio: 'ignore' }).status === 0;
    const real = (c) => { const p = whichPath(c); return Boolean(p) && !p.startsWith('/usr/bin/'); };
    return { cc: clt || (real('gcc') && real('g++')), python: clt || real('python3') };
  }
  return { cc: probeOk('gcc') && probeOk('g++'), python: probeOk(IS_WIN ? 'python' : 'python3') };
}
const readState = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };

async function ensureOptionalTools(dataDir) {
  const file = path.join(dataDir, 'launcher.json');
  const state = readState(file);
  const st = toolStatus();
  const missing = [!st.cc && 'cc', !st.python && 'python'].filter(Boolean).filter((k) => !(state.declined && state.declined[k]));
  if (!missing.length || !process.stdin.isTTY) return;
  const names = { cc: 'C and C++', python: 'Python' };
  say(`\n🧰 Optional: ${missing.map((k) => names[k]).join(' and ')} ${missing.length > 1 ? 'need' : 'needs'} free tools that this computer doesn't have yet.`);
  say('   Everything else works without them. You can say no and ByteRush will not ask again.');
  const decline = () => { state.declined = { ...(state.declined || {}) }; missing.forEach((k) => { state.declined[k] = true; }); try { fs.writeFileSync(file, JSON.stringify(state)); } catch { /* not important */ } };
  if (IS_MAC) {
    if (await confirm("Install Apple's free Command Line Tools (gives C, C++ and Python)? A window will open.")) {
      run('xcode-select', ['--install']);
      say('\nFollow the installer window. When it has finished, close this window and double-click "Start ByteRush" again.');
      await pause(); process.exit(0);
    }
  } else if (IS_WIN && has('winget')) {
    let installed = false;
    for (const k of missing) {
      const id = k === 'python' ? 'Python.Python.3.12' : 'BrechtSanders.WinLibs.POSIX.UCRT';
      if (await confirm(`Install ${names[k]} now with Windows Package Manager?`)) { run('winget', ['install', '-e', '--id', id, '--accept-package-agreements', '--accept-source-agreements']); installed = true; }
    }
    if (installed) { say('\nDone. Please close this window and double-click "Start ByteRush" again so Windows notices the new tools.'); await pause(); process.exit(0); }
  } else if (IS_WIN) {
    say('   Python: https://www.python.org/downloads    C/C++: https://winlibs.com  (then start ByteRush again)');
  } else {
    say('   On Ubuntu/Debian: sudo apt install build-essential python3');
    return;
  }
  decline();
}

const STAMP_FILES = ['frontend/package.json', 'frontend/index.html', 'frontend/vite.config.ts', 'frontend/tsconfig.json', 'frontend/src', 'frontend/public'];
async function ensureSetup() {
  const backend = path.join(ROOT, 'backend');
  const frontend = path.join(ROOT, 'frontend');
  const stampFile = path.join(frontend, 'dist', '.stamp');
  const stamp = hashFiles(ROOT, STAMP_FILES);
  const built = fs.existsSync(path.join(frontend, 'dist', 'index.html')) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp;
  const depsOk = fs.existsSync(path.join(backend, 'node_modules', 'express'));
  if (built && depsOk) return;

  say('\n⚙️  First start: getting ByteRush ready (about 2-3 minutes, needs internet). Next time it opens in seconds.');
  const offline = 'Could not download ByteRush\'s components. Please check your internet connection, then double-click "Start ByteRush" again.';
  if (!(await isOnline())) await fatal(offline);
  if (!depsOk) { say('\n▸ Installing the server…'); if (run('npm', ['install', '--omit=dev', ...NPM_FLAGS], backend) !== 0) await fatal(offline); }
  if (!built) {
    if (!fs.existsSync(path.join(frontend, 'node_modules', 'vite'))) { say('\n▸ Installing the website tools…'); if (run('npm', ['install', ...NPM_FLAGS], frontend) !== 0) await fatal(offline); }
    say('\n▸ Building the website…');
    if (run('npm', ['run', 'build'], frontend) !== 0) await fatal('Building the website failed. Please send the messages above to the person who gave you ByteRush.');
    fs.writeFileSync(stampFile, stamp);
  }
}

async function main() {
  say('\n  ⚡ ByteRush');
  say('  Learn. Code. Debug. Level Up.\n');
  if (Number(process.versions.node.split('.')[0]) < 18) await fatal(`ByteRush needs Node.js 18 or newer (you have ${process.versions.node}). Install the LTS version from https://nodejs.org and try again.`);

  const dataDir = process.env.BYTERUSH_DATA || path.join(os.homedir(), 'ByteRush-Data');
  const from = migrateData(dataDir, [path.join(ROOT, '..', 'algocoach', 'backend', 'data'), path.join(os.homedir(), 'algocoach', 'backend', 'data'), path.join(ROOT, 'backend', 'data')]);
  if (from) say(`📦 Copied your saved questions, notebook and settings from ${from}`);
  fs.mkdirSync(dataDir, { recursive: true });

  const running = await findRunning();
  if (running) { const url = `http://localhost:${running}`; say(`ByteRush is already running: ${url}`); openBrowser(url); return; }

  const java = await ensureJava();
  await ensureOptionalTools(dataDir);
  if (!process.env.BYTERUSH_SKIP_SETUP) await ensureSetup();

  const port = Number(process.env.BYTERUSH_PORT) || await findFreePort();
  if (!port) await fatal('No free port found between 3001 and 3020. Close other programs and try again.');
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', RUNNER: process.env.RUNNER || 'local', BYTERUSH_DATA: dataDir, BYTERUSH_DESKTOP: '1' };
  if (java.home) { env.JAVA_HOME = java.home; env.PATH = `${path.join(java.home, 'bin')}${path.delimiter}${env.PATH || ''}`; }

  const entry = process.env.BYTERUSH_SERVER || path.join(ROOT, 'backend', 'server.js');
  say('\n▸ Starting ByteRush…');
  const child = spawn(process.execPath, [entry], { cwd: path.dirname(entry), env, stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  const forward = (d) => { const t = d.toString(); tail = (tail + t).slice(-1500); process.stdout.write(t.split('\n').filter(Boolean).map((l) => `  │ ${l}`).join('\n') + '\n'); };
  child.stdout.on('data', forward); child.stderr.on('data', forward);

  let stopping = false;
  const stop = () => { stopping = true; try { child.kill(); } catch { /* already gone */ } };
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
  process.on('exit', stop);
  child.on('exit', async (code) => { if (!stopping) { say(`\n✗ ByteRush stopped unexpectedly (code ${code}).\n${tail}`); await pause(); process.exit(1); } });

  if (!(await waitForServer(port))) { stop(); await fatal(`ByteRush did not start.\n${tail}`); }
  const url = `http://localhost:${port}`;
  say(`\n  ✅ ByteRush is running: ${url}`);
  say('  Your browser should open by itself. Keep this window open while you use ByteRush; close it to stop.');
  say(`  Your data is saved in: ${dataDir}\n`);
  openBrowser(url);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(async (e) => fatal(`Unexpected problem: ${e.message}`));
