// On-site money for one booking and day (legacy: booking.js pck*, accounting.js ts*/acct*).
import { isOvnReturn, tripOn } from './checkin';
import { pckN, type Ctx, type Rec } from './context';

/** pckPaysFor · bk.pierPayments collected on `date` */
export function paysFor(b: Rec, date: string): Rec[] {
  const arr = b && Array.isArray(b.pierPayments) ? b.pierPayments : [];
  return date ? arr.filter((p: Rec) => p && p.date === date) : arr.slice();
}
/** pckPaidSum */
function paidSum(b: Rec, date: string): number { return pckN(paysFor(b, date).reduce((s, p) => s + (+p.amount || 0), 0)); }
/** pckFeeSum */
function feeSum(b: Rec, date: string): number { return pckN(paysFor(b, date).reduce((s, p) => s + (+p.fee || 0), 0)); }
/** pckNoSlip · non-cash payments with no slip attached */
function noSlipCount(b: Rec, date: string): number {
  return paysFor(b, date).filter((p) => p.method !== 'cash' && !(Array.isArray(p.slips) && p.slips.length)).length;
}
/** bkxExGot · an extra sold "collect on the trip day" (method cot) is not money in hand until settled */
export function exGot(x: Rec): boolean { return !(x && x.method === 'cot' && x.settle !== 'done'); }

/** pckMoney · what is owed / collected on site for this booking on this day */
export function pckMoney(c: Ctx, b: Rec, date: string): Rec {
  const t = tripOn(b, date);
  const ovnBack = !!(t && isOvnReturn(t));
  const cot = !ovnBack && b.cashOnTour && +b.cashOnTour.amount > 0 ? +b.cashOnTour.amount : 0;
  const ex = c.extrasFor(b.id).filter((x) => !(date && x.tripDate && x.tripDate !== date));
  let exG = 0, exDue = 0;
  ex.forEach((x) => { const v = +x.total || 0; if (exGot(x)) exG += v; else exDue += v; });
  const exTot = exG + exDue;
  const ups = !ovnBack && Array.isArray(b.upgrades) ? b.upgrades : [];
  let upDue = 0, upGot = 0;
  ups.forEach((u: Rec) => { const v = +u.sellPrice || 0; if (u.collected) upGot += v; else upDue += v; });
  const bal = !ovnBack && b.paymentSnapshot && +b.paymentSnapshot.balance > 0 ? +b.paymentSnapshot.balance : 0;
  const ag = c.agent(b.agentId);
  const pierPaid = paidSum(b, date);
  const pierFee = feeSum(b, date);
  const gross = pckN(cot + upDue + bal + exDue);
  return { cot, cur: (b.cashOnTour && b.cashOnTour.currency) || 'THB', handling: (b.cashOnTour && b.cashOnTour.handling) || '',
    note: (b.cashOnTour && b.cashOnTour.note) || '', extras: ex, extrasTot: exTot,
    exGot: exG, exDue, upgrades: ups, upDue, upGot,
    balance: bal, gross, pierPaid, pierFee, ovnSettled: ovnBack,
    noSlip: noSlipCount(b, date),
    due: Math.max(0, pckN(gross - pierPaid)), got: pckN(exG + upGot + pierPaid), payType: (ag && ag.payType) || '' };
}

/** acctInvoicePaid · refunds count negative */
function invoicePaid(c: Ctx, inv: Rec): number {
  let p = 0;
  c.d.payments.forEach((x) => { if (x.invoiceId !== inv.id) return; p += x.type === 'refund' ? -Math.abs(x.amount || 0) : x.amount || 0; });
  return p;
}
/** acctInvoiceBalance */
function invoiceBalance(c: Ctx, inv: Rec): number { if (inv && inv.status === 'void') return 0; return Math.max(0, (inv.total || 0) - invoicePaid(c, inv)); }
/** acctInvoiceState */
function invoiceState(c: Ctx, inv: Rec): string {
  if (inv.status === 'void') return 'void';
  if (invoiceBalance(c, inv) <= 0 && (inv.total || 0) > 0) return 'paid';
  if (invoicePaid(c, inv) > 0) return 'partial';
  return 'issued';
}
/** tsInvSettle · the (non-void) invoice covering this booking and whether it is fully paid */
export function invSettle(c: Ctx, b: Rec): Rec {
  const out: Rec = { inv: null, no: '', state: '', paid: 0, bal: 0, nBk: 0, settled: false };
  if (!b || !b.id) return out;
  const iv = c.d.invoices.find((x) => x.status !== 'void' && (x.bookingIds || []).includes(b.id)) || null;
  if (!iv) return out;
  out.inv = iv; out.no = iv.number || iv.id || '';
  out.state = invoiceState(c, iv); out.paid = invoicePaid(c, iv); out.bal = invoiceBalance(c, iv);
  out.nBk = (iv.bookingIds || []).length || 0;
  out.settled = out.state === 'paid';
  return out;
}

/** tsMoneyOf */
export function moneyOf(c: Ctx, b: Rec, date: string): Rec {
  const M = pckMoney(c, b, date);
  const pays = paysFor(b, date);
  const by: Record<string, number> = { cash: 0, transfer: 0, card: 0 }, who: string[] = [];
  pays.forEach((p) => {
    const m = p.method || 'cash'; if (by[m] == null) by[m] = 0; by[m] = (by[m] ?? 0) + (+p.amount || 0);
    if (p.by && who.indexOf(p.by) < 0) who.push(p.by);
  });
  const IV = invSettle(c, b);
  const billed = IV.settled ? (+M.cot || 0) + (+M.balance || 0) : 0;
  const target = Math.max(0, (+M.cot || 0) + (+M.balance || 0) + (+M.upDue || 0) - billed);
  return { M, pays, by, who: who.join(' · '), inv: IV, billed, target, paid: +M.pierPaid || 0, due: Math.max(0, target - (+M.pierPaid || 0)) };
}

/** tsSaleList · extras and upgrades sold on site, with how each was paid */
export function saleList(c: Ctx, b: Rec, date: string): Rec {
  const out: Rec[] = [], by: Record<string, number> = { cash: 0, transfer: 0, card: 0 };
  let fee = 0, got = 0, due = 0, noSlip = 0, comm = 0;
  c.extrasFor(b.id).forEach((x) => {
    if (date && x.tripDate && x.tripDate !== date) return;
    const amt = +x.total || 0; if (!amt) return;
    const mth = x.method || 'cash'; if (by[mth] == null) by[mth] = 0;
    const g = exGot(x);
    const cm = +x.commission || 0;
    if (g) { by[mth] = (by[mth] ?? 0) + amt; got += amt; fee += +x.fee || 0; comm += cm; } else due += amt;
    const slipMissing = g && mth !== 'cash' && !(x.slips || []).length;
    if (slipMissing) noSlip++;
    out.push({ kind: 'ex', id: x.id || '', t: String(x.service || 'ขายเพิ่ม'), qty: +x.qty || 1, amt,
      fee: +x.fee || 0, nSlip: (x.slips || []).length, slips: (x.slips || []).slice(),
      comm: cm, toCompany: +x.toCompany || 0, method: mth, who: x.seller || '', done: g, noSlip: slipMissing });
  });
  (Array.isArray(b.upgrades) ? b.upgrades : []).forEach((u: Rec) => {
    const amt = +u.sellPrice || 0; if (!amt) return;
    const m2 = u.method || 'cash';
    if (u.collected) { if (by[m2] == null) by[m2] = 0; by[m2] = (by[m2] ?? 0) + amt; got += amt; fee += +u.fee || 0; comm += +u.commission || 0; }
    else due += amt;
    const uNo = !!u.collected && m2 !== 'cash' && !(u.slips || []).length;
    if (uNo) noSlip++;
    out.push({ kind: 'up', id: u.id || '', t: String(u.label || 'upgrade'), qty: 1, amt,
      fee: +u.fee || 0, nSlip: (u.slips || []).length, slips: (u.slips || []).slice(),
      comm: +u.commission || 0, toCompany: +u.toCompany || 0, method: m2, who: u.seller || '', done: !!u.collected, noSlip: uNo });
  });
  return { list: out, by, fee, got, due, noSlip, comm, tot: got + due, n: out.length };
}

/** tsNoCollect · nobody travelled and nothing was collected: shown, but not counted as money to collect */
export function noCollect(r: Rec, paid: unknown): boolean {
  if (!r) return false;
  if (+(paid as number) > 0) return false;
  return r.travelled <= 0 && (+r.cxl > 0 || +r.ns > 0 || +r.noShow > 0);
}

/** tsTotalOf · booking amount plus what was sold on site */
export function totalOf(c: Ctx, r: Rec, date: string): { base: number; site: number; all: number; parts: [string, number][] } {
  const base = +r.amount || 0;
  const M = pckMoney(c, r.b, date);
  const ex = +M.extrasTot || 0, up = (+M.upDue || 0) + (+M.upGot || 0);
  const parts: [string, number][] = [];
  if (ex > 0) parts.push(['ขายเพิ่มหน้าท่า', ex]);
  if (up > 0) parts.push(['อัปเกรด', up]);
  return { base, site: ex + up, all: base + ex + up, parts };
}

/** tsProformaPaidDate · dd/mm/yyyy of the latest payment on the booking's invoice */
export function proformaPaidDate(c: Ctx, b: Rec): string {
  const iv = invSettle(c, b).inv;
  if (!iv) return '';
  const pays = c.d.payments.filter((p) => p.invoiceId === iv.id && p.type === 'payment' && (+p.amount || 0) > 0 && p.date);
  if (!pays.length) return '';
  pays.sort((a, z) => String(a.date).localeCompare(String(z.date)));
  const d = String(pays[pays.length - 1].date).slice(0, 10).split('-');
  return d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : '';
}

/** tsSlipsForMethod · every slip behind one payment method (pier payments + collected site sales) */
export function slipsForMethod(b: Rec, date: string, method: string, sale: Rec): Rec[] {
  let slips: Rec[] = [];
  paysFor(b, date).forEach((p) => { if ((p.method || 'cash') !== method) return; slips = slips.concat(Array.isArray(p.slips) ? p.slips : []); });
  ((sale && sale.list) || []).forEach((s: Rec) => {
    if (!s.done) return; if ((s.method || 'cash') !== method) return;
    slips = slips.concat(Array.isArray(s.slips) ? s.slips : []);
  });
  return slips;
}
