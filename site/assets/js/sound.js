// ByteRush sound: short, soft tones synthesized live with the Web Audio API (no audio files, no background sound).
// Off until the visitor turns it on; the choice is remembered.

let ctx = null, master = null, on = false, lastTick = 0, lastHover = 0;
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
export const sfx = {
  get on() { return on; },
  async set(v) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
    if (!v) { if (ctx) master.gain.exponentialRampToValueAtTime(0.0001, now() + 0.4); return; }
    if (!ensure()) { on = false; return; }
    await ctx.resume();
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now()); master.gain.exponentialRampToValueAtTime(0.8, now() + 0.3);
    this.boot();
  },
  wanted() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
  // small UI sounds
  hover() { const t = performance.now(); if (t - lastHover < 70) return; lastHover = t; tone({ freq: 2400, type: 'sine', dur: 0.05, vol: 0.035, filter: { freq: 3000 } }); },
  click() { tone({ freq: 660, to: 520, type: 'sine', dur: 0.09, vol: 0.09 }); },
  key() { const t = performance.now(); if (t - lastTick < 45) return; lastTick = t; tone({ freq: 1400 + Math.random() * 400, type: 'sine', dur: 0.03, vol: 0.018 }); },
  // bigger moments
  boot() { [392, 523.3, 659.3, 784].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.4, vol: 0.08, delay: i * 0.07 })); },
  whoosh() { tone({ freq: 440, to: 660, type: 'sine', dur: 0.35, vol: 0.035, attack: 0.08 }); },
  success() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.45, vol: 0.09, delay: i * 0.075 })); },
  error() { tone({ freq: 330, to: 262, type: 'triangle', dur: 0.22, vol: 0.06 }); tone({ freq: 262, to: 220, type: 'triangle', dur: 0.26, vol: 0.05, delay: 0.14 }); },
  unlock() { [784, 1174.7, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.07, delay: i * 0.06 })); tone({ freq: 3136, type: 'sine', dur: 0.6, vol: 0.025, delay: 0.2 }); },
  glitch() { [880, 1046.5].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.08, vol: 0.04, delay: i * 0.05 })); },
  pop() { tone({ freq: 520, to: 880, type: 'sine', dur: 0.12, vol: 0.1 }); },
};

document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
