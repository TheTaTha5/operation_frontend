<script setup lang="ts">
import { computed, ref } from 'vue';

import LaDialog from '@/components/LaDialog.vue';
import { addDays } from '@/lib/date';
import { useSeatLocksStore } from '@/stores/seatLocks';

import { DOW_TH } from './model';

// "+ ล็อกที่นั่ง" (legacy bkV2RenderLockModal + bkV2LockFormFields + bkV2LockCreateSubmit,
// booking.js:392-512). A day lock, or a bulk lock over a date range on chosen weekdays with a
// release rule. Office and global holds both become a lock with no agent. Legacy's note and day-lock
// expiry date need lock history (draft D) and are not here.
const emit = defineEmits<{ close: [] }>();
const store = useSeatLocksStore();

const scope = ref<'day' | 'bulk'>('day');
const routeId = ref('');
const date = ref(addDays(store.today, 1));
const dateFrom = ref(addDays(store.today, 1));
const dateTo = ref('');
const weekdays = ref<number[]>([]);
const releaseDays = ref<number | ''>(1);
const releaseTime = ref('18:00');
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
const hasRule = computed(() => releaseDays.value !== '' && !!releaseTime.value);

function toggleDay(i: number) {
  weekdays.value = weekdays.value.includes(i) ? weekdays.value.filter((d) => d !== i) : [...weekdays.value, i].sort();
}

// The plain-language summary legacy shows so nobody reads a bulk lock as one total quota.
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dmy = (ds: string) => { if (!ds) return '—'; const [y, m, d] = ds.split('-'); return `${Number(d)} ${TH_MONTHS[Number(m) - 1] ?? ''} ${y}`; };
const summary = computed(() => {
  if (scope.value === 'day') return 'กันที่นั่งไว้เฉพาะรอบของวันนั้นวันเดียว';
  const days = weekdays.value.length ? weekdays.value.map((i) => DOW_TH[i]).join(' · ') : 'ทุกวัน';
  const rule = hasRule.value ? `ที่นั่งของแต่ละรอบจะปล่อยคืนเข้า pool อัตโนมัติ ${releaseDays.value} วันก่อนเดินทาง เวลา ${releaseTime.value}` : 'ไม่ปล่อยคืนอัตโนมัติ';
  return `กันไว้ ${qty.value || '—'} ที่ทุกรอบ ที่ออกระหว่าง ${dmy(dateFrom.value)} – ${dmy(dateTo.value || dateFrom.value)} เฉพาะวัน ${days} · จองวันไหนก็ตัดยอดเฉพาะวันนั้น · ${rule}`;
});

async function submit() {
  error.value = '';
  // The same checks, in the same order, as bkV2LockCreateSubmit.
  if (!routeId.value) { error.value = 'เลือกเส้นทางก่อน'; return; }
  if (scope.value === 'bulk') {
    if (!dateFrom.value) { error.value = 'เลือกวันเริ่มของช่วง'; return; }
    if (dateTo.value && dateTo.value < dateFrom.value) { error.value = 'วันจบต้องไม่ก่อนวันเริ่ม'; return; }
  } else if (!date.value) { error.value = 'เลือกวันที่'; return; }
  if (!(Number(qty.value) > 0)) { error.value = 'ใส่จำนวนที่นั่งที่จะกันไว้'; return; }
  if (holder.value === 'agent' && !agent.value) { error.value = agentName.value.trim() ? 'ไม่พบเอเจ้นนี้ · เลือกจากรายการ' : 'ใส่ชื่อเอเจ้นที่ถือล็อก'; return; }
  const who = holder.value === 'agent' ? { agent_id: agent.value!.id } : {};
  saving.value = true;
  try {
    if (scope.value === 'bulk') {
      await store.createGroup({
        route_id: routeId.value, date_from: dateFrom.value, date_to: dateTo.value || dateFrom.value, weekdays: weekdays.value, pax: Number(qty.value), ...who,
        ...(hasRule.value ? { release_days_before: Number(releaseDays.value), release_time: releaseTime.value } : {}),
      });
    } else {
      await store.create({ route_id: routeId.value, service_date: date.value, pax: Number(qty.value), ...who });
    }
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <LaDialog eyebrow="Lock seats" :title="`กันที่นั่งไว้ก่อน${scope === 'day' && date ? ` · ${date}` : ''}`" width="680px" @close="emit('close')">
    <form id="lock-create" class="lock-form" @submit.prevent="submit">
      <div class="lock-form__scope">
        <span class="lock-form__scope-label">แบบ</span>
        <span class="seg" role="group" aria-label="Lock type">
          <button type="button" class="seg__btn" :class="{ 'seg__btn--on': scope === 'day' }" :aria-pressed="scope === 'day'" @click="scope = 'day'">รายวัน · วันเดียว</button>
          <button type="button" class="seg__btn" :class="{ 'seg__btn--on': scope === 'bulk' }" :aria-pressed="scope === 'bulk'" :disabled="!store.bulkReady"
            :title="store.bulkReady ? '' : 'operation-backend does not serve bulk locks yet'" @click="scope = 'bulk'">Bulk · ช่วงวันที่</button>
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
        <label v-if="scope === 'day'" class="field lock-form__date">
          <span class="field__label">วันที่</span>
          <input v-model="date" type="date" class="field__input" :min="store.today">
        </label>
        <div v-else class="field lock-form__range">
          <span class="field__label">ช่วงวันที่</span>
          <span class="lock-form__range-inputs">
            <input v-model="dateFrom" type="date" class="field__input" :min="store.today" aria-label="From">
            <span class="lock-form__arrow">&rarr;</span>
            <input v-model="dateTo" type="date" class="field__input" :min="dateFrom" aria-label="To">
          </span>
        </div>
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
      </div>
      <div v-if="scope === 'bulk'" class="field">
        <span class="field__label">วันในสัปดาห์ <span class="field__hint">· ไม่ติ๊ก = ทุกวัน</span></span>
        <span class="lock-form__dow" role="group" aria-label="Weekdays">
          <button v-for="(d, i) in DOW_TH" :key="i" type="button" class="lock-form__dow-day" :class="{ 'lock-form__dow-day--on': weekdays.includes(i) }"
            :aria-pressed="weekdays.includes(i)" @click="toggleDay(i)">{{ d }}</button>
        </span>
      </div>
      <div class="lock-form__row">
        <label class="field lock-form__qty">
          <span class="field__label">{{ scope === 'bulk' ? 'ที่นั่งต่อรอบ' : 'ที่นั่ง' }}</span>
          <input v-model.number="qty" type="number" min="1" class="field__input" placeholder="เช่น 10">
        </label>
        <div v-if="scope === 'bulk'" class="field lock-form__release">
          <span class="field__label">ปล่อยคืน <span class="field__hint">· ก่อนวันเดินทางแต่ละรอบ · เว้นว่าง = ไม่ปล่อยเอง</span></span>
          <span class="lock-form__release-inputs">
            <input v-model.number="releaseDays" type="number" min="0" class="field__input lock-form__release-days" aria-label="Days before">
            <span class="lock-form__release-text">วันก่อน เวลา</span>
            <input v-model="releaseTime" type="time" class="field__input lock-form__release-time" aria-label="Time">
          </span>
        </div>
      </div>
      <div class="callout">{{ summary }}</div>
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
.lock-form__range { flex: 1 1 300px; }
.lock-form__range-inputs, .lock-form__release-inputs { display: flex; align-items: center; gap: 7px; }
.lock-form__arrow, .lock-form__release-text { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
.lock-form__holder { flex: 1 1 150px; }
.lock-form__agent { flex: 1 1 180px; }
.lock-form__qty { flex: 0 1 140px; }
.lock-form__release { flex: 1 1 260px; }
.lock-form__release-days { width: 70px; }
.lock-form__release-time { width: 120px; }
.lock-form__dow { display: flex; flex-wrap: wrap; gap: 5px; }
.lock-form__dow-day { width: 40px; height: 32px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--muted); font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.lock-form__dow-day--on { border-color: var(--bulk); background: var(--bulk); color: #fff; }
</style>
