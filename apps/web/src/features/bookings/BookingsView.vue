<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { localYmd } from '@/lib/date';
import { ob, type ObBooking, type ObRoute } from '@/lib/ob';

import { monthRange, MONTHS } from '../calendar/model';
import {
  displayCode, fmtDate, isB2C, kpis, matchesPill, matchesSearch, monthList, paxBreak, paxSplit, PILLS, type PillKey,
  statusLabel, thb, tripSummary,
} from './model';

const PAGE_SIZE = 50;
const route = useRoute();
const router = useRouter();

// Month, status pill, search and page live in the URL (like Calendar and Travel Summary).
const today = localYmd();
const month = computed(() => (typeof route.query.month === 'string' && /^\d{4}-\d{2}$/.test(route.query.month) ? route.query.month : today.slice(0, 7)));
const pill = computed<PillKey>(() => (PILLS.some((p) => p.k === route.query.st) ? (route.query.st as PillKey) : 'all'));
const q = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
const page = computed(() => Math.max(1, Number(route.query.page) || 1));

function setQuery(patch: Record<string, string | undefined>) {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) if (typeof v === 'string' && v) next[k] = v;
  router.replace({ query: next });
}
function shiftMonth(n: number) {
  const [y, m] = month.value.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + n, 1, 12);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  setQuery({ month: key === today.slice(0, 7) ? undefined : key, page: undefined });
}
const pickPill = (k: PillKey) => setQuery({ st: k === 'all' ? undefined : k, page: undefined });
let typing: ReturnType<typeof setTimeout> | undefined;
function onSearch(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  clearTimeout(typing);
  typing = setTimeout(() => setQuery({ q: v || undefined, page: undefined }), 200);
}
const goPage = (n: number) => setQuery({ page: n > 1 ? String(n) : undefined });

const routes = ref<ObRoute[]>([]);
const bookings = ref<ObBooking[]>([]);
const loadedMonth = ref('');
const loading = ref(false);
const error = ref('');
let seq = 0;
async function load() {
  const my = ++seq;
  const [y, m] = month.value.split('-').map(Number) as [number, number];
  const { from, to } = monthRange(y, m - 1);
  loading.value = true; error.value = '';
  try {
    const [rs, bs] = await Promise.all([routes.value.length ? routes.value : ob.routes(), ob.bookingsBetween(from, to)]);
    if (my !== seq) return;
    routes.value = rs; bookings.value = bs; loadedMonth.value = month.value;
  } catch (e) {
    if (my !== seq) return;
    bookings.value = [];
    error.value = e instanceof ApiError && e.status === 401 ? 'signed-out' : e instanceof Error ? e.message : String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
watch(month, load, { immediate: true });

const routeMap = computed(() => new Map(routes.value.map((r) => [r.id, r])));
const inMonth = computed(() => (loadedMonth.value === month.value ? monthList(bookings.value, month.value) : []));
const k = computed(() => kpis(inMonth.value));
const pillCount = (p: PillKey) => inMonth.value.filter((b) => matchesPill(b, p)).length;
const filtered = computed(() => inMonth.value.filter((b) => matchesPill(b, pill.value) && matchesSearch(b, q.value, routeMap.value)));
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const pageNo = computed(() => Math.min(page.value, pageCount.value));
const rows = computed(() => filtered.value.slice((pageNo.value - 1) * PAGE_SIZE, pageNo.value * PAGE_SIZE).map((b) => {
  const p = paxSplit(b);
  return { b, code: displayCode(b), b2c: isB2C(b), trip: tripSummary(b, routeMap.value), pax: p, break: paxBreak(p) };
}));
const monthLabel = computed(() => { const [y, m] = month.value.split('-'); return `${MONTHS[Number(m) - 1]} ${y}`; });
</script>

<template>
  <section class="bk">
    <header class="hd">
      <h1>Bookings</h1>
      <span class="muted">All bookings · read-only · from operation-backend</span>
    </header>

    <div class="kpis">
      <div class="kpi"><div class="lab">Bookings</div><div class="val">{{ k.total }}</div><div class="foot">travelling in {{ monthLabel }}</div></div>
      <div class="kpi"><div class="lab">Confirmed</div><div class="val ok">{{ k.confirmed }}</div><div class="foot">{{ thb(k.confirmedRevenue) }} booked</div></div>
      <div class="kpi warn"><div class="lab">Pending FOC</div><div class="val">{{ k.pendingFoc }}</div><div class="foot">awaiting approval</div></div>
      <div class="kpi"><div class="lab">Quote</div><div class="val soft">{{ k.quote }}</div><div class="foot">not yet confirmed</div></div>
    </div>

    <div class="filterbar">
      <button v-for="p in PILLS" :key="p.k" type="button" class="pill" :class="[p.k, { on: pill === p.k }]" @click="pickPill(p.k)">
        <span class="dot" />{{ p.label }} · {{ pillCount(p.k) }}
      </button>
      <input class="search" type="search" :value="q" placeholder="ค้นหา · VC · ชื่อลูกค้า · เบอร์ · BK · agent · trip" aria-label="Search bookings" @input="onSearch" />
    </div>

    <div class="monthbar">
      <button type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
      <span class="mo">{{ monthLabel }} <span class="muted">· {{ inMonth.length }} booking{{ inMonth.length === 1 ? '' : 's' }}</span></span>
      <button type="button" aria-label="Next month" @click="shiftMonth(1)">›</button>
      <span v-if="q" class="note">Search covers {{ monthLabel }} only</span>
    </div>

    <p v-if="error === 'signed-out'" class="card">Your session has ended. <RouterLink :to="`/login?next=${encodeURIComponent(route.fullPath)}`">Sign in</RouterLink></p>
    <p v-else-if="error" class="card err">Could not load bookings: {{ error }} <button type="button" class="linklike" @click="load">Retry</button></p>
    <p v-else-if="loading && !rows.length" class="muted">Loading {{ monthLabel }}…</p>
    <div v-else-if="!filtered.length" class="empty">
      <div class="ttl">{{ q ? 'No bookings match' : `No trips in ${monthLabel}` }}</div>
      <div class="muted">{{ q ? `Nothing for "${q}" in ${monthLabel}` : 'Step to another month above.' }}</div>
    </div>

    <div v-else class="tbl-wrap" :class="{ busy: loading }">
      <table class="tbl">
        <thead>
          <tr><th>Booking</th><th>Agent</th><th>Trip</th><th>Travel</th><th class="num">Pax</th><th class="num">Total</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.b.id" @click="router.push(`/bookings/${encodeURIComponent(r.b.id)}`)">
            <td>
              <RouterLink class="bk-id" :to="`/bookings/${encodeURIComponent(r.b.id)}`" @click.stop>{{ r.code }}</RouterLink>
              <div class="sub">created {{ fmtDate(r.b.created_at) }}</div>
              <span v-if="r.b2c" class="b2c">B2C</span>
            </td>
            <td><div class="strong">{{ r.b2c ? 'B2C' : r.b.agent_id || '—' }}</div><div class="sub">{{ r.b.rate_type_ref || (r.b2c ? 'B2C · Direct' : '—') }}</div></td>
            <td><div class="strong">{{ r.trip }}</div><div v-if="r.b.voucher_ref" class="sub">VC {{ r.b.voucher_ref }}</div></td>
            <td>{{ fmtDate(r.b.service_date) }}</td>
            <td class="num"><div class="strong">{{ r.pax.total }}</div><div class="sub">{{ r.break }}</div></td>
            <td class="num strong">{{ thb(r.b.total) }}</td>
            <td>
              <span class="chip" :class="r.b.status"><span class="dot" />{{ statusLabel(r.b.status) }}</span>
              <span v-if="r.pax.foc" class="foc">FOC {{ r.pax.foc }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="pageCount > 1" class="pager" aria-label="Pages">
      <button type="button" :disabled="pageNo <= 1" @click="goPage(pageNo - 1)">‹ Prev</button>
      <span>Page {{ pageNo }} of {{ pageCount }} · {{ filtered.length }} bookings</span>
      <button type="button" :disabled="pageNo >= pageCount" @click="goPage(pageNo + 1)">Next ›</button>
    </nav>
    <p class="foot muted">
      Agent names are not in operation-backend yet, so the agent column shows its id.
      New booking, edit, cancel and the other tabs are still in the legacy app.
    </p>
  </section>
</template>

<style scoped>
.bk { display: flex; flex-direction: column; gap: 12px; }
.hd { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.hd h1 { margin: 0; font-size: 1.3rem; }
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.kpi .lab { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.kpi .val { font-size: 1.6rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.kpi .val.ok { color: #0f6e56; }
.kpi .val.soft { color: var(--muted); }
.kpi.warn .val { color: #ba7517; }
.kpi .foot { font-size: 0.75rem; color: var(--muted); }
.filterbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 999px; padding: 4px 11px; font: inherit; font-size: 0.8rem; cursor: pointer; }
.pill.on { border-color: var(--accent); background: var(--accent); color: #fff; }
.pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #9c9c95; }
.pill.confirmed .dot { background: #1d9e75; } .pill.pending_foc .dot { background: #ba7517; } .pill.rejected .dot { background: #a32d2d; }
.pill.completed .dot { background: #185fa5; } .pill.b2c .dot { background: #8b5cf6; }
.search { flex: 1; min-width: 220px; margin-left: auto; font: inherit; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
.monthbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.monthbar button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; font: inherit; }
.monthbar .mo { min-width: 200px; text-align: center; font-weight: 800; }
.monthbar .note { font-size: 0.75rem; color: #9a5b00; background: #fbe9d6; border-radius: 6px; padding: 3px 8px; }
.err { color: #c0392b; }
.empty { text-align: center; padding: 40px 16px; background: var(--surface); border: 1px dashed var(--border); border-radius: 10px; }
.empty .ttl { font-weight: 800; margin-bottom: 4px; }
.tbl-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
.tbl-wrap.busy { opacity: 0.6; }
.tbl { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.tbl th { text-align: left; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.tbl td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.tbl tbody tr { cursor: pointer; }
.tbl tbody tr:hover { background: var(--bg); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.strong { font-weight: 600; }
.sub { font-size: 0.72rem; color: var(--muted); }
.bk-id { font-family: ui-monospace, monospace; font-weight: 700; text-decoration: none; }
.b2c { display: inline-block; margin-top: 3px; background: #ede9fe; color: #5b21b6; border-radius: 5px; padding: 0 6px; font-size: 0.66rem; font-weight: 700; }
.chip { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 2px 9px; font-size: 0.75rem; font-weight: 600; background: #f1efe8; color: #6b6862; white-space: nowrap; }
.chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.chip.confirmed { background: #e1f5ee; color: #0f6e56; }
.chip.pending_foc, .chip.pending_approval, .chip.pending { background: #faeeda; color: #633806; }
.chip.rejected { background: #fcebeb; color: #791f1f; }
.chip.cancelled, .chip.cancelled_weather { color: #888780; }
.chip.completed { background: #e6eef8; color: #185fa5; }
.foc { margin-left: 6px; font-size: 0.68rem; font-weight: 700; color: #ba7517; }
.pager { display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 0.85rem; }
.pager button { font: inherit; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 5px 12px; cursor: pointer; }
.pager button:disabled { opacity: 0.4; cursor: default; }
.foot { font-size: 0.75rem; }
@media (max-width: 720px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
