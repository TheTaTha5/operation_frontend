<script setup lang="ts">
import { computed } from 'vue';

import type { LockKpis } from './model';

// The four summary cards of the legacy Seat Locks tab (booking.js:673-686).
const props = defineProps<{ kpis: LockKpis }>();
const sparkMax = computed(() => Math.max(1, ...props.kpis.spark));
</script>

<template>
  <div class="lock-kpis">
    <div class="lock-kpi lock-kpi--lock">
      <div class="lock-kpi__label">ล็อกที่ใช้งานอยู่</div>
      <div class="lock-kpi__value"><b>{{ kpis.active }}</b><span>รายการ</span></div>
      <div class="lock-kpi__foot"><span class="chip">รายวัน {{ kpis.active }}</span></div>
    </div>
    <div class="lock-kpi">
      <div class="lock-kpi__label">ที่นั่งกันไว้พรุ่งนี้</div>
      <div class="lock-kpi__value"><b>{{ kpis.tomorrow.held }}</b><span>ที่</span></div>
      <div class="lock-kpi__foot">
        <span>{{ kpis.tomorrow.locks }} ล็อก · {{ kpis.tomorrow.routes }} เส้นทาง</span>
        <div class="lock-kpi__spark" aria-label="Seats held, next 14 days">
          <i v-for="(v, i) in kpis.spark" :key="i" class="lock-kpi__bar" :class="{ 'lock-kpi__bar--empty': !v }"
            :style="{ '--h': Math.round((v / sparkMax) * 100) }" :title="`${v}`" />
        </div>
      </div>
    </div>
    <div class="lock-kpi lock-kpi--ok">
      <div class="lock-kpi__label">ดึงไปขายแล้ว</div>
      <div class="lock-kpi__value"><b>{{ kpis.drawn }}</b><span>ที่</span></div>
      <div class="lock-kpi__foot"><span>อัตราการใช้ <b>{{ kpis.conversion }}%</b> ของที่เสนอไปแล้ว</span></div>
    </div>
    <div class="lock-kpi lock-kpi--warn lock-kpi--off" title="Needs release cutoffs in operation-backend (spec draft C)">
      <div class="lock-kpi__label">ใกล้ปล่อยคืน · 48 ชม.</div>
      <div class="lock-kpi__value"><b>—</b><span>รอบ</span></div>
      <div class="lock-kpi__foot"><span>ยังไม่มีเวลาปล่อยคืนในระบบใหม่</span></div>
    </div>
  </div>
</template>

<style scoped>
.lock-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 9px; }
.lock-kpi { min-width: 0; padding: 11px 14px; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.lock-kpi--lock { background: linear-gradient(180deg, var(--lock-bg), var(--surface)); }
.lock-kpi--warn { background: linear-gradient(180deg, var(--warn-bg), var(--surface)); border-color: var(--warn-line); }
.lock-kpi--off { opacity: 0.6; }
.lock-kpi__label { font-size: 10px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.06em; }
.lock-kpi__value { display: flex; align-items: baseline; gap: 6px; margin-top: 5px; }
.lock-kpi__value b { font-family: var(--font-mono); font-size: 26px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
.lock-kpi__value span { font-size: 11.5px; color: var(--muted); }
.lock-kpi--lock .lock-kpi__value b { color: var(--lock); }
.lock-kpi--ok .lock-kpi__value b, .lock-kpi--ok .lock-kpi__foot b { color: var(--ok); }
.lock-kpi--warn .lock-kpi__value b { color: var(--warn); }
.lock-kpi__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 7px; font-size: 10.5px; color: var(--muted); }
.lock-kpi__spark { display: flex; align-items: flex-end; gap: 2px; width: 100%; height: 20px; margin-top: 4px; }
/* Legacy spark fill #E2B7B0 (booking.js:683) is a tint of the lock red. */
.lock-kpi__bar { flex: 1; min-height: 2px; height: calc(var(--h) * 1%); border-radius: 2px 2px 0 0; background: color-mix(in srgb, var(--lock) 40%, var(--surface)); }
.lock-kpi__bar--empty { background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border); }
</style>
