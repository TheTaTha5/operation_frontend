// t_embed · โหมดฝัง iframe (?embed=1) · js/10-embed.js
//
//   node test/ui/t_embed.mjs
//
// เช็ค 3 อย่างที่พังเงียบได้ง่ายที่สุด
//   1. ไม่ใส่ ?embed=1 แล้วต้องไม่มีอะไรเปลี่ยน (แถบบน+เมนูข้างยังอยู่ · หน้าแรกยัง Dashboard)
//   2. ใส่แล้วต้องถอดแถบบน/เมนูข้าง และ --topbar ต้องเป็น 0 (ของที่ sticky อ่านค่านี้)
//   3. ไปโผล่หน้า+แท็บ+วันที่ ที่สั่งมาจริง และหน้าต้องไม่ว่าง
// แล้วเช็คว่าสั่งเปลี่ยนวันผ่าน postMessage ได้โดยไม่ต้องโหลดกรอบใหม่
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
/* 404 ของ /allotment_v2/assets/* เป็นเสียงรบกวนเดิมของฮาร์เนส ไม่เกี่ยวกับโหมดฝัง
   ฮาร์เนสเสิร์ฟโดยใช้ allotment_v2/ เป็นราก แต่ favicon ใน HTML เขียนเป็น path
   สัมบูรณ์ /allotment_v2/assets/... จึงกลายเป็น allotment_v2/allotment_v2/assets/
   กรองทิ้งที่นี่ จะได้เห็น error จริงถ้ามี */
const NOISE = /Failed to load resource|\/allotment_v2\/assets\//;
page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });

const base = `http://127.0.0.1:${port}/allotment_v2.html`;
const fails = [];
const ok = (name, cond, got) => {
  console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got)));
  if (!cond) fails.push(name);
};

async function load(qs){
  await page.goto(base + qs);
  await page.waitForFunction(() => typeof window.nav === 'function'
    && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(1400);        // เลย laApplyPerms 600ms และ applyView ซ้ำที่ 1000ms
}

const probe = () => page.evaluate(() => {
  const cs = getComputedStyle;
  const bar = document.querySelector('.topbar'), sb = document.querySelector('.sidebar');
  const act = document.querySelector('.nav-item.active');
  const view = document.querySelector('.view.active');
  let tab = '', fdate = '';
  try { tab = _bkV2.tab || ''; fdate = _bkV2.filterDate || ''; } catch (_) {}
  return {
    embed:   !!window.__laEmbed,
    topbar:  bar ? cs(bar).display : 'missing',
    sidebar: sb  ? cs(sb).display  : 'missing',
    topvar:  cs(document.documentElement).getPropertyValue('--topbar').trim(),
    mainml:  (() => { const m = document.querySelector('.main'); return m ? cs(m).marginLeft : 'missing'; })(),
    active:  act && act.dataset ? act.dataset.view : '',
    tab, fdate,
    body:    view ? view.innerText.trim().length : 0,
    msg:     !!document.getElementById('la-embed-msg'),
  };
});

// ── 1) ไม่ใส่ ?embed=1 · ต้องเหมือนเดิมเป๊ะ ────────────────────────────────
console.log('\nปกติ (ไม่มี ?embed=1)');
await load('');
let s = await probe();
ok('__laEmbed ไม่ถูกตั้ง',      s.embed === false, s.embed);
ok('แถบบนยังอยู่',              s.topbar !== 'none', s.topbar);
ok('เมนูข้างยังอยู่',            s.sidebar !== 'none', s.sidebar);
/* --topbar เป็น 0px อยู่แล้วตั้งแต่ก่อนมีโหมดฝัง · สกิน topbar-float-skin ถอดแถบบน
   ออกไปแล้ว เหลือแค่ปุ่มเครื่องมือลอยมุมขวาบน · ตัวที่วัดความต่างได้จริงคือเมนูข้าง
   ไม่ผูกกับตัวเลข (ตอนนี้ 274px จากสกิน liquid-glass ไม่ใช่ 220px ของ --sidebar)
   เปลี่ยนสกินทีหลังตัวเลขก็เปลี่ยน · ที่ต้องจริงคือ "ยังเว้นที่อยู่" เท่านั้น */
ok('เนื้อหายังเว้นที่ให้เมนูข้าง', s.mainml !== '0px' && s.mainml !== 'missing', s.mainml);
ok('หน้าแรกยังเป็น dashboard',   s.active === 'dashboard', s.active);

// ── 2) ?embed=1 · หน้าปฏิทินของ Booking ───────────────────────────────────
console.log('\nฝัง · ปฏิทิน (view=booking&tab=cal)');
await load('?embed=1&view=booking&tab=cal');
s = await probe();
ok('__laEmbed ถูกตั้ง',   s.embed === true, s.embed);
ok('แถบบนหาย',            s.topbar === 'none', s.topbar);
ok('เมนูข้างหาย',          s.sidebar === 'none', s.sidebar);
ok('--topbar = 0px',      s.topvar === '0px', s.topvar);
ok('เนื้อหากินเต็มความกว้าง', s.mainml === '0px', s.mainml);
ok('อยู่หน้า booking',     s.active === 'booking', s.active);
ok('แท็บ = cal',          s.tab === 'cal', s.tab);
ok('ไม่มีการ์ดแจ้งเตือน',   s.msg === false, s.msg);
ok('มีเนื้อหาวาดออกมา',    s.body > 40, s.body);

// ── 3) ?embed=1 · By trip · date + วันที่ที่สั่ง ──────────────────────────
console.log('\nฝัง · By trip · date (tab=bytrip&date=2026-09-20)');
await load('?embed=1&view=booking&tab=bytrip&date=2026-09-20');
s = await probe();
ok('อยู่หน้า booking',   s.active === 'booking', s.active);
ok('แท็บ = bytrip',      s.tab === 'bytrip', s.tab);
ok('วันที่ = 2026-09-20', s.fdate === '2026-09-20', s.fdate);
ok('มีเนื้อหาวาดออกมา',   s.body > 40, s.body);

// ── 4) postMessage · เปลี่ยนวันโดยไม่โหลดกรอบใหม่ ─────────────────────────
console.log('\nฝัง · สั่งเปลี่ยนวันผ่าน postMessage');
await page.evaluate(() => {
  // ในเทสไม่มีหน้าแม่จริง · ตัวรับเช็ค e.source === window.parent ซึ่งในหน้าบนสุด
  // window.parent === window อยู่แล้ว การยิงใส่ตัวเองจึงผ่านเงื่อนไขเดียวกับของจริง
  window.postMessage({ type: 'la-embed', tab: 'bytrip', date: '2026-10-05' }, '*');
});
await page.waitForTimeout(700);
s = await probe();
ok('วันที่เปลี่ยนเป็น 2026-10-05', s.fdate === '2026-10-05', s.fdate);
ok('ยังอยู่หน้า booking',          s.active === 'booking', s.active);

// ── 5) view ที่ไม่มีจริง · ต้องบอก ไม่ใช่จอขาว ────────────────────────────
console.log('\nฝัง · view ที่ไม่มีอยู่จริง');
await load('?embed=1&view=notaview');
s = await probe();
ok('ขึ้นการ์ดบอกว่าไม่พบหน้า', s.msg === true, s.msg);

console.log('\nพัง ' + fails.length + (fails.length ? ' · ' + fails.join(' · ') : ''));
if (errors.length){
  console.log('error ระหว่างทาง ' + errors.length);
  for (const e of [...new Set(errors)].slice(0, 6)) console.log('   ' + e);
}
await browser.close(); srv.close();
process.exit(fails.length ? 1 : 0);
