// Steinmetz field visualizer - physics core (SI units unless noted).
// Pure functions, no DOM. Standard electromagnetics:
//  - Magnetic: exact field of circular current loops (complete elliptic integrals),
//    superposed (Biot-Savart). A permanent magnet is modelled exactly as its
//    equivalent surface-current solenoid (K = M = Br/mu0).
//  - Dielectric: 2-D electrostatics of parallel round conductors by the charge
//    simulation method (fictitious line charges, superposition), solved exactly
//    for the set potentials.
export const MU0 = 4e-7 * Math.PI;
export const EPS0 = 8.8541878128e-12;

// Complete elliptic integrals K(m), E(m), parameter m = k^2, via AGM.
export function ellipKE(m) {
  if (m >= 1) m = 1 - 1e-15;
  let a = 1, b = Math.sqrt(1 - m), c = Math.sqrt(m);
  let sum = 0.5 * c * c, pow2 = 0.5;
  for (let i = 0; i < 30 && Math.abs(c) > 1e-15; i++) {
    const an = 0.5 * (a + b);
    const bn = Math.sqrt(a * b);
    c = 0.5 * (a - b);
    pow2 *= 2;
    sum += pow2 * c * c;
    a = an; b = bn;
  }
  const K = Math.PI / (2 * a);
  return [K, K * (1 - sum)];
}

// Field of a loop (radius a, current I) centred at origin, axis z.
// Input local cylindrical (rho, z). Returns [Brho, Bz] in tesla.
export function loopFieldRZ(a, I, rho, z) {
  const c = MU0 * I / (2 * Math.PI);
  if (rho < 1e-9 * a) {
    const d = a * a + z * z;
    return [0, MU0 * I * a * a / (2 * d * Math.sqrt(d))];
  }
  const ap = (a + rho) * (a + rho) + z * z;
  const am = (a - rho) * (a - rho) + z * z;
  const m = 4 * a * rho / ap;
  const [K, E] = ellipKE(m);
  const sq = Math.sqrt(ap);
  const Bz = c / sq * (K + (a * a - rho * rho - z * z) / am * E);
  const Br = c * z / (rho * sq) * (-K + (a * a + rho * rho + z * z) / am * E);
  return [Br, Bz];
}

// A loop in 3-D: centre c[3], unit axis n[3], radius a, current I.
// Adds its field at p into out[3].
export function addLoopField(loop, p, out) {
  const dx = p[0] - loop.c[0], dy = p[1] - loop.c[1], dz = p[2] - loop.c[2];
  const n = loop.n;
  const z = dx * n[0] + dy * n[1] + dz * n[2];
  let rx = dx - z * n[0], ry = dy - z * n[1], rz = dz - z * n[2];
  const rho = Math.hypot(rx, ry, rz);
  const [Br, Bz] = loopFieldRZ(loop.a, loop.I, rho, z);
  if (rho > 0) { rx /= rho; ry /= rho; rz /= rho; }
  out[0] += Br * rx + Bz * n[0];
  out[1] += Br * ry + Bz * n[1];
  out[2] += Br * rz + Bz * n[2];
}

// Distance from point p to the wire (ring) of a loop.
export function distToRing(loop, p) {
  const dx = p[0] - loop.c[0], dy = p[1] - loop.c[1], dz = p[2] - loop.c[2];
  const n = loop.n;
  const z = dx * n[0] + dy * n[1] + dz * n[2];
  const rho = Math.hypot(dx - z * n[0], dy - z * n[1], dz - z * n[2]);
  return Math.hypot(rho - loop.a, z);
}

// Mutual inductance of two coaxial loops (radii a, b, separation d) - Maxwell.
export function mutualCoaxial(a, b, d) {
  const m = 4 * a * b / ((a + b) * (a + b) + d * d);
  const k = Math.sqrt(m);
  const [K, E] = ellipKE(m);
  return MU0 * Math.sqrt(a * b) * ((2 / k - k) * K - (2 / k) * E);
}

// Self-inductance of a single-layer coil of N turns, radius a, length len,
// computed as the sum of loop self- and mutual inductances (L = n*Phi/i).
// Wire radius rw; self term mu0 a (ln(8a/rw) - 7/4) (uniform current in wire).
export function coilInductance(N, a, len, rw) {
  N = Math.max(1, Math.round(N));
  const pitch = N > 1 ? len / (N - 1) : 0;
  const Lself = MU0 * a * (Math.log(8 * a / rw) - 1.75);
  let L = N * Lself;
  for (let k = 1; k < N; k++) L += 2 * (N - k) * mutualCoaxial(a, a, k * pitch);
  return L;
}

// Build the loop set for coil + magnet.
// coil: {N, a, len, I, nDisp}, axis along x, centred at origin.
// magnet: {pos[3], dir[3] (unit, N-pole direction), b (radius), h (length), Br (T), nLoops}
export function buildLoops(coil, magnet) {
  const loops = [];
  const nd = Math.max(1, Math.min(coil.nDisp, Math.round(coil.N)));
  const Iper = coil.I * coil.N / nd; // ampere-turns shared among display loops
  for (let i = 0; i < nd; i++) {
    const x = nd > 1 ? -coil.len / 2 + coil.len * i / (nd - 1) : 0;
    loops.push({ c: [x, 0, 0], n: [1, 0, 0], a: coil.a, I: Iper, kind: 'coil' });
  }
  if (magnet && magnet.enabled) {
    const nm = magnet.nLoops;
    const Itot = magnet.Br * magnet.h / MU0; // K*h, K = M = Br/mu0
    for (let i = 0; i < nm; i++) {
      const s = -magnet.h / 2 + magnet.h * (i + 0.5) / nm;
      loops.push({
        c: [magnet.pos[0] + s * magnet.dir[0], magnet.pos[1] + s * magnet.dir[1], magnet.pos[2] + s * magnet.dir[2]],
        n: magnet.dir.slice(), a: magnet.b, I: Itot / nm, kind: 'magnet'
      });
    }
  }
  return loops;
}

export function fieldAt(loops, p, out) {
  out[0] = 0; out[1] = 0; out[2] = 0;
  for (let i = 0; i < loops.length; i++) addLoopField(loops[i], p, out);
  return out;
}

// Flux of the field of `loops` through a disk (centre c, normal n, radius a).
export function fluxThroughDisk(loops, c, n, a, nr = 10, nt = 16) {
  // orthonormal basis
  const t1 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
  const ul = Math.hypot(...u); u = u.map(v => v / ul);
  const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const B = [0, 0, 0], p = [0, 0, 0];
  let phi = 0;
  for (let i = 0; i < nr; i++) {
    const r0 = a * i / nr, r1 = a * (i + 1) / nr, r = 0.5 * (r0 + r1);
    const dA = Math.PI * (r1 * r1 - r0 * r0) / nt;
    for (let j = 0; j < nt; j++) {
      const t = 2 * Math.PI * (j + 0.5 * (i % 2)) / nt;
      const ct = Math.cos(t) * r, st = Math.sin(t) * r;
      p[0] = c[0] + ct * u[0] + st * w[0];
      p[1] = c[1] + ct * u[1] + st * w[1];
      p[2] = c[2] + ct * u[2] + st * w[2];
      fieldAt(loops, p, B);
      phi += (B[0] * n[0] + B[1] * n[1] + B[2] * n[2]) * dA;
    }
  }
  return phi;
}

// Flux linkage (sum over all N turns) of the magnet's field with the coil.
export function magnetLinkage(coil, magnetLoops, samples = 9) {
  let lam = 0;
  const ns = Math.max(1, Math.min(samples, Math.round(coil.N)));
  for (let i = 0; i < ns; i++) {
    const x = ns > 1 ? -coil.len / 2 + coil.len * i / (ns - 1) : 0;
    lam += fluxThroughDisk(magnetLoops, [x, 0, 0], [1, 0, 0], coil.a * 0.98, 8, 12);
  }
  return lam * coil.N / ns;
}

// Trace a field line through vector field f(p,out) from seed, in direction sgn.
// opts: {step, maxSteps, bound, stop(p)->bool}
export function traceLine(f, seed, sgn, opts) {
  const pts = [seed.slice()];
  const p = seed.slice();
  const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], q = [0, 0, 0];
  const dirAt = (x, out) => {
    f(x, out);
    const m = Math.hypot(out[0], out[1], out[2]) || 1e-30;
    out[0] *= sgn / m; out[1] *= sgn / m; out[2] *= sgn / m;
    return m;
  };
  let travelled = 0, closed = false;
  const h = opts.step;
  for (let s = 0; s < opts.maxSteps; s++) {
    dirAt(p, k1);
    for (let i = 0; i < 3; i++) q[i] = p[i] + 0.5 * h * k1[i];
    dirAt(q, k2);
    for (let i = 0; i < 3; i++) q[i] = p[i] + 0.5 * h * k2[i];
    dirAt(q, k3);
    for (let i = 0; i < 3; i++) q[i] = p[i] + h * k3[i];
    dirAt(q, k4);
    for (let i = 0; i < 3; i++) p[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    travelled += h;
    pts.push(p.slice());
    if (Math.hypot(p[0], p[1], p[2]) > opts.bound) break;
    if (opts.stop && opts.stop(p)) break;
    if (travelled > 6 * h && Math.hypot(p[0] - seed[0], p[1] - seed[1], p[2] - seed[2]) < 0.75 * h) {
      pts.push(seed.slice()); closed = true; break;
    }
  }
  return { pts, closed };
}

// ---------------- 2-D electrostatics (charge simulation method) -------------
// conductors: [{x, y, R, V}] (metres, volts). Returns solution object.
export function solveDielectric(conductors, M = 36, inner = 0.6) {
  const n = conductors.length;
  const qs = [], cs = [], owner = [];
  conductors.forEach((c, i) => {
    for (let j = 0; j < M; j++) {
      const t = 2 * Math.PI * j / M;
      qs.push([c.x + inner * c.R * Math.cos(t), c.y + inner * c.R * Math.sin(t)]);
      cs.push([c.x + c.R * Math.cos(t + Math.PI / M), c.y + c.R * Math.sin(t + Math.PI / M), c.V]);
      owner.push(i);
    }
  });
  const K = qs.length, Nu = K + 1;
  const A = new Float64Array(Nu * Nu), b = new Float64Array(Nu);
  const g = -1 / (2 * Math.PI * EPS0);
  for (let r = 0; r < K; r++) {
    for (let k = 0; k < K; k++) {
      A[r * Nu + k] = g * Math.log(Math.hypot(cs[r][0] - qs[k][0], cs[r][1] - qs[k][1]));
    }
    A[r * Nu + K] = 1; // reference potential phi0
    b[r] = cs[r][2];
  }
  for (let k = 0; k < K; k++) A[K * Nu + k] = 1; // total charge zero
  b[K] = 0;
  const x = gaussSolve(A, b, Nu);
  const lam = Array.from(x.slice(0, K));
  const Q = new Array(n).fill(0);
  lam.forEach((l, k) => { Q[owner[k]] += l; });
  // residual check on surface (between collocation points)
  const sol = { conductors, qs, lam, phi0: x[K], Q, owner };
  let maxErr = 0;
  conductors.forEach(c => {
    for (let j = 0; j < M; j++) {
      const t = 2 * Math.PI * j / M;
      const e = Math.abs(potential2D(sol, c.x + c.R * Math.cos(t), c.y + c.R * Math.sin(t)) - c.V);
      if (e > maxErr) maxErr = e;
    }
  });
  sol.maxErr = maxErr;
  return sol;
}

function gaussSolve(A, b, n) {
  for (let c = 0; c < n; c++) {
    let piv = c, best = Math.abs(A[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * n + c]); if (v > best) { best = v; piv = r; } }
    if (piv !== c) {
      for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[piv * n + k]; A[piv * n + k] = t; }
      const t = b[c]; b[c] = b[piv]; b[piv] = t;
    }
    const d = A[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / d;
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k];
    x[r] = s / A[r * n + r];
  }
  return x;
}

export function potential2D(sol, x, y) {
  const g = -1 / (2 * Math.PI * EPS0);
  let p = sol.phi0;
  for (let k = 0; k < sol.qs.length; k++) p += g * sol.lam[k] * Math.log(Math.hypot(x - sol.qs[k][0], y - sol.qs[k][1]));
  return p;
}

export function efield2D(sol, x, y, out) {
  const g = 1 / (2 * Math.PI * EPS0);
  let ex = 0, ey = 0;
  for (let k = 0; k < sol.qs.length; k++) {
    const dx = x - sol.qs[k][0], dy = y - sol.qs[k][1];
    const r2 = dx * dx + dy * dy;
    ex += g * sol.lam[k] * dx / r2; ey += g * sol.lam[k] * dy / r2;
  }
  out[0] = ex; out[1] = ey;
  return out;
}

export function insideConductor(sol, x, y, margin = 0) {
  for (let i = 0; i < sol.conductors.length; i++) {
    const c = sol.conductors[i];
    if (Math.hypot(x - c.x, y - c.y) < c.R * (1 + margin)) return i;
  }
  return -1;
}

// Seeds on the surface of conductor i, spaced at equal outward dielectric flux,
// count proportional to its charge: "lines of dielectric force", Psi = C e.
export function dielectricSeeds(sol, i, nLines) {
  const c = sol.conductors[i];
  const S = 720, sig = [], E = [0, 0];
  let tot = 0;
  for (let j = 0; j < S; j++) {
    const t = 2 * Math.PI * (j + 0.5) / S;
    const x = c.x + c.R * 1.02 * Math.cos(t), y = c.y + c.R * 1.02 * Math.sin(t);
    efield2D(sol, x, y, E);
    const en = Math.max(0, E[0] * Math.cos(t) + E[1] * Math.sin(t)); // outward only
    sig.push(en); tot += en;
  }
  const seeds = [];
  if (tot <= 0 || nLines <= 0) return seeds;
  let acc = 0, next = 0.5, j = 0;
  const step = tot / nLines;
  for (let L = 0; L < nLines; L++) {
    const target = (L + 0.5) * step;
    while (j < S && acc + sig[j] < target) { acc += sig[j]; j++; }
    const frac = j < S && sig[j] > 0 ? (target - acc) / sig[j] : 0;
    const t = 2 * Math.PI * (Math.min(j, S - 1) + frac) / S;
    seeds.push([c.x + c.R * 1.03 * Math.cos(t), c.y + c.R * 1.03 * Math.sin(t)]);
  }
  void next;
  return seeds;
}

// Max surface gradient |E| on conductor i (V/m).
export function maxSurfaceField(sol, i) {
  const c = sol.conductors[i], E = [0, 0];
  let m = 0;
  for (let j = 0; j < 180; j++) {
    const t = 2 * Math.PI * j / 180;
    efield2D(sol, c.x + c.R * 1.001 * Math.cos(t), c.y + c.R * 1.001 * Math.sin(t), E);
    m = Math.max(m, Math.hypot(E[0], E[1]));
  }
  return m;
}

// Marching squares contours of a scalar grid. Returns array of segments [[x1,y1,x2,y2],...]
export function contourSegments(grid, nx, ny, x0, y0, dx, dy, level) {
  const segs = [];
  const v = (i, j) => grid[j * nx + i];
  const lerp = (a, b, va, vb) => a + (b - a) * (level - va) / (vb - va);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
    if (!isFinite(a + b + c + d)) continue;
    const X = x0 + i * dx, Y = y0 + j * dy;
    const pts = [];
    if ((a < level) !== (b < level)) pts.push([lerp(X, X + dx, a, b), Y]);
    if ((b < level) !== (c < level)) pts.push([X + dx, lerp(Y, Y + dy, b, c)]);
    if ((c < level) !== (d < level)) pts.push([lerp(X + dx, X, c, d), Y + dy]);
    if ((d < level) !== (a < level)) pts.push([X, lerp(Y + dy, Y, d, a)]);
    if (pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
    else if (pts.length === 4) { segs.push([...pts[0], ...pts[1]]); segs.push([...pts[2], ...pts[3]]); }
  }
  return segs;
}

// ---------------- Steinmetz formulas ----------------
// Hysteresis law (AC Phenomena 1897 §80 p.116; Electric Circuits 1917 p.61 eq.15)
// W = eta * B^1.6  [ergs per cm^3 per cycle, B in lines/cm^2 (gauss)]
export function hysteresisErgs(eta, Bgauss, n = 1.6) { return eta * Math.pow(Bgauss, n); }
// Power: P = eta N V B^1.6 1e-7 watts (V in cm^3, N cycles/s) - AC Phenomena p.117
export function hysteresisWatts(eta, Bgauss, f, Vcm3, n = 1.6) { return eta * f * Vcm3 * Math.pow(Bgauss, n) * 1e-7; }

// Inductance per conductor of a two-wire line, Elementary Lectures p.132 eq.(14):
// L = 2 (ln s/r + 1/4) 1e-9 H per cm  ->  SI per metre: 2e-7 (ln s/r + 1/4)
export function steinmetzLineL(s, r) { return 2e-7 * (Math.log(s / r) + 0.25); }
// Capacity per conductor (to neutral), Elementary Lectures p.138 eq.(38):
// C = 1e9 / (2 v^2 ln s/r) F per cm, v = 3e10 cm/s -> SI per metre: 2 pi eps0 / ln(s/r)
export function steinmetzLineC(s, r) { return 1e9 / (2 * 9e20 * Math.log(s / r)) * 100; }
// Exact capacity to neutral for two parallel cylinders (standard result):
export function exactLineC(s, r) { return 2 * Math.PI * EPS0 / Math.acosh(s / (2 * r)); }
