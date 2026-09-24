<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { localYmd } from '@/lib/date';
import { legacyUrl } from '@/lib/legacy';
import { ob, type ObBooking, type ObRoute } from '@/lib/ob';
import { useSessionStore } from '@/stores/session';

import { monthRange, MONTHS } from '../calendar/model';
import {
  displayCode, fmtDate, isB2C, kpis, matchesPill, matchesSearch, monthList, paxBreak, paxSplit, PILLS, type PillKey,
  statusLabel, thb, tripSummary,
} from './model';

const PAGE_SIZE = 50;
const session = useSessionStore();
/** Tabs not moved yet open the legacy page, but only where the legacy app has its database. */
const legacyOn = computed(() => session.me?.legacyData !== false);
const LEGACY_TABS = ['By trip · date', 'Seat Locks', 'รออนุมัติ', 'Cancellations'];
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
const shownFrom = computed(() => (filtered.value.length ? (pageNo.value - 1) * PAGE_SIZE + 1 : 0));
const shownTo = computed(() => Math.min(filtered.value.length, pageNo.value * PAGE_SIZE));
/** Legacy bkV2PagerHtml's window: every page up to 7, else 1 … a sliding run of 5 … last. */
const pageNums = computed<(number | '…')[]>(() => {
  const n = pageCount.value, p = pageNo.value;
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
  const W = 5;
  let start = Math.max(2, p - Math.floor(W / 2));
  const end = Math.min(n - 1, start + W - 1);
  start = Math.max(2, end - W + 1);
  const out: (number | '…')[] = [1];
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < n - 1) out.push('…');
  out.push(n);
  return out;
});
</script>

<template>
  <section class="bkw">
    <!-- Topbar card: tabs · meta · new booking (bkV2RenderTopbar) -->
    <div class="bkv2 bkv2-topcard">
      <div class="bkv2-topbar2">
        <div class="bkv2-utabs" role="tablist" aria-label="Booking views">
          <RouterLink class="bkv2-utab" to="/calendar">Calendar</RouterLink>
          <template v-for="(t, i) in LEGACY_TABS" :key="t">
            <a v-if="legacyOn" class="bkv2-utab" :href="legacyUrl('booking')">{{ t }}</a>
            <button v-else type="button" class="bkv2-utab" disabled title="Not moved yet">{{ t }}</button>
            <!-- legacy order: Calendar · By trip · All bookings · Seat Locks · … -->
            <span v-if="i === 0" class="bkv2-utab on" role="tab" aria-selected="true">All bookings</span>
          </template>
        </div>
        <div class="bkv2-topspacer" />
        <div class="bkv2-meta2">{{ inMonth.length }} booking{{ inMonth.length === 1 ? '' : 's' }} · {{ monthLabel }}</div>
        <a v-if="legacyOn" class="bkv2-newbtn2" :href="legacyUrl('booking')">+ New booking <span class="bkv2-kbd2">C</span></a>
        <button v-else type="button" class="bkv2-newbtn2" disabled title="Not moved yet">+ New booking <span class="bkv2-kbd2">C</span></button>
      </div>
    </div>

    <!-- Body card: All bookings (bkV2RenderTab3) -->
    <div class="bkv2 bkv2-bodycard">
      <div class="bkv2-kpis">
        <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Total</div><div class="bkv2-kpi-val">{{ k.total }}</div><div class="bkv2-kpi-foot">travelling in {{ monthLabel }}</div></div>
        <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Confirmed</div><div class="bkv2-kpi-val ok">{{ k.confirmed }}</div><div class="bkv2-kpi-foot">{{ thb(k.confirmedRevenue) }} booked</div></div>
        <div class="bkv2-kpi warn"><div class="bkv2-kpi-lab">Pending FOC</div><div class="bkv2-kpi-val">{{ k.pendingFoc }}</div><div class="bkv2-kpi-foot">awaiting approval</div></div>
        <div class="bkv2-kpi"><div class="bkv2-kpi-lab">Quote</div><div class="bkv2-kpi-val soft">{{ k.quote }}</div><div class="bkv2-kpi-foot">not yet confirmed</div></div>
      </div>

      <div class="bkv2-filterbar">
        <button v-for="p in PILLS" :key="p.k" type="button" class="bkv2-pill" :class="{ on: pill === p.k }" :data-st="p.k" @click="pickPill(p.k)">
          <span class="dot" />{{ p.label }} · {{ pillCount(p.k) }}
        </button>
        <input class="bkv2-search" type="search" :value="q" placeholder="ค้นหา · VC · ชื่อลูกค้า · เบอร์ · BK · agent · trip" aria-label="Search bookings" @input="onSearch" />
      </div>

      <!-- Month bar (bkV2MonthBarHtml): one month is loaded, so no month-chip strip -->
      <div class="mbar">
        <button type="button" class="mstep" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
        <div class="mlbl">{{ monthLabel }}<span> · {{ inMonth.length }} booking{{ inMonth.length === 1 ? '' : 's' }}</span></div>
        <button type="button" class="mstep" aria-label="Next month" @click="shiftMonth(1)">›</button>
        <span v-if="q" class="mnote">⚑ search covers {{ monthLabel }} only</span>
      </div>

      <p v-if="error === 'signed-out'" class="bkv2-empty"><span class="ttl">Your session has ended.</span> <RouterLink :to="`/login?next=${encodeURIComponent(route.fullPath)}`">Sign in</RouterLink></p>
      <div v-else-if="error" class="bkv2-empty">
        <div class="ttl err">Could not load bookings</div>
        <div class="sub">{{ error }}</div>
        <button type="button" class="bkv2-newbtn" @click="load">Retry</button>
      </div>
      <div v-else-if="loading && !rows.length" class="bkv2-empty"><div class="sub">Loading {{ monthLabel }}…</div></div>
      <div v-else-if="!filtered.length" class="bkv2-empty">
        <div class="ttl">{{ q ? 'No bookings match' : `No trips in ${monthLabel}` }}</div>
        <div class="sub">{{ q ? `Nothing for "${q}" in ${monthLabel}` : 'Step to another month above' }}</div>
      </div>

      <div v-else class="tbl-wrap" :class="{ busy: loading }">
        <table class="bkv2-tbl">
          <thead>
            <tr><th style="width:120px">Booking</th><th>Agent</th><th>Trip</th><th>Travel</th><th class="num">Pax</th><th class="num">Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.b.id" @click="router.push(`/bookings/${encodeURIComponent(r.b.id)}`)">
              <td>
                <RouterLink class="bk-id" :to="`/bookings/${encodeURIComponent(r.b.id)}`" @click.stop>{{ r.code }}</RouterLink>
                <div class="trip-date">created {{ fmtDate(r.b.created_at) }}</div>
                <span v-if="r.b2c" class="b2c-mark">Love Andaman</span>
              </td>
              <td><div class="agent-name">{{ r.b2c ? 'B2C' : r.b.agent_id || '—' }}</div><div class="agent-rt">{{ r.b.rate_type_ref || (r.b2c ? 'B2C · Direct' : '—') }}</div></td>
              <td><div class="trip-name">{{ r.trip }}</div><div v-if="r.b.voucher_ref" class="trip-date">VC {{ r.b.voucher_ref }}</div></td>
              <td><div class="trip-date">{{ fmtDate(r.b.service_date) }}</div></td>
              <td class="num"><div class="pax-total">{{ r.pax.total }}</div><div class="pax-break">{{ r.break }}</div></td>
              <td class="num"><div class="price">{{ thb(r.b.total) }}</div></td>
              <td>
                <span class="bkv2-chip" :class="r.b.status"><span class="dot" />{{ statusLabel(r.b.status) }}</span>
                <span v-if="r.pax.foc" class="bkv2-foc-flag">FOC {{ r.pax.foc }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pager (bkV2PagerHtml) -->
      <nav v-if="pageCount > 1" class="pager" aria-label="Pages">
        <span class="range">{{ shownFrom }}–{{ shownTo }} of {{ filtered.length }}</span>
        <div class="pbtns">
          <button type="button" class="pbtn" :disabled="pageNo <= 1" @click="goPage(pageNo - 1)">‹ Prev</button>
          <template v-for="(n, i) in pageNums" :key="i">
            <span v-if="n === '…'" class="gap">…</span>
            <button v-else type="button" class="pbtn" :class="{ on: n === pageNo }" @click="goPage(n)">{{ n }}</button>
          </template>
          <button type="button" class="pbtn" :disabled="pageNo >= pageCount" @click="goPage(pageNo + 1)">Next ›</button>
        </div>
      </nav>

      <div class="bkv2-foot-hints">
        <span class="gp"><span class="bkv2-kbd">/</span>search</span>
        <span class="gp">Agent shows its id: operation-backend has no agent names yet</span>
        <span class="gp">New booking and the other tabs are still in the legacy app</span>
        <span class="count">Showing {{ filtered.length }} of {{ inMonth.length }} · {{ monthLabel }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Ported from the legacy Booking page (All bookings tab): allotment_v2/css/01-base.css #view-booking
   rules, overridden by the BuildAxis skin in 02-skins.css (what users see), plus the inline styles of
   bkV2MonthBarHtml / bkV2PagerHtml in booking.js. `#view-booking` is `.bkw` here; class names are kept
   so the two can be compared rule by rule. */
.bkw {
  /* 01-base.css :root values the skin does not override */
  --shadow: 0 1px 3px rgba(26, 35, 50, 0.07), 0 4px 12px rgba(26, 35, 50, 0.04);
  /* 02-skins.css #view-booking: BuildAxis re-skin */
  font-family: 'Inter', 'IBM Plex Sans Thai', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  background: #F6F7F9;
  --bk-navy-deep: #2952C8; --bk-navy: #3A6FF7; --bk-navy-mid: #7DA0E8;
  --bk-navy-soft: #AFC4F0; --bk-navy-light: #D6E2FB; --bk-navy-50: #EEF3FF;
  --ink: #1F2A44; --ink-mid: #475569; --ink-soft: #64748B;
  --border: #E5E7EB;
  --sand: #F6F7F9; --sand-mid: #F1F5F9; --sand-dark: #E5E7EB;
  --r: 16px; --r-sm: 11px; --r-lg: 18px;
  --bg: #F6F7F9; --ink-faint: #94A3B8; --border-2: #EEF0F3; --white: #ffffff;
  color: var(--ink);
  border-radius: 16px; padding: 14px 16px 18px;
}
.bkw * { box-sizing: border-box; font-family: inherit; }

/* Shell */
.bkv2 { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; margin-top: 0; box-shadow: var(--shadow); }
.bkv2-topcard { margin-bottom: 12px; overflow: visible; background: transparent !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
/* bkv2-liquid-skin */
.bkv2-bodycard { border-radius: 18px !important; box-shadow: 0 12px 30px rgba(20, 40, 80, 0.11), 0 2px 6px rgba(20, 40, 80, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7) !important; }

/* Topbar · floating liquid-glass islands */
.bkv2-topbar2 { display: flex; align-items: center; gap: 10px; padding: 4px 2px; flex-wrap: wrap; background: transparent; }
.bkv2-utabs, .bkv2-meta2 { backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); box-shadow: 0 6px 18px rgba(31, 42, 68, 0.13); border: 1px solid rgba(255, 255, 255, 0.75); }
.bkv2-utabs { display: inline-flex; align-items: center; gap: 2px; background: rgba(255, 255, 255, 0.72); border-radius: 999px; padding: 4px; max-width: 100%; overflow-x: auto; }
.bkv2-utab { font-size: 12.5px; font-weight: 500; color: #64748B; padding: 6px 15px; border: none; background: none; border-radius: 999px; cursor: pointer; font-family: inherit; line-height: 1.2; white-space: nowrap; transition: background 0.12s, color 0.12s; text-decoration: none; }
.bkv2-utab:hover { color: #3A6FF7; background: rgba(58, 111, 247, 0.12); }
.bkv2-utab:active { background: rgba(58, 111, 247, 0.22); transform: scale(0.97); }
.bkv2-utab.on { color: #fff; font-weight: 600; background: #3A6FF7; box-shadow: 0 2px 6px rgba(58, 111, 247, 0.32); cursor: default; }
.bkv2-utab:disabled { opacity: 0.45; cursor: default; background: none; color: #64748B; transform: none; }
.bkv2-topspacer { margin-left: auto; }
.bkv2-meta2 { font-size: 12px; color: #5A6478; font-variant-numeric: tabular-nums; background: rgba(255, 255, 255, 0.7); border-radius: 999px; padding: 8px 14px; }
.bkv2-newbtn2 { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #fff; background: #1F2A44; border: none; border-radius: 999px; padding: 8px 15px; cursor: pointer; font-family: inherit; text-decoration: none; }
.bkv2-newbtn2:hover { background: #2952C8; }
.bkv2-newbtn2:disabled { opacity: 0.45; cursor: default; background: #1F2A44; }
.bkv2-kbd2 { background: rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 600; }
.bkv2-newbtn { padding: 6px 12px; border: 1px solid var(--bk-navy); background: var(--bk-navy); color: var(--white); font-size: 12px; border-radius: var(--r-sm); font-family: inherit; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.bkv2-newbtn:hover { background: var(--bk-navy-deep); }
.bkv2-kbd { background: var(--sand-mid); border: 1px solid var(--border); padding: 1px 6px; border-radius: 3px; font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); font-weight: 500; }

/* KPIs */
.bkv2-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-bottom: 1px solid var(--border); background: var(--white); }
.bkv2-kpi { padding: 13px 18px; border-right: 1px solid var(--border); min-width: 0; }
.bkv2-kpi:last-child { border-right: none; }
.bkv2-kpi-lab { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--ink-soft); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 3px; font-weight: 500; }
.bkv2-kpi-val { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 500; letter-spacing: -0.005em; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
.bkv2-kpi-val.ok { color: #0f6e56; }
.bkv2-kpi-val.soft { color: var(--ink-soft); }
.bkv2-kpi-foot { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); margin-top: 3px; }
.bkv2-kpi.warn .bkv2-kpi-val { color: #ba7517; }

/* Filter bar */
.bkv2-filterbar { display: flex; align-items: center; gap: 8px; padding: 11px 18px; background: var(--white); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.bkv2-pill { padding: 4px 11px; border-radius: var(--r-sm); font-size: 12px; font-weight: 500; background: var(--sand-mid); color: var(--ink-soft); border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: inherit; }
.bkv2-pill.on { background: var(--bk-navy); color: var(--white); }
.bkv2-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-soft); }
.bkv2-pill.on .dot { background: var(--white); }
.bkv2-pill[data-st="confirmed"] .dot { background: #1d9e75; }
.bkv2-pill[data-st="pending_foc"] .dot { background: #ba7517; }
.bkv2-pill[data-st="quote"] .dot { background: var(--ink-soft); }
.bkv2-pill[data-st="rejected"] .dot { background: #a32d2d; }
.bkv2-pill[data-st="completed"] .dot { background: var(--bk-navy); }
.bkv2-pill[data-st="cancelled"] .dot { background: #9c9c95; }
.bkv2-pill[data-st="b2c"] .dot { background: #0E7D8A; }
.bkv2-pill.on[data-st] .dot { background: var(--white); }
.bkv2-search { margin-left: auto; background: var(--sand-mid); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 5px 11px; font-size: 12px; font-family: inherit; color: var(--ink); width: 220px; max-width: 100%; outline: none; }
.bkv2-search:focus { border-color: var(--bk-navy-mid); background: var(--white); }

/* Month bar · bkV2MonthBarHtml inline styles */
.mbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 18px; background: var(--white); border-bottom: 1px solid var(--border); }
.mstep { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #E2E0DA; background: #fff; cursor: pointer; font-family: inherit; font-size: 14px; line-height: 1; color: var(--ink-soft, #6b6862); }
.mlbl { min-width: 210px; text-align: center; font-size: 13.5px; font-weight: 800; color: var(--ink, #2c2a26); font-variant-numeric: tabular-nums; }
.mlbl span { font-size: 11px; font-weight: 600; color: var(--ink-soft, #6b6862); }
.mnote { font-size: 11px; color: #9A5B00; background: #FBE9D6; border-radius: 6px; padding: 3px 8px; }

/* Table */
.tbl-wrap { overflow-x: auto; }
.tbl-wrap.busy { opacity: 0.6; }
.bkv2-tbl { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--white); }
.bkv2-tbl thead th { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--ink-soft); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; text-align: left; padding: 9px 14px; background: var(--sand-mid); border-bottom: 1px solid var(--border); white-space: nowrap; }
.bkv2-tbl thead th.num { text-align: right; }
.bkv2-tbl tbody td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 12px; }
.bkv2-tbl tbody tr { cursor: pointer; }
.bkv2-tbl tbody tr:hover td { background: var(--sand-mid); }
.bkv2-tbl .num { text-align: right; font-variant-numeric: tabular-nums; }
.bkv2-tbl .bk-id { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); font-variant-numeric: tabular-nums; text-decoration: none; }
.bkv2-tbl .agent-name { font-family: 'DM Sans', sans-serif; font-weight: 500; color: var(--ink); }
.bkv2-tbl .agent-rt { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); margin-top: 1px; }
.bkv2-tbl .trip-name { font-weight: 500; color: var(--ink); font-family: 'DM Sans', sans-serif; }
.bkv2-tbl .trip-date { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); margin-top: 1px; }
.bkv2-tbl .pax-total { font-family: 'DM Mono', monospace; font-weight: 500; font-variant-numeric: tabular-nums; }
.bkv2-tbl .pax-break { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--ink-soft); margin-top: 1px; white-space: nowrap; }
.bkv2-tbl .price { font-family: 'DM Mono', monospace; font-weight: 500; font-variant-numeric: tabular-nums; }
.b2c-mark { display: inline-block; margin-top: 3px; background: #E6F7F9; color: #0E7D8A; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; letter-spacing: 0.03em; }

/* Status chips */
.bkv2-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: var(--r-sm); font-size: 10px; font-weight: 500; line-height: 1.4; font-family: 'DM Sans', sans-serif; white-space: nowrap; background: var(--sand-mid); color: var(--ink-soft); }
.bkv2-chip .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-soft); }
.bkv2-chip.confirmed { background: #e1f5ee; color: #0f6e56; }
.bkv2-chip.confirmed .dot { background: #1d9e75; }
.bkv2-chip.pending_foc, .bkv2-chip.pending_approval, .bkv2-chip.pending { background: #faeeda; color: #633806; }
.bkv2-chip.pending_foc .dot, .bkv2-chip.pending_approval .dot, .bkv2-chip.pending .dot { background: #ba7517; }
.bkv2-chip.quote { background: var(--sand-mid); color: var(--ink-soft); }
.bkv2-chip.quote .dot { background: var(--ink-soft); }
.bkv2-chip.rejected { background: #fcebeb; color: #791f1f; }
.bkv2-chip.rejected .dot { background: #a32d2d; }
.bkv2-chip.cancelled, .bkv2-chip.cancelled_weather { background: var(--sand-mid); color: #888780; }
.bkv2-chip.cancelled .dot, .bkv2-chip.cancelled_weather .dot { background: #9c9c95; }
.bkv2-chip.completed { background: var(--bk-navy-50); color: var(--bk-navy); }
.bkv2-chip.completed .dot { background: var(--bk-navy); }
.bkv2-foc-flag { display: inline-block; background: #faeeda; color: #633806; font-family: 'DM Mono', monospace; font-size: 9px; padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-weight: 500; letter-spacing: 0.02em; }

/* Empty / error */
.bkv2-empty { padding: 60px 20px; text-align: center; background: var(--white); margin: 0; }
.bkv2-empty .ttl { font-size: 14px; font-weight: 500; color: var(--ink); margin-bottom: 6px; }
.bkv2-empty .ttl.err { color: #A32D2D; }
.bkv2-empty .sub { font-size: 12px; color: var(--ink-soft); margin-bottom: 18px; }

/* Pager · bkV2PagerHtml inline styles */
.pager { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 12px 18px 10px; background: var(--white); }
.pager .range { font-size: 11px; color: var(--ink-soft, #6b6862); font-variant-numeric: tabular-nums; }
.pbtns { margin-left: auto; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.pbtn { min-width: 30px; height: 28px; padding: 0 8px; border-radius: 7px; cursor: pointer; font-family: inherit; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; border: 1px solid #E2E0DA; background: #fff; color: var(--ink-soft, #6b6862); }
.pbtn.on { font-weight: 800; border-color: var(--bk-navy, #185FA5); background: var(--bk-navy, #185FA5); color: #fff; }
.pbtn:disabled { cursor: default; color: #C4C2BB; }
.gap { color: #C4C2BB; font-size: 11.5px; padding: 0 2px; }

/* Foot hints */
.bkv2-foot-hints { padding: 9px 16px; background: var(--sand-mid); border-top: 1px solid var(--border); display: flex; align-items: center; gap: 14px; font-size: 11px; color: var(--ink-soft); flex-wrap: wrap; }
.bkv2-foot-hints .gp { display: inline-flex; align-items: center; gap: 6px; }
.bkv2-foot-hints .count { margin-left: auto; font-style: italic; }

/* 02-skins.css §oneCol (max-width:820px): the KPI grid drops to one column */
@media (max-width: 820px) {
  .bkw { padding: 10px 8px 14px; }
  .bkv2-kpis { grid-template-columns: minmax(0, 1fr) !important; }
  .bkv2-kpi { border-right: none; border-bottom: 1px solid var(--border); }
  .bkv2-kpi:last-child { border-bottom: none; }
  .bkv2-search { width: 100%; margin-left: 0; }
  .mlbl { min-width: 0; flex: 1; }
}
</style>
