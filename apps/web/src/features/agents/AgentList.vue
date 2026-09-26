<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { localYmd } from '@/lib/date';
import { useAgentsStore } from '@/stores/agents';

import { contractState, contractTone, filterAgents, groupAZ, incompleteFields, initials, PAY_TYPES } from './agentRules';

// Side list (legacy agRenderFilters / agRenderList, agents.js:1059, 1216): search, market and
// salesperson filters, then the agents A–Z.
const props = defineProps<{ selected: string; q: string; market: string; sales: string }>();
const emit = defineEmits<{ select: [id: string]; filter: [patch: Record<string, string | undefined>] }>();
const store = useAgentsStore();
const today = localYmd();

const names = {
  market: (id: string | null) => store.marketOf(id)?.name || '',
  sales: (id: string | null) => store.salesOf(id)?.name || '',
};
const shown = computed(() => filterAgents(store.summaries, { q: props.q, market: props.market, sales: props.sales }, names));
const groups = computed(() => groupAZ(shown.value));

// Filter counts ignore the other filter, as legacy does.
const marketCounts = computed(() => {
  const n = new Map<string, number>();
  for (const a of store.summaries) if (a.market_id) n.set(a.market_id, (n.get(a.market_id) || 0) + 1);
  return store.markets.filter((m) => n.get(m.id)).map((m) => ({ m, n: n.get(m.id)! }));
});
const salesCounts = computed(() => store.salesPeople.map((s) => ({ s, n: store.summaries.filter((a) => a.sales_id === s.id).length })));
const activeN = computed(() => (props.market ? 1 : 0) + (props.sales ? 1 : 0));
const popOpen = ref(false);

// Typing updates the URL after a short pause, so each key press does not add a navigation.
const text = ref(props.q);
watch(() => props.q, (v) => { if (v !== text.value) text.value = v; });
let typing: ReturnType<typeof setTimeout> | undefined;
function onType() {
  clearTimeout(typing);
  typing = setTimeout(() => emit('filter', { q: text.value || undefined }), 200);
}
</script>

<template>
  <div class="agent-filter">
    <div class="agent-filter__head">
      <b>Agents</b><span class="agent-filter__count">{{ shown.length }}/{{ store.summaries.length }}</span>
    </div>
    <div class="agent-filter__row">
      <input v-model="text" class="agent-filter__search" type="search" placeholder="Search name · code · market · sales" aria-label="Search agents" @input="onType" />
      <button type="button" class="agent-filter__btn" :class="{ 'agent-filter__btn--on': activeN }" :aria-expanded="popOpen" @click="popOpen = !popOpen">
        Filter<span v-if="activeN" class="agent-filter__badge">{{ activeN }}</span>
      </button>
    </div>
    <div v-if="popOpen" class="agent-filter__pop">
      <div class="agent-filter__pop-head">Market
        <button v-if="activeN" type="button" class="linklike" @click="emit('filter', { market: undefined, sales: undefined })">Clear</button></div>
      <div class="agent-filter__chips">
        <button type="button" class="chip" :class="{ 'chip--on': !market }" @click="emit('filter', { market: undefined })">All</button>
        <button v-for="x in marketCounts" :key="x.m.id" type="button" class="chip" :class="{ 'chip--on': market === x.m.id }"
                @click="emit('filter', { market: x.m.id })">{{ x.m.short || x.m.name }} &middot; {{ x.n }}</button>
      </div>
      <div class="agent-filter__pop-head">Salesperson</div>
      <div class="agent-filter__chips">
        <button type="button" class="chip" :class="{ 'chip--on': !sales }" @click="emit('filter', { sales: undefined })">All</button>
        <button v-for="x in salesCounts" :key="x.s.id" type="button" class="chip" :class="{ 'chip--on': sales === x.s.id }"
                @click="emit('filter', { sales: x.s.id })">{{ x.s.name }} &middot; {{ x.n }}</button>
      </div>
    </div>
  </div>

  <div class="agent-list">
    <template v-for="[letter, list] in groups" :key="letter">
      <div class="agent-list__letter">{{ letter }}</div>
      <button v-for="a in list" :key="a.id" type="button" class="agent-row" :class="{ 'agent-row--selected': a.id === selected }"
              :aria-current="a.id === selected ? 'true' : undefined" @click="emit('select', a.id)">
        <span class="agent-row__avatar" :style="{ background: a.color || store.marketOf(a.market_id)?.color || '#8b909c' }">{{ initials(a.name) }}</span>
        <span class="agent-row__body">
          <span class="agent-row__name">
            {{ a.name || a.code || a.id }}
            <i class="agent-row__contract-dot" :class="`agent-row__contract-dot--${contractTone(contractState(a, today))}`" :title="a.contract_end ? `Contract ends ${a.contract_end}` : 'No contract dates'" />
            <span v-if="incompleteFields(a).length" class="chip chip--warn" :title="`Missing: ${incompleteFields(a).join(', ')}`">{{ incompleteFields(a).length }}</span>
          </span>
          <span class="agent-row__meta">
            {{ store.marketOf(a.market_id)?.short || store.marketOf(a.market_id)?.name || '—' }}<template v-if="a.sub_market"> &middot; {{ a.sub_market }}</template>
            <span v-if="a.pay_type" class="chip">{{ PAY_TYPES[a.pay_type]?.short || a.pay_type }}</span>
            <span class="agent-row__progs">{{ a.program_route_ids.length }} prog</span>
            <span v-if="a.sales_id" class="agent-row__sales" :style="{ color: store.salesOf(a.sales_id)?.color }">{{ store.salesOf(a.sales_id)?.code || store.salesOf(a.sales_id)?.name || a.sales_id }}</span>
          </span>
        </span>
      </button>
    </template>
    <p v-if="!groups.length" class="agent-list__none">ไม่พบ Agent ที่ตรงเงื่อนไข</p>
  </div>
</template>

<style scoped>
/* Legacy .sb-side / .ag-filter-* / .sb-ag-row (01-base.css:1508-1553, 2638-2697). */
.agent-filter { padding: 12px 12px 8px; border-bottom: 1px solid var(--border); flex: none; }
.agent-filter__head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.agent-filter__count { color: var(--muted); font-size: 12px; font-family: 'DM Mono', ui-monospace, monospace; }
.agent-filter__row { display: flex; gap: 6px; }
.agent-filter__search { flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
.agent-filter__btn { font: inherit; font-size: 12px; font-weight: 600; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.agent-filter__btn--on { border-color: var(--accent); color: var(--accent); }
.agent-filter__badge { background: var(--accent); color: #fff; border-radius: 999px; font-size: 10px; padding: 0 6px; }
.agent-filter__pop { margin-top: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; }
.agent-filter__pop-head { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
.agent-filter__chips { display: flex; flex-wrap: wrap; gap: 5px; }

.agent-list { overflow-y: auto; padding: 4px 6px 10px; flex: 1 1 auto; }
.agent-list__letter { position: sticky; top: 0; background: var(--surface); padding: 8px 8px 3px; font-size: 11px; font-weight: 800; color: var(--muted); z-index: 1; }
.agent-list__none { padding: 20px; text-align: center; color: var(--muted); font-size: 13px; }
.agent-row { display: flex; gap: 10px; align-items: center; width: 100%; padding: 8px 10px; border: 1px solid transparent; border-radius: 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.agent-row:hover { background: var(--surface-2); }
.agent-row--selected { background: var(--info-bg); border-color: var(--info-line); }
.agent-row__avatar { flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 800; }
.agent-row__body { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.agent-row__name { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; min-width: 0; }
.agent-row__contract-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--border); }
.agent-row__contract-dot--danger { background: var(--danger); }
.agent-row__contract-dot--warn { background: var(--warn); }
.agent-row__contract-dot--ok { background: var(--ok); }
.agent-row__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); }
.agent-row__progs { font-family: 'DM Mono', ui-monospace, monospace; }
.agent-row__sales { font-weight: 700; }
</style>
