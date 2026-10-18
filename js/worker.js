// Field-line tracing for the magnetic view, off the main thread.
import { buildLoops, fieldAt, traceLine, distToRing } from './physics.js';

self.onmessage = (ev) => {
  const { id, coil, magnet, quality, mobile } = ev.data;
  const t0 = performance.now();
  const loops = buildLoops(coil, magnet);
  const f = (p, out) => fieldAt(loops, p, out);
  const fast = quality === 'fast';
  const step = fast ? 0.0045 : 0.0025;            // metres
  const maxSteps = fast ? 260 : 520;
  const wire = 0.0012;
  const stop = (p) => { for (const L of loops) if (distToRing(L, p) < wire) return true; return false; };
  const seeds = [];
  const planes = fast ? [0] : mobile ? [0, Math.PI / 2] : [0, Math.PI / 3, 2 * Math.PI / 3];
  // seeds across the coil's mid cross-section
  const nc = fast || mobile ? 7 : 9;
  for (const ph of planes) for (let i = 0; i < nc; i++) {
    const s = (-0.82 + 1.64 * i / (nc - 1)) * coil.a;
    seeds.push({ p: [0, s * Math.sin(ph), s * Math.cos(ph)], plane: ph === 0 ? 0 : 1, src: 'coil' });
  }
  if (magnet.enabled) {
    const d = magnet.dir; // in xz plane; perpendicular in-plane = (−dz, 0, dx)
    const perp = [-d[2], 0, d[0]];
    const up = [0, 1, 0];
    const nm = fast || mobile ? 5 : 7;
    for (const ph of planes) for (let i = 0; i < nm; i++) {
      const s = (-0.8 + 1.6 * i / (nm - 1)) * magnet.b;
      const v = [perp[0] * Math.cos(ph) + up[0] * Math.sin(ph), perp[1] * Math.cos(ph) + up[1] * Math.sin(ph), perp[2] * Math.cos(ph) + up[2] * Math.sin(ph)];
      seeds.push({ p: [magnet.pos[0] + s * v[0], magnet.pos[1] + s * v[1], magnet.pos[2] + s * v[2]], plane: ph === 0 ? 0 : 1, src: 'magnet' });
    }
  }
  const lines = [];
  const B = [0, 0, 0];
  for (const sd of seeds) {
    const fw = traceLine(f, sd.p, +1, { step, maxSteps, bound: 0.6, stop });
    let pts;
    if (fw.closed) pts = fw.pts;
    else {
      const bw = traceLine(f, sd.p, -1, { step, maxSteps, bound: 0.6, stop });
      pts = bw.pts.slice(1).reverse().concat(fw.pts);
    }
    // decimate for rendering, keep |B| per point
    const keep = [], mags = [];
    for (let i = 0; i < pts.length; i += 2) {
      keep.push(pts[i][0], pts[i][1], pts[i][2]);
      fieldAt(loops, pts[i], B); mags.push(Math.hypot(B[0], B[1], B[2]));
    }
    const last = pts[pts.length - 1];
    if ((pts.length - 1) % 2) { keep.push(last[0], last[1], last[2]); fieldAt(loops, last, B); mags.push(Math.hypot(B[0], B[1], B[2])); }
    lines.push({ pts: new Float32Array(keep), mags: new Float32Array(mags), plane: sd.plane, closed: fw.closed, src: sd.src });
  }
  self.postMessage({ id, lines, ms: performance.now() - t0, quality });
};
