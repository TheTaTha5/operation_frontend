// Chip colours, ported unchanged from the legacy calendar (_calHx / _calRgba / _calDk / _calVivid in
// allotment_v2/js/04-data-core.js) so a route reads as the same colour in both apps.

function hx(c: string): [number, number, number] {
  let s = String(c || '#888').replace('#', '');
  if (s.length === 3) s = s.split('').map((x) => x + x).join('');
  return [parseInt(s.slice(0, 2), 16) || 136, parseInt(s.slice(2, 4), 16) || 136, parseInt(s.slice(4, 6), 16) || 136];
}

export function rgba(c: string, a: number): string {
  const [r, g, b] = hx(c);
  return `rgba(${r},${g},${b},${a})`;
}

/** Darkens by `k` (0.34 = 34% darker), as legacy `_calDk`. */
export function dk(c: string, k = 0.45): string {
  const [r, g, b] = hx(c);
  return `rgb(${Math.round(r * (1 - k))},${Math.round(g * (1 - k))},${Math.round(b * (1 - k))})`;
}

/**
 * Pushes saturation toward full and clamps lightness into a readable band, as legacy `_calVivid`.
 * An already saturated colour barely moves; the stored route colour is not changed.
 */
export function vivid(c: string, amt = 0.3): string {
  const [r, g, b] = hx(c).map((x) => x / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, sa = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    sa = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  sa = sa + (1 - sa) * amt;
  l = Math.min(0.62, Math.max(0.36, l));
  const q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(f(h + 1 / 3)) + to(f(h)) + to(f(h - 1 / 3));
}

/** A day-cell chip: tinted fill, stronger border, darkened text (legacy `_chSkin`, tint style). */
export function chipSkin(color: string): { background: string; borderColor: string; color: string } {
  const v = vivid(color);
  return { background: rgba(v, 0.3), borderColor: rgba(v, 0.65), color: dk(v, 0.34) };
}
