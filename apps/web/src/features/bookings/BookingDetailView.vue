<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { ob, type ObBoat, type ObBooking, type ObRoute } from '@/lib/ob';

import { displayCode, fmtDate, fmtDateLong, isB2C, paxBreak, paxSplit, statusLabel, thb } from './model';

// Read-only detail, laid out like the legacy one (bkV2RenderBookingDetail): ticket, agent, trips,
// guests, pickup, extras, payment. Edit / reschedule / cancel stay in the legacy app for now.
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id || ''));

const bk = ref<ObBooking | null>(null);
const routes = ref<ObRoute[]>([]);
const boats = ref<ObBoat[]>([]);
const loading = ref(false);
const error = ref('');
let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true; error.value = '';
  try {
    const [b, rs, bs] = await Promise.all([ob.booking(id.value), routes.value.length ? routes.value : ob.routes(),
      boats.value.length ? boats.value : ob.boats()]);
    if (my !== seq) return;
    bk.value = b; routes.value = rs; boats.value = bs;
  } catch (e) {
    if (my !== seq) return;
    bk.value = null;
    error.value = e instanceof ApiError ? (e.status === 401 ? 'signed-out' : e.status === 404 ? 'not-found' : e.message) : String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
watch(id, load, { immediate: true });

const routeOf = (rid: string) => routes.value.find((r) => r.id === rid);
const boatName = (bid?: string) => (bid ? boats.value.find((b) => b.id === bid)?.name || bid : '');
const pax = computed(() => (bk.value ? paxSplit(bk.value) : null));
const first = computed(() => bk.value?.trips[0]);
const leadDays = computed(() => {
  const b = bk.value; if (!b || !first.value) return null;
  const booked = (b.booked_at || b.created_at || '').slice(0, 10);
  const d = Math.round((new Date(first.value.service_date + 'T00:00').getTime() - new Date(booked + 'T00:00').getTime()) / 86400000);
  return isNaN(d) ? null : d;
});
const guides = computed(() => {
  const b = bk.value; if (!b) return '';
  return [b.guide_english && 'English', b.guide_russian && 'Russian', b.guide_chinese && 'Chinese', b.guide_other_lang].filter(Boolean).join(', ');
});
const meals = computed(() => {
  const b = bk.value; if (!b) return '';
  return [b.special_meals_veg && `Vegetarian ${b.special_meals_veg}`, b.special_meals_vegan && `Vegan ${b.special_meals_vegan}`,
    b.special_meals_halal && `Halal ${b.special_meals_halal}`].filter(Boolean).join(' · ');
});
/** A trip's grid as "Adult 2 (FR 1 · TH 1)" lines, skipping empty categories. */
function gridLines(grid: Record<string, number>) {
  const CAT: Record<string, string> = { ad: 'Adult', chd: 'Child', inf: 'Infant', foc: 'FOC' };
  return Object.keys(CAT).map((c) => {
    const bare = grid[c] || 0, fr = grid[`${c}_fr`] || 0, th = grid[`${c}_th`] || 0, n = bare + fr + th;
    if (!n) return '';
    const tiers = [fr && `FR ${fr}`, th && `TH ${th}`].filter(Boolean).join(' · ');
    return `${CAT[c]} ${n}` + (tiers ? ` (${tiers})` : '');
  }).filter(Boolean);
}
const priceRows = computed(() => {
  const b = bk.value; if (!b) return [];
  return ([
    ['Seats', b.price_seat], ['Add-ons', b.price_addon], ['Extra', b.price_extra],
    ['FOC discount', b.price_foc_discount && -Math.abs(b.price_foc_discount)], ['Discount', b.price_discount && -Math.abs(b.price_discount)],
  ] as [string, number | undefined][]).filter(([, v]) => v);
});
</script>

<template>
  <section class="bd">
    <div class="top">
      <button type="button" class="back" @click="router.back()">‹ Back to list</button>
      <template v-if="bk">
        <h1>{{ displayCode(bk) }}</h1>
        <span class="chip" :class="bk.status"><span class="dot" />{{ statusLabel(bk.status) }}</span>
        <span v-if="pax?.foc" class="foc">FOC {{ pax.foc }}</span>
        <span v-if="isB2C(bk)" class="b2c">B2C</span>
      </template>
    </div>

    <p v-if="error === 'signed-out'" class="card">Your session has ended. <RouterLink :to="`/login?next=${encodeURIComponent(route.fullPath)}`">Sign in</RouterLink></p>
    <p v-else-if="error === 'not-found'" class="card">The booking <code>{{ id }}</code> was not found.</p>
    <p v-else-if="error" class="card err">Could not load the booking: {{ error }} <button type="button" class="linklike" @click="load">Retry</button></p>
    <p v-else-if="loading && !bk" class="muted">Loading…</p>

    <template v-if="bk">
      <!-- Ticket: the first trip, like the legacy boarding-pass hero -->
      <div class="ticket" :style="{ borderLeftColor: routeOf(bk.route_id)?.color || 'var(--accent)' }">
        <div>
          <div class="t-lab">Trip</div>
          <div class="t-main">{{ routeOf(bk.route_id)?.name || bk.route_id }}</div>
          <div class="muted">{{ bk.trips.length > 1 ? `+ ${bk.trips.length - 1} more trip${bk.trips.length > 2 ? 's' : ''}` : bk.booking_mode === 'charter' ? 'Charter' : 'Seat booking' }}</div>
        </div>
        <div>
          <div class="t-lab">Travel</div>
          <div class="t-main">{{ fmtDateLong(bk.service_date) }}</div>
          <div class="muted">{{ routeOf(bk.route_id)?.times?.[0] ? `Departs ${routeOf(bk.route_id)!.times![0]}` : '' }}</div>
        </div>
        <div>
          <div class="t-lab">Pax</div>
          <div class="t-main">{{ pax?.total }}</div>
          <div class="muted">{{ pax && paxBreak(pax) }}</div>
        </div>
        <div>
          <div class="t-lab">Total</div>
          <div class="t-main">{{ thb(bk.total) }}</div>
          <div class="muted">{{ bk.price_mode === 'manual' ? 'Manual price' : '' }}</div>
        </div>
      </div>

      <p v-if="bk.cancellation_reason" class="banner">Cancelled: {{ bk.cancellation_reason }}</p>

      <div class="cols">
        <div class="main">
          <div class="card">
            <h2>Agent</h2>
            <dl>
              <dt>Agent</dt><dd>{{ isB2C(bk) ? 'B2C' : bk.agent_id || '—' }} <span class="muted">(name not in operation-backend yet)</span></dd>
              <dt>Rate type</dt><dd>{{ bk.rate_type_ref || '—' }}</dd>
              <dt>Voucher</dt><dd>{{ bk.voucher_ref || '—' }}</dd>
              <dt>Booked</dt><dd>{{ fmtDateLong(bk.booked_at || bk.created_at) }}<span v-if="leadDays !== null" class="muted"> · {{ leadDays }} day{{ leadDays === 1 ? '' : 's' }} lead time</span></dd>
              <template v-if="bk.market"><dt>Market</dt><dd>{{ bk.market }}{{ bk.market_sub ? ` / ${bk.market_sub}` : '' }}</dd></template>
              <template v-if="bk.sold_by"><dt>Sold by</dt><dd>{{ bk.sold_by }}</dd></template>
            </dl>
          </div>

          <div class="card">
            <h2>Trips</h2>
            <div v-for="t in bk.trips" :key="t.id" class="trip">
              <i :style="{ background: routeOf(t.route_id)?.color || '#8b909c' }" />
              <div class="grow">
                <div class="strong">{{ routeOf(t.route_id)?.name || t.route_id }}</div>
                <div class="muted">{{ fmtDateLong(t.service_date) }} · {{ t.booking_mode === 'charter' ? 'Charter' + (t.charter_boat_id ? ` · ${boatName(t.charter_boat_id)}` : '') : 'Seat' }}</div>
              </div>
              <div class="grid-lines">
                <div v-for="l in gridLines(t.pax)" :key="l">{{ l }}</div>
                <div class="strong">{{ t.pax_total }} pax</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>Guests</h2>
            <dl>
              <dt>Lead</dt><dd>{{ bk.lead_pax || '—' }}<span v-if="bk.lead_nationality" class="muted"> · {{ bk.lead_nationality }}</span></dd>
              <dt>Phone</dt><dd>{{ bk.lead_phone || '—' }}</dd>
              <template v-if="bk.lead_email"><dt>Email</dt><dd>{{ bk.lead_email }}</dd></template>
              <template v-if="guides"><dt>Guide</dt><dd>{{ guides }}</dd></template>
            </dl>
            <ol v-if="bk.passengers.length" class="pass">
              <li v-for="p in bk.passengers" :key="p.seq">{{ p.name }}<span class="muted">{{ [p.nationality, p.type, p.foc ? 'FOC' : ''].filter(Boolean).join(' · ') ? ' · ' + [p.nationality, p.type, p.foc ? 'FOC' : ''].filter(Boolean).join(' · ') : '' }}</span></li>
            </ol>
          </div>

          <div class="card">
            <h2>Pickup</h2>
            <dl>
              <dt>Pickup</dt><dd>{{ bk.pickup_self ? 'Self transfer to pier' : [bk.hotel_name, bk.pickup_area, bk.pickup_zone].filter(Boolean).join(' · ') || '—' }}</dd>
              <template v-if="bk.room_number"><dt>Room</dt><dd>{{ bk.room_number }}</dd></template>
              <dt>Drop-off</dt><dd>{{ bk.dropoff_same !== false ? 'Same as pickup' : [bk.dropoff_hotel_name, bk.dropoff_area].filter(Boolean).join(' · ') || '—' }}</dd>
            </dl>
          </div>

          <div v-if="meals || bk.special_meals_allergies || bk.large_luggage || bk.cash_on_tour_amount" class="card">
            <h2>Extras</h2>
            <dl>
              <template v-if="meals"><dt>Meals</dt><dd>{{ meals }}</dd></template>
              <template v-if="bk.special_meals_allergies"><dt>Allergies</dt><dd>{{ bk.special_meals_allergies }}</dd></template>
              <template v-if="bk.large_luggage"><dt>Large luggage</dt><dd>{{ bk.large_luggage }}</dd></template>
              <template v-if="bk.cash_on_tour_amount">
                <dt>Cash on tour</dt>
                <dd>{{ thb(bk.cash_on_tour_amount) }}{{ bk.cash_on_tour_currency && bk.cash_on_tour_currency !== 'THB' ? ' ' + bk.cash_on_tour_currency : '' }}
                  <span class="muted">· {{ bk.cash_on_tour_handling === 'separate' ? 'separate from the bill' : 'deducted from the bill' }}</span>
                  <div v-if="bk.cash_on_tour_note" class="muted">{{ bk.cash_on_tour_note }}</div></dd>
              </template>
            </dl>
          </div>
        </div>

        <aside class="side">
          <div class="card">
            <h2>Payment</h2>
            <dl>
              <dt>Method</dt><dd>{{ bk.payment_method || '—' }}{{ bk.payment_net_days ? ` · net ${bk.payment_net_days} days` : '' }}</dd>
              <template v-for="[label, v] in priceRows" :key="label"><dt>{{ label }}</dt><dd class="num">{{ thb(v) }}</dd></template>
              <dt class="strong">Total</dt><dd class="num strong">{{ thb(bk.total) }}</dd>
            </dl>
          </div>
          <div v-if="bk.notes || bk.note" class="card">
            <h2>Notes</h2>
            <p class="pre">{{ [bk.notes, bk.note].filter(Boolean).join('\n\n') }}</p>
          </div>
          <div class="card small muted">
            <div>Created {{ fmtDate(bk.created_at) }}{{ bk.created_by ? ` by ${bk.created_by}` : '' }}</div>
            <div v-if="bk.confirmed_at">Confirmed {{ fmtDate(bk.confirmed_at) }}{{ bk.confirmed_by ? ` by ${bk.confirmed_by}` : '' }}</div>
            <div>Updated {{ fmtDate(bk.updated_at) }}{{ bk.updated_by ? ` by ${bk.updated_by}` : '' }}</div>
            <div class="mono">{{ bk.id }}</div>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.bd { display: flex; flex-direction: column; gap: 12px; }
.top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.top h1 { margin: 0; font-size: 1.25rem; font-family: ui-monospace, monospace; }
.back { font: inherit; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 5px 11px; cursor: pointer; }
.err { color: #c0392b; }
.ticket { display: grid; grid-template-columns: 2fr 1.4fr 1fr 1fr; gap: 16px; background: var(--surface); border: 1px solid var(--border); border-left: 6px solid; border-radius: 12px; padding: 16px 18px; }
.t-lab { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.t-main { font-size: 1.1rem; font-weight: 800; margin: 2px 0; }
.banner { margin: 0; background: #fcebeb; color: #791f1f; border-radius: 8px; padding: 8px 12px; }
.cols { display: grid; grid-template-columns: 1fr 320px; gap: 12px; align-items: start; }
.main, .side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.card h2 { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
dl { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; margin: 0; font-size: 0.88rem; }
dt { color: var(--muted); }
dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.trip { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: 1px solid var(--border); }
.trip:first-of-type { border-top: 0; padding-top: 0; }
.trip i { width: 4px; align-self: stretch; border-radius: 2px; flex: none; }
.grow { flex: 1; min-width: 0; }
.grid-lines { text-align: right; font-size: 0.8rem; }
.pass { margin: 10px 0 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.7; }
.strong { font-weight: 700; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.pre { white-space: pre-wrap; margin: 0; font-size: 0.88rem; }
.small { font-size: 0.75rem; line-height: 1.7; }
.mono { font-family: ui-monospace, monospace; }
.chip { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 2px 9px; font-size: 0.75rem; font-weight: 600; background: #f1efe8; color: #6b6862; }
.chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.chip.confirmed { background: #e1f5ee; color: #0f6e56; }
.chip.pending_foc, .chip.pending_approval, .chip.pending { background: #faeeda; color: #633806; }
.chip.rejected { background: #fcebeb; color: #791f1f; }
.chip.cancelled, .chip.cancelled_weather { color: #888780; }
.chip.completed { background: #e6eef8; color: #185fa5; }
.foc { font-size: 0.72rem; font-weight: 700; color: #ba7517; }
.b2c { background: #ede9fe; color: #5b21b6; border-radius: 5px; padding: 0 6px; font-size: 0.7rem; font-weight: 700; }
@media (max-width: 900px) {
  .cols { grid-template-columns: 1fr; }
  .ticket { grid-template-columns: 1fr 1fr; }
}
</style>
