<script setup lang="ts">
import { computed } from 'vue';

import type { ObSeatLock } from '@/lib/ob';

import { drawn, held, holderColor, holderName, lockStatus, routeColor, routeName, type GroupBy, type LockGroup, type Lookup } from './model';

// The main lock table (legacy lockRow + grouping, booking.js:807-921). Each group is its own <tbody>
// so its sticky header pushes the previous one away instead of stacking on it. No sub-group rows or
// expand toggle yet: sub-groups need spec draft B.
const props = defineProps<{ groups: LockGroup[]; groupBy: GroupBy; lookup: Lookup; canEdit: boolean }>();
const emit = defineEmits<{ add: [id: string]; release: [id: string]; detail: [id: string] }>();

const showHolder = computed(() => props.groupBy !== 'holder');
const cols = computed(() => (showHolder.value ? 8 : 7));
const STATUS_CHIP = { active: 'chip--ok', depleted: '', released: 'chip--warn' } as const;
const pct = (l: ObSeatLock) => (l.pax ? Math.min(100, Math.round((drawn(l) / l.pax) * 100)) : 0);
</script>

<template>
  <div class="lock-main">
    <div class="lock-main__scroll">
      <table class="lock-table">
        <thead>
          <tr>
            <th v-if="showHolder" class="lock-table__th">เอเจ้น / ผู้ถือ</th>
            <th class="lock-table__th">เส้นทาง</th>
            <th class="lock-table__th">วันที่</th>
            <th class="lock-table__th lock-table__th--num">ที่นั่ง</th>
            <th class="lock-table__th">ใช้ไปแล้ว</th>
            <th class="lock-table__th lock-table__th--num">คงเหลือ</th>
            <th class="lock-table__th">ปล่อยคืน</th>
            <th class="lock-table__th" />
          </tr>
        </thead>
        <tbody v-for="g in groups" :key="g.key">
          <tr v-if="groupBy !== 'none'" class="lock-group" :style="{ '--g': g.color }">
            <td :colspan="cols" class="lock-group__cell">
              <div class="lock-group__bar">
                <span class="lock-group__swatch" />
                <span class="lock-group__name">{{ g.label }}</span>
                <span class="lock-group__meta">{{ g.meta }}</span>
                <span class="lock-group__meta lock-group__meta--end">รายวันกันอยู่ {{ g.held }} ที่</span>
              </div>
            </td>
          </tr>
          <tr v-for="l in g.locks" :key="l.id" class="lock-row" :class="{ 'lock-row--off': l.status !== 'active' }">
            <td v-if="showHolder" class="lock-table__td">
              <div class="lock-row__holder"><span class="lock-dot" :style="{ background: holderColor(l, lookup) }" />{{ holderName(l, lookup) }}</div>
              <div class="lock-row__chips"><span class="chip" :class="STATUS_CHIP[lockStatus(l)]">{{ lockStatus(l) }}</span></div>
            </td>
            <td class="lock-table__td">
              <div class="lock-row__route">
                <span class="lock-row__route-bar" :style="{ background: routeColor(l.route_id, lookup) }" />
                <div class="lock-row__route-text">
                  <div class="lock-row__route-name">{{ routeName(l.route_id, lookup) }}</div>
                  <div v-if="!showHolder" class="lock-row__chips"><span class="chip" :class="STATUS_CHIP[lockStatus(l)]">{{ lockStatus(l) }}</span></div>
                </div>
              </div>
            </td>
            <td class="lock-table__td lock-table__td--nowrap"><span class="chip chip--info">รายวัน</span> <span class="lock-mono">{{ l.service_date }}</span></td>
            <td class="lock-table__td lock-table__td--num lock-table__td--lock lock-table__td--big">{{ l.pax }}</td>
            <td class="lock-table__td lock-row__used">
              <div class="lock-mono"><b>{{ drawn(l) }}</b>/{{ l.pax }}</div>
              <div class="meter"><div class="meter__fill" :style="{ '--pct': pct(l) }" /></div>
            </td>
            <td class="lock-table__td lock-table__td--num lock-table__td--big" :class="{ 'lock-table__td--faint': !held(l) }">{{ held(l) }}</td>
            <td class="lock-table__td lock-table__td--faint">—</td>
            <td class="lock-table__td lock-table__td--end">
              <div class="lock-row__actions">
                <template v-if="canEdit && l.status === 'active'">
                  <button type="button" class="btn btn--sm btn--ok" @click="emit('add', l.id)">+ ที่นั่ง</button>
                  <button v-if="held(l) > 0" type="button" class="btn btn--sm btn--danger" @click="emit('release', l.id)">คืน</button>
                </template>
                <button type="button" class="btn btn--sm" @click="emit('detail', l.id)">รายละเอียด</button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-if="!groups.length">
          <tr><td :colspan="cols" class="lock-table__empty lock-table__empty--big">ไม่มีล็อกที่ตรงกับตัวกรอง</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.lock-main { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.lock-main__scroll { max-height: calc(100dvh - var(--topbar) - 120px); overflow: auto; }
.lock-main .lock-table { min-width: 860px; }

/* Group header: tinted with the agent's or route's colour, pinned under the column headers. */
.lock-group__cell {
  position: sticky;
  top: var(--lock-th-h);
  z-index: 3;
  padding: 7px 10px;
  border-top: 1px solid color-mix(in srgb, var(--g) 32%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--g) 32%, transparent);
  background: color-mix(in srgb, var(--g) 15%, var(--surface));
}
.lock-group__bar { display: flex; align-items: center; gap: 9px; color: color-mix(in srgb, var(--g) 55%, var(--text)); }
.lock-group__swatch { width: 4px; height: 16px; border-radius: 2px; background: var(--g); }
.lock-group__name { font-size: 12.5px; font-weight: 700; }
.lock-group__meta { font-size: 10.5px; opacity: 0.75; }
.lock-group__meta--end { margin-left: auto; }

.lock-row--off { opacity: 0.6; }
.lock-row__holder { display: flex; align-items: center; font-size: 12.5px; font-weight: 700; }
.lock-row__chips { margin-top: 3px; }
.lock-row__chips .chip { font-size: 9px; padding: 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.lock-row__route { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lock-row__route-bar { flex: none; width: 3px; height: 26px; border-radius: 2px; }
.lock-row__route-text { min-width: 0; }
.lock-row__route-name { overflow: hidden; font-size: 12.5px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.lock-row__used { width: 150px; }
.lock-row__used b { font-size: 13px; }
.lock-row__actions { display: flex; justify-content: flex-end; gap: 5px; white-space: nowrap; }
</style>
