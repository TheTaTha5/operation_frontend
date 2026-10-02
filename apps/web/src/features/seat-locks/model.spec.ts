import { describe, expect, it } from 'vitest';

import type { ObAgentSummary, ObBooking, ObRoute, ObSeatLock, ObSeatLockGroup } from '@/lib/ob';
import type { Me } from '@/stores/session';

import {
  buildRows, canEditOperations, DEFAULT_FILTERS, filterRows, giveBackMax, groupRows, groupStats, groupSubGroups, held, holderName, lockClaims,
  lockCoverage, lockKpis, lockStatus, lockTree, lookupOf, releaseCountdown, releasePlan, releaseRuleLabel, type LockRow,
} from './model';

const T = '2026-10-02';
const NOW = Date.parse('2026-10-02T03:00:00Z');
const lock = (id: string, extra: Partial<ObSeatLock> = {}): ObSeatLock => ({
  id, route_id: 'r3', service_date: '2026-10-03', pax: 10, status: 'active', created_at: '', updated_at: '', drawn_pax: 0, ...extra,
});
const group = (id: string, extra: Partial<ObSeatLockGroup> = {}): ObSeatLockGroup => ({
  id, route_id: 'r3', date_from: '2026-09-30', date_to: '2026-10-06', weekdays: [], pax: 5, created_at: '', updated_at: '', ...extra,
});
const routes: ObRoute[] = [{ id: 'r3', name: 'Similan', color: '#185FA5' }, { id: 'r10', name: 'Phi Phi' }];
const agents = [{ id: 'a1', name: 'Sea Tours', code: 'ST', color: '#123456' }, { id: 'a2', name: 'Andaman Go', code: 'AG' }] as ObAgentSummary[];
const lk = lookupOf(routes, agents);
const ids = (rows: LockRow[]) => rows.map((r) => r.key);

describe('held and status', () => {
  it('holds pax less what bookings drew, never below zero, and nothing once released or past its release time', () => {
    expect(held(lock('l', { pax: 10, drawn_pax: 4 }))).toBe(6);
    expect(held(lock('l', { pax: 3, drawn_pax: 5 }))).toBe(0);
    expect(held(lock('l', { status: 'released' }))).toBe(0);
    expect(held(lock('l', { holding: false }))).toBe(0);
  });
  it('calls an active lock with nothing left depleted, and one past its release time released', () => {
    expect(lockStatus(lock('l'))).toBe('active');
    expect(lockStatus(lock('l', { pax: 4, drawn_pax: 4 }))).toBe('depleted');
    expect(lockStatus(lock('l', { status: 'released' }))).toBe('released');
    expect(lockStatus(lock('l', { holding: false }))).toBe('released');
  });
  it('names the holder from the catalogue, else the raw id, else the office pool', () => {
    expect(holderName(lock('l', { agent_id: 'a1' }), lk)).toBe('Sea Tours');
    expect(holderName(lock('l', { agent_id: 'a9' }), lk)).toBe('a9');
    expect(holderName(lock('l'), lk)).toBe('Office / pool');
  });
});

describe('sub-groups', () => {
  // 10 seats; A has 4 (3 drawn), released B had 3 (1 drawn); the parent drew 2. operation-backend's lockTree test.
  const parent = lock('p', { drawn_pax: 2 });
  const kids = [lock('a', { parent_id: 'p', sub_name: 'A', pax: 4, drawn_pax: 3 }), lock('b', { parent_id: 'p', sub_name: 'B', pax: 3, drawn_pax: 1, status: 'released' })];
  it('holds once at the parent, as the backend counts it', () => {
    expect(lockTree(parent, kids)).toEqual({ allocated: 5, used: 6, unallocated: 3, held: 4, floor: 7 });
    expect(held(kids[0]!)).toBe(0);
  });
  it('gives back only the seats in no sub-group, and keeps what bookings and sub-groups take', () => {
    expect(giveBackMax(parent, kids)).toBe(3);
    expect(releasePlan(parent, 2, kids)).toEqual({ kind: 'amend', pax: 8 });
    expect(releasePlan(parent, 3, kids)).toEqual({ kind: 'amend', pax: 7 });
    expect(releasePlan(parent, 4, kids)).toBeNull();
  });
  it('lets a sub-group give back its own seats to its parent', () => {
    expect(releasePlan(kids[0]!, 1)).toEqual({ kind: 'amend', pax: 3 });
    expect(releasePlan(lock('c', { parent_id: 'p', pax: 2 }), 2)).toEqual({ kind: 'release' });
  });
});

describe('releasePlan without sub-groups', () => {
  it('lowers pax for part of the hold', () => {
    expect(releasePlan(lock('l', { pax: 10, drawn_pax: 2 }), 3)).toEqual({ kind: 'amend', pax: 7 });
  });
  it('releases an undrawn lock outright, and keeps a drawn one at what was drawn', () => {
    expect(releasePlan(lock('l', { pax: 10 }), 10)).toEqual({ kind: 'release' });
    expect(releasePlan(lock('l', { pax: 10, drawn_pax: 2 }), 8)).toEqual({ kind: 'amend', pax: 2 });
  });
  it('refuses zero, more than is held, or a lock past its release time', () => {
    expect(releasePlan(lock('l'), 0)).toBeNull();
    expect(releasePlan(lock('l', { pax: 10, drawn_pax: 2 }), 9)).toBeNull();
    expect(releasePlan(lock('l', { holding: false }), 1)).toBeNull();
  });
});

describe('rows, filter and group', () => {
  const locks = [
    lock('l1', { agent_id: 'a1', service_date: '2026-10-05' }),
    lock('l2', { agent_id: 'a2', route_id: 'r10' }),
    lock('l3', { agent_id: 'a1', status: 'released' }),
    lock('l4'),
    lock('l4a', { parent_id: 'l4', sub_name: 'A', pax: 3 }),
    lock('g1d1', { agent_id: 'a1', group_id: 'g1', service_date: '2026-10-01', pax: 5, drawn_pax: 2 }),
    lock('g1d2', { agent_id: 'a1', group_id: 'g1', service_date: '2026-10-04', pax: 5 }),
    lock('g1d2a', { agent_id: 'a1', group_id: 'g1', parent_id: 'g1d2', sub_name: 'A', service_date: '2026-10-04', pax: 2, drawn_pax: 1 }),
  ];
  const rows = buildRows(locks, [group('g1', { agent_id: 'a1' })]);
  it('lists single-day locks and one row per bulk lock, sub-groups under their parent', () => {
    expect(ids(rows)).toEqual(['l1', 'l2', 'l3', 'l4', 'g1']);
    const g1 = rows[4]!;
    expect(g1.kind === 'group' && [g1.days.map((d) => d.id), g1.kids.map((k) => k.id)]).toEqual([['g1d1', 'g1d2'], ['g1d2a']]);
    expect(rows[3]!.kids.map((k) => k.id)).toEqual(['l4a']);
  });
  it('shows active rows by default, nearest date first then route name', () => {
    expect(ids(filterRows(rows, DEFAULT_FILTERS, lk))).toEqual(['g1', 'l2', 'l4', 'l1']);
    expect(filterRows(rows, { ...DEFAULT_FILTERS, status: 'all' }, lk)).toHaveLength(5);
  });
  it('filters by type, route, holder and search text', () => {
    expect(ids(filterRows(rows, { ...DEFAULT_FILTERS, scope: 'bulk' }, lk))).toEqual(['g1']);
    expect(ids(filterRows(rows, { ...DEFAULT_FILTERS, scope: 'day' }, lk))).toEqual(['l2', 'l4', 'l1']);
    expect(ids(filterRows(rows, { ...DEFAULT_FILTERS, routeId: 'r10' }, lk))).toEqual(['l2']);
    expect(ids(filterRows(rows, { ...DEFAULT_FILTERS, holder: '-' }, lk))).toEqual(['l4']);
    expect(ids(filterRows(rows, { ...DEFAULT_FILTERS, q: 'sea' }, lk))).toEqual(['g1', 'l1']);
  });
  it('groups by holder with the agent colour, day seats held and bulk seats per departure', () => {
    const g = groupRows(filterRows(rows, DEFAULT_FILTERS, lk), 'holder', lk);
    expect(g.map((x) => x.label)).toEqual(['Andaman Go', 'Office / pool', 'Sea Tours']);
    expect(g[2]).toMatchObject({ color: '#123456', meta: '2 ล็อก · 1 เส้นทาง', dayHeld: 10, bulkPax: 5 });
    expect(groupRows([], 'none', lk)).toEqual([]);
  });
  it('counts a bulk lock\'s departures, its draws and its sub-groups by name', () => {
    const g1 = rows[4] as Extract<LockRow, { kind: 'group' }>;
    expect(groupStats(g1, T)).toEqual({ total: 2, past: 1, used: 3, pct: 60 });
    expect(groupSubGroups(g1.kids)).toEqual([{ name: 'A', pax: 2, used: 1, days: 1 }]);
  });
});

describe('release times', () => {
  it('labels the rule as legacy did', () => {
    expect(releaseRuleLabel({ release_days_before: 1, release_time: '18:00' })).toBe('ปล่อย 1 วันก่อน 18:00');
    expect(releaseRuleLabel({ release_days_before: 0, release_time: '06:00' })).toBe('ปล่อย วันเดินทาง 06:00');
    expect(releaseRuleLabel({})).toBe('');
  });
  it('counts down the last 48 hours, and says when it has passed', () => {
    expect(releaseCountdown(undefined, NOW)).toEqual({ tone: 'none', text: '—' });
    expect(releaseCountdown('2026-10-02T02:00:00Z', NOW)).toEqual({ tone: 'passed', text: 'ปล่อยแล้ว' });
    expect(releaseCountdown('2026-10-03T11:00:00Z', NOW)).toEqual({ tone: 'soon', text: 'อีก 32 ชม.' });
    expect(releaseCountdown('2026-10-09T11:00:00Z', NOW).tone).toBe('later');
  });
});

describe('lockKpis', () => {
  it('counts tomorrow from active locks, spreads 14 days, and the seats going back within 48 hours', () => {
    const locks = [
      lock('a', { pax: 10, drawn_pax: 2, release_at: '2026-10-03T11:00:00Z', holding: true }),
      lock('b', { pax: 5, route_id: 'r10' }),
      lock('c', { pax: 6, status: 'released', drawn_pax: 1 }),
      lock('d', { pax: 4, service_date: T }),
      lock('ga', { pax: 3, group_id: 'g', service_date: '2026-09-30', drawn_pax: 1 }),
    ];
    const k = lockKpis(buildRows(locks, [group('g', { pax: 3 })]), locks, T, NOW, lk);
    expect([k.active, k.activeDay, k.activeBulk]).toEqual([4, 3, 1]);
    expect(k.tomorrow).toEqual({ held: 13, locks: 2, routes: 2 });
    expect(k.spark.slice(0, 3)).toEqual([4, 13, 0]);
    expect(k.spark).toHaveLength(14);
    // Drawn 4 of 28 offered: 25 in day locks, 3 for the bulk lock's one past departure.
    expect(k.drawn).toBe(4);
    expect(k.conversion).toBe(14);
    expect(k.soon).toEqual({ rounds: 1, seats: 8 });
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
    bk('lg_BK-6', { agent_id: 'a1' }, { lock_draws: { LA: 2 }, pax_total: 2 }),
  ];
  const L = lock('L', { agent_id: 'a1' });

  it('lists the live bookings that drew from the lock', () => {
    expect(lockClaims(bookings, 'L')).toEqual([
      { bookingId: 'lg_BK-1', code: 'BK-1', lead: 'Ann', qty: 3 },
      { bookingId: 'lg_BK-4', code: 'BK-4', lead: '', qty: 1 },
    ]);
  });
  it("splits the holder's own seats on that trip into lock (sub-groups included) and pool", () => {
    const c = lockCoverage(bookings, L, [lock('LA', { parent_id: 'L' })])!;
    expect(c).toMatchObject({ bookings: 3, pax: 10, self: 5, other: 0, pool: 5 });
    expect(c.rows.map((r) => [r.code, r.pool])).toEqual([['BK-1', 1], ['BK-2', 4], ['BK-6', 0]]);
    expect(lockCoverage(bookings, lock('L'))).toBeNull();
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
