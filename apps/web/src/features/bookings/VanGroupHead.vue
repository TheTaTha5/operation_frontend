<script setup lang="ts">
import { computed } from 'vue';

import type { VanGroupView } from './vanMode';

// A van group's header row in van mode (legacy _grpHeaderRow, booking.js:8849-8893), or the
// "not yet assigned" header (booking.js:9075) when `group` is null. Read-only: the van / time /
// return / driver controls show the saved values and stay disabled until the backend can save them.
const props = defineProps<{ group: VanGroupView | null; colspan: number; unassignedN?: number; unassignedPax?: number }>();

const g = computed(() => props.group?.group);
const NOT_MOVED = 'Not moved yet · edit vans on the legacy page';
const roundWarn = computed(() => (g.value?.round_warning === 'no_time' ? 'ยังไม่ตั้งเวลารอบ' : g.value?.round_warning === 'same_time' ? 'เวลาชนกับรอบก่อน' : ''));
</script>

<template>
  <tr v-if="!group" class="van-group-row"><td :colspan="colspan" class="van-unassigned-head">
    <div class="van-group-head__line">&#9888; ยังไม่ assign &middot; {{ unassignedN }} booking &middot; {{ unassignedPax }} pax &mdash; จับเข้ากลุ่ม/เลือกรถ</div>
  </td></tr>
  <tr v-else class="van-group-row"><td :colspan="colspan" class="van-group-head"
      :class="{ 'van-group-head--novan': !group.van, 'van-group-head--round2': (g!.round?.no || 1) > 1 }"
      :style="{ '--vg-bg': group.colors[0], '--vg-ink': group.colors[1] }">
    <div class="van-group-head__line">
      <span class="van-group-head__title">&#128656; กรุ๊ป {{ g!.number }}<template v-if="!group.van"> &middot; &#9888; ยังไม่เลือกรถ</template></span>
      <span v-if="g!.round" class="van-group-head__round" :title="`This van runs this programme ${g!.round.of} times today · this is round ${g!.round.no}`">&#8635; รอบ {{ g!.round.no }} / {{ g!.round.of }}{{ g!.round.time ? ' · ' + g!.round.time : '' }}</span>
      <span v-if="roundWarn" class="van-group-head__round van-group-head__round--warn" title="One van cannot be in two places at once: give each round its own pickup time">&#9888; {{ roundWarn }}</span>
      <span class="van-group-head__pax">{{ group.rows.length }} booking &middot; <b :class="{ 'van-group-head__pax--over': g!.over_capacity }">{{ g!.pax }}{{ g!.capacity ? '/' + g!.capacity : '' }} pax</b></span>
      <select class="van-group-head__van" disabled :title="NOT_MOVED" aria-label="Van">
        <option>{{ group.van ? `${group.van.name}${group.van.capacity ? ' · ' + group.van.capacity + ' ที่นั่ง' : ''}${group.van.plate ? ' · ' + group.van.plate : ''}` : '— เลือกรถ (ทีหลังได้) —' }}</option>
      </select>
      <input class="van-group-head__time" disabled :value="g!.pickup_time || ''" placeholder="ตั้งเวลาทั้งกรุ๊ป" :title="NOT_MOVED" aria-label="Group pickup time" />
      <select class="van-group-head__ret" :class="{ on: !!group.returnVan }" disabled :title="NOT_MOVED" aria-label="Return van">
        <option>{{ group.returnVan ? 'กลับ: ' + group.returnVan.name : 'รถกลับ: เหมือนเดิม' }}</option>
      </select>
      <span v-if="group.van && (group.van.driver || group.van.driver_phone)" class="van-group-head__driver" :title="group.van.driver_overridden ? 'Driver set for today' : 'Van default driver'">
        &#128100; {{ group.van.driver || '—' }}<a v-if="group.van.driver_phone" :href="`tel:${group.van.driver_phone}`">&#128222; {{ group.van.driver_phone }}</a><template v-if="group.van.driver_overridden"> &#128204;</template>
      </span>
    </div>
  </td></tr>
</template>

<style scoped>
/* Legacy inline styles of the van-mode group header (booking.js:8879-8894) and the unassigned
   header (booking.js:9075). `--vg-bg` / `--vg-ink` are the van's chip pair (vanChipPair). */
.van-group-head { background: var(--vg-bg); box-shadow: inset 4px 0 0 var(--vg-ink); padding: 6px 12px; border-bottom: 1px solid #DCE1E8; }
.van-group-head--round2 { background: color-mix(in srgb, var(--vg-ink) 4.5%, #fff); border-top: 1px dashed color-mix(in srgb, var(--vg-ink) 53%, transparent); }
.van-group-head--novan { background: var(--van-missing-soft); box-shadow: inset 4px 0 0 #D64545; border: 2px solid var(--van-missing); border-bottom: 0; }
/* The td is this component's, so ByTripView's scoped cell rules do not reach it: pin the content
   left like its `td[colspan] > div` rule does. */
.van-group-head__line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; position: sticky; left: 0; width: max-content; max-width: 100%; }
.van-group-head__title { font-weight: 700; font-size: 12px; color: var(--vg-ink); }
.van-group-head--novan .van-group-head__title { color: #C0392B; }
.van-group-head__round { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 2px 10px; font-size: 10.5px; font-weight: 800; white-space: nowrap; background: var(--vg-ink); color: #fff; }
.van-group-head--round2 .van-group-head__round { background: #fff; color: var(--vg-ink); border: 1.5px solid var(--vg-ink); }
.van-group-head__round--warn, .van-group-head--round2 .van-group-head__round--warn { background: #FCEBEB; color: #A32D2D; border: 1px solid #E6C9C3; }
.van-group-head__pax { font-size: 11px; color: #6a6a64; }
.van-group-head__pax b { color: var(--vg-ink); }
.van-group-head__pax b.van-group-head__pax--over { color: #A32D2D; }
.van-group-head__van, .van-group-head__ret, .van-group-head__time { border: 1px solid #ddd; border-radius: 6px; padding: 3px 7px; font-size: 11px; font-family: inherit; background: #fff; cursor: not-allowed; }
.van-group-head__van { border-color: #9FE1CB; font-weight: 700; color: var(--ink); }
.van-group-head--novan .van-group-head__van { border-color: #E6C9C3; font-weight: 400; }
.van-group-head__time { font-family: 'DM Mono', monospace; width: 108px; color: var(--ink); }
.van-group-head__ret { color: #888; }
.van-group-head__ret.on { border-color: #C7B8E8; color: var(--van-ret); }
.van-group-head__driver { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #5a6b62; }
.van-group-head__driver a { color: var(--sel); text-decoration: none; font-family: 'DM Mono', monospace; font-weight: 700; }
.van-unassigned-head { background: #FFF7E6; box-shadow: inset 4px 0 0 #E6A23C; padding: 6px 12px; border-bottom: 1px solid #DCE1E8; font-size: 11.5px; font-weight: 700; color: #9A6B00; }
</style>
