import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as P from './physics.js';
import { cite } from './citations.js';
import { DOLLARD } from './dollard.js';
import { THEME as T } from './theme.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const CM = 0.01; // scene unit = 1 cm
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
const HP = new URLSearchParams(location.hash.slice(1));
const OG = HP.get('og') === '1';
if (OG) document.body.classList.add('og');

// ---------- formatting ----------
function eng(v, unit, digits = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0 ' + unit;
  const pre = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  const a = Math.abs(v);
  for (const [f, p] of pre) if (a >= f * 0.9995) { let t = (v / f).toPrecision(digits); if (t.includes('e')) t = String(Number(t)); return t + ' ' + p + unit; }
  return v.toExponential(2) + ' ' + unit;
}
const fix = (v, d = 2) => (isFinite(v) ? v.toFixed(d) : '—');
function sci(v, d = 3) { if (!isFinite(v)) return '—'; if (v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); if (e >= -2 && e < 5) return v.toPrecision(d); return (v / 10 ** e).toPrecision(d) + '×10<sup>' + e + '</sup>'; }
const scroller = () => (isMobile() ? $('#sheetBody') : $('#readouts'));

// ---------- state ----------
const S = {
  view: 'magnetic', tab: 'energy',
  coil: { N: 200, a: 3 * CM, len: 8 * CM, I: 5, nDisp: 16 },
  magnet: { enabled: true, pos: [16 * CM, 0, 0], dir: [-1, 0, 0], b: 1.0 * CM, h: 4 * CM, Br: 1.0, nLoops: 8 },
  flow: !reducedMotion, cage: true,
  diel: { preset: 'fig9', V: 60e3, R: 1 * CM, conductors: [], equi: true, magOv: false, anim: !reducedMotion, phase: 0 },
  hyst: { eta: 0.0033, B: 10000, f: 60, vol: 1000, mat: 'sheet' },
  es: { L: 1e-3, C: 1e-6, I: 5, E: 1000, R: 2 },
  dollard: false,
};

// ---------- renderer / scene / bloom ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(T.bg, 1);
const scene = new THREE.Scene();
{ // radial vignette background (#0E131B centre → #07090D edge)
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 360); g.addColorStop(0, T.bgCenter); g.addColorStop(1, T.bg);
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
}
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.autoRotate = !reducedMotion && !OG; controls.autoRotateSpeed = 0.05; // 0.05 ≈ 0.3°/s at 60 fps
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(20, 40, 30); scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.35); rim.position.set(-30, 10, -30); scene.add(rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), T.bloom.strength, T.bloom.radius, T.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const magGroup = new THREE.Group(); scene.add(magGroup);
const dielGroup = new THREE.Group(); scene.add(dielGroup);

const lineMats = [];
function makeLineMat(opts) { const m = new LineMaterial({ linewidth: T.linePx, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...opts }); lineMats.push(m); return m; }
const matteSource = (hex) => new THREE.MeshStandardMaterial({ color: hex, metalness: 0.6, roughness: 0.75 });

function resize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); flowMat.size = FLOW_PX * dpr;
  composer.setPixelRatio(dpr); composer.setSize(w, h);
  const bs = isMobile() ? 0.5 : 1; bloom.setSize(w * dpr * bs, h * dpr * bs); // half-res bloom on phones
  camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const m of lineMats) { m.resolution.set(w, h); }
  layoutForViewport(); redrawCharts();
}
window.addEventListener('resize', resize);

// ======================= MAGNETIC VIEW =======================
const grid = new THREE.GridHelper(80, 40, T.grid, T.gridMinor); grid.position.y = -0.02; magGroup.add(grid);

let coilMesh = null;
const coilMat = matteSource(T.source);
function buildCoilMesh() {
  if (coilMesh) { magGroup.remove(coilMesh); coilMesh.geometry.dispose(); }
  const a = S.coil.a / CM, len = S.coil.len / CM;
  const turns = Math.max(2, Math.min(60, Math.round(S.coil.N / 5)));
  const pts = []; const nseg = turns * 48;
  for (let i = 0; i <= nseg; i++) { const t = i / nseg; const th = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(-len / 2 + len * t, a * Math.sin(th), a * Math.cos(th))); }
  const tubeR = Math.min(0.28, Math.max(0.08, len / turns * 0.38));
  coilMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), nseg, tubeR, 8, false), coilMat);
  magGroup.add(coilMesh);
}
const magnetObj = new THREE.Group();
function buildMagnetMesh() {
  magnetObj.clear();
  const b = S.magnet.b / CM, h = S.magnet.h / CM;
  const geo = new THREE.CylinderGeometry(b, b, h / 2, 40);
  const n = new THREE.Mesh(geo, matteSource(T.magnetN)), s = new THREE.Mesh(geo, matteSource(T.magnetS));
  n.position.y = h / 4; s.position.y = -h / 4;
  const label = (txt, y) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = T.txt; x.font = '600 44px Inter, system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 32, 34); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.set(1.3, 1.3, 1); sp.position.y = y; return sp; };
  magnetObj.add(n, s, label('N', h / 4), label('S', -h / 4));
  const halo = new THREE.Mesh(new THREE.RingGeometry(b * 1.6, b * 1.8, 48), new THREE.MeshBasicMaterial({ color: T.txt, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  halo.name = 'halo'; halo.rotation.x = Math.PI / 2; magnetObj.add(halo);
}
magGroup.add(magnetObj);
function placeMagnet() {
  const m = S.magnet; magnetObj.visible = m.enabled;
  magnetObj.position.set(m.pos[0] / CM, m.pos[1] / CM, m.pos[2] / CM);
  magnetObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...m.dir));
}

const magLinesMat = makeLineMat({ linewidth: T.linePx, opacity: 1 });
const magLinesMat3 = makeLineMat({ linewidth: T.linePxCage, opacity: 0.55 });
let magLines = null, magLines3 = null, flowPts = null, flowData = [];
// flow markers: round point sprites in the field colour with a soft radial falloff (core ≈ 3 px at DPR 1)
const flowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const FLOW_PX = 5; // sprite box in CSS px; the bright core is ~3 px
const flowMat = new THREE.PointsMaterial({ color: T.flow, map: flowTex, size: FLOW_PX, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const MAGC = new THREE.Color(T.mag), DIEC = new THREE.Color(T.die);
// brightness encodes strength: emissive 0.35 → 1.0 of the field colour (log scale)
function strengthColor(base, t) { const k = T.brightness[0] + (T.brightness[1] - T.brightness[0]) * Math.min(1, Math.max(0, t)); return base.clone().multiplyScalar(k); }
const tB = (b) => (Math.log10(b) + 4.3) / 3.0; // ~0.05 mT → 1 at ~50 mT
function setMagLines(lines) {
  for (const obj of [magLines, magLines3]) if (obj) { magGroup.remove(obj); obj.geometry.dispose(); }
  const build = (filter, mat) => {
    const pos = [], col = [];
    for (const L of lines) {
      if (!filter(L)) continue;
      const p = L.pts, m = L.mags;
      for (let i = 0; i + 1 < m.length; i++) {
        pos.push(p[i * 3] / CM, p[i * 3 + 1] / CM, p[i * 3 + 2] / CM, p[i * 3 + 3] / CM, p[i * 3 + 4] / CM, p[i * 3 + 5] / CM);
        const c1 = strengthColor(MAGC, tB(m[i])), c2 = strengthColor(MAGC, tB(m[i + 1]));
        col.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
      }
    }
    if (!pos.length) return null;
    const g = new LineSegmentsGeometry(); g.setPositions(pos); g.setColors(col);
    const o = new LineSegments2(g, mat); o.computeLineDistances(); return o;
  };
  magLines = build(L => L.plane === 0, magLinesMat); if (magLines) magGroup.add(magLines);
  magLines3 = build(L => L.plane === 1, magLinesMat3); if (magLines3) { magLines3.visible = S.cage; magGroup.add(magLines3); }
  window.__magLineCount = lines.length;
  flowData = [];
  for (const L of lines) {
    if (L.plane !== 0 && !S.cage) continue;
    const p = L.pts, m = L.mags, n = p.length / 3; if (n < 4) continue;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2], p[i * 3 + 2] - p[i * 3 - 1]) / CM);
    const total = cum[n - 1]; const k = Math.max(1, Math.floor(total / 7));
    for (let j = 0; j < k; j++) flowData.push({ p, m, cum, total, s: (j / k) * total, closed: L.closed });
  }
  if (flowPts) { magGroup.remove(flowPts); flowPts.geometry.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flowData.length * 3), 3));
  flowPts = new THREE.Points(g, flowMat); flowPts.visible = S.flow; magGroup.add(flowPts);
  stepFlow(0);
}
function stepFlow(dt) {
  if (!flowPts) return;
  const arr = flowPts.geometry.attributes.position.array;
  const dir = S.coil.I < 0 && !S.magnet.enabled ? -1 : 1; // lines are traced along +B already
  flowData.forEach((f, i) => {
    let lo = 0, hi = f.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (f.cum[mid] < f.s) lo = mid; else hi = mid; }
    const strength = Math.min(1, Math.max(0.15, tB(f.m[lo] || 1e-5)));
    f.s += dir * 4 * strength * dt; // cm/s, slower where the field is weak
    if (f.closed) f.s = ((f.s % f.total) + f.total) % f.total; else if (f.s > f.total) f.s -= f.total; else if (f.s < 0) f.s += f.total;
    const t = (f.s - f.cum[lo]) / Math.max(1e-9, f.cum[hi] - f.cum[lo]);
    for (let k = 0; k < 3; k++) arr[i * 3 + k] = (f.p[lo * 3 + k] + Math.min(1, Math.max(0, t)) * (f.p[hi * 3 + k] - f.p[lo * 3 + k])) / CM;
  });
  flowPts.geometry.attributes.position.needsUpdate = true;
}

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let reqId = 0, busy = false, pending = null, lastShown = 0;
function requestLines(quality = 'full') {
  const msg = { coil: { ...S.coil }, magnet: { ...S.magnet, pos: S.magnet.pos.slice(), dir: S.magnet.dir.slice() }, quality, mobile: isMobile() };
  if (busy) { pending = msg; return; }
  busy = true; msg.id = ++reqId; worker.postMessage(msg); $('#loading').classList.add('on');
}
worker.onmessage = (ev) => {
  busy = false;
  if (ev.data.id > lastShown) { lastShown = ev.data.id; setMagLines(ev.data.lines); window.__lastTraceMs = ev.data.ms; }
  if (pending) { const m = pending; pending = null; busy = true; m.id = ++reqId; worker.postMessage(m); }
  else { $('#loading').classList.remove('on'); window.__fieldReady = true; }
};

let emfHist = [], lastLam = null, lastLamT = 0, emfNow = 0, coilL = 0;
function magnetLoopsOnly() { return P.buildLoops({ ...S.coil, I: 0, nDisp: 1 }, S.magnet).filter(l => l.kind === 'magnet'); }
function magnetLinkageNow() { return S.magnet.enabled ? P.magnetLinkage(S.coil, magnetLoopsOnly(), 7) : 0; }
function sampleEmf() {
  const now = performance.now() / 1000, lam = magnetLinkageNow();
  if (lastLam !== null) { const dt = now - lastLamT; if (dt > 0.012) { const e = -(lam - lastLam) / dt; emfNow = 0.6 * emfNow + 0.4 * e; lastLam = lam; lastLamT = now; } }
  else { lastLam = lam; lastLamT = now; }
}

const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragging = null; const dragOff = new THREE.Vector3();
function setNdc(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
function hitPlane(pl) { const p = new THREE.Vector3(); return ray.ray.intersectPlane(pl, p) ? p : null; }

// ======================= DIELECTRIC VIEW =======================
const dielPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dielGrid = new THREE.GridHelper(110, 55, T.dielGrid, T.dielGrid); dielGrid.material.transparent = true; dielGrid.material.opacity = T.dielGridOpacity; dielGrid.material.depthWrite = false; dielGrid.rotation.x = Math.PI / 2; dielGrid.position.z = -0.04; dielGroup.add(dielGrid);
const condGroup = new THREE.Group(); dielGroup.add(condGroup);
const dieMat = makeLineMat({ linewidth: T.linePx, dashed: true, dashSize: 1.1, gapSize: 0.55, opacity: 1 });
const dieMatGhost = makeLineMat({ linewidth: T.linePxCage, dashed: true, dashSize: 1.1, gapSize: 0.55, opacity: 0.16 });
const equiMat = makeLineMat({ linewidth: 1.2, opacity: T.equiOpacity, blending: THREE.NormalBlending });
const equiMidMat = makeLineMat({ linewidth: 1.0, opacity: T.equiMidOpacity, blending: THREE.NormalBlending });
const magOvMat = makeLineMat({ linewidth: 2, opacity: 0.9 });
let dieObjs = [], dielSol = null;

function presetConductors(name) {
  const R = S.diel.R, V = S.diel.V;
  if (name === 'fig8') return [{ x: 0, y: 0, R, V: V / 2 }, { x: 40, y: 0, R, V: -V / 2, hidden: true }];
  if (name === 'three') { const r = 9 * CM; return [0, 1, 2].map(k => ({ x: r * Math.cos(Math.PI / 2 + k * 2 * Math.PI / 3), y: r * Math.sin(Math.PI / 2 + k * 2 * Math.PI / 3) - 2 * CM, R, V: 0, phaseK: k })); }
  return [{ x: -7 * CM, y: 0, R, V: V / 2 }, { x: 7 * CM, y: 0, R, V: -V / 2 }];
}
function applyVoltages() {
  const d = S.diel;
  if (d.preset === 'three') { const amp = d.V / Math.sqrt(3); d.conductors.forEach(c => { c.V = amp * Math.cos(d.phase - c.phaseK * 2 * Math.PI / 3); }); }
  else { d.conductors[0].V = d.V / 2; d.conductors[1].V = -d.V / 2; }
  d.conductors.forEach(c => { c.R = d.R; });
}
function buildCondMeshes() {
  condGroup.clear();
  S.diel.conductors.forEach((c, i) => {
    if (c.hidden) return;
    const R = c.R / CM;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 60, 40, 1, false), matteSource(T.source));
    m.rotation.x = Math.PI / 2; m.position.set(c.x / CM, c.y / CM, -28); m.userData.idx = i; m.name = 'cond';
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshBasicMaterial({ color: T.die }));
    cap.position.set(c.x / CM, c.y / CM, 2.01); cap.userData.idx = i; cap.name = 'cap';
    const lc = document.createElement('canvas'); lc.width = lc.height = 64; const lx = lc.getContext('2d');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), depthTest: false, transparent: true }));
    sp.scale.set(2.2, 2.2, 1); sp.position.set(c.x / CM, c.y / CM, 2.4); sp.userData = { idx: i, lc, lx }; sp.name = 'sign';
    condGroup.add(m, cap, sp);
  });
  updateCondColors();
}
function updateCondColors() {
  const Vmax = Math.max(1, ...S.diel.conductors.map(c => Math.abs(c.V)));
  condGroup.children.forEach(o => {
    const c = S.diel.conductors[o.userData.idx]; if (!c) return; const t = c.V / Vmax;
    if (o.name === 'cap') o.material.color.set(t >= 0 ? T.die : T.dim).multiplyScalar(0.35 + 0.65 * Math.abs(t));
    if (o.name === 'sign') { const { lc, lx } = o.userData; lx.clearRect(0, 0, 64, 64); lx.fillStyle = T.bg; lx.font = '700 46px Inter, system-ui'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText(Math.abs(t) < 0.05 ? '' : t > 0 ? '+' : '−', 32, 34); o.material.map.needsUpdate = true; }
  });
}
const Q_PER_LINE = { v: null };
function solveAndDrawDiel() {
  const d = S.diel;
  applyVoltages();
  const sol = P.solveDielectric(d.conductors, 36, 0.6); dielSol = sol;
  const targetDefault = isMobile() ? 18 : 30; const cap = isMobile() ? 24 : 48;
  const ref = P.solveDielectric([{ x: -7 * CM, y: 0, R: CM, V: 30e3 }, { x: 7 * CM, y: 0, R: CM, V: -30e3 }]);
  Q_PER_LINE.v = ref.Q[0] / targetDefault;
  dieObjs.forEach(o => { dielGroup.remove(o); o.geometry.dispose(); }); dieObjs = [];
  const E = [0, 0];
  const f = (p, out) => { P.efield2D(sol, p[0], p[1], E); out[0] = E[0]; out[1] = E[1]; out[2] = 0; return out; };
  const pos = []; let total = 0;
  d.conductors.forEach((c, i) => {
    if (sol.Q[i] <= 0) return;
    const n = Math.min(cap, Math.round(sol.Q[i] / Q_PER_LINE.v)); total += n;
    for (const s of P.dielectricSeeds(sol, i, n)) {
      const tr = P.traceLine(f, [s[0], s[1], 0], +1, { step: 0.0018, maxSteps: 900, bound: 0.9, stop: (p) => P.insideConductor(sol, p[0], p[1]) >= 0 });
      const pts = tr.pts;
      for (let k = 0; k + 1 < pts.length; k++) pos.push(pts[k][0] / CM, pts[k][1] / CM, 0.05, pts[k + 1][0] / CM, pts[k + 1][1] / CM, 0.05);
    }
  });
  window.__dieLines = total;
  const mk = (positions, mat, z, colorFn) => {
    if (!positions.length) return null;
    const arr = positions.slice(); for (let i = 2; i < arr.length; i += 3) arr[i] = z;
    const g = new LineSegmentsGeometry(); g.setPositions(arr);
    const col = []; for (let i = 0; i < arr.length / 3; i++) { const c = colorFn(arr[i * 3], arr[i * 3 + 1]); col.push(c.r, c.g, c.b); }
    g.setColors(col);
    const o = new LineSegments2(g, mat); o.computeLineDistances(); dielGroup.add(o); dieObjs.push(o); return o;
  };
  const dieColor = (x, y) => { P.efield2D(sol, x * CM, y * CM, E); return strengthColor(DIEC, (Math.log10(Math.hypot(E[0], E[1])) - 4.5) / 2.0); };
  mk(pos, dieMat, 0.05, dieColor);
  for (const z of [-12, -24, -36]) mk(pos, dieMatGhost, z, dieColor);
  const nx = 170, ny = 110, x0 = -55 * CM, y0 = -35 * CM, dx = 110 * CM / (nx - 1), dy = 70 * CM / (ny - 1);
  const gridV = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * dx, y = y0 + j * dy; gridV[j * nx + i] = P.insideConductor(sol, x, y) >= 0 ? NaN : P.potential2D(sol, x, y); }
  const Vs = d.conductors.map(c => c.V); const vmin = Math.min(...Vs), vmax = Math.max(...Vs);
  const twoWire = d.preset !== 'three';
  $('#lblMagOverlay').style.opacity = twoWire ? 1 : 0.4; $('#cMagOv').disabled = !twoWire;
  const showMag = twoWire && d.magOv;
  if ((d.equi || showMag) && vmax > vmin) {
    const segs = [], mid = []; const nl = showMag ? 14 : 12;
    for (let k = 1; k < nl; k++) {
      const lev = vmin + (vmax - vmin) * k / nl;
      // the straight zero-potential midline reads as a UI axis; it is drawn fainter (design review 1, item 7)
      const tgt = (!showMag && Math.abs(lev) < 1e-9 * (vmax - vmin)) ? mid : segs;
      for (const s of P.contourSegments(gridV, nx, ny, x0, y0, dx, dy, lev)) tgt.push(s[0] / CM, s[1] / CM, 0.03, s[2] / CM, s[3] / CM, 0.03);
    }
    if (showMag) mk(segs, magOvMat, 0.04, () => MAGC.clone().multiplyScalar(0.8));
    else { mk(segs, equiMat, 0.03, () => new THREE.Color(T.equi)); mk(mid, equiMidMat, 0.03, () => new THREE.Color(T.equi)); }
  }
  updateCondColors(); updateCards();
}

// ======================= CHARTS =======================
const CHART_SCALE = 2; // canvas pixels per CSS pixel (crisp on retina, fonts set in canvas px)
function prepChart(sel) {
  const cv = $(sel); if (!cv) return null;
  const r = cv.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return null;
  const W = Math.round(r.width * CHART_SCALE), H = Math.round(r.height * CHART_SCALE);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const x = cv.getContext('2d'); x.clearRect(0, 0, W, H); x.font = `${T.chartFontWeight} ${T.chartFontPx * CHART_SCALE}px ${T.chartFontFamily}`; x.lineCap = 'round';
  return { x, w: W, h: H, cv };
}
function drawEmfChart() {
  const c0 = prepChart('#chart1'); if (!c0) return; const { x, w, h } = c0;
  x.strokeStyle = T.chartAxis; x.lineWidth = 2; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
  const maxV = Math.max(1e-3, ...emfHist.map(Math.abs));
  x.strokeStyle = T.mag; x.lineWidth = 4; x.beginPath();
  emfHist.forEach((v, i) => { const X = (i / 299) * w, Y = h / 2 - (v / maxV) * (h / 2 - 16); i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
  x.stroke();
  x.fillStyle = T.chartText; x.fillText('±' + eng(maxV, 'V', 2), 10, 28); const s = 'e = −n·dΦ/dt · last 10 s'; x.fillText(s, w - x.measureText(s).width - 10, h - 10);
}
function drawCapChart() {
  const c0 = prepChart('#chart1'); if (!c0) return; const { x, w, h } = c0;
  const r = S.diel.R; const smin = 2.05 * r, smax = 60 * CM;
  const xs = (s) => 50 + (Math.log(s / smin) / Math.log(smax / smin)) * (w - 64);
  const cmax = P.exactLineC(smin, r);
  const ys = (c) => h - 34 - (c / cmax) * (h - 70);
  x.strokeStyle = T.chartAxis; x.lineWidth = 2; x.beginPath(); x.moveTo(50, 12); x.lineTo(50, h - 34); x.lineTo(w - 10, h - 34); x.stroke();
  const plot = (fn, col, dash) => { x.strokeStyle = col; x.setLineDash(dash); x.lineWidth = 4; x.beginPath(); for (let i = 0; i <= 120; i++) { const s = smin * Math.pow(smax / smin, i / 120); const c = Math.min(cmax * 1.05, fn(s)); i ? x.lineTo(xs(s), ys(c)) : x.moveTo(xs(s), ys(c)); } x.stroke(); x.setLineDash([]); };
  plot(s => P.exactLineC(s, r), T.die, []);
  plot(s => P.steinmetzLineC(s, r), T.txt, [8, 8]);
  if (S.diel.preset !== 'three') { const a = S.diel.conductors[0], b = S.diel.conductors[1]; const s = Math.hypot(a.x - b.x, a.y - b.y); x.fillStyle = T.die; x.beginPath(); x.arc(xs(s), ys(P.exactLineC(s, r)), 8, 0, 7); x.fill(); }
  x.fillStyle = T.chartText; x.fillText('C', 14, 30); const sl = 'spacing s (log) →'; x.fillText(sl, w - x.measureText(sl).width - 10, h - 6);
  x.textAlign = 'right'; x.fillStyle = T.txt; const lg = '-- Steinmetz (38)'; x.fillText(lg, w - 12, 30); x.fillStyle = T.die; x.fillText('exact  ', w - 12 - x.measureText(lg).width, 30); x.textAlign = 'left';
}
function drawChart1() { if (S.view === 'magnetic') drawEmfChart(); else drawCapChart(); }
function redrawCharts() { drawChart1(); drawExchange(); drawHystChart(); drawBH(); }

// ======================= READOUT CARDS =======================
const prevVals = {};
const openCards = new Set(); // phone: cards expanded by a tap (survive the 0.3 s re-render)
function card(o) {
  const open = openCards.has(S.view + o.k) ? ' open' : '';
  return `<div class="card-ro ${o.cls || ''} ${o.dl ? 'dl-on' : ''}${open}" data-k="${o.k}" role="button" tabindex="0" aria-expanded="${!!open}"><div class="lbl">${o.label}</div><div class="val">${o.val}</div><div class="fx">${o.fx}</div><div class="more">${o.sub ? `<div class="sub">${o.sub}</div>` : ''}${o.dl ? `<div class="dl">${o.dl}</div>` : ''}${o.cite || ''}</div></div>`;
}
function magCards() {
  const c = S.coil;
  const rw = Math.min(0.0015, c.len / c.N / 2.2);
  coilL = P.coilInductance(c.N, c.a, c.len, rw); window.__coilL = coilL;
  const Bt = P.fieldAt(P.buildLoops(c, S.magnet), [0, 0, 0], [0, 0, 0]); const Bm = Math.hypot(...Bt);
  const lam = magnetLinkageNow();
  return [
    { k: 'B', cls: 'mag', label: 'Field at coil centre', val: eng(Bm, 'T'), fx: 'ℋ = 4π·f/10 → B = μ·ℋ', sub: `= ${fix(Bm * 1e4, 1)} gauss (lines/cm²) · coil + magnet, Biot–Savart`, cite: cite('EL', 14, 'eq. (14)') },
    { k: 'L', cls: 'mag', label: 'Inductance of the coil', val: eng(coilL, 'H'), fx: 'Φ = L·i  (L = n·Φ/i)', sub: `n = ${c.N} turns, from geometry`, cite: cite('EL', 11, 'eq. (1)'), dl: 'Dollard: “energy storage in space as a magnetic field” (p. 7)' },
    { k: 'W', cls: 'mag', label: 'Magnetic energy', val: eng(0.5 * coilL * c.I * c.I, 'J'), fx: 'w = L·i²/2', sub: `i = ${fix(c.I, 1)} A`, cite: cite('EL', 12, 'eq. (5)'), dl: 'Dollard: lines “stretched … as in a rubber band” (p. 7)' },
    { k: 'E', cls: 'mag', label: 'Induced voltage (drag the magnet)', val: eng(emfNow, 'V'), fx: 'e′ = n·dΦ/dt · 10⁻⁸ V', sub: `magnet flux linked n·Φ = ${eng(lam, 'Wb')}`, cite: cite('EL', 17, 'Table I') },
    { k: 'F', cls: 'mag', label: 'Magnetomotive force', val: `${fix(c.N * c.I, 0)} A·turns`, fx: 'F = n·i', cite: cite('EL', 14, 'eq. (12)') },
  ];
}
function dielCards() {
  const d = S.diel, sol = dielSol; if (!sol) return [];
  const Wp = 0.5 * d.conductors.reduce((s, c, i) => s + sol.Q[i] * c.V, 0);
  const gmax = Math.max(...d.conductors.map((c, i) => c.hidden ? 0 : P.maxSurfaceField(sol, i)));
  const gCard = { k: 'G', cls: 'die', label: 'Max. voltage gradient at a wire', val: `${fix(gmax / 1e5, 1)} kV/cm`, fx: 'G = e/l  (volts per cm)', sub: gmax > 30e5 ? '⚠ above ~30 kV/cm air would break down (corona); not modelled' : 'air breaks down near ~30 kV/cm', cite: cite('EL', 17, 'Table I') };
  if (d.preset === 'three') {
    return [
      { k: 'ph', cls: 'die', label: 'Phase angle (slow motion)', val: `${fix(((d.phase * 180 / Math.PI) % 360 + 360) % 360, 0)}°`, fx: 'e_k = e·cos(ωt − k·120°)/√3', sub: d.conductors.map((c, i) => `${'ABC'[i]} ${eng(c.V, 'V', 2)}`).join(' · ') },
      { k: 'W', cls: 'die', label: 'Dielectric energy, per metre', val: eng(Wp, 'J/m'), fx: 'w = Σ Ψ·e/2', cite: cite('EL', 13, 'eq. (11)'), dl: 'Dollard: energy “forced or compressed inwards” (p. 11)' },
      gCard,
    ];
  }
  const a = d.conductors[0], b = d.conductors[1];
  const s = Math.hypot(a.x - b.x, a.y - b.y), r = d.R;
  const Cn = 2 * sol.Q[0] / (a.V - b.V);
  const L1 = 2e-7 * Math.log(s / r);
  return [
    { k: 'C', cls: 'die', label: 'Capacity to neutral, per metre', val: eng(Cn, 'F/m'), fx: 'C = 10⁹ / (2v²·ln s/r) F/cm', sub: `Steinmetz ${eng(P.steinmetzLineC(s, r), 'F/m')} · exact ${eng(P.exactLineC(s, r), 'F/m')} · s/r = ${fix(s / r, 1)}`, cite: cite('EL', 129, 'eq. (38)') },
    { k: 'Psi', cls: 'die', label: 'Dielectric flux Ψ, per metre', val: eng(sol.Q[0], 'C/m'), fx: 'Ψ = C·e', sub: `e = ${eng(a.V - b.V, 'V')} · ${window.__dieLines} lines drawn`, cite: cite('EL', 12, 'eq. (6)'), dl: 'Dollard: “Voltage is to dielectricity as current is to magnetism” (p. 11)' },
    { k: 'W', cls: 'die', label: 'Dielectric energy, per metre', val: eng(Wp, 'J/m'), fx: 'w = C·e²/2', cite: cite('EL', 13, 'eq. (11)'), dl: 'Dollard: energy “forced or compressed inwards” (p. 11)' },
    gCard,
    { k: 'v', cls: '', label: 'Speed fixed by L₁ and C', val: eng(1 / Math.sqrt(L1 * P.steinmetzLineC(s, r)), 'm/s', 4), fx: 'C·L₁ = 1/v²', sub: `L per wire ${eng(P.steinmetzLineL(s, r), 'H/m')} (eq. 14, p. 123)`, cite: cite('EL', 129, 'eq. (39)') },
  ];
}
function updateCards() {
  const list = S.view === 'magnetic' ? magCards() : dielCards();
  const box = $('#roCards'); if (!box) return;
  box.innerHTML = list.map(card).join('');
  list.forEach(o => {
    const key = S.view + o.k;
    if (prevVals[key] !== undefined && prevVals[key] !== o.val) {
      const el = box.querySelector(`[data-k="${o.k}"] .val`); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 150); }
    }
    prevVals[key] = o.val;
  });
  if (S.view === 'dielectric' && dielSol) $('#dielNote').innerHTML = `Field-solver check: largest error in a wire's potential is ${eng(dielSol.maxErr, 'V', 2)}.`;
  if (S.view === 'dielectric') drawCapChart();
}

// ======================= FORMULA PANELS =======================
function fbox(cls, eq, what, c, val = '') { return `<div class="f ${cls}"><div class="eq">${eq}${val ? `<span class="val">${val}</span>` : ''}</div><div class="what">${what}</div>${c}</div>`; }

function renderEnergyTab() {
  const e = S.es;
  const Wm = 0.5 * e.L * e.I * e.I, Wd = 0.5 * e.C * e.E * e.E;
  const z0 = Math.sqrt(e.L / e.C), f0 = 1 / (2 * Math.PI * Math.sqrt(e.L * e.C));
  $('#tabEnergy').innerHTML = `
  <blockquote>“The magnetic field and the electrostatic or ‘dielectric’ field represent stored energy.” ${cite('EL', 3)}</blockquote>
  <blockquote>“It may thus be said that the permanent phenomena are the phenomena of electric power, the transients the phenomena of electric energy.” ${cite('EL', 4)}</blockquote>
  <blockquote>“…the three circuit constants <i>r</i>, <i>L</i>, <i>C</i> therefore appear as the components of the energy conversion into heat, magnetism, and electric stress, respectively.” ${cite('TR', 8)}</blockquote>
  <div class="grid2">
   <div class="ctl"><label>L <b>${eng(e.L, 'H')}</b></label><input id="esL" type="range" min="-6" max="1" step="0.01" value="${Math.log10(e.L)}"></div>
   <div class="ctl"><label>C <b>${eng(e.C, 'F')}</b></label><input id="esC" type="range" min="-12" max="-3" step="0.01" value="${Math.log10(e.C)}"></div>
   <div class="ctl"><label>current i <b>${fix(e.I, 1)} A</b></label><input id="esI" type="range" min="0" max="50" step="0.1" value="${e.I}"></div>
   <div class="ctl"><label>voltage e <b>${eng(e.E, 'V')}</b></label><input id="esE" type="range" min="0" max="5" step="0.01" value="${Math.log10(Math.max(1, e.E))}"></div>
  </div>
  <div class="row" style="display:flex;gap:6px;flex-wrap:wrap"><button class="mini" id="useCoilL">use the coil's L (magnetic view)</button><button class="mini" id="useLineC">use 1 km of the two-wire line</button></div>
  ${fbox('mag', 'Φ = <i>L i</i>', 'Magnetic flux is proportional to current; the factor is the inductance.', cite('EL', 11, 'eq. (1)') + ' · ' + cite('TR', 5, 'eq. (2)'))}
  ${fbox('mag', '<i>w</i> = <i>L i</i>²/2', 'Energy stored in the magnetic field.', cite('EL', 12, 'eq. (5)') + ' · ' + cite('TR', 7, 'eq. (9)'), eng(Wm, 'J'))}
  ${fbox('die', 'Ψ = <i>C e</i>', 'Dielectric flux is proportional to voltage; the factor is the capacity.', cite('EL', 12, 'eq. (6)') + ' · ' + cite('TR', 5, 'eq. (3)'))}
  ${fbox('die', '<i>w</i> = <i>C e</i>²/2', 'Energy stored in the dielectric field.', cite('EL', 13, 'eq. (11)') + ' · ' + cite('TR', 7, 'eq. (14)'), eng(Wd, 'J'))}
  <h3>Exchange between the two stores <span class="small">(double-energy transient)</span></h3>
  ${fbox('', '<i>W</i> = <i>L i</i>²/2 + <i>C e</i>²/2', 'Total stored energy; it can move from one store to the other while dissipation reduces it.', cite('EL', 60, 'eq. (7)'))}
  ${fbox('', '<i>z</i>₀ = √(<i>L</i>/<i>C</i>)', '“Natural impedance, or the surge impedance”: ratio of peak voltage to peak current in the exchange.', cite('EL', 61, 'eq. (9)'), eng(z0, 'Ω'))}
  ${fbox('', '<i>f</i> = 1 / (2π√(<i>LC</i>))', 'Frequency of the exchange between magnetic and dielectric energy.', cite('EL', 66, 'eq. (19)'), eng(f0, 'Hz'))}
  <div class="ctl"><label>resistance r (dissipation) <b>${fix(e.R, 2)} Ω</b></label><input id="esR" type="range" min="0" max="${Math.max(1, 2 * z0).toPrecision(3)}" step="${(Math.max(1, 2 * z0) / 400).toPrecision(2)}" value="${Math.min(e.R, 2 * z0)}"></div>
  <p class="note">The <b>Energy exchange</b> chart under the field view shows this circuit: capacitor charged to <i>e</i>, no current at the start. <span class="die">■ dielectric</span> <span class="mag">■ magnetic</span> — total. Time axis in periods of <i>f</i>.</p>
  <div class="plain"><b>Plain note:</b> nothing here is a source of energy. The two fields store energy that the circuit has supplied, pass it back and forth, and lose it to resistance as heat. The total never rises above what was put in. That holds with the interpretation toggle on, too.</div>`;
  const bind = (id, fn) => { const el = $('#' + id); el && el.addEventListener('input', () => { fn(parseFloat(el.value)); renderEnergyTabLight(); }); };
  bind('esL', v => S.es.L = 10 ** v); bind('esC', v => S.es.C = 10 ** v); bind('esI', v => S.es.I = v); bind('esE', v => S.es.E = 10 ** v); bind('esR', v => S.es.R = v);
  $('#useCoilL').onclick = () => { S.es.L = coilL; renderEnergyTab(); };
  $('#useLineC').onclick = () => {
    if (S.diel.preset === 'three') return;
    const a = S.diel.conductors[0], b = S.diel.conductors[1]; const s = Math.hypot(a.x - b.x, a.y - b.y);
    S.es.C = P.exactLineC(s, S.diel.R) / 2 * 1000; S.es.L = 2 * P.steinmetzLineL(s, S.diel.R) * 1000; S.es.E = S.diel.V; renderEnergyTab();
  };
  drawExchange(); updateCards();
}
let energyRAF = 0;
function renderEnergyTabLight() { cancelAnimationFrame(energyRAF); energyRAF = requestAnimationFrame(() => { const sc = scroller(), y = sc.scrollTop; renderEnergyTab(); sc.scrollTop = y; }); }
function drawExchange() {
  const c0 = prepChart('#exChart'); if (!c0) return; const { x, w, h } = c0;
  const { L, C, E, R } = S.es;
  // series RLC, initial e(0)=E, i(0)=0: integrate exactly with small steps (RK4)
  const w0 = 1 / Math.sqrt(L * C), Tp = 2 * Math.PI / w0, tEnd = 4 * Tp, n = 800, dt = tEnd / n;
  let q = C * E, i = 0; const W0 = 0.5 * C * E * E || 1;
  const d = (q, i) => [i, -(q / C + R * i) / L];
  const pts = [];
  for (let k = 0; k <= n; k++) {
    pts.push([k * dt / Tp, 0.5 * L * i * i / W0, 0.5 * q * q / C / W0]);
    const a1 = d(q, i), a2 = d(q + 0.5 * dt * a1[0], i + 0.5 * dt * a1[1]), a3 = d(q + 0.5 * dt * a2[0], i + 0.5 * dt * a2[1]), a4 = d(q + dt * a3[0], i + dt * a3[1]);
    q += dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); i += dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
  }
  const X = t => 30 + t / 4 * (w - 40), Y = v => h - 26 - v * (h - 40);
  x.strokeStyle = T.chartAxis; x.beginPath(); x.moveTo(30, 10); x.lineTo(30, h - 22); x.lineTo(w - 10, h - 22); x.stroke();
  const line = (idx, col, lw) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); pts.forEach((p, k) => { const v = idx === 3 ? p[1] + p[2] : p[idx]; k ? x.lineTo(X(p[0]), Y(v)) : x.moveTo(X(p[0]), Y(v)); }); x.stroke(); };
  line(2, T.die, 2.5); line(1, T.mag, 2.5); line(3, T.white, 1.5);
  x.fillStyle = T.chartText; x.font = T.chartFont; x.fillText('W/W₀', 34, 24); [1, 2, 3, 4].forEach(k => x.fillText(String(k), X(k) - 8, h - 2));
}

const MATS = {
  sheet: { name: 'Annealed sheet iron / sheet steel (“fair mean”)', eta: 0.0033 },
  sheetlo: { name: 'Best sheet iron in his tests (low end)', eta: 0.00124 },
  silicon: { name: 'Silicon steel sample (1917, Fig. 33)', eta: 0.000824 },
  cast: { name: 'Gray cast iron (average)', eta: 0.013 },
  magnetite: { name: 'Magnetite', eta: 0.023 },
  hard: { name: 'Hardened tungsten / manganese steel', eta: 0.08 },
};
function renderHystTab() {
  const h = S.hyst;
  const W = P.hysteresisErgs(h.eta, h.B);
  const Pw = P.hysteresisWatts(h.eta, h.B, h.f, h.vol);
  $('#tabHyst').innerHTML = `
  ${fbox('mag', '<i>W</i> = η · <i>B</i><sup>1.6</sup>', 'Energy lost by hysteresis per cycle, in ergs per cm³, with <i>B</i> the maximum magnetic density in lines of force per cm² (gauss) and η the “coefficient of hysteresis”.', cite('ACP', 116, '§ 80') + ' · ' + cite('TEC', 61, 'eq. (15)'), sci(W) + ' erg/cm³')}
  <div class="ctl"><label>Material (η from Steinmetz)</label><select id="hMat">${Object.entries(MATS).map(([k, m]) => `<option value="${k}" ${k === h.mat ? 'selected' : ''}>${m.name}: η = ${m.eta}</option>`).join('')}</select></div>
  <div class="ctl"><label>Max density <i>B</i> <b>${h.B.toFixed(0)} gauss = ${(h.B / 1e4).toFixed(2)} T</b></label><input id="hB" type="range" min="500" max="18000" step="100" value="${h.B}"></div>
  <div class="grid2"><div class="ctl"><label>Frequency <b>${h.f} Hz</b></label><input id="hF" type="range" min="10" max="500" step="5" value="${h.f}"></div>
  <div class="ctl"><label>Iron volume <b>${h.vol} cm³</b></label><input id="hV" type="range" min="10" max="20000" step="10" value="${h.vol}"></div></div>
  ${fbox('mag', '<i>P</i> = η <i>N V B</i><sup>1.6</sup> 10<sup>−7</sup> watts', 'Hysteresis power at frequency <i>N</i> in volume <i>V</i> (cm³).', cite('ACP', 117), eng(Pw, 'W'))}
  <table class="ro"><tr><td>Loss per cycle, SI</td><td>${eng(W * 0.1, 'J/m³')}</td></tr><tr><td>Loss per cycle in this volume</td><td>${eng(W * 1e-7 * h.vol, 'J')}</td></tr></table>
  <p class="note">The <b>Hysteresis law</b> chart under the field view plots this curve. Shaded: outside 1,000–12,000 gauss, the range where the 1.6 law fits “with sufficient accuracy” ${cite('TEC', 61)}. Above ~10,000 gauss the 1917 test values rise above the curve ${cite('TEC', 62, 'eq. (16)')}.</p>
  <canvas id="bhChart" class="chart" width="700" height="340"></canvas>
  <div class="styl"><b>Stylized:</b> the loop's shape is invented for illustration. Only its <i>area</i> is physical: it is set so that the area ∮<i>H</i>d<i>B</i> / 4π equals η<i>B</i><sup>1.6</sup>. Real loops depend on the material.</div>
  <blockquote>“…is entirely empirical, and no rational reason has yet been found why this approximation should apply.” ${cite('TEC', 69, '§ 44')}</blockquote>
  <p class="note">η values: ${cite('ACP', 116)}–117 (sheet iron 0.00124–0.0055, “fair mean” 0.0033; gray cast iron 0.013; cast steel 0.0032–0.028; hardened steel up to 0.08; magnetite 0.023) and ${cite('TEC', 62)} (silicon steel 0.824×10<sup>−3</sup>).</p>`;
  const rer = () => { const sc = scroller(), y = sc.scrollTop; renderHystTab(); sc.scrollTop = y; };
  $('#hMat').onchange = (ev) => { h.mat = ev.target.value; h.eta = MATS[h.mat].eta; rer(); };
  $('#hB').oninput = (ev) => { h.B = +ev.target.value; rer(); };
  $('#hF').oninput = (ev) => { h.f = +ev.target.value; rer(); };
  $('#hV').oninput = (ev) => { h.vol = +ev.target.value; rer(); };
  drawHystChart(); drawBH(); updateCards();
}
function drawHystChart() {
  const c0 = prepChart('#hChart'); if (!c0) return; const { x, w } = c0, hh = c0.h;
  const h = S.hyst, Bmax = 18000, Wmax = P.hysteresisErgs(h.eta, Bmax);
  const X = b => 50 + b / Bmax * (w - 60), Y = v => hh - 30 - v / Wmax * (hh - 46);
  x.fillStyle = 'rgba(138,151,168,.10)'; x.fillRect(X(0), 10, X(1000) - X(0), hh - 38); x.fillRect(X(12000), 10, X(Bmax) - X(12000), hh - 38);
  x.strokeStyle = T.chartAxis; x.beginPath(); x.moveTo(50, 10); x.lineTo(50, hh - 28); x.lineTo(w - 10, hh - 28); x.stroke();
  x.strokeStyle = T.mag; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 200; i++) { const b = Bmax * i / 200; const v = P.hysteresisErgs(h.eta, b); i ? x.lineTo(X(b), Y(v)) : x.moveTo(X(b), Y(v)); } x.stroke();
  x.fillStyle = T.txt; x.beginPath(); x.arc(X(h.B), Y(P.hysteresisErgs(h.eta, h.B)), 7, 0, 7); x.fill();
  x.fillStyle = T.chartText; x.font = T.chartFont; x.fillText('W erg/cm³', 58, 28); const bl = 'B gauss →'; x.fillText(bl, w - x.measureText(bl).width - 8, 28);
  [0, 6000, 12000, 18000].forEach((b, i) => { const s = String(b); x.fillText(s, Math.min(w - x.measureText(s).width - 4, Math.max(50, X(b) - x.measureText(s).width / 2)), hh - 4); });
}
function drawBH() {
  const c0 = prepChart('#bhChart'); if (!c0) return; const { x, w } = c0, hh = c0.h;
  const h = S.hyst, Bm = h.B, W = P.hysteresisErgs(h.eta, Bm);
  // shape with Hm = 1: upper branch B = Bm*tanh((H+hc)/s)/tanh((1+hc)/s) normalized at ends
  const hc = 0.3, s = 0.35;
  const up = H => (Math.tanh((H + hc) / s) - Math.tanh((-1 + hc) / s)) / (Math.tanh((1 + hc) / s) - Math.tanh((-1 + hc) / s)) * 2 - 1; // -1..1
  const lo = H => -up(-H);
  let A1 = 0; const n = 400; for (let i = 0; i < n; i++) { const H = -1 + 2 * (i + 0.5) / n; A1 += (up(H) - lo(H)) * 2 / n; } // area in (Hm=1,Bm=1) units
  const Hscale = 4 * Math.PI * W / (A1 * Bm); // oersted per unit
  const X = H => w / 2 + H * (w / 2 - 30), Y = B => hh / 2 - B * (hh / 2 - 20);
  x.strokeStyle = T.chartAxis; x.beginPath(); x.moveTo(20, hh / 2); x.lineTo(w - 20, hh / 2); x.moveTo(w / 2, 10); x.lineTo(w / 2, hh - 10); x.stroke();
  x.globalAlpha = 0.15; x.fillStyle = T.mag; x.strokeStyle = T.mag; x.lineWidth = 2.5; x.beginPath();
  for (let i = 0; i <= 200; i++) { const H = -1 + 2 * i / 200; i ? x.lineTo(X(H), Y(lo(H))) : x.moveTo(X(H), Y(lo(H))); }
  for (let i = 200; i >= 0; i--) { const H = -1 + 2 * i / 200; x.lineTo(X(H), Y(up(H))); }
  x.closePath(); x.fill(); x.globalAlpha = 1; x.stroke();
  x.fillStyle = T.chartText; x.font = T.chartFont;
  x.fillText(`B ±${Bm.toFixed(0)} G`, w / 2 + 8, 26); { const s = `H ±${Hscale.toFixed(2)} Oe (stylized)`; x.fillText(s, w - x.measureText(s).width - 10, hh / 2 - 10); }
  x.fillText(`area/4π = ηB¹·⁶ = ${(W).toExponential(2)} erg/cm³`, 12, hh - 10);
}

function renderLawsTab() {
  $('#tabLaws').innerHTML = `
  <h3>Lines of force</h3>
  <blockquote>“All the lines of magnetic force are closed upon themselves, all the lines of dielectric force terminate at conductors…” ${cite('EL', 14)}</blockquote>
  <blockquote>“In the electric field between parallel conductors the magnetic and the electrostatic lines of force are conjugate pencils of circles.” ${cite('TR', 5)}</blockquote>
  <p class="note">Steinmetz draws lines of magnetic force solid and lines of dielectric force dotted (Figs. 8 and 9, ${cite('EL', 10)}–11). This app does the same: solid cyan for magnetic, dashed amber for dielectric.</p>
  <h3>Magnetic circuit</h3>
  ${fbox('mag', '<i>F</i> = <i>n i</i>', 'Magnetomotive force, in ampere-turns.', cite('EL', 14, 'eq. (12)'))}
  ${fbox('mag', 'ℋ = 4π<i>f</i> / 10', 'Field intensity (lines per cm²) from magnetizing force <i>f</i> (ampere-turns per cm) in empty space.', cite('EL', 14, 'eq. (14)'))}
  ${fbox('mag', '<i>B</i> = μ ℋ,   Φ = <i>A B</i>', 'Magnetic density and total flux.', cite('EL', 15, 'eqs. (15), (16)'))}
  ${fbox('mag', '<i>e</i>′ = <i>n</i> dΦ/d<i>t</i> · 10<sup>−8</sup> = <i>L</i> d<i>i</i>/d<i>t</i> volts', 'Inductance voltage. The magnetic view shows this live as the magnet’s flux through the coil changes while you drag it.', cite('EL', 17, 'Table I'))}
  <h3>Dielectric circuit</h3>
  ${fbox('die', '<i>i</i>′ = d Ψ/d<i>t</i> = <i>C</i> d<i>e</i>/d<i>t</i>', 'Capacity current, the dielectric analogue of the inductance voltage.', cite('EL', 13, 'eq. (9)'))}
  ${fbox('die', '<i>D</i> = κ<i>K</i>,   Ψ = <i>A D</i>', 'Dielectric density and flux, with κ the specific capacity (permittivity).', cite('EL', 16) + ' · ' + cite('EL', 17, 'Table I'))}
  <h3>Two round parallel conductors</h3>
  ${fbox('mag', '<i>L</i> = 2 (ln <i>s</i>/<i>r</i> + ¼) 10<sup>−9</sup> H per cm', 'Inductance per conductor: spacing <i>s</i>, radius <i>r</i>.', cite('EL', 123, 'eq. (14)'))}
  ${fbox('die', '<i>C</i> = 10<sup>9</sup> / (2<i>v</i>² ln <i>s</i>/<i>r</i>) F per cm', 'Capacity per conductor (to the neutral plane), with <i>v</i> = 3×10<sup>10</sup> cm/s.', cite('EL', 129, 'eq. (38)'))}
  ${fbox('', '<i>C L</i>₁ = 1/<i>v</i>²', 'Capacity times external inductance is fixed by the speed of light.', cite('EL', 129, 'eq. (39)'))}
  ${fbox('', 'Superposition', 'The field of several conductors is the sum of the fields of each, as long as flux is proportional to current and voltage.', cite('EL', 120))}
  <h3>Standard physics used for the computed fields (not from Steinmetz)</h3>
  ${fbox('std', 'd<b>B</b> = (μ₀/4π) <i>I</i> d<b>l</b> × <b>r̂</b> / <i>r</i>²', 'Biot–Savart, integrated exactly for each circular turn with complete elliptic integrals. The coil is drawn as 16 coaxial loops sharing its <i>n i</i> ampere-turns (exact away from the winding). Inductance sums the self- and mutual inductances of all <i>n</i> turns (Maxwell’s formula).', '<span class="cite">standard electromagnetics</span>')}
  ${fbox('std', '<b>K</b> = <b>M</b> = <i>B</i><sub>r</sub>/μ₀', 'The permanent magnet is modelled as its equivalent surface-current solenoid, which gives its field exactly (outside and inside) for uniform magnetization. The coil has an air core; there is no iron, so everything is linear.', '<span class="cite">standard electromagnetics</span>')}
  ${fbox('std', 'φ = −(λ/2πε₀) ln <i>r</i>', 'Dielectric view: 2-D electrostatics solved by the charge-simulation method (36 line charges per conductor, chosen so that each conductor sits at its set potential, with zero net charge). Checked against the exact two-cylinder result to within 0.001%.', '<span class="cite">standard electromagnetics</span>')}`;
}


// ---- Dollard (interpretation, off by default; text only) ----
function renderDollard() {
  document.body.classList.toggle('dollard', S.dollard);
  $('#dollardBadge').hidden = !S.dollard;
  const box = $('#dollardBox'); box.hidden = !S.dollard;
  if (S.dollard) {
    const qh = q => `<blockquote>“${q.text}” <span class="cite">Dollard, p.&nbsp;${q.page}</span></blockquote>${q.note ? `<p class="note">${q.note}</p>` : ''}`;
    const [first, ...rest] = DOLLARD.quotes;
    box.innerHTML = `<h2 class="ph dl-h">Dollard's notes</h2><div class="dhead"><b>Not mainstream physics.</b> Eric Dollard's words, quoted for context. Violet-edged readouts have a note; every number is still standard electromagnetics, and nothing here claims energy gain.</div>` +
      qh(first) + `<details class="dmore"><summary>Show ${rest.length} more notes</summary>${rest.map(qh).join('')}<p class="note">${DOLLARD.ref}</p></details>`;
  }
  updateCards();
}

function renderAbout() {
  $('#aboutBody').innerHTML = `<h2>About Steinmetz Fields</h2>
  <p>Charles Proteus Steinmetz (1865–1923) treated the magnetic and the dielectric field as the two components of a circuit's “electric field”, and as its two stores of energy. This app lets you push those fields around and read his formulas, cited to book and page, next to live numbers.</p>
  <h3>Sources (all public domain; page links open archive.org scans)</h3>
  <ul>
   <li><i>Elementary Lectures on Electric Discharges, Waves and Impulses, and Other Transients</i>, 1st ed., McGraw-Hill, 1911 (<a href="https://archive.org/details/elementarylectur00steirich" target="_blank" rel="noopener">archive.org</a>). The 2nd ed. (1914) has the same page numbers for the passages up to p. 66.</li>
   <li><i>Theory and Calculation of Transient Electric Phenomena and Oscillations</i>, 3rd ed., McGraw-Hill, 1920 (<a href="https://archive.org/details/theorycalctrans00steirich" target="_blank" rel="noopener">archive.org</a>).</li>
   <li><i>Theory and Calculation of Alternating Current Phenomena</i>, 1st ed., 1897, § 80, hysteresis law (<a href="https://archive.org/details/theorycalcalt00steirich" target="_blank" rel="noopener">archive.org</a>).</li>
   <li><i>Theory and Calculation of Electric Circuits</i>, 1917, hysteresis (<a href="https://archive.org/details/theorycalccirc00steirich" target="_blank" rel="noopener">archive.org</a>).</li>
  </ul>
  <h3>What is computed, and what is stylized</h3>
  <ul>
   <li><b>Computed with standard EM:</b> the path and brightness of every field line, field strengths, the coil's inductance, the induced voltage, capacities, energies and gradients, and the L–C energy exchange.</li>
   <li><b>Stylized:</b> the moving dots and dashes (static fields don't flow; they show direction only); how many lines are drawn in the magnetic view (chosen for readability, not a calibrated count of “lines of force”); the shape of the B–H loop (only its area is physical); the slow-motion three-phase rotation.</li>
   <li>In the dielectric view the number of lines <i>is</i> proportional to the dielectric flux Ψ = <i>C·e</i>, at a fixed charge per line.</li>
   <li>The “magnetic lines (Fig. 9)” overlay is drawn for the high-frequency case, where current flows on the wire surfaces and the magnetic lines coincide with the equipotentials (${cite('EL', 124)}).</li>
  </ul>
  <div class="plain"><b>No free energy, no overunity.</b> Steinmetz's “two energy stores” is ordinary circuit theory: the fields hold energy the source supplied, trade it back and forth, and lose it to resistance. Nothing here shows, or should be read as, energy appearing from nowhere.</div>
  <h3>Dollard's interpretation (switch, off by default)</h3>
  <p>Short, cited quotations from Eric Dollard, <i>Introduction to Dielectric &amp; Magnetic Discharges in Electrical Windings</i> (1982). This is an interpretation, not mainstream physics. It adds violet labels and quotes and changes no computed value.</p>
  <p class="note">three.js r170 (MIT) · Inter and JetBrains Mono (SIL OFL).</p>`;
}
function openAbout(e) { e && e.preventDefault(); renderAbout(); $('#about').hidden = false; }

// ======================= VIEW / LAYOUT / INPUT =======================
const HOME = { magnetic: { pos: [24, 26, 44], target: [2, 0, 0] }, dielectric: { pos: [10, 12, 60], target: [0, 0, -6] } };
function resetCamera() { const h = HOME[S.view]; camera.position.set(...h.pos); controls.target.set(...h.target); if (isMobile()) camera.position.multiplyScalar(1.25); controls.update(); }
function setView(v) {
  queueMicrotask(() => cue.refresh());
  S.view = v; $('#probe').hidden = true;
  $$('.views button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $$('#controls section[data-for]').forEach(s => s.hidden = s.dataset.for !== v);
  magGroup.visible = v === 'magnetic'; dielGroup.visible = v === 'dielectric';
  resetCamera();
  $('#chart1Cap').textContent = v === 'magnetic' ? 'EMF while dragging' : 'Capacity vs spacing';
  if (v === 'magnetic') {
    $('#hint').innerHTML = '<b class="mag">Drag the magnet</b> · ' + (TOUCH ? 'one finger to orbit · pinch to zoom' : 'drag empty space to orbit · scroll to zoom · double-click to reset');
    $('#legend').innerHTML = `<span class="sw" style="border-color:var(--mag)"></span>lines of magnetic force Φ · brightness = strength · dots show direction`;
  } else {
    $('#hint').textContent = TOUCH ? 'Drag a wire · one finger to orbit · pinch to zoom' : 'Drag a wire by its glowing end · orbit to see the wires in depth · double-click to reset';
    $('#legend').innerHTML = `<span class="sw" style="border-color:var(--die);border-top-style:dashed"></span>lines of dielectric force Ψ (count ∝ C·e) · <span class="sw" style="border-color:var(--equi)"></span>equipotentials`;
  }
  updateCards(); drawChart1(); syncHash();
}
function setTab(t) {
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('#formulas section[data-tab]').forEach(s => s.hidden = s.dataset.tab !== t);
  S.tab = t; syncHash(); redrawCharts();
}
function syncHash() { if (OG) return; history.replaceState(null, '', `#view=${S.view}&tab=${S.tab}${S.dollard ? '&dollard=1' : ''}`); }

function layoutForViewport() {
  const m = isMobile(), extra = $('#sheetExtra');
  const dt = $('.dtoggle'), dbox = $('#dollardBox');
  if (m) {
    if ($('#strip').parentElement !== extra) { extra.appendChild($('#strip')); extra.appendChild($('#formulas')); }
    if (dt.parentElement !== $('#sheetHead')) $('#sheetHead').appendChild(dt);
    if (dbox.parentElement !== extra) extra.insertBefore(dbox, extra.firstChild);
  } else {
    if ($('#strip').parentElement !== $('#center')) { $('#center').appendChild($('#strip')); $('#readouts').appendChild($('#formulas')); $('#controls').classList.remove('open'); }
    if (dt.parentElement !== $('.dwrap')) $('.dwrap').insertBefore(dt, $('#aboutBtn'));
    if (dbox.parentElement !== $('#readouts')) $('#roCards').after(dbox);
  }
}
function initSheet() {
  const sheet = $('#controls'), h = $('#sheetHandle');
  let y0 = null, moved = false, startOpen = false;
  h.addEventListener('pointerdown', (e) => { if (!isMobile()) return; y0 = e.clientY; moved = false; startOpen = sheet.classList.contains('open'); h.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
  h.addEventListener('pointermove', (e) => {
    if (y0 === null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 6) moved = true;
    const openPx = sheet.getBoundingClientRect().height, peek = 120;
    const base = startOpen ? 0 : openPx - peek; const t = Math.min(openPx - peek, Math.max(0, base + dy));
    sheet.style.transform = `translateY(${t}px)`;
  });
  const end = (e) => {
    if (y0 === null) return; const dy = e.clientY - y0; y0 = null; sheet.style.transition = ''; sheet.style.transform = '';
    if (!moved) sheet.classList.toggle('open'); else sheet.classList.toggle('open', startOpen ? dy < 60 : dy < -60);
    setTimeout(redrawCharts, 320);
  };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
}

function setFill(el) { const p = (el.value - el.min) / (el.max - el.min) * 100; el.style.setProperty('--fill', p + '%'); }
function bindRange(id, outId, fmt, apply) {
  const el = $('#' + id), out = $('#' + outId);
  const upd = (live) => { const v = parseFloat(el.value); out.textContent = fmt(v); setFill(el); apply(v, live); };
  el.addEventListener('input', () => upd(true)); el.addEventListener('change', () => upd(false)); upd(null);
}
let magTimer = 0;
function magChanged(live) { buildCoilMesh(); updateCards(); clearTimeout(magTimer); if (live) { requestLines('fast'); magTimer = setTimeout(() => requestLines('full'), 250); } else requestLines('full'); }
function initControls() {
  bindRange('sI', 'vI', v => v.toFixed(1) + ' A', (v, l) => { S.coil.I = v; l !== null && magChanged(l); });
  bindRange('sN', 'vN', v => v.toFixed(0) + ' turns', (v, l) => { S.coil.N = v; l !== null && magChanged(l); });
  bindRange('sA', 'vA', v => v.toFixed(1) + ' cm', (v, l) => { S.coil.a = v * CM; l !== null && magChanged(l); });
  bindRange('sLen', 'vLen', v => v.toFixed(1) + ' cm', (v, l) => { S.coil.len = v * CM; l !== null && magChanged(l); });
  bindRange('sBr', 'vBr', v => v.toFixed(2) + ' T', (v, l) => { S.magnet.Br = v; l !== null && magChanged(l); });
  bindRange('sAng', 'vAng', v => v.toFixed(0) + '°', (v, l) => { const t = v * Math.PI / 180; S.magnet.dir = [Math.cos(t), 0, -Math.sin(t)]; placeMagnet(); if (l !== null) { sampleEmf(); magChanged(l); } });
  $('#cMag').onchange = (e) => { S.magnet.enabled = e.target.checked; placeMagnet(); cue.refresh(); lastLam = null; magChanged(false); };
  $('#bResetMag').onclick = () => { S.magnet.pos = [16 * CM, 0, 0]; $('#sAng').value = 180; setFill($('#sAng')); S.magnet.dir = [-1, 0, 0]; $('#vAng').textContent = '180°'; placeMagnet(); lastLam = null; magChanged(false); };
  $('#cFlow').checked = S.flow; $('#cFlow').onchange = (e) => { S.flow = e.target.checked; if (flowPts) flowPts.visible = S.flow; };
  $('#c3d').onchange = (e) => { S.cage = e.target.checked; if (magLines3) magLines3.visible = S.cage; requestLines('full'); };
  let dielRAF = 0; const dielChanged = () => { cancelAnimationFrame(dielRAF); dielRAF = requestAnimationFrame(solveAndDrawDiel); };
  bindRange('sV', 'vV', v => v.toFixed(0) + ' kV', (v, l) => { S.diel.V = v * 1e3; l !== null && dielChanged(); });
  bindRange('sR', 'vR', v => v.toFixed(2) + ' cm', (v, l) => { S.diel.R = v * CM; if (l !== null) { fixOverlaps(); buildCondMeshes(); dielChanged(); } });
  $('#cEqui').onchange = (e) => { S.diel.equi = e.target.checked; dielChanged(); };
  $('#cMagOv').onchange = (e) => { S.diel.magOv = e.target.checked; dielChanged(); };
  $('#cAnim').checked = S.diel.anim; $('#cAnim').onchange = (e) => { S.diel.anim = e.target.checked; };
  $$('.presets button').forEach(b => b.onclick = () => setPreset(b.dataset.preset));
  $$('.views button').forEach(b => b.onclick = () => setView(b.dataset.view));
  $$('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $('#dollardToggle').checked = S.dollard;
  $('#dollardToggle').onchange = (e) => { S.dollard = e.target.checked; renderDollard(); syncHash(); };
  for (const id of ['#aboutBtn', '#badgeSources', '#creditSources']) $(id).onclick = openAbout;
  $('#aboutClose').onclick = () => { $('#about').hidden = true; };
  $('#about').onclick = (e) => { if (e.target.id === 'about') $('#about').hidden = true; };
}
function setPreset(p) {
  S.diel.preset = p; S.diel.conductors = presetConductors(p);
  $$('.presets button').forEach(b => b.classList.toggle('on', b.dataset.preset === p));
  $('#threeCtl').hidden = p !== 'three';
  if (p === 'three') { S.diel.magOv = false; $('#cMagOv').checked = false; }
  buildCondMeshes(); solveAndDrawDiel();
}
function fixOverlaps() {
  const cs = S.diel.conductors;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy), m = 2 * S.diel.R * 1.15;
    if (d < m) { if (d < 1e-6) { dx = 1; dy = 0; } const k = (m - d) / 2 / (d || 1); a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
  }
}

let lastTap = 0;
canvas.addEventListener('pointerdown', (e) => {
  controls.autoRotate = false; $('#hint').classList.add('fade');
  setNdc(e);
  if (S.view === 'magnetic' && S.magnet.enabled) {
    if (ray.intersectObject(magnetObj, true).length) {
      const p = hitPlane(dragPlane);
      if (p) { cue.dismiss(); canvas.style.cursor = 'grabbing'; dragging = { kind: 'magnet' }; dragOff.set(S.magnet.pos[0] / CM - p.x, 0, S.magnet.pos[2] / CM - p.z); controls.enabled = false; canvas.setPointerCapture(e.pointerId); lastLam = null; sampleEmf(); }
    }
  } else if (S.view === 'dielectric') {
    const hits = ray.intersectObjects(condGroup.children.filter(o => o.name !== 'sign'), false);
    if (hits.length) {
      const idx = hits[0].object.userData.idx; const p = hitPlane(dielPlane);
      if (p) { const c = S.diel.conductors[idx]; dragging = { kind: 'cond', idx }; dragOff.set(c.x / CM - p.x, c.y / CM - p.y, 0); controls.enabled = false; canvas.setPointerCapture(e.pointerId); }
    }
  }
});
let dielDragRAF = 0;
canvas.addEventListener('pointermove', (e) => {
  setNdc(e);
  if (dragging && dragging.kind === 'magnet') {
    const p = hitPlane(dragPlane); if (!p) return;
    let x = p.x + dragOff.x, z = p.z + dragOff.z; const r = Math.hypot(x, z); if (r > 34) { x *= 34 / r; z *= 34 / r; }
    S.magnet.pos = [x * CM, 0, z * CM]; placeMagnet(); sampleEmf(); requestLines('fast'); return;
  }
  if (dragging && dragging.kind === 'cond') {
    const p = hitPlane(dielPlane); if (!p) return;
    const c = S.diel.conductors[dragging.idx];
    c.x = Math.max(-45, Math.min(45, p.x + dragOff.x)) * CM; c.y = Math.max(-28, Math.min(28, p.y + dragOff.y)) * CM;
    fixOverlaps(); buildCondMeshes(); cancelAnimationFrame(dielDragRAF); dielDragRAF = requestAnimationFrame(solveAndDrawDiel); return;
  }
  if (e.pointerType === 'mouse') { hoverMagnet(); probe(e); }
});
const endDrag = (e) => {
  if (dragging) { if (dragging.kind === 'magnet') { requestLines('full'); canvas.style.cursor = magHover ? 'grab' : ''; } dragging = null; controls.enabled = true; return; }
  if (e && e.type === 'pointerup' && e.pointerType !== 'mouse') { const now = performance.now(); if (now - lastTap < 320) resetCamera(); lastTap = now; }
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('dblclick', resetCamera);
canvas.addEventListener('pointerleave', () => { $('#probe').hidden = true; if (!dragging) setMagHover(false); });
// ---- hover affordance: grab cursor + brighter magnet ----
let magHover = false;
function setMagHover(on) {
  if (on === magHover) return; magHover = on;
  if (!dragging) canvas.style.cursor = on ? 'grab' : '';
  magnetObj.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { o.material.emissive.set(T.mag || '#38D6FF'); o.material.emissiveIntensity = on ? 0.22 : 0; } });
}
function hoverMagnet() {
  if (dragging) return;
  setMagHover(S.view === 'magnetic' && S.magnet.enabled && ray.intersectObject(magnetObj, true).length > 0);
}

// ---- "Drag me" cue: ring + label anchored to the magnet's projected screen position ----
const cue = (() => {
  const el = $('#dragCue'), KEY = 'steinmetzFields.magnetDragged', NKEY = 'steinmetzFields.nudgeShown';
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };
  let done = ls.get(KEY) === '1' || OG, gone = false, nudge = null, quietTimer = 0, nudgeTimer = 0;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), right = new THREE.Vector3();
  const active = () => !done && S.view === 'magnetic' && S.magnet.enabled;
  function refresh() {
    if (!active()) { el.hidden = true; return; }
    el.hidden = false; el.classList.remove('gone'); place();
  }
  function place() {
    if (el.hidden) return;
    const r = canvas.getBoundingClientRect(), sr = el.parentElement.getBoundingClientRect();
    magnetObj.getWorldPosition(vA); vB.copy(vA);
    right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(S.magnet.b / CM * 2.2); vB.add(right);
    vA.project(camera); vB.project(camera);
    if (vA.z > 1 || Math.abs(vA.x) > 1.05 || Math.abs(vA.y) > 1.05) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    const x = r.left - sr.left + (vA.x + 1) / 2 * r.width, y = r.top - sr.top + (1 - vA.y) / 2 * r.height;
    const rad = Math.hypot((vB.x - vA.x) / 2 * r.width, (vB.y - vA.y) / 2 * r.height);
    const d = Math.max(44, Math.min(140, rad * 2));
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.style.setProperty('--d', d.toFixed(1) + 'px');
    el.classList.toggle('flip', x + d / 2 + 120 > r.right - sr.left);
  }
  function dismiss() {
    if (nudge) endNudge(true);
    if (done) return; done = true; ls.set(KEY, '1'); clearTimeout(quietTimer); clearTimeout(nudgeTimer);
    el.classList.add('gone'); gone = true; setTimeout(() => { el.hidden = true; }, 320);
  }
  function startNudge() {
    if (done || reducedMotion || dragging || !active() || ls.get(NKEY) === '1') return;
    ls.set(NKEY, '1');
    const p0 = S.magnet.pos.slice(); const dir = [-(Math.sign(p0[0]) || 1), 0, 0]; // toward the coil
    nudge = { t0: performance.now(), p0, dir, amp: 3 * CM, dur: 1200 };
  }
  function endNudge(keepPos) {
    if (!nudge) return; if (!keepPos) { S.magnet.pos = nudge.p0.slice(); placeMagnet(); }
    nudge = null; requestLines('full');
  }
  function tick(now) {
    if (nudge && !dragging) {
      const u = Math.min(1, (now - nudge.t0) / nudge.dur), s = Math.sin(Math.PI * u) ** 2; // out and back, eased
      S.magnet.pos = [nudge.p0[0] + nudge.dir[0] * nudge.amp * s, nudge.p0[1], nudge.p0[2]]; placeMagnet(); requestLines('fast');
      if (u >= 1) endNudge(false);
    }
    if (!el.hidden) place();
  }
  function start() {
    refresh();
    if (done) return;
    nudgeTimer = setTimeout(startNudge, 1000);
    quietTimer = setTimeout(() => el.classList.add('quiet'), 8000);
  }
  return { refresh, dismiss, tick, start, state: () => ({ done, gone, hidden: el.hidden, quiet: el.classList.contains('quiet'), nudging: !!nudge, stored: ls.get(KEY) }) };
})();
function probe(e) {
  const pr = $('#probe');
  if (S.view === 'magnetic') {
    const p = hitPlane(dragPlane); if (!p || Math.hypot(p.x, p.z) > 40) { pr.hidden = true; return; }
    const b = Math.hypot(...P.fieldAt(P.buildLoops(S.coil, S.magnet), [p.x * CM, 0, p.z * CM], [0, 0, 0]));
    pr.innerHTML = `<b class="mag">|B|</b> ${eng(b, 'T')} = ${fix(b * 1e4, 2)} G<br>B²/2μ₀ = ${eng(b * b / 2 / P.MU0, 'J/m³')}`;
  } else {
    const p = hitPlane(dielPlane); if (!p || !dielSol) { pr.hidden = true; return; }
    if (P.insideConductor(dielSol, p.x * CM, p.y * CM) >= 0) pr.innerHTML = 'inside a wire: E = 0';
    else { const E = P.efield2D(dielSol, p.x * CM, p.y * CM, [0, 0]); const m = Math.hypot(...E); pr.innerHTML = `<b class="die">|E|</b> ${fix(m / 1e5, 2)} kV/cm<br>φ = ${eng(P.potential2D(dielSol, p.x * CM, p.y * CM), 'V')}<br>ε₀E²/2 = ${eng(P.EPS0 * m * m / 2, 'J/m³')}`; }
  }
  const r = canvas.getBoundingClientRect(); pr.style.left = (e.clientX - r.left + 16) + 'px'; pr.style.top = (e.clientY - r.top + 12) + 'px'; pr.hidden = false;
}

// ======================= LOOP =======================
let lastT = performance.now(), emfTick = 0, readTick = 0, running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { lastT = performance.now(); requestAnimationFrame(frame); } });
function frame(t) {
  if (!running) return;
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  controls.update();
  cue.tick(t);
  if (S.view === 'magnetic') {
    if (S.flow && !reducedMotion) stepFlow(dt);
    if (!dragging) sampleEmf();
    emfTick += dt; if (emfTick > 1 / 30) { emfTick = 0; emfHist.push(emfNow); if (emfHist.length > 300) emfHist.shift(); drawEmfChart(); }
    readTick += dt; if (readTick > 0.3) { readTick = 0; updateCards(); }
    const halo = magnetObj.getObjectByName('halo'); if (halo) halo.material.opacity = dragging ? 0.7 : magHover ? 0.6 : reducedMotion ? 0.25 : 0.2 + 0.12 * Math.sin(t / 400);
  } else {
    if (!reducedMotion) { dieMat.dashOffset -= dt * 1.2; dieMatGhost.dashOffset = dieMat.dashOffset; } // dashes flow from + to −
    if (S.diel.preset === 'three' && S.diel.anim) { S.diel.phase += dt * (2 * Math.PI / 8); solveAndDrawDiel(); }
  }
  composer.render();
  requestAnimationFrame(frame);
}

// ======================= BOOT =======================
function boot() {
  S.tab = HP.get('tab') || 'energy'; S.dollard = HP.get('dollard') === '1';
  buildCoilMesh(); buildMagnetMesh(); placeMagnet();
  initControls(); initSheet();
  S.diel.conductors = presetConductors('fig9'); buildCondMeshes();
  renderEnergyTab(); renderHystTab(); renderLawsTab();
  layoutForViewport(); resize();
  solveAndDrawDiel();
  setView(HP.get('view') === 'dielectric' ? 'dielectric' : 'magnetic');
  setTab(S.tab);
  renderDollard();
  requestLines('full');
  if (HP.get('about') === '1') openAbout();
  if (HP.get('sheet') === '1') $('#controls').classList.add('open');
  if (OG) { $('#credit').textContent = 'Computed with standard electromagnetics · Steinmetz’s formulas cited to the page'; }
  setTimeout(() => $('#hint').classList.add('fade'), 6000);
  controls.addEventListener('start', () => $('#hint').classList.add('fade'));
  $('#roCards').addEventListener('click', (e) => {
    if (!isMobile() || e.target.closest('a')) return;
    const c = e.target.closest('.card-ro'); if (!c) return;
    const k = S.view + c.dataset.k; openCards.has(k) ? openCards.delete(k) : openCards.add(k);
    c.classList.toggle('open', openCards.has(k)); c.setAttribute('aria-expanded', openCards.has(k));
  });
  cue.start();
  requestAnimationFrame(frame);
  window.__app = {
    S, setView, setTab, setPreset, resetCamera, redrawCharts,
    magnetScreen() { const v = magnetObj.position.clone().project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    camera, controls, cueState: () => cue.state(),
  };
}
boot();
