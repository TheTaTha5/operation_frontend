#!/usr/bin/env node
// render-golden · characterization check for refactors of the big render functions.
//
//   node tools/render-golden.mjs record  <dir>     render every scenario, write <dir>/<scenario>.html
//   node tools/render-golden.mjs compare <dir>     render again and diff against <dir>
//
// Seeds the page (static server + seed data, like test/ui) with a deterministic set of synthetic
// zz_test_ bookings on one travel date — every route, seat + charter, several agents/zones, van and
// boat assignments, alt pickups, self-arrive, cancelled/pending — in memory only (nothing is saved),
// then renders each scenario and captures the view's HTML. Record before a refactor, compare after:
// a behavior-neutral refactor gives 0 differences. Clock-dependent text (HH:MM) is masked.
import fs from 'node:fs';
import path from 'node:path';
import { open } from '../test/ui/_harness.mjs';

const [cmd, dir] = process.argv.slice(2);
if (!['record', 'compare'].includes(cmd) || !dir){ console.log('usage: record|compare <dir>'); process.exit(2); }

const DATE = '2026-10-15';

// Runs in the page. Builds bookings from whatever seed entities exist so it survives seed changes.
function seed(DATE){
  const routes = (typeof DEFAULT_ROUTES !== 'undefined' ? DEFAULT_ROUTES : []).map(r => r.id);
  const boats = (typeof BOATS !== 'undefined' ? BOATS : []).map(b => b.id);
  const agents = (SB_AGENTS || []).map(a => a.id);
  const areas = (typeof SB_PICKUP_AREAS !== 'undefined' ? SB_PICKUP_AREAS : []);
  const vans = (typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : []).map(v => v.id);
  const statuses = ['confirmed', 'confirmed', 'confirmed', 'pending_approval', 'cancelled', 'confirmed'];
  const out = [];
  let n = 0;
  for (const rid of routes){
    for (let k = 0; k < 7; k++){
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
        trips: [{ routeId: rid, date: DATE, bookingMode: charter ? 'charter' : 'seat',
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
  return out.length;
}

const SCENARIOS = {
  'bytrip':           { tab: 'bytrip' },
  'bytrip-van':       { tab: 'bytrip', van: true },
  'bytrip-boat':      { tab: 'bytrip', boat: true },
  'bytrip-reconfirm': { tab: 'bytrip', rc: true },
  'all':              { tab: 'all' },
  'cal':              { tab: 'cal' },
};

const { page, errors, close } = await open();
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); });
await page.waitForTimeout(400);
const n = await page.evaluate(seed, DATE);
console.log(`seeded ${n} bookings on ${DATE}`);
fs.mkdirSync(dir, { recursive: true });
let diffs = 0;
for (const [name, s] of Object.entries(SCENARIOS)){
  errors.length = 0;
  const html = await page.evaluate(([s, DATE]) => {
    _bkV2.filterDate = DATE;
    _bkV2.boatAssignMode = !!s.boat; _bkV2.vanAssignMode = !!s.van; _bkV2.reconfirmMode = !!s.rc;
    _bkV2.tab = s.tab;
    bkV2Render();
    const v = document.querySelector('#view-booking') || document.querySelector('.view.active');
    return v ? v.innerHTML : '';
  }, [s, DATE]);
  await page.waitForTimeout(150);
  const norm = html.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, 'HH:MM') + (errors.length ? '\n<!-- errors: ' + [...new Set(errors)].join(' | ') + ' -->' : '');
  const f = path.join(dir, name + '.html');
  if (cmd === 'record'){ fs.writeFileSync(f, norm); console.log(`  ${name}: ${norm.length} chars${errors.length ? ' · ' + errors.length + ' errors' : ''}`); }
  else {
    const was = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    if (was === norm){ console.log(`  ✓ ${name}`); continue; }
    diffs++;
    fs.writeFileSync(f.replace(/\.html$/, '.after.html'), norm);
    let i = 0; while (was && i < was.length && was[i] === norm[i]) i++;
    console.log(`  ✖ ${name}: first difference at char ${i}\n     before: ${was ? JSON.stringify(was.slice(Math.max(0, i - 60), i + 120)) : '(none)'}\n     after:  ${JSON.stringify(norm.slice(Math.max(0, i - 60), i + 120))}`);
  }
}
await close();
if (cmd === 'compare'){ console.log(`differences: ${diffs}`); process.exit(diffs ? 1 : 0); }
