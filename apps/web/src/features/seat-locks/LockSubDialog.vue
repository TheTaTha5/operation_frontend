<script setup lang="ts">
import { computed, ref } from 'vue';

import LaDialog from '@/components/LaDialog.vue';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { holderName, isHolding, lockTree, routeName, type LockTarget } from './model';

// "+ ย่อย": a named sub-group carved out of a lock's seats (legacy bkV2SubOpen / bkV2CreateSubLock,
// booking.js:522-604), or the same sub-group on every departure of a bulk lock.
const props = defineProps<{ target: LockTarget }>();
const emit = defineEmits<{ close: [] }>();
const store = useSeatLocksStore();

const lock = computed(() => (props.target.kind === 'lock' ? store.byId(props.target.id) : undefined));
const group = computed(() => (props.target.kind === 'group' ? store.groupById(props.target.id) : undefined));
const owner = computed(() => lock.value ?? group.value);
/** Free seats per departure: one number for a lock, the smallest and largest across a bulk lock's days. */
const free = computed(() => {
  if (lock.value) { const f = lockTree(lock.value, store.kidsOf(lock.value.id)).unallocated; return { min: f, max: f }; }
  const days = store.locks.filter((l) => l.group_id === props.target.id && !l.parent_id && isHolding(l));
  const each = days.map((d) => lockTree(d, store.kidsOf(d.id)).unallocated);
  return { min: each.length ? Math.min(...each) : 0, max: each.length ? Math.max(...each) : 0 };
});
/** The next letter after the sub-groups already there, as legacy suggests A, B, C. */
const nextName = computed(() => {
  const taken = new Set((lock.value ? store.kidsOf(lock.value.id) : store.locks.filter((l) => l.group_id === props.target.id && l.parent_id)).map((k) => k.sub_name));
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !taken.has(c)) ?? '';
});

const name = ref(nextName.value);
const pax = ref<number | ''>('');
const error = ref('');
const saving = ref(false);

async function submit() {
  error.value = '';
  if (!name.value.trim()) { error.value = 'ใส่ชื่อกรุ๊ปย่อย'; return; }
  const n = Number(pax.value);
  if (!(Number.isInteger(n) && n > 0)) { error.value = 'Enter the number of seats for this sub-group'; return; }
  if (lock.value && n > free.value.max) { error.value = `เกินจำนวนที่เหลือแบ่งได้ (เหลือ ${free.value.max} ที่)`; return; }
  saving.value = true;
  try {
    const input = { sub_name: name.value.trim(), pax: n };
    await (props.target.kind === 'group' ? store.createGroupSubGroups(props.target.id, input) : store.createSubGroup(props.target.id, input));
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <LaDialog eyebrow="Sub-group" title="แบ่งกรุ๊ปย่อย" width="420px" @close="emit('close')">
    <form v-if="owner" id="lock-sub" class="lock-sub" @submit.prevent="submit">
      <div class="lock-sub__summary">
        <b>{{ routeName(owner.route_id, store.lookup) }}</b>
        <div>{{ holderName(owner, store.lookup) }} · {{ lock ? lock.service_date : `${group!.date_from} → ${group!.date_to}` }}</div>
        <div v-if="lock">ยังไม่ได้แบ่ง <b>{{ free.max }}</b> ที่</div>
        <div v-else>ยังไม่ได้แบ่ง <b>{{ free.min === free.max ? free.max : `${free.min}–${free.max}` }}</b> ที่ต่อรอบ</div>
      </div>
      <div class="lock-sub__row">
        <label class="field lock-sub__name">
          <span class="field__label">ชื่อกรุ๊ป</span>
          <input v-model="name" class="field__input" maxlength="40" placeholder="เช่น A">
        </label>
        <label class="field lock-sub__pax">
          <span class="field__label">ที่นั่ง{{ group ? 'ต่อรอบ' : '' }}</span>
          <input v-model.number="pax" type="number" min="1" class="field__input" placeholder="เช่น 5">
        </label>
      </div>
      <div class="callout">
        กรุ๊ปย่อยแบ่งจากที่นั่งของล็อกนี้ ไม่ได้กันเพิ่มจาก pool<template v-if="group"> · รอบที่ที่นั่งไม่พอจะถูกข้ามและแจ้งให้ทราบ</template>
      </div>
      <div v-if="error" class="callout callout--danger" role="alert">{{ error }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn" @click="emit('close')">ยกเลิก</button>
      <button type="submit" form="lock-sub" class="btn btn--lock" :disabled="saving">สร้างกรุ๊ปย่อย</button>
    </template>
  </LaDialog>
</template>

<style scoped>
.lock-sub { display: flex; flex-direction: column; gap: 13px; }
.lock-sub__summary { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); font-size: 11.5px; color: var(--muted); line-height: 1.6; }
.lock-sub__summary > b, .lock-sub__summary div b { color: var(--text); }
.lock-sub__row { display: flex; flex-wrap: wrap; gap: 12px; }
.lock-sub__name { flex: 1 1 160px; }
.lock-sub__pax { flex: 0 1 130px; }
</style>
