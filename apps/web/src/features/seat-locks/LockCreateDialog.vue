<script setup lang="ts">
import { computed, ref } from 'vue';

import LaDialog from '@/components/LaDialog.vue';
import { addDays } from '@/lib/date';
import { useSeatLocksStore } from '@/stores/seatLocks';

// "+ ล็อกที่นั่ง" (legacy bkV2RenderLockModal + bkV2LockFormFields + bkV2LockCreateSubmit,
// booking.js:392-512). Day locks only: bulk ranges, the expiry date and the note need backend
// drafts A, C and D. Office and global holds both become a lock with no agent.
const emit = defineEmits<{ close: [] }>();
const store = useSeatLocksStore();

const routeId = ref('');
const date = ref(addDays(store.today, 1));
const holder = ref<'agent' | 'none'>('agent');
const agentName = ref('');
const qty = ref<number | ''>('');
const error = ref('');
const saving = ref(false);

const routes = computed(() => [...store.routes].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)));
const agents = computed(() => store.agents.filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name)));
/** Typed name or code → the agent. Legacy kept unmatched text as the holder id; the backend needs a real agent. */
const agent = computed(() => {
  const t = agentName.value.trim().toLowerCase();
  return t ? agents.value.find((a) => a.name.toLowerCase() === t || a.code.toLowerCase() === t) : undefined;
});

async function submit() {
  error.value = '';
  // The same checks, in the same order, as bkV2LockCreateSubmit.
  if (!routeId.value) { error.value = 'เลือกเส้นทางก่อน'; return; }
  if (!date.value) { error.value = 'เลือกวันที่'; return; }
  if (!(Number(qty.value) > 0)) { error.value = 'ใส่จำนวนที่นั่งที่จะกันไว้'; return; }
  if (holder.value === 'agent' && !agent.value) { error.value = agentName.value.trim() ? 'ไม่พบเอเจ้นนี้ · เลือกจากรายการ' : 'ใส่ชื่อเอเจ้นที่ถือล็อก'; return; }
  saving.value = true;
  try {
    await store.create({ route_id: routeId.value, service_date: date.value, pax: Number(qty.value), ...(holder.value === 'agent' ? { agent_id: agent.value!.id } : {}) });
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <LaDialog eyebrow="Lock seats" :title="`กันที่นั่งไว้ก่อน${date ? ` · ${date}` : ''}`" width="640px" @close="emit('close')">
    <form id="lock-create" class="lock-form" @submit.prevent="submit">
      <div class="lock-form__scope">
        <span class="lock-form__scope-label">แบบ</span>
        <span class="seg" role="group" aria-label="Lock type">
          <button type="button" class="seg__btn seg__btn--on" aria-pressed="true">รายวัน · วันเดียว</button>
          <button type="button" class="seg__btn" disabled title="Coming in phase 2: needs range locks in operation-backend">Bulk · ช่วงวันที่</button>
        </span>
      </div>
      <div class="lock-form__row">
        <label class="field lock-form__route">
          <span class="field__label">เส้นทาง</span>
          <select v-model="routeId" class="field__input">
            <option value="">— เลือกเส้นทาง —</option>
            <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </label>
        <label class="field lock-form__date">
          <span class="field__label">วันที่</span>
          <input v-model="date" type="date" class="field__input" :min="store.today">
        </label>
      </div>
      <div class="lock-form__row">
        <label class="field lock-form__holder">
          <span class="field__label">ผู้ถือ</span>
          <select v-model="holder" class="field__input">
            <option value="agent">Agent</option>
            <option value="none">Office / pool (ไม่ระบุเอเจ้น)</option>
          </select>
        </label>
        <label v-if="holder === 'agent'" class="field lock-form__agent">
          <span class="field__label">Agent</span>
          <input v-model="agentName" class="field__input" list="lock-create-agents" placeholder="พิมพ์ชื่อเอเจ้น…" autocomplete="off">
          <datalist id="lock-create-agents">
            <option v-for="a in agents" :key="a.id" :value="a.name">{{ a.code }}</option>
          </datalist>
        </label>
        <label class="field lock-form__qty">
          <span class="field__label">ที่นั่ง</span>
          <input v-model.number="qty" type="number" min="1" class="field__input" placeholder="เช่น 10">
        </label>
      </div>
      <div class="callout">กันที่นั่งไว้เฉพาะรอบของวันนั้นวันเดียว · โน้ตและวันหมดอายุยังไม่มีในระบบใหม่</div>
      <div v-if="error" class="callout callout--danger" role="alert">{{ error }}</div>
    </form>
    <template #foot>
      <button type="button" class="btn" @click="emit('close')">ยกเลิก</button>
      <button type="submit" form="lock-create" class="btn btn--lock" :disabled="saving">{{ saving ? 'กำลังสร้าง…' : 'สร้างล็อก' }}</button>
    </template>
  </LaDialog>
</template>

<style scoped>
.lock-form { display: flex; flex-direction: column; gap: 13px; }
.lock-form__scope { display: flex; align-items: center; gap: 9px; }
.lock-form__scope-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.lock-form__row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.lock-form__route { flex: 2 1 210px; }
.lock-form__date { flex: 1 1 150px; }
.lock-form__holder { flex: 1 1 150px; }
.lock-form__agent { flex: 1 1 180px; }
.lock-form__qty { flex: 0 1 120px; }
</style>
