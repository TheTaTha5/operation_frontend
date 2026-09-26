<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { useAgentsStore } from '@/stores/agents';

import { displayCode, fmtDate, paxSplit, statusLabel } from '../bookings/model';

// Recent Bookings (legacy agTabHist, agents.js:3223): newest booking first, a page at a time.
// Legacy listed cancelled bookings in array order; the backend sorts, and leaves cancelled out.
const props = defineProps<{ agentId: string }>();
const store = useAgentsStore();
watch(() => props.agentId, (id) => store.loadBookings(id), { immediate: true });
const page = computed(() => store.bookings.get(props.agentId));
const firstTravel = (b: { trips: { service_date: string }[] }) => b.trips.map((t) => t.service_date).sort()[0] || '';
</script>

<template>
  <div v-if="!page || (page.status === 'loading' && !page.rows.length)" class="muted">Loading bookings…</div>
  <div v-else-if="page.status === 'error' && !page.rows.length" class="callout callout--danger"><b>Could not load bookings</b>
    <button type="button" class="linklike" @click="store.loadBookings(agentId)">Retry</button></div>
  <p v-else-if="!page.rows.length" class="muted">ยังไม่มีการจองจาก Agent นี้</p>
  <template v-else>
    <div class="agent-bookings">
      <table>
        <thead><tr><th>Booking</th><th>Booked</th><th>Travel</th><th>Programme</th><th class="agent-bookings__num">Pax</th><th class="agent-bookings__num">Total</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="b in page.rows" :key="b.id">
            <td><RouterLink :to="`/bookings/${encodeURIComponent(b.id)}`">{{ b.voucher_ref || displayCode(b) }}</RouterLink></td>
            <td>{{ b.booking_date ? fmtDate(b.booking_date) : '—' }}</td>
            <td>{{ firstTravel(b) ? fmtDate(firstTravel(b)) : '—' }}</td>
            <td>{{ store.routeName(b.route_id) }}<span v-if="b.trips.length > 1" class="muted"> +{{ b.trips.length - 1 }}</span></td>
            <td class="agent-bookings__num">{{ paxSplit(b).total }}</td>
            <td class="agent-bookings__num">{{ b.total != null ? '฿' + Math.round(b.total).toLocaleString('en-US') : '—' }}</td>
            <td><span class="chip" :class="{ 'chip--ok': b.status === 'confirmed' || b.status === 'completed', 'chip--danger': ['cancelled', 'cancelled_weather', 'rejected'].includes(b.status) }">{{ statusLabel(b.status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <button v-if="page.cursor" type="button" class="button agent-bookings__more" :disabled="page.status === 'loading'" @click="store.loadBookings(agentId, true)">
      {{ page.status === 'loading' ? 'Loading…' : 'Load more' }}</button>
  </template>
</template>

<style scoped>
.agent-bookings { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.agent-bookings table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.agent-bookings th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); background: var(--surface-2); padding: 7px 10px; white-space: nowrap; }
.agent-bookings td { padding: 7px 10px; border-top: 1px solid var(--border); white-space: nowrap; }
.agent-bookings__num { text-align: right; font-family: 'DM Mono', ui-monospace, monospace; }
.agent-bookings__more { margin-top: 10px; }
</style>
