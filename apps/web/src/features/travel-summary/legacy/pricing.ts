// Net price per the agent's rate type / promotion (legacy: accounting.js tsNetOf, 08-app.js laPromo*).
import { paxAllTot } from './checkin';
import { LA_PROMO_PAX, LA_PROMO_ZONES, tsNum, type Ctx, type Rec } from './context';

/** laSeasonsOf */
function seasonsOf(a: Rec): Rec[] {
  const s = a && Array.isArray(a.rateSeasons) ? a.rateSeasons : [];
  return s.filter((x: Rec) => x && x.rt && x.from).slice().sort((x: Rec, y: Rec) => String(x.from).localeCompare(String(y.from)));
}
/** laSeasonAt */
function seasonAt(a: Rec, travelDate: unknown): Rec | null {
  const S = seasonsOf(a), d = String(travelDate || '');
  if (!S.length || !d) return null;
  for (let i = S.length - 1; i >= 0; i--) if (d >= S[i].from && (!S[i].to || d <= S[i].to)) return S[i];
  return null;
}
/** laMainRtIdFor */
function mainRtIdFor(c: Ctx, agentId: unknown, travelDate: unknown): string {
  const a = c.agent(agentId); if (!a) return '';
  const hit = seasonAt(a, travelDate);
  return (hit && hit.rt) || a.rateTypeId || '';
}
/** laMainRtFor */
function mainRtFor(c: Ctx, agentId: unknown, travelDate: unknown): Rec | null {
  const id = mainRtIdFor(c, agentId, travelDate);
  if (!id) return null;
  return c.rateType(id) || null;
}
/** laPromoMainRt (§rtSeason) */
function promoMainRt(c: Ctx, agentId: unknown, travelDate?: unknown): Rec | null {
  if (travelDate) {
    const a = c.agent(agentId);
    if (a && seasonsOf(a).length) { const s = mainRtFor(c, agentId, travelDate); if (s) return s; }
  }
  const main = c.d.contracts.filter((x) => x && x.agentId === agentId && x.kind === 'main')[0];
  const a = c.agent(agentId);
  const id = (main && main.rateTypeId) || (a && a.rateTypeId) || '';
  return c.d.rateTypes.filter((x) => x.id === id)[0] || null;
}
/** laPromoActive */
function promoActive(x: Rec): boolean {
  return !!(x && x.kind === 'promo' && x.status !== 'void' && x.status !== 'cancelled' && x.status !== 'expired');
}
/** laPromoList */
function promoList(c: Ctx, agentId: unknown): Rec[] {
  if (!agentId) return [];
  return c.d.contracts.filter((x) => x && x.agentId === agentId && promoActive(x));
}
/** laPromoById */
function promoById(c: Ctx, id: unknown): Rec | null {
  if (!id) return null;
  return c.d.contracts.filter((x) => x && x.id === id)[0] || null;
}
/** laPromoCovers */
function promoCovers(p0: Rec, routeId: unknown, travelDate: string, bookDate: string): boolean {
  if (!p0 || !routeId || !travelDate) return false;
  if (p0.activeFrom && travelDate < p0.activeFrom) return false;
  if (p0.activeTo && travelDate > p0.activeTo) return false;
  return (p0.programPeriods || []).some((p: Rec) => {
    if (p.routeId !== routeId) return false;
    if (p.travelFrom && travelDate < p.travelFrom) return false;
    if (p.travelTo && travelDate > p.travelTo) return false;
    if (p0.bookWin) {
      if (!bookDate) return false;
      if (p.bookFrom && bookDate < p.bookFrom) return false;
      if (p.bookTo && bookDate > p.bookTo) return false;
    }
    return true;
  });
}
/** laPromoHasRate */
function promoHasRate(c: Ctx, p: Rec, routeId: string): boolean {
  if (!p || !routeId) return false;
  if ((p.priceMode || 'rate') === 'discount') {
    const mr = promoMainRt(c, p.agentId);
    return !!(mr && mr.seatRates && mr.seatRates[routeId]);
  }
  if ((p.priceMode || 'rate') === 'own') {
    const R = (p.rates || {})[routeId];
    if (!R) return false;
    return LA_PROMO_ZONES.some((z) => { const Z = R[z]; if (!Z) return false; return LA_PROMO_PAX.some((k) => (+Z[k] || 0) > 0); });
  }
  const rt = c.d.rateTypes.filter((x) => x.id === p.rateTypeId)[0];
  return !!(rt && ((rt.seatRates && rt.seatRates[routeId]) || (rt.charterRates && rt.charterRates[routeId])));
}
/** laPromoFor · highest priority, then latest activeFrom */
function promoFor(c: Ctx, agentId: unknown, routeId: string, travelDate: string, bookDate: string): Rec | null {
  const hit = promoList(c, agentId).filter((p) => promoCovers(p, routeId, travelDate, bookDate) && promoHasRate(c, p, routeId));
  if (!hit.length) return null;
  hit.sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || String(b.activeFrom || '').localeCompare(String(a.activeFrom || '')));
  return hit[0];
}
/** laPromoRate · the rate type a promotion implies for one route */
function promoRate(c: Ctx, p: Rec, routeId: string, baseRt: Rec, travelDate: string): Rec | null {
  if (!p || !routeId) return null;
  if ((p.priceMode || 'rate') === 'discount') {
    const mr = promoMainRt(c, p.agentId, travelDate) || baseRt;
    const mz = mr && mr.seatRates && mr.seatRates[routeId];
    if (!mz) return null;
    const D = p.discount || {}, isAmt = D.mode === 'amt', dv = +D.value || 0;
    if (!(dv > 0)) return null;
    const dzn: Rec = {};
    Object.keys(mz).forEach((z) => {
      const Z: Rec = {};
      Object.keys(mz[z]).forEach((k) => {
        const v = +mz[z][k] || 0;
        Z[k] = v <= 0 ? v : Math.max(0, isAmt ? Math.round(v - dv) : Math.round(v * (1 - dv / 100)));
      });
      dzn[z] = Z;
    });
    const dout: Rec = {};
    if (baseRt) Object.keys(baseRt).forEach((k) => { dout[k] = baseRt[k]; });
    const dsr: Rec = {};
    if (baseRt && baseRt.seatRates) Object.keys(baseRt.seatRates).forEach((k) => { dsr[k] = baseRt.seatRates[k]; });
    dsr[routeId] = dzn;
    dout.seatRates = dsr; dout.id = 'promo:' + (p.id || ''); dout.code = p.code || 'PROMO';
    dout.name = p.note || 'Promotion'; dout.__promoId = p.id || '';
    return dout;
  }
  if ((p.priceMode || 'rate') !== 'own') {
    return c.d.rateTypes.filter((x) => x.id === p.rateTypeId)[0] || null;
  }
  const R = (p.rates || {})[routeId]; if (!R) return null;
  const out: Rec = {};
  if (baseRt) Object.keys(baseRt).forEach((k) => { out[k] = baseRt[k]; });
  const sr: Rec = {};
  if (baseRt && baseRt.seatRates) Object.keys(baseRt.seatRates).forEach((k) => { sr[k] = baseRt.seatRates[k]; });
  const zn: Rec = {}, bz = (baseRt && baseRt.seatRates && baseRt.seatRates[routeId]) || {};
  Object.keys(bz).forEach((z) => { zn[z] = bz[z]; });
  LA_PROMO_ZONES.forEach((z) => {
    if (!R[z]) return;
    const Z: Rec = {};
    LA_PROMO_PAX.forEach((k) => { Z[k] = +R[z][k] || 0; });
    ['infant-thai', 'infant-fr'].forEach((k) => { Z[k] = +((R[z] || {})[k] != null ? R[z][k] : (bz[z] || {})[k] || 0) || 0; });
    zn[z] = Z;
  });
  sr[routeId] = zn;
  out.seatRates = sr; out.id = 'promo:' + (p.id || ''); out.code = p.code || 'PROMO';
  out.name = p.note || 'Promotion'; out.__promoId = p.id || '';
  return out;
}
/** laPromoRateSold · the promotion locked on the trip at sale time, else the one active now */
function promoRateSold(c: Ctx, bk: Rec, trip: Rec, baseRt: Rec): { rt: Rec; promo: Rec; sold: boolean } | null {
  if (trip && trip.promoId) {
    const p = promoById(c, trip.promoId);
    if (p) { const rt = promoRate(c, p, trip.routeId, baseRt, trip.date); if (rt) return { rt, promo: p, sold: true }; }
    return null;
  }
  if (!bk || !bk.agentId || !trip || !trip.routeId || !trip.date) return null;
  const p = promoFor(c, bk.agentId, trip.routeId, trip.date, bk.bookingDate || '');
  if (!p) return null;
  const rt = promoRate(c, p, trip.routeId, baseRt, trip.date);
  return rt ? { rt, promo: p, sold: false } : null;
}
/** laPromoDiscTxt */
function promoDiscTxt(p: Rec): string {
  const D = (p && p.discount) || {};
  if ((p && p.priceMode) !== 'discount') return '';
  return D.mode === 'amt' ? 'ลด ' + Math.round(+D.value || 0).toLocaleString() + ' บาท/หัว' : 'ลด ' + (+D.value || 0) + '%';
}
/** laPromoLabel */
function promoLabel(p: Rec): string {
  if (!p) return '';
  let t = p.note || p.version || p.id || 'Promotion';
  if ((p.priceMode || 'rate') === 'discount') t += ' · ' + promoDiscTxt(p);
  return t;
}

export interface NetPrice { tot: number; txt: string; zone: string; rt: string; promo: string; promoSold: boolean }

/** tsNetOf · what the booking should cost at the agent's contracted rate, with how it was worked out */
export function netOf(c: Ctx, r: Rec): NetPrice | null {
  if (!r || !r.b || !r.t) return null;
  const b = r.b, t = r.t;
  if (t.ovnLeg) return null;
  const rtId = b.rateTypeRef || (b.agentId ? (c.agent(b.agentId) || {}).rateTypeId : null);
  if (!rtId) return null;
  let rt: Rec = null;
  for (let i = 0; i < c.d.rateTypes.length; i++) if (c.d.rateTypes[i].id === rtId) { rt = c.d.rateTypes[i]; break; }
  if (!rt) return null;
  let pSold: ReturnType<typeof promoRateSold> = null;
  try { pSold = promoRateSold(c, b, t, rt); if (pSold && pSold.rt) rt = pSold.rt; } catch { /* legacy swallows */ }
  const p = t.pax || {};
  if (t.bookingMode === 'charter') {
    const boat = c.d.boats.filter((x) => x.id === t.charterBoatId)[0];
    const ty = String((boat && boat.type) || '').toLowerCase();
    const cr = rt.charterRates && rt.charterRates[t.routeId] && rt.charterRates[t.routeId][ty];
    if (!cr) return null;
    const all = paxAllTot(p);
    const ex = Math.max(0, all - (+cr.starterIncludes || 0));
    const ct = Math.round((+cr.starterPrice || 0) + ex * (+cr.extraPerPax || 0));
    return { tot: ct, promo: pSold ? promoLabel(pSold.promo) : '', promoSold: !!(pSold && pSold.sold),
      txt: 'เหมาลำ ' + tsNum(cr.starterPrice) + (ex ? ' + ' + ex + '×' + tsNum(cr.extraPerPax) : ''),
      zone: 'charter', rt: rt.name || rt.code || '' };
  }
  const RR = rt.seatRates && rt.seatRates[t.routeId];
  if (!RR) return null;
  let zone = t.zone || b.zone || '';
  if (!zone || !RR[zone]) {
    const pier = (c.route(t.routeId) || {}).pier || '';
    const order = b.hotelName || b.pickup
      ? pier === 'ranong' ? ['RN', 'PK', 'KL', 'NoTransfer'] : pier === 'tublamu' ? ['KL', 'PK', 'RN', 'NoTransfer'] : ['PK', 'KL', 'RN', 'NoTransfer']
      : ['NoTransfer', 'RN', 'PK', 'KL'];
    zone = ''; for (const z of order) if (RR[z]) { zone = z; break; }
    if (!zone) zone = Object.keys(RR).filter((k) => RR[k])[0] || '';
  }
  const sr = zone ? RR[zone] : null;
  if (!sr) return null;
  const legAd = +p.ad || 0, legChd = +p.chd || 0;
  const LN: [string, number][] = [['adult-fr', +p.ad_fr || legAd], ['adult-thai', +p.ad_th || 0],
    ['child-fr', +p.chd_fr || legChd], ['child-thai', +p.chd_th || 0]];
  let n = 0; const parts: string[] = [];
  LN.forEach(([k, qty]) => {
    const q = +qty || 0, rate = +sr[k] || 0;
    if (q <= 0 || rate <= 0) return;
    n += q * rate; parts.push(q + '×' + tsNum(rate));
  });
  if (!parts.length) return null;
  return { tot: Math.round(n), txt: parts.join(' + '), zone, rt: rt.name || rt.code || '',
    promo: pSold ? promoLabel(pSold.promo) : '', promoSold: !!(pSold && pSold.sold) };
}
