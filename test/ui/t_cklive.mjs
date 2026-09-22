// §ckLive2 · หน้าเช็คอินหน้าท่า · สองเครื่องทำพร้อมกันต้องเห็นของกันเองเร็ว
//
// ที่มา (2026-09-22) · "A กดเช็คอิน หน้าจอ B จะอัพเดทอีกใน 10 วินาที ซึ่งนานไป
//   หรือบางที ถ้าอีกหน้าจอจับเม้าอยู่ยิ่งไม่อัพเดท"
//   10 วิ คือคาบของ poll /api/version ซึ่งเป็นตัวสำรอง · ทางหลักคือ SSE ที่ควรถึงใน ~1 วิ
//   ได้ 10 วิพอดีแปลว่า SSE ของเครื่องนั้นตายแล้ว และไม่มีใครปลุกมันอีกเลยทั้งกะ
//
// ⚠ เทสนี้ยกเซิร์ฟเวอร์ปลอมของตัวเอง ไม่ใช้ _harness.mjs
//   ฮาร์เนสตัวนั้นเสิร์ฟไฟล์อย่างเดียว · /api/me ล้ม → ชั้น sync return ออกตั้งแต่ต้น
//   (ตั้งใจไว้สำหรับ dev ที่ไม่มี backend) แปลว่าตัวจับเวลา ตัว SSE และ _laBusy
//   ไม่เคยถูกสร้างขึ้นมาเลย · จะทดสอบเรื่องนี้ได้ต้องมีของจริงให้มันคุยด้วย
//
// กันหกอย่าง
//   1 หน้าเช็คอินเปิดอยู่ · เวอร์ชันขยับ ต้องเห็นภายใน ~2 วิ แม้ SSE เงียบสนิท
//   2 SSE ส่งมา ต้องเห็นเร็วกว่านั้นอีก (ไม่ต้องรอคาบ poll)
//   3 SSE ตาย ต้องมีคนปลุก · ไม่ใช่ปล่อยช้าไปทั้งกะ
//   4 กำลังเลื่อนจอ/แตะจออยู่ ก็ยังต้องอัพเดท
//   5 ลิ้นชักเปิดค้างอยู่ ห้ามถูกวาดทับ (ของที่พิมพ์ค้างต้องไม่หาย)
//   6 ออกจากหน้านี้แล้ว ต้องเลิกถามถี่ · ไม่ใช่ยิงทุก 2 วิทั้งวันทุกหน้า
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../allotment_v2');
const BLOB = process.env.LAD;
if (!BLOB || !fs.existsSync(BLOB)) { console.log('  ! ต้องมี LAD=<ไฟล์ข้อมูล> · ข้ามเทสนี้'); process.exit(0); }

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

/* ── เซิร์ฟเวอร์ปลอม · พูดภาษาเดียวกับของจริงเฉพาะเท่าที่ชั้น sync ใช้ ───── */
const S = {
  version: 1,
  data: fs.readFileSync(BLOB, 'utf8'),
  sse: new Set(),
  sseOpens: 0,          // นับจำนวนครั้งที่ไคลเอนต์มาเปิดสาย · ใช้พิสูจน์ว่ามีคนปลุก
  verHits: 0,           // นับจำนวนครั้งที่ถูกถามเวอร์ชัน · ใช้พิสูจน์ว่าหยุดถามเมื่อออกจากหน้า
  loads: 0,
  sseRefuse: false      // true = ตอบ 401 ให้ EventSource (จำลอง session สะดุด)
};
function bump(by){ S.version++; return { version:S.version, updated_by:by||'เครื่อง A' }; }
function push(by){ const m=bump(by); const t='data: '+JSON.stringify(m)+'\n\n';
  S.sse.forEach(r=>{ try{ r.write(t); }catch(_){} }); return m; }

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const J = (code, obj) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'}); res.end(JSON.stringify(obj)); };
  if (u === '/api/me') return J(200, { username:'test', name:'ทดสอบ', role:'admin', canEdit:true });
  if (u === '/api/version'){ S.verHits++; return J(200, { version:S.version, updated_by:'เครื่อง A',
    updated_at:new Date().toISOString() }); }
  if (u === '/api/load'){ S.loads++; return J(200, { version:S.version, data:S.data,
    updated_by:'เครื่อง A', updated_at:new Date().toISOString() }); }
  if (u === '/api/events'){
    S.sseOpens++;
    if (S.sseRefuse){ res.writeHead(401); return res.end(); }
    res.writeHead(200, {'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache',
      'connection':'keep-alive'});
    res.write('retry: 1000\n\n');
    S.sse.add(res);
    req.on('close', () => S.sse.delete(res));
    return;
  }
  if (u === '/api/save' || u === '/api/v1/_batch'){
    let n = 0; req.on('data', c => n += c.length);
    return req.on('end', () => J(200, { ok:true, version:++S.version }));
  }
  if (u.startsWith('/api/')) return J(200, {});
  const rel = decodeURIComponent(u).replace(/^\/+/, '') || 'allotment_v2.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const port = await new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{ width:1600, height:950 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(`http://127.0.0.1:${port}/allotment_v2.html`);
await page.waitForFunction(() => typeof window.nav === 'function'
  && document.querySelectorAll('.nav-item[data-view]').length > 0, null, { timeout:25000 });
await page.waitForTimeout(1200);

/* ชั้น sync ต้องตื่นจริง ไม่ใช่ bail แบบ dev ที่ไม่มี backend */
const wired = await page.evaluate(() => ({
  sse: !!window.__laSSE,
  soft: typeof window._laSoftRefresh === 'function'
}));
if (!wired.soft) fail('ชั้น sync ไม่ทำงานในเทส · ที่เหลือวัดอะไรไม่ได้');
else ok('ชั้น sync ตื่นแล้ว' + (wired.sse ? ' · SSE ต่อแล้ว' : ' · ยังไม่มี SSE') + ' · โหลดไปแล้ว ' + S.loads + ' ครั้ง');

await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="piercheckin"]'); if (el) nav(el); });
await page.waitForTimeout(900);
const onPage = await page.evaluate(() => {
  const a = document.querySelector('.nav-item.active');
  return a && a.dataset ? a.dataset.view : '';
});
if (onPage !== 'piercheckin') fail('เปิดหน้าเช็คอินหน้าท่าไม่ได้ · อยู่ที่ ' + onPage);
else ok('อยู่บนหน้าเช็คอินหน้าท่า');

/* "ไคลเอนต์รู้ตัวแล้ว" วัดจากฝั่งเซิร์ฟเวอร์ · มันจะมาดึง /api/load เมื่อเห็นว่าเวอร์ชันขยับ
   VER อยู่ใน closure ของชั้น sync อ่านจากหน้าไม่ได้ และไม่ควรเปิดออกมาแค่เพื่อเทส */
async function waitLoad(limitMs){
  const base = S.loads, t0 = Date.now();
  while (Date.now() - t0 < limitMs){
    if (S.loads > base) return Date.now() - t0;
    await sleep(80);
  }
  return -1;
}

/* ══ 1 · SSE เงียบสนิท · ต้องยังเห็นภายใน ~2 วิ ═══════════════════════════ */
await page.evaluate(() => { try{ if(window.__laSSE) window.__laSSE.close(); window.__laSSE=null; }catch(_){} });
S.sse.forEach(r => { try{ r.end(); }catch(_){} }); S.sse.clear();
S.sseRefuse = true;                       /* ต่อใหม่ไม่ได้ · จำลอง session สะดุดแล้วตายถาวร */
await sleep(300);
bump();                                   /* เครื่อง A เซฟ · ไม่ push ให้เลย */
const t1 = await waitLoad(4000);
if (t1 < 0) fail('SSE เงียบ · หน้าเช็คอินไม่เห็นของใหม่เลยใน 4 วิ');
else if (t1 > 2600) fail('SSE เงียบ · เห็นของใหม่ช้า ' + t1 + 'ms (ควร ≤ ~2 วิ)');
else ok('SSE เงียบสนิท · หน้าเช็คอินยังเห็นของใหม่ใน ' + t1 + 'ms');

/* ══ 2 · SSE ใช้ได้ · ต้องเร็วกว่าคาบ poll ════════════════════════════════ */
S.sseRefuse = false;
await page.evaluate(() => { window.dispatchEvent(new Event('online')); });   /* ทางที่ผู้ใช้เจอจริง · เน็ตกลับมา */
await sleep(900);
const hadSSE = S.sse.size > 0;
if (!hadSSE) fail('ต่อ SSE ใหม่ไม่ได้ · ข้อถัดไปวัดไม่ได้');
else {
  push();
  const t2 = await waitLoad(3000);
  if (t2 < 0) fail('SSE ส่งมาแล้วแต่หน้าไม่ขยับ');
  else if (t2 > 1500) fail('SSE ส่งมาแล้วยังช้า ' + t2 + 'ms');
  else ok('SSE ส่งมา · เห็นใน ' + t2 + 'ms');
}

/* == 3a . กลับมาดูจอ ต้องต่อ SSE ใหม่ทันที =============================
   §ckLive2 . แยกจาก 3b โดยตั้งใจ . รวมเป็นข้อเดียวเมื่อไร
   ทางหนึ่งพังอีกทางจะคลุมให้ แล้วเทสผ่านทั้งที่เหลือทางเดียว */
async function killSSE(){
  S.sse.forEach(r => { try{ r.end(); }catch(_){} }); S.sse.clear();
  await page.evaluate(() => { try{ if(window.__laSSE) window.__laSSE.close(); }catch(_){} });
  await sleep(200);
}
async function waitOpen(from, limitMs){
  const t0 = Date.now();
  while (Date.now() - t0 < limitMs){ if (S.sseOpens > from) return Date.now() - t0; await sleep(120); }
  return -1;
}
let opens0 = S.sseOpens;
await killSSE();
await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
const r3a = await waitOpen(opens0, 2500);
if (r3a < 0) fail('กลับมาดูจอแล้วไม่ต่อ SSE ใหม่');
else ok('กลับมาดูจอ . ต่อ SSE ใหม่ใน ' + r3a + 'ms');

/* == 3b . ไม่มีใครแตะอะไรเลย ตัวเฝ้าต้องปลุกเอง ===================== */
opens0 = S.sseOpens;
await killSSE();
const r3b = await waitOpen(opens0, 18000);
if (r3b < 0) fail('SSE ตายเงียบ ๆ แล้วไม่มีตัวเฝ้าปลุก . จะช้าไปทั้งกะ');
else ok('ไม่มีใครแตะอะไร . ตัวเฝ้าปลุก SSE เองใน ' + Math.round(r3b/1000) + ' วิ');

/* == 4 . มือยังอยู่บนจอ ก็ต้องอัพเดท ====================================
   ตัด SSE ทิ้งตลอดข้อนี้ จะได้วัดทางสำรองจริง ๆ ไม่ใช่บังเอิญที่ SSE บังเอิญต่อกลับมาเอง */
S.sseRefuse = true;
await killSSE();
const stir = setInterval(() => {
  page.evaluate(() => {
    document.dispatchEvent(new WheelEvent('wheel', { bubbles:true, deltaY:60 }));
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles:true }));
  }).catch(() => {});
}, 200);
bump();
const t4 = await waitLoad(6000);
clearInterval(stir);
S.sseRefuse = false;
if (t4 < 0) fail('มือยังอยู่บนจอ . ของใหม่ไม่เข้าเลยใน 6 วิ (อาการที่ผู้ใช้เจอ)');
else if (t4 > 3400) fail('มือยังอยู่บนจอ . ของใหม่เข้าช้า ' + t4 + 'ms (SSE ตาย + แตะจอรัว = กรณีแย่สุด ~3.2 วิ)');
else ok('SSE ตาย + เลื่อนจอและแตะจอรัว ๆ . ของใหม่ยังเข้าใน ' + t4 + 'ms');

/* ══ 5 · ลิ้นชักเปิดค้าง ห้ามโดนวาดทับ ═══════════════════════════════════ */
await page.evaluate(() => {
  const d = document.createElement('div'); d.id = 'pck-drawer';
  d.innerHTML = '<textarea id="pck-note-tx">พิมพ์ค้างไว้</textarea>';
  document.body.appendChild(d);
});
const loads0 = S.loads;
bump();
await sleep(3000);
const kept = await page.evaluate(() => {
  const d = document.getElementById('pck-drawer');
  const t = document.getElementById('pck-note-tx');
  return { open: !!d, text: t ? t.value : '' };
});
if (!kept.open || kept.text !== 'พิมพ์ค้างไว้') fail('ลิ้นชักเปิดค้างอยู่แต่โดนวาดทับ · ของที่พิมพ์หาย');
else if (S.loads > loads0) fail('ลิ้นชักเปิดอยู่แต่ยังดึงข้อมูลมาทับ ' + (S.loads - loads0) + ' ครั้ง');
else ok('ลิ้นชักเปิดค้าง · ไม่ถูกวาดทับ และยังไม่ดึงข้อมูลมาทับ');
await page.evaluate(() => { const d = document.getElementById('pck-drawer'); if (d) d.remove(); });
const t5 = await waitLoad(5000);          /* ปิดลิ้นชักแล้วต้องตามทันเอง ไม่ใช่ค้างตลอดไป */
if (t5 < 0) fail('ปิดลิ้นชักแล้วยังไม่ยอมตามข้อมูล');
else ok('ปิดลิ้นชักแล้วตามข้อมูลเองใน ' + t5 + 'ms');

/* ══ 6 · ออกจากหน้านี้แล้วต้องเลิกถามถี่ ═════════════════════════════════ */
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="booking"]')
  || document.querySelector('.nav-item[data-view="dashboard"]'); if (el) nav(el); });
await sleep(900);
const h0 = S.verHits;
await sleep(8000);
const hits = S.verHits - h0;
if (hits > 2) fail('ออกจากหน้าเช็คอินแล้วยังถามถี่ · ' + hits + ' ครั้งใน 8 วิ (คาบปกติ 10 วิ ควรได้ไม่เกิน 1)');
else ok('ออกจากหน้าเช็คอินแล้วกลับไปถามตามคาบปกติ · ' + hits + ' ครั้งใน 8 วิ');

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
