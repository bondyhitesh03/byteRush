import { useEffect, useState } from 'react';
import type { Theme } from '../hooks/useTheme';
import { getSettings, removeKey, saveKey, saveModel, testKey, type ActionResult, type AiSettings } from '../services/api';
import { clearKey, getKey, getModel, KEY_RE, MODEL_RE, setKey as storeKey, setModel as storeModel } from '../utils/clientStore';

const KEY_URL = 'https://aistudio.google.com/app/apikey';
const done = (ok: boolean, message: string): Promise<ActionResult> => Promise.resolve({ ok, message });

export default function SettingsPage({ theme, onTheme, onChanged }: { theme: Theme; onTheme: (t: Theme) => void; onChanged?: () => void }) {
  const [s, setS] = useState<AiSettings | null>(null);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pub = Boolean(s?.publicMode); // public mode: the key lives in THIS browser, not on the server

  const load = async () => {
    const r = await getSettings();
    if (r) { setS(r); setModel(r.publicMode ? getModel() : r.model); } else setMsg({ ok: false, message: "Can't reach the backend. Is it running on port 3001?" });
  };
  useEffect(() => { void load(); }, []);

  const act = async (fn: () => Promise<ActionResult>, after?: () => void) => {
    setBusy(true); setMsg(null);
    const r = await fn();
    setMsg(r); if (r.ok) after?.();
    await load(); onChanged?.(); setBusy(false);
  };

  const stored = getKey();
  const hasKey = pub ? Boolean(stored) : Boolean(s?.hasKey);
  const hint = pub ? `…${stored.slice(-4)}` : s?.keyHint;
  const onSave = () => (pub
    ? act(() => (KEY_RE.test(key.trim()) ? (storeKey(key), done(true, 'Key saved in this browser. Press "Test key" to check it works.')) : done(false, "That doesn't look like an API key. Copy the whole key from Google AI Studio (no spaces or quotes).")), () => setKey(''))
    : act(() => saveKey(key), () => setKey('')));
  const onRemove = () => act(pub ? () => (clearKey(), done(true, 'Key removed from this browser.')) : removeKey);
  const onModel = (value: string) => (pub
    ? act(() => (!value.trim() || MODEL_RE.test(value.trim()) ? (storeModel(value), done(true, value.trim() ? `Model set to ${value.trim()}.` : 'Model reset to the default.')) : done(false, 'That model name has unusual characters.')))
    : act(() => saveModel(value)));

  return (
    <div className="scroll"><div className="solver">
      <h2>⚙ Settings</h2>
      <div className="card">
        <h3>🎨 Appearance</h3>
        <p className="muted">Choose how ByteRush looks. “System” follows your device.</p>
        <div className="seg" role="group" aria-label="Theme">
          {(['dark', 'light', 'system'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => onTheme(t)}>{t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '💻 System'}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>🔑 {pub ? 'Your own Gemini key' : 'API key (Google Gemini)'}</h3>
        <p>{hasKey ? <span className="ok">✓ A key is saved ({hint}{!pub && s?.source === 'env' ? ', from backend/.env' : pub ? ', in this browser' : ''})</span> : <span className="bad">No key saved yet.</span>}</p>
        <ol className="steps">
          <li>Open <a href={KEY_URL} target="_blank" rel="noreferrer">Google AI Studio → API keys ↗</a> and sign in with your Google account.</li>
          <li>Click <b>Create API key</b> and copy it.</li>
          <li>Paste it below and press <b>Save key</b>, then <b>Test key</b>.</li>
        </ol>
        <input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your Gemini API key here" />
        <div className="row">
          <button className="primary" disabled={busy || !key.trim()} onClick={onSave}>Save key</button>
          <button disabled={busy || !hasKey} onClick={() => act(testKey)}>Test key</button>
          <button disabled={busy || (pub ? !stored : s?.source !== 'settings')} onClick={onRemove}>Remove key</button>
        </div>
        {pub
          ? <p className="muted">Your key is kept only in this browser, never saved on the server. When you use an AI feature it is passed through this site's server to Google, along with your question or code. Running Java and grading work without a key.</p>
          : <p className="muted">Stored only on this computer (backend/data/settings.json) and sent only to Google. When the free limit runs out, the app will tell you, and you can paste a new key here.</p>}
      </div>
      <div className="card">
        <h3>Model</h3>
        <p className="muted">Only change this if the app says the model wasn't found. Default: {s?.defaultModel}.</p>
        <input value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
        <div className="row">
          <button disabled={busy || !model.trim()} onClick={() => onModel(model)}>Save model</button>
          <button disabled={busy} onClick={() => { setModel(''); onModel(''); }}>Reset to default</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? 'okbox' : 'err'}>{msg.message}</div>}
    </div></div>
  );
}
