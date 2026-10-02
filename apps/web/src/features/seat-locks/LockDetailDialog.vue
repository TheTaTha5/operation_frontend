<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';

import LaDialog from '@/components/LaDialog.vue';
import { useSeatLocksStore } from '@/stores/seatLocks';

import {
  drawn, giveBackMax, held, holderName, isHolding, lockClaims, lockCoverage, lockStatus, lockTree, releaseCountdown, releaseRuleLabel, routeName,
  subLeft, type LockTarget,
} from './model';

// One lock in detail (legacy manage modal "ประวัติ", bkV2LockOverlays, booking.js:1180-1284): the
// held / used / total figures, its sub-groups, the vouchers that drew from it, and the holder's
// bookings that took seats from the general pool instead. The event history needs draft D. The
// legacy "fix counters" audit is gone: the backend derives drawn_pax, so it can't drift.
const props = defineProps<{ id: string; canEdit: boolean }>();
const emit = defineEmits<{ close: []; add: [t: LockTarget]; release: [t: LockTarget]; sub: [t: LockTarget]; group: [id: string] }>();
const store = useSeatLocksStore();

const lock = computed(() => store.byId(props.id)!);
const kids = computed(() => store.kidsOf(props.id));
const tree = computed(() => lockTree(lock.value, kids.value));
const day = computed(() => store.dayBookings.get(lock.value.service_date));
const claims = computed(() => lockClaims(day.value?.rows ?? [], lock.value.id));
const kidClaims = computed(() => new Map(kids.value.map((k) => [k.id, lockClaims(day.value?.rows ?? [], k.id)])));
const coverage = computed(() => lockCoverage(day.value?.rows ?? [], lock.value, kids.value));
const poolRows = computed(() => coverage.value?.rows.filter((r) => r.pool > 0) ?? []);
const release = computed(() => releaseCountdown(lock.value.release_at, store.now));
const live = computed(() => props.canEdit && lock.value.status === 'active' && isHolding(lock.value));
const t = (id: string): LockTarget => ({ kind: 'lock', id });
onMounted(() => store.loadDay(lock.value.service_date));
</script>

<template>
  <LaDialog eyebrow="Seat lock" :title="holderName(lock, store.lookup)"
    :sub="`${routeName(lock.route_id, store.lookup)} · ${lock.service_date}${lock.group_id ? ' · Bulk' : ''} · ${lockStatus(lock, kids)}`" width="480px" @close="emit('close')">
    <div class="lock-detail">
      <div v-if="lock.release_at" class="lock-detail__release" :class="`lock-detail__release--${release.tone}`">
        🕒 {{ releaseRuleLabel(lock) }} · {{ release.tone === 'passed' ? 'ปล่อยคืนแล้ว' : release.text }}
      </div>
      <div class="lock-detail__figures">
        <div><div class="lock-detail__k">Held</div><div class="lock-detail__v lock-detail__v--lock">{{ held(lock, kids) }}</div></div>
        <div><div class="lock-detail__k">Used</div><div class="lock-detail__v">{{ tree.used }}</div></div>
        <div><div class="lock-detail__k">Total</div><div class="lock-detail__v">{{ lock.pax }}</div></div>
        <div v-if="kids.length" class="lock-detail__split">
          <div class="lock-detail__k">แบ่งย่อย / ยังไม่จัด</div>
          <div class="lock-detail__v lock-detail__v--small">{{ tree.allocated }} / <span :class="{ 'lock-detail__warn': tree.unallocated > 0 }">{{ tree.unallocated }}</span></div>
        </div>
      </div>

      <section v-if="kids.length" class="lock-detail__sec">
        <div class="lock-detail__h">กรุ๊ปย่อย ({{ kids.length }})</div>
        <div v-for="k in kids" :key="k.id" class="lock-detail__kid" :class="{ 'lock-detail__kid--off': k.status !== 'active' }">
          <span class="lock-detail__kid-name">{{ k.sub_name }}</span>
          <span class="lock-detail__kid-nums"><b>{{ drawn(k) }}</b>/{{ k.pax }} · <b :class="subLeft(k) ? 'lock-detail__ok' : 'lock-detail__lock'">{{ subLeft(k) }}</b> เหลือ</span>
          <span v-if="(kidClaims.get(k.id) ?? []).length" class="lock-detail__kid-vcs">
            <RouterLink v-for="c in kidClaims.get(k.id)" :key="c.bookingId" class="chip chip--info lock-detail__voucher" :to="`/bookings/${encodeURIComponent(c.bookingId)}`">{{ c.code }} · {{ c.qty }}</RouterLink>
          </span>
          <span class="lock-detail__kid-acts">
            <template v-if="live && k.status === 'active'">
              <button type="button" class="btn btn--sm btn--ok" @click="emit('add', t(k.id))">+ ที่นั่ง</button>
              <button v-if="subLeft(k) > 0" type="button" class="btn btn--sm btn--danger" @click="emit('release', t(k.id))">ปล่อย</button>
            </template>
            <span v-else-if="k.status !== 'active'" class="lock-detail__muted">{{ k.status }}</span>
          </span>
        </div>
      </section>

      <div v-if="!day || day.status === 'loading'" class="lock-detail__muted">กำลังโหลดใบจองของวันนั้น…</div>
      <div v-else-if="day.status === 'error'" class="callout callout--danger" role="alert">
        <b>Could not load that day's bookings</b>{{ day.error }}
        <button type="button" class="btn btn--sm" @click="store.loadDay(lock.service_date, true)">Retry</button>
      </div>
      <template v-else>
        <section class="lock-detail__sec">
          <div class="lock-detail__h">{{ kids.length ? 'ดึงจากส่วนที่ยังไม่ได้แบ่ง' : 'ใบจองที่ดึงจากล็อกนี้' }} ({{ claims.length }})</div>
          <div v-if="claims.length" class="lock-detail__vouchers">
            <RouterLink v-for="c in claims" :key="c.bookingId" class="chip chip--info lock-detail__voucher" :to="`/bookings/${encodeURIComponent(c.bookingId)}`" :title="c.lead">
              {{ c.code }} · {{ c.qty }}
            </RouterLink>
          </div>
          <div v-else class="lock-detail__muted">ยังไม่มีใบจองดึงจากล็อกนี้</div>
        </section>

        <section v-if="coverage && coverage.bookings" class="lock-detail__sec">
          <div class="lock-detail__h lock-detail__h--row">
            <span>ใบจองของเจ้านี้บนทริปนี้</span>
            <span class="lock-detail__count"><b>{{ coverage.bookings }}</b> ใบ · <b>{{ coverage.pax }}</b> ที่</span>
          </div>
          <div class="lock-detail__muted">
            ดึงจากล็อกนี้ <b class="lock-detail__ok">{{ coverage.self }}</b> ที่<template v-if="coverage.other"> · ดึงจากล็อกอื่น <b>{{ coverage.other }}</b> ที่</template><template v-if="coverage.pool"> · <b class="lock-detail__warn">มาจาก pool ทั่วไป {{ coverage.pool }} ที่</b></template>
          </div>
          <div v-if="coverage.pool" class="callout callout--warn lock-detail__pool">
            <b>มี {{ coverage.pool }} ที่ที่ไม่ได้ดึงจากล็อก</b>
            <span v-if="held(lock, kids) > 0">ล็อกยังเหลือ {{ held(lock, kids) }} ที่ แต่ใบพวกนี้ไปกินที่จาก pool ที่ขายทั่วไปแทน — ตอนจองน่าจะลืมกดเลือกล็อก</span>
            <span v-else>ตอนที่จองใบพวกนี้ ล็อกน่าจะเต็มแล้ว จึงไปกินที่จาก pool ทั่วไป</span>
            <RouterLink v-for="r in poolRows" :key="r.bookingId" class="lock-detail__pool-row" :to="`/bookings/${encodeURIComponent(r.bookingId)}`">
              <span class="chip chip--warn">{{ r.code }}</span>
              <span class="lock-detail__lead">{{ r.lead || '—' }}</span>
              <span>{{ r.pax }} ที่ · ล็อก {{ r.self + r.other }} · <b>pool {{ r.pool }}</b></span>
            </RouterLink>
          </div>
          <div v-else class="lock-detail__ok">✓ ทุกที่นั่งของเจ้านี้บนทริปนี้ดึงจากล็อกครบ</div>
        </section>
      </template>
    </div>
    <template #foot>
      <template v-if="live">
        <button type="button" class="btn btn--ok-solid" @click="emit('add', t(lock.id))">+ เพิ่มที่นั่ง</button>
        <button v-if="store.bulkReady && tree.unallocated > 0" type="button" class="btn btn--sub-solid" @click="emit('sub', t(lock.id))">+ กรุ๊ปย่อย</button>
        <button v-if="giveBackMax(lock, kids) > 0" type="button" class="btn btn--danger" @click="emit('release', t(lock.id))">ปล่อย{{ kids.length ? ' (ยังไม่จัด)' : '' }}</button>
      </template>
      <button v-if="lock.group_id" type="button" class="btn" @click="emit('group', lock.group_id)">ดูทั้ง Bulk →</button>
      <button type="button" class="btn lock-detail__close" @click="emit('close')">ปิด</button>
    </template>
  </LaDialog>
</template>

<style scoped>
.lock-detail { display: flex; flex-direction: column; gap: 14px; font-size: 12px; }
.lock-detail__release { font-size: 11px; color: var(--ok); }
.lock-detail__release--soon { color: var(--warn); font-weight: 600; }
.lock-detail__release--passed { color: var(--muted); }
.lock-detail__figures { display: flex; gap: 18px; font-variant-numeric: tabular-nums; }
.lock-detail__split { margin-left: auto; text-align: right; }
.lock-detail__k { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.lock-detail__v { font-size: 20px; font-weight: 700; }
.lock-detail__v--small { margin-top: 4px; font-size: 14px; }
.lock-detail__v--lock, .lock-detail__lock { color: var(--lock); }
.lock-detail__sec { display: flex; flex-direction: column; gap: 6px; padding-top: 11px; border-top: 1px solid var(--border); }
.lock-detail__h { font-size: 10px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; }
.lock-detail__h--row { display: flex; align-items: baseline; gap: 8px; }
.lock-detail__count { margin-left: auto; font-size: 11.5px; color: var(--text); text-transform: none; letter-spacing: 0; font-weight: 400; }
.lock-detail__kid { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 7px 10px; border-left: 3px solid var(--bulk); border-radius: 0 8px 8px 0; background: var(--bulk-bg); }
.lock-detail__kid--off { opacity: 0.6; }
.lock-detail__kid-name { min-width: 28px; font-weight: 700; color: var(--bulk); }
.lock-detail__kid-nums { font-variant-numeric: tabular-nums; }
.lock-detail__kid-vcs { display: flex; flex-wrap: wrap; gap: 4px; }
.lock-detail__kid-acts { display: flex; gap: 6px; margin-left: auto; }
.lock-detail__vouchers { display: flex; flex-wrap: wrap; gap: 5px; }
.lock-detail__voucher { font-family: var(--font-mono); text-decoration: none; }
.lock-detail__muted { color: var(--muted); font-size: 11px; line-height: 1.6; }
.lock-detail__ok { color: var(--ok); font-size: 11px; }
.lock-detail__warn { color: var(--warn); }
.lock-detail__pool { display: flex; flex-direction: column; gap: 6px; font-size: 11px; line-height: 1.6; }
.lock-detail__pool-row { display: flex; align-items: center; gap: 8px; color: var(--text); text-decoration: none; }
.lock-detail__pool-row:hover .lock-detail__lead { text-decoration: underline; }
.lock-detail__lead { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lock-detail__close { margin-left: auto; }
.btn--sub-solid { color: #fff; background: var(--bulk); border-color: var(--bulk); }
</style>
