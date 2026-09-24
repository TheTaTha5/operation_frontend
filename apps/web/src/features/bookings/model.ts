// Booking list and detail helpers on operation-backend's Booking shape. The list mirrors the legacy
// "All bookings" tab (bkV2RenderTab3 / bkV2Norm in booking.js): status pills, search, travel month,
// newest travel date first. Agent names are not available yet (no agent catalogue in the backend).
import type { ObBooking, ObBookingStatus, ObRoute } from '@/lib/ob';

export const STATUS_LABEL: Record<ObBookingStatus, string> = {
  draft: 'Draft', quote: 'Quote', pending: 'Pending', pending_approval: 'รออนุมัติ', pending_foc: 'Pending FOC',
  confirmed: 'Confirmed', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled',
  cancelled_weather: 'Cancelled · weather',
};
export const statusLabel = (s: string) => STATUS_LABEL[s as ObBookingStatus] || s;

/** Legacy's pills, in legacy order. `b2c` is not a status: it is the B2C channel. */
export const PILLS = [
  { k: 'all', label: 'All' }, { k: 'b2c', label: 'B2C' }, { k: 'quote', label: 'Quote' },
  { k: 'pending_foc', label: 'Pending FOC' }, { k: 'confirmed', label: 'Confirmed' },
  { k: 'completed', label: 'Completed' }, { k: 'cancelled', label: 'Cancelled' }, { k: 'rejected', label: 'Rejected' },
] as const;
export type PillKey = (typeof PILLS)[number]['k'];

export interface PaxSplit { ad: number; chd: number; inf: number; foc: number; total: number }

/** Sums the flat grid (`ad`, `ad_fr`, `ad_th`, …) of every trip by age category. */
export function paxSplit(b: Pick<ObBooking, 'trips'>): PaxSplit {
  const out: PaxSplit = { ad: 0, chd: 0, inf: 0, foc: 0, total: 0 };
  for (const t of b.trips) {
    for (const [k, v] of Object.entries(t.pax || {})) {
      const cat = k.split('_')[0] as keyof PaxSplit;
      if (cat in out && cat !== 'total') { out[cat] += Number(v) || 0; out.total += Number(v) || 0; }
    }
  }
  return out;
}

/** "2A · 1C · 0I" plus "· 1 FOC", as the legacy list. */
export const paxBreak = (p: PaxSplit) => `${p.ad}A · ${p.chd}C · ${p.inf}I` + (p.foc ? ` · ${p.foc} FOC` : '');

export const isB2C = (b: Pick<ObBooking, 'agent_id' | 'external_id' | 'id'>) =>
  b.agent_id === 'a_b2c' || /^b2c_/.test(b.external_id || '') || /^(lg_)?b2c_/.test(b.id);

/** The code staff know: the legacy BK number, or the voucher for a B2C booking (legacy bkV2DisplayCode). */
export function displayCode(b: Pick<ObBooking, 'id' | 'external_id' | 'voucher_ref' | 'agent_id'>): string {
  const ext = b.external_id || b.id.replace(/^lg_/, '');
  if (!/^b2c_/.test(ext)) return ext;
  const m = /^b2c_(.+)_(\d+)$/.exec(ext);
  return b.voucher_ref || (m ? m[1]! : ext);
}

/** One route's name, or "2 trips · Similan + Phi" for a multi-trip booking (legacy tripSummary). */
export function tripSummary(b: Pick<ObBooking, 'trips'>, routes: ReadonlyMap<string, ObRoute>): string {
  const name = (id: string) => routes.get(id)?.name || id;
  if (b.trips.length === 1) return name(b.trips[0]!.route_id);
  return `${b.trips.length} trips · ${b.trips.map((t) => name(t.route_id).split(' ')[0]).filter(Boolean).join(' + ')}`;
}

/** Travel date = the first trip's date (`service_date` is derived from it by the backend). */
export const travelDate = (b: Pick<ObBooking, 'service_date' | 'trips'>) => b.service_date || b.trips[0]?.service_date || '';

export function matchesPill(b: ObBooking, k: PillKey): boolean {
  if (k === 'all') return true;
  if (k === 'b2c') return isB2C(b);
  if (k === 'cancelled') return b.status === 'cancelled' || b.status === 'cancelled_weather';
  return b.status === k;
}

export function matchesSearch(b: ObBooking, q: string, routes: ReadonlyMap<string, ObRoute>): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [displayCode(b), b.id, b.external_id, b.voucher_ref, b.lead_pax, b.lead_phone, b.agent_id, tripSummary(b, routes)]
    .some((x) => (x || '').toLowerCase().includes(s));
}

export interface Kpis { total: number; confirmed: number; confirmedRevenue: number; pendingFoc: number; quote: number }
export function kpis(list: readonly ObBooking[]): Kpis {
  const conf = list.filter((b) => b.status === 'confirmed');
  return {
    total: list.length,
    confirmed: conf.length,
    confirmedRevenue: conf.reduce((a, b) => a + (Number(b.total) || 0), 0),
    pendingFoc: list.filter((b) => b.status === 'pending_foc').length,
    quote: list.filter((b) => b.status === 'quote').length,
  };
}

/**
 * The month's list: bookings whose FIRST trip is in the month (the range query also returns a
 * booking whose later trip falls in it), newest travel date first, then newest created.
 */
export function monthList(all: readonly ObBooking[], month: string): ObBooking[] {
  return all
    .filter((b) => travelDate(b).startsWith(month))
    .sort((a, b) => travelDate(b).localeCompare(travelDate(a)) || b.created_at.localeCompare(a.created_at));
}

export const fmtDate = (d: string | undefined) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? d + 'T00:00' : d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};
export const fmtDateLong = (d: string | undefined) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? d + 'T00:00' : d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};
export const thb = (n: number | undefined) => '฿' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
