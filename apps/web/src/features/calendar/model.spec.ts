import { describe, expect, it } from 'vitest';

import type { ObAvailabilityDay, ObBoat, ObRoute } from '@/lib/ob';

import { buildMonth, monthRange } from './model';

const routes: ObRoute[] = [
  { id: 'r1', name: 'Similan', pier: 'tublamu', color: '#185FA5', times: ['08:30'] },
  { id: 'r2', name: 'Phi Phi', pier: 'panwa', color: '#0F6E56', times: ['07:45'] },
  { id: 'r3', name: 'Surin', pier: 'ranong', color: '#BA7517', times: ['09:00'] },
];
const boats: ObBoat[] = [
  { id: 'b1', name: 'Oceanus', capacity: 38, license_pax: 45, charter_ceiling: 45 },
  { id: 'b2', name: 'Zeus', capacity: 30, license_pax: null, charter_ceiling: 30 },
];

function day(route_id: string, service_date: string, over: Partial<ObAvailabilityDay> = {}): ObAvailabilityDay {
  return { route_id, service_date, open: true, deployed_capacity: 0, licensed_capacity: 0, booked_pax: 0, charter_pax: 0,
    locked_pax: 0, available_seats: 0, deployments: [], ...over };
}
const deployed = (cap: number, free: number, chartered = false, boat = 'b1') => ({
  deployed_capacity: cap, available_seats: free,
  deployments: [{ boat_id: boat, capacity: cap, license_pax: null, chartered }],
});

// September 2026: the 1st is a Tuesday.
const Y = 2026, M = 8;
const monthDays = (fill: (date: string) => ObAvailabilityDay[]) => {
  const out: ObAvailabilityDay[] = [];
  for (let d = 1; d <= 30; d++) out.push(...fill(`2026-09-${String(d).padStart(2, '0')}`));
  return out;
};
const none = { pier: '' as const, hidden: new Set<string>() };

describe('calendar month model', () => {
  it('spans the month and pads to a Sunday-first week', () => {
    expect(monthRange(Y, M)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    const v = buildMonth(Y, M, [], routes, boats, none, '2026-09-24');
    expect(v.pad).toBe(2);
    expect(v.cells).toHaveLength(30);
    expect(v.cells[23]).toMatchObject({ date: '2026-09-24', today: true, past: false });
    expect(v.cells[0]!.past).toBe(true);
  });

  it('shows a chip only where a boat runs an open route, sorted by departure time', () => {
    const v = buildMonth(Y, M, [
      day('r1', '2026-09-10', deployed(38, 30)),
      day('r2', '2026-09-10', deployed(30, 0, false, 'b2')),
      day('r3', '2026-09-10'),                                        // open, no boat
      day('r1', '2026-09-11', { ...deployed(38, 38), open: false }),  // closed day
    ], routes, boats, none, '2026-09-01');
    const d10 = v.cells[9]!;
    expect(d10.chips.map((c) => c.routeId)).toEqual(['r2', 'r1']);  // 07:45 before 08:30
    expect(d10.chips[0]).toMatchObject({ full: true, charterOnly: false, free: 0, pctSold: 100 });
    expect(d10.chips[1]).toMatchObject({ free: 30, cap: 38, pctSold: 21 });
    expect(d10.chips[1]!.boats).toEqual([{ id: 'b1', name: 'Oceanus', capacity: 38, chartered: false }]);
    expect(v.cells[10]!.chips).toEqual([]);
    expect(v.stats).toEqual({ trips: 2, free: 30, cap: 68, pctSold: 56 });
  });

  it('marks a day whose seats all went to a charter as CH, not FULL', () => {
    const v = buildMonth(Y, M, [day('r1', '2026-09-05', deployed(38, 0, true))], routes, boats, none, '2026-09-01');
    expect(v.cells[4]!.chips[0]).toMatchObject({ full: true, charterOnly: true });
  });

  it('filters by pier and hides routes, but still lists hidden routes as pills', () => {
    const data = [day('r1', '2026-09-03', deployed(38, 10)), day('r2', '2026-09-03', deployed(30, 5, false, 'b2'))];
    const panwa = buildMonth(Y, M, data, routes, boats, { pier: 'panwa', hidden: new Set() }, '2026-09-01');
    expect(panwa.cells[2]!.chips.map((c) => c.routeId)).toEqual(['r2']);
    const hid = buildMonth(Y, M, data, routes, boats, { pier: '', hidden: new Set(['r1']) }, '2026-09-01');
    expect(hid.cells[2]!.chips.map((c) => c.routeId)).toEqual(['r2']);
    expect(hid.routes.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('reports a pier closed all month once, and a one-day closure on its day', () => {
    const v = buildMonth(Y, M, monthDays((d) => [
      day('r3', d, { open: false }),                          // Ranong shut all month
      day('r2', d, { open: d !== '2026-09-15' }),             // Panwa shut on the 15th only
    ]), routes, boats, none, '2026-09-01');
    expect(v.closedAllMonth).toEqual(['ranong']);
    expect(v.cells[14]!.shut).toEqual(['panwa']);
    expect(v.cells[13]!.shut).toEqual([]);
  });
});
