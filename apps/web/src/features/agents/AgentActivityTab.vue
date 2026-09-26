<script setup lang="ts">
import { computed, watch } from 'vue';

import { useAgentsStore } from '@/stores/agents';

// Activity (legacy agTabActivity, agents.js:3440): the agent's change log, newest first.
const props = defineProps<{ agentId: string }>();
const store = useAgentsStore();
watch(() => props.agentId, (id) => store.loadActivity(id), { immediate: true });
const log = computed(() => store.activity.get(props.agentId));

/** Legacy KLBL: the label per kind. */
const KIND: Record<string, string> = {
  created: 'Created', rate: 'Rate', credit: 'Credit', profile: 'Profile', programs: 'Programs', company: 'Company',
  sales: 'Sales', contract: 'Contract', note: 'Note', edit: 'Edit',
};
const when = (at: string) => { const d = new Date(at); return isNaN(d.getTime()) ? at : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); };
</script>

<template>
  <div v-if="!log || log.status === 'loading'" class="muted">Loading activity…</div>
  <div v-else-if="log.status === 'error'" class="callout callout--danger"><b>Could not load the activity</b></div>
  <p v-else-if="!log.rows.length" class="muted">ยังไม่มีประวัติการเปลี่ยนแปลงของ agent นี้</p>
  <ol v-else class="agent-activity">
    <li v-for="(e, i) in log.rows" :key="i" class="agent-activity__item">
      <span class="chip">{{ KIND[e.kind] || e.kind }}</span>
      <span class="agent-activity__text">{{ e.text }}</span>
      <span class="agent-activity__meta">{{ when(e.at) }}<template v-if="e.by"> &middot; {{ e.by }}</template></span>
    </li>
  </ol>
</template>

<style scoped>
.agent-activity { list-style: none; margin: 0; padding: 0; }
.agent-activity__item { display: grid; grid-template-columns: 90px minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.agent-activity__text { overflow-wrap: anywhere; }
.agent-activity__meta { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
@media (max-width: 900px) {
  .agent-activity__item { grid-template-columns: minmax(0, 1fr); gap: 3px; }
}
</style>
