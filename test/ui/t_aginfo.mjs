// §agSheet · แท็บ Information ของ Agent · ต้องอยู่ในโหมดตาราง ไม่ใช่กองการ์ด
//
// ที่มา (2026-09-18) · ของเดิมเป็นการ์ดมุมมนซ้อนกันเป็นชั้น ๆ ทุกอย่างมีพื้นหลังและขอบของตัวเอง
//   อ่านทีละใบได้ แต่ไล่สายตาข้ามบรรทัดไม่ได้ และกินความสูงมาก
//   ข้อมูลหน้านี้เป็นตารางโดยธรรมชาติอยู่แล้ว (โปรแกรม × ช่วงจอง × ช่วงเดินทาง)
//
// เทสนี้วัด "หน้าตา" ไม่ใช่ตัวเลข · จับได้เรื่องเดียวคือความหนาแน่นไหลกลับไปเป็นการ์ด
// ⚠ ต้องวาดใน #view-agents เท่านั้น · CSS ทั้งบล็อกถูก scope ไว้ใต้ id นั้น
//   วาดนอกนั้นจะได้สไตล์เก่าแล้วเทสจะฟ้องผิดจุด
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const warn = m => console.log('  ! ' + m);

const draw = async (page) => page.evaluate(() => {
  const view = document.getElementById('view-agents');
  let host = document.getElementById('ag-tabbody');
  if(!host){ host = document.createElement('div'); host.id = 'ag-tabbody'; view.appendChild(host); }
  host.style.cssText = 'background:#fff;padding:20px 24px';
  // เลือกเอเย่นต์ที่มีโปรแกรมพอให้ตารางมีความหมาย
  const a = (SB_AGENTS||[]).filter(x => (x.programPeriods||[]).length >= 5)[0] || (SB_AGENTS||[])[0];
  host.innerHTML = agTabInfo(a);
  const row  = host.querySelector('.agi-prog-row');
  const name = host.querySelector('.agi-prog-name-wrap');
  const val  = host.querySelector('.agi-period-val');
  const card = host.querySelector('.agi-info-card');
  const sale = host.querySelector('.agi-sales-card');
  const cs   = el => el ? getComputedStyle(el) : null;
  return {
    agent: a.code, n: (a.programPeriods||[]).length,
    rowH:  row  ? Math.round(row.getBoundingClientRect().height)  : -1,
    nameH: name ? Math.round(name.getBoundingClientRect().height) : -1,
    saleH: sale ? Math.round(sale.getBoundingClientRect().height) : -1,
    cardH: card ? Math.round(card.getBoundingClientRect().height) : -1,
    totalH: Math.round(host.getBoundingClientRect().height),
    rowRadius: row  ? cs(row).borderTopLeftRadius : '?',
    cardBg:    card ? cs(card).backgroundColor    : '?',
    valMono:   val  ? /mono/i.test(cs(val).fontFamily) : false,
    overflowX: Math.max(0, host.scrollWidth - host.clientWidth)
  };
});

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 1600 });
await page.click('.nav-item[data-view="agents"]');
await page.waitForTimeout(900);
const D = await draw(page);
console.log('Agent Information · ' + D.agent + ' · ' + D.n + ' programs');

/* ── แถวต้องเตี้ยแบบชีต ── */
if (D.rowH < 0) fail('วาดตารางไม่ออก');
else if (D.rowH > 44)
  fail('แถวสูง ' + D.rowH + 'px · กลับไปเป็นการ์ดแล้ว');
else ok('แถวสูง ' + D.rowH + 'px');

/* ── ชื่อโปรแกรมกับท่าเรือต้องอยู่บรรทัดเดียว ── */
if (D.nameH > 26)
  fail('ชื่อกับท่าเรือแยกสองบรรทัด (' + D.nameH + 'px) · แถวสูงเป็นเท่าโดยไม่ได้ข้อมูลเพิ่ม');
else ok('ชื่อโปรแกรมกับท่าเรืออยู่บรรทัดเดียว');

/* ── แถวต้องไม่ใช่การ์ดมุมมน ── */
if (parseFloat(D.rowRadius) > 4)
  fail('แถวยังมีมุมมน ' + D.rowRadius + ' · โหมดตารางไม่ควรมี');
else ok('แถวเป็นเส้นคั่น ไม่ใช่การ์ด');

/* ── ช่องข้อมูลต้องไม่เป็นกล่องสีทึบ ── */
const solid = D.cardBg && !/rgba\(0, 0, 0, 0\)|transparent/.test(D.cardBg);
if (solid) fail('ช่องข้อมูลยังมีพื้นหลังทึบ (' + D.cardBg + ')');
else ok('ช่องข้อมูลแบนราบ คั่นด้วยเส้น');

/* ── วันที่ต้องเป็นตัวเลขเรียงหลัก ── */
if (!D.valMono) warn('ช่องวันที่ไม่ได้ใช้ฟอนต์ mono · ตัวเลขอาจไม่ตรงหลัก');
else ok('ช่องวันที่ใช้ฟอนต์เรียงหลัก');

/* ── คนดูแลต้องเป็นบรรทัดเดียว ── */
if (D.saleH > 52) fail('แถบคนดูแลสูง ' + D.saleH + 'px · ควรเป็นบรรทัดเดียว');
else ok('แถบคนดูแลสูง ' + D.saleH + 'px');

if (D.overflowX > 2) fail('ล้นแนวนอน ' + D.overflowX + 'px');
else ok('ไม่ล้นแนวนอน');
console.log('  · ความสูงทั้งแท็บ ' + D.totalH + 'px');

/* ── มือถือ · กฎใน 02-skins.css ต้องยังชนะบล็อกนี้ ─────────────────────────
   บล็อก §agSheet เป็น CSS ชั้นบน · ถ้าวันไหนเขียนแรงกว่ากฎมือถือ ตารางจะไม่ยุบเป็นคอลัมน์เดียว
   แล้วหน้าจะล้นออกนอกจอบนมือถือ · ข้อนี้กันเรื่องนั้น */
await page.setViewportSize({ width: 390, height: 812 });
await page.waitForTimeout(400);
const M = await draw(page);
if (M.overflowX > 4)
  fail('มือถือ 390px · ล้นแนวนอน ' + M.overflowX + 'px · กฎมือถือถูก §agSheet ทับ');
else ok('มือถือ 390px · ไม่ล้นแนวนอน');

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
