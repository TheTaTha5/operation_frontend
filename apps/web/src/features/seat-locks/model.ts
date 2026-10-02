// Seat Locks tab rules, kept pure so they can be tested without a page. Each one names the legacy
// function it replaces (allotment_v2/js/booking.js). Spec: apps/web/docs/porting/seat-locks.md.
//
// operation-backend models a lock as one route × one date × `pax` seats, optionally for one agent,
// with `drawn_pax` derived from the bookings that draw on it (cancelled ones excluded). A sub-group
// (`parent_id`) divides its parent's seats; a bulk lock is a group plus one day lock per departure
// (`group_id`); a release rule gives undrawn seats back on its own (`release_at`, `holding`).
import { addDays } from '@/lib/date';
import type { ObAgentSummary, ObBooking, ObReleaseRule, ObRoute, ObSeatLock, ObSeatLockGroup } from '@/lib/ob';
import type { Me } from '@/stores/session';

import { agentColor, CXL } from '../bookings/byTrip';
import { displayCode } from '../bookings/model';

export type LockStatus = 'active' | 'depleted' | 'released';
export type GroupBy = 'holder' | 'route' | 'none';

export interface LockFilters {
  q: string;
  routeId: string;
  /** A holder key (see holderKey), '' = every holder. */
  holder: string;
  /** '' = both, 'day' = single-day locks, 'bulk' = bulk locks. */
  scope: '' | 'day' | 'bulk';
  status: 'active' | 'all';
  groupBy: GroupBy;
}
export const DEFAULT_FILTERS: LockFilters = { q: '', routeId: '', holder: '', scope: '', status: 'active', groupBy: 'holder' };

export interface Lookup {
  routes: Map<string, ObRoute>;
  agents: Map<string, ObAgentSummary>;
}
export const lookupOf = (routes: readonly ObRoute[], agents: readonly ObAgentSummary[]): Lookup => ({
  routes: new Map(routes.map((r) => [r.id, r])),
  agents: new Map(agents.map((a) => [a.id, a])),
});

/** A lock with no agent. Legacy office and global holds both arrive like this from the importer. */
export const NO_AGENT_NAME = 'Office / pool';
const NO_AGENT_KEY = '-';
type Held = { agent_id?: string };

export const holderKey = (l: Held): string => l.agent_id || NO_AGENT_KEY;
/** bkV2LockHolderName. An agent the catalogue doesn't know shows its raw id. */
export const holderName = (l: Held, lk: Lookup): string => (l.agent_id ? lk.agents.get(l.agent_id)?.name || l.agent_id : NO_AGENT_NAME);
/** bkV2LockHolderColor: the agent's own colour, else its hash colour; the legacy office slate otherwise. */
export const holderColor = (l: Held, lk: Lookup): string => (l.agent_id ? lk.agents.get(l.agent_id)?.color || agentColor(l.agent_id) : '#64748B');
export const routeName = (id: string, lk: Lookup): string => lk.routes.get(id)?.name || id;
/** #9C9C95 is legacy's fallback when a route has no colour (booking.js:628). */
export const routeColor = (id: string, lk: Lookup): string => lk.routes.get(id)?.color || '#9C9C95';

export const drawn = (l: ObSeatLock): number => l.drawn_pax ?? 0;
/** Still keeping seats off sale. A backend older than release rules has no `holding`; then active = holding. */
export const isHolding = (l: ObSeatLock): boolean => l.holding ?? l.status === 'active';

/** Sub-groups by parent id. */
export function childrenIndex(locks: readonly ObSeatLock[]): Map<string, ObSeatLock[]> {
  const out = new Map<string, ObSeatLock[]>();
  for (const l of locks) if (l.parent_id) out.set(l.parent_id, [...(out.get(l.parent_id) ?? []), l]);
  return out;
}

export interface Tree {
  /** Seats carved into sub-groups (a released one keeps only what was drawn from it). */
  allocated: number;
  /** Drawn from the lock and every sub-group. */
  used: number;
  /** What the lock itself can still give: to a booking, a new sub-group, or back to the pool. */
  unallocated: number;
  /** What it keeps from the general pool. */
  held: number;
  /** The smallest `pax` it can shrink to. */
  floor: number;
}
/**
 * operation-backend's `lockTree` (seat-locks.ts), the old bkV2LockAllocated / UnallocDrawable /
 * PoolHold. A sub-group passed with no children of its own gives its own numbers.
 */
export function lockTree(l: ObSeatLock, kids: readonly ObSeatLock[] = []): Tree {
  const allocated = kids.reduce((n, k) => n + (k.status === 'released' ? drawn(k) : Math.max(k.pax, drawn(k))), 0);
  const used = drawn(l) + kids.reduce((n, k) => n + drawn(k), 0);
  const active = l.status === 'active';
  return {
    allocated,
    used,
    unallocated: active ? Math.max(l.pax - allocated - drawn(l), 0) : 0,
    held: isHolding(l) && !l.parent_id ? Math.max(l.pax - used, 0) : 0,
    floor: drawn(l) + allocated,
  };
}
/** Seats the lock still keeps off general sale: bkV2LockHeldRemaining at the parent (bkV2LockPoolHold). */
export const held = (l: ObSeatLock, kids: readonly ObSeatLock[] = []): number => lockTree(l, kids).held;
/** What a sub-group can still give to bookings. */
export const subLeft = (k: ObSeatLock): number => (k.status === 'active' ? Math.max(k.pax - drawn(k), 0) : 0);
/** Legacy kept `depleted` as a stored status; here it is an active lock with nothing left. Past its release time counts as released. */
export function lockStatus(l: ObSeatLock, kids: readonly ObSeatLock[] = []): LockStatus {
  if (l.status === 'released' || !isHolding(l)) return 'released';
  return (l.parent_id ? subLeft(l) : held(l, kids)) === 0 ? 'depleted' : 'active';
}

/** What a row button acts on: one lock (single, a bulk day, or a sub-group) or a whole bulk lock. */
export type LockTarget = { kind: 'lock' | 'group'; id: string };

// ── Rows: the main table lists single-day locks and bulk locks, as legacy does (one row per bulk lock). ──

export type LockRow =
  | { kind: 'lock'; key: string; lock: ObSeatLock; kids: ObSeatLock[] }
  | { kind: 'group'; key: string; group: ObSeatLockGroup; days: ObSeatLock[]; kids: ObSeatLock[] };

/** Top-level single-day locks with their sub-groups, and each group with its day locks and theirs. */
export function buildRows(locks: readonly ObSeatLock[], groups: readonly ObSeatLockGroup[]): LockRow[] {
  const kids = childrenIndex(locks);
  const rows: LockRow[] = locks
    .filter((l) => !l.parent_id && !l.group_id)
    .map((l) => ({ kind: 'lock', key: l.id, lock: l, kids: kids.get(l.id) ?? [] }));
  for (const g of groups) {
    const mine = locks.filter((l) => l.group_id === g.id);
    rows.push({ kind: 'group', key: g.id, group: g, days: mine.filter((l) => !l.parent_id).sort(byDate), kids: mine.filter((l) => l.parent_id) });
  }
  return rows;
}
const byDate = (a: { service_date: string }, b: { service_date: string }) => a.service_date.localeCompare(b.service_date);
const rowOwner = (r: LockRow) => (r.kind === 'lock' ? r.lock : r.group);
export const rowRoute = (r: LockRow): string => rowOwner(r).route_id;
const rowDate = (r: LockRow): string => (r.kind === 'lock' ? r.lock.service_date : r.group.date_from);
/** A group is active while any of its days is. */
export const rowActive = (r: LockRow): boolean => (r.kind === 'lock' ? r.lock.status === 'active' : r.days.some((d) => d.status === 'active'));

/** The filter block of bkV2RenderLocks (booking.js:759-773): nearest date first, then route. */
export function filterRows(rows: readonly LockRow[], f: LockFilters, lk: Lookup): LockRow[] {
  const q = f.q.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (f.status === 'active' && !rowActive(r)) return false;
      if (f.scope === 'day' && r.kind !== 'lock') return false;
      if (f.scope === 'bulk' && r.kind !== 'group') return false;
      if (f.routeId && rowRoute(r) !== f.routeId) return false;
      if (f.holder && holderKey(rowOwner(r)) !== f.holder) return false;
      if (q && !`${routeName(rowRoute(r), lk)} ${holderName(rowOwner(r), lk)}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => rowDate(a).localeCompare(rowDate(b)) || routeName(rowRoute(a), lk).localeCompare(routeName(rowRoute(b), lk)));
}

/** Every holder that has a lock, for the holder filter, sorted by name. */
export function holderOptions(rows: readonly LockRow[], lk: Lookup): { key: string; name: string }[] {
  const m = new Map<string, string>();
  for (const r of rows) m.set(holderKey(rowOwner(r)), holderName(rowOwner(r), lk));
  return [...m].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export interface RowGroup {
  key: string;
  label: string;
  color: string;
  rows: LockRow[];
  /** "3 ล็อก · 2 เส้นทาง" */
  meta: string;
  /** Seats single-day locks hold now, and bulk seats per departure. */
  dayHeld: number;
  bulkPax: number;
}

/** bkV2RenderLocks' grouping (booking.js:870-901). `none` gives one unlabelled group. */
export function groupRows(rows: readonly LockRow[], by: GroupBy, lk: Lookup): RowGroup[] {
  if (!rows.length) return [];
  const sums = (list: readonly LockRow[]) => ({
    dayHeld: list.reduce((n, r) => n + (r.kind === 'lock' ? held(r.lock, r.kids) : 0), 0),
    bulkPax: list.reduce((n, r) => n + (r.kind === 'group' && rowActive(r) ? r.group.pax : 0), 0),
  });
  if (by === 'none') return [{ key: '', label: '', color: '', rows: [...rows], meta: '', ...sums(rows) }];
  const keyOf = (r: LockRow) => (by === 'holder' ? holderKey(rowOwner(r)) : rowRoute(r));
  const out = new Map<string, LockRow[]>();
  for (const r of rows) out.set(keyOf(r), [...(out.get(keyOf(r)) ?? []), r]);
  return [...out].map(([key, list]): RowGroup => {
    const first = list[0]!;
    const meta = by === 'holder'
      ? `${list.length} ล็อก · ${new Set(list.map(rowRoute)).size} เส้นทาง`
      : `${list.length} ล็อก · ${new Set(list.map((r) => holderKey(rowOwner(r)))).size} ผู้ถือ`;
    return {
      key, meta, rows: list, ...sums(list),
      label: by === 'holder' ? holderName(rowOwner(first), lk) : routeName(rowRoute(first), lk),
      color: by === 'holder' ? holderColor(rowOwner(first), lk) : routeColor(rowRoute(first), lk),
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

// ── Bulk locks ──

export const DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export interface GroupStats {
  /** Departures created / already gone (legacy bkV2LockRounds). */
  total: number;
  past: number;
  /** Seats drawn across every day and sub-group. */
  used: number;
  /** Used as a % of what past departures offered. */
  pct: number;
}
export function groupStats(r: Extract<LockRow, { kind: 'group' }>, today: string): GroupStats {
  const past = r.days.filter((d) => d.service_date < today).length;
  const used = [...r.days, ...r.kids].reduce((n, l) => n + drawn(l), 0);
  const offered = r.group.pax * past;
  return { total: r.days.length, past, used, pct: offered ? Math.min(100, Math.round((used / offered) * 100)) : 0 };
}

/** A group's sub-groups, one per name across its days (legacy shows a bulk lock's sub-groups once). */
export function groupSubGroups(kids: readonly ObSeatLock[]): { name: string; pax: number; used: number; days: number }[] {
  const by = new Map<string, ObSeatLock[]>();
  for (const k of kids) by.set(k.sub_name || '—', [...(by.get(k.sub_name || '—') ?? []), k]);
  return [...by].map(([name, list]) => ({
    name,
    pax: Math.max(...list.map((k) => k.pax)),
    used: list.reduce((n, k) => n + drawn(k), 0),
    days: list.filter((k) => k.status === 'active').length,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Release times ──

/** bkV2LockCutoffLabel: "ปล่อย 1 วันก่อน 18:00", or '' with no rule. */
export function releaseRuleLabel(rule: ObReleaseRule): string {
  if (rule.release_days_before === undefined || !rule.release_time) return '';
  return `ปล่อย ${rule.release_days_before === 0 ? 'วันเดินทาง' : `${rule.release_days_before} วันก่อน`} ${rule.release_time}`;
}

/** The release pill of the day table (booking.js:704-709). */
export function releaseCountdown(releaseAt: string | undefined, now: number): { tone: 'passed' | 'soon' | 'later' | 'none'; text: string } {
  if (!releaseAt) return { tone: 'none', text: '—' };
  const at = new Date(releaseAt);
  const diff = at.getTime() - now;
  if (diff <= 0) return { tone: 'passed', text: 'ปล่อยแล้ว' };
  if (diff <= 48 * 3600e3) return { tone: 'soon', text: `อีก ${Math.max(1, Math.round(diff / 3600e3))} ชม.` };
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return { tone: 'later', text: `${at.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${hm}` };
}

// ── Day view and KPIs ──

/** bkV2LocksOnDate: active top-level locks on one day, single or bulk, by holder then route (booking.js:692). */
export function locksOn(locks: readonly ObSeatLock[], date: string, lk: Lookup): ObSeatLock[] {
  return locks
    .filter((l) => !l.parent_id && l.status === 'active' && l.service_date === date)
    .sort((a, b) => holderName(a, lk).localeCompare(holderName(b, lk)) || routeName(a.route_id, lk).localeCompare(routeName(b.route_id, lk)));
}

export interface LockKpis {
  active: number;
  activeDay: number;
  activeBulk: number;
  tomorrow: { held: number; locks: number; routes: number };
  /** Seats held on each of the next 14 days, today first. */
  spark: number[];
  drawn: number;
  /** Drawn as a % of every seat offered so far: a day lock's pax, a bulk lock's pax per past departure. */
  conversion: number;
  /** Departures whose release time comes within 48 hours, and the seats that will go back. */
  soon: { rounds: number; seats: number };
}

/** The KPI cards (booking.js:636-671). */
export function lockKpis(rows: readonly LockRow[], locks: readonly ObSeatLock[], today: string, now: number, lk: Lookup): LockKpis {
  const kids = childrenIndex(locks);
  const heldOf = (l: ObSeatLock) => held(l, kids.get(l.id));
  const heldOn = (d: string) => locksOn(locks, d, lk).reduce((n, l) => n + heldOf(l), 0);
  const tmr = locksOn(locks, addDays(today, 1), lk);
  const active = rows.filter(rowActive);
  const offered = rows.reduce((n, r) => n + (r.kind === 'lock' ? r.lock.pax : r.group.pax * groupStats(r, today).past), 0);
  const totalDrawn = locks.reduce((n, l) => n + drawn(l), 0);
  const soon = { rounds: 0, seats: 0 };
  for (const l of locks) {
    if (l.parent_id || !l.release_at || !isHolding(l)) continue;
    const diff = Date.parse(l.release_at) - now;
    if (diff > 0 && diff <= 48 * 3600e3) { soon.rounds++; soon.seats += heldOf(l); }
  }
  return {
    active: active.length,
    activeDay: active.filter((r) => r.kind === 'lock').length,
    activeBulk: active.filter((r) => r.kind === 'group').length,
    tomorrow: { held: tmr.reduce((n, l) => n + heldOf(l), 0), locks: tmr.length, routes: new Set(tmr.map((l) => l.route_id)).size },
    spark: Array.from({ length: 14 }, (_, i) => heldOn(addDays(today, i))),
    drawn: totalDrawn,
    conversion: offered ? Math.round((totalDrawn / offered) * 100) : 0,
    soon,
  };
}

// ── Claims and coverage (the detail dialog) ──

const live = (b: ObBooking) => !CXL.has(b.status);
const tripPax = (t: ObBooking['trips'][number]) => t.pax_total || Object.values(t.pax).reduce((n, v) => n + v, 0);

export interface Claim {
  bookingId: string;
  code: string;
  lead: string;
  qty: number;
}

/** bkV2LockClaims: the live bookings that drew seats from any of `lockIds`, and how many each. */
export function lockClaims(bookings: readonly ObBooking[], lockIds: string | readonly string[]): Claim[] {
  const ids = new Set(typeof lockIds === 'string' ? [lockIds] : lockIds);
  const out: Claim[] = [];
  for (const b of bookings) {
    if (!live(b)) continue;
    const qty = b.trips.reduce((n, t) => n + Object.entries(t.lock_draws ?? {}).reduce((m, [id, q]) => m + (ids.has(id) ? q : 0), 0), 0);
    if (qty > 0) out.push({ bookingId: b.id, code: displayCode(b), lead: b.lead_pax || '', qty });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export interface CoverageRow extends Claim {
  pax: number;
  /** Drawn from this lock (or its sub-groups) / from another lock / from the general pool. */
  self: number;
  other: number;
  pool: number;
}
export interface Coverage {
  bookings: number;
  pax: number;
  self: number;
  other: number;
  pool: number;
  rows: CoverageRow[];
}

/**
 * bkV2LockCoverage (booking.js:272): the lock agent's own bookings on the same route and day, and
 * how many of their seats came from this lock and its sub-groups, another lock or the general pool.
 * A pool seat with seats still held usually means someone forgot to pick the lock. null = no agent.
 */
export function lockCoverage(bookings: readonly ObBooking[], l: ObSeatLock, kids: readonly ObSeatLock[] = []): Coverage | null {
  if (!l.agent_id) return null;
  const mine = new Set([l.id, ...kids.map((k) => k.id)]);
  const rows: CoverageRow[] = [];
  for (const b of bookings) {
    if (!live(b) || b.agent_id !== l.agent_id) continue;
    for (const t of b.trips) {
      if (t.route_id !== l.route_id || t.service_date !== l.service_date || t.charter_boat_id) continue;
      const pax = tripPax(t);
      let self = 0, other = 0;
      for (const [id, q] of Object.entries(t.lock_draws ?? {})) { if (mine.has(id)) self += q; else other += q; }
      rows.push({ bookingId: b.id, code: displayCode(b), lead: b.lead_pax || '', qty: self, pax, self, other, pool: Math.max(pax - self - other, 0) });
    }
  }
  const sum = (k: 'pax' | 'self' | 'other' | 'pool') => rows.reduce((n, r) => n + r[k], 0);
  return { bookings: new Set(rows.map((r) => r.bookingId)).size, pax: sum('pax'), self: sum('self'), other: sum('other'), pool: sum('pool'), rows };
}

// ── Writes ──

/** The most seats "คืน" can give back: a parent only its seats in no sub-group (bkV2LockReleaseConfirm). */
export const giveBackMax = (l: ObSeatLock, kids: readonly ObSeatLock[] = []): number => (isHolding(l) ? lockTree(l, kids).unallocated : 0);

/**
 * How giving back `n` seats maps onto the backend (bkV2ReleaseLock, booking.js:353). Part of them →
 * lower `pax`. All of them → release the lock, unless bookings or sub-groups still take seats; then
 * shrink it to exactly those, as legacy kept such a lock `depleted` rather than `released`.
 */
export function releasePlan(l: ObSeatLock, n: number, kids: readonly ObSeatLock[] = []): { kind: 'amend'; pax: number } | { kind: 'release' } | null {
  const max = giveBackMax(l, kids);
  if (n <= 0 || n > max) return null;
  if (n < max) return { kind: 'amend', pax: l.pax - n };
  const floor = lockTree(l, kids).floor;
  return floor > 0 ? { kind: 'amend', pax: floor } : { kind: 'release' };
}

/** laCanEditArea('operations') (01-auth-sync.js:1057). The backend checks its own write scope too. */
export function canEditOperations(me: Me | null): boolean {
  if (!me) return false;
  if (me.role === 'admin') return true;
  if (Array.isArray(me.editAreas)) return me.editAreas.includes('operations');
  return me.canEdit !== false;
}
