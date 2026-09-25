<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import logoUrl from '@/assets/la-logo-full.png';
import { ApiError } from '@/lib/api';
import { addDays, isYmd, localYmd } from '@/lib/date';
import { ob, type ObAvailabilityDay, type ObBoat, type ObBooking, type ObRouteDays, type ObSeatLock, type ObVanAllocation } from '@/lib/ob';
import { useVanBoardStore } from '@/stores/vanBoard';

import BookingTabs from './BookingTabs.vue';
import {
  agentColor, boatColor, boatInitials, buildDay, contrastInk, langColors, langs, PIER_BTN, PIERS, type PierF, type Row,
  rowCmp, type SortCol, tint, type Trip, type ZoneBlock,
} from './byTrip';
import { displayCode, fmtDate, isB2C, type PaxSplit } from './model';
import VanCell from './VanCell.vue';
import VanGroupHead from './VanGroupHead.vue';
import { type VanGroupView, vanWarnings, vanZone } from './vanMode';
import VansCard from './VansCard.vue';

// "By trip · date" (legacy bkV2RenderTab2): the day's manifest, one table per trip, grouped by
// pickup zone, under a header of programmes / boats / search / seat locks. Read-only.
const route = useRoute();
const router = useRouter();

const today = localYmd();
const date = computed(() => (isYmd(route.query.date) ? route.query.date : today));
const pier = computed<PierF>(() => ((PIERS as readonly string[]).includes(String(route.query.pier)) ? (route.query.pier as PierF) : 'all'));
const fam = computed(() => (typeof route.query.fam === 'string' ? route.query.fam : ''));
const routeF = computed(() => (typeof route.query.route === 'string' ? route.query.route : ''));
const q = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
const sortCol = computed<SortCol>(() => (route.query.sort === 'agency' || route.query.sort === 'zone' ? route.query.sort : ''));
const sortDir = computed<'asc' | 'desc'>(() => (route.query.dir === 'desc' ? 'desc' : 'asc'));
/** Van mode (legacy _bkV2.vanAssignMode) lives in the URL so a reload or a shared link keeps it. */
const vanOn = computed(() => route.query.mode === 'van');

function setQuery(patch: Record<string, string | undefined>) {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) if (typeof v === 'string' && v) next[k] = v;
  router.replace({ query: next });
}
// Legacy bkV2Tab2* setters: a new day or pier clears the narrower filters, like the original.
const pickDay = (d: string) => setQuery({ date: d === today ? undefined : d, route: undefined, q: undefined });
const shiftDay = (n: number) => pickDay(addDays(date.value, n));
const setPier = (p: PierF) => setQuery({ pier: p === 'all' ? undefined : p, fam: undefined, route: undefined });
const setFam = (id: string) => setQuery({ fam: id || undefined, route: undefined });
const setRoute = (rid: string) => setQuery({ route: rid || undefined });
const clearFilters = () => setQuery({ pier: undefined, fam: undefined, route: undefined, q: undefined });
const toggleVan = () => setQuery({ mode: vanOn.value ? undefined : 'van' });
function setSort(col: 'agency' | 'zone') {
  if (sortCol.value === col) setQuery({ dir: sortDir.value === 'asc' ? 'desc' : undefined });
  else setQuery({ sort: col, dir: undefined });
}
const arrow = (col: SortCol) => (sortCol.value === col ? (sortDir.value === 'asc' ? ' ▲' : ' ▼') : '');
let typing: ReturnType<typeof setTimeout> | undefined;
function onSearch(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  clearTimeout(typing);
  typing = setTimeout(() => setQuery({ q: v || undefined }), 200);
}
function onPickDate(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  if (isYmd(v)) pickDay(v);
}
function openPicker(e: Event) {
  try { (e.target as HTMLInputElement).showPicker(); } catch { /* not supported: the native control opens anyway */ }
}

const bookings = ref<ObBooking[]>([]);
const routes = ref<ObRouteDays[]>([]);
const boats = ref<ObBoat[]>([]);
const days = ref<ObAvailabilityDay[]>([]);
const locks = ref<ObSeatLock[]>([]);
const loadedDate = ref('');
const loading = ref(false);
const error = ref('');
let seq = 0;
async function load() {
  const my = ++seq;
  const d = date.value;
  loading.value = true; error.value = '';
  try {
    const [bs, rs, bt, av, lk] = await Promise.all([
      ob.bookingsBetween(d, d), ob.routesBetween(d, d), boats.value.length ? boats.value : ob.boats(), ob.availability(d, d), ob.seatLocks(d),
    ]);
    if (my !== seq) return;
    bookings.value = bs; routes.value = rs; boats.value = bt; days.value = av; locks.value = lk; loadedDate.value = d;
  } catch (e) {
    if (my !== seq) return;
    bookings.value = [];
    error.value = e instanceof ApiError && e.status === 401 ? 'signed-out' : e instanceof Error ? e.message : String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
watch(date, load, { immediate: true });

// ── Van mode (phase 1 of apps/web/docs/porting/van-mode.md: read-only) ──
// The board also feeds the Van button's count and the day warnings, so it loads in every mode.
const vans = useVanBoardStore();
watch(date, (d) => vans.load(d), { immediate: true });
const vanWarn = computed(() => vanWarnings(vans.board));
/** Legacy _btMode('Van', …) (booking.js:9967): bookings with no outbound van, else ✓. */
const vanBtn = computed(() => {
  if (vans.status === 'missing') return { sub: 'not in backend yet', n: '—', kind: '' };
  if (vans.status !== 'ready') return { sub: vans.status === 'error' ? 'could not load' : 'loading…', n: '…', kind: '' };
  const n = vanWarn.value.outbound.bookings;
  return n > 0 ? { sub: 'not assigned', n: String(n), kind: 'warn' } : { sub: 'all assigned', n: '✓', kind: 'ok' };
});
/** Legacy COLN (booking.js:8645): van mode hides Add-on / Pay / Total / VC and adds the group column. */
const colN = computed(() => (vanOn.value ? 15 : 18));

type RowItem = { kind: 'row'; key: string; r: Row; pax: PaxSplit; first: boolean; alloc: ObVanAllocation | null;
  g: VanGroupView | null; cls: string; style: Record<string, string> };
type Item = RowItem | { kind: 'unassigned'; key: string; n: number; pax: number } | { kind: 'group'; key: string; g: VanGroupView };
const plain = (r: Row): RowItem => ({ kind: 'row', key: r.key, r, pax: r.pax, first: true, alloc: null, g: null, cls: '', style: {} });
/** A zone's table rows: the plain manifest, or in van mode the unassigned block then one block per group. */
function zoneItems(t: Trip, z: ZoneBlock): Item[] {
  if (!vanOn.value || vans.status !== 'ready') return z.rows.map(plain);
  const vz = vanZone(z, vans.tripOf(t.rid), vans.board?.vans || [], rowCmp({ col: sortCol.value, dir: sortDir.value }));
  const out: Item[] = [];
  if (vz.unassigned.length) {
    out.push({ kind: 'unassigned', key: `${z.zone}-un`, n: vz.unassigned.length, pax: vz.unassignedPax });
    for (const v of vz.unassigned) out.push({ ...plain(v.row), key: v.key, pax: v.pax, first: v.first, alloc: v.alloc });
  }
  for (const g of vz.groups) {
    out.push({ kind: 'group', key: g.group.id, g });
    g.rows.forEach((v, i) => out.push({
      ...plain(v.row), key: v.key, pax: v.pax, first: v.first, alloc: v.alloc, g,
      // Legacy t2-novan (booking.js:9007): a group with no van is framed red as one box.
      cls: g.van ? '' : 't2-novan' + (i === g.rows.length - 1 ? ' t2-novan-last' : ''),
      style: g.van ? { background: g.colors[0], boxShadow: `inset 4px 0 0 ${g.colors[1]}` } : {},
    }));
  }
  return out;
}
const vanName = (id: string | null) => (id ? vans.board?.vans.find((v) => v.id === id)?.name || id : '');
/** Legacy bkV2ScrollToVan (booking.js:3010): scroll to the van's first group and flash it. */
function scrollToGroup(_rid: string, groupId: string) {
  const el = root.value?.querySelector<HTMLElement>(`#vg-${CSS.escape(groupId)}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('t2-flash');
  setTimeout(() => el.classList.remove('t2-flash'), 1400);
}

const view = computed(() => (loadedDate.value !== date.value ? null : buildDay(
  { date: date.value, bookings: bookings.value, routes: routes.value, boats: boats.value, days: days.value, locks: locks.value },
  { pier: pier.value, fam: fam.value, route: routeF.value, q: q.value, sort: { col: sortCol.value, dir: sortDir.value } },
)));

const dObj = computed(() => new Date(date.value + 'T00:00'));
const isToday = computed(() => date.value === today);
const selCol = computed(() => view.value?.selFam?.color || '');
const bandVars = computed(() => ({
  '--btband': selCol.value ? tint(selCol.value, 0.82) : '#E9E7E3',
  '--btbandb': selCol.value ? tint(selCol.value, 0.52) : '#D6D2CA',
}));
const meta = computed(() => `${routeF.value ? view.value?.routeName(routeF.value) || routeF.value : 'any route'} · ${fmtDate(date.value)}`);
const filtered = computed(() => pier.value !== 'all' || !!fam.value || !!routeF.value);
const runningIds = computed(() => (view.value ? view.value.routeIds.filter((rid) => view.value!.openOf(rid)) : []));
const boatTotal = computed(() => (view.value ? runningIds.value.reduce((n, rid) => n + view.value!.boatsOf(rid).length, 0) : 0));
const overTotal = computed(() => (view.value ? runningIds.value.reduce((n, rid) => n + view.value!.boatsOf(rid).filter((b) => b.over).length, 0) : 0));
const lockTot = computed(() => (view.value?.locks || []).reduce((n, a) => n + a.qty, 0));
const lockLeft = computed(() => (view.value?.locks || []).reduce((n, a) => n + a.left, 0));

/** Passenger lists opened with "+N" (legacy bkV2Tab2TogglePax). */
const openPax = ref(new Set<string>());
function togglePax(key: string) {
  const s = new Set(openPax.value);
  if (s.has(key)) s.delete(key); else s.add(key);
  openPax.value = s;
}

/** Legacy BoatLoad label: pax/cap, "—/cap" when no booking is assigned to the boat (no trip ops yet). */
const loadTxt = (b: { pax: number | null; cap: number; over: boolean }) =>
  (b.pax == null ? '—' : String(b.pax)) + (b.cap ? '/' + b.cap : '') + (b.over && b.pax != null ? ' +' + (b.pax - b.cap) : '');

// ── row cells ──
const voucherTxt = (r: Row) => {
  const b = r.b;
  if (!b.voucher_ref || b.voucher_ref.trim().toLowerCase() === (b.lead_pax || '').trim().toLowerCase()) return '';
  return isB2C(b) ? displayCode(b) : b.voucher_ref;
};
/** Legacy bkV2PayChip without invoices or PFM (not in the backend): the payment term. */
const PAY: Record<string, [string, string, string, string]> = {
  invoice: ['Invoice', '#E6F1FB', '#185FA5', '#BBD7F0'], credit: ['Invoice', '#E6F1FB', '#185FA5', '#BBD7F0'],
  proforma: ['Proforma', '#FBF0DD', '#7A4A00', '#EAD7A8'], prepaid: ['PFM', '#FBF0DD', '#7A4A00', '#EAD7A8'],
  cot: ['COT', '#E0F7FA', '#00838F', '#9FE3EC'], bt: ['Bank transfer', '#F1EFE8', '#5F5E5A', '#E0DDD4'],
};
function payChip(b: ObBooking) {
  if ((b.purpose === 'staff_welfare' || b.purpose === 'staff_inspection' || b.staff_id) && !(Number(b.total) > 0)) {
    const insp = b.staff_purpose === 'inspection' || b.purpose === 'staff_inspection';
    const c = insp ? ['#EEE9FB', '#6c5ce7', '#D9CFFA'] : ['#FCE9B5', '#7A5A12', '#EAD7A8'];
    return { txt: insp ? 'Inspection · FREE' : 'FOC · Welfare', style: { background: c[0], color: c[1], border: `1px solid ${c[2]}`, fontWeight: 600 } };
  }
  const m = b.payment_method || '';
  const p = PAY[m];
  return { txt: p ? p[0] : m || '—', style: { background: p ? p[1] : '#fff', color: p ? p[2] : '#5F5E5A', border: `1px solid ${p ? p[3] : 'var(--border)'}`, fontWeight: 600 } };
}
const cotTxt = (b: ObBooking) => {
  const amt = Number(b.cash_on_tour_amount) || 0;
  if (amt <= 0) return '';
  const cur = b.cash_on_tour_currency || 'THB';
  return `COT ${cur === 'THB' || cur === '฿' ? '฿' : cur + ' '}${amt.toLocaleString()}`;
};
const thb = (n: number) => '฿' + Math.round(n).toLocaleString('en-US');
const cxlCharge = (b: ObBooking) => (b.status === 'cancelled_weather' ? 'Weather' : '—');

// Sticky Voucher / Agency / Customer columns: legacy measures the real widths after each render (§btFreeze).
const root = ref<HTMLElement | null>(null);
watch(view, async () => {
  await nextTick();
  const tr = root.value?.querySelector('table.t2-mtbl thead tr');
  if (!tr || tr.children.length < 3) return;
  const w1 = Math.round(tr.children[0]!.getBoundingClientRect().width), w2 = Math.round(tr.children[1]!.getBoundingClientRect().width);
  root.value!.style.setProperty('--t2-fz1', w1 + 'px');
  root.value!.style.setProperty('--t2-fz2', w1 + w2 + 'px');
}, { flush: 'post' });
</script>

<template>
  <section ref="root" class="btw">
    <BookingTabs active="bytrip" :meta="meta" />

    <div class="bkv2 bkv2-bodycard">
      <div class="t2-shell" :style="bandVars">
        <div class="t2-main">
          <!-- Header (§btHead): date row, then Programmes · Boats running · modes / search / Seat Lock / Notice -->
          <div class="bt-pkh">
            <div class="bt-hdtop">
              <button type="button" class="bt-arw" title="Previous day" @click="shiftDay(-1)">&lsaquo;</button>
              <span class="bt-dnum">{{ dObj.getDate() }}</span>
              <span class="bt-dgrp">
                <span class="bt-dwk">{{ dObj.toLocaleDateString('en-GB', { weekday: 'long' }) }}</span>
                <label class="bt-dmo">{{ dObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }}
                  <input type="date" :value="date" aria-label="Pick a day" @click="openPicker" @change="onPickDate" /></label>
              </span>
              <span v-if="isToday" class="bt-today">TODAY</span>
              <button v-else type="button" class="bt-today gh" @click="pickDay(today)">Go to today</button>
              <button type="button" class="bt-arw" title="Next day" @click="shiftDay(1)">&rsaquo;</button>
              <!-- Day van warnings (legacy booking.js:9740-9742): a click opens van mode -->
              <span v-if="vans.status === 'ready'" class="bt-hdwarn">
                <button v-if="vanWarn.outbound.bookings" type="button" class="t2-hd-warnchip t2-hd-warnchip--van" :title="`ยังไม่จัดรถ(ขาไป) ${vanWarn.outbound.bookings} booking · ${vanWarn.outbound.pax} pax`"
                        @click="vanOn || toggleVan()">Van &middot; <b>{{ vanWarn.outbound.pax }}</b> pax</button>
                <button v-if="vanWarn.ret.bookings" type="button" class="t2-hd-warnchip t2-hd-warnchip--ret" :title="`ยังไม่จัดรถกลับ (ส่งคนละที่) ${vanWarn.ret.bookings} booking · ${vanWarn.ret.pax} pax`"
                        @click="vanOn || toggleVan()">รถกลับ &middot; <b>{{ vanWarn.ret.pax }}</b> pax</button>
                <button v-for="w in vanWarn.twoRoutes" :key="w.van_id" type="button" class="t2-hd-warnchip t2-hd-warnchip--mixed"
                        :title="`${vanName(w.van_id)} is on ${w.route_ids.length} programmes today: check the pickup times`"
                        @click="vanOn || toggleVan()">{{ vanName(w.van_id) }} &middot; <b>{{ w.route_ids.length }}</b> โปรแกรม</button>
              </span>
              <span class="bt-brand">{{ view?.selFam ? view.selFam.name : 'LOVE ANDAMAN' }}</span>
            </div>

            <div v-if="view" class="bt-hgrid">
              <!-- Programmes today -->
              <div>
                <div class="bt-c bt-prog">
                  <div class="bt-ct"><span class="big">Programmes</span>
                    <span class="bt-cnt">{{ view.famList.length }} route{{ view.famList.length === 1 ? '' : 's' }}</span>
                    <span class="bt-seg"><button v-for="p in PIERS" :key="p" type="button" class="bt-seg-b" :class="{ on: pier === p }" @click="setPier(p)">{{ PIER_BTN[p] }}</button></span>
                    <button v-if="filtered" type="button" class="bt-clear" @click="clearFilters">Clear</button>
                    <span class="sp" />
                    <span class="bt-daytot"><b>{{ view.totals.bookings }}</b> booking &middot; <b>{{ view.totals.pax }}</b> pax<i>{{ view.totals.ad }}A&middot;{{ view.totals.chd }}C&middot;{{ view.totals.inf }}I&middot;{{ view.totals.foc }}F</i></span>
                  </div>
                  <div class="bt-pgbody">
                    <template v-for="a in view.famList" :key="a.fam.id">
                      <div class="bt-pgf" :class="{ on: a.on }" :style="{ '--e': a.fam.color, '--ink': a.fam.color, background: tint(a.fam.color, 0.9) }"
                           :title="`Filter ${a.fam.name}`" role="button" tabindex="0" @click="setFam(a.on ? '' : a.fam.id)" @keydown.enter="setFam(a.on ? '' : a.fam.id)">
                        <span class="ar">&#9662;</span><span class="dot" />
                        <span class="nm">{{ a.fam.name }}</span><span class="n">{{ a.pax }}</span>
                        <span class="sp"><span class="bt-tag run">{{ a.nRun }} running</span><span v-if="a.nOff" class="bt-tag no">{{ a.nOff }} not running</span></span>
                      </div>
                      <template v-for="v in a.variants" :key="v.rid">
                        <div v-if="!v.open" class="bt-pgv off"><span class="vn">{{ v.sub }}</span><span>{{ v.dep }}{{ v.pier ? ' · ' + v.pier : '' }} · not running</span><span class="sp"><span class="bt-free none">&mdash;</span></span></div>
                        <div v-else class="bt-pgv" :class="{ on: v.on }" role="button" tabindex="0"
                             :title="`${v.sub} · booked ${v.seats.booked}/${v.seats.cap} · ${v.seats.free} free`"
                             @click="setRoute(v.on ? '' : v.rid)" @keydown.enter="setRoute(v.on ? '' : v.rid)">
                          <span class="vn">{{ v.sub }}</span><span>{{ v.dep }}{{ v.pier ? ' · ' + v.pier : '' }}</span>
                          <span class="sp">
                            <span v-if="v.seats.locked > 0" class="bt-lk">&#128274; {{ v.seats.locked }}</span>
                            <span class="bt-seat"><b>{{ v.seats.booked }}</b>/{{ v.seats.cap }}</span>
                            <span v-if="!v.seats.hasBoats" class="bt-free none" title="No boat deployed on this trip in operation-backend">no boat</span>
                            <span v-else class="bt-free" :class="v.seats.cls">{{ v.seats.free <= 0 ? 'full' : v.seats.free + ' free' }}</span>
                          </span>
                        </div>
                      </template>
                    </template>
                    <div v-if="!view.famList.length" class="bt-none">No programme on this day</div>
                  </div>
                </div>
              </div>

              <!-- Boats running -->
              <div>
                <div v-if="routeF" class="bt-c bt-boat" :style="{ '--c': selCol || '#B9B3AA' }">
                  <div class="bt-ct">Boats running<span class="sp" /><span class="bt-cnt">{{ view.boatsOf(routeF).length }} boat{{ view.boatsOf(routeF).length === 1 ? '' : 's' }}</span>
                    <span v-if="view.boatsOf(routeF).some((b) => b.over)" class="bt-cnt over">&#9888; {{ view.boatsOf(routeF).filter((b) => b.over).length }} over</span></div>
                  <div class="bt-bnm">{{ view.routeName(routeF) }}<span>{{ view.depOf(routeF) }}{{ view.pierOf(routeF) ? ' · ' + view.pierOf(routeF) : '' }}</span></div>
                  <div class="bt-avrow">
                    <span class="bt-av"><span class="k">Free</span><span class="v" :class="view.seatsOf(routeF).cls === 'ok' ? '' : view.seatsOf(routeF).cls">{{ view.seatsOf(routeF).free }}</span></span><span class="bt-avs" />
                    <span class="bt-av"><span class="k">Booked</span><span class="v">{{ view.seatsOf(routeF).booked }}</span></span><span class="bt-avs" />
                    <span class="bt-av"><span class="k">Capacity</span><span class="v dim">{{ view.seatsOf(routeF).cap }}</span></span><span class="bt-avs" />
                    <span class="bt-av"><span class="k">Locked</span><span class="v lk">{{ view.seatsOf(routeF).locked }}</span></span>
                  </div>
                  <div class="bt-blist">
                    <span v-for="b in view.boatsOf(routeF)" :key="b.id" class="bt-brow" :class="{ over: b.over }" :title="b.pax == null ? 'Which bookings ride this boat is not in operation-backend yet' : ''">
                      <span class="d" :style="{ background: b.col }" /><span class="nm">{{ b.name }}</span><span class="ld">{{ loadTxt(b) }}</span></span>
                    <span v-if="!view.boatsOf(routeF).length" class="bt-none2">No boat assigned to this trip</span>
                  </div>
                  <div v-if="view.prepOf(routeF).lang.length || view.prepOf(routeF).veg || view.prepOf(routeF).vegan || view.prepOf(routeF).halal || view.prepOf(routeF).allerg" class="bt-prep">
                    <span class="l">Prep</span>
                    <span v-for="[k, n] in view.prepOf(routeF).lang" :key="k" class="bt-pc" :style="{ background: langColors(k)[0], color: langColors(k)[1] }">{{ k }} &middot; {{ n }}</span>
                    <span v-if="view.prepOf(routeF).veg" class="bt-pc" style="background:#EAF6EE;color:#0F6E56">{{ view.prepOf(routeF).veg }} veg</span>
                    <span v-if="view.prepOf(routeF).vegan" class="bt-pc" style="background:#EAF6EE;color:#0F6E56">{{ view.prepOf(routeF).vegan }} vegan</span>
                    <span v-if="view.prepOf(routeF).halal" class="bt-pc" style="background:#EAF6EE;color:#0F6E56">{{ view.prepOf(routeF).halal }} halal</span>
                    <span v-if="view.prepOf(routeF).allerg" class="bt-pc" style="background:#FBEAE7;color:#A32D2D">&#9888; {{ view.prepOf(routeF).allerg }} allergy</span>
                  </div>
                </div>
                <div v-else class="bt-c bt-boat" style="--c:#B9B3AA">
                  <div class="bt-ct">Boats running<span class="sp" /><span class="bt-cnt">{{ boatTotal }} boat{{ boatTotal === 1 ? '' : 's' }} &middot; {{ runningIds.length }} trip{{ runningIds.length === 1 ? '' : 's' }}</span>
                    <span v-if="overTotal" class="bt-cnt over">&#9888; {{ overTotal }} over</span></div>
                  <div class="bt-tgl">
                    <div v-for="rid in runningIds" :key="rid" class="bt-tgp" :style="{ '--tc': view.trips.find((t) => t.rid === rid)?.color }"
                         title="Select this trip" role="button" tabindex="0" @click="setRoute(rid)" @keydown.enter="setRoute(rid)">
                      <div class="bt-tgh"><i /><span class="nm">{{ view.routeName(rid) }}</span><span class="tm">{{ view.depOf(rid) }}{{ view.pierOf(rid) ? ' · ' + view.pierOf(rid) : '' }}</span>
                        <span class="sm">{{ view.seatsOf(rid).booked }}/{{ view.seatsOf(rid).cap }}<em :class="view.seatsOf(rid).cls">{{ view.seatsOf(rid).free <= 0 ? 'full' : view.seatsOf(rid).free + ' free' }}</em></span></div>
                      <div class="bt-tgb">
                        <span v-for="b in view.boatsOf(rid)" :key="b.id" class="bt-tbc" :class="{ over: b.over }"><i :style="{ background: b.col }" />{{ b.name }}<s>{{ loadTxt(b) }}</s></span>
                        <span v-if="!view.boatsOf(rid).length" class="bt-tbc none">no boat</span>
                      </div>
                    </div>
                    <div v-if="!runningIds.length" class="bt-none">No trip running today</div>
                  </div>
                  <div class="bt-tgfoot">Pick a programme on the left to see its free seats and boats</div>
                </div>
              </div>

              <!-- Modes · search · Seat Lock · Notice -->
              <div class="bt-col3">
                <div class="bt-pair">
                  <div class="bt-c"><div class="bt-mrow">
                    <button type="button" class="bt-mc" :class="[vanBtn.kind, { on: vanOn }]" style="--mc:#0F6E56" :aria-pressed="vanOn" title="Van" @click="toggleVan">
                      <span class="tx"><span class="t">Van</span><span class="s">{{ vanBtn.sub }}</span></span><span class="n">{{ vanBtn.n }}</span><span v-if="vanOn" class="x">&times;</span>
                    </button>
                    <button v-for="m in [{ nm: 'Boat', col: '#185FA5' }, { nm: 'Re-confirm', col: '#7A4A00' }]" :key="m.nm"
                            type="button" class="bt-mc dis" :style="{ '--mc': m.col }" disabled title="Not moved yet">
                      <span class="tx"><span class="t">{{ m.nm }}</span><span class="s">not in backend yet</span></span><span class="n">&mdash;</span>
                    </button>
                  </div></div>
                  <div class="bt-c"><div class="bt-srow">
                    <span class="bt-sbox"><span class="ic">&#128269;</span>
                      <input :value="q" placeholder="Search · voucher · name · phone · hotel" aria-label="Search this day" @input="onSearch" />
                      <button v-if="q" type="button" class="clr" title="Clear search" @click="setQuery({ q: undefined })">&times;</button></span>
                    <span v-if="q" class="bt-shit">{{ view.hits }} rows</span>
                  </div></div>
                </div>
                <VansCard v-if="vanOn" class="bt-vans" :trips="view.trips.map((t) => ({ rid: t.rid, name: t.name, dep: t.dep, color: t.color }))"
                          :board="vans.board" :status="vans.status" :error="vans.error" @scroll-to="scrollToGroup" @retry="vans.load(date, true)" />
                <div v-else class="bt-pair2">
                  <div class="bt-c bt-lockc">
                    <div class="bt-ct">Seat Lock<span class="sp" />
                      <span v-if="lockLeft > 0" class="bt-lkbadge">{{ lockLeft }} left</span><span v-else class="bt-cnt">none left</span>
                      <button type="button" class="bt-lkbtn gh" disabled title="Not moved yet">All &rarr;</button></div>
                    <div class="bt-lkl">
                      <span v-for="a in view.locks" :key="a.nm" class="bt-lkr" :class="a.qty <= 0 ? 'gone' : a.left <= 0 ? 'done' : ''">
                        <i /><span class="nm">{{ a.nm }}</span>
                        <span class="q"><s v-if="a.qty <= 0">released</s><template v-else><b>{{ a.left }}</b><s>/ {{ a.qty }}</s></template></span>
                      </span>
                      <span v-if="!view.locks.length" class="bt-none2">No seat lock on this day</span>
                    </div>
                    <div v-if="view.locks.length" class="bt-lkfoot"><b>{{ lockTot }}</b> held &middot; <b>{{ lockTot - lockLeft }}</b> used &middot; <b>{{ view.locks.length }}</b> holder{{ view.locks.length === 1 ? '' : 's' }} &middot; <b>{{ view.lockCount }}</b> lock{{ view.lockCount === 1 ? '' : 's' }}<span v-if="view.locks.length > 3" class="scr">&#9662; {{ view.locks.length - 3 }} more</span></div>
                  </div>
                  <div class="bt-c bt-notice">
                    <div class="bt-ct">Notice<span class="sp" /><span class="bt-cnt">today</span></div>
                    <div class="bt-ncb">
                      <div v-if="view.pendN > 0" class="bt-nc warn"><span class="i">&#9873;</span><span><b>Pending approval</b> &middot; {{ view.pendN }} booking<i>Not counted in trip totals &middot; not on van/boat job orders yet</i></span></div>
                      <div class="bt-nc"><span class="i">&#9432;</span><span><b>Vans, boats, re-confirm, check-in</b><i>Not in operation-backend yet, so this page cannot tell what is still to arrange</i></span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p v-if="error === 'signed-out'" class="bkv2-empty"><span class="ttl">Your session has ended.</span> <RouterLink :to="`/login?next=${encodeURIComponent(route.fullPath)}`">Sign in</RouterLink></p>
          <div v-else-if="error" class="bkv2-empty">
            <div class="ttl err">Could not load this day</div>
            <div class="sub">{{ error }}</div>
            <button type="button" class="bkv2-newbtn" @click="load">Retry</button>
          </div>
          <div v-else-if="!view" class="bkv2-empty"><div class="sub">Loading {{ fmtDate(date) }}…</div></div>
          <div v-else-if="!view.trips.length" class="bkv2-empty">
            <div class="ttl">No trips{{ filtered ? ' match this filter' : ` on ${fmtDate(date)}` }}</div>
            <div class="sub">{{ filtered ? 'Clear the filter or pick another day' : 'Pick another day with the arrows or the date above' }}</div>
          </div>

          <div v-else class="t2-wrap" :class="{ busy: loading }">
            <div v-for="t in view.trips" :key="t.rid" class="t2-trip t2-trip-variant" :class="{ 't2-trip-closed': !t.open }" :style="{ '--fam': t.color }">
              <div v-if="!t.open" class="t2-notrun"><span class="t2-notrun-ic">&#9888;</span><div style="flex:1;min-width:0">
                <div class="t2-notrun-t">ทริปนี้ไม่ออกวันนี้ · {{ t.notRunWhy }}</div>
                <div class="t2-notrun-s"><template v-if="t.live > 0">ยังมี <b>{{ t.live }}</b> booking ค้างอยู่บนวันนี้ — ต้องเลื่อนวันหรือยกเลิกให้เรียบร้อย</template><template v-else>เหลือแต่รายการที่ยกเลิกแล้ว (เก็บไว้เป็นประวัติ)</template></div>
              </div></div>
              <div class="t2-listcard">
                <!-- Pending approval (§pendSeat): above the manifest, never counted in it -->
                <div v-if="t.pend.length" class="t2-pend-sec">
                  <div class="t2-pend-hd">&#9203; รออนุมัติ &middot; {{ t.pend.length }} booking &middot; {{ t.pend.reduce((s, r) => s + r.pax.total, 0) }} pax
                    <span style="font-weight:500;text-transform:none;color:#9a7a3a">(ยังไม่นับในยอดของทริป &middot; ยังไม่เข้าใบงานรถ/เรือ)</span></div>
                  <div v-for="r in t.pend" :key="r.key" class="t2-pend-row">
                    <span class="t2-cxl-vc">{{ r.b.voucher_ref || displayCode(r.b) }}</span>
                    <span class="t2-cxl-ag">{{ isB2C(r.b) ? 'B2C' : r.b.agent_id || '—' }}</span>
                    <span class="t2-cxl-cu">{{ r.b.lead_pax || '—' }}</span>
                    <span class="t2-cxl-px">{{ r.pax.total }} pax</span>
                    <span class="t2-pend-why">รอผู้จัดการอนุมัติ</span>
                    <span class="t2-pend-hold" title="ที่นั่งถูกกันไว้ระหว่างรออนุมัติ">&#128274; กันที่นั่งไว้</span>
                    <RouterLink class="t2-ghost-go" :to="`/bookings/${encodeURIComponent(r.b.id)}`" title="ดูรายละเอียด">View</RouterLink>
                  </div>
                </div>

                <div v-if="!t.hasRows && !t.pend.length" class="t2-nobk">No bookings yet &middot; seats held by lock above</div>
                <div v-else-if="t.zones.length" class="t2-tblscroll">
                  <table class="t2-mtbl" :class="{ 't2-van': vanOn }">
                    <thead><tr>
                      <th class="t2-vc">Voucher</th>
                      <th class="t2-ag" style="cursor:pointer;user-select:none" title="Sort by agency" @click="setSort('agency')">Agency{{ arrow('agency') }}</th>
                      <th class="t2-cu">Customer (lead)</th>
                      <th class="t2-c">AD</th><th class="t2-c">CHD</th><th class="t2-c">INF</th><th class="t2-c">FOC</th>
                      <th>Time</th><th v-if="vanOn" class="t2-c t2-gwrap" title="ติ๊กแถวที่จะไปด้วยกัน แล้วกดจับกลุ่ม">&#10003; กลุ่ม</th><th class="t2-pk">Pickup</th><th class="t2-c">Room</th>
                      <th class="t2-zn" style="cursor:pointer;user-select:none" title="Sort by pickup area" @click="setSort('zone')">Zone{{ arrow('zone') }}</th>
                      <th>Send back</th><th v-if="!vanOn">Add-on</th><th>Special request</th><template v-if="!vanOn"><th>Pay</th><th class="t2-r">Total</th><th class="t2-c" /></template><th class="t2-c">&#128676; Boat</th>
                    </tr></thead>
                    <tbody>
                      <!-- Programme band (§btBand) -->
                      <tr class="t2-pband" :style="{ '--pc': t.color }"><td :colspan="colN"><div class="pw">
                        <span class="pd" /><span class="pn">{{ t.name }}</span>
                        <span class="pt">{{ t.dep }}{{ t.pier ? ' · ' + t.pier : '' }}</span>
                        <span v-if="t.seats.boats" class="pb">{{ t.seats.boats }} boat{{ t.seats.boats === 1 ? '' : 's' }}</span>
                        <span class="ps">{{ t.seats.booked }}/{{ t.seats.cap }}<em :class="t.seats.cls">{{ t.seats.free <= 0 ? 'full' : t.seats.free + ' free' }}</em></span>
                      </div></td></tr>
                      <template v-for="z in t.zones" :key="z.zone">
                        <tr v-if="z.charter" class="t2-zband t2-zband-ch"><td :colspan="colN"><div class="zw">
                          <span class="zkind">เหมาลำ</span><span class="znm">&#128676; CHARTER</span>
                          <span class="zsub">{{ z.rows.length }} booking &middot; {{ z.pax }} pax &middot; ทั้งลำ</span>
                          <span v-if="z.charterItems.length" class="zboats"><span v-for="(it, i) in z.charterItems" :key="i" class="zb"><b>&#128676; {{ it.bn || 'ยังไม่ระบุเรือ' }}</b><s>{{ it.cap ? it.px + '/' + it.cap : it.px + ' pax' }}</s></span></span>
                        </div></td></tr>
                        <tr v-else class="t2-zband"><td :colspan="colN" :style="{ '--zc': z.color }"><div class="zw">
                          <span class="zkind">โซน</span><span class="znm">{{ z.label }}</span>
                          <span class="zsub">{{ z.rows.length }} booking &middot; {{ z.pax }} pax</span>
                        </div></td></tr>
                        <template v-for="it in zoneItems(t, z)" :key="it.key">
                          <VanGroupHead v-if="it.kind === 'group'" :id="`vg-${it.g.group.id}`" :group="it.g" :colspan="colN" />
                          <VanGroupHead v-else-if="it.kind === 'unassigned'" :group="null" :colspan="colN" :unassigned-n="it.n" :unassigned-pax="it.pax" />
                          <template v-else>
                          <tr class="t2-row" :class="it.cls" :style="it.style">
                            <td>
                              <span v-if="voucherTxt(it.r)" class="t2-mono t2-vch" :title="it.r.b.voucher_ref">{{ voucherTxt(it.r) }}</span><span v-else class="t2-dim">—</span>
                              <div v-if="isB2C(it.r.b)" style="margin-top:3px"><span class="b2c-tag">Love Andaman</span></div>
                            </td>
                            <td class="t2-ag" :style="it.r.b.agent_id ? 'padding:0' : ''">
                              <div v-if="it.r.b.agent_id && isB2C(it.r.b)" class="ag-b2c" title="Love Andaman · ขายเอง (B2C)"><img :src="logoUrl" alt="Love Andaman" /></div>
                              <div v-else-if="it.r.b.agent_id" class="ag-box" :style="{ background: agentColor(it.r.b.agent_id), color: contrastInk(agentColor(it.r.b.agent_id)) }"
                                   :title="`${it.r.b.agent_id} · agent name not in operation-backend yet`">{{ it.r.b.agent_id }}</div>
                              <span v-else class="t2-agency">—</span>
                            </td>
                            <td class="t2-cu">
                              <span class="t2-lead">{{ it.r.b.lead_pax || '—' }}</span>
                              <button v-if="it.r.b.passengers.length" type="button" class="t2-more" @click="togglePax(it.r.key)"><span style="display:inline-block">{{ openPax.has(it.r.key) ? '▴' : '▾' }}</span> +{{ it.r.b.passengers.length }}</button>
                              <span v-else class="t2-dim t2-leadonly">lead only</span>
                            </td>
                            <td v-for="k in (['ad', 'chd', 'inf', 'foc'] as const)" :key="k" class="t2-c t2-mono">
                              <template v-if="it.pax[k]"><span v-if="k === 'foc'" style="color:#A32D2D">{{ it.pax[k] }}</span><template v-else>{{ it.pax[k] }}</template></template>
                              <span v-else class="t2-dim">0</span>
                            </td>
                            <td v-if="it.alloc && (it.alloc.pickup.time_final || it.alloc.pickup.time_booked)" class="t2-mono">
                              <!-- Legacy §เวลารับที่แก้แล้ว: the final time on top, the booked one small underneath when they differ -->
                              <b v-if="it.alloc.pickup.time_final">{{ it.alloc.pickup.time_final }}</b>
                              <div v-if="it.alloc.pickup.time_booked && it.alloc.pickup.time_booked !== it.alloc.pickup.time_final"
                                   :class="it.alloc.pickup.time_final ? 't2-tmold' : ''">{{ it.alloc.pickup.time_booked }}</div>
                            </td>
                            <td v-else class="t2-mono"><span class="t2-dim" :title="vanOn ? 'No pickup time yet' : 'Pickup times show in Van mode'">—</span></td>
                            <td v-if="vanOn" class="t2-c t2-gwrap"><VanCell :r="{ key: it.key, row: it.r, alloc: it.alloc, pax: it.pax, first: it.first }" :zone="it.alloc?.zone || it.r.zone" :group="it.g" :vans="vans.board?.vans || []" /></td>
                            <td class="t2-pk">
                              <span v-if="it.alloc?.split && it.alloc.pickup.hotel" class="t2-pickcell t2-altpick" :title="it.alloc.pickup.hotel">&#128652; {{ it.alloc.pickup.hotel }}</span>
                              <span v-else-if="it.r.b.hotel_name" class="t2-pickcell" :title="it.r.b.hotel_name">{{ it.r.b.hotel_name }}</span>
                              <span v-else class="t2-needpickup" title="ยังไม่ได้ระบุจุดรับ">&#9888; no pickup</span>
                            </td>
                            <td class="t2-c"><span v-if="it.r.b.room_number" class="t2-mono t2-room">{{ it.r.b.room_number }}</span><span v-else class="t2-dim">—</span></td>
                            <td><span v-if="it.r.b.pickup_area" class="t2-zonetag">{{ it.r.b.pickup_area }}</span><span v-else class="t2-dim">—</span></td>
                            <td>
                              <span v-if="it.r.b.dropoff_same === false && (it.r.b.dropoff_hotel_name || it.r.b.dropoff_area)" class="t2-sb" :title="it.r.b.dropoff_hotel_name || it.r.b.dropoff_area">{{ it.r.b.dropoff_hotel_name || it.r.b.dropoff_area }}</span>
                              <span v-else class="t2-dim">—</span>
                              <!-- Legacy bkV2RetInfo chips (booking.js:8946-8956), from the van board -->
                              <template v-if="it.alloc?.return.needed">
                                <br /><span v-if="it.alloc.return.self" class="t2-rb t2-ret-self" title="จุดส่งกลับเป็นท่าเรือ self-arrive · ลูกค้าเดินทางกลับเอง ไม่ต้องจัดรถ">&#8617; ลูกค้ากลับเอง</span>
                                <span v-else-if="it.alloc.return.van_id" class="t2-rb t2-ret-ok" :title="`รถกลับ: ${vanName(it.alloc.return.van_id)}`">&#8617; {{ vanName(it.alloc.return.van_id) }}</span>
                                <span v-else-if="it.alloc.return.same_van" class="t2-rb t2-ret-same" title="รถขาไปพากลับ · ส่งจุดใหม่">&#8617; กลับคันเดิม &#10003;</span>
                                <span v-else-if="it.alloc.return.alert" class="t2-rb t2-ret-alert" title="ส่งกลับคนละที่กับตอนรับ · ยังไม่จัดรถกลับ">&#9888; ยังไม่จัดรถกลับ</span>
                              </template>
                            </td>
                            <td v-if="!vanOn" class="t2-req"><span class="t2-dim" title="Add-ons are not in operation-backend yet">—</span></td>
                            <td class="t2-req">
                              <div v-if="it.r.b.special_meals_veg || it.r.b.special_meals_vegan || it.r.b.special_meals_halal || it.r.b.large_luggage || langs(it.r.b).length" class="t2-rbwrap">
                                <span v-if="it.r.b.special_meals_veg" class="t2-rb" style="background:#EAF3DE;color:#3B6D11">{{ it.r.b.special_meals_veg }} veg</span>
                                <span v-if="it.r.b.special_meals_vegan" class="t2-rb" style="background:#EAF3DE;color:#3B6D11">{{ it.r.b.special_meals_vegan }} vegan</span>
                                <span v-if="it.r.b.special_meals_halal" class="t2-rb" style="background:#E1F5EE;color:#0F6E56">{{ it.r.b.special_meals_halal }} halal</span>
                                <span v-if="it.r.b.large_luggage" class="t2-rb" style="background:#FAEEDA;color:#854F0B">{{ it.r.b.large_luggage }} bag</span>
                                <span v-for="code in langs(it.r.b)" :key="code" class="t2-rb" :style="{ background: langColors(code)[0], color: langColors(code)[1] }">{{ code }}</span>
                              </div>
                              <div v-if="(it.r.b.special_meals_allergies || '').trim()" class="t2-allerg" :title="`Allergy: ${it.r.b.special_meals_allergies}`">Allergy: {{ it.r.b.special_meals_allergies }}</div>
                              <div v-if="(it.r.b.notes || it.r.b.note || '').trim()" class="t2-note" :title="it.r.b.notes || it.r.b.note">{{ it.r.b.notes || it.r.b.note }}</div>
                              <span v-if="!(it.r.b.special_meals_veg || it.r.b.special_meals_vegan || it.r.b.special_meals_halal || it.r.b.large_luggage || langs(it.r.b).length || (it.r.b.special_meals_allergies || '').trim() || (it.r.b.notes || it.r.b.note || '').trim())" class="t2-dim">—</span>
                            </td>
                            <template v-if="!vanOn">
                              <td><div class="t2-paywrap"><span class="t2-pay" :style="payChip(it.r.b).style">{{ payChip(it.r.b).txt }}</span><span v-if="cotTxt(it.r.b)" class="t2-cot" title="Cash on tour · เก็บเงินสดวันเดินทาง">{{ cotTxt(it.r.b) }}</span></div></td>
                              <td v-if="it.r.amount != null" class="t2-r t2-mono">{{ thb(it.r.amount) }}</td>
                              <td v-else class="t2-r t2-mono t2-dim" title="Multi-trip booking: operation-backend has no per-trip subtotal yet">—</td>
                              <td class="t2-c"><RouterLink class="t2-vcbtn" :to="`/bookings/${encodeURIComponent(it.r.b.id)}`" title="Voucher · ดูรายละเอียด booking" aria-label="Voucher">VC</RouterLink></td>
                            </template>
                            <td class="t2-c">
                              <span v-if="it.r.charterBoatId" class="boatcell" title="เรือที่ขึ้น">
                                <span class="av" :style="{ background: boatColor(it.r.charterBoatId, boats) }">{{ boatInitials(boats.find((b) => b.id === it.r.charterBoatId)?.name || it.r.charterBoatId) }}</span>
                                <span class="bn">{{ boats.find((b) => b.id === it.r.charterBoatId)?.name || it.r.charterBoatId }}</span>
                              </span>
                              <span v-else class="t2-dim" title="Boat assignment is in trip operations, which operation-backend does not return yet">—</span>
                            </td>
                          </tr>
                          <tr v-if="it.first && openPax.has(it.r.key)" class="t2-paxrow"><td :colspan="colN">
                            <div class="t2-paxttl">Passengers &middot; {{ it.r.b.passengers.length + 1 }}</div>
                            <div class="t2-paxlist">
                              <span><b>{{ it.r.b.lead_pax || '—' }}</b> <span class="t2-natl">lead</span></span>
                              <span v-for="p in it.r.b.passengers" :key="p.seq">{{ p.name }} <span v-if="p.nationality" class="t2-natl">{{ p.nationality }}</span></span>
                            </div>
                          </td></tr>
                          </template>
                        </template>
                        <tr v-if="z.charter" class="t2-zgap"><td :colspan="colN" /></tr>
                      </template>
                    </tbody>
                  </table>
                </div>

                <!-- Cancelled: kept as a record, not counted -->
                <div v-if="t.cxl.length" class="t2-cxl-sec">
                  <div class="t2-cxl-hd">&#10005; Cancelled &middot; {{ t.cxl.length }} booking{{ t.cxl.length > 1 ? 's' : '' }} <span style="font-weight:500;text-transform:none;color:#b08">(record kept &middot; not counted)</span></div>
                  <div v-for="r in t.cxl" :key="r.key" class="t2-cxl-row">
                    <span class="t2-cxl-vc">{{ r.b.voucher_ref || displayCode(r.b) }}</span>
                    <span class="t2-cxl-ag">{{ isB2C(r.b) ? 'B2C' : r.b.agent_id || '—' }}</span>
                    <span class="t2-cxl-cu">{{ r.b.lead_pax || '—' }}</span>
                    <span class="t2-cxl-px">{{ r.pax.total }} pax</span>
                    <span class="t2-cxl-ch">{{ cxlCharge(r.b) }}</span>
                    <span class="t2-cxl-rs">{{ r.b.cancellation_reason || '' }}</span>
                    <RouterLink class="t2-ghost-go" :to="`/bookings/${encodeURIComponent(r.b.id)}`" title="View booking">View</RouterLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Ported from the legacy By-trip tab: the BKV2_T2_CSS block in allotment_v2/js/booking.js (only the
   rules for the classes rendered here), the #view-booking card rules of 01-base.css and the BuildAxis
   skin of 02-skins.css. `#view-booking` is `.btw`; class names are kept so the two can be compared. */
.btw {
  --shadow: 0 1px 3px rgba(26, 35, 50, 0.07), 0 4px 12px rgba(26, 35, 50, 0.04);
  font-family: 'Inter', 'IBM Plex Sans Thai', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  background: #F6F7F9;
  --bk-navy-deep: #2952C8; --bk-navy: #3A6FF7; --bk-navy-mid: #7DA0E8;
  --bk-navy-soft: #AFC4F0; --bk-navy-light: #D6E2FB; --bk-navy-50: #EEF3FF;
  --ink: #1F2A44; --ink-mid: #475569; --ink-soft: #64748B;
  --border: #E5E7EB;
  --sand: #F6F7F9; --sand-mid: #F1F5F9; --sand-dark: #E5E7EB;
  --r: 16px; --r-sm: 11px; --r-lg: 18px;
  --coral: #3A6FF7; --coral-light: #EEF3FF; --coral-soft: #EEF3FF;
  --bg: #F6F7F9; --ink-faint: #94A3B8; --border-2: #EEF0F3; --white: #ffffff;
  /* Van mode (legacy BKV2_T2_CSS + van-mode inline styles). This page has no dark theme yet. */
  --van: #0F6E56; --van-soft: #F1FBF6; --van-soft-2: #DCF0E7;
  --sel: #185FA5; --sel-soft: #EEF5FC;
  --van-missing: #E05B5B; --van-missing-soft: #FCEDED;
  --van-mixed: #7A1FA2; --van-mixed-soft: #F3E0F7;
  --van-ret: #534AB7;
  color: var(--ink);
  border-radius: 16px; padding: 14px 16px 18px;
}
.btw * { box-sizing: border-box; font-family: inherit; }
.bkv2 { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; margin-top: 0; box-shadow: var(--shadow); }
.bkv2-bodycard { border-radius: 18px !important; box-shadow: 0 12px 30px rgba(20, 40, 80, 0.11), 0 2px 6px rgba(20, 40, 80, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7) !important; }
.bkv2-empty { padding: 60px 20px; text-align: center; background: var(--white); margin: 0; }
.bkv2-empty .ttl { font-size: 14px; font-weight: 500; color: var(--ink); margin-bottom: 6px; }
.bkv2-empty .ttl.err { color: #A32D2D; }
.bkv2-empty .sub { font-size: 12px; color: var(--ink-soft); margin-bottom: 18px; }
.bkv2-newbtn { padding: 6px 12px; border: 1px solid var(--bk-navy); background: var(--bk-navy); color: var(--white); font-size: 12px; border-radius: var(--r-sm); font-family: inherit; font-weight: 500; cursor: pointer; }

/* 02-skins.css: soft shadow + rounder cards */
.t2-listcard { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06); border-radius: 16px !important; }

/* ── BKV2_T2_CSS (booking.js) ── */
.t2-shell { display: flex; align-items: flex-start; background: var(--btband, #EDE3E3); }
.t2-main { flex: 1; min-width: 0; background: var(--btband, #EDE3E3); }
.t2-wrap { box-sizing: border-box; padding: 0 8px 40px; overflow-x: auto; overflow-y: visible; overscroll-behavior-x: contain; overscroll-behavior-y: auto; }
.t2-wrap.busy { opacity: 0.6; }
.t2-trip { background: transparent; border: none; border-radius: 0; margin-bottom: 12px; overflow: visible; }
.t2-listcard { background: var(--white); border: 1px solid var(--border); border-radius: 14px; overflow: visible; }
.t2-notrun { background: #FBF3E6; border: 1.5px solid #E0C79A; border-radius: 9px; padding: 11px 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; }
.t2-notrun-ic { font-size: 19px; color: #8A5B00; flex: none; }
.t2-notrun-t { font-size: 13px; font-weight: 700; color: #8A5B00; }
.t2-notrun-s { font-size: 11px; color: #9a7433; margin-top: 1px; }
.t2-trip-closed .t2-listcard { background: #FDFAF3; border-color: #E7D6B4; }
.t2-nobk { padding: 11px 16px; font-size: 11px; color: var(--ink-soft); font-style: italic; border-top: 1px solid var(--border-2); }
.t2-vcbtn { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; border-radius: 50%; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; color: #5F5E5A; background: transparent; border: 1px solid #B4B2A9; cursor: pointer; font-family: inherit; line-height: 1; text-decoration: none; }
.t2-vcbtn:hover { border-color: #5F5E5A; background: #F1EFE8; color: #2C2C2A; }
.t2-trip-variant { margin-left: 0; }
.t2-ghost-go { font-size: 9.5px; color: #185FA5; background: #fff; border: 1px solid #C5D8EA; border-radius: 5px; padding: 3px 9px; cursor: pointer; white-space: nowrap; font-family: inherit; text-decoration: none; }
.t2-ghost-go:hover { background: #EAF3FB; }
.t2-paywrap { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.t2-cot { display: inline-block; background: #E0F7FA; color: #00838F; border: 1px solid #9FE3EC; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap; }
.t2-needpickup { display: inline-block; background: #FCEFDD; color: #9A5B00; border: 1px solid #EAD2A8; font-size: 9.5px; font-weight: 700; padding: 1px 7px; border-radius: 6px; white-space: nowrap; }
.t2-pend-sec { margin-bottom: 10px; border: 1px solid #EAD9B0; border-radius: 9px; background: #FDF8EE; padding: 9px 13px; }
.t2-pend-hd { font-size: 10px; font-weight: 700; color: #8A5B00; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 5px; }
.t2-pend-row { display: flex; align-items: center; gap: 13px; padding: 6px 0; border-top: 0.5px solid #EFE0C2; font-size: 11.5px; color: #7a6338; flex-wrap: wrap; }
.t2-pend-why { flex: 1; min-width: 0; font-weight: 700; color: #8A5B00; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t2-pend-hold { font-size: 10px; font-weight: 700; color: #5F6B7A; background: #EEF1F5; border-radius: 6px; padding: 1px 7px; white-space: nowrap; }
.t2-pend-row .t2-cxl-vc, .t2-pend-row .t2-cxl-cu { text-decoration: none; opacity: 1; }
.t2-pend-row .t2-cxl-vc { color: #7a6338; }
.t2-pend-row .t2-cxl-cu { font-weight: 600; color: #5a4a2a; }
.t2-pend-row .t2-cxl-ag { color: #8a7350; }
.t2-cxl-sec { margin-top: 10px; border: 1px solid #E6C9C3; border-radius: 9px; background: #FCF6F5; padding: 9px 13px; }
.t2-cxl-hd { font-size: 10px; font-weight: 700; color: #A32D2D; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 5px; }
.t2-cxl-row { display: flex; align-items: center; gap: 13px; padding: 6px 0; border-top: 0.5px solid #F0DBD6; font-size: 11.5px; color: #8d726d; flex-wrap: wrap; }
.t2-cxl-row:first-of-type { border-top: none; }
.t2-cxl-vc { font-family: 'DM Mono', monospace; font-size: 10.5px; min-width: 90px; text-decoration: line-through; opacity: 0.75; }
.t2-cxl-ag { font-weight: 600; min-width: 96px; color: #7a5f5a; }
.t2-cxl-cu { min-width: 120px; text-decoration: line-through; opacity: 0.8; }
.t2-cxl-px { font-family: 'DM Mono', monospace; font-size: 10.5px; white-space: nowrap; }
.t2-cxl-ch { font-weight: 700; color: #A32D2D; white-space: nowrap; }
.t2-cxl-rs { flex: 1; min-width: 0; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.85; }

/* Programme band + zone bands (§btBand / §btTable) */
.t2-mtbl tr.t2-pband > td { background: #F7F4F1; border-top: 3px solid var(--pc); border-bottom: 1px solid #E2DBD4; padding: 8px 14px; }
.t2-pband .pw { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.t2-pband .pd { width: 11px; height: 11px; border-radius: 50%; background: var(--pc); flex: none; }
.t2-pband .pn { font-size: 14px; font-weight: 800; color: var(--pc); letter-spacing: 0.01em; }
.t2-pband .pt { font-size: 11px; color: #7a746d; font-weight: 600; font-family: 'DM Mono', monospace; }
.t2-pband .pb { font-size: 10px; font-weight: 800; color: #5b5b55; background: #fff; border: 1px solid #E2DBD4; border-radius: 6px; padding: 2px 8px; }
.t2-pband .ps { margin-left: auto; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 700; color: #5b5b55; white-space: nowrap; }
.t2-pband .ps em { font-style: normal; font-family: inherit; border-radius: 6px; padding: 2px 8px; margin-left: 7px; font-weight: 800; font-size: 11px; }
.t2-pband .ps em.ok { background: #DCF4E8; color: #0C6B47; }
.t2-pband .ps em.low { background: #FAEEDA; color: #854F0B; }
.t2-pband .ps em.full { background: #FCEBEB; color: #A32D2D; }
.t2-mtbl tr.t2-zband > td { background: #EEF2F7; border-top: 2px solid #C9D4E2; border-bottom: 1px solid #D9E1EA; padding: 7px 14px; box-shadow: inset 5px 0 0 var(--zc, #8b909c); }
.t2-mtbl tr.t2-zband-ch > td { background: #F2EEFC; border-top-color: #D6CCF2; border-bottom-color: #DDD4F2; box-shadow: inset 5px 0 0 #5B289A; }
.t2-zband .zw { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.t2-zband .zkind { font-size: 9px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: #8a93a1; }
.t2-zband .znm { font-size: 13px; font-weight: 800; color: #28344A; letter-spacing: 0.01em; }
.t2-zband-ch .znm { color: #5B289A; }
.t2-zband .zsub { font-size: 11px; color: #6a7180; font-weight: 600; }
.t2-zband-ch .zsub { color: #7A6FA8; }
.t2-zgap td { height: 26px; padding: 0; border: 0; background: transparent; }
.t2-zband-ch .zboats { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-left: 10px; }
.t2-zband-ch .zb { display: inline-flex; align-items: center; gap: 7px; background: #F4EFFC; border: 1px solid #DDD0F2; border-radius: 9px; padding: 3px 10px; font-size: 11.5px; white-space: nowrap; }
.t2-zband-ch .zb b { color: #5B289A; font-weight: 800; }
.t2-zband-ch .zb s { text-decoration: none; color: #7A6FA8; font-family: 'DM Mono', monospace; }

/* Manifest table */
.t2-tblscroll { overflow: visible; position: relative; z-index: 0; }
table.t2-mtbl { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1180px; font-size: 12px; }
table.t2-mtbl th { text-align: left; font-size: 9.5px; font-weight: 800; color: #4A3C3C; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; white-space: nowrap; position: sticky; top: var(--t2-head-top, 0px); z-index: 35; background: #EDE6E6; box-shadow: inset 0 -2px 0 #C4B2B2; }
table.t2-mtbl td { padding: 6px 9px; border-bottom: 1px solid #DCE1E8; border-right: 1px solid #E8EBEF; vertical-align: middle; white-space: nowrap; font-size: 12.5px; }
table.t2-mtbl td:last-child { border-right: 0; }
.t2-mtbl tr.t2-row { background: #fff; }
.t2-mtbl tr.t2-row > td { background: inherit; background-clip: padding-box; }
.t2-mtbl tr.t2-row > td:nth-child(-n+3), .t2-mtbl thead th:nth-child(-n+3) { position: sticky; z-index: 12; }
.t2-mtbl thead th:nth-child(-n+3) { z-index: 36; }
.t2-mtbl tr.t2-row > td:nth-child(1), .t2-mtbl thead th:nth-child(1) { left: 0; }
.t2-mtbl tr.t2-row > td:nth-child(2), .t2-mtbl thead th:nth-child(2) { left: var(--t2-fz1, 112px); }
.t2-mtbl tr.t2-row > td:nth-child(3), .t2-mtbl thead th:nth-child(3) { left: var(--t2-fz2, 254px); }
.t2-mtbl tr.t2-row > td:nth-child(3), .t2-mtbl thead th:nth-child(3) { border-right: 2px solid #C3CCD8; box-shadow: 3px 0 6px -3px rgba(15, 23, 42, 0.18); }
.t2-mtbl tr > td[colspan] > div { position: sticky; left: 0; width: -moz-max-content; width: max-content; max-width: 100%; }
table.t2-mtbl tr.t2-row:hover td { background: #fcfcfd; }
.t2-mtbl .t2-c, .t2-mtbl th.t2-c { text-align: center; }
.t2-mtbl td.t2-c { font-family: 'DM Mono', ui-monospace, monospace; }
.t2-mtbl .t2-r, .t2-mtbl th.t2-r { text-align: right; }
.t2-mono { font-family: 'DM Mono', monospace; }
.t2-dim { color: var(--ink-faint); }
.t2-agency { font-weight: 600; color: #0f7a5a; white-space: nowrap; display: inline-block; max-width: 130px; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
.t2-mtbl th.t2-pk, .t2-mtbl td.t2-pk { min-width: 196px; max-width: 196px; }
.t2-pickcell { display: inline-block; max-width: 190px; min-width: 80px; white-space: normal; overflow-wrap: break-word; line-height: 1.3; vertical-align: middle; font-weight: 700; font-size: 12.5px; color: #26303F; }
.t2-mtbl td.t2-cu, .t2-mtbl th.t2-cu { max-width: 210px; width: 210px; }
.t2-mtbl td.t2-cu { white-space: normal; line-height: 1.5; }
.t2-mtbl td.t2-ag, .t2-mtbl th.t2-ag { max-width: 142px; width: 142px; overflow: hidden; }
.t2-mtbl th.t2-vc { width: 104px; }
.t2-lead { font-weight: 700; white-space: nowrap; display: inline-block; max-width: 190px; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
.t2-vch { display: inline-block; max-width: 96px; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
.t2-leadonly { font-size: 10px; margin-left: 4px; }
.t2-more { font-size: 10px; border: 1px solid var(--border); background: var(--bg); color: var(--ink-soft); border-radius: 6px; padding: 1px 7px; cursor: pointer; margin-left: 5px; font-family: inherit; }
.t2-more:hover { border-color: var(--coral); color: var(--coral); }
.t2-zonetag { max-width: 104px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle; font-size: 11px; font-weight: 700; background: transparent; color: #2F4E77; border-radius: 0; padding: 0; white-space: nowrap; }
.t2-room { font-weight: 700; color: #1B2A55; background: transparent; border-radius: 0; padding: 0; }
.t2-sb { color: var(--ink-soft); display: inline-block; max-width: 118px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
.t2-req { max-width: 118px; overflow: hidden; }
.t2-rbwrap { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; max-width: 112px; }
.t2-rb { font-size: 10px; border-radius: 5px; padding: 2px 7px; font-weight: 600; white-space: nowrap; }
.t2-allerg, .t2-note { font-size: 11px; line-height: 1.35; max-width: 112px; white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.t2-allerg { color: #A32D2D; }
.t2-note { color: var(--ink-soft); margin-top: 2px; }
.t2-pay { font-size: 10px; background: #e7f0fb; color: #1d5fa5; border-radius: 6px; padding: 2px 8px; white-space: nowrap; }
.t2-paxrow td { background: #f6f7f9; padding: 9px 10px 9px 40px; }
.t2-paxttl { font-size: 10px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 5px; }
.t2-paxlist { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; }
.t2-natl { font-size: 10px; background: #E6F1FB; color: #185FA5; border-radius: 5px; padding: 1px 6px; }
/* Inline styles of the legacy row cells (voucher B2C tag, agency box, boat avatar) */
.b2c-tag { background: #E6F7F9; color: #0E7D8A; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; letter-spacing: 0.03em; }
.ag-b2c { background: #fff; border: 1px solid #E3E6EC; margin: 2px 3px; padding: 8px 10px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); max-width: 180px; display: flex; align-items: center; justify-content: center; }
.ag-b2c img { height: 22px; width: auto; display: block; }
.ag-box { margin: 2px 3px; padding: 11px; border-radius: 8px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }
.boatcell { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.boatcell .av { width: 22px; height: 22px; border-radius: 50%; color: #fff; font-size: 9px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-family: 'DM Mono', monospace; flex: none; }
.boatcell .bn { font-size: 12px; font-weight: 600; color: var(--ink); }

/* Header (§btHead) */
.bt-pkh { position: static; background: var(--btband, #E9E7E3); padding: 6px 6px 4px; margin-bottom: 0; }
.bt-hdtop { position: relative; display: flex; align-items: center; gap: 13px; padding: 0 8px 7px; flex-wrap: wrap; }
.bt-arw { width: 27px; height: 27px; flex: none; border: 1px solid rgba(0, 0, 0, 0.13); background: #fff; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #7d7a74; font-size: 14px; cursor: pointer; font-family: inherit; line-height: 1; }
.bt-dnum { font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1; font-family: 'DM Mono', monospace; display: inline-block; min-width: 43px; text-align: center; flex: none; }
.bt-dgrp { display: inline-block; min-width: 118px; flex: none; }
.bt-dwk { display: block; font-size: 15px; font-weight: 800; line-height: 1.05; }
.bt-dmo { position: relative; display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.13em; color: #8d8880; text-transform: uppercase; cursor: pointer; }
.bt-dmo input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.bt-today { background: #15201a; color: #fff; border: none; border-radius: 999px; padding: 5px 13px; font-size: 11px; font-weight: 700; font-family: inherit; flex: none; min-width: 100px; text-align: center; box-sizing: border-box; }
.bt-today.gh { background: #fff; color: #5b5b55; border: 1px solid rgba(0, 0, 0, 0.13); cursor: pointer; }
.bt-brand { position: absolute; left: 50%; transform: translateX(-50%); font-size: 20px; font-weight: 800; letter-spacing: 0.46em; padding-left: 0.46em; color: #1F2124; white-space: nowrap; pointer-events: none; max-width: 44%; overflow: hidden; text-overflow: ellipsis; }
.bt-hgrid { display: grid; grid-template-columns: minmax(0, 1.28fr) minmax(0, 0.92fr) minmax(0, 1.9fr); gap: 9px; padding: 0 8px; align-items: stretch; }
.bt-hgrid > div { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.bt-hgrid > div > .bt-c { flex: 1 1 auto; display: flex; flex-direction: column; }
.bt-hgrid > div > .bt-c > .bt-pgbody, .bt-hgrid > div > .bt-c > .bt-blist, .bt-hgrid > div > .bt-c > .bt-tgl { flex: 1 1 auto; }
.bt-c { background: #fff; border: 1px solid rgba(0, 0, 0, 0.09); border-radius: 12px; overflow: hidden; }
.bt-ct { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; color: #1F2124; text-transform: uppercase; padding: 7px 11px 5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bt-prog > .bt-ct, .bt-prog > .bt-ct .big { color: #12518F; }
.bt-boat > .bt-ct { color: #A32D2D; }
.bt-lockc > .bt-ct { color: #9A3B21; }
.bt-notice > .bt-ct { color: #5B289A; }
.bt-ct .big { font-size: 13.5px; font-weight: 800; letter-spacing: 0; text-transform: none; }
.bt-ct .sp { margin-left: auto; }
.bt-cnt { background: #EFEBE7; color: #403833; border-radius: 999px; padding: 2px 9px; font-size: 10.5px; font-weight: 800; letter-spacing: 0; }
.bt-cnt.over { background: #FBEAE7; color: #A32D2D; }
.bt-daytot { margin-left: auto; font-size: 10.5px; color: #6b6660; font-weight: 600; letter-spacing: 0; text-transform: none; text-align: right; line-height: 1.25; }
.bt-daytot b { font-family: 'DM Mono', monospace; font-size: 12.5px; font-weight: 800; color: #3a3a36; }
.bt-daytot i { display: block; font-style: normal; font-family: 'DM Mono', monospace; font-size: 9.5px; color: #a3a099; font-weight: 600; }
.bt-seg { display: inline-flex; border: 1px solid #E0DBD5; border-radius: 999px; overflow: hidden; background: #fff; }
.bt-seg-b { font-size: 10px; font-weight: 700; padding: 3px 8px; color: #5b6472; background: transparent; border: none; cursor: pointer; font-family: inherit; letter-spacing: 0; text-transform: none; }
.bt-seg-b.on { background: #22262e; color: #fff; }
.bt-clear { font-size: 9.5px; font-weight: 700; color: #A32D2D; background: #fff; letter-spacing: 0; text-transform: none; border: 1px solid #E6C9C3; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-family: inherit; }
.bt-pgbody { padding-bottom: 10px; overflow: auto; min-height: 0; max-height: 214px; scroll-padding-bottom: 12px; }
.bt-pgf { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 8px; margin: 0 8px 3px; box-shadow: inset 4px 0 0 var(--e); cursor: pointer; }
.bt-pgf.on { box-shadow: inset 4px 0 0 var(--e), 0 0 0 1.5px var(--e); }
.bt-pgf .ar { color: #a6a29b; font-size: 10px; }
.bt-pgf .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--e); flex: none; }
.bt-pgf .nm { min-width: 0; font-size: 12.5px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bt-pgf .n { font-family: 'DM Mono', monospace; font-size: 12.5px; font-weight: 700; color: #4a4a45; }
.bt-pgf .sp { margin-left: auto; display: flex; gap: 6px; }
.bt-tag { border-radius: 6px; padding: 1px 7px; font-size: 9.5px; font-weight: 700; white-space: nowrap; }
.bt-tag.run { background: #E6F5EC; color: #0F6E56; }
.bt-tag.no { background: #FBEDEA; color: #A32D2D; }
.bt-pgv { display: flex; align-items: center; gap: 7px; padding: 3px 10px 3px 24px; font-size: 11px; color: #5b6472; margin: 0 8px; white-space: nowrap; cursor: pointer; border-radius: 7px; }
.bt-pgv:hover { background: #FAF8F5; }
.bt-pgv.on { background: #EFEAFB; box-shadow: inset 3px 0 0 #5B289A; }
.bt-pgv.off { opacity: 0.6; cursor: default; }
.bt-pgv .vn { flex: none; font-weight: 700; color: #3a3a36; }
.bt-pgv .sp { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: none; }
.bt-seat { font-family: 'DM Mono', monospace; font-size: 11px; color: #8a8a82; }
.bt-seat b { color: #3a3a36; font-weight: 800; }
.bt-lk { font-size: 10px; font-weight: 700; color: #8A5B00; background: #FBF0DA; border-radius: 6px; padding: 1px 6px; }
.bt-free { font-size: 10px; font-weight: 800; border-radius: 6px; padding: 1px 7px; white-space: nowrap; }
.bt-free.ok { background: #DCF4E8; color: #0C6B47; }
.bt-free.low { background: #FAEEDA; color: #854F0B; }
.bt-free.full { background: #FCEBEB; color: #A32D2D; }
.bt-free.none { background: #F1EFE8; color: #a3a099; }
.bt-none { padding: 22px 14px; text-align: center; font-size: 12px; color: #a8a49c; }
.bt-none2 { display: block; padding: 14px; text-align: center; font-size: 11.5px; color: #a8a49c; }
.bt-boat { border-left: 4px solid var(--c); }
.bt-boat .bt-ct { padding-bottom: 2px; }
.bt-bnm { font-size: 12.5px; font-weight: 800; padding: 2px 12px 6px; line-height: 1.3; }
.bt-bnm span { display: block; font-size: 10.5px; font-weight: 600; color: #9b9088; }
.bt-avrow { display: flex; align-items: stretch; gap: 0; padding: 2px 8px 9px; }
.bt-av { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; }
.bt-av .k { font-size: 9.5px; color: #9b9088; font-weight: 600; white-space: nowrap; }
.bt-av .v { font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 800; line-height: 1.05; color: #3a3a36; }
.bt-av .v.dim { color: #b6b1a8; }
.bt-av .v.low { color: #854F0B; }
.bt-av .v.full { color: #A32D2D; }
.bt-av .v.lk { color: #A32D2D; }
.bt-avs { width: 1px; background: #EFEBE5; margin: 2px 0; }
.bt-blist { display: flex; flex-direction: column; gap: 5px; padding: 0 10px 10px; max-height: 196px; overflow: auto; }
.bt-brow { display: flex; align-items: center; gap: 8px; border: 1.5px solid #E4E1DA; border-radius: 10px; padding: 5px 9px; background: #fff; }
.bt-brow.over { border-color: #F0BDB4; background: #FDF4F2; }
.bt-brow .d { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.bt-brow .nm { font-size: 12.5px; font-weight: 800; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-brow .ld { font-family: 'DM Mono', monospace; font-size: 11.5px; font-weight: 700; background: #F3EFEB; border-radius: 7px; padding: 2px 8px; color: #3a3a36; white-space: nowrap; }
.bt-brow.over .ld { background: #F7DCD7; color: #A32D2D; }
.bt-tgl { display: flex; flex-direction: column; padding: 2px 10px 8px; overflow: auto; min-height: 0; max-height: 196px; }
.bt-tgp { padding: 7px 0 8px; border-bottom: 1px dashed #EAE5DE; cursor: pointer; }
.bt-tgp:last-child { border-bottom: 0; }
.bt-tgh { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.bt-tgh i { width: 9px; height: 9px; border-radius: 50%; background: var(--tc); flex: none; }
.bt-tgh .nm { font-size: 12.5px; font-weight: 800; color: var(--tc); line-height: 1.2; }
.bt-tgh .tm { font-size: 10px; color: #948f88; font-weight: 600; }
.bt-tgh .sm { margin-left: auto; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 700; color: #5b5b55; white-space: nowrap; }
.bt-tgh .sm em { font-style: normal; border-radius: 5px; padding: 1px 6px; margin-left: 5px; font-weight: 800; }
.bt-tgh .sm em.ok { background: #DCF4E8; color: #0C6B47; }
.bt-tgh .sm em.low { background: #FAEEDA; color: #854F0B; }
.bt-tgh .sm em.full { background: #FCEBEB; color: #A32D2D; }
.bt-tgb { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; padding-left: 16px; }
.bt-tbc { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #E6E2DB; border-radius: 8px; padding: 2px 8px; background: #fff; font-size: 11px; font-weight: 700; color: #3a3a36; }
.bt-tbc.over { border-color: #EFC5BD; background: #FDF4F2; color: #A32D2D; }
.bt-tbc.none { color: #a8a49c; font-weight: 600; border-style: dashed; }
.bt-tbc i { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.bt-tbc s { text-decoration: none; font-family: 'DM Mono', monospace; font-size: 10.5px; font-weight: 700; color: #8a857e; }
.bt-tbc.over s { color: #A32D2D; }
.bt-tgfoot { padding: 6px 12px 8px; border-top: 1px solid #F2EEE9; font-size: 10px; color: #948f88; text-align: center; }
.bt-prep { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 6px 10px 9px; border-top: 1px dashed #EAE5DE; margin-top: auto; }
.bt-prep .l { font-size: 8.5px; font-weight: 800; letter-spacing: 0.08em; color: #a09a92; text-transform: uppercase; flex: none; }
.bt-pc { font-size: 9.5px; font-weight: 700; border-radius: 5px; padding: 1px 7px; white-space: nowrap; }
.bt-col3 { display: flex; flex-direction: column; gap: 9px; }
.bt-pair { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 9px; align-items: stretch; flex: none; }
.bt-pair > .bt-c { display: flex; flex-direction: column; }
.bt-pair > .bt-c > .bt-mrow, .bt-pair > .bt-c > .bt-srow { flex: 1 1 auto; align-items: stretch; }
.bt-pair2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr); gap: 9px; align-items: stretch; flex: 1 1 auto; }
.bt-pair2 > .bt-c { display: flex; flex-direction: column; }
.bt-pair2 > .bt-c > .bt-lkl, .bt-pair2 > .bt-c > .bt-ncb { flex: 1 1 auto; }
.bt-mrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr); gap: 6px; padding: 9px 10px 10px; }
.bt-mc { position: relative; border: 1.5px solid #E4DEDA; border-radius: 11px; padding: 8px 9px 8px 12px; display: flex; align-items: center; gap: 6px; background: #fff; overflow: hidden; --mc: #8a8078; cursor: pointer; font-family: inherit; text-align: left; }
.bt-mc::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--mc); }
.bt-mc .tx { display: flex; flex-direction: column; min-width: 0; }
.bt-mc .t { font-size: 12.5px; font-weight: 800; line-height: 1.2; color: #1F2124; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bt-mc .s { font-size: 9.5px; color: #8a7f78; white-space: nowrap; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; }
.bt-mc .n { margin-left: auto; flex: none; font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 800; line-height: 1; border-radius: 8px; padding: 5px 7px; background: #F3EFEB; color: #5a504a; }
.bt-mc.dis { opacity: 0.45; cursor: not-allowed; }
/* Mode button states (legacy booking.js:8429-8442). */
.bt-mc.warn .n { background: #FBEFD8; color: #8A5B00; }
.bt-mc.ok .n { background: #E4F3EA; color: #0F6E56; font-size: 13px; }
.bt-mc.on { background: var(--mc); border-color: var(--mc); box-shadow: 0 2px 7px rgba(0, 0, 0, 0.16); }
.bt-mc.on::before { background: rgba(255, 255, 255, 0.55); }
.bt-mc.on .t { color: #fff; font-size: 13px; }
.bt-mc.on .s { display: none; }
.bt-mc.on .n { background: rgba(255, 255, 255, 0.2); color: #fff; }
.bt-mc .x { width: 16px; height: 16px; border-radius: 50%; background: rgba(255, 255, 255, 0.22); color: #fff; font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex: none; }

/* ── Van mode (legacy BKV2_T2_CSS, booking.js:7719-7721, 8138-8150) ── */
.bt-col3 > .bt-vans { flex: 1 1 auto; }
.bt-hdwarn { margin-left: auto; display: inline-flex; gap: 5px; flex-wrap: wrap; position: relative; z-index: 1; }
.t2-hd-warnchip { font-size: 10.5px; font-weight: 600; color: #fff; background: #C0392B; border: 0; border-radius: 6px; padding: 3px 9px; cursor: pointer;
  font-family: inherit; transition: filter 0.12s; }
.t2-hd-warnchip:hover { filter: brightness(1.08); }
.t2-hd-warnchip b { font-family: 'DM Mono', monospace; font-size: 11px; }
/* One-off chip colours (booking.js:9740-9741). */
.t2-hd-warnchip--van { background: #E07C24; }
.t2-hd-warnchip--ret { background: #B8860B; }
.t2-hd-warnchip--mixed { background: var(--van-mixed); }
.t2-mtbl.t2-van .t2-more, .t2-mtbl.t2-van .t2-leadonly { display: none; }
.t2-mtbl.t2-van td.t2-cu { width: 186px; max-width: 186px; }
.t2-mtbl th.t2-gwrap, .t2-mtbl td.t2-gwrap { width: 184px; max-width: 184px; }
.t2-mtbl th.t2-gwrap { color: #0C6B47; background: var(--van-soft-2); }
.t2-mtbl td.t2-gwrap { background: #F3FBF7; }
.t2-mtbl tr.t2-novan > td:first-child { border-left: 2px solid var(--van-missing); }
.t2-mtbl tr.t2-novan > td:last-child { border-right: 2px solid var(--van-missing); }
.t2-mtbl tr.t2-novan-last > td { border-bottom: 2px solid var(--van-missing); }
.t2-tmold { font-size: 10px; color: #a8a49c; }
.t2-altpick { color: #5B289A; font-weight: 600; }
.t2-ret-self { background: #EDEFF2; color: #5F6B7A; white-space: nowrap; }
.t2-ret-ok { background: #E1F5EE; color: var(--van); white-space: nowrap; }
.t2-ret-same { background: #EAF1FA; color: #2C5F94; white-space: nowrap; }
.t2-ret-alert { background: #FBE3E1; color: #C0392B; font-weight: 700; white-space: nowrap; }
/* bkV2ScrollToVan's flash on the group header row. */
.t2-flash { animation: t2-flash 1.4s ease-out; }
@keyframes t2-flash { 0%, 40% { filter: brightness(0.86); } 100% { filter: none; } }
.bt-srow { display: flex; gap: 7px; padding: 9px 10px 10px; align-items: stretch; }
.bt-sbox { flex: 1; display: flex; align-items: center; gap: 7px; border: 1px solid #E4DCD5; border-radius: 10px; padding: 4px 10px; background: #fff; min-width: 0; }
.bt-sbox .ic { font-size: 12px; color: #a49c94; flex: none; }
.bt-sbox input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-family: inherit; font-size: 12.5px; color: #22262e; padding: 4px 0; }
.bt-sbox .clr { border: none; background: transparent; color: #a49c94; font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; font-family: inherit; }
.bt-shit { flex: none; align-self: center; font-size: 10.5px; font-weight: 800; color: #0C447C; background: #E7EEFA; border-radius: 7px; padding: 4px 9px; white-space: nowrap; }
.bt-lkbadge { font-size: 10.5px; font-weight: 800; color: #fff; background: #C0392B; border-radius: 7px; padding: 2px 9px; letter-spacing: 0; }
.bt-lkbtn { font-size: 10.5px; font-weight: 700; border-radius: 7px; padding: 3px 10px; border: 1px solid #BFE3CC; background: #fff; color: #0F6E56; cursor: pointer; font-family: inherit; letter-spacing: 0; }
.bt-lkbtn.gh { border-color: #E2D9D2; color: #5b6472; }
.bt-lkbtn:disabled { opacity: 0.45; cursor: default; }
.bt-lkl { display: flex; flex-direction: column; padding: 0 8px 8px; gap: 2px; overflow: auto; min-height: 0; max-height: 101px; }
.bt-lkr { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 8px; background: #fff; border: 1px solid #EFE6E1; }
.bt-lkr:nth-child(even) { background: #FDFBF9; }
.bt-lkr.done { border-color: #E8E4DD; background: #FAF9F6; }
.bt-lkr.gone { border-color: #EEEBE5; background: #FAF9F6; opacity: 0.72; }
.bt-lkr > i { width: 8px; height: 8px; border-radius: 50%; flex: none; background: #C0392B; }
.bt-lkr.done > i { background: #C9C6BE; }
.bt-lkr.gone > i { background: #DAD6CE; }
.bt-lkr .nm { font-size: 11.5px; font-weight: 700; color: #3a3a36; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-lkr.done .nm, .bt-lkr.gone .nm { color: #8f8a82; font-weight: 600; }
.bt-lkr .q { flex: none; display: flex; align-items: baseline; gap: 4px; font-family: 'DM Mono', monospace; }
.bt-lkr .q b { font-size: 15px; font-weight: 800; color: #A32D2D; line-height: 1; }
.bt-lkr.done .q b { color: #9b9088; }
.bt-lkr .q s { text-decoration: none; font-size: 10px; color: #9b9088; font-weight: 600; }
.bt-lkfoot { padding: 5px 12px 8px; font-size: 10px; color: #8a8078; border-top: 1px solid #F2ECE8; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bt-lkfoot b { color: #3a3a36; font-family: 'DM Mono', monospace; }
.bt-lkfoot .scr { font-size: 9.5px; font-weight: 800; color: #7A2B18; background: #FBEFEC; border-radius: 5px; padding: 1px 7px; }
.bt-notice { border-left: 4px solid #6D28D9; }
.bt-ncb { display: flex; flex-direction: column; gap: 4px; padding: 2px 9px 8px; overflow: auto; min-height: 0; }
.bt-nc { display: flex; gap: 7px; border-radius: 8px; padding: 5px 8px; font-size: 10.5px; line-height: 1.4; }
.bt-nc .i { flex: none; font-weight: 800; }
.bt-nc i { display: block; font-style: normal; font-size: 9.5px; color: #7a8087; font-weight: 400; margin-top: 1px; }
.bt-nc.warn { background: #FDF6E9; color: #7A4A00; }

/* BKV2_T2_CSS breakpoints */
@media (max-width: 1740px) {
  .bt-hgrid { grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr); }
  .bt-hgrid > div:nth-child(3) { grid-column: 1 / -1; }
  .bt-col3 { flex-direction: row; align-items: stretch; }
  .bt-col3 > .bt-pair { flex: 1 1 46%; }
  .bt-col3 > .bt-pair2, .bt-col3 > .bt-vans { flex: 1 1 54%; }
}
@media (max-width: 1150px) {
  .bt-hgrid { grid-template-columns: minmax(0, 1fr); }
  .bt-hgrid > div:nth-child(3) { grid-column: auto; }
  .bt-col3 { flex-direction: column; }
  .bt-pair, .bt-pair2 { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 820px) {
  .btw { padding: 10px 8px 14px; }
  .bt-brand { display: none; }
  .bt-mrow { grid-template-columns: minmax(0, 1fr); }
}
</style>
