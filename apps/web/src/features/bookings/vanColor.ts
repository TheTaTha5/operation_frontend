// A van's colour, ported from legacy vehColor / vehChipPair / vjShade (allotment_v2/js/vans.js:7-28)
// and VEH_COLORS (08-app.js:179). The colour belongs to the van, never to its position in a list.
import { tint } from './byTrip';

const VEH_COLORS = [
  '#13B96A', '#0E9C7F', '#0E7490', '#19A7C9', '#1577B0', '#1E4E8C', '#3B7BE0', '#5B8DEF',
  '#7C5CE0', '#8B5CF6', '#6D3BE0', '#A855C7', '#C2469B', '#F25CA2', '#E0457F', '#C42B4B',
  '#DC5B4B', '#E0792B', '#F2A33C', '#D4A017', '#B45309', '#8A5A2B', '#6B4A2F', '#4E5D3A',
  '#2E7D5B', '#16794E', '#0F5F73', '#334E68', '#64748B', '#4B5563', '#5A5F7A', '#7A4A6B',
];

/** Legacy vjShade: scale each channel by (100 + pct)%; pct < 0 darkens. */
export function shade(hex: string, pct: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex || '#64748B';
  const n = parseInt(m[1]!, 16), f = (100 + pct) / 100;
  const cl = (x: number) => Math.max(0, Math.min(255, Math.round(x * f)));
  return '#' + ((1 << 24) + (cl((n >> 16) & 255) << 16) + (cl((n >> 8) & 255) << 8) + cl(n & 255)).toString(16).slice(1);
}

/** Legacy vehColor: the van's own colour, else a stable hash of its id. */
export function vanColor(van: { id: string; color?: string }): string {
  if (van.color && /^#[0-9a-f]{6}$/i.test(van.color)) return van.color;
  let acc = 0;
  for (let i = 0; i < van.id.length; i++) acc = (acc * 31 + van.id.charCodeAt(i)) >>> 0;
  return VEH_COLORS[acc % VEH_COLORS.length]!;
}

/** Legacy vehChipPair: [light background, dark ink]. */
export function vanChipPair(van: { id: string; color?: string }): [string, string] {
  const c = vanColor(van);
  return [tint(c, 0.87), shade(c, -30)];
}
