import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import ByTripView from './ByTripView.vue';

const D = '2026-09-24';

/** GET /operations/van-board for D: BK-1 in group 1 on Van 7, the charter left unassigned. */
const VAN_BOARD = {
  date: D,
  vans: [{ id: 'v7', name: 'Van 7', plate: 'นข 1234', capacity: 12, usable: true, route_ids: ['r3'], driver: 'Somchai', driver_phone: '0812345678' }],
  trips: [{
    route_id: 'r3', pool: { outbound: ['v7'] }, totals: { unassigned_pax: 0, self_arrive_pax: 0 },
    groups: [{ id: 'vg1', number: 1, zone: 'PK', van_id: 'v7', return_van_id: null, pickup_time: '06:40', pax: 2, capacity: 12,
      over_capacity: false, round: null, round_warning: null }],
    allocations: [{ booking_id: 'lg_BK-1', booking_trip_id: 't1', idx: 0, split: false, status: 'confirmed', zone: 'PK', leg: 'out',
      pax: { ad: 2, chd: 0, inf: 0, foc: 0, total: 2 }, group_id: 'vg1', sequence: null,
      pickup: { hotel: 'Kata Beach Resort', time_booked: '06:30-06:45', time_final: '06:40' },
      return: { needed: false, self: false, same_van: false, van_id: null, alert: false, pool: [] } }],
  }],
  warnings: { no_outbound_van: [{ route_id: 'r10', bookings: 1, pax: 12 }], no_return_van: [], van_on_two_routes: [] },
};

/** Answers the page's /api/ob/* requests the way operation-backend would. `vanBoard: null` = the backend lacks it (404). */
function stubApi(opts: { vanBoard?: object | null } = {}) {
  const calls: string[] = [];
  const trip = (id: string, route_id: string, pax: Record<string, number>, extra = {}) =>
    ({ id, seq: 1, route_id, service_date: D, booking_mode: 'seat', pax, pax_total: 0, ...extra });
  const bk = (id: string, t: object, extra = {}) => ({ id, status: 'confirmed', created_at: '', updated_at: '', passengers: [],
    trips: [t], route_id: 'r3', service_date: D, pax: 0, total: 3400, ...extra });
  const body: Record<string, unknown> = {
    '/api/ob/v1/bookings': { bookings: [
      bk('lg_BK-1', trip('t1', 'r3', { ad_fr: 2 }), { external_id: 'BK-1', voucher_ref: 'V-100', lead_pax: 'Anna Smith', pickup_zone: 'PK',
        hotel_name: 'Kata Beach Resort', agent_id: 'a02', payment_method: 'invoice', passengers: [{ seq: 1, name: 'Ben Smith' }] }),
      bk('lg_BK-2', trip('t2', 'r3', { ad: 1 }), { voucher_ref: 'V-200', lead_pax: 'Carl', status: 'cancelled' }),
      bk('lg_BK-3', trip('t3', 'r10', { ad: 12 }, { booking_mode: 'charter', charter_boat_id: 'b13' }), { voucher_ref: 'V-300', lead_pax: 'Dana' }),
    ] },
    '/api/ob/v1/routes': { routes: [
      { id: 'r3', name: 'Similan Islands - PG', pier: 'tublamu', family_id: 'similan', times: ['08:30'], days: { [D]: { open: true, source: 'season' } } },
      { id: 'r10', name: 'Phi Phi Bamboo by Speedboat', pier: 'panwa', family_id: 'phiphi', times: ['09:00'], days: { [D]: { open: true, source: 'season' } } },
    ] },
    '/api/ob/v1/boats': { boats: [{ id: 'b1', name: 'Aluminous1', capacity: 64, license_pax: 75, charter_ceiling: 75 },
      { id: 'b13', name: 'Oceanus', capacity: 38, license_pax: 45, charter_ceiling: 45 }] },
    '/api/ob/v1/availability': { days: [
      { route_id: 'r3', service_date: D, open: true, deployed_capacity: 64, licensed_capacity: 75, booked_pax: 2, charter_pax: 0, locked_pax: 0,
        available_seats: 62, deployments: [{ boat_id: 'b1', capacity: 64, license_pax: 75, chartered: false }] },
    ] },
    '/api/ob/v1/seat-locks': { seat_locks: [] },
    '/api/me': { username: 'ops', name: 'ops', role: 'admin', perms: null, legacyData: false },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const path = url.split('?')[0]!;
    if (path === '/api/ob/operations/van-board') {
      return opts.vanBoard === null ? new Response('{"message":"Not Found"}', { status: 404 }) : new Response(JSON.stringify(opts.vanBoard ?? VAN_BOARD), { status: 200 });
    }
    const b = body[path];
    return b ? new Response(JSON.stringify(b), { status: 200 }) : new Response('{"error":"unexpected"}', { status: 500 });
  }));
  return calls;
}

async function mountAt(query: Record<string, string>) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/bookings/trips', component: ByTripView },
    { path: '/:rest(.*)*', component: { template: '<div />' } },
  ] });
  router.push({ path: '/bookings/trips', query });
  await router.isReady();
  const w = mount(ByTripView, { global: { plugins: [router, createPinia()] } });
  await flushPromises();
  return { w, router };
}

describe('ByTripView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads one day from operation-backend and renders the manifest', async () => {
    const calls = stubApi();
    const { w } = await mountAt({ date: D });
    expect(calls).toContain(`/api/ob/v1/bookings?from=${D}&to=${D}&limit=100`);
    expect(calls).toContain(`/api/ob/v1/seat-locks?date=${D}`);
    const text = w.text();
    expect(text).toContain('Similan Islands - PG');
    expect(text).toContain('Phuket');                              // zone band
    expect(text).toContain('V-100');
    expect(text).toContain('Kata Beach Resort');
    expect(text).toContain('Invoice');
    expect(text).toContain('CHARTER');
    expect(text).toContain('Oceanus');
    expect(text).toContain('Cancelled · 1 booking');
    expect(w.findAll('tr.t2-row')).toHaveLength(2);                // the cancelled row is not in the manifest
    expect(w.find('a.t2-vcbtn').attributes('href')).toBe('/bookings/lg_BK-1');
  });

  it('opens the passenger list and filters by programme from the URL', async () => {
    stubApi();
    const { w, router } = await mountAt({ date: D });
    await w.find('button.t2-more').trigger('click');
    expect(w.text()).toContain('Ben Smith');
    await router.replace({ path: '/bookings/trips', query: { date: D, fam: 'phiphi' } });
    await flushPromises();
    expect(w.text()).not.toContain('V-100');
    expect(w.text()).toContain('V-300');
  });

  it('van mode: swaps the columns, groups the rows under their van and shows the day warning', async () => {
    const calls = stubApi();
    const { w, router } = await mountAt({ date: D });
    expect(calls).toContain(`/api/ob/operations/van-board?date=${D}`);
    expect(w.find('.t2-hd-warnchip--van').text()).toContain('12');          // the charter has no outbound van
    expect(w.find('.bt-mc.warn .n').text()).toBe('1');
    expect(w.findAll('thead th').map((th) => th.text())).toContain('Pay');

    await w.find('button.bt-mc').trigger('click');                          // Van
    await flushPromises();
    expect(router.currentRoute.value.query.mode).toBe('van');
    const heads = w.findAll('thead th').map((th) => th.text());
    expect(heads).not.toContain('Pay');
    expect(heads).not.toContain('Add-on');
    expect(heads).not.toContain('Total');
    expect(heads).toContain('✓ กลุ่ม');
    expect(w.find('.t2-mtbl').classes()).toContain('t2-van');
    expect(w.find('#vg-vg1').text()).toContain('กรุ๊ป 1');
    expect(w.find('#vg-vg1').text()).toContain('2/12 pax');
    expect(w.find('#vg-vg1').text()).toContain('Somchai');
    expect(w.text()).toContain('06:40');
    expect(w.text()).toContain('ยังไม่ assign · 1 booking · 12 pax');       // the charter row, in its own zone
    expect(w.find('.bt-vans').text()).toContain('Van 7');
    expect(w.findAll('.bt-vans select, .t2-mtbl select').every((s) => s.attributes('disabled') !== undefined)).toBe(true);
  });

  it('van mode without the backend endpoint: says so and keeps the plain manifest', async () => {
    stubApi({ vanBoard: null });
    const { w } = await mountAt({ date: D, mode: 'van' });
    expect(w.find('.bt-vans').text()).toContain('Van assignment is not in operation-backend yet');
    expect(w.find('.bt-mc .s').text()).toBe('not in backend yet');
    expect(w.findAll('tr.t2-row')).toHaveLength(2);
    expect(w.find('.van-group-head').exists()).toBe(false);
  });
});
