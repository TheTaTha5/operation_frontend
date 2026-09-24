// @vitest-environment node
// Golden test: the TypeScript port against the REAL legacy functions, pulled out of
// allotment_v2/js/*.js at test time and run in a vm sandbox on the same dataset.
// If the legacy code changes behaviour, this fails, and the port has to follow (or not, on purpose).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

import { lostByType } from './checkin';
import { Ctx, type Rec } from './context';
import { DAY, fixture } from './fixture';
import { moneyOf, noCollect, proformaPaidDate, saleList, totalOf } from './money';
import { netOf } from './pricing';
import { addonList, agentColor, docRef, hasVat, paxSplit, sendBack, tsCxlRows, tsMvRows, tsRows, vatGap } from './rows';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

const FUNCTIONS = `tsRows tsCxlRows tsMvRows tsHasVat tsVatGap tsVatMode tsMoneyOf tsSaleList tsNoCollect tsDocRef
  docCheckStatus tsNetOf tsTotalOf tsInvSettle tsPaxSplit tsDepTime ckStrandMovedRows ckTripOn tsTripAmount bkOpsRead
  bkIsOvnReturn ckSummary ckBookedPax ckEventTally ckEvLive ckLostByType tsGet tsPolicyText _ovnOutDate getRoute tsAgName
  bkV2PaxAllTot bkV2PaxTot sbGetAgent pckMoney pckPaysFor bkV2ExtrasFor bkxExGot laPromoRateSold laPromoLabel _tsNum
  ckPaxBreak ckPaxLeft ckStrandStore ckStrandMvWhy bkIsFirstDay ckRead ckReasonLabel ckExpectAtPier _tsKey pckPaidSum
  pckFeeSum pckN pckNoSlip laPromoById laPromoRate laPromoRateFor laPromoDiscTxt ckDayShortTh ckShortDay bkTripDates
  _ckSlot _ckBag _ckLegacySeed ckReasonDef laPromoMainRt laPromoFor _ckHost laSeasonsOf laMainRtFor laPromoList
  laPromoCovers laPromoHasRate laMainRtIdFor getRateType laPromoActive laSeasonAt acctBookingInvoice acctInvoiceState
  acctInvoicePaid acctInvoiceBalance tsSendBack bkV2RetInfo vehGet bkV2GetArea tsAddonList ckAddonList
  bkV2IsB2CFeeAddOn _rtBundleAppliesTo bkV2AgentColor bkV2ContrastInk tsProformaPaidDate tsSlipsForMethod pckNum
  tsCotGet getBoat`.split(/\s+/).filter(Boolean);
const CONSTANTS = ['CK_NOSHOW_REASONS', 'PAXK', 'LA_PROMO_ZONES', 'LA_PROMO_PAX', 'DOCCHK_ITEMS', 'BKV2_AGENT_PALETTE'];

/** `var NAME = [ ... ];` from the legacy source (these constants are plain array literals). */
function extractArrayConst(src: string, name: string): string {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + name + '\\s*=\\s*\\[').exec(src);
  if (!m) throw new Error('constant not found: ' + name);
  const start = m.index + m[0].lastIndexOf('[');
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"') { const q = ch; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (ch === '[') depth++;
    if (ch === ']' && --depth === 0) return 'var ' + name + ' = ' + src.slice(start, i + 1) + ';';
  }
  throw new Error('unbalanced constant: ' + name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: Record<string, (...a: any[]) => any>;
let c: Ctx;
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x ?? null));

beforeAll(async () => {
  const lib: Rec = await import(/* @vite-ignore */ path.join(ROOT, 'tests/legacy/lib/source.mjs'));
  const src: string = lib.getSource();
  const code = CONSTANTS.map((n) => extractArrayConst(src, n)).join('\n') + '\n'
    + FUNCTIONS.map((n) => lib.extractFunction(n)).join('\n');
  const d = fixture();
  c = new Ctx(fixture());
  const sandbox = vm.createContext({
    SB_BOOKINGS: d.bookings, ROUTES: d.routes, BOATS: d.boats, SB_AGENTS: d.agents, SB_RATE_TYPES: d.rateTypes,
    SB_CONTRACTS: d.contracts, SB_EXTRAS: d.extras, SB_INVOICES: d.invoices, SB_PAYMENTS: d.payments,
    SB_VEHICLES: d.vehicles, SB_PICKUP_AREAS: d.pickupAreas, TRAVEL_SUM: d.travelSum, TS_COT: d.tsCot,
    laBlob: () => ({ ops_stranded: JSON.stringify(d.stranded) }),
  });
  vm.runInContext(code + '\n;globalThis.__L = {' + FUNCTIONS.join(',') + '};', sandbox, { filename: 'legacy-extract.js' });
  L = sandbox.__L;
});

describe.each([DAY, '2026-09-23', '2026-09-26'])('Travel Summary port matches legacy on %s', (date) => {
  it('tsRows / tsCxlRows / tsMvRows', () => {
    expect(plain(tsRows(c, date))).toEqual(plain(L.tsRows!(date)));
    expect(plain(tsCxlRows(c, date))).toEqual(plain(L.tsCxlRows!(date)));
    expect(plain(tsMvRows(c, date))).toEqual(plain(L.tsMvRows!(date)));
  });

  it('per-row money, pricing, pax, add-ons, drop-off and documents', () => {
    const mine = [...tsRows(c, date), ...tsCxlRows(c, date), ...tsMvRows(c, date)];
    const theirs = [...L.tsRows!(date), ...L.tsCxlRows!(date), ...L.tsMvRows!(date)];
    expect(mine.length).toBe(theirs.length);
    expect(mine.length).toBeGreaterThan(0);
    mine.forEach((r, i) => {
      const o = theirs[i], b = r.b, id = b.id;
      const X = moneyOf(c, b, date);
      expect(plain(X), id + ' moneyOf').toEqual(plain(L.tsMoneyOf!(o.b, date)));
      expect(plain(saleList(c, b, date)), id + ' saleList').toEqual(plain(L.tsSaleList!(o.b, date)));
      expect(noCollect(r, X.paid), id + ' noCollect').toBe(L.tsNoCollect!(o, X.paid));
      expect(plain(netOf(c, r)), id + ' netOf').toEqual(plain(L.tsNetOf!(o)));
      expect(plain(totalOf(c, r, date)), id + ' totalOf').toEqual(plain(L.tsTotalOf!(o, date)));
      expect(plain(paxSplit(r, date)), id + ' paxSplit').toEqual(plain(L.tsPaxSplit!(o, date)));
      expect(plain(addonList(c, r, date)), id + ' addonList').toEqual(plain(L.tsAddonList!(o, date)));
      expect(plain(sendBack(c, b, date)), id + ' sendBack').toEqual(plain(L.tsSendBack!(o.b, date)));
      expect(plain(docRef(b)), id + ' docRef').toEqual(plain(L.tsDocRef!(o.b)));
      expect(plain(lostByType(b, date)), id + ' lostByType').toEqual(plain(L.ckLostByType!(o.b, date)));
      expect(proformaPaidDate(c, b), id + ' proformaPaidDate').toBe(L.tsProformaPaidDate!(o.b));
      expect(hasVat(c, b), id + ' hasVat').toBe(L.tsHasVat!(o.b));
      expect(agentColor(c, b.agentId), id + ' agentColor').toBe(L.bkV2AgentColor!(o.b.agentId));
    });
    expect(vatGap(c, mine)).toEqual(L.tsVatGap!(theirs));
  });
});

it('the dataset reaches the branches it was built for', () => {
  const rows = tsRows(c, DAY);
  const byId = (id: string) => rows.find((r) => r.b.id === id)!;
  expect(rows.map((r) => r.b.id)).not.toContain('b8');                 // rejected
  expect(byId('b1').issue).toBe(true);                                   // van no-show
  expect(byId('b2').ns + byId('b2').cxl).toBe(0);                        // self-arrive is not lost
  expect(lostByType(byId('b3').b, DAY).selfPier).toBe(1);                // pier self-add
  expect(byId('b4').amount).toBe(1234);                                  // multi-day subtotal
  expect(byId('b5').ovnBack).toBe(true);
  expect(netOf(c, byId('b2'))!.promo).toBe('Early bird');                // own-rate promo
  expect(netOf(c, byId('b4'))!.tot).toBe(810 * 2);                       // season rt3, 10% off
  expect(netOf(c, byId('b3'))!.zone).toBe('charter');
  expect(netOf(c, byId('b11'))!.promoSold).toBe(true);                   // locked at sale
  expect(moneyOf(c, byId('b2').b, DAY).inv.settled).toBe(true);
  expect(tsCxlRows(c, DAY).map((r) => r.b.id).sort()).toEqual(['b6', 'b7']);
  expect(tsMvRows(c, DAY).map((r) => r.b.id)).toEqual(['b9']);
});
