import { describe, expect, it } from 'vitest';

import type { ObBooking, ObVanAllocation, ObVanGroup, ObVanOnDay, ObVanTrip } from '@/lib/ob';

import { collectRows, rowCmp, type ZoneBlock } from './byTrip';
import { vanChips, vanWarnings, vanZone } from './vanMode';
import { shade, vanChipPair, vanColor } from './vanColor';

const D = '2026-10-02';
const bk = (id: string, pax: Record<string, number>, extra: Partial<ObBooking> = {}): ObBooking => ({
  id, status: 'confirmed', created_at: '', updated_at: '', passengers: [], route_id: 'r3', service_date: D, pax: 0,
  trips: [{ id: `trip_${id}_0`, seq: 0, route_id: 'r3', service_date: D, booking_mode: 'seat', pax, pax_total: 0 }], ...extra,
});
const zoneOf = (bookings: ObBooking[]): ZoneBlock => {
  const rows = collectRows(bookings, D);
  return { zone: 'PK', charter: false, label: 'Phuket', color: '#185FA5', rows, pax: 0, charterItems: [] };
};
const alloc = (bid: string, idx: number, total: number, extra: Partial<ObVanAllocation> = {}): ObVanAllocation => ({
  booking_id: bid, booking_trip_id: `trip_${bid}_0`, idx, split: false, status: 'confirmed', zone: 'PK', leg: 'out',
  pax: { ad: total, chd: 0, inf: 0, foc: 0, total }, group_id: null, sequence: null, pickup: {},
  return: { needed: false, self: false, same_van: false, van_id: null, alert: false, pool: [] }, ...extra,
});
const group = (id: string, number: number, extra: Partial<ObVanGroup> = {}): ObVanGroup => ({
  id, number, zone: 'PK', van_id: null, return_van_id: null, pickup_time: null, pax: 0, capacity: null, over_capacity: false,
  round: null, round_warning: null, ...extra,
});
const van = (id: string, extra: Partial<ObVanOnDay> = {}): ObVanOnDay => ({ id, name: id.toUpperCase(), capacity: 12, usable: true, route_ids: ['r3'], ...extra });
const noSort = rowCmp({ col: '', dir: 'asc' });

describe('vanZone', () => {
  it('puts ungrouped rows first, then groups by number, members by manual order then time', () => {
    const z = zoneOf([bk('a', { ad: 2 }), bk('b', { ad: 3 }), bk('c', { ad: 1 }), bk('d', { ad: 4 })]);
    const trip: ObVanTrip = {
      route_id: 'r3', pool: { outbound: ['v7'] }, totals: { unassigned_pax: 2, self_arrive_pax: 0 },
      groups: [group('g2', 2), group('g1', 1, { van_id: 'v7' })],
      allocations: [
        alloc('a', 0, 2),
        alloc('b', 0, 3, { group_id: 'g1', pickup: { time_booked: '07:30' } }),
        alloc('c', 0, 1, { group_id: 'g1', sequence: 1, pickup: { time_booked: '08:00' } }),
        alloc('d', 0, 4, { group_id: 'g2' }),
      ],
    };
    const vz = vanZone(z, trip, [van('v7')], noSort);
    expect(vz.unassigned.map((r) => r.row.b.id)).toEqual(['a']);
    expect(vz.unassignedPax).toBe(2);
    expect(vz.groups.map((g) => g.group.number)).toEqual([1, 2]);
    expect(vz.groups[0]!.rows.map((r) => r.row.b.id)).toEqual(['c', 'b']);   // sequence 1 before the unsequenced 07:30
    expect(vz.groups[0]!.van?.id).toBe('v7');
    expect(vz.groups[0]!.colors).toEqual(vanChipPair(van('v7')));
    expect(vz.groups[1]!.van).toBeNull();
  });

  it('shows a split booking as one row per allocation, and a trip the board lacks as one ungrouped row', () => {
    const z = zoneOf([bk('a', { ad: 5 }), bk('b', { ad: 2 })]);
    const trip: ObVanTrip = {
      route_id: 'r3', pool: { outbound: [] }, totals: { unassigned_pax: 0, self_arrive_pax: 0 }, groups: [group('g1', 1)],
      allocations: [alloc('a', 1, 2, { split: true, group_id: 'g1' }), alloc('a', 0, 3, { split: true })],
    };
    const vz = vanZone(z, trip, [], noSort);
    expect(vz.unassigned.map((r) => [r.row.b.id, r.pax.total, r.first])).toEqual([['a', 3, true], ['b', 2, true]]);
    expect(vz.groups[0]!.rows.map((r) => [r.key.endsWith('@1'), r.pax.total, r.first])).toEqual([[true, 2, false]]);
  });
});

describe('vanChips', () => {
  it('lists pax per round and flags a van only when one round is over capacity', () => {
    const trip: ObVanTrip = {
      route_id: 'r3', pool: { outbound: ['v7'] }, totals: { unassigned_pax: 0, self_arrive_pax: 0 },
      groups: [group('g1', 1, { van_id: 'v7', pax: 4 }), group('g2', 2, { van_id: 'v7', pax: 9 })],
      allocations: [alloc('a', 0, 4, { group_id: 'g1', pickup: { area: 'Kata' } }), alloc('b', 0, 9, { group_id: 'g2', pickup: { area: 'Karon' } })],
    };
    const [c] = vanChips(trip, [van('v7')]);
    expect(c!.roundPax).toEqual([4, 9]);                           // 13 in total on a 12-seat van, but no round is over
    expect(c!.over).toBe(false);
    expect(c!.groupNumbers).toEqual([1, 2]);
    expect(c!.areas).toEqual(['Kata', 'Karon']);
  });
});

describe('vanWarnings', () => {
  it('sums the per-route warnings', () => {
    const w = vanWarnings({ date: D, vans: [], trips: [], warnings: {
      no_outbound_van: [{ route_id: 'r3', bookings: 2, pax: 5 }, { route_id: 'r10', bookings: 1, pax: 2 }],
      no_return_van: [], van_on_two_routes: [{ van_id: 'v9', route_ids: ['r3', 'r10'] }] } });
    expect(w.outbound).toEqual({ bookings: 3, pax: 7 });
    expect(w.ret).toEqual({ bookings: 0, pax: 0 });
    expect(w.twoRoutes).toHaveLength(1);
    expect(vanWarnings(null).outbound.bookings).toBe(0);
  });
});

describe('vanColor', () => {
  it('uses the van colour, else a stable colour from its id', () => {
    expect(vanColor({ id: 'v1', color: '#123456' })).toBe('#123456');
    expect(vanColor({ id: 'v1' })).toBe(vanColor({ id: 'v1', color: 'red' }));
  });
  it('matches legacy vjShade / vehChipPair', () => {
    expect(shade('#0F6E56', -30)).toBe('#0b4d3c');
    expect(vanChipPair({ id: 'x', color: '#0F6E56' })).toEqual(['#e0ece9', '#0b4d3c']);
  });
});
