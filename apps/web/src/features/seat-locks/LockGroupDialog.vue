<script setup lang="ts">
import { computed } from 'vue';

import LaDialog from '@/components/LaDialog.vue';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { DOW_TH, groupStats, groupSubGroups, held, holderName, isHolding, lockStatus, lockTree, releaseCountdown, releaseRuleLabel, routeName, type LockRow, type LockTarget } from './model';

// A bulk lock (legacy's manage modal for a `bulk` lock): its rule, and every departure it made, each
// with what it holds and when it lets go. A departure opens its own detail, where its sub-groups and
// vouchers are; changes made there apply to that day only.
const props = defineProps<{ id: string; canEdit: boolean }>();
const emit = defineEmits<{ close: []; day: [id: string]; add: [t: LockTarget]; release: [t: LockTarget]; sub: [t: LockTarget] }>();
const store = useSeatLocksStore();

const row = computed(() => store.rows.find((r): r is Extract<LockRow, { kind: 'group' }> => r.kind === 'group' && r.key === props.id)!);
const g = computed(() => row.value.group);
const stats = computed(() => groupStats(row.value, store.today));
const subs = computed(() => groupSubGroups(row.value.kids));
const live = computed(() => props.canEdit && row.value.days.some((d) => d.status === 'active'));
const weekdays = computed(() => (g.value.weekdays.length ? g.value.weekdays.map((d) => DOW_TH[d]).join(' · ') : 'ทุกวัน'));
const t: LockTarget = { kind: 'group', id: props.id };
</script>

<template>
  <LaDialog eyebrow="Bulk seat lock" :title="holderName(g, store.lookup)"
    :sub="`${routeName(g.route_id, store.lookup)} · ${g.date_from} → ${g.date_to} · ${weekdays}`" width="520px" @close="emit('close')">
    <div class="lock-bulk">
      <div class="lock-bulk__figures">
        <div><div class="lock-bulk__k">กันไว้/รอบ</div><div class="lock-bulk__v lock-bulk__v--lock">{{ g.pax }}</div></div>
        <div><div class="lock-bulk__k">ดึงไปสะสม</div><div class="lock-bulk__v">{{ stats.used }}</div></div>
        <div><div class="lock-bulk__k">รอบ</div><div class="lock-bulk__v">{{ stats.past }}/{{ stats.total }}</div></div>
        <div class="lock-bulk__rule">{{ releaseRuleLabel(g) || 'ไม่มีเวลาปล่อยคืน' }}</div>
      </div>
      <div v-if="subs.length" class="lock-bulk__subs">
        <span v-for="s in subs" :key="s.name" class="chip chip--bulk">{{ s.name }} · {{ s.pax }}/รอบ · ใช้ {{ s.used }}</span>
      </div>
      <table class="lock-bulk__days">
        <thead><tr><th>วันที่</th><th>กันไว้</th><th>ใช้</th><th>เหลือ</th><th>ปล่อยคืน</th><th /></tr></thead>
        <tbody>
          <tr v-for="d in row.days" :key="d.id" :class="{ 'lock-bulk__off': lockStatus(d, store.kidsOf(d.id)) === 'released' }">
            <td class="lock-bulk__date">{{ d.service_date }}</td>
            <td>{{ d.pax }}</td>
            <td>{{ lockTree(d, store.kidsOf(d.id)).used }}</td>
            <td>{{ isHolding(d) ? held(d, store.kidsOf(d.id)) : '—' }}</td>
            <td><span class="lock-release" :class="`lock-release--${releaseCountdown(d.release_at, store.now).tone}`">{{ d.status === 'released' ? 'released' : releaseCountdown(d.release_at, store.now).text }}</span></td>
            <td><button type="button" class="btn btn--sm" @click="emit('day', d.id)">เปิด</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #foot>
      <template v-if="live">
        <button type="button" class="btn btn--ok-solid" @click="emit('add', t)">+ เพิ่มที่นั่งทุกรอบ</button>
        <button v-if="store.bulkReady" type="button" class="btn lock-bulk__sub" @click="emit('sub', t)">+ กรุ๊ปย่อย</button>
        <button type="button" class="btn btn--danger" @click="emit('release', t)">คืน</button>
      </template>
      <button type="button" class="btn lock-bulk__close" @click="emit('close')">ปิด</button>
    </template>
  </LaDialog>
</template>

<style scoped>
.lock-bulk { display: flex; flex-direction: column; gap: 12px; font-size: 12px; }
.lock-bulk__figures { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 18px; font-variant-numeric: tabular-nums; }
.lock-bulk__k { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.lock-bulk__v { font-size: 20px; font-weight: 700; }
.lock-bulk__v--lock { color: var(--lock); }
.lock-bulk__rule { margin-left: auto; font-size: 11px; color: var(--ok); }
.lock-bulk__subs { display: flex; flex-wrap: wrap; gap: 5px; }
.lock-bulk__days { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.lock-bulk__days th { padding: 5px 8px; border-bottom: 1px solid var(--border); color: var(--text-faint); font-size: 9.5px; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 0.06em; }
.lock-bulk__days td { padding: 5px 8px; border-bottom: 1px solid var(--border); }
.lock-bulk__date { font-family: var(--font-mono); }
.lock-bulk__off { opacity: 0.55; }
.lock-bulk__sub { color: #fff; background: var(--bulk); border-color: var(--bulk); }
.lock-bulk__close { margin-left: auto; }
</style>
