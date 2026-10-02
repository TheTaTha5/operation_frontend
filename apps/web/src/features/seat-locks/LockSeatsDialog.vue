<script setup lang="ts">
import { computed, ref } from 'vue';

import LaDialog from '@/components/LaDialog.vue';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { drawn, giveBackMax, holderName, lockTree, releasePlan, routeName, type LockTarget } from './model';

// Add seats (legacy bkV2LockAddModal, booking.js:1050) or give seats back (the release modal in
// bkV2LockOverlays, booking.js:1094), for one lock, a sub-group, or every departure of a bulk lock.
// The legacy add note isn't kept: the backend has no lock history yet (draft D).
const props = defineProps<{ target: LockTarget; mode: 'add' | 'release' }>();
const emit = defineEmits<{ close: [] }>();
const store = useSeatLocksStore();

const lock = computed(() => (props.target.kind === 'lock' ? store.byId(props.target.id) : undefined));
const group = computed(() => (props.target.kind === 'group' ? store.groupById(props.target.id) : undefined));
const parent = computed(() => (lock.value?.parent_id ? store.byId(lock.value.parent_id) : undefined));
const kids = computed(() => (lock.value ? store.kidsOf(lock.value.id) : []));
const pax = computed(() => lock.value?.pax ?? group.value?.pax ?? 0);
/** Seats that can go back: a parent only those in no sub-group; a bulk lock its seats per departure. */
const max = computed(() => (lock.value ? giveBackMax(lock.value, kids.value) : group.value?.pax ?? 0));
const plan = computed(() => (lock.value && props.mode === 'release' ? releasePlan(lock.value, n.value, kids.value) : null));
const keeps = computed(() => (lock.value ? lockTree(lock.value, kids.value).floor : 0));

const n = ref<number>(props.mode === 'add' ? 5 : max.value);
const error = ref('');
const saving = ref(false);
const valid = computed(() => Number.isInteger(n.value) && n.value > 0 && (props.mode === 'add' || n.value <= max.value));
const owner = computed(() => lock.value ?? group.value);
const when = computed(() => (lock.value ? lock.value.service_date : group.value ? `${group.value.date_from} → ${group.value.date_to}` : ''));

function set(v: number) {
  n.value = Math.max(0, Math.min(max.value, Math.floor(Number(v) || 0)));
}

async function submit() {
  if (!valid.value) { error.value = props.mode === 'add' ? 'ใส่จำนวนที่จะเพิ่ม' : 'Choose how many seats to release'; return; }
  error.value = '';
  saving.value = true;
  try {
    const { kind, id } = props.target;
    if (props.mode === 'add') await (kind === 'group' ? store.addGroupSeats(id, n.value) : store.addSeats(id, n.value));
    else await (kind === 'group' ? store.giveBackGroup(id, n.value) : store.giveBack(id, n.value));
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <LaDialog v-if="mode === 'add'" eyebrow="Add seats" tone="ok" :title="group ? 'เพิ่มที่นั่งทุกรอบของ Bulk นี้' : 'เพิ่มที่นั่งในล็อกนี้'" width="430px" @close="emit('close')">
    <form v-if="owner" id="lock-seats" class="lock-seats" @submit.prevent="submit">
      <div class="lock-seats__summary">
        <b>{{ routeName(owner.route_id, store.lookup) }}<template v-if="lock?.sub_name"> · {{ lock.sub_name }}</template></b>
        <div>{{ holderName(owner, store.lookup) }} · {{ when }}</div>
        <div v-if="lock">ตอนนี้ <b class="lock-seats__num">{{ lock.pax }}</b> ที่ · ใช้ไป {{ drawn(lock) }} ที่</div>
        <div v-else>ตอนนี้ <b class="lock-seats__num">{{ pax }}</b> ที่ต่อรอบ</div>
      </div>
      <div class="lock-seats__row">
        <label class="field lock-seats__add">
          <span class="field__label">เพิ่มอีก</span>
          <input v-model.number="n" type="number" min="1" class="field__input">
        </label>
        <div class="field lock-seats__total">
          <span class="field__label">รวมเป็น</span>
          <div class="field__input field__input--value lock-seats__total-value">{{ pax + (valid ? n : 0) }} ที่{{ group ? 'ต่อรอบ' : '' }}</div>
        </div>
      </div>
      <div class="callout">
        <template v-if="parent">กรุ๊ปย่อยเพิ่มได้ไม่เกินที่ล็อกแม่ยังไม่ได้แบ่ง ({{ lockTree(parent, store.kidsOf(parent.id)).unallocated }} ที่)</template>
        <template v-else-if="group">ทุกรอบที่ยังไม่ปล่อยจะได้เพิ่ม · รอบที่ที่นั่งไม่พอจะถูกข้ามและแจ้งให้ทราบ</template>
        <template v-else>เพิ่มแล้วที่นั่งจะถูกกันออกจาก pool ที่ขายได้ทันที</template>
      </div>
      <div v-if="error" class="callout callout--danger" role="alert">{{ error }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn" @click="emit('close')">ยกเลิก</button>
      <button type="submit" form="lock-seats" class="btn btn--ok-solid" :disabled="saving">เพิ่มที่นั่ง</button>
    </template>
  </LaDialog>

  <LaDialog v-else eyebrow="Release seats" :title="group ? 'Give seats back on every departure' : 'Return held seats to pool'" width="380px" @close="emit('close')">
    <form id="lock-seats" class="lock-seats" @submit.prevent="submit">
      <div class="lock-seats__lead">
        <template v-if="group">This bulk lock holds <b>{{ max }}</b> seat(s) per departure · choose how many to give back.</template>
        <template v-else>This {{ lock?.parent_id ? 'sub-group' : 'lock' }} holds <b>{{ max }}</b> seat(s){{ kids.length ? ' not in a sub-group' : '' }} · choose how many to release.</template>
      </div>
      <div class="lock-seats__row">
        <span class="stepper">
          <button type="button" class="stepper__btn" aria-label="One fewer" :disabled="n <= 0" @click="set(n - 1)">&minus;</button>
          <input :value="n" type="number" min="0" :max="max" class="stepper__input" aria-label="Seats to release" @change="set(Number(($event.target as HTMLInputElement).value))">
          <button type="button" class="stepper__btn" aria-label="One more" :disabled="n >= max" @click="set(n + 1)">+</button>
        </span>
        <button type="button" class="btn btn--sm lock-seats__all" @click="set(max)">All {{ max }}</button>
      </div>
      <div v-if="lock && plan && plan.kind === 'amend' && n === max" class="callout">
        Bookings{{ kids.length ? ' and sub-groups' : '' }} still take {{ keeps }} seat(s), so the {{ lock.parent_id ? 'sub-group' : 'lock' }} stays at {{ keeps }} with nothing left to sell.
      </div>
      <div v-if="lock?.parent_id" class="callout">A sub-group gives its seats back to its parent lock, not to the pool.</div>
      <div v-if="group && n === max" class="callout">Every departure of this bulk lock is released. Seats bookings drew stay with them.</div>
      <div v-else-if="group" class="callout">Departures where bookings or sub-groups take more than {{ max - n }} seat(s) are skipped and listed.</div>
      <div v-if="error" class="callout callout--danger" role="alert">{{ error }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button type="submit" form="lock-seats" class="btn btn--danger-solid" :disabled="saving || !valid">Release {{ n }}</button>
    </template>
  </LaDialog>
</template>

<style scoped>
.lock-seats { display: flex; flex-direction: column; gap: 13px; }
.lock-seats__summary { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); font-size: 11.5px; color: var(--muted); line-height: 1.6; }
.lock-seats__summary > b { font-size: 12.5px; color: var(--text); }
.lock-seats__num { font-family: var(--font-mono); color: var(--text); }
.lock-seats__row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.lock-seats__add { flex: 0 1 130px; }
.lock-seats__total { flex: 1 1 150px; }
.lock-seats__total-value { color: var(--ok); background: var(--ok-bg); border-color: var(--ok-line); }
.lock-seats__lead { font-size: 12px; color: var(--muted); }
.lock-seats__lead b { color: var(--text); }
.lock-seats__all { margin-left: auto; color: var(--lock); background: var(--lock-bg); border-color: var(--lock-line); }
</style>
