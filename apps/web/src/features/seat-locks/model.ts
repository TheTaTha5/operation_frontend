// Seat Locks tab rules, kept pure so they can be tested without a page. Each one names the legacy
// function it replaces (allotment_v2/js/booking.js). Spec: apps/web/docs/porting/seat-locks.md.
//
// operation-backend models a lock as one route × one date × `pax` seats, optionally for one agent,
// with `drawn_pax` derived from the bookings that draw on it (cancelled ones excluded). Bulk ranges,
// sub-groups, release cutoffs and notes are not in the backend yet (spec §3, drafts A–D).
import { addDays } from '@/lib/date';
import type { ObAgentSummary, ObBooking, ObRoute, ObSeatLock } from '@/lib/ob';
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
  status: 'active' | 'all';
  groupBy: GroupBy;
}
export const DEFAULT_FILTERS: LockFilters = { q: '', routeId: '', holder: '', status: 'active', groupBy: 'holder' };

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

export const holderKey = (l: ObSeatLock): string => l.agent_id || NO_AGENT_KEY;
/** bkV2LockHolderName. An agent the catalogue doesn't know shows its raw id. */
export const holderName = (l: ObSeatLock, lk: Lookup): string =>
  l.agent_id ? lk.agents.get(l.agent_id)?.name || l.agent_id : NO_AGENT_NAME;
/** bkV2LockHolderColor: the agent's own colour, else its hash colour; the legacy office slate otherwise. */
export const holderColor = (l: ObSeatLock, lk: Lookup): string =>
  l.agent_id ? lk.agents.get(l.agent_id)?.color || agentColor(l.agent_id) : '#64748B';
export const routeName = (id: string, lk: Lookup): string => lk.routes.get(id)?.name || id;
/** #9C9C95 is legacy's fallback when a route has no colour (booking.js:628). */
export const routeColor = (id: string, lk: Lookup): string => lk.routes.get(id)?.color || '#9C9C95';

export const drawn = (l: ObSeatLock): number => l.drawn_pax ?? 0;
/**
 * Seats the lock still keeps off general sale: bkV2LockHeldRemaining. The backend's
 * `remaining = max(pax − drawn, 0)` (capacity.ts); a released lock holds nothing.
 */
export const held = (l: ObSeatLock): number => (l.status === 'active' ? Math.max(l.pax - drawn(l), 0) : 0);
/** Legacy kept `depleted` as a stored status; here it is an active lock with nothing left to draw. */
export const lockStatus = (l: ObSeatLock): LockStatus =>
  l.status === 'released' ? 'released' : held(l) === 0 ? 'depleted' : 'active';

/** The filter block of bkV2RenderLocks (booking.js:759-773): nearest date first, then route. */
export function filterLocks(locks: readonly ObSeatLock[], f: LockFilters, lk: Lookup): ObSeatLock[] {
  const q = f.q.trim().toLowerCase();
  return locks
    .filter((l) => {
      if (f.status === 'active' && l.status !== 'active') return false;
      if (f.routeId && l.route_id !== f.routeId) return false;
      if (f.holder && holderKey(l) !== f.holder) return false;
      if (q && !`${routeName(l.route_id, lk)} ${holderName(l, lk)}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => a.service_date.localeCompare(b.service_date) || routeName(a.route_id, lk).localeCompare(routeName(b.route_id, lk)));
}

/** Every holder that has a lock, for the holder filter, sorted by name. */
export function holderOptions(locks: readonly ObSeatLock[], lk: Lookup): { key: string; name: string }[] {
  const m = new Map<string, string>();
  for (const l of locks) m.set(holderKey(l), holderName(l, lk));
  return [...m].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export interface LockGroup {
  key: string;
  label: string;
  color: string;
  locks: ObSeatLock[];
  /** "3 ล็อก · 2 เส้นทาง" */
  meta: string;
  held: number;
}

/** bkV2RenderLocks' grouping (booking.js:870-901). `none` gives one unlabelled group. */
export function groupLocks(rows: readonly ObSeatLock[], by: GroupBy, lk: Lookup): LockGroup[] {
  if (!rows.length) return [];
  if (by === 'none') return [{ key: '', label: '', color: '', locks: [...rows], meta: '', held: rows.reduce((n, l) => n + held(l), 0) }];
  const keyOf = (l: ObSeatLock) => (by === 'holder' ? holderKey(l) : l.route_id);
  const out = new Map<string, ObSeatLock[]>();
  for (const l of rows) out.set(keyOf(l), [...(out.get(keyOf(l)) ?? []), l]);
  return [...out].map(([key, locks]): LockGroup => {
    const first = locks[0]!;
    const meta = by === 'holder'
      ? `${locks.length} ล็อก · ${new Set(locks.map((l) => l.route_id)).size} เส้นทาง`
      : `${locks.length} ล็อก · ${new Set(locks.map(holderKey)).size} ผู้ถือ`;
    return {
      key,
      label: by === 'holder' ? holderName(first, lk) : routeName(first.route_id, lk),
      color: by === 'holder' ? holderColor(first, lk) : routeColor(first.route_id, lk),
      locks,
      meta,
      held: locks.reduce((n, l) => n + held(l), 0),
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

/** bkV2LocksOnDate: active locks on one day, by holder then route (booking.js:692). */
export function locksOn(locks: readonly ObSeatLock[], date: string, lk: Lookup): ObSeatLock[] {
  return locks
    .filter((l) => l.status === 'active' && l.service_date === date)
    .sort((a, b) => holderName(a, lk).localeCompare(holderName(b, lk)) || routeName(a.route_id, lk).localeCompare(routeName(b.route_id, lk)));
}

export interface LockKpis {
  active: number;
  tomorrow: { held: number; locks: number; routes: number };
  /** Seats held on each of the next 14 days, today first. */
  spark: number[];
  drawn: number;
  /** Drawn as a % of every seat ever offered in a lock. */
  conversion: number;
}

/** The KPI cards (booking.js:636-671). The 48h release card needs draft C, so it isn't computed. */
export function lockKpis(locks: readonly ObSeatLock[], today: string, lk: Lookup): LockKpis {
  const heldOn = (d: string) => locksOn(locks, d, lk).reduce((n, l) => n + held(l), 0);
  const tmr = locksOn(locks, addDays(today, 1), lk);
  const offered = locks.reduce((n, l) => n + l.pax, 0);
  const totalDrawn = locks.reduce((n, l) => n + drawn(l), 0);
  return {
    active: locks.filter((l) => l.status === 'active').length,
    tomorrow: { held: tmr.reduce((n, l) => n + held(l), 0), locks: tmr.length, routes: new Set(tmr.map((l) => l.route_id)).size },
    spark: Array.from({ length: 14 }, (_, i) => heldOn(addDays(today, i))),
    drawn: totalDrawn,
    conversion: offered ? Math.round((totalDrawn / offered) * 100) : 0,
  };
}

const live = (b: ObBooking) => !CXL.has(b.status);
const tripPax = (t: ObBooking['trips'][number]) => t.pax_total || Object.values(t.pax).reduce((n, v) => n + v, 0);

export interface Claim {
  bookingId: string;
  code: string;
  lead: string;
  qty: number;
}

/** bkV2LockClaims: the live bookings that drew seats from this lock, and how many each. */
export function lockClaims(bookings: readonly ObBooking[], lockId: string): Claim[] {
  const out: Claim[] = [];
  for (const b of bookings) {
    if (!live(b)) continue;
    const qty = b.trips.reduce((n, t) => n + (t.lock_draws?.[lockId] ?? 0), 0);
    if (qty > 0) out.push({ bookingId: b.id, code: displayCode(b), lead: b.lead_pax || '', qty });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export interface CoverageRow extends Claim {
  pax: number;
  /** Drawn from this lock / from another lock / from the general pool. */
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
 * how many of their seats came from this lock, another lock or the general pool. A pool seat with
 * seats still held usually means someone forgot to pick the lock when booking. null = no agent.
 */
export function lockCoverage(bookings: readonly ObBooking[], l: ObSeatLock): Coverage | null {
  if (!l.agent_id) return null;
  const rows: CoverageRow[] = [];
  for (const b of bookings) {
    if (!live(b) || b.agent_id !== l.agent_id) continue;
    for (const t of b.trips) {
      if (t.route_id !== l.route_id || t.service_date !== l.service_date || t.charter_boat_id) continue;
      const draws = t.lock_draws ?? {};
      const pax = tripPax(t);
      const self = draws[l.id] ?? 0;
      const other = Object.entries(draws).reduce((n, [id, q]) => n + (id === l.id ? 0 : q), 0);
      rows.push({ bookingId: b.id, code: displayCode(b), lead: b.lead_pax || '', qty: self, pax, self, other, pool: Math.max(pax - self - other, 0) });
    }
  }
  const sum = (k: 'pax' | 'self' | 'other' | 'pool') => rows.reduce((n, r) => n + r[k], 0);
  return { bookings: new Set(rows.map((r) => r.bookingId)).size, pax: sum('pax'), self: sum('self'), other: sum('other'), pool: sum('pool'), rows };
}

/**
 * How giving back `n` held seats maps onto the backend (bkV2ReleaseLock, booking.js:353). Part of the
 * hold → lower `pax`. All of it → release the lock, unless bookings drew from it; then keep it at
 * what they drew, as legacy kept a drawn-from lock as `depleted` instead of `released`.
 */
export function releasePlan(l: ObSeatLock, n: number): { kind: 'amend'; pax: number } | { kind: 'release' } | null {
  const max = held(l);
  if (n <= 0 || n > max) return null;
  if (n < max) return { kind: 'amend', pax: l.pax - n };
  return drawn(l) > 0 ? { kind: 'amend', pax: drawn(l) } : { kind: 'release' };
}

/** laCanEditArea('operations') (01-auth-sync.js:1057). The backend checks its own write scope too. */
export function canEditOperations(me: Me | null): boolean {
  if (!me) return false;
  if (me.role === 'admin') return true;
  if (Array.isArray(me.editAreas)) return me.editAreas.includes('operations');
  return me.canEdit !== false;
}
