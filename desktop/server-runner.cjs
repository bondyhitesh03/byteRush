// Starts the ByteRush server (backend/server.js) as a child process and waits until it answers.
// Used by the desktop app (main.cjs). Kept separate so it can be tested with plain Node.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');

function findFreePort(start = 3101, end = 3200) {
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

function healthy(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
      let b = ''; res.on('data', (d) => (b += d));
      res.on('end', () => { try { resolve(JSON.parse(b).app === 'ByteRush'); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// opts: { serverDir, jdkDir, dataDir, nodeBinary, runAsNode }
async function startServer({ serverDir, jdkDir, dataDir, nodeBinary = process.execPath, runAsNode = false, timeoutMs = 45000 }) {
  const entry = path.join(serverDir, 'backend', 'server.js');
  if (!fs.existsSync(entry)) throw new Error(`The ByteRush server is missing (${entry}). Please reinstall ByteRush.`);
  fs.mkdirSync(dataDir, { recursive: true });
  const port = await findFreePort();
  if (!port) throw new Error('No free port between 3101 and 3200. Close other programs and try again.');

  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', RUNNER: 'local', BYTERUSH_DATA: dataDir, BYTERUSH_DESKTOP: '1' };
  delete env.PUBLIC_MODE;
  if (runAsNode) env.ELECTRON_RUN_AS_NODE = '1';
  const extra = [];
  if (jdkDir && fs.existsSync(path.join(jdkDir, 'bin'))) { env.JAVA_HOME = jdkDir; extra.push(path.join(jdkDir, 'bin')); }
  // Apps opened from Finder get a very short PATH: add the usual places for Homebrew's Python, gcc and g++.
  if (process.platform === 'darwin') extra.push('/opt/homebrew/bin', '/usr/local/bin');
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  env[pathKey] = [...extra, env[pathKey] || '/usr/bin:/bin:/usr/sbin:/sbin'].join(path.delimiter);

  const logFile = path.join(dataDir, 'byterush.log');
  const log = fs.openSync(logFile, 'a');
  fs.writeSync(log, `\n---- ByteRush desktop starting ${new Date().toISOString()} (port ${port})\n`);
  const child = spawn(nodeBinary, [entry], { cwd: path.dirname(entry), env, stdio: ['ignore', log, log], windowsHide: true });

  let exited = null;
  child.on('exit', (code) => { exited = code ?? -1; });
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (exited !== null) break;
    if (await healthy(port)) return { port, url: `http://127.0.0.1:${port}`, child, logFile };
    await new Promise((r) => setTimeout(r, 300));
  }
  try { child.kill(); } catch { /* already gone */ }
  let tail = '';
  try { tail = fs.readFileSync(logFile, 'utf8').slice(-1500); } catch { /* no log */ }
  throw new Error(`ByteRush's server did not start.\n\n${tail}`);
}

module.exports = { startServer, findFreePort, healthy };
