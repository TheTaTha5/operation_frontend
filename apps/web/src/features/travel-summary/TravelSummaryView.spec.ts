import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { DAY, fixture } from './legacy/fixture';
import TravelSummaryView from './TravelSummaryView.vue';

/** Answers the page's requests from the golden-test dataset, the way server.js would. */
function stubApi() {
  const d = fixture();
  const onDay = (b: { trips?: { date?: string }[] }) => (b.trips || []).some((t) => t.date === DAY);
  const resources: Record<string, unknown> = {
    routes: d.routes, boats: d.boats, sb_agents: d.agents, sb_rate_types: d.rateTypes, sb_contracts: d.contracts,
    sb_extras: d.extras, sb_invoices: d.invoices, sb_payments: d.payments, sb_vehicles: d.vehicles,
    sb_pickup_areas: d.pickupAreas, travel_sum: d.travelSum, ts_cot: d.tsCot,
  };
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.startsWith('/api/ck?')) return ok({ date: DAY, version: 1, bookings: d.bookings.filter(onDay) });
    // stored the way legacy saves it: a JSON string inside the JSON value
    if (url === '/api/v1/_meta/ops_stranded') return ok({ key: 'ops_stranded', value: JSON.stringify(d.stranded) });
    const one = /^\/api\/v1\/sb_bookings\/(.+)$/.exec(url);
    if (one) { const b = d.bookings.find((x) => x.id === decodeURIComponent(one[1]!)); return b ? ok(b) : new Response('{}', { status: 404 }); }
    const name = url.replace('/api/v1/', '');
    if (name in resources) return ok({ [name]: resources[name] });
    return new Response('{"error":"unexpected"}', { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

async function mountAt(query: Record<string, string>) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/travel-summary', component: TravelSummaryView }] });
  router.push({ path: '/travel-summary', query });
  await router.isReady();
  const w = mount(TravelSummaryView, { global: { plugins: [router] } });
  await flushPromises();
  return { w, router };
}

describe('TravelSummaryView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads one day without the whole blob and renders overview + manifest', async () => {
    const calls = stubApi();
    const { w } = await mountAt({ date: DAY });
    expect(calls).not.toContain('/api/load');
    expect(calls).toContain('/api/v1/sb_bookings/b9');          // moved away: fetched by id
    const text = w.text();
    expect(text).toContain('TS-20260924-ALL');
    expect(text).toContain('Similan');
    expect(text).toContain('Phi Phi');
    expect(text).toContain('V-100');
    expect(text).toContain('V-600');                            // cancelled row still listed
    expect(text).toContain('เลื่อนวันแล้ว');                      // moved row
    expect(text).not.toContain('V-800');                        // rejected never shows
    expect(text).toContain('เก็บบางส่วน · ฿800');                // b1's decision
    expect(w.findAll('tr.grp')).toHaveLength(2);
  });

  it('route and VAT filters narrow the manifest and go into the URL', async () => {
    stubApi();
    const { w, router } = await mountAt({ date: DAY });
    const r1 = w.findAll('button.pill').find((b) => b.text().startsWith('Similan'))!;
    await r1.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.route).toBe('r1');
    expect(w.findAll('tr.grp')).toHaveLength(1);
    expect(w.text()).toContain('TS-20260924-R1');
    const vat = w.findAll('button.pill').find((b) => b.text().startsWith('มี VAT'))!;
    await vat.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.vat).toBe('vat');
    expect(w.text()).not.toContain('V-200');                    // ag2 has no VAT mode
  });

  it('shows a sign-in link when the session is gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"login required"}', { status: 401 })));
    const { w } = await mountAt({ date: DAY });
    expect(w.text()).toContain('ยังไม่ได้เข้าสู่ระบบ');
  });
});
