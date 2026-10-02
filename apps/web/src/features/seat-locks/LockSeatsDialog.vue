<script setup lang="ts">
import { computed, ref } from 'vue';

import LaDialog from '@/components/LaDialog.vue';
import type { ObSeatLock } from '@/lib/ob';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { drawn, held, holderName, releasePlan, routeName } from './model';

// Add seats to a lock (legacy bkV2LockAddModal, booking.js:1050) or give held seats back to the pool
// (the release modal in bkV2LockOverlays, booking.js:1094). The legacy add note isn't kept: the
// backend has no lock history yet (draft D).
const props = defineProps<{ lock: ObSeatLock; mode: 'add' | 'release' }>();
const emit = defineEmits<{ close: [] }>();
const store = useSeatLocksStore();

const max = computed(() => held(props.lock));
const n = ref<number>(props.mode === 'add' ? 5 : max.value);
const error = ref('');
const saving = ref(false);
const plan = computed(() => (props.mode === 'release' ? releasePlan(props.lock, n.value) : null));
const valid = computed(() => Number.isInteger(n.value) && n.value > 0 && (props.mode === 'add' || n.value <= max.value));

function set(v: number) {
  n.value = Math.max(0, Math.min(max.value, Math.floor(Number(v) || 0)));
}

async function submit() {
  if (!valid.value) { error.value = props.mode === 'add' ? 'ใส่จำนวนที่จะเพิ่ม' : 'Choose how many seats to release'; return; }
  error.value = '';
  saving.value = true;
  try {
    if (props.mode === 'add') await store.addSeats(props.lock.id, n.value);
    else await store.giveBack(props.lock.id, n.value);
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <LaDialog v-if="mode === 'add'" eyebrow="Add seats" tone="ok" title="เพิ่มที่นั่งในล็อกนี้" width="430px" @close="emit('close')">
    <form id="lock-seats" class="lock-seats" @submit.prevent="submit">
      <div class="lock-seats__summary">
        <b>{{ routeName(lock.route_id, store.lookup) }}</b>
        <div>{{ holderName(lock, store.lookup) }} · {{ lock.service_date }}</div>
        <div>ตอนนี้ <b class="lock-seats__num">{{ lock.pax }}</b> ที่ · เหลือ {{ max }} ที่</div>
      </div>
      <div class="lock-seats__row">
        <label class="field lock-seats__add">
          <span class="field__label">เพิ่มอีก</span>
          <input v-model.number="n" type="number" min="1" class="field__input">
        </label>
        <div class="field lock-seats__total">
          <span class="field__label">รวมเป็น</span>
          <div class="field__input field__input--value lock-seats__total-value">{{ lock.pax + (valid ? n : 0) }} ที่</div>
        </div>
      </div>
      <div class="callout">เพิ่มแล้วที่นั่งจะถูกกันออกจาก pool ที่ขายได้ทันที</div>
      <div v-if="error" class="callout callout--danger" role="alert">{{ error }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn" @click="emit('close')">ยกเลิก</button>
      <button type="submit" form="lock-seats" class="btn btn--ok-solid" :disabled="saving">เพิ่มที่นั่ง</button>
    </template>
  </LaDialog>

  <LaDialog v-else eyebrow="Release seats" title="Return held seats to pool" width="360px" @close="emit('close')">
    <form id="lock-seats" class="lock-seats" @submit.prevent="submit">
      <div class="lock-seats__lead">This lock holds <b>{{ max }}</b> seat(s) · choose how many to release.</div>
      <div class="lock-seats__row">
        <span class="stepper">
          <button type="button" class="stepper__btn" aria-label="One fewer" :disabled="n <= 0" @click="set(n - 1)">&minus;</button>
          <input :value="n" type="number" min="0" :max="max" class="stepper__input" aria-label="Seats to release" @change="set(Number(($event.target as HTMLInputElement).value))">
          <button type="button" class="stepper__btn" aria-label="One more" :disabled="n >= max" @click="set(n + 1)">+</button>
        </span>
        <button type="button" class="btn btn--sm lock-seats__all" @click="set(max)">All {{ max }}</button>
      </div>
      <div v-if="plan && plan.kind === 'amend' && n === max" class="callout">
        Bookings drew {{ drawn(lock) }} seat(s) from this lock, so it stays at {{ drawn(lock) }} with nothing left to sell.
      </div>
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
