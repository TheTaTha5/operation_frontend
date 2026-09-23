// Shared synthetic data for browser-level refactor checks (tools/render-golden.mjs, tools/handler-map.mjs).
// Everything here is in-memory zz_test_ data applied to a page opened by test/ui/_harness.mjs — nothing
// is persisted. Pin the clock with page.clock.setFixedTime(new Date(NOW)) before seeding.
export const DATE = '2026-10-15';
// The page clock is pinned (page.clock.setFixedTime) so "today", "last 47 days" etc. are the same on
// every run. PAST dates carry a lighter load so month / analysis views have history to report.
export const NOW = '2026-10-16T09:00:00+07:00';
export const PAST = ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30', '2026-10-07', '2026-10-12'];

// Runs in the page. Builds bookings from whatever seed entities exist so it survives seed changes.
export function seed([DATE, PAST]){
  const routes = (typeof DEFAULT_ROUTES !== 'undefined' ? DEFAULT_ROUTES : []).map(r => r.id);
  const boats = (typeof BOATS !== 'undefined' ? BOATS : []).map(b => b.id);
  const agents = (SB_AGENTS || []).map(a => a.id);
  const areas = (typeof SB_PICKUP_AREAS !== 'undefined' ? SB_PICKUP_AREAS : []);
  const vans = (typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : []).map(v => v.id);
  const statuses = ['confirmed', 'confirmed', 'confirmed', 'pending_approval', 'cancelled', 'confirmed'];
  const out = [];
  let n = 0;
  const plan = [[DATE, 7], ...PAST.map(d => [d, 2])];
  for (const [date, perRoute] of plan) for (const rid of routes){
    for (let k = 0; k < perRoute; k++){
      n++;
      const area = areas[(n * 3) % Math.max(areas.length, 1)] || {};
      const charter = k === 6;
      const self = k === 5;
      const bk = {
        id: 'zz_test_golden_' + n, schemaVer: 2, createdAt: '2026-09-01T03:00:00.000Z', createdBy: 'zz_test',
        voucherRef: 'ZZ-G' + n, agentId: agents[n % Math.max(agents.length, 1)] || null, channel: n % 4 ? 'agent' : 'direct',
        leadPax: 'Zz Golden ' + n, leadNationality: n % 3 ? 'TH' : 'DE', leadPhone: '08000000' + (n % 100), leadEmail: '',
        hotelName: 'Zz Hotel ' + (n % 9), roomNumber: String(100 + n), pickupAreaId: self ? null : (area.id || null),
        pickupZone: self ? 'NoTransfer' : (area.zone || 'PK'), pickupSelf: self,
        status: statuses[n % statuses.length], bookingDate: '2026-09-01',
        trips: [{ routeId: rid, date, bookingMode: charter ? 'charter' : 'seat',
          pax: { ad_fr: n % 4, ad_th: 1 + (n % 3), chd_fr: n % 2, chd_th: 0, inf_fr: n % 5 === 0 ? 1 : 0, inf_th: 0, foc: n % 7 === 0 ? 1 : 0 },
          charterBoatId: charter ? boats[n % boats.length] : undefined }],
        passengers: [], addOns: [], adjustments: [],
        priceBreakdown: { seat: 1000 * n, addOn: 0, focDiscount: 0, discount: 0, extra: 0, total: 1000 * n },
        total: 1000 * n,
        history: [{ at: '2026-09-01T03:00:00.000Z', kind: 'create', text: 'zz', by: 'zz_test' }],
        ops: {
          boatId: charter ? boats[n % boats.length] : (k < 4 ? boats[(n + k) % boats.length] : null),
          vanId: !self && k < 3 ? vans[n % Math.max(vans.length, 1)] || null : null,
          vanGroup: !self && k < 3 ? 1 + (k % 2) : 0, vanSeq: !self && k < 3 ? k + 1 : 0,
          vanReturnId: k === 1 ? vans[(n + 1) % Math.max(vans.length, 1)] || null : null,
          pickupTimeFinal: k < 2 ? '07:' + String(10 + k * 5) : '',
        },
      };
      if (k === 2 && areas.length > 1) bk.altPickups = [{ areaId: areas[(n + 1) % areas.length].id, zone: areas[(n + 1) % areas.length].zone, hotel: 'Zz Alt', pax: 1 }];
      out.push(bk);
    }
  }
  SB_BOOKINGS.length = 0;
  out.forEach(b => SB_BOOKINGS.push(b));
  // one chartered-in boat · its job sheet takes a typed captain name (pjFreePick) instead of a select
  const chartered = (typeof BOATS !== 'undefined' ? BOATS : []).find(b => b.pier === 'panwa');
  if (chartered) chartered.ownership = 'charter';
  // Pier staff + guides · what the boat job sheet's crew / guide selects offer
  if (typeof PIER_STAFF !== 'undefined'){
    PIER_STAFF.length = 0;
    const roles = ['กัปตัน', 'ผู้ช่วยกัปตัน', 'ลูกเรือ', 'ลูกเรือ', 'ประจำเกาะ', 'ช่าง'];
    ['panwa', 'tublamu'].forEach((pier, pi) => roles.forEach((role, ri) =>
      PIER_STAFF.push({ id: 'zz_test_st_' + pi + ri, name: 'Zz Staff ' + pi + ri, nick: 'Z' + pi + ri, role, pier, active: true })));
  }
  if (typeof goGuidesSet === 'function') goGuidesSet([0, 1, 2, 3, 4, 5].map(i => ({
    id: 'zz_test_gd_' + i, name: 'Zz Guide ' + i, role: i === 5 ? 'trainee' : 'guide', lang: [['EN'], ['EN', 'DE'], ['RU'], ['CN', 'EN'], ['TH'], ['EN']][i] })));
  // Boat Operation schedule (TRIPS) for every boat that carries a live booking · what Trip P&L reads
  for (const b of out){
    if (['cancelled', 'cancelled_weather', 'rejected'].includes(b.status) || !b.ops.boatId) continue;
    const t = b.trips[0], op = getOp(t.date, b.ops.boatId);
    if (!op.route) op.route = t.routeId;
  }
  return out.length;
}


// Pin the clock and Math.random, then seed. Returns the number of bookings created.
export async function seedPage(page){
  await page.clock.setFixedTime(new Date(NOW));
  await page.evaluate(() => { let x = 42; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647); });
  return page.evaluate(seed, [DATE, PAST]);
}
