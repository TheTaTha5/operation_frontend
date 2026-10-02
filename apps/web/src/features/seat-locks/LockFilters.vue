<script setup lang="ts">
import { computed } from 'vue';

import { useSeatLocksStore } from '@/stores/seatLocks';

import type { GroupBy, LockFilters } from './model';

// The filter bar (legacy booking.js:775-785). Legacy's scope select (day / bulk) is left out: every
// lock in operation-backend is a day lock until bulk locks land (spec draft A).
const store = useSeatLocksStore();
const routes = computed(() => [...store.routes].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)));
const STATUS: [LockFilters['status'], string][] = [['active', 'ใช้งานอยู่'], ['all', 'ทั้งหมด']];
const GROUP: [GroupBy, string][] = [['holder', 'เอเจ้น'], ['route', 'เส้นทาง'], ['none', 'ไม่จัด']];
</script>

<template>
  <div class="lock-filters">
    <input v-model="store.filters.q" type="search" class="field__input lock-filters__search" placeholder="ค้นหา เส้นทาง / เอเจ้น…" aria-label="Search">
    <select v-model="store.filters.routeId" class="field__input lock-filters__select" aria-label="Route">
      <option value="">ทุกเส้นทาง</option>
      <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name }}</option>
    </select>
    <select v-model="store.filters.holder" class="field__input lock-filters__select" aria-label="Holder">
      <option value="">ทุกผู้ถือ</option>
      <option v-for="h in store.holders" :key="h.key" :value="h.key">{{ h.name }}</option>
    </select>
    <span class="lock-filters__label">สถานะ</span>
    <span class="seg" role="group" aria-label="Status">
      <button v-for="[v, t] in STATUS" :key="v" type="button" class="seg__btn" :class="{ 'seg__btn--on': store.filters.status === v }"
        :aria-pressed="store.filters.status === v" @click="store.filters.status = v">{{ t }}</button>
    </span>
    <span class="lock-filters__label">จัดกลุ่ม</span>
    <span class="seg" role="group" aria-label="Group by">
      <button v-for="[v, t] in GROUP" :key="v" type="button" class="seg__btn" :class="{ 'seg__btn--on': store.filters.groupBy === v }"
        :aria-pressed="store.filters.groupBy === v" @click="store.filters.groupBy = v">{{ t }}</button>
    </span>
    <span class="lock-filters__count">{{ store.filtered.length }} รายการ</span>
  </div>
</template>

<style scoped>
.lock-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.lock-filters .field__input { width: auto; min-height: 30px; padding: 4px 9px; font-size: 12px; border-radius: 8px; }
.lock-filters__search { flex: 0 1 210px; min-width: 150px; }
.lock-filters__select { max-width: 220px; }
.lock-filters__label { margin-left: 6px; font-size: 10.5px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; }
.lock-filters__count { margin-left: auto; font-size: 11.5px; color: var(--muted); }
@media (max-width: 640px) {
  .lock-filters__search, .lock-filters__select { flex: 1 1 100%; max-width: none; }
  .lock-filters__label { margin-left: 0; }
}
</style>
