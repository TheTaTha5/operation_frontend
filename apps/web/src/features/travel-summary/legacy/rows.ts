// Travel Summary rows and per-row facts (legacy: accounting.js ts*, 08-app.js, booking.js, checkin.js).
import {
  bookedPax, ckSummary, evLive, eventTally, isOvnReturn, lostByType, opsRead, ovnOutDate, paxAllTot, paxBreak,
  paxLeft, strandMovedRows, tripOn,
} from './checkin';
import { exGot } from './money';
import { az, BKV2_AGENT_PALETTE, CANCELLED, DOCCHK_ITEMS, type Ctx, type Rec } from './context';

/** tsTripAmount · price of that day's trip (multi-day uses the trip subtotal; an OVN return leg is 0) */
export function tripAmount(b: Rec, t: Rec): number {
  if (t && t.ovnLeg) return 0;
  const multi = (b.trips || []).length > 1;
  if (multi && t && typeof t.subtotal === 'number' && t.subtotal > 0) return t.subtotal;
  if (b.priceBreakdown && typeof b.priceBreakdown.total === 'number') return b.priceBreakdown.total;
  return +b.total || 0;
}
/** tsPolicyText */
function policyText(c: Ctx, b: Rec): string {
  const ag = c.agent(b.agentId);
  const p = ag && ag.bookingChannel && ag.bookingChannel.cancelPolicy;
  return p ? String(p) : '';
}
/** tsAgName · agency name, or the sales channel when there is no agent */
export function agName(c: Ctx, b: Rec): string {
  const ag = c.agent(b && b.agentId);
  return ag ? ag.name || ag.code || '—' : String((b && b.channel) || 'walk-in');
}
const routeName = (c: Ctx, id: string) => (c.route(id) || {}).name || id;

/** tsRows · every live booking travelling on `date`, sorted route -> agency -> voucher (§tsSortAZ) */
export function tsRows(c: Ctx, date: string): Rec[] {
  const out: Rec[] = [];
  c.d.bookings.forEach((b) => {
    if (CANCELLED.indexOf(b.status) >= 0) return;
    const t = tripOn(b, date); if (!t) return;
    const O = opsRead(b, date);
    const ovnB = isOvnReturn(t);
    const s = ckSummary(b, date) || { booked: bookedPax(t), noShow: 0 };
    const v = O.vanCheckin || null, pcv = O.pierCheckin || null;
    const events = ([] as Rec[]).concat(evLive(v && v.events), evLive(pcv && pcv.events));
    const booked = s.booked, noShow = s.noShow || 0;
    const L = lostByType(b, date);
    const lostTot = +L.total || 0;
    const decNow = c.tsGet(b.id, date);
    out.push({
      b, t, O, routeId: t.routeId || '',
      booked, travelled: Math.max(0, booked - noShow), noShow,
      ns: +L.ns || 0, cxl: +L.cxl || 0, events,
      van: ovnB ? O.vanReturnId || O.vanId || '' : O.vanId || '', vanCk: v, vanDone: !!(v && v.at),
      vanActual: v && v.actualPax != null ? v.actualPax : null,
      boat: O.boatId || t.charterBoatId || '', pierCk: pcv, pierDone: !!(pcv && pcv.at),
      pierActual: pcv && pcv.actualPax != null ? pcv.actualPax : null, pierExp: pcv && pcv.expected != null ? pcv.expected : null,
      issue: noShow > 0 || lostTot > 0 || !!decNow, amount: tripAmount(b, t), policy: policyText(c, b), dec: decNow,
      ovnBack: ovnB, ovnOut: ovnB ? ovnOutDate(b, t) : '',
    });
  });
  return out.sort((x, y) => az(routeName(c, x.routeId), routeName(c, y.routeId))
    || az(agName(c, x.b), agName(c, y.b))
    || az(x.b.voucherRef || x.b.code || '', y.b.voucherRef || y.b.code || ''));
}

/** tsCxlRows · bookings cancelled outright that still had a trip on `date` */
export function tsCxlRows(c: Ctx, date: string): Rec[] {
  const out: Rec[] = [];
  c.d.bookings.forEach((b) => {
    if (['cancelled', 'cancelled_weather'].indexOf(b.status) < 0) return;
    const t = (b.trips || []).filter((x: Rec) => (x.date || '') === date)[0];
    if (!t) return;
    const O = opsRead(b, date);
    out.push({ b, t, O, routeId: t.routeId || '', cxlRow: true,
      ovnBack: isOvnReturn(t), ovnOut: isOvnReturn(t) ? ovnOutDate(b, t) : '',
      booked: bookedPax(t), travelled: 0, ns: 0, cxl: 0, events: [], van: '', vanCk: null, vanDone: false, vanActual: null,
      boat: '', pierCk: null, pierDone: false, pierActual: null, pierExp: null,
      issue: false, amount: tripAmount(b, t), policy: '', dec: null });
  });
  return out;
}

/** tsMvRows · bookings moved to another day after ops were arranged (§tsManMv) */
export function tsMvRows(c: Ctx, date: string): Rec[] {
  return strandMovedRows(c, date).map((r) => ({
    b: r.b, t: r.t, O: r.O, routeId: (r.t && r.t.routeId) || '',
    cxlRow: true, mvRow: true, mvWhy: r.strandWhy || '', mvTo: r.mvTo || '',
    ovnBack: false, ovnOut: '',
    booked: paxAllTot((r.t && r.t.pax) || {}), travelled: 0, ns: 0, cxl: 0, events: [],
    van: (r.O && r.O.vanId) || '', vanCk: null, vanDone: false, vanActual: null,
    boat: (r.O && r.O.boatId) || '', pierCk: null, pierDone: false, pierActual: null, pierExp: null,
    issue: false, amount: 0, policy: '', dec: c.tsGet(r.b.id, date),
  }));
}

/** tsPaxSplit · booked vs actually travelled, per pax type */
export function paxSplit(r: Rec, date: string): Record<'ad' | 'chd' | 'inf' | 'foc', { b: number; l: number }> {
  const pb = paxBreak(r.t.pax);
  const out = {} as Record<'ad' | 'chd' | 'inf' | 'foc', { b: number; l: number }>;
  (['ad', 'chd', 'inf', 'foc'] as const).forEach((k) => { const bk = pb[k] || 0; out[k] = { b: bk, l: paxLeft(r.b, date, k, bk) }; });
  return out;
}
/** tsDepTime */
export function depTime(c: Ctx, routeId: string): string {
  const t = (c.route(routeId) || {}).times;
  return Array.isArray(t) && t.length ? t.join(' / ') : '';
}

/** tsVatMode · 'include' | 'exclude' | 'none' (walk-ins and agents without a mode count as none) */
export function vatMode(c: Ctx, b: Rec): 'include' | 'exclude' | 'none' {
  if (!b || !b.agentId) return 'none';
  const a = c.agent(b.agentId);
  const m = (a && a.vatMode) || '';
  return m === 'include' || m === 'exclude' ? m : 'none';
}
/** tsHasVat */
export function hasVat(c: Ctx, b: Rec): boolean { return vatMode(c, b) !== 'none'; }
/** tsVatGap · agents in these rows with no VAT mode set yet */
export function vatGap(c: Ctx, rows: Rec[]): string[] {
  const g: Record<string, string> = {};
  (rows || []).forEach((r) => {
    const b = r.b; if (!b || !b.agentId) return;
    const a = c.agent(b.agentId);
    if (a && !a.vatMode) g[b.agentId] = a.name || a.code || b.agentId;
  });
  return Object.keys(g).map((k) => g[k]!);
}

/** docCheckStatus */
function docCheckStatus(bk: Rec): string {
  const dc = bk && bk.docCheck; if (dc && dc.status) return dc.status;
  return ((bk && bk.attachments) || []).length ? 'pending' : 'nofiles';
}
/** tsDocRef · document-check state of a booking */
export function docRef(b: Rec): Rec {
  const st = docCheckStatus(b);
  const att = (b && b.attachments) || [], n = att.length;
  const dc = (b && b.docCheck) || {};
  const M: Record<string, [string, string]> = { verified: ['ตรวจแล้ว', 'g'], issue: ['เอกสารมีปัญหา', 'r'], pending: ['รอตรวจ', 'a'], nofiles: ['ยังไม่แนบ', 'n'] };
  const m = M[st] || M.nofiles!;
  const it = dc.items || {};
  let done = 0; DOCCHK_ITEMS.forEach((x) => { if (it[x.k]) done++; });
  const pr = ((dc.pre || {}).results || {}).voucher || null;
  const ref = pr && pr.ev ? String(pr.ev).replace(/\s+/g, ' ').trim().slice(0, 26) : '';
  const missing = DOCCHK_ITEMS.filter((x) => !it[x.k]).map((x) => x.label);
  const fname = n ? String(att[0].name || 'ไฟล์แนบ') : '';
  let when = '';
  if (dc.at) { try { when = new Date(dc.at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' }); } catch { when = String(dc.at).slice(0, 10); } }
  return { st, n, label: m[0], cls: m[1], by: dc.by || '', at: dc.at || '', when, note: dc.note || '',
    done, tot: DOCCHK_ITEMS.length, missing, docRef: ref, fname, files: att.map((a: Rec) => a.name || 'ไฟล์แนบ') };
}

/** bkV2RetInfo · drop-off and return-van state */
function retInfo(c: Ctx, bk: Rec, date: string): Rec {
  const o = opsRead(bk, date) || {};
  const sep = bk.dropoffSame === false && !!(bk.dropoffHotelName || bk.dropoffArea || bk.dropoffAreaId);
  const drop = sep ? bk.dropoffHotelName || bk.dropoffArea || '' : '';
  let retId: string | null = null, arranged = false, selfRet = false;
  if (sep) {
    const aid = bk.dropoffAreaId || bk.dropoffArea; const ar = aid ? c.area(aid) : null;
    const nm = (ar && ar.name) || bk.dropoffHotelName || String(aid || '');
    if ((ar && (ar.zone === 'NoTransfer' || ar.zone === 'NT')) || /self-?arrive|กลับเอง|self[\s-]?return/i.test(nm)) selfRet = true;
  }
  if (Array.isArray(o.vanSplits) && o.vanSplits.length) {
    const rs = o.vanSplits.map((s: Rec) => s.vanReturnId).filter(Boolean);
    arranged = rs.length > 0 && rs.length === o.vanSplits.length; retId = rs[0] || null;
  } else { retId = o.vanReturnId || null; arranged = !!retId; }
  const sameVan = !!o.returnSameVan;
  return { sep, drop, retId, arranged, selfRet, sameVan, alert: sep && !arranged && !selfRet && !sameVan };
}
/** tsSendBack · drop-off cell: where the customer goes back to and how; null = same as pickup */
export function sendBack(c: Ctx, b: Rec, date: string): { t: string; tag: string; cls: string } | null {
  const ri = retInfo(c, b, date);
  if (ri.selfRet) return { t: String(ri.drop || '').replace(/\s*\(self-?arrive\)/i, '').trim() || '—', tag: 'กลับเอง', cls: 'n' };
  if (!ri.sep) return null;
  if (ri.arranged) { const vn = ri.retId ? (c.vehicle(ri.retId) || {}).name || ri.retId : ''; return { t: ri.drop || '—', tag: '↩ ' + vn, cls: 'g' }; }
  if (ri.sameVan) return { t: ri.drop || '—', tag: '↩ กลับคันเดิม', cls: 'e' };
  return { t: ri.drop || '—', tag: '⚠ ยังไม่จัดรถกลับ', cls: 'r' };
}

/** ckAddonList · add-ons booked with the booking, longtail first (incl. rate-type bundles) */
function ckAddonList(c: Ctx, bk: Rec, routeId: string): Rec[] {
  const out: Rec[] = []; let ltLabel = '', ltNote = '';
  (bk.addOns || []).forEach((a: Rec) => {
    if (a && /^b2c-ad-/i.test(String(a.type || ''))) return;   // §b2cFee
    const ty = String(a.type || ''), lbl = String(a.label || a.type || '');
    if (/longtail|หางยาว/i.test(ty) || /longtail|หางยาว/i.test(lbl)) {
      ltLabel = (lbl || 'Longtail').replace(/\s*\(per boat[^)]*\)/i, '');
      if ((a.note || '').trim()) ltNote = (a.note || '').trim();
    } else if (lbl) out.push({ kind: 'addon', label: lbl, note: (a.note || '').trim() });
  });
  const trip = (bk.trips || []).find((t: Rec) => t.routeId === routeId) || {};
  if (!ltLabel && trip.bundle && trip.bundle.type === 'longtail') ltLabel = 'Longtail' + (trip.bundle.mode === 'free' ? ' (incl.)' : '');
  if (!ltLabel && trip.longtailManual) ltLabel = 'Longtail';
  if (!ltLabel) {
    const rtId = bk.rateTypeRef || (bk.agentId ? (c.agent(bk.agentId) || {}).rateTypeId : null);
    const rt = rtId ? c.rateType(rtId) : null;
    const lb = rt && rt.routeBundles && rt.routeBundles[routeId] && rt.routeBundles[routeId].longtail;
    const applies = (x: Rec, isCharter: boolean) => { if (!x) return false; const a = x.applyTo || 'seat'; return a === 'both' || (isCharter ? a === 'charter' : a === 'seat'); };
    if (lb && applies(lb, trip.bookingMode === 'charter')) ltLabel = 'Longtail' + (lb.mode === 'free' ? ' (incl.)' : ' (bundle)');
  }
  if (ltLabel) out.unshift({ kind: 'longtail', label: ltLabel, note: ltNote });
  return out;
}

export interface Addon { src: 'bk' | 'ex' | 'up' | 'pier'; t: string; qty?: number; amt?: number; done?: boolean; note: string; kind?: string; meal?: boolean }

/** tsAddonList · booked add-ons, site sales, upgrades and special meals for the row's day */
export function addonList(c: Ctx, r: Rec, date: string): Addon[] {
  const b = r.b, rid = (r.t && r.t.routeId) || '', out: Addon[] = [];
  ckAddonList(c, b, rid).forEach((a) => out.push({ src: 'bk', kind: a.kind, t: a.label, note: a.note || '' }));
  c.extrasFor(b.id).forEach((x) => {
    if (date && x.tripDate && x.tripDate !== date) return;
    const PM: Record<string, string> = { cash: 'เงินสด', transfer: 'โอนเงิน', card: 'บัตรเครดิต', cot: 'เก็บวันเดินทาง' };
    const g = exGot(x);
    out.push({ src: 'ex', t: String(x.service || 'ขายเพิ่ม'), qty: +x.qty || 1, amt: +x.total || 0, done: g,
      note: (PM[x.method || 'cash'] || 'เงินสด') + (g ? '' : ' · ยังไม่เก็บ') + (x.seller ? ' · ' + x.seller : '')
        + (g && x.method && x.method !== 'cash' && !(x.slips || []).length ? ' · ยังไม่มีสลิป' : '') });
  });
  (Array.isArray(b.upgrades) ? b.upgrades : []).forEach((u: Rec) => {
    out.push({ src: 'up', t: String(u.label || 'upgrade'), amt: +u.sellPrice || 0, done: !!u.collected, note: u.collected ? 'เก็บเงินแล้ว' : 'ยังไม่เก็บ' });
  });
  const mm = b.specialMeals || {}, ml: string[] = [];
  if (+mm.veg) ml.push('มังสวิรัติ ' + +mm.veg);
  if (+mm.vegan) ml.push('วีแกน ' + +mm.vegan);
  if (+mm.halal) ml.push('ฮาลาล ' + +mm.halal);
  const al = String(mm.allergies || '').trim(); if (al) ml.push('แพ้: ' + al);
  if (ml.length) out.push({ src: mm.pierAt ? 'pier' : 'bk', meal: true, t: ml.join(' · '),
    note: mm.pierAt ? 'สั่งหน้าท่า' + (mm.pierBy ? ' · ' + mm.pierBy : '') : 'มากับใบจอง' });
  return out;
}

/** bkV2AgentColor · the agent's colour, or a stable pick from the palette */
export function agentColor(c: Ctx, agentId: unknown): string {
  const a = c.agent(agentId); if (a && a.color) return a.color;
  const s = String(agentId || (a && a.name) || ''); let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BKV2_AGENT_PALETTE[h % BKV2_AGENT_PALETTE.length]!;
}
/** bkV2ContrastInk */
export function contrastInk(hex: unknown): string {
  const m = String(hex || '').replace('#', ''); if (m.length < 6) return '#fff';
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#2c2c2a' : '#fff';
}
/** Does the row count as "did not board" for its van / boat chips (§tsNoBoard). */
export function noBoard(r: Rec, date: string): { noVan: boolean; noBoat: boolean } {
  const lost = lostByType(r.b, date);
  const gone = r.cxlRow || r.travelled <= 0 || (r.booked > 0 && lost && lost.total >= r.booked);
  const noVan = gone || (r.vanDone && r.vanActual != null && r.vanActual <= 0)
    || (!!r.vanCk && eventTally(r.vanCk).total >= r.booked && r.booked > 0);
  const noBoat = gone || (r.pierDone && r.pierActual != null && r.pierActual <= 0)
    || (!!r.pierCk && eventTally(r.pierCk).total >= r.booked && r.booked > 0);
  return { noVan: !!noVan, noBoat: !!noBoat };
}
