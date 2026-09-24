// Typed view model for the Travel Summary page, built from the legacy port in ./legacy.
// Mirrors renderTravelSum / tsManifestRow / tsPayCell / tsCxlCell (08-app.js, accounting.js) minus the HTML.
import { dayShortTh, lostByType } from './legacy/checkin';
import { Ctx, pckNum, type DayData, type Rec } from './legacy/context';
import { moneyOf, noCollect, proformaPaidDate, saleList, slipsForMethod, totalOf } from './legacy/money';
import { netOf, type NetPrice } from './legacy/pricing';
import {
  addonList, agentColor, agName, contrastInk, depTime, docRef, hasVat, noBoard, paxSplit, sendBack, tsCxlRows, tsMvRows,
  tsRows, vatGap, type Addon,
} from './legacy/rows';
import { az } from './legacy/context';

/** Chip colours used by the legacy stylesheet: green, red, amber, neutral, emerald, blue, purple. */
export type Tone = 'g' | 'r' | 'a' | 'n' | 'e' | 'b' | 'p';
export type VatFilter = '' | 'vat' | 'novat';
export interface Filters { route: string; vat: VatFilter; onlyIssue: boolean }

export const DECISIONS: Record<string, [string, Tone]> = {
  full: ['เก็บเต็ม', 'g'], partial: ['เก็บบางส่วน', 'a'], none: ['ไม่ชาร์จ', 'n'], postpone: ['เลื่อนวัน', 'p'],
};

export const money = (n: unknown) => '฿' + Number(n || 0).toLocaleString('en-US');
/** §pierDecimal · on-site amounts can carry satang */
export const moneyDec = (n: unknown) => '฿' + pckNum(n);

export interface RoutePill { id: string; name: string; color: string; bookings: number; pax: number; empty: boolean }
export interface Kpis {
  bookings: number; booked: number; travelled: number; noShow: number; cxlOnSite: number;
  pending: number; decided: number; charge: number; postponed: number;
  collectTarget: number; collectCount: number; stillDue: number; siteSales: number; siteSaleCount: number;
}
export interface Doc { verified: number; issue: number; pending: number; nofiles: number }

export type PayLine =
  | { kind: 'chip'; tone: Tone; text: string; title?: string }
  | { kind: 'due' | 'note' | 'ok' | 'warn' | 'note2'; text: string; title?: string; strike?: boolean }
  | { kind: 'methods'; items: { tone: Tone; label: string; slips: number }[] };

export interface CxlCell { chips: { tone: Tone; text: string }[]; lines: string[]; empty: boolean }

export interface ManifestRow {
  key: string;
  kind: 'live' | 'cxl' | 'moved';
  voucher: string;
  agency: { name: string; color: string; ink: string; b2c: boolean };
  lead: string; phone: string;
  pax: Record<'ad' | 'chd' | 'inf' | 'foc', { booked: number; left: number }>;
  travelled: number; booked: number;
  ovnBack: boolean; ovnOut: string;
  pickup: string; room: string;
  dropoff: { t: string; tag: string; cls: string } | null;
  addons: Addon[];
  van: { name: string; noBoard: boolean } | null;
  boat: { name: string; noBoard: boolean } | null;
  pay: PayLine[];
  total: { all: number; base: number; site: number; parts: [string, number][]; net: NetPrice | null } | null;
  cxl: CxlCell;
  moved: { why: string; to: string } | null;
  status: { tone: Tone; text: string; sub?: string };
}
export interface RouteGroup {
  routeId: string; name: string; color: string; depTime: string;
  bookings: number; booked: number; travelled: number; cancelled: number; moved: number;
  rows: ManifestRow[];
}
export interface TravelSummary {
  date: string; docNo: string;
  routes: RoutePill[]; routeTotal: number;
  vat: { all: number; vat: number; novat: number; gap: string[] };
  kpis: Kpis; docs: Doc;
  groups: RouteGroup[];
}

/** Everything the page shows for one day and one set of filters. */
export function buildTravelSummary(data: DayData, f: Filters): TravelSummary {
  const c = new Ctx(data), date = data.date;
  const everything = tsRows(c, date);

  // §tsRoute · pills come from the whole day; counts follow the VAT filter (§tsRefFollowVat)
  const rMap: Record<string, { n: number; pax: number }> = {}, rOrder: string[] = [];
  everything.forEach((r) => {
    const k = r.routeId || '';
    if (!rMap[k]) { rMap[k] = { n: 0, pax: 0 }; rOrder.push(k); }
    if (f.vat && (f.vat === 'vat' ? !hasVat(c, r.b) : hasVat(c, r.b))) return;
    rMap[k]!.n++; rMap[k]!.pax += r.travelled;
  });
  const route = f.route && rMap[f.route] ? f.route : '';
  const docNo = 'TS-' + date.replace(/-/g, '') + (route ? '-' + route.toUpperCase() : '-ALL') + (f.vat ? (f.vat === 'vat' ? '-VAT' : '-NOVAT') : '');
  const allDay = route ? everything.filter((r) => (r.routeId || '') === route) : everything;
  let nVat = 0, nNoVat = 0;
  allDay.forEach((r) => { if (hasVat(c, r.b)) nVat++; else nNoVat++; });
  const vatKeep = (r: Rec) => (f.vat === 'vat' ? hasVat(c, r.b) : !hasVat(c, r.b));
  const all = f.vat ? allDay.filter(vatKeep) : allDay;
  const issues = all.filter((r) => r.issue);
  const rows = f.onlyIssue ? issues : all;

  // ── totals (section 1) ──
  let tBooked = 0, tTrav = 0, tNs = 0, tCxl = 0, nDecided = 0, charge = 0, nPostpone = 0;
  all.forEach((r) => {
    tBooked += r.booked; tTrav += r.travelled; tNs += r.ns; tCxl += r.cxl;
    if (r.issue && r.dec) { nDecided++; if (r.dec.decision === 'postpone') nPostpone++; else charge += +r.dec.amount || 0; }
  });
  const mAll = all.map((r) => { const m = moneyOf(c, r.b, date); m.r = r; m.S = saleList(c, r.b, date); m.cxl = noCollect(r, m.paid); return m; });
  const mRows = mAll.filter((m) => m.target > 0 || m.paid > 0 || m.S.tot > 0);
  let sumDue = 0, sumTarget = 0, sumSale = 0, nSale = 0;
  mRows.forEach((m) => { if (!m.cxl) { sumDue += m.due; sumTarget += m.target; } sumSale += m.S.tot; nSale += m.S.n; });

  const docs: Doc = { verified: 0, issue: 0, pending: 0, nofiles: 0 };
  all.forEach((r) => { const st = docRef(r.b).st as keyof Doc; docs[st] = (docs[st] || 0) + 1; });

  // ── manifest (section 4): live rows + cancelled + moved, route -> live first -> agency -> voucher ──
  let cxlAll = tsCxlRows(c, date), mvAll = tsMvRows(c, date);
  if (route) { cxlAll = cxlAll.filter((x) => (x.routeId || '') === route); mvAll = mvAll.filter((x) => (x.routeId || '') === route); }
  if (f.vat) { cxlAll = cxlAll.filter(vatKeep); mvAll = mvAll.filter(vatKeep); }
  const rName = (id: string) => (c.route(id) || {}).name || id;
  const mrows = rows.concat(cxlAll).concat(mvAll).sort((x, y) => az(rName(x.routeId), rName(y.routeId))
    || (x.cxlRow ? 1 : 0) - (y.cxlRow ? 1 : 0)
    || az(agName(c, x.b), agName(c, y.b))
    || az(x.b.voucherRef || x.b.code || '', y.b.voucherRef || y.b.code || ''));

  const groups: RouteGroup[] = [];
  for (const r of mrows) {
    let g = groups[groups.length - 1];
    if (!g || g.routeId !== r.routeId) {
      const rt = c.route(r.routeId) || {};
      const live = mrows.filter((x) => x.routeId === r.routeId && !x.cxlRow);
      g = { routeId: r.routeId, name: rt.name || r.routeId || '—', color: rt.color || '#999', depTime: depTime(c, r.routeId),
        bookings: live.length, booked: live.reduce((a, x) => a + x.booked, 0), travelled: live.reduce((a, x) => a + x.travelled, 0),
        cancelled: mrows.filter((x) => x.routeId === r.routeId && x.cxlRow && !x.mvRow).length,
        moved: mrows.filter((x) => x.routeId === r.routeId && x.mvRow).length, rows: [] };
      groups.push(g);
    }
    g.rows.push(manifestRow(c, r, date));
  }

  return {
    date, docNo,
    routes: rOrder.map((k) => ({ id: k, name: (c.route(k) || {}).name || k || '—', color: (c.route(k) || {}).color || '#8b909c',
      bookings: rMap[k]!.n, pax: rMap[k]!.pax, empty: rMap[k]!.n === 0 })),
    routeTotal: rOrder.reduce((a, k) => a + rMap[k]!.n, 0),
    vat: { all: allDay.length, vat: nVat, novat: nNoVat, gap: vatGap(c, allDay) },
    kpis: { bookings: all.length, booked: tBooked, travelled: tTrav, noShow: tNs, cxlOnSite: tCxl,
      pending: issues.length - nDecided, decided: nDecided, charge, postponed: nPostpone,
      collectTarget: sumTarget, collectCount: mRows.filter((m) => !m.cxl).length, stillDue: sumDue, siteSales: sumSale, siteSaleCount: nSale },
    docs, groups,
  };
}

function manifestRow(c: Ctx, r: Rec, date: string): ManifestRow {
  const b = r.b;
  const ag = c.agent(b.agentId);
  const color = b.agentId ? agentColor(c, b.agentId) : '#64748B';
  const mm = moneyOf(c, b, date);
  const kind: ManifestRow['kind'] = r.mvRow ? 'moved' : r.cxlRow ? 'cxl' : 'live';
  const px = paxSplit(r, date);
  const nb = noBoard(r, date);
  const veh = r.van ? c.vehicle(r.van) || {} : null;
  const boat = r.boat ? c.boat(r.boat) || {} : null;

  let status: ManifestRow['status'];
  if (r.mvRow) status = { tone: 'p', text: '✗ เลื่อนวัน', sub: r.mvTo ? 'ไป ' + dayShortTh(r.mvTo) : undefined };
  else if (r.cxlRow) status = { tone: 'r', text: 'CXL · ยกเลิก' };
  else if (r.issue) {
    const d = r.dec;
    status = d && DECISIONS[d.decision]
      ? { tone: DECISIONS[d.decision]![1], text: DECISIONS[d.decision]![0] + (d.decision === 'postpone' ? '' : ' · ' + money(d.amount)) }
      : { tone: 'r', text: 'รอตัดสิน' };
  } else status = mm.due > 0 ? { tone: 'a', text: 'รอเก็บ ' + money(mm.due) } : { tone: 'g', text: '✓ เรียบร้อย' };

  let total: ManifestRow['total'] = null;
  if (!r.mvRow) { const T = totalOf(c, r, date); total = { ...T, net: netOf(c, r) }; }

  return {
    key: kind + ':' + b.id,
    kind,
    voucher: b.voucherRef || b.code || '—',
    agency: { name: ag ? ag.name || ag.code || '—' : b.channel || 'walk-in', color, ink: contrastInk(color), b2c: /^b2c_/.test(String(b.id || '')) },
    lead: b.leadPax || '—', phone: b.leadPhone || b.phone || '',
    pax: { ad: { booked: px.ad.b, left: px.ad.l }, chd: { booked: px.chd.b, left: px.chd.l }, inf: { booked: px.inf.b, left: px.inf.l }, foc: { booked: px.foc.b, left: px.foc.l } },
    travelled: r.cxlRow ? 0 : r.travelled, booked: r.booked,
    ovnBack: !!r.ovnBack, ovnOut: r.ovnOut || '',
    pickup: b.hotelName || b.pickup || '', room: b.roomNo || b.room || b.roomNumber || '',
    dropoff: sendBack(c, b, date),
    addons: addonList(c, r, date),
    van: veh ? { name: veh.name || r.van, noBoard: nb.noVan } : null,
    boat: boat ? { name: boat.name || r.boat, noBoard: nb.noBoat } : null,
    pay: r.mvRow ? [] : payCell(c, r, date, mm),
    total,
    cxl: r.mvRow ? { chips: [], lines: [], empty: true } : cxlCell(r, date),
    moved: r.mvRow ? { why: r.mvWhy || '', to: r.mvTo || '' } : null,
    status,
  };
}

/** tsPayCell */
function payCell(c: Ctx, r: Rec, date: string, X: Rec): PayLine[] {
  const b = r.b, M = X.M, L: PayLine[] = [];
  const PT: Record<string, [string, Tone]> = { invoice: ['Invoice', 'n'], credit: ['Invoice', 'n'], proforma: ['Proforma', 'e'],
    prepaid: ['Proforma', 'e'], cot: ['COT', 'a'], bt: ['โอนล่วงหน้า', 'e'] };
  const pt = PT[M.payType || ''];
  if (pt) {
    const pf = M.payType === 'proforma' || M.payType === 'prepaid' ? proformaPaidDate(c, b) : '';
    L.push({ kind: 'chip', tone: pt[1], text: pt[0] + (pf ? ' · ' + pf : ''), title: 'เงื่อนไขการชำระของ agent' + (pf ? ' · ชำระวันที่ ' + pf : '') });
  } else if (!b.agentId) L.push({ kind: 'chip', tone: 'n', text: 'Walk-in' });
  const IV = X.inv || {};
  if (IV.inv) {
    if (IV.settled) L.push({ kind: 'chip', tone: 'g', text: '✓ จ่ายผ่านบิลแล้ว',
      title: 'รับเงินครบแล้วตามใบแจ้งหนี้ ' + IV.no + ' ' + moneyDec(IV.paid) + (IV.nBk > 1 ? ' · ใบนี้คุม ' + IV.nBk + ' booking' : '') });
    else if (IV.paid > 0) L.push({ kind: 'chip', tone: 'b', text: 'บิลชำระบางส่วน',
      title: 'ใบแจ้งหนี้ ' + IV.no + ' รับแล้ว ' + moneyDec(IV.paid) + ' · ค้าง ' + moneyDec(IV.bal) + (IV.nBk > 1 ? ' · ใบนี้คุม ' + IV.nBk + ' booking ปันส่วนรายใบไม่ได้' : '') });
  }
  if (r.cxlRow) {
    const cc = b.cancellation || null;
    L.push({ kind: 'due', text: cc && +cc.chargeAmount > 0 ? 'ค่าปรับ ' + moneyDec(cc.chargeAmount) : 'ไม่มียอดเก็บ' });
    return L;
  }
  if (noCollect(r, X.paid)) {
    if (X.due > 0) L.push({ kind: 'due', text: 'ต้องเก็บ ' + moneyDec(X.due), strike: true });
    L.push({ kind: 'note', text: (+r.cxl > 0 ? 'ยกเลิกหน้างาน' : 'ไม่มา') + ' · ไม่นับเข้ายอดวันนี้' });
    return L;
  }
  if (X.due > 0) {
    const parts: string[] = [];
    if (M.cot > 0) parts.push('COT ' + moneyDec(M.cot));
    if (M.balance > 0) parts.push('ค้าง ' + moneyDec(M.balance));
    if (M.upDue > 0) parts.push('upgrade ' + moneyDec(M.upDue));
    if (X.billed > 0) parts.push('จ่ายผ่านบิล ' + moneyDec(X.billed));
    if (M.pierPaid > 0) parts.push('เก็บแล้ว ' + moneyDec(M.pierPaid));
    L.push({ kind: 'due', text: 'ต้องเก็บ ' + moneyDec(X.due), title: parts.join(' · ') });
    if (parts.length) L.push({ kind: 'note', text: parts.join(' · ') });
  } else if (M.pierPaid > 0) L.push({ kind: 'ok', text: '✓ เก็บครบ ' + moneyDec(M.pierPaid) });
  else if (M.payType === 'cot' && !(X.inv && X.inv.settled)) L.push({ kind: 'note', text: 'COT · ยังไม่ระบุยอด' });
  if (M.cot > 0) {
    const cd = c.tsCotGet(b.id, date);
    let lb: string, cls: Tone, tip: string;
    if (cd) {
      const dd = +cd.deduct || 0, pp = +cd.payout || 0, kk = (+M.cot || 0) - dd - pp, PP: string[] = [];
      if (dd > 0) PP.push('หักบิล ' + moneyDec(dd));
      if (pp > 0) PP.push('โอนออก ' + moneyDec(pp));
      if (kk > 0) PP.push('บริษัทรับไว้ ' + moneyDec(kk));
      lb = PP.join(' · ') || 'ไม่หักบิล';
      cls = pp > 0 ? 'p' : dd > 0 ? 'b' : 'e';
      tip = 'ตัดสินไว้ในส่วนเงินหน้างาน' + (cd.by ? ' โดย ' + cd.by : '') + (cd.ref ? ' · ' + cd.ref : '');
    } else {
      lb = 'ตั้งไว้ ' + (M.handling === 'separate' ? 'แยกจากบิล' : 'หักจากบิล');
      cls = M.handling === 'separate' ? 'a' : 'n';
      tip = 'ค่าที่ตั้งไว้ตอนเปิด booking · ยังไม่ได้ตัดสินว่าจะหักบิลจริงเท่าไหร่';
    }
    L.push({ kind: 'chip', tone: cls, text: 'COT ' + moneyDec(M.cot) + ' · ' + lb, title: tip });
    if (!cd) L.push({ kind: 'warn', text: '⚠ ยังไม่ตัดสินการหักบิล' });
    if (M.note) L.push({ kind: 'note2', text: '📝 ' + M.note, title: M.note });
  }
  const PMB: Record<string, [string, Tone]> = { cash: ['เงินสด', 'e'], transfer: ['โอนเงิน', 'b'], card: ['บัตรเครดิต', 'p'] };
  const S = saleList(c, b, date);
  const byAll: Record<string, number> = {};
  Object.keys(X.by || {}).forEach((k) => { if (X.by[k] > 0) byAll[k] = (byAll[k] || 0) + X.by[k]; });
  Object.keys(S.by || {}).forEach((k) => { if (S.by[k] > 0) byAll[k] = (byAll[k] || 0) + S.by[k]; });
  const who: string[] = []; if (X.who) who.push(X.who);
  (S.list || []).forEach((x: Rec) => { if (x.who && who.indexOf(x.who) < 0) who.push(x.who); });
  const mk = Object.keys(byAll).filter((k) => byAll[k]! > 0);
  if (mk.length) {
    L.push({ kind: 'methods', items: mk.map((k) => {
      const d = PMB[k] || [k, 'n' as Tone];
      return { tone: d[1], label: d[0] + ' ' + moneyDec(byAll[k]), slips: slipsForMethod(b, date, k, S).length };
    }) });
    if (who.length) L.push({ kind: 'note2', text: 'รับโดย ' + who.join(' · ') });
  }
  const ns = (+M.noSlip || 0) + (+S.noSlip || 0);
  if (ns > 0) L.push({ kind: 'warn', text: '⚠ รอสลิป ' + ns });
  const fee = (+M.pierFee || 0) + (+S.fee || 0);
  if (fee > 0) L.push({ kind: 'note2', text: 'ค่าธรรมเนียม ' + moneyDec(fee) });
  return L;
}

/** tsCxlCell */
function cxlCell(r: Rec, date: string): CxlCell {
  const b = r.b, cc = b.cancellation || null;
  if (b.status === 'cancelled' || b.status === 'cancelled_weather') {
    const lbl = cc
      ? cc.chargeType === 'full' ? 'เก็บเต็ม ' + money(cc.chargeAmount || 0)
        : cc.chargeType === 'partial' ? 'เก็บบางส่วน ' + money(cc.chargeAmount || 0) : 'ไม่ชาร์จ'
      : b.status === 'cancelled_weather' ? 'ยกเลิกเพราะอากาศ' : 'ยกเลิก';
    return { chips: [{ tone: 'r', text: 'ยกเลิกทั้งใบ' }], lines: [lbl].concat(cc && cc.reason ? [cc.reason] : []), empty: false };
  }
  const Lt = lostByType(b, date);
  if (!Lt || !Lt.total) return { chips: [], lines: [], empty: true };
  const w: string[] = [];
  if (Lt.ns) w.push('No-show ' + Lt.ns);
  if (Lt.cxl) w.push('CXL หน้างาน ' + Lt.cxl);
  const out: CxlCell = { chips: [{ tone: 'r', text: (w.join(' · ') || 'หายไป ' + Lt.total) + ' คน' }], lines: [], empty: false };
  const d = r.dec;
  if (d && DECISIONS[d.decision]) out.chips.push({ tone: DECISIONS[d.decision]![1], text: DECISIONS[d.decision]![0] + (d.decision === 'postpone' ? '' : ' · ' + money(d.amount)) });
  else out.lines.push('รอตัดสินค่าปรับ');
  if (d && d.note) out.lines.push(d.note);
  return out;
}
