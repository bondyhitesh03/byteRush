// Runs C, C++ and Python programs. Same two modes as Java: RUNNER=docker (throw-away container per run) or RUNNER=local
// (child processes with the same hardening as local.js).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { localExec } from './local.js';

const RUN_TIMEOUT = () => Number(process.env.RUN_TIMEOUT_MS || 5000);
const COMPILE_TIMEOUT = () => Number(process.env.COMPILE_TIMEOUT_MS || 15000);
const MAX_OUT = 64 * 1024;
const IS_WIN = process.platform === 'win32';
const PY = IS_WIN ? 'python' : 'python3';

// JavaScript programs read input through input()/inputAll(), same as in the browser playground. The prelude sits on the SAME line as the
// first line of the learner's code, so error line numbers still match the editor.
const JS_PRELUDE = "const __in=(()=>{const fs=require('fs');const chunks=[];const buf=Buffer.alloc(65536);for(;;){let n;try{n=fs.readSync(0,buf,0,buf.length,null);}catch(e){if(e.code==='EAGAIN'){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);continue;}if(e.code==='EOF')break;throw e;}if(!n)break;chunks.push(Buffer.from(buf.subarray(0,n)));}return Buffer.concat(chunks).toString('utf8');})();const __ls=__in.split(/\\r?\\n/);if(__ls.length&&__ls[__ls.length-1]==='')__ls.pop();let __n=0;const input=()=>(__n<__ls.length?__ls[__n++]:null);const inputAll=()=>__in;(async()=>{";
const wrapJs = (src) => `${JS_PRELUDE}${src}\n})().catch((e)=>{console.error(e&&e.stack?e.stack:String(e));process.exitCode=1;});\n`;
const BIN = IS_WIN ? ['main.exe'] : ['./main'];

export const LANGUAGES = {
  c: { name: 'C', file: 'main.c', tool: 'gcc', compile: ['gcc', '-O1', '-std=gnu17', '-o', 'main', 'main.c', '-lm'], localRun: BIN, dockerRun: ['./main'], image: process.env.C_IMAGE || 'gcc:13', limitMemory: true },
  cpp: { name: 'C++', file: 'main.cpp', tool: 'g++', compile: ['g++', '-O1', '-std=gnu++17', '-o', 'main', 'main.cpp'], localRun: BIN, dockerRun: ['./main'], image: process.env.C_IMAGE || 'gcc:13', limitMemory: true },
  python: { name: 'Python', file: 'main.py', tool: PY, compile: null, localRun: [PY, '-u', 'main.py'], dockerRun: ['python3', '-u', 'main.py'], image: process.env.PY_IMAGE || 'python:3.12-slim', limitMemory: true },
  js: { name: 'JavaScript', file: 'main.js', tool: null, compile: null, localRun: [process.execPath, '--max-old-space-size=128', 'main.js'], dockerRun: ['node', '--max-old-space-size=128', 'main.js'], image: process.env.NODE_IMAGE || 'node:20-alpine', limitMemory: false, wrap: wrapJs },
};

// ---------- is the tool installed? ----------
const HOW = {
  c: { darwin: 'Install Apple\'s free Command Line Tools: open Terminal and run  xcode-select --install', win32: 'Install a C compiler, for example: winget install BrechtSanders.WinLibs.POSIX.UCRT', linux: 'Install one with: sudo apt install build-essential' },
  python: { darwin: 'Install Python from https://www.python.org/downloads (or Apple\'s Command Line Tools: xcode-select --install)', win32: 'Install Python from https://www.python.org/downloads (or: winget install Python.Python.3.12)', linux: 'Install it with: sudo apt install python3' },
};
const have = {};
function hasTool(lang) {
  if (have[lang] !== undefined) return have[lang];
  const tool = LANGUAGES[lang].tool;
  if (!tool) return (have[lang] = true); // JavaScript runs on the same Node that runs ByteRush
  let ok = false;
  try {
    // On a Mac without developer tools, /usr/bin/gcc, g++ and python3 are stubs that pop up an installer: check first.
    if (process.platform === 'darwin' && spawnSync('xcode-select', ['-p'], { stdio: 'ignore' }).status !== 0) {
      const found = spawnSync('which', [tool], { encoding: 'utf8' }).stdout.trim();
      ok = Boolean(found) && !found.startsWith('/usr/bin/');
    } else ok = spawnSync(tool, ['--version'], { stdio: 'ignore', timeout: 8000, shell: IS_WIN }).status === 0;
  } catch { ok = false; }
  return (have[lang] = ok);
}
const unavailable = (lang) => ({
  status: 'unavailable',
  message: process.env.BYTERUSH_DESKTOP
    ? `${LANGUAGES[lang].name} isn't installed on this computer yet. ${HOW[lang === 'python' ? 'python' : 'c'][process.platform] ?? HOW[lang === 'python' ? 'python' : 'c'].linux}. Then restart ByteRush.`
    : `${LANGUAGES[lang].name} could not be started on this server.`,
});

// ---------- turning raw output into a result ----------
const SIGNALS = { SIGSEGV: 'segmentation fault (the program touched memory it should not)', SIGFPE: 'arithmetic error (for example dividing by zero)', SIGABRT: 'the program aborted', SIGKILL: 'the program was stopped (probably out of memory)', SIGBUS: 'bus error (bad memory access)' };
const DOCKER_CODES = { 139: 'SIGSEGV', 136: 'SIGFPE', 134: 'SIGABRT', 137: 'SIGKILL', 135: 'SIGBUS' };

function parseErrors(lang, text) {
  const out = [];
  if (lang === 'python') {
    const m = /File "(?:[^"]*[\/\\])?main\.py", line (\d+)/.exec(text);
    const last = text.trim().split('\n').pop() ?? '';
    if (m) out.push({ line: Number(m[1]), message: last.trim() });
    return out;
  }
  if (lang === 'js') {
    const m = /main\.js:(\d+)/.exec(text);
    const msg = (/^\s*(SyntaxError.*)$/m.exec(text) || [])[1];
    if (m && msg) out.push({ line: Number(m[1]), message: msg.trim() });
    return out;
  }
  const re = /main\.(?:c|cpp):(\d+):(?:\d+:)?\s*(?:fatal )?error:\s*(.*)/g;
  let m;
  while ((m = re.exec(text))) out.push({ line: Number(m[1]), message: m[2] });
  return out;
}
const compileResult = (lang, r) => ({ status: 'compile_error', stderr: r.stderr, errors: parseErrors(lang, r.stderr), timeMs: r.ms });

function classify(lang, r) {
  if (r.spawnError) return unavailable(lang);
  if (r.timedOut) return { status: 'timeout', phase: 'run', stdout: r.stdout, stderr: `Stopped after ${RUN_TIMEOUT() / 1000}s - possible infinite loop.`, timeMs: r.ms, truncated: r.truncated };
  const signal = r.signal || DOCKER_CODES[r.code];
  if (signal) return { status: 'runtime_error', stdout: r.stdout, stderr: `${r.stderr}${r.stderr && !r.stderr.endsWith('\n') ? '\n' : ''}Program crashed: ${SIGNALS[signal] ?? signal}.`, timeMs: r.ms, truncated: r.truncated };
  if (r.code !== 0) {
    // Python reports syntax mistakes when it starts the program: show those like compile errors.
    if ((lang === 'python' || lang === 'js') && /^\s*(SyntaxError|IndentationError|TabError)/m.test(r.stderr)) return compileResult(lang, r);
    return { status: 'runtime_error', stdout: r.stdout, stderr: r.stderr, timeMs: r.ms, truncated: r.truncated };
  }
  return { status: 'ok', stdout: r.stdout, stderr: r.stderr, timeMs: r.ms, truncated: r.truncated };
}

// ---------- local mode ----------
async function runLocal(lang, source, stdin) {
  const L = LANGUAGES[lang];
  if (!hasTool(lang)) return unavailable(lang);
  const dir = await mkdtemp(path.join(tmpdir(), 'byterush-'));
  try {
    await chmod(dir, 0o777); // the unprivileged runner user must be able to write the compiled program here
    await writeFile(path.join(dir, L.file), L.wrap ? L.wrap(source) : source, { mode: 0o644 });
    if (L.compile) {
      const c = await localExec(L.compile[0], L.compile.slice(1), { cwd: dir, timeoutMs: COMPILE_TIMEOUT(), limitMemory: true });
      if (c.spawnError) return unavailable(lang);
      if (c.timedOut) return { status: 'timeout', phase: 'compile', stdout: '', stderr: 'Compilation timed out.', timeMs: c.ms };
      if (c.code !== 0) return compileResult(lang, c);
    }
    return classify(lang, await localExec(L.localRun[0], L.localRun.slice(1), { cwd: dir, timeoutMs: RUN_TIMEOUT(), stdin, limitMemory: L.limitMemory }));
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// ---------- docker mode ----------
const LIMITS = ['--network', 'none', '--memory', '256m', '--memory-swap', '256m', '--cpus', '1', '--pids-limit', '64', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '65534:65534'];
function dockerExec(image, mount, cmd, timeoutMs, stdin) {
  const name = `byterush-${randomUUID()}`;
  const args = ['run', '--rm', '--name', name, ...(stdin !== undefined ? ['-i'] : []), ...LIMITS, '--read-only', '--tmpfs', '/tmp:rw,size=32m', '-v', mount, '-w', '/work', image, ...cmd];
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn('docker', args);
    if (stdin !== undefined) { p.stdin.on('error', () => {}); p.stdin.end(stdin); }
    let stdout = '', stderr = '', timedOut = false, truncated = false;
    const add = (cur, d) => { if (cur.length >= MAX_OUT) { truncated = true; return cur; } return cur + d.toString('utf8'); };
    p.stdout.on('data', (d) => (stdout = add(stdout, d)));
    p.stderr.on('data', (d) => (stderr = add(stderr, d)));
    const timer = setTimeout(() => { timedOut = true; spawn('docker', ['kill', name]).on('error', () => {}); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ spawnError: e.message, stdout, stderr }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut, truncated, ms: Date.now() - started }); });
  });
}
async function runDocker(lang, source, stdin) {
  const L = LANGUAGES[lang];
  const dir = await mkdtemp(path.join(tmpdir(), 'byterush-'));
  try {
    await chmod(dir, 0o777);
    await writeFile(path.join(dir, L.file), L.wrap ? L.wrap(source) : source, { mode: 0o644 });
    // Docker itself failing (not installed, daemon off, image can't be downloaded) is different from the program failing.
    const down = (r) => r.spawnError || (/(docker: |Cannot connect to the Docker daemon|Unable to find image)/i.test(r.stderr) && !/main\.(c|cpp):\d+/.test(r.stderr));
    if (L.compile) {
      const c = await dockerExec(L.image, `${dir}:/work`, L.compile, COMPILE_TIMEOUT());
      if (down(c)) return { status: 'unavailable', message: `Docker is not available: ${(c.spawnError || c.stderr).slice(0, 300)}` };
      if (c.timedOut) return { status: 'timeout', phase: 'compile', stdout: '', stderr: 'Compilation timed out.', timeMs: c.ms };
      if (c.code !== 0) return compileResult(lang, c);
    }
    const r = await dockerExec(L.image, `${dir}:/work:ro`, L.dockerRun, RUN_TIMEOUT(), stdin);
    if (down(r)) return { status: 'unavailable', message: `Docker is not available: ${(r.spawnError || r.stderr).slice(0, 300)}` };
    return classify(lang, r);
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

export const isOtherLanguage = (lang) => Object.prototype.hasOwnProperty.call(LANGUAGES, lang);
export function runOther(lang, source, stdin = '') {
  return (process.env.RUNNER || 'docker') === 'local' ? runLocal(lang, source, stdin) : runDocker(lang, source, stdin);
}

// ---------- many inputs, one program (grading and test verification) ----------
const asCase = (r) => ({ status: r.timedOut ? 'timeout' : r.code === 0 && !r.signal ? 'ok' : 'runtime_error', stdout: r.stdout ?? '', stderr: r.stderr ?? '', timeMs: r.ms });
const compileFail = (lang, r) => ({ status: 'compile_error', stderr: r.stderr, errors: parseErrors(lang, r.stderr) });

async function casesLocal(lang, source, inputs) {
  const L = LANGUAGES[lang];
  if (!hasTool(lang)) return { status: 'unavailable' };
  const dir = await mkdtemp(path.join(tmpdir(), 'byterush-'));
  try {
    await chmod(dir, 0o777);
    await writeFile(path.join(dir, L.file), L.wrap ? L.wrap(source) : source, { mode: 0o644 });
    if (L.compile) {
      const c = await localExec(L.compile[0], L.compile.slice(1), { cwd: dir, timeoutMs: COMPILE_TIMEOUT(), limitMemory: true });
      if (c.spawnError) return { status: 'unavailable' };
      if (c.timedOut) return { status: 'compile_error', stderr: 'Compilation timed out.', errors: [] };
      if (c.code !== 0) return compileFail(lang, c);
    }
    const results = [];
    for (const input of inputs) {
      const r = await localExec(L.localRun[0], L.localRun.slice(1), { cwd: dir, timeoutMs: RUN_TIMEOUT(), stdin: input, limitMemory: L.limitMemory });
      if (r.spawnError) return { status: 'unavailable' };
      if (!results.length && r.code !== 0 && (lang === 'python' || lang === 'js') && /^\s*(SyntaxError|IndentationError|TabError)/m.test(r.stderr)) return compileFail(lang, r);
      results.push(asCase(r));
    }
    return { status: 'ok', results };
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

async function casesDocker(lang, source, inputs) {
  const L = LANGUAGES[lang];
  const dir = await mkdtemp(path.join(tmpdir(), 'byterush-'));
  try {
    await chmod(dir, 0o777);
    await writeFile(path.join(dir, L.file), L.wrap ? L.wrap(source) : source, { mode: 0o644 });
    const down = (r) => r.spawnError || (/(docker: |Cannot connect to the Docker daemon|Unable to find image)/i.test(r.stderr) && !/main\.(c|cpp):\d+/.test(r.stderr));
    if (L.compile) {
      const c = await dockerExec(L.image, `${dir}:/work`, L.compile, COMPILE_TIMEOUT());
      if (down(c)) return { status: 'unavailable' };
      if (c.timedOut) return { status: 'compile_error', stderr: 'Compilation timed out.', errors: [] };
      if (c.code !== 0) return compileFail(lang, c);
    }
    const results = [];
    for (const input of inputs) {
      const r = await dockerExec(L.image, `${dir}:/work:ro`, L.dockerRun, RUN_TIMEOUT(), input);
      if (down(r)) return { status: 'unavailable' };
      if (!results.length && r.code !== 0 && (lang === 'python' || lang === 'js') && /^\s*(SyntaxError|IndentationError|TabError)/m.test(r.stderr)) return compileFail(lang, r);
      results.push(asCase(r));
    }
    return { status: 'ok', results };
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

export function runOtherCases(lang, source, inputs) {
  return (process.env.RUNNER || 'docker') === 'local' ? casesLocal(lang, source, inputs) : casesDocker(lang, source, inputs);
}
