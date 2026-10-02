<script setup lang="ts">
import { computed } from 'vue';

import type { ObSeatLock } from '@/lib/ob';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { held, holderColor, holderName, isHolding, lockTree, releaseCountdown, routeColor, routeName } from './model';

// "ล็อกของวัน": one day's active locks, single and bulk (legacy todayBox, booking.js:689-747). Opens on tomorrow.
defineProps<{ canEdit: boolean }>();
const emit = defineEmits<{ add: [id: string]; detail: [id: string] }>();
const store = useSeatLocksStore();

const label = computed(() =>
  new Date(store.day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
const tag = computed(() => (store.day === store.today ? 'วันนี้' : store.dayOffset === 1 ? 'พรุ่งนี้' : ''));
const usedOf = (l: ObSeatLock) => lockTree(l, store.kidsOf(l.id)).used;
const heldOf = (l: ObSeatLock) => held(l, store.kidsOf(l.id));
const sum = (f: (l: ObSeatLock) => number) => store.dayLocks.reduce((n, l) => n + f(l), 0);
</script>

<template>
  <section class="lock-day">
    <header class="lock-day__head">
      <div class="lock-day__title">
        <div class="lock-day__eyebrow">ล็อกของวัน</div>
        <div class="lock-day__date">{{ label }}<span v-if="tag" class="chip chip--lock">{{ tag }}</span></div>
      </div>
      <div class="lock-day__nav">
        <button type="button" class="lock-day__step" title="วันก่อนหน้า" aria-label="Previous day" @click="store.dayOffset--">&lsaquo;</button>
        <button type="button" class="lock-day__step" title="วันถัดไป" aria-label="Next day" @click="store.dayOffset++">&rsaquo;</button>
        <button type="button" class="lock-day__jump" :class="{ 'lock-day__jump--on': store.dayOffset === 0 }" @click="store.dayOffset = 0">วันนี้</button>
        <button type="button" class="lock-day__jump" :class="{ 'lock-day__jump--on': store.dayOffset === 1 }" @click="store.dayOffset = 1">พรุ่งนี้</button>
      </div>
      <div v-if="store.dayLocks.length" class="lock-day__summary">
        {{ store.dayLocks.length }} ล็อก · กันไว้ {{ sum((l) => l.pax) }} ที่ · ใช้ไป {{ sum(usedOf) }} · เหลือ <b>{{ sum(heldOf) }}</b>
      </div>
    </header>
    <div class="lock-day__scroll">
      <table class="lock-table lock-table--compact">
        <thead>
          <tr>
            <th class="lock-table__th">เอเจ้น / ผู้ถือ</th><th class="lock-table__th">เส้นทาง</th><th class="lock-table__th">แบบ</th>
            <th class="lock-table__th lock-table__th--num">กันไว้</th><th class="lock-table__th lock-table__th--num">ใช้วันนี้</th>
            <th class="lock-table__th lock-table__th--num">เหลือ</th><th class="lock-table__th">ปล่อยคืน</th><th class="lock-table__th" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in store.dayLocks" :key="l.id">
            <td class="lock-table__td lock-table__td--strong">
              <button type="button" class="lock-day__holder" @click="emit('detail', l.id)">
                <span class="lock-dot" :style="{ background: holderColor(l, store.lookup) }" />{{ holderName(l, store.lookup) }}
              </button>
            </td>
            <td class="lock-table__td"><span class="lock-route-bar" :style="{ background: routeColor(l.route_id, store.lookup) }" />{{ routeName(l.route_id, store.lookup) }}</td>
            <td class="lock-table__td"><span v-if="l.group_id" class="chip chip--bulk">Bulk</span><span v-else class="chip chip--info">รายวัน</span></td>
            <td class="lock-table__td lock-table__td--num lock-table__td--lock">{{ l.pax }}</td>
            <td class="lock-table__td lock-table__td--num">{{ usedOf(l) }}</td>
            <td class="lock-table__td lock-table__td--num" :class="isHolding(l) && heldOf(l) ? 'lock-table__td--ok' : 'lock-table__td--faint'">{{ isHolding(l) ? heldOf(l) : '—' }}</td>
            <td class="lock-table__td">
              <span class="lock-release" :class="`lock-release--${releaseCountdown(l.release_at, store.now).tone}`">{{ releaseCountdown(l.release_at, store.now).text }}</span>
            </td>
            <td class="lock-table__td lock-table__td--end">
              <button v-if="canEdit && isHolding(l)" type="button" class="btn btn--sm btn--ok" @click="emit('add', l.id)">+ ที่นั่ง</button>
            </td>
          </tr>
          <tr v-if="!store.dayLocks.length"><td colspan="8" class="lock-table__empty">วันนี้ไม่มีล็อก</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.lock-day { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.lock-day__head { display: flex; flex-wrap: wrap; align-items: center; gap: 11px; padding: 11px 14px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
.lock-day__title { min-width: 0; }
.lock-day__eyebrow { font-size: 10px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.06em; }
.lock-day__date { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-family: var(--font-mono); font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
.lock-day__date .chip { font-family: inherit; font-size: 11px; }
.lock-day__nav { display: flex; align-items: center; gap: 6px; }
.lock-day__step { width: 26px; height: 26px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--muted); font: inherit; font-size: 13px; line-height: 1; cursor: pointer; }
.lock-day__jump { padding: 4px 11px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--muted); font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.lock-day__jump--on { background: var(--surface-2); color: var(--text); border-color: var(--muted); }
.lock-day__summary { margin-left: auto; font-size: 12px; color: var(--muted); }
.lock-day__summary b { color: var(--text); }
.lock-day__scroll { max-height: 212px; overflow: auto; }
.lock-day__holder { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.lock-day__holder:hover { text-decoration: underline; }
@media (pointer: coarse) {
  .lock-day__step { width: 36px; height: 36px; }
  .lock-day__jump { min-height: 36px; }
}
</style>
