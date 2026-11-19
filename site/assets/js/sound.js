// ByteRush sound: every effect is synthesized live with the Web Audio API (no audio files).
// Off until the visitor turns it on; the choice is remembered.

let ctx = null, master = null, drone = null, on = false, lastTick = 0, lastHover = 0;
const KEY = 'byterush-sound';

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.0001;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  return true;
}
const now = () => ctx.currentTime;

function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.2, attack = 0.005, delay = 0, filter = null }) {
  if (!on || !ctx) return;
  const t = now() + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7; o.connect(f); node = f; }
  node.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise({ dur = 0.4, vol = 0.12, from = 400, to = 3000, q = 1.2, delay = 0, type = 'bandpass' }) {
  if (!on || !ctx) return;
  const t = now() + delay, len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.05);
}

function startDrone() {
  if (drone || !ctx) return;
  const g = ctx.createGain(); g.gain.value = 0.0001;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.07; lfoGain.gain.value = 180; lfo.connect(lfoGain).connect(lp.frequency);
  const oscs = [55, 82.4, 110.2, 164.8].map((f, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6; o.connect(lp); o.start(); return o; });
  lp.connect(g).connect(master); lfo.start();
  g.gain.exponentialRampToValueAtTime(0.05, now() + 3);
  drone = { g, oscs, lfo };
}
function stopDrone() {
  if (!drone) return;
  const d = drone; drone = null;
  d.g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.8);
  setTimeout(() => { d.oscs.forEach((o) => o.stop()); d.lfo.stop(); }, 900);
}

export const sfx = {
  get on() { return on; },
  async set(v) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
    if (!v) { if (ctx) { stopDrone(); master.gain.exponentialRampToValueAtTime(0.0001, now() + 0.4); } return; }
    if (!ensure()) { on = false; return; }
    await ctx.resume();
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now()); master.gain.exponentialRampToValueAtTime(0.9, now() + 0.3);
    startDrone();
    this.boot();
  },
  wanted() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
  // small UI sounds
  hover() { const t = performance.now(); if (t - lastHover < 70) return; lastHover = t; tone({ freq: 2400, type: 'sine', dur: 0.05, vol: 0.035, filter: { freq: 3000 } }); },
  click() { tone({ freq: 180, to: 90, type: 'triangle', dur: 0.12, vol: 0.22 }); noise({ dur: 0.05, vol: 0.06, from: 3000, to: 1500, type: 'highpass' }); },
  key() { const t = performance.now(); if (t - lastTick < 28) return; lastTick = t; tone({ freq: 1800 + Math.random() * 900, type: 'square', dur: 0.018, vol: 0.02, filter: { freq: 2600, type: 'bandpass', q: 2 } }); },
  // bigger moments
  boot() { [196, 293.7, 392, 587.3].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.12, delay: i * 0.07, filter: { freq: 2400 } })); noise({ dur: 0.9, vol: 0.05, from: 200, to: 6000 }); },
  whoosh() { noise({ dur: 0.7, vol: 0.07, from: 250, to: 2800, q: 2.4 }); tone({ freq: 70, to: 140, type: 'sine', dur: 0.6, vol: 0.06 }); },
  success() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.45, vol: 0.09, delay: i * 0.075 })); },
  error() { tone({ freq: 220, to: 160, type: 'sawtooth', dur: 0.22, vol: 0.06, filter: { freq: 900 } }); tone({ freq: 207.7, to: 150, type: 'sawtooth', dur: 0.26, vol: 0.05, delay: 0.12, filter: { freq: 800 } }); },
  unlock() { [784, 1174.7, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.07, delay: i * 0.06 })); tone({ freq: 3136, type: 'sine', dur: 0.6, vol: 0.025, delay: 0.2 }); },
  glitch() { for (let i = 0; i < 4; i++) tone({ freq: 300 + Math.random() * 1500, type: 'square', dur: 0.03, vol: 0.03, delay: i * 0.035, filter: { freq: 2000 } }); },
  pop() { tone({ freq: 520, to: 880, type: 'sine', dur: 0.12, vol: 0.1 }); },
};

document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
