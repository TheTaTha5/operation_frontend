#!/usr/bin/env node
// render-golden · characterization check for refactors of the big render functions.
//
//   node tools/render-golden.mjs record  <dir>     render every scenario, write <dir>/<scenario>.html
//   node tools/render-golden.mjs compare <dir>     render again and diff against <dir>
//   ... <dir> name1,name2                           only those scenarios
//
// Seeds the page (static server + seed data, like test/ui) with a deterministic set of synthetic
// zz_test_ bookings on one travel date — every route, seat + charter, several agents/zones, van and
// boat assignments, alt pickups, self-arrive, cancelled/pending — in memory only (nothing is saved),
// then renders each scenario and captures the view's HTML. Record before a refactor, compare after:
// a behavior-neutral refactor gives 0 differences. Clock-dependent text (HH:MM) is masked.
import fs from 'node:fs';
import path from 'node:path';
import { open } from '../test/ui/_harness.mjs';
import { DATE, PAST, NOW, seedPage } from '../test/fixtures/ui-seed.mjs';

const [cmd, dir] = process.argv.slice(2);
if (!['record', 'compare'].includes(cmd) || !dir){ console.log('usage: record|compare <dir>'); process.exit(2); }

// Each scenario runs in the page and returns the HTML to compare. Keep them read-only: nothing here
// may persist, open a real window, or raise a dialog (alert/confirm block the harness).
const bookingTab = (tab, modes = {}) => [(DATE, a) => {
  _bkV2.detailId = null; _bkV2.filterDate = DATE;
  _bkV2.boatAssignMode = !!a.boat; _bkV2.vanAssignMode = !!a.van; _bkV2.reconfirmMode = !!a.rc;
  _bkV2.tab = a.tab; bkV2Render();
  return (document.querySelector('#view-booking') || {}).innerHTML || '';
}, { tab, ...modes }];
const SCENARIOS = {
  'bytrip':           bookingTab('bytrip'),
  'bytrip-van':       bookingTab('bytrip', { van: true }),
  'bytrip-boat':      bookingTab('bytrip', { boat: true }),
  'bytrip-reconfirm': bookingTab('bytrip', { rc: true }),
  'all':              bookingTab('all'),
  'cal':              bookingTab('cal'),
  // bkV2RenderBookingDetail · a spread of the seeded bookings (seat/charter, self-arrive, alt pickups, statuses)
  'booking-detail': [(DATE) => {
    const out = [];
    for (const id of SB_BOOKINGS.map(b => b.id).filter((_, i) => i % 5 === 0)){
      _bkV2.tab = 'all'; _bkV2.detailId = id; bkV2Render();
      out.push('<!-- ' + id + ' -->' + ((document.querySelector('#view-booking') || {}).innerHTML || ''));
    }
    _bkV2.detailId = null;
    return out.join('\n');
  }],
  // renderTravelSum
  'travelsum': [(DATE) => {
    const el = document.querySelector('.nav-item[data-view="travelsum"]'); if (el) nav(el);
    _tsDate = DATE; renderTravelSum();
    return (document.getElementById('travelsum-host') || {}).innerHTML || '';
  }],
  // renderTripPL · daily / monthly / analysis (pxAnalysis)
  'trippl': [(DATE) => {
    const el = document.querySelector('.nav-item[data-view="trippl"]'); if (el) nav(el);
    const out = [];
    for (const tab of ['d', 'm', 'a']){
      _px.date = DATE; _px.mon = DATE.slice(0, 7); _px.tab = tab; renderTripPL();
      out.push('<!-- tab ' + tab + ' -->' + ((document.getElementById('trippl-host') || {}).innerHTML || ''));
    }
    return out.join('\n');
  }],
  // ctPlanHtml (Costing · plan tab)
  'costing': [(DATE) => {
    const el = document.querySelector('.nav-item[data-view="costing"]'); if (el) nav(el);
    _ct.tab = 'plan'; ctRender();
    return (document.getElementById('view-costing') || {}).innerHTML || '';
  }],
  // pjPrint · the boat job sheet written into a pop-up · captured by stubbing window.open
  'pjprint': [(DATE) => {
    const out = [], wOpen = window.open, wAlert = window.alert, sT = window.setTimeout;
    let buf = '';
    window.open = () => ({ document: { open(){}, write(h){ buf += h; }, close(){} }, focus(){} });
    window.alert = m => { buf += '[alert] ' + m; };
    try {
      for (const P of PO_PIERS){ for (const f of ['all', 'go']){
        buf = ''; _poDate = DATE; _poPier = P.k; _pjF = f; pjPrint();
        out.push('<!-- ' + P.k + ' ' + f + ' -->' + buf);
      } }
    } finally { window.open = wOpen; window.alert = wAlert; }
    return out.join('\n');
  }],
};

const { page, errors, close } = await open();
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]'); if (el) nav(el); });
await page.waitForTimeout(400);
const n = await seedPage(page);
console.log(`seeded ${n} bookings · main date ${DATE} · ${PAST.length} past dates · clock ${NOW}`);
fs.mkdirSync(dir, { recursive: true });
let diffs = 0;
const only = process.argv[4] ? process.argv[4].split(',') : null;
for (const [name, [run, arg]] of Object.entries(SCENARIOS)){
  if (only && !only.includes(name)) continue;
  errors.length = 0;
  let html;
  try { html = await page.evaluate(([src, DATE, arg]) => (0, eval)('(' + src + ')')(DATE, arg || {}), [run.toString(), DATE, arg]); }
  catch (e){ html = '<!-- THROW ' + String(e).slice(0, 300) + ' -->'; }
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
