<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { localYmd, thaiLongDate } from '@/lib/date';
import { ob, type ObAvailabilityDay, type ObBoat, type ObRoute } from '@/lib/ob';

import { buildMonth, MONTHS, monthRange, PIER_LABEL, PIER_NAME, PIERS, type Chip, type Pier, WEEKDAYS } from './model';

const route = useRoute();
const router = useRouter();

// Month, pier, hidden routes and the open day live in the URL, like Travel Summary's filters.
const today = localYmd();
const ym = computed(() => {
  const m = typeof route.query.month === 'string' ? /^(\d{4})-(\d{2})$/.exec(route.query.month) : null;
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 };
});
const pier = computed<Pier | ''>(() => ((PIERS as readonly string[]).includes(String(route.query.pier)) ? (route.query.pier as Pier) : ''));
const hidden = computed(() => new Set(typeof route.query.hide === 'string' && route.query.hide ? route.query.hide.split(',') : []));
const selected = computed(() => (typeof route.query.day === 'string' ? route.query.day : ''));

function setQuery(patch: Record<string, string | undefined>) {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) if (typeof v === 'string' && v) q[k] = v;
  router.replace({ query: q });
}
function shiftMonth(n: number) {
  const d = new Date(ym.value.year, ym.value.month + n, 1, 12);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  setQuery({ month: key === today.slice(0, 7) ? undefined : key, day: undefined });
}
const thisMonth = () => setQuery({ month: undefined, day: undefined });
const pickPier = (p: Pier | '') => setQuery({ pier: p === pier.value ? undefined : p || undefined });
function toggleRoute(id: string) {
  const s = new Set(hidden.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  setQuery({ hide: [...s].join(',') || undefined });
}
const pickDay = (d: string) => setQuery({ day: d === selected.value ? undefined : d });

const routes = ref<ObRoute[]>([]);
const boats = ref<ObBoat[]>([]);
const days = ref<ObAvailabilityDay[]>([]);
const loadedKey = ref('');
const loading = ref(false);
const error = ref('');
let seq = 0;

async function load() {
  const my = ++seq;
  const { from, to } = monthRange(ym.value.year, ym.value.month);
  loading.value = true; error.value = '';
  try {
    const [rs, bs, ds] = await Promise.all([
      routes.value.length ? routes.value : ob.routes(),
      boats.value.length ? boats.value : ob.boats(),
      ob.availability(from, to),
    ]);
    if (my !== seq) return;
    routes.value = rs; boats.value = bs; days.value = ds; loadedKey.value = from;
  } catch (e) {
    if (my !== seq) return;
    days.value = [];
    error.value = e instanceof ApiError && e.status === 401 ? 'signed-out' : e instanceof Error ? e.message : String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
watch(ym, load, { immediate: true });

const view = computed(() => {
  const { from } = monthRange(ym.value.year, ym.value.month);
  if (loadedKey.value !== from) return null;
  return buildMonth(ym.value.year, ym.value.month, days.value, routes.value, boats.value, { pier: pier.value, hidden: hidden.value }, today);
});
const dayCell = computed(() => view.value?.cells.find((c) => c.date === selected.value) || null);

// Chip skin from the route colour (legacy _chSkin: tinted fill, stronger border, darkened text).
function rgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = (i: number) => parseInt(c.slice(i, i + 2), 16);
  return [n(0) || 136, n(2) || 136, n(4) || 136];
}
function skin(color: string) {
  const [r, g, b] = rgb(color);
  const dk = (v: number) => Math.round(v * 0.34);
  return { background: `rgba(${r},${g},${b},.30)`, borderColor: `rgba(${r},${g},${b},.65)`, color: `rgb(${dk(r)},${dk(g)},${dk(b)})` };
}
function chipTitle(c: Chip) {
  return `${c.name} · ${c.free} of ${c.cap} seats free · ${c.pctSold}% sold` + (c.boats.length > 1 ? ` · ${c.boats.length} boats` : '')
    + (c.boats.some((b) => b.chartered) ? ' · charter' : '');
}
/** Legacy 5-tier occupancy colour: the fuller, the greener. */
const tier = (p: number) => (p >= 80 ? '#1F4D2C' : p >= 60 ? '#3B6D11' : p >= 40 ? '#8A6A0B' : p >= 20 ? '#B4600F' : '#A32D2D');
</script>

<template>
  <section class="cal">
    <header class="cal-hd">
      <div class="nav">
        <button type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
        <h1>{{ MONTHS[ym.month] }} {{ ym.year }}</h1>
        <button type="button" aria-label="Next month" @click="shiftMonth(1)">›</button>
        <button type="button" class="now" @click="thisMonth">This month</button>
      </div>
      <div class="seg" role="group" aria-label="Pier">
        <button type="button" :class="{ on: !pier }" @click="pickPier('')">All piers</button>
        <button v-for="p in PIERS" :key="p" type="button" :class="{ on: pier === p }" @click="pickPier(p)">{{ PIER_NAME[p] }}</button>
      </div>
      <div v-if="view" class="stats">
        <span>Trips <b>{{ view.stats.trips }}</b></span>
        <span>Seats free <b>{{ view.stats.free.toLocaleString('en-US') }}</b></span>
        <span class="g">Sold <b>{{ view.stats.pctSold }}%</b></span>
      </div>
    </header>

    <p v-if="error === 'signed-out'" class="card">Your session has ended. <RouterLink to="/login?next=/calendar">Sign in</RouterLink></p>
    <p v-else-if="error" class="card err">Could not load availability: {{ error }} <button type="button" class="linklike" @click="load">Retry</button></p>

    <template v-if="view">
      <div v-if="view.routes.length" class="routes">
        <button v-for="r in view.routes" :key="r.id" type="button" class="rc" :class="{ off: hidden.has(r.id) }"
                :title="(hidden.has(r.id) ? 'Show ' : 'Hide ') + r.name" @click="toggleRoute(r.id)">
          <i :style="{ background: r.color }" />{{ r.name }} <span class="muted">{{ PIER_LABEL[r.pier] }} · {{ r.trips }}</span>
        </button>
      </div>
      <p v-if="view.closedAllMonth.length" class="closed">
        Closed all month:
        <span v-for="p in view.closedAllMonth" :key="p" class="p">{{ PIER_NAME[p] }}</span>
      </p>
      <p v-if="!view.routes.length && !loading" class="muted empty">
        No boats are deployed this month in operation-backend. Days fill in once Boat Ops deployments are there.
      </p>

      <div class="grid-wrap" :class="{ busy: loading }">
        <div class="wd"><div v-for="w in WEEKDAYS" :key="w">{{ w }}</div></div>
        <div class="grid">
          <div v-for="i in view.pad" :key="'pad' + i" class="cell pad" />
          <button v-for="c in view.cells" :key="c.date" type="button" class="cell"
                  :class="{ today: c.today, past: c.past, sel: c.date === selected }" @click="pickDay(c.date)">
            <span class="dn">{{ c.day }}<span v-if="c.today" class="tb">TODAY</span></span>
            <span class="rows">
              <span v-for="ch in c.chips" :key="ch.routeId" class="rw" :style="skin(ch.color)" :title="chipTitle(ch)">
                <span class="n">{{ ch.name }}</span>
                <span v-if="ch.boats.length > 1" class="t">{{ ch.boats.length }}b</span>
                <span class="v" :class="{ full: ch.full && !ch.charterOnly, ch: ch.charterOnly }">{{ ch.charterOnly ? 'CH' : ch.free }}</span>
              </span>
              <span v-for="p in c.shut" :key="p" class="rw shut"><span class="n">Closed · {{ PIER_LABEL[p] }}</span></span>
            </span>
          </button>
        </div>
      </div>
    </template>
    <p v-else-if="loading" class="muted">Loading…</p>

    <aside v-if="dayCell" class="drawer" aria-label="Day detail">
      <div class="dw-hd">
        <div>
          <h2>{{ thaiLongDate(dayCell.date) }}</h2>
          <p class="muted">{{ dayCell.chips.length }} routes running</p>
        </div>
        <button type="button" class="linklike" @click="pickDay(dayCell.date)">Close</button>
      </div>
      <p v-if="!dayCell.chips.length" class="muted">No boats deployed on this day.</p>
      <div v-for="ch in dayCell.chips" :key="ch.routeId" class="tc" :style="{ borderColor: skin(ch.color).borderColor }">
        <div class="r1">
          <span class="tm">{{ routes.find((r) => r.id === ch.routeId)?.times?.[0] || '—' }}</span>
          <span class="pr" :style="{ color: tier(ch.pctSold) }">{{ ch.pctSold }}% sold</span>
        </div>
        <div class="r2">
          <span class="rn">{{ ch.name }}</span>
          <span class="sv" :class="{ f: ch.full }">{{ ch.full ? (ch.charterOnly ? 'CHARTER' : 'FULL') : ch.free }}</span>
        </div>
        <dl>
          <dt>Seats</dt><dd>{{ ch.cap }}</dd>
          <dt>Booked</dt><dd>{{ ch.day.booked_pax }}</dd>
          <dt v-if="ch.day.charter_pax">Charter pax</dt><dd v-if="ch.day.charter_pax">{{ ch.day.charter_pax }}</dd>
          <dt v-if="ch.day.locked_pax">Locked</dt><dd v-if="ch.day.locked_pax">{{ ch.day.locked_pax }}</dd>
        </dl>
        <ul class="boats">
          <li v-for="b in ch.boats" :key="b.id">{{ b.name }} · {{ b.capacity }} seats<span v-if="b.chartered" class="chb">Charter</span></li>
        </ul>
      </div>
    </aside>

    <p class="foot muted">
      Data from operation-backend. Not shown yet: boats down for repair, weather closures and land routes
      (see <code>apps/web/BACKEND_NEEDS.md</code>).
    </p>
  </section>
</template>

<style scoped>
.cal { display: flex; flex-direction: column; gap: 10px; }
.cal-hd { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.nav { display: flex; align-items: center; gap: 6px; }
.nav h1 { margin: 0 4px; font-size: 1.2rem; min-width: 10ch; text-align: center; }
.nav button, .seg button, .rc { font: inherit; cursor: pointer; }
.nav button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 999px; padding: 3px 11px; }
.nav .now { font-size: 0.8rem; }
.seg { display: flex; gap: 3px; background: var(--border); padding: 3px; border-radius: 10px; flex-wrap: wrap; }
.seg button { border: 0; background: none; color: var(--muted); border-radius: 7px; padding: 4px 10px; font-size: 0.8rem; }
.seg button.on { background: var(--surface); color: var(--text); font-weight: 700; }
.stats { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.stats span { border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 3px 11px; font-size: 0.78rem; color: var(--muted); }
.stats b { color: var(--text); margin-left: 3px; font-family: ui-monospace, monospace; }
.stats .g b { color: #047857; }
.err { color: #c0392b; }
.routes { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.rc { display: flex; align-items: center; gap: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 9px; padding: 4px 10px 4px 6px; white-space: nowrap; font-size: 0.8rem; }
.rc.off { opacity: 0.38; }
.rc i { width: 4px; height: 20px; border-radius: 2px; display: block; }
.closed { margin: 0; font-size: 0.78rem; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.closed .p { background: var(--border); border-radius: 7px; padding: 1px 8px; }
.empty { margin: 0; }
.grid-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 6px; }
.grid-wrap.busy { opacity: 0.6; }
.wd, .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.wd div { text-align: center; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; color: var(--muted); padding: 4px 0; }
.cell { border: 0; border-radius: 9px; padding: 5px; background: var(--bg); color: inherit; font: inherit; text-align: left; min-height: 84px; min-width: 0; display: flex; flex-direction: column; gap: 3px; cursor: pointer; }
.cell.pad { background: transparent; cursor: default; }
.cell.past .rows { opacity: 0.52; }
.cell.today { box-shadow: inset 0 0 0 2px #67c1b9; }
.cell.sel { box-shadow: inset 0 0 0 2px #f98d68; }
.dn { font-size: 0.75rem; font-weight: 800; color: var(--muted); font-family: ui-monospace, monospace; display: flex; justify-content: space-between; }
.tb { font-size: 0.55rem; letter-spacing: 0.1em; color: #0e9384; }
.rows { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rw { display: flex; align-items: center; gap: 4px; border: 1px solid; border-radius: 8px; padding: 1px 4px 1px 6px; font-size: 0.66rem; font-weight: 700; line-height: 1.5; min-width: 0; }
.rw .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rw .t { font-size: 0.55rem; opacity: 0.6; font-family: ui-monospace, monospace; }
.rw .v { flex: none; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font: 800 0.66rem ui-monospace, monospace; color: #fff; background: #22c55e; }
.rw .v.full { background: #ef4444; }
.rw .v.ch { background: #8b5cf6; font-family: inherit; }
.rw.shut { background: var(--surface); border-color: var(--border); color: var(--muted); font-weight: 600; }
.drawer { position: fixed; top: var(--topbar); right: 0; bottom: 0; width: 380px; max-width: 92vw; overflow: auto; background: var(--surface); border-left: 1px solid var(--border); box-shadow: -14px 0 40px rgba(0, 0, 0, 0.1); padding: 14px 16px 24px; z-index: 20; }
.dw-hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.dw-hd h2 { margin: 0; font-size: 1rem; }
.dw-hd p { margin: 2px 0 10px; }
.tc { border: 1px solid; border-radius: 12px; padding: 10px 12px; margin-bottom: 9px; }
.tc .r1, .tc .r2 { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.tc .tm { font: 700 0.7rem ui-monospace, monospace; background: var(--bg); border-radius: 6px; padding: 1px 7px; }
.tc .pr { font-size: 0.7rem; font-weight: 700; }
.tc .rn { font-weight: 800; }
.tc .sv { font: 800 1.5rem ui-monospace, monospace; }
.tc .sv.f { font-size: 1rem; color: #b91c1c; font-family: inherit; }
.tc dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 8px 0 4px; font-size: 0.8rem; }
.tc dt { color: var(--muted); }
.tc dd { margin: 0; font-family: ui-monospace, monospace; }
.boats { margin: 0; padding-left: 18px; font-size: 0.8rem; }
.chb { margin-left: 6px; background: #8b5cf6; color: #fff; border-radius: 6px; padding: 0 6px; font-size: 0.68rem; }
.foot { font-size: 0.75rem; }
@media (max-width: 720px) {
  .cell { min-height: 56px; }
  .rw .n { display: none; }
  .stats { margin-left: 0; }
}
</style>
