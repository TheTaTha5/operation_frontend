<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { localYmd, thaiLongDate } from '@/lib/date';
import { ob, type ObAvailabilityDay, type ObBoat, type ObRoute } from '@/lib/ob';

import { chipSkin, dk, rgba, vivid } from './color';
import { buildMonth, MONTHS, monthRange, PIER_LABEL, PIER_NAME, PIERS, pierOf, type Chip, type Pier, WEEKDAYS } from './model';

const route = useRoute();
const router = useRouter();

// Month, pier, hidden routes and the selected day live in the URL, like Travel Summary's filters.
const today = localYmd();
const ym = computed(() => {
  const m = typeof route.query.month === 'string' ? /^(\d{4})-(\d{2})$/.exec(route.query.month) : null;
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 };
});
const monthKey = computed(() => `${ym.value.year}-${String(ym.value.month + 1).padStart(2, '0')}`);
const pier = computed<Pier | ''>(() => ((PIERS as readonly string[]).includes(String(route.query.pier)) ? (route.query.pier as Pier) : ''));
const hidden = computed(() => new Set(typeof route.query.hide === 'string' && route.query.hide ? route.query.hide.split(',') : []));
/** Legacy always has a selected day: today in the current month, otherwise the 1st. */
const selected = computed(() => {
  const q = typeof route.query.day === 'string' ? route.query.day : '';
  if (q.startsWith(monthKey.value)) return q;
  return today.startsWith(monthKey.value) ? today : `${monthKey.value}-01`;
});

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
const goToday = () => setQuery({ month: undefined, day: undefined });
const pickPier = (p: Pier | '') => setQuery({ pier: p === pier.value ? undefined : p || undefined });
function toggleRoute(id: string) {
  const s = new Set(hidden.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  setQuery({ hide: [...s].join(',') || undefined });
}
const pickDay = (d: string) => setQuery({ day: d === today ? undefined : d });
const drawer = ref(false);

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
const dayFree = computed(() => (dayCell.value?.chips || []).reduce((sum, c) => sum + c.free, 0));
const routeById = computed(() => new Map(routes.value.map((r) => [r.id, r])));
const dep = (routeId: string) => (routeById.value.get(routeId)?.times?.[0] || '').trim();
const pierName = (routeId: string) => PIER_NAME[pierOf(routeById.value.get(routeId))];

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const selDate = computed(() => new Date(`${selected.value}T12:00:00`));

/** Route-strip pill: the route's own colour as CSS variables the skin layer reads (legacy §calRcCol). */
function rcVars(color: string) {
  const v = vivid(color);
  return { '--rc-v': v, '--rc-bg': rgba(v, 0.34), '--rc-bd': rgba(v, 0.7), '--rc-gl': rgba(v, 0.34) };
}
/** Side-panel trip card, tint style (legacy §calChip2). */
function cardSkin(c: Chip) {
  const v = vivid(c.color);
  return {
    card: { background: rgba(v, 0.16), borderColor: rgba(v, 0.42) },
    tm: { background: rgba(v, 0.24), color: dk(v, 0.34) },
    fg: dk(v, 0.34),
    name: dk(v, 0.36),
    sv: c.full ? '#B91C1C' : dk(v, 0.28),
  };
}
function chipTitle(c: Chip) {
  return `${c.name} · ${c.free} of ${c.cap} seats free · ${c.pctSold}% sold` + (c.boats.length > 1 ? ` · ${c.boats.length} boats` : '')
    + (c.boats.some((b) => b.chartered) ? ' · charter' : '');
}
/** Legacy 5-tier occupancy colour: the fuller, the greener. */
const tier = (p: number) => (p >= 80 ? '#1F4D2C' : p >= 60 ? '#3B6D11' : p >= 40 ? '#8A6A0B' : p >= 20 ? '#B4600F' : '#A32D2D');
</script>

<template>
  <section class="calw">
    <div class="cal2-page">
      <div class="cal2-tbar">
        <div class="tb-l">
          <button type="button" class="rb" aria-label="Previous month" @click="shiftMonth(-1)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button type="button" class="rb" aria-label="Next month" @click="shiftMonth(1)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <span class="tb-mo">{{ MONTHS[ym.month] }} {{ ym.year }}</span>
          <div class="grp" role="group" aria-label="Pier">
            <button type="button" :class="{ on: !pier }" @click="pickPier('')">All</button>
            <button v-for="p in PIERS" :key="p" type="button" :class="{ on: pier === p }" @click="pickPier(p)">{{ PIER_NAME[p] }}</button>
          </div>
        </div>
        <button type="button" class="pill" @click="goToday">This month</button>
      </div>

      <p v-if="error === 'signed-out'" class="msg">Your session has ended. <RouterLink to="/login?next=/calendar">Sign in</RouterLink></p>
      <p v-else-if="error" class="msg err">Could not load availability: {{ error }} <button type="button" class="linklike" @click="load">Retry</button></p>

      <template v-if="view">
        <div v-if="view.routes.length" class="cal2-routes">
          <button v-for="r in view.routes" :key="r.id" type="button" class="cal2-rc" :class="{ off: hidden.has(r.id) }"
                  :style="rcVars(r.color)" :title="(hidden.has(r.id) ? 'Show ' : 'Hide ') + r.name" @click="toggleRoute(r.id)">
            <i :style="{ background: r.color }" />
            <span class="rc-t">
              <span class="n">{{ r.name }}</span>
              <span class="s">{{ PIER_LABEL[r.pier] }} · {{ r.trips }} day{{ r.trips > 1 ? 's' : '' }}{{ dep(r.id) ? ' · ' + dep(r.id) : '' }}</span>
            </span>
            <span class="rc-f">
              <span class="v">{{ Math.round(r.free / r.trips) }}</span>
              <span class="s">free/day</span>
            </span>
          </button>
        </div>
        <div v-if="view.closedAllMonth.length" class="cal2-sb">
          Closed all month
          <span v-for="p in view.closedAllMonth" :key="p" class="p"><i />{{ PIER_NAME[p] }}</span>
        </div>

        <div class="cal2-box" :class="{ busy: loading }">
          <div class="calx-side">
            <div class="calx-sh">
              <span class="t">Selected date</span>
              <button type="button" class="calx-now" @click="goToday">Today</button>
            </div>
            <div class="calx-day">{{ selDate.getDate() }}</div>
            <div class="calx-dn2">{{ DOW[selDate.getDay()] }}</div>
            <div class="calx-meta">
              {{ selDate.getDate() }} {{ MONTHS[ym.month] }} {{ ym.year }}<br>
              <b>{{ dayCell?.chips.length || 0 }} boat trip{{ dayCell?.chips.length === 1 ? '' : 's' }}</b> · <b>{{ dayFree }}</b> seats free
            </div>
            <hr class="calx-hr">
            <div class="calx-lhd"><span class="t">Boat schedules &amp; seats</span></div>
            <div class="calx-list">
              <template v-if="dayCell?.chips.length">
                <div v-for="ch in dayCell.chips" :key="ch.routeId" class="calx-tc" :style="cardSkin(ch).card" :title="chipTitle(ch)" @click="drawer = true">
                  <div class="r1">
                    <span class="tm" :style="cardSkin(ch).tm">{{ dep(ch.routeId) || '--:--' }}</span>
                    <span class="pr" :style="{ color: cardSkin(ch).fg }">{{ pierName(ch.routeId) }}{{ ch.boats.length > 1 ? ' · ' + ch.boats.length + ' boats' : '' }}</span>
                  </div>
                  <div class="r2">
                    <span class="rn" :style="{ color: cardSkin(ch).name }">{{ ch.name }}</span>
                    <span class="sv" :class="{ f: ch.full }" :style="{ color: cardSkin(ch).sv }">{{ ch.full ? (ch.charterOnly ? 'CHARTER' : 'FULL') : ch.free }}</span>
                  </div>
                </div>
              </template>
              <div v-else class="calx-empty">No trips scheduled on this day</div>
            </div>
            <div class="calx-foot">
              Closed piers today · <b>{{ dayCell?.shut.length ? dayCell.shut.map((p) => PIER_LABEL[p]).join(' · ') : 'None' }}</b><br>
              Click a day in the calendar to change the date
              <button type="button" class="calx-more" @click="drawer = true">Boat-level detail &rarr;</button>
            </div>
          </div>

          <div class="calx-pane">
            <div class="cal2-mb">
              <div class="mo">{{ MONTHS[ym.month] }} {{ ym.year }}</div>
              <div class="st">
                <span>Trips <b>{{ view.stats.trips }}</b></span>
                <span>Seats free <b>{{ view.stats.free.toLocaleString('en-US') }}</b></span>
                <span class="g">Sold <b>{{ view.stats.pctSold }}%</b></span>
              </div>
            </div>
            <div class="cal2-wd"><div v-for="w in WEEKDAYS" :key="w">{{ w }}</div></div>
            <div class="cal2-grid">
              <div v-for="i in view.pad" :key="'pad' + i" class="cal2-cell pad" />
              <div v-for="c in view.cells" :key="c.date" class="cal2-cell" role="button" tabindex="0"
                   :class="{ today: c.today, past: c.past, sel: c.date === selected }"
                   @click="pickDay(c.date)" @keydown.enter="pickDay(c.date)">
                <div class="cal2-ch">
                  <span class="cal2-dn">{{ c.day }}</span>
                  <span v-if="c.today" class="cal2-tb">TODAY</span>
                </div>
                <div class="cal2-rows">
                  <div v-for="ch in c.chips" :key="ch.routeId" class="cal2-rw" :style="chipSkin(ch.color)" :title="chipTitle(ch)">
                    <span class="cal2-n">{{ ch.name }}</span>
                    <span v-if="ch.boats.length > 1" class="cal2-t">{{ ch.boats.length }}b</span>
                    <span class="cal2-v" :class="{ full: ch.full && !ch.charterOnly, ch: ch.charterOnly }">{{ ch.charterOnly ? 'CH' : ch.free }}</span>
                  </div>
                  <div v-for="p in c.shut" :key="p" class="cal2-rw cal2-shut"><span class="cal2-n">Closed · {{ PIER_LABEL[p] }}</span></div>
                </div>
              </div>
            </div>
            <div class="cal2-lg">
              <span>Chip colour = route</span>
              <span class="k">Seats free <span class="cal2-v">13</span></span>
              <span class="k">Sold out <span class="cal2-v full">0</span></span>
              <span>Sorted by departure time</span>
              <span class="r">Click a day to select it</span>
            </div>
          </div>
        </div>
        <p v-if="!view.routes.length && !loading" class="msg">
          No boats are deployed this month in operation-backend. Days fill in once Boat Ops deployments are there.
        </p>
      </template>
      <p v-else-if="loading" class="msg">Loading…</p>

      <p class="foot">
        Data from operation-backend. Not shown yet: boats down for repair, weather closures and land routes
        (see <code>apps/web/BACKEND_NEEDS.md</code>).
      </p>
    </div>

    <div class="cal2-scrim" :class="{ on: drawer }" @click="drawer = false" />
    <aside class="cal2-dw" :class="{ on: drawer }" aria-label="Day detail">
      <button type="button" class="cal2-x" aria-label="Close" @click="drawer = false">×</button>
      <div class="cal2-dwb">
        <h2>{{ thaiLongDate(selected) }}</h2>
        <p class="dw-sub">{{ dayCell?.chips.length || 0 }} routes running</p>
        <p v-if="!dayCell?.chips.length" class="dw-sub">No boats deployed on this day.</p>
        <div v-for="ch in dayCell?.chips || []" :key="ch.routeId" class="calx-tc dw" :style="cardSkin(ch).card">
          <div class="r1">
            <span class="tm" :style="cardSkin(ch).tm">{{ dep(ch.routeId) || '--:--' }}</span>
            <span class="pr" :style="{ color: tier(ch.pctSold) }">{{ ch.pctSold }}% sold</span>
          </div>
          <div class="r2">
            <span class="rn" :style="{ color: cardSkin(ch).name }">{{ ch.name }}</span>
            <span class="sv" :class="{ f: ch.full }" :style="{ color: cardSkin(ch).sv }">{{ ch.full ? (ch.charterOnly ? 'CHARTER' : 'FULL') : ch.free }}</span>
          </div>
          <dl>
            <dt>Seats</dt><dd>{{ ch.cap }}</dd>
            <dt>Booked</dt><dd>{{ ch.day.booked_pax }}</dd>
            <template v-if="ch.day.charter_pax"><dt>Charter pax</dt><dd>{{ ch.day.charter_pax }}</dd></template>
            <template v-if="ch.day.locked_pax"><dt>Locked</dt><dd>{{ ch.day.locked_pax }}</dd></template>
          </dl>
          <ul class="boats">
            <li v-for="b in ch.boats" :key="b.id">{{ b.name }} · {{ b.capacity }} seats<span v-if="b.chartered" class="chb">Charter</span></li>
          </ul>
        </div>
      </div>
    </aside>
  </section>
</template>

<style scoped>
/* Ported from the legacy calendar (renderCal's CAL2CSS in allotment_v2/js/04-data-core.js, including
   the §calDash navy layer). Class names are kept so the two can be compared rule by rule. */
.calw {
  --mono: 'DM Mono', ui-monospace, monospace;
  position: relative; isolation: isolate; background: #16265C; border-radius: 16px; padding: 14px 18px 18px;
  font-family: 'IBM Plex Sans Thai', system-ui, sans-serif; color: #1A1A1A;
  min-height: calc(100dvh - var(--topbar, 52px) - 32px);
}
/* Blurred route-colour glow behind everything (§calDash). */
.calw::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
  background:
    radial-gradient(58% 44% at 12% 8%, rgba(255, 153, 153, 0.42), transparent 62%),
    radial-gradient(46% 40% at 88% 4%, rgba(186, 117, 23, 0.34), transparent 62%),
    radial-gradient(52% 46% at 78% 92%, rgba(15, 110, 86, 0.38), transparent 64%),
    radial-gradient(50% 42% at 24% 96%, rgba(24, 95, 165, 0.42), transparent 62%);
  filter: blur(20px) saturate(120%);
}
.cal2-page { display: flex; flex-direction: column; gap: 9px; height: calc(100dvh - var(--topbar, 52px) - 64px); min-height: 540px; }

/* Toolbar · glass over navy */
.cal2-tbar {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
  border-radius: 14px; padding: 7px 11px;
  background: linear-gradient(160deg, rgba(22, 38, 92, 0.82), rgba(12, 24, 62, 0.74));
  backdrop-filter: blur(22px) saturate(180%);
  box-shadow: 0 8px 26px rgba(2, 10, 30, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.18);
  color: #D6E2F5;
}
.tb-l { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cal2-tbar button { font: inherit; cursor: pointer; color: #D6E2F5; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.22); }
.cal2-tbar button:hover { background: rgba(255, 255, 255, 0.2); }
.rb { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0; }
.tb-mo { font-size: 15px; font-weight: 600; margin: 0 8px; }
.grp { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 18px; padding: 2px; }
.grp button { border: none; background: transparent; border-radius: 14px; padding: 4px 12px; font-size: 11px; font-weight: 500; }
.grp button.on, .grp button.on:hover { background: #fff; color: #16265C; font-weight: 600; box-shadow: 0 2px 10px rgba(2, 10, 30, 0.3); }
.pill { border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 600; }

.msg { margin: 0; background: #fff; border-radius: 12px; padding: 10px 14px; font-size: 13px; }
.msg.err { color: #c0392b; }
.foot { margin: 0; flex: none; font-size: 10.5px; color: #A8BAD8; }
.foot code { color: #D6E2F5; }

/* Route strip · glass pills in the route's own colour; also the filter */
.cal2-routes {
  flex: none; display: flex; align-items: stretch; gap: 6px; overflow-x: auto; padding-bottom: 2px;
  scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.26) transparent;
}
.cal2-rc {
  display: flex; align-items: center; gap: 8px; border-radius: 14px; padding: 5px 10px 5px 7px; cursor: pointer; white-space: nowrap; flex: none;
  font: inherit; text-align: left; color: #EDF3FF;
  background: var(--rc-bg, rgba(255, 255, 255, 0.18)); border: 1px solid var(--rc-bd, rgba(255, 255, 255, 0.34));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 14px var(--rc-gl, rgba(2, 10, 30, 0.28));
  transition: opacity 0.15s, filter 0.15s;
}
.cal2-rc:hover { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.26), 0 3px 18px var(--rc-gl, rgba(2, 10, 30, 0.3)); }
.cal2-rc i { width: 5px; height: 22px; border-radius: 2px; flex: none; display: block; background: var(--rc-v, currentColor) !important; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3); }
.rc-t, .rc-f { display: flex; flex-direction: column; }
.rc-t .n { font-size: 11.5px; font-weight: 600; line-height: 1.25; color: #fff; }
.rc-t .s, .rc-f .s { font-size: 9.5px; line-height: 1.25; }
.rc-f { margin-left: 6px; text-align: right; }
.rc-f .v { font: 700 15px var(--mono); line-height: 1; color: #fff; }
.rc-f .s { font-size: 9px; margin-top: 2px; }
/* Switched off by hand: drop the colour, dash the border, strike the name — unmistakable at a glance */
.cal2-rc.off { opacity: 0.34; filter: grayscale(1); background: transparent; border-style: dashed; border-color: rgba(255, 255, 255, 0.34); box-shadow: none; }
.cal2-rc.off .n { text-decoration: line-through; }
.cal2-rc.off:hover { opacity: 0.6; filter: none; }

.cal2-sb { flex: none; display: flex; align-items: center; gap: 8px; font-size: 10.5px; color: #A8BAD8; padding: 0 3px; flex-wrap: wrap; }
.cal2-sb .p { display: inline-flex; align-items: center; gap: 5px; background: rgba(255, 255, 255, 0.1); color: #D6E2F5; border-radius: 8px; padding: 2px 9px; }
.cal2-sb .p i { width: 3px; height: 11px; border-radius: 2px; background: #c9c5ba; display: inline-block; }

/* The white card: selected-day panel on the left, month grid on the right */
.cal2-box {
  flex: 1; min-height: 0; display: flex; background: #fff; border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14); box-shadow: 0 14px 40px rgba(2, 10, 30, 0.34);
}
.cal2-box.busy { opacity: 0.7; }
.calx-side { width: 344px; flex: 0 0 auto; padding: 18px 20px; border-right: 1px solid #F1F5F9; display: flex; flex-direction: column; min-height: 0; }
.calx-pane { flex: 1; min-width: 0; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.calx-sh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; flex: none; }
.calx-sh .t, .calx-lhd .t { font-size: 10.5px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: #94A3B8; }
.calx-now { border: none; background: #F1F5F9; color: #475569; border-radius: 999px; padding: 5px 13px; font: 700 11px inherit; cursor: pointer; }
.calx-now:hover { background: #E2E8F0; }
.calx-day { font-size: 60px; font-weight: 800; color: #1E293B; letter-spacing: -0.045em; line-height: 0.92; flex: none; }
.calx-dn2 { font-family: 'Quicksand', 'DM Sans', sans-serif; font-weight: 600; font-size: 30px; letter-spacing: -0.01em; color: #334155; margin-top: 5px; line-height: 1.15; flex: none; }
.calx-meta { font-size: 10.5px; font-weight: 700; color: #94A3B8; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 8px; line-height: 1.7; flex: none; }
.calx-meta b { color: #475569; }
.calx-hr { border: 0; border-top: 1px solid #F1F5F9; margin: 15px 0; flex: none; }
.calx-lhd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex: none; }
.calx-list { display: flex; flex-direction: column; gap: 9px; overflow: auto; min-height: 0; flex: 1; padding-right: 3px; }
.calx-list::-webkit-scrollbar { width: 4px; }
.calx-list::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
.calx-tc { padding: 12px 14px 13px; border: 1px solid; border-radius: 16px; cursor: pointer; transition: box-shadow 0.14s; flex: none; }
.calx-tc:hover { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.09); }
.calx-tc .r1 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.calx-tc .tm { font: 700 10.5px var(--mono); border-radius: 6px; padding: 2px 8px; }
.calx-tc .pr { font-size: 10px; font-weight: 700; letter-spacing: 0.03em; opacity: 0.8; }
.calx-tc .r2 { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.calx-tc .rn { font-size: 16.5px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.25; min-width: 0; }
.calx-tc .sv { font: 800 30px var(--mono); letter-spacing: -0.04em; line-height: 1; flex: 0 0 auto; }
.calx-tc .sv.f { font-size: 17px; font-weight: 800; letter-spacing: 0.02em; font-family: inherit; }
.calx-empty { padding: 24px 14px; text-align: center; border: 1px dashed #E2E8F0; border-radius: 16px; color: #94A3B8; font-size: 12px; }
.calx-foot { flex: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #F1F5F9; font-size: 10.5px; color: #94A3B8; line-height: 1.7; }
.calx-foot b { color: #475569; }
.calx-more { display: block; border: 1px solid #E2E8F0; background: #fff; border-radius: 10px; padding: 6px 12px; font: 700 11px inherit; color: #475569; cursor: pointer; margin-top: 8px; }
.calx-more:hover { background: #F8FAFC; color: #0F172A; }

/* Month header · name and summary pills */
.cal2-mb { flex: none; padding: 0 2px 4px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cal2-mb .mo { font-size: 19px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; }
.cal2-mb .st { display: flex; gap: 6px; flex-wrap: wrap; }
.cal2-mb .st span { border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 999px; padding: 4px 12px; font-size: 10.5px; font-weight: 600; color: #475569; }
.cal2-mb .st span b { font-family: var(--mono); font-weight: 700; color: #0F172A; margin-left: 4px; }
.cal2-mb .st span.g { background: #ECFDF5; border-color: #BFE0CD; color: #047857; }
.cal2-mb .st span.g b { color: #047857; }

.cal2-wd { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; flex: none; }
.cal2-wd div { text-align: center; font-size: 10.5px; font-weight: 800; letter-spacing: 0.13em; color: #94A3B8; padding: 4px 0; }
/* Each week is as tall as its busiest day, and spare height is shared out evenly (§cal2b) */
.cal2-grid {
  flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(min-content, 1fr); gap: 4px; background: rgba(241, 245, 249, 0.75);
  border: 1px solid #F1F5F9; border-radius: 16px; padding: 4px;
}
.cal2-cell { border-radius: 12px; padding: 6px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; min-width: 0; min-height: 0; overflow: hidden; background: #fff; transition: box-shadow 0.14s; outline: none; }
.cal2-cell:hover, .cal2-cell:focus-visible { box-shadow: 0 2px 10px rgba(15, 23, 42, 0.09); }
.cal2-cell.pad { background: #FCFCFD; opacity: 0.45; cursor: default; }
.cal2-cell.pad:hover { box-shadow: none; }
.cal2-cell.past { background: #FCFCFD; }
.cal2-cell.past .cal2-rows { opacity: 0.52; }
.cal2-cell.past:hover .cal2-rows { opacity: 1; }
.cal2-cell.today { box-shadow: inset 0 0 0 2px #67C1B9; }
.cal2-cell.sel, .cal2-cell.today.sel { box-shadow: inset 0 0 0 2px #F98D68; }
.cal2-ch { display: flex; align-items: center; justify-content: space-between; gap: 5px; flex: none; min-height: 22px; }
.cal2-dn { font-size: 12px; font-weight: 800; color: #64748B; padding-left: 3px; font-family: var(--mono); }
.cal2-cell.sel .cal2-dn {
  display: inline-flex; align-items: center; justify-content: center; width: 23px; height: 23px; padding: 0;
  border-radius: 999px; background: #F98D68; color: #fff; font-size: 11.5px; box-shadow: 0 4px 12px rgba(249, 141, 104, 0.35);
}
.cal2-tb { font-size: 8.5px; font-weight: 800; letter-spacing: 0.1em; color: #0E9384; }
.cal2-rows { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
/* Chip in a day cell · route name + free-seat bubble */
.cal2-rw { display: flex; align-items: center; justify-content: space-between; gap: 5px; border: 1px solid; border-radius: 9px; padding: 2px 6px 2px 7px; flex: none; overflow: hidden; font-size: 10.5px; font-weight: 700; line-height: 1.55; }
.cal2-n { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.005em; }
.cal2-t { font-size: 8.5px; opacity: 0.6; flex: none; font-weight: 600; font-family: var(--mono); }
.cal2-v {
  flex: 0 0 auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  font: 800 10.5px var(--mono); color: #fff; letter-spacing: -0.01em; background: #22C55E;
}
.cal2-v.full { background: #EF4444; }
.cal2-v.ch { background: #8B5CF6; font-family: inherit; font-size: 9px; padding: 0 8px; }
.cal2-shut { background: #F1F5F9; border-color: #E2E8F0; color: #94A3B8; }
.cal2-shut .cal2-n { color: #94A3B8; font-weight: 600; }
.cal2-lg { flex: none; display: flex; align-items: center; gap: 13px; font-size: 10px; color: #666; padding: 0 2px; flex-wrap: wrap; }
.cal2-lg .k { display: inline-flex; align-items: center; gap: 6px; }
.cal2-lg .r { margin-left: auto; color: #a5a29a; }

/* Day-detail drawer · slides in from the right over a scrim */
.cal2-scrim { position: fixed; inset: 0; background: rgba(30, 30, 26, 0.22); opacity: 0; pointer-events: none; transition: opacity 0.18s; z-index: 320; }
.cal2-scrim.on { opacity: 1; pointer-events: auto; }
.cal2-dw {
  position: fixed; top: 0; right: 0; bottom: 0; width: 400px; max-width: 92vw; background: #fff; border-left: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: -14px 0 40px rgba(0, 0, 0, 0.1); transform: translateX(101%); transition: transform 0.2s cubic-bezier(0.3, 0.8, 0.4, 1);
  display: flex; flex-direction: column; z-index: 321; color: #1A1A1A;
}
.cal2-dw.on { transform: none; }
.cal2-dwb { flex: 1; overflow: auto; padding: 14px 16px 24px; }
.cal2-dwb h2 { margin: 4px 40px 0 0; font-size: 17px; font-weight: 800; color: #0F172A; }
.dw-sub { margin: 2px 0 12px; font-size: 11px; color: #94A3B8; }
.cal2-x { position: absolute; top: 13px; right: 14px; width: 27px; height: 27px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.09); background: #fff; cursor: pointer; color: #666; font-size: 15px; line-height: 1; z-index: 2; }
.calx-tc.dw { cursor: default; margin-bottom: 9px; }
.calx-tc dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 8px 0 4px; font-size: 12px; }
.calx-tc dt { color: #64748B; }
.calx-tc dd { margin: 0; font-family: var(--mono); }
.boats { margin: 0; padding-left: 18px; font-size: 12px; }
.chb { margin-left: 6px; background: #8B5CF6; color: #fff; border-radius: 6px; padding: 0 6px; font-size: 10px; }

@media (max-width: 1180px) {
  .cal2-page { height: auto; }
  .cal2-box { flex-direction: column; }
  .calx-side { width: auto; border-right: 0; border-bottom: 1px solid #F1F5F9; }
  .calx-list { max-height: 320px; }
  .cal2-grid { overflow: visible; }
}
@media (max-width: 700px) {
  .calw { padding-left: 10px; padding-right: 10px; }
  .cal2-cell { min-height: 56px; }
  .cal2-n { display: none; }
}
</style>
