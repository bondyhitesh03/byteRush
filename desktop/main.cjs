// ByteRush desktop app: starts the local server and shows ByteRush in its own window. Works offline
// (only the AI features need internet). Java is bundled in the app; data lives in ~/ByteRush-Data.
const { app, BrowserWindow, shell, dialog } = require('electron');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('./server-runner.cjs');

app.setName('ByteRush');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const RES = app.isPackaged ? process.resourcesPath : __dirname;
let server = null;
let win = null;

const SPLASH = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;
align-items:center;justify-content:center;background:#05070d;color:#cfd6ff;font:16px -apple-system,Segoe UI,sans-serif">
<div style="text-align:center"><div style="font-size:42px">⚡</div><b style="font-size:22px">ByteRush</b>
<p style="opacity:.7">Starting…</p></div></body></html>`);

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 600, backgroundColor: '#05070d', title: 'ByteRush',
    autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL(SPLASH);
  // Links to other websites (e.g. getting a Gemini key) open in the normal browser, not inside ByteRush.
  const isApp = (url) => server && url.startsWith(server.url);
  win.webContents.setWindowOpenHandler(({ url }) => { if (!isApp(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isApp(url) && !url.startsWith('data:')) { e.preventDefault(); shell.openExternal(url); } });
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  createWindow();
  try {
    server = await startServer({
      serverDir: path.join(RES, 'server'),
      jdkDir: path.join(RES, 'jdk'),
      dataDir: process.env.BYTERUSH_DATA || path.join(os.homedir(), 'ByteRush-Data'),
      nodeBinary: process.execPath,
      runAsNode: true,
    });
    server.child.on('exit', (code) => {
      if (app.isQuitting) return;
      dialog.showErrorBox('ByteRush stopped', `ByteRush's server stopped unexpectedly (code ${code}). Details are in ${server.logFile}.`);
      app.quit();
    });
    if (win) win.loadURL(server.url);
  } catch (e) {
    dialog.showErrorBox('ByteRush could not start', String(e.message || e));
    app.quit();
  }
});

app.on('activate', () => { if (!win && server) { createWindow(); win.loadURL(server.url); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { app.isQuitting = true; if (server) { try { server.child.kill(); } catch { /* already gone */ } } });
