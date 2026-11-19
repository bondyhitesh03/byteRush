// ByteRush "byte universe": a WebGL particle field that assembles into shapes as you scroll.
// Hand-written WebGL (no libraries) so the site has no third-party runtime dependencies.

const ION = [0.22, 0.80, 1.0];    // cyan from the logo
const VOLT = [0.48, 0.36, 1.0];   // violet from the logo
const EMBER = [1.0, 0.69, 0.29];  // "code ran" amber

// ---------- tiny matrix helpers ----------
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
}
const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const scaleM = (s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);

// ---------- shape generators (each returns N points as a Float32Array of x,y,z) ----------
const rand = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const gauss = () => (rand() + rand() + rand() - 1.5) * 0.8;

function fromCanvas(draw, N, w, h, worldH, depth = 0.5, threshold = 120) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const data = g.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > threshold) pts.push(x, y);
  const out = new Float32Array(N * 3), worldW = worldH * (w / h);
  if (!pts.length) return out;
  for (let i = 0; i < N; i++) {
    const k = (Math.floor(rand() * (pts.length / 2))) * 2;
    out[i * 3] = ((pts[k] + rand() * 2) / w - 0.5) * worldW;
    out[i * 3 + 1] = -((pts[k + 1] + rand() * 2) / h - 0.5) * worldH;
    out[i * 3 + 2] = (rand() - 0.5) * depth;
  }
  return out;
}
function textShape(text, N, worldH = 4.2, font = '800 220px "JetBrains Mono", ui-monospace, monospace') {
  return fromCanvas((g, w, h) => {
    g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 220; while (g.measureText(text).width > w * 0.92 && size > 40) { size -= 10; g.font = font.replace(/\d+px/, size + 'px'); }
    g.fillText(text, w / 2, h / 2 + 8);
  }, N, 1024, 360, worldH * (360 / 300), 0.6);
}
function imageShape(img, N, worldH = 6.4) {
  return fromCanvas((g, w, h) => {
    const s = Math.min(w / img.width, h / img.height) * 0.98;
    g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  }, N, 420, 420, worldH, 0.9, 140);
}
function lens(N) {
  const o = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = rand(), a = rand() * Math.PI * 2; let r, z = 0;
    if (t < 0.45) { r = 3.4 + gauss() * 0.06; }                         // outer ring
    else if (t < 0.7) { r = 2.5 + gauss() * 0.05; }                     // inner ring
    else { const blade = Math.floor(rand() * 8), u = rand();             // aperture blades
      const b0 = blade * Math.PI / 4, ang = b0 + u * 0.9;
      r = 0.9 + u * 1.55; o[i * 3] = Math.cos(ang) * r; o[i * 3 + 1] = Math.sin(ang) * r; o[i * 3 + 2] = (rand() - 0.5) * 0.15; continue; }
    o[i * 3] = Math.cos(a) * r; o[i * 3 + 1] = Math.sin(a) * r; o[i * 3 + 2] = z + (rand() - 0.5) * 0.3;
  }
  return o;
}
function bars(N) { // the real grading formula: 70 correctness, 15 efficiency, 15 code quality
  const o = new Float32Array(N * 3), hs = [7.0, 1.5, 1.5], xs = [-2.2, 0, 2.2], total = 10;
  for (let i = 0; i < N; i++) {
    const r = rand() * total; const b = r < 7 ? 0 : r < 8.5 ? 1 : 2;
    const onEdge = rand() < 0.55;
    let x = (rand() - 0.5) * 1.5, y = rand() * hs[b], z = (rand() - 0.5) * 1.5;
    if (onEdge) { const e = Math.floor(rand() * 4); if (e === 0) x = -0.75; else if (e === 1) x = 0.75; else if (e === 2) z = -0.75; else z = 0.75; }
    o[i * 3] = xs[b] + x; o[i * 3 + 1] = y - 3.4; o[i * 3 + 2] = z;
  }
  return o;
}
function folders(N) {
  const o = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const layer = Math.floor(rand() * 3), w = 5.2, h = 3.4, u = rand();
    let x, y; const p = u * (2 * w + 2 * h + 2.2);
    if (p < w) { x = -w / 2 + p; y = -h / 2; }
    else if (p < w + h) { x = w / 2; y = -h / 2 + (p - w); }
    else if (p < 2 * w + h - 2.2) { x = w / 2 - (p - w - h); y = h / 2; }
    else if (p < 2 * w + 2 * h - 2.2) { x = -w / 2; y = h / 2 - (p - (2 * w + h - 2.2)); }
    else { const q = (p - (2 * w + 2 * h - 2.2)) / 2.2; x = -w / 2 + q * 2.2; y = h / 2 + 0.55 * Math.sin(Math.min(q, 1) * Math.PI); } // the tab
    if (rand() < 0.25) { x = (rand() - 0.5) * w * 0.9; y = (rand() - 0.5) * h * 0.9; } // a little fill
    o[i * 3] = x + layer * 0.55; o[i * 3 + 1] = y - layer * 0.5; o[i * 3 + 2] = -layer * 1.1 + (rand() - 0.5) * 0.1;
  }
  return o;
}
function tree(N) { // a skill tree: nodes joined by branches
  const nodes = [[0, 3.2], [-2.6, 1.0], [0, 1.0], [2.6, 1.0], [-3.4, -1.4], [-1.2, -1.4], [1.2, -1.4], [3.4, -1.4], [0, -3.5]];
  const edges = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6], [3, 7], [5, 8], [6, 8]];
  const o = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    if (rand() < 0.5) { const n = nodes[Math.floor(rand() * nodes.length)], a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.55;
      o[i * 3] = n[0] + Math.cos(a) * r; o[i * 3 + 1] = n[1] + Math.sin(a) * r; o[i * 3 + 2] = (rand() - 0.5) * 0.4; }
    else { const [a, b] = edges[Math.floor(rand() * edges.length)], t = rand();
      o[i * 3] = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * t + gauss() * 0.03; o[i * 3 + 1] = nodes[a][1] + (nodes[b][1] - nodes[a][1]) * t + gauss() * 0.03; o[i * 3 + 2] = (rand() - 0.5) * 0.2; }
  }
  return o;
}
function globe(N) { // a planet with a slice missing: offline
  const o = new Float32Array(N * 3); let i = 0;
  while (i < N) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = 3.5;
    if (a > 0.2 && a < 1.25) continue; // the missing wedge
    const s = Math.sqrt(1 - u * u); const grid = rand() < 0.6;
    let lat = Math.asin(u), lon = a;
    if (grid) { if (rand() < 0.5) lat = Math.round(lat / (Math.PI / 9)) * (Math.PI / 9); else lon = Math.round(lon / (Math.PI / 9)) * (Math.PI / 9); if (lon > 0.2 && lon < 1.25) continue; }
    o[i * 3] = Math.cos(lat) * Math.cos(lon) * r; o[i * 3 + 1] = Math.sin(lat) * r; o[i * 3 + 2] = Math.cos(lat) * Math.sin(lon) * r;
    i++; void s;
  }
  return o;
}
function funnel(N) { // particles pour downward: download
  const o = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = rand(), a = t * 26 + rand() * 0.3, r = 0.25 + t * 3.6;
    o[i * 3] = Math.cos(a) * r; o[i * 3 + 1] = t * 7 - 3.8; o[i * 3 + 2] = Math.sin(a) * r;
  }
  return o;
}
function field(N) {
  const o = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { o[i * 3] = (rand() - 0.5) * 30; o[i * 3 + 1] = (rand() - 0.5) * 18; o[i * 3 + 2] = (rand() - 0.5) * 16 - 3; }
  return o;
}
function shatter(src, N) { // the code "breaks": an error
  const o = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const k = i * 3, cell = Math.floor((src[k] + 8) / 1.3) * 7 + Math.floor((src[k + 1] + 8) / 1.3);
    const dx = Math.sin(cell * 12.9898) * 0.9, dy = Math.cos(cell * 78.233) * 0.7;
    o[k] = src[k] * 1.08 + dx; o[k + 1] = src[k + 1] * 1.08 + dy; o[k + 2] = src[k + 2] + Math.sin(cell) * 1.4;
  }
  return o;
}

// ---------- shaders ----------
const VS_POINTS = `
attribute vec3 aPos; attribute vec2 aSeed;
uniform mat4 uProj, uView; uniform float uTime, uSize, uDpr, uEmber;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 mv = uView * vec4(aPos, 1.0);
  gl_Position = uProj * mv;
  float depth = -mv.z;
  gl_PointSize = uSize * (0.55 + aSeed.x * 0.9) * uDpr * (18.0 / depth);
  vec3 c = mix(vec3(${ION}), vec3(${VOLT}), aSeed.y);
  c = mix(c, vec3(${EMBER}), uEmber * step(0.72, aSeed.x));
  vColor = c;
  vAlpha = (0.45 + 0.55 * sin(uTime * 1.6 + aSeed.x * 40.0) * 0.5 + 0.275) * smoothstep(40.0, 8.0, depth);
}`;
const FS_POINTS = `
precision mediump float; varying vec3 vColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5); float a = pow(smoothstep(0.5, 0.0, d), 1.7) * vAlpha; gl_FragColor = vec4(vColor * a, a); }`;
const VS_LINES = `
attribute vec3 aPos; uniform mat4 uProj, uView; varying float vDepth;
void main() { vec4 mv = uView * vec4(aPos, 1.0); vDepth = -mv.z; gl_Position = uProj * mv; }`;
const FS_LINES = `
precision mediump float; varying float vDepth; uniform float uAlpha; uniform vec3 uColor;
void main() { float a = uAlpha * smoothstep(46.0, 6.0, vDepth); gl_FragColor = vec4(uColor * a, a); }`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// ---------- the universe ----------
export function createUniverse(canvas, { logo, reducedMotion = false, small = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const N = small ? 5200 : 13000;
  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);

  const shapes = {};
  const make = (name, fn) => { if (!shapes[name]) shapes[name] = fn(); return shapes[name]; };
  const get = (name) => {
    if (name.startsWith('glyph:')) return make(name, () => textShape(name.slice(6), N));
    switch (name) {
      case 'logo': return make('logo', () => (logo ? imageShape(logo, N) : textShape('B', N, 6)));
      case 'brackets': return make('brackets', () => textShape('{ }', N, 5.2));
      case 'shatter': return make('shatter', () => shatter(get('brackets'), N));
      case 'lens': return make('lens', () => lens(N));
      case 'bars': return make('bars', () => bars(N));
      case 'folders': return make('folders', () => folders(N));
      case 'tree': return make('tree', () => tree(N));
      case 'globe': return make('globe', () => globe(N));
      case 'funnel': return make('funnel', () => funnel(N));
      default: return make('field', () => field(N));
    }
  };

  // particle state
  const pos = field(N), vel = new Float32Array(N * 3), seeds = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { pos[i * 3 + 2] -= 30 + rand() * 30; seeds[i * 2] = rand(); seeds[i * 2 + 1] = rand(); } // start far away: they rush in
  let target = get('logo');

  const pp = program(gl, VS_POINTS, FS_POINTS), lp = program(gl, VS_LINES, FS_LINES);
  const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
  const seedBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

  // wireframe: a floor grid and an orbit ring
  const grid = [];
  for (let x = -40; x <= 40; x += 2.5) grid.push(x, -6, -60, x, -6, 14);
  for (let z = -60; z <= 14; z += 2.5) grid.push(-40, -6, z, 40, -6, z);
  const gridBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW);
  const ring = []; const RS = 180;
  for (let i = 0; i < RS; i++) { if (i % 6 > 3) continue; const a0 = (i / RS) * Math.PI * 2, a1 = ((i + 1) / RS) * Math.PI * 2; ring.push(Math.cos(a0) * 5.6, 0, Math.sin(a0) * 5.6, Math.cos(a1) * 5.6, 0, Math.sin(a1) * 5.6); }
  const ringBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ringBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ring), gl.STATIC_DRAW);

  const U = (p, n) => gl.getUniformLocation(p, n);
  const uP = { proj: U(pp, 'uProj'), view: U(pp, 'uView'), time: U(pp, 'uTime'), size: U(pp, 'uSize'), dpr: U(pp, 'uDpr'), ember: U(pp, 'uEmber') };
  const uL = { proj: U(lp, 'uProj'), view: U(lp, 'uView'), alpha: U(lp, 'uAlpha'), color: U(lp, 'uColor') };
  const aP = { pos: gl.getAttribLocation(pp, 'aPos'), seed: gl.getAttribLocation(pp, 'aSeed') }, aL = gl.getAttribLocation(lp, 'aPos');

  // inputs (smoothed)
  const st = { scroll: 0, sScroll: 0, px: 0, py: 0, spx: 0, spy: 0, ox: 0, sox: 0, oy: 0, soy: 0, scale: 1, sScale: 1, ember: 0, sEmber: 0, spin: 0, facing: 1, sFacing: 1, w: 1, h: 1, pointerActive: false };

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    st.w = w; st.h = h; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize(); window.addEventListener('resize', resize);

  const FOV = 45 * Math.PI / 180;
  let last = performance.now(), t = 0, raf = 0, running = true;

  function step(dt) {
    const k = reducedMotion ? 1 : Math.min(1, dt * 60);
    // pointer in world units on the z=0 plane
    const camZ = 15 - Math.sin(st.sScroll * Math.PI) * 2.5;
    const halfH = Math.tan(FOV / 2) * camZ, halfW = halfH * (st.w / st.h);
    const mx = st.spx * halfW - st.sox, my = st.spy * halfH - st.soy;
    const stiff = 0.03 * k, damp = Math.pow(0.84, k);
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      let ax = (target[j] - pos[j]) * stiff, ay = (target[j + 1] - pos[j + 1]) * stiff, az = (target[j + 2] - pos[j + 2]) * stiff;
      if (st.pointerActive) {
        const dx = pos[j] - mx, dy = pos[j + 1] - my, d2 = dx * dx + dy * dy;
        if (d2 < 2.4) { const f = (2.4 - d2) * 0.012 * k; ax += dx * f; ay += dy * f; az += f * 2; }
      }
      const s = seeds[i * 2];
      ax += Math.sin(t * 0.7 + s * 50) * 0.0009 * k; ay += Math.cos(t * 0.6 + s * 31) * 0.0009 * k;
      vel[j] = vel[j] * damp + ax; vel[j + 1] = vel[j + 1] * damp + ay; vel[j + 2] = vel[j + 2] * damp + az;
      pos[j] += vel[j]; pos[j + 1] += vel[j + 1]; pos[j + 2] += vel[j + 2];
    }
    if (reducedMotion) pos.set(target);
  }

  function draw() {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const e = reducedMotion ? 1 : 1 - Math.pow(0.001, dt);
    st.sScroll += (st.scroll - st.sScroll) * e * 0.8; st.spx += (st.px - st.spx) * e; st.spy += (st.py - st.spy) * e;
    st.sox += (st.ox - st.sox) * e * 0.6; st.soy += (st.oy - st.soy) * e * 0.6; st.sScale += (st.scale - st.sScale) * e * 0.6; st.sEmber += (st.ember - st.sEmber) * e; st.sFacing += (st.facing - st.sFacing) * e * 0.5;
    if (!reducedMotion) st.spin += dt * 0.06;
    step(dt);

    const camZ = 15 - Math.sin(st.sScroll * Math.PI) * 2.5;
    const proj = perspective(FOV, st.w / st.h, 0.1, 100);
    // flat shapes sway toward the camera; round ones keep turning
    let cont = (st.spin + st.sScroll * 1.4) % (Math.PI * 2); if (cont > Math.PI) cont -= Math.PI * 2;
    const angle = cont * (1 - st.sFacing) + Math.sin(t * 0.3) * 0.42 * st.sFacing + st.spx * 0.35;
    const model = mul(translate(st.sox, st.soy, 0), mul(rotX(st.spy * 0.18 + 0.05), mul(rotY(angle), scaleM(st.sScale))));
    const view = mul(translate(0, -0.2 - st.sScroll * 0.6, -camZ), model);
    const worldView = mul(translate(0, -0.2 - st.sScroll * 0.6, -camZ), mul(rotX(0.08 + st.spy * 0.05), rotY(st.spx * 0.08)));

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // wireframe
    gl.useProgram(lp); gl.uniformMatrix4fv(uL.proj, false, proj);
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); gl.enableVertexAttribArray(aL); gl.vertexAttribPointer(aL, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(uL.view, false, mul(worldView, translate(0, 0, (t * 0.8) % 2.5))); gl.uniform1f(uL.alpha, 0.10); gl.uniform3fv(uL.color, VOLT);
    gl.drawArrays(gl.LINES, 0, grid.length / 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuf); gl.vertexAttribPointer(aL, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(uL.view, false, mul(view, rotX(1.2 + Math.sin(t * 0.3) * 0.08))); gl.uniform1f(uL.alpha, 0.22); gl.uniform3fv(uL.color, ION);
    gl.drawArrays(gl.LINES, 0, ring.length / 3);

    // particles
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pp);
    gl.uniformMatrix4fv(uP.proj, false, proj); gl.uniformMatrix4fv(uP.view, false, view);
    gl.uniform1f(uP.time, t); gl.uniform1f(uP.size, small ? 2.6 : 2.3); gl.uniform1f(uP.dpr, dpr); gl.uniform1f(uP.ember, st.sEmber);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.enableVertexAttribArray(aP.pos); gl.vertexAttribPointer(aP.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.enableVertexAttribArray(aP.seed); gl.vertexAttribPointer(aP.seed, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  function loop() { if (!running) return; draw(); raf = requestAnimationFrame(loop); }
  const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running) { running = true; last = performance.now(); loop(); } };
  document.addEventListener('visibilitychange', onVis);
  if (reducedMotion) { pos.set(target); draw(); } else loop();

  return {
    count: N,
    setShape(name, { x = 0, y = 0, scale = 1, ember = 0 } = {}) {
      target = get(name); st.ox = x; st.oy = y; st.scale = scale; st.ember = ember;
      st.facing = /^(globe|funnel|tree|field)$/.test(name) ? 0 : 1;
      if (reducedMotion) { pos.set(target); requestAnimationFrame(draw); }
    },
    setScroll(p) { st.scroll = p; if (reducedMotion) requestAnimationFrame(draw); },
    setPointer(x, y) { st.px = x; st.py = y; st.pointerActive = true; },
    clearPointer() { st.pointerActive = false; st.px *= 0.5; st.py *= 0.5; },
    burst() { for (let i = 0; i < N * 3; i++) vel[i] += (rand() - 0.5) * 0.35; },
    destroy() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); },
  };
}
