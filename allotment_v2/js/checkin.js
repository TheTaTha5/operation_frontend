// checkin.js · Check-in (van + pier) · guide jobs · meals
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

/* ══ §ckBack · ทางกลับของ No-show ที่ไม่ลบประวัติ ════════════════════════════
   ของเดิมมีแต่ปุ่ม "ถอน" ที่หน้าท่า และมันลบรายการทิ้งจริง ๆ (ev.pop())
   พอลบแล้วไม่เหลือร่องรอยว่าเคยเกิดอะไร · มีเรื่องกับ agent ทีหลังก็ไล่ย้อนไม่ได้
   และหน้าเช็คอินรถไม่มีทางกลับเลยสักทาง — กด + ที่ปุ่มนับก็ได้แค่เลข
   รายการใน events[] ยังอยู่ ป้าย No-show ยังขึ้น Travel Summary ยังนับเป็นคนหาย

   ทางใหม่ · ไม่ลบ แต่ทำเครื่องหมาย undone ให้รายการนั้น
     why:'found'   = วนกลับไปเจอตัว รับขึ้นรถแล้ว   (ประวัติ No-show ของลูกค้ายังจริง)
     why:'mistake' = กดผิด ไม่ได้ No-show จริงเลย   (ไม่ใช่ประวัติของลูกค้า แต่รู้ว่าใครกดผิด)
   ทั้งสองแบบหักออกจากยอดคนหายเหมือนกัน ต่างกันแค่ป้ายที่โชว์

   ⚠ ทุกที่ที่นับจาก events[] ต้องกรองด้วย ckEvLive() ไม่งั้นตัวเลขขัดกันเอง
     ตอนนี้มี 7 จุด · ckLostByType · ckEventTally · ckVanNsPax · pckVoidInfo
     · pckSelfPierNote · แผงรายละเอียด booking · Travel Summary
   ═════════════════════════════════════════════════════════════════════════ */
function ckEvLive(ev){
  return (Array.isArray(ev)?ev:[]).filter(function(x){ return x && !x.undone; });
}
/* รอบที่วนกลับไปหาแล้วไม่เจอ · เก็บไว้ในรายการเดิม ไม่ได้แตะตัวเลข */
function ckEvTries(ev){
  var out=[];
  (Array.isArray(ev)?ev:[]).forEach(function(x){
    if(!x || x.undone) return;
    (Array.isArray(x.tries)?x.tries:[]).forEach(function(t){ out.push(t); });
  });
  return out;
}
// pax ที่ไม่ได้เดินทาง แยกตามประเภทผู้โดยสาร · รวมทั้งเช็คอินรถและหน้าท่า
// ใช้ paxBreak ที่บันทึกตอนกดปุ่ม No-show/CXL · ถ้าไม่มี (ข้อมูลเก่า) จะคืน unalloc ไว้ให้หักจากยอดรวมแทน
function ckLostByType(b, date){
  var out={ad:0,chd:0,inf:0,foc:0,total:0,unalloc:0,ns:0,cxl:0,selfPier:0};
  var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):((b&&b.ops)||{});
  var _reins=!!(O.pierCheckin && O.pierCheckin.reinstate);   // §ckPierFix
  [[ 'van', O.vanCheckin ], [ 'pier', O.pierCheckin ]].forEach(function(pair){
    var kind=pair[0], ck=pair[1];
    var ev=ckEvLive(ck&&ck.events);   /* §ckBack */
    ev.forEach(function(x){
      var n=Math.max(0,+x.pax||0); if(!n) return;
      // §ckSelfPier · ไม่ได้ขึ้นรถ แต่แจ้งว่าไปเองที่ท่า/ไปรถคันอื่น → ยังถือว่าเดินทาง
      //   ให้หน้าท่าเป็นคนตัดสิน ถ้าไม่มาจริงค่อยกด No-show ที่ท่า อันนั้นถึงนับว่าหาย
      // §ckPierFix · หรือหน้าท่ากดยืนยันเองว่ามาจริง → No-show ฝั่งรถไม่นับเป็นคนหาย
      //   บันทึกฝั่งรถยังอยู่ครบ แค่ไม่เอามาตัดสินว่าเดินทางหรือไม่
      if(kind==='van' && x.type!=='cxl' && (_reins || ckExpectAtPier(x.reasonCode))){ out.selfPier+=n; return; }
      out.total+=n; if(x.type==='cxl') out.cxl+=n; else out.ns+=n;
      var pb=x.paxBreak;
      if(pb && (pb.ad||pb.chd||pb.inf||pb.foc)){ out.ad+=(+pb.ad||0); out.chd+=(+pb.chd||0); out.inf+=(+pb.inf||0); out.foc+=(+pb.foc||0); }
      else out.unalloc+=n;
    });
  });
  /* §ckSelfLost · หน้าท่ายืนยันแล้วว่าคนกลุ่มนี้มาถึงจริง · ถอนออกจากยอดหาย */
  var _sa=(O.pierCheckin && O.pierCheckin.selfAdd && (+O.pierCheckin.selfAdd.pax||0)>0)
          ? O.pierCheckin.selfAdd : null;
  if(_sa){
    var back=Math.min(out.total, Math.max(0,+_sa.pax||0));
    if(back>0){
      var rest=back;
      /* ถอนตามประเภทที่ระบุไว้ในหน้าต่างยืนยันก่อน */
      PAXK.forEach(function(k){
        var q=Math.min(out[k], Math.max(0,+_sa[k]||0), rest); out[k]-=q; rest-=q; });
      /* ของเก่าที่ไม่ได้แยกประเภท · ถอนจากกองที่ไม่รู้ประเภทก่อน แล้วค่อยกองที่ใหญ่สุด */
      if(rest>0){ var u=Math.min(out.unalloc, rest); out.unalloc-=u; rest-=u; }
      while(rest>0){
        var big='', bn=0;
        PAXK.forEach(function(k){ if(out[k]>bn){ bn=out[k]; big=k; } });
        if(!big) break;
        out[big]--; rest--;
      }
      var used=back-rest;
      var nn=Math.min(out.ns, used); out.ns-=nn;
      out.cxl=Math.max(0, out.cxl-(used-nn));
      out.total-=used; out.selfPier+=used;
    }
  }
  return out;
}
// จำนวนที่ "เดินทางจริง" ของแต่ละประเภท · k = ad|chd|inf|foc
/* §ckSelfAlloc · คนที่หน้าท่ายืนยันเองว่ามาถึง แยกตามประเภท */
function ckSelfOf(b, date){
  var p=(typeof ckRead==='function')?ckRead(b,date,'pier'):null;
  return (p && p.selfAdd && (+p.selfAdd.pax||0)>0) ? p.selfAdd : null;
}
function ckSelfK(b, date, k){ var sa=ckSelfOf(b,date); return sa?Math.max(0,+sa[k]||0):0; }
/* selfAdd ที่ยังไม่ได้แยกประเภท · ของเก่าหรือถูกเขียนไว้ก่อนมีหน้าต่างนี้ */
function ckSelfUnalloc(b, date){
  var sa=ckSelfOf(b,date); if(!sa) return 0;
  var t=0; PAXK.forEach(function(k){ t+=Math.max(0,+sa[k]||0); });
  return Math.max(0, (+sa.pax||0)-t);
}
function ckPaxLeft(b, date, k, booked){
  var L=ckLostByType(b,date);
  var left=Math.max(0, (booked||0)-(L[k]||0));
  if(L.unalloc>0 && k==='ad') left=Math.max(0, left-L.unalloc);   // ข้อมูลเก่าที่ไม่ได้แยกประเภท · หักจากผู้ใหญ่ก่อน
  /* §ckSelfLost · คนที่ตามมาเองที่ท่าถูกหักคืนไปแล้วใน ckLostByType() · บวกซ้ำตรงนี้จะเกินยอดจอง */
  return left;
}
// รวม pax ตามประเภทเหตุการณ์ · {no_show:n, cxl:n, total:n}
function ckEventTally(ck){
  var out={no_show:0, cxl:0, total:0};
  var ev=ckEvLive(ck&&ck.events);   /* §ckBack */
  ev.forEach(function(x){ var n=Math.max(0,+x.pax||0); if(!n) return; if(out[x.type]!=null) out[x.type]+=n; out.total+=n; });
  return out;
}
function ckReasonDef(code){ return CK_NOSHOW_REASONS.find(function(r){ return r.code===code; }) || null; }
function ckReasonLabel(code){ var d=ckReasonDef(code); return d?d.label:(code||''); }
function ckExpectAtPier(code){ var d=ckReasonDef(code); return !!(d && d.expectAtPier); }
// §ckPierFix · หน้าท่ายืนยันเองว่ามาจริง แม้เช็คอินรถบันทึกว่าไม่ได้ขึ้นรถ
function ckReinstateOf(b, date){ var p=ckRead(b,date,'pier'); return (p && p.reinstate) ? p.reinstate : null; }
// มี No-show ฝั่งรถอยู่ไหม (ไว้ตัดสินว่าจะโชว์ปุ่ม "มาแล้ว" หรือปุ่ม "ถอน")
function ckVanNsPax(b, date){
  var v=ckRead(b,date,'van'); if(!v || !Array.isArray(v.events)) return 0;
  return ckEvLive(v.events).reduce(function(s,x){ return s + ((x.type!=='cxl') ? Math.max(0,+x.pax||0) : 0); }, 0);   /* §ckBack */
}
function ckPierReinstate(bkId, date, on){
  if(!ckGuard()) return;                                   /* §ckPerm */
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var cur=ckRead(b,date,'pier')||{};
  if(on){
    if(!confirm('ยืนยันว่าลูกค้ามาถึงท่าจริง?\n\nบันทึกของเช็คอินรถจะไม่ถูกแก้ (ยังเห็นว่าเช้าไม่ได้ขึ้นรถ)\nแถวนี้จะกลับมาเช็คอินได้ตามปกติ')) return;
  } else {
    if(!confirm('ยกเลิกการยืนยัน?\n\nแถวจะกลับไปเป็น "ไม่มาทั้งใบ" ตามที่เช็คอินรถบันทึกไว้')) return;
  }
  var val={}; Object.keys(cur).forEach(function(k){ val[k]=cur[k]; });
  if(on){
    val.reinstate={ at:ckNowHM(), by:ckMe(), ts:new Date().toISOString() };
    // §ckPierFix2 · ตั้งช่องนับคนเป็นยอดจอง · มาไม่ครบค่อยกด − ลดเอา
    var _t=ckTripOn(b,date)||{}, _bk=ckBookedPax(_t);
    val.actualPax=_bk; val.noShow=0; val.expected=_bk;
  } else {
    delete val.reinstate;
  }
  ckWrite(b, date, 'pier', val); ckPersist(); ckAfter('pier');
}
function ckNowHM(){ var d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
/* §ckWho · ใครเช็คอิน · ME เป็นตัวแปรใน IIFE ของบูต ไม่ใช่ global → บล็อกนี้เห็นเสมอ undefined
   ทุกเช็คอิน/โน้ต/สรุปค่าเดินทาง จึงถูกสตัมป๊กว่า '—' มาตลอด · สอบย้อนไม่ได้ว่าใครทำ
   ใช้ window.LA_ME (ตั้งตอนบูตจาก /api/me) เหมือน laBy() ที่หน้าอื่นใช้ */
function ckMe(){ var m=window.LA_ME;
  if(m && (m.username||m.name)) return m.username||m.name;
  return (typeof ME!=='undefined' && ME && (ME.name||ME.username)) || '—'; }
function ckEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
/* ══ §ckPerm · เช็คอินเงียบหาย ═══════════════════════════════════════════════
   ckPersist เดิมเรียก acctPersistBookings ซึ่งมีด่าน laCanEditArea('operations')
   คนหน้าท่าที่ได้สิทธิ์แก้แค่ 'pier' จึงกดเช็คอินได้ หน้าจอขึ้นติ๊กถูกให้เรียบร้อย
   แต่ไม่มีอะไรถูกบันทึกเลย · พอ refresh หรือ sync ทีเดียวหายทั้งวัน
   ที่ร้ายกว่าคือมันเงียบสนิท ไม่มีข้อความบอกว่าไม่มีสิทธิ์ ทุกคนจึงเชื่อว่าเช็คอินแล้ว
   ═══════════════════════════════════════════════════════════════════════════════ */
function ckCanEdit(){
  if(typeof window.laCanEditArea !== 'function') return true;
  return window.laCanEditArea('operations') || window.laCanEditArea('pier');
}
/* กันไว้ตั้งแต่ก่อนกด · ถ้าไม่มีสิทธิ์จริง ต้องบอก ไม่ใช่ปล่อยให้กดแล้วเงียบ */
function ckGuard(){
  if(ckCanEdit()) return true;
  if(typeof window.laGuardEdit === 'function') window.laGuardEdit('pier');
  return false;
}
function ckPersist(){
  if(!ckCanEdit()) return false;
  try{ if(typeof baChMemoClear === 'function') baChMemoClear(); }catch(_){}
  try{ laBlob().sb_bookings = SB_BOOKINGS; laBlobSave(); return true; }
  catch(e){ console.warn('persist check-in failed', e); return false; }
}
function ckBookedPax(t){ return (typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot((t&&t.pax)||{}):0; }

/* ══ §ckRowOrder (2026-09-04) · ลำดับแถว "ภายในคัน" ════════════════════════
   หน้าเช็คอินทั้งสองหน้าดันแถวเข้ากลุ่มตามลำดับที่เจอใน SB_BOOKINGS เฉย ๆ
   ไม่เคยเรียงเลย · ส่วนใบงานที่พิมพ์ส่งคนขับเรียง ลำดับรับในกลุ่ม (vanSeq)
   แล้วค่อยเวลารับ · ผลคือคนขับไล่ตามใบงานในมือทีละบรรทัด แต่บนจอสลับกันหมด
   ใช้กติกาเดียวกับ vanJobsOrderInner._collect เป๊ะ ๆ จะได้ตรงบรรทัดต่อบรรทัด
   ไม่มี vanSeq (ยังไม่เคยจัดลำดับรับ) = ไปท้ายคัน แล้วเรียงตามเวลารับ       */
function ckRowSeq(r){
  var sp=r&&(r.sp||r.vsp), O=r&&r.O;
  var v=+(((sp&&sp.vanSeq)||(O&&O.vanSeq))||0);
  return v>0?v:9999;
}
function ckRowTime(r){
  var O=r&&r.O, t=r&&r.t;
  return String((O&&O.pickupTimeFinal)||(t&&(t.pickupTime||t.pickupFinal))||'~~');
}
function ckRowCmp(a,b){
  var sa=ckRowSeq(a), sb=ckRowSeq(b); if(sa!==sb) return sa-sb;
  var ta=ckRowTime(a), tb=ckRowTime(b); if(ta!==tb) return ta<tb?-1:1;
  var va=String((a.b&&(a.b.voucherRef||a.b.code||a.b.id))||''),
      vb=String((b.b&&(b.b.voucherRef||b.b.code||b.b.id))||'');
  if(va!==vb) return va.localeCompare(vb);
  /* แถวที่แยกจุดรับของใบเดียวกัน ต้องอยู่เรียงตามลำดับ split ไม่สลับกันเอง */
  return (((a.si!=null?a.si:(a.vsIdx!=null?a.vsIdx:0))|0) - ((b.si!=null?b.si:(b.vsIdx!=null?b.vsIdx:0))|0));
}
function ckIsCxl(b){ return !!b && CK_CXL_ST.indexOf(b.status)>=0; }
// "จัดการไปแล้ว" = มีร่องรอยการลงมือของคน ไม่ใช่แค่ใบจองที่ยังไม่มีใครแตะ
function ckHasArrange(b, date){
  var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):((b&&b.ops)||{});
  if(!O) return false;
  if(O.vanId || O.vanReturnId || O.boatId) return true;
  if((+O.vanGroup||0)>0) return true;
  if(Array.isArray(O.vanSplits) && O.vanSplits.some(function(x){
    return x && (x.vanId || x.vanReturnId || (+x.vanGroup||0)>0); })) return true;
  if(Array.isArray(O.boatSplits) && O.boatSplits.some(function(x){ return x && x.boatId; })) return true;
  /* เช็คอินแล้วก็นับ · รวมช่องเช็คอินของแถวที่แยกจุดรับ (ops.vanCheckin._s) ด้วย */
  var hit=false;
  [O.vanCheckin, O.pierCheckin].forEach(function(c){
    if(!c) return;
    if(c.at) hit=true;
    if(c._s) Object.keys(c._s).forEach(function(i){ if(c._s[i] && c._s[i].at) hit=true; });
  });
  return hit;
}
function ckStrandOn(b, date){ return ckIsCxl(b) && ckHasArrange(b, date); }

/* ══ §strandMove · เคส "เลื่อนวัน" ════════════════════════════════════════
   ต่างจาก CXL ตรงที่อันนี้ "ล้างของจริง" · bkV2RescheduleBooking ลบ boatId /
   vanId / vanGroup / vanSeq / vanSplits / pickupTimeFinal และผลเช็คอินทิ้ง
   แล้วย้าย t.date ไปวันใหม่ · วันเดิมจึงไม่เหลือ trip ให้หน้าไหนหาเจอเลย
   ต้องถ่ายภาพไว้ก่อนล้าง แล้วปั้นแถวขึ้นมาใหม่บนวันเดิมจากภาพนั้น

   ที่เก็บ: blob key ระดับบน เก็บเป็น "สตริง" · ops.* เพิ่มช่องใหม่ไม่ได้
   เพราะ field_mapping มีแค่ 13 ช่อง อะไรที่ไม่อยู่ในนั้นหายเงียบตอนขึ้นฐาน
   (แพตเทิร์นเดียวกับ van_rates / pck_svc_colors ที่ใช้อยู่แล้ว)              */
function ckStrandStore(){
  try{ var raw=(laBlob()||{}).ops_stranded; return raw?(JSON.parse(raw)||{}):{}; }
  catch(_){ return {}; }
}
function ckStrandStoreSave(o){
  try{ var b=laBlob();
    if(o && Object.keys(o).length) b.ops_stranded=JSON.stringify(o); else delete b.ops_stranded;
    laBlobSave();
  }catch(e){ console.warn('[strand] save failed', e&&e.message); }
}
/* ถ่ายภาพ · เรียกก่อนล้างเสมอ · O กับ t ส่งเข้ามาตรง ๆ เพราะตอนเรียกจริง
   trip ถูกย้ายวันไปแล้ว อ่านย้อนจาก bkOpsRead(b, วันเดิม) จะได้ {} */
function ckStrandSnap(b, date, O, t, to, why){
  if(!b || !date || !O) return false;
  var has=(O.vanId||O.vanReturnId||O.boatId||(+O.vanGroup||0)>0
    || (Array.isArray(O.vanSplits)&&O.vanSplits.some(function(x){ return x&&(x.vanId||(+x.vanGroup||0)>0); }))
    || (O.vanCheckin&&O.vanCheckin.at) || (O.pierCheckin&&O.pierCheckin.at));
  if(!has) return false;   /* ไม่เคยมีใครจัดอะไร ก็ไม่มีอะไรให้ค้าง */
  t=t||{};
  var S=ckStrandStore();
  S[b.id+'|'+date]={
    to:to||'', why:why||'moved', at:new Date().toISOString(),
    by:(typeof laBy==='function')?laBy():'',
    vanId:O.vanId||'', vanReturnId:O.vanReturnId||'',
    vanGroup:+O.vanGroup||0, vanSeq:+O.vanSeq||0, boatId:O.boatId||'',
    pickupTime:O.pickupTimeFinal||t.pickupTime||'',
    routeId:t.routeId||'', zone:t.zone||b.pickupZone||'', pax:t.pax||{},
    ckVan:!!(O.vanCheckin&&O.vanCheckin.at), ckPier:!!(O.pierCheckin&&O.pierCheckin.at),
    splits:(Array.isArray(O.vanSplits)?O.vanSplits.map(function(x){
      return {vanId:(x&&x.vanId)||'', vanGroup:+((x&&x.vanGroup)||0), vanSeq:+((x&&x.vanSeq)||0), pax:+((x&&x.pax)||0)};
    }):[])
  };
  ckStrandStoreSave(S);
  return true;
}
/* วันแบบไทยสั้น · หน้างานอ่าน 15 ส.ค. เร็วกว่า 2026-08-15
   ใช้ร่วมกันทั้งเหตุผลและป้ายสถานะ จะได้ไม่มีสองรูปแบบในบรรทัดเดียวกัน */
function ckDayShortTh(ymd){
  var v=String(ymd||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  var M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var p=v.split('-');
  return (+p[2])+' '+M[(+p[1])-1];
}
function ckStrandMvWhy(R){
  var bits=[];
  var _to=ckDayShortTh(R.to||'');
  bits.push(_to?('เลื่อนไป '+_to):'ย้ายวันออกไป');
  var w=ckShortDay(R.at||''); if(w) bits.push(w);
  if(R.by) bits.push(R.by);
  if(R.ckVan||R.ckPier) bits.push('เคยเช็คอินแล้ว');
  return bits.join(' · ');
}
/* ปั้นแถวของวันเดิมขึ้นมาจากภาพที่ถ่ายไว้ · ตัวเลขเป็นศูนย์ทั้งหมด ไม่เข้ายอดใด */
function ckStrandMovedRows(date){
  var S=ckStrandStore(), out=[];
  Object.keys(S).forEach(function(k){
    var i=k.lastIndexOf('|'); if(i<0) return;
    if(k.slice(i+1)!==date) return;
    var id=k.slice(0,i), R=S[k]||{};
    var b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).filter(function(x){ return x.id===id; })[0];
    if(!b) return;   /* ใบถูกลบไปแล้ว ก็ไม่มีอะไรให้แสดง */
    var vid=R.vanId||((R.splits||[]).filter(function(x){ return x.vanId; })[0]||{}).vanId||'';
    out.push({
      b:b,
      t:{routeId:R.routeId||'', date:date, zone:R.zone||'', pax:R.pax||{}, pickupTime:R.pickupTime||''},
      O:{vanId:vid, vanReturnId:R.vanReturnId||'', vanGroup:+R.vanGroup||0, vanSeq:+R.vanSeq||0,
         boatId:R.boatId||'', pickupTimeFinal:R.pickupTime||''},
      booked:0, expect:0, ck:null, van:null, _vd:null,
      vanId:vid, vanIds:vid?[vid]:[], bid:R.boatId||'',
      strand:'mv', strandWhy:ckStrandMvWhy(R), mvTo:(R.to||''), _mvKey:k
    });
  });
  return out;
}
function ckStrandMvDrop(key){
  var S=ckStrandStore(); if(!(key in S)) return false;
  delete S[key]; ckStrandStoreSave(S); return true;
}
// วันที่แบบสั้นไทย · ใช้บอกว่ายกเลิกเมื่อไหร่ ไม่ใช่รูปแบบ ISO ที่คนหน้างานอ่านไม่ออก
function ckShortDay(iso){
  if(!iso) return '';
  var d=new Date(iso); if(isNaN(d)) return String(iso).slice(0,10);
  var M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d.getDate()+' '+M[d.getMonth()]
    +' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function ckStrandWhy(b){
  var C=(b&&b.cancellation)||{};
  var who=(C.by||'').trim(), when=ckShortDay(C.at||'');
  var head=(b&&b.status==='cancelled_weather')?'ยกเลิกเพราะสภาพอากาศ'
          :(b&&b.status==='rejected')?'ถูกปฏิเสธ':'ยกเลิก';
  var tail=[when, who].filter(Boolean).join(' · ');
  return head+(tail?(' '+tail):'')+((C.reason||'').trim()?(' · '+C.reason.trim()):'');
}
/* ล้างการจัดการของ "วันนั้นวันเดียว" · ตัวใบจองไม่ถูกแตะ
   นี่คือทางเดียวที่แถวค้างจะหายไป */
function ckStrandClear(bkId, date){
  /* §strandSay · ทางที่ "ไม่ทำอะไรแล้วเงียบ" ต้องไม่มี
     ผู้ใช้รายงานว่ากดล้างแล้วแถวยังอยู่ · จำลองเคสเดียวกันในเครื่องแล้วล้างได้ทุกครั้ง
     แปลว่าของจริงหลุดออกทางใดทางหนึ่งที่ return เงียบ ๆ แล้วไม่มีใครรู้ว่าทางไหน
     ให้มันพูดออกมา · ครั้งหน้าที่เจอจะได้รู้ทันทีว่าติดตรงไหน ไม่ต้องมาเดาอีกรอบ */
  var b=(typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).filter(function(x){ return x.id===bkId; })[0];
  if(!b){
    alert('ล้างไม่ได้ · หาใบจองรหัส '+bkId+' ไม่เจอในเครื่องนี้\n\n'
      +'อาจเป็นเพราะข้อมูลในเครื่องยังไม่ตรงกับระบบ · ลองรีเฟรชหน้าแล้วกดใหม่');
    return;
  }
  var nm=b.leadPax||b.voucherRef||b.code||bkId;
  /* §strandMove · เคสเลื่อนวัน ของจริงถูกล้างไปตั้งแต่ตอนเลื่อนแล้ว
     ที่ต้องลบคือ "ภาพที่ถ่ายไว้" · ไม่ต้องไปแตะ ops ของวันใหม่เด็ดขาด */
  var _mk=bkId+'|'+date;
  if(_mk in ckStrandStore()){
    if(!confirm('ล้างรายการค้างของ '+nm+' ออกจากวันที่ '+date+' ?\n\n'
      +'ใบนี้ถูกเลื่อนวันไปแล้ว · การจัดรถ/เรือของวันใหม่ไม่ถูกแตะ')) return;
    ckStrandMvDrop(_mk);
    if(typeof laSaveToast==='function') laSaveToast({kind:'neutral', title:'ล้างรายการค้างแล้ว', id:bkId,
      status:'CLEARED', sub:nm+' · '+date});
    ['vancheckin-host','piercheckin-host','landcheckin-host','vanjobs-host'].forEach(function(h){
      var el=document.getElementById(h); if(!el || !el.offsetParent) return;
      if(h==='vancheckin-host' && typeof renderVanCheckin==='function') renderVanCheckin();
      if(h==='piercheckin-host' && typeof renderPierCheckin==='function') renderPierCheckin();
      if(h==='landcheckin-host' && typeof renderLandCheckin==='function') renderLandCheckin();   // §landCk
      if(h==='vanjobs-host'    && typeof renderVanJobs==='function')    renderVanJobs();
    });
    return;
  }
  /* §strandSay · มาถึงตรงนี้แปลว่าไม่ใช่เคสเลื่อนวัน · ต้องเป็นเคส "ยกเลิกแล้วยังจัดรถไว้"
     ถ้าไม่มีการจัดรถเหลือให้ล้างเลย แสดงว่าแถวที่เห็นมาจากที่อื่น · บอกให้รู้ ไม่ใช่ทำเป็นล้างแล้วเงียบ */
  var _hasArr=(typeof ckHasArrange==='function') ? ckHasArrange(b, date) : true;
  if(!_hasArr){
    alert('ไม่มีการจัดรถ/เรือของ '+nm+' ค้างอยู่ในวันที่ '+date+' แล้ว\n\n'
      +'แถวที่เห็นอาจมาจากข้อมูลเก่าในเครื่อง · ลองรีเฟรชหน้า (Ctrl/Cmd + Shift + R)\n'
      +'ถ้ายังอยู่หลังรีเฟรช แจ้งทีมพัฒนาพร้อมรหัสใบจอง '+bkId+' และวันที่ '+date);
    return;
  }
  if(!confirm('ล้างการจัดรถ/เรือของ '+nm+' ออกจากวันที่ '+date+' ?\n\n'
    +'รายการจะหายจากใบงานรถ · เช็คอินรถ · เช็คอินหน้าท่า\n'
    +'ตัวใบจองและประวัติการยกเลิกไม่ถูกแตะ')) return;
  if(typeof bkOpsClear==='function') bkOpsClear(b, (typeof bkOpsDate==='function')?bkOpsDate(b,date):date);
  if(typeof bkV2AddHistory==='function')
    bkV2AddHistory(b,'ops','ล้างการจัดรถ/เรือของวันที่ '+date+' (ใบจองถูกยกเลิกแล้ว)','Cleared');
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  if(typeof laSaveToast==='function') laSaveToast({kind:'neutral', title:'ล้างการจัดรถ/เรือแล้ว', id:bkId,
    status:'CLEARED', sub:nm+' · '+date});
  ['vancheckin-host','piercheckin-host','landcheckin-host','vanjobs-host'].forEach(function(h){
    var el=document.getElementById(h); if(!el || !el.offsetParent) return;
    if(h==='vancheckin-host' && typeof renderVanCheckin==='function') renderVanCheckin();
    if(h==='piercheckin-host' && typeof renderPierCheckin==='function') renderPierCheckin();
    if(h==='landcheckin-host' && typeof renderLandCheckin==='function') renderLandCheckin();   // §landCk
    if(h==='vanjobs-host'    && typeof renderVanJobs==='function')    renderVanJobs();
  });
}
// §focSplit (2026-07-31) · FOC ที่แยก FR/TH ถูกลืมอีกแล้ว
//   ad / chd / inf บวกครบทั้ง 3 ทรง (flat + _fr + _th) แต่ foc อ่านแค่ p.foc ตัวเดียว
//   บุ๊คกิ้งที่เก็บ FOC เป็น foc_fr / foc_th จึงขึ้น 0 ทุกที่ที่ใช้ฟังก์ชันนี้ —
//   คอลัมน์ FOC ของเช็คอินรถ + หน้าท่า และยอด "เดินทางจริง" บนหัวเรือ
//   เจอจริง 31 ก.ค. · Zeus · Threeland Asia 38 AD + 2 FOC = 40 pax แต่แถบหัวเรือขึ้น 38 pax · FOC 0
//   ยอดรวมถูกอยู่แล้วเพราะ ckBookedPax ใช้ bkV2PaxAllTot ที่บวกครบ — เพี้ยนเฉพาะตอนแยกประเภท
//   พันธุ์เดียวกับบั๊ก pax_foc_fr / pax_foc_th ฝั่งเซิร์ฟเวอร์ที่เคยทำให้ B2C ล่องหนทั้งชุด
//   คราวนี้ไล่ทีละประเภทด้วยลูปเดียว จะได้ไม่มีทางลืมประเภทใดประเภทหนึ่งอีก + coerce เป็นตัวเลขกันค่าที่มาเป็นสตริง
function ckPaxBreak(p){
  p=p||{};
  var t=function(k){ return (+p[k]||0)+(+p[k+'_fr']||0)+(+p[k+'_th']||0); };
  return { ad:t('ad'), chd:t('chd'), inf:t('inf'), foc:t('foc') };
}
function ckTripOn(b, date){ return ((b&&b.trips)||[]).find(function(x){ return (x.date||'')===date; }) || null; }
// อ่านบล็อกเช็คอินของวันนั้น · kind = 'van' | 'pier'
/* §vckSplit · บุคกิ้งที่รับหลายจุดถูกแตกเป็น ops.vanSplits[] แล้วขึ้นรถคนละคัน
   การเช็คอินจึงต้องแยกรายคัน · kind = 'van#<i>' เก็บลง ops.vanCkS[i]
   เก็บเป็น object map ไม่ใช่ array เพราะ _deepDiff ไล่ merge ทีละคีย์ ไม่ทับกันข้ามเครื่อง */
function _ckSlot(kind){ var m=/^(van|pier)#(\d+)$/.exec(String(kind||'')); return m?{k:m[1], i:+m[2]}:null; }
/* §pckSplit · 'pier#0' ต้องนับเป็นฝั่งท่า · ตัวเทียบทุกจุดต้องผ่านตัวนี้ ไม่งั้น
   ckAfter() จะไปวาดหน้าเช็คอินรถแทน กดแล้วหน้าท่าไม่ขยับสักที (เหมือนกดไม่ติด) */
function _ckBase(kind){ var t=String(kind||''), i=t.indexOf('#'); return i<0?t:t.slice(0,i); }
/* จำนวนคนของจุดรับย่อยนั้น · ใช้เป็นเพดานแทนยอดทั้งใบ ไม่งั้นทุกแถวขึ้นยอดเต็มใบ */
function _ckSplitPax(b, date, kind){
  var sl=_ckSlot(kind); if(!sl) return null;
  var o=(typeof bkOpsRead==='function')?bkOpsRead(b,date):((b&&b.ops)||{});
  var sp=(Array.isArray(o.vanSplits)?o.vanSplits:[])[sl.i]; if(!sp) return null;
  var n=(typeof bkPaxSum==='function')
    ? bkPaxSum({ad:+sp.ad||0, chd:+sp.chd||0, inf:+sp.inf||0, foc:+sp.foc||0}) : 0;
  return n || Math.max(0, +sp.pax||0);
}
/* ══ §ckSlotFix (2026-09-03) · บั๊กข้อมูลหาย ══════════════════════════════════
   เช็คอินของจุดรับย่อยเคยเก็บที่ ops.vanCkS / ops.pierCkS ซึ่ง "ไม่มีคอลัมน์ใน DB"
   (field_mapping.json มีแค่ ops.vanCheckin / ops.pierCheckin)
   คีย์ที่ไม่มีคอลัมน์และค่าเป็น object จะถูกทิ้งเงียบ ๆ ตอนเซฟ ไม่มี error ไม่มีใครรู้
   → บุคกิ้งที่รับหลายจุด เช็คอินไปแล้ว พอรีเฟรชกลับมาเป็นยังไม่เช็คอิน

   ย้ายไปเก็บซ้อนใน ops.vanCheckin._s / ops.pierCheckin._s แทน
   สองคีย์นั้นเป็น json_text ที่มีคอลัมน์จริง คีย์ลูกที่เพิ่มเข้าไปจึงรอด
   ยังอ่านของเก่าที่ ops.vanCkS ได้อยู่ ของใหม่ชนะเป็นรายช่อง (ไม่ต้อง migrate) */
function _ckHost(sl){ return (sl.k==='pier')?'pierCheckin':'vanCheckin'; }
function _ckBag(o, sl){
  var h=_ckHost(sl);
  var nw=(o[h] && o[h]._s) || null;
  var old=(sl.k==='pier')?o.pierCkS:o.vanCkS;
  if(nw && old){ var out={};
    Object.keys(old).forEach(function(k){ out[k]=old[k]; });
    Object.keys(nw).forEach(function(k){ out[k]=nw[k]; });
    return out; }
  return nw || old || null;
}
function _ckBagMake(o, sl){
  var h=_ckHost(sl);
  o[h]=o[h]||{}; o[h]._s=o[h]._s||{};
  return o[h]._s;
}
/* อ่านช่องย่อยจาก ops ที่อ่านมาแล้ว · ใช้ที่หน้าเช็คอินรถกับหน้าท่าตอนไล่สร้างแถว */
function ckSlotGet(o, k, i){
  var bag=_ckBag(o||{}, {k:k, i:i}), v=(bag && bag[i]) || null;
  if(!v && i===0) v=_ckLegacySeed((k==='pier')?(o||{}).pierCheckin:(o||{}).vanCheckin);
  return v;
}
function ckRead(b, date, kind){
  var o=(typeof bkOpsRead==='function')?bkOpsRead(b,date):((b&&b.ops)||{});
  var sl=_ckSlot(kind);
  if(sl){ var bag=_ckBag(o,sl), v=(bag&&bag[sl.i])||null;
    if(!v && sl.i===0) v=_ckLegacySeed(sl.k==='pier'?o.pierCheckin:o.vanCheckin);
    return v; }
  return (kind==='pier'?o.pierCheckin:o.vanCheckin)||null; }
/* §pckSplit · ของเดิมก่อนแยกจุดรับ · ยกเฉพาะ "เวลา/คนที่ทำ/ขั้นตอน" มาให้จุดหลัก
   ไม่ยก actualPax/expected เพราะเพดานของจุดนั้นไม่เท่ากับยอดทั้งใบแล้ว */
function _ckLegacySeed(L){
  if(!L || !(L.at || L.arrivedAt || L.clearedAt)) return null;
  return { at:L.at||null, by:L.by||null, events:(Array.isArray(L.events)?L.events:[]),
           reasonCode:L.reasonCode||'', reasonNote:L.reasonNote||'', reasonAt:L.reasonAt||'',
           arrivedAt:L.arrivedAt||null, arrivedBy:L.arrivedBy||null,
           clearedAt:L.clearedAt||null, clearedBy:L.clearedBy||null };
}
function ckWrite(b, date, kind, val){
  var o=(typeof bkOpsFor==='function')?bkOpsFor(b, (typeof bkOpsDate==='function'?bkOpsDate(b,date):date)):(b.ops=b.ops||{});
  var sl=_ckSlot(kind);
  var prev=sl?((_ckBag(o,sl)||{})[sl.i]||null):((kind==='pier'?o.pierCheckin:o.vanCheckin)||null);
  if(prev && val && typeof val==='object'){
    CK_STAGE_KEYS.forEach(function(k){ if(val[k]===undefined && prev[k]!==undefined) val[k]=prev[k]; });
  }
  if(sl){
    _ckBagMake(o, sl)[sl.i]=val;                      /* ที่ที่รอดตอนเซฟ */
    /* เขียนที่เดิมไว้ด้วย · โค้ดเก่าที่ยังอ่าน o.vanCkS ตรง ๆ ในรอบเดียวกันจะได้ไม่พัง
       ค่านี้จะถูกทิ้งตอนเซฟตามเดิม แต่ไม่เป็นไร ของจริงอยู่ใน _s แล้ว */
    if(sl.k==='pier'){ o.pierCkS=o.pierCkS||{}; o.pierCkS[sl.i]=val; }
    else { o.vanCkS=o.vanCkS||{}; o.vanCkS[sl.i]=val; }
  }
  else {
    /* เขียนทับทั้งก้อนของจุดหลัก ต้องพก _s ของจุดย่อยไปด้วย ไม่งั้นลบทิ้งหมด */
    var _h=(kind==='pier')?'pierCheckin':'vanCheckin';
    var _keep=(o[_h] && o[_h]._s) || null;
    if(_keep && val && typeof val==='object' && val._s===undefined) val._s=_keep;
    o[_h]=val;
  }
  return val;
}
// สีสำหรับเขียนบนพื้นขาว · หรี่ความสว่างลงจนคอนทราสต์พอ (WCAG ~4.5:1)
//   คืนสีเดิมถ้ามันเข้มพออยู่แล้ว · สีจืดมาก ๆ (เทา) ตกไปที่หมึกดำของระบบ
function pckInkOnWhite(hex){
  var m=String(hex||'').replace('#','');
  if(m.length===3) m=m[0]+m[0]+m[1]+m[1]+m[2]+m[2];
  if(m.length<6) return '#2f2f2b';
  var r=parseInt(m.slice(0,2),16)/255, g=parseInt(m.slice(2,4),16)/255, b=parseInt(m.slice(4,6),16)/255;
  var lin=function(v){ return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  var L=function(rr,gg,bb){ return 0.2126*lin(rr)+0.7152*lin(gg)+0.0722*lin(bb); };
  var k=1;
  for(var i=0;i<24;i++){
    if((1.05)/(L(r*k,g*k,b*k)+0.05) >= 4.5) break;   // เทียบกับพื้นขาว
    k-=0.04;
  }
  if(k<=0.2) return '#2f2f2b';
  var hx=function(v){ return ('0'+Math.round(Math.max(0,Math.min(1,v))*255).toString(16)).slice(-2); };
  return '#'+hx(r*k)+hx(g*k)+hx(b*k);
}
function pckStage(ck){ if(!ck) return 'wait'; if(ck.at) return 'on'; if(ck.clearedAt) return 'clr'; if(ck.arrivedAt) return 'arr'; return 'wait'; }
function pckStageRank(k){ return {wait:0, arr:1, clr:2, on:3}[k]||0; }
// §vanBoatSplit (2026-08-01) · รถคันเดียวรับมาแล้วแยกลงคนละลำได้
//   ระบบผูก "รถ" กับ booking และผูก "เรือ" กับ booking แยกกัน ไม่มีใครผูกรถกับเรือ
//   หน้าจอเลยไม่เคยบอกว่ารถคันนี้ต้องส่งใครขึ้นลำไหน — คนขับกับไกด์ไปเจอกันงงหน้าท่า
//   คืนรายการ [{bid, pax, n}] เรียงจากลำที่คนเยอะสุด
function pckVanBoatSplit(vanId, date){
  var out=[], idx={};
  if(!vanId) return out;
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    var mine=false, pax=0;
    if(Array.isArray(O.vanSplits) && O.vanSplits.length){
      O.vanSplits.forEach(function(sp){ if(sp && sp.vanId===vanId){ mine=true; pax+=(+sp.pax||0); } });
    } else if(O.vanId===vanId){ mine=true; pax=ckBookedPax(t); }
    if(!mine) return;
    var bid=O.boatId||t.charterBoatId||'', k=bid||'__none';
    if(!idx[k]){ idx[k]={bid:bid, pax:0, n:0, t0:'', t1:''}; out.push(idx[k]); }
    idx[k].pax+=pax; idx[k].n++;
    // เก็บช่วงเวลารับของกลุ่มนี้ไว้ตัดสินว่า "จอยรอบเดียวกัน" หรือ "คนละรอบ"
    var tm=String(O.pickupTimeFinal||t.pickupTime||b.pickupTime||'').trim();
    if(/^\d{1,2}:\d{2}/.test(tm)){
      if(!idx[k].t0 || tm<idx[k].t0) idx[k].t0=tm;
      if(!idx[k].t1 || tm>idx[k].t1) idx[k].t1=tm;
    }
  });
  out.sort(function(a,b){ return b.pax-a.pax; });
  return out;
}
// §vanJoin · การ์ด/ใบงานหนึ่งอันเป็นของเรือลำเดียว · ลำอื่นที่รถคันเดียวกันต้องไปส่งคือสิ่งที่มองไม่เห็น
//   บอกแค่ "จอยรถกับลำไหน" พอ · จำนวนคนอยู่ใน title ไว้ให้จิ้มดูตอนอยากรู้ ไม่เอามารกบนป้าย
//   ใช้สีประจำเรือของ "ลำที่ไปจอย" ไม่ใช่ลำที่กำลังเปิดอยู่ — สายตาจะได้โยงไปถูกการ์ด
function _pckMin(hhmm){ var m=String(hhmm||'').match(/^(\d{1,2}):(\d{2})/); return m?(+m[1]*60 + +m[2]):null; }
// สองกลุ่มนี้อยู่รอบเดียวกันไหม · ช่วงเวลารับเหลื่อมกัน หรือห่างกันไม่เกิน 45 นาที = รอบเดียว
function _pckSameRun(a, b){
  var a0=_pckMin(a&&a.t0), a1=_pckMin(a&&a.t1), b0=_pckMin(b&&b.t0), b1=_pckMin(b&&b.t1);
  if(a0==null || b0==null) return true;   // ไม่รู้เวลา → อย่าเดา ใช้คำกลาง ๆ ว่าจอย
  if(a1==null) a1=a0; if(b1==null) b1=b0;
  if(a0<=b1 && b0<=a1) return true;                       // ช่วงเวลาเหลื่อมกัน
  return Math.min(Math.abs(b0-a1), Math.abs(a0-b1)) <= 20;
}
function pckVanJoinHtml(vanId, date, curBid, cls){
  if(!vanId || typeof pckVanBoatSplit!=='function') return '';
  var e=ckEsc;
  var all=pckVanBoatSplit(vanId,date);
  var cur=null; all.forEach(function(x){ if(x.bid===curBid) cur=x; });
  var o=all.filter(function(x){ return x.bid && x.bid!==curBid; });
  if(!o.length) return '';
  return o.map(function(x){
    var c=(typeof pckBoatColor==='function')?(pckBoatColor(x.bid)||'#185FA5'):'#185FA5';
    var ink=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(c):'#fff';
    var nm=(typeof pckBoatName==='function')?pckBoatName(x.bid):x.bid;
    var same=_pckSameRun(cur,x);
    var win=(x.t0?(x.t0+(x.t1&&x.t1!==x.t0?('–'+x.t1):'')):'');
    var lbl = same ? ('จอยรถกับ '+e(nm))
                   : ('อีกรอบ · '+e(nm)+(win?(' '+e(win)):''));
    var tip = same
      ? ('รอบเดียวกัน · รถคันนี้รับคนของ '+e(nm)+' ไปด้วยอีก '+x.pax+' คน ('+x.n+' booking)')
      : ('คนละรอบ · รถคันนี้มีอีกงานส่งขึ้น '+e(nm)+' '+x.pax+' คน ('+x.n+' booking)'
         +(win?(' · รับ '+e(win)):''));
    return '<span class="'+cls+(same?'':' alt')+'" style="background:'+(same?c:'transparent')+';color:'+(same?ink:c)
      +';border-color:'+c+'" title="'+tip+'">'+lbl+'</span>';
  }).join('');
}
// §onsiteVoid (2026-08-01) · ยกเลิกหน้างานจนไม่เหลือคน = ปิดรายการ ไม่ใช่ "รอเช็คอิน"
//   เดิม CXL/No-show เขียนแค่ events[] ส่วน pckStage() ดูแค่ ck.at / arrivedAt / clearedAt ที่ไม่มีใครแตะ
//   แถวที่ยกเลิกครบใบจึงค้างเป็น "ยังไม่เช็คอิน" ตลอด พร้อมปุ่มเช็คอินที่ยังกดได้ (เจอจริง 31 ก.ค. · EXC/Queen1)
//   ตัดสินจาก "เหลือกี่คน" ไม่ใช่ "กด CXL ไหม" — ยกเลิกบางส่วนยังต้องเช็คอินคนที่เหลือตามปกติ
//   เงินค้างไม่แตะเลย (นโยบายค่าปรับ/ไม่คืนเงิน) ยอดยังโชว์และยังเก็บได้
function pckVoidInfo(b, date, t){
  if(!b || !t) return null;
  var pb=ckPaxBreak(t.pax), booked=0, left=0;
  ['ad','chd','inf','foc'].forEach(function(k){ var n=pb[k]||0; booked+=n; left+=ckPaxLeft(b,date,k,n); });
  if(booked<=0 || left>0) return null;
  var L=ckLostByType(b,date), last=null;
  var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):((b&&b.ops)||{});
  [O.vanCheckin,O.pierCheckin].forEach(function(ck){
    ckEvLive(ck&&ck.events).forEach(function(x){ if(!last || String(x.ts||'')>String(last.ts||'')) last=x; });   /* §ckBack */
  });
  return { pax:booked, cxl:L.cxl, ns:L.ns, kind:((L.cxl>=L.ns)?'cxl':'ns'),
           at:(last&&last.at)||'', by:(last&&last.by)||'',
           reason:(last&&last.reasonCode)?ckReasonLabel(last.reasonCode):'',
           note:(last&&last.note)||'' };
}
function pckVoidOf(r, date){ if(!r) return null; if(r._vd===undefined) r._vd=pckVoidInfo(r.b, date, r.t); return r._vd; }
// §ckSelfPier · ข้อความบอกว่าคนกลุ่มนี้ไม่ได้ขึ้นรถ แต่แจ้งว่าจะมาเองที่ท่า
function pckSelfPierNote(b, date){
  var v=(typeof ckRead==='function')?ckRead(b,date,'van'):null;
  if(!v || !Array.isArray(v.events)) return null;
  var n=0, at='', code='';
  ckEvLive(v.events).forEach(function(x){   /* §ckBack */
    if(x.type==='cxl' || !ckExpectAtPier(x.reasonCode)) return;
    n+=Math.max(0,+x.pax||0); at=x.at||at; code=x.reasonCode||code;
  });
  return n>0 ? { pax:n, at:at, label:ckReasonLabel(code) } : null;
}
function pckVoidLabel(vd){ return (vd&&vd.kind==='ns')?'ไม่มาทั้งใบ':'ยกเลิกหน้างาน'; }
// ทางกลับของ CXL / No-show ที่กดพลาด · ถอนเหตุการณ์ล่าสุดของด่านนั้นแล้วคืนจำนวนให้
function ckEventUndo(bkId, date, kind){
  if(!ckGuard()) return;                                   /* §ckPerm */
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var cur=ckRead(b,date,kind)||{};
  var ev=(Array.isArray(cur.events)?cur.events.slice():[]);
  if(!ev.length){ alert('ไม่มีรายการให้ถอน'); return; }
  var last=ev[ev.length-1];
  if(!confirm('ถอนรายการล่าสุด?\n'+((last.type==='cxl')?'CXL':'No-show')+' '+(last.pax||0)+' คน · '+((last.at||'')+' '+(last.by||'')))) return;
  ev.pop();
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t);
  var cap=(typeof ckCap==='function')?ckCap(b,date,kind,booked):booked;
  /* §ckPierSelf · คืนคนได้ถึงยอดจอง · ของเดิมตันที่ยอดที่รถส่งมา คืนได้ไม่ครบ */
  var _cl=(typeof ckCeil==='function' && _ckBase(kind)==='pier')?ckCeil(b,date,kind,booked):cap;
  var back=Math.min(_cl, ((cur.actualPax!=null)?cur.actualPax:0)+Math.max(0,+last.pax||0));
  var prev=ev.length?ev[ev.length-1]:null;
  ckWrite(b, date, kind, { actualPax:back, noShow:Math.max(0,cap-back), expected:cap,
    selfAdd:(back>cap)?{pax:back-cap, at:ckNowHM(), by:ckMe(), ts:new Date().toISOString()}:null,
    at:cur.at||null, by:cur.by||null, events:ev,
    reasonCode:prev?(prev.reasonCode||''):'', reasonNote:prev?(prev.note||''):'', reasonAt:prev?(prev.at||''):'' });
  ckPersist(); ckAfter(kind);
}
function ckBackList(cur){
  var ev=(cur&&Array.isArray(cur.events))?cur.events:[], out=[];
  ev.forEach(function(x,i){ if(x && !x.undone && (+x.pax||0)>0) out.push({i:i, x:x}); });
  return out;
}
function ckBackOpen(bkId, date, kind){
  if(!ckGuard()) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  kind=kind||'van';
  var cur=ckRead(b,date,kind)||{}, live=ckBackList(cur);
  if(!live.length){ alert('ใบนี้ไม่มีรายการ No-show / CXL ที่ยังมีผลอยู่'); return; }
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t);
  _ckBk={bkId:bkId, date:date, kind:kind, ix:live[live.length-1].i, why:'found'};
  var actual=(cur.actualPax!=null?cur.actualPax:0);
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  var evRows=(live.length>1)
    ? '<div class="lb">รับกลับรายการไหน</div><div class="ck-bkopt" id="ck-bk-ev">'
      + live.map(function(o){
          var T=CK_EVENT_TYPES[o.x.type]||CK_EVENT_TYPES.no_show;
          return '<button type="button" class="'+((o.i===_ckBk.ix)?'on':'')+'" onclick="ckBackPickEv('+o.i+')">'
            +'<div class="o1">'+ckEsc(T.label)+' '+(+o.x.pax||0)+' คน · '+ckEsc(o.x.at||'')+'</div>'
            +'<div class="o2">'+ckEsc(ckReasonLabel(o.x.reasonCode)+(o.x.note?(' · '+o.x.note):''))+'</div></button>'; }).join('')
      +'</div>'
    : '';
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" class="ck-ovl">'
   +'<div class="ck-dlg">'
   +'  <div class="ck-dh"><div><div class="t1">&#8617;&#65039; รับกลับขึ้น'+(_ckBase(kind)==='pier'?'เรือ':'รถ')+'</div>'
   +'    <div class="t2">'+ckEsc(b.voucherRef||b.code||b.id)+' · '+ckEsc(b.leadPax||'')+' · จอง '+booked+' · ตอนนี้ขึ้นจริง '+actual+'</div></div>'
   +'    <button class="x" onclick="ckReasonClose()">&times;</button></div>'
   +'  <div class="ck-db">'+evRows
   +'    <div class="lb">เพราะอะไร</div>'
   +'    <div class="ck-bkopt" id="ck-bk-why">'
   +'      <button type="button" class="on" onclick="ckBackWhy(\'found\',this)"><div class="o1">&#128587; เจอตัวรอบวน · รับขึ้นรถแล้ว</div>'
   +'        <div class="o2">รายการ No-show เดิมยังอยู่ในประวัติ ขีดฆ่าไว้ แล้วต่อบรรทัดว่ารับกลับกี่โมง — ใช้ดูภายหลังได้ว่าใบไหนหรือโรงแรมไหนต้องวนซ้ำบ่อย</div></button>'
   +'      <button type="button" onclick="ckBackWhy(\'mistake\',this)"><div class="o1">&#9998; กดผิด · ไม่ได้ No-show จริง</div>'
   +'        <div class="o2">ติดป้าย “กดผิด” ให้รายการเดิม ไม่ลบทิ้ง จะได้รู้ว่าใครกดผิดตอนไหน แต่ไม่นับเป็นประวัติ No-show ของลูกค้า</div></button>'
   +'    </div>'
   +'    <div class="lb">หมายเหตุ (ไม่บังคับ)</div>'
   +'    <input id="ck-bk-note" class="ck-inp" type="text" placeholder="เช่น ลงมาแล้ว รับรอบสอง">'
   +'    <div class="ck-fn">ยอดขึ้นจริงจะคืนให้ตามจำนวนของรายการที่เลือก · ยอดจองและราคาไม่ถูกแก้</div>'
   +'  </div>'
   +'  <div class="ck-df"><button class="c" onclick="ckReasonClose()">ยกเลิก</button>'
   +'    <button class="k" onclick="ckBackSave()">ยืนยันรับกลับ</button></div>'
   +'</div></div>';
}
function ckBackPickEv(i){
  _ckBk.ix=i;
  var box=document.getElementById('ck-bk-ev'); if(!box) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_ckBk.bkId; });
  var live=ckBackList(ckRead(b,_ckBk.date,_ckBk.kind)||{});
  Array.prototype.forEach.call(box.children, function(btn,k){
    btn.classList.toggle('on', !!(live[k] && live[k].i===i)); });
}
function ckBackWhy(k, el){
  _ckBk.why=k;
  var box=document.getElementById('ck-bk-why'); if(!box) return;
  Array.prototype.forEach.call(box.children, function(b){ b.classList.remove('on'); });
  if(el) el.classList.add('on');
}
function ckBackSave(){
  var st=_ckBk; if(!st.bkId) return ckReasonClose();
  if(!ckGuard()) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===st.bkId; }); if(!b) return ckReasonClose();
  var cur=ckRead(b,st.date,st.kind)||{};
  var ev=(Array.isArray(cur.events)?cur.events.slice():[]);
  var hit=ev[st.ix];
  if(!hit || hit.undone){ alert('รายการนี้ถูกจัดการไปแล้ว'); return ckReasonClose(); }
  var noteEl=document.getElementById('ck-bk-note');
  ev[st.ix]=Object.assign({}, hit, { undone:{ why:(st.why==='mistake'?'mistake':'found'),
      at:ckNowHM(), by:ckMe(), ts:new Date().toISOString(),
      note:(noteEl?noteEl.value.trim():'') } });
  var t=ckTripOn(b,st.date)||{}, booked=ckBookedPax(t);
  var cap=(typeof ckCap==='function')?ckCap(b,st.date,st.kind,booked):booked;
  /* §ckPierSelf · ที่ท่าเรือคืนได้ถึงยอดจองเต็ม · ฝั่งรถเพดานคือยอดจองอยู่แล้ว */
  var ceil=(typeof ckCeil==='function')?ckCeil(b,st.date,st.kind,booked):cap;
  var back=Math.min(ceil, ((cur.actualPax!=null)?cur.actualPax:0)+Math.max(0,+hit.pax||0));
  /* เหตุผลที่โชว์บนแถว = รายการที่ยังมีผลล่าสุด · ไม่มีแล้วก็ต้องล้างทิ้ง
     ไม่งั้นแถวยังติดป้าย "รอแล้วไม่ลงมา" ทั้งที่คนขึ้นรถครบแล้ว */
  var last=ckEvLive(ev).slice(-1)[0]||null;
  ckWrite(b, st.date, st.kind, { actualPax:back, noShow:Math.max(0,cap-back), expected:cap,
    selfAdd:(back>cap)?{pax:back-cap, at:ckNowHM(), by:ckMe(), ts:new Date().toISOString()}:null,
    at:cur.at||null, by:cur.by||null, events:ev,
    reasonCode:last?(last.reasonCode||''):'', reasonNote:last?(last.note||''):'', reasonAt:last?(last.at||''):'' });
  ckPersist(); ckReasonClose(); ckAfter(st.kind);
}
function ckTryOpen(bkId, date, kind){
  if(!ckGuard()) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  kind=kind||'van';
  var cur=ckRead(b,date,kind)||{}, live=ckBackList(cur);
  if(!live.length){ alert('ใบนี้ไม่มีรายการ No-show / CXL ที่ยังมีผลอยู่'); return; }
  var pick=live[live.length-1];
  _ckTry={bkId:bkId, date:date, kind:kind, ix:pick.i};
  var was=(Array.isArray(pick.x.tries)?pick.x.tries:[]);
  var seq=was.map(function(t){ return ckEsc(t.at||''); });
  seq.unshift(ckEsc(pick.x.at||''));
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" class="ck-ovl">'
   +'<div class="ck-dlg">'
   +'  <div class="ck-dh"><div><div class="t1">&#128257; วนกลับไปแล้ว ยังไม่เจอ</div>'
   +'    <div class="t2">'+ckEsc(b.voucherRef||b.code||b.id)+' · '+ckEsc(b.leadPax||'')+'</div></div>'
   +'    <button class="x" onclick="ckReasonClose()">&times;</button></div>'
   +'  <div class="ck-db">'
   +'    <div class="ck-fn" style="margin:0 0 14px">ตัวเลขไม่เปลี่ยน · บันทึกไว้เฉย ๆ ว่าวนกลับไปอีกรอบแล้วยังไม่เจอ<br>'
   +'      <b>รอบนี้จะเป็นรอบที่ '+(seq.length+1)+'</b> · รอบก่อนหน้า '+(seq.join(' · ')||'—')+'</div>'
   +'    <div style="display:flex;gap:11px;flex-wrap:wrap">'
   +'      <div style="flex:none"><div class="lb">เวลา</div>'
   +'        <input id="ck-try-at" class="ck-inp" type="time" value="'+ckNowHM()+'" style="width:135px"></div>'
   +'      <div style="flex:1;min-width:180px"><div class="lb">หมายเหตุ</div>'
   +'        <input id="ck-try-note" class="ck-inp" type="text" placeholder="เช่น ล็อบบี้ไม่มีใคร โทรอีกครั้งไม่รับ"></div>'
   +'    </div>'
   +'  </div>'
   +'  <div class="ck-df"><button class="c" onclick="ckReasonClose()">ยกเลิก</button>'
   +'    <button class="k" onclick="ckTrySave()">บันทึกรอบนี้</button></div>'
   +'</div></div>';
}
function ckTrySave(){
  var st=_ckTry; if(!st.bkId) return ckReasonClose();
  if(!ckGuard()) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===st.bkId; }); if(!b) return ckReasonClose();
  var cur=ckRead(b,st.date,st.kind)||{};
  var ev=(Array.isArray(cur.events)?cur.events.slice():[]);
  var hit=ev[st.ix];
  if(!hit || hit.undone){ alert('รายการนี้ถูกจัดการไปแล้ว'); return ckReasonClose(); }
  var atEl=document.getElementById('ck-try-at'), noteEl=document.getElementById('ck-try-note');
  ev[st.ix]=Object.assign({}, hit, { tries:(Array.isArray(hit.tries)?hit.tries.slice():[]).concat([{
    at:(atEl?atEl.value:'')||ckNowHM(), by:ckMe(),
    note:(noteEl?noteEl.value.trim():''), ts:new Date().toISOString() }]) });
  /* เขียนกลับทุกค่าเดิมเป๊ะ · เปลี่ยนแค่ events[] · ตัวเลขห้ามขยับ */
  ckWrite(b, st.date, st.kind, { actualPax:cur.actualPax, noShow:cur.noShow, expected:cur.expected,
    at:cur.at||null, by:cur.by||null, events:ev,
    reasonCode:cur.reasonCode||'', reasonNote:cur.reasonNote||'', reasonAt:cur.reasonAt||'' });
  ckPersist(); ckReasonClose(); ckAfter(st.kind);
}
/* ป้ายประวัติของแถว · รอบที่วน + รายการที่รับกลับไปแล้ว */
function ckBackChips(ck){
  var ev=(ck&&Array.isArray(ck.events))?ck.events:[]; if(!ev.length) return '';
  var out='';
  var tr=ckEvTries(ev);
  if(tr.length){
    out+='<div><span class="ck-try" title="'+ckEsc(tr.map(function(t){
        return (t.at||'')+(t.by?(' · '+t.by):'')+(t.note?(' · '+t.note):''); }).join('\n'))
      +'">&#128257; วน '+(tr.length+1)+' รอบ · '+ckEsc(tr.map(function(t){ return t.at||''; }).join(' · '))+'</span></div>';
  }
  ev.forEach(function(x){
    var U=x.undone; if(!U) return;
    var T=CK_EVENT_TYPES[x.type]||CK_EVENT_TYPES.no_show;
    var mis=(U.why==='mistake');
    out+='<div><span class="'+(mis?'ck-mis':'ck-gone')+'" title="'+ckEsc(
        T.label+' '+(+x.pax||0)+' · '+(x.at||'')+' · '+ckReasonLabel(x.reasonCode)
        +' → '+(mis?'กดผิด':'รับกลับ')+' '+(U.at||'')+' · '+(U.by||'')+(U.note?(' · '+U.note):''))+'">'
      +(mis?'&#9998; กดผิด · ':'&#8617;&#65039; รับกลับ ')+(mis?'':(+x.pax||0)+' · ')+ckEsc(U.at||'')+'</span></div>';
  });
  return out;
}
// กดขั้นไหน = ไปถึงขั้นนั้น (ขั้นก่อนหน้าเติมให้อัตโนมัติ) · กดขั้นที่ทำแล้ว = ถอยกลับหนึ่งขั้น
/* §pckSplit · kind = 'pier' หรือ 'pier#<i>' ของจุดรับย่อย · ต้องแยกสถานะรายจุด
   ไม่งั้นกด "ถึงท่า" จุดเดียวจะเหมาว่าทั้งใบมาถึงแล้ว */
function pckStageSet(bkId, date, stage, kind){
  if(!ckGuard()) return;                                   /* §ckPerm */
  kind=kind||'pier';
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var cur=ckRead(b,date,kind)||{};
  var now=new Date().toISOString(), me=ckMe();
  var at=pckStageRank(pckStage(cur)), want=pckStageRank(stage);
  var to=(at===want)?want-1:want;                       // กดซ้ำ = ถอยกลับ
  var v={};
  CK_STAGE_KEYS.forEach(function(k){ v[k]=cur[k]||null; });
  v.arrivedAt = to>=1 ? (cur.arrivedAt||now) : null;
  v.arrivedBy = to>=1 ? (cur.arrivedBy||me)  : null;
  v.clearedAt = to>=2 ? (cur.clearedAt||now) : null;
  v.clearedBy = to>=2 ? (cur.clearedBy||me)  : null;
  if(to>=3 && !cur.at){ ckToggle(bkId,date,kind); }   // ขึ้นเรือใช้ทางเดิม (มันนับ pax + ถามเหตุผลให้ด้วย)
  else if(to<3 && cur.at){ ckToggle(bkId,date,kind); }
  var now2=ckRead(b,date,kind)||{};
  var t=ckTripOn(b,date)||{}, cap=ckCap(b,date,'pier',ckBookedPax(t));
  ckWrite(b,date,kind,{
    actualPax:(now2.actualPax!=null?now2.actualPax:cap), noShow:(now2.noShow!=null?now2.noShow:0),
    expected:(now2.expected!=null?now2.expected:cap), at:now2.at||null, by:now2.by||null,
    events:(Array.isArray(now2.events)?now2.events:[]),
    reasonCode:now2.reasonCode||'', reasonNote:now2.reasonNote||'', reasonAt:now2.reasonAt||'',
    arrivedAt:v.arrivedAt, arrivedBy:v.arrivedBy, clearedAt:v.clearedAt, clearedBy:v.clearedBy});
  ckPersist(); ckAfter('pier');
}
// สรุป No-show ของ booking ในวันนั้น (ใช้ร่วมกับ By-trip) → {van:{...}, pier:{...}, noShow, reasonText}
function ckSummary(b, date){
  var t=ckTripOn(b,date); if(!t) return null;
  var booked=ckBookedPax(t);
  var v=ckRead(b,date,'van'), p=ckRead(b,date,'pier');
  var out={booked:booked, van:v, pier:p, vanNoShow:0, pierNoShow:0, noShow:0, at:'', reasonText:'', stage:''};
  // van: หายไปกี่คนจากยอดจอง · pier: หายไปกี่คนจากยอดที่ "คาดว่าจะมาถึงท่า" (expected)
  if(v && v.at){ out.vanNoShow = Math.max(0, booked-(v.actualPax!=null?v.actualPax:booked)); }
  if(p && p.at){ var exp=(p.expected!=null?p.expected:booked); out.pierNoShow = Math.max(0, exp-(p.actualPax!=null?p.actualPax:exp)); }
  // ยอดรวมที่ไม่ได้เดินทางจริง = จอง − คนที่ขึ้นเรือจริง (ท่าเรือคือด่านสุดท้าย) · ยังไม่เช็คท่าก็ใช้ค่าจากรถ
  out.noShow = (p && p.at) ? Math.max(0, booked-(p.actualPax!=null?p.actualPax:booked)) : out.vanNoShow;
  // เหตุผลที่โชว์ = ด่านที่เกิด No-show ล่าสุด (ท่าเรือก่อน แล้วค่อยรถรับ)
  var src=null;
  if(p && p.at && out.pierNoShow>0){ src=p; out.stage='pier'; }
  else if(v && v.at && out.vanNoShow>0){ src=v; out.stage='van'; }
  else if(p && p.at){ out.stage='pier'; } else if(v && v.at){ out.stage='van'; }
  if(src){ out.at=src.reasonAt||''; out.reasonText=(src.reasonCode?ckReasonLabel(src.reasonCode):'')+(src.reasonNote?(' · '+src.reasonNote):''); }
  return out;
}
// ป้าย No-show สำหรับหน้าอื่น (By-trip) · ไม่ย้ายแถว ไม่แก้ราคา · แค่ครอบว่าเกิดอะไรขึ้นหน้างาน
function ckNoShowBadge(b, date){
  var s=ckSummary(b,date); if(!s) return '';
  if(s.noShow<=0){
    if(s.pier&&s.pier.at) return '<span class="t2-ckok" title="เช็คอินขึ้นเรือครบแล้ว '+ckEsc(s.booked)+' คน">&#10003; ขึ้นเรือ</span>';
    if(s.van&&s.van.at)   return '<span class="t2-ckok" title="เช็คอินขึ้นรถครบแล้ว '+ckEsc(s.booked)+' คน">&#10003; ขึ้นรถ</span>';
    return '';
  }
  var stage=(s.stage==='pier')?'ท่าเรือ':'รถรับ';
  var full=(s.noShow>=s.booked);
  var tip='No-show '+s.noShow+'/'+s.booked+' คน ('+stage+')'+(s.at?(' · '+s.at):'')+(s.reasonText?(' · '+s.reasonText):'')+' — บันทึกจากหน้าเช็คอิน · ไม่ได้แก้ยอดจอง/ราคา (สรุปที่ Travel Summary)';
  return '<span class="t2-ckns'+(full?' t2-ckns-full':'')+'" title="'+ckEsc(tip)+'">&#9888; No-show '+s.noShow+(s.at?(' · '+ckEsc(s.at)):'')+'</span>';
}
function ckReasonOpen(bkId, date, kind){
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var cur=ckRead(b,date,kind)||{};
  _ckReason={bkId:bkId, date:date, kind:kind||'van', code:cur.reasonCode||'', note:cur.reasonNote||'', at:cur.reasonAt||ckNowHM()};
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t);
  var cap=(typeof ckCap==='function')?ckCap(b,date,_ckReason.kind,booked):booked;
  var ck=cur, actual=(ck.actualPax!=null?ck.actualPax:cap), ns=Math.max(0,cap-actual);
  var vch=b.voucherRef||b.code||b.id;
  var opts=CK_NOSHOW_REASONS.map(function(r){
    var on=(_ckReason.code===r.code);
    return '<button type="button" onclick="ckReasonPick(\''+r.code+'\')" style="text-align:left;border:1.5px solid '+(on?'#C0392B':'#E4E1D9')+';background:'+(on?'#FCEBEB':'#fff')+';color:'+(on?'#A32D2D':'#4a4a45')+';border-radius:10px;padding:9px 12px;font-size:12.5px;font-weight:'+(on?'700':'600')+';cursor:pointer;font-family:inherit">'+ckEsc(r.label)+(r.expectAtPier?' <span style="font-size:9px;font-weight:700;color:#6B289A;background:#F4E8FB;border-radius:5px;padding:1px 5px">ไปเจอที่ท่า</span>':'')+'</button>';
  }).join('');
  host.innerHTML=''
    +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" style="position:fixed;inset:0;background:rgba(20,24,22,.42);backdrop-filter:blur(2px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px">'
    +'<div style="background:#fff;border-radius:16px;width:min(520px,96vw);max-height:90vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28)">'
    +'  <div style="padding:16px 20px;border-bottom:1px solid #EFECE4;display:flex;align-items:center;justify-content:space-between;gap:12px">'
    +'    <div><div style="font-size:15px;font-weight:800;color:#15201a">เหตุผล No-show · '+(_ckBase(kind)==='pier'?'ท่าเรือ':'รถรับ')+'</div>'
    +'    <div style="font-size:11.5px;color:#8a8a82;margin-top:2px;font-family:\'DM Mono\',monospace">'+ckEsc(vch)+' · '+ckEsc(b.leadPax||'')+' · จอง '+booked+' · ขึ้นจริง '+actual+' · <b style="color:#A32D2D">No-show '+ns+'</b></div></div>'
    +'    <button onclick="ckReasonClose()" style="background:transparent;border:none;font-size:20px;color:#9a9a92;cursor:pointer;line-height:1">&times;</button>'
    +'  </div>'
    +'  <div style="padding:16px 20px">'
    +'    <div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">เลือกเหตุผล</div>'
    +'    <div id="ck-reason-opts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+opts+'</div>'
    +'    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">'
    +'      <div style="flex:none"><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">เวลา</div>'
    +'      <input id="ck-reason-at" type="time" value="'+ckEsc(_ckReason.at)+'" style="border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;font-family:\'DM Mono\',monospace;width:130px;box-sizing:border-box"></div>'
    +'      <div style="flex:1;min-width:200px"><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">หมายเหตุ</div>'
    +'      <input id="ck-reason-note" type="text" value="'+ckEsc(_ckReason.note)+'" placeholder="เช่น โทร 3 ครั้งไม่รับ · แจ้ง sales แล้ว" style="border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;width:100%;box-sizing:border-box;font-family:inherit"></div>'
    +'    </div>'
    +'    <div style="font-size:11px;color:#8a8a82;margin-top:12px;line-height:1.5">บันทึกแล้วจะไปขึ้นป้าย No-show ที่หน้า <b>By trip · date</b> และส่งต่อให้ <b>Pier Check-in</b> · ยอดจองและราคาไม่ถูกแก้ (สรุปชาร์จ/ไม่ชาร์จที่ Travel Summary)</div>'
    +'  </div>'
    +'  <div style="padding:12px 20px 18px;display:flex;gap:9px;justify-content:flex-end">'
    +'    <button onclick="ckReasonClose()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>'
    +'    <button onclick="ckReasonSave()" style="border:none;background:#C0392B;color:#fff;border-radius:9px;padding:9px 20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">บันทึกเหตุผล</button>'
    +'  </div>'
    +'</div></div>';
}
function ckReasonPick(code){
  _ckReason.code=code;
  var box=document.getElementById('ck-reason-opts'); if(!box) return;
  Array.prototype.forEach.call(box.querySelectorAll('button'), function(btn,i){
    var r=CK_NOSHOW_REASONS[i], on=(r&&r.code===code);
    btn.style.borderColor=on?'#C0392B':'#E4E1D9'; btn.style.background=on?'#FCEBEB':'#fff';
    btn.style.color=on?'#A32D2D':'#4a4a45'; btn.style.fontWeight=on?'700':'600';
  });
}
function ckReasonClose(){ var h=document.getElementById('ck-reason-host'); if(h) h.innerHTML=''; }
function ckReasonSave(){
  if(!ckGuard()) return;                                   /* §ckPerm */
  var st=_ckReason; if(!st.bkId) return ckReasonClose();
  if(!st.code){ alert('Please pick a reason first.'); return; }
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===st.bkId; }); if(!b) return ckReasonClose();
  var atEl=document.getElementById('ck-reason-at'), noteEl=document.getElementById('ck-reason-note');
  var t=ckTripOn(b,st.date)||{}, booked=ckBookedPax(t);
  var cap=(typeof ckCap==='function')?ckCap(b,st.date,st.kind,booked):booked;
  var cur=ckRead(b,st.date,st.kind)||{};
  var actual=(cur.actualPax!=null?cur.actualPax:cap);
  ckWrite(b, st.date, st.kind, {
    actualPax:actual, noShow:Math.max(0,cap-actual), expected:cap,
    events:(Array.isArray(cur.events)?cur.events:[]),
    at:cur.at||new Date().toISOString(), by:cur.by||ckMe(),
    reasonCode:st.code, reasonNote:(noteEl?noteEl.value:st.note)||'', reasonAt:(atEl?atEl.value:st.at)||''
  });
  ckPersist(); ckReasonClose();
  if(_ckBase(st.kind)==='pier'){ if(typeof renderPierCheckin==='function') renderPierCheckin(); }
  else { if(typeof renderVanCheckin==='function') renderVanCheckin(); }
}
function ckEventOpen(bkId, date, kind, type){
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var T=CK_EVENT_TYPES[type]||CK_EVENT_TYPES.no_show;
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t);
  var cap=(typeof ckCap==='function')?ckCap(b,date,kind,booked):booked;
  var cur=ckRead(b,date,kind)||{};
  var actual=(cur.actualPax!=null?cur.actualPax:cap);
  if(actual<=0){ alert('ไม่มีคนเหลือให้บันทึกแล้ว (ตอนนี้ 0 คน)'); return; }
  var _pbAll=ckPaxBreak(t.pax); _ckEvBooked=_pbAll;
  // §evAlwaysSplit (2026-08-01) · บังคับระบุ AD/CHD/INF/FOC ทุกครั้ง
  //   เดิมใบที่มีประเภทเดียวให้กรอกรวม แล้วเดาประเภทให้ตอนบันทึก — เดาผิดเมื่อไรตัวเลขแยกประเภทเพี้ยนทันที
  _ckEvMixed=(['ad','chd','inf','foc'].filter(function(k){ return (_pbAll[k]||0)>0; }).length>0);
  _ckEv={bkId:bkId, date:date, kind:kind||'van', type:T.key, code:(T.key==='cxl'?'cancel_onsite':''), note:'', at:ckNowHM()};
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  var opts=CK_NOSHOW_REASONS.map(function(r,ix){
    var on=(_ckEv.code===r.code);
    return '<button type="button" data-ix="'+ix+'" onclick="ckEvPick(\''+r.code+'\')" style="text-align:left;border:1.5px solid '+(on?T.color:'#E4E1D9')+';background:'+(on?T.bg:'#fff')+';color:'+(on?T.color:'#4a4a45')+';border-radius:10px;padding:9px 12px;font-size:12.5px;font-weight:'+(on?'700':'600')+';cursor:pointer;font-family:inherit">'+ckEsc(r.label)+(r.expectAtPier?' <span style="font-size:9px;font-weight:700;color:#6B289A;background:#F4E8FB;border-radius:5px;padding:1px 5px">ไปเจอที่ท่า</span>':'')+'</button>';
  }).join('');
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" style="position:fixed;inset:0;background:rgba(20,24,22,.42);backdrop-filter:blur(2px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px">'
   +'<div style="background:#fff;border-radius:16px;width:min(520px,96vw);max-height:90vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28)">'
   +'  <div style="padding:16px 20px;border-bottom:1px solid #EFECE4;display:flex;align-items:center;justify-content:space-between;gap:12px">'
   +'    <div><div style="font-size:15px;font-weight:800;color:'+T.color+'">'+ckEsc(T.label)+' · '+ckEsc(T.full)+'</div>'
   +'    <div style="font-size:11.5px;color:#8a8a82;margin-top:2px;font-family:\'DM Mono\',monospace">'+ckEsc(b.voucherRef||b.code||b.id)+' · '+ckEsc(b.leadPax||'')+' · จอง '+booked+' · ตอนนี้ '+actual+' คน</div></div>'
   +'    <button onclick="ckReasonClose()" style="background:transparent;border:none;font-size:20px;color:#9a9a92;cursor:pointer;line-height:1">&times;</button>'
   +'  </div>'
   +'  <div style="padding:16px 20px">'
   +'    <div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">กี่คน'+(_ckEvMixed?' · แยกประเภท':'')+'</div>'
   +'    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
   +(_ckEvMixed
     ? PAXK.map(function(k){ var left=ckPaxLeft(b,date,k,_ckEvBooked[k]); if(left<=0) return '';
         return '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:9.5px;font-weight:700;color:#8a8a82;text-transform:uppercase">'+k.toUpperCase()+' <span style="color:#c8c6be">/'+left+'</span></span>'
           +'<span class="ck-stp" style="border-color:'+T.bd+'"><button onclick="_ckEvBumpK(\''+k+'\',-1)">&minus;</button><span class="ck-n" id="ck-ev-'+k+'" data-max="'+left+'" style="min-width:28px;font-size:15px">0</span><button onclick="_ckEvBumpK(\''+k+'\',1)">+</button></span></span>'; }).join('')
     : '<span class="ck-stp" style="border-color:'+T.bd+'"><button onclick="_ckEvBump(-1)">&minus;</button><span class="ck-n" id="ck-ev-pax" style="min-width:34px;font-size:16px">1</span><button onclick="_ckEvBump(1)">+</button></span>')
   +'      <button type="button" onclick="_ckEvAll('+actual+')" style="border:1px solid '+T.bd+';background:'+T.bg+';color:'+T.color+';border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">ทั้งหมด '+actual+' คน</button>'
   +'      <span id="ck-ev-left" style="font-size:11.5px;color:#8a8a82"></span>'
   +'    </div>'
   +'    <div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 8px">เลือกเหตุผล</div>'
   +'    <div id="ck-reason-opts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+opts+'</div>'
   +'    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">'
   +'      <div style="flex:none"><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">เวลา</div>'
   +'      <input id="ck-reason-at" type="time" value="'+ckEsc(_ckEv.at)+'" style="border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;font-family:\'DM Mono\',monospace;width:130px;box-sizing:border-box"></div>'
   +'      <div style="flex:1;min-width:200px"><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">หมายเหตุ</div>'
   +'      <input id="ck-reason-note" type="text" placeholder="เช่น โทร 3 ครั้งไม่รับ · แจ้ง sales แล้ว" style="border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;width:100%;box-sizing:border-box;font-family:inherit"></div>'
   +'    </div>'
   +'    <div style="font-size:11px;color:#8a8a82;margin-top:12px;line-height:1.5">จำนวนจริงจะลดลงตามที่ระบุ · ยอดจองและราคายังไม่ถูกแก้ — <b>Travel Summary</b> เป็นตัวสรุปว่าชาร์จเท่าไร หรือเลื่อนวัน</div>'
   +'  </div>'
   +'  <div style="padding:12px 20px 18px;display:flex;gap:9px;justify-content:flex-end">'
   +'    <button onclick="ckReasonClose()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>'
   +'    <button onclick="ckEvSave()" style="border:none;background:'+T.color+';color:#fff;border-radius:9px;padding:9px 20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">บันทึก '+ckEsc(T.label)+'</button>'
   +'  </div>'
   +'</div></div>';
  window._ckEvMax=actual; _ckEvLeft();
}
function _ckEvBumpK(k,n){ var el=document.getElementById('ck-ev-'+k); if(!el) return; var mx=+el.getAttribute('data-max')||0;
  el.textContent=Math.max(0,Math.min(mx,(parseInt(el.textContent,10)||0)+n)); _ckEvLeft(); }
function _ckEvBreak(){ var o={ad:0,chd:0,inf:0,foc:0}; PAXK.forEach(function(k){ var el=document.getElementById('ck-ev-'+k); if(el) o[k]=parseInt(el.textContent,10)||0; }); return o; }
function ckEvPick(code){
  _ckEv.code=code;
  var T=CK_EVENT_TYPES[_ckEv.type]||CK_EVENT_TYPES.no_show;
  var box=document.getElementById('ck-reason-opts'); if(!box) return;
  Array.prototype.forEach.call(box.querySelectorAll('button'), function(btn,i){
    var r=CK_NOSHOW_REASONS[i], on=(r&&r.code===code);
    btn.style.borderColor=on?T.color:'#E4E1D9'; btn.style.background=on?T.bg:'#fff';
    btn.style.color=on?T.color:'#4a4a45'; btn.style.fontWeight=on?'700':'600';
  });
}
function _ckEvPax(){
  if(_ckEvMixed){ var o=_ckEvBreak(); return (o.ad+o.chd+o.inf+o.foc)||0; }
  var el=document.getElementById('ck-ev-pax'); return el?(parseInt(el.textContent,10)||1):1;
}
function _ckEvBump(n){ var el=document.getElementById('ck-ev-pax'); if(!el) return; var mx=window._ckEvMax||1; el.textContent=Math.max(1,Math.min(mx,_ckEvPax()+n)); _ckEvLeft(); }
function _ckEvAll(n){
  if(_ckEvMixed){ PAXK.forEach(function(k){ var el=document.getElementById('ck-ev-'+k); if(el) el.textContent=(+el.getAttribute('data-max')||0); }); _ckEvLeft(); return; }
  var el=document.getElementById('ck-ev-pax'); if(el) el.textContent=Math.max(1,n); _ckEvLeft();
}
function _ckEvLeft(){ var h=document.getElementById('ck-ev-left'); if(!h) return; var mx=window._ckEvMax||0; h.innerHTML='เหลือขึ้นจริง <b style="font-family:\'DM Mono\',monospace;font-size:14px;color:#0F6E56">'+Math.max(0,mx-_ckEvPax())+'</b> คน'; }
function ckEvSave(){
  var st=_ckEv; if(!st.bkId) return ckReasonClose();
  if(!st.code){ alert('เลือกเหตุผลก่อนครับ'); return; }
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===st.bkId; }); if(!b) return ckReasonClose();
  var t=ckTripOn(b,st.date)||{}, booked=ckBookedPax(t);
  var cap=(typeof ckCap==='function')?ckCap(b,st.date,st.kind,booked):booked;
  var cur=ckRead(b,st.date,st.kind)||{};
  var actual=(cur.actualPax!=null?cur.actualPax:cap);
  if(!ckGuard()) return;                                   /* §ckPerm */
  var _n0=_ckEvPax();
  if(_ckEvMixed && _n0<=0){ alert('ระบุจำนวนก่อนครับ — กด + ที่ประเภทที่ยกเลิก (AD / CHD / INF / FOC)'); return; }
  var n=Math.max(1,Math.min(actual,_n0));
  var atEl=document.getElementById('ck-reason-at'), noteEl=document.getElementById('ck-reason-note');
  var ev=(Array.isArray(cur.events)?cur.events.slice():[]);
  var _pk;
  if(_ckEvMixed) _pk=_ckEvBreak();
  else { var _pb=ckPaxBreak((ckTripOn(b,st.date)||{}).pax); _pk={ad:0,chd:0,inf:0,foc:0};
         var _only=['ad','chd','inf','foc'].filter(function(k){ return (_pb[k]||0)>0; })[0]||'ad'; _pk[_only]=n; }
  ev.push({type:st.type, pax:n, paxBreak:_pk, reasonCode:st.code, note:(noteEl?noteEl.value.trim():''), at:(atEl?atEl.value:st.at)||'', by:ckMe(), ts:new Date().toISOString()});
  var newActual=Math.max(0, actual-n);
  ckWrite(b, st.date, st.kind, {
    actualPax:newActual, noShow:Math.max(0,cap-newActual), expected:cap,
    at:cur.at||null, by:cur.by||null, events:ev,
    reasonCode:st.code, reasonNote:(noteEl?noteEl.value.trim():''), reasonAt:(atEl?atEl.value:st.at)||''
  });
  ckPersist(); ckReasonClose(); ckAfter(st.kind);
}

// ── ปุ่มนับ / ปุ่ม ✓ (ใช้ร่วมกันทั้ง 2 หน้า) ───────────────────────────────
// เพดานของแต่ละด่าน · รถรับ = ยอดจอง · ท่าเรือ = ยอดที่คาดว่าจะมาถึงท่า (หักคนที่ No-show ตอนรถรับแล้ว)
function ckCap(b, date, kind, booked){
  var sp=_ckSplitPax(b,date,kind); if(sp!=null) return sp;
  return (_ckBase(kind)==='pier')?pckExpected(b,date,booked):booked; }
/* §ckPierSelf · เพดานที่กดขึ้นไปได้ · ต่างจาก ckCap ที่เป็น "ยอดที่รอรับ"
   ที่ท่าเรือกลับขึ้นไปได้ถึงยอดจองเต็มเสมอ · คนที่ไม่ได้ขึ้นรถตามมาเองที่ท่าได้จริง
   และหน้าท่าคือคนที่เห็นตัวเป็น ๆ จึงมีสิทธิ์ยืนยันมากกว่าบันทึกของรถเมื่อเช้า */
function ckCeil(b, date, kind, booked){
  var sp=_ckSplitPax(b,date,kind); if(sp!=null) return sp;
  return booked; }
// re-render โดยไม่เด้งกลับหัวหน้า · เก็บตำแหน่ง scroll ไว้แล้วคืนหลังวาดใหม่ (แพทเทิร์นเดียวกับ vanJobsToggleSent)
function ckAfter(kind){
  var sy=(typeof window!=='undefined')?(window.scrollY||window.pageYOffset||0):0;
  try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(_){}
  if(_ckBase(kind)==='pier'){ if(typeof renderPierCheckin==='function') renderPierCheckin(); }
  else { if(typeof renderVanCheckin==='function') renderVanCheckin(); }
  try{ window.scrollTo(0, sy); }catch(_){}
}
// ── สถานะตามเวลารับ ──────────────────────────────────────────────────────
// "07:30-07:45" / "07.30" → นาทีของวัน · คืน null ถ้าอ่านไม่ออก
function ckParseTime(str){
  var m=String(str||'').match(/(\d{1,2})[:.](\d{2})(?:\s*[-–~]\s*(\d{1,2})[:.](\d{2}))?/);
  if(!m) return null;
  var st=(+m[1])*60+(+m[2]);
  var en=(m[3]!=null)?((+m[3])*60+(+m[4])):st;
  if(en<st) en=st;
  return {start:st, end:en};
}
function ckNowMin(){ var d=new Date(); return d.getHours()*60+d.getMinutes(); }
function ckIsToday(date){ return date===((typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):''); }
// done = เช็คอินแล้ว · off = ไม่ใช่วันนี้/ไม่มีเวลา · wait → soon → due → late
function ckTimeState(timeStr, date, checked){
  if(checked) return {k:'done'};
  if(!ckIsToday(date)) return {k:'off'};
  var t=ckParseTime(timeStr); if(!t) return {k:'off'};
  var now=ckNowMin();
  if(now < t.start-CK_LEAD_MIN) return {k:'wait', mins:t.start-now};
  if(now < t.start)             return {k:'soon', mins:t.start-now};
  if(now <= t.end+CK_GRACE_MIN) return {k:'due',  mins:0};
  var over=now-t.end;
  if(over>CK_STALE_MIN) return {k:'miss', mins:over};   // เลยมาเกิน 2 ชม. (ทริปออกไปแล้ว) → บอกเงียบๆ ไม่ต้องแดงทั้งตาราง
  return {k:'late', mins:over};
}
// 45 → "45 น." · 492 → "8 ชม. 12 น."
function ckMinLbl(m){ m=Math.max(0,m|0); if(m<60) return m+' น.'; var h=Math.floor(m/60), r=m%60; return h+' ชม.'+(r?(' '+r+' น.'):''); }
function ckTimeChip(st, timeStr, kind){
  var e=ckEsc, lbl=e(timeStr||'—');
  var verb=(_ckBase(kind)==='pier')?'ขึ้นเรือ':'ขึ้นรถ';
  if(st.k==='done') return '<span class="ck-tm ck-tm-done" title="'+verb+'แล้ว">'+lbl+'</span>';
  if(st.k==='miss') return '<span class="ck-tm ck-tm-miss" title="เลยเวลารับมา '+ckMinLbl(st.mins)+' · ยังไม่ได้เช็คอิน">'+lbl+'<b>ยังไม่เช็คอิน</b></span>';
  if(st.k==='late') return '<span class="ck-tm ck-tm-late" title="เลยเวลารับมา '+ckMinLbl(st.mins)+' · ยังไม่'+verb+'">'+lbl+'<b>เลย '+ckMinLbl(st.mins)+'</b></span>';
  if(st.k==='due')  return '<span class="ck-tm ck-tm-due"  title="ถึงเวลารับแล้ว">'+lbl+'<b>ถึงเวลา</b></span>';
  if(st.k==='soon') return '<span class="ck-tm ck-tm-soon" title="ใกล้ถึงเวลารับ">'+lbl+'<b>อีก '+st.mins+' น.</b></span>';
  return '<span class="ck-tm">'+lbl+'</span>';
}
// เวลารับที่เร็วที่สุดของกลุ่ม + สถานะรวม (ใช้ที่หัวรถ/การ์ดรถ) · late ถ้ามีอย่างน้อย 1 รายเลยเวลา
function ckGroupTime(rows, date){
  var best=null, worst='off', rank={off:0,wait:1,miss:1,soon:2,due:3,late:4}, nLate=0;
  rows.forEach(function(r){
    var tm=(r.O&&r.O.pickupTimeFinal)||(r.t&&(r.t.pickupTime||r.t.pickupFinal))||'';
    var t=ckParseTime(tm); if(t && (best===null || t.start<best.start)){ best={start:t.start, label:tm}; }
    var on=!!(r.ck&&r.ck.at);
    var st=ckTimeState(tm, date, on);
    if(st.k==='late'){ nLate++; }
    if(rank[st.k]>rank[worst]) worst=st.k;
  });
  return {label:best?best.label:'', state:worst, late:nLate};
}
function ckStartTick(view, fn){
  if(_ckTick) clearInterval(_ckTick);
  _ckTick=setInterval(function(){
    var host=document.getElementById(view+'-host');
    var vw=document.getElementById('view-'+view);
    if(!host || !vw || (vw.className||'').indexOf('active')<0){ return; }
    if(document.getElementById('ck-reason-ov')) return;      // เปิด modal อยู่ · อย่าวาดทับ
    var sy=window.scrollY||0; fn(); try{ window.scrollTo(0,sy); }catch(_){}
  }, 60000);
}
// ตรึงหัวคอลัมน์ + หัวรถ ให้พอดีกับความสูงจริงของหัววัน (วัดหลังวาด · เลี่ยง calc ซ้อน var)
function ckSyncSticky(host){
  if(!host || typeof requestAnimationFrame!=='function') return;
  const apply=function(){
    var tb=52;
    try{ var v=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar'),10); if(!isNaN(v)&&v>=0) tb=v; }catch(_){}
    var hd=host.querySelector('.ck-hd');      var hH=hd?Math.round(hd.getBoundingClientRect().height):0;
    var ub=host.querySelector('.ck-unitbar'); var uH=ub?Math.round(ub.getBoundingClientRect().height):0;
    var th=host.querySelector('table.ck-tbl thead th');
    var thH=th?Math.round(th.getBoundingClientRect().height):26;
    if(hH+uH > Math.max(240, (window.innerHeight||800)*0.45)){ hH=0; uH=0; }   // กันค่าเพี้ยน · ดีกว่าดันตารางหล่น
    host.style.setProperty('--ck-hd-top',   tb+'px');
    host.style.setProperty('--ck-unit-top', (tb+hH)+'px');
    host.style.setProperty('--ck-th-top',   (tb+hH+uH)+'px');
    host.style.setProperty('--ck-grp-top',  (tb+hH+uH+thH)+'px');
  };
  requestAnimationFrame(apply);
  // ความสูงของแถบบนเปลี่ยนได้หลังวัดครั้งแรก (เว็บฟอนต์โหลดเสร็จ · การ์ดโปรแกรมตัดบรรทัดใหม่ตอนย่อจอ)
  // ถ้าไม่วัดซ้ำ ค่า top จะค้างของเก่า → หัวคอลัมน์ลอยต่ำ เห็นแถวข้อมูลโผล่เหนือมัน
  setTimeout(apply, 300); setTimeout(apply, 1200);
  try{ if(document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(apply); }catch(_){}
  try{
    if(host._ckRO) host._ckRO.disconnect();
    if(typeof ResizeObserver==='function'){
      host._ckRO=new ResizeObserver(function(){ apply(); });
      var hd2=host.querySelector('.ck-hd'), ub2=host.querySelector('.ck-unitbar');
      if(hd2) host._ckRO.observe(hd2);
      if(ub2) host._ckRO.observe(ub2);
    }
  }catch(_){}
  try{ if(host._ckWinRz) window.removeEventListener('resize', host._ckWinRz);
       host._ckWinRz=function(){ apply(); }; window.addEventListener('resize', host._ckWinRz); }catch(_){}
}
function ckStep(bkId, date, kind, delta){
  if(!ckGuard()) return;                                   /* §ckPerm */
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t), cap=ckCap(b,date,kind,booked);
  var cur=ckRead(b,date,kind)||{};
  /* §ckPierSelf · เพดานเป็นยอดจอง ไม่ใช่ยอดที่รถส่งมา · ที่ท่าเรือเท่านั้น */
  var isPier=(_ckBase(kind)==='pier');
  var ceil=isPier?ckCeil(b,date,kind,booked):cap;
  var prev=(cur.actualPax!=null?cur.actualPax:cap);
  var a=Math.max(0,Math.min(ceil,prev+delta));
  if(a===prev) return;                                      /* ชนเพดานหรือชน 0 · ไม่มีอะไรเปลี่ยน */
  /* §ckSelfAlloc · จะนับเกินยอดที่รอรับ ต้องบอกก่อนว่าใครมา · ไม่เขียนตัวเลขลอย ๆ
     เพราะเลขก้อนนี้ไหลไปครัว ทะเบียนผู้เดินทาง สัดส่วนสัญชาติ และยอดหัวรายเอเยนต์ */
  if(isPier && delta>0 && a>cap) return ckSelfOpen(bkId, date, kind);
  var ns=Math.max(0,cap-a);                                 /* นับเกินยอดที่รอรับ = ไม่มีคนขาด */
  var over=Math.max(0,a-cap);                               /* ตามมาเองที่ท่ากี่คน */
  var val={actualPax:a, noShow:ns, expected:cap, at:cur.at||null, by:cur.by||null,
    events:(Array.isArray(cur.events)?cur.events:[]),
    reasonCode:ns>0?(cur.reasonCode||''):'', reasonNote:ns>0?(cur.reasonNote||''):'', reasonAt:ns>0?(cur.reasonAt||''):''};
  /* กด − ลงมา · ตัดคนที่ยืนยันไว้ออกทีละคน เริ่มจากประเภทที่ใส่ไว้เยอะสุด */
  if(over>0){ val.selfAdd=ckSelfTrim(cur.selfAdd, over); }
  else val.selfAdd=null;
  ckWrite(b,date,kind,val);
  ckPersist(); ckAfter(kind);
  if(ns>0 && !(cur.reasonCode)) ckReasonOpen(bkId,date,kind);   // ลดคนแล้วยังไม่มีเหตุผล → ถามทันที
}
/* §ckSelfAlloc · ย่อจำนวนที่ยืนยันไว้ให้เหลือ n คน · ตัดจากประเภทที่มีเยอะสุดก่อน */
function ckSelfTrim(sa, n){
  if(!sa) return {pax:n, at:ckNowHM(), by:ckMe(), ts:new Date().toISOString()};
  var out={pax:n, at:sa.at||ckNowHM(), by:sa.by||ckMe(), ts:sa.ts||new Date().toISOString(), note:sa.note||''};
  PAXK.forEach(function(k){ out[k]=Math.max(0,+sa[k]||0); });
  var tot=0; PAXK.forEach(function(k){ tot+=out[k]; });
  while(tot>n){
    var big='', bn=0;
    PAXK.forEach(function(k){ if(out[k]>bn){ bn=out[k]; big=k; } });
    if(!big) break;
    out[big]--; tot--;
  }
  return out;
}
/* หน้าต่าง "ตามมาเองที่ท่า" · ระบุว่าคนที่ไม่ได้ขึ้นรถแต่มาถึงท่า เป็นใครบ้าง */
function ckSelfOpen(bkId, date, kind){
  if(!ckGuard()) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  kind=kind||'pier';
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t);
  var cap=ckCap(b,date,kind,booked), room=Math.max(0, booked-cap);
  if(room<=0){ alert('ใบนี้ไม่มีคนที่ค้างอยู่ให้เพิ่มแล้ว'); return; }
  var pb=ckPaxBreak(t.pax), cur=ckRead(b,date,kind)||{}, sa=cur.selfAdd||null;
  _ckSelf={bkId:bkId, date:date, kind:kind, note:(sa&&sa.note)||''};
  PAXK.forEach(function(k){ _ckSelf[k]=sa?Math.max(0,+sa[k]||0):0; });
  /* ยังไม่เคยแยกประเภทมาก่อน · ตั้งต้นให้ที่ผู้ใหญ่ตามจำนวนที่ค้างอยู่ */
  var had=0; PAXK.forEach(function(k){ had+=_ckSelf[k]; });
  if(!had) _ckSelf.ad=Math.min(1, room);
  _ckSelf._booked=pb; _ckSelf._room=room; _ckSelf._cap=cap; _ckSelf._bookedTot=booked;
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  var stp=PAXK.map(function(k){
    var lostK=Math.max(0,(pb[k]||0)-ckPaxLeft(b,date,k,pb[k]||0)+_ckSelf[k]);   /* ของประเภทนี้ที่ยังไม่ได้นับ */
    lostK=Math.min(lostK, room);            /* §ckSelfUI · เพิ่มได้ไม่เกินยอดที่ยังขาดทั้งใบ */
    if(lostK<=0 && !_ckSelf[k]) return '';
    return '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:4px">'
      +'<span style="font-size:9.5px;font-weight:700;color:#8a8a82;text-transform:uppercase">'+k.toUpperCase()+'</span>'
      +'<span class="ck-stp" style="border-color:#B7E2D2"><button onclick="ckSelfBump(\''+k+'\',-1)">&minus;</button>'
      +'<span class="ck-n" id="ck-self-'+k+'" data-max="'+lostK+'" style="min-width:34px;font-size:16px">'+_ckSelf[k]+'</span>'
      +'<button onclick="ckSelfBump(\''+k+'\',1)">+</button></span>'
      +'<span style="font-size:9.5px;color:#a5a49d">ค้าง '+lostK+'</span></span>';
  }).join('');
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" style="position:fixed;inset:0;background:rgba(20,24,22,.42);backdrop-filter:blur(2px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:18px">'
   +'<div style="background:#fff;border-radius:16px;width:min(520px,96vw);max-height:90vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28)">'
   +'  <div style="padding:16px 20px;border-bottom:1px solid #EFECE4;display:flex;align-items:center;justify-content:space-between;gap:12px">'
   +'    <div><div style="font-size:15px;font-weight:800;color:#0F6E56">&#8617; ตามมาเองที่ท่า</div>'
   +'    <div style="font-size:11.5px;color:#8a8a82;margin-top:2px;font-family:\'DM Mono\',monospace">'
        +ckEsc(b.voucherRef||b.code||b.id)+' · '+ckEsc(b.leadPax||'')+' · จอง '+booked+' · ขึ้นรถมา '+cap+'</div></div>'
   +'    <button onclick="ckReasonClose()" style="background:transparent;border:none;font-size:20px;color:#9a9a92;cursor:pointer;line-height:1">&times;</button>'
   +'  </div>'
   +'  <div style="padding:16px 20px">'
   +'    <div style="background:#F3FAF7;border:1px solid #CFE9DF;border-radius:11px;padding:10px 13px;font-size:12px;color:#0F6E56;line-height:1.75;margin-bottom:14px">'
   +'      คนกลุ่มนี้ไม่ได้ขึ้นรถมา แต่มาถึงท่าเอง · <b>บันทึกของเช็คอินรถจะไม่ถูกแก้</b><br>'
   +'      ต้องบอกว่าเป็นผู้ใหญ่หรือเด็ก เพราะตัวเลขนี้ไปที่ครัว ทะเบียนผู้เดินทาง และยอดหัวรายเอเยนต์</div>'
   +'    <div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">ใครมาบ้าง</div>'
   +'    <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">'+(stp||'<span style="font-size:12px;color:#a5a49d">ไม่มีคนค้าง</span>')+'</div>'
   +'    <div id="ck-self-left" style="font-size:11.5px;color:#8a8a82;margin-top:10px"></div>'
   +'    <div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 6px">หมายเหตุ</div>'
   +'    <input id="ck-self-note" type="text" value="'+ckEsc(_ckSelf.note)+'" placeholder="เช่น นั่งแท็กซี่มาเอง · เจอที่ท่า 09:40" style="width:100%;border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit">'
   +'  </div>'
   +'  <div style="padding:14px 20px;border-top:1px solid #EFECE4;display:flex;justify-content:flex-end;gap:8px">'
   +'    <button onclick="ckReasonClose()" style="border:1px solid #E4E1D9;background:#fff;color:#4a4a45;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>'
   +'    <button id="ck-self-go" onclick="ckSelfSave()" style="border:none;background:#0F6E56;color:#fff;border-radius:9px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">ยืนยันว่ามาถึงแล้ว</button>'
   +'  </div>'
   +'</div></div>';
  ckSelfSync();
}
function ckSelfBump(k, d){
  var mx=+((document.getElementById('ck-self-'+k)||{}).dataset||{}).max||0;
  var tot=0; PAXK.forEach(function(x){ if(x!==k) tot+=_ckSelf[x]; });
  var room=_ckSelf._room||0;
  _ckSelf[k]=Math.max(0, Math.min(mx, Math.min(room-tot, _ckSelf[k]+d)));
  var el=document.getElementById('ck-self-'+k); if(el) el.textContent=_ckSelf[k];
  ckSelfSync();
}
function ckSelfSync(){
  var tot=0; PAXK.forEach(function(k){ tot+=_ckSelf[k]; });
  var el=document.getElementById('ck-self-left');
  var room=_ckSelf._room||0;
  if(el) el.innerHTML='ยืนยันแล้ว <b style="font-family:\'DM Mono\',monospace;font-size:15px;color:#0F6E56">'+tot+'</b> คน'
    +' · รวมขึ้นเรือจะเป็น <b style="font-family:\'DM Mono\',monospace;font-size:15px;color:#0F6E56">'+((_ckSelf._cap||0)+tot)+'</b> จากยอดจอง '+(_ckSelf._bookedTot||0)
    +(tot<room?('<span style="color:#a5a49d"> · เพิ่มได้อีก '+(room-tot)+'</span>'):'');
  var go=document.getElementById('ck-self-go');
  if(go){ go.disabled=(tot<=0); go.style.opacity=tot<=0?'.45':'1'; go.style.cursor=tot<=0?'not-allowed':'pointer'; }
}
function ckSelfSave(){
  if(!ckGuard()) return;
  var st=_ckSelf; if(!st.bkId) return ckReasonClose();
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===st.bkId; }); if(!b) return ckReasonClose();
  var tot=0; PAXK.forEach(function(k){ tot+=Math.max(0,+st[k]||0); });
  if(tot<=0) return ckReasonClose();
  var t=ckTripOn(b,st.date)||{}, booked=ckBookedPax(t), cap=ckCap(b,st.date,st.kind,booked);
  var cur=ckRead(b,st.date,st.kind)||{};
  var note=(document.getElementById('ck-self-note')||{}).value||'';
  var sa={pax:tot, at:ckNowHM(), by:ckMe(), ts:new Date().toISOString(), note:String(note).trim()};
  PAXK.forEach(function(k){ sa[k]=Math.max(0,+st[k]||0); });
  ckWrite(b, st.date, st.kind, {actualPax:Math.min(booked, cap+tot), noShow:0, expected:cap,
    at:cur.at||null, by:cur.by||null, events:(Array.isArray(cur.events)?cur.events:[]),
    reasonCode:'', reasonNote:'', reasonAt:'', selfAdd:sa});
  ckPersist(); ckReasonClose(); ckAfter(st.kind);
}
function ckToggle(bkId, date, kind){
  if(!ckGuard()) return;                                   /* §ckPerm */
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var t=ckTripOn(b,date)||{}, booked=ckBookedPax(t), cap=ckCap(b,date,kind,booked);
  var cur=ckRead(b,date,kind)||{};
  // §pierPay · จะติ๊กขึ้นเรือทั้งที่ยังค้างเงิน → เตือนก่อน · ไม่บล็อก (เรือรอไม่ได้) แต่ต้องเป็นการตัดสินใจข้าม ไม่ใช่ลืม
  if(_ckBase(kind)==='pier' && !cur.at && typeof pckPayGuard==='function' && pckPayGuard(bkId, date)) return;
  if(cur.at){   // กดซ้ำ = ยกเลิกการเช็คอิน (ค่าที่นับไว้ยังอยู่)
    ckWrite(b,date,kind,{actualPax:(cur.actualPax!=null?cur.actualPax:cap), noShow:(cur.noShow!=null?cur.noShow:0), expected:(cur.expected!=null?cur.expected:cap), at:null, by:null,
      events:(Array.isArray(cur.events)?cur.events:[]),
      reasonCode:cur.reasonCode||'', reasonNote:cur.reasonNote||'', reasonAt:cur.reasonAt||''});
    ckPersist(); ckAfter(kind); return;
  }
  var a=(cur.actualPax!=null?cur.actualPax:cap), ns=Math.max(0,cap-a);
  ckWrite(b,date,kind,{actualPax:a, noShow:ns, expected:cap, at:new Date().toISOString(), by:ckMe(),
    events:(Array.isArray(cur.events)?cur.events:[]),
    reasonCode:cur.reasonCode||'', reasonNote:cur.reasonNote||'', reasonAt:cur.reasonAt||''});
  ckPersist(); ckAfter(kind);
  if(ns>0 && !cur.reasonCode) ckReasonOpen(bkId,date,kind);
}

// ── CSS ร่วม · ยกสไตล์หัวหน้า + ตารางมาจาก By-trip (t2-*) ─────────────────
function pckExtraCSS(){ return ''
  +'.ck-fbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#fff;border:1px solid #EDEAE2;border-radius:12px;padding:9px 12px;margin-bottom:10px}'
  +'.ck-fsep{width:1px;height:18px;background:#E7E4DC;margin:0 3px}'
  +'tr.ck-unassigned>td{background:#FFFBF5}'
  +'tr.ck-unassigned>td:first-child{box-shadow:inset 4px 0 0 #E0A33A}'
  +'.pck-host .ck-ao{display:inline-block;font-size:10px;font-weight:700;border-radius:6px;padding:2px 7px;margin:0 3px 3px 0;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}'
  +'.pck-host .ck-aoact{display:flex;gap:4px;margin-top:2px}'
  +'.pck-host .ck-aoact button{border:1px dashed #D8D4CA;background:#fff;color:#a5a49d;border-radius:6px;padding:2px 7px;font-size:9.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +'.pck-host .ck-aoact button:hover{border-style:solid;border-color:#1C4A30;color:#1C4A30}'
  // กรอบล้อมทั้งกลุ่มรถ · สีจาก --vc ที่ตั้งไว้บน tbody ของกลุ่มนั้น (สีประจำรถ เดียวกับ By-trip)
  +'.pck-host tbody.pck-vgrp>tr>td:first-child{border-left:2px solid var(--vc)}'
  +'.pck-host tbody.pck-vgrp>tr>td:last-child{border-right:2px solid var(--vc)}'
  +'.pck-host tbody.pck-vgrp>tr.pck-vhd>td{border-top:2px solid var(--vc);border-left:2px solid var(--vc);border-right:2px solid var(--vc)}'
  +'.pck-host tbody.pck-vgrp>tr:last-child>td{border-bottom:2px solid var(--vc)}'
  +'.pck-host tbody.pck-vgrp{box-shadow:0 1px 5px -3px rgba(15,23,42,.35)}'
  +'.pck-bytog{border:1px solid #E0DCD3;background:#fff;color:#a5a49d;border-radius:5px;width:15px;height:15px;line-height:1;padding:0;margin-right:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;vertical-align:middle}'
  +'.pck-bytog:hover{border-color:#185FA5;color:#185FA5;background:#F2F8FE}'
  +'.pck-host tr.ck-row.ck-arr>td{background:#F3F8FD}'
  +'.pck-host tr.ck-row.ck-arr>td:first-child{box-shadow:inset 4px 0 0 #7EAED8}'
  +'.pck-host tr.ck-row.ck-clr>td{background:#FDF8EE}'
  +'.pck-host tr.ck-row.ck-clr>td:first-child{box-shadow:inset 4px 0 0 #D9A441}'
  // เคลียร์แล้ว = ตรวจ ลค + เก็บเงินครบ → คืนสี agency กับชื่อ ลค ให้อ่านง่าย (ยังไม่เขียวเพราะยังไม่ขึ้นเรือ)
  +'.pck-host tr.ck-row.ck-clr .ck-agblk{filter:none;opacity:1}'
  +'.pck-host tr.ck-row.ck-clr .ck-lead{background:#F6E27A !important;color:#3a2e00}'
  +'.pck-host tr.ck-row.ck-clr .ck-vch,.pck-host tr.ck-row.ck-clr .ck-by{color:#5F5E5A}'
  +'#pck-drawer{position:fixed;inset:0;z-index:100003;font-family:"DM Sans",sans-serif}'
  +'#pck-drawer .pd-scrim{position:absolute;inset:0;background:rgba(0,0,0,.42)}'
  +'#pck-drawer .pd-panel{position:absolute;right:0;top:0;bottom:0;width:430px;max-width:96vw;background:#fff;display:flex;flex-direction:column;box-shadow:-8px 0 28px rgba(0,0,0,.18)}'
  +'#pck-drawer .pd-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:15px 18px;border-bottom:1px solid #EDEAE2}'
  +'#pck-drawer .pd-body{flex:1;overflow:auto;padding:4px 18px 14px}'
  +'#pck-drawer .pd-sec{margin-top:14px}'
  +'#pck-drawer .pd-h{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#a5a49d;padding-bottom:5px;border-bottom:1px solid #EDEAE2;margin-bottom:5px}'
  +'#pck-drawer .pd-r{display:flex;align-items:flex-start;gap:12px;padding:5px 0}'
  +'#pck-drawer .pd-k{flex:0 0 108px;font-size:11px;color:#8a8a82;padding-top:2px}'
  +'#pck-drawer .pd-v{flex:1;min-width:0;font-size:12.5px;color:#2f2f2b;word-break:break-word}'
  +'#pck-drawer .pd-foot{display:flex;gap:7px;padding:11px 18px;border-top:1px solid #EDEAE2;background:#FAF9F6}'
  +'#pck-drawer .pd-btn{flex:1;border:1px solid #D8D4CA;background:#fff;color:#3a3a36;border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}'
  +'#pck-drawer .pd-btn-p{background:#1C4A30;border-color:#1C4A30;color:#fff}';
}
function ckStrandCSS(S){
  /* §strand · แถวค้าง · ต้องอ่านออกว่า "ไม่ต้องรอคนนี้" ในครึ่งวินาที
     ขีดแดงหน้าแถว + ชื่อขีดฆ่า + ทั้งแถวจาง · แต่ยังอ่านชื่อ/เวลา/จุดรับได้ครบ
     เพราะคนขับต้องเทียบกับใบงานที่ถืออยู่ในมือว่าใช่บรรทัดเดียวกัน */
  return S+' tr.ck-strand>td{background:#FBFAF8 !important;color:#9b9a93 !important}'
    +S+' tr.ck-strand:hover>td{background:#F6F4F1 !important}'
    +S+' tr.ck-strand td:first-child{box-shadow:inset 4px 0 0 #C0392B}'
    /* §strandMove · เลื่อนวัน = ม่วง · ยกเลิก = แดง · แยกสีตั้งแต่ขอบแถว
       เพราะสองอย่างนี้คนหน้างานต้องทำคนละแบบ (เลื่อนวัน = ใบยังอยู่ แค่ไปวันอื่น) */
    +S+' tr.ck-strand.mv td:first-child{box-shadow:inset 4px 0 0 #7C4DBE}'
    +S+' tr.ck-strand.mv .ck-sbadge{background:#EDE3FB;color:#5B289A}'
    +S+' tr.ck-strand .ck-lead{background:#EDEBE7 !important;color:#8f8e88 !important;'
      +'text-decoration:line-through;text-decoration-thickness:1.5px}'
    +S+' tr.ck-strand .ck-agblk{filter:grayscale(.85);opacity:.55}'
    +S+' tr.ck-strand .ck-pick,'+S+' tr.ck-strand .ck-area,'+S+' tr.ck-strand .ck-sreq{opacity:.7}'
    +S+' .ck-sbadge{display:inline-block;font-size:9px;font-weight:800;padding:1px 6px;border-radius:4px;'
      +'letter-spacing:.03em;background:#FCE4E4;color:#A32D2D;vertical-align:middle;margin-left:5px}'
    +S+' .ck-swhy{font-size:10.5px;color:#8a5b00;background:#FBF3E6;border-radius:6px;padding:2px 9px;'
      +'display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}'
    +S+' .ck-sclr{border:1px solid #D8D4CA;background:#fff;color:#6b6a63;border-radius:8px;padding:3px 11px;'
      +'font-size:10.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;margin-left:8px}'
    +S+' .ck-sclr:hover{background:#FCEBEB;border-color:#E6C9C3;color:#A32D2D}'
    +S+' .ck-scount{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;'
      +'padding:2px 10px;background:#FCE4E4;color:#A32D2D;margin-left:6px}';
}
function ckSharedCSS(scope){
  return ''
  /* §vckFlow · ทั้งแถวเปลี่ยนสีตามสถานะ · ตัวแปรสีมาจาก inline บนแถว
     ต้อง !important เพราะคลาสเดิม (ck-done/ck-lost/ck-late) ทาพื้นไว้แล้ว */
  +scope+' table.ck-tbl tr.ck-row.vst>td{background:var(--vst-bg)!important}'
  +scope+' table.ck-tbl tr.ck-row.vst:hover>td{background:var(--vst-hov,var(--vst-chip))!important}'
  /* §vckBar · แบบเข้ม · พื้นเข้มพอที่ตัวหนังสือสีเดิมจะอ่านไม่ออก ต้องไล่ให้เข้มตาม
     ต้อง !important เพราะ ck-lost/ck-nsfull ทาสีตัวอักษรไว้แล้ว */
  +scope+' table.ck-tbl tr.ck-row.vst.vkb-c>td{color:var(--vst-tx)!important}'
  +scope+' table.ck-tbl tr.ck-row.vst.vkb-c>td .ck-dim,'
  +scope+' table.ck-tbl tr.ck-row.vst.vkb-c>td .ck-by{color:var(--vst-tx)!important;opacity:.62}'
  +scope+' table.ck-tbl tr.ck-row.vst.vkb-c>td:first-child{box-shadow:inset 5px 0 0 var(--vst-bar)!important}'
  +scope+' tr.vstv.vkb-c .vck-sel{border-width:1.5px}'
  /* ต้องแรงกว่า ck-lost>td:first-child ที่ specificity สูงกว่า ไม่งั้นแถบซ้ายยังเป็นแดงของเดิม */
  +scope+' table.ck-tbl tr.ck-row.vst>td:first-child{box-shadow:inset 5px 0 0 var(--vst-bar)!important}'
  +scope+' tr.vstv .vck-sel{background:var(--vst-chip);border-color:var(--vst-bar);color:var(--vst-ink)}'
  +scope+' tr.vstv .vck-nt{color:var(--vst-ink)}'
  +scope+' .vck-sel{border:2px solid #DCD9D1;background:#fff;color:#5F5E5A;border-radius:9px;'
    +'padding:5px 6px;font:700 11px inherit;font-family:inherit;cursor:pointer;max-width:124px}'
  +scope+' .vck-nt{font-size:11px;font-weight:700;line-height:1.35;white-space:normal;'
    +'display:inline-block;max-width:230px;color:#5F5E5A}'
  +scope+' .vck-rsn{margin-top:3px}'
  /* แถบสี · กดเปลี่ยนสีได้ */
  +scope+' .vck-lgbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#fff;'
    +'border:1px solid #E7E4DC;border-radius:12px;padding:8px 12px;margin:0 0 9px}'
  +scope+' .vck-lgbar .t{font-size:11.5px;font-weight:700;color:#5F5E5A}'
  /* แบบพับ · เหลือแค่ปุ่มเล็ก ๆ ไม่กินที่ */
  +scope+' .vck-q{height:28px;font-size:11.5px;font-family:inherit;border:1.5px solid #E7E4DC;'
    +'border-radius:8px;padding:2px 10px;background:#fff;min-width:230px;margin-left:auto;flex:none}'
  +scope+' .vck-q.on{border-color:#185FA5;background:#F8FBFF}'
  +scope+' .vck-q:focus{outline:none;border-color:#185FA5}'
  +scope+' .vck-lgt{border:1px solid #E4E1D9;background:#fff;color:#8a8a82;'
    +'font:700 10.5px inherit;font-family:inherit;cursor:pointer;padding:3px 10px;'
    +'border-radius:999px;white-space:nowrap;margin-left:10px;flex:none}'
  +scope+' .vck-lgt:hover{border-color:#B9B5AA;background:#FBFAF7;color:#3a3a36}'
  +scope+' .vck-lgb{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #E4E1D9;background:#fff;'
    +'border-radius:999px;padding:3px 11px 3px 4px;font:600 11px inherit;font-family:inherit;color:#4a4a45;cursor:pointer}'
  +scope+' .vck-lgb:hover{border-color:#B9B5AA;background:#FBFAF7}'
  +scope+' .vck-lgb i{width:16px;height:16px;border-radius:6px;display:inline-block;border:2px solid}'
  +scope+' .vck-lgb small{font-size:9.5px;color:#a3a39b;font-weight:500}'
  /* §vckBar · ตัวเลือกรูปแบบแถบ · อยู่ท้ายแถบสี ติดกับปุ่มคืนค่า */
  +scope+' .vck-bs{margin-left:auto;display:inline-flex;align-items:center;gap:6px;flex:none}'
  +scope+' .vck-bs>b{font-size:10px;font-weight:700;color:#a3a39b}'
  +scope+' .vck-bs .g{display:inline-flex;border:1px solid #E4E1D9;border-radius:8px;overflow:hidden}'
  +scope+' .vck-bs .g button{border:none;background:#fff;color:#5F5E5A;font:700 10.5px inherit;'
    +'font-family:inherit;padding:4px 12px;cursor:pointer;border-right:1px solid #EEEBE4}'
  +scope+' .vck-bs .g button:last-child{border-right:0}'
  +scope+' .vck-bs .g button.on{background:#0F6E56;color:#fff}'
  +scope+' .vck-rs{margin-left:8px;border:1px solid #E4E1D9;background:#fff;border-radius:8px;'
    +'padding:4px 11px;font:600 10.5px inherit;font-family:inherit;color:#8a8a82;cursor:pointer}'
  +scope+' .vck-rs:hover{color:#A32D2D;border-color:#E7C4C0}'
  +'.vck-cdlg{width:400px}'
  +'.vck-sw{display:grid;grid-template-columns:repeat(9,1fr);gap:7px;margin-bottom:14px}'
  +'.vck-sw button{width:100%;aspect-ratio:1;border-radius:9px;border:2px solid transparent;cursor:pointer;padding:0}'
  +'.vck-sw button.on{border-color:#15201a;box-shadow:0 0 0 2px #fff inset}'
  +'.vck-cst{display:flex;align-items:center;gap:9px;margin-bottom:13px;flex-wrap:wrap}'
  +'.vck-cst input[type=color]{width:46px;height:34px;border:1px solid #E4E1D9;border-radius:9px;background:#fff;cursor:pointer;padding:2px}'
  +'.vck-prev{border:1px solid #EFEDE7;border-radius:11px;overflow:hidden}'
  +'.vck-prev .ph{font-size:9.5px;color:#a3a39b;padding:6px 11px;background:#FAF9F6;'
    +'border-bottom:1px solid #EFEDE7;text-transform:uppercase;letter-spacing:.04em;font-weight:700}'
  +'.vck-prev .prow{display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:12.5px}'
  +'.vck-prev .pb{width:4px;align-self:stretch;border-radius:2px;min-height:22px}'
  +'.vck-prev .ph2{color:#8a8a82;flex:1}'
  +'.vck-prev .pc{border:2px solid;border-radius:9px;padding:3px 10px;font-weight:700;font-size:11px}'
  /* §vckArr · ปุ่มถึงจุดรับ */
  +scope+' .vck-arr{border:1.5px solid #C8C5BC;background:#fff;color:#4a4a45;border-radius:9px;'
    +'padding:5px 13px;font:700 11.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}'
  +scope+' .vck-arr:hover{border-color:#8a8a82;background:#FBFAF7}'
  +scope+' .vck-arr.on{background:#0F6E56;border-color:#0F6E56;color:#fff;'
    +'display:inline-flex;align-items:center;gap:8px}'
  +scope+' .vck-arr.late{background:#8A5B00;border-color:#8A5B00}'
  /* รับครบแล้ว · สีสงบ ไม่ใช่สีเตือน · นาฬิกาหยุดนับ */
  +scope+' .vck-arr.on.done{background:#fff;border-color:#8ACBB4;color:#0F6E56}'
  +scope+' .vck-arr.on.done .sbt{background:#E1F5EE;color:#0F6E56}'
  +scope+' .vck-arr .sbt{background:rgba(255,255,255,.22);border-radius:7px;padding:1px 8px;'
    +'font-size:10.5px;font-family:\'DM Mono\',monospace;font-weight:500}'
  /* หัวคันที่สแตนบายแล้ว · ทั้งแถบเปลี่ยนเป็นเขียวอ่อน จะได้เห็นจากไกล */
  +scope+' tr.ck-ghd.vck-sb>td{background:#E6F6EE!important}'
  
  +scope+' .ck-hd{padding:9px 14px;background:#fff;border:1px solid var(--border,#E7E4DC);border-radius:14px;box-shadow:0 2px 6px -3px rgba(15,23,42,.18);margin-bottom:12px;position:sticky;top:var(--ck-hd-top,0px);z-index:45}'
  +scope+' .ck-hd-top{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}'
  +scope+' .ck-hd-nav{display:flex;gap:5px;padding-top:6px;flex:none}'
  +scope+' .ck-navbtn{width:27px;height:27px;border-radius:50%;border:none;background:#F0EEE8;color:#5F5E5A;font-size:15px;line-height:1;cursor:pointer;font-family:inherit}'
  +scope+' .ck-navbtn:hover{background:#E5E2DA}'
  +scope+' .ck-hd-dwrap{flex:none;min-width:0;position:relative}'
  +scope+' .ck-hd-date{font-family:\'DM Sans\',sans-serif;font-size:24px;font-weight:800;color:#15201a;letter-spacing:-.4px;line-height:1}'
  +scope+' .ck-hd-meta{font-family:\'DM Mono\',monospace;font-size:11px;color:#8a8a82;margin-top:5px}'
  +scope+' .ck-hd-total{text-align:right;margin-left:auto}'
  +scope+' .ck-hd-tlab{font-size:9px;color:#a5a49d;text-transform:uppercase;letter-spacing:.5px;font-weight:700}'
  +scope+' .ck-hd-tnum{font-size:32px;font-weight:800;color:#15201a;line-height:1;font-variant-numeric:tabular-nums}'
  +scope+' .ck-hd-tbrk{font-size:10px;color:#8a8a82;font-family:\'DM Mono\',monospace;margin-top:2px}'
  +scope+' .ck-kpi{display:flex;gap:6px;font-size:11px;font-weight:700;flex-wrap:wrap;align-items:center}'
  +scope+' .ck-kpi span{border-radius:8px;padding:4px 11px;white-space:nowrap}'
  +scope+' .ck-prog{height:6px;background:#EAE7DF;border-radius:5px;overflow:hidden;margin-top:11px}'
  +scope+' .ck-prog>div{height:100%;border-radius:5px;transition:width .2s}'
  +scope+' .ck-pillbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px}'
  +scope+' .ck-card{background:#fff;border:1px solid var(--border,#E7E4DC);border-radius:14px;overflow:visible}'
  +scope+' table.ck-tbl{border-collapse:collapse;width:100%;min-width:1420px;font-size:12px}'
  +scope+' table.ck-tbl th{text-align:left;font-size:9px;font-weight:700;color:#a5a49d;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;border-bottom:1px solid var(--border,#E7E4DC);white-space:nowrap;position:sticky;top:var(--ck-th-top,0px);z-index:35;background:#fff;box-shadow:inset 0 -1px 0 var(--border,#E7E4DC)}'
  /* หัวรถ/หัวเรือตรึงใต้หัวคอลัมน์ · แถวข้อมูลอยู่ layer ต่ำกว่า วาดทับไม่ได้ */
  +scope+' table.ck-tbl tr.ck-ghd>td{position:sticky;top:var(--ck-grp-top,26px);z-index:30}'
  +scope+' table.ck-tbl tr.ck-row>td,'+scope+' table.ck-tbl tr.ck-zhead>td,'+scope+' table.ck-tbl tr.ck-warn>td{position:relative;z-index:0}'
  +scope+' table.ck-tbl tr.ck-ghd>td{box-shadow:0 2px 5px -3px rgba(15,23,42,.35)}'
  +scope+' table.ck-tbl td{padding:13px 8px;border-bottom:1px solid #F4F2ED;vertical-align:middle;white-space:nowrap}'
  +scope+' table.ck-tbl tr.ck-row:hover td{background:#fcfcfd}'
  +scope+' table.ck-tbl tr.ck-row.ck-lost>td{background:#F6CFCB;border-bottom-color:#E9B4AF}'
  +scope+' table.ck-tbl tr.ck-row.ck-lost:hover>td{background:#F2C2BD}'
  +scope+' table.ck-tbl tr.ck-row.ck-lost>td:first-child{box-shadow:inset 5px 0 0 #C0392B}'
  +scope+' table.ck-tbl tr.ck-row.ck-nsfull>td{background:#F1B8B2}'
  /* §ckBack · ปุ่มทางกลับ + ป้ายประวัติ */
  +scope+' .ck-bkb{display:inline-flex;gap:4px;margin-top:5px}'
  +scope+' .ck-ic{width:32px;height:32px;border-radius:9px;border:1.5px solid;cursor:pointer;'
    +'font-size:15px;line-height:1;padding:0;font-family:inherit;background:#fff}'
  +scope+' .ck-ic.bk{border-color:#BFE3CC;background:#E4F5EC}'
  +scope+' .ck-ic.bk:hover{background:#CFEDDD}'
  +scope+' .ck-ic.ag{border-color:#E4E1D9}'
  +scope+' .ck-ic.ag:hover{background:#F7F6F3}'
  +scope+' .ck-try{display:inline-block;font-size:10px;font-weight:700;border-radius:6px;padding:2px 7px;'
    +'margin-top:3px;background:#F4F2ED;border:1px solid #E7E4DC;color:#6b6a63}'
  +scope+' .ck-gone{display:inline-block;font-size:10px;font-weight:700;border-radius:6px;padding:2px 7px;'
    +'margin-top:3px;background:#E4F5EC;border:1px solid #BFE3CC;color:#0F6E56}'
  +scope+' .ck-mis{display:inline-block;font-size:10px;font-weight:700;border-radius:6px;padding:2px 7px;'
    +'margin-top:3px;background:#F4E8FB;border:1px solid #E3D0F0;color:#6B289A}'
  /* ── ยังไม่เช็คอิน = สีจาง · เช็คอินแล้วสีกลับมาปกติ ─────────────────── */
  +scope+' .ck-row.ck-plain .ck-agblk{filter:grayscale(1);opacity:.5}'
  +scope+' .ck-row.ck-plain .ck-lead{background:#F1EFE8 !important;color:#8a8a82}'
  +scope+' .ck-row.ck-plain .ck-vch,'+scope+' .ck-row.ck-plain .ck-by{color:#a5a49d}'
  +scope+' .ck-row.ck-plain .ck-tel{opacity:.75}'
  +scope+' .ck-row.ck-plain td{color:#8a8a82}'
  +scope+' .ck-row.ck-done .ck-agblk{filter:none;opacity:1}'
  +scope+' .ck-row.ck-late>td:first-child{box-shadow:inset 4px 0 0 #C0392B}'
  /* ── ป้ายเวลา ────────────────────────────────────────────────────────── */
  +scope+' .ck-tm{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;font-family:\'DM Mono\',monospace;font-size:12px;line-height:1.15;white-space:nowrap}'
  +scope+' .ck-tm b{font-size:9.5px;font-weight:700;border-radius:5px;padding:1px 6px;letter-spacing:.02em;font-family:\'DM Sans\',sans-serif}'
  +scope+' .ck-tm-soon{color:#854F0B}'  +scope+' .ck-tm-soon b{background:#FAEEDA;color:#854F0B}'
  +scope+' .ck-tm-due{color:#0C447C;font-weight:700}' +scope+' .ck-tm-due b{background:#E6F1FB;color:#0C447C}'
  +scope+' .ck-tm-late{color:#A32D2D;font-weight:700}'+scope+' .ck-tm-late b{background:#FCEBEB;color:#A32D2D}'
  +scope+' .ck-tm-done{color:#0F6E56;font-weight:700}'
  +scope+' .ck-tm-miss{color:#8a8a82}'+scope+' .ck-tm-miss b{background:#F1EFE8;color:#7a7a72;font-weight:600}'
  +scope+' .ck-c{text-align:center}'
  +scope+' .ck-mono{font-family:\'DM Mono\',monospace}'
  +scope+' .ck-dim{color:#c8c6be}'
  +scope+' .ck-in{background:#F3FBF7}'
  +scope+' .ck-zhead td{padding:8px 16px;background:#f6f7f9;border-top:1px solid #E7E4DC;border-bottom:1px solid #E7E4DC;white-space:nowrap}'
  +scope+' .ck-zn{font-size:12px;font-weight:800;color:#3a3a36;margin-left:8px;display:inline-block}'
  +scope+' .ck-gtm{font-family:\'DM Mono\',monospace;font-size:11.5px;font-weight:700;border-radius:7px;padding:3px 9px;white-space:nowrap;background:#F1EFE8;color:#5F5E5A}'
  +scope+' .ck-gtm-soon{background:#FAEEDA;color:#854F0B}'
  +scope+' .ck-gtm-due{background:#E6F1FB;color:#0C447C}'
  +scope+' .ck-gtm-late{background:#FCEBEB;color:#A32D2D}'
  +scope+' .ck-gtm-done{background:#DCF4E8;color:#0C6B47}'
  +scope+' .ck-gtm-miss{background:#F1EFE8;color:#7a7a72}'
  +scope+' .ck-zc{font-size:11px;color:#8a8a82;font-family:\'DM Mono\',monospace;margin-left:8px;display:inline-block}'
  +scope+' .ck-ghead td{padding:0;background:#fff}'
  +scope+' .ck-gbox{display:flex;align-items:center;gap:14px;padding:11px 14px;border-left:6px solid #0F6E56;background:linear-gradient(90deg,rgba(15,110,86,.09),transparent 55%)}'
  +scope+' .ck-gav{width:44px;height:44px;border-radius:12px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex:none;letter-spacing:.3px}'
  +scope+' .ck-gnm{font-size:17px;font-weight:800;color:#15201a;line-height:1.05}'
  +scope+' .ck-gsub{font-size:12.5px;color:#3F4654;margin-top:4px}'
  +scope+' .ck-unitbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;margin-bottom:12px;background:#fff;border:1px solid var(--border,#E7E4DC);border-radius:12px;position:sticky;top:var(--ck-unit-top,0px);z-index:40;box-shadow:0 2px 6px -4px rgba(15,23,42,.30)}'
  +scope+' .ck-unitbar-lbl{font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;flex:none}'
  +scope+' .ck-pick{display:inline-block;max-width:230px;min-width:96px;white-space:normal;overflow-wrap:break-word;line-height:1.25;vertical-align:middle}'
  +scope+' .ck-vch{display:inline-block;max-width:128px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.3;font-family:\'DM Mono\',monospace;vertical-align:middle}'
  +scope+' .ck-tel{display:inline-block;margin-top:4px;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:700;letter-spacing:-.2px;line-height:1.3;color:#0C4E8A;text-decoration:none;white-space:normal;overflow-wrap:anywhere;max-width:190px}'
  +scope+' .ck-tel:hover{text-decoration:underline}'
  +scope+' .ck-by{font-weight:600;color:#5F5E5A;white-space:nowrap;display:inline-block;max-width:118px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}'
  +scope+' .ck-sreq{display:inline-block;max-width:200px;white-space:normal;overflow-wrap:break-word;line-height:1.3;color:#7a5622;background:#FBF6EE;border-radius:7px;padding:3px 8px}'
  +scope+' .ck-lead{font-weight:700;display:inline-block;max-width:158px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;color:#3a2e00;padding:1px 7px;border-radius:5px}'
  +scope+' .ck-area{font-size:11px;background:#eef0f3;color:#4a5160;border-radius:6px;padding:2px 8px;white-space:nowrap}'
  /* §ckSelfUI · หน้าต่างเด้งอยู่นอก scope · ต้องประกาศให้มันด้วย ไม่งั้นปุ่มกับตัวเลขเบียดกัน */
  +'#ck-reason-host .ck-stp{display:inline-flex;align-items:center;border:1px solid #B7D9C9;border-radius:9px;overflow:hidden;background:#fff}'
  +'#ck-reason-host .ck-stp button{width:34px;height:36px;border:none;background:#fff;color:#0F6E56;font-size:17px;font-weight:700;cursor:pointer;font-family:inherit;line-height:1}'
  +'#ck-reason-host .ck-stp button:hover{background:#EAF7F1}'
  +'#ck-reason-host .ck-n{min-width:34px;text-align:center;font-size:17px;font-weight:800;font-family:\'DM Mono\',monospace;color:#15201a;font-variant-numeric:tabular-nums}'
  +scope+' .ck-stp{display:inline-flex;align-items:center;border:1px solid #B7D9C9;border-radius:7px;overflow:hidden}'
  +scope+' .ck-stp button{width:22px;height:24px;border:none;background:#fff;color:#0F6E56;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}'
  +scope+' .ck-stp button:hover{background:#EAF7F1}'
  +scope+' .ck-n{min-width:24px;text-align:center;font-size:12px;font-weight:700;font-family:\'DM Mono\',monospace}'
  +scope+' .ck-ns{display:inline-block;font-size:9.5px;font-weight:700;color:#A32D2D;background:#FCEBEB;border-radius:5px;padding:1px 6px;white-space:nowrap;margin-top:3px}'
  +scope+' .ck-cx{display:inline-block;font-size:9.5px;font-weight:700;color:#8A5B00;background:#FBF3E6;border-radius:5px;padding:1px 6px;white-space:nowrap;margin-top:3px}'
  +scope+' .ck-bk{font-size:9px;color:#8a8a82;font-family:\'DM Mono\',monospace;margin-top:3px}'
  +scope+' .ck-evb{display:flex;gap:4px}'
  +scope+' .ck-ev{font-size:9.5px;font-weight:800;letter-spacing:.02em;border-radius:6px;padding:3px 7px;cursor:pointer;font-family:inherit;white-space:nowrap;background:#fff;transition:filter .12s}'
  +scope+' .ck-ev:hover{filter:brightness(.96)}'
  +scope+' .ck-ev-ns{border:1px solid #E6C9C3;color:#A32D2D}'
  +scope+' .ck-ev-cx{border:1px solid #EBDCC2;color:#8A5B00}'
  +scope+' .ck-ck{width:24px;height:24px;border-radius:7px;border:1px solid #D7DBD5;background:#fff;color:#B7BBB5;cursor:pointer;font-size:13px;font-weight:700}'
  +scope+' .ck-ck.on{background:#0F6E56;border-color:#0F6E56;color:#fff}'
  +scope+' .ck-rsn{font-size:10.5px;font-weight:600;color:#8a5622;background:#FBF3E6;border:1px solid #EBDCC2;border-radius:7px;padding:3px 8px;cursor:pointer;font-family:inherit;white-space:nowrap;max-width:210px;overflow:hidden;text-overflow:ellipsis}'
  +scope+' .ck-rsn:hover{border-color:#C99A4E}'
  +scope+' .ck-rsn-need{color:#A32D2D;background:#FCEBEB;border-color:#E6BEB6}'
  +scope+' .ck-warn td{padding:9px 12px;background:#FBF6EE;color:#7a5622;font-size:11.5px;font-weight:700}'
  +scope+' .ck-empty td{padding:40px;text-align:center;color:#b0aea6;font-size:12px}';
}
// แถบหัววัน · ยกโครงเดียวกับหัว By-trip (แถว 1 = ลูกศรริมสองข้าง + วันที่ตรงกลางคลิกเลือกได้ ·
// แถว 2 = ปุ่มโหมด/KPI ซ้าย + การ์ดโปรแกรม + ยอดรวมขวา)
function ckDayHeader(o){
  var e=ckEsc, date=o.date;
  var isToday=(date===((typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):''));
  var dow=new Date(date+'T00:00').toLocaleDateString('en-GB',{weekday:'short'});
  var dstr=new Date(date+'T00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  return ''
  +'<div class="ck-hd">'
  +'  <div style="display:flex;align-items:center;gap:10px">'
  +'    <button onclick="'+o.shiftFn+'(-1)" title="วันก่อนหน้า" style="width:26px;height:26px;flex:none;border-radius:50%;border:none;background:#F0EEE8;color:#5F5E5A;font-size:15px;line-height:1;cursor:pointer;font-family:inherit">&lsaquo;</button>'
  +'    <div style="flex:1;text-align:center;display:flex;align-items:baseline;justify-content:center;gap:8px;flex-wrap:wrap">'
  +'      <span style="font-size:10px;color:#8a8a82;letter-spacing:.04em;text-transform:uppercase">'+e(dow)+(isToday?' · Today':'')+'</span>'
  +'      <label style="position:relative;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:16px;font-weight:700;color:#15201a;letter-spacing:-.2px;line-height:1.1">'+e(dstr)+'<span style="font-size:12px;color:#8a8a82">&#128197;</span>'
  +'        <input type="date" value="'+e(date)+'" onclick="event.stopPropagation();try{this.showPicker()}catch(_){}" onchange="if(this.value)'+o.pickFn+'(this.value)" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer">'
  +'      </label>'
  +'    </div>'
  +'    <button onclick="'+o.shiftFn+'(1)" title="วันถัดไป" style="width:26px;height:26px;flex:none;border-radius:50%;border:none;background:#F0EEE8;color:#5F5E5A;font-size:15px;line-height:1;cursor:pointer;font-family:inherit">&rsaquo;</button>'
  +'  </div>'
  +'  <div style="display:flex;align-items:center;gap:9px;margin-top:8px;padding-top:8px;border-top:1px solid #E7E4DC;flex-wrap:wrap">'
  +'    <div class="ck-kpi" style="flex:none">'+o.kpiHtml+'</div>'
  +'    <span style="width:1px;height:18px;background:#E7E4DC"></span>'
  +    (o.pillsHtml||'')
  +'    <span style="margin-left:auto;font-size:12px;color:#5F5E5A;white-space:nowrap">รวม <b style="font-weight:600;font-family:\'DM Mono\',monospace;font-size:16px;color:#15201a">'+o.totalPax+'</b> pax <span style="font-size:10px;font-family:\'DM Mono\',monospace">'+e(o.totalBreak||'')+'</span></span>'
  +'  </div>'
  +'</div>';
}
// แถบการ์ดโปรแกรม/ทริป (เหมือน By-trip) · famFilter/routeFilter + ชื่อฟังก์ชันกรองส่งเข้ามา
// การ์ดโปรแกรม/ทริป · ตัวเลขบนการ์ด = "รับลูกค้า" แยกโซน PK / KL / มาเอง และสะท้อนผลเช็คอินจริง
// (done/tot = pax ที่เช็คอินแล้ว / pax ทั้งหมดของโซนนั้นในทริปนั้น) · kind = 'van' | 'pier'
function ckRoutePills(date, famSel, routeSel, famFn, routeFn, kind){
  var e=ckEsc;
  kind=kind||'van';
  var P=function(pax,k){ return (typeof bkV2PaxTot==='function')?bkV2PaxTot(pax||{},k):0; };
  var ABBR={speedboat:'SB',catamaran:'CAT',sunset:'SS',premium:'PREM',longtail:'LT',private:'PRIV',early:'EARLY',whale:'WS'};
  var abbr=function(s){ var k=String(s||'').toLowerCase().trim(); if(!k) return ''; for(var w in ABBR){ if(k.indexOf(w)>=0) return ABBR[w]; } var ws=String(s).trim().split(/\s+/); return (ws.length>1?ws.map(function(x){return x[0]||'';}).join(''):String(s).slice(0,4)).toUpperCase(); };
  var fam={}, rst={}, dA=0,dC=0,dI=0,dF=0;
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    (b.trips||[]).forEach(function(t){ if((t.date||'')!==date) return;
      /* §landCk · ชิปโปรแกรมกับยอดหัวหน้าต้องตรงกับหน้าที่เปิดอยู่ · เฉพาะหน้าเช็คอินท่า/City tour
         หน้าเช็คอินรถ (kind='van') ไม่แตะ — รถรับส่งมีทั้งสองฝั่ง ทั้งหน้านั้นจึงต้องเห็นครบ */
      if(kind==='pier' && typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId) !== _pckLand) return;
      var p=t.pax||{};
      // §check-in · ทุกตัวเลขบนการ์ด = "เดินทางจริง" · หักคนที่ No-show / CXL ออกรายประเภท
      var L=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
      var _g=function(k){ var v=P(p,k); if(!L||L.total<=0) return v; return (typeof ckPaxLeft==='function')?ckPaxLeft(b,date,k,v):Math.max(0,v-L.total); };
      var ad=_g('ad'),chd=_g('chd'),inf=_g('inf'),foc=_g('foc'), pax=ad+chd+inf+foc;
      var bkPax=P(p,'ad')+P(p,'chd')+P(p,'inf')+P(p,'foc');
      dA+=ad;dC+=chd;dI+=inf;dF+=foc;
      var f=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(t.routeId):null;
      if(f){ var a=fam[f.id]=fam[f.id]||{fam:f,pax:0,booked:0,rids:{},locked:0}; a.pax+=pax; a.booked+=bkPax; a.rids[t.routeId]=1; }
      if(typeof bkIsOvnReturn==='function' && bkIsOvnReturn(t)) return;   // ขากลับ OVN · ไม่มีการรับขึ้นรถ
      var R=rst[t.routeId]=rst[t.routeId]||{PK:{tot:0,done:0,bk:0},KL:{tot:0,done:0,bk:0},OWN:{tot:0,done:0,bk:0}};
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
      var z=(typeof bkV2EffZone==='function')?bkV2EffZone(b,t):(t.zone||b.pickupZone||'NoTransfer');
      var own=(b.pickupSelf || z==='NoTransfer' || z==='NT' || !O.vanId);
      // §perProgramme · แต่ละโปรแกรมออกคนละเวลา ตัวเลข ถึงท่า/เคลียร์/ขึ้นเรือ จึงต้องเป็นของโปรแกรมนั้น
      // ไม่ใช่ยอดรวมทั้งวัน (รวมทั้งวันบอกไม่ได้ว่าลำที่กำลังจะออกอีก 10 นาทีพร้อมหรือยัง)
      if(kind==='pier' && f){
        // §pckCountPax · นับเป็นคน (pax = ยอดที่เดินทางจริงหลังหักคนที่ไม่มาแล้ว)
        //   ใบที่ยกเลิกหน้างานจนไม่เหลือคน pax=0 → หลุดจากตัวหารเอง ป้าย "ออกได้" จึงขึ้นได้จริง
        var A=fam[f.id];
        A.rows=(A.rows||0)+1;                     // จำนวนใบ · เก็บไว้ให้ tooltip
        A.rowsP=(A.rowsP||0)+pax;
        var _stg=(typeof pckStage==='function')?pckStage(O.pierCheckin):'wait';
        var _rk=(typeof pckStageRank==='function')?pckStageRank(_stg):0;
        if(_rk>=1){ A.arr=(A.arr||0)+1; A.arrP=(A.arrP||0)+pax; }
        if(_rk>=2){ A.clr=(A.clr||0)+1; A.clrP=(A.clrP||0)+pax; }
        if(_rk>=3){ A.on=(A.on||0)+1;  A.onP=(A.onP||0)+pax; }
        else { var _M=(typeof pckMoney==='function')?pckMoney(b,date):null; if(_M&&_M.due>0) A.due=(A.due||0)+_M.due; }
      }
      var ck=(kind==='pier')?O.pierCheckin:O.vanCheckin;
      var done=(ck&&ck.at)?(ck.actualPax!=null?ck.actualPax:pax):0;
      var key = own ? 'OWN' : (R[z]?z:'PK');
      R[key].tot+=pax; R[key].done+=done; R[key].bk+=bkPax;
    });
  });
  (typeof ROUTES!=='undefined'?ROUTES:[]).forEach(function(rr){
    var lk=(typeof bkV2LockedTotal==='function')?bkV2LockedTotal(rr.id,date):0; if(lk<=0) return;
    var f=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(rr.id):null; if(!f) return;
    var a=fam[f.id]=fam[f.id]||{fam:f,pax:0,booked:0,rids:{},locked:0}; a.locked+=lk; a.rids[rr.id]=1;
  });
  // บล็อกตัวเลขต่อโซน · เขียว = ครบ · เหลือง = ยังไม่ครบ · เทา = ยังไม่เริ่ม · ม่วง = มาเอง (ไม่มีรถรับ)
  var zoneBlock=function(lbl, o, isOwn){
    if(!o || o.tot<=0) return '';
    var full=(o.done>=o.tot), part=(o.done>0&&!full);
    var C = isOwn ? {bg:'#F4E8FB',num:'#6B289A',lab:'#8b5cb0'}
          : full  ? {bg:'#DCF4E8',num:'#0C6B47',lab:'#3f8b6c'}
          : part  ? {bg:'#FAEEDA',num:'#854F0B',lab:'#a37d3a'}
          :         {bg:'#F1EFE8',num:'#5F5E5A',lab:'#8a8a82'};
    var val = isOwn ? String(o.tot) : (o.done+'/'+o.tot);
    var lostHere = Math.max(0,(o.bk||o.tot)-o.tot);
    return '<span title="'+e(lbl)+' · '+(isOwn?('มาเอง '+o.tot+' pax · ไม่มีรถรับ'):('เช็คอินแล้ว '+o.done+' จาก '+o.tot+' pax'))+'" style="display:inline-flex;flex-direction:column;align-items:center;line-height:1;background:'+C.bg+';border-radius:9px;padding:4px 10px"><span style="font-family:\'DM Mono\',monospace;font-size:16px;font-weight:700;color:'+C.num+'">'+val+'</span><span style="font-size:9px;font-weight:700;color:'+C.lab+';margin-top:2px">'+e(lbl)+(lostHere>0?(' <s style="opacity:.65">'+(o.bk||0)+'</s>'):'')+'</span></span>';
  };
  // §check-in · ยอดรวมทั้งวันต้องเป็น "เดินทางจริง" · เก็บยอดจองเดิมไว้เทียบ
  var _lostAll=0;
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    if(!ckTripOn(b,date)) return;
    var L=(typeof ckLostByType==='function')?ckLostByType(b,date):null; _lostAll+=((L&&L.total)||0);
  });
  var list=Object.keys(fam).map(function(k){ return fam[k]; }).sort(function(a,b){ return b.pax-a.pax||(b.locked-a.locked); });
  var none=(!famSel && !routeSel);
  var html=(list.length>1?'<button onclick="'+famFn+'(null)" title="แสดงทุกโปรแกรม" style="font-size:12px;border:1px solid '+(none?'#185FA5':'#E7E4DC')+';background:'+(none?'#E6F1FB':'#fff')+';color:'+(none?'#0C447C':'#5F5E5A')+';border-radius:999px;padding:6px 13px;font-weight:'+(none?'700':'600')+';white-space:nowrap;cursor:pointer;font-family:inherit">ทั้งหมด <span style="font-family:\'DM Mono\',monospace">'+(dA+dC+dI+dF)+'</span></button>':'');
  html+=list.map(function(a){
    var col=a.fam.color||'#8b909c';
    var rids=Object.keys(a.rids).sort();
    var famOn=(famSel===a.fam.id)||(routeSel&&a.rids[routeSel]);
    // §chipSel · กรองอยู่แต่ไม่ใช่ใบนี้ → ถอดสีเป็นเทา จะได้เห็นชัดว่ากำลังดูอันไหน
    var _mute=!!(famSel||routeSel) && !famOn;
    var _cc=_mute?'#B9B6AE':col;
    var subLbl=function(rid){ var rn=((typeof getRoute==='function'&&getRoute(rid))||{}).name||rid; var s=String(rn).replace(a.fam.name,'').replace(/^[\s·\-]*by[\s·\-]*/i,'').replace(/^[\s·\-]+/,'').trim(); return s||((typeof bkV2RouteShort==='function'&&bkV2RouteShort(rid))||''); };
    var subs=rids.map(function(rid){
      var open=(typeof bkV2IsRouteOpenOn!=='function')||bkV2IsRouteOpenOn(rid,date);
      var lblFull=subLbl(rid), lbl=e(abbr(lblFull)||lblFull||'trip');
      if(!open) return '<span title="'+e(lblFull)+' · ไม่ออกวันนี้" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;border-left:1px solid '+_cc+'33;background:#FCEBEB;color:#A32D2D;padding:8px 12px;white-space:nowrap">'+lbl+' <span style="font-size:10px;font-weight:600;opacity:.85">ไม่ออก</span></span>';
      var R=rst[rid]||{PK:{tot:0,done:0},KL:{tot:0,done:0},OWN:{tot:0,done:0}};
      var tot=R.PK.tot+R.KL.tot+R.OWN.tot, done=R.PK.done+R.KL.done;
      var totBk=(R.PK.bk||0)+(R.KL.bk||0)+(R.OWN.bk||0);
      var blocks=zoneBlock('PK',R.PK)+zoneBlock('KL',R.KL)+zoneBlock('มาเอง',R.OWN,true);
      if(!blocks) blocks='<span style="font-size:11px;color:#b0aea6">ไม่มี booking</span>';
      var ron=(routeSel===rid);
      return '<button onclick="'+routeFn+'(\''+rid+'\')" title="'+e(lblFull)+' · '+(kind==='pier'?'ขึ้นเรือ':'ขึ้นรถ')+'แล้ว '+done+' จาก '+(R.PK.tot+R.KL.tot)+' pax ที่มีรถรับ'+(R.OWN.tot?(' · มาเอง '+R.OWN.tot+' pax'):'')+' · คลิกกรองเฉพาะทริปนี้" style="display:inline-flex;align-items:center;gap:8px;border:none;border-left:1px solid '+_cc+'33;background:'+(ron?'#EFEAFB':'#fff')+';white-space:nowrap;padding:8px 12px;cursor:pointer;font-family:inherit"><span style="font-size:12.5px;font-weight:700;color:'+(ron?'#4A2E86':((routeSel||_mute)?'#9C9990':'#5A5A52'))+'">'+lbl+'</span><span style="font-family:\'DM Mono\',monospace;font-size:12px;color:#a09a90">'+tot+' pax'+(totBk>tot?('<s style="opacity:.65;margin-left:3px">'+totBk+'</s>'):'')+'</span>'+blocks+'</button>';
    }).join('');
    // แถบสถานะหน้าท่าใต้การ์ด · เน้น "เหลือเวลาเท่าไรก่อนออก" เพราะแต่ละโปรแกรมออกไม่พร้อมกัน
    // สีเปลี่ยนตามความเร่งด่วน: ครบแล้ว = เขียว · เหลือ ≤30 นาที หรือเลยเวลาแล้ว = แดง · ≤60 นาที = เหลือง
    // วันที่ไม่ใช่วันนี้จะไม่นับถอยหลัง (ไม่มีความหมาย) แสดงแค่เวลาออก · ckStartTick วาดใหม่ทุก 60 วิ ให้เอง
    var foot='';
    if(kind==='pier' && (a.rows||0)>0){
      var _tm=[]; rids.forEach(function(rid){ var rr=(typeof getRoute==='function'?getRoute(rid):null)||{}; (rr.times||[]).forEach(function(x){ if(x && _tm.indexOf(x)<0) _tm.push(x); }); });
      _tm.sort();
      var _dep=_tm[0]||'';
      var _isToday=(date===((typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10)));
      var _left=null;
      if(_isToday && _dep){ var _mm=_dep.match(/(\d{1,2})[:.](\d{2})/); if(_mm){ var _n=new Date(); _left=((+_mm[1])*60+(+_mm[2]))-(_n.getHours()*60+_n.getMinutes()); } }
      var _miss=Math.max(0,(a.rowsP||0)-(a.onP||0)), _allOn=(_miss===0);
      var C, TXT;
      if(_allOn){ C=['#0F6E56','#DCF4E8']; TXT='ออกได้'; }
      else if(_left===null){ C=['#5F5E5A','#F1EFE8']; TXT='ขาด '+_miss+' คน'; }
      else if(_left<0){ C=['#A32D2D','#FCEBEB']; TXT='เลยเวลาออก · ขาด '+_miss+' คน'; }
      else if(_left<=30){ C=['#A32D2D','#FCEBEB']; TXT='ขาด '+_miss+' คน'; }
      else if(_left<=60){ C=['#7A4A00','#FBF0DD']; TXT='ขาด '+_miss+' คน'; }
      else { C=['#5F5E5A','#F1EFE8']; TXT='ยังมีเวลา'; }
      var _clock;
      if(_allOn || _left===null) _clock='&mdash;';
      else { var _ab=Math.abs(_left), _h=Math.floor(_ab/60), _m2=_ab%60;
             _clock=(_left<0?'เลย ':'')+(_h?(_h+' ชม. '):'')+_m2+(_left<0?' น.':' นาที'); }
      var st=function(lbl,n,c,tip){ return '<span'+(tip?(' title="'+e(tip)+'"'):'')+' style="display:inline-flex;align-items:baseline;gap:5px;background:#fff;color:'+c+';border-radius:7px;padding:3px 9px;font-size:10.5px;font-weight:700;white-space:nowrap">'+lbl+' <b style="font-family:\'DM Mono\',monospace;font-size:13px">'+n+'</b></span>'; };
      foot='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 12px;border-top:1px solid '+_cc+'2E;background:'+C[1]+'">'
        +'<div style="line-height:1.15"><div style="font-family:\'DM Mono\',monospace;font-size:16px;font-weight:700;color:'+C[0]+';white-space:nowrap">'+_clock+'</div>'
          +'<div style="font-size:9.5px;font-weight:700;color:'+C[0]+';opacity:.8;white-space:nowrap">ออก '+e(_tm.join(' / ')||'—')+'</div></div>'
        +'<span style="background:'+C[0]+';color:#fff;border-radius:8px;padding:4px 11px;font-size:11px;font-weight:800;white-space:nowrap">'+TXT+'</span>'
        +st('ถึงท่า',(a.arrP||0)+'/'+(a.rowsP||0),'#0C447C','นับเป็นคน · '+(a.arr||0)+'/'+(a.rows||0)+' booking')
        +st('เคลียร์',(a.clrP||0),'#7A4A00','นับเป็นคน · '+(a.clr||0)+' booking')
        +st('ขึ้นเรือ',(a.onP||0),'#0F6E56','นับเป็นคน · '+(a.on||0)+' booking')
        +((a.due||0)>0?st('ค้างเก็บ','&#3647;'+Math.round(a.due).toLocaleString(),'#7A4A00'):'')
      +'</div>';
    }
    return '<div style="display:inline-flex;flex-direction:column;border:1.5px solid '+(famOn?col:(_mute?'#E2DED6':col+'aa'))+';background:#fff;border-radius:14px;overflow:hidden;'+(famOn?'box-shadow:0 0 0 2px '+col+'33;':'')+(_mute?'opacity:.72;':'')+'"><div style="display:flex;align-items:stretch;flex-wrap:wrap"><button onclick="'+famFn+'(\''+a.fam.id+'\')" title="กรองเฉพาะ '+e(a.fam.name)+'" style="display:inline-flex;align-items:center;gap:7px;border:none;background:'+_cc+(_mute?'10':'14')+';font-size:14px;font-weight:700;color:'+_cc+';white-space:nowrap;padding:9px 13px;cursor:pointer;font-family:inherit"><span style="width:9px;height:9px;border-radius:50%;background:'+_cc+';flex:none"></span>'+e(a.fam.name)+' <span style="font-family:\'DM Mono\',monospace;font-weight:600;opacity:.85;font-size:13px">'+a.pax+((a.booked||0)>a.pax?('<s style="opacity:.6;font-size:11px;margin-left:3px">'+a.booked+'</s>'):'')+'</span>'+(a.locked>0?' <span style="font-size:10px;color:#C0392B">&#128274;'+a.locked+'</span>':'')+'</button>'+subs+'</div>'+foot+'</div>';
  }).join('');
  return {html:html, dA:dA, dC:dC, dI:dI, dF:dF, total:Math.max(0,(dA+dC+dI+dF)-_lostAll), booked:dA+dC+dI+dF, lost:_lostAll};
}

// เด้งไปที่แถวหัวรถ/หัวเรือที่กด · เลื่อนให้พ้นหัวตารางที่ตรึงไว้ แล้วไฮไลต์สั้นๆ
function ckJump(id){
  var el=document.getElementById(id); if(!el) return;
  var top=(window.pageYOffset||0)+el.getBoundingClientRect().top-170;
  try{ window.scrollTo({top:Math.max(0,top), behavior:'smooth'}); }catch(_){ window.scrollTo(0,Math.max(0,top)); }
  var prev=el.style.boxShadow;
  el.style.transition='box-shadow .18s'; el.style.boxShadow='inset 0 0 0 2px #0F6E56';
  setTimeout(function(){ el.style.boxShadow=prev||''; }, 1500);
}
// การ์ดรถ/เรือของเส้นทางที่กำลังดูอยู่ · สร้างจาก groups ก้อนเดียวกับตาราง → ตัวเลขตรงกันเสมอ
// กดแล้วเด้งไปที่หัวคันนั้นในตาราง
function ckUnitBar(groups, gkeys, kind, anchorPrefix, tailHtml){
  var e=ckEsc, isPier=(kind==='pier');
  if(!gkeys.length) return tailHtml?('<div class="ck-unitbar">'+tailHtml+'</div>'):'';
  var chips=gkeys.map(function(k){
    var g=groups[k], uid=isPier?g.bid:g.vid;
    /* §ckPierSelf2 · คนตามมาเองที่ท่าทำให้ขึ้นจริงเกินยอดที่รอรับได้ · ตัวหารต้องขยายตาม
       ไม่งั้นชิปจะขึ้น 4/2 แล้วดูเหมือนระบบนับผิด */
    var tot=g.rows.reduce(function(s,r){ var c=r.ck, e=(r.expect!=null?r.expect:r.booked)||0;
      var a=(c&&c.at&&c.actualPax!=null)?(+c.actualPax||0):0; return s+Math.max(e,a); },0);
    var done=g.rows.reduce(function(s,r){ var c=r.ck; return s+((c&&c.at)?(c.actualPax!=null?c.actualPax:0):0); },0);
    var nm, col;
    if(isPier){ var bo=(typeof getBoat==='function'?getBoat(uid):null)||{}; var bc=(typeof getBoatColor==='function')?getBoatColor(uid):null;
      nm=bo.name||uid; col=bo.color||(bc&&bc.text&&bc.text!=='#666'?bc.text:'')||'#185FA5'; }
    else { var v=(typeof vehGet==='function'?vehGet(uid):null)||{}; var cp=(typeof vehChipPair==='function')?vehChipPair(uid):['#EEEDF0','#555'];
      nm=v.name||uid; col=cp[1]||'#5F5E5A'; }
    /* §vckFlow · คันไหนคนขับสแตนบายแล้ว ติดจุดเขียวไว้ · กวาดตาแถบเดียวรู้ว่ารถถึงจุดรับกี่คัน */
    var _sbOn=(!isPier && typeof vckArrGet==='function')
      ? !!vckArrGet((typeof _vanCkDate!=='undefined'?_vanCkDate:''), k) : false;
    var full=(tot>0&&done>=tot), part=(done>0&&!full);
    var numCol=full?'#0C6B47':part?'#854F0B':'#5F5E5A';
    var numBg =full?'#DCF4E8':part?'#FAEEDA':'#F1EFE8';
    var rt=(typeof getRoute==='function'?getRoute(g.routeId):null)||{};
    var gt=ckGroupTime(g.rows, (g.rows[0]&&g.rows[0].t&&g.rows[0].t.date)||'');
    var lateCard=(gt.state==='late');
    if(lateCard){ numCol='#A32D2D'; numBg='#FCEBEB'; }
    return '<button onclick="ckJump(\''+anchorPrefix+k.replace(/[^A-Za-z0-9_-]/g,'_')+'\')" title="'+e(nm)+' · '+e(rt.name||'')+' · '+(isPier?'ขึ้นเรือ':'ขึ้นรถ')+'แล้ว '+done+'/'+tot+' pax'+(gt.label?(' · รับ '+e(gt.label)):'')+(lateCard?(' · เลยเวลา '+gt.late+' ราย'):'')+' · คลิกเพื่อเด้งไปที่คันนี้" style="display:inline-flex;align-items:center;gap:7px;border:1.5px solid '+(lateCard?'#C0392B':(col+'55'))+';background:'+(lateCard?'#FFF7F6':'#fff')+';border-radius:11px;padding:5px 10px 5px 6px;cursor:pointer;font-family:inherit;white-space:nowrap">'
      +'<span style="width:8px;height:8px;border-radius:50%;background:'+col+';flex:none"></span>'
      +'<span style="font-size:12px;font-weight:700;color:#3a3a36">'+e(nm)+'</span>'
      +(_sbOn?'<span title="คนขับสแตนบายถึงจุดรับแล้ว" style="width:8px;height:8px;border-radius:50%;background:#12A46F;flex:none;box-shadow:0 0 0 2px #D6F2E6"></span>':'')
      +(gt.label?'<span style="font-family:\'DM Mono\',monospace;font-size:10.5px;color:'+(lateCard?'#A32D2D':'#a5a49d')+'">'+e(gt.label.split('-')[0])+'</span>':'')
      +'<span style="font-family:\'DM Mono\',monospace;font-size:12.5px;font-weight:700;color:'+numCol+';background:'+numBg+';border-radius:7px;padding:2px 8px">'+done+'/'+tot+'</span></button>';
  }).join('');
  return '<div class="ck-unitbar">'
    +'<span class="ck-unitbar-lbl">'+(isPier?'&#128676; เรือวันนี้':'&#128656; รถวันนี้')+'</span>'+chips
    +'<span style="'+(tailHtml?'':'margin-left:auto;')+'font-size:10.5px;color:#a5a49d;white-space:nowrap">คลิกการ์ดเพื่อเด้งไปที่'+(isPier?'ลำ':'คัน')+'นั้น</span>'
    +(tailHtml||'')+'</div>';
}
/* §vckFlow · dropdown เลือกสถานะ · สีของกล่องเปลี่ยนตามสถานะที่เป็นอยู่
   'รอ' กับ 'ไปเจอที่ท่า' ไม่ใช่ตัวเลือก · เป็นผลจากสิ่งที่เกิดขึ้น จึงโชว์เป็นบรรทัดแรกที่เลือกไม่ได้ */
function vckSelHtml(bkId,date,kind,st){
  var e=ckEsc, d=vckStDef(st), lead='';
  if(st==='wait'||st==='pier') lead='<option value="" selected>'+e(d.lbl)+'</option>';
  var opts=['standby','pending','checkin','cxl','noshow'].map(function(k){
    return '<option value="'+k+'"'+((k===st)?' selected':'')+'>'+e(VCK_SEL_LBL[k])+'</option>'; }).join('');
  return '<select class="vck-sel" title="เปลี่ยนสถานะของแถวนี้"'
    +' onchange="vckStatus(\''+bkId+'\',\''+date+'\',\''+kind+'\',this.value)"'
    +' onclick="event.stopPropagation()">'+lead+opts+'</select>';
}
/* ช่องขวาสุด · เขียนสิ่งที่เกิดขึ้นจริงเป็นภาษาคน · ยังกดแก้เหตุผลเดิมได้ */
function vckNoteHtml(ck,st,r,rsn){
  var arr=null;
  try{ if(r && r._gk) arr=vckArrGet(r._date||_vanCkDate, r._gk); }catch(_){}
  var txt=vckRowNote(ck, st, arr&&arr.at);
  var d=vckStDef(st);
  var body = txt ? ('<span class="vck-nt">'+d.ic+' '+txt+'</span>') : '<span class="ck-dim">—</span>';
  return body + (rsn && st!=='wait' ? ('<div class="vck-rsn">'+rsn+'</div>') : '');
}
/* §pickShort (2026-09-03) · ชื่อจุดรับที่ลงท้ายด้วย (self-arrive) ยาวเกินช่อง
   และซ้ำกับสิ่งที่คอลัมน์โซนบอกอยู่แล้ว · ตัดเฉพาะตอนแสดงผล ไม่แตะข้อมูล
   ในฐานมีเกือบพันใบที่บันทึกชื่อเต็มไว้แล้ว แก้ที่ข้อมูลคือไปไล่แก้ของเก่าทั้งหมด */
function ckPickShort(v){
  return String(v==null?'':v).replace(/\s*\((self[\s-]?arrive|มาเอง)\)\s*$/i,'').trim();
}
// แถวลูกค้า · ใช้ร่วม 2 หน้า (kind='van'|'pier') · extra = html คอลัมน์เพิ่ม (แทรกก่อนบล็อกเช็คอิน)
function ckRowHtml(r, date, kind, extraHtml){
  var e=ckEsc, b=r.b, t=r.t;
  /* §strand · แถวค้าง · ตัดปุ่มสั่งการทิ้งทั้งหมด กดอะไรกับใบที่ยกเลิกแล้วไม่ได้
     เหลือแค่ "ทำไมถึงค้าง" กับปุ่มล้าง · คอลัมน์หน้ายังเหมือนแถวปกติ
     เพราะคนขับต้องเทียบกับใบงานในมือว่าเป็นบรรทัดเดียวกัน */
  if(r.strand){
    var _sag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var _sagN=_sag?(_sag.name||_sag.code||'—'):(b.channel||'walk-in');
    var _sp0=r.sp||null, _spb=ckPaxBreak(t.pax);
    if(_sp0) _spb={ad:+_sp0.ad||0, chd:+_sp0.chd||0, inf:+_sp0.inf||0, foc:+_sp0.foc||0};
    var _stm=r.O.pickupTimeFinal||t.pickupTime||t.pickupFinal||'—';
    var _spk=ckPickShort(b.hotelName||b.pickup||'')||'—';
    var _sar=ckPickShort(b.pickupArea||'')||'';
    return '<tr class="ck-row ck-strand'+(r.strand==='mv'?' mv':'')+'">'
     +'<td><span class="ck-vch">'+e(b.voucherRef||b.code||'—')+'</span></td>'
     +'<td>'+e(_sagN)+'</td>'
     +'<td>'+(b.createdBy?e(b.createdBy):'—')+'</td>'
     +'<td><span class="ck-lead">'+e(b.leadPax||'—')+'</span>'
       +'<span class="ck-sbadge">'+e(r.strand==='mv'?'เลื่อนวัน':'CXL')+'</span></td>'
     +['ad','chd','inf','foc'].map(function(k){ return '<td class="ck-c">'+(_spb[k]||0)+'</td>'; }).join('')
     +'<td class="ck-mono">'+e(_stm)+'</td>'
     +'<td><span class="ck-pick">'+e(_spk)+'</span></td>'
     +'<td class="ck-c ck-mono">'+e(b.roomNo||b.roomNumber||'—')+'</td>'
     +'<td>'+(_sar?'<span class="ck-area">'+e(_sar)+'</span>':'—')+'</td>'
     +'<td>—</td>'
     +'<td colspan="'+(r.strandTail||4)+'" class="ck-in">'
       +'<span class="ck-swhy" title="'+e(r.strandWhy||'')+'">'+e(r.strandWhy||'')+'</span>'
       +'<button class="ck-sclr" onclick="event.stopPropagation();ckStrandClear(\''+b.id+'\',\''+date+'\')" '
       +'title="ล้างการจัดรถ/เรือของวันนี้ · แถวนี้จะหายจากทุกหน้าปฏิบัติการ · ใบจองไม่ถูกแตะ">ล้างการจัดรถ</button>'
     +'</td></tr>';
  }
  /* §vckSplit · แถวของจุดรับย่อย · โรงแรม/โซน/จำนวนคน เป็นของจุดนั้น ไม่ใช่ของ Lead */
  var _sp=r.sp||null;
  var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  var agName=ag?(ag.name||ag.code||'—'):(b.channel||'walk-in');
  // บล็อกสี agency แบบเดียวกับ By-trip (เต็มช่อง ไม่ใช่ชิปเล็ก) · ใช้สีเดียวกันด้วย
  var agColor=(b.agentId&&typeof bkV2AgentColor==='function')?bkV2AgentColor(b.agentId):((ag&&ag.color)||'#64748B');
  var agInk=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(agColor):'#fff';
  var agLogo=(typeof laAgencyMark==='function')?laAgencyMark(b,20):'';   // §van
  var agCell=agLogo
    ? '<td style="padding:0">'+agLogo+'</td>'
    : b.agentId
    ? '<td style="padding:0"><div class="ck-agblk" title="'+e(agName)+'" style="background:'+agColor+';color:'+agInk+';margin:2px 3px;padding:11px 11px;border-radius:8px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;box-shadow:0 1px 2px rgba(0,0,0,.10)">'+e(agName)+'</div></td>'
    : '<td><span style="color:#8a8a82;font-weight:600">'+e(agName)+'</span></td>';
  var pb=ckPaxBreak(t.pax);
  var time=r.O.pickupTimeFinal||t.pickupTime||t.pickupFinal||'';
  var pickup=b.hotelName||b.pickup||'—';
  var pArea=b.pickupArea||(b.pickupAreaId&&typeof bkV2GetArea==='function'?((bkV2GetArea(b.pickupAreaId)||{}).name||''):'')||'';
  if(_sp){
    pb={ad:+_sp.ad||0, chd:+_sp.chd||0, inf:+_sp.inf||0, foc:+_sp.foc||0};
    if(!_sp.main){
      var _ar=(_sp.pickAreaId && typeof bkV2GetArea==='function')?(bkV2GetArea(_sp.pickAreaId)||{}):{};
      pickup=(_sp.pickHotel||'').trim() || _ar.name || pickup;
      pArea=_ar.name||pArea;
    }
  }
  pickup=ckPickShort(pickup)||'—'; pArea=ckPickShort(pArea);   /* §pickShort · ชื่อโซนก็ยาวแบบเดียวกัน */
  var room=b.roomNo||b.room||b.roomNumber||'—';
  var phone=b.leadPhone||b.phone||b.customerPhone||'';
  var by=b.createdBy||'';
  var sreq=(typeof vanJobsSreqFinal==='function')?(vanJobsSreqFinal(b)||''):((b.notes||'').trim());
  var ck=r.ck||{};
  var booked=(r.expect!=null?r.expect:r.booked);
  var actual=(ck.actualPax!=null?ck.actualPax:booked), noShow=Math.max(0,booked-actual), on=!!ck.at;
  var num=function(x){ return x>0?'<span class="ck-mono">'+x+'</span>':'<span class="ck-dim">0</span>'; };
  var rsn='';
  if(noShow>0){
    var lbl=ck.reasonCode?((ck.reasonAt?ck.reasonAt+' · ':'')+ckReasonLabel(ck.reasonCode)+(ck.reasonNote?(' · '+ck.reasonNote):'')):'⚠ ใส่เหตุผล';
    rsn='<button class="ck-rsn'+(ck.reasonCode?'':' ck-rsn-need')+'" onclick="event.stopPropagation();ckReasonOpen(\''+b.id+'\',\''+date+'\',\''+kind+'\')" title="'+e(lbl)+' · คลิกแก้ไข">'+e(lbl)+'</button>';
  } else if(ck.reasonCode){ rsn='<span class="ck-dim" style="font-size:10.5px">—</span>'; }
  var tally=ckEventTally(ck);
  var tst=ckTimeState(time, date, on);
  var _lost=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
  var _stg=(kind==='pier'&&!on)?pckStage(ck):'';
  var cls='ck-row'+(on?' ck-done':(_stg==='clr'?' ck-plain ck-clr':(_stg==='arr'?' ck-plain ck-arr':' ck-plain')))+(((_lost&&_lost.total>0)||noShow>0)?' ck-lost':'')+((noShow>=booked&&booked>0&&(on||(_lost&&_lost.total>0)))?' ck-nsfull':'')+(tst.k==='late'?' ck-late':'');
  /* §vckFlow · เฉพาะหน้าเช็คอินรถ · ทั้งแถวเปลี่ยนสีตามสถานะ ตัวแปรสีวางเป็น inline
     ที่ไม่เขียนเป็นคลาสตายตัวเพราะสีตั้งเองได้ · หน้าท่ายังใช้ของเดิมทุกอย่าง */
  var _isVan=(typeof _ckBase==='function' && _ckBase(kind)==='van');
  var _vst='', _vsty='';
  if(_isVan){
    _vst=vckRowSt(ck);
    /* ตัวแปรสีติดทุกแถว (ชิป Status ใช้) แต่ระบายพื้นเฉพาะแถวที่แขกคนนั้นมีผลจริงแล้ว
       รอ / Standby = ยังไม่ได้รับใครขึ้นรถ → ซีดไว้ ไม่งั้นแถวที่ยังไม่ได้ทำจะเด่นกว่าแถวที่ทำแล้ว */
    cls+=' vstv'+((_vst==='wait'||_vst==='standby')?' vck-pale':' vst')+' vkb-'+vckBarStyle();   /* §vckBar */
    _vsty=' style="'+vckStVars(_vst)+'"';
  }
  return '<tr class="'+cls+'"'+_vsty+'>'
   +'<td><span class="ck-vch" title="'+e(b.voucherRef||b.code||'')+'">'+e(b.voucherRef||b.code||'—')+'</span></td>'
   +agCell
   +'<td>'+(by?'<span class="ck-by" title="ผู้บันทึก booking · '+e(by)+'">'+e(by)+'</span>':'<span class="ck-dim">—</span>')+'</td>'
   +'<td><span class="ck-lead" style="background:'+((b.ops&&b.ops.reconfirm&&b.ops.reconfirm.status&&typeof rcStateColor==='function')?rcStateColor(b.ops.reconfirm.status):'#F6E27A')+'">'+e(b.leadPax||'—')+'</span>'
     +(phone?'<div><a class="ck-tel" href="tel:'+e(String(phone).split(/[,;\/]|\sหรือ\s/)[0].replace(/[^0-9+]/g,''))+'" onclick="event.stopPropagation()" title="โทรหาลูกค้า · '+e(phone)+'"><span class="ck-telic">&#128222;</span> '+e(phone)+'</a></div>':'')+'</td>'
   +(function(){ var L=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
       return ['ad','chd','inf','foc'].map(function(k){
         var bkd=pb[k]||0;
         if(!L || L.total<=0) return '<td class="ck-c">'+num(bkd)+'</td>';
         var left=ckPaxLeft(b,date,k,bkd);
         if(left===bkd) return '<td class="ck-c">'+num(bkd)+'</td>';
         return '<td class="ck-c" title="จองมา '+bkd+' · เดินทางจริง '+left+'"><span style="font-family:\'DM Mono\',monospace;font-weight:700;color:'+(left?'#A32D2D':'#c8c6be')+'">'+left+'</span><div style="font-size:9px;color:#c2c0b7;line-height:1.1;text-decoration:line-through">'+bkd+'</div></td>';
       }).join(''); })()
   +'<td>'+ckTimeChip(tst, time, kind)+'</td>'
   +'<td><span class="ck-pick">'+e(pickup)+'</span>'+(function(){
       // §retVan · รถขากลับของแถวนี้ · เงียบไว้ถ้ากลับคันเดิมโดยปริยาย
       var _d=(typeof pckJobDrop==='function')?pckJobDrop(b,date):null; if(!_d) return '';
       var _w=(_d.van&&_d.van.kind==='pending');
       return '<div style="margin-top:3px;font-size:10px;font-weight:700;line-height:1.35;'
         +'color:'+(_w?'#A32D2D':(_d.self?'#7a7972':'#633806'))+'">'
         +(_d.t?('&#8627; ส่ง '+e(_d.t)):'')
         +(_d.van?((_d.t?' · ':'')+e(ckRetVanTxt(_d.van))):'')+'</div>';
     })()+(r.priv?'<span title="รถเหมา · ไม่แชร์" style="display:inline-block;margin-left:5px;background:#F4E8FB;color:#6B289A;font-weight:700;font-size:9px;padding:1px 6px;border-radius:6px;vertical-align:middle;white-space:nowrap">เหมา'+(r.priv.qty>1?' ×'+r.priv.qty:'')+' · '+e(r.priv.zone)+'</span>':'')+'</td>'
   +'<td class="ck-c ck-mono">'+e(room)+'</td>'
   +'<td>'+(pArea?'<span class="ck-area">'+e(pArea)+'</span>':'<span class="ck-dim">—</span>')+'</td>'
   +'<td>'+(sreq?'<span class="ck-sreq" title="'+e(sreq)+'">'+e(sreq)+'</span>':'<span class="ck-dim">—</span>')+'</td>'
   +(extraHtml||'')
   +'<td class="ck-c ck-in" style="border-left:2px solid #BFE3CC"><span class="ck-stp"><button onclick="ckStep(\''+b.id+'\',\''+date+'\',\''+kind+'\',-1)">&minus;</button><span class="ck-n">'+actual+'</span><button onclick="ckStep(\''+b.id+'\',\''+date+'\',\''+kind+'\',1)">+</button></span>'
     +'<div class="ck-bk" title="ยอดที่จองมา'+(booked!==r.booked?(' · หักคนที่หายตอนรถรับแล้ว เหลือรอรับ '+booked):'')+'">จอง '+r.booked+'</div></td>'
   +'<td class="ck-in">'
     /* §vckFlow · หน้ารถย้ายไปสั่งจาก dropdown แล้ว · ปุ่มคู่นี้เหลือไว้ให้หน้าท่า */
     +(_isVan?'':'<div class="ck-evb"><button class="ck-ev ck-ev-ns" onclick="ckEventOpen(\''+b.id+'\',\''+date+'\',\''+kind+'\',\'no_show\')" title="ลูกค้าไม่มา · ไม่แจ้งล่วงหน้า">No-show</button>'
       +'<button class="ck-ev ck-ev-cx" onclick="ckEventOpen(\''+b.id+'\',\''+date+'\',\''+kind+'\',\'cxl\')" title="ลูกค้าแจ้งยกเลิกหน้างาน">CXL</button></div>')
     +(tally.no_show>0?'<div><span class="ck-ns">No-show '+tally.no_show+'</span></div>':'')
     +(tally.cxl>0?'<div><span class="ck-cx">CXL '+tally.cxl+'</span></div>':'')
     +((noShow>0 && tally.total<noShow)?'<div><span class="ck-ns">ไม่ระบุเหตุ '+(noShow-tally.total)+'</span></div>':'')
     /* §ckBack · ทางกลับ · โผล่เฉพาะแถวที่มีรายการค้างอยู่จริง */
     +(ckEvLive(ck.events).length
        ? ('<div class="ck-bkb"><button class="ck-ic bk" onclick="event.stopPropagation();ckBackOpen(\''+b.id+'\',\''+date+'\',\''+kind+'\')" title="เจอลูกค้าแล้ว · รับกลับขึ้นรถ หรือแก้กรณีกดผิด">&#8617;&#65039;</button>'
           +'<button class="ck-ic ag" onclick="event.stopPropagation();ckTryOpen(\''+b.id+'\',\''+date+'\',\''+kind+'\')" title="วนกลับไปแล้วยังไม่เจอ · บันทึกอีกรอบ">&#128257;</button></div>')
        : '')
     +ckBackChips(ck)
   +'</td>'
   +(_isVan
      ? ('<td class="ck-c ck-in">'+vckSelHtml(b.id,date,kind,_vst)+'</td>'
         +'<td class="ck-in">'+vckNoteHtml(ck,_vst,r,rsn)+'</td>')
      : ('<td class="ck-c ck-in"><button class="ck-ck '+(on?'on':'')+'" onclick="ckToggle(\''+b.id+'\',\''+date+'\',\''+kind+'\')" title="'+(on?('เช็คอินแล้ว · '+e(ck.by||'')):'กดเมื่อขึ้น'+(kind==='pier'?'เรือ':'รถ'))+'">&#10003;</button></td>'
         +'<td class="ck-in">'+rsn+'</td>'))
   +'</tr>';
}
function vckStDef(k){ for(var i=0;i<VCK_STATES.length;i++){ if(VCK_STATES[i].k===k) return VCK_STATES[i]; } return VCK_STATES[0]; }
function vckColors(){
  var b, raw='';
  try{ b=laBlob(); raw=(typeof b.vck_status_colors==='string')?b.vck_status_colors:''; }catch(_){ raw=''; }
  if(_VCK_COL===null || _VCK_COL_SRC!==raw){
    var o={}; if(raw){ try{ o=JSON.parse(raw)||{}; }catch(_){ o={}; } }
    var out={}; VCK_STATES.forEach(function(s){ out[s.k]=(typeof o[s.k]==='string'&&/^#[0-9a-fA-F]{6}$/.test(o[s.k]))?o[s.k]:s.c; });
    _VCK_COL=out; _VCK_COL_SRC=raw;
  }
  return _VCK_COL;
}
function vckBarStyle(){
  try{ var v=laBlob().vck_bar_style; return (v==='c')?'c':'a'; }catch(_){ return 'a'; }
}
function vckBarStyleSet(v){
  if(typeof ckGuard==='function' && !ckGuard()) return;
  v=(v==='c')?'c':'a';
  try{ var b=laBlob(); if(v==='a') delete b.vck_bar_style; else b.vck_bar_style=v; laBlobSave(); }catch(_){}
  if(typeof renderVanCheckin==='function') renderVanCheckin();
}
function vckColorSet(k,hex){
  if(typeof ckGuard==='function' && !ckGuard()) return;
  if(!/^#[0-9a-fA-F]{6}$/.test(String(hex||''))) return;
  try{
    var b=laBlob(), C=vckColors(); C[k]=hex;
    var keep={}; VCK_STATES.forEach(function(s){ if(C[s.k]&&C[s.k].toLowerCase()!==s.c.toLowerCase()) keep[s.k]=C[s.k]; });
    if(Object.keys(keep).length){ var str=JSON.stringify(keep); b.vck_status_colors=str; _VCK_COL_SRC=str; }
    else { delete b.vck_status_colors; _VCK_COL_SRC=''; }
    laBlobSave();
  }catch(e){ try{ console.warn('[vckFlow] color save failed', e && e.message); }catch(_){} }
}
function vckColorsReset(){
  if(typeof ckGuard==='function' && !ckGuard()) return;
  if(!confirm('คืนค่าสีของทุกสถานะกลับเป็นค่าเริ่มต้น?')) return;
  try{ var b=laBlob(); delete b.vck_status_colors; _VCK_COL=null; _VCK_COL_SRC=null; laBlobSave(); }catch(_){}
  vckColorClose(); if(typeof renderVanCheckin==='function') renderVanCheckin();
}
/* ── ไล่เฉดจากสีเดียว ── */
function vckRGB(c){ var h=String(c||'').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-fA-F]{6}$/.test(h)) h='888888';
  var n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function _vckHx(v){ v=Math.max(0,Math.min(255,Math.round(v))); return ('0'+v.toString(16)).slice(-2); }
function vckTint(c,t){ var a=vckRGB(c); return '#'+_vckHx(a[0]+(255-a[0])*t)+_vckHx(a[1]+(255-a[1])*t)+_vckHx(a[2]+(255-a[2])*t); }
function vckDark(c,f){ var a=vckRGB(c); return '#'+_vckHx(a[0]*f)+_vckHx(a[1]*f)+_vckHx(a[2]*f); }
/* ตัวแปรสีของสถานะหนึ่ง · เอาไปวางเป็น inline style บนแถว */
function vckStVars(k){
  var c=vckColors()[k]||vckStDef(k).c;
  /* §vckBar · แบบเข้ม · พื้นเข้มขึ้นมาก ป้ายสถานะจึงกลับด้านเป็นพื้นขาว
     ไม่งั้นป้ายจะจมหายไปในพื้น · ตัวหนังสือทั้งแถวต้องเข้มตามเพื่อให้ยังอ่านออก */
  if(vckBarStyle()==='c'){
    return '--vst-bar:'+c+';--vst-bg:'+vckTint(c,0.40)+';--vst-hov:'+vckTint(c,0.28)
      +';--vst-chip:#ffffff;--vst-ink:'+vckDark(c,0.45)+';--vst-tx:'+vckDark(c,0.30);
  }
  /* §vckFix · เดิมจาง 90% แล้วแถว No-show/CXL ซีดกว่าของเดิม (#F6CFCB) จนดูเหมือนสีไม่เปลี่ยน
     0.82 ให้ความเข้มใกล้ของเดิม และยังอ่านตัวหนังสือดำบนพื้นได้สบาย */
  return '--vst-bar:'+c+';--vst-bg:'+vckTint(c,0.82)+';--vst-hov:'+vckTint(c,0.72)
    +';--vst-chip:'+vckTint(c,0.72)+';--vst-ink:'+vckDark(c,0.58);
}

/* ── สถานะของแถว · อ่านจากของเดิมเป็นหลัก ไม่เก็บซ้ำ ── */
function vckRowSt(ck){
  ck=ck||{};
  var ev=(typeof ckEvLive==='function')?ckEvLive(ck.events):[], last=null;
  for(var i=ev.length-1;i>=0;i--){ if(ev[i] && +ev[i].pax>0){ last=ev[i]; break; } }
  var evSt=null;
  if(last) evSt=(last.type==='cxl') ? 'cxl'
    : ((typeof ckExpectAtPier==='function' && ckExpectAtPier(last.reasonCode)) ? 'pier' : 'noshow');
  /* §vckSt2 · ck.at ห้ามชนะแบบไม่มีเงื่อนไข
     ckEvSave() เก็บ at เดิมไว้เสมอ (ตั้งใจ · ประวัติว่าเคยติ๊กขึ้นรถต้องไม่หาย)
     ผลคือแถวที่กด No-show จนไม่เหลือใครขึ้นรถ ยังอ่านว่า "ขึ้นรถแล้ว"
     dropdown เด้งกลับเป็น Check-in ทันทีที่เลือก และสีที่ตั้งให้ No-show ไม่มีวันขึ้น
     ของจริงในระบบมีแบบนี้เยอะ (จอง 1 · ขึ้นจริง 0 · No-show 1)
     เกณฑ์ · ไม่เหลือใครขึ้นรถเลย = สถานะของแถวคือเหตุการณ์นั้น
             ยังเหลือคนขึ้น = ขึ้นรถแล้ว (บางส่วนไม่มา ไปโชว์เป็นป้ายในแถว) */
  var actual=(ck.actualPax!=null)?(+ck.actualPax||0):null;
  if(evSt && actual!==null && actual<=0) return evSt;
  if(ck.at) return 'checkin';
  if(evSt) return evSt;
  if(ck.flow==='pending') return 'pending';
  if(ck.flow==='standby') return 'standby';
  return 'wait';
}
/* ข้อความ "เกิดอะไรขึ้น" ของแถว · เขียนเป็นภาษาคน พร้อมเวลา */
function vckRowNote(ck, st, arrAt){
  ck=ck||{};
  var e=ckEsc;
  if(st==='checkin'){ var hm=''; try{ hm=ck.at?new Date(ck.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):''; }catch(_){}
    return 'ขึ้นรถแล้ว'+(hm?(' '+hm):'')+(ck.by?(' · '+e(ck.by)):''); }
  var ev=(typeof ckEvLive==='function')?ckEvLive(ck.events):[], last=null;
  for(var i=ev.length-1;i>=0;i--){ if(ev[i] && +ev[i].pax>0){ last=ev[i]; break; } }
  if(st==='cxl'||st==='noshow'||st==='pier'){
    if(!last) return '';
    var head=(st==='cxl')?'ยกเลิกหน้างาน':(st==='pier'?'ไปเองที่ท่า':'ไม่มา');
    var pre=(ck.at&&st!=='pier')?'ไม่เหลือคนขึ้นรถ · ':'';
    var rl=(last.reasonCode&&typeof ckReasonLabel==='function')?ckReasonLabel(last.reasonCode):'';
    var tries=(typeof ckEvTries==='function')?ckEvTries(ck.events).length:0;
    return pre+head+(last.at?(' '+e(last.at)):'')
      +(rl?(' · '+e(rl)):'')+(last.note?(' · '+e(last.note)):'')
      +(st==='pier'?' · รอหน้าท่ายืนยัน':'')
      +(tries>0?(' · วนกลับแล้ว '+tries+' รอบ'):'');
  }
  if(st==='pending') return (ck.flowNote?e(ck.flowNote):'ไม่เจอแขก · กำลังตาม')+(ck.flowAt?(' '+e(ck.flowAt)):'');
  if(st==='standby') return 'สแตนบายถึงจุดแรกแล้ว'+((arrAt||ck.flowAt)?(' '+e(arrAt||ck.flowAt)):'');
  return '';
}
/* ── เปลี่ยนสถานะจาก dropdown ── */
function vckSetFlow(bkId,date,kind,val,note){
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var cur=ckRead(b,date,kind)||{}, o={};
  Object.keys(cur).forEach(function(k){ o[k]=cur[k]; });
  o.flow=val||''; o.flowAt=val?ckNowHM():''; o.flowBy=val?ckMe():'';
  if(note!==undefined) o.flowNote=note||'';
  ckWrite(b,date,kind,o);
}
function vckStatus(bkId,date,kind,val){
  if(!ckGuard()) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var cur=ckRead(b,date,kind)||{};
  if(val==='checkin'){ if(!cur.at) ckToggle(bkId,date,kind); else ckAfter(kind); return; }
  if(val==='cxl'||val==='noshow'){ ckEventOpen(bkId,date,kind,(val==='cxl'?'cxl':'no_show')); return; }
  if(val==='standby'||val==='pending'){
    /* เคยติ๊กขึ้นรถไว้แล้วแต่เลือกย้อนกลับ · ต้องถอนติ๊กก่อน ไม่งั้นสถานะกับยอดจะขัดกัน */
    if(cur.at){ if(!confirm('แถวนี้ติ๊กขึ้นรถไว้แล้ว'+String.fromCharCode(10)
        +'ถอนติ๊กแล้วเปลี่ยนเป็น "'+vckStDef(val).lbl+'" ใช่ไหม?'+String.fromCharCode(10,10)
        +'ยอดขึ้นจริงกับประวัติที่บันทึกไว้ยังอยู่ครบ')) { ckAfter(kind); return; }
      ckToggle(bkId,date,kind); }
    vckSetFlow(bkId,date,kind,val); ckPersist(); ckAfter(kind); return;
  }
  ckAfter(kind);
}
function vckColorOpen(k){
  if(typeof ckGuard==='function' && !ckGuard()) return;
  var s=vckStDef(k); _vckPick={k:k, c:vckColors()[k]||s.c};
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)vckColorClose()" class="ck-ovl"><div class="ck-dlg vck-cdlg">'
   +'  <div class="ck-dh"><div><div class="t1">สีของสถานะ &ldquo;'+ckEsc(s.lbl)+'&rdquo;</div>'
   +'    <div class="t2">'+ckEsc(s.full)+'</div></div>'
   +'    <button class="x" onclick="vckColorClose()">&times;</button></div>'
   +'  <div class="ck-db">'
   +'    <div class="lb">สีที่ใช้บ่อย</div><div class="vck-sw" id="vck-sw"></div>'
   +'    <div class="lb">หรือเลือกเอง</div>'
   +'    <div class="vck-cst">'
   +'      <input type="color" id="vck-cin" value="'+ckEsc(_vckPick.c)+'" oninput="vckColorPick(this.value)">'
   +'      <input type="text" id="vck-hin" class="ck-inp" value="'+ckEsc(_vckPick.c)+'" oninput="vckColorPick(this.value)" style="width:118px">'
   +'      <span class="ck-fn" style="margin:0">เลือกสีเดียว · เฉดที่เหลือระบบไล่ให้</span></div>'
   +'    <div class="vck-prev"><div class="ph">ตัวอย่างแถวจริง</div><div id="vck-pv"></div></div>'
   +'  </div>'
   +'  <div class="ck-df"><button class="c" onclick="vckColorsReset()">↺ คืนค่าทุกสี</button>'
   +'    <span style="flex:1"></span>'
   +'    <button class="c" onclick="vckColorClose()">ยกเลิก</button>'
   +'    <button class="k" onclick="vckColorApply()">ใช้สีนี้</button></div>'
   +'</div></div>';
  vckColorSw(); vckColorPv();
}
function vckColorSw(){
  var el=document.getElementById('vck-sw'); if(!el||!_vckPick) return;
  el.innerHTML=VCK_PRESET.map(function(p){
    return '<button style="background:'+p+'" class="'+((p.toLowerCase()===String(_vckPick.c).toLowerCase())?'on':'')
      +'" title="'+p+'" onclick="vckColorPick(\''+p+'\')"></button>'; }).join('');
}
function vckColorPv(){
  var el=document.getElementById('vck-pv'); if(!el||!_vckPick) return;
  var c=_vckPick.c, s=vckStDef(_vckPick.k);
  /* §vckBar · ตัวอย่างต้องเป็นแบบเดียวกับที่ใช้อยู่จริง ไม่งั้นเลือกสีเสร็จแล้วเจอคนละหน้า */
  var _bs=vckBarStyle(), _pbg=(_bs==='c')?vckTint(c,0.40):vckTint(c,0.90);
  var _pcb=(_bs==='c')?'#ffffff':vckTint(c,0.80), _pci=(_bs==='c')?vckDark(c,0.45):vckDark(c,0.60);
  el.innerHTML='<div class="prow" style="background:'+_pbg+(_bs==='c'?(';color:'+vckDark(c,0.30)):'')+'">'
    +'<span class="pb" style="background:'+c+'"></span>'
    +'<b>Marina Mosina</b><span class="ph2"'+(_bs==='c'?(' style="color:'+vckDark(c,0.34)+'"'):'')+'>GLOW Mira Karon Beach</span>'
    +'<span class="pc" style="background:'+_pcb+';border-color:'+c+';color:'+_pci+'">'
    +ckEsc(s.lbl)+'</span></div>';
}
function vckColorPick(v){
  if(!_vckPick) return;
  v=String(v||'').trim(); if(v.charAt(0)!=='#') v='#'+v;
  if(!/^#[0-9a-fA-F]{6}$/.test(v)) return;
  _vckPick.c=v;
  var ci=document.getElementById('vck-cin'), hi=document.getElementById('vck-hin');
  if(ci&&ci.value.toLowerCase()!==v.toLowerCase()) ci.value=v;
  if(hi&&hi.value.toLowerCase()!==v.toLowerCase()) hi.value=v;
  vckColorSw(); vckColorPv();
}
function vckColorApply(){ if(!_vckPick) return; vckColorSet(_vckPick.k,_vckPick.c);
  vckColorClose(); if(typeof renderVanCheckin==='function') renderVanCheckin(); }
function vckColorClose(){ _vckPick=null; if(typeof ckReasonClose==='function') ckReasonClose(); }
function vckLegendToggle(){
  _VCK_LG=!_VCK_LG;
  try{ localStorage.setItem('vck_legend', _VCK_LG?'1':'0'); }catch(_){}
  if(typeof renderVanCheckin==='function') renderVanCheckin();
}
function vckSetQ(v){
  _vckQ=String(v||'');
  if(typeof renderVanCheckin==='function') renderVanCheckin();
  var el=document.getElementById('vck-q');
  if(el){ el.focus(); try{ el.setSelectionRange(el.value.length, el.value.length); }catch(_){} }
}
/* เทียบแบบตัดอักขระที่ไม่ใช่ตัวเลขออกด้วย · เบอร์ในระบบเขียนกันคนละแบบ
   +66 81-691-6571 / 081 691 6571 · พิมพ์ 6916571 ต้องเจอ */
function vckQMatch(b, date){
  var q=(_vckQ||'').toLowerCase().trim();
  if(!q) return true;
  var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  var hay=[b.voucherRef, b.code, b.leadPax, b.leadPhone, b.phone, b.customerPhone,
           b.hotelName, b.pickup, b.roomNo, b.roomNumber, b.createdBy,
           ag&&(ag.name||ag.code)].join(' ').toLowerCase();
  if(hay.indexOf(q)>=0) return true;
  var dq=q.replace(/[^0-9]/g,'');
  if(dq.length>=3 && hay.replace(/[^0-9]/g,'').indexOf(dq)>=0) return true;
  return false;
}
function vckSearchBox(){
  var e=ckEsc;
  return '<input id="vck-q" class="vck-q'+(_vckQ?' on':'')+'" value="'+e(_vckQ)+'"'
    +' oninput="vckSetQ(this.value)" placeholder="&#128269; voucher / ชื่อ / เบอร์ / โรงแรม">';
}
/* ปุ่มกาง/พับ ไปฝากไว้ท้ายแถบ "รถวันนี้" · ไม่กินบรรทัดของตัวเอง
   ตอนพับ vckLegend() คืนสตริงว่าง แถวนั้นหายไปทั้งแถว ได้พื้นที่คืนเต็ม ๆ */
function vckLegendBtn(){
  return '<button class="vck-lgt" onclick="vckLegendToggle()" title="'
    +(_VCK_LG?'ซ่อนแถบสี':'ตั้งสีของแต่ละสถานะ')+'">'
    +(_VCK_LG?'&#9662;':'&#9656;')+' แถบสี</button>';
}
function vckLegend(){
  if(!_VCK_LG) return '';
  var C=vckColors(), _bs=vckBarStyle();
  return '<div class="vck-lgbar">'
   +VCK_STATES.map(function(s){
      var c=C[s.k]||s.c;
      return '<button class="vck-lgb" onclick="vckColorOpen(\''+s.k+'\')" title="กดเพื่อเปลี่ยนสีของสถานะนี้">'
        +'<i style="background:'+vckTint(c,0.86)+';border-color:'+c+'"></i>'
        +ckEsc(s.lbl)+' <small>'+ckEsc(s.full)+'</small></button>'; }).join('')
   +'<span class="vck-bs"><b>แบบแถบ</b><span class="g">'
   +VCK_BARS.map(function(x){ return '<button class="'+(_bs===x.k?'on':'')+'" title="'+ckEsc(x.full)
        +'" onclick="vckBarStyleSet(\''+x.k+'\')">'+ckEsc(x.lbl)+'</button>'; }).join('')
   +'</span></span>'
   +'<button class="vck-rs" onclick="vckColorsReset()" title="คืนค่าสีของทุกสถานะ">↺ คืนค่าสีเริ่มต้น</button></div>';
}
function vckArrAll(){
  var b, raw='';
  try{ b=laBlob(); raw=(typeof b.vck_arrive==='string')?b.vck_arrive:''; }catch(_){ return _VCK_ARR||(_VCK_ARR={}); }
  if(_VCK_ARR===null || _VCK_ARR_SRC!==raw){
    var o={}; if(raw){ try{ o=JSON.parse(raw)||{}; }catch(_){ o={}; } }
    _VCK_ARR=o; _VCK_ARR_SRC=raw;
  }
  return _VCK_ARR;
}
function vckArrSave(){
  try{
    var b=laBlob(), o=vckArrAll();
    if(Object.keys(o).length){ var str=JSON.stringify(o); b.vck_arrive=str; _VCK_ARR_SRC=str; }
    else { delete b.vck_arrive; _VCK_ARR_SRC=''; }
    laBlobSave();
  }catch(e){ try{ console.warn('[vckArr] save failed', e && e.message); }catch(_){} }
}
function vckArrKey(date,gk){ return date+'::'+gk; }
function vckArrGet(date,gk){ return vckArrAll()[vckArrKey(date,gk)]||null; }
function vckArrToggle(date,gk,vanName){
  if(typeof ckGuard==='function' && !ckGuard()) return;
  var A=vckArrAll(), key=vckArrKey(date,gk), cur=A[key], on=!cur;
  if(cur){
    if(!confirm('ยกเลิกการบันทึก "ถึงจุดรับแล้ว"?' + String.fromCharCode(10)
       + (vanName||'') + ' · บันทึกไว้ ' + (cur.at||'') + ' โดย ' + (cur.by||'')
       + String.fromCharCode(10,10)
       + 'นาฬิการอลูกค้าจะหยุดนับ · แถวที่เป็น Standby อยู่จะกลับเป็น "รอ"')) return;
    delete A[key];
  } else {
    A[key]={ at:ckNowHM(), by:ckMe(), ts:new Date().toISOString() };
  }
  vckArrSave();
  vckArrFlow(date, gk, on);
  if(typeof ckPersist==='function') ckPersist();
  if(typeof renderVanCheckin==='function') renderVanCheckin();
}
/* ติ๊ก = แถวที่ยังไม่ได้ทำอะไรเลยกลายเป็น Standby พร้อมกัน
   ไม่แตะแถวที่เช็คอินแล้ว / มีเหตุการณ์แล้ว / คนกดเปลี่ยนเป็นตามแขกเองแล้ว
   เอาติ๊กออก = คืนเฉพาะแถวที่เป็น Standby กลับเป็น "รอ" */
function vckArrFlow(date, gk, on){
  var list=_VCK_ROWKINDS[gk]||[], n=0;
  list.forEach(function(it){
    var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===it.id; }); if(!b) return;
    var cur=ckRead(b,date,it.kind)||{};
    if(on){
      if(cur.at) return;
      if(cur.flow) return;
      if(ckEvLive(cur.events).length) return;
      vckSetFlow(it.id,date,it.kind,'standby'); n++;
    } else {
      if(cur.flow!=='standby') return;
      vckSetFlow(it.id,date,it.kind,''); n++;
    }
  });
  return n;
}
/* รอมากี่นาทีแล้ว · null = ยังไม่ได้กดถึง หรือดูวันอื่นที่ไม่ใช่วันนี้ */
function vckArrWait(date,gk){
  var a=vckArrGet(date,gk); if(!a||!a.at) return null;
  if(typeof ckIsToday==='function' && !ckIsToday(date)) return null;
  var m=/^(\d{1,2}):(\d{2})$/.exec(String(a.at)); if(!m) return null;
  return Math.max(0, ckNowMin() - (+m[1]*60 + +m[2]));
}
/* §vckDone · แถวที่ยังไม่จบเรื่องของคันนี้ · รอ / สแตนบาย / ตามแขก
   ขึ้นรถแล้ว · ไม่มา · ยกเลิก · ไปเจอที่ท่า = จบเรื่องแล้ว ไม่ต้องรออีก */
function vckOpenRows(rows){
  var n=0;
  (rows||[]).forEach(function(r){
    var st=vckRowSt(r&&r.ck);
    if(st==='wait'||st==='standby'||st==='pending') n++;
  });
  return n;
}
function vckArrChip(date,gk,vanName,rows){
  var e=ckEsc, a=vckArrGet(date,gk), w=vckArrWait(date,gk);
  var q='vckArrToggle(' + JSON.stringify(date) + ',' + JSON.stringify(gk) + ',' + JSON.stringify(vanName||'') + ')';
  q=q.replace(/"/g,'&quot;');
  if(!a){
    return '<button class="vck-arr" onclick="event.stopPropagation();'+q+'" '
      +'title="กดเมื่อคนขับไปถึงจุดรับแรก · ทุกแถวของคันนี้จะกลายเป็น Standby และระบบเริ่มจับเวลารอ">'
      +'&#9744; ติ๊กเมื่อคนขับสแตนบายจุดแรก</button>';
  }
  /* §vckDone · รับครบแล้วต้องหยุดนับ · ไม่งั้นปุ่มยังขึ้น "ครบ 15 นาที" สีเตือนค้างทั้งวัน
     ทั้งที่ไม่มีใครให้รออีกแล้ว · เตือนตลอดเวลา = เลิกอ่านคำเตือน */
  var open=vckOpenRows(rows);
  if(open===0){
    return '<button class="vck-arr on done" onclick="event.stopPropagation();'+q+'" '
      +'title="ทุกรายของคันนี้จบเรื่องแล้ว · บันทึกถึงจุดรับไว้ '+e(a.at)+' โดย '+e(a.by||'')
      +' · กดอีกครั้งเพื่อยกเลิก">&#9745; รับครบแล้ว<span class="sbt">'+e(a.at)+'</span></button>';
  }
  var late=(w!=null && w>=VCK_WAIT_RULE);
  var txt='&#9745; คนขับสแตนบายแล้ว<span class="sbt">'+e(a.at)
    +(w!=null?(' · รอ '+w+' น.'):'')
    +(late?(' · ครบ '+VCK_WAIT_RULE+' นาที'):'')
    +' · ค้าง '+open+' ราย</span>';
  return '<button class="vck-arr on'+(late?' late':'')+'" onclick="event.stopPropagation();'+q+'" '
    +'title="บันทึกโดย '+e(a.by||'')+' · ยังเหลืออีก '+open+' รายที่ยังไม่จบเรื่อง'
    +(late?(' · รอเกิน '+VCK_WAIT_RULE+' นาทีแล้ว กด No-show ได้'):'')
    +' · กดอีกครั้งเพื่อยกเลิก">'+txt+'</button>';
}
function vckSetFam(f){ _vckFam=(_vckFam===f)?null:f; _vckRoute=null; renderVanCheckin(); }
function vckSetRoute(r){ _vckRoute=(_vckRoute===r)?null:r; renderVanCheckin(); }
function vckPickDay(ds){ if(ds){ _vanCkDate=ds; renderVanCheckin(); } }
function _vckBooked(t){ return ckBookedPax(t); }
function _vckPaxBreak(p){ return ckPaxBreak(p); }

/* ══ §vckSheet (2026-09-02) · ตารางเช็คอินรถหน้าตาแบบตารางชีท ══════════════
   ck-tbl ใช้ร่วมกับหน้าท่า (pck-tbl) ทุก selector ที่นี่จึงต้องมี .vck-sheet คั่น
   ไม่งั้นหน้าท่าเปลี่ยนตามไปด้วยทั้งที่ไม่ได้สั่ง
   หลักคิดเรื่องสี · สีบนจอ = "มีอะไรเกิดขึ้นแล้ว" ของที่ยังไม่ได้ทำต้องซีดหมด
   ทั้งแถวข้อมูลและแถบหัวคัน · สีประจำรถโผล่ตอนชี้เมาส์ ไว้ยืนยันว่าคันไหน */
function vckSheetCSS(){
  var S='#vancheckin-host table.ck-tbl.vck-sheet';
  return ''
  /* กล่องเลื่อนของตัวเอง · การตรึงคอลัมน์ซ้ายต้องมีตัวเลื่อนของตัวเอง
     ถ้าปล่อยให้ทั้งหน้าเว็บเลื่อนแนวนอนเหมือนเดิม คอลัมน์ที่ตรึงจะไปมุดใต้เมนูซ้าย */
  +'#vancheckin-host .vck-tw{overflow:auto;max-height:calc(100vh - 232px);min-height:340px;'
    +'border-radius:13px;-webkit-overflow-scrolling:touch;contain:paint;overscroll-behavior:contain}'
  +'#vancheckin-host .ck-card.vck-card{overflow:hidden;padding:0}'
  +S+'{border-collapse:separate;border-spacing:0;min-width:1600px}'
  +S+' th,'+S+' td{border-right:1px solid #D8DCE3;border-bottom:1px solid #D8DCE3;'
    +'padding:0 7px;height:29px;white-space:nowrap;vertical-align:middle;background-clip:padding-box}'
  +S+' thead th{background:#EDF0F5;color:#3C4A63;font-weight:800;font-size:9.5px;letter-spacing:.04em;'
    +'text-align:center;border-bottom:2px solid #A9B2C2;box-shadow:none;padding:0 7px;height:32px;'
    +'overflow:hidden;text-overflow:ellipsis}'
  +S+' thead th:nth-child(4),'+S+' thead th:nth-child(10),'+S+' thead th:nth-child(13){text-align:left}'
  /* ── ตรึงสี่คอลัมน์ซ้าย · Voucher · Agency · Submitted by · ลูกค้า
        เลื่อนขวาไปดูช่องท้าย ๆ ยังรู้ว่าเป็นแถวของใคร ── */
  /* พื้นขาวทุกช่อง · ช่องที่ตรึงไว้ต้องทึบ ไม่งั้นแถวข้างหลังทะลุขึ้นมาตอนเลื่อน
     แถวที่มีสีทับด้วย tr.vst>td ที่เป็น !important อยู่แล้ว */
  +S+' tr.ck-row>td,'+S+' tr.ck-unassigned>td{background:#fff}'
  +S+' tr.ck-row>td:nth-child(-n+4),'+S+' tr.ck-unassigned>td:nth-child(-n+4),'
    +S+' thead th:nth-child(-n+4){position:sticky;z-index:12}'
  +S+' thead th:nth-child(-n+4){z-index:36}'
  /* หัวตารางกับหัวคันตรึงกับกล่องนี้ ไม่ใช่กับหน้าเว็บ · ทับค่าที่ ckSyncSticky ตั้งไว้ */
  +S+' thead th{top:0 !important}'
  +S+' tr.ck-ghd>td{top:32px !important}'
  +S+' tr.ck-row>td:nth-child(1),'+S+' tr.ck-unassigned>td:nth-child(1),'
    +S+' thead th:nth-child(1){left:0;width:144px;min-width:144px;max-width:144px;padding-left:12px}'
  +S+' tr.ck-row>td:nth-child(2),'+S+' tr.ck-unassigned>td:nth-child(2),'
    +S+' thead th:nth-child(2){left:144px;width:120px;min-width:120px;max-width:120px;padding:0}'
  +S+' tr.ck-row>td:nth-child(3),'+S+' tr.ck-unassigned>td:nth-child(3),'
    +S+' thead th:nth-child(3){left:264px;width:120px;min-width:120px;max-width:120px;'
    +'text-align:center;white-space:normal}'
  /* ชื่อ+เบอร์ ลค · ตัดเบอร์ทิ้งไม่ได้ ต้องโทรตามจากช่องนี้ · ยาวเกินก็ตกบรรทัดสอง */
  +S+' tr.ck-row>td:nth-child(4),'+S+' tr.ck-unassigned>td:nth-child(4),'
    +S+' thead th:nth-child(4){left:384px;width:252px;min-width:252px;max-width:252px;'
    +'border-right:2px solid #A9B2C2}'
  +S+' tr.ck-row>td:nth-child(4){white-space:normal;overflow:visible;line-height:1.25}'
  /* ผู้บันทึกบางรายชื่อยาว (ชื่อ+เบอร์) · ตัดทิ้งแล้วอ่านไม่รู้เรื่อง ให้ตกบรรทัดสองแทน */
  +S+' .ck-by{max-width:none;white-space:normal;line-height:1.2;font-size:10px;'
    +'max-height:24px;overflow:hidden}'
  /* ── แถวสูงเท่ากันบรรทัดเดียว · ของที่เดิมอยู่บรรทัดสอง (เบอร์โทร ยอดจอง รถขากลับ)
        ดันมาต่อท้ายบรรทัดเดียวกัน จะได้กวาดสายตาลงมาตรง ๆ ได้ ── */
  +S+' tr.ck-row>td{overflow:hidden}'
  +S+' tr.ck-row td>div{display:inline;margin:0 0 0 6px !important;font-size:9.5px;line-height:1}'
  /* ช่องเหตุการณ์หน้างาน · ป้าย No-show กับปุ่มทางกลับ เบียดกันบรรทัดเดียวไม่พอ
     ให้ป้ายอยู่บรรทัดบน ปุ่มอยู่บรรทัดล่าง แล้วย่อปุ่มให้พอดีความสูงแถว */
  +S+' tr.ck-row>td:nth-child(15){white-space:normal;overflow:visible;'
    +'width:104px;min-width:104px;max-width:104px;padding:2px 6px;line-height:1.15}'
  +S+' tr.ck-row>td:nth-child(15)>div{display:block;margin:0 !important;font-size:10px;line-height:1.15}'
  +S+' .ck-ns,'+S+' .ck-cx{font-size:9px;padding:0 5px;margin-top:0;max-width:92px;'
    +'overflow:hidden;text-overflow:ellipsis;vertical-align:top}'
  +S+' .ck-bkb{display:inline-flex !important;gap:3px;margin-top:2px !important}'
  +S+' .ck-ic{width:21px;height:21px;border-radius:6px;font-size:11px;border-width:1px}'
  +S+' .ck-try{font-size:9px;padding:0 5px}'
  +S+' .ck-bk{font-size:8.5px;color:#A8AEBB}'
  +S+' .ck-vch{max-width:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
    +'line-height:1.2;font-size:11.5px}'
  +S+' .ck-lead{max-width:none;white-space:normal;padding:1px 7px;font-size:11.5px}'
  +S+' .ck-tel{margin:0 0 0 6px;font-size:10.5px;max-width:none;white-space:nowrap;'
    +'font-weight:600;display:inline-block}'
  /* หน้ารถไม่ต้องมีอิโมจิโทรศัพท์ · ทั้งคอลัมน์เป็นเบอร์อยู่แล้ว ไม่ต้องมีไอคอนย้ำ
     ซ่อนแทนที่จะลบ เพราะ ckRowHtml ใช้ร่วมกับหน้าท่า */
  +'#vancheckin-host .ck-telic{display:none}'
  +S+' .ck-pick{max-width:300px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
    +'line-height:1.2;font-size:12.5px;font-weight:600;color:#15201a}'
  /* overflow ต้องเป็น visible ไม่งั้นแถวไม่ยอมสูงขึ้นตามบรรทัดที่สอง ตัดหายเหมือนเดิม */
  +S+' tr.ck-row>td:nth-child(13){white-space:normal;overflow:hidden;'
    +'width:158px;min-width:158px;max-width:158px}'
  +S+' thead th:nth-child(13){width:158px;min-width:158px;max-width:158px}'
  /* จำกัดสองบรรทัดด้วย max-height ไม่ใช้ -webkit-line-clamp
     line-clamp ไม่ยอมตัดจริงในตารางนี้ บรรทัดสามล้นไปทับแถวถัดไป */
  +S+' .ck-sreq{max-width:144px;max-height:26px;white-space:normal;line-height:1.25;'
    +'padding:1px 6px;font-size:10px;overflow:hidden}'
  +S+' .ck-area{font-size:10px;padding:1px 7px}'
  /* §vckAg · ช่องเอเจนซี่ต้องเป็นสีเต็มช่อง ไม่ใช่ป้ายลอยกลางช่อง
     สีเอเจนซี่คือตัวที่ใช้กวาดตาหาแถวเร็วที่สุดในตาราง เต็มช่องแล้วเห็นเป็นแถบสีต่อเนื่อง
     บังคับที่ลูกโดยตรงของ td เพราะแต่ละแบบวาดมาไม่เหมือนกัน (ป้ายสี · โลโก้ B2C · ข้อความเปล่า) */
  +S+' tr.ck-row>td:nth-child(2),'+S+' tr.ck-unassigned>td:nth-child(2){padding:0 !important}'
  /* §ckTight · ชื่อเอเจนซี่ยาว ๆ ถูกจัดกลางแล้วตัดทั้งหัวและท้าย
     เหลือ "avorn Palm Beach Reso" อ่านไม่ออกว่าเจ้าไหน หาไม่เจอด้วย
     ให้ตกบรรทัดสองแทน · ชื่อเอเจนซี่คือตัวที่ใช้ไล่หาแถวมากที่สุดในตาราง
     white-space / text-overflow ต้องมี !important · ตัวจริงเขียน nowrap ไว้ที่ style ของ tag */
  +S+' tr.ck-row>td:nth-child(2)>*,'+S+' tr.ck-unassigned>td:nth-child(2)>*{'
    +'display:flex !important;align-items:center;justify-content:center;text-align:center;'
    +'width:100% !important;max-width:none !important;min-height:29px;'
    +'margin:0 !important;padding:1px 5px !important;border-radius:0 !important;'
    +'box-shadow:none !important;border:0 !important;font-size:10px;line-height:1.12;'
    +'white-space:normal !important;text-overflow:clip !important;'
    +'word-break:break-word;overflow:hidden}'
  /* ห้ามแตะ position ของ td ช่องนี้ · เป็นคอลัมน์ตรึงที่ตั้ง left:144px ไว้
     ถ้าเปลี่ยนเป็น relative ค่า left จะกลายเป็นการเลื่อนช่องไปขวา 144px ทั้งช่อง */
  +S+' .ck-agblk{font-weight:700}'
  +S+' .ck-stp button{width:20px;height:20px;font-size:13px}'
  +S+' .ck-n{font-size:12.5px}'
  +S+' .vck-sel{padding:2px 4px;font-size:10.5px;max-width:114px;border-width:1.5px;border-radius:6px}'
  /* บันทึกหน้างาน · เหตุผลจริงยาวกว่าบรรทัดเดียวเสมอ ("ไม่มา 07:02 · อื่นๆ · เลื่อนวัน รออัปเดต")
     ตัดทิ้งแล้วเหลือแต่ต้นประโยค อ่านไม่ได้ความ · ให้สองบรรทัด จำกัดด้วย max-height */
  +S+' tr.ck-row>td:nth-child(17){white-space:normal;overflow:hidden;line-height:1.3;'
    +'width:352px;min-width:352px;max-width:352px;padding:2px 8px}'
  +S+' thead th:nth-child(17){width:352px;min-width:352px;max-width:352px}'
  +S+' .vck-nt{max-width:336px;max-height:28px;white-space:normal;overflow:hidden;'
    +'line-height:1.3;font-size:10.5px;display:inline-block;vertical-align:top}'
  +S+' .vck-rsn{display:inline !important;margin:0 0 0 5px !important}'
  +S+' .ck-rsn{font-size:9.5px;padding:1px 7px;max-width:200px;vertical-align:top}'
  +S+' .ck-gtm{font-size:10.5px;padding:2px 8px}'
  /* เวลารับ · เดิมป้ายสถานะอยู่บรรทัดสอง ทำให้แถวสูงไม่เท่ากัน · ดันมาต่อท้ายบรรทัดเดียว */
  +S+' .ck-tm{flex-direction:row;align-items:center;gap:5px;font-size:11px}'
  +S+' .ck-tm b{font-size:8.5px;padding:0 5px}'
  /* ── ตัวเลขใช้ Sarabun เหมือนตัวหนังสือ · tabular-nums หลักตรงกันทุกแถว ──
        [style*=DM Mono] กวาดของที่ฝัง font-family ไว้ใน inline style ด้วย */
  +S+' td,'+S+' th{font-variant-numeric:tabular-nums}'
  +S+' .ck-vch,'+S+' .ck-mono,'+S+' .ck-tel,'+S+' .ck-n,'+S+' .ck-bk,'
    +S+' .ck-gtm{font-family:Sarabun,sans-serif}'
  +S+' [style*="DM Mono"]{font-family:Sarabun,sans-serif !important}'
  /* ── แถบหัวคัน ── */
  +S+' tr.ck-ghd>td{height:32px;padding:0 10px 0 14px !important;box-shadow:none;'
    +'border-top:2px solid var(--vedge);border-bottom:1px solid var(--vedge);'
    +'border-left:6px solid var(--vedge)}'
  /* ช่องหัวคันกว้างเท่าตารางทั้งใบ จะตรึงตัว td เองไม่ได้ (ไม่มีที่ให้ขยับ)
     ต้องตรึงกล่องข้างในแทน เลื่อนขวาไปไกลแค่ไหนก็ยังเห็นว่ากำลังดูรถคันไหนอยู่ */
  +S+' tr.ck-ghd>td>div{gap:10px !important;flex-wrap:nowrap !important;'
    +'position:sticky;left:0;width:-moz-fit-content;width:fit-content;max-width:100%}'
  /* คันที่ยังไม่ได้ติ๊กสแตนบาย = ยังไม่ได้เริ่มทำ → ไม่มีสีเลย เทาล้วน */
  +S+' tr.ck-ghd.vck-gpale>td{background:#F7F8FA !important;color:#98A0AC}'
  +S+' tr.ck-ghd.vck-gpale>td>div{filter:grayscale(1);opacity:.7}'
  +S+' tr.ck-ghd.vck-gpale:hover>td{background:var(--vbg2) !important;border-color:var(--vc)}'
  +S+' tr.ck-ghd.vck-gpale:hover>td>div{filter:none;opacity:1}'
  /* ติ๊กแล้ว = ทั้งแถบเป็นสีสแตนบาย (พื้นมาจาก tr.ck-ghd.vck-sb ของเดิม) */
  +S+' tr.ck-ghd.vck-sb>td{color:#0F6E56}'
  /* เริ่มทำแล้ว หรือรับครบแล้ว = คืนสีประจำรถ · พื้นอ่อนของคันนั้น ขอบสีเต็ม */
  +S+' tr.ck-ghd.vck-gon>td{color:#3a3a36}'
  /* ── แถวที่ยังไม่ได้รับขึ้นรถ · ซีดทั้งแถว ชี้เมาส์แล้วกลับมาชัดเพื่อให้ทำงานต่อได้ ── */
  +S+' tr.ck-row.vck-pale>td{color:#A2AAB6}'
  +S+' tr.ck-row.vck-pale>td:first-child{box-shadow:inset 5px 0 0 #E3E6EC}'
  +S+' tr.ck-row.vck-pale .ck-agblk,'+S+' tr.ck-row.vck-pale .ck-lead{filter:grayscale(1);opacity:.45}'
  +S+' tr.ck-row.vck-pale .ck-area,'+S+' tr.ck-row.vck-pale .ck-sreq{filter:grayscale(1);opacity:.6}'
  +S+' tr.ck-row.vck-pale .ck-vch,'+S+' tr.ck-row.vck-pale .ck-by,'
    +S+' tr.ck-row.vck-pale .ck-mono{color:#A2AAB6}'
  /* ชื่อจุดรับยังต้องอ่านออกแม้แถวจะซีด · คนขับใช้ช่องนี้ตอนออกไปรับจริง */
  +S+' tr.ck-row.vck-pale .ck-pick{color:#8A93A1}'
  +S+' tr.ck-row.vck-pale .ck-tel{color:#AEBAC8}'
  +S+' tr.ck-row.vck-pale .ck-dim{color:#DCE0E6}'
  +S+' tr.ck-row.vck-pale .vck-sel{opacity:.55}'
  +S+' tr.ck-row.vck-pale .ck-stp{border-color:#E3E7ED}'
  +S+' tr.ck-row.vck-pale .ck-stp button{color:#CBD1DA}'
  +S+' tr.ck-row.vck-pale:hover>td{color:#3C4451}'
  +S+' tr.ck-row.vck-pale:hover .ck-agblk,'+S+' tr.ck-row.vck-pale:hover .ck-lead,'
    +S+' tr.ck-row.vck-pale:hover .ck-area,'+S+' tr.ck-row.vck-pale:hover .ck-sreq{filter:none;opacity:1}'
  +S+' tr.ck-row.vck-pale:hover .ck-vch,'+S+' tr.ck-row.vck-pale:hover .ck-by,'
    +S+' tr.ck-row.vck-pale:hover .ck-pick{color:#15201a}'
  +S+' tr.ck-row.vck-pale:hover .vck-sel{opacity:1}';
}
function vckFitPane(){
  if(_vckFitRaf) return;
  _vckFitRaf=requestAnimationFrame(function(){
    _vckFitRaf=0;
    var w=document.querySelector('#vancheckin-host .vck-tw'); if(!w) return;
    var h=Math.max(320,(window.innerHeight||800)-w.getBoundingClientRect().top-14);
    if(w._vh!==h){ w._vh=h; w.style.maxHeight=h+'px'; }
  });
}
function pckToggleBy(){ _pckShowBy=!_pckShowBy; try{ localStorage.setItem('pck_showby', _pckShowBy?'1':'0'); }catch(_){} renderPierCheckin(); }
function pckSetBoat(v){ _pckBoat=v||''; renderPierCheckin(); }
function pckSetVan(v){ _pckVan=v||''; renderPierCheckin(); }
function pckSetArr(v){ _pckArr=(_pckArr===v)?'':v; renderPierCheckin(); }
function pckSetStat(v){ _pckStat=(_pckStat===v)?'':v; renderPierCheckin(); }
function pckClearFilters(){ _pckBoat=_pckVan=_pckArr=_pckStat=_pckQ=''; renderPierCheckin(); }
// ค้นหาแบบพิมพ์แล้วกรองทันที · หน้าท่าลูกค้าเดินมาบอกแค่ชื่อหรือเบอร์ 4 ตัวท้าย
// re-render ทั้งหน้าแล้วคืนโฟกัส+ตำแหน่ง cursor ให้ ไม่งั้นต้องคลิกช่องใหม่ทุกตัวอักษร
function pckSetQ(v){ _pckQ=String(v||''); renderPierCheckin();
  var el=document.getElementById('pck-q'); if(el){ el.focus(); try{ el.setSelectionRange(el.value.length, el.value.length); }catch(_){} } }

/* §vckSplit · รถของบุคกิ้ง · พอแยกจุดรับ bkV2SyncAltPickupSplits จะย้ายรถไปไว้ใน
   vanSplits[i].vanId แล้ว "ลบ ops.vanId ทิ้ง" (main now lives in split[0])
   ใครยังอ่านแค่ ops.vanId จะเห็นเป็น "ยังไม่จัดรถ" ทั้งที่จัดครบแล้ว */
function ckVanIds(O){
  var out=[];
  if(O && O.vanId) out.push(O.vanId);
  if(O && Array.isArray(O.vanSplits)) O.vanSplits.forEach(function(sp){
    if(sp && sp.vanId && out.indexOf(sp.vanId)<0) out.push(sp.vanId); });
  return out;
}
/* §gvanSplit (2026-09-17) · "ทำไมถึงเป็นเดินทางเอง ทั้งๆที่มีการจัดรถ"

   ต่อจากที่ §vckSplit เตือนไว้ข้างบน · ใบที่แยกจุดรับ รถย้ายไปอยู่ใน vanSplits
   แล้ว ops.vanId ถูกลบทิ้ง · pckArrivalOf แก้ให้อ่าน ckVanIds แล้ว จึงรู้ว่า "มีรถ"
   และจัดโซนเป็น PK/KL ถูกต้อง · แต่ตอน "จัดกลุ่มตามคัน" ทุกที่ยังเขียน r.vanId||'__own'
   ใบพวกนี้เลยตกไปอยู่ถังเดียวกับคนที่มาเอง · ไกด์อ่านได้ว่า
   "ไม่มีรถของเรา — เช็คว่ามาถึงท่าหรือยัง" ทั้งที่รถกำลังไปรับอยู่

   วัดจากข้อมูลจริง · ใบที่มี vanSplits 6 ใบ · ops.vanId ว่างทั้ง 6 ใบ
   และทั้ง 6 ใบแยกข้ามรถมากกว่าหนึ่งคัน · จึงต้องมีป้ายบอกด้วย ไม่ใช่แค่ย้ายถัง */
function ckGroupVanId(r){
  if(r && r.vanId) return r.vanId;
  try{ var ids=ckVanIds(r&&r.O); return ids.length?ids[0]:''; }catch(_){ return ''; }
}
/* ใบเดียวแยกขึ้นหลายคัน · ใบงานไกด์เป็นใบต่อ "ลำเรือ" รถทุกคันอยู่ในใบเดียวกัน
   จับไว้ใต้คันแรกแล้วบอกให้ครบว่าอีกคันไหนบ้าง ไกด์จึงยังเห็นครบ
   (ฝั่งคนขับใช้ใบงานรถ ซึ่งแตกแถวตาม vanSplits ถูกอยู่แล้ว) */
function ckVanSplitNote(O){
  try{
    var ids=ckVanIds(O); if(ids.length<2) return '';
    return 'แยกขึ้นรถ '+ids.length+' คัน · '+ids.map(function(v){
      return (typeof pckVanName==='function')?pckVanName(v):v; }).join(' · ');
  }catch(_){ return ''; }
}
/* §gvanHead (2026-09-17) · "ที่ว่ารถสองคัน เพิ่มในหัวด้วยเลยได้ไหม"
   ป้ายในช่อง Note บอกเป็นรายใบ · แต่คนอ่านหัวกลุ่มรถก่อนเสมอ
   ยืนอยู่ที่ Love6 สิ่งที่อยากรู้คือ "กลุ่มนี้มีใครไปคันอื่นด้วยไหม · คันไหน"
   จึงสรุปที่หัวกลุ่ม · นับใบ แล้วบอกชื่อ "คันอื่น" ไม่ต้องพูดชื่อคันที่ยืนอยู่ซ้ำ */
function ckVanGroupSplit(rows, vanId){
  var out={n:0, others:[]};
  try{
    var seen={};
    (rows||[]).forEach(function(r){
      var ids=(typeof ckVanIds==='function')?ckVanIds(r&&r.O):[];
      if(ids.length<2) return;
      out.n++;
      ids.forEach(function(v){ if(v && v!==vanId && !seen[v]){ seen[v]=1; out.others.push(v); } });
    });
  }catch(_){}
  return out;
}
/* §gvanHead3 (2026-09-17) · "อยากให้ขึ้น Love6 ทะเบียน ... / Love9 ทะเบียน 36-0024 · ต่อ · 098-448-4983"
   ของเดิมบอกแค่ชื่อคันที่สอง · ไกด์ที่ถือกระดาษอยู่ที่ท่า ถ้าคนอีกครึ่งยังไม่มา
   สิ่งที่ต้องใช้คือ "เบอร์คนขับคันนั้น" ไม่ใช่ชื่อรถ · พิมพ์ให้ครบชุดเดียวกับคันหลัก
   หนึ่งฟังก์ชันสำหรับทุกคัน คันหลักกับคันร่วมจะได้หน้าตาเหมือนกันเป๊ะ ไม่หลุดกันทีหลัง */
function pckVanHeadHtml(vid, date){
  var e=ckEsc;
  var veh=(typeof vehGet==='function'?vehGet(vid):null)||{};
  var rd=(typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(vid,date)
        :{driver:'',phone:'',plate:veh.plate||''};
  return '<span class="gvan">'+e(veh.name||pckVanName(vid)||vid)+'</span> <span class="gmeta">'
    +(rd.plate?('ทะเบียน <b>'+e(rd.plate)+'</b>'):'')
    +(rd.driver?(' &middot; '+e(rd.driver)):'')
    +(rd.phone?(' &middot; <b>'+e(rd.phone)+'</b>'):'')+'</span>';
}
// ลูกค้ามาถึงท่าได้ยังไง · PK/KL = รถเรารับ · OWN = มาเอง/รถเอเย่นต์ · NOVAN = อยู่ในโซนรับแต่ยังไม่จัดรถ
function pckArrivalOf(r){
  var b=r.b, t=r.t;
  var z=(typeof bkV2EffZone==='function')?bkV2EffZone(b,t):((t&&t.zone)||b.pickupZone||'');
  if(b.pickupSelf || z==='NoTransfer' || z==='NT' || !z) return 'OWN';
  var has=r.vanId || (r.vanIds&&r.vanIds.length) || ckVanIds(r.O).length;
  return has ? (z==='KL'?'KL':'PK') : 'NOVAN';
}
// เงินที่เกี่ยวกับหน้าท่า · อ่านจากของที่มีอยู่แล้ว ไม่ได้สร้าง field ใหม่
//   ต้องเก็บ  = Cash on Tour ที่ระบุตอน New Booking + upgrade ที่ยังไม่ได้เก็บ + ยอดค้างของ B2C
//   เก็บแล้ว = extra ที่รับเงินแล้ว (SB_EXTRAS · เงินสด/โอน/บัตร) + upgrade ที่ติ๊กว่าเก็บแล้ว
//   §exCot · extra ที่เลือก "เก็บวันเดินทาง" ยังไม่ได้รับเงิน → ไปอยู่ฝั่งต้องเก็บ ไม่ใช่ฝั่งเก็บแล้ว
//   §extraPay · ค่าธรรมเนียมบัตรของ extra ไม่ถูกนับเป็นรายได้ (เก็บไว้ที่ x.fee เฉยๆ) กติกาเดียวกับ pierFee
// ยังเป็นแค่การ "แสดงผล" · ยังไม่เขียนลงบัญชี — รอตัดสินใจว่าจะลง SB_PAYMENTS ด้วยไหม
function pckMoney(b, date){
  // §ovnSettled · ขากลับค้างคืน · เงินระดับบุ๊กกิ้งจบไปตั้งแต่วันขาไป
  //   COT / ยอดค้าง / อัปเกรด เป็นก้อนเดียวของทั้งใบ ไม่ใช่ของรายวัน
  //   ปล่อยไว้ = ยอดเดิมโผล่ซ้ำในวันรับกลับ แล้วหน้าท่าไล่เก็บซ้ำจากคนที่จ่ายไปแล้ว
  var _t=(typeof ckTripOn==='function')?ckTripOn(b,date):null;
  var _ovnBack=!!(_t && typeof bkIsOvnReturn==='function' && bkIsOvnReturn(_t));
  var cot=(!_ovnBack && b.cashOnTour && +b.cashOnTour.amount>0) ? +b.cashOnTour.amount : 0;
  // §extraDay · ของที่ขายวันอื่นไม่ใช่ของวันนี้ · กติกาเดียวกับ tsSaleList / tsAddonList
  //   (ไม่มี tripDate = ข้อมูลเก่า ให้ขึ้นเหมือนเดิม)
  var ex=((typeof bkV2ExtrasFor==='function')?bkV2ExtrasFor(b.id):[]).filter(function(x){
    return !(date && x.tripDate && x.tripDate!==date);
  });
  var exGot=0, exDue=0;
  ex.forEach(function(x){ var v=+x.total||0; if(bkxExGot(x)) exGot+=v; else exDue+=v; });
  var exTot=exGot+exDue;
  var ups=(!_ovnBack && Array.isArray(b.upgrades))?b.upgrades:[];
  var upDue=0, upGot=0;
  ups.forEach(function(u){ var v=+u.sellPrice||0; if(u.collected) upGot+=v; else upDue+=v; });
  var bal=(!_ovnBack && b.paymentSnapshot && +b.paymentSnapshot.balance>0) ? +b.paymentSnapshot.balance : 0;
  var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  // §pierPay · เงินที่เก็บหน้าท่าไปแล้ว (bk.pierPayments) หักออกจากยอดค้างทันที
  // fee ไม่เข้า got เพราะไม่ใช่รายได้เรา — เป็นเงินที่ส่งต่อธนาคาร (ดูคอมเมนต์ §pierPay)
  var pierPaid=(typeof pckPaidSum==='function')?pckPaidSum(b,date):0;
  var pierFee =(typeof pckFeeSum==='function') ?pckFeeSum(b,date) :0;
  var gross=pckN(cot+upDue+bal+exDue);
  return { cot:cot, cur:(b.cashOnTour&&b.cashOnTour.currency)||'THB', handling:(b.cashOnTour&&b.cashOnTour.handling)||'',
           note:(b.cashOnTour&&b.cashOnTour.note)||'', extras:ex, extrasTot:exTot,
           exGot:exGot, exDue:exDue, upgrades:ups, upDue:upDue, upGot:upGot,
           balance:bal, gross:gross, pierPaid:pierPaid, pierFee:pierFee, ovnSettled:_ovnBack,
           noSlip:(typeof pckNoSlip==='function')?pckNoSlip(b,date):0,
           due:Math.max(0, pckN(gross-pierPaid)), got:pckN(exGot+upGot+pierPaid), payType:(ag&&ag.payType)||'' };
}
function pckMoneyCell(b, date, sheet){
  var e=ckEsc, M=pckMoney(b,date);
  var m=function(n){ return '฿'+pckNum(n); };
  var out='';
  // §payChips (2026-08-02) · เงื่อนไขการชำระเงินอ่านจากป้ายชุดเดียวกับหน้า By-trip
  //   Invoice / Pro Forma / COT / Paid — หน้าท่าเคยเห็นแค่ "ยอดที่ต้องเก็บ" ซึ่งไม่บอกว่าใบนี้เป็นเครดิต
  //   หรือจ่ายมาแล้ว คนหน้าท่าเลยต้องเปิดอีกหน้าไปเช็ค · ป้ายกดได้ ไปหน้าจัดการชำระเงินชุดเดียวกัน
  try{
    var _chips='';
    if(typeof bkV2PayChip==='function') _chips+=bkV2PayChip(b);
    if(!M.ovnSettled && typeof bkV2CotChip==='function'){ var _c=bkV2CotChip(b,''); if(_c&&_c.chip) _chips+=_c.chip; }
    if(_chips) out+='<div class="pck-paychips">'+_chips+'</div>';
  }catch(_){}
  var parts=[];
  if(M.due>0){
    if(M.cot>0) parts.push('COT '+m(M.cot));
    if(M.balance>0) parts.push('ค้าง '+m(M.balance));
    if(M.upDue>0) parts.push('upgrade '+m(M.upDue));
    if(M.pierPaid>0) parts.push('เก็บแล้ว '+m(M.pierPaid));
  }
  /* §pckSheet3 · โหมดตาราง · ของเดิมเห็นแค่ตัวเลขกับป้าย Invoice ต้องเดาเองว่าต้องเก็บหรือไม่ต้องเก็บ
     บรรทัดบนจึงตอบคำถามเดียว "ต้องเก็บเงินใบนี้ไหม" · เหลือง=ต้องเก็บ เขียว=เก็บแล้ว เทา=ไม่ต้องเก็บ
     รายละเอียดที่เหลือ (ที่มาของยอด · ค่าธรรมเนียม · แบ่งจ่าย · รอสลิป · ปุ่มเก็บเงิน) ยังอยู่ครบข้างล่าง */
  if(sheet){
    var _v;
    if(M.due>0) _v='<span class="pcs-pay due" title="'+e(parts.join(' · ')+(M.note?(' · '+M.note):''))+'">เก็บที่ท่า <b>'+m(M.due)+'</b></span>';
    else if(M.pierPaid>0) _v='<span class="pcs-pay ok">&#10003; เก็บครบ <b>'+m(M.pierPaid)+'</b></span>';
    else if(M.payType==='cot') _v='<span class="pcs-pay warn">COT &middot; ยังไม่ระบุยอด</span>';
    else if(M.ovnSettled) _v='<span class="pcs-pay ok">&#10003; ชำระแล้ววันขาไป</span>';
    /* §pckTrim · ช่องว่าง = ไม่มีอะไรต้องเก็บ · ป้าย "ไม่ต้องเก็บ" อยู่แทบทุกแถว
       ของที่ขึ้นทุกแถวเท่ากันหมดไม่ได้บอกอะไร มีแต่ทำให้ป้ายที่ต้องรีบเห็นจมหาย */
    else _v='';
    out=_v+out+(parts.length?('<div class="pcs-payp">'+e(parts.join(' · '))+'</div>'):'');
  }
  else if(M.due>0){
    out+='<div title="'+e(parts.join(' · ')+(M.note?(' · '+M.note):''))+'" style="display:inline-block;background:#FBF0DD;color:#7A4A00;border:1px solid #EAD9B0;border-radius:7px;padding:3px 9px;font-weight:800;font-family:\'DM Mono\',monospace;font-size:12.5px;white-space:nowrap">'+m(M.due)+'</div>'
       +'<div style="font-size:9px;color:#a08a5f;margin-top:2px;white-space:nowrap">'+e(parts.join(' · '))+'</div>';
  } else if(M.pierPaid>0){
    out+='<span style="font-size:10px;font-weight:800;color:#0F6E56;background:#DCF4E8;border-radius:6px;padding:2px 8px;white-space:nowrap">&#10003; เก็บครบ '+m(M.pierPaid)+'</span>';
  } else if(M.payType==='cot'){
    out+='<span style="font-size:10px;color:#a5a49d">COT · ยังไม่ระบุยอด</span>';
  } else if(M.ovnSettled){
    // §ovnSettled · ช่องว่างเปล่าอ่านได้สองแบบ "ไม่มีอะไรต้องเก็บ" กับ "ลืมใส่" · บอกไปเลยว่าอันไหน
    var _od=(typeof _ovnOutDate==='function')?_ovnOutDate(b,date):'';
    out+='<span style="font-size:10px;color:#a5a49d" title="เงินของใบนี้จบไปแล้วในวันขาไป · ขากลับไม่มีอะไรต้องเก็บ">'
      +'&#10003; ชำระแล้ววันขาไป'+(_od?(' &middot; '+e((typeof ovnDayTh==='function')?ovnDayTh(_od):_od)):'')+'</span>';
  }
  // §payChips · เดิมปิดท้ายด้วยป้าย "เครดิต ไม่เก็บ" · ตัดออกแล้ว เพราะป้ายเงื่อนไขด้านบน
  //   (Invoice / Pro Forma / Paid / FOC) บอกละเอียดกว่าและตรงกับหน้า By-trip ป้ายเดิมเหมารวมทุกกรณีเป็นก้อนเดียว
  out+=pckFeeLine(b,date);
  if(M.pierPaid>0){
    // §paySplitCell · รวมตามวิธี ไม่ใช่ไล่ทีละรายการ · แบ่งจ่ายทีเดียวเวลาซ้ำกันทุกบรรทัด
    var _by={}, _ord=[];
    pckPaysFor(b,date).forEach(function(p){ var k=p.method||'cash';
      if(_by[k]==null){ _by[k]=0; _ord.push(k); } _by[k]+=(+p.amount||0); });
    var ms=_ord.map(function(k){ return pckMLabel(k)+' '+m(_by[k]); });
    out+='<div style="font-size:9px;color:#a5a49d;margin-top:2px;white-space:nowrap">'
      +(_ord.length>1?'<b style="color:#5B289A">แบ่งจ่าย '+_ord.length+' วิธี</b> &middot; ':'')
      +e(ms.join(' · '))+'</div>';
  }
  if(M.noSlip>0) out+='<div style="margin-top:4px"><span class="pckp-wait">&#9888; รอสลิป '+M.noSlip+'</span></div>';
  if(M.got>0 && M.pierPaid<M.got) out+='<div style="font-size:9.5px;color:#0F6E56;font-weight:700;margin-top:3px;white-space:nowrap">&#10003; เก็บหน้างาน '+m(M.got-M.pierPaid)+'</div>';
  // ปุ่มเดียวทำสองหน้าที่ · ยังค้าง = เก็บเงิน · เก็บครบแล้วแต่ขาดสลิป = แนบสลิป
  if(M.due>0 || M.noSlip>0 || M.pierPaid>0){
    var lbl=(M.due>0)?'เก็บเงิน':(M.noSlip>0?'แนบสลิป':'ดูรายการ');
    var hot=(M.due>0||M.noSlip>0);
    out+='<div style="margin-top:5px"><button onclick="event.stopPropagation();pckPayOpen(\''+b.id+'\')" style="border:1px solid '+(hot?'#EAD9B0':'#D8D4CA')+';background:'+(hot?'#FBF0DD':'#fff')+';color:'+(hot?'#7A4A00':'#4a4a45')+';border-radius:999px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">'+lbl+'</button></div>';
  }
  return out;
}

// ══ §pierPay (2026-07-30) · เก็บเงินหน้าท่า ══
// เก็บที่ bk.pierPayments[] เท่านั้น · ยังไม่แตะ SB_PAYMENTS — เงินหน้าท่าเป็นคนละก้อนกับบิลเครดิตของ agent
// และต้องผ่านการกระทบยอดตอนปิดวันก่อนถึงจะเข้าบัญชี (ตกลงกันไว้ 30 ก.ค. 2026)
//   { id, date, amount, method:'cash'|'transfer'|'card', fee, feePct, note, slips:[{id,name,mime,size}], by, at }
// ค่าธรรมเนียมบัตร (fee) แยกจาก amount เสมอ · amount = ยอดที่ตัดหนี้ booking (รายได้เรา)
// fee = เงินที่ลูกค้าจ่ายเพิ่มแล้วส่งต่อธนาคาร (ไม่ใช่รายได้) · amount+fee = ยอดที่ขึ้นบนเครื่อง EDC
// ซึ่งเป็นตัวเดียวที่จะตรงกับ statement — ถ้ารวมสองก้อนเป็นก้อนเดียว หนี้ booking จะเกินและรายได้จะพอง
function pckPaysFor(b, date){
  var arr=(b && Array.isArray(b.pierPayments)) ? b.pierPayments : [];
  return date ? arr.filter(function(p){ return p && p.date===date; }) : arr.slice();
}
function pckPaidSum(b,date){ return pckN(pckPaysFor(b,date).reduce(function(s,p){ return s+(+p.amount||0); },0)); }
function pckFeeSum(b,date){  return pckN(pckPaysFor(b,date).reduce(function(s,p){ return s+(+p.fee||0); },0)); }
function pckFeeBase(b,date){ return pckN(pckPaysFor(b,date).filter(function(p){ return (+p.fee||0)>0; }).reduce(function(s,p){ return s+(+p.amount||0); },0)); }
// เงินสดตรวจได้จากลิ้นชัก · โอน/บัตรถ้าไม่มีสลิปจะกระทบยอดกับ statement ไม่ได้ → ต้องตามให้ครบก่อนปิดวัน
function pckNoSlip(b,date){ return pckPaysFor(b,date).filter(function(p){ return p.method!=='cash' && !(Array.isArray(p.slips)&&p.slips.length); }).length; }
// §pierDecimal (2026-08-27) · ยอดเงิน/ค่าธรรมเนียมเก็บเป็นทศนิยมได้
//   เครื่อง EDC คิด % แล้วออกมาเป็นเศษสตางค์ (750 x 5% = 37.50) · ปัดเป็นบาทเต็มทำให้ยอดที่บันทึกไม่ตรง statement
//   pckN = ปัด 2 ตำแหน่งทุกจุดที่คำนวณ กัน float noise ไม่ให้ยอดค้างเหลือ 0.0000001
function pckN(n){ var v=(+n||0)*100; return Math.round(v+(v<0?-1e-9:1e-9))/100; }
function pckNum(n){ var v=pckN(n); return v.toLocaleString('en-US',{minimumFractionDigits:(v%1?2:0),maximumFractionDigits:2}); }
function pckB(n){ return '&#3647;'+pckNum(n); }
function pckMLabel(m){ return m==='cash'?'เงินสด':m==='transfer'?'โอนเงิน':m==='card'?'บัตรเครดิต':m||'—'; }
function pckHHMMloc(iso){ return pckHHMM(iso); }   // §localTime · ใช้ helper ตัวเดียวกันทั้งหน้า

function pckFeeLine(b, date){
  var f=pckFeeSum(b,date); if(f<=0) return '';
  var base=pckFeeBase(b,date), pcts=[];
  pckPaysFor(b,date).forEach(function(p){ if(p.feePct && pcts.indexOf(p.feePct)<0) pcts.push(p.feePct); });
  return '<div class="pckp-feeline">+ ค่าธรรมเนียมบัตร <b>'+pckB(f)+'</b>'+(pcts.length?(' ('+pcts.join('/')+'%)'):'')
    +'<div class="pckp-feeswipe">รูดจริง '+pckB(base+f)+'</div></div>';
}

// ── อัปโหลดสลิป · ใช้ /api/attach ตัวเดียวกับสลิปฝั่งบัญชี (รับทุก mime · ย่อรูปก่อนส่ง) ──
function pckSlipUpload(file, bkId, cb){
  if(!file || !bkId) return;
  var post=function(blob, mime, name){
    if(blob && blob.size > 6*1024*1024){ alert('ไฟล์ "'+name+'" ใหญ่เกิน 6MB · ย่อ/บีบอัดก่อน'); return; }
    var fr=new FileReader();
    fr.onload=function(){
      var b64=String(fr.result).split(',')[1]||'';
      fetch('/api/attach',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({bookingId:bkId, filename:name, mime:mime, dataB64:b64})})
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(j&&j.error){ alert('อัปโหลดไม่สำเร็จ: '+j.error); return; }
          var meta={ id:j.id, name:j.filename, mime:j.mime, size:j.size };
          // ลงทะเบียนไว้ที่ b.paymentSlips ด้วย เพื่อให้หน้าดูสลิปเดิม (pfmSlipsRender) เห็นไฟล์นี้เหมือนกัน
          var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; });
          if(b){ b.paymentSlips=Array.isArray(b.paymentSlips)?b.paymentSlips:[];
                 b.paymentSlips.push({id:meta.id,name:meta.name,mime:meta.mime,size:meta.size,kind:'pier',amount:0,
                                      at:new Date().toISOString(), by:(typeof laBy==='function'?laBy():'')}); }
          cb(meta);
        })
        .catch(function(err){ alert('อัปโหลดไม่สำเร็จ: '+err.message); });
    };
    fr.readAsDataURL(blob);
  };
  if(/^image\//.test(file.type||'')){
    var dn=(typeof _bkV2DownscaleImage==='function')?_bkV2DownscaleImage:function(f,m,c){ c(f,f.type); };
    dn(file, 1600, function(bl,mi){ if(bl) post(bl, mi, ((file.name||'slip').replace(/\.[^.]+$/,''))+'.jpg'); else post(file, file.type, file.name||'slip'); });
  } else post(file, file.type||'application/octet-stream', file.name||'file');
}
function pckPayGuard(bkId, date){
  var k=date+'::'+bkId;
  if(_pckPaySkip[k]){ delete _pckPaySkip[k]; return false; }
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return false;
  var M=pckMoney(b,date); if(!(M.due>0)) return false;
  pckPayWarn(bkId, date); return true;
}
function pckPaySkipOn(bkId, date){ _pckPaySkip[date+'::'+bkId]=1; acctModalClose(); ckToggle(bkId, date, 'pier'); }
function pckPayWarn(bkId, date){
  var e=ckEsc, b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var M=pckMoney(b,date), rows=[];
  if(M.cot>0)     rows.push(['Cash on Tour (ระบุตอนจอง)', M.cot]);
  if(M.balance>0) rows.push(['ยอดค้างจาก B2C', M.balance]);
  if(M.upDue>0)   rows.push(['Upgrade หน้างาน ยังไม่เก็บ', M.upDue]);
  if(M.pierPaid>0)rows.push(['เก็บไปแล้วหน้าท่า', -M.pierPaid]);
  acctModal(''
   +'<div class="pckp-hd"><div><div class="pckp-tt">ยังเก็บเงินไม่ครบ</div>'
   +'<div class="pckp-sub">'+e(b.voucherRef||b.code||b.id)+' · '+e(b.leadPax||'')+'</div></div>'
   +'<button class="pckp-x" onclick="acctModalClose()">&#10005;</button></div>'
   +'<div class="pckp-bd">'
   +'<div class="pckp-warn"><span class="ic">&#9888;</span><div><div class="t">มีรายการค้างเก็บเงิน '+pckB(M.due)+'</div>'
   +'<div class="s">กำลังจะเช็คอินขึ้นเรือ แต่ยอดนี้ยังไม่ได้เก็บ<br>ถ้าปล่อยขึ้นเรือไปก่อน กด “ขึ้นเรือก่อน” — ระบบจะคงยอดค้างไว้ให้ตามเก็บทีหลัง</div></div></div>'
   +'<div class="pckp-brk">'
   + rows.map(function(r){ return '<div class="r"><span class="k">'+e(r[0])+'</span><span class="v">'+(r[1]<0?('&minus; '+pckB(-r[1])):pckB(r[1]))+'</span></div>'; }).join('')
   +'<div class="r tot"><span class="k">ต้องเก็บ</span><span class="v">'+pckB(M.due)+'</span></div></div>'
   +'</div>'
   +'<div class="pckp-ft">'
   +'<button class="pckp-btn" onclick="pckPaySkipOn(\''+bkId+'\',\''+date+'\')">ขึ้นเรือก่อน · ยังไม่เก็บ</button>'
   +'<button class="pckp-btn pri" onclick="pckPayOpen(\''+bkId+'\',1)">เก็บเงินเลย</button>'
   +'</div>');
}
// §autoCheckIn (2026-08-02) · เปิดกล่องนี้จากการกดเช็คอิน = ตั้งใจจะขึ้นเรืออยู่แล้ว
//   เดิมพอเก็บเงินครบ กล่องปิดแล้วต้องกลับไปกดเช็คอินอีกรอบ ทั้งที่ไม่มีทางเลือกอื่นให้กด
//   thenCk จำไว้ว่ามาจากทางไหน · เก็บครบเมื่อไรก็เช็คอินต่อให้เลย · เปิดจากปุ่ม "เก็บเงิน" ในคอลัมน์เงินไม่เช็คอินให้
// §paySplit · หนึ่งบรรทัด = หนึ่งวิธีรับเงิน · บันทึกแล้วกลายเป็น pierPayments หนึ่งรายการ
function pckLineNew(amt){
  return { k:'l'+Math.random().toString(36).slice(2,8), m:'cash', amt:Math.max(0,pckN(amt)),
           feeMode:'pct', feePct:3, fee:0, note:'', slips:[] };
}
function pckPayOpen(bkId, thenCk){
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var M=pckMoney(b,_pckDate);
  _pckPay={ bkId:bkId, date:_pckDate, lines:[pckLineNew(M.due||0)], thenCk:!!thenCk };
  pckPayRender();
}
function pckPayDue(){                      // ยอดค้างของใบนี้ (ยังไม่หักบรรทัดที่กำลังกรอก)
  if(!_pckPay) return 0;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_pckPay.bkId; }); if(!b) return 0;
  return pckN(pckMoney(b,_pckPay.date).due||0);
}
function pckPayTotal(){ return pckN((_pckPay?_pckPay.lines:[]).reduce(function(s,L){ return s+pckN(L.amt); },0)); }
function pckPayLeft(){ return pckN(pckPayDue()-pckPayTotal()); }
function pckLineAt(i){ return (_pckPay && _pckPay.lines[i])||null; }
function pckLineAdd(){
  if(!_pckPay) return;
  _pckPay.lines.push(pckLineNew(Math.max(0, pckPayLeft())));   // เริ่มที่ยอดที่ยังเหลือ ไม่ต้องคิดเลขเอง
  pckPayRender();
}
function pckLineDel(i){
  if(!_pckPay || _pckPay.lines.length<=1) return;
  _pckPay.lines.splice(i,1); pckPayRender();
}
function pckLineSet(i,k,v){ var L=pckLineAt(i); if(!L) return; L[k]=v; pckPayRender(); }
// §pierDecimal · ช่องเงินเป็น type=text เพราะ type=number จะทิ้งจุดที่ยังพิมพ์ไม่จบ ('750.') ตอน render ใหม่
//   เก็บสิ่งที่พิมพ์ไว้ตามจริง (กรองเหลือตัวเลข+จุดเดียว) แล้วค่อยแปลงเป็นตัวเลขด้วย pckN ตอนคิดเงิน
function pckNumStr(v){
  var s=String(v==null?'':v).replace(/[^0-9.]/g,'');
  var i=s.indexOf('.');
  if(i>=0) s=s.slice(0,i+1)+s.slice(i+1).replace(/\./g,'').slice(0,2);   // จุดเดียว · สตางค์พอ 2 ตำแหน่ง
  return s;
}
function pckLineNum(i,k,v){ var L=pckLineAt(i); if(!L) return; L[k]=pckNumStr(v); pckPayRender(); }
function pckLineSetM(i,m){ var L=pckLineAt(i); if(!L) return; L.m=m; if(m!=='card') L.fee=0; pckPayRender(); }
// เติมยอดให้บรรทัดนี้ · 'rest' = ที่เหลือทั้งหมด · 'half' = ครึ่งหนึ่งของยอดค้าง (ทศนิยม 2 ตำแหน่ง)
function pckLineFill(i, how){
  var L=pckLineAt(i); if(!L) return;
  var other=pckN(pckPayTotal()-pckN(L.amt)), due=pckPayDue();
  L.amt = (how==='half') ? Math.max(0, pckN(due/2)) : Math.max(0, pckN(due-other));
  pckPayRender();
}
// ค่าธรรมเนียมบัตร · คิดต่อบรรทัด · กรอกเป็นบาทตรง ๆ หรือกรอก % แล้วให้ระบบคูณให้ (ปัดเป็นบาทเต็ม)
function pckLineFee(L){
  if(!L || L.m!=='card') return 0;
  return L.feeMode==='pct' ? pckN((+L.amt||0)*(+L.feePct||0)/100) : pckN(L.fee);
}
function pckPayFeeTotal(){ return pckN((_pckPay?_pckPay.lines:[]).reduce(function(s,L){ return s+pckLineFee(L); },0)); }
function pckPayPickSlip(i, inp){
  var f=(inp&&inp.files&&inp.files[0])||null; if(inp) inp.value='';
  if(!f||!_pckPay) return;
  pckSlipUpload(f, _pckPay.bkId, function(meta){
    var L=pckLineAt(i); if(L) L.slips.push(meta);
    try{ acctPersistBookings(); }catch(_){} pckPayRender(); });
}
function pckPayRmSlip(i,j){ var L=pckLineAt(i); if(!L) return; L.slips.splice(j,1); pckPayRender(); }
// แนบสลิปย้อนหลังให้รายการที่บันทึกไปแล้ว (หน้าท่าเร่ง ถ่ายไม่ทันก็บันทึกก่อนได้)
function pckPayAddSlip(payId, inp){
  var f=(inp&&inp.files&&inp.files[0])||null; if(inp) inp.value='';
  if(!f||!_pckPay) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_pckPay.bkId; }); if(!b) return;
  pckSlipUpload(f, b.id, function(meta){
    var p=(b.pierPayments||[]).find(function(x){ return x.id===payId; });
    if(p){ p.slips=Array.isArray(p.slips)?p.slips:[]; p.slips.push(meta); }
    try{ acctPersistBookings(); }catch(_){}
    pckPayRender(); if(typeof renderPierCheckin==='function') renderPierCheckin();
  });
}
function pckPaySave(){
  if(!_pckPay) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_pckPay.bkId; }); if(!b) return;
  // §paySplit · บรรทัดยอด 0 ทิ้งไปเงียบ ๆ · กด "เพิ่มวิธีจ่าย" แล้วไม่ได้ใช้ ไม่ควรกลายเป็นรายการ ฿0 ในประวัติ
  var use=_pckPay.lines.filter(function(L){ return pckN(L.amt)>0; });
  if(!use.length){ alert('ใส่จำนวนเงินก่อน'); return; }
  var total=pckN(use.reduce(function(s,L){ return s+pckN(L.amt); },0));
  var due=pckPayDue();
  if(total>due && !confirm('ยอดที่รับ '+ (' ฿'+pckNum(total)) +' มากกว่ายอดค้าง'+(' ฿'+pckNum(due))
      +'\n\nบันทึกต่อไหม?')) return;
  b.pierPayments=Array.isArray(b.pierPayments)?b.pierPayments:[];
  var stamp=new Date().toISOString(), who=(typeof ckMe==='function'?ckMe():''), parts=[], feeAll=0;
  use.forEach(function(L){
    var amt=pckN(L.amt), fee=pckLineFee(L); feeAll=pckN(feeAll+fee);
    b.pierPayments.push({
      id:(typeof LA_UID==='function'?LA_UID('pp_'):('pp_'+Date.now()+'_'+Math.random().toString(36).slice(2,6))),
      date:_pckPay.date, amount:amt, method:L.m, fee:fee,
      feePct:(L.m==='card' && L.feeMode==='pct') ? (+L.feePct||0) : null,
      note:String(L.note||''), slips:L.slips.slice(),
      by:who, at:stamp
    });
    parts.push(pckMLabel(L.m)+' ฿'+pckNum(amt)+(fee>0?(' +ธรรมเนียม ฿'+pckNum(fee)):''));
  });
  try{ acctPersistBookings(); }catch(_){}
  if(typeof bkV2AddHistory==='function')
    bkV2AddHistory(b,'payment','เก็บเงินหน้าท่า ฿'+pckNum(total)
      +(use.length>1?(' · แบ่งจ่าย '+use.length+' วิธี ('+parts.join(' · ')+')')
                    :(' ('+pckMLabel(use[0].m)+')'+(feeAll>0?(' + ค่าธรรมเนียม ฿'+pckNum(feeAll)):''))),'Pier');
  _pckPay.lines=[pckLineNew(0)];
  var _thenCk=!!_pckPay.thenCk, _bkId=_pckPay.bkId, _dt=_pckPay.date;
  var M=pckMoney(b,_dt);
  // §paySplit · ยังค้างอยู่ = ตั้งยอดคงเหลือให้เลย · เดิมรีเซ็ตเป็น 0 แล้วต้องพิมพ์เองใหม่ทุกครั้ง
  if(M.due>0){ _pckPay.lines=[pckLineNew(M.due)]; pckPayRender();
    if(typeof renderPierCheckin==='function') renderPierCheckin(); return; }
  acctModalClose();
  // §autoCheckIn · เก็บครบแล้วและมาจากปุ่มเช็คอิน → เช็คอินต่อให้เลย ไม่ต้องกลับไปกดซ้ำ
  //   ตั้ง skip ก่อนเรียก เพราะ guard อ่านยอดใหม่อยู่แล้วก็จริง แต่กันไว้ให้แน่ว่าไม่เด้งกล่องซ้ำ
  var _ck=ckRead(b,_dt,'pier')||{};
  if(_thenCk && !_ck.at){
    _pckPaySkip[_dt+'::'+_bkId]=1;
    ckToggle(_bkId,_dt,'pier');
    return;
  }
  if(typeof renderPierCheckin==='function') renderPierCheckin();
}
function pckPayDel(payId){
  if(!_pckPay) return;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_pckPay.bkId; }); if(!b) return;
  if(!confirm('ลบรายการรับเงินนี้?')) return;
  b.pierPayments=(b.pierPayments||[]).filter(function(p){ return p.id!==payId; });
  try{ acctPersistBookings(); }catch(_){}
  pckPayRender(); if(typeof renderPierCheckin==='function') renderPierCheckin();
}
// §pierDecimal · acctModal เขียนทับ innerHTML ทั้งกล่อง → ช่องที่โฟกัสอยู่ถูกทิ้งทุก keystroke
//   จำ data-pck + ตำแหน่ง caret ไว้ก่อน แล้วคืนให้หลังวาดใหม่ ไม่งั้นพิมพ์ทศนิยมไม่ได้
function pckPayRefocus(key, pos){
  if(!key) return;
  var el=document.querySelector('#acct-modal [data-pck="'+key+'"]'); if(!el) return;
  try{ el.focus(); if(pos!=null) el.setSelectionRange(pos,pos); }catch(_){}
}
function pckPayRender(){
  if(!_pckPay) return;
  var _ae=document.activeElement;
  var _fk=(_ae && _ae.getAttribute) ? _ae.getAttribute('data-pck') : null;
  var _fp=(_fk && typeof _ae.selectionStart==='number') ? _ae.selectionStart : null;
  var _pckSc0=document.querySelector('#acct-modal > div');
  var _pckScroll=_pckSc0?_pckSc0.scrollTop:null;
  var e=ckEsc, b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_pckPay.bkId; }); if(!b) return;
  var date=_pckPay.date, M=pckMoney(b,date);
  var due=M.due;
  var rows=[];
  if(M.cot>0)     rows.push(['Cash on Tour (ระบุตอนจอง)', M.cot]);
  if(M.balance>0) rows.push(['ยอดค้างจาก B2C', M.balance]);
  if(M.upDue>0)   rows.push(['Upgrade หน้างาน', M.upDue]);

  var brk='<div class="pckp-brk">'
    + rows.map(function(r){ return '<div class="r"><span class="k">'+e(r[0])+'</span><span class="v">'+pckB(r[1])+'</span></div>'; }).join('')
    + (M.pierPaid>0?'<div class="r paid"><span class="k">เก็บไปแล้ว</span><span class="v">&minus; '+pckB(M.pierPaid)+'</span></div>':'')
    + '<div class="r tot"><span class="k">'+(due>0?'คงเหลือต้องเก็บ':'เก็บครบแล้ว')+'</span>'
    + '<span class="v"'+(due>0?'':' style="color:#0F6E56"')+'>'+pckB(due)+'</span></div></div>';

  var form='';
  if(due<=0){
    form='<div class="pckp-done">&#10003; เก็บเงินครบแล้ว ไม่มียอดค้าง</div>';
  } else {
    // §paySplit · หนึ่งบรรทัด = หนึ่งวิธีรับเงิน · ครึ่งเงินสดครึ่งบัตรก็กรอกทีเดียวจบ
    var many=_pckPay.lines.length>1;
    _pckPay.lines.forEach(function(L,i){
      var fee=pckLineFee(L), needSlip=(L.m!=='cash');
      form+='<div class="pckp-line">';
      form+='<div class="pckp-lnhd"><span class="no">วิธีที่ '+(i+1)+'</span>'
        +'<span class="amt">'+pckB(L.amt)+(fee>0?('<i> +ธรรมเนียม '+pckB(fee)+'</i>'):'')+'</span>'
        +(many?('<button class="rm" onclick="pckLineDel('+i+')" title="เอาวิธีนี้ออก">&#10005;</button>'):'')+'</div>';

      form+='<div class="pckp-seg">';
      [['cash','เงินสด','ไม่ต้องแนบสลิป'],['transfer','โอนเงิน','ต้องแนบสลิป'],['card','บัตรเครดิต','ต้องแนบสลิป']].forEach(function(x){
        form+='<button class="'+(L.m===x[0]?'on':'')+'" onclick="pckLineSetM('+i+',\''+x[0]+'\')">'
          +'<span class="n">'+x[1]+'</span><span class="d">'+x[2]+'</span></button>';
      });
      form+='</div>';

      form+='<div class="'+(L.m==='card'?'pckp-g2':'')+'">';
      form+='<div class="pckp-fld"><label class="pckp-lbl">จำนวนเงินที่รับ &#3647;</label>'
        +'<input class="pckp-amt" type="text" inputmode="decimal" data-pck="amt'+i+'" value="'+e(String(L.amt==null?0:L.amt))+'" oninput="pckLineNum('+i+',\'amt\',this.value)">'
        +'<div class="pckp-quick">'
          +'<button onclick="pckLineFill('+i+',\'rest\')">ที่เหลือทั้งหมด</button>'
          +'<button onclick="pckLineFill('+i+',\'half\')">ครึ่งหนึ่ง</button>'
        +'</div>'
        +'<div class="pckp-hint">ใส่น้อยกว่ายอดค้างได้ · ส่วนที่เหลือกด <b>เพิ่มวิธีจ่าย</b> ด้านล่างเพื่อรับด้วยวิธีอื่น</div></div>';
      if(L.m==='card'){
        form+='<div class="pckp-fld"><label class="pckp-lbl">ค่าธรรมเนียมบัตร'
          +'<span class="pckp-unit">'
          +'<button class="'+(L.feeMode==='pct'?'on':'')+'" onclick="pckLineSet('+i+',\'feeMode\',\'pct\')">%</button>'
          +'<button class="'+(L.feeMode==='baht'?'on':'')+'" onclick="pckLineSet('+i+',\'feeMode\',\'baht\')">&#3647;</button>'
          +'</span></label>';
        if(L.feeMode==='pct'){
          form+='<input class="pckp-amt" type="text" inputmode="decimal" data-pck="pct'+i+'" value="'+e(String(L.feePct==null?0:L.feePct))+'" oninput="pckLineNum('+i+',\'feePct\',this.value)">'
            +'<div class="pckp-pct">'
            + [1.5,2,2.5,3,3.5,4,4.5,5].map(function(x){ return '<button class="'+((+L.feePct===x)?'on':'')+'" onclick="pckLineSet('+i+',\'feePct\','+x+')">'+x+'%</button>'; }).join('')
            + '<button class="'+((+L.feePct===0)?'on':'')+'" onclick="pckLineSet('+i+',\'feePct\',0)">ไม่ชาร์จ</button></div>'
            +'<div class="pckp-hint">คิดจาก '+pckB(L.amt)+' &times; '+(+L.feePct||0)+'% = <b style="color:#5B289A;font-family:\'DM Mono\',monospace">'+pckB(fee)+'</b> (ทศนิยมได้ถึง 2 ตำแหน่ง)</div>'
            +((+L.feePct||0)>5?'<div class="pckp-hint" style="color:#A32D2D;font-weight:700">&#9888; เกิน 5% แล้ว — เช็คอีกทีว่ากรอกถูกไหม (บันทึกได้ ไม่บล็อก)</div>':'');
        } else {
          form+='<input class="pckp-amt" type="text" inputmode="decimal" data-pck="fee'+i+'" value="'+e(String(L.fee==null?0:L.fee))+'" oninput="pckLineNum('+i+',\'fee\',this.value)">'
            +'<div class="pckp-hint">กรอกยอดบาทตามที่เครื่องคิดจริง · ใส่สตางค์ได้ เช่น 37.50'
            +(((+L.amt>0)&&fee>0)?(' · เท่ากับ <b style="color:#5B289A">'+(Math.round(fee/(+L.amt)*1000)/10)+'%</b> ของยอดที่รับ'):'')+'</div>'
            +(((+L.amt>0)&&(fee/(+L.amt)*100>5))?'<div class="pckp-hint" style="color:#A32D2D;font-weight:700">&#9888; เกิน 5% แล้ว — เช็คอีกทีว่ากรอกถูกไหม (บันทึกได้ ไม่บล็อก)</div>':'');
        }
        form+='</div>';
      }
      form+='</div>';

      if(L.m==='card' && fee>0)
        form+='<div class="pckp-sum"><span>ลูกค้ารูดจริงบรรทัดนี้ <span style="color:#a5a49d">('+pckB(L.amt)+' + ค่าธรรมเนียม '+pckB(fee)
          +(L.feeMode==='pct'?(' · '+(+L.feePct||0)+'%'):'')+')</span></span>'
          +'<b style="color:#5B289A">'+pckB((+L.amt||0)+fee)+'</b></div>';

      var nHint=L.m==='transfer'?' — โอนเข้าบัญชีไหน / เลขอ้างอิง':L.m==='card'?' — เครื่องไหน / เลข approve':'';
      var nPh  =L.m==='transfer'?'เช่น กสิกร xxx-x-x1234 (บ.เลิฟอันดามัน) · ref 2607291042'
               :L.m==='card'    ?'เช่น เครื่อง KBank EDC เครื่อง 2 · approve 004512'
               :                 'เช่น รับเงินที่ท่าเรือ · ทอน 300';
      form+='<div class="pckp-fld"><label class="pckp-lbl">หมายเหตุ'
        +(nHint?('<span class="pckp-soft">'+e(nHint)+'</span>'):'')+'</label>'
        +'<textarea rows="2" class="pckp-ta" oninput="pckLineAt('+i+').note=this.value" placeholder="'+e(nPh)+'">'+e(L.note||'')+'</textarea></div>';

      form+='<div class="pckp-fld"><label class="pckp-lbl">สลิป '
        +(needSlip?'<span style="color:#A32D2D;font-weight:800">*ต้องมี</span><span class="pckp-soft"> — แนบทีหลังได้</span>'
                  :'<span class="pckp-soft">— ไม่ต้องแนบสำหรับเงินสด</span>')+'</label>';
      form+=L.slips.map(function(sl,j){
        /* §slipView · ชื่อไฟล์กดเปิดดูได้ · ปุ่มลบยังทำงานเหมือนเดิม */
        return '<div class="pckp-slip"><span>&#128206;</span>'
          +'<span class="nm" style="cursor:pointer;text-decoration:underline" '
          +laSlipClickAttr(L.slips, 'สลิปที่กำลังจะบันทึก', j)+' title="กดเพื่อเปิดดูสลิป">'+e(sl.name||'slip')+'</span>'
          +'<button class="rm" onclick="pckPayRmSlip('+i+','+j+')">&#10005;</button></div>';
      }).join('');
      form+='<label class="pckp-drop'+((needSlip&&!L.slips.length)?' need':'')+'">'
        +'<input type="file" accept="image/*,application/pdf" style="display:none" onchange="pckPayPickSlip('+i+',this)">'
        +'<div class="t">&#128247; ถ่ายรูป / เลือกไฟล์สลิป</div>'
        +'<div class="s">'+(L.m==='transfer'?'สลิปโอนจากแอปธนาคาร':L.m==='card'?'สลิปจากเครื่องรูดบัตร':'เช่น รูปใบเสร็จที่ออกให้ลูกค้า')+' · jpg / png / pdf</div></label>';
      if(needSlip && !L.slips.length)
        form+='<div class="pckp-hint">หน้าท่าเร่ง ถ่ายไม่ทันก็บันทึกไปก่อนได้ — ระบบจะติดธง <b style="color:#7A4A00">รอสลิป</b> ไว้ให้ตามแนบทีหลัง</div>';
      form+='</div></div>';
    });

    form+='<button class="pckp-add" onclick="pckLineAdd()">+ เพิ่มวิธีจ่าย <span>เช่น ครึ่งเงินสด ครึ่งบัตร</span></button>';

    // สรุปเทียบยอด · ตัวเลขที่คนหน้าท่าต้องเห็นก่อนกดบันทึก
    var tot=pckPayTotal(), left=due-tot, feeAll=pckPayFeeTotal();
    var _lz=Math.abs(left)<0.005;   // §pierDecimal · เศษต่ำกว่าสตางค์ = ตรงพอดี
    form+='<div class="pckp-tot'+(_lz?' ok':(left<0?' over':' short'))+'">'
      +'<div class="r"><span>รวมที่รับครั้งนี้</span><b>'+pckB(tot)+'</b></div>'
      +(feeAll>0?('<div class="r f"><span>ค่าธรรมเนียมบัตรรวม (ไม่ตัดยอดค้าง)</span><b>'+pckB(feeAll)+'</b></div>'):'')
      +'<div class="r m"><span>'+(_lz?'ตรงพอดี · ไม่มียอดค้างเหลือ':(left>0?'จะยังค้างอยู่':'เกินยอดค้าง'))+'</span>'
        +'<b>'+(_lz?'&#10003;':pckB(Math.abs(left)))+'</b></div></div>';
  }

  var paid=pckPaysFor(b,date), hist='';
  if(paid.length){
    hist='<div class="pckp-hist"><div class="pckp-lbl" style="margin-bottom:7px">รายการที่เก็บไปแล้ว</div>';
    paid.forEach(function(p){
      var noSlip=(p.method!=='cash' && !(p.slips&&p.slips.length));
      hist+='<div class="pckp-hrow"><span class="pckp-mchip m-'+p.method+'">'+pckMLabel(p.method)+'</span>'
        +'<span style="flex:1;min-width:0"><b style="font-family:\'DM Mono\',monospace">'+pckB(p.amount)+'</b>'
        +((+p.fee||0)?('<span style="color:#a5a49d"> + ค่าธรรมเนียม '+pckB(p.fee)+(p.feePct?(' ('+p.feePct+'%)'):'')+'</span>'):'')
        +(p.note?('<div class="pckp-hnote">'+e(p.note)+'</div>'):'')
        /* §slipView · ชื่อไฟล์แต่ละใบกดเปิดดูได้ · เดิมเป็นตัวหนังสือตาย */
        +((p.slips&&p.slips.length)?('<div class="pckp-hslip">&#128206; '
           +p.slips.map(function(s,si){ return '<span style="cursor:pointer;text-decoration:underline" '
             +laSlipClickAttr(p.slips, pckMLabel(p.method)+' '+pckB(p.amount), si)
             +' title="กดเพื่อเปิดดูสลิป">'+e(s.name||'slip')+'</span>'; }).join(' · ')+'</div>'):'')
        +(noSlip?('<div style="margin-top:4px"><span class="pckp-wait">&#9888; รอสลิป</span>'
           +'<label class="pckp-late"><input type="file" accept="image/*,application/pdf" style="display:none" onchange="pckPayAddSlip(\''+p.id+'\',this)">แนบสลิป</label></div>'):'')
        +'</span>'
        +'<span class="pckp-hmeta">'+e(pckHHMMloc(p.at))+' · '+e(p.by||'')+'</span>'
        +'<button class="pckp-hdel" onclick="pckPayDel(\''+p.id+'\')" title="ลบรายการนี้">&#10005;</button></div>';
    });
    hist+='</div>';
  }

  acctModal(''
    +'<div class="pckp-hd"><div><div class="pckp-tt">เก็บเงินหน้าท่า</div>'
    +'<div class="pckp-sub">'+e(b.voucherRef||b.code||b.id)+' · '+e(b.leadPax||'')+'</div></div>'
    +'<button class="pckp-x" onclick="acctModalClose()">&#10005;</button></div>'
    +'<div class="pckp-bd">'+brk+form+hist+'</div>'
    +'<div class="pckp-ft"><button class="pckp-btn" onclick="acctModalClose()">ปิด</button>'
    +(due>0?('<button class="pckp-btn pri" onclick="pckPaySave()">บันทึกการรับเงิน'
        +(_pckPay.lines.filter(function(L){ return pckN(L.amt)>0; }).length>1
          ?(' · '+_pckPay.lines.filter(function(L){ return pckN(L.amt)>0; }).length+' วิธี'):'')+'</button>'):'')
    +'</div>');
  // §pierDecimal · คืน focus/caret + ตำแหน่ง scroll หลังวาดใหม่ (กล่องถูกเขียนทับทั้งใบทุก keystroke)
  var _sc=document.querySelector('#acct-modal > div');
  if(_sc && _pckScroll!=null) _sc.scrollTop=_pckScroll;
  pckPayRefocus(_fk,_fp);
}

function pckPayCSS(){ return ''
  /* §paySplit · กล่องต่อวิธีจ่าย · ปุ่มเติมยอด · แถบสรุปเทียบยอดค้าง */
  +'#acct-modal .pckp-line{border:1px solid #E7E4DC;border-radius:12px;padding:12px 13px;margin-bottom:10px;background:#fff}'
  +'#acct-modal .pckp-lnhd{display:flex;align-items:center;gap:9px;margin-bottom:9px}'
  +'#acct-modal .pckp-lnhd .no{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a8a82}'
  +"#acct-modal .pckp-lnhd .amt{flex:1;text-align:right;font-family:'DM Mono',monospace;font-weight:800;font-size:12.5px;color:#2f2f2b}"
  +'#acct-modal .pckp-lnhd .amt i{font-style:normal;font-weight:500;font-size:10px;color:#5B289A;margin-left:5px}'
  +'#acct-modal .pckp-lnhd .rm{border:1px solid #E7E4DC;background:#fff;color:#a5a49d;border-radius:7px;width:24px;height:24px;'
    +'font-size:11px;cursor:pointer;font-family:inherit;line-height:1;padding:0}'
  +'#acct-modal .pckp-lnhd .rm:hover{border-color:#A32D2D;color:#A32D2D}'
  +'#acct-modal .pckp-quick{display:flex;gap:6px;margin-top:6px}'
  +'#acct-modal .pckp-quick button{border:1px solid #D8D4CA;background:#fff;color:#4a4a45;border-radius:999px;'
    +'padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit}'
  +'#acct-modal .pckp-quick button:hover{border-color:#0F6E56;color:#0F6E56;background:#F3FAF7}'
  +'#acct-modal .pckp-add{width:100%;border:1.5px dashed #D8D4CA;background:#FAF9F6;color:#4a4a45;border-radius:11px;'
    +'padding:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px}'
  +'#acct-modal .pckp-add:hover{border-color:#0F6E56;color:#0F6E56;background:#F3FAF7}'
  +'#acct-modal .pckp-add span{font-weight:500;color:#a5a49d;font-size:10.5px;margin-left:5px}'
  +'#acct-modal .pckp-tot{border:1px solid #E7E4DC;border-radius:11px;padding:10px 13px;background:#FAF9F6;margin-bottom:4px}'
  +'#acct-modal .pckp-tot .r{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:11.5px;color:#6b6b64;padding:2px 0}'
  +"#acct-modal .pckp-tot .r b{font-family:'DM Mono',monospace;font-weight:800;font-size:13px;color:#2f2f2b}"
  +'#acct-modal .pckp-tot .r.f b{font-size:11.5px;color:#5B289A}'
  +'#acct-modal .pckp-tot .r.m{border-top:1px solid #E7E4DC;margin-top:6px;padding-top:7px;font-weight:700}'
  +'#acct-modal .pckp-tot.ok .r.m,#acct-modal .pckp-tot.ok .r.m b{color:#0F6E56}'
  +'#acct-modal .pckp-tot.short .r.m,#acct-modal .pckp-tot.short .r.m b{color:#7A4A00}'
  +'#acct-modal .pckp-tot.over .r.m,#acct-modal .pckp-tot.over .r.m b{color:#A32D2D}'
  +'.pckp-feeline{font-size:10px;color:#5B289A;background:#F6F2FD;border:1px solid #E2D8F5;border-radius:7px;padding:3px 8px;margin-top:4px;display:inline-block;line-height:1.5}'
  +'.pckp-feeline b{font-family:\'DM Mono\',monospace;font-weight:800}'
  +'.pckp-feeswipe{font-size:9.5px;color:#7d6aa8;font-family:\'DM Mono\',monospace}'
  +'.pckp-wait{display:inline-block;font-size:9.5px;font-weight:800;color:#7A4A00;background:#FBF0DD;border:1px solid #EAD9B0;border-radius:999px;padding:2px 8px;white-space:nowrap}'
  +'#acct-modal .pckp-hd{padding:15px 20px;border-bottom:1px solid #E7E4DC;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;font-family:\'DM Sans\',sans-serif}'
  +'#acct-modal .pckp-tt{font-size:15px;font-weight:800;color:#2f2f2b}'
  +'#acct-modal .pckp-sub{font-size:11px;color:#8a8a82;margin-top:2px}'
  +'#acct-modal .pckp-x{background:transparent;border:none;font-size:18px;color:#a5a49d;cursor:pointer;line-height:1;font-family:inherit}'
  +'#acct-modal .pckp-bd{padding:16px 20px;font-family:\'DM Sans\',sans-serif;color:#2f2f2b}'
  +'#acct-modal .pckp-ft{padding:12px 20px;border-top:1px solid #E7E4DC;background:#FAF9F6;display:flex;gap:9px}'
  +'#acct-modal .pckp-btn{flex:1;border:1px solid #D8D4CA;background:#fff;color:#4a4a45;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'
  +'#acct-modal .pckp-btn:hover{border-color:#5F5E5A}'
  +'#acct-modal .pckp-btn.pri{background:#0F6E56;border-color:#0F6E56;color:#fff}'
  +'#acct-modal .pckp-btn.pri:hover{background:#0c5a46;border-color:#0c5a46}'
  +'#acct-modal .pckp-warn{background:#FBF0DD;border:1.5px solid #EAD9B0;border-radius:12px;padding:13px 15px;display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}'
  +'#acct-modal .pckp-warn .ic{font-size:20px;color:#7A4A00;line-height:1}'
  +'#acct-modal .pckp-warn .t{font-size:13px;font-weight:800;color:#7A4A00}'
  +'#acct-modal .pckp-warn .s{font-size:11.5px;color:#9a7433;margin-top:3px;line-height:1.6}'
  +'#acct-modal .pckp-brk{border:1px solid #E7E4DC;border-radius:12px;overflow:hidden;margin-bottom:14px}'
  +'#acct-modal .pckp-brk .r{display:flex;align-items:center;justify-content:space-between;padding:8px 13px;font-size:12px;border-bottom:1px solid #F1F0EC}'
  +'#acct-modal .pckp-brk .r:last-child{border-bottom:none}'
  +'#acct-modal .pckp-brk .r.tot{background:#FAF9F6;font-weight:800}'
  +'#acct-modal .pckp-brk .k{color:#5F5E5A}'
  +'#acct-modal .pckp-brk .v{font-family:\'DM Mono\',monospace;font-weight:700}'
  +'#acct-modal .pckp-brk .r.tot .v{font-size:16px;color:#7A4A00}'
  +'#acct-modal .pckp-brk .r.paid .v{color:#0F6E56}'
  +'#acct-modal .pckp-done{background:#DCF4E8;border:1.5px solid #BFE3CC;border-radius:12px;padding:13px 15px;font-size:12.5px;font-weight:700;color:#0F6E56;text-align:center}'
  +'#acct-modal .pckp-lbl{font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:5px}'
  +'#acct-modal .pckp-soft{color:#a5a49d;font-weight:600;text-transform:none;letter-spacing:0}'
  +'#acct-modal .pckp-seg{display:flex;gap:7px;margin-bottom:13px}'
  +'#acct-modal .pckp-seg button{flex:1;border:1.5px solid #E7E4DC;background:#FAF9F6;border-radius:11px;padding:11px 8px;cursor:pointer;font-family:inherit;text-align:center}'
  +'#acct-modal .pckp-seg button .n{display:block;font-size:12.5px;font-weight:800;color:#2f2f2b}'
  +'#acct-modal .pckp-seg button .d{display:block;font-size:9.5px;color:#a5a49d;margin-top:2px}'
  +'#acct-modal .pckp-seg button:hover{border-color:#a5a49d}'
  +'#acct-modal .pckp-seg button.on{border-color:#0F6E56;background:#DCF4E8}'
  +'#acct-modal .pckp-seg button.on .n{color:#0F6E56}'
  +'#acct-modal .pckp-seg button.on .d{color:#3f8a74}'
  +'#acct-modal .pckp-fld{margin-bottom:13px}'
  +'#acct-modal .pckp-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
  +'#acct-modal .pckp-amt{width:100%;border:1.5px solid #E7E4DC;border-radius:9px;font-family:\'DM Mono\',monospace;font-size:19px;font-weight:800;text-align:right;padding:10px 13px;background:#fff;color:#2f2f2b}'
  +'#acct-modal .pckp-amt:focus{outline:none;border-color:#185FA5}'
  +'#acct-modal .pckp-ta{width:100%;border:1.5px solid #E7E4DC;border-radius:9px;padding:9px 11px;font-family:inherit;font-size:13px;background:#fff;color:#2f2f2b}'
  +'#acct-modal .pckp-ta:focus{outline:none;border-color:#185FA5}'
  +'#acct-modal .pckp-hint{font-size:10.5px;color:#a5a49d;margin-top:4px;line-height:1.5}'
  +'#acct-modal .pckp-unit{display:inline-flex;margin-left:8px;border:1px solid #E7E4DC;border-radius:999px;overflow:hidden;vertical-align:middle}'
  +'#acct-modal .pckp-unit button{border:none;background:#fff;color:#a5a49d;font-family:\'DM Mono\',monospace;font-size:11px;font-weight:700;padding:2px 10px;cursor:pointer;line-height:1.6}'
  +'#acct-modal .pckp-unit button.on{background:#5B289A;color:#fff}'
  +'#acct-modal .pckp-pct{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}'
  +'#acct-modal .pckp-pct button{border:1.5px solid #E7E4DC;background:#fff;color:#5F5E5A;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +'#acct-modal .pckp-pct button:hover{border-color:#5B289A;color:#5B289A}'
  +'#acct-modal .pckp-pct button.on{background:#EDE7FB;border-color:#5B289A;color:#5B289A}'
  +'#acct-modal .pckp-sum{background:#FAF9F6;border:1px solid #E7E4DC;border-radius:10px;padding:10px 13px;display:flex;align-items:center;justify-content:space-between;font-size:12px;margin-bottom:13px}'
  +'#acct-modal .pckp-sum b{font-family:\'DM Mono\',monospace;font-size:16px;font-weight:800}'
  +'#acct-modal .pckp-drop{display:block;border:1.5px dashed #E7E4DC;border-radius:11px;padding:14px;text-align:center;background:#FCFCFB;cursor:pointer}'
  +'#acct-modal .pckp-drop:hover{border-color:#185FA5;background:#E6F1FB}'
  +'#acct-modal .pckp-drop.need{border-color:#E6C9C3;background:#FFF7F6}'
  +'#acct-modal .pckp-drop .t{font-size:12px;font-weight:700;color:#5F5E5A}'
  +'#acct-modal .pckp-drop.need .t{color:#A32D2D}'
  +'#acct-modal .pckp-drop .s{font-size:10.5px;color:#a5a49d;margin-top:3px}'
  +'#acct-modal .pckp-slip{display:flex;align-items:center;gap:10px;border:1px solid #BFE3CC;background:#DCF4E8;border-radius:10px;padding:9px 12px;margin-bottom:8px}'
  +'#acct-modal .pckp-slip .nm{flex:1;min-width:0;font-size:11.5px;font-weight:700;color:#0F6E56;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'#acct-modal .pckp-slip .rm{background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:13px;font-family:inherit}'
  +'#acct-modal .pckp-hist{border-top:1px solid #E7E4DC;margin-top:16px;padding-top:13px}'
  +'#acct-modal .pckp-hrow{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #F1F0EC;font-size:11.5px}'
  +'#acct-modal .pckp-hrow:last-child{border-bottom:none}'
  +'#acct-modal .pckp-mchip{font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;flex:none;margin-top:1px}'
  +'#acct-modal .pckp-mchip.m-cash{background:#DCF4E8;color:#0F6E56}'
  +'#acct-modal .pckp-mchip.m-transfer{background:#E6F1FB;color:#185FA5}'
  +'#acct-modal .pckp-mchip.m-card{background:#EDE7FB;color:#5B289A}'
  +'#acct-modal .pckp-hnote{font-size:10.5px;color:#a5a49d;margin-top:2px}'
  +'#acct-modal .pckp-hslip{font-size:10.5px;color:#0F6E56;margin-top:2px}'
  +'#acct-modal .pckp-hmeta{font-family:\'DM Mono\',monospace;color:#a5a49d;font-size:10.5px;white-space:nowrap;flex:none}'
  +'#acct-modal .pckp-hdel{background:none;border:none;color:#A32D2D;cursor:pointer;font-family:inherit;flex:none}'
  +'#acct-modal .pckp-late{display:inline-block;margin-left:6px;background:#FBF0DD;border:1px solid #EAD9B0;color:#7A4A00;border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer}'
  +'#acct-modal .pckp-late:hover{background:#F7E6C8;border-color:#D9B978}'
  ;
}
function pckDateShift(delta){ var d=new Date(_pckDate+'T12:00:00'); d.setDate(d.getDate()+delta); _pckDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); renderPierCheckin(); }
function pckToday(){ _pckDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10); renderPierCheckin(); }
function pckSetFam(f){ _pckFam=(_pckFam===f)?null:f; _pckRoute=null; renderPierCheckin(); }
function pckSetRoute(r){ _pckRoute=(_pckRoute===r)?null:r; renderPierCheckin(); }
function pckPickDay(ds){ if(ds){ _pckDate=ds; renderPierCheckin(); } }
// ยอดที่คาดว่าจะมาถึงท่า = จอง − No-show จากรถ (ยกเว้นเหตุผลที่ยังไปเจอที่ท่า)
/* §ckPierSelf2 · คนของใบนี้ที่อยู่บนเรือจริง · แหล่งเดียวสำหรับทุกใบที่นับหัว
   เช็คอินหน้าท่าแล้ว = ยอดที่หน้าท่านับ (รวมคนที่ไม่ได้ขึ้นรถแต่ตามมาเองที่ท่า)
   ยังไม่เช็คอิน = ยอดที่รอรับตามฝั่งรถ · ยังเป็นตัวเลขที่ดีที่สุดที่มีในตอนนั้น */
function pckOnBoard(b, date, booked){
  if(booked==null){ var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null;
    booked=(typeof ckBookedPax==='function')?ckBookedPax(t||{}):0; }
  var ck=(typeof ckRead==='function')?ckRead(b,date,'pier'):null;
  /* มีคนแตะตัวนับแล้ว = หน้าท่านับหัวเองแล้ว · เชื่อเลขนั้น ไม่ต้องรอกด &#10003; ขึ้นเรือ
     (คนที่ยืนยันว่าตามมาเองที่ท่า ต้องนับเข้าครัวตั้งแต่ก่อนเรือออก ไม่ใช่หลังออก) */
  if(ck && ck.actualPax!=null) return Math.max(0, +ck.actualPax||0);
  var exp=(typeof pckExpected==='function')?pckExpected(b,date,booked):booked;
  return Math.max(0, (exp!=null?exp:booked)||0);
}
/* §pckExpPier (2026-09-12) · "ทริป 12/9 ยอดจริง 60 แต่ระบบขึ้น 61"
   ของเดิมอ่านเฉพาะบันทึก "ฝั่งรถ" (ckRead 'van') · No-show ที่บันทึกหน้าท่า
   จึงไม่เคยถูกหักออกจาก expect เลยสักครั้ง
   ผลคือชิปบนหัวเรือ (ถึงท่า · เคลียร์ · ขึ้นเรือ · ที่นั่ง) ซึ่งบวกจาก expect
   นับคนที่หน้าท่ากด No-show ไปแล้วรวมอยู่ด้วย — เกินจริงเท่าจำนวนนั้น
   ขณะที่บรรทัด "เดินทางจริง" บนการ์ดใบเดียวกันหักให้ถูกแล้ว (ใช้ ckPaxLeft)
   เลขสองตัวบนการ์ดเดียวกันจึงไม่ตรงกัน

   ของเดิมยังอ่าน v.noShow (ตัวเลขก้อนเดียว) + v.reasonCode (เหตุผลเดียว)
   ทั้งที่ของจริงเป็น events หลายรายการ · มีทั้งการถอนคืน (§ckBack)
   การยืนยันหน้าท่า (§ckPierFix) และ "ตามมาเองที่ท่า" (§ckSelfLost)
   ckLostByType() ตีความครบทุกกติกาอยู่แล้ว และเป็นตัวที่บรรทัด "เดินทางจริง" ใช้
   → ให้ใช้ตัวเดียวกัน เลขทุกช่องบนการ์ดจะมาจากแหล่งเดียว

   เพดานการกดขึ้นเรือไม่กระทบ · ckCeil() ใช้ booked เต็มเสมอ (คนตามมาเองที่ท่าได้) */
function pckExpected(b, date, booked){
  var L=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
  if(!L || L.total<=0) return booked;
  return Math.max(0, booked - L.total);
}
// ปุ่มขั้นตอนหน้าท่า · ถึงท่า / เคลียร์ · ขั้น "ขึ้นเรือ" ยังใช้ปุ่ม ✓ เดิม (มันนับ pax + ถามเหตุผลให้ด้วย)
// จะได้ไม่มีปุ่มสองที่ทำเรื่องเดียวกัน
/* §pckNoStage · ป้ายบอกเคสพิเศษของแถว · เคยแปะไว้หัวช่อง "สถานะหน้าท่า"
   ช่องนั้นถูกตัดออกจากโหมดตารางแล้ว แต่ป้ายพวกนี้เป็นของที่คนหน้าท่าต้องเห็น
   (ยืนยันว่ามาแล้ว / ตามมาเองที่ท่า / ไม่ได้ขึ้นรถแต่จะมาเอง) จึงย้ายไปช่องการจัดการ
   แยกเป็นฟังก์ชันเดียวเพื่อไม่ให้สองที่วาดคนละแบบแล้วเพี้ยนกันทีหลัง */
function pckFlagTags(r, date){
  var e=ckEsc, ck=r.ck||{};
  // §ckSelfPier · ไม่ได้ขึ้นรถ แต่แจ้งว่ามาเองที่ท่า · ยังเช็คอินได้ตามปกติ
  var _sp=pckSelfPierNote(r.b, date);
  // §ckPierFix · หน้าท่ายืนยันเองว่ามาจริง · โชว์ให้เห็นว่าใครกด เวลาไหน · กดยกเลิกได้
  var _re=(typeof ckReinstateOf==='function')?ckReinstateOf(r.b,date):null;
  var _reTag=_re ? ('<div style="font-size:10px;font-weight:700;color:#0F6E56;background:#E1F5EE;border:1px solid #B7E2D2;border-radius:7px;padding:2px 8px;margin-bottom:4px;display:inline-block;cursor:pointer" '
      +'onclick="event.stopPropagation();ckPierReinstate(\''+r.b.id+'\',\''+date+'\',false)" '
      +'title="หน้าท่ายืนยันว่ามาจริง แม้เช็คอินรถบันทึกว่าไม่ได้ขึ้นรถ · คลิกเพื่อยกเลิกการยืนยัน">&#8617; หน้าท่ายืนยันว่ามาแล้ว'
      +(_re.at?(' · '+e(_re.at)):'')+(_re.by?(' · '+e(_re.by)):'')+'</div>') : '';
  /* §ckPierSelf · นับเกินยอดที่รถส่งมา = คนที่ตามมาเองถึงท่า · ต้องเห็นว่าใครเป็นคนยืนยัน */
  var _sa=(ck && ck.selfAdd && ck.selfAdd.pax>0) ? ck.selfAdd : null;
  /* §ckSelfAlloc · ไม่ได้แยกประเภทไว้ = ตัวเลขยังไปที่ครัว/ทะเบียนไม่ได้ · ต้องเห็นว่าค้างอยู่ */
  var _saU=(_sa && typeof ckSelfUnalloc==='function')?ckSelfUnalloc(r.b,date):0;
  var _saBd=_sa ? PAXK.filter(function(k){ return (+_sa[k]||0)>0; })
      .map(function(k){ return k.toUpperCase()+' '+(+_sa[k]||0); }).join(' · ') : '';
  var _saTag=_sa ? ('<div onclick="event.stopPropagation();ckSelfOpen(\''+r.b.id+'\',\''+date+'\',\''+(r._ckKind||'pier')+'\')" '
      +'style="font-size:10px;font-weight:700;color:'+(_saU?'#8A5B00':'#0F6E56')+';background:'+(_saU?'#FBF3E6':'#E1F5EE')
      +';border:1px solid '+(_saU?'#EBDCC2':'#B7E2D2')+';border-radius:7px;padding:2px 8px;margin-bottom:4px;display:inline-block;cursor:pointer" '
      +'title="ไม่ได้ขึ้นรถมา แต่มาถึงท่าเอง · บันทึกของเช็คอินรถไม่ถูกแก้ · คลิกเพื่อแก้ไข">'
      +(_saU?'&#9888; ':'&#8617; ')+'ตามมาเองที่ท่า +'+_sa.pax
      +(_saBd?(' · '+e(_saBd)):'')
      +(_saU?(' · ยังไม่ระบุ '+_saU):'')
      +(_sa.at?(' · '+e(_sa.at)):'')+(_sa.by?(' · '+e(_sa.by)):'')
      +(_sa.note?('<br><span style="font-weight:500">'+e(_sa.note)+'</span>'):'')+'</div>') : '';
  var _spTag=_sp ? ('<div style="font-size:10px;font-weight:700;color:#6B289A;background:#F4E8FB;border:1px solid #E2CDF2;border-radius:7px;padding:2px 8px;margin-bottom:4px;display:inline-block" '
      +'title="เช็คอินรถบันทึกว่าไม่ได้ขึ้นรถ แต่ให้เหตุผลว่าจะมาเองที่ท่า · ยังนับว่ารอรับอยู่ เช็คอินได้ตามปกติ">&#128694; ไม่ได้ขึ้นรถ · '
      +e(_sp.label)+' '+_sp.pax+' คน'+(_sp.at?(' · '+e(_sp.at)):'')+'</div>') : '';
  return {re:_reTag, sa:_saTag, sp:_spTag};
}
function pckFlagTagsHtml(r, date){
  var t=pckFlagTags(r, date);
  return t.re+t.sa+t.sp;
}
function pckStageCell(r, date, sheet){
  var e=ckEsc, ck=r.ck||{}, st=pckStage(ck);
  var _ft=pckFlagTags(r, date), _reTag=_ft.re, _saTag=_ft.sa, _spTag=_ft.sp;
  var _vd=pckVoidOf(r, date);
  if(_vd) return _saTag+_spTag+'<div class="pck-void"><b>&#10007; '+e(pckVoidLabel(_vd))+'</b>'
    +'<span>'+_vd.pax+' คน · ไม่ต้องเช็คอิน</span>'
    +((_vd.at||_vd.by)?('<span class="w">'+e((_vd.at||'')+(_vd.by?(' · '+_vd.by):''))+'</span>'):'')
    +(_vd.reason?('<span>'+e(_vd.reason)+'</span>'):'')+'</div>';
  var due=(r.money?r.money.due:0)||0;
  var hhmm=function(iso){ return pckHHMM(iso); };   // §localTime · ห้ามตัดสตริง ISO ตรงๆ มันเป็น UTC
  var btn=function(S){
    var done=pckStageRank(st)>=pckStageRank(S.k);
    var when=(S.k==='arr'?hhmm(ck.arrivedAt):hhmm(ck.clearedAt));
    return '<button onclick="pckStageSet(\''+r.b.id+'\',\''+date+'\',\''+S.k+'\',\''+(r._ckKind||'pier')+'\')" title="'+e(S.lbl+(done?(' · '+((S.k==='arr'?ck.arrivedBy:ck.clearedBy)||'')+(when?(' '+when):'')):' · กดเพื่อบันทึก'))+'" style="border:1.5px solid '+(done?S.bd:'#E7E4DC')+';background:'+(done?S.bg:'#fff')+';color:'+(done?S.col:'#a5a49d')+';border-radius:7px;padding:3px 9px;font-size:10.5px;font-weight:'+(done?'800':'600')+';cursor:pointer;font-family:inherit;white-space:nowrap;margin:0 3px 3px 0">'
      +(done?'&#10003; ':'')+e(S.short)+(done&&when?('<span style="font-family:\'DM Mono\',monospace;font-weight:600;margin-left:5px;opacity:.75">'+when+'</span>'):'')+'</button>';
  };
  /* §pckSheet6 · โหมดตารางโชว์เฉพาะด่านถัดไปที่ต้องทำ กดแล้วเลื่อนไปเอง
     ของเดิมโชว์สองปุ่มค้างไว้ตลอด คนหน้าท่าต้องอ่านเองว่าอันไหนถึงคิว
     บรรทัดเล็กใต้ปุ่มบอกด่านที่เพิ่งผ่าน + เวลา + คนกด · กดที่บรรทัดนั้น = ถอยกลับ
     (ของเดิมถอยด้วยการกดปุ่มเดิมซ้ำ ทางถอยจึงต้องไม่หายไปพร้อมปุ่มที่ตัดออก) */
  var html;
  if(sheet){
    var _q=function(k){ return 'event.stopPropagation();pckStageSet(\''+r.b.id+'\',\''+date+'\',\''+k+'\',\''+(r._ckKind||'pier')+'\')'; };
    var _mk=function(k,lbl,cls,tip){
      return '<button class="pcs-sb '+cls+'" onclick="'+_q(k)+'" title="'+e(tip)+'">'+lbl+'</button>'; };
    var _back=function(k,txt,tip){
      return '<span class="pcs-sbs" onclick="'+_q(k)+'" title="'+e(tip)+'">'+txt+'</span>'; };
    var _wArr=hhmm(ck.arrivedAt), _wClr=hhmm(ck.clearedAt);
    var _one;
    if(st==='wait'){
      _one=_mk('arr','ถึงท่า &rsaquo;','a','บันทึกว่าลูกค้ามาถึงท่าแล้ว');
    } else if(st==='arr'){
      _one=_mk('clr','เคลียร์ &rsaquo;','c','ตรวจลูกค้าและเก็บเงินครบแล้ว')
        +_back('arr','ถึงท่า '+e(_wArr||'')+(ck.arrivedBy?(' &middot; '+e(ck.arrivedBy)):''),
               'กดเพื่อถอยกลับเป็นยังไม่ถึงท่า');
    } else {
      _one=_mk('clr','&#10003; เคลียร์แล้ว','ok','กดเพื่อถอยกลับเป็นถึงท่า (ยังไม่เคลียร์)')
        +_back('clr',e(_wClr||'')+(ck.clearedBy?(' &middot; '+e(ck.clearedBy)):''),
               'กดเพื่อถอยกลับเป็นถึงท่า');
    }
    html=_reTag+_saTag+_spTag+_one;
  } else {
    html=_reTag+_saTag+_spTag+btn(PCK_STAGES[0])+btn(PCK_STAGES[1]);
  }
  if(st==='on') html+='<div style="font-size:10px;font-weight:800;color:#0F6E56">&#10003; ขึ้นเรือแล้ว</div>';
  else if(st==='clr' && due>0) html+='<div style="font-size:9.5px;color:#7A4A00">เคลียร์แล้ว · รอขึ้นเรือ</div>';
  else if(st==='arr' && due>0) html+='<div style="font-size:9.5px;color:#A32D2D;font-weight:700">&#9888; ยังไม่เก็บเงิน</div>';
  return html;
}

// Add-on ที่จองมาล่วงหน้า · กติกาเดียวกับคอลัมน์ Add-on ของ By-trip (bkV2RenderTab2) คือดู 4 ที่ตามลำดับ:
// bk.addOns[] → trip.bundle/longtailManual → routeBundles ของ rate type · หางยาวถูกแยกออกมาไว้หน้าสุด
// เพราะหน้าท่าต้องรู้ก่อนใครว่าใครต้องลงเรือหางยาว
function ckAddonList(bk, routeId){
  var out=[], ltLabel='', ltNote='';
  (bk.addOns||[]).forEach(function(a){
    if(typeof bkV2IsB2CFeeAddOn==='function' && bkV2IsB2CFeeAddOn(a)) return;   // §b2cFee
    var ty=String(a.type||''), lbl=String(a.label||a.type||'');
    if(/longtail|หางยาว/i.test(ty) || /longtail|หางยาว/i.test(lbl)){
      ltLabel=(lbl||'Longtail').replace(/\s*\(per boat[^)]*\)/i,'');
      if((a.note||'').trim()) ltNote=(a.note||'').trim();
    } else if(lbl) out.push({kind:'addon', label:lbl, note:(a.note||'').trim()});
  });
  var trip=(bk.trips||[]).find(function(t){ return t.routeId===routeId; })||{};
  if(!ltLabel && trip.bundle && trip.bundle.type==='longtail') ltLabel='Longtail'+(trip.bundle.mode==='free'?' (incl.)':'');
  if(!ltLabel && trip.longtailManual) ltLabel='Longtail';
  if(!ltLabel){
    var rtId=bk.rateTypeRef || (bk.agentId && typeof sbGetAgent==='function' ? ((sbGetAgent(bk.agentId)||{}).rateTypeId) : null);
    var rt=(rtId && typeof getRateType==='function') ? getRateType(rtId) : null;
    var lb=rt && rt.routeBundles && rt.routeBundles[routeId] && rt.routeBundles[routeId].longtail;
    if(lb && (typeof _rtBundleAppliesTo!=='function' || _rtBundleAppliesTo(lb, trip.bookingMode==='charter')))
      ltLabel='Longtail'+(lb.mode==='free'?' (incl.)':' (bundle)');
  }
  if(ltLabel) out.unshift({kind:'longtail', label:ltLabel, note:ltNote});
  return out;
}
// ช่อง Add-on ของหน้าท่า · 3 ชั้น — จองมาแล้ว / ขายเพิ่มหน้างาน (SB_EXTRAS) / อัปเกรด · ปุ่มขายเพิ่มอยู่ในช่องเลย
function pckAddonCell(r, date){
  var e=ckEsc, b=r.b;
  var m=function(n){ return '&#3647;'+Math.round(n||0).toLocaleString(); };
  // §ovnSettled · ขากลับค้างคืน · ของที่จองมากับใบและอัปเกรด ถูกใช้/เก็บเงินไปแล้ววันขาไป
  //   โชว์ซ้ำพร้อมราคา = อ่านเหมือนมีเงินต้องเก็บอีกรอบ
  var _ovn=!!r._ovnBack;
  var pre=(_ovn?[]:ckAddonList(b, r.t.routeId)).map(function(a){
    var bg=(a.kind==='longtail')?'#E6F1FB':'#EDE7FB', fg=(a.kind==='longtail')?'#1683C7':'#5B289A';
    return '<span class="ck-ao" style="background:'+bg+';color:'+fg+'" title="'+e(a.note?('หมายเหตุ: '+a.note):'จองมาล่วงหน้า')+'">'+e(a.label)+(a.note?' &#128221;':'')+'</span>';
  }).join('');
  // §extraDay · ของขายหน้างานเป็นของ "วันที่ขาย" ไม่ใช่ของทั้งใบ · กติกาเดียวกับ pckMoney
  var ex=((typeof bkV2ExtrasFor==='function')?bkV2ExtrasFor(b.id):[]).filter(function(x){
    return !(date && x.tripDate && x.tripDate!==date);
  }).map(function(x){
    var _g=(typeof bkxExGot==='function')?bkxExGot(x):true;
    return '<span class="ck-ao" style="background:'+(_g?'#E1F5EE':'#FDF3E3')+';color:'+(_g?'#0F6E56':'#8A5300')+'" title="'+e(x.service+(x.qty>1?(' ×'+x.qty):'')+' · '+(_g?('ขายหน้างาน '+({cash:'เงินสด',transfer:'โอนเงิน',card:'บัตรเครดิต'}[x.method||'cash']||'เงินสด')):'ขายล่วงหน้า · เก็บเงินวันนี้ · ยังไม่ได้เก็บ')+((+x.fee||0)?(' · ค่าธรรมเนียม '+Math.round(x.fee).toLocaleString()):'')+((_g&&x.method&&x.method!=='cash'&&!((x.slips||[]).length))?' · ยังไม่มีสลิป':'')+(x.seller?(' · '+x.seller):''))+'">'+e(x.service)+(x.qty>1?(' ×'+x.qty):'')+' +'+m(x.total)+(_g?'':' ⏳')+'</span>';
  }).join('');
  var up=((!_ovn && Array.isArray(b.upgrades))?b.upgrades:[]).map(function(u){
    var got=!!u.collected;
    return '<span class="ck-ao" style="background:'+(got?'#DCF4E8':'#FBF0DD')+';color:'+(got?'#0F6E56':'#7A4A00')+'" title="'+e(u.label+' · '+(got?'เก็บเงินแล้ว':'ยังไม่เก็บ'))+'">&#11014; '+e(u.label)+' '+m(u.sellPrice)+'</span>';
  }).join('');
  var body=pre+ex+up;
  return (body||(_ovn?'<span class="ck-dim" title="ของที่จองมากับใบถูกใช้ไปแล้ววันขาไป">— ของวันขาไป</span>':'<span class="ck-dim">—</span>'))
    +'<div class="ck-aoact"><button onclick="event.stopPropagation();bkV2ExtraAdd(\''+b.id+'\')" title="ขายเพิ่มหน้างาน (เงินสด)">+ ขายเพิ่ม</button>'
    +'<button onclick="event.stopPropagation();bkV2UpgradeOpen(\''+b.id+'\')" title="อัปเกรดหน้างาน">&#11014;</button></div>';
}
function pckHostEl(){ return document.getElementById(_pckLand?'landcheckin-host':'piercheckin-host'); }
function pckSetPier(p){
  _pckPier=(_pckPier===p)?null:p;
  _pckFam=null; _pckRoute=null;            /* ท่าเปลี่ยน โปรแกรมที่เลือกไว้อาจไม่อยู่ท่านี้แล้ว */
  renderPierCheckin();
}
function pckPierOf(rid){
  var rt=(typeof getRoute==='function'?getRoute(rid):null)||{};
  return rt.pier||'';
}
function pckPierBar(date){
  var cnt={}, tot=0;
  pckProgData(date).forEach(function(A){
    A.vord.forEach(function(rid){
      var p=pckPierOf(rid); if(!p) return;
      var n=(A.v[rid].pax||0); cnt[p]=(cnt[p]||0)+n; tot+=n;
    });
  });
  var ks=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; });
  if(ks.length<2) return '';               /* มีท่าเดียวก็ไม่ต้องมีปุ่มให้กด */
  var b=function(k,lbl,n){
    return '<button class="pkh-pb'+((_pckPier===k)?' on':'')+'" onclick="pckSetPier('
      +(k?('\''+k+'\''):'null')+')" title="'+ckEsc(lbl)+'">'+ckEsc(lbl)+'<b>'+n+'</b></button>'; };
  return '<div class="pkh-piers">'+b(null,'ทุกท่า',tot)
    +ks.map(function(k){ return b(k, PCK_PIER_LBL[k]||k, cnt[k]); }).join('')+'</div>';
}
function pckProgToggle(fid){
  if(_pckProgOpen[fid]) delete _pckProgOpen[fid]; else _pckProgOpen[fid]=1;
  renderPierCheckin();
}

/* ── ตัวเลขของแต่ละโปรแกรม / แต่ละ variant ในวันนั้น ────────────────────────
   เดินรายการ booking รอบเดียว · ตัวเลขทุกตัวเป็น "เดินทางจริง" หักคนที่ไม่มาแล้ว
   เหมือนที่การ์ดโปรแกรมของเดิมทำ (ckRoutePills) เพื่อให้สองที่ไม่ขัดกัน */
function pckProgData(date){
  var P=function(pax,k){ return (typeof bkV2PaxTot==='function')?bkV2PaxTot(pax||{},k):0; };
  var fam={}, order=[];
  var newV=function(){ return {pax:0,booked:0,arr:0,clr:0,brd:0,due:0,rows:0,
                               PK:{d:0,t:0},KL:{d:0,t:0},OWN:{t:0}}; };
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    (b.trips||[]).forEach(function(t){
      if((t.date||'')!==date) return;
      /* §landCk · การ์ด "โปรแกรมวันนี้" ต้องตรงกับหน้าที่เปิดอยู่ · ไม่งั้นหน้าเช็คอิน City tour
         ขึ้นรายการทริปเรือที่กดดูไม่ได้ · ตัวนี้เป็นแหล่งเดียวของการ์ด จำนวนโปรแกรม ชิปท่า และปุ่มล้าง */
      if(typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId) !== _pckLand) return;
      var f=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(t.routeId):null;
      if(!f) return;
      var p=t.pax||{};
      var L=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
      var g=function(k){ var v=P(p,k); if(!L||L.total<=0) return v;
        return (typeof ckPaxLeft==='function')?ckPaxLeft(b,date,k,v):Math.max(0,v-L.total); };
      var pax=g('ad')+g('chd')+g('inf')+g('foc');
      var bkPax=P(p,'ad')+P(p,'chd')+P(p,'inf')+P(p,'foc');
      var A=fam[f.id];
      if(!A){ A=fam[f.id]={f:f, v:{}, vord:[], pax:0, booked:0, arr:0, clr:0, brd:0, due:0, rows:0};
              order.push(f.id); }
      var V=A.v[t.routeId];
      if(!V){ V=A.v[t.routeId]=newV(); A.vord.push(t.routeId); }
      A.pax+=pax; A.booked+=bkPax; V.pax+=pax; V.booked+=bkPax;
      if(typeof bkIsOvnReturn==='function' && bkIsOvnReturn(t)) return;   /* ขากลับ OVN ไม่มีขั้นเช็คอิน */
      A.rows++; V.rows++;
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
      var rk=(typeof pckStageRank==='function')
             ? pckStageRank((typeof pckStage==='function')?pckStage(O.pierCheckin):'wait') : 0;
      if(rk>=1){ A.arr+=pax; V.arr+=pax; }
      if(rk>=2){ A.clr+=pax; V.clr+=pax; }
      if(rk>=3){ A.brd+=pax; V.brd+=pax; }
      else { var M=(typeof pckMoney==='function')?pckMoney(b,date):null;
             if(M&&M.due>0){ A.due+=M.due; V.due+=M.due; } }
      /* โซนรับ · ตรงกับบล็อก PK / KL / มาเอง ของการ์ดโปรแกรมเดิม */
      var z=(typeof bkV2EffZone==='function')?bkV2EffZone(b,t):(t.zone||b.pickupZone||'NoTransfer');
      var own=(b.pickupSelf || z==='NoTransfer' || z==='NT' || !O.vanId);
      if(own) V.OWN.t+=pax;
      else { var key=(z==='KL')?'KL':'PK'; V[key].t+=pax; if(rk>=3) V[key].d+=pax; }
    });
  });
  /* ทริปที่ล็อกที่นั่งไว้แต่ยังไม่มี booking · ต้องเห็นว่ามีโปรแกรมนี้อยู่ */
  (typeof ROUTES!=='undefined'?ROUTES:[]).forEach(function(rr){
    var lk=(typeof bkV2LockedTotal==='function')?bkV2LockedTotal(rr.id,date):0;
    if(lk<=0) return;
    var f=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(rr.id):null; if(!f) return;
    var A=fam[f.id];
    if(!A){ A=fam[f.id]={f:f,v:{},vord:[],pax:0,booked:0,arr:0,clr:0,brd:0,due:0,rows:0}; order.push(f.id); }
    if(!A.v[rr.id]){ A.v[rr.id]=newV(); A.vord.push(rr.id); }
    A.v[rr.id].locked=(A.v[rr.id].locked||0)+lk;
    A.locked=(A.locked||0)+lk;
  });
  var list=order.map(function(k){ return fam[k]; })
                .sort(function(a,b){ return b.pax-a.pax || String(a.f.name).localeCompare(String(b.f.name)); });
  list.forEach(function(A){
    A.vord.sort(function(x,y){
      return String(pckDepOf(x)||'99:99').localeCompare(String(pckDepOf(y)||'99:99'))
          || String(pckVarLbl(A.f, x)).localeCompare(String(pckVarLbl(A.f, y)));
    });
  });
  return list;
}

/* ชื่อย่อของ variant · ตัดชื่อโปรแกรมกับคำว่า by ออก เหลือส่วนที่ต่างกันจริง
   "Phi Phi Bamboo by Speedboat" → "by Speedboat" · "Similan Islands - PG" → "PG" */
function pckVarLbl(f, rid){
  var rn=((typeof getRoute==='function'&&getRoute(rid))||{}).name||rid;
  var s=String(rn).replace(f&&f.name?f.name:'', '').replace(/^[\s·\-]+/,'').trim();
  return s||rn;
}

/* ── ตัววาดรายการโปรแกรม ───────────────────────────────────────────────────
   หัวโปรแกรมกด = กรองทั้งโปรแกรม · variant กด = เจาะ variant เดียว
   (ใช้ pckSetFam / pckSetRoute ตัวเดิม ตัวกรองจึงเป็นชุดเดียวกับของเก่าทุกที่) */
function pckZbox(lbl, done, tot, own){
  if(!tot) return '';
  var C = own ? ['#F4E8FB','#6B289A']
        : (done>=tot) ? ['#DCF4E8','#0C6B47']
        : (done>0)    ? ['#FAEEDA','#854F0B'] : ['#F1EFE8','#5F5E5A'];
  return '<span class="pgz" style="background:'+C[0]+';color:'+C[1]+'" title="'+ckEsc(lbl)+'">'
    +'<b>'+(own?tot:(done+'/'+tot))+'</b>'+ckEsc(lbl)+'</span>';
}
function pckProgStatus(A){
  if(!A.rows) return ['ยังไม่มี booking','#F1EFE8','#8a8a82'];
  var miss=Math.max(0, A.pax-A.brd);
  if(miss===0) return ['ออกได้','#DCF4E8','#0F6E56'];
  if(A.arr>0)  return ['ขาด '+miss+' คน','#FBF0DD','#8A5B00'];
  return ['ยังไม่ถึงท่า','#F1EFE8','#8a8a82'];
}
function pckProgList(date){
  var e=ckEsc, list=pckProgData(date);
  if(_pckPier){                            /* เหลือเฉพาะ variant ของท่าที่เลือก */
    list=list.map(function(A){
      var keep=A.vord.filter(function(rid){ return pckPierOf(rid)===_pckPier; });
      if(!keep.length) return null;
      var B={}; for(var k in A) B[k]=A[k];
      B.vord=keep; B.pax=0; B.arr=0; B.clr=0; B.brd=0; B.due=0; B.rows=0;
      keep.forEach(function(rid){ var V=A.v[rid];
        B.pax+=V.pax; B.arr+=V.arr; B.clr+=V.clr; B.brd+=V.brd; B.due+=V.due; B.rows+=V.rows; });
      return B;
    }).filter(Boolean);
  }
  if(!list.length) return '<div class="pgh-empty">ไม่มีโปรแกรมในวันนี้</div>';
  /* §pckHead3b · ปุ่ม "ทุกโปรแกรม" ย้ายไปอยู่หัวการ์ดแล้ว (ดู pckProgAllBtn)
     ของเดิมเป็นแถบเต็มความกว้างบนสุดของรายการ กินไปหนึ่งบรรทัดทั้งที่กดปีละครั้ง */
  var h=list.map(function(A){
    var famOn=(_pckFam===A.f.id)||(_pckRoute&&A.v[_pckRoute]);
    var op=!!_pckProgOpen[A.f.id] || !!famOn;
    var st=pckProgStatus(A), bar=A.pax?Math.round(A.brd*100/A.pax):0;
    var live=A.vord.filter(function(rid){
      return (typeof bkV2IsRouteOpenOn!=='function')||bkV2IsRouteOpenOn(rid,date); }).length;
    /* §pckHead5 · พื้นหลังเป็นสีของโปรแกรมนั้น · กวาดตาหาโปรแกรมด้วยสีได้เหมือนที่ทำกับเอเจนซี่
       ที่เลือกอยู่เข้มขึ้นหนึ่งขั้น + มีแถบสีด้านซ้าย จะได้ยังแยกออกว่ากำลังกรองอันไหน */
    var _col=A.f.color||'#8b909c';
    var _bg=famOn?pckTint(_col,.80):pckTint(_col,.93);
    var _ink=pckShade(_col,.62);
    var out='<div class="pgf'+(famOn?' on':'')+'" style="background:'+_bg
      +';box-shadow:inset 4px 0 0 '+(famOn?_col:pckTint(_col,.55))+'">'
      +'<button class="pgf-h" style="color:'+_ink+'" onclick="pckSetFam(\''+A.f.id+'\')" title="กรองเฉพาะ '+e(A.f.name)+'">'
        +'<span class="pgf-cv'+(op?' op':'')+'" onclick="event.stopPropagation();pckProgToggle(\''+A.f.id+'\')" title="'+(op?'พับ':'กางดู variant')+'">&#9656;</span>'
        +'<i style="background:'+(A.f.color||'#8b909c')+'"></i>'
        +'<span class="pgf-nm">'+e(A.f.name)+'</span>'
        +'<span class="pgf-px ck-mono">'+A.pax+'</span>'
        +(A.vord.length>1?('<span class="pgf-vn">'+live+' variant</span>'):'')
        +'<span class="pgf-sp"></span>'
        +((A.due||0)>0?('<span class="pgf-due" title="ค้างเก็บที่ท่า">&#3647;'+Math.round(A.due).toLocaleString()+'</span>'):'')
        +'<span class="pgf-st" style="background:'+st[1]+';color:'+st[2]+'">'+st[0]+'</span>'
      +'</button>'
      +'<div class="pgf-bar"><s style="width:'+bar+'%;background:'+(A.f.color||'#8b909c')+'"></s></div>';
    if(op){
      out+='<div class="pgf-vars">'+A.vord.map(function(rid){
        var V=A.v[rid], lbl=pckVarLbl(A.f, rid), dep=pckDepOf(rid)||'';
        var open=(typeof bkV2IsRouteOpenOn!=='function')||bkV2IsRouteOpenOn(rid,date);
        var _vbg=pckTint(_col,.965);
        if(!open) return '<div class="pgv off" style="background:'+_vbg+'" title="'+e(lbl)+' · ไม่ออกวันนี้">'
          +'<span class="pgv-nm">'+e(lbl)+'</span>'
          +(dep?('<span class="pgv-tm ck-mono">'+e(dep)+'</span>'):'')
          +'<span class="pgv-off">ไม่ออกวันนี้</span></div>';
        var von=(_pckRoute===rid);
        return '<button class="pgv'+(von?' on':'')+'" style="background:'
          +(von?pckTint(_col,.86):_vbg)+';border-left-color:'+(von?_col:pckTint(_col,.62))+'" '
          +'onclick="pckSetRoute(\''+rid+'\')" '
          +'title="'+e(lbl)+(dep?(' · ออก '+dep):'')+' · ขึ้นเรือแล้ว '+V.brd+' จาก '+V.pax+' คน · คลิกกรองเฉพาะทริปนี้">'
          +'<span class="pgv-nm">'+e(lbl)+'</span>'
          +(dep?('<span class="pgv-tm ck-mono">'+e(dep)+'</span>'):'')
          +'<span class="pgv-px ck-mono">'+V.pax+' pax</span>'
          +'<span class="pgv-z">'+pckZbox('PK',V.PK.d,V.PK.t)+pckZbox('KL',V.KL.d,V.KL.t)
             +pckZbox('มาเอง',0,V.OWN.t,true)+'</span>'
          +'</button>';
      }).join('')+'</div>';
    }
    return out+'</div>';
  }).join('');
  return h;
}
/* ชื่อของสิ่งที่กำลังกรองอยู่ · ใช้พาดหัวการ์ดเรือ */
/* ── §pckHead7 · สีกับชื่อของสิ่งที่กำลังกรองอยู่ ─────────────────────────
   เลือก variant = ใช้สีของเส้นทางนั้น (แต่ละ variant มีสีของตัวเองใน ROUTES)
   เลือกทั้งโปรแกรม = ใช้สีของโปรแกรม · ไม่ได้กรอง = ไม่มีสี พื้นหัวเป็นเทาตามเดิม */
/* §pckHead7b · สีเส้นทางบางเส้นอ่อนมาก (Phi Phi by Speedboat = #ff9999)
   เอาไป tint ต่ออีกทีจะได้เกือบขาว มองไม่ออกว่าพื้นเปลี่ยนสี · หรี่ลงก่อนถ้าสว่างเกิน */
function pckBandBase(c){
  var h=String(c||'').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h)) return '#8b909c';
  var r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  var L=(0.299*r+0.587*g+0.114*b)/255;
  return (L>0.60) ? pckShade('#'+h, 0.60/L) : ('#'+h);
}
function pckSelColor(){
  if(_pckRoute){
    var rt=(typeof getRoute==='function'?getRoute(_pckRoute):null)||{};
    if(rt.color) return rt.color;
    var f=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(_pckRoute):null;
    return (f&&f.color)||null;
  }
  if(_pckFam){
    var F=(typeof _BKV2_FAMILIES!=='undefined'?_BKV2_FAMILIES:[]).filter(function(x){ return x.id===_pckFam; })[0];
    return (F&&F.color)||null;
  }
  return null;
}
/* ชื่อที่ขึ้นกลางหัว · ไม่ได้กรองอะไร = ชื่อบริษัท · กรองอยู่ = ชื่อโปรแกรม (+ variant) */
function pckBrandTitle(date){
  if(!_pckFam && !_pckRoute) return 'LOVE ANDAMAN';
  var out='';
  pckProgData(date).forEach(function(A){
    if(_pckRoute && A.v[_pckRoute]) out=A.f.name+' \u00b7 '+pckVarLbl(A.f,_pckRoute);
    else if(!_pckRoute && _pckFam===A.f.id) out=A.f.name;
  });
  return out||'LOVE ANDAMAN';
}
/* ปุ่มล้างตัวกรองโปรแกรม · โผล่เฉพาะตอนกรองอยู่จริง */
function pckProgAllBtn(){
  if(!_pckFam && !_pckRoute) return '';
  return '<button class="pkh-allbtn" onclick="pckSetFam(null)" title="เลิกกรอง แสดงทุกโปรแกรม">'
    +'&#10005; ทุกโปรแกรม</button>';
}
function pckSelName(date){
  if(!_pckFam && !_pckRoute) return 'ทุกโปรแกรม';
  var list=pckProgData(date), out='';
  list.forEach(function(A){
    if(_pckRoute && A.v[_pckRoute]) out=A.f.name+' · '+pckVarLbl(A.f,_pckRoute);
    else if(!_pckRoute && _pckFam===A.f.id) out=A.f.name+' · ทุก variant';
  });
  return out||'ทุกโปรแกรม';
}

function pckFilterBar(all, cnt, nHidden, part){
  var e=ckEsc;
  var chip=function(on, label, fn, n, col){
    col=col||'#185FA5';
    return '<button onclick="'+fn+'" style="border:1.5px solid '+(on?col:'#E7E4DC')+';background:'+(on?(col+'14'):'#fff')+';color:'+(on?col:'#5F5E5A')+';border-radius:999px;padding:4px 11px;font-size:11.5px;font-weight:'+(on?'800':'600')+';cursor:pointer;font-family:inherit;white-space:nowrap">'+e(label)
      +(n!=null?'<span style="font-family:\'DM Mono\',monospace;margin-left:6px;color:'+(on?col:'#a5a49d')+'">'+n+'</span>':'')+'</button>';
  };
  var vans=Object.keys(cnt.van).sort(function(a,b){
    var A=(typeof vehGet==='function'?vehGet(a):null)||{}, B=(typeof vehGet==='function'?vehGet(b):null)||{};
    return String(A.name||a).localeCompare(String(B.name||b)); });
  var sel=function(id,val,fn,ph,list,nameFn){
    return '<select id="'+id+'" onchange="'+fn+'(this.value)" style="height:30px;font-size:11.5px;font-family:inherit;border:1.5px solid '+(val?'#185FA5':'#E7E4DC')+';border-radius:8px;padding:2px 8px;background:#fff;color:'+(val?'#0C447C':'#5F5E5A')+';font-weight:'+(val?'700':'600')+';max-width:190px">'
      +'<option value="">'+e(ph)+'</option>'
      +list.map(function(id2){ return '<option value="'+e(id2)+'" '+(val===id2?'selected':'')+'>'+e(nameFn(id2))+'</option>'; }).join('')+'</select>';
  };
  var arrOrder=['PK','KL','OWN','NOVAN'];
  var arrHtml=arrOrder.filter(function(k){ return cnt.arr[k]; }).map(function(k){
    return chip(_pckArr===k, PCK_ARR_LBL[k], "pckSetArr('"+k+"')", cnt.arr[k], k==='OWN'?'#6B289A':(k==='NOVAN'?'#A32D2D':'#185FA5'));
  }).join('');
  var statHtml=chip(_pckStat==='wait','ยังไม่ถึงท่า',"pckSetStat('wait')",cnt.stat.wait,'#5F5E5A')
    +chip(_pckStat==='arr','ถึงแล้ว · ยังไม่เคลียร์',"pckSetStat('arr')",cnt.stat.arr,'#0C447C')
    +chip(_pckStat==='clr','เคลียร์แล้ว · รอขึ้นเรือ',"pckSetStat('clr')",cnt.stat.clr,'#7A4A00')
    +chip(_pckStat==='on','ขึ้นเรือแล้ว',"pckSetStat('on')",cnt.stat.on,'#0F6E56')
    +'<span class="ck-fsep"></span>'
    +chip(_pckStat==='due','ค้างจ่าย',"pckSetStat('due')",cnt.stat.due,'#7A4A00')
    +(cnt.stat.ns?chip(_pckStat==='ns','No-show / CXL',"pckSetStat('ns')",cnt.stat.ns,'#A32D2D'):'')
    +(cnt.stat.vd?chip(_pckStat==='vd','ยกเลิกหน้างาน · ปิดแล้ว',"pckSetStat('vd')",cnt.stat.vd,'#8a8a82'):'');
  var any=(_pckBoat||_pckVan||_pckArr||_pckStat||_pckQ);
  /* §pckHead2 · part='search' เอาแค่ช่องค้นหา+เลือกคัน · part='chips' เอาแค่ตัวกรอง
     ไม่ส่ง part มา = ได้ทั้งแถบเหมือนเดิม (ของเดิมที่ไหนเรียกอยู่ก็ยังได้เท่าเดิม) */
  var _q='<input id="pck-q" value="'+e(_pckQ)+'" oninput="pckSetQ(this.value)" placeholder="&#128269; voucher / ชื่อ / เบอร์ / โรงแรม" style="height:30px;font-size:11.5px;font-family:inherit;border:1.5px solid '+(_pckQ?'#185FA5':'#E7E4DC')+';border-radius:8px;padding:2px 10px;background:#fff;min-width:210px;flex:1">'
    +sel('pck-van',_pckVan,'pckSetVan','\u{1F68C} ทุกคัน',vans,function(id){ var v=(typeof vehGet==='function'?vehGet(id):null)||{}; return (v.name||id)+' ('+cnt.van[id]+')'; });
  if(part==='search') return '<div class="ck-fbar pck-fsearch">'+_q+'</div>';
  if(part==='chips')  return '<div class="ck-fbar pck-fchips">'+arrHtml
    +(arrHtml?'<span class="ck-fsep"></span>':'')+statHtml
    +pckFilterTail(any, nHidden)+'</div>';
  return '<div class="ck-fbar">'
    +_q
    +'<span class="ck-fsep"></span>'+arrHtml
    +'<span class="ck-fsep"></span>'+statHtml
    +'<button onclick="pckSvcSetOpen()" title="ตั้งสีช่อง Service / ป้ายภาษาไกด์ ในใบงานไกด์" style="margin-left:auto;border:1.5px solid #E7E4DC;background:#fff;color:#8a8a82;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">&#127912; สี Service</button>'
    +'<button onclick="pckToggleBy()" class="pck-bytog2" title="'+(_pckShowBy?'ซ่อนผู้บันทึก booking':'แสดงผู้บันทึก booking ในแต่ละแถว')+'" style="margin-left:auto;border:1.5px solid '+(_pckShowBy?'#185FA5':'#E7E4DC')+';background:'+(_pckShowBy?'#F2F8FE':'#fff')+';color:'+(_pckShowBy?'#0C447C':'#8a8a82')+';border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">ผู้บันทึก</button>'
    +pckFilterTail(any, nHidden)
    +'</div>';
}
/* ปุ่มท้ายแถบตัวกรอง · สี Service / ผู้บันทึก / ล้างตัวกรอง · ใช้ร่วมกันทั้งแบบเต็มและแบบแยกส่วน */
function pckFilterTail(any, nHidden){
  return '<button onclick="pckSvcSetOpen()" title="ตั้งสีช่อง Service / ป้ายภาษาไกด์ ในใบงานไกด์" style="margin-left:auto;border:1.5px solid #E7E4DC;background:#fff;color:#8a8a82;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">&#127912; สี Service</button>'
    +'<button onclick="pckToggleBy()" class="pck-bytog2" title="'+(_pckShowBy?'ซ่อนผู้บันทึก booking':'แสดงผู้บันทึก booking ในแต่ละแถว')+'" style="border:1.5px solid '+(_pckShowBy?'#185FA5':'#E7E4DC')+';background:'+(_pckShowBy?'#F2F8FE':'#fff')+';color:'+(_pckShowBy?'#0C447C':'#8a8a82')+';border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">ผู้บันทึก</button>'
    +(any?'<button onclick="pckClearFilters()" style="border:1px solid #E6C9C3;background:#fff;color:#A32D2D;border-radius:8px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">&#10005; ล้างตัวกรอง'+(nHidden>0?(' · ซ่อน '+nHidden):'')+'</button>':'');
}

// §pierDetail · แผงรายละเอียดครบทุกอย่างของ booking หนึ่งใบ · หน้าท่าใช้ตรวจ ลค ก่อนปล่อยขึ้นเรือ
function pckDetailClose(){ var el=document.getElementById('pck-drawer'); if(el) el.remove(); }
function pckDetailOpen(bkId){
  var e=ckEsc, date=_pckDate;
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  var t=ckTripOn(b,date); if(!t) return;
  var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
  var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  var rt=(typeof getRoute==='function'?getRoute(t.routeId):null)||{};
  var veh=O.vanId?((typeof vehGet==='function'?vehGet(O.vanId):null)||{}):null;
  var drv=(O.vanId&&typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(O.vanId,date):null;
  var boat=(O.boatId||t.charterBoatId)?((typeof getBoat==='function'?getBoat(O.boatId||t.charterBoatId):null)||{}):null;
  var pb=ckPaxBreak(t.pax), P=t.pax||{};
  var M=pckMoney(b,date);
  var vck=O.vanCheckin||null, pck=O.pierCheckin||null;
  var m=function(n){ return '฿'+pckNum(n); };
  var pArea=(b.pickupAreaId&&typeof bkV2GetArea==='function')?((bkV2GetArea(b.pickupAreaId)||{}).name||''):'';
  var sreq=(typeof vanJobsSreqFinal==='function')?(vanJobsSreqFinal(b)||''):((b.notes||'').trim());
  var row=function(k,v){ return v?('<div class="pd-r"><span class="pd-k">'+e(k)+'</span><span class="pd-v">'+v+'</span></div>'):''; };
  var sec=function(title,inner){ return inner?('<div class="pd-sec"><div class="pd-h">'+e(title)+'</div>'+inner+'</div>'):''; };
  var natLine=function(k,lbl){
    var fr=+(P[k+'_fr']||0), th=+(P[k+'_th']||0), plain=+(P[k]||0);
    var tot=fr+th+plain; if(!tot) return '';
    var d=[]; if(th) d.push('ไทย '+th); if(fr) d.push('ต่างชาติ '+fr); if(plain) d.push('ไม่ระบุ '+plain);
    return '<div class="pd-r"><span class="pd-k">'+e(lbl)+'</span><span class="pd-v"><b style="font-family:\'DM Mono\',monospace;font-size:14px">'+tot+'</b>'
      +(d.length>1||plain?'<span style="color:#8a8a82;font-size:11px;margin-left:8px">'+e(d.join(' · '))+'</span>':'')+'</span></div>';
  };
  var ckLine=function(c,lbl,expect){
    if(!c||!c.at) return '<div class="pd-r"><span class="pd-k">'+e(lbl)+'</span><span class="pd-v" style="color:#a5a49d">ยังไม่เช็คอิน</span></div>';
    var act=(c.actualPax!=null?c.actualPax:expect), ns=Math.max(0,expect-act);
    var over=Math.max(0,act-expect);                       /* §ckPierSelf2 · ตามมาเองที่ท่า */
    return '<div class="pd-r"><span class="pd-k">'+e(lbl)+'</span><span class="pd-v"><b style="color:'+(ns?'#A32D2D':'#0F6E56')+';font-family:\'DM Mono\',monospace;font-size:14px">'+act+'</b><span style="color:#8a8a82;font-size:11px"> / '+expect+'</span>'
      +(ns?'<span class="ck-ns" style="margin-left:8px">หาย '+ns+'</span>':'')
      +(over?('<span style="margin-left:8px;font-size:10.5px;font-weight:700;color:#0F6E56;background:#E1F5EE;'
              +'border:1px solid #B7E2D2;border-radius:7px;padding:1px 7px" '
              +'title="ไม่ได้ขึ้นรถมา แต่มาถึงท่าเอง">&#8617; ตามมาเอง +'+over+'</span>'):'')
      +'<div style="font-size:10px;color:#a5a49d;margin-top:2px">'+e((c.by||'')+(c.at?(' · '+String(c.at).slice(0,16).replace('T',' ')):''))+'</div>'
      +((c.events||[]).map(function(x){ var T=(CK_EVENT_TYPES[x.type]||CK_EVENT_TYPES.no_show);
          /* §ckBack · รายการที่รับกลับแล้วยังต้องเห็น · ขีดฆ่าไว้พร้อมบอกว่าเพราะอะไร */
          var U=x.undone||null;
          return '<div style="font-size:10.5px;margin-top:3px;color:'+(U?'#a9a7a0':T.color)+'">'
            +'<span'+(U?' style="text-decoration:line-through"':'')+'>'+T.label+' '+x.pax+' · '
            +e(ckReasonLabel(x.reasonCode)+(x.note?(' · '+x.note):''))+'</span>'
            +(U?(' <b style="color:'+(U.why==='mistake'?'#6B289A':'#0F6E56')+'">'
                 +(U.why==='mistake'?'กดผิด':'รับกลับแล้ว')+' '+e(U.at||'')+(U.by?(' · '+e(U.by)):'')+'</b>'):'')
            +'</div>'; }).join(''))
      +'</span></div>';
  };
  var exHtml=M.extras.map(function(x){ var _g=(typeof bkxExGot==='function')?bkxExGot(x):true;
    return '<div class="pd-r"><span class="pd-k">'+e(x.service)+(x.qty>1?(' ×'+x.qty):'')+'</span><span class="pd-v" style="font-family:\'DM Mono\',monospace">'+m(x.total)
    +(_g?'<span style="color:#0F6E56;font-size:10.5px;margin-left:8px">&#10003; เก็บแล้ว</span>'
        :'<span style="color:#9A5B00;font-size:10.5px;margin-left:8px">รอเก็บ</span>')
    +(x.seller?('<span style="color:#854F0B;font-size:10.5px;margin-left:8px">'+e(x.seller)+'</span>'):'')+'</span></div>'; }).join('');
  var upHtml=M.upgrades.map(function(u){ return '<div class="pd-r"><span class="pd-k">'+e(u.label)+'</span><span class="pd-v" style="font-family:\'DM Mono\',monospace">'+m(u.sellPrice)+(u.collected?'<span style="color:#0F6E56;font-size:10.5px;margin-left:8px">&#10003; เก็บแล้ว</span>':'<span style="color:#9A5B00;font-size:10.5px;margin-left:8px">รอเก็บ</span>')+'</span></div>'; }).join('');
  var phone=b.leadPhone||b.phone||'';
  var old=document.getElementById('pck-drawer'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='pck-drawer';
  ov.innerHTML='<div class="pd-scrim" onclick="pckDetailClose()"></div><div class="pd-panel">'
    +'<div class="pd-top"><div><div style="font-size:15px;font-weight:800;color:#15396B">'+e(b.voucherRef||b.code||'—')+'</div>'
      +'<div style="font-size:11px;color:#8a8a82;margin-top:2px">'+e(rt.name||t.routeId||'')+' · '+e(date)+'</div></div>'
      +'<button onclick="pckDetailClose()" style="background:transparent;border:none;font-size:19px;color:#8a8a82;cursor:pointer;padding:2px 6px;line-height:1">&#10005;</button></div>'
    +'<div class="pd-body">'
    +sec('ลูกค้า',
        row('ชื่อผู้นำกลุ่ม','<b style="font-size:13px">'+e(b.leadPax||'—')+'</b>')
       +row('โทร',phone?('<a class="ck-tel" href="tel:'+e(String(phone).split(/[,;\/]/)[0].replace(/[^0-9+]/g,''))+'">'+e(phone)+'</a>'):'')
       +row('อีเมล',b.leadEmail?e(b.leadEmail):'')
       +row('สัญชาติ',b.leadNationality?e(b.leadNationality):'')
       +row('โรงแรม',e(b.hotelName||b.pickup||'—'))
       +row('ห้อง',(b.roomNo||b.room||b.roomNumber)?e(b.roomNo||b.room||b.roomNumber):'')
       +row('จุดรับ',pArea?e(pArea):''))
    +sec('ผู้โดยสาร', natLine('ad','ผู้ใหญ่')+natLine('chd','เด็ก')+natLine('inf','ทารก')
       +(pb.foc?row('FOC','<b style="font-family:\'DM Mono\',monospace;font-size:14px">'+pb.foc+'</b>'):'')
       +row('รวมที่จอง','<b style="font-family:\'DM Mono\',monospace;font-size:15px">'+(pb.ad+pb.chd+pb.inf+pb.foc)+'</b>'))
    +sec('การจอง',
        row('เอเย่นต์',e(ag?(ag.name||ag.code):(b.channel||'walk-in')))
       +row('การชำระ',ag?e({invoice:'Invoice (เครดิต)',proforma:'Pro Forma',cot:'Cash on Tour'}[ag.payType]||ag.payType||'—'):'')
       +row('ผู้บันทึก',b.createdBy?e(b.createdBy):'')
       +row('วันที่จอง',b.bookingDate?e(b.bookingDate):'')
       +row('Special request',sreq?('<span style="color:#7A4A00">'+e(sreq)+'</span>'):''))
    +sec('การเดินทาง',
        row('เวลารับ','<b style="font-family:\'DM Mono\',monospace">'+e(O.pickupTimeFinal||t.pickupTime||'—')+'</b>')
       +row('รถ',veh?(e(veh.name||O.vanId)+(drv&&drv.driver?('<div style="font-size:11px;color:#8a8a82;margin-top:2px">'+e(drv.driver)+(drv.phone?(' · '+e(drv.phone)):'')+(drv.plate?(' · '+e(drv.plate)):'')+'</div>'):'')):'<span style="color:#6B289A;font-weight:700">มาเอง / รถเอเย่นต์</span>')
       +ckLine(vck,'เช็คอินรถ',ckBookedPax(t))
       +row('เรือ',boat?('<b>'+e(boat.name||'')+'</b>'+(boat.cap||boat.licensePax?('<span style="color:#8a8a82;font-size:11px;margin-left:8px">cap '+(boat.cap||boat.licensePax)+'</span>'):'')):'<span style="color:#A32D2D;font-weight:700">ยังไม่จัดเรือ</span>')
       +(function(){ var st=pckStage(pck), rk=pckStageRank(st);
           var stp=function(S,i,when,who){ var done=rk>=i;
             return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="width:15px;height:15px;border-radius:50%;flex:none;background:'+(done?S.col:'#EDEAE2')+';color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center">'+(done?'&#10003;':'')+'</span>'
               +'<span style="font-size:12px;color:'+(done?'#2f2f2b':'#a5a49d')+';font-weight:'+(done?'700':'500')+'">'+S.lbl+'</span>'
               +(done&&when?'<span style="font-size:10.5px;color:#8a8a82;font-family:monospace">'+pckHHMM(when)+'</span>':'')
               +(done&&who?'<span style="font-size:10.5px;color:#a5a49d">'+ckEsc(who)+'</span>':'')+'</div>'; };
           return '<div class="pd-r"><span class="pd-k">ขั้นตอนหน้าท่า</span><span class="pd-v">'
             +stp(PCK_STAGES[0],1,pck&&pck.arrivedAt,pck&&pck.arrivedBy)
             +stp(PCK_STAGES[1],2,pck&&pck.clearedAt,pck&&pck.clearedBy)
             +stp(PCK_STAGES[2],3,pck&&pck.at,pck&&pck.by)+'</span></div>'; })()
       +ckLine(pck,'เช็คอินหน้าท่า',pckExpected(b,date,ckBookedPax(t))))
    +(function(){ var L=ckAddonList(b,t.routeId);
        var rows2=L.map(function(a){ return row(a.kind==='longtail'?'หางยาว':'Add-on','<b>'+e(a.label)+'</b>'+(a.note?('<div style="font-size:10.5px;color:#8a8a82;margin-top:2px">&#128221; '+e(a.note)+'</div>'):'')); }).join('');
        return sec('Add-on ที่จองมา', rows2 || row('—','<span style="color:#a5a49d">ไม่มี</span>')); })()
    +sec('เงิน',
        (M.cot>0?row('Cash on Tour','<b style="font-family:\'DM Mono\',monospace;font-size:14px;color:#7A4A00">'+m(M.cot)+'</b>'+(M.handling==='deduct'?'<span style="font-size:10.5px;color:#8a8a82;margin-left:8px">หักจากบิล</span>':'')+(M.note?('<div style="font-size:10.5px;color:#8a8a82;margin-top:2px">'+e(M.note)+'</div>'):'')):'')
       +(M.balance>0?row('ยอดค้าง (B2C)','<b style="font-family:\'DM Mono\',monospace;color:#7A4A00">'+m(M.balance)+'</b>'):'')
       +upHtml+exHtml
       +'<div class="pd-r" style="border-top:1px solid #EDEAE2;margin-top:6px;padding-top:8px"><span class="pd-k" style="font-weight:800">ต้องเก็บหน้าท่า</span><span class="pd-v"><b style="font-family:\'DM Mono\',monospace;font-size:16px;color:'+(M.due>0?'#7A4A00':'#0F6E56')+'">'+m(M.due)+'</b></span></div>'
       +(M.got>0?'<div class="pd-r"><span class="pd-k">เก็บไปแล้วหน้างาน</span><span class="pd-v" style="color:#0F6E56;font-family:\'DM Mono\',monospace;font-weight:700">'+m(M.got)+'</span></div>':''))
    +'</div>'
    +'<div class="pd-foot">'
      +'<button onclick="bkV2ExtraAdd(\''+b.id+'\')" class="pd-btn">+ ขายเพิ่มหน้างาน</button>'
      +'<button onclick="bkV2UpgradeOpen(\''+b.id+'\')" class="pd-btn">&#11014; อัปเกรด</button>'
      +'<button onclick="pckDetailClose()" class="pd-btn pd-btn-p">ปิด</button>'
    +'</div></div>';
  document.body.appendChild(ov);
}
/* §pckTrim · กางชื่อแล้วแถวที่กดต้องอยู่ตรงเดิมบนจอ
   คืนค่า scrollTop ดิบ ๆ ยังไม่พอ · ความสูงของเนื้อในกล่องเปลี่ยนไปตอนกางหรือย่อ
   ถ้ากำลังดูแถวท้าย ๆ ที่เลื่อนสุดอยู่ พอย่อแล้วเนื้อสั้นลง เบราว์เซอร์จะบีบ scrollTop ลงเอง
   = แถวที่เพิ่งกดกระโดดหนีตา (เจอกับใบท้ายกลุ่ม เช่น EXC31416)
   → จับระยะจากขอบบนกล่องถึงแถวนั้นไว้ แล้วเลื่อนชดเชยให้เท่าเดิมหลังวาดใหม่ */
function _pckRowTop(id){
  var w=document.querySelector('.pck-host .pcs-tw');
  var el=w&&w.querySelector('td.pcs-nm[data-bk="'+id+'"]');
  if(!w||!el) return null;
  return {w:w, off:el.getBoundingClientRect().top-w.getBoundingClientRect().top};
}
function pckNamesToggle(id){
  var a=_pckRowTop(id);
  if(_pckOpenNames[id]) delete _pckOpenNames[id]; else _pckOpenNames[id]=1;
  renderPierCheckin();
  if(!a) return;
  var fix=function(){
    var b=_pckRowTop(id);
    if(b && Math.abs(b.off-a.off)>0.5) b.w.scrollTop += (b.off-a.off);
  };
  fix();
  if(window.requestAnimationFrame) requestAnimationFrame(fix);
}
// §localTime (2026-07-30) · เวลาเช็คอินเก็บเป็น ISO ซึ่งเป็น UTC เสมอ (new Date().toISOString())
// การตัด slice(11,16) จึงได้เวลา UTC ดิบ → หน้าท่าเห็น "01:29" ทั้งที่กดตอน 08:29 (ช้าไป 7 ชม.)
// ต้องแปลงผ่าน Date ให้เป็นเวลาเครื่องก่อนเสมอ · รองรับค่าที่เก็บมาเป็น HH:MM อยู่แล้วด้วย
function pckHHMM(iso){
  if(!iso) return '';
  var s=String(iso);
  if(/^\d{1,2}:\d{2}$/.test(s)) return s;                 // เก็บมาเป็น HH:MM อยู่แล้ว (เช่น reasonAt ที่พิมพ์เอง)
  var d=new Date(s);
  if(isNaN(d.getTime())) return s.slice(11,16);            // parse ไม่ได้ → คืนของเดิม ดีกว่าคืนค่าว่าง
  return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
}
function pckBoatName(id){ var b=(typeof getBoat==='function'?getBoat(id):null)||{}; return b.name||id||'—'; }
function pckBoatColor(id){
  var b=(typeof getBoat==='function'?getBoat(id):null)||{};
  var bc=(typeof getBoatColor==='function')?getBoatColor(id):null;
  return b.color||(bc&&bc.text&&bc.text!=='#666'?bc.text:'')||'#185FA5';
}
function pckVanName(id){ var v=(typeof vehGet==='function'?vehGet(id):null)||{}; return v.name||id||''; }
// เวลาออกอยู่ที่ระดับเส้นทาง (route.times) ไม่ใช่ที่เรือ · เรือหลายลำในทริปเดียวกันจึงออกเวลาเดียวกัน
function pckDepOf(rid){ var rt=(typeof getRoute==='function'?getRoute(rid):null)||{}; return (rt.times&&rt.times[0])||''; }
// ตัวย่อบนการ์ดเรือ · Aluminous2 → A2 · Oceanus → OC
function pckBoatMark(nm){
  nm=String(nm||'').trim(); if(!nm) return '?';
  var m=nm.match(/(\d+)\s*$/);
  if(m){ var base=nm.replace(/(\d+)\s*$/,'').trim(); return ((base.slice(0,1)||'?').toUpperCase()+m[1].slice(-1)); }
  return nm.slice(0,2).toUpperCase();
}
function pckZoneColor(k){
  if(k==='OWN') return '#6B289A';
  if(k==='NOVAN') return '#A32D2D';
  return (typeof bkV2ZoneColor==='function')?bkV2ZoneColor(k):'#185FA5';
}
function pckZoneLabel(k){
  if(k==='OWN') return 'Own TF';
  if(k==='NOVAN') return 'ยังไม่จัดรถ';
  return (typeof bkV2ZoneLabel==='function')?bkV2ZoneLabel(k):k;
}
function pckZoneSub(k){
  if(k==='OWN') return 'มาเอง / รถเอเย่นต์ส่งเอง — ไม่มีรถของเรา';
  if(k==='NOVAN') return 'อยู่ในโซนที่ต้องมีรถ แต่ยังไม่ได้จัด';
  return (PCK_ARR_LBL[k]||'')+' · รถของเรารับ';
}
// §boatSplit · บุคกิ้งที่แยกลงหลายลำ → กาง 1 แถวต่อลำ · แถวที่ 2 เป็นต้นไปยอดเงินเป็น 0
//   (เงินเป็นของ "ใบ" ไม่ใช่ของ "ลำ" · ถ้าไม่ล้างจะถูกนับซ้ำในยอดรวมหัวตาราง)
//   คนที่ไม่มา (CXL/No-show) หักจากลำแรกก่อน แล้วไหลไปลำถัดไป — ผลรวมจึงตรงกับใบเสมอ
function pckExpandBoatSplits(row, b, date, out){
  var sp=(typeof bkBoatSplits==='function')?bkBoatSplits(b,date):null;
  if(!sp || sp.length<2){ out.push(row); return out; }
  var lostLeft=Math.max(0, (row.booked||0)-(row.expect!=null?row.expect:row.booked));
  sp.forEach(function(x,i){
    var r2={}; Object.keys(row).forEach(function(k){ r2[k]=row[k]; });
    var pb=bkSplitPax(x), np=bkPaxSum(pb);
    var take=Math.min(lostLeft, np); lostLeft-=take;
    r2.bid=x.boatId||''; r2.bsIdx=i; r2.bsN=sp.length; r2.bsPaxBd=pb;
    r2.booked=np; r2.expect=Math.max(0,np-take);
    if(i>0 && r2.money) r2.money=Object.assign({}, r2.money, {due:0, got:0, noSlip:0, pierFee:0, pierPaid:0});
    out.push(r2);
  });
  return out;
}
/* §pckSplit · รับหลายจุด = คนละรถ คนละที่ · หน้าท่าต้องเห็นทีละจุดว่าใครมาถึงแล้ว
   เงินอยู่กับแถวแรกแถวเดียว (เหมือน pckExpandBoatSplits) ไม่งั้นยอดค้างถูกนับซ้ำ
   สถานะ ถึงท่า/เคลียร์/ขึ้นเรือ อ่านจาก ops.pierCkS[i] ของจุดนั้น */
function pckExpandVanSplits(row, b, date, out){
  var O=row.O||{};
  var sp=Array.isArray(O.vanSplits)?O.vanSplits.filter(Boolean):null;
  if(!sp || sp.length<2){ out.push(row); return out; }
  var lostLeft=Math.max(0, (row.booked||0)-(row.expect!=null?row.expect:row.booked));
  sp.forEach(function(x,i){
    var r2={}; Object.keys(row).forEach(function(k){ r2[k]=row[k]; });
    var pb={ad:+x.ad||0, chd:+x.chd||0, inf:+x.inf||0, foc:+x.foc||0};
    var np=(typeof bkPaxSum==='function')?bkPaxSum(pb):0;
    if(!np) np=Math.max(0,+x.pax||0);
    var take=Math.min(lostLeft, np); lostLeft-=take;
    r2.vsIdx=i; r2.vsN=sp.length; r2.vsPaxBd=pb; r2.vsp=x;
    r2.booked=np; r2.expect=Math.max(0,np-take);
    r2.vanId=x.vanId||'';
    r2.ck=ckSlotGet(O,'pier',i);
    r2._ckKind='pier#'+i;
    if(!x.main){
      var ar=(x.pickAreaId && typeof bkV2GetArea==='function')?(bkV2GetArea(x.pickAreaId)||{}):{};
      r2._pickHotel=(x.pickHotel||'').trim()||ar.name||'';
      r2._pickArea=ar.name||'';
      r2._pickWho=(x.altWho||'').trim();
    }
    r2.arr=pckArrivalOf(r2);
    if(i>0 && r2.money) r2.money=Object.assign({}, r2.money, {due:0, got:0, noSlip:0, pierFee:0, pierPaid:0});
    out.push(r2);
  });
  return out;
}
function pckAgg(rows){
  // §pckCountPax · arrP/clrP/onP = รายคน · arr/clr/on = รายใบ (เก็บไว้ให้ tooltip)
  var a={n:0, pax:0, arr:0, clr:0, on:0, arrP:0, clrP:0, onP:0, due:0, ns:0, vd:0, sx:0};
  rows.forEach(function(r){
    if(r.strand){ a.sx++; return; }   /* §strandPck · ค้างจัดการ · นับแยก ไม่เข้ายอดใด */
    if(r._vd){ if(r.money && r.money.due>0) a.due+=r.money.due; a.vd++; return; }   // §onsiteVoid · ปิดรายการแล้ว ไม่นับใน ถึงท่า/เคลียร์/ขึ้นเรือ/ที่นั่ง · เงินค้างยังนับ
    a.n++;
    var _px=(r.expect!=null?r.expect:r.booked);
    a.pax+=_px;
    var s=pckStage(r.ck), k=pckStageRank(s);
    if(k>=1) a.arrP+=_px; if(k>=2) a.clrP+=_px; if(k>=3) a.onP+=_px;
    if(k>=1) a.arr++; if(k>=2) a.clr++; if(k>=3) a.on++;
    if(r.money && r.money.due>0 && s!=='on') a.due+=r.money.due;
    if(r.ck && r.ck.at) a.ns+=(r.ck.noShow||0);
  });
  return a;
}
function pckCardCSS(scope){ return ''
  +scope+' .pck-boat{border-radius:22px;margin-bottom:18px;overflow:hidden;padding-bottom:12px;box-shadow:0 10px 30px -6px rgba(15,23,42,.10),0 3px 10px -3px rgba(15,23,42,.06)}'
  +scope+' .pck-bband{padding:14px 18px 13px;display:flex;align-items:center;gap:13px;flex-wrap:wrap}'
  +scope+' .pck-bmark{width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;font-family:\'DM Mono\',monospace;flex:none}'
  +scope+' .pck-bname{font-size:19px;font-weight:800;line-height:1.1;letter-spacing:-.2px}'
  +scope+' .pck-brt{display:flex;align-items:center;gap:8px;margin-top:7px;flex-wrap:wrap}'
  +scope+' .pck-rchip{background:#fff;border-radius:999px;padding:5px 14px 5px 11px;font-size:14px;font-weight:800;line-height:1.15;display:inline-flex;align-items:center;gap:8px;box-shadow:0 1px 4px rgba(0,0,0,.18);white-space:nowrap;max-width:560px;overflow:hidden}'
  +scope+' .pck-rchip i{width:11px;height:11px;border-radius:50%;flex:none}'
  +scope+' .pck-rdep{font-family:\'DM Mono\',monospace;font-size:13.5px;font-weight:800;padding:4px 13px;border-radius:999px;color:#fff;border:1.5px solid rgba(255,255,255,.9);white-space:nowrap}'
  +scope+' .pck-bstat{display:flex;gap:7px;margin-left:auto;flex-wrap:wrap}'
  +scope+' .pck-bchip{border-radius:12px;padding:6px 13px;text-align:center;min-width:80px}'
  +scope+' .pck-bchip .k{display:block;font-size:10px;opacity:.85;white-space:nowrap}'
  +scope+' .pck-bchip .v{font-family:\'DM Mono\',monospace;font-size:16px;font-weight:800;white-space:nowrap}'
  +scope+' .pck-bbody{padding:0 12px;display:flex;flex-direction:column;gap:12px}'
  // §pierDrop · จุดส่งไม่ตรงจุดรับ = ของที่ต้องบอกคนขับรถกลับ
  +scope+' .pck-drop{display:inline-block;margin-top:5px;background:#FFF6E5;border:1px solid #EAD9B0;color:#633806;'
        +'border-radius:7px;padding:2px 8px;font-size:10.5px;font-weight:700;line-height:1.35;max-width:230px;overflow-wrap:break-word}'
  +scope+' .pck-drop.self{background:#F5F4F0;border-color:#E0DDD4;color:#7a7972;font-weight:600}'
  // §pierMeal · อาหารพิเศษ · ป้าย + ปุ่มแก้หน้างาน
  +scope+' .pck-mcell{display:flex;flex-wrap:wrap;gap:4px;align-items:center}'
  // §pierNote · โน้ตหน้างาน · กินเต็มบรรทัดใต้ป้าย จะได้อ่านออกโดยไม่ต้องชี้เมาส์
  +scope+' .pck-note{flex:1 0 100%;background:#FFF8E6;border:1px solid #EEDFAE;border-radius:7px;padding:3px 8px;'
    +'font-size:10.5px;font-weight:600;color:#7A4A00;line-height:1.45;margin-top:2px}'
  +scope+' .pck-mbtn.note.on{border-style:solid;border-color:#EEDFAE;background:#FFF8E6;color:#7A4A00}'
  +scope+' .pck-mchip{display:inline-block;border:1px solid;border-radius:7px;padding:2px 7px;font-size:10px;font-weight:700;white-space:nowrap}'
  +scope+' .pck-mchip.pier{background:#FFF6E5;border-color:#EAD9B0;color:#8a5a12}'
  // §pierGuide · ป้ายภาษาไกด์รายใบ · ไม่ตั้งสีก็เป็นม่วงกลาง ๆ ชุดเดียวกับป้ายไกด์ที่อื่นในระบบ
  +scope+' .pck-gchip{display:inline-block;border:1px solid #D9CFF2;background:#F1ECFB;color:#4A2E86;'
        +'border-radius:7px;padding:2px 7px;font-size:10px;font-weight:800;white-space:nowrap}'
  // EN อย่างเดียวคือค่าปกติของเกือบทุกใบ · ทำให้จาง ตาจะได้ไปหยุดที่ใบที่ต้องจัดไกด์ภาษาอื่น
  +scope+' .pck-gchip.en{background:#F6F5F1;border-color:#E4E1D9;color:#8f8e86;font-weight:700}'
  +scope+' .pck-mbtn{border:1px dashed #D8D4CA;background:#fff;color:#8a8a82;border-radius:7px;padding:2px 8px;'
        +'font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +scope+' .pck-mbtn:hover{border-color:#0F6E56;color:#0F6E56;background:#F2FAF7}'

  +scope+' .pck-rvoid{background:#FAF9F6}'
  +scope+' .pck-rvoid td{opacity:.66}'
  +scope+' .pck-void{display:flex;flex-direction:column;gap:2px;font-size:10.5px;color:#8a8a82;line-height:1.3}'
  +scope+' .pck-void b{font-size:11px;font-weight:800;color:#A32D2D}'
  +scope+' .pck-void .w{font-family:\'DM Mono\',monospace;font-size:9.5px;color:#a5a49d}'
  +scope+' .pck-vdchip{display:inline-block;background:#FBE9E9;color:#A32D2D;border:1px solid #F0C9C9;border-radius:999px;padding:5px 12px;font-size:10.5px;font-weight:800;white-space:nowrap}'
  +scope+' .pck-undo{border:1px solid #D8D4CA;background:#fff;color:#5F5E5A;border-radius:999px;padding:5px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +scope+' .pck-jobbtn{align-self:center;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.42);color:inherit;border-radius:12px;padding:9px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +scope+' .pck-jobbtn:hover{background:rgba(255,255,255,.30)}'
  +scope+' .pck-svcset{margin-left:auto;background:#fff;border:1.5px solid #D8D4CA;color:#5F5E5A;border-radius:999px;padding:6px 13px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +scope+' .pck-svcset:hover{border-color:#2f2f2b;color:#2f2f2b}'
  +scope+' .pck-svcprev{display:inline-block;border:1.5px solid #111827;border-radius:3px;padding:1px 8px;font-size:10.5px;font-weight:700;white-space:nowrap}'
  +' .lg{display:inline-block;border:1.5px solid #111827;border-radius:3px;padding:0 6px;font-family:\'DM Mono\',monospace;font-size:11px;font-weight:700;white-space:nowrap;line-height:1.6}'
  +' .lg.alt{background:#111827;color:#fff}'
  // §pckJobIcon · เหลือแค่ไอคอน · ชื่อเต็มอยู่ tooltip · แยกด้วยสี
  +scope+' .pck-joball{margin-left:auto;width:32px;height:32px;padding:0;flex:none;display:inline-flex;align-items:center;justify-content:center;'
    +'background:#2f2f2b;border:1.5px solid #2f2f2b;color:#fff;border-radius:50%;font-size:14px;line-height:1;cursor:pointer;font-family:inherit}'
  +scope+' .pck-joball:hover{filter:brightness(1.15)}'
  // §guideOrder · ใบสั่งงานมัคคุเทศก์ · เขียว แยกจากใบงานไกด์ไม่ให้กดผิดใบ
  +scope+' .pck-joball.go{margin-left:7px;background:#0F6E56;border-color:#0F6E56}'
  +scope+' .pck-joball.go2{margin-left:5px;background:#fff;border-color:#E7E4DC;color:#5F5E5A;font-size:13px}'
  // §kitPop · ครัว · ม่วงชุดเดียวกับป้ายร้านอาหารและยอดเงินในการ์ด
  // §travelReg · ใบยื่นเจ้าท่า · น้ำเงินราชการ แยกจากใบงานไกด์ดำและใบสั่งงานเขียว
  +scope+' .pck-joball.reg{margin-left:7px;background:#1E5FA8;border-color:#1E5FA8}'
  +scope+' .pck-joball.reg:hover{background:#174B85;border-color:#174B85}'
  +scope+' .pck-joball.kit{margin-left:7px;background:#5B289A;border-color:#5B289A;position:relative;overflow:visible}'
  +scope+' .pck-joball.kit:hover{background:#4A1F80;border-color:#4A1F80}'
  +scope+' .pck-joball .dot{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;'
    +'border-radius:999px;background:#B4560A;color:#fff;font:800 9.5px/16px inherit;text-align:center;'
    +'border:2px solid #fff;box-sizing:content-box}'
  +scope+' .pck-jobbtn + .pck-jobbtn{margin-left:6px}'
  +scope+' .pck-jobbtn.go b{font-size:9px;vertical-align:2px}'
  +scope+' .pck-joball:hover{background:#15201a;border-color:#15201a}'
  // แถบสรุปเที่ยวนี้ · พื้นขาวชุดเดียวกับการ์ดโซนข้างล่าง เว้นขอบเท่ากัน สีเรือจึงยังครอบเป็นกรอบ
  +scope+' .pck-bmeta{background:#fff;border-radius:15px;margin:0 12px 12px;padding:11px 15px;display:flex;flex-wrap:wrap;align-items:center;row-gap:9px}'
  +scope+' .pck-mg{display:flex;align-items:baseline;gap:9px;padding-right:20px;margin-right:20px;border-right:1px solid #E7E4DC}'
  +scope+' .pck-mg:last-child{border-right:none;margin-right:0;padding-right:0}'
  +scope+' .pck-mlab{font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#a5a49d;white-space:nowrap}'
  +scope+' .pck-mbig{font-family:\'DM Mono\',monospace;font-size:21px;font-weight:800;line-height:1;letter-spacing:-.5px;color:#2f2f2b}'
  +scope+' .pck-munit{font-size:10.5px;color:#a5a49d;font-weight:600;margin-left:-4px}'
  +scope+' .pck-mv{font-family:\'DM Mono\',monospace;font-size:13px;font-weight:700;white-space:nowrap}'
  +scope+' .pck-mv i{font-style:normal;font-weight:500;opacity:.55;padding:0 6px;color:#a5a49d}'
  +scope+' .pck-mk{font-size:11.5px;font-weight:600;white-space:nowrap}'
  +scope+' .pck-mdim{font-size:11px;color:#cfccc4;font-family:\'DM Mono\',monospace}'
  +scope+' .pck-mnone{font-size:12px;color:#cfccc4}'
  +scope+' .pck-trip{border-radius:19px;overflow:hidden}'
  +scope+' .pck-trip.multi{background:rgba(255,255,255,.55)}'
  +scope+' .pck-thead{padding:11px 15px;display:flex;align-items:center;gap:11px;flex-wrap:wrap;background:#fff;border-left:5px solid;border-bottom:1px solid #F1F0EC}'
  +scope+' .pck-tname{font-size:15px;font-weight:800;line-height:1.2}'
  +scope+' .pck-tsub{font-size:11px;color:#8a8a82}'
  +scope+' .pck-tdep{font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800;padding:3px 12px;border-radius:999px;color:#fff;white-space:nowrap}'
  +scope+' .pck-tstat{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}'
  +scope+' .pck-tchip{border:1px solid #E7E4DC;background:#FAF9F6;border-radius:9px;padding:3px 11px;font-size:11px;font-weight:700;color:#5F5E5A;white-space:nowrap}'
  +scope+' .pck-tchip b{font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800;color:#2f2f2b}'
  +scope+' .pck-tchip.money{background:#FBF0DD;border-color:#EAD9B0;color:#7A4A00}'
  +scope+' .pck-tchip.money b{color:#7A4A00}'
  +scope+' .pck-tbody{display:flex;flex-direction:column;gap:11px}'
  +scope+' .pck-trip.multi>.pck-tbody{padding:11px}'
  +scope+' .pck-zone{background:#fff;border-radius:16px;padding:11px;border:1px solid #E7E4DC}'
  +scope+' .pck-zhd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:2px 6px 10px}'
  +scope+' .pck-zdot{width:11px;height:11px;border-radius:50%;flex:none}'
  +scope+' .pck-zname{font-size:14px;font-weight:800;white-space:nowrap}'
  +scope+' .pck-zsub{font-size:11.5px;color:#8a8a82}'
  +scope+' .pck-zbody{display:flex;flex-direction:column;gap:11px}'
  +scope+' .pck-van{border:1.5px solid;border-radius:15px;overflow:hidden;background:#fff}'
  +scope+' .pck-vhd{padding:9px 13px;display:flex;flex-wrap:wrap;align-items:center;gap:9px}'
  +scope+' .pck-vnum{width:26px;height:26px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;font-family:\'DM Mono\',monospace;flex:none}'
  +scope+' .pck-vpill{padding:4px 14px;border-radius:999px;color:#fff;font-weight:800;font-size:12.5px;white-space:nowrap}'
  +scope+' .pck-vplate{padding:3px 11px;border-radius:999px;background:#fff;font-size:12px;font-weight:700;border:1px solid;font-family:\'DM Mono\',monospace;white-space:nowrap}'
  +scope+' .pck-vmeta{font-size:12px;color:#5F5E5A;white-space:nowrap}'
  +scope+' .pck-vmeta b{color:#2f2f2b;font-weight:700}'
  +scope+' .pck-vtel{font-size:12px;padding:3px 11px;border-radius:999px;border:1px solid;text-decoration:none;font-family:\'DM Mono\',monospace;background:#fff;font-weight:700;white-space:nowrap}'
  +scope+' .pck-paychips{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px}'
  +scope+' .pck-paychips .t2-pay,'+scope+' .pck-paychips .t2-cot{display:inline-block;border-radius:6px;padding:2px 7px;font-size:9.5px;line-height:1.5;white-space:nowrap}'
  +scope+' .pck-paychips .t2-cot{background:#E0F7FA;color:#00838F;border:1px solid #9FE3EC;font-weight:600}'
  +scope+' .pck-vjoin{border:1px solid;border-radius:999px;padding:3px 12px;font-size:10.5px;font-weight:800;white-space:nowrap}'
  +scope+' .pck-vstat{margin-left:auto;font-size:11.5px;padding:4px 13px;border-radius:999px;font-weight:700;border:1px solid #E7E4DC;background:#F1EFE8;color:#5F5E5A;white-space:nowrap}'
  +scope+' .pck-vstat.ok{background:#DCF4E8;color:#0C6B47;border-color:#BFE3CC}'
  +scope+' .pck-vstat.money{background:#FBF0DD;color:#7A4A00;border-color:#EAD9B0}'
  +scope+' .pck-tw{overflow-x:auto;border-top:1px solid #F1F0EC}'
  +scope+' table.pck-tbl{min-width:1180px}'
  +scope+' table.pck-tbl th{position:static;z-index:auto;box-shadow:none;background:#FCFCFB}'
  +scope+' table.pck-tbl td{padding:11px 9px}'
  +scope+' table.pck-tbl tbody tr:last-child>td{border-bottom:none}'
  +scope+' .pck-px{width:46px}'
  +scope+' .pck-gsub{font-weight:500;color:#5F5E5A;font-size:11.5px;line-height:1.35;white-space:normal;max-width:215px;margin-top:2px}'
  +scope+' .pck-gcount{font-size:9.5px;color:#a5a49d;margin-top:3px;font-family:\'DM Mono\',monospace}'
  +scope+' .pck-gwarn{font-size:9.5px;color:#a5751f;margin-top:3px;font-family:\'DM Mono\',monospace;font-weight:700}'
  +scope+' .pck-gmore{margin-top:4px;font-size:10px;font-weight:700;color:#5F5E5A;background:#F1EFE8;border:1px solid #E7E4DC;border-radius:999px;padding:2px 9px;cursor:pointer;font-family:inherit}'
  +scope+' .pck-gmore:hover{border-color:#185FA5;color:#185FA5}'
  +scope+' .pck-acts{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}'
  +scope+' .pck-ok{height:30px;padding:0 12px 0 5px;border-radius:999px;background:#0F6E56;border:none;color:#fff;display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-family:inherit;box-shadow:0 2px 6px -2px rgba(15,110,86,.55)}'
  +scope+' .pck-ok .tk{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}'
  +scope+' .pck-ok .lb{font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800;white-space:nowrap}'
  +scope+' .pck-ok.off{background:#fff;border:1.5px solid #D7DBD5;color:#5F5E5A;box-shadow:none;padding:0 12px 0 4px}'
  +scope+' .pck-ok.off .tk{background:#F1EFE8;color:#c8c6be}'
  +scope+' .pck-ok.off .lb{font-family:inherit;font-size:11.5px}'
  +scope+' .pck-ok.off:hover{border-color:#0F6E56;color:#0F6E56}'
  +scope+' .pck-warncard{background:#FFFBF5;border:1.5px solid #EBD9BE;border-radius:16px;margin-bottom:18px;overflow:hidden}'
  /* §pckWarnCap · กล่อง "ยังไม่จัดเรือ" ไม่มีเพดานความสูง
     วันที่มีค้างหลายใบ (เจอจริง 8 ใบ) กล่องนี้สูง 541px บวกหัวที่ตรึงอีก 270px
     ตารางจริงถูกดันลงไปเหลือโผล่แค่ 154px ท้ายจอ เลื่อนยังไงก็เหมือนค้างอยู่ที่ใบยกเลิก
     ให้เพดาน 3 แถวแล้วเลื่อนในกล่องเอง · ตารางจริงโผล่เพิ่มเป็น 422px
     ตัวเลขบนหัวกล่องยังบอกจำนวนเต็มเหมือนเดิม ไม่ได้ซ่อนอะไรหาย */
  +scope+' .pck-warncard .pck-tw{max-height:232px;overflow-y:auto;overscroll-behavior:contain}'
  +scope+' .pck-warnhd{padding:10px 14px;font-size:12px;font-weight:800;color:#7a5622;display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
  +scope+' .pck-btabs{display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#fff;border:1px solid #E7E4DC;border-radius:12px;padding:8px 12px;margin-bottom:12px;position:sticky;top:var(--ck-unit-top,0px);z-index:40;box-shadow:0 2px 6px -4px rgba(15,23,42,.30)}'
  +scope+' .pck-btab{padding:6px 13px;border-radius:999px;border:1.5px solid #E7E4DC;background:#FAF9F6;color:#3a3a36;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap;font-family:inherit}'
  +scope+' .pck-btab .rt{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#8a8a82;font-weight:600;max-width:230px;overflow:hidden;text-overflow:ellipsis}'
  +scope+' .pck-btab .rt i{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}'
  +scope+' .pck-btab .c{font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#F1EFE8;color:#5F5E5A;font-family:\'DM Mono\',monospace}'
  +scope+' .pck-btab.on{border-color:transparent}'
  +scope+' .pck-btab.on .rt{opacity:.85}'
  +scope+' .pck-btab.on .c{background:rgba(255,255,255,.25)}'
  ;
}
// ชื่อผู้โดยสารทุกคน · กรมเจ้าท่าต้องการรายชื่อครบ · โชว์ได้ถึง PCK_MAX_NAMES ชื่อ ที่เหลือกดขยาย
/* §pckName2 · รายชื่อทั้งใบ · ใช้ทั้งตอนวาดเซลล์และตอนตัดสินว่าเซลล์นี้กดกางได้ไหม */
function pckNameList(b){
  var lead=String((b&&b.leadPax)||'').trim();
  var ex=((b&&b.passengers)||[]).map(function(p){ return String((p&&p.name)||'').trim(); })
          .filter(function(n){ return n && n!==lead; });
  var list=(lead?[lead]:[]).concat(ex);
  return list.length?list:['—'];
}
/* คุณสมบัติของ td ช่องชื่อ · ในตารางทั้งช่องคือปุ่มกาง กดซ้ำย่อกลับ
   ของเดิมเป็นปุ่ม "+N คน" ต่อท้ายชื่อ · เป็นเป้าเล็ก ๆ ที่ต้องเล็งกด และกินที่ในบรรทัดชื่อ */
function pckNameTdAttr(r, sheet){
  if(!sheet) return '';
  var b=r.b, list=pckNameList(b);
  if(list.length<=1) return '';
  var open=!!_pckOpenNames[b.id];
  return ' data-more="1" data-bk="'+b.id+'" onclick="event.stopPropagation();pckNamesToggle(\''+b.id+'\')"'
    +' title="'+(open?'กดเพื่อย่อรายชื่อ':('กดเพื่อดูรายชื่อทั้งหมด '+list.length+' คน'))+'"';
}
function pckNameCell(r, sheet){
  var e=ckEsc, b=r.b;
  var list=pckNameList(b);
  var open=!!_pckOpenNames[b.id];
  /* §pckLock · ในโหมดตารางโชว์ชื่อหัวใบคนเดียว ที่เหลือกดปุ่ม "+N คน" แล้วกางลงมา
     ตารางไว้กวาดสายตาหาแถว ไม่ใช่ไว้อ่านรายชื่อ · การ์ดยังโชว์ถึง PCK_MAX_NAMES เหมือนเดิม */
  var maxN=sheet?1:PCK_MAX_NAMES;
  var show=(open||list.length<=maxN)?list:list.slice(0,maxN);
  var hidden=list.length-show.length;
  var rcCol=(b.ops&&b.ops.reconfirm&&b.ops.reconfirm.status&&typeof rcStateColor==='function')?rcStateColor(b.ops.reconfirm.status):'#F6E27A';
  var h='<span class="ck-lead" style="background:'+rcCol+'" title="'+e(show[0])+'">'+e(show[0])+'</span>'
    +((typeof pckBoatSplitBadge==='function')?pckBoatSplitBadge(r):'');   // §boatSplit
  var phone=b.leadPhone||b.phone||b.customerPhone||'';
  var telHtml=phone
    ? '<a class="ck-tel" href="tel:'+e(String(phone).split(/[,;\/]|\sหรือ\s/)[0].replace(/[^0-9+]/g,''))+'" onclick="event.stopPropagation()" title="โทรหาลูกค้า">'+e(phone)+'</a>'
    : '';
  /* §pckName3 · ในตาราง บรรทัดแรกคือ ชื่อหัวใบ + เบอร์ ตายตัว
     ชื่อที่กางออกมาไปต่อท้ายด้านล่างเท่านั้น · กดกาง/ย่อแล้วบรรทัดแรกจึงไม่ขยับเลย
     ของเดิมเบอร์อยู่ล่างสุด พอกางชื่อ เบอร์ก็ถูกดันลง ตาต้องไล่หาใหม่ทุกครั้ง
     และไม่มีลูกศรแล้ว · ทั้งช่องคือปุ่มกาง (ดู pckNameTdAttr) */
  if(sheet){
    /* ห่อบรรทัดแรกเป็นแถวเดียวกัน · เบอร์จองที่ไว้ก่อน ชื่อยาว ๆ ค่อยย่อเอา
       เบอร์คือของที่ต้องกดโทรได้จริง ถูกตัดครึ่งแล้วใช้ไม่ได้เลย ส่วนชื่อยังมี tooltip */
    /* §pckNameCap · ใบหมู่คณะมีได้ถึงสิบกว่าชื่อ · ปล่อยให้ยืดตามจำนวนคน
       แถวเดียวจะสูงกินครึ่งจอ แถวอื่นถูกดันหายไปหมด ตารางใช้กวาดตาไม่ได้อีก
       → ให้กล่องรายชื่อสูงได้ 4 บรรทัด ที่เหลือเลื่อนอ่านในกล่อง
       ใบ 10 ชื่อจึงสูงเท่าใบ 5 ชื่อ ความสูงแถวคาดเดาได้เสมอ
       เกินเพดานเมื่อไหร่ กล่องจะกินคลิกของตัวเอง (เลื่อนอ่านโดยไม่ยุบทิ้ง)
       ย่อกลับด้วยการกดที่บรรทัดชื่อหัวใบซึ่งอยู่นอกกล่อง */
    h='<div class="pck-hd">'+h+(telHtml||'')+'</div>';
    var subs=show.slice(1);
    if(subs.length){
      var over=subs.length>PCK_SUB_LINES;
      h+='<div class="pck-gsubs'+(over?' scr':'')+'"'
        +(over?' onclick="event.stopPropagation()" title="เลื่อนดูรายชื่อที่เหลือ · ย่อกลับได้ที่บรรทัดชื่อหัวใบ"':'')+'>'
        +subs.map(function(n){ return '<div class="pck-gsub" title="'+e(n)+'">'+e(n)+'</div>'; }).join('')
        +'</div>';
    }
    return h;
  }
  h+=show.slice(1).map(function(n){ return '<div class="pck-gsub">'+e(n)+'</div>'; }).join('');
  if(hidden>0) h+='<div><button class="pck-gmore" onclick="event.stopPropagation();pckNamesToggle(\''+b.id+'\')" title="แสดงชื่อที่เหลือทั้งหมด">+'+hidden+' คน</button></div>';
  else if(open && list.length>maxN) h+='<div><button class="pck-gmore" onclick="event.stopPropagation();pckNamesToggle(\''+b.id+'\')">ย่อ</button></div>';
  var pax=(r.expect!=null?r.expect:r.booked);
  /* §ckTight · ในตารางชีทไม่ต้องนับชื่อให้ · รายชื่ออยู่ใต้ชื่อหลักครบอยู่แล้ว
     "2 ชื่อ / 5 ชื่อ" กินไปหนึ่งบรรทัดต่อแถวโดยไม่ได้บอกอะไรใหม่
     ป้ายเตือน "มีชื่อเดียว" ยังอยู่ในมุมมองการ์ด ซึ่งเป็นที่ที่ไล่เก็บรายชื่อให้ครบจริง ๆ */
  if(list.length>1) h+='<div class="pck-gcount">'+list.length+' ชื่อ</div>';
  else if(pax>1) h+='<div class="pck-gwarn" title="ระบบมีชื่อเดียว แต่จองมา '+pax+' ที่นั่ง — manifest กรมเจ้าท่าต้องการรายชื่อครบ">มีชื่อเดียว · '+pax+' pax</div>';
  /* §pckLock · ตัดอิโมจิโทรศัพท์ออก · ตัวเลขอ่านง่ายกว่าอยู่แล้ว ไอคอนกินที่เปล่า ๆ */
  if(telHtml) h+='<div>'+telHtml+'</div>';
  return h;
}
function pckMgUnlock(id){
  if(_pckMgOpen[id]) delete _pckMgOpen[id]; else _pckMgOpen[id]=1;
  renderPierCheckin();
}
function pckMgCore(r, b, date, kd, on, ck, actual, sheet){
  var e=ckEsc;
  var okBtn='<button class="pck-ok'+(on?'':' off')+'" onclick="event.stopPropagation();ckToggle(\''+b.id+'\',\''+date+'\',\''+kd+'\')" title="'+e(on?('เช็คอินขึ้นเรือแล้ว · '+(ck.by||'')+' '+pckHHMM(ck.at)):'กดเพื่อเช็คอินขึ้นเรือ')+'">'
    +'<span class="tk">&#10003;</span><span class="lb">'+(on?e(pckHHMM(ck.at)||'ขึ้นเรือ'):'เช็คอิน')+'</span></button>';
  var stp='<span class="ck-stp" title="จำนวนคนที่ขึ้นเรือจริง &#183; กดขึ้นได้ถึงยอดจอง '+r.booked+' แม้เช้าจะไม่ได้ขึ้นรถมา"><button onclick="event.stopPropagation();ckStep(\''+b.id+'\',\''+date+'\',\''+kd+'\',-1)">&minus;</button><span class="ck-n">'+actual+'</span><button onclick="event.stopPropagation();ckStep(\''+b.id+'\',\''+date+'\',\'pier\',1)">+</button></span>';
  var evs='<span style="display:inline-flex;gap:4px"><button class="ck-ev ck-ev-ns" onclick="event.stopPropagation();ckEventOpen(\''+b.id+'\',\''+date+'\',\'pier\',\'no_show\')" title="ลูกค้าไม่มา · ไม่แจ้งล่วงหน้า">No-show</button>'
    +'<button class="ck-ev ck-ev-cx" onclick="event.stopPropagation();ckEventOpen(\''+b.id+'\',\''+date+'\',\'pier\',\'cxl\')" title="ลูกค้าแจ้งยกเลิกหน้างาน">CXL</button></span>';
  if(!sheet) return stp+evs+okBtn;   /* โหมดการ์ดไม่แตะ · ปุ่มคำเต็มเหมือนเดิม */

  /* ══ §pckMgTight · โหมดตาราง · ช่องการจัดการกินความกว้าง 318px กับสูงสองบรรทัด
     ทั้งที่คนหน้าท่ากดจริงแค่ปุ่มเช็คอิน · ที่เหลือกดนาน ๆ ครั้ง
       · ยอดจองย้ายเข้าไปอยู่ในตัวเลขเลย "ขึ้นเรือ/จอง" บรรทัด "จอง N" จึงหายไปทั้งบรรทัด
       · No-show / CXL เป็นไอคอน ✕ / ⊘ วางใต้ตัวเลข (ชี้เมาส์มีคำเต็ม กดตรงได้ ไม่ต้องเปิดเมนู)
       · ปุ่มเช็คอินเหลือ ✓ · ปุ่มรายละเอียดเป็นลูกศรอยู่แล้ว
     ทุกปุ่มยังกดถึงได้ในคลิกเดียวเหมือนเดิม ไม่มีอะไรถูกซ่อนเข้าเมนู ══ */
  var stp2='<span class="ck-stp" title="ขึ้นเรือจริง '+actual+' จากยอดจอง '+r.booked+' คน &#183; กดขึ้นได้ถึงยอดจอง แม้เช้าจะไม่ได้ขึ้นรถมา">'
    +'<button onclick="event.stopPropagation();ckStep(\''+b.id+'\',\''+date+'\',\''+kd+'\',-1)">&minus;</button>'
    +'<span class="ck-n">'+actual+'<i>/'+r.booked+'</i></span>'
    +'<button onclick="event.stopPropagation();ckStep(\''+b.id+'\',\''+date+'\',\'pier\',1)">+</button></span>';
  var evs2='<span class="pcs-evs">'
    +'<button class="ck-ev ck-ev-ns ico" onclick="event.stopPropagation();ckEventOpen(\''+b.id+'\',\''+date+'\',\'pier\',\'no_show\')" title="No-show · ลูกค้าไม่มา ไม่แจ้งล่วงหน้า">&#10005;</button>'
    +'<button class="ck-ev ck-ev-cx ico" onclick="event.stopPropagation();ckEventOpen(\''+b.id+'\',\''+date+'\',\'pier\',\'cxl\')" title="CXL · ลูกค้าแจ้งยกเลิกหน้างาน">&#8856;</button>'
    +'</span>';
  var okIco='<button class="pck-ok ico'+(on?'':' off')+'" onclick="event.stopPropagation();ckToggle(\''+b.id+'\',\''+date+'\',\''+kd+'\')" title="'+e(on?('เช็คอินขึ้นเรือแล้ว · '+(ck.by||'')+' '+pckHHMM(ck.at)):'กดเพื่อเช็คอินขึ้นเรือ')+'">&#10003;'
    +(on?('<span class="tm">'+e(pckHHMM(ck.at)||'')+'</span>'):'')+'</button>';

  if(on && !_pckMgOpen[b.id])
    /* ล็อกคือ "แก้ไม่ได้" ไม่ใช่ "มองไม่เห็น" · ตัวเลขยังอ่านได้โดยไม่ต้องปลดล็อก */
    return '<span class="ck-stp lk" title="ขึ้นเรือจริง '+actual+' จากยอดจอง '+r.booked+' คน · ล็อกอยู่ กดปุ่มแก้เพื่อปลดล็อก">'
        +'<span class="ck-n">'+actual+'<i>/'+r.booked+'</i></span></span>'
      +okIco+'<button class="pck-mgedit ico" onclick="event.stopPropagation();pckMgUnlock(\''+b.id+'\')" title="เช็คอินแล้ว · ล็อกไว้กันกดโดน · กดเพื่อเปิดแก้จำนวน / No-show / CXL">&#9998;</button>';

  return '<span class="pcs-numcol">'+stp2+evs2+'</span>'+okIco
    +(on?'<button class="pck-mgedit ico on" onclick="event.stopPropagation();pckMgUnlock(\''+b.id+'\')" title="ล็อกกลับ · กันกดโดนหลังเช็คอินแล้ว">&#128274;</button>':'');
}
// แถวลูกค้าของหน้าท่า · ต่างจาก ckRowHtml ตรงที่ยุบคอลัมน์ที่หัวการ์ดตอบไปแล้ว (เรือ / รถ / โซน)
// แล้วเอาที่ว่างไปให้ชื่อผู้โดยสาร · add-on · เงิน · ปุ่มเช็คอิน
// §pierDrop (2026-08-03) · จุดส่งของหน้าเช็คอิน · ใช้ pckJobDrop ตัวเดียวกับใบงานไกด์
//   หน้าท่าเป็นจุดสุดท้ายที่แก้ทันก่อนเรือออก — ถ้าไม่เห็นตรงนี้ก็ไม่มีที่ไหนให้เห็นอีก
function pckDropHtml(b, date){
  var d = (typeof pckJobDrop === 'function') ? pckJobDrop(b, date) : null;
  if(!d) return '';
  return '<div class="pck-drop' + (d.self ? ' self' : '') + '" title="จุดส่งขากลับ · รถที่พากลับ">'
       + (d.t ? ('&#8627; ส่ง ' + ckEsc(d.t)) : '')
       + (d.van ? ((d.t?' · ':'') + ckEsc(ckRetVanTxt(d.van))) : '')
       + '</div>';
}
/* §mealOvn · รวมอาหารหรือไม่ · เก็บรายใบจอง ในก้อน trip_actuals ของลำ/วันนั้น */
function pckMealOvnMap(date, bid){
  var A=(typeof taGet==='function')?(taGet(date,bid)||{}):{}, m=A.mealOvn;
  return (m && typeof m==='object')?m:{};
}
function pckMealOvnOf(date, bid, bkId){
  var v=pckMealOvnMap(date,bid)[bkId];
  return (v==='in'||v==='out')?v:'';
}
function pckMealOvnSet(date, bid, bkId, v){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;
  var m={}, cur=pckMealOvnMap(date,bid);
  Object.keys(cur).forEach(function(k){ m[k]=cur[k]; });
  if(v==='in'||v==='out') m[bkId]=v; else delete m[bkId];
  taSet(date, bid, { mealOvn: Object.keys(m).length?m:null });
  if(typeof renderPierCheckin==='function') renderPierCheckin();
}
/* ใบจอง "รับกลับจากเกาะ" ของลำนั้นวันนั้น · รูปทรงเดียวกับแถวเช็คอิน จะได้ต่อเข้ากันได้ */
function pckMealOvnRows(date, bid){
  var out=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    if(!(typeof bkIsOvnReturn==='function' && bkIsOvnReturn(t))) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    var vd=(typeof pckVoidInfo==='function')?pckVoidInfo(b,date,t):null;
    if(vd) return;
    var booked=(typeof ckBookedPax==='function')?ckBookedPax(t):0;
    var exp=(typeof pckExpected==='function')?pckExpected(b,date,booked):booked;
    var ck=O.pierCheckin||null;
    var pax=pckOnBoard(b,date,booked);                     /* §ckPierSelf2 */
    if(!pax) return;
    out.push({ b:b, t:t, O:O, booked:booked, expect:exp, ck:ck, _vd:null,
               pax:pax, inc:pckMealOvnOf(date,bid,b.id),
               outDate:(typeof _ovnOutDate==='function')?_ovnOutDate(b,t):'' });
  });
  out.sort(function(a,b){ return String(a.b.leadPax||'').localeCompare(String(b.b.leadPax||''),'th'); });
  return out;
}
function pckMealOvnNeed(date, bid){
  return pckMealOvnRows(date,bid).filter(function(x){ return !x.inc; });
}
/* §mealNote · โน้ตของลำนั้นวันนั้น · เก็บที่ TRIP_ACT ก้อนเดียวกับยอดอาหารที่ส่งไปแล้ว
   รับของเก่าที่เคยเก็บเป็นสตริงล้วนด้วย เผื่อมีคนเขียนไว้ก่อนแยกเป็นอ็อบเจกต์ */
function pckMealNoteObj(date, bid){
  var A=(typeof taGet==='function')?(taGet(date,bid)||{}):{}, v=A.mealNote;
  if(!v) return null;
  if(typeof v==='string'){ var t0=v.trim(); return t0?{t:t0,at:'',by:''}:null; }
  var t=String(v.t||'').trim();
  return t?{t:t, at:String(v.at||''), by:String(v.by||'')}:null;
}
function pckMealNote(date, bid){ var n=pckMealNoteObj(date,bid); return n?n.t:''; }
function pckMealNoteOpen(bid){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;
  var date=_pckDate, e=ckEsc;
  _pckMealNoteBid=bid;
  var N=pckMealNoteObj(date,bid), cur=N?N.t:'';
  var who=(N&&N.by)?(' · '+N.by):'';
  var at=(N&&N.at&&typeof pckHHMM==='function')?(' '+pckHHMM(N.at)):'';
  var QUICK=['อัพเดท · ใช้ใบนี้แทนใบเดิม','เพิ่มจากที่แจ้งไปรอบแรก','ลดจำนวนจากที่แจ้งไว้',
             'เรือถึงช้ากว่านัด','ขอข้าวเพิ่ม','ยังไม่ยืนยัน · รอแจ้งอีกครั้ง'];
  acctModal(pckNoteCss()
    +'<div class="pn-hd"><div><div class="pn-t">โน้ตถึงร้านอาหาร</div>'
      +'<div class="pn-s">'+e(pckBoatName(bid)+' · '+date)+(cur?e(' · แก้ล่าสุด'+at+who):'')+'</div></div>'
      +'<button class="pn-x" onclick="acctModalClose()">&#10005;</button></div>'
    +'<div class="pn-bd">'
      +'<div class="pn-lab">ข้อความถึงร้าน <span>ขึ้นมุมขวาบนของใบแจ้งอาหาร</span></div>'
      +'<textarea id="pck-mnote-tx" rows="4" placeholder="เช่น อัพเดท · เพิ่มจากรอบแรก 2 ท่าน ใช้ใบนี้แทนใบเดิม">'+e(cur)+'</textarea>'
      +'<div class="pn-q">'+QUICK.map(function(q){
          return '<button onclick="pckMealNoteQuick(\''+e(q).replace(/'/g,"")+'\')">'+e(q)+'</button>'; }).join('')+'</div>'
      +'<div class="pn-act">'
        +(cur?'<button class="pn-del" onclick="pckMealNoteSave(1)">ลบโน้ต</button>':'')
        +'<button class="pn-b2" onclick="acctModalClose()">ยกเลิก</button>'
        +'<button class="pn-b1" onclick="pckMealNoteSave(0)">บันทึก</button>'
      +'</div>'
    +'</div>');
  setTimeout(function(){ var t=document.getElementById('pck-mnote-tx');
    if(t){ t.focus(); t.setSelectionRange(t.value.length,t.value.length); } },60);
}
function pckMealNoteQuick(q){
  var t=document.getElementById('pck-mnote-tx'); if(!t) return;
  var v=String(t.value||'').trim();
  t.value = v ? (v+' · '+q) : q;
  t.focus();
}
function pckMealNoteSave(clear){
  var bid=_pckMealNoteBid; if(!bid) return;
  var t=document.getElementById('pck-mnote-tx');
  var txt=clear?'':String((t&&t.value)||'').trim();
  taSet(_pckDate, bid, { mealNote: txt ? { t:txt, at:new Date().toISOString(),
                          by:(typeof ckMe==='function')?ckMe():'' } : null });
  acctModalClose();
  if(typeof renderPierCheckin==='function') renderPierCheckin();
}
function pckMealChips(b){
  var m = b.specialMeals || {}, out = [];
  PCK_MEALS.forEach(function(x){ if(+m[x.k] > 0) out.push({ t:x.l + ' ' + (+m[x.k]), c:x.c, bg:x.bg, bd:x.bd }); });
  var al = (typeof bkV2AllergyCount === 'function') ? bkV2AllergyCount(m) : ((String(m.allergies || '').trim()) ? 1 : 0);
  /* §pckAlTip (2026-09-14) · ชิปบอกแต่ "แพ้อาหาร 2" ไม่เคยบอกว่าแพ้อะไร
     ช่องในตารางแคบเกินจะพิมพ์ทั้งประโยค · แต่ปล่อยให้ไม่มีที่ดูเลยไม่ได้
     ใส่รายละเอียดไว้ใน tooltip · จิ้มค้างที่ชิปก็อ่านได้ทันทีหน้าท่า */
  if(al){
    var _alT=(typeof bkV2AllergyText==='function')?bkV2AllergyText(m):String(m.allergies||'').trim();
    out.push({ t:'⚠ แพ้อาหาร ' + al, c:'#A32D2D', bg:'#FCEBEB', bd:'#F0C9C9',
               tip:(_alT?('แพ้อาหาร · '+_alT):'') });
  }
  return out;
}
/* §pckSheet3 · ป้ายภาษาไกด์อย่างเดียว · ในตารางชีทไกด์เป็นคอลัมน์ของตัวเอง
   ช่องแคบมาก จึงเหลือแค่รหัสภาษากับสีประจำภาษา · ข้อความเต็มอยู่ใน title */
function pckGuideCell(b){
  var gl=(typeof pckGuideLangs==='function')?pckGuideLangs(b):[];
  if(!gl.length) return '<span class="ck-dim">—</span>';
  var gc=(typeof pckGuideColorOf==='function')?pckGuideColorOf(gl):'';
  var gInk=(gc && typeof bkV2ContrastInk==='function')?bkV2ContrastInk(gc):'';
  var gEn=(gl.length===1 && gl[0]==='EN');
  return '<span class="pck-gchip pcs-gd'+((gEn&&!gc)?' en':'')+'"'
    +(gc?(' style="background:'+gc+';border-color:'+gc+';color:'+gInk+'"'):'')
    +' title="ใบนี้ขอไกด์พูด '+ckEsc(gl.join(' / '))+'">'+gl.map(ckEsc).join('/')+'</span>';
}
function pckMealCell(b, date, noGuide, sheet){
  var chips = pckMealChips(b), m = b.specialMeals || {};
  /* §pierGuide · ภาษาไกด์ของใบนี้ · อ่านจากที่เดียวกับใบงานไกด์ (pckGuideLangs)
     ไม่ได้ตีความ notes เอง · ใบไหนติ๊กไว้ในใบจองเท่านั้นที่ขึ้น */
  var gl=(typeof pckGuideLangs==='function')?pckGuideLangs(b):[];
  var gHtml='';
  if(gl.length && !noGuide){
    var gc=(typeof pckGuideColorOf==='function')?pckGuideColorOf(gl):'';
    var gInk=(gc && typeof bkV2ContrastInk==='function')?bkV2ContrastInk(gc):'';
    var gEn=(gl.length===1 && gl[0]==='EN');   /* กติกาเดียวกับป้ายบนใบงานไกด์ */
    gHtml='<span class="pck-gchip'+((gEn&&!gc)?' en':'')+'"'+(gc?(' style="background:'+gc+';border-color:'+gc+';color:'+gInk+'"'):'')
      +' title="ใบนี้ขอไกด์พูด '+ckEsc(gl.join(' / '))+' &#10;สีตั้งได้ที่ปุ่ม สี Service ในแถบตัวกรอง">'
      +'&#128483; ไกด์ '+gl.map(ckEsc).join('/')+'</span>';
  }
  var html = chips.map(function(c){
    /* §pckAlTip · ชิปที่มีรายละเอียด (แพ้อาหาร) ห้อย tooltip ไว้ให้จิ้มอ่าน */
    return '<span class="pck-mchip"' + (c.tip?(' title="'+ckEsc(c.tip)+'"'):'')
      + ' style="background:' + c.bg + ';color:' + c.c + ';border-color:' + c.bd + '">' + ckEsc(c.t) + '</span>';
  }).join('');
  if(m.pierAt) html += '<span class="pck-mchip pier" title="เพิ่ม/แก้ที่หน้าท่า ' + ckEsc(m.pierAt) + (m.pierBy ? (' · ' + ckEsc(m.pierBy)) : '') + '">หน้างาน</span>';
  // §pierNote · เรื่องที่ลูกค้าแจ้งที่ท่า · ข้อความอิสระ แยกจากอาหารพิเศษที่เป็นตัวเลข
  var nt=(typeof pckNoteGet==='function')?pckNoteGet(b,date):'';
  var ntHtml = nt ? ('<div class="pck-note" title="'+ckEsc(nt)+'">&#9998; '+ckEsc(nt)+'</div>') : '';
  /* §pckSheet6 · ในตารางชีท บรรทัดบน = ของที่มีอยู่จริง บรรทัดล่าง = ปุ่มไว้เติม
     ปนกันแล้วแยกไม่ออกว่าอะไรคือข้อมูล อะไรคือช่องว่างรอให้กรอก */
  var _btns='<button class="pck-mbtn" onclick="event.stopPropagation();pckMealOpen(\'' + b.id + '\',\'' + date + '\')" title="เพิ่ม/แก้อาหารพิเศษหน้างาน">' + (chips.length ? '✎' : '+ อาหารพิเศษ') + '</button>'
       + '<button class="pck-mbtn note' + (nt?' on':'') + '" onclick="event.stopPropagation();pckNoteOpen(\'' + b.id + '\',\'' + date + '\')" title="โน้ตหน้างาน · เรื่องที่ลูกค้าแจ้งที่ท่า">' + (nt ? '✎ โน้ต' : '+ โน้ต') + '</button>';
  return '<div class="pck-mcell">' + gHtml + (html || ((nt||gHtml)?'':'<span class="ck-dim">—</span>'))
       + (sheet ? ('<div class="pck-mact">'+_btns+'</div>') : _btns)
       + ntHtml + '</div>';
}
// §pierNote · โน้ตหน้างานของวันนั้น · เก็บที่ ops ของวัน ไม่ใช่ที่ booking
// ops.pierNote = {t:ข้อความ, at:เวลา, by:คนเขียน} · ก้อนเดียว = คอลัมน์เดียวใน operation_schemas
//   รับของเก่าที่เคยเก็บเป็น string ล้วนด้วย (ที่พิมพ์ไปก่อนแก้บั๊กนี้)
function pckNoteObj(b, date){
  var o=(typeof bkOpsRead==='function')?bkOpsRead(b,date):((b&&b.ops)||{});
  var v=o&&o.pierNote;
  if(!v) return null;
  if(typeof v==='string') return { t:v.trim(), at:(o.pierNoteAt||''), by:(o.pierNoteBy||'') };
  return { t:String(v.t||'').trim(), at:String(v.at||''), by:String(v.by||'') };
}
function pckNoteGet(b, date){ var n=pckNoteObj(b,date); return n?n.t:''; }
function pckNoteSet(b, date, txt){
  var o=(typeof bkOpsFor==='function')?bkOpsFor(b,(typeof bkOpsDate==='function'?bkOpsDate(b,date):date)):(b.ops=b.ops||{});
  txt=String(txt||'').trim();
  if(txt) o.pierNote={ t:txt, at:new Date().toISOString(), by:(typeof ckMe==='function'?ckMe():'') };
  else o.pierNote=null;                       // null ไม่ใช่ delete · ต้องส่งค่าว่างขึ้นไปล้างคอลัมน์ด้วย
  delete o.pierNoteAt; delete o.pierNoteBy;   // ของเวอร์ชันแรก · ไม่มีคอลัมน์รองรับอยู่แล้ว
  try{ acctPersistBookings(); }catch(_){}
  if(typeof bkV2AddHistory==='function')
    bkV2AddHistory(b,'note',(txt?('โน้ตหน้างาน: '+txt):'ลบโน้ตหน้างาน'),'Pier');
}
function pckNoteOpen(bkId, date){
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; }); if(!b) return;
  _pckNote={ bkId:bkId, date:date };
  var e=ckEsc, N=pckNoteObj(b,date), cur=N?N.t:'';
  var who=(N&&N.by)?(' · '+N.by):'';
  var at=(N&&N.at&&typeof pckHHMM==='function')?(' '+pckHHMM(N.at)):'';
  var QUICK=['ขอนั่งหัวเรือ','ขอนั่งท้ายเรือ','เมาเรือ · ขอยา','ตั้งครรภ์','ว่ายน้ำไม่เป็น','ผู้สูงอายุ · ต้องช่วยขึ้นเรือ','เด็กเล็ก · ขอเสื้อชูชีพเด็ก','ขอกลับก่อน'];
  acctModal(pckNoteCss()
    +'<div class="pn-hd"><div><div class="pn-t">โน้ตหน้างาน</div>'
      +'<div class="pn-s">'+e((b.voucherRef||b.code||'')+' · '+(b.leadPax||'')+' · '+date)
        +(cur?e(' · แก้ล่าสุด'+at+who):'')+'</div></div>'
      +'<button class="pn-x" onclick="acctModalClose()">&#10005;</button></div>'
    +'<div class="pn-bd">'
      +'<div class="pn-lab">เรื่องที่ลูกค้าแจ้งที่ท่า <span>ขึ้นในใบงานไกด์ช่อง Note ด้วย</span></div>'
      +'<textarea id="pck-note-tx" rows="4" placeholder="เช่น ขอนั่งหัวเรือ · แพ้แดดจัด · ขอเสื้อชูชีพเด็ก 2 ตัว">'+e(cur)+'</textarea>'
      +'<div class="pn-q">'+QUICK.map(function(q){
          return '<button onclick="pckNoteQuick(\''+e(q).replace(/'/g,"")+'\')">'+e(q)+'</button>'; }).join('')+'</div>'
      +'<div class="pn-act">'
        +(cur?'<button class="pn-del" onclick="pckNoteSave(1)">ลบโน้ต</button>':'')
        +'<button class="pn-b2" onclick="acctModalClose()">ยกเลิก</button>'
        +'<button class="pn-b1" onclick="pckNoteSave(0)">บันทึก</button>'
      +'</div>'
    +'</div>');
  setTimeout(function(){ var t=document.getElementById('pck-note-tx'); if(t){ t.focus(); t.setSelectionRange(t.value.length,t.value.length); } },60);
}
function pckNoteQuick(q){
  var t=document.getElementById('pck-note-tx'); if(!t) return;
  var v=String(t.value||'').trim();
  t.value = v ? (v+' · '+q) : q;
  t.focus();
}
function pckNoteSave(clear){
  var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===_pckNote.bkId; }); if(!b) return;
  var t=document.getElementById('pck-note-tx');
  pckNoteSet(b, _pckNote.date, clear?'':((t&&t.value)||''));
  acctModalClose();
  if(typeof renderPierCheckin==='function') renderPierCheckin();
}
function pckNoteCss(){ return '<style>'
  +'#acct-modal .pn-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E7E4DC}'
  +'#acct-modal .pn-t{font-size:15px;font-weight:800;color:#2c2c2a}'
  +'#acct-modal .pn-s{font-size:11px;color:#8a8a82;margin-top:2px;line-height:1.5}'
  +'#acct-modal .pn-x{background:transparent;border:none;font-size:18px;color:#8a8a82;cursor:pointer;line-height:1}'
  +'#acct-modal .pn-bd{padding:16px 20px 20px}'
  +'#acct-modal .pn-lab{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a8a82;margin-bottom:7px}'
  +'#acct-modal .pn-lab span{font-weight:600;letter-spacing:0;text-transform:none;color:#a8a49b;margin-left:6px}'
  +'#acct-modal .pn-bd textarea{width:100%;font-family:inherit;font-size:13px;line-height:1.6;border:1px solid #E7E4DC;'
    +'border-radius:9px;padding:9px 11px;resize:vertical;box-sizing:border-box}'
  +'#acct-modal .pn-bd textarea:focus{outline:none;border-color:#0F6E56}'
  +'#acct-modal .pn-q{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}'
  +'#acct-modal .pn-q button{border:1px dashed #D8D4CA;background:#fff;color:#5F5E5A;border-radius:999px;padding:3px 11px;'
    +'font-family:inherit;font-size:11px;font-weight:600;cursor:pointer}'
  +'#acct-modal .pn-q button:hover{border-style:solid;border-color:#0F6E56;color:#0F6E56}'
  +'#acct-modal .pn-act{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}'
  +'#acct-modal .pn-act button{font-family:inherit;font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;cursor:pointer;border:1px solid #E7E4DC;background:#fff;color:#2c2c2a}'
  +'#acct-modal .pn-b1{background:#0F6E56 !important;border-color:#0F6E56 !important;color:#fff !important}'
  +'#acct-modal .pn-del{margin-right:auto;border-color:#F0C9C9 !important;color:#A32D2D !important}'
  +'</style>'; }
function pckMealOpen(bkId, date){
  var b = (SB_BOOKINGS || []).find(function(x){ return x.id === bkId; }); if(!b) return;
  var m = b.specialMeals || {};
  _pckMeal = { bkId:bkId, date:date, veg:+m.veg || 0, vegan:+m.vegan || 0, halal:+m.halal || 0,
               allergies:String(m.allergies || '') };
  var host = document.getElementById('pck-meal-host');
  if(!host){ host = document.createElement('div'); host.id = 'pck-meal-host'; document.body.appendChild(host); }
  pckMealPaint();
}
function pckMealHead(){
  var b = (SB_BOOKINGS || []).find(function(x){ return x.id === _pckMeal.bkId; }); if(!b) return 0;
  var t = (typeof ckTripOn === 'function') ? (ckTripOn(b, _pckMeal.date) || {}) : {};
  return (typeof ckBookedPax === 'function') ? ckBookedPax(t) : 0;
}
function pckMealStep(k, d){
  var head = pckMealHead();
  var others = ['veg', 'vegan', 'halal'].filter(function(x){ return x !== k; })
                 .reduce(function(a, x){ return a + (+_pckMeal[x] || 0); }, 0);
  var room = Math.max(0, head - others);                       // รวมทุกประเภทห้ามเกินจำนวนคนในบุ๊คกิ้ง
  _pckMeal[k] = Math.max(0, Math.min(room, (+_pckMeal[k] || 0) + d));
  pckMealPaint();
}
function pckMealPaint(){
  var host = document.getElementById('pck-meal-host'); if(!host) return;
  var b = (SB_BOOKINGS || []).find(function(x){ return x.id === _pckMeal.bkId; }); if(!b) return;
  var head = pckMealHead();
  var used = (+_pckMeal.veg || 0) + (+_pckMeal.vegan || 0) + (+_pckMeal.halal || 0);
  var rows = PCK_MEALS.map(function(x){
    var v = +_pckMeal[x.k] || 0;
    var BT = 'border:none;background:#FAF9F6;color:#4a4a45;width:34px;height:32px;font-size:16px;cursor:pointer;font-family:inherit';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #F3F1EA">'
      + '<span style="font-size:13.5px;font-weight:700;color:' + x.c + '">' + x.l + '</span>'
      + '<span style="display:inline-flex;align-items:center;border:1px solid #E4E1D9;border-radius:9px;overflow:hidden">'
      + '<button style="' + BT + '" onclick="pckMealStep(\'' + x.k + '\',-1)">&minus;</button>'
      + '<b style="min-width:40px;text-align:center;font-family:\'DM Mono\',monospace;font-size:15px">' + v + '</b>'
      + '<button style="' + BT + '" onclick="pckMealStep(\'' + x.k + '\',1)">+</button></span></div>';
  }).join('');
  host.innerHTML = ''
    + '<div id="pck-meal-ov" onclick="if(event.target===this)pckMealClose()" style="position:fixed;inset:0;background:rgba(20,24,22,.42);backdrop-filter:blur(2px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px">'
    + '<div style="background:#fff;border-radius:16px;width:min(430px,96vw);max-height:90vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28)">'
    + '  <div style="padding:15px 20px;border-bottom:1px solid #EFECE4;display:flex;align-items:center;justify-content:space-between;gap:12px">'
    + '    <div><div style="font-size:15px;font-weight:800;color:#15201a">อาหารพิเศษ · หน้างาน</div>'
    + '    <div style="font-size:11.5px;color:#8a8a82;margin-top:2px;font-family:\'DM Mono\',monospace">'
    +        ckEsc(b.voucherRef || b.code || b.id) + ' · ' + ckEsc(b.leadPax || '') + ' · ' + head + ' คน</div></div>'
    + '    <button onclick="pckMealClose()" style="background:transparent;border:none;font-size:20px;color:#9a9a92;cursor:pointer;line-height:1">&times;</button>'
    + '  </div>'
    + '  <div style="padding:14px 20px">' + rows
    + '    <div style="font-size:10.5px;color:' + (used > head ? '#A32D2D' : '#8a8a82') + ';margin:2px 0 12px">รวม ' + used + ' / ' + head + ' คนในบุ๊คกิ้งนี้</div>'
    + '    <div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">แพ้อาหาร</div>'
    + '    <input id="pck-meal-al" type="text" value="' + ckEsc(_pckMeal.allergies) + '" placeholder="เช่น กุ้ง 2 คน · ถั่ว 1 คน" style="border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;width:100%;box-sizing:border-box;font-family:inherit">'
    + '    <div style="font-size:11px;color:#8a8a82;margin-top:11px;line-height:1.5">บันทึกแล้วจะขึ้นทั้งหน้าเช็คอินและ<b>ใบงานไกด์</b> พร้อมป้าย <b>หน้างาน</b> ให้ครัวรู้ว่าเป็นรายการที่เพิ่มทีหลัง</div>'
    + '  </div>'
    + '  <div style="padding:10px 20px 16px;display:flex;gap:9px;justify-content:flex-end">'
    + '    <button onclick="pckMealClose()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>'
    + '    <button onclick="pckMealSave()" style="border:none;background:#0F6E56;color:#fff;border-radius:9px;padding:9px 20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">บันทึก</button>'
    + '  </div>'
    + '</div></div>';
}
function pckMealClose(){ var h = document.getElementById('pck-meal-host'); if(h) h.innerHTML = ''; _pckMeal.bkId = null; }
function pckMealSave(){
  var st = _pckMeal; if(!st.bkId) return pckMealClose();
  var b = (SB_BOOKINGS || []).find(function(x){ return x.id === st.bkId; }); if(!b) return pckMealClose();
  var el = document.getElementById('pck-meal-al');
  var sm = b.specialMeals || (b.specialMeals = { veg:0, vegan:0, halal:0, allergies:'' });
  sm.veg = +st.veg || 0; sm.vegan = +st.vegan || 0; sm.halal = +st.halal || 0;
  sm.allergies = el ? String(el.value || '') : st.allergies;
  sm.pierAt = (typeof ckNowHM === 'function') ? ckNowHM() : '';
  sm.pierBy = (typeof ckMe === 'function') ? ckMe() : '';
  if(typeof acctPersistBookings === 'function') acctPersistBookings();
  pckMealClose();
  if(typeof renderPierCheckin === 'function') renderPierCheckin();
}
function pckRowHtml(r, date, sheet){
  /* §strandPck · แถวค้าง · ตัดปุ่มสั่งการทิ้งหมด เหลือเหตุผลกับปุ่มล้าง
     คอลัมน์หน้ายังครบ เพราะหน้าท่าต้องเทียบกับใบงานไกด์ที่ถืออยู่ว่าเป็นบรรทัดเดียวกัน
     ตารางแผ่นใหญ่ 16 ช่อง · แบบการ์ด 12 ช่อง · ท้ายแถวเหลือ 5 ช่องเท่ากันทั้งคู่ */
  if(r.strand){
    var _e=ckEsc, _b=r.b, _t=r.t;
    var _ag=(typeof sbGetAgent==='function')?sbGetAgent(_b.agentId):null;
    var _agN=_ag?(_ag.name||_ag.code||'—'):(_b.channel||'walk-in');
    var _pb=ckPaxBreak(_t.pax);
    var _tm=(r.O&&r.O.pickupTimeFinal)||_t.pickupTime||_t.pickupFinal||'—';
    var _pk=ckPickShort(_b.hotelName||_b.pickup||'')||'—';
    var _px=['ad','chd','inf','foc'].map(function(k){ return '<td class="ck-c pck-px">'+(_pb[k]||0)+'</td>'; }).join('');
    var _act='<td colspan="5" class="l">'
      +'<span class="ck-swhy" title="'+_e(r.strandWhy||'')+'">'+_e(r.strandWhy||'')+'</span>'
      +'<button class="ck-sclr" onclick="event.stopPropagation();ckStrandClear(\''+_b.id+'\',\''+date+'\')" '
      +'title="ล้างการจัดรถ/เรือของวันนี้ · แถวนี้จะหายจากทุกหน้าปฏิบัติการ · ใบจองไม่ถูกแตะ">ล้างการจัดเรือ</button></td>';
    var _nm='<td class="l"><span class="ck-lead">'+_e(_b.leadPax||'—')+'</span>'
      +'<span class="ck-sbadge">'+(r.strand==='mv'?'เลื่อนวัน':'CXL')+'</span></td>';
    if(sheet){
      return '<tr class="ck-row ck-strand'+(r.strand==='mv'?' mv':'')+'">'
        +'<td class="l"><span class="ck-vch">'+_e(_b.voucherRef||_b.code||'—')+'</span></td>'
        +'<td>'+_e(_agN)+'</td>'+_nm+_px
        +'<td class="ck-mono">'+_e(_tm)+'</td>'
        +'<td class="l"><span class="ck-pick">'+_e(_pk)+'</span></td>'
        +'<td class="ck-c ck-mono">'+_e(_b.roomNo||_b.roomNumber||'—')+'</td>'
        +'<td>'+_e(ckPickShort(_b.pickupArea||'')||'—')+'</td>'
        +_act+'</tr>';
    }
    return '<tr class="ck-row ck-strand'+(r.strand==='mv'?' mv':'')+'">'
      +'<td><span class="ck-vch">'+_e(_b.voucherRef||_b.code||'—')+'</span>'
        +'<div style="font-size:10px">'+_e(_agN)+'</div></td>'
      +_nm+_px
      +'<td><span class="ck-mono">'+_e(_tm)+'</span>'
        +'<div><span class="ck-pick">'+_e(_pk)+'</span></div></td>'
      +_act+'</tr>';
  }
  var e=ckEsc, b=r.b, t=r.t;
  var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  var agName=ag?(ag.name||ag.code||'—'):(b.channel||'walk-in');
  var agColor=(b.agentId&&typeof bkV2AgentColor==='function')?bkV2AgentColor(b.agentId):((ag&&ag.color)||'#64748B');
  var agInk=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(agColor):'#fff';
  /* §boatSplit แถวของลำไหน นับของลำนั้น · §pckSplit แถวของจุดรับไหน นับของจุดนั้น
     เดิมตกกรณี vsPaxBd ทั้งสองแถวจึงโชว์ยอดเต็มใบเหมือนกัน */
  var pb=(r.bsN&&r.bsPaxBd)?r.bsPaxBd:((r.vsN&&r.vsPaxBd)?r.vsPaxBd:ckPaxBreak(t.pax));   // §boatSplit · แถวของลำไหน นับของลำนั้น
  var time=r.O.pickupTimeFinal||t.pickupTime||t.pickupFinal||'';
  var pickup=b.hotelName||b.pickup||'';
  var pArea=b.pickupArea||(b.pickupAreaId&&typeof bkV2GetArea==='function'?((bkV2GetArea(b.pickupAreaId)||{}).name||''):'')||'';
  /* §pckSplit · แถวของจุดรับย่อย · โรงแรม/โซน เป็นของจุดนั้น ไม่ใช่ของ Lead */
  if(r._pickHotel!=null){ pickup=r._pickHotel||pickup; pArea=r._pickArea||pArea; }
  pickup=ckPickShort(pickup); pArea=ckPickShort(pArea);   /* §pickShort · ชื่อโซนก็ยาวแบบเดียวกัน */
  var room=b.roomNo||b.room||b.roomNumber||'';
  var by=b.createdBy||'';
  var sreq=(typeof vanJobsSreqFinal==='function')?(vanJobsSreqFinal(b)||''):((b.notes||'').trim());
  var ck=r.ck||{};
  /* §pckSplit · แถวจุดรับย่อยมีสถานะของตัวเอง · ปุ่มทุกตัวต้องส่ง kind ของแถวไป
     ไม่งั้นกดแล้วไปเขียนทับ ops.pierCheckin ของทั้งใบ แถวนี้จึงไม่ขึ้นสักที */
  var _kd=r._ckKind||'pier';
  var booked=(r.expect!=null?r.expect:r.booked);
  var actual=(ck.actualPax!=null?ck.actualPax:booked), noShow=Math.max(0,booked-actual), on=!!ck.at;
  var tally=ckEventTally(ck);
  var tst=ckTimeState(time, date, on);
  var _lost=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
  var _stg=on?'on':pckStage(ck);
  var _vd=pckVoidOf(r,date);
  var cls='ck-row'+(on?' ck-done':(_stg==='clr'?' ck-plain ck-clr':(_stg==='arr'?' ck-plain ck-arr':' ck-plain')))
    +(((_lost&&_lost.total>0)||noShow>0)?' ck-lost':'')
    +((noShow>=booked&&booked>0&&(on||(_lost&&_lost.total>0)))?' ck-nsfull':'')
    +((tst.k==='late'&&!_vd)?' ck-late':'')+(_vd?' pck-rvoid':'');
  var rsn='';
  if(noShow>0){
    var lbl=ck.reasonCode?((ck.reasonAt?ck.reasonAt+' · ':'')+ckReasonLabel(ck.reasonCode)+(ck.reasonNote?(' · '+ck.reasonNote):'')):'⚠ ใส่เหตุผล';
    rsn='<div style="text-align:right;margin-top:4px"><button class="ck-rsn'+(ck.reasonCode?'':' ck-rsn-need')+'" onclick="event.stopPropagation();ckReasonOpen(\''+b.id+'\',\''+date+'\',\''+_kd+'\')" title="'+e(lbl)+' · คลิกแก้ไข">'+e(lbl)+'</button></div>';
  }
  var big=function(n){ return n>0?'<b style="font-family:\'DM Mono\',monospace;font-size:14px;font-weight:800">'+n+'</b>':'<span class="ck-dim" style="font-size:13px">0</span>'; };
  var px=function(k){
    var bkd=pb[k]||0;
    if(r.bsN&&r.bsN>1) return '<td class="ck-c pck-px">'+big(bkd)+'</td>';   // §boatSplit · คนไม่มาเป็นของทั้งใบ ไม่หักซ้ำทุกแถว
    if(!_lost || _lost.total<=0) return '<td class="ck-c pck-px">'+big(bkd)+'</td>';
    var left=ckPaxLeft(b,date,k,bkd);
    if(left===bkd) return '<td class="ck-c pck-px">'+big(bkd)+'</td>';
    return '<td class="ck-c pck-px" title="จองมา '+bkd+' · เดินทางจริง '+left+'"><span style="font-family:\'DM Mono\',monospace;font-weight:800;font-size:14px;color:'+(left?'#A32D2D':'#c8c6be')+'">'+left+'</span>'
      +'<div style="font-size:9px;color:#c2c0b7;line-height:1.1;text-decoration:line-through">'+bkd+'</div></td>';
  };
  /* §pckSheet2 · โหมดตาราง · Voucher กับ Agency แยกช่อง · ช่อง Agency เป็นสีเต็มช่อง */
  var headCells;
  if(sheet){
    headCells='<td class="pcs-vch"><span class="ck-vch" title="'+e(b.voucherRef||b.code||'')+'">'+e(b.voucherRef||b.code||'—')+'</span>'
      +((_pckShowBy&&by)?'<div class="pcs-by">โดย <b>'+e(by)+'</b></div>':'')+'</td>'
      +'<td class="pcs-ag">'+(((typeof laAgencyMark==='function')&&laAgencyMark(b,12,{pad:'0',radius:'0',margin:false}))
        ||('<div class="ck-agblk" title="'+e(agName)+'" style="background:'+agColor+';color:'+agInk+'">'+e(agName)+'</div>'))+'</td>';
  } else {
    headCells='<td><span class="ck-vch" title="'+e(b.voucherRef||b.code||'')+'">'+e(b.voucherRef||b.code||'—')+'</span>'
      +'<div style="margin-top:5px">'+(((typeof laAgencyMark==='function')&&laAgencyMark(b,12,{pad:'3px 9px',radius:'999px',margin:false,inline:true}))||('<span class="ck-agblk" title="'+e(agName)+'" style="display:inline-block;background:'+agColor+';color:'+agInk+';padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;max-width:175px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">'+e(agName)+'</span>'))+'</div>'
      +((_pckShowBy&&by)?'<div style="margin-top:3px;font-size:10px;color:#a5a49d">โดย <b style="color:#5F5E5A;font-weight:700">'+e(by)+'</b></div>':'')
    +'</td>';
  }
  return '<tr class="'+cls+'">'
   +headCells
   +'<td class="pcs-nm"'+pckNameTdAttr(r, sheet)+'>'+pckNameCell(r, sheet)+'</td>'
   +px('ad')+px('chd')+px('inf')+px('foc')
   +(sheet
     ? ('<td class="pcs-tm">'+(r._ovnBack
          ? '<span class="ck-pick" style="background:#EDE7FB;color:#5B289A;font-weight:800" title="ขากลับค้างคืน · ขึ้นเรือที่ท่าเกาะ ไม่มีรถไปรับ">&#8617; ไม่มีขารับ</span>'
          : ckTimeChip(tst, time, 'pier'))+'</td>'
        +'<td class="pcs-pk">'+(pickup?('<span class="ck-pick">'+(r._ovnBack?'&#8627; ส่ง ':'')+e(pickup)+'</span>'):'<span class="ck-dim">—</span>')
          +(r.priv?' <span class="pcs-prv" title="รถเหมา · ไม่แชร์">เหมา'+(r.priv.qty>1?(' ×'+r.priv.qty):'')+'</span>':'')
          +pckDropHtml(b, date)
          +(r._ovnBack&&r._ovnOut?('<div class="pcs-sub">ไปเมื่อ <b>'+e((typeof ovnDayTh==='function')?ovnDayTh(r._ovnOut):r._ovnOut)+'</b></div>'):'')+'</td>'
        +'<td class="ck-c pcs-rm">'+(room?('<span class="ck-mono">'+e(room)+'</span>'):'<span class="ck-dim">—</span>')+'</td>'
        +'<td class="pcs-zn">'+(pArea?('<span class="ck-area">'+e(pArea)+'</span>'):'<span class="ck-dim">—</span>')+'</td>')
     : '<td>'+(r._ovnBack
       /* §ovnCard · ขากลับไม่มีเวลารับ · ชิปเวลาจะกลายเป็น "สาย" ทั้งที่ไม่เคยมีนัดรับ */
       ? '<span class="ck-pick" style="background:#EDE7FB;color:#5B289A;font-weight:800" title="ขากลับค้างคืน · ขึ้นเรือที่ท่าเกาะ ไม่มีรถไปรับ">&#8617; ไม่มีขารับ &middot; มาจากเกาะ</span>'
         +(r._ovnOut?('<div style="margin-top:4px;font-size:10.5px;color:#a5a49d">ไปเมื่อ <b style="color:#5B289A">'+e((typeof ovnDayTh==='function')?ovnDayTh(r._ovnOut):r._ovnOut)+'</b></div>'):'')
       : ckTimeChip(tst, time, 'pier'))
     +(pickup?'<div style="margin-top:5px"><span class="ck-pick"'+(r._ovnBack?' title="จุดส่ง · ขากลับส่งเข้าโรงแรม"':'')+'>'+(r._ovnBack?'&#8627; ส่ง ':'')+e(pickup)+'</span></div>':'')
     +((room||pArea||r.priv)?'<div style="margin-top:4px;font-size:10.5px;color:#a5a49d">'
        +(room?'Room <b style="color:#5F5E5A;font-family:\'DM Mono\',monospace">'+e(room)+'</b>':'')
        +((room&&pArea)?' · ':'')
        +(pArea?'<span class="ck-area">'+e(pArea)+'</span>':'')
        +(r.priv?' <span title="รถเหมา · ไม่แชร์" style="display:inline-block;background:#F4E8FB;color:#6B289A;font-weight:700;font-size:9px;padding:1px 6px;border-radius:6px;white-space:nowrap">เหมา'+(r.priv.qty>1?(' ×'+r.priv.qty):'')+'</span>':'')
      +'</div>':'')
     +pckDropHtml(b, date)
   +'</td>')
   +'<td class="pcs-ao">'+pckAddonCell(r,date)+'</td>'
   +'<td class="pcs-sq">'+(sreq?'<div style="margin-bottom:5px"><span class="ck-sreq" title="'+e(sreq)+'">'+e(sreq)+'</span></div>':'')
     +pckMealCell(b, date, !!sheet, !!sheet)+'</td>'
   +(sheet?('<td class="ck-c pcs-gdc">'+pckGuideCell(b)+'</td>'):'')
   /* §pckNoStage · โหมดตารางไม่มีช่องสถานะแล้ว · ถึงท่า/เคลียร์ ทำที่โหมดการ์ด */
   +(sheet?'':('<td class="pcs-st">'+pckStageCell(r,date,sheet)+'</td>'))
   +'<td class="pcs-mn">'+pckMoneyCell(b,date,sheet)+'</td>'
   +'<td class="pcs-mg">'+(sheet?pckFlagTagsHtml(r,date):'')+'<div class="pck-acts">'
     +(_vd?('<span class="pck-vdchip" title="'+e(pckVoidLabel(_vd)+' · '+_vd.pax+' คน'+(_vd.reason?(' · '+_vd.reason):''))+'">&#10007; '+e(pckVoidLabel(_vd))+' · ไม่ต้องเช็คอิน</span>'
       // §ckPierFix · ปิดมาจากฝั่งรถ → ปุ่ม "ถอน" ของหน้าท่าใช้ไม่ได้ (ไม่มีรายการฝั่งนี้)
       //   ให้ปุ่มยืนยันว่ามาจริงแทน · บันทึกฝั่งรถไม่ถูกแตะ
       +((ckVanNsPax(b,date)>0 && !(ck.events&&ck.events.length))
         ? '<button onclick="event.stopPropagation();ckPierReinstate(\''+b.id+'\',\''+date+'\',true)" title="ลูกค้าตามมาเองที่ท่า · กดเพื่อเปิดแถวนี้ให้เช็คอินได้ (บันทึกของเช็คอินรถยังอยู่)" style="border:1px solid #B7E2D2;background:#E1F5EE;color:#0F6E56;border-radius:999px;padding:5px 11px;font-size:10.5px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">&#8617; มาแล้ว · เปิดเช็คอิน</button>'
         /* §ckBack · ของเดิมคือ ckEventUndo ที่ลบรายการทิ้งจริง · เปลี่ยนเป็นรับกลับที่เก็บประวัติ */
         : '<button class="pck-undo" onclick="event.stopPropagation();ckBackOpen(\''+b.id+'\',\''+date+'\',\'pier\')" title="เจอลูกค้าแล้ว รับกลับ · หรือแก้กรณีกดผิด">&#8617;&#65039; รับกลับ</button>')):(pckMgCore(r, b, date, _kd, on, ck, actual, !!sheet)))
     /* §pckTrim · โหมดตารางเหลือลูกศรพอ · คำว่า "รายละเอียด" ยาวกว่าปุ่มที่ต้องกดจริงทุกวัน
        โหมดการ์ดมีที่เหลือเฟือ เก็บคำไว้ตามเดิม */
     +(sheet
       ? '<button class="pck-go" onclick="event.stopPropagation();pckDetailOpen(\''+b.id+'\')" title="ดูรายละเอียดทั้งหมดของ booking นี้">&rsaquo;</button>'
       : '<button onclick="event.stopPropagation();pckDetailOpen(\''+b.id+'\')" title="ดูรายละเอียดทั้งหมดของ booking นี้" style="border:1px solid #D8D4CA;background:#fff;color:#4a4a45;border-radius:999px;padding:5px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">รายละเอียด</button>')
     +'</div>'
     /* §pckMgTight · ยอดจองไปอยู่ในตัวเลขแล้ว (ขึ้นเรือ/จอง)
        เหลือบรรทัดนี้เฉพาะตอนยอดรอรับไม่ตรงยอดจอง ซึ่งเป็นเคสที่ต้องสะดุดตาจริง ๆ */
     +((!sheet || booked!==r.booked)
        ? ('<div style="text-align:right;font-size:9px;color:#a5a49d;font-family:\'DM Mono\',monospace;margin-top:4px">จอง '+r.booked+(booked!==r.booked?(' · รอรับ '+booked):'')+'</div>')
        : '')
     +(tally.no_show>0?'<div style="text-align:right"><span class="ck-ns">No-show '+tally.no_show+'</span></div>':'')
     +(tally.cxl>0?'<div style="text-align:right"><span class="ck-cx">CXL '+tally.cxl+'</span></div>':'')
     +((noShow>0 && tally.total<noShow)?'<div style="text-align:right"><span class="ck-ns">ไม่ระบุเหตุ '+(noShow-tally.total)+'</span></div>':'')
     +rsn
   +'</td>'
   +'</tr>';
}
// หัวกล่องรถในการ์ดเรือ · กรอบกล่องใช้สีประจำรถ (เดียวกับ By-trip) · ข้อมูลอยู่บนพื้นขาว
function pckVanHead(vg, date, curBid){
  var e=ckEsc, vid=vg.vid, own=!vid;
  var veh=(!own && typeof vehGet==='function')?(vehGet(vid)||{}):{};
  var c=(!own && typeof vehChipPair==='function')?vehChipPair(vid):['#F4E8FB','#6B289A'];
  var col=own?(vg.zcol||'#6B289A'):(c[1]||'#6B289A');
  var rd=(!own && typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(vid,date)
        :{driver:veh.driver||'', phone:veh.driverPhone||'', plate:veh.plate||'', override:false, plateOverride:false};
  var gno=0; vg.rows.some(function(r){ var n=+((r.O&&r.O.vanGroup)||0); if(n>0){ gno=n; return true; } return false; });
  var a=pckAgg(vg.rows);
  var vck=vg.rows.filter(function(r){ return r.van&&r.van.at; }).length;
  var h='<div class="pck-vhd">';
  if(own){
    h+='<span class="pck-vpill" style="background:'+col+'">'+(vg.novan?'ยังไม่จัดรถ':'ไม่มีรถของเรา')+'</span>'
      +'<span class="pck-vmeta" style="white-space:normal">'+(vg.novan
          ?'อยู่ในโซนที่ต้องมีรถ แต่ยังไม่ได้จัด — เช็คก่อนว่าลูกค้าจะมาถึงท่ายังไง'
          :'ลูกค้ามาเอง หรือเอเย่นต์ส่งเอง — ต้องเช็คว่ามาถึงท่าหรือยัง')+'</span>';
  } else {
    h+=(gno?'<span class="pck-vnum" style="background:'+col+'" title="กรุ๊ปรถที่ '+gno+'">'+gno+'</span>':'')
      +'<span class="pck-vpill" style="background:'+col+'">'+e(veh.name||vid)+'</span>'
      +(rd.plate?'<span class="pck-vplate" style="color:'+col+';border-color:'+col+'66">'+e(rd.plate)+'</span>':'')
      +(rd.driver?'<span class="pck-vmeta">คนขับ <b>'+e(rd.driver)+'</b></span>':'<span class="pck-vmeta" style="color:#a5751f">ยังไม่ระบุคนขับ</span>')
      +(rd.phone?'<a class="pck-vtel" style="color:'+col+';border-color:'+col+'66" href="tel:'+e(String(rd.phone).replace(/[^0-9+]/g,''))+'" onclick="event.stopPropagation()">'+e(rd.phone)+'</a>':'')
      +'<span style="font-size:10.5px;font-weight:700;white-space:nowrap;color:'+(vck===vg.rows.length?'#0F6E56':'#a5a49d')+'">'
        +(vck===vg.rows.length?'&#10003; เช็คอินรถครบ':('เช็คอินรถแล้ว '+vck+'/'+vg.rows.length))+'</span>';
  }
  // §vanJoin · การ์ดนี้กรองตามเรือแล้ว คนอ่านเห็นแค่ส่วนของลำนี้ ไม่รู้ว่าคันเดียวกันยังต้องไปส่งอีกลำ
  if(vid) h+=pckVanJoinHtml(vid, date, curBid, 'pck-vjoin');
  var stCls=(a.due>0)?'money':((a.on===a.n)?'ok':'');
  var stTxt=(a.due>0)?('เก็บหน้าท่า &#3647;'+Math.round(a.due).toLocaleString()+' · '+a.pax+' pax')
        :((a.on===a.n)?('&#10003; ขึ้นเรือครบ · '+a.pax+' pax'):('ขึ้นเรือ '+a.on+'/'+a.n+' · '+a.pax+' pax'));
  h+='<span class="pck-vstat '+stCls+'">'+stTxt+'</span></div>';
  return h;
}
function pckBoatMeta(rows, date){
  var e=ckEsc;
  // §sharedStats · คิดที่ pckTripStats ที่เดียว ใบงานไกด์ใช้ตัวเดียวกัน เลขสองที่จะได้ตรงกันเสมอ
  var S=pckTripStats(rows, date);
  var real=S.real, book=S.book, lost=S.lost, lang=S.lang, meal=S.meal, ltJoin=S.ltJoin, ltChtr=S.ltChtr;
  var realTot=real.all;
  var J='<i>&middot;</i>';
  var px=function(k,lbl){ var n=real[k]||0, col=n?PCK_PX_INK[k]:'#cfccc4';
    return '<span class="pck-mv" style="color:'+col+'">'+n+'<span class="pck-mk" style="font-weight:600;color:'+col+';opacity:.62"> '+lbl+'</span></span>'; };
  var langs=Object.keys(lang).sort(function(a,b){ return lang[b]-lang[a]; }).map(function(c){
    var lc=(typeof bkV2LangColors==='function')?bkV2LangColors(c):['#F1EFE8','#5F5E5A'];
    return '<span class="pck-mv" style="color:'+(lc[1]||'#5F5E5A')+'">'+e(c)+' '+lang[c]+'</span>'; }).join(J);
  var mono=' style="font-family:\'DM Mono\',monospace"';
  var ml=[];
  if(meal.veg+meal.vegan) ml.push('<span class="pck-mk" style="color:#3B6D11">มังสวิรัติ <b'+mono+'>'+(meal.veg+meal.vegan)+'</b></span>');
  if(meal.halal)          ml.push('<span class="pck-mk" style="color:#0F6E56">ฮาลาล <b'+mono+'>'+meal.halal+'</b></span>');
  if(meal.allergy)        ml.push('<span class="pck-mk" style="color:#C0392B">&#9888; แพ้อาหาร <b'+mono+'>'+meal.allergy+'</b></span>');
  var lt=[];
  if(ltJoin) lt.push('<span class="pck-mk" style="color:#1565A8">จอย <b'+mono+'>'+ltJoin+'</b> คน</span>');
  if(ltChtr) lt.push('<span class="pck-mk" style="color:#5B289A">เหมา <b'+mono+'>'+ltChtr+'</b> ลำ</span>');
  return '<div class="pck-bmeta">'
    +'<div class="pck-mg"><span class="pck-mlab">เดินทางจริง</span>'
      +'<span class="pck-mbig">'+realTot+'</span><span class="pck-munit">pax</span>'
      +'<span style="display:flex;align-items:baseline">'+px('ad','AD')+J+px('chd','CHD')+J+px('inf','INF')+J+px('foc','FOC')+'</span>'
      +(lost>0?('<span class="pck-mk" style="color:#C0392B">จอง '+book+' · หาย <b'+mono+'>'+lost+'</b></span>')
              :'<span class="pck-mdim">ครบตามจอง</span>')
    +'</div>'
    +'<div class="pck-mg"><span class="pck-mlab">ไกด์</span>'+(langs||'<span class="pck-mnone">&mdash;</span>')+'</div>'
    +'<div class="pck-mg"><span class="pck-mlab">อาหารพิเศษ</span>'+(ml.length?ml.join(J):'<span class="pck-mnone">ไม่มี</span>')+'</div>'
    +'<div class="pck-mg"><span class="pck-mlab">หางยาว</span>'+(lt.length?lt.join(J):'<span class="pck-mnone">ไม่มี</span>')+'</div>'
    +'</div>';
}
function pckTripStats(rows, date){
  var real={ad:0,chd:0,inf:0,foc:0}, book=0, lost=0;
  var lang={}, meal={veg:0,vegan:0,halal:0,allergy:0}, ltJoin=0, ltChtr=0;
  // §cxlAddon (2026-08-03) · No-show / CXL หน้างานต้องหักของแถมตามไปด้วย
  //   เดิมทุกยอดข้างล่างคิดจาก "จองมา" (tot) ทั้งที่ยอดคนคิดจาก "เดินทางจริง" (real)
  //   ผลคือยกเลิก 2 คนแล้วเลขคนลดลง แต่ Longtail จอย / ภาษาไกด์ ยังเท่าเดิม
  //   → ของแถมรายหัวใช้ realTot · ของแถมรายลำหักเมื่อยกเลิกทั้งใบเท่านั้น (ลำยังต้องออก ถ้ายังมีคนไป)
  (rows||[]).forEach(function(r){
    /* §pckStatsSkip (2026-09-12) · pckAgg() ข้ามแถว strand (ยกเลิกแล้วแต่ยังจัดเรือค้างไว้)
       และแถว _vd (ปิดรายการหน้างาน) มาตลอด · แต่ตัวนี้ไม่เคยข้าม
       แถว strand ถูกล้าง booked/expect เป็น 0 ก็จริง แต่ตัวนี้อ่าน t.pax ดิบ ๆ
       คนที่ออฟฟิศยกเลิกไปแล้วจึงยังถูกนับเป็น "เดินทางจริง" เต็มจำนวน
       วัดจริงบนข้อมูล 24 ก.ค. เรือ Artemis · ที่นั่ง 58 แต่เดินทางจริง 66
       ต่างกัน 8 คน = แถวค้างจัดการ 4 ใบ · เลขสองตัวอยู่บนแถบสีเดียวกัน */
    if(r.strand || r._vd) return;
    var b=r.b, t=r.t, pb=ckPaxBreak(t.pax), tot=0, realTot=0;
    ['ad','chd','inf','foc'].forEach(function(k){
      var bk=pb[k]||0; book+=bk; tot+=bk;
      var left=(typeof ckPaxLeft==='function')?ckPaxLeft(b,date,k,bk):bk;
      real[k]+=left; realTot+=left; lost+=Math.max(0,bk-left);
    });
    var gone=(tot>0 && realTot<=0);                      // ยกเลิกยกใบ · ไม่เหลือใครเดินทาง
    // §langNorm · อ่านจาก pckGuideLangs ตัวเดียวกับป้ายในแถว · เลขหัวใบกับป้ายจะได้ตรงกันเสมอ
    var addL=function(c,n){ if(!c||!n) return; lang[c]=(lang[c]||0)+n; };
    ((typeof pckGuideLangs==='function')?pckGuideLangs(b):[]).forEach(function(c){ addL(c,realTot); });
    // อาหาร · ยกเลิกบางส่วนยังทำเผื่อไว้ (ไม่รู้ว่าคนที่ไม่มาคือคนที่สั่งอะไร ทำขาดเสียหายกว่าทำเกิน)
    //   ยกเลิกทั้งใบเท่านั้นที่ตัดออก
    var mm=gone?{}:(b.specialMeals||{});
    meal.veg+=+mm.veg||0; meal.vegan+=+mm.vegan||0; meal.halal+=+mm.halal||0;
    meal.allergy+=(typeof bkV2AllergyCount==='function')?bkV2AllergyCount(mm):(String(mm.allergies||'').trim()?1:0);
    /* §ltOne · รวมของที่จองมา + ขายเพิ่มหน้างาน + อัปเกรด ไว้ที่ bkLtState ที่เดียว */
    var LT=(typeof bkLtState==='function')?bkLtState(b,t.routeId,date):{mode:'none'};
    if(!gone){
      if(LT.mode==='charter') ltChtr+=LT.boats;               // เหมาลำ · ยังต้องออกถ้ายังมีคนไป
      else if(LT.mode==='join'){
        if(LT.joinBooked) ltJoin+=realTot;                    // จอย · คิดรายหัวตามคนที่ไปจริง
        ltJoin+=LT.joinExtra;                                 // ที่ขายเพิ่มหน้างาน · qty คือจำนวนคน
      }
    }
  });
  real.all=real.ad+real.chd+real.inf+real.foc;
  return { real:real, book:book, lost:lost, lang:lang, meal:meal, ltJoin:ltJoin, ltChtr:ltChtr };
}

// รายการ add-on ของบุ๊คกิ้งหนึ่งใบ · แหล่งเดียวกับคอลัมน์ Add-on ของหน้าท่า (ckAddonList)
function pckJobAddons(r){
  var out=[];
  try{ (ckAddonList(r.b, r.t.routeId)||[]).forEach(function(a){
    out.push(a.label+(a.note?(' ('+a.note+')'):'')); }); }catch(_){}
  return out;
}
// §timeCol (2026-08-01) · เวลารับต้องอยู่บรรทัดเดียว ไม่งั้นแถวสูงเป็นสองเท่าและกินที่ฟรี
//   แถวมาเองเคยขึ้นว่า "Before 08:30 at pier มาเอง" ยาวจนตัดสองบรรทัดทั้งบล็อก (เจอจริง 1 ส.ค. · 12 แถว)
//   ตัดสองส่วนที่ซ้ำกับช่องอื่นบนแถวเดียวกันออก — "มาเอง" หัวกลุ่มบอกแล้ว
//   ส่วน "at pier / ที่ท่า" ช่องสถานที่รับข้างๆ เขียน Visit Panwa Pier อยู่แล้ว
function pckJobTime(t, arr){
  var x=String(t||'—').trim();
  if(arr==='OWN'||arr==='NOVAN') x=x.replace(/\s*(at\s+the\s+pier|at\s+pier|ที่\s*ท่า(เรือ)?)\s*$/i,'').trim();
  return x||'—';
}
// รายชื่อผู้โดยสารทั้งหมดของบุ๊คกิ้ง · ครบทุกคน ไม่ตัด
function pckJobNames(b){
  var lead=String((b&&b.leadPax)||'').trim();
  var ex=((b&&b.passengers)||[]).map(function(p){ return String((p&&p.name)||'').trim(); })
         .filter(function(n){ return n && n!==lead; });
  return { lead:lead, ex:ex, tot:(lead?1:0)+ex.length };
}

function pckGuideJobCss(){ return '<style>'
  +'@page{size:A4 landscape;margin:0}'
  +'*{box-sizing:border-box}'
  +'body{margin:0;background:#eef0f3;font-family:"DM Sans",sans-serif;color:#111827;font-size:12px;'
    +'-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  +'.mono{font-family:"DM Mono",monospace;font-variant-numeric:tabular-nums}'
  +'.tools{position:sticky;top:0;z-index:9;background:#fff;border-bottom:1px solid #d1d5db;padding:10px 18px;display:flex;gap:10px;align-items:center}'
  +'.tools b{font-size:13px}.tools .h{font-size:11px;color:#6b7280}'
  +'.tools button{margin-left:auto;background:#111827;color:#fff;border:none;border-radius:9px;padding:9px 18px;font:700 12px inherit;cursor:pointer}'
  +'.sheet{width:297mm;min-height:210mm;height:auto;overflow:visible;margin:14px auto;background:#fff;padding:7mm 8mm;'   /* §guidePreview · บนจอต้องเห็นเท่ากับที่พิมพ์ */
    +'box-shadow:0 4px 18px rgba(0,0,0,.12);position:relative;display:block}'   /* §guideHead2 · เลิก flex · กล่องธรรมดาแบ่งหน้าตอนพิมพ์ได้นิ่งกว่า */
  // ── หัวใบ · ยุบเหลือแถวเดียว ──
  +'.jh{display:flex;align-items:center;gap:12px;padding:7px 12px;border-radius:11px;flex:none}'
  +'.jlogo{width:38px;height:38px;border:2px solid currentColor;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex:none}'
  +'.jt1{font-size:14px;font-weight:700;line-height:1.1}'
  +'.jt2{font-size:9px;opacity:.72;letter-spacing:.07em;text-transform:uppercase}'
  +'.jbname{font-size:22px;font-weight:700;line-height:1;letter-spacing:-.3px}'
  +'.jbsub{font-size:11px;opacity:.92;margin-top:2px}'
  +'.jdep{display:inline-block;border:2px solid currentColor;border-radius:6px;padding:1px 8px;font-weight:700;font-size:12.5px;margin-left:6px}'
  +'.jdate{margin-left:auto;text-align:right;font-size:11px}'
  +'.jfill{border-bottom:1px dotted currentColor;opacity:.75;min-width:98px;display:inline-block;height:13px}'
  +'.jfilled{font-weight:700;font-size:12px}'   /* §crewPaper · ชื่อไกด์จริงแทนเส้นประ */
  +'.jcrew{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-top:4px;padding:3px 11px;'
    +'border:1px solid #d1d5db;border-radius:7px;flex:none}'
  +'.jcrew .jcv{font-size:11.5px;font-weight:600}'
  // ── แถบสรุป ──
  +'.jsum{display:flex;border:1.5px solid #111827;border-radius:8px;margin-top:6px;overflow:hidden;flex:none}'
  +'.jsc{padding:5px 11px;border-right:1px solid #d1d5db;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}'
  +'.jsc:last-child{border-right:none}'
  +'.jslab{font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em}'
  +'.jsbig{font-size:20px;font-weight:700;line-height:1;font-family:"DM Mono",monospace}'
  +'.jsv{font-size:12.5px;font-weight:600}.jsv i{font-style:normal;color:#9ca3af;padding:0 4px}'
  +'.jsnone{font-size:11px;color:#9ca3af}'
  +'.jwarn{border:1.5px solid #111827;border-radius:999px;padding:0 8px;font-size:10.5px;font-weight:700}'
  // ── ตาราง · 1 บุ๊คกิ้ง = 1 แถว ──
  +'.tw{margin-top:6px;overflow:visible}'   /* §guidePage2 + §guideHead2 · ไหลตามเนื้อหา ไม่ต้องยืดเต็มกล่องแล้ว */
  +'thead{display:table-header-group}'          /* §guidePage2 · หัวตารางซ้ำทุกหน้า */
  /* §guideHead2 · ตารางชั้นนอกที่ทำหน้าที่พา "หัวใบ" ไปซ้ำทุกหน้า
     ต้องโปร่งใสทุกอย่าง ไม่มีเส้น ไม่มีพื้น ไม่งั้นจะเห็นกรอบซ้อนกับตารางข้อมูล
     (เลือกใช้ตัวเลือกที่เจาะจงกว่า table/td ทั่วไป จะได้ชนะโดยไม่ต้องพึ่งลำดับ) */
  +'table.pgt{width:100%;border:none;border-collapse:collapse;table-layout:auto}'
  +'table.pgt > thead > tr > td,table.pgt > tbody > tr > td{border:none;padding:0;vertical-align:top;background:transparent}'
  +'table.pgt > tbody > tr,table.pgt > tbody > tr > td{break-inside:auto;page-break-inside:auto}'   /* แถวเดียวที่ยาวทั้งใบ ต้องแบ่งหน้าได้ */
  +'tr{break-inside:avoid;page-break-inside:avoid}'   /* §guidePage2 · ห้ามตัดกลางแถว */
  // §guideGrid · กระดาษที่กรอกด้วยมือหน้าท่า ต้องมีเส้นให้สายตาไล่ · เส้นเดิมจางเกินไป
  +'table{width:100%;border-collapse:collapse;border:1.4px solid #111827}'
  +'th{font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:4px 6px;'
    +'border-bottom:1.4px solid #111827;border-right:1px solid #6b7280;background:#f3f4f6}'
  +'td{padding:4px 6px;border-bottom:1px solid #9aa1ac;border-right:1px solid #c3c8d0;vertical-align:middle;font-size:11.8px;line-height:1.35}'
  +'th:last-child,td:last-child{border-right:none}'
  +'tr.grp td{background:#e8eaee;border-top:1.4px solid #111827;border-bottom:1.4px solid #111827;border-right:none;padding:4px 8px}'
  +'.gvan{font-weight:700;font-size:13px}'
  +'.gmeta{font-size:11.5px;color:#374151}.gmeta b{font-family:"DM Mono",monospace}'
  +'.gtot{float:right;font-size:12px;font-weight:700}'
  +'.gjoin{display:inline-block;border:1.5px solid;border-radius:4px;padding:0 8px;font-size:10.5px;font-weight:700;margin-left:7px;white-space:nowrap}'
  +'.gjoin.alt{border-style:dashed}'
  /* §gvanHead · ป้ายบอกว่ากลุ่มรถนี้มีใบที่แยกขึ้นหลายคัน */
  +'.gsplit{display:inline-block;border:1.5px solid #6B289A;background:#F4E8FB;color:#4A2E86;'
  +'border-radius:4px;padding:0 8px;font-size:10.5px;font-weight:700;margin-left:7px;white-space:nowrap}'
  /* §gvanHead3 · ขีดคั่นระหว่างคันหลักกับคันร่วม */
  +'.gvsep{color:#9CA3AF;font-weight:700;margin:0 7px}'
  +'.ck{width:14px;height:14px;border:1.5px solid #111827;border-radius:2px;display:block;margin:1px auto 0}'
  +'.vc{font-family:"DM Mono",monospace;font-weight:700;font-size:11.5px;word-break:break-all;line-height:1.15;display:inline-block}'
  +'.nmc{line-height:1.35}.nmc b{font-weight:700;font-size:12.2px}'
  +'.ex{color:#374151;font-size:10px}'
  +'.tel{color:#6b7280;font-size:11px;white-space:nowrap;margin-left:4px}'
  +'.lg{display:inline-block;border:1.5px solid #111827;border-radius:3px;padding:0 5px;font-family:"DM Mono",monospace;font-size:10px;font-weight:700;white-space:nowrap;line-height:1.5}'
  +'.lg.alt{background:#111827;color:#fff}'
  +'.lgc{text-align:center;padding-left:2px !important;padding-right:2px !important}'
  +'.pk{line-height:1.3}'
  +'.num{text-align:center;font-family:"DM Mono",monospace;font-size:13.5px;font-weight:700;padding-left:1px !important;padding-right:1px !important}'
  +'.num.z{color:#d1d5db;font-weight:400}'
  +'.num s{font-size:8px;color:#9ca3af;font-weight:400;margin-left:2px}'
  +'.tm{font-family:"DM Mono",monospace;font-weight:700}'
  +'.tmc{white-space:nowrap}'
  +'.pl2{font-size:10.5px;color:#6b7280}'
  // §jobDrop · จุดส่งต่างจากจุดรับ = ของที่พลาดไม่ได้ → ขึ้นบรรทัดใหม่ ตัวหนา มีกรอบซ้าย
  +'.drp{display:block;font-size:10.5px;font-weight:700;color:#111827;border-left:2.5px solid #111827;'
  +'padding-left:5px;margin-top:2px;line-height:1.25}'
  +'.drp.self{font-weight:600;color:#4b5563;border-left-style:dashed}'
  +'.sheet.d3 .drp{font-size:9.6px}.sheet.d4 .drp{font-size:9px}'
  +'.ao{display:inline-block;border:1.5px solid #111827;border-radius:3px;padding:1px 6px;font-size:10.5px;font-weight:700;margin:0 2px 2px 0;white-space:normal}'
  +'.sq{font-weight:600}.dash{color:#9ca3af}'
  // ── ระดับความหนาแน่น · เลือกตามจำนวนบรรทัดที่ต้องวาง ไม่ตัดข้อมูล แค่บีบระยะ ──
  +'.sheet.d2 td{padding:2.6px 5px;font-size:10.8px}.sheet.d2 .nmc b{font-size:11.2px}.sheet.d2 .vc{font-size:10.8px}'
  +'.sheet.d2 .tel{font-size:10.3px}.sheet.d2 .lg{font-size:9px}.sheet.d2 tr.grp td{padding:2.4px 7px}.sheet.d2 .num{font-size:12.4px}.sheet.d2 .gvan{font-size:12px}.sheet.d2 .gmeta{font-size:10.5px}'
  +'.sheet.d3 td{padding:1.6px 4px;font-size:9.9px;line-height:1.3}.sheet.d3 .nmc b{font-size:10.2px}.sheet.d3 .vc{font-size:9.9px}'
  +'.sheet.d3 tr.grp td{padding:1.6px 6px}.sheet.d3 .gvan{font-size:11px}.sheet.d3 .gmeta{font-size:9.6px}'
  +'.sheet.d3 .num{font-size:11.3px}.sheet.d3 .ao{font-size:9.4px;padding:0 5px}.sheet.d3 .tel{font-size:9.4px}.sheet.d3 .lg{font-size:8.8px;padding:0 4px}'
  +'.sheet.d4 td{padding:1px 4px;font-size:9px;line-height:1.26}.sheet.d4 .nmc b{font-size:9.3px}.sheet.d4 .vc{font-size:9px}'
  +'.sheet.d4 tr.grp td{padding:1px 6px}.sheet.d4 .gvan{font-size:10px}.sheet.d4 .gmeta{font-size:9px}'
  +'.sheet.d4 .num{font-size:10.3px}.sheet.d4 .ao{font-size:8.6px;padding:0 4px}.sheet.d4 .tel{font-size:8.6px}.sheet.d4 .lg{font-size:8.2px;padding:0 3px}'
  +'.sheet.d4 .jsbig{font-size:15px}.sheet.d4 th{padding:2px 4px}'
  // ── ปากกาเน้นข้อความ · แถบเครื่องมือไม่ติดไปกับกระดาษ ──
  +'.svc{display:inline-block;border:1.5px solid #111827;border-radius:3px;padding:1px 6px;font-size:10.5px;font-weight:700;margin:0 2px 2px 0;white-space:nowrap}'
  +'.nt{line-height:1.3}.nt b{font-weight:700}.nt .n2{color:#374151;font-size:10.5px}'
  +'@media print{body{background:#fff}.tools{display:none}'
    +'.sheet{width:100%;height:auto;min-height:210mm;margin:0;box-shadow:none;page-break-after:always}'   /* §guidePage2 */
    +'.sheet:last-child{page-break-after:auto}}'
  +'</style>';
}

function pckGuideJobSheet(bid, date, rows, vd){
  var e=ckEsc;
  var boat=(typeof getBoat==='function'?getBoat(bid):null)||{};
  // §ovnBack · เส้นทางบนหัวใบอ่านจากทริปปกติ · ขากลับค้างคืนอาศัยเรือมา ไม่ใช่เจ้าของโปรแกรม
  var _ovnG=(rows||[]).filter(function(r){ return r._ovnBack; });
  var _rHead=(rows||[]).filter(function(r){ return !r._ovnBack; });
  if(!_rHead.length) _rHead=(rows||[]);
  var rid=(_rHead[0]&&_rHead[0].t&&_rHead[0].t.routeId)||'';
  var rt=(typeof getRoute==='function'?getRoute(rid):null)||{};
  var dep=(typeof pckDepOf==='function')?pckDepOf(rid):'';
  var S=pckTripStats(rows, date), t=S.real;
  var dTh=''; try{ dTh=new Date(date+'T00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(_){ dTh=date; }
  var J='<i>&middot;</i>';

  var langs=Object.keys(S.lang).sort(function(a,b){ return S.lang[b]-S.lang[a]; })
    .map(function(c){ return pckGuideBadge([c])+' '+S.lang[c]; }).join(J);
  var M=S.meal, ml=[];
  if(M.veg+M.vegan) ml.push('มังสวิรัติ '+(M.veg+M.vegan));
  if(M.halal) ml.push('ฮาลาล '+M.halal);
  var lt=[];
  if(S.ltJoin) lt.push('Join '+S.ltJoin+' คน');
  if(S.ltChtr) lt.push('Charter '+S.ltChtr+' ลำ');
  var vans={}; rows.forEach(function(r){ if(r.vanId) vans[r.vanId]=1; });
  /* §crewPaper · ไกด์และทีมเรือของลำนี้วันนี้ · มาจากใบสั่งงานมัคคุเทศก์และใบงานเรือ
     ของเดิมหัวใบเว้นเส้นประให้เขียนชื่อไกด์เอง ทั้งที่จ่ายไกด์ลงลำไว้ในระบบแล้ว
     ยังไม่จ่าย/ยังไม่จัด = คงเส้นประไว้เหมือนเดิม ไม่ได้บังคับให้ต้องมีในระบบก่อนถึงพิมพ์ได้ */
  var _gdN='', _islTxt='', _crewTxt='';
  try{
    /* §gdRole · เฉพาะไกด์/ไกด์ฝึกหัดขึ้นช่อง "ไกด์" · นักศึกษาฝึกงาน/สต๊าฟไปรวมกับ ผช.ไกด์
       กติกาเดียวกับใบสั่งงานมัคคุเทศก์ · สองใบที่พิมพ์วันเดียวกันจะได้ไม่แบ่งคนคนละแบบ */
    var _GF=(typeof pjGuidesFull==='function')?pjGuidesFull(date,bid):[];
    var _C=(typeof pjCrewOf==='function')?pjCrewOf(date,bid):null;
    _gdN=_GF.filter(function(x){ return x.guide; }).map(function(x){ return x.name; })
            .filter(Boolean).join(' · ');
    _islTxt=_GF.filter(function(x){ return !x.guide; }).map(function(x){ return x.name; })
            .concat((_C&&_C.island)||[]).filter(Boolean).join(' · ');
    _crewTxt=(typeof pjCrewLine==='function')?pjCrewLine(date,bid):'';
  }catch(_){}
  // §svcLegend · คำอธิบายสัญลักษณ์ต้องมาจากใบนี้ ไม่ใช่พิมพ์ตายตัว
  //   ใบที่มีแต่ Longtail ไม่ได้ใช้ + / ⬆ / * เลย · อธิบายไปก็ทำให้คนไล่หาของที่ไม่มี
  var _svcN=0, _svcP=0, _svcU=0, _svcS=0;
  rows.forEach(function(r){
    try{ (pckJobService(r,date)||[]).forEach(function(a){
      var t=String(a.t||''); _svcN++;
      if(t.charAt(0)==='+') _svcP++;
      if(t.charAt(0)==='\u2b06') _svcU++;
      if(/\*\s*$/.test(t)) _svcS++;
    }); }catch(_){}
  });
  var _svcLg=[];
  if(_svcP) _svcLg.push('+ ขายหน้าท่า');
  if(_svcU) _svcLg.push('&#11014; อัปเกรด');
  if(_svcS) _svcLg.push('* ยังไม่เก็บเงิน');

  // §uniform (2026-08-01) · ค่าที่เหมือนกันทุกแถว ไม่ใช่ข้อมูล มันคือพื้นหลัง
  //   เทียบใบ Artemis (31 ก.ค.) กับ Hermetis วันเดียวกัน — Artemis มี Longtail Join 20/27 แถว
  //   และ RU ทั้ง 27 แถว ป้ายเลยกลายเป็นกำแพงสีที่ไม่ได้บอกอะไร ส่วน Hermetis มีแค่ 2 แถว จึงเด้งออกมาทันที
  //   สีจะทำงานได้ต่อเมื่อมันเป็นของหายาก · ค่าที่ทุกใบมีเหมือนกันให้ย้ายขึ้นหัวใบ แล้วยุบคอลัมน์ทิ้ง
  //   คืนความกว้างให้ชื่อกับสถานที่รับ ซึ่งเป็นสองช่องที่ตัดบรรทัดบ่อยที่สุด
  var _sigOf=function(a){ return (a||[]).map(function(x){ return x.t; }).join(' | '); };
  var uniSvc='', uniLang='';
  (function(){
    if(rows.length<6) return;                       // ใบเล็กเก็บป้ายไว้ ยุบแล้วไม่ได้อะไรคืนมา
    var sv={}, lg={}, ks, kl;
    rows.forEach(function(r){ sv[_sigOf(pckJobService(r,date))]=1; lg[pckGuideLangs(r.b).join('/')]=1; });
    ks=Object.keys(sv); kl=Object.keys(lg);
    // §guideSvcFull · ไม่ยุบช่อง Service อีกแล้ว · ของอย่างฉลามวาฬที่ทุกใบมีเหมือนกัน
    //   ไกด์ต้องเห็นรายแถวเพื่อเช็คตัวคน ไม่ใช่เห็นแค่ยอดรวมบนหัวใบ
    if(ks.length===1 && ks[0]) uniSvc='';
    if(kl.length===1 && kl[0]) uniLang=kl[0];
  })();
  var showSvc=!uniSvc, showLang=!uniLang;
  var wName=31+5, wPick=18+4;   // §guideBig · รับที่ว่างจากคอลัมน์เวลารับที่ตัดออก
  if(!showSvc){ wName+=6; wPick+=4; }
  if(!showLang){ wName+=2; wPick+=2; }

  // §autoFit (2026-08-01) · เลิกเดาจำนวนบรรทัดจากจำนวนตัวอักษร
  //   การเดาพลาดได้สองทางและเสียทั้งคู่ — เดาน้อยไปตารางล้นทับ เดามากไปตัวหนังสือเล็กเกินจำเป็น
  //   (เจอจริง 1 ส.ค. · 28 booking ได้ d3 ตัวเล็ก แต่พิมพ์ออกมาเหลือที่ว่างล่างเกือบ 40%)
  //   เริ่มที่ระดับใหญ่สุดเสมอ แล้วให้สคริปต์วัดความสูงจริงหลังเรนเดอร์เป็นคนลดให้เท่าที่จำเป็น
  var dens = 1;

  var rowHtml=function(r){
    var b=r.b, pb=ckPaxBreak(r.t.pax), NM=pckJobNames(b);
    // §sameBasis · แถวต้องใช้ฐานเดียวกับแถบสรุปและหัวกลุ่ม = เดินทางจริง (จอง − ที่หายไปแล้ว)
    // ถ้ามีคนหาย โชว์ยอดจองเดิมขีดฆ่าไว้ข้างๆ ไกด์จะได้เห็นทั้งสองตัวเลขบนกระดาษ
    var num=function(k){
      var bkd=pb[k]||0;
      var left=(typeof ckPaxLeft==='function')?ckPaxLeft(b,date,k,bkd):bkd;
      if(left===bkd) return '<td class="num'+(bkd?'':' z')+'">'+bkd+'</td>';
      return '<td class="num"><b>'+left+'</b><s>'+bkd+'</s></td>';
    };
    // ทุกอย่างอยู่บรรทัดเดียว · รายชื่อไหลต่อจากชื่อ lead ในช่องเดียวกัน
    // บุ๊คกิ้งปกติ 1-4 ชื่อ = 1 บรรทัดจริง · กรุ๊ปใหญ่ไหลลงบรรทัดถัดไปเท่าที่จำเป็น ไม่ตัดชื่อทิ้ง
    var ph=b.leadPhone||b.phone||b.customerPhone||'';
    // §jobGuideLang (2026-08-01) · ไกด์ต้องรู้ตั้งแต่บนกระดาษว่าใบไหนต้องพูดภาษาอะไร
    //   แถบสรุปหัวใบบอกแค่ยอดรวม (EN 12 · RU 4) ซึ่งไม่ช่วยตอนยืนเรียกชื่อทีละกลุ่ม
    //   อ่านจาก bk.guides ชุดเดียวกับที่ pckTripStats ใช้นับหัวใบ เลขสองที่จะได้ตรงกันเสมอ
    var _lgs=pckGuideLangs(b);
    //   ไม่ได้ตั้งสีไว้ = ใช้กติกาหมึกทึบเหมือนเดิม (ทึบ = ไม่ใช่อังกฤษ) · ตั้งสีแล้วสีชนะ
    var lgHtml=pckGuideBadge(_lgs);
    var names='<b>'+e(NM.lead||'—')+'</b>'
      +(NM.ex.length?('<span class="ex"> &middot; '+NM.ex.map(e).join(' &middot; ')+'</span>'):'')
      +(ph?('<span class="tel mono"> '+e(ph)+'</span>'):'');
    var veh=r.vanId?((typeof vehGet==='function'?vehGet(r.vanId):null)||{}):null;
    var rd=(r.vanId&&typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(r.vanId,date):{plate:(veh&&veh.plate)||''};
    var time=r.O.pickupTimeFinal||r.t.pickupTime||'—';
    var pickup=b.hotelName||b.pickup||'';
    var room=b.roomNo||b.room||b.roomNumber||'';
    var area=b.pickupArea||(b.pickupAreaId&&typeof bkV2GetArea==='function'?((bkV2GetArea(b.pickupAreaId)||{}).name||''):'')||'';
    var dropOff=pckJobDrop(b, date);                                     // §jobDrop
    var ao=pckJobService(r, date);
    var nt=pckJobNote(b, date);
    return '<tr>'
      +'<td><span class="ck"></span></td>'
      +'<td><span class="vc">'+e(b.voucherRef||b.code||'—')+'</span></td>'
      +'<td class="nmc">'+names+'</td>'
      +num('ad')+num('chd')+num('inf')+num('foc')
      /* §guideBig · ตัดคอลัมน์เวลารับออก · เป็นข้อมูลของคนขับรถ ใบงานรถมีอยู่แล้ว */
      +'<td class="pk">'
        +(r._ovnBack?('<span style="display:block;color:#5B289A;font-weight:700;font-size:.94em">&#8617; รับกลับจากเกาะ'
            +(r._ovnOut?(' &middot; ไปเมื่อ '+e((typeof ovnDayTh==='function')?ovnDayTh(r._ovnOut):r._ovnOut)):'')+'</span>'):'')
        +e(pickup||area||'ท่าเรือ (มาเอง)')
        +(room?('<span class="pl2"> ห้อง '+e(room)+'</span>'):'')
        +((pickup&&area)?('<span class="pl2"> &middot; '+e(area)+'</span>'):'')
        +(dropOff?('<span class="drp'+(dropOff.self?' self':'')+'">'
            +(dropOff.t?('&#8627; ส่ง '+e(dropOff.t)):'')
            +(dropOff.van?((dropOff.t?' · ':'')+e(ckRetVanTxt(dropOff.van))):'')
          +'</span>'):'')+'</td>'
      +(showSvc?('<td>'+(ao.length?ao.map(function(a){
          var _c=a.c||'', _i=(_c&&typeof bkV2ContrastInk==='function')?bkV2ContrastInk(_c):'#111827';
          return '<span class="svc"'+(_c?(' style="background:'+_c+';color:'+_i+'"'):'')+'>'+e(a.t)+'</span>';
        }).join(''):'<span class="dash">&mdash;</span>')+'</td>'):'')
      +(showLang?('<td class="lgc">'+lgHtml+'</td>'):'')
      +'<td class="nt">'+(nt.length?nt.map(function(x){ return x.w?('<b>'+e(x.t)+'</b>'):('<span class="n2">'+e(x.t)+'</span>'); }).join('<br>'):'<span class="dash">&mdash;</span>')+'</td>'
      +'</tr>';
  };

  // จัดกลุ่มแบบเดียวกับหน้าจอ · โซน → รถ
  var body='';
  ['PK','KL','OWN','NOVAN'].forEach(function(zk){
    var zr=rows.filter(function(r){ return r.arr===zk && !r._ovnBack; }); if(!zr.length) return;
    var vgs={}, vord=[];
    zr.forEach(function(r){
      var vk=ckGroupVanId(r)||'__own';   /* §gvanSplit */
      if(!vgs[vk]){ vgs[vk]={vid:ckGroupVanId(r)||'', rows:[], gno:0}; vord.push(vk); }
      vgs[vk].rows.push(r);
      var gn=+((r.O&&r.O.vanGroup)||0); if(gn>0 && (!vgs[vk].gno||gn<vgs[vk].gno)) vgs[vk].gno=gn;
    });
    vord.sort(function(a,b){
      if(a==='__own') return 1; if(b==='__own') return -1;
      return (vgs[a].gno||99)-(vgs[b].gno||99)
        || String(pckVanName(vgs[a].vid)).localeCompare(String(pckVanName(vgs[b].vid)));
    });
    vord.forEach(function(vk){
      var vg=vgs[vk], st=pckTripStats(vg.rows, date), head;
      if(vg.vid){
        head=pckVanHeadHtml(vg.vid, date);   /* §gvanHead3 */
        // §vanJoin · ไกด์ที่ถือใบนี้จะได้ไม่ยืนรอคนที่รถคันเดียวกันพาไปลงอีกลำ
        head+=pckVanJoinHtml(vg.vid, date, bid, 'gjoin');
        /* §gvanHead3 · กลุ่มนี้มีใบที่แยกขึ้นหลายคัน · พิมพ์คันร่วมให้ครบชุด
           คั่นด้วย / ตามที่ขอ · ป้ายนับใบอยู่ข้างหน้า บอกว่ามีกี่ใบที่แยก */
        var _gs=ckVanGroupSplit(vg.rows, vg.vid);
        if(_gs.n){
          head+='<span class="gsplit">&#8646; แยกขึ้นหลายคัน '+_gs.n+' ใบ</span>';
          _gs.others.forEach(function(v){
            head+='<span class="gvsep">/</span>'+pckVanHeadHtml(v, date); });
        }
      } else {
        head='<span class="gvan">'+(zk==='NOVAN'?'ยังไม่จัดรถ':'มาเอง / เอเย่นต์ส่งเอง')+'</span>'
          +' <span class="gmeta">ไม่มีรถของเรา — เช็คว่ามาถึงท่าหรือยัง</span>';
      }
      body+='<tr class="grp"><td colspan="'+(10+(showSvc?1:0)+(showLang?1:0))+'">'+head+'</td></tr>';
      vg.rows.forEach(function(r){ body+=rowHtml(r); });
    });
  });
  // §ovnBack · กลุ่มสุดท้ายของใบ = คนที่ต้องไปรับกลับจากเกาะ
  //   วางท้ายใบเพราะไกด์เช็คตามลำดับงาน (รับที่โรงแรม → ออกเรือ → แวะรับกลับ)
  //   รายละเอียดต้องครบเท่าแถวปกติ ไม่งั้นลืมรับ
  if(_ovnG.length){
    var _ovPax=_ovnG.reduce(function(a,r){ return a+((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(r.t.pax||{}):(r.booked||0)); },0);
    body+='<tr class="grp"><td colspan="'+(10+(showSvc?1:0)+(showLang?1:0))+'" style="background:#F4EFFC">'
      +'<span class="gvan" style="color:#5B289A">&#8617; รับกลับจากเกาะ (OVN) &middot; '+_ovnG.length+' ใบ &middot; '+_ovPax+' คน</span>'
      +' <span class="gmeta">ค้างคืนบนเกาะ &middot; ขึ้นเรือที่ท่าเกาะ ไม่มีรถไปรับ — เช็คชื่อให้ครบก่อนออกจากเกาะ</span></td></tr>';
    // §ovnCard · แยกตามรถที่พากลับ · ไกด์ต้องบอกได้ว่าใครขึ้นคันไหนตอนถึงท่า
    //   ขากลับใช้ vanReturnId ถ้าไม่ได้ตั้งไว้ถือว่ากลับคันเดิม (vanId)
    var _og={}, _oo=[];
    _ovnG.forEach(function(r){
      var rv=(r.O&&(r.O.vanReturnId||r.O.vanId))||'';
      var k=rv||'__none';
      if(!_og[k]){ _og[k]={vid:rv, rows:[]}; _oo.push(k); }
      _og[k].rows.push(r);
    });
    _oo.sort(function(x,y){
      if(x==='__none') return -1; if(y==='__none') return 1;
      return String(pckVanName(_og[x].vid)).localeCompare(String(pckVanName(_og[y].vid)));
    });
    _oo.forEach(function(k){
      var g=_og[k], hd;
      if(g.vid){
        var veh=(typeof vehGet==='function'?vehGet(g.vid):null)||{};
        var rd=(typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(g.vid,date)
              :{driver:veh.driver||'', phone:veh.driverPhone||'', plate:veh.plate||''};
        hd='<span class="gvan">&#8617; รถกลับ &middot; '+e(veh.name||g.vid)+'</span> <span class="gmeta">'
          +(rd.plate?('ทะเบียน <b>'+e(rd.plate)+'</b>'):'')
          +(rd.driver?(' &middot; '+e(rd.driver)):'')+(rd.phone?(' &middot; <b>'+e(rd.phone)+'</b>'):'')+'</span>';
      } else {
        hd='<span class="gvan" style="color:#A32D2D">&#9888; ยังไม่จัดรถกลับ</span>'
          +' <span class="gmeta">เรือรับกลับถึงท่าแล้วต้องมีรถส่งเข้าโรงแรม — แจ้งออฟฟิศก่อนออกจากเกาะ</span>';
      }
      body+='<tr class="grp"><td colspan="'+(10+(showSvc?1:0)+(showLang?1:0))+'" style="background:#FAF7FE;padding-left:26px">'+hd+'</td></tr>';
      g.rows.forEach(function(r){ body+=rowHtml(r); });
    });
  }

  var THEAD='<thead><tr><th style="width:18px">&#10003;</th><th style="width:7%">Voucher</th>'
    +'<th style="width:'+wName+'%">ลูกค้า &middot; ผู้โดยสารทั้งหมด</th>'
    +'<th class="num" style="width:2.8%">AD</th><th class="num" style="width:2.8%">CHD</th>'
    +'<th class="num" style="width:2.8%">INF</th><th class="num" style="width:2.8%">FOC</th>'
    +'<th style="width:'+wPick+'%">สถานที่รับ &middot; ส่ง &middot; โซน</th>'
    +(showSvc?'<th style="width:10%">Service</th>':'')
    +(showLang?'<th class="lgc" style="width:4%">ไกด์</th>':'')
    +'<th style="width:9%">Note</th></tr></thead>';

  // §sheetColor (2026-08-01) · หัวใบใช้สีประจำเรือชุดเดียวกับหน้าจอ
  //   วางใบงาน 5 ลำเรียงกันบนโต๊ะแล้วต้องหยิบถูกลำโดยไม่ต้องอ่านชื่อ — สีคือตัวช่วยนั้น
  //   ลงสีเฉพาะหัวใบกับกรอบสรุป ตารางยังขาวดำล้วน เพราะตัวหนังสือบนพื้นสีอ่านยากและเปลืองหมึก
  // §jobDrop · นับใบที่จุดส่งไม่ตรงกับจุดรับ (รวม "กลับเอง")
  var _nDrop=0; rows.forEach(function(r){ if(pckJobDrop(r.b, date)) _nDrop++; });
  var _col=(typeof pckBoatColor==='function')?(pckBoatColor(bid)||'#111827'):'#111827';
  var _ink=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(_col):'#fff';
  return '<div class="sheet d'+dens+'">'
    +'<table class="pgt"><thead><tr><td>'   /* §guideHead2 · ทุกอย่างใน thead นี้จะซ้ำทุกหน้า */
    +'<div class="jh" style="background:'+_col+';color:'+_ink+'"><div class="jlogo">LA</div>'
    +'<div><div class="jt1">ใบงานไกด์</div><div class="jt2">Guide Job Order</div></div>'
    +'<div style="margin-left:22px"><div class="jbname">'+e(boat.name||bid)+'</div>'
      +'<div class="jbsub">'+e(rt.name||rid||'—')+(dep?('<span class="jdep">ออก '+e(dep)+'</span>'):'')+'</div></div>'
    +'<div class="jdate"><div>'+e(dTh)+'</div>'
      +'<div style="margin-top:3px">ไกด์ '+(_gdN?('<b class="jfilled">'+e(_gdN)+'</b>'):'<span class="jfill"></span>')+'</div></div></div>'
    +'<div class="jsum" style="border-color:'+_col+'">'
    +'<div class="jsc"><span class="jslab">รวม</span><span class="jsbig">'+t.all+'</span><span class="jsv" style="color:#6b7280">pax</span>'
      +'<span class="jsv">AD '+t.ad+J+'CHD '+t.chd+J+'INF '+t.inf+J+'FOC '+t.foc+'</span>'
      +(S.lost>0?('<span class="jwarn">จอง '+S.book+' &middot; หาย '+S.lost+'</span>'):'')
      +((vd&&vd.n)?('<span class="jwarn">ยกเลิกหน้างาน '+vd.n+' ใบ &middot; '+vd.pax+' คน</span>'):'')+'</div>'
    +'<div class="jsc"><span class="jslab">booking</span><span class="jsv">'+rows.length+'</span>'
      +'<span class="jslab" style="margin-left:5px">รถ</span><span class="jsv">'+Object.keys(vans).length+' คัน</span>'
      +(_nDrop?('<span class="jwarn">&#8627; ส่งจุดอื่น '+_nDrop+' ใบ</span>'):'')
      +(_ovnG.length?('<span class="jwarn">&#8617; รับกลับจากเกาะ '+_ovnG.length+' ใบ</span>'):'')+'</div>'
    +'<div class="jsc"><span class="jslab">ไกด์</span>'+(langs?('<span class="jsv">'+langs+'</span>'):'<span class="jsnone">—</span>')
      +(uniLang?'<span class="jwarn">ทุกใบ</span>':'')+'</div>'
    +'<div class="jsc"><span class="jslab">อาหาร</span>'
      +(ml.length?('<span class="jsv">'+ml.join(J)+'</span>'):(M.allergy?'':'<span class="jsnone">ไม่มี</span>'))
      +(M.allergy?('<span class="jwarn">&#9888; แพ้อาหาร '+M.allergy+'</span>'):'')+'</div>'
    +(_svcN?('<div class="jsc"><span class="jslab">Service</span><span class="jsv">'+_svcN+' รายการ</span>'
      +(_svcLg.length?('<span class="jsv" style="font-weight:500;color:#4b5563">'+_svcLg.join(J)+'</span>'):'')
      +'</div>'):'')
    +'<div class="jsc"><span class="jslab">Longtail</span>'+(lt.length?('<span class="jsv">'+lt.join(J)+'</span>'):'<span class="jsnone">ไม่มี</span>')
      +'</div>'
    +'</div>'
    /* §crewPaper · ใครลงเรือลำนี้วันนี้ · ไกด์ถือใบนี้อยู่บนเรือ ต้องรู้ว่าเรียกใครได้
       ไม่มีใครจัดไว้เลย = ไม่ต้องขึ้นบรรทัดนี้ · กระดาษจะได้ไม่มีหัวข้อว่างเปล่า */
    +((_crewTxt||_islTxt)?('<div class="jcrew"><span class="jslab">ทีมเรือ</span>'
      +(_crewTxt?('<span class="jcv">'+e(_crewTxt)+'</span>'):'')
      +(_islTxt?('<span class="jslab" style="margin-left:4px">ผช.ไกด์</span><span class="jcv">'+e(_islTxt)+'</span>'):'')
      +'</div>'):'')
    +'</td></tr></thead><tbody><tr><td>'   /* §guideHead2 · เนื้อหาไหลต่อไปหน้า 2 ได้ */
    +'<div class="tw"><table>'+THEAD+'<tbody>'+body+'</tbody></table></div>'
    +'</td></tr></tbody></table>'
    +'</div>';
}

// §jobDrop (2026-08-02) · จุดส่งขากลับของบุ๊คกิ้งหนึ่งใบ
//   ใบงานไกด์เดิมมีแต่ "สถานที่รับ" — ไกด์เป็นคนบอกคนขับรถกลับว่าใครลงตรงไหน
//   พอกระดาษไม่มีจุดส่ง ไกด์ต้องโทรถามออฟฟิศกลางทะเล หรือส่งผิดที่
//   อ่านจาก bkV2RetInfo ตัวเดียวกับใบงานรถ เพื่อไม่ให้สองใบบอกคนละอย่าง
// §retVan · รถที่พากลับ · null = ไม่มีอะไรต้องบอก (กลับคันเดิมโดยปริยาย)
function ckRetVan(b, date){
  var ri = (typeof bkV2RetInfo === 'function') ? bkV2RetInfo(b, date) : null;
  if(!ri) return null;
  if(ri.selfRet) return { t:'กลับเอง', kind:'self' };
  if(ri.retId){
    var v = (typeof vehGet==='function') ? vehGet(ri.retId) : null;
    return { t:(v&&v.name)||ri.retId, kind:'van' };
  }
  if(ri.sameVan) return { t:'กลับคันเดิม', kind:'same' };
  if(ri.sep)     return { t:'ยังไม่จัดรถกลับ', kind:'pending' };
  return null;
}
function pckJobDrop(b, date){
  var ri = (typeof bkV2RetInfo === 'function') ? bkV2RetInfo(b, date) : null;
  if(!ri) return null;
  var rv = ckRetVan(b, date);
  if(ri.selfRet) return { t:'กลับเอง', self:true, van:null };
  if(ri.sep && ri.drop) return { t:ri.drop, self:false, van:(rv && rv.kind!=='self')?rv:null };
  // §retVan · ส่งที่เดิม แต่รถกลับคนละคัน / ยังไม่จัด → ยังต้องบอก
  if(rv) return { t:'', self:false, van:rv };
  return null;
}
// ป้ายรถขากลับ · ใช้ร่วมกันทุกหน้า จะได้เขียนเหมือนกันหมด
function ckRetVanTxt(v){
  if(!v) return '';
  return (v.kind==='van') ? ('\u21a9 \u0e01\u0e25\u0e31\u0e1a '+v.t)
       : (v.kind==='pending') ? ('\u26a0 '+v.t) : v.t;
}
function pckLangNorm(v){
  var t=String(v==null?'':v).replace(/[\s\u00a0]+/g,' ').trim();
  // §langPurge · อัญประกาศค้างจากการนำเข้าข้อมูล · ไม่ใช่ส่วนหนึ่งของชื่อภาษา
  t=t.replace(/^["'\u201c\u201d\u2018\u2019]+/,'').replace(/["'\u201c\u201d\u2018\u2019]+$/,'').trim();
  if(!t) return '';
  // "Spanish Guide" กับ "Spanish" คือภาษาเดียวกัน · คำว่า guide ไม่ใช่ชื่อภาษา
  var core=t.replace(/\b(guide|guides|speaking|speaker)\b/ig,'').replace(/ไกด์|พูด|ภาษา/g,'')
            .replace(/[\s\u00a0]+/g,' ').trim();
  var probe=core||t;
  for(var i=0;i<PCK_LANG_MAP.length;i++) if(PCK_LANG_MAP[i].re.test(probe)) return PCK_LANG_MAP[i].c;
  if(/^[A-Za-z]{2,3}$/.test(probe)) return probe.toUpperCase();   // พิมพ์รหัสมาเองอยู่แล้ว
  // §langPurge · ตัวเดียวไม่ใช่ชื่อภาษา · เป็นเศษที่พิมพ์ค้างไว้ · ทิ้ง
  if(probe.length<2) return '';
  return probe;                                                    // ภาษาที่ไม่รู้จัก · เก็บข้อความไว้ ไม่ทำข้อมูลหาย
}
function pckGuideLangs(b){
  var gd=(b&&b.guides)||{}, raw=[];
  if(gd.english) raw.push('EN');
  if(gd.russian) raw.push('RU');
  if(gd.chinese) raw.push('CN');
  if(String(gd.otherLang||'').trim()) raw.push(gd.otherLang);
  var out=[], seen={};
  raw.forEach(function(x){ var c=pckLangNorm(x); if(!c) return;
    var k=c.toLowerCase(); if(seen[k]) return; seen[k]=1; out.push(c); });
  return out;
}
function _pckSvcRead(key){ var v; try{ v=laBlob()[key]; }catch(_){ return null; }
  if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(_){ v=null; } } return v; }
function _pckSvcWrite(key,val){ try{ var d=laBlob(); d[key]=JSON.stringify(val); laBlobSave(); }catch(e){} }
function pckSvcColors(){
  var o={}; PCK_SVC_DEF.forEach(function(x){ o[x.k]=x.c; });
  var u=_pckSvcRead('pck_svc_colors');
  if(u && typeof u==='object') Object.keys(u).forEach(function(k){ if(u[k]) o[k]=u[k]; });
  return o;
}
function pckSvcSaveColor(k,hex){
  var u=_pckSvcRead('pck_svc_colors')||{};
  if(hex) u[k]=hex; else delete u[k];
  _pckSvcWrite('pck_svc_colors',u); pckSvcSetRender();
}
function pckSvcRules(){ var u=_pckSvcRead('pck_svc_rules'); return Array.isArray(u)?u:[]; }
function pckSvcRuleAdd(){ var a=pckSvcRules(); a.push({id:'r'+Date.now(), kw:'', c:'#BFDBFE'}); _pckSvcWrite('pck_svc_rules',a); pckSvcSetRender(); }
function pckSvcRuleSet(id,f,v){ var a=pckSvcRules(), i; for(i=0;i<a.length;i++){ if(a[i].id===id){ a[i][f]=v; break; } } _pckSvcWrite('pck_svc_rules',a); }
function pckSvcRuleDel(id){ _pckSvcWrite('pck_svc_rules', pckSvcRules().filter(function(x){ return x.id!==id; })); pckSvcSetRender(); }
// §gdColor (2026-08-01) · สีป้ายภาษาไกด์ · แยกที่เก็บจากกติกา add-on
//   กติกา add-on จับ "ชื่อ add-on" ส่วนภาษาไกด์มาจาก bk.guides คนละที่กัน
//   ตั้งค่า "RU" ในกติกา add-on จึงไม่มีทางไปโดนป้ายไกด์ (เจอจริง 1 ส.ค.)
function pckGuideLangList(){
  // §langPurge · ทำรายการจากรหัสที่รวบแล้ว · ไม่ใช่ข้อความดิบที่คนพิมพ์
  var out=['EN','RU','CN'], seen={EN:1,RU:1,CN:1};
  var add=function(v){ var c=pckLangNorm(v); if(!c || seen[c]) return; seen[c]=1; out.push(c); };
  try{ (SB_BOOKINGS||[]).forEach(function(b){ add(((b&&b.guides)||{}).otherLang); }); }catch(_){}
  // ภาษาที่ตั้งสีไว้แต่วันนี้ไม่มีใบจอง ต้องยังเห็น ไม่งั้นแก้สีคืนไม่ได้
  try{ Object.keys(pckGuideColors()).forEach(add); }catch(_){}
  return out;
}
function pckGuideColors(){
  var u=_pckSvcRead('pck_guide_colors'); if(!u || typeof u!=='object') return {};
  if(_pckGdHealed) return u;
  // §langPurge · คีย์เก่าเป็นข้อความดิบที่คนพิมพ์เอง · รวบเป็นรหัสเดียวแล้วเขียนกลับครั้งเดียว
  //   สีไม่หาย · ที่เคยตั้งไว้กับ "Spanish Guide" กลายเป็นสีของ ES
  //   คีย์ที่กลายเป็นค่าว่าง (เศษตัวอักษรเดียว) ถูกทิ้ง
  var out={}, dirty=false;
  Object.keys(u).forEach(function(k){
    var c=pckLangNorm(k);
    if(!c || !u[k]){ dirty=true; return; }
    if(c!==k) dirty=true;
    if(!out[c]) out[c]=u[k];            // คีย์แรกที่มีสีชนะ
  });
  _pckGdHealed=true;                     // ลองครั้งเดียวต่อการเปิดหน้า · ผู้ใช้สิทธิ์ดูอย่างเดียวจะได้ไม่วนเขียน
  if(dirty){ try{ _pckSvcWrite('pck_guide_colors', out); }catch(_){} return out; }
  return u;
}
// §langPurge · ล้างสีของภาษาที่ไม่มีในใบจองแล้ว
function pckGuideColorPurge(){
  var G=pckGuideColors(), used={EN:1,RU:1,CN:1};
  try{ (SB_BOOKINGS||[]).forEach(function(b){
    var c=pckLangNorm(((b&&b.guides)||{}).otherLang); if(c) used[c]=1; }); }catch(_){}
  var gone=Object.keys(G).filter(function(k){ return !used[k]; });
  if(!gone.length){ alert('ไม่มีรายการค้าง\n\nทุกภาษาที่ตั้งสีไว้ยังมีใช้อยู่ในใบจอง'); return; }
  if(!confirm('ลบสีของภาษาที่ไม่มีในใบจองแล้ว '+gone.length+' รายการ?\n\n'+gone.join(' \u00b7 ')
    +'\n\nป้ายกลับไปเป็นขาวดำ · ตั้งใหม่ได้ทุกเมื่อ')) return;
  var out={}; Object.keys(G).forEach(function(k){ if(used[k]) out[k]=G[k]; });
  _pckSvcWrite('pck_guide_colors',out); pckSvcSetRender();
}
function pckGuideColorSave(c,hex){
  var u=pckGuideColors(); if(hex) u[c]=hex; else delete u[c];
  _pckSvcWrite('pck_guide_colors',u); pckSvcSetRender();
}
// ใบที่ขอสองภาษา ใช้สีของภาษาแรกที่ตั้งไว้ · ไม่ตั้งเลย = คืนค่าว่าง แล้วกลับไปใช้กติกาหมึกทึบเหมือนเดิม
function pckGuideColorOf(codes){
  var G=pckGuideColors(), i;
  for(i=0;i<(codes||[]).length;i++){ if(G[codes[i]]) return G[codes[i]]; }
  return '';
}
// §boatSplit · ป้ายเล็กๆ บอกว่าแถวนี้เป็นเสี้ยวหนึ่งของบุคกิ้งที่แยกลงหลายลำ
function pckBoatSplitBadge(r){
  if(!r || !r.bsN || r.bsN<2) return '';
  var e=ckEsc;
  var others=[];
  try{
    var sp=bkBoatSplits(r.b,_pckDate)||[];
    sp.forEach(function(x,i){ if(i!==r.bsIdx) others.push(pckBoatName(x.boatId)+' '+bkPaxSum(bkSplitPax(x))); });
  }catch(_){}
  return '<span title="บุคกิ้งเดียวกัน แยกลง '+r.bsN+' ลำ'+(others.length?(' · อีก '+e(others.join(' · '))):'')
    +'&#10;เงินและการเช็คอินเป็นของทั้งใบ ไม่ได้แยกตามลำ" '
    +'style="display:inline-block;background:#F1ECFB;border:1px solid #D9CFF2;color:#5B289A;border-radius:5px;'
    +'padding:0 6px;font-size:9px;font-weight:800;margin-left:4px;white-space:nowrap">&#128676; ลำ '+(r.bsIdx+1)+'/'+r.bsN+'</span>';
}
function pckGuideBadge(codes){
  var e=ckEsc, c=pckGuideColorOf(codes);
  if(!(codes||[]).length) return '<span class="dash">&mdash;</span>';
  var alt=!(codes.length===1 && codes[0]==='EN');
  var ink=(c && typeof bkV2ContrastInk==='function')?bkV2ContrastInk(c):'#fff';
  return '<span class="lg'+((alt&&!c)?' alt':'')+'"'
    +(c?(' style="background:'+c+';border-color:'+c+';color:'+ink+'"'):'')
    +' title="ไกด์">'+codes.map(e).join('/')+'</span>';
}
function pckSvcRuleColor(label){
  var t=String(label||'').toLowerCase(), a=pckSvcRules(), i, k;
  for(i=0;i<a.length;i++){ k=String(a[i].kw||'').trim().toLowerCase(); if(k && t.indexOf(k)>=0) return a[i].c||''; }
  return '';
}
// หน้าต่างตั้งค่า · เปิดจากปุ่มข้างๆ "ใบงานไกด์ทุกลำ"
function pckSvcSetOpen(){
  var h=document.getElementById('pck-svcset-host');
  if(!h){ h=document.createElement('div'); h.id='pck-svcset-host'; document.body.appendChild(h); }
  pckSvcSetRender();
}
function pckSvcSetClose(){ var h=document.getElementById('pck-svcset-host'); if(h) h.innerHTML=''; if(typeof renderPierCheckin==='function') renderPierCheckin(); }
function pckSvcSetRender(){
  var h=document.getElementById('pck-svcset-host'); if(!h || !h.parentNode) return;
  var e=ckEsc, C=pckSvcColors(), u=_pckSvcRead('pck_svc_colors')||{};
  var lbl='font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em';
  var swat=function(k,l,c,isDef){
    return '<div style="display:flex;align-items:center;gap:11px;margin-bottom:9px">'
      +'<input type="color" value="'+c+'" onchange="pckSvcSaveColor(\''+k+'\',this.value)" style="width:40px;height:30px;border:1px solid #E4E1D9;border-radius:7px;padding:1px;cursor:pointer;flex:none">'
      +'<span style="flex:1;font-size:12.5px;font-weight:700;color:#2c2c2a">'+e(l)+'</span>'
      +'<span class="pck-svcprev" style="background:'+c+';color:'+((typeof bkV2ContrastInk==='function')?bkV2ContrastInk(c):'#000')+'">'+e(l)+'</span>'
      +(isDef?'':'<button onclick="pckSvcSaveColor(\''+k+'\',\'\')" title="กลับไปใช้สีเดิม" style="border:1px solid #E4E1D9;background:#fff;color:#8a8a82;border-radius:7px;padding:4px 9px;font-size:10.5px;cursor:pointer;font-family:inherit">คืนค่าเดิม</button>')
      +'</div>';
  };
  var built=PCK_SVC_DEF.map(function(x){ return swat(x.k, x.l, C[x.k], !u[x.k]); }).join('');
  var G=pckGuideColors();
  var gds=pckGuideLangList().map(function(c){
    var on=!!G[c], col=G[c]||'#E5E7EB';
    return '<div style="display:flex;align-items:center;gap:11px;margin-bottom:9px">'
      +'<input type="color" value="'+col+'" onchange="pckGuideColorSave(\''+c+'\',this.value)" style="width:40px;height:30px;border:1px solid #E4E1D9;border-radius:7px;padding:1px;cursor:pointer;flex:none">'
      +'<span style="flex:1;font-size:12.5px;font-weight:700;color:#2c2c2a">ไกด์ '+e(c)+'</span>'
      +pckGuideBadge([c])
      +(on?'<button onclick="pckGuideColorSave(\''+c+'\',\'\')" title="เลิกใช้สี กลับไปใช้ป้ายขาวดำ" style="border:1px solid #E4E1D9;background:#fff;color:#8a8a82;border-radius:7px;padding:4px 9px;font-size:10.5px;cursor:pointer;font-family:inherit">ไม่ใช้สี</button>':'<span style="font-size:10.5px;color:#c2c0b7">ยังไม่ตั้งสี</span>')
      +'</div>';
  }).join('');
  var rules=pckSvcRules().map(function(r){
    var c=r.c||'#BFDBFE';
    return '<div style="display:flex;align-items:center;gap:9px;margin-bottom:8px">'
      +'<input type="color" value="'+c+'" onchange="pckSvcRuleSet(\''+r.id+'\',\'c\',this.value);pckSvcSetRender()" style="width:40px;height:30px;border:1px solid #E4E1D9;border-radius:7px;padding:1px;cursor:pointer;flex:none">'
      +'<input type="text" value="'+e(r.kw||'')+'" oninput="pckSvcRuleSet(\''+r.id+'\',\'kw\',this.value)" placeholder="คำที่อยู่ในชื่อ add-on เช่น Snorkel" style="flex:1;border:1px solid #E4E1D9;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit">'
      +'<button onclick="pckSvcRuleDel(\''+r.id+'\')" title="ลบกติกานี้" style="border:1px solid #F0C9C9;background:#FBE9E9;color:#A32D2D;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">ลบ</button>'
      +'</div>';
  }).join('');
  h.innerHTML='<div onclick="if(event.target===this)pckSvcSetClose()" style="position:fixed;inset:0;background:rgba(20,24,22,.42);backdrop-filter:blur(2px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px">'
   +'<div style="background:#fff;border-radius:16px;width:min(520px,96vw);max-height:90vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28)">'
   +'<div style="padding:16px 20px;border-bottom:1px solid #EFECE4;display:flex;align-items:center;justify-content:space-between">'
   +'<div><div style="font-size:15px;font-weight:800;color:#2c2c2a">สีช่อง Service ในใบงานไกด์</div>'
   +'<div style="font-size:11.5px;color:#8a8a82;margin-top:2px">ตั้งครั้งเดียว ใช้กับใบงานทุกใบ ทุกวัน</div></div>'
   +'<button onclick="pckSvcSetClose()" style="background:transparent;border:none;font-size:20px;color:#9a9a92;cursor:pointer;line-height:1">&times;</button></div>'
   +'<div style="padding:16px 20px">'
   +'<div style="'+lbl+';margin-bottom:9px">บริการหลัก</div>'+built
   +'<div style="'+lbl+';margin:18px 0 4px">ป้ายภาษาไกด์</div>'
   +'<div style="font-size:11.5px;color:#8a8a82;margin-bottom:9px;line-height:1.5">ไม่ตั้งสี = ป้ายขาวดำตามเดิม (ทึบ = ไม่ใช่อังกฤษ) · ตั้งสีแล้วสีชนะ<br>'
     +'ชื่อภาษาถูกรวบให้เป็นรหัสเดียวแล้ว — Spanish Guide · Spain · สเปน นับเป็น ES อันเดียวกัน</div>'+gds
   +'<button onclick="pckGuideColorPurge()" title="ลบสีของภาษาที่ไม่มีในใบจองแล้ว · ป้ายกลับไปเป็นขาวดำ" style="border:1px solid #E4E1D9;background:#fff;color:#8a8a82;border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:2px">&#128465; ล้างภาษาที่ไม่มีในใบจองแล้ว</button>'
   +'<div style="'+lbl+';margin:18px 0 4px">บริการอื่นที่อยากให้มีสี</div>'
   +'<div style="font-size:11.5px;color:#8a8a82;margin-bottom:9px;line-height:1.5">พิมพ์คำที่อยู่ในชื่อ add-on แล้วเลือกสี · ใบไหนมี add-on ที่ชื่อมีคำนั้น จะได้สีนี้ในช่อง Service<br>ไม่ต้องพิมพ์ให้ตรงเป๊ะ และไม่สนตัวพิมพ์เล็กใหญ่</div>'
   +(rules||'<div style="font-size:11.5px;color:#c2c0b7;margin-bottom:9px">ยังไม่มีกติกา</div>')
   +'<button onclick="pckSvcRuleAdd()" style="border:1.5px dashed #D8D4CA;background:#fff;color:#5F5E5A;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%">+ เพิ่มบริการ</button>'
   +'</div>'
   +'<div style="padding:12px 20px 18px;display:flex;justify-content:flex-end">'
   +'<button onclick="pckSvcSetClose()" style="border:none;background:#2f2f2b;color:#fff;border-radius:9px;padding:9px 20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">เสร็จแล้ว</button>'
   +'</div></div></div>';
}
// §svcCol (2026-08-01) · ช่อง Service · สีมาจากข้อมูล ไม่ใช่คนแต้มเอง
//   ใบงานเดิมของทีม (ไฟล์ Excel เกาะพีพี-เกาะไผ่) ระบายสีที่ "ช่อง Service" ช่องเดียว
//   เหลือง = เรือหางยาวจอย · เขียว = เรือหางยาวเหมา — ไม่ได้ระบายทั้งแถว
//   ระบบรู้อยู่แล้วว่าใบไหนมีหางยาวอะไรจาก bkV2AddOnFlags() จึงเติมสีให้เองได้ ไม่ต้องมีใครมานั่งแต้ม
//   รวมของที่ขายเพิ่มหน้างานด้วย (bkV2LongtailExtraPax / bkV2LongtailCharterExtraBoats)
function pckJobService(r, date){
  var b=r.b, rid=(r.t&&r.t.routeId)||'', out=[], CL=pckSvcColors();
  /* §ltOne · อัปเกรดหน้างานต้องเปลี่ยนป้ายนี้ด้วย · เดิมอ่านแต่ของที่จองมากับขายเพิ่ม
     ใบที่อัปเกรด Join → เหมา จึงยังขึ้น "Join" (หรือไม่ขึ้นอะไรเลยถ้าไม่เคยมีหางยาว)
     ⬆ = มาจากอัปเกรดหน้างาน ไม่ได้อยู่ในวอยเชอร์ · * = ยังไม่ได้เก็บเงิน */
  var LT=(typeof bkLtState==='function')?bkLtState(b,rid,date):{mode:'none'};
  if(LT.mode==='charter')
    out.push({c:CL.chtr, t:'Longtail Charter \u00b7 '+LT.boats+' \u0e25\u0e33'
      +(LT.up?(' \u2b06'+(LT.upDue?' *':'')):'')});
  else if(LT.mode==='join')
    out.push({c:CL.join, t:'Longtail Join'+(LT.joinExtra>0?(' +'+LT.joinExtra):'')});
  // add-on อื่นที่ไม่ใช่หางยาว · ไม่ลงสี เพราะสีสงวนไว้ให้เรื่องที่ต้องจัดเรือจริง
  try{ (ckAddonList(b,rid)||[]).forEach(function(a){
    if(a.kind==='longtail') return;
    var _lb=a.label+(a.note?(' ('+a.note+')'):'');
    out.push({c:pckSvcRuleColor(a.label), t:_lb});
  }); }catch(_){}
  // §guideSvcFull · ของที่ขายเพิ่มหน้าท่า (SB_EXTRAS) · หางยาวข้ามไป นับอยู่ในป้าย Longtail ข้างบนแล้ว
  //   นำหน้าด้วย + ให้ไกด์แยกออกว่าไม่ได้มากับใบจอง — กระดาษขาวดำ ใช้สัญลักษณ์แทนสี
  try{ ((typeof bkV2ExtrasFor==='function')?bkV2ExtrasFor(b.id):[]).forEach(function(x){
    if(date && x.tripDate && x.tripDate!==date) return;
    var nm=String(x.service||'');
    if(/longtail|หางยาว/i.test(nm)) return;
    out.push({c:pckSvcRuleColor(nm), t:'+ '+nm+((+x.qty||1)>1?(' \u00d7'+x.qty):'')});
  }); }catch(_){}
  // อัปเกรดหน้างาน · ยังไม่เก็บเงินใส่ดอกจันไว้ ไกด์จะได้ทวงถูกใบ
  try{ (Array.isArray(b.upgrades)?b.upgrades:[]).forEach(function(u){
    var lb=String(u.label||'upgrade');
    /* §ltOne · อัปเกรดหางยาวนับอยู่ในป้าย Longtail ข้างบนแล้ว (พร้อม ⬆ และ *)
       กติกาเดียวกับของขายเพิ่มหน้างาน · เขียนสองบรรทัดไกด์จะนึกว่าต้องจัดสองลำ */
    if(/longtail|หางยาว/i.test(lb) && /เหมา|charter|private|ไพรเวท|ส่วนตัว/i.test(lb)) return;
    out.push({c:pckSvcRuleColor(lb), t:'\u2b06 '+lb+(u.collected?'':' *')});
  }); }catch(_){}
  return out;
}
// ช่อง Note · เรื่องที่ไกด์ต้องรู้ก่อนถึงเรือ — อาหารพิเศษมาก่อน แล้วค่อยข้อความอิสระ
//   อาหารเคยอยู่แต่ยอดรวมหัวใบ ซึ่งบอกว่า "มี 2 คน" แต่ไม่บอกว่าคนไหน
function pckJobNote(b, date){
  var mm=b.specialMeals||{}, out=[];
  var veg=(+mm.veg||0)+(+mm.vegan||0);
  if(veg) out.push({w:1, t:'มังสวิรัติ '+veg});
  if(+mm.halal) out.push({w:1, t:'ฮาลาล '+(+mm.halal)});
  /* §gdAlList (2026-09-14) · "จะโผล่ในใบงานไกด์ไหม"
     ของเดิมอ่านแต่ mm.allergies (ข้อความอิสระ) · ไม่อ่าน allergyList เลย
     แต่ทางหลักที่คนบันทึกอาการแพ้คือชิป — ปุ่ม + เพิ่ม และปุ่มสำเร็จรูป
     (Peanut · Shellfish · ...) ทุกปุ่มสร้างชิปทั้งหมด
     ผลคือ อาการแพ้ที่บันทึกด้วยวิธีหลัก ไม่เคยขึ้นใบงานไกด์เลยสักครั้ง
     วัดแล้ว ใบที่มี Cashew nut ×2 · pckJobNote คืนอาร์เรย์ว่าง
     bkV2AllergyText รวมทั้งสองแบบให้แล้ว (ชิป + ข้อความ) · ใช้ตัวนั้น */
  var al=(typeof bkV2AllergyText==='function')?bkV2AllergyText(mm):String(mm.allergies||'').trim();
  al=String(al||'').trim();
  if(al) out.push({w:1, t:'แพ้อาหาร: '+al});
  /* §gvanSplit · ใบนี้แยกขึ้นรถหลายคัน · ตัวหนา เพราะไกด์ต้องรู้ว่าคนกลุ่มนี้
     ไม่ได้มาคันเดียวกันทั้งหมด แม้จะพิมพ์รวมอยู่ใต้หัวคันแรก */
  var _vs=(typeof ckVanSplitNote==='function')
    ? ckVanSplitNote((typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{})) : '';
  if(_vs) out.push({w:1, t:_vs});
  var sq=(typeof vanJobsSreqFinal==='function')?(vanJobsSreqFinal(b)||''):((b.notes||'').trim());
  if(sq) out.push({w:0, t:sq});
  // §pierNote · เรื่องที่แจ้งที่ท่า · ตัวหนา (w:1) เพราะเป็นของที่เพิ่งเกิด ไกด์ยังไม่รู้
  var pn=(typeof pckNoteGet==='function')?pckNoteGet(b,date):'';
  if(pn) out.push({w:1, t:pn});
  return out;
}
function goRoleT(k){ for(var i=0;i<GO_ROLES.length;i++) if(GO_ROLES[i].k===k) return GO_ROLES[i].t; return GO_ROLES[0].t; }
function goRoleOf(g){ var r=String((g&&g.role)||'guide'); 
  for(var i=0;i<GO_ROLES.length;i++) if(GO_ROLES[i].k===r) return r; return 'guide'; }
function goIsGuide(g){ var r=goRoleOf(g); return r==='guide'||r==='trainee'; }
function goLangsOf(g){ var L=(g&&g.lang); if(!Array.isArray(L)) L=String(L||'').split(/[,\s\/]+/);
  var out=[],seen={};
  L.forEach(function(x){ var c=(typeof pckLangNorm==='function')?pckLangNorm(x):String(x||'').toUpperCase();
    if(!c||seen[c]) return; seen[c]=1; out.push(c); });
  return out; }
function goLangsParse(v){ return goLangsOf({lang:String(v||'')}); }
function goGuides(){ var g=(typeof ctRead==='function')?ctRead('guides'):null; return Array.isArray(g)?g:[]; }
function goGuidesSet(a){ if(typeof ctWrite==='function') ctWrite('guides', a||[]); }
function goGuide(id){ var a=goGuides(); for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i]; return null; }
function goCfg(){
  var c=(typeof ctRead==='function')?ctRead('go_cfg'):null; c=c||{};
  return { next:(+c.next>0?+c.next:1),
           signers:Array.isArray(c.signers)&&c.signers.length?c.signers:[{name:'นฤมล ชัวแซ่ง', title:'Phuket Pier Manager'}],
           head:Object.assign({}, GO_HEAD_DEF, c.head||{}) };
}
function goCfgSet(c){ if(typeof ctWrite==='function') ctWrite('go_cfg', c); }
function _goKey(date,bid){ return String(date||'')+'|'+String(bid||''); }
function goAsn(date,bid){
  var m=(typeof ctRead==='function')?ctRead('go_asn'):null; m=m||{};
  var o=m[_goKey(date,bid)]||{};
  return { g:Array.isArray(o.g)?o.g:[], other:(+o.other||0), sign:(+o.sign||0) };
}
function goAsnSet(date,bid,o){
  var m=(typeof ctRead==='function')?ctRead('go_asn'):null; m=m||{};
  m[_goKey(date,bid)]=o; if(typeof ctWrite==='function') ctWrite('go_asn', m);
}
// เลขที่ใบ · ออกครั้งเดียวต่อ (วัน,ลำ) · พิมพ์ซ้ำได้เลขเดิม ไม่กินเลขใหม่
function goNoFor(date,bid,issue){
  var m=(typeof ctRead==='function')?ctRead('go_no'):null; m=m||{};
  var k=_goKey(date,bid);
  if(m[k]) return m[k];
  if(!issue) return null;
  var c=goCfg(), n=c.next;
  m[k]=n; if(typeof ctWrite==='function') ctWrite('go_no', m);
  c.next=n+1; goCfgSet(c);
  return n;
}
function goBoatTh(bid){
  var b=(typeof getBoat==='function')?getBoat(bid):null; if(!b) return String(bid||'');
  return b.nameTh ? (b.nameTh+' ('+(b.name||bid)+')') : (b.name||bid);
}
function goThDate(d){
  try{ var x=new Date(d+'T12:00:00');
    return GO_TH_DOW[x.getDay()]+'  '+x.getDate()+'  '+GO_TH_MON[x.getMonth()]+'  '+x.getFullYear();
  }catch(_){ return String(d||''); }
}
// แถวของลำนั้นในวันนั้น · กติกาเดียวกับใบงานไกด์ (ใบที่ยังไม่จัดเรือ / ยกเลิก ไม่นับ)
function goRows(date,bid){
  var out=[];
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    // §ovnBack · ขากลับค้างคืนอยู่บนเรือจริงในวันนั้น · ใบสั่งงานเป็นเอกสารที่ประกาศจำนวนคนบนเรือ
    //   จึงต้องนับรวม ไม่งั้นเลขบนใบไม่ตรงกับหัวคนที่อยู่บนเรือจริง
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    var row={b:b,t:t,O:O,booked:ckBookedPax(t),expect:ckBookedPax(t),ck:O.pierCheckin||null,vanId:O.vanId||''};
    row.bid=O.boatId||t.charterBoatId||'';
    if(!row.bid) return;
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;
    (typeof pckExpandBoatSplits==='function' ? pckExpandBoatSplits(row,b,date,[]) : [row]).forEach(function(r2){
      if(r2.bid===bid) out.push(r2);
    });
  });
  return out;
}
// จำนวนคนตามประเภท · นับ "คนที่เดินทางจริง" หลังหักคนที่ไม่มา · FOC นับรวมเป็นผู้ใหญ่
function goCounts(date,bid){
  var c={ad:0,chd:0,inf:0};
  goRows(date,bid).forEach(function(r){
    var pb=(typeof ckPaxBreak==='function')?ckPaxBreak(r.t.pax):{ad:0,chd:0,inf:0,foc:0};
    var L=function(k,v){ return (typeof ckPaxLeft==='function')?ckPaxLeft(r.b,date,k,v):v; };
    c.ad += L('ad',pb.ad||0) + L('foc',pb.foc||0);
    c.chd+= L('chd',pb.chd||0);
    c.inf+= L('inf',pb.inf||0);
  });
  return c;
}
function goRouteOf(date,bid){
  var rows=goRows(date,bid);
  // §ovnBack · ชื่อโปรแกรมบนหัวใบ = โปรแกรมที่เรือวิ่งวันนั้น
  //   ขากลับค้างคืนขึ้นเรือลำไหนก็ได้ที่วิ่งวันนั้น เส้นทางของมันจึงไม่ใช่เส้นทางของใบ
  var pri=rows.filter(function(r){ return !(typeof bkIsOvnReturn==='function' && bkIsOvnReturn(r.t)); });
  var use=pri.length?pri:rows;
  var rid=use.length?(use[0].t.routeId||''):'';
  return (typeof getRoute==='function'?getRoute(rid):null)||{};
}
/* §goCrewJob · "กัปตันและนายท้ายเรือ" นับจากคนที่จัดลงใบงานเรือของวันนั้น
   ไม่ใช่ช่อง "ลูกเรือ" ในทะเบียนเรือ · ทะเบียนเรือคือโครงมาตรฐานของลำ
   ใบงานเรือคือคนที่ลงเรือจริงวันนั้น (มีคนแทน มีคนขาด ก็เห็นตรงนั้น)
   ยังไม่ได้จัดใบงานเลยสักช่อง ค่อยถอยไปใช้เลขในทะเบียนเรือ ใบจะได้ไม่ว่าง
   หมายเหตุ pjOf() คืนทีมประจำเรือให้เองเมื่อยังไม่เคยแตะใบของวันนั้น */
function goCrewN(date,bid){
  try{
    var J=(typeof pjOf==='function')?pjOf(date,bid):null;
    if(J){
      var n=(J.cap?1:0)+(J.asst?1:0);
      (J.crew||[]).forEach(function(x){ if(x) n++; });
      if(n>0) return n;
    }
  }catch(_){}
  var b=(typeof getBoat==='function')?getBoat(bid):null;
  return (b&&+b.crew>0)?+b.crew:0;
}
/* ผช.ไกด์ในใบงานเรือ · ไม่ใช่ลูกเรือ ไม่ใช่มัคคุเทศก์ → ลงช่อง "อื่นๆ" ตามแบบกรมการท่องเที่ยว */
function goIslandN(date,bid){
  try{
    var J=(typeof pjOf==='function')?pjOf(date,bid):null; if(!J) return 0;
    var n=0; (J.island||[]).forEach(function(x){ if(x) n++; }); return n;
  }catch(_){}
  return 0;
}
// ── ใบเดียว ────────────────────────────────────────────────────────────
function goSheet(date,bid,issue){
  var e=ckEsc, C=goCfg(), H=C.head, A=goAsn(date,bid);
  var boat=(typeof getBoat==='function')?getBoat(bid):null;
  var rt=goRouteOf(date,bid), cnt=goCounts(date,bid);
  /* §gdRole · เฉพาะไกด์/ไกด์ฝึกหัดเท่านั้นที่นับเป็น "มัคคุเทศก์ (ผู้ติดตาม)"
     นักศึกษาฝึกงานและสตาฟลงช่อง "อื่นๆ" ตามที่กรมการท่องเที่ยวให้กรอก */
  var picked=A.g.map(goGuide).filter(Boolean);
  var gs=picked.filter(goIsGuide);
  var oth=picked.filter(function(g){ return !goIsGuide(g); });
  /* §goCrewJob · ผช.ไกด์ที่จัดไว้ในใบงานเรือก็อยู่บนเรือด้วย · ต้องนับในช่อง "อื่นๆ"
     ไม่งั้นยอดรวมของใบสั่งงานกับทะเบียนรายชื่อที่พิมพ์ต่อกันจะไม่เท่ากัน
     แล้วเจ้าหน้าที่จะเจอเลขขัดกันเองในชุดเดียวกัน */
  var othN=(+A.other||0)+oth.length+goIslandN(date,bid);
  var lead=gs[0]||null;
  var crew=goCrewN(date,bid);
  var esc=(boat&&+boat.licensePax>0)?+boat.licensePax:((boat&&+boat.cap)||0);
  var no=goNoFor(date,bid,issue);
  var dep=(typeof pckDepOf==='function')?pckDepOf(rt.id||''):'';
  var tot=cnt.ad+cnt.chd+cnt.inf+gs.length+crew+othN;
  var sg=C.signers[A.sign]||C.signers[0]||{name:'',title:''};
  var dt=goThDate(date);
  /* §crewPaper · ช่องหมายเหตุเดิมว่างเปล่าทุกแถว · ใส่ชื่อคนที่จัดไว้ในใบงานเรือลงไป
     เจ้าท่าถามว่า "กัปตันคือใคร" ตัวเลข 3 คนตอบไม่ได้ · ชื่ออยู่ในระบบแล้วตั้งแต่จัดใบงานเรือ
     ยังไม่จัด = ช่องว่างไว้ให้เขียนมือเหมือนเดิม */
  var row=function(lb,n,rm){ return '<tr><td class="lb">'+lb+'</td><td class="n">'+n+'</td><td class="u">คน</td><td class="rm">'+(rm||'')+'</td></tr>'; };
  var CR=(typeof pjCrewOf==='function')?pjCrewOf(date,bid):{cap:'',asst:'',crew:[],island:[]};
  var crewNm=(typeof pjCrewLine==='function')?pjCrewLine(date,bid):'';
  var islNm=(CR.island||[]).join(' · ');
  return '<div class="gopg">'
    +'<h1>ใบสั่งงานมัคคุเทศก์</h1>'
    +'<div class="co"><div class="nm">'+e(H.en)+'</div><div class="sp"></div>'
      +'<div class="li">'+e(H.lic)+'</div><div class="li">'+e(H.th)+'</div><div class="ad">'+e(H.addr)+'</div></div>'
    +'<div class="reg">'+e(H.reg)+'</div><div class="dbd"></div>'
    +'<div class="sp"></div>'
    +'<div class="frow"><span class="flab">ใบสั่งงานประจำ</span><span class="fval">'+e(dt)+'</span>'
      +'<span class="fno">( ใบสั่งงานเลขที่ <b>'+(no?e(String(no)):'&nbsp;')+'</b> )</span></div>'
    +'<div class="frow"><span class="flab">มัคคุเทศก์</span>'
      +'<span class="fval l">'+e(lead?(lead.name+(lead.nick?(' ('+lead.nick+')'):'')):'')+'</span>'
      +'<span class="flab wr">ใบอนุญาตเลขที่</span><span class="fval">'+e(lead?(lead.license||''):'')+'</span></div>'
    +'<div class="frow"><span class="flab">ขออนุญาตนำเที่ยว</span><span class="fval">'+e(rt.islands||rt.name||'')+'</span></div>'
    +'<div class="box"><table>'
      +'<tr><td class="k">วันที่เดินทาง</td><td class="v">'+e(dt)+'</td><td class="k2">ถึง</td><td class="v">'+e(dt)+'</td></tr>'
      +'<tr><td class="k">รวมวันเดินทาง</td><td class="v">1</td><td class="k2">วัน</td>'
        +'<td class="pd"><table><tr><td class="k kk">เวลา</td><td class="v">'+e(dep?String(dep).replace(':','.')+' น.':'')+'</td></tr></table></td></tr>'
      +'<tr><td class="k">ชื่อเรือ</td><td class="v">'+e(goBoatTh(bid))+'</td>'
        +'<td colspan="2" class="pd"><table><tr><td class="k kp">ผู้โดยสาร</td><td class="v">'+(esc?e(esc+' ที่นั่ง'):'')+'</td></tr></table></td></tr>'
    +'</table></div>'
    +'<table class="pt">'
      +'<tr><th>ประเภทนักท่องเที่ยวและผู้ติดตามในเรือ</th><th colspan="2">จำนวน</th><th>หมายเหตุ</th></tr>'
      +row('ผู้ใหญ่', cnt.ad)
      +row('เด็กโต&nbsp; ( อายุ 4 - 12 ปี )', cnt.chd)
      +row('เด็กเล็ก (อายุไม่เกิน 3 ขวบ )', cnt.inf)
      +row('มัคคุเทศก์&nbsp; (ผู้ติดตาม)', gs.length)
      +row('กัปตันและนายท้ายเรือ', crew, crewNm?('<span class="rmn">'+e(crewNm)+'</span>'):'')
      +row('อื่นๆ .......นักศึกษาฝึกงาน./ สต๊าฟ........', othN, islNm?('<span class="rmn">ผช.ไกด์ '+e(islNm)+'</span>'):'')
      +'<tr class="sum"><td class="lb">รวมจำนวนผู้โดยสารบนเรือทั้งหมด</td><td class="n">'+tot+'</td><td class="u">คน</td><td class="blank"></td></tr>'
    +'</table>'
    +(gs.length>1?('<div class="gonote">มัคคุเทศก์ผู้ติดตาม: '+e(gs.slice(1).map(function(x){ return x.name+(x.license?(' ('+x.license+')'):''); }).join(' · '))+'</div>'):'')
    +(oth.length?('<div class="gonote">'+e(oth.map(function(x){ return x.name+' ('+goRoleT(goRoleOf(x))+')'; }).join(' · '))+'</div>'):'')
    +'<div class="sig"><span class="k">มัคคุเทศก์ลงนาม</span><span class="ln"></span></div>'
    +'<div class="sig2"><div><span class="k">ผู้มีอำนาจลงนาม</span><span class="who">'+e(sg.name||'')+'</span></div>'
      +'<div class="cap">( '+e(sg.title||'')+' )</div></div>'
  +'</div>';
}
function goCss(){ return '<style>'
  +'@page{size:A4 portrait;margin:10mm 12mm}'
  +'*{box-sizing:border-box}'
  +'body{margin:0;padding:20px 12px 50px;background:#e9eae5;font-family:\'Sarabun\',system-ui,sans-serif;color:#000;font-size:13px}'
  +'.gotool{max-width:820px;margin:0 auto 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;'
    +'border:1px solid #ddd;border-radius:8px;padding:10px 14px}'
  +'.gotool b{font-size:14px}.gotool .h{font-size:11.5px;color:#777;flex:1}'
  +'.gotool button{font-family:inherit;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;border:none;background:#2f2f2b;color:#fff;cursor:pointer}'
  // §goPlain · พื้นหลังขาวล้วน ไม่มีเส้นตารางพื้นหลัง · เหลือเฉพาะกรอบที่ต้องมีจริง
  +'.gopg{background:#fff;max-width:820px;margin:0 auto 22px;padding:26px 30px 34px;box-shadow:0 8px 26px -14px rgba(0,0,0,.3)}'
  +'.gopg h1{margin:0 0 20px;font-size:19px;font-weight:700;text-align:center;line-height:21px}'
  +'.co{text-align:center;line-height:21px}'
  +'.co .nm{font-size:15px;font-weight:700}.co .li{font-size:12.5px;font-weight:700}.co .ad{font-size:12.5px;font-weight:700}'
  +'.sp{height:21px}'
  +'.reg{text-align:right;font-size:11.5px;font-weight:600;line-height:21px;padding-right:2px}'
  +'.dbd{border-bottom:2px solid #000;margin-top:6px}'
  +'.frow{display:flex;align-items:flex-end;gap:8px;line-height:21px}'
  +'.flab{flex:none;font-size:13px}.flab.wr{width:150px;text-align:right}'
  +'.fval{flex:1;border-bottom:1px dotted #444;text-align:center;font-weight:700;font-size:13.5px;padding-bottom:1px;min-height:20px}'
  +'.fval.l{text-align:left;padding-left:10px}'
  +'.fno{flex:none;width:250px;font-size:13px}'
  +'.fno b{display:inline-block;min-width:120px;border-bottom:1px dotted #444;text-align:center;font-weight:700}'
  +'.box{border:1px solid #000;margin-top:16px}'
  +'.box table{width:100%;border-collapse:collapse}'
  +'.box td{padding:5px 10px;font-size:13px;line-height:21px;vertical-align:bottom}'
  +'.box td.k{width:110px}.box td.kk{width:66px}.box td.kp{width:96px;padding-left:14px}'
  +'.box td.v{border-bottom:1px dotted #444;text-align:center;font-weight:700}'
  +'.box td.k2{width:64px;text-align:center}.box td.pd{padding:0}'
  +'.pt{border:1px solid #000;border-collapse:collapse;width:100%;margin-top:20px}'
  +'.pt th,.pt td{border:1px solid #000;padding:5px 9px;font-size:13px;line-height:20px}'
  +'.pt th{font-weight:600;text-align:center}'
  +'.pt td.lb{text-align:left}.pt td.n{text-align:right;width:110px;font-weight:600}'
  +'.pt td.u{text-align:left;width:74px}.pt td.rm{width:250px}'
  +'.pt td.rm .rmn{font-size:11px;font-weight:600;line-height:16px}'   /* §crewPaper */
  +'.pt tr.sum td.lb{text-align:center;font-weight:600;border-right:none}'
  +'.pt tr.sum td.n{text-align:center;font-weight:700}.pt tr.sum td.blank{border:none}'
  +'.gonote{margin-top:10px;font-size:12px}'
  +'.sig{margin-top:64px;display:flex;align-items:flex-end;gap:8px;line-height:21px}'
  +'.sig .k{flex:none;font-size:13px}.sig .ln{flex:1;max-width:330px;border-bottom:1px dotted #444}'
  +'.sig2{margin-top:64px}'
  +'.sig2 .k{display:inline-block;width:110px}'
  +'.sig2 .who{margin-left:8px;font-style:italic;font-size:14px}'
  +'.sig2 .cap{margin-left:118px;font-size:13px}'
  +'@media print{body{background:#fff;padding:0}.gotool{display:none}'
    +'.gopg{box-shadow:none;margin:0;padding:0;max-width:none}'
    +'.gopg + .gopg{break-before:page}}'
  +'</style>'; }
/* §goCombo · ใบสั่งงานกับทะเบียนรายชื่อใช้สไตล์คนละชุดและคนละขอบกระดาษ
   พอพิมพ์ต่อกันในหน้าต่างเดียว @page / body / table ของสองชุดจะชนกัน
   แทนที่จะไปแก้ไฟล์เดิมสองที่ (แล้วต้องคอยดูแลให้ตรงกันตลอด) แก้ทับตรงนี้ที่เดียว
   ขอบกระดาษใช้ 7mm ของทะเบียน แล้วชดเชยให้ใบสั่งงานด้วย padding 3/5mm
   ผลลัพธ์ที่พิมพ์ออกมาเท่าเดิมทั้งสองใบ */
function goComboCss(){ return '<style>'
  +'@page{size:A4 portrait;margin:7mm}'
  +'body{margin:0;padding:18px 16px 60px;background:#E9EBEF}'
  +'.gopg{font-family:"Sarabun",system-ui,sans-serif;color:#000;font-size:13px}'
  +'.gopg table{table-layout:auto}'
  +'.sheet{font-family:"Noto Sans Thai","DM Sans",sans-serif;color:#111}'
  +'.gotool{max-width:820px}'
  +'.gotool button.on{background:#0F6E56}'
  +'.gotool button.gh{background:#fff;color:#5F5E5A;border:1px solid #ddd}'
  +'@media print{'
    +'body{background:#fff;padding:0}'
    +'.gopg{padding:3mm 5mm;margin:0;max-width:none;box-shadow:none}'
    +'.sheet{padding:0;margin:0;max-width:none;border:0;border-radius:0;box-shadow:none}'
    +'.gopg+.sheet,.sheet+.gopg{break-before:page;page-break-before:always}'
  +'}'
  +'</style>'; }
// bid = รหัสเรือ หรือ 'all'
function goPrint(bid){
  var date=_pckDate, e=ckEsc;
  var ids=[];
  if(bid && bid!=='all') ids=[bid];
  else {
    var seen={};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
      var t=ckTripOn(b,date); if(!t) return;
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
      var k=O.boatId||t.charterBoatId||''; if(k && !seen[k]){ seen[k]=1; ids.push(k); }
    });
  }
  if(!ids.length){ alert('ยังไม่มีเรือที่จัดไว้ในวันนี้ — จัดเรือก่อนถึงพิมพ์ใบสั่งงานได้'); return; }
  var miss=ids.filter(function(k){ return !goAsn(date,k).g.length; });
  if(miss.length && !confirm('ยังไม่ได้จ่ายไกด์ให้ '+miss.length+' ลำ ('+miss.map(goBoatTh).join(', ')+')\nช่องมัคคุเทศก์จะว่างไว้ให้เขียนมือ · พิมพ์ต่อเลยไหม')) return;
  /* §goCombo · เจ้าท่ารับใบสั่งงานกับทะเบียนรายชื่อพร้อมกันอยู่แล้ว
     แยกพิมพ์คนละหน้าต่างทำให้ต้องมาจับคู่ว่าใบไหนของลำไหนเอง · ออกต่อกันเป็นชุดเดียว
     ลำละ 2 หน้า เรียงใบสั่งงานก่อน แล้วทะเบียนของลำเดียวกันตามทันที */
  var sheets=ids.map(function(k){
    return goSheet(date,k,true)+((typeof pckTravelSheet==='function')?pckTravelSheet(k,date):'');
  }).join('');
  var title='ใบสั่งงาน + ทะเบียนรายชื่อ · '+(bid==='all'?('ทุกลำ '+ids.length+' ชุด'):goBoatTh(bid))+' · '+date;
  var html='<!doctype html><html lang="th"><head><meta charset="utf-8"><title>'+e(title)+'</title>'
    +'<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&family=DM+Mono:wght@400;700&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" rel="stylesheet">'
    +goCss()+((typeof pckTravelCss==='function')?pckTravelCss():'')+goComboCss()+'</head><body>'
    +'<div class="gotool"><b>ใบสั่งงาน + ทะเบียนรายชื่อ</b><span class="h">'+e(title)
      +' · A4 แนวตั้ง · 1 ลำ = ใบสั่งงาน 1 หน้า + ทะเบียน 1 หน้า</span>'
    +'<button onclick="window.print()">พิมพ์ / บันทึก PDF</button>'
    +'<button id="bOut" class="gh on" onclick="goDir(1)">ออกภูเก็ต</button>'
    +'<button id="bIn" class="gh" onclick="goDir(0)">เข้าภูเก็ต</button></div>'+sheets
    +'<' + 'script>function goDir(o){'
      +'var a=document.getElementById("bOut"),b=document.getElementById("bIn");'
      +'if(a) a.className="gh"+(o?" on":""); if(b) b.className="gh"+(o?"":" on");'
      +'Array.prototype.forEach.call(document.querySelectorAll(".sheet"),function(s){'
        +'var x=s.querySelectorAll(".cb")[0], y=s.querySelectorAll(".cb")[1];'
        +'if(x){x.className="cb"+(o?" on":"");x.innerHTML=o?"&#10003;":"&nbsp;";}'
        +'if(y){y.className="cb"+(o?"":" on");y.innerHTML=o?"&nbsp;":"&#10003;";}});}<' + '/script>'
    +'</body></html>';
  var w=window.open('','_blank'); if(!w){ alert('เปิดหน้าต่างไม่ได้ · อนุญาต pop-up ก่อน'); return; }
  w.document.write(html); w.document.close(); w.focus();
}
// ── หน้าต่างจ่ายไกด์ / ทะเบียน · acctModal อยู่ระดับ body สไตล์เลยต้องพกไปเอง ──
function goModalCss(){ return '<style>'
  +'#acct-modal .go-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E7E4DC}'
  +'#acct-modal .go-t{font-size:15px;font-weight:800;color:#2c2c2a}'
  +'#acct-modal .go-s{font-size:11px;color:#8a8a82;margin-top:2px;line-height:1.5}'
  +'#acct-modal .go-x{background:transparent;border:none;font-size:18px;color:#8a8a82;cursor:pointer;line-height:1}'
  +'#acct-modal .go-bd{padding:16px 20px 20px;font-family:inherit}'
  +'#acct-modal .go-lab{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a8a82;margin-bottom:7px}'
  +'#acct-modal .go-lab span{font-weight:600;letter-spacing:0;text-transform:none;color:#a8a49b;margin-left:6px}'
  +'#acct-modal .go-gs{display:grid;grid-template-columns:1fr 1fr;gap:7px}'
  +'#acct-modal #go-gs{max-height:300px;overflow:auto;padding-right:3px}'
  +'#acct-modal .go-rh{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:800;'
    +'color:#8a8a82;letter-spacing:.05em;margin:12px 0 6px}'
  +'#acct-modal .go-rh:first-child{margin-top:0}'
  +'#acct-modal .go-rh span{background:#EFEDE7;color:#5F5E5A;border-radius:999px;padding:1px 8px;font-size:10px}'
  +'#acct-modal .go-lg{display:inline-block;background:#E6F1FB;color:#185FA5;border-radius:5px;'
    +'padding:1px 5px;font-size:9px;font-weight:800;margin-left:5px;vertical-align:middle}'
  +'#acct-modal .go-gl{display:flex;align-items:center;gap:8px;border:1.5px solid #E7E4DC;border-radius:9px;padding:7px 10px;cursor:pointer;font-size:12px}'
  +'#acct-modal .go-gl.on{border-color:#0F6E56;background:#F1FAF6}'
  +'#acct-modal .go-gl b{font-weight:700;color:#2c2c2a}'
  +'#acct-modal .go-gl i{font-style:normal;font-size:10px;color:#8a8a82;margin-left:auto;font-family:ui-monospace,Menlo,monospace}'
  +'#acct-modal .go-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}'
  +'#acct-modal .go-bd input[type=number],#acct-modal .go-bd select{width:100%;height:34px;font-family:inherit;font-size:12.5px;'
    +'border:1px solid #E7E4DC;border-radius:8px;padding:2px 9px;background:#fff}'
  +'#acct-modal .go-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}'
  +'#acct-modal .go-act button{font-family:inherit;font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;cursor:pointer;border:1px solid #E7E4DC;background:#fff;color:#2c2c2a}'
  +'#acct-modal .go-b1{background:#0F6E56 !important;border-color:#0F6E56 !important;color:#fff !important}'
  +'#acct-modal .go-b2{margin-right:auto}'
  /* §gdRole · ตารางทะเบียนมี 7 คอลัมน์แล้ว · 560px ของ acctModal ไม่พอ
     ขยายเฉพาะกล่องที่มีตารางทะเบียนอยู่ (:has) · กล่องจ่ายไกด์ยังกว้างเท่าเดิม
     เผื่อเบราว์เซอร์ที่ไม่รู้จัก :has() ไว้ด้วย min-width + เลื่อนแนวนอน */
  +'#acct-modal > div:has(.go-reg){max-width:960px!important}'
  +'#acct-modal .go-scroll{overflow-x:auto;margin:0 -2px;padding:0 2px}'
  +'#acct-modal .go-tb{width:100%;border-collapse:collapse}'
  +'#acct-modal .go-tb.gtb-g{min-width:780px}'
  +'#acct-modal .go-tb th{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8a8a82;text-align:left;padding:0 4px 5px}'
  +'#acct-modal .go-tb td{padding:3px 4px;vertical-align:middle}'
  +'#acct-modal .go-tb td.c{text-align:center}'
  +'#acct-modal .go-tb input[type=text],#acct-modal .go-tb input:not([type]){width:100%;height:30px;font-family:inherit;font-size:12px;'
    +'border:1px solid #E7E4DC;border-radius:7px;padding:2px 8px;background:#fff}'
  +'#acct-modal .go-tb tr.off input{opacity:.5}'
  +'#acct-modal .go-del{background:transparent;border:none;color:#A32D2D;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}'
  +'#acct-modal .go-empty{padding:14px;text-align:center;color:#a8a49b;font-size:12px}'
  +'#acct-modal .go-hint{font-size:10.5px;color:#8a8a82;line-height:1.6}'
  +'</style>'; }
// ── จ่ายไกด์เข้าลำ + พิมพ์ ──────────────────────────────────────────────
function goSetupOpen(bid){
  var date=_pckDate, e=ckEsc, A=goAsn(date,bid), C=goCfg(), G=goGuides().filter(function(x){ return x.active!==false; });
  var cnt=goCounts(date,bid), boat=(typeof getBoat==='function')?getBoat(bid):null;
  var no=goNoFor(date,bid,false);
  /* §gdRole · แยกกลุ่มตามบทบาท · หน้าท่าจะได้ไม่ติ๊กนักศึกษาฝึกงานเป็นมัคคุเทศก์ผู้รับผิดชอบใบ */
  function goCard(g){
    var on=A.g.indexOf(g.id)>=0, LG=goLangsOf(g);
    var chips=LG.map(function(L){ return '<span class="go-lg">'+e(L)+'</span>'; }).join('');
    return '<label class="go-gl'+(on?' on':'')+'"><input type="checkbox" '+(on?'checked':'')+' value="'+e(g.id)+'" onchange="goSetupTick(this)">'
      +'<b>'+e(g.name)+(g.nick?(' ('+e(g.nick)+')'):'')+chips+'</b>'
      +'<i>'+e(g.license||'ไม่มีเลขใบอนุญาต')+'</i></label>';
  }
  var opts=GO_ROLES.map(function(R){
    var list=G.filter(function(g){ return goRoleOf(g)===R.k; });
    if(!list.length) return '';
    return '<div class="go-rh">'+e(R.t)+' <span>'+list.length+'</span></div>'
      +'<div class="go-gs">'+list.map(goCard).join('')+'</div>';
  }).join('') || '<div class="go-empty">ยังไม่มีไกด์ในทะเบียน — กด “ทะเบียนไกด์” เพื่อเพิ่ม</div>';
  var sgn=C.signers.map(function(x,i){ return '<option value="'+i+'"'+(i===A.sign?' selected':'')+'>'+e(x.name+' ('+x.title+')')+'</option>'; }).join('');
  acctModal(goModalCss()+'<div class="go-hd"><div><div class="go-t">ใบสั่งงานมัคคุเทศก์ · '+e(goBoatTh(bid))+'</div>'
    +'<div class="go-s">'+e(date)+' · ผู้ใหญ่ '+cnt.ad+' · เด็กโต '+cnt.chd+' · เด็กเล็ก '+cnt.inf
      +' · กัปตัน/นายท้าย '+goCrewN(date,bid)+' (จากใบงานเรือ)'+(no?(' · เลขที่ '+no):' · ยังไม่ออกเลขที่')+'</div></div>'
    +'<button class="go-x" onclick="acctModalClose()">&#10005;</button></div>'
    +'<div class="go-bd">'
      +'<div class="go-lab">มัคคุเทศก์ที่ขึ้นลำนี้ <span>คนแรกคือผู้รับผิดชอบใบ · ที่เหลือนับเป็นผู้ติดตาม</span></div>'
      +'<div id="go-gs">'+opts+'</div>'
      +'<div class="go-2">'
        +'<div><div class="go-lab">อื่นๆ ที่ไม่อยู่ในทะเบียน</div>'
          +'<input type="number" min="0" id="go-other" value="'+(+A.other||0)+'"></div>'
        +'<div><div class="go-lab">ผู้มีอำนาจลงนาม</div><select id="go-sign">'+sgn+'</select></div>'
      +'</div>'
      +'<div class="go-act">'
        +'<button class="go-b2" onclick="goRegOpen(\''+e(bid)+'\')" title="เพิ่ม/แก้ไกด์แล้วกลับมาที่หน้านี้">ทะเบียนไกด์</button>'
        +'<button class="go-b1" onclick="goSetupSave(\''+e(bid)+'\',1)">บันทึก + พิมพ์</button>'
        +'<button class="go-b3" onclick="goSetupSave(\''+e(bid)+'\',0)">บันทึกเฉยๆ</button>'
      +'</div>'
    +'</div>');
}
function goSetupTick(el){ var l=el.closest('label'); if(l) l.classList.toggle('on', el.checked); }
function goSetupSave(bid, doPrint){
  var date=_pckDate, host=document.getElementById('go-gs');
  var g=[]; if(host) Array.prototype.forEach.call(host.querySelectorAll('input:checked'), function(x){ g.push(x.value); });
  var other=Math.max(0, parseInt((document.getElementById('go-other')||{}).value,10)||0);
  var sign=Math.max(0, parseInt((document.getElementById('go-sign')||{}).value,10)||0);
  goAsnSet(date,bid,{g:g, other:other, sign:sign});
  acctModalClose();
  if(typeof renderPierCheckin==='function') renderPierCheckin();
  if(doPrint) goPrint(bid);
}
// ── ทะเบียนไกด์ + ตั้งค่าเลขที่/ผู้ลงนาม ────────────────────────────────
function goRegOpen(back){
  var e=ckEsc, G=goGuides(), C=goCfg();
  var rows=G.map(function(g,i){
    return '<tr'+(g.active===false?' class="off"':'')+'>'
      +'<td><input value="'+e(g.name||'')+'" oninput="goRegSet('+i+',\'name\',this.value)" placeholder="ชื่อ-นามสกุล (ไทย)"></td>'
      +'<td><input value="'+e(g.nick||'')+'" oninput="goRegSet('+i+',\'nick\',this.value)" placeholder="ชื่อเล่น"></td>'
      +'<td><input value="'+e(g.license||'')+'" oninput="goRegSet('+i+',\'license\',this.value)" placeholder="1-000000"></td>'
      +'<td><input value="'+e(goLangsOf(g).join(', '))+'" onchange="goRegSet('+i+',\'lang\',goLangsParse(this.value))" placeholder="EN, RU"></td>'
      +'<td><select onchange="goRegSet('+i+',\'role\',this.value)">'
        + GO_ROLES.map(function(R){ return '<option value="'+R.k+'"'+(goRoleOf(g)===R.k?' selected':'')+'>'+e(R.t)+'</option>'; }).join('')
        +'</select></td>'
      +'<td class="c"><input type="checkbox" '+(g.active===false?'':'checked')+' onchange="goRegSet('+i+',\'active\',this.checked)"></td>'
      +'<td class="c"><button class="go-del" onclick="goRegDel('+i+')">ลบ</button></td></tr>';
  }).join('') || '<tr><td colspan="7" class="go-empty">ยังไม่มีไกด์ · กด “+ เพิ่มไกด์”</td></tr>';
  var sg=C.signers.map(function(x,i){
    return '<tr><td><input value="'+e(x.name||'')+'" oninput="goSgSet('+i+',\'name\',this.value)" placeholder="ชื่อผู้ลงนาม"></td>'
      +'<td><input value="'+e(x.title||'')+'" oninput="goSgSet('+i+',\'title\',this.value)" placeholder="ตำแหน่ง"></td>'
      +'<td class="c"><button class="go-del" onclick="goSgDel('+i+')">ลบ</button></td></tr>';
  }).join('');
  acctModal(goModalCss()+'<div class="go-hd"><div><div class="go-t">ทะเบียนมัคคุเทศก์ / ตั้งค่าใบสั่งงาน</div>'
    +'<div class="go-s">พิมพ์แล้วบันทึกทันที · ใช้ร่วมกันทุกเครื่อง</div></div>'
    +'<button class="go-x" onclick="acctModalClose()">&#10005;</button></div>'
    +'<div class="go-bd go-reg">'
      +'<div class="go-lab">ทะเบียนไกด์</div>'
      +'<div class="go-scroll">'
      +'<table class="go-tb gtb-g"><thead><tr><th>ชื่อ-นามสกุล</th><th style="width:96px">ชื่อเล่น</th>'
        +'<th style="width:112px">เลขใบอนุญาต</th><th style="width:104px">ภาษา</th>'
        +'<th style="width:126px">บทบาท</th><th style="width:52px">ใช้งาน</th><th style="width:46px"></th></tr></thead>'
        +'<tbody>'+rows+'</tbody></table></div>'
      +'<button class="go-b2" onclick="goRegAdd()" style="margin-top:8px">+ เพิ่มไกด์</button>'
      +'<div class="go-lab" style="margin-top:18px">ผู้มีอำนาจลงนาม</div>'
      +'<table class="go-tb"><tbody>'+sg+'</tbody></table>'
      +'<button class="go-b2" onclick="goSgAdd()" style="margin-top:8px">+ เพิ่มผู้ลงนาม</button>'
      +'<div class="go-2" style="margin-top:18px">'
        +'<div><div class="go-lab">เลขที่ใบถัดไป</div>'
          +'<input type="number" min="1" value="'+C.next+'" onchange="goCfgNext(this.value)"></div>'
        +'<div><div class="go-lab">&nbsp;</div>'
          +'<div class="go-hint">เลขที่ออกไปแล้วจะถูกจำไว้ต่อลำต่อวัน · พิมพ์ซ้ำได้เลขเดิม ไม่กินเลขใหม่</div></div>'
      +'</div>'
      +'<div class="go-act"><button class="go-b1" onclick="'+(back?('goSetupOpen(\''+e(back)+'\')'):'acctModalClose()')+'">'+(back?'กลับไปหน้าจ่ายไกด์':'ปิด')+'</button></div>'
    +'</div>');
}
function goRegAdd(){ var G=goGuides(); G.push({id:'g_'+Date.now().toString(36), name:'', nick:'', license:'', lang:[], role:'guide', active:true}); goGuidesSet(G); goRegOpen(); }
function goRegDel(i){ var G=goGuides(); if(!G[i]) return; if(!confirm('ลบ "'+(G[i].name||'ไกด์')+'" ออกจากทะเบียน?')) return; G.splice(i,1); goGuidesSet(G); goRegOpen(); }
function goRegSet(i,k,v){ var G=goGuides(); if(!G[i]) return; G[i][k]=v; goGuidesSet(G); }
function goSgAdd(){ var C=goCfg(); C.signers.push({name:'',title:''}); goCfgSet(C); goRegOpen(); }
function goSgDel(i){ var C=goCfg(); if(C.signers.length<=1) return alert('ต้องเหลือผู้ลงนามอย่างน้อย 1 คน'); C.signers.splice(i,1); goCfgSet(C); goRegOpen(); }
function goSgSet(i,k,v){ var C=goCfg(); if(!C.signers[i]) return; C.signers[i][k]=v; goCfgSet(C); }
function goCfgNext(v){ var C=goCfg(); C.next=Math.max(1, parseInt(v,10)||1); goCfgSet(C); }

// bid = รหัสเรือ หรือ 'all' (ทุกลำของวันนั้น · 1 ลำ = 1 หน้า)
function pckGuideJobOrder(bid){
  var date=_pckDate, e=ckEsc;
  // §onsiteVoid · ใบที่ยกเลิกจนไม่เหลือคนไม่ต้องพิมพ์ลงใบงาน — ไกด์จะได้ไม่ยืนรอคนที่ไม่มาแล้ว
  //   เก็บแค่ยอดรวมไว้ขึ้นหัวใบ เผื่อพิมพ์ซ้ำหลังเกิดเรื่องแล้วเลขจะได้อธิบายตัวเองได้
  var all=[], voidBy={};
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    var booked=ckBookedPax(t);
    var row={b:b, t:t, O:O, booked:booked, expect:booked, ck:O.pierCheckin||null,
             van:O.vanCheckin||null, vanId:O.vanId||''};
    // §ovnBack · ติดธงไว้ตั้งแต่ตรงนี้ · ใบจะได้แยกกลุ่ม "รับกลับจากเกาะ" ออกมาให้เห็นชัด
    row._ovnBack=(typeof bkIsOvnReturn==='function') && bkIsOvnReturn(t);
    row._ovnOut=row._ovnBack ? ((typeof _ovnOutDate==='function')?_ovnOutDate(b,t):'') : '';
    row.bid=O.boatId||t.charterBoatId||'';
    row.arr=pckArrivalOf(row);
    if(!row.bid) return;                       // ยังไม่จัดเรือ = ยังไม่มีใบงาน
    var _vd=pckVoidInfo(b,date,t);
    // §boatSplit · กางก่อนแล้วค่อยกรองตามลำ · ไกด์แต่ละลำจะได้เห็นเฉพาะยอดของลำตัวเอง
    pckExpandBoatSplits(row, b, date, []).forEach(function(r2){
      if(!r2.bid) return;
      if(bid!=='all' && r2.bid!==bid) return;
      if(_vd){ var V=voidBy[r2.bid]=(voidBy[r2.bid]||{n:0,pax:0}); V.n++; V.pax+=(r2.bsN?r2.booked:_vd.pax); return; }
      all.push(r2);
    });
  });
  if(!all.length){ alert('ยังไม่มี booking ที่จัดเรือแล้วในวันนี้ — จัดเรือก่อนถึงพิมพ์ใบงานได้'); return; }
  var byBoat={}, order=[];
  all.forEach(function(r){ if(!byBoat[r.bid]){ byBoat[r.bid]=[]; order.push(r.bid); } byBoat[r.bid].push(r); });
  order.sort(function(a,b){
    var ta=pckDepOf((byBoat[a][0].t||{}).routeId||''), tb=pckDepOf((byBoat[b][0].t||{}).routeId||'');
    return String(ta||'99').localeCompare(String(tb||'99')) || String(pckBoatName(a)).localeCompare(String(pckBoatName(b)));
  });
  var sheets=order.map(function(k){ return pckGuideJobSheet(k, date, byBoat[k], voidBy[k]); }).join('');
  var title='ใบงานไกด์ · '+(bid==='all'?('ทุกลำ '+order.length+' ใบ'):pckBoatName(bid))+' · '+date;
  var html='<!doctype html><html lang="th"><head><meta charset="utf-8"><title>'+e(title)+'</title>'
    +'<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap" rel="stylesheet">'
    +pckGuideJobCss()+'</head><body>'
    +'<div class="tools"><b>ใบงานไกด์</b><span class="h">'+e(title)+' · A4 แนวนอน · 1 ลำ = 1 ใบ</span>'
    +'<button onclick="window.print()">พิมพ์ / บันทึก PDF</button></div>'
    +sheets
    // §onePage · ตาข่ายสุดท้าย · วัดจริงหลังเรนเดอร์ ถ้าตารางยังล้นกรอบค่อยย่อทั้งใบ
    // (ระดับความหนาแน่นด้านบนจัดการได้เกือบทุกกรณีแล้ว อันนี้กันเคสสุดโต่ง เช่นชื่อยาวผิดปกติ)
    // §onePage · ย่อ "ตาราง" ให้พอดีกรอบที่เหลือ · ห้ามย่อทั้งใบ เพราะย่อทั้งใบจะย่อกรอบลงไปด้วย
    // สัดส่วนเท่าเดิม แก้อะไรไม่ได้ (บั๊กที่เจอ 1 ส.ค. · ตารางทะลุไปทับช่องลงชื่อท้ายใบ)
    // รันซ้ำตอนฟอนต์โหลดเสร็จและตอนสั่งพิมพ์ เพราะความสูงจะเปลี่ยนหลังฟอนต์จริงมาถึง
    // §autoFit · หาระดับที่ "ใหญ่ที่สุดที่ยังพอดีหน้า" ด้วยการวัดจริง ไม่ใช่การเดา
    // ไล่ d1 → d4 หยุดทันทีที่ตารางไม่ล้นกรอบ · ถ้า d4 ยังล้นค่อยย่อตารางเป็นทางสุดท้าย
    // (ห้ามย่อทั้งใบ เพราะจะย่อกรอบลงไปด้วย สัดส่วนเท่าเดิม แก้อะไรไม่ได้)
    +'<script>(function(){var T=["d1","d2"];function fit(){'   /* §guideBig · ไม่ย่อต่ำกว่า d2 · ล้นก็ให้ไปหน้า 2 */
    +'Array.prototype.forEach.call(document.querySelectorAll(".sheet"),function(el){'
    +'var tw=el.querySelector(".tw"), tb=tw&&tw.querySelector("table"); if(!tb) return;'
    // §meas · แท่งวัด 210mm · ให้เบราว์เซอร์บอกเองว่า 1 หน้าเท่ากับกี่ px
    +'var _pr=document.createElement("div");'
    +'_pr.style.cssText="position:absolute;left:0;top:0;width:0;height:210mm;visibility:hidden;pointer-events:none";'
    +'el.appendChild(_pr); var PH=_pr.offsetHeight||794; _pr.parentNode.removeChild(_pr);'
    +'var _cs=getComputedStyle(el), _hd=el.querySelector(".pgt > thead");'
    +'var AV=PH-(parseFloat(_cs.paddingTop)||0)-(parseFloat(_cs.paddingBottom)||0)'
      +'-(_hd?_hd.getBoundingClientRect().height:0)-6;'   /* 6 = margin-top ของ .tw */
    +'if(AV<80) return;'
    +'tb.style.zoom=1; var i, ok=false;'
    +'var TD=tb.querySelectorAll("td");'
    +'Array.prototype.forEach.call(TD,function(c){ c.style.paddingTop=""; c.style.paddingBottom=""; });'
    +'for(i=0;i<T.length;i++){ T.forEach(function(c){ el.classList.remove(c); }); el.classList.add(T[i]);'
    +'if(tb.scrollHeight<=AV){ ok=true; break; } }'   /* §meas · เทียบกับที่ว่างจริงบนกระดาษ */
    +'if(!ok){ return; }'   /* §guidePage2 · ล้นก็ปล่อยขึ้นหน้า 2 · ไม่ย่ออีกแล้ว */
    // §fillPage · เลือกระดับที่ "พอดี" แล้วยังเหลือที่ว่างท้ายใบ · เกลี่ยลงทุกแถวเท่าๆ กัน
    //   ใบที่คนน้อยเคยจบครึ่งหน้าแล้วเว้นขาวยาว ดูเหมือนพิมพ์ไม่ครบ · เกลี่ยแล้วเต็มหน้าเหมือนกันทุกใบ
    //   เพิ่มเฉพาะระยะห่าง ไม่แตะขนาดตัวหนังสือ · เพดาน 7px กันแถวอ้วนจนดูโหว่
    +'var sl=AV-tb.scrollHeight; if(sl<=0) return;'   /* §guidePage2 · ล้นอยู่ ไม่ต้องเกลี่ยเพิ่ม */
    +'var rn=tb.querySelectorAll("tbody tr").length||1;'
    +'var ex=Math.floor(sl/rn/2); if(ex>7) ex=7;'
    +'if(ex>0){ Array.prototype.forEach.call(TD,function(c){ c.style.paddingTop=ex+"px"; c.style.paddingBottom=ex+"px"; }); }'
    +'});}'
    +'setTimeout(fit,60); window.addEventListener("load",function(){setTimeout(fit,40);});'
    +'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(fit,20);});}'
    +'window.addEventListener("beforeprint",fit);})();<\/script>'
    +'</body></html>';
  var w=window.open('','_blank');
  if(!w){ alert('เบราว์เซอร์บล็อกป๊อปอัป — อนุญาตป๊อปอัปของเว็บนี้ก่อน แล้วกดใหม่'); return; }
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
}
function pckNat3(v){
  var t=String(v==null?'':v).trim().toUpperCase();
  if(!t) return '';
  if(t.length===2) return PCK_NAT3[t]||t;
  return t;
}
/* "วันพุธ 19 สิงหาคม 2026" · ปี ค.ศ. ตามที่ใบเดิมใช้ ไม่ใช่ พ.ศ. */
function pckThaiDateCE(ymd){
  var p=String(ymd||'').split('-'), y=+p[0], m=+p[1], d=+p[2];
  if(!y||!m||!d) return String(ymd||'');
  var w=-1; try{ var dt=new Date(String(ymd)+'T12:00:00'); if(!isNaN(dt)) w=dt.getDay(); }catch(_){}
  var ML=(typeof MONTHS_TH!=='undefined')?MONTHS_TH:[];
  var DW=(typeof PJ_DOW_TH!=='undefined')?PJ_DOW_TH:[];
  return (w>=0?((DW[w]||'')+' '):'')+d+' '+(ML[m-1]||m)+' '+y;
}
/* ── ลูกเรือ + ไกด์ · อ่านจากใบงานเรือและใบสั่งงานมัคคุเทศก์ที่จัดไว้แล้ว ──
   ตำแหน่งใช้คำเดียวกับใบเดิมที่เจ้าท่าคุ้นตา · ผู้ช่วยกัปตันในระบบคือคนถือใบช่างเครื่อง */
function pckTravelCrew(bid, date){
  var out=[];
  var J=(typeof pjOf==='function')?pjOf(date,bid):null;
  var nm=(typeof pjStaffName==='function')?pjStaffName:function(x){ return x||''; };
  if(J){
    if(J.cap)  out.push({ name:nm(J.cap),  pos:'กัปตัน',     grp:'cap' });
    if(J.asst) out.push({ name:nm(J.asst), pos:'ช่างเครื่อง', grp:'eng' });
    (J.crew||[]).forEach(function(id){ if(id) out.push({ name:nm(id), pos:'คนเรือ', grp:'crew' }); });
    (J.island||[]).forEach(function(id){ if(id) out.push({ name:nm(id), pos:'ผช. ไกด์', grp:'staff' }); });
  }
  var GF=(typeof pjGuidesFull==='function')?pjGuidesFull(date,bid):[];
  GF.forEach(function(g){
    out.push({ name:g.name||'', pos:(g.guide?'ไกด์':'ผช. ไกด์'), grp:(g.guide?'guide':'staff') });
  });
  /* §regNoBlank · คนที่ใบสั่งงานนับไว้แต่ไม่ได้ระบุชื่อ · เดิมเว้นบรรทัดว่างไว้ให้เขียนมือ
     ตอนนี้ใบเอาเฉพาะบรรทัดที่มีชื่อ · เก็บเป็นจำนวนติดมากับ list ไว้ให้ยอดท้ายใบยังตรง
     แล้วขึ้นบรรทัดบอกท้ายใบว่ามีกี่คนที่ยังไม่ได้ระบุชื่อ ไม่ใช่ทำหายเงียบ ๆ */
  var res=out.filter(function(x){ return String(x.name||'').trim(); });
  res.blank=(GF&&GF.other)?(+GF.other||0):0;
  return res;
}
/* ── ลูกค้า · หนึ่งคน = หนึ่งบรรทัด ──────────────────────────────────────
   คืน { people, pax, th, fr, over } · people เรียงตามใบจองเพื่อให้ครอบครัวอยู่ติดกัน
   คนที่ใบจองไม่ได้พิมพ์ชื่อไว้ ยังได้บรรทัดของตัวเอง (ว่าง) ไว้ให้หน้าท่าเขียนมือ
   ตัดบรรทัดทิ้งเลยจะทำให้จำนวนบรรทัดไม่ตรงกับยอดรวมท้ายใบ */
function pckTravelRows(bid, date){
  var people=[], pax=0, th=0, fr=0, over=0, noname=0, list=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId||'')!==bid) return;
    /* ปิดรายการหน้างานแล้ว = ไม่ได้ลงเรือ · ใบนี้คือรายชื่อคนที่อยู่บนเรือจริง */
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;
    var booked=(typeof ckBookedPax==='function')?ckBookedPax(t):0;
    var tot=pckOnBoard(b,date,booked);                     /* §ckPierSelf2 */
    if(!tot) return;
    list.push({b:b, t:t, tot:tot, vc:String(b.voucherRef||b.code||b.id||'').trim()});
  });
  list.sort(function(a,b){ return String(a.vc).localeCompare(String(b.vc)); });

  list.forEach(function(x){
    var b=x.b, t=x.t, tot=x.tot;
    var P=t.pax||{}, nTh=0, nFr=0;
    ['ad','chd','inf','foc'].forEach(function(k){ nTh+=(+P[k+'_th']||0); nFr+=(+P[k+'_fr']||0); });
    /* สัดส่วนไทย/ต่างชาติมาจากใบจอง · จำนวนคนจริงมาจากการเช็คอิน
       มีคนแจ้งไม่มา สองช่องนี้จะบวกกันเกินยอดจริง แล้วท้ายใบขัดกันเอง · เกลี่ยตามสัดส่วน */
    var base=nTh+nFr;
    if(base>tot){ nTh=Math.max(0, Math.min(tot, Math.round(tot*nTh/base))); nFr=tot-nTh; }
    pax+=tot; th+=nTh; fr+=nFr;
    /* สัญชาติสำรองระดับใบจอง · ใช้เมื่อรายคนไม่ได้กรอกไว้ */
    var bkNat='', seen={};
    (b.passengers||[]).forEach(function(p){ var c=pckNat3(p&&p.nationality);
      if(c && !seen[c]){ seen[c]=1; if(!bkNat) bkNat=c; } });
    if(!bkNat && nTh>0 && !nFr) bkNat='THA';

    var nm=[];
    (b.passengers||[]).forEach(function(p){
      var n=String((p&&p.name)||'').trim(); if(!n) return;
      nm.push({ name:n, nat:pckNat3(p&&p.nationality)||bkNat });
    });
    if(!nm.length && b.leadPax) nm.push({ name:String(b.leadPax).trim(), nat:bkNat });
    /* ชื่อมากกว่าจำนวนที่เดินทางจริง = มีคนแจ้งไม่มา · ใบต้องตรงกับคนที่อยู่บนเรือ */
    if(nm.length>tot){ over+=(nm.length-tot); nm=nm.slice(0,tot); }
    var phone=String(b.leadPhone||b.phone||'').trim();
    nm.forEach(function(p,i){
      people.push({ name:p.name, nat:p.nat||'', phone:(i===0?phone:'') });
    });
    /* §regNoBlank · ใบจองยังไม่ได้พิมพ์ชื่อ · ไม่เว้นบรรทัดว่างแล้ว นับไว้บอกท้ายใบแทน
       ยอดรวมยังใช้จำนวนคนจริงที่อยู่บนเรือ · บรรทัดในตารางจึงน้อยกว่ายอดได้ ตั้งใจให้เป็นแบบนั้น */
    noname += Math.max(0, tot-nm.length);
  });
  return { people:people, pax:pax, th:th, fr:fr, over:over, noname:noname };
}
function pckTravelCss(){
  return '<style id="sty">'
  +'@page{size:A4 portrait;margin:7mm}'
  +'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}'
  +'body{margin:0;background:#E9EBEF;font-family:"Noto Sans Thai","DM Sans",sans-serif;color:#111}'
  +'@media screen{body{padding:18px 16px 60px}}'
  +'.tb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:820px;margin:0 auto 14px}'
  +'.tb b{font-size:13px;color:#0F172A}'
  +'.tb button{border:1px solid #E2E8F0;background:#fff;border-radius:11px;padding:8px 15px;'
    +'font:700 12.5px inherit;color:#475569;cursor:pointer;font-family:inherit}'
  +'.tb button.pri{background:#0F172A;border-color:#0F172A;color:#fff}'
  +'.tb button.on{background:#0F6E56;border-color:#0F6E56;color:#fff}'
  +'.tb .hint{font-size:11px;color:#94A3B8}'
  +'.sheet{background:#fff;margin:0 auto 18px;padding:8px 10px 12px;border:1px solid #CBD5E1;border-radius:6px;'
    +'max-width:820px;box-shadow:0 2px 12px rgba(15,23,42,.07)}'
  +'@media print{body{background:#fff;padding:0}.tb{display:none}'
    +'.sheet{max-width:none;border:0;border-radius:0;box-shadow:none;padding:0;margin:0}'
    +'.sheet+.sheet{page-break-before:always}}'
  +'.ttl{text-align:center;font-size:12px;font-weight:800;padding:3px 0 2px}'
  +'.dt{text-align:center;font-size:10.5px;font-weight:700;padding-bottom:4px}'
  +'table{border-collapse:collapse;width:100%;table-layout:fixed}'
  +'.hd td{border:1px solid #6B7280;padding:2px 5px;font-size:9px;height:17px;vertical-align:middle}'
  +'.hd .k{font-weight:700}'
  +'.cb{display:inline-block;width:11px;height:11px;border:1px solid #374151;text-align:center;'
    +'line-height:10px;font-size:9px;font-weight:800;vertical-align:-1px;margin-right:4px}'
  +'.cb.on{background:#166534;border-color:#166534;color:#fff}'
  +'.gt{margin-top:3px}'
  +'.gt th,.gt td{border:1px solid #6B7280;padding:1px 3px;font-size:8px;word-break:break-word;overflow:hidden}'
  +'.gt th{background:#F3F4F6;font-weight:700;text-align:center;line-height:1.15;font-size:7.4px;padding:2px 1px}'
  +'.gt thead{display:table-header-group}'
  +'.gt tr{page-break-inside:avoid}'
  +'.gt td.no{font-family:"DM Mono",monospace;font-size:8px}'
  +'.gt td{height:15px;text-align:center;vertical-align:middle;line-height:1.25}'
  +'.gt td.nm{text-align:left;padding-left:5px}'
  +'.gt td.nm span{display:block}'
  +'.gt td.nm em{font-style:normal;color:#6B7280}'
  +'.gt tr.band td{background:#1F2937;height:11px;padding:0 6px;text-align:right;color:#fff;'
    +'font-size:8px;font-weight:800;border-color:#1F2937}'
  +'.sum{margin-top:6px;display:flex;gap:26px;align-items:flex-start;font-size:9px}'
  +'.sum table{width:auto;table-layout:auto}'
  +'.sum td{padding:1px 6px 1px 0;white-space:nowrap}'
  +'.sum td.n{text-align:right;font-weight:700;font-family:"DM Mono",monospace;min-width:34px}'
  +'.sum tr.tot td{font-weight:800}'
  +'.sum tr.tot td.n{background:#FEF08A}'
  +'.rep{margin-left:auto;font-size:9px;padding-top:2px}'
  +'.warn{margin-top:5px;font-size:8px;color:#92400E;background:#FEF6E7;border:1px solid #EFD9AE;'
    +'border-radius:4px;padding:3px 7px}'
  +'</style>';
}
function pckTravelSheet(bid, date){
  var e=ckEsc;
  var boat=((typeof getBoat==='function')?getBoat(bid):null)||{};
  var op=(typeof TRIPS!=='undefined' && TRIPS[date])?TRIPS[date][bid]:null;
  var rid=(op&&op.route)||'';
  if(!rid){ try{ (SB_BOOKINGS||[]).some(function(b){ var t=ckTripOn(b,date); if(!t) return false;
      var O=bkOpsRead(b,date); if((O.boatId||t.charterBoatId)!==bid) return false; rid=t.routeId; return true; }); }catch(_){} }
  var rt=((typeof getRoute==='function')?getRoute(rid):null)||{};
  var dep=(typeof pckDepOf==='function')?(pckDepOf(rid)||''):'';
  var reg=String(boat.reg||'').replace(/[^0-9A-Za-z]/g,'');
  var CR=pckTravelCrew(bid,date), PP=pckTravelRows(bid,date);

  /* ── ยอดท้ายใบ ── */
  var cnt={cap:0,eng:0,crew:0,guide:0,staff:0};
  CR.forEach(function(c){ cnt[c.grp]=(cnt[c.grp]||0)+1; });
  /* §regNoBlank · คนที่ไม่ได้ระบุชื่อไม่มีบรรทัดในตารางแล้ว แต่ยังอยู่บนเรือจริง · ยอดต้องนับ */
  var blankCrew=(+CR.blank||0);
  cnt.staff+=blankCrew;
  var nCrew=CR.length+blankCrew, pax=PP.pax, th=PP.th, fr=PP.fr;
  var unspec=Math.max(0, pax-th-fr);
  /* ไม่ระบุสัญชาติ · ใบมีแค่สองช่อง จึงต้องเลือกข้าง · ลงต่างชาติแล้วบอกไว้ท้ายใบว่ากี่คน
     เงียบไว้แล้วยอดสองช่องไม่บวกกันเป็นยอดรวม คนตรวจจะสงสัยก่อน แล้วไม่รู้ว่าเพราะอะไร */
  var thai=th, forg=fr+unspec, all=nCrew+pax;

  var CB=function(on){ return '<span class="cb'+(on?' on':'')+'">'+(on?'&#10003;':'&nbsp;')+'</span>'; };
  var head='<table class="hd"><colgroup><col style="width:11%"><col style="width:27%"><col style="width:17%">'
     +'<col style="width:13%"><col style="width:14%"><col style="width:9%"><col style="width:9%"></colgroup>'
   +'<tr><td class="k">ชื่อเรือ</td><td>'+e(boat.name||bid)+'</td>'
     +'<td class="k">หมายเลขทะเบียนเรือ</td><td>'+e(reg||'—')+'</td>'
     +'<td class="k">ประเภทการเดินทาง</td>'
     +'<td id="cOut">'+CB(1)+'ออกภูเก็ต</td><td id="cIn">'+CB(0)+'เข้าภูเก็ต</td></tr>'
   +'<tr><td class="k">เวลาเดินเรือ</td><td>'+e(dep?(dep.replace(':','.')+' น.'):'—')+'</td>'
     +'<td class="k">จุดหมายปลายทาง</td><td colspan="4">'+e(rt.islands||rt.name||'—')+'</td></tr>'
   +'</table>';

  var COL=[5.5,27,4,9.5,9,5.5,5,8,5,6.5,6,9];
  var cols='<colgroup>'+COL.map(function(w){ return '<col style="width:'+w+'%">'; }).join('')+'</colgroup>';
  var th2='<thead><tr>'
   +'<th>ลำดับที่</th><th>ชื่อ - สกุล</th><th>อายุ (ปี)</th>'
   +'<th>เลขบัตรประชาชน<br>Passport</th><th>เบอร์โทร</th><th>สัญชาติ</th><th>อุณหภูมิ</th>'
   +'<th>14 วันก่อนเดินทาง<br>มาจากพื้นที่ใด</th><th>อาการ<br>เจ็บป่วย</th>'
   +'<th>ชนิดวัคซีน<br>ยี่ห้อ / กี่โดส</th><th>ผลตรวจ<br>หาเชื้อ</th><th>ตำแหน่งในเรือ</th></tr></thead>';

  var band=function(txt){ return '<tr class="band"><td colspan="12">'+e(txt||'')+'</td></tr>'; };
  /* §regNoBlank · เอาเฉพาะคนที่มีชื่อ · ไม่ยืดตารางให้ครบ 10 บรรทัดแล้ว */
  var cb='';
  for(var i=0;i<CR.length;i++){
    var c=CR[i];
    cb+='<tr><td class="no">'+(i+1)+'</td><td class="nm">'+(c?e(c.name):'')+'</td><td></td><td></td><td></td>'
      +'<td>'+(c?'ไทย':'')+'</td><td></td><td>'+(c?'ภูเก็ต':'')+'</td><td>'+(c?'-':'')+'</td><td></td>'
      +'<td>'+(c?'Negative':'')+'</td><td>'+(c?e(c.pos):'')+'</td></tr>';
  }
  var pb='';
  PP.people.forEach(function(r,i){
    var has=!!r.name;
    pb+='<tr><td class="no">'+(i+1)+'</td><td class="nm">'+e(r.name)+'</td>'
      +'<td></td><td></td><td>'+e(r.phone)+'</td><td>'+e(r.nat)+'</td><td></td><td></td><td></td><td></td>'
      +'<td>'+(has?'Negative':'')+'</td><td>'+(has?'ลูกค้า ทั่วไป':'')+'</td></tr>';
  });

  var L=function(t,n){ return '<tr><td>'+e(t)+'</td><td class="n">'+n+'</td><td>ท่าน</td></tr>'; };
  var rep=(function(){ try{ var c=goCfg(); return ((c.signers||[])[0]||{}).name||''; }catch(_){ return ''; } })();
  var sum='<div class="sum"><table>'
    +L('กัปตัน',cnt.cap)+L('ช่างเครื่อง',cnt.eng)+L('คนเรือ',cnt.crew)+L('ไกด์',cnt.guide)+L('สต๊าฟ',cnt.staff)
    +L('ชาวไทย',thai)+L('ชาวต่างชาติ',forg)
    +'<tr class="tot"><td>จำนวนผู้เดินทางทั้งหมด</td><td class="n">'+all+'</td><td>ท่าน</td></tr>'
    +'</table><table>'
    +L('อาการปกติ',all)+L('กลุ่มเสี่ยงที่มีอาการป่วย',0)
    +'</table>'
    +'<div class="rep">ผู้รายงาน : '+e(rep||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')+'</div></div>'
    +(unspec?('<div class="warn">ไม่ได้ระบุสัญชาติ '+unspec+' ท่าน &middot; นับรวมไว้ในช่อง'
        +'<b>ชาวต่างชาติ</b> เพื่อให้ยอดรวมตรง &middot; แก้สัญชาติได้ที่ใบจอง</div>'):'')
    +(PP.over?('<div class="warn">ใบจองมีชื่อมากกว่าจำนวนที่เดินทางจริง '+PP.over+' ท่าน &middot; '
        +'เป็นคนที่แจ้งไม่มา &middot; ไม่ได้พิมพ์ลงใบ เพราะใบนี้ต้องตรงกับคนที่อยู่บนเรือ</div>'):'')
    /* §regNoBlank · ตารางเอาเฉพาะบรรทัดที่มีชื่อ · ถ้ายอดกับจำนวนบรรทัดไม่เท่ากันต้องบอกว่าเพราะอะไร */
    +(PP.noname?('<div class="warn">ใบจองยังไม่ได้พิมพ์ชื่อ '+PP.noname+' ท่าน &middot; '
        +'นับรวมในยอดท้ายใบแล้ว แต่ไม่มีบรรทัดในตาราง &middot; เติมชื่อได้ที่ใบจอง</div>'):'')
    +(blankCrew?('<div class="warn">ทีมงานที่ยังไม่ได้ระบุชื่อ '+blankCrew+' ท่าน &middot; '
        +'นับรวมในยอดท้ายใบแล้ว &middot; ระบุชื่อได้ที่ใบสั่งงานมัคคุเทศก์</div>'):'');

  return '<div class="sheet">'
    +'<div class="ttl">ทะเบียนรายชื่อผู้เดินทางเข้า-ออก จังหวัดภูเก็ตช่องทางน้ำ (ท่าเทียบเรือวิสิษฐ์พันวา)</div>'
    +'<div class="dt">'+e(pckThaiDateCE(date))+'</div>'
    +head
    +'<table class="gt">'+cols+th2+'<tbody>'
      +band('')+cb+band(boat.name||bid)+pb
    +'</tbody></table>'+sum+'</div>';
}
function pckTravelReg(bid){
  var date=_pckDate, e=ckEsc;
  var ks=[];
  if(bid==='all'){
    var seen={};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
      var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
      var k=O.boatId||t.charterBoatId||''; if(!k||seen[k]) return; seen[k]=1; ks.push(k);
    });
    ks.sort(function(a,b){
      var ta='',tb='';
      try{ ta=pckDepOf(((TRIPS[date]||{})[a]||{}).route||'')||''; tb=pckDepOf(((TRIPS[date]||{})[b]||{}).route||'')||''; }catch(_){}
      return String(ta||'99').localeCompare(String(tb||'99')) || String(pckBoatName(a)).localeCompare(String(pckBoatName(b)));
    });
  } else ks=[bid];
  if(!ks.length){ alert('ยังไม่มี booking ที่จัดเรือแล้วในวันนี้ — จัดเรือก่อนถึงพิมพ์ใบทะเบียนได้'); return; }

  var sheets=ks.map(function(k){ return pckTravelSheet(k,date); }).join('');
  var ttl='ทะเบียนรายชื่อผู้เดินทาง · '+(bid==='all'?('ทุกลำ '+ks.length+' ใบ'):pckBoatName(bid))+' · '+date;
  var html='<!doctype html><html lang="th"><head><meta charset="utf-8"><title>'+e(ttl)+'</title>'
   +'<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;700&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" rel="stylesheet">'
   + pckTravelCss()+'</head><body>'
   +'<div class="tb"><b>ทะเบียนรายชื่อผู้เดินทาง</b>'
     +'<button class="pri" onclick="window.print()">&#128424; พิมพ์ / บันทึก PDF</button>'
     +'<button id="bOut" class="on" onclick="dir(1)">ออกภูเก็ต</button>'
     +'<button id="bIn" onclick="dir(0)">เข้าภูเก็ต</button>'
     +'<span class="hint">'+e(ttl)+' &middot; A4 แนวตั้ง &middot; 1 ลำ = 1 ใบ &middot; '
       +'ช่องอายุ / พาสปอร์ต / อุณหภูมิ / วัคซีน ระบบไม่มีข้อมูล เว้นไว้เขียนมือ</span></div>'
   + sheets
   +'<script>function dir(o){'
     +'document.getElementById("bOut").className=o?"on":"";'
     +'document.getElementById("bIn").className=o?"":"on";'
     +'Array.prototype.forEach.call(document.querySelectorAll("#cOut .cb,#cIn .cb"),function(x){});'
     +'Array.prototype.forEach.call(document.querySelectorAll(".sheet"),function(s){'
       +'var a=s.querySelector("#cOut .cb")||s.querySelectorAll(".cb")[0];'
       +'var b=s.querySelectorAll(".cb")[1];'
       +'if(a){a.className="cb"+(o?" on":"");a.innerHTML=o?"\u2713":"&nbsp;";}'
       +'if(b){b.className="cb"+(o?"":" on");b.innerHTML=o?"&nbsp;":"\u2713";}});}<\/script>'
   +'</body></html>';
  var w=window.open('','_blank','width=1000,height=900');
  if(!w){ alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ · อนุญาต pop-up ของหน้านี้ก่อน'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try{ w.focus(); }catch(_){} }, 300);
}

// แถบแท็บเรือ · ทำหน้าที่เป็นตัวกรองเรือไปในตัว (แทน select เดิมในแถบตัวกรอง)
function pckBoatTabs(all, part){
  var e=ckEsc, m={}, ks=[];
  all.forEach(function(r){
    if(!r.bid) return;
    if(!m[r.bid]){ m[r.bid]={bid:r.bid, rid:(r.t&&r.t.routeId)||'', rows:[]}; ks.push(r.bid); }
    m[r.bid].rows.push(r);
  });
  if(!ks.length) return '';
  ks.sort(function(a,b){
    return String(pckDepOf(m[a].rid)||'99').localeCompare(String(pckDepOf(m[b].rid)||'99'))
        || String(pckBoatName(a)).localeCompare(String(pckBoatName(b)));
  });
  /* §pckHead5 · ปุ่ม "เรือทั้งหมด" คือปุ่มล้างตัวกรองเรือ · หัวใหม่เอาไปไว้หัวการ์ด
     คู่กับ "ทุกโปรแกรม" ของการ์ดซ้าย ปุ่มล้างของสองระดับจะได้อยู่ที่เดียวกัน */
  var allBtn='<button class="pck-btab'+(_pckBoat?'':' on')+'" onclick="pckSetBoat(\'\')" style="'+(_pckBoat?'':'background:#2f2f2b;color:#fff')+'">เรือทั้งหมด <span class="c"'+(_pckBoat?'':' style="background:rgba(255,255,255,.25);color:#fff"')+'>'+ks.length+'</span></button>';
  if(part==='all') return allBtn;
  var h='<div class="pck-btabs"><span class="ck-unitbar-lbl">เรือวันนี้</span>'
   +((part==='tabs')?'':allBtn);
  ks.forEach(function(k){
    var col=pckBoatColor(k), ink=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(col):'#fff';
    var rt=(typeof getRoute==='function'?getRoute(m[k].rid):null)||{}, a=pckAgg(m[k].rows), dep=pckDepOf(m[k].rid);
    var on=(_pckBoat===k);
    h+='<button class="pck-btab'+(on?' on':'')+'" onclick="pckSetBoat(\''+k+'\')" title="'+e(pckBoatName(k)+' · '+(rt.name||''))+'" style="'+(on?('background:'+col+';color:'+ink):'')+'">'
      +'<span style="width:10px;height:10px;border-radius:50%;flex:none;background:'+(on?ink:col)+'"></span>'
      +'<span>'+e(pckBoatName(k))+'</span>'
      +'<span class="rt"'+(on?' style="color:'+ink+'"':'')+'><i style="background:'+(rt.color||'#999')+'"></i>'+e(rt.name||'—')+(dep?(' · '+e(dep)):'')+'</span>'
      +'<span class="c"'+(on?' style="color:'+ink+'"':'')+' title="ขึ้นเรือแล้ว '+a.onP+' จาก '+a.pax+' คน · '+a.on+'/'+a.n+' booking">'+a.onP+'/'+a.pax+'</span></button>';
  });
  /* §kitPop · จำนวนลำที่มีร้านแล้วแต่ยังไม่ได้ส่งรายการ · ติดเป็นจุดส้มบนปุ่ม
     ของเดิมแถบครัวกางอยู่ตลอด เห็นเองว่ายังไม่ส่ง · พอย้ายเข้า popup ต้องมีอะไรมาแทนการมองเห็นนั้น */
  var kitDue=0;
  ks.forEach(function(k){
    try{
      var V=(typeof mvForTrip==='function')?mvForTrip(_pckDate,k,m[k].rid):null;
      if(V && !((taGet(_pckDate,k)||{}).meal)) kitDue++;
    }catch(_){}
  });
  /* §pckHead4 · ปุ่มใบงานแยกออกมาได้ · หัวใหม่เอาไปวางมุมขวาบนของการ์ดเรือ
     ของเดิมต่อท้ายแถวชิปเรือ พอการ์ดแคบชิปก็ดันปุ่มตกไปอีกบรรทัดทั้งแถว
     part='tabs' = เอาแค่ชิปเรือ · part='jobs' = เอาแค่ปุ่มใบงาน · ไม่ส่งมา = ได้ทั้งชุดเหมือนเดิม */
  var jobs='<button class="pck-joball" onclick="pckGuideJobOrder(\'all\')" title="ใบงานไกด์ทุกลำของวันนี้ · A4 แนวนอน · 1 ลำ = 1 ใบ">&#128196;</button>'
    +'<button class="pck-joball go" onclick="goPrint(\'all\')" title="ใบสั่งงานมัคคุเทศก์ + ทะเบียนรายชื่อ ทุกลำ · A4 แนวตั้ง · 1 ลำ = 2 หน้า">&#128220;</button>'
    +'<button class="pck-joball reg" onclick="pckTravelReg(\'all\')" title="ทะเบียนรายชื่ออย่างเดียว · ทุกลำ · A4 แนวตั้ง · 1 ลำ = 1 ใบ (ปุ่มใบสั่งงานออกให้ทั้งสองใบอยู่แล้ว)">&#128203;</button>'
    +'<button class="pck-joball kit" onclick="pckKitchenOpen()" title="ครัว · อาหารกลางวันวันนี้ · จำนวนหัวนับจากคนที่ไปจริง">&#127869;'
      +(kitDue?('<span class="dot" title="'+kitDue+' ลำยังไม่ได้ส่งรายการให้ร้าน">'+kitDue+'</span>'):'')+'</button>';
  if(part==='jobs') return '<span class="pkh-jobs">'+jobs+'</span>';
  if(part==='tabs') return h+'</div>';
  return h+jobs+'</div>';
}
// §ovnCard · หัวกลุ่ม "รถที่พากลับ" ของบล็อกรับกลับ
//   ขากลับไม่มีการเช็คอินรถ ตัวเลข "เช็คอินรถแล้ว x/y" ของหัวปกติจึงไม่มีความหมาย
//   สิ่งที่หน้าท่าต้องรู้คือ รถคันไหน ทะเบียนอะไร คนขับใคร เบอร์อะไร
//   และถ้ายังไม่จัด ต้องเตือนแรง — เรือถึงท่าแล้วค่อยรู้ว่าไม่มีรถส่ง คือแก้ไม่ทัน
function pckOvnVanHead(vg, date){
  var e=ckEsc, vid=vg.vid, a=pckAgg(vg.rows);
  var h='<div class="pck-vhd">';
  if(vg.self){
    h+='<span class="pck-vpill" style="background:#8a8a82">กลับเอง</span>'
      +'<span class="pck-vmeta" style="white-space:normal">ลูกค้าเดินทางกลับเอง — เรือส่งถึงท่าแล้วจบงาน</span>';
  } else if(!vid){
    h+='<span class="pck-vpill" style="background:#A32D2D">&#9888; ยังไม่จัดรถกลับ</span>'
      +'<span class="pck-vmeta" style="white-space:normal;color:#A32D2D">เรือรับกลับถึงท่าแล้วต้องมีรถส่งเข้าโรงแรม — จัดรถกลับก่อนเรือถึง</span>';
  } else {
    var veh=(typeof vehGet==='function')?(vehGet(vid)||{}):{};
    var c=(typeof vehChipPair==='function')?vehChipPair(vid):['#F4E8FB','#6B289A'];
    var col=c[1]||'#6B289A';
    var rd=(typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(vid,date)
          :{driver:veh.driver||'', phone:veh.driverPhone||'', plate:veh.plate||''};
    h+='<span class="pck-vpill" style="background:'+col+'">&#8617; รถกลับ &middot; '+e(veh.name||vid)+'</span>'
      +(rd.plate?'<span class="pck-vplate" style="color:'+col+';border-color:'+col+'66">'+e(rd.plate)+'</span>':'')
      +(rd.driver?'<span class="pck-vmeta">คนขับ <b>'+e(rd.driver)+'</b></span>':'<span class="pck-vmeta" style="color:#a5751f">ยังไม่ระบุคนขับ</span>')
      +(rd.phone?'<a class="pck-vtel" style="color:'+col+';border-color:'+col+'66" href="tel:'+e(String(rd.phone).replace(/[^0-9+]/g,''))+'" onclick="event.stopPropagation()">'+e(rd.phone)+'</a>':'');
  }
  h+='<span class="pck-vstat">รับกลับ '+a.pax+' pax</span></div>';
  return h;
}
/* ═══ §mealTrip · แถบครัว ═══════════════════════════════════════════════════
   หนึ่งการ์ดต่อหนึ่งลำ · ร้านที่จะกิน + หัวจริง + อาหารพิเศษ + ยอดเงิน
   ทารกไม่นับ (ไม่ได้สั่งอาหาร) · คนที่ไม่มาหักออกจากผู้ใหญ่ก่อน เพราะเด็กแทบไม่มาคนเดียว
   ═══════════════════════════════════════════════════════════════════════════ */
function pckMealCount(rows){
  var o={ad:0, chd:0, inf:0, tot:0, book:0, veg:0, vegan:0, halal:0, allergy:0};
  (rows||[]).forEach(function(r){
    if(r._vd) return;                                        /* ปิดรายการแล้ว ไม่ต้องสั่งอาหาร */
    /* §mealOvn · ขากลับค้างคืนที่ไม่ได้ระบุว่ารวมอาหาร ไม่นับเข้ายอดที่จะจ่ายร้าน */
    if(r.t && r.t.ovnLeg && r.__inc!=='in') return;
    /* หัวที่จะไปจริง · หัก no-show ทั้งฝั่งรถและฝั่งท่า
       ร้านคิดเงินตามคนที่นั่งลงกินจริง ไม่ได้คิดตามคนที่จองไว้ */
    var tot=Math.max(0, ((r.expect!=null?r.expect:r.booked)||0)
                        - ((r.ck && r.ck.at) ? (+r.ck.noShow||0) : 0));
    var px=(r.t&&r.t.pax)||{}, PT=(typeof bkV2PaxTot==='function')?bkV2PaxTot:function(){return 0;};
    var chd=Math.min(PT(px,'chd'), tot);
    var inf=Math.min(PT(px,'inf'), Math.max(0, tot-chd));
    o.book+=r.booked||0; o.tot+=tot; o.chd+=chd; o.inf+=inf;
    o.ad+=Math.max(0, tot-chd-inf);
    var m=(r.b&&r.b.specialMeals)||{};
    o.veg+=(+m.veg||0); o.vegan+=(+m.vegan||0); o.halal+=(+m.halal||0);
    o.allergy+=(typeof bkV2AllergyCount==='function')?(bkV2AllergyCount(m)||0)
              :(String(m.allergies||'').trim()?1:0);
  });
  return o;
}
/* รายการแพ้อาหารแบบมีชื่อ · ร้านต้องรู้ว่าแพ้อะไร ไม่ใช่รู้แค่ว่ามีคนแพ้ */
function pckAllergyList(rows){
  var by={};
  (rows||[]).forEach(function(r){
    if(r._vd) return;
    var m=(r.b&&r.b.specialMeals)||{};
    (Array.isArray(m.allergyList)?m.allergyList:[]).forEach(function(x){
      if(!x||!x.name) return; var k=String(x.name).trim(); if(!k) return;
      by[k]=(by[k]||0)+(Math.max(1,+x.qty||1));
    });
  });
  return Object.keys(by).map(function(k){ return {name:k, qty:by[k]}; });
}
function pckKitchenHtml(border, boats, date, bare){
  if(!border || !border.length) return '';
  var e=ckEsc, cards='';
  border.forEach(function(bid){
    var B=boats[bid]; if(!B) return;
    /* §mealOvnRt · เรือที่วันนี้มีแต่งานรับกลับ ไม่มีแถวเช็คอิน torder จึงว่าง (§ovnCard เก็บแถวไว้ที่ B.ovn)
       เดิมตกไปเป็นเส้นทาง '' → หาร้านไม่เจอ → ไม่มียอด ไม่มีปุ่มส่งร้าน
       ทั้งที่เส้นทางนั้นตั้งร้านไว้แล้ว · ใบรับกลับถือเส้นทางของตัวเองอยู่ อ่านจากที่เดียวกับที่การ์ดโชว์
       ไม่ไปอ่าน TRIPS ซ้ำอีกทาง — ข้อเท็จจริงเดียวต่อหนึ่งที่ */
    var OV=pckMealOvnRows(date,bid);
    var rid=(B.torder||[])[0] || (OV[0] && OV[0].t && OV[0].t.routeId) || '';
    var V=(typeof mvForTrip==='function')?mvForTrip(date,bid,rid):null;
    var raw=(typeof mvTripRaw==='function')?mvTripRaw(date,bid):'';
    /* §mealOvn · ขากลับค้างคืนของลำนี้ · ต่อเข้ากับแถวปกติ แล้วให้ตัวนับตัดสินจากธง __inc
       การ์ดกับยอดที่บันทึกจะได้มาจากชุดเดียวกัน ไม่ใช่คนละชุดเหมือนเดิม */
    var MR=(B.rows||[]).concat(OV.map(function(x){
      var y={}; Object.keys(x).forEach(function(k){ y[k]=x[k]; }); y.__inc=x.inc; return y; }));
    var C=pckMealCount(MR);
    var amt=(typeof mvCost==='function')?mvCost(V,C.ad,C.chd):null;
    var need=OV.filter(function(x){ return !x.inc; }).length;
    var sent=(taGet(date,bid)||{}).meal||null;
    var col=pckBoatColor(bid);
    var chip=function(t,bg,bd,c){ return '<span style="font-size:11px;font-weight:700;border-radius:999px;'
      +'padding:3px 11px;border:1px solid '+bd+';background:'+bg+';color:'+c+'">'+t+'</span>'; };
    var body='';
    if(!V){
      body='<span style="font-size:12px;color:'+(raw==='-'?'#8a8a82':'#B4560A')+'">'
        + (raw==='-' ? 'ตั้งไว้ว่าวันนี้ลำนี้ไม่มีอาหาร'
                     : 'ยังไม่ได้ตั้งร้านให้เส้นทางนี้ — ตั้งได้ที่ ต้นทุน &amp; จุดคุ้มทุน &rarr; ราคาจริง หรือเปลี่ยนรายลำที่ใบงานเรือ')
        +'</span>';
    }else{
      body=chip('ผู้ใหญ่ '+C.ad+' &times; &#3647;'+(+V.priceAd||0),'#F8FAFC','#E2E8F0','#475569')
        + (C.chd?(' '+chip('เด็ก '+C.chd+' &times; &#3647;'+(+V.priceCh||0),'#F8FAFC','#E2E8F0','#475569')):'')
        + (C.inf?(' '+chip('ทารก '+C.inf+' · ไม่คิด','#F8FAFC','#E2E8F0','#94A3B8')):'')
        + (C.veg?(' '+chip('มังสวิรัติ '+C.veg,'#E7F4EF','#BEE0D2','#0F6E56')):'')
        + (C.vegan?(' '+chip('วีแกน '+C.vegan,'#E7F4EF','#BEE0D2','#0F6E56')):'')
        + (C.halal?(' '+chip('ฮาลาล '+C.halal,'#E9F1FB','#C3D9F0','#185FA5')):'')
        + (C.allergy?(' '+chip('&#9888; แพ้อาหาร '+C.allergy,'#FEF2F2','#F5CFCF','#B91C1C')):'')
        + (C.book>C.tot?(' '+chip('จอง '+C.book+' · ไปจริง '+C.tot,'#FEF6E7','#EFD9AE','#8A5A00')):'');
    }
    var al=V?pckAllergyList(MR):[];
    cards+='<div style="background:#fff;border:1px solid #E7EBF0;border-radius:15px;padding:13px 15px;margin-bottom:9px">'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:'+(body?'9px':'0')+'">'
        +'<span style="width:10px;height:10px;border-radius:3px;background:'+col+';flex:none"></span>'
        +'<span style="font-size:14px;font-weight:800">'+e(pckBoatName(bid))+'</span>'
        +'<span style="font-size:11px;color:#94A3B8">'+e(((typeof getRoute==='function'?getRoute(rid):null)||{}).name||'')
          + (pckDepOf(rid)?(' · '+e(pckDepOf(rid))):'')+'</span>'
        + (V?('<span style="background:#F5F0FF;border:1px solid #DDD0F5;color:#5B289A;border-radius:10px;'
              +'padding:4px 12px;font-size:12px;font-weight:700">'+e(V.name||'')
              +(V.place?(' · '+e(V.place)):'')+'</span>'):'')
        + (raw&&raw!=='-'?'<span style="font-size:10.5px;font-weight:700;color:#8A5A00;background:#FEF6E7;'
              +'border:1px solid #EFD9AE;border-radius:999px;padding:2px 9px">เปลี่ยนเฉพาะวันนี้</span>':'')
        + (amt!=null?('<span style="margin-left:auto;font:800 15px \'DM Mono\',monospace;color:#5B289A">&#3647;'
              +Math.round(amt).toLocaleString()+'</span>'):'<span style="margin-left:auto"></span>')
        + (V?('<button'+(need?' disabled title="ยังมีใบจองรับกลับจากเกาะที่ยังไม่ได้ระบุว่ารวมอาหารหรือไม่"'
              :(' onclick="pckMealSend(\''+bid+'\')"'))+' style="border:1px solid '
              +(need?'#E2E8F0':(sent?'#BFE0CD':'#0F172A'))+';background:'+(need?'#F1F5F9':(sent?'#ECFDF5':'#0F172A'))
              +';color:'+(need?'#94A3B8':(sent?'#047857':'#fff'))
              +';border-radius:10px;padding:6px 14px;font:700 11.5px inherit;cursor:'+(need?'not-allowed':'pointer')+'">'
              +(sent?('&#10003; ส่งแล้ว &#3647;'+Math.round(sent.amount||0).toLocaleString()
                      +(mvLunchOk(rid)?' · เปิดใบอีกครั้ง':''))
                    :(mvLunchOk(rid)?'ส่งรายการให้ร้าน · เปิดใบ':'บันทึกยอดอาหาร'))+'</button>'):'')
      +'</div>'
      + (body?('<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'+body+'</div>'):'')
      /* §mealNote · ปุ่มโน้ต · อยู่ใต้ป้ายจำนวนคน ที่เดียวกับที่คนกำลังตรวจยอดอยู่ */
      + (function(){
          var MN=pckMealNote(date,bid);
          return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:9px">'
            +'<button onclick="pckMealNoteOpen(\''+bid+'\')" style="border:1px '
              +(MN?'solid #EEDFAE':'dashed #D8D4CA')+';background:'+(MN?'#FFF8E6':'#fff')+';color:'
              +(MN?'#7A4A00':'#8a8a82')+';border-radius:8px;padding:3px 11px;font:700 11px inherit;'
              +'cursor:pointer;font-family:inherit" title="ขึ้นมุมขวาบนของใบแจ้งอาหาร">'
              +(MN?'&#9998; โน้ตถึงร้าน':'+ โน้ตถึงร้าน')+'</button>'
            +(MN?('<div style="flex:1 0 100%;background:#FFF8E6;border:1px solid #EEDFAE;border-radius:8px;'
              +'padding:5px 10px;font-size:11.5px;font-weight:600;color:#7A4A00;line-height:1.5;margin-top:2px">'
              +'&#9998; '+e(MN)+'</div>'):'')
            +'</div>';
        })()
      /* §mealOvn · กลุ่มรับกลับจากเกาะ · ต้องเลือกทีละใบว่ารวมอาหารหรือไม่ */
      + (OV.length?('<div style="margin-top:11px;border:1px solid #DDD0F5;background:#FBF9FF;border-radius:12px;overflow:hidden">'
          +'<div style="background:#F1ECFB;padding:7px 12px;font-size:11.5px;font-weight:800;color:#4A2E86;'
            +'display:flex;gap:9px;align-items:center;flex-wrap:wrap">&#127765; รับกลับจากเกาะ · ค้างคืน'
            +'<span style="font-weight:600;color:#6b5a95;font-size:10.5px">'+OV.length+' ใบจอง · '
            +OV.reduce(function(a,x){ return a+x.pax; },0)+' ท่าน</span>'
            +(need?('<span style="margin-left:auto;background:#FFECCB;border:1px solid #E0A800;color:#7A4A00;'
              +'border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800">ยังไม่ระบุ '+need+' ใบ</span>'):'')
          +'</div>'
          + OV.map(function(x){
              var on=function(v){ return x.inc===v; };
              var btn=function(v,lb,col){
                return '<button onclick="pckMealOvnSet(\''+e(date)+'\',\''+e(bid)+'\',\''+e(x.b.id)+'\',\''+v+'\')" '
                  +'style="border:0;background:'+(on(v)?col:'#fff')+';color:'+(on(v)?'#fff':'#5F5E5A')+';'
                  +'font:700 11px inherit;padding:5px 13px;cursor:pointer;font-family:inherit">'+lb+'</button>'; };
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;'
                +'border-top:1px solid #EFEAF9;flex-wrap:wrap">'
                +'<div style="flex:1;min-width:160px"><b style="display:block;font-size:12.5px;font-weight:700">'
                  +e(String(x.b.leadPax||'').trim()||'—')+'</b>'
                +'<small style="display:block;font-size:10.5px;color:#8b83a5">'
                  +(x.outDate?('ค้างคืน '+e(x.outDate)+' · '):'')+e(x.b.hotelName||x.b.pickup||'')+'</small></div>'
                +'<div style="font:700 13px \'DM Mono\',monospace;color:#4A2E86;min-width:52px;text-align:right">'
                  +x.pax+' ท่าน</div>'
                +'<div style="display:flex;border:1px solid '+(x.inc?'#D8D4CA':'#E0A800')+';border-radius:8px;'
                  +'overflow:hidden'+(x.inc?'':';box-shadow:0 0 0 2px #FFECCB')+'">'
                  +btn('in','รวมอาหาร','#0F6E56')
                  +'<span style="width:1px;background:#E7E4DC"></span>'
                  +btn('out','ไม่รวม','#5F6B7C')
                +'</div></div>';
            }).join('')
          +'</div>'
          +(need?('<div style="margin-top:7px;font-size:11px;color:#B4560A;line-height:1.6">'
             +'ปุ่มส่งกดไม่ได้จนกว่าจะระบุครบ · ระบบไม่เดาให้ เพราะเดาผิดคือร้านทำอาหารขาดหรือเราจ่ายซ้ำ</div>'):'')
          ):'')
      + (al.length?('<div style="background:#FEF2F2;border:1px solid #F5CFCF;color:#B91C1C;border-radius:10px;'
          +'padding:7px 12px;font-size:11.5px;font-weight:600;margin-top:9px">แพ้อาหาร — '
          + al.map(function(x){ return '<b>'+e(x.name)+' &times;'+x.qty+'</b>'; }).join(' · ')
          +' · ต้องแจ้งร้านก่อนเรือถึง</div>'):'')
      + (sent&&V&&Math.round(sent.amount||0)!==Math.round(amt||0)
          ? ('<div style="font-size:11px;color:#8A5A00;margin-top:7px">ส่งไปแล้ว &#3647;'
             +Math.round(sent.amount||0).toLocaleString()+' แต่ตอนนี้นับได้ &#3647;'+Math.round(amt||0).toLocaleString()
             +' — กดส่งอีกครั้งถ้าแจ้งร้านแก้แล้ว</div>') : '')
      +'</div>';
  });
  if(!cards) return '';
  if(bare) return cards;
  return '<div style="margin-bottom:16px">'
    +'<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin-bottom:8px">'
    +'ครัว · อาหารกลางวันวันนี้</div>'+cards+'</div>';
}
function pckKitchenOpen(){
  var h=document.getElementById('pck-kit-host');
  if(!h){ h=document.createElement('div'); h.id='pck-kit-host'; document.body.appendChild(h); }
  _pckKitOpen=true; pckKitchenRender();
}
function pckKitchenClose(){
  _pckKitOpen=false;
  var h=document.getElementById('pck-kit-host'); if(h) h.innerHTML='';
}
function pckKitchenRender(){
  var h=document.getElementById('pck-kit-host'); if(!h || !_pckKitOpen) return;
  var e=ckEsc, K=_pckKit||{border:[],boats:{},date:_pckDate};
  var cards=pckKitchenHtml(K.border, K.boats, K.date, true);
  /* ยอดรวมทั้งวัน · หน้าท่าถามคำถามนี้ทุกวัน "วันนี้ค่าอาหารเท่าไหร่" */
  var sum=0, nSent=0, nDue=0;
  (K.border||[]).forEach(function(bid){
    var B=K.boats[bid]; if(!B) return;
    var rid=(B.torder||[])[0]||'';
    var V=(typeof mvForTrip==='function')?mvForTrip(K.date,bid,rid):null; if(!V) return;
    var C=pckMealCount(B.rows), amt=(typeof mvCost==='function')?mvCost(V,C.ad,C.chd):0;
    sum+=(+amt||0);
    if((taGet(K.date,bid)||{}).meal) nSent++; else nDue++;
  });
  h.innerHTML='<div onclick="if(event.target===this)pckKitchenClose()" style="position:fixed;inset:0;'
   +'background:rgba(20,24,22,.42);backdrop-filter:blur(2px);z-index:9000;display:flex;align-items:center;'
   +'justify-content:center;padding:20px;font-family:\'DM Sans\',\'Noto Sans Thai\',sans-serif">'
   +'<div style="background:#F6F7F9;border-radius:16px;width:min(840px,96vw);max-height:90vh;display:flex;'
     +'flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.28)">'
   +'<div style="padding:16px 20px;border-bottom:1px solid #E7EBF0;background:#fff;border-radius:16px 16px 0 0;'
     +'display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">'
     +'<div><div style="font-size:15px;font-weight:800;color:#0F172A">&#127869; ครัว · อาหารกลางวันวันนี้</div>'
     +'<div style="font-size:11.5px;color:#94A3B8;margin-top:2px">'+e(K.date||'')
       +' · จำนวนหัวนับจาก<b>คนที่ไปจริง</b> หลังหัก No-show แล้ว ไม่ใช่ยอดจอง</div></div>'
     +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
       +(nDue?('<span style="font-size:11px;font-weight:700;color:#B4560A;background:#FEF6E7;'
              +'border:1px solid #EFD9AE;border-radius:999px;padding:3px 11px">ยังไม่ส่ง '+nDue+' ลำ</span>'):'')
       +(nSent?('<span style="font-size:11px;font-weight:700;color:#047857;background:#ECFDF5;'
              +'border:1px solid #BFE0CD;border-radius:999px;padding:3px 11px">ส่งแล้ว '+nSent+' ลำ</span>'):'')
       +(sum?('<span style="font:800 17px \'DM Mono\',monospace;color:#5B289A">&#3647;'
              +Math.round(sum).toLocaleString()+'</span>'):'')
       +'<button onclick="pckKitchenClose()" style="background:transparent;border:none;font-size:20px;'
         +'color:#9a9a92;cursor:pointer;line-height:1">&times;</button>'
     +'</div></div>'
   +'<div style="padding:16px 20px;overflow:auto;flex:1">'
     +(cards||'<div style="font-size:12.5px;color:#94A3B8;text-align:center;padding:28px 0">'
              +'วันนี้ยังไม่มีเรือที่ต้องสั่งอาหาร</div>')
   +'</div></div></div>';
}
/* ═══ §mealSlip · ใบสั่งอาหาร ════════════════════════════════════════════════
   ภาษาไทยทั้งใบ · คนอ่านคือแม่ครัว ไม่ใช่ลูกค้า
   ═══════════════════════════════════════════════════════════════════════════ */
/* หนึ่งบรรทัดต่อหนึ่งใบจอง · ชื่อ Lead อย่างเดียว
   จำนวนคนเป็นตัวเลขหลังหักคนไม่มาแล้ว ทั้งฝั่งรถและฝั่งท่า
   Special Request รวมสามทาง — ช่องที่ติ๊ก · รายการแพ้อาหารที่มีชื่อ · ข้อความที่พิมพ์เอง
   ของจริงคนกรอกเป็นข้อความล้วนเกือบทั้งหมด จึงเอาข้อความดิบขึ้นใบตรง ๆ ไม่แปลงเป็นตัวเลข */
function mvLunchRows(date, bid){
  var out=[], PT=(typeof bkV2PaxTot==='function')?bkV2PaxTot:function(){return 0;};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;   /* ปิดรายการแล้ว ไม่ต้องทำอาหาร */
    var booked=ckBookedPax(t);
    var tot=pckOnBoard(b,date,booked);                     /* §ckPierSelf2 · ครัวต้องได้จำนวนคนบนเรือจริง */
    var px=t.pax||{};
    var chd=Math.min(PT(px,'chd'), tot);
    var inf=Math.min(PT(px,'inf'), Math.max(0,tot-chd));
    /* §mealFoc · FOC นับรวมกับ AD · เก็บ foc ไว้ต่างหากเพื่อบอกที่ท้ายใบว่ารวมไปกี่คน
       ไม่ได้หายไปไหน แค่ไม่ต้องให้ครัวบวกเอง */
    var foc=Math.min(PT(px,'foc'), Math.max(0,tot-chd-inf));
    var ad =Math.max(0, tot-chd-inf);
    if(!(ad+chd+inf)) return;
    var sm=b.specialMeals||{}, sr=[];
    if(sm.halal) sr.push('ฮาลาล '+sm.halal);
    if(sm.veg)   sr.push('มังสวิรัติ '+sm.veg);
    if(sm.vegan) sr.push('วีแกน '+sm.vegan);
    (Array.isArray(sm.allergyList)?sm.allergyList:[]).forEach(function(a){
      if(a&&a.name) sr.push('แพ้ '+a.name+' ×'+Math.max(1,+a.qty||1)); });
    if(String(sm.allergies||'').trim()) sr.push(String(sm.allergies).trim());
    /* §mealOvn · ขากลับค้างคืน · คิดอาหารก็ต่อเมื่อระบุว่า "รวม" เท่านั้น
       ยังไม่ระบุ = ยังไม่คิด · ปุ่มส่งถูกล็อกไว้อยู่แล้วจนกว่าจะระบุครบ */
    var _ovn=!!(typeof bkIsOvnReturn==='function' && bkIsOvnReturn(t));
    var _inc=_ovn?pckMealOvnOf(date,bid,b.id):'in';
    out.push({lead:String(b.leadPax||'').trim()||'—', ad:ad, chd:chd, inf:inf, foc:foc, sr:sr.join('\n'),
              ovn:_ovn, inc:_inc, bkId:b.id,
              outDate:(_ovn && typeof _ovnOutDate==='function')?_ovnOutDate(b,t):''});
  });
  /* ทริปวันนี้ก่อน แล้วค่อยกลุ่มรับกลับ · ใบจะได้เรียงเหมือนที่ครัวต้องอ่าน */
  out.sort(function(a,b){ return (a.ovn?1:0)-(b.ovn?1:0)
    || String(a.lead).localeCompare(String(b.lead),'th'); });
  return out;
}
/* ท่าที่ใช้ใบแบบนี้ได้ · ทับละมุใช้ใบคนละแบบ ยังไม่ได้ทำ */
function mvLunchPier(rid){
  var rt=(typeof getRoute==='function')?getRoute(rid):null;
  return (rt&&rt.pier)||'';
}
function mvLunchOk(rid){ return mvLunchPier(rid)==='panwa'; }

/* ═══ §lunch · ใบสั่งอาหาร ═══════════════════════════════════════════════
   ภาษาไทยทั้งใบ · คนอ่านคือแม่ครัว ไม่ใช่ลูกค้า
   ═══════════════════════════════════════════════════════════════════════ */
function mvOrderSlip(date, bid, V, rid){
  var e=ckEsc;
  var rt=(typeof getRoute==='function'?getRoute(rid):null)||{};
  var boat=(typeof getBoat==='function'?getBoat(bid):null)||{};
  var bcol=(typeof pckBoatColor==='function')?pckBoatColor(bid):(boat.color||'#1E5FA8');
  var bink=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(bcol):'#fff';
  var DW=(typeof pjDateWords==='function')?pjDateWords(date):{big:date};
  var J=(typeof pjOf==='function')?pjOf(date,bid):{};
  var guides=(typeof pjGuides==='function')?pjGuides(date,bid):[];
  var island=(J.island||[]).filter(Boolean);
  var stNames=island.map(function(id){ return (typeof pjStaffName==='function')?pjStaffName(id):id; }).filter(Boolean);
  var nCrew=(J.cap?1:0)+(J.asst?1:0)+((J.crew||[]).filter(Boolean).length);
  var rows=mvLunchRows(date,bid);
  var T={ad:0,chd:0,inf:0,foc:0};
  rows.forEach(function(r){ T.ad+=r.ad; T.chd+=r.chd; T.inf+=r.inf; T.foc+=r.foc; });

  var css='@page{size:A4 portrait;margin:9mm}'
   /* สีบนใบนี้เป็นข้อมูล · เขียวคือแถวที่ครัวต้องทำต่างจากคนอื่น ตัดสีทิ้งแล้วหาไม่เจอ */
   +'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}'
   +'body{margin:0;background:#EEF1F5;font-family:"DM Sans","Noto Sans Thai",sans-serif;color:#0F172A}'
   +'@media screen{body{padding:18px 16px 60px}}'
   +'.tb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:800px;margin:0 auto 14px}'
   +'.tb button{border:1px solid #E2E8F0;background:#fff;border-radius:11px;padding:8px 15px;'
     +'font:700 12.5px inherit;color:#475569;cursor:pointer}'
   +'.tb button.pri{background:#0F172A;border-color:#0F172A;color:#fff}'
   +'.tb button.img{background:#06C755;border-color:#06C755;color:#fff}'
   +'.tb button[disabled]{opacity:.55;cursor:progress}'
   +'.tb .hint{font-size:11px;color:#94A3B8}'
   +'.sheet{width:800px;margin:0 auto;background:#fff;padding:14px 16px 18px;border:1px solid #CBD5E1;'
     +'border-radius:8px;box-shadow:0 14px 40px -12px rgba(15,23,42,.16)}'
   +'@media print{body{background:#fff;padding:0}.tb{display:none}'
     +'.sheet{width:auto;border:0;border-radius:0;box-shadow:none;padding:0}}'
   +'.ttl{text-align:center;font-size:26px;font-weight:800;letter-spacing:-.2px;line-height:1.15}'
   +'.dat{text-align:center;font-size:17px;font-weight:700;margin-top:1px;margin-bottom:9px}'
   +'table{border-collapse:collapse;width:100%}td,th{border:1px solid #9BA9BC}'
   +'table.hd td{padding:5px 9px;font-size:13.5px}'
   +'table.hd td.k{background:#C9D9F0;font-weight:800;width:132px}'
   +'table.hd td.v{background:#DCE6F5;font-weight:600}'
   +'table.hd td.b{background:#8DB4E2;font-weight:600}'
   +'table.hd td.boat{font-size:20px;font-weight:800;text-align:center}'
   +'table.hd td.rest{background:#FFF200;color:#C00000;font-weight:800;font-size:16px;text-align:center;padding:6px 10px}'
   +'table.hd td.restsub{background:#FFF9B8;color:#8A5A00;font-weight:600;font-size:11.5px;text-align:center;padding:3px 10px}'
   +'table.hd tr.crew td{background:#4F81BD;color:#fff;font-weight:800;font-size:14px;text-align:center;padding:6px 9px}'
   +'table.hd tr.crew td.k{text-align:left;width:132px}'
   +'table.hd td.blank{background:#DCE6F5}table.hd td.blank2{background:#8DB4E2}'
   +'table.hd td.none{color:#6E8199;font-weight:500}'
   +'table.gs th{background:#C9D9F0;font-size:12.5px;font-weight:800;padding:6px 8px}'
   +'table.gs td{padding:6px 9px;font-size:13px;vertical-align:middle}'
   +'table.gs td.nm{font-weight:600}'
   +"table.gs td.n{text-align:center;font:700 14px 'DM Mono',monospace}"
   +'table.gs td.sr{background:#00E64D;font-weight:700;font-size:12.5px;line-height:1.5;text-align:center;color:#0B3D1A}'
   +'table.gs td.sr.l{text-align:left}'
   /* §mealOvn · กลุ่มรับกลับจากเกาะ · แถบม่วงคั่น แล้วยอดย่อยของแต่ละกลุ่ม */
   +'table.gs tr.sub td{background:#E8EFF9;font-weight:800}'
   +'table.gs tr.sub td.lb{text-align:right;font-size:14px}'
   +'table.gs tr.sub td.n{font-size:15px}'
   +'table.gs tr.grp td{background:#5B289A;color:#fff;font-weight:800;font-size:13px;padding:5px 10px}'
   +'table.gs tr.grp td span{font-weight:600;font-size:11.5px;opacity:.85;margin-left:8px}'
   +'table.gs tr.xout td{background:#F4F5F7;color:#8b93a1}'
   +'table.gs tr.xout td.n{color:#b6bcc7}'
   +'table.gs .mpill{display:inline-block;font-size:11px;font-weight:800;border-radius:3px;'
     +'padding:1px 8px;border:1px solid;margin-left:6px}'
   +'table.gs .mpill.i{background:#E7F4EF;border-color:#7FBFA4;color:#0B5136}'
   +'table.gs .mpill.o{background:#EDEFF3;border-color:#C3C9D4;color:#5F6B7C}'
   +'table.gs .mpill.q{background:#FFECCB;border-color:#E0A800;color:#7A4A00}'
   +'table.gs tr.tot td{background:#C9D9F0;font-weight:800}'
   +'table.gs tr.tot td.lb{text-align:right;font-size:17px}'
   +'table.gs tr.tot td.n{font-size:17px}'
   /* §mealNote · โน้ตมุมขวาบน · ชื่อใบยังอยู่กลางหน้าเพราะกันที่ซ้ายไว้เท่ากัน
      วางทับด้วย absolute ไม่ได้ · โน้ตยาวแล้วจะไปทับหัวใบตอนพิมพ์ */
   +'.hdw{display:flex;align-items:flex-start;gap:12px;margin-bottom:9px}'
   +'.hdw .sp,.hdw .nb{flex:0 0 210px}'
   +'.hdw .mid{flex:1;min-width:0}'
   +'.hdw .ttl{font-size:22px}'
   +'.hdw .dat{margin-bottom:0}'
   +'.nb{border:2px solid #E0A800;background:#FFFBEA;border-radius:5px;padding:7px 11px}'
   +'.nb .h{font-size:10.5px;font-weight:800;color:#8A5A00;letter-spacing:.08em;margin-bottom:2px}'
   +'.nb .t{font-size:14px;font-weight:700;color:#3F2D00;line-height:1.5;word-break:break-word}';

  var sub=[V.place||'', V.eta?('เรือถึง ~'+V.eta):'', V.phone||''].filter(Boolean).join(' · ');
  /* บรรทัดรายละเอียดร้านขึ้นแถวเดียว ใต้ชื่อร้านพอดี · ซ้ำทุกแถวแล้วรก */
  var subCell=function(first){ return (first&&sub) ? ('<td class="restsub">'+e(sub)+'</td>') : '<td class="blank"></td>'; };
  var gList = guides.length ? guides : [null];
  var gRows = gList.map(function(g,i){
    return '<tr><td class="k">ไกด์</td>'
      +'<td class="v'+(g?'':' none')+'" colspan="2">'+(g?e(g):'— ยังไม่ได้จัดไกด์ —')+'</td>'
      +'<td class="blank"></td>'+subCell(i===0)+'</tr>'; }).join('');

  /* §mealOvn · หนึ่งแถวปกติ · ใช้ร่วมกันทั้งสองกลุ่ม */
  var line=function(r, extra){
    return '<tr'+(extra||'')+'><td class="nm">'+e(r.lead)
      +(r.ovn?('<span class="mpill '+(r.inc==='in'?'i':(r.inc==='out'?'o':'q'))+'">'
          +(r.inc==='in'?'รวมอาหาร':(r.inc==='out'?'ไม่รวมอาหาร':'ยังไม่ระบุ'))+'</span>'):'')
      +'</td>'
      +'<td class="n">'+(r.ad||'')+'</td><td class="n">'+(r.chd||'')+'</td>'
      +'<td class="n">'+(r.inf||'')+'</td>'
      +(r.sr ? ('<td class="sr'+(r.sr.length>40?' l':'')+'">'+e(r.sr).replace(/\n/g,'<br>')+'</td>') : '<td></td>')
      +'</tr>'; };
  /* ไม่คิดอาหาร · ยังต้องอยู่บนใบ ร้านจะได้รู้ว่ามีคนนั่งอยู่ แค่ไม่ต้องทำให้ */
  var lineOut=function(r){
    return '<tr class="xout"><td class="nm">'+e(r.lead)
      +'<span class="mpill '+(r.inc==='out'?'o':'q')+'">'
      +(r.inc==='out'?'ไม่รวมอาหาร':'ยังไม่ระบุ')+'</span></td>'
      +'<td class="n">&mdash;</td><td class="n">&mdash;</td><td class="n">&mdash;</td>'
      +'<td style="font-size:11.5px;color:#8b93a1">อยู่บนเรือ '+(r.ad+r.chd+r.inf)+' ท่าน · ไม่ต้องทำอาหาร</td></tr>'; };
  var MAIN=rows.filter(function(r){ return !r.ovn; });
  var OVN =rows.filter(function(r){ return  r.ovn; });
  var OIN =OVN.filter(function(r){ return r.inc==='in'; });
  var OOUT=OVN.filter(function(r){ return r.inc!=='in'; });
  var sum=function(a,k){ var n=0; a.forEach(function(r){ n+=(r[k]||0); }); return n; };
  var M={ad:sum(MAIN,'ad'), chd:sum(MAIN,'chd'), inf:sum(MAIN,'inf')};
  var O={ad:sum(OIN,'ad'),  chd:sum(OIN,'chd'),  inf:sum(OIN,'inf')};
  var nOut=sum(OOUT,'ad')+sum(OOUT,'chd')+sum(OOUT,'inf');
  var subRow=function(lb,x){ return '<tr class="sub"><td class="lb">'+lb+'</td>'
      +'<td class="n">'+x.ad+'</td><td class="n">'+x.chd+'</td><td class="n">'+x.inf+'</td><td></td></tr>'; };
  var body=MAIN.map(function(r){ return line(r); }).join('');
  if(OVN.length){
    body+=subRow('รวม · ทริปวันนี้', M)
      +'<tr class="grp"><td colspan="5">&#127765; รับกลับจากเกาะ · ค้างคืน'
        +'<span>ขึ้นเรือที่ท่าเกาะ · ไม่ได้มากับรถรอบเช้า</span></td></tr>'
      + OVN.map(function(r){ return (r.inc==='in')?line(r):lineOut(r); }).join('')
      + subRow('รวม · รับกลับที่คิดอาหาร', O);
  }

  /* §mealNote · มีโน้ตค่อยสลับเป็นหัวสามคอลัมน์ · ไม่มีโน้ตหัวใบเหมือนเดิมเป๊ะ */
  var MN=(typeof pckMealNote==='function')?pckMealNote(date,bid):'';
  var headBlock = MN
    ? ('<div class="hdw"><div class="sp"></div><div class="mid">'
        +'<div class="ttl">Love Andaman - Lunch</div>'
        +'<div class="dat">'+e(DW.big||date)+'</div></div>'
        +'<div class="nb"><div class="h">NOTE</div>'
        +'<div class="t">'+e(MN).replace(/\n/g,'<br>')+'</div></div></div>')
    : ('<div class="ttl">Love Andaman - Lunch</div><div class="dat">'+e(DW.big||date)+'</div>');
  var sheet='<div class="sheet" id="sheet">'
   + headBlock
   +'<table class="hd"><colgroup><col style="width:132px"><col><col style="width:70px"><col style="width:70px"><col style="width:250px"></colgroup>'
     +'<tr><td class="k">เรือ</td>'
       +'<td class="boat" colspan="2" style="background:'+e(bcol)+';color:'+bink+'">'+e(boat.name||bid)+'</td>'
       +'<td class="blank"></td><td class="rest">'+e(V.name||'')+'</td></tr>'
     + gRows
     +'<tr><td class="k">Staff</td>'
       +'<td class="b'+(stNames.length?'':' none')+'" colspan="2">'
       +(stNames.length?e(stNames.join(' / ')):'— ไม่ได้จัด Island Staff ลำนี้ —')+'</td>'
       +'<td class="blank2"></td><td class="blank"></td></tr>'
     +'<tr class="crew"><td class="k">ทีมกัปตัน เด็กเรือ</td><td colspan="2">'+(nCrew||'—')+'</td>'
       +'<td colspan="2">Staff '+(stNames.length||'—')+'</td></tr>'
   +'</table>'
   +'<table class="gs"><colgroup><col><col style="width:56px"><col style="width:56px"><col style="width:56px"><col style="width:250px"></colgroup>'
     +'<thead><tr><th style="text-align:left;padding-left:10px">Customer&#39;s Name</th>'
       +'<th>AD</th><th>CHD</th><th>INF</th><th>Special Request</th></tr></thead>'
     +'<tbody>'+body
     +'<tr class="tot"><td class="lb">'+(OVN.length?'อาหารที่ต้องทำทั้งหมด':'Total')+'</td>'
       +'<td class="n">'+(M.ad+O.ad)+'</td><td class="n">'+(M.chd+O.chd)+'</td>'
       +'<td class="n">'+(M.inf+O.inf)+'</td><td></td></tr></tbody></table>'
   +(nOut?('<div style="margin-top:7px;font-size:11px;color:#475569;line-height:1.6">'
       +'บนเรือมีทั้งหมด '+(M.ad+M.chd+M.inf+sum(OVN,'ad')+sum(OVN,'chd')+sum(OVN,'inf'))+' ท่าน · '
       +'<b>ไม่คิดอาหาร '+nOut+' ท่าน</b> (รับกลับจากเกาะ · อาหารไม่ได้อยู่กับเรา)</div>'):'')
   +(T.foc?('<div style="margin-top:6px;font-size:10.5px;color:#475569;font-weight:600">'
       +'\u0e23\u0e27\u0e21 FOC '+T.foc+' \u0e04\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e0a\u0e48\u0e2d\u0e07 AD '
       +'\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e17\u0e33\u0e2d\u0e32\u0e2b\u0e32\u0e23\u0e40\u0e2b\u0e21\u0e37\u0e2d\u0e19\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e0d\u0e48</div>'):'')
   +'</div>';

  var fn=('lunch_'+bid+'_'+date).replace(/[^A-Za-z0-9_.-]+/g,'_');
  var html='<!doctype html><html lang="th"><head><meta charset="utf-8">'
   +'<title>Love Andaman - Lunch · '+e(boat.name||bid)+' · '+e(date)+'</title>'
   +'<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500;700&family=DM+Sans:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" rel="stylesheet">'
   +'<style id="sty">'+css+'</style></head><body>'
   +'<div class="tb"><button class="pri" onclick="window.print()">&#128424; พิมพ์</button>'
     +'<button class="img" id="bimg" onclick="shot()">&#128247; บันทึกเป็นรูป · ส่ง LINE</button>'
     +'<span class="hint">ปุ่มสองปุ่มนี้อยู่บนหน้าจอเท่านั้น · ไม่ติดไปกับกระดาษและไม่ติดในรูป</span></div>'
   + sheet
   +'<script>'+pjShotScript(fn)+'<\/script></body></html>';
  var w=window.open('','_blank','width=880,height=1000');
  if(!w){ alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ · อนุญาต pop-up ของหน้านี้ก่อน'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try{ w.focus(); }catch(_){} }, 300);
}

/* กดส่ง = บันทึกต้นทุนอาหารจริงของทริปนั้นทันที แล้วเปิดใบให้ส่งร้าน
   เก็บเป็นจำนวนเงิน ไม่ใช่แค่ชื่อร้าน */
function pckMealSend(bid){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;
  var date=_pckDate;
  var op=(typeof TRIPS!=='undefined' && TRIPS[date]) ? TRIPS[date][bid] : null;
  var rid=(op&&op.route)||'';
  if(!rid){ try{ (SB_BOOKINGS||[]).some(function(b){ var t=ckTripOn(b,date); if(!t) return false;
      var O=bkOpsRead(b,date); if((O.boatId||t.charterBoatId)!==bid) return false; rid=t.routeId; return true; }); }catch(_){} }
  var V=mvForTrip(date,bid,rid);
  if(!V){ alert('ลำนี้ยังไม่มีร้านอาหาร · ตั้งร้านก่อนแล้วค่อยส่งรายการ'); return; }
  var rows=[];
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    var booked=ckBookedPax(t);
    rows.push({b:b, t:t, O:O, booked:booked, expect:pckExpected(b,date,booked),
               ck:O.pierCheckin||null,
               _vd:(typeof pckVoidInfo==='function')?pckVoidInfo(b,date,t):null});
  });
  /* §mealOvn · ขากลับค้างคืนต้องถูกระบุก่อนเสมอ · กันไว้ที่นี่อีกชั้นเผื่อกดจากที่อื่น */
  var _need=(typeof pckMealOvnNeed==='function')?pckMealOvnNeed(date,bid):[];
  if(_need.length){
    alert('ยังไม่ได้ระบุว่ารับกลับจากเกาะรวมอาหารหรือไม่ '+_need.length+' ใบ\n\n'
      +_need.map(function(x){ return '\u2022 '+(String(x.b.leadPax||'').trim()||'—')+' · '+x.pax+' ท่าน'; }).join('\n')
      +'\n\nระบุที่กล่อง "รับกลับจากเกาะ" ในการ์ดครัวก่อน แล้วค่อยส่ง');
    return;
  }
  rows.forEach(function(r){ r.__inc=(r.t&&r.t.ovnLeg)?pckMealOvnOf(date,bid,r.b.id):'in'; });
  var C=pckMealCount(rows), amt=mvCost(V,C.ad,C.chd);
  if(!(C.ad+C.chd)){ alert('ลำนี้ยังไม่มีคนที่จะไปจริง · ไม่ต้องสั่งอาหาร'); return; }
  /* บันทึกก่อน เปิดใบทีหลัง · ถ้า pop-up โดนบล็อก ต้นทุนก็ยังถูกบันทึกไว้แล้ว
     ไม่มี confirm · การ์ดโชว์ยอดอยู่ก่อนกดแล้ว และกดซ้ำได้ตลอดถ้าจำนวนคนเปลี่ยน */
  taSet(date, bid, { meal:{ venueId:V.id, name:V.name||'', ad:C.ad, chd:C.chd,
                            priceAd:(+V.priceAd||0), priceCh:(+V.priceCh||0),
                            amount:Math.round(amt), at:new Date().toISOString(),
                            by:(typeof ckMe==='function')?ckMe():'' } });
  /* §lunch · ใบแบบนี้ทำเฉพาะฝั่ง Visit Panwa · ทับละมุใช้ใบคนละแบบ ยังไม่ได้ทำ
     ท่าอื่นยังบันทึกต้นทุนได้ตามปกติ แค่ไม่มีใบให้เปิด */
  if(mvLunchOk(rid)){
    try{ mvOrderSlip(date, bid, V, rid); }catch(e){ console.warn('[meal] slip failed', e); }
  }else{
    alert('บันทึกยอดอาหารของทริปนี้แล้ว\n\nใบสั่งอาหารตอนนี้ทำเฉพาะฝั่ง Visit Panwa · '
      +'ท่านี้ใช้ใบคนละแบบ ยังไม่ได้ทำ');
  }
  renderPierCheckin();
}
function pckSetView(v){ _pckView=v; try{ localStorage.setItem('pck_view',v); }catch(_){} renderPierCheckin(); }
function pckSetGrp(v){ _pckGrp=v; try{ localStorage.setItem('pck_grp',v); }catch(_){} renderPierCheckin(); }

/* สายรัดข้อมือของลำนั้นในวันนั้น · คนที่ท่าเทียบสีกับข้อมือแขก ไม่ได้อ่านชื่อลำ */
function pckWb(date, bid){
  try{ var J=(typeof pjOf==='function')?pjOf(date,bid):null;
       if(J && J.wbc) return {c:J.wbc, t:J.wb||''}; }catch(_){}
  return null;
}
/* สายรัดสีอ่อนมาก (ขาว/เหลือง) เอามาทำพื้นจะกลายเป็นขาว แยกไม่ออกจากแถวที่ยังไม่ได้ทำ */
function pckWbBase(c){
  var h=String(c||'').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h)) return '#12A46F';
  var r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return ((0.299*r+0.587*g+0.114*b)/255 > 0.88) ? '#B9BFC9' : ('#'+h);
}
/* คู่กับ pckTint · ใช้ทำสีตัวหนังสือของสายรัดบนพื้นขาว */
function pckShade(c,k){
  var h=String(c||'#888').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h)) h='888888';
  var o='#';
  for(var i=0;i<3;i++){ var v=parseInt(h.substr(i*2,2),16);
    o+=('0'+Math.round(v*k).toString(16)).slice(-2); }
  return o;
}
function pckTint(c,t){
  var h=String(c||'#888').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h)) h='888888';
  var o='#';
  for(var i=0;i<3;i++){ var v=parseInt(h.substr(i*2,2),16);
    o+=('0'+Math.round(v+(255-v)*t).toString(16)).slice(-2); }
  return o;
}

/* จัดกลุ่มสองชั้นตามแกนที่เลือก · ใช้แถวชุดเดียวกับการ์ด */
/* §strandPck · ลำดับรถในตารางแผ่นใหญ่เคยเป็น "ลำดับที่เจอใน SB_BOOKINGS" ล้วน ๆ
   ซึ่งไม่ใช่ลำดับที่ใครจัด และขยับได้เองเมื่อมีแถวค้างมาถึงก่อน
   เรียงชุดเดียวกับที่อื่น · เลขกลุ่ม → ลำดับในกลุ่ม → ชื่อรถ · "มาเอง" ท้ายสุด */
function _pckVanKeyOrd(rows){
  var g=0, q=1e9;
  (rows||[]).forEach(function(r){
    var O=r&&r.O, sp=r&&r.vsp;
    var _g=+(((sp&&sp.vanGroup)||(O&&O.vanGroup))||0);
    var _q=+(((sp&&sp.vanSeq)||(O&&O.vanSeq))||0);
    if(_g>0 && (!g || _g<g)) g=_g;
    if(_q>0 && _q<q) q=_q;
  });
  return {g:g||9999, q:q};
}
function _pckVanCmp(map){
  return function(a,b){
    if(a==='__own') return 1; if(b==='__own') return -1;
    var A=_pckVanKeyOrd(map[a]), B=_pckVanKeyOrd(map[b]);
    if(A.g!==B.g) return A.g-B.g;
    if(A.q!==B.q) return A.q-B.q;
    try{ return String(pckVanName(a)).localeCompare(String(pckVanName(b)),'th',{numeric:true}); }
    catch(_){ return String(pckVanName(a)).localeCompare(String(pckVanName(b))); }
  };
}
function pckSheetGroups(boats, border){
  var out=[];
  if(_pckGrp==='van'){
    var vg={}, vord=[], vrows={};
    border.forEach(function(bid){ (boats[bid].rows||[]).forEach(function(r){
      var vk=ckGroupVanId(r)||'__own';   /* §gvanSplit */
      if(!vg[vk]){ vg[vk]={subs:{}, sord:[]}; vord.push(vk); vrows[vk]=[]; }
      vrows[vk].push(r);
      var G=vg[vk]; if(!G.subs[r.bid]){ G.subs[r.bid]=[]; G.sord.push(r.bid); }
      G.subs[r.bid].push(r);
    }); });
    vord.sort(_pckVanCmp(vrows));
    vord.forEach(function(vk){ out.push({key:vk, g:vg[vk]}); });
  } else {
    border.forEach(function(bid){
      var G={subs:{}, sord:[]};
      (boats[bid].rows||[]).forEach(function(r){
        var vk=ckGroupVanId(r)||'__own';   /* §gvanSplit */
        if(!G.subs[vk]){ G.subs[vk]=[]; G.sord.push(vk); }
        G.subs[vk].push(r);
      });
      G.sord.sort(_pckVanCmp(G.subs));
      if(G.sord.length) out.push({key:bid, g:G});
    });
  }
  return out;
}

function pckSheetAgg(rows){
  var a={n:0,pax:0,arr:0,on:0,due:0,ckv:0,sx:0};
  rows.forEach(function(r){
    if(r.strand){ a.sx++; return; }   /* §strandPck */
    a.n++; a.pax+=(r.expect!=null?r.expect:r.booked);
    var st=(r.ck&&r.ck.at)?'on':pckStage(r.ck);
    if(st==='arr'||st==='clr'||st==='on') a.arr++;
    if(st==='on') a.on++;
    a.due+=((r.money&&r.money.due)||0);
    if(r.van&&r.van.at) a.ckv++;
  });
  return a;
}

/* แถบหัวกลุ่ม · ชั้นที่ 1 คือแกนที่เลือก ชั้นที่ 2 คือแกนรอง */
function pckSheetBand(kind, key, rows, date, lvl){
  var e=ckEsc, isBoat=(kind==='boat');
  var a=pckSheetAgg(rows);
  var nm, col, extra='';
  if(isBoat){
    nm=pckBoatName(key); col=pckBoatColor(key);
    var W=pckWb(date,key);
    extra=W ? ('<span class="pcs-wb"><i style="background:'+e(W.c)+'"></i>สายรัด '+e(W.t||'')+'</span>')
            : '<span class="pcs-wb none" title="ยังไม่ได้ระบุสีสายรัดของลำนี้ในใบงานเรือวันนี้">&#9888; ยังไม่ระบุสายรัด</span>';
  } else {
    if(key==='__own'){ nm='มาเอง / รถเอเย่นต์'; col='#8a8a82'; }
    else {
      nm=pckVanName(key);
      var cp=(typeof vehChipPair==='function')?vehChipPair(key):['#EEEDF0','#6B289A'];
      col=cp[1]||'#6B289A';
      var rd=(typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(key,date):null;
      var bits=[];
      /* §gvanHead2 · "ควรเป็น Love6 ทะเบียน 31-6678 · พี่คิง · 095-061-0687 ประมาณนี้"
         ใช้รูปแบบเดียวกับหัวกลุ่มรถบนใบงานไกด์ · ตัดคำว่า "คนขับ"/"เบอร์" ออก
         คั่นด้วยจุด · คนอ่านสองใบสลับไปมาทั้งวัน อ่านแบบเดียวกันย่อมเร็วกว่า */
      if(rd&&rd.plate) bits.push('ทะเบียน <b>'+e(rd.plate)+'</b>');
      if(rd&&rd.driver) bits.push(e(rd.driver));
      if(rd&&rd.phone) bits.push('<b>'+e(rd.phone)+'</b>');
      if(bits.length) extra='<span class="pcs-inf">'+bits.join(' &middot; ')+'</span>';
    }
    extra+='<span class="pcs-ckv'+((a.ckv===a.n&&a.n)?' full':'')+'">เช็คอินรถ '+a.ckv+'/'+a.n+'</span>';
    /* §gvanHead · กลุ่มนี้มีใบที่แยกขึ้นหลายคัน · กติกาเดียวกับใบที่พิมพ์ */
    if(key!=='__own'){
      var _gs=ckVanGroupSplit(rows, key);
      if(_gs.n) extra+='<span class="pcs-vsp" title="ใบที่แยกคนขึ้นรถหลายคัน · แถวพิมพ์รวมอยู่ใต้คันแรก">'
        +'&#8646; แยกขึ้นหลายคัน '+_gs.n+' ใบ'
        +(_gs.others.length?(' &middot; '+_gs.others.map(function(v){ return e(pckVanName(v)); }).join(' &middot; ')):'')
        +'</span>';
    }
  }
  var cold=(a.arr===0);
  var bg=cold?'#F7F8FA':pckTint(col,0.90);
  var ink=cold?'#98A0AC':pckTint(col,-0.45).replace('#','#');
  /* pckTint รับค่าบวกอย่างเดียว · สีตัวหนังสือใช้สีเต็มไปเลย อ่านออกบนพื้นอ่อน */
  ink=cold?'#98A0AC':col;
  var edge=cold?'#DFE3E9':col;
  return '<tr class="pcs-g'+lvl+(cold?' cold':'')+'" style="--c:'+e(col)+';--bg:'+e(bg)+';--ink:'+e(ink)+';--edge:'+e(edge)+'">'
    /* §gvanJob2 · กล่องเดิมเป็น width:fit-content เพราะต้องเกาะซ้ายตอนเลื่อนตารางแนวนอน
       margin-left:auto จึงดันปุ่มไม่ได้ · ครอบกล่องนอกที่กว้างเต็มแถวไว้อีกชั้น
       ของเดิมยังเกาะซ้ายเหมือนเดิม · ปุ่มเกาะขวาของ "ช่วงที่มองเห็น" ไม่ใช่ขวาสุดของตาราง
       (ตารางกว้างกว่าจอ ถ้าอิงขวาสุดของตาราง ปุ่มจะหลุดออกนอกจอจนต้องเลื่อนไปกด) */
    +'<td colspan="16"><div class="pcs-row"><div class="pcs-w">'
    +'<span class="pcs-kind">'+(isBoat?'เรือ':'รถ')+'</span>'
    +'<span class="pcs-pill" style="background:'+e(col)+';color:'
      +((typeof bkV2ContrastInk==='function')?bkV2ContrastInk(col):'#fff')+'">'+e(nm)+'</span>'
    +extra
    +'<span class="pcs-sm">ถึงท่า <b>'+a.arr+'/'+a.n+'</b> &middot; ขึ้นเรือ <b>'+a.on+'</b> &middot; '+a.pax+' pax</span>'
    +(a.due>0?('<span class="pcs-due">ค้างเก็บ &#3647;'+Math.round(a.due).toLocaleString()+'</span>'):'')
    +(a.on===a.n&&a.n?'<span class="pcs-ok">&#10003; ขึ้นเรือครบ</span>':'')
    /* §strandPck · จัดไว้แล้วแต่ถูกยกเลิก · ยังไม่มีใครล้างการจัดการออก */
    +(a.sx?('<span class="ck-scount" title="จัดเรือ/จัดรถไว้แล้วแต่ใบจองถูกยกเลิก · ยังไม่มีใครล้างการจัดการออก · ไม่นับเข้ายอด pax และเงิน">ค้าง '+a.sx+'</span>'):'')
    /* §gvanJob (2026-09-17) · "เพิ่มปุ่มกดใบงานไกด์ไว้ตรงกรอบสีแดง"
       มุมมองการ์ดมีปุ่มนี้อยู่แล้ว · มุมมองตารางไม่มี ต้องเลื่อนไปกดที่แถบบนซึ่งพิมพ์ทุกลำ
       วางชิดขวาสุดของแถบหัวลำ ตรงคอลัมน์ "การจัดการ" ซึ่งเป็นเลนของปุ่มสั่งการอยู่แล้ว */
    +'</div>'
    +(isBoat?('<button class="pcs-job" onclick="event.stopPropagation();pckGuideJobOrder(\''+e(key)+'\')"'
        +' title="พิมพ์ใบงานไกด์ของลำนี้ · A4 แนวนอน">&#128196; ใบงานไกด์</button>'):'')
    +'</div></td></tr>';
}

/* แถบรับกลับจากเกาะ · ไม่มีขั้นเช็คอินที่ท่าและไม่มีเงินต้องเก็บ แต่ต้องเห็นว่ามีงานนี้อยู่
   จัดกลุ่มตามรถที่พากลับ · ยังไม่จัดรถกลับ = ต้องแก้ก่อน จึงอยู่บนสุดของบล็อก */
function pckSheetOvn(boats, border, date){
  var rows=[];
  border.forEach(function(bid){ (boats[bid].ovn||[]).forEach(function(r){ rows.push(r); }); });
  if(!rows.length) return '';
  var g={}, ord=[];
  rows.forEach(function(r){
    var vk=r._retSelf?'__self':(r._retVan||'__none');
    if(!g[vk]){ g[vk]=[]; ord.push(vk); }
    g[vk].push(r);
  });
  ord.sort(function(x,y){
    if(x==='__none') return -1; if(y==='__none') return 1;
    if(x==='__self') return 1;  if(y==='__self') return -1;
    return String(pckVanName(x)).localeCompare(String(pckVanName(y))); });
  var pax=rows.reduce(function(a,r){ return a+(r.expect!=null?r.expect:r.booked); },0);
  var nNo=(g['__none']||[]).length;
  var out='<tbody><tr class="pcs-g1 pcs-ovn" style="--c:#5B289A;--bg:#F4EEFD;--ink:#5B289A;--edge:#5B289A">'
    +'<td colspan="16"><div class="pcs-w">'
    +'<span class="pcs-kind">OVN</span>'
    +'<span class="pcs-pill" style="background:#5B289A;color:#fff">&#8617; รับกลับจากเกาะ</span>'
    +'<span class="pcs-sm">'+rows.length+' booking &middot; '+pax+' pax</span>'
    +'<span class="pcs-ok" style="background:#EDE7FB;color:#5B289A">ไม่ต้องเช็คอินที่ท่า</span>'
    +(nNo?('<span class="pcs-due">&#9888; ยังไม่จัดรถกลับ '+nNo+' ใบ</span>'):'')
    +'</div></td></tr></tbody>';
  ord.forEach(function(vk){
    var rs=g[vk];
    var nm=(vk==='__none')?'ยังไม่จัดรถกลับ':(vk==='__self'?'ลูกค้ากลับเอง':pckVanName(vk));
    var col=(vk==='__none')?'#A32D2D':(vk==='__self'?'#8a8a82':'#5B289A');
    out+='<tbody class="pcs-set" style="--wb:#5B289A;--wbbg:#F4EEFD;--wbink:#3d1a68">'
      +'<tr class="pcs-g2" style="--c:'+col+'"><td colspan="16"><div class="pcs-w">'
      +'<span class="pcs-kind">รถกลับ</span>'
      +'<span class="pcs-pill" style="background:'+col+';color:#fff">'+ckEsc(nm)+'</span>'
      +'<span class="pcs-sm">'+rs.length+' ใบ</span></div></td></tr>'
      +rs.map(function(r){ return pckRowHtml(r,date,true); }).join('')
      +'</tbody>';
  });
  return out;
}

function pckSheetHtml(boats, border, date, warnRows){
  var G=pckSheetGroups(boats, border), body='';
  var secKind=(_pckGrp==='van')?'boat':'van';
  G.forEach(function(gr){
    var all=[]; gr.g.sord.forEach(function(k){ all=all.concat(gr.g.subs[k]); });
    body+='<tbody>'+pckSheetBand(_pckGrp, gr.key, all, date, 1)+'</tbody>';
    gr.g.sord.forEach(function(sk){
      var rows=gr.g.subs[sk];
      /* สีสายรัดของลำที่แถวชุดนี้จะขึ้น · ตั้งเป็นตัวแปรไว้ที่ tbody แถวที่เช็คอินแล้วหยิบไปใช้ */
      var bid=(secKind==='boat')?sk:gr.key;
      var W=pckWb(date,bid), wc=W?pckWbBase(W.c):'#12A46F';
      body+='<tbody class="pcs-set" style="--wb:'+ckEsc(wc)+';--wbbg:'+ckEsc(pckTint(wc,0.86))
        +';--wbink:'+ckEsc(pckShade(wc,0.55))+'">'
        +pckSheetBand(secKind, sk, rows, date, 2)
        +rows.map(function(r){ return pckRowHtml(r,date,true); }).join('')
        +'</tbody>';
    });
  });
  body+=pckSheetOvn(boats, border, date);
  if(!body) return '';
  return '<div class="ck-card pcs-card"><div class="pcs-tw"><table class="ck-tbl pck-tbl pck-sheet">'
    +PCK_SHEET_THEAD+body+'</table></div></div>';
}

/* ปุ่มสลับมุมมอง + แกนการเรียง · วางไว้ท้ายแถบกรอง ไม่กินบรรทัดของตัวเอง */
function pckViewBar(){
  var b=function(fn,v,cur,lbl){
    return '<button onclick="'+fn+'(\''+v+'\')" class="pcs-seg'+(cur===v?' on':'')+'">'+lbl+'</button>'; };
  return '<div class="pcs-bar">'
    +'<span class="k">มุมมอง</span><span class="pcs-segs">'
      +b('pckSetView','sheet',_pckView,'ตาราง')+b('pckSetView','card',_pckView,'การ์ด')+'</span>'
    +(_pckView==='sheet'
      ? ('<span class="k" style="margin-left:12px">เรียงโดย</span><span class="pcs-segs">'
         +b('pckSetGrp','boat',_pckGrp,'เรือ')+b('pckSetGrp','van',_pckGrp,'รถ')+'</span>')
      : '')
    +'</div>';
}
function pckFitPane(){
  if(_pckFitRaf) return;
  _pckFitRaf=requestAnimationFrame(function(){
    _pckFitRaf=0;
    var w=document.querySelector('.pck-host .pcs-tw'); if(!w) return;
    var h=Math.max(320,(window.innerHeight||800)-w.getBoundingClientRect().top-8);
    w.style.maxHeight=h+'px';
    /* §pckHead9 · ก่อนหน้านี้หน้าเว็บล้นออกนอกจอ 73px (มาจาก padding ใต้ view)
       เลยมีแถบเลื่อนสองอัน · หน้าเว็บหนึ่ง กล่องตารางหนึ่ง เลื่อนแล้วงงว่าอันไหนขยับ
       หักส่วนที่ยังล้นออกจากความสูงกล่อง จนหน้าเว็บไม่เลื่อน เหลือแถบเลื่อนแค่ในกล่อง
       วัดเอาแทนการเดาตัวเลข เพราะ padding ของ view เปลี่ยนได้ตามขนาดจอ */
    var de=document.documentElement;
    var over=de.scrollHeight-de.clientHeight;
    if(over>0){ h=Math.max(260,h-over); w.style.maxHeight=h+'px'; }
    w._ph=h;
  });
}
/* ── แถบวันที่แบบบรรทัดเดียว · ของเดิม ckDayHeader กินสองแถวและมีเส้นคั่น ──
   หัวข้อหน้ากับคำอธิบายถูกตัดออกแล้ว เมนูซ้ายบอกอยู่แล้วว่ากำลังอยู่หน้าไหน */
function pckDayBar(date, kpiHtml, totalPax, totalBreak){
  var e=ckEsc, brandCol=pckSelColor();
  var isToday=(date===((typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):''));
  var _d=new Date(date+'T00:00');
  var dnum=_d.toLocaleDateString('en-GB',{day:'numeric'});
  var dowLong=_d.toLocaleDateString('en-GB',{weekday:'long'});
  var dmy=_d.toLocaleDateString('en-GB',{month:'long',year:'numeric'}).toUpperCase();
  return '<div class="pkh-day">'
    +'<button class="pkh-nav" onclick="pckDateShift(-1)" title="วันก่อนหน้า">&lsaquo;</button>'
    /* §pckHead5 · เลขวันตัวใหญ่อ่านปราดเดียว · ชื่อวันกับเดือน/ปีเป็นบรรทัดรอง
       ของเดิม "THU 3 Sept 2026" เรียงเป็นบรรทัดเดียวขนาดเท่ากันหมด ต้องอ่านทีละคำ */
    +'<label class="pkh-dt" title="เลือกวันที่">'
      +'<b class="pkh-dnum">'+e(dnum)+'</b>'
      +'<span class="pkh-dcol"><span class="pkh-dow">'+e(dowLong)+'</span>'
        +'<span class="pkh-dmy">'+e(dmy)+'</span></span>'
      +'<input type="date" value="'+e(date)+'" onclick="event.stopPropagation();try{this.showPicker()}catch(_){}" onchange="if(this.value)pckPickDay(this.value)">'
    +'</label>'
    /* §pckHead7 · ของเดิมเป็น "TODAY" กับ "วันนี้" คนละภาษาในที่เดียวกัน อ่านแล้วนึกว่าบั๊ก
       ป้ายดำ = กำลังดูวันนี้อยู่ · ปุ่มขาวมีลูกศร = กดเพื่อกลับมาวันนี้ */
    +(isToday?'<span class="pkh-today">วันนี้</span>'
             :'<button class="pkh-back" onclick="pckToday()" title="กลับไปวันนี้">&#8617; กลับวันนี้</button>')
    +'<button class="pkh-nav" onclick="pckDateShift(1)" title="วันถัดไป">&rsaquo;</button>'
    +'<span class="pkh-sp"></span>'
    +'<div class="pkh-brand'+(brandCol?' on':'')+'"'+(brandCol?(' style="color:'+pckShade(pckBandBase(brandCol),.62)+'"'):'')+'>'
      +e(pckBrandTitle(date))+'</div>'
    +'<div class="pkh-kpi">'+kpiHtml
      +'<span class="pkh-tot">รวม <b class="ck-mono">'+totalPax+'</b> pax <span class="ck-mono">'+e(totalBreak||'')+'</span></span>'
    +'</div>'
  +'</div>';
}

/* ── หัวใหม่ทั้งก้อน · การ์ดเล็ก ๆ สองคอลัมน์ ─────────────────────────────── */
function pckHeadCard(id, title, headHtml, bodyHtml){
  return '<div class="pkh-card" data-blk="'+id+'">'
    +'<div class="pkh-chd'+(headHtml?'':' plain')+'">'
      +'<span class="pkh-ct">'+ckEsc(title)+'</span>'
      +(headHtml||'<span class="pkh-csp"></span>')
    +'</div>'+bodyHtml+'</div>';
}
function pckHeadHtml(o){
  var B={};
  /* §pckProgBt · จัดจังหวะหัวการ์ดให้เหมือนการ์ด Programmes ของหน้า By trip
     ชื่อ · จำนวนโปรแกรม · ชิปท่า · ปุ่มล้าง อยู่ในแถวเดียวกัน
     ปุ่มเดิมทุกตัว ทำงานเหมือนเดิมทุกอย่าง แค่เรียงใหม่ให้สองหน้าอ่านด้วยสายตาชุดเดียวกัน */
  var _pgN=0; try{ _pgN=(pckProgData(o.date)||[]).length; }catch(_e){}
  B.prog=pckHeadCard('prog','โปรแกรมวันนี้',
    (_pgN?('<span class="pkh-cnt">'+_pgN+' โปรแกรม</span>'):'')
      +pckPierBar(o.date)+pckProgAllBtn()+'<span class="pkh-csp"></span>',
    '<div class="pkh-plist" id="pkh-plist">'+pckProgList(o.date)+'</div>');
  B.boats=pckHeadCard('boats','เรือ',
    '<span class="pkh-selnm">'+ckEsc(pckSelName(o.date))+'</span>'
      +(o.allBoatHtml||'')+'<span class="pkh-csp"></span>'+(o.jobsHtml||''),
    '<div class="pkh-boats">'+(o.boatsHtml||'<span class="pkh-none">— ไม่มีเรือ —</span>')+'</div>');
  B.search=pckHeadCard('search','ค้นหา','', o.searchHtml||'');
  /* ตัวกรองกับมุมมองอยู่ในกล่อง flex เดียวกัน · แยกสองบล็อกเมื่อไหร่ก็กินไปอีกบรรทัด */
  B.filters=pckHeadCard('filters','ตัวกรอง','',
    '<div class="pkh-fwrap">'+(o.chipsHtml||'')+pckViewBar()+'</div>');
  /* §pckHead7 · กรองเส้นทางไหนอยู่ พื้นหัวเปลี่ยนเป็นสีนั้นทั้งแถบ
     เงยหน้าจากตารางแล้วรู้ทันทีว่ากำลังดูโปรแกรมไหน โดยไม่ต้องอ่านตัวหนังสือ */
  var _bc=pckSelColor();
  var _bb=_bc?pckBandBase(_bc):null;
  var _bs=_bb?(' style="background:'+pckTint(_bb,.78)+';border-bottom-color:'+pckTint(_bb,.44)+'"'):'';
  return '<div class="pkh"'+_bs+'>'+o.dayHtml
    +'<div class="pkh-grid">'
      +'<div class="pkh-col">'+B.prog+'</div>'
      +'<div class="pkh-col">'+B.boats+B.search+B.filters+'</div>'
    +'</div></div>';
}

function pckHeadCSS(){
  var H='.pck-host';
  return ''
  +H+' .pgh-empty{padding:10px;font-size:11.5px;color:#a5a49d;text-align:center}'
  +H+' .pgf-all{display:block;width:100%;border:0;border-bottom:1px solid #EFECE4;background:#fff;'
    +'text-align:left;padding:5px 11px;font:700 10.5px inherit;font-family:inherit;color:#6b6a63;cursor:pointer}'
  +H+' .pgf-all.on{background:#15201a;color:#fff}'
  +H+' .pgf{border-bottom:1px solid rgba(255,255,255,.85)}'
  +H+' .pgf-h{display:flex;align-items:center;gap:7px;width:100%;border:0;background:none;'
    +'text-align:left;padding:5px 9px 4px;cursor:pointer;font-family:inherit}'
  +H+' .pgf-h:hover{background:rgba(255,255,255,.45)}'
  +H+' .pgf-cv{width:15px;height:15px;border-radius:4px;display:flex;align-items:center;justify-content:center;'
    +'font-size:9px;color:#8a8a82;flex:none;border:1px solid #E7E4DC;background:#fff;transition:transform .12s}'
  +H+' .pgf-cv.op{transform:rotate(90deg)}'
  +H+' .pgf-cv:hover{border-color:#185FA5;color:#185FA5}'
  +H+' .pgf-h>i{width:8px;height:8px;border-radius:50%;flex:none}'
  /* §pckHead6 · ชื่อคือของที่กวาดตาหา ต้องใหญ่กว่าตัวเลขรอบ ๆ */
  +H+' .pgf-nm{font-size:15px;font-weight:800;letter-spacing:-.2px;'
    +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pgf-px{font-size:12px;font-weight:700;flex:none;opacity:.82}'
  +H+' .pgf-vn{font-size:9.5px;font-weight:700;background:rgba(255,255,255,.7);border-radius:999px;'
    +'padding:1px 7px;flex:none;opacity:.85}'
  +H+' .pgf-cv{background:rgba(255,255,255,.75) !important;border-color:rgba(0,0,0,.08) !important}'
  +H+' .pgf-sp{flex:1}'
  +H+' .pgf-due{font-size:9.5px;font-weight:800;color:#7A4A00;background:#FBF0DD;border-radius:999px;padding:1px 7px;white-space:nowrap}'
  +H+' .pgf-st{font-size:9.5px;font-weight:800;border-radius:999px;padding:2px 9px;white-space:nowrap;flex:none}'
  +H+' .pgf-bar{height:3px;background:rgba(255,255,255,.6);overflow:hidden}'
  +H+' .pgf-bar s{display:block;height:100%;text-decoration:none}'
  +H+' .pgf-vars{padding:2px 0 4px 30px}'
  +H+' .pgv{display:flex;align-items:center;gap:6px;width:100%;border:0;border-left:2px solid #E7E4DC;'
    +'background:none;text-align:left;padding:3px 9px 3px 7px;cursor:pointer;font-family:inherit}'
  +H+' .pgv:hover{filter:brightness(.97)}'
  +H+' .pgv.off{opacity:.5;cursor:default}'
  +H+' .pgv-nm{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;'
    +'text-overflow:ellipsis;max-width:158px}'
  +H+' .pgv-tm{font-size:11px;color:#6b6a63;background:rgba(255,255,255,.75);border-radius:5px;'
    +'padding:1px 6px;flex:none}'
  +H+' .pgv-px{font-size:11px;color:#8a8a82;flex:none}'
  +H+' .pgv-off{font-size:9px;font-weight:700;color:#A32D2D;background:#FCEBEB;border-radius:999px;padding:1px 7px}'
  +H+' .pgv-z{display:inline-flex;gap:3px;margin-left:auto;flex:none}'
  +H+' .pgz{display:inline-flex;align-items:center;gap:3px;border-radius:6px;padding:1px 7px;'
    +'font-size:9px;font-weight:700;white-space:nowrap}'
  +H+' .pgz b{font-size:11px;font-family:\'DM Mono\',monospace}'
  /* ── แถบวันที่ ── */
  /* §pckHead4 · ตรึงหัวไว้ · เลื่อนหน้าลงไปดูแถวท้าย ๆ ยังกดเปลี่ยนวัน/กรอง/ค้นหาได้ทันที
     ไม่ต้องเลื่อนกลับขึ้นมาทุกครั้ง · z สูงกว่าหัวตารางที่ตรึงในกล่องของมันเอง (z 30/34) */
  /* §pckHead5 · หัวชิดขอบ sidebar และตรึงค้างไว้ · ดึงออกนอก padding ของ .main
     (บน 22 · ซ้าย 14 · ขวา 22) แล้วเอา padding นั้นมาไว้ในตัวเองแทน
     ตรึงแบบ sticky top:0 · เลื่อนตารางยังไงหัวก็ไม่ขยับ */
  /* §pckHead6 · พื้นหัวเป็นเทากลาง ๆ · การ์ดขาวลอยขึ้นมาชัดกว่าเดิม
     และสีประจำโปรแกรมเด้งกว่าตอนวางบนพื้นครีม */
  /* host กินเต็มพื้นที่เนื้อหา · ดึงออกนอก padding ของ .main แล้วเอา padding มาไว้ในตัวเอง
     สีพื้นจึงเต็มขอบจริง ไม่เหลือกรอบขาวรอบ ๆ */
  +H+'{margin:-22px -22px -22px -14px;padding:22px 22px 0 14px;transition:background .18s}'
  /* §pckHead10 · หน้านี้ไม่ต้องเว้นก้นหน้า · ที่เว้นย้ายเข้าไปอยู่ในกล่องเลื่อนแทน */
  +'#view-piercheckin{padding-bottom:0 !important}'
  /* §pkhStick · เดิม top:-22px · พอหน้าเลื่อนได้ หัวที่ตรึงจะจมขึ้นไป 22px
     กินขอบบน 11px + แถววันที่อีก 11px = "6 SEPTEMBER 2026" ถูกเฉือนครึ่งบรรทัด
     ดูเหมือนหัวหลุดการตรึง ทั้งที่มันตรึงอยู่ แค่ตรึงไว้เหนือขอบจอ
     -22 มีไว้ชดเชย margin ติดลบตอนยังไม่ตรึง ซึ่งไม่เกี่ยวกับตำแหน่งตอนตรึงเลย
     ตรึงที่ 0 · ตอนยังไม่เลื่อนตำแหน่งเท่าเดิมทุกพิกเซล (วัดแล้ว pkhTop=0 เหมือนกัน) */
  +H+' .pkh{position:sticky;top:0;z-index:60;background:#E4E7EC;'
    +'margin:-22px -22px 10px -14px;border-radius:0;border-bottom:1px solid #DCE0E6;'
    +'padding:11px 22px 11px 14px;'
    +'box-shadow:0 6px 14px -8px rgba(15,23,42,.16)}'
  +H+' .pkh-day{position:relative;display:flex;align-items:center;gap:8px;padding:0 2px 8px}'
  +H+' .pkh-nav{width:26px;height:26px;border-radius:50%;border:1px solid #D5D9E0;background:#fff;'
    +'cursor:pointer;font-size:14px;line-height:1;color:#6b6a63;flex:none;font-family:inherit}'
  +H+' .pkh-dt{position:relative;display:inline-flex;align-items:center;gap:9px;cursor:pointer;'
    +'white-space:nowrap;color:#15201a}'
  +H+' .pkh-dnum{font-size:32px;font-weight:800;line-height:1;letter-spacing:-1.2px}'
  +H+' .pkh-dcol{display:flex;flex-direction:column;line-height:1.1}'
  +H+' .pkh-dow{font-size:15px;font-weight:800;letter-spacing:-.2px}'
  +H+' .pkh-dmy{font-size:10px;font-weight:700;color:#98A0AC;letter-spacing:.1em}'
  +H+' .pkh-dt input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}'
  +H+' .pkh-today{background:#15201a;color:#fff;border-radius:999px;padding:3px 11px;font-size:10.5px;font-weight:800}'
  +H+' .pkh-back{border:1px solid #D5D9E0;background:#fff;border-radius:999px;padding:2px 10px;'
    +'font:800 9.5px inherit;font-family:inherit;color:#5F6570;cursor:pointer;white-space:nowrap}'
  +H+' .pkh-back:hover{border-color:#185FA5;color:#185FA5}'
  +H+' .pkh-sp{flex:1}'
  /* ชื่อกลางหัว · จัดกลางจริงด้วย absolute จะได้ไม่เลื่อนตามความกว้างของสองฝั่ง
     pointer-events:none เพื่อไม่ให้บังปุ่มที่อยู่ข้างใต้ · จอแคบซ่อนไปเลย */
  /* §pkhBrand · จัดชื่อกลางหัวให้เหมือนหน้า By trip
     ของเดิมตรึงไว้ที่ top:12px ตายตัว ตัวหนังสือจึงต่ำกว่าบล็อกวันที่ 9px
     และตัวเล็ก/จางกว่าอีกหน้าหนึ่ง เดินสลับสองหน้าแล้วรู้สึกว่าคนละที่
     เอา top ออก ปล่อยให้ align-items:center ของแถวจัดกลางแนวตั้งให้ (วิธีเดียวกับ .bt-brand)
     วัดแล้วกลางตรงกับบล็อกวันที่และปุ่ม "วันนี้" พอดี 0px ทั้งคู่
     ขนาดกับระยะห่างตัวอักษรยกมาจาก By trip ตรง ๆ · ตอนกรองโปรแกรมยังเป็นชื่อโปรแกรมสีนั้นเหมือนเดิม */
  +H+' .pkh-brand{position:absolute;left:50%;transform:translateX(-50%);'
    +'pointer-events:none;font-size:20px;font-weight:800;letter-spacing:.46em;padding-left:.46em;'
    +'color:#1F2124;white-space:nowrap;max-width:32vw;overflow:hidden;text-overflow:ellipsis}'
  /* §pkhBrand2 · ตอนกรองโปรแกรมอยู่ก็ใช้ตัวหนังสือชุดเดียวกัน
     ของเดิมสลับเป็นตัวชิด 21px แถบเดียวกันจึงมีตัวหนังสือสองแบบ สลับไปมาแล้วเหมือนคนละหน้า
     หน้า By trip ใช้ชุดเดียวทั้งสองสถานะอยู่แล้ว (.bt-brand ไม่มีสถานะแยก)
     เหลือแค่สีที่เปลี่ยนตามโปรแกรม
     .tight ใส่ให้เองตอนที่วัดแล้วที่ว่างไม่พอ · ดู §pkhBrandFit */
  +H+' .pkh-brand.on{max-width:38vw}'
  +H+' .pkh-brand.tight{letter-spacing:-.3px;padding-left:0}'
  /* จอแคบพื้นที่ตรงกลางไม่พอ ชนกับยอดรวมฝั่งขวา · ซ่อนไปเลยดีกว่าให้ทับกัน */
  +'@media(max-width:1360px){'+H+' .pkh-brand{display:none}}'
  +H+' .pkh-kpi{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}'
  +H+' .pkh-kpi>span{border-radius:999px;padding:4px 11px;font-size:11.5px;font-weight:700;white-space:nowrap}'
  +H+' .pkh-tot{background:#fff;border:1px solid #DFE3E9;color:#3C3B37}'
  +H+' .pkh-tot b{font-size:14px}'
  +H+' .pkh-tot .ck-mono{font-size:10px;color:#a5a49d}'
  /* ── สองคอลัมน์ ── */
  /* stretch · การ์ดโปรแกรมยืดเท่าคอลัมน์ขวา รายการจะได้ใช้ที่ว่างที่เหลือทั้งหมด
     ของเดิม align-items:start ทำให้การ์ดซ้ายเตี้ยแล้วเหลือช่องว่างใต้การ์ดเปล่า ๆ */
  +H+' .pkh-grid{display:grid;grid-template-columns:minmax(300px,1.05fr) minmax(400px,1.35fr);'
    +'gap:8px;align-items:stretch}'
  +H+' .pkh-col{display:flex;flex-direction:column;gap:8px;min-width:0}'
  +H+' .pkh-col:first-child>.pkh-card{flex:1;display:flex;flex-direction:column;min-height:0}'
  +H+' .pkh-card{background:#fff;border:1px solid #DFE3E9;border-radius:11px;overflow:hidden}'
  +H+' .pkh-chd{display:flex;align-items:center;gap:7px;padding:4px 9px;'
    +'border-bottom:1px solid #EBEEF2;background:#F6F7F9}'
  +H+' .pkh-chd.plain{display:none}'
  +H+' .pkh-ct{font-size:10.5px;font-weight:800;color:#6b6a63;letter-spacing:.05em;white-space:nowrap}'
  +H+' .pkh-csp{flex:1}'
  +H+' .pkh-selnm{font-size:14px;font-weight:800;color:#2c2c2a;letter-spacing:-.2px;'
    +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pkh-plist{flex:1;min-height:96px;max-height:none;overflow-y:auto;overscroll-behavior:contain}'
  +H+' .pkh-plist::-webkit-scrollbar{width:6px}'
  +H+' .pkh-plist::-webkit-scrollbar-thumb{background:#DAD6CC;border-radius:3px}'
  +H+' .pkh-boats{padding:5px 8px}'
  +H+' .pkh-none{font-size:10.5px;color:#a5a49d}'
  /* แถบเดิมที่ยกมาวางในการ์ด · ถอดกรอบ/พื้นหลังของตัวเองออก การ์ดมีให้แล้ว */
  +H+' .pkh-card .ck-fbar{margin:0;padding:6px 9px;border:0;background:none;box-shadow:none;border-radius:0}'
  +H+' .pkh-card .pcs-bar{margin:0;padding:0 9px 7px}'
  +H+' .pkh-card .pck-btabs{margin:0;padding:0;border:0;background:none;box-shadow:none}'
  +H+' .pkh-card .ck-unitbar-lbl{display:none}'
  /* ปุ่มใบงานมุมขวาบนของการ์ดเรือ */
  +H+' .pkh-jobs{display:inline-flex;gap:4px;flex:none;margin-left:6px}'
  +H+' .pkh-jobs .pck-joball{width:25px !important;height:25px !important;font-size:12px !important;margin:0 !important}'
  /* ── ปุ่มท่าเรือ ── */
  /* §pckHead6 · ปุ่มล้างตัวกรองสองอันนี้กดนาน ๆ ครั้ง · ตัวเล็กลงเพื่อคืนสายตาให้ชื่อ */
  +H+' .pkh-allbtn{border:1px solid #E6C9C3;background:#fff;color:#A32D2D;border-radius:999px;'
    +'padding:1px 7px;font:800 8.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}'
  +H+' .pkh-chd .pck-btab{padding:1px 8px !important;font-size:8.5px !important;'
    +'font-weight:800 !important;gap:4px !important;border-radius:999px !important}'
  +H+' .pkh-chd .pck-btab .c{font-size:8.5px !important;padding:0 5px !important}'
  +H+' .pkh-piers{display:inline-flex;border:1px solid #E1DED5;border-radius:999px;overflow:hidden;background:#fff;flex:none}'
  +H+' .pkh-piers button{border:0;background:none;font:700 10px inherit;font-family:inherit;'
    +'padding:3px 9px;cursor:pointer;color:#6b6a63;white-space:nowrap}'
  +H+' .pkh-piers button.on{background:#15201a;color:#fff}'
  +H+' .pkh-piers button b{font-family:\'DM Mono\',monospace;font-weight:700;opacity:.6;margin-left:4px}'
  /* ── บีบของที่ยกมาจากแถบเดิม · การ์ดในหัวมีที่จำกัด ──
        ตัวกรองกับมุมมองต้องไหลรวมเป็นแถวเดียวกัน จึงให้ตัวห่อของเดิมเป็น display:contents */
  +H+' .pkh-fwrap{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px 9px}'
  +H+' .pkh-fwrap>.ck-fbar,'+H+' .pkh-fwrap>.pcs-bar{display:contents}'
  +H+' .pkh-card .ck-fbar button,'+H+' .pkh-fwrap button{padding:4px 11px !important;font-size:11.5px !important}'
  +H+' .pkh-card .ck-fbar input,'+H+' .pkh-card .ck-fbar select{height:32px !important;font-size:13px !important}'
  +H+' .pkh-fwrap .pcs-seg{padding:4px 13px !important;font-size:11.5px !important}'
  +H+' .pkh-fwrap .k{font-size:10.5px}'
  +H+' .pkh-card .ck-fsep{margin:0 1px}'
  /* เรือ · ชิปเล็กลงและปุ่มไอคอนไหลต่อท้ายในแถวเดียวกัน */
  +H+' .pkh-boats .pck-btabs{display:flex;flex-wrap:wrap;align-items:center;gap:5px}'
  +H+' .pkh-boats .pck-btab{padding:3px 11px !important;font-size:11px !important;gap:7px !important}'
  /* ชื่อเรือคือช่องที่สองของชิป · ตัวแรกเป็นจุดสี */
  +H+' .pkh-boats .pck-btab>span:nth-child(2){font-size:14px;font-weight:800;letter-spacing:-.2px}'
  +H+' .pkh-boats .pck-btab .rt{font-size:10px !important}'
  +H+' .pkh-boats .pck-btab .c{font-size:10px !important}'
  +H+' .pkh-boats .pck-btab .rt{font-size:9px !important}'
  +H+' .pkh-boats .pck-btab .c{font-size:9.5px !important}'
  +H+' .pkh-boats .pck-joball{width:23px !important;height:23px !important;font-size:11px !important;margin:0 !important}'
  /* ══ §pckProgBt · แผงโปรแกรมใช้จังหวะเดียวกับการ์ด Programmes ของ By trip ══
     สองหน้านี้อ่านข้อมูลชุดเดียวกัน คนเดินไปมาระหว่างสองหน้าตลอดวัน
     แต่เดิมหน้าตาคนละแบบ · ตาต้องปรับใหม่ทุกครั้งที่สลับหน้า
     ปรับเฉพาะการมองเห็น · ปุ่มและตัวจัดการเหตุการณ์เดิมทั้งหมด ไม่แตะสักตัว */
  +H+' [data-blk="prog"] .pkh-chd{padding:8px 11px;gap:8px;flex-wrap:wrap;background:#FBFAF7;'
    +'border-bottom:1px solid rgba(0,0,0,.07)}'
  +H+' [data-blk="prog"] .pkh-ct{font-size:13.5px;font-weight:800;color:#1F2124;letter-spacing:0}'
  +H+' .pkh-cnt{background:#EFEBE7;color:#403833;border-radius:999px;padding:2px 9px;'
    +'font-size:10.5px;font-weight:800;letter-spacing:0;flex:none}'
  +H+' [data-blk="prog"] .pkh-allbtn{border-radius:6px;padding:3px 7px;font-size:9.5px;flex:none}'
  +H+' [data-blk="prog"] .pkh-piers button{font-size:10px;padding:3px 8px}'
  /* แถวโปรแกรม · เตี้ยลงและมีมุมโค้งเหมือนฝั่ง By trip */
  +H+' [data-blk="prog"] .pgf{border-bottom:0}'
  +H+' [data-blk="prog"] .pgf-h{padding:5px 10px;gap:8px}'
  +H+' [data-blk="prog"] .pgf-nm{font-size:12.5px;letter-spacing:0}'
  +H+' [data-blk="prog"] .pgf-px{font-size:12.5px;font-weight:700;'
    +'font-family:\'DM Mono\',monospace;opacity:1;color:#4a4a45}'
  +H+' [data-blk="prog"] .pgf-cv{width:14px;height:14px}'
  +H+' [data-blk="prog"] .pgf-vn,'+H+' [data-blk="prog"] .pgf-due,'
    +H+' [data-blk="prog"] .pgf-st{border-radius:6px;font-size:9.5px;padding:1px 7px}'
  /* variant · เยื้องเข้าเท่ากับฝั่ง By trip และเลิกใช้เส้นซ้าย */
  +H+' [data-blk="prog"] .pgf-vars{padding:1px 0 4px 0}'
  +H+' [data-blk="prog"] .pgv{padding:3px 10px 3px 24px;gap:7px;border-left:0}'
  +H+' [data-blk="prog"] .pgv-nm{font-size:11px;font-weight:700;color:#3a3a36}'
  +H+' [data-blk="prog"] .pgv-tm{font-size:11px;color:#5b6472;background:none;padding:0}'
  +H+' [data-blk="prog"] .pgv-px{font-size:11px}'

  /* ══ §mobPier · โทรศัพท์ ═══════════════════════════════════════════════
     หน้านี้ถูกใช้ยืนถือโทรศัพท์ที่ท่าเรือจริง · ของเดิมสองคอลัมน์ตายตัว
     300px + 400px ในจอ 390px → ครึ่งขวาหลุดออกนอกจอ ต้องรู้เองว่าต้องปัด
     ทำเป็นซ้อนกันลงมา · เรียงตามลำดับที่ใช้จริง: หาคน → กรอง → โปรแกรม */
  +'@media(max-width:820px){'
    +H+' .pkh-grid{grid-template-columns:minmax(0,1fr);gap:10px}'
    +H+' .pkh-col{min-width:0;width:auto}'
    /* ค้นหา/กรอง/เลือกเรือ ขึ้นก่อน · ที่ท่าเขาเปิดมาเพื่อ "หาคนนี้" ไม่ใช่มาอ่านโปรแกรม */
    +H+' .pkh-col:nth-child(2){order:-1}'
    +H+' .pkh-col:first-child>.pkh-card{flex:none}'
    /* ยอดรวมหัวหน้า · ชิดซ้ายให้อ่านไล่จากซ้ายเหมือนบรรทัดปกติ */
    /* ตัวแม่เป็น nowrap · ยอดรวมจึงตกบรรทัดใหม่ไม่ได้ ต้องยืนค้างในแถวเดียวแล้วล้นออกไป */
    +H+' .pkh-day{flex-wrap:wrap;row-gap:6px}'
    +H+' .pkh-kpi{justify-content:flex-start;width:100%;margin-top:2px}'
    /* ช่องค้น voucher · เต็มบรรทัด แตะแล้วพิมพ์ได้เลย ไม่ต้องเล็ง */
    +H+' .pck-fsearch{flex-wrap:wrap}'
    /* สองช่องนี้ถูกสร้างพร้อม style= ติดแท็ก · inline ชนะสไตล์ชีตเสมอ ต้องทับด้วย !important
       ต่ำกว่า 16px เมื่อไร iOS ซูมจอเข้าเองตอนแตะ แล้วไม่ซูมกลับ */
    +H+' #pck-q{flex:1 1 100% !important;min-width:0 !important;height:auto !important;'
      +'min-height:44px !important;font-size:16px !important}'
    +H+' #pck-van{flex:1 1 100% !important;min-height:44px !important;font-size:16px !important;'
      +'height:auto !important}'
    /* ต่ำกว่า 16px เมื่อไร iOS ซูมจอเข้าเองตอนแตะ แล้วไม่ซูมกลับ */
    +H+' select,'+H+' input[type=text],'+H+' input[type=search]{font-size:16px}'
    /* ปุ่มกรอง · ให้ตกบรรทัดแทนที่จะไหลออกนอกจอ และสูงพอให้นิ้วกดโดน */
    +H+' .pkh-fwrap{flex-wrap:wrap;gap:6px}'
    +H+' .pkh-fwrap button{min-height:38px}'
    +H+' .pkh-boats{overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap}'
  +'}'
  ;
}
function pckSheetCSS(){
  var S='.pck-host table.ck-tbl.pck-sheet';
  return ''
  +'.pck-host .pcs-bar{display:flex;align-items:center;gap:7px;margin:0 0 10px}'
  +'.pck-host .pcs-bar .k{font-size:11px;font-weight:700;color:#5F5E5A}'
  +'.pck-host .pcs-segs{display:inline-flex;border:1.5px solid #D8D4CA;border-radius:999px;'
    +'overflow:hidden;background:#fff}'
  +'.pck-host .pcs-seg{border:none;background:none;font:700 11.5px inherit;font-family:inherit;'
    +'padding:4px 14px;cursor:pointer;color:#6b6a64}'
  +'.pck-host .pcs-seg.on{background:#15201a;color:#fff}'
  /* กล่องเลื่อนของตัวเอง · การตรึงคอลัมน์ซ้ายต้องมีตัวเลื่อนของตัวเอง */
  +'.pck-host .pcs-tw{overflow:auto;max-height:calc(100vh - 250px);min-height:340px;'
    +'border-radius:13px;contain:paint;overscroll-behavior:contain;'
    /* เว้นไว้ในตัวกล่อง · เลื่อนสุดแล้วแถวสุดท้ายยังพ้นป้ายมุมซ้ายล่าง (250x65 ห่างก้นจอ 10) */
    +'padding-bottom:78px}'
  +'.pck-host .ck-card.pcs-card{overflow:hidden;padding:0;'
    +'background:var(--pck-band,#EDEFF2) !important;'
    +'border:1px solid var(--pck-bandb,#DCE0E6) !important;transition:background .18s}'
  /* width:max-content · ไม่งั้นตารางยืดเต็มความกว้างจอ แล้วเอาที่ว่างไปแจกให้คอลัมน์
     ที่ไม่ได้ล็อกความกว้างไว้ (เงินหน้าท่า / การจัดการ) กลายเป็นช่องยาวโล่ง ๆ */
  +S+'{border-collapse:separate;border-spacing:0;min-width:1500px;width:-moz-max-content;width:max-content}'
  +S+' th,'+S+' td{border-right:1px solid #D8DCE3;border-bottom:1px solid #D8DCE3;'
    +'vertical-align:middle;background-clip:padding-box}'
  /* §pckName3 · เส้นคั่นแถวเข้มกว่าเส้นคั่นคอลัมน์ · ตาไล่ตามแถวเป็นหลัก ไม่ได้ไล่ตามคอลัมน์ */
  +S+' tr.ck-row>td{border-bottom:1px solid #AEB7C4}'
  +S+' td{padding:5px 8px}'
  +S+' thead th{background:#EDF0F5;color:#3C4A63;font-weight:800;font-size:9.5px;letter-spacing:.04em;'
    +'text-align:center;border-bottom:2px solid #A9B2C2;box-shadow:none;padding:0 7px;height:32px;'
    +'position:sticky;top:0 !important;z-index:30}'
  /* ตรึงสองคอลัมน์ซ้าย · Voucher+Agency กับ ลูกค้า */
  +S+' tr.ck-row>td{background:#fff}'
  +S+' tr.ck-row>td:nth-child(-n+2),'+S+' thead th:nth-child(-n+2){position:sticky;z-index:12}'
  +S+' thead th:nth-child(-n+2){z-index:34}'
  +S+' tr.ck-row>td:nth-child(1),'+S+' thead th:nth-child(1){left:0;width:150px;min-width:150px;max-width:150px}'
  +S+' tr.ck-row>td:nth-child(2),'+S+' thead th:nth-child(2){left:150px;width:128px;min-width:128px;'
    +'max-width:128px;padding:0 !important}'
  +S+' tr.ck-row>td:nth-child(3),'+S+' thead th:nth-child(3){left:278px;width:300px;min-width:300px;'
    +'max-width:300px;border-right:2px solid #A9B2C2}'
  +S+' tr.ck-row>td:nth-child(-n+3),'+S+' thead th:nth-child(-n+3){position:sticky;z-index:12}'
  +S+' thead th:nth-child(-n+3){z-index:34}'
  /* ── ช่อง Agency เป็นสีเต็มช่อง · สีเอเจนซี่คือตัวที่ใช้กวาดตาหาแถวเร็วที่สุด ── */
  +S+' td.pcs-ag>*{display:flex !important;align-items:center;justify-content:center;'
    +'width:100% !important;max-width:none !important;min-height:34px;height:100%;'
    +'margin:0 !important;padding:0 8px !important;border-radius:0 !important;'
    +'box-shadow:none !important;border:0 !important;font-size:11px;font-weight:700;'
    +'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15}'
  /* ── ความกว้างคอลัมน์ที่แยกใหม่ ── */
  +S+' .pcs-vch{font-size:11px;line-height:1.2}'
  +S+' .pcs-by{font-size:9px;color:#a5a49d;margin-top:2px}'
  +S+' .pcs-by b{color:#5F5E5A;font-weight:700}'
  +S+' td.pcs-tm{width:104px;text-align:center}'
  +S+' td.pcs-pk{min-width:230px;max-width:230px}'
  +S+' td.pcs-rm{width:58px}'
  +S+' td.pcs-zn{width:96px;text-align:center}'
  +S+' td.pcs-ao{width:150px;min-width:150px;max-width:150px}'
  +S+' td.pcs-sq{width:210px;min-width:210px;max-width:210px}'
  +S+' td.pcs-st{width:132px;min-width:132px;max-width:132px;text-align:center}'
  +S+' td.pcs-mn{width:158px;min-width:158px;max-width:158px}'
  +S+' td.pcs-mg{width:186px;min-width:186px;max-width:186px}'
  +S+' .pcs-prv{display:inline-block;background:#F4E8FB;color:#6B289A;font-weight:700;font-size:9px;'
    +'padding:0 6px;border-radius:6px;vertical-align:middle;white-space:nowrap}'
  +S+' .pcs-sub{font-size:9.5px;color:#a5a49d;margin-top:2px}'
  /* ── บีบความสูง · ป้ายและปุ่มในตารางชีทเล็กกว่าในการ์ด ── */
  +S+' .ck-pick{max-width:220px;font-size:12px;font-weight:600;line-height:1.2}'
  /* §pckDropFit · จุดส่งแยกโดนตัดหายไปครึ่งชื่อ
     .pck-drop เกิดมาจาก CSS ของ "การ์ด" ซึ่งเป็น inline-block กว้างได้ถึง 230px
     พอมาอยู่ในชีท ช่องจุดรับกว้าง 230px หักช่องไฟแล้วเหลือ 214px และป้ายนี้
     ยังไหลต่อท้ายชื่อโรงแรมในบรรทัดเดียวกัน จึงล้นออกไป 138px แล้วถูกพื้นขาว
     ของช่องถัดไปทับ = อ่านได้แค่ครึ่งชื่อ (วัดจริง 29 จาก 29 แถวล้นทั้งหมด)
     ในชีทให้ลงบรรทัดของตัวเองและกว้างได้ไม่เกินช่อง ชื่อยาวแค่ไหนก็อ่านครบ */
  +S+' td.pcs-pk{white-space:normal}'
  +S+' .pck-drop{display:block;max-width:100%;white-space:normal;'
    +'overflow-wrap:anywhere;word-break:break-word;margin-top:4px}'
  +S+' .ck-sreq{max-width:196px;font-size:10px;line-height:1.25;padding:1px 6px}'
  +S+' .ck-area{font-size:10px;padding:1px 7px}'
  +S+' .ck-tm{font-size:11px}'
  /* ── ช่องเงิน · บรรทัดบนคือคำตอบ บรรทัดล่างคือที่มา ── */
  +S+' td.pcs-mn{white-space:normal;line-height:1.45}'
  +S+' .pcs-pay{display:inline-block;border-radius:7px;padding:2px 9px;font-size:10.5px;'
    +'font-weight:800;white-space:nowrap;margin:0 4px 2px 0;vertical-align:middle}'
  +S+' .pcs-pay b{font-size:13px;font-weight:800;margin-left:3px;font-variant-numeric:tabular-nums}'
  +S+' .pcs-pay.due{background:#FBF0DD;color:#7A4A00;border:1px solid #EAD9B0}'
  +S+' .pcs-pay.ok{background:#DCF4E8;color:#0F6E56;border:1px solid #B7E2D2}'
  +S+' .pcs-pay.none{background:#F3F4F6;color:#9AA1AC;border:1px solid #E4E7EC}'
  +S+' .pcs-pay.warn{background:#FBF3E6;color:#8A5B00;border:1px solid #EBDCC2}'
  +S+' .pcs-payp{display:block !important;font-size:9px;color:#a08a5f;margin:1px 0 0 0 !important;'
    +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  /* ── คอลัมน์ไกด์ · แคบที่สุดเท่าที่ยังอ่านออก เหลือแค่รหัสภาษา ── */
  +S+' td.pcs-gdc{width:56px}'
  /* หัวคอลัมน์ยาวเกินช่อง · ตัดด้วย ellipsis ไม่ให้ดันความกว้างคอลัมน์ */
  +S+' thead th{overflow:hidden;text-overflow:ellipsis}'
  +S+' tr.pcs-g1.pcs-ovn>td{border-top-width:3px}'
  /* แถบชื่อเรือตรึงใต้หัวตาราง · เลื่อนลงไปกลางลำยาว ๆ ต้องยังรู้ว่ากำลังดูลำไหนอยู่ */
  +S+' tr.pcs-g1>td{position:sticky;top:32px;z-index:20}'
  /* ── ช่องที่มีทั้งป้ายข้อมูลและปุ่ม · ล้นแล้วให้ตกบรรทัดสอง ไม่ตัดทิ้ง
        Add-on กับ Special request เป็นของที่หน้าท่าต้องอ่านครบ ── */
  +S+' td.pcs-ao,'+S+' td.pcs-sq{white-space:normal;line-height:1.3}'
  +S+' td.pcs-ao .ck-aoact{display:inline-flex !important;gap:4px;margin:0 0 0 4px !important;'
    +'vertical-align:middle}'
  +S+' td.pcs-sq .pck-mcell{display:block !important;margin:0 !important}'
  +S+' td.pcs-sq .pck-mact{display:flex !important;gap:4px;margin:3px 0 0 0 !important}'
  +S+' td.pcs-ao .ck-aoact{display:flex !important;gap:4px;margin:3px 0 0 0 !important}'
  /* ── สถานะหน้าท่า · ปุ่มเดียว + บรรทัดถอยกลับ ── */
  +S+' .pcs-sb{display:inline-block;border:1.5px solid;border-radius:8px;padding:3px 11px;'
    +'font:800 11px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}'
  +S+' .pcs-sb.a{background:#E6F1FB;border-color:#7EAED8;color:#0C447C}'
  +S+' .pcs-sb.c{background:#FDF6E6;border-color:#E3C77A;color:#7A4A00}'
  +S+' .pcs-sb.ok{background:#FDF6E6;border-color:#E3C77A;color:#7A4A00}'
  +S+' .pcs-sbs{display:block;font-size:9px;color:#a5a49d;margin-top:2px;white-space:nowrap;'
    +'cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px}'
  +S+' .pcs-sbs:hover{color:#A32D2D}'
  +S+' td.pcs-sq .pck-note{display:block !important;margin:2px 0 0 0 !important;'
    +'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +S+' .ck-ao{max-width:140px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}'
  /* แถวที่ยังไม่มีใครแตะ · ซีดลงเหมือนหน้าเช็คอินรถ สายตาจะได้ไปที่แถวที่กำลังทำ */
  +S+' tr.ck-row.ck-plain:not(.ck-arr):not(.ck-clr):not(.pck-rvoid) .ck-agblk{filter:grayscale(1) brightness(1.9) contrast(.35)}'
  +S+' tr.ck-row.ck-plain:not(.ck-arr):not(.ck-clr):not(.pck-rvoid):hover .ck-agblk{filter:none}'
  +S+' .pck-gchip.pcs-gd{font-size:9.5px;font-weight:800;padding:1px 7px;letter-spacing:.02em}'
  /* ── ปุ่มเช็คอิน = ปุ่มที่ยื่นสายรัดให้แขก สีจึงต้องอยู่ตรงนั้น ──
     ยังไม่กด = ขอบสีสายรัด เครื่องหมายถูกสีสายรัด หยิบถูกเส้นตั้งแต่ยังไม่กด
     กดแล้ว = ปุ่มทึบสีนั้น และทั้งแถวเปลี่ยนตาม ยืนยันว่าแจกถูก */
  +S+' tbody.pcs-set .pck-ok{background:var(--wb);border-color:var(--wb);color:#fff}'
  +S+' tbody.pcs-set .pck-ok.off{background:#fff;border-color:var(--wb);color:var(--wbink)}'
  +S+' tbody.pcs-set .pck-ok.off .tk{color:var(--wb)}'
  +S+' .ck-vch{font-size:11px;line-height:1.2;max-width:138px}'
  /* ── บีบแถวให้เตี้ย · ในการ์ดของเดิมทุกอย่างวางเป็นบล็อกซ้อนกัน แถวเลยสูง 150px
     ตารางชีทต้องกวาดตาลงมาได้ ของที่เดิมซ้อนกันจึงดันมาต่อกันในบรรทัดเดียว ── */
  +S+' tr.ck-row>td{padding:3px 7px;vertical-align:middle;overflow:hidden}'
  /* เบอร์โทรต่อท้ายชื่อในบรรทัดเดียวกัน · ของเดิมขึ้นบรรทัดใหม่ กินไปแถวละบรรทัด */
  +S+' td.pcs-nm .ck-tel{display:inline-block !important;margin:0 0 0 6px !important;'
    +'font-size:10.5px;font-weight:600;white-space:nowrap}'
  /* (ขนาดชื่อรองย้ายไปตั้งหลังกฎ >div ด้านล่าง · ไม่งั้นโดนกฎนั้นทับ) */
  +S+' td.pcs-nm .ck-lead{font-size:11.5px;padding:1px 7px}'
  +S+' tr.ck-row td>div{display:inline-block;vertical-align:middle;margin:0 4px 0 0 !important}'
  /* ช่องชื่อ ลค · ชื่อคนที่ 2-3 กับเบอร์ ต้องอยู่คนละบรรทัด ดันมาต่อกันแล้วล้นไปทับคอลัมน์ถัดไป */
  +S+' tr.ck-row td.pcs-nm>div{display:block !important;margin:1px 0 0 0 !important;'
    +'max-width:224px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}'
  +S+' td.pcs-nm .ck-lead{max-width:224px}'
  /* §pckName3 · ชื่อที่กางออกมาต้องตัวเท่าชื่อหัวใบ · เป็นผู้โดยสารเหมือนกัน ไม่ใช่หมายเหตุ
     ต้องประกาศหลังกฎ td.pcs-nm>div ข้างบน (specificity เท่ากัน · ตัวหลังชนะ) */
  +S+' td.pcs-nm .pck-gsub{font-size:11.5px;line-height:1.35;color:#3C3B37;'
    +'font-weight:600;padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  /* เพดานความสูงของกล่องรายชื่อ · 4 บรรทัด แล้วเลื่อนเอาในกล่อง */
  +S+' tr.ck-row td.pcs-nm>div.pck-gsubs{display:block !important;max-width:none;'
    +'margin:1px 0 0 0 !important;overflow:visible;white-space:normal}'
  +S+' td.pcs-nm .pck-gsubs.scr{max-height:63px;overflow-y:auto;overscroll-behavior:contain;'
    +'cursor:default;border-left:2px solid #E7E4DC;padding-left:3px}'
  +S+' td.pcs-nm .pck-gsubs.scr::-webkit-scrollbar{width:5px}'
  +S+' td.pcs-nm .pck-gsubs.scr::-webkit-scrollbar-thumb{background:#CFCBC0;border-radius:3px}'
  /* §pckMid · ช่องชื่อจัดกลางแนวตั้งเหมือนช่องอื่นทั้งแถว
     เคยจับขอบบนไว้กันชื่อขยับตอนกางชื่อ แต่ผลคือแถวที่ยังไม่ได้กด (เกือบทั้งตาราง)
     ชื่อไปเกาะขอบบนแล้วเหลือที่ว่างข้างล่าง ทั้งตารางดูโหว่และไม่ตรงกับช่องอื่น
     ส่วนเรื่องขยับ ตัวที่แก้จริงคือ pckNamesToggle ที่ตรึงแถวที่กดไว้กับที่บนจอแล้ว
     แถวจะสูงขึ้นเฉพาะตอนกดกางชื่อเท่านั้น */
  +S+' tr.ck-row>td.pcs-nm{vertical-align:middle}'
  +S+' tr.ck-row td.pcs-nm>div.pck-hd{display:flex !important;align-items:center;gap:6px;'
    +'max-width:none;overflow:visible}'
  +S+' .pck-hd .ck-lead{flex:0 1 auto;min-width:0;max-width:none;overflow:hidden;'
    +'text-overflow:ellipsis;white-space:nowrap}'
  +S+' .pck-hd .ck-tel{flex:none;margin:0 !important}'
  /* ช่อง Agency · ให้สีเต็มช่องจริง ๆ ทั้งสูงและกว้าง td ยืดตามแถวไม่ได้ ต้องวางทับด้วย absolute */
  +S+' td.pcs-ag{position:relative}'
  +S+' tr.ck-row td.pcs-ag>*{position:absolute;inset:0;display:flex !important;'
    +'width:auto !important;height:auto !important;min-height:0;margin:0 !important}'
  /* ตอนปลดล็อกปุ่มจะครบชุดและยาวเกินช่อง · ให้ตกบรรทัดสองแทนที่จะโดนตัดหาย
     nowrap เดิมคือต้นเหตุที่ปุ่ม + กับปุ่มเช็คอินหลุดออกนอกช่องจนกดไม่ได้ */
  +S+' .pck-acts{display:flex !important;flex-wrap:wrap !important;align-items:center;'
    +'gap:4px;margin:0 !important;justify-content:flex-end}'
  +S+' .pck-mgedit{border:1px solid #D8D4CA;background:#fff;color:#6b6a63;border-radius:999px;'
    +'padding:3px 9px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}'
  +S+' .pck-mgedit:hover{border-color:#A32D2D;color:#A32D2D}'
  +S+' .pck-mgedit.on{background:#FDF6E6;border-color:#E3C77A;color:#7A4A00}'
  /* §pckMgTight · ตัวเลขกับปุ่มเหตุการณ์ซ้อนกันเป็นคอลัมน์เดียว ปุ่มจึงไม่กินความกว้าง */
  +S+' .pcs-numcol{display:inline-flex;flex-direction:column;align-items:stretch;gap:3px;flex:none}'
  +S+' .pcs-evs{display:flex;gap:4px;justify-content:center}'
  +S+' .pcs-numcol .ck-stp{justify-content:space-between}'
  +S+' .ck-ev.ico{width:26px;height:20px;padding:0 !important;font-size:12px !important;line-height:1;'
    +'display:inline-flex;align-items:center;justify-content:center;flex:none}'
  /* ตัวเลขเป็น ขึ้นเรือ/จอง · ตัวหารตัวเล็กและจางกว่า จะได้ไม่แย่งสายตากับตัวที่ต้องกด */
  +S+' .ck-stp .ck-n i{font-style:normal;font-size:.82em;opacity:.5;margin-left:1px}'
  +S+' .pck-ok.ico{padding:0 !important;min-width:34px;height:26px;border-radius:999px;'
    +'display:inline-flex;align-items:center;justify-content:center;gap:3px;font-size:14px;flex:none}'
  +S+' .pck-ok.ico .tm{font-family:\'DM Mono\',monospace;font-size:9.5px;font-weight:700}'
  +S+' .pck-mgedit.ico{width:24px;height:22px;padding:0;font-size:11px;display:inline-flex;'
    +'align-items:center;justify-content:center;flex:none}'
  +S+' .pck-go{border:1px solid #D8D4CA;background:#fff;color:#6b6a63;border-radius:50%;'
    +'width:22px;height:22px;padding:0;font-size:15px;font-weight:800;line-height:1;cursor:pointer;'
    +'font-family:inherit;display:inline-flex;align-items:center;justify-content:center;flex:none}'
  +S+' .pck-go:hover{border-color:#185FA5;color:#185FA5}'
  /* ทั้งช่องชื่อกดกางได้ · ต้องมีสัญญาณว่ากดได้ ไม่งั้นไม่มีใครรู้ */
  +S+' td.pcs-nm[data-more]{cursor:pointer}'
  +S+' td.pcs-nm[data-more]:hover{background:#F7F5EF !important}'
  /* ตัวเลขคนขึ้นเรือของแถวที่ล็อก · อ่านได้แต่กดไม่ได้ ไม่ทำให้ดูเหมือนปุ่ม */
  +S+' .ck-stp.lk{border:0;background:none;padding:0 4px;min-width:26px;text-align:center}'
  +S+' .ck-stp.lk .ck-n{color:#6b6a63}'
  +S+' .pck-acts .ck-stp button{width:20px;height:20px;font-size:12px}'
  +S+' .pck-acts .ck-ev{font-size:9px;padding:1px 6px}'
  +S+' .pck-acts .pck-ok{padding:3px 10px;font-size:10px}'
  +S+' .pck-acts button{white-space:nowrap}'
  +S+' .pck-paychips{display:inline-flex !important;gap:3px;flex-wrap:nowrap}'
  /* ── สีแถวมีแค่ 2 แบบ · ไม่มีสี กับ สีสายรัดของลำนั้น ── */
  +S+' tbody.pcs-set tr.ck-row.ck-done>td{background:var(--wbbg) !important}'
  +S+' tbody.pcs-set tr.ck-row.ck-done>td:first-child{box-shadow:inset 5px 0 0 var(--wb) !important}'
  /* No-show / CXL ที่มาจากเช็คอินรถ · ลายทแยงจาง ๆ = ใบนี้ถูกปิดไปแล้ว
     ไม่ใช้พื้นทึบ กติกาสีพื้นจะได้ยังเหลือ 2 แบบ */
  +S+' tr.ck-row.pck-rvoid>td{background:repeating-linear-gradient(135deg,#FBEEED 0 7px,#fff 7px 14px) !important}'
  +S+' tr.ck-row.pck-rvoid>td:first-child{box-shadow:inset 5px 0 0 #D9534F !important}'
  /* ── แถบหัวกลุ่ม ── */
  +S+' tr.pcs-g1>td{background:var(--bg);color:var(--ink);height:36px;padding:0 10px 0 14px;'
    +'border-top:2px solid var(--edge);border-bottom:1px solid var(--edge);'
    +'border-left:6px solid var(--edge)}'
  +S+' tr.pcs-g2>td{background:#FAFBFC;color:#5F5E5A;height:28px;padding:0 10px 0 26px;'
    +'border-bottom:1px solid #E4E7EC;border-left:6px solid transparent}'
  +S+' tr.pcs-g1.cold>td>div,'+S+' tr.pcs-g2.cold>td>div{filter:grayscale(1);opacity:.7}'
  +S+' tr.pcs-g1:hover>td>div,'+S+' tr.pcs-g2:hover>td>div{filter:none;opacity:1}'
  /* ช่องหัวกลุ่มกว้างเท่าตารางทั้งใบ ตรึงตัว td เองไม่ได้ ต้องตรึงกล่องข้างใน */
  +S+' tr.pcs-g1>td .pcs-w,'+S+' tr.pcs-g2>td .pcs-w{display:flex;align-items:center;gap:10px;'
    +'position:sticky;left:0;width:-moz-fit-content;width:fit-content;max-width:100%}'
  /* §gvanJob2 · กล่องนอกเต็มแถว · มีไว้ให้ปุ่มขวามีที่ยืน */
  +S+' tr.pcs-g1>td>.pcs-row{display:flex;align-items:center;width:100%;gap:10px}'
  +'.pck-host .pcs-kind{font-size:9px;font-weight:800;letter-spacing:.06em;'
    +'text-transform:uppercase;opacity:.6}'
  +'.pck-host .pcs-pill{border-radius:99px;padding:3px 14px;font-size:12.5px;font-weight:800;white-space:nowrap}'
  +'.pck-host tr.pcs-g2 .pcs-pill{padding:1px 11px;font-size:11px}'
  +'.pck-host .pcs-sm{font-size:10.5px;opacity:.9;white-space:nowrap}'
  +'.pck-host .pcs-sm b{font-size:13px;font-weight:800}'
  +'.pck-host .pcs-due{background:#FBF0DD;color:#7A4A00;border-radius:7px;padding:1px 9px;'
    +'font-size:10.5px;font-weight:800;white-space:nowrap}'
  +'.pck-host .pcs-ok{background:#E1F5EE;color:#0F6E56;border-radius:7px;padding:1px 9px;'
    +'font-size:10px;font-weight:700;white-space:nowrap}'
  +'.pck-host .pcs-wb{display:inline-flex;align-items:center;gap:6px;background:#fff;'
    +'border:1px solid #D8DCE3;border-radius:7px;padding:1px 9px;font-size:10.5px;font-weight:700;'
    +'color:#3a3a36;white-space:nowrap}'
  +'.pck-host .pcs-wb i{width:13px;height:13px;border-radius:4px;display:inline-block;'
    +'border:1px solid rgba(0,0,0,.18)}'
  +'.pck-host .pcs-wb.none{background:#FBF3E6;border-color:#EBDCC2;color:#8A5B00}'
  +'.pck-host .pcs-inf{font-size:10px;color:#8a8a82;display:inline-flex;align-items:center;'
    +'gap:8px;white-space:nowrap}'
  +'.pck-host .pcs-inf b{font-size:8.5px;text-transform:uppercase;color:#a3a39b}'
  +'.pck-host .pcs-inf s{width:1px;height:10px;background:#dcdad3;display:inline-block;'
    +'text-decoration:none}'
  +'.pck-host .pcs-ckv{font-size:9.5px;font-weight:700;color:#a5a49d;background:#F1EFE8;'
    +'border-radius:6px;padding:1px 7px;white-space:nowrap}'
  +'.pck-host .pcs-ckv.full{color:#0F6E56;background:#E1F5EE}'
  /* §gvanHead · ป้ายบอกว่ากลุ่มรถนี้มีใบที่แยกขึ้นหลายคัน */
  +'.pck-host .pcs-vsp{font-size:9.5px;font-weight:700;color:#4A2E86;background:#F4E8FB;'
    +'border:1px solid #D9CFF2;border-radius:6px;padding:1px 7px;white-space:nowrap}'
  /* §gvanJob · ปุ่มใบงานไกด์ท้ายแถบหัวลำ · ชิดขวาสุดตรงเลนคอลัมน์ "การจัดการ" */
  +'.pck-host .pcs-job{margin-left:auto;flex:none;position:sticky;right:6px;'
    +'display:inline-flex;align-items:center;gap:5px;'
    +'border:1.5px solid #C9C6BE;background:#fff;color:#4a4a44;border-radius:8px;'
    +'padding:3px 10px;font:700 10.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}'
  +'.pck-host .pcs-job:hover{border-color:#1A1A1A;background:#1A1A1A;color:#fff}'
  +'@media print{.pck-host .pcs-job{display:none}}';
}
function pckScrollSave(host){
  var w=host&&host.querySelector('.pcs-tw');
  _pckScr={ l:w?w.scrollLeft:0, t:w?w.scrollTop:0,
            y:(window.pageYOffset||document.documentElement.scrollTop||0) };
}
function pckScrollRestore(host){
  var m=_pckScr; _pckScr=null;
  if(!m) return;
  var apply=function(){
    var w=document.querySelector('.pck-host .pcs-tw');
    if(w){ if(m.l && w.scrollLeft!==m.l) w.scrollLeft=m.l;
           if(m.t && w.scrollTop!==m.t) w.scrollTop=m.t; }
    if(m.y && (window.pageYOffset||document.documentElement.scrollTop||0)!==m.y) window.scrollTo(0,m.y);
  };
  apply();
  /* กล่องเพิ่งถูกสร้างใหม่ ความสูงอาจยังไม่นิ่งในเฟรมนี้ · ค่าที่ตั้งไปจะโดนบีบเงียบ ๆ */
  if(window.requestAnimationFrame) requestAnimationFrame(apply);
}
function mvPersist(){
  try{
    /* ต้องผ่านแคชกลางเหมือนโมดูลอื่น · อ่าน-เขียน localStorage ดิบจะทับงานที่โมดูลอื่นเพิ่งเขียน */
    var d = (typeof laBlob === 'function') ? laBlob() : null;
    if(!d){
      var K = (typeof LS_KEY !== 'undefined' ? LS_KEY : 'loveandaman_v2');
      d = JSON.parse(localStorage.getItem(K) || '{}');
    }
    d.meal_venues = MEAL_VENUES;
    if(typeof laBlobSave === 'function') laBlobSave();
    else localStorage.setItem((typeof LS_KEY !== 'undefined' ? LS_KEY : 'loveandaman_v2'), JSON.stringify(d));
  }catch(e){ console.warn('[meal] persist failed', e); }
}
function mvList(){ return (MEAL_VENUES || []).filter(function(v){ return v && v.active !== false; }); }
function mvGet(id){ return (MEAL_VENUES || []).filter(function(v){ return v.id === id; })[0] || null; }
function mvName(id){ var v = mvGet(id); return v ? (v.name || v.id) : ''; }
/* ร้านของทริปหนึ่ง · ค่าเริ่มต้นมาจากเส้นทาง · ตอนนี้ยังไม่มีตัวแก้รายลำ (ก้อนถัดไป) */
function mvForRoute(routeId){
  var r = (typeof getRoute === 'function') ? getRoute(routeId) : null;
  return (r && r.mealVenueId) ? mvGet(r.mealVenueId) : null;
}
/* §mealTrip · ร้านของทริปหนึ่ง · ที่ตั้งไว้รายลำมาก่อนร้านประจำเส้นทางเสมอ
   '-' = วันนี้ลำนี้ไม่มีอาหาร · ต่างจาก '' ที่แปลว่ายังไม่ได้ตั้งอะไร ให้ใช้ของเส้นทาง */
function mvTripRaw(date, bid){
  try{ var J=(typeof pjOf==='function')?pjOf(date,bid):null; return J?String(J.mv||''):''; }catch(_){ return ''; }
}
function mvForTrip(date, bid, routeId){
  var m=mvTripRaw(date,bid);
  if(m==='-') return null;
  if(m) return mvGet(m);
  return mvForRoute(routeId);
}
/* ค่าอาหารของหัวชุดหนึ่ง · เด็กคิดราคาเด็ก · ไม่มีร้าน = ไม่มีค่าอาหาร ไม่ใช่ราคา 0 บาทแบบเงียบ ๆ */
function mvCost(venue, nAd, nCh){
  if(!venue) return null;
  return (+venue.priceAd || 0) * (+nAd || 0) + (+venue.priceCh || 0) * (+nCh || 0);
}
function mvAdd(){
  MEAL_VENUES.push({ id:'mv' + Math.random().toString(36).slice(2, 8), name:'', place:'',
                     priceAd:280, priceCh:180, phone:'', eta:'', note:'', active:true });
  mvPersist(); ctRender();
}
function mvSet(id, f, v){
  var x = mvGet(id); if(!x) return;
  x[f] = (f === 'priceAd' || f === 'priceCh') ? (+v || 0) : String(v == null ? '' : v).slice(0, 80);
  mvPersist();
  if(f !== 'name' && f !== 'place' && f !== 'phone' && f !== 'eta') ctRender();   /* พิมพ์อยู่ ไม่วาดใหม่ให้หลุดโฟกัส */
}
function mvToggle(id){ var x = mvGet(id); if(!x) return; x.active = (x.active === false); mvPersist(); ctRender(); }
function mvRouteSet(rid, vid){
  var r = (typeof getRoute === 'function') ? getRoute(rid) : null; if(!r) return;
  r.mealVenueId = vid || '';
  if(typeof save === 'function') save();
  ctRender();
}
