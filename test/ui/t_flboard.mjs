// §flBoard · บอร์ดงานเรือบนหัว Fleet Dashboard
//
// ที่มา (2026-09-22) · "งานเยอะจนไม่รู้จะตามอะไรก่อน"
//   ของจริง · ใบซ่อมเปิดค้าง 36 ใบ · 28 ใบอายุเกิน 90 วัน · 20 ใบไม่มีใครบันทึกอะไรเกิน 60 วัน
//   แต่ทุกใบสถานะ inprogress เหมือนกันหมด · และเรือบริษัทจอดอยู่ 9 จาก 15 ลำ
//   แถบตัวเลขเดิมบนหัวหน้าตอบได้แค่ "มีเท่าไหร่" จึงถูกแทนด้วยบอร์ดที่ตอบว่า "ต้องทำอะไรต่อ"
//
// เทสนี้กันห้าอย่าง
//   1 ใบที่ยังเปิดต้องขึ้นบอร์ดครบ ไม่หาย ไม่ซ้ำ
//   2 เลนต้องคิดถูกตามกติกา · เทียบกับตัวคิดอิสระของเทสเอง ไม่ใช่เรียก flBoardLane
//   3 กดการ์ดแล้วบันทึกได้จริง · ลงใบจริงและลง localStorage
//   4 ลากข้ามเลนแล้วอยู่ที่เดิมหลังวาดใหม่ (เขียนลงใบ ไม่ใช่จำไว้บนหน้าจอ)
//   5 พักไว้แล้วหลุดจากบอร์ดและจากตัวนับ
//
// ⚠ ต้องเปิดผ่าน nav() จริง · บอร์ดวาดจาก flRenderDashboard
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1950, height: 1000 });
page.on('dialog', d => d.accept());
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="fl-dashboard"]'); if (el) nav(el); });
await page.waitForTimeout(1600);

/* ตัวคิดอิสระของเทส · เขียนจากข้อมูลดิบเอง ไม่เรียกฟังก์ชันของหน้า
   ถ้าเทสไปเรียก flBoardLane() สองฝั่งจะตรงกันเสมอแม้กติกาจะเพี้ยน — จับอะไรไม่ได้เลย */
const MINE = `(function(){
  var WAIT=/รอ|สั่ง|อะไหล่|คาน|ผู้รับเหมา|อนุมัติ|เคลม|ประกัน|memo|order|quote/i;
  function days(d){ if(!d) return 0;
    var A=String(d).slice(0,10).split('-'), B=TODAY_STR.split('-');
    return Math.round((Date.UTC(+B[0],+B[1]-1,+B[2])-Date.UTC(+A[0],+A[1]-1,+A[2]))/86400000); }
  var out={jobs:[], down:{}, money:0, silent:0, noOwner:0};
  (FL_MAINT||[]).forEach(function(m){
    if(!m || m.status==='done' || m.parked) return;
    var last=String(m.startDate||'');
    (m.progressLog||[]).forEach(function(e){ var x=String((e&&e.date)||''); if(x>last) last=x; });
    var sil=Math.max(0, days(last));
    var b=(typeof getBoat==='function')?getBoat(m.boatId):null;
    var st=b?((getCurStatus(b,TODAY_STR)||{}).s||''):'';
    var blocks=(st==='fixing'||st==='unavailable');
    var L=(m.progressLog||[]);
    var txt=L.length?String(L[L.length-1].text||''):'';
    var lane = m.boardLane ? m.boardLane
             : !blocks ? 'close'
             : sil<=30 ? 'doing'
             : (txt && WAIT.test(txt)) ? 'wait'
             : 'decide';
    if(blocks){ if(m.boatId) out.down[m.boatId]=1;
      out.money += (typeof flMaintCalcCost==='function')?(flMaintCalcCost(m.id)||0):(m.cost||0); }
    if(sil>60) out.silent++;
    if(!String(m.owner||'').trim()) out.noOwner++;
    out.jobs.push({id:m.id, no:m.no, lane:lane, sil:sil, blocks:blocks});
  });
  out.nDown=Object.keys(out.down).length;
  out.money=Math.round(out.money);
  return out;
})()`;

/* ══ 1 · ใบขึ้นบอร์ดครบ ไม่หาย ไม่ซ้ำ ═══════════════════════════════════ */
const A = await page.evaluate(`(function(){
  var mine=${MINE};
  var cards=[].slice.call(document.querySelectorAll('#fl-board .kd')).map(function(c){ return c.getAttribute('data-mj'); });
  var seen={}, dup=0;
  cards.forEach(function(id){ if(seen[id]) dup++; seen[id]=1; });
  var missing=mine.jobs.filter(function(j){ return !seen[j.id]; }).map(function(j){ return j.no; });
  var extra=cards.filter(function(id){ return !mine.jobs.some(function(j){ return j.id===id; }); });
  return { board:!!document.getElementById('fl-board'), nMine:mine.jobs.length, nCards:cards.length,
           dup:dup, missing:missing.slice(0,5), extra:extra.slice(0,5) };
})()`);
if (!A.board) fail('ไม่มีบอร์ดบนหน้า Fleet Dashboard');
else if (A.dup) fail('มีใบขึ้นบอร์ดซ้ำ ' + A.dup + ' ใบ');
else if (A.missing.length) fail('ใบที่ยังเปิดแต่ไม่ขึ้นบอร์ด · ' + A.missing.join(', '));
else if (A.extra.length) fail('มีการ์ดที่ไม่ตรงกับใบไหนเลย ' + A.extra.length + ' ใบ');
else ok('ใบที่ยังเปิด ' + A.nMine + ' ใบ ขึ้นบอร์ดครบ ไม่ซ้ำ');

/* ══ 2 · เลนต้องตรงกับตัวคิดอิสระ ═══════════════════════════════════════ */
const B = await page.evaluate(`(function(){
  var mine=${MINE}, wrong=[];
  mine.jobs.forEach(function(j){
    var el=document.querySelector('#fl-board .kd[data-mj="'+j.id+'"]');
    if(!el) return;
    var lane=el.closest('.lane').getAttribute('data-lane');
    if(lane!==j.lane) wrong.push(j.no+' อยู่เลน '+lane+' แต่ควรเป็น '+j.lane);
  });
  var byLane={};
  [].slice.call(document.querySelectorAll('#fl-board .lane')).forEach(function(l){
    byLane[l.getAttribute('data-lane')]=l.querySelectorAll('.kd').length; });
  var headCount={};
  [].slice.call(document.querySelectorAll('#fl-board .lane')).forEach(function(l){
    headCount[l.getAttribute('data-lane')]=+l.querySelector('.lh .c').textContent; });
  return { wrong:wrong.slice(0,4), nWrong:wrong.length, byLane:byLane, headCount:headCount };
})()`);
if (B.nWrong) fail(B.nWrong + ' ใบอยู่ผิดเลน · ' + B.wrong.join(' | '));
else ok('ทุกใบอยู่ถูกเลนตามกติกา · ' + Object.keys(B.byLane).map(k => k + ' ' + B.byLane[k]).join(' · '));
const headBad = Object.keys(B.byLane).filter(k => B.byLane[k] !== B.headCount[k]);
if (headBad.length) fail('ตัวเลขบนหัวเลนไม่ตรงกับจำนวนการ์ด · ' + headBad.join(', '));
else ok('ตัวเลขบนหัวเลนตรงกับจำนวนการ์ดทุกเลน');

/* ══ 2b · ตัวเลขบนหัวบอร์ด ═════════════════════════════════════════════ */
const C = await page.evaluate(`(function(){
  var mine=${MINE};
  var v=[].slice.call(document.querySelectorAll('#fl-board .nm b')).map(function(e){ return e.textContent.trim(); });
  return { shown:v, mine:{down:mine.nDown, jobs:mine.jobs.length, money:mine.money, silent:mine.silent, noOwner:mine.noOwner} };
})()`);
/* ช่องแรกเขียนเป็น "9 / 15" · ต้องอ่านเลขตัวแรกตัวเดียว ไม่ใช่ถอดอักขระที่ไม่ใช่เลขออกทั้งหมด
   (ถอดทั้งหมดจะได้ 915 แล้วเทสจะฟ้องผิดทุกครั้ง) */
const num1 = s => Number((String(s).match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, '')) || 0;
const num = s => Number(String(s).replace(/[^0-9]/g, '')) || 0;
if (num1(C.shown[0]) !== C.mine.down) fail('หัวบอร์ดบอกเรือจอด "' + C.shown[0] + '" แต่นับเองได้ ' + C.mine.down);
else if (num(C.shown[1]) !== C.mine.money) fail('หัวบอร์ดบอกเงิน "' + C.shown[1] + '" แต่นับเองได้ ' + C.mine.money);
else if (num(C.shown[2]) !== C.mine.jobs) fail('หัวบอร์ดบอกใบที่เปิด "' + C.shown[2] + '" แต่นับเองได้ ' + C.mine.jobs);
else if (num(C.shown[3]) !== C.mine.silent) fail('หัวบอร์ดบอกใบเงียบ "' + C.shown[3] + '" แต่นับเองได้ ' + C.mine.silent);
else ok('ตัวเลขบนหัวบอร์ดตรงกับตัวนับอิสระทุกตัว · ' + C.shown.slice(0, 4).join(' / '));

/* ══ 3 · กดการ์ดแล้วบันทึกได้จริง และลง localStorage ════════════════════ */
const D = await page.evaluate(() => {
  const c = document.querySelector('#fl-board .lane[data-lane="decide"] .kd') || document.querySelector('#fl-board .kd');
  const id = c.getAttribute('data-mj');
  c.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  const popOn = !!(document.getElementById('fl-board-pop') || {}).classList?.contains('on');
  const m0 = FL_MAINT.find(x => x.id === id);
  const nLog0 = (m0.progressLog || []).length, sil0 = flBoardSilent(m0);
  document.getElementById('fl-bd-own').value  = 'ช่างหัวหน้า';
  document.getElementById('fl-bd-due').value  = '2026-09-30';
  document.getElementById('fl-bd-note').value = 'คุยกับอู่แล้ว นัดเข้าอาทิตย์หน้า';
  flBoardSaveCard();
  const m1 = FL_MAINT.find(x => x.id === id);
  const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const kept = (ls.fleet_maintenance || []).find(x => x.id === id) || {};
  return { id, no:m1.no, popOn, owner:m1.owner, due:m1.dueDate,
           logAdded:(m1.progressLog || []).length - nLog0, sil0, sil1:flBoardSilent(m1),
           keptOwner:kept.owner, keptDue:kept.dueDate,
           keptLog:((kept.progressLog || []).slice(-1)[0] || {}).text || '' };
});
if (!D.popOn) fail('กดการ์ดแล้วกล่องสั่งงานไม่เปิด');
else if (D.owner !== 'ช่างหัวหน้า' || D.due !== '2026-09-30') fail('บันทึกผู้รับผิดชอบ/วันตอบไม่ติด');
else if (D.logAdded !== 1) fail('บันทึกความคืบหน้าไม่ได้ลงใบ · เพิ่มมา ' + D.logAdded + ' บรรทัด');
else if (D.sil1 !== 0) fail('บันทึกแล้วความเงียบไม่รีเซ็ต · ยังเป็น ' + D.sil1 + ' วัน');
else if (D.keptOwner !== 'ช่างหัวหน้า' || D.keptDue !== '2026-09-30' || !/นัดเข้าอาทิตย์หน้า/.test(D.keptLog))
  fail('บันทึกแล้วไม่ลง localStorage · รีเฟรชแล้วหาย');
else ok(D.no + ' · บันทึกลงใบและลงเครื่องจริง · เงียบ ' + D.sil0 + ' → 0 วัน');

/* ══ 4 · ลากข้ามเลนแล้วต้องอยู่ที่เดิมหลังวาดใหม่ ══════════════════════ */
const E = await page.evaluate(() => {
  const c = document.querySelector('#fl-board .lane[data-lane="decide"] .kd');
  if (!c) return { skip:true };
  const id = c.getAttribute('data-mj');
  _flBoardDrag = id;
  flBoardDrop({preventDefault(){}, dataTransfer:null}, document.querySelector('#fl-board .lane[data-lane="wait"]'));
  const afterDrop = (document.querySelector('#fl-board .kd[data-mj="' + id + '"]') || {}).closest
    ? document.querySelector('#fl-board .kd[data-mj="' + id + '"]').closest('.lane').getAttribute('data-lane') : '';
  flBoardRefresh();   /* วาดใหม่ · ถ้าจำไว้แค่บนหน้าจอ ตรงนี้จะเด้งกลับ */
  const afterRedraw = (document.querySelector('#fl-board .kd[data-mj="' + id + '"]') || {}).closest
    ? document.querySelector('#fl-board .kd[data-mj="' + id + '"]').closest('.lane').getAttribute('data-lane') : '';
  const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const kept = (ls.fleet_maintenance || []).find(x => x.id === id) || {};
  const m = FL_MAINT.find(x => x.id === id);
  return { skip:false, no:m.no, afterDrop, afterRedraw, kept:kept.boardLane,
           logged:/ย้ายไปเลน/.test(((m.progressLog || []).slice(-1)[0] || {}).text || '') };
});
if (E.skip) console.log('  ! ไม่มีใบในเลนต้องตัดสินใจให้ลาก · ข้ามข้อนี้');
else if (E.afterDrop !== 'wait') fail('ลากแล้วการ์ดไม่ย้ายเลน · ได้ ' + E.afterDrop);
else if (E.afterRedraw !== 'wait') fail('วาดใหม่แล้วการ์ดเด้งกลับ · ลากแล้วไม่ได้เขียนลงใบ');
else if (E.kept !== 'wait') fail('เลนที่ลากไม่ลง localStorage · รีเฟรชแล้วหาย');
else if (!E.logged) fail('ลากแล้วไม่ได้บันทึกว่าใครย้ายเมื่อไหร่');
else ok(E.no + ' · ลากข้ามเลนแล้วอยู่ที่เดิมหลังวาดใหม่ และมีบันทึกไว้');

/* ══ 5 · พักไว้แล้วหลุดจากบอร์ดและจากตัวนับ ════════════════════════════ */
const F = await page.evaluate(() => {
  const before = flBoardScan();
  const c = document.querySelector('#fl-board .kd');
  const id = c.getAttribute('data-mj');
  c.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  flBoardPark();
  const m = FL_MAINT.find(x => x.id === id);
  const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const kept = (ls.fleet_maintenance || []).find(x => x.id === id) || {};
  return { no:m.no, parked:m.parked, keptParked:kept.parked,
           onBoard:!!document.querySelector('#fl-board .kd[data-mj="' + id + '"]'),
           before:before.jobs, after:flBoardScan().jobs, parkedCount:flBoardScan().parked };
});
if (!F.parked) fail('กดพักไว้แล้วไม่ได้ทำเครื่องหมายอะไรบนใบ');
else if (F.onBoard) fail('พักไว้แล้วการ์ดยังอยู่บนบอร์ด');
else if (F.after !== F.before - 1) fail('พักไว้แล้วตัวนับใบที่เปิดไม่ลด · ' + F.before + ' → ' + F.after);
else if (F.keptParked !== F.parked) fail('พักไว้แล้วไม่ลง localStorage');
else ok(F.no + ' · พักไว้แล้วหลุดจากบอร์ดและตัวนับ · ใบที่เปิด ' + F.before + ' → ' + F.after);

/* ══ 6 · จอแคบ · ต้องไม่ล้นแนวนอน ══════════════════════════════════════ */
for (const w of [1440, 900, 390]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(350);
  const G = await page.evaluate(() => ({
    ovf: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    board: !!document.getElementById('fl-board')
  }));
  if (!G.board) fail(w + 'px · บอร์ดหายไป');
  else if (G.ovf > 2) fail(w + 'px · ล้นแนวนอน ' + G.ovf + 'px');
  else ok(w + 'px · บอร์ดอยู่ครบ ไม่ล้นแนวนอน');
}

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
