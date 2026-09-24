// Booking ops, pax and check-in helpers (legacy: 04-data-core.js, booking.js, checkin.js, 08-app.js).
import { CK_NOSHOW_REASONS, PAXK, type Ctx, type Rec } from './context';

/** bkV2PaxTot · kind: 'ad' | 'chd' | 'inf' | 'foc' */
export function paxTot(pax: Rec, kind: string): number {
  if (!pax) return 0;
  return (pax[kind] || 0) + (pax[`${kind}_fr`] || 0) + (pax[`${kind}_th`] || 0);
}
/** bkV2PaxAllTot */
export function paxAllTot(pax: Rec): number {
  return paxTot(pax, 'ad') + paxTot(pax, 'chd') + paxTot(pax, 'inf') + paxTot(pax, 'foc');
}
/** ckBookedPax */
export function bookedPax(t: Rec): number { return paxAllTot((t && t.pax) || {}); }
/** ckPaxBreak */
export function paxBreak(p: Rec): { ad: number; chd: number; inf: number; foc: number } {
  p = p || {};
  const t = (k: string) => (+p[k] || 0) + (+p[k + '_fr'] || 0) + (+p[k + '_th'] || 0);
  return { ad: t('ad'), chd: t('chd'), inf: t('inf'), foc: t('foc') };
}

/** bkTripDates */
export function tripDates(b: Rec): string[] {
  return [...new Set(((b && b.trips) || []).map((t: Rec) => t.date).filter(Boolean) as string[])].sort();
}
/** bkIsFirstDay */
export function isFirstDay(b: Rec, date: string): boolean {
  const ds = tripDates(b);
  return !date || ds.length <= 1 || date === ds[0];
}
/** bkOpsRead · bk.ops is day-1 only; later days keep their ops on the trip */
export function opsRead(b: Rec, date: string): Rec {
  if (!b) return {};
  if (isFirstDay(b, date)) return b.ops || {};
  const t = (b.trips || []).find((x: Rec) => x.date === date);
  return (t && t.ops) || {};
}
/** ckTripOn */
export function tripOn(b: Rec, date: string): Rec | null {
  return ((b && b.trips) || []).find((x: Rec) => (x.date || '') === date) || null;
}
/** bkIsOvnReturn */
export function isOvnReturn(t: Rec): boolean { return !!(t && t.ovnLeg); }
/** _ovnOutDate */
export function ovnOutDate(b: Rec, leg: Rec): string {
  if (!leg || !leg.ovnLeg) return '';
  const out = (b.trips || []).find((x: Rec) => x.ovn === 'return' && x.ovnReturnDate === leg.date && x.routeId === leg.routeId);
  return out ? out.date || '' : '';
}

/** ckEvLive · events that were not undone (§ckBack) */
export function evLive(ev: Rec): Rec[] {
  return (Array.isArray(ev) ? ev : []).filter((x: Rec) => x && !x.undone);
}
/** ckEventTally */
export function eventTally(ck: Rec): { no_show: number; cxl: number; total: number } {
  const out: Record<string, number> = { no_show: 0, cxl: 0, total: 0 };
  evLive(ck && ck.events).forEach((x) => {
    const n = Math.max(0, +x.pax || 0); if (!n) return;
    if (out[x.type] != null) out[x.type] = (out[x.type] ?? 0) + n;
    out.total = (out.total ?? 0) + n;
  });
  return out as { no_show: number; cxl: number; total: number };
}
/** ckReasonDef */
export function reasonDef(code: unknown) { return CK_NOSHOW_REASONS.find((r) => r.code === code) || null; }
/** ckReasonLabel */
export function reasonLabel(code: unknown): string { const d = reasonDef(code); return d ? d.label : String(code || ''); }
/** ckExpectAtPier */
export function expectAtPier(code: unknown): boolean { const d = reasonDef(code); return !!(d && d.expectAtPier); }

/**
 * ckRead · Travel Summary only ever reads the plain 'van' / 'pier' kinds, for which the legacy
 * slot lookup (_ckSlot) returns null and this is just the check-in object on that day's ops.
 */
export function ckRead(b: Rec, date: string, kind: 'van' | 'pier'): Rec | null {
  const o = opsRead(b, date);
  return (kind === 'pier' ? o.pierCheckin : o.vanCheckin) || null;
}

/** ckSummary */
export function ckSummary(b: Rec, date: string): Rec | null {
  const t = tripOn(b, date); if (!t) return null;
  const booked = bookedPax(t);
  const v = ckRead(b, date, 'van'), p = ckRead(b, date, 'pier');
  const out: Rec = { booked, van: v, pier: p, vanNoShow: 0, pierNoShow: 0, noShow: 0, at: '', reasonText: '', stage: '' };
  if (v && v.at) out.vanNoShow = Math.max(0, booked - (v.actualPax != null ? v.actualPax : booked));
  if (p && p.at) { const exp = p.expected != null ? p.expected : booked; out.pierNoShow = Math.max(0, exp - (p.actualPax != null ? p.actualPax : exp)); }
  out.noShow = p && p.at ? Math.max(0, booked - (p.actualPax != null ? p.actualPax : booked)) : out.vanNoShow;
  let src: Rec = null;
  if (p && p.at && out.pierNoShow > 0) { src = p; out.stage = 'pier'; }
  else if (v && v.at && out.vanNoShow > 0) { src = v; out.stage = 'van'; }
  else if (p && p.at) out.stage = 'pier';
  else if (v && v.at) out.stage = 'van';
  if (src) { out.at = src.reasonAt || ''; out.reasonText = (src.reasonCode ? reasonLabel(src.reasonCode) : '') + (src.reasonNote ? ' · ' + src.reasonNote : ''); }
  return out;
}

export interface Lost { ad: number; chd: number; inf: number; foc: number; total: number; unalloc: number; ns: number; cxl: number; selfPier: number }

/** ckLostByType · who really did not travel, by pax type (§ckSelfPier, §ckPierFix, §ckSelfLost) */
export function lostByType(b: Rec, date: string): Lost {
  const out: Lost = { ad: 0, chd: 0, inf: 0, foc: 0, total: 0, unalloc: 0, ns: 0, cxl: 0, selfPier: 0 };
  const O = opsRead(b, date);
  const reins = !!(O.pierCheckin && O.pierCheckin.reinstate);
  ([['van', O.vanCheckin], ['pier', O.pierCheckin]] as const).forEach(([kind, ck]) => {
    evLive(ck && ck.events).forEach((x) => {
      const n = Math.max(0, +x.pax || 0); if (!n) return;
      if (kind === 'van' && x.type !== 'cxl' && (reins || expectAtPier(x.reasonCode))) { out.selfPier += n; return; }
      out.total += n; if (x.type === 'cxl') out.cxl += n; else out.ns += n;
      const pb = x.paxBreak;
      if (pb && (pb.ad || pb.chd || pb.inf || pb.foc)) { out.ad += +pb.ad || 0; out.chd += +pb.chd || 0; out.inf += +pb.inf || 0; out.foc += +pb.foc || 0; }
      else out.unalloc += n;
    });
  });
  const sa = O.pierCheckin && O.pierCheckin.selfAdd && (+O.pierCheckin.selfAdd.pax || 0) > 0 ? O.pierCheckin.selfAdd : null;
  if (sa) {
    const back = Math.min(out.total, Math.max(0, +sa.pax || 0));
    if (back > 0) {
      let rest = back;
      PAXK.forEach((k) => { const q = Math.min(out[k], Math.max(0, +sa[k] || 0), rest); out[k] -= q; rest -= q; });
      if (rest > 0) { const u = Math.min(out.unalloc, rest); out.unalloc -= u; rest -= u; }
      while (rest > 0) {
        let big: (typeof PAXK)[number] | '' = '', bn = 0;
        PAXK.forEach((k) => { if (out[k] > bn) { bn = out[k]; big = k; } });
        if (!big) break;
        out[big]--; rest--;
      }
      const used = back - rest;
      const nn = Math.min(out.ns, used); out.ns -= nn;
      out.cxl = Math.max(0, out.cxl - (used - nn));
      out.total -= used; out.selfPier += used;
    }
  }
  return out;
}

/** ckPaxLeft */
export function paxLeft(b: Rec, date: string, k: (typeof PAXK)[number], booked: number): number {
  const L = lostByType(b, date);
  let left = Math.max(0, (booked || 0) - (L[k] || 0));
  if (L.unalloc > 0 && k === 'ad') left = Math.max(0, left - L.unalloc);
  return left;
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** ckDayShortTh · 2026-09-24 -> "24 ก.ย." */
export function dayShortTh(ymd: unknown): string {
  const v = String(ymd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const p = v.split('-');
  return +p[2]! + ' ' + TH_MONTHS[+p[1]! - 1];
}
/** ckShortDay · ISO timestamp -> "24 ก.ย. 14:05" (local time) */
export function shortDay(iso: unknown): string {
  if (!iso) return '';
  const d = new Date(iso as string); if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
/** ckStrandMvWhy */
export function strandMvWhy(R: Rec): string {
  const bits: string[] = [];
  const to = dayShortTh(R.to || '');
  bits.push(to ? 'เลื่อนไป ' + to : 'ย้ายวันออกไป');
  const w = shortDay(R.at || ''); if (w) bits.push(w);
  if (R.by) bits.push(R.by);
  if (R.ckVan || R.ckPier) bits.push('เคยเช็คอินแล้ว');
  return bits.join(' · ');
}
/** ckStrandMovedRows · bookings moved off `date` after ops had been arranged (§strandMove) */
export function strandMovedRows(c: Ctx, date: string): Rec[] {
  const S = c.d.stranded || {}, out: Rec[] = [];
  Object.keys(S).forEach((k) => {
    const i = k.lastIndexOf('|'); if (i < 0) return;
    if (k.slice(i + 1) !== date) return;
    const id = k.slice(0, i), R = S[k] || {};
    const b = c.d.bookings.filter((x) => x.id === id)[0];
    if (!b) return;
    const vid = R.vanId || ((R.splits || []).filter((x: Rec) => x.vanId)[0] || {}).vanId || '';
    out.push({
      b,
      t: { routeId: R.routeId || '', date, zone: R.zone || '', pax: R.pax || {}, pickupTime: R.pickupTime || '' },
      O: { vanId: vid, vanReturnId: R.vanReturnId || '', vanGroup: +R.vanGroup || 0, vanSeq: +R.vanSeq || 0,
        boatId: R.boatId || '', pickupTimeFinal: R.pickupTime || '' },
      booked: 0, expect: 0, ck: null, van: null, _vd: null,
      vanId: vid, vanIds: vid ? [vid] : [], bid: R.boatId || '',
      strand: 'mv', strandWhy: strandMvWhy(R), mvTo: R.to || '', _mvKey: k,
    });
  });
  return out;
}
