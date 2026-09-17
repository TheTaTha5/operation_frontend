// §dayDetail · ป๊อปอัป "รายละเอียดทั้งวัน" ของการ์ด Live bookings
//
// วัดสามอย่างที่พังเงียบได้:
//  1. ตัวเลขในป๊อปอัปต้องมาจากกฎเดียวกับที่การ์ดใช้ (laIsB2C + _dashBkDay)
//     ถ้าใครไปเขียนเกณฑ์ใหม่ในป๊อปอัป สองที่จะขึ้นคนละเลขโดยไม่มีใครรู้
//  2. รายการต้องมี "ทุกใบของวัน" ไม่ใช่ 12 ใบล่าสุดเหมือนฟีดข้างนอก
//  3. เลื่อนวันในป๊อปอัปแล้ว หน้า Dashboard ข้างหลังต้องขยับตาม (_dashDate ตัวเดียวกัน)
//
// รันด้วยข้อมูลจริง:
//   LAD=allotment_v2/data_exports/subset_daydetail.json node test/ui/t_daydetail.mjs 2026-09-17
import { open, goView } from './_harness.mjs';

const DAY = process.argv[2] || null;
const { page, errors, close } = await open();
let bad = 0;
const fail = (m) => { console.log('  ✗ ' + m); bad++; };
const ok   = (m) => console.log('  ✓ ' + m);

try {
  await goView(page, 'dashboard', 700);
  if (DAY) {
    await page.evaluate(d => setDashDate(d), DAY);
    await page.waitForTimeout(600);
  }
  const day = await page.evaluate(() => window._dashDate || TODAY_STR);
  console.log('วันที่ตรวจ ' + day);

  // ค่าที่ควรจะเป็น · คิดจาก SB_BOOKINGS ตรง ๆ ในหน้าเดียวกัน ด้วยตัวอ่านชุดเดียวกับการ์ด
  const want = await page.evaluate(() => {
    const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
    const out = { b2c: { n: 0, pax: 0, val: 0 }, b2b: { n: 0, pax: 0, val: 0 }, cxl: 0, all: 0 };
    SB_BOOKINGS.forEach(b => {
      if (b.schemaVer !== 2) return;
      if (_dashBkDay(b) !== (window._dashDate || TODAY_STR)) return;
      out.all++;
      if (CXL.indexOf(b.status) >= 0) { out.cxl++; return; }
      const s = out[laIsB2C(b) ? 'b2c' : 'b2b'];
      s.n++;
      (b.trips || []).forEach(t => { s.pax += bkV2PaxAllTot(t.pax || {}); });
      s.val += (+acctBookingTotal(b) || 0);
    });
    return out;
  });
  console.log('ควรได้ · B2C ' + want.b2c.n + ' ใบ/' + want.b2c.pax + ' pax  ·  B2B '
    + want.b2b.n + ' ใบ/' + want.b2b.pax + ' pax  ·  ยกเลิก ' + want.cxl);

  // เปิดจากปุ่มจริงบนการ์ด ไม่ใช่เรียกฟังก์ชันตรง ๆ — ต้องทดสอบทางที่ผู้ใช้เดิน
  const btns = await page.$$('.dv-ddbt');
  if (btns.length !== 2) fail('ปุ่ม "รายละเอียดทั้งวัน" ควรมี 2 ปุ่ม (B2C + B2B) · ได้ ' + btns.length);
  else ok('ปุ่มขึ้นบนการ์ดทั้งสองใบ');
  if (!btns.length) throw new Error('ไม่มีปุ่มให้กด');

  await btns[0].click();
  await page.waitForTimeout(450);
  if (!(await page.$('#dv-ddov'))) fail('กดแล้วป๊อปอัปไม่ขึ้น'); else ok('ป๊อปอัปเปิดได้');

  // อ่านค่าที่ป๊อปอัปแสดงจริง ทั้งสองการ์ด — สองใบต้องอยู่บนจอพร้อมกัน นั่นคือทั้งหมดของ "แยก B2C/B2B"
  const got = await page.evaluate(() => {
    const read = side => {
      const c = document.querySelector('.dv-ddsum[data-side="' + side + '"]');
      if (!c) return null;
      const b = [...c.querySelectorAll('.dv-ddsv .s b')].map(x => x.textContent.trim());
      return { n: +b[0], pax: +b[1], money: b[2], avg: b[3], last: b[4] };
    };
    return { b2c: read('b2c'), b2b: read('b2b'),
      rows: document.querySelectorAll('.dv-ddrow').length,
      side: document.querySelector('.dv-ddsum.on')?.dataset.side || '' };
  });
  if (!got.b2c || !got.b2b) fail('การ์ดสรุปไม่ครบสองใบ');
  else {
    ok('การ์ดสรุปสองใบอยู่บนจอพร้อมกัน');
    ['b2c', 'b2b'].forEach(s => {
      if (got[s].n !== want[s].n) fail(s + ' · จำนวนใบ ได้ ' + got[s].n + ' ควรเป็น ' + want[s].n);
      else if (got[s].pax !== want[s].pax) fail(s + ' · pax ได้ ' + got[s].pax + ' ควรเป็น ' + want[s].pax);
      else ok(s + ' · ' + got[s].n + ' ใบ · ' + got[s].pax + ' pax · ' + got[s].money + ' ตรงกับ SB_BOOKINGS');
    });
  }

  // รายการ = ทุกใบของฝั่งที่เลือก รวมใบยกเลิก · ฟีดข้างนอกตัดที่ 12 ใบ ตัวนี้ต้องไม่ตัด
  // ต้องตรวจทั้งสองฝั่ง · ฝั่งที่เปิดมาก่อนอาจมีไม่ถึง 12 ใบ แล้วการตัดจะรอดสายตาไป
  const rowsOf = sd => page.evaluate(x => SB_BOOKINGS.filter(b => b.schemaVer === 2
      && _dashBkDay(b) === (window._dashDate || TODAY_STR)
      && (laIsB2C(b) ? 'b2c' : 'b2b') === x).length, sd);
  let checkedBig = false;
  for (const sd of ['b2c', 'b2b']) {
    await page.click('.dv-ddsum[data-side="' + sd + '"]');
    await page.waitForTimeout(280);
    const nowSide = await page.evaluate(() => document.querySelector('.dv-ddsum.on')?.dataset.side);
    if (nowSide !== sd) { fail('กดการ์ด ' + sd + ' แล้วไม่สลับฝั่ง · ได้ ' + nowSide); continue; }
    const shown = await page.evaluate(() => document.querySelectorAll('.dv-ddrow').length);
    const wantRows = await rowsOf(sd);
    if (shown !== wantRows) fail(sd + ' · รายการได้ ' + shown + ' แถว ควรเป็น ' + wantRows);
    else ok(sd + ' · รายการครบทุกใบของวัน · ' + shown + ' แถว');
    if (wantRows > 12) { checkedBig = true;
      if (shown <= 12) fail(sd + ' · รายการยังถูกตัดที่ 12 ใบเหมือนฟีดข้างนอก'); }
  }
  if (!checkedBig) console.log('  ! วันนี้ไม่มีฝั่งไหนเกิน 12 ใบ · ยังไม่ได้พิสูจน์ว่าไม่ถูกตัดที่ 12');

  // เลื่อนวัน · _dashDate ตัวเดียวกับแถบหัว ปิดป๊อปอัปแล้วหน้าหลังต้องอยู่วันเดียวกัน
  const before = await page.evaluate(() => window._dashDate);
  await page.click('#dv-ddhd .dv-arw');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window._dashDate);
  const headDay = await page.evaluate(() => (document.querySelector('.dv-hd .dv-dnum') || {}).textContent);
  if (after === before) fail('กด ‹ แล้ววันไม่ขยับ');
  else if (String(+headDay) !== String(+after.slice(8))) fail('แถบหัวหน้า Dashboard ไม่ตามวันของป๊อปอัป · หัว ' + headDay + ' ป๊อปอัป ' + after);
  else ok('เลื่อนวันแล้วหน้าข้างหลังตามด้วย · ' + before + ' → ' + after);

  // ปิดด้วย Esc
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if (await page.$('#dv-ddov')) fail('Esc แล้วไม่ปิด'); else ok('Esc ปิดได้');

  if (errors.length) { errors.forEach(e => fail('error: ' + e)); }
  else ok('ไม่มี console error');
} finally { await close(); }

console.log('\nพัง ' + bad);
process.exit(bad ? 1 : 0);
