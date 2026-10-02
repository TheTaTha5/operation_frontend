<script setup lang="ts">
import { computed, ref } from 'vue';

import type { ObSeatLock } from '@/lib/ob';
import { useSeatLocksStore } from '@/stores/seatLocks';

import {
  DOW_TH, drawn, giveBackMax, groupStats, groupSubGroups, held, holderColor, holderName, isHolding, lockStatus, lockTree, releaseCountdown,
  releaseRuleLabel, routeColor, routeName, rowActive, subLeft, type LockRow, type LockTarget,
} from './model';

// The main lock table (legacy lockRow + grouping, booking.js:807-921). A bulk lock is one row, as in
// legacy; a lock with sub-groups opens with ▸. Each group of rows is its own <tbody> so its sticky
// header pushes the previous one away instead of stacking on it.
const props = defineProps<{ canEdit: boolean }>();
const emit = defineEmits<{ add: [t: LockTarget]; release: [t: LockTarget]; sub: [t: LockTarget]; detail: [t: LockTarget] }>();
const store = useSeatLocksStore();

const showHolder = computed(() => store.filters.groupBy !== 'holder');
const cols = computed(() => (showHolder.value ? 9 : 8));
const open = ref(new Set<string>());
const toggle = (key: string) => { const s = new Set(open.value); if (s.has(key)) s.delete(key); else s.add(key); open.value = s; };

const STATUS_CHIP = { active: 'chip--ok', depleted: '', released: 'chip--warn' } as const;
const owner = (r: LockRow) => (r.kind === 'lock' ? r.lock : r.group);
const lockT = (id: string): LockTarget => ({ kind: 'lock', id });
const groupT = (id: string): LockTarget => ({ kind: 'group', id });
const pctOf = (used: number, of: number) => (of ? Math.min(100, Math.round((used / of) * 100)) : 0);
const hasKids = (r: LockRow) => r.kids.length > 0;
const rowStatus = (r: LockRow) => (r.kind === 'lock' ? lockStatus(r.lock, r.kids) : rowActive(r) ? 'active' : 'released');
const editable = (r: LockRow) => props.canEdit && (r.kind === 'lock' ? isHolding(r.lock) : rowActive(r));
const canSub = (r: LockRow) => store.bulkReady && (r.kind === 'group' || lockTree(r.lock, r.kids).unallocated > 0);
const canGiveBack = (r: LockRow) => (r.kind === 'group' ? r.group.pax > 0 : giveBackMax(r.lock, r.kids) > 0);
const childPct = (k: ObSeatLock) => pctOf(drawn(k), k.pax);
</script>

<template>
  <div class="lock-main">
    <div class="lock-main__scroll">
      <table class="lock-table">
        <thead>
          <tr>
            <th class="lock-table__th lock-table__th--toggle" />
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
        <tbody v-for="g in store.grouped" :key="g.key">
          <tr v-if="store.filters.groupBy !== 'none'" class="lock-group" :style="{ '--g': g.color }">
            <td :colspan="cols" class="lock-group__cell">
              <div class="lock-group__bar">
                <span class="lock-group__swatch" />
                <span class="lock-group__name">{{ g.label }}</span>
                <span class="lock-group__meta">{{ g.meta }}</span>
                <span class="lock-group__meta lock-group__meta--end">รายวันกันอยู่ {{ g.dayHeld }} ที่ · Bulk {{ g.bulkPax }} ที่/รอบ</span>
              </div>
            </td>
          </tr>
          <template v-for="r in g.rows" :key="r.key">
            <tr class="lock-row" :class="{ 'lock-row--off': rowStatus(r) === 'released' }">
              <td class="lock-table__td lock-row__toggle-cell">
                <button v-if="hasKids(r)" type="button" class="lock-row__toggle" :aria-expanded="open.has(r.key)" aria-label="Sub-groups" @click="toggle(r.key)">
                  {{ open.has(r.key) ? '▾' : '▸' }}
                </button>
              </td>
              <td v-if="showHolder" class="lock-table__td">
                <div class="lock-row__holder"><span class="lock-dot" :style="{ background: holderColor(owner(r), store.lookup) }" />{{ holderName(owner(r), store.lookup) }}</div>
                <div class="lock-row__chips">
                  <span class="chip" :class="STATUS_CHIP[rowStatus(r)]">{{ rowStatus(r) }}</span>
                  <span v-if="hasKids(r)" class="chip chip--bulk">{{ r.kind === 'group' ? groupSubGroups(r.kids).length : r.kids.length }} ย่อย</span>
                </div>
              </td>
              <td class="lock-table__td">
                <div class="lock-row__route">
                  <span class="lock-row__route-bar" :style="{ background: routeColor(owner(r).route_id, store.lookup) }" />
                  <div class="lock-row__route-text">
                    <div class="lock-row__route-name">{{ routeName(owner(r).route_id, store.lookup) }}</div>
                    <div v-if="!showHolder" class="lock-row__chips">
                      <span class="chip" :class="STATUS_CHIP[rowStatus(r)]">{{ rowStatus(r) }}</span>
                      <span v-if="hasKids(r)" class="chip chip--bulk">{{ r.kind === 'group' ? groupSubGroups(r.kids).length : r.kids.length }} ย่อย</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- A single-day lock -->
              <template v-if="r.kind === 'lock'">
                <td class="lock-table__td lock-table__td--nowrap"><span class="chip chip--info">รายวัน</span> <span class="lock-mono">{{ r.lock.service_date }}</span></td>
                <td class="lock-table__td lock-table__td--num lock-table__td--lock lock-table__td--big">{{ r.lock.pax }}</td>
                <td class="lock-table__td lock-row__used">
                  <div class="lock-mono"><b>{{ lockTree(r.lock, r.kids).used }}</b>/{{ r.lock.pax }}</div>
                  <div class="meter"><div class="meter__fill" :style="{ '--pct': pctOf(lockTree(r.lock, r.kids).used, r.lock.pax) }" /></div>
                </td>
                <td class="lock-table__td lock-table__td--num lock-table__td--big" :class="{ 'lock-table__td--faint': !held(r.lock, r.kids) }">{{ held(r.lock, r.kids) }}</td>
                <td class="lock-table__td">
                  <span class="lock-release" :class="`lock-release--${releaseCountdown(r.lock.release_at, store.now).tone}`">{{ releaseCountdown(r.lock.release_at, store.now).text }}</span>
                </td>
                <td class="lock-table__td lock-table__td--end">
                  <div class="lock-row__actions">
                    <template v-if="editable(r)">
                      <button type="button" class="btn btn--sm btn--ok" @click="emit('add', lockT(r.lock.id))">+ ที่นั่ง</button>
                      <button v-if="canSub(r)" type="button" class="btn btn--sm btn--sub" @click="emit('sub', lockT(r.lock.id))">+ ย่อย</button>
                      <button v-if="canGiveBack(r)" type="button" class="btn btn--sm btn--danger" @click="emit('release', lockT(r.lock.id))">คืน</button>
                    </template>
                    <button type="button" class="btn btn--sm" @click="emit('detail', lockT(r.lock.id))">รายละเอียด</button>
                  </div>
                </td>
              </template>

              <!-- A bulk lock: one row for every departure in its range -->
              <template v-else>
                <td class="lock-table__td lock-table__td--nowrap">
                  <span class="chip chip--bulk">Bulk</span>
                  <span class="lock-mono"> {{ r.group.date_from }} <span class="lock-row__arrow">&rarr;</span> {{ r.group.date_to }}</span>
                  <span class="lock-dow" :aria-label="r.group.weekdays.length ? 'Weekdays' : 'Every day'">
                    <i v-for="(d, i) in DOW_TH" :key="i" class="lock-dow__day" :class="{ 'lock-dow__day--on': !r.group.weekdays.length || r.group.weekdays.includes(i) }">{{ d }}</i>
                  </span>
                </td>
                <td class="lock-table__td lock-table__td--num lock-table__td--lock lock-table__td--big">{{ r.group.pax }}<div class="lock-row__per">/รอบ</div></td>
                <td class="lock-table__td lock-row__used">
                  <div class="lock-mono"><b>{{ groupStats(r, store.today).used }}</b> ที่ <span class="lock-row__faint">· ผ่านมา {{ groupStats(r, store.today).past }}/{{ groupStats(r, store.today).total }} รอบ</span></div>
                  <div class="meter"><div class="meter__fill" :style="{ '--pct': groupStats(r, store.today).pct }" /></div>
                </td>
                <td class="lock-table__td lock-table__td--num lock-table__td--big">{{ rowActive(r) ? r.group.pax : 0 }}<div class="lock-row__per">/รอบ</div></td>
                <td class="lock-table__td lock-table__td--faint lock-table__td--nowrap">{{ releaseRuleLabel(r.group) || '—' }}</td>
                <td class="lock-table__td lock-table__td--end">
                  <div class="lock-row__actions">
                    <template v-if="editable(r)">
                      <button type="button" class="btn btn--sm btn--ok" @click="emit('add', groupT(r.group.id))">+ ที่นั่ง</button>
                      <button v-if="canSub(r)" type="button" class="btn btn--sm btn--sub" @click="emit('sub', groupT(r.group.id))">+ ย่อย</button>
                      <button v-if="canGiveBack(r)" type="button" class="btn btn--sm btn--danger" @click="emit('release', groupT(r.group.id))">คืน</button>
                    </template>
                    <button type="button" class="btn btn--sm" @click="emit('detail', groupT(r.group.id))">รายละเอียด</button>
                  </div>
                </td>
              </template>
            </tr>

            <!-- Sub-groups of a single-day lock: their own seats, and their own buttons -->
            <template v-if="open.has(r.key) && r.kind === 'lock'">
              <tr v-for="k in r.kids" :key="k.id" class="lock-row lock-row--child" :class="{ 'lock-row--off': k.status !== 'active' }">
                <td class="lock-table__td" />
                <td v-if="showHolder" class="lock-table__td lock-row__child-name">&#8627; {{ k.sub_name }}</td>
                <td class="lock-table__td lock-row__child-of">
                  <b v-if="!showHolder" class="lock-row__child-name">&#8627; {{ k.sub_name }} · </b>แบ่งจาก {{ holderName(r.lock, store.lookup) }}
                </td>
                <td class="lock-table__td lock-table__td--faint">ตามล็อกหลัก</td>
                <td class="lock-table__td lock-table__td--num lock-table__td--big lock-row__child-pax">{{ k.pax }}</td>
                <td class="lock-table__td lock-row__used">
                  <div class="lock-mono"><b>{{ drawn(k) }}</b>/{{ k.pax }}</div>
                  <div class="meter"><div class="meter__fill" :style="{ '--pct': childPct(k) }" /></div>
                </td>
                <td class="lock-table__td lock-table__td--num lock-table__td--big">{{ subLeft(k) }}</td>
                <td class="lock-table__td" />
                <td class="lock-table__td lock-table__td--end">
                  <div v-if="canEdit && k.status === 'active' && isHolding(r.lock)" class="lock-row__actions">
                    <button type="button" class="btn btn--sm btn--ok" @click="emit('add', lockT(k.id))">+ ที่นั่ง</button>
                    <button v-if="subLeft(k) > 0" type="button" class="btn btn--sm btn--danger" @click="emit('release', lockT(k.id))">คืน</button>
                  </div>
                </td>
              </tr>
            </template>
            <!-- Sub-groups of a bulk lock, one line per name across its departures -->
            <template v-if="open.has(r.key) && r.kind === 'group'">
              <tr v-for="s in groupSubGroups(r.kids)" :key="s.name" class="lock-row lock-row--child">
                <td class="lock-table__td" />
                <td v-if="showHolder" class="lock-table__td lock-row__child-name">&#8627; {{ s.name }}</td>
                <td class="lock-table__td lock-row__child-of">
                  <b v-if="!showHolder" class="lock-row__child-name">&#8627; {{ s.name }} · </b>แบ่งจาก {{ holderName(r.group, store.lookup) }}
                </td>
                <td class="lock-table__td lock-table__td--faint">{{ s.days }} รอบ</td>
                <td class="lock-table__td lock-table__td--num lock-table__td--big lock-row__child-pax">{{ s.pax }}<div class="lock-row__per">/รอบ</div></td>
                <td class="lock-table__td"><div class="lock-mono"><b>{{ s.used }}</b> ที่</div></td>
                <td class="lock-table__td" />
                <td class="lock-table__td" />
                <td class="lock-table__td lock-table__td--end lock-table__td--faint">แก้รายวันใน "รายละเอียด"</td>
              </tr>
            </template>
          </template>
        </tbody>
        <tbody v-if="!store.grouped.length">
          <tr><td :colspan="cols" class="lock-table__empty lock-table__empty--big">ไม่มีล็อกที่ตรงกับตัวกรอง</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.lock-main { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.lock-main__scroll { max-height: calc(100dvh - var(--topbar) - 120px); overflow: auto; }
.lock-main .lock-table { min-width: 960px; }
.lock-table__th--toggle { width: 30px; }

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
.lock-row--child { background: var(--surface-2); }
.lock-row__toggle-cell { width: 30px; }
.lock-row__toggle { width: 22px; height: 22px; padding: 0; border: 0; background: transparent; color: var(--text-faint); font-size: 11px; cursor: pointer; }
.lock-row__holder { display: flex; align-items: center; font-size: 12.5px; font-weight: 700; }
.lock-row__chips { display: flex; gap: 4px; margin-top: 3px; }
.lock-row__chips .chip { font-size: 9px; padding: 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.lock-row__route { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lock-row__route-bar { flex: none; width: 3px; height: 26px; border-radius: 2px; }
.lock-row__route-text { min-width: 0; }
.lock-row__route-name { overflow: hidden; font-size: 12.5px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.lock-row__arrow, .lock-row__faint { color: var(--text-faint); }
.lock-row__per { font-family: inherit; font-size: 9px; font-weight: 400; color: var(--text-faint); }
.lock-row__used { width: 170px; }
.lock-row__used b { font-size: 13px; }
.lock-row__actions { display: flex; justify-content: flex-end; gap: 5px; white-space: nowrap; }
.lock-row__child-name { font-size: 12px; font-weight: 600; color: var(--text); }
.lock-row__child-of { font-size: 11.5px; color: var(--muted); }
.lock-row__child-pax { color: var(--bulk); }
.btn--sub { color: var(--bulk); background: var(--bulk-bg); border-color: transparent; }

/* Weekday chips of a bulk lock (legacy dowChips, booking.js:793). */
.lock-dow { display: inline-flex; gap: 2px; margin-left: 6px; vertical-align: middle; }
.lock-dow__day { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 3px; background: var(--surface-2); color: var(--text-faint); font-size: 8px; font-style: normal; font-weight: 700; }
.lock-dow__day--on { background: var(--bulk); color: #fff; }
</style>
