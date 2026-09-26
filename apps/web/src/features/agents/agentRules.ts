// Agent rules ported from legacy agents.js / contracts.js / rates.js, as pure functions over
// operation-backend's agent shapes. Dates are YYYY-MM-DD compared as local days (root CLAUDE.md).
import { addDays } from '@/lib/date';
import type { ObAgent, ObAgentSummary, ObPayType, ObRateTypeSummary } from '@/lib/ob';

/** Legacy SB_PAYMENT_TYPES (08-app.js:111). `bank` and `cash` in legacy forms were never valid ids. */
export const PAY_TYPES: Record<ObPayType, { name: string; short: string; credit: boolean }> = {
  proforma: { name: 'Pro forma Invoice (Pre-paid)', short: 'PF', credit: false },
  invoice: { name: 'Invoice (Credit)', short: 'INV', credit: true },
  bt: { name: 'Bank Transfer', short: 'BT', credit: false },
  cot: { name: 'Cash on Tour', short: 'COT', credit: false },
};
export const VAT_LABEL = { none: 'No VAT', include: 'VAT included', exclude: 'VAT +7% on top' } as const;

/** Whole days from `today` to `ymd` (negative = past). Both are local calendar days. */
export function daysTo(ymd: string, today: string): number {
  const a = new Date(today + 'T12:00:00').getTime(), b = new Date(ymd + 'T12:00:00').getTime();
  return Math.round((b - a) / 864e5);
}

/** Legacy ctIsExpired / ctIsExpiringSoon (contracts.js:9-22): expiring = 0..60 days left. */
export type ContractState = { state: 'none' } | { state: 'expired' | 'expiring' | 'ok'; days: number };
export function contractState(a: Pick<ObAgentSummary, 'contract_end'>, today: string): ContractState {
  if (!a.contract_end) return { state: 'none' };
  const days = daysTo(a.contract_end, today);
  return { state: days < 0 ? 'expired' : days <= 60 ? 'expiring' : 'ok', days };
}
/** Info-tab tag tone (agents.js:2512-2515): red at ≤30 days left or expired, amber at ≤60. */
export function contractTone(c: ContractState): 'danger' | 'warn' | 'ok' | 'none' {
  if (c.state === 'none') return 'none';
  return c.days <= 30 ? 'danger' : c.days <= 60 ? 'warn' : 'ok';
}

/** Legacy agIncompleteFields (agents.js:1206). */
export function incompleteFields(a: ObAgentSummary): string[] {
  const miss: string[] = [];
  if (!a.market_id) miss.push('Market');
  if (!a.sales_id) miss.push('Sales owner');
  if (!a.pay_type) miss.push('Payment');
  if (!a.rate_type_id) miss.push('Rate Type');
  if (!a.program_route_ids.length) miss.push('Programs');
  if (!a.has_contact) miss.push('Contact');
  return miss;
}

/** Programmes the bound rate cannot price, and priced routes the agent does not sell (legacy agRtRoutes, 2269). */
export function rateCoverage(routeIds: readonly string[], rt: ObRateTypeSummary | undefined) {
  const priced = new Set(rt?.priced_routes || []);
  return {
    orphan: rt ? routeIds.filter((r) => !priced.has(r)) : [],
    missing: rt ? [...priced].filter((r) => !routeIds.includes(r)) : [],
  };
}

/**
 * Legacy rtExpForAgent: the bound rate ends within 60 days (or already has) and no season takes
 * over the day after. A rate's end date does not stop pricing, so this is a warning, not a block.
 */
export function rateExpiry(rt: ObRateTypeSummary | undefined, seasons: ObAgent['rate_seasons'] | undefined, today: string) {
  if (!rt?.valid_to) return null;
  const days = daysTo(rt.valid_to, today);
  if (days > 60) return null;
  const next = addDays(rt.valid_to, 1);
  const covered = (seasons || []).some((s) => s.from <= next && (!s.to || s.to >= next));
  return covered ? null : { days, to: rt.valid_to };
}

export type AlertTone = 'danger' | 'warn' | 'info';
export interface AgentAlert { tone: AlertTone; title: string; detail: string; when?: string; blocked?: boolean }

/**
 * Legacy agAlerts (agents.js:2136), in its order. Not here yet: credit (the backend has no invoices,
 * agents.md §5 Q4) and "contract ≠ bound rate" (contracts are not in the backend).
 */
export function agentAlerts(a: ObAgent, rt: ObRateTypeSummary | undefined, routeName: (id: string) => string, today: string): AgentAlert[] {
  const out: AgentAlert[] = [];
  const c = contractState(a, today);
  if (c.state === 'expired') out.push({ tone: 'danger', title: 'Contract expired', when: `${-c.days} days ago`, detail: `${a.contract_version || 'Contract'} ended ${a.contract_end}` });
  else if (c.state === 'expiring') out.push({ tone: 'danger', title: 'Contract expiring', when: `${c.days} days`, detail: `${a.contract_version || 'Contract'} ends ${a.contract_end}` });

  if (!rt && a.program_route_ids.length) {
    out.push({ tone: 'danger', title: 'No rate bound', blocked: true, detail: `sells ${a.program_route_ids.length} routes · no Rate Type at all` });
  }
  if (rt) {
    const { orphan } = rateCoverage(a.program_route_ids, rt);
    if (orphan.length) {
      out.push({ tone: 'warn', title: 'Route with no price', blocked: true, detail: `${orphan.length} route${orphan.length === 1 ? '' : 's'} · ${orphan.map(routeName).join(' · ')}` });
    }
    const x = rateExpiry(rt, a.rate_seasons, today);
    if (x) {
      out.push({ tone: 'warn', title: x.days < 0 ? 'Rate expired' : 'Rate expiring', when: x.days < 0 ? `${-x.days} days ago` : `in ${x.days} days`,
        detail: `${rt.code || rt.name} ends ${x.to} · no season set to take over` });
    }
    if (rt.valid_from && daysTo(rt.valid_from, today) > 0) {
      out.push({ tone: 'info', title: 'Rate not started', when: `in ${daysTo(rt.valid_from, today)} days`, detail: `${rt.code || rt.name} starts ${rt.valid_from}` });
    }
  }
  const miss = incompleteFields(a);
  if (miss.length) out.push({ tone: 'warn', title: 'Incomplete profile', when: `${miss.length} items`, detail: `missing ${miss.join(' · ')}` });
  return out;
}

/**
 * Header "Needs action" (legacy agHdIssues, agents.js:1150): only agents that sell something count.
 * `drift` (contract ≠ bound rate) waits for contracts in the backend.
 */
export function headerIssues(agents: readonly ObAgentSummary[], rateTypes: readonly ObRateTypeSummary[], today: string) {
  const rtOf = (id: string | null) => (id ? rateTypes.find((r) => r.id === id) : undefined);
  const out = { norate: 0, orphan: 0, expiring: 0, contracts30: 0 };
  for (const a of agents) {
    const c = contractState(a, today);
    if (c.state !== 'none' && c.days >= 0 && c.days <= 30) out.contracts30++;
    if (!a.program_route_ids.length) continue;
    const rt = rtOf(a.rate_type_id);
    if (!rt) { out.norate++; continue; }
    if (rateCoverage(a.program_route_ids, rt).orphan.length) out.orphan++;
    // The list has no seasons; the detail view re-checks with them.
    if (rateExpiry(rt, undefined, today)) out.expiring++;
  }
  return out;
}

/**
 * Legacy agRenderList search + filters (agents.js:1216-1293): name, code, sub-market, market name and
 * salesperson name, case-insensitive. `sales: '__none'` = agents with no salesperson.
 */
export function filterAgents(
  list: readonly ObAgentSummary[],
  f: { q: string; market: string; sales: string },
  names: { market: (id: string | null) => string; sales: (id: string | null) => string },
): ObAgentSummary[] {
  const q = f.q.trim().toLowerCase();
  return list.filter((a) => {
    if (f.market && a.market_id !== f.market) return false;
    if (f.sales === '__none' ? !!a.sales_id : f.sales && a.sales_id !== f.sales) return false;
    if (!q) return true;
    return [a.name, a.code, a.sub_market, names.market(a.market_id), names.sales(a.sales_id)]
      .some((s) => (s || '').toLowerCase().includes(q));
  });
}

/** Two-letter badge for the list (legacy sb-ag-dot). */
export function initials(name: string): string {
  const w = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length > 1 ? w[0]![0]! + w[1]![0]! : w[0]!.slice(0, 2)).toUpperCase();
}

/** A–Z groups for the list (legacy agRenderList, 1234-1241); null-safe where legacy threw on a missing name. */
export function groupAZ<T extends { name: string }>(list: readonly T[]): [string, T[]][] {
  const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' }));
  const groups = new Map<string, T[]>();
  for (const a of sorted) {
    const c = (a.name || '').trim().charAt(0).toUpperCase();
    const k = /[A-Z]/.test(c) ? c : '#';
    const g = groups.get(k);
    if (g) g.push(a); else groups.set(k, [a]);
  }
  return [...groups];
}
