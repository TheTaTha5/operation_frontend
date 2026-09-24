import { describe, expect, it } from 'vitest';

import type { ObAvailabilityDay, ObBoat, ObBooking, ObRouteDays, ObSeatLock, ObTrip } from '@/lib/ob';

import { agentColor, boatInitials, buildDay, collectRows, contrastInk, familyOf, notRunWhy, tint, type Filters } from './byTrip';

const D = '2026-09-24';
const routes: ObRouteDays[] = [
  { id: 'r3', name: 'Similan Islands - PG', pier: 'tublamu', family_id: 'similan', color: '#185fa5', times: ['08:30'], days: { [D]: { open: true, source: 'season' } } },
  { id: 'r5', name: 'Similan Islands by Speedboat', pier: 'tublamu', family_id: 'similan', times: ['07:30'], days: { [D]: { open: false, source: 'override' } } },
  { id: 'r7', name: 'Early OTA Phi Phi Bamboo', pier: 'panwa', family_id: 'phiphi', times: ['07:15'], days: { [D]: { open: true, source: 'season' } } },
  { id: 'r10', name: 'Phi Phi Bamboo by Speedboat', pier: 'panwa', family_id: 'phiphi', times: ['09:00'], days: { [D]: { open: true, source: 'season' } } },
];
const boats: ObBoat[] = [
  { id: 'b1', name: 'Aluminous1', capacity: 64, license_pax: 75, charter_ceiling: 75 },
  { id: 'b13', name: 'Oceanus', capacity: 38, license_pax: 45, charter_ceiling: 45 },
];
const days: ObAvailabilityDay[] = [
  { route_id: 'r3', service_date: D, open: true, deployed_capacity: 64, licensed_capacity: 75, booked_pax: 5, charter_pax: 0, locked_pax: 4, available_seats: 55,
    deployments: [{ boat_id: 'b1', capacity: 64, license_pax: 75, chartered: false }] },
  { route_id: 'r10', service_date: D, open: true, deployed_capacity: 0, licensed_capacity: 45, booked_pax: 0, charter_pax: 12, locked_pax: 0, available_seats: 0,
    deployments: [{ boat_id: 'b13', capacity: 38, license_pax: 45, chartered: true }] },
];

let n = 0;
function trip(route_id: string, pax: Record<string, number>, over: Partial<ObTrip> = {}): ObTrip {
  return { id: `t${++n}`, seq: 1, route_id, service_date: D, booking_mode: 'seat', pax, pax_total: Object.values(pax).reduce((a, b) => a + b, 0), ...over };
}
function bk(id: string, trips: ObTrip[], over: Partial<ObBooking> = {}): ObBooking {
  return { id, status: 'confirmed', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', passengers: [], trips,
    route_id: trips[0]!.route_id, service_date: trips[0]!.service_date, pax: 0, total: 3400, ...over };
}
const F: Filters = { pier: 'all', fam: '', route: '', q: '', sort: { col: '', dir: 'asc' } };

const bookings: ObBooking[] = [
  bk('A', [trip('r3', { ad_fr: 2, chd_th: 1 })], { pickup_zone: 'PK', lead_pax: 'Anna', agent_id: 'a02', pickup_area: 'Patong' }),
  bk('B', [trip('r3', { ad: 2 })], { pickup_zone: 'KL', agent_id: 'a01', guide_russian: true, special_meals_veg: 1, pickup_area: 'Bangtao' }),
  bk('C', [trip('r3', { ad: 4 })], { pickup_zone: 'PK', status: 'cancelled' }),
  bk('D', [trip('r3', { ad: 1 })], { pickup_zone: 'PK', status: 'pending_approval' }),
  bk('E', [trip('r10', { ad: 12 }, { booking_mode: 'charter', charter_boat_id: 'b13' })], { total: 50000 }),
  // Multi-trip: only today's leg is a row, and its amount is unknown.
  bk('F', [trip('r7', { ad: 2 }), trip('r7', { ad: 2 }, { service_date: '2026-09-25' })], { pickup_zone: 'PK' }),
];
const locks: ObSeatLock[] = [
  { id: 'L1', route_id: 'r3', service_date: D, pax: 6, drawn_pax: 2, agent_id: 'a09', status: 'active', created_at: '', updated_at: '' },
  { id: 'L2', route_id: 'r3', service_date: D, pax: 5, agent_id: 'a09', status: 'released', created_at: '', updated_at: '' },
];
const build = (f: Partial<Filters> = {}) => buildDay({ date: D, bookings, routes, boats, days, locks }, { ...F, ...f });

describe('by trip · date model', () => {
  it('makes one row per booking trip on the day, with the amount only for single-trip bookings', () => {
    const rows = collectRows(bookings, D);
    expect(rows.map((r) => r.b.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(rows.find((r) => r.b.id === 'A')).toMatchObject({ zone: 'PK', amount: 3400, cxl: false, pax: { ad: 2, chd: 1, total: 3 } });
    expect(rows.find((r) => r.b.id === 'F')!.amount).toBeNull();
    expect(rows.find((r) => r.b.id === 'E')).toMatchObject({ charter: true, charterBoatId: 'b13' });
  });

  it('totals the whole day without cancelled rows', () => {
    const v = build({ pier: 'panwa' });
    // A 3 + B 2 + D 1 + E 12 + F 2, whatever the pier filter; C is cancelled.
    expect(v.totals).toEqual({ bookings: 5, pax: 20, ad: 19, chd: 1, inf: 0, foc: 0 });
  });

  it('orders trips by family (earliest departure first), then departure time', () => {
    const v = build();
    expect(v.routeIds).toEqual(['r7', 'r10', 'r3']);   // Phi Phi family starts 07:15, Similan 08:30
  });

  it('groups a trip by zone with the charter pseudo-zone first, and keeps pending and cancelled out', () => {
    const r3 = build().trips.find((t) => t.rid === 'r3')!;
    expect(r3.zones.map((z) => [z.label, z.rows.map((r) => r.b.id)])).toEqual([['Phuket', ['A']], ['Khao Lak', ['B']]]);
    expect(r3.pend.map((r) => r.b.id)).toEqual(['D']);
    expect(r3.cxl.map((r) => r.b.id)).toEqual(['C']);
    expect(r3.seats).toMatchObject({ booked: 5, cap: 64, free: 55, locked: 4, cls: 'ok', boats: 1 });
    const r10 = build().trips.find((t) => t.rid === 'r10')!;
    expect(r10.zones[0]).toMatchObject({ charter: true, pax: 12, charterItems: [{ bn: 'Oceanus', cap: 38, px: 12 }] });
    expect(r10.seats.cls).toBe('full');
  });

  it('builds the programmes card per family, with not-running variants and pending counted', () => {
    const v = build();
    const sim = v.famList.find((a) => a.fam.id === 'similan')!;
    expect(sim.pax).toBe(6);                              // A 3 + B 2 + D 1 (pending counts here, as legacy)
    expect(sim.variants.map((x) => [x.rid, x.open])).toEqual([['r3', true]]);
    expect(v.famList.map((a) => a.fam.id)).toEqual(['phiphi', 'similan']);   // by pax
  });

  it('filters by pier, family, route and search', () => {
    expect(build({ pier: 'panwa' }).routeIds).toEqual(['r7', 'r10']);
    expect(build({ fam: 'similan' }).routeIds).toEqual(['r3']);
    expect(build({ route: 'r10' }).routeIds).toEqual(['r10']);
    const s = build({ q: 'anna' });
    expect(s.routeIds).toEqual(['r3']);
    expect(s.hits).toBe(1);
  });

  it('sorts rows by agency or pickup area inside a zone', () => {
    const bs = [...bookings, bk('G', [trip('r3', { ad: 1 })], { pickup_zone: 'PK', agent_id: 'a00', pickup_area: 'Kata' })];
    const zoneRows = (f: Partial<Filters>) => buildDay({ date: D, bookings: bs, routes, boats, days, locks }, { ...F, ...f })
      .trips.find((t) => t.rid === 'r3')!.zones[0]!.rows.map((r) => r.b.id);
    expect(zoneRows({})).toEqual(['A', 'G']);
    expect(zoneRows({ sort: { col: 'agency', dir: 'asc' } })).toEqual(['G', 'A']);
    expect(zoneRows({ sort: { col: 'zone', dir: 'desc' } })).toEqual(['A', 'G']);
  });

  it('lists boats with charter loads and the seat lock holders', () => {
    const v = build();
    expect(v.boatsOf('r10')).toEqual([{ id: 'b13', name: 'Oceanus', col: '#A82E73', pax: 12, cap: 38, chartered: true, over: false }]);
    expect(v.boatsOf('r3')[0]).toMatchObject({ id: 'b1', pax: null, cap: 64 });
    expect(v.locks).toEqual([{ nm: 'a09', qty: 6, left: 4 }]);   // the released lock is not counted
    expect(v.prepOf('r3')).toEqual({ lang: [['RU', 2]], veg: 1, vegan: 0, halal: 0, allerg: 0 });
  });

  it('ports the legacy helpers faithfully', () => {
    expect(familyOf({ name: 'Surin Islands by Speedboat' })!.id).toBe('surin');
    expect(familyOf({ name: 'Surin Islands', family_id: '' })).toBeNull();
    expect(notRunWhy('override')).toBe('ปิดเฉพาะวันนี้ (ตั้ง override ไว้)');
    expect(tint('#185fa5', 0.9)).toBe('#e8eff6');
    expect(agentColor('a01')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrastInk('#f1c40f')).toBe('#2c2c2a');
    expect(boatInitials('Tri Star 01')).toBe('TS');
    expect(boatInitials('Aluminous1')).toBe('A1');
  });
});
