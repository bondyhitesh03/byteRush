// @ts-nocheck
// These functions are turned into text with toString() and run inside a sandboxed worker / preview page,
// so each one must be completely self-contained (no imports, no outside variables).

// Formats any value the way a developer console would.
export function fmtValue(v, depth, seen) {
  depth = depth || 0; seen = seen || new WeakSet();
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  const t = typeof v;
  if (t === 'string') return depth ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'" : v;
  if (t === 'number' || t === 'boolean') return String(v);
  if (t === 'bigint') return v + 'n';
  if (t === 'symbol') return v.toString();
  if (t === 'function') return '[Function' + (v.name ? ': ' + v.name : ' (anonymous)') + ']';
  if (v instanceof Error) return (v.name || 'Error') + ': ' + v.message;
  if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();
  if (v instanceof RegExp) return String(v);
  if (seen.has(v)) return '[Circular]';
  if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
  seen.add(v);
  let out;
  try {
    if (Array.isArray(v)) {
      const items = v.slice(0, 100).map((x) => fmtValue(x, depth + 1, seen));
      if (v.length > 100) items.push('... ' + (v.length - 100) + ' more items');
      out = items.length ? '[ ' + items.join(', ') + ' ]' : '[]';
    } else if (v instanceof Map) {
      const items = Array.from(v).slice(0, 100).map((e) => fmtValue(e[0], depth + 1, seen) + ' => ' + fmtValue(e[1], depth + 1, seen));
      out = 'Map(' + v.size + ') ' + (items.length ? '{ ' + items.join(', ') + ' }' : '{}');
    } else if (v instanceof Set) {
      const items = Array.from(v).slice(0, 100).map((x) => fmtValue(x, depth + 1, seen));
      out = 'Set(' + v.size + ') ' + (items.length ? '{ ' + items.join(', ') + ' }' : '{}');
    } else {
      const items = Object.keys(v).slice(0, 100).map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + fmtValue(v[k], depth + 1, seen));
      out = items.length ? '{ ' + items.join(', ') + ' }' : '{}';
    }
  } catch (e) { out = '[Unprintable]'; }
  seen.delete(v);
  return out;
}

// Runs inside the Worker: captures console output, tracks timers, runs the user's code (top-level await works).
export function workerMain(fmt) {
  const MAX_ENTRIES = 1000, MAX_CHARS = 64 * 1024;
  let count = 0, chars = 0, truncated = false;
  const post = (level, text) => {
    if (truncated) return;
    if (count >= MAX_ENTRIES || chars > MAX_CHARS) { truncated = true; self.postMessage({ t: 'log', level: 'warn', text: '… output truncated' }); return; }
    count++; chars += text.length; self.postMessage({ t: 'log', level, text });
  };
  const show = (a) => a.map((x) => fmt(x, 0, new WeakSet())).join(' ');
  console.log = (...a) => post('log', show(a));
  console.debug = console.log;
  console.info = (...a) => post('info', show(a));
  console.warn = (...a) => post('warn', show(a));
  console.error = (...a) => post('error', show(a));
  console.dir = (o) => post('log', fmt(o, 1, new WeakSet()));
  console.table = (d) => post('log', fmt(d, 1, new WeakSet()));
  console.clear = () => {};

  const st = self.setTimeout.bind(self), ct = self.clearTimeout.bind(self), si = self.setInterval.bind(self), ci = self.clearInterval.bind(self);
  const timeouts = new Set(), intervals = new Set();
  const lineOf = (e) => { const m = /<anonymous>:(\d+):\d+/.exec(String(e && e.stack)); return m ? Math.max(1, Number(m[1]) - 2) : undefined; };
  const report = (e) => self.postMessage({ t: 'error', message: e && e.name ? e.name + ': ' + e.message : String(e), line: lineOf(e) });
  self.setTimeout = (fn, ms, ...rest) => {
    const id = st(() => { timeouts.delete(id); try { if (typeof fn === 'function') fn(...rest); } catch (e) { report(e); } }, ms);
    timeouts.add(id); return id;
  };
  self.clearTimeout = (id) => { timeouts.delete(id); ct(id); };
  self.setInterval = (fn, ms, ...rest) => {
    const id = si(() => { try { if (typeof fn === 'function') fn(...rest); } catch (e) { report(e); } }, ms);
    intervals.add(id); return id;
  };
  self.clearInterval = (id) => { intervals.delete(id); ci(id); };
  if (self.addEventListener) {
    self.addEventListener('unhandledrejection', (e) => { report(e.reason); if (e.preventDefault) e.preventDefault(); });
    self.addEventListener('error', (e) => { report(e.error || e.message); if (e.preventDefault) e.preventDefault(); });
  }

  self.onmessage = async (ev) => {
    const code = ev.data.code, stdin = ev.data.stdin || '';
    const lines = stdin.split(/\r?\n/); if (lines.length && lines[lines.length - 1] === '') lines.pop();
    let next = 0;
    const input = () => (next < lines.length ? lines[next++] : null); // input() returns the next line you typed in the Input tab
    const inputAll = () => stdin;
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      await new AsyncFunction('input', 'inputAll', code)(input, inputAll);
    } catch (e) { report(e); }
    await new Promise((r) => st(r, 30)); // let unhandled rejections surface
    while (timeouts.size > 0 || intervals.size > 0) await new Promise((r) => st(r, 25)); // wait for timers (intervals end at the time limit)
    self.postMessage({ t: 'done' });
  };
}

// Runs inside the HTML preview page: forwards console output and errors to ByteRush.
export function consoleBridge(fmt) {
  const send = (level, text) => { try { parent.postMessage({ byterush: 'web-console', level: level, text: String(text).slice(0, 2000) }, '*'); } catch (e) { /* ignore */ } };
  const show = (a) => Array.prototype.map.call(a, (x) => fmt(x, 0, new WeakSet())).join(' ');
  ['log', 'info', 'warn', 'error', 'debug'].forEach((m) => {
    const orig = console[m];
    console[m] = function () { send(m === 'debug' ? 'log' : m, show(arguments)); try { orig.apply(console, arguments); } catch (e) { /* ignore */ } };
  });
  window.addEventListener('error', (e) => send('error', (e.message || 'Error') + (e.lineno ? ' (line ' + e.lineno + ')' : '')));
  window.addEventListener('unhandledrejection', (e) => send('error', 'Unhandled promise rejection: ' + fmt(e.reason, 0, new WeakSet())));
}

export const workerSource = () => '(' + workerMain.toString() + ')(' + fmtValue.toString() + ')';
export const bridgeScript = () => '<script>(' + consoleBridge.toString() + ')(' + fmtValue.toString() + ')</' + 'script>';
