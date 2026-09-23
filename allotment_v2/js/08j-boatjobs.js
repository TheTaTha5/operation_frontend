// 08j-boatjobs.js · Boat job sheet (ใบงานเรือ · pier crew / guides / programs per boat per day)
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

/* §pjModule (2026-09-23) · this whole file is one function scope. Everything declared in it is
   private to the boat job sheet unless it is listed in the export block at the bottom — that list
   is the complete set of names any other script (or UI test) uses. Deliberately NOT reindented,
   so blame and diffs stay readable. Sloppy mode on purpose, same as before the wrap.
   Adding a function another file needs: add it to the export block, or it is undefined there. */
(function(){
/* §pjAct (2026-09-23) · this screen's event handlers · no inline on*="…" in its markup any more.
   The markup says what should happen (data-on-click="slotDrop" data-a-bid="b3" data-a-slot="cap"),
   laDelegate (08-app.js) finds the action here and calls it with (element, event). Arguments come
   back from data-a-* as strings, so numeric ones are converted with + where the function expects a
   number — exactly what the inline code passed. pjOn() builds the attributes and HTML-escapes
   every value. Converted with tools/handler-map.mjs: every handler element calls the same function
   with the same arguments, stops propagation the same way, and a 200-step real-click replay leaves
   the same data and the same screen. */
function pjOn(ev, act, args){
  var s=' data-on-'+ev+'="'+act+'"';
  if(args) for(var k in args) s+=' data-a-'+k+'="'+poE(String(args[k]))+'"';
  return s;
}
const PJ_ACTIONS = {
  // ── keys / propagation ──
  lbKey: function(el, e){   // editable slot label · Enter keeps, Escape restores the saved text
    if(e.key==='Enter'){ e.preventDefault(); el.blur(); }
    if(e.key==='Escape'){ el.textContent=el.dataset.o; el.blur(); }
  },
  enterBlur: function(el, e){ if(e.key==='Enter'){ e.preventDefault(); el.blur(); } },
  stop: function(el, e){ e.stopPropagation(); },   // colour inputs inside a popup must not close it
  // ── blur ──
  slotLb:  function(el){ var d=el.dataset; pjSlotLbSet(d.aKind, d.aSlot, el.textContent, d.aDef, d.aBid); },
  note:    function(el){ pjNote(el.dataset.aBid, el.innerText); },
  // ── change ──
  pick:     function(el){ pjPick(el.dataset.aBid, el.dataset.aSlot, el.value); },
  freePick: function(el){ pjFreePick(el.dataset.aBid, el.dataset.aSlot, el); },
  gdPick:   function(el){ var d=el.dataset; pjGdPick(d.aBid, d.aKind, +d.aIdx, el.value); },
  wcSet:    function(el){ pjWcSet(el.dataset.aBid, el.value); },
  progColorPick: function(el){ pjProgColor(el.dataset.aRid, el.value); },
  stColorPick:   function(el){ pjStColor(el.dataset.aK, el.value); },
  mvSet:    function(el){ pjMvSet(el.dataset.aBid, el.value); },
  mjPick:   function(el){ pjMjPick(el.dataset.aBid, el.value); },
  wbName:   function(el){ pjWbName(el.dataset.aBid, el.value); },
  wbCustom: function(el){ pjWbCustom(el.dataset.aBid, el.value); },
  date:     function(el){ pjDate(el.value); },
  // ── click ──
  slotDrop:   function(el){ pjSlotDrop(el.dataset.aBid, el.dataset.aSlot); },
  gdDrop:     function(el){ var d=el.dataset; pjGdDrop(d.aBid, d.aKind, +d.aIdx, +d.aOn); },
  popToggle:  function(el){ pjPopToggle(el.dataset.aId); },
  gdAddSlot:  function(el){ pjGdAddSlot(el.dataset.aBid, el.dataset.aKind); },
  progColor:  function(el){ pjProgColor(el.dataset.aRid, el.dataset.aC); },
  stColor:    function(el){ pjStColor(el.dataset.aK, el.dataset.aC); },
  stColorReset: function(el){ pjStColorReset(el.dataset.aK); },
  opDrop:     function(el){ pjOpDrop(el.dataset.aBid); },
  lockSet:    function(el){ pjLockSet(el.dataset.aBid, +el.dataset.aOn); },
  slotAdd:    function(el){ pjSlotAdd(el.dataset.aBid, el.dataset.aKind); },
  wbSet:      function(el){ var d=el.dataset; pjWbSet(d.aBid, d.aT, d.aC); },
  teamPull:   function(el){ pjTeamPull(el.dataset.aBid); },
  teamSave:   function(el){ pjTeamSave(el.dataset.aBid); },
  guideOpen:  function(el){ pjGuideOpen(el.dataset.aBid); },
  guideJob:   function(el){ pjGuideJob(el.dataset.aBid); },
  filter:     function(el){ pjFilter(el.dataset.aK); },
  go:         function(el){ pjGo(el.dataset.aK); },
  shift:      function(el){ pjShift(+el.dataset.aN); },
  today:      function(){ pjToday(); },
  toggleIdle: function(){ pjToggleIdle(); },
  copyYday:   function(el){ pjCopyYday(el.dataset.aPier); },
  wide:       function(el){ pjWide(+el.dataset.aN); },
  print:      function(){ pjPrint(); },
};

/* §crewPaper (2026-09-05) · ทีมเรือของลำนั้นวันนั้น · อ่านจากใบงานเรือที่เดียว
   ใบงานไกด์ไม่เคยบอกว่าใครลงเรือลำนี้เลย · ใบสั่งงานมัคคุเทศก์บอกแต่ "จำนวน"
   แก้คนในใบงานเรือแล้วกระดาษสองใบนี้ไม่ขยับตาม หน้าท่าจึงต้องเขียนชื่อทับเองทุกวัน
   คืนเป็นชื่อแยกตำแหน่ง · ยังไม่จัดใครเลย = คืนค่าว่าง ใบจะได้เว้นที่ให้เขียนมือเหมือนเดิม
   pjOf() คืนทีมประจำเรือให้เองเมื่อยังไม่เคยแตะใบของวันนั้น จึงไม่ว่างโดยไม่จำเป็น */
function pjCrewOf(date,bid){
  var out={cap:'',asst:'',crew:[],island:[],n:0};
  var nm=(typeof pjStaffName==='function')?pjStaffName:function(x){ return x||''; };
  var J=null; try{ J=(typeof pjOf==='function')?pjOf(date,bid):null; }catch(_){}
  if(!J) return out;
  out.cap  = J.cap  ? nm(J.cap)  : '';
  out.asst = J.asst ? nm(J.asst) : '';
  out.crew   = (J.crew  ||[]).filter(Boolean).map(nm);
  out.island = (J.island||[]).filter(Boolean).map(nm);
  out.n = (out.cap?1:0)+(out.asst?1:0)+out.crew.length;
  return out;
}
/* บรรทัดเดียวพร้อมป้ายตำแหน่ง · ใช้ทั้งหัวใบงานไกด์และช่องหมายเหตุของใบสั่งงาน
   ตำแหน่งใช้คำเดียวกับทะเบียนรายชื่อผู้เดินทาง (pckTravelCrew) สามใบจะได้เรียกเหมือนกัน */
function pjCrewLine(date,bid){
  var C=pjCrewOf(date,bid), p=[];
  if(C.cap)  p.push('กัปตัน '+C.cap);
  if(C.asst) p.push('ช่างเครื่อง '+C.asst);
  C.crew.forEach(function(n){ p.push('เด็กเรือ '+n); });
  return p.join(' · ');
}

function pjKey(d,b){ return String(d||'')+'::'+String(b||''); }
function pjRaw(d,b){ var o=PIER_JOB[pjKey(d,b)]; return (o&&typeof o==='object')?o:null; }
function pjTeam(b){ var t=PIER_TEAM[b]; return (t&&typeof t==='object')?t:{cap:'',asst:'',crew:[]}; }
/* ใบของวันนั้น · ถ้ายังไม่เคยแตะ ให้ยืมทีมประจำเรือมาแสดง (ยังไม่เขียนลง store) */
function pjOf(d,b){
  var o=pjRaw(d,b), T=pjTeam(b);
  /* §pjLock · lock ต้องอยู่ในรายการนี้ด้วย · ฟังก์ชันนี้คัดเฉพาะช่องที่รู้จัก
     ตกหล่นเมื่อไหร่ ล็อกจะหลุดทุกครั้งที่มีการบันทึกช่องอื่น */
  /* §mealTrip · mv (ร้านอาหารของลำนี้วันนี้) ต้องอยู่ในรายการนี้ด้วย ด้วยเหตุผลเดียวกับ lock */
  /* §pjWorkCode · wc = รหัสที่จะไปโผล่ในตารางการทำงานของทุกคนบนใบนี้
     ต้องอยู่ในรายการช่องที่รู้จัก ด้วยเหตุผลเดียวกับ lock/mv ไม่งั้นหลุดทุกครั้งที่บันทึกช่องอื่น */
  /* §pjLbScope · lb (ชื่อช่องที่ตั้งเองของลำนี้วันนี้) ต้องอยู่ในรายการนี้ด้วย
     ด้วยเหตุผลเดียวกับ lock/mv/wc — ตกหล่นเมื่อไหร่ ชื่อที่ตั้งไว้หลุดทุกครั้งที่บันทึกช่องอื่น */
  if(!o) return {cap:T.cap||'', asst:T.asst||'', crew:(T.crew||[]).slice(), island:[], note:'', wb:'', wbc:'', lock:0, mv:'', wc:'', lb:{}, _std:true};
  return {cap:o.cap||'', asst:o.asst||'', crew:Array.isArray(o.crew)?o.crew.slice():[],
          island:Array.isArray(o.island)?o.island.slice():[], note:o.note||'', wb:o.wb||'', wbc:o.wbc||'',
          lock:(o.lock?1:0), mv:(o.mv||''), wc:(o.wc||''),
          lb:(o.lb&&typeof o.lb==='object')?Object.assign({},o.lb):{}, _std:false};
}
function pjSet(d,b,patch){
  if(!poGuard()) return;
  var k=pjKey(d,b), cur=PIER_JOB[k]||pjOf(d,b);
  delete cur._std;
  Object.keys(patch).forEach(function(x){ cur[x]=patch[x]; });
  PIER_JOB[k]=cur; poPersist();
}
/* ต่างจากทีมประจำกี่คน · ใช้ติดป้าย SUB */
function pjSubList(d,b){
  var J=pjOf(d,b), T=pjTeam(b), out={};
  if(J.cap && T.cap && J.cap!==T.cap) out.cap=T.cap;
  if(J.asst && T.asst && J.asst!==T.asst) out.asst=T.asst;
  (J.crew||[]).forEach(function(id,i){ var t=(T.crew||[])[i]; if(id && t && id!==t) out['crew'+i]=t; });
  return out;
}
function pjSubN(d,b){ return Object.keys(pjSubList(d,b)).length; }
function pjStaffName(id){ if(!id) return ''; var s=(PIER_STAFF||[]).filter(function(x){ return x.id===id; })[0];
  return s ? ((s.name||s.nick||id)+(s.nick&&s.name?(' ('+s.nick+')'):'')) : id; }

/* ── ยอด ลค ของลำหนึ่ง · แยก AD/CHD/INF/FOC + ภาษาไกด์ ── */
function pjPax(date, boatId, pier){
  var out={ad:0,chd:0,inf:0,foc:0,n:0,langs:{}};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var rt=(typeof getRoute==='function')?getRoute(t.routeId):null; if(!rt||(rt.pier||'')!==pier) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId||'')!==boatId) return;
    var p=(typeof ckPaxBreak==='function')?ckPaxBreak(t.pax):{ad:0,chd:0,inf:0,foc:0};
    /* §pjPaxReal · เช็คอินแล้วใช้คนที่เดินทางจริง · ยังไม่เช็คอินคืนยอดจองเต็มอยู่แล้ว
       แหล่งเดียวกับทะเบียนรายชื่อผู้เดินทางและ Travel Summary · เลขสองใบจึงตรงกันเสมอ */
    if(typeof ckPaxLeft==='function'){
      p={ ad:ckPaxLeft(b,date,'ad',p.ad), chd:ckPaxLeft(b,date,'chd',p.chd),
          inf:ckPaxLeft(b,date,'inf',p.inf), foc:ckPaxLeft(b,date,'foc',p.foc) };
    }
    out.ad+=p.ad; out.chd+=p.chd; out.inf+=p.inf; out.foc+=p.foc;
    if(p.ad+p.chd+p.inf+p.foc>0) out.n++;      /* ทั้งใบไม่มาเลย ไม่ต้องนับเป็นใบบนเรือ */
    if(typeof pckGuideLangs==='function') pckGuideLangs(b).forEach(function(L){ out.langs[L]=1; });
  });
  return out;
}
function pjLangTH(code){
  var k=String(code||'').trim(); if(!k) return '';
  return PJ_LANG_TH[k.toUpperCase()] || k;
}
function pjPrep(date, boatId, pier){
  var out={ lang:{}, halal:0, veg:0, vegan:0, allerg:0, lt:0,
            booked:0, arrived:0, noShow:0, ckAny:false, lastPick:'', firstPick:'' };
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var rt=(typeof getRoute==='function')?getRoute(t.routeId):null; if(!rt||(rt.pier||'')!==pier) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId||'')!==boatId) return;

    var pax=0, pk=(typeof ckPaxBreak==='function')?ckPaxBreak(t.pax):{ad:0,chd:0,inf:0,foc:0};
    ['ad','chd','inf','foc'].forEach(function(k){ pax+=(+pk[k]||0); });

    /* ภาษาไกด์ · นับเป็นจำนวนคน ไม่ใช่แค่ว่ามีหรือไม่มี — ที่ท่าต้องรู้ว่าต้องจัดไกด์กี่คน */
    var g=b.guides||{};
    var add=function(code,q){ if(!code) return; out.lang[code]=(out.lang[code]||0)+q; };
    if(g.english) add('EN',pax);
    if(g.russian) add('RU',pax);
    if(g.chinese) add('CN',pax);
    if(String(g.otherLang||'').trim()) add(String(g.otherLang).trim(),pax);

    var sm=b.specialMeals||{};
    out.halal += (+sm.halal||0); out.veg += (+sm.veg||0); out.vegan += (+sm.vegan||0);
    if(typeof bkV2AllergyCount==='function'){ try{ out.allerg += (+bkV2AllergyCount(sm)||0); }catch(_){} }

    /* เรือหางยาว · ต่อหัวสำหรับ join · ลำสำหรับเหมา (นับเป็นหัวไม่ได้ จึงนับเฉพาะ join) */
    if(typeof bkV2AddOnFlags==='function'){
      try{ var F=bkV2AddOnFlags(b, t.routeId); if(F && F.join) out.lt += pax; }catch(_){}
    }
    if(typeof bkV2LongtailExtraPax==='function'){
      try{ out.lt += (+bkV2LongtailExtraPax(b.id, date)||0); }catch(_){}
    }

    /* เช็คอิน · ท่าเรือเป็นด่านสุดท้าย ถ้ายังไม่เช็คท่าก็ใช้ค่าจากรถ */
    if(typeof ckSummary==='function'){
      try{ var S=ckSummary(b,date);
        if(S){ out.booked += (+S.booked||0);
               out.noShow += (+S.noShow||0);
               if((S.pier&&S.pier.at)||(S.van&&S.van.at)) out.ckAny=true; }
      }catch(_){}
    }

    /* เวลารับของ booking นี้ · เอาช่วงท้ายสุดมาเทียบกับเวลาเรือออก */
    var tm=String((O.pickupTimeFinal||t.pickupTime||b.pickupTime||'')).trim();
    var mm=tm.match(/(\d{1,2}[:.]\d{2})\s*$/);
    if(mm){ var v=mm[1].replace('.',':');
      if(!out.lastPick || v>out.lastPick) out.lastPick=v;
      if(!out.firstPick || v<out.firstPick) out.firstPick=v; }
  });
  out.arrived = Math.max(0, out.booked - out.noShow);
  return out;
}

/* ไกด์ของลำนั้น · อ่านจากใบสั่งงานมัคคุเทศก์ที่มีอยู่แล้ว ไม่จัดซ้ำ
   §gdRole · Full = ทุกคนพร้อมภาษา/บทบาท · ตัวเดิมคืนเป็นสตริง ยังมีใบครัวใช้อยู่ */
function pjGuidesFull(date, boatId){
  try{
    var A=goAsn(date,boatId), G=goGuides();
    var out=(A.g||[]).map(function(id){
      var g=G.filter(function(x){ return x.id===id; })[0];
      if(!g) return { id:id, name:id, langs:[], role:'guide', guide:true };
      return { id:id, name:(g.name||'')+(g.nick?(' ('+g.nick+')'):''),
               langs:goLangsOf(g), role:goRoleOf(g), guide:goIsGuide(g) };
    });
    out.other=(+A.other||0);
    return out;
  }catch(_){ var z=[]; z.other=0; return z; }
}
function pjGuides(date, boatId){
  return pjGuidesFull(date, boatId).map(function(x){ return x.name; });
}
/* §pjDocAlways · ผสมสีเข้าหาเทา · ใช้กับหัวการ์ดของลำที่ไม่ได้ออก
   ทำที่ตอนสร้าง HTML ไม่ใช่ CSS filter · ลูกในการ์ดจะได้ไม่โดนลดสีตามไปด้วย */
function pjMute(hex, amt){
  var h=String(hex||'').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h)) return '#8B93A1';
  var t=[0x8B,0x93,0xA1], k=(amt==null?0.62:amt), o='#';
  for(var i=0;i<3;i++){
    var v=parseInt(h.substr(i*2,2),16);
    var m=Math.round(v+(t[i]-v)*k);
    o+=('0'+Math.max(0,Math.min(255,m)).toString(16)).slice(-2);
  }
  return o;
}
/* §pjAll · สถานะของเรือ ณ วันหนึ่ง · อ่านจากของที่มีอยู่แล้วทั้งหมด */
function pjLogAt(boat, date){
  var L=((boat&&boat.log)||[]).filter(function(e){ return e && e.from<=date && (!e.to || e.to>=date); });
  L.sort(function(a,b){ return String(b.from||'').localeCompare(String(a.from||'')); });
  return L[0]||null;
}
function pjOpenJobs(bid){
  try{ return (typeof FL_MAINT!=='undefined'?FL_MAINT:[]).filter(function(m){
    return m && m.boatId===bid && ['open','inprogress','pending'].indexOf(String(m.status||''))>=0; }); }
  catch(_){ return []; }
}
function pjGrp(k){ var m=PJ_ST[k]; return (m&&m.grp)||'down'; }
/* §pjStColor · สีแถบของลำที่ไม่มีโปรแกรม · แต้มเองได้ ถอยไปสีมาตรฐานของสถานะได้ */
function pjBand(k){
  try{ var c=PIER_CFG && PIER_CFG.stBand && PIER_CFG.stBand[k]; if(c) return c; }catch(_){}
  var m=PJ_ST[k]; return (m&&m.band)||'#8B93A1';
}
function pjStIsCustom(k){ try{ return !!(PIER_CFG && PIER_CFG.stBand && PIER_CFG.stBand[k]); }catch(_){ return false; } }
function pjStColor(k, hex){
  if(!poGuard()) return;
  if(!PIER_CFG.stBand) PIER_CFG.stBand={};
  PIER_CFG.stBand[k]=hex;
  poPersist(); renderPierJob();
  if(window.event) window.event.stopPropagation();
}
function pjStColorReset(k){
  if(!poGuard()) return;
  try{ if(PIER_CFG.stBand) delete PIER_CFG.stBand[k]; }catch(_){}
  poPersist(); renderPierJob();
  if(window.event) window.event.stopPropagation();
}
/* §pjWork · ประเภทของงานซ่อมที่เปิดอยู่ · corrective = เสีย · scheduled/preventive = ตามแผน */
function pjMjPlanned(m){ return /^(scheduled|preventive|planned)$/i.test(String((m&&m.type)||'')); }
function pjBoatSt(date, boat, op){
  var st=pjLogAt(boat,date), s=st?String(st.s||''):'';
  /* §chWin · กติกาเดียวกับ getCurStatus · เรือเช่าที่ไม่มีช่วงคลุมวันนั้น = ไม่มีเรือ
     ตรงนี้ต้องเขียนซ้ำเพราะหน้านี้อ่าน log เอง (pjLogAt) ไม่ได้ผ่าน getCurStatus */
  var _noCh=false;
  if(!st && String((boat&&boat.ownership)||'')==='charter'){ s='unavailable'; _noCh=true; }
  var mj=pjOpenJobs(boat&&boat.id);
  /* §ovnSpan · ลำนี้ติดใบเหมาค้างเกาะอยู่ในวันนี้หรือเปล่า · และวันนี้เป็นวันออกไหม */
  var _ovnH=null; try{ _ovnH=(typeof bkOvnHoldOn==='function')?bkOvnHoldOn(boat&&boat.id,date):null; }catch(_){}
  /* §ovnRet · "ระหว่างทาง" คือวันที่เรืออยู่ที่เกาะจริง ๆ คือ หลังวันออก แต่ก่อนวันกลับ
     วันกลับเรือวิ่งจริง มีคนอยู่บนนั้นจริง และกินข้าวกลางวันกลับมาจริง
     เดิมนับวันกลับเป็น วันระหว่างทางด้วย ใบงานเรือจึงซ่อนบล็อกครัวทั้งก้อน (ไม่มีที่ระบุร้าน)
     และขึ้น "⚠ โปรแกรมค้าง" ทั้งที่โปรแกรมนั้นถูก · Daily log กับ Boat Status นับเป็นวันออกอยู่แล้ว */
  var _ovnAny=!!_ovnH, _ovnMid=!!(_ovnH && _ovnH.from!==date && _ovnH.to!==date);
  var rsn=String((st&&st.reason)||'').toLowerCase();
  // เหตุผลอาจอยู่ที่ log หรือที่ MJ ที่สั่งให้เรือหยุด · ดูทั้งสองที่
  if(!rsn) mj.forEach(function(m){ if(!rsn && m.boatStatusReason) rsn=String(m.boatStatusReason).toLowerCase(); });
  /* §pjStWin · สถานะจริงมาก่อน · โปรแกรมที่ค้างบนกระดานไม่ทำให้เรือกลายเป็นเรือที่วิ่ง */
  var k;
  if(/dry.?dock|คาน/.test(rsn)) k='dd';
  else if(/donor/.test(rsn)) k='donor';
  else if(s==='fixing' || s==='unavailable'){
    // มีงานเปิดอยู่ → แยกว่าเสียหรือตามแผน · ไม่มีงานเลย → บอกได้แค่ว่าไม่พร้อม
    if(mj.length) k = mj.every(pjMjPlanned) ? 'maint' : 'broke';
    else k = (s==='fixing') ? 'broke' : 'off';
  }
  else if(s && s!=='available') k='off';   // สถานะอื่นที่ไม่รู้จัก · ถือว่าใช้ไม่ได้ ปลอดภัยกว่าเดา
  /* §ovnSpan · วันที่อยู่ระหว่างกลางของใบเหมาค้างเกาะ · เรือไม่ได้ออกจากท่าวันนี้
     มันอยู่ที่เกาะมาตั้งแต่วันก่อน · ป้าย "ออกทริปวันนี้" ทำให้คนหน้าท่ารอเรือที่ไม่มา */
  else if(_ovnMid) k='ovn';
  else if(op) k='run';
  else if(_ovnAny) k='ovn';
  else k='idle';
  /* มีโปรแกรมบนกระดาน แต่ลำนี้ไม่ได้อยู่ในสถานะที่ออกได้ = แผนค้าง ยังไม่มีใครเอาออก */
  var stale=!!(op && k!=='run');
  return {k:k, stale:stale, log:st, s:s, mj:mj, reason:rsn, noCharter:_noCh,
          loc:(st&&st.loc)||'',
          note:_noCh ? 'ไม่ได้เช่าวันนี้' : ((st&&(st.note||st.reason))||'')};
}
/* MJ ที่เลือกไว้ว่าวันนี้ทำใบไหน · ไม่ได้เลือก = ใบแรกที่เปิดอยู่ */
function pjMjOf(date, bid, mjList){
  var o=pjRaw(date,bid), pick=o&&o.mj;
  var hit=(mjList||[]).filter(function(m){ return m.id===pick; })[0];
  return hit || (mjList||[])[0] || null;
}
function pjMjPick(bid, mjId){ pjSet(_poDate,bid,{mj:mjId||''}); renderPierJob(); }
/* §pjStWin · เอาแถวโปรแกรมที่ค้างออกจากกระดาน Boat Operation ของวันนั้น
   ต้องลบของจริงใน TRIPS ไม่ใช่แค่ซ่อนบนการ์ด · Trip P&L · Dashboard · Departures
   อ่าน TRIPS ตัวเดียวกันหมด ถ้าไม่ลบ เลขที่หน้าอื่นก็ยังนับลำนี้เป็นเรือที่ออกอยู่ดี
   ⚠ ถ้ายังมีใบจองผูกกับลำนี้อยู่ ห้ามลบเงียบ ๆ — ใบจองจะกลายเป็นไร้เรือ
     ต้องไปย้ายลำที่หน้า Booking ก่อน */
function pjOpDrop(bid){
  if(!poCanEdit()) return;
  var date=_poDate, day=(typeof TRIPS!=='undefined' && TRIPS[date])?TRIPS[date]:null;
  var op=day&&day[bid]; if(!op) return;
  var b=(typeof getBoat==='function')?getBoat(bid):null;
  var rt=(typeof getRoute==='function')?getRoute(op.route):null;
  var px=pjPax(date,bid,_poPier);
  if(px.n>0){
    alert('เอาโปรแกรมออกไม่ได้ · ยังมีใบจองผูกกับลำนี้อยู่ '+px.n+' ใบ ('+(px.ad+px.chd+px.inf+px.foc)+' คน)\n\n'
      +'ต้องไปย้ายลำให้ใบจองพวกนี้ที่หน้า Booking ก่อน ไม่งั้นใบจองจะกลายเป็นไม่มีเรือ');
    return;
  }
  if(!confirm('เอาโปรแกรมออกจากกระดานวันนี้?\n\n'
    +((b&&b.name)||bid)+' · '+((rt&&rt.name)||op.route||'—')+' · '+date+'\n\n'
    +'แถวนี้จะถูกลบออกจาก Boat Operation ของวันนั้น · ไม่มีใบจองผูกอยู่')) return;
  delete day[bid];
  if(!Object.keys(day).length) delete TRIPS[date];
  if(typeof save==='function') save('operations');
  renderPierJob();
  if(typeof flShowToast==='function') flShowToast('เอาโปรแกรมออกจากกระดานแล้ว');
}
/* โปรแกรมของลำนี้วันนั้น · ไม่สนว่าเป็นท่าไหน · ใช้จับเคส "ย้ายไปวิ่งท่าอื่น" */
function pjDayOp(date, bid){
  var day=(typeof TRIPS!=='undefined' && TRIPS[date])?TRIPS[date]:{};
  var op=day[bid]; if(!op || !op.route) return null;
  var rt=(typeof getRoute==='function')?getRoute(op.route):null;
  return rt?{op:op, rid:op.route, route:rt}:null;
}
/* §pjPierNow · ใบย้ายท่าที่ครอบคลุมวันนั้น · ไม่ใช่ "ที่ active วันนี้" */
function pjAsnAt(boat, date){
  var a=(boat && boat.assignments)||[];
  for(var i=0;i<a.length;i++){
    var x=a[i];
    if(x && x.status!=='cancelled' && x.startDate && x.endDate && x.startDate<=date && x.endDate>=date) return x;
  }
  return null;
}
/* ท่าที่รับผิดชอบเรือลำนี้ในวันนั้น
   ใช้ตัวตัดสินตัวเดียวกับหน้า Boat Status · 'shop' ไม่ใช่ท่า จึงถอยไปหาคนรับผิดชอบ */
function pjPierOf(boat, date){
  var cur='';
  try{ if(typeof getBoatCurrentPier==='function') cur=getBoatCurrentPier(boat, date)||''; }catch(_){}
  if(cur && cur!=='shop') return cur;
  var a=pjAsnAt(boat, date);
  return (a && a.toPier) || (boat && boat.pier) || '';
}
/* ทุกลำของท่านี้ · ลำที่มีโปรแกรมมาก่อน แล้วเรียงตามสถานะ */
function pjAllBoats(date, pier){
  var run=(typeof poBoats==='function')?poBoats(date,pier):[], out=[], seen={};
  run.forEach(function(B){ seen[B.bid]=1;
    B._st=pjBoatSt(date,B.boat,true); out.push(B); });
  (typeof BOATS!=='undefined'?BOATS:[]).forEach(function(b){
    // §pjPierNow · ถามตัวตัดสินเดียวกับ Boat Status · ไม่ใช่ b.pier ที่เป็นค่าคงที่
    if(pjPierOf(b,date)!==pier || seen[b.id]) return;
    var D=pjDayOp(date,b.id);
    var away=(D && (D.route.pier||'')!==pier) ? D : null;   // ย้ายไปวิ่งท่าอื่นวันนี้
    var st=pjBoatSt(date,b,false);
    // ไปวิ่งท่าอื่น ≠ ว่าง · ท่านี้ไม่มีงานให้ แต่เรือไม่ได้จอดเฉยๆ ต้องบอกให้ตรง
    if(away && st.k==='idle') st.k='away';
    var asn=pjAsnAt(b,date);
    var shop=''; try{ if(typeof getBoatCurrentPier==='function' && getBoatCurrentPier(b,date)==='shop'
                        && typeof getBoatShopLocation==='function') shop=getBoatShopLocation(b)||'อู่'; }catch(_){}
    out.push({bid:b.id, boat:b, rid:'', route:{}, dep:'', pax:0, bks:[],
              _st:st, _away:away, _asn:asn, _shop:shop});
  });
  /* §pjCharter · เรือเช่า วันไหนไม่ได้เช่า = วันนั้นไม่ใช่เรือของท่าเลย
     LKC66 เช่ามาวันเดียว (4 ก.ย. 69) แต่โผล่ทุกวันพร้อมหมายเหตุ "ไม่ได้เช่าวันนี้"
     กินคอลัมน์ในใบพิมพ์ และกินการ์ดเต็มใบบนหน้าจอ ทั้งที่ไม่มีใครต้องใช้
     ธง noCharter มีอยู่แล้วจาก §chWin ใน boatEffStatus · เอามาใช้ตรงนี้
     วันไหนเช่าจริงธงเป็น false ลำนี้กลับเข้ามาตามปกติ ไม่ได้ซ่อนถาวร
     กรองที่นี่ที่เดียว · หน้า Pier Job กับใบพิมพ์เรียกฟังก์ชันนี้ตัวเดียวกัน
     (หน้า Boat Operation ใช้เส้นทางของตัวเองใน 04-data-core ไม่กระทบ
      หน้านั้นตั้งใจไล่เรือทุกลำพร้อมเหตุผลอยู่แล้ว) */
  out=out.filter(function(B){ return !(B._st && B._st.noCharter); });

  out.sort(function(a,b){
    // ord ของ clash เป็น 0 · ใช้ ||9 ไม่ได้ เพราะ 0 เป็นค่าเท็จ แล้วจะเด้งไปท้ายสุด
    var _o=function(x){ var m=PJ_ST[x]; return (m&&m.ord!=null)?m.ord:9; };
    var oa=_o(a._st.k), ob=_o(b._st.k);
    if(oa!==ob) return oa-ob;
    return String(a.dep||'99').localeCompare(String(b.dep||'99'))
        || String(a.boat.name||a.bid).localeCompare(String(b.boat.name||b.bid));
  });
  return out;
}
function pjDocDays(from,to){
  if(!to) return null;
  try{ return Math.round((new Date(String(to)+'T12:00:00')-new Date(String(from)+'T12:00:00'))/86400000); }
  catch(_){ return null; }
}
function pjDocDate(d){
  if(!d) return '';
  try{ return new Date(String(d)+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}); }
  catch(_){ return String(d); }
}
/* ระดับของใบหนึ่งใบ · คืน {k, txt} · k ใช้เป็นชื่อคลาสสี */
function pjDocLv(doc, date){
  if(!doc) return {k:'none', txt:'ไม่มีใบในระบบ'};
  var left=pjDocDays(date, doc.exp);
  var renew=/process|renew|ยื่น|ต่ออายุ/i.test(String(doc.renewStatus||''));
  if(left==null) return {k:'none', txt:'ไม่ระบุวันหมดอายุ'};
  if(renew) return {k:'renew', txt:(left<0?('หมด '+pjDocDate(doc.exp)):(pjDocDate(doc.exp)))+' · กำลังต่ออายุ'};
  if(left<0)  return {k:'x',  txt:'หมด '+pjDocDate(doc.exp)+' · เกิน '+(-left)+' วัน'};
  if(left<=7) return {k:'d1', txt:pjDocDate(doc.exp)+' · เหลือ '+left+' วัน'};
  if(left<=30)return {k:'d2', txt:pjDocDate(doc.exp)+' · เหลือ '+left+' วัน'};
  if(left<=90)return {k:'d3', txt:pjDocDate(doc.exp)+' · เหลือ '+left+' วัน'};
  return {k:'d4', txt:pjDocDate(doc.exp)+' · เหลือ '+left+' วัน'};
}
/* §pjDocSrc · อ่านใบจากทะเบียนเดียวกับหน้า Company Asset › Documents
   ของเดิมเรียงตามวันหมดอายุแล้วหยิบใบแรก = ใบเก่าสุด · ลำที่ต่อใบแล้วจึงยังขึ้นแดง */
function pjDocFind(boat, typeId){
  if(typeof flDocCurrent==='function') return flDocCurrent(boat, typeId);
  return null;
}
/* ใบอุทยานที่โปรแกรมนี้ต้องใช้ · คืนได้หลายใบ (เส้นทางที่แวะหลายอุทยาน) */
function pjParkNeed(rt){
  var blob=String((rt&&rt.name)||'')+' '+String((rt&&rt.islands)||'');
  return PJ_PARK.filter(function(p){ return p.hit.test(blob); });
}
/* สองบรรทัดใต้ชื่อเรือ */
function pjDocsHtml(boat, rt, date){
  var line=function(lv, name, extra){
    return '<div class="pj-dl '+lv.k+'"><span class="nm">'+poE(name)+(extra||'')+'</span>'
      +'<span class="vl">'+poE(lv.txt)+'</span></div>';
  };
  var out='';
  // บรรทัด 1 · ใบอนุญาตใช้เรือ
  out+=line(pjDocLv(pjDocFind(boat,'lic'), date), 'ใบอนุญาตใช้เรือ', '');
  // บรรทัด 2 · ใบเข้าเกาะของโปรแกรมวันนี้
  var need=(rt&&rt.id)?pjParkNeed(rt):[];
  if(!rt || !rt.id){
    // §pjDocAlways · ไม่ได้ออกทริป ก็ยังต้องเตือนใบเข้าเกาะ
    //   ไม่มีโปรแกรมให้ยึด จึงโชว์ใบที่ "แย่ที่สุดที่เรือลำนี้ถืออยู่"
    //   ลำที่จอดคือลำที่มีเวลาไปต่อใบ ยิ่งต้องเห็นก่อนถึงคิววิ่ง
    var RANK0={x:0,none:1,d1:2,renew:3,d2:4,d3:5,d4:6};
    var held=PJ_PARK.map(function(p){ var d=pjDocFind(boat,p.doc); if(!d) return null;
        var lv=pjDocLv(d,date); lv._t=p.t; return lv; }).filter(Boolean);
    if(!held.length){
      out+='<div class="pj-dl none"><span class="nm">ใบเข้าเกาะ</span>'
         +'<span class="vl">ไม่มีใบในระบบ</span></div>';
    } else {
      held.sort(function(a,b){ return (RANK0[a.k]||9)-(RANK0[b.k]||9); });
      var w0=held[0];
      out+=line(w0, 'ใบอนุญาต '+w0._t, (held.length>1?('<span class="pj-dmore">+'+(held.length-1)+'</span>'):''));
    }
  } else if(!need.length){
    out+='<div class="pj-dl none"><span class="nm">ใบเข้าเกาะ</span>'
       +'<span class="vl">โปรแกรมนี้ไม่ต้องใช้ใบอุทยาน</span></div>';
  } else {
    // หลายใบ → เอาใบที่แย่ที่สุดขึ้นบรรทัด แล้วบอกจำนวนที่เหลือ
    var RANK={x:0,none:1,d1:2,renew:3,d2:4,d3:5,d4:6};
    var all=need.map(function(p){ var lv=pjDocLv(pjDocFind(boat,p.doc), date); lv._t=p.t; return lv; });
    all.sort(function(a,b){ return (RANK[a.k]||9)-(RANK[b.k]||9); });
    var w=all[0];
    out+=line(w, 'ใบอนุญาต '+w._t, (all.length>1?('<span class="pj-dmore">+'+(all.length-1)+'</span>'):''));
  }
  return '<div class="pj-docs">'+out+'</div>';
}
function pjMvCol(id){
  var k=String(id||''); if(!k) return ['#9BA3B0','#F4F5F8'];
  var n=0; for(var i=0;i<k.length;i++) n=(n*31+k.charCodeAt(i))%997;
  return PJ_MV_PAL[n%PJ_MV_PAL.length];
}

function pjCSS(){
  var H='.pj-host';
  return H+'{font-family:"Sarabun","DM Sans",sans-serif;color:#242730}'
  +H+' .pj-h{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}'
  +H+' .pj-h h1{font-size:23px;font-weight:800;letter-spacing:-.01em;margin:0}'
  +H+' .pj-h .lab{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9BA3B0;margin-bottom:2px}'
  +H+' .pj-h p{font-size:12.5px;color:#6E7684;margin:3px 0 0;line-height:1.6}'
  +H+' .pj-bar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid #E1E4EA;border-radius:12px;padding:9px 12px;margin-bottom:14px}'
  +H+' .pj-bar input[type=date]{border:1px solid #D9DDE4;border-radius:8px;padding:6px 9px;font:600 13px inherit;color:#242730}'
  +H+' .pj-bar button{border:1px solid #D9DDE4;background:#fff;border-radius:8px;padding:6px 12px;font:700 12px inherit;color:#5A6270;cursor:pointer}'
  +H+' .pj-bar button:hover{border-color:#16265C;color:#16265C}'
  +H+' .pj-bar button.pri{background:#16265C;border-color:#16265C;color:#fff}'
  +H+' .pj-bar button.gh{background:#F0F6F3;border-color:#BFE0CD;color:#0F6E56}'
  /* §pjDocs · แถวเดียว เลื่อนแนวนอน · ทุกใบสูงเท่ากันและบรรทัดตรงกัน */
  +H+' .pj-strip{display:flex;gap:15px;align-items:stretch;overflow-x:auto;padding:2px 2px 14px}'
  +H+' .pj-strip::-webkit-scrollbar{height:9px}'
  +H+' .pj-strip::-webkit-scrollbar-track{background:#E4E3DE;border-radius:6px}'
  +H+' .pj-strip::-webkit-scrollbar-thumb{background:#B9BDC5;border-radius:6px}'
  +H+' .pj-strip.w3 .bc{flex:0 0 clamp(310px,31.4%,470px)}'
  +H+' .pj-strip.w4 .bc{flex:0 0 clamp(292px,23.5%,400px)}'
  +H+' .pj-strip.w5 .bc{flex:0 0 clamp(276px,18.6%,344px)}'
  +H+' .pj-wsw{display:flex;gap:4px;background:#fff;border:1px solid #E1E4EA;border-radius:9px;padding:3px}'
  +H+' .pj-wsw button{border:none;background:transparent;border-radius:6px;padding:4px 10px;font:700 11.5px inherit;color:#6E7684;cursor:pointer}'
  +H+' .pj-wsw button.on{background:#EAF0F9;color:#1B4A87}'
  /* §pjDocAlways · ลำที่ไม่ได้ออกใช้สีหัวการ์ดที่ผสมให้จางแล้วตั้งแต่ตอนสร้าง HTML
     ห้ามใช้ CSS filter · filter กินลูกทุกตัว บรรทัดใบอนุญาตจะโดนลดสีไปด้วย
     ใบหมดอายุต้องแดงเสมอ ไม่ว่าวันนั้นเรือจะออกหรือไม่ */
  +H+' .bc.dim .bn{opacity:.92}'
  /* §pjLock · ใบที่ยืนยันแล้ว · ขอบเขียวบาง ๆ พอให้กวาดตาเห็นว่าใบไหนปิดแล้ว */
  +H+' .bc.lk{border-color:#BFE0CD;box-shadow:0 0 0 2px rgba(15,110,86,.09)}'
  +H+' .pj-lock{display:inline-flex;align-items:center;gap:5px;font-size:9.5px;font-weight:800;border-radius:5px;'
     +'padding:2px 8px;background:#E1F5EE;color:#0F6E56;white-space:nowrap}'
  /* ช่องที่ล็อกแล้วต้องอ่านเหมือนใบงานที่พิมพ์ไว้ · ไม่ใช่ช่องเลือกที่สีจาง */
  +H+' .pj-rw select:disabled{-webkit-appearance:none;appearance:none;padding-right:7px;'
     +'color:#242730;opacity:1;-webkit-text-fill-color:#242730;cursor:default}'
  +H+' .bc .foot button.done{background:#0F6E56;border-color:#0F6E56;color:#fff}'
  +H+' .bc .foot button.done:hover{background:#0B5744;border-color:#0B5744;color:#fff}'
  +H+' .bc .foot button.edit{background:#FFF6E5;border-color:#EFD9AE;color:#8A5A00}'
  +H+' .bc .foot button.edit:hover{background:#FBEDD3;border-color:#E3C88F;color:#7A4E00}'
  /* §pjStWin · การ์ดที่มีแผนค้าง · ขอบเตือนแต่ไม่เปลี่ยนสีสถานะ · สถานะยังเป็นซ่อม/ไม่พร้อมตามจริง */
  +H+' .bc.stale{border-color:#E8B4AE;box-shadow:0 0 0 2px rgba(192,39,28,.10)}'
  /* §pjStaleFit · แถบสถานะสูง 32px ตายตัว และตัดส่วนที่เกินทิ้ง
     บนการ์ดแคบ (292px ที่จอ 1440) ชิปสถานะ + ชิปเตือน + ปุ่ม ไม่มีทางอยู่ในแถวเดียว
     เฉพาะใบที่มีโปรแกรมค้างจึงยอมให้แถบนี้ห่อบรรทัดได้ · ใบอื่นสูงเท่าเดิมทุกใบ */
  +H+' .bc.stale .stbar{height:auto;min-height:32px;padding-top:4px;padding-bottom:4px;flex-wrap:wrap;row-gap:4px}'
  +H+' .bc.stale .stbar .stw{flex:1 1 100%;flex-wrap:wrap;overflow:visible;row-gap:4px}'
  +H+' .bc.stale .stbar > .pj-lb{margin-left:auto}'
  /* §pjStaleFit · ชิปนี้หดตัวได้ · min-width:0 กับ max-width:100% คือสองตัวที่ทำให้มันหดได้จริง
     (ค่าตั้งต้นของ flex item คือ min-width:auto ซึ่งแปลว่า "ห้ามหดต่ำกว่าเนื้อข้างใน")
     ตัวที่ยอมให้ตัดคือชื่อเส้นทาง (.t) · ปุ่มเอาออกต้องอยู่เสมอ flex:none */
  +H+' .pj-stale{display:inline-flex;align-items:center;gap:5px;background:#FCEFEE;color:#A0342A;'
    +'border:1px solid #F0CFCB;border-radius:999px;padding:2px 4px 2px 9px;font-size:10.5px;font-weight:700;'
    +'white-space:nowrap;min-width:0;max-width:100%;overflow:hidden}'
  +H+' .pj-stale .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +H+' .pj-stale button{flex:none;border:none;background:#A0342A;color:#fff;border-radius:999px;'
    +'padding:2px 9px;font:700 10px inherit;font-family:inherit;cursor:pointer}'
  +H+' .pj-stale button:hover{background:#7E2820}'
  +H+' .pj-stq{font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap}'
  +H+' .pj-stmeta{font-size:10px;color:#8B93A1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pj-chips{display:flex;gap:5px;background:#fff;border:1px solid #E1E4EA;border-radius:10px;padding:4px;flex-wrap:wrap}'
  +H+' .pj-chips button{border:none;background:transparent;border-radius:7px;padding:5px 11px;font:700 11.5px inherit;color:#6E7684;cursor:pointer;display:flex;align-items:center;gap:6px}'
  +H+' .pj-chips button.on{background:#16265C;color:#fff}'
  +H+' .pj-chips button i{width:7px;height:7px;border-radius:50%;display:inline-block;font-style:normal;flex:none}'
  +H+' .pj-chips button .n{font-variant-numeric:tabular-nums;font-size:11px;opacity:.72}'
  /* §pjHideIdle · ปุ่มสลับซ่อนลำที่ยังไม่วาง · อยู่คนละแกนกับชิปกลุ่ม
     จึงต้องหน้าตาไม่เหมือนกัน ไม่งั้นจะอ่านว่าเป็นตัวกรองกลุ่มอีกอัน */
  +H+' .pj-idlebtn{border:1px solid #E1E4EA;background:#fff;border-radius:10px;padding:7px 12px;'
     +'font:700 11.5px inherit;color:#6E7684;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}'
  +H+' .pj-idlebtn:hover{border-color:#C7CCD6}'
  +H+' .pj-idlebtn.on{background:#EEF1F6;border-color:#C7CCD6;color:#3C4553}'
  +H+' .pj-idlebtn .n{font-variant-numeric:tabular-nums;background:#16265C;color:#fff;'
     +'border-radius:999px;padding:1px 7px;font-size:10.5px}'
  +H+' .bc{display:flex;flex-direction:column;border:1px solid #E1E4EA;border-radius:13px;background:#fff;position:relative;overflow:hidden;box-shadow:0 1px 2px rgba(20,30,50,.04)}'
  +H+' .bc .top{padding:11px 15px 10px;color:#fff;display:block}'
  +H+' .bc .trow{display:flex;align-items:flex-start;gap:12px}'
  +H+' .bc .top .l{flex:1;min-width:0}'
  /* §pjDocs · สองบรรทัดใบอนุญาต ใต้ชื่อเรือ */
  +H+' .pj-docs{margin-top:9px;display:flex;flex-direction:column;gap:4px}'
  +H+' .pj-dl{border-radius:7px;padding:4px 9px;display:flex;align-items:center;gap:8px;font-size:10.5px;line-height:1.25;min-height:26px}'
  +H+' .pj-dl .nm{font-weight:800;white-space:nowrap;flex:none}'
  +H+' .pj-dl .vl{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}'
  +H+' .pj-dmore{font-weight:800;opacity:.7;margin-left:4px}'
  +H+' .pj-dl.x{background:#8E1E14;color:#fff}'
  +H+' .pj-dl.d1{background:#FCE4E1;color:#9B2B20;border:1px solid #F0BCB5}'
  +H+' .pj-dl.d2{background:#FBE9D4;color:#8A5000;border:1px solid #F0D4AC}'
  +H+' .pj-dl.d3{background:#FAF3DA;color:#7A6205;border:1px solid #EDE0AE}'
  +H+' .pj-dl.d4{background:#E9F4EE;color:#1D6A4C;border:1px solid #CDE6DA}'
  +H+' .pj-dl.renew{background:#E4EEF9;color:#17538F;border:1px solid #C3DBF2}'
  +H+' .pj-dl.none{background:rgba(255,255,255,.16);color:rgba(255,255,255,.86);border:1px dashed rgba(255,255,255,.42)}'
  /* กล่องผลตรวจใบอนุญาตคนขับ · สูงคงที่ ไม่งั้นใบที่มีปัญหาจะดันบรรทัดล่างเหลื่อม */
  +H+' .pj-licbox{height:58px;overflow:auto;border-bottom:1px solid #F4F5F8}'
  +H+' .pj-licbox .pl-res{border-bottom:none;padding:6px 15px;font-size:11px}'
  +H+' .pj-licbox .pj-licnone{padding:6px 15px;font-size:11px;color:#9BA3B0}'
  +H+' .bc .top .bn{font-size:16px;font-weight:800;letter-spacing:.02em;line-height:1.2}'
  +H+' .bc .top .be{font-size:9.5px;font-weight:600;opacity:.82;margin-top:1px;letter-spacing:.06em}'
  +H+' .bc .top .tm{font-size:23px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1;text-align:right}'
  +H+' .bc .top .tmL{font-size:8.5px;font-weight:700;opacity:.82;letter-spacing:.1em;text-align:right;margin-top:2px}'
  +H+' .bc .pg{padding:11px 15px 10px;color:#fff;position:relative}'
  +H+' .bc .pg{height:58px;display:flex;flex-direction:column;justify-content:center}'
  +H+' .bc .pg .pn{font-size:15px;font-weight:800;line-height:1.2;padding-right:34px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +H+' .bc .pg .pr{font-size:11.5px;font-weight:500;opacity:.93;margin-top:3px}'
  +H+' .pj-pen{position:absolute;top:9px;right:11px;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.16);color:#fff;font-size:12px;cursor:pointer}'
  +H+' .pj-pen:hover{background:rgba(255,255,255,.3)}'
  +H+' .pj-pop{position:absolute;top:42px;right:10px;z-index:30;background:#fff;border:1px solid #E1E4EA;border-radius:12px;box-shadow:0 14px 34px rgba(20,30,50,.18);padding:12px;width:236px;display:none}'
  +H+' .pj-pop.on{display:block}'
  +H+' .pj-pop .ph{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8B93A1;margin-bottom:8px}'
  +H+' .pj-sws{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}'
  +H+' .pj-sw{width:100%;aspect-ratio:1/1;border-radius:8px;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1px #E1E4EA}'
  +H+' .pj-cus{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;padding:6px 8px;font-size:10.5px;font-weight:700;color:#4A5D7A;background:#F7F9FB;border:1px solid #E9ECF1;border-radius:8px;cursor:pointer}'
  +H+' .pj-cus input{width:44px;height:24px;padding:0;border:1px solid #E1E4EA;border-radius:6px;background:none;cursor:pointer}'
  +H+' .pj-sw.on{box-shadow:0 0 0 2px #16265C}'
  /* §pjWb2 · แถวเลือกสีเอง / ล้างสี ใต้ตารางสี */
  /* §pjWbTxt (2026-09-23) · ช่องพิมพ์ชื่อสีเอง · เหตุผลเดียวกับที่ใบงานโชว์ชื่อสี
     ล็อตที่ซื้อมาได้สีที่ไม่มีในชุดมาตรฐาน เดิมถูกบันทึกเป็นคำว่า "สีเอง" เฉย ๆ
     ซึ่งบนใบที่ปริ้นขาวดำหรือแคปส่งไลน์ อ่านแล้วไม่รู้ว่าสีอะไร และสั่งของต่อไม่ได้ */
  +H+' .pj-wbn{display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:9px;'
     +'border-top:1px solid #EDEFF3}'
  +H+' .pj-wbn>span{flex:none;font-size:11px;font-weight:700;color:#5A6270}'
  +H+' .pj-wbni{flex:1;min-width:0;padding:5px 8px;border:1px solid #E1E4EA;border-radius:7px;'
     +'font:600 11.5px inherit;color:#1E2430;background:#fff}'
  +H+' .pj-wbni:focus{outline:none;border-color:#16265C;box-shadow:0 0 0 2px rgba(22,38,92,.12)}'
  /* เส้นคั่นเส้นเดียวพอ · สองเส้นติดกันอ่านเป็นกล่องซ้อนกล่อง */
  +H+' .pj-wbn + .pj-wbx{border-top:none;margin-top:7px;padding-top:0}'
  +H+' .pj-wbx{display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:9px;'
     +'border-top:1px solid #EDEFF3}'
  +H+' .pj-wbc{display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-size:11px;'
     +'font-weight:600;color:#5A6270}'
  +H+' .pj-wbc input{width:26px;height:22px;padding:0;border:1px solid #E1E4EA;border-radius:6px;'
     +'background:#fff;cursor:pointer}'
  +H+' .pj-wbclr{margin-left:auto;background:#fff;border:1px solid #E1E4EA;border-radius:6px;'
     +'padding:4px 10px;font-size:10.5px;font-weight:700;color:#A32D2D;cursor:pointer;'
     +'font-family:inherit}'
  +H+' .pj-wbclr:hover{background:#FCEBEB;border-color:#F0CFCF}'
  +H+' .pj-pop .pf{font-size:10.5px;color:#6E7684;line-height:1.6;margin-top:9px;border-top:1px solid #F0F2F6;padding-top:8px}'
  +H+' .pj-rst{display:block;width:100%;margin-top:8px;padding:5px 0;font-size:10.5px;font-weight:700;color:#4A5D7A;background:#F4F6F9;border:1px solid #E1E4EA;border-radius:7px;cursor:pointer}'
  +H+' .pj-rst:hover{background:#E9EDF3}'
  +H+' .bc .stbar{height:32px;padding:0 11px 0 15px;background:#FAFBFC;border-bottom:1px solid #EFF1F5;display:flex;align-items:center;gap:8px;overflow:hidden}'
  /* §pjLock2 · ป้ายอยู่ในกล่องที่ยอมโดนตัด · ปุ่มอยู่นอกกล่องและไม่ยอมย่อ */
  +H+' .bc .stbar .stw{flex:1 1 auto;min-width:0;overflow:hidden;display:flex;align-items:center;gap:8px}'
  +H+' .pj-lb{flex:0 0 auto;border:1px solid #0F6E56;background:#0F6E56;color:#fff;border-radius:7px;'
     +'padding:3px 10px;font:800 10.5px inherit;cursor:pointer;white-space:nowrap;line-height:1.55}'
  +H+' .pj-lb:hover{background:#0B5744;border-color:#0B5744}'
  +H+' .pj-lb.ed{background:#FFF6E5;border-color:#EFD9AE;color:#8A5A00}'
  +H+' .pj-lb.ed:hover{background:#FBEDD3;border-color:#E3C88F;color:#7A4E00}'
  +H+' .pj-sub{display:inline-block;font-size:9.5px;font-weight:800;border-radius:5px;padding:2px 8px;background:#FFF0D8;color:#B4560A}'
  +H+' .pj-move{display:inline-block;font-size:9.5px;font-weight:800;border-radius:5px;padding:2px 8px;background:#E9EFF7;color:#20477E;white-space:nowrap}'
  +H+' .pj-shop{display:inline-block;font-size:9.5px;font-weight:800;border-radius:5px;padding:2px 8px;background:#F2EBFA;color:#5B3B96;white-space:nowrap}'
  +H+' .pj-std{display:inline-block;font-size:9.5px;font-weight:800;border-radius:5px;padding:2px 8px;background:#EDF3EF;color:#5E8B72}'
  +H+' .pj-gh{display:flex;align-items:center;gap:8px;padding:0 15px;height:28px;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid var(--bd);border-bottom:1px solid var(--bd);background:var(--bg);color:var(--fg);box-shadow:inset 4px 0 0 var(--fg)}'
  +H+' .pj-rw{display:flex;align-items:center;gap:8px;padding:0 15px;height:32px;border-bottom:1px solid #F4F5F8}'
  +H+' .pj-rw .k{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#9BA3B0;width:100px;flex:none}'
  +H+' .pj-rw .v{font-size:12px;font-weight:600;color:#242730;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pj-rw .v.e{color:#CFD4DC;font-weight:400}'
  +H+' .pj-rw.sw2{background:#FFFCF3}'
  /* §pjSlots · ชื่อช่องพิมพ์ทับได้ · ปุ่มเอาคนออก · แถบปุ่มเพิ่มคน */
  +H+' .pj-rw .k .pj-kx{display:inline-block;cursor:text;border-radius:4px;padding:1px 3px;margin:-1px -3px;outline:none;min-width:24px}'
  +H+' .pj-rw .k .pj-kx:hover{background:#EEF3FB;color:#31507F}'
  +H+' .pj-rw .k .pj-kx:focus{background:#fff;color:#16265C;box-shadow:0 0 0 1px #3E6FD0}'
  +H+' .pj-rx{border:none;background:none;color:#CFD4DC;font-size:11px;cursor:pointer;padding:0 2px;flex:none;line-height:1}'
  +H+' .pj-rx:hover{color:#C0271C}'
  +H+' .pj-slotn{font-size:9.5px;font-weight:700;letter-spacing:.04em;color:#9BA3B0;padding:4px 15px 0;text-align:right}'
  /* §pjAlign · ตัวเว้นช่องระหว่างหัวข้อ · การ์ดเป็น flex column จึงต้องห้ามยืด/หด */
  +H+' .pj-spx{flex:0 0 auto;pointer-events:none}'
  +H+' .pj-addw{display:flex;align-items:center;gap:9px;padding:7px 15px;border-bottom:1px solid #F4F5F8;background:#FAFBFD;position:relative}'
  +H+' .pj-addb{font-size:11.5px;font-weight:700;color:#31507F;background:#fff;border:1px dashed #B9C7DE;'
     +'border-radius:7px;padding:5px 11px;cursor:pointer;font-family:inherit}'
  +H+' .pj-addb:hover{background:#EEF3FB;border-style:solid}'
  +H+' .pj-addn{font-size:10.5px;color:#9BA3B0}'
  +H+' .pj-pop.pj-addp{width:186px;left:15px;right:auto;top:38px;padding:6px}'
  +H+' .pj-pop.pj-addp button{display:block;width:100%;text-align:left;border:none;background:none;'
     +'font:600 12px inherit;font-family:inherit;color:#242730;padding:6px 8px;border-radius:6px;cursor:pointer}'
  +H+' .pj-pop.pj-addp button:hover{background:#EEF3FB;color:#20477E}'
  /* §pjRowFit · เว้นขวาให้ลูกศรของ select · ไม่งั้นชื่อยาววิ่งไปทับ */
  +H+' .pj-rw select{flex:1;min-width:0;border:1px solid transparent;background:transparent;border-radius:7px;'
     +'padding:3px 22px 3px 7px;font:600 12px inherit;color:#242730;cursor:pointer;text-overflow:ellipsis}'
  +H+' .pj-rw select:hover{border-color:#D9DDE4;background:#fff}'
  +H+' .pj-rw select:focus{border-color:#16265C;background:#fff;outline:none}'
  +H+' .pj-rw .pj-free{flex:1;min-width:0;border:1px solid transparent;background:transparent;border-radius:7px;padding:3px 7px;font:600 12px inherit;color:#242730;outline:none}'
  +H+' .pj-rw .pj-free:hover,.pj-rw .pj-free:focus{border-color:#D9DDE4;background:#fff}'
  +H+' .pj-rw .pj-free::placeholder{color:#CFD4DC;font-weight:400}'
  +H+' .pj-tag{font-size:9px;font-weight:800;border-radius:4px;padding:1px 6px;background:#FFF0D8;color:#B4560A;flex:none}'
  +H+' .pj-lg{display:inline-block;font-size:9px;font-weight:800;border-radius:4px;padding:1px 5px;'
    +'background:#E6F1FB;color:#185FA5;vertical-align:middle}'
  +H+' .pj-lgs{display:flex;gap:3px;flex:none}'
  +H+' .pj-away{font-size:9px;font-weight:800;border-radius:5px;padding:1px 6px;background:#E9EFF7;color:#20477E;flex:none;margin-right:3px}'
  +H+' .pj-was{font-size:10px;color:#B4560A;font-weight:600;flex:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +H+' .pj-wbrow{display:flex;align-items:center;gap:9px;padding:0 15px;height:36px;border-bottom:1px solid #F4F5F8}'
  +H+' .pj-wbrow .k{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#9BA3B0}'
  +H+' .pj-wb{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;color:#4A5464;border:1px solid #E7EAEF;border-radius:8px;padding:3px 9px;background:#fff;cursor:pointer}'
  +H+' .pj-wb i{width:14px;height:14px;border-radius:5px;border:1px solid rgba(0,0,0,.16);display:inline-block}'
  +H+' .pj-lang{display:inline-block;font-size:10px;font-weight:700;border-radius:5px;padding:2px 7px;margin-left:3px;background:#EEF2F8;color:#3C4E6B}'
  +H+' .pj-pax{display:flex;background:#FAFBFC;border-bottom:1px solid #E7EAEF}'
  +H+' .pj-pax .c{flex:1;padding:9px 6px;text-align:center;border-right:1px solid #EFF1F5}'
  +H+' .pj-pax .c:last-child{border-right:none}'
  +H+' .pj-pax .k{font-size:9px;font-weight:800;color:#9BA3B0;letter-spacing:.06em}'
  /* §pjKit · ตัวเลขคนคือของที่ต้องอ่านจากอีกฝั่งโต๊ะ · ตัวเดิม 15px เล็กเกินไป */
  +H+' .pj-pax .v{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;'
     +'margin-top:2px;letter-spacing:-.02em;color:#16265C;line-height:1.1}'
  +H+' .pj-pax .c.t{background:#F1F8F4}'
  +H+' .pj-pax .c.t .v{color:#0F6E56;font-size:26px}'
  +H+' .pj-pax .k{font-size:9.5px}'
  /* §pjKit · ภาษาที่ลูกค้าขอ · ชิปใหญ่ขึ้นให้เห็นจากระยะไกล */
  +H+' .pj-langbox{display:flex;flex-wrap:wrap;gap:6px;padding:9px 15px;border-bottom:1px solid #F4F5F8}'
  +H+' .pj-lgb{font-size:12px;font-weight:800;letter-spacing:.03em;padding:3px 11px;border-radius:99px;'
     +'background:#E9EFF7;color:#20477E;border:1px solid #D3E0F2}'
  +H+' .pj-noneb{font-size:11.5px;color:#C0C6CE}'
  /* §pjKit · ชื่อร้านอาหาร · สีประจำร้านทำให้แยกออกตั้งแต่ยังไม่ทันอ่านชื่อ */
  +H+' .pj-kit{padding:9px 15px 10px;border-bottom:1px solid #F4F5F8}'
  +H+' .pj-kitn{display:flex;align-items:center;gap:8px;border:1px solid;border-radius:10px;padding:7px 11px}'
  +H+' .pj-kitn i{width:9px;height:9px;border-radius:50%;flex:none}'
  +H+' .pj-kitn b{font-size:13.5px;font-weight:800;letter-spacing:-.01em;flex:1;min-width:0;'
     +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pj-kitn .pr{font-size:10.5px;font-weight:700;color:#6B7280;flex:none;font-variant-numeric:tabular-nums}'
  +H+' .pj-kitsel{margin-top:6px}'
  +H+' .pj-kitsel select{width:100%;border:1px solid #E4E7EE;background:#fff;border-radius:8px;'
     +'padding:5px 8px;font:600 11.5px inherit;font-family:inherit;color:#42506A}'
  +H+' .pj-kitsel select:hover{border-color:#C9D2DE}'
  +H+' .pj-kitsel select:disabled{background:#FAFBFC;color:#9BA3B0}'
  +H+' .pj-note{height:56px;overflow:auto;margin:10px 15px 12px;border:1px dashed #E5D3A8;border-radius:9px;background:#fff;padding:8px 11px;font-size:12px;font-weight:600;color:#7A4A00;line-height:1.55;outline:none}'
  +H+' .pj-note:focus{border-style:solid;border-color:#D9A441;box-shadow:0 0 0 3px rgba(217,164,65,.15)}'
  +H+' .pj-note:empty:before{content:attr(data-ph);color:#C9CFD8;font-weight:400}'
  +H+' .bc .foot{margin-top:auto;height:46px;display:flex;align-items:center;gap:8px;padding:0 15px;border-top:1px solid #EFF1F5;overflow:hidden}'
  +H+' .bc .foot button{border:1px solid #D9DDE4;background:#fff;border-radius:7px;padding:4px 10px;font:700 11px inherit;color:#5A6270;cursor:pointer}'
  +H+' .bc .foot button:hover{border-color:#16265C;color:#16265C}'
  +H+' .bc .foot button.gh{background:#F0F6F3;border-color:#BFE0CD;color:#0F6E56}'
  /* §gjCard · แถวปุ่มใบงานไกด์ · ท้ายสุดของการ์ด เต็มความกว้าง */
  +H+' .bc .gjrow{border-top:1px solid #EFF1F5;padding:8px 15px 10px}'
  +H+' .bc .gjrow button{width:100%;display:flex;align-items:center;justify-content:center;gap:7px;'
     +'border:1px solid #D9DDE4;background:#FAFBFC;border-radius:8px;padding:7px 10px;'
     +'font:700 11.5px inherit;color:#16265C;cursor:pointer}'
  +H+' .bc .gjrow button:hover{background:#16265C;border-color:#16265C;color:#fff}'
  +H+' .bc .gjrow button .n{font:700 10px inherit;background:#E8EDF6;color:#16265C;'
     +'border-radius:999px;padding:1px 7px}'
  +H+' .bc .gjrow button:hover .n{background:rgba(255,255,255,.22);color:#fff}'
  +H+' .bc .gjrow button:disabled{background:#F7F8FA;border-color:#EDEFF3;color:#B9BFC9;cursor:not-allowed}'
  +H+' .bc .gjrow button:disabled:hover{background:#F7F8FA;border-color:#EDEFF3;color:#B9BFC9}'
  +H+' .pj-idle{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;background:#fff;border:1px solid #E1E4EA;border-radius:12px;padding:13px 15px}'
  +H+' .pj-ib{border:1px solid #E7EAEF;background:#FAFBFC;border-radius:9px;padding:6px 12px}'
  +H+' .pj-ib .n{font-size:11.5px;font-weight:800;color:#5A6270}'
  +H+' .pj-ib .s{font-size:10px;font-weight:700;margin-top:1px;color:#8B93A1}'
  +H+' .pj-empty{background:#fff;border:1px solid #E1E4EA;border-radius:12px;padding:28px 14px;text-align:center;color:#9BA3B0;font-size:12.5px}'
  /* §pjSkin · ทั้งก้อนนี้ผูกกับ .sk เท่านั้น · อีกสองหน้าที่ใช้ pjCSS() ร่วมกันจึงไม่ขยับ */
  +H+'.sk{background:#F0F2F5;margin:-22px;padding:22px;min-height:calc(100vh - 44px)}'
  +'@media(max-width:820px){'+H+'.sk{margin:-12px -10px;padding:12px 10px;min-height:calc(100vh - 24px)}}'
  +H+'.sk .pj-nh{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}'
  +H+'.sk .pj-hl{display:flex;align-items:center;gap:12px}'
  +H+'.sk .pj-badge{width:40px;height:40px;border-radius:14px;background:#0F172A;color:#fff;display:flex;align-items:center;'
     +'justify-content:center;font-weight:800;font-size:15px;letter-spacing:.02em;flex:0 0 auto;box-shadow:0 4px 12px rgba(15,23,42,.18)}'
  +H+'.sk .pj-nh h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0;color:#0F172A}'
  +H+'.sk .pj-nh p{font-size:11.5px;color:#64748B;margin:2px 0 0;line-height:1.6}'
  +H+'.sk .pj-nbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:rgba(255,255,255,.85);'
     +'border:1px solid rgba(226,232,240,.7);border-radius:18px;padding:6px;box-shadow:0 1px 2px rgba(15,23,42,.04)}'
  +H+'.sk .pj-nbar button{border:none;background:none;border-radius:12px;padding:9px 15px;font:600 12.5px inherit;'
     +'color:#475569;cursor:pointer;white-space:nowrap;transition:.14s}'
  +H+'.sk .pj-nbar button:hover{background:#F1F5F9;color:#0F172A}'
  +H+'.sk .pj-nbar button.pri{background:#0F172A;color:#fff;font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.14)}'
  +H+'.sk .pj-nbar button.pri:hover{background:#1E293B;color:#fff}'
  +H+'.sk .pj-nbar button.now{background:#EEF2FF;color:#4F46E5;font-weight:700;padding:7px 12px;font-size:11.5px}'
  +H+'.sk .pj-nbar button.now:hover{background:#E0E7FF;color:#4338CA}'
  +H+'.sk .pj-nbar button.nav{padding:7px 11px;color:#64748B}'
  +H+'.sk .pj-nbar input[type=date]{border:none;background:#F1F5F9;border-radius:12px;padding:7px 11px;'
     +'font:600 11.5px inherit;color:#1E293B;cursor:pointer;outline:none}'
  +H+'.sk .pj-nbar .sep{width:1px;height:22px;background:#E2E8F0;margin:0 3px}'
  /* §pjDateCard · การ์ดยาวใบเดียว บอกวันที่ของรอบที่กำลังดูอยู่ */
  +H+'.sk .pj-dcard{background:#fff;border:1px solid #F1F5F9;border-radius:20px;padding:14px 20px;margin:0 0 16px;'
     +'display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;'
     +'box-shadow:0 10px 30px -5px rgba(0,0,0,.04),0 4px 12px -2px rgba(0,0,0,.02)}'
  +H+'.sk .pj-dcard .tx{text-align:center}'
  +H+'.sk .pj-dcard .big{font-size:21px;font-weight:800;color:#0F172A;letter-spacing:-.01em;line-height:1.3}'
  /* §pjDateCard2 · บรรทัดสากลใหญ่เท่าบรรทัดไทย · ต่างกันที่น้ำหนักกับสีเท่านั้น */
  +H+'.sk .pj-dcard .sm{font-size:21px;font-weight:600;color:#64748B;line-height:1.3;margin-top:1px}'
  +H+'.sk .pj-dcard .sm b{color:#0F172A;font-weight:700}'
  +'@media(max-width:600px){'+H+'.sk .pj-dcard .big,'+H+'.sk .pj-dcard .sm{font-size:16px}}'
  /* แถวตัวกรอง · แคปซูลซ้าย ปุ่มลงมือขวา */
  +H+'.sk .pj-frow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}'
  +H+'.sk .pj-chips{background:#fff;border:1px solid #F1F5F9;padding:5px;border-radius:16px;gap:3px;'
     +'box-shadow:0 1px 2px rgba(15,23,42,.04)}'
  +H+'.sk .pj-chips button{border-radius:11px;padding:7px 14px;font:600 12px inherit;color:#64748B;gap:7px}'
  +H+'.sk .pj-chips button:hover{color:#0F172A;background:#F8FAFC}'
  +H+'.sk .pj-chips button.on{background:#0F172A;color:#fff;font-weight:700}'
  +H+'.sk .pj-chips button.on:hover{background:#1E293B;color:#fff}'
  +H+".sk .pj-chips button .n{font:700 11px 'DM Mono',monospace;opacity:.65}"
  +H+'.sk .pj-warnc{font-size:11.5px;font-weight:700;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;'
     +'border-radius:12px;padding:7px 13px}'
  +H+'.sk .pj-warnc.red{color:#9F1239;background:#FFF1F2;border-color:#FECDD3}'
  +H+'.sk .pj-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:rgba(255,255,255,.85);'
     +'border:1px solid rgba(226,232,240,.7);border-radius:16px;padding:5px;box-shadow:0 1px 2px rgba(15,23,42,.04)}'
  +H+'.sk .pj-acts button{border:none;background:none;border-radius:11px;padding:7px 13px;font:600 12px inherit;'
     +'color:#475569;cursor:pointer;white-space:nowrap}'
  +H+'.sk .pj-acts button:hover{background:#F1F5F9;color:#0F172A}'
  +H+'.sk .pj-acts button.pri{background:#0F172A;color:#fff;font-weight:700}'
  +H+'.sk .pj-acts button.pri:hover{background:#1E293B;color:#fff}'
  +H+'.sk .pj-acts button.gh{background:#ECFDF5;color:#047857;font-weight:700}'
  +H+'.sk .pj-acts button.gh:hover{background:#D1FAE5;color:#065F46}'
  +H+'.sk .pj-acts button[disabled]{opacity:.42;cursor:not-allowed}'
  +H+'.sk .pj-wsw{background:#F1F5F9;border:none;border-radius:12px;padding:3px}'
  +H+'.sk .pj-wsw button{border-radius:9px;padding:5px 11px;font:600 11.5px inherit;color:#64748B}'
  +H+'.sk .pj-wsw button.on{background:#fff;color:#0F172A;font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.07)}'
  +H+'.sk .pj-strip::-webkit-scrollbar-track{background:#E2E5EA}'
  +H+'.sk .pj-idle,'+H+'.sk .pj-empty{border-radius:20px;border-color:#F1F5F9;box-shadow:0 10px 30px -5px rgba(0,0,0,.04)}';
}
function pjDateWords(ymd){
  var p=String(ymd||'').split('-'), y=+p[0], m=+p[1], d=+p[2];
  var w=-1; try{ var dt=new Date(String(ymd)+'T12:00:00'); if(!isNaN(dt)) w=dt.getDay(); }catch(_){}
  var ML=(typeof MONTHS_TH!=='undefined')?MONTHS_TH:[];
  var MS=(typeof MONTHS_TH_SHORT!=='undefined')?MONTHS_TH_SHORT:[];
  if(!y||!m||!d) return {d:'—', ms:'', big:String(ymd||''), sm:''};
  return {d:d, ms:MS[m-1]||'',
    big:(w>=0?(PJ_DOW_TH[w]+'ที่ '):'')+d+' '+(ML[m-1]||m)+' '+(y+543),
    sm:(w>=0?(PJ_DOW_EN[w]+' '):'')+d+' '+(PJ_MON_EN[m-1]||m)+' '+y};
}

/* §pjSkin · ปุ่มในแถบเมนูพาไปหน้าอื่นของท่าเดียวกัน
   เรียกผ่านปุ่มในเมนูซ้ายจริง ๆ เพื่อให้แถบเมนูไฮไลต์ตามไปด้วย ไม่ใช่แค่วาดหน้าใหม่ทับ */
function pjGo(pfx){
  var v=pfx+'-'+_poPier;
  try{ var el=document.querySelector('.nav-item[data-view="'+v+'"]'); if(el){ nav(el); return; } }catch(_){}
  if(pfx==='poa' && typeof renderPierAtt==='function') renderPierAtt(_poPier);
  else if(pfx==='pol' && typeof renderPierLic==='function') renderPierLic(_poPier);
  else if(pfx==='po' && typeof renderPierOffice==='function') renderPierOffice(_poPier);
}

/* §pjAlign2 · ติดชื่อกลุ่มไว้กับหัวข้อ · ใบที่ออกเรือมีหัวข้อมากกว่าใบที่ไม่ออก
   จัดระดับด้วยลำดับที่ (อันที่ 3 กับอันที่ 3) จึงจับคู่ผิดเรื่องกัน ต้องจับด้วยชื่อกลุ่ม */
function pjSecHd(t,k){ var S=PJ_SEC[k]||PJ_SEC.crew;
  return '<div class="pj-gh" data-sec="'+k+'" style="--bg:'+S.bg+';--fg:'+S.fg+';--bd:'+S.bd+'">'+t+'</div>'; }
/* §pierRotate · เลือกคนได้จากทั้ง 3 ท่า · ท่านี้ขึ้นก่อน ท่าอื่นอยู่กลุ่ม "มาช่วย" */
/* §pierBlob · ตำแหน่งของคนนี้เข้าข่ายที่ช่องนี้ต้องการไหม
   เทียบแบบ "มีคำนี้อยู่ในตำแหน่ง" ไม่ใช่ตรงเป๊ะ · ช่างกล ช่างยนต์ ช่างไฟฟ้า เข้ากลุ่ม "ช่าง" ทั้งหมด
   ไม่ระบุตำแหน่งที่ต้องการ = ทุกคนเข้าข่าย (ช่องช่วยงาน ใครก็ช่วยได้) */
function pjRoleHit(role, roles){
  if(!roles || !roles.length) return true;
  var r=String(role||'').toLowerCase(); if(!r) return false;
  for(var i=0;i<roles.length;i++){ var k=String(roles[i]||'').trim().toLowerCase(); if(k && r.indexOf(k)>=0) return true; }
  return false;
}
function pjOpts(pier, sel, roles){
  var all=(PIER_STAFF||[]).filter(function(s){ return s.active!==false; });
  var want=(roles&&roles.length)?String(roles[0]):'';
  var opt=function(s, tag){
    return '<option value="'+poE(s.id)+'"'+(s.id===sel?' selected':'')+'>'
      +poE((s.name||s.nick||s.id)+(s.nick&&s.name?(' ('+s.nick+')'):''))
      +(s.role?(' · '+poE(s.role)):'')+(tag?(' · '+poE(tag)):'')+'</option>';
  };
  var grp=function(list, label, tagFn){
    if(!list.length) return '';
    return '<optgroup label="'+poE(label)+'">'
      + list.map(function(s){ return opt(s, tagFn?tagFn(s):''); }).join('') + '</optgroup>';
  };
  var pierTag=function(s){ var p=PO_PIERS.filter(function(x){ return x.k===s.pier; })[0]; return p?(p.n||p.t):s.pier; };
  var mine=all.filter(function(s){ return s.pier===pier; });
  var other=all.filter(function(s){ return s.pier!==pier; });
  var hit=function(s){ return pjRoleHit(s.role, roles); };
  // §pierBlob · แยกกลุ่มตามหน้าที่ · คนตรงตำแหน่งอยู่กลุ่มแรก
  //   ไม่ตัดคนนอกตำแหน่งทิ้ง เพราะบางวันต้องหยิบคนอื่นมาลงจริง · แค่ย้ายไปกลุ่มล่าง
  var out='<option value="">— ว่าง —</option>';
  out+= grp(mine.filter(hit),  want?('ท่านี้ · '+want):'ท่านี้', null);
  if(want) out+= grp(mine.filter(function(s){ return !hit(s); }), 'ท่านี้ · ตำแหน่งอื่น', null);
  out+= grp(other.filter(hit), want?('ท่าอื่น · '+want+' · มาช่วย'):'ท่าอื่น · มาช่วย', pierTag);
  if(want) out+= grp(other.filter(function(s){ return !hit(s); }), 'ท่าอื่น · ตำแหน่งอื่น', pierTag);
  if(sel && !all.some(function(s){ return s.id===sel; }))
    out+='<option value="'+poE(sel)+'" selected>'+poE(pjStaffName(sel))+' (ไม่อยู่ในทะเบียนแล้ว)</option>';
  return out;
}
/* ท่าประจำของคนคนนี้ · '' ถ้าไม่รู้จัก */
function pjHomePier(sid){ var s=(PIER_STAFF||[]).filter(function(x){ return x.id===sid; })[0]; return s?(s.pier||''):''; }
function pjPierShort(k){ var p=PO_PIERS.filter(function(x){ return x.k===k; })[0]; return p?p.s:''; }
function pjRow(label, html, subOld){
  return '<div class="pj-rw'+(subOld?' sw2':'')+'"><div class="k">'+label+'</div>'+html
    +(subOld?('<span class="pj-tag">SUB</span><span class="pj-was" title="ปกติคือ '+poE(pjStaffName(subOld))+'">ปกติ '+poE(pjStaffName(subOld))+'</span>'):'')+'</div>';
}
/* §pjLbScope (2026-09-12) · "พอแก้ 1 หน้า กระทบทุกหน้า ไม่ควร ควรหน้าไหนหน้านั้น"

   ของเดิมเก็บชื่อช่องไว้ที่เดียวทั้งระบบ (PIER_CFG.slotLb[kind][slot])
   แก้ที่การ์ด Artemis แล้วการ์ดทุกลำทุกท่าเปลี่ยนตาม — ตรงกับที่ tooltip เขียนไว้เองว่า
   "มีผลทุกท่าทุกลำ" · แต่ของจริงแต่ละลำเรียกช่องไม่เหมือนกัน
   ย้ายมาเก็บใน PIER_JOB[วัน|ลำ].lb ซึ่งเป็นก้อนของ "ลำนี้ วันนี้" อยู่แล้ว
   (ที่เดียวกับ cap/crew/note/wb) → แก้การ์ดไหนมีผลเฉพาะการ์ดนั้นวันนั้น
   ใบงานเก่าที่พิมพ์ไปแล้วจึงคงชื่อเดิมไว้ ไม่ถูกเขียนทับย้อนหลัง

   ค่าเดิมที่เคยตั้งไว้แบบทั้งระบบยังอ่านอยู่ · ใช้เป็น "ชื่อตั้งต้นของการ์ด" แทนค่า default
   ของที่ตั้งไว้แล้วจะได้ไม่หายไปเฉย ๆ · และพิมพ์ทับรายลำได้ตามปกติ
   (อยากกลับไปเป็นชื่อ default จริง ๆ ก็พิมพ์ชื่อนั้นลงไปตรง ๆ ได้) */
function pjSlotLbBase(kind, slot, def){
  try{ var S=(PIER_CFG.slotLb||{})[kind]||{}; var v=String(S[slot]||'').trim(); return v||def; }
  catch(_){ return def; }
}
function pjSlotLb(kind, slot, def, bid, date){
  var base=pjSlotLbBase(kind, slot, def);
  try{
    if(!bid) return base;
    var J=pjOf(date||_poDate, bid);
    var v=String(((J&&J.lb)||{})[kind+':'+slot]||'').trim();
    return v||base;
  }catch(_){ return base; }
}
function pjSlotLbSet(kind, slot, txt, def, bid){
  if(!poGuard()) return;
  if(!bid) return;
  var base=pjSlotLbBase(kind, slot, def);
  var J=pjOf(_poDate, bid), L=Object.assign({}, (J&&J.lb)||{});
  /* textContent ไม่ใช่ innerText · .k มี text-transform:uppercase อยู่
     ถ้าอ่าน innerText จะได้ตัวใหญ่ทั้งหมดแล้วบันทึกตัวใหญ่ติดไปด้วย */
  var v=String(txt==null?'':txt).replace(/\s+/g,' ').trim().slice(0,24);
  if(!v || v===base) delete L[kind+':'+slot]; else L[kind+':'+slot]=v;
  pjSet(_poDate, bid, {lb:L});
  renderPierJob();
}
function pjSlotKey(bid,slot){ return String(bid)+'::'+String(slot); }
function pjSlotAdd(bid, slot){
  _pjAdd[pjSlotKey(bid,slot)]=1;
  try{ document.querySelectorAll('.pj-pop').forEach(function(p){ p.classList.remove('on'); }); }catch(_){}
  renderPierJob();
}
function pjSlotDrop(bid, slot){
  delete _pjAdd[pjSlotKey(bid,slot)];
  pjPick(bid, slot, '');          /* บันทึก + วาดใหม่ในตัว */
}
function pjSlotVal(J, slot){
  if(slot==='cap') return J.cap||'';
  if(slot==='asst') return J.asst||'';
  if(slot.indexOf('crew')===0) return (J.crew||[])[+slot.slice(4)]||'';
  if(slot.indexOf('island')===0) return (J.island||[])[+slot.slice(6)]||'';
  return '';
}
/* แถวหนึ่งช่อง · เหมือน pjSelRow แต่ชื่อช่องพิมพ์ทับได้ และมีปุ่มเอาคนออก */
function pjSlotRow(pier,bid,kind,slot,defLb,val,subOld,roles,ro,boat){
  var lb=pjSlotLb(kind,slot,defLb,bid);
  var kHtml = ro ? poE(lb)
    : ('<span class="pj-kx" contenteditable="true" spellcheck="false"'
      +' title="แก้ชื่อช่องนี้ได้ · มีผลเฉพาะลำนี้ วันนี้ · ลบจนว่าง = กลับเป็น '+poE(pjSlotLbBase(kind,slot,defLb))+'"'
      +pjOn('keydown','lbKey')
      +' data-o="'+poE(lb)+'"'
      +pjOn('blur','slotLb',{kind:kind,slot:slot,def:defLb,bid:bid})+'>'
      +poE(lb)+'</span>');
  var badge='';
  var hp=val?pjHomePier(val):'';
  if(hp && hp!==pier) badge+='<span class="pj-away" title="มาช่วยจาก '+poE((PO_PIERS.filter(function(x){return x.k===hp;})[0]||{}).t||hp)+'">'+poE(pjPierShort(hp))+'</span>';
  var freeCaptain=slot==='cap' && boat && boat.ownership==='charter';
  var sel=(badge?('<span style="display:inline-flex;flex:none">'+badge+'</span>'):'')
    +(freeCaptain
      ? '<input class="pj-free" value="'+poE(val)+'" placeholder="พิมพ์ชื่อกัปตัน"'+pjOn('change','freePick',{bid:bid,slot:slot})+(ro?' disabled':'')+'>'
      : '<select'+pjOn('change','pick',{bid:bid,slot:slot})+(ro?' disabled':'')+'>'+pjOpts(pier,val,roles)+'</select>')
    +((ro||!val)?'':('<button class="pj-rx"'+pjOn('click','slotDrop',{bid:bid,slot:slot})+' title="เอาคนออกจากช่องนี้">&#10005;</button>'));
  return '<div class="pj-rw'+(subOld?' sw2':'')+'"><div class="k">'+kHtml+'</div>'+sel
    +(subOld?('<span class="pj-tag">SUB</span><span class="pj-was" title="ปกติคือ '+poE(pjStaffName(subOld))+'">ปกติ '+poE(pjStaffName(subOld))+'</span>'):'')+'</div>';
}
function pjSelRow(pier,bid,label,slot,val,subOld,roles,ro,boat){
  /* §pjRowFit · ชิปใบอนุญาตรายคน (ก / ช) ออก · บรรทัดสรุปใต้การ์ดบอกเรื่องเดียวกันอยู่แล้ว */
  var badge='';
  var hp=val?pjHomePier(val):'';
  if(hp && hp!==pier) badge+='<span class="pj-away" title="มาช่วยจาก '+poE((PO_PIERS.filter(function(x){return x.k===hp;})[0]||{}).t||hp)+'">'+poE(pjPierShort(hp))+'</span>';
  var sel=(badge?('<span style="display:inline-flex;flex:none">'+badge+'</span>'):'')
    +'<select'+pjOn('change','pick',{bid:bid,slot:slot})+(ro?' disabled':'')+'>'+pjOpts(pier,val,roles)+'</select>';
  return pjRow(label, sel, subOld);
}
function pjTxtRow(label,txt){
  return pjRow(label, txt?('<div class="v">'+poE(txt)+'</div>'):'<div class="v e">—</div>', null);
}
/* §gdRole · ชื่อไกด์ + ป้ายภาษาที่พูดได้ · ป้ายมาจากทะเบียน ไม่ใช่จากใบจอง */
function pjGuideRow(label, name, langs){
  if(!name) return pjRow(label, '<div class="v e">—</div>', null);
  /* ป้ายภาษาอยู่นอก .v · ถ้าอยู่ข้างในจะโดน text-overflow:ellipsis กินไปพร้อมชื่อยาว */
  var chips=(langs||[]).map(function(L){ return '<span class="pj-lg">'+poE(L)+'</span>'; }).join('');
  return pjRow(label, '<div class="v">'+poE(name)+'</div>'
    +(chips?('<span class="pj-lgs">'+chips+'</span>'):''), null);
}
/* §gdSel (2026-09-05) · ช่องไกด์บนการ์ดเลือกได้เองเหมือนช่องลูกเรือที่อยู่เหนือมันขึ้นไป
   ของเดิมอ่านอย่างเดียว · เปลี่ยนไกด์ทีต้องเปิดหน้าต่าง "จัดไกด์" ทั้งที่ช่องกัปตัน/เด็กเรือ
   บนการ์ดใบเดียวกันแค่กดเลือกในบรรทัดนั้นเลย
   เก็บที่เดิม (goAsn ของใบสั่งงานมัคคุเทศก์) ปุ่ม "จัดไกด์" ยังใช้ได้เหมือนเดิม
   สองทางเขียนลงที่เดียวกัน แก้ทางไหนอีกทางก็เห็น */
/* ไกด์คนไหนถูกจ่ายให้ลำอื่นไปแล้ววันเดียวกัน · id -> ชื่อลำ
   ไม่ห้าม (บางวันคนเดียวคุมสองลำจริง) แต่ต้องเห็นก่อนกด
   ไม่ใช่รู้ตอนกระดาษสองใบออกมาชื่อชนกัน */
function pjGdBusy(date, notBid){
  var out={};
  try{
    var m=(typeof ctRead==='function')?ctRead('go_asn'):null; m=m||{};
    Object.keys(m).forEach(function(k){
      var i=k.indexOf('|'); if(i<0 || k.slice(0,i)!==date) return;
      var b=k.slice(i+1); if(b===notBid) return;
      ((m[k]&&m[k].g)||[]).forEach(function(id){
        if(!id || out[id]) return;
        var nb=(typeof getBoat==='function')?getBoat(b):null;
        out[id]=(nb&&nb.name)||b;
      });
    });
  }catch(_){}
  return out;
}
/* ตัวเลือกของช่องหนึ่ง · แยกตามบทบาทแบบเดียวกับที่ใบสั่งงานแยก (§gdRole)
   ช่อง Guide เห็นเฉพาะไกด์/ไกด์ฝึกหัด · ช่อง Trainee เห็นนักศึกษาฝึกงาน/สตาฟ
   ไม่งั้นเลือกเสร็จแถวเด้งไปอยู่อีกกลุ่มทันทีที่วาดใหม่ */
function pjGdOpts(sel, wantGuide, taken, busy){
  taken=taken||{}; busy=busy||{};
  var out='<option value="">— ว่าง —</option>', found=false;
  /* §gdOptOrder (2026-09-12) · "ตอนนี้เรียงตาม A-Z แต่จริง ๆ ไม่ควรเรียง ควรเรียงตามที่ User Add"
     เดิม sort ตามชื่อไทย · ทีมจำลำดับในทะเบียนได้ แต่จำลำดับ ก-ฮ ของชื่อเต็มไม่ได้
     คนที่เพิ่งเพิ่มเข้าไปจะไปโผล่กลางรายการ หาไม่เจอ
     ช่องลูกเรือ (pjOpts) ใช้ลำดับทะเบียนอยู่แล้ว · สองช่องนี้เคยเรียงคนละแบบ
     → เอา sort ออก ใช้ลำดับเดียวกับทะเบียนทั้งคู่ */
  var G=goGuides().filter(function(g){ return g.active!==false && goIsGuide(g)===wantGuide; });
  G.forEach(function(g){
    if(taken[g.id] && g.id!==sel) return;      /* ลงลำนี้ไปแล้วในช่องอื่น */
    if(g.id===sel) found=true;
    var nm=(g.name||g.id)+(g.nick?(' ('+g.nick+')'):'');
    var L=goLangsOf(g); if(L.length) nm+=' · '+L.join('/');
    if(!wantGuide) nm+=' · '+goRoleT(goRoleOf(g));
    if(busy[g.id]) nm+=' · อยู่ '+busy[g.id];
    out+='<option value="'+poE(g.id)+'"'+(g.id===sel?' selected':'')+'>'+poE(nm)+'</option>';
  });
  /* คนที่เลือกไว้แล้วแต่ไม่เข้ากลุ่มนี้ (เปลี่ยนบทบาท · ปิดใช้งาน · ถูกลบ) ต้องยังเห็นชื่อ
     ไม่งั้น select เด้งไปช่องแรกแล้วบันทึกทับของเดิมโดยไม่มีใครสั่ง */
  if(sel && !found){
    var g0=goGuide(sel);
    var nm0=g0 ? ((g0.name||sel)+(g0.nick?(' ('+g0.nick+')'):'')+' · '+goRoleT(goRoleOf(g0))
                  +(g0.active===false?' · ปิดใช้งาน':''))
               : (sel+' (ไม่อยู่ในทะเบียนแล้ว)');
    out+='<option value="'+poE(sel)+'" selected>'+poE(nm0)+'</option>';
  }
  return out;
}
function pjGdAddKey(bid,kind){ return String(bid)+'::'+String(kind); }
function pjGdAddN(bid,kind){ return +_pjGdAdd[pjGdAddKey(bid,kind)]||0; }
function pjGdAddSlot(bid,kind){
  var k=pjGdAddKey(bid,kind); _pjGdAdd[k]=pjGdAddN(bid,kind)+1;
  try{ document.querySelectorAll('.pj-pop').forEach(function(x){ x.classList.remove('on'); }); }catch(_){}
  renderPierJob();
}
/* เอาคนออก · ช่องนั้นต้องหายไปด้วย ไม่ใช่ค้างเป็นบรรทัดว่าง (เหมือน pjSlotDrop)
   hasVal=0 คือแถวว่างที่กดเปิดไว้ · แค่ปิดแถว ไม่มีอะไรต้องบันทึก
   อย่าให้ลงไปถึง goAsnSet เพราะนั่นคือเขียนทับข้อมูลทั้งก้อนโดยไม่ได้เปลี่ยนอะไร */
function pjGdDrop(bid,kind,idx,hasVal){
  var k=pjGdAddKey(bid,kind); if(_pjGdAdd[k]>0) _pjGdAdd[k]--;
  if(hasVal) pjGdPick(bid,kind,idx,'');   /* บันทึก + วาดใหม่ในตัว */
  else renderPierJob();
}
/* §gdLb (2026-09-05) · ชื่อช่องพิมพ์ทับได้เหมือนช่องลูกเรือ · ใช้ที่เก็บเดียวกัน
   (PIER_CFG.slotLb) คนละชุดกับ go/wk · ตั้งชื่อทับได้ ลบจนว่าง = กลับชื่อตั้งต้น
   ชื่อตั้งต้นของช่องต้องคงที่ ไม่ผูกกับจำนวนแถวที่วาดอยู่ตอนนั้น
   ไม่งั้นแถวแรกของ Trainee จะสลับชื่อตั้งต้นไปมาเวลามีแถวที่สอง
   แล้ว "ลบจนว่าง = กลับชื่อตั้งต้น" จะเทียบกับคนละค่า */
function pjGdSlot(kind, idx){ return (kind==='gd'?'g':'t')+idx; }
function pjGdDefLb(kind, idx){
  return (kind==='gd') ? ('Guide '+(idx+1))
                       : (idx ? ('Trainee / Staff '+(idx+1)) : 'Trainee / Staff');
}
/* extra = แถวนี้มีอยู่เพราะกด "เพิ่มคน" เปิดไว้ · ยังไม่มีคนก็ปิดทิ้งได้
   ของเดิมปุ่ม ✕ ขึ้นเฉพาะแถวที่มีคนแล้ว · แถวว่างที่กดเปิดมาจึงปิดไม่ได้เลย
   ต้องรีเฟรชหน้าถึงจะหาย (_pjGdAdd อยู่ในหน่วยความจำ) */
/* §gdLead · คนที่ขึ้นช่อง "มัคคุเทศก์" หัวใบสั่งงาน · คนแรกที่เป็นบทบาทไกด์ใน A.g
   อ่านแบบเดียวกับ goSheet ทุกประการ รวมถึงการข้ามคนที่ถูกลบออกจากทะเบียนไปแล้ว
   (goSheet กรองด้วย .filter(Boolean) หลัง goGuide · การ์ดต้องข้ามให้ตรงกัน
    ไม่งั้นการ์ดชี้คนหนึ่ง กระดาษพิมพ์อีกคนหนึ่ง) */
function pjGdLead(bid){
  try{
    var g=(goAsn(_poDate,bid).g)||[];
    for(var i=0;i<g.length;i++){
      var o=goGuide(g[i]); if(o && goIsGuide(o)) return g[i];
    }
  }catch(_){}
  return '';
}
function pjGdRow(label, bid, kind, idx, val, langs, taken, busy, extra, lead){
  var chips=(langs||[]).map(function(L){ return '<span class="pj-lg">'+poE(L)+'</span>'; }).join('');
  var slot=pjGdSlot(kind,idx), def=pjGdDefLb(kind,idx), lb=pjSlotLb('gd',slot,def,bid);
  var kHtml='<span class="pj-kx" contenteditable="true" spellcheck="false"'
    +' title="แก้ชื่อช่องนี้ได้ · มีผลเฉพาะลำนี้ วันนี้ · ลบจนว่าง = กลับเป็น '+poE(pjSlotLbBase('gd',slot,def))+'"'
    +pjOn('keydown','lbKey')
    +' data-o="'+poE(lb)+'"'
    +pjOn('blur','slotLb',{kind:'gd',slot:slot,def:def,bid:bid})+'>'
    +poE(lb)+'</span>';
  return '<div class="pj-rw"><div class="k">'+kHtml+'</div>'
    +'<select'+pjOn('change','gdPick',{bid:bid,kind:kind,idx:idx})+'>'+pjGdOpts(val, kind==='gd', taken, busy)+'</select>'
    +((val||extra)
       ? ('<button class="pj-rx"'+pjOn('click','gdDrop',{bid:bid,kind:kind,idx:idx,on:(val?1:0)})
          +' title="'+(val?'เอาคนออกจากช่องนี้':'ปิดช่องว่างที่เปิดไว้')+'">&#10005;</button>')
       : '')
    +((lead&&val&&val===lead)
       ? ('<span class="pj-tag" title="'+poE('ชื่อและเลขใบอนุญาตของคนนี้ขึ้นช่อง "มัคคุเทศก์" '
           +'บนหัวใบสั่งงานมัคคุเทศก์ · ที่เหลือนับเป็นผู้ติดตาม '
           +'· ต้องการเปลี่ยนหัวหน้า เลือกคนนั้นลงช่องแรก แล้วสองคนจะสลับที่กัน')+'">หัวหน้า</span>')
       : '')
    +(chips?('<span class="pj-lgs">'+chips+'</span>'):'')
  +'</div>';
}
/* เขียนกลับลง goAsn · A.g เป็นรายการเดียวปนกันทั้งไกด์และสตาฟ
   จึงแก้ "ตามตำแหน่งจริงในรายการ" ของกลุ่มนั้น ลำดับของคนกลุ่มอื่นจะได้ไม่ขยับ
   คนแรกของ A.g คือผู้รับผิดชอบใบสั่งงาน การเรียงจึงไม่ใช่แค่ความสวยงาม */
function pjGdPick(bid, kind, idx, val){
  if(typeof poGuard==='function' && !poGuard()) return;
  var A=goAsn(_poDate,bid), ids=(A.g||[]).slice(), want=(kind==='gd');
  var posOf=function(){ var a=[]; ids.forEach(function(id,i){
    if(goIsGuide(goGuide(id))===want) a.push(i); }); return a; };
  var pos=posOf();
  val=String(val||'');
  /* §gdAdd · เลือกคนลงช่องว่างที่กดเปิดไว้ = ช่องนั้นมีคนแล้ว ไม่ต้องนับเป็นช่องที่เปิดค้าง
     ไม่งั้นจะงอกบรรทัดว่างใหม่ทุกครั้งที่เลือกคน
     ฐานคือ "ช่องที่มีอยู่แล้วโดยไม่ต้องกดเพิ่ม" · ช่อง Guide 1 โชว์เสมอจึงนับเป็นฐานด้วย
     ไม่งั้นใส่คนแรกลงใบเปล่าจะไปกินช่องว่างที่กดเปิดไว้สำหรับคนที่สอง */
  var addBase=(kind==='gd')?Math.max(1,pos.length):pos.length;
  if(val && idx>=addBase){ var ak=pjGdAddKey(bid,kind); if(_pjGdAdd[ak]>0) _pjGdAdd[ak]--; }
  var tgt=(idx<pos.length)?pos[idx]:-1;
  if(!val){ if(tgt>=0) ids.splice(tgt,1); }
  else {
    /* §gdLead · คนเดียวลงได้ช่องเดียว · เลือกคนที่อยู่ช่องอื่นของกลุ่มเดียวกัน = สลับที่กัน
       ไม่ใช่ลบคนเดิมทิ้ง · ช่องแรกคือมัคคุเทศก์ผู้รับผิดชอบใบสั่งงาน การ "ตั้งคนที่สอง
       ขึ้นเป็นหัวหน้า" จึงต้องทำได้ด้วยการเลือกเขาลงช่อง Guide 1 ตรง ๆ
       ของเดิมทำแบบนั้นแล้วหัวหน้าคนเก่าหายไปจากใบเลย */
    var dup=ids.indexOf(val);
    if(dup>=0 && dup!==tgt){
      if(tgt>=0){ ids[dup]=ids[tgt]; ids[tgt]=val; }   /* สลับที่ */
      else { ids.splice(dup,1); ids.push(val); }       /* ย้ายลงช่องที่เพิ่งเปิด */
    }
    else if(tgt>=0) ids[tgt]=val;
    else ids.push(val);
  }
  goAsnSet(_poDate,bid,{g:ids, other:(+A.other||0), sign:(+A.sign||0)});
  renderPierJob();
}
function pjFreePick(bid, slot, el){
  if(!poGuard()) return;
  pjPick(bid, slot, String(el&&el.value||'').trim());
}
function pjPick(bid, slot, val){
  var J=pjOf(_poDate,bid);
  if(slot==='cap') J.cap=val;
  else if(slot==='asst') J.asst=val;
  else if(slot.indexOf('crew')===0){ var i=+slot.slice(4); var a=J.crew.slice(); while(a.length<=i) a.push(''); a[i]=val; J.crew=a; }
  else if(slot.indexOf('island')===0){ var j=+slot.slice(6); var b=J.island.slice(); while(b.length<=j) b.push(''); b[j]=val; J.island=b; }
  pjSet(_poDate,bid,{cap:J.cap,asst:J.asst,crew:J.crew,island:J.island});
  renderPierJob();
}
/* §pjWorkCode · ลำที่ไม่ได้ออกเรือ · ใบงานเปลี่ยนช่องเป็นช่างไปแล้ว แต่ตารางการทำงาน
   ยังลงรหัสเส้นทางให้ เพราะมันตัดสินจากสถานะเรือ ไม่ได้ถามว่าวันนั้นมีทริปไหม
   แก้ด้วยการให้ "คนทำใบงาน" เป็นคนบอกเองว่าวันนี้คนบนใบนี้ทำงานอะไร แล้วตารางอ่านตาม
   ว่างไว้ = ให้ระบบเดา (มีใบซ่อมเปิด → รหัสงานซ่อม · ไม่มี → ปล่อยเป็นช่องค้างให้ไปวางเอง) */
function pjWcAuto(ST){ return (ST && ST.mj && ST.mj.length) ? paMtCode() : ''; }
function pjWcSet(bid, val){ pjSet(_poDate,bid,{wc:String(val||'')}); renderPierJob(); }
function pjWcRow(bid, cur, ro, ST){
  var au=pjWcAuto(ST);
  var cs=((typeof paCodes==='function')?paCodes():[]).filter(function(c){ return c && c.kind==='work'; });
  var seen={}; cs.forEach(function(c){ seen[c.code]=1; });
  if(cur && !seen[cur]) cs.push({code:cur, label:'(ไม่มีในทะเบียน)'});
  var sel='<select'+pjOn('change','wcSet',{bid:bid})+(ro?' disabled':'')
    +' title="รหัสนี้จะไปขึ้นในตารางการทำงานให้ทุกคนที่อยู่บนใบนี้">'
    +'<option value=""'+(cur?'':' selected')+'>'
      +(au?('อัตโนมัติ · '+poE(au)):'ยังไม่ระบุ')+'</option>'
    +cs.map(function(c){ return '<option value="'+poE(c.code)+'"'+(c.code===cur?' selected':'')+'>'
        +poE(c.code)+(c.label?(' · '+poE(c.label)):'')+'</option>'; }).join('')
    +'</select>';
  return pjRow('รหัสในตารางงาน', sel, null);
}
/* §mealTrip · '' = ตามเส้นทาง · '-' = วันนี้ไม่มีอาหาร · อื่น ๆ = id ร้าน */
function pjMvSet(bid, val){ pjSet(_poDate,bid,{mv:String(val||'')}); renderPierJob(); }
function pjNote(bid,txt){ pjSet(_poDate,bid,{note:String(txt||'').slice(0,400)}); }
/* §pjLock · แถบการ์ดเลื่อนแนวนอน · วาดใหม่แล้วเด้งกลับซ้ายสุด จะกดล็อกลำที่ห้าไม่ได้เลย
   จำตำแหน่งไว้ก่อน แล้วคืนให้หลังวาดเสร็จ */
function pjKeep(fn){
  var w=document.querySelector('.pj-host.sk .pj-strip');
  var x=w?w.scrollLeft:0, y=window.scrollY;
  fn();
  var w2=document.querySelector('.pj-host.sk .pj-strip');
  if(w2) w2.scrollLeft=x;
  try{ window.scrollTo(0,y); }catch(_){}
}
function pjLockSet(bid,v){
  if(!poCanEdit()) return;
  pjSet(_poDate,bid,{lock:v?1:0});
  pjKeep(function(){ renderPierJob(); });
}
function pjWbSet(bid,t,c){ if(!poGuard()) return; pjSet(_poDate,bid,{wb:t,wbc:c}); renderPierJob(); }
/* ══ §pjWbTxt (2026-09-23) · พิมพ์ชื่อสีเองได้ ═══════════════════════════════
   ชุดสีมาตรฐานมาพร้อมชื่ออยู่แล้ว · ที่ขาดคือล็อตที่ได้สีนอกชุด
   ของเดิมกดเลือกสีเองแล้วชื่อถูกตั้งเป็นคำว่า "สีเอง" ตายตัว แก้ไม่ได้
   ใบงานเรือ (§pjWbName) โชว์ชื่อสีเพราะใบถูกปริ้นขาวดำและแคปส่งไลน์
   "สีเอง" บนใบนั้นจึงบอกอะไรไม่ได้เลย · และคนสั่งของต่อพิมพ์ชื่อสีไม่ได้
   ⚠ ชื่อกับสีเก็บแยกกันมาแต่ไหนแต่ไร (wb / wbc) · พิมพ์ชื่อโดยไม่เลือกสีก็ได้
      ใบงานรองรับอยู่แล้ว (มีสี = แถบสี+ชื่อ · มีแต่ชื่อ = ชื่อล้วน) */
function pjWbName(bid,t){
  if(!poGuard()) return;
  var o=pjOf(_poDate,bid)||{};
  var nm=String(t==null?'':t).trim().slice(0,24);
  var c=String(o.wbc||'');
  if(nm===String(o.wb||'')) return;        /* ไม่ได้เปลี่ยนอะไร · ไม่ต้องวาดใหม่ทั้งหน้า */
  if(!nm && !c) return;                    /* ว่างทั้งคู่ = ไม่มีอะไรให้เก็บ */
  pjSet(_poDate,bid,{wb:nm,wbc:c});
  renderPierJob();
}
/* เลือกสีเอง · ถ้าพิมพ์ชื่อไว้แล้วต้องไม่โดนคำว่า "สีเอง" ทับ
   ลำดับที่คนทำจริงคือพิมพ์ชื่อก่อนแล้วค่อยจิ้มสีให้ตรง · ทับแล้วต้องพิมพ์ใหม่ */
function pjWbCustom(bid,c){
  if(!poGuard()) return;
  var o=pjOf(_poDate,bid)||{};
  var nm=String(o.wb||'').trim();
  pjSet(_poDate,bid,{wb:(nm||'\u0e2a\u0e35\u0e40\u0e2d\u0e07'), wbc:String(c||'')});
  renderPierJob();
}
function pjPopToggle(id){
  var el=document.getElementById(id), was=el&&el.classList.contains('on');
  document.querySelectorAll('.pj-pop').forEach(function(p){ p.classList.remove('on'); });
  if(el && !was){ el.classList.add('on'); pjPopFit(el); }
  if(window.event) window.event.stopPropagation();
}
/* ══ §pjPopFit (2026-09-23) · การ์ดมี overflow:hidden ════════════════
   ป๊อปอัพที่ยาวเกินขอบล่างของการ์ดถูกกลืนหายไปเฉย ๆ โดยไม่มีอะไรบอก
   ที่หายคือแถวล่างสุด (เลือกสีเอง · ล้างสี) ซึ่งเป็นปุ่มที่ต้องกดจริง
   อาการเดียวกันกับ §pjStaleFit · เห็นของ แต่กดไม่ได้
   เลื่อนขึ้นเท่าที่กรอบยอมให้ · ไม่พลิกขึ้นทั้งก้อนเพราะบางใบกรอบเตี้ยกว่าป๊อปอัพ
   จำค่า top เดิมไว้ที่ตัวเอง · เปิดซ้ำต้องเริ่มนับจากที่เดิมทุกครั้ง ไม่งั้นขยับขึ้นเรื่อย ๆ */
function pjPopFit(el){
  try{
    if(el._pjTop==null) el._pjTop=el.style.top||'';
    el.style.top=el._pjTop;
    var n=el.parentElement, box=null;
    while(n && n!==document.body){
      var cs=getComputedStyle(n);
      if(/hidden|clip|auto|scroll/.test(cs.overflowY)){ box=n.getBoundingClientRect(); break; }
      n=n.parentElement;
    }
    if(!box) return;
    var r=el.getBoundingClientRect();
    var over=r.bottom-(box.bottom-6);
    if(over<=0) return;
    var room=r.top-(box.top+6);                 /* ที่ว่างเหนือป๊อปอัพในกรอบเดียวกัน */
    var up=Math.min(over, Math.max(0, room));
    if(up<=0) return;
    var cur=parseFloat(getComputedStyle(el).top);
    if(!isFinite(cur)) cur=0;
    el.style.top=(cur-up)+'px';
  }catch(_){}
}
/* แต้มสีโปรแกรม · เขียนลง ROUTES เลย จึงเปลี่ยนพร้อมกันทุกหน้าที่โชว์เส้นทางนี้ */
function pjProgColor(rid,hex){
  // §pierEdit · ฟีเจอร์นี้ทำมาให้คนหน้าท่าใช้ · เขาไม่มีวันได้สิทธิ์ "ตั้งค่า"
  //   ค่าที่เปลี่ยนคือสีป้ายของโปรแกรม ไม่ใช่ราคาหรือโควตา · แก้ท่าเรือได้ก็พอ
  var okCfg=(typeof laCanEditArea==='function') ? laCanEditArea('config') : true;
  if(!okCfg && !poCanEdit()){ if(typeof laGuardEdit==='function') laGuardEdit('pier'); return; }
  for(var i=0;i<ROUTES.length;i++){ if(ROUTES[i].id===rid){ ROUTES[i].color=hex; break; } }
  // §pierBlob · ห้ามใช้ save('config') · มันมีด่านสิทธิ์ของตัวเองแล้ว return เงียบ
  //   คนหน้าท่าไม่มีสิทธิ์ config · สีจะเปลี่ยนบนจอแต่ไม่ถูกบันทึก แล้วเด้งกลับตอนรีเฟรช
  //   เขียนเฉพาะ routes ผ่านแคชกลาง · ตรงกับที่ตัดสินไว้ว่าแก้ท่าเรือได้ก็แต้มสีได้
  try{ if(typeof laBlob==='function'){ laBlob().routes=ROUTES; laBlobSave(); } else save('config'); }catch(_){}
  renderPierJob();
  if(window.event) window.event.stopPropagation();
}
/* ทีมประจำเรือ */
function pjTeamPull(bid){
  var T=pjTeam(bid);
  if(!T.cap && !T.asst && !(T.crew||[]).length){ alert('ลำนี้ยังไม่ได้ตั้งทีมประจำ · จัดคนวันนี้ให้เรียบร้อยแล้วกด "ตั้งเป็นทีมประจำ"'); return; }
  pjSet(_poDate,bid,{cap:T.cap||'',asst:T.asst||'',crew:(T.crew||[]).slice()});
  renderPierJob();
}
function pjTeamSave(bid){
  if(!poCanEdit()) return;
  var J=pjOf(_poDate,bid);
  if(!confirm('ตั้งคนของวันนี้เป็นทีมประจำของลำนี้?\n\nใบงานวันถัดไปจะเติมชุดนี้ให้อัตโนมัติ')) return;
  PIER_TEAM[bid]={cap:J.cap,asst:J.asst,crew:(J.crew||[]).filter(Boolean)};
  poPersist(); renderPierJob();
}
/* คัดลอกทั้งวัน */
function pjCopyYday(pier){
  if(!poCanEdit()) return;
  var d=new Date(_poDate+'T12:00:00'); d.setDate(d.getDate()-1);
  var prev=poYMD(d), boats=poBoats(_poDate,pier), n=0, skip=0;
  boats.forEach(function(B){
    /* §pjLock · ใบที่ยืนยันแล้วห้ามโดนทับ · ไม่งั้นปุ่มเดียวลบงานที่จัดเสร็จทิ้งทั้งท่า */
    if(pjOf(_poDate,B.bid).lock){ skip++; return; }
    var o=pjRaw(prev,B.bid); if(!o) return;
    pjSet(_poDate,B.bid,{cap:o.cap||'',asst:o.asst||'',crew:(o.crew||[]).slice(),
                         island:(o.island||[]).slice(), wb:o.wb||'', wbc:o.wbc||''});
    n++;
  });
  if(!n && !skip) alert('เมื่อวาน ('+prev+') ยังไม่มีใบงานที่บันทึกไว้');
  else if(skip) alert('คัดลอกมา '+n+' ลำ · ข้าม '+skip+' ลำที่กดจัดเสร็จแล้วไว้'
    +'\n\nถ้าต้องการทับลำที่ข้ามไป ให้กดแก้ไขที่ท้ายการ์ดของลำนั้นก่อน');
  pjKeep(function(){ renderPierJob(); });
}
/* จัดไกด์ · ใช้หน้าเดิม แล้วรีเฟรชกลับมาที่ใบงาน */
function pjGuideOpen(bid){ try{ _pckDate=_poDate; goSetupOpen(bid); }catch(_){} }
/* §gjCard (2026-09-05) · พิมพ์ใบงานไกด์ของลำนี้ได้จากท้ายการ์ด ไม่ต้องข้ามไปหน้าเช็คอิน
   คนที่จัดคนลงเรืออยู่ที่หน้านี้ · พิมพ์ตรงที่จัดเสร็จคือจังหวะที่ใบถูกต้องที่สุด
   ปุ่มบนหน้าเช็คอินหน้าท่ายังอยู่เหมือนเดิม อันนี้เพิ่มมา ไม่ได้ย้าย
   pckGuideJobOrder อ่านวันจาก _pckDate ของหน้าเช็คอิน · หน้านี้เดินวันด้วย _poDate
   ไม่สลับให้ = ได้ใบของวันที่หน้าเช็คอินค้างไว้ ไม่ใช่วันที่เห็นอยู่ตรงหน้า
   คืนค่าเดิมทุกครั้ง หน้าเช็คอินจะได้ไม่ถูกเลื่อนวันตามไปเงียบ ๆ */
function pjGuideJob(bid){
  var keep=_pckDate;
  try{ _pckDate=_poDate; pckGuideJobOrder(bid); }
  finally{ _pckDate=keep; }
}
function pjGuideJobMap(date){
  var m={};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    var base=O.boatId||t.charterBoatId||''; if(!base) return;
    try{ if((typeof pckVoidInfo==='function') && pckVoidInfo(b,date,t)) return; }catch(_){}
    var sp=null; try{ sp=(typeof bkBoatSplits==='function')?bkBoatSplits(b,date):null; }catch(_){}
    if(sp && sp.length>1) sp.forEach(function(x){ if(x.boatId) m[x.boatId]=(m[x.boatId]||0)+1; });
    else m[base]=(m[base]||0)+1;
  });
  return m;
}

function pjCard(B, pier, ro){
  var bid=B.bid, rt=B.route||{}, J=pjOf(_poDate,bid), SUB=pjSubList(_poDate,bid), n=Object.keys(SUB).length;
  var ST=B._st||pjBoatSt(_poDate,B.boat,!!rt.id), SM=PJ_ST[ST.k]||PJ_ST.idle;
  var going=(ST.k==='run');   /* §pjStWin · clash ไม่มีแล้ว · ลำที่ช่างเอาขึ้นทำไม่ใช่ลำที่วิ่ง */
  /* §pjLock · ro = ไม่มีสิทธิ์แก้เลย · lk = มีสิทธิ์ แต่ใบนี้ปิดไปแล้ว
     ทุกช่องที่เขียนค่าลงใบงานใช้ lro · ส่วนจานสีของโปรแกรม/สถานะยังใช้ ro
     เพราะนั่นเป็นค่าของเส้นทาง ไม่ใช่ของใบงานลำนี้วันนี้ */
  var lk=!!J.lock, lro=(ro||lk);
  var colRaw=(typeof pckBoatColor==='function')?pckBoatColor(bid):'#185FA5';
  var col=going?colRaw:pjMute(colRaw);
  var pcol=rt.color||'#5A6270';
  var pax=pjPax(_poDate,bid,pier), GF=pjGuidesFull(_poDate,bid), G=GF.map(function(x){ return x.name; });
  var langs=Object.keys(pax.langs);
  var wbc=J.wbc||'', wbt=J.wb||'';
  var pid='pjpop-'+bid.replace(/[^A-Za-z0-9_-]/g,'_');
  var wid='pjwb-'+bid.replace(/[^A-Za-z0-9_-]/g,'_');
  /* §gdIdle (2026-09-07) · ปุ่ม "จัดไกด์" อยู่ทุกใบ ลำที่ไม่ได้ออกก็จ่ายไกด์ได้
     แต่ช่องนี้เคยผูกกับ going · จ่ายเสร็จแล้วไม่มีที่ให้โผล่ ทั้งบนจอและบนกระดาษ
     แยกเป็นก้อนเดียวแล้วเรียกสองที่ · ออกเรือ = โชว์เสมอ
     ไม่ได้ออก = โชว์เมื่อมีคนอยู่จริง ใบที่ยังไม่จ่ายจะได้ไม่รก */
  var gdHas=(GF.length>0 || (+GF.other||0)>0);
  var gdSec=function(){ return pjSecHd('Guides &amp; Trainee','guide')
        /* §gdRole · เดิมมี 3 ช่องตายตัว · จ่ายไกด์ 5 คนแล้วคนที่ 4-5 หายเงียบ
           ตอนนี้แสดงทุกคนที่จ่ายไว้จริง พร้อมป้ายภาษา แล้วแยกแถวฝึกงาน/สตาฟ */
        + (function(){
            var gd=GF.filter(function(x){ return x.guide; });
            var tr=GF.filter(function(x){ return !x.guide; });
            /* §gdSel · แก้ไม่ได้ (ไม่มีสิทธิ์ หรือใบปิดไปแล้ว) = อ่านอย่างเดียวเหมือนเดิม
               §pjG1 · เดิมใบที่ยังไม่ได้จัดไกด์ขึ้น Guide 1 สองแถวซ้อนกัน
               ช่องว่างมาจากตัวเติมอยู่แล้ว ไม่ต้องใส่ช่องแรกแยกอีก */
            if(lro){
              /* §gdLb · ชื่อช่องที่ตั้งทับไว้ต้องขึ้นตรงกันทั้งสองโหมด
                 ไม่งั้นคนที่ดูอย่างเดียวเห็นคนละชื่อกับคนที่แก้ได้ */
              var o=gd.map(function(x,i){
                return pjGuideRow(pjSlotLb('gd',pjGdSlot('gd',i),pjGdDefLb('gd',i),bid), x.name, x.langs); }).join('');
              for(var i=gd.length; i<3; i++)
                o+=pjGuideRow(pjSlotLb('gd',pjGdSlot('gd',i),pjGdDefLb('gd',i),bid),'',[]);
              var trTxt=tr.map(function(x){ return x.name; }).join(' · ');
              var trN=tr.length+(+GF.other||0);
              if(!trTxt && GF.other>0) trTxt=GF.other+' คน';
              return o+pjRow(poE(pjSlotLb('gd',pjGdSlot('tr',0),pjGdDefLb('tr',0),bid)),
                (trTxt?('<div class="v">'+poE(trTxt)+'</div>'):'<div class="v e">—</div>')
                +(trN>1?('<span class="pj-lgs"><span class="pj-lg" style="background:#F1EFE8;color:#6B6B63">'
                         +trN+' คน</span></span>'):''), null);
            }
            /* §gdSel · ช่องเลือกได้ · §gdAdd · โชว์เฉพาะช่องที่ใส่แล้ว ที่เหลืออยู่หลังปุ่ม
               "เพิ่มคน" แบบเดียวกับกลุ่มลูกเรือ · ช่อง Guide 1 โชว์เสมอแม้ยังไม่ได้ใส่ใคร
               ใบเปล่าจะได้มีที่ให้เริ่ม */
            var taken={}; GF.forEach(function(x){ if(x.id) taken[x.id]=1; });
            var busy=pjGdBusy(_poDate,bid);
            /* ช่องที่กดเปิดบวกเพิ่มจากช่องที่มีอยู่ · ไม่ใช่ Math.max กับมัน
               ไม่งั้นกดเพิ่มบนใบเปล่าแล้วหน้าจอไม่ขยับ (ช่อง Guide 1 กลืนไปเอง) */
            var nG=Math.max(1, gd.length)+pjGdAddN(bid,'gd');
            var nT=tr.length+pjGdAddN(bid,'tr');
            var out='', k;
            /* §gdLb · แถวที่เกินจากช่องที่มีอยู่ = แถวที่กดเปิดไว้ · ปิดทิ้งได้
               ฐานของไกด์รวมช่องแรกที่โชว์เสมอ ช่อง Guide 1 จึงไม่มีปุ่มปิด */
            var baseG=Math.max(1, gd.length), baseT=tr.length;
            var lead=pjGdLead(bid);   /* §gdLead */
            for(k=0; k<nG; k++)
              out+=pjGdRow(pjGdDefLb('gd',k), bid, 'gd', k,
                    (gd[k]||{}).id||'', (gd[k]||{}).langs||[], taken, busy, k>=baseG, lead);
            for(k=0; k<nT; k++)
              out+=pjGdRow(pjGdDefLb('tr',k), bid, 'tr', k,
                    (tr[k]||{}).id||'', (tr[k]||{}).langs||[], taken, busy, k>=baseT);
            /* ช่อง "อื่นๆ ที่ไม่อยู่ในทะเบียน" ของใบสั่งงาน · เป็นจำนวน ไม่มีชื่อให้เลือก
               ตั้งได้ที่หน้าต่างจัดไกด์ · โชว์ไว้ให้ยอดบนกระดาษกับบนการ์ดตรงกัน */
            if(+GF.other>0) out+=pjRow('อื่นๆ (ไม่มีชื่อ)',
              '<div class="v">'+(+GF.other)+' คน</div>', null);
            /* §gdAdd · ปุ่มเพิ่มช่อง · ไกด์ไม่มีจำนวนช่องตายตัวเหมือนลูกเรือ
               ตัวเลขข้างปุ่มจึงบอก "คนที่ยังว่างในทะเบียน" ซึ่งเป็นเพดานจริงของช่องนี้
               หมดทะเบียนแล้ว = ปุ่มกดไม่ได้ พร้อมบอกว่าไปเพิ่มคนได้ที่ไหน */
            var left=goGuides().filter(function(g){
              return g.active!==false && !taken[g.id]; }).length;
            var aid='pjga_'+String(bid).replace(/[^A-Za-z0-9_-]/g,'_');
            out+='<div class="pj-addw">'
              +'<button class="pj-addb"'+pjOn('click','popToggle',{id:aid})+(left?'':' disabled')
                +' title="'+(left?'เพิ่มช่องไกด์ หรือช่อง ผช.ไกด์ / สตาฟ'
                              :'ทุกคนในทะเบียนไกด์ลงลำนี้หมดแล้ว — เพิ่มคนใหม่ได้ที่ปุ่ม จัดไกด์ › ทะเบียนไกด์')+'">'
                +'&#65291; เพิ่มคน</button>'
              +'<span class="pj-addn">'+(left?('เหลือ '+left+' คนในทะเบียน'):'ทะเบียนหมดแล้ว')+'</span>'
              +'<div class="pj-pop pj-addp" id="'+aid+'"><div class="ph">เลือกช่องที่จะเพิ่ม</div>'
                /* §gdLb · ชื่อในเมนูต้องเป็นชื่อที่ตั้งทับไว้ ไม่ใช่ชื่อตั้งต้น
                   ไม่งั้นเมนูเรียกช่องคนละชื่อกับที่เห็นบนการ์ด */
                +'<button'+pjOn('click','gdAddSlot',{bid:bid,kind:'gd'})+'>'
                  +poE(pjSlotLb('gd',pjGdSlot('gd',nG),pjGdDefLb('gd',nG),bid))+'</button>'
                +'<button'+pjOn('click','gdAddSlot',{bid:bid,kind:'tr'})+'>'
                  +poE(pjSlotLb('gd',pjGdSlot('tr',nT),pjGdDefLb('tr',nT),bid))+'</button>'
                /* §gdLb · แถวที่เพิ่มมาเปลี่ยนชื่อตำแหน่งได้ · ต้องบอกตรงนี้
                   ไม่งั้นไม่มีอะไรชวนให้ลองคลิกที่ชื่อช่อง */
                +'<div class="pf">เพิ่มแล้วคลิกที่ชื่อช่องเพื่อตั้งชื่อตำแหน่งเองได้'
                  +' · เลือกกลุ่มให้ถูกก่อน เพราะกลุ่มเป็นตัวกำหนดว่าจะเห็นใครในช่องเลือก</div>'
              +'</div></div>';
            /* จำนวนคนของกลุ่มนี้ · วางหัวกลุ่มแบบเดียวกับ "N คน" ของลูกเรือ */
            return '<div class="pj-slotn">'+(gd.length+tr.length+(+GF.other||0))+' คน</div>'
              +out;   /* §pjKit · ภาษาย้ายออกไปเป็นหัวข้อของตัวเองข้างล่าง */
          })(); };
  var h='<div class="bc'+(going?'':' dim')+(ST.stale?' stale':'')+(lk?' lk':'')+'" data-st="'+ST.k+'">'
   +'<div class="top" style="background:'+col+'">'
     +'<div class="trow"><div class="l"><div class="bn">'+poE(B.boat.name||bid)+'</div>'
       +'<div class="be">'+poE(B.boat.type||'')+(B.boat.engineCount?(' &middot; '+B.boat.engineCount+' Eng'):'')
       +(B.boat.licensePax?(' &middot; '+B.boat.licensePax+' ที่นั่ง'):'')+'</div></div>'
     +'<div><div class="tm">'+poE(B.dep||'--:--')+'</div><div class="tmL">DEPARTURE</div></div></div>'
     /* §pjDocs · ใบอนุญาตใช้เรือ + ใบเข้าเกาะของโปรแกรมวันนี้ */
     + pjDocsHtml(B.boat, rt, _poDate)
   +'</div>'
   +'<div class="pg" style="background:'+(rt.id?pcol:pjBand(ST.k))+'">'
     /* §pjSame · ของเดิมบรรทัดล่างถอยไปใช้ SM.t เป็นค่าสำรอง · ลำที่ไม่มี loc/note
        จึงขึ้นชื่อสถานะซ้ำกันสองบรรทัด · เปลี่ยนเป็นชื่อเรือบน สถานะล่าง
        อ่านคู่กับใบที่ออกทริป (ชื่อโปรแกรมบน เกาะล่าง) ได้เป็นแบบเดียวกัน */
     +'<div class="pn">'+(rt.id?poE(rt.name||B.rid)
        :(B._away?('วันนี้ไปวิ่งที่ '+poE(((PO_PIERS.filter(function(x){ return x.k===(B._away.route.pier||''); })[0])||{}).n||B._away.route.pier||'ท่าอื่น'))
                 :poE(B.boat.name||bid)))+'</div>'
     +'<div class="pr">'+(rt.id?poE(rt.islands||'')
        :(B._away?poE(B._away.route.name||'')
                 :poE([SM.t, ST.loc||'', ST.note||''].filter(Boolean).join(' \u00b7 '))))+'</div>'
     +(ro?'':'<button class="pj-pen"'+pjOn('click','popToggle',{id:pid})+' title="'+(rt.id?'แต้มสีโปรแกรมนี้':'แต้มสีสถานะนี้')+'">&#9998;</button>')
     /* §pjStColor · ลำที่ไม่มีโปรแกรม แถบนี้แทนสถานะ · จานสีจึงต้องแก้สีของสถานะ ไม่ใช่ของโปรแกรม */
     +(rt.id
        ? ('<div class="pj-pop" id="'+pid+'"><div class="ph">สีของโปรแกรม '+poE(rt.name||'')+'</div><div class="pj-sws">'
            +PJ_PAL.map(function(c){ return '<div class="pj-sw'+(c.toLowerCase()===String(pcol).toLowerCase()?' on':'')+'" style="background:'+c+'"'+pjOn('click','progColor',{rid:B.rid,c:c})+'></div>'; }).join('')
            +'</div>'
            +'<label class="pj-cus">เลือกสีเอง<input type="color" value="'+poE(pcol)+'"'+pjOn('change','progColorPick',{rid:B.rid})+pjOn('click','stop')+'></label>'
            +'<div class="pf">เปลี่ยนแล้วมีผลกับโปรแกรมนี้ <b>ทุกลำทุกวัน</b> และทุกหน้าที่โชว์เส้นทางนี้</div></div>')
        : ('<div class="pj-pop" id="'+pid+'"><div class="ph">สีของสถานะ '+poE(SM.t)+'</div><div class="pj-sws">'
            +PJ_PAL.map(function(c){ return '<div class="pj-sw'+(c.toLowerCase()===String(pjBand(ST.k)).toLowerCase()?' on':'')+'" style="background:'+c+'"'+pjOn('click','stColor',{k:ST.k,c:c})+'></div>'; }).join('')
            +'</div>'
            +'<label class="pj-cus">เลือกสีเอง<input type="color" value="'+poE(pjBand(ST.k))+'"'+pjOn('change','stColorPick',{k:ST.k})+pjOn('click','stop')+'></label>'
            +'<div class="pf">เปลี่ยนแล้วมีผลกับ<b>ทุกลำที่อยู่สถานะนี้</b> · ลำที่ออกทริปยังใช้สีของโปรแกรมเหมือนเดิม'
            +(pjStIsCustom(ST.k)?('<button class="pj-rst"'+pjOn('click','stColorReset',{k:ST.k})+'>คืนค่าสีเดิมของสถานะนี้</button>'):'')
            +'</div></div>'))
     +'</div>'
   +'<div class="stbar"><span class="stw">'
     +'<span class="pj-stq" style="background:'+SM.bg+';color:'+SM.fg+';border:1px solid '+SM.bd+'">'+poE(SM.t)+'</span>'
     +(going
        ? (n?('<span class="pj-sub">'+n+' SUB'+(n>1?'S':'')+'</span>')
             :(J._std?'<span class="pj-std">&#10003; ทีมประจำ</span>':'<span class="pj-std">&#10003; STANDARD</span>'))
        : '')
     /* §pjLock2 · คนที่มีสิทธิ์แก้อ่านสถานะจากตัวปุ่มมุมขวาได้อยู่แล้ว · ป้ายนี้ไว้ให้คนที่ไม่มีปุ่ม */
     +((lk&&ro)?('<span class="pj-lock" title="ใบนี้ยืนยันแล้ว">&#128274; จัดเสร็จแล้ว</span>'):'')
     +(going&&pax.n?('<span class="pj-stmeta">'+pax.n+' booking</span>'):'')
     /* §pjStWin · แผนค้าง · บอกว่าค้างเส้นไหน แล้วให้เอาออกได้ตรงนี้เลย */
     +(ST.stale?('<span class="pj-stale" title="'+poE('วันนี้ยังมีโปรแกรม "'+((rt&&rt.name)||B.rid||'')
          +'" วางไว้บนกระดาน Boat Operation ทั้งที่เรือไม่พร้อม '
          +'· หน้าอื่น (Trip P&L · Dashboard · Departures) ก็ยังอ่านแถวนี้อยู่')+'">'
        /* §pjStaleFit · ชื่อเส้นทางอยู่ในสแปนของตัวเอง เพื่อให้มันเป็นตัวที่ถูกตัดเมื่อที่ไม่พอ
           ไม่ใช่ปุ่ม · ก่อนหน้านี้ทั้งชิปเป็น nowrap ก้อนเดียว ชื่อยาว ๆ จึงดันปุ่ม "เอาออก"
           ออกไปนอกขอบการ์ด แล้วโดน overflow:hidden ของ .stw กลืนหายไปทั้งปุ่ม
           ผลคือเห็นคำเตือนแต่กดเอาโปรแกรมออกไม่ได้เลย (วัดที่ 1920 ปุ่มเลยขอบไป 195px) */
        +'<span class="t">&#9888; โปรแกรมค้าง</span>'   /* ชื่อเส้นทางไม่ต้องพูดซ้ำตรงนี้ · แถบชื่อโปรแกรมอยู่เหนือแถบนี้ขึ้นไปสองบรรทัดเอง */
        +(ro?'':('<button'+pjOn('click','opDrop',{bid:bid})+'>เอาออก</button>'))+'</span>'):'')
     /* §pjPierNow · ลำนี้ไม่ใช่ของประจำท่า หรือไม่ได้อยู่ที่ท่า · ต้องบอกให้เห็นตั้งแต่แถบสถานะ */
     +((B._asn && B._asn.toPier===pier && B._asn.fromPier && B._asn.fromPier!==pier)
        ? ('<span class="pj-move" title="ใบย้ายท่า '+poE(B._asn.startDate||'')+' – '+poE(B._asn.endDate||'')
            +(B._asn.reason?(' \u00b7 '+poE(B._asn.reason)):'')+'">ย้ายมาจาก '
            +poE((typeof PIER_LABELS!=='undefined'&&PIER_LABELS[B._asn.fromPier])||B._asn.fromPier)
            +(B._asn.type==='permanent'?' \u00b7 ถาวร':(B._asn.endDate?(' \u00b7 ถึง '+poE(pjDocDate(B._asn.endDate))):''))+'</span>')
        : '')
     +(B._shop?('<span class="pj-shop" title="เรือไม่ได้อยู่ที่ท่า · ท่านี้เป็นผู้รับผิดชอบ">อยู่อู่ '+poE(B._shop)+'</span>'):'')
     +((!going&&ST.mj.length)?('<span class="pj-stmeta" title="'+poE(ST.mj.map(function(m){ return (m.no||'')+' '+(m.title||m.type||''); }).join(' \u00b7 '))+'">งานซ่อม '+ST.mj.length+' ใบ'
        +(ST.mj[0]&&ST.mj[0].no?(' \u00b7 '+poE(ST.mj[0].no)):'')+'</span>'):'')
     +'</span>'
     /* §pjLock2 · ปุ่มปิด/เปิดใบ · มุมขวาของแถบสถานะ · คนที่แก้ไม่ได้ไม่ต้องเห็น */
     +(ro?''
        :(lk
          ? ('<button class="pj-lb ed"'+pjOn('click','lockSet',{bid:bid,on:0})+' title="เปิดใบนี้ให้แก้ไขอีกครั้ง">&#9998; แก้ไข</button>')
          : ('<button class="pj-lb"'+pjOn('click','lockSet',{bid:bid,on:1})+' title="ปิดใบนี้ · ต้องกดแก้ไขก่อนถึงจะเปลี่ยนคนได้">&#10003; จัดเสร็จแล้ว</button>')))
   +'</div>'
   /* §pjWork · ชื่อตำแหน่งเปลี่ยนตามงาน · ชื่อคนยังมาจากทะเบียนพนักงานท่าเรือชุดเดิม
      ช่องที่เก็บยังเป็น cap/asst/crew/island ชุดเดิม จึงไหลเข้าตารางการทำงานเองอยู่แล้ว */
   /* §pjSame · ชื่อหัวข้อเดิมเปลี่ยนตาม SM.work · ใบสองใบที่ไม่ได้ออกเหมือนกัน
      แต่ใบหนึ่งมีงานอีกใบไม่มี เลยได้ชื่อหัวข้อคนละชุด อ่านเป็นคนละหน้าจอ */
   + pjSecHd(going?'Captain &amp; Crew':'ทีมงานวันนี้','crew')
   + (going?'':pjWcRow(bid, J.wc, lro, ST))   /* §pjWorkCode */
   /* §pjSlots · เดิมโชว์ครบ 7 ช่องเสมอ · ใบที่ใส่คนสองคนจึงมี "— ว่าง —" ค้างอีกห้าบรรทัด
      การ์ดสูงไม่เท่ากันและอ่านยากเวลาเรียงกันหลายลำ · โชว์เฉพาะช่องที่ใส่แล้ว
      ที่เหลืออยู่หลังปุ่ม "เพิ่มคน" · ใบเปล่าเหลือช่องแรกไว้หนึ่งช่องเสมอ จะได้มีที่ให้เริ่ม */
   + (function(){
       var KIND = going ? 'go' : 'wk';
       var SL = going
         ? [['cap','Captain',['กัปตัน','captain']],
            ['asst','Asst. Captain',['กัปตัน','captain']],
            ['crew0','Crew 1',['เด็กเรือ','crew','ลูกเรือ']],
            ['crew1','Crew 2',['เด็กเรือ','crew','ลูกเรือ']],
            ['crew2','Crew 3',['เด็กเรือ','crew','ลูกเรือ']],
            ['island0','Island Staff 1',['อุปกรณ์','equipment','ไกด์เกาะ']],
            ['island1','Island Staff 2',['อุปกรณ์','equipment','ไกด์เกาะ']]]
         : [['cap','หัวหน้าช่าง',['ช่าง','engineer','mechanic']],
            ['asst','ช่าง 1',['ช่าง','engineer','mechanic']],
            ['crew0','ช่าง 2',['ช่าง','engineer','mechanic']],
            ['crew1','ช่วยงาน 1',[]],
            ['crew2','ช่วยงาน 2',[]],
            ['island0','ช่วยงาน 3',[]],
            ['island1','ช่วยงาน 4',[]]];
       /* ช่องแรก (กัปตัน / หัวหน้าช่าง) โชว์เสมอ แม้ยังไม่ได้ใส่ใคร
          ใบเปล่าจะได้มีที่ให้เริ่ม และไม่หายไปตอนกดเพิ่มช่องอื่นเป็นช่องแรก */
       var shown=[], rest=[];
       SL.forEach(function(x,i){
         if(i===0 || pjSlotVal(J,x[0]) || _pjAdd[pjSlotKey(bid,x[0])]) shown.push(x); else rest.push(x);
       });
       var nMan=SL.filter(function(x){ return pjSlotVal(J,x[0]); }).length;
       var out=shown.map(function(x){
         return pjSlotRow(pier,bid,KIND,x[0],x[1],pjSlotVal(J,x[0]),SUB[x[0]],x[2],lro,B.boat);
       }).join('');
       if(!lro && rest.length){
         var aid='pja_'+bid;
         out+='<div class="pj-addw">'
           +'<button class="pj-addb"'+pjOn('click','popToggle',{id:aid})+'>&#65291; เพิ่มคน</button>'
           +'<span class="pj-addn">เหลือ '+rest.length+' ช่อง</span>'
           +'<div class="pj-pop pj-addp" id="'+aid+'"><div class="ph">เลือกช่องที่จะเพิ่ม</div>'
           + rest.map(function(x){
               return '<button'+pjOn('click','slotAdd',{bid:bid,kind:x[0]})+'>'
                 +poE(pjSlotLb(KIND,x[0],x[1],bid))+'</button>'; }).join('')
           +'</div></div>';
       }
       return '<div class="pj-slotn">'+nMan+' คน</div>'+out;
     })()
   + '<div class="pj-licbox">'+(function(){ try{
       // §pjAll · ลำที่ไม่ได้ออก ไม่ต้องเตือนใบอนุญาต · ไม่มีใครต้องคุมเรือ
       if(!going) return '<div class="pj-licnone">ไม่ต้องตรวจใบอนุญาต — ไม่ได้ออกเรือวันนี้</div>';
       var ids=[J.cap,J.asst].concat(J.crew||[]);
       var R=plCheckBoat(bid,ids);
       if(!R || !R.length) return '<div class="pj-licnone">ยังไม่ได้ตั้งทะเบียนประเภทใบอนุญาต</div>';
       return R.map(function(r){
         return '<div class="pl-res '+(r.lv==='ok'?'ok':(r.lv==='warn'?'warn':'bad'))+'"><b>'
           +(r.lv==='ok'?'&#10003;':(r.lv==='warn'?'&#9888;':'&#9940;'))+'</b> '+poE(r.t)+'</div>';
       }).join('');
     }catch(_){ return ''; } })()+'</div>'
   + (going
      ? ( gdSec()
        /* §pjKit · ภาษาที่ลูกค้าขอ · เป็นของที่ไกด์กับหน้าท่าต้องเห็นก่อนออกเรือ
           อยู่เป็นบรรทัดสุดท้ายของกลุ่มไกด์แล้วถูกมองข้ามตลอด */
        + pjSecHd('ภาษาที่ลูกค้าขอ','lang')
        + (function(){
            var nd=Object.keys(pax.langs||{});
            return '<div class="pj-langbox">'
              +(nd.length
                 ? nd.map(function(L){ return '<span class="pj-lgb">'+poE(L)+'</span>'; }).join('')
                 : '<span class="pj-noneb">ไม่มีคำขอภาษาในวันนี้</span>')
              +'</div>';
          })()
        /* §mealTrip · ร้านอาหารของลำนี้วันนี้ · ค่าเริ่มต้นมาจากเส้นทาง กดเปลี่ยนเฉพาะวันนี้ได้
           §pjKit · ชื่อร้านต้องอ่านออกจากระยะไกล · ครัวใช้ใบนี้จัดของ ไม่ได้มานั่งอ่านทีละบรรทัด */
        + pjSecHd('ครัว · ร้านอาหาร','kit')
        + (function(){
            var raw=mvTripRaw(_poDate,bid), V=mvForTrip(_poDate,bid,B.rid);
            var col=pjMvCol(V?V.id:''), nm=V?(V.name||V.id):'';
            var sel='<select'+pjOn('change','mvSet',{bid:bid})+(lro?' disabled':'')+'>'
              +'<option value=""'+(raw===''?' selected':'')+'>ตามเส้นทาง'
                +(mvForRoute(B.rid)?(' · '+poE(mvForRoute(B.rid).name||'')):' · ยังไม่ได้ตั้ง')+'</option>'
              + mvList().map(function(x){ return '<option value="'+poE(x.id)+'"'+(raw===x.id?' selected':'')+'>'
                  +poE(x.name||x.id)+' · '+(+x.priceAd||0)+'/'+(+x.priceCh||0)+'</option>'; }).join('')
              +'<option value="-"'+(raw==='-'?' selected':'')+'>ไม่มีอาหารวันนี้</option>'
              +'</select>';
            return '<div class="pj-kit">'
              +'<div class="pj-kitn" style="background:'+col[1]+';border-color:'+col[0]+'33">'
                +'<i style="background:'+col[0]+'"></i>'
                +'<b style="color:'+col[0]+'">'+(nm?poE(nm):(raw==='-'?'ไม่มีอาหารวันนี้':'ยังไม่ได้ตั้งร้าน'))+'</b>'
                +(V?('<span class="pr">'+(+V.priceAd||0)+' / '+(+V.priceCh||0)+' ฿</span>'):'')
                +(raw&&raw!=='-'?'<span class="pj-tag" title="เปลี่ยนเฉพาะวันนี้ · ไม่กระทบค่าปกติของเส้นทาง">วันนี้</span>':'')
              +'</div>'
              +'<div class="pj-kitsel">'+sel+'</div>'
            +'</div>';
          })() )
      /* §pjWork · ลำที่ไม่ได้ออก · ช่องนี้เปลี่ยนเป็น "งานที่ทำวันนี้" */
      : ( pjSecHd('งานของลำนี้','guide')   /* §pjSame · สองกรณีโชว์ช่องเดียวกันทุกช่อง */
        + (function(){
            var M=pjMjOf(_poDate,bid,ST.mj);
            if(!ST.mj.length){
              return pjTxtRow('สถานะ', SM.t)
                + pjTxtRow('ที่อยู่', ST.loc||'—')
                + pjTxtRow('ตั้งแต่', (ST.log&&ST.log.from)?pjDocDate(ST.log.from):'—');
            }
            var sel='<select'+pjOn('change','mjPick',{bid:bid})+(lro?' disabled':'')+'>'
              + ST.mj.map(function(m){ return '<option value="'+poE(m.id)+'"'+((M&&M.id===m.id)?' selected':'')+'>'
                  +poE((m.no?(m.no+' · '):'')+(m.title||m.type||'งานซ่อม'))+'</option>'; }).join('')
              +'</select>';
            var last='';
            try{ var L=(M&&M.progressLog)||[]; var e=L[L.length-1];
                 if(e) last=(e.date?(pjDocDate(e.date)+' · '):'')+String(e.text||e.note||e.detail||''); }catch(_){}
            return pjRow('งาน ('+ST.mj.length+')', sel, null)
              + pjTxtRow('ประเภท', M?((pjMjPlanned(M)?'ตามแผน':'ซ่อมแก้ไข')
                  +(M.startDate?(' · เริ่ม '+pjDocDate(M.startDate)):'')
                  +(M.location?(' · '+M.location):'')):'—')
              + pjTxtRow('คืบหน้า', last||'—');
          })()
        /* §gdIdle · ลำที่ไม่ได้ออกแต่มีไกด์จ่ายไว้ · ต้องเห็นบนใบ ไม่งั้นจ่ายแล้วหาย */
        + (gdHas?gdSec():'') ))
   + (going ? ( pjSecHd('Customer','cust')
   +'<div class="pj-wbrow"><span class="k">Wristband</span>'
     +'<span class="pj-wb"'+(lro?' data-on-click=""':pjOn('click','popToggle',{id:wid}))+' style="position:relative">'
       +'<i style="background:'+(wbc||'#F0F0EC')+'"></i>'+(wbt?poE(wbt):'<span style="color:#C9CFD8;font-weight:500">ยังไม่ระบุ</span>')
       +'<div class="pj-pop" id="'+wid+'" style="top:30px;left:0;right:auto;width:252px"><div class="ph">สีสายรัดข้อมือวันนี้</div>'
       +'<div class="pj-sws">'
       +PJ_WB.map(function(w){ return '<div class="pj-sw'+(w.c===wbc?' on':'')+'" title="'+w.t+'" style="background:'+w.c+'"'+pjOn('click','wbSet',{bid:bid,t:w.t,c:w.c})+'></div>'; }).join('')
       +'</div>'
       /* §pjWb2 · สายรัดเป็นของที่ซื้อมาเป็นล็อต · ล็อตไหนได้สีแปลกมาก็คีย์เองได้
          ไม่ต้องรอเพิ่มในโค้ด · และต้องล้างกลับเป็น "ยังไม่ระบุ" ได้ด้วย
          ของเดิมพอตั้งผิดแล้วเอาออกไม่ได้เลย */
       /* §pjWbTxt · ช่องชื่อสี · คลิกในช่องต้องไม่ปิดป๊อปอัพ
          ป๊อปอัพถูกเปิด/ปิดด้วย onclick ที่ span แม่ · คลิกอะไรข้างในก็เด้งขึ้นไปถึง
          ไม่หยุดไว้ = จิ้มช่องแล้วป๊อปอัพหุบทันที พิมพ์ไม่ได้เลย
          เก็บค่าตอน change (เปลี่ยนแล้วออกจากช่อง) · Enter = ออกจากช่อง */
       +'<div class="pj-wbn">'
         +'<span>ชื่อสี</span>'
         +'<input type="text" class="pj-wbni" maxlength="24" value="'+poE(wbt)+'" '
         +'placeholder="พิมพ์เอง เช่น ส้มอ่อน" '
         +pjOn('click','stop').slice(1)+' '
         +pjOn('keydown','enterBlur').slice(1)+' '
         +pjOn('change','wbName',{bid:bid}).slice(1)+'>'
       +'</div>'
       +'<div class="pj-wbx">'
         +'<label class="pj-wbc" title="เลือกสีเอง · ใช้กับล็อตที่สีไม่มีในชุดมาตรฐาน">'
           +'<input type="color" value="'+(wbc||'#888888')+'" '
           +pjOn('click','stop').slice(1)+' '
           +pjOn('change','wbCustom',{bid:bid}).slice(1)+'>'
           +'<span>เลือกสีเอง</span></label>'
         +(wbt?('<button type="button" class="pj-wbclr"'+pjOn('click','wbSet',{bid:bid,t:'',c:''})+'>ล้างสี</button>'):'')
       +'</div>'
       +'<div class="pf">เก็บแยกรายวันรายลำ</div></div></span>'
     +'<span style="flex:1"></span><span class="k">Group</span>'
     +(langs.length?langs.map(function(L){ return '<span class="pj-lang">'+poE(L)+'</span>'; }).join(''):'<span style="font-size:11px;color:#C9CFD8">—</span>')
   +'</div>'
   +'<div class="pj-pax">'
     +[['AD',pax.ad],['CHD',pax.chd],['INF',pax.inf],['FOC',pax.foc]].map(function(x){
        return '<div class="c"><div class="k">'+x[0]+'</div><div class="v"'+(x[1]?'':' style="color:#CFD4DC"')+'>'+x[1]+'</div></div>'; }).join('')
     +'<div class="c t"><div class="k">TOTAL</div><div class="v">'+(pax.ad+pax.chd+pax.inf+pax.foc)+'</div></div></div>' )
   /* §pjWork · ลำที่ไม่ได้ออกไม่มี ลค · ช่องนี้บอกช่วงเวลาของงานแทน */
   : ( pjSecHd('ช่วงงาน','cust')   /* §pjSame */
   +'<div class="pj-wbrow"><span class="k">ที่อยู่</span>'
     +'<span style="font-size:12px;font-weight:700">'+poE(ST.loc||'—')+'</span>'
     +'<span style="flex:1"></span>'
     +(ST.mj.length?('<span class="pj-lang">งานเปิด '+ST.mj.length+' ใบ</span>'):'')+'</div>'
   +(function(){
      var F=(ST.log&&ST.log.from)||'', T=(ST.log&&ST.log.to)||'';
      var d=0; try{ if(F) d=Math.max(0,Math.round((new Date(_poDate+'T12:00:00')-new Date(F+'T12:00:00'))/86400000))+1; }catch(_){}
      return '<div class="pj-pax">'
        +'<div class="c" style="flex:1.4"><div class="k">เริ่ม</div><div class="v" style="font-size:12px">'+(F?poE(pjDocDate(F)):'<span style="color:#CFD4DC">—</span>')+'</div></div>'
        +'<div class="c t" style="flex:1"><div class="k">วันที่</div><div class="v">'+(d||'<span style="color:#CFD4DC">—</span>')+'</div></div>'
        +'<div class="c" style="flex:1.4"><div class="k">กลับใช้งาน</div><div class="v" style="font-size:12px">'+(T?poE(pjDocDate(T)):'<span style="color:#CFD4DC">ยังไม่ระบุ</span>')+'</div></div>'
      +'</div>';
    })() ) )
   + pjSecHd('Note','note')
   +'<div class="pj-note"'+(lro?'':' contenteditable="true"')+' data-ph="พิมพ์หมายเหตุของลำนี้วันนี้…" '
     +pjOn('blur','note',{bid:bid}).slice(1)+'>'+poE(J.note||'')+'</div>'
   +'<div class="foot">'
     +'<button class="gh"'+pjOn('click','teamPull',{bid:bid})+(lro?' disabled':'')+'>&#8634; ดึงทีมประจำ</button>'
     +'<button'+pjOn('click','teamSave',{bid:bid})+(lro?' disabled':'')+'>ตั้งเป็นทีมประจำ</button>'
     +'<span style="flex:1"></span>'
     +'<button'+pjOn('click','guideOpen',{bid:bid})+'>จัดไกด์</button>'
   +'</div>'
   /* §gjCard · ท้ายสุดของการ์ด · เต็มความกว้าง จะได้ไม่โดนแถวปุ่มด้านบนบีบตกขอบ
      ตัวเลขบนปุ่มคือจำนวน booking ที่จะลงใบ · ไม่มีเลย = ปุ่มกดไม่ได้ พร้อมบอกว่าทำไม */
   +(function(){
      var gj=(_pjGjMap||{})[bid]||0;
      return '<div class="gjrow"><button'+pjOn('click','guideJob',{bid:bid})+(gj?'':' disabled')
       +' title="'+(gj? poE('พิมพ์ใบงานไกด์ของ '+(B.boat.name||bid)+' · '+_poDate+' · '+gj+' booking · A4 แนวนอน')
                     : poE('ลำนี้ยังไม่มีใบจองที่จัดเรือแล้วในวันนี้ — จัดเรือก่อนถึงพิมพ์ใบงานไกด์ได้'))+'">'
       +'&#128196; ใบงานไกด์'+(gj?('<span class="n">'+gj+'</span>'):'')+'</button></div>';
    })()
   +'</div>';
  return h;
}
/* §pjAlign · การ์ดวางเรียงกันเป็นแถบ · หัวข้อของแต่ละใบต้องอยู่ระดับเดียวกัน
   ถึงจำนวนแถวข้างในจะไม่เท่ากัน · ไม่งั้นสายตาต้องไล่หาหัวข้อใหม่ทุกใบ
   ทำหลังวาดเสร็จ เพราะความสูงจริงรู้ได้ตอนขึ้นจอแล้วเท่านั้น — ชื่อยาว ป้ายภาษา
   หรือ SUB ทำให้แถวเดียวกันสูงไม่เท่ากัน คำนวณจากจำนวนแถวล่วงหน้าจึงไม่พอ
   ไล่ทีละหัวข้อจากบนลงล่าง · เติมช่องว่างท้ายหัวข้อที่สั้นกว่าให้เท่าใบที่ยาวสุด
   ต้องไล่ตามลำดับ เพราะเติมหัวข้อบนแล้วตำแหน่งของหัวข้อล่างขยับตาม จึงวัดใหม่ทุกรอบ */
function pjAlignSecs(){
  try{
    var host=document.getElementById('pj-host-'+_poPier); if(!host) return;
    host.querySelectorAll('.pj-spx').forEach(function(e){ if(e.parentNode) e.parentNode.removeChild(e); });
    var cards=[];
    host.querySelectorAll('.pj-gh').forEach(function(h){
      var c=h.parentElement; if(c && cards.indexOf(c)<0) cards.push(c);
    });
    if(cards.length<2) return;
    /* §pjAlign2 · จับคู่ด้วยชื่อกลุ่ม ไม่ใช่ลำดับที่ · ใบที่ออกเรือมีภาษา/ครัวเพิ่มมา
       ถ้าจับด้วยลำดับ "ครัว" ของใบหนึ่งจะไปตรงกับ "ช่วงงาน" ของอีกใบ ซึ่งคนละเรื่องกัน
       ใบไหนไม่มีกลุ่มนั้นก็ข้ามไป · กลุ่มถัดไปที่มันมีจะไปตรงกับใบอื่นเอง
       ดันด้วยการแทรกช่องว่าง "ก่อน" หัวข้อ จึงไม่ต้องวัดความสูงของทั้งกลุ่ม */
    var CANON=['crew','guide','lang','kit','cust','note'];
    CANON.forEach(function(K, ki){
      if(ki>=CANON.length-1) return;   /* กลุ่มสุดท้ายไม่ต้องดัน · ช่องหมายเหตุยืดเองอยู่แล้ว */
      var row=[];
      cards.forEach(function(c){
        var h=Array.prototype.filter.call(c.children, function(e){
          return e.classList && e.classList.contains('pj-gh')
              && e.getAttribute('data-sec')===K; })[0];
        if(h) row.push({c:c, h:h});
      });
      if(row.length<2) return;
      var tops=row.map(function(x){ return x.h.offsetTop; });
      var mx=Math.max.apply(null,tops);
      row.forEach(function(x,k){
        var d=Math.round(mx-tops[k]); if(d<1) return;
        var sp=document.createElement('div');
        sp.className='pj-spx'; sp.style.height=d+'px';
        x.c.insertBefore(sp, x.h);
      });
    });
  }catch(_){}
}
function pjWide(n){ _pjW=n; try{ localStorage.setItem('la_pjw',String(n)); }catch(_){} renderPierJob(); }
function pjFilter(k){ _pjF=k; try{ localStorage.setItem('la_pjf',k); }catch(_){} renderPierJob(); }
function pjToggleIdle(){ _pjHideIdle=_pjHideIdle?0:1;
  try{ localStorage.setItem('la_pjhide', _pjHideIdle?'1':'0'); }catch(_){}
  renderPierJob(); }
function pjIsIdle(B, date){
  try{
    if(!B || !B.bid) return false;
    if(B._st && typeof pjGrp==='function' && pjGrp(B._st.k)==='go') return false;   /* ออกทริป = วางแล้ว */
    if(B.route && B.route.id) return false;
    var J=(typeof pjOf==='function')?pjOf(date, B.bid):null;
    if(J){
      if(J.cap || J.asst) return false;
      if((J.crew||[]).some(Boolean)) return false;
      if((J.island||[]).some(Boolean)) return false;
      if(String(J.wc||'').trim()) return false;
      if(String(J.note||'').trim()) return false;
      if(String(J.wb||'').trim() || String(J.mv||'').trim()) return false;
      if(J.lock) return false;                                  /* กด "จัดเสร็จแล้ว" = ตั้งใจว่าง */
      if(J.lb && Object.keys(J.lb).length) return false;
    }
    var A=(typeof goAsn==='function')?goAsn(date, B.bid):null;
    if(A && (((A.g||[]).length>0) || (+A.other||0)>0)) return false;
    return true;
  }catch(_){ return false; }
}
function pjApplyIdle(list, date){
  if(!_pjHideIdle) return list;
  return list.filter(function(B){ return !pjIsIdle(B, date); });
}
function pjDate(v){ if(v) _poDate=v; renderPierJob(); }
function pjShift(n){ var d=new Date(_poDate+'T12:00:00'); d.setDate(d.getDate()+n); _poDate=poYMD(d); renderPierJob(); }
function pjToday(){ _poDate=poYMD(new Date()); renderPierJob(); }
/* lifted out of pjPrint by tools/lift.mjs (var:css) · reads: fs, GAP */
function pjPrintCss(C){
  const { fs, GAP } = C;
  return '@page{size:A4 landscape;margin:8mm}'
   /* §poSign3 · สีในใบนี้เป็นข้อมูล ไม่ใช่ของประดับ · แถบสีคือโปรแกรมของแต่ละลำ
      เบราว์เซอร์ตัดสีพื้นหลังทิ้งตอนพิมพ์เป็นค่าเริ่มต้น ต้องบังคับให้พิมพ์สีเสมอ */
   +'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}'
   +'body{margin:0;background:#E9EBEF;font-family:"Sarabun","Noto Sans Thai",sans-serif;color:#1E293B}'
   +'.tb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:1160px;margin:0 auto 14px}'
   +'.tb button{border:1px solid #E2E8F0;background:#fff;border-radius:11px;padding:8px 15px;'
     +'font:700 12.5px inherit;color:#475569;cursor:pointer}'
   +'.tb button:hover{background:#F8FAFC;color:#0F172A}'
   +'.tb button.pri{background:#0F172A;border-color:#0F172A;color:#fff}'
   +'.tb button.img{background:#4F46E5;border-color:#4F46E5;color:#fff}'
   +'.tb button[disabled]{opacity:.55;cursor:progress}'
   +'.tb .hint{font-size:11px;color:#94A3B8}'
   +'.sheet{background:#fff;margin:0 auto;padding:18px 20px;border:1px solid #CBD5E1;border-radius:12px;'
     +'max-width:1880px;box-shadow:0 2px 12px rgba(15,23,42,.07)}'
   +'@media screen{body{padding:18px 16px 60px}}'
   +'@media print{body{background:#fff;padding:0}.tb{display:none}'
     +'.sheet{max-width:none;border:0;border-radius:0;box-shadow:none;padding:0;margin:0}}'
   /* §pjTop · หัวใบ · โครงเดียวกับหน้า Booking แต่พื้นขาว */
   /* §pjDate3 · หัวใบเป็นแถบ navy เต็มความกว้าง · แถบวันที่เป็นพื้นขาว
      สีทึบมีที่เดียวคือชื่อใบ · วันที่เด่นด้วยขนาด ไม่ใช่ด้วยสี */
   +'.shead{display:flex;align-items:center;justify-content:center;border-radius:8px;'
     +'padding:9px 20px 11px;background:linear-gradient(100deg,#16265C 0%,#27386F 52%,#16265C 100%)}'
   /* §pjDate · วันที่เคยแชร์บรรทัดกับชื่อท่า · ตัวเลข 38px ข้าง ๆ ชื่อท่า 26px
      อ่านแล้วเป็น "หัวใบที่มีวันที่อยู่ด้วย" ไม่ใช่ "ใบของวันนี้"
      ใบเรือหน้าตาเหมือนกันทุกวัน · ส่งใบเมื่อวานเข้าไลน์แล้วไม่มีใครทักได้จริง
      วันที่จึงได้แถบของตัวเองเต็มความกว้าง ไม่ต้องแข่งกับอะไรในบรรทัดเดียวกัน */
   +'.dstrip{background:#fff;border-bottom:2px solid #16265C;margin:2px 0 12px;'
     +'padding:8px 24px 11px;display:flex;align-items:baseline;justify-content:center;gap:17px}'
   +'.dstrip b{font-size:'+(fs+5)+'px;font-weight:700;letter-spacing:.27em;'
     +'color:#8994A6;text-transform:uppercase}'
   +'.dstrip u{text-decoration:none;font-size:'+(fs+36)+'px;font-weight:800;line-height:.92;color:#111}'
   +'.dstrip i{font-style:normal;font-size:'+(fs+5)+'px;font-weight:700;letter-spacing:.25em;color:#16265C}'
   /* §pjTop2 · หัวใบเป็นป้ายชื่องานก้อนเดียว · พื้น navy ตัวขาว
      ของเดิมเป็นตัวหนังสือสี navy บนพื้นขาว อ่านแล้วเป็นแค่บรรทัดหนึ่งในหัวใบ
      ไม่ใช่ "ชื่อใบ" · ใบนี้ถูกแคปส่งไลน์ ป้ายทึบทำให้รู้ทันทีว่าใบอะไร */
   /* §pjDate · ชื่อบริษัท/ท่าถอยลงเป็นป้ายกำกับ · วันที่เป็นตัวเอกแทน */
   /* §pjDate2 · ป้ายชื่อคาดพื้น navy · วันที่เป็นกรอบ navy พื้นขาว
      สองชิ้นใช้สีเดียวกันแต่กลับขั้วกัน อ่านเป็นชุดเดียวกันโดยไม่แย่งกันเอง
      และแถบใหญ่ที่สุดของใบเป็นพื้นขาว ปริ้นแล้วไม่กินหมึกทั้งแถบ */
   +'.sh-c{flex:none;text-align:center;white-space:nowrap;padding:0}'
   +'.sh-c b{display:block;font-size:'+(fs-6.5)+'px;font-weight:700;letter-spacing:.30em;'
     +'padding-left:.30em;color:#9FABCE;line-height:1.1}'
   /* §pjTop3 · บรรทัดใหญ่คือ "ท่าไหน" ไม่ใช่ชื่อบริษัท · ใบนี้ออกทีละท่า
      คนที่รับใบต้องรู้ก่อนอื่นว่าเป็นใบของท่าตัวเอง · ชื่อบริษัทซ้ำทุกใบอยู่แล้ว */
   +'.sh-c span{display:block;font-size:'+(fs+1.5)+'px;font-weight:800;letter-spacing:.20em;'
     +'padding-left:.20em;color:#fff;line-height:1.2;margin-top:1px;text-transform:uppercase}'

   +'.pills{display:flex;gap:6px;justify-content:flex-end;margin-bottom:5px;flex-wrap:wrap}'
   +'.pill{border:1px solid #DCE2EC;background:#F5F7FA;border-radius:999px;padding:4px 12px;'
     +'font-size:'+(fs-3)+'px;font-weight:600;color:#5C6B85;white-space:nowrap}'
   +".pill b{font-family:'Sarabun',sans-serif;font-weight:700;color:#111;margin-left:5px;font-size:"+(fs-1)+"px}"
   +'.pill.go{background:#ECFDF5;border-color:#BFE0CD;color:#047857}.pill.go b{color:#047857}'
   +'.pill.px{background:#EFF6FF;border-color:#C7DBF5;color:#1D4ED8}.pill.px b{color:#1D4ED8}'
   +'.stamp{font-size:'+(fs-4.5)+'px;color:#A0A9B8;line-height:1.5}'
   /* §pjSheet2 · ดีไซน์ยกจากการ์ดบนหน้าจอ */
   +'table{border-collapse:separate;border-spacing:'+GAP+'px 0;width:100%;table-layout:fixed}'
   +'th,td{padding:1px 6px;vertical-align:middle;overflow:hidden;word-break:break-word}'
   /* §pjSheet3 · ขอบซ้ายขวาต่อกันลงมาเป็นตัวการ์ด · แถวสุดท้ายปิดท้ายด้วยมุมมน */
   +'tbody td,tbody th{border-left:1px solid #E4E8EE;border-right:1px solid #E4E8EE;border-bottom:1px solid #EFF2F6}'
   +'tbody tr:last-child td,tbody tr:last-child th{border-bottom:1px solid #E4E8EE;border-radius:0 0 11px 11px}'
   +'td.off{border-radius:0 0 11px 11px;border-bottom:1px solid #E4E8EE}'
   +'thead th{padding:0;border:0;vertical-align:top;height:1px}'
   +'thead th{height:58px}'
   /* §pjType · การ์ดหัวเรือเคยสูงไม่เท่ากัน · ชื่อยาว (Aluminous1 / Andaman Ryder)
      ตกสองบรรทัด การ์ดเลยยาว 65px ขณะที่ลำอื่น 43px · ตรึงความสูงแล้วจัดกลางแนวตั้ง */
   +'thead th{height:54px}'
   +'.bh{height:100%;padding:6px 7px;color:#111;display:flex;align-items:center;justify-content:center}'
   +'.bh .bn{font-size:'+(fs+2)+'px;font-weight:800;line-height:1.15;display:block;color:#4A5566;'
     +'letter-spacing:.05em;text-transform:uppercase}'
   +'.bh.go .bn{color:#111}'
   /* §pjSect · แถบหมวด · เลขกำกับ + ไทย + อังกฤษ แบบไฟล์ต้นแบบ */
   +'tr.bd th{text-align:left;font-size:'+(fs-2)+'px;font-weight:800;letter-spacing:.13em;'
     +'text-transform:uppercase;padding:7px 10px;border-color:transparent;white-space:nowrap;'
     +'overflow:visible;position:relative;z-index:2}'
   /* แถวแถบไม่ต้องมีช่องไฟระหว่างคอลัมน์ · จะได้เป็นแบนเนอร์ยาวเส้นเดียว */
   +'tr.bd{box-shadow:none}'
   +'tr.bd td{box-shadow:-7px 0 0 0 var(--bdc,transparent)}'
   +'tr.bd th .no{font-weight:800;letter-spacing:.05em}'
   +'tr.bd th .no:after{content:\'\\00a0\\00b7\\00a0\';font-weight:600;opacity:.55}'
   +'tr.bd th i{font-style:normal;font-weight:600;font-size:'+(fs-3.5)+'px;opacity:.70;'
     +'letter-spacing:0;text-transform:none;margin-left:8px}'
   +'tr.bd td{border-color:transparent;padding:0}'
   /* ป้ายแถวสองภาษา · ไทยบรรทัดบน อังกฤษบรรทัดล่างตัวเล็ก */
   /* §pjLbl · ไทยต่อท้ายบรรทัดเดียวกัน ไม่ตกบรรทัดใหม่
      ป้ายแถวเป็นตัวใหญ่เว้นระยะ แนวเดียวกับป้ายหมวดและหัวคอลัมน์บนบอร์ด */
   +'th.k i{display:inline;font-style:normal;font-weight:500;font-size:'+(fs-4)+'px;color:#94A3B8;'
     +'letter-spacing:0;text-transform:none;margin-left:6px}'
   /* ช่องกลาง · แถวข้อมูลเรือในหมวด 1 */
   +'td.ctr{text-align:center}'
   +'td.e3{background:#ECFDF3;color:#0F6E56;font-weight:700}'
   +'td.e4{background:#FDF0F4;color:#9B3055;font-weight:700}'
   /* §pjVivid · แถวนี้เคยสูง 86px ขณะที่แถวอื่น 41px · ชื่อทริปตกสองบรรทัด
      ส่วนช่องลำที่จอดยาวสามบรรทัด · บีบระยะบรรทัดและย่อรายละเอียดลง */
   /* §pjTrip2 · แถวทริปสูงตามช่องลำที่จอด (สถานะ + เลข MJ = 2 บรรทัด)
      ทั้งแถวตั้ง vertical-align:top ชื่อทริปบรรทัดเดียวจึงลอยอยู่ขอบบน
      ไม่ตรงกับป้าย TRIP ที่อยู่กลางช่อง
      ต้องเขียนเป็น tr.rt td.trip · ของเดิมเป็น td.trip เฉย ๆ (0,1,1)
      แพ้ tr.rt td (0,1,2) ที่ตั้ง vertical-align:top ไว้ · กฎเลยไม่เคยมีผลเลย */
   +'tr.rt td.trip{vertical-align:middle;padding:8px 10px;letter-spacing:.01em}'
   +".tmc{font:800 "+(fs+7)+"px 'Sarabun',sans-serif !important;color:#111;background:#F6F8FB}"
   +'td.rt2{color:#41506A;font-weight:600}'
   +'td.mut2{color:#C3CAD6;text-align:center}'
   /* §pjFlat · ช่องของลำที่ไม่ได้ออก · ขีดกลางจาง ๆ เหมือนไฟล์ต้นแบบ
      ไม่ทำเป็นบล็อกทึบ เพราะเส้นตารางคือสิ่งที่ทำให้กวาดตาข้ามลำได้ */
   +'td.off2{color:#CFD5DE;text-align:center;background:#FBFCFD;font-weight:500}'
   +'tr.pxt td.tot.z2{color:#8FB9C2;background:#E7F6F9;font-weight:600}'
   +'td.offr{font-weight:800;line-height:1.2;padding:5px 7px;font-size:'+(fs-1)+'px}'
   /* §pjVivid · ช่องกว้างสุด 113px · รายละเอียดงานซ่อมยาว 3 บรรทัด ดันแถวเป็น 88px
      ขณะที่แถวอื่น 41px · จำกัดป้าย 1 บรรทัด รายละเอียด 2 บรรทัด แล้วตัดด้วย …
      เลข Job อยู่ต้นข้อความจึงไม่หาย · กฎนี้ต้องชนะ .sub ตัวอื่นที่ตั้ง display:block ไว้ */
   +'tr.rt td.offr .lb{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;'
     +'overflow:hidden;line-height:1.2}'
   +'tr.rt td.offr .sub{display:-webkit-box !important;-webkit-line-clamp:1;-webkit-box-orient:vertical;'
     +'overflow:hidden;margin-top:2px;font-weight:400;font-size:'+(fs-3.5)+'px;opacity:.8;line-height:1.2}'
   +'tbody tr{height:'+Math.round(fs*2.1)+'px}'
   +'tr.rt td{color:#fff;font-size:'+(fs-0.4)+'px;font-weight:800;padding:6px 7px;line-height:1.3;'
     +'border-color:transparent;vertical-align:top}'
   +'tr.rt td .sub{font-weight:500;opacity:.9;font-size:'+(fs-1.4)+'px;display:block;margin-top:1px}'
   /* §pjType · บรรทัดไทยคือป้ายหลัก · ของเดิมโดน uppercase + letter-spacing ที่ตกทอดมาจาก
   หัวตาราง ทำให้ตัวไทยห่างผิดปกติและเล็กกว่าบรรทัดอังกฤษข้างล่าง */
   +'th.k{background:#fff;text-align:left;font-size:'+(fs-2.5)+'px;font-weight:800;letter-spacing:.09em;'
     +'text-transform:uppercase;color:#1E2430;padding:6px 10px;line-height:1.25}'
   /* §pjHead3 · การ์ดหัวเรือเป็นพื้นอ่อนตัวดำแล้ว · ช่องหัวข้อต้องเป็นชุดเดียวกัน
      ไม่งั้นมุมซ้ายบนเป็นก้อนเข้มโดดอยู่ก้อนเดียวทั้งแถว */
   +'thead th.k{background:#fff;color:#111;vertical-align:middle;padding:6px 10px;'
     +'border-bottom:4px solid #64748B;'
     +'font-size:'+(fs+1)+'px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;line-height:1.15}'
   +'thead th.k i{display:block;font-style:normal;font-weight:500;font-size:'+(fs-5)+'px;'
     +'color:#8994A6;letter-spacing:.03em;margin-top:1px;line-height:1.2;text-transform:none}'
   /* §pjWork2 · ช่องสถานะของลำที่จอด · อยู่แถวเดียวกับโปรแกรม แต่เป็นสีอ่อนของสถานะ */
   +'tr.rt td.ok{background:#EAF6EF;color:#0F6E56;font-size:'+(fs-1)+'px;font-weight:800;'
     +'text-align:center;border-color:#DDE6E1;padding:6px 7px;vertical-align:top}'
   +'tr.rt td.wk,tr.rt td.off{vertical-align:top}'
   +'tr.rt td.wk{border:1px solid rgba(15,23,42,.10);border-radius:0}'
   +'tr.rt td.wk .sub{opacity:.78}'
   /* §pjHead1 · ช่องนี้ย้ายมาอยู่แถวเดียวกับแถบหัวกลุ่ม · กันสีแถบทับ */
   +'tr.gh td.wk{text-transform:none;letter-spacing:0;font-size:'+(fs-0.5)+'px;font-weight:800;'
     +'padding:7px 8px;line-height:1.3;vertical-align:top;border:1px solid rgba(15,23,42,.10)}'
   +'tr.gh td.wk .sub{display:block;margin-top:2px;font-weight:500;font-size:'+(fs-1.6)+'px;opacity:.78}'
   /* §pjSheet4 · แถบสีทึบพาดทั้งแถว · บนกระดาษขาวดำก็ยังเห็นเป็นเส้นแบ่งส่วนชัด ๆ */
   +'tr.gh th,tr.gh td:not(.off){font-size:'+(fs-2.5)+'px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;'
     +'padding:4px 10px;color:#fff;border-color:transparent;line-height:1.2}'
   +'tr.gh th{border-radius:4px 0 0 4px}'
   +'tr.gh.crew th,tr.gh.crew td:not(.off){background:#1B4A87}'
   +'tr.gh.guide th,tr.gh.guide td:not(.off){background:#5B3B96}'
   +'tr.gh.cust th,tr.gh.cust td:not(.off){background:#14603E}'
   +'tr.gh.note th,tr.gh.note td:not(.off){background:#8A5A00}'
   /* §pjSheet4 · สายรัดข้อมือเป็นสีจริง ไม่ใช่ชื่อสี */
   /* §pjWbName · แถบสี + ชื่อสี อยู่ในช่องเดียว · แถบยาวพอให้เทียบกับข้อมือจริงได้ */
   +'.wbc{display:inline-flex;align-items:center;gap:8px}'
   +'.wbc i{width:'+(fs+13)+'px;height:'+(fs-2)+'px;border-radius:4px;flex:none;'
     +'border:1px solid rgba(15,23,42,.22)}'
   +'.wbc b{font-size:'+fs+'px;font-weight:700;color:#1E2430}'
   /* §pjCk · ภาษาภาพเดียวกับหน้าเช็คอินรถ · ช่องข้อมูลพื้นเหลืองอ่อน เส้นบาง
      พื้นสีทำให้แถวที่มีคนจริงแยกออกจากช่องว่างทันที โดยไม่ต้องใช้เส้นหนา */
   /* §pjCtr · ชื่อคนอยู่กลางช่อง · แถวที่ว่างเป็นขีดกลางอยู่แล้ว
      ชื่อชิดซ้ายบ้างขีดกลางบ้าง ทำให้คอลัมน์ดูเหมือนเอียง */
   +'td.v{font-size:'+fs+'px;font-weight:400;color:#1E2430;line-height:1.35;background:#FCFCEA;text-align:center}'
   +'tr.pxr td.pxn{background:#FCFCEA}'
   +'td.nt{background:#FCFCEA}'
   +'td.v .rl{color:#94A3B8;font-size:'+(fs-1.5)+'px;font-weight:600}'
   +'td.mut{color:#CBD5E1;text-align:center;font-size:'+(fs+0.5)+'px}'
   /* ลำที่ไม่ได้ออกวันนั้น · ช่องเดียวยาวลงมา ไม่พิมพ์สถานะซ้ำทุกบรรทัด */
   +'td.off{background:repeating-linear-gradient(135deg,#FAFBFC 0 7px,#F3F5F8 7px 14px);'
     +'text-align:center;vertical-align:middle;padding:6px 4px}'
   +'td.off .sq{display:inline-block;font-size:'+fs+'px;font-weight:800;border-radius:999px;padding:3px 9px;line-height:1.3}'
   +'td.off .sm{display:block;font-size:'+(fs-2)+'px;color:#94A3B8;margin-top:5px;line-height:1.4}'
   +'td.off.wki{vertical-align:top;padding-top:9px}'
   +'td.px{padding:3px 5px;text-align:center;background:#FAFBFC}'
   +"td.px .a{font:700 "+(fs-0.5)+"px 'Sarabun',sans-serif;color:#64748B;letter-spacing:-.02em}"
   +"td.px .t{font:800 "+(fs+5)+"px 'Sarabun',sans-serif;color:#0F6E56;line-height:1.15}"
   +'td.nt{font-size:'+(fs-2)+'px;color:#8A5A00;line-height:1.3;vertical-align:middle;padding:5px 8px}'
   +'.ntc{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}'
   +'.ntt{display:block;margin-top:4px;color:#8A5A00;font-weight:600;text-align:center}'
   /* §pjRead · แถวผู้โดยสารแยกประเภท · เลขตัวเดียวกลางช่อง กวาดตาข้ามลำได้ */
   +"td.pxn{text-align:center;background:#FAFBFC;font:500 "+(fs+2)+"px 'Sarabun',sans-serif;color:#2D4479;padding:0 5px;line-height:1.45}"
   +'td.pxn.z{color:#CBD5E1;font-weight:500}'
   +'tr.pxr th.k{padding:4px 10px}'
   /* §pjPaxRow · สี่ประเภทเรียงในช่องเดียว · ป้ายเล็กบน ตัวเลขใหญ่ล่าง */
   +'td.pxg{background:#FCFCEA;padding:5px 8px;text-align:center}'
   +'td.pxg span{display:inline-flex;flex-direction:column;align-items:center;min-width:'+(fs+22)+'px;'
     +'margin:0 2px}'
   +'td.pxg span i{font-style:normal;font-size:'+(fs-6)+'px;font-weight:700;letter-spacing:.1em;color:#9AA5B8}'
   +".td-x,td.pxg span b{font-family:'Sarabun',sans-serif;font-size:"+(fs+3)+"px;"
     +'font-weight:700;color:#2D4479;line-height:1.15}'
   +'td.pxg span.z b{color:#C9D0DB;font-weight:500}'
   +'tr.pxt td.tot{background:#CFF2F7;color:#0B3B45;font-size:'+(fs+7)+'px;font-weight:800;'
     +'border-color:#8FD9E4}'
   +'tr.pxt th.k{background:#A9E6EF;color:#0B3B45;font-weight:800}'
   +'tr.pxt th.k i{color:#2F6B76}'
   /* §pjSplit · กล่องสรุปลำที่ไม่มีคนทำงานด้วยวันนี้ · อยู่เหนือตาราง
      แนวเดียวกับการ์ดสรุปบนหน้า Booking · อ่านจบในบรรทัดเดียวไม่ต้องกวาดทั้งคอลัมน์ */
   +'.fleet{display:flex;gap:9px;margin:0;flex-wrap:wrap;align-items:flex-start}'
   +'.fb.pg{flex:2.4 1 470px}'
   +'.fb.ok{flex:.7 1 150px}'
   +'.fb.dn{flex:1.9 1 400px}'
   +'.fb{flex:1 1 320px;min-width:0;background:#fff;border:1px solid #E4E8EE;border-radius:6px;padding:8px 11px 9px}'
   +'.fb.ok{border-left:4px solid #1C9B62}'
   +'.fb.dn{border-left:4px solid #A3550B}'
   /* §pjHideIdle · กล่อง Not available แบบย่อ · เหลือหัวกล่องอย่างเดียว ไม่มีรายชื่อ
      ไม่ยืดเต็มแถว ปล่อยที่ที่เหลือให้กล่องอื่น */
   +'.fb.dn.slim{flex:0 0 auto;min-width:0}'
   +'.fb.dn.slim .fb-h{margin-bottom:0}'
   +'.fb-h{display:flex;align-items:baseline;gap:7px;margin-bottom:6px;'
     +'font-size:'+(fs-1)+'px;font-weight:800;color:#2C3A52}'
   +'.fb-h em{font-style:normal;font-size:'+(fs-5)+'px;font-weight:600;letter-spacing:.12em;color:#94A3B8}'
   +".fb-h b{margin-left:auto;font-family:'Sarabun',sans-serif;font-size:"+(fs+3)+"px;color:#111}"
   +'.fb-l{display:flex;flex-wrap:wrap;gap:5px}'
   +'.fbi{display:inline-flex;align-items:baseline;gap:6px;border:1px solid;border-radius:5px;'
     +'padding:2px 8px;white-space:nowrap;max-width:100%;overflow:hidden}'
   +'.fbi b{font-size:'+(fs-1)+'px;font-weight:800;letter-spacing:.03em;text-transform:uppercase}'
   +'.fbi i{font-style:normal;font-size:'+(fs-3.5)+'px;font-weight:500;opacity:.85;'
     +'overflow:hidden;text-overflow:ellipsis}'
   /* §pjBrd4 · พื้นขาวเหมือนการ์ดอื่น · ทุกอย่างอยู่แถวเดียว ไม่มีบรรทัดรอง */
   +'.fb.pg{flex:1.85 1 520px;border-left:4px solid #16265C}'
   +'.brd{width:100%;border-collapse:collapse;table-layout:fixed;border-spacing:0}'
   /* §pjBrd5 · บอร์ดนี้ใช้ <table> เหมือนกัน จึงกินกฎของตารางใบงานไปด้วย
      ตัวที่กัดคือ thead th{height:54px} (ตรึงความสูงการ์ดหัวเรือ) — บนบอร์ดกลายเป็น
      ช่องว่างใต้หัวคอลัมน์ 54px ทั้งที่ตัวอักษรสูง 12px · และเส้นซ้าย/ขวาของ tbody
      ที่ลากกรอบการ์ดใบงาน ก็โผล่มาขีดคั่นทุกช่องบนบอร์ด */
   +'.brd thead th{height:auto;vertical-align:bottom}'
   +'.brd tbody td{border-left:0;border-right:0;border-radius:0}'
   +'.brd tbody tr:last-child td{border-radius:0}'
   +'.brd th{text-align:left;font-size:'+(fs-4.5)+'px;font-weight:700;letter-spacing:.13em;'
     +'text-transform:uppercase;color:#9AA5B8;padding:0 8px 6px;border-bottom:1px solid #E4E8EE}'
   /* §pjBrd5 · ช่องไฟใต้หัวตารางห่างกว่าระยะระหว่างแถวเกือบสองเท่า
      อ่านแล้วเหมือนหัวตารางหลุดออกจากก้อนข้อมูล · จัดให้ระยะเท่ากันทั้งใบ */
   +'.brd td{padding:8px;vertical-align:middle;border-bottom:1px solid #F0F2F6;line-height:1.25}'
   +'.brd tbody tr:last-child td{border-bottom:0}'
   /* §pjBrd5 · ชื่อโปรแกรมคือสิ่งที่คนหาก่อนอื่นบนบอร์ด · ใหญ่กว่าช่องอื่นและอยู่กลาง */
   +'.brd th.h-p,.brd td.c-p{text-align:center}'
   +".brd .c-t{font-family:'Sarabun',sans-serif;font-size:"+(fs+4)+"px;font-weight:800;"
     +'color:#111;letter-spacing:-.03em;line-height:1;white-space:nowrap}'
   /* §pjCk · ชื่อเรือเป็นป้ายสีทึบ แบบป้าย agency ในหน้าเช็คอิน */
   +'.brd .c-b{white-space:nowrap;overflow:hidden}'
   +'.brd .c-b .bpill{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;'
     +'border-radius:4px;padding:3px 9px;color:#fff;font-size:'+(fs-2)+'px;font-weight:800;'
     +'letter-spacing:.03em;text-transform:uppercase;vertical-align:middle}'
   +'.brd .c-p{font-size:'+(fs+1.5)+'px;font-weight:800;color:#16265C;letter-spacing:.005em;'
     +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +".brd .c-x{font-family:'Sarabun',sans-serif;white-space:nowrap}"
   +'.brd .c-x b{font-size:'+(fs+1)+'px;font-weight:700;color:#2D4479}'
   +'.brd .c-x s{text-decoration:none;font-size:'+(fs-2)+'px;color:#8994A6}'
   +'.brd .c-x.over b{color:#A32D2D}'
   +".brd .c-x.over em{display:block;font-style:normal;font-family:'Sarabun',sans-serif;"
     +'font-size:'+(fs-5)+'px;font-weight:800;color:#A32D2D}'
   +'.pcnone{color:#CFD5DE;font-weight:500}'
   +'.bandc{display:inline-flex;align-items:center;gap:6px;font-size:'+(fs-2)+'px;font-weight:700;color:#2C3A52}'
   +'.bandc i{width:14px;height:14px;border-radius:4px;border:1px solid rgba(15,23,42,.22);display:inline-block;flex:none}'
   +'.brd .c-r{display:flex;flex-wrap:wrap;gap:4px;align-items:center}'
   /* §pjChip · ป้ายหมายเหตุเคยเป็นพื้นทึบทั้งก้อน · หลายป้ายเรียงกันกลายเป็นแถบสีพาด
      เปลี่ยนเป็นขีดสีด้านซ้าย พื้นจาง · สีบอกประเภทได้เหมือนเดิมแต่ไม่แย่งสายตา */
   +'.pc{display:inline-flex;align-items:center;gap:4px;border-radius:0 4px 4px 0;padding:2px 8px;'
     +'border-left:3px solid currentColor;font-size:'+(fs-4.5)+'px;font-weight:600;white-space:nowrap}'
   +".pc b{font-family:'Sarabun',sans-serif;font-size:"+(fs-3)+"px;font-weight:700}"
   +'.pc.lang{background:#EAF0F9;color:#1B4A87}'
   +'.pc.meal{background:#F0F7EC;color:#2F6B2A}'
   +'.pc.alg{background:#FCEBEB;color:#A32D2D}'
   +'.pc.lt{background:#F3EEFA;color:#5B3B96}'
   +'.pc.wb{background:#F5F7FA;color:#2C3A52}'
   +'.pc.wb i{width:11px;height:11px;border-radius:3px;border:1px solid rgba(15,23,42,.2);display:inline-block}'
   /* §pjSecbar · ป้ายหมวดของใบ · ตัวใหญ่เว้นระยะ ภาษาเดียวกับป้ายแถวในตาราง
      เส้นคั่นอยู่ "ใต้" ป้าย ไม่ใช่เหนือ · ป้ายจึงเกาะอยู่กับของที่มันกำกับ */
   +'.secbar{display:flex;align-items:baseline;gap:11px;margin:17px 0 8px;padding:0 2px 6px;'
     +'border-bottom:1px solid #D8DEE8}'
   +'.secbar:first-child{margin-top:0}'
   +'.secbar span{font-size:'+(fs-1.5)+'px;font-weight:800;color:#111;letter-spacing:.15em;'
     +'text-transform:uppercase}'
   +'.secbar em{font-style:normal;font-size:'+(fs-3.5)+'px;font-weight:600;letter-spacing:0;color:#8994A6}';
}
/* lifted out of pjPrint by tools/lift.mjs (var:progBox) · reads: GO, PX, J, e */
function pjPrintProgBox(C){
  const { GO, PX, J, e } = C;
  return function(){
    if(!GO.length) return '';
    var rows=GO.map(function(B,i){
      var rt=B.route||{}, dep=String(B.dep||'');
      var P=null; try{ P=pjPrep(_poDate,B.bid,_poPier); }catch(_){}
      P=P||{lang:{},halal:0,veg:0,vegan:0,allerg:0,lt:0};
      var pax=(PX[i]&&PX[i].all)||0, cap=(+(B.boat.cap)||0);
      /* §pjOver · ยอดเกินความจุ = จ่ายงานผิด ต้องรู้ตั้งแต่ก่อนออกเรือ
         ของเดิมพิมพ์ "120/65" ด้วยสีเดียวกับทุกช่อง อ่านผ่านได้ง่ายมาก */
      var over=(cap>0 && pax>cap) ? (pax-cap) : 0;
      var wbc=(J[i]&&J[i].wbc)||'', wbn=(J[i]&&J[i].wb)||'';

      /* ของที่ต้องเตรียมล่วงหน้า · รู้ได้ตั้งแต่ตอนออกใบ */
      return { dep:(dep||'~'), html:
        '<tr class="br">'
        +'<td class="c-t">'+e(dep||'--:--')+'</td>'
        +'<td class="c-b"><span class="bpill" style="background:'
          +((typeof pckBoatColor==='function')?pckBoatColor(B.bid):'#185FA5')+'">'
          +e(B.boat.name||B.bid)+'</span></td>'
        +'<td class="c-p">'+e(rt.name||'\u2014')+'</td>'
        +'<td class="c-x'+(over?' over':'')+'"><b>'+pax+'</b><s>/'+cap+'</s>'
          +(over?('<em>เกิน '+over+'</em>'):'')+'</td>'
        /* §pjBand · สีสายรัดข้อมือ · ของที่ต้องหยิบมาเตรียมก่อนแขกมาถึง
           คนที่ท่าเทียบ "สี" กับข้อมือแขก จึงต้องเห็นสีจริง ไม่ใช่อ่านชื่อสี */
        +'<td class="c-w">'+(wbn
            ? ('<span class="bandc"><i style="background:'+e(wbc||'#CBD5E1')+'"></i>'+e(wbn)+'</span>')
            : '<span class="pcnone">-</span>')+'</td>'
        +'</tr>' }; });
    rows.sort(function(a,b){ return a.dep<b.dep?-1:(a.dep>b.dep?1:0); });

    return '<div class="fb pg"><div class="fb-h">Departures<b>'+GO.length+'</b></div>'
      +'<table class="brd">'
      +'<colgroup><col style="width:78px"><col style="width:158px"><col>'
        +'<col style="width:82px"><col style="width:118px"></colgroup>'
      +'<thead><tr><th>Time</th><th>Boat</th><th class="h-p">Programme</th><th>Pax</th><th>Band</th></tr></thead>'
      +'<tbody>'+rows.map(function(r){ return r.html; }).join('')+'</tbody></table></div>';
  };
}
/* lifted out of pjPrint by tools/lift.mjs (var:fleetBox) · reads: REST, e */
function pjPrintFleetBox(C){
  const { REST, e } = C;
  return function(){
    if(!REST.length) return '';
    var ready=[], down=[];
    REST.forEach(function(B){
      var SM=PJ_ST[B._st.k]||PJ_ST.idle;
      var why=[B._st.loc||'', B._st.note||''].filter(function(x){
        var v=String(x||'').trim(); return v && v!=='-' && v!=='\u2014'; }).join(' \u00b7 ');
      var it={ n:(B.boat.name||B.bid), t:SM.t, why:why, bg:SM.bg, fg:SM.fg, bd:SM.bd, grp:(SM.grp||'') };
      if(it.grp==='ready') ready.push(it); else down.push(it);
    });
    var cell=function(x,showWhy){
      return '<span class="fbi" style="background:'+x.bg+';color:'+x.fg+';border-color:'+(x.bd||'transparent')+'">'
        +'<b>'+e(x.n)+'</b>'
        +(showWhy?('<i>'+e(x.t)+(x.why?(' \u00b7 '+x.why):'')+'</i>'):'')
        +'</span>'; };
    var box=function(th,list,showWhy,cls){
      if(!list.length) return '';
      return '<div class="fb '+cls+'"><div class="fb-h">'+th+'<b>'+list.length+'</b></div>'
        +'<div class="fb-l">'+list.map(function(x){ return cell(x,showWhy); }).join('')+'</div></div>'; };
    /* §pjHideIdle · "ตัวใบงานนี้ด้วย สามารถซ่อน Not Available"
       กล่องนี้กินที่เยอะที่สุดใน Section A เพราะแต่ละลำห้อยเหตุผลยาว
       (ขึ้นคาน · อู่ไหน · เลขใบซ่อม) ทั้งที่คนอ่านใบนี้คือคนจ่ายงานให้ลำที่ออก
       ผูกกับปุ่มเดียวกับที่ซ่อนการ์ดบนจอ · จะได้มีสวิตช์เดียว ไม่ใช่สองที่ต้องจำ

       ซ่อนแล้วไม่ทิ้งจำนวน · เหลือบรรทัดเดียวบอกว่ามีกี่ลำ
       ใบนี้ถูกแคปส่งไลน์และใช้เถียงกันย้อนหลัง · "ไม่มีกล่อง" กับ "วันนั้นเรือพร้อมหมด"
       ต้องแยกออกจากกันได้ · กดปุ่มเปิดเมื่อไหร่ก็เห็นรายชื่อครบเหมือนเดิม */
    var dnBox = down.length
      ? (_pjHideIdle
          ? ('<div class="fb dn slim"><div class="fb-h">Not available<b>'+down.length+'</b></div></div>')
          : box('Not available',down,1,'dn'))
      : '';
    return box('Ready',ready,0,'ok') + dnBox;
  };
}
/* lifted out of pjPrint by tools/lift.mjs (var:offLbl) · reads: isWk, e */
function pjPrintOffLbl(C){
  const { isWk, e } = C;
  return function(B){
    var SM=PJ_ST[B._st.k]||PJ_ST.idle, sub='';
    if(isWk(B)){ var mj=(B._st.mj||[]), M=null;
      try{ M=pjMjOf(_poDate,B.bid,mj); }catch(_){}
      sub=[ M?((M.no?(M.no+' · '):'')+(M.title||M.type||'')).trim():'', B._st.loc||'' ]
        .filter(function(x){ var v=String(x||'').trim(); return v&&v!=='-'&&v!=='—'; }).join(' \u00b7 ');
    } else {
      sub = B._away
        ? ('ไปวิ่งที่ '+e(((PO_PIERS.filter(function(x){ return x.k===(B._away.route.pier||''); })[0])||{}).n||'ท่าอื่น'))
        : e([B._st.loc||'', B._st.note||''].filter(function(x){
            var v=String(x||'').trim(); return v&&v!=='-'&&v!=='—'; }).join(' \u00b7 '));
    }
    return '<td class="v ctr offr" style="background:'+SM.bg+';color:'+SM.fg+'">'
      +'<span class="lb">'+e(SM.t)+'</span>'
      +(sub?('<span class="sub">'+sub+'</span>'):'')+'</td>';
  };
}
/* lifted out of pjPrint by tools/lift.mjs (var:sheet) · reads: e, P, _pjWd, _pjDay, _pjMo, progBox, fleetBox, cols, head, body */
function pjPrintSheet(C){
  const { e, P, _pjWd, _pjDay, _pjMo, progBox, fleetBox, cols, head, body } = C;
  return '<div class="sheet" id="sheet">'
    /* §pjTop · โครงเดียวกับหัวหน้า Booking · เลขวันตัวใหญ่ซ้าย แบรนด์กลาง ชิปขวา
       ต่างที่พื้นเป็นสีขาว ไม่ใช่ navy เพราะใบนี้ถูกแคปเป็นรูปส่งไลน์และปริ้นด้วย */
    +'<div class="shead">'
      /* §pjTop3 · t เป็น "Visit Panwa \u00b7 \u0e20\u0e39\u0e40\u0e01\u0e47\u0e15" · เอาเฉพาะชื่อท่าหน้าจุดคั่น */
      +'<div class="sh-c"><b>LOVE ANDAMAN</b><span>'
        +e(String(P.t||P.n||'').split('\u00b7')[0].trim()||(P.n||''))+'</span></div>'
    +'</div>'
    /* §pjDate · แถบวันที่ · ของชิ้นเดียวที่กินเต็มความกว้างของใบ */
    +'<div class="dstrip"><b>'+e(_pjWd)+'</b><u>'+_pjDay+'</u><i>'+e(_pjMo)+'</i></div>'
    /* §pjSecbar · ใบนี้มีสองส่วนจริง ๆ · ภาพรวมของวัน กับ ใบจ่ายงานรายคน
       ตั้งชื่อทั้งคู่ จะได้รู้ว่าอ่านถึงไหนแล้ว ไม่ใช่ตั้งชื่อแค่ส่วนล่าง */
    +'<div class="secbar"><span>Section A \u00b7 Departures &amp; fleet status</span>'
      +'<em>\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21\u0e02\u0e2d\u0e07\u0e27\u0e31\u0e19</em></div>'
    + '<div class="fleet">'+progBox()+fleetBox()+'</div>'
    /* §pjSplit2 · หัวใบกับตารางจ่ายงานเป็นคนละเรื่องกัน · หัวใบคือภาพรวมของวัน
       ตารางคือใบจ่ายงานรายคน · คั่นด้วยแถบชื่อให้เห็นว่าเปลี่ยนเรื่องแล้ว */
    +'<div class="secbar"><span>Section B \u00b7 Crew assignment</span>'
      +'<em>\u0e01\u0e32\u0e23\u0e08\u0e31\u0e14\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1e\u0e25\u0e1b\u0e23\u0e30\u0e08\u0e33\u0e40\u0e23\u0e37\u0e2d</em></div>'
    +'<table>'+cols+head+body+'</table>'
    +'</div>';
}
/* lifted out of pjPrint by tools/lift.mjs (var:body) · reads: tripRow, timeRow, row, e, band, lbRow, who, J, wkWho, nCrew, nIsl, GDSUM, GD_ROWS, gdCell, WKG, boats, isGo, PX, gi, PXKIND, isWk, WK */
function pjPrintBody(C){
  const { tripRow, timeRow, row, e, band, lbRow, who, J, wkWho, nCrew, nIsl, GDSUM, GD_ROWS, gdCell, WKG, boats, isGo, PX, gi, PXKIND, isWk, WK } = C;
  return '<tbody>'
    + tripRow() + timeRow()
    /* §pjSheet4 · ร้านอาหารของลำนี้วันนี้ · ตั้งรายลำมาก่อนร้านประจำเส้นทางเสมอ
       §pjRest · ย้ายขึ้นมาต่อจากเวลาออก · เดิมอยู่ท้ายหมวดไกด์ ซึ่งเป็นหมวด "คน"
       แต่ร้านอาหารไม่ใช่คนที่ถูกจ่ายงาน · เป็นของที่ผูกกับทริปเหมือนโปรแกรมและเวลา
       สามแถวบนสุดจึงตอบครบว่า วันนี้ลำนี้ไปไหน ออกกี่โมง กินที่ไหน */
    + row('RESTAURANT|\u0e23\u0e49\u0e32\u0e19\u0e2d\u0e32\u0e2b\u0e32\u0e23',function(B,i){
        var raw=''; try{ raw=mvTripRaw(_poDate,B.bid); }catch(_){}
        if(raw==='-') return '<span class="rl">ไม่มีอาหารวันนี้</span>';
        var V=null; try{ V=mvForTrip(_poDate,B.bid,B.rid); }catch(_){}
        return V?e(V.name||''):'';
      },0,function(){ return ''; })
    + band('1','NAUTICAL CREW','#E7F1EC','#0F6E56','\u0e1d\u0e48\u0e32\u0e22\u0e40\u0e14\u0e34\u0e19\u0e40\u0e23\u0e37\u0e2d')
    + lbRow('go','cap','Captain','CAPTAIN|\u0e01\u0e31\u0e1b\u0e15\u0e31\u0e19',function(B,i){ return who(J[i].cap,0); },0,function(B){ return wkWho(B,0); })
    + lbRow('go','asst','Asst. Captain','ASST. CAPTAIN|\u0e1c\u0e39\u0e49\u0e0a\u0e48\u0e27\u0e22',function(B,i){ return who(J[i].asst,0); },0,function(B){ return wkWho(B,1); })
    + (function(){ var o=''; for(var c=0;c<nCrew;c++){ (function(c){
        o+=lbRow('go','crew'+c,'Crew '+(c+1),'CREW '+(c+1)+(c?'':'|\u0e25\u0e39\u0e01\u0e40\u0e23\u0e37\u0e2d'),function(B,i){ return who((J[i].crew||[])[c],0); },0,
               (c<3)?function(B){ return wkWho(B,2+c); }:null); })(c); } return o; })()
    + (function(){ var o=''; for(var c=0;c<nIsl;c++){ (function(c){
        /* §pjLbl · "ISLAND STAFF 1 \u0e1b\u0e23\u0e30\u0e08\u0e33\u0e40\u0e01\u0e32\u0e30" ยาวเกินคอลัมน์ป้าย ตกสองบรรทัด
           ดันแถวจาก 36px เป็น 51px · ป้ายอังกฤษตรงตัวอยู่แล้ว ไม่ต้องมีคำกำกับ */
        o+=lbRow('go','island'+c,'Island Staff '+(c+1),'ISLAND STAFF'+(nIsl>1?(' '+(c+1)):''),
               function(B,i){ return who((J[i].island||[])[c],0); },0,
               (c<2)?function(B){ return wkWho(B,5+c); }:null); })(c); } return o; })()
    /* §pjHead1 · ช่องรวมงานซ่อมเคยเริ่มที่แถวแถบ GUIDES · เนื้อในสูงกว่าแถวที่คลุมรวมกัน
       เบราว์เซอร์เลยยัดส่วนเกินลงแถวแรก ทำให้แถบสีหนาเป็นบล็อก · เลื่อนไปเริ่มแถวไกด์แถวแรก */
    /* §pjRest · ร้านอาหารย้ายขึ้นไปอยู่บนสุดแล้ว · หมวดนี้จึงเหลือแต่ไกด์
       วันที่ยังไม่ได้จ่ายไกด์เลย แถบหมวดจะพาดอยู่โดยไม่มีแถวอยู่ข้างใต้ · ไม่ต้องพิมพ์ */
    + (GDSUM ? band('2','GUIDES &amp; STAFF','#ECEAF7','#453B95','\u0e1d\u0e48\u0e32\u0e22\u0e21\u0e31\u0e04\u0e04\u0e38\u0e40\u0e17\u0e28\u0e01\u0e4c\u0e41\u0e25\u0e30\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23') : '')
    /* §pjRead · ของเดิม "ไกด์ 1..4" · ลำดับไม่ได้บอกอะไร ต้องอ่านชื่อแล้วเดาเองว่าใครพูดภาษาไหน
       เปลี่ยนเป็นช่องตามภาษา/บทบาทจริงแบบใบ Excel · ช่องที่ว่างทั้งใบไม่พิมพ์ */
    /* §pjGdOrder · หัวแถวคือชื่อช่องบนการ์ด · ผ่านกติกาเดียวกับแถวลูกเรือ (§pjLbSheet)
       ทุกลำตั้งตรงกัน → ใช้ชื่อนั้น · ตั้งไม่ตรงกัน → คงชื่อมาตรฐาน แล้วติดชื่อในช่องของลำนั้น */
    + (function(){ var o='';
        GD_ROWS.forEach(function(R,sq){
          var slot=pjGdSlot(R.kind,R.idx), def=pjGdDefLb(R.kind,R.idx);
          var en=(R.kind==='gd') ? ('GUIDE '+(R.idx+1))
                                 : ('STUDENT / TRAINEE'+(R.idx?(' '+(R.idx+1)):''));
          var k=en+((sq===0)?'|\u0e21\u0e31\u0e04\u0e04\u0e38\u0e40\u0e17\u0e28\u0e01\u0e4c':'');
          o+=lbRow('gd',slot,def,k,
                   function(B,i){ return gdCell(i,R); },0,
                   function(B){ return WKG[B.bid] ? e(WKG[B.bid][sq]||'') : ''; });
        });
        return o; })()
    + band('3','PASSENGER HEADCOUNT','#E5F0F0','#12554F','\u0e22\u0e2d\u0e14\u0e1c\u0e39\u0e49\u0e42\u0e14\u0e22\u0e2a\u0e32\u0e23')

    /* §pjSheet4 · แถบสีจริงของสายรัดข้อมือ · คนที่ท่าเทียบสีกับข้อมือแขก ไม่ได้อ่านชื่อสี
       §pjWbName · แต่ชื่อสีก็ต้องมีด้วย · ใบนี้ถูกปริ้นขาวดำและถูกแคปส่งไลน์
       สีล้วน ๆ แยก "ฟ้า TQ" กับ "น้ำเงิน" ไม่ออกบนจอที่ปรับสีเอง
       และคนสั่งของทางไลน์ต้องพิมพ์ชื่อสีได้ · โชว์ทั้งแถบสีและชื่อ */
    + row('WRISTBAND|\u0e2a\u0e32\u0e22\u0e23\u0e31\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e37\u0e2d',function(B,i){
        var c=String(J[i].wbc||'').trim(), nm=String(J[i].wb||'').trim();
        if(/^#[0-9a-fA-F]{3,8}$/.test(c))
          return '<span class="wbc"><i style="background:'+c+'"></i>'
               + (nm?('<b>'+e(nm)+'</b>'):'') + '</span>';
        return e(nm);
      })
    /* §pjRead · ของเดิมอัด AD/CHD/INF/FOC ไว้บรรทัดเดียว "28 / 3 / 0 / 0"
       ต้องนับตำแหน่งเอาเองว่าเลขไหนคืออะไร และกวาดตาข้ามลำไม่ได้
       ใบ Excel ที่ทีมใช้แยกเป็นแถวละประเภท · ทำแบบนั้น
       แต่ประเภทที่วันนั้นไม่มีใครเลยทั้งใบ ไม่ต้องพิมพ์แถวทิ้งไว้ */
    /* §pjPaxRow · ของเดิมแยกเป็นแถวละประเภท 4 แถว · กินที่และกวาดตาลงคอลัมน์ไม่ได้อยู่ดี
       เพราะใบนี้มีไม่กี่คอลัมน์ · รวมเป็นบรรทัดเดียวเรียง AD CHD INF FOC แล้วแยก Total ออกมา */
    + (function(){
        var o='<tr class="pxr"><th class="k">AD / CHD / INF / FOC</th>'
          + boats.map(function(B){ if(!isGo(B)) return '<td class="mut off2">\u2014</td>';
              var P=PX[gi(B)];
              return '<td class="pxg">'+PXKIND.map(function(x){
                var v=+P[x.k]||0;
                return '<span'+(v?'':' class="z"')+'><i>'+x.k.toUpperCase()+'</i><b>'+v+'</b></span>'; }).join('')
              +'</td>'; }).join('')
          +'</tr>';
        o+='<tr class="pxt pxr"><th class="k">TOTAL PAX<i>\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21</i></th>'
          + boats.map(function(B){ if(!isGo(B)) return '<td class="pxn tot z2">\u2014</td>';
              return '<td class="pxn tot">'+PX[gi(B)].all+'</td>'; }).join('')
          +'</tr>';
        return o; })()
    + row('CUSTOMER GROUP',function(B,i){ return e(Object.keys(PX[i].langs||{}).join(' · ')); })
    /* §pjNote · หมายเหตุอยู่ล่างสุด · เป็นของที่เขียนเพิ่มทีหลัง ไม่ใช่ข้อมูลตั้งต้น */
    +'<tr><th class="k">NOTE<i>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38</i></th>'
      + boats.map(function(B){
          if(!isGo(B) && !isWk(B)) return '<td class="mut off2">\u2014</td>';
          /* §pjCk · ของที่ต้องเตรียมของลำนี้ ย้ายมาจากบอร์ดขาออก
             อยู่ตรงนี้ตรงกว่า เพราะเป็นเรื่องของลำเดียว ไม่ใช่ภาพรวมของวัน */
          var chips='';
          if(isGo(B)){ var P=null;
            try{ P=pjPrep(_poDate,B.bid,_poPier); }catch(_){}
            P=P||{lang:{},halal:0,veg:0,vegan:0,allerg:0,lt:0};
            /* §pjNoteTH · \u0e2d\u0e48\u0e32\u0e19\u0e08\u0e1a\u0e40\u0e1b\u0e47\u0e19\u0e1b\u0e23\u0e30\u0e42\u0e22\u0e04\u0e44\u0e17\u0e22 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e16\u0e2d\u0e14\u0e23\u0e2b\u0e31\u0e2a */
            var _cn='\u0e04\u0e19';
            Object.keys(P.lang).sort(function(a,b){ return P.lang[b]-P.lang[a]; })
              .forEach(function(L){ chips+='<span class="pc lang">\u0e41\u0e02\u0e01'+e(pjLangTH(L))+' <b>'+P.lang[L]+'</b>'+_cn+'</span>'; });
            if(P.halal)  chips+='<span class="pc meal">\u0e2d\u0e32\u0e2b\u0e32\u0e23\u0e2e\u0e32\u0e25\u0e32\u0e25 <b>'+P.halal+'</b>'+_cn+'</span>';
            if(P.veg)    chips+='<span class="pc meal">\u0e21\u0e31\u0e07\u0e2a\u0e27\u0e34\u0e23\u0e31\u0e15\u0e34 <b>'+P.veg+'</b>'+_cn+'</span>';
            if(P.vegan)  chips+='<span class="pc meal">\u0e27\u0e35\u0e41\u0e01\u0e19 <b>'+P.vegan+'</b>'+_cn+'</span>';
            if(P.allerg) chips+='<span class="pc alg">&#9888; \u0e41\u0e1e\u0e49\u0e2d\u0e32\u0e2b\u0e32\u0e23 <b>'+P.allerg+'</b>'+_cn+'</span>';
            if(P.lt)     chips+='<span class="pc lt">\u0e40\u0e23\u0e37\u0e2d\u0e2b\u0e32\u0e07\u0e22\u0e32\u0e27 <b>'+P.lt+'</b>'+_cn+'</span>';
          }
          var txt=isGo(B) ? (J[gi(B)].note||'') : (WK[B.bid].note||'');
          return '<td class="nt">'+(chips?('<span class="ntc">'+chips+'</span>'):'')
            +(txt?('<span class="ntt">'+e(txt)+'</span>'):(chips?'':'<span class="mut">\u2014</span>'))+'</td>'; }).join('')
    +'</tr>'
    +'</tbody>';
}
/* lifted out of pjPrint by tools/lift.mjs (var:head) · reads: boats, isGo, pjTint2, e */
function pjPrintHead(C){
  const { boats, isGo, pjTint2, e } = C;
  return '<thead><tr><th class="k kh">VESSEL</th>'
    + boats.map(function(B){
        var go=isGo(B);
        /* §pjHead2 · ของเดิมหนึ่งคอลัมน์มีสองก้อนสีคนละสี · ก้อนบนสีเรือ (ชื่อ+เวลา)
           ก้อนล่างสีเส้นทาง (ชื่อโปรแกรม) · อ่านแล้วไม่รู้ว่าสีไหนหมายถึงอะไร
           ตอนนี้: สีมีที่เดียวคือก้อนชื่อเรือ (สีเรือเหมือนเดิม)
           เวลาออกกับชื่อโปรแกรมย้ายลงมาอยู่ในช่องขาว ไม่มีสีของตัวเอง */
        var raw=(typeof pckBoatColor==='function')?pckBoatColor(B.bid):'#185FA5';
        var rt=B.route||{};
        var col=go?raw:((typeof pjMute==='function')?pjMute(raw):raw);
        var ty=(B.boat.type||'')+(B.boat.engineCount?(' · '+B.boat.engineCount+' Eng'):'');
        /* §pjSect · หัวคอลัมน์เหลือชื่อเรืออย่างเดียว · สีเรือเหมือนเดิม
           เวลาออก/โปรแกรม/เครื่องยนต์/เส้นทาง ลงไปเป็นแถวของตัวเองในหมวดที่ 1 */
        /* §pjHead3 · พื้นสีทึบทับตัวหนังสือขาว อ่านยากและกลบชื่อเรือ
           เปลี่ยนเป็นพื้นสีอ่อนของสีเรือ ตัวหนังสือดำ · สีเรือยังอ่านออกจากขีดหนาใต้ชื่อ */
        return '<th style="padding:0"><div class="bh'+(go?' go':'')+'" style="background:'+pjTint2(col,go?0.68:0.90)
          +';border-bottom:'+(go?'5px':'3px')+' solid '+col+'">'
          /* §pjHead4 · ชื่อเรือใช้สีของเรือเอง · ขีดหนาใต้ชื่อบอกสีเดียวกัน
             อ่านชื่อกับอ่านสีเป็นการกวาดตาครั้งเดียว ไม่ใช่สองครั้ง */
          +'<span class="bn" style="color:'+col+'">'+e(B.boat.name||B.bid)+'</span>'
          +'</div></th>'; }).join('')
    +'</tr></thead>';
}
function pjPrint(){
  var P=PO_PIERS.filter(function(p){ return p.k===_poPier; })[0]||PO_PIERS[0];
  var e=poE;
  /* §pjSheet2 · ใช้ชุดเดียวกับที่หน้าจอโชว์ · เลือกทั้งหมดบนจอ = ปริ้นออกทุกลำ */
  var all=pjAllBoats(_poDate,_poPier);
  /* §pjHideIdle · ไม่ต้องกรองซ้ำตรงนี้ · ใบพิมพ์มีกติกาของตัวเองอยู่แล้ว (§pjSplit ด้านล่าง)
     ซึ่งเข้มกว่า: เก็บเฉพาะลำที่ออกทริป หรือลำที่ซ่อมแล้วมีช่างถูกจ่ายงาน
     ลำที่ยังไม่วางอะไรไปสรุปเป็นกล่องด้านบนของใบแทนอยู่แล้ว ไม่ได้กินคอลัมน์
     ใส่ตัวกรองทับอีกชั้นจะกลายเป็นสองกติกาที่ต้องตามให้ตรงกันตลอดไปโดยไม่ได้อะไรเพิ่ม */
  var boats=(_pjF==='all')?all:all.filter(function(B){ return pjGrp(B._st.k)===_pjF; });
  if(!boats.length){ alert('ไม่มีเรือที่ตรงตัวกรองนี้ในวันที่เลือก'); return; }
  var FLT={all:'ทุกลำของท่านี้',go:'เฉพาะเรือที่วิ่ง',ready:'เฉพาะเรือที่พร้อม',
           work:'เฉพาะลำที่ซ่อมบำรุง · ใช้คน',down:'เฉพาะลำที่ไม่พร้อม'};

  var isGo=function(B){ return !!((B.route||{}).id); };
  var GO=boats.filter(isGo), nGo=GO.length;
  var n=0;   /* §pjCharter · นับหลังกรองเรือเช่าออกแล้ว · ตั้งค่าจริงด้านล่าง */
  var J=GO.map(function(B){ return pjOf(_poDate,B.bid); });
  /* §pjRead · ของเดิมเก็บแค่ชื่อ · ใบ Excel ที่ทีมใช้แยกแถวเป็น Guide TH / CN / RUS
     และ Student/Trainee · ข้อมูลนั้นมีอยู่แล้วใน pjGuidesFull (langs + role)
     ของเดิมทิ้งไปตอน map เอาแต่ชื่อ */
  var GsF=GO.map(function(B){ try{ return pjGuidesFull(_poDate,B.bid)||[]; }catch(_){ return []; } });
  var Gs=GsF.map(function(a){ return a.map(function(x){ return x.name; }); });
  /* §pjGdOrder (2026-09-12) · "ให้เรียง"
     ของเดิมจัดแถวไกด์บนใบพิมพ์ตามภาษา/บทบาท (ไกด์·EN / ·RU / ·CN / นักศึกษาฝึกงาน / สตาฟ)
     ซึ่งเป็นคนละโครงกับการ์ดบนจอที่เป็น Guide 1..N / Trainee-Staff 1..M
     ผลคือสองอย่าง: ชื่อช่องที่ตั้งเองบนการ์ดไปไม่ถึงกระดาษ · และลำดับคนบนกระดาษ
     ไม่ตรงกับลำดับที่จัดไว้บนจอ คนถือใบต้องไล่หาชื่อเอง

     เปลี่ยนเป็นเรียงตามช่องจริงของการ์ด · กลุ่มไกด์ก่อน แล้วต่อด้วย Trainee/Staff
     ลำดับภายในกลุ่มคือลำดับใน A.g เหมือนที่การ์ดใช้ (pjGdPick นับตำแหน่งแบบเดียวกัน)
     คนแรกของกลุ่มไกด์ยังเป็นผู้รับผิดชอบใบสั่งงานเหมือนเดิม (§gdLead)
     ภาษาที่พูดได้ย้ายไปห้อยท้ายชื่อทั้งหมด · เดิมตัดภาษาที่ตรงกับหัวแถวออก
     ตอนนี้หัวแถวไม่ได้บอกภาษาแล้ว จึงต้องโชว์ให้ครบ */
  var GB=GsF.map(function(list){
    var g=[], t=[];
    (list||[]).forEach(function(x){ (x.guide?g:t).push(x); });
    return {g:g, t:t};
  });
  var _nGdR=0, _nTrR=0;
  GB.forEach(function(b){ if(b.g.length>_nGdR) _nGdR=b.g.length; if(b.t.length>_nTrR) _nTrR=b.t.length; });
  var GD_ROWS=[];
  for(var _gi=0;_gi<_nGdR;_gi++) GD_ROWS.push({kind:'gd', idx:_gi});
  for(var _ti=0;_ti<_nTrR;_ti++) GD_ROWS.push({kind:'tr', idx:_ti});
  var gdCell=function(i,R){
    var g=(GB[i][R.kind==='gd'?'g':'t']||[])[R.idx]; if(!g) return '';
    var L=(g.langs||[]);
    return e(g.name||'')+(L.length?(' <span class="rl">'+e(L.join('/'))+'</span>'):''); };
  var PX=GO.map(function(B){ var p=pjPax(_poDate,B.bid,_poPier); p.all=p.ad+p.chd+p.inf+p.foc; return p; });
  var totPax=0; PX.forEach(function(p){ totPax+=p.all; });
  var mx=function(a){ var m=0; a.forEach(function(v){ if(v>m) m=v; }); return m; };

  /* §pjWork2 · ทีมช่างของลำที่ไม่ได้ออก · ตำแหน่งเรียงตรงกับช่องลูกเรือพอดี */
  var WROLE=['หัวหน้าช่าง','ช่าง 1','ช่าง 2','ช่วยงาน 1','ช่วยงาน 2','ช่วยงาน 3','ช่วยงาน 4'];
  /* §pjWkLb (2026-09-12) · "อันนี้แก้ แต่ใบทีปริ้นออกไม่ได้แก้ตาม"
     ชื่อช่องของลำที่ "ไม่ได้ออก" เก็บอยู่คนละชุดกับลำที่ออก · การ์ดบันทึกด้วย kind='wk'
     (หัวหน้าช่าง · ช่าง 1 · ช่วยงาน 1 ...) แต่ใบพิมพ์อ่านจาก WROLE ที่ฝังไว้ตายตัว
     §pjLbSheet รอบก่อนต่อสายให้เฉพาะ kind='go' · ฝั่ง 'wk' จึงยังไม่ตามมา

     ที่นี่ไม่มีปัญหา "หัวแถวมีได้ค่าเดียว" แบบฝั่ง go เพราะป้ายตำแหน่งของลำที่จอด
     พิมพ์ติดท้ายชื่อคนในช่องของลำนั้นเอง · แต่ละลำจึงถือชื่อช่องของตัวเองได้ตรง ๆ */
  var WSLOT=['cap','asst','crew0','crew1','crew2','island0','island1'];
  var wrole=function(bid,i){
    try{ return pjSlotLb('wk', WSLOT[i], WROLE[i], bid, _poDate); }catch(_){ return WROLE[i]; } };
  var WK={};
  boats.forEach(function(B){
    if(isGo(B)) return;
    var R=(typeof pjRaw==='function')?pjRaw(_poDate,B.bid):null; if(!R) return;
    var ids=[R.cap||'', R.asst||''];
    for(var c=0;c<3;c++) ids.push((R.crew||[])[c]||'');
    for(var c=0;c<2;c++) ids.push((R.island||[])[c]||'');
    /* §wkPack · ลำที่จอด · ชื่อคนต้องเรียงชิดบนสุดของช่วงคน ไม่เว้นรูตามช่องบนจอ
       ช่องบนการ์ดเว้นได้ตามใจคนจ่ายงาน (จ่ายช่อง "ช่าง 2" ทั้งที่ "ช่าง 1" ว่าง)
       แต่บนกระดาษรูตรงกลางอ่านเหมือนลืมเขียน · ชื่อตำแหน่งจริงติดท้ายชื่อคนอยู่แล้ว
       จึงย้ายขึ้นได้โดยไม่เสียความหมาย */
    var pk=[];
    ids.forEach(function(id,i){ if(id) pk.push({id:id, role:wrole(B.bid,i)}); });
    if(pk.length) WK[B.bid]={ids:ids, p:pk, note:R.note||''};
  });
  var isWk=function(B){ return !!WK[B.bid]; };
  var WKL=Object.keys(WK).map(function(k){ return WK[k]; });
  var nWk=WKL.length;
  /* §pjSplit · ใบนี้มี 12 คอลัมน์ แต่ลำที่มีคนทำงานจริงวันนั้นมีแค่ 4
     อีก 8 ลำกินที่คอลัมน์ละเท่ากันทั้งที่ทุกช่องเป็นขีดกลาง
     ตารางจึงเก็บเฉพาะ "ลำที่มีคนอยู่กับมันวันนี้" — ออกทริป หรือ ซ่อมแล้วมีช่างถูกจ่ายงาน
     ลำที่ว่าง/จอด/ไม่พร้อมและไม่มีใครทำอะไรด้วย ไปสรุปเป็นกล่องด้านบนแทน */
  n = boats.length;   /* §pjCharter · เรือเช่าที่ไม่ได้เช่าวันนั้น ถูกกรองที่ pjAllBoats แล้ว */
  var REST = boats.filter(function(B){ return !isGo(B) && !isWk(B); });
  boats    = boats.filter(function(B){ return  isGo(B) ||  isWk(B); });
  /* §gdIdle · ลำที่ไม่ได้ออกแต่จ่ายไกด์ไว้ · เดิมช่วงไกด์ของคอลัมน์นี้เป็นช่องรวมช่องเดียว
     ชื่อไกด์เลยไม่มีที่ลง · ทำให้คอลัมน์นี้พิมพ์แถวไกด์จริง แล้วเลื่อนช่องรวมงานซ่อม
     ไปเริ่มที่แถว "ร้านอาหาร" แทน · ลำที่ไม่มีไกด์ยังรวมยาวเหมือนเดิม */
  var WKG={};
  boats.forEach(function(B){
    if(isGo(B)) return;
    var g=[]; try{ g=(pjGuides(_poDate,B.bid)||[]).filter(Boolean); }catch(_){}
    if(g.length) WKG[B.bid]=g;
  });
  /* ลำที่มีแต่ไกด์ ไม่มีทีมช่าง · ต้องมีที่นั่งใน WK ด้วย ไม่งั้นทั้งคอลัมน์ถูกรวมตั้งแต่แถวแรก */
  Object.keys(WKG).forEach(function(k){
    if(WK[k]) return;
    var R=null; try{ R=(typeof pjRaw==='function')?pjRaw(_poDate,k):null; }catch(_){}
    WK[k]={ids:['','','','','','',''], p:[], note:(R&&R.note)||''};
  });

  /* ลำที่จอดก็กินช่องเด็กเรือ/ประจำเกาะเหมือนกัน · ไม่นับด้วยแถวจะขาด ชื่อช่างหาย
     §wkPack · นับจากคิวที่ชิดบนแล้ว ไม่ใช่ช่องดิบ · คน 3 คนที่กระจายอยู่ช่อง 1/3/5
     ต้องการแค่แถว "เด็กเรือ 1" แถวเดียว ไม่ใช่ลากยาวไปถึงประจำเกาะ */
  var CJ=J.concat(WKL.map(function(w){ var P=(w.p||[]).map(function(x){ return x.id; });
    return {crew:[P[2]||'',P[3]||'',P[4]||''], island:[P[5]||'',P[6]||'']}; }));
  var nCrew=Math.max(2, Math.min(4, mx(CJ.map(function(j){ return (j.crew||[]).filter(Boolean).length; }))));
  var nIsl =Math.max(1, Math.min(2, mx(CJ.map(function(j){ return (j.island||[]).filter(Boolean).length; }))));
  /* §gdRole · เดิมล็อก 3 · ลำที่จ่ายไกด์ 5 คนจะหายไป 2 คนเงียบ ๆ · ปล่อยตามจริง กัน 8 ไว้กันตารางบาน */
  var GsAll=Gs.concat(Object.keys(WKG).map(function(k){ return WKG[k]; }));   /* §gdIdle */
  var nGd  =Math.max(1, Math.min(8, mx(GsAll.map(function(g){ return g.filter(Boolean).length; }))));
  /* จำนวนแถวในตัวตาราง · ช่องของลำที่ไม่ออกต้องคลุมให้ครบพอดี ไม่งั้นตารางเบี้ยว
     §pjRead · ของเดิมนับ nGd กับ "ลค 1 แถว" · ตอนนี้ช่องไกด์นับจาก GD_ROWS (§pjGdOrder)
     และผู้โดยสารเป็นหลายแถว ต้องนับจากตัวจริง ไม่งั้นช่องลำที่จอดสั้นกว่าตาราง */
  /* §pjRead · ประเภทผู้โดยสารที่วันนั้นมีคนจริง · ใช้ทั้งตอนคิดขนาดตัวอักษรและตอนวาดแถว */
  /* §pjPaxRow · ทั้งสี่ประเภทอยู่บรรทัดเดียว จึงไม่ต้องคัดประเภทที่ไม่มีคนออกอีก
     เลข 0 ยังต้องเห็น เพราะ "ไม่มีเด็ก" กับ "ยังไม่ได้กรอก" ไม่เหมือนกัน */
  var PXKIND=[{k:'ad'},{k:'chd'},{k:'inf'},{k:'foc'}];
  var PXROW=2;   /* แถวเรียง + แถวรวม */

  var GDSUM=GD_ROWS.length;   /* §pjGdOrder · หนึ่งช่อง = หนึ่งแถว ไม่ต้องบวกทีละถัง */
  /* §pjSect · นับจากแถวสถานะลงไปจนจบตาราง
     ทริป/เวลา/เส้นทาง 3 + แถบ2 1 + กัปตัน/ผู้ช่วย 2 + เด็กเรือ + ประจำเกาะ
     + แถบ3 1 + ช่องไกด์ + ร้านอาหาร 1 + แถบ4 1 + สายรัด/ภาษา 2 + ผู้โดยสาร + หมายเหตุ 1 */
  var SPAN = 12 + nCrew + nIsl + GDSUM + PXROW;
  /* §pjWork2 · ลำที่มีทีมช่าง · ช่องบนพิมพ์จริง เหลือช่วงไกด์+ลูกค้าที่คลุมเป็นช่องเดียว
     หัวไกด์ + ไกด์ nGd + หัวลูกค้า + สายรัด + ภาษา + ลค + หัวหมายเหตุ = nGd + 6
     แถวหมายเหตุไม่รวม · ลำที่จอดก็เขียนหมายเหตุได้เหมือนกัน */
  var WKSPAN = 1 /*แถบ3*/ + GDSUM + 1 /*ร้านอาหาร*/ + 1 /*แถบ4*/ + 2 + PXROW;

  /* §pjSheet2 · ลำที่ออกจริงได้คอลัมน์กว้างเป็นสองเท่า · ลำที่จอดไม่มีอะไรให้อ่าน */
  /* §pjSheet3 · GAP เป็นพิกเซลจริง · ต้องหักออกจากเปอร์เซ็นต์ ไม่งั้นตารางล้นหน้ากระดาษ
     SHEETW = ความกว้างเนื้อหาของ A4 แนวนอนขอบ 8 มม. โดยประมาณ · ตีต่ำไว้ปลอดภัยกว่าตีสูง */
  /* §pjBig · กว้างขึ้นตามขนาดตัวอักษร · ไม่งั้นชื่อคนตกบรรทัดทุกช่อง */
  /* §pjFlat · ไฟล์ต้นแบบเป็นตารางเส้นต่อเนื่อง ไม่ใช่การ์ดแยกคอลัมน์ */
  var GAP=0, SHEETW=1760;
  var gapPct=(boats.length+2)*GAP/SHEETW*100, avail=100-gapPct;
  /* §pjLbl · ป้ายแถวมีคำกำกับไทยต่อท้ายแล้ว · 7.6% = 143px ตัด "WRISTBAND \u0e2a\u0e32\u0e22\u0e23\u0e31\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e37\u0e2d" หายครึ่งคำ */
  var LW=11.4*avail/100, WT=boats.map(function(B){ return isGo(B)?2:(isWk(B)?1.5:1); });
  var SUM=0; WT.forEach(function(w){ SUM+=w; });
  var cols='<colgroup><col style="width:'+LW+'%">'
    + WT.map(function(w){ return '<col style="width:'+((avail-LW)*w/SUM).toFixed(3)+'%">'; }).join('')
    + '</colgroup>';
  /* §pjBig · ใบนี้ไม่ได้ถูกปริ้นลง A4 แล้ว · ทีมแคปเป็นรูปส่งไลน์
     ข้อจำกัดจึงไม่ใช่ "สูงเท่าหน้ากระดาษ" · เป็น "อ่านออกบนจอมือถือ"
     ตัวหนังสือเดิม 7.5–9.6px เล็กเพราะต้องยัดลงกระดาษแผ่นเดียว · ปล่อยให้ใหญ่ได้แล้ว
     ยังลดตามจำนวนคอลัมน์อยู่ เพราะความกว้างเป็นข้อจำกัดจริง (ยิ่งลำเยอะ ช่องยิ่งแคบ) */
  var fs = SUM<=12?17 : (SUM<=18?15 : (SUM<=26?13 : 11.5));

  var css=pjPrintCss({ fs, GAP })
   ;

  /* §pjSect · สีพื้นจาง ๆ จากสีเส้นทาง · ผสมกับขาว 86% แล้วยังบอกได้ว่าเป็นเส้นทางไหน
     ตัวหนังสือใช้สีเดิมหมองลง จะได้ contrast พอบนพื้นจาง */
  var pjTint=function(hex){ var c=String(hex||'').replace('#',''); if(c.length!==6) return '#F4F6F9';
    var r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16), k=0.60;
    var m=function(v){ return Math.round(v+(255-v)*k); };
    return 'rgb('+m(r)+','+m(g)+','+m(b)+')'; };
  /* §pjVivid · ผสมขาวตามระดับที่ส่งเข้ามา
     ลำที่ออกงานวันนี้ใช้ 0.68 (เห็นเป็นสีชัด) · ลำที่จอดใช้ 0.90 (เกือบขาว)
     คนกวาดตาแถวหัวเรือจะเห็นทันทีว่าวันนี้ลำไหนออก โดยไม่ต้องอ่านแถวทริป */
  var pjTint2=function(hex,k){ var c=String(hex||'').replace('#',''); if(c.length!==6) return '#EEF1F6';
    var r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
    k=(k==null)?0.88:k;
    var m=function(v){ return Math.round(v+(255-v)*k); };
    return 'rgb('+m(r)+','+m(g)+','+m(b)+')'; };
  var pjInk=function(hex){ var c=String(hex||'').replace('#',''); if(c.length!==6) return '#41506A';
    var r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16), k=0.52;
    var m=function(v){ return Math.round(v*(1-k)); };
    return 'rgb('+m(r)+','+m(g)+','+m(b)+')'; };
  var lic=function(sid){ var t=''; try{ t=plPrintLic(sid).replace(/^\s*\(|\)\s*$/g,''); }catch(_){}
    return t?(' <span class="rl">· '+e(t)+'</span>'):''; };
  var who=function(sid,withLic){ if(!sid) return ''; var nm=pjStaffName(sid); if(!nm) return '';
    return e(nm)+(withLic?lic(sid):''); };
  /* ช่องของลำที่ไม่ออก · โผล่แค่แถวแรก แล้วยาวคลุมลงมาทั้งตัวตาราง */
  /* §pjFlat · เหตุผลที่ลำนี้ไม่ได้ออกวันนี้ · อยู่ในช่องเดียวของแถวชื่อทริป
     ของเดิมเป็นบล็อกยาวพาดทั้งคอลัมน์ · ที่นี่ย่อเหลือป้ายเดียว รายละเอียดเป็นบรรทัดเล็ก */
  var offLbl=pjPrintOffLbl({ isWk, e });
  var offCell=function(B){
    var SM=PJ_ST[B._st.k]||PJ_ST.idle;
    var sub=B._away
      ? ('วันนี้ไปวิ่งที่ '+e(((PO_PIERS.filter(function(x){ return x.k===(B._away.route.pier||''); })[0])||{}).n||'ท่าอื่น'))
      /* ที่อยู่/หมายเหตุบางลำเก็บเป็นขีดกลางแทนค่าว่าง · ปล่อยไว้จะได้ "- · MJ-018" ติดใบไป */
      : e([B._st.loc||'', B._st.note||''].filter(function(x){
          var v=String(x||'').trim(); return v && v!=='-' && v!=='—'; }).join(' \u00b7 '));
    return '<td class="off" rowspan="'+SPAN+'">'
      +'<span class="sq" style="background:'+SM.bg+';color:'+SM.fg+'">'+e(SM.t)+'</span>'
      +(sub?('<span class="sm">'+sub+'</span>'):'')+'</td>';
  };
  var gi=function(B){ var k=-1; GO.forEach(function(x,i){ if(x===B) k=i; }); return k; };

  /* §pjWork2 · ชื่อช่าง + ป้ายตำแหน่งจริง · ป้ายซ้ายมือยังเป็นชื่อช่องของลูกเรือ */
  /* §wkPack · pos = ลำดับของแถวในช่วงคน ไม่ใช่หมายเลขช่องที่จ่ายไว้
     ตำแหน่งจริงมาจากคิว (p) จึงยังถูกต้องแม้ชื่อจะเลื่อนขึ้นมาคนละแถวกับบนจอ */
  var wkWho=function(B,pos){
    var w=WK[B.bid]; if(!w) return '';
    var x=(w.p||[])[pos]; if(!x) return '';
    var nm=who(x.id,0);
    return nm?(nm+' <span class="rl">· '+x.role+'</span>'):'';
  };
  /* แถบสถานะของลำที่จอด · แทนช่องโปรแกรม · สีเดียวกับป้ายสถานะบนหน้าจอ */
  var wkHead=function(B){
    var SM=PJ_ST[B._st.k]||PJ_ST.idle;
    var mj=(B._st.mj||[]), M=null;
    try{ M=pjMjOf(_poDate,B.bid,mj); }catch(_){}
    var sub=[ M?((M.no?(M.no+' · '):'')+(M.title||M.type||'')).trim():'', B._st.loc||'' ]
      .filter(function(x){ var v=String(x||'').trim(); return v && v!=='-' && v!=='—'; }).join(' \u00b7 ');
    return '<td class="wk" style="background:'+SM.bg+';color:'+SM.fg+'">'+e(SM.t)
      +(sub?('<span class="sub">'+e(sub)+'</span>'):'')+'</td>';
  };
  /* ช่องล่างของลำที่จอด · ไม่มีไกด์ ไม่มีลูกค้า · เอาช่วงงานมาลงแทน */
  var wkInfo=function(B){
    var ST=B._st, mj=ST.mj||[], M=null; try{ M=pjMjOf(_poDate,B.bid,mj); }catch(_){}
    var L=[];
    if(M) L.push((pjMjPlanned(M)?'ตามแผน':'ซ่อมแก้ไข')
      +(M.startDate?(' \u00b7 เริ่ม '+pjDocDate(M.startDate)):'')
      +(M.location?(' \u00b7 '+M.location):''));
    var Fm=(ST.log&&ST.log.from)||'', To=(ST.log&&ST.log.to)||'';
    var d=0; try{ if(Fm) d=Math.max(0,Math.round((new Date(_poDate+'T12:00:00')-new Date(Fm+'T12:00:00'))/86400000))+1; }catch(_){}
    if(Fm) L.push('เริ่ม '+pjDocDate(Fm)+(d?(' \u00b7 วันที่ '+d):''));
    L.push('กลับใช้งาน '+(To?pjDocDate(To):'ยังไม่ระบุ'));
    if(mj.length>1) L.push('งานเปิด '+mj.length+' ใบ');
    return L;
  };
  /* §gdIdle · ช่องรวมของลำที่จอด · เริ่มแถวไหน คลุมกี่แถว แล้วแต่ว่ามีไกด์หรือไม่ */
  var wkiCell=function(B,span){
    var L=wkInfo(B);
    return '<td class="off wki" rowspan="'+span+'">'
      + L.map(function(x,i){ return '<span class="sm"'+(i?'':' style="margin-top:0"')+'>'+e(x)+'</span>'; }).join('')
      +'</td>';
  };
  /* §pjFlat · ของเดิมยุบลำที่ไม่ได้ออกเป็นช่องเดียวพาดลงมาทั้งคอลัมน์
     ทำให้ตารางไม่เหลือเส้นตาราง กวาดตาข้ามลำไม่ได้ และแถบหมวดขาดตอน
     ไฟล์ต้นแบบให้ทุกลำมีช่องครบทุกแถว ช่องที่ไม่มีข้อมูลเป็นขีดกลางจาง ๆ */
  /* §pjLbl · ป้ายแถวเป็น "ENGLISH \u0e44\u0e17\u0e22" บรรทัดเดียวกัน
     อังกฤษคือป้ายหลัก (ไกด์ต่างชาติอ่านได้) · ไทยเป็นคำกำกับตัวเล็กสำหรับทีมหน้าท่า
     ของเดิมไทยอยู่คนละบรรทัด กินความสูงแถวโดยไม่ได้เพิ่มความเข้าใจ
     เขียนเป็น 'CAPTAIN|\u0e01\u0e31\u0e1b\u0e15\u0e31\u0e19' · ไม่ใส่ | ก็ได้ = ไม่มีคำกำกับ */
  var lbl=function(k){
    var a=String(k).split('|');
    return a[0]+(a[1]?('<i>'+a[1]+'</i>'):''); };
  /* §pjLbSheet (2026-09-12) · "แก้แล้วควรลิ้งกับใบงาน"
     ชื่อช่องที่ตั้งเองบนการ์ด (§pjLbScope) ต้องขึ้นบนใบที่พิมพ์ด้วย ไม่ใช่แค่บนจอ

     ข้อจำกัดของใบนี้ · เป็นตารางเดียว ลำเป็นคอลัมน์ หัวแถวจึงมีได้ค่าเดียว
     แต่ชื่อช่องตอนนี้เป็นของ "ลำนี้ วันนี้" ซึ่งแต่ละลำตั้งไม่เหมือนกันได้
     กติกาที่ใช้:
       ทุกลำที่พิมพ์ตั้งชื่อช่องนี้ตรงกัน → ใช้ชื่อนั้นเป็นหัวแถวเลย
       ตั้งไม่ตรงกัน → หัวแถวคงชื่อมาตรฐานไว้ แล้วติดชื่อของลำนั้นไว้ในช่องของลำนั้น
     ถ้าเปลี่ยนหัวแถวตามลำใดลำหนึ่ง อีกลำจะอ่านใบผิดทันที · จึงไม่ทำแบบนั้น */
  var slotLbOf=function(B,kind,slot,def){
    try{ return pjSlotLb(kind,slot,def,B.bid,_poDate); }catch(_){ return def; } };
  var lbRow=function(kind,slot,def,k,fn,first,wfn){
    var gos=boats.filter(isGo);
    var vals=gos.map(function(B){ return slotLbOf(B,kind,slot,def); });
    var uniq=vals.filter(function(v,i){ return vals.indexOf(v)===i; });
    var kk=k, custom=null;
    if(uniq.length===1 && uniq[0]!==def){
      /* ตรงกันทุกลำ · แทนที่ชื่ออังกฤษ เก็บคำกำกับไทยเดิมไว้ */
      var th=String(k).split('|')[1]||'';
      kk=uniq[0]+(th?('|'+th):'');
    } else if(uniq.length>1){ custom=1; }
    var fn2=custom ? function(B,i){
        var v=fn(B,i); if(!v) return v;
        var lb=slotLbOf(B,kind,slot,def);
        return (lb===def) ? v
          : ('<span style="display:block;font-size:8.5px;font-weight:700;letter-spacing:.03em;opacity:.7">'
             +poE(lb)+'</span>'+v);
      } : fn;
    return row(kk,fn2,first,wfn);
  };
  var row=function(k,fn,first,wfn){
    return '<tr><th class="k">'+lbl(k)+'</th>'
      + boats.map(function(B){
          if(isGo(B)){ var v=fn(B, gi(B)); return v?('<td class="v">'+v+'</td>'):'<td class="mut">\u2014</td>'; }
          if(isWk(B) && wfn){ var w=wfn(B);
            if(w && w!==false && String(w).slice(0,3)!=='<td') return '<td class="v">'+w+'</td>'; }
          return '<td class="mut off2">\u2014</td>';
        }).join('') + '</tr>'; };
  /* §pjSect · แถบหมวด · มีเลขกำกับและชื่อสองภาษาแบบไฟล์ที่ส่งมา */
  /* §pjSect · แถบหมวด · จำนวนช่องต้องตรงกับที่ยังไม่ถูก rowspan คลุม ไม่งั้นตารางเลื่อนทั้งใบ
     first = แถบแรกสุด ยังไม่มีช่องรวมของใคร ทุกลำต้องมีช่อง
     wkOff = ช่วงที่ลำซ่อมถูกช่องรวมคลุมแล้ว (ตั้งแต่แถบ 4) */
  /* §pjBandLite · แถบหมวดจากพื้นทึบเข้ม เป็นพื้นอ่อนตัวหนังสือเข้ม
     ของเดิมสามแถบเข้มพาดกลางใบ ดึงสายตาแรงกว่าเนื้อหาที่มันคั่นอยู่ */
  /* §pjBand2 · เลขหมวดเคยเป็นกล่องทึบ · บนใบที่ทุกอย่างเป็นตัวหนังสือ
     กล่องเล็ก ๆ สามกล่องกลางใบดึงสายตาแรงกว่าชื่อหมวดที่มันกำกับอยู่
     เขียนเป็น "1 \u00b7 NAUTICAL CREW" แนวเดียวกับป้ายหมวดด้านบนใบ */
  var band=function(no,en,bg,ink,th){
    return '<tr class="bd"><th style="background:'+bg+';color:'+ink+'">'
      +'<span class="no">'+no+'</span>'+en+(th?('<i>'+th+'</i>'):'')+'</th>'
      + boats.map(function(){
          return '<td style="background:'+bg+';--bdc:'+bg+'"></td>'; }).join('')+'</tr>'; };
  var gh=function(t,cls,wcell){
    return '<tr class="gh '+cls+'"><th>'+t+'</th>'
      + boats.map(function(B){
          if(isGo(B)) return '<td></td>';
          if(isWk(B)) return wcell?wcell(B):'';
          return '';
        }).join('')+'</tr>'; };

  var head=pjPrintHead({ boats, isGo, pjTint2, e });

  /* §pjSect · แถวข้อมูลเรือ/ทริป · เดิมอยู่ในหัวคอลัมน์ปนกับชื่อเรือ */
  /* §pjTrip · แถวเดียวตอบว่า "วันนี้ลำนี้ทำอะไร" · ออกทริปก็ชื่อทริป
     ไม่ออกก็เหตุผล (ขึ้นคาน/ซ่อม/จอด) · ไม่ต้องมีแถวสถานะแยกอีกแถว */
  var tripRow=function(){
    return '<tr class="rt"><th class="k">TRIP<i>\u0e07\u0e32\u0e19</i></th>'
      + boats.map(function(B){
          if(!isGo(B)) return offLbl(B);
          var rt=B.route||{};
          return '<td class="v ctr trip" style="background:'+pjTint(rt.color||'#64748B')
            +';color:'+pjInk(rt.color||'#64748B')+'">'+e(rt.name||'\u2014')+'</td>'; }).join('')
      +'</tr>'; };
  var timeRow=function(){
    return '<tr><th class="k">TIME<i>\u0e40\u0e27\u0e25\u0e32\u0e2d\u0e2d\u0e01</i></th>'
      + boats.map(function(B){
          if(!isGo(B)) return '<td class="mut off2">\u2014</td>';
          return '<td class="v ctr tmc">'+e(B.dep||'--:--')+'</td>'; }).join('')
      +'</tr>'; };

  var body=pjPrintBody({ tripRow, timeRow, row, e, band, lbRow, who, J, wkWho, nCrew, nIsl, GDSUM, GD_ROWS, gdCell, WKG, boats, isGo, PX, gi, PXKIND, isWk, WK });

  /* §pjSplit · กล่องสรุปเหนือตาราง · แยกลำพร้อมใช้ ออกจากลำที่ซ่อม/ไม่พร้อม */
  var fleetBox=pjPrintFleetBox({ REST, e });

  /* §pjBrd · บอร์ดเรือออก · โครงเดียวกับตารางขาออกสนามบิน
     หนึ่งแถว = หนึ่งลำที่ออก · ทุกอย่างอยู่แถวเดียวกัน ไม่มีบรรทัดรอง
     เรียงตามเวลาออก ลำที่ออกก่อนอยู่บน

     §pjBrd4 · ใบนี้ออก "ก่อน" เริ่ม Operation จึงมีแต่ของที่รู้ล่วงหน้าได้
     สถานะเช็คอิน / ที่นั่งเหลือ / รถคันสุดท้ายถึงกี่โมง เป็นของที่เกิดตอนวันงาน
     ตอนพิมพ์ใบยังไม่มีค่า ใส่ไปก็เป็นเลขหลอก จึงไม่ใส่ */
  var progBox=pjPrintProgBox({ GO, PX, J, e });

  var DW=pjDateWords(_poDate);
  /* §pjTop · เลขวัน / ชื่อวัน / เดือน-ปี แยกชิ้นสำหรับหัวใบ */
  var _pjD=new Date(_poDate+'T12:00:00');
  var _pjDay=_pjD.getDate();
  var _pjWd=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][_pjD.getDay()];
  var _pjMo=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST',
             'SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][_pjD.getMonth()]+' '+_pjD.getFullYear();
  var sheet=pjPrintSheet({ e, P, _pjWd, _pjDay, _pjMo, progBox, fleetBox, cols, head, body });

  /* §pjShot · โค้ดฝั่งหน้าต่างที่เด้งขึ้นมา · ไม่แตะแอปหลัก */
  var fn=('boatjob_'+(P.k||_poPier||'pier')+'_'+_poDate).replace(/[^A-Za-z0-9_.-]+/g,'_');
  var scr=pjShotScript(fn);

  var html='<!doctype html><html lang="th"><head><meta charset="utf-8">'
   +'<title>ใบงานเรือ · '+e(P.n||P.t)+' · '+e(_poDate)+'</title>'
   +'<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500;700&family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
   +'<style id="sty">'+css+'</style></head><body>'
   +'<div class="tb">'
     +'<button class="pri" onclick="window.print()">&#128424; พิมพ์</button>'
     +'<button class="img" id="bimg" onclick="shot()">&#128247; บันทึกเป็นรูป PNG</button>'
     +'<span class="hint">ปุ่มสองปุ่มนี้อยู่บนหน้าจอเท่านั้น · ไม่ติดไปกับกระดาษและไม่ติดในรูป</span>'
   +'</div>'
   + sheet
   +'<script>'+scr+'<\/script></body></html>';

  var w=window.open('','_blank','width=1220,height=880');
  if(!w){ alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ · อนุญาต pop-up ของหน้านี้ก่อน'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try{ w.focus(); }catch(_){} }, 300);
}

/* §poSign · โค้ดฝั่งหน้าต่างที่เด้งขึ้นมา · ปุ่มพิมพ์ + บันทึก PNG
   ยกออกมาจากใบงานเรือทั้งดุ้น · ใบเซ็นใช้ตัวเดียวกัน จะได้ไม่ต้องแก้สองที่เวลาปุ่มพัง */
function pjShotScript(fn){
  return ""
   +"var FN="+JSON.stringify(fn)+";"
   +"function bz(t,d){var b=document.getElementById('bimg');b.textContent=t;b.disabled=!!d;}"
   +"function save(c){var fin=function(u,rv){var a=document.createElement('a');a.href=u;a.download=FN+'.png';"
     +"document.body.appendChild(a);a.click();a.remove();"
     +"if(rv)setTimeout(function(){try{URL.revokeObjectURL(u);}catch(_){}},5000);"
     +"bz('\u{1F4F7} \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e40\u0e1b\u0e47\u0e19\u0e23\u0e39\u0e1b PNG',0);};"
     +"try{if(c.toBlob){c.toBlob(function(b){b?fin(URL.createObjectURL(b),1):fin(c.toDataURL('image/png'),0);},'image/png');return;}}catch(_){}"
     +"fin(c.toDataURL('image/png'),0);}"
   +"function svgShot(ok,bad){try{"
     +"var el=document.getElementById('sheet'),w=el.offsetWidth,h=el.offsetHeight,sc=2;"
     +"var wr=document.createElement('div');"
     +"wr.setAttribute('xmlns','http://www.w3.org/1999/xhtml');"
     +"wr.setAttribute('style','width:'+w+'px;background:#fff');"
     +"var sy=document.createElement('style');sy.textContent=document.getElementById('sty').textContent;"
     +"wr.appendChild(sy);wr.appendChild(el.cloneNode(true));"
     +"var inner=new XMLSerializer().serializeToString(wr);"
     +"var svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"'+w+'\" height=\"'+h+'\">'"
       +"+'<foreignObject width=\"100%\" height=\"100%\">'+inner+'</foreignObject></svg>';"
     +"var im=new Image();"
     +"im.onload=function(){var c=document.createElement('canvas');c.width=w*sc;c.height=h*sc;"
       +"var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.scale(sc,sc);"
       +"x.drawImage(im,0,0);try{ok(c);}catch(_){bad();}};"
     +"im.onerror=function(){bad();};"
     +"im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);"
   +"}catch(_){bad();}}"
   +"function shot(){bz('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e39\u0e1b...',1);"
     +"var el=document.getElementById('sheet');"
     +"var bad=function(){svgShot(save,function(){bz('\u{1F4F7} \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e40\u0e1b\u0e47\u0e19\u0e23\u0e39\u0e1b PNG',0);"
       +"alert('\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e39\u0e1b\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u00b7 \u0e43\u0e0a\u0e49\u0e1b\u0e38\u0e48\u0e21 \u0e1e\u0e34\u0e21\u0e1e\u0e4c \u0e41\u0e25\u0e49\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01 Save as PDF \u0e41\u0e17\u0e19\u0e44\u0e14\u0e49');});};"
     +"var run=function(){try{html2canvas(el,{scale:2,backgroundColor:'#ffffff',logging:false})"
       +".then(function(c){save(c);}).catch(bad);}catch(_){bad();}};"
     +"if(window.html2canvas) return run();"
     +"var s=document.createElement('script');"
     +"s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';"
     +"s.onload=run;s.onerror=bad;document.head.appendChild(s);}";
}

/* §pjModule · exports */
// the screen itself · renderPierJob and its helpers in 08-app.js
window.PJ_ACTIONS = PJ_ACTIONS;
window.pjOn = pjOn;
window.pjCard = pjCard;
window.pjAllBoats = pjAllBoats;
window.pjBoatSt = pjBoatSt;
window.pjGrp = pjGrp;
window.pjSubN = pjSubN;
window.pjIsIdle = pjIsIdle;
window.pjApplyIdle = pjApplyIdle;
window.pjAlignSecs = pjAlignSecs;
window.pjGuideJobMap = pjGuideJobMap;
window.pjPierOf = pjPierOf;
window.pjPierShort = pjPierShort;
window.pjGo = pjGo;
window.pjCSS = pjCSS;
window.pjOf = pjOf;
window.pjPax = pjPax;
window.pjStaffName = pjStaffName;
window.pjDateWords = pjDateWords;
// check-in, guide jobs (08e-checkin.js) · pier cash (08g-cash.js) · reports (08i-reports.js)
window.pjCrewOf = pjCrewOf;
window.pjCrewLine = pjCrewLine;
window.pjGuides = pjGuides;
window.pjGuidesFull = pjGuidesFull;
window.pjPrint = pjPrint;
window.pjShotScript = pjShotScript;
// used only by UI tests (test/ui/t_pjwb, t_pjwbsave, t_pjstale)
window.pjKey = pjKey;
window.pjPopToggle = pjPopToggle;
window.pjWbSet = pjWbSet;
window.pjWbName = pjWbName;
window.pjOpDrop = pjOpDrop;

})();
