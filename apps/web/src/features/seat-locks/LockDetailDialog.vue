<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';

import LaDialog from '@/components/LaDialog.vue';
import type { ObSeatLock } from '@/lib/ob';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { drawn, held, holderName, lockClaims, lockCoverage, lockStatus, routeName } from './model';

// One lock in detail (legacy manage modal "ประวัติ", bkV2LockOverlays, booking.js:1180-1284): the
// held / used / total figures, the vouchers that drew from it, and the holder's bookings that took
// seats from the general pool instead. Sub-groups and the event history need drafts B and D. The
// legacy "fix counters" audit is gone: the backend derives drawn_pax, so it can't drift.
const props = defineProps<{ lock: ObSeatLock; canEdit: boolean }>();
const emit = defineEmits<{ close: []; add: []; release: [] }>();
const store = useSeatLocksStore();

const day = computed(() => store.dayBookings.get(props.lock.service_date));
const claims = computed(() => lockClaims(day.value?.rows ?? [], props.lock.id));
const coverage = computed(() => lockCoverage(day.value?.rows ?? [], props.lock));
const poolRows = computed(() => coverage.value?.rows.filter((r) => r.pool > 0) ?? []);
onMounted(() => store.loadDay(props.lock.service_date));
</script>

<template>
  <LaDialog eyebrow="Seat lock" :title="holderName(lock, store.lookup)"
    :sub="`${routeName(lock.route_id, store.lookup)} · ${lock.service_date} · ${lockStatus(lock)}`" width="460px" @close="emit('close')">
    <div class="lock-detail">
      <div class="lock-detail__figures">
        <div><div class="lock-detail__k">Held</div><div class="lock-detail__v lock-detail__v--lock">{{ held(lock) }}</div></div>
        <div><div class="lock-detail__k">Used</div><div class="lock-detail__v">{{ drawn(lock) }}</div></div>
        <div><div class="lock-detail__k">Total</div><div class="lock-detail__v">{{ lock.pax }}</div></div>
      </div>

      <div v-if="!day || day.status === 'loading'" class="lock-detail__muted">กำลังโหลดใบจองของวันนั้น…</div>
      <div v-else-if="day.status === 'error'" class="callout callout--danger" role="alert">
        <b>Could not load that day's bookings</b>{{ day.error }}
        <button type="button" class="btn btn--sm" @click="store.loadDay(lock.service_date, true)">Retry</button>
      </div>
      <template v-else>
        <section class="lock-detail__sec">
          <div class="lock-detail__h">ใบจองที่ดึงจากล็อกนี้ ({{ claims.length }})</div>
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
            <span v-if="held(lock) > 0">ล็อกยังเหลือ {{ held(lock) }} ที่ แต่ใบพวกนี้ไปกินที่จาก pool ที่ขายทั่วไปแทน — ตอนจองน่าจะลืมกดเลือกล็อก</span>
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
      <template v-if="canEdit && lock.status === 'active'">
        <button type="button" class="btn btn--ok-solid" @click="emit('add')">+ เพิ่มที่นั่ง</button>
        <button v-if="held(lock) > 0" type="button" class="btn btn--danger" @click="emit('release')">ปล่อย</button>
      </template>
      <button type="button" class="btn lock-detail__close" @click="emit('close')">ปิด</button>
    </template>
  </LaDialog>
</template>

<style scoped>
.lock-detail { display: flex; flex-direction: column; gap: 14px; font-size: 12px; }
.lock-detail__figures { display: flex; gap: 18px; font-variant-numeric: tabular-nums; }
.lock-detail__k { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.lock-detail__v { font-size: 20px; font-weight: 700; }
.lock-detail__v--lock { color: var(--lock); }
.lock-detail__sec { display: flex; flex-direction: column; gap: 6px; padding-top: 11px; border-top: 1px solid var(--border); }
.lock-detail__h { font-size: 10px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; }
.lock-detail__h--row { display: flex; align-items: baseline; gap: 8px; }
.lock-detail__count { margin-left: auto; font-size: 11.5px; color: var(--text); text-transform: none; letter-spacing: 0; font-weight: 400; }
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
</style>
