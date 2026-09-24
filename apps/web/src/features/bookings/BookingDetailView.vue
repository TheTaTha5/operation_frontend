<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import logoUrl from '@/assets/la-logo-full.png';
import { ApiError } from '@/lib/api';
import { ob, type ObBoat, type ObBooking, type ObRoute, type ObTrip } from '@/lib/ob';

import BkIcon from './BkIcon';
import { displayCode, isB2C, paxBreak, paxSplit, statusLabel } from './model';

// Read-only booking detail, ported from the legacy one (bkV2RenderBookingDetail and its card
// helpers in allotment_v2/js/booking.js): topbar, the voucher document (bkV2VoucherTicket), then
// the two-column grid of cards with the Total / Activity sidebar. Edit, reschedule, reduce pax and
// cancel stay in the legacy app, so their buttons are shown disabled.
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

// ── legacy formatters (bkV2FmtFullDate / bkV2FmtDateTime / bkV2FmtTHB) ──
const toDate = (d: string) => new Date(d.length > 10 ? d : d + 'T00:00');
function fullDate(d?: string) {
  if (!d) return '—';
  const dt = toDate(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
function dateTime(d?: string) {
  if (!d) return '—';
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · '
    + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
const fmtTHB = (n?: number) => new Intl.NumberFormat('en-US').format(Math.round(n || 0));
const money = (n?: number) => '฿' + Math.round(+(n || 0)).toLocaleString('en-US');

const PIER: Record<string, string> = { tublamu: 'Tub Lamu', panwa: 'Visit Panwa', ranong: 'Ranong' };
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAXW = { ad: 'Adult', chd: 'Child', inf: 'Infant', foc: 'FOC' } as const;
const routeOf = (rid: string) => routes.value.find((r) => r.id === rid);
const boatName = (bid?: string) => (bid ? boats.value.find((b) => b.id === bid)?.name || bid : '');

const cancelled = computed(() => !!bk.value && ['cancelled', 'cancelled_weather', 'rejected'].includes(bk.value.status));
const canCancel = computed(() => !!bk.value && !['cancelled', 'completed', 'rejected'].includes(bk.value.status));
const canEdit = computed(() => !!bk.value && !['cancelled', 'rejected'].includes(bk.value.status));
const pax = computed(() => (bk.value ? paxSplit(bk.value) : null));
const b2c = computed(() => !!bk.value && isB2C(bk.value));

// ── voucher document (bkV2VoucherTicket) ──
const stCol = computed(() => {
  const st = bk.value?.status || '';
  return /cancel|reject/.test(st) ? '#C6403F' : /pending/.test(st) ? '#DBA02A' : '#4FA9DC';
});
/** Agent name is not in operation-backend yet: the id stands in for it. */
const agTxt = computed(() => (bk.value?.agent_id && !b2c.value ? bk.value.agent_id : b2c.value ? 'B2C · Direct' : 'Walk-in / Direct'));
const byTxt = computed(() => { const c = (bk.value?.created_by || '').trim(); return c === 'b2c_sync' ? '' : c; });
function tripDate(t: ObTrip) {
  const dt = new Date(t.service_date + 'T12:00:00');
  return isNaN(dt.getTime()) ? null : { d: String(dt.getDate()), m: MONTHS3[dt.getMonth()] || '', y: String(dt.getFullYear()) };
}
function tripMeta(t: ObTrip) {
  const r = routeOf(t.route_id);
  return [r?.times?.[0] || '', PIER[r?.pier || ''] || ''].filter(Boolean).join(' · ');
}
function paxChips(t: ObTrip) {
  const p = paxSplit({ trips: [t] });
  return (Object.keys(PAXW) as (keyof typeof PAXW)[]).filter((k) => p[k] > 0).map((k) => ({ k, n: p[k], label: PAXW[k] }));
}
const zone = computed(() => [bk.value?.pickup_area, bk.value?.pickup_zone].filter(Boolean).join(' · '));
const dropDiff = computed(() => bk.value?.dropoff_same === false);
const dropTxt = computed(() => (dropDiff.value ? bk.value?.dropoff_hotel_name || bk.value?.dropoff_area || '' : ''));
const meals = computed(() => {
  const b = bk.value; if (!b) return [];
  return ([['Vegetarian', b.special_meals_veg], ['Vegan', b.special_meals_vegan], ['Halal', b.special_meals_halal]] as [string, number | undefined][])
    .filter(([, n]) => n).map(([l, n]) => `${l} ${n}`);
});
const langs = computed(() => {
  const b = bk.value; if (!b) return [];
  return [b.guide_english && 'EN', b.guide_russian && 'RU', b.guide_chinese && 'CN', (b.guide_other_lang || '').trim()].filter(Boolean) as string[];
});
const cot = computed(() => Math.max(0, Number(bk.value?.cash_on_tour_amount) || 0));

// ── Agent & Voucher card ──
const bookedAt = computed(() => bk.value?.booked_at || bk.value?.created_at || '');
const leadTxt = computed(() => {
  const first = bk.value?.trips.map((t) => t.service_date).filter(Boolean).sort()[0];
  if (!bookedAt.value || !first) return '';
  const dd = Math.round((new Date(first + 'T00:00').getTime() - new Date(bookedAt.value.slice(0, 10) + 'T00:00').getTime()) / 86400000);
  return isNaN(dd) ? '' : ` · ${dd} day${dd === 1 ? '' : 's'} lead time`;
});
const mktTxt = computed(() => (bk.value?.market ? ` · ${bk.value.market}${bk.value.market_sub ? ` / ${bk.value.market_sub}` : ''}` : ''));

// ── Dietary & Special Requests ──
const guidesTxt = computed(() => {
  const b = bk.value; if (!b) return '';
  return [b.guide_english && 'english', b.guide_russian && 'russian', b.guide_chinese && 'chinese', b.guide_other_lang].filter(Boolean).join(' · ');
});
const hasExtras = computed(() => !!bk.value && (meals.value.length > 0 || !!bk.value.special_meals_allergies || !!bk.value.large_luggage
  || !!guidesTxt.value || !!bk.value.notes));

// ── Total (bkV2DetailCostCard), from the backend's price_* columns ──
const costRows = computed(() => {
  const b = bk.value; if (!b) return [];
  const rows: { label: string; value: string; tone?: 'foc' | 'extra' | 'disc' }[] = [];
  if (b.price_seat) rows.push({ label: 'Seat rates', value: '฿' + fmtTHB(b.price_seat) });
  if (b.price_addon) rows.push({ label: 'Add-ons', value: '฿' + fmtTHB(b.price_addon) });
  if (b.price_foc_discount) rows.push({ label: 'FOC · given free', value: '฿' + fmtTHB(-Math.abs(b.price_foc_discount)), tone: 'foc' });
  if (b.price_extra) rows.push({ label: 'Extra charge', value: '+฿' + fmtTHB(b.price_extra), tone: 'extra' });
  if (b.price_discount) rows.push({ label: 'Discount', value: '−฿' + fmtTHB(Math.abs(b.price_discount)), tone: 'disc' });
  return rows;
});

const NOT_MOVED = 'Not moved yet — use the legacy app';
</script>

<template>
  <section class="bkv2-vc">
    <!-- TOPBAR -->
    <div class="bkv2-nb-topbar">
      <button type="button" class="bkv2-nb-back" @click="router.back()"><BkIcon name="back" :size="13" /> Back to list</button>
      <template v-if="bk">
        <div class="bkv2-nb-title">{{ displayCode(bk) }}</div>
        <span class="bkv2-chip" :class="bk.status"><span class="dot" />{{ statusLabel(bk.status) }}</span>
        <span v-if="pax?.foc" class="bkv2-foc-flag">FOC {{ pax.foc }}</span>
        <div class="acts">
          <button v-if="canEdit" type="button" class="bkv2-nb-btn" disabled :title="NOT_MOVED"><BkIcon name="edit" :size="13" /> Edit</button>
          <template v-if="canCancel">
            <button type="button" class="bkv2-nb-btn blue" disabled :title="NOT_MOVED"><BkIcon name="clock" :size="13" /> Reschedule</button>
            <button type="button" class="bkv2-nb-btn amber" disabled :title="NOT_MOVED">− Reduce pax</button>
            <button type="button" class="bkv2-nb-btn red" disabled :title="NOT_MOVED"><BkIcon name="cancel" :size="13" /> Cancel</button>
          </template>
          <button v-if="cancelled" type="button" class="bkv2-nb-btn green" disabled :title="NOT_MOVED"><BkIcon name="check" :size="13" /> Restore</button>
        </div>
      </template>
      <div v-else class="bkv2-nb-title">{{ error === 'not-found' ? 'Booking not found' : '' }}</div>
    </div>

    <div v-if="error === 'signed-out'" class="bkv2-nb-card msg">Your session has ended. <RouterLink :to="`/login?next=${encodeURIComponent(route.fullPath)}`">Sign in</RouterLink></div>
    <div v-else-if="error === 'not-found'" class="bkv2-nb-card msg center">The booking <code>{{ id }}</code> was not found.</div>
    <div v-else-if="error" class="bkv2-nb-card msg err">Could not load the booking: {{ error }} <button type="button" class="linklike" @click="load">Retry</button></div>
    <div v-else-if="loading && !bk" class="bkv2-nb-card msg center muted">Loading…</div>

    <template v-if="bk">
      <!-- VOUCHER DOCUMENT (bkV2VoucherTicket) -->
      <div class="bkv2-vcdoc">
        <div class="vc-head">
          <img :src="logoUrl" alt="LOVE andaman" class="vc-logo">
          <div class="vc-co">
            <div class="n">LOVE ISLAND CO.,LTD.</div>
            <div>T.TALAD NUEA , A.MUENG , PHUKET 83000</div>
            <div>MOBILE: + 66 (0)887654678</div>
          </div>
        </div>

        <div class="vc-num">
          <span class="code">{{ bk.voucher_ref || displayCode(bk) || '—' }}</span>
          <span class="st" :style="{ background: stCol }">{{ statusLabel(bk.status) }}</span>
          <span class="ag">{{ agTxt }}<br>One Day Tour<template v-if="byTxt"><br><b>Booked by {{ byTxt }}</b></template></span>
        </div>

        <div v-for="(t, i) in bk.trips" :key="t.id" class="vc-trip">
          <div class="vc-trip-hd" :style="{ borderLeftColor: routeOf(t.route_id)?.color || '#4FA9DC' }">
            <div class="min0">
              <div class="rn">{{ routeOf(t.route_id)?.name || t.route_id || '—' }}<span v-if="t.booking_mode === 'charter'" class="chtr"> CHARTER</span></div>
              <div v-if="tripMeta(t)" class="meta">{{ tripMeta(t) }}</div>
            </div>
            <span class="dt">
              <template v-if="tripDate(t)"><span class="mono">{{ tripDate(t)!.d }}</span> {{ tripDate(t)!.m }} <span class="mono">{{ tripDate(t)!.y }}</span></template>
              <template v-else>{{ t.service_date || '—' }}</template>
            </span>
          </div>
          <div class="vc-trip-bd">
            <template v-if="i === 0">
              <div class="lp-lab">Lead passenger</div>
              <div class="lp">{{ bk.lead_pax || '—' }}</div>
            </template>
            <div class="paxrow" :class="{ first: i === 0 }">
              <span v-for="c in paxChips(t)" :key="c.k" class="paxchip"><b>{{ c.n }}</b>{{ c.label }}</span>
              <span v-if="!paxChips(t).length" class="nopax">ยังไม่ระบุจำนวนผู้โดยสาร</span>
              <span v-if="i === 0 && cot" class="cotchip">CASH ON TOUR {{ money(cot) }}</span>
            </div>
          </div>
        </div>
        <div v-if="!bk.trips.length" class="vc-notrip">No trip on this booking</div>

        <div class="vc-tiles">
          <div class="tile">
            <div class="th">PICK UP</div>
            <div class="tb">
              <div class="big">
                <template v-if="bk.hotel_name || bk.pickup_area">{{ bk.hotel_name || bk.pickup_area }}</template><span v-else class="z">—</span>
                <span v-if="(bk.room_number || '').trim()" class="chip svc">Room {{ bk.room_number!.trim() }}</span>
              </div>
              <div v-if="zone" class="fv muted2">{{ zone }}</div>
            </div>
          </div>
          <div class="tile">
            <div class="th">DROP OFF</div>
            <div class="tb">
              <div class="big">
                <template v-if="dropDiff"><template v-if="dropTxt">{{ dropTxt }}</template><span v-else class="z">—</span></template>
                <span v-else class="z">Same as pick-up</span>
              </div>
            </div>
          </div>
          <div class="tile">
            <div class="th">SPECIAL REQUEST</div>
            <div class="tb">
              <template v-if="bk.special_meals_allergies || meals.length || (bk.notes || '').trim()">
                <span v-if="bk.special_meals_allergies" class="chip allerg">⚠ {{ bk.special_meals_allergies }}</span>
                <span v-for="m in meals" :key="m" class="chip meal">{{ m }}</span>
                <div v-if="(bk.notes || '').trim()" class="fv">{{ bk.notes!.trim() }}</div>
              </template>
              <div v-else class="fv"><span class="z">—</span></div>
            </div>
          </div>
          <div class="tile">
            <div class="th">SERVICES</div>
            <div class="tb">
              <div class="fv"><span class="z">—</span> <span class="muted2 note">add-ons are not in operation-backend yet</span></div>
              <div class="fv">Guide language
                <template v-if="langs.length"><span v-for="l in langs" :key="l" class="chip svc">{{ l }}</span></template>
                <span v-else class="z">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- PAYMENT · the invoice side (paid / balance) is not in operation-backend yet -->
        <div class="vc-pay">
          <div class="ph">
            <span class="t">PAYMENT</span>
            <span class="noinv">{{ cot ? 'เก็บเงินหน้างาน' : 'ไม่มีข้อมูลใบแจ้งหนี้' }}</span>
          </div>
          <div class="cells">
            <div class="cell"><div class="lb">TOTAL</div><div class="v strong navy">{{ money(bk.total) }}</div></div>
            <template v-if="cot">
              <div class="cell"><div class="lb">COT · เก็บหน้างาน</div><div class="v cotc">{{ money(cot) }}</div></div>
              <div class="cell"><div class="lb">คงเหลือวางบิล</div><div class="v" :class="(Number(bk.total) || 0) - cot > 0 ? 'red' : 'ok'">{{ money(Math.max(0, (Number(bk.total) || 0) - cot)) }}</div></div>
            </template>
          </div>
          <div class="pnote">Invoices and payments are not in operation-backend yet, so paid and balance are not shown.</div>
        </div>
      </div>

      <!-- 2-col layout · main + sidebar -->
      <div class="cols">
        <div class="col">
          <!-- CANCELLATION (bkV2DetailBanners) · charge type and amount are not in operation-backend yet -->
          <div v-if="bk.status === 'cancelled' || bk.status === 'cancelled_weather'" class="bkv2-nb-card cxl">
            <div class="cxl-row">
              <div class="cxl-ic"><BkIcon name="cancel" :size="15" /></div>
              <div class="min0">
                <div class="cxl-t">Cancelled{{ bk.status === 'cancelled_weather' ? ' · weather' : '' }}</div>
                <div class="cxl-r">{{ bk.cancellation_reason || '(no reason)' }}</div>
                <div class="cxl-m">Charge details are not in operation-backend yet</div>
              </div>
            </div>
          </div>

          <!-- AGENT & VOUCHER -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Agent &amp; Voucher</span></div>
            <div class="g2">
              <div>
                <div class="bkv2-dt-lab">Agent</div>
                <div class="bkv2-dt-val">{{ b2c ? 'B2C' : bk.agent_id || '—' }}</div>
                <div class="bkv2-dt-sub">Agent name is not in operation-backend yet</div>
                <div v-if="bk.rate_type_ref" class="bkv2-dt-sub">Rate Type: {{ bk.rate_type_ref }}</div>
                <div v-if="b2c" class="bkv2-dt-sub">B2C · Direct</div>
              </div>
              <div>
                <div class="bkv2-dt-lab">Voucher Ref</div>
                <div class="bkv2-dt-val">{{ bk.voucher_ref || '—' }}</div>
                <div class="bkv2-dt-sub"><strong class="ink">Booked {{ fullDate(bookedAt) }}</strong>{{ leadTxt }}{{ mktTxt }}</div>
                <div class="bkv2-dt-sub">Submitted by {{ bk.created_by || '—' }}<template v-if="bk.confirmed_by"> · Confirmed by <strong class="ok">{{ bk.confirmed_by }}</strong></template></div>
              </div>
            </div>
          </div>

          <!-- TRIPS & PAX -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Trips &amp; Pax</span></div>
            <div class="trips">
              <div v-for="t in bk.trips" :key="t.id" class="tp">
                <div class="tp-hd">
                  <div class="bar" />
                  <div class="min0 grow">
                    <div class="tp-n">{{ routeOf(t.route_id)?.name || t.route_id }}</div>
                    <div class="tp-d">{{ fullDate(t.service_date) }}</div>
                  </div>
                  <span v-if="t.booking_mode === 'charter'" class="badge" :title="t.charter_boat_id ? boatName(t.charter_boat_id) : undefined">CHARTER{{ t.charter_boat_id ? ' · ' + boatName(t.charter_boat_id) : '' }}</span>
                </div>
                <div class="tp-grid">
                  <div><div class="l">Adult</div><div class="n">{{ paxSplit({ trips: [t] }).ad }}</div></div>
                  <div><div class="l">Child</div><div class="n">{{ paxSplit({ trips: [t] }).chd }}</div></div>
                  <div><div class="l">Infant</div><div class="n">{{ paxSplit({ trips: [t] }).inf }}</div></div>
                  <div><div class="l focl">FOC</div><div class="n" :class="{ focn: paxSplit({ trips: [t] }).foc }">{{ paxSplit({ trips: [t] }).foc }}</div></div>
                  <div class="r"><div class="l">Pax</div><div class="n s">{{ t.pax_total }}</div></div>
                </div>
              </div>
              <div v-if="!bk.trips.length" class="none">No trips</div>
            </div>
          </div>

          <!-- GUESTS -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Guests</span></div>
            <div class="g3">
              <div>
                <div class="bkv2-dt-lab">Lead Pax</div>
                <div class="bkv2-dt-val">{{ bk.lead_pax || '—' }}</div>
                <div v-if="bk.lead_nationality" class="bkv2-dt-sub">{{ bk.lead_nationality }}</div>
              </div>
              <div><div class="bkv2-dt-lab">Phone</div><div class="bkv2-dt-val">{{ bk.lead_phone || '—' }}</div></div>
              <div><div class="bkv2-dt-lab">Email</div><div class="bkv2-dt-val">{{ bk.lead_email || '—' }}</div></div>
            </div>
            <div v-if="bk.passengers.length" class="others">
              <div class="bkv2-dt-lab">Other passengers · {{ bk.passengers.length }}</div>
              <div class="tblx">
                <table class="ptbl">
                  <thead><tr><th>#</th><th>Name</th><th>Type</th><th>Nationality</th></tr></thead>
                  <tbody>
                    <tr v-for="(p, i) in bk.passengers" :key="p.seq">
                      <td class="muted2">#{{ i + 2 }}</td>
                      <td>{{ p.name || '—' }}</td>
                      <td><span class="ptype">{{ p.type || 'AD' }}</span></td>
                      <td>{{ p.nationality || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- PICKUP & DROP-OFF -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Pickup &amp; Drop-off</span></div>
            <div class="g2">
              <div>
                <div class="bkv2-dt-lab">Pickup</div>
                <div class="bkv2-dt-val">{{ bk.pickup_self ? 'Self transfer to pier' : bk.hotel_name || bk.pickup_area || '—' }}</div>
                <div v-if="bk.room_number" class="bkv2-dt-sub">Room {{ bk.room_number }}</div>
              </div>
              <div>
                <div class="bkv2-dt-lab">Drop-off</div>
                <div class="bkv2-dt-val">{{ bk.dropoff_same !== false && !bk.dropoff_hotel_name ? 'Same as pickup' : bk.dropoff_hotel_name || bk.dropoff_area || '—' }}</div>
              </div>
            </div>
          </div>

          <!-- DIETARY · LUGGAGE · GUIDES -->
          <div v-if="hasExtras" class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Dietary &amp; Special Requests</span></div>
            <div class="stack">
              <div v-if="meals.length"><div class="bkv2-dt-lab">Diet</div><div class="bkv2-dt-val">{{ meals.join(' · ') }}</div></div>
              <div v-if="bk.special_meals_allergies"><div class="bkv2-dt-lab">Allergies / notes</div><div class="bkv2-dt-val pre">{{ bk.special_meals_allergies }}</div></div>
              <div v-if="bk.large_luggage"><div class="bkv2-dt-lab">Luggage</div><div class="bkv2-dt-val">Large luggage {{ bk.large_luggage }}</div></div>
              <div v-if="guidesTxt"><div class="bkv2-dt-lab">Guide languages</div><div class="bkv2-dt-val">{{ guidesTxt }}</div></div>
              <div v-if="bk.notes"><div class="bkv2-dt-lab">Notes / special request</div><div class="bkv2-dt-val pre">{{ bk.notes }}</div></div>
            </div>
          </div>

          <!-- PAYMENT & CASH ON TOUR -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Payment</span></div>
            <div class="g2">
              <div>
                <div class="bkv2-dt-lab">Method</div>
                <div class="bkv2-dt-val">{{ bk.payment_method || '—' }}</div>
                <div v-if="bk.payment_net_days" class="bkv2-dt-sub">Net {{ bk.payment_net_days }} days</div>
                <div v-if="b2c" class="bkv2-dt-sub">From: B2C sync</div>
                <div v-else-if="bk.payment_source" class="bkv2-dt-sub">From: {{ bk.payment_source }}{{ bk.payment_contract_version ? ' · ' + bk.payment_contract_version : '' }}</div>
              </div>
              <div>
                <div class="bkv2-dt-lab">Cash on Tour</div>
                <div class="bkv2-dt-val">{{ cot ? `${bk.cash_on_tour_currency || 'THB'} ${cot.toLocaleString()} · ${bk.cash_on_tour_handling === 'deduct' ? 'หักจาก invoice' : 'แยกต่างหาก'}` : '—' }}</div>
                <div v-if="cot && bk.cash_on_tour_note" class="bkv2-dt-sub">📝 {{ bk.cash_on_tour_note }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT sidebar · price summary + activity -->
        <div class="col">
          <!-- COST SUMMARY -->
          <div class="bkv2-nb-card sticky">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Total</span></div>
            <div class="cost">
              <div v-for="r in costRows" :key="r.label" class="bkv2-dt-row" :class="r.tone">
                <span>{{ r.label }}<span v-if="r.tone === 'foc'" class="focnote"> value forgone · not in total</span></span><span>{{ r.value }}</span>
              </div>
              <div class="bkv2-dt-row total"><span>Total</span><span>฿{{ fmtTHB(bk.total) }}</span></div>
              <div class="paxline">{{ pax?.total }} pax · {{ pax && paxBreak(pax) }}</div>
            </div>
          </div>

          <!-- ACTIVITY -->
          <div class="bkv2-nb-card">
            <div class="bkv2-nb-sec-hd"><span class="bkv2-nb-sec-dot" /><span class="bkv2-nb-sec-ttl">Activity</span></div>
            <div class="act">
              <div class="ai">
                <div class="adot g" />
                <div class="min0 grow"><div class="at">Created</div><div class="as">{{ dateTime(bk.created_at) }} · by {{ bk.created_by || '—' }}</div></div>
              </div>
              <div v-if="bk.status === 'cancelled'" class="ai">
                <div class="adot r" />
                <div class="min0 grow"><div class="at">Cancelled</div><div class="as">{{ bk.cancellation_reason || '—' }}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* Ported from the legacy booking detail: #view-booking base rules (allotment_v2/css/01-base.css),
   the BuildAxis skin, the glass skin and the §vcSkin layer (02-skins.css) collapsed into their final
   values, plus bkV2VoucherTicket's inline styles. `#view-booking .bkv2-vc` becomes `.bkv2-vc`.
   Class names are kept so the two can be compared rule by rule. */
.bkv2-vc {
  /* BuildAxis skin vars (#view-booking) */
  --bk-navy-deep: #2952C8; --bk-navy: #3A6FF7; --bk-navy-mid: #7DA0E8; --bk-navy-light: #D6E2FB; --bk-navy-50: #EEF3FF;
  --ink: #1F2A44; --ink-mid: #475569; --ink-soft: #64748B; --border: #E5E7EB; --sand-mid: #F1F5F9; --white: #ffffff; --r-sm: 11px;
  /* §vcSkin vars */
  --dg: #f3f4f6; --di: #111827; --d2: #1f2937; --dm: #6b7280; --df: #9ca3af; --dl: #f3f4f6; --dl2: #e5e7eb;
  --dind: #4f46e5; --dam7: #b45309;
  --navy: #16265C; --mut: #7C8091; --red: #E0232A; --mono: 'DM Mono', ui-monospace, monospace;
  font-family: 'Inter', 'IBM Plex Sans Thai', system-ui, sans-serif; font-variant-numeric: tabular-nums;
  background: var(--dg); padding: 22px; color: var(--d2); font-size: 13px; border-radius: 16px;
  display: flex; flex-direction: column;
}
.bkv2-vc > * { width: 100%; max-width: 1320px; margin-left: auto; margin-right: auto; box-sizing: border-box; }
.min0 { min-width: 0; }
.grow { flex: 1; }
.pre { white-space: pre-wrap; }

/* ── topbar ── */
.bkv2-nb-topbar { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; background: #fff; border-radius: 24px; padding: 12px 14px; margin: 0 0 18px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); }
.bkv2-nb-title { font-family: var(--mono); font-size: 19px; font-weight: 500; color: var(--di); letter-spacing: -0.02em; }
.bkv2-nb-btn, .bkv2-nb-back { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #f3f4f6; border-radius: 15px; padding: 9px 14px; font: inherit; font-size: 12px; font-weight: 700; color: #374151; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: 0.15s; }
.bkv2-nb-btn:hover:not(:disabled), .bkv2-nb-back:hover { background: #f9fafb; border-color: #e5e7eb; color: var(--di); }
.bkv2-nb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bkv2-nb-btn.blue { color: #185FA5; border-color: rgba(24, 95, 165, 0.3); }
.bkv2-nb-btn.amber { color: #A05A1A; border-color: rgba(160, 90, 26, 0.3); }
.bkv2-nb-btn.red { color: #c43a2e; border-color: rgba(196, 58, 46, 0.3); }
.bkv2-nb-btn.green { color: #0F6E56; border-color: rgba(15, 110, 86, 0.3); }
.acts { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }

/* ── status chip + FOC flag ── */
.bkv2-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 999px; font-size: 10px; font-weight: 700; line-height: 1.4; font-family: 'DM Sans', sans-serif; }
.bkv2-chip .dot { width: 5px; height: 5px; border-radius: 50%; }
.bkv2-chip.confirmed { background: #e1f5ee; color: #0f6e56; } .bkv2-chip.confirmed .dot { background: #1d9e75; }
.bkv2-chip.pending_foc { background: #faeeda; color: #633806; } .bkv2-chip.pending_foc .dot { background: #ba7517; }
.bkv2-chip.quote { background: var(--sand-mid); color: var(--ink-soft); } .bkv2-chip.quote .dot { background: var(--ink-soft); }
.bkv2-chip.rejected { background: #fcebeb; color: #791f1f; } .bkv2-chip.rejected .dot { background: #a32d2d; }
.bkv2-chip.cancelled, .bkv2-chip.cancelled_weather { background: var(--sand-mid); color: #888780; }
.bkv2-chip.cancelled .dot, .bkv2-chip.cancelled_weather .dot { background: #9c9c95; }
.bkv2-chip.completed { background: var(--bk-navy-50); color: var(--bk-navy); } .bkv2-chip.completed .dot { background: var(--bk-navy); }
.bkv2-foc-flag { display: inline-block; background: #fef3c7; color: var(--dam7); font-family: var(--mono); font-size: 9px; padding: 3px 10px; border-radius: 999px; font-weight: 500; letter-spacing: 0.02em; }

/* ── cards ── */
.bkv2-nb-card { background: #fff; border-radius: 24px; padding: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.03), 0 8px 10px -6px rgba(0, 0, 0, 0.02); transition: box-shadow 0.3s; box-sizing: border-box; min-width: 0; }
.bkv2-nb-card:hover { box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.06), 0 10px 15px -5px rgba(0, 0, 0, 0.03); }
.bkv2-nb-card.sticky { position: sticky; top: 14px; }
.bkv2-nb-card.msg { margin-bottom: 18px; }
.bkv2-nb-card.center { text-align: center; padding: 40px; color: var(--ink-soft); }
.bkv2-nb-card.err { color: #c0392b; }
.bkv2-nb-sec-hd { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 800; color: var(--di); letter-spacing: -0.01em; margin-bottom: 18px; }
.bkv2-nb-sec-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--dind); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
.bkv2-nb-sec-ttl { font-size: 16px; font-weight: 800; color: var(--di); }
.bkv2-dt-lab { font-size: 9.5px; font-weight: 700; color: var(--df); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 5px; }
.bkv2-dt-val { font-size: 13.5px; font-weight: 700; color: var(--di); line-height: 1.4; overflow-wrap: anywhere; }
.bkv2-dt-sub { font-size: 11.5px; color: var(--dm); margin-top: 4px; line-height: 1.4; }
.bkv2-dt-sub .ink { color: var(--ink); }
.bkv2-dt-sub .ok { color: #0F6E56; }
.bkv2-dt-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--dl); font-size: 12px; color: var(--d2); font-family: var(--mono); }
.bkv2-dt-row:last-child { border-bottom: none; }
.bkv2-dt-row > span:last-child { font-weight: 700; color: var(--di); white-space: nowrap; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding-top: 4px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; padding: 10px 0; border-bottom: 1px solid rgba(26, 35, 50, 0.05); }
.stack { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }

/* ── two columns ── */
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

/* ── cancellation banner (bkV2DetailBanners) ── */
.bkv2-nb-card.cxl { background: #fef2f2; border: 1px solid #fecaca; }
.cxl-row { display: flex; align-items: center; gap: 11px; }
.cxl-ic { width: 30px; height: 30px; border-radius: 50%; background: #A32D2D; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cxl-t { font-size: 12.5px; font-weight: 800; color: #A32D2D; }
.cxl-r { font-size: 11.5px; color: #8a3a30; line-height: 1.5; margin-top: 1px; }
.cxl-m { font-size: 10px; color: #9a6a62; margin-top: 3px; }

/* ── Trips & Pax ── */
.trips { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.tp { border: 1px solid rgba(26, 35, 50, 0.08); border-radius: 10px; padding: 12px 14px; background: #fff; }
.tp-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tp-hd .bar { width: 6px; height: 24px; border-radius: 3px; background: #1F2A44; flex: none; }
.tp-n { font-size: 13px; font-weight: 800; color: #1F2A44; }
.tp-d { font-size: 11px; color: var(--ink-soft); margin-top: 2px; }
.badge { background: #3A6FF7; color: #fff; font-size: 10px; padding: 3px 8px; border-radius: 6px; font-weight: 700; white-space: nowrap; }
.tp-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; font-family: var(--mono); }
.tp-grid .l { font-size: 10px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.5px; }
.tp-grid .l.focl { color: #92400E; }
.tp-grid .n { font-size: 18px; font-weight: 700; }
.tp-grid .n.focn { color: #92400E; }
.tp-grid .n.s { font-size: 15px; }
.tp-grid .r { text-align: right; }
.none { padding: 14px; text-align: center; color: var(--ink-soft); font-size: 12px; }

/* ── Guests ── */
.others { margin-top: 8px; }
.others .bkv2-dt-lab { margin-bottom: 6px; }
.tblx { overflow-x: auto; }
.ptbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.ptbl thead tr { border-bottom: 1px solid rgba(26, 35, 50, 0.08); }
.ptbl th { text-align: left; padding: 6px 8px; font-weight: 700; color: var(--ink-soft); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.ptbl tbody tr { border-bottom: 1px solid rgba(26, 35, 50, 0.04); }
.ptbl td { padding: 6px 8px; }
.ptype { background: rgba(26, 35, 50, 0.06); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.muted2 { color: var(--ink-soft); }

/* ── Total + Activity ── */
.cost { padding-top: 8px; }
.bkv2-dt-row.foc { color: #A05A1A; font-style: italic; }
.focnote { font-size: 10.5px; color: var(--ink-soft); font-style: normal; }
.bkv2-dt-row.extra { color: #A05A1A; }
.bkv2-dt-row.disc { color: #A32D2D; }
.bkv2-dt-row.total { border-top: 1px solid rgba(26, 35, 50, 0.12); margin-top: 10px; padding-top: 10px; font-size: 18px; font-weight: 800; color: #1F2A44; }
.paxline { margin-top: 8px; font-size: 11px; color: var(--ink-soft); }
.act { padding-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.ai { display: flex; gap: 8px; font-size: 11px; }
.adot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.adot.g { background: #10B981; } .adot.r { background: #c43a2e; }
.at { font-weight: 700; color: #1F2A44; }
.as { color: var(--ink-soft); }

/* ── voucher document (bkV2VoucherTicket inline styles + §vcDoc) ── */
.bkv2-vcdoc { background: #fff; border: 2px solid var(--navy); border-radius: 26px; font-family: Sarabun, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 760px; padding: 16px 18px 18px; margin-bottom: 14px; box-shadow: 0 8px 26px rgba(20, 25, 45, 0.11); color: #1A1A1A; }
.mono { font-family: var(--mono); }
.vc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding-bottom: 13px; border-bottom: 2px solid var(--navy); margin-bottom: 13px; }
.vc-logo { height: 24px; width: auto; display: block; }
.vc-co { text-align: right; line-height: 1.45; font-size: 8.8px; color: var(--mut); }
.vc-co .n { font-size: 11.5px; font-weight: 800; color: var(--navy); }
.vc-num { display: flex; align-items: center; gap: 11px; margin-bottom: 11px; border: 1.5px solid #D5DAE5; border-radius: 11px; padding: 9px 13px; background: #FAFBFD; flex-wrap: wrap; }
.vc-num .code { font-family: var(--mono); font-size: 16px; font-weight: 800; color: var(--navy); overflow-wrap: anywhere; }
.vc-num .st { color: #fff; border-radius: 999px; padding: 4px 13px; font-size: 11px; font-weight: 700; }
.vc-num .ag { margin-left: auto; font-size: 10.5px; color: var(--mut); text-align: right; line-height: 1.4; }
.vc-num .ag b { color: var(--navy); font-weight: 700; }
.vc-trip { border: 1.5px solid #D5DAE5; border-radius: 16px; overflow: hidden; margin-bottom: 10px; background: #fff; }
.vc-trip-hd { background: var(--navy); color: #fff; padding: 13px 16px; border-left: 7px solid; display: flex; align-items: flex-start; gap: 12px; }
.vc-trip-hd .rn { font-size: 19px; font-weight: 800; line-height: 1.18; letter-spacing: -0.01em; }
.vc-trip-hd .chtr { font-size: 10.5px; font-weight: 800; color: #D9C2FF; }
.vc-trip-hd .meta { font-size: 10.5px; opacity: 0.72; margin-top: 3px; }
.vc-trip-hd .dt { margin-left: auto; background: #fff; color: var(--navy); border-radius: 999px; padding: 5px 14px; font-size: 15px; font-weight: 800; white-space: nowrap; }
.vc-trip-bd { padding: 12px 16px; background: #fff; }
.lp-lab { font-size: 9.5px; letter-spacing: 0.11em; font-weight: 800; color: #8A9099; text-transform: uppercase; }
.lp { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2; margin-top: 2px; color: var(--navy); overflow-wrap: anywhere; }
.paxrow { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
.paxrow.first { margin-top: 10px; }
.paxchip { background: #EAF4FB; color: var(--navy); border: 1.5px solid #BFD9EE; border-radius: 8px; padding: 4px 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.paxchip b { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; margin-right: 3px; font-family: var(--mono); }
.nopax { font-size: 11.5px; color: #B9BCC6; }
.cotchip { margin-left: auto; background: #FDF3DC; color: #7A4A00; border: 1.5px solid #EBD9AE; border-radius: 8px; padding: 4px 12px; font-size: 11px; font-weight: 800; white-space: nowrap; }
.vc-notrip { background: #F2F3F5; border-radius: 20px; padding: 16px; text-align: center; color: var(--mut); margin-bottom: 10px; }
.vc-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.tile { background: #fff; border: 1.5px solid #D5DAE5; border-radius: 14px; overflow: hidden; min-width: 0; }
.tile .th { background: #F4F6FA; border-bottom: 1.5px solid #E2E7F0; padding: 7px 13px; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; color: var(--navy); }
.tile .tb { padding: 11px 13px; }
.tile .big { font-size: 15px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.fv { font-size: 12px; line-height: 1.45; margin-top: 1px; overflow-wrap: anywhere; }
.fv .note { font-size: 10.5px; }
.z { color: #B9BCC6; }
.chip { display: inline-block; border: 1px solid; border-radius: 999px; padding: 1px 9px; font-size: 10.5px; font-weight: 700; margin: 0 4px 4px 0; }
.chip.svc { background: #E9F5FC; color: #0E5E80; border-color: #C9E6F5; }
.chip.meal { background: #E7F5EE; color: #0F6E56; border-color: #BFE4D5; }
.chip.allerg { background: #FDECEC; color: #A32D2D; border-color: #F3C9C9; }
.vc-pay { background: #fff; border: 1.5px solid #D5DAE5; border-radius: 14px; overflow: hidden; margin-top: 9px; }
.vc-pay .ph { display: flex; align-items: center; gap: 9px; background: #F4F6FA; border-bottom: 1.5px solid #E2E7F0; padding: 7px 13px; }
.vc-pay .ph .t { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; color: var(--navy); }
.vc-pay .noinv { background: #F1EFE8; color: #5F5E5A; border: 1px solid #E1DED5; border-radius: 999px; padding: 2px 10px; font-size: 10px; font-weight: 800; }
.vc-pay .cells { display: flex; align-items: stretch; }
.vc-pay .cell { flex: 1; min-width: 0; padding: 11px 13px; }
.vc-pay .cell + .cell { border-left: 1.5px solid #E2E7F0; }
.vc-pay .lb { font-size: 9px; font-weight: 800; letter-spacing: 0.09em; color: var(--mut); }
.vc-pay .v { font-family: var(--mono); font-size: 17px; font-weight: 800; margin-top: 2px; letter-spacing: -0.01em; }
.vc-pay .v.strong { font-size: 20px; }
.vc-pay .v.navy { color: var(--navy); }
.vc-pay .v.cotc { color: #7A4A00; }
.vc-pay .v.red { color: var(--red); }
.vc-pay .v.ok { color: #0F6E56; }
.vc-pay .pnote { font-size: 10.5px; padding: 9px 13px; line-height: 1.5; border-top: 1.5px dashed #E2E7F0; background: #FCFCFD; color: var(--mut); }

@media (max-width: 900px) {
  .cols { grid-template-columns: minmax(0, 1fr); }
  .bkv2-nb-card.sticky { position: static; }
}
@media (max-width: 820px) {
  .bkv2-vc { padding: 10px; }
  .bkv2-nb-card { padding: 16px; border-radius: 20px; }
  .bkv2-nb-topbar { border-radius: 18px; margin: 0 0 12px; }
  .acts { margin-left: 0; }
}
@media (max-width: 560px) {
  .vc-tiles, .g2, .g3 { grid-template-columns: minmax(0, 1fr); }
  .vc-trip-hd { flex-wrap: wrap; }
  .vc-trip-hd .dt { margin-left: 0; }
  .vc-num .ag { margin-left: 0; text-align: left; }
  .tp-grid { grid-template-columns: repeat(3, 1fr); }
  .vc-pay .cells { flex-wrap: wrap; }
}
</style>
