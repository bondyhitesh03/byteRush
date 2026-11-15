#!/usr/bin/env node
// ByteRush silent launcher: used by ByteRush.app. No terminal window, no prompts.
// Starts the server in the background (if it is not already running) and opens the browser.
// Exit codes: 0 = opened, 2 = first-time setup/Node/Java choices needed (the app then falls back to the visible launcher).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, findRunning, findFreePort, waitForServer, javaState, openBrowser, hashFiles } from './launch.mjs';

const dataDir = process.env.BYTERUSH_DATA || path.join(os.homedir(), 'ByteRush-Data');
fs.mkdirSync(dataDir, { recursive: true });

const running = await findRunning();
if (running) { openBrowser(`http://localhost:${running}`); process.exit(0); }

// First run (or after the website code changed) needs the visible launcher for installs/builds.
const frontend = path.join(ROOT, 'frontend');
const stampFile = path.join(frontend, 'dist', '.stamp');
const STAMP_FILES = ['frontend/package.json', 'frontend/index.html', 'frontend/vite.config.ts', 'frontend/tsconfig.json', 'frontend/src', 'frontend/public'];
const built = fs.existsSync(path.join(frontend, 'dist', 'index.html')) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === hashFiles(ROOT, STAMP_FILES);
const depsOk = fs.existsSync(path.join(ROOT, 'backend', 'node_modules', 'express'));
if (!depsOk) process.exit(2);
if (!built) { // the website code changed (e.g. after an update): rebuild it quietly if the tools are already installed
  if (!fs.existsSync(path.join(frontend, 'node_modules', 'vite'))) process.exit(2);
  const r = spawnSync('npm', ['run', 'build'], { cwd: frontend, stdio: 'ignore', env: process.env });
  if (r.status !== 0) process.exit(2);
  fs.writeFileSync(stampFile, hashFiles(ROOT, STAMP_FILES));
}

const port = Number(process.env.BYTERUSH_PORT) || await findFreePort();
if (!port) process.exit(2);
const java = javaState();
const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', RUNNER: process.env.RUNNER || 'local', BYTERUSH_DATA: dataDir, BYTERUSH_DESKTOP: '1' };
if (java.home) { env.JAVA_HOME = java.home; env.PATH = `${path.join(java.home, 'bin')}${path.delimiter}${env.PATH || ''}`; }

const logFd = fs.openSync(path.join(dataDir, 'byterush.log'), 'a');
const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'server.js')], {
  cwd: path.join(ROOT, 'backend'), env, detached: true, stdio: ['ignore', logFd, logFd],
});
child.unref();
fs.writeFileSync(path.join(dataDir, 'byterush.pid'), String(child.pid));

if (!(await waitForServer(port))) process.exit(2);
openBrowser(`http://localhost:${port}`);
process.exit(0);
