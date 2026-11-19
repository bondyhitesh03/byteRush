import { createUniverse } from './universe.js?v=__V__';
import { sfx } from './sound.js?v=__V__';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const SMALL = () => innerWidth < 900;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------------- downloads (same links as before) ---------------- */
const REPO = 'bondyhitesh03/byteRush';
const BASE = `https://github.com/${REPO}/releases/latest/download/`;
const FILES = { macArm: 'ByteRush-mac-arm64.dmg', macX64: 'ByteRush-mac-x64.dmg', win: 'ByteRush-windows-x64.exe' };
$('#dl-mac-arm64').href = BASE + FILES.macArm;
$('#dl-mac-x64').href = BASE + FILES.macX64;
$('#dl-win').href = BASE + FILES.win;

const ua = navigator.userAgent;
const isMac = /Macintosh|Mac OS X/.test(ua), isWin = /Windows/.test(ua);
function setPrimary(label, file, rowId) {
  for (const a of $$('[data-dl="primary"]')) {
    const l = $('[data-dl-label]', a);
    if (!l) continue;                // the nav button keeps scrolling to the download section
    a.href = BASE + file; l.textContent = label;
  }
  $$('.platform').forEach((p) => p.classList.toggle('mine', p.id === rowId));
}
if (isMac) {
  setPrimary('Download for Mac', FILES.macArm, 'dl-mac-arm64');
  // Chrome and Edge can tell Intel from Apple Silicon; Safari can't, so Apple Silicon (the common case) stays the default.
  navigator.userAgentData?.getHighEntropyValues?.(['architecture']).then((v) => {
    if (v.architecture === 'x86') setPrimary('Download for Mac (Intel)', FILES.macX64, 'dl-mac-x64');
  }).catch(() => {});
} else if (isWin) {
  setPrimary('Download for Windows', FILES.win, 'dl-win');
}
// Latest version, date and file sizes (optional: the links work without it).
fetch(`https://api.github.com/repos/${REPO}/releases/latest`).then((r) => (r.ok ? r.json() : null)).then((r) => {
  if (!r || !r.tag_name) return;
  const v = r.tag_name.replace(/^v/, '');
  const date = new Date(r.published_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  $('#hero-meta').textContent = `Version ${v}, free for Mac and Windows`;
  $('#dl-ver').textContent = `Version ${v}, released ${date}. Free.`;
  for (const a of r.assets || []) {
    const el = $(`[data-file="${a.name}"]`);
    if (el) el.textContent = `${Math.round(a.size / 1e6)} MB ${a.name.slice(a.name.lastIndexOf('.'))}`;
  }
}).catch(() => {});

/* ---------------- install tabs ---------------- */
function tab(which) {
  for (const [id, panel] of [['t-mac', 'p-mac'], ['t-win', 'p-win']]) {
    const on = id === `t-${which}`; $('#' + id).setAttribute('aria-selected', on); $('#' + panel).hidden = !on;
  }
}
$('#t-mac').onclick = () => tab('mac');
$('#t-win').onclick = () => tab('win');
if (isWin) tab('win');

/* ---------------- split headings into characters ---------------- */
for (const el of $$('[data-split]')) {
  const label = el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', label);
  let i = 0;
  const splitNode = (node) => {
    const frag = document.createDocumentFragment();
    const words = node.textContent.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { frag.append(' '); continue; }
      const ws = document.createElement('span'); ws.className = 'w'; ws.setAttribute('aria-hidden', 'true');
      for (const ch of w) { const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; c.style.setProperty('--i', i++); ws.append(c); }
      frag.append(ws);
    }
    return frag;
  };
  const lines = $$('.line', el);
  if (lines.length) lines.forEach((l) => { const f = splitNode(l); l.textContent = ''; l.append(f); });
  else { const f = splitNode(el); el.textContent = ''; el.append(f); }
}

/* ---------------- reveal on view ---------------- */
function typeOut(el) {
  if (el.dataset.typed) return; el.dataset.typed = '1';
  const text = el.dataset.text ?? el.textContent; el.dataset.text = text;
  if (REDUCED) { el.textContent = text; return; }
  const speed = Number(el.dataset.typeSpeed || 24);
  el.textContent = ''; el.classList.add('typing');
  let i = 0;
  const tick = () => { el.textContent = text.slice(0, ++i); sfx.key(); if (i < text.length) setTimeout(tick, speed + Math.random() * speed * .6); else setTimeout(() => el.classList.remove('typing'), 900); };
  setTimeout(tick, 250);
}
function countUp(el) {
  if (el.dataset.counted) return; el.dataset.counted = '1';
  const to = Number(el.dataset.count); if (REDUCED) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 1600;
  const f = (now) => { const p = clamp((now - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
for (const el of $$('[data-type]')) el.dataset.text = el.textContent;
$$('.ladder li').forEach((li, n) => li.style.setProperty('--n', n));
$$('.why li').forEach((li, n) => li.style.setProperty('--rd', `${.05 + (n % 3) * .08}s`));
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target; el.classList.add('in'); revealIO.unobserve(el);
    if (el.hasAttribute('data-type')) typeOut(el);
    if (el.matches('.badges')) setTimeout(() => sfx.unlock(), 500);
    if (el.matches('.score')) setTimeout(() => sfx.success(), 1700);
    if (el.matches('.err-print')) sfx.error();
    if (el.matches('.run-log')) setTimeout(() => sfx.success(), 1500);
    if (el.hasAttribute('data-count')) countUp(el);
    $$('[data-count]', el).forEach(countUp);
  }
}, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
$$('[data-split], [data-reveal], [data-type], [data-count], .ladder, .score, .filing, .xp, .badges, .why li, .err-print, .run-log').forEach((el) => revealIO.observe(el));
// the hero headline assembles on load
requestAnimationFrame(() => { $('.hero-title').classList.add('in'); $$('.hero [data-reveal]').forEach((el) => el.classList.add('in')); });
setTimeout(() => document.body.classList.remove('is-loading'), 3500);

/* ---------------- the 3D universe ---------------- */
let universe = null;
const canvas = $('#universe');
function startUniverse(logo) {
  try { universe = createUniverse(canvas, { logo, reducedMotion: REDUCED, small: SMALL() || COARSE }); } catch (e) { universe = null; }
  if (!universe) {
    document.body.classList.add('no-gl');
    const img = new Image(); img.src = 'logo-mark.png'; img.alt = ''; img.className = 'hero-fallback'; $('.hero').append(img);
    return;
  }
  $('#hud-particles').textContent = `bytes ${universe.count.toLocaleString('en-US')}`;
  applyScene(currentScene);
}
const logoImg = new Image();
logoImg.onload = () => startUniverse(logoImg);
logoImg.onerror = () => startUniverse(null);
logoImg.src = 'logo-mark.png';

let currentScene = $('.hero');
let lastSceneName = '';
function applyScene(sec) {
  currentScene = sec;
  if (!universe || !sec) return;
  const d = sec.dataset;
  let name = d.scene || 'field';
  if (sec.id === 'languages') name = 'glyph:' + ($('.langs [aria-selected="true"]')?.dataset.glyph || '{ }');
  const small = SMALL();
  if (lastSceneName && name !== lastSceneName) sfx.whoosh();
  lastSceneName = name;
  universe.setShape(name, {
    x: small ? 0 : Number(d.sceneX || 0),
    y: small ? (sec.classList.contains('hero') ? 1.6 : 0) : Number(d.sceneY || 0),
    scale: (small ? 0.62 : 1) * Number(d.sceneScale || 1),
    ember: Number(d.ember || 0),
  });
}
const sceneIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) applyScene(e.target);
}, { rootMargin: '-45% 0px -45% 0px' });
$$('[data-scene]').forEach((s) => sceneIO.observe(s));

/* ---------------- pointer: universe, HUD, cursor ---------------- */
const cursor = $('.cursor'), hud = $('#hud-pointer');
let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
addEventListener('pointermove', (e) => {
  tx = e.clientX; ty = e.clientY;
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -((e.clientY / innerHeight) * 2 - 1);
  if (e.pointerType === 'mouse') universe?.setPointer(nx, ny);
  if (hud) hud.textContent = `x ${nx.toFixed(2)}  y ${ny.toFixed(2)}`;
  if (!COARSE) cursor.classList.add('on');
}, { passive: true });
document.addEventListener('pointerleave', () => { universe?.clearPointer(); cursor.classList.remove('on'); });
addEventListener('pointerdown', () => cursor.classList.add('down'));
addEventListener('pointerup', () => cursor.classList.remove('down'));
let hoverEl = null;
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest('a, button, [data-zoom], input[type=range]');
  cursor.classList.toggle('hover', Boolean(t));
  if (t && t !== hoverEl) sfx.hover();
  hoverEl = t;
});
document.addEventListener('click', (e) => { if (e.target.closest('a, button, [data-zoom]') && !e.target.closest('.sound-toggle')) sfx.click(); });
function cursorLoop() { cx += (tx - cx) * .22; cy += (ty - cy) * .22; cursor.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(cursorLoop); }
if (!COARSE && !REDUCED) cursorLoop();

/* ---------------- magnetic buttons ---------------- */
if (!COARSE && !REDUCED) {
  for (const el of $$('[data-magnetic], [data-magnetic-soft]')) {
    const soft = el.hasAttribute('data-magnetic-soft'), inner = el.querySelector('span');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const s = soft ? .04 : .32;
      el.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
      if (inner && !soft) inner.style.transform = `translate(${dx * .12}px, ${dy * .12}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; if (inner) inner.style.transform = ''; });
  }
}

/* ---------------- scroll: progress, nav, scrubbed transforms ---------------- */
const nav = $('#nav');
const tilts = $$('[data-tilt], .fan, .shot-float');
let lastY = scrollY, ticking = false;
function onScroll() {
  ticking = false;
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  universe?.setScroll(clamp(y / Math.max(1, max)));
  nav.classList.toggle('solid', y > 40);
  nav.classList.toggle('away', y > 500 && y > lastY + 2);
  lastY = y;
  const vh = innerHeight;
  for (const el of tilts) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) continue;
    const p = el.classList.contains('fan') ? clamp((vh * .85 - r.top) / (vh * .55)) : clamp((vh - r.top) / (vh * .7));
    el.style.setProperty('--p', REDUCED ? 1 : p.toFixed(3));
  }
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', () => { onScroll(); applyScene(currentScene); });
onScroll();

// active section in the nav and the call stack
const navLinks = $$('.nav nav a'), stackLinks = $$('.stack a');
const sectionIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const id = e.target.id || 'top';
    stackLinks.forEach((a) => a.classList.toggle('on', a.dataset.stack === id));
    document.body.classList.toggle('demo-active', id === 'demo'); // the rail would sit on top of the live demo
    const group = ['playground', 'coach', 'photo', 'grading', 'notebook', 'progress', 'offline'].includes(id) ? 'playground' : id === 'why' ? '' : id;
    navLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + group));
  }
}, { rootMargin: '-48% 0px -48% 0px' });
[$('.hero'), ...$$('main > section[id]')].forEach((s) => { if (!s.id) s.id = 'top-hero'; sectionIO.observe(s); });
$('.hero').id = 'top-hero';
stackLinks[0].dataset.stack = 'top-hero';

/* ---------------- before / after ---------------- */
for (const box of $$('[data-compare]')) {
  const input = $('input', box);
  const set = () => box.style.setProperty('--x', input.value + '%');
  input.addEventListener('input', set); set();
  // a short nudge when it first appears, so people notice it can be dragged
  if (!REDUCED) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const f = (now) => { const p = clamp((now - t0) / 2200); input.value = 62 - Math.sin(p * Math.PI) * 30; set(); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }, { threshold: .5 });
    io.observe(box);
  }
}

/* ---------------- videos ---------------- */
const vidIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const v = e.target; if (v.dataset.userPaused) continue;
    if (e.isIntersecting && !REDUCED) v.play().catch(() => {}); else v.pause();
  }
}, { threshold: .35 });
function wireVideo(v) {
  if (REDUCED) v.controls = true;
  vidIO.observe(v);
  const btn = v.parentElement.querySelector('.vid-toggle');
  if (!btn) return;
  const sync = () => { btn.textContent = v.paused ? 'play' : 'pause'; btn.setAttribute('aria-label', v.paused ? 'Play video' : 'Pause video'); btn.classList.toggle('paused', v.paused); };
  btn.addEventListener('click', () => { if (v.paused) { delete v.dataset.userPaused; v.play().catch(() => {}); } else { v.dataset.userPaused = '1'; v.pause(); } });
  v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
}
$$('video.feature-video').forEach(wireVideo);

// Optional recordings: list a file in media/manifest.json and its slot fills in automatically.
fetch('media/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => {
  const have = new Set((m && m.recordings) || []);
  for (const slot of $$('[data-optional-media]')) {
    const src = slot.dataset.optionalMedia;
    if (!have.has(src.replace(/^media\//, ''))) continue;
    const v = document.createElement('video');
    Object.assign(v, { src, muted: true, loop: true, playsInline: true, preload: 'metadata' });
    v.className = 'feature-video'; if (slot.dataset.poster) v.poster = slot.dataset.poster;
    slot.prepend(v); slot.classList.add('filled');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vid-toggle mono'; b.textContent = 'pause'; slot.append(b);
    wireVideo(v);
  }
}).catch(() => {});

/* ---------------- lightbox ---------------- */
const lb = $('#lightbox'), lbImg = $('img', lb);
for (const fig of $$('[data-zoom]')) {
  fig.setAttribute('tabindex', '0'); fig.setAttribute('role', 'button');
  const img = $('img', fig);
  fig.setAttribute('aria-label', `Enlarge screenshot: ${img.alt}`);
  const open = () => { lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt; lb.showModal(); sfx.pop(); };
  fig.addEventListener('click', open);
  fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
}
lb.addEventListener('click', () => lb.close());

/* ---------------- languages ---------------- */
const langTabs = $$('.langs [role="tab"]'), langFig = $('.lang-shot'), langImg = $('#lang-img');
function pickLang(btn, focus = false) {
  langTabs.forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  if (focus) btn.focus();
  langFig.classList.add('swap');
  const next = new Image(); next.src = btn.dataset.shot;
  const swap = () => { langImg.src = btn.dataset.shot; langImg.alt = btn.dataset.alt; langFig.setAttribute('aria-label', `Enlarge screenshot: ${btn.dataset.alt}`); requestAnimationFrame(() => langFig.classList.remove('swap')); };
  next.complete ? setTimeout(swap, 180) : (next.onload = swap);
  sfx.glitch();
  if (currentScene?.id === 'languages') { applyScene(currentScene); if (!REDUCED) universe?.burst(); }
}
langTabs.forEach((b, i) => {
  b.tabIndex = i === 0 ? 0 : -1;
  b.addEventListener('click', () => pickLang(b));
  b.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); pickLang(langTabs[(i + d + langTabs.length) % langTabs.length], true); }
  });
});

/* ---------------- sound toggle ---------------- */
const soundBtn = $('.sound-toggle');
function showSound(onNow) {
  soundBtn.setAttribute('aria-pressed', onNow); soundBtn.setAttribute('aria-label', onNow ? 'Turn sound off' : 'Turn sound on');
  $('.sound-label', soundBtn).textContent = onNow ? 'sound on' : 'sound off';
}
soundBtn.addEventListener('click', async () => { await sfx.set(!sfx.on); showSound(sfx.on); });
// Browsers only allow sound after a click or key press, so a remembered "on" starts with the visitor's first interaction.
if (sfx.wanted()) {
  const resume = async () => { removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); if (!sfx.on) { await sfx.set(true); showSound(sfx.on); } };
  addEventListener('pointerdown', resume); addEventListener('keydown', resume);
}

/* ---------------- live demo ---------------- */
const DEMO = 'https://byterush.onrender.com';
for (const box of $$('[data-demo]')) {
  const body = $('.demo-body', box), status = $('.demo-status', box), start = $('[data-demo-start]', box);
  start.addEventListener('click', () => {
    if (body.querySelector('iframe')) return;
    body.classList.add('loading'); sfx.boot();
    const t0 = Date.now();
    const timer = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      status.textContent = s < 50 ? `Waking up the server… ${s}s` : `Almost there… ${s}s. Free servers can be slow to wake.`;
      if (s > 120) { clearInterval(timer); status.innerHTML = 'The server is taking too long. <a class="link-quiet" href="' + DEMO + '" target="_blank" rel="noopener">Open it in a new tab</a> instead.'; }
    }, 1000);
    const f = document.createElement('iframe');
    f.src = DEMO; f.title = 'ByteRush live demo'; f.loading = 'eager';
    f.allow = 'clipboard-read; clipboard-write';
    f.addEventListener('load', () => { clearInterval(timer); body.classList.remove('loading'); body.classList.add('ready'); sfx.success(); });
    body.prepend(f);
  });
}
