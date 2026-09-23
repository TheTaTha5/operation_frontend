// contracts.js · Contracts · contract templates · costing & boat rent
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.


// ── Contract helper functions ──
function _ctTodayISO(){ return new Date().toISOString().slice(0,10); }
function _ctMockToday(){ return (typeof TODAY_STR!=='undefined' && TODAY_STR) ? TODAY_STR : fmt(new Date()); } // §ใช้วันจริง · เดิม hardcode '2026-09-02' ตอน demo → ทำให้ "เหลือกี่วัน" ในแบนเนอร์สัญญาเพี้ยน
function ctDaysUntilExpiry(a){
  if(!a?.contractEnd) return null;
  const today = new Date(_ctMockToday());
  const end = new Date(a.contractEnd);
  const diff = Math.ceil((end - today) / (1000*60*60*24));
  return diff;
}
function ctIsExpiringSoon(a, daysThreshold=60){   // §2026-07-24: widened 30→60 so the renewal warning + button surface earlier
  const d = ctDaysUntilExpiry(a);
  return d !== null && d >= 0 && d <= daysThreshold;
}
function ctIsExpired(a){
  const d = ctDaysUntilExpiry(a);
  return d !== null && d < 0;
}
function ctCountExpiringAgents(){
  return SB_AGENTS.filter(a=>ctIsExpiringSoon(a) || ctIsExpired(a)).length;
}
function ctFmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso); if(isNaN(d)) return iso;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
// ════════════════════════════════════════════════════════════════════════════════════════════════
// §costing (2026-08-02) · ต้นทุน & จุดคุ้มทุน — เมนูของตัวเองใต้ Accounting & Finance
//
//   นี่คือเครื่องมือ "ออกแบบเส้นทาง" ไม่ใช่รายงานของทริปที่เกิดขึ้นแล้ว — จึงไม่ผูกกับบุคกิ้ง
//   ใช้ตอบว่า "เส้นทางนี้ ตั้งราคาเท่านี้ ต้องได้กี่คนถึงคุ้ม" ก่อนจะเปิดขายจริง
//   แผนที่สร้างไว้เก็บเป็น Template ผูกกับเส้นทางได้ เพื่อเอาไปใช้กับการออกเรือในอนาคต
//
//   โครง 3 ชั้น
//     ชั้น 1 สูตรกลาง (cost_template) · รายการต้นทุนทั้งหมด + ค่าเริ่มต้น + ติ๊กขอคืน VAT
//     ชั้น 2 แผนคำนวณ (cost_plans)    · ผู้ใช้สร้างเองกี่แผนก็ได้ · แต่ละแผนเก็บพารามิเตอร์ของตัวเอง
//                                        (เรือ/เครื่อง/ความจุ/ราคา/คอม/ราคาน้ำมัน) + override รายบรรทัด
//     ชั้น 3 (อนาคต) ผูกแผนกับการออกเรือจริง แล้วเทียบแผน vs จริง
//
//   1 บรรทัด = หลายส่วนประกอบ เพราะของจริงบรรทัดเดียวเป็นได้ทั้งคงที่และผันแปร
//     fix  · คงที่ต่อลำ/ต่อทริป · var · ผันแปรต่อคน (แยกไทย/ต่างชาติ) · step · ขั้นบันได
//   การมี step แปลว่าสูตร fixed/(price−var) ใช้ไม่ได้ → จุดคุ้มทุนไล่ทีละคน 1..ความจุ
//
//   VAT ตามหลักบัญชี: ภาษีขาย − ภาษีซื้อที่ขอคืนได้ = ที่ต้องนำส่ง
//   ที่เก็บ: laBlob() เป็น JSON string เหมือน pck_svc_colors → ไม่ต้องเพิ่มคอลัมน์ DB
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── ที่เก็บ · JSON string ใน blob ────────────────────────────────────────────────────────────────
function ctRead(k){
  var v; try{ v = laBlob()[k]; }catch(_){ return null; }
  if(typeof v === 'string'){ try{ v = JSON.parse(v); }catch(_){ v = null; } }
  return v;
}
function ctWrite(k, val){ try{ var d = laBlob(); d[k] = JSON.stringify(val); laBlobSave(); }catch(e){ console.warn('[costing] save failed', e); } }
function ctTpl(){
  var t = ctRead('cost_template');
  if(t && Array.isArray(t.lines) && t.lines.length) return ctTplFill(t);
  return JSON.parse(JSON.stringify(CT_DEFAULT));
}
function ctTplOdSeed(t){
  var n = 0;
  (t.lines || []).forEach(function(ln){
    if(!(ln.id in CT_OD_SEED)) return;
    var ch = false;
    if(!ln.od){ ln.od = 1; ch = true; }
    if(ln.odQ == null){ ln.odQ = CT_OD_SEED[ln.id]; ch = true; }
    if(ch) n++;
  });
  return n;
}
function ctTplFill(t){
  var have = {}, dropped = {};
  (t.lines || []).forEach(function(l){ have[l.id] = 1; });
  (t.dropped || []).forEach(function(id){ dropped[id] = 1; });
  var added = 0;
  CT_DEFAULT.lines.forEach(function(d){
    if(have[d.id] || dropped[d.id]) return;
    t.lines.push(JSON.parse(JSON.stringify(d))); added++;
  });
  if(ctTplOdSeed(t)) added++;
  if(added) ctTplSave(t);
  return t;
}
function ctTplSave(t){ ctWrite('cost_template', t); }
function ctVatR(t){ var r = +((t || ctTpl()).vatRate); if(!(r > 0)) r = 0; return r / (100 + r); }
// ── หมวดหมู่ ────────────────────────────────────────────────────────────────────────────────────
// ลำดับหมวดยึดตามลำดับที่โผล่ครั้งแรกในสูตร · ย้ายบรรทัดข้ามหมวดแล้วตารางจัดกลุ่มให้เองทันที
function ctGroups(T){
  var out = [], seen = {};
  ((T || ctTpl()).lines || []).forEach(function(l){ var g = l.g || 'อื่นๆ'; if(!seen[g]){ seen[g] = 1; out.push(g); } });
  return out;
}
// บรรทัดทั้งหมดเรียงตามหมวด · ทุกที่ที่วนบรรทัดใช้ตัวนี้ จะได้ลำดับตรงกันเสมอ
function ctLinesByGroup(T){
  var t = T || ctTpl(), out = [];
  ctGroups(t).forEach(function(g){ (t.lines || []).forEach(function(l, i){ if((l.g || 'อื่นๆ') === g) out.push({ ln:l, i:i }); }); });
  return out;
}
// ตั้งค่าระดับหมวดของแต่ละแผน · pl.grp[หมวด] = {off:1, pct:±%}
//   off = ตัดทั้งหมวดออกจากแผนนี้ · pct = คูณทุกบรรทัดในหมวด (เช่น เส้นทางนี้ค่าอาหารแพงกว่า 20%)
function ctGrpCfg(pl, g){ return ((pl && pl.grp) || {})[g] || {}; }
function ctGrpMul(pl, g){ var c = ctGrpCfg(pl, g); return 1 + ((+c.pct || 0) / 100); }

// ── แผนคำนวณ · ผู้ใช้สร้างเองกี่แผนก็ได้ ─────────────────────────────────────────────────────────
function ctNewId(){ return 'p' + Math.random().toString(36).slice(2, 8); }
function ctBlankPlan(name){
  return { id:ctNewId(), name:name || 'แผนใหม่', famId:'', note:'',
           eng:'3EN', boats:1, cap:65, pax:20, paxTH:0, price:2500, priceCh:'', chPct:0, comm:0, fuel:45, ovr:{} };
}
function ctPlans(){
  var p = ctRead('cost_plans');
  if(Array.isArray(p) && p.length) return p;
  // ครั้งแรก · สร้างแผนเริ่มต้น 1 แผน · ถ้าเคยตั้ง override รายเส้นทางไว้ (โครงเก่า) ย้ายเข้ามาให้
  var old = ctRead('cost_overrides'), out = [];
  if(old && typeof old === 'object' && Object.keys(old).length){
    Object.keys(old).forEach(function(fam){
      var f = (typeof ctFamName === 'function') ? ctFamName(fam) : fam;
      var q = ctBlankPlan(f); q.famId = fam; q.ovr = old[fam] || {}; out.push(q);
    });
  }
  if(!out.length) out = [ctBlankPlan('เส้นทางที่ 1')];
  ctPlansSave(out);
  return out;
}
function ctPlansSave(p){ ctWrite('cost_plans', p); }
function ctRentBlank(){
  return { on:1, mode:'lump', amt:0, seat:0, days:30, off:2, trips:1, vat:0, note:'',
           from:'', to:'',                    /* §rentSpan · ช่วงสัญญา · ว่าง = ไม่จำกัด */
           fuelMul:100,                       /* §boatFuel · % เทียบสูตรกลาง · 100 = เท่ากัน */
           ex:{ dep:1, cap:1, crew:1 } };
}
function _ctRentKey(){ return _ctRentWr + '|' + (window.__savedAt || 0); }
function ctRentBust(){ _ctRentC = null; _ctRentOfC = {}; }
function ctRentAll(){
  var k = _ctRentKey();
  if(_ctRentC && _ctRentCK === k) return _ctRentC;
  var r = ctRead('boat_rent');
  _ctRentC = (r && typeof r === 'object' && !Array.isArray(r)) ? r : {};
  _ctRentCK = k; _ctRentOfC = {};
  return _ctRentC;
}
function ctRentAllSave(all){ _ctRentWr++; ctRentBust(); ctWrite('boat_rent', all); }
function ctRentRaw(boatId){ return (boatId ? ctRentAll()[boatId] : null) || null; }
/* คืน null ถ้าลำนี้ไม่ใช่เรือเช่า · ที่เหลือคือตัวเลขที่หารเสร็จแล้ว ไม่ต้องให้ใครมาหารเอง */
function ctRentOf(boatId){
  if(!boatId) return null;
  ctRentAll();                       /* §ctRentCache · ให้แคชอัปเดต/ล้างก่อนอ่านตัวที่จำไว้ */
  if(boatId in _ctRentOfC) return _ctRentOfC[boatId];
  return (_ctRentOfC[boatId] = _ctRentOfCalc(boatId));
}
function _ctRentOfCalc(boatId){
  var R = ctRentRaw(boatId);
  if(!R || !R.on) return null;
  var b = (typeof getBoat === 'function') ? (getBoat(boatId) || {}) : {};
  var seats = Math.max(0, +b.cap || 0);          /* §boatRent · ที่นั่งมาจากทะเบียนเรือลำนั้น ไม่ใช่พิมพ์เอง */
  var amt   = (R.mode === 'seat') ? (+R.seat || 0) * seats : (+R.amt || 0);
  var days  = Math.max(1, +R.days || 30);
  var off   = Math.min(days - 1, Math.max(0, +R.off || 0));
  var runD  = days - off;
  var trips = Math.max(1, +R.trips || 1);
  var perDay = amt / runD;
  return { boatId:boatId, name:b.name || boatId, seats:seats, mode:R.mode || 'lump',
           amt:amt, seat:+R.seat || 0, days:days, off:off, runDays:runD, trips:trips,
           perDay:perDay, perTrip:perDay / trips, perCalDay:amt / days, vat:!!R.vat,
           from:R.from || '', to:R.to || '',              /* §rentSpan */
           ex:R.ex || { dep:1, cap:1, crew:1 }, note:R.note || '' };
}
/* ══ §boatFuel · ลำไหนกินน้ำมันเท่าไหร่ ═══════════════════════════════════════════════════════
   สูตรกลางตั้งลิตร/ทริปไว้ชุดเดียว (3EN 360 · 4EN 520) ซึ่งจูนมาจากเรือของบริษัท
   เรือเช่าคนละตัวถัง คนละเครื่อง — กินไม่เท่ากันแน่นอน และเรือเราเองแต่ละลำก็ไม่เท่ากัน
   เก็บเป็น "%" ไม่ใช่ "ลิตร" เพราะตัวคูณนี้ผูกกับ "ลำ" แต่ลิตรต่อทริปขึ้นกับ "เส้นทาง"
     (สิมิลันไกลกว่าพีพีเยอะ) ลำเดียวกันวิ่งสองเส้นทางจะได้ลิตรคนละเลข แต่ % เท่าเดิม
   รู้ลิตรจริงของเส้นทางไหนแน่ ๆ → ไปตั้งที่แท็บ "ปรับ / ปิด รายแผน" ซึ่งเป็นรายเส้นทางอยู่แล้ว
     สองอันนี้คูณกันได้: ลิตรจากแผน (หรือสูตรกลาง) x % ของลำ
   ⚠ ใช้ได้แม้ลำนั้นไม่ใช่เรือเช่า · ความกินน้ำมันไม่ได้ขึ้นกับว่าใครเป็นเจ้าของ
     จึงไม่อ่านผ่าน ctRentOf() ที่คืน null เมื่อปิดสวิตช์เช่า
   ⚠ มีผลกับ "ค่าประมาณ" เท่านั้น · P&L ที่ลงลิตรจริงจากใบงานเรือแล้วจะทับทั้งบรรทัดอยู่ดี */
function ctBoatFuelMul(boatId){
  var R = ctRentRaw(boatId);
  var m = R ? +R.fuelMul : NaN;
  if(!(m > 0)) return 1;
  return m / 100;
}
function ctRentSet(boatId, k, v){
  if(!boatId) return;
  var all = ctRentAll(), R = all[boatId] || ctRentBlank();
  if(k.indexOf('ex.') === 0){ R.ex = R.ex || {}; R.ex[k.slice(3)] = v ? 1 : 0; }
  else if(k === 'mode' || k === 'note' || k === 'from' || k === 'to') R[k] = v;   /* §rentSpan */
  else if(k === 'on' || k === 'vat') R[k] = v ? 1 : 0;
  else R[k] = (v === '') ? 0 : (+v || 0);
  all[boatId] = R; ctRentAllSave(all); ctRender();
}
/* ══ §rentSpan · ช่วงสัญญา ══════════════════════════════════════════════════
   สัญญาเช่ามีวันเริ่มวันจบ · เรือลำเดิมก่อนเริ่มสัญญาหรือหลังจบสัญญา
   ต้องกลับไปเป็นเรือปกติทันที (มีกัปตัน มีค่าเสื่อม ไม่มีค่าเช่า)
   ไม่งั้นย้อนดู P&L เดือนก่อนหน้าจะเห็นค่าเช่าที่ยังไม่ได้เริ่มจ่าย
   ว่างทั้งคู่ = ไม่จำกัด · ใช้กับสัญญาที่ยังไม่รู้วันจบ */
function ctRentActiveOn(RN, ymd){
  if(!RN) return false;
  if(!ymd) return true;                       /* หน้าแผนคำนวณไม่มีวันที่ · เป็นเครื่องมือออกแบบ */
  if(RN.from && ymd < RN.from) return false;
  if(RN.to   && ymd > RN.to)   return false;
  return true;
}
function ctYmdAdd(ymd, n){
  var d = new Date(String(ymd) + 'T12:00:00'); d.setDate(d.getDate() + n);
  return (typeof bkV2LocalYMD === 'function') ? bkV2LocalYMD(d) : d.toISOString().slice(0, 10);
}
function ctYmdDiff(a, b){                     /* จำนวนวันแบบนับหัวนับหาง */
  return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000) + 1;
}
/* สัญญาทับกับหน้าต่างรายงาน (d0..d1) กี่วัน และคิดเป็นค่าเช่าเท่าไหร่
   ค่าเช่าต่อวันตามปฏิทิน = ค่าเช่า ÷ วันในงวด · ต่างจากค่าเช่าต่อ "วันวิ่ง" ที่หารด้วยวันที่วิ่งจริง
   ตัวแรกใช้ตอบว่า "งวดนี้ต้องจ่ายเท่าไหร่" · ตัวหลังใช้ตอบว่า "ทริปนึงแบกเท่าไหร่" */
function ctRentSpan(RN, d0, d1){
  if(!RN || !(RN.amt > 0) || !d0 || !d1) return null;
  var s = (RN.from && RN.from > d0) ? RN.from : d0;
  var e = (RN.to   && RN.to   < d1) ? RN.to   : d1;
  if(s > e) return null;
  var n = ctYmdDiff(s, e);
  return { from:s, to:e, calDays:n, perCalDay:RN.perCalDay,
           due:RN.perCalDay * n, opDays:n * (RN.runDays / RN.days) };
}
/* §ctFactLong · ไล่เดือนปฏิทินที่สัญญาพาดผ่าน · ['2026-10','2026-11',...]
   คิดเป็นเดือนปฏิทินไม่ใช่ "ทุก 30 วัน" เพราะคนวางแผนคิดเป็นเดือน
   และเดือนแรก/เดือนสุดท้ายมักไม่เต็มเดือน ต้องคิดตามวันที่ครอบคลุมจริง */
function ctMonthsIn(a, b){
  var out = [], y = +String(a).slice(0, 4), m = +String(a).slice(5, 7);
  var ey = +String(b).slice(0, 4), em = +String(b).slice(5, 7);
  if(!y || !m || !ey || !em) return out;
  var guard = 0;
  while((y < ey || (y === ey && m <= em)) && guard++ < 120){
    out.push(y + '-' + String(m).padStart(2, '0'));
    m++; if(m > 12){ m = 1; y++; }
  }
  return out;
}
function ctMonthEdges(ym){
  var y = +String(ym).slice(0, 4), m = +String(ym).slice(5, 7);
  var last = new Date(y, m, 0).getDate();
  return { a:ym + '-01', b:ym + '-' + String(last).padStart(2, '0'), days:last };
}
function ctSeasonOf(ym){
  var m = +String(ym).slice(5, 7);
  return (CT_SEASON_HI.indexOf(m) >= 0) ? 'hi' : 'lo';
}
function ctMonLabel(ym){
  var y = +String(ym).slice(0, 4), m = +String(ym).slice(5, 7);
  return (CT_MON_TH[m - 1] || ym) + ' ' + String(y + 543).slice(2);
}
/* ค่าเช่าที่ "ลงไปแล้ว" เทียบกับที่ "ต้องจ่ายจริง" · ส่วนต่าง = ค่าเช่าวันที่เรือไม่ได้วิ่ง
   due ว่าง = คิดเต็มหนึ่งงวด · ส่งมาเมื่อรายงานครอบคลุมไม่เต็มงวด (ต้นเดือน · สัญญาเริ่มกลางเดือน) */
function ctRentIdle(RN, tripsRan, due){
  if(!RN) return null;
  var t = Math.max(0, +tripsRan || 0), booked = RN.perTrip * t;
  var full = (due != null) ? +due : RN.amt;
  return { trips:t, booked:booked, full:full, gap:Math.max(0, full - booked),
           daysRan:t / RN.trips, daysPlan:RN.runDays };
}
/* §boatRent · ความจุ/ลำ · ปักเรือไว้แล้วต้องอิงที่นั่งของลำนั้น จะได้ไม่หลุดจากทะเบียนจริง */
function ctPlanSeats(pl){
  var b = (pl && pl.boatId && typeof getBoat === 'function') ? getBoat(pl.boatId) : null;
  if(b && +b.cap > 0) return +b.cap;
  return Math.max(1, +((pl && pl.cap)) || 65);
}
function ctPlan(id){ var P = ctPlans(); return P.filter(function(x){ return x.id === id; })[0] || P[0]; }
function ctPlanPut(pl){
  var P = ctPlans(), i = -1;
  P.forEach(function(x, k){ if(x.id === pl.id) i = k; });
  if(i >= 0) P[i] = pl; else P.push(pl);
  ctPlansSave(P);
}
// เส้นทางในระบบ · ใช้ผูกแผนกับเส้นทางจริงเพื่อเอาไปใช้ในอนาคต (ไม่บังคับ)
function ctFamList(){
  var out = [], seen = {};
  (typeof ROUTES !== 'undefined' ? ROUTES : []).forEach(function(r){
    var f = (typeof bkV2RouteFamily === 'function') ? bkV2RouteFamily(r.id) : null;
    var id = (f && f.id) || r.id, nm = (f && f.name) || r.name || r.id;
    if(!seen[id]){ seen[id] = 1; out.push({ id:id, name:nm }); }
  });
  return out;
}
function ctFamName(id){ var f = ctFamList().filter(function(x){ return x.id === id; })[0]; return f ? f.name : id; }

// ── รวมสูตรกลาง + override ของแผน ───────────────────────────────────────────────────────────────
function ctEffLine(line, pl){
  var o = ((pl && pl.ovr) || {})[line.id] || {};
  var L = { id:line.id, g:line.g, l:line.l, vat:line.vat, off:!!o.off, parts:[] };
  (line.parts || []).forEach(function(p, i){
    var q = {}, ov = (o.p || [])[i];
    Object.keys(p).forEach(function(k){ q[k] = p[k]; });
    if(ov) Object.keys(ov).forEach(function(k){ if(ov[k] !== '' && ov[k] != null) q[k] = ov[k]; });
    L.parts.push(q);
  });
  return L;
}
// ctx = {eng, boats, fuel(฿/L), pax, paxTH, paxFR}
/* §ctChd · แตกหัวเป็น 4 ช่อง · เด็กกระจายตามสัดส่วนสัญชาติของทั้งลำ
   ไม่มีทางรู้ว่าเด็กที่มาเป็นไทยกี่คน ถ้าไม่ได้กรอกแยก · เฉลี่ยตามสัดส่วนคือคำตอบที่ผิดน้อยที่สุด */
function ctPaxSplit(ctx){
  var pax = Math.max(0, +ctx.pax || 0);
  var th  = Math.min(Math.max(0, +ctx.paxTH || 0), pax);
  var ch  = Math.min(Math.max(0, +ctx.paxCh || 0), pax);
  var chTH = (ctx.paxChTH != null) ? Math.min(Math.max(0, +ctx.paxChTH || 0), Math.min(ch, th))
                                   : (pax ? Math.round(ch * th / pax) : 0);
  chTH = Math.min(chTH, ch, th);
  return { adTH:Math.max(0, th - chTH), adFR:Math.max(0, pax - ch - (th - chTH)),
           chTH:chTH, chFR:Math.max(0, ch - chTH) };
}
function ctPartAmt(p, ctx){
  if(!p) return 0;
  if(p.k === 'fix'){
    var q = (ctx.eng === '4EN' && p.q4 != null) ? p.q4 : p.q;
    var u = (ctx.eng === '4EN' && p.u4 != null) ? p.u4 : p.u;
    var unit = p.fuel ? (+ctx.fuel || 0) : (+u || 0);
    return (+q || 0) * unit * (p.per === 'boat' ? (+ctx.boats || 1) : 1);
  }
  if(p.k === 'var'){
    if(p.fuel) return (+p.q || 0) * (+ctx.fuel || 0) * (+ctx.pax || 0);
    /* §ctChd · ตารางราคา 4 ช่อง · ผู้ใหญ่/เด็ก × ต่างชาติ/ไทย
       ไม่ตั้งช่องไหน = ถอยไปใช้ช่องที่กว้างกว่า · แผนเก่าที่มีแค่ u (กับ uTH) จึงได้เลขเดิมเป๊ะ */
    var u = +p.u || 0;
    var uTH   = (p.uTH   != null && p.uTH   !== '') ? (+p.uTH   || 0) : u;
    var uCh   = (p.uCh   != null && p.uCh   !== '') ? (+p.uCh   || 0) : u;
    var uChTH = (p.uChTH != null && p.uChTH !== '') ? (+p.uChTH || 0)
                : ((p.uCh != null && p.uCh !== '') ? uCh : uTH);
    var S = ctPaxSplit(ctx);
    return S.adFR * u + S.adTH * uTH + S.chFR * uCh + S.chTH * uChTH;
  }
  if(p.k === 'step'){
    var n = (p.mode === 'over')
      ? (((+ctx.pax || 0) > (+p.over || 0)) ? (+p.add || 1) : 0)
      : Math.max(+p.min || 0, Math.ceil((+ctx.pax || 0) / Math.max(1, +p.every || 1)));
    return n * (+p.u || 0);
  }
  return 0;
}
/* ══ §ctOd · บรรทัดที่ลูกค้าสั่งเพิ่ม ═══════════════════════════════════════════
   ค่าหางยาวกับค่ารถไม่ใช่ต้นทุนของทุกหัว · เป็นของที่ลูกค้าสั่งและจ่ายเงินแยก
   เดิมสูตรคูณหัวทั้งลำ · 16 ส.ค. Oceanus 35 หัว ซื้อจอยจริง 2 คน สูตรคิดเกิน 17 เท่า
   จนต้องปิดบรรทัดทิ้ง แล้ว P&L ก็เลยไม่คิดตามไปด้วย
   ของใหม่ · จำนวนมาจากที่สั่งจริง และมีฝั่งรายได้คู่กับฝั่งต้นทุน จะได้ไม่เกิดขาดทุนผี
   ═══════════════════════════════════════════════════════════════════════════════ */
/* จำนวนนับเป็น % ของหัว เมื่อหน่วยเป็น "ต่อคน" · นับเป็นจำนวนเต็มเมื่อหน่วยเป็น "ต่อลำ" */
function ctOdPct(ln){ var p = (ln && ln.parts || [])[0] || {}; return p.k === 'var'; }
/* ตั้งรายเส้นทาง · แผนหนึ่งแผนคือหนึ่งเส้นทาง ค่าพวกนี้จึงแยกตามเส้นทางอยู่แล้ว
   aQ/aR = ผ่านเอเจนต์ · uQ/uR = ขายเพิ่มหน้างาน · R คือเงินที่ "บริษัทได้" ไม่ใช่ยอดขาย
   (ค่าคอมหักอยู่ในนั้นแล้ว จึงไม่ต้องมีบรรทัดต้นทุนค่าคอมแยก) */
function ctOdCfg(pl, ln){
  var C = ((pl && pl.od) || {})[ln.id] || {};
  var dq = (ln.odQ != null) ? +ln.odQ : 0;
  return { aQ:(C.aQ != null && C.aQ !== '') ? +C.aQ : dq, aR:+C.aR || 0,
           uQ:(C.uQ != null && C.uQ !== '') ? +C.uQ : 0,  uR:+C.uR || 0 };
}
function ctOdSet(pid, lineId, k, v){
  var P = ctPlans(), pl = P.filter(function(x){ return x.id === pid; })[0]; if(!pl) return;
  pl.od = pl.od || {}; pl.od[lineId] = pl.od[lineId] || {};
  if(String(v).trim() === '') delete pl.od[lineId][k]; else pl.od[lineId][k] = +v || 0;
  ctPlansSave(P); ctRender();
}
/* จำนวนที่สั่ง · ของจริงมาก่อนเสมอ (P&L ส่งมาทาง ctx.odQty) ไม่มีค่อยใช้ตัวที่คาดไว้ */
function ctOdQty(pl, ln, ctx){
  if(ctx && ctx.odQty && ctx.odQty[ln.id] != null) return Math.max(0, +ctx.odQty[ln.id] || 0);
  var C = ctOdCfg(pl, ln), q = (+C.aQ || 0) + (+C.uQ || 0);
  return ctOdPct(ln) ? Math.round((+ctx.pax || 0) * q / 100) : q;
}
/* รายได้ของบรรทัดพวกนี้ · ใช้เฉพาะหน้าแผนคำนวณ
   P&L ไม่เรียกตัวนี้ เพราะเงินฝั่งเอเจนต์อยู่ในยอดใบจองแล้ว และฝั่งขายเพิ่มอ่านจากของจริง */
function ctOdRev(pl, tpl, ctx){
  var T = tpl || ctTpl(), r = 0;
  (T.lines || []).forEach(function(ln){
    if(!ln.od) return;
    if(ctGrpCfg(pl, ln.g || 'อื่นๆ').off) return;
    var L = ctEffLine(ln, pl); if(L.off) return;
    var C = ctOdCfg(pl, ln), pct = ctOdPct(ln), pax = +ctx.pax || 0;
    var aq = pct ? Math.round(pax * (+C.aQ || 0) / 100) : (+C.aQ || 0);
    var uq = pct ? Math.round(pax * (+C.uQ || 0) / 100) : (+C.uQ || 0);
    r += aq * (+C.aR || 0) + uq * (+C.uR || 0);
  });
  return r;
}
function ctCalc(pl, ctx, tpl){
  var T = tpl || ctTpl(), R = ctVatR(T);
  /* §boatRent · ดูจาก "ลำที่วิ่ง" ไม่ใช่จากแผน · หน้าแผนส่งลำที่ปักไว้ · P&L ส่งลำที่ออกวันนั้น
     ลำบริษัทวิ่งเส้นทางเดียวกัน = ไม่มีค่าเช่า แต่มีกัปตัน/เด็กเรือ/ค่าเสื่อม ตามปกติ */
  var RN = ctRentOf(ctx && ctx.boatId);
  /* §rentSpan · นอกช่วงสัญญาให้กลับไปเป็นเรือปกติทั้งชุด — ทั้งค่าเช่าและบรรทัดที่ตัดออก */
  if(RN && !ctRentActiveOn(RN, ctx && ctx.date)) RN = null;
  /* §boatFuel · ไม่ผ่าน RN · ตัวคูณนี้ติดกับลำ ไม่เกี่ยวว่าเช่าหรือไม่เช่า */
  var FM = ctBoatFuelMul(ctx && ctx.boatId);
  var out = { gross:0, vin:0, net:0, fixNet:0, varNet:0, rows:[], rent:RN };
  ctLinesByGroup(T).forEach(function(x){
    var ln = x.ln, g = ln.g || 'อื่นๆ';
    if(RN && RN.ex[ln.id]) return;                        // §boatRent · เจ้าของเรือรับผิดชอบ ไม่ใช่เรา
    if(ctGrpCfg(pl, g).off) return;                       // §category · ปิดทั้งหมวด
    var L = ctEffLine(ln, pl); if(L.off) return;
    var amt = 0, fx = 0, vr = 0;
    if(ln.od){
      /* §ctOd · ราคาต่อหน่วย × จำนวนที่สั่ง · ไม่เกี่ยวกับจำนวนหัวบนเรือ */
      var _q = ctOdQty(pl, ln, ctx);
      L.parts.forEach(function(p){ var a = (+p.u || 0) * _q; amt += a; vr += a; });
    } else {
      L.parts.forEach(function(p){
        var a = ctPartAmt(p, ctx);
        /* §boatFuel · จับที่ p.fuel ไม่ใช่ที่ ln.id==='fuel' · ทีมเพิ่มบรรทัดน้ำมันใหม่เมื่อไหร่
           ก็ติ๊ก fuel ที่ส่วนประกอบเหมือนกัน จะได้ไม่ต้องกลับมาแก้ชื่อ id ที่นี่อีก */
        if(p.fuel && FM !== 1) a *= FM;
        amt += a; if(p.k === 'var') vr += a; else fx += a;
      });
    }
    var m = ctGrpMul(pl, g);                              // §category · ปรับ ±% ทั้งหมวด
    if(m !== 1){ amt *= m; fx *= m; vr *= m; }
    var v = L.vat ? amt * R : 0;
    out.gross += amt; out.vin += v;
    out.fixNet += fx - (L.vat ? fx * R : 0);
    out.varNet += vr - (L.vat ? vr * R : 0);
    out.rows.push({ id:L.id, g:L.g, l:L.l, vat:L.vat, amt:amt, vatAmt:v, net:amt - v, fix:fx, varr:vr });
  });
  /* §boatRent · แถวสังเคราะห์ · ตั้งใจไม่ใส่ไว้ในสูตรกลาง
     ค่าเช่าเป็นตัวเลขตามสัญญาของเรือลำหนึ่ง ไม่ใช่ค่าที่แต่ละเส้นทางจะมาประมาณเอง
     และเท่ากันทุกเส้นทางที่ลำนี้วิ่ง · เอาไปให้ override รายแผนได้จะกลายเป็นคนละเลขกับสัญญา */
  if(RN && RN.perTrip > 0){
    var ra = RN.perTrip, rv = RN.vat ? ra * R : 0;
    out.gross += ra; out.vin += rv; out.fixNet += ra - rv;
    out.rows.push({ id:'rent', g:'ค่าเช่าเรือ', l:'ค่าเช่าเรือ · ' + RN.name,
                    vat:RN.vat, amt:ra, vatAmt:rv, net:ra - rv, fix:ra, varr:0 });
  }
  out.net = out.gross - out.vin;
  return out;
}
/* §ctChd · เด็กกี่คนเมื่อลำมี n หัว · เก็บเป็น % ไม่ใช่จำนวนคน
   เพราะจุดคุ้มทุนกวาดตั้งแต่ 1 คนขึ้นไป · ถ้าเก็บเป็นจำนวนคน รอบแรก ๆ จะกลายเป็นเด็กล้วน */
function ctChdAt(pl, n){
  var pct = +((pl && pl.chPct) || 0);
  if(!(pct > 0)) return 0;
  return Math.min(n, Math.round(n * Math.min(100, pct) / 100));
}
function ctCtxAt(pl, n){
  var th = Math.min(Math.max(0, +pl.paxTH || 0), n), ch = ctChdAt(pl, n);
  return { eng:pl.eng, boats:Math.max(1, +pl.boats || 1), fuel:+pl.fuel || 0,
           boatId:(pl.boatId || ''),                      /* §boatRent · ลำที่ปักไว้กับแผนนี้ */
           date:(pl._asOf || ''),                          /* §rentSpan · ว่าง = ไม่เช็คช่วงสัญญา */
           pax:n, paxTH:th, paxFR:Math.max(0, n - th), paxCh:ch };
}
function ctProfitAt(pl, n, tpl){
  var T = tpl || ctTpl(), R = ctVatR(T);
  var ctx = ctCtxAt(pl, n);
  var c = ctCalc(pl, ctx, T);
  /* ราคาเด็กไม่ได้ตั้ง = คิดเท่าผู้ใหญ่ · ไม่ใช่ฟรี */
  var pAd = +pl.price || 0;
  var pCh = (pl.priceCh != null && pl.priceCh !== '') ? (+pl.priceCh || 0) : pAd;
  var ch = ctx.paxCh, ad = Math.max(0, n - ch);
  var rev = (ad * pAd + ch * pCh) * (1 - R) * (1 - (+pl.comm || 0) / 100);
  /* §ctOd · เงินที่บริษัทได้จากของที่ลูกค้าสั่งเพิ่ม · ไม่โดนคอมของทัวร์หลัก */
  var odR = ctOdRev(pl, T, ctx) * (1 - R);
  return { p:rev + odR - c.net, rev:rev + odR, revTour:rev, revOd:odR, c:c, ad:ad, ch:ch };
}
function ctStepCount(pl, n, tpl){
  var T = tpl || ctTpl(), t = 0;
  T.lines.forEach(function(ln){
    if(ctGrpCfg(pl, ln.g || 'อื่นๆ').off) return;   // §category
    var L = ctEffLine(ln, pl); if(L.off) return;
    L.parts.forEach(function(p){
      if(p.k !== 'step') return;
      t += (p.mode === 'over') ? ((n > (+p.over || 0)) ? (+p.add || 1) : 0)
                               : Math.max(+p.min || 0, Math.ceil(n / Math.max(1, +p.every || 1)));
    });
  });
  return t;
}
// §breakEven · ขั้นบันไดทำให้สูตรปิดใช้ไม่ได้ → ไล่ทีละคนจนกำไรเป็นบวกครั้งแรก
function ctBreakEven(pl, cap, tpl){
  var T = tpl || ctTpl();
  for(var n = 1; n <= cap; n++){ if(ctProfitAt(pl, n, T).p > 0) return n; }
  return null;
}
function ctE(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ctB(n){ return '฿' + Math.round(n || 0).toLocaleString(); }
// §ctHeat · ไล่สีทราย → ส้มแบรนด์ ตามสัดส่วน 0..1
function ctHeat(t){
  t = Math.max(0, Math.min(1, +t || 0));
  var a = [201, 188, 174], b = [255, 76, 0], o = [];
  for(var i = 0; i < 3; i++) o.push(Math.round(a[i] + (b[i] - a[i]) * t));
  return 'rgb(' + o.join(',') + ')';
}
function ctHeatW(t){ t = +t || 0; return (t > 0.75) ? 700 : ((t > 0.45) ? 600 : 500); }
// §ctFx · อธิบายว่ายอดนั้นมาจากอะไรคูณอะไร
function _ctFxN(v){ return (Math.round((+v || 0) * 100) / 100).toLocaleString(); }
function ctPartDesc(p, ctx){
  if(!p) return '';
  var boats = Math.max(1, +ctx.boats || 1), perBoat = (p.per === 'boat' && boats > 1) ? (' × ' + boats + ' ลำ') : '';
  if(p.k === 'fix'){
    var q = (ctx.eng === '4EN' && p.q4 != null) ? p.q4 : p.q;
    var u = (ctx.eng === '4EN' && p.u4 != null) ? p.u4 : p.u;
    if(p.fuel) return _ctFxN(q) + ' ล. × ฿' + _ctFxN(ctx.fuel) + perBoat;
    return _ctFxN(q) + ' × ฿' + _ctFxN(u) + perBoat;
  }
  if(p.k === 'var'){
    if(p.fuel) return _ctFxN(p.q) + ' ล./คน × ฿' + _ctFxN(ctx.fuel) + ' × ' + (+ctx.pax || 0) + ' คน';
    var _S = ctPaxSplit(ctx), _bits = [];
    var _has = function(v){ return v != null && v !== ''; };
    if(_has(p.uTH) || _has(p.uCh) || _has(p.uChTH)){
      var _uTH   = _has(p.uTH) ? p.uTH : p.u;
      var _uCh   = _has(p.uCh) ? p.uCh : p.u;
      var _uChTH = _has(p.uChTH) ? p.uChTH : (_has(p.uCh) ? p.uCh : _uTH);
      if(_S.adFR) _bits.push('฿' + _ctFxN(p.u)     + ' × ' + _S.adFR + ' ผู้ใหญ่ ตปท.');
      if(_S.adTH) _bits.push('฿' + _ctFxN(_uTH)    + ' × ' + _S.adTH + ' ผู้ใหญ่ ไทย');
      if(_S.chFR) _bits.push('฿' + _ctFxN(_uCh)    + ' × ' + _S.chFR + ' เด็ก ตปท.');
      if(_S.chTH) _bits.push('฿' + _ctFxN(_uChTH)  + ' × ' + _S.chTH + ' เด็ก ไทย');
      if(_bits.length) return _bits.join(' + ');
    }
    return '฿' + _ctFxN(p.u) + ' × ' + (+ctx.pax || 0) + ' คน';
  }
  if(p.mode === 'over'){
    var on = ((+ctx.pax || 0) > (+p.over || 0)) ? (+p.add || 1) : 0;
    return 'เกิน ' + _ctFxN(p.over) + ' คน → ' + on + ' × ฿' + _ctFxN(p.u);
  }
  var cnt = Math.max(+p.min || 0, Math.ceil((+ctx.pax || 0) / Math.max(1, +p.every || 1)));
  return 'ทุกๆ ' + _ctFxN(p.every) + ' คน → ' + cnt + ' × ฿' + _ctFxN(p.u);
}
function ctLineFx(ln, pl, ctx, mul){
  if(!ln) return '';
  var L = ctEffLine(ln, pl);
  var txt = (L.parts || []).map(function(p){ return ctPartDesc(p, ctx); }).filter(Boolean).join('  +  ');
  if(mul && mul !== 1) txt += '  ·  ปรับ ' + (mul > 1 ? '+' : '−') + Math.round(Math.abs(mul - 1) * 100) + '%';
  return txt;
}
function ctN(n){ return Math.round(n || 0).toLocaleString(); }
function ctIcon(k, sz, sw){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2)
  + '" stroke-linecap="round" stroke-linejoin="round" style="width:' + (sz || 16) + 'px;height:' + (sz || 16) + 'px;flex:none">' + (CT_ICON[k] || '') + '</svg>'; }

function ctSetTab(t){ _ct.tab = t; ctRender(); }
// §staticTabs · แถบแท็บอยู่นอกส่วนที่ re-render · เดิมแท็บถูกลบทิ้งกลางคลิก ทำให้ "กดหัวข้อไม่ลง"
function ctPaintTabs(){
  var bar = document.getElementById('ct-tabs'); if(!bar) return;
  [].slice.call(bar.querySelectorAll('button[data-t]')).forEach(function(b){
    b.className = 'ct-tab' + ((b.getAttribute('data-t') === _ct.tab) ? ' on' : '');
  });
}
/* §ctKeepScroll · กดกางหมวด/รายการแล้วหน้าเด้งกลับไปข้างบน
   ต้นเหตุคือ host.innerHTML = ... ที่บรรทัดล่าง · ระหว่างที่เนื้อหาถูกล้าง ความสูงเหลือ ~0
   เบราว์เซอร์จึงหนีบ scrollTop ของตัวเลื่อนลงเป็น 0 แล้วค่าเดิมก็หายไปเลย
   (CLAUDE.md §6 "Scroll-jump on re-render" เตือนเรื่องนี้ไว้แล้ว เคยโดนที่หน้าอื่นมาก่อน)
   §ctSheet ทำให้มีตัวเลื่อนสองชั้นต้องเก็บ: ตัวหน้า (.main) กับกล่องตาราง (.ct-sheet)
   ⚠ el.focus() เฉย ๆ จะเลื่อนช่องนั้นเข้ามาในจอเอง กลายเป็นเด้งซ้ำรอบสอง
     ต้องใช้ preventScroll แล้วคืนตำแหน่งเองทั้งสองชั้น */
function ctRender(){
  var host = document.getElementById('ct-body'); if(!host) return;
  ctRentBust();                      /* §ctRentCache · วาดใหม่ = เริ่มนับรอบใหม่ */
  var a = document.activeElement, fk = (a && a.getAttribute) ? a.getAttribute('data-fk') : null;
  var ss = (a && a.selectionStart != null) ? a.selectionStart : null;
  var sheet = host.querySelector('.ct-sheet');
  var sT = sheet ? sheet.scrollTop : 0, sL = sheet ? sheet.scrollLeft : 0;
  var main = document.querySelector('.main');
  var mT = main ? main.scrollTop : (window.pageYOffset || 0);
  ctPaintTabs();
  host.innerHTML = (_ct.tab === 'tpl') ? ctTplHtml()
                 : (_ct.tab === 'ovr') ? ctOvrHtml()
                 : (_ct.tab === 'real') ? ctRealHtml()      /* §plCost */
                 : (_ct.tab === 'match') ? ctMatchHtml()    /* §ctMatch */
                 : ctPlanHtml();
  var restore = function(){
    var s2 = host.querySelector('.ct-sheet');
    if(s2){ if(sT) s2.scrollTop = sT; if(sL) s2.scrollLeft = sL; }
    if(main){ if(mT) main.scrollTop = mT; } else if(mT) window.scrollTo(0, mT);
  };
  restore();
  if(fk){ var el = host.querySelector('[data-fk="' + fk + '"]');
    if(el){ try{ el.focus({preventScroll:true}); }catch(_){ el.focus(); }
      try{ el.setSelectionRange(ss, ss); }catch(_){ }
      restore();   /* เผื่อ focus ยังขยับ · คืนอีกรอบหลังโฟกัสเสร็จ */
    } }
}
function ctNum(v, fk, oninput, w){
  return '<input class="ct-in" data-fk="' + fk + '" value="' + (v == null ? '' : v) + '" oninput="' + oninput
    + '" style="width:' + (w || 68) + 'px">';
}


/* ══ §ctFact · Fact Sheet · สรุปแผนหนึ่งแผนลงกระดาษ A4 ══════════════════════════════════════════
   หน้าจอออกแบบให้ "ปรับแล้วเห็นผลทันที" · กระดาษออกแบบให้ "เอาไปคุยกับคนอื่น"
   คนละงานกัน จึงไม่ยกเลย์เอาต์เดียวกันมาทั้งดุ้น — ตัดของที่กดไม่ได้บนกระดาษทิ้งหมด
   (ช่องกรอก ปุ่ม แถบสี กราฟ 38 แท่งที่อ่านค่าไม่ได้) แล้วแทนด้วยตัวเลขที่อ่านแล้วตัดสินใจได้
   ⚠ ตัวเลขคิดสดจากสูตรกลาง ณ วินาทีที่กดพิมพ์ · จึงต้องมีวันเวลากำกับหัวกระดาษเสมอ
     สูตรกลางแก้เมื่อไหร่ ใบที่พิมพ์ไปแล้วจะไม่ตรงกับหน้าจออีก และไม่มีใครรู้ว่าใบไหนเก่า
   ⚠ ใช้ document.write ลงหน้าต่างใหม่เหมือนใบสั่งงาน/ทะเบียนรายชื่อ (goPrint)
     ไม่ใช่ @media print ทับหน้าเดิม เพราะหน้านี้มี sticky/overflow เต็มไปหมด
     สั่งพิมพ์ทับจะได้กระดาษที่ตัดกลางตารางทุกครั้ง                                        */
function ctFactCss(){ return '<style>'
  + '@page{size:A4 portrait;margin:11mm}'
  + 'body{margin:0;padding:22px 18px 60px;background:#E9EBEF;'
    + "font-family:'Noto Sans Thai','DM Sans',system-ui,sans-serif;color:#14100C}"
  + '.fs{max-width:820px;margin:0 auto 18px;background:#fff;padding:26px 30px 34px;'
    + 'box-shadow:0 10px 40px -18px rgba(20,16,12,.5);border-radius:6px}'
  + '.fs-tool{max-width:820px;margin:0 auto 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;'
    + 'background:#fff;border-radius:10px;padding:10px 14px;font-size:12.5px}'
  + '.fs-tool b{font-size:13.5px}.fs-tool .h{color:#6b665f;flex:1;min-width:180px}'
  + '.fs-tool button{border:none;background:#C2410C;color:#fff;border-radius:8px;padding:7px 15px;'
    + "font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}"
  + '.fs-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;'
    + 'border-bottom:2px solid #14100C;padding-bottom:11px;margin-bottom:16px}'
  + '.fs-hd h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.3px}'
  + '.fs-hd .sub{font-size:11.5px;color:#6b665f;margin-top:4px}'
  + '.fs-hd .co{text-align:right;font-size:10px;letter-spacing:.16em;font-weight:800;color:#6b665f}'
  + '.fs-hd .co u{display:block;text-decoration:none;font-size:9.5px;letter-spacing:0;'
    + 'font-weight:400;color:#8b857d;margin-top:5px;line-height:1.5}'
  + '.fs-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px}'
  + '.fs-k{border:1px solid #DED8CE;border-radius:9px;padding:9px 11px}'
  + '.fs-k.hi{background:#F6F1E8;border-color:#C9BFAE}'
  + '.fs-k s{display:block;text-decoration:none;font-size:8.5px;font-weight:800;letter-spacing:.09em;'
    + 'color:#8b857d;text-transform:uppercase}'
  + '.fs-k b{display:block;font-size:21px;font-weight:800;margin-top:3px;line-height:1.1;'
    + 'font-variant-numeric:tabular-nums}'
  + '.fs-k b.neg{color:#9f1239}.fs-k b.pos{color:#0F6E56}'
  + '.fs-k i{display:block;font-style:normal;font-size:10px;color:#6b665f;margin-top:3px}'
  + '.fs-h2{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;'
    + 'color:#8b857d;border-bottom:1px solid #DED8CE;padding-bottom:4px;margin:17px 0 8px}'
  + '.fs-h2 em{font-style:normal;text-transform:none;letter-spacing:0;font-weight:500;color:#a39c93}'
  + '.fs-g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 16px;font-size:11.5px}'
  + '.fs-g div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #E4DED4;padding:3px 0}'
  + '.fs-g span{color:#6b665f}.fs-g b{font-weight:700;font-variant-numeric:tabular-nums}'
  + 'table.fs-t{width:100%;border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums}'
  + 'table.fs-t th{text-align:right;font-size:9.5px;font-weight:800;letter-spacing:.05em;color:#8b857d;'
    + 'text-transform:uppercase;padding:4px 7px;border-bottom:1px solid #14100C}'
  + 'table.fs-t th.l,table.fs-t td.l{text-align:left}'
  + 'table.fs-t td{text-align:right;padding:4px 7px;border-bottom:1px solid #EFEAE1}'
  + 'table.fs-t tr.g td{background:#F6F1E8;font-weight:700}'
  + 'table.fs-t tr.ln td.l{padding-left:20px;color:#4a4238}'
  + 'table.fs-t tr.sum td{border-top:1.5px solid #14100C;border-bottom:none;font-weight:800;padding-top:6px}'
  + 'table.fs-t tr.dim td{color:#a39c93}'
  + 'table.fs-t tr.be td{background:#E7F1EE;font-weight:800}'
  + '.fs-tag{display:inline-block;font-size:9px;font-weight:700;border-radius:4px;padding:1px 5px;'
    + 'background:#EFEAE1;color:#6b665f;margin-left:5px}'
  /* §ctSeason · ไฮ/โลว์ต้องแยกออกตั้งแต่ชายตามอง · ทั้งใบมีแต่ตัวเลข ถ้าไม่ติดสีจะไล่ไม่ทัน */
  + '.fs-tag.hi{background:#E7F1EE;color:#0F6E56}'
  + '.fs-tag.lo{background:#F6EFE2;color:#8A5B00}'
  + '.fs-note{font-size:10.5px;color:#6b665f;line-height:1.65;margin-top:7px}'
  /* §ctFactPrio · แถบคั่นสามชั้น · ทำให้ลำดับความสำคัญเห็นได้ตั้งแต่ชายตามอง
     ไม่ใช่ให้คนอ่านต้องเดาเองว่าตารางไหนเอาไว้ตัดสินใจ ตารางไหนเอาไว้ตรวจย้อน */
  + '.fs-band{display:flex;align-items:baseline;gap:10px;margin:22px 0 2px;'
    + 'border-top:2px solid #14100C;padding-top:8px}'
  + '.fs-band i{font-style:normal;font-size:15px;font-weight:800;color:#C2410C;'
    + 'font-variant-numeric:tabular-nums}'
  + '.fs-band b{font-size:13px;font-weight:800;letter-spacing:-.2px}'
  + '.fs-band s{text-decoration:none;font-size:10.5px;color:#8b857d;flex:1}'
  + '.fs-band.ref{border-top-color:#DED8CE}.fs-band.ref i,.fs-band.ref b{color:#8b857d}'
  + '.fs-band + .fs-h2{margin-top:10px;border-bottom-color:#EFEAE1}'
  + '.fs-foot{margin-top:22px;padding-top:9px;border-top:1px solid #DED8CE;font-size:9.5px;'
    + 'color:#8b857d;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}'
  + '@media print{body{background:#fff;padding:0}.fs-tool{display:none}'
    + '.fs{box-shadow:none;border-radius:0;margin:0;max-width:none;padding:0}'
    + '.fs-h2,table.fs-t{break-inside:auto}tr{break-inside:avoid}}'
  + '</style>'; }

/* หนึ่งแผน = หนึ่งใบ · แยกฟังก์ชันไว้เพื่อให้พิมพ์หลายแผนต่อกันได้ในอนาคต */
function ctFactSheet(pl){
  var e = ctE, B = ctB, T = ctTpl(), R = ctVatR(T);
  var pax   = Math.max(1, +pl.pax || 1);
  var seats = ctPlanSeats(pl), boats = Math.max(1, +pl.boats || 1);
  var cap   = Math.max(1, seats * boats);
  var cur   = ctProfitAt(pl, pax, T);
  var be    = ctBreakEven(pl, cap, T);
  var RN    = ctRentOf(pl.boatId);
  var pAd   = +pl.price || 0;
  var pCh   = (pl.priceCh != null && pl.priceCh !== '') ? (+pl.priceCh || 0) : pAd;
  var nCh   = ctChdAt(pl, pax);
  var vout  = ((pax - nCh) * pAd + nCh * pCh) * R;
  var rtNm  = '';
  try{ var _r = (typeof getRoute === 'function') ? getRoute(pl.famId) : null; rtNm = (_r && _r.name) || ''; }catch(_){ }

  /* ── 4 ตัวเลขที่ต้องเห็นก่อนอย่างอื่น ──
     §ctFactPrio · ช่องที่ 4 เดิมเป็น "ราคาขาย" ซึ่งอ่านได้จากตารางราคาอยู่แล้ว
     ตอนเช่าเรือ เลขที่ต้องเห็นก่อนอย่างอื่นคือ "ทั้งสัญญาแล้วเหลือเท่าไหร่"
     ตัวนั้นคำนวณอยู่ท้ายใบ · ยกขึ้นมาไว้หัวกระดาษ ไม่ต้องเลื่อนหาสามหน้า */
  var _factBase = null, _factBaseTxt = '';
  var bePct = be ? Math.round(be / cap * 100) : 100;
  var kpi4 = function(){
    if(_factBase == null)
      return '<div class="fs-k"><s>ราคาขาย</s><b>' + ctN(pAd) + '</b><i>เด็ก ' + ctN(pCh)
        + (+pl.comm > 0 ? (' · คอม ' + (+pl.comm) + '%') : ' · ไม่มีคอม') + '</i></div>';
    return '<div class="fs-k hi"><s>ทั้งสัญญา · BASE CASE</s><b class="'
      + (_factBase < 0 ? 'neg' : 'pos') + '">' + (_factBase < 0 ? '−' : '+')
      + ctN(Math.abs(_factBase)) + '</b><i>' + e(_factBaseTxt) + ' · หักค่าเช่าเต็มก้อนแล้ว</i></div>';
  };
  /* ⚠ ต้องเป็นฟังก์ชัน ไม่ใช่สตริง · _factBase ถูกเติมค่าในบล็อกฉากซึ่งอยู่ท้ายกว่านี้
     ประกอบเป็นสตริงตรงนี้เลย = อ่าน _factBase ตอนยังเป็น null ช่องที่ 4 จะไม่มีวันเปลี่ยน */
  var kpiHtml = function(){ return '<div class="fs-kpi">'
    + '<div class="fs-k hi"><s>จุดคุ้มทุน</s><b>' + (be ? (be + ' คน') : 'ไม่ถึง')
      + '</b><i>' + (be ? (bePct + '% ของ ' + cap + ' ที่นั่ง') : ('เต็มลำ ' + cap + ' ที่นั่งก็ยังขาดทุน')) + '</i></div>'
    + '<div class="fs-k"><s>กำไรที่คาด · ' + pax + ' คน</s><b class="' + (cur.p < 0 ? 'neg' : 'pos') + '">'
      + (cur.p < 0 ? '−' : '+') + ctN(Math.abs(cur.p)) + '</b><i>Margin '
      + (cur.rev ? Math.round(cur.p / cur.rev * 100) : 0) + '% ของรายได้สุทธิ</i></div>'
    + '<div class="fs-k"><s>ต้นทุนต่อทริป</s><b>' + ctN(cur.c.net) + '</b><i>คงที่ ' + ctN(cur.c.fixNet)
      + ' + ผันแปร ' + ctN(cur.c.varNet) + '</i></div>'
    + kpi4() + '</div>'; };

  /* ── พารามิเตอร์ที่ใช้คำนวณ · ใครถือใบนี้ต้องทำซ้ำได้ ── */
  var P = [['เครื่องยนต์', e(pl.eng || '')], ['จำนวนลำ', boats + ' ลำ'],
    ['ความจุ/ลำ', seats + ' ที่นั่ง' + (pl.boatId ? '' : ' (พิมพ์เอง)')],
    ['จำนวนคนที่คาด', pax + ' คน'], ['คนไทย', (Math.min(+pl.paxTH || 0, pax)) + ' คน'],
    ['เด็ก', (+pl.chPct || 0) + '% = ' + nCh + ' คน'],
    ['ราคาผู้ใหญ่', B(pAd) + ' <span class="fs-tag">รวม VAT</span>'],
    ['ราคาเด็ก', B(pCh)], ['คอมมิชชั่น', (+pl.comm || 0) + '%'],
    ['ราคาน้ำมัน', B(pl.fuel) + '/ลิตร'], ['VAT', (+T.vatRate || 0) + '%'],
    ['ความจุรวม', cap + ' ที่นั่ง']];
  var params = '<div class="fs-g">' + P.map(function(x){
      return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';

  /* ── เรือ & ค่าเช่า · ขึ้นเฉพาะตอนปักลำไว้ ── */
  var rent = '';
  if(pl.boatId){
    var bN = ((typeof getBoat === 'function' ? getBoat(pl.boatId) : null) || {}).name || pl.boatId;
    if(!RN){
      rent = '<div class="fs-h2">เรือที่ใช้</div><div class="fs-g">'
        + '<div><span>เรือ</span><b>' + e(bN) + '</b></div>'
        + '<div><span>ที่นั่ง</span><b>' + seats + '</b></div>'
        + '<div><span>สถานะ</span><b>เรือของบริษัท</b></div>'
        + '<div><span>กินน้ำมันเทียบสูตรกลาง</span><b>'
          + Math.round(ctBoatFuelMul(pl.boatId) * 100) + '%</b></div></div>';
    } else {
      var rNetTrip = RN.perTrip * (1 - (RN.vat ? R : 0));
      var rNetAll  = RN.amt * (1 - (RN.vat ? R : 0));
      var pEx = cur.p + rNetTrip;
      var dNd = (pEx > 0) ? Math.ceil(rNetAll / (pEx * RN.trips)) : null;
      var okD = (dNd != null && dNd <= RN.runDays);
      rent = '<div class="fs-h2">เรือเช่า · เงื่อนไขสัญญา <em>ผูกกับลำ ใช้ร่วมทุกเส้นทางที่ลำนี้วิ่ง</em></div>'
        + '<div class="fs-g">'
        + '<div><span>เรือ</span><b>' + e(RN.name) + '</b></div>'
        + '<div><span>ที่นั่ง</span><b>' + RN.seats + '</b></div>'
        + '<div><span>ค่าเช่า/งวด</span><b>' + B(RN.amt)
          + (RN.mode === 'seat' ? (' <span class="fs-tag">' + B(RN.seat) + '/ที่นั่ง</span>') : '') + '</b></div>'
        + '<div><span>วันในงวด</span><b>' + RN.days + ' วัน</b></div>'
        + '<div><span>วันหยุดตามตกลง</span><b>' + RN.off + ' วัน</b></div>'
        + '<div><span>วันที่วิ่งได้</span><b>' + RN.runDays + ' วัน</b></div>'
        + '<div><span>ค่าเช่า/วันวิ่ง</span><b>' + B(RN.perDay) + '</b></div>'
        + '<div><span>ค่าเช่า/ทริป</span><b>' + B(RN.perTrip)
          + (RN.trips > 1 ? (' <span class="fs-tag">' + RN.trips + ' รอบ/วัน</span>') : '') + '</b></div>'
        + '<div><span>ช่วงสัญญา</span><b>' + (RN.from ? e(RN.from) : '—') + ' → ' + (RN.to ? e(RN.to) : 'ไม่ระบุ') + '</b></div>'
        + '<div><span>เจ้าของเรือรับผิดชอบ</span><b>' + (CT_RENT_EX.filter(function(x){ return RN.ex[x.id]; })
            .map(function(x){ return x.l; }).join(' · ') || '—') + '</b></div>'
        + '<div><span>ผู้เช่าจ่ายเอง</span><b>น้ำมันเรือ</b></div>'
        + '<div><span>ค่าเช่ามี VAT</span><b>' + (RN.vat ? 'ขอคืนได้' : 'ไม่มี') + '</b></div>'
        + '<div><span>กินน้ำมันเทียบสูตรกลาง</span><b>' + Math.round(ctBoatFuelMul(pl.boatId) * 100) + '%</b></div></div>'
        + '<div class="fs-note"><b>จุดคุ้มทุนของค่าเช่า</b> · '
        + (dNd == null
            ? ('ที่ ' + pax + ' คน/ทริป วิ่งกี่วันก็ไม่คุ้ม (กำไรก่อนค่าเช่าติดลบ ' + B(Math.abs(pEx)) + '/ทริป)')
            : ('ต้องวิ่ง <b>' + dNd + ' วัน/งวด</b> ที่ ' + pax + ' คน/ทริป · มีให้วิ่ง ' + RN.runDays + ' วัน'
               + (okD ? (' · เหลือหายใจ ' + (RN.runDays - dNd) + ' วัน · ลูกค้ารวม '
                         + (dNd * RN.trips * pax).toLocaleString() + ' หัว/งวด')
                      : ' · <b>เกินจำนวนวันที่มี</b>')))
        + '<br>P&amp;L รายทริปลงค่าเช่าตามทริปที่วิ่งจริง ไม่ใช่เต็มก้อน · '
        + 'ส่วนที่ขาดดูได้ที่ P&amp;L รายทริป → รายเดือน → Unabsorbed boat rent</div>';
    }
  }

  /* ── ตารางต้นทุน · หมวดแล้วแตกรายบรรทัด ── */
  var gA = {}, gO = [], gL = {};
  cur.c.rows.forEach(function(r){
    if(!gA[r.g]){ gA[r.g] = { amt:0, vat:0, net:0, fix:0, varr:0 }; gO.push(r.g); gL[r.g] = []; }
    var a = gA[r.g]; a.amt += r.amt; a.vat += r.vatAmt; a.net += r.net; a.fix += r.fix; a.varr += r.varr;
    gL[r.g].push(r);
  });
  var kindOf = function(f, v){ return (f > 0 && v > 0) ? 'ผสม' : (v > 0 ? 'ผันแปร' : 'คงที่'); };
  var ctr = '';
  gO.forEach(function(g){
    var A = gA[g];
    ctr += '<tr class="g"><td class="l">' + e(g) + '</td><td>' + kindOf(A.fix, A.varr) + '</td><td>'
        +  ctN(A.amt) + '</td><td>' + (A.vat ? ctN(A.vat) : '—') + '</td><td>' + ctN(A.net) + '</td>'
        +  '<td>' + Math.round(A.net / (cur.c.net || 1) * 100) + '%</td></tr>';
    gL[g].forEach(function(r){
      ctr += '<tr class="ln' + (r.amt ? '' : ' dim') + '"><td class="l">' + e(r.l) + '</td>'
          +  '<td>' + kindOf(r.fix, r.varr) + '</td><td>' + (r.amt ? ctN(r.amt) : '—') + '</td>'
          +  '<td>' + (r.vatAmt ? ctN(r.vatAmt) : '—') + '</td><td>' + (r.net ? ctN(r.net) : '—') + '</td><td></td></tr>';
    });
  });
  var costTbl = '<table class="fs-t"><thead><tr><th class="l">รายการ</th><th>ชนิด</th><th>จำนวนเงิน</th>'
    + '<th>VAT ซื้อ</th><th>สุทธิ</th><th>สัดส่วน</th></tr></thead><tbody>' + ctr
    + '<tr class="sum"><td class="l">รวมต้นทุน · ที่ ' + pax + ' คน</td><td></td><td>' + ctN(cur.c.gross)
    + '</td><td>' + ctN(cur.c.vin) + '</td><td>' + ctN(cur.c.net) + '</td><td>100%</td></tr></tbody></table>';

  /* ── เศรษฐศาสตร์ต่อหัว · ที่มาของจุดคุ้มทุน ── */
  var revPer = cur.rev / pax, varPer = cur.c.varNet / pax, cm = revPer - varPer;
  /* ราคาต่ำสุดที่ยังไม่ขาดทุน ณ จำนวนคนที่ตั้งไว้ · ขยับราคาทั้งผู้ใหญ่และเด็กตามสัดส่วนเดิม
     ของที่ลูกค้าสั่งเพิ่มมีรายได้ของมันเอง ต้องหักออกจากยอดที่ทัวร์หลักต้องแบกก่อน */
  var needTour = cur.c.net - cur.revOd;
  var kMin = (cur.revTour > 0) ? (needTour / cur.revTour) : null;
  var minAd = (kMin != null && kMin > 0) ? pAd * kMin : null;
  var econ = '<div class="fs-g" style="grid-template-columns:repeat(3,1fr)">'
    + '<div><span>รายได้สุทธิ/หัว</span><b>' + ctN(revPer) + '</b></div>'
    + '<div><span>ต้นทุนผันแปร/หัว</span><b>−' + ctN(varPer) + '</b></div>'
    + '<div><span>ส่วนเกิน/หัว</span><b>' + ctN(cm) + '</b></div>'
    + '<div><span>ต้นทุนคงที่/ทริป</span><b>' + ctN(cur.c.fixNet) + '</b></div>'
    + '<div><span>คงที่ ÷ ส่วนเกิน</span><b>' + (cm > 0 ? (Math.ceil(cur.c.fixNet / cm) + ' คน') : 'ไม่คุ้ม') + '</b></div>'
    + '<div><span>จุดคุ้มทุนที่ระบบไล่จริง</span><b>' + (be ? (be + ' คน') : 'ไม่ถึง') + '</b></div>'
    + '<div><span>ห่างจุดคุ้มทุน</span><b>' + (be == null ? 'เต็มลำยังไม่คุ้ม'
        : (pax >= be ? ('เกินมา ' + (pax - be) + ' คน') : ('ขาดอีก ' + (be - pax) + ' คน'))) + '</b></div>'
    + '<div><span>ราคาต่ำสุดที่ไม่ขาดทุน · ที่ ' + pax + ' คน</span><b>'
        + (minAd == null ? '—' : ctN(minAd)) + '</b></div>'
    + '<div><span>ต้นทุนต่อหัว · ที่ ' + pax + ' คน</span><b>' + ctN(cur.c.net / pax) + '</b></div></div>'
    + '<div class="fs-note">สองช่องล่างขวาต่างกันได้ เพราะบางบรรทัดเป็น<b>ขั้นบันได</b> '
    + '(ไกด์ทุก 25 คน · เด็กเรือเพิ่มเมื่อเกิน 40) ต้นทุนจึงกระโดดเป็นช่วง ไม่ใช่เส้นตรง '
    + 'สูตรหารตรง ๆ ใช้ไม่ได้ · ระบบจึงไล่ทีละคนจาก 1 จนกำไรเป็นบวกครั้งแรก</div>';

  /* ── กำไรตามจำนวนคน · เลือกเฉพาะระดับที่ใช้ตัดสินใจ ไม่ใช่ทั้ง 38 แถว ── */
  var lv = {};
  [0.25, 0.5, 0.75, 1].forEach(function(f){ lv[Math.max(1, Math.round(cap * f))] = 1; });
  lv[pax] = 1; if(be) lv[be] = 1;
  var lvs = Object.keys(lv).map(Number).sort(function(a, b){ return a - b; });
  var curveRows = lvs.map(function(n){
    var X = ctProfitAt(pl, n, T);
    var isBe = (be && n === be), isNow = (n === pax);
    return '<tr class="' + (isBe ? 'be' : '') + '"><td class="l">' + n + ' คน'
      + (isBe ? ' <span class="fs-tag">จุดคุ้มทุน</span>' : '')
      + (isNow ? ' <span class="fs-tag">ที่ตั้งไว้</span>' : '')
      + (n === cap ? ' <span class="fs-tag">เต็มลำ</span>' : '') + '</td>'
      + '<td>' + Math.round(n / cap * 100) + '%</td>'
      + '<td>' + ctN(X.rev) + '</td><td>' + ctN(X.c.net) + '</td>'
      + '<td>' + (X.p < 0 ? '−' : '+') + ctN(Math.abs(X.p)) + '</td>'
      + '<td>' + (X.p < 0 ? '−' : '+') + ctN(Math.abs(X.p / n)) + '</td></tr>';
  }).join('');
  var curve = '<table class="fs-t"><thead><tr><th class="l">จำนวนคน</th><th>อัตราบรรทุก</th>'
    + '<th>รายได้สุทธิ</th><th>ต้นทุนสุทธิ</th><th>กำไร/ขาดทุน</th><th>ต่อหัว</th></tr></thead>'
    + '<tbody>' + curveRows + '</tbody></table>';

  /* ── VAT ── */
  var vat = '<div class="fs-g" style="grid-template-columns:repeat(3,1fr)">'
    + '<div><span>ภาษีขาย</span><b>' + ctN(vout) + '</b></div>'
    + '<div><span>ภาษีซื้อที่ขอคืนได้</span><b>−' + ctN(cur.c.vin) + '</b></div>'
    + '<div><span>ต้องนำส่ง</span><b>' + ctN(Math.max(0, vout - cur.c.vin)) + '</b></div></div>';

  /* ── รายละเอียดเส้นทาง · มีค่อยขึ้น ── */
  var IA = ctItin(pl), km = ctItinKm(IA), itin = '';
  if(IA.length){
    itin = '<div class="fs-h2">รายละเอียดเส้นทาง</div><table class="fs-t">'
      + '<thead><tr><th class="l">เวลา</th><th class="l">กิจกรรม</th><th>กม.</th></tr></thead><tbody>'
      + IA.map(function(r){ return '<tr><td class="l">' + e(r.t || '') + '</td><td class="l">'
          + e(r.a || '') + '</td><td>' + e(r.k || '—') + '</td></tr>'; }).join('')
      + '<tr class="sum"><td class="l">รวมระยะทาง</td><td></td><td>'
      + (km == null ? '—' : (km.toLocaleString() + ' กม.')) + '</td></tr></tbody></table>';
  }

  /* ── ของที่ลูกค้าสั่งเพิ่ม · มีค่อยขึ้น ── */
  var odL = (T.lines || []).filter(function(ln){ return ln.od; }), od = '';
  if(odL.length){
    var odRows = odL.map(function(ln){
      var C = ctOdCfg(pl, ln), L = ctEffLine(ln, pl);
      var unit = +((L.parts || [])[0] || {}).u || 0, pct = ctOdPct(ln), u1 = pct ? 'คน' : 'ลำ';
      var q = ctOdQty(pl, ln, { pax:pax });
      var off = L.off || ctGrpCfg(pl, ln.g || 'อื่นๆ').off;
      return '<tr class="' + (off ? 'dim' : '') + '"><td class="l">' + e(ln.l)
        + (off ? ' <span class="fs-tag">ปิดอยู่</span>' : '') + '</td>'
        + '<td>' + ctN(unit) + '/' + u1 + '</td><td>' + q + ' ' + u1 + '</td>'
        + '<td>' + ctN(C.aR) + '</td><td>' + ctN(C.uR) + '</td></tr>';
    }).join('');
    var odRev = ctOdRev(pl, T, { pax:pax });
    od = '<div class="fs-h2">ของที่ลูกค้าสั่งเพิ่ม <em>คิดตามที่สั่งจริง ไม่ใช่ทุกหัวบนเรือ</em></div>'
      + '<table class="fs-t"><thead><tr><th class="l">รายการ</th><th>ทุน/หน่วย</th><th>คาดว่าสั่ง</th>'
      + '<th>บริษัทได้ · เอเจนต์</th><th>บริษัทได้ · ขายเพิ่ม</th></tr></thead><tbody>' + odRows
      + '<tr class="sum"><td class="l">รายได้ส่วนนี้ที่รวมอยู่ในกำไรข้างบนแล้ว</td><td></td><td></td>'
      + '<td colspan="2">' + ctN(odRev * (1 - R)) + '</td></tr></tbody></table>';
  }

  /* ══ §ctTier · ราคา 5 ระดับ ══════════════════════════════════════════════
     คำถามตอนตั้งราคาไม่ใช่ "ราคานี้กำไรเท่าไหร่" แต่คือ "ขยับราคาแล้วอะไรเปลี่ยนบ้าง"
     ระดับล่างสุดยึดจากราคาเท่าทุน ไม่ใช่ลดจากราคาปัจจุบันลอย ๆ
     เพราะตัวที่ต้องรู้ก่อนต่อราคาคือ "ต่ำกว่านี้ไม่ได้แล้ว" ไม่ใช่ "ลด 10% เป็นเท่าไหร่"
     ราคาเด็กขยับตามสัดส่วนเดิมเสมอ · ไม่งั้นเทียบข้ามระดับไม่ได้ */
  var r50 = function(v){ return Math.round(v / 50) * 50; };
  var chRatio = (pAd > 0) ? (pCh / pAd) : 1;
  var tierAt = function(price){
    var q = {}; for(var k in pl) q[k] = pl[k];
    q.price = price; q.priceCh = Math.round(price * chRatio);
    return q;
  };
  var TL = [];
  (function(){
    var floorP = (minAd == null) ? null : Math.ceil(minAd / 50) * 50;
    var cand = [
      { l:'ราคาเท่าทุน',   p:floorP, why:'ที่ ' + pax + ' คน · ต่ำกว่านี้ขาดทุนทันที' },
      { l:'เจาะตลาด',      p:r50(pAd * 0.9),  why:'ลด 10% จากราคาปัจจุบัน' },
      { l:'ราคาปัจจุบัน',  p:pAd,             why:'ที่ตั้งไว้ในแผนนี้' },
      { l:'ตั้งเป้า',      p:r50(pAd * 1.1),  why:'ขึ้น 10%' },
      { l:'พรีเมียม',      p:r50(pAd * 1.2),  why:'ขึ้น 20%' }
    ];
    var seen = {};
    cand.forEach(function(c){
      if(c.p == null || !(c.p > 0) || seen[c.p]) return;
      seen[c.p] = 1; TL.push(c);
    });
    TL.sort(function(a, b){ return a.p - b.p; });
  })();
  var tierRows = TL.map(function(c){
    var q = tierAt(c.p);
    var X = ctProfitAt(q, pax, T), bq = ctBreakEven(q, cap, T);
    var below = (minAd != null && c.p < minAd);
    var dNd = null;
    if(RN && RN.amt > 0){
      var pe = X.p + RN.perTrip * (1 - (RN.vat ? R : 0));
      dNd = (pe > 0) ? Math.ceil((RN.amt * (1 - (RN.vat ? R : 0))) / (pe * RN.trips)) : null;
    }
    return '<tr class="' + (below ? 'dim' : (c.p === pAd ? 'be' : '')) + '">'
      + '<td class="l">' + e(c.l) + (c.p === pAd ? ' <span class="fs-tag">ตอนนี้</span>' : '')
        + '<div style="font-size:9.5px;color:#a39c93">' + e(c.why) + '</div></td>'
      + '<td>' + ctN(c.p) + '</td><td>' + ctN(Math.round(c.p * chRatio)) + '</td>'
      + '<td>' + (bq ? (bq + ' คน') : 'ไม่ถึง') + '</td>'
      + '<td>' + (X.p < 0 ? '−' : '+') + ctN(Math.abs(X.p)) + '</td>'
      + '<td>' + (X.rev ? Math.round(X.p / X.rev * 100) : 0) + '%</td>'
      + '<td>' + (RN && RN.amt > 0 ? (dNd == null ? 'ไม่คุ้ม' : (dNd + ' วัน')) : '—') + '</td></tr>';
  }).join('');
  var tier = '<div class="fs-h2">ราคา 5 ระดับ <em>ที่ ' + pax + ' คน/ทริป · ราคาเด็กขยับตามสัดส่วนเดิม</em></div>'
    + '<table class="fs-t"><thead><tr><th class="l">ระดับ</th><th>ผู้ใหญ่</th><th>เด็ก</th>'
    + '<th>จุดคุ้มทุน</th><th>กำไร/ทริป</th><th>Margin</th>'
    + '<th>' + (RN && RN.amt > 0 ? 'ต้องวิ่ง/งวด' : '—') + '</th></tr></thead><tbody>' + tierRows
    + '</tbody></table>'
    + '<div class="fs-note">แถวที่<b>ซีด</b>คือราคาที่ต่ำกว่าจุดเท่าทุนที่ ' + pax + ' คน · '
    + 'รับได้เฉพาะตอนที่มั่นใจว่าจะได้คนมากกว่านี้'
    + (RN && RN.amt > 0 ? ' · ช่องขวาสุดคือจำนวนวันที่ต้องวิ่งในหนึ่งงวดเพื่อคืนค่าเช่าทั้งก้อน' : '')
    + '</div>';

  /* ══ §ctFactLong · ทั้งสัญญา · รายเดือน + best/base/worst ════════════════
     ขึ้นเฉพาะตอนเป็นเรือเช่าและระบุช่วงสัญญาไว้ — เพราะ "ต้องหาลูกค้ากี่คนต่อเดือน"
     จะมีความหมายก็ต่อเมื่อมีต้นทุนก้อนที่จ่ายรายงวดไม่ว่าจะวิ่งหรือไม่
     เรือของบริษัทไม่มีก้อนนั้น ทุกทริปที่เกินจุดคุ้มทุนคือกำไรล้วน ไม่ต้องมีโควตารายเดือน */
  var longMon = '', longSc = '';
  if(RN && RN.amt > 0 && RN.from && RN.to && RN.to >= RN.from){
    var rNetTripL = RN.perTrip * (1 - (RN.vat ? R : 0));
    var MS = ctMonthsIn(RN.from, RN.to);
    var totCal = 0, totOp = 0, totDue = 0;
    var monRows = MS.map(function(ym){
      var E = ctMonthEdges(ym), SP = ctRentSpan(RN, E.a, E.b);
      if(!SP) return '';
      var opD = Math.round(SP.opDays);
      totCal += SP.calDays; totOp += opD; totDue += SP.due;
      var pEx = cur.p + rNetTripL;
      var need = (pEx > 0) ? Math.ceil((SP.due * (1 - (RN.vat ? R : 0))) / (pEx * RN.trips)) : null;
      var ok = (need != null && need <= opD);
      var part = (SP.calDays < E.days);
      var sea = ctSeasonOf(ym);
      return '<tr class="' + (ok ? '' : 'dim') + '"><td class="l">' + e(ctMonLabel(ym))
        + ' <span class="fs-tag' + (sea === 'lo' ? ' lo' : ' hi') + '">' + CT_SEASON_TXT[sea] + '</span>'
        + (part ? ' <span class="fs-tag">' + SP.calDays + '/' + E.days + ' วัน</span>' : '') + '</td>'
        + '<td>' + opD + '</td><td>' + ctN(SP.due) + '</td>'
        + '<td>' + (need == null ? 'ไม่คุ้ม' : (need + ' วัน')) + '</td>'
        + '<td>' + (need == null ? '—' : ctN(need * RN.trips * pax)) + '</td>'
        + '<td>' + (need == null ? '—' : (ok ? ('เหลือ ' + (opD - need) + ' วัน') : ('เกิน ' + (need - opD) + ' วัน'))) + '</td></tr>';
    }).join('');
    var pExAll = cur.p + rNetTripL;
    var needAll = (pExAll > 0) ? Math.ceil((totDue * (1 - (RN.vat ? R : 0))) / (pExAll * RN.trips)) : null;
    var monTbl = '<table class="fs-t"><thead><tr><th class="l">เดือน</th><th>วันที่วิ่งได้</th>'
      + '<th>ค่าเช่าที่ต้องจ่าย</th><th>ต้องวิ่ง</th><th>ต้องหาลูกค้า</th><th>เหลือ/เกิน</th></tr></thead>'
      + '<tbody>' + monRows
      + '<tr class="sum"><td class="l">รวมทั้งสัญญา · ' + MS.length + ' เดือน (' + totCal + ' วัน)</td>'
      + '<td>' + totOp + '</td><td>' + ctN(totDue) + '</td>'
      + '<td>' + (needAll == null ? 'ไม่คุ้ม' : (needAll + ' วัน')) + '</td>'
      + '<td>' + (needAll == null ? '—' : ctN(needAll * RN.trips * pax)) + '</td>'
      + '<td>' + (needAll == null ? '—' : (needAll <= totOp ? ('เหลือ ' + (totOp - needAll) + ' วัน') : ('เกิน ' + (needAll - totOp) + ' วัน'))) + '</td></tr>'
      + '</tbody></table>';

    /* สามฉาก · สมมติฐานเขียนติดไว้ในตาราง ไม่ใช่ซ่อนในโค้ด
       ใครไม่เห็นด้วยกับตัวเลขจะได้เถียงถูกจุดว่าเถียงสมมติฐานไหน */
    /* §ctSeason · สมมติฐานแยกไฮ/โลว์ · เขียนกำกับไว้ในตาราง ไม่ซ่อนในโค้ด
       lf = สัดส่วนความจุ (null = ใช้จำนวนคนที่ตั้งไว้ในแผน) · du = วิ่งกี่ % ของวันที่มี
       โลว์ซีซั่นไม่ได้แค่คนน้อยลง วันวิ่งก็น้อยลงด้วย · เรือหยุดตามคลื่นและตามทัวร์ที่ไม่ออก */
    var SC = [
      { l:'Worst case', c:'#9f1239',
        hi:{ lf:0.45, du:0.70 }, lo:{ lf:0.25, du:0.35 } },
      { l:'Base case',  c:'#14100C',
        hi:{ lf:null, du:0.90 }, lo:{ lf:null, du:0.55, paxMul:0.55 } },
      { l:'Best case',  c:'#0F6E56',
        hi:{ lf:0.85, du:1.00 }, lo:{ lf:0.55, du:0.70 } }
    ];
    var rNetAllL = totDue * (1 - (RN.vat ? R : 0));
    /* เดือนแยกฤดู · ใช้ยอดที่ไล่ไว้แล้วตอนทำตารางรายเดือน ไม่คิดซ้ำ */
    var SEA = { hi:{ op:0, due:0, n:0 }, lo:{ op:0, due:0, n:0 } };
    MS.forEach(function(ym){
      var E2 = ctMonthEdges(ym), S2 = ctRentSpan(RN, E2.a, E2.b); if(!S2) return;
      var k = ctSeasonOf(ym);
      SEA[k].op += Math.round(S2.opDays); SEA[k].due += S2.due; SEA[k].n++;
    });
    var paxAt = function(cfg){
      if(cfg.lf != null) return Math.max(1, Math.round(cap * cfg.lf));
      return Math.max(1, Math.round(pax * (cfg.paxMul != null ? cfg.paxMul : 1)));
    };
    var cfgTxt = function(cfg){
      return (cfg.lf != null ? (Math.round(cfg.lf * 100) + '% ของความจุ')
            : (cfg.paxMul != null ? (Math.round(cfg.paxMul * 100) + '% ของคนตามแผน') : 'คนตามแผน'))
        + ' · วิ่ง ' + Math.round(cfg.du * 100) + '%';
    };
    var scRows = SC.map(function(x){
      var tot = { d:0, heads:0, gross:0 }, sub = '';
      ['hi','lo'].forEach(function(k){
        var cfg = x[k], S2 = SEA[k];
        var n = paxAt(cfg), d = Math.round(S2.op * cfg.du), tp = d * RN.trips;
        var pe = ctProfitAt(pl, n, T).p + rNetTripL;
        var g = pe * tp;
        tot.d += d; tot.heads += tp * n; tot.gross += g;
        sub += '<tr class="' + (k === 'lo' ? 'dim' : '') + '">'
          + (k === 'hi' ? ('<td class="l" rowspan="3"><b style="color:' + x.c + '">' + x.l + '</b></td>') : '')
          + '<td class="l">' + CT_SEASON_TXT[k] + ' <span class="fs-tag">' + S2.n + ' เดือน</span>'
          + '<div style="font-size:9.5px;color:#a39c93">' + cfgTxt(cfg) + '</div></td>'
          + '<td>' + n + ' คน</td><td>' + d + ' วัน</td><td>' + ctN(tp * n) + '</td>'
          + '<td>' + (g < 0 ? '−' : '+') + ctN(Math.abs(g)) + '</td>'
          + '<td>−' + ctN(S2.due * (1 - (RN.vat ? R : 0))) + '</td>'
          + '<td>' + (function(){ var nt = g - S2.due * (1 - (RN.vat ? R : 0));
              return '<b style="color:' + (nt < 0 ? '#9f1239' : '#0F6E56') + '">'
                + (nt < 0 ? '−' : '+') + ctN(Math.abs(nt)) + '</b>'; })() + '</td></tr>';
      });
      var net = tot.gross - rNetAllL;
      sub += '<tr class="be"><td class="l">ทั้งปี</td><td></td><td>' + tot.d + ' วัน</td>'
        + '<td>' + ctN(tot.heads) + '</td>'
        + '<td>' + (tot.gross < 0 ? '−' : '+') + ctN(Math.abs(tot.gross)) + '</td>'
        + '<td>−' + ctN(rNetAllL) + '</td>'
        + '<td><b style="color:' + (net < 0 ? '#9f1239' : '#0F6E56') + '">'
        + (net < 0 ? '−' : '+') + ctN(Math.abs(net)) + '</b></td></tr>';
      return sub;
    }).join('');
    var scTbl = '<table class="fs-t"><thead><tr><th class="l">ฉาก</th><th class="l">ฤดู · สมมติฐาน</th>'
      + '<th>คน/ทริป</th><th>วันวิ่ง</th><th>ลูกค้า</th><th>กำไรก่อนค่าเช่า</th><th>ค่าเช่า</th>'
      + '<th>สุทธิ</th></tr></thead><tbody>' + scRows + '</tbody></table>'
      + '<div class="fs-note"><b>โลว์ซีซั่นคือเดือนที่ต้องเมเนจ</b> · ค่าเช่าเดินเท่ากันทุกเดือน '
      + 'แต่คนไม่ได้มาเท่ากัน · ' + SEA.lo.n + ' เดือนโลว์กินค่าเช่าไป ' + ctB(SEA.lo.due)
      + ' ซึ่งต้องเอากำไรจาก ' + SEA.hi.n + ' เดือนไฮมาโปะ<br>'
      + 'ทางลดแรงกระแทก · ต่อสัญญาให้จบก่อนเข้าโลว์ · ขอหยุดเพิ่มช่วงโลว์ · '
      + 'หาเช่าเฉพาะไฮซีซั่น · หรือย้ายลำไปเส้นทางที่ยังวิ่งได้ช่วงมรสุม</div>';

    longMon = '<div class="fs-h2">ต้องหาลูกค้าเดือนละเท่าไหร่ <em>ที่ ' + pax
      + ' คน/ทริป · ' + e(RN.from) + ' → ' + e(RN.to) + '</em></div>' + monTbl
      + '<div class="fs-note"><b>ค่าเช่าคิดเป็นรายวัน</b> · ' + B(RN.amt) + ' ÷ ' + RN.days + ' วัน = '
      + B(RN.perCalDay) + '/วันตามปฏิทิน · เดือน 31 วันจึงเป็น ' + B(RN.perCalDay * 31)
      + ' และเดือน 28 วันเป็น ' + B(RN.perCalDay * 28)
      + ' — ถ้าสัญญาเขียนว่า "เดือนละ ' + B(RN.amt) + '" เท่ากันทุกเดือนไม่ว่าเดือนสั้นเดือนยาว '
      + 'ยอดรวมทั้งสัญญาจะเป็น ' + B(RN.amt * MS.length) + ' ไม่ใช่ ' + ctB(totDue) + '<br>'
      + 'เดือนที่<b>ซีด</b>คือเดือนที่ต้องวิ่งเกินจำนวนวันที่มี = ที่ราคาและจำนวนคนชุดนี้ '
      + 'เดือนนั้นไม่มีทางคืนค่าเช่าได้ ต้องขึ้นราคา เพิ่มคนต่อรอบ หรือเพิ่มรอบต่อวัน<br>'
      + 'เดือนที่มีป้าย <b>x/y วัน</b> คือเดือนที่สัญญาไม่ได้กินทั้งเดือน ค่าเช่าคิดตามวันที่ครอบคลุมจริง</div>';
    longSc = '<div class="fs-h2">Best / Base / Worst case <em>ทั้งสัญญา ' + MS.length
      + ' เดือน · ' + e(RN.from) + ' → ' + e(RN.to) + '</em></div>' + scTbl
      + '<div class="fs-note">สามฉากนี้เป็น<b>สมมติฐาน</b>ที่เขียนกำกับไว้ในตาราง ไม่ใช่ตัวเลขที่ระบบรู้ '
      + 'ระบบไม่รู้ว่าเดือนไหนไฮซีซั่น · ถ้าไม่เห็นด้วยกับฉากไหน ให้เถียงที่สมมติฐานในช่องซ้าย<br>'
      + 'ค่าเช่าหักเต็มก้อนทุกฉาก เพราะจ่ายเท่ากันไม่ว่าเรือจะวิ่งหรือไม่ — นั่นคือประเด็นทั้งหมดของการเช่า</div>';
    /* §ctFactPrio · เก็บกำไรสุทธิฉาก Base ไว้ขึ้นหัวกระดาษ · เป็นเลขที่ตอบว่า "ควรเช่าไหม" */
    (function(){
      var n = pax, d = Math.round(totOp * 0.85), tp = d * RN.trips;
      _factBase = (ctProfitAt(pl, n, T).p + rNetTripL) * tp - rNetAllL;
      _factBaseTxt = d + ' วัน · ' + ctN(tp * n) + ' หัว';
    })();
  } else if(RN && RN.amt > 0){
    longSc = '<div class="fs-h2">ทั้งสัญญา</div><div class="fs-note">'
      + 'ยังไม่ได้ใส่<b>ช่วงสัญญา</b> (วันเริ่ม–วันจบ) ในหน้าแผนคำนวณ · '
      + 'ใส่แล้วใบนี้จะมีตารางรายเดือนว่าต้องหาลูกค้าเดือนละกี่หัว และฉาก Best/Base/Worst ทั้งสัญญาให้</div>';
  }

  var now = new Date();
  var stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-'
            + String(now.getDate()).padStart(2, '0') + ' '
            + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var who = ''; try{ who = (typeof ckMe === 'function') ? String(ckMe() || '') : ''; }catch(_){ }
  if(who === '-' || who === '\u2014') who = '';        /* ckMe คืนขีดกลางตอนยังไม่รู้ว่าใคร */

  return '<div class="fs">'
    + '<div class="fs-hd"><div><h1>' + e(pl.name || 'แผนคำนวณ') + '</h1>'
      + '<div class="sub">' + (rtNm ? ('เส้นทาง ' + e(rtNm) + ' · ') : 'ยังไม่ผูกเส้นทาง · ')
      + e(pl.eng || '') + ' · ' + boats + ' ลำ · ' + seats + ' ที่นั่ง/ลำ'
      + (RN ? ' · เรือเช่า ' + e(RN.name) : (pl.boatId ? ' · ' + e(((typeof getBoat === 'function' ? getBoat(pl.boatId) : null) || {}).name || '') : ''))
      + '</div></div>'
      + '<div class="co">LOVE ANDAMAN<u>ต้นทุน &amp; จุดคุ้มทุน · Fact Sheet<br>ออกเมื่อ ' + e(stamp)
      + (who ? (' · ' + e(who)) : '') + '</u></div></div>'
    + kpiHtml()
    /* ══ §ctFactPrio · เรียงตามลำดับที่คนอ่านต้องใช้ ไม่ใช่ตามลำดับที่เขียนโค้ด ══
       ของเดิมเอา "พารามิเตอร์" กับ "ตารางต้นทุน 20 บรรทัด" ไว้หน้าแรก
       ทั้งสองอันเป็นของไว้ตรวจย้อน ไม่มีใครตัดสินใจอะไรจากมัน
       คนถือใบนี้ไปประชุมต้องการสามอย่างตามลำดับ
         1 ตัดสินใจ   เช่าคุ้มไหม · ตั้งราคาเท่าไหร่
         2 วางแผน     เดือนหนึ่งต้องหาลูกค้ากี่หัว · ได้กี่คนถึงเริ่มกำไร
         3 ตรวจย้อน   ตัวเลขพวกนั้นมาจากไหน
       ถ้าเถียงกันจบที่ชั้น 1 ก็ไม่ต้องพลิกไปชั้น 3 เลย */
    + '<div class="fs-band"><i>1</i><b>ตัดสินใจ</b><s>'
      + (longSc ? 'เช่าคุ้มไหม · ตั้งราคาเท่าไหร่' : 'ตั้งราคาเท่าไหร่') + '</s></div>'
    + longSc + tier
    + '<div class="fs-band"><i>2</i><b>วางแผน</b><s>'
      + (longMon ? 'ต้องหาลูกค้าเท่าไหร่ · ได้กี่คนถึงเริ่มกำไร' : 'ได้กี่คนถึงเริ่มกำไร') + '</s></div>'
    + longMon
    + '<div class="fs-h2">กำไรตามจำนวนคน</div>' + curve
    + '<div class="fs-h2">ต่อหัว &amp; ที่มาของจุดคุ้มทุน</div>' + econ
    + '<div class="fs-band ref"><i>3</i><b>ที่มาของตัวเลข</b><s>ไว้ตรวจย้อน · คำนวณซ้ำเองได้ทุกช่อง</s></div>'
    + rent
    + '<div class="fs-h2">ต้นทุนต่อทริป <em>ที่ ' + pax + ' คน · สุทธิคือหลังหัก VAT ซื้อที่ขอคืนได้แล้ว</em></div>' + costTbl
    + od
    + '<div class="fs-h2">VAT ต่อทริป</div>' + vat
    + '<div class="fs-h2">พารามิเตอร์ที่ใช้คำนวณ</div>' + params
    + itin
    + '<div class="fs-foot"><span>ตัวเลขคิดสดจากสูตรกลาง ณ เวลาที่พิมพ์ · '
      + 'สูตรกลางแก้เมื่อไหร่ ใบนี้จะไม่ตรงกับหน้าจออีก</span>'
      + '<span>' + e(stamp) + '</span></div></div>';
}
function ctFactPrint(){
  var pl = ctPlan(_ct.pid);
  if(!pl){ alert('ยังไม่ได้เลือกแผน'); return; }
  var title = 'Fact Sheet · ' + (pl.name || 'แผนคำนวณ');
  var html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>' + ctE(title) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;800&family=DM+Mono:wght@400;700&display=swap" rel="stylesheet">'
    + ctFactCss() + '</head><body>'
    + '<div class="fs-tool"><b>Fact Sheet</b><span class="h">' + ctE(pl.name || '')
      + ' · A4 แนวตั้ง · ตัวเลขคิดสด ณ เวลาที่เปิดหน้านี้</span>'
    + '<button onclick="window.print()">&#128424; พิมพ์ / บันทึก PDF</button></div>'
    + ctFactSheet(pl) + '</body></html>';
  var w = window.open('', '_blank');
  if(!w){ alert('เปิดหน้าต่างไม่ได้ · อนุญาต pop-up ของเว็บนี้ก่อน'); return; }
  w.document.write(html); w.document.close(); w.focus();
}

// ── แท็บ 1 · แผนคำนวณ ───────────────────────────────────────────────────────────────────────────
/* lifted out of ctPlanHtml by tools/lift.mjs (var:items) · reads: P, T */
function ctPlanItems(C){
  const { P, T } = C;
  return P.map(function(x){
    var on = (x.id === _ct.pid);
    var xcap = Math.max(1, ctPlanSeats(x) * Math.max(1, +x.boats || 1));   /* §boatRent */
    var b = ctBreakEven(x, xcap, T);
    return '<button class="ct-rt' + (on ? ' on' : '') + '" onclick="ctPickPlan(\'' + x.id + '\')">'
      + '<span class="ct-rt-ic">' + ctIcon(on ? 'compass' : 'anchor', 17) + '</span>'
      + '<span class="ct-rt-body"><span class="ct-rt-nm">' + ctE(x.name) + (on ? '<i class="ct-dot"></i>' : '') + '</span>'
      + '<span class="ct-rt-sub">' + ctE(x.eng) + ' · จุ ' + ctPlanSeats(x) + (+x.boats > 1 ? (' × ' + x.boats + ' ลำ') : '') + ' · ' + ctB(x.price) + '/หัว'
      + (ctRentOf(x.boatId) ? ' · <b style="color:#B45309">เรือเช่า</b>' : '') + '</span>'
      + '<span class="ct-rt-badge' + (b ? '' : ' warn') + '">' + (b ? ('คุ้มทุน ' + b + ' คน') : 'เต็มลำยังไม่คุ้ม') + '</span></span></button>';
  }).join('');
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:head) · reads: pl */
function ctPlanHead(C){
  const { pl } = C;
  return '<div class="ct-card ct-namebar">'
    + '<input class="ct-title" data-fk="pl.name" value="' + ctE(pl.name) + '" oninput="ctPlanSet(\'name\',this.value)">'
    + '<div class="ct-linkbox">' + ctIcon('link', 13) + '<span>ผูกกับเส้นทาง:</span>'
    + '<select onchange="ctPlanSet(\'famId\',this.value)"><option value="">— ยังไม่ผูก —</option>'
    + ctRoutesByPier().map(function(g){
        return '<optgroup label="' + ctE(g.name) + '">'
          + g.routes.map(function(r){
              return '<option value="' + ctE(r.id) + '"' + (pl.famId === r.id ? ' selected' : '') + '>'
                + ctE(r.name || r.id) + '</option>'; }).join('')
          + '</optgroup>'; }).join('')
    + '</select></div>'
    + '<button class="ct-ib" title="Fact Sheet · สรุปแผนนี้ลงกระดาษ A4 / บันทึก PDF" onclick="ctFactPrint()">'
      + ctIcon('printer', 15) + '</button>'                                   /* §ctFact */
    + '<button class="ct-ib" title="คัดลอกแผน" onclick="ctDupPlan()">' + ctIcon('copy', 15) + '</button>'
    + '<button class="ct-ib danger" title="ลบแผน" onclick="ctDelPlan()">' + ctIcon('trash', 15) + '</button></div>';
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:params) · reads: fld, pl, inp, capPer, pax */
function ctPlanParams(C){
  const { fld, pl, inp, capPer, pax } = C;
  return '<div class="ct-card ct-params"><div class="ct-card-h">' + ctIcon('sliders', 15)
    + '<b>พารามิเตอร์การตั้งราคา &amp; กำลังการผลิต</b><span class="ct-hint">ปรับแล้วคำนวณจุดคุ้มทุนใหม่ทันที</span></div>'
    + '<div class="ct-grid8">'
    + fld('เครื่องยนต์', '<select class="ct-in wide" onchange="ctPlanSet(\'eng\',this.value)">'
        + ['3EN','4EN'].map(function(e){ return '<option' + (pl.eng === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select>')
    + fld('จำนวนลำ', inp('boats'))
    /* §boatRent · ปักเรือไว้แล้ว ที่นั่งมาจากทะเบียนเรือ · ปล่อยให้พิมพ์ทับได้เมื่อไหร่
       จุดคุ้มทุนจะคิดบนความจุที่ไม่มีอยู่จริงทันที */
    + fld(pl.boatId ? 'ความจุ/ลำ (จากทะเบียนเรือ)' : 'ความจุ/ลำ (คน)',
        pl.boatId
          ? ('<input class="ct-in wide" value="' + capPer + '" readonly'
             + ' title="มาจากทะเบียนเรือ ' + ctE((getBoat(pl.boatId) || {}).name || '') + ' · แก้ที่หน้าเรือ"'
             + ' style="background:var(--sd50);color:rgba(74,62,54,.55);cursor:not-allowed">')
          : inp('cap'))
    + fld('จำนวนคนที่คาด', inp('pax', 1), 1) + fld('คนไทยกี่คน', inp('paxTH'))
    /* §ctChd · ราคาเด็กแยกจากผู้ใหญ่ · ว่าง = คิดเท่าผู้ใหญ่ ไม่ใช่ฟรี */
    + fld('ราคาผู้ใหญ่', inp('price'))
    + fld('ราคาเด็ก', '<input class="ct-in wide" data-fk="pl.priceCh" value="' + ctE(pl.priceCh == null ? '' : pl.priceCh)
        + '" placeholder="' + (+pl.price || 0) + '" title="\u0e27\u0e48\u0e32\u0e07 = \u0e04\u0e34\u0e14\u0e40\u0e17\u0e48\u0e32\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e0d\u0e48" oninput="ctPlanSet(\'priceCh\',this.value)">')
    + fld('เด็กกี่ %', inp('chPct'))
    + fld('คอมมิชชั่น %', inp('comm')) + fld('ราคาน้ำมัน ฿/ลิตร', inp('fuel'))
    + '</div>'
    + '<div class="ct-hint" style="padding:0 20px 4px">ราคาผู้ใหญ่ / ราคาเด็ก เป็นราคา<b>รวม VAT</b> เหมือนที่ขายจริง · '
    + '<b>ราคาน้ำมัน</b> ในช่องนี้ P&amp;L จะหยิบไปใช้เมื่อวันนั้นไม่มีราคาจริงเลย (เป็นตัวสำรองชั้นสุดท้าย)</div>'
    + '<div class="ct-hint" style="padding:0 20px 14px">'
    + (+pl.chPct > 0
        ? ('\u0e08\u0e38\u0e14\u0e04\u0e38\u0e49\u0e21\u0e17\u0e38\u0e19\u0e04\u0e34\u0e14\u0e42\u0e14\u0e22\u0e41\u0e15\u0e01\u0e17\u0e38\u0e01\u0e23\u0e2d\u0e1a\u0e40\u0e1b\u0e47\u0e19\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e0d\u0e48/\u0e40\u0e14\u0e47\u0e01\u0e01\u0e48\u0e2d\u0e19 \u00b7 \u0e17\u0e35\u0e48 '
           + pax + ' \u0e04\u0e19 \u0e04\u0e37\u0e2d \u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e0d\u0e48 <b>' + (pax - ctChdAt(pl, pax)) + '</b> \u00b7 \u0e40\u0e14\u0e47\u0e01 <b>' + ctChdAt(pl, pax) + '</b>'
           + ((pl.priceCh == null || pl.priceCh === '')
               ? ' \u00b7 <b style="color:#B45309">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e43\u0e2a\u0e48\u0e23\u0e32\u0e04\u0e32\u0e40\u0e14\u0e47\u0e01 \u00b7 \u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49\u0e04\u0e34\u0e14\u0e40\u0e17\u0e48\u0e32\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e0d\u0e48</b>' : ''))
        : '\u0e15\u0e31\u0e49\u0e07 <b>\u0e40\u0e14\u0e47\u0e01\u0e01\u0e35\u0e48 %</b> \u0e41\u0e25\u0e49\u0e27\u0e08\u0e38\u0e14\u0e04\u0e38\u0e49\u0e21\u0e17\u0e38\u0e19\u0e08\u0e30\u0e04\u0e34\u0e14\u0e23\u0e32\u0e22\u0e44\u0e14\u0e49\u0e41\u0e22\u0e01\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e0d\u0e48/\u0e40\u0e14\u0e47\u0e01\u0e43\u0e2b\u0e49 \u00b7 '
          + '\u0e40\u0e14\u0e47\u0e01 0% = \u0e17\u0e38\u0e01\u0e2b\u0e31\u0e27\u0e08\u0e48\u0e32\u0e22\u0e23\u0e32\u0e04\u0e32\u0e40\u0e14\u0e35\u0e22\u0e27\u0e40\u0e2b\u0e21\u0e37\u0e2d\u0e19\u0e40\u0e14\u0e34\u0e21')
    + '</div></div>';
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:rentHtml) · reads: pl, RN, T, pax, R, cur, cap */
function ctPlanRent(C){
  const { pl, RN, T, pax, R, cur, cap } = C;
  return (function(){
    var BL = (typeof BOATS !== 'undefined' ? BOATS : []).filter(function(b){ return !b.retired; });
    var bid = pl.boatId || '';
    var pick = '<select class="ct-in wide" onchange="ctPlanSet(\'boatId\',this.value)">'
      + '<option value="">— ไม่ปักลำ · ใช้ความจุที่พิมพ์เอง —</option>'
      + BL.map(function(b){
          var rr = ctRentRaw(b.id);
          return '<option value="' + ctE(b.id) + '"' + (bid === b.id ? ' selected' : '') + '>'
            + ctE(b.name) + ' · ' + (+b.cap || 0) + ' ที่นั่ง' + ((rr && rr.on) ? ' · เรือเช่า' : '') + '</option>';
        }).join('') + '</select>';

    var head = '<div class="ct-cath"><span>' + ctIcon('anchor', 15) + '<b>เรือที่ใช้ &amp; ค่าเช่า</b>'
      + '<span class="ct-u" style="margin-left:8px">' + (RN ? ('เรือเช่า · ' + ctB(RN.perTrip) + '/ทริป') : 'เรือของบริษัท') + '</span></span></div>';

    if(!bid) return '<div class="ct-card ct-catcard ct-rent">' + head
      + '<div class="ct-rentbody"><div class="ct-rrow"><label class="ct-f grow"><span>ปักเรือลำที่ใช้</span>' + pick + '</label></div>'
      + '<div class="ct-hint" style="padding:0">ปักลำไว้แล้วความจุจะอิงที่นั่งของลำนั้นเอง · '
      + 'และถ้าลำนั้นเป็น<b>เรือเช่า</b> ค่าเช่าจะเข้าสูตรให้อัตโนมัติ พร้อมตัดบรรทัดที่เจ้าของเรือรับผิดชอบออก</div></div></div>';

    var rr = ctRentRaw(bid) || ctRentBlank();
    var on = !!(rr.on && ctRentRaw(bid));
    var bN = (getBoat(bid) || {}).name || bid;
    var RS = function(k, v, w, ph){
      return '<input class="ct-in" data-fk="rn.' + bid + '.' + k + '" value="' + ((rr[k] == null || rr[k] === 0) && ph != null ? '' : ctE(rr[k]))
        + '" placeholder="' + (ph == null ? 0 : ph) + '" oninput="ctRentSet(\'' + bid + '\',\'' + k + '\',this.value)"'
        + ' style="width:' + (w || 84) + 'px">'; };
    var body = '<div class="ct-rentbody">'
      + '<div class="ct-rrow"><label class="ct-f grow"><span>ปักเรือลำที่ใช้</span>' + pick + '</label>'
      + '<label class="ct-rchk big"><input type="checkbox"' + (on ? ' checked' : '')
        + ' onchange="ctRentSet(\'' + bid + '\',\'on\',this.checked?1:0)"> <b>' + ctE(bN) + ' เป็นเรือเช่า</b></label></div>';

    /* §boatFuel · ขึ้นทั้งเรือเช่าและเรือบริษัท · ความกินน้ำมันไม่ได้ขึ้นกับว่าใครเป็นเจ้าของ */
    var fuelBox = (function(){
      var fl = (T.lines || []).filter(function(x){
        return (x.parts || []).some(function(p){ return p.fuel; }); })[0];
      var baseQ = 0, perPax = 0;
      if(fl){
        var L = ctEffLine(fl, pl);
        (L.parts || []).forEach(function(p){
          if(!p.fuel) return;
          if(p.k === 'fix') baseQ += (pl.eng === '4EN' && p.q4 != null) ? (+p.q4 || 0) : (+p.q || 0);
          else if(p.k === 'var') perPax += (+p.q || 0);
        });
      }
      var mul = (rr.fuelMul == null || rr.fuelMul === '') ? 100 : +rr.fuelMul;
      var m = (mul > 0) ? mul / 100 : 1;
      var totBase = baseQ + perPax * pax, totNow = totBase * m;
      return '<div class="ct-rsec"><div class="ct-rsech">น้ำมัน · ลำนี้กินเท่าไหร่เทียบกับสูตรกลาง</div>'
        + '<div class="ct-rrow">'
        + '<label class="ct-f"><span>เทียบสูตรกลาง</span>'
        + '<input class="ct-in" data-fk="rn.' + bid + '.fuelMul" value="' + ctE(mul) + '"'
        + ' onchange="ctRentSet(\'' + bid + '\',\'fuelMul\',this.value)"'
        + ' oninput="ctRentSet(\'' + bid + '\',\'fuelMul\',this.value)" style="width:78px"></label>'
        + '<span class="ct-u" style="align-self:end;padding-bottom:9px">% · 100 = เท่าสูตรกลาง</span>'
        + '<div class="ct-rcalc" style="flex:1;min-width:220px">สูตรกลาง <b>' + ctN(totBase)
        + ' ลิตร</b>/ทริป ที่ ' + pax + ' คน → ลำนี้ <b>' + ctN(totNow) + ' ลิตร</b>'
        + (m !== 1 ? (' (' + (m > 1 ? '+' : '−') + ctN(Math.abs(totNow - totBase)) + ' ลิตร · '
                      + ctB(Math.abs(totNow - totBase) * (+pl.fuel || 0)) + '/ทริป)') : '')
        + '</div></div>'
        + '<div class="ct-hint" style="padding:0">ตัวคูณนี้ผูกกับ<b>ลำ</b> · ลิตรต่อทริปขึ้นกับ<b>เส้นทาง</b> '
        + '(สิมิลันไกลกว่าพีพีเยอะ) ลำเดียวกันวิ่งสองเส้นทางได้ลิตรคนละเลข แต่ % เท่าเดิม<br>'
        + 'รู้ลิตรจริงของเส้นทางนี้แน่ ๆ → ตั้งที่แท็บ <b>ปรับ / ปิด รายแผน</b> ซึ่งเป็นรายเส้นทาง · สองอันคูณกัน<br>'
        + 'มีผลกับ<b>ค่าประมาณ</b>เท่านั้น · ทริปที่ลงลิตรจริงจากใบงานเรือแล้ว P&amp;L จะใช้ของจริงทับอยู่ดี</div></div>';
    })();

    if(!on){
      body += '<div class="ct-hint" style="padding:0">เรือของบริษัท · คิดค่าเสื่อม กัปตัน เด็กเรือ ตามสูตรกลางเหมือนเดิม</div>'
        + fuelBox + '</div>';
      return '<div class="ct-card ct-catcard ct-rent">' + head + body + '</div>';
    }

    var seats = RN ? RN.seats : (+(getBoat(bid) || {}).cap || 0);
    var md = rr.mode || 'lump';
    body += '<div class="ct-rsec"><div class="ct-rsech">เงื่อนไขสัญญา · เป็นของเรือลำนี้ ใช้ร่วมทุกเส้นทางที่ลำนี้วิ่ง</div>'
      + '<div class="ct-rrow">'
      + '<label class="ct-rchk"><input type="radio" name="rmode"' + (md === 'lump' ? ' checked' : '')
        + ' onchange="ctRentSet(\'' + bid + '\',\'mode\',\'lump\')"> เหมาทั้งลำ</label>'
      + '<label class="ct-rchk"><input type="radio" name="rmode"' + (md === 'seat' ? ' checked' : '')
        + ' onchange="ctRentSet(\'' + bid + '\',\'mode\',\'seat\')"> คิดต่อที่นั่ง × ' + seats + ' ที่นั่ง</label>'
      + '</div><div class="ct-rrow">'
      + (md === 'seat'
          ? ('<label class="ct-f"><span>ค่าเช่า/ที่นั่ง/งวด</span>' + RS('seat', rr.seat, 96) + '</label>')
          : ('<label class="ct-f"><span>ค่าเช่า/งวด (บาท)</span>' + RS('amt', rr.amt, 110) + '</label>'))
      + '<label class="ct-f"><span>วันในงวด</span>' + RS('days', rr.days, 70, 30) + '</label>'
      + '<label class="ct-f"><span>วันหยุดตามตกลง</span>' + RS('off', rr.off, 70, 0) + '</label>'
      + '<label class="ct-f"><span>รอบต่อวัน</span>' + RS('trips', rr.trips, 70, 1) + '</label>'
      + '<label class="ct-rchk" style="align-self:end;padding-bottom:8px"><input type="checkbox"' + (rr.vat ? ' checked' : '')
        + ' onchange="ctRentSet(\'' + bid + '\',\'vat\',this.checked?1:0)"> ค่าเช่ามี VAT ขอคืนได้</label>'
      + '</div>'
      /* §rentSpan · ช่วงสัญญา · ก่อนเริ่ม/หลังจบ เรือกลับไปเป็นเรือปกติเองทั้งชุด */
      + '<div class="ct-rrow">'
      + '<label class="ct-f"><span>สัญญาเริ่ม</span><input type="date" class="ct-in" style="width:150px"'
        + ' data-fk="rn.' + bid + '.from" value="' + ctE(rr.from || '') + '"'
        + ' onchange="ctRentSet(\'' + bid + '\',\'from\',this.value)"></label>'
      + '<label class="ct-f"><span>สัญญาจบ</span><input type="date" class="ct-in" style="width:150px"'
        + ' data-fk="rn.' + bid + '.to" value="' + ctE(rr.to || '') + '"'
        + ' onchange="ctRentSet(\'' + bid + '\',\'to\',this.value)"></label>'
      + '<span class="ct-u" style="align-self:end;padding-bottom:9px">ว่าง = ไม่จำกัด · '
        + 'นอกช่วงนี้ลำนี้คิดแบบเรือบริษัทตามปกติ</span>'
      + '</div>';

    if(RN && RN.amt > 0){
      body += '<div class="ct-rcalc">' + ctB(RN.amt) + ' ÷ (' + RN.days + ' − ' + RN.off + ' วันหยุด) = <b>'
        + ctB(RN.perDay) + '/วันวิ่ง</b>'
        + (RN.trips > 1 ? (' ÷ ' + RN.trips + ' รอบ = <b>' + ctB(RN.perTrip) + '/ทริป</b>') : '')
        + ' · มีให้วิ่ง ' + RN.runDays + ' วัน/งวด</div>';
    } else {
      body += '<div class="ct-rcalc warn">ยังไม่ได้ใส่ค่าเช่า · บรรทัดค่าเช่าจึงยังไม่เข้าสูตร</div>';
    }
    body += '</div>';

    body += fuelBox;                                    /* §boatFuel */

    /* เจ้าของเรือรับผิดชอบอะไรบ้าง · ตั้งต้นตามดีลที่คุยกันไว้ แต่ดีลอื่นเปลี่ยนได้ */
    body += '<div class="ct-rsec"><div class="ct-rsech">เจ้าของเรือรับผิดชอบ · ติ๊กไว้ = ตัดออกจากต้นทุนของเรา</div>'
      + '<div class="ct-rrow">' + CT_RENT_EX.map(function(e){
          return '<label class="ct-rchk" title="' + ctE(e.why) + '"><input type="checkbox"'
            + ((RN && RN.ex[e.id]) ? ' checked' : '')
            + ' onchange="ctRentSet(\'' + bid + '\',\'ex.' + e.id + '\',this.checked?1:0)"> ' + ctE(e.l) + '</label>';
        }).join('') + '</div>'
      + '<div class="ct-hint" style="padding:0">น้ำมันเรือ<b>ไม่อยู่ในลิสต์นี้</b> เพราะผู้เช่าเป็นคนจ่ายเอง · ยังคิดตามสูตรเดิมทุกบาท</div></div>';

    /* จุดคุ้มทุนชั้นที่สอง · กี่วัน/งวด ถึงจะคุ้มค่าเช่าทั้งก้อน
       ชั้นแรก (กี่คนต่อทริป) มีอยู่แล้วในการ์ด KPI · ชั้นนี้คือตัวที่บอกว่า "ควรเช่าไหม" */
    if(RN && RN.amt > 0){
      var rentNetTrip = RN.perTrip * (1 - (RN.vat ? R : 0));
      var rentNetAll  = RN.amt * (1 - (RN.vat ? R : 0));
      var pEx  = cur.p + rentNetTrip;                    /* กำไรต่อทริปก่อนหักค่าเช่า */
      var dNd  = (pEx > 0) ? Math.ceil(rentNetAll / (pEx * RN.trips)) : null;
      var okD  = (dNd != null && dNd <= RN.runDays);
      body += '<div class="ct-rbe' + (okD ? ' ok' : ' bad') + '">'
        + '<span class="ct-rbe-lb">จุดคุ้มทุนของค่าเช่า</span>'
        + (dNd == null
            ? ('<b>ที่ ' + pax + ' คน วิ่งกี่วันก็ไม่คุ้ม</b> · กำไรก่อนค่าเช่าติดลบ ' + ctB(Math.abs(pEx)) + '/ทริป')
            : ('<b>ต้องวิ่ง ' + dNd + ' วัน/งวด</b> ที่ ' + pax + ' คน/ทริป จึงจะคุ้มค่าเช่า '
               + ctB(RN.amt) + ' · มีให้วิ่ง ' + RN.runDays + ' วัน'
               + (okD ? (' · เหลือหายใจ ' + (RN.runDays - dNd) + ' วัน') : ' · <b>เกินจำนวนวันที่มี</b>')))
        + '</div>';
      body += '<div class="ct-hint" style="padding:6px 0 0">'
        + '⚠ <b>P&amp;L รายทริปลงค่าเช่าตามทริปที่วิ่งจริง</b> ไม่ใช่เต็มก้อน · วิ่งน้อยกว่า ' + RN.runDays
        + ' วัน ค่าเช่าจะลงไม่ครบและกำไรจะดูสวยเกินจริง '
        + 'ส่วนที่ขาดคือ<b>ค่าเช่าวันที่เรือไม่ได้วิ่ง</b> ซึ่งไปโผล่ที่ '
        + '<b>P&amp;L รายทริป → รายเดือน → Unabsorbed boat rent</b></div>';

      /* ══ §rentPlan · ตารางวางแผน · "ต้องหาลูกค้ากี่คนต่อเดือน" ══════════════
         คำถามจริงตอนตัดสินใจเช่าไม่ใช่ "ทริปนี้กำไรเท่าไหร่" แต่คือ
         "ทั้งเดือนต้องขายให้ได้กี่หัว ค่าเช่าถึงจะไม่กิน"
         ยิ่งคนต่อทริปเยอะ ยิ่งใช้วันน้อยลง แต่หัวรวมทั้งเดือนอาจไม่ได้ลดตาม
         ตารางนี้จึงโชว์ทั้งสองตัว ให้เลือกได้ว่าจะไล่วันหรือไล่หัว */
      var lv = {}, capAll = cap;
      [0.2, 0.35, 0.5, 0.65, 0.8, 1].forEach(function(f){ lv[Math.max(1, Math.round(capAll * f))] = 1; });
      lv[pax] = 1;
      var levels = Object.keys(lv).map(Number).sort(function(a, b){ return a - b; });
      var prows = levels.map(function(n){
        var pN  = ctProfitAt(pl, n, T).p;
        var pEx = pN + rentNetTrip;                       /* กำไรก่อนแบกค่าเช่า */
        var dN  = (pEx > 0) ? Math.ceil(rentNetAll / (pEx * RN.trips)) : null;
        var ok  = (dN != null && dN <= RN.runDays);
        var heads = ok ? (dN * RN.trips * n) : null;
        var hi = (n === pax);
        return '<tr class="' + (ok ? '' : 'ct-rbad') + (hi ? ' ct-rnow' : '') + '">'
          + '<td><b>' + n + '</b> คน' + (hi ? ' <span class="ct-u">← ที่ตั้งไว้</span>' : '')
            + (n === capAll ? ' <span class="ct-u">เต็มลำ</span>' : '') + '</td>'
          + '<td class="ct-r">' + (pEx >= 0 ? '' : '−') + ctB(Math.abs(pEx)) + '</td>'
          + '<td class="ct-r">' + (dN == null ? '<span class="ct-u">ไม่คุ้ม</span>'
              : (dN + ' วัน' + (ok ? '' : ' <span class="ct-u">เกิน ' + RN.runDays + '</span>'))) + '</td>'
          + '<td class="ct-r"><b>' + (heads == null ? '—' : heads.toLocaleString()) + '</b></td>'
          + '<td class="ct-r">' + (pN >= 0 ? '+' : '−') + ctB(Math.abs(pN)) + '</td></tr>';
      }).join('');
      /* สรุปทั้งสัญญา · ใช้วางแผนทั้งปี ไม่ใช่แค่เดือนเดียว */
      var spanTxt = '';
      if(RN.from && RN.to && RN.to >= RN.from){
        var nd = ctYmdDiff(RN.from, RN.to), tot = RN.perCalDay * nd;
        spanTxt = '<div class="ct-rcalc">ทั้งสัญญา ' + RN.from + ' → ' + RN.to + ' · ' + nd + ' วัน ('
          + (Math.round(nd / 30 * 10) / 10) + ' งวด) · ค่าเช่ารวม <b>' + ctB(tot) + '</b>'
          /* ที่จำนวนคนซึ่งวิ่งกี่วันก็ไม่พอในหนึ่งงวด อย่าไปคูณยาวเป็นทั้งสัญญา
             จะได้เลขวันที่ดูเหมือนทำได้ ทั้งที่งวดหนึ่งยังไม่ผ่านเลย */
          + ' · ที่ ' + pax + ' คน/ทริป '
          + (!okD ? '<b style="color:#9f1239">ไม่คุ้มตั้งแต่งวดแรก</b>'
                  : ('ต้องวิ่งรวม <b>' + Math.ceil(dNd * nd / RN.days) + ' วัน</b> จาก '
                     + Math.round(nd * RN.runDays / RN.days) + ' วันที่มี')) + '</div>';
      } else {
        spanTxt = '<div class="ct-rcalc warn">ยังไม่ได้ใส่ช่วงสัญญา · ใส่แล้วจะคำนวณยอดรวมทั้งสัญญาให้ '
          + 'และเรือจะกลับไปคิดแบบเรือบริษัทเองเมื่อพ้นสัญญา</div>';
      }
      body += '<div class="ct-rsec"><div class="ct-rsech">วางแผน · ต้องหาลูกค้าเท่าไหร่ถึงจะคุ้มค่าเช่า '
        + ctB(RN.amt) + '/งวด</div>'
        + '<div class="ct-rscroll"><table class="ct-rtbl">'
        + '<thead><tr><th>คน/ทริป</th><th class="ct-r">กำไร/ทริป<br><span class="ct-u">ก่อนค่าเช่า</span></th>'
        + '<th class="ct-r">ต้องวิ่ง<br><span class="ct-u">วัน/งวด</span></th>'
        + '<th class="ct-r">ลูกค้าทั้งงวด<br><span class="ct-u">รวมกี่หัว</span></th>'
        + '<th class="ct-r">กำไร/ทริป<br><span class="ct-u">หลังค่าเช่า</span></th></tr></thead>'
        + '<tbody>' + prows + '</tbody></table></div>'
        + spanTxt + '</div>';
    }
    if(+pl.boats > 1){
      body += '<div class="ct-rcalc warn">แผนนี้ตั้งไว้ ' + (+pl.boats) + ' ลำ แต่ค่าเช่าคิดจากสัญญาของลำเดียว · '
        + 'ลำอื่นที่วิ่งด้วยจะไม่มีค่าเช่าในสูตรนี้</div>';
    }
    body += '</div>';
    return '<div class="ct-card ct-catcard ct-rent on">' + head + body + '</div>';
  })();
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:kpi) · reads: be, pl, bePct, cap, pax, cur, vout */
function ctPlanKpi(C){
  const { be, pl, bePct, cap, pax, cur, vout } = C;
  return '<div class="ct-kpis">'
    + '<div class="ct-k mint"><div class="ct-k-top"><div><span class="ct-k-lb">จุดคุ้มทุน · BREAK-EVEN</span>'
      + '<div class="ct-k-v">' + (be ? (be + '<em>คน</em>') : '<span style="font-size:26px">ไม่ถึง</span>') + '</div></div>'
      + '<span class="ct-k-ic">' + ctIcon('chart', 17) + '</span></div>'
      + (be && +pl.chPct > 0
          ? ('<div class="ct-k-row"><span>ส่วนผสมที่จุดคุ้มทุน</span><span>ผู้ใหญ่ ' + (be - ctChdAt(pl, be)) + ' · เด็ก ' + ctChdAt(pl, be) + '</span></div>') : '')
      + '<div class="ct-k-foot"><div class="ct-k-row"><span>อัตราส่วนความจุเรือ</span><span>' + (be ? (bePct + '% ของความจุ ' + cap + ' ที่นั่ง') : ('เต็มลำ ' + cap + ' ที่นั่งก็ยังขาดทุน')) + '</span></div>'
      + '<div class="ct-bar"><i style="width:' + bePct + '%' + (be ? '' : ';background:#e11d48') + '"></i></div></div></div>'
    + '<div class="ct-k brand"><div class="ct-k-top"><div><span class="ct-k-lb">กำไรที่คาดการณ์ · ' + pax + ' คน</span>'
      + '<div class="ct-k-v' + (cur.p < 0 ? ' neg' : '') + '">' + (cur.p >= 0 ? '+' : '') + ctN(cur.p) + '<em>฿</em></div></div>'
      + '<span class="ct-k-ic">' + ctIcon('coins', 17) + '</span></div>'
      + '<div class="ct-k-note"><i></i>Margin <b>' + (cur.rev ? Math.round(cur.p / cur.rev * 100) : 0) + '%</b> ของรายได้สุทธิ</div></div>'
    + '<div class="ct-k plain"><div class="ct-k-top"><div><span class="ct-k-lb">VAT ต้องนำส่ง · NET VAT</span>'
      + '<div class="ct-k-v">' + ctB(Math.max(0, vout - cur.c.vin)) + '</div></div>'
      + '<span class="ct-k-ic">' + ctIcon('receipt', 17) + '</span></div>'
      + '<div class="ct-k-split"><span>ภาษีขาย ' + ctB(vout) + '</span><span>·</span><span>ภาษีซื้อ ' + ctB(cur.c.vin) + '</span></div></div>'
    + '</div>';
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:trows) · reads: pl, cap, T, pax */
function ctPlanTierRows(C){
  const { pl, cap, T, pax } = C;
  return ctTiers(pl).map(function(t, i){
    var pr = +t.p || 0, pl2 = {};
    for(var kk in pl){ if(Object.prototype.hasOwnProperty.call(pl, kk)) pl2[kk] = pl[kk]; }
    pl2.price = pr;
    var b2 = ctBreakEven(pl2, cap, T), r2 = ctProfitAt(pl2, pax, T);
    var rF = ctProfitAt(pl2, cap, T);                       // §ctTierFull · กำไรตอนเต็มลำ
    var mg = r2.rev ? (r2.p / r2.rev * 100) : 0;
    var on = (pr === (+pl.price || 0)), bp = b2 ? Math.min(100, Math.round(b2 / cap * 100)) : 100;
    return '<tr' + (on ? ' class="on"' : '') + '>'
      + '<td><span class="ct-tnm">' + (on ? '<i class="ct-nowdot"></i>' : '')
      + '<input class="ct-in tn" data-fk="tn.' + i + '" value="' + ctE(t.n) + '" oninput="ctTierSet(' + i + ',\'n\',this.value)"></span></td>'
      + '<td class="ct-r"><input class="ct-in tp" data-fk="tp.' + i + '" value="' + pr + '" oninput="ctTierSet(' + i + ',\'p\',this.value)"></td>'
      + '<td class="ct-r"><span class="ct-bev' + (b2 ? '' : ' bad') + '">' + (b2 ? (b2 + ' <em>คน</em>') : 'ไม่คุ้ม') + '</span>'
      + '<span class="ct-cap2' + (b2 ? '' : ' bad') + '"><i style="width:' + bp + '%"></i></span></td>'
      + '<td class="ct-r"><b class="ct-pf' + (r2.p < 0 ? ' neg' : '') + '">' + (r2.p >= 0 ? '+' : '−') + ctB(Math.abs(r2.p)) + '</b></td>'
      + '<td class="ct-r"><b class="ct-pf full' + (rF.p < 0 ? ' neg' : '') + '">' + (rF.p >= 0 ? '+' : '−') + ctB(Math.abs(rF.p)) + '</b></td>'
      + '<td class="ct-r"><span class="ct-mg"><span class="ct-mgb' + (mg < 0 ? ' neg' : '') + '"><i style="width:' + Math.min(100, Math.abs(mg)).toFixed(0) + '%"></i></span>'
      + '<b class="ct-mgv' + (mg < 0 ? ' neg' : '') + '">' + (mg >= 0 ? '' : '−') + Math.abs(mg).toFixed(0) + '%</b></span></td>'
      + '<td class="ct-c">' + (on ? '<span class="ct-nowtx">ใช้อยู่</span>'
          : '<button class="ct-use" title="สลับแผนนี้ไปใช้ราคานั้น" onclick="ctTierUse(' + pr + ')">ใช้ราคานี้</button>') + '</td></tr>';
  }).join('');
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:tier) · reads: pax, cap, trows */
function ctPlanTier(C){
  const { pax, cap, trows } = C;
  return '<div class="ct-card ct-tblcard"><div class="ct-card-h split">'
    + '<div><b>Tier ราคา · 5 ระดับ</b><span class="ct-sub">ต้นทุนชุดเดียวกัน เทียบ 5 ราคาพร้อมกัน</span></div>'
    + '<button class="ct-mini" title="เติมราคา 5 ระดับจากราคาปัจจุบัน" onclick="ctTierSpread()">กระจายจากราคาปัจจุบัน</button></div>'
    + '<div class="ct-scroll"><table class="ct-tbl ct-ttbl"><thead><tr><th>Tier</th><th class="ct-r">ราคา/หัว</th>'
    + '<th class="ct-r">จุดคุ้มทุน</th><th class="ct-r">กำไร · ที่ ' + pax + ' คน</th>'
    + '<th class="ct-r">กำไร · เต็มลำ ' + cap + ' คน</th><th class="ct-r">Margin</th><th class="ct-c"></th></tr></thead>'
    + '<tbody>' + trows + '</tbody></table></div>'
    + '<div class="ct-foot2">คุ้มทุน = จำนวนคนน้อยที่สุดที่กำไรเป็นบวก (ไล่ทีละคน เพราะค่าจ้างเป็นขั้นบันได) · เต็มลำ = ' + cap + ' คน คือเพดานกำไรของราคานั้น · Margin = กำไร ÷ รายได้สุทธิ ที่ ' + pax + ' คน</div></div>';
}
/* lifted out of ctPlanHtml by tools/lift.mjs (var:itin) · reads: irows, km */
function ctPlanItin(C){
  const { irows, km } = C;
  return '<div class="ct-card ct-itcard"><div class="ct-card-h split">'
    + '<div><b>รายละเอียดเส้นทาง</b></div>'
    + '<button class="ct-mini" title="จัดลำดับตามเวลา" onclick="ctItinSort()">เรียงเวลา</button></div>'
    + '<div class="ct-itbody">'
    + '<div class="ct-ihead"><span class="r">เวลา</span><span>กิจกรรม</span><span class="r">กม.</span><span></span></div>'
    + '<div class="ct-itscroll">' + irows + '</div>'
    + '<button class="ct-iadd" onclick="ctItinAdd()">+ เพิ่มบรรทัด</button>'
    + '<div class="ct-ifoot"><span>รวมระยะทาง</span><b>' + (km == null ? '—' : km.toLocaleString()) + ' กม.</b></div>'
    + '</div></div>';
}
function ctPlanHtml(){
  var P = ctPlans();
  if(!_ct.pid || !P.filter(function(x){ return x.id === _ct.pid; }).length) _ct.pid = P[0].id;
  var pl = ctPlan(_ct.pid), T = ctTpl(), R = ctVatR(T);
  var pax = Math.max(1, +pl.pax || 1);
  var capPer = ctPlanSeats(pl);                          /* §boatRent · ปักเรือไว้ = อิงที่นั่งของลำนั้น */
  var cap = Math.max(1, capPer * Math.max(1, +pl.boats || 1));
  var cur = ctProfitAt(pl, pax, T);
  /* §ctChd · ภาษีขายคิดจากยอดขายจริง ซึ่งมีทั้งราคาผู้ใหญ่และราคาเด็ก */
  var _pCh = (pl.priceCh != null && pl.priceCh !== '') ? (+pl.priceCh || 0) : (+pl.price || 0);
  var _nCh = ctChdAt(pl, pax);
  var vout = ((pax - _nCh) * (+pl.price || 0) + _nCh * _pCh) * R;
  var be = ctBreakEven(pl, cap, T);
  var bePct = be ? Math.min(100, Math.round(be / cap * 100)) : 100;

  // ── แถบซ้าย · รายการแผน ──
  var items = ctPlanItems({ P, T });
  var side = '<aside class="ct-side"><div class="ct-side-h">แผนคำนวณ · ' + P.length + '</div>' + items
    + '<button class="ct-addrt" onclick="ctAddPlan()">' + ctIcon('plus', 13) + ' เพิ่มเส้นทาง / แผนคำนวณ</button></aside>';

  // ── หัว · ชื่อแผน + ผูกเส้นทาง + ปุ่ม ──
  /* §ctRoute · ผูกรายเส้นทาง ไม่ใช่รายกลุ่ม · Early OTA กับ by Speedboat อยู่กลุ่มเดียวกัน
     แต่ออกคนละเวลา คนละราคา ไม่มีรถรับส่ง — บังคับให้ใช้ต้นทุนชุดเดียวกันคือผิดทั้งคู่ */
  var head = ctPlanHead({ pl });

  // ── พารามิเตอร์ ──
  var fld = function(t, inner, hot){ return '<label class="ct-f' + (hot ? ' hot' : '') + '"><span>' + t + '</span>' + inner + '</label>'; };
  var inp = function(k, hot){ return '<input class="ct-in wide' + (hot ? ' hot' : '') + '" data-fk="pl.' + k + '" value="' + ctE(pl[k]) + '" oninput="ctPlanSet(\'' + k + '\',this.value)">'; };
  var params = ctPlanParams({ fld, pl, inp, capPer, pax });

  /* ══ §boatRent · การ์ดเรือ & ค่าเช่า ═══════════════════════════════════════
     ค่าเช่าเป็นตัวเลขที่ผู้ใช้ระบุเอง · เลือกได้ว่าเหมาทั้งลำ หรือคิดต่อที่นั่ง
     (ต่อที่นั่งอิงที่นั่งของลำที่ปักไว้ ไม่ใช่เลขที่พิมพ์เอง) */
  var RN = ctRentOf(pl.boatId);
  var rentHtml = ctPlanRent({ pl, RN, T, pax, R, cur, cap });

  /* §ctOd · ของที่ลูกค้าสั่งเพิ่ม · แยกสองช่องทาง แยกรายเส้นทาง (แผน 1 แผน = 1 เส้นทาง)
     ต้นทุนยังมาจากสูตรกลาง · ที่กรอกตรงนี้คือจำนวนที่คาดกับเงินที่บริษัทได้จริงต่อหน่วย */
  var odLines = (T.lines || []).filter(function(ln){ return ln.od; });
  var odHtml = '';
  if(odLines.length){
    var odN = function(v, fk, k, ln, ph){
      var raw = (((pl.od || {})[ln.id] || {})[k]);
      var set = (raw != null && raw !== '');
      return '<input class="ct-in" data-fk="' + fk + '" value="' + (set ? raw : '') + '" '
        + 'placeholder="' + (ph == null ? 0 : ph) + '" '
        + 'title="' + (set ? 'ตั้งไว้เอง · ล้างช่องเพื่อกลับไปใช้ค่าเริ่มต้น ' + (ph == null ? 0 : ph)
                           : 'ยังไม่ได้ตั้ง · ใช้ค่าเริ่มต้น ' + (ph == null ? 0 : ph)) + '" '
        + 'oninput="ctOdSet(\'' + pl.id + '\',\'' + ctE(ln.id) + '\',\'' + k + '\',this.value)" '
        + 'style="width:62px;text-align:right">'; };
    var odRows = odLines.map(function(ln){
      var C = ctOdCfg(pl, ln), pct = ctOdPct(ln), L = ctEffLine(ln, pl);
      var unit = +((L.parts || [])[0] || {}).u || 0;
      var u1 = pct ? 'คน' : 'ลำ';
      var aq = pct ? Math.round(pax * (+C.aQ || 0) / 100) : (+C.aQ || 0);
      var uq = pct ? Math.round(pax * (+C.uQ || 0) / 100) : (+C.uQ || 0);
      var mg = (+C.aR || 0) - unit, mg2 = (+C.uR || 0) - unit;
      var off = L.off || ctGrpCfg(pl, ln.g || 'อื่นๆ').off;
      var F = 'od' + pl.id + ln.id;
      return '<tr' + (off ? ' style="opacity:.45"' : '') + '><td class="ct-nm"><b>' + ctE(ln.l) + '</b>'
        + '<div class="ct-nmsub">ทุน ' + ctB(unit) + '/' + u1 + ' จากสูตร'
          + (off ? ' · <b style="color:#A05A1A">ปิดอยู่</b>' : '') + '</div></td>'
        + '<td style="text-align:right">' + odN(C.aQ, F + 'aQ', 'aQ', ln, (ln.odQ != null ? ln.odQ : 0))
          + '<span class="ct-u"> ' + (pct ? '%' : u1) + '</span></td>'
        + '<td style="text-align:right">' + odN(C.aR, F + 'aR', 'aR', ln, 0) + '</td>'
        + '<td style="text-align:right">' + odN(C.uQ, F + 'uQ', 'uQ', ln, 0)
          + '<span class="ct-u"> ' + (pct ? '%' : u1) + '</span></td>'
        + '<td style="text-align:right">' + odN(C.uR, F + 'uR', 'uR', ln, 0) + '</td>'
        + '<td style="text-align:right"><span class="ct-u">' + (aq + uq) + ' ' + u1 + '</span></td>'
        + '<td style="text-align:right;font-weight:700;color:' + ((mg > 0 || mg2 > 0) ? '#0d7a5f' : 'var(--sd400)') + '">'
          + ((C.aR || C.uR) ? ((mg >= 0 ? '+' : '−') + ctB(Math.abs(mg))) : '—') + '</td></tr>';
    }).join('');
    var odRev = ctOdRev(pl, T, { pax:pax });
    var odCost = 0;
    odLines.forEach(function(ln){
      if(ctGrpCfg(pl, ln.g || 'อื่นๆ').off) return;
      var L = ctEffLine(ln, pl); if(L.off) return;
      odCost += (+((L.parts || [])[0] || {}).u || 0) * ctOdQty(pl, ln, { pax:pax });
    });
    /* §ctOdFold · แถบเดียวตอนปิด · เปิดค่อยกางตาราง
       ตอนแรกวางเป็นการ์ดเต็มความกว้างคั่นระหว่างพารามิเตอร์กับการ์ด KPI แล้วเลย์เอาต์เสีย */
    var odOpen = !!_ct.odOpen;
    odHtml = '<div class="ct-card ct-catcard"><div class="ct-cath" style="cursor:pointer" onclick="ctOdFold()">'
      + '<span><button class="ct-mini" style="margin-right:8px">' + (odOpen ? '&#9660;' : '&#9654;') + '</button>'
      + '<b>ของที่ลูกค้าสั่งเพิ่ม</b>'
      + '<span class="ct-u" style="margin-left:8px">' + odLines.length + ' รายการ · หางยาว · รถรับส่ง</span></span>'
      + '<span class="ct-cnt">ที่ ' + pax + ' คน · ทุน ' + ctB(odCost)
        + ' · รายได้ ' + ctB(odRev) + ' · เหลือ <b style="color:'
        + ((odRev - odCost) >= 0 ? '#0d7a5f' : '#A05A1A') + '">'
        + ((odRev - odCost) >= 0 ? '+' : '−') + ctB(Math.abs(odRev - odCost)) + '</b></span></div>'
      + (odOpen ? ('<div class="ct-scroll"><table class="ct-mtbl">'
      + '<colgroup><col><col style="width:96px"><col style="width:104px"><col style="width:96px"><col style="width:104px"><col style="width:86px"><col style="width:96px"></colgroup>'
      + '<thead><tr><th>รายการ</th>'
      + '<th style="text-align:right">เอเจนต์<br>คาดว่าสั่ง</th><th style="text-align:right">บริษัทได้/หน่วย</th>'
      + '<th style="text-align:right">ขายเพิ่ม<br>คาดว่าสั่ง</th><th style="text-align:right">บริษัทได้/หน่วย</th>'
      + '<th style="text-align:right">รวมที่สั่ง</th><th style="text-align:right">กำไร/หน่วย</th></tr></thead>'
      + '<tbody>' + odRows + '</tbody></table></div>'
      + '<div class="ct-hint">ช่องที่ปล่อยว่าง = ใช้ค่าเริ่มต้นตามที่โชว์จาง ๆ ในช่อง<br>'
      + 'ของพวกนี้ไม่ใช่ต้นทุนของทุกหัว · ลูกค้าสั่งเท่าไหร่คิดเท่านั้น '
      + 'และมีรายได้ของมันเองด้วย จึงไม่ต้องปิดบรรทัดทิ้งอีกต่อไป<br>'
      + '<b>บริษัทได้/หน่วย</b> คือเงินที่เหลือหลังหักค่าคอมแล้ว (ขาย ฿2,500 คอม ฿750 → ใส่ ฿1,750) '
      + 'จึงไม่ต้องตั้งบรรทัดต้นทุนค่าคอมแยก<br>'
      + '<b>P&amp;L รายทริป</b>ไม่ใช้ตัวเลขที่คาดในตารางนี้ · ใช้จำนวนที่สั่งจริงกับเงินที่เก็บได้จริงจากใบจอง</div>') : '')
      + '</div>';
  }

  // ── การ์ดตัวเลขสำคัญ ──
  var kpi = ctPlanKpi({ be, pl, bePct, cap, pax, cur, vout });

  // ── ตารางต้นทุน · แบบกระชับ (§ctCompact) ──
  var gAgg = {}, gOrder = [], gLn = {};
  cur.c.rows.forEach(function(r){
    if(!gAgg[r.g]){ gAgg[r.g] = { fix:0, varr:0, amt:0, vat:0, net:0 }; gOrder.push(r.g); gLn[r.g] = []; }
    var a = gAgg[r.g]; a.fix += r.fix; a.varr += r.varr; a.amt += r.amt; a.vat += r.vatAmt; a.net += r.net;
    gLn[r.g].push(r);
  });
  var gTot = cur.c.gross || 1;
  var _th  = Math.min(Math.max(0, +pl.paxTH || 0), pax);
  var fxCtx = { eng:pl.eng, boats:Math.max(1, +pl.boats || 1), fuel:+pl.fuel || 0, pax:pax, paxTH:_th, paxFR:pax - _th, paxCh:ctChdAt(pl, pax) };
  var fxLn = {}; (T.lines || []).forEach(function(l){ fxLn[l.id] = l; });   // §ctFx
  var maxSh = 0;                                       // §ctHeat · เทียบกับหมวดที่กินเงินมากที่สุดของแผนนี้
  gOrder.forEach(function(g){ var v = gAgg[g].amt / gTot * 100; if(v > maxSh) maxSh = v; });
  var KL = { f:'คงที่', v:'ผันแปร', m:'ผสม' };
  var kOf = function(f, v){ return (f > 0 && v > 0) ? 'm' : (v > 0 ? 'v' : 'f'); };
  var tag = function(k){ return '<span class="ct-tag ' + k + '">' + KL[k] + '</span>'; };
  var nz  = function(v){ return v ? ctN(v) : '<span class="ct-dm">—</span>'; };
  var tr = '';
  gOrder.forEach(function(g){
    var A = gAgg[g], op = !!((_ct.gop || {})[g]);
    var gp = ctGrpCfg(pl, g), pct = +gp.pct || 0, sh = Math.round(A.amt / gTot * 100);
    tr += '<tr class="ct-gr' + (op ? ' op' : '') + '" onclick="ctGrpOpen(\'' + ctE(g) + '\')">'
       +  '<td><span class="ct-gnm"><i class="ct-chev">▶</i>' + ctE(g) + '</span>'
       +  '<span class="ct-pbar"><i style="width:' + sh + '%"></i></span>'
       +  '<span class="ct-share" style="color:' + ctHeat(maxSh ? (A.amt / gTot * 100 / maxSh) : 0)
       +  ';font-weight:' + ctHeatW(maxSh ? (A.amt / gTot * 100 / maxSh) : 0) + '">' + sh + '%</span>'
       +  (pct ? ('<span class="ct-pct">' + (pct > 0 ? '+' : '') + pct + '%</span>') : '') + '</td>'
       +  '<td>' + tag(kOf(A.fix, A.varr)) + '</td><td class="ct-r">' + nz(A.amt) + '</td>'
       +  '<td class="ct-r vat">' + nz(A.vat) + '</td><td class="ct-r">' + nz(A.net) + '</td></tr>';
    gLn[g].forEach(function(r){
      var fx = ctLineFx(fxLn[r.id], pl, fxCtx, ctGrpMul(pl, g));            // §ctFx
      tr += '<tr class="ct-lr' + (op ? ' on' : '') + '"><td>' + ctE(r.l)
         +  (fx ? ('<span class="ct-fx">' + ctE(fx) + '</span>') : '') + '</td><td>' + tag(kOf(r.fix, r.varr)) + '</td>'
         +  '<td class="ct-r">' + nz(r.amt) + '</td><td class="ct-r vat">' + nz(r.vatAmt) + '</td>'
         +  '<td class="ct-r">' + nz(r.net) + '</td></tr>';
    });
  });
  var sf = cur.c.rows.reduce(function(a, r){ return a + r.fix; }, 0);
  var sv = cur.c.rows.reduce(function(a, r){ return a + r.varr; }, 0);
  var allOp = gOrder.length && gOrder.every(function(g){ return (_ct.gop || {})[g]; });
  var tbl = '<div class="ct-card ct-tblcard"><div class="ct-card-h split">'
    + '<div><b>ต้นทุนตามหมวด · ' + pax + ' คน</b><span class="ct-sub">คลิกหมวดเพื่อดูรายการ</span></div>'
    + '<div class="ct-fv"><span>คงที่ <b>' + ctN(sf) + '</b></span><span>·</span><span>ผันแปร <b>' + ctN(sv) + '</b></span>'
    + '<button class="ct-mini" onclick="ctGrpOpenAll()">' + (allOp ? 'หุบทั้งหมด' : 'กางทั้งหมด') + '</button></div></div>'
    + '<div class="ct-scroll"><table class="ct-tbl ct-tbl2"><thead><tr>'
    + '<th>หมวด / รายการ</th><th class="ct-kd">ชนิด</th><th class="ct-r">จ่ายจริง</th>'
    + '<th class="ct-r vat">ภาษีซื้อ</th><th class="ct-r">ต้นทุนสุทธิ</th></tr></thead>'
    + '<tbody>' + tr + '</tbody><tfoot><tr><td>รวมต้นทุนทั้งหมด</td><td></td>'
    + '<td class="ct-r w">' + ctN(cur.c.gross) + '</td><td class="ct-r o">' + ctN(cur.c.vin) + '</td>'
    + '<td class="ct-r big">' + ctN(cur.c.net) + '</td></tr></tfoot></table></div></div>';

  // ── Tier ราคา 5 ระดับ (§ctTier) ──
  var trows = ctPlanTierRows({ pl, cap, T, pax });
  var tier = ctPlanTier({ pax, cap, trows });

  // ── สรุปกำไร (§ctPnl2) ──
  var sr  = function(a, b, cls){ return '<div class="ct-sr' + (cls ? (' ' + cls) : '') + '"><span>' + a + '</span><span>' + b + '</span></div>'; };
  var sr2 = function(a, b){ return '<div class="ct-sr sm"><span>' + a + '</span><span>' + b + '</span></div>'; };
  var pn      = Math.max(1, pax);
  var revPer  = cur.rev / pn, cstPer = cur.c.net / pn, pfPer = cur.p / pn;
  var varPer  = cur.c.varNet / pn, contrib = revPer - varPer;
  var denom   = pn * (1 - R) * (1 - (+pl.comm || 0) / 100);
  var bePrice = (denom > 0) ? (cur.c.net / denom) : 0;
  var sfCls = 'warn', sfTx = 'อยู่พอดีจุดคุ้มทุน';
  if(be == null){ sfCls = 'bad'; sfTx = 'เต็มลำยังไม่คุ้ม'; }
  else if(pax > be){ sfCls = 'ok'; sfTx = 'เกินคุ้มทุน ' + (pax - be) + ' คน (' + Math.round((pax - be) / cap * 100) + '% ของความจุ)'; }
  else if(pax < be){ sfCls = 'bad'; sfTx = 'ขาดอีก ' + (be - pax) + ' คน'; }
  var pnl = '<div class="ct-card ct-pnl">'
    + sr('รายได้ (รวม VAT)', ctB(pax * (+pl.price || 0)))
    + sr('− ภาษีขาย', '−' + ctB(vout))
    + sr('= รายได้สุทธิ' + ((+pl.comm) ? (' (หลังคอม ' + pl.comm + '%)') : ''), ctB(cur.rev))
    + sr('ต้นทุนสุทธิ<small>คงที่ ' + ctB(cur.c.fixNet) + ' + ผันแปร ' + ctB(varPer) + '/คน</small>', '−' + ctB(cur.c.net))
    + '<div class="ct-pblk"><div class="ct-pblkh">ต่อหัว · ' + pax + ' คน</div>'
    +   sr2('รายได้สุทธิ', ctB(revPer)) + sr2('ต้นทุน', ctB(cstPer))
    +   sr2('กำไร', '<b class="ct-pn' + (cur.p < 0 ? ' neg' : '') + '">' + (cur.p >= 0 ? '+' : '−') + ctB(Math.abs(pfPer)) + '</b>')
    + '</div>'
    + '<div class="ct-phl">'
    +   sr2('เหลือจ่ายค่าคงที่ / คน<em title="รายได้สุทธิต่อหัว ลบ ต้นทุนผันแปรต่อหัว · เรือออกอยู่แล้ว รับเพิ่ม 1 คนได้เท่านี้">?</em>', ctB(contrib))
    +   sr2('ราคาต่ำสุดที่ไม่ขาดทุน<em title="ที่ ' + pax + ' คนนี้ ต่ำกว่านี้ขาดทุนทันที">?</em>', ctB(bePrice))
    + '</div>'
    + '<div class="ct-phl ' + sfCls + '">' + sr2('ห่างจุดคุ้มทุน', sfTx) + '</div>'
    + sr('กำไร', (cur.p >= 0 ? '+' : '') + ctB(cur.p), 'tot' + (cur.p < 0 ? ' neg' : '')) + '</div>';

  // ── กราฟกำไรตามจำนวนคน ──
  var pts = [], mx = 0, mn = 0, prev = ctStepCount(pl, 1, T);
  for(var i = 1; i <= cap; i++){
    var pr3 = ctProfitAt(pl, i, T).p, st = ctStepCount(pl, i, T);
    pts.push({ n:i, p:pr3, jump:(i > 1 && st > prev) }); prev = st;
    if(pr3 > mx) mx = pr3; if(pr3 < mn) mn = pr3;
  }
  // §ctItin · คิดเป็น % แทน px เพื่อให้กราฟยืดตามความสูงแถวได้
  var span = (mx - mn) || 1, z = mx / span * 100, bars = '';
  pts.forEach(function(o){
    var hgt = Math.abs(o.p) / span * 100, top = o.p >= 0 ? (z - hgt) : z;
    var cls = (be && o.n === be) ? 'be' : (o.jump ? 'st' : (o.p >= 0 ? 'pos' : 'neg'));
    bars += '<div class="ct-cb" title="' + o.n + ' คน · ' + ctB(o.p) + '"><i class="' + cls
         +  '" style="top:' + top.toFixed(2) + '%;height:' + Math.max(0.4, hgt).toFixed(2) + '%"></i></div>';
  });
  var chart = '<div class="ct-card ct-chart"><div class="ct-card-h"><b>กำไรตามจำนวนคน · 1 ถึง ' + cap + '</b></div>'
    + '<div class="ct-chartbody">'
    + '<div class="ct-plot"><div class="ct-zero" style="top:' + z.toFixed(2) + '%"></div>' + bars + '</div>'
    + '<div class="ct-xax"><span>1</span><span>' + (be ? (be + ' ← คุ้มทุน') : '') + '</span><span>' + cap + ' เต็มลำ</span></div>'
    + '<div class="ct-lg"><span><i class="neg"></i>ขาดทุน</span><span><i class="be"></i>จุดคุ้มทุน</span><span><i class="pos"></i>กำไร</span><span><i class="st"></i>ขั้นบันไดเพิ่ม (ไกด์/เด็กเรือ)</span></div></div></div>';

  // ── รายละเอียดเส้นทาง (§ctItin) ──
  var IA = ctItin(pl), km = ctItinKm(IA);
  var irows = IA.length ? IA.map(function(r, i){
    return '<div class="ct-ir' + (i === IA.length - 1 ? ' hi' : '') + '">'
      + '<input class="ct-iin t" data-fk="it.' + i + '.t" value="' + ctE(r.t) + '" placeholder="เวลา" oninput="ctItinSet(' + i + ',\'t\',this.value)">'
      + '<input class="ct-iin" data-fk="it.' + i + '.a" value="' + ctE(r.a) + '" placeholder="กิจกรรม" oninput="ctItinSet(' + i + ',\'a\',this.value)">'
      + '<input class="ct-iin km" data-fk="it.' + i + '.k" value="' + ctE(r.k) + '" placeholder="—" oninput="ctItinSet(' + i + ',\'k\',this.value)">'
      + '<button class="ct-ix" title="ลบบรรทัดนี้" onclick="ctItinDel(' + i + ')">×</button></div>';
  }).join('') : '<div class="ct-iempty">ยังไม่มีรายการ · กด “เพิ่มบรรทัด”</div>';
  var itin = ctPlanItin({ irows, km });

  return '<div class="ct-wrap">' + side + '<div class="ct-main">' + head + params + rentHtml + kpi
    + '<div class="ct-trio">' + itin + chart + pnl + '</div>'
    + odHtml
    + '<div class="ct-duo">' + tier + tbl + '</div></div></div>';
}
/* ═══ §plCost · แท็บ "ราคาจริง" ═══════════════════════════════════════════════
   สูตรกลางตอบว่า "ทริปแบบนี้ควรต้นทุนเท่าไหร่" · แท็บนี้เก็บ "จริง ๆ จ่ายเท่าไหร่"
   สองอันนี้ต้องอยู่คนละที่ ไม่งั้นพอแก้ราคาจริงวันนี้ ตัวเลขประมาณของเมื่อวานจะขยับตามไปด้วย
   ═══════════════════════════════════════════════════════════════════════════ */
/* §plCost2 · เส้นทางแยกตามท่า · 14 เส้นทางเรียงรวดเดียวหาไม่เจอว่าอันไหนของท่าไหน */
function ctRoutesByPier(){
  var out = [], seen = {};
  var ord = (typeof PO_PIERS !== 'undefined') ? PO_PIERS.map(function(p){ return p.k; }) : ['panwa','tublamu','ranong'];
  var RS = (typeof ROUTES !== 'undefined') ? ROUTES : [];
  ord.forEach(function(pk){
    var rs = RS.filter(function(r){ return (r.pier || '') === pk; });
    if(rs.length){ seen[pk] = 1; out.push({ pier:pk, name:(typeof PIER_LABELS !== 'undefined' ? PIER_LABELS[pk] : '') || pk, routes:rs }); }
  });
  var rest = RS.filter(function(r){ return !seen[r.pier || '']; });
  if(rest.length) out.push({ pier:'', name:'ยังไม่ระบุท่า', routes:rest });
  return out;
}

function ctRealHtml(){
  var e = ctE, B = ctB;

  /* ── ร้านอาหาร ── */
  var vRows = (MEAL_VENUES || []).map(function(v){
    var used = (typeof ROUTES !== 'undefined' ? ROUTES : []).filter(function(r){ return r.mealVenueId === v.id; }).length;
    return '<tr' + (v.active === false ? ' style="opacity:.5"' : '') + '>'
      + '<td><input class="ct-in" data-fk="mvn' + v.id + '" value="' + e(v.name || '') + '" placeholder="ชื่อร้าน" '
        + 'oninput="mvSet(\'' + v.id + '\',\'name\',this.value)" style="width:100%;text-align:left"></td>'
      + '<td><input class="ct-in" data-fk="mvp' + v.id + '" value="' + e(v.place || '') + '" placeholder="เกาะ / จุดจอด" '
        + 'oninput="mvSet(\'' + v.id + '\',\'place\',this.value)" style="width:100%;text-align:left"></td>'
      + '<td>' + ctNum(v.priceAd, 'mva' + v.id, 'mvSet(\'' + v.id + '\',\'priceAd\',this.value)', 66) + '</td>'
      + '<td>' + ctNum(v.priceCh, 'mvc' + v.id, 'mvSet(\'' + v.id + '\',\'priceCh\',this.value)', 66) + '</td>'
      + '<td><input class="ct-in" data-fk="mvt' + v.id + '" value="' + e(v.phone || '') + '" placeholder="เบอร์" '
        + 'oninput="mvSet(\'' + v.id + '\',\'phone\',this.value)" style="width:100%;text-align:left"></td>'
      /* §mealSlip · เวลาเรือถึงร้านโดยประมาณ · ร้านต้องรู้เพื่อเตรียมของ · ตั้งครั้งเดียวใช้ทุกวัน */
      + '<td><input class="ct-in" data-fk="mve' + v.id + '" value="' + e(v.eta || '') + '" placeholder="09:30" '
        + 'title="เวลาที่เรือถึงร้านโดยประมาณ · ไปขึ้นบนใบสั่งอาหาร" '
        + 'oninput="mvSet(\'' + v.id + '\',\'eta\',this.value)" style="width:100%"></td>'
      + '<td class="ct-u">' + (used ? (used + ' เส้นทาง') : '<span style="opacity:.5">ยังไม่ได้ใช้</span>') + '</td>'
      + '<td class="ct-del"><button class="ct-mini" onclick="mvToggle(\'' + v.id + '\')">'
        + (v.active === false ? 'เปิดใช้' : 'ปิด') + '</button></td></tr>';
  }).join('');
  if(!vRows) vRows = '<tr><td colspan="8" class="ct-u" style="padding:14px 4px">ยังไม่มีร้านในทะเบียน · '
    + 'กดปุ่มขวาบนเพื่อเพิ่มร้านแรก</td></tr>';

  var venueSel = function(rid, cur){
    return '<select class="ct-sel" style="width:100%" onchange="mvRouteSet(\'' + rid + '\',this.value)">'
      + '<option value="">— ไม่มีอาหารกลางวัน —</option>'
      + mvList().map(function(v){
          return '<option value="' + e(v.id) + '"' + (cur === v.id ? ' selected' : '') + '>'
            + e(v.name || v.id) + ' · ฿' + (+v.priceAd || 0) + '/' + (+v.priceCh || 0) + '</option>'; }).join('')
      + '</select>';
  };
  var rRows = ctRoutesByPier().map(function(g){
    return '<tr class="ct-pierh"><td colspan="2">' + e(g.name) + ' · ' + g.routes.length + ' เส้นทาง</td></tr>'
      + g.routes.map(function(r){
          return '<tr><td class="ct-nm"><span class="ct-dot" style="background:' + e(r.color || '#64748B') + '"></span>'
            + '<b>' + e(r.name || r.id) + '</b><div class="ct-nmsub">' + e(r.islands || '') + '</div></td>'
            + '<td>' + venueSel(r.id, r.mealVenueId || '') + '</td></tr>'; }).join('');
  }).join('');

  /* ── รถ · คิดตามกลุ่ม ไม่ใช่ตามคัน ── */
  var GS = vanGroups(), PR = ctRoutesByPier();
  _ct.vg = _ct.vg || {};
  var vanRows = GS.map(function(g){
    var opened = !!_ct.vg[g.key];
    var nOvr = 0;
    (Object.keys(((vanRates()[g.key] || {}).rt) || {})).forEach(function(){ nOvr++; });
    var head = '<tr class="ct-vgh"><td class="ct-nm">'
      + '<button class="ct-mini" onclick="ctVanOpen(\'' + e(g.key) + '\')" style="margin-right:8px">'
        + (opened ? '&#9660;' : '&#9654;') + '</button>'
      + '<b>' + e(g.name) + '</b>'
      + '<div class="ct-nmsub">' + g.vans.length + ' คัน · '
        + e(g.vans.slice(0, 5).map(function(v){ return v.name || v.id; }).join(' · '))
        + (g.vans.length > 5 ? (' +' + (g.vans.length - 5)) : '') + '</div></td>'
      + '<td><span class="ct-tag ' + (g.own ? 'fix' : 'step') + '">' + (g.own ? 'ของบริษัท' : 'รถร่วม') + '</span>'
        + (nOvr ? ('<span class="ct-u" style="margin-left:8px">ตั้งแยก ' + nOvr + ' เส้นทาง</span>') : '') + '</td>'
      + '<td>' + ctNum(vanRateRaw(g.key, '', ''), 'vb' + g.key, 'vanRateSet(\'' + e(g.key) + '\',\'\',\'\',this.value)', 76)
        + '<span class="ct-u" style="margin:0 4px">฿/วัน · ราคาฐาน</span>'
        + ((vanRateRaw(g.key, '', '') === '')
            ? ('<span class="ct-u" style="opacity:.65">ยังไม่ตั้ง · ใช้ ฿' + (g.own ? MV_VAN_DEF.own : MV_VAN_DEF.partner) + '</span>') : '')
      + '</td></tr>';
    if(!opened) return head;
    /* ตารางเส้นทาง × โซนรับ · เว้นว่างได้ทุกช่อง จะถอยไปใช้ราคาฐาน */
    var body = PR.map(function(pg){
      return '<tr class="ct-pierh"><td colspan="3">' + e(pg.name) + '</td></tr>'
        + pg.routes.map(function(r){
            var F = function(fld, w){ return ctNum(vanRateRaw(g.key, r.id, fld), 'v' + g.key + r.id + fld,
              'vanRateSet(\'' + e(g.key) + '\',\'' + e(r.id) + '\',\'' + fld + '\',this.value)', w || 68); };
            return '<tr><td class="ct-nm" style="padding-left:26px">'
              + '<span class="ct-dot" style="background:' + e(r.color || '#64748B') + '"></span>'
              + e(r.name || r.id) + '</td>'
              + '<td>' + F('base') + '<span class="ct-u" style="margin-left:5px">ทั้งเส้นทาง</span></td>'
              + '<td><span class="ct-u">PK</span> ' + F('PK')
                + '<span class="ct-u" style="margin-left:10px">KL</span> ' + F('KL') + '</td></tr>'; }).join('');
    }).join('');
    return head + '<tr class="ct-vgb"><td colspan="3"><table class="ct-mtbl">'
      + '<colgroup><col><col style="width:210px"><col style="width:300px"></colgroup><tbody>' + body + '</tbody></table>'
      + '<div class="ct-hint" style="padding:8px 4px 2px">เว้นว่าง = ใช้ราคาฐานของกลุ่ม · '
      + 'ใส่ช่อง <b>ทั้งเส้นทาง</b> ถ้าเส้นทางนี้ราคาเดียวไม่แยกโซน · '
      + 'ใส่ <b>PK / KL</b> เมื่อรับที่ภูเก็ตกับเขาหลักคิดไม่เท่ากัน</div></td></tr>';
  }).join('');
  if(!vanRows) vanRows = '<tr><td colspan="3" class="ct-u" style="padding:14px 4px">ยังไม่มีรถในระบบ</td></tr>';

  return '<div class="ct-card ct-bar2"><div><b>ราคาจริง</b>'
      + '<span class="ct-sub">สูตรกลางตอบว่า<em class="fix">ควรจะ</em>ต้นทุนเท่าไหร่ · หน้านี้เก็บว่า<em class="var">จริง ๆ</em>จ่ายเท่าไหร่ '
      + 'ตอนคิด P&amp;L รายทริป ตัวเลขในหน้านี้จะไปทับตัวประมาณเป็นรายบรรทัด</span></div>'
      + '<div class="ct-bar2r"><button class="ct-btn" onclick="mvAdd()">' + ctIcon('plus', 13) + ' เพิ่มร้านอาหาร</button></div></div>'

    + '<div class="ct-card ct-catcard"><div class="ct-cath"><span>' + ctIcon('folder', 15) + '<b>ทะเบียนร้านอาหาร</b></span>'
      + '<span class="ct-cnt">' + (MEAL_VENUES || []).length + ' ร้าน</span></div>'
      + '<div class="ct-scroll"><table class="ct-mtbl">'
      + '<colgroup><col style="width:22%"><col style="width:19%"><col style="width:88px"><col style="width:88px"><col style="width:14%"><col style="width:82px"><col style="width:100px"><col style="width:62px"></colgroup>'
      + '<thead><tr><th>ร้าน</th><th>จุดจอด</th><th>ผู้ใหญ่</th><th>เด็ก</th><th>ติดต่อ</th><th>เรือถึง</th><th>ใช้กับ</th><th></th></tr></thead>'
      + '<tbody>' + vRows + '</tbody></table></div>'
      + '<div class="ct-hint">ปิดร้านแทนการลบ · ทริปเก่าที่ปิดยอดไปแล้วยังอ่านราคาที่ใช้จริงตอนนั้นได้<br>'
      + '<b>เรือถึง</b> คือเวลาที่เรือถึงร้านโดยประมาณ · ไปขึ้นบนใบสั่งอาหารให้ร้านเตรียมของทัน '
      + 'ระบบรู้แค่เวลาออกจากท่า ไม่เคยรู้เวลาถึงเกาะ</div></div>'

    + '<div class="ct-card ct-catcard"><div class="ct-cath"><span>' + ctIcon('folder', 15) + '<b>ร้านประจำเส้นทาง</b></span>'
      + '<span class="ct-cnt">' + (typeof ROUTES !== 'undefined' ? ROUTES.length : 0) + ' เส้นทาง</span></div>'
      + '<div class="ct-scroll"><table class="ct-mtbl"><colgroup><col><col style="width:300px"></colgroup>'
      + '<tbody>' + rRows + '</tbody></table></div>'
      + '<div class="ct-hint">นี่คือค่าเริ่มต้น · วันไหนร้านเต็มหรือเรือไปไม่ทัน จะเปลี่ยนเฉพาะลำนั้นวันนั้นได้ที่ใบงานเรือ (ก้อนถัดไป)</div></div>'

    + '<div class="ct-card ct-catcard"><div class="ct-cath"><span>' + ctIcon('folder', 15) + '<b>ค่ารถ · คิดตามกลุ่ม</b></span>'
      + '<span class="ct-cnt">' + GS.length + ' กลุ่ม · ' + GS.reduce(function(a, g){ return a + g.vans.length; }, 0) + ' คัน</span></div>'
      + '<div class="ct-scroll"><table class="ct-mtbl"><colgroup><col><col style="width:26%"><col style="width:330px"></colgroup>'
      + '<tbody>' + vanRows + '</tbody></table></div>'
      + '<div class="ct-hint">รถของเจ้าเดียวกันราคาเดียวกัน จึงตั้งเป็นกลุ่ม ไม่ต้องกรอกทีละคัน · '
      + 'ที่ต่างกันจริงคือ<b>ไปท่าไหน</b>และ<b>ไปรับโซนไหน</b> — กดสามเหลี่ยมหน้ากลุ่มเพื่อตั้งแยกรายเส้นทาง<br>'
      + 'เดิมระบบคิดทุกคันเท่ากันที่ ฿1,200 · ไม่ได้ตั้งอะไรเลยจะใช้ ฿' + MV_VAN_DEF.own + ' (ของบริษัท) / ฿'
      + MV_VAN_DEF.partner + ' (รถร่วม)</div></div>';
}
function ctOdFold(){ _ct.odOpen = !_ct.odOpen; ctRender(); }
function ctVanOpen(k){ _ct.vg = _ct.vg || {}; if(_ct.vg[k]) delete _ct.vg[k]; else _ct.vg[k] = 1; ctRender(); }
function ctFamGuess(name){
  var n = String(name || '').toLowerCase();
  for(var i = 0; i < CT_FAMKEY.length; i++){
    var K = CT_FAMKEY[i][1];
    for(var j = 0; j < K.length; j++) if(n.indexOf(K[j]) >= 0) return CT_FAMKEY[i][0];
  }
  return '';
}
/* กลุ่มเส้นทางทั้งหมด พร้อมเส้นทางย่อยที่อยู่ในกลุ่ม · เรียงตามท่า */
function ctMatchFams(){
  var M = {}, ord = [];
  (typeof ROUTES !== 'undefined' ? ROUTES : []).forEach(function(r){
    var f = (typeof bkV2RouteFamily === 'function') ? bkV2RouteFamily(r.id) : null;
    var id = (f && f.id) || r.id;
    if(!M[id]){ M[id] = { id:id, name:(f && f.name) || r.name || r.id,
                          color:(f && f.color) || r.color || '#64748B',
                          pier:r.pier || '', routes:[] }; ord.push(id); }
    M[id].routes.push(r);
  });
  var rank = { panwa:0, tublamu:1, ranong:2 };
  return ord.map(function(k){ return M[k]; }).sort(function(a, b){
    var d = (rank[a.pier] == null ? 9 : rank[a.pier]) - (rank[b.pier] == null ? 9 : rank[b.pier]);
    return d || b.routes.length - a.routes.length;
  });
}
/* ออกจริงกี่ทริปใน 30 วันหลังสุด · ไว้ตัดสินว่าควรทำแผนไหนก่อน */
function ctFamTrips(fam){
  if(typeof TRIPS === 'undefined') return 0;
  var rid = {}; fam.routes.forEach(function(r){ rid[r.id] = 1; });
  var to = (typeof bkV2LocalYMD === 'function') ? bkV2LocalYMD(new Date()) : new Date().toISOString().slice(0, 10);
  var d0 = new Date(to + 'T12:00:00'); d0.setDate(d0.getDate() - 30);
  var from = (typeof bkV2LocalYMD === 'function') ? bkV2LocalYMD(d0) : d0.toISOString().slice(0, 10);
  var n = 0;
  Object.keys(TRIPS).forEach(function(d){
    if(d < from || d > to) return;
    var day = TRIPS[d] || {};
    Object.keys(day).forEach(function(bid){ var op = day[bid]; if(op && op.route && rid[op.route]) n++; });
  });
  return n;
}
function ctPlanOfFam(fid){ return ctPlans().filter(function(p){ return p.famId === fid; })[0] || null; }
/* §ctRoute · ออกจริงกี่ทริปใน 30 วันหลังสุด · รายเส้นทาง ไม่ใช่รายกลุ่ม */
function ctRouteTrips(rid){
  if(typeof TRIPS === 'undefined') return 0;
  var to = (typeof bkV2LocalYMD==='function') ? bkV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10);
  var d0 = new Date(to + 'T12:00:00'); d0.setDate(d0.getDate() - 30);
  var from = (typeof bkV2LocalYMD==='function') ? bkV2LocalYMD(d0) : d0.toISOString().slice(0,10);
  var n = 0;
  Object.keys(TRIPS).forEach(function(d){
    if(d < from || d > to) return;
    var day = TRIPS[d] || {};
    Object.keys(day).forEach(function(bid){ var op = day[bid]; if(op && op.route === rid) n++; });
  });
  return n;
}
function ctRouteFamId(rid){
  var f = (typeof bkV2RouteFamily==='function') ? bkV2RouteFamily(rid) : null;
  return (f && f.id) || '';
}
/* เส้นทางพี่น้องที่จับคู่แผนไว้แล้ว · ใช้แผนเดียวกันได้เลยถ้าต้นทุนเหมือนกันจริง */
function ctSiblingPlan(rid){
  var fam = ctRouteFamId(rid); if(!fam) return null;
  var hit = null;
  (typeof ROUTES !== 'undefined' ? ROUTES : []).forEach(function(r){
    if(hit || r.id === rid || ctRouteFamId(r.id) !== fam) return;
    var p = ctPlanOfFam(r.id); if(p) hit = { route:r, plan:p };
  });
  return hit;
}
/* ผูกแผนเข้ากลุ่ม · หนึ่งกลุ่มหนึ่งแผน · แผนเดิมที่จับคู่ไว้จะถูกปลดให้เอง ไม่ให้ชนกันเงียบ ๆ */
function ctFamSetPlan(fid, pidRaw){
  if(typeof laGuardEdit === 'function' && !laGuardEdit('accounting')) return;
  var pid = String(pidRaw || ''), P = ctPlans();
  P.forEach(function(p){
    if(p.famId === fid) p.famId = '';
    if(pid && p.id === pid) p.famId = fid;
  });
  ctPlansSave(P); ctRender();
}
/* สร้างแผนใหม่จากสูตรกลาง แล้วผูกให้เลย · เริ่มจากศูนย์ทุกครั้งคือสาเหตุที่ไม่มีใครทำสักที */
function ctFamNewPlan(fid){
  if(typeof laGuardEdit === 'function' && !laGuardEdit('accounting')) return;
  var R0 = (typeof getRoute==='function') ? getRoute(fid) : null;
  var F = ctMatchFams().filter(function(f){ return f.id === fid; })[0];
  var q = ctBlankPlan(R0 ? (R0.name || fid) : (F ? F.name : fid));
  q.famId = fid;
  var P = ctPlans(); P.push(q); ctPlansSave(P);
  _ct.pid = q.id; _ct.tab = 'ovr'; ctRender();
}
/* ราคาน้ำมันล่าสุดที่เคยกรอก · ใช้เป็นฉากหลังตอนเทียบต้นทุน/หัว ไม่ใช่ตัวเลขที่เอาไปคิดเงินจริง */
function ctRefFuel(){
  try{
    if(typeof FL_FUEL_PRICE === 'undefined') return 32;
    var ks = Object.keys(FL_FUEL_PRICE).sort();
    for(var i = ks.length - 1; i >= 0; i--){
      var o = FL_FUEL_PRICE[ks[i]] || {};
      var vs = Object.keys(o).map(function(k){ return +o[k] || 0; }).filter(function(x){ return x > 0; });
      if(vs.length) return vs[0];
    }
  }catch(_){ }
  return 32;
}
function ctCostPerHead(plan){
  var T = ctTpl();
  var ctx = { eng:'3EN', boats:1, fuel:ctRefFuel(), pax:CT_REF_PAX, paxTH:0, paxFR:CT_REF_PAX };
  var C = ctCalc(plan || {}, ctx, T);
  return C.net / CT_REF_PAX;
}
function ctMatchHtml(){
  var e = ctE, B = ctB, P = ctPlans(), FAMS = ctMatchFams();
  var RTS = (typeof ROUTES !== 'undefined' ? ROUTES : []);
  var base = ctCostPerHead(null), fuel = ctRefFuel();
  var nLinked = RTS.filter(function(r){ return !!ctPlanOfFam(r.id); }).length;
  var PIERTH = { panwa:'วิสิษฐ์พันวา', tublamu:'ทับละมุ', ranong:'ระนอง' };

  /* §ctRoute · หนึ่งแถวหนึ่งเส้นทางจริง · จัดกลุ่มตามท่าไว้ให้กวาดตาหาง่ายเท่านั้น
     ไม่ได้แปลว่าเส้นในท่าเดียวกันต้องใช้แผนเดียวกัน */
  var rows = ctRoutesByPier().map(function(g){
    return '<tr class="ct-pierh"><td colspan="5">' + e(g.name) + ' · ' + g.routes.length + ' เส้นทาง</td></tr>'
      + g.routes.map(function(r){
    var pl = ctPlanOfFam(r.id), nT = ctRouteTrips(r.id);
    var fam = ctRouteFamId(r.id);
    var sug = null, sib = null;
    if(!pl){
      sug = P.filter(function(p){ return !p.famId && fam && ctFamGuess(p.name) === fam; })[0] || null;
      sib = ctSiblingPlan(r.id);
    }
    var sel = '<select class="ct-sel" style="width:100%" onchange="ctFamSetPlan(\'' + e(r.id) + '\',this.value)">'
      + '<option value="">— ยังไม่จับคู่ · ใช้สูตรกลาง —</option>'
      + P.map(function(p){
          /* หนึ่งแผนใช้ได้หลายเส้นทาง · ไม่ต้องกันไว้ให้เส้นเดียวเหมือนตอนจับเป็นกลุ่ม */
          var used = p.famId && p.famId !== r.id;
          var un = used ? (typeof getRoute==='function' ? ((getRoute(p.famId)||{}).name || p.famId) : p.famId) : '';
          return '<option value="' + e(p.id) + '"' + ((pl && pl.id === p.id) ? ' selected' : '') + '>'
            + e(p.name || p.id) + (used ? (' · ใช้กับ ' + e(un)) : '') + '</option>'; }).join('')
      + '</select>';
    var below = pl
      ? ('<div class="ct-sug ct-ok">' + ctIcon('link', 11) + ' ผูกแล้ว · '
         + '<button class="ct-mini" onclick="ctPickPlan(\'' + e(pl.id) + '\');ctSetTab(\'ovr\')" style="margin-left:5px">แก้แผนนี้</button></div>')
      : ('<div class="ct-sug">'
         + (sug ? ('น่าจะใช่ <b>' + e(sug.name) + '</b> '
                   + '<button class="ct-mini" onclick="ctFamSetPlan(\'' + e(r.id) + '\',\'' + e(sug.id) + '\')" style="margin-left:5px">ใช้แผนนี้</button> ') : '')
         + (sib ? ('<button class="ct-mini" onclick="ctFamSetPlan(\'' + e(r.id) + '\',\'' + e(sib.plan.id) + '\')" '
                   + 'title="ใช้แผนเดียวกับ ' + e(sib.route.name || sib.route.id) + '">'
                   + 'ใช้แผนของ ' + e(sib.route.name || sib.route.id) + '</button> ') : '')
         + '<button class="ct-mini" onclick="ctFamNewPlan(\'' + e(r.id) + '\')">+ สร้างแผนจากสูตรกลาง</button></div>');

    var cph, nOvr = pl ? Object.keys(pl.ovr || {}).length : 0;
    if(pl){
      var v = ctCostPerHead(pl), d = v - base;
      cph = '<b>' + B(Math.round(v)) + '</b><div class="ct-u">'
          + (Math.abs(d) < 1 ? 'เท่าสูตรกลาง'
             : ((d > 0 ? 'สูงกว่า' : 'ต่ำกว่า') + 'สูตรกลาง ' + B(Math.round(Math.abs(d)))))
          + '</div>';
    } else {
      cph = '<span class="ct-nolink">' + B(Math.round(base)) + '</span><div class="ct-u">สูตรกลาง</div>';
    }

    return '<tr class="ct-mrow"><td class="ct-nm">'
      + '<div class="ct-fam"><span class="ct-dot" style="background:' + e(r.color || '#64748B') + '"></span>'
      + '<b>' + e(r.name || r.id) + '</b></div>'
      + '<div class="ct-nmsub">' + e(r.id) + (r.islands ? (' · ' + e(r.islands)) : '') + '</div></td>'
      + '<td style="text-align:right"><b>' + (nT || '–') + '</b><div class="ct-u">ทริป/30 วัน</div></td>'
      + '<td>' + sel + below + '</td>'
      + '<td style="text-align:right">' + cph + '</td>'
      + '<td style="text-align:right">'
      + (pl ? ('<span class="ct-tag m">จับคู่แล้ว</span>'
               + '<div class="ct-u">ปรับไว้ ' + nOvr + ' บรรทัด</div>')
            : '<span class="ct-tag f">ยังไม่จับคู่</span>')
      + '</td></tr>';
      }).join('');
  }).join('');

  /* แผนที่ยังลอยอยู่ · ไม่ผูกกับกลุ่มไหนเลย = P&L ไม่มีวันหยิบไปใช้ */
  var loose = P.filter(function(p){ return !p.famId; });
  var looseHtml = loose.length
    ? ('<div class="ct-card ct-catcard"><div class="ct-cath"><span>' + ctIcon('folder', 15)
       + '<b>แผนที่ยังลอยอยู่</b></span>'
       + '<span class="ct-cnt">' + loose.length + ' แผน</span></div>'
       + '<div class="ct-scroll"><table class="ct-mtbl"><colgroup><col><col style="width:150px"><col style="width:230px"></colgroup><tbody>'
       + loose.map(function(p){
           var g = ctFamGuess(p.name), F = FAMS.filter(function(x){ return x.id === g; })[0];
           return '<tr><td class="ct-nm"><b>' + e(p.name || p.id) + '</b>'
             + '<div class="ct-nmsub">ปรับจากสูตรกลาง ' + Object.keys(p.ovr || {}).length + ' บรรทัด'
             + (Object.keys(p.grp || {}).length ? (' · ปรับทั้งหมวด ' + Object.keys(p.grp).length + ' หมวด') : '')
             + '</div></td>'
             + '<td style="text-align:right"><b>' + B(Math.round(ctCostPerHead(p))) + '</b><div class="ct-u">ต่อหัว ที่ ' + CT_REF_PAX + ' หัว</div></td>'
             + '<td>' + (F
                 ? ('<button class="ct-mini" onclick="ctFamSetPlan(\'' + e(F.id) + '\',\'' + e(p.id) + '\')">'
                    + 'ผูกกับ ' + e(F.name) + '</button>')
                 : '<span class="ct-u">ยังเดาไม่ออกว่าเป็นเส้นทางไหน · เลือกจากช่องด้านบน</span>')
             + '</td></tr>'; }).join('')
       + '</tbody></table></div>'
       + '<div class="ct-hint">แผนที่ไม่ได้ผูกกับกลุ่มไหนเลย ใช้ได้แค่ในหน้านี้ · '
       + 'P&amp;L จะไม่หยิบไปใช้เลย</div></div>')
    : '';

  return '<div class="ct-card ct-bar2"><div><b>จับคู่เส้นทาง</b>'
      + '<span class="ct-sub">เส้นทางไหนใช้แผนไหน · ตัดสินที่นี่ที่เดียว '
      + 'แล้ว <em class="var">P&amp;L รายทริป</em> จะหยิบแผนนั้นไปคิดให้เอง</span></div>'
      + '<div class="ct-bar2r"><span class="ct-u">จับคู่แล้ว <b>' + nLinked + '</b> จาก ' + RTS.length + ' เส้นทาง</span></div></div>'

    + (nLinked < RTS.length
        ? ('<div class="ct-warn"><div class="wi">!</div><div>'
           + '<b>ยังเหลืออีก ' + (RTS.length - nLinked) + ' เส้นทางที่ยังไม่ได้จับคู่แผน</b>'
           + '<p>เส้นที่ยังไม่จับคู่ ทุกทริปจะคิดต้นทุนด้วย<b>สูตรกลางชุดเดียวกันหมด</b> '
           + '— เส้นที่วิ่งไกลกว่า กินข้าวแพงกว่า จอดคนละท่า ก็คิดเท่ากันหมด<br>'
           + 'P&amp;L จะขึ้นป้ายเหลืองบนการ์ดของเรือทุกลำที่วิ่งเส้นเหล่านี้ ไม่แอบใช้เงียบ ๆ</p></div></div>')
        : '')

    + '<div class="ct-card ct-catcard"><div class="ct-cath"><span>' + ctIcon('folder', 15)
      + '<b>เส้นทาง → แผนต้นทุน</b></span>'
      + '<span class="ct-cnt">' + RTS.length + ' เส้นทาง</span></div>'
      + '<div class="ct-scroll"><table class="ct-mtbl">'
      + '<colgroup><col><col style="width:88px"><col style="width:320px"><col style="width:120px"><col style="width:120px"></colgroup>'
      + '<thead><tr><th>เส้นทาง</th><th style="text-align:right">ออกจริง</th>'
      + '<th>แผนต้นทุนที่ใช้</th><th style="text-align:right">ต้นทุน/หัว</th>'
      + '<th style="text-align:right">สถานะ</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + '<div class="ct-hint">หนึ่งแถวคือ<b>หนึ่งเส้นทางจริง</b> · '
      + 'เส้นที่ต้นทุนเหมือนกันจริง กดปุ่ม “ใช้แผนของ …” ผูกแผนเดียวกันได้ · '
      + 'ต่างเมื่อไหร่ค่อยแยกแผน ไม่ต้องรื้อโครง<br>'
      + '<b>ต้นทุน/หัว</b> คิดที่ ' + CT_REF_PAX + ' หัว น้ำมัน ฿' + fuel + ' เรือ 3 เครื่อง '
      + '· เป็นตัวเทียบเฉย ๆ ไว้ดูความต่างระหว่างแผน ไม่ใช่ตัวเลขที่เอาไปคิดเงินจริง</div></div>'

    + looseHtml;
}

function ctPickPlan(id){ _ct.pid = id; ctRender(); }
function ctTierSeed(price){
  var p = +price || 0;
  return CT_TIER_NAMES.map(function(nm, i){ return { n:nm, p:Math.round(p * CT_TIER_MULT[i] / 10) * 10 }; });
}
function ctTiers(pl){
  if(pl && Array.isArray(pl.tiers) && pl.tiers.length === 5) return pl.tiers;
  return ctTierSeed(pl && pl.price);
}
function ctTierSet(i, k, v){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  var A = ctTiers(pl).map(function(x){ return { n:x.n, p:x.p }; });
  if(!A[i]) return;
  A[i][k] = (k === 'n') ? String(v || '') : (+v || 0);
  pl.tiers = A; ctPlanPut(pl); ctRender();
}
function ctTierSpread(){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  var old = ctTiers(pl), fresh = ctTierSeed(pl.price);
  pl.tiers = fresh.map(function(x, i){ return { n:(old[i] && old[i].n) || x.n, p:x.p }; });   // เก็บชื่อเดิมไว้
  ctPlanPut(pl); ctRender();
}
function ctTierUse(p){ ctPlanSet('price', p); }
// §ctItin · รายละเอียดเส้นทางรายแผน · [{t:เวลา, a:กิจกรรม, k:กม.}]
function ctItin(pl){ return (pl && Array.isArray(pl.itin)) ? pl.itin : []; }
function _ctItinPut(A){ var pl = ctPlan(_ct.pid); if(!pl) return; pl.itin = A; ctPlanPut(pl); ctRender(); }
function ctItinSet(i, k, v){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  var A = ctItin(pl).map(function(x){ return { t:x.t, a:x.a, k:x.k }; });
  if(!A[i]) return;
  A[i][k] = String(v == null ? '' : v);
  _ctItinPut(A);
}
function ctItinAdd(){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  var A = ctItin(pl).map(function(x){ return { t:x.t, a:x.a, k:x.k }; });
  A.push({ t:'', a:'', k:'' }); _ctItinPut(A);
}
function ctItinDel(i){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  var A = ctItin(pl).map(function(x){ return { t:x.t, a:x.a, k:x.k }; });
  A.splice(i, 1); _ctItinPut(A);
}
function ctItinSort(){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  var A = ctItin(pl).map(function(x){ return { t:x.t, a:x.a, k:x.k }; });
  A.sort(function(a, b){ return String(a.t || '').localeCompare(String(b.t || '')); });
  _ctItinPut(A);
}
function ctItinKm(A){
  var t = 0, n = 0;
  (A || []).forEach(function(r){ var v = parseFloat(r.k); if(!isNaN(v)){ t += v; n++; } });
  return n ? (Math.round(t * 10) / 10) : null;
}
// §ctCompact · กาง/หุบหมวดในตารางรายละเอียด
function ctGrpOpen(g){ _ct.gop = _ct.gop || {}; if(_ct.gop[g]) delete _ct.gop[g]; else _ct.gop[g] = 1; ctRender(); }
function ctGrpOpenAll(){
  var T = ctTpl(), G = ctGroups(T), o = _ct.gop || {};
  var every = G.length && G.every(function(g){ return o[g]; });
  _ct.gop = {}; if(!every) G.forEach(function(g){ _ct.gop[g] = 1; });
  ctRender();
}
function ctPlanSet(k, v){
  var pl = ctPlan(_ct.pid); if(!pl) return;
  pl[k] = (k === 'name' || k === 'eng' || k === 'famId' || k === 'note' || k === 'boatId')   /* §boatRent */
        ? v : ((v === '') ? 0 : (+v || 0));
  ctPlanPut(pl); ctRender();
}
// §ctAllKeys · ตั้งค่าของแผนที่ระบุ pid ตรงๆ ใช้จากหัวคอลัมน์ในแท็บปรับ/ปิด
function ctPlanSetOn(pid, k, v){
  var pl = ctPlan(pid); if(!pl) return;
  pl[k] = (v === '') ? 0 : (+v || 0);
  if(k === 'pax' && pl.pax < 1) pl.pax = 1;
  if(+pl.paxTH > +pl.pax) pl.paxTH = +pl.pax;
  ctPlanPut(pl); ctRender();
}
function ctAddPlan(){ var p = ctBlankPlan('เส้นทางที่ ' + (ctPlans().length + 1)); var P = ctPlans(); P.push(p); ctPlansSave(P); _ct.pid = p.id; ctRender(); }
function ctDupPlan(){
  var src = ctPlan(_ct.pid); if(!src) return;
  var q = JSON.parse(JSON.stringify(src)); q.id = ctNewId(); q.name = src.name + ' (คัดลอก)';
  var P = ctPlans(); P.push(q); ctPlansSave(P); _ct.pid = q.id; ctRender();
}
function ctDelPlan(){
  var P = ctPlans(); if(P.length <= 1){ alert('ต้องเหลืออย่างน้อย 1 แผน'); return; }
  var pl = ctPlan(_ct.pid); if(!confirm('ลบแผน "' + pl.name + '" ?')) return;
  P = P.filter(function(x){ return x.id !== pl.id; }); ctPlansSave(P); _ct.pid = P[0].id; ctRender();
}

// ── แท็บ 2 · สูตรกลาง · การ์ดต่อหมวด ─────────────────────────────────────────────────────────────
function ctTplHtml(){
  var T = ctTpl(), GL = ctGroups(T);
  var sel = function(v, opts, on, cls){
    return '<select class="ct-sel' + (cls ? (' ' + cls) : '') + '" onchange="' + on + '">'
      + opts.map(function(o){ return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  };
  var body = GL.map(function(g){
    var rows = '';
    (T.lines || []).forEach(function(ln, li){
      if((ln.g || 'อื่นๆ') !== g) return;
      var pp = '';
      (ln.parts || []).forEach(function(p, pi){
        var F = 'p' + li + '.' + pi + '.';
        pp += '<div class="ct-part">'
          + sel(p.k, [['fix','คงที่'],['var','ผันแปร'],['step','ขั้นบันได']], 'ctPartKind(' + li + ',' + pi + ',this.value)');
        if(p.k === 'fix'){
          pp += '<span class="ct-tag fix">คงที่</span>'
            + sel(p.per || 'boat', [['boat','ต่อลำ'],['trip','ต่อทริป']], 'ctPartSet(' + li + ',' + pi + ',\'per\',this.value)')
            + '<span class="ct-u">จำนวน</span>' + ctNum(p.q, F + 'q', 'ctPartSet(' + li + ',' + pi + ',\'q\',this.value)', 58)
            + (p.fuel ? '<span class="ct-u">ลิตร × ฿/L</span>' : '<span class="ct-u">×</span>' + ctNum(p.u, F + 'u', 'ctPartSet(' + li + ',' + pi + ',\'u\',this.value)'))
            + ((p.q4 != null || p.u4 != null)
                ? '<span class="ct-u en4">4EN</span>'
                  + (p.q4 != null ? ctNum(p.q4, F + 'q4', 'ctPartSet(' + li + ',' + pi + ',\'q4\',this.value)', 58) : '')
                  + (p.u4 != null ? ctNum(p.u4, F + 'u4', 'ctPartSet(' + li + ',' + pi + ',\'u4\',this.value)') : '')
                : '<button class="ct-mini" onclick="ctAddEng(' + li + ',' + pi + ')">+ ค่า 4EN</button>');
        } else if(p.k === 'var'){
          pp += '<span class="ct-tag var">ผันแปร</span><span class="ct-u">ต่อคน</span>'
            + (p.fuel ? ctNum(p.q, F + 'q', 'ctPartSet(' + li + ',' + pi + ',\'q\',this.value)', 58) + '<span class="ct-u">ลิตร × ฿/L</span>'
                      : ctNum(p.u, F + 'u', 'ctPartSet(' + li + ',' + pi + ',\'u\',this.value)')
                        + (p.uTH != null ? '<span class="ct-u th">คนไทย</span>' + ctNum(p.uTH, F + 'uTH', 'ctPartSet(' + li + ',' + pi + ',\'uTH\',this.value)')
                                         : '<button class="ct-mini" onclick="ctAddTH(' + li + ',' + pi + ')">+ ราคาคนไทย</button>')
                        /* §ctChd · เด็กจ่ายน้อยกว่าเกือบทุกบรรทัด · ไม่ตั้ง = คิดเท่าผู้ใหญ่ ไม่ใช่ฟรี */
                        + (p.uCh != null ? '<span class="ct-u ch">เด็ก</span>' + ctNum(p.uCh, F + 'uCh', 'ctPartSet(' + li + ',' + pi + ',\'uCh\',this.value)')
                                         : '<button class="ct-mini" onclick="ctAddCh(' + li + ',' + pi + ')">+ ราคาเด็ก</button>')
                        + ((p.uCh != null && p.uTH != null)
                            ? (p.uChTH != null ? '<span class="ct-u ch">เด็กไทย</span>' + ctNum(p.uChTH, F + 'uChTH', 'ctPartSet(' + li + ',' + pi + ',\'uChTH\',this.value)')
                                               : '<button class="ct-mini" onclick="ctAddChTH(' + li + ',' + pi + ')">+ ราคาเด็กไทย</button>')
                            : ''));
        } else {
          pp += '<span class="ct-tag step">ขั้นบันได</span>'
            + sel(p.mode || 'every', [['every','ทุกๆ N คน'],['over','เมื่อเกิน N คน']], 'ctPartSet(' + li + ',' + pi + ',\'mode\',this.value)');
          if(p.mode === 'over') pp += '<span class="ct-u">เกิน</span>' + ctNum(p.over, F + 'over', 'ctPartSet(' + li + ',' + pi + ',\'over\',this.value)', 58)
                + '<span class="ct-u">คน → +</span>' + ctNum(p.add, F + 'add', 'ctPartSet(' + li + ',' + pi + ',\'add\',this.value)', 48);
          else pp += '<span class="ct-u">1 คนต่อทุก</span>' + ctNum(p.every, F + 'every', 'ctPartSet(' + li + ',' + pi + ',\'every\',this.value)', 58)
                + '<span class="ct-u">คน · ขั้นต่ำ</span>' + ctNum(p.min, F + 'min', 'ctPartSet(' + li + ',' + pi + ',\'min\',this.value)', 48);
          pp += '<span class="ct-u">×</span>' + ctNum(p.u, F + 'u', 'ctPartSet(' + li + ',' + pi + ',\'u\',this.value)');
        }
        pp += '<button class="ct-x" title="ลบส่วนนี้" onclick="ctDelPart(' + li + ',' + pi + ')">&times;</button></div>';
      });
      pp += '<button class="ct-mini dash" onclick="ctAddPart(' + li + ')">+ เพิ่มส่วนประกอบ</button>';
      rows += '<tr><td class="ct-nm">'
        + '<input class="ct-lname" data-fk="n' + li + '" value="' + ctE(ln.l) + '" oninput="ctLineName(' + li + ',this.value)">'
        + '<div class="ct-nmsub">'
        + '<select class="ct-catsel" onchange="ctLineGroup(' + li + ',this.value)" title="ย้ายบรรทัดนี้ไปหมวดอื่น">'
        + GL.map(function(x){ return '<option value="' + ctE(x) + '"' + (x === g ? ' selected' : '') + '>' + ctE(x) + '</option>'; }).join('')
        + '<option value="__new">+ หมวดใหม่…</option></select>'
        + '<label class="ct-vat' + (ln.vat ? ' on' : '') + '" title="บรรทัดนี้มีใบกำกับภาษีเต็มรูป · เอาภาษีซื้อไปหักภาษีขายได้">'
        + '<input type="checkbox"' + (ln.vat ? ' checked' : '') + ' onchange="ctLineVat(' + li + ',this.checked)">ขอคืน VAT</label>'
        + '</div></td><td>' + pp + '</td>'
        + '<td class="ct-del"><button class="ct-x" title="ลบรายการ" onclick="ctDelLine(' + li + ')">' + ctIcon('trash', 14) + '</button></td></tr>';
    });
    var cnt = (T.lines || []).filter(function(l){ return (l.g || 'อื่นๆ') === g; }).length;
    return '<div class="ct-card ct-catcard"><div class="ct-cath">'
      + '<span>' + ctIcon('folder', 15) + '<b>' + ctE(g) + '</b>'
      + '<button class="ct-ren" title="เปลี่ยนชื่อหมวด (มีผลทุกบรรทัดในหมวด)" onclick="ctRenameGroup(\'' + ctE(g) + '\')">&#9998;</button></span>'
      + '<span class="ct-cnt">' + cnt + ' รายการ</span></div>'
      + '<div class="ct-scroll"><table class="ct-mtbl"><colgroup><col style="width:230px"><col><col style="width:44px"></colgroup><tbody>' + rows + '</tbody></table></div></div>';
  }).join('');

  return '<div class="ct-card ct-bar2"><div><b>จัดการสูตรกลาง</b>'
    + '<span class="ct-sub">สูตรนี้เป็นค่าตั้งต้นของทุกแผน · 1 บรรทัดประกอบจากหลายส่วนได้ '
    + '<em class="fix">คงที่</em> ต่อลำ/ทริป · <em class="var">ผันแปร</em> ต่อคน · <em class="step">ขั้นบันได</em> เพิ่มเป็นช่วง</span></div>'
    + '<div class="ct-bar2r"><span class="ct-vatset">VAT ของกิจการ ' + ctNum(T.vatRate, 'vat', 'ctVatSet(this.value)', 52) + ' %</span>'
    + '<button class="ct-btn ghost" onclick="ctResetTpl()">คืนค่าเริ่มต้น</button>'
    + '<button class="ct-btn" onclick="ctAddLine()">' + ctIcon('plus', 13) + ' เพิ่มรายการต้นทุน</button></div></div>'
    + body;
}

// ── แท็บ 3 · ปรับ / ปิด รายแผน ───────────────────────────────────────────────────────────────────
// §ctOvrAll (2026-08-02) · ค่าที่ทับรายแผนได้ของ 1 บรรทัด
//   เดิมหน้าจอเปิดให้ทับแค่ "ค่าแรกของส่วนประกอบแรก" ซึ่งไม่พอกับของจริง —
//   อุทยานทับได้แต่ราคาต่างชาติ (ราคาไทยทับไม่ได้) · น้ำมันทับได้แต่ลิตรคงที่
//   (4EN กับส่วนผันแปรต่อคนทับไม่ได้) · ไกด์ทับได้แต่ช่วงคน (ค่าจ้างทับไม่ได้)
//   เครื่องคำนวณ (ctEffLine) รองรับ o.p[i][key] ทุกตัวอยู่แล้ว ขาดแค่หน้าจอ
//   ตัวแรกของลิสต์ = ค่าหลักที่โชว์ในช่องกะทัดรัด · ที่เหลือซ่อนใต้ปุ่มกดขยาย
function ctPartKeys(p){
  if(p.k === 'fix') return p.fuel ? [['q','ลิตร/ลำ'],['q4','ลิตร/ลำ · 4EN']]
                                  : [['u','ราคา/หน่วย'],['q','จำนวน'],['u4','ราคา · 4EN'],['q4','จำนวน · 4EN']];
  if(p.k === 'var') return p.fuel ? [['q','ลิตร/คน']]
                                  : [['u','ผู้ใหญ่ · ต่างชาติ'],['uTH','ผู้ใหญ่ · ไทย'],
                                     ['uCh','เด็ก · ต่างชาติ'],['uChTH','เด็ก · ไทย']];
  return (p.mode === 'over') ? [['over','เกิน N คน'],['add','เพิ่มกี่คน'],['u','ราคา/คน']]
                             : [['every','ทุกๆ N คน'],['u','ราคา/คน'],['min','ขั้นต่ำ']];
}
function ctLineKeys(ln){
  // §ctAllKeys · คืนทุกค่าที่ทับได้ รวมค่าที่สูตรกลางยังไม่ได้ตั้ง (unset)
  // ตัวคำนวด ctEffLine มีค่าไหนก็ทับค่านั้นเข้าไป จึงตั้งเฉพาะเส้นทางเดียวได้จริง
  var out = [], multi = ((ln.parts || []).length > 1);
  (ln.parts || []).forEach(function(p, i){
    ctPartKeys(p).forEach(function(kv){
      out.push({ i:i, k:kv[0], lb:(multi ? ('ส่วน ' + (i + 1) + ' · ') : '') + kv[1],
                 base:p[kv[0]], unset:(p[kv[0]] == null) });
    });
  });
  return out;
}
function ctToggleExp(lineId){ _ct.exp = _ct.exp || {}; if(_ct.exp[lineId]) delete _ct.exp[lineId]; else _ct.exp[lineId] = 1; ctRender(); }

function ctNavCells(col){
  /* ช่องที่คีย์ได้จริงในคอลัมน์นั้น เรียงตามลำดับบนลงล่าง */
  var sel = '.ct-sheet .ct-otbl td[data-col="' + col + '"] input.ct-in';
  return [].slice.call(document.querySelectorAll(sel)).filter(function(n){
    return !n.disabled && n.offsetParent !== null;
  });
}
function ctNavMark(inp){
  var td = inp && inp.closest ? inp.closest('td[data-col]') : null;
  document.querySelectorAll('.ct-sheet .ct-cellon,.ct-sheet .ct-colon,.ct-sheet .ct-rowon')
    .forEach(function(n){ n.classList.remove('ct-cellon','ct-colon','ct-rowon'); });
  var ref = document.getElementById('ct-navref'), val = document.getElementById('ct-navval');
  if(!td){ if(ref) ref.textContent = 'คลิกช่องไหนก็ได้ แล้วใช้ลูกศรเดินต่อ'; if(val) val.textContent = ''; return; }
  _ctNavFk = inp.getAttribute('data-fk') || null;
  td.classList.add('ct-cellon');
  var col = td.getAttribute('data-col');
  document.querySelectorAll('.ct-sheet .ct-otbl [data-col="' + col + '"]')
    .forEach(function(n){ if(n !== td) n.classList.add('ct-colon'); });
  var tr = td.parentElement;
  if(tr){ var h = tr.querySelector('td.ct-stick'); if(h) h.classList.add('ct-rowon'); }
  if(ref) ref.textContent = (td.getAttribute('data-trip') || '') + '  ·  ' + (td.getAttribute('data-line') || '');
  if(val) val.textContent = inp.value === '' ? (inp.placeholder ? ('ใช้สูตรกลาง · ' + inp.placeholder) : '') : inp.value;
}

/* ══ §btPinFit · ตรึงก็ต่อเมื่อยังเหลือที่ให้อ่านพอ ═══════════════════════
   §btPin รอบแรกกั้นด้วย min-width:821px อย่างเดียว ซึ่งผิด — ความกว้างไม่ได้บอกว่า
   ก้อนหัวจะสูงแค่ไหน · การ์ดในก้อนหัวตัดบรรทัดเอง จอยิ่งแคบยิ่งสูง
   วัดจริง 2026-09-15 (ข้อมูลจริง · แท็บ By trip):
     834x1112  ตรึงกิน 826px  เหลือ 26%
     1024x768  ตรึงกิน 782px  เหลือ -14px  ← สูงกว่าจอ ไม่เหลืออะไรเลย
     1440x900  ตรึงกิน 540px  เหลือ 40%
     1920x1080 ตรึงกิน 363px  เหลือ 66%
   แปลว่าแท็บเล็ตกับโน้ตบุ๊กเล็กเดือดร้อนที่สุด ส่วนมือถือไม่โดนอยู่แล้ว
   → เลิกเดาจากความกว้าง · วัดความสูงจริงตอนวาด แล้วตรึงเฉพาะตอนที่ยังเหลือ
     พื้นที่อ่านอย่างน้อย 340px ไม่งั้นปล่อยให้เลื่อนตามปกติ
   ใช้ค่าเป็น px ไม่ใช่ % เพราะสิ่งที่คนอ่านคือ "แถวในตาราง" ซึ่งสูงคงที่ ~34px
   340px = ราว 10 แถว ยังพอไล่ดูได้ · คิดเป็น % จะเพี้ยนตามความสูงจอ
   จอเตี้ยจะผ่านเกณฑ์ % ทั้งที่เหลือพื้นที่จริงน้อยกว่าจอสูงมาก
   ผลที่ได้: MacBook ขึ้นไปตรึง · แท็บเล็ตกับโน้ตบุ๊กเล็กไม่ตรึง · มือถือไม่ตรึง */
function _ctBtPinFitMeasure(){
  var v = document.getElementById('view-booking'); if(!v) return;
  var tc = v.querySelector('.bkv2-topcard'), pk = v.querySelector('.bt-pkh');
  if(!tc || !pk){ v.classList.remove('bt-pinok'); return; }
  var tb = v.querySelector('.bkv2-topbar2');
  v.style.setProperty('--t2-pkh-top', (tb ? tb.offsetHeight : 46) + 'px');
  /* วัดตอนยังไม่ตรึง เพื่อให้ได้ความสูงตามธรรมชาติ · ถอดคลาสก่อนวัดทุกครั้ง */
  v.classList.remove('bt-pinok');
  var used = tc.offsetHeight + pk.offsetHeight;
  if(window.innerHeight - used >= 340) v.classList.add('bt-pinok');
  /* §btColHd · ความสูงที่เหลือให้กล่องตาราง · หัวคอลัมน์จะตรึงได้ก็ต่อเมื่อ
     กล่องนี้เป็นตัวเลื่อนเอง (sticky เกาะกับตัวเลื่อนที่ใกล้ที่สุดเสมอ)
     §btOneScroll · วัดจาก "ตำแหน่งจริงของกล่องในเอกสาร" ไม่ใช่ผลบวกความสูงของที่ตรึง
       ระหว่างก้อนหัวกับกล่องตารางยังมีของคั่นอยู่ (แถบ CANCELLED ฯลฯ) ที่ไม่ได้ถูกตรึง
       เอาผลบวกมาลบจึงได้กล่องสูงเกินจริง เหลือหน้าให้เลื่อนอีกนิด = รู้สึกเป็นสกรอลล์สองที่
       วัดจริงก่อนแก้: กล่องสูง 357px แต่หน้ายังเลื่อนได้อีก 96px
     ทุกอย่างเหนือกล่องถูกตรึงหรืออยู่นิ่ง ตำแหน่งนี้จึงคงที่ ใช้คำนวณได้ */
  var wrapEl = v.querySelector('.t2-wrap');
  if(wrapEl){
    var topDoc = wrapEl.getBoundingClientRect().top + (window.pageYOffset || 0);
    var maxH = Math.max(240, window.innerHeight - topDoc - 8);   /* §btFill · เผื่อ 14 → 8 */
    v.style.setProperty('--t2-wrap-max', maxH + 'px');
    /* ใต้กล่องตารางยังมีบล็อกท้ายหน้าอยู่อีก (bkV2RenderL...) ที่สูงไม่คงที่
       ถ้าไม่หักออก หน้าจะยังเหลือที่ให้เลื่อนนิดหน่อย = ผู้ใช้รู้สึกว่ามีสกรอลล์สองที่
       อ่าน scrollHeight กลับมาหลังตั้งค่า (การอ่านบังคับให้จัดวางใหม่อยู่แล้ว)
       แล้วหักส่วนที่เกินออกรอบเดียว · ลดกล่องเท่าไหร่ หน้าก็สั้นลงเท่านั้น จึงลงตัวในรอบเดียว */
    var de = document.documentElement;
    var over = de.scrollHeight - de.clientHeight;
    if(over > 0){ maxH = Math.max(240, maxH - over);
      v.style.setProperty('--t2-wrap-max', maxH + 'px'); }
    /* §btFitReal · ด่านคัดกรองข้างบนเดาพื้นที่อ่านจาก innerHeight - (แถบแท็บ + ก้อนหัว)
       แต่พื้นที่จริงน้อยกว่านั้น เพราะยังมีแถบ CANCELLED คั่น และบล็อกท้ายหน้าอีก
       วัดจริงที่ 1440x900: ด่านคิดว่าเหลือ 359px แต่กล่องจริงได้ 261px
       ตัดสินใจจากตัวเลขที่ผิดจึงตรึงในจอที่ไม่ควรตรึง · เช็คซ้ำด้วยความสูงจริง
       ต่ำกว่าเกณฑ์ = ถอยกลับไปเลื่อนทั้งหน้าเหมือนเดิม ปลอดภัยกว่าตรึงแล้วเหลือ 7 แถว */
    if(maxH < 340){
      v.classList.remove('bt-pinok');
      v.style.removeProperty('--t2-wrap-max');
    }
  } else {
    v.style.setProperty('--t2-wrap-max', Math.max(240, window.innerHeight - used - 14) + 'px');
  }
}
/* ══ §btPinScroll (2026-09-19) · จัดรถแล้วตารางเด้งกลับหัว — รอบสอง ══════
   §vanAssignScroll แก้ด้วย bkV2RenderKeep() คือเก็บตำแหน่งเลื่อนไว้ก่อนวาด แล้วคืนให้ใน rAF
   สองชั้น · ตรงนั้นถูกแล้ว แต่ยังเด้งอยู่ เพราะยังมีคนมารีเซ็ตทีหลังจากนั้นอีกที
   ctBtPinFit วัดความสูง "ตอนยังไม่ตรึง" จึงถอดคลาส bt-pinok ออกก่อนวัดทุกครั้ง
   พอถอด · .t2-wrap หมด max-height + overflow:auto ทันที = เลิกเป็นกล่องเลื่อน
   เบราว์เซอร์จึงทิ้ง scrollTop ทันที · ใส่คลาสกลับก็ได้กล่องที่ scrollTop = 0
   ตัวก่อเหตุคือ ctBtPinFitLater() ที่ยิงหลังวาด 300ms — หลัง rAF ของ
   bkV2KeepScroll ไปนานแล้ว คืนไปเท่าไหร่ก็โดนล้างอยู่ดี (resize ก็เจอเหมือนกัน)
   แก้ที่ต้นเหตุ: ห่อตัววัด เก็บ scrollTop/scrollLeft ของ .t2-wrap ไว้ก่อน
   แล้วคืนหลังวัดเสร็จ · ครอบทุกทางที่เรียกวัด (วาดใหม่ / 300ms / resize)
   คืนเฉพาะตอนมีค่าจริง · จอที่ไม่ตรึง scrollTop เป็น 0 อยู่แล้ว คืนก็ไม่มีผล */
function ctBtPinFit(){
  var v = document.getElementById('view-booking');
  var w = v ? v.querySelector('.t2-wrap') : null;
  var st = w ? w.scrollTop : 0, sl = w ? w.scrollLeft : 0;
  try{ _ctBtPinFitMeasure(); }
  finally{
    if(st || sl){ try{
      var w2 = v ? v.querySelector('.t2-wrap') : null;
      if(w2){ if(st && w2.scrollTop !== st) w2.scrollTop = st;
              if(sl && w2.scrollLeft !== sl) w2.scrollLeft = sl; }
    }catch(_){} }
  }
}
function ctBtPinFitLater(){ clearTimeout(_ctPinT);
  _ctPinT = setTimeout(function(){ try{ ctBtPinFit(); }catch(_){ } }, 300); }

function ctCell(a, b, c){
  return '<div class="ct-cell"><div class="c1">' + (a || '') + '</div><div class="c2">' + (b || '') + '</div><div class="c3">' + (c || '') + '</div></div>';
}
function ctOvrHtml(){
  var T = ctTpl(), P = ctPlans(), G = ctGroups(T);
  var pxf = function(pl, k, lb){
    return '<label class="ct-paxf" title="แก้ได้ที่นี่เลย · มีผลกับทุกยอดในคอลัมน์นี้"><span>' + lb + '</span>'
      + '<input class="ct-in px" data-fk="pp.' + pl.id + '.' + k + '" value="' + (+pl[k] || 0) + '"'
      + ' oninput="ctPlanSetOn(\'' + pl.id + '\',\'' + k + '\',this.value)"></label>';
  };
  var head = '<tr><th class="ct-stick">รายการต้นทุน / หมวดหมู่</th>'
    + P.map(function(p, _i){
        var cap = Math.max(1, (+p.cap || 65) * Math.max(1, +p.boats || 1));
        var be = ctBreakEven(p, cap, T);
        var on = (p.id === _ct.pid);
        var pc = CT_PCOL[_i % CT_PCOL.length];   /* §ctSheet */
        var pb = CT_PBG[_i % CT_PBG.length];     /* §ctTripBg */
        /* §ctHdAlign · ห่อเนื้อในหัวคอลัมน์เป็นกล่องเดียว เพื่อจัดให้ชิดล่าง
           ชื่อทริปยาวไม่เท่ากัน (วัดจริง 20px ถึง 98px = 1 ถึง 5 บรรทัด)
           ของเดิมไล่จากบนลงมา บรรทัดสเปค/คุ้มทุน/ช่องกรอกคนจึงเลื่อนตามชื่อ
           คลาดเคลื่อนกันสูงสุด 78px อ่านเทียบข้ามคอลัมน์ไม่ได้
           แก้โดยให้ชื่อยืดขึ้นข้างบน ส่วนที่เหลือเกาะพื้นล่างเสมอ — ไม่ต้องตัดชื่อทิ้ง */
        return '<th class="ct-pcol' + (on ? ' on' : '') + '" style="--pc:' + pc + ';--pcbg:' + pb + '" data-col="' + _i + '">'
          + '<div class="ct-phd">'
          + '<div class="ct-pnm" title="' + ctE(p.name) + '"><i class="ct-pdot"></i>' + ctE(p.name) + '</div>'
          + '<div class="ct-pfoot">'
          + '<div class="ct-psub">' + ctE(p.eng) + ' · จุ ' + (+p.cap || 0) + ' · ' + ctB(p.price) + '/หัว</div>'
          + '<div class="ct-pbe' + (be ? '' : ' warn') + '">' + (be ? ('คุ้มทุน ' + be + ' คน') : 'เต็มลำยังไม่คุ้ม') + '</div>'
          + '<div class="ct-paxbar">' + pxf(p, 'pax', 'คนทั้งหมด') + pxf(p, 'paxTH', 'คนไทย') + '</div>'
          + '</div></div></th>';
      }).join('') + '</tr>';

  var body = '';
  G.forEach(function(g){
    /* §ctGrpFold · ตั้งต้นหุบทุกหมวด · ตารางเปิดมาเห็นแค่ 5 หัวข้อใหญ่ ไม่ใช่ 22 แถวรวด
       คลิกที่ชื่อหมวดค่อยกาง · ใส่ onclick ไว้ที่เซลล์ชื่อหมวดเท่านั้น ไม่ใช่ทั้งแถว
       เพราะเซลล์อื่นในแถวมีติ๊กถูกกับช่อง % ของตัวเอง ถ้าใส่ที่แถวจะกดโดนกันเอง */
    var gOpen = !!((_ct.gop || {})[g]);
    var cells = '<td class="ct-stick ct-gtd' + (gOpen ? ' open' : '') + '"'
              + ' title="คลิกเพื่อกาง / หุบหมวดนี้"'
              + ' onclick="ctGrpOpen(\'' + ctE(g) + '\')"><span class="ct-gnm2">'
              + '<i class="ct-chev">▶</i>' + ctE(g) + '</span></td>';
    P.forEach(function(pl, _pi){
      var c = ctGrpCfg(pl, g), pct = +c.pct || 0, sub = 0;
      if(!c.off){
        var pax = Math.max(1, +pl.pax || 1), th2 = Math.min(Math.max(0, +pl.paxTH || 0), pax);
        ctCalc(pl, { eng:pl.eng, boats:Math.max(1, +pl.boats || 1), fuel:+pl.fuel || 0, pax:pax, paxTH:th2, paxFR:pax - th2, paxCh:ctChdAt(pl, pax) }, T)
          .rows.forEach(function(r){ if(r.g === g) sub += r.amt; });
      }
      var tick = '<label class="ct-ck"><input type="checkbox"' + (c.off ? '' : ' checked')
        + ' onchange="ctGrpToggle(\'' + pl.id + '\',\'' + ctE(g) + '\',this.checked)"></label>';
      var mid = c.off ? '<span class="ct-off">ปิดทั้งหมวด</span>'
        : '<span class="ct-pctwrap' + (pct ? ' on' : '') + '"><input class="ct-in pct" data-fk="gp.' + pl.id + '.' + g + '" value="' + (pct || '') + '" placeholder="0"'
          + ' title="คูณทุกบรรทัดในหมวดนี้ · แพงกว่า 20% ใส่ 20" oninput="ctGrpPct(\'' + pl.id + '\',\'' + ctE(g) + '\',this.value)"><i>%</i></span>';
      cells += '<td class="ct-gtd" data-col="' + _pi + '" data-trip="' + ctE(pl.name) + '" data-line="ทั้งหมวด · ' + ctE(g) + '">'
        + ctCell(tick, mid, c.off ? '' : '<b class="ct-gsum">' + ctB(sub) + '</b>') + '</td>';
    });
    body += '<tr class="ct-grow">' + cells + '</tr>';

    if(!gOpen) return;                                  /* §ctGrpFold · หุบอยู่ ไม่ต้องวาดแถวย่อย */
    (T.lines || []).forEach(function(ln){
      if((ln.g || 'อื่นๆ') !== g) return;
      var exp = !!((_ct.exp || {})[ln.id]), KEYS = ctLineKeys(ln);
      /* §ctRowUnit · ป้ายหน่วย ("ผู้ใหญ่ · ต่างชาติ") มาจาก template ของบรรทัด ไม่ใช่ของแต่ละแผน
         จึงเป็นข้อความเดียวกันเป๊ะทั้ง 8 คอลัมน์ · ของเดิมพิมพ์ซ้ำในทุกเซลล์
         ย้ายมาไว้ใต้ชื่อแถวครั้งเดียว เซลล์เหลือแต่ตัวเลข อ่านเป็นคอลัมน์ตัวเลขได้จริง
         ตอนกางไม่ต้องขึ้น เพราะกริดข้างในมีหัวแถว/หัวคอลัมน์บอกชนิดอยู่แล้ว
         และตอนกางมีหลายหน่วย ป้ายเดียวที่หัวแถวจะกลายเป็นข้อมูลผิด */
      var _u0 = (!exp && KEYS.length) ? String(KEYS[0].lb).replace(/^ส่วน \d+ · /, '') : '';
      var rc = '<td class="ct-stick ct-ltd"><div class="ct-lname' + (exp ? ' open' : '') + '"'
             + ' title="คลิกเพื่อกางค่าทั้งหมดของบรรทัดนี้ · กางพร้อมกันทุกแผน"'
             + ' onclick="ctToggleExp(\'' + ctE(ln.id) + '\')"><i class="ct-chev">▶</i><span>' + ctE(ln.l) + '</span></div>'
             + (_u0 ? ('<div class="ct-lunit">' + ctE(_u0) + '</div>') : '') + '</td>';
      P.forEach(function(pl, _pi){
        var grpOff = !!ctGrpCfg(pl, g).off, o = (pl.ovr || {})[ln.id] || {};
        var noTH = !(+pl.paxTH > 0);
        var val = function(kv){ var v = ((o.p || [])[kv.i] || {})[kv.k]; return (v == null || v === '') ? null : v; };
        var tick = '<label class="ct-ck"><input type="checkbox"' + (o.off ? '' : ' checked') + (grpOff ? ' disabled' : '')
          + ' onchange="ctOvrToggle(\'' + pl.id + '\',\'' + ctE(ln.id) + '\',this.checked)"></label>';
        var bd = '';
        if(o.off){ bd = '<span class="ct-off">ปิด</span>'; }
        else if(!KEYS.length){ bd = ''; }
        else if(exp){
          /* §ctFldGrid · ของเดิมวางช่องกรอกเรียงลงมาทีละแถว แถวละหนึ่งค่า
             พร้อมป้ายยาว ("ส่วน 1 · ผู้ใหญ่ · ต่างชาติ") และคำอธิบายใต้ช่องอีกบรรทัด
             บรรทัดเดียวที่กางออกจึงสูงเกิน 8 แถวย่อย x 8 คอลัมน์ = อ่านไม่ไหว
             ค่าพวกนี้จริง ๆ เป็นตารางอยู่แล้ว: ผู้ใหญ่/เด็ก คูณ ต่างชาติ/ไทย
             วางเป็นตาราง 2x2 จึงสั้นลงครึ่งหนึ่งและหาช่องที่จะกรอกได้เร็วกว่ามาก
             ป้ายบอกชนิดย้ายไปเป็นหัวแถว/หัวคอลัมน์ ไม่ต้องเขียนซ้ำทุกช่อง */
          var byPart = {}, pOrder = [];
          KEYS.forEach(function(kv){
            if(!byPart[kv.i]){ byPart[kv.i] = {}; pOrder.push(kv.i); }
            byPart[kv.i][kv.k] = kv;
          });
          var fld = function(kv){
            if(!kv) return '<span class="ct-fnone">—</span>';
            var cv = val(kv), has = (cv != null);
            return '<span class="ct-fw">'
              + '<input class="ct-in fin' + (has ? ' on' : (kv.unset ? ' unset' : '')) + '"'
              + ' data-fk="o.' + pl.id + '.' + ln.id + '.' + kv.i + '.' + kv.k + '"'
              + ' value="' + (has ? cv : '') + '" placeholder="' + (kv.unset ? '—' : kv.base) + '"' + (grpOff ? ' disabled' : '')
              + ' title="' + ctE(kv.lb) + (kv.unset ? ' · สูตรกลางยังไม่ได้ตั้งค่านี้' : (' · ว่าง = ใช้ค่าจากสูตรกลาง (' + kv.base + ')')) + '"'
              + ' oninput="ctOvrSet(\'' + pl.id + '\',\'' + ctE(ln.id) + '\',' + kv.i + ',\'' + kv.k + '\',this.value)">'
              + (has ? ('<button class="ct-undo" title="คืนค่าสูตรกลาง (' + (kv.unset ? '—' : kv.base) + ')" onclick="ctOvrSet(\'' + pl.id + '\',\'' + ctE(ln.id) + '\',' + kv.i + ',\'' + kv.k + '\',\'\')">' + ctIcon('undo', 10) + '</button>') : '')
              + '</span>';
          };
          var grid2 = function(B, colLb, rowLb, keys){
            /* keys = [[แถว1คอล1, แถว1คอล2], [แถว2คอล1, แถว2คอล2]] */
            var h = '<div class="ct-fg"><span></span>'
                  + colLb.map(function(c){ return '<span class="ct-fgh">' + ctE(c) + '</span>'; }).join('');
            rowLb.forEach(function(r, ri){
              h += '<span class="ct-fgr"' + (/⚠/.test(r) ? ' title="แผนนี้ตั้งคนไทย 0 คน · ค่าคนไทยยังไม่มีผลกับยอด"' : '') + '>' + ctE(r) + '</span>'
                 + keys[ri].map(function(k){ return fld(B[k]); }).join('');
            });
            return h + '</div>';
          };
          var parts = pOrder.map(function(pi){
            var B = byPart[pi], ks = Object.keys(B), inner;
            if(B.u && B.uTH && B.uCh && B.uChTH){
              var thLb = 'ไทย' + ((noTH && val(B.uTH) != null) ? '\u2009⚠' : '');   /* §ctEvenCell */
              inner = grid2(B, ['ผู้ใหญ่','เด็ก'], ['ต่างชาติ', thLb], [['u','uCh'], ['uTH','uChTH']]);
            } else if(B.u && B.q && B.u4 && B.q4){
              inner = grid2(B, ['ปกติ','4EN'], ['ราคา/หน่วย','จำนวน'], [['u','u4'], ['q','q4']]);
            } else if(B.q && B.q4 && ks.length === 2){
              inner = grid2(B, ['ปกติ','4EN'], ['ลิตร/ลำ'], [['q','q4']]);
            } else {
              /* ชุดที่ไม่ใช่ตาราง (ขั้นบันได ฯลฯ) · เรียงแนวนอนแถวเดียว */
              inner = '<div class="ct-fline">' + ks.map(function(k){
                var kv = B[k];
                return '<span class="ct-fi"><span class="ct-fgr">'
                  + ctE(kv.lb.replace(/^ส่วน \d+ · /, '')) + '</span>' + fld(kv) + '</span>';
              }).join('') + '</div>';
            }
            /* §ctEvenCell · ของเดิมมีกล่องคำอธิบายสองแบบโผล่เฉพาะบางเซลล์
               ("คนไทย 0 คน" กับ "สูตรกลางยังไม่ตั้ง") เซลล์ในแถวเดียวกันจึงสูงไม่เท่ากัน
               แถวยืดตามเซลล์ที่สูงสุด เหลือที่ว่างเป็นหลุมในเซลล์อื่น อ่านยาก
               → "สูตรกลางยังไม่ตั้ง" ตัดทิ้ง · ช่องที่ขึ้น — กับ tooltip บอกอยู่แล้ว
                 และมันเป็นข้อความเดียวกันทุกเซลล์ที่มี ไม่ได้บอกอะไรเฉพาะเจาะจง
               → "คนไทย 0 คน" ย่อเป็นเครื่องหมายเล็กท้ายหัวแถว "ไทย" พร้อม tooltip
                 ยังเตือนอยู่ แต่ไม่กินความสูง ทุกเซลล์จึงโครงเดียวกันหมด */
            /* §fpartFix · ใช้ ct-fpart ไม่ใช่ ct-part · ct-part เป็นของแท็บ "สูตรกลาง" อยู่ก่อนแล้ว
               (เรียงแนวนอน flex-wrap) · ตอนทำ §ctFldGrid ผมตั้งชื่อซ้ำแล้วเขียนกฎ
               flex-direction:column ทับ ทำให้แท็บสูตรกลางกลายเป็นคอลัมน์ผอมยาว
               ชื่อคลาสในไฟล์นี้ใช้ร่วมกันทั้งสี่แท็บ ตั้งชื่อใหม่ต้องเช็คก่อนเสมอ */
            return '<div class="ct-fpart">'
              + (pOrder.length > 1 ? ('<div class="ct-pttl">ส่วน ' + (pi + 1) + '</div>') : '')
              + inner + '</div>';
          }).join('');
          bd = '<div class="ct-flds">' + parts + '</div>';
        } else {
          var m0 = KEYS[0], c0 = val(m0), nOvr = 0;
          KEYS.forEach(function(kv){ if(val(kv) != null) nOvr++; });
          var main = (c0 != null) ? ('<b class="ov">' + c0 + '</b>')
                   : (m0.unset ? '<b class="mut">—</b>' : ('<b>' + m0.base + '</b>'));
          /* §ctRowUnit · ป้ายหน่วยย้ายไปหัวแถวแล้ว · เซลล์เหลือตัวเลขกับจำนวนค่าที่ตั้งเอง
             (ตัวหลังต่างกันไปตามแผน จึงยังต้องอยู่ในเซลล์) */
          bd = '<div class="ct-peek" onclick="ctToggleExp(\'' + ctE(ln.id) + '\')">' + main
             + (nOvr ? ('<i class="ct-dot"></i><span class="n">ตั้งเอง ' + nOvr + ' ค่า</span>') : '') + '</div>';
        }
        rc += '<td class="ct-ltd' + (grpOff ? ' dis' : '') + '" data-col="' + _pi + '"'
           + ' data-trip="' + ctE(pl.name) + '" data-line="' + ctE(ln.l) + '">'
           + '<div class="ct-lcell">' + tick + '<div class="ct-lbody">' + bd + '</div></div></td>';
      });
      body += '<tr>' + rc + '</tr>';
    });
  });

  return '<div class="ct-card ct-bar2"><div><b>ปรับ / ปิด รายการต้นทุนแยกตามแผน</b>'
    + '<span class="ct-sub">' + ctIcon('info', 12) + ' <em class="fix">แถวหัวหมวด</em> ปิดทั้งหมวด หรือใส่ ±% คูณทุกบรรทัดในหมวด · '
    + '<em class="var">คลิกชื่อรายการ</em> เพื่อกางค่าทั้งหมดของบรรทัดนั้น · ทุกค่าทับได้ แม้สูตรกลางยังไม่ได้ตั้ง · ว่าง = ใช้ค่าจากสูตรกลาง</span></div>'
    + '<div class="ct-bar2r"><span class="ct-hint">1 คอลัมน์ = 1 แผนคำนวณ</span></div></div>'
    + '<div class="ct-navbar" id="ct-navbar"><span class="ct-navref" id="ct-navref">คลิกช่องไหนก็ได้ แล้วใช้ลูกศรเดินต่อ</span>'
    + '<span class="ct-navval" id="ct-navval"></span><span class="ct-navsp"></span>'
    + '<span class="ct-navkeys"><kbd>&uarr;</kbd><kbd>&darr;</kbd> ข้ามแถว <kbd>&larr;</kbd><kbd>&rarr;</kbd> ข้ามทริป <kbd>Enter</kbd> ลงแถวถัดไป</span></div>'
    /* §ctColMin · ตารางนี้เป็น table-layout:fixed + width:100% · ยิ่งมีแผนเยอะ คอลัมน์ยิ่งถูกหารให้แคบลง
       วัดจริง · 1 แผน ช่องกรอกกว้าง 130px · 4 แผน 130px · 10 แผน เหลือ 29px
       ที่ 29px ช่องกรอกยุบจนเห็นแต่ไอคอนคืนค่า คนใช้อ่านว่า "หน้าพัง" ซึ่งก็ถูกแล้ว
       ⚠ ไม่ใช่ของที่เพิ่งเปลี่ยน · เป็นเพดานที่ §ctFldGrid ไม่เคยถูกออกแบบเผื่อไว้
         โผล่ตอนทีมเพิ่มแผนจาก 8 เป็น 10 เมื่อคืนก่อนจึงยังดีอยู่
       → ตั้งความกว้างขั้นต่ำต่อคอลัมน์ แล้วให้ตารางล้นกล่องไปเลย
         .ct-sheet มี overflow:auto อยู่แล้ว (ตั้งแต่ §ctSheet) จึงปัดซ้าย-ขวาดูได้
         เลื่อนแล้วคอลัมน์ชื่อรายการกับหัวตารางยังตรึงอยู่เหมือนเดิม */
    + '<div class="ct-card ct-tblcard"><div class="ct-scroll ct-sheet"><table class="ct-otbl" style="min-width:'
      + (250 + Math.max(1, P.length) * 260) + 'px"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
}

// ── mutators ────────────────────────────────────────────────────────────────────────────────────
function _ctNum(v){ return (v === '' || v == null) ? null : (+v || 0); }
function ctPartSet(li, pi, key, val){
  var T = ctTpl(); var p = T.lines[li] && T.lines[li].parts[pi]; if(!p) return;
  p[key] = (key === 'per' || key === 'mode') ? val : _ctNum(val);
  ctTplSave(T); ctRender();
}
function ctPartKind(li, pi, k){
  var T = ctTpl(); if(!T.lines[li]) return;
  var n = { k:k };
  if(k === 'fix'){ n.per = 'boat'; n.q = 1; n.u = 0; }
  if(k === 'var'){ n.u = 0; }
  if(k === 'step'){ n.mode = 'every'; n.every = 25; n.min = 1; n.u = 0; }
  T.lines[li].parts[pi] = n; ctTplSave(T); ctRender();
}
function ctAddPart(li){ var T = ctTpl(); if(!T.lines[li]) return; T.lines[li].parts.push({ k:'var', u:0 }); ctTplSave(T); ctRender(); }
function ctDelPart(li, pi){ var T = ctTpl(); if(!T.lines[li] || T.lines[li].parts.length <= 1) return; T.lines[li].parts.splice(pi, 1); ctTplSave(T); ctRender(); }
function ctAddEng(li, pi){ var T = ctTpl(); var p = T.lines[li] && T.lines[li].parts[pi]; if(!p) return; if(p.fuel) p.q4 = p.q; else { p.q4 = p.q; p.u4 = p.u; } ctTplSave(T); ctRender(); }
function ctAddTH(li, pi){ var T = ctTpl(); var p = T.lines[li] && T.lines[li].parts[pi]; if(!p) return; p.uTH = p.u; ctTplSave(T); ctRender(); }
/* §ctChd · เริ่มที่ครึ่งราคาผู้ใหญ่ · เป็นเรตที่เจอบ่อยสุด แก้ต่อได้ทันที */
function ctAddCh(li, pi){ var T = ctTpl(); var p = T.lines[li] && T.lines[li].parts[pi]; if(!p) return;
  p.uCh = Math.round((+p.u || 0) / 2); ctTplSave(T); ctRender(); }
function ctAddChTH(li, pi){ var T = ctTpl(); var p = T.lines[li] && T.lines[li].parts[pi]; if(!p) return;
  p.uChTH = Math.round((+((p.uTH != null) ? p.uTH : p.u) || 0) / 2); ctTplSave(T); ctRender(); }
function ctLineName(li, v){ var T = ctTpl(); if(!T.lines[li]) return; T.lines[li].l = v; ctTplSave(T); ctRender(); }
function ctLineGroup(li, v){
  var T = ctTpl(); if(!T.lines[li]) return;
  if(v === '__new'){ var nm = prompt('ชื่อหมวดใหม่', ''); if(!nm || !String(nm).trim()){ ctRender(); return; } v = String(nm).trim(); }
  T.lines[li].g = v; ctTplSave(T); ctRender();
}
function ctRenameGroup(g){
  var nm = prompt('เปลี่ยนชื่อหมวด "' + g + '" เป็น', g);
  if(!nm || !String(nm).trim() || String(nm).trim() === g) return;
  nm = String(nm).trim();
  var T = ctTpl(); T.lines.forEach(function(l){ if((l.g || 'อื่นๆ') === g) l.g = nm; }); ctTplSave(T);
  // ย้ายการตั้งค่าระดับหมวดของทุกแผนตามไปด้วย ไม่งั้น %/ปิดหมวด จะหลุด
  var Pl = ctPlans(); Pl.forEach(function(p){ if(p.grp && p.grp[g]){ p.grp[nm] = p.grp[g]; delete p.grp[g]; } }); ctPlansSave(Pl);
  ctRender();
}
function ctLineVat(li, on){ var T = ctTpl(); if(!T.lines[li]) return; T.lines[li].vat = !!on; ctTplSave(T); ctRender(); }
function ctAddLine(){ var T = ctTpl(); T.lines.push({ id:'x' + Math.random().toString(36).slice(2, 8), g:'อื่นๆ', l:'รายการใหม่', vat:false, parts:[{ k:'var', u:0 }] }); ctTplSave(T); ctRender(); }
function ctDelLine(li){
  var T = ctTpl(); var ln = T.lines[li]; if(!ln) return;
  if(!confirm('ลบ "' + ln.l + '" ออกจากสูตรกลาง? · ค่าที่ตั้งไว้รายแผนของรายการนี้จะถูกลบด้วย')) return;
  /* §plCost · จำไว้ว่าลบบรรทัดมาตรฐานไหนไป · ctTplFill จะได้ไม่เติมกลับมาให้ทุกครั้งที่เปิดหน้า */
  if(CT_DEFAULT.lines.some(function(d){ return d.id === ln.id; })){
    T.dropped = T.dropped || [];
    if(T.dropped.indexOf(ln.id) < 0) T.dropped.push(ln.id);
  }
  T.lines.splice(li, 1); ctTplSave(T);
  var P = ctPlans(); P.forEach(function(p){ if(p.ovr) delete p.ovr[ln.id]; }); ctPlansSave(P);
  ctRender();
}
function ctVatSet(v){ var T = ctTpl(); T.vatRate = +v || 0; ctTplSave(T); ctRender(); }
function ctResetTpl(){ if(!confirm('คืนสูตรกลางกลับเป็นค่าเริ่มต้นทั้งหมด? · ค่าที่ตั้งไว้รายแผนจะถูกล้างด้วย')) return;
  ctTplSave(JSON.parse(JSON.stringify(CT_DEFAULT)));
  var P = ctPlans(); P.forEach(function(p){ p.ovr = {}; }); ctPlansSave(P); ctRender(); }
function ctGrpToggle(pid, g, on){
  var pl = ctPlan(pid); if(!pl) return;
  pl.grp = pl.grp || {}; pl.grp[g] = pl.grp[g] || {};
  if(on) delete pl.grp[g].off; else pl.grp[g].off = 1;
  ctPlanPut(pl); ctRender();
}
function ctGrpPct(pid, g, v){
  var pl = ctPlan(pid); if(!pl) return;
  pl.grp = pl.grp || {}; pl.grp[g] = pl.grp[g] || {};
  if(v === '' || v == null || +v === 0) delete pl.grp[g].pct; else pl.grp[g].pct = +v || 0;
  ctPlanPut(pl); ctRender();
}
function ctOvrToggle(pid, lineId, on){
  var pl = ctPlan(pid); if(!pl) return;
  pl.ovr = pl.ovr || {}; pl.ovr[lineId] = pl.ovr[lineId] || {};
  if(on) delete pl.ovr[lineId].off; else pl.ovr[lineId].off = 1;
  ctPlanPut(pl); ctRender();
}
function ctOvrSet(pid, lineId, pi, key, val){
  if(val === undefined){ val = key; key = pi; pi = 0; }   // เข้ากันได้กับการเรียกแบบเดิม (ไม่ระบุส่วนประกอบ)
  var pl = ctPlan(pid); if(!pl) return;
  pl.ovr = pl.ovr || {}; var o = pl.ovr[lineId] = pl.ovr[lineId] || {};
  o.p = o.p || []; o.p[pi] = o.p[pi] || {};
  if(val === '' || val == null) delete o.p[pi][key]; else o.p[pi][key] = +val || 0;
  ctPlanPut(pl); ctRender();
}

// ════════ Contracts panel + Add Promotion (Rate/Contract model · Phase 3 · 2026-07-23) ════════
// Appended below the agent-detail tab area (survives tab switches — those only replace #ag-tabbody).
// Lists the agent's contracts (main + time-boxed promo overlays) and lets the user add a promo, whose
// price (via bkV2GetRTForTrip) overrides the main for its routes during its travel-date window.
function _ctEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _ctFmt(s){ if(!s) return '—'; const d=new Date(s); return isNaN(d.getTime())?String(s):(d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear()); }
function _ctRateName(id){ const rt=(typeof getRateType==='function')?getRateType(id):null; return rt?(rt.name||rt.code||id):(id||'—'); }
function _ctRouteName(id){ const r=(typeof getRoute==='function')?getRoute(id):null; return r?(r.name||id):(id||'—'); }
function _ctContractStatus(c){
  // derive live status from dates (unless explicitly void/cancelled)
  if(c.status==='void'||c.status==='cancelled') return {key:'void', label:'ยกเลิก', bg:'#FCEBEB', color:'#A32D2D'};
  const today=(typeof TODAY_STR!=='undefined'&&TODAY_STR)?TODAY_STR:new Date().toISOString().slice(0,10);
  if(c.activeTo && today>c.activeTo)   return {key:'expired', label:'หมดอายุ', bg:'#F1EFE8', color:'#777'};
  if(c.activeFrom && today<c.activeFrom) return {key:'scheduled', label:'รอเริ่ม', bg:'#EEEDF8', color:'#534AB7'};
  return {key:'active', label:'ใช้งาน', bg:'#E7F5EE', color:'#0F6E56'};
}
/* §ctRateSync (2026-09-12) · "ดึงเรทมาเปลี่ยนแล้ว ทำไมข้างบนไม่เปลี่ยน"

   Rate Type ของ agent ถูกเก็บไว้ "สองที่" แต่ปุ่มเปลี่ยนอัปเดตแค่ที่เดียว
     a.rateTypeId                  ← ปุ่ม "เปลี่ยน Rate Type" เขียนตัวนี้
                                     และเป็นตัวที่เครื่องคิดราคาอ่านจริง (tsNetOf)
     SB_CONTRACTS[].rateTypeId     ← การ์ดสัญญาด้านบนอ่านตัวนี้ (_ctRateName)
                                     ไม่มีใครอัปเดตให้เลย → ค้างเป็นชุดเก่าตลอด

   ที่เห็นบนจอ: Source บอก OTATRI [OTA]-Trip.com (ใหม่)
               แต่การ์ดสัญญายังบอก RT - Main 26-27 TH-WW (เก่า)

   ไม่ใช่แค่เรื่องหน้าตา · ctDocForContract() ออกเอกสารสัญญาด้วย c.rateTypeId
   สัญญาที่พิมพ์ออกไปให้ agent จึงเป็นราคาชุดเก่า ทั้งที่ระบบคิดเงินด้วยชุดใหม่
   และ ctOpenAddPromo() ก็ตั้งค่าเริ่มต้นของใบโปรใหม่จากชุดเก่าด้วย

   แก้ที่ต้นทาง · เปลี่ยนที่เดียวแล้วให้ตามไปทั้งคู่
   เฉพาะสัญญา MAIN ที่ยังไม่หมดอายุ/ไม่ถูกยกเลิก — ใบเก่าต้องเก็บชุดราคาเดิมไว้
   ไม่งั้นประวัติจะถูกเขียนทับ และเอกสารที่ออกไปแล้วจะอ้างอิงไม่ตรงกับของจริง */
function _ctSyncMainRate(agentId, rtId, why){
  try{
    if(typeof SB_CONTRACTS==='undefined' || !Array.isArray(SB_CONTRACTS)) return 0;
    var n=0;
    SB_CONTRACTS.forEach(function(c){
      if(!c || c.agentId!==agentId || c.kind!=='main') return;
      if(c.status==='expired' || c.status==='void' || c.status==='cancelled') return;   // ใบเก่า · เก็บของเดิมไว้
      if((c.rateTypeId||null)===(rtId||null)) return;
      c.rateTypeId = rtId || null; n++;
    });
    if(n>0 && typeof sbContractsPersist==='function') sbContractsPersist();
    if(n>0 && typeof agLog==='function') agLog(agentId,'contract','สัญญา MAIN '+n+' ใบ · Rate Type ตามไปด้วย'+(why?(' ('+why+')'):''));
    return n;
  }catch(e){ try{ console.warn('ctRateSync failed', e); }catch(_){} return 0; }
}
function ctContractsPanelHTML(agentId){
  const a=(typeof sbGetAgent==='function')?sbGetAgent(agentId):null; if(!a) return '';
  const cons=((typeof SB_CONTRACTS!=='undefined'&&Array.isArray(SB_CONTRACTS))?SB_CONTRACTS:[]).filter(c=>c&&c.agentId===agentId);
  cons.sort((x,y)=> (x.kind==='main'?0:1)-(y.kind==='main'?0:1) || String(x.activeFrom||'').localeCompare(String(y.activeFrom||'')));
  /* §b2bPromo · ต้องรู้สิทธิ์แก้ก่อนวาดแถว · ปุ่มแก้/ยกเลิกไม่ควรขึ้นให้คนที่แก้ไม่ได้ */
  const canEdit=(typeof laCanEditArea!=='function')||laCanEditArea('sales');
  const row=c=>{
    const st=_ctContractStatus(c);
    const isPromo=c.kind==='promo';
    const routes=(c.programPeriods||[]).map(p=>_ctRouteName(p.routeId));
    /* §b2bPromo · ป้ายบอกที่มาของราคา · ใบเก่าไม่มี priceMode = ตาม Rate Type เหมือนเดิม */
    const pm=isPromo?((c.priceMode||'rate')):'';
    const pmTag=isPromo?`<span style="background:#F1EFE8;color:#5F5E5A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:7px;white-space:nowrap">${_ctEsc(LA_PROMO_MODE_TXT[pm]||pm)}${pm==='discount'?(' · '+_ctEsc(laPromoDiscTxt(c))):''}</span>`:'';
    /* §b2bPromo · ซื้อ N แถม 1 · แถบความคืบหน้า
       ผู้ใช้ถามว่า "จะโชว์ตัวเลขยังไงว่า Performance ถึงไหนแล้ว" — ก้อนนี้คือคำตอบ
       ระบบไม่เติมหัว FOC ให้ · บอกแค่ว่าขายไปเท่าไหร่ ได้สิทธิ์กี่ที่ ใช้ไปแล้วกี่ที่ */
    let bonusBar='';
    if(isPromo && st.key!=='void'){
      const S=laPromoStat(c);
      if(S){
        const warn=S.over>0;
        bonusBar=`<div style="margin-top:7px;padding-top:7px;border-top:1px dashed #EFECE6">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:10.5px;color:#4A5464">
            <b style="font-size:11px;color:#3C4553">ซื้อ ${S.buy} แถม 1</b>
            <span style="color:#8A929E">นับ${_ctEsc(S.basisTxt)}</span>
            <span style="flex:1"></span>
            <span>ขายแล้ว <b>${S.sold.toLocaleString()}</b> หัว · ${S.bookings} ใบ</span>
          </div>
          <div style="display:flex;align-items:center;gap:9px;margin-top:5px">
            <div style="flex:1;height:7px;background:#EFECE6;border-radius:99px;overflow:hidden">
              <i style="display:block;height:100%;width:${S.earned>0&&S.pct===0?100:S.pct}%;background:${warn?'#C0392B':'#C2410C'}"></i></div>
            <span style="font-size:10.5px;color:#8A929E;white-space:nowrap">${S.toNext===0?'ครบรอบพอดี':('อีก '+S.toNext+' หัวถึงสิทธิ์ถัดไป')}</span>
          </div>
          <div style="display:flex;gap:14px;margin-top:6px;font-size:10.5px;flex-wrap:wrap">
            <span>ได้สิทธิ์ <b>${S.earned}</b> ที่</span>
            <span>ใช้ไปแล้ว <b>${S.used}</b> ที่</span>
            <span style="color:${S.left>0?'#0F6E56':'#8A929E'}">คงเหลือ <b>${S.left}</b> ที่</span>
            ${warn?`<span style="color:#C0392B">⚠ แถมเกินสิทธิ์ ${S.over} ที่</span>`:''}
          </div>
          <div style="font-size:9.5px;color:#A9A39A;margin-top:5px">
            "ใช้ไปแล้ว" นับจากหัว FOC ในใบจองช่วงนี้ · ถ้ามี FOC จากเหตุอื่นจะรวมมาด้วย · ระบบไม่บล็อกการขาย</div>
        </div>`;
      }
    }
    return `<div style="display:${bonusBar?'block':'flex'};align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--border,#eee);border-radius:10px;background:#fff;${st.key==='void'?'opacity:.6;':''}">
      ${bonusBar?'<div style="display:flex;align-items:center;gap:10px">':''}
      <span style="background:${isPromo?'#FCE9D6':'#E6EEF6'};color:${isPromo?'#9A5410':'#1F5C8F'};font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px;letter-spacing:.04em">${isPromo?'PROMO':'MAIN'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span>${_ctEsc(isPromo&&pm!=='rate'?(c.note||'Promotion'):_ctRateName(c.rateTypeId))}</span>${pmTag}${c.version?`<span style="color:#aaa;font-weight:400;font-size:10px">· ${_ctEsc(c.version)}</span>`:''}</div>
        <div style="font-size:10.5px;color:#888;margin-top:1px">${_ctFmt(c.activeFrom)} – ${_ctFmt(c.activeTo)}${routes.length?` · ${routes.length} route: ${_ctEsc(routes.slice(0,4).join(', '))}${routes.length>4?'…':''}`:''}</div>
      </div>
      <span style="background:${st.bg};color:${st.color};font-size:9px;font-weight:600;padding:2px 8px;border-radius:8px;white-space:nowrap">${st.label}</span>
      <button onclick="ctPromoView('${c.id}','${agentId}')" title="ดูราคาและเงื่อนไขทั้งใบ" style="background:none;border:1px solid #DED8CE;color:#5F5E5A;border-radius:8px;padding:3px 9px;font-size:10px;cursor:pointer;white-space:nowrap">ดู</button>
      ${isPromo&&st.key!=='void'&&canEdit?`<button onclick="ctOpenAddPromo('${agentId}','${c.id}')" title="แก้ไขใบโปรนี้" style="background:none;border:1px solid #CFE0EE;color:#1F5C8F;border-radius:8px;padding:3px 9px;font-size:10px;cursor:pointer;white-space:nowrap">แก้ไข</button>`:''}
      <button onclick="ctDocForContract('${c.id}','${agentId}')" style="background:none;border:1px solid #CFE0EE;color:#1F5C8F;border-radius:8px;padding:3px 9px;font-size:10px;cursor:pointer;white-space:nowrap">${c.docId?'สัญญา ✓':'ออกสัญญา'}</button>
      ${isPromo&&st.key!=='void'&&canEdit?`<button onclick="ctVoidContract('${c.id}','${agentId}')" title="ยกเลิกใบโปรนี้ · ราคากลับไปใช้ Main" style="background:none;border:1px solid #E4C0C0;color:#A32D2D;border-radius:8px;padding:3px 9px;font-size:10px;cursor:pointer">ยกเลิก</button>`:''}
      ${bonusBar?'</div>':''}${bonusBar}
    </div>`;
  };
  return `<div style="margin-bottom:14px;background:var(--sand,#faf9f6);border:1px solid var(--border,#eee);border-radius:14px;padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700">สัญญา (Contracts) <span style="color:#aaa;font-weight:400">${cons.length}</span></div>
      ${canEdit?`<div style="display:flex;gap:8px">
        <button onclick="ctOpenRenewal('${agentId}')" title="ต่อสัญญาได้ทุกเมื่อ · ไม่ต้องรอใกล้หมด" style="background:#fff;color:#1683C7;border:1px solid #9FCBE8;border-radius:10px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer">↻ ต่อสัญญา</button>
        <button onclick="ctOpenAddPromo('${agentId}')" style="background:#1683C7;color:#fff;border:none;border-radius:10px;padding:6px 13px;font-size:11px;font-weight:600;cursor:pointer">+ เพิ่ม Promotion</button>
      </div>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:7px">${cons.length?cons.map(row).join(''):`<div style="font-size:11px;color:#aaa;text-align:center;padding:10px">ยังไม่มีสัญญา</div>`}</div>
    <div style="margin-top:11px;padding-top:10px;border-top:1px solid var(--border,#eee)">
      <div style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8A929E;margin-bottom:7px">\u0e25\u0e33\u0e14\u0e31\u0e1a\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e23\u0e32\u0e04\u0e32 \u00b7 \u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e25\u0e48\u0e08\u0e32\u0e01\u0e1a\u0e19\u0e25\u0e07\u0e25\u0e48\u0e32\u0e07</div>
      <div style="display:flex;gap:9px;align-items:flex-start;font-size:11px;line-height:1.6;color:#4A5464">
        <span style="background:#FCE9D6;color:#9A5410;font-size:9px;font-weight:700;padding:2px 7px;border-radius:7px;margin-top:1px;white-space:nowrap">1 PROMO</span>
        <div style="flex:1">\u0e17\u0e31\u0e1a\u0e01\u0e48\u0e2d\u0e19\u0e40\u0e2a\u0e21\u0e2d \u0e40\u0e09\u0e1e\u0e32\u0e30 route \u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e27\u0e49 + \u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07<b>\u0e27\u0e31\u0e19\u0e40\u0e14\u0e34\u0e19\u0e17\u0e32\u0e07</b>\u0e17\u0e35\u0e48\u0e23\u0e30\u0e1a\u0e38 \u00b7 \u0e43\u0e1a\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e0a\u0e48\u0e27\u0e07\u0e27\u0e31\u0e19\u0e08\u0e2d\u0e07\u0e44\u0e27\u0e49 \u0e15\u0e49\u0e2d\u0e07\u0e40\u0e02\u0e49\u0e32\u0e17\u0e31\u0e49\u0e07\u0e2a\u0e2d\u0e07\u0e0a\u0e48\u0e27\u0e07
          <div style="color:#8A929E;font-size:10.5px">\u0e0b\u0e49\u0e2d\u0e19\u0e01\u0e31\u0e19\u0e2b\u0e25\u0e32\u0e22\u0e43\u0e1a \u2192 priority \u0e2a\u0e39\u0e07\u0e01\u0e27\u0e48\u0e32\u0e0a\u0e19\u0e30 \u00b7 \u0e40\u0e17\u0e48\u0e32\u0e01\u0e31\u0e19 \u2192 \u0e43\u0e1a\u0e17\u0e35\u0e48\u0e40\u0e23\u0e34\u0e48\u0e21\u0e17\u0e35\u0e2b\u0e25\u0e31\u0e07\u0e0a\u0e19\u0e30</div>
        </div>
      </div>
      <div style="display:flex;gap:9px;align-items:flex-start;font-size:11px;line-height:1.6;color:#4A5464;margin-top:5px">
        <span style="background:#F1EFE8;color:#5F5E5A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:7px;margin-top:1px;white-space:nowrap">2 \u0e02\u0e49\u0e32\u0e21</span>
        <div style="flex:1">\u0e16\u0e49\u0e32 PROMO \u0e19\u0e31\u0e49\u0e19\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e04\u0e32\u0e02\u0e2d\u0e07 route \u0e19\u0e31\u0e49\u0e19 (\u0e44\u0e21\u0e48\u0e27\u0e48\u0e32\u0e08\u0e30\u0e15\u0e31\u0e49\u0e07\u0e23\u0e32\u0e04\u0e32\u0e41\u0e1a\u0e1a\u0e44\u0e2b\u0e19) \u0e2b\u0e23\u0e37\u0e2d\u0e16\u0e39\u0e01\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 \u2192 \u0e02\u0e49\u0e32\u0e21 \u0e44\u0e21\u0e48\u0e04\u0e34\u0e14\u0e40\u0e1b\u0e47\u0e19 0</div>
      </div>
      <div style="display:flex;gap:9px;align-items:flex-start;font-size:11px;line-height:1.6;color:#4A5464;margin-top:5px">
        <span style="background:#E6EEF6;color:#1F5C8F;font-size:9px;font-weight:700;padding:2px 7px;border-radius:7px;margin-top:1px;white-space:nowrap">3 MAIN</span>
        <div style="flex:1">\u0e23\u0e32\u0e04\u0e32\u0e21\u0e32\u0e15\u0e23\u0e10\u0e32\u0e19 \u00b7 \u0e43\u0e0a\u0e49\u0e17\u0e38\u0e01\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e42\u0e1b\u0e23\u0e17\u0e31\u0e1a \u00b7 \u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e15\u0e32\u0e23\u0e32\u0e07\u0e02\u0e49\u0e32\u0e07\u0e25\u0e48\u0e32\u0e07</div>
      </div>
    </div>
  </div>`;
}
function ctDocForContract(contractId, agentId){
  const c=((typeof SB_CONTRACTS!=='undefined'&&Array.isArray(SB_CONTRACTS))?SB_CONTRACTS:[]).find(x=>x&&x.id===contractId);
  if(!c){ if(typeof flShowToast==='function') flShowToast('ไม่พบสัญญา','error'); return; }
  if(typeof ctDocOpen!=='function'){ alert('ระบบเอกสารสัญญายังไม่พร้อม'); return; }
  // Issue THIS contract's document: its rate type + program periods + window/version override the agent's.
  ctDocOpen(agentId, {contractId:c.id, rateTypeId:c.rateTypeId, programPeriods:c.programPeriods, version:c.version, from:c.activeFrom, to:c.activeTo});
}
function ctVoidContract(contractId, agentId){
  if(typeof laCanEditArea==='function' && !laCanEditArea('sales')){ if(typeof flShowToast==='function') flShowToast('ไม่มีสิทธิ์แก้ไข','error'); return; }
  const c=(SB_CONTRACTS||[]).find(x=>x.id===contractId); if(!c) return;
  if(!confirm('ยกเลิก Promotion นี้? ราคาจะกลับไปใช้ Main')) return;
  c.status='void'; c.voidedBy=(typeof laBy==='function'?laBy():'user'); c.voidedDate=new Date().toISOString();
  if(typeof sbContractsPersist==='function') sbContractsPersist();
  if(typeof agSwitchTab==='function') agSwitchTab('prices', agentId);   /* §promoMx */
  else if(typeof agRenderDetail==='function') agRenderDetail(agentId);
}

function ctPromoSwitch(mode){
  _ctPromoCtx && (_ctPromoCtx.mode = mode);
  [['rate','ct-promo-box-rate'], ['own','ct-promo-box-own'], ['discount','ct-promo-box-disc']]
    .forEach(function(x){
      var el = document.getElementById(x[1]);
      if(el) el.style.display = (mode === x[0]) ? '' : 'none';
    });
  if(mode === 'own') ctPromoTbl();
}
/* ตัวอย่างผลของส่วนลด · คนตั้งราคาต้องเห็นเลขจริงก่อนกดบันทึก ไม่ใช่เดาเอาจาก % */
function ctPromoDiscPrev(){
  var host = document.getElementById('ct-promo-disc-prev'); if(!host || !_ctPromoCtx) return;
  var md = ((document.querySelector('input[name="ct-promo-dmode"]:checked') || {}).value) || 'pct';
  var dv = +((document.getElementById('ct-promo-dval') || {}).value) || 0;
  var RS = ctPromoRoutesPicked();
  if(!dv || !RS.length){ host.innerHTML = '<span style="color:#8A929E">ใส่ตัวเลขส่วนลดแล้วจะเห็นตัวอย่างราคาที่นี่</span>'; return; }
  var mr = laPromoMainRt(_ctPromoCtx.agentId);
  var rows = RS.slice(0, 3).map(function(rid){
    var z = mr && mr.seatRates && mr.seatRates[rid] && mr.seatRates[rid].PK;
    if(!z) return '<div>' + _ctEsc(_ctRouteName(rid)) + ' · <span style="color:#A32D2D">Main ไม่มีราคาของ route นี้ → โปรจะถูกข้าม</span></div>';
    var f = function(k){
      var v = +z[k] || 0; if(v <= 0) return '—';
      var n = Math.max(0, md === 'amt' ? Math.round(v - dv) : Math.round(v * (1 - dv / 100)));
      return v.toLocaleString() + ' → <b>' + n.toLocaleString() + '</b>';
    };
    return '<div>' + _ctEsc(_ctRouteName(rid)) + ' · PK · ผู้ใหญ่ไทย ' + f('adult-thai')
         + ' · ผู้ใหญ่ต่างชาติ ' + f('adult-fr') + '</div>';
  }).join('');
  host.innerHTML = rows + (RS.length > 3 ? ('<div style="color:#8A929E">…และอีก ' + (RS.length - 3) + ' route</div>') : '');
}
/* ราคาตั้งต้นของช่องหนึ่ง · มาจาก Rate Type ตัวหลักของเอเย่นต์ */
function _ctPromoBase(routeId, zone, k){
  var C = _ctPromoCtx; if(!C) return 0;
  var rt = ((typeof SB_RATE_TYPES !== 'undefined') ? SB_RATE_TYPES : [])
    .filter(function(x){ return x.id === C.mainRate; })[0];
  var z = rt && rt.seatRates && rt.seatRates[routeId] && rt.seatRates[routeId][zone];
  return z ? (+z[k] || 0) : 0;
}
function ctPromoRoutesPicked(){
  return [].slice.call(document.querySelectorAll('.ct-promo-route:checked')).map(function(el){ return el.value; });
}
/* วาดตารางใหม่ · เก็บค่าที่คนกรอกไว้แล้วก่อน จะได้ไม่หายตอนติ๊ก route เพิ่ม */
function ctPromoTbl(){
  var host = document.getElementById('ct-promo-rates'); if(!host) return;
  var keep = {};
  [].slice.call(host.querySelectorAll('.ct-pr-in')).forEach(function(el){
    keep[el.getAttribute('data-r') + '|' + el.getAttribute('data-z') + '|' + el.getAttribute('data-k')] = el.value;
  });
  var RS = ctPromoRoutesPicked();
  if(!RS.length){
    host.innerHTML = '<div style="font-size:11px;color:#A32D2D;padding:8px 0">ติ๊กเลือก route ด้านบนก่อน แล้วตารางราคาจะขึ้นตรงนี้</div>';
    return;
  }
  var ZL = [['PK','PK'], ['KL','KL'], ['NoTransfer','NO TRANSFER']];
  var KL = [['adult-thai','THAI · ADULT'], ['child-thai','THAI · CHILD'],
            ['adult-fr','FRN · ADULT'], ['child-fr','FRN · CHILD']];
  var th = '<th style="text-align:left;padding:5px 7px;font-size:9.5px;font-weight:700;color:#8A929E;letter-spacing:.04em">ROUTE</th>'
         + '<th style="text-align:left;padding:5px 7px;font-size:9.5px;font-weight:700;color:#8A929E">ZONE</th>'
         + KL.map(function(k){ return '<th style="text-align:right;padding:5px 7px;font-size:9.5px;font-weight:700;color:#8A929E;white-space:nowrap">' + k[1] + '</th>'; }).join('');
  var body = '';
  RS.forEach(function(rid){
    ZL.forEach(function(z, zi){
      body += '<tr>'
        + (zi === 0 ? ('<td rowspan="3" style="padding:6px 7px;font-size:11px;font-weight:600;color:#3C4553;border-top:1px solid #EFECE6;vertical-align:top">'
            + _ctEsc(_ctRouteName(rid)) + '</td>') : '')
        + '<td style="padding:4px 7px;font-size:10.5px;color:#8A929E' + (zi === 0 ? ';border-top:1px solid #EFECE6' : '') + '">' + z[1] + '</td>'
        + KL.map(function(k){
            var key = rid + '|' + z[0] + '|' + k[0];
            /* §b2bPromo · ลำดับค่าตั้งต้น · ที่พิมพ์ค้างไว้ > ราคาในใบที่กำลังแก้ > ราคา Main
         โหมดแก้ไขต้องเห็นของเดิมก่อน ไม่ใช่โดนราคา Main ทับจนแก้ที่ทำไว้หาย */
      var _ed = _ctPromoCtx && _ctPromoCtx.edit;
      var _edv = (_ed && _ed.rates && _ed.rates[rid] && _ed.rates[rid][z[0]]
                  && _ed.rates[rid][z[0]][k[0]] != null) ? _ed.rates[rid][z[0]][k[0]] : null;
      var v = (keep[key] != null) ? keep[key] : ((_edv != null) ? _edv : _ctPromoBase(rid, z[0], k[0]));
            return '<td style="padding:3px 4px' + (zi === 0 ? ';border-top:1px solid #EFECE6' : '') + '">'
              + '<input class="ct-pr-in" data-r="' + _ctEsc(rid) + '" data-z="' + z[0] + '" data-k="' + k[0] + '"'
              + ' value="' + _ctEsc(v) + '" inputmode="numeric"'
              + ' style="width:100%;min-width:64px;padding:5px 7px;border:1px solid #ddd;border-radius:7px;'
              + 'font-size:11.5px;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums"></td>';
          }).join('')
        + '</tr>';
    });
  });
  host.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>'
    + '<div style="font-size:10px;color:#8A929E;margin-top:6px;line-height:1.6">'
    + 'เติมราคาจาก Main มาให้แล้ว · แก้เฉพาะช่องที่เปลี่ยน<br>'
    + 'โซนไหนไม่ขายในโปรนี้ ให้ลบให้ว่างทั้งแถว → ระบบจะถอยไปใช้เรทมาตรฐานของโซนนั้น</div>';
}
/* ══ §b2bPromo · ดูรายละเอียดสัญญา/โปรโมชั่น · อ่านอย่างเดียว ══════════════════════════════════
   แถวในการ์ดบอกได้แค่ชื่อกับช่วงวัน · ราคาจริงที่ใบนี้ใช้ไม่เคยเห็นจากหน้าจอเลย
   ต้องไปเปิด Rate Type อีกหน้าหนึ่งแล้วเทียบเอง หรือเดาจากชื่อ
   หน้านี้เอามาวางให้ครบในที่เดียว · ใช้กับ MAIN ได้ด้วย (ราคามาจาก Rate Type ที่ผูกไว้) */
function ctPromoView(id, agentId){
  var c = laPromoById(id); if(!c) return;
  var a = (typeof sbGetAgent === 'function') ? sbGetAgent(agentId || c.agentId) : null;
  var st = _ctContractStatus(c);
  var isPromo = (c.kind === 'promo');
  var pm = isPromo ? (c.priceMode || 'rate') : 'rate';
  var e = _ctEsc, fd = function(x){ return x ? ((typeof _rtFmtDate === 'function') ? (_rtFmtDate(x) || x) : x) : '—'; };
  var PP = c.programPeriods || [];
  /* ชุดราคาที่ใบนี้ใช้จริง · ประกอบด้วยตัวเดียวกับที่เครื่องคิดราคาใช้ ไม่ได้เขียนสูตรซ้ำ */
  var mainRt = laPromoMainRt(c.agentId);
  var rtOf = function(rid){
    if(!isPromo || pm === 'rate'){
      var rt = ((typeof SB_RATE_TYPES !== 'undefined') ? SB_RATE_TYPES : [])
        .filter(function(x){ return x.id === c.rateTypeId; })[0];
      return (rt && rt.seatRates && rt.seatRates[rid]) || null;
    }
    var r = laPromoRate(c, rid, mainRt);
    return (r && r.seatRates && r.seatRates[rid]) || null;
  };
  var KL = [['adult-thai','ไทย · ผู้ใหญ่'], ['child-thai','ไทย · เด็ก'],
            ['adult-fr','ต่างชาติ · ผู้ใหญ่'], ['child-fr','ต่างชาติ · เด็ก']];
  var rows = PP.map(function(p){
    var Z = rtOf(p.routeId);
    var sub = LA_PROMO_ZONES.filter(function(z){ return Z && Z[z]; }).map(function(z){
      var ov = (pm === 'own' && c.rates && c.rates[p.routeId] && c.rates[p.routeId][z]);
      return '<tr><td style="padding:3px 8px;font-size:10.5px;color:#8A929E">' + z + '</td>'
        + KL.map(function(k){
            var v = +Z[z][k[0]] || 0;
            var base = mainRt && mainRt.seatRates && mainRt.seatRates[p.routeId]
                    && mainRt.seatRates[p.routeId][z] ? (+mainRt.seatRates[p.routeId][z][k[0]] || 0) : 0;
            var diff = (isPromo && pm !== 'rate' && base > 0 && v !== base);
            return '<td style="padding:3px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px'
              + (ov ? ';font-weight:700' : '') + '">' + (v ? v.toLocaleString() : '—')
              + (diff ? ('<span style="color:#9A5410;font-size:9.5px"> (' + base.toLocaleString() + ')</span>') : '') + '</td>';
          }).join('') + '</tr>';
    }).join('');
    return '<div style="margin-bottom:9px">'
      + '<div style="font-size:11.5px;font-weight:700;color:#3C4553">' + e(_ctRouteName(p.routeId)) + '</div>'
      + '<div style="font-size:10px;color:#8A929E;margin:2px 0 4px">'
        + 'เดินทาง ' + fd(p.travelFrom) + ' → ' + fd(p.travelTo)
        + (c.bookWin ? (' · จอง ' + fd(p.bookFrom) + ' → ' + fd(p.bookTo)) : ' · ไม่จำกัดวันจอง') + '</div>'
      + (sub ? ('<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #EFECE6;border-radius:8px">'
          + '<thead><tr><th style="padding:3px 8px;text-align:left;font-size:9px;color:#8A929E">โซน</th>'
          + KL.map(function(k){ return '<th style="padding:3px 8px;text-align:right;font-size:9px;color:#8A929E;white-space:nowrap">' + k[1] + '</th>'; }).join('')
          + '</tr></thead><tbody>' + sub + '</tbody></table>')
        : '<div style="font-size:10.5px;color:#A32D2D">ไม่มีราคาของเส้นทางนี้ → ระบบข้าม ใช้เรทมาตรฐานแทน</div>')
      + '</div>';
  }).join('');
  var S = isPromo ? laPromoStat(c) : null;
  var wrap = document.createElement('div');
  wrap.id = 'ct-promo-view';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:100050;display:flex;align-items:center;justify-content:center;padding:20px';
  wrap.innerHTML = '<div style="background:#faf9f6;border-radius:16px;max-width:760px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
    + '<div style="display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid #eee;background:#fff;border-radius:16px 16px 0 0">'
      + '<span style="background:' + (isPromo ? '#FCE9D6' : '#E6EEF6') + ';color:' + (isPromo ? '#9A5410' : '#1F5C8F')
      + ';font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px">' + (isPromo ? 'PROMO' : 'MAIN') + '</span>'
      + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">'
      + e(isPromo && pm !== 'rate' ? (c.note || 'Promotion') : _ctRateName(c.rateTypeId)) + '</div>'
      + '<div style="font-size:10.5px;color:#8A929E">' + e((a && a.name) || '') + ' · ' + fd(c.activeFrom) + ' – ' + fd(c.activeTo) + '</div></div>'
      + '<span style="background:' + st.bg + ';color:' + st.color + ';font-size:9px;font-weight:600;padding:2px 8px;border-radius:8px">' + st.label + '</span>'
      + '<button onclick="ctPromoViewClose()" style="background:none;border:none;font-size:20px;color:#999;cursor:pointer;line-height:1">&times;</button></div>'
    + '<div style="padding:14px 18px">'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#4A5464;margin-bottom:12px">'
        + '<span>ที่มาของราคา <b>' + e(LA_PROMO_MODE_TXT[pm] || pm) + '</b>'
          + (pm === 'discount' ? (' · ' + e(laPromoDiscTxt(c))) : '')
          + (pm === 'rate' ? (' · ' + e(_ctRateName(c.rateTypeId))) : '') + '</span>'
        + '<span>Priority <b>' + (c.priority || 0) + '</b></span>'
        + '<span>' + PP.length + ' เส้นทาง</span>'
        + (c.note ? ('<span>หมายเหตุ <b>' + e(c.note) + '</b></span>') : '') + '</div>'
      + (S ? ('<div style="background:#fff;border:1px solid #EFECE6;border-radius:10px;padding:10px 13px;margin-bottom:12px;font-size:11px">'
          + '<b>ซื้อ ' + S.buy + ' แถม 1</b> · นับ' + e(S.basisTxt)
          + ' · ขายแล้ว <b>' + S.sold.toLocaleString() + '</b> หัว · ได้สิทธิ์ <b>' + S.earned + '</b> ที่'
          + ' · ใช้ไป <b>' + S.used + '</b> · เหลือ <b>' + S.left + '</b>'
          + (S.toNext ? (' · อีก ' + S.toNext + ' หัวถึงสิทธิ์ถัดไป') : '') + '</div>') : '')
      + (pm !== 'rate' ? '<div style="font-size:10px;color:#8A929E;margin-bottom:7px">เลขในวงเล็บคือราคา Main เดิม · ช่องที่ไม่ต่างจาก Main แปลว่าโปรไม่ได้แตะ</div>' : '')
      + (rows || '<div style="font-size:11px;color:#8A929E">ไม่มีเส้นทางในใบนี้</div>')
    + '</div></div>';
  document.body.appendChild(wrap);
}
function ctPromoViewClose(){ var m = document.getElementById('ct-promo-view'); if(m) m.remove(); }
function ctOpenAddPromo(agentId, editId){
  const a=(typeof sbGetAgent==='function')?sbGetAgent(agentId):null; if(!a) return;
  const main=((typeof SB_CONTRACTS!=='undefined'&&Array.isArray(SB_CONTRACTS))?SB_CONTRACTS:[]).find(c=>c&&c.agentId===agentId&&c.kind==='main');
  const mainRate=(main&&main.rateTypeId)||a.rateTypeId||'';
  /* §b2bPromo · โหมดแก้ไข · ใบเดิมอาจมี route ที่ไม่ได้อยู่ในสัญญาหลักแล้ว
     ถ้าไม่รวมเข้ามาด้วย พอกดแก้แล้วเซฟ route นั้นจะหายไปเงียบ ๆ */
  const ed=editId?((typeof SB_CONTRACTS!=='undefined'?SB_CONTRACTS:[]).find(c=>c&&c.id===editId)):null;
  const edRoutes=ed?(ed.programPeriods||[]).map(p=>p.routeId):[];
  const routeIds=[...new Set([...(a.programPeriods||[]).map(p=>p.routeId), ...((main&&main.programPeriods)||[]).map(p=>p.routeId), ...edRoutes].filter(Boolean))];
  const edP0=ed?((ed.programPeriods||[])[0]||{}):{};
  const edMode=ed?(ed.priceMode||'rate'):'rate';
  const edOn=r=>ed?(edRoutes.indexOf(r)>=0):true;
  const rtSel=(ed&&ed.rateTypeId)||mainRate;
  const rtOpts=((typeof SB_RATE_TYPES!=='undefined')?SB_RATE_TYPES:[]).map(r=>`<option value="${r.id}"${r.id===rtSel?' selected':''}>${_ctEsc(r.name||r.code||r.id)}</option>`).join('');
  const routeChecks=routeIds.length?routeIds.map(rid=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:4px 9px;cursor:pointer"><input type="checkbox" class="ct-promo-route" value="${rid}" onchange="ctPromoTbl();ctPromoDiscPrev()"${edOn(rid)?' checked':''}> ${_ctEsc(_ctRouteName(rid))}</label>`).join(''):'<div style="font-size:11px;color:#c0392b">agent นี้ยังไม่มี route ในสัญญา — เพิ่ม route ในโปรแกรมก่อน</div>';
  const today=(typeof TODAY_STR!=='undefined'&&TODAY_STR)?TODAY_STR:new Date().toISOString().slice(0,10);
  _ctPromoCtx={ agentId:agentId, mainRate:mainRate, mode:edMode, edit:ed||null };
  const lb='font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:4px';
  const inp='width:100%;padding:7px 9px;border:1px solid #ddd;border-radius:9px;font-size:12px;font-family:inherit';
  const wrap=document.createElement('div');
  wrap.id='ct-promo-modal';
  wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:100050;display:flex;align-items:center;justify-content:center;padding:20px';
  wrap.innerHTML=`<div style="background:#fff;border-radius:16px;max-width:820px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid #eee">
      <div style="font-size:14px;font-weight:700;flex:1">${ed?'แก้ไข':'เพิ่ม'} Promotion · ${_ctEsc(a.name||'')}</div>
      <button onclick="ctCloseAddPromo()" style="background:none;border:none;font-size:20px;color:#999;cursor:pointer;line-height:1">×</button>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:13px">

      <div>
        <label style="${lb}">ราคาโปรมาจาก</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;background:#F7F6F3;border:1px solid #e5e5e5;border-radius:9px;padding:7px 12px;cursor:pointer">
            <input type="radio" name="ct-promo-mode" value="rate"${edMode==='rate'?' checked':''} onchange="ctPromoSwitch('rate')"> Rate Type ที่มีอยู่</label>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;background:#F7F6F3;border:1px solid #e5e5e5;border-radius:9px;padding:7px 12px;cursor:pointer">
            <input type="radio" name="ct-promo-mode" value="own"${edMode==='own'?' checked':''} onchange="ctPromoSwitch('own')"> กรอกราคาเองในใบนี้</label>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;background:#F7F6F3;border:1px solid #e5e5e5;border-radius:9px;padding:7px 12px;cursor:pointer">
            <input type="radio" name="ct-promo-mode" value="discount"${edMode==='discount'?' checked':''} onchange="ctPromoSwitch('discount')"> ลดจาก Main</label>
        </div>
      </div>

      <div id="ct-promo-box-disc" style="display:none">
        <label style="${lb}">ส่วนลดจากราคา Main</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;cursor:pointer">
            <input type="radio" name="ct-promo-dmode" value="pct"${((ed&&ed.discount&&ed.discount.mode)||'pct')==='pct'?' checked':''} onchange="ctPromoDiscPrev()"> เปอร์เซ็นต์</label>
          <label style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;cursor:pointer">
            <input type="radio" name="ct-promo-dmode" value="amt"${((ed&&ed.discount&&ed.discount.mode)||'')==='amt'?' checked':''} onchange="ctPromoDiscPrev()"> จำนวนเงินต่อหัว</label>
          <input type="number" id="ct-promo-dval" min="0" step="1" value="${(ed&&ed.discount&&ed.discount.value)||10}" oninput="ctPromoDiscPrev()"
            style="width:110px;padding:7px 9px;border:1px solid #ddd;border-radius:9px;font-size:12px;font-family:inherit;text-align:right">
        </div>
        <div id="ct-promo-disc-prev" style="margin-top:7px;font-size:10.5px;color:#4A5464;line-height:1.7;background:#FBFAF8;border:1px solid #EFECE6;border-radius:8px;padding:7px 10px"></div>
        <div style="font-size:10px;color:#8A929E;margin-top:5px">ลดจาก<b>ราคาสัญญาหลัก</b>เสมอ · ช่องที่เป็น 0 อยู่แล้ว (ไม่ขาย) ลดแล้วยังเป็น 0</div>
      </div>

      <div id="ct-promo-box-rate">
        <label style="${lb}">Rate Type ของ Promo</label>
        <select id="ct-promo-rate" style="${inp}">${rtOpts}</select>
        <div style="font-size:10px;color:#888;margin-top:4px">ต้องการราคาโปรใหม่? <button onclick="ctCloseAddPromo(); if(typeof rtClone==='function') rtClone('${mainRate}');" style="background:none;border:none;color:#1683C7;font-size:10px;cursor:pointer;padding:0;text-decoration:underline">clone จาก Main แล้วแก้ราคา</button> (เซฟแล้วกลับมาเลือกที่นี่)</div>
      </div>

      <div style="background:#FBFAF8;border:1px solid #EFECE6;border-radius:10px;padding:11px 13px">
        <div style="font-size:11px;font-weight:700;color:#3C4553;margin-bottom:8px">ช่วงเวลา · ต้องเข้าทั้งสองช่วงถึงจะได้ราคาโปร</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:150px"><label style="${lb}">ต้องจองระหว่าง</label>
            <div style="display:flex;gap:6px">
              <input type="date" id="ct-promo-bfrom" value="${ed&&ed.bookWin?_ctEsc(edP0.bookFrom||''):''}" style="${inp}">
              <input type="date" id="ct-promo-bto" value="${ed&&ed.bookWin?_ctEsc(edP0.bookTo||''):''}" style="${inp}">
            </div></div>
          <div style="flex:1;min-width:150px"><label style="${lb}">ต้องเดินทางระหว่าง</label>
            <div style="display:flex;gap:6px">
              <input type="date" id="ct-promo-from" value="${ed?_ctEsc(ed.activeFrom||''):today}" style="${inp}">
              <input type="date" id="ct-promo-to" value="${ed?_ctEsc(ed.activeTo||''):''}" style="${inp}">
            </div></div>
        </div>
        <div style="font-size:10px;color:#8A929E;margin-top:6px">ช่องวันจองปล่อยว่าง = ไม่จำกัดว่าจองเมื่อไหร่ · ดูแค่วันเดินทาง (เหมือนโปรใบเก่า)</div>
      </div>

      <div>
        <label style="${lb}">Routes ที่ใช้ Promo</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${routeChecks}</div>
      </div>

      <div id="ct-promo-box-own" style="display:none">
        <label style="${lb}">ราคาโปร · เฉพาะ route ที่ติ๊กไว้</label>
        <div id="ct-promo-rates" style="border:1px solid #EFECE6;border-radius:10px;padding:9px 11px;background:#fff;overflow-x:auto"></div>
      </div>

      <div style="background:#FBFAF8;border:1px solid #EFECE6;border-radius:10px;padding:11px 13px">
        <label style="display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;color:#3C4553;cursor:pointer">
          <input type="checkbox" id="ct-promo-bon"${(ed&&ed.bonus&&ed.bonus.on)?' checked':''} onchange="var b=document.getElementById('ct-promo-bon-box'); if(b) b.style.display=this.checked?'':'none'"> ซื้อ N แถม 1</label>
        <div id="ct-promo-bon-box" style="display:${(ed&&ed.bonus&&ed.bonus.on)?'':'none'};margin-top:9px">
          <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-size:11.5px">
            <span>ซื้อครบ</span>
            <input type="number" id="ct-promo-bon-n" min="1" step="1" value="${(ed&&ed.bonus&&ed.bonus.buy)||10}"
              style="width:78px;padding:7px 9px;border:1px solid #ddd;border-radius:9px;font-size:12px;font-family:inherit;text-align:right">
            <span>หัว แถม 1 ที่ · นับจาก</span>
            <select id="ct-promo-bon-basis" style="padding:7px 9px;border:1px solid #ddd;border-radius:9px;font-size:12px;font-family:inherit">
              <option value="adchd"${((ed&&ed.bonus&&ed.bonus.basis)||'adchd')==='adchd'?' selected':''}>ผู้ใหญ่ + เด็ก</option>
              <option value="ad"${((ed&&ed.bonus&&ed.bonus.basis)||'')==='ad'?' selected':''}>เฉพาะผู้ใหญ่</option>
            </select>
          </div>
          <div style="font-size:10px;color:#8A929E;margin-top:7px;line-height:1.6">
            นับสะสมตลอดช่วงโปร ไม่ใช่ต่อใบจอง · ระบบ<b>นับกับเตือน</b>ให้เท่านั้น ไม่เติมหัว FOC เอง<br>
            ความคืบหน้าดูได้ที่แถบใบโปรในการ์ดสัญญา</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:end">
        <div style="width:110px"><label style="${lb}">Priority</label><input type="number" id="ct-promo-prio" value="${(ed&&ed.priority)||10}" min="1" style="${inp}"></div>
        <div style="flex:1"><label style="${lb}">หมายเหตุ</label><input type="text" id="ct-promo-note" value="${ed?_ctEsc(ed.note||''):''}" placeholder="เช่น Xmas Promo" style="${inp}"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;padding:13px 18px;border-top:1px solid #eee;background:#faf9f6">
      <button onclick="ctCloseAddPromo()" style="background:#fff;border:1px solid #ddd;color:#555;border-radius:10px;padding:8px 15px;font-size:12px;cursor:pointer">ยกเลิก</button>
      <button onclick="ctSaveAddPromo('${agentId}'${ed?(",'"+ed.id+"'"):''})" style="background:#1683C7;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer">${ed?'บันทึกการแก้ไข':'สร้าง Promotion'}</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  ctPromoSwitch(edMode);                 /* §b2bPromo · โชว์กล่องให้ตรงโหมด + วาดตารางถ้าเป็นโหมดกรอกเอง */
  if(edMode==='discount') ctPromoDiscPrev();
}
function ctCloseAddPromo(){ _ctPromoCtx=null; const m=document.getElementById('ct-promo-modal'); if(m) m.remove(); }
function ctSaveAddPromo(agentId, editId){
  const mode=((document.querySelector('input[name="ct-promo-mode"]:checked')||{}).value)||'rate';
  const rateTypeId=(document.getElementById('ct-promo-rate')||{}).value||'';
  const from=(document.getElementById('ct-promo-from')||{}).value||'';
  const to=(document.getElementById('ct-promo-to')||{}).value||'';
  const bfrom=(document.getElementById('ct-promo-bfrom')||{}).value||'';
  const bto=(document.getElementById('ct-promo-bto')||{}).value||'';
  const prio=parseInt((document.getElementById('ct-promo-prio')||{}).value,10)||10;
  const note=((document.getElementById('ct-promo-note')||{}).value||'').trim();
  const routes=ctPromoRoutesPicked();
  if(!from||!to){ alert('ระบุช่วงวันเดินทาง'); return; }
  if(to<from){ alert('วันเดินทางสุดท้ายต้องไม่ก่อนวันแรก'); return; }
  if((bfrom&&bto)&&bto<bfrom){ alert('วันจองสุดท้ายต้องไม่ก่อนวันแรก'); return; }
  if(!routes.length){ alert('เลือกอย่างน้อย 1 route'); return; }

  /* §b2bPromo · โหมดกรอกเอง · เก็บเฉพาะโซนที่มีตัวเลขจริง
     โซนที่ถูกลบจนว่างทั้งแถว = ไม่ขายโซนนั้นในโปรนี้ → ไม่เก็บ ตัวคิดราคาจะถอยไปเรทมาตรฐานเอง */
  let rates=null;
  if(mode==='own'){
    rates={};
    [].slice.call(document.querySelectorAll('#ct-promo-rates .ct-pr-in')).forEach(el=>{
      const r=el.getAttribute('data-r'), z=el.getAttribute('data-z'), k=el.getAttribute('data-k');
      const v=String(el.value||'').trim(); if(v==='') return;
      const n=+v; if(!isFinite(n)||n<0) return;
      (rates[r]=rates[r]||{}); (rates[r][z]=rates[r][z]||{}); rates[r][z][k]=n;
    });
    /* โซนที่ผู้ใหญ่ทั้งสองสัญชาติเป็น 0 = ไม่มีราคาจริง · ตัดทิ้ง ไม่งั้นจะกลายเป็นขายฟรี */
    Object.keys(rates).forEach(r=>{
      Object.keys(rates[r]).forEach(z=>{
        const Z=rates[r][z];
        if(!(+Z['adult-thai']||0) && !(+Z['adult-fr']||0)) delete rates[r][z];
      });
      if(!Object.keys(rates[r]).length) delete rates[r];
    });
    const covered=routes.filter(r=>rates[r]);
    if(!covered.length){ alert('ยังไม่มีราคาในตารางเลย · กรอกราคาผู้ใหญ่อย่างน้อยหนึ่งโซน'); return; }
    if(covered.length<routes.length){
      const miss=routes.filter(r=>!rates[r]).map(r=>_ctRouteName(r)).join(', ');
      if(!confirm(routes.length-covered.length+' route ไม่มีราคาในโปรนี้ ('+miss+')\n\n'
        +'route พวกนั้นจะใช้เรทมาตรฐานตามเดิม · สร้างต่อเลยไหม')) return;
    }
  } else if(mode==='discount'){
    const dv=+((document.getElementById('ct-promo-dval')||{}).value)||0;
    if(!(dv>0)){ alert('ใส่ตัวเลขส่วนลดก่อน'); return; }
    const dmode=((document.querySelector('input[name="ct-promo-dmode"]:checked')||{}).value)||'pct';
    if(dmode==='pct' && dv>=100){ alert('ส่วนลดเป็นเปอร์เซ็นต์ต้องน้อยกว่า 100'); return; }
    /* ⚠ ลดเป็นจำนวนเงินมากกว่าราคาจริง = ทุกช่องกลายเป็น 0
       ตัวคิดราคาจะอ่านว่า "ไม่ได้เปิดขาย" แล้วคืนยอด 0 ไม่ใช่ถอยไปเรทมาตรฐาน
       เป็นความผิดตอนพิมพ์ ไม่ใช่เจตนา · ดักที่นี่ดีกว่าไปเงียบตอนขาย */
    const mr0=laPromoMainRt(agentId);
    if(dmode==='amt'){
      let lo=Infinity;
      routes.forEach(r=>{ const zz=(mr0&&mr0.seatRates&&mr0.seatRates[r])||{};
        Object.keys(zz).forEach(z=>{ ['adult-thai','adult-fr'].forEach(k=>{
          const v=+zz[z][k]||0; if(v>0 && v<lo) lo=v; }); }); });
      if(lo!==Infinity && dv>=lo){
        alert('ส่วนลด '+dv.toLocaleString()+' บาท มากกว่าหรือเท่ากับราคาผู้ใหญ่ที่ถูกที่สุดใน Main ('
          +lo.toLocaleString()+' บาท)\n\nราคาจะกลายเป็น 0 แล้วระบบจะอ่านว่าไม่ได้เปิดขาย · ลดจำนวนลงก่อน');
        return;
      }
    }
    /* Main ไม่มีราคาของ route ไหน = ไม่มีอะไรให้ลด · เตือนก่อน ไม่ปล่อยให้เงียบ */
    const mr=laPromoMainRt(agentId);
    const miss=routes.filter(r=>!(mr&&mr.seatRates&&mr.seatRates[r]));
    if(miss.length){
      if(!confirm(miss.length+' route ไม่มีราคาใน Main ('+miss.map(r=>_ctRouteName(r)).join(', ')+')\n\n'
        +'ไม่มีอะไรให้ลด · route พวกนั้นจะใช้เรทมาตรฐานตามเดิม · สร้างต่อเลยไหม')) return;
    }
  } else {
    if(!rateTypeId){ alert('เลือก Rate Type ของ Promo ก่อน'); return; }
  }
  /* §b2bPromo · ของแถม · แยกจากราคา ใช้ร่วมกับโหมดไหนก็ได้
     ดีลจริงมีทั้ง "ลด 10% และซื้อ 10 แถม 1" พร้อมกัน จึงไม่ทำเป็นตัวเลือกเดียวกับราคา */
  let bonus=null;
  if((document.getElementById('ct-promo-bon')||{}).checked){
    const bn=parseInt((document.getElementById('ct-promo-bon-n')||{}).value,10)||0;
    if(bn<1){ alert('จำนวนที่ต้องซื้อต้องมากกว่า 0'); return; }
    bonus={ on:1, buy:bn, free:1,
            basis:((document.getElementById('ct-promo-bon-basis')||{}).value)||'adchd' };
  }

  /* §b2bPromo · bookWin บอกว่าใบนี้ตั้งใจใช้ช่วงวันจองจริง ๆ
     ใบเก่าไม่มีธงนี้ ตัวคิดราคาจึงไม่ไปแตะช่วงวันจองของมัน (ดูหมายเหตุที่ laPromoCovers) */
  const bookWin=(bfrom||bto)?1:0;
  const c={
    id:(typeof LA_UID==='function'?LA_UID('ct'):'ct'+Date.now().toString(36)),
    agentId, kind:'promo',
    priceMode:mode,
    rateTypeId:(mode==='rate'?rateTypeId:null),
    rates:(mode==='own'?rates:null),
    discount:(mode==='discount'?{
      mode:((document.querySelector('input[name="ct-promo-dmode"]:checked')||{}).value)||'pct',
      value:+((document.getElementById('ct-promo-dval')||{}).value)||0 }:null),
    bonus,
    bookWin,
    activeFrom:from, activeTo:to, priority:prio,
    version:'promo-'+from, status:'active',
    createdDate:(typeof TODAY_STR!=='undefined'&&TODAY_STR)?TODAY_STR:new Date().toISOString().slice(0,10),
    createdBy:(typeof laBy==='function'?laBy():'user'), note, docId:null,
    programPeriods:routes.map(rid=>({routeId:rid,
      bookFrom:bfrom||from, bookTo:bto||to, travelFrom:from, travelTo:to, note:''}))
  };
  if(typeof SB_CONTRACTS==='undefined'){ alert('SB_CONTRACTS not ready'); return; }
  if(editId){
    const i=SB_CONTRACTS.findIndex(x=>x&&x.id===editId);
    if(i<0){ alert('ไม่พบใบโปรที่จะแก้'); return; }
    const old=SB_CONTRACTS[i];
    /* §b2bPromo · ใบจองที่ขายไปแล้วผูกกับใบนี้ด้วย id · แก้ราคาที่นี่ = เลขทานของใบเก่าขยับตาม
       (ยอดเงินในใบจองไม่ขยับ · ตัวนั้นล็อกไว้แล้ว) บอกให้รู้ก่อน ไม่ใช่รู้ทีหลังตอนงง */
    let used=0;
    try{ (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
      (b.trips||[]).forEach(t=>{ if(t.promoId===editId) used++; }); }); }catch(_){}
    if(used>0 && !confirm('ใบโปรนี้ถูกใช้ขายไปแล้ว '+used+' ทริป\n\n'
      +'ยอดเงินในใบจองเก่าจะไม่เปลี่ยน (ล็อกไว้ตั้งแต่วันขาย)\n'
      +'แต่เลขเทียบในรายงานจะอ่านเงื่อนไขใหม่นี้แทน\n\nแก้ต่อเลยไหม')) return;
    c.id=old.id; c.createdDate=old.createdDate; c.createdBy=old.createdBy;
    c.docId=old.docId; c.version=old.version; c.status=old.status;
    SB_CONTRACTS[i]=c;
  } else SB_CONTRACTS.push(c);
  if(typeof sbContractsPersist==='function') sbContractsPersist();
  ctCloseAddPromo();
  if(typeof flShowToast==='function') flShowToast((editId?'แก้ไข Promotion แล้ว · ':'เพิ่ม Promotion แล้ว · ')+(LA_PROMO_MODE_TXT[mode]||mode)
    +(bonus?(' · ซื้อ '+bonus.buy+' แถม 1'):''));
  /* §promoMx · กล่องสัญญาอยู่หน้าราคาแล้ว · เด้งกลับไปที่เดิมที่กดมา */
  if(typeof agSwitchTab==='function') agSwitchTab('prices', agentId);
  else if(typeof agRenderDetail==='function') agRenderDetail(agentId);
}

function ctOpenRenewal(agentId){
  const a = sbGetAgent(agentId); if(!a) return;
  _ctRenewAgentId = agentId;
  _ctRenewStep = 1;

  // Pre-fill new period as +1 year from current end
  const oldEnd = new Date(a.contractEnd);
  const newStart = new Date(oldEnd); newStart.setDate(newStart.getDate()+1);
  const newEnd = new Date(newStart); newEnd.setFullYear(newEnd.getFullYear()+1); newEnd.setDate(newEnd.getDate()-1);

  // Derive next version number
  const oldVer = a.contractVersion || 'v2025-1';
  const m = oldVer.match(/v(\d{4})-(\d+)/);
  let newVer = oldVer + '-new';
  if(m){
    const newYear = parseInt(m[1])+1;
    newVer = `v${newYear}-1`;
  }

  _ctRenewDraft = {
    newStart: newStart.toISOString().slice(0,10),
    newEnd: newEnd.toISOString().slice(0,10),
    newVersion: newVer,
    carry: { programs:true, prices:true, addons:true, booking:true, signatory:false, company:true },
  };

  document.getElementById('ct-wiz-ttl').textContent = `ต่อสัญญา · ${a.name}`;
  document.getElementById('ct-wiz-sub').textContent = `Renewing from ${a.contractVersion} → ${newVer}`;
  document.getElementById('ct-wiz-modal').style.display = 'flex';
  ctRenewRender();
}

function ctCloseRenewal(){
  document.getElementById('ct-wiz-modal').style.display = 'none';
  _ctRenewAgentId = null;
  _ctRenewStep = 1;
  _ctRenewDraft = null;
}

function ctRenewSetField(key, val){ if(_ctRenewDraft) _ctRenewDraft[key] = val; }
function ctRenewToggleCarry(key){
  if(!_ctRenewDraft) return;
  _ctRenewDraft.carry[key] = !_ctRenewDraft.carry[key];
  ctRenewRender();
}
function ctRenewPeriodPreset(years){
  if(!_ctRenewDraft) return;
  const start = new Date(_ctRenewDraft.newStart);
  if(isNaN(start)) return;
  const end = new Date(start); end.setFullYear(end.getFullYear()+years); end.setDate(end.getDate()-1);
  _ctRenewDraft.newEnd = end.toISOString().slice(0,10);
  ctRenewRender();
}

function ctRenewRender(){
  const a = sbGetAgent(_ctRenewAgentId); if(!a) return;
  const d = _ctRenewDraft; if(!d) return;
  const step = _ctRenewStep;

  // Render step indicator
  const stepsHost = document.getElementById('ct-wiz-steps');
  const stepNames = ['ตั้งช่วงสัญญา', 'Carry-over', 'Review', 'Activate'];
  stepsHost.innerHTML = stepNames.map((name,i)=>{
    const n = i+1;
    const cls = n < step ? 'done' : (n === step ? 'current' : '');
    return `
      <div class="ct-wstep ${cls}"><div class="ct-wstep-num"><span class="ct-wstep-num-num">${n}</span></div>${name}</div>
      ${n<stepNames.length?'<div class="ct-wstep-conn"></div>':''}
    `;
  }).join('');

  // Body
  const body = document.getElementById('ct-wiz-body');
  if(step === 1){
    const _curRT = a.rateTypeId || '';
    if(d.newRateTypeId == null) d.newRateTypeId = _curRT;
    const rtOpts = ((typeof SB_RATE_TYPES!=='undefined')?SB_RATE_TYPES:[])
      .map(r=>`<option value="${r.id}"${r.id===d.newRateTypeId?' selected':''}>${String(r.name||r.code||r.id).replace(/</g,'&lt;')}</option>`).join('');
    const rtChanged = d.newRateTypeId && d.newRateTypeId !== _curRT;
    body.innerHTML = `
      <div class="ct-wiz-intro">ตั้งช่วงเวลาของสัญญาใหม่ · เริ่มต่อจากวันที่สัญญาเก่าหมด</div>
      <div class="ct-period-row">
        <div class="ct-period-fld">
          <label>From (เริ่มสัญญาใหม่)</label>
          <input type="date" value="${d.newStart}" onchange="ctRenewSetField('newStart',this.value)">
        </div>
        <div class="ct-period-fld">
          <label>To (สัญญาใหม่หมด)</label>
          <input type="date" value="${d.newEnd}" onchange="ctRenewSetField('newEnd',this.value)">
        </div>
      </div>
      <div class="ct-period-quickset">
        <span style="font-size:9px;font-weight:700;color:var(--fd-ink-soft);letter-spacing:.05em;text-transform:uppercase;align-self:center;margin-right:4px">Quick-set:</span>
        <button class="ct-period-quickset-chip" onclick="ctRenewPeriodPreset(1)">+ 1 year</button>
        <button class="ct-period-quickset-chip" onclick="ctRenewPeriodPreset(2)">+ 2 years</button>
      </div>
      <div style="margin-top:14px;padding:10px 14px;background:var(--fd-bg);border-radius:10px;font-size:11px;color:var(--fd-ink-mid)">
        <strong style="color:var(--fd-ink)">Version ใหม่:</strong>
        <input type="text" value="${d.newVersion}" onchange="ctRenewSetField('newVersion',this.value)" style="font-variant-numeric:tabular-nums;font-size:12px;font-weight:700;background:#fff;border:1px solid var(--fd-line);border-radius:6px;padding:3px 8px;margin-left:6px;width:100px;outline:none">
      </div>
      <div style="margin-top:10px;padding:10px 14px;background:var(--fd-bg);border-radius:10px;font-size:11px;color:var(--fd-ink-mid)">
        <div style="display:flex;align-items:center;gap:8px">
          <strong style="color:var(--fd-ink);white-space:nowrap">Rate Type สัญญาใหม่:</strong>
          <select onchange="ctRenewSetField('newRateTypeId',this.value); ctRenewRender();" style="flex:1;min-width:0;font-size:12px;background:#fff;border:1px solid var(--fd-line);border-radius:6px;padding:4px 8px;outline:none">${rtOpts}</select>
        </div>
        ${rtChanged?`<div style="margin-top:6px;color:#A32D2D;font-size:10.5px">⚠ เปลี่ยน Rate Type · ราคาจะอิงชุดใหม่ — แนะนำ uncheck “Pricing Matrix” ในขั้น Carry-over</div>`:'<div style="margin-top:5px;font-size:10px;color:var(--fd-ink-soft)">คงเดิม · หรือเลือกชุดราคาฤดูใหม่</div>'}
      </div>
    `;
  } else if(step === 2){
    const carryItems = [
      { key:'programs', name:'Programs in Contract', meta:`${(a.programPeriods||[]).length} routes`, count:`${(a.programPeriods||[]).length} programs` },
      { key:'prices', name:'Pricing Matrix', meta:`${(a.programs||[]).length} routes × zone × 6 pax types`, count:'ราคาเดิม' },
      { key:'addons', name:'Additional Services', meta:`${(a.addonServices||[]).length} services`, count:`${(a.addonServices||[]).reduce((s,x)=>s+(x.variants||[]).length,0)} variants` },
      { key:'booking', name:'Booking Channel + Cutoff Policy', meta:`${a.bookingChannel?.method||'—'} · ${a.bookingChannel?.cutoff||'—'}`, count:'unchanged' },
      { key:'signatory', name:'Agent Signatory', meta:`${a.agentSignatory?.name||'—'} · signed ${ctFmtDate(a.agentSignatory?.signedDate)}`, count:'re-sign needed', recommend:'off' },
      { key:'company', name:'Company Information', meta:'Legal Name · Address · TAT · Contact', count:'unchanged' },
    ];
    body.innerHTML = `
      <div class="ct-wiz-intro">เลือกข้อมูลที่ต้องการ <strong>คัดลอกจากสัญญาเก่ามาเป็นค่าเริ่มต้น</strong> ของสัญญาใหม่ · ที่ uncheck = เริ่มจากศูนย์</div>
      <div class="ct-carry-list">
        ${carryItems.map(it=>{
          const on = !!d.carry[it.key];
          return `
            <div class="ct-carry-row" onclick="ctRenewToggleCarry('${it.key}')">
              <div class="ct-cb ${on?'':'off'}">${on?'✓':''}</div>
              <div class="ct-carry-row-info">
                <div class="ct-carry-row-name" style="${on?'':'color:var(--fd-ink-soft)'}">${it.name}</div>
                <div class="ct-carry-row-meta">${it.meta}</div>
              </div>
              <div class="ct-carry-row-pct" style="${it.recommend==='off' && !on?'color:var(--fd-coral-deep);font-weight:700':''}">${it.count}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if(step === 3){
    const carry = d.carry;
    body.innerHTML = `
      <div class="ct-wiz-intro">ตรวจสอบรายละเอียดสัญญาใหม่ก่อน activate · กดแก้ section ใดก็ได้</div>
      <div class="ct-review-card">
        <div class="ct-review-hd"><div class="ct-review-ttl">ช่วงสัญญา</div><span style="font-size:10px;color:var(--fd-ink-soft);font-variant-numeric:tabular-nums">${d.newVersion}</span></div>
        <div class="ct-review-body"><strong>${ctFmtDate(d.newStart)} → ${ctFmtDate(d.newEnd)}</strong></div>
      </div>
      <div class="ct-review-card">
        <div class="ct-review-hd"><div class="ct-review-ttl">Programs ${carry.programs?'(copied)':'(empty)'}</div></div>
        <div class="ct-review-body">${carry.programs ? `${(a.programPeriods||[]).map(p=>{const r=ROUTES.find(x=>x.id===p.routeId);return r?.name||'?'}).join(' · ')}` : 'เริ่มจากศูนย์ — จะต้องเพิ่ม programs ใหม่หลัง activate'}</div>
      </div>
      <div class="ct-review-card">
        <div class="ct-review-hd"><div class="ct-review-ttl">Pricing Matrix ${carry.prices?'(copied)':'(empty)'}</div></div>
        <div class="ct-review-body">${carry.prices ? 'ราคาทั้งหมดถูก clone มาจากสัญญาเก่า · แก้ราคาได้ในแท็บ Pricing Matrix หลัง activate' : 'ราคาทั้งหมดว่าง'}</div>
      </div>
      <div class="ct-review-card">
        <div class="ct-review-hd"><div class="ct-review-ttl">Additional Services ${carry.addons?'(copied)':'(empty)'}</div></div>
        <div class="ct-review-body">${carry.addons ? (a.addonServices||[]).map(s=>SB_ADDON_SVCS.find(x=>x.id===s.svcId)?.name||'?').join(' · ') || '— ไม่มี —' : 'ไม่ได้ copy'}</div>
      </div>
      <div class="ct-review-card">
        <div class="ct-review-hd"><div class="ct-review-ttl">Booking + Company + Signatory</div></div>
        <div class="ct-review-body">
          Booking: ${carry.booking?'copied':'<span style="color:var(--fd-coral-deep)">empty</span>'} ·
          Company: ${carry.company?'copied':'<span style="color:var(--fd-coral-deep)">empty</span>'} ·
          Signatory: ${carry.signatory?'copied':'<span style="color:var(--fd-coral-deep)">pending re-sign</span>'}
        </div>
      </div>
    `;
  } else if(step === 4){
    body.innerHTML = `
      <div class="ct-activate">
        <div class="ct-activate-icon">🎉</div>
        <div class="ct-activate-ttl">พร้อม Activate Contract ${d.newVersion}</div>
        <div class="ct-activate-sub">
          เมื่อกดยืนยัน · สัญญาใหม่ <strong style="color:#0F6E56">${d.newVersion}</strong> จะเป็น Active ทันที<br>
          สัญญาเก่า <strong>${a.contractVersion}</strong> จะถูกย้ายเข้า Archive (เก็บไว้ตลอดไป)
        </div>
      </div>
      <div class="ct-versions">
        <div class="ct-versions-card">
          <div class="ct-versions-ttl">📦 สัญญาเก่า (archive)</div>
          <div class="ct-versions-body">
            <div class="v">${a.contractVersion}</div>
            <div>${ctFmtDate(a.contractStart)} → ${ctFmtDate(a.contractEnd)}</div>
            <div style="margin-top:6px;opacity:.75">เก็บไว้สำหรับ booking เก่า · audit · ดูประวัติ</div>
          </div>
        </div>
        <div class="ct-versions-card new">
          <div class="ct-versions-ttl">✨ สัญญาใหม่ (active)</div>
          <div class="ct-versions-body">
            <div class="v">${d.newVersion}</div>
            <div>${ctFmtDate(d.newStart)} → ${ctFmtDate(d.newEnd)}</div>
            <div style="margin-top:6px;opacity:.75">Active สำหรับ booking ใหม่ · quote · export</div>
          </div>
        </div>
      </div>
    `;
  }

  // Footer
  const ft = document.getElementById('ct-wiz-ft');
  const isFinal = step === 4;
  ft.innerHTML = `
    <div class="ct-wiz-ft-l">Step ${step} of 4${isFinal?' · Final':''}</div>
    <div class="ct-wiz-ft-r">
      ${step>1?`<button class="ct-wiz-btn-sec" onclick="ctRenewBack()">← ย้อนกลับ</button>`:''}
      ${isFinal
        ? `<button class="ct-wiz-btn-pri activate" onclick="ctRenewActivate()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>ยืนยันต่อสัญญา (Activate)</button>`
        : `<button class="ct-wiz-btn-pri" onclick="ctRenewNext()">ถัดไป<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>`}
    </div>
  `;
}

function ctRenewNext(){
  if(_ctRenewStep === 1){
    // Validate dates
    if(!_ctRenewDraft.newStart || !_ctRenewDraft.newEnd) return alert('กรุณาระบุช่วงสัญญา');
    if(new Date(_ctRenewDraft.newEnd) <= new Date(_ctRenewDraft.newStart)) return alert('วันสิ้นสุดต้องอยู่หลังวันเริ่ม');
  }
  if(_ctRenewStep < 4){ _ctRenewStep++; ctRenewRender(); }
}
function ctRenewBack(){
  if(_ctRenewStep > 1){ _ctRenewStep--; ctRenewRender(); }
}

function ctRenewActivate(){
  const a = sbGetAgent(_ctRenewAgentId); if(!a){ ctCloseRenewal(); return; }
  const d = _ctRenewDraft;

  // Archive current active contract (full snapshot including pricing)
  const archiveEntry = {
    version: a.contractVersion,
    archivedAt: _ctTodayISO(),
    contractStart: a.contractStart,
    contractEnd: a.contractEnd,
    snapshot: {
      rateTypeId: a.rateTypeId,   // record which rate card the archived contract used
      programPeriods: JSON.parse(JSON.stringify(a.programPeriods||[])),
      addonServices: JSON.parse(JSON.stringify(a.addonServices||[])),
      agentSignatory: JSON.parse(JSON.stringify(a.agentSignatory||{})),
      prices: JSON.parse(JSON.stringify(SB_AGENT_PRICES[a.id]||{})), // snapshot all agent prices
    }
  };
  if(!a.contractHistory) a.contractHistory = [];
  a.contractHistory.unshift(archiveEntry);

  // Update active contract identity
  a.contractVersion = d.newVersion;
  a.contractStart = d.newStart;
  a.contractEnd = d.newEnd;
  a.contractStatus = 'active';

  // §Rate Type can change at renewal (e.g. new season's rate card) — apply the chosen one
  if(d.newRateTypeId){ a.rateTypeId = d.newRateTypeId;
    /* §ctRateSync · ต่อสัญญาแล้วเลือกชุดราคาฤดูใหม่ · การ์ดสัญญาต้องขึ้นชุดใหม่ด้วย */
    if(typeof _ctSyncMainRate==='function') _ctSyncMainRate(a.id, a.rateTypeId, 'ต่อสัญญา'); }

  // Apply carry-over choices (keep what's checked; clear what's not)
  if(!d.carry.programs){ a.programPeriods = []; a.programs = []; }
  else {
    // Shift program periods to new contract window
    const oldStart = new Date(archiveEntry.contractStart);
    const newStart = new Date(d.newStart);
    const shiftDays = Math.round((newStart - oldStart) / (1000*60*60*24));
    a.programPeriods = (a.programPeriods||[]).map(p=>{
      const shift = (iso)=>{
        if(!iso) return iso;
        const dt = new Date(iso);
        if(isNaN(dt)) return iso;
        dt.setDate(dt.getDate()+shiftDays);
        return dt.toISOString().slice(0,10);
      };
      return { ...p, bookFrom:shift(p.bookFrom), bookTo:shift(p.bookTo), travelFrom:shift(p.travelFrom), travelTo:shift(p.travelTo) };
    });
  }
  if(!d.carry.prices){
    // Clear pricing for this agent
    if(SB_AGENT_PRICES[a.id]) SB_AGENT_PRICES[a.id] = {};
  }
  if(!d.carry.addons){ a.addonServices = []; }
  if(!d.carry.booking){
    a.bookingChannel = { method:'', cutoff:'', cancelPolicy:'', email:'', phone:'' };
  }
  if(!d.carry.signatory){
    a.agentSignatory = { name:a.agentSignatory?.name||'', designation:a.agentSignatory?.designation||'', tel:a.agentSignatory?.tel||'', signedDate:'' };
  }
  if(!d.carry.company){
    a.companyInfo = { legalName:'', tatLicense:'', address:'', tel:'', hotline:'', fax:'', website:'' };
  }

  ctCloseRenewal();
  agRenderList();
  agRenderDetail(a.id);
  agUpdateExpiringBadge();
  alert(`✅ Activate สัญญาใหม่ ${d.newVersion} สำเร็จ\n\nสัญญาเก่า ${archiveEntry.version} ถูกเก็บใน archive แล้ว`);
}

function ctViewContract(agentId, version){
  const a = sbGetAgent(agentId); if(!a) return;
  if(version === 'active'){
    // Already showing active — just close any open archived panel
    ctCloseArchivedView();
    return;
  }
  const archive = (a.contractHistory||[]).find(h=>h.version===version);
  if(!archive){ alert('ไม่พบสัญญานี้ใน archive'); return; }

  // Mark pill as "viewing"
  document.querySelectorAll('#view-agents .ct-history-pill').forEach(p=>p.classList.remove('viewing'));
  const pills = document.querySelectorAll('#view-agents .ct-history-pill');
  pills.forEach(p=>{
    if(p.textContent.includes(version)) p.classList.add('viewing');
  });

  // Render body
  ctRenderArchivedBody(a, archive);
  document.getElementById('ct-arch-banner-sub').textContent = `${a.name} · ${version}`;
  document.getElementById('ct-arch-panel').style.display = 'flex';
}

function ctCloseArchivedView(){
  document.getElementById('ct-arch-panel').style.display = 'none';
  // Clear pill viewing state
  document.querySelectorAll('#view-agents .ct-history-pill.viewing').forEach(p=>p.classList.remove('viewing'));
}

function ctRenderArchivedBody(agent, archive){
  const snap = archive.snapshot || {};
  const periods = snap.programPeriods || [];
  const addons = snap.addonServices || [];
  const sig = snap.agentSignatory || {};
  const prices = snap.prices || {};

  // Programs section
  let progsHtml = '';
  if(periods.length === 0){
    progsHtml = '<div class="ct-arch-empty">ไม่มีข้อมูล programs สำหรับสัญญานี้</div>';
  } else {
    progsHtml = `<div class="ct-arch-prog-list">
      ${periods.map(p=>{
        const r = ROUTES.find(x=>x.id===p.routeId);
        if(!r) return '';
        const pierTag = (r.pier||'').toUpperCase().replace('TUBLAMU','TUB LAMU').replace('PANWA','VISIT PANWA');
        return `
          <div class="ct-arch-prog-row">
            <span class="ct-arch-prog-dot" style="background:${r.color||'#999'}"></span>
            <div class="ct-arch-prog-info">
              <div class="ct-arch-prog-name">${r.name}</div>
              <div class="ct-arch-prog-pier">${pierTag}</div>
            </div>
            <div class="ct-arch-prog-period">
              <div class="ct-arch-prog-period-lbl">Booking</div>
              <div>${ctFmtDate(p.bookFrom)} → ${ctFmtDate(p.bookTo)}</div>
            </div>
            <div class="ct-arch-prog-period">
              <div class="ct-arch-prog-period-lbl">Travel</div>
              <div>${ctFmtDate(p.travelFrom)} → ${ctFmtDate(p.travelTo)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  }

  // Pricing Matrix section
  let pricesHtml = '';
  const priceRoutes = periods.map(p=>ROUTES.find(r=>r.id===p.routeId)).filter(Boolean);
  if(priceRoutes.length === 0 || Object.keys(prices).length === 0){
    pricesHtml = '<div class="ct-arch-empty">ไม่มีข้อมูลราคาในสัญญานี้</div>';
  } else {
    pricesHtml = `
      <div style="overflow-x:auto">
        <table class="sb-price-tbl" style="font-size:10px">
          <thead>
            <tr>
              <th rowspan="2" style="vertical-align:bottom">Program</th>
              <th rowspan="2" style="vertical-align:bottom">Zone</th>
              <th colspan="2" style="text-align:center">Adult</th>
              <th colspan="2" style="text-align:center">Child</th>
            </tr>
            <tr>
              <th class="num">Thai</th><th class="num">FR</th>
              <th class="num">Thai</th><th class="num">FR</th>
            </tr>
          </thead>
          <tbody>
            ${priceRoutes.map(r=>{
              const routePrices = prices[r.id]||{};
              /* §rnZone2 · จำนวนโซนไม่เท่ากันทุกเส้นแล้ว · rowspan ต้องนับตามจริง
                 ของเดิมฝัง rowspan="3" ไว้ เส้นระนองสองแถวจะทำให้ตารางเหลื่อม */
              const _zs = rtZonesForRoute(r.id, routePrices);
              return _zs.map((zone,zi)=>{
                const pz = routePrices[zone]||{};
                const zoneLabel = zone==='NoTransfer'?'No':zone;
                const zoneColor = zone==='PK'?'#1a7fa0':zone==='KL'?'#0F6E56':zone==='RN'?'#8A4FBF':'#7a8fa3';
                return `<tr ${zi===0?'class="prog-row"':''}>
                  ${zi===0?`<td rowspan="${_zs.length}" style="vertical-align:top;background:#fff !important;font-size:11px">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.color||'#999'};margin-right:5px"></span><strong>${r.name}</strong>
                  </td>`:''}
                  <td><span class="sb-chip" style="background:${zoneColor}15;color:${zoneColor};font-size:9px;padding:1px 6px">${zoneLabel}</span></td>
                  <td class="num">${pz['adult-thai']?sbFmtTHB(pz['adult-thai']):'—'}</td>
                  <td class="num" style="color:var(--ocean, #1a7fa0)">${pz['adult-fr']?sbFmtTHB(pz['adult-fr']):'—'}</td>
                  <td class="num">${pz['child-thai']?sbFmtTHB(pz['child-thai']):'—'}</td>
                  <td class="num" style="color:var(--ocean, #1a7fa0)">${pz['child-fr']?sbFmtTHB(pz['child-fr']):'—'}</td>
                </tr>`;
              }).join('');
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Add-on services
  let addonsHtml = '';
  if(addons.length === 0){
    addonsHtml = '<div class="ct-arch-empty">ไม่มี add-on services ในสัญญานี้</div>';
  } else {
    addonsHtml = addons.map(p=>{
      const svc = SB_ADDON_SVCS.find(s=>s.id===p.svcId);
      if(!svc) return '';
      const vars = (p.variants||[]).map(av=>{
        const v = svc.variants.find(x=>x.id===av.varId);
        if(!v) return '';
        return `${v.name}: Selling ฿${sbFmtTHB(av.selling)} / Net ฿${sbFmtTHB(av.net)}`;
      }).filter(Boolean).join(' · ');
      return `
        <div class="ct-arch-addon-row">
          <div class="aos-svc-icon ${svc.icon||'other'}">${AOS_ICONS[svc.icon||'other']}</div>
          <div class="ct-arch-addon-info">
            <div class="ct-arch-addon-name">${svc.name}</div>
            <div class="ct-arch-addon-vars">${vars || '—'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Signatory section
  let sigHtml = '';
  if(!sig.name){
    sigHtml = '<div class="ct-arch-empty">ไม่มี signatory ในสัญญานี้</div>';
  } else {
    sigHtml = `
      <div class="ct-arch-sig">
        <div class="ct-arch-sig-role">Signed for ${agent.companyInfo?.legalName||agent.name}</div>
        <div class="ct-arch-sig-name">${sig.name}</div>
        <div class="ct-arch-sig-pos">${sig.designation||'Authorized Signatory'}</div>
        <div class="ct-arch-sig-meta">📅 ${ctFmtDate(sig.signedDate)}${sig.tel?` · 📞 ${sig.tel}`:''}</div>
      </div>
    `;
  }

  // Calculate duration
  const start = new Date(archive.contractStart);
  const end = new Date(archive.contractEnd);
  const days = isNaN(start)||isNaN(end) ? 0 : Math.round((end-start)/(1000*60*60*24)) + 1;

  document.getElementById('ct-arch-body').innerHTML = `
    <div class="ct-arch-validity">
      <div class="ct-arch-validity-col">
        <div class="ct-arch-validity-lbl">From</div>
        <div class="ct-arch-validity-val">${ctFmtDate(archive.contractStart)}</div>
      </div>
      <div class="ct-arch-validity-sep">→</div>
      <div class="ct-arch-validity-col">
        <div class="ct-arch-validity-lbl">To</div>
        <div class="ct-arch-validity-val">${ctFmtDate(archive.contractEnd)}</div>
        <div class="ct-arch-validity-meta">${days} days · archived ${ctFmtDate(archive.archivedAt)}</div>
      </div>
    </div>

    <div class="ct-arch-sect">
      <div class="ct-arch-sect-hd">
        <div class="ct-arch-sect-ttl">Programs in Contract <span class="ct-arch-sect-cnt">${periods.length} routes</span></div>
      </div>
      ${progsHtml}
    </div>

    <div class="ct-arch-sect">
      <div class="ct-arch-sect-hd">
        <div class="ct-arch-sect-ttl">Pricing Matrix <span class="ct-arch-sect-cnt">${priceRoutes.length} routes</span></div>
      </div>
      ${pricesHtml}
    </div>

    <div class="ct-arch-sect">
      <div class="ct-arch-sect-hd">
        <div class="ct-arch-sect-ttl">Additional Services <span class="ct-arch-sect-cnt">${addons.length} services</span></div>
      </div>
      ${addonsHtml}
    </div>

    <div class="ct-arch-sect">
      <div class="ct-arch-sect-hd">
        <div class="ct-arch-sect-ttl">Signatory</div>
      </div>
      ${sigHtml}
    </div>

    <div style="margin-top:18px;padding:12px 14px;background:#fef5f0;border:1px dashed var(--fd-coral-soft);border-radius:10px;font-size:11px;color:var(--fd-coral-deep);line-height:1.5">
      <strong>📌 หมายเหตุ:</strong> ข้อมูลนี้เป็น snapshot ของสัญญาตอน archive ไม่สามารถแก้ไขได้ · ใช้เพื่อ audit / ดูประวัติเท่านั้น
    </div>
  `;
}

// Resolve the (agent, rateType) a contract document renders with. Per-contract overrides
// (Phase 4) let a promo/main contract issue its OWN doc using its rate + program periods;
// with no override it falls back to the agent's current values (existing agent-level flow).
function _ctDocAgentRT(){
  const a0 = sbGetAgent(_ctDoc && _ctDoc.agentId); if(!a0) return {a:null, rt:null};
  const rtId = (_ctDoc && _ctDoc.overrideRateTypeId) || a0.rateTypeId;
  const rt = (rtId && typeof getRateType==='function') ? getRateType(rtId) : null;
  const patch = {};
  if(_ctDoc && _ctDoc.overrideProgramPeriods) patch.programPeriods = _ctDoc.overrideProgramPeriods;
  if(_ctDoc && _ctDoc.overrideVersion)        patch.contractVersion = _ctDoc.overrideVersion;
  if(_ctDoc && _ctDoc.overrideFrom)           patch.contractStart = _ctDoc.overrideFrom;
  if(_ctDoc && _ctDoc.overrideTo)             patch.contractEnd = _ctDoc.overrideTo;
  const a = Object.keys(patch).length ? Object.assign({}, a0, patch) : a0;
  return {a, rt};
}
function ctDocOpen(agentId, opts){
  const a = sbGetAgent(agentId); if(!a) return;
  /* §template · section ที่เปิด และข้อความทั้งหมด มาจาก template ของเอเยนต์รายนี้
     tmplText = "สำเนา" ไม่ใช่ reference — แก้ template ทีหลังไม่ย้อนมาแตะเอกสารที่เปิดค้างอยู่ */
  const tmpl = (typeof ctTmplForAgent==='function') ? ctTmplForAgent(a) : null;
  const sections = {};
  CT_DOC_SECTIONS.forEach(s => {
    const fromT = tmpl && tmpl.sections && tmpl.sections[s.id];
    sections[s.id] = s.required ? true : (tmpl && tmpl.sections ? !!fromT : !!s.defaultOn);
  });
  const tmplText = {en:{}, th:{}};
  if(tmpl && tmpl.text){ ['en','th'].forEach(L => { const src = tmpl.text[L] || {}; Object.keys(src).forEach(k => {
    tmplText[L][k] = Array.isArray(src[k]) ? src[k].slice() : src[k]; }); }); }
  _ctDoc = {
    agentId,
    lang: 'en',
    sections,
    editMode: false,
    templateId: tmpl ? tmpl.id : null,
    templateName: tmpl ? tmpl.name : null,
    form:   (tmpl && tmpl.form)   || 'ocean',   /* §ฟอร์ม/สี/ฟอนต์ · แช่แข็งไปกับเอกสาร เหมือน tmplText */
    accent:    (tmpl && tmpl.accent)    || 'navy',
    accentHex: (tmpl && tmpl.accentHex) || '',
    font:      (tmpl && tmpl.font)      || 'manrope',
    tmplText,               // สำเนาข้อความ ณ เวลาเปิด · artifact จะเก็บก้อนนี้ไปด้วย
    overrides: {},          // { 'sectionId.fieldName': value } · แก้เฉพาะฉบับนี้ ทับ template อีกที
    customClauses: []       // [{id, title, body}]
  };
  // Phase 4 · per-contract override: issue THIS contract's doc (its rate + program periods + window/version)
  if(opts){
    _ctDoc.contractId           = opts.contractId || null;
    _ctDoc.overrideRateTypeId   = opts.rateTypeId || null;
    _ctDoc.overrideProgramPeriods = Array.isArray(opts.programPeriods) ? opts.programPeriods : null;
    _ctDoc.overrideVersion      = opts.version || null;
    _ctDoc.overrideFrom         = opts.from || null;
    _ctDoc.overrideTo           = opts.to || null;
  }
  document.getElementById('ct-doc-modal').style.display = 'flex';
  ctDocRender();
}

function ctDocToggleEditMode(){
  if(!_ctDoc) return;
  _ctDoc.editMode = !_ctDoc.editMode;
  ctDocRender();
}

// Print helper · moves the wizard modal to be a direct child of <body>, then prints.
// Why move: the modal lives deep inside .app > main > #view-agents. CSS @media print
// can't unhide ancestors (display:none on .app cascades down). So we detach + reattach.
function _ctDocPrintFlow(setupBeforePrint){
  if(!_ctDoc) return;
  const modal = document.getElementById('ct-doc-modal');
  if(!modal) return;
  const parent = modal.parentNode;
  const nextSibling = modal.nextSibling;
  const wasEditing = _ctDoc.editMode;
  if(wasEditing){ _ctDoc.editMode = false; ctDocRender(); }
  // Detach + re-attach to body
  document.body.appendChild(modal);
  document.body.classList.add('ct-doc-printing');
  // Optional setup hook (e.g., set document.title for Export PDF flow)
  const cleanup = (setupBeforePrint && setupBeforePrint()) || (() => {});
  // Restore on afterprint (fires even if user cancels save-as-PDF)
  const restore = () => {
    document.body.classList.remove('ct-doc-printing');
    if(nextSibling) parent.insertBefore(modal, nextSibling); else parent.appendChild(modal);
    cleanup();
    if(wasEditing){ _ctDoc.editMode = true; ctDocRender(); }
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  // Defer print so DOM mutation + CSS class settle before dialog opens
  setTimeout(() => window.print(), 80);
}

function ctDocPrintPreview(){ _ctDocPrintFlow(); }

function ctDocExportPDF(){
  if(!_ctDoc) return;
  const a = sbGetAgent(_ctDoc.agentId); if(!a) return;
  const cleanName = (s) => (s||'').replace(/[^A-Za-z0-9฀-๿._-]+/g,'_').replace(/^_+|_+$/g,'');
  const fname = `Contract_${cleanName(a.code||a.name)}_${cleanName(a.contractVersion||'draft')}.pdf`;
  /* Margins ต้องเป็น None และปิด Headers and footers — ไม่งั้นเบราว์เซอร์ย่อหน้าลงแล้วยัด
     URL/วันที่ทับขอบกระดาษ ระยะขอบจะไม่ตรงกับ preview */
  ctDocShowToast(`Save as PDF · Margins: None · uncheck "Headers and footers" · ${fname}`);
  _ctDocPrintFlow(() => {
    const originalTitle = document.title;
    document.title = fname.replace(/\.pdf$/,'');
    return () => {
      document.title = originalTitle;
      // Save artifact after print dialog closes (whether user saved or cancelled — we record the intent)
      const art = ctArtifactSave();
      if(art){
        ctDocShowToast(`✓ Contract saved to history · ${a.code} ${a.contractVersion}`);
        // Refresh agent detail to show the new artifact
        if(typeof _agSelected !== 'undefined' && _agSelected === a.id && typeof agRenderDetail === 'function'){
          setTimeout(() => agRenderDetail(a.id), 200);
        }
      }
    };
  });
}

function ctArtifactsLoad(){
  if(_CT_ARTIFACTS) return _CT_ARTIFACTS;
  try {
    const raw = localStorage.getItem('loveandaman_v2');
    const obj = raw ? JSON.parse(raw) : {};
    _CT_ARTIFACTS = obj.agent_artifacts || {};   // { agentId: [artifact, ...] }
  } catch(e){ _CT_ARTIFACTS = {}; }
  return _CT_ARTIFACTS;
}

function ctArtifactsPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('sales')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */ 
  try {
    const raw = localStorage.getItem('loveandaman_v2');
    const obj = raw ? JSON.parse(raw) : {};
    obj.agent_artifacts = _CT_ARTIFACTS || {};
    localStorage.setItem('loveandaman_v2', JSON.stringify(obj));
  } catch(e){ console.warn('[ctArtifactsPersist] failed:', e); }
}

function ctArtifactsFor(agentId){
  const map = ctArtifactsLoad();
  return map[agentId] || [];
}

// Save current wizard state as a new artifact for this agent
function ctArtifactSave(){
  if(!_ctDoc) return null;
  const {a, rt} = _ctDocAgentRT(); if(!a) return null;   // Phase 4 · per-contract override (else agent)
  const enabledSections = Object.keys(_ctDoc.sections).filter(k => _ctDoc.sections[k]);
  const map = ctArtifactsLoad();
  if(!map[a.id]) map[a.id] = [];
  const artifact = {
    id: 'gc_' + Date.now(),
    version: a.contractVersion || 'draft',
    generatedAt: new Date().toISOString(),
    lang: _ctDoc.lang,
    sections: JSON.parse(JSON.stringify(_ctDoc.sections)),
    /* §template · แช่แข็งข้อความไปกับ artifact — ไม่ใช่แค่ templateId
       ถ้าเก็บแต่ id แล้ววันหลังมีคนแก้ template ข้อความในสัญญาที่เซ็นไปแล้วจะเปลี่ยนย้อนหลัง */
    templateId: _ctDoc.templateId || null,
    templateName: _ctDoc.templateName || null,
    form:   _ctDoc.form   || 'ocean',
    accent:    _ctDoc.accent    || 'navy',
    accentHex: _ctDoc.accentHex || '',
    font:      _ctDoc.font      || 'manrope',
    tmplText: JSON.parse(JSON.stringify(_ctDoc.tmplText || {en:{},th:{}})),
    overrides: JSON.parse(JSON.stringify(_ctDoc.overrides || {})),
    customClauses: JSON.parse(JSON.stringify(_ctDoc.customClauses || [])),
    rateTypeRef: rt ? rt.code : null,
    rateTypeName: rt ? rt.name : null,
    contractId: (_ctDoc && _ctDoc.contractId) || null,   // Phase 4 · links this PDF to a specific sb_contract
    pageCount: ctDocCountPages(enabledSections)
  };
  map[a.id].unshift(artifact);   // newest first
  // Cap at 20 artifacts per agent
  if(map[a.id].length > 20) map[a.id] = map[a.id].slice(0, 20);
  _CT_ARTIFACTS = map;
  ctArtifactsPersist();
  // Phase 4 · stamp the contract with its issued document id
  if(_ctDoc && _ctDoc.contractId && typeof SB_CONTRACTS!=='undefined' && Array.isArray(SB_CONTRACTS)){
    const _c = SB_CONTRACTS.find(x => x && x.id===_ctDoc.contractId);
    if(_c){ _c.docId = artifact.id; if(typeof sbContractsPersist==='function') sbContractsPersist(); }
  }
  if(typeof agLog==='function') agLog(a.id,'contract','Contract generated'+(artifact.version?(' · '+artifact.version):'')+(artifact.lang?(' · '+artifact.lang.toUpperCase()):''));
  return artifact;
}

function ctArtifactRemove(agentId, artifactId){
  const map = ctArtifactsLoad();
  if(!map[agentId]) return;
  map[agentId] = map[agentId].filter(x => x.id !== artifactId);
  if(map[agentId].length === 0) delete map[agentId];
  _CT_ARTIFACTS = map;
  ctArtifactsPersist();
  // Refresh agent detail if currently viewing this agent
  if(typeof _agSelected !== 'undefined' && _agSelected === agentId){
    if(typeof agRenderDetail === 'function') agRenderDetail(agentId);
  }
}

// Restore wizard state from a saved artifact
function ctArtifactReopen(agentId, artifactId){
  const map = ctArtifactsLoad();
  const artifact = (map[agentId]||[]).find(x => x.id === artifactId);
  if(!artifact) { alert('Artifact not found'); return; }
  ctDocOpen(agentId);
  // Overlay saved state on top of init
  if(_ctDoc){
    _ctDoc.lang = artifact.lang || 'en';
    _ctDoc.sections = Object.assign({}, _ctDoc.sections, artifact.sections || {});
    /* §template · artifact เก่าที่บันทึกก่อนมีระบบ template จะไม่มี tmplText → ตกกลับไปใช้ค่า hardcode
       (ซึ่งคือข้อความที่มันถูกสร้างมาด้วยพอดี) · artifact ใหม่ได้ข้อความ ณ วันนั้นคืนมาเป๊ะ */
    if(artifact.form)   _ctDoc.form   = artifact.form;
    if(artifact.accent)    _ctDoc.accent    = artifact.accent;
    if(artifact.accentHex) _ctDoc.accentHex = artifact.accentHex;
    if(artifact.font)      _ctDoc.font      = artifact.font;
    if(artifact.tmplText){
      _ctDoc.tmplText = JSON.parse(JSON.stringify(artifact.tmplText));
      _ctDoc.templateId = artifact.templateId || null;
      _ctDoc.templateName = artifact.templateName || null;
    }
    _ctDoc.overrides = JSON.parse(JSON.stringify(artifact.overrides || {}));
    _ctDoc.customClauses = JSON.parse(JSON.stringify(artifact.customClauses || []));
    ctDocRender();
  }
}

// Count pages based on enabled sections (mirrors PAGE_GROUPS in ctDocRender)
function ctDocCountPages(enabledIdsArr){
  const groups = [['cover'],['parties','programs'],['pricing'],['addons','payment'],['booking','cancel','custom'],['signature']];
  const enabledSet = new Set(enabledIdsArr);
  return groups.filter(g => g.some(s => enabledSet.has(s))).length;
}

function ctDocShowToast(msg){
  // Tiny non-blocking toast at the top of the modal
  let el = document.getElementById('ct-doc-toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'ct-doc-toast';
    el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#1A2B43;color:#fff;font-family:Manrope,system-ui,sans-serif;font-size:12px;font-weight:500;padding:10px 18px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2200;max-width:560px;text-align:center;line-height:1.45';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.transition='opacity .3s'; el.style.opacity='0'; }, 4500);
}

// Read field value: override > default
function ctDocGetField(key, defaultVal){
  if(!_ctDoc) return defaultVal;
  return (_ctDoc.overrides && _ctDoc.overrides[key] !== undefined) ? _ctDoc.overrides[key] : defaultVal;
}

// Save override from a contenteditable element (sanitize text content)
function ctDocSaveField(key, el){
  if(!_ctDoc) return;
  if(!_ctDoc.overrides) _ctDoc.overrides = {};
  // Preserve line breaks but strip HTML
  const text = el.innerText || el.textContent || '';
  _ctDoc.overrides[key] = text.trim();
  // No re-render on blur — keep cursor + avoid jitter
}

// Reset a field back to default
function ctDocResetField(key){
  if(!_ctDoc || !_ctDoc.overrides) return;
  delete _ctDoc.overrides[key];
  ctDocRender();
}

// Custom clauses CRUD
function ctDocAddClause(){
  if(!_ctDoc) return;
  if(!_ctDoc.customClauses) _ctDoc.customClauses = [];
  _ctDoc.customClauses.push({
    id: 'cl_' + Date.now(),
    title: 'Clause ' + (_ctDoc.customClauses.length + 1),
    body: 'Type the clause content here…'
  });
  // Auto-enable Custom Clauses section so user sees what they just added
  if(_ctDoc.sections) _ctDoc.sections.custom = true;
  ctDocRender();
}

function ctDocRemoveClause(id){
  if(!_ctDoc || !_ctDoc.customClauses) return;
  _ctDoc.customClauses = _ctDoc.customClauses.filter(c => c.id !== id);
  ctDocRender();
}

function ctDocSetClauseField(id, field, el){
  if(!_ctDoc || !_ctDoc.customClauses) return;
  const c = _ctDoc.customClauses.find(x => x.id === id);
  if(c) c[field] = (el.innerText || el.textContent || '').trim();
}

// Bulk-fill Custom Clauses with the 6 standard clauses from real PDF
function ctDocFillStandardClauses(){
  if(!_ctDoc) return;
  if(typeof ctDocStandardClauses !== 'function') return;
  const stds = ctDocStandardClauses(_ctDoc.lang||'en');
  if(!_ctDoc.customClauses) _ctDoc.customClauses = [];
  const now = Date.now();
  stds.forEach((s, i) => {
    _ctDoc.customClauses.push({
      id: `cl_std_${now}_${i}`,
      title: s.title,
      body: s.body
    });
  });
  // Auto-enable Custom Clauses section
  if(_ctDoc.sections) _ctDoc.sections.custom = true;
  ctDocRender();
}

function ctDocClose(){
  document.getElementById('ct-doc-modal').style.display = 'none';
  _ctDoc = null;
}

function ctDocToggleSection(sId){
  const sec = CT_DOC_SECTIONS.find(s => s.id === sId);
  if(!sec || sec.required) return;
  _ctDoc.sections[sId] = !_ctDoc.sections[sId];
  ctDocRender();
}

function ctDocSetLang(lang){
  if(lang !== 'en' && lang !== 'th' && lang !== 'both') return;
  _ctDoc.lang = lang;
  ctDocRender();
}

/* §พรีวิวสด · hostId = เรนเดอร์ "หน้ากระดาษ" ลงที่อื่น (หน้า Contract Templates) แล้วข้าม header/sidebar
   ของ wizard ไป — ใช้เครื่องเรนเดอร์ตัวเดียวกันเป๊ะ พรีวิวจึงไม่มีวันเพี้ยนไปจากของจริง */
function ctDocRender(hostId){
  if(!_ctDoc) return;
  const {a, rt} = _ctDocAgentRT(); if(!a) return;   // Phase 4 · honors per-contract override (else agent)
  const _embed = !!hostId;
  if(_embed){ _ctDocRenderPages(hostId); return; }
  // ─── Header ───
  const hdHost = document.getElementById('ct-doc-hd');
  hdHost.innerHTML = `
    <div class="ct-doc-hd-l">
      <div class="ct-doc-hd-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div class="ct-doc-hd-ttl">Contract Document · ${a.name}</div>
        <div class="ct-doc-hd-sub">${a.contractVersion||'v—'} · ${rt?'Rate Type '+rt.code:'no rate type'} · ${a.code||''}</div>
      </div>
    </div>
    <div class="ct-doc-hd-actions">
      <button class="ct-doc-act ${_ctDoc.editMode?'on':''}" onclick="ctDocToggleEditMode()" type="button"
        style="${_ctDoc.editMode?'background:#FFF5EB;color:#854F0B;border-color:#F5C896;font-weight:700':''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${_ctDoc.editMode ? 'Edit mode: ON' : 'Edit text'}
      </button>
      <div class="ct-doc-lang">
        <button class="ct-doc-lang-btn ${_ctDoc.lang==='en'?'on':''}" onclick="ctDocSetLang('en')" type="button">🇬🇧 English</button>
        <button class="ct-doc-lang-btn ${_ctDoc.lang==='th'?'on':''}" onclick="ctDocSetLang('th')" type="button">🇹🇭 Thai</button>
        <button class="ct-doc-lang-btn ${_ctDoc.lang==='both'?'on':''}" onclick="ctDocSetLang('both')" type="button">EN + TH</button>
      </div>
      <button class="ct-doc-act" onclick="ctDocPrintPreview()" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print preview
      </button>
      <button class="ct-doc-act primary" onclick="ctDocExportPDF()" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        Export PDF
      </button>
      <button class="ct-doc-x" onclick="ctDocClose()" type="button" title="Close">✕</button>
    </div>
  `;
  // ─── Sidebar (section toggles) ───
  const sideHost = document.getElementById('ct-doc-side');
  const enabledCount = CT_DOC_SECTIONS.filter(s => _ctDoc.sections[s.id]).length;
  sideHost.innerHTML = `
    <div class="ct-doc-side-hd">Sections · ${enabledCount} / ${CT_DOC_SECTIONS.length}</div>
    ${CT_DOC_SECTIONS.map(s => {
      const on = !!_ctDoc.sections[s.id];
      const meta = ctDocSectionMeta(s.id, a, rt);
      const cls = s.required ? 'required' : (on ? 'on' : '');
      const tag = s.required ? '<span class="ct-doc-sec-tag">required</span>' : (meta.tag ? `<span class="ct-doc-sec-tag" style="background:#F5F4EE;color:#5F5E5A">${meta.tag}</span>` : '');
      return `
        <div class="ct-doc-sec ${cls}" onclick="${s.required?'':`ctDocToggleSection('${s.id}')`}" type="button">
          <span class="ct-doc-sec-num">${s.num}</span>
          <span class="ct-doc-sec-cb"></span>
          <div style="flex:1;min-width:0">
            <div class="ct-doc-sec-name">${s.name}</div>
            ${meta.sub ? `<div class="ct-doc-sec-meta">${meta.sub}</div>` : ''}
          </div>
          ${tag}
        </div>
      `;
    }).join('')}
    <div class="ct-doc-side-divider"></div>
    <div class="ct-doc-side-hd">Phase 1 · shell only</div>
    <div style="font-size:10.5px;color:#7a7770;line-height:1.5;padding:0 4px">
      Section toggles + language switch + preview skeleton. Phase 2 wires Agent + Rate Type data into the pages. Phase 3 enables inline text editing. Phase 4 adds PDF export.
    </div>
  `;
  _ctDocRenderPages('ct-doc-preview');
}

/* หน้ากระดาษล้วนๆ · ตัวเดียวกันทั้ง wizard และพรีวิวในหน้า Template
   คำนวณ a/rt เองในนี้ ไม่รับมาจากข้างนอก — ไม่งั้น _ctDocFitPages ที่เรียกซ้ำจะส่ง rt เป็น null แล้วราคาหาย */
function _ctDocRenderPages(hostId){
  const prevHost = document.getElementById(hostId || 'ct-doc-preview'); if(!prevHost) return;
  if(!_ctDoc) return;
  const {a, rt} = _ctDocAgentRT(); if(!a) return;   // Phase 4 · per-contract override (else agent)
  _ctDoc._host = hostId || 'ct-doc-preview';
  const F = ctFormGet(_ctDoc.form);   /* §ฟอร์ม · เปลือกหน้ากระดาษ · snapshot มากับ _ctDoc แล้ว → artifact แช่แข็งฟอร์มไปด้วย */
  const S = ctStyleOf(_ctDoc);        /* สีแถบ + ฟอนต์ · snapshot เหมือนกัน */
  const enabledSections = CT_DOC_SECTIONS.filter(s => _ctDoc.sections[s.id]);
  const totalPages = Math.max(1, enabledSections.length);  // 1 page per section for now
  const rawLang = _ctDoc.lang;
  const isBoth = rawLang === 'both';   // §โหมด EN+TH · chrome/label/ตาราง = EN · เนื้อความ clause โชว์ทั้งสองภาษา (กันตารางราคาซ้ำ)
  const lang = isBoth ? 'en' : rawLang;
  const fmt = (iso) => ctDocFmtDate(iso, lang);
  const fmtTH = (iso) => ctDocFmtDate(iso, 'th');
  const T = (k) => ctDocT(k, lang);
  const NAME_KEY = {cover:'docTitle', parties:'parties', eligibility:'eligibility', programs:'programs', pricing:'pricing', addons:'addOns', payment:'paymentTerms', booking:'booking', cancel:'cancelPolicy', general:'general', custom:'customClauses', signature:'signature'};
  const nameOf = (sId, L) => NAME_KEY[sId] ? ctDocT(NAME_KEY[sId], L) : sId;
  const localizedNameOf = (sId) => isBoth ? (nameOf(sId,'en') + '  /  ' + nameOf(sId,'th')) : nameOf(sId, lang);
  const BILINGUAL_BODY = new Set(['eligibility','payment','booking','cancel','general','custom']);   // section ที่เป็นเนื้อความ → โชว์ EN แล้วตามด้วย TH
  const numOf = (sId) => (CT_DOC_SECTIONS.find(s => s.id === sId)||{}).num || '';

  // Page grouping — multiple sections share one page · 5-6 pages total when all sections enabled
  // §การแบ่งหน้า · นี่คือแค่ "แผนที่อยากได้" ไม่ใช่คำสั่งตายตัว — ความสูงจริงขึ้นกับข้อมูลของเอเยนต์
  // (เอเยนต์ที่มี 6 เส้นทาง × 3 โซน ตาราง pricing กินเกือบเต็มหน้า → eligibility ที่ถูกจับคู่ไว้จะล้นทับ footer)
  // _ctDocFitPages() จะวัดของจริงหลัง render แล้วดัน section ท้ายสุดของหน้าที่ล้นไปหน้าถัดไปให้เอง
  const PAGE_GROUPS = [
    { id:'p1', sections:['cover'] },
    { id:'p2', sections:['parties','programs'] },
    { id:'p3', sections:['pricing','addons'] },        // §ctSwap56 · ตารางราคาแล้วต่อด้วยของขายเพิ่ม · เรื่องเงินอยู่ด้วยกัน
    { id:'p4', sections:['eligibility','payment'] },
    { id:'p5', sections:['booking','cancel','general','custom'] },
    { id:'p6', sections:['signature'] }
  ];
  // Filter groups to only include sections that are enabled · skip empty groups
  const enabledIds = new Set(enabledSections.map(s => s.id));
  const basePlan = PAGE_GROUPS
    .map(g => ({...g, sections: g.sections.filter(sId => enabledIds.has(sId))}))
    .filter(g => g.sections.length > 0);
  // แผนที่ผ่านการวัดแล้ว (ถ้ามี) ต้องประกอบด้วย section ชุดเดียวกับ basePlan เป๊ะ ไม่งั้นถือว่าคนละเอกสาร → ทิ้ง
  const _flat = p => p.reduce((acc,g)=>acc.concat(g.sections),[]).join('|');
  const visibleGroups = (_ctDoc._plan && _flat(_ctDoc._plan)===_flat(basePlan)) ? _ctDoc._plan : basePlan;
  _ctDoc._plan = visibleGroups;
  const totalPagesActual = visibleGroups.length;

  prevHost.innerHTML = visibleGroups.map((group, pageIdx) => {
    const sectionsHtml = group.sections.map((sId, secIdx) => {
      const isCover = sId === 'cover';
      const localizedName = localizedNameOf(sId);
      const num = numOf(sId);
      // Add spacer between sections within the same page (not after the last one)
      const isLastOnPage = secIdx === group.sections.length - 1;
      const spacer = isLastOnPage ? '' : '<div style="height:20px;border-bottom:1px solid #F2F0EA;margin-bottom:18px"></div>';
      return `
        ${isCover ? '' : F.head(num, localizedName, S)}
        <div style="${isCover?'flex:1;display:flex;flex-direction:column':''}">${(isBoth && BILINGUAL_BODY.has(sId)) ? (_ctDocSectionBody(sId,a,rt,'en',fmt) + '<div style="border-top:1px dashed #D8D5CE;margin:12px 0 9px"><span style="display:inline-block;margin-top:7px;font-size:8px;font-weight:700;color:#993556;background:#FBEAF0;border-radius:4px;padding:1px 7px;letter-spacing:.06em">ภาษาไทย</span></div>' + _ctDocSectionBody(sId,a,rt,'th',fmtTH)) : _ctDocSectionBody(sId, a, rt, lang, fmt)}</div>
        ${spacer}
      `;
    }).join('');

    return `
    <div class="ct-doc-page" style="${F.page(S)}">
      ${F.rail(S)}
      ${F.letterhead(a, T, fmt, S)}
      <div style="${F.body}">${sectionsHtml}</div>
      <div class="ct-doc-page-foot" style="left:${F.padL}px">${T('pageFooter')} ${a.contractVersion||'v—'}</div>
      <!-- §เซ็นย่อรายหน้า · ทั้ง Sawanu และสัญญามาตรฐานให้เอเยนต์เซ็นย่อทุกหน้า
           กันสลับหน้า: ถ้ามีแต่ลายเซ็นหน้าสุดท้าย ใครก็เปลี่ยนหน้าราคาทีหลังได้โดยไม่มีร่องรอย -->
      <div style="position:absolute;bottom:11px;right:96px;display:flex;align-items:flex-end;gap:6px">
        <span style="font-size:8px;color:#b8b4ad;letter-spacing:.04em;text-transform:uppercase;padding-bottom:1px">${T('initialHere')}</span>
        <span style="display:inline-block;width:64px;border-bottom:1px solid #c9c5bd;height:11px"></span>
      </div>
      <div class="ct-doc-page-num">${T('page')} ${pageIdx+1} / ${totalPagesActual}</div>
    </div>`;
  }).join('');
  _ctDocFitPages();
}
/* ผสมสีเข้ากับขาว · ใช้ทำ "สีอ่อน" ของแถบ (ตัวหนังสือบนพื้นสีเข้ม) โดยไม่ต้องกรอกมือทีละสี */
function ctSoft(hex, amt){
  return (typeof _bkV2Soft==='function') ? _bkV2Soft(hex, amt==null?0.62:amt) : '#ccc';
}
/* รวมสไตล์ของเอกสารหนึ่งฉบับ · รับได้ทั้ง template และ _ctDoc
   accentHex = สีที่ผู้ใช้เลือกเอง (มีค่า → ชนะ preset) */
function ctStyleOf(o){
  const preset = CT_ACCENTS[(o&&o.accent)||''] || CT_ACCENTS.navy;
  const c = (o && /^#[0-9a-fA-F]{6}$/.test(o.accentHex||'')) ? o.accentHex : preset.c;
  const Fo = CT_FONTS[(o&&o.font)||''] || CT_FONTS.manrope;
  return { c, soft:ctSoft(c, 0.62), fBody:Fo.body, fHead:Fo.head };
}
function ctFormGet(id){ return CT_FORMS[id] || CT_FORMS.ocean; }
function _ctDocFitPages(){
  if(!_ctDoc || !Array.isArray(_ctDoc._plan)) return;
  const _hid = _ctDoc._host || 'ct-doc-preview';   /* §พรีวิว · วัด/เรนเดอร์ซ้ำที่ host เดิม ไม่งั้นหน้า Template จะไปวัดกล่องของ wizard ที่ซ่อนอยู่ (สูง 0) */
  const host = document.getElementById(_hid); if(!host) return;
  const pages = host.querySelectorAll('.ct-doc-page');
  if(!pages.length || pages.length !== _ctDoc._plan.length) return;
  /* §พรีวิว · ถ้ากล่องยังไม่มีความสูง (view ซ่อนอยู่ / ยังไม่ layout) offsetHeight = 0 ทุกหน้า
     → เข้าเงื่อนไข "พอดี" ปลอมๆ หรือแย่กว่านั้นคือวัดผิดแล้วแตกหน้ามั่ว · รอให้มีความสูงจริงก่อน */
  if(!pages[0].offsetHeight){ _ctDoc._fitPass = 0; return; }
  const guard = (_ctDoc._fitPass = (_ctDoc._fitPass||0) + 1);
  if(guard > 8){ _ctDoc._fitPass = 0; return; }        // กันลูปไม่รู้จบ
  let changed = false;
  for(let i = 0; i < pages.length; i++){
    if(pages[i].offsetHeight <= CT_A4_PX + 1) continue;   // พอดีแล้ว
    const grp = _ctDoc._plan[i];
    if(!grp || grp.sections.length < 2){
      console.warn('[contract] section "'+((grp&&grp.sections[0])||'?')+'" สูงเกิน A4 หน้าเดียว · แยกหน้าไม่ได้');
      continue;
    }
    const moved = grp.sections.pop();                     // ยกตัวท้ายสุดออกไปหน้าใหม่
    _ctDoc._plan.splice(i+1, 0, { id: grp.id+'-x', sections: [moved] });
    changed = true;
    break;                                               // ขยับทีละหน้า แล้ววัดใหม่ (ความสูงหน้าหลังๆ เปลี่ยนหมด)
  }
  if(changed){ if(_hid==='ct-doc-preview') ctDocRender(); else _ctDocRenderPages(_hid); }
  else _ctDoc._fitPass = 0;
}

function ctDocSectionMeta(sId, a, rt){
  switch(sId){
    case 'cover':       return {sub:'Title page · letterhead + version'};
    case 'parties':     return {sub:`Operator · Agent (${a.code||a.name})`};
    case 'eligibility': return {sub:'Children rate · Health restrictions', tag:'warning'};
    case 'programs':    return {sub:`${(a.programPeriods||[]).length} routes`, tag:'from contract'};
    /* §ctTierHint · ไม่มีชั้น Selling/Min = สัญญาขึ้นแต่ราคา Net · บอกไว้ตรงนี้ว่าไปกรอกที่ไหน */
    case 'pricing':   return {sub: rt
        ? (`from ${rt.code}` + (ctRtHasTiers(rt) ? '' : ' · <span style="color:#A8773B;font-weight:700">ยังไม่ได้กรอก Selling / Min ใน rate type นี้</span>'))
        : 'no rate type bound', tag: rt?'from RT':''};
    case 'addons':    return {sub: rt && Object.keys(rt.addOns||{}).length ? `${Object.keys(rt.addOns).length} services` : '—', tag: rt?'from RT':''};
    case 'payment':   return {sub: a.payType ? `${a.payType.toUpperCase()} · credit ${a.creditDays||0}d` : '—'};
    case 'booking':   return {sub:'method · cutoff · cancel'};
    case 'cancel':    return {sub:'optional clause'};
    case 'general':   return {sub:'governing law · entire agreement · amendments', tag:'legal'};
    case 'custom':    return {sub:'free-form additions'};
    case 'signature': return {sub:'sales person + agent signatory'};
  }
  return {sub:''};
}

function ctDocFmtDate(iso, lang){
  if(!iso) return '—';
  const d = new Date(iso); if(isNaN(d)) return iso;
  if(lang === 'th'){
    const mTh=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${String(d.getDate()).padStart(2,'0')} ${mTh[d.getMonth()]} ${String(d.getFullYear()+543).slice(2)}`;
  }
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
function ctTmplLoad(){
  if(SB_CONTRACT_TEMPLATES) return SB_CONTRACT_TEMPLATES;
  try{
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    SB_CONTRACT_TEMPLATES = obj.contract_templates || {};
  }catch(e){ SB_CONTRACT_TEMPLATES = {}; }
  ctTmplSeed();
  return SB_CONTRACT_TEMPLATES;
}
function ctTmplPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('sales')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */ 
  try{
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj.contract_templates = SB_CONTRACT_TEMPLATES || {};
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  }catch(e){ console.warn('[ctTmplPersist] failed:', e); }
}
/* ครั้งแรกที่เปิดระบบ: สร้าง template ตั้งต้น 1 ตัวจากข้อความที่ hardcode อยู่ในโค้ดทุกวันนี้
   → เปิดมาเห็นสัญญาเหมือนเดิมเป๊ะ ไม่มีอะไรเปลี่ยน แล้วค่อยแก้ทีหลังได้ */
function ctTmplSeed(){
  if(SB_CONTRACT_TEMPLATES && Object.keys(SB_CONTRACT_TEMPLATES).length) return;
  const text = {en:{}, th:{}};
  ['en','th'].forEach(L => CT_TMPL_KEYS.forEach(k => {
    const v = (CT_DOC_I18N[L]||{})[k];
    if(v !== undefined) text[L][k] = Array.isArray(v) ? v.slice() : v;
  }));
  const sections = {};
  CT_DOC_SECTIONS.forEach(s => { sections[s.id] = !!(s.required || s.defaultOn); });
  const id = 'ctt_std';
  SB_CONTRACT_TEMPLATES = { [id]: {
    id, code:'CT-STD', name:'Standard B2B Agreement',
    active:true, isDefault:true,
    createdDate: new Date().toISOString().slice(0,10),
    note:'ตั้งต้นจากข้อความเดิมในระบบ',
    form:'ocean', accent:'navy', accentHex:'', font:'manrope',
    sections, text
  }};
  ctTmplPersist();
}
function ctTmplAll(){ const m = ctTmplLoad(); return Object.keys(m).map(k=>m[k]); }
function ctTmplGet(id){ return (id && ctTmplLoad()[id]) || null; }
function ctTmplDefault(){
  const all = ctTmplAll().filter(t=>t.active);
  return all.find(t=>t.isDefault) || all[0] || ctTmplAll()[0] || null;
}
/* template ที่เอเยนต์รายนี้ใช้ · ผูกไว้แต่ถูกปิด (active=false) → ตกกลับไป default */
function ctTmplForAgent(a){
  const bound = a && a.contractTemplateId ? ctTmplGet(a.contractTemplateId) : null;
  return (bound && bound.active) ? bound : ctTmplDefault();
}

/* ctDocT อ่านจาก "สำเนา" ที่ wizard คัดมาตอนเปิด (_ctDoc.tmplText) ไม่ใช่จาก template สด
   ไม่มี _ctDoc (เช่นเรียกจากที่อื่น) → ใช้ค่า hardcode เดิม */
function ctDocT(key, lang){
  const L = lang || 'en';
  const snap = (typeof _ctDoc!=='undefined' && _ctDoc && _ctDoc.tmplText && _ctDoc.tmplText[L]) ? _ctDoc.tmplText[L] : null;
  if(snap && snap[key] !== undefined && snap[key] !== null && snap[key] !== '') return snap[key];
  return (CT_DOC_I18N[L] || CT_DOC_I18N.en)[key] || key;
}
function cttSelect(id){ _cttSel = id; _cttEdit = false; renderContractTemplates(); }   // สลับ template → ล็อกกลับทุกครั้ง
function cttToggleEdit(){ _cttEdit = !_cttEdit; _cttSig = null; renderContractTemplates(); }
function cttSetLang(l){ _cttLang = (l==='th') ? 'th' : 'en'; renderContractTemplates(); }
function cttUse(id){ const t = ctTmplGet(id); if(!t) return 0; return (SB_AGENTS||[]).filter(a=>a.contractTemplateId===id).length; }
function cttNew(){
  const base = ctTmplDefault();
  const id = 'ctt_' + Date.now().toString(36);
  const m = ctTmplLoad();
  m[id] = {
    id, code:'CT-'+String(Object.keys(m).length+1).padStart(2,'0'), name:'Template ใหม่',
    active:true, isDefault:false, createdDate:new Date().toISOString().slice(0,10), note:'',
    form:   (base && base.form)   || 'ocean',
    accent:    (base && base.accent)    || 'navy',
    accentHex: (base && base.accentHex) || '',
    font:      (base && base.font)      || 'manrope',
    sections: JSON.parse(JSON.stringify((base && base.sections) || {})),
    text: JSON.parse(JSON.stringify((base && base.text) || {en:{},th:{}}))   /* ก๊อปจาก default มาเป็นจุดตั้งต้น ดีกว่าเริ่มจากศูนย์ */
  };
  ctTmplPersist(); _cttSel = id; _cttEdit = true; _cttSig=null; renderContractTemplates();   // สร้างใหม่ → ปลดล็อกให้แก้ได้ทันที
}
function cttSetField(id, k, v){ if(!_cttEdit) return; const t = ctTmplGet(id); if(!t) return; t[k] = v; ctTmplPersist(); _cttSig=null; renderContractTemplates(); }
function cttSetText(id, key, lang, v){
  if(!_cttEdit) return;   // §ล็อก · กันแก้ตอนยังไม่กด "แก้ไข"
  const t = ctTmplGet(id); if(!t) return;
  const L = (lang==='th') ? 'th' : 'en';   // §Phase 2 · แก้ EN/TH คู่กัน · lang ระบุมาตรงๆ ไม่อิง _cttLang (ซึ่งกลายเป็นภาษาที่พรีวิวเท่านั้น)
  t.text = t.text || {en:{},th:{}}; t.text[L] = t.text[L] || {};
  const def = (CT_TMPL_GROUPS.reduce((a,g)=>a.concat(g.keys),[]).find(x=>x.k===key)||{}).type;
  t.text[L][key] = (def==='list') ? String(v).split('\n').map(s=>s.trim()).filter(Boolean) : v;
  ctTmplPersist();   /* ไม่ re-render ทั้งหน้า · ไม่งั้น cursor เด้งออกจากช่องที่กำลังพิมพ์ */
  cttPreview();      /* อัปเดตเฉพาะพรีวิว · debounce ไว้ กันเรนเดอร์ทุกตัวอักษร */
}
function cttSetForm(id, f){ const t = ctTmplGet(id); if(!t) return; t.form = f; ctTmplPersist(); _cttSig=null; renderContractTemplates(); }
/* เลือก preset → ล้างสีที่พิมพ์เอง ไม่งั้นกดสีสำเร็จรูปแล้วไม่เปลี่ยน (accentHex ชนะเสมอ) งงกันทั้งวัน */
function cttSetAccent(id, a){ const t = ctTmplGet(id); if(!t) return; t.accent = a; t.accentHex = ''; ctTmplPersist(); _cttSig=null; renderContractTemplates(); }
function cttSetHex(id, hex){ const t = ctTmplGet(id); if(!t) return; t.accentHex = /^#[0-9a-fA-F]{6}$/.test(hex||'') ? hex : ''; ctTmplPersist(); _cttSig=null; renderContractTemplates(); }
function cttSetFont(id, f){ const t = ctTmplGet(id); if(!t) return; t.font = f; ctTmplPersist(); _cttSig=null; renderContractTemplates(); }
function cttSampleAgent(){
  const list = (SB_AGENTS||[]);
  return list.find(a=>a.rateTypeId && (a.programPeriods||[]).length) || list.find(a=>a.rateTypeId) || list[0] || null;
}
function cttPreview(){
  clearTimeout(_cttPvTimer);
  _cttPvTimer = setTimeout(_cttPreviewNow, 220);
}
function _cttPreviewNow(){
  const host = document.getElementById('cttv-preview'); if(!host) return;
  const t = ctTmplGet(_cttSel);
  const a = cttSampleAgent();
  if(!t || !a){ host.innerHTML = `<div style="padding:30px;text-align:center;color:#b0aea6;font-size:11.5px">${a?'เลือก template ก่อน':'ยังไม่มีเอเยนต์ในระบบ · พรีวิวต้องใช้ข้อมูลจริงสักราย'}</div>`; return; }
  const sections = {};
  CT_DOC_SECTIONS.forEach(s => { sections[s.id] = s.required ? true : !!(t.sections && t.sections[s.id]); });
  const tmplText = {en:{}, th:{}};
  ['en','th'].forEach(L => { const src=(t.text&&t.text[L])||{}; Object.keys(src).forEach(k => { tmplText[L][k] = Array.isArray(src[k])?src[k].slice():src[k]; }); });
  /* ยืม _ctDoc ชั่วคราว · wizard ปิดอยู่ตอนเราอยู่หน้านี้ แต่คืนค่าเดิมให้เสมอกันพลาด */
  const _keep = _ctDoc;
  _ctDoc = { agentId:a.id, lang:_cttLang, sections, editMode:false,
             templateId:t.id, templateName:t.name, form:t.form||'ocean', accent:t.accent||'navy', accentHex:t.accentHex||'', font:t.font||'manrope',
             tmplText, overrides:{}, customClauses:[] };
  try{ _ctDocRenderPages('cttv-preview'); }catch(err){ host.innerHTML = '<div style="padding:20px;color:#A32D2D;font-size:11px">พรีวิวเรนเดอร์ไม่ผ่าน: '+String(err.message||err)+'</div>'; }
  _ctDoc = _keep;
  /* หน้ากระดาษกว้าง 794px (A4 จริง) · ย่อด้วย transform ซึ่งไม่ยุบพื้นที่ที่มันจอง
     → ต้องตั้งความสูงกล่องนอกเอง ไม่งั้นจะเหลือช่องว่างยาวเป็นกิโล
     (ห้ามใช้ zoom แทน — zoom เปลี่ยน offsetHeight แล้ว _ctDocFitPages จะวัดความสูงหน้าผิด) */
  const box = document.getElementById('cttv-pvbox');
  if(box){
    host.style.width = '794px';
    host.style.transformOrigin = 'top left';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.gap = '14px';
    /* zoom = null → พอดีความกว้างกล่องเสมอ · หน้ากระดาษกว้าง 794px ตายตัว ถ้าตั้ง % ตายตัวไว้
       พอหน้าต่างเบราว์เซอร์แคบลง หน้ากระดาษจะโดนตัดขอบขวาทันที (ที่เจออยู่) */
    const avail = Math.max(120, box.clientWidth || box.parentElement.clientWidth - 22);
    const z = _cttZoom || Math.min(1, avail / 794);
    host.style.transform = 'scale(' + z + ')';
    box.style.height = Math.max(120, Math.round(host.scrollHeight * z)) + 'px';
    const l = document.getElementById('cttv-zoomlbl');
    if(l) l.textContent = _cttZoom ? (Math.round(z*100)+'%') : 'พอดี';
  }
}
function cttSetZoom(z){ _cttZoom = z; _cttPreviewNow(); }
function cttZoomStep(d){
  const host = document.getElementById('cttv-preview'), box = document.getElementById('cttv-pvbox');
  const cur = _cttZoom || (box ? Math.min(1, (box.clientWidth||400)/794) : 0.5);
  _cttZoom = Math.min(1.2, Math.max(0.25, cur + d));
  _cttPreviewNow();
}
function cttSetSection(id, sid, on){ const t = ctTmplGet(id); if(!t) return; t.sections = t.sections||{}; t.sections[sid] = !!on; ctTmplPersist(); _cttSig=null; renderContractTemplates(); }
function cttSetDefault(id){
  const m = ctTmplLoad();
  Object.keys(m).forEach(k => { m[k].isDefault = (k===id); });   /* default มีได้ตัวเดียว */
  const t = m[id]; if(t) t.active = true;                        /* default ต้อง active เสมอ ไม่งั้นเอเยนต์ที่ไม่ผูกจะไม่มีสัญญาใช้ */
  ctTmplPersist(); _cttSig=null; renderContractTemplates();
}
function cttToggleActive(id){
  const t = ctTmplGet(id); if(!t) return;
  if(t.isDefault && t.active){ alert('ปิด template ที่เป็นค่าตั้งต้นไม่ได้\n\nตั้ง template อื่นเป็นค่าตั้งต้นก่อน'); return; }
  t.active = !t.active; ctTmplPersist(); _cttSig=null; renderContractTemplates();
}
function cttDelete(id){
  const t = ctTmplGet(id); if(!t) return;
  if(t.isDefault){ alert('ลบ template ที่เป็นค่าตั้งต้นไม่ได้'); return; }
  const n = cttUse(id);
  if(!confirm('ลบ template "'+t.name+'"?'+(n?('\n\nมีเอเยนต์ '+n+' รายผูกอยู่ — จะตกกลับไปใช้ค่าตั้งต้น'):'')+'\n\nสัญญาที่ export ไปแล้วไม่กระทบ (เก็บข้อความไว้ในตัวเองแล้ว)')) return;
  const m = ctTmplLoad(); delete m[id];
  (SB_AGENTS||[]).forEach(a=>{ if(a.contractTemplateId===id) a.contractTemplateId = null; });
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  ctTmplPersist(); _cttSel = null; _cttSig=null; renderContractTemplates();
}
function cttResetKey(id, key, lang){
  const t = ctTmplGet(id); if(!t) return;
  const L = (lang==='th') ? 'th' : 'en';
  const v = (CT_DOC_I18N[L]||{})[key];
  t.text = t.text||{en:{},th:{}}; t.text[L] = t.text[L]||{};
  t.text[L][key] = Array.isArray(v) ? v.slice() : v;
  ctTmplPersist(); _cttSig=null; renderContractTemplates();
}
function _cttSigNow(){
  try{ return JSON.stringify(ctTmplLoad()) + '' + _cttSel + '' + _cttLang + '' + ((cttSampleAgent()||{}).id||''); }
  catch(e){ return String(Math.random()); }
}

// Editable text helper — when wizard is in Edit mode, wrap content in contenteditable span/div
function ctDocEditable(key, defaultText, opts){
  opts = opts || {};
  const inEdit = _ctDoc && _ctDoc.editMode;
  const value = ctDocGetField(key, defaultText);
  const isOverridden = _ctDoc && _ctDoc.overrides && _ctDoc.overrides[key] !== undefined;
  const overrideHint = inEdit && isOverridden
    ? `<button onclick="ctDocResetField('${key}')" type="button" title="Revert to default"
        style="background:transparent;border:none;color:#A32D2D;font-size:9.5px;cursor:pointer;margin-left:4px;padding:0;font-family:inherit">↺</button>`
    : '';
  const tagName = opts.block ? 'div' : 'span';
  // Use HTML-encoded text so user input doesn't break the page
  const safeText = (value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if(!inEdit) {
    if(opts.block) return `<${tagName} style="${opts.style||''}">${safeText.replace(/\n/g,'<br>')}</${tagName}>`;
    return `<${tagName} style="${opts.style||''}">${safeText}</${tagName}>`;
  }
  return `<${tagName} class="ct-doc-edit" contenteditable="true" data-key="${key}"
    onblur="ctDocSaveField('${key}', this)"
    style="${opts.style||''};white-space:${opts.block?'pre-wrap':'normal'}"
    >${safeText}</${tagName}>${overrideHint}`;
}

// ─── Section renderers — each returns the inner HTML of the page body (no page chrome) ───
function ctDocRenderCover(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const ci = a.companyInfo || {};
  return `
    <div style="text-align:center;padding:36px 24px 28px;flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;color:#5F5E5A;text-transform:uppercase">${ctDocEditable('cover.kicker', T('contractTitle'))}</div>
        <div style="font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#0F1419;margin-top:14px">${ctDocEditable('cover.title', T('docTitle'))}</div>
        <div style="font-size:11px;color:#7a7770;margin-top:8px;font-variant-numeric:tabular-nums">${T('version')} ${a.contractVersion||'—'}  ·  ${T('effective')} ${fmt(a.contractStart)} → ${fmt(a.contractEnd)}</div>
      </div>
      <div style="margin:8px auto;width:60%;border-top:1px solid #C8C6BF"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:30px;text-align:left">
        <div style="flex:1;padding:16px 18px;background:#FAFAF6;border:1px solid #E0DED8;border-radius:6px">
          <div style="font-size:9.5px;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:6px">${T('between')}</div>
          <div style="font-size:14px;font-weight:700;color:#0F1419">Love Island Co., Ltd.</div>
          <div style="font-size:10.5px;color:#5F5E5A;margin-top:5px;line-height:1.5">9/239-240 Sakdidet Rd · T.Talat Nuea<br>A.Muang · Phuket 83000 · Thailand<br>TAT License No. 31/00986</div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#5F5E5A;align-self:center">${T('and')}</div>
        <div style="flex:1;padding:16px 18px;background:#FAFAF6;border:1px solid #E0DED8;border-radius:6px">
          <div style="font-size:9.5px;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:6px">${T('and')}</div>
          <div style="font-size:14px;font-weight:700;color:#0F1419">${ci.legalName||a.name}</div>
          <div style="font-size:10.5px;color:#5F5E5A;margin-top:5px;line-height:1.5">${ci.address||'—'}</div>
        </div>
      </div>
      <div style="font-size:10px;color:#9b9590;margin-top:18px;font-style:italic;line-height:1.6">
        This agreement is made between the parties named above and is effective as of the date stated. Both parties agree to the terms set forth in the following pages.
      </div>
    </div>`;
}

function ctDocRenderParties(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const ci  = a.companyInfo || {};
  const sig = a.agentSignatory || {};
  const sales = (typeof sbGetSales==='function') ? sbGetSales(a.sales) : null;
  /* §คู่สัญญา 2 คอลัมน์ · เดิมวาง Operator ทับ Agent เป็นตับลงมา ครึ่งขวาของหน้าว่างเปล่าทั้งแถบ
     สัญญาทุกฉบับ (ทั้ง Sawanu และฟอร์แมต .docx ของเรา) วางคู่สัญญา "เทียบกันซ้าย-ขวา" เพื่อให้อ่านเทียบได้
     label เดิมกว้าง 120px ซึ่งพอดีตอนกินเต็มหน้า แต่พอเหลือครึ่งเดียว ที่อยู่ยาวๆ จะดันจนล้นทับแถวล่าง
     → ลด label เหลือ 74px และให้ค่าตัดบรรทัดเองได้ */
  const block = (title, lines) => `
    <div style="background:#FAFAF6;border:1px solid #E0DED8;border-radius:4px;padding:14px 16px;height:100%;box-sizing:border-box">
      <div style="font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">${title}</div>
      ${lines}
    </div>`;
  const row = (lbl, val) => `<div style="display:flex;gap:10px;font-size:10.5px;line-height:1.65;align-items:baseline"><span style="flex:none;width:74px;color:#7a7770">${lbl}</span><span style="flex:1;min-width:0;color:#0F1419;font-weight:500;overflow-wrap:break-word">${val||'—'}</span></div>`;
  const operatorBlock = block(`1. ${T('operator')}`, `
    <div style="font-size:13px;font-weight:700;color:#0F1419;margin-bottom:6px">Love Island Co., Ltd.</div>
    ${row(T('address'), '9/239-240 Sakdidet Rd, T.Talat Nuea, A.Muang, Phuket 83000, Thailand')}
    ${row(T('tatLicense'), '31/00986')}
    ${row(T('telephone'), '076-390 250, 076-390 260')}
    ${row('Hotline', '088-765 4678, 081-970 9977')}
    ${row('Fax', '076-390 280')}
    ${row(T('email'), 'book@loveandaman.com')}
    ${row(T('website'), 'www.loveandaman.com')}
  `);
  /* §ช่องเว้นให้กรอก · ข้อมูลเอเยนต์ที่ยังไม่มีในระบบ เดิมพิมพ์ "—" ออกมา — สัญญาที่มีขีดตรงช่อง Tax ID
     คือช่องที่จะว่างตลอดไป · Sawanu เว้นเป็น "เส้นประ" ให้เอเยนต์เขียนตอนเซ็น เราทำแบบเดียวกัน
     (มีข้อมูลในระบบก็พิมพ์ให้เลย ไม่ต้องเขียน — ดีกว่าเว้นว่างทั้งใบแบบ Sawanu)                    */
  const fill = (v) => v ? String(v) : `<span style="display:block;width:100%;border-bottom:1px dotted #a9a59d;height:12px"></span>`;   /* เส้นประเต็มความกว้างของช่อง · ห้าม min-width คงที่ ไม่งั้นดันคอลัมน์ครึ่งหน้าจนล้น */
  const agentBlock = block(`2. ${T('agent')}`, `
    <div style="font-size:13px;font-weight:700;color:#0F1419;margin-bottom:6px">${ci.legalName||a.name||fill('')}</div>
    ${row(T('taxId'), fill(ci.taxId))}
    ${row(T('address'), fill(ci.address))}
    ${row(T('tatLicense'), fill(ci.tatLicense))}
    ${row(T('telephone'), fill(ci.tel))}
    ${row(T('email'), fill(a.email))}
    ${row(T('website'), fill(ci.website))}
  `);
  const signatoryBlock = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
      ${block(T('salesPerson'), `
        <div style="font-size:12px;font-weight:600;color:#0F1419;margin-bottom:4px">${sales?.fullName || sales?.name || '—'}</div>
        ${row(T('position'), sales?.designation || '—')}
        ${row(T('email'), sales?.email || '—')}
        ${row(T('telephone'), sales?.tel || '—')}
      `)}
      ${block(T('agentSignatory'), `
        <div style="font-size:12px;font-weight:600;color:#0F1419;margin-bottom:4px">${sig.name||'—'}</div>
        ${row(T('position'), sig.designation || '—')}
        ${row(T('date'), fmt(sig.signedDate))}
        ${row(T('telephone'), sig.tel || '—')}
      `)}
    </div>`;
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;margin-bottom:10px">
      ${operatorBlock}
      ${agentBlock}
    </div>
    ${signatoryBlock}`;
}

function ctDocRenderEligibility(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  return `
    <!-- Children Rates -->
    <div style="background:#fff;border:1px solid #E0DED8;border-radius:6px;padding:12px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="background:#185FA5;color:#fff;font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:6px;letter-spacing:.05em">5.1</span>
        <span style="font-size:13px;font-weight:700;color:#0F1419;letter-spacing:-0.005em">${T('childRateTitle')}</span>
      </div>
      <div style="font-size:11.5px;color:#0F1419;line-height:1.7;padding-left:2px">${T('childRateBody')}</div>
    </div>

    <!-- Special Consideration · health restrictions · big bold pills -->
    <div style="background:#FCEBEB;border:1.5px solid #F5BCBC;border-radius:6px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="background:#A32D2D;color:#fff;font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:6px;letter-spacing:.05em">5.2</span>
        <span style="font-size:13px;font-weight:700;color:#0F1419;letter-spacing:-0.005em">${T('specialTitle')}</span>
      </div>

      <!-- NOT RECOMMENDED · amber pills -->
      <div style="background:#fff;border-left:4px solid #A8773B;border-radius:4px;padding:11px 14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="background:#A8773B;color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 11px;border-radius:5px">${T('notRecLabel')}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${T('notRecItems').map(item => `<span style="background:#FFF7E8;color:#854F0B;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:6px;border:1.5px solid #A8773B;letter-spacing:.005em;line-height:1.2">${item}</span>`).join('')}
        </div>
      </div>

      <!-- NOT ALLOWED · red pills · most prominent -->
      <div style="background:#fff;border-left:4px solid #A32D2D;border-radius:4px;padding:11px 14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="background:#A32D2D;color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 11px;border-radius:5px">⚠ ${T('notAllowedLabel')}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${T('notAllowedItems').map(item => `<span style="background:#FDECEA;color:#7A1E1E;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:6px;border:1.5px solid #A32D2D;letter-spacing:.005em;line-height:1.2;text-transform:uppercase">${item}</span>`).join('')}
        </div>
      </div>

      <!-- FOOD ALLERGY · subtle paragraph -->
      <div style="background:#fff;border-left:3px solid #5F5E5A;border-radius:4px;padding:8px 12px">
        <span style="background:#F1EFE8;color:#5F5E5A;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:4px;margin-right:8px">${T('foodAllergyLabel')}</span>
        <span style="font-size:11.5px;color:#0F1419;line-height:1.6">${T('foodAllergyBody')}</span>
      </div>
    </div>
  `;
}

function ctDocRenderPrograms(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const ROUTES_ARR = (typeof ROUTES !== 'undefined' && ROUTES) || [];
  const _rvMap = rt ? (rt.routeValidity || {}) : {};
  const periodsRaw = a.programPeriods || [];
  const periods = periodsRaw.map(p => {
    const rv = _rvMap[p.routeId];
    if(rv) return Object.assign({}, p, {travelFrom: rv.from||'', travelTo: rv.to||''});
    if(rt) return Object.assign({}, p, {travelFrom:'', travelTo:''});
    return p;
  });
  const rows = periods.map(p => {
    const r = ROUTES_ARR.find(x => x.id === p.routeId);
    const rName = r ? r.name : p.routeId;
    const pier = (r?.pier || '').toUpperCase().replace('TUBLAMU','Tub Lamu').replace('PANWA','Visit Panwa');
    /* §ตารางเดินเรือ · โปรแกรมเราวิ่ง "ทุกวัน" ในช่วงที่เปิด — ไม่มีข้อมูลวันในสัปดาห์ให้ทำตาราง Mon/Wed/Sat
       แบบฟอร์แมต .docx ได้ · แต่ของที่สัญญาต้องการจริงๆ และเรามีอยู่คือ เวลาออกเรือ + ช่วงเปิดฤดูกาล
       (Sawanu ก็เขียนว่า "Operation of Similan is during 15Oct to 15May only") → เอาสองอันนี้มาโชว์ */
    const dep = (r && Array.isArray(r.times) && r.times.length) ? r.times.join(' · ') : '';
    const _open = (r && Array.isArray(r.seasons)) ? r.seasons.filter(s=>s && s.type==='open') : [];
    const _seasonal = !!(r && Array.isArray(r.seasons) && r.seasons.some(s=>s && s.type==='closed'));
    const _win = (_seasonal && _open.length) ? _open.map(s=>fmt(s.from)+' → '+fmt(s.to)).slice(0,2).join(' · ') : '';
    return `<tr style="border-top:1px solid #F2F0EA">
      <td style="padding:8px 0;font-size:11px;font-weight:600;color:#0F1419">${rName}<div style="font-size:9.5px;color:#7a7770;font-weight:500;margin-top:1px">${pier}${dep?` <span style="color:#c9c5bd">·</span> <span style="font-variant-numeric:tabular-nums">${dep}</span>`:''}</div>${_win?`<div style="display:inline-block;margin-top:3px;font-size:8.5px;background:#FBF6EE;color:#7a5622;border-radius:3px;padding:1px 6px;font-variant-numeric:tabular-nums;white-space:nowrap">${T('seasonOnly')} ${_win}</div>`:''}</td>
      <td style="padding:8px 10px;font-size:10.5px;font-variant-numeric:tabular-nums;color:#5F5E5A">${fmt(p.bookFrom)} → ${fmt(p.bookTo)}</td>
      <td style="padding:8px 10px;font-size:10.5px;font-variant-numeric:tabular-nums;color:#5F5E5A">${p.travelFrom||p.travelTo ? `${fmt(p.travelFrom)} → ${fmt(p.travelTo)}` : `<span style="color:#A32D2D">${T('notSet')}</span>`}</td>
      <td style="padding:8px 0;font-size:10px;color:#5F5E5A;font-style:italic">${p.note||''}</td>
    </tr>`;
  }).join('');
  return `
    <table style="width:100%;border-collapse:collapse">
      <colgroup>
        <col style="width:34%"><col style="width:22%"><col style="width:22%"><col>
      </colgroup>
      <thead>
        <tr>
          <th style="padding:6px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('program')}</th>
          <th style="padding:6px 10px;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('bookingPeriod')}</th>
          <th style="padding:6px 10px;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('travelPeriod')}</th>
          <th style="padding:6px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('notes')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${rt ? `<div style="margin-top:10px;font-size:9.5px;color:#7a7770;font-style:italic">⌗ ${T('inheritFromRT')}: <strong>${rt.code} · ${rt.name}</strong></div>` : ''}
  `;
}

// §ctTierHint · rate type นี้กรอกชั้น Selling / Min sell ไว้หรือยัง · ใช้ทั้งการ์ดแถบซ้ายและตัวสัญญา
function ctRtHasTiers(rt){
  const t = rt && rt.priceTiers; if(!t) return false;
  return Object.keys(t).some(rid => Object.keys(t[rid]||{}).some(z =>
    Object.keys(t[rid][z]||{}).some(p => {
      const c = t[rid][z][p] || {};
      return (c.sell===0||c.sell) || (c.minSell===0||c.minSell);
    })));
}
function ctDocRenderPricing(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  if(!rt) return `<div style="padding:30px;text-align:center;color:#A32D2D;font-style:italic">No Rate Type bound · cannot render pricing</div>`;
  const ROUTES_ARR = (typeof ROUTES !== 'undefined' && ROUTES) || [];
  const rName = (rId) => (ROUTES_ARR.find(r => r.id === rId)||{}).name || rId;
  const fmtN = (n) => (n||0).toLocaleString();
  const TH_FG='#143F73', FR_FG='#854F0B';
  // Filter to routes in agent contract
  const agentRouteIds = (a.programPeriods||[]).map(p => p.routeId).filter(Boolean);
  // Seat rates
  const ZONES=['PK','KL','NoTransfer'];
  const _rtScope=(typeof rtNatScopeOf==='function')?rtNatScopeOf(rt):'both';   // §nationality scope on the contract
  const PAX=(typeof rtNatPax==='function')?rtNatPax(_rtScope):['adult-thai','child-thai','adult-fr','child-fr'];
  const NC=rtNatCols(PAX);   // §rtNatCols · บั๊กเดียวกับหน้าจอ · ใบนี้ส่งถึงมือเอเย่นต์ด้วย
  let seatRows = '';
  (rt.routes||[]).filter(rId => agentRouteIds.includes(rId)).forEach(rId => {
    const rr = rt.seatRates && rt.seatRates[rId];
    if(!rr) return;
    // Only zones that are actually offered (non-null cell). Dynamic rowspan keeps
    // the route-name column aligned even when KL (or PK) is "Not Offered".
    const presentZones = ZONES.filter(z => rr[z]);
    if(!presentZones.length) return;
    /* §ctTierRow · ตารางนี้มี ไทย×ต่างชาติ×ผู้ใหญ่/เด็ก = 4 ช่องอยู่แล้ว · ถ้าแตกเป็นคอลัมน์ Net/Sell/Min
       จะกลายเป็น 12 ช่อง = ล้น A4 → แตกเป็น "บรรทัดที่สองของแถว" แทน ตัวเลขยังอยู่คอลัมน์เดิม
       ต้องรู้ก่อนว่าโซนไหนมีชั้นสัญญาบ้าง ถึงจะตั้ง rowspan ของชื่อเส้นทางได้ถูก */
    const zInfo = presentZones.map(z => {
      const tiers = PAX.map(p => (rt.priceTiers && rt.priceTiers[rId] && rt.priceTiers[rId][z] && rt.priceTiers[rId][z][p]) || {});
      const has = tiers.some(t => (t.sell===0||t.sell) || (t.minSell===0||t.minSell));
      return { z, tiers, has };
    });
    const totalRows = zInfo.reduce((n,x) => n + (x.has?2:1), 0);
    zInfo.forEach(({z, tiers, has}, idx) => {
      const isFirst = idx===0;
      const cell = rr[z];
      const rowTop = isFirst ? 'border-top:1px solid #E0DED8' : 'border-top:1px solid #F2F0EA';
      seatRows += `<tr style="${rowTop}">
        ${isFirst ? `<td rowspan="${totalRows}" style="padding:8px 12px 8px 0;vertical-align:top;font-size:11px;font-weight:600;color:#0F1419;line-height:1.3">${rName(rId)}</td>` : ''}
        <td style="padding:5px 10px ${has?'0':'5px'};font-size:9.5px;color:#5F5E5A;text-transform:uppercase;letter-spacing:.05em;font-weight:600">${z==='NoTransfer'?'No tr.':z}</td>
        ${PAX.map((p,pi) => `<td style="padding:5px 10px ${has?'0':'5px'};text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#0F1419;${pi===NC.lastTh?'padding-right:18px;':''}${pi===NC.firstFr&&NC.th.length?'border-left:1px solid #F2F0EA;':''}"><div style="font-weight:600">${fmtN(cell[p])}</div></td>`).join('')}
      </tr>`;
      /* บรรทัดชั้นสัญญา · ป้ายอยู่ในคอลัมน์ Zone ครั้งเดียวต่อแถว ไม่ต้องซ้ำทุกเซลล์ */
      if(has){
        seatRows += `<tr>
          <td style="padding:1px 10px 6px;font-size:7.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#B9B4AC;white-space:nowrap">${T('tierRowLbl')}</td>
          ${PAX.map((p,pi) => {
            const _t = tiers[pi] || {};
            const _s = (_t.sell===0||_t.sell) ? fmtN(_t.sell) : '—';
            const _m = (_t.minSell===0||_t.minSell) ? fmtN(_t.minSell) : '—';
            return `<td style="padding:1px 10px 6px;text-align:right;font-size:8.5px;color:#9b9590;font-variant-numeric:tabular-nums;white-space:nowrap;${pi===NC.lastTh?'padding-right:18px;':''}${pi===NC.firstFr&&NC.th.length?'border-left:1px solid #F2F0EA;':''}">${_s} <span style="color:#c9c5bd">/</span> ${_m}</td>`;
          }).join('')}
        </tr>`;
      }
    });
  });
  /* คำอธิบายใต้ตาราง — ขึ้นเฉพาะเมื่อ rate type นี้กรอกชั้นสัญญาไว้จริง */
  const _hasTiers = ctRtHasTiers(rt);
  const tierLegend = _hasTiers ? `
    <div style="display:flex;gap:6px 20px;flex-wrap:wrap;margin-top:7px;padding:7px 11px;background:#FAFAF6;border:1px solid #E9E7E0;border-radius:4px">
      <span style="font-size:9px;color:#5F5E5A;line-height:1.5"><b style="color:#0F1419;font-size:10px">1,800</b> &nbsp;${T('tierNet')}</span>
      <span style="font-size:9px;color:#5F5E5A;line-height:1.5"><b style="color:#B9B4AC;font-size:7.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${T('tierRowLbl')}</b> &nbsp;<b style="color:#9b9590">3,500</b> ${T('tierSell')} &nbsp;<span style="color:#c9c5bd">/</span>&nbsp; <b style="color:#9b9590">2,500</b> ${T('tierMin')}</span>
    </div>` : '';
  const seatTable = seatRows ? `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th rowspan="2" style="padding:6px 0;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">${T('route')}</th>
          <th rowspan="2" style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">${T('zone')}</th>
          ${NC.th.length?`<th colspan="${NC.th.length}" style="padding:5px 10px;text-align:center;font-size:9.5px;font-weight:700;color:${TH_FG};letter-spacing:.05em;text-transform:uppercase;border-bottom:1.5px solid ${TH_FG}">${T('thai')}</th>`:''}
          ${NC.fr.length?`<th colspan="${NC.fr.length}" style="padding:5px 10px;text-align:center;font-size:9.5px;font-weight:700;color:${FR_FG};letter-spacing:.05em;text-transform:uppercase;border-bottom:1.5px solid ${FR_FG};${NC.th.length?'border-left:1px solid #F2F0EA;':''}">${T('foreigner')}</th>`:''}
        </tr>
        <tr>
          ${PAX.map((p,pi)=>`<th style="padding:4px ${pi===NC.lastTh?'18px':'10px'} 4px 10px;text-align:right;font-size:8.5px;font-weight:600;color:#5F5E5A;${pi===NC.firstFr&&NC.th.length?'border-left:1px solid #F2F0EA;':''}">${T(/^adult/.test(p)?'adult':'child')}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${seatRows}</tbody>
    </table>${_rtScope!=='both'?`<div style="margin-top:6px;font-size:10px;color:${_rtScope==='fr'?'#854F0B':'#143F73'};font-style:italic">* ${_rtScope==='fr'?'Foreigner rate only':'Thai rate only'}</div>`:''}` : `<div style="font-size:11px;color:#9b9590;font-style:italic;padding:8px 0">No seat rates in this rate type</div>`;
  // Charter rates
  let charterRows = '';
  Object.keys(rt.charterRates||{}).filter(rId => agentRouteIds.includes(rId)).forEach(rId => {
    const cr = rt.charterRates[rId];
    Object.keys(cr).forEach(bt => {
      const ch = cr[bt];
      const inc = ch.starterIncludes || 4;
      charterRows += `<tr style="border-top:1px solid #F2F0EA">
        <td style="padding:7px 0;font-size:11px;font-weight:500;color:#0F1419">${rName(rId)}</td>
        <td style="padding:7px 10px;font-size:10px;color:#5F5E5A;text-transform:capitalize">${bt}</td>
        <td style="padding:7px 10px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:#0F1419">${fmtN(ch.starterPrice)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:10px;font-variant-numeric:tabular-nums;color:#5F5E5A">${inc} pax</td>
        <td style="padding:7px 0;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#0F1419">+${fmtN(ch.extraPerPax)}</td>
      </tr>`;
    });
  });
  const charterTable = charterRows ? `
    <table style="width:100%;border-collapse:collapse;margin-top:18px">
      <thead><tr>
        <th style="padding:6px 0;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('route')}</th>
        <th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('vessel')}</th>
        <th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('starterPrice')}</th>
        <th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('includes')}</th>
        <th style="padding:6px 0;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #1A2B43">${T('marginal')}</th>
      </tr></thead>
      <tbody>${charterRows}</tbody>
    </table>` : '';
  /* §TOUR INCLUDED · ทั้ง Sawanu และฟอร์แมต .docx ของเราระบุ "ราคานี้รวมอะไรบ้าง" ไว้ใต้ตารางเสมอ
     — ไม่ระบุ = เถียงกันหน้างานว่าค่าอุทยานรวมหรือยัง · เป็นของบริษัท ไม่ใช่ของเอเยนต์ จึงเป็นค่าคงที่
     แก้รายเอเยนต์ได้ผ่านโหมด Edit text (ctDocEditable) เหมือน clause อื่น */
  const included = (T('includedList')||'').split('|').filter(Boolean);
  const includedBox = included.length ? `
    <div style="margin-top:14px;border:1px solid #E0DED8;border-radius:5px;overflow:hidden">
      <div style="background:#FAFAF6;padding:5px 11px;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.07em;text-transform:uppercase;border-bottom:1px solid #E0DED8">${T('tourIncluded')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;padding:8px 11px">
        ${included.map(x=>`<span style="font-size:9.5px;background:#E1F5EE;color:#0F6E56;border-radius:4px;padding:2px 8px;white-space:nowrap">${x.trim()}</span>`).join('')}
      </div>
    </div>` : '';
  return `
    <div style="font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">${T('seatRates')}</div>
    ${seatTable}
    ${tierLegend}
    ${charterRows ? `<div style="font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin-top:16px;margin-bottom:8px">${T('charterRates')}</div>${charterTable}` : ''}
    ${includedBox}
    <div style="margin-top:9px;font-size:9.5px;color:#7a7770;font-style:italic">⌗ Sourced from Rate Type · <strong>${rt.code} · ${rt.name}</strong></div>
  `;
}

function ctDocRenderAddOns(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  if(!rt) return `<div style="padding:20px;text-align:center;color:#9b9590;font-style:italic">No Rate Type bound</div>`;
  const ROUTES_ARR = (typeof ROUTES !== 'undefined' && ROUTES) || [];
  const rName = (rId) => (ROUTES_ARR.find(r => r.id === rId)||{}).name || rId;
  const fmtN = (n) => (n||0).toLocaleString();
  const ctx = { T, fmtN, rName, lang };
  const parts = (typeof RT_ADDON_DEFS!=='undefined'?RT_ADDON_DEFS:[]).filter(d=>d.contract).map(d=>d.contract(rt, ctx)).filter(Boolean);
  return parts.join('') || `<div style="padding:20px;color:#9b9590;font-style:italic;text-align:center">No add-ons in this rate type</div>`;
}

function ctDocRenderPayment(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const payLbl = {invoice:'Invoice (Credit)', cot:'Cash on Tour', proforma:'Proforma Invoice'}[a.payType] || a.payType || '—';
  const row = (lbl, val) => `<tr style="border-top:1px solid #F2F0EA">
    <td style="padding:9px 0;font-size:11px;color:#5F5E5A">${lbl}</td>
    <td style="padding:9px 10px;text-align:right;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;color:#0F1419">${val}</td>
  </tr>`;
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <tbody>
        ${row(T('paymentMethod'), payLbl)}
        ${row(T('creditDays'), (a.creditDays||0)+' days')}
        ${row(T('creditLimit'), '฿'+(a.creditLimit||0).toLocaleString())}
        ${row(T('latePayment'), T('latePaymentVal'))}
        ${row(T('creditCardLabel'), T('creditCardVal'))}
      </tbody>
    </table>

    <div style="font-size:10px;color:#5F5E5A;margin:-4px 0 12px">${T('taxNote')}</div>

    <!-- Bank details -->
    <div style="background:#F4F8FB;border-left:3px solid #185FA5;border-radius:4px;padding:10px 14px;margin-bottom:12px">
      <div style="font-size:9.5px;font-weight:700;color:#185FA5;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px">${T('bankTitle')}</div>
      <div style="font-size:11px;color:#0F1419;line-height:1.55">${String(T('bankBody')||'').replace(/\n/g,'<br>')}</div>
    </div>

    ${ctDocEditable('payment.note', T('paymentNote'), {block:true, style:'font-size:10.5px;color:#5F5E5A;line-height:1.7;display:block'})}
  `;
}

function ctDocRenderBooking(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const bc = a.bookingChannel || {};
  const row = (lbl, val) => `<tr style="border-top:1px solid #F2F0EA">
    <td style="padding:9px 0;font-size:11px;color:#5F5E5A;width:36%">${lbl}</td>
    <td style="padding:9px 10px;font-size:11.5px;color:#0F1419;font-weight:500">${val||'—'}</td>
  </tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tbody>
      ${row(T('bookingMethod'), bc.method || 'Email + Phone')}
      ${row(T('cutoff'), bc.cutoff || '1 day in advance · before 18:00')}
      ${row(T('bookingEmail'), bc.email || 'book@loveandaman.com')}
      ${row(T('bookingPhone'), bc.phone || '+66 88 765 4678, +66 81 970 9977')}
    </tbody>
  </table>
  <div style="font-size:10.5px;color:#5F5E5A;line-height:1.7">${T('bookingBody')}</div>
  <div style="font-size:10.5px;color:#5F5E5A;line-height:1.7;margin-top:8px">${T('passportNote')}</div>`;
}

function ctDocRenderCancel(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const bc = a.bookingChannel || {};
  return `
    ${ctDocEditable('cancel.body', bc.cancelPolicy || T('cancelDefault'), {block:true, style:'font-size:11.5px;color:#0F1419;line-height:1.7;display:block;margin-bottom:12px'})}
    <div style="font-size:11px;color:#5F5E5A;line-height:1.7;padding:10px 14px;background:#FFF5EB;border-left:3px solid #854F0B;border-radius:4px">
      ${T('compensationBody')}
    </div>
  `;
}

// Standard clauses panel — used in Custom Clauses default state to provide quick fill
function ctDocStandardClauses(lang){
  return lang === 'th' ? [
    {title:'1. อายุเด็ก', body:'เด็ก หมายถึง ผู้ที่มีอายุระหว่าง 4-11 ปี · ราคาในตารางคิดในอัตราเด็ก'},
    {title:'2. ข้อพิจารณาพิเศษ', body:'เด็กอายุต่ำกว่า 1 ปี · ผู้สูงอายุมากกว่า 65 ปี · สัตว์เลี้ยง ไม่แนะนำให้เดินทาง · ลูกค้าที่เป็นโรคความดันโลหิตสูง โรคหัวใจ ตั้งครรภ์ โรคหอบหืด โรคเกี่ยวกับกระดูกสันหลัง บริษัทไม่อนุญาตให้เดินทาง'},
    {title:'3. การคืนเงินกรณีบริษัทยกเลิกทริป', body:'กรณีที่บริษัทจำเป็นต้องยกเลิกโปรแกรมเนื่องจากสภาพอากาศเลวร้ายหรือเหตุเร่งด่วนอื่น · บริษัทจะคืนเงินเต็มจำนวนสำหรับทริปนั้นเท่านั้น · กรณีลูกค้าน้อยกว่าจำนวนขั้นต่ำที่กำหนด บริษัทขอสงวนสิทธิ์ยกเลิกและคืนเฉพาะค่าทริปดำน้ำ'},
    {title:'4. ราคาขึ้นกับปัจจัย', body:'ราคาอาจมีการเปลี่ยนแปลงได้ ขึ้นอยู่กับปัจจัยด้านราคาน้ำมัน หรือสาเหตุอื่นๆ ที่เกี่ยวข้องกับต้นทุน'},
    {title:'5. ความลับของสัญญา', body:'ราคาโปรแกรมที่ได้แจ้งไว้ในสัญญาฉบับนี้เป็นเอกสารลับระหว่างคู่สัญญา · ไม่สามารถเปิดเผยราคาต่อบริษัทคู่ค้าอื่นๆได้'},
    {title:'6. การยอมรับสัญญา', body:'สัญญาฉบับนี้จะสามารถใช้ได้ขึ้นอยู่กับการตอบรับและตกลงในเงื่อนไขของสัญญา · กรุณาเซ็นและส่งสำเนากลับมาภายใน 15 วัน นับจากวันได้รับสัญญา'}
  ] : [
    {title:'1. Children Rates', body:'Children between 4-11 years old are charged a child rate as listed in the pricing tables above.'},
    {title:'2. Special Consideration', body:'Infants under 1 year old, elderly over 65 years old, and pets are not recommended to join excursions. Guests who have high blood pressure, heart disease, pregnant women, asthma, and bone/orthopedic disease are not allowed to join these excursions. In case of food allergy, please notify the company about the prior traveling date.'},
    {title:'3. Company Cancellation Refund', body:'The Company has the right to cancel the trip due to bad weather or other urgent reasons with 100% refund for the day trip only. In case of bookings less than minimum passengers, the company may cancel and refund the day-trip fare only.'},
    {title:'4. Pricing Adjustment', body:'Pricing agreement: prices are subject to change based on fuel price and other related expenses.'},
    {title:'5. Confidentiality', body:'The rates stated in this agreement are confidential and shall not be disclosed to any third parties.'},
    {title:'6. Acceptance', body:'The above contract rate is valid subject to your acknowledgement of acceptance. Kindly sign and return a duplicated copy of this offer within 15 days from the date of this offer.'}
  ];
}

/* §General Provisions · 3 clause ท้ายสัญญาที่ไม่มีในเอกสารเดิม (เทียบ Sawanu §9.3–9.5)
   เขียนเป็นข้อย่อยมีเลข 10.1–10.4 แบบสัญญาจริง · แน่นเป็นบล็อกเดียว ไม่กินหน้า */
function ctDocRenderGeneral(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const clause = (n, title, body) => `
    <div style="display:flex;gap:10px;padding:7px 0;border-top:1px solid #F2F0EA">
      <span style="flex:none;font-size:9.5px;font-weight:700;color:#A8773B;font-variant-numeric:tabular-nums;padding-top:1px;width:26px">${n}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:10.5px;font-weight:700;color:#0F1419;margin-bottom:2px">${title}</div>
        <div style="font-size:10px;color:#3F4654;line-height:1.6">${body}</div>
      </div>
    </div>`;
  return `
    ${clause('10.1', T('govLawT'),  T('govLawB'))}
    ${clause('10.2', T('entireT'),  T('entireB'))}
    ${clause('10.3', T('amendT'),   T('amendB'))}
    ${clause('10.4', T('weatherRefundT'),  T('weatherRefundB'))}
    ${clause('10.5', T('pricingAdjustT'),  T('pricingAdjustB'))}
    ${clause('10.6', T('confidentialityT'), T('confidentialityB'))}
    ${clause('10.7', T('acceptanceT'),     T('acceptanceB'))}
    <div style="border-top:1px solid #F2F0EA;padding-top:8px;margin-top:2px;font-size:10px;color:#3F4654;line-height:1.6;font-style:italic">${T('duplicateB')}</div>
  `;
}

function ctDocRenderCustom(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const clauses = (_ctDoc && _ctDoc.customClauses) || [];
  const inEdit = _ctDoc && _ctDoc.editMode;
  if(!clauses.length){
    return inEdit
      ? `<div style="display:flex;flex-direction:column;gap:8px">
          <button class="ct-doc-add-clause" onclick="ctDocAddClause()" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M12 5v14M5 12h14"/></svg>
            Add a custom clause
          </button>
          <button class="ct-doc-add-clause" onclick="ctDocFillStandardClauses()" type="button" style="border-style:solid;border-color:#185FA5;color:#185FA5;background:#F4F8FB">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            Fill with standard clauses (Children · Special · Cancellation refund · Pricing · Confidentiality · Acceptance)
          </button>
        </div>`
      : `<div style="padding:20px;background:#FAFAF6;border:1px dashed #C8C6BF;border-radius:4px;color:#9b9590;font-style:italic;text-align:center;font-size:11px">${T('customDefault')}</div>`;
  }
  const list = clauses.map((c, i) => {
    const esc = (s) => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if(inEdit){
      return `<div class="ct-doc-clause-card">
        <button class="ct-doc-clause-rm" onclick="ctDocRemoveClause('${c.id}')" type="button" title="Remove clause">✕</button>
        <div contenteditable="true" data-key="cl.${c.id}.title"
          class="ct-doc-edit"
          onblur="ctDocSetClauseField('${c.id}','title', this)"
          style="font-size:12.5px;font-weight:700;color:#0F1419;margin-bottom:6px;padding-right:24px">
          ${(i+1)}. ${esc(c.title)}
        </div>
        <div contenteditable="true" data-key="cl.${c.id}.body"
          class="ct-doc-edit"
          onblur="ctDocSetClauseField('${c.id}','body', this)"
          style="font-size:11px;color:#0F1419;line-height:1.7;white-space:pre-wrap">${esc(c.body)}</div>
      </div>`;
    }
    return `<div class="ct-doc-clause-card">
      <div style="font-size:12.5px;font-weight:700;color:#0F1419;margin-bottom:6px">${(i+1)}. ${esc(c.title)}</div>
      <div style="font-size:11px;color:#0F1419;line-height:1.7;white-space:pre-wrap">${esc(c.body)}</div>
    </div>`;
  }).join('');
  return list + (inEdit ? `
    <button class="ct-doc-add-clause" onclick="ctDocAddClause()" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M12 5v14M5 12h14"/></svg>
      Add another clause
    </button>` : '');
}

function ctDocRenderSignature(a, rt, lang, fmt){
  const T = (k)=>ctDocT(k, lang);
  const sig = a.agentSignatory || {};
  const sales = (typeof sbGetSales==='function') ? sbGetSales(a.sales) : null;
  const block = (titleParty, name, position, date, sigImg) => `
    <div style="background:#FAFAF6;border:1px solid #E0DED8;border-radius:4px;padding:18px 20px">
      <div style="font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:46px">${T('signedFor')} ${titleParty}</div>
      <div style="position:relative;border-bottom:1px solid #5F5E5A;height:40px;margin-bottom:8px">${sigImg?`<img src="${sigImg}" alt="signature" style="position:absolute;left:50%;bottom:2px;transform:translateX(-50%);max-height:74px;max-width:94%;object-fit:contain;mix-blend-mode:multiply"/>`:''}</div>
      <div style="font-size:9.5px;color:#7a7770;font-weight:700;letter-spacing:.05em;text-transform:uppercase">${T('signature_x')}</div>
      <div style="margin-top:16px"><div style="font-size:11px;color:#5F5E5A">${T('name')}</div><div style="font-size:13px;font-weight:600;color:#0F1419;margin-top:1px">${name||'—'}</div></div>
      <div style="margin-top:10px"><div style="font-size:11px;color:#5F5E5A">${T('position')}</div><div style="font-size:11.5px;color:#0F1419;margin-top:1px">${position||'—'}</div></div>
      <div style="margin-top:10px"><div style="font-size:11px;color:#5F5E5A">${T('date')}</div><div style="font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419;margin-top:1px">${date||'__ / __ / ____'}</div></div>
    </div>`;
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-top:8px">
      ${block('Love Andaman', sales?.fullName||sales?.name, sales?.designation, '', sales?.signature)}
      ${block(a.companyInfo?.legalName||a.name, sig.name, sig.designation, fmt(sig.signedDate), sig.signature)}
    </div>`;
}

function _ctDocSectionBody(sId, a, rt, lang, fmt){
  switch(sId){
    case 'cover':       return ctDocRenderCover(a, rt, lang, fmt);
    case 'parties':     return ctDocRenderParties(a, rt, lang, fmt);
    case 'eligibility': return ctDocRenderEligibility(a, rt, lang, fmt);
    case 'programs':    return ctDocRenderPrograms(a, rt, lang, fmt);
    case 'pricing':     return ctDocRenderPricing(a, rt, lang, fmt);
    case 'addons':      return ctDocRenderAddOns(a, rt, lang, fmt);
    case 'payment':     return ctDocRenderPayment(a, rt, lang, fmt);
    case 'booking':     return ctDocRenderBooking(a, rt, lang, fmt);
    case 'cancel':      return ctDocRenderCancel(a, rt, lang, fmt);
    case 'general':     return ctDocRenderGeneral(a, rt, lang, fmt);
    case 'custom':      return ctDocRenderCustom(a, rt, lang, fmt);
    case 'signature':   return ctDocRenderSignature(a, rt, lang, fmt);
  }
  return '';
}
