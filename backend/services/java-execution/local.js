// "Local" runner: compiles and runs Java as ordinary child processes inside the server's own container.
// Use it where Docker-in-Docker isn't available (Render and similar hosts): RUNNER=local.
// Hardening: no secrets in the child's environment, a throw-away working folder, CPU/file/process limits, a wall-clock timeout,
// the child runs as the unprivileged user "nobody" when the server runs as root, and (when the host allows it) no network.
// macOS: a sandbox-exec profile (no network, writes only to temp folders) that is self-tested at first use and skipped if it doesn't work.
// Windows: no extra sandbox, programs run with your own account (like running code in an IDE).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, chmod, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RUN_TIMEOUT = () => Number(process.env.RUN_TIMEOUT_MS || 5000);
const COMPILE_TIMEOUT = () => Number(process.env.COMPILE_TIMEOUT_MS || 15000);
const MAX_OUT = 64 * 1024;

const IS_WIN = process.platform === 'win32';
const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
const DROP = IS_ROOT ? { uid: 65534, gid: 65534 } : {};
const probe = (cmd, args, opts = {}) => { try { return spawnSync(cmd, args, { timeout: 5000, stdio: 'ignore', ...opts }).status === 0; } catch { return false; } };
const HAS_JAVAC = probe('javac', ['-version']);
const HAS_JAVA = probe('java', ['-version']);
const NO_NET = process.platform === 'linux' && probe('unshare', ['-rn', 'true'], DROP);
export const localInfo = () => ({ platform: process.platform, javac: HAS_JAVAC, java: HAS_JAVA, dropsPrivileges: IS_ROOT, networkBlocked: NO_NET });

// Only these variables reach visitors' programs: no secrets, no tokens.
const ENV_KEEP = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE', 'JAVA_HOME', 'LANG'];
const SAFE_ENV = { ...Object.fromEntries(ENV_KEEP.filter((k) => process.env[k]).map((k) => [k, process.env[k]])), HOME: IS_ROOT ? '/tmp' : (process.env.HOME || '/tmp'), ...(process.env.LANG ? {} : { LANG: 'C.UTF-8' }) };
const SCRIPT = 'ulimit -t 20 2>/dev/null; ulimit -f 8192 2>/dev/null; ulimit -u 512 2>/dev/null; exec "$@"';
// C, C++ and Python can be given a memory ceiling (the JVM can't: it reserves a lot of address space).
const SCRIPT_MEM = 'ulimit -t 20 2>/dev/null; ulimit -f 8192 2>/dev/null; ulimit -u 512 2>/dev/null; ulimit -v 2097152 2>/dev/null; exec "$@"';
const wrap = (cmd, args, profile, limitMemory) => {
  if (IS_WIN) return [cmd, ...args]; // no bash on Windows
  const base = ['bash', '-c', limitMemory ? SCRIPT_MEM : SCRIPT, 'bash', cmd, ...args];
  if (profile) return ['sandbox-exec', '-p', profile, ...base];
  return NO_NET ? ['unshare', '-rn', ...base] : base;
};
const JVM = ['-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-XX:-UsePerfData', '-Dfile.encoding=UTF-8'];

// macOS sandbox profile, verified once with a real Java run (and silently skipped if it doesn't work on this Mac).
let sandboxPromise;
function sandboxProfile() {
  if (!sandboxPromise) sandboxPromise = (async () => {
    if (process.platform !== 'darwin' || process.env.BYTERUSH_NO_SANDBOX) return null;
    let dir;
    try {
      const tmp = await realpath(tmpdir());
      const profile = `(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath "${tmp}") (subpath "/private/tmp") (literal "/dev/null") (literal "/dev/dtracehelper") (literal "/dev/tty"))`;
      dir = await mkdtemp(path.join(tmpdir(), 'byterush-sb-'));
      await chmod(dir, 0o777);
      await writeFile(path.join(dir, 'SbTest.java'), 'public class SbTest { public static void main(String[] a) { System.out.println("sandbox-ok"); } }');
      const r = HAS_JAVA
        ? await execWith(profile, 'java', launcherFlags('SbTest.java'), { cwd: dir, timeoutMs: 30000, stdin: '' })
        : await execWith(profile, '/bin/echo', ['sandbox-ok'], { cwd: dir, timeoutMs: 10000, stdin: '' });
      return r.code === 0 && r.stdout.trim() === 'sandbox-ok' ? profile : null;
    } catch { return null; } finally { if (dir) rm(dir, { recursive: true, force: true }).catch(() => {}); }
  })();
  return sandboxPromise;
}

const exec = async (cmd, args, opts) => execWith(await sandboxProfile(), cmd, args, opts);
export const localExec = exec; // used by the C, C++ and Python runner (polyglot.js)

function execWith(profile, cmd, args, { cwd, timeoutMs, stdin, limitMemory }) {
  return new Promise((resolve) => {
    const [bin, ...rest] = wrap(cmd, args, profile, limitMemory);
    const started = Date.now();
    let p;
    try { p = spawn(bin, rest, { cwd, env: SAFE_ENV, detached: !IS_WIN, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, ...DROP }); }
    catch (e) { return resolve({ spawnError: e.message }); }
    let stdout = '', stderr = '', timedOut = false, truncated = false;
    const add = (cur, d) => { if (cur.length >= MAX_OUT) { truncated = true; return cur; } return cur + d.toString('utf8'); };
    p.stdout.on('data', (d) => (stdout = add(stdout, d)));
    p.stderr.on('data', (d) => (stderr = add(stderr, d)));
    p.stdin.on('error', () => {});
    p.stdin.end(stdin ?? '');
    const kill = () => {
      if (IS_WIN) { try { spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () => {}); } catch { /* ignore */ } try { p.kill('SIGKILL'); } catch { /* gone */ } return; }
      try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch { /* gone */ } }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ spawnError: e.message, stdout, stderr }); });
    p.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr, timedOut, truncated, ms: Date.now() - started }); });
  });
}

const names = (source) => {
  const cls = (/public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/.exec(source) || [])[1] || 'Main';
  return { cls, file: `${cls}.java` };
};
const parseErrors = (text, file) => {
  const out = []; const re = new RegExp(`${file}:(\\d+): error: (.*)`, 'g'); let m;
  while ((m = re.exec(text))) out.push({ line: Number(m[1]), message: m[2] });
  return out;
};
const compileFlags = (file) => ['-J-Xmx192m', '-J-XX:+UseSerialGC', '-J-XX:TieredStopAtLevel=1', file];
const runFlags = (cls) => ['-Xmx128m', '-Xss1m', ...JVM, '-XX:+ExitOnOutOfMemoryError', '-cp', '.', cls];
const launcherFlags = (file) => ['-Xmx192m', '-Xss1m', ...JVM, '-XX:+ExitOnOutOfMemoryError', file]; // no javac installed: compile+run in one go
const unavailable = (why) => ({ status: 'unavailable', message: process.env.BYTERUSH_DESKTOP
  ? "Java isn't installed on this computer yet. Install the free JDK from https://adoptium.net (choose the latest LTS), then restart ByteRush."
  : `Java could not be started on this server (${why}).` });
const compileFailed = (r, file) => r.code !== 0 && (/error: compilation failed/.test(r.stderr) || (new RegExp(`${file}:\\d+: error:`).test(r.stderr) && !r.stdout));
const compileErr = (r, file) => ({ status: 'compile_error', stderr: r.stderr.replace(/error: compilation failed\s*$/m, '').trim() || r.stderr, errors: parseErrors(r.stderr, file), timeMs: r.ms });

function classify(r) {
  if (r.spawnError) return unavailable(r.spawnError);
  if (r.timedOut) return { status: 'timeout', phase: 'run', stdout: r.stdout, stderr: `Stopped after ${RUN_TIMEOUT() / 1000}s - possible infinite loop.`, timeMs: r.ms, truncated: r.truncated };
  if (r.code !== 0) return { status: 'runtime_error', stdout: r.stdout, stderr: r.stderr, timeMs: r.ms, truncated: r.truncated };
  return { status: 'ok', stdout: r.stdout, stderr: r.stderr, timeMs: r.ms, truncated: r.truncated };
}

async function workdir(source, file) {
  const dir = await mkdtemp(path.join(tmpdir(), 'byterush-'));
  await chmod(dir, 0o777); // the unprivileged runner user must be able to write class files here
  await writeFile(path.join(dir, file), source, { mode: 0o644 });
  return dir;
}

export async function localRunJava(source, stdin = '') {
  const { cls, file } = names(source);
  const dir = await workdir(source, file);
  try {
    if (!HAS_JAVAC) {
      const r = await exec('java', launcherFlags(file), { cwd: dir, timeoutMs: COMPILE_TIMEOUT() + RUN_TIMEOUT(), stdin });
      return compileFailed(r, file) ? compileErr(r, file) : classify(r);
    }
    const c = await exec('javac', compileFlags(file), { cwd: dir, timeoutMs: COMPILE_TIMEOUT() });
    if (c.spawnError) return unavailable(c.spawnError);
    if (c.timedOut) return { status: 'timeout', phase: 'compile', stdout: '', stderr: 'Compilation timed out.', timeMs: c.ms };
    if (c.code !== 0) return compileErr(c, file);
    return classify(await exec('java', runFlags(cls), { cwd: dir, timeoutMs: RUN_TIMEOUT(), stdin }));
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

export async function localRunJavaCases(source, inputs) {
  const { cls, file } = names(source);
  const dir = await workdir(source, file);
  try {
    if (HAS_JAVAC) {
      const c = await exec('javac', compileFlags(file), { cwd: dir, timeoutMs: COMPILE_TIMEOUT() });
      if (c.spawnError) return { status: 'unavailable' };
      if (c.timedOut) return { status: 'compile_error', stderr: 'Compilation timed out.', errors: [] };
      if (c.code !== 0) { const e = compileErr(c, file); return { status: 'compile_error', stderr: e.stderr, errors: e.errors }; }
    }
    const results = [];
    for (const input of inputs) {
      const r = HAS_JAVAC
        ? await exec('java', runFlags(cls), { cwd: dir, timeoutMs: RUN_TIMEOUT(), stdin: input })
        : await exec('java', launcherFlags(file), { cwd: dir, timeoutMs: COMPILE_TIMEOUT() + RUN_TIMEOUT(), stdin: input });
      if (r.spawnError) return { status: 'unavailable' };
      if (!HAS_JAVAC && compileFailed(r, file)) { const e = compileErr(r, file); return { status: 'compile_error', stderr: e.stderr, errors: e.errors }; }
      results.push({ status: r.timedOut ? 'timeout' : r.code === 0 ? 'ok' : 'runtime_error', stdout: r.stdout ?? '', stderr: r.stderr ?? '', timeMs: r.ms });
    }
    return { status: 'ok', results };
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
