// rates.js · Rate Types
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

/* §rnZone2 · โซนราคาของ "เส้นทางหนึ่ง" · ตามท่าที่เรือออก
   ระนองออกจากท่าระนอง จะให้เลือกจุดรับภูเก็ต/เขาหลักไม่ได้อยู่แล้ว
   ส่วนเส้นภูเก็ต/เขาหลักก็ไม่ควรมีแถว RN ว่างโผล่มาทุกใบ
   existing = ก้อนเรตที่มีอยู่จริงของเส้นนั้น · โซนไหนมีข้อมูลแล้วต้องไม่หายไป
   แม้จะไม่ตรงกับท่า (เช่นสัญญาเก่าที่เคยคีย์ PK ไว้บนเส้นระนอง) */
function rtZonesForRoute(rId, existing){
  var r=(typeof getRoute==='function')?getRoute(rId):null;
  var pier=(r&&r.pier)||'';
  var out=(pier==='ranong') ? ['RN','NoTransfer'] : ['PK','KL','NoTransfer'];
  if(existing) Object.keys(existing).forEach(function(z){ if(out.indexOf(z)<0) out.push(z); });
  return out;
}

// Helper: lookup rate type by id
function getRateType(rtId){ return SB_RATE_TYPES.find(rt => rt.id === rtId); }
// Helper: which agents use a given rate type (read from agent.rateTypeId)
function getAgentsUsingRateType(rtId){ return SB_AGENTS.filter(a => a.rateTypeId === rtId); }

/* ══ §rtDupCode · โค้ดเรทซ้ำกัน ═══════════════════════════════════════════════
   ที่มา (2026-09-18) · ตรวจตามที่ถูกขอให้ดูว่า "สร้างเรทแล้วทับกันไหม"
   ตัวสร้างไม่ทับกัน (id มาจาก LA_UID + มีเกราะกันชนอีกชั้นใน rtSaveDraft)
   แต่เจอของจริงคาอยู่ · เรท 5 ชุดใช้โค้ด RT-NANA เหมือนกันหมด
   ทั้งห้าสร้างวันเดียวกัน (22 ก.ค. 2026) ตอนที่โค้ดยังพิมพ์เอง ก่อนจะเปลี่ยนเป็นสร้างอัตโนมัติ

   ทำไมต้องแก้ ทั้งที่ระบบคิดราคาด้วย id ไม่ใช่โค้ด
     1 นำเข้า Agent จาก Excel จับคู่เรท "ด้วยโค้ด" — โค้ดซ้ำ = ผูกผิดชุดแบบเงียบ ๆ
       และลำดับใน SB_RATE_TYPES มาจากลำดับแถวใน Postgres ซึ่งไม่การันตี
       ไฟล์เดิมนำเข้าคนละวันจึงได้คนละเรทได้ · ห้าชุดนั้นราคาต่างกันถึง 900 บาท/คน
     2 คนเลือกเรทจากลิสต์ที่โชว์โค้ด · เห็นโค้ดเดียวกันห้าแถวก็เลือกผิดเป็นธรรมดา
   ═══════════════════════════════════════════════════════════════════════════ */
function rtDupCodeScan(){
  var by = {};
  (typeof SB_RATE_TYPES!=='undefined'?SB_RATE_TYPES:[]).forEach(function(r){
    var c = String((r&&r.code)||'').trim().toUpperCase();
    if(!c) return;
    (by[c] = by[c] || []).push(r);
  });
  var out = [];
  Object.keys(by).forEach(function(c){ if(by[c].length > 1) out.push({code:c, list:by[c]}); });
  out.sort(function(a,b){ return b.list.length - a.list.length; });
  return out;
}
function _rtDupUsers(rtId){
  var A = (typeof SB_AGENTS!=='undefined')?SB_AGENTS:[];
  return A.filter(function(a){ return a && a.rateTypeId===rtId; }).length;
}
/* ตัวที่ "ได้เก็บโค้ดเดิมไว้" · เจ้าที่มีเอเย่นต์ผูกมากที่สุด แล้วค่อยดูว่าใครสร้างก่อน
   เหตุผล: โค้ดนั้นถูกพิมพ์ลงไฟล์นำเข้าและเอกสารไปแล้ว ตัวที่คนใช้กันมากที่สุดควรเป็นตัวที่ความหมายไม่เปลี่ยน */
function _rtDupKeeper(list){
  var best = list[0], bestN = _rtDupUsers(best.id);
  list.forEach(function(r){
    var n = _rtDupUsers(r.id);
    if(n > bestN || (n === bestN && String(r.createdDate||'') < String(best.createdDate||''))){ best = r; bestN = n; }
  });
  return best;
}
function rtDupCodeBanner(){
  var host = document.getElementById('rt-dupcode'); if(!host) return;
  var G = rtDupCodeScan();
  if(!G.length){ host.innerHTML=''; return; }
  var e = _rtExpE;
  var nRt = 0, nAg = 0;
  G.forEach(function(g){ nRt += g.list.length; g.list.forEach(function(r){ nAg += _rtDupUsers(r.id); }); });
  var rows = G.slice(0,6).map(function(g){
    var keep = _rtDupKeeper(g.list);
    return '<div style="border-top:1px solid #EEF0F3;padding:7px 0;font-size:11.5px;line-height:1.6">'
      +'<span class="mono" style="font-weight:800;color:#A32D2D">'+e(g.code)+'</span> '
      +'<span style="color:#6B7280">'+g.list.length+' ชุด · '
      + g.list.map(function(r){
          var n=_rtDupUsers(r.id);
          return '<b style="color:'+(r.id===keep.id?'#0F6E56':'#2C3440')+'">'+e(r.name||r.id)+'</b>'
            + (n?('<span style="color:#93A0AE"> ('+n+')</span>'):'');
        }).join(' · ')
      +'</span></div>';
  }).join('');
  host.innerHTML = '<div style="background:#fff;border:1px solid #E8A9A2;border-left:3px solid #A32D2D;'
    +'border-radius:11px;padding:12px 15px;margin:0 0 14px">'
    +'<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'
      +'<b style="font-size:13px;color:#A32D2D">&#9888; โค้ดเรทซ้ำกัน</b>'
      +'<span style="font-size:11.5px;color:#5A6270">'+G.length+' โค้ด · '+nRt+' ชุด · '+nAg+' เอเย่นต์ผูกอยู่</span>'
      +'<button onclick="rtDupCodeFix()" style="margin-left:auto;border:0;background:#0F172A;color:#fff;'
        +'border-radius:999px;padding:5px 14px;font:700 11px inherit;cursor:pointer;font-family:inherit;'
        +'white-space:nowrap">แก้โค้ดให้ไม่ซ้ำ</button>'
    +'</div>'
    +'<div style="font-size:11px;color:#6B7280;line-height:1.6;margin-top:3px">'
      +'ระบบคิดราคาด้วย id ราคาจึงไม่ได้ผิดอยู่ตอนนี้ · แต่<b>การนำเข้า Agent จาก Excel จับคู่เรทด้วยโค้ด</b> '
      +'โค้ดซ้ำ = ผูกผิดชุดแบบเงียบ ๆ และคนที่เลือกเรทจากลิสต์ก็แยกไม่ออก<br>'
      +'ปุ่มนี้แก้เฉพาะช่องโค้ด · ไม่แตะราคา ไม่แตะ id และไม่ย้ายเอเย่นต์ไปไหน '
      +'(ตัวที่มีเอเย่นต์ผูกมากที่สุดเก็บโค้ดเดิมไว้ · ชื่อสีเขียว)</div>'
    + rows
    + (G.length>6 ? ('<div style="font-size:11px;color:#8A929E;padding-top:6px">· และอีก '+(G.length-6)+' โค้ด</div>') : '')
    +'</div>';
}
function rtDupCodeFix(){
  if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return;
  var G = rtDupCodeScan(); if(!G.length) return;
  var plan = [];
  G.forEach(function(g){
    var keep = _rtDupKeeper(g.list);
    g.list.forEach(function(r){
      if(r.id === keep.id) return;
      /* ตั้งโค้ดใหม่ด้วยตัวสร้างเดิม · มันกันซ้ำกับทุกโค้ดที่มีอยู่ให้แล้ว
         ต้องเซ็ตลงตัวจริงทีละตัวก่อนคำนวณตัวถัดไป ไม่งั้นสองตัวในกลุ่มเดียวกันจะได้โค้ดใหม่ชนกันเอง */
      var old = r.code;
      r.code = _rtAutoCode(r.name || r.id, r.owner || '');
      plan.push({name:(r.name||r.id), from:old, to:r.code});
    });
  });
  if(!plan.length) return;
  if(typeof rtPersist==='function') rtPersist();
  if(typeof rtRenderList==='function') rtRenderList();
  if(typeof rtDupCodeBanner==='function') rtDupCodeBanner();
  if(_rtSelected && typeof rtRenderDetail==='function') rtRenderDetail(_rtSelected);
  try{ console.log('[rtDupCode] renamed ' + plan.length + ' code(s): '
    + plan.map(function(x){ return x.from + ' -> ' + x.to; }).join(', ')); }catch(_){}
  if(typeof flShowToast==='function') flShowToast('แก้โค้ดซ้ำแล้ว ' + plan.length + ' ชุด');
  else alert('Renamed ' + plan.length + ' duplicate rate-type code(s).');
}
function rtExpDaysTo(ymd){
  var T=(typeof TODAY_STR!=='undefined')?TODAY_STR:'';
  if(!ymd || !T) return null;
  var a=ymd.split('-'), b=T.split('-');
  if(a.length!==3 || b.length!==3) return null;
  var A=Date.UTC(+a[0],+a[1]-1,+a[2]), B=Date.UTC(+b[0],+b[1]-1,+b[2]);
  return Math.round((A-B)/86400000);
}
/* ตัวถัดไปที่ "มีคนเขียนไว้แล้ว" · สัญญาหลักของเอเย่นต์ระบุ Rate Type ไว้คนละตัวกับที่ผูกอยู่
   ระบบไม่เดาตัวถัดไปให้เอง · แค่หยิบสิ่งที่กรอกไว้แล้วมาวางตรงหน้า ให้คนตัดสิน */
function rtExpNextOf(agentId){
  if(!agentId || typeof SB_CONTRACTS==='undefined' || !Array.isArray(SB_CONTRACTS)) return '';
  for(var i=0;i<SB_CONTRACTS.length;i++){
    var c=SB_CONTRACTS[i];
    if(c && c.agentId===agentId && c.kind==='main'
       && c.status!=='void' && c.status!=='cancelled' && c.rateTypeId) return c.rateTypeId;
  }
  return '';
}
/* เอเย่นต์ที่ผูกอยู่กับเรทชุดนี้ · ผ่านขอบเขตของผู้ใช้เหมือนหน้า Agents (เซลล์เห็นเฉพาะของตัว) */
function rtExpAgentsOn(rtId){
  var A=(typeof SB_AGENTS!=='undefined')?SB_AGENTS:[];
  if(typeof laScopeAgents==='function') A=laScopeAgents(A.slice());
  return A.filter(function(a){ return a && a.rateTypeId===rtId; });
}
/* แถวเดียวของเรทหนึ่งชุด · null = ชุดนี้ไม่ต้องเตือน */
function rtExpRowFor(rt, within){
  if(!rt || rt.active===false) return null;
  var to=String(rt.validTo||''); if(!to) return null;      /* ไม่มีวันหมด = ไม่มีอะไรให้เตือน */
  var d=rtExpDaysTo(to); if(d===null || d>(within==null?_RT_EXP_WINDOW:within)) return null;
  var _after=laDayAfter(to);
  var ags=rtExpAgentsOn(rt.id).filter(function(a){
    /* §rtSeason · เจ้าที่ตั้งฤดูถัดไปไว้แล้ว ไม่ต้องอยู่ในแผงรวม · กติกาเดียวกับ rtExpForAgent
       ตัวนับบนแผงกับบรรทัดในหน้า Agent จึงพูดตรงกันเสมอ */
    return !laSeasonAt(a, _after);
  });
  if(!ags.length) return null;                             /* ไม่มีใครใช้ = ไม่ใช่เรื่องของใคร */
  var have=rt.seatRates||{}, blocked={}, next={};
  ags.forEach(function(a){
    /* โปรแกรมที่เอเย่นต์ขาย แต่เรทชุดนี้ไม่มีราคาให้ · พอถึงฤดู ปุ่มบันทึกจะถูกล็อก (noRate)
       เคสจริงคือสิมิลัน/สุรินทร์ — เรทฤดูต่ำไม่มีราคาเพราะอุทยานปิด พอเปิดฤดูจึงจองไม่ได้ */
    (a.programs||[]).forEach(function(p){ if(p && !have[p]) blocked[p]=(blocked[p]||0)+1; });
    var nx=rtExpNextOf(a.id);
    if(nx && nx!==rt.id) next[nx]=(next[nx]||0)+1;
  });
  return { rt:rt, to:to, days:d, agents:ags, blocked:blocked, next:next };
}
function rtExpScan(within){
  var out=[];
  (typeof SB_RATE_TYPES!=='undefined'?SB_RATE_TYPES:[]).forEach(function(rt){
    var r=rtExpRowFor(rt, within); if(r) out.push(r);
  });
  out.sort(function(a,b){ return a.days-b.days || String(a.rt.name||'').localeCompare(String(b.rt.name||'')); });
  return out;
}
/* ของเอเย่นต์รายเดียว · ใช้ในแถบ Source ของ Pricing Matrix */
function rtExpForAgent(a){
  if(!a || !a.rateTypeId) return null;
  var rt=(typeof getRateType==='function')?getRateType(a.rateTypeId):null; if(!rt) return null;
  var to=String(rt.validTo||''); if(!to) return null;
  /* §rtSeason · คำถามของแผงคือ "พ้นวันหมดแล้วใช้เรทไหน" · ตอบแล้วก็ไม่ต้องเตือน
     เกณฑ์ที่ถูกคือ "มีช่วงไหนคลุมวันถัดจากวันหมดหรือเปล่า" ไม่ใช่ "มีช่วงที่เริ่มหลังวันหมด"
     เพราะของจริงมีเคสที่ช่วงใหม่เริ่มวันเดียวกับวันหมดพอดี (เรทเก่าหมด 15 ต.ค. ใหม่เริ่ม 15 ต.ค.)
     ใช้เกณฑ์เดิมแบบ > จะตกหล่นทั้งกลุ่มนั้น แล้วแผงจะยังเตือนทั้งที่ตั้งให้ไปแล้ว */
  if(laSeasonAt(a, laDayAfter(to))) return null;
  var d=rtExpDaysTo(to); if(d===null || d>_RT_EXP_WINDOW) return null;
  var have=rt.seatRates||{}, blocked=[];
  (a.programs||[]).forEach(function(p){ if(p && !have[p]) blocked.push(p); });
  var nx=rtExpNextOf(a.id);
  return { rt:rt, to:to, days:d, blocked:blocked, next:(nx&&nx!==rt.id)?nx:'' };
}
function _rtExpE(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function _rtExpDate(y){ return (typeof _rtFmtDate==='function') ? (_rtFmtDate(y)||y) : y; }
/* ป้ายบอกเวลา · "หมดแล้ว" กับ "อีก 27 วัน" ต้องอ่านออกจากระยะไกล สีจึงไล่ตามความใกล้ */
function rtExpTone(d){
  if(d<0)  return {bg:'#FCEBEB', bd:'#E8A9A2', fg:'#A32D2D', t:'หมดแล้ว '+Math.abs(d)+' วัน'};
  if(d<=30) return {bg:'#FDEEDD', bd:'#E9B583', fg:'#9A5410', t:'อีก '+d+' วัน'};
  return      {bg:'#FEF6E7', bd:'#EFD9AE', fg:'#8A5A00', t:'อีก '+d+' วัน'};
}
function rtExpRouteName(rid){
  var r=(typeof getRoute==='function')?getRoute(rid):null;
  return (r&&r.name)||rid;
}
/* ผู้เข้าข่ายของเรทชุดหนึ่ง · จัดกลุ่มตามเรทตัวถัดไป เพราะวันแบ่งของแต่ละกลุ่มไม่เท่ากัน */
function rtExpBulkPlan(rtId){
  var rt = (typeof getRateType === 'function') ? getRateType(rtId) : null;
  if(!rt) return null;
  var groups = {}, order = [], skipHas = 0, skipNo = 0, skipOff = 0, skipPast = 0;
  rtExpAgentsOn(rtId).forEach(function(a){
    if(laSeasonsOf(a).length){ skipHas++; return; }      /* ตั้งเองไว้แล้ว ไม่ไปทับของใคร */
    var nx = rtExpNextOf(a.id);
    if(!nx || nx === rtId){ skipNo++; return; }           /* สัญญาไม่ได้ระบุตัวถัดไป · ไม่เดาให้ */
    var nrt = (typeof getRateType === 'function') ? getRateType(nx) : null;
    if(!nrt){ skipNo++; return; }
    if(nrt.active === false){ skipOff++; return; }          /* เรทที่ปิดไปแล้ว ไม่เอามาเป็นตัวถัดไป */
    /* §rtExpSplit · วันแบ่งต้องมาจากข้อมูลที่สมเหตุสมผล ไม่ใช่หยิบ validFrom มาดื้อ ๆ
       ของจริงมีเรทที่ validFrom ย้อนหลังไปก่อนวันที่เรทเก่าหมด (เจอ 16 พ.ค. ทั้งที่เรทเก่าหมด 14 ต.ค.)
       หยิบมาตรง ๆ = ตารางจะสั่งให้เรทใหม่มีผลตั้งแต่พฤษภา คือ "ราคาวันนี้ขยับทันที"
       ซึ่งขัดกับสิ่งที่กล่องนี้สัญญาไว้ว่าก่อนวันแบ่งไม่ขยับสักบาท
       กติกา · ใช้ validFrom ของตัวใหม่ก็ต่อเมื่อมันไม่ย้อนไปก่อนวันที่ตัวเก่าหมด
              ไม่งั้นถอยไปใช้ "วันถัดจากวันที่ตัวเก่าหมด" ซึ่งต่อกันพอดีเสมอ */
    var vf = String(nrt.validFrom || ''), vt = String(rt.validTo || '');
    var split = (vf && (!vt || vf >= vt)) ? vf : _rtExpDayAfter(vt);
    if(!split){ skipNo++; return; }                        /* ไม่รู้ว่าจะแบ่งวันไหน ก็ไม่ตั้ง */
    /* วันแบ่งที่อยู่ในอดีต = กดแล้วราคาวันนี้เปลี่ยนทันที · ตัวนี้ไม่ได้มีไว้ทำแบบนั้น */
    if(TODAY_STR && split <= TODAY_STR){ skipPast++; return; }
    var k = nx + '|' + split;
    if(!groups[k]){ groups[k] = { next:nx, nextRt:nrt, split:split, ags:[] }; order.push(k); }
    groups[k].ags.push(a);
  });
  order.sort(function(x,y){ return groups[y].ags.length - groups[x].ags.length; });
  return { rt:rt, groups:order.map(function(k){ return groups[k]; }),
           skipHas:skipHas, skipNo:skipNo, skipOff:skipOff, skipPast:skipPast,
           total:order.reduce(function(n,k){ return n + groups[k].ags.length; }, 0) };
}
/* เหตุผลที่ข้าม · บอกให้ครบ ไม่งั้นคนเห็นตัวเลขไม่ตรงแล้วไม่รู้ว่าหายไปไหน */
function _rtExpSkipTxt(P, sep){
  return [ P.skipHas  ? ('<b>'+P.skipHas+'</b> เจ้าตั้งตารางเองไว้แล้ว · ระบบไม่ไปทับ') : '',
           P.skipNo   ? ('<b>'+P.skipNo+'</b> เจ้าไม่ได้ระบุเรทตัวถัดไปในสัญญา') : '',
           P.skipOff  ? ('<b>'+P.skipOff+'</b> เจ้าชี้ไปเรทที่ปิดใช้งานแล้ว') : '',
           P.skipPast ? ('<b>'+P.skipPast+'</b> เจ้าได้วันแบ่งที่เป็นอดีต · ตั้งให้จะทำให้ราคาวันนี้ขยับ') : ''
         ].filter(Boolean).join(sep);
}
function _rtExpDayAfter(ymd){
  return (typeof laDayAfter === 'function') ? laDayAfter(ymd) : '';
}
function _rtExpDayBefore(ymd){
  var p = String(ymd||'').split('-'); if(p.length !== 3) return '';
  var d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0,10);
}
function rtExpBulkOpen(rtId){
  if(typeof laGuardEdit === 'function' && !laGuardEdit('sales')) return;
  _rtExpBulkRt = rtId;
  var P = rtExpBulkPlan(rtId); if(!P) return;
  var e = _rtExpE, rt = P.rt;
  var h = '<div style="padding:16px 18px;border-bottom:1px solid #EEF0F3">'
    +'<div style="font-size:15px;font-weight:800;color:#1F2937">ตั้งตารางฤดูกาลให้ทั้งกลุ่ม</div>'
    +'<div style="font-size:11.5px;color:#6B7280;margin-top:3px">'
      + e(rt.name || rt.id) + ' · หมด ' + e(_rtExpDate(rt.validTo || '')) + '</div></div>'
    +'<div style="padding:14px 18px">';
  if(!P.total){
    h += '<div style="font-size:12px;color:#6B7280;line-height:1.7">ไม่มีเจ้าไหนตั้งให้อัตโนมัติได้<br>'
      + _rtExpSkipTxt(P, '<br>')
      + '</div>';
  } else {
    h += '<div style="background:#F1F8F5;border:1px solid #BEE0D2;border-radius:9px;padding:9px 12px;'
      +'font-size:11.5px;color:#0F6E56;line-height:1.65;margin-bottom:12px">'
      +'<b>ราคาก่อนวันแบ่งไม่ขยับสักบาท</b> — ตารางฤดูกาลเปลี่ยนเฉพาะทริปที่<b>เดินทาง</b>ตั้งแต่วันแบ่งเป็นต้นไป<br>'
      +'<span style="color:#4E7F6C">กดวันนี้ได้เลย ไม่ต้องรอไปกดวันที่เรทหมด</span></div>';
    P.groups.forEach(function(g){
      var names = g.ags.slice(0, 14).map(function(a){ return e(a.code || a.name || a.id); }).join(' · ');
      h += '<div style="border:1px solid #E7EAEF;border-radius:9px;padding:10px 12px;margin-bottom:8px">'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px">'
          +'<b style="color:#2C3440">' + g.ags.length + ' เอเย่นต์</b>'
          +'<span style="color:#9AA3AE">→</span>'
          +'<b style="color:#0F6E56">' + e(g.nextRt.name || g.next) + '</b>'
          +'<span style="margin-left:auto;font-size:11px;color:#6B7280;font-variant-numeric:tabular-nums">'
            +'แบ่งวันที่ <b>' + e(_rtExpDate(g.split)) + '</b></span></div>'
        +'<div style="font-size:10.5px;color:#8A929E;margin-top:5px;line-height:1.6">'
          + e(rt.name || '') + ' ถึง ' + e(_rtExpDate(_rtExpDayBefore(g.split)))
          + ' · แล้วเปลี่ยนเป็น ' + e(g.nextRt.name || '') + ' ตั้งแต่ ' + e(_rtExpDate(g.split)) + ' ไม่มีวันสิ้นสุด</div>'
        +'<div style="font-size:10.5px;color:#6B7280;margin-top:5px;line-height:1.6">' + names
          + (g.ags.length > 14 ? (' · และอีก ' + (g.ags.length - 14)) : '') + '</div>'
      +'</div>';
    });
    var _sk = _rtExpSkipTxt(P, ' · ');
    if(_sk){
      h += '<div style="font-size:11px;color:#8A5A00;background:#FEF6E7;border:1px solid #EFD9AE;'
        +'border-radius:8px;padding:7px 11px;line-height:1.6">ข้ามไป — ' + _sk + '</div>';
    }
  }
  h += '</div><div style="padding:12px 18px;border-top:1px solid #EEF0F3;display:flex;gap:8px;justify-content:flex-end">'
    +'<button onclick="acctModalClose()" style="border:1px solid #D6DCE5;background:#fff;color:#5A6270;'
      +'border-radius:8px;padding:7px 15px;font:600 11.5px inherit;cursor:pointer;font-family:inherit">ปิด</button>'
    + (P.total ? ('<button onclick="rtExpBulkApply()" style="border:0;background:#0F172A;color:#fff;'
      +'border-radius:8px;padding:7px 17px;font:700 11.5px inherit;cursor:pointer;font-family:inherit">'
      +'ตั้งให้ ' + P.total + ' เอเย่นต์</button>') : '')
    +'</div>';
  acctModal(h);
}
function rtExpBulkApply(){
  if(typeof laGuardEdit === 'function' && !laGuardEdit('sales')) return;
  var P = rtExpBulkPlan(_rtExpBulkRt); if(!P || !P.total) return;
  var rt = P.rt, n = 0;
  var who = (typeof window !== 'undefined' && window._rmUser) ? window._rmUser : '';
  var at = new Date().toISOString();
  P.groups.forEach(function(g){
    var endOld = _rtExpDayBefore(g.split);
    g.ags.forEach(function(a){
      if(laSeasonsOf(a).length) return;                  /* เผื่อมีคนตั้งไประหว่างเปิดกล่องค้างไว้ */
      var seasons = [];
      /* ช่วงแรกใส่ก็ต่อเมื่อรู้วันเริ่มของเรทเดิม · ไม่รู้ก็ไม่ต้องใส่
         เพราะวันก่อนช่วงแรกถอยไปใช้ a.rateTypeId ซึ่งคือเรทเดิมอยู่แล้ว ผลเท่ากันเป๊ะ */
      if(rt.validFrom && endOld && rt.validFrom <= endOld)
        seasons.push({ rt: rt.id, from: String(rt.validFrom), to: endOld });
      seasons.push({ rt: g.next, from: g.split, to: '' });
      a.rateSeasons = seasons;
      /* เขียน activity เองแล้วค่อยเซฟทีเดียวตอนจบ · agLog เซฟทุกครั้งที่เรียก
         76 เจ้า = เขียน blob ทั้งก้อน 76 รอบ ซึ่งช้าจนหน้าค้าง */
      if(!Array.isArray(a.activity)) a.activity = [];
      a.activity.push({ at:at, by:who, kind:'rate',
        text:'ตั้งตารางฤดูกาลแบบกลุ่ม · ' + (rt.name || rt.id) + ' ถึง ' + endOld
           + ' → ' + ((g.nextRt && g.nextRt.name) || g.next) + ' ตั้งแต่ ' + g.split });
      if(a.activity.length > 200) a.activity = a.activity.slice(-200);
      n++;
    });
  });
  if(typeof sbAgentsPersist === 'function') sbAgentsPersist();
  acctModalClose();
  if(typeof rtExpRender === 'function') rtExpRender();
  if(typeof flShowToast === 'function') flShowToast('ตั้งตารางฤดูกาลให้ ' + n + ' เอเย่นต์แล้ว');
  else console.log('[rtExpBulk] set seasons for ' + n + ' agents');
}

/* แผงบนหน้า Rate Types · ไม่มีอะไรจะเตือน = ไม่วาดเลย ไม่ใช่วาดกล่องว่าง */
/* §rtAdmin · หน้า Rate Types มีหน้าที่ทำเรท · แผงเตือน 11 ชุด 202 เอเย่นต์ ดันรายการเรทตกจอไปเลย
   ย้ายแผงเต็มไปหน้า Rate Type Management แล้วเหลือบรรทัดเดียวไว้ตรงนี้ · เห็นว่ามีเรื่อง แล้วกดไปดู */
function rtExpBanner(){
  var host=document.getElementById('rt-expiry'); if(!host) return;
  var rows=rtExpScan();
  if(!rows.length){ host.innerHTML=''; return; }
  var nAg=0; rows.forEach(function(r){ nAg+=r.agents.length; });
  var tn=rtExpTone(rows[0].days);
  var nBulk=0;
  rows.forEach(function(r){ try{ var p=rtExpBulkPlan(r.rt.id); if(p) nBulk+=p.total; }catch(_){} });
  host.innerHTML='<div onclick="rtAdminGo()" style="background:'+tn.bg+';border:1px solid '+tn.bd
    +';border-left:3px solid '+tn.fg+';border-radius:10px;padding:8px 13px;margin:0 0 12px;cursor:pointer;'
    +'display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:11.5px;color:#4A5360">'
    +'<b style="color:'+tn.fg+'">&#9888; เรทกำลังจะหมดอายุ</b>'
    +'<span>'+rows.length+' ชุด · '+nAg+' เอเย่นต์ · ชุดที่ใกล้ที่สุด'+_rtExpE(tn.t)+'</span>'
    +(nBulk?('<span style="background:#E3F3EC;border:1px solid #BEE0D2;color:#0F6E56;border-radius:999px;'
      +'padding:2px 9px;font-size:10px;font-weight:800">ตั้งตารางให้ได้ทันที '+nBulk+' เจ้า</span>'):'')
    +'<span style="margin-left:auto;color:#5A6270;font-weight:600;text-decoration:underline">'
    +'เปิดภาพรวม Rate Expiry</span></div>';
}
function rtAdminGo(){
  var el=document.querySelector('.nav-item[data-view="rate-admin"]');
  if(el && typeof nav==='function') nav(el);
}
function rtExpRender(hostId){
  var host=document.getElementById(hostId||'rt-expiry'); if(!host) return;
  var rows=rtExpScan();
  if(!rows.length){
    host.innerHTML='<div style="background:#F1F8F5;border:1px solid #BEE0D2;border-radius:11px;'
      +'padding:12px 15px;font-size:12px;color:#0F6E56">&#10003; ไม่มีเรทชุดไหนกำลังจะหมดอายุในช่วง 60 วันข้างหน้า</div>';
    return;
  }
  var nAg=0; rows.forEach(function(r){ nAg+=r.agents.length; });
  var soon=rows[0].days;
  var head=rtExpTone(soon);
  var h='<div style="background:#fff;border:1px solid '+head.bd+';border-left:3px solid '+head.fg
    +';border-radius:11px;padding:12px 15px;margin:0 0 14px">'
    +'<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:3px">'
      +'<span style="font-size:13px;font-weight:800;color:'+head.fg+'">&#9888; เรทที่กำลังจะหมดอายุ</span>'
      +'<span style="font-size:11.5px;color:#5A6270">'+rows.length+' ชุด · '+nAg+' เอเย่นต์</span>'
    +'</div>'
    +'<div style="font-size:11px;color:#6B7280;line-height:1.6;margin-bottom:10px">'
      +'วันหมดอายุ<b>ไม่ได้กั้นการคิดเงิน</b> — พ้นวันนี้ไปแล้วระบบยังคิดราคาชุดเดิมต่อ ไม่มีอะไรเตือนตอนจอง<br>'
      +'ชุดที่มีโปรแกรมขึ้น <b style="color:#A32D2D">จองไม่ได้</b> คือชุดที่ไม่มีราคาของโปรแกรมนั้นเลย · ปุ่มบันทึกจะถูกล็อกตั้งแต่วันแรกของฤดู'
    +'</div>';
  rows.forEach(function(r){
    var tn=rtExpTone(r.days);
    var bk=Object.keys(r.blocked);
    var nx=Object.keys(r.next).sort(function(a,b){ return r.next[b]-r.next[a]; });
    h+='<div onclick="rtSelectCard(\''+_rtExpE(r.rt.id)+'\')" style="border-top:1px solid #EEF0F3;padding:9px 0;cursor:pointer">'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +'<span style="background:'+tn.bg+';border:1px solid '+tn.bd+';color:'+tn.fg
          +';font-size:10px;font-weight:800;border-radius:999px;padding:2px 9px;white-space:nowrap">'+tn.t+'</span>'
        +'<b style="font-size:12.5px;color:#2C3440">'+_rtExpE(r.rt.name||r.rt.code||r.rt.id)+'</b>'
        +'<span style="font-size:10px;color:#93A0AE;font-variant-numeric:tabular-nums">'+_rtExpE(r.rt.code||'')
          +' · หมด '+_rtExpE(_rtExpDate(r.to))+'</span>'
        +'<span style="margin-left:auto;font-size:11px;font-weight:700;color:#3C4553;white-space:nowrap">'
          +r.agents.length+' เอเย่นต์</span>'
      +'</div>';
    if(bk.length){
      h+='<div style="font-size:11px;color:#A32D2D;margin-top:4px;line-height:1.55">จองไม่ได้ — '
        + bk.slice(0,4).map(function(p){ return '<b>'+_rtExpE(rtExpRouteName(p))+'</b> ('+r.blocked[p]+' เจ้า)'; }).join(' · ')
        + (bk.length>4?(' · และอีก '+(bk.length-4)):'')
        +'</div>';
    }
    if(nx.length){
      /* §rtExpBulk · รู้ครบทั้งเรทเก่า เรทใหม่ และวันแบ่ง → ตั้งให้ทั้งกลุ่มได้เลย
         ปุ่มอยู่ตรงนี้เพราะมันคือการกระทำต่อจากข้อมูลบรรทัดนี้พอดี ไม่ต้องไปหาที่อื่น */
      var _nBulk=0;
      try{ var _p=rtExpBulkPlan(r.rt.id); _nBulk=_p?_p.total:0; }catch(_){}
      h+='<div style="font-size:11px;color:#0F6E56;margin-top:3px;line-height:1.55;'
        +'display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span>สัญญาระบุตัวถัดไปไว้แล้ว — '
        + nx.slice(0,2).map(function(id){
            var t=(typeof getRateType==='function')?getRateType(id):null;
            return '<b>'+_rtExpE((t&&(t.name||t.code))||id)+'</b> ('+r.next[id]+' เจ้า)'; }).join(' · ')
        + '</span>'
        + (_nBulk
            ? ('<button onclick="event.stopPropagation();rtExpBulkOpen(\''+_rtExpE(r.rt.id)+'\')" '
              +'style="border:1px solid #BEE0D2;background:#F1F8F5;color:#0F6E56;border-radius:7px;'
              +'padding:3px 11px;font:700 10.5px inherit;cursor:pointer;font-family:inherit;white-space:nowrap">'
              +'ตั้งตารางฤดูกาลให้ '+_nBulk+' เจ้า</button>')
            : '<span style="color:#8A929E">· ยังไม่ได้ผูกให้ ต้องเปลี่ยนเอง</span>')
        +'</div>';
    }
    h+='</div>';
  });
  h+='</div>';
  host.innerHTML=h;
}
function rtSeasonName(id){
  var t=(typeof getRateType==='function')?getRateType(id):null;
  return t ? (t.name||t.code||id) : '(ไม่พบชุดราคานี้)';
}
/* วันก่อนหน้าหนึ่งวัน · ใช้ตอนปิดช่วงให้ชนกับวันเริ่มของช่วงถัดไป */
function _rtSeasonPrev(ymd){
  var p=String(ymd||'').split('-'); if(p.length!==3) return '';
  var d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); d.setUTCDate(d.getUTCDate()-1);
  return d.toISOString().slice(0,10);
}

/* §rtTab · บรรทัดชี้ทางในหน้า Pricing Matrix · บอกแค่พอให้รู้ว่ามีเรื่อง แล้วกดไปจัดการที่แท็บ
   ตั้งใจให้เป็นบรรทัดเดียวเสมอ ไม่ว่าจะมีเรื่องหรือไม่ · ตารางราคาคือพระเอกของหน้านี้ */
function rtMatrixHint(a){
  if(!a) return '';
  var e = _rsE, T = (typeof TODAY_STR !== 'undefined') ? TODAY_STR : '';
  var X = (typeof rtExpForAgent === 'function') ? rtExpForAgent(a) : null;
  var S = laSeasonsOf(a), cur = laSeasonAt(a, T);
  var go = 'onclick="agSwitchTab(\'ratemgmt\',\''+e(a.id)+'\')"';
  var bg = '#F7F8FA', bd = '#E7EAEF', mid;
  if(X){
    var tn = rtExpTone(X.days); bg = tn.bg; bd = tn.bd;
    mid = '<b style="color:'+tn.fg+'">&#9888; เรทที่ใช้อยู่หมด '+e(_rsDate(X.to))+'</b>'
        + '<span style="color:#8A929E">· '+e(tn.t)+' · ยังไม่ได้ตั้งตารางฤดูกาลรับ</span>';
  } else if(S.length){
    mid = '<b style="color:#2C3440">ตารางฤดูกาล '+S.length+' ช่วง</b>'
        + '<span style="color:#6B7280">· ตอนนี้ใช้ <b>'+e(cur?rtSeasonName(cur.rt):rtSeasonName(a.rateTypeId))+'</b></span>';
  } else {
    mid = '<span style="color:#6B7280">ใช้ชุดราคาเดียวตลอดทั้งปี · ยังไม่ได้ตั้งตารางฤดูกาล</span>';
  }
  return '<div '+go+' style="background:'+bg+';border:1px solid '+bd+';border-radius:9px;padding:7px 12px;'
    +'margin:0 0 12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:11.5px;'
    +'color:#4A5360;cursor:pointer">'+mid
    +'<span style="margin-left:auto;color:#5A6270;font-weight:600;text-decoration:underline;white-space:nowrap">'
    +'จัดการที่แท็บ Rate Type</span></div>';
}

function rtSelectCard(rtId){
  _rtSelected = rtId;
  rtRenderList();
  if(rtId){
    rtRenderDetail(rtId);
    if(_rtViewMode === 'agents') rtRenderAgentColumn(rtId);
  } else {
    const det = document.getElementById('rt-detail');
    if(det) det.innerHTML = '<div class="sb-empty">เลือก Rate Type จากเมนูด้านซ้ายเพื่อดูรายละเอียดและราคา</div>';
    const col3 = document.getElementById('rt-agents-col');
    if(col3) col3.innerHTML = '';
  }
}

function rtSetViewMode(mode){
  if(mode !== 'detail' && mode !== 'agents') return;
  _rtViewMode = mode;
  rtApplyViewMode();
  if(_rtSelected){
    rtRenderDetail(_rtSelected);     // re-render detail so agent strip in header reflects mode
    if(mode === 'agents') rtRenderAgentColumn(_rtSelected);
  }
}

function rtApplyViewMode(){
  const wrap  = document.getElementById('rt-wrap');
  const col3  = document.getElementById('rt-agents-col');
  const btnD  = document.getElementById('rt-vm-detail');
  const btnA  = document.getElementById('rt-vm-agents');
  if(!wrap) return;
  if(_rtViewMode === 'agents'){
    wrap.classList.add('three-col');
    if(col3) col3.style.display = '';
  } else {
    wrap.classList.remove('three-col');
    if(col3) col3.style.display = 'none';
  }
  // Toggle pill states
  if(btnD && btnA){
    const on  = {background:'#eeece6', color:'var(--fd-ink)',     fontWeight:'700'};
    const off = {background:'transparent', color:'var(--fd-ink-soft)', fontWeight:'600'};
    const apply = (btn, s) => { btn.style.background = s.background; btn.style.color = s.color; btn.style.fontWeight = s.fontWeight; };
    apply(btnD, _rtViewMode === 'detail' ? on : off);
    apply(btnA, _rtViewMode === 'agents' ? on : off);
  }
}

function rtSetAgentMktFilter(mkt){
  _rtAgentMktFilter = mkt;
  if(_rtSelected) rtRenderAgentColumn(_rtSelected);
}

function rtRenderAgentColumn(rtId){
  const rt = getRateType(rtId);
  const col = document.getElementById('rt-agents-col');
  if(!col) return;
  if(!rt){ col.innerHTML = ''; return; }

  const usingAgents = (SB_AGENTS||[]).filter(a => a.rateTypeId === rt.id);

  // Build market filter pills from agents actually bound here
  const mktMap = {};
  usingAgents.forEach(a => {
    const m = (typeof sbGetMarket === 'function') ? sbGetMarket(a.market) : null;
    const key = a.market || 'na';
    if(!mktMap[key]) mktMap[key] = { id:key, name:(m?.name||a.market||'N/A'), color:(m?.color||'#7a8fa3'), n:0 };
    mktMap[key].n++;
  });
  const mktKeys = Object.keys(mktMap);
  const pills = [
    `<button class="rt-mkt-pill ${_rtAgentMktFilter==='all'?'on':''}" onclick="rtSetAgentMktFilter('all')">All · ${usingAgents.length}</button>`,
    ...mktKeys.map(k => `<button class="rt-mkt-pill ${_rtAgentMktFilter===k?'on':''}" onclick="rtSetAgentMktFilter('${k}')">${mktMap[k].name.split(' ')[0]} · ${mktMap[k].n}</button>`)
  ].join('');

  // Filter for current pill selection
  const filtered = _rtAgentMktFilter === 'all'
    ? usingAgents
    : usingAgents.filter(a => (a.market||'na') === _rtAgentMktFilter);

  // Aggregated stats (simple: agents count, total programs, credit sum)
  const totalPrograms = usingAgents.reduce((s,a)=> s + ((a.programs||[]).length||(a.programPeriods||[]).length||0), 0);
  const totalCredit   = usingAgents.reduce((s,a)=> s + (a.creditLimit||0), 0);
  const fmtMoney = (n) => n >= 1000 ? (n/1000).toFixed(0)+'K' : String(n);

  // Agent cards
  const cards = filtered.length
    ? filtered.map(a => {
        const mkt   = (typeof sbGetMarket === 'function') ? sbGetMarket(a.market) : null;
        const sales = (typeof sbGetSales  === 'function') ? sbGetSales(a.sales)   : null;
        const mktColor = mkt?.color || '#7a8fa3';
        const nameParts = (a.name||'').replace(/[()]/g,'').split(/\s+/).filter(Boolean);
        const initials = (nameParts.length>=2 ? (nameParts[0][0]+nameParts[1][0]) : (a.name||'').slice(0,2)).toUpperCase();
        const nProg = (a.programs||[]).length || (a.programPeriods||[]).length || 0;
        const credit = a.creditLimit ? `credit ${fmtMoney(a.creditLimit)}${a.creditDays?` · ${a.creditDays}d`:''}` : (a.payType||'-');
        return `
          <div class="rt-ag-card" onclick="agSelectFromRtCol('${a.id}', event)">
            <span class="rt-ag-dot" style="background:${mktColor}">${initials}</span>
            <div class="rt-ag-body">
              <div class="rt-ag-name">${a.name}</div>
              <div class="rt-ag-meta" style="color:${mktColor}">${a.code} · ${a.sub||mkt?.name||''}</div>
              <div class="rt-ag-sub">${nProg} program${nProg!==1?'s':''} · ${credit}${sales?` · sales ${sales.code}`:''}</div>
            </div>
            <button class="rt-ag-x" onclick="rtUnbindAgent('${a.id}','${rt.id}', event)" title="ปลด agent ออกจาก rate type นี้">✕</button>
          </div>
        `;
      }).join('')
    : '<div class="sb-empty" style="padding:40px 12px;color:var(--fd-ink-soft);font-size:11.5px;text-align:center">ยังไม่มี agent ผูกกับ rate type นี้</div>';

  col.innerHTML = `
    <div class="sb-third-hd">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="sb-third-hd-ttl">Agents on this Rate <span style="background:${rt.color}1A;color:${rt.color};padding:1px 7px;border-radius:8px;font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums">${usingAgents.length}</span></div>
      </div>
      <div style="font-size:10.5px;color:var(--fd-ink-soft);margin-top:4px;line-height:1.4">${rt.name} · click row to open in Agent List</div>
      <button onclick="rtOpenAgentPicker('${rt.id}')" style="margin-top:10px;width:100%;background:#fff;border:1.4px solid ${rt.color};color:${rt.color};font-family:inherit;font-size:11px;font-weight:600;padding:7px 11px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Manage agents (add / remove)
      </button>
      ${mktKeys.length ? `<div class="rt-mkt-pills">${pills}</div>` : ''}
    </div>
    <div class="sb-third-body">${cards}</div>
    <div class="rt-agg-grid">
      <div class="rt-agg-card"><div class="rt-agg-lbl">Agents</div><div class="rt-agg-val">${usingAgents.length}</div></div>
      <div class="rt-agg-card"><div class="rt-agg-lbl">Programs</div><div class="rt-agg-val" style="color:${rt.color}">${totalPrograms}</div></div>
      <div class="rt-agg-card"><div class="rt-agg-lbl">Credit Σ</div><div class="rt-agg-val">${totalCredit>0?'฿'+fmtMoney(totalCredit):'—'}</div></div>
    </div>
  `;
}

function _rtFmtDate(s){
  if(!s) return '';
  const d = new Date(s); if(isNaN(d)) return s;
  const MON_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${MON_EN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
function _rtValidityStatus(rt){
  if(!rt.validFrom && !rt.validTo) return {label:'Always', state:'always'};
  const today = new Date(); today.setHours(0,0,0,0);
  const from = rt.validFrom ? new Date(rt.validFrom) : null;
  const to   = rt.validTo   ? new Date(rt.validTo)   : null;
  if(from && today < from) return {label:'Upcoming', state:'upcoming'};
  if(to && today > to)     return {label:'Expired',  state:'expired'};
  // Check expiring soon (within 30 days)
  if(to){
    const days = Math.floor((to - today)/86400000);
    if(days <= 30) return {label:'Expiring · '+days+'d', state:'expiring'};
  }
  return {label:'Active', state:'active'};
}

function rtToggleActive(rtId, ev){
  if(ev){ ev.stopPropagation(); }
  const rt = getRateType(rtId);
  if(!rt) return;
  rt.active = !(rt.active !== false);  // default true → false; explicit false → true
  rtPersist();
  rtRenderCards();
  if(rt.id === _rtSelected) rtRenderDetail(rt.id);
}

// Back-compat shim — old call sites that still reference rtRenderCards()
function rtRenderCards(){ rtRenderList(); }

// ── §Rate Type ownership (2026-07-22) · เจ้าของ = เซลล์ · '' = Shared/กลาง (เห็นทุกคน) ──
// One-time seed of existing rate-type owners (เดาจากชื่อ/โค้ด + ยืนยันโดยผู้ใช้ · Andaman Sunday Special→IRIS).
// Idempotent: sets owner ONLY when still undefined → won't overwrite anything admin re-assigns later.
// Shared rates are left undefined (= Shared). Keyed by prod rate-type id (no-op on other datasets).
// Robust: runs on every Rate Types open (no one-time runtime flag that a cloud-reload could defeat).
// Applies owner ONLY when owner is undefined/null (== null) → an admin's explicit Shared ('') is respected,
// and once every mapped rate has an owner this is a no-op (idempotent · won't re-persist).
function _rtBackfillOwners(){
  if(!Array.isArray(SB_RATE_TYPES) || !SB_RATE_TYPES.length) return;   // wait until loaded
  const MAP={"rt084718":"s05","rt001":"s05","rt819994":"s03","rt970110":"s03","rt579424":"s02","rt802558":"s02","rt701437":"s02","rt582200":"s04","rt759346":"s04","rt053897":"s04","rt960191":"s04","rt483806":"s04","rt035062":"s01","rt722846":"s01"};
  let changed=false;
  SB_RATE_TYPES.forEach(rt=>{ if(rt && rt.owner==null && MAP[rt.id]){ rt.owner=MAP[rt.id]; changed=true; } });   // ==null → undefined หรือ null (ไม่แตะ '' Shared ที่ admin ตั้งเอง)
  if(changed && typeof rtPersist==='function') rtPersist();
}
// §auto-gen rate-type code = ชื่อเซลล์เจ้าของ + ชื่อเรท (unique) · owner ว่าง → ใช้ชื่อเรทอย่างเดียว
function _rtAutoCode(name, ownerSalesId){
  const clean=(s,n)=>String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,n);
  const s=(ownerSalesId && typeof sbGetSales==='function')?sbGetSales(ownerSalesId):null;
  const salesPart=s?clean(s.name||s.code,6):'';
  const namePart=clean(name,6)||'RT';
  const base=(salesPart?salesPart+'-':'')+namePart;
  let code=base,i=2;
  while((SB_RATE_TYPES||[]).some(r=>String(r.code||'').toUpperCase()===String(code).toUpperCase())) code=base+'-'+(i++);
  return code;
}
function _rtOwnerId(rt){ return (rt && rt.owner) ? rt.owner : ''; }
// §rtBySales (2026-08-02) · เรทของเซลล์คนอื่นไม่ควรโผล่ให้เลือก
//   เดิมลิสต์ยาว 35 รายการปนกันทุกเซลล์ · คนขายต้องไล่หาเองว่าอันไหนของตัวเอง และเลือกผิดเจ้าได้ง่าย
//   กติกา: เรทของเซลล์เจ้าของ agent + เรทส่วนกลาง (ไม่มี owner) เท่านั้น
//   ข้อยกเว้นสำคัญ — ถ้า agent ผูกเรทของเซลล์อื่นไว้อยู่แล้ว ต้องยังเห็น ไม่งั้นค่าเดิมจะหายเงียบตอนแก้
//   agent ที่ยังไม่ระบุเซลล์ = กรองไม่ได้ ให้เห็นทั้งหมดไปก่อน
// §rtLoginScope · เซลล์ที่ถูก scope เห็นเฉพาะเรทของตัวเอง + ส่วนกลาง · admin เห็นหมด
//   keepId = เรทที่ agent ผูกอยู่ตอนนี้ · ต้องรอดเสมอ ไม่งั้นค่าเดิมหายไปจากช่องเลือก
function rtScopeList(list, keepId){
  if(typeof laSalesScoped!=='function' || !laSalesScoped()) return list||[];
  var my=(typeof laMySalesId==='function')?(laMySalesId()||''):'';
  return (list||[]).filter(function(r){ var o=_rtOwnerId(r); return !o || o===my || (keepId && r.id===keepId); });
}
function rtForSales(salesId, keepId){
  var act=(SB_RATE_TYPES||[]).filter(function(r){ return r.active!==false || r.id===keepId; });
  act=rtScopeList(act, keepId);   // §rtLoginScope · กรองตามคนที่ login ก่อน แล้วค่อยแบ่งกลุ่มตามเซลล์เจ้าของ agent
  act.sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); });
  if(!salesId) return {own:[], shared:[], other:[], all:act, noSales:true};
  var own=[], shared=[], other=[];
  act.forEach(function(r){
    var o=_rtOwnerId(r);
    if(!o) shared.push(r);
    else if(o===salesId) own.push(r);
    else if(r.id===keepId) other.push(r);
  });
  return {own:own, shared:shared, other:other, all:own.concat(shared,other), noSales:false};
}
function _rtOwnerLabel(rt){ const id=_rtOwnerId(rt); if(!id) return 'Shared · กลาง'; const s=(typeof sbGetSales==='function')?sbGetSales(id):null; return s?(s.name||id):id; }
function _rtInScope(rt){ if(typeof laSalesScoped!=='function' || !laSalesScoped()) return true; const my=(typeof laMySalesId==='function')?laMySalesId():''; const o=_rtOwnerId(rt); return !o || o===my; }   // scoped sales เห็น: ของตัวเอง + Shared
function rtSetOwner(rtId, salesId){
  if(typeof window.laIsAdmin==='function' && !window.laIsAdmin()){ alert('เฉพาะ admin กำหนดเจ้าของ Rate Type ได้'); return; }
  const rt=getRateType(rtId); if(!rt) return;
  rt.owner = salesId || '';
  if(typeof rtPersist==='function') rtPersist();
  rtRenderList(); rtRenderDetail(rtId);
}
function rtRenderList(){
  const host = document.getElementById('rt-list');
  if(!host) return;
  const q = (document.getElementById('rt-search')?.value || '').toLowerCase().trim();

  let filtered = (SB_RATE_TYPES||[]).filter(_rtInScope);   // §scope · เซลล์เห็นของตัวเอง + Shared · admin เห็นหมด
  if(q) filtered = filtered.filter(rt =>
    (rt.name||'').toLowerCase().includes(q) ||
    (rt.code||'').toLowerCase().includes(q) ||
    (rt.note||'').toLowerCase().includes(q)
  );

  // Sort: enabled before disabled, then by validity state so the rate types in force today sit at
  // the top of every group — Active · Expiring · Always · Upcoming · Expired — then by name.
  // The old sort keyed only on the on/off flag, so an Upcoming card could sit above an Active one.
  const _RT_STATE_RANK = {active:0, expiring:1, always:2, upcoming:3, expired:4};
  const _rtRank = rt => { const st = _rtValidityStatus(rt).state; const r = _RT_STATE_RANK[st]; return r === undefined ? 9 : r; };
  filtered.sort((a,b) => {
    const aAct = a.active !== false ? 0 : 1;
    const bAct = b.active !== false ? 0 : 1;
    if(aAct !== bAct) return aAct - bAct;
    const aR = _rtRank(a), bR = _rtRank(b);
    if(aR !== bR) return aR - bR;
    return (a.name||'').localeCompare(b.name||'','en',{sensitivity:'base'});
  });

  const renderRow = (rt) => {
    const isSel = rt.id === _rtSelected;
    const isInactive = rt.active === false;
    const nUsing = (SB_AGENTS||[]).filter(a => a.rateTypeId === rt.id).length;
    const nRoutes = (rt.routes||[]).length;
    const vs = _rtValidityStatus(rt);
    const vBg = {active:'#E1F5EE',expiring:'#FFF5EB',expired:'#FDECEA',upcoming:'#E6F1FB',always:'#F1EFE8'}[vs.state];
    const vFg = {active:'#0F6E56',expiring:'#854F0B',expired:'#A32D2D',upcoming:'#0C447C',always:'#5F5E5A'}[vs.state];
    const dotBg = rt.color || '#7a8fa3';
    const codeShort = (rt.code||'').slice(0,3);
    // §Valid period as plain (bold) text — only when the rate type actually has date bounds (Always → chip already says so)
    const validTxt = (rt.validFrom || rt.validTo)
      ? ((rt.validFrom?_rtFmtDate(rt.validFrom):'…')+' – '+(rt.validTo?_rtFmtDate(rt.validTo):'…'))
      : '';
    return `
      <div class="sb-rt-row ${isSel?'sel':''} ${isInactive?'inactive':''}" onclick="rtSelectCard('${rt.id}')">
        <span class="sb-rt-dot" style="background:${dotBg}">${codeShort}</span>
        <div class="sb-rt-name-wrap">
          <div><span class="rt-name">${rt.name}</span></div>
          <div>${rt.code} · ${nRoutes} routes · ${nUsing} agent${nUsing!==1?'s':''}</div>
          ${validTxt?`<div class="sb-rt-valid" style="color:${vFg}" title="Valid ${validTxt}">${validTxt}</div>`:''}
        </div>
        <span class="sb-rt-vchip" style="background:${vBg};color:${vFg}" title="Validity: ${vs.label}">${vs.label}</span>
      </div>
    `;
  };

  const hd = (label,count,accent) => `<div class="sb-az-hd">${accent?`<span style="width:8px;height:8px;border-radius:50%;background:${accent};display:inline-block;margin-right:6px;vertical-align:middle"></span>`:''}${label} <span style="font-variant-numeric:tabular-nums;color:var(--fd-ink-faint);font-weight:600;margin-left:auto;font-size:10px">${count}</span></div>`;
  const scoped = (typeof laSalesScoped==='function' && laSalesScoped());
  let html = '';
  if(scoped){
    // เซลล์เห็นเฉพาะของตัว + Shared → จัดกลุ่ม Active / Inactive แบบเดิม
    const groups = {Active:[], Inactive:[]};
    filtered.forEach(rt => { (rt.active===false?groups.Inactive:groups.Active).push(rt); });
    ['Active','Inactive'].forEach(g => { if(!groups[g].length) return; html += hd(g, groups[g].length); groups[g].forEach(rt => { html += renderRow(rt); }); });
  } else {
    // admin / เห็นหมด → จัดกลุ่มตาม "เจ้าของ" (เซลล์) · Shared ไว้ท้ายสุด
    const byOwner = {};
    filtered.forEach(rt => { const o=_rtOwnerId(rt); (byOwner[o]=byOwner[o]||[]).push(rt); });   // filtered ถูก sort active-first + name มาแล้ว → ลำดับในกลุ่มคงเดิม
    const ownerIds = Object.keys(byOwner).filter(o=>o).sort((a,b)=>_rtOwnerLabel({owner:a}).localeCompare(_rtOwnerLabel({owner:b}),'en',{sensitivity:'base'}));
    const ordered = [...ownerIds]; if(byOwner['']) ordered.push('');   // Shared/กลาง ท้ายสุด
    ordered.forEach(o => { const list=byOwner[o]; const s=o&&(typeof sbGetSales==='function')?sbGetSales(o):null; html += hd(o?('เซลล์: '+(s?(s.name||o):o)):'Shared · กลาง', list.length, s?(s.color||'#7a8fa3'):(o?'#7a8fa3':'#B0AEA6')); list.forEach(rt => { html += renderRow(rt); }); });
  }

  host.innerHTML = html || '<div class="sb-empty" style="padding:30px 16px;color:var(--fd-ink-soft);font-size:12px">ยังไม่มี Rate Type — กดปุ่ม "+ New Rate Type" เพื่อสร้าง</div>';

  // Update count chip in sidebar header
  const cnt = document.getElementById('rt-list-count');
  if(cnt) cnt.textContent = `${filtered.length} / ${(SB_RATE_TYPES||[]).length}`;
}

// ════════════ Add-on Type Registry (single source of truth) ════════════
// To add a NEW add-on type in future: push ONE object below with its own
// detail/init (+ contract/edit) hooks. All consumers loop this array, so the
// new type appears in the Rate Type page, Agent Pricing Matrix tab, the edit
// modal toggle list, and (when given) the contract — no scattered edits.
function _rtAddonDetail_longtail(rt, subNo){
  const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[];
  const rName=rId=>(ROUTES_ARR.find(r=>r.id===rId)||{}).name||rId;
  const fmt=n=>(n||0).toLocaleString();
  const ao=rt.addOns||{};
  const ltView = (typeof _rtNormalizeLongtail === 'function') ? _rtNormalizeLongtail(ao.longtail) : ao.longtail;
  if(!ltView) return '';
    const rIds = (ltView.applies && ltView.applies.length) ? ltView.applies : Object.keys(ltView.byRoute||{});
    const cell = v => v ? fmt(v) : '<span style="color:#9b9590">—</span>';
    const rows = rIds.map(rId => {
      const e = (ltView.byRoute && ltView.byRoute[rId]) || {join:ltView.join, charter:ltView.charter};
      const j = e.join||{}, c = e.charter||{};
      return `<tr style="border-top:1px solid #F2F0EA">
        <td style="padding:9px 0;font-size:12px;font-weight:500;color:#0F1419">${rName(rId)}</td>
        <td style="padding:9px 12px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419;border-left:1px solid #F2F0EA">${cell(j.adult)}</td>
        <td style="padding:9px 12px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419">${cell(j.child)}</td>
        <td style="padding:9px 12px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419;border-left:1px solid #F2F0EA">${cell(c.price)}</td>
        <td style="padding:9px 0 9px 12px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419">${c.price?((c.capacity||6)+' pax'):'<span style=\"color:#9b9590\">—</span>'}</td>
      </tr>`;
    }).join('');
    const TH_FG='#143F73', FR_FG='#854F0B';
    return (`
      <div style="padding:14px 26px 14px">
        <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1.5px solid #C8C6BF">
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:20px;padding:0 8px;background:#5F5E5A;color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em;border-radius:3px;font-variant-numeric:tabular-nums">3.${subNo}</span>
            <span style="font-size:13.5px;font-weight:700;color:#0F1419;letter-spacing:-0.005em">Longtail (เรือหางยาว)</span>
            <span style="font-size:10.5px;color:#7a7770">per route · Join + Charter · THB</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th rowspan="2" style="padding:6px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Route</th>
              <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:${TH_FG};letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid ${TH_FG};border-left:1px solid #F2F0EA">Join · per pax</th>
              <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:${FR_FG};letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid ${FR_FG};border-left:1px solid #F2F0EA">Charter · per boat</th>
            </tr>
            <tr>
              <th style="padding:5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;border-left:1px solid #F2F0EA">Adult</th>
              <th style="padding:5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A">Child</th>
              <th style="padding:5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;border-left:1px solid #F2F0EA">Price</th>
              <th style="padding:5px 0 5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A">Capacity</th>
            </tr>
          </thead>
          <tbody>${rows||'<tr><td colspan="5" style="padding:14px 0;color:#9b9590;font-size:11px;font-style:italic">No routes / pricing yet</td></tr>'}</tbody>
        </table>
      </div>
    `);

}
function _rtAddonDetail_privateTransfer(rt, subNo){
  const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[];
  const rName=rId=>(ROUTES_ARR.find(r=>r.id===rId)||{}).name||rId;
  const fmt=n=>(n||0).toLocaleString();
  const _rv = rt.routeValidity || {};
  const TH_FG='#143F73', FR_FG='#854F0B';
  const ao=rt.addOns||{};
  if(!ao.privateTransfer) return '';
    const ptRouteIds = Object.keys(ao.privateTransfer).filter(k => k !== 'unit');
    const ptUnit = ao.privateTransfer.unit || 'per trip';
    if(!ptRouteIds.length) return '';
      const cell = (v) => v ? `${fmt(v)}` : `<span style="color:#9b9590">—</span>`;
      const ptRows = ptRouteIds.map(rId => {
        const byZone = ao.privateTransfer[rId] || {};
        const pk = byZone.PK || {};
        const kl = byZone.KL || {};
        const rv = _rv[rId] || {};
        const vFrom = rv.from ? _rtFmtDate(rv.from) : '<span style="color:#9b9590">—</span>';
        const vTo   = rv.to   ? _rtFmtDate(rv.to)   : '<span style="color:#9b9590">—</span>';
        return `<tr style="border-top:1px solid #F2F0EA">
          <td style="padding:9px 0;font-size:12px;font-weight:500;color:#0F1419">${rName(rId)}</td>
          <td style="padding:9px 12px;text-align:center;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419">${cell(pk.sedan)}</td>
          <td style="padding:9px 12px;text-align:center;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419">${cell(pk.van)}</td>
          <td style="padding:9px 12px;text-align:center;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419;border-left:1px solid #F2F0EA">${cell(kl.sedan)}</td>
          <td style="padding:9px 12px;text-align:center;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419">${cell(kl.van)}</td>
          <td style="padding:9px 12px;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#9b9590;border-left:1px solid #F2F0EA" title="Inherited from § 1 Seat rates">${vFrom}</td>
          <td style="padding:9px 0 9px 12px;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#9b9590" title="Inherited from § 1 Seat rates">${vTo}</td>
        </tr>`;
      }).join('');
      return (`
        <div style="padding:14px 26px 14px">
          <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1.5px solid #C8C6BF">
            <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
              <span style="display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:20px;padding:0 8px;background:#5F5E5A;color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em;border-radius:3px;font-variant-numeric:tabular-nums">3.${subNo}</span>
              <span style="font-size:13.5px;font-weight:700;color:#0F1419;letter-spacing:-0.005em">Private transfer</span>
              <span style="font-size:10.5px;color:#7a7770">${ptUnit} · ${ptRouteIds.length} route${ptRouteIds.length>1?'s':''} · 2 zones · sedan + van · THB</span>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th rowspan="2" style="padding:6px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Route</th>
                <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:${TH_FG};letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid ${TH_FG}">Zone PK</th>
                <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:${FR_FG};letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid ${FR_FG};border-left:1px solid #F2F0EA">Zone KL</th>
                <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #C8C6BF;border-left:1px solid #F2F0EA">Active period <span style="font-size:8.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#9b9590;margin-left:4px">inherited · § 1</span></th>
              </tr>
              <tr>
                <th style="padding:5px 12px;text-align:center;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em">Sedan</th>
                <th style="padding:5px 12px;text-align:center;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em">Van</th>
                <th style="padding:5px 12px;text-align:center;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em;border-left:1px solid #F2F0EA">Sedan</th>
                <th style="padding:5px 12px;text-align:center;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em">Van</th>
                <th style="padding:5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em;border-left:1px solid #F2F0EA">Start</th>
                <th style="padding:5px 0 5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em">End</th>
              </tr>
            </thead>
            <tbody>${ptRows}</tbody>
          </table>
        </div>
      `);

}
function _rtAddonContract_longtail(rt, ctx){
  const {T, fmtN, rName} = ctx;
  const ao = rt.addOns||{};
  // Longtail (use normalizer)
  const lt = (typeof _rtNormalizeLongtail==='function') ? _rtNormalizeLongtail(ao.longtail) : ao.longtail;
  let longtailHtml = '';
  if(lt){
    const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[];
    const _rn = rId => (typeof rName==='function'?rName(rId):((ROUTES_ARR.find(r=>r.id===rId)||{}).name||rId));
    const rIds = (lt.applies && lt.applies.length) ? lt.applies : Object.keys(lt.byRoute||{});
    const rows = rIds.map(rId => {
      const e = (lt.byRoute && lt.byRoute[rId]) || {join:lt.join, charter:lt.charter};
      const j=e.join||{}, c=e.charter||{};
      if(!(j.adult||j.child||c.price)) return '';
      return `<tr style="border-top:1px solid #F2F0EA">
        <td style="padding:7px 0;font-size:11px;font-weight:600;color:#0F1419">${_rn(rId)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${fmtN(j.adult)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${fmtN(j.child)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${c.price?fmtN(c.price):'—'}</td>
        <td style="padding:7px 0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${c.price?((c.capacity||6)+' pax'):'—'}</td>
      </tr>`;
    }).filter(Boolean);
    if(rows.length){
      longtailHtml = `
        <div style="font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">${T('longtail')}</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
          <thead><tr>
            <th style="padding:6px 0;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">Route</th>
            <th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">${T('join')} ${T('adult')}</th>
            <th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">${T('child')}</th>
            <th style="padding:6px 10px;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">${T('charter')}</th>
            <th style="padding:6px 0;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">${T('capacity')}</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>`;
    }
  }
  return longtailHtml;
}
function _rtAddonContract_privateTransfer(rt, ctx){
  const {T, fmtN, rName} = ctx;
  const ao = rt.addOns||{};
  // Private Transfer
  let transferHtml = '';
  if(ao.privateTransfer){
    const ptRouteIds = Object.keys(ao.privateTransfer).filter(k => k !== 'unit');
    if(ptRouteIds.length){
      const ptRows = ptRouteIds.map(rId => {
        const byZone = ao.privateTransfer[rId] || {};
        const pk = byZone.PK || {};
        const kl = byZone.KL || {};
        const cell = (v) => v ? fmtN(v) : `<span style="color:#9b9590">—</span>`;
        return `<tr style="border-top:1px solid #F2F0EA">
          <td style="padding:7px 0;font-size:11px;font-weight:500;color:#0F1419">${rName(rId)}</td>
          <td style="padding:7px 10px;text-align:center;font-size:11px;font-variant-numeric:tabular-nums">${cell(pk.sedan)}</td>
          <td style="padding:7px 10px;text-align:center;font-size:11px;font-variant-numeric:tabular-nums">${cell(pk.van)}</td>
          <td style="padding:7px 10px;text-align:center;font-size:11px;font-variant-numeric:tabular-nums;border-left:1px solid #F2F0EA">${cell(kl.sedan)}</td>
          <td style="padding:7px 0;text-align:center;font-size:11px;font-variant-numeric:tabular-nums">${cell(kl.van)}</td>
        </tr>`;
      }).join('');
      const TH_FG='#143F73', FR_FG='#854F0B';
      transferHtml = `
        <div style="font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">${T('privateTransfer')} · ${T('perTrip')}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th rowspan="2" style="padding:5px 0;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">${T('route')}</th>
              <th colspan="2" style="padding:4px 10px;text-align:center;font-size:9.5px;font-weight:700;color:${TH_FG};letter-spacing:.05em;text-transform:uppercase;border-bottom:1.5px solid ${TH_FG}">${T('zone')} PK</th>
              <th colspan="2" style="padding:4px 10px;text-align:center;font-size:9.5px;font-weight:700;color:${FR_FG};letter-spacing:.05em;text-transform:uppercase;border-bottom:1.5px solid ${FR_FG};border-left:1px solid #F2F0EA">${T('zone')} KL</th>
            </tr>
            <tr>
              <th style="padding:4px 10px;text-align:center;font-size:8.5px;font-weight:600;color:#5F5E5A">${T('sedan')}</th>
              <th style="padding:4px 10px;text-align:center;font-size:8.5px;font-weight:600;color:#5F5E5A">${T('van')}</th>
              <th style="padding:4px 10px;text-align:center;font-size:8.5px;font-weight:600;color:#5F5E5A;border-left:1px solid #F2F0EA">${T('sedan')}</th>
              <th style="padding:4px 0;text-align:center;font-size:8.5px;font-weight:600;color:#5F5E5A">${T('van')}</th>
            </tr>
          </thead>
          <tbody>${ptRows}</tbody>
        </table>`;
    }
  }
  return transferHtml;
}
function _rtAddonEdit_longtail(d){
  const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[];
  // Add-ons
  const ao = d.addOns||{};
  const ltRaw = ao.longtail;
  const lt = _rtNormalizeLongtail(ltRaw);     // normalized read-view (UI uses this)
  const ltApplies = lt ? (lt.applies||[]) : [];
  const ltRoutesHtml = (d.routes||[]).map(rId => {
    const r = ROUTES_ARR.find(x=>x.id===rId);
    const on = ltApplies.includes(rId);
    return `<span onclick="rtToggleAddOnRoute('longtail','${rId}')" style="background:${on?'#E1F5EE':'#fafaf8'};color:${on?'#0F6E56':'var(--fd-ink-soft)'};border:1px solid ${on?'#0F6E56':'var(--fd-line)'};padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:${on?'600':'500'};cursor:pointer;display:inline-flex;align-items:center;gap:4px">${r?r.name:rId}${on?' ✓':''}</span>`;
  }).join('');

  const J_ACC = '#185FA5', C_ACC = '#854F0B';
  // Seed a per-route price entry for every applies route (so each row binds to real draft data + saves) · migrates old flat
  if(lt && ltRaw){
    if(!ltRaw.byRoute) ltRaw.byRoute = {};
    (lt.applies||[]).forEach(rid=>{ if(!ltRaw.byRoute[rid]){ const e=(lt.byRoute&&lt.byRoute[rid])||{join:lt.join,charter:lt.charter}; ltRaw.byRoute[rid]={join:{adult:(e.join&&e.join.adult)||0,child:(e.join&&e.join.child)||0},charter:{price:(e.charter&&e.charter.price)||0,capacity:(e.charter&&e.charter.capacity)||6}}; } });
  }
  const ltRows = lt ? (lt.applies||[]).map(rId=>{
    const r = ROUTES_ARR.find(x=>x.id===rId); const nm = r?r.name:rId;
    const e = (ltRaw.byRoute&&ltRaw.byRoute[rId]) || {join:{},charter:{}};
    return `<tr style="border-top:1px solid var(--fd-line-soft)">
      <td style="padding:6px 8px 6px 0;font-size:11.5px;font-weight:500;white-space:nowrap">${nm}</td>
      <td style="padding:4px 6px;border-left:1px solid var(--fd-line-soft)"><input type="number" min="0" value="${(e.join&&e.join.adult)||0}" oninput="rtDraftSet('addOns.longtail.byRoute.${rId}.join.adult',+this.value||0)" style="width:74px;height:28px;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid ${J_ACC}33;border-radius:6px;padding:2px 6px;background:#fff"></td>
      <td style="padding:4px 6px"><input type="number" min="0" value="${(e.join&&e.join.child)||0}" oninput="rtDraftSet('addOns.longtail.byRoute.${rId}.join.child',+this.value||0)" style="width:74px;height:28px;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid ${J_ACC}33;border-radius:6px;padding:2px 6px;background:#fff"></td>
      <td style="padding:4px 6px;border-left:1px solid var(--fd-line-soft)"><input type="number" min="0" value="${(e.charter&&e.charter.price)||0}" oninput="rtDraftSet('addOns.longtail.byRoute.${rId}.charter.price',+this.value||0)" style="width:84px;height:28px;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid ${C_ACC}33;border-radius:6px;padding:2px 6px;background:#fff"></td>
      <td style="padding:4px 0 4px 6px"><input type="number" min="1" value="${(e.charter&&e.charter.capacity)||6}" oninput="rtDraftSet('addOns.longtail.byRoute.${rId}.charter.capacity',+this.value||1)" style="width:56px;height:28px;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid ${C_ACC}33;border-radius:6px;padding:2px 6px;background:#fff"></td>
    </tr>`;
  }).join('') : '';

  const longtailCard = `<div style="background:#fafaf8;border-radius:10px;padding:10px 12px;margin-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${lt?'10px':'0'}">
      <label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;cursor:pointer">
        <input type="checkbox" ${lt?'checked':''} onchange="rtToggleAddOn('longtail',this.checked)" style="width:16px;height:16px;margin:0">
        Longtail (เรือหางยาว)
      </label>
      ${lt?'<span style="font-size:10.5px;color:var(--fd-ink-soft)">ราคาแยกราย route · Join + Charter</span>':''}
    </div>
    ${lt ? `
      <!-- Applies to -->
      <div style="margin-bottom:10px">
        <div style="font-size:10px;color:var(--fd-ink-soft);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em;font-weight:700">Applies to (คลิกเพื่อเปิด/ปิด route)</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${ltRoutesHtml || '<span style="font-size:10.5px;color:var(--fd-ink-soft);font-style:italic">เลือก routes ใน Routes covered ก่อน</span>'}</div>
      </div>
      ${(lt.applies||[]).length ? `
      <!-- Per-route pricing -->
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th rowspan="2" style="text-align:left;font-size:9px;font-weight:700;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.04em;padding:0 8px 5px 0;vertical-align:bottom">Route</th>
              <th colspan="2" style="text-align:center;font-size:9.5px;font-weight:700;color:${J_ACC};text-transform:uppercase;letter-spacing:.04em;padding:0 6px 4px;border-left:1px solid var(--fd-line-soft)">Join · per pax</th>
              <th colspan="2" style="text-align:center;font-size:9.5px;font-weight:700;color:${C_ACC};text-transform:uppercase;letter-spacing:.04em;padding:0 6px 4px;border-left:1px solid var(--fd-line-soft)">Charter · per boat</th>
            </tr>
            <tr>
              <th style="text-align:right;font-size:8.5px;color:var(--fd-ink-soft);padding:0 6px 5px;border-left:1px solid var(--fd-line-soft)">Adult ฿</th>
              <th style="text-align:right;font-size:8.5px;color:var(--fd-ink-soft);padding:0 6px 5px">Child ฿</th>
              <th style="text-align:right;font-size:8.5px;color:var(--fd-ink-soft);padding:0 6px 5px;border-left:1px solid var(--fd-line-soft)">Price ฿</th>
              <th style="text-align:right;font-size:8.5px;color:var(--fd-ink-soft);padding:0 0 5px 6px">Max pax</th>
            </tr>
          </thead>
          <tbody>${ltRows}</tbody>
        </table>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--fd-ink-soft);font-style:italic">⌗ ใส่ 0 = ไม่เสนอ mode นั้นสำหรับ route นั้น · แต่ละ route ตั้งราคาต่างกันได้ (เช่น สุรินทร์)</div>
      ` : '<div style="font-size:10.5px;color:var(--fd-ink-soft);font-style:italic;padding:4px 0">เปิด route ใน Applies to ด้านบนก่อน เพื่อตั้งราคาราย route</div>'}
    ` : ''}
  </div>`;

  return longtailCard;
}
function _rtAddonEdit_privateTransfer(d){
  const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[];
  const pt = (d.addOns && d.addOns.privateTransfer) || null;
  const PK_BG = '#E6F1FB', PK_FG = '#185FA5', PK_SOFT = '#185FA51A';
  const KL_BG = '#FAEEDA', KL_FG = '#854F0B', KL_SOFT = '#854F0B1A';
  let transferRowsHtml = '';
  if(pt){
    const routeIds = Object.keys(pt).filter(k => k !== 'unit');
    routeIds.forEach(rId => {
      // Auto-init missing zones so all 4 inputs always render
      _rtEnsureBothZones(pt, rId);
      const pkZ = pt[rId]['PK'];
      const klZ = pt[rId]['KL'];
      const routeOpts = ROUTES_ARR
        .filter(r => (d.routes||[]).includes(r.id))
        .map(r => `<option value="${r.id}" ${r.id===rId?'selected':''}>${r.name}</option>`)
        .join('');
      const inputCell = (val, path, accent) => `
        <td style="padding:4px 5px;text-align:right;background:${accent}">
          <input type="number" value="${val||0}" min="0"
            oninput="rtDraftSet('${path}',+this.value||0)"
            style="width:100%;max-width:110px;height:30px;font-size:11px;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff;outline:none">
        </td>`;
      transferRowsHtml += `
        <tr style="border-top:1px solid var(--fd-line-soft)">
          <td style="padding:4px 6px">
            <select onchange="rtChangeTransferRouteWhole('${rId}',this.value)"
              style="width:100%;height:30px;font-size:11.5px;font-family:inherit;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff;font-weight:600;color:var(--fd-ink)">
              ${routeOpts}
            </select>
          </td>
          ${inputCell(pkZ.sedan, `addOns.privateTransfer.${rId}.PK.sedan`, PK_SOFT)}
          ${inputCell(pkZ.van,   `addOns.privateTransfer.${rId}.PK.van`,   PK_SOFT)}
          ${inputCell(klZ.sedan, `addOns.privateTransfer.${rId}.KL.sedan`, KL_SOFT)}
          ${inputCell(klZ.van,   `addOns.privateTransfer.${rId}.KL.van`,   KL_SOFT)}
          <td style="padding:4px 6px;text-align:center">
            <button onclick="rtRemoveTransferRoute('${rId}')" title="ลบ route นี้ (ทั้ง PK และ KL)"
              style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:14px;padding:4px 6px">✕</button>
          </td>
        </tr>`;
    });
  }
  const transferTable = transferRowsHtml
    ? `<table style="width:100%;border-collapse:collapse;border:1px solid var(--fd-line);border-radius:8px;overflow:hidden;table-layout:fixed">
        <colgroup>
          <col style="width:30%">
          <col><col><col><col>
          <col style="width:34px">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2" style="padding:9px 12px;text-align:left;font-size:9.5px;color:var(--fd-ink-soft);font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#fafaf8;vertical-align:bottom;border-right:1px solid var(--fd-line-soft)">Route</th>
            <th colspan="2" style="padding:6px 8px;text-align:center;font-size:10px;color:${PK_FG};font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:${PK_BG};border-right:2px solid #fff">Zone PK</th>
            <th colspan="2" style="padding:6px 8px;text-align:center;font-size:10px;color:${KL_FG};font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:${KL_BG}">Zone KL</th>
            <th rowspan="2" style="width:34px;background:#fafaf8"></th>
          </tr>
          <tr>
            <th style="padding:5px 8px;text-align:right;font-size:9px;color:${PK_FG};font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:${PK_BG};opacity:.92">Sedan</th>
            <th style="padding:5px 8px;text-align:right;font-size:9px;color:${PK_FG};font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:${PK_BG};opacity:.92;border-right:2px solid #fff">Van</th>
            <th style="padding:5px 8px;text-align:right;font-size:9px;color:${KL_FG};font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:${KL_BG};opacity:.92">Sedan</th>
            <th style="padding:5px 8px;text-align:right;font-size:9px;color:${KL_FG};font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:${KL_BG};opacity:.92">Van</th>
          </tr>
        </thead>
        <tbody>${transferRowsHtml}</tbody>
      </table>`
    : '<div style="padding:14px;text-align:center;color:var(--fd-ink-soft);font-size:11px;border:1px dashed var(--fd-line);border-radius:10px">ยังไม่มี private transfer · กด <strong>+ Add route</strong> เพื่อเพิ่ม</div>';

  const pTransferCard = `<div style="background:#fafaf8;border-radius:10px;padding:10px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${pt?'8px':'0'}">
      <label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;cursor:pointer">
        <input type="checkbox" ${pt?'checked':''} onchange="rtToggleAddOn('privateTransfer',this.checked)" style="width:16px;height:16px;margin:0">
        Private transfer · per (route × zone)
      </label>
      ${pt?`<button onclick="rtAddTransferRoute()" style="font-family:inherit;font-size:10px;font-weight:600;background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);padding:4px 9px;border-radius:6px;cursor:pointer">+ Add route</button>`:''}
    </div>
    ${pt ? transferTable : ''}
  </div>`;

  return pTransferCard;
}
function _rtAddonPreview(rt){
  for(const def of (typeof RT_ADDON_DEFS!=='undefined'?RT_ADDON_DEFS:[])){
    if(def.summary){ const sm=def.summary(rt); if(sm) return sm; }
  }
  return {preview:'—', lbl:'No add-on'};
}

function _rtAddonInit_generic(cfg){
  const o = { applies: [] };
  if(cfg.model==='flat'){ o.price = 0; } else { o.adult = 0; o.child = 0; }
  return o;
}
function _rtAddonSummary_generic(rt, cfg){
  const ao = rt.addOns||{}; const d = ao[cfg.key]; if(!d) return null;
  const fmt = n=>(n||0).toLocaleString();
  if(cfg.model==='flat'){ if(d.price) return {preview:`${fmt(d.price)}`, lbl:`${cfg.label.en} · ${cfg.unit||'flat'}`}; return null; }
  if(d.adult||d.child) return {preview:`${fmt(d.adult)} / ${fmt(d.child)}`, lbl:`${cfg.label.en} · adult / child`};
  return null;
}
function _rtAddonDetail_generic(rt, subNo, cfg){
  const ao = rt.addOns||{}; const d = ao[cfg.key]; if(!d) return '';
  const fmt = n=>(n||0).toLocaleString();
  const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[]; const rName=id=>(ROUTES_ARR.find(r=>r.id===id)||{}).name||id;
  const applies=(d.applies||[]); const applName=applies.length?applies.map(rName).join(' · '):'all routes';
  let rows;
  if(cfg.model==='flat'){
    rows = `<tr style="border-top:1px solid #F2F0EA">
      <td style="padding:9px 0;font-size:12px;font-weight:600;color:#0F1419">${cfg.unit||'Flat'}</td>
      <td style="padding:9px 12px;font-size:11px;color:#5F5E5A">per booking</td>
      <td style="padding:9px 0;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:#0F1419">${fmt(d.price)}</td>
    </tr>`;
  } else {
    rows = `<tr style="border-top:1px solid #F2F0EA">
      <td style="padding:9px 0;font-size:12px;font-weight:600;color:#0F1419">Adult</td>
      <td style="padding:9px 12px;font-size:11px;color:#5F5E5A">${cfg.unit||'per pax'}</td>
      <td style="padding:9px 0;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:#0F1419">${fmt(d.adult)}</td>
    </tr>
    <tr style="border-top:1px solid #F2F0EA">
      <td style="padding:9px 0;font-size:12px;font-weight:600;color:#0F1419">Child</td>
      <td style="padding:9px 12px;font-size:11px;color:#5F5E5A">${cfg.unit||'per pax'}</td>
      <td style="padding:9px 0;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:#0F1419">${fmt(d.child)}</td>
    </tr>`;
  }
  return `
    <div style="padding:14px 26px 4px">
      <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1.5px solid #C8C6BF">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:20px;padding:0 8px;background:#5F5E5A;color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em;border-radius:3px;font-variant-numeric:tabular-nums">3.${subNo}</span>
          <span style="font-size:13.5px;font-weight:700;color:#0F1419;letter-spacing:-0.005em">${cfg.label.en}</span>
          <span style="font-size:10.5px;color:#7a7770">applies: ${applName}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="padding:6px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase">Item</th>
          <th style="padding:6px 12px;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase">Basis</th>
          <th style="padding:6px 0;text-align:right;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase">THB</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
function _rtAddonContract_generic(rt, ctx, cfg){
  const {fmtN, lang} = ctx; const d = (rt.addOns||{})[cfg.key]; if(!d) return '';
  const label = (cfg.label && (cfg.label[lang]||cfg.label.en)) || cfg.key;
  let rows;
  if(cfg.model==='flat'){
    rows = `<tr style="border-top:1px solid #F2F0EA"><td style="padding:7px 0;font-size:11px;font-weight:600;color:#0F1419">${cfg.unit||'Flat'}</td><td style="padding:7px 0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${fmtN(d.price)}</td></tr>`;
  } else {
    rows = `<tr style="border-top:1px solid #F2F0EA"><td style="padding:7px 0;font-size:11px;font-weight:600;color:#0F1419">Adult</td><td style="padding:7px 0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${fmtN(d.adult)}</td></tr>
    <tr style="border-top:1px solid #F2F0EA"><td style="padding:7px 0;font-size:11px;font-weight:600;color:#0F1419">Child</td><td style="padding:7px 0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${fmtN(d.child)}</td></tr>`;
  }
  return `
    <div style="font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.08em;text-transform:uppercase;margin:8px 0 6px">${label}${cfg.unit?` · ${cfg.unit}`:''}</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr>
        <th style="padding:6px 0;text-align:left;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">Item</th>
        <th style="padding:6px 0;text-align:right;font-size:9px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #1A2B43">THB</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
function _rtAddonEdit_generic(d, cfg){
  const ROUTES_ARR=(typeof ROUTES!=='undefined'&&ROUTES)||[];
  const cur = (d.addOns||{})[cfg.key];
  const on = !!cur;
  const routesHtml = on ? (d.routes||[]).map(rId=>{
    const r = ROUTES_ARR.find(x=>x.id===rId); const sel = (cur.applies||[]).includes(rId);
    return `<span onclick="rtToggleAddOnRoute('${cfg.key}','${rId}')" style="background:${sel?'#E1F5EE':'#fafaf8'};color:${sel?'#0F6E56':'var(--fd-ink-soft)'};border:1px solid ${sel?'#0F6E56':'var(--fd-line)'};padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:${sel?'600':'500'};cursor:pointer;display:inline-flex;align-items:center;gap:4px">${r?r.name:rId}${sel?' ✓':''}</span>`;
  }).join('') : '';
  let priceInputs = '';
  if(on){
    if(cfg.model==='flat'){
      priceInputs = `<div style="margin-top:8px"><div style="font-size:9.5px;color:var(--fd-ink-soft);margin-bottom:3px">${cfg.unit||'Flat'} · THB</div>
        <input type="number" value="${cur.price||0}" min="0" oninput="rtDraftSet('addOns.${cfg.key}.price',+this.value||0)" style="width:160px;height:32px;font-size:12px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff;outline:none"></div>`;
    } else {
      priceInputs = `<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:300px">
        <div><div style="font-size:9.5px;color:var(--fd-ink-soft);margin-bottom:3px">Adult · THB</div>
          <input type="number" value="${cur.adult||0}" min="0" oninput="rtDraftSet('addOns.${cfg.key}.adult',+this.value||0)" style="width:100%;height:32px;font-size:12px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff;outline:none"></div>
        <div><div style="font-size:9.5px;color:var(--fd-ink-soft);margin-bottom:3px">Child · THB</div>
          <input type="number" value="${cur.child||0}" min="0" oninput="rtDraftSet('addOns.${cfg.key}.child',+this.value||0)" style="width:100%;height:32px;font-size:12px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff;outline:none"></div>
      </div>`;
    }
  }
  return `<div style="background:#fafaf8;border-radius:10px;padding:10px 12px;margin-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${on?'10px':'0'}">
      <label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;cursor:pointer">
        <input type="checkbox" ${on?'checked':''} onchange="rtToggleAddOn('${cfg.key}',this.checked)" style="width:16px;height:16px;margin:0">
        ${cfg.label.en} <span style="font-size:9px;color:#7a7770;font-weight:600;background:#eeece6;padding:1px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:.04em">custom</span>
      </label>
      ${on?`<span style="font-size:10.5px;color:var(--fd-ink-soft)">${cfg.model==='flat'?'flat':'per pax'}${cfg.unit?` · ${cfg.unit}`:''}</span>`:''}
    </div>
    ${on?`<div style="margin-bottom:6px"><div style="font-size:10px;color:var(--fd-ink-soft);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em;font-weight:700">Applies to (click route)</div><div style="display:flex;flex-wrap:wrap;gap:4px">${routesHtml||'<span style="font-size:10.5px;color:var(--fd-ink-soft);font-style:italic">เลือก routes ใน Routes covered ก่อน</span>'}</div></div>${priceInputs}`:''}
  </div>`;
}
function _rtGenericDef(cfg){
  return {
    key: cfg.key, label: cfg.label, custom: true,
    detailPresent: rt => !!(rt.addOns && rt.addOns[cfg.key]),
    detail: (rt, subNo) => _rtAddonDetail_generic(rt, subNo, cfg),
    contract: (rt, ctx) => _rtAddonContract_generic(rt, ctx, cfg),
    edit: (d) => _rtAddonEdit_generic(d, cfg),
    init: rt => _rtAddonInit_generic(cfg),
    summary: rt => _rtAddonSummary_generic(rt, cfg),
  };
}
function rtRebuildAddonDefs(){ RT_ADDON_DEFS = [...RT_ADDON_BUILTIN, ...SB_ADDON_TYPES.map(_rtGenericDef)]; }

// ════ UI · Manage custom add-on types ════
function rtAddonTypesOpen(){
  let ov = document.getElementById('rt-addon-types-modal');
  if(!ov){ ov = document.createElement('div'); ov.id='rt-addon-types-modal'; document.body.appendChild(ov); }
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,20,25,.45);display:flex;align-items:center;justify-content:center;padding:24px';
  ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:15px;font-weight:700;color:var(--fd-ink)">จัดการชนิด Add-on</div>
      <div style="font-size:11px;color:var(--fd-ink-soft);margin-top:2px">เพิ่มชนิดใหม่ → โผล่ในทุก Rate Type อัตโนมัติ</div></div>
      <button onclick="rtAddonTypesClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer;padding:4px 8px;line-height:1">✕</button>
    </div>
    <div id="rt-addon-types-body" style="padding:18px 20px"></div>
  </div>`;
  ov.onclick = (e)=>{ if(e.target===ov) rtAddonTypesClose(); };
  rtAddonTypesRenderBody();
}
function rtAddonTypesClose(){ const ov=document.getElementById('rt-addon-types-modal'); if(ov) ov.remove(); }
function rtAddonTypesRenderBody(){
  const host=document.getElementById('rt-addon-types-body'); if(!host) return;
  const builtin = RT_ADDON_BUILTIN.map(d=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--fd-line-soft);border-radius:9px;margin-bottom:7px;background:#fafaf8">
    <div><span style="font-size:12.5px;font-weight:600;color:var(--fd-ink)">${d.label.en}</span> <span style="font-size:11px;color:var(--fd-ink-soft)">· ${d.label.th}</span></div>
    <span style="font-size:9px;color:#7a7770;font-weight:700;background:#eeece6;padding:2px 8px;border-radius:5px;text-transform:uppercase;letter-spacing:.04em">built-in</span>
  </div>`).join('');
  const custom = SB_ADDON_TYPES.length ? SB_ADDON_TYPES.map(c=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--fd-line);border-radius:9px;margin-bottom:7px">
    <div><span style="font-size:12.5px;font-weight:600;color:var(--fd-ink)">${c.label.en}</span> <span style="font-size:11px;color:var(--fd-ink-soft)">· ${c.label.th} · ${c.model==='flat'?'flat':'per pax'}${c.unit?` · ${c.unit}`:''}</span></div>
    <button onclick="rtAddonTypeDelete('${c.key}')" title="ลบชนิดนี้" style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:13px;padding:4px 8px">✕</button>
  </div>`).join('') : `<div style="font-size:11px;color:var(--fd-ink-soft);font-style:italic;padding:4px 0 8px">ยังไม่มีชนิดที่สร้างเอง</div>`;
  host.innerHTML = `
    <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:8px">ชนิดที่มี</div>
    ${builtin}${custom}
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--fd-line)">
      <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">+ สร้างชนิดใหม่</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">ชื่อ (EN)</label>
          <input id="rtat-en" type="text" placeholder="National Park Fee" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff"></div>
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">ชื่อ (TH)</label>
          <input id="rtat-th" type="text" placeholder="ค่าอุทยาน" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">รูปแบบราคา</label>
          <select id="rtat-model" style="width:100%;height:32px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:6px;padding:2px 6px;background:#fff">
            <option value="perPax">ต่อคน (Adult / Child)</option>
            <option value="flat">ราคาเดียว (Flat)</option>
          </select></div>
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">หน่วย (unit)</label>
          <input id="rtat-unit" type="text" placeholder="per pax" style="width:100%;height:32px;font-size:12px;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff"></div>
      </div>
      <button onclick="rtAddonTypeCreate()" style="background:var(--fd-coral,#ff6b47);color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:8px 16px;border-radius:8px;cursor:pointer">สร้างชนิด</button>
    </div>`;
}
function rtAddonTypeCreate(){
  const en=(document.getElementById('rtat-en').value||'').trim();
  const th=(document.getElementById('rtat-th').value||'').trim();
  const model=document.getElementById('rtat-model').value;
  const unit=(document.getElementById('rtat-unit').value||'').trim() || (model==='flat'?'per trip':'per pax');
  if(!en){ alert('Please enter the English name'); return; }
  let key = en.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,24) || ('addon_'+Date.now());
  const used = new Set([...RT_ADDON_BUILTIN.map(d=>d.key), ...SB_ADDON_TYPES.map(c=>c.key)]);
  if(used.has(key)){ let i=2; while(used.has(key+'_'+i)) i++; key=key+'_'+i; }
  SB_ADDON_TYPES.push({ key, label:{en, th:th||en}, model, unit, builtin:false });
  sbAddonTypesPersist();
  rtRebuildAddonDefs();
  rtAddonTypesRenderBody();
}
function rtAddonTypeDelete(key){
  if(!confirm('Delete this add-on type? Existing prices in rate types are kept but hidden.')) return;
  SB_ADDON_TYPES = SB_ADDON_TYPES.filter(c=>c.key!==key);
  sbAddonTypesPersist();
  rtRebuildAddonDefs();
  rtAddonTypesRenderBody();
}

function rtBuildDetailBody(rt){
  // Pure builder · returns § 1 Seat / § 2 Charter / § 3 Add-on detail HTML for a Rate Type.
  // Shared by rtRenderDetail (Rate Type page) and agTabPrices (Agent · Pricing Matrix).
  if(!rt) return '';
  const nRoutes = (rt.routes||[]).length;
  const ROUTES_ARR = (typeof ROUTES !== 'undefined' && ROUTES) || [];
  const rName = (rId) => (ROUTES_ARR.find(r => r.id === rId) || {}).name || rId;
  const fmt = (n) => (n||0).toLocaleString();

  // Seat rates — Balance Sheet style · ruled rows, per-route Start/End (source of truth)
  // Also collect Bundle footnotes (¹ ² ³ ...) for routes with bundled longtail
  const ZONES = ['PK','KL','NoTransfer'];
  const PAX = (typeof rtNatPax==='function') ? rtNatPax(rtNatScopeOf(rt)) : ['adult-thai','child-thai','adult-fr','child-fr'];   // §nationality scope · hide TH or FR columns
  const NC = rtNatCols(PAX);   // §rtNatCols · หัวตารางงอกจากชุดเดียวกับตัวตาราง
  const TH_FG = '#143F73';   // header text · Thai
  const FR_FG = '#854F0B';   // header text · Foreigner
  const _rv = rt.routeValidity || {};
  const _rb = rt.routeBundles || {};
  const SUPER = ['¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹'];
  let seatRows = '';
  const bundleFootnotes = [];   // [{n, rId, text}]
  (rt.routes||[]).forEach(rId => {
    const rr = rt.seatRates && rt.seatRates[rId];
    if(!rr) return;
    const rv = _rv[rId] || {};
    const vFrom = rv.from ? _rtFmtDate(rv.from) : '<span style="color:#9b9590">—</span>';
    const vTo   = rv.to   ? _rtFmtDate(rv.to)   : '<span style="color:#9b9590">—</span>';
    // Bundle footnote — ¹ next to route name if longtail bundle present
    const bundle = (_rb[rId] && _rb[rId].longtail) || null;
    let footMark = '';
    if(bundle){
      const n = bundleFootnotes.length;
      const mark = SUPER[n] || ('('+(n+1)+')');
      footMark = `<span style="color:#A8773B;font-weight:700;margin-left:3px" title="Bundled longtail · see footnote">${mark}</span>`;
      const detail = bundle.mode === 'paid'
        ? `+฿${fmt(bundle.adult)} / adult, +฿${fmt(bundle.child)} / child (built into seat price)`
        : 'free · no extra charge';
      bundleFootnotes.push({ mark, rId, text: `${rName(rId)} includes Longtail Join — ${detail}` });
    }
    ZONES.forEach((z,zi) => {
      const cell = rr[z];
      const isNotOffered = cell === null;     // explicit "Not Offered" marker
      const isMissing    = cell === undefined; // never defined · also treat as N/A
      const isOffered    = !!cell;             // has rate object
      const rowTop = zi===0 ? 'border-top:1px solid #E0DED8' : 'border-top:1px solid #F2F0EA';
      seatRows += `<tr style="${rowTop}${(isNotOffered||isMissing)?';background:#FBE4E018':''}">
        ${zi===0
          ? `<td rowspan="3" style="padding:10px 14px 10px 0;vertical-align:top;font-size:12px;font-weight:600;color:#0F1419;line-height:1.3">${rName(rId)}${footMark}</td>`
          : ''}
        <td style="padding:6px 12px;font-size:10px;color:${(isNotOffered||isMissing)?'#C44A36':'#5F5E5A'};text-transform:uppercase;letter-spacing:.06em;font-weight:600">${z==='NoTransfer'?'No transfer':z}</td>
        ${isOffered
          ? PAX.map((p,pi) => `<td style="padding:6px 12px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419;${pi===NC.lastTh?'padding-right:24px;':''}${pi===NC.firstFr&&NC.th.length?'border-left:1px solid #F2F0EA;':''}">${fmt(cell[p])}</td>`).join('')
          : `<td colspan="${PAX.length}" style="padding:6px 12px;text-align:center;font-size:10px;color:#C44A36;font-weight:700;letter-spacing:.06em;text-transform:uppercase"><span style="background:#FBE4E0;color:#C44A36;padding:2px 9px;border-radius:3px;font-size:9px;letter-spacing:.05em">${isNotOffered?'No Offer':'Not Set'}</span></td>`}
        ${zi===0
          ? `<td rowspan="3" style="padding:10px 12px;vertical-align:top;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#5F5E5A;border-left:1px solid #F2F0EA">${vFrom}</td>
             <td rowspan="3" style="padding:10px 0 10px 12px;vertical-align:top;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#5F5E5A">${vTo}</td>`
          : ''}
      </tr>`;
    });
  });

  // Build footnote block (rendered just under the seat rates table)
  const bundleFootnotesHtml = bundleFootnotes.length
    ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #E0DED8">
        ${bundleFootnotes.map(f => `<div style="font-size:10.5px;color:#5F5E5A;line-height:1.6"><span style="color:#A8773B;font-weight:700;margin-right:6px">${f.mark}</span>${f.text}</div>`).join('')}
       </div>`
    : '';

  // Charter rates — Balance Sheet style · validity INHERITED from § 1 routeValidity
  let charterRows = '';
  const dash = '<span style="color:#9b9590">—</span>';
  Object.keys(rt.charterRates||{}).forEach(rId => {
    const cr = rt.charterRates[rId];
    Object.keys(cr).forEach(bt => {
      const ch = cr[bt];
      const inc = ch.starterIncludes || 4;
      const rv = _rv[rId] || {};
      const vFrom = rv.from ? _rtFmtDate(rv.from) : dash;
      const vTo   = rv.to   ? _rtFmtDate(rv.to)   : dash;
      charterRows += `<tr style="border-top:1px solid #F2F0EA">
        <td style="padding:9px 0;font-size:12px;font-weight:500;color:#0F1419;line-height:1.3">${rName(rId)}</td>
        <td style="padding:9px 12px;font-size:11px;color:#5F5E5A;text-transform:capitalize">${bt}</td>
        <td style="padding:9px 12px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:#0F1419">${fmt(ch.starterPrice)}</td>
        <td style="padding:9px 12px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:#5F5E5A">${inc} pax</td>
        <td style="padding:9px 12px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:#0F1419">+${fmt(ch.extraPerPax)}</td>
        <td style="padding:9px 12px;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#9b9590;border-left:1px solid #F2F0EA" title="Inherited from § 1 Seat rates">${vFrom}</td>
        <td style="padding:9px 0 9px 12px;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums;color:#9b9590" title="Inherited from § 1 Seat rates">${vTo}</td>
      </tr>`;
    });
  });

  // Add-ons — Balance Sheet style · ruled sub-sections, no cards/chrome
  const ao = rt.addOns||{};
  const _present = (typeof RT_ADDON_DEFS!=='undefined'?RT_ADDON_DEFS:[]).filter(def => def.detailPresent && def.detailPresent(rt));
  const addOnSections = _present.map((def, i) => def.detail(rt, i+1)).filter(Boolean);

  return `
    <!-- § 1 · Seat rates · Balance Sheet style -->
    <div style="padding:14px 26px 8px">
      <div style="margin-bottom:12px;padding:14px 0 10px;border-top:2px solid #1A2B43;border-bottom:1px solid #E0DED8">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:22px;padding:0 9px;background:#1A2B43;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;border-radius:3px;font-variant-numeric:tabular-nums">§ 1</span>
          <span style="font-size:15px;font-weight:700;color:#0F1419;letter-spacing:-0.01em">Seat rates</span>
          <span style="font-size:11px;color:#7a7770">per pax · THB · ${nRoutes} route${nRoutes!==1?'s':''}</span>
        </div>
      </div>
      ${seatRows ? `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup>
          <col style="width:22%"><col style="width:10%">
          ${PAX.map(()=>'<col>').join('')}
          <col style="width:10%"><col style="width:10%">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2" style="padding:8px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Route</th>
            <th rowspan="2" style="padding:8px 12px;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Zone</th>
            ${NC.th.length?`<th colspan="${NC.th.length}" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:${TH_FG};letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid ${TH_FG}">Thai</th>`:''}
            ${NC.fr.length?`<th colspan="${NC.fr.length}" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:${FR_FG};letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid ${FR_FG};${NC.th.length?'border-left:1px solid #F2F0EA;':''}">Foreigner</th>`:''}
            <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #C8C6BF;border-left:1px solid #F2F0EA">Active period</th>
          </tr>
          <tr>
            ${PAX.map((p,pi)=>`<th style="padding:5px ${pi===NC.lastTh?'24px':'12px'} 5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em;${pi===NC.firstFr&&NC.th.length?'border-left:1px solid #F2F0EA;':''}">${NC.lbl(p)}</th>`).join('')}
            <th style="padding:5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em;border-left:1px solid #F2F0EA">Start</th>
            <th style="padding:5px 0 5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em">End</th>
          </tr>
        </thead>
        <tbody>${seatRows}</tbody>
      </table>${bundleFootnotesHtml}` : '<div style="padding:14px 0;color:#9b9590;font-size:11px;font-style:italic">ยังไม่มี seat rate</div>'}
    </div>

    <!-- § 2 · Charter rates · Balance Sheet -->
    <div style="padding:14px 26px 8px">
      <div style="margin-bottom:12px;padding:14px 0 10px;border-top:2px solid #1A2B43;border-bottom:1px solid #E0DED8">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:22px;padding:0 9px;background:#1A2B43;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;border-radius:3px;font-variant-numeric:tabular-nums">§ 2</span>
          <span style="font-size:15px;font-weight:700;color:#0F1419;letter-spacing:-0.01em">Charter rates</span>
          <span style="font-size:11px;color:#7a7770">starter + marginal per pax · THB · flexible at booking</span>
        </div>
      </div>
      ${charterRows ? `<table style="width:100%;border-collapse:collapse">
        <colgroup>
          <col style="width:26%"><col style="width:12%"><col><col><col><col style="width:12%"><col style="width:12%">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2" style="padding:8px 0;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Route</th>
            <th rowspan="2" style="padding:8px 12px;text-align:left;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Vessel</th>
            <th rowspan="2" style="padding:8px 12px;text-align:right;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Starter price</th>
            <th rowspan="2" style="padding:8px 12px;text-align:right;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Includes</th>
            <th rowspan="2" style="padding:8px 12px;text-align:right;font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;vertical-align:bottom">Marginal / pax</th>
            <th colspan="2" style="padding:6px 12px;text-align:center;font-size:10px;font-weight:700;color:#5F5E5A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #C8C6BF;border-left:1px solid #F2F0EA">Active period <span style="font-size:8.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#9b9590;margin-left:4px">inherited · § 1</span></th>
          </tr>
          <tr>
            <th style="padding:5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em;border-left:1px solid #F2F0EA">Start</th>
            <th style="padding:5px 0 5px 12px;text-align:right;font-size:9px;font-weight:600;color:#5F5E5A;letter-spacing:.04em">End</th>
          </tr>
        </thead>
        <tbody>${charterRows}</tbody>
      </table>` : '<div style="padding:14px 0;color:#9b9590;font-size:11px;font-style:italic">Rate Type นี้ยังไม่มี charter rate</div>'}
    </div>

    <!-- § 3 · Add-on services -->
    ${addOnSections.length ? `
      <div style="padding:14px 26px 0">
        <div style="margin-bottom:0;padding:14px 0 10px;border-top:2px solid #1A2B43;border-bottom:1px solid #E0DED8">
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:22px;padding:0 9px;background:#1A2B43;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;border-radius:3px;font-variant-numeric:tabular-nums">§ 3</span>
            <span style="font-size:15px;font-weight:700;color:#0F1419;letter-spacing:-0.01em">Add-on services</span>
            <span style="font-size:11px;color:#7a7770">optional ancillary services · ${addOnSections.length} category</span>
          </div>
        </div>
      </div>
      ${addOnSections.join('')}
    ` : `
      <div style="padding:14px 26px 14px">
        <div style="margin-bottom:10px;padding:14px 0 10px;border-top:2px solid #1A2B43;border-bottom:1px solid #E0DED8">
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:22px;padding:0 9px;background:#1A2B43;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;border-radius:3px;font-variant-numeric:tabular-nums">§ 3</span>
            <span style="font-size:15px;font-weight:700;color:#0F1419;letter-spacing:-0.01em">Add-on services</span>
          </div>
        </div>
        <div style="padding:8px 0;color:#9b9590;font-size:11px;font-style:italic">Rate Type นี้ไม่มี add-on</div>
      </div>
    `}
  `;
}

function rtRenderDetail(rtId){
  const rt = getRateType(rtId);
  const det = document.getElementById('rt-detail');
  if(!det) return;
  if(!rt){
    det.innerHTML = '<div class="sb-empty">เลือก Rate Type จากเมนูด้านซ้ายเพื่อดูรายละเอียดและราคา</div>';
    return;
  }

  const tint = rt.color + '14';
  const nUsing = (SB_AGENTS||[]).filter(a => a.rateTypeId === rt.id).length;
  const nRoutes = (rt.routes||[]).length;
  const nCharter = Object.keys(rt.charterRates||{}).length;
  const nAddOns = Object.keys(rt.addOns||{}).length;
  // (seat/charter/add-on detail delegated to rtBuildDetailBody)

  // Agents using this rate type — interactive (click to unbind) + bulk-manage button
  const usingAgents = (SB_AGENTS||[]).filter(a => a.rateTypeId === rt.id);
  const agentsHtml = usingAgents.length
    ? usingAgents.map(a => `<span style="background:${tint};border:1px solid ${rt.color}33;padding:4px 4px 4px 10px;border-radius:8px;font-size:10.5px;color:${rt.color};font-weight:600;display:inline-flex;align-items:center;gap:5px">
        <span style="font-variant-numeric:tabular-nums;font-size:9.5px;opacity:.7">${a.code}</span>
        <span>${a.name}</span>
        <button onclick="rtUnbindAgent('${a.id}','${rt.id}', event)" title="ปลด agent นี้ออกจาก rate type" style="background:transparent;border:none;color:${rt.color};cursor:pointer;font-size:11px;padding:1px 5px;border-radius:5px;line-height:1;opacity:.7">✕</button>
      </span>`).join('')
    : `<span style="font-size:10.5px;color:var(--fd-ink-soft);font-style:italic">ยังไม่มี agent ผูกกับ rate type นี้</span>`;

  const vs = _rtValidityStatus(rt);
  const vBg = {active:'#E1F5EE',expiring:'#FFF5EB',expired:'#FDECEA',upcoming:'#E6F1FB',always:'#F1EFE8'}[vs.state];
  const vFg = {active:'#0F6E56',expiring:'#854F0B',expired:'#A32D2D',upcoming:'#0C447C',always:'#5F5E5A'}[vs.state];
  const validityChip = (rt.validFrom||rt.validTo)
    ? `<span style="background:${vBg};color:${vFg};padding:4px 11px;border-radius:999px;font-size:10.5px;font-weight:600"><span style="opacity:.8;text-transform:uppercase;letter-spacing:.04em;font-size:9.5px">${vs.label}</span> · ${_rtFmtDate(rt.validFrom)||'—'} → ${_rtFmtDate(rt.validTo)||'—'}</span>`
    : `<span style="background:${vBg};color:${vFg};padding:4px 11px;border-radius:999px;font-size:10.5px;font-weight:600">${vs.label}</span>`;

  det.innerHTML = `
    <!-- Header -->
    <div style="padding:18px 22px 14px;border-bottom:1px solid var(--fd-line-soft)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          <span style="background:${tint};color:${rt.color};font-size:10px;font-weight:700;padding:4px 10px;border-radius:8px;font-variant-numeric:tabular-nums;letter-spacing:.02em">${rt.code}</span>
          <div style="font-size:17px;font-weight:600;letter-spacing:-.015em;color:var(--fd-ink);${rt.active===false?'opacity:.6':''}">${rt.name}</div>
          ${rt.active===false?'<span style="background:#F1EFE8;color:#5F5E5A;font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:7px;letter-spacing:.06em;text-transform:uppercase">Inactive</span>':''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="rtToggleActive('${rt.id}', event)" title="${rt.active===false?'Activate':'Deactivate'}" style="background:${rt.active===false?'#fff':'#E1F5EE'};color:${rt.active===false?'#5F5E5A':'#0F6E56'};border:1px solid ${rt.active===false?'var(--fd-line)':'#9FE1CB'};font-family:inherit;font-size:10.5px;font-weight:600;padding:5px 11px;border-radius:8px;cursor:pointer">${rt.active===false?'Activate':'Deactivate'}</button>
          <button onclick="rtOpenEdit('${rt.id}')" style="background:${rt.color};color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:5px 13px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button onclick="rtClone('${rt.id}')" title="Clone this rate type into a new one" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:11px;font-weight:600;padding:5px 13px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Clone
          </button>
          <button onclick="rtOpenAgentPicker('${rt.id}')" title="Manage agents bound to this rate type" style="background:#fff;border:1px solid ${rt.color};color:${rt.color};font-family:inherit;font-size:11px;font-weight:600;padding:5px 13px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Manage agents <span style="background:${tint};color:${rt.color};padding:1px 6px;border-radius:6px;font-size:9.5px;font-weight:700;font-variant-numeric:tabular-nums;margin-left:2px">${nUsing}</span>
          </button>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--fd-ink-soft);line-height:1.55">${rt.note||''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        ${validityChip}
        ${(function(){ const oid=_rtOwnerId(rt); const olbl=_rtOwnerLabel(rt); const isAdmin=(typeof laIsAdmin==='function'&&laIsAdmin());
          if(isAdmin){ const opts=['<option value="">Shared · กลาง</option>'].concat((typeof SB_SALES!=='undefined'?SB_SALES:[]).map(s=>`<option value="${s.id}" ${oid===s.id?'selected':''}>${s.name||s.id}</option>`)).join('');
            return `<span style="background:#F3F0FB;color:#5B289A;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px">เจ้าของ <select onchange="rtSetOwner('${rt.id}',this.value)" style="border:1px solid #D8CBEF;border-radius:6px;padding:2px 6px;font-size:10.5px;font-family:inherit;background:#fff;color:#5B289A;font-weight:600">${opts}</select></span>`; }
          return `<span style="background:#F3F0FB;color:#5B289A;padding:4px 11px;border-radius:999px;font-size:10.5px;font-weight:600">เจ้าของ: ${olbl}</span>`;
        })()}
        <span style="background:#fafaf8;padding:4px 11px;border-radius:999px;font-size:10.5px;color:var(--fd-ink);font-weight:500">Seat rates · ${nRoutes} routes</span>
        ${nCharter>0?`<span style="background:${tint};color:${rt.color};padding:4px 11px;border-radius:999px;font-size:10.5px;font-weight:600">Charter · ${nCharter} routes</span>`:''}
        ${nAddOns>0?`<span style="background:#fafaf8;padding:4px 11px;border-radius:999px;font-size:10.5px;color:var(--fd-ink);font-weight:500">Add-ons · ${nAddOns}</span>`:''}
      </div>
      <!-- Agent name strip — collapsed by default (long lists were taking over the header) · click to expand -->
      <details style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--fd-line-soft)">
        <summary style="cursor:pointer;font-size:9.5px;color:var(--fd-ink-faint);text-transform:uppercase;letter-spacing:.06em;font-weight:700;user-select:none">Agents · ${usingAgents.length} <span style="color:var(--fd-ink-soft);font-weight:600;text-transform:none;letter-spacing:0">(click to show / hide)</span></summary>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">${agentsHtml}</div>
      </details>
    </div>

    ${rtBuildDetailBody(rt)}

    <div style="padding:0 22px 14px"></div>
  `;
}

function rtOpenAgentPicker(rtId){
  const rt = getRateType(rtId);
  if(!rt) return;
  _rtAgentPickerRtId = rtId;
  _rtAgentPickerSelected = new Set((SB_AGENTS||[]).filter(a => a.rateTypeId === rtId && ((typeof laAgentInScope!=='function')||laAgentInScope(a))).map(a => a.id));   // §sales scope · นับเฉพาะ agent ในสิทธิ์
  _rtAgentPickerQuery = '';
  _rtAgentPickerResetScroll = true;
  document.getElementById('rt-agent-picker').style.display = 'flex';
  rtAgentPickerRender();
}

function rtAgentPickerClose(){
  document.getElementById('rt-agent-picker').style.display = 'none';
  _rtAgentPickerRtId = null;
}

function rtAgentPickerToggle(agentId){
  if(_rtAgentPickerSelected.has(agentId)) _rtAgentPickerSelected.delete(agentId);
  else _rtAgentPickerSelected.add(agentId);
  rtAgentPickerRender(true);
}

function rtAgentPickerToggleGroup(market, agentIds){
  // If all in group already selected → unselect all; else select all
  const allSelected = agentIds.every(id => _rtAgentPickerSelected.has(id));
  if(allSelected) agentIds.forEach(id => _rtAgentPickerSelected.delete(id));
  else agentIds.forEach(id => _rtAgentPickerSelected.add(id));
  rtAgentPickerRender(true);
}

function rtAgentPickerSearch(q){ _rtAgentPickerQuery = (q||'').toLowerCase(); _rtAgentPickerResetScroll = true; rtAgentPickerRender(true); }

function rtAgentPickerApply(){
  const rtId = _rtAgentPickerRtId;
  if(!rtId) return;
  // For each agent: if selected → set rateTypeId=rtId; if unselected → only unbind if currently bound to this rt
  let bound = 0, unbound = 0;
  (SB_AGENTS||[]).forEach(a => {
    if(typeof laAgentInScope==='function' && !laAgentInScope(a)) return;   // §sales scope · ห้ามแตะ agent ของเซลล์อื่น (กันเผลอ unbind ตอน apply)
    const wantBound = _rtAgentPickerSelected.has(a.id);
    const isBoundHere = a.rateTypeId === rtId;
    if(wantBound && !isBoundHere){ a.rateTypeId = rtId; bound++; }
    else if(!wantBound && isBoundHere){ a.rateTypeId = null; unbound++; }
  });
  rtPersist();
  rtAgentPickerClose();
  rtRenderCards();
  rtRenderDetail(rtId);
  if(_rtViewMode === 'agents') rtRenderAgentColumn(rtId);
  // Toast-like console log (ASCII-safe per CLAUDE.md)
  console.log('[Rate Type] Bulk assign:', {bound, unbound, total:_rtAgentPickerSelected.size});
}

// listOnly · repaint just the agent list + the three live counters. The search box and the modal
// chrome are left untouched, so typing keeps the caret and the list keeps its scroll position.
// Only rtOpenAgentPicker builds the whole modal.
function rtAgentPickerRender(listOnly){
  const rtId = _rtAgentPickerRtId;
  if(!rtId) return;
  const rt = getRateType(rtId);
  const host = document.getElementById('rt-agent-picker-body');
  if(!host || !rt) return;
  const tint = rt.color + '14';
  const MARKET_LBL = {ru:'Russian',ota:'OTA',ap:'Asia Pacific',hpk:'Hotel Phuket',hkl:'Hotel Khao Lak',cpk:'Counter Phuket',ckl:'Counter Khao Lak',ww:'World Wide'};
  const allAgents = (SB_AGENTS||[]).filter(a => (typeof laAgentInScope!=='function')||laAgentInScope(a));   // §sales scope · เซลล์เห็น/จัดการเฉพาะ agent ของตัวเอง (admin เห็นหมด)
  const q = _rtAgentPickerQuery;
  // Group by market
  const groups = {};
  allAgents.forEach(a => {
    const m = a.market || 'other';
    if(!groups[m]) groups[m] = [];
    // Filter by query
    if(q){
      const blob = (a.code+' '+a.name+' '+(a.sub||'')).toLowerCase();
      if(!blob.includes(q)) return;
    }
    groups[m].push(a);
  });

  const totalSelected = _rtAgentPickerSelected.size;
  const totalAvailable = allAgents.length;
  const conflictCount = allAgents.filter(a => _rtAgentPickerSelected.has(a.id) && a.rateTypeId && a.rateTypeId !== rtId).length;

  const groupOrder = ['ru','ota','ap','hpk','hkl','cpk','ckl','ww','other'];
  const groupsHtml = groupOrder.map(m => {
    const ags = groups[m]; if(!ags || !ags.length) return '';
    const ids = ags.map(a => a.id);
    const allSel = ids.every(id => _rtAgentPickerSelected.has(id));
    const someSel = ids.some(id => _rtAgentPickerSelected.has(id));
    const lbl = MARKET_LBL[m] || m;
    return `<div style="border-top:1px solid var(--fd-line-soft)">
      <div onclick="rtAgentPickerToggleGroup('${m}', ${JSON.stringify(ids).replace(/"/g,'&quot;')})" style="padding:8px 14px;background:#fafaf8;display:flex;align-items:center;justify-content:space-between;cursor:pointer">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:14px;height:14px;border:1.5px solid ${allSel?rt.color:'var(--fd-line)'};background:${allSel?rt.color:'#fff'};border-radius:3px;display:inline-flex;align-items:center;justify-content:center">
            ${allSel?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':(someSel?'<span style="width:7px;height:2px;background:'+rt.color+';border-radius:1px"></span>':'')}
          </span>
          <span style="font-size:11.5px;font-weight:600;color:var(--fd-ink)">${lbl}</span>
          <span style="font-size:10px;color:var(--fd-ink-soft);font-variant-numeric:tabular-nums">${ids.filter(id=>_rtAgentPickerSelected.has(id)).length}/${ids.length}</span>
        </div>
        <span style="font-size:10px;color:var(--fd-ink-soft)">click to toggle all</span>
      </div>
      ${ags.map(a => {
        const isSel = _rtAgentPickerSelected.has(a.id);
        const otherRt = a.rateTypeId && a.rateTypeId !== rtId ? getRateType(a.rateTypeId) : null;
        const conflict = isSel && otherRt;
        return `<div onclick="rtAgentPickerToggle('${a.id}')" style="padding:7px 14px 7px 32px;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;border-top:1px solid var(--fd-line-soft);background:${isSel?tint:'#fff'}">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
            <span style="width:14px;height:14px;border:1.5px solid ${isSel?rt.color:'var(--fd-line)'};background:${isSel?rt.color:'#fff'};border-radius:3px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
              ${isSel?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
            </span>
            <span style="font-variant-numeric:tabular-nums;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;flex-shrink:0">${a.code}</span>
            <span style="font-size:11.5px;font-weight:600;color:var(--fd-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.name}</span>
            ${a.sub?`<span style="font-size:9.5px;color:var(--fd-ink-soft);background:#f5f5f5;padding:1px 6px;border-radius:5px">${a.sub}</span>`:''}
          </div>
          ${conflict?`<span style="font-size:9.5px;background:#FFF5EB;color:#854F0B;padding:2px 7px;border-radius:6px;font-weight:600" title="ปัจจุบันผูกกับ ${otherRt.name} — ถ้า apply จะถูกย้ายมาที่ rate type นี้">⚠ moves from ${otherRt.code}</span>`:''}
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  const _emptyHtml = '<div style="padding:24px;text-align:center;color:var(--fd-ink-soft);font-size:12px">ไม่พบ agent ที่ตรงคำค้น</div>';
  const _applyLbl = 'Apply ' + totalSelected + ' agent' + (totalSelected !== 1 ? 's' : '');
  const _conflictHtml = conflictCount > 0
    ? '<span style="color:#854F0B;font-weight:600">⚠ ' + conflictCount + ' agent จะถูกย้ายมาจาก rate type อื่น</span>'
    : 'ไม่มี conflict';

  // §scroll/§focus · in-place repaint. Replacing the list's children still zeroes scrollTop, so
  // capture and restore it; the container element itself survives, and the search input is never
  // re-created, which is what used to force a re-click after every keystroke.
  const _list = document.getElementById('rt-agent-picker-list');
  if(listOnly && _list){
    const _top = _list.scrollTop;
    _list.innerHTML = groupsHtml || _emptyHtml;
    _list.scrollTop = _rtAgentPickerResetScroll ? 0 : _top;
    _rtAgentPickerResetScroll = false;
    const _c = document.getElementById('rt-agent-picker-count');    if(_c) _c.textContent = totalSelected;
    const _f = document.getElementById('rt-agent-picker-conflict'); if(_f) _f.innerHTML = _conflictHtml;
    const _a = document.getElementById('rt-agent-picker-apply');    if(_a) _a.textContent = _applyLbl;
    return;
  }

  host.innerHTML = `
    <div style="padding:16px 22px 12px;border-bottom:1px solid var(--fd-line);background:${tint}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--fd-ink);display:flex;align-items:center;gap:8px">
            Manage agents
            <span style="background:#fff;color:${rt.color};font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:7px;font-variant-numeric:tabular-nums">${rt.code}</span>
            <span style="font-size:13px;color:${rt.color};font-weight:600">${rt.name}</span>
          </div>
          <div style="font-size:11px;color:var(--fd-ink-soft);margin-top:3px">ติ๊ก agent ที่ต้องการให้ใช้ rate type นี้ · ติ๊กออก = ปลดออกจาก rate type</div>
        </div>
        <button onclick="rtAgentPickerClose()" aria-label="close" style="background:transparent;border:none;font-size:18px;color:var(--fd-ink-soft);cursor:pointer;padding:4px 8px;line-height:1">✕</button>
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
        <input id="rt-agent-picker-search" placeholder="ค้นหา agent · code / name / sub..." value="${q.replace(/"/g,'&quot;')}" oninput="rtAgentPickerSearch(this.value)" style="flex:1;height:32px;font-size:11.5px;font-family:inherit;border:1px solid var(--fd-line);border-radius:7px;padding:4px 10px;background:#fff">
        <span style="font-size:10.5px;color:var(--fd-ink-soft);white-space:nowrap"><span id="rt-agent-picker-count" style="color:${rt.color};font-weight:700">${totalSelected}</span> / ${totalAvailable} selected</span>
      </div>
    </div>
    <div id="rt-agent-picker-list" style="max-height:55vh;overflow-y:auto;background:#fff">${groupsHtml || '<div style="padding:24px;text-align:center;color:var(--fd-ink-soft);font-size:12px">ไม่พบ agent ที่ตรงคำค้น</div>'}</div>
    <div style="padding:12px 22px;display:flex;align-items:center;justify-content:space-between;background:#fafaf8">
      <div id="rt-agent-picker-conflict" style="font-size:10.5px;color:var(--fd-ink-soft)">
        ${conflictCount>0?'<span style="color:#854F0B;font-weight:600">⚠ '+conflictCount+' agent จะถูกย้ายมาจาก rate type อื่น</span>':'ไม่มี conflict'}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="rtAgentPickerClose()" style="font-family:inherit;font-size:11.5px;font-weight:500;background:transparent;border:1px solid var(--fd-line);color:var(--fd-ink);padding:7px 14px;border-radius:8px;cursor:pointer">Cancel</button>
        <button id="rt-agent-picker-apply" onclick="rtAgentPickerApply()" style="font-family:inherit;font-size:11.5px;font-weight:600;background:${rt.color};color:#fff;border:none;padding:7px 18px;border-radius:8px;cursor:pointer">Apply ${totalSelected} agent${totalSelected!==1?'s':''}</button>
      </div>
    </div>
  `;

  _rtAgentPickerResetScroll = false;
}

function rtUnbindAgent(agentId, rtId, ev){
  if(ev){ ev.stopPropagation(); }
  const a = (SB_AGENTS||[]).find(x => x.id === agentId);
  if(!a) return;
  if(!confirm('ปลด '+(a.name||a.code)+' ออกจาก rate type นี้?')) return;
  a.rateTypeId = null;
  rtPersist();
  rtRenderCards();
  rtRenderDetail(rtId);
  if(_rtViewMode === 'agents') rtRenderAgentColumn(rtId);
  if(typeof agRenderDetail==='function' && typeof _agSelected!=='undefined' && _agSelected===agentId) agRenderDetail(agentId);
}
function rtSetTier(t){ _rtTier = RT_TIERS.some(x=>x.k===t) ? t : 'net'; rtModalRender(); }
// §คัดลอกราคา Net → ชั้นที่เปิดอยู่ (Selling / Min sell) ทุกช่อง · กันพิมพ์ซ้ำทั้งตาราง
function rtCopyNetToTier(){
  if(_rtTier==='net' || !_rtDraft) return;
  const tier=_rtTier, tl=(RT_TIERS.find(t=>t.k===tier)||{}).l||tier;
  const ZONES=['PK','KL','NoTransfer'];
  const scope=(_rtDraft.nationalityScope)||'both';
  const PAX=(typeof rtNatPax==='function')?rtNatPax(scope):['adult-thai','child-thai','adult-fr','child-fr'];
  if(!confirm('คัดลอกราคา Net มาที่ชั้น "'+tl+'" ทุกช่อง?\n(ค่าที่กรอกไว้ในชั้นนี้จะถูกทับ)')) return;
  _rtDraft.priceTiers=_rtDraft.priceTiers||{};
  (_rtDraft.routes||[]).forEach(rId=>{
    const net=_rtDraft.seatRates&&_rtDraft.seatRates[rId]; if(!net) return;
    ZONES.forEach(z=>{ if(!net[z]) return;
      PAX.forEach(p=>{ const v=net[z][p]; if(v===undefined||v===null) return;
        _rtDraft.priceTiers[rId]=_rtDraft.priceTiers[rId]||{};
        _rtDraft.priceTiers[rId][z]=_rtDraft.priceTiers[rId][z]||{};
        _rtDraft.priceTiers[rId][z][p]=_rtDraft.priceTiers[rId][z][p]||{};
        _rtDraft.priceTiers[rId][z][p][tier]=v;
      });
    });
  });
  rtModalRender();
}
function _rtTierGet(d, rId, z, p){
  if(_rtTier==='net'){ const c = d.seatRates && d.seatRates[rId] && d.seatRates[rId][z]; return c ? c[p] : undefined; }
  const c = d.priceTiers && d.priceTiers[rId] && d.priceTiers[rId][z] && d.priceTiers[rId][z][p];
  return c ? c[_rtTier] : undefined;
}
function _rtTierPath(rId, z, p){
  return (_rtTier==='net') ? ('seatRates.'+rId+'.'+z+'.'+p) : ('priceTiers.'+rId+'.'+z+'.'+p+'.'+_rtTier);
}

function _rtCloneDeep(o){ return JSON.parse(JSON.stringify(o)); }

function rtOpenEdit(rtId){
  const rt = getRateType(rtId);
  if(!rt) return;
  _rtDraft = _rtCloneDeep(rt);
  _rtDraftIsNew = false;
  rtModalRender();
  document.getElementById('rt-modal').style.display = 'flex';
}

function rtClone(rtId){
  const rt = getRateType(rtId);
  if(!rt) return;
  _rtDraft = _rtCloneDeep(rt);
  _rtDraft.id = LA_UID('rt');
  _rtDraft.code = (rt.code || 'RT') + '-COPY';
  _rtDraft.name = (rt.name || 'Rate Type') + ' (copy)';
  _rtDraft.createdDate = new Date().toISOString().slice(0,10);
  _rtDraft.owner = (typeof laMySalesId==='function' ? (laMySalesId()||'') : '');   // §clone = สร้างใหม่ → เจ้าของ = คนกด clone
  _rtDraft.active = true;
  _rtDraftIsNew = true;   // saving pushes a NEW rate type · original untouched · agents NOT auto-bound
  rtModalRender();
  document.getElementById('rt-modal').style.display = 'flex';
}

function rtOpenNew(){
  _rtDraft = {
    id: (typeof LA_UID==='function' ? LA_UID('rt') : 'rt'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),   // §multi-user unique · เดิม 'rt'+timestamp 6 หลัก → ชนกันได้ (ทับ rate เดิม เช่น Standard Tier 1)
    code: '', name: '', note: '',
    color: RT_COLORS[Math.floor(Math.random()*RT_COLORS.length)],
    createdDate: new Date().toISOString().slice(0,10),
    owner: (typeof laMySalesId==='function' ? (laMySalesId()||'') : ''),   // §เจ้าของ = คนสร้าง (admin/ไม่ผูกเซลล์ = '' = Shared)
    validFrom: '', validTo: '',
    routes: [],
    seatRates: {},
    /* §ราคา 3 ชั้น (2026-07-14) · สัญญาของเอเยนต์ (และของคู่แข่งอย่าง Sawanu) ระบุ 3 ราคาเสมอ:
       Selling = ราคาที่เอเยนต์ควรขายลูกค้า · Min sell = ขายต่ำกว่านี้ไม่ได้ · Net = ที่เอเยนต์จ่ายเรา
       seatRates คือ NET และเป็นตัวเดียวที่ระบบคิดเงินใช้ — ห้ามแตะโครงมัน (ตารางแบน 12 คอลัมน์ใน DB)
       อีก 2 ชั้นอยู่ที่นี่ก้อนเดียว เก็บเป็น json_text คอลัมน์เดียว → ไม่มีตารางใหม่ ไม่แตะการคิดเงิน
       rt ที่ยังไม่มี priceTiers = ช่อง Selling/Min sell ว่าง · สัญญาพิมพ์ "—" ไม่พัง             */
    priceTiers: {},
    routeValidity: {},
    routeBundles: {},
    charterRates: {},
    addOns: {}
  };
  _rtDraftIsNew = true;
  rtModalRender();
  document.getElementById('rt-modal').style.display = 'flex';
}

function rtModalClose(){
  document.getElementById('rt-modal').style.display = 'none';
  _rtDraft = null;
}

function rtDraftSet(path, value){
  // Dot path setter: e.g. "name", "seatRates.r5.PK.adult-thai"
  const parts = path.split('.');
  let cur = _rtDraft;
  for(let i=0;i<parts.length-1;i++){
    if(!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length-1]] = value;
  rtModalUpdateSummary();
}

// Mark a zone as Not Offered for a route (or restore it)
// Stores `seatRates[rId][zone] = null` to signal explicitly · pricing engine treats null/missing as noRate
function rtToggleZoneNotOffered(rId, zone){
  if(!_rtDraft.seatRates) _rtDraft.seatRates = {};
  if(!_rtDraft.seatRates[rId]) _rtDraft.seatRates[rId] = {};
  const cur = _rtDraft.seatRates[rId][zone];
  if(cur === null){
    // Restore · re-enable with empty rates (user fills in)
    _rtDraft.seatRates[rId][zone] = {'adult-thai':0,'child-thai':0,'adult-fr':0,'child-fr':0,'infant-thai':0,'infant-fr':0};
  } else {
    // Mark as Not Offered
    _rtDraft.seatRates[rId][zone] = null;
  }
  rtModalRender();
}

// Bundle Longtail per route (§ 1 · forces longtail-join into the seat package)
function rtToggleBundleLongtail(rId, enabled){
  if(!_rtDraft.routeBundles) _rtDraft.routeBundles = {};
  if(enabled){
    if(!_rtDraft.routeBundles[rId]) _rtDraft.routeBundles[rId] = {};
    _rtDraft.routeBundles[rId].longtail = { mode:'free', adult:0, child:0, applyTo:'seat' };
  } else {
    if(_rtDraft.routeBundles[rId]) delete _rtDraft.routeBundles[rId].longtail;
    if(_rtDraft.routeBundles[rId] && Object.keys(_rtDraft.routeBundles[rId]).length === 0){
      delete _rtDraft.routeBundles[rId];
    }
  }
  rtModalRender();
}

function rtSetBundleMode(rId, mode){
  if(!_rtDraft.routeBundles || !_rtDraft.routeBundles[rId] || !_rtDraft.routeBundles[rId].longtail) return;
  _rtDraft.routeBundles[rId].longtail.mode = mode;
  if(mode === 'free'){
    _rtDraft.routeBundles[rId].longtail.adult = 0;
    _rtDraft.routeBundles[rId].longtail.child = 0;
  }
  rtModalRender();
}
function rtSetBundleApplyTo(rId, val){
  if(!_rtDraft.routeBundles || !_rtDraft.routeBundles[rId] || !_rtDraft.routeBundles[rId].longtail) return;
  _rtDraft.routeBundles[rId].longtail.applyTo = val;
  rtModalRender();
}
// Does a forced Rate-Type bundle apply to a trip of this mode? applyTo: 'seat'(default) | 'charter' | 'both'
function _rtBundleAppliesTo(b, isCharter){ if(!b) return false; var a=b.applyTo||'seat'; return a==='both' || (isCharter ? a==='charter' : a==='seat'); }

function rtDraftToggleRoute(rId){
  _rtDraft.routes = _rtDraft.routes || [];
  if(_rtDraft.routes.includes(rId)){
    _rtDraft.routes = _rtDraft.routes.filter(x => x !== rId);
    // Optional: clean orphaned seat rates (we keep them so user doesn't lose data on toggle)
  } else {
    _rtDraft.routes.push(rId);
    // Seed empty seat rates for new route if missing
    /* §rnZone2 · หว่านโซนตั้งต้นตามท่าของเส้นนั้น · เส้นระนองได้ RN ไม่ใช่ PK/KL */
    if(!_rtDraft.seatRates[rId]){
      const _blank = () => ({'adult-thai':0,'child-thai':0,'adult-fr':0,'child-fr':0,'infant-thai':0,'infant-fr':0});
      const _seed = {};
      rtZonesForRoute(rId).forEach(z => { _seed[z] = _blank(); });
      _rtDraft.seatRates[rId] = _seed;
    }
  }
  rtModalRender();
}

function rtAddCharterRow(){
  const routes = _rtDraft.routes||[];
  if(!routes.length){ alert('Please select at least one route first'); return; }
  if(!_rtDraft.charterRates) _rtDraft.charterRates = {};
  const TYPES = (typeof RT_BOAT_TYPES!=='undefined' && RT_BOAT_TYPES.length) ? RT_BOAT_TYPES : ['speedboat','catamaran','longtail'];
  // §charter add-row · add the first free (route × boat type) slot instead of always overwriting route[0].speedboat (which made a 2nd click a no-op)
  for(const r of routes){ for(const t of TYPES){
    if(!(_rtDraft.charterRates[r] && _rtDraft.charterRates[r][t])){
      if(!_rtDraft.charterRates[r]) _rtDraft.charterRates[r] = {};
      _rtDraft.charterRates[r][t] = {starterPrice:0, starterIncludes:4, extraPerPax:0};
      rtModalRender();
      return;
    }
  }}
  alert('ทุก route x ประเภทเรือ มีแถวครบแล้ว');
  rtModalRender();
}

function rtAddTransferRow(){
  // Legacy: add single route×zone — kept for back-compat. Matrix layout uses rtAddTransferRoute instead.
  const firstRoute = (_rtDraft.routes||[])[0];
  if(!firstRoute){ alert('Please select at least one route first'); return; }
  if(!_rtDraft.addOns) _rtDraft.addOns = {};
  if(!_rtDraft.addOns.privateTransfer) _rtDraft.addOns.privateTransfer = {unit:'per trip'};
  if(!_rtDraft.addOns.privateTransfer[firstRoute]) _rtDraft.addOns.privateTransfer[firstRoute] = {};
  if(!_rtDraft.addOns.privateTransfer[firstRoute]['PK']) _rtDraft.addOns.privateTransfer[firstRoute]['PK'] = {sedan:0, van:0};
  rtModalRender();
}

// Matrix layout helpers — one row per route, both zones pre-init
function rtAddTransferRoute(){
  if(!_rtDraft.addOns) _rtDraft.addOns = {};
  if(!_rtDraft.addOns.privateTransfer) _rtDraft.addOns.privateTransfer = {unit:'per trip'};
  const pt = _rtDraft.addOns.privateTransfer;
  const used = Object.keys(pt).filter(k => k !== 'unit');
  const available = (_rtDraft.routes||[]).filter(r => !used.includes(r));
  const rId = available[0] || (_rtDraft.routes||[])[0];
  if(!rId){ alert('Please select at least one route first'); return; }
  if(!pt[rId]) pt[rId] = {};
  if(!pt[rId]['PK']) pt[rId]['PK'] = {sedan:0, van:0};
  if(!pt[rId]['KL']) pt[rId]['KL'] = {sedan:0, van:0};
  rtModalRender();
}

function rtRemoveTransferRoute(rId){
  const pt = _rtDraft.addOns && _rtDraft.addOns.privateTransfer;
  if(!pt) return;
  delete pt[rId];
  rtModalRender();
}

function rtChangeTransferRouteWhole(oldRid, newRid){
  if(oldRid === newRid) return;
  const pt = _rtDraft.addOns && _rtDraft.addOns.privateTransfer;
  if(!pt || !pt[oldRid]) return;
  if(pt[newRid]){
    // merge: keep new route's zone if exists, else copy from old
    ['PK','KL'].forEach(z => { if(!pt[newRid][z] && pt[oldRid][z]) pt[newRid][z] = pt[oldRid][z]; });
  } else {
    pt[newRid] = pt[oldRid];
  }
  delete pt[oldRid];
  rtModalRender();
}

// Ensure existing data has both zones (auto-fill missing) — used by render
function _rtEnsureBothZones(pt, rId){
  if(!pt[rId]) pt[rId] = {};
  if(!pt[rId]['PK']) pt[rId]['PK'] = {sedan:0, van:0};
  if(!pt[rId]['KL']) pt[rId]['KL'] = {sedan:0, van:0};
}

function rtRemoveTransferRow(rId, zone){
  const pt = _rtDraft.addOns && _rtDraft.addOns.privateTransfer;
  if(!pt || !pt[rId]) return;
  delete pt[rId][zone];
  if(Object.keys(pt[rId]).length === 0) delete pt[rId];
  rtModalRender();
}

function rtChangeTransferRoute(oldRid, zone, newRid){
  if(oldRid === newRid) return;
  const pt = _rtDraft.addOns && _rtDraft.addOns.privateTransfer;
  if(!pt || !pt[oldRid] || !pt[oldRid][zone]) return;
  const data = pt[oldRid][zone];
  if(!pt[newRid]) pt[newRid] = {};
  pt[newRid][zone] = data;
  delete pt[oldRid][zone];
  if(Object.keys(pt[oldRid]).length === 0) delete pt[oldRid];
  rtModalRender();
}

function rtChangeTransferZone(rId, oldZone, newZone){
  if(oldZone === newZone) return;
  const pt = _rtDraft.addOns && _rtDraft.addOns.privateTransfer;
  if(!pt || !pt[rId] || !pt[rId][oldZone]) return;
  pt[rId][newZone] = pt[rId][oldZone];
  delete pt[rId][oldZone];
  rtModalRender();
}

function rtRemoveCharterRow(rId, boatType){
  if(_rtDraft.charterRates[rId]) delete _rtDraft.charterRates[rId][boatType];
  if(_rtDraft.charterRates[rId] && Object.keys(_rtDraft.charterRates[rId]).length===0){
    delete _rtDraft.charterRates[rId];
  }
  rtModalRender();
}

function rtChangeCharterRoute(oldRid, boatType, newRid){
  if(oldRid === newRid) return;
  const data = _rtDraft.charterRates[oldRid] && _rtDraft.charterRates[oldRid][boatType];
  if(!data) return;
  if(!_rtDraft.charterRates[newRid]) _rtDraft.charterRates[newRid] = {};
  _rtDraft.charterRates[newRid][boatType] = data;
  delete _rtDraft.charterRates[oldRid][boatType];
  if(Object.keys(_rtDraft.charterRates[oldRid]).length===0) delete _rtDraft.charterRates[oldRid];
  rtModalRender();
}

function rtChangeCharterBoatType(rId, oldBt, newBt){
  if(oldBt === newBt) return;
  if(!_rtDraft.charterRates[rId]) return;
  _rtDraft.charterRates[rId][newBt] = _rtDraft.charterRates[rId][oldBt];
  delete _rtDraft.charterRates[rId][oldBt];
  rtModalRender();
}

// Normalize longtail data — handles both old shape {adult, child, applies} and new {join, charter, applies}
// Longtail add-on · normalized to a PER-ROUTE map (Option A · 2026-06-13)
//   new shape: { applies:[rIds], byRoute:{ rId:{join:{adult,child}, charter:{price,capacity}} } }
//   old flat shape ({join,charter} or {adult,child}) is migrated by spreading the one price across applies.
//   `join`/`charter` on the result = the FIRST route's price (back-compat for any single-price reader / summary).
function _rtNormalizeLongtail(lt){
  if(!lt) return null;
  const norm = e => ({
    join:    {adult:(e&&e.join&&e.join.adult)||0,   child:(e&&e.join&&e.join.child)||0},
    charter: {price:(e&&e.charter&&e.charter.price)||0, capacity:(e&&e.charter&&e.charter.capacity)||6}
  });
  let applies = Array.isArray(lt.applies) ? lt.applies.slice() : [];
  const byRoute = {};
  if(lt.byRoute && typeof lt.byRoute==='object'){
    Object.keys(lt.byRoute).forEach(rid => byRoute[rid] = norm(lt.byRoute[rid]));
    if(!applies.length) applies = Object.keys(byRoute);
  }
  // flat default (old shape OR first byRoute entry) — used as fallback + single-price compat
  let flat;
  if(lt.join || lt.charter) flat = norm(lt);
  else if(lt.adult!==undefined || lt.child!==undefined) flat = {join:{adult:lt.adult||0,child:lt.child||0}, charter:{price:0,capacity:6}};
  else { const fk = applies[0] || Object.keys(byRoute)[0]; flat = (fk && byRoute[fk]) ? byRoute[fk] : {join:{adult:0,child:0},charter:{price:0,capacity:6}}; }
  // old flat shape with applies but no per-route map → spread the flat price across each applies route
  if(!Object.keys(byRoute).length && applies.length){ applies.forEach(rid => byRoute[rid] = {join:{...flat.join}, charter:{...flat.charter}}); }
  return { applies, byRoute, join: flat.join, charter: flat.charter };
}
// Effective longtail price for a specific route (per-route → flat fallback)
function _rtLongtailForRoute(rt, routeId){
  const lt = _rtNormalizeLongtail(rt && rt.addOns && rt.addOns.longtail);
  if(!lt) return null;
  return lt.byRoute[routeId] || {join:lt.join, charter:lt.charter};
}

function rtToggleAddOn(key, enabled){
  if(!_rtDraft.addOns) _rtDraft.addOns = {};
  if(enabled){
    const def = (typeof RT_ADDON_DEFS!=='undefined'?RT_ADDON_DEFS:[]).find(d => d.key === key);
    if(def && def.init) _rtDraft.addOns[key] = def.init(_rtDraft);
  } else {
    delete _rtDraft.addOns[key];
  }
  rtModalRender();
}

function rtToggleAddOnRoute(addOnKey, rId){
  const ao = _rtDraft.addOns[addOnKey];
  if(!ao) return;
  ao.applies = ao.applies || [];
  if(ao.applies.includes(rId)) ao.applies = ao.applies.filter(x => x !== rId);
  else ao.applies.push(rId);
  rtModalRender();
}

function rtCopyFromRT(srcId){
  const src = getRateType(srcId);
  if(!src || src.id === _rtDraft.id) return;
  if(!confirm('Copy routes + prices from "'+src.name+'"? This will overwrite current draft values.')) return;
  _rtDraft.routes = [...(src.routes||[])];
  _rtDraft.seatRates = _rtCloneDeep(src.seatRates||{});
  _rtDraft.priceTiers = _rtCloneDeep(src.priceTiers||{});   /* §ราคา 3 ชั้น · ก๊อป Selling/Min sell มาด้วย ไม่งั้นก๊อป rate type แล้วเหลือแต่ Net */
  _rtDraft.charterRates = _rtCloneDeep(src.charterRates||{});
  _rtDraft.addOns = _rtCloneDeep(src.addOns||{});
  rtModalRender();
}

function rtModalUpdateSummary(){
  // Lightweight update without re-render (called from inputs)
  const el = document.getElementById('rt-draft-summary');
  if(!el || !_rtDraft) return;
  const nR = (_rtDraft.routes||[]).length;
  const nS = Object.keys(_rtDraft.seatRates||{}).filter(r=>(_rtDraft.routes||[]).includes(r)).length;
  let nC = 0; Object.values(_rtDraft.charterRates||{}).forEach(o => nC += Object.keys(o).length);
  const nA = Object.keys(_rtDraft.addOns||{}).length;
  el.innerHTML = `<span style="color:var(--fd-ink);font-weight:600">${nR}</span> routes · <span style="color:var(--fd-ink);font-weight:600">${nS*3}</span> seat zone-rows · <span style="color:var(--fd-ink);font-weight:600">${nC}</span> charter · <span style="color:var(--fd-ink);font-weight:600">${nA}</span> add-ons`;
}

// §per-rate-type nationality scope · which pax-type columns/fields this rate covers
/* ══ §rtNatCols · คอลัมน์สัญชาติ · ตัวช่วยร่วมของทุกตารางที่วาดราคาที่นั่ง ══════════════════════
   บั๊กที่แก้: Rate Type ที่ตั้ง nationalityScope = 'fr' (เอเย่นต์ที่ขายเฉพาะต่างชาติ)
   ตัวตารางวาดตาม PAX ซึ่งเหลือ 2 ช่อง แต่หัวตารางฝังไว้ตายตัวเป็น ไทย(2) + ต่างชาติ(2)
   ผลคือราคาต่างชาติไปนั่งใต้คอลัมน์ "ไทย" และ Start/End เลื่อนไปอยู่ใต้ "ต่างชาติ"
   วัดจริงที่ Russian Standard scope=fr: หัว 6 ช่อง ตัวตาราง 4 ช่อง · 3,900 (ผู้ใหญ่ ตช.)
   ไปโผล่ใต้ THAI · ADULT — คนอ่านเข้าใจว่าเป็นราคาคนไทยทันที
   อยู่ทั้งหน้าจอ Pricing Matrix และใบสัญญาที่ปริ้นส่งเอเย่นต์ (คนละฟังก์ชัน โครงเดียวกัน)
   → ให้หัวตารางกับ colgroup งอกจาก PAX ชุดเดียวกับที่ตัวตารางใช้ จะได้ไม่มีวันหลุดจากกันอีก */
function rtNatCols(PAX){
  var th = PAX.filter(function(p){ return /-thai$/.test(p); });
  var fr = PAX.filter(function(p){ return /-fr$/.test(p); });
  return { pax:PAX, th:th, fr:fr,
           lastTh: th.length ? PAX.indexOf(th[th.length - 1]) : -1,
           firstFr: fr.length ? PAX.indexOf(fr[0]) : -1,
           lbl: function(p){ return /^adult/.test(p) ? 'Adult' : /^child/.test(p) ? 'Child'
                                  : /^infant/.test(p) ? 'Infant' : p; } };
}
function rtNatPax(scope){ return scope==='thai' ? ['adult-thai','child-thai'] : scope==='fr' ? ['adult-fr','child-fr'] : ['adult-thai','child-thai','adult-fr','child-fr']; }
function rtNatScopeOf(rt){ return (rt && rt.nationalityScope) || 'both'; }
function rtNatLabel(scope){ return scope==='thai' ? 'ไทยเท่านั้น' : scope==='fr' ? 'ต่างชาติเท่านั้น' : 'ไทย + ต่างชาติ'; }
function rtModalRender(){
  const host = document.getElementById('rt-modal-body');
  if(!host || !_rtDraft) return;
  const d = _rtDraft;
  const ROUTES_ARR = (typeof ROUTES !== 'undefined' && ROUTES) || [];
  /* §rnZone2 · รายชื่อโซนย้ายไปคิดรายเส้นทางแล้ว (rtZonesForRoute)
     ของเดิมฝังไว้ตรงนี้ตายตัว เส้นระนองเลยได้คอลัมน์ภูเก็ต/เขาหลักมาแทน
     TRANSFER_ZONES ที่เคยประกาศไว้ตรงนี้ไม่มีใครเรียกเลย จึงเอาออก */
  const _rtScope = d.nationalityScope || 'both';   // §per-rate-type nationality · both | thai | fr
  const PAX = (typeof rtNatPax==='function') ? rtNatPax(_rtScope) : ['adult-thai','child-thai','adult-fr','child-fr'];
  const PAX_LBL = {'adult-thai':'Adult TH','child-thai':'Child TH','adult-fr':'Adult FR','child-fr':'Child FR'};
  const PAX_BG = {'adult-thai':'#F0F7FD','child-thai':'#F0F7FD','adult-fr':'#FBF4E9','child-fr':'#FBF4E9'};
  const PAX_HD_BG = {'adult-thai':'#E6F1FB','child-thai':'#E6F1FB','adult-fr':'#FAEEDA','child-fr':'#FAEEDA'};
  const PAX_HD_FG = {'adult-thai':'#185FA5','child-thai':'#185FA5','adult-fr':'#854F0B','child-fr':'#854F0B'};
  const fmtN = n => (n||0);
  const sel = d.color || '#993C1D';
  const tint = sel + '14';

  // Color picker swatches
  const colorSwatches = RT_COLORS.map(c =>
    `<span onclick="rtDraftSet('color','${c}');rtModalRender()" style="width:24px;height:24px;border-radius:7px;background:${c};border:${d.color===c?'2.5px':'1px'} solid ${d.color===c?c:'rgba(0,0,0,.15)'};cursor:pointer;display:inline-block;flex-shrink:0"></span>`
  ).join('');

  // Routes chips (selected vs available)
  // §b2cNoRateType · a B2C-origin route (carries extId, see bkV2Routes' §b2cNoRateVisible) already
  // shows on the calendar with no rate type at all and never needs one to bill, so an agent picking a
  // rate type's routes must not be offered it here. Only exception: it was already toggled on before
  // this rule existed — keep that chip visible (still ✓, still clickable to remove) so nobody's
  // existing pricing silently vanishes off the modal; just stop it from being ADDED going forward.
  const routesChips = ROUTES_ARR.filter(r => !r.extId || (d.routes||[]).includes(r.id)).map(r => {
    const on = (d.routes||[]).includes(r.id);
    return `<span onclick="rtDraftToggleRoute('${r.id}')" style="background:${on?tint:'#fafaf8'};color:${on?sel:'var(--fd-ink-soft)'};border:1px solid ${on?sel:'var(--fd-line)'};padding:5px 11px;border-radius:999px;font-size:11px;font-weight:${on?'600':'500'};cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1.3">
      <span style="font-variant-numeric:tabular-nums;font-size:9px;opacity:.65">${r.id}</span>${r.name}
      ${on?'<span style="margin-left:3px;font-weight:700">✓</span>':''}
    </span>`;
  }).join('');

  // Seat rates per route (accordion-like — always visible since drafts are small)
  let seatRatesHtml = '';
  if((d.routes||[]).length===0){
    seatRatesHtml = '<div style="padding:18px;text-align:center;color:var(--fd-ink-soft);font-size:11.5px;border:1px dashed var(--fd-line);border-radius:10px">เลือก Routes ก่อน เพื่อกรอกราคา</div>';
  } else {
    seatRatesHtml = (d.routes||[]).map(rId => {
      const r = ROUTES_ARR.find(x=>x.id===rId);
      const rName = r ? r.name : rId;
      const rr = d.seatRates[rId] || {};
      const ZONES = rtZonesForRoute(rId, rr);      /* §rnZone2 · โซนตามท่าของเส้นนี้ */
      const rv = (d.routeValidity && d.routeValidity[rId]) || {};
      const bundle = (d.routeBundles && d.routeBundles[rId] && d.routeBundles[rId].longtail) || null;
      const bundleOn = !!bundle;
      const bundleMode = bundle ? (bundle.mode || 'free') : 'free';
      const bundleA = bundle ? (bundle.adult||0) : 0;
      const bundleC = bundle ? (bundle.child||0) : 0;
      return `<div style="border:1px solid var(--fd-line);border-radius:10px;margin-bottom:8px;overflow:hidden">
        <div style="padding:9px 12px;background:${bundleOn?'#FFF7E8':'#fafaf8'};border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <div style="font-size:12px;font-weight:600;color:var(--fd-ink)">${rName}</div>
            <div style="font-size:9.5px;color:var(--fd-ink-soft);font-variant-numeric:tabular-nums;margin-top:1px">${rId} · ${ZONES.length} zones × ${PAX.length} pax types</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--fd-line);border-radius:8px;padding:4px 10px">
            <span style="font-size:9px;font-weight:700;color:var(--fd-ink-soft);letter-spacing:.06em;text-transform:uppercase">Active</span>
            <div style="display:flex;align-items:center;gap:4px">
              <span style="font-size:9px;color:var(--fd-ink-soft)">Start</span>
              <input type="date" value="${rv.from||''}" oninput="rtDraftSet('routeValidity.${rId}.from',this.value)" style="height:26px;font-size:10.5px;font-family:inherit;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff;color:var(--fd-ink);min-width:128px" title="Start of active period for this route — Charter and Add-ons inherit">
            </div>
            <span style="font-size:11px;color:var(--fd-ink-faint)">→</span>
            <div style="display:flex;align-items:center;gap:4px">
              <span style="font-size:9px;color:var(--fd-ink-soft)">End</span>
              <input type="date" value="${rv.to||''}" oninput="rtDraftSet('routeValidity.${rId}.to',this.value)" style="height:26px;font-size:10.5px;font-family:inherit;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff;color:var(--fd-ink);min-width:128px" title="End of active period — Charter and Add-ons inherit">
            </div>
          </div>
          <!-- Bundle Longtail toggle -->
          <label style="display:flex;align-items:center;gap:7px;background:${bundleOn?'#A8773B':'#fff'};color:${bundleOn?'#fff':'#5F5E5A'};border:1px solid ${bundleOn?'#7A5728':'var(--fd-line)'};border-radius:8px;padding:5px 11px;cursor:pointer;font-size:11px;font-weight:${bundleOn?'700':'600'}">
            <input type="checkbox" ${bundleOn?'checked':''} onchange="rtToggleBundleLongtail('${rId}',this.checked)" style="width:14px;height:14px;margin:0;cursor:pointer;accent-color:#A8773B">
            <span>Bundle Longtail${bundleOn?' ✓':''}</span>
          </label>
        </div>
        ${bundleOn ? `
        <div style="background:#FFF7E8;border-bottom:1px solid #A8773B33;padding:10px 14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:700;color:#A8773B">⛵ Longtail · Pileh / Maya · Bundled in seat price</span>
          <!-- Free / Paid toggle -->
          <div style="display:inline-flex;background:#fff;border:1px solid #A8773B33;border-radius:13px;padding:2px;gap:0">
            <button type="button" onclick="rtSetBundleMode('${rId}','free')" style="background:${bundleMode==='free'?'#A8773B':'transparent'};color:${bundleMode==='free'?'#fff':'#9b9590'};border:none;border-radius:11px;padding:4px 14px;font-size:10.5px;font-weight:${bundleMode==='free'?'700':'600'};cursor:pointer;font-family:inherit">Free</button>
            <button type="button" onclick="rtSetBundleMode('${rId}','paid')" style="background:${bundleMode==='paid'?'#A8773B':'transparent'};color:${bundleMode==='paid'?'#fff':'#9b9590'};border:none;border-radius:11px;padding:4px 14px;font-size:10.5px;font-weight:${bundleMode==='paid'?'700':'600'};cursor:pointer;font-family:inherit">Paid</button>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px">
            <span style="font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.05em;text-transform:uppercase">ใช้กับ</span>
            <div style="display:inline-flex;background:#fff;border:1px solid #A8773B33;border-radius:13px;padding:2px;gap:0" title="Bundle นี้ใช้กับ Seat (Day trip) / Charter (เหมาลำ) / ทั้งสอง">
              ${[['seat','Seat'],['charter','Charter'],['both','ทั้งสอง']].map(([_v,_l])=>`<button type="button" onclick="rtSetBundleApplyTo('${rId}','${_v}')" style="background:${(bundle&&(bundle.applyTo||'seat'))===_v?'#0F6E56':'transparent'};color:${(bundle&&(bundle.applyTo||'seat'))===_v?'#fff':'#9b9590'};border:none;border-radius:11px;padding:4px 12px;font-size:10.5px;font-weight:${(bundle&&(bundle.applyTo||'seat'))===_v?'700':'600'};cursor:pointer;font-family:inherit">${_l}</button>`).join('')}
            </div>
          </div>
          ${bundleMode==='paid' ? `
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:9.5px;font-weight:700;color:#5F5E5A;letter-spacing:.05em;text-transform:uppercase">Surcharge / pax</span>
              <span style="font-size:10px;color:#5F5E5A">Adult</span>
              <input type="number" value="${bundleA}" min="0" oninput="rtDraftSet('routeBundles.${rId}.longtail.adult',+this.value||0)" style="width:84px;height:26px;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid #A8773B33;border-radius:5px;padding:2px 6px;background:#fff;color:#0F1419">
              <span style="font-size:10px;color:#5F5E5A">Child</span>
              <input type="number" value="${bundleC}" min="0" oninput="rtDraftSet('routeBundles.${rId}.longtail.child',+this.value||0)" style="width:84px;height:26px;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;border:1px solid #A8773B33;border-radius:5px;padding:2px 6px;background:#fff;color:#0F1419">
              <span style="font-size:10px;color:#5F5E5A;font-style:italic">THB</span>
            </div>
          ` : `
            <span style="font-size:10.5px;color:#5F5E5A;font-style:italic">Longtail ฟรี · ไม่บวกเพิ่มจาก seat rates</span>
          `}
        </div>
        ` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#fff">
              <th style="padding:6px 10px;text-align:left;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;width:90px">Zone</th>
              ${PAX.map(p => `<th style="padding:6px 10px;text-align:right;font-size:9.5px;color:${PAX_HD_FG[p]};font-weight:700;text-transform:uppercase;letter-spacing:.04em;background:${PAX_HD_BG[p]}">${PAX_LBL[p]}</th>`).join('')}
              <th style="padding:6px 8px;text-align:center;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;width:120px">Offer</th>
            </tr>
          </thead>
          <tbody>
            ${ZONES.map(z => {
              const cellRaw = rr[z];
              const isNotOffered = cellRaw === null;
              const cell = cellRaw || {};
              return `<tr style="border-top:1px solid var(--fd-line-soft);${isNotOffered?'background:#FBE4E020':''}">
                <td style="padding:5px 10px;font-weight:600;font-size:10.5px;color:${isNotOffered?'#C44A36':'var(--fd-ink)'}">
                  <span style="display:inline-flex;align-items:center;gap:6px">${z}${isNotOffered?'<span style="background:#FBE4E0;color:#C44A36;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700;letter-spacing:.05em">N/A</span>':''}</span>
                </td>
                ${PAX.map(p => `<td style="padding:3px 6px;text-align:right;background:${isNotOffered?'#FBE4E010':PAX_BG[p]}">
                  ${isNotOffered
                    ? `<div style="width:80px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:#C44A36;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums" title="Not offered for this zone">—</div>`
                    : (function(){
                        /* §ราคา 3 ชั้น · ช่องเดียวกัน แต่ผูกกับ "ชั้น" ที่เลือกอยู่ (Net / Selling / Min sell)
                           Net เว้นว่าง = 0 (ราคาจริง) · Selling/Min sell เว้นว่าง = ยังไม่กรอก (ไม่ใช่ศูนย์)
                           → ชั้นสัญญาจึงส่ง '' ไม่ใช่ 0 เวลาลบค่าออก ไม่งั้นสัญญาจะพิมพ์ "฿0" */
                        const _tv = _rtTierGet(d, rId, z, p);
                        const _tc = (RT_TIERS.find(t=>t.k===_rtTier)||{});
                        const _blank = (_rtTier!=='net' && (_tv===undefined || _tv===null || _tv===''));
                        const _set = (_rtTier==='net')
                          ? `rtDraftSet('${_rtTierPath(rId,z,p)}',+this.value||0)`
                          : `rtDraftSet('${_rtTierPath(rId,z,p)}',this.value===''?'':(+this.value||0))`;
                        return `<input type="number" value="${_blank?'':fmtN(_tv)}" min="0" placeholder="${_rtTier==='net'?'0':'—'}" oninput="${_set}" style="width:80px;height:28px;font-size:11px;text-align:right;font-variant-numeric:tabular-nums;border:1px solid ${_blank?'var(--fd-line)':(_tc.c||'#ccc')+'55'};border-radius:5px;padding:2px 6px;background:${_blank?'#fff':(_tc.bg||'#fff')};color:${_blank?'#c4c2ba':(_tc.c||'#333')};font-weight:${_rtTier==='net'?'400':'600'}">`;
                      })()}
                </td>`).join('')}
                <td style="padding:3px 6px;text-align:center">
                  <button type="button" onclick="rtToggleZoneNotOffered('${rId}','${z}')"
                    title="${isNotOffered?'Restore this zone (clear N/A)':'Mark this zone as Not Offered · booking will block it'}"
                    style="background:${isNotOffered?'#C44A36':'#fff'};color:${isNotOffered?'#fff':'#666'};border:1px solid ${isNotOffered?'#C44A36':'var(--fd-line)'};padding:4px 10px;border-radius:6px;font-size:9.5px;cursor:pointer;font-family:inherit;font-weight:700;letter-spacing:.04em;text-transform:uppercase;transition:all .12s">
                    ${isNotOffered?'✕ N/A':'◯ Offer'}
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');
  }

  // Charter rates table — starter price + starterIncludes + extra/pax
  let charterRowsHtml = '';
  Object.keys(d.charterRates||{}).forEach(rId => {
    Object.keys(d.charterRates[rId]).forEach(bt => {
      const ch = d.charterRates[rId][bt];
      const routeOpts = ROUTES_ARR.filter(r=>(d.routes||[]).includes(r.id)).map(r => `<option value="${r.id}" ${r.id===rId?'selected':''}>${r.name}</option>`).join('');
      const btOpts = RT_BOAT_TYPES.map(b => `<option value="${b}" ${b===bt?'selected':''}>${b}</option>`).join('');
      // Show inherited validity from § 1 routeValidity (read-only · grayed out)
      const rv = (d.routeValidity && d.routeValidity[rId]) || {};
      const inh = (v) => v ? _rtFmtDate(v) : '<span style="color:var(--fd-ink-faint)">—</span>';
      charterRowsHtml += `<tr style="border-top:1px solid var(--fd-line-soft)">
        <td style="padding:4px 6px"><select onchange="rtChangeCharterRoute('${rId}','${bt}',this.value)" style="width:100%;height:30px;font-size:11px;font-family:inherit;border:1px solid var(--fd-line);border-radius:5px;padding:2px 4px;background:#fff">${routeOpts}</select></td>
        <td style="padding:4px 6px"><select onchange="rtChangeCharterBoatType('${rId}','${bt}',this.value)" style="width:100%;height:30px;font-size:11px;font-family:inherit;border:1px solid var(--fd-line);border-radius:5px;padding:2px 4px;background:#fff;text-transform:capitalize">${btOpts}</select></td>
        <td style="padding:4px 6px;text-align:right"><input type="number" value="${ch.starterPrice||0}" min="0" oninput="rtDraftSet('charterRates.${rId}.${bt}.starterPrice',+this.value||0)" style="width:100%;max-width:110px;height:30px;font-size:11px;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff"></td>
        <td style="padding:4px 6px;text-align:right"><input type="number" value="${ch.starterIncludes||4}" min="1" max="50" oninput="rtDraftSet('charterRates.${rId}.${bt}.starterIncludes',+this.value||1)" style="width:100%;max-width:60px;height:30px;font-size:11px;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff"></td>
        <td style="padding:4px 6px;text-align:right"><input type="number" value="${ch.extraPerPax||0}" min="0" oninput="rtDraftSet('charterRates.${rId}.${bt}.extraPerPax',+this.value||0)" style="width:100%;max-width:110px;height:30px;font-size:11px;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:5px;padding:2px 6px;background:#fff"></td>
        <td style="padding:4px 6px;text-align:center;background:#F5F4EE;border-left:1px solid #E0DED8;font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--fd-ink-soft)" title="Inherited from § 1 Seat rates · edit there to change">${inh(rv.from)}</td>
        <td style="padding:4px 6px;text-align:center;background:#F5F4EE;font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--fd-ink-soft)" title="Inherited from § 1 Seat rates · edit there to change">${inh(rv.to)}</td>
        <td style="padding:4px 6px;text-align:center"><button onclick="rtRemoveCharterRow('${rId}','${bt}')" style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:14px;padding:4px 6px">✕</button></td>
      </tr>`;
    });
  });
  const charterTable = charterRowsHtml
    ? `<table style="width:100%;border-collapse:collapse;border:1px solid var(--fd-line);border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#fafaf8">
            <th rowspan="2" style="padding:7px 10px;text-align:left;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:bottom">Route</th>
            <th rowspan="2" style="padding:7px 10px;text-align:left;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:bottom">Boat type</th>
            <th rowspan="2" style="padding:7px 10px;text-align:right;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:bottom">Starter price</th>
            <th rowspan="2" style="padding:7px 10px;text-align:right;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:bottom">For N pax</th>
            <th rowspan="2" style="padding:7px 10px;text-align:right;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:bottom">Extra / pax</th>
            <th colspan="2" style="padding:6px 10px;text-align:center;font-size:9.5px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:#F5F4EE;border-bottom:1px solid #E0DED8;border-left:1px solid #E0DED8">Active period <span style="font-size:8.5px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--fd-ink-faint);margin-left:4px">inherited · § 1</span></th>
            <th rowspan="2" style="width:34px"></th>
          </tr>
          <tr style="background:#fafaf8">
            <th style="padding:5px 10px;text-align:center;font-size:9px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:#F5F4EE;border-left:1px solid #E0DED8">Start</th>
            <th style="padding:5px 10px;text-align:center;font-size:9px;color:var(--fd-ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:#F5F4EE">End</th>
          </tr>
        </thead>
        <tbody>${charterRowsHtml}</tbody>
      </table>`
    : '<div style="padding:14px;text-align:center;color:var(--fd-ink-soft);font-size:11px;border:1px dashed var(--fd-line);border-radius:10px">ยังไม่มี charter rate · กด <strong>+ Add row</strong> เพื่อเพิ่ม</div>';

  // Private transfer matrix — ONE row per route × 4 price inputs (PK Sedan/Van + KL Sedan/Van)
  // Copy-from dropdown
  const otherRTs = (SB_RATE_TYPES||[]).filter(x => x.id !== d.id);
  const copyDropdown = otherRTs.length
    ? `<select onchange="if(this.value){rtCopyFromRT(this.value);this.value=''}" style="font-size:10.5px;height:28px;font-family:inherit;border:1px solid var(--fd-line);border-radius:6px;padding:2px 6px;background:#fff;cursor:pointer">
        <option value="">Copy from…</option>
        ${otherRTs.map(o => `<option value="${o.id}">${o.code} · ${o.name}</option>`).join('')}
      </select>`
    : '';

  host.innerHTML = `
    <!-- Header -->
    <div style="padding:16px 22px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between;background:${tint}">
      <div>
        <div style="font-size:16px;font-weight:600;color:var(--fd-ink)">${_rtDraftIsNew?'New Rate Type':'Edit Rate Type'}</div>
        <div style="font-size:11px;color:var(--fd-ink-soft);margin-top:2px">ตั้งชื่อ · เลือก routes · กำหนดราคา · validity</div>
      </div>
      <button onclick="rtModalClose()" aria-label="close" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer;padding:4px 8px;line-height:1">✕</button>
    </div>

    <!-- Basic info -->
    <div style="padding:16px 22px;border-bottom:1px solid var(--fd-line-soft)">
      <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Basic info</div>
      <div style="margin-bottom:10px">
        <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Name</label>
        <input type="text" value="${d.name||''}" oninput="rtDraftSet('name',this.value)" placeholder="e.g. Russian Standard" style="width:100%;height:32px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff">
        <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:4px;font-style:italic">${_rtDraftIsNew?'Code · สร้างอัตโนมัติจากชื่อเซลล์ + ชื่อเรท':('Code: '+(d.code||'—'))}</div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Color</label>
        <div style="display:flex;gap:6px">${colorSwatches}</div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Note</label>
        <input type="text" value="${(d.note||'').replace(/"/g,'&quot;')}" oninput="rtDraftSet('note',this.value)" placeholder="Description / segment / payment terms" style="width:100%;height:32px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Valid from <span style="color:var(--fd-ink-soft);font-weight:400">(optional)</span></label>
          <input type="date" value="${d.validFrom||''}" oninput="rtDraftSet('validFrom',this.value)" style="width:100%;height:32px;font-size:11.5px;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff">
        </div>
        <div>
          <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Valid to <span style="color:var(--fd-ink-soft);font-weight:400">(optional)</span></label>
          <input type="date" value="${d.validTo||''}" oninput="rtDraftSet('validTo',this.value)" style="width:100%;height:32px;font-size:11.5px;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;background:#fff">
        </div>
      </div>
      <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:4px">เว้น = ใช้ได้ตลอดเวลา</div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--fd-line)">
        <label style="display:inline-flex;align-items:center;gap:8px;font-size:11.5px;color:var(--fd-ink);cursor:pointer">
          <input type="checkbox" ${d.active===false?'':'checked'} onchange="rtDraftSet('active',this.checked);rtModalRender()" style="width:16px;height:16px;margin:0">
          <span><strong>Active</strong> · ใช้ผูกกับ agent ได้</span>
          ${d.active===false?'<span style="background:#F1EFE8;color:#5F5E5A;font-size:9.5px;font-weight:600;padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;margin-left:4px">Inactive</span>':''}
        </label>
        <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:4px;padding-left:24px">เมื่อ Inactive: ไม่ปรากฏใน dropdown ตอนเลือก rate type ให้ agent · agent ที่ผูกอยู่แล้วจะมี warning</div>
      </div>
    </div>

    <!-- Routes covered -->
    <div style="padding:16px 22px;border-bottom:1px solid var(--fd-line-soft)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Routes covered</div>
        <span style="font-size:11px;color:var(--fd-ink-soft)">${(d.routes||[]).length} of ${ROUTES_ARR.length} selected</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${routesChips}</div>
    </div>

    <!-- Nationality scope · per rate type -->
    <div style="padding:14px 22px;border-bottom:1px solid var(--fd-line-soft);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Nationality</div>
        <div style="font-size:11px;color:var(--fd-ink-soft);margin-top:2px">${_rtScope==='both'?'Thai + foreigner':_rtScope==='thai'?'Thai only · foreigner columns hidden':'Foreigner only · Thai columns hidden'}</div>
      </div>
      <div style="display:inline-flex;background:#F1EFE8;border-radius:11px;padding:3px;gap:2px">
        ${[['both','Both'],['thai','Thai'],['fr','Foreigner']].map(function(x){return '<button type="button" onclick="rtDraftSet(\'nationalityScope\',\''+x[0]+'\');rtModalRender()" style="background:'+(_rtScope===x[0]?'#fff':'transparent')+';color:'+(_rtScope===x[0]?sel:'#8a8880')+';border:none;box-shadow:'+(_rtScope===x[0]?'0 1px 3px rgba(0,0,0,.09)':'none')+';border-radius:9px;padding:6px 16px;font-size:11.5px;font-weight:'+(_rtScope===x[0]?'700':'600')+';cursor:pointer;font-family:inherit">'+x[1]+'</button>';}).join('')}
      </div>
    </div>

    <!-- Seat rates -->
    <div style="padding:16px 22px;border-bottom:1px solid var(--fd-line-soft)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:12px;flex-wrap:wrap">
        <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Seat rates · per pax · THB</div>
        <div style="display:inline-flex;background:#F1EFE8;border-radius:9px;padding:3px;gap:2px">
          ${RT_TIERS.map(t=>`<button type="button" onclick="rtSetTier('${t.k}')" title="${t.th}" style="background:${_rtTier===t.k?'#fff':'transparent'};color:${_rtTier===t.k?t.c:'#8a8880'};border:none;box-shadow:${_rtTier===t.k?'0 1px 3px rgba(0,0,0,.09)':'none'};border-radius:7px;padding:5px 13px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">${t.l}</button>`).join('')}
        </div>
        ${copyDropdown}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding:7px 11px;border-radius:8px;background:${(RT_TIERS.find(t=>t.k===_rtTier)||{}).bg};border:1px solid ${(RT_TIERS.find(t=>t.k===_rtTier)||{}).c}33">
        <span style="font-size:10.5px;font-weight:700;color:${(RT_TIERS.find(t=>t.k===_rtTier)||{}).c}">${(RT_TIERS.find(t=>t.k===_rtTier)||{}).l} · ${(RT_TIERS.find(t=>t.k===_rtTier)||{}).th}</span>
        <span style="font-size:10.5px;color:#8a8880">${_rtTier==='net'
          ? 'ระบบใช้ราคาชั้นนี้คิดเงินจริงทุกที่ — booking · invoice · รายงาน'
          : 'ใช้พิมพ์ในสัญญาเท่านั้น · ไม่มีผลกับการคิดเงินของ booking · เว้นว่างได้'}</span>
        ${_rtTier!=='net' ? `<button type="button" onclick="rtCopyNetToTier()" title="เติมค่าชั้นนี้ทุกช่อง = ราคา Net (แล้วค่อยปรับ)" style="margin-left:auto;flex:none;background:#fff;border:1px solid ${(RT_TIERS.find(t=>t.k===_rtTier)||{}).c}66;color:${(RT_TIERS.find(t=>t.k===_rtTier)||{}).c};border-radius:7px;padding:5px 12px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">⎘ คัดลอกจาก Net</button>` : ''}
      </div>
      ${seatRatesHtml}
    </div>

    <!-- Charter rates -->
    <div style="padding:16px 22px;border-bottom:1px solid var(--fd-line-soft)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Charter rates · per trip · THB</div>
        <button onclick="rtAddCharterRow()" style="font-family:inherit;font-size:10.5px;font-weight:600;background:transparent;border:1px solid var(--fd-line);color:var(--fd-ink);padding:5px 11px;border-radius:6px;cursor:pointer">+ Add row</button>
      </div>
      ${charterTable}
    </div>

    <!-- Add-ons -->
    <div style="padding:16px 22px;border-bottom:1px solid var(--fd-line-soft)">
      <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Add-on services</div>
      ${(typeof RT_ADDON_DEFS!=='undefined'?RT_ADDON_DEFS:[]).map(def=>def.edit?def.edit(d):'').join('')}
    </div>

    <!-- Footer -->
    <div style="padding:13px 22px;display:flex;align-items:center;justify-content:space-between;background:#fafaf8">
      <div style="font-size:11px;color:var(--fd-ink-soft)" id="rt-draft-summary"></div>
      <div style="display:flex;gap:8px">
        ${_rtDraftIsNew ? '' : `<button onclick="rtDeleteRT('${d.id}')" style="font-family:inherit;font-size:11.5px;font-weight:500;background:transparent;border:1px solid #FBD3D3;color:#A32D2D;padding:7px 13px;border-radius:8px;cursor:pointer">Delete</button>`}
        <button onclick="rtModalClose()" style="font-family:inherit;font-size:11.5px;font-weight:500;background:transparent;border:1px solid var(--fd-line);color:var(--fd-ink);padding:7px 14px;border-radius:8px;cursor:pointer">Cancel</button>
        <button onclick="rtSaveDraft()" style="font-family:inherit;font-size:11.5px;font-weight:600;background:${sel};color:#fff;border:none;padding:7px 18px;border-radius:8px;cursor:pointer">Save Rate Type</button>
      </div>
    </div>
  `;
  rtModalUpdateSummary();
}

function rtSaveDraft(){
  if(!_rtDraft) return;
  const d = _rtDraft;
  if(!d.name || !d.name.trim()){ alert('Please enter a Name'); return; }   // §Code สร้างอัตโนมัติ (เอาออกจากฟอร์ม) → ไม่ต้องกรอก
  if(d.validFrom && d.validTo && d.validFrom > d.validTo){ alert('Valid from must be earlier than Valid to'); return; }
  // Cleanup: keep seatRates only for selected routes
  const routes = d.routes || [];
  Object.keys(d.seatRates||{}).forEach(rId => { if(!routes.includes(rId)) delete d.seatRates[rId]; });
  Object.keys(d.charterRates||{}).forEach(rId => { if(!routes.includes(rId)) delete d.charterRates[rId]; });
  // Apply
  if(_rtDraftIsNew){
    const _cp=_rtCloneDeep(d);
    // §กันชน id ซ้ำ (เกราะสุดท้าย · เผื่อ generator พลาด) — ถ้า id ไปตรงกับ rate ที่มีอยู่ ให้สร้างใหม่จริงๆ
    // ไม่งั้น push แล้ว save จะเขียนทับ rate เดิม (เคส Standard Tier 1 หายเพราะ id 6-หลักชนกัน)
    while(SB_RATE_TYPES.some(x=>x.id===_cp.id)){
      _cp.id = (typeof LA_UID==='function' ? LA_UID('rt') : 'rt'+Date.now().toString(36)+Math.random().toString(36).slice(2,7));
    }
    d.id = _cp.id;   // sync draft → _rtSelected ชี้ตัวที่บันทึกจริง
    if(_cp.owner===undefined) _cp.owner=(typeof laMySalesId==='function'?(laMySalesId()||''):'');   // §เจ้าของ = คนสร้าง
    _cp.code = _rtAutoCode(_cp.name, _cp.owner);   // §auto-gen code = ชื่อเซลล์ + ชื่อเรท (unique)
    d.code = _cp.code;
    SB_RATE_TYPES.push(_cp);
  } else {
    const idx = SB_RATE_TYPES.findIndex(x => x.id === d.id);
    if(idx >= 0) SB_RATE_TYPES[idx] = _rtCloneDeep(d);
  }
  rtPersist();
  rtModalClose();
  _rtSelected = d.id;
  rtRenderCards();
  rtRenderDetail(d.id);
}

function rtDeleteRT(rtId){
  const using = (SB_AGENTS||[]).filter(a => a.rateTypeId === rtId);
  if(using.length > 0){
    if(!confirm('Rate Type นี้ใช้กับ '+using.length+' agent — ลบจะปลดออกจาก agents ด้วย ยืนยัน?')) return;
    using.forEach(a => { delete a.rateTypeId; });
  } else {
    if(!confirm('ลบ Rate Type นี้?')) return;
  }
  SB_RATE_TYPES = SB_RATE_TYPES.filter(x => x.id !== rtId);
  rtPersist();
  rtModalClose();
  _rtSelected = null;
  rtRenderCards();
  rtRenderDetail(null);
}

function rtPersist(){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('sales')) return;   // sales view-only → no rate-type save
  // Read-modify-write to loveandaman_v2 — NEVER clobber other keys (CLAUDE.md §6.2)
  try {
    const raw = localStorage.getItem('loveandaman_v2');
    const obj = raw ? JSON.parse(raw) : {};
    obj.sb_rate_types = SB_RATE_TYPES;
    /* §rateBind · เขียนทั้งสองที่พร้อมกันเสมอ · ตัวเดิมเขียนแต่ sidecar
       ทำให้ sb_agents ใน export ค้างเป็นค่าเก่า (ตอนพบครั้งแรก เพี้ยนอยู่ 32 เอเย่นต์) */
    obj.sb_agents_rate_bindings = laRateBindings();
    obj.sb_agents = SB_AGENTS;
    localStorage.setItem('loveandaman_v2', JSON.stringify(obj));
  } catch(e){ console.warn('[rtPersist] failed:', e); }
}
function _rtmE(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function _rtmD(y){ return (typeof _rtFmtDate==='function') ? (_rtFmtDate(y)||y||'—') : (y||'—'); }
function _rtmSame(a){
  var cur=JSON.stringify(laSeasonsOf(a).map(function(x){ return [x.rt,x.from,x.to||'']; }));
  var dr =JSON.stringify((_rtmDraft||[]).filter(function(x){ return x.rt&&x.from; })
            .slice().sort(function(x,y){ return String(x.from).localeCompare(String(y.from)); })
            .map(function(x){ return [x.rt,x.from,x.to||'']; }));
  return cur===dr;
}
function rtmInit(aId){
  _rtmAgent=aId;
  var a=(typeof sbGetAgent==='function')?sbGetAgent(aId):null;
  _rtmDraft=laSeasonsOf(a).map(function(x){ return {rt:x.rt, from:x.from, to:x.to||''}; });
}
function rtmRedraw(){
  var a=(typeof sbGetAgent==='function')?sbGetAgent(_rtmAgent):null; if(!a) return;
  var body=document.getElementById('ag-tabbody'); if(!body) return;
  body.innerHTML=agTabRate(a);
}
function rtmSet(i,k,v){ if(_rtmDraft[i]) _rtmDraft[i][k]=String(v||''); rtmRedraw(); }
function rtmDel(i){ _rtmDraft.splice(i,1); rtmRedraw(); }
function rtmAdd(){
  var last=_rtmDraft[_rtmDraft.length-1];
  _rtmDraft.push({ rt:(last&&last.rt)||'', from:(last&&last.to)?laDayAfter(last.to):'', to:'' });
  rtmRedraw();
}
function rtmSnap(){
  for(var i=0;i<_rtmDraft.length-1;i++){
    var n=_rtmDraft[i+1];
    if(n && n.from) _rtmDraft[i].to=_rtSeasonPrev(n.from);
  }
  if(_rtmDraft.length) _rtmDraft[_rtmDraft.length-1].to='';
  rtmRedraw();
}
function rtmReset(){ rtmInit(_rtmAgent); rtmRedraw(); }
/* เติมให้จากสิ่งที่สัญญาระบุไว้ · เอเย่นต์คนเดียว · กติกาวันแบ่งเดียวกับปุ่มตั้งทั้งกลุ่ม */
function rtmFillFromContract(){
  var a=(typeof sbGetAgent==='function')?sbGetAgent(_rtmAgent):null; if(!a) return;
  var P=rtmSuggest(a); if(!P) return;
  _rtmDraft=P.seasons.slice();
  rtmRedraw();
}
function rtmSuggest(a){
  if(!a || !a.rateTypeId) return null;
  var rt=(typeof getRateType==='function')?getRateType(a.rateTypeId):null; if(!rt) return null;
  var nx=rtExpNextOf(a.id); if(!nx || nx===a.rateTypeId) return null;
  var nrt=(typeof getRateType==='function')?getRateType(nx):null;
  if(!nrt || nrt.active===false) return null;
  var vf=String(nrt.validFrom||''), vt=String(rt.validTo||'');
  var split=(vf && (!vt || vf>=vt)) ? vf : (typeof laDayAfter==='function'?laDayAfter(vt):'');
  if(!split) return null;
  if(typeof TODAY_STR!=='undefined' && split<=TODAY_STR) return null;
  var endOld=_rtSeasonPrev(split), out=[];
  if(rt.validFrom && endOld && rt.validFrom<=endOld) out.push({rt:rt.id, from:String(rt.validFrom), to:endOld});
  out.push({rt:nx, from:split, to:''});
  return { seasons:out, next:nrt, split:split };
}
function rtmSave(){
  if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return;
  var a=(typeof sbGetAgent==='function')?sbGetAgent(_rtmAgent):null; if(!a) return;
  var clean=(_rtmDraft||[]).filter(function(x){ return x && x.rt && x.from; })
    .map(function(x){ return {rt:x.rt, from:x.from, to:x.to||''}; })
    .sort(function(x,y){ return String(x.from).localeCompare(String(y.from)); });
  if(clean.length) a.rateSeasons=clean; else delete a.rateSeasons;
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();     /* §rateBind · ลงทั้งสองที่ */
  if(typeof agLog==='function') agLog(a.id,'rate', clean.length
    ? ('ตั้งตารางฤดูกาล '+clean.length+' ช่วง · '+clean.map(function(x){
        return rtSeasonName(x.rt)+' '+x.from+'→'+(x.to||'ไม่มีวันสิ้นสุด'); }).join(' · '))
    : 'เอาตารางฤดูกาลออก · กลับไปใช้ชุดราคาเดียวทั้งปี');
  rtmInit(a.id); rtmRedraw();
  if(typeof flShowToast==='function') flShowToast('บันทึกตารางฤดูกาลแล้ว');
}
