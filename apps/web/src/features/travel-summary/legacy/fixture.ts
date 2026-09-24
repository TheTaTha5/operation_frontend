// A synthetic day for the golden test: every branch Travel Summary has, on made-up data.
import type { DayData, Rec } from './context';

export const DAY = '2026-09-24';

const trip = (over: Rec = {}): Rec => ({ date: DAY, routeId: 'r1', zone: 'PK', pax: { ad_fr: 2 }, ...over });

export function fixture(): DayData {
  const bookings: Rec[] = [
    { // agent with VAT + COT pay type; van no-show, split payments, site sale, upgrade, separate drop-off
      id: 'b1', status: 'confirmed', agentId: 'ag1', voucherRef: 'V-100', leadPax: 'Alice', leadPhone: '081',
      hotelName: 'Sea Hotel', roomNumber: '12', trips: [trip({ pax: { ad_fr: 2, chd_fr: 1, ad_th: 1 } })],
      priceBreakdown: { total: 4200, seat: 4000, addOn: 200 },
      cashOnTour: { amount: 1500, handling: 'separate', note: 'collect in THB' },
      paymentSnapshot: { balance: 0 },
      upgrades: [{ id: 'u1', label: 'VIP seat', sellPrice: 300, collected: false }],
      pierPayments: [{ date: DAY, method: 'transfer', amount: 700.5, fee: 10, by: 'Nok', slips: [] },
        { date: '2026-09-20', method: 'cash', amount: 99 }],
      dropoffSame: false, dropoffHotelName: 'Beach Hotel',
      docCheck: { status: 'verified', by: 'Pim', at: '2026-09-22T05:00:00Z', items: { route: true, date: true, lead: true } },
      attachments: [{ name: 'voucher.pdf' }],
      ops: { vanId: 'v1', boatId: 'bt1', vanReturnId: 'v2',
        vanCheckin: { at: '2026-09-24T07:00:00Z', actualPax: 3,
          events: [{ type: 'no_show', pax: 1, reasonCode: 'no_contact', paxBreak: { ad: 1 } }] },
        pierCheckin: { at: '2026-09-24T08:00:00Z', actualPax: 3, expected: 3, events: [] } },
    },
    { // agent without VAT mode; proforma paid in full through an invoice; own-rate promo; no pickup
      id: 'b2', status: 'confirmed', agentId: 'ag2', voucherRef: 'V-200', leadPax: 'Bob', bookingDate: '2026-09-01',
      trips: [trip({ zone: '', pax: { ad: 2, chd: 1 } })], priceBreakdown: { total: 2000 },
      paymentSnapshot: { balance: 1000 }, cashOnTour: { amount: 500 },
      ops: { vanCheckin: { at: 'x', actualPax: 3, events: [{ type: 'no_show', pax: 1, reasonCode: 'self_arrive' }] } },
    },
    { // walk-in charter on r2; pier cancellation + self-add back, an undone van no-show
      id: 'b3', status: 'confirmed', channel: 'walk-in', rateTypeRef: 'rt2', voucherRef: 'V-300', leadPax: 'Cara',
      hotelName: 'Hill Inn',
      trips: [trip({ routeId: 'r2', bookingMode: 'charter', charterBoatId: 'bt2', zone: 'KL', pax: { ad_fr: 4, chd_fr: 2 } })],
      priceBreakdown: { total: 30000 },
      ops: { boatId: 'bt2',
        vanCheckin: { events: [{ type: 'no_show', pax: 1, undone: true }] },
        pierCheckin: { at: 'y', actualPax: 5, expected: 6, selfAdd: { pax: 1, ad: 1 },
          events: [{ type: 'cxl', pax: 2, reasonCode: 'cancel_onsite', paxBreak: { ad: 1, chd: 1 } }] } },
    },
    { // multi-day: day 2 is DAY, uses the trip subtotal and trip-level ops; agent with seasons + discount promo
      id: 'b4', status: 'confirmed', agentId: 'ag3', voucherRef: 'V-400', leadPax: 'Dan', bookingDate: '2026-08-01',
      hotelName: 'Town Hotel',
      trips: [{ date: '2026-09-23', routeId: 'r1', zone: 'PK', pax: { ad_fr: 2 } },
        { date: DAY, routeId: 'r2', zone: 'PK', subtotal: 1234, pax: { ad_fr: 2 }, ops: { vanId: 'v2', boatId: 'bt1' } }],
      ops: { vanId: 'v1' }, priceBreakdown: { total: 5000 },
    },
    { // overnight return leg on DAY
      id: 'b5', status: 'confirmed', agentId: 'ag1', voucherRef: 'V-500', leadPax: 'Eve', hotelName: 'Sea Hotel',
      trips: [{ date: '2026-09-23', routeId: 'r1', ovn: 'return', ovnReturnDate: DAY, zone: 'PK', pax: { ad_fr: 2 } },
        { date: DAY, routeId: 'r1', ovnLeg: true, pax: { ad_fr: 2 }, ops: { vanReturnId: 'v2' } }],
      priceBreakdown: { total: 8000 }, cashOnTour: { amount: 900 },
    },
    { id: 'b6', status: 'cancelled', agentId: 'ag1', voucherRef: 'V-600', leadPax: 'Finn', trips: [trip()],
      priceBreakdown: { total: 1800 }, cancellation: { chargeType: 'partial', chargeAmount: 600, reason: 'sick' } },
    { id: 'b7', status: 'cancelled_weather', agentId: 'ag2', voucherRef: 'V-700', leadPax: 'Gus', trips: [trip({ routeId: 'r2' })], total: 900 },
    { id: 'b8', status: 'rejected', agentId: 'ag1', voucherRef: 'V-800', trips: [trip()] },
    { // moved to 26 Sep after its van was arranged
      id: 'b9', status: 'confirmed', agentId: 'ag2', voucherRef: 'V-900', leadPax: 'Hana',
      trips: [{ date: '2026-09-26', routeId: 'r2', pax: { ad_fr: 3 } }],
    },
    { // B2C booking: add-ons incl. a B2C fee line, trip bundle, special meals ordered at the pier; decided with no loss
      id: 'b2c_10', status: 'confirmed', voucherRef: 'W-10', leadPax: 'Ivy', hotelName: 'Resort',
      addOns: [{ type: 'longtail', label: 'Longtail (per boat)', note: 'boat 3' }, { type: 'b2c-ad-fee', label: 'Fee' },
        { type: 'snorkel', label: 'Snorkel set', note: 'x2' }],
      trips: [trip({ bundle: { type: 'longtail', mode: 'free' } })], priceBreakdown: { total: 3100 },
      specialMeals: { veg: 1, allergies: 'nuts', pierAt: '2026-09-24T06:00:00Z', pierBy: 'Pim' },
    },
    { // promo locked on the trip at sale time; partial invoice
      id: 'b11', status: 'confirmed', agentId: 'ag3', voucherRef: 'V-110', leadPax: 'Jon', hotelName: 'Town Hotel',
      trips: [trip({ promoId: 'pr-rate', pax: { ad_fr: 1, chd_th: 2 } })], priceBreakdown: { total: 2500 },
      paymentSnapshot: { balance: 400 },
    },
  ];
  return {
    date: DAY,
    bookings,
    routes: [{ id: 'r1', name: 'Similan', color: '#2e86de', pier: 'panwa', times: ['07:30', '08:00'] },
      { id: 'r2', name: 'Phi Phi', color: '#16a085', pier: 'tublamu' }],
    boats: [{ id: 'bt1', name: 'Andaman 1', type: 'Catamaran' }, { id: 'bt2', name: 'Speedy', type: 'Speedboat' }],
    agents: [
      { id: 'ag1', name: 'Zeta Tours', vatMode: 'include', payType: 'cot', rateTypeId: 'rt1', color: '#f1c40f',
        bookingChannel: { cancelPolicy: '24h full charge' } },
      { id: 'ag2', name: 'Alpha Travel', payType: 'proforma', rateTypeId: 'rt1' },
      { id: 'ag3', code: 'MID', vatMode: 'exclude', payType: 'invoice', rateTypeId: 'rt1',
        rateSeasons: [{ from: '2026-05-01', to: '2026-10-31', rt: 'rt3' }] },
    ],
    rateTypes: [
      { id: 'rt1', name: 'Standard', seatRates: {
        r1: { PK: { 'adult-fr': 1000, 'child-fr': 700, 'adult-thai': 600, 'child-thai': 400 }, NoTransfer: { 'adult-fr': 800, 'child-fr': 500 } },
        r2: { PK: { 'adult-fr': 1200, 'child-fr': 800 } } } },
      { id: 'rt2', code: 'CH', charterRates: { r2: { speedboat: { starterPrice: 25000, starterIncludes: 4, extraPerPax: 1500 } } } },
      { id: 'rt3', name: 'Low season', seatRates: { r2: { PK: { 'adult-fr': 900, 'child-fr': 600 } }, r1: { PK: { 'adult-fr': 950, 'child-thai': 300 } } } },
    ],
    contracts: [
      { id: 'pr-own', kind: 'promo', agentId: 'ag2', priceMode: 'own', note: 'Early bird', activeFrom: '2026-09-01',
        programPeriods: [{ routeId: 'r1', travelFrom: '2026-09-01', travelTo: '2026-09-30' }],
        rates: { r1: { NoTransfer: { 'adult-fr': 750, 'child-fr': 450 } } } },
      { id: 'pr-disc', kind: 'promo', agentId: 'ag3', priceMode: 'discount', discount: { mode: 'pct', value: 10 }, version: 'v2',
        programPeriods: [{ routeId: 'r2' }], priority: 2 },
      { id: 'pr-rate', kind: 'promo', agentId: 'ag3', priceMode: 'rate', rateTypeId: 'rt1', note: 'Rate promo', status: 'void' },
      { id: 'main-3', kind: 'main', agentId: 'ag3', rateTypeId: 'rt1' },
    ],
    extras: [
      { id: 'x1', bookingId: 'b1', service: 'Kayak', qty: 2, total: 500, method: 'card', fee: 15, seller: 'Nok', commission: 50,
        slips: [{ id: 's1' }], tripDate: DAY },
      { id: 'x2', bookingId: 'b1', service: 'Photo', total: 200, method: 'cot', tripDate: DAY },
      { id: 'x3', bookingId: 'b1', service: 'Old', total: 100, tripDate: '2026-09-01' },
      { id: 'x4', bookingId: 'b3', service: 'Drinks', total: 400, method: 'transfer', seller: 'Tom' },
    ],
    invoices: [
      { id: 'inv1', number: 'INV-1', bookingIds: ['b2'], total: 2000 },
      { id: 'inv2', number: 'INV-2', bookingIds: ['b11', 'b4'], total: 5000 },
      { id: 'inv3', status: 'void', bookingIds: ['b1'], total: 100 },
    ],
    payments: [
      { invoiceId: 'inv1', type: 'payment', amount: 1500, date: '2026-09-01' },
      { invoiceId: 'inv1', type: 'payment', amount: 500, date: '2026-09-10T03:00:00Z' },
      { invoiceId: 'inv2', type: 'payment', amount: 1000, date: '2026-09-11' },
      { invoiceId: 'inv2', type: 'refund', amount: 200, date: '2026-09-12' },
    ],
    vehicles: [{ id: 'v1', name: 'Van 1' }, { id: 'v2', name: 'Van 2' }],
    pickupAreas: [],
    travelSum: {
      [DAY + '::b1']: { decision: 'partial', amount: 800, note: 'half', by: 'Ops', at: '2026-09-24T12:00:00Z' },
      [DAY + '::b2c_10']: { decision: 'none', amount: 0, note: '', by: 'Ops' },
      [DAY + '::b9']: { decision: 'postpone', amount: 0, by: 'Ops' },
    },
    tsCot: { [DAY + '::b1']: { deduct: 500, payout: 200, by: 'Fin', ref: 'X-1' } },
    stranded: { ['b9|' + DAY]: { routeId: 'r2', pax: { ad_fr: 3 }, to: '2026-09-26', at: '2026-09-20T03:04:00Z', by: 'Ann', vanId: 'v1', ckVan: true } },
  };
}
