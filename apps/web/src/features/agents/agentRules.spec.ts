import { describe, expect, it } from 'vitest';

import type { ObAgent, ObAgentSummary, ObRateTypeSummary } from '@/lib/ob';

import {
  agentAlerts, contractState, contractTone, filterAgents, groupAZ, headerIssues, incompleteFields, initials, rateCoverage, rateExpiry,
} from './agentRules';

const T = '2026-09-26';
const summary = (x: Partial<ObAgentSummary> = {}): ObAgentSummary => ({
  id: 'a1', code: 'SUN', name: 'Sun Tour', market_id: 'ru', sales_id: 's1', pay_type: 'invoice', rate_type_id: 'rt1',
  program_route_ids: ['r5'], has_contact: true, house: false, active: true, contract_end: '2027-06-30', ...x,
});
const agent = (x: Partial<ObAgent> = {}): ObAgent => ({
  ...summary(), vat_mode: 'none', company: {}, signatory: {}, booking_channel: {}, programs: [], rate_seasons: [], ...x,
});
const rate = (x: Partial<ObRateTypeSummary> = {}): ObRateTypeSummary => ({
  id: 'rt1', code: 'RT1', name: 'Standard', active: true, valid_from: '2026-01-01', valid_to: '2027-12-31', priced_routes: ['r5', 'r6'], ...x,
});

describe('contractState', () => {
  it('uses the legacy thresholds: expired < 0, expiring 0..60, red tone at ≤ 30', () => {
    expect(contractState({ contract_end: null }, T)).toEqual({ state: 'none' });
    expect(contractState({ contract_end: '2026-09-25' }, T)).toEqual({ state: 'expired', days: -1 });
    expect(contractState({ contract_end: '2026-09-26' }, T)).toEqual({ state: 'expiring', days: 0 });
    expect(contractState({ contract_end: '2026-11-25' }, T)).toEqual({ state: 'expiring', days: 60 });
    expect(contractState({ contract_end: '2026-11-26' }, T)).toEqual({ state: 'ok', days: 61 });
    expect(contractTone(contractState({ contract_end: '2026-10-26' }, T))).toBe('danger');   // 30 days
    expect(contractTone(contractState({ contract_end: '2026-10-27' }, T))).toBe('warn');     // 31 days
  });
});

describe('incompleteFields and coverage', () => {
  it('lists what legacy agIncompleteFields lists', () => {
    expect(incompleteFields(summary())).toEqual([]);
    expect(incompleteFields(summary({ market_id: null, sales_id: null, pay_type: null, rate_type_id: null, program_route_ids: [], has_contact: false })))
      .toEqual(['Market', 'Sales owner', 'Payment', 'Rate Type', 'Programs', 'Contact']);
  });
  it('finds sold routes the rate cannot price, and priced routes not sold', () => {
    expect(rateCoverage(['r5', 'r9'], rate())).toEqual({ orphan: ['r9'], missing: ['r6'] });
    expect(rateCoverage(['r5'], undefined)).toEqual({ orphan: [], missing: [] });
  });
});

describe('rateExpiry', () => {
  it('warns within 60 days of the end unless a season takes over the day after', () => {
    expect(rateExpiry(rate({ valid_to: '2026-10-31' }), [], T)).toEqual({ days: 35, to: '2026-10-31' });
    expect(rateExpiry(rate({ valid_to: '2026-10-31' }), [{ rate_type_id: 'rt2', from: '2026-11-01' }], T)).toBeNull();
    expect(rateExpiry(rate({ valid_to: '2026-10-31' }), [{ rate_type_id: 'rt2', from: '2026-11-02' }], T)).not.toBeNull();
    expect(rateExpiry(rate({ valid_to: '2027-12-31' }), [], T)).toBeNull();
    expect(rateExpiry(rate({ valid_to: '2026-09-01' }), [], T)?.days).toBe(-25);
  });
});

describe('agentAlerts', () => {
  it('keeps the legacy order: contract, no rate / unpriced route, rate expiry, not started, incomplete', () => {
    const a = agent({ contract_end: '2026-09-01', program_route_ids: ['r5', 'r9'], has_contact: false });
    const rt = rate({ valid_from: '2026-12-01', valid_to: '2026-10-15' });
    expect(agentAlerts(a, rt, (id) => id.toUpperCase(), T).map((x) => x.title))
      .toEqual(['Contract expired', 'Route with no price', 'Rate expiring', 'Rate not started', 'Incomplete profile']);
    expect(agentAlerts(a, rt, (id) => id.toUpperCase(), T)[1]!.detail).toContain('R9');
  });
  it('blocks an agent that sells routes with no rate at all', () => {
    const [first] = agentAlerts(agent({ rate_type_id: null }), undefined, (id) => id, T).filter((x) => x.blocked);
    expect(first?.title).toBe('No rate bound');
  });
  it('says nothing for a complete agent', () => {
    expect(agentAlerts(agent(), rate(), (id) => id, T)).toEqual([]);
  });
});

describe('headerIssues', () => {
  it('counts only agents that sell something', () => {
    const list = [summary(), summary({ id: 'a2', rate_type_id: null }), summary({ id: 'a3', rate_type_id: null, program_route_ids: [] }),
      summary({ id: 'a4', program_route_ids: ['r9'] }), summary({ id: 'a5', contract_end: '2026-10-10' })];
    expect(headerIssues(list, [rate()], T)).toEqual({ norate: 1, orphan: 1, expiring: 0, contracts30: 1 });
  });
});

describe('list helpers', () => {
  const names = { market: (id: string | null) => (id === 'ru' ? 'Russia' : ''), sales: (id: string | null) => (id === 's1' ? 'Nok' : '') };
  it('searches name, code, sub-market, market and salesperson names', () => {
    const list = [summary(), summary({ id: 'a2', name: 'Blue Sea', code: 'BLU', market_id: 'cn', sales_id: null, sub_market: 'Shanghai' })];
    expect(filterAgents(list, { q: 'russia', market: '', sales: '' }, names).map((a) => a.id)).toEqual(['a1']);
    expect(filterAgents(list, { q: 'shang', market: '', sales: '' }, names).map((a) => a.id)).toEqual(['a2']);
    expect(filterAgents(list, { q: 'nok', market: '', sales: '' }, names).map((a) => a.id)).toEqual(['a1']);
    expect(filterAgents(list, { q: '', market: 'cn', sales: '' }, names).map((a) => a.id)).toEqual(['a2']);
    expect(filterAgents(list, { q: '', market: '', sales: '__none' }, names).map((a) => a.id)).toEqual(['a2']);
  });
  it('groups A–Z without throwing on a missing name (a legacy crash)', () => {
    const groups = groupAZ([summary({ name: 'beta' }), summary({ name: 'Alpha' }), summary({ name: '' }), summary({ name: '7 Seas' })]);
    expect(groups.map(([k, l]) => [k, l.map((a) => a.name)])).toEqual([['#', ['', '7 Seas']], ['A', ['Alpha']], ['B', ['beta']]]);
    expect(initials('Sun Tour Co')).toBe('ST');
    expect(initials('')).toBe('?');
  });
});
