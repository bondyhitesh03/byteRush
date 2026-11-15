// Runs untrusted Java inside throw-away Docker containers.
// No network, 256MB RAM, 1 CPU, 64 pids, all caps dropped, non-root,
// read-only root FS, source mounted read-only at run time.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { localRunJava, localRunJavaCases } from './local.js';
import { isOtherLanguage, runOther, runOtherCases } from './polyglot.js';

const IMAGE = process.env.JAVA_IMAGE || 'eclipse-temurin:21-jdk';
const RUN_TIMEOUT = Number(process.env.RUN_TIMEOUT_MS || 5000);
const COMPILE_TIMEOUT = Number(process.env.COMPILE_TIMEOUT_MS || 15000);
const MAX_OUT = 64 * 1024;

const LIMITS = ['--network', 'none', '--memory', '256m', '--memory-swap', '256m',
  '--cpus', '1', '--pids-limit', '64', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges', '--user', '65534:65534'];

function dockerRun(mount, cmd, timeoutMs, stdin) {
  const name = `algocoach-${randomUUID()}`;
  const args = ['run', '--rm', '--name', name, ...(stdin !== undefined ? ['-i'] : []), ...LIMITS, '--read-only',
    '--tmpfs', '/tmp:rw,size=32m', '-v', mount, '-w', '/work', IMAGE, ...cmd];
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn('docker', args);
    if (stdin !== undefined) { p.stdin.on('error', () => {}); p.stdin.end(stdin); } // program input, then EOF
    let stdout = '', stderr = '', timedOut = false, truncated = false;
    const add = (cur, d) => {
      if (cur.length >= MAX_OUT) { truncated = true; return cur; }
      return cur + d.toString('utf8');
    };
    p.stdout.on('data', (d) => (stdout = add(stdout, d)));
    p.stderr.on('data', (d) => (stderr = add(stderr, d)));
    const timer = setTimeout(() => { timedOut = true; spawn('docker', ['kill', name]); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ spawnError: e.message, stdout, stderr }); });
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, truncated, ms: Date.now() - started });
    });
  });
}

function parseCompileErrors(text, file) {
  const out = [];
  const re = new RegExp(`${file}:(\\d+): error: (.*)`, 'g');
  let m;
  while ((m = re.exec(text))) out.push({ line: Number(m[1]), message: m[2] });
  return out;
}

async function dockerRunJava(source, stdin = '') {
  const cls = (/public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/.exec(source) || [])[1] || 'Main';
  const file = `${cls}.java`;
  const dir = await mkdtemp(path.join(tmpdir(), 'algocoach-'));
  try {
    await chmod(dir, 0o777); // container runs as nobody and must write .class files
    await writeFile(path.join(dir, file), source, { mode: 0o644 });

    const c = await dockerRun(`${dir}:/work`, ['javac', '-J-Xmx192m', file], COMPILE_TIMEOUT);
    if (c.spawnError) return { status: 'unavailable', message: `Docker not available: ${c.spawnError}` };
    if (c.timedOut) return { status: 'timeout', phase: 'compile', stdout: '', stderr: 'Compilation timed out.', timeMs: c.ms };
    if (c.code !== 0) {
      if (/Unable to find image|Cannot connect to the Docker/i.test(c.stderr) && !/error:/.test(c.stderr))
        return { status: 'unavailable', message: c.stderr.trim().slice(0, 500) };
      return { status: 'compile_error', stderr: c.stderr, errors: parseCompileErrors(c.stderr, file), timeMs: c.ms };
    }

    const r = await dockerRun(`${dir}:/work:ro`, ['java', '-Xmx128m', '-XX:-UsePerfData', '-cp', '/work', cls], RUN_TIMEOUT, stdin);
    if (r.timedOut) return { status: 'timeout', phase: 'run', stdout: r.stdout, stderr: `Stopped after ${RUN_TIMEOUT / 1000}s - possible infinite loop.`, timeMs: r.ms, truncated: r.truncated };
    if (r.code === 137) return { status: 'runtime_error', stdout: r.stdout, stderr: 'Process was killed (likely out of memory).', timeMs: r.ms };
    if (r.code !== 0) return { status: 'runtime_error', stdout: r.stdout, stderr: r.stderr, timeMs: r.ms, truncated: r.truncated };
    return { status: 'ok', stdout: r.stdout, stderr: r.stderr, timeMs: r.ms, truncated: r.truncated };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Compiles once, then runs the program once per input (used for grading and test verification).
async function dockerRunJavaCases(source, inputs) {
  const cls = (/public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/.exec(source) || [])[1] || 'Main';
  const file = `${cls}.java`;
  const dir = await mkdtemp(path.join(tmpdir(), 'algocoach-'));
  try {
    await chmod(dir, 0o777);
    await writeFile(path.join(dir, file), source, { mode: 0o644 });
    const c = await dockerRun(`${dir}:/work`, ['javac', '-J-Xmx192m', file], COMPILE_TIMEOUT);
    if (c.spawnError || (c.code !== 0 && /Unable to find image|Cannot connect to the Docker/i.test(c.stderr) && !/error:/.test(c.stderr))) return { status: 'unavailable' };
    if (c.timedOut) return { status: 'compile_error', stderr: 'Compilation timed out.', errors: [] };
    if (c.code !== 0) return { status: 'compile_error', stderr: c.stderr, errors: parseCompileErrors(c.stderr, file) };
    const results = [];
    for (const input of inputs) {
      const r = await dockerRun(`${dir}:/work:ro`, ['java', '-Xmx128m', '-XX:-UsePerfData', '-cp', '/work', cls], RUN_TIMEOUT, input);
      results.push({ status: r.timedOut ? 'timeout' : r.code === 0 ? 'ok' : 'runtime_error', stdout: r.stdout ?? '', stderr: r.stderr ?? '', timeMs: r.ms });
    }
    return { status: 'ok', results };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// RUNNER=docker (default): one throw-away Docker container per run. RUNNER=local: child processes inside this container (see local.js).
const useLocal = () => (process.env.RUNNER || 'docker') === 'local';
export const runJava = (source, stdin = '') => (useLocal() ? localRunJava(source, stdin) : dockerRunJava(source, stdin));
export const runJavaCases = (source, inputs) => (useLocal() ? localRunJavaCases(source, inputs) : dockerRunJavaCases(source, inputs));
export const runnerMode = () => (useLocal() ? 'local' : 'docker');

// One entry point for every language the server can run: Java (above) plus C, C++ and Python (polyglot.js).
export const supportsLanguage = (language) => language === 'java' || isOtherLanguage(language);
export const runProgram = (language, source, stdin = '') => (language === 'java' ? runJava(source, stdin) : runOther(language, source, stdin));
export const runCases = (language, source, inputs) => (language === 'java' ? runJavaCases(source, inputs) : runOtherCases(language, source, inputs));
