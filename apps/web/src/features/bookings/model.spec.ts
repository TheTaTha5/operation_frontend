import { describe, expect, it } from 'vitest';

import type { ObBooking, ObRoute } from '@/lib/ob';

import { displayCode, isB2C, kpis, matchesPill, matchesSearch, monthList, paxBreak, paxSplit, tripSummary } from './model';

const routes = new Map<string, ObRoute>([
  ['r3', { id: 'r3', name: 'Similan Islands - PG' }],
  ['r7', { id: 'r7', name: 'Early OTA Phi Phi Bamboo' }],
]);

function bk(over: Partial<ObBooking> & { id: string }): ObBooking {
  const trips = over.trips ?? [{ id: 't1', seq: 1, route_id: 'r3', service_date: '2026-09-10', booking_mode: 'seat', pax: { ad_fr: 2, chd_th: 1 }, pax_total: 3 }];
  return { status: 'confirmed', created_at: '2026-09-01T03:00:00Z', updated_at: '2026-09-01T03:00:00Z', passengers: [],
    route_id: trips[0]!.route_id, service_date: trips[0]!.service_date, pax: 3, ...over, trips };
}

describe('booking list model', () => {
  it('splits the flat pax grid by age category across trips', () => {
    const b = bk({ id: 'x', trips: [
      { id: 't1', seq: 1, route_id: 'r3', service_date: '2026-09-10', booking_mode: 'seat', pax: { ad: 1, ad_fr: 2, chd_th: 1, foc_fr: 1 }, pax_total: 5 },
      { id: 't2', seq: 2, route_id: 'r7', service_date: '2026-09-11', booking_mode: 'seat', pax: { inf_th: 1 }, pax_total: 1 },
    ] });
    const p = paxSplit(b);
    expect(p).toEqual({ ad: 3, chd: 1, inf: 1, foc: 1, total: 6 });
    expect(paxBreak(p)).toBe('3A · 1C · 1I · 1 FOC');
    expect(tripSummary(b, routes)).toBe('2 trips · Similan + Early');
    expect(tripSummary(bk({ id: 'y' }), routes)).toBe('Similan Islands - PG');
  });

  it('shows the legacy BK number, or the voucher for B2C', () => {
    expect(displayCode(bk({ id: 'lg_BK-26090877-990L', external_id: 'BK-26090877-990L' }))).toBe('BK-26090877-990L');
    const b2c = bk({ id: 'lg_b2c_LOV-7358225_1', external_id: 'b2c_LOV-7358225_1', agent_id: 'a_b2c' });
    expect(isB2C(b2c)).toBe(true);
    expect(displayCode(b2c)).toBe('LOV-7358225');
    expect(displayCode({ ...b2c, voucher_ref: 'VC-9' })).toBe('VC-9');
  });

  it('keeps a month to bookings whose first trip is in it, newest travel date first', () => {
    const later = bk({ id: 'a', trips: [
      { id: 't', seq: 1, route_id: 'r3', service_date: '2026-08-30', booking_mode: 'seat', pax: { ad: 1 }, pax_total: 1 },
      { id: 'u', seq: 2, route_id: 'r3', service_date: '2026-09-02', booking_mode: 'seat', pax: { ad: 1 }, pax_total: 1 },
    ] });
    const d10 = bk({ id: 'b' });
    const d12 = bk({ id: 'c', trips: [{ id: 't', seq: 1, route_id: 'r7', service_date: '2026-09-12', booking_mode: 'seat', pax: { ad: 2 }, pax_total: 2 }] });
    expect(monthList([later, d10, d12], '2026-09').map((b) => b.id)).toEqual(['c', 'b']);
  });

  it('filters by pill and search, and counts the KPIs', () => {
    const list = [
      bk({ id: 'lg_BK-1', external_id: 'BK-1', lead_pax: 'Anna Smith', total: 3400 }),
      bk({ id: 'lg_BK-2', external_id: 'BK-2', status: 'cancelled_weather', total: 1000 }),
      bk({ id: 'lg_BK-3', external_id: 'BK-3', status: 'pending_foc', lead_phone: '0812345678' }),
      bk({ id: 'lg_BK-4', external_id: 'BK-4', status: 'quote', total: 500 }),
    ];
    expect(list.filter((b) => matchesPill(b, 'cancelled')).map((b) => b.id)).toEqual(['lg_BK-2']);
    expect(list.filter((b) => matchesSearch(b, 'anna', routes)).map((b) => b.id)).toEqual(['lg_BK-1']);
    expect(list.filter((b) => matchesSearch(b, '081234', routes)).map((b) => b.id)).toEqual(['lg_BK-3']);
    expect(list.filter((b) => matchesSearch(b, 'similan', routes))).toHaveLength(4);
    expect(kpis(list)).toEqual({ total: 4, confirmed: 1, confirmedRevenue: 3400, pendingFoc: 1, quote: 1 });
  });
});
