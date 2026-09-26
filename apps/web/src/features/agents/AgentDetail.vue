<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAgentsStore } from '@/stores/agents';

import AgentActivityTab from './AgentActivityTab.vue';
import AgentBookingsTab from './AgentBookingsTab.vue';
import AgentInfoTab from './AgentInfoTab.vue';
import { contractState, contractTone } from './agentRules';

// Detail panel (legacy agRenderDetail, agents.js:2334). The tab is in the URL (?tab=), where legacy
// kept it only in the DOM and always reset to Information.
const props = defineProps<{ id: string; today: string }>();
const store = useAgentsStore();
const route = useRoute();
const router = useRouter();

watch(() => props.id, (id) => store.loadAgent(id), { immediate: true });
const detail = computed(() => store.details.get(props.id));
const agent = computed(() => detail.value?.agent);
const market = computed(() => store.marketOf(agent.value?.market_id));
const contract = computed(() => (agent.value ? contractState(agent.value, props.today) : null));

const TABS = [
  { k: 'info', label: 'Information' }, { k: 'prices', label: 'Pricing Matrix', later: true },
  { k: 'bookings', label: 'Recent Bookings' }, { k: 'contracts', label: 'Generated Contracts', later: true },
  { k: 'activity', label: 'Activity' }, { k: 'rate', label: 'Rate Type', later: true },
] as const;
const tab = computed(() => (['bookings', 'activity'].includes(String(route.query.tab)) ? String(route.query.tab) : 'info'));
const setTab = (k: string) => router.replace({ query: { ...route.query, tab: k === 'info' ? undefined : k } });
const NOT_MOVED = 'Not moved yet';
</script>

<template>
  <article class="agent-detail">
    <div v-if="!detail || detail.status === 'loading'" class="agent-detail__state muted">Loading…</div>
    <div v-else-if="detail.status === 'forbidden'" class="callout callout--warn"><b>เอเยนต์รายนี้ไม่ได้อยู่ในความดูแลของคุณ</b>This agent belongs to another salesperson.</div>
    <div v-else-if="detail.status === 'missing'" class="callout"><b>Agent not found</b>No agent with id <code>{{ id }}</code>.</div>
    <div v-else-if="detail.status === 'error'" class="callout callout--danger"><b>Could not load this agent</b>{{ detail.error }}
      <div><button type="button" class="button agent-detail__retry" @click="store.loadAgent(id, true)">Retry</button></div></div>

    <template v-else-if="agent">
      <header class="agent-detail__head">
        <div class="agent-detail__title">
          <h1>{{ agent.name }}</h1>
          <span class="agent-detail__code">{{ agent.code }}</span>
          <span v-if="market" class="chip" :style="{ color: market.color, borderColor: market.color }">{{ market.name }}</span>
          <span v-if="contract && contract.state !== 'none'" class="chip" :class="`chip--${contractTone(contract)}`">
            {{ contract.state === 'expired' ? 'Contract expired' : `Contract ${agent.contract_version || ''} · ends ${agent.contract_end}` }}</span>
          <span v-if="agent.house" class="chip" title="Built-in agent: always present, cannot be deactivated">House</span>
        </div>
        <div class="agent-detail__actions">
          <button type="button" class="agent-detail__btn" disabled :title="NOT_MOVED">Generate Contract</button>
          <button type="button" class="agent-detail__btn" disabled :title="NOT_MOVED">Edit</button>
          <button type="button" class="agent-detail__btn" disabled :title="NOT_MOVED">Deactivate</button>
        </div>
      </header>

      <nav class="tabs" aria-label="Agent sections">
        <button v-for="t in TABS" :key="t.k" type="button" class="tabs__tab" :class="{ 'tabs__tab--on': tab === t.k }"
                :disabled="'later' in t" :title="'later' in t ? NOT_MOVED : undefined" :aria-current="tab === t.k ? 'page' : undefined" @click="setTab(t.k)">{{ t.label }}</button>
      </nav>

      <div class="agent-detail__body">
        <AgentInfoTab v-if="tab === 'info'" :agent="agent" :today="today" />
        <AgentBookingsTab v-else-if="tab === 'bookings'" :agent-id="agent.id" />
        <AgentActivityTab v-else :agent-id="agent.id" />
      </div>
    </template>
  </article>
</template>

<style scoped>
/* Legacy .sb-main / .sb-main-hd (01-base.css:1556-1573). */
.agent-detail { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.agent-detail > .callout { margin: 14px; }
.agent-detail__state { padding: 40px; text-align: center; }
.agent-detail__retry { margin-top: 8px; }
.agent-detail__head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; padding: 14px 16px 10px; }
.agent-detail__title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.agent-detail__title h1 { margin: 0; font-size: 18px; }
.agent-detail__code { font-family: 'DM Mono', ui-monospace, monospace; font-size: 12px; color: var(--muted); }
.agent-detail__actions { display: flex; gap: 6px; }
.agent-detail__btn { font: inherit; font-size: 12px; font-weight: 600; padding: 5px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
.agent-detail__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.agent-detail .tabs { padding: 0 10px; }
.agent-detail__body { padding: 14px 16px 18px; }
</style>
