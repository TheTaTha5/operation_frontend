<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useSeatLocksStore } from '@/stores/seatLocks';
import { useSessionStore } from '@/stores/session';

import BookingTabs from '../bookings/BookingTabs.vue';
import LockCreateDialog from './LockCreateDialog.vue';
import LockDayTable from './LockDayTable.vue';
import LockDetailDialog from './LockDetailDialog.vue';
import LockFilters from './LockFilters.vue';
import LockKpis from './LockKpis.vue';
import LockSeatsDialog from './LockSeatsDialog.vue';
import LockTable from './LockTable.vue';
import { canEditOperations } from './model';

// The Booking page's Seat Locks tab (legacy bkV2RenderLocks, booking.js:623), phase 1: day locks on
// operation-backend's /v1/seat-locks. Spec: apps/web/docs/porting/seat-locks.md.
const store = useSeatLocksStore();
const session = useSessionStore();
// Legacy saved nothing for a read-only user but still changed the screen; here the buttons are hidden.
const canEdit = computed(() => canEditOperations(session.me));

type Dialog = { kind: 'create' } | { kind: 'add' | 'release' | 'detail'; id: string } | null;
const dialog = ref<Dialog>(null);
const open = (kind: 'add' | 'release' | 'detail', id: string) => { dialog.value = { kind, id }; };
const dialogLock = computed(() => (dialog.value && dialog.value.kind !== 'create' ? store.byId(dialog.value.id) : undefined));

const meta = computed(() => (store.status === 'ready' ? `${store.kpis.active} active lock${store.kpis.active === 1 ? '' : 's'}` : ''));

onMounted(() => store.load());
</script>

<template>
  <section class="seat-locks">
    <BookingTabs active="locks" :meta="meta" />

    <div class="seat-locks__body">
      <header class="seat-locks__head">
        <div>
          <h1 class="seat-locks__title">Seat Locks</h1>
          <div class="seat-locks__sub">ที่นั่งที่กันไว้ก่อนขายเข้า pool รวม</div>
        </div>
        <button v-if="canEdit && store.status === 'ready'" type="button" class="btn btn--lock seat-locks__new" @click="dialog = { kind: 'create' }">+ ล็อกที่นั่ง</button>
      </header>

      <div v-if="store.status === 'error'" class="callout callout--danger" role="alert">
        <b>Could not load seat locks</b>{{ store.error }}
        <button type="button" class="btn btn--sm seat-locks__retry" @click="store.load(true)">Retry</button>
      </div>
      <div v-else-if="store.status !== 'ready'" class="seat-locks__loading">Loading seat locks…</div>
      <template v-else>
        <LockKpis :kpis="store.kpis" />
        <LockDayTable :date="store.day" :today="store.today" :offset="store.dayOffset" :locks="store.dayLocks" :lookup="store.lookup" :can-edit="canEdit"
          @shift="store.dayOffset += $event" @jump="store.dayOffset = $event" @add="open('add', $event)" @detail="open('detail', $event)" />
        <LockFilters />
        <LockTable :groups="store.groups" :group-by="store.filters.groupBy" :lookup="store.lookup" :can-edit="canEdit"
          @add="open('add', $event)" @release="open('release', $event)" @detail="open('detail', $event)" />
      </template>
    </div>

    <LockCreateDialog v-if="dialog?.kind === 'create'" @close="dialog = null" />
    <LockSeatsDialog v-else-if="dialogLock && (dialog?.kind === 'add' || dialog?.kind === 'release')" :key="`${dialog.kind}:${dialogLock.id}`"
      :lock="dialogLock" :mode="dialog.kind" @close="dialog = null" />
    <LockDetailDialog v-else-if="dialogLock && dialog?.kind === 'detail'" :lock="dialogLock" :can-edit="canEdit"
      @close="dialog = null" @add="open('add', dialogLock.id)" @release="open('release', dialogLock.id)" />
  </section>
</template>

<style scoped>
.seat-locks { padding: 14px 16px 40px; border-radius: 16px; background: var(--bg); font-variant-numeric: tabular-nums; }
.seat-locks__body { display: flex; flex-direction: column; gap: 10px; }
.seat-locks__head { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.seat-locks__title { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.seat-locks__sub { font-size: 11.5px; color: var(--muted); }
.seat-locks__new { margin-left: auto; }
.seat-locks__loading { padding: 34px; text-align: center; color: var(--muted); }
.seat-locks__retry { margin-top: 8px; }
@media (max-width: 640px) { .seat-locks { padding: 10px 8px 24px; } }
</style>

<style>
/* Shared by LockDayTable and LockTable; scoped to the page. Feature-only, so not in components.css. */
.seat-locks .lock-table { --lock-th-h: 31px; width: 100%; border-collapse: separate; border-spacing: 0; }
.seat-locks .lock-table__th {
  position: sticky;
  top: 0;
  z-index: 4;
  height: var(--lock-th-h);
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-faint);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}
.seat-locks .lock-table__th--num { text-align: center; }
.seat-locks .lock-table__td { padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 12px; vertical-align: middle; }
.seat-locks .lock-table--compact .lock-table__th { background: var(--surface); }
.seat-locks .lock-table--compact .lock-table__td { padding: 6px 12px; }
.seat-locks .lock-table__td--num { font-family: var(--font-mono); font-weight: 700; text-align: center; }
.seat-locks .lock-table__td--big { font-size: 15px; }
.seat-locks .lock-table__td--strong { font-weight: 700; }
.seat-locks .lock-table__td--lock { color: var(--lock); }
.seat-locks .lock-table__td--ok { color: var(--ok); }
.seat-locks .lock-table__td--faint { color: var(--text-faint); }
.seat-locks .lock-table__td--nowrap { white-space: nowrap; }
.seat-locks .lock-table__td--end { padding-right: 14px; text-align: right; }
.seat-locks .lock-table__empty { padding: 22px; color: var(--text-faint); text-align: center; }
.seat-locks .lock-table__empty--big { padding: 34px; }
.seat-locks .lock-dot { display: inline-block; flex: none; width: 8px; height: 8px; margin-right: 7px; border-radius: 50%; }
.seat-locks .lock-route-bar { display: inline-block; width: 3px; height: 14px; margin-right: 7px; border-radius: 2px; vertical-align: -2px; }
.seat-locks .lock-mono { font-family: var(--font-mono); font-size: 11.5px; }
.seat-locks .lock-table .chip { font-size: 9.5px; padding: 0 7px; }
</style>
