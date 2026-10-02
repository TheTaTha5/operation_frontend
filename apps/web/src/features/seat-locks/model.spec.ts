import { describe, expect, it } from 'vitest';

import type { ObAgentSummary, ObBooking, ObRoute, ObSeatLock } from '@/lib/ob';
import type { Me } from '@/stores/session';

import {
  canEditOperations, DEFAULT_FILTERS, filterLocks, groupLocks, held, holderName, lockClaims, lockCoverage, lockKpis, lockStatus,
  lookupOf, releasePlan,
} from './model';

const T = '2026-10-02';
const lock = (id: string, extra: Partial<ObSeatLock> = {}): ObSeatLock => ({
  id, route_id: 'r3', service_date: '2026-10-03', pax: 10, status: 'active', created_at: '', updated_at: '', drawn_pax: 0, ...extra,
});
const routes: ObRoute[] = [{ id: 'r3', name: 'Similan', color: '#185FA5' }, { id: 'r10', name: 'Phi Phi' }];
const agents = [{ id: 'a1', name: 'Sea Tours', code: 'ST', color: '#123456' }, { id: 'a2', name: 'Andaman Go', code: 'AG' }] as ObAgentSummary[];
const lk = lookupOf(routes, agents);

describe('held and status', () => {
  it('holds pax less what bookings drew, never below zero, and nothing once released', () => {
    expect(held(lock('l', { pax: 10, drawn_pax: 4 }))).toBe(6);
    expect(held(lock('l', { pax: 3, drawn_pax: 5 }))).toBe(0);
    expect(held(lock('l', { status: 'released' }))).toBe(0);
  });
  it('calls an active lock with nothing left depleted', () => {
    expect(lockStatus(lock('l'))).toBe('active');
    expect(lockStatus(lock('l', { pax: 4, drawn_pax: 4 }))).toBe('depleted');
    expect(lockStatus(lock('l', { status: 'released' }))).toBe('released');
  });
  it('names the holder from the catalogue, else the raw id, else the office pool', () => {
    expect(holderName(lock('l', { agent_id: 'a1' }), lk)).toBe('Sea Tours');
    expect(holderName(lock('l', { agent_id: 'a9' }), lk)).toBe('a9');
    expect(holderName(lock('l'), lk)).toBe('Office / pool');
  });
});

describe('filter and group', () => {
  const ls = [
    lock('l1', { agent_id: 'a1', service_date: '2026-10-05' }),
    lock('l2', { agent_id: 'a2', route_id: 'r10' }),
    lock('l3', { agent_id: 'a1', status: 'released' }),
    lock('l4'),
  ];
  it('shows active locks by default, nearest date first then route name', () => {
    expect(filterLocks(ls, DEFAULT_FILTERS, lk).map((l) => l.id)).toEqual(['l2', 'l4', 'l1']);
    expect(filterLocks(ls, { ...DEFAULT_FILTERS, status: 'all' }, lk)).toHaveLength(4);
  });
  it('filters by route, holder and search text', () => {
    expect(filterLocks(ls, { ...DEFAULT_FILTERS, routeId: 'r10' }, lk).map((l) => l.id)).toEqual(['l2']);
    expect(filterLocks(ls, { ...DEFAULT_FILTERS, holder: '-' }, lk).map((l) => l.id)).toEqual(['l4']);
    expect(filterLocks(ls, { ...DEFAULT_FILTERS, q: 'sea' }, lk).map((l) => l.id)).toEqual(['l1']);
    expect(filterLocks(ls, { ...DEFAULT_FILTERS, q: 'phi' }, lk).map((l) => l.id)).toEqual(['l2']);
  });
  it('groups by holder with the agent colour and counts', () => {
    const g = groupLocks(filterLocks(ls, DEFAULT_FILTERS, lk), 'holder', lk);
    expect(g.map((x) => x.label)).toEqual(['Andaman Go', 'Office / pool', 'Sea Tours']);
    expect(g[2]).toMatchObject({ color: '#123456', meta: '1 ล็อก · 1 เส้นทาง', held: 10 });
  });
  it('groups by route, or not at all', () => {
    const rows = filterLocks(ls, DEFAULT_FILTERS, lk);
    expect(groupLocks(rows, 'route', lk).map((x) => [x.label, x.meta])).toEqual([['Phi Phi', '1 ล็อก · 1 ผู้ถือ'], ['Similan', '2 ล็อก · 2 ผู้ถือ']]);
    expect(groupLocks(rows, 'none', lk)).toHaveLength(1);
    expect(groupLocks([], 'none', lk)).toEqual([]);
  });
});

describe('lockKpis', () => {
  it('counts tomorrow from active locks only and spreads 14 days of held seats', () => {
    const k = lockKpis([
      lock('a', { pax: 10, drawn_pax: 2 }),
      lock('b', { pax: 5, route_id: 'r10' }),
      lock('c', { pax: 6, status: 'released', drawn_pax: 1 }),
      lock('d', { pax: 4, service_date: T }),
    ], T, lk);
    expect(k.active).toBe(3);
    expect(k.tomorrow).toEqual({ held: 13, locks: 2, routes: 2 });
    expect(k.spark.slice(0, 3)).toEqual([4, 13, 0]);
    expect(k.spark).toHaveLength(14);
    // Drawn 3 of 25 seats offered, released lock included (legacy usedQty / capOffered).
    expect(k.drawn).toBe(3);
    expect(k.conversion).toBe(12);
  });
});

describe('claims and coverage', () => {
  const trip = (extra: object) => ({ id: 't', seq: 1, route_id: 'r3', service_date: '2026-10-03', booking_mode: 'seat', pax: { ad: 4 }, pax_total: 4, ...extra });
  const bk = (id: string, extra: Partial<ObBooking>, t: object): ObBooking =>
    ({ id, status: 'confirmed', created_at: '', updated_at: '', passengers: [], route_id: 'r3', service_date: '2026-10-03', pax: 4, trips: [trip(t)], ...extra }) as ObBooking;
  const bookings = [
    bk('lg_BK-1', { agent_id: 'a1', voucher_ref: 'V1', lead_pax: 'Ann' }, { lock_draws: { L: 3 } }),
    bk('lg_BK-2', { agent_id: 'a1', lead_pax: 'Ben' }, { lock_draws: {} }),
    bk('lg_BK-3', { agent_id: 'a1', status: 'cancelled' }, { lock_draws: { L: 4 } }),
    bk('lg_BK-4', { agent_id: 'a2' }, { lock_draws: { L: 1 } }),
    bk('lg_BK-5', { agent_id: 'a1' }, { lock_draws: { M: 2 }, route_id: 'r10' }),
  ];
  const L = lock('L', { agent_id: 'a1' });

  it('lists the live bookings that drew from the lock', () => {
    expect(lockClaims(bookings, 'L')).toEqual([
      { bookingId: 'lg_BK-1', code: 'BK-1', lead: 'Ann', qty: 3 },
      { bookingId: 'lg_BK-4', code: 'BK-4', lead: '', qty: 1 },
    ]);
  });
  it("splits the holder's own seats on that trip into lock and pool", () => {
    const c = lockCoverage(bookings, L)!;
    expect(c).toMatchObject({ bookings: 2, pax: 8, self: 3, other: 0, pool: 5 });
    expect(c.rows.map((r) => [r.code, r.pool])).toEqual([['BK-1', 1], ['BK-2', 4]]);
    expect(lockCoverage(bookings, lock('L'))).toBeNull();
  });
});

describe('releasePlan', () => {
  it('lowers pax for part of the hold', () => {
    expect(releasePlan(lock('l', { pax: 10, drawn_pax: 2 }), 3)).toEqual({ kind: 'amend', pax: 7 });
  });
  it('releases an undrawn lock outright, and keeps a drawn one at what was drawn', () => {
    expect(releasePlan(lock('l', { pax: 10 }), 10)).toEqual({ kind: 'release' });
    expect(releasePlan(lock('l', { pax: 10, drawn_pax: 2 }), 8)).toEqual({ kind: 'amend', pax: 2 });
  });
  it('refuses zero or more than is held', () => {
    expect(releasePlan(lock('l'), 0)).toBeNull();
    expect(releasePlan(lock('l', { pax: 10, drawn_pax: 2 }), 9)).toBeNull();
  });
});

describe('canEditOperations', () => {
  const me = (extra: Partial<Me>): Me => ({ username: 'u', name: 'u', role: 'staff', perms: null, canEdit: true, editAreas: null, salesId: null, ...extra });
  it('mirrors laCanEditArea("operations")', () => {
    expect(canEditOperations(null)).toBe(false);
    expect(canEditOperations(me({ role: 'admin', canEdit: false }))).toBe(true);
    expect(canEditOperations(me({ editAreas: ['operations'] }))).toBe(true);
    expect(canEditOperations(me({ editAreas: ['finance'] }))).toBe(false);
    expect(canEditOperations(me({ canEdit: false }))).toBe(false);
    expect(canEditOperations(me({}))).toBe(true);
  });
});
