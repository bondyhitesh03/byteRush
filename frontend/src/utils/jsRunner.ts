import { workerSource } from './jsWorker';

export interface ConsoleEntry { level: 'log' | 'info' | 'warn' | 'error'; text: string }
export interface JsResult { entries: ConsoleEntry[]; error: { message: string; line?: number } | null; timedOut: boolean; ms: number }

const safeJson = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c');

// The page that lives inside the sandboxed iframe: it starts the Worker and relays its messages to ByteRush.
export function buildFrame(code: string, stdin: string, token: string): string {
  return `<!doctype html><meta charset="utf-8"><script>
const TOKEN = ${safeJson(token)};
const done = () => parent.postMessage({ token: TOKEN, t: 'done' }, '*');
try {
  const w = new Worker(URL.createObjectURL(new Blob([${safeJson(workerSource())}], { type: 'text/javascript' })));
  w.onmessage = (e) => parent.postMessage(Object.assign({ token: TOKEN }, e.data), '*');
  w.onerror = (e) => { parent.postMessage({ token: TOKEN, t: 'error', message: e.message || 'Worker error' }, '*'); done(); };
  w.postMessage({ code: ${safeJson(code)}, stdin: ${safeJson(stdin)} });
} catch (err) {
  parent.postMessage({ token: TOKEN, t: 'error', message: "Your browser could not start the JavaScript sandbox (" + err.message + "). Try Chrome, Edge or Firefox." }, '*');
  done();
}
</script>`;
}

// Runs JavaScript safely: an invisible sandboxed iframe (no access to ByteRush or its storage) that runs the code in a Worker.
// Removing the iframe stops everything, which is how infinite loops are ended.
export function runJs(code: string, stdin: string, timeoutMs = 5000): Promise<JsResult> {
  return new Promise((resolve) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    const entries: ConsoleEntry[] = [];
    let error: JsResult['error'] = null;
    let finished = false;
    const started = performance.now();
    const finish = (timedOut: boolean) => {
      if (finished) return;
      finished = true; clearTimeout(timer); window.removeEventListener('message', onMessage); iframe.remove();
      resolve({ entries, error, timedOut, ms: Math.round(performance.now() - started) });
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const d = e.data as { token?: string; t?: string; level?: ConsoleEntry['level']; text?: unknown; message?: unknown; line?: unknown } | null;
      if (!d || d.token !== token) return;
      if (d.t === 'log') entries.push({ level: d.level ?? 'log', text: String(d.text) });
      else if (d.t === 'error') error = error ?? { message: String(d.message), line: typeof d.line === 'number' ? d.line : undefined };
      else if (d.t === 'done') finish(false);
    };
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => finish(true), timeoutMs);
    iframe.srcdoc = buildFrame(code, stdin, token);
    document.body.appendChild(iframe);
  });
}
