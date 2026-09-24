import { ApiError, getJson } from '@/lib/api';

import type { DayData, Rec } from './legacy/context';

/** GET /api/v1/<resource> -> { <resource>: value } */
async function resource<T>(name: string, empty: T): Promise<T> {
  const r = await getJson<Record<string, T>>(`/api/v1/${name}`);
  return r[name] ?? empty;
}

/** blob.ops_stranded is stored as a JSON string inside the JSON value, so it may arrive parsed once or twice. */
function parseStranded(v: unknown): Record<string, Rec> {
  let x: unknown = v;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return {}; } }
  return x && typeof x === 'object' ? (x as Record<string, Rec>) : {};
}

/**
 * Everything Travel Summary needs for one day. Bookings come from /api/ck (only those with a trip
 * that day), so the page never downloads the whole ~20MB blob that /api/load returns.
 */
export async function loadDay(date: string): Promise<DayData> {
  const [ck, routes, boats, agents, rateTypes, contracts, extras, invoices, payments, vehicles, pickupAreas,
    travelSum, tsCot, meta] = await Promise.all([
    getJson<{ bookings: Rec[] }>(`/api/ck?date=${encodeURIComponent(date)}`),
    resource<Rec[]>('routes', []), resource<Rec[]>('boats', []), resource<Rec[]>('sb_agents', []),
    resource<Rec[]>('sb_rate_types', []), resource<Rec[]>('sb_contracts', []), resource<Rec[]>('sb_extras', []),
    resource<Rec[]>('sb_invoices', []), resource<Rec[]>('sb_payments', []), resource<Rec[]>('sb_vehicles', []),
    resource<Rec[]>('sb_pickup_areas', []),
    resource<Record<string, Rec>>('travel_sum', {}), resource<Record<string, Rec>>('ts_cot', {}),
    getJson<{ value: unknown }>('/api/v1/_meta/ops_stranded'),
  ]);
  const bookings = ck.bookings || [];
  const stranded = parseStranded(meta.value);

  // Bookings moved off this day no longer have a trip on it, so /api/ck does not return them.
  const have = new Set(bookings.map((b) => b.id));
  const missing = Object.keys(stranded)
    .filter((k) => k.endsWith('|' + date))
    .map((k) => k.slice(0, k.lastIndexOf('|')))
    .filter((id) => !have.has(id));
  const moved = await Promise.all(missing.map((id) =>
    getJson<Rec>(`/api/v1/sb_bookings/${encodeURIComponent(id)}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;   // deleted since: nothing to show
      throw e;
    })));

  return { date, bookings: bookings.concat(moved.filter(Boolean)), routes, boats, agents, rateTypes, contracts,
    extras, invoices, payments, vehicles, pickupAreas, travelSum, tsCot, stranded };
}
