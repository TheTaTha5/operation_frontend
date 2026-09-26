<script setup lang="ts">
import { computed, ref } from 'vue';

import { useAgentsStore } from '@/stores/agents';

import { headerIssues } from './agentRules';

// Header strip (legacy renderAgKPI, 08-app.js:6300): counts, credit, and what needs action.
const props = defineProps<{ today: string }>();
const store = useAgentsStore();
const NOT_MOVED = 'Not moved yet';

const selling = computed(() => store.summaries.filter((a) => a.program_route_ids.length).length);
const invoice = computed(() => store.summaries.filter((a) => a.pay_type === 'invoice'));
const creditSum = computed(() => invoice.value.reduce((s, a) => s + (a.credit_limit || 0), 0));
const issues = computed(() => headerIssues(store.summaries, store.rateTypes, props.today));
const issueN = computed(() => issues.value.norate + issues.value.orphan + issues.value.expiring);
const open = ref(false);
</script>

<template>
  <div class="agent-bar">
    <div class="agent-bar__count"><b>{{ store.summaries.length }}</b> agents</div>
    <span class="agent-bar__chip">{{ selling }} selling now</span>
    <span class="agent-bar__chip" :title="`${invoice.length} agents on credit (invoice)`">Credit &middot; {{ invoice.length }} &middot; ฿{{ creditSum.toLocaleString('en-US') }}</span>
    <span class="agent-bar__issues-wrap">
      <button type="button" class="agent-bar__chip agent-bar__chip--warn" :disabled="!issueN && !issues.contracts30" :aria-expanded="open" @click="open = !open">
        &#9888; Needs action {{ issueN }}
      </button>
      <div v-if="open" class="agent-bar__issues" role="dialog" aria-label="Needs action">
        <div v-if="issues.expiring"><b>{{ issues.expiring }}</b> Rate expiring, no season to take over</div>
        <div v-if="issues.orphan"><b>{{ issues.orphan }}</b> Route with no price</div>
        <div v-if="issues.norate"><b>{{ issues.norate }}</b> No rate bound</div>
        <div v-if="issues.contracts30" class="agent-bar__faint">{{ issues.contracts30 }} contracts end within 30 days</div>
        <div v-if="!issueN && !issues.contracts30" class="agent-bar__faint">Nothing needs action</div>
      </div>
    </span>
    <span class="agent-bar__sp" />
    <button type="button" class="agent-bar__btn" disabled :title="NOT_MOVED">Table</button>
    <button type="button" class="agent-bar__btn" disabled :title="NOT_MOVED">Import</button>
    <button type="button" class="agent-bar__btn agent-bar__btn--add" disabled :title="NOT_MOVED">+ New Agent</button>
  </div>
</template>

<style scoped>
/* Legacy .ag-hd (01-base.css:2978-3034): sticky navy strip. */
.agent-bar {
  position: sticky;
  top: var(--topbar);
  z-index: 30;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 14px;
  border-radius: 12px;
  color: #fff;
  /* One-off: the legacy header gradient (01-base.css:2980). */
  background: linear-gradient(120deg, rgba(22, 38, 92, 0.97), rgba(12, 24, 62, 0.95));
}
.agent-bar__count { font-size: 13px; opacity: 0.85; }
.agent-bar__count b { font-size: 22px; font-family: 'DM Mono', ui-monospace, monospace; margin-right: 4px; opacity: 1; }
.agent-bar__chip { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); color: #fff; border: 0; font-family: inherit; }
.agent-bar__chip--warn { background: #fdb022; color: #3a2a0c; cursor: pointer; }
.agent-bar__chip--warn:disabled { background: rgba(255, 255, 255, 0.12); color: #fff; cursor: default; }
.agent-bar__issues-wrap { position: relative; }
.agent-bar__issues {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font-size: 12.5px;
}
.agent-bar__faint { color: var(--muted); }
.agent-bar__sp { flex: 1; }
.agent-bar__btn { font: inherit; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.25); background: transparent; color: #fff; }
.agent-bar__btn--add { background: #fff; color: #16265c; }
.agent-bar__btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
