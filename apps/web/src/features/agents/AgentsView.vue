<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { localYmd } from '@/lib/date';
import { useAgentsStore } from '@/stores/agents';

import AgentBar from './AgentBar.vue';
import AgentDetail from './AgentDetail.vue';
import AgentList from './AgentList.vue';

// Agent List (legacy renderAgents, 08-app.js:6072): header strip, A–Z list with filters, and the
// selected agent's detail. Phase 1 of apps/web/docs/porting/agents.md: read-only.
const route = useRoute();
const router = useRouter();
const store = useAgentsStore();
onMounted(() => store.load());

const today = localYmd();
const selected = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const q = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
const market = computed(() => (typeof route.query.market === 'string' ? route.query.market : ''));
const sales = computed(() => (typeof route.query.sales === 'string' ? route.query.sales : ''));

/** Filters and search stay in the URL; picking an agent keeps them. */
function setQuery(patch: Record<string, string | undefined>) {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) if (typeof v === 'string' && v) next[k] = v;
  router.replace({ query: next });
}
/** A new agent opens on Information, so the tab is dropped. */
function select(id: string) {
  router.push({ name: 'agent', params: { id }, query: { ...route.query, tab: undefined } });
}
</script>

<template>
  <section class="agent-page" :class="{ 'agent-page--picked': !!selected }">
    <AgentBar v-if="store.status === 'ready'" :today="today" />

    <div v-if="store.status === 'missing'" class="callout callout--warn">
      <b>Agents are not in operation-backend yet</b>
      This page shows the agent list once the backend serves <code>/v1/agents</code> (drafted in the agents porting spec).
    </div>
    <div v-else-if="store.status === 'error'" class="callout callout--danger">
      <b>Could not load agents</b>{{ store.error }}
      <div><button type="button" class="button agent-page__retry" @click="store.load(true)">Retry</button></div>
    </div>
    <p v-else-if="store.status !== 'ready'" class="muted">Loading agents…</p>

    <div v-else class="agent-page__body">
      <aside class="agent-page__side">
        <AgentList :selected="selected" :q="q" :market="market" :sales="sales" @select="select" @filter="setQuery" />
      </aside>
      <div class="agent-page__main">
        <RouterLink v-if="selected" class="agent-page__back" :to="{ name: 'agents', query: { ...route.query, tab: undefined } }">&larr; All agents</RouterLink>
        <AgentDetail v-if="selected" :id="selected" :today="today" />
        <p v-else class="agent-page__empty">เลือก Agent จากรายชื่อด้านซ้ายเพื่อดูรายละเอียด</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Legacy .sb-wrap / .sb-side / .sb-main (allotment_v2/css/01-base.css:1508-1573). */
.agent-page { display: flex; flex-direction: column; gap: 14px; }
.agent-page__body { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: start; }
.agent-page__side {
  position: sticky;
  top: calc(var(--topbar) + 12px);
  max-height: calc(100vh - var(--topbar) - 24px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.agent-page__main { min-width: 0; }
.agent-page__back { display: none; margin-bottom: 8px; font-size: 13px; }
.agent-page__empty { padding: 60px 20px; text-align: center; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin: 0; }
.agent-page__retry { margin-top: 8px; }

/* Phone (legacy §agPhone, 01-base.css:3238-3290): the list and the detail are separate screens. */
@media (max-width: 900px) {
  .agent-page__body { grid-template-columns: minmax(0, 1fr); }
  .agent-page__side { position: static; max-height: none; }
  .agent-page--picked .agent-page__side { display: none; }
  .agent-page:not(.agent-page--picked) .agent-page__main { display: none; }
  .agent-page__back { display: inline-block; }
}
</style>
