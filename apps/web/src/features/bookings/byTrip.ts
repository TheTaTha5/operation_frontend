// View model for the "By trip · date" tab, ported from the legacy bkV2RenderTab2 / bkV2T2RouteHtml
// (allotment_v2/js/booking.js) on operation-backend's data. Read-only: no boat / van assignment,
// re-confirm or check-in, because the backend does not return trip operations yet.
import type { ObAvailabilityDay, ObBoat, ObBooking, ObDaySource, ObRouteDays, ObSeatLock, ObTrip } from '@/lib/ob';

import { displayCode, isB2C, paxSplit, type PaxSplit } from './model';

/** Legacy _BKV2_FAMILIES (08-app.js): the programme a route belongs to, with its colour. */
export interface Family { id: string; name: string; color: string }
export const FAMILIES: readonly Family[] = [
  { id: 'similan', name: 'Similan Islands', color: '#185fa5' },
  { id: 'surin', name: 'Surin Islands', color: '#3B6D11' },
  { id: 'phiphi', name: 'Phi Phi Bamboo', color: '#c0392b' },
  { id: 'krabi', name: 'Krabi + Phang Nga', color: '#0F6E56' },
  { id: 'whaleshark', name: 'Whale Shark Phi Phi Maiton', color: '#BA7517' },
  { id: 'selava', name: 'Day Trip - Se La Va', color: '#BA7517' },
  { id: 'nyaung', name: 'Day Trip - Nyaung Oo Phee Island', color: '#0F6E56' },
  { id: 'transfer', name: 'Transfer', color: '#5B289A' },
  { id: 'citytour', name: 'City Tour', color: '#7B4BB7' },
  { id: 'activity', name: 'Activities', color: '#C77D1E' },
];

/** Legacy bkV2RouteFamily: an explicit family_id wins ('' = none on purpose), otherwise guess by name. */
export function familyOf(r: { name?: string; family_id?: string } | undefined): Family | null {
  if (!r) return null;
  if (r.family_id != null) return FAMILIES.find((f) => f.id === r.family_id) || null;
  const n = r.name || '';
  const by = (id: string) => FAMILIES.find((f) => f.id === id) || null;
  if (n.includes('Nyaung') || n.includes('Oo Phee')) return by('nyaung');
  if (n.includes('Se La Va') || n.includes('SeLaVa')) return by('selava');
  if (n.includes('Whale')) return by('whaleshark');
  if (n.includes('Similan')) return by('similan');
  if (n.includes('Surin')) return by('surin');
  if (n.includes('Phi Phi')) return by('phiphi');
  if (n.includes('Krabi') || n.includes('Phang Nga')) return by('krabi');
  return null;
}

export const PIERS = ['all', 'panwa', 'tublamu', 'ranong'] as const;
export type PierF = (typeof PIERS)[number];
export const PIER_BTN: Record<PierF, string> = { all: 'All', panwa: 'Panwa', tublamu: 'Tub Lamu', ranong: 'Ranong' };
export const pierName = (p?: string) => (p === 'tublamu' ? 'Tub Lamu' : p === 'panwa' ? 'Visit Panwa' : p === 'ranong' ? 'Ranong' : p || '');

/** Legacy bkV2ZoneLabel / Order / Color. */
export const zoneLabel = (z: string) =>
  ({ PK: 'Phuket', KL: 'Khao Lak', RN: 'Ranong', NoTransfer: 'Own transportation', NT: 'Own transportation' } as Record<string, string>)[z] || z || 'Own transportation';
export const zoneOrder = (z: string) => ({ PK: 0, KL: 1, RN: 2, NoTransfer: 3, NT: 3 } as Record<string, number>)[z] ?? 4;
export const zoneColor = (z: string) => ({ PK: '#185FA5', KL: '#3B6D11', RN: '#6A3FA0', NoTransfer: '#8b909c', NT: '#8b909c' } as Record<string, string>)[z] || '#8b909c';

/** Cancelled statuses are excluded from every pax / revenue / count aggregate. */
export const CXL = new Set(['cancelled', 'cancelled_weather', 'rejected']);

/** Legacy pckTint: mix a colour toward white by `t` (0 = colour, 1 = white). */
export function tint(c: string, t: number): string {
  let h = String(c || '#888').replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '888888';
  let o = '#';
  for (let i = 0; i < 3; i++) { const v = parseInt(h.substr(i * 2, 2), 16); o += ('0' + Math.round(v + (255 - v) * t).toString(16)).slice(-2); }
  return o;
}

/** Legacy BKV2_AGENT_PALETTE + bkV2AgentColor's hash (no agent catalogue: the id picks the colour). */
const AGENT_PALETTE = ['#9b59b6', '#27ae60', '#e08283', '#f1c40f', '#2e86de', '#7B3FA0', '#16a085', '#e67e22', '#C0563B', '#2c7a45',
  '#d35400', '#8e44ad', '#BA8A2C', '#185FA5', '#0F6E56', '#7f8c8d'];
export function agentColor(agentId: string): string {
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
  return AGENT_PALETTE[h % AGENT_PALETTE.length]!;
}
/** Legacy bkV2ContrastInk. */
export function contrastInk(hex: string): string {
  const m = String(hex || '').replace('#', '');
  if (m.length < 6) return '#fff';
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#2c2c2a' : '#fff';
}

/** Legacy BOAT_COLORS text colours (04-data-core.js), else bkV2BoatAvatarColor's palette by catalogue index. */
const BOAT_INK: Record<string, string> = {
  b1: '#185FA5', b2: '#0F6E56', b3: '#854F0B', b4: '#5B3FA5', b5: '#A32D2D', b6: '#0E5E73', b7: '#7B2D63', b8: '#A04E0F',
  b9: '#3E6E1E', b10: '#2D4A8C', b11: '#A8331B', b12: '#4D3989', b13: '#A82E73', b14: '#B5471F', b15: '#3F6E2D', b16: '#7B5C1E',
};
const BOAT_PALETTE = ['#185FA5', '#534AB7', '#1D9E75', '#BA7517', '#A32D2D', '#0F6E56', '#7F77DD', '#D85A30', '#993556', '#185FA5'];
export function boatColor(id: string, boats: readonly ObBoat[]): string {
  if (BOAT_INK[id]) return BOAT_INK[id]!;
  const i = Math.max(0, boats.findIndex((b) => b.id === id));
  return BOAT_PALETTE[i % BOAT_PALETTE.length]!;
}
/** Legacy bkV2BoatInitials. */
export function boatInitials(name: string): string {
  const w = name.trim().split(/\s+/);
  if (w.length >= 2) return (w[0]![0]! + w[1]![0]!).toUpperCase();
  if (name.length >= 2 && /\d/.test(name)) return ((name.match(/[A-Z]/g) || [])[0] || name[0]!) + name.slice(-1);
  return name.slice(0, 2).toUpperCase();
}
/** Legacy bkV2LangColors. */
export function langColors(code: string): [string, string] {
  const m: Record<string, [string, string]> = { EN: ['#E6F1FB', '#185FA5'], RU: ['#FCEBEB', '#A32D2D'], CN: ['#FAEEDA', '#854F0B'],
    TH: ['#EAF3DE', '#3B6D11'], FR: ['#EDE7FB', '#5B289A'], DE: ['#E1F5EE', '#0F6E56'] };
  return m[code] || ['#F1EFE8', '#5F5E5A'];
}
/** Guide languages of a booking, in legacy order. */
export function langs(b: ObBooking): string[] {
  const out: string[] = [];
  if (b.guide_english) out.push('EN');
  if (b.guide_russian) out.push('RU');
  if (b.guide_chinese) out.push('CN');
  const o = (b.guide_other_lang || '').trim();
  if (o) out.push(o);
  return out;
}

/** One manifest row: a booking's trip on the day (legacy collects exactly these). */
export interface Row {
  key: string;
  b: ObBooking;
  t: ObTrip;
  routeId: string;
  zone: string;
  pax: PaxSplit;
  charter: boolean;
  charterBoatId: string | null;
  cxl: boolean;
  pending: boolean;
  /** Legacy tsTripAmount: the booking total for a single-trip booking; null when the backend has no per-trip subtotal. */
  amount: number | null;
}

export function collectRows(bookings: readonly ObBooking[], date: string): Row[] {
  const rows: Row[] = [];
  for (const b of bookings) {
    for (const t of b.trips) {
      if (t.service_date !== date) continue;
      rows.push({
        key: `${b.id}#${t.id}`, b, t, routeId: t.route_id,
        // Legacy bkV2EffZone: the trip's zone, else the booking's pickup zone.
        zone: b.pickup_zone || '',
        pax: paxSplit({ trips: [t] }),
        charter: t.booking_mode === 'charter',
        charterBoatId: t.charter_boat_id || null,
        cxl: CXL.has(b.status),
        pending: b.status === 'pending_approval',
        amount: b.trips.length <= 1 ? Number(b.total) || 0 : null,
      });
    }
  }
  return rows;
}

/** Legacy §btHead search: voucher / code / id / lead / phone / hotel / pickup area / agent. */
export function rowHit(r: Row, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const b = r.b;
  return [b.voucher_ref, displayCode(b), b.id, b.lead_pax, b.lead_phone, b.hotel_name, b.pickup_area, b.agent_id]
    .filter(Boolean).join(' ').toLowerCase().includes(s);
}

export type SortCol = '' | 'agency' | 'zone';
export interface Filters {
  pier: PierF;
  fam: string;
  route: string;
  q: string;
  sort: { col: SortCol; dir: 'asc' | 'desc' };
}

/** The Agency / Zone column sort; 0 when no column is picked. */
export function rowCmp(sort: Filters['sort']): (a: Row, b: Row) => number {
  const agentKey = (r: Row) => (isB2C(r.b) ? 'b2c' : r.b.agent_id || '').toLowerCase();
  return (a, b) => {
    if (!sort.col) return 0;
    const va = sort.col === 'agency' ? agentKey(a) : (a.b.pickup_area || '').toLowerCase();
    const vb = sort.col === 'agency' ? agentKey(b) : (b.b.pickup_area || '').toLowerCase();
    return va < vb ? (sort.dir === 'desc' ? 1 : -1) : va > vb ? (sort.dir === 'desc' ? -1 : 1) : 0;
  };
}

export interface Seats { booked: number; cap: number; free: number; locked: number; cls: 'ok' | 'low' | 'full'; boats: number; hasBoats: boolean }
export interface Variant { rid: string; sub: string; dep: string; pier: string; open: boolean; on: boolean; seats: Seats }
export interface FamRow { fam: Family; pax: number; on: boolean; nRun: number; nOff: number; variants: Variant[] }
export interface BoatLoad { id: string; name: string; col: string; pax: number | null; cap: number; over: boolean; chartered: boolean }
export interface Prep { lang: [string, number][]; veg: number; vegan: number; halal: number; allerg: number }
export interface ZoneBlock { zone: string; charter: boolean; label: string; color: string; rows: Row[]; pax: number;
  charterItems: { bn: string; cap: number; px: number }[] }
export interface Trip {
  rid: string; name: string; color: string; dep: string; pier: string;
  open: boolean; notRunWhy: string; live: number;
  seats: Seats; zones: ZoneBlock[]; pend: Row[]; cxl: Row[]; hasRows: boolean;
}
export interface LockHolder { nm: string; qty: number; left: number }
export interface DayView {
  date: string;
  totals: { bookings: number; pax: number; ad: number; chd: number; inf: number; foc: number };
  famList: FamRow[];
  selFam: Family | null;
  selRoute: string;
  routeIds: string[];
  trips: Trip[];
  /** The boats card: one route when a route is picked, else every running trip. */
  boatsOf: (rid: string) => BoatLoad[];
  prepOf: (rid: string) => Prep;
  seatsOf: (rid: string) => Seats;
  routeName: (rid: string) => string;
  depOf: (rid: string) => string;
  pierOf: (rid: string) => string;
  openOf: (rid: string) => boolean;
  locks: LockHolder[];
  lockCount: number;
  pendN: number;
  hits: number;
}

const paxOf = (r: Row) => r.pax.total;

/** Legacy not-running reasons (§notRunning), from the route calendar's source. */
export function notRunWhy(source: ObDaySource | undefined): string {
  if (source === 'override') return 'ปิดเฉพาะวันนี้ (ตั้ง override ไว้)';
  if (source === 'outside-season') return 'อยู่นอกทุกช่วง season ที่ตั้งไว้ — น่าจะยังไม่ได้ตั้ง season ของปีนี้';
  return 'ปิดตามฤดูกาล (season)';
}

export function buildDay(
  input: { date: string; bookings: readonly ObBooking[]; routes: readonly ObRouteDays[]; boats: readonly ObBoat[];
    days: readonly ObAvailabilityDay[]; locks: readonly ObSeatLock[] },
  f: Filters,
): DayView {
  const { date, routes, boats } = input;
  const route = (rid: string) => routes.find((r) => r.id === rid);
  const fam = (rid: string) => familyOf(route(rid));
  const dep = (rid: string) => route(rid)?.times?.[0] || '';
  const pier = (rid: string) => pierName(route(rid)?.pier);
  const day = (rid: string) => input.days.find((d) => d.route_id === rid && d.service_date === date);
  const dayStatus = (rid: string) => route(rid)?.days?.[date];
  const open = (rid: string) => dayStatus(rid)?.open ?? day(rid)?.open ?? true;
  const activeLocks = input.locks.filter((l) => l.status === 'active' && l.service_date === date);
  const locked = (rid: string) => day(rid)?.locked_pax ?? activeLocks.filter((l) => l.route_id === rid)
    .reduce((s, l) => s + Math.max(0, l.pax - (l.drawn_pax || 0)), 0);
  const seats = (rid: string): Seats => {
    const d = day(rid);
    const cap = d?.deployed_capacity || 0, free = d?.available_seats || 0, fr = cap > 0 ? free / cap : 0;
    return { booked: d?.booked_pax || 0, cap, free, locked: locked(rid), cls: free <= 0 ? 'full' : fr < 0.2 ? 'low' : 'ok',
      boats: d?.deployments.length || 0, hasBoats: !!d?.deployments.length };
  };

  const rows = collectRows(input.bookings, date);
  const rowsPier = rows.filter((r) => f.pier === 'all' || route(r.routeId)?.pier === f.pier);
  const rowsF = rowsPier.filter((r) => (!f.fam || fam(r.routeId)?.id === f.fam) && (!f.route || r.routeId === f.route) && rowHit(r, f.q));

  // Pending approval is kept out of the trip groups entirely (§pendSeat): nothing counts it.
  const groups = new Map<string, Row[]>(), pendGroups = new Map<string, Row[]>();
  for (const r of rowsF) {
    const m = r.pending ? pendGroups : groups;
    const list = m.get(r.routeId);
    if (list) list.push(r); else m.set(r.routeId, [r]);
  }
  // Routes with a seat lock that day show even with no booking (same filters).
  const lockRouteIds = [...new Set(activeLocks.map((l) => l.route_id))].filter((rid) =>
    (!f.fam || fam(rid)?.id === f.fam) && (!f.route || rid === f.route) && (f.pier === 'all' || route(rid)?.pier === f.pier));
  const famId = (rid: string) => fam(rid)?.id || 'zzz';
  const time = (rid: string) => route(rid)?.times?.[0] || '99:99';
  const all = [...new Set([...groups.keys(), ...pendGroups.keys(), ...lockRouteIds])];
  const famMin: Record<string, string> = {};
  for (const rid of all) { const k = famId(rid), t = time(rid); if (!(k in famMin) || t < famMin[k]!) famMin[k] = t; }
  const routeIds = all.sort((a, b) => {
    const fa = famId(a), fb = famId(b);
    if (fa !== fb) return (famMin[fa] || '99').localeCompare(famMin[fb] || '99') || fa.localeCompare(fb);
    return time(a).localeCompare(time(b));
  });

  // Whole-day totals (all programmes, independent of filters), cancelled excluded.
  const live = rows.filter((r) => !r.cxl);
  const sum = (k: keyof PaxSplit) => live.reduce((s, r) => s + r.pax[k], 0);
  const totals = { bookings: live.length, pax: sum('total'), ad: sum('ad'), chd: sum('chd'), inf: sum('inf'), foc: sum('foc') };

  // "Programmes" card: families on this day under the pier filter (+ families that only have locks).
  const agg = new Map<string, { fam: Family; pax: number; rids: Set<string>; locked: number }>();
  for (const r of rowsPier) {
    if (r.cxl) continue;
    const fm = fam(r.routeId); if (!fm) continue;
    const a = agg.get(fm.id) || { fam: fm, pax: 0, rids: new Set<string>(), locked: 0 };
    a.pax += paxOf(r); a.rids.add(r.routeId); agg.set(fm.id, a);
  }
  for (const rt of routes) {
    if (f.pier !== 'all' && rt.pier !== f.pier) continue;
    const lk = locked(rt.id); if (lk <= 0) continue;
    const fm = familyOf(rt); if (!fm) continue;
    const a = agg.get(fm.id) || { fam: fm, pax: 0, rids: new Set<string>(), locked: 0 };
    a.locked += lk; a.rids.add(rt.id); agg.set(fm.id, a);
  }
  const sub = (rid: string) => {
    const rn = route(rid)?.name || rid, fm = fam(rid)?.name || '';
    const x = rn.replace(fm, '').replace(/^[\s·-]*by[\s·-]*/i, '').replace(/^[\s·-]+/, '').trim();
    return x || rn;
  };
  const famList: FamRow[] = [...agg.values()].sort((a, b) => b.pax - a.pax || b.locked - a.locked).map((a) => {
    const rids = [...a.rids].filter((x) => f.pier === 'all' || route(x)?.pier === f.pier).sort((x, y) => dep(x).localeCompare(dep(y)));
    const nRun = rids.filter(open).length;
    return {
      fam: a.fam, pax: a.pax, on: f.fam === a.fam.id, nRun, nOff: rids.length - nRun,
      variants: rids.map((rid) => ({ rid, sub: sub(rid), dep: dep(rid), pier: pier(rid), open: open(rid), on: f.route === rid, seats: seats(rid) })),
    };
  });
  const selFam = f.route ? fam(f.route) : f.fam ? famList.find((a) => a.fam.id === f.fam)?.fam || FAMILIES.find((x) => x.id === f.fam) || null : null;

  const boatName = (id: string) => boats.find((b) => b.id === id)?.name || id;
  const boatCap = (id: string) => boats.find((b) => b.id === id)?.capacity || 0;
  // Boats of a trip: the day's deployments, plus chartered boats that only a booking names (§btBoats).
  const boatsOf = (rid: string): BoatLoad[] => {
    const order: string[] = [], acc = new Map<string, { pax: number | null; chartered: boolean; cap: number }>();
    for (const d of day(rid)?.deployments || []) {
      if (acc.has(d.boat_id)) continue;
      acc.set(d.boat_id, { pax: d.chartered ? 0 : null, chartered: d.chartered, cap: boatCap(d.boat_id) || d.capacity });
      order.push(d.boat_id);
    }
    for (const r of groups.get(rid) || []) {
      if (r.cxl || !r.charter || !r.charterBoatId) continue;
      const a = acc.get(r.charterBoatId) || { pax: 0, chartered: true, cap: boatCap(r.charterBoatId) };
      if (!acc.has(r.charterBoatId)) order.push(r.charterBoatId);
      a.chartered = true; a.pax = (a.pax || 0) + paxOf(r); acc.set(r.charterBoatId, a);
    }
    return order.map((id) => {
      const a = acc.get(id)!;
      return { id, name: boatName(id), col: boatColor(id, boats), pax: a.pax, cap: a.cap, chartered: a.chartered,
        over: a.pax != null && a.cap > 0 && a.pax > a.cap };
    });
  };
  const prepOf = (rid: string): Prep => {
    const lang: Record<string, number> = {};
    let veg = 0, vegan = 0, halal = 0, allerg = 0;
    for (const r of groups.get(rid) || []) {
      if (r.cxl) continue;
      for (const code of langs(r.b)) lang[code] = (lang[code] || 0) + paxOf(r);
      veg += r.b.special_meals_veg || 0; vegan += r.b.special_meals_vegan || 0; halal += r.b.special_meals_halal || 0;
      if ((r.b.special_meals_allergies || '').trim()) allerg++;
    }
    return { lang: Object.entries(lang).sort((a, b) => b[1] - a[1]), veg, vegan, halal, allerg };
  };

  const cmp = rowCmp(f.sort);
  const trips: Trip[] = routeIds.map((rid) => {
    const grp = groups.get(rid) || [];
    // Charter bookings get their own pseudo-zone, shown first.
    const zg = new Map<string, Row[]>();
    for (const r of grp) {
      const zk = r.charter && !r.cxl ? '__CHARTER__' : r.zone;
      const list = zg.get(zk); if (list) list.push(r); else zg.set(zk, [r]);
    }
    const zord = (z: string) => (z === '__CHARTER__' ? -100 : zoneOrder(z));
    const zones: ZoneBlock[] = [...zg.keys()].sort((a, b) => zord(a) - zord(b)).map((z) => {
      const list = (zg.get(z) || []).filter((r) => !r.cxl);
      if (f.sort.col) list.sort(cmp);
      const charter = z === '__CHARTER__';
      return {
        zone: z, charter, label: charter ? 'CHARTER' : zoneLabel(z), color: zoneColor(z), rows: list,
        pax: list.reduce((s, r) => s + paxOf(r), 0),
        charterItems: charter ? list.map((r) => ({ bn: r.charterBoatId ? boatName(r.charterBoatId) : '', cap: r.charterBoatId ? boatCap(r.charterBoatId) : 0, px: paxOf(r) })) : [],
      };
    }).filter((z) => z.rows.length);
    const isOpen = open(rid);
    return {
      rid, name: route(rid)?.name || rid, color: fam(rid)?.color || '#8b909c', dep: dep(rid), pier: pier(rid),
      open: isOpen, notRunWhy: isOpen ? '' : notRunWhy(dayStatus(rid)?.source), live: grp.filter((r) => !r.cxl).length,
      seats: seats(rid), zones, pend: pendGroups.get(rid) || [], cxl: grp.filter((r) => r.cxl), hasRows: grp.length > 0,
    };
  });

  // Seat Lock card: one line per holder (agent), over the trips on screen; holders with seats left first.
  const byHolder = new Map<string, LockHolder>();
  let lockCount = 0;
  for (const l of activeLocks) {
    if (!routeIds.includes(l.route_id)) continue;
    lockCount++;
    const nm = l.agent_id || '—';
    const a = byHolder.get(nm) || { nm, qty: 0, left: 0 };
    a.qty += l.pax; a.left += Math.max(0, l.pax - (l.drawn_pax || 0)); byHolder.set(nm, a);
  }

  return {
    date, totals, famList, selFam, selRoute: f.route, routeIds, trips,
    boatsOf, prepOf, seatsOf: seats, routeName: (rid) => route(rid)?.name || rid, depOf: dep, pierOf: pier, openOf: open,
    locks: [...byHolder.values()].sort((a, b) => b.left - a.left || b.qty - a.qty), lockCount,
    pendN: [...pendGroups.values()].reduce((n, l) => n + l.length, 0),
    hits: rowsF.filter((r) => !r.cxl).length,
  };
}
