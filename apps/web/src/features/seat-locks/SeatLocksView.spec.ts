import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useSessionStore, type Me } from '@/stores/session';

import SeatLocksView from './SeatLocksView.vue';

const TMR = '2026-10-03';
const lock = (id: string, extra = {}) => ({ id, route_id: 'r3', service_date: TMR, pax: 10, status: 'active', created_at: '', updated_at: '', drawn_pax: 0, ...extra });

type Call = { method: string; url: string; body?: unknown };
/** Answers /api/ob/* the way operation-backend would. `reply` overrides one "METHOD path". */
function stubApi(reply: Record<string, [number, unknown]> = {}) {
  const calls: Call[] = [];
  const locks = [lock('L1', { agent_id: 'a1', drawn_pax: 2 }), lock('L2', { pax: 4 }), lock('L3', { agent_id: 'a2', status: 'released', service_date: '2026-09-20' })];
  const body: Record<string, unknown> = {
    'GET /api/ob/v1/seat-locks': { seat_locks: locks },
    'GET /api/ob/v1/seat-lock-groups': { seat_lock_groups: [] },
    'GET /api/ob/v1/routes': { routes: [{ id: 'r3', name: 'Similan Islands', color: '#185FA5' }] },
    'GET /api/ob/v1/agents': { agents: [{ id: 'a1', name: 'Sea Tours', code: 'ST', active: true }, { id: 'a2', name: 'Old Agent', code: 'OA', active: false }] },
    'GET /api/ob/v1/bookings': { bookings: [] },
    'PATCH /api/ob/v1/seat-locks/L1': { ...locks[0], pax: 13 },
    'POST /api/ob/v1/seat-locks/L2/release': { ...locks[1], status: 'released' },
    'POST /api/ob/v1/seat-locks': lock('L9', { agent_id: 'a1', pax: 6 }),
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = `${method} ${url.split('?')[0]}`;
    if (reply[key]) return new Response(JSON.stringify(reply[key][1]), { status: reply[key][0] });
    return key in body ? new Response(JSON.stringify(body[key]), { status: 200 }) : new Response('{"message":"unexpected"}', { status: 500 });
  }));
  return calls;
}

async function mountPage(me: Partial<Me> = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useSessionStore().me = { username: 'ops', name: 'ops', role: 'admin', perms: null, canEdit: true, editAreas: null, salesId: null, legacyData: false, ...me };
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/bookings/locks', component: SeatLocksView },
    { path: '/:rest(.*)*', component: { template: '<div />' } },
  ] });
  router.push('/bookings/locks');
  await router.isReady();
  const w = mount(SeatLocksView, { global: { plugins: [router, pinia] }, attachTo: document.body });
  await flushPromises();
  return w;
}
const body = () => document.body;
const button = (text: string) => [...body().querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

describe('SeatLocksView', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-02T10:00:00+07:00')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('loads every lock with inactive agents included, and groups active ones by holder', async () => {
    const calls = stubApi();
    const w = await mountPage();
    expect(calls.map((c) => c.url)).toEqual(expect.arrayContaining(['/api/ob/v1/seat-locks', '/api/ob/v1/agents?active=all']));
    const groups = w.findAll('.lock-group__name').map((g) => g.text());
    expect(groups).toEqual(['Office / pool', 'Sea Tours']);
    // KPI: 2 active; tomorrow holds 8 + 4.
    expect(w.findAll('.lock-kpi__value b').map((b) => b.text()).slice(0, 2)).toEqual(['2', '12']);
    // The day table opens on tomorrow.
    expect(w.find('.lock-day__date').text()).toContain('พรุ่งนี้');
    expect(w.findAll('.lock-day tbody tr')).toHaveLength(2);
    w.unmount();
  });

  it('shows released locks under "ทั้งหมด", naming an inactive agent', async () => {
    stubApi();
    const w = await mountPage();
    await w.findAll('.seg__btn').find((b) => b.text() === 'ทั้งหมด')!.trigger('click');
    expect(w.findAll('.lock-group__name').map((g) => g.text())).toContain('Old Agent');
    w.unmount();
  });

  it('adds seats with a PATCH of pax + n', async () => {
    const calls = stubApi();
    const w = await mountPage();
    w.findAll('.lock-main .btn--ok')[1]!.trigger('click');   // Sea Tours' L1 (second group)
    await flushPromises();
    const input = body().querySelector<HTMLInputElement>('.lock-seats__add input')!;
    input.value = '3';
    input.dispatchEvent(new Event('input'));
    button('เพิ่มที่นั่ง')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'PATCH')).toEqual({ method: 'PATCH', url: '/api/ob/v1/seat-locks/L1', body: { pax: 13 } });
    expect(body().querySelector('.dialog')).toBeNull();
    w.unmount();
  });

  it('releases an undrawn lock with POST /release when every held seat goes back', async () => {
    const calls = stubApi();
    const w = await mountPage();
    w.findAll('.lock-main .btn--danger')[0]!.trigger('click');   // Office / pool's L2, 4 held
    await flushPromises();
    button('Release 4')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'POST')?.url).toBe('/api/ob/v1/seat-locks/L2/release');
    w.unmount();
  });

  it("keeps a drawn lock at what was drawn instead of releasing it", async () => {
    const calls = stubApi({ 'PATCH /api/ob/v1/seat-locks/L1': [200, lock('L1', { agent_id: 'a1', pax: 2, drawn_pax: 2 })] });
    const w = await mountPage();
    w.findAll('.lock-main .btn--danger')[1]!.trigger('click');   // L1: 10 seats, 2 drawn → 8 held
    await flushPromises();
    button('Release 8')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ pax: 2 });
    expect(calls.some((c) => c.url.endsWith('/release'))).toBe(false);
    w.unmount();
  });

  it("creates a lock for an agent picked by name, and shows the backend's 409 message", async () => {
    const calls = stubApi({ 'POST /api/ob/v1/seat-locks': [409, { statusCode: 409, error: 'Conflict', message: 'Insufficient available seats' }] });
    const w = await mountPage();
    await w.find('.seat-locks__new').trigger('click');
    const set = (sel: string, v: string, ev = 'input') => { const el = body().querySelector<HTMLInputElement>(sel)!; el.value = v; el.dispatchEvent(new Event(ev)); };
    set('.lock-form__route select', 'r3', 'change');
    set('.lock-form__agent input', 'sea tours');
    set('.lock-form__qty input', '6');
    await flushPromises();
    button('สร้างล็อก')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ route_id: 'r3', service_date: TMR, pax: 6, agent_id: 'a1' });
    expect(body().querySelector('.dialog [role="alert"]')?.textContent).toContain('Insufficient available seats');
    w.unmount();
  });

  it('refuses an agent name that is not in the catalogue without calling the backend', async () => {
    const calls = stubApi();
    const w = await mountPage();
    await w.find('.seat-locks__new').trigger('click');
    const route = body().querySelector<HTMLSelectElement>('.lock-form__route select')!;
    route.value = 'r3'; route.dispatchEvent(new Event('change'));
    const agent = body().querySelector<HTMLInputElement>('.lock-form__agent input')!;
    agent.value = 'Nobody'; agent.dispatchEvent(new Event('input'));
    const qty = body().querySelector<HTMLInputElement>('.lock-form__qty input')!;
    qty.value = '2'; qty.dispatchEvent(new Event('input'));
    await flushPromises();
    button('สร้างล็อก')!.click();
    await flushPromises();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(body().querySelector('.dialog [role="alert"]')?.textContent).toContain('ไม่พบเอเจ้นนี้');
    w.unmount();
  });

  it('hides every write for a user without operations edit rights', async () => {
    stubApi();
    const w = await mountPage({ role: 'staff', editAreas: ['finance'] });
    expect(w.findAll('.lock-group__name').length).toBeGreaterThan(0);
    expect(w.find('.seat-locks__new').exists()).toBe(false);
    expect(w.findAll('.btn--ok, .btn--danger')).toHaveLength(0);
    expect(w.findAll('.lock-main .btn').map((b) => b.text())).toEqual(['รายละเอียด', 'รายละเอียด']);
    w.unmount();
  });

  it("opens a lock's detail with the vouchers that drew from it", async () => {
    stubApi({ 'GET /api/ob/v1/bookings': [200, { bookings: [{ id: 'lg_BK-7', status: 'confirmed', created_at: '', updated_at: '', agent_id: 'a1',
      lead_pax: 'Ann', passengers: [], route_id: 'r3', service_date: TMR, pax: 2,
      trips: [{ id: 't', seq: 1, route_id: 'r3', service_date: TMR, booking_mode: 'seat', pax: { ad: 2 }, pax_total: 2, lock_draws: { L1: 2 } }] }] }] });
    const w = await mountPage();
    w.findAll('.lock-main .btn').filter((b) => b.text() === 'รายละเอียด')[1]!.trigger('click');
    await flushPromises();
    expect(body().querySelector('.lock-detail__voucher')?.textContent).toContain('BK-7 · 2');
    expect(body().querySelector('.lock-detail')?.textContent).toContain('ดึงจากล็อกครบ');
    w.unmount();
  });

  it('keeps working on a backend without bulk locks, with Bulk switched off', async () => {
    stubApi({ 'GET /api/ob/v1/seat-lock-groups': [404, { message: 'Route GET:/v1/seat-lock-groups not found' }] });
    const w = await mountPage();
    expect(w.findAll('.lock-group__name').map((g) => g.text())).toEqual(['Office / pool', 'Sea Tours']);
    expect(w.findAll('.btn--sub')).toHaveLength(0);
    await w.find('.seat-locks__new').trigger('click');
    expect(button('Bulk · ช่วงวันที่')?.disabled).toBe(true);
    w.unmount();
  });

  it('creates a bulk lock and lists the departures it skipped', async () => {
    const G = { id: 'G1', route_id: 'r3', agent_id: 'a1', date_from: TMR, date_to: '2026-10-15', weekdays: [1, 4], pax: 5,
      release_days_before: 1, release_time: '18:00', created_at: '', updated_at: '' };
    const calls = stubApi({ 'POST /api/ob/v1/seat-lock-groups': [201, {
      group: G, seat_locks: [lock('G1d', { agent_id: 'a1', group_id: 'G1', service_date: '2026-10-05', pax: 5 })],
      skipped: [{ service_date: '2026-10-08', reason: 'insufficient_seats', message: '2 seats available, 5 needed' }],
    }] });
    const w = await mountPage();
    await w.find('.seat-locks__new').trigger('click');
    button('Bulk · ช่วงวันที่')!.click();
    await flushPromises();
    const set = (sel: string, v: string, ev = 'input') => { const el = body().querySelector<HTMLInputElement>(sel)!; el.value = v; el.dispatchEvent(new Event(ev)); };
    set('.lock-form__route select', 'r3', 'change');
    set('.lock-form__range-inputs input[aria-label="To"]', '2026-10-15');
    set('.lock-form__agent input', 'ST');
    set('.lock-form__qty input', '5');
    for (const d of ['จ', 'พฤ']) [...body().querySelectorAll<HTMLButtonElement>('.lock-form__dow-day')].find((b) => b.textContent === d)!.click();
    await flushPromises();
    button('สร้างล็อก')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', url: '/api/ob/v1/seat-lock-groups', body: {
      route_id: 'r3', date_from: TMR, date_to: '2026-10-15', weekdays: [1, 4], pax: 5, agent_id: 'a1', release_days_before: 1, release_time: '18:00',
    } });
    expect(w.find('.seat-locks__notice').text()).toContain('ข้าม 1 รอบ');
    expect(w.find('.seat-locks__skipped').text()).toContain('2 seats available, 5 needed');
    expect(w.findAll('.lock-main .chip--bulk').some((c) => c.text() === 'Bulk')).toBe(true);
    w.unmount();
  });

  it('shows a bulk lock as one row, and adds seats to every departure', async () => {
    const G = { id: 'G1', route_id: 'r3', agent_id: 'a1', date_from: '2026-09-28', date_to: '2026-10-06', weekdays: [1], pax: 5, created_at: '', updated_at: '' };
    const days = [lock('G1a', { agent_id: 'a1', group_id: 'G1', service_date: '2026-09-28', pax: 5, drawn_pax: 2 }), lock('G1b', { agent_id: 'a1', group_id: 'G1', service_date: '2026-10-05', pax: 5 })];
    const calls = stubApi({
      'GET /api/ob/v1/seat-locks': [200, { seat_locks: days }],
      'GET /api/ob/v1/seat-lock-groups': [200, { seat_lock_groups: [G] }],
      'PATCH /api/ob/v1/seat-lock-groups/G1': [200, { group: { ...G, pax: 8 }, seat_locks: days.map((d) => ({ ...d, pax: 8 })), skipped: [] }],
    });
    const w = await mountPage();
    const rows = w.findAll('.lock-main .lock-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain('2026-09-28');
    expect(rows[0]!.text()).toContain('ผ่านมา 1/2 รอบ');
    await rows[0]!.find('.btn--ok').trigger('click');
    const input = body().querySelector<HTMLInputElement>('.lock-seats__add input')!;
    input.value = '3';
    input.dispatchEvent(new Event('input'));
    button('เพิ่มที่นั่ง')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'PATCH')).toEqual({ method: 'PATCH', url: '/api/ob/v1/seat-lock-groups/G1', body: { pax: 8 } });
    expect(w.find('.lock-main .lock-row').text()).toContain('8');
    w.unmount();
  });

  it('carves a sub-group out of a lock and lists it under the lock', async () => {
    const calls = stubApi({ 'POST /api/ob/v1/seat-locks/L1/sub-groups': [201, lock('L1a', { agent_id: 'a1', parent_id: 'L1', sub_name: 'A', pax: 3 })] });
    const w = await mountPage();
    await w.findAll('.lock-main .btn--sub')[1]!.trigger('click');   // Sea Tours' L1: 10 seats, 2 drawn → 8 free
    expect(body().querySelector('.lock-sub__summary')?.textContent).toContain('ยังไม่ได้แบ่ง 8 ที่');
    const pax = body().querySelector<HTMLInputElement>('.lock-sub__pax input')!;
    pax.value = '3';
    pax.dispatchEvent(new Event('input'));
    button('สร้างกรุ๊ปย่อย')!.click();
    await flushPromises();
    expect(calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', url: '/api/ob/v1/seat-locks/L1/sub-groups', body: { sub_name: 'A', pax: 3 } });
    await w.find('.lock-row__toggle').trigger('click');
    expect(w.find('.lock-row--child').text()).toContain('A');
    expect(w.find('.lock-row--child').text()).toContain('แบ่งจาก Sea Tours');
    w.unmount();
  });
});
