<script setup lang="ts">
import { computed } from 'vue';

import type { ObAgent } from '@/lib/ob';
import { useAgentsStore } from '@/stores/agents';

import { agentAlerts, contractState, contractTone, PAY_TYPES, rateCoverage, VAT_LABEL } from './agentRules';

// Information tab (legacy agTabInfo, agents.js:2416): needs action, commercial terms, the rate used
// for pricing, programmes sold, company and contact. Read-only.
const props = defineProps<{ agent: ObAgent; today: string }>();
const store = useAgentsStore();

const rt = computed(() => store.rateTypeOf(props.agent.rate_type_id));
const alerts = computed(() => agentAlerts(props.agent, rt.value, store.routeName, props.today));
const contract = computed(() => contractState(props.agent, props.today));
const pay = computed(() => (props.agent.pay_type ? PAY_TYPES[props.agent.pay_type] : undefined));
const coverage = computed(() => rateCoverage(props.agent.programs.map((p) => p.route_id), rt.value));
const priced = (routeId: string) => !rt.value || rt.value.priced_routes.includes(routeId);
const sales = computed(() => store.salesOf(props.agent.sales_id));
const period = (a?: string | null, b?: string | null) => (a || b ? `${a || '…'} → ${b || '…'}` : '');
const seasonRate = (id: string) => { const r = store.rateTypeOf(id); return r ? r.code || r.name : id; };
const money = (n?: number) => (n == null ? '—' : '฿' + n.toLocaleString('en-US'));
</script>

<template>
  <!-- 1 · Needs action (legacy agAlerts, agents.js:2136) -->
  <section class="agent-band">
    <h2 class="agent-band__title">Needs action</h2>
    <ul v-if="alerts.length" class="agent-alerts">
      <li v-for="(a, i) in alerts" :key="i" class="agent-alert" :class="`agent-alert--${a.tone}`">
        <span class="agent-alert__sev">{{ a.blocked ? 'Blocked' : a.tone === 'info' ? 'Info' : 'Attention' }}</span>
        <span class="agent-alert__title">{{ a.title }}<span v-if="a.when" class="agent-alert__when"> &middot; {{ a.when }}</span></span>
        <span class="agent-alert__detail">{{ a.detail }}</span>
      </li>
    </ul>
    <p v-else class="agent-alerts__ok">&#10003; Nothing needs action for this agent</p>
  </section>

  <!-- 2 · Commercial -->
  <section class="agent-band">
    <h2 class="agent-band__title">Commercial</h2>
    <div class="agent-boxes">
      <div class="agent-box">
        <h3 class="agent-box__head">Contract</h3>
        <dl class="details">
          <dt>Version</dt><dd>{{ agent.contract_version || '—' }}</dd>
          <dt>Period</dt><dd>{{ period(agent.contract_start, agent.contract_end) || '—' }}
            <span v-if="contract.state !== 'none'" class="chip" :class="`chip--${contractTone(contract)}`">
              {{ contract.state === 'expired' ? `ended ${-contract.days} days ago` : `${contract.days} days left` }}</span></dd>
          <dt>Status</dt><dd>{{ agent.contract_status || '—' }}</dd>
          <dt>Template</dt><dd>{{ agent.contract_template_id || 'System default' }}</dd>
        </dl>
      </div>
      <div class="agent-box">
        <h3 class="agent-box__head">Credit &amp; payment</h3>
        <dl class="details">
          <dt>Payment</dt><dd>{{ pay ? pay.name : agent.pay_type || '—' }}</dd>
          <dt>VAT</dt><dd>{{ agent.vat_mode ? VAT_LABEL[agent.vat_mode] : '—' }}</dd>
          <template v-if="agent.pay_type === 'invoice'">
            <dt>Credit</dt><dd>{{ money(agent.credit_limit) }} &middot; {{ agent.credit_days ?? '—' }} days</dd>
            <dt>Used</dt><dd class="muted" title="operation-backend has no invoices or payments yet">not available yet</dd>
          </template>
        </dl>
      </div>
      <div class="agent-box">
        <h3 class="agent-box__head">Booking channel</h3>
        <dl class="details">
          <dt>Method</dt><dd>{{ agent.booking_channel.method || '—' }}</dd>
          <dt>Cut-off</dt><dd>{{ agent.booking_channel.cutoff || '—' }}</dd>
          <dt>Email</dt><dd>{{ agent.booking_channel.email || '—' }}</dd>
          <dt>Phone</dt><dd>{{ agent.booking_channel.phone || '—' }}</dd>
          <dt>Cancel policy</dt><dd>{{ agent.booking_channel.cancel_policy || '—' }}</dd>
        </dl>
      </div>
      <div class="agent-box">
        <h3 class="agent-box__head">Sales owner</h3>
        <dl class="details">
          <dt>Salesperson</dt><dd>{{ sales ? sales.full_name || sales.name : agent.sales_id || '—' }}</dd>
          <dt>Market</dt><dd>{{ store.marketOf(agent.market_id)?.name || '—' }}<template v-if="agent.sub_market"> &middot; {{ agent.sub_market }}</template></dd>
        </dl>
      </div>
    </div>
  </section>

  <!-- 3 · Rate used for pricing -->
  <section class="agent-band">
    <h2 class="agent-band__title">Rate used for pricing</h2>
    <div v-if="!agent.rate_type_id" class="callout callout--danger"><b>No Rate Type bound</b>Agent นี้จะไม่มีราคา default: every booking must be priced by hand.</div>
    <div v-else class="agent-box agent-box--wide">
      <dl class="details">
        <dt>Rate Type</dt><dd><b>{{ rt ? rt.code || rt.name : agent.rate_type_id }}</b><template v-if="rt?.code"> &middot; {{ rt.name }}</template>
          <span v-if="rt && !rt.active" class="chip chip--danger">inactive</span>
          <span v-if="!rt" class="chip chip--warn">not in the rate list</span></dd>
        <dt>Valid</dt><dd>{{ rt ? period(rt.valid_from, rt.valid_to) || 'no dates' : '—' }}</dd>
        <dt>Owner</dt><dd>{{ rt?.owner ? store.salesOf(rt.owner)?.name || rt.owner : 'Shared' }}</dd>
        <dt>Seasons</dt>
        <dd v-if="agent.rate_seasons.length">
          <div v-for="(s, i) in agent.rate_seasons" :key="i">{{ period(s.from, s.to || null) }} &middot; <b>{{ seasonRate(s.rate_type_id) }}</b></div>
        </dd>
        <dd v-else class="muted">ยังไม่ได้ตั้ง · this agent uses one price set all year</dd>
      </dl>
    </div>
  </section>

  <!-- 4 · Programs sold -->
  <section class="agent-band">
    <h2 class="agent-band__title">Programs sold <span class="muted">&middot; {{ agent.programs.length }}</span></h2>
    <p v-if="coverage.missing.length" class="callout agent-band__note">
      {{ coverage.missing.length }} route{{ coverage.missing.length === 1 ? '' : 's' }} in the Rate Type but not sold: {{ coverage.missing.map(store.routeName).join(' · ') }}</p>
    <div v-if="agent.programs.length" class="agent-programs" role="table" aria-label="Programs sold">
      <div class="agent-programs__head" role="row">
        <span role="columnheader">Program</span><span role="columnheader">Booking period</span><span role="columnheader">Travel period</span><span role="columnheader">Note</span>
      </div>
      <div v-for="p in agent.programs" :key="p.route_id" class="agent-programs__row" role="row">
        <span class="agent-programs__name" role="cell">{{ store.routeName(p.route_id) }}
          <span v-if="!priced(p.route_id)" class="chip chip--warn">No price</span></span>
        <span class="agent-programs__period" role="cell">{{ period(p.book_from, p.book_to) || '—' }}</span>
        <span class="agent-programs__period" role="cell">
          <template v-if="period(p.travel_from, p.travel_to)">{{ period(p.travel_from, p.travel_to) }}</template>
          <span v-else class="chip">No dates</span></span>
        <span role="cell" class="muted">{{ p.note || '' }}</span>
      </div>
    </div>
    <p v-else class="muted">No programs yet.</p>
  </section>

  <!-- 5 · Company & contact -->
  <section class="agent-band">
    <h2 class="agent-band__title">Company &amp; contact</h2>
    <div class="agent-boxes">
      <div class="agent-box">
        <h3 class="agent-box__head">Company</h3>
        <dl class="details">
          <dt>Legal name</dt><dd>{{ agent.company.legal_name || '—' }}</dd>
          <dt>Tax ID</dt><dd>{{ agent.company.tax_id || '—' }}</dd>
          <dt>TAT licence</dt><dd>{{ agent.company.tat_license || '—' }}</dd>
          <dt>Address</dt><dd class="agent-box__wrap">{{ agent.company.address || '—' }}</dd>
          <dt>Tel</dt><dd>{{ agent.company.tel || '—' }}</dd>
          <dt>Website</dt><dd>{{ agent.company.website || '—' }}</dd>
        </dl>
      </div>
      <div class="agent-box">
        <h3 class="agent-box__head">Contact &amp; signatory</h3>
        <dl class="details">
          <dt>Contact</dt><dd>{{ agent.contact || '—' }}</dd>
          <dt>Email</dt><dd><a v-if="agent.email" :href="`mailto:${agent.email}`">{{ agent.email }}</a><template v-else>—</template></dd>
          <dt>Phone</dt><dd><a v-if="agent.phone" :href="`tel:${agent.phone}`">{{ agent.phone }}</a><template v-else>—</template></dd>
          <dt>Signatory</dt><dd>{{ agent.signatory.name || '—' }}<template v-if="agent.signatory.designation"> &middot; {{ agent.signatory.designation }}</template></dd>
          <dt>Signed</dt><dd>{{ agent.signatory.signed_date || 'not signed yet' }}</dd>
        </dl>
      </div>
      <div class="agent-box agent-box--wide">
        <h3 class="agent-box__head">Internal notes</h3>
        <p class="agent-box__wrap agent-box__note">{{ agent.note || '—' }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Legacy §agStd boxes and alerts (01-base.css:3056-3141) and the programmes grid (3160-3235). */
.agent-band { margin-bottom: 20px; }
.agent-band__title { margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.agent-band__note { margin: 0 0 8px; }

.agent-alerts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.agent-alert { display: grid; grid-template-columns: 78px minmax(140px, auto) 1fr; gap: 10px; align-items: baseline; padding: 8px 12px; border: 1px solid; border-radius: 8px; font-size: 12.5px; }
.agent-alert--danger { color: var(--danger); background: var(--danger-bg); border-color: var(--danger-line); }
.agent-alert--warn { color: var(--warn); background: var(--warn-bg); border-color: var(--warn-line); }
.agent-alert--info { color: var(--info); background: var(--info-bg); border-color: var(--info-line); }
.agent-alert__sev { font-size: 10.5px; font-weight: 800; text-transform: uppercase; }
.agent-alert__title { font-weight: 700; }
.agent-alert__when { font-weight: 400; }
.agent-alert__detail { color: var(--text); }
.agent-alerts__ok { margin: 0; color: var(--ok); font-size: 13px; }

.agent-boxes { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.agent-box { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 13px; min-width: 0; }
.agent-box--wide { grid-column: 1 / -1; }
.agent-box__head { margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
.agent-box__wrap { white-space: pre-line; overflow-wrap: anywhere; }
.agent-box__note { margin: 0; }
.agent-box .details { font-size: 13px; }

.agent-programs { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 12.5px; }
.agent-programs__head, .agent-programs__row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(0, 1fr); gap: 8px; padding: 8px 12px; }
.agent-programs__head { background: var(--surface-2); color: var(--muted); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.agent-programs__row { border-top: 1px solid var(--border); }
.agent-programs__name { font-weight: 500; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.agent-programs__period { font-family: 'DM Mono', ui-monospace, monospace; font-size: 12px; }

@media (max-width: 900px) {
  .agent-alert { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .agent-programs__head { display: none; }
  .agent-programs__row { grid-template-columns: minmax(0, 1fr); gap: 2px; }
}
</style>
