import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import AgentsView from './AgentsView.vue';

const AGENTS = [
  { id: 'a1', code: 'SUN', name: 'Sun Tour', market_id: 'ru', sub_market: 'Moscow', sales_id: 's1', pay_type: 'invoice', credit_limit: 200000,
    rate_type_id: 'rt1', program_route_ids: ['r5', 'r9'], contract_end: '2099-06-30', has_contact: true, house: false, active: true },
  { id: 'a2', code: 'BLU', name: 'Blue Sea', market_id: 'cn', sales_id: 's2', pay_type: 'cot', rate_type_id: null,
    program_route_ids: ['r5'], has_contact: false, house: false, active: true },
];
const DETAIL = {
  ...AGENTS[0], vat_mode: 'exclude', credit_days: 30, contact: 'Ivan', email: 'ivan@sun.example', contract_version: 'v2026-1', contract_start: '2026-01-01',
  company: { legal_name: 'Sun Tour LLC', tax_id: '0105' }, signatory: { name: 'Ivan P.' }, booking_channel: { method: 'email' },
  programs: [{ route_id: 'r5', book_from: '2026-01-01', book_to: '2026-12-31', travel_from: '2026-11-01', travel_to: '2027-04-30' }, { route_id: 'r9' }],
  rate_seasons: [], note: 'VIP',
};

/** Answers /api/ob/* like the agent endpoints drafted in agents.md. `agents: null` = the backend lacks them (404). */
function stubApi(opts: { agents?: unknown[] | null; detailStatus?: number } = {}) {
  const calls: string[] = [];
  const body: Record<string, unknown> = {
    '/api/ob/v1/agents': { agents: opts.agents ?? AGENTS },
    '/api/ob/v1/agents/a1': DETAIL,
    '/api/ob/v1/markets': { markets: [{ id: 'ru', name: 'Russia', color: '#c0392b' }, { id: 'cn', name: 'China', short: 'CN' }] },
    '/api/ob/v1/sales': { sales: [{ id: 's1', code: 'NK', name: 'Nok' }, { id: 's2', name: 'Pim' }] },
    '/api/ob/v1/rate-types': { rate_types: [{ id: 'rt1', code: 'RT1', name: 'Standard', active: true, priced_routes: ['r5'] }] },
    '/api/ob/v1/routes': { routes: [{ id: 'r5', name: 'Similan Islands' }, { id: 'r9', name: 'Surin Islands' }] },
    '/api/ob/v1/agents/a1/activity': { activity: [{ at: '2026-09-20T03:00:00Z', by: 'nok', kind: 'rate', text: 'Rate Type: RT0 → RT1' }] },
    '/api/ob/v1/bookings': { bookings: [
      { id: 'lg_BK-1', status: 'confirmed', agent_id: 'a1', voucher_ref: 'V-1', route_id: 'r5', service_date: '2026-10-02', booking_date: '2026-09-01',
        total: 3400, pax: 2, passengers: [], created_at: '', updated_at: '', trips: [{ id: 't', seq: 0, route_id: 'r5', service_date: '2026-10-02', booking_mode: 'seat', pax: { ad: 2 }, pax_total: 2 }] },
      // A backend that ignores agent_id would return this one too; the client drops it.
      { id: 'lg_BK-2', status: 'confirmed', agent_id: 'a2', voucher_ref: 'V-2', route_id: 'r5', service_date: '2026-10-02',
        passengers: [], created_at: '', updated_at: '', pax: 1, trips: [] },
    ] },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const path = url.split('?')[0]!;
    if (opts.agents === null && path.startsWith('/api/ob/v1/agents')) return new Response('{}', { status: 404 });
    if (path === '/api/ob/v1/agents/a1' && opts.detailStatus) return new Response('{}', { status: opts.detailStatus });
    const b = body[path];
    return b ? new Response(JSON.stringify(b), { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
  }));
  return calls;
}

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/agents', name: 'agents', component: AgentsView },
    { path: '/agents/:id', name: 'agent', component: AgentsView },
    { path: '/:rest(.*)*', component: { template: '<div />' } },
  ] });
  router.push(path);
  await router.isReady();
  const w = mount(AgentsView, { global: { plugins: [router, createPinia()] } });
  await flushPromises();
  return { w, router };
}

describe('AgentsView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists agents A–Z with the header counts, and opens one on click', async () => {
    stubApi();
    const { w, router } = await mountAt('/agents');
    expect(w.findAll('.agent-row').map((r) => r.find('.agent-row__name').text())).toEqual([expect.stringContaining('Blue Sea'), expect.stringContaining('Sun Tour')]);
    expect(w.find('.agent-bar').text()).toContain('2');
    expect(w.find('.agent-bar').text()).toContain('Needs action 2');       // Blue Sea has no rate; Sun Tour sells r9 unpriced
    await w.findAll('.agent-row')[1]!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/agents/a1');
    const text = w.find('.agent-detail').text();
    expect(text).toContain('Sun Tour LLC');
    expect(text).toContain('0105');                                          // tax id shown (legacy wiped it on edit)
    expect(text).toContain('Route with no price');
    expect(text).toContain('Surin Islands');
    expect(text).toContain('No price');
  });

  it('keeps search and filters in the URL', async () => {
    stubApi();
    const { w, router } = await mountAt('/agents?market=cn');
    expect(w.findAll('.agent-row')).toHaveLength(1);
    await router.replace('/agents?q=moscow');
    await flushPromises();
    expect(w.findAll('.agent-row').map((r) => r.text())).toEqual([expect.stringContaining('Sun Tour')]);
  });

  it('shows the recent bookings of that agent only, and the activity log', async () => {
    const calls = stubApi();
    const { w, router } = await mountAt('/agents/a1?tab=bookings');
    expect(calls).toContain('/api/ob/v1/bookings?agent_id=a1&sort=-booking_date&limit=15');
    expect(w.text()).toContain('V-1');
    expect(w.text()).not.toContain('V-2');
    await router.replace('/agents/a1?tab=activity');
    await flushPromises();
    expect(w.text()).toContain('Rate Type: RT0 → RT1');
  });

  it('says so when the backend has no agents yet', async () => {
    stubApi({ agents: null });
    const { w } = await mountAt('/agents');
    expect(w.text()).toContain('Agents are not in operation-backend yet');
  });

  it('shows the legacy message for an agent outside the salesperson scope', async () => {
    stubApi({ detailStatus: 403 });
    const { w } = await mountAt('/agents/a1');
    expect(w.text()).toContain('เอเยนต์รายนี้ไม่ได้อยู่ในความดูแลของคุณ');
  });
});
