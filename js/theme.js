// ONE place for visual styling used by JavaScript (3D scene + charts).
// All values come from CSS variables in css/style.css (:root). Restyle there.
const css = getComputedStyle(document.documentElement);
const v = (name, fb) => (css.getPropertyValue(name).trim() || fb);
const n = (name, fb) => { const x = parseFloat(v(name, '')); return isFinite(x) ? x : fb; };
export const THEME = {
  bg: v('--bg', '#07090D'), bgCenter: v('--bg-center', '#0E131B'),
  grid: v('--scene-grid', '#18202C'), gridMinor: v('--scene-grid-minor', '#10161F'),
  floor: v('--scene-floor', '#0B1017'), dust: v('--scene-dust', '#273142'),
  mag: v('--mag', '#38D6FF'), die: v('--die', '#FFB547'), dollard: v('--dollard', '#B48CFF'),
  equi: v('--equi', '#5D6B80'), flow: v('--flow', '#E9FBFF'),
  source: v('--source', '#2A3340'), magnetN: v('--magnet-n', '#3B4658'), magnetS: v('--magnet-s', '#2A3340'),
  txt: v('--txt', '#E6EDF5'), dim: v('--dim', '#8A97A8'),
  chartBg: v('--chart-bg', '#0B1017'), chartAxis: v('--chart-axis', '#1E2633'), chartText: v('--chart-text', '#8A97A8'),
  chartFont: v('--chart-font', '500 22px monospace'),
  chartFontPx: n('--chart-font-px', 12), chartFontWeight: v('--chart-font-weight', '500'), chartFontFamily: v('--chart-font-family', 'monospace'),
  dielGrid: v('--diel-grid', '#8A97A8'), dielGridOpacity: n('--diel-grid-opacity', 0.06), equiOpacity: n('--equi-opacity', 0.35), equiMidOpacity: n('--equi-mid-opacity', 0.1),
  bloom: { strength: n('--bloom-strength', 0.8), radius: n('--bloom-radius', 0.4), threshold: n('--bloom-threshold', 0.2) },
  linePx: n('--line-px', 2.6), linePxCage: n('--line-px-cage', 1.6),
  brightness: [0.35, 1.0], // emissive range for weak → strong field
};
