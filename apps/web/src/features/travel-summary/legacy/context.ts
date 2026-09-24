/**
 * Port of the legacy Travel Summary calculations (allotment_v2/js/accounting.js, 08-app.js,
 * checkin.js). Each function keeps the legacy name in its doc comment and the same behaviour, so
 * the golden test can run both side by side on one dataset.
 *
 * The legacy data is loosely shaped (fields appear and disappear across years of edits), so the
 * port reads it as `Rec` (any). Everything this folder hands to the UI is typed; see ../model.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = any;

/** Everything the legacy globals held that Travel Summary reads, for one operating day. */
export interface DayData {
  date: string;
  /** SB_BOOKINGS: every booking with a trip on `date`, plus the ones moved away from it. */
  bookings: Rec[];
  routes: Rec[];                   // ROUTES
  boats: Rec[];                    // BOATS
  agents: Rec[];                   // SB_AGENTS
  rateTypes: Rec[];                // SB_RATE_TYPES
  contracts: Rec[];                // SB_CONTRACTS
  extras: Rec[];                   // SB_EXTRAS
  invoices: Rec[];                 // SB_INVOICES
  payments: Rec[];                 // SB_PAYMENTS
  vehicles: Rec[];                 // SB_VEHICLES
  pickupAreas: Rec[];              // SB_PICKUP_AREAS
  travelSum: Record<string, Rec>;  // TRAVEL_SUM
  tsCot: Record<string, Rec>;      // TS_COT
  /** Parsed blob.ops_stranded (ckStrandStore): "<bookingId>|<date>" -> snapshot taken when moved. */
  stranded: Record<string, Rec>;
}

/** CK_NOSHOW_REASONS (08-app.js) */
export const CK_NOSHOW_REASONS: readonly { code: string; label: string; expectAtPier?: boolean }[] = [
  { code: 'no_contact', label: 'ติดต่อลูกค้าไม่ได้' },
  { code: 'not_down', label: 'รอแล้วไม่ลงมา' },
  { code: 'wrong_hotel', label: 'ไม่อยู่โรงแรมตามที่แจ้ง' },
  { code: 'late', label: 'มาสาย / ตกรถ' },
  { code: 'self_arrive', label: 'ลูกค้าไปเองที่ท่าเรือ', expectAtPier: true },
  { code: 'own_transfer', label: 'ไปกับรถคันอื่น / รถส่วนตัว', expectAtPier: true },
  { code: 'cancel_onsite', label: 'ยกเลิกหน้างาน' },
  { code: 'sick', label: 'ป่วย / เหตุสุดวิสัย' },
  { code: 'other', label: 'อื่นๆ' },
];
export const PAXK = ['ad', 'chd', 'inf', 'foc'] as const;
export const LA_PROMO_ZONES = ['PK', 'KL', 'NoTransfer'];
export const LA_PROMO_PAX = ['adult-thai', 'child-thai', 'adult-fr', 'child-fr'];
export const DOCCHK_ITEMS = [
  { k: 'route', label: 'เส้นทาง / โปรแกรม' }, { k: 'date', label: 'วันเดินทาง' }, { k: 'lead', label: 'ชื่อ' },
  { k: 'pax', label: 'จำนวนคน' }, { k: 'voucher', label: 'Voucher / Ref' }, { k: 'payment', label: 'Payment' },
];
export const BKV2_AGENT_PALETTE = ['#9b59b6', '#27ae60', '#e08283', '#f1c40f', '#2e86de', '#7B3FA0', '#16a085',
  '#e67e22', '#C0563B', '#2c7a45', '#d35400', '#8e44ad', '#BA8A2C', '#185FA5', '#0F6E56', '#7f8c8d'];
export const CANCELLED = ['cancelled', 'rejected', 'cancelled_weather'];

/** Lookups the legacy code did with Array.find on globals. */
export class Ctx {
  constructor(readonly d: DayData) {}
  /** getRoute */
  route(id: unknown): Rec | undefined { return this.d.routes.find((r) => r.id === id); }
  /** sbGetAgent */
  agent(id: unknown): Rec | undefined { return this.d.agents.find((a) => a.id === id); }
  /** getRateType */
  rateType(id: unknown): Rec | undefined { return this.d.rateTypes.find((r) => r.id === id); }
  /** getBoat */
  boat(id: unknown): Rec | undefined { return this.d.boats.find((b) => b.id === id); }
  /** vehGet */
  vehicle(id: unknown): Rec | undefined { return (this.d.vehicles || []).find((v) => v.id === id); }
  /** bkV2GetArea */
  area(id: unknown): Rec | undefined { return (this.d.pickupAreas || []).find((a) => a.id === id); }
  /** bkV2ExtrasFor */
  extrasFor(bkId: unknown): Rec[] { return this.d.extras.filter((e) => e.bookingId === bkId); }
  /** tsGet · TRAVEL_SUM[date::id] */
  tsGet(bkId: unknown, date: string): Rec | null { return this.d.travelSum[tsKey(bkId, date)] || null; }
  /** tsCotGet · TS_COT[date::id] */
  tsCotGet(bkId: unknown, date: string): Rec | null { return this.d.tsCot[tsKey(bkId, date)] || null; }
}

/** _tsKey */
export function tsKey(bkId: unknown, date: unknown): string { return String(date || '') + '::' + String(bkId || ''); }

/** _tsNum */
export function tsNum(v: unknown): string { return Math.round(+(v as number) || 0).toLocaleString('en-US'); }

/** pckN · round to satang, nudging so 0.005 rounds away from zero */
export function pckN(n: unknown): number { const v = (+(n as number) || 0) * 100; return Math.round(v + (v < 0 ? -1e-9 : 1e-9)) / 100; }

/** pckNum */
export function pckNum(n: unknown): string {
  const v = pckN(n);
  return v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** String.localeCompare the way the legacy sorts did it (A-Z, numeric, case-insensitive). */
export function az(a: unknown, b: unknown): number {
  return String(a || '').localeCompare(String(b || ''), 'en', { numeric: true, sensitivity: 'base' });
}
