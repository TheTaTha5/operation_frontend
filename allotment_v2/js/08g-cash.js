// 08g-cash.js · Pier cash · petty cash
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

function pcKey(pier){ return 'po_cash_'+(pier||'panwa'); }
function pcClone(o){ return JSON.parse(JSON.stringify(o || {})); }
function pcArrSame(){
  return _PC_ARR && _PC_ARR.r === pcRowsArr() && _PC_ARR.l === pcLtArr() && _PC_ARR.k === pcPkArr();
}
function pcArrMark(){ _PC_ARR = { r:pcRowsArr(), l:pcLtArr(), k:pcPkArr() }; }
/* แถว → ก้อนซ้อน · ทิ้งค่าว่าง/null เพื่อให้หน้าตาเหมือนที่โค้ดเดิมเคยเห็น */
function pcPut(o, k, v){ if(v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !v)) o[k] = v; }
function pcBuildViews(){
  var V = {};
  PC_PIERS.forEach(function(p){ V[p] = {}; });
  var day = function(p, ds){
    if(!V[p]) V[p] = {};
    if(!V[p][ds]) V[p][ds] = { 'in':[], out:[], lt:{}, pk:{} };
    return V[p][ds];
  };
  pcRowsArr().forEach(function(x){
    if(!x || !x.id || !x.pier || !x.date) return;
    var D = day(x.pier, x.date), r = { id:x.id, amt:Math.round(+x.amt || 0) };
    pcPut(r, 'txt', x.txt); pcPut(r, 'at', x.at); pcPut(r, 'by', x.by);
    pcPut(r, 'ts', x.ts);   pcPut(r, 'src', x.src);
    D[x.kind === 'in' ? 'in' : 'out'].push(r);
  });
  pcLtArr().forEach(function(x){
    if(!x || !x.pier || !x.date || !x.bid) return;
    var C = {};
    PC_LT_F.forEach(function(f){ pcPut(C, f, (x[f] == null) ? null : Math.round(+x[f] || 0)); });
    pcPut(C, 'note', x.note); pcPut(C, 'by', x.by); pcPut(C, 'ts', x.ts);
    day(x.pier, x.date).lt[x.bid] = C;
  });
  pcPkArr().forEach(function(x){
    if(!x || !x.pier || !x.date || !x.bid) return;
    var C = {};
    PC_PK.concat(['amt','dock']).forEach(function(f){ pcPut(C, f, (x[f] == null) ? null : Math.round(+x[f] || 0)); });
    pcPut(C, 'by', x.by); pcPut(C, 'ts', x.ts); pcPut(C, 'src', x.src);
    day(x.pier, x.date).pk[x.bid] = C;
  });
  return V;
}
function pcSync(){
  if(pcArrSame() && _PC_MEM && Object.keys(_PC_MEM).length) return;
  var V = pcBuildViews();
  _PC_MEM = V; _PC_V0 = pcClone(V);
  pcArrMark();
}
function pcPier(pier){
  try{ pcSync(); }catch(e){ try{ console.warn('[poCash] sync failed', e && e.message); }catch(_){} }
  return _PC_MEM[pier] || (_PC_MEM[pier] = {});
}
/* อ่านจากสตริงเก่าโดยตรง · ใช้ตอนย้ายข้อมูลกับตอนตรวจยอดเท่านั้น
   ⚠ ห้ามเอาไปใช้แสดงผล · ของจริงอยู่ในตารางแล้ว */
function pcPierLegacy(pier){
  var b, k=pcKey(pier);
  try{ b=laBlob(); }catch(_){ return {}; }
  var raw=(typeof b[k]==='string')?b[k]:'', o={};
  if(raw){ try{ o=JSON.parse(raw)||{}; }catch(_){ o={}; } }
  else { try{ if(b.po_cash && typeof b.po_cash==='object' && b.po_cash[pier]) o=b.po_cash[pier]; }catch(_){} }
  return o;
}
/* รูปเดิม {panwa:{...},tublamu:{...}} · โค้ดที่เหลืออ่านผ่านตัวนี้เหมือนเดิม */
function pcAll(){ var o={}; PC_PIERS.forEach(function(p){ o[p]=pcPier(p); }); return o; }
function pcDay(pier,ds,make){
  var P=pcPier(pier); if(!P[ds]){ if(!make) return null; P[ds]={in:[],out:[],lt:{},pk:{}}; }
  var D=P[ds];
  if(!Array.isArray(D.in)) D.in=[]; if(!Array.isArray(D.out)) D.out=[];
  if(!D.lt||typeof D.lt!=='object') D.lt={}; if(!D.pk||typeof D.pk!=='object') D.pk={};
  return D;
}
/* เขียนกลับเป็นสตริง · ท่าที่ยังไม่มีข้อมูลไม่ต้องเขียน key เปล่าให้รก */
/* แตกก้อนซ้อนเป็น map ของแถว · ใช้ทั้งฝั่ง view ปัจจุบันและฝั่งภาพตอนสร้าง */
function pcFlatten(V){
  var R = {}, L = {}, K = {};
  Object.keys(V || {}).forEach(function(p){
    var P = V[p] || {};
    Object.keys(P).forEach(function(ds){
      var D = P[ds] || {};
      ['in','out'].forEach(function(kind){
        (Array.isArray(D[kind]) ? D[kind] : []).forEach(function(r){
          if(!r || !r.id) return;
          R[r.id] = { id:String(r.id), pier:p, date:ds, kind:kind, txt:String(r.txt || ''),
                      amt:Math.round(+r.amt || 0), at:String(r.at || ''), by:String(r.by || ''),
                      ts:String(r.ts || ''), src:String(r.src || '') };
        });
      });
      Object.keys(D.lt || {}).forEach(function(bid){
        var C = D.lt[bid] || {}, id = pcCellId(p, ds, bid);
        var o = { id:id, pier:p, date:ds, bid:String(bid), note:String(C.note || ''),
                  by:String(C.by || ''), ts:String(C.ts || '') };
        PC_LT_F.forEach(function(f){ o[f] = (C[f] == null || C[f] === '') ? null : Math.round(+C[f] || 0); });
        L[id] = o;
      });
      Object.keys(D.pk || {}).forEach(function(bid){
        var C = D.pk[bid] || {}, id = pcCellId(p, ds, bid);
        var o = { id:id, pier:p, date:ds, bid:String(bid), by:String(C.by || ''),
                  ts:String(C.ts || ''), src:String(C.src || '') };
        PC_PK.concat(['amt','dock']).forEach(function(f){ o[f] = (C[f] == null || C[f] === '') ? null : Math.round(+C[f] || 0); });
        K[id] = o;
      });
    });
  });
  return { rows:R, lt:L, pk:K };
}
/* เขียนส่วนต่างลงอาเรย์ · แตะเฉพาะ id ที่เราเพิ่ม แก้ หรือลบจริง
   id ที่ไม่ได้อยู่ในภาพทั้งสองฝั่ง = ของคนอื่นที่โผล่มาระหว่างทาง · ปล่อยไว้ ห้ามแตะ */
function pcApplyDelta(arr, now, was){
  var byId = {}, i;
  for(i = 0; i < arr.length; i++) if(arr[i] && arr[i].id != null) byId[arr[i].id] = i;
  var n = 0;
  Object.keys(now).forEach(function(id){
    var rec = now[id], at = byId[id];
    if(at === undefined){ arr.push(rec); byId[id] = arr.length - 1; n++; return; }
    if(JSON.stringify(arr[at]) !== JSON.stringify(rec)){ arr[at] = rec; n++; }
  });
  var del = Object.keys(was).filter(function(id){ return !now[id] && byId[id] !== undefined; });
  if(del.length){
    var drop = {}; del.forEach(function(id){ drop[id] = 1; n++; });
    var keep = arr.filter(function(x){ return !(x && drop[x.id]); });
    arr.length = 0; keep.forEach(function(x){ arr.push(x); });
  }
  return n;
}
function pcSave(){
  try{
    pcSync();
    var A = pcFlatten(_PC_MEM), B = pcFlatten(_PC_V0);
    var n = pcApplyDelta(pcRowsArr(), A.rows, B.rows)
          + pcApplyDelta(pcLtArr(),   A.lt,   B.lt)
          + pcApplyDelta(pcPkArr(),   A.pk,   B.pk);
    if(n){
      /* ภาพตอนสร้างต้องตามให้ทัน ไม่งั้นการเซฟรอบหน้าจะคิดว่าของที่เพิ่งเขียนคือของใหม่อีก */
      _PC_V0 = pcClone(_PC_MEM);
      pcArrMark();
      laBlobSave();
    }
  }catch(e){ try{ console.warn('[poCash] save failed', e && e.message); }catch(_){} }
}
function pcArr(k){
  var b; try{ b = laBlob(); }catch(_){ return []; }
  if(!Array.isArray(b[k])) b[k] = [];
  return b[k];
}
function pcRowsArr(){ return pcArr('po_cash_rows'); }
function pcLtArr(){   return pcArr('po_cash_lt'); }
function pcPkArr(){   return pcArr('po_cash_pk'); }
function pcCellId(pier, ds, bid){ return pier + '|' + ds + '|' + bid; }
/* แปลงก้อนของท่าหนึ่งเป็นแถว · คืนจำนวนที่เพิ่มจริง */
function pcRowsFromPier(pier, P){
  var R = pcRowsArr(), L = pcLtArr(), K = pcPkArr();
  var have = {}; R.forEach(function(x){ if(x && x.id) have[x.id] = 1; });
  var haveL = {}; L.forEach(function(x){ if(x && x.id) haveL[x.id] = 1; });
  var haveK = {}; K.forEach(function(x){ if(x && x.id) haveK[x.id] = 1; });
  var n = 0;
  Object.keys(P || {}).forEach(function(ds){
    var D = P[ds]; if(!D || typeof D !== 'object') return;
    ['in','out'].forEach(function(kind){
      (Array.isArray(D[kind]) ? D[kind] : []).forEach(function(r){
        if(!r || !r.id || have[r.id]) return;
        R.push({ id:String(r.id), pier:pier, date:ds, kind:kind, txt:String(r.txt || ''),
                 amt:Math.round(+r.amt || 0), at:String(r.at || ''), by:String(r.by || ''),
                 ts:String(r.ts || ''), src:String(r.src || '') });
        have[r.id] = 1; n++;
      });
    });
    Object.keys(D.lt || {}).forEach(function(bid){
      var id = pcCellId(pier, ds, bid); if(haveL[id]) return;
      var C = D.lt[bid] || {}, o = { id:id, pier:pier, date:ds, bid:String(bid),
        note:String(C.note || ''), by:String(C.by || ''), ts:String(C.ts || '') };
      PC_LT_F.forEach(function(f){ o[f] = (C[f] == null || C[f] === '') ? null : Math.round(+C[f] || 0); });
      L.push(o); haveL[id] = 1; n++;
    });
    Object.keys(D.pk || {}).forEach(function(bid){
      var id = pcCellId(pier, ds, bid); if(haveK[id]) return;
      var C = D.pk[bid] || {}, o = { id:id, pier:pier, date:ds, bid:String(bid),
        by:String(C.by || ''), ts:String(C.ts || ''), src:String(C.src || '') };
      PC_PK.concat(['amt','dock']).forEach(function(f){
        o[f] = (C[f] == null || C[f] === '') ? null : Math.round(+C[f] || 0); });
      K.push(o); haveK[id] = 1; n++;
    });
  });
  return n;
}
function pcRowsMigrate(force){
  if(_pcMigDone && !force) return 0;
  _pcMigDone = true;
  var n = 0;
  try{
    PC_PIERS.forEach(function(p){ n += pcRowsFromPier(p, pcPierLegacy(p)); });
    if(n > 0){ _PC_ARR = null; pcSync(); }          /* มีของเพิ่ม · สร้าง view ใหม่ให้เห็นทันที */
    if(n > 0){ laBlobSave(); try{ console.log('[poCash] ย้ายเข้าตารางแล้ว ' + n + ' แถว'); }catch(_){} }
  }catch(e){ try{ console.warn('[poCash] ย้ายไม่สำเร็จ', e && e.message); }catch(_){} }
  return n;
}
/* ตรวจว่าสตริงกับตารางตรงกันไหม · ก้อน 3 จะใช้ตัวนี้ตัดสินว่าลบ key เก่าได้หรือยัง
   เรียกจากคอนโซลได้: pcRowsAudit() */
function pcRowsAudit(){
  var out = { ok:true, pier:{} };
  PC_PIERS.forEach(function(p){
    var P = pcPierLegacy(p), nS = 0;
    Object.keys(P || {}).forEach(function(ds){
      var D = P[ds] || {};
      nS += (D['in'] || []).length + (D.out || []).length
          + Object.keys(D.lt || {}).length + Object.keys(D.pk || {}).length;
    });
    var nR = pcRowsArr().filter(function(x){ return x.pier === p; }).length
           + pcLtArr().filter(function(x){ return x.pier === p; }).length
           + pcPkArr().filter(function(x){ return x.pier === p; }).length;
    out.pier[p] = { สตริง:nS, ตาราง:nR, ตรงกัน:(nS === nR) };
    if(nS !== nR) out.ok = false;
  });
  return out;
}
function pcNum(v){ return Math.max(0, Math.round(parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,''))||0)); }
function pcMoney(n){ return '฿'+Math.round(+n||0).toLocaleString('en-US'); }
function pcN(n){ return Math.round(+n||0).toLocaleString('en-US'); }
function pcE(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
/* หัวคนของลำนั้นวันนั้น · แยกไทย/ต่างชาติ และ ผญ/เด็ก/INF
   คนที่ไม่ระบุสัญชาติ นับเป็นต่างชาติไว้ก่อน · คิดสูงไว้ดีกว่าคิดต่ำแล้วเงินขาด
   ใบที่ยกเลิกทั้งใบหน้างาน (pckVoidInfo) ไม่นับ · ไม่ได้ขึ้นเกาะจริง */
/* §pcReal (2026-09-04) · ค่าอุทยานจ่ายตาม "หัวที่ขึ้นเรือจริง" ไม่ใช่หัวที่จองมา
   เดิมอ่าน t.pax ตรง ๆ ไม่เคยแตะเช็คอินเลย · ส่วน pxPax ของหน้า P&L ใช้
   pckOnBoard ซึ่งเดินตามเช็คอิน · ระบบจึงมีสองคำตอบสำหรับคำถามเดียวกัน
   และคนหน้าท่าต้องมาไล่ลบเองทุกครั้งที่มีคนไม่มา
   ย้ายมาใช้ pckOnBoard ตัวเดียวกับ P&L · หัวรวมมาจากตัวนั้น แล้วกระจายลง
   ช่องสัญชาติตามสัดส่วนที่จองมา เพราะไม่มีทางรู้ว่าคนที่หายไปสัญชาติไหน   */
/* §pkNat · คืนสองชุด · o = ตามช่องราคาที่ขาย (ของเดิม) · o.n = ตามสัญชาติจริง
   ทั้งสองชุดผ่านการปัดเศษแบบเดียวกัน จะได้เทียบกันได้ตรง ๆ ว่าต่างกันกี่หัว/กี่บาท */
function pcPax(date,bid,pier){
  var Z=function(){ return {ad_th:0,chd_th:0,inf_th:0,foc_th:0,ad_fr:0,chd_fr:0,inf_fr:0,foc_fr:0,tot:0}; };
  var o=Z(), n=Z(), exact=0, anyNat=false;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var rt=(typeof getRoute==='function')?getRoute(t.routeId):null;
    if(!rt || (rt.pier||'')!==pier) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId||'')!==bid) return;
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;
    var px=t.pax||{};
    var booked=(typeof ckBookedPax==='function')?ckBookedPax(t):0;
    var real=(typeof pckOnBoard==='function')?pckOnBoard(b,date,booked):booked;
    if(!real) return;                       /* ทั้งใบไม่ได้ไป · ไม่ต้องซื้อตั๋วให้ */
    var ratio=booked?(real/booked):0;
    exact+=real;
    if(bkNatHas(t)) anyNat=true;
    /* §pcFix · FOC มีแยกสัญชาติเหมือน ad/chd/inf · ช่องเปล่า ๆ ที่ไม่ระบุสัญชาติ (px.ad, px.foc)
       เททิ้งไปฝั่งต่างชาติเหมือนเดิม · คิดสูงไว้ก่อนดีกว่าคิดต่ำแล้วเงินขาด */
    ['ad','chd','inf','foc'].forEach(function(k){
      var all=(+px[k+'_th']||0)+(+px[k+'_fr']||0)+(+px[k]||0);
      o[k+'_th'] += (+px[k+'_th']||0) * ratio;
      o[k+'_fr'] += ((+px[k+'_fr']||0) + (+px[k]||0)) * ratio;
      var th=bkNatTH(t,k);
      n[k+'_th'] += th * ratio;
      n[k+'_fr'] += Math.max(0, all-th) * ratio;
    });
  });
  /* ปัดทีเดียวตอนท้าย · ปัดรายใบแล้วบวกกัน ยอดรวมจะเพี้ยนจากหัวจริง
     เศษที่เหลือยกให้ฝั่งต่างชาติ · ตั๋วฝั่งนั้นแพงกว่า เตรียมเงินเผื่อดีกว่าไปขาดที่ด่าน */
  var fin=function(x){
    var sum=0;
    PC_PK.forEach(function(k){ x[k]=Math.round(x[k]); sum+=x[k]; });
    var diff=Math.round(exact)-sum;
    if(diff!==0){ x.ad_fr=Math.max(0,x.ad_fr+diff); sum=0; PC_PK.forEach(function(k){ sum+=x[k]; }); }
    x.tot=sum; return x;
  };
  fin(o); fin(n);
  o.n=n;
  o.hasNat=anyNat;                                          /* มีใบไหนระบุสัญชาติจริงไว้บ้างไหม */
  o.natDiff=PC_PK.some(function(k){ return o[k]!==n[k]; }); /* สองชุดไม่ตรงกัน = มีเงินให้ประหยัด */
  return o;
}
function pcParkRate(rid){
  if(!rid) return {ok:false, why:'ยังไม่รู้ว่าเรือลำนี้ไปเส้นทางไหน'};
  if(_PC_RATE[rid]) return _PC_RATE[rid];
  var R={ok:false, why:'เส้นทางนี้ยังไม่มีแผนต้นทุน'};
  try{
    var pl=(typeof ctPlanOfFam==='function')?ctPlanOfFam(rid):null, how='';
    if(pl) how='';
    else if(typeof ctSiblingPlan==='function'){
      var sb=ctSiblingPlan(rid);
      if(sb&&sb.plan){ pl=sb.plan; how='ยืมจาก '+((sb.route&&sb.route.name)||'เส้นทางพี่น้อง'); }
    }
    if(pl){
      var T=(typeof ctTpl==='function')?ctTpl():null;
      var ln=T&&(T.lines||[]).filter(function(x){ return x.id==='park'; })[0];
      if(!ln) R={ok:false, why:'สูตรกลางไม่มีบรรทัดค่าเข้าอุทยาน'};
      else{
        var L=ctEffLine(ln,pl);
        if(L.off) R={ok:false, why:'แผน «'+(pl.name||'')+'» ปิดบรรทัดค่าอุทยานไว้', plan:pl.name};
        else{
          var a=0,aTH=0,c=0,cTH=0,miss={};
          (L.parts||[]).forEach(function(p){
            if(!p||p.k!=='var') return;
            var u=+p.u||0;
            var hTH=(p.uTH!=null&&p.uTH!==''), hCh=(p.uCh!=null&&p.uCh!=='');
            var hChTH=(p.uChTH!=null&&p.uChTH!=='');
            var uTH=hTH?(+p.uTH||0):u;
            var uCh=hCh?(+p.uCh||0):u;
            var uChTH=hChTH?(+p.uChTH||0):(hCh?uCh:uTH);
            /* ช่องที่ไม่ได้ตั้ง จะถอยไปใช้ราคาผู้ใหญ่ต่างชาติ = แพงเกินจริง · ต้องฟ้อง */
            if(u>0&&!hTH) miss['ราคาคนไทย']=1;
            if(u>0&&!hCh) miss['ราคาเด็ก']=1;
            a+=u; aTH+=uTH; c+=uCh; cTH+=uChTH;
          });
          /* §pcFix · FOC คิดราคาผู้ใหญ่ตามสัญชาติ · ด่านไม่สนใจว่าเราเก็บเงินลูกค้าหรือไม่
             INF คิด 0 · แผนต้นทุนไม่มีช่องราคาเด็กเล็ก */
          R={ ok:true, ad_th:aTH, chd_th:cTH, inf_th:0, foc_th:aTH,
                       ad_fr:a,   chd_fr:c,   inf_fr:0, foc_fr:a,
              plan:pl.name||'', how:how, miss:Object.keys(miss) };
        }
      }
    }
  }catch(_){ R={ok:false, why:'อ่านแผนต้นทุนไม่ได้'}; }
  _PC_RATE[rid]=R; return R;
}
/* INF คิด 0 · แผนต้นทุนไม่มีช่องราคาเด็กเล็ก · ด่านไหนเก็บจริงจะไปโผล่เป็นส่วนต่าง */
function pcParkAmt(R,cnt){
  if(!R||!R.ok||!cnt) return null;
  var n=0; PC_PK.forEach(function(k){ n += (+cnt[k]||0)*(+R[k]||0); });
  return n;
}
/* §pcSum · สีเส้นทางที่ตั้งไว้ในระบบ · บางสีอ่อนมาก (เช่น #ff9999) เอามาเป็นสีตัวหนังสือตรง ๆ
   บนพื้นขาวจะจางจนอ่านไม่ออก · คูณลงให้เข้มพอสำหรับตัวหนังสือ แต่ยังเป็นสีเดิม */
function pcDarken(hex,f){
  try{
    var h=String(hex||'').replace('#','');
    if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(!/^[0-9a-fA-F]{6}$/.test(h)) return '';
    var n=parseInt(h,16), r=(n>>16)&255, g=(n>>8)&255, b=n&255, k=(f==null?0.68:f);
    var p=function(v){ v=Math.max(0,Math.min(255,Math.round(v*k))); return ('0'+v.toString(16)).slice(-2); };
    return '#'+p(r)+p(g)+p(b);
  }catch(_){ return ''; }
}
function pcRouteColor(rid){
  try{ var r=(typeof getRoute==='function')?getRoute(rid):null; return (r&&r.color)||''; }catch(_){ return ''; }
}
/* ชื่อโปรแกรมพร้อมสีของมัน · จุดสีเต็ม ๆ + ตัวหนังสือสีเดียวกันแต่เข้มพอ */
function pcRouteName(rid,name){
  var c=pcRouteColor(rid), d=pcDarken(c);
  if(!c||!d) return '<span class="pc-rn">'+pcE(name)+'</span>';
  return '<span class="pc-dot" style="background:'+pcE(c)+'"></span>'
    +'<span class="pc-rn" style="color:'+pcE(d)+'">'+pcE(name)+'</span>';
}
/* ป้ายราคาใต้ชื่อโปรแกรม · ให้ตรวจย้อนได้ว่าเลขที่คำนวณมาจากราคาไหน */
function pcRateChip(R){
  if(!R.ok) return '<span class="pc-rc no" title="'+pcE(R.why||'')+'">⚠ ยังไม่มีราคาอุทยาน</span>';
  var w=(R.miss&&R.miss.length)?(' ⚠'):'';
  var tip='จากแผน «'+(R.plan||'')+'»'+(R.how?(' · '+R.how):'')
    +((R.miss&&R.miss.length)?(' · ยังไม่ได้ตั้ง'+R.miss.join(' และ')+' เลยถอยไปใช้ราคาผู้ใหญ่ต่างชาติ'):'');
  return '<span class="pc-rc'+((R.miss&&R.miss.length)?' w':'')+'" title="'+pcE(tip)+'">'
    +'อุทยาน · ตปท '+pcN(R.ad_fr)+'/'+pcN(R.chd_fr)
    +' · ไทย '+pcN(R.ad_th)+'/'+pcN(R.chd_th)+w+'</span>';
}
function pcFillAsk(ds,bid){ if(!pcGuard()) return; _pcFillAsk=ds+'::'+bid; pcKeep(); }
function pcFillAskOff(){ _pcFillAsk=''; pcKeep(); }
function pcFillPK(ds,bid,pier,src){
  if(!pcGuard()) return;
  var X=pcPax(ds,bid,pier||_pcPier);
  var S=(src==='price')?X:X.n;              /* ไม่ระบุ = สัญชาติจริง (ซึ่งถอยไปเท่าช่องราคาเองถ้าไม่มีใครกรอก) */
  var D=pcDay(_pcPier,ds,true); D.pk[bid]=D.pk[bid]||{};
  PC_PK.forEach(function(k){ D.pk[bid][k]=+S[k]||0; });
  D.pk[bid].by=pcWho(); D.pk[bid].ts=new Date().toISOString();
  D.pk[bid].src=(src==='price')?'price':'nat';   /* เติมมาจากชุดไหน · ไล่ย้อนได้ตอนเลขไม่ตรง */
  var any=PC_PK.some(function(k){ return +D.pk[bid][k]>0; })||+D.pk[bid].amt>0||+D.pk[bid].dock>0;
  if(!any) delete D.pk[bid];
  _pcFillAsk='';
  pcSave(); pcKeep();
}
/* แผงเลือกชุดตัวเลข · โชว์หัวคนกับยอดเงินของทั้งสองทางให้เห็นก่อนกด */
function pcFillPanel(ds,bid,pier,X,R){
  var mini=function(c){ return 'ไทย '+pcN(c.ad_th+c.chd_th+c.inf_th+c.foc_th)
    +' · ตปท '+pcN(c.ad_fr+c.chd_fr+c.inf_fr+c.foc_fr); };
  var money=function(c){ var a=pcParkAmt(R,c); return (a==null)?'':(' → '+pcMoney(a)); };
  var save=null;
  try{ var an=pcParkAmt(R,X.n), ap=pcParkAmt(R,X); if(an!=null&&ap!=null&&ap!==an) save=ap-an; }catch(_){}
  return '<div class="pc-ask">'
   +'<span class="q">เติมจากชุดไหน</span>'
   +'<button class="nat" onclick="pcFillPK(\''+ds+'\',\''+bid+'\',\''+pier+'\',\'nat\')">'
     +'🛂 สัญชาติจริง (นทท.)<br><b>'+mini(X.n)+money(X.n)+'</b></button>'
   +'<button onclick="pcFillPK(\''+ds+'\',\''+bid+'\',\''+pier+'\',\'price\')">'
     +'💵 ตามเรทที่ขาย<br><b>'+mini(X)+money(X)+'</b></button>'
   +(save?('<span class="q" style="margin:3px 0 4px">ต่างกัน '+pcMoney(save)+' · ชุดบนถูกกว่า</span>'):'')
   +'<button class="no" onclick="pcFillAskOff()">ยกเลิก</button>'
   +'</div>';
}
/* ช่องส่วนต่าง · จ่ายจริง − ยอดคำนวณ */
function pcDiffCell(paid,exp){
  if(exp==null||!(paid>0)) return '<td class="pc-df">—</td>';
  var d=paid-exp;
  if(d===0) return '<td class="pc-df ok">✓ ตรง</td>';
  if(d>0)   return '<td class="pc-df over" title="จ่ายมากกว่าที่คำนวณ">+'+pcN(d)+'</td>';
  return '<td class="pc-df under" title="จ่ายน้อยกว่าที่คำนวณ">−'+pcN(-d)+'</td>';
}
/* ลำที่ออกวันนั้นของท่านั้น · เอาเฉพาะลำที่มีโปรแกรมจริง ไม่เอาลำที่จอด */
function pcBoats(date,pier){
  var out=[];
  ((typeof poBoats==='function')?poBoats(date,pier):[]).forEach(function(B){
    out.push({bid:B.bid, name:(B.boat&&B.boat.name)||B.bid, rid:B.rid||'',
              route:(B.route&&B.route.name)||B.rid||''});
  });
  return out;
}
/* วันที่ทั้งหมดของเดือนที่มีเรือออก · ชีทสองอันไล่ตามนี้ */
function pcDates(pier,ym){
  var out=[];
  try{
    var T=(typeof TRIPS!=='undefined')?TRIPS:{};
    Object.keys(T).forEach(function(ds){ if(String(ds).slice(0,7)===ym && pcBoats(ds,pier).length) out.push(ds); });
  }catch(_){}
  out.sort(); return out;
}
/* ยอดรวมของวัน · หางยาวกับอุทยานมาจากชีทของมัน ไม่ได้กรอกซ้ำที่หน้าหลัก */
function pcTotals(pier,ds){
  var D=pcDay(pier,ds,false)||{in:[],out:[],lt:{},pk:{}};
  var vin=0,vlt=0,vpk=0,vdk=0,vot=0;
  (D.in||[]).forEach(function(x){ vin+=(+x.amt||0); });
  (D.out||[]).forEach(function(x){ vot+=(+x.amt||0); });
  Object.keys(D.lt||{}).forEach(function(k){ vlt+=(+D.lt[k].amt||0); });
  Object.keys(D.pk||{}).forEach(function(k){ vpk+=(+D.pk[k].amt||0); vdk+=(+D.pk[k].dock||0); });
  /* §pcSum · หางยาว/อุทยาน/ค่าจอด ไม่เข้าสมุดเอง · เป็นแค่ยอดอ้างอิงจากอีกสองชีท
     สมุดเดินบัญชีนับเฉพาะรายการที่คนหน้าท่าบันทึกเอง จะได้ตรงกับเงินในลิ้นชักจริง
     อยากให้เข้าสมุดค่อยกดปุ่ม "ดึงเข้าสมุด" ทีละวัน */
  var ref=vlt+vpk+vdk;
  var pulled=0;
  (D.out||[]).forEach(function(x){ if(x && x.src) pulled+=(+x.amt||0); });
  return { in:vin, lt:vlt, pk:vpk, dock:vdk, ref:ref, pulled:pulled,
           other:vot, out:vot, net:vin-vot };
}
/* §pcSum · ดึงยอดจากสองชีทเข้ามาเป็นรายการจ่ายจริงในสมุด · หมวดไหนดึงแล้วไม่ดึงซ้ำ */
function pcPull(ds){
  if(!pcGuard()) return;
  var T=pcTotals(_pcPier,ds), D=pcDay(_pcPier,ds,true), n=0;
  var want=[{k:'lt',v:T.lt,t:'ค่าเรือหางยาว'},{k:'pk',v:T.pk,t:'ค่าอุทยาน'},{k:'dock',v:T.dock,t:'ค่าจอดเรือ'}];
  want.forEach(function(w){
    if(!(w.v>0)) return;
    if((D.out||[]).some(function(x){ return x && x.src===w.k; })) return;
    D.out.push({ id:'pc'+Date.now()+Math.random().toString(36).slice(2,5), src:w.k,
      txt:w.t+' (ดึงจากชีท)', amt:w.v, at:'', by:pcWho(), ts:new Date().toISOString() });
    n++;
  });
  if(!n){ alert('ไม่มียอดใหม่ให้ดึง · ดึงครบแล้วหรือยังไม่ได้กรอกยอดในอีกสองชีท'); return; }
  pcSave(); pcKeep();
}
/* §pcSum · วันของเดือนที่ต้องมีในตารางรวม · วันที่มีรายการเงิน หรือวันที่มีเรือออก
   เอาสองอย่างมารวมกัน เพราะวันที่เรือออกแต่ยังไม่ลงเงิน ก็ต้องเห็นว่ายังไม่ได้ลง */
function pcMonthDays(pier,ym){
  var set={};
  try{ Object.keys(pcPier(pier)||{}).forEach(function(k){ if(String(k).slice(0,7)===ym) set[k]=1; }); }catch(_){}
  try{ pcDates(pier,ym).forEach(function(k){ set[k]=1; }); }catch(_){}
  return Object.keys(set).sort();
}
/* ยอดยกมา · รวมทุกวันก่อนหน้าของท่านี้ · กระเป๋าเดินต่อไม่รีเซ็ต */
function pcOpening(pier,ds){
  var A=pcAll()[pier]||{}, sum=0;
  Object.keys(A).forEach(function(k){ if(k<ds) sum+=pcTotals(pier,k).net; });
  return sum;
}
function pcTab(i){ _pcTab=i; _pcJump=true; renderPierCash(_pcPier); }
function pcShift(n){ var d=new Date(_pcDate+'T12:00:00'); d.setDate(d.getDate()+n);
  _pcDate=(typeof poYMD==='function')?poYMD(d):d.toISOString().slice(0,10); _pcYM=_pcDate.slice(0,7); pcKeep(); }
function pcMonth(v){ if(v){ _pcYM=v; } _pcJump=true; pcKeep(); }
function pcPickDay(v){ if(v){ _pcDate=v; _pcYM=v.slice(0,7); } pcKeep(); }
function pcKeep(){
  var w=document.querySelector('#pc-host-'+_pcPier+' .pc-gw');
  var x=w?w.scrollLeft:0, y=w?w.scrollTop:0, sy=window.scrollY;
  renderPierCash(_pcPier);
  var w2=document.querySelector('#pc-host-'+_pcPier+' .pc-gw');
  if(w2){ w2.scrollLeft=x; w2.scrollTop=y; }
  try{ window.scrollTo(0,sy); }catch(_){}
}
/* ── เขียนค่า ─────────────────────────────────────────────────────────── */
function pcGuard(){ if(typeof poCanEdit==='function' && !poCanEdit()){ alert('ไม่มีสิทธิ์แก้ข้อมูลหน้าท่า'); return false; } return true; }
function pcWho(){ return (typeof ckMe==='function')?ckMe():'—'; }
/* §pcLtSplit · "ใช้จริง" แยกเป็นสองช่อง · nj = จอยกี่ลำ · nc = เหมากี่ลำ
   ยังเขียน n = nj+nc ไว้เหมือนเดิม เพราะเป็นยอดที่ของเก่าอ่านอยู่ (และไว้เทียบกับข้อมูลเดิม)
   แถวเก่าที่มีแต่ n ยังอ่านได้ · ตัววาดจะโชว์เป็นป้าย "เดิม N" ให้เห็นว่ายังไม่ได้แยก */
function pcLtUsed(C){
  C=C||{};
  var j=(C.nj!=null&&C.nj!=='')?(+C.nj||0):null;
  var c=(C.nc!=null&&C.nc!=='')?(+C.nc||0):null;
  var legacy=(j===null&&c===null)?(+C.n||0):0;
  return {j:j, c:c, legacy:legacy, tot:(j||0)+(c||0)+legacy};
}
function pcSetLT(ds,bid,fld,val){
  if(!pcGuard()) return;
  var D=pcDay(_pcPier,ds,true); D.lt[bid]=D.lt[bid]||{};
  D.lt[bid][fld]=pcNum(val); D.lt[bid].by=pcWho(); D.lt[bid].ts=new Date().toISOString();
  if(fld==='nj'||fld==='nc'){
    var R=D.lt[bid];
    R.n=(+R.nj||0)+(+R.nc||0);          /* ยอดรวมยังอยู่ที่ n ตามเดิม */
    if(!R.n) delete R.n;
  }
  var Q=D.lt[bid];
  if(!Q.n && !Q.nj && !Q.nc && !Q.amt && !(Q.note||'').trim()) delete D.lt[bid];
  pcSave(); pcKeep();
}
function pcSetLTNote(ds,bid,val){
  if(!pcGuard()) return;
  var D=pcDay(_pcPier,ds,true); D.lt[bid]=D.lt[bid]||{};
  D.lt[bid].note=String(val||'').trim(); D.lt[bid].by=pcWho();
  var Q=D.lt[bid];
  if(!Q.n && !Q.nj && !Q.nc && !Q.amt && !Q.note) delete D.lt[bid];
  pcSave(); pcKeep();
}
function pcSetPK(ds,bid,fld,val){
  if(!pcGuard()) return;
  var D=pcDay(_pcPier,ds,true); D.pk[bid]=D.pk[bid]||{};
  D.pk[bid][fld]=pcNum(val); D.pk[bid].by=pcWho(); D.pk[bid].ts=new Date().toISOString();
  /* §pcFix · ค่าจอดนับเป็นข้อมูลด้วย · ไม่งั้นคีย์แต่ค่าจอดแล้วแถวโดนลบทิ้ง */
  var any=PC_PK.some(function(k){ return +D.pk[bid][k]>0; })||+D.pk[bid].amt>0||+D.pk[bid].dock>0;
  if(!any) delete D.pk[bid];
  pcSave(); pcKeep();
}
function pcRowAdd(kind){
  if(!pcGuard()) return;
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  var isIn=(kind==='in');
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" class="ck-ovl"><div class="ck-dlg">'
   +'  <div class="ck-dh"><div><div class="t1">'+(isIn?'⬇️ รับเงินเข้ากระเป๋า':'⬆️ จ่ายเงินออก')+'</div>'
   +'    <div class="t2">'+pcE(_pcPier)+' · '+pcE(_pcDate)+'</div></div>'
   +'    <button class="x" onclick="ckReasonClose()">&times;</button></div>'
   +'  <div class="ck-db">'
   +'    <div class="lb">เรื่อง</div>'
   +'    <input id="pc-r-txt" class="ck-inp" type="text" placeholder="'+(isIn?'เช่น เบิกเงินสดจากบัญชี':'เช่น น้ำแข็ง 4 ถุง')+'">'
   +'    <div style="display:flex;gap:11px;margin-top:12px;flex-wrap:wrap">'
   +'      <div style="flex:none"><div class="lb">เวลา</div>'
   +'        <input id="pc-r-at" class="ck-inp" type="time" value="'+((typeof ckNowHM==='function')?ckNowHM():'')+'" style="width:130px"></div>'
   +'      <div style="flex:1;min-width:150px"><div class="lb">จำนวนเงิน</div>'
   +'        <input id="pc-r-amt" class="ck-inp" type="text" inputmode="numeric" placeholder="0"></div>'
   +'    </div>'
   +'    <div class="ck-fn">ยอดนี้จะเข้าไปในสมุดเดินบัญชีของวันที่เลือกอยู่ และมีผลกับยอดคงเหลือทันที</div>'
   +'  </div>'
   +'  <div class="ck-df"><button class="c" onclick="ckReasonClose()">ยกเลิก</button>'
   +'    <button class="k" onclick="pcRowSave(\''+(isIn?'in':'out')+'\')">บันทึก</button></div>'
   +'</div></div>';
}
function pcRowSave(kind){
  if(!pcGuard()) return;
  var t=document.getElementById('pc-r-txt'), a=document.getElementById('pc-r-amt'), h=document.getElementById('pc-r-at');
  var amt=pcNum(a?a.value:0);
  if(amt<=0){ alert('ใส่จำนวนเงินก่อนครับ'); return; }
  var D=pcDay(_pcPier,_pcDate,true);
  D[kind==='in'?'in':'out'].push({ id:'pc'+Date.now()+Math.random().toString(36).slice(2,5),
    txt:(t?t.value.trim():''), amt:amt, at:(h?h.value:'')||'', by:pcWho(), ts:new Date().toISOString() });
  pcSave(); if(typeof ckReasonClose==='function') ckReasonClose(); pcKeep();
}
function pcRowDel(kind,id){
  if(!pcGuard()) return;
  var D=pcDay(_pcPier,_pcDate,false); if(!D) return;
  var k=(kind==='in')?'in':'out';
  var hit=(D[k]||[]).filter(function(x){ return x.id===id; })[0]; if(!hit) return;
  if(!confirm('ลบรายการนี้?\n'+(hit.txt||'')+' · '+pcMoney(hit.amt))) return;
  D[k]=D[k].filter(function(x){ return x.id!==id; });
  pcSave(); pcKeep();
}
function pcSelSync(){ var k=_pcPier+'|'+_pcDate; if(_pcSelK!==k){ _pcSelK=k; _pcSel={}; } }
function pcSelHas(kind,id){ return _pcSel[kind+':'+id]===1; }
function pcSelRowId(kind,id){ return 'pcr-'+_pcPier+'-'+kind+'-'+id; }
function pcSelRows(){
  var D=pcDay(_pcPier,_pcDate,false)||{in:[],out:[]};
  return { 'in':(D['in']||[]), out:(D.out||[]) };
}
/* n = ที่เลือกทั้งหมด · nOut = เฉพาะฝั่งจ่าย · tot = แถวทั้งวัน (ไว้ตัดสินว่าติ๊กครบยัง) */
function pcSelSum(){
  var R=pcSelRows(), o={n:0,nOut:0,'in':0,out:0,tot:R['in'].length+R.out.length};
  R['in'].forEach(function(x){ if(pcSelHas('in',x.id)){ o.n++; o['in']+=+x.amt||0; } });
  R.out.forEach(function(x){ if(pcSelHas('out',x.id)){ o.n++; o.nOut++; o.out+=+x.amt||0; } });
  return o;
}
/* ช่องติ๊กหน้าแถว · กดที่ช่องทั้งช่องก็ได้ ไม่ต้องจิ้มโดนกล่องเล็ก ๆ (หน้าท่าใช้แท็บเล็ต) */
function pcSelCell(kind,id){
  return '<td class="selc" onclick="pcSelCellHit(this,event)">'
    +'<input type="checkbox" class="pc-cb"'+(pcSelHas(kind,id)?' checked':'')
    +' onclick="event.stopPropagation()"'
    +' onchange="pcSelSet(\''+kind+'\',\''+id+'\',this.checked)"></td>';
}
function pcSelCellHit(td,ev){
  var cb=td.querySelector('input.pc-cb');
  if(cb && ev.target!==cb) cb.click();
}
function pcSelSet(kind,id,on){
  pcSelSync();
  if(on) _pcSel[kind+':'+id]=1; else delete _pcSel[kind+':'+id];
  var tr=document.getElementById(pcSelRowId(kind,id));
  if(tr) tr.classList.toggle('pcp-on', !!on);
  pcSelBarSync();
}
function pcSelAll(on){
  pcSelSync(); _pcSel={};
  if(on){ var R=pcSelRows();
    R['in'].forEach(function(x){ _pcSel['in:'+x.id]=1; });
    R.out.forEach(function(x){ _pcSel['out:'+x.id]=1; }); }
  pcSelPaint();
}
/* เลือกเฉพาะฝั่งจ่าย · เป็นสิ่งที่ถามบ่อยที่สุด และเป็นชุดเดียวกับที่ลงใบรับรองฯ */
function pcSelOnlyOut(){
  pcSelSync(); _pcSel={};
  pcSelRows().out.forEach(function(x){ _pcSel['out:'+x.id]=1; });
  pcSelPaint();
}
function pcSelClear(){ pcSelSync(); _pcSel={}; pcSelPaint(); }
/* วาดใหม่แค่ช่องติ๊กกับแถบสรุป · ไม่เรียก renderPierCash เพราะการเปลี่ยน innerHTML
   ทั้งก้อนตอนที่โฟกัสยังอยู่ในตาราง ทำให้จอเด้งกลับไปหัวตาราง (เจอมาแล้วหลายหน้า) */
function pcSelPaint(){
  var R=pcSelRows();
  ['in','out'].forEach(function(k){
    R[k].forEach(function(x){
      var on=pcSelHas(k,x.id), tr=document.getElementById(pcSelRowId(k,x.id));
      if(!tr) return;
      tr.classList.toggle('pcp-on', on);
      var cb=tr.querySelector('input.pc-cb'); if(cb) cb.checked=on;
    });
  });
  pcSelBarSync();
}
function pcSelBarSync(){
  var bar=document.getElementById('pc-selbar'); if(bar) bar.innerHTML=pcSelBarHtml();
  var S=pcSelSum(), all=document.getElementById('pc-selall');
  if(all){ all.checked=(S.tot>0 && S.n===S.tot); all.indeterminate=(S.n>0 && S.n<S.tot); }
}
function pcSelBarHtml(){
  var S=pcSelSum();
  if(!S.tot) return '';
  if(!S.n) return '<span class="hint">ติ๊กช่องหน้าแถว เพื่อรวมยอดเฉพาะรายการที่เลือก</span>'
    +'<span class="sp"></span>'
    +'<button class="pc-btn" onclick="pcSelOnlyOut()">เลือกรายการจ่ายทั้งหมด</button>';
  var net=S['in']-S.out;
  return '<b>เลือกไว้ '+S.n+' รายการ</b>'
   +'<span class="big">จ่ายรวม '+pcMoney(S.out)+'</span>'
   /* ติ๊กโดนฝั่งรับด้วยค่อยโชว์สองบรรทัดนี้ · ปกติเลือกแต่ฝั่งจ่าย ไม่ต้องมีเลขมารก */
   +((S.n>S.nOut)?('<span class="sm i">รับรวม '+pcMoney(S['in'])+'</span>'
       +'<span class="sm">สุทธิ '+(net<0?'&minus;':'')+pcMoney(Math.abs(net))+'</span>'):'')
   +'<span class="sp"></span>'
   +(S.nOut?('<button class="pc-btn pri" onclick="pcPrintCert({only:1})" '
       +'title="ลงใบรับรองแทนใบเสร็จรับเงิน เฉพาะ '+S.nOut+' รายการจ่ายที่ติ๊กไว้">'
       +'&#128424; ใบรับรองฯ เฉพาะที่เลือก</button>'):'')
   +'<button class="pc-btn" onclick="pcSelClear()">ล้างที่เลือก</button>';
}
/* ── CSS ─────────────────────────────────────────────────────────────── */
function pcCSS(scope){
  return scope+'{font-family:Sarabun,-apple-system,BlinkMacSystemFont,sans-serif;font-variant-numeric:tabular-nums}'
  /* §poCash · Sarabun ทั้งตัวหนังสือและตัวเลข · tabular-nums ให้เลขยังเรียงหลักตรงกัน */
  +scope+' .pc-h1{font-size:19px;font-weight:800;color:#16265C;margin:0 0 2px}'
  +scope+' .pc-sub{font-size:11.5px;color:#7C8091;margin-bottom:12px}'
  +scope+' .pc-tabs{display:flex;gap:3px;align-items:flex-end;border-bottom:2px solid #16265C;padding-left:4px}'
  +scope+' .pc-tabs button{border:1.5px solid #D5DAE5;border-bottom:none;background:#E9ECF2;color:#5A6B8C;'
    +'border-radius:10px 10px 0 0;padding:9px 18px 8px;font:700 12.5px inherit;font-family:inherit;'
    +'cursor:pointer;position:relative;top:2px}'
  +scope+' .pc-tabs button.on{background:#fff;color:#16265C;border-color:#16265C;border-width:2px 2px 0;'
    +'font-weight:800;top:0;padding-bottom:10px;z-index:2}'
  +scope+' .pc-tabs .sp{flex:1}'
  +scope+' .pc-sheet{background:#fff;border:2px solid #16265C;border-top:none;border-radius:0 0 12px 12px;overflow:hidden}'
  +scope+' .pc-tb{display:flex;align-items:center;gap:9px;padding:9px 13px;border-bottom:1.5px solid #E2E7F0;'
    +'background:#FAFBFD;flex-wrap:wrap}'
  +scope+' .pc-tb b{font-size:13px;font-weight:800;color:#16265C}'
  +scope+' .pc-tb .n{font-size:10.5px;font-weight:700;color:#7C8091;background:#fff;border:1px solid #DDE2EC;'
    +'border-radius:999px;padding:2px 9px}'
  +scope+' .pc-tb .sp{flex:1}'
  +scope+' .pc-btn{border:1.5px solid #D5DAE5;background:#fff;border-radius:8px;padding:6px 12px;'
    +'font:700 11.5px inherit;font-family:inherit;color:#44506A;cursor:pointer}'
  +scope+' .pc-btn:hover{border-color:#16265C;color:#16265C}'
  +scope+' .pc-dt{border:1.5px solid #D5DAE5;border-radius:8px;padding:5px 9px;font:700 12px inherit;'
    +'font-family:inherit;color:#16265C}'
  +scope+' .pc-gw{overflow:auto;max-height:calc(100vh - 300px)}'
  +scope+' .pc-t{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}'
  +scope+' .pc-t th,'+scope+' .pc-t td{border-right:1px solid #E4E8F0;border-bottom:1px solid #E4E8F0;'
    +'padding:7px 10px;white-space:nowrap}'
  +scope+' .pc-t tr>*:last-child{border-right:none}'
  /* §pcEqCol · ทุกช่องกว้างเท่ากันหมด · table-layout:fixed + width:auto ทับ width ที่ติดมากับ th
     ตารางเลยหารพื้นที่เท่า ๆ กันทุกคอลัมน์ ไม่มีช่องไหนกว้างกว่าช่องไหน
     ข้อความยาวเกินช่องตัดด้วย ellipsis (ยัง nowrap เหมือนเดิม จะได้ไม่ดันแถวสูงขึ้น) */
  +scope+' .pc-t{table-layout:fixed}'
  +scope+' .pc-t th,'+scope+' .pc-t td{width:auto!important;overflow:hidden;text-overflow:ellipsis}'
  +scope+' .pc-t th{background:#F4F6FA;font-size:9.5px;font-weight:800;letter-spacing:.05em;color:#5A6B8C;'
    +'position:sticky;top:0;z-index:3;text-align:left;border-bottom:1.5px solid #C9D2E0}'
  +scope+' .pc-t th.g{text-align:center;border-bottom:1px solid #E4E8F0}'
  +scope+' .pc-t th.th2{background:#EDF7F2;color:#0F6E56}'
  +scope+' .pc-t th.fr2{background:#EDF3FB;color:#1D5FA8}'
  +scope+' .pc-t th.key{background:#FFF7E6;color:#7A4A00}'
  +scope+' .pc-t td.th2{background:#F7FCFA}'
  +scope+' .pc-t td.fr2{background:#F8FBFE}'
  +scope+' .pc-t .rn{width:32px;text-align:center;background:#F4F6FA;color:#A8AEBB;font-size:10px;font-weight:700}'
  +scope+' .pc-t td.c,'+scope+' .pc-t th.c{text-align:center}'
  +scope+' .pc-t td.r,'+scope+' .pc-t th.r{text-align:right}'
  /* เส้นหนา = รอยต่อระหว่างกลุ่มเท่านั้น · ไม่เอาไปปนกับเส้นตารางปกติ */
  +scope+' .pc-t th.gs,'+scope+' .pc-t td.gs{border-left:2px solid #16265C}'
  +scope+' .pc-t tr.day td{background:#16265C;color:#fff;font-weight:800;font-size:12px;'
    +'border-color:#16265C;padding:6px 10px}'
  +scope+' .pc-t tr.day td .d2{font-weight:500;opacity:.72;margin-left:8px;font-size:11px}'
  +scope+' .pc-t tr.day.now td{background:#0F6E56;border-color:#0F6E56}'
  +scope+' .pc-t tr.day td .tdy{display:inline-block;margin-left:8px;background:#fff;color:#0F6E56;'
    +'border-radius:99px;padding:1px 9px;font-size:10.5px;font-weight:800}'
  +scope+' .pc-t tr.sum td{background:#EEF1F6;font-weight:800;border-top:1.5px solid #C9D2E0}'
  +scope+' .pc-t tr.grand td{background:#16265C;color:#fff;font-weight:800;font-size:13px;border-color:#16265C}'
  +scope+' .pc-t .bn{font-weight:700;color:#16265C}'
  +scope+' .pc-t .rt{font-size:10.5px;color:#8A9099}'
  /* §pcSum · สีเส้นทาง */
  +scope+' .pc-t .pc-rn{font-weight:700;font-size:11.5px}'
  /* §ltUpg · เรือเหมาที่มาจากอัปเกรดหน้างาน · ดอกจัน = ยังไม่ได้เก็บเงิน */
  +scope+' .pc-t .pc-up{font-style:normal;margin-left:3px;font-size:10px;opacity:.85}'
  +scope+' .pc-t .pc-up.due{color:#A32D2D;opacity:1}'
  +scope+' .pc-t .pc-up.due:after{content:"*"}'
  +scope+' .pc-t .pc-dot{display:inline-block;width:8px;height:8px;border-radius:3px;'
    +'margin-right:6px;vertical-align:1px}'
  +scope+' .pc-t .v{font-weight:700;text-align:center}'
  +scope+' .pc-t .v.z{color:#D3D6DE;font-weight:400}'
  /* ช่องกรอก · บอกด้วยสีพื้นอย่างเดียว · เหลือง = เงิน · ฟ้า = จำนวน
     ไม่วาดกรอบซ้อนข้างใน เพราะมันไปทับเส้นตารางแล้วกลายเป็นเส้นคู่ */
  +scope+' .pc-t td.cy{background:#FFF8E8;padding:0;border-right-color:#EEDFBB;border-bottom-color:#EEDFBB}'
  +scope+' .pc-t td.cb{background:#EFF6FD;padding:0;border-right-color:#D5E5F4;border-bottom-color:#D5E5F4}'
  +scope+' .pc-t td.th2{border-right-color:#DEEDE5;border-bottom-color:#DEEDE5}'
  +scope+' .pc-t td.fr2{border-right-color:#DDE8F4;border-bottom-color:#DDE8F4}'
  +scope+' .pc-t td.cy:hover{background:#FFF3D6}'
  +scope+' .pc-t td.cb:hover{background:#E4F0FB}'
  +scope+' .pc-t td.cy input,'+scope+' .pc-t td.cb input{border:none;background:transparent;width:100%;'
    +'font:700 12.5px inherit;font-family:inherit;padding:7px 9px;font-variant-numeric:tabular-nums}'
  +scope+' .pc-t td.cy input{color:#7A4A00;text-align:right}'
  +scope+' .pc-t td.cy.ct input{text-align:center;padding:7px 2px}'
  +scope+' .pc-t td.cb input{color:#16265C;text-align:center}'
  +scope+' .pc-t td.cy input::placeholder,'+scope+' .pc-t td.cb input::placeholder{color:#D9C9A4;font-weight:400}'
  +scope+' .pc-t td.cy input:focus,'+scope+' .pc-t td.cb input:focus{outline:none}'
  +scope+' .pc-t td.cy:focus-within,'+scope+' .pc-t td.cb:focus-within{box-shadow:inset 0 0 0 2px #16265C;background:#fff}'
  /* §pcPrAlign · โหมดกระดาษ · ช่องกรอกกลายเป็นตัวหนังสือ แต่ td.cy/.cb ตั้ง padding:0
     ไว้ให้ input กินเต็มช่อง · พอไม่มี input ตัวเลขเลยไปกองชิดซ้ายติดเส้น
     คืน padding ให้ แล้วจัดตำแหน่งให้ตรงกับที่เห็นบนจอ (จำนวน = กลาง · เงิน = ขวา) */
  +scope+' .pc-t td.pr{padding:7px 10px}'
  +scope+' .pc-t td.cy.pr{text-align:right;color:#7A4A00;font-weight:700}'
  +scope+' .pc-t td.cy.ct.pr{text-align:center;padding:7px 4px}'
  +scope+' .pc-t td.cb.pr{text-align:center;color:#16265C;font-weight:700}'
  +scope+' .pc-t td.ctx.pr{color:#5A6270;font-weight:600;white-space:normal}'
  +scope+' .pc-t td.ctx{padding:0}'
  +scope+' .pc-t td.ctx input{border:none;background:transparent;width:100%;font:600 12px inherit;'
    +'font-family:inherit;padding:7px 10px;color:#5A6270}'
  +scope+' .pc-t td.ctx input:focus{outline:none;background:#F7FBFE}'
  +scope+' .pc-pill{display:inline-block;border-radius:6px;padding:1px 8px;font-size:11px;font-weight:700;border:1px solid}'
  +scope+' .pc-pj{background:#EAF4FB;color:#16265C;border-color:#BFD9EE}'
  +scope+' .pc-pc{background:#F4E8FB;color:#6B289A;border-color:#E3D0F0}'
  +scope+' .pc-kpi{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1.5px solid #E2E7F0}'
  +scope+' .pc-k{padding:12px 14px;border-right:1px solid #E7EAF0}'
  +scope+' .pc-k:last-child{border-right:none;background:#16265C;color:#fff}'
  +scope+' .pc-k .h{font-size:9px;font-weight:800;letter-spacing:.1em;color:#8A9099}'
  +scope+' .pc-k:last-child .h{color:rgba(255,255,255,.7)}'
  +scope+' .pc-k .v{font-size:25px;font-weight:800;letter-spacing:-.02em;margin-top:2px}'
  +scope+' .pc-k .s{font-size:10.5px;color:#7C8091;margin-top:1px}'
  +scope+' .pc-k:last-child .s{color:rgba(255,255,255,.72)}'
  +scope+' .pc-k.in .v{color:#0F6E56}'
  +scope+' .pc-k.out .v{color:#A32D2D}'
  +scope+' .pc-note{padding:10px 14px;font-size:11px;color:#7C8091;line-height:1.65;background:#FCFCFD;'
    +'border-top:1.5px dashed #E2E7F0}'
  +scope+' .pc-note b{color:#16265C}'
  +scope+' .pc-addr{padding:9px 13px;border-top:1.5px dashed #E2E7F0;background:#FCFCFD}'
  +scope+' .pc-add{border:1.5px solid #BFD9EE;background:#EAF4FB;color:#16265C;border-radius:9px;'
    +'padding:7px 14px;font:700 12px inherit;font-family:inherit;cursor:pointer;margin-right:7px}'
  +scope+' .pc-add.o{border-color:#EBD9AE;background:#FFF7E6;color:#7A4A00}'
  +scope+' .pc-del{border:none;background:transparent;color:#C9CFD8;cursor:pointer;font-size:14px;padding:0 4px}'
  +scope+' .pc-del:hover{color:#A32D2D}'
  +scope+' .pc-lnk{color:#1D5FA8;font-weight:700;cursor:pointer;text-decoration:underline}'
  /* §pcSum · ตารางรวมทั้งเดือน */
  +scope+' .pc-m tr.pc-mr{cursor:pointer}'
  +scope+' .pc-m tr.pc-mr:hover td{background:#F3F7FD}'
  +scope+' .pc-m tr.pc-mr.on td{background:#EAF2FD;box-shadow:inset 0 0 0 1px #BFD4F0}'
  +scope+' .pc-m tr.pc-mr.now td.dt{color:#0F6E56;font-weight:800}'
  +scope+' .pc-m td.dt{font-weight:700;color:#16265C;text-align:left}'
  +scope+' .pc-m td .tdy2{display:inline-block;margin-left:7px;background:#0F6E56;color:#fff;'
    +'border-radius:99px;padding:1px 8px;font-size:10px;font-weight:800}'
  +scope+' .pc-m td.bal{font-weight:800;color:#16265C}'
  +scope+' .pc-m td.bal.neg{color:#A32D2D}'
  +scope+' .pc-m td.ref{background:#F7FBF9;color:#0F6E56;font-weight:700}'
  +scope+' .pc-m td.ref.z{color:#C6D2CC;font-weight:400}'
  +scope+' .pc-pull{border:1.5px solid #BFD9EE;background:#EAF4FB;color:#16265C;border-radius:8px;'
    +'padding:3px 11px;font:700 11px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}'
  +scope+' .pc-pull:hover{background:#D9EAF8;border-color:#8FB8E0}'
  +scope+' .pc-done{font-size:11px;font-weight:700;color:#0F6E56}'
  +scope+' .pc-none{color:#C9CFD8}'
  /* §pcCalc · ป้ายราคา · ยอดคำนวณ · ส่วนต่าง */
  +scope+' .pc-rc{display:inline-block;margin-top:3px;font-size:10.5px;font-weight:600;'
    +'background:#EEF4FF;border:1px solid #CFDDF5;color:#2C4F8A;border-radius:6px;padding:1px 7px;cursor:help}'
  +scope+' .pc-rc.w{background:#FFF6E3;border-color:#EBD9AE;color:#7A4A00}'
  +scope+' .pc-rc.no{background:#FDF0F0;border-color:#F0CFCF;color:#A32D2D}'
  +scope+' td.pc-ex{text-align:right;background:#F0F7F2;line-height:1.25;padding:5px 8px}'
  +scope+' td.pc-ex b{display:block;font-size:14px;font-weight:800;color:#0F6E56}'
  +scope+' td.pc-ex i{display:block;font-style:normal;font-size:10px;color:#7E9B8C;font-weight:500}'
  +scope+' td.pc-ex.na b{font-size:11.5px;font-weight:600;color:#B9BCC6}'
  +scope+' tr.sum td.pc-ex,'+scope+' tr.grand td.pc-ex{background:#E4F1E9}'
  +scope+' tr.grand td.pc-ex{background:#0F6E56}'
  +scope+' tr.grand td.pc-ex b{color:#fff}'
  +scope+' td.pc-df{text-align:center;font-weight:700;font-size:12px;color:#C3C8D2}'
  +scope+' td.pc-df.ok{color:#0F6E56;background:#EDF7F2}'
  +scope+' td.pc-df.over{color:#7A4A00;background:#FFF7E6}'
  +scope+' td.pc-df.under{color:#A32D2D;background:#FDF0F0}'
  /* คีย์ไม่ตรงใบจอง · บอกด้วยสีพื้นเข้มขึ้นกับสีเลข ไม่ใช่กรอบ */
  +scope+' .pc-t td.cy.mm{background:#FBE9C2}'
  +scope+' .pc-t td.cy.mm input{color:#7A4A00;font-weight:800}'
  +scope+' .pc-fill{display:inline-block;margin:3px 0 0 5px;border:1px solid #CFDDF5;background:#fff;'
    +'color:#2C4F8A;border-radius:6px;padding:1px 8px;font:600 10.5px inherit;font-family:inherit;cursor:pointer}'
  +scope+' .pc-fill:hover{background:#EEF4FF;border-color:#9CBCE8}'
  /* §pkNat · ป้ายเทียบสองชุด + แผงเลือกตอนเติมจากใบจอง */
  +scope+' .pc-nat{display:inline-block;margin-top:3px;margin-left:5px;font-size:10.5px;font-weight:700;'
    +'background:#EAF6F0;border:1px solid #B7E2D2;color:#0F6E56;border-radius:6px;padding:1px 7px;cursor:help}'
  +scope+' .pc-ask{margin-top:5px;background:#FBFAF7;border:1px solid #E2DED4;border-radius:8px;padding:6px 8px}'
  +scope+' .pc-ask .q{display:block;font-size:10px;font-weight:700;color:#5A6070;margin-bottom:4px}'
  +scope+' .pc-ask button{display:block;width:100%;text-align:left;margin-bottom:3px;border-radius:6px;'
    +'padding:3px 7px;font:600 10.5px inherit;font-family:inherit;cursor:pointer;'
    +'border:1px solid #CFDDF5;background:#fff;color:#2C4F8A}'
  +scope+' .pc-ask button.nat{border-color:#B7E2D2;color:#0F6E56}'
  +scope+' .pc-ask button.nat:hover{background:#EAF6F0}'
  +scope+' .pc-ask button:hover{background:#EEF4FF}'
  +scope+' .pc-ask button.no{border-color:#E2DED4;color:#8A8F9B;margin-bottom:0}'
  +scope+' .pc-ask button.no:hover{background:#F2F0EB}'
  +scope+' .pc-ask b{font-family:"DM Mono",monospace}'
  /* §pcLtSplit · หัวคอลัมน์ "ใช้จริง" สองบรรทัด + ป้ายข้อมูลเดิมที่ยังไม่ได้แยกจอย/เหมา */
  +scope+' .pc-t th .sub{display:block;font-size:8.5px;font-weight:600;opacity:.78;margin-top:1px}'
  +scope+' .pc-oldn{display:inline-block;margin-left:7px;background:#FBF0DD;color:#7A4A00;'
    +'border:1px solid #EAD9B0;border-radius:999px;padding:1px 7px;font:700 9px inherit;'
    +'font-family:inherit;white-space:nowrap;vertical-align:middle}'
  /* §pcPick · ช่องติ๊กหน้าแถว + แถบสรุปยอดที่เลือก */
  +scope+' .pc-t th.selc{width:34px;text-align:center;padding:6px 0}'
  +scope+' .pc-t td.selc{width:34px;text-align:center;padding:0;background:#FBFCFE;cursor:pointer}'
  +scope+' .pc-t td.selc:hover{background:#EAF2FD}'
  /* ช่องว่างของแถวยกมา/แถวรวม · ไม่มีอะไรให้ติ๊ก อย่าทำเป็นเหมือนกดได้ */
  +scope+' .pc-t td.selc.no,'+scope+' .pc-t td.selc.no:hover{background:#FAFBFD;cursor:default}'
  +scope+' .pc-t input.pc-cb{width:14px;height:14px;margin:0;vertical-align:middle;'
    +'accent-color:#16265C;cursor:pointer}'
  /* แถวที่เลือก · พื้นฟ้าอ่อนทั้งแถว ไม่ใช้กรอบ กรอบไปทับเส้นตารางแล้วเป็นเส้นคู่ */
  +scope+' .pc-t tr.pcp-on td{background:#EAF2FD}'
  +scope+' .pc-t tr.pcp-on td.selc,'+scope+' .pc-t tr.pcp-on td.rn{background:#D9E8FB}'
  +scope+' .pc-t tr.pcp-on td.rn{color:#5A7BAE}'
  +scope+' .pc-selbar{display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding:9px 13px;'
    +'background:#F5F9FF;border-top:1.5px solid #DDE7F5}'
  +scope+' .pc-selbar:empty{display:none}'
  +scope+' .pc-selbar b{font-size:12.5px;font-weight:800;color:#16265C}'
  +scope+' .pc-selbar .big{font-size:16px;font-weight:800;color:#A32D2D;letter-spacing:-.01em}'
  +scope+' .pc-selbar .sm{font-size:11.5px;font-weight:700;color:#7C8091}'
  +scope+' .pc-selbar .sm.i{color:#0F6E56}'
  +scope+' .pc-selbar .hint{font-size:11px;color:#9AA0AE}'
  +scope+' .pc-selbar .sp{flex:1}';
}
/* ── ชีท 1 · หน้าหลัก ────────────────────────────────────────────────── */
function pcSheetMain(pier){
  var ds=_pcDate, D=pcDay(pier,ds,false)||{in:[],out:[],lt:{},pk:{}};
  var T=pcTotals(pier,ds), op=pcOpening(pier,ds), bal=op+T.net;
  /* เรียงตามเวลาที่กรอก · ไม่ใส่เวลาไปท้าย · หางยาวกับอุทยานปิดท้ายวัน
     คีย์ต้องเป็นตัวเลข · localeCompare เอาสัญลักษณ์ไปไว้หน้าตัวเลขทำให้ยอดคงเหลือติดลบหลอก */
  function pcRk(at){ var m=/^(\d{1,2}):(\d{2})$/.exec(String(at||'')); 
    return m? (+m[1]*60 + +m[2]) : 90000; }
  var rows=[];
  (D.in||[]).forEach(function(x){ rows.push({t:pcRk(x.at),k:'in',x:x}); });
  (D.out||[]).forEach(function(x){ rows.push({t:pcRk(x.at),k:'out',x:x}); });
  rows.sort(function(a,b){ return a.t-b.t; });
  pcSelSync();   /* §pcPick · เปลี่ยนวัน/เปลี่ยนท่าแล้วล้างที่เลือกของวันเก่าทิ้ง */
  var run=op, body='', i=0;
  body+='<tr><td class="selc no"></td><td class="rn">—</td><td class="c">—</td>'
    +'<td><i>ยอดยกมาจากวันก่อนหน้า</i></td>'
    +'<td class="rt">ยกมา</td><td class="rt">ระบบ</td><td></td><td></td>'
    +'<td class="r v">'+pcN(op)+'</td><td></td></tr>';
  rows.forEach(function(r){
    i++;
    var isIn=(r.k==='in'), amt, txt, cat, by, del='';
    /* ทุกแถวมาจากที่คนกรอกเองแล้ว · ไม่มีแถวที่ระบบยัดเข้ามา */
    { amt=+r.x.amt||0; txt=pcE(r.x.txt||'—');
           cat=isIn?'รับเงิน':(r.x.src?({lt:'หางยาว',pk:'อุทยาน',dock:'ค่าจอด'}[r.x.src]||'จ่ายอื่น'):'จ่ายอื่น');
           by=pcE(r.x.by||'—');
           del='<button class="pc-del" title="ลบรายการนี้" onclick="pcRowDel(\''+r.k+'\',\''+r.x.id+'\')">&times;</button>'; }
    run += isIn ? amt : -amt;
    /* §pcPick · id ของแถวไว้ให้ตัวติ๊กหาเจอ จะได้ทาสีทีละแถวโดยไม่ต้องวาดตารางใหม่ */
    body+='<tr id="'+pcSelRowId(r.k,r.x.id)+'"'+(pcSelHas(r.k,r.x.id)?' class="pcp-on"':'')+'>'
      +pcSelCell(r.k,r.x.id)
      +'<td class="rn">'+i+'</td><td class="c">'+pcE((r.x&&r.x.at)||'—')+'</td><td>'+txt+'</td>'
      +'<td class="rt">'+cat+'</td><td class="rt">'+by+'</td>'
      +'<td class="r v"'+(isIn?' style="color:#0F6E56"':'')+'>'+(isIn?pcN(amt):'')+'</td>'
      +'<td class="r v"'+(!isIn?' style="color:#A32D2D"':'')+'>'+(!isIn?pcN(amt):'')+'</td>'
      +'<td class="r v">'+pcN(run)+'</td><td class="c">'+del+'</td></tr>';
  });
  if(!rows.length) body+='<tr><td class="selc no"></td><td class="rn"></td>'
    +'<td colspan="8" style="color:#B9BCC6;padding:18px 12px">'
    +'ยังไม่มีรายการของวันนี้</td></tr>';
  return '<div class="pc-sheet">'
   +'<div class="pc-kpi">'
     +'<div class="pc-k"><div class="h">ยอดยกมา</div><div class="v">'+pcMoney(op)+'</div>'
       +'<div class="s">รวมทุกวันก่อนหน้าของท่านี้</div></div>'
     +'<div class="pc-k in"><div class="h">รับวันนี้</div><div class="v">'+pcMoney(T.in)+'</div>'
       +'<div class="s">'+(D.in||[]).length+' รายการ</div></div>'
     +'<div class="pc-k out"><div class="h">จ่ายวันนี้</div><div class="v">'+pcMoney(T.out)+'</div>'
       +'<div class="s">'+((T.ref-T.pulled)>0
           ? ('ยังไม่ได้ดึงอีก '+pcN(T.ref-T.pulled))
           : ((D.out||[]).length+' รายการ'))+'</div></div>'
     +'<div class="pc-k"><div class="h">คงเหลือในมือ</div><div class="v">'+pcMoney(bal)+'</div>'
       +'<div class="s">'+(bal<0?'⚠ ติดลบ · ตรวจรายการ':'ยกไปวันถัดไป')+'</div></div>'
   +'</div>'
   +pcMonthTable(pier)
   +'<div class="pc-tb"><b>สมุดเดินบัญชี</b>'
     +'<input class="pc-dt" type="date" value="'+ds+'" onchange="pcPickDay(this.value)">'
     +'<button class="pc-btn" onclick="pcShift(-1)">‹ วันก่อน</button>'
     +'<button class="pc-btn" onclick="pcShift(1)">วันถัดไป ›</button>'
     +'<span class="sp"></span><span class="n">'+rows.length+' รายการ</span>'
     /* §pcPrint · ใบรับรองฯ เอาไปเบิก Petty Cash · สมุดเดินบัญชีเอาไว้นับเงินในลิ้นชัก */
     +'<button class="pc-btn pri" onclick="pcPrintCert()" title="ดึงเฉพาะรายจ่ายของวันที่เลือก ลงในแบบฟอร์มใบรับรองแทนใบเสร็จรับเงิน">&#128424; ใบรับรองแทนใบเสร็จ</button>'
     +'<button class="pc-btn" onclick="pcPrintLedger()" title="พิมพ์สมุดเดินบัญชีของวันที่เลือก · ยอดยกมา รับ จ่าย คงเหลือ">&#128424; สมุดวันนี้</button>'
     +'<button class="pc-btn" onclick="pcCoEdit()" title="ชื่อบริษัทที่พิมพ์ลงหัวใบรับรองแทนใบเสร็จรับเงิน">แก้ชื่อบริษัท</button></div>'
   +'<div class="pc-gw"><table class="pc-t"><thead><tr>'
     /* §pcPick · ติ๊กหัวตาราง = เลือก/ล้างทั้งวัน */
     +'<th class="selc"><input type="checkbox" id="pc-selall" class="pc-cb" '
       +'title="เลือกทุกรายการของวันนี้" onchange="pcSelAll(this.checked)"></th>'
     +'<th class="rn">#</th><th class="c" style="width:64px">เวลา</th><th>รายการ</th>'
     +'<th style="width:96px">หมวด</th><th style="width:96px">ผู้บันทึก</th>'
     +'<th class="r" style="width:104px">รับ</th><th class="r" style="width:104px">จ่าย</th>'
     +'<th class="r" style="width:116px">คงเหลือ</th><th style="width:34px"></th></tr></thead>'
     +'<tbody>'+body+'</tbody>'
     +'<tfoot><tr class="grand"><td class="selc no"></td><td class="rn"></td>'
       +'<td colspan="4">รวมวันนี้</td>'
       +'<td class="r">'+pcN(T.in)+'</td><td class="r">'+pcN(T.out)+'</td>'
       +'<td class="r">'+pcN(bal)+'</td><td></td></tr></tfoot></table></div>'
   /* §pcPick · แถบสรุปยอดที่เลือก · ว่างเปล่าเมื่อยังไม่ได้ติ๊ก (:empty ซ่อนให้เอง) */
   +'<div class="pc-selbar" id="pc-selbar">'+pcSelBarHtml()+'</div>'
   +'<div class="pc-addr"><button class="pc-add" onclick="pcRowAdd(\'in\')">＋ เพิ่มรายการรับ</button>'
     +'<button class="pc-add o" onclick="pcRowAdd(\'out\')">＋ เพิ่มรายการจ่าย</button></div>'
   +'<div class="pc-note"><b>สมุดนี้นับเฉพาะรายการที่คนหน้าท่าบันทึกเอง</b> '
     +'จะได้ตรงกับเงินในลิ้นชักจริง · ค่าหางยาว ค่าอุทยาน ค่าจอด อยู่ในอีกสองชีท '
     +'จะเข้าสมุดก็ต่อเมื่อกด <b>⤓ ดึง</b> ในตารางรวมข้างบน<br>'
     +'<b>คงเหลือ</b> = ยอดยกมา + รับ − จ่าย · เงินไม่รีเซ็ตรายวัน '
     +'คงเหลือของเมื่อวานคือยอดยกมาของวันนี้<br>'
     /* §pcPick */
     +'<b>ติ๊กช่องหน้าแถว</b> เพื่อรวมยอดเฉพาะรายการที่เลือก · แถบสรุปใต้ตารางบอก'
     +'จ่ายรวมของชุดนั้น และพิมพ์ใบรับรองแทนใบเสร็จรับเงินเฉพาะที่เลือกได้ '
     +'· ที่ติ๊กไว้ไม่ถูกบันทึก เปลี่ยนวันแล้วล้างเอง</div>'
   +'</div>';
}
/* §pcSum · ตารางรวมทั้งเดือน · ทั้งเดือนอยู่ในจอเดียว ไม่ต้องกดไล่ทีละวัน
   ยอดยกมาของวันแรกในเดือน = ยอดสะสมจากทุกเดือนก่อนหน้า จึงต่อกันได้จริง
   สามช่องขวาเป็น "ยอดอ้างอิง" จากอีกสองชีท ยังไม่ใช่เงินที่เดินในสมุดจนกว่าจะกดดึง */
function pcMonthTable(pier){
  var days=pcMonthDays(pier,_pcYM), body='', run=null, gi=0, go=0, gref=0;
  var today=pcNowDS();
  days.forEach(function(d){
    var T=pcTotals(pier,d);
    if(run===null) run=pcOpening(pier,d);
    var op=run, bal=op+T.net; run=bal;
    gi+=T.in; go+=T.out; gref+=T.ref;
    var waiting=Math.max(0, T.ref-T.pulled);
    var sel=(d===_pcDate)?' on':'', now=(d===today)?' now':'';
    body+='<tr class="pc-mr'+sel+now+'" onclick="pcPickDay(\''+d+'\')">'
      +'<td class="c dt">'+pcE(pcDS(d))+(d===today?'<span class="tdy2">วันนี้</span>':'')+'</td>'
      +'<td class="r v">'+pcN(op)+'</td>'
      +'<td class="r v'+(T['in']?'':' z')+'"'+(T['in']?' style="color:#0F6E56"':'')+'>'+(T['in']?pcN(T['in']):'—')+'</td>'
      +'<td class="r v'+(T.out?'':' z')+'"'+(T.out?' style="color:#A32D2D"':'')+'>'+(T.out?pcN(T.out):'—')+'</td>'
      +'<td class="r v bal'+(bal<0?' neg':'')+'">'+pcN(bal)+'</td>'
      +'<td class="r v ref'+(T.lt?'':' z')+'">'+(T.lt?pcN(T.lt):'—')+'</td>'
      +'<td class="r v ref'+(T.pk?'':' z')+'">'+(T.pk?pcN(T.pk):'—')+'</td>'
      +'<td class="r v ref'+(T.dock?'':' z')+'">'+(T.dock?pcN(T.dock):'—')+'</td>'
      +'<td class="c">'+(waiting>0
          ? '<button class="pc-pull" onclick="event.stopPropagation();pcPickDay(\''+d+'\');pcPull(\''+d+'\')">'
            +'⤓ ดึง '+pcN(waiting)+'</button>'
          : (T.ref>0?'<span class="pc-done">✓ ดึงแล้ว</span>':'<span class="pc-none">—</span>'))
      +'</td></tr>';
  });
  if(!body) body='<tr><td colspan="9" style="color:#B9BCC6;padding:18px 12px">เดือนนี้ยังไม่มีรายการและไม่มีเรือออก</td></tr>';
  var end=(run===null)?pcOpening(pier,_pcDate):run;
  return '<div class="pc-tb"><b>รวมทั้งเดือน</b>'
     +'<input class="pc-dt" type="month" value="'+_pcYM+'" onchange="pcMonth(this.value)">'
     +'<span class="n">'+days.length+' วัน</span>'
     +'<span class="sp"></span><span class="n">คงเหลือปลายงวด '+pcMoney(end)+'</span></div>'
   +'<div class="pc-gw" style="max-height:340px"><table class="pc-t pc-m"><thead><tr>'
     +'<th class="c" style="width:118px">วันที่</th>'
     +'<th class="r" style="width:104px">ยกมา</th>'
     +'<th class="r" style="width:100px">รับ</th>'
     +'<th class="r" style="width:100px">จ่าย</th>'
     +'<th class="r gs" style="width:118px">คงเหลือ</th>'
     +'<th class="r gs" colspan="3" style="background:#F0F7F2;color:#0F6E56;text-align:center">'
       +'ยอดอ้างอิงจากอีกสองชีท · ยังไม่เข้าสมุด</th>'
     +'<th class="c gs" style="width:120px">ดึงเข้าสมุด</th></tr>'
     +'<tr><th colspan="5" style="border-right-color:#16265C"></th>'
     +'<th class="r gs" style="width:96px;background:#F7FBF9">หางยาว</th>'
     +'<th class="r" style="width:96px;background:#F7FBF9">อุทยาน</th>'
     +'<th class="r" style="width:96px;background:#F7FBF9">ค่าจอด</th>'
     +'<th class="gs"></th></tr></thead>'
     +'<tbody>'+body+'</tbody>'
     +'<tfoot><tr class="grand"><td class="c">รวมทั้งเดือน</td><td></td>'
       +'<td class="r">'+pcN(gi)+'</td><td class="r">'+pcN(go)+'</td>'
       +'<td class="r gs">'+pcN(end)+'</td>'
       +'<td class="r gs" colspan="3">อ้างอิงรวม '+pcMoney(gref)+'</td><td class="gs"></td></tr></tfoot>'
     +'</table></div>'
   +'<div class="pc-note" style="border-top:none;padding-bottom:4px">'
     +'<b>กดที่แถวเพื่อเลือกวัน</b> แล้วสมุดเดินบัญชีข้างล่างจะเปลี่ยนตาม · '
     +'<b>ยอดอ้างอิง</b> คือยอดที่กรอกไว้ในชีทเรือหางยาวกับชีทค่าอุทยาน '
     +'ยังไม่นับเป็นเงินออกจนกว่าจะกด <b>⤓ ดึง</b> เข้าสมุด</div>';
}
/* ── ชีท 2 · เรือหางยาว ──────────────────────────────────────────────── */
function pcSheetLT(pier, opt){
  opt=opt||{}; var PR=!!opt.print;
  var dates=opt.only?[opt.only]:pcDates(pier,_pcYM), body='', rn=0, gj=0,gc=0,guj=0,guc=0,gm=0, nb=0;
  /* โหมดกระดาษ · ช่องกรอกกลายเป็นค่าที่กรอกไว้ ไม่มีขีดเส้นใต้ ไม่มีกล่อง */
  var box=function(cls,val,inner){ return PR
    ? ('<td class="'+cls+' pr">'+pcE(val===''||val==null?'—':val)+'</td>')
    : ('<td class="'+cls+'">'+inner+'</td>'); };
  dates.forEach(function(ds){
    var BS=pcBoats(ds,pier); if(!BS.length) return;
    var D=pcDay(pier,ds,false)||{lt:{}};
    var dj=0,dc=0,duj=0,duc=0,dm=0, rows='';
    BS.forEach(function(B){
      rn++; nb++;
      var L=(typeof pxLongtail==='function')?pxLongtail(ds,B.bid):{chtr:0,join:0};
      var C=(D.lt||{})[B.bid]||{};
      var U=pcLtUsed(C);
      dj+=(+L.join||0); dc+=(+L.chtr||0);
      duj+=(U.j||0); duc+=(U.c||0); dm+=(+C.amt||0);
      rows+='<tr><td class="rn">'+rn+'</td><td class="bn">'+pcE(B.name)+'</td>'
        +'<td class="rt">'+pcRouteName(B.rid,B.route)
          +(U.legacy?('<span class="pc-oldn" title="ข้อมูลเดิมที่ยังไม่ได้แยกจอย/เหมา · กรอกทับได้เลย แล้วป้ายนี้จะหายไป">ใช้จริงเดิม '+U.legacy+' ลำ</span>'):'')
          +'</td>'
        +'<td class="c">'+(L.join?('<span class="pc-pill pc-pj">'+L.join+'</span>'):'<span class="v z">0</span>')+'</td>'
        +'<td class="c">'+(L.chtr
            ? ('<span class="pc-pill pc-pc" title="'+(L.upg>0?('มาจากอัปเกรดหน้างาน '+L.upg+' ใบ'+(L.upgDue>0?(' · ยังไม่เก็บเงิน '+L.upgDue+' ใบ'):'')):'ตามใบจอง')+'">'
               +L.chtr+(L.upg>0?('<i class="pc-up'+(L.upgDue>0?' due':'')+'">⬆</i>'):'')+'</span>')
            : '<span class="v z">0</span>')+'</td>'
        /* §pcLtSplit · ใช้จริงแยกสองช่อง · หน้างานจอยอาจยุบลำ เหมาอาจใช้น้อยกว่าที่จอง
           รวมกันเป็นเลขเดียวแล้วดูย้อนหลังไม่ออกว่าที่ต่างจากใบจองคือฝั่งไหน */
        +box('cb', (U.j!=null?U.j:''),
          '<input value="'+(U.j!=null?U.j:'')+'" placeholder="—" inputmode="numeric" '
          +'title="จำนวนลำที่ใช้จริงของฝั่งจอย" '
          +'onchange="pcSetLT(\''+ds+'\',\''+B.bid+'\',\'nj\',this.value)">')
        +box('cb', (U.c!=null?U.c:''),
          '<input value="'+(U.c!=null?U.c:'')+'" placeholder="—" inputmode="numeric" '
          +'title="จำนวนลำที่ใช้จริงของฝั่งเหมา" '
          +'onchange="pcSetLT(\''+ds+'\',\''+B.bid+'\',\'nc\',this.value)">')
        +box('cy', (C.amt?pcN(C.amt):''),
          '<input value="'+(C.amt?pcN(C.amt):'')+'" placeholder="—" inputmode="numeric" '
          +'onchange="pcSetLT(\''+ds+'\',\''+B.bid+'\',\'amt\',this.value)">')
        +box('ctx', (C.note||''),
          '<input value="'+pcE(C.note||'')+'" placeholder="—" '
          +'onchange="pcSetLTNote(\''+ds+'\',\''+B.bid+'\',this.value)">')+'</tr>';
    });
    gj+=dj; gc+=dc; guj+=duj; guc+=duc; gm+=dm;
    body+='<tr class="day'+(ds===pcNowDS()?' now':'')+'" id="pcd-'+pier+'-'+ds+'"><td colspan="9">'
      +pcE(pcDL(ds))+(ds===pcNowDS()?'<span class="tdy">วันนี้</span>':'')
      +'<span class="d2">'+BS.length+' ลำ · จอย '+dj+' · เหมา '+dc+'</span></td></tr>'+rows
      +'<tr class="sum"><td class="rn"></td><td colspan="2">รวม '+pcE(pcDS(ds))+'</td>'
      +'<td class="v">'+dj+'</td><td class="v">'+dc+'</td>'
      +'<td class="v">'+(duj||'—')+'</td><td class="v">'+(duc||'—')+'</td>'
      +'<td class="r">'+(dm?pcN(dm):'—')+'</td><td></td></tr>';
  });
  if(!body) body='<tr><td colspan="9" style="color:#B9BCC6;padding:20px 12px">'
    +(opt.only?'ไม่มีเรือออกในวันนี้':'ไม่มีเรือออกในเดือนนี้')+'</td></tr>';
  return '<div class="pc-sheet">'
   +(PR?'':('<div class="pc-tb"><b>🛶 สรุปเรือหางยาวรายวัน</b>'
     +'<input class="pc-dt" type="month" value="'+_pcYM+'" onchange="pcMonth(this.value)">'
     +'<span class="n">'+dates.length+' วัน · '+nb+' ลำ</span>'
     +'<span class="sp"></span><span class="n">รวม '+pcMoney(gm)+'</span>'
     +pcDayPick()
     +'<button class="pc-btn pri" onclick="pcPrintLT()">&#128424; พิมพ์ '+pcE(pcDS(_pcDate))+'</button></div>'))
   +'<div class="pc-gw"><table class="pc-t"><thead><tr>'
     +'<th class="rn">#</th><th style="width:150px">เรือ</th><th>โปรแกรม</th>'
     +'<th class="c" style="width:74px">จอย</th><th class="c" style="width:74px">เหมา</th>'
     +'<th class="c key" style="width:88px">ใช้จริง<span class="sub">จอย (ลำ)</span></th>'
     +'<th class="c key" style="width:88px">ใช้จริง<span class="sub">เหมา (ลำ)</span></th>'
     +'<th class="r key" style="width:118px">จ่ายจริง</th>'
     +'<th style="width:170px">หมายเหตุ</th></tr></thead>'
     +'<tbody>'+body+'</tbody>'
     +'<tfoot><tr class="grand"><td class="rn"></td><td colspan="2">'+(opt.only?'รวมทั้งวัน':'รวมทั้งเดือน')+'</td>'
       +'<td class="v">'+gj+'</td><td class="v">'+gc+'</td>'
       +'<td class="v">'+guj+'</td><td class="v">'+guc+'</td>'
       +'<td class="r">'+pcMoney(gm)+'</td><td></td></tr></tfoot></table></div>'
   +(PR?'':('<div class="pc-note"><b>ช่องขาว = ระบบอ่านให้</b> จอยเป็นหัวที่ขึ้นเรือจริง (หักคนไม่มาแล้ว) · เหมาเป็นลำตามที่สั่งไว้ · '
     +'<b>ช่องฟ้ากับช่องเหลือง = คนหน้าท่ากรอกเอง</b> เพราะหน้างานมักไม่ตรงกับที่จองมา — '
     +'จอย 3 คนอาจลงลำเดียว หรือเหมา 2 ลำแต่ใช้จริงลำเดียว · '
     +'<b>ใช้จริงแยกจอย/เหมา</b> เพื่อดูย้อนหลังได้ว่าที่ต่างจากใบจองคือฝั่งไหน · '
     +'ยอดจ่ายจริงของแต่ละวันจะไปโผล่เป็นบรรทัดเดียวในชีทหน้าหลัก</div>'))
   +'</div>';
}
/* ── ชีท 3 · ค่าอุทยาน ───────────────────────────────────────────────── */
function pcSheetPK(pier, opt){
  opt=opt||{}; var PR=!!opt.print;
  var dates=opt.only?[opt.only]:pcDates(pier,_pcYM), body='', rn=0, nb=0;
  var box=function(cls,val,inner){ return PR
    ? ('<td class="'+cls+' pr">'+pcE(val===''||val==null?'—':val)+'</td>')
    : ('<td class="'+cls+'">'+inner+'</td>'); };
  var Z=function(){ return PC_PK.map(function(){ return 0; }); };
  var GT=Z(), GK=Z(), gtot=0, gktot=0, gm=0, gex=0, gdk=0;
  dates.forEach(function(ds){
    var BS=pcBoats(ds,pier); if(!BS.length) return;
    var D=pcDay(pier,ds,false)||{pk:{}};
    var DT=Z(), DK=Z(), dtot=0, dktot=0, dm=0, dex=0, ddk=0, anyk=false, anyx=false, rows='';
    BS.forEach(function(B){
      rn++; nb++;
      var X=pcPax(ds,B.bid,pier), C=(D.pk||{})[B.bid]||{};
      /* §pkNat · ช่องนับ = สัญชาติจริงของ นทท. · ใบที่ไม่มีใครระบุ X.n จะเท่ากับ X เอง
         ของเก่าทุกใบจึงได้เลขเดิมเป๊ะ · ชุดตามเรทที่ขาย (X) เก็บไว้เทียบให้เห็นว่าต่างกันกี่บาท */
      var XN=X.n;
      var kt=0, hasK=false;
      PC_PK.forEach(function(k,i){ DT[i]+=XN[k]; if(+C[k]>0){ hasK=true; } kt+=(+C[k]||0); DK[i]+=(+C[k]||0); });
      if(hasK||+C.amt>0) anyk=true;
      dtot+=XN.tot; dktot+=kt; dm+=(+C.amt||0); ddk+=(+C.dock||0);
      /* §pcCalc · คีย์แล้วคิดตามที่คีย์ · ยังไม่คีย์คิดตามใบจองไปก่อน จะได้เห็นตัวเลขตั้งแต่ก่อนออกเรือ */
      var R=pcParkRate(B.rid);
      var basis=hasK?C:XN;
      var exp=pcParkAmt(R,basis);
      if(exp!=null){ dex+=exp; anyx=true; }
      var HF=PC_PK.length/2;   /* ครึ่งแรก = คนไทย ครึ่งหลัง = ต่างชาติ */
      var cells=PC_PK.map(function(k,i){
        var cls=(i<HF)?'th2':'fr2';
        return '<td class="v '+cls+(i===HF?' gs':'')+(XN[k]?'':' z')+'">'+XN[k]+'</td>'; }).join('');
      var keys=PC_PK.map(function(k,i){
        /* ขอบเข้ม = จำนวนที่คีย์ไม่ตรงกับยอดเดินทางจริง · ไม่ใช่ error แต่ต้องเห็น */
        var mm=(hasK && (+C[k]||0)!==(+XN[k]||0))?' mm':'';
        return box('cy ct'+((i===0||i===HF)?' gs':'')+mm, (C[k]||''),
          '<input value="'+(C[k]||'')+'" placeholder="—" '
          +'inputmode="numeric" onchange="pcSetPK(\''+ds+'\',\''+B.bid+'\',\''+k+'\',this.value)">'); }).join('');
      var exc=(exp==null)
        ? '<td class="pc-ex gs na"><b>—</b><i>'+pcE((R.why||'ไม่มีราคา'))+'</i></td>'
        : '<td class="pc-ex gs"><b>'+pcN(exp)+'</b><i>'+(hasK?('ตามที่คีย์'+(C.src==='price'?' · เรทขาย':(C.src==='nat'?' · สัญชาติจริง':'')))
            :'ตามหัวจริง')+'</i></td>';
      /* §pkNat · สองชุดไม่ตรงกัน = มีใบที่ขายเรทหนึ่งแต่คนเดินทางอีกสัญชาติหนึ่ง
         บอกทั้งเลขเดิมและเงินที่ต่าง · ตัดสินใจได้โดยไม่ต้องเปิดใบจองไล่ดูทีละใบ */
      var natChip='';
      if(X.natDiff){
        var an=pcParkAmt(R,XN), ap=pcParkAmt(R,X);
        var gap=(an!=null&&ap!=null)?(ap-an):null;
        var pn=function(c){ return 'ไทย '+pcN(c.ad_th+c.chd_th+c.inf_th+c.foc_th)
          +'/ตปท '+pcN(c.ad_fr+c.chd_fr+c.inf_fr+c.foc_fr); };
        natChip='<span class="pc-nat" title="ช่องนับใช้สัญชาติจริงของ นทท. ('+pn(XN)+')'
          +' · ถ้าคิดตามช่องราคาที่ขายจะเป็น '+pn(X)
          +(gap!=null?(' · ค่าอุทยานต่างกัน '+pcMoney(Math.abs(gap))):'')+'">'
          +'🛂 '+pn(XN)+(gap>0?(' · ประหยัด '+pcMoney(gap)):(gap<0?(' · เพิ่ม '+pcMoney(-gap)):''))+'</span>';
      }
      rows+='<tr><td class="rn">'+rn+'</td><td class="bn">'+pcE(B.name)+'</td>'
        +'<td class="rt">'+pcRouteName(B.rid,B.route)+'<br>'+pcRateChip(R)+natChip
          +((hasK||PR)?'':(_pcFillAsk===(ds+'::'+B.bid)
            ? pcFillPanel(ds,B.bid,pier,X,R)
            : ('<button class="pc-fill" title="คัดลอกยอดเดินทางจริง (หักคนที่ไม่ได้ขึ้นเรือแล้ว) มาใส่ช่องคีย์ทั้ง 8 ช่อง แล้วค่อยแก้เฉพาะที่ต่าง" '
            +'onclick="pcFillAsk(\''+ds+'\',\''+B.bid+'\',\''+pier+'\')">⤓ เติมจากใบจอง</button>')))
          +'</td>'+cells
        +'<td class="v">'+XN.tot+'</td>'+keys
        +box('cy gs', (C.dock?pcN(C.dock):''),
          '<input value="'+(C.dock?pcN(C.dock):'')+'" placeholder="—" inputmode="numeric" '
          +'onchange="pcSetPK(\''+ds+'\',\''+B.bid+'\',\'dock\',this.value)">')
        +'<td class="v"'+(hasK?' style="background:#FFFDF5;color:#7A4A00"':'')+'>'+(hasK?kt:'—')+'</td>'
        +exc
        +box('cy', (C.amt?pcN(C.amt):''),
          '<input value="'+(C.amt?pcN(C.amt):'')+'" placeholder="—" inputmode="numeric" '
          +'onchange="pcSetPK(\''+ds+'\',\''+B.bid+'\',\'amt\',this.value)">')
        +pcDiffCell(+C.amt||0, exp)+'</tr>';
    });
    PC_PK.forEach(function(k,i){ GT[i]+=DT[i]; GK[i]+=DK[i]; });
    gtot+=dtot; gktot+=dktot; gm+=dm; gex+=dex; gdk+=ddk;
    body+='<tr class="day'+(ds===pcNowDS()?' now':'')+'" id="pcd-'+pier+'-'+ds+'"><td colspan="25">'
      +pcE(pcDL(ds))+(ds===pcNowDS()?'<span class="tdy">วันนี้</span>':'')
      +'<span class="d2">'+BS.length+' ลำ · '+dtot+' คน</span></td></tr>'+rows
      +'<tr class="sum"><td class="rn"></td><td colspan="2">รวม '+pcE(pcDS(ds))+'</td>'
      +DT.map(function(v,i){ return '<td class="v'+(i===PC_PK.length/2?' gs':'')+'">'+v+'</td>'; }).join('')
      +'<td class="v">'+dtot+'</td>'
      +DK.map(function(v,i){ return '<td class="v'+((i===0||i===PC_PK.length/2)?' gs':'')+'">'+(anyk?v:'—')+'</td>'; }).join('')
      +'<td class="r gs">'+(ddk?pcN(ddk):'—')+'</td>'
      +'<td class="v">'+(anyk?dktot:'—')+'</td>'
      +'<td class="pc-ex gs"><b>'+(anyx?pcN(dex):'—')+'</b></td>'
      +'<td class="r">'+(dm?pcN(dm):'—')+'</td>'
      +pcDiffCell(dm, anyx?dex:null)+'</tr>';
  });
  if(!body) body='<tr><td colspan="25" style="color:#B9BCC6;padding:20px 12px">'
    +(opt.only?'ไม่มีเรือออกในวันนี้':'ไม่มีเรือออกในเดือนนี้')+'</td></tr>';
  return '<div class="pc-sheet">'
   +(PR?'':('<div class="pc-tb"><b>🏝️ สรุปค่าอุทยานรายวัน</b>'
     +'<input class="pc-dt" type="month" value="'+_pcYM+'" onchange="pcMonth(this.value)">'
     +'<span class="n">'+dates.length+' วัน · '+nb+' ลำ · '+gtot+' คน</span>'
     +'<span class="sp"></span><span class="n">คำนวณ '+pcMoney(gex)+'</span>'
     +'<span class="n">จ่ายจริง '+pcMoney(gm)+'</span>'
     +'<span class="n">ค่าจอด '+pcMoney(gdk)+'</span>'
     +pcDayPick()
     +'<button class="pc-btn pri" onclick="pcPrintPK()">&#128424; พิมพ์ '+pcE(pcDS(_pcDate))+'</button></div>'))
   +'<div class="pc-gw"><table class="pc-t"><thead>'
     +'<tr><th class="rn" rowspan="3">#</th>'
       +'<th rowspan="3" style="width:126px;vertical-align:bottom">เรือ</th>'
       +'<th rowspan="3" style="vertical-align:bottom">โปรแกรม</th>'
       +'<th class="g" colspan="9" style="background:#EDF7F2;color:#0F6E56">เดินทางจริง · ระบบอ่านให้</th>'
       +'<th class="g key gs" colspan="10">จ่ายจริงที่ด่าน · คีย์เอง</th>'
       +'<th class="g gs" colspan="3" style="background:#EEF4FF;color:#2C4F8A">เงิน</th></tr>'
     +'<tr><th class="g th2" colspan="4">คนไทย</th><th class="g fr2 gs" colspan="4">ต่างชาติ</th>'
       +'<th class="c" rowspan="2" style="width:50px;vertical-align:bottom">รวม</th>'
       +'<th class="g key gs" colspan="4">คนไทย</th><th class="g key gs" colspan="4">ต่างชาติ</th>'
       +'<th class="r key gs" rowspan="2" style="width:100px;vertical-align:bottom">ค่าจอด</th>'
       +'<th class="c key" rowspan="2" style="width:50px;vertical-align:bottom">รวม</th>'
       +'<th class="r gs" rowspan="2" style="width:118px;vertical-align:bottom;background:#F0F7F2;color:#0F6E56">ยอดคำนวณ</th>'
       +'<th class="r key" rowspan="2" style="width:110px;vertical-align:bottom">เงินที่จ่าย</th>'
       +'<th class="c" rowspan="2" style="width:86px;vertical-align:bottom">ต่าง</th></tr>'
     +'<tr><th class="c th2" style="width:42px">ผญ</th><th class="c th2" style="width:42px">เด็ก</th>'
       +'<th class="c th2" style="width:42px">INF</th><th class="c th2" style="width:42px">FOC</th>'
       +'<th class="c fr2 gs" style="width:42px">ผญ</th><th class="c fr2" style="width:42px">เด็ก</th>'
       +'<th class="c fr2" style="width:42px">INF</th><th class="c fr2" style="width:42px">FOC</th>'
       +'<th class="c key gs" style="width:46px">ผญ</th><th class="c key" style="width:46px">เด็ก</th>'
       +'<th class="c key" style="width:46px">INF</th><th class="c key" style="width:46px">FOC</th>'
       +'<th class="c key gs" style="width:46px">ผญ</th><th class="c key" style="width:46px">เด็ก</th>'
       +'<th class="c key" style="width:46px">INF</th><th class="c key" style="width:46px">FOC</th></tr>'
     +'</thead><tbody>'+body+'</tbody>'
     +'<tfoot><tr class="grand"><td class="rn"></td><td colspan="2">'+(opt.only?'รวมทั้งวัน':'รวมทั้งเดือน')+'</td>'
       +GT.map(function(v,i){ return '<td class="v'+(i===PC_PK.length/2?' gs':'')+'">'+v+'</td>'; }).join('')
       +'<td class="v">'+gtot+'</td>'
       +GK.map(function(v,i){ return '<td class="v'+((i===0||i===PC_PK.length/2)?' gs':'')+'">'+v+'</td>'; }).join('')
       +'<td class="r gs">'+pcMoney(gdk)+'</td>'
       +'<td class="v">'+gktot+'</td>'
       +'<td class="pc-ex gs"><b>'+pcMoney(gex)+'</b></td>'
       +'<td class="r">'+pcMoney(gm)+'</td>'
       +pcDiffCell(gm, gex)+'</tr></tfoot></table></div>'
   +(PR?'':('<div class="pc-note"><b>ฝั่งซ้ายเขียว = ตามใบจอง</b> ระบบอ่านให้ แก้ไม่ได้ · '
     +'<b>ฝั่งขวาเหลือง = จ่ายจริงที่ด่าน</b> คีย์จำนวนคนเองได้ครบทั้ง 8 ช่อง แล้วค่อยใส่ค่าจอดกับเงินที่จ่าย<br>'
     +'ที่ต้องคีย์เองเพราะหน้าด่านมักไม่ตรงกับใบจอง — เด็กต่ำกว่า 3 ขวบไม่เก็บ · บางคนไม่ขึ้นเกาะ · '
     +'บางเกาะคนละราคา · <b>เก็บไว้ทั้งสองฝั่งจะเทียบทีหลังได้ว่าต่างกันกี่คน เพราะอะไร</b><br>'
     +'แยกไทย/ต่างชาติเพราะราคาต่อหัวไม่เท่ากัน · '
     +'<b>คนที่ไม่ระบุสัญชาติ นับเป็นต่างชาติไว้ก่อน</b> คิดสูงไว้ดีกว่าคิดต่ำแล้วเงินขาด<br>'
     +'<b>ยอดคำนวณ</b> = ราคาอุทยานของเส้นทางนั้น × จำนวนคน · คีย์จำนวนแล้วคิดตามที่คีย์ '
     +'ยังไม่คีย์คิดตามใบจองไปก่อน · <b>ราคามาจากแผนต้นทุน</b> แก้ที่หน้า ต้นทุน &amp; จุดคุ้มทุน '
     +'แล้วหน้านี้เปลี่ยนตาม ไม่ต้องแก้สองที่ · ป้ายใต้ชื่อโปรแกรมบอกราคาที่ใช้อยู่<br>'
     +'<b>INF คิด 0</b> เพราะแผนต้นทุนไม่มีช่องราคาเด็กเล็ก · ด่านไหนเก็บจริงจะไปโผล่เป็นส่วนต่างให้เห็น · '
     +'<b>ต่าง</b> = เงินที่จ่าย − ยอดคำนวณ · ช่องคีย์ที่<b>ขอบเข้ม</b> คือจำนวนที่ไม่ตรงกับใบจอง<br>'
     +'<b>พอเริ่มคีย์ ช่องที่ยังว่างจะนับเป็น 0</b> ถ้าจะแก้แค่บางช่อง ให้กด '
     +'<b>⤓ เติมจากใบจอง</b> ดึงเลขจริงมาก่อน แล้วค่อยแก้เฉพาะช่องที่ต่าง<br>'
     +'<b>FOC คิดราคาผู้ใหญ่ตามสัญชาติ</b> เพราะด่านไม่สนใจว่าเราเก็บเงินลูกค้าหรือเปล่า<br>'
     +'<b>ค่าจอด</b> เป็นคนละก้อนกับค่าอุทยาน · ใส่เงินอย่างเดียว ไม่ต้องนับหัว · '
     +'ยอดรวมของวันจะไปโผล่เป็นบรรทัด “ค่าจอดเรือ” ในชีทหน้าหลัก</div>'))
   +'</div>';
}
/* ชื่อวัน · ยาวสำหรับหัวกลุ่ม สั้นสำหรับแถวรวม */
function pcDL(ds){ try{ var d=new Date(ds+'T12:00:00'); if(isNaN(d.getTime())) return ds;
  return d.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(_){ return ds; } }
/* ══ §pcDayTab · เลือกวันได้จากแท็บหางยาว/อุทยาน ═══════════════════════════
   ปุ่มพิมพ์ของสองแท็บนี้พิมพ์ตาม _pcDate มาตลอด · แต่ตัวเลือกวันมีอยู่แท็บเดียว
   คือหน้าหลัก · สองแท็บนี้มีแต่ตัวเลือกเดือน (_pcYM) คนพิมพ์จึงต้องเด้งกลับไป
   หน้าหลักเพื่อเปลี่ยนวัน แล้วค่อยกลับมากดพิมพ์ · ชุดนี้ยกตัวควบคุมวันชุดเดียวกัน
   กับสมุดเดินบัญชี (pcPickDay / pcShift) มาไว้บนแท็บด้วย ไม่มี state ใหม่ */
function pcDayPick(){
  return '<span class="n">พิมพ์วันที่</span>'
   + '<input class="pc-dt" type="date" value="'+pcE(_pcDate)+'" '
   +   'title="วันที่จะพิมพ์ · ชีทบนจอยังเป็นทั้งเดือน" onchange="pcPickDay(this.value)">'
   + '<button class="pc-btn" onclick="pcShift(-1)">‹</button>'
   + '<button class="pc-btn" onclick="pcShift(1)">›</button>';
}
function pcDS(ds){ try{ var d=new Date(ds+'T12:00:00'); if(isNaN(d.getTime())) return ds;
  return d.toLocaleDateString('th-TH',{day:'numeric',month:'short'}); }catch(_){ return ds; } }
/* หัวตารางมีสามชั้น · ถ้าปล่อย top:0 เท่ากันหมด เวลาเลื่อนมันจะทับกันจนอ่านไม่ออก
   ความสูงแต่ละชั้นไม่คงที่ (ข้อความไทยขึ้นบรรทัด) เลยต้องวัดจริงหลังวาดเสร็จ */
function pcStickHead(){
  try{
    var host=document.getElementById('pc-host-'+_pcPier); if(!host) return;
    /* หน้าหลักมีสองตารางในจอเดียว · ต้องนับ offset แยกตาราง
       ถ้านับรวมกัน ตารางล่างจะได้ค่าของตารางบน แล้วหัวไปทับแถวแรก */
    var tabs=host.querySelectorAll('table.pc-t');
    for(var t=0;t<tabs.length;t++){
      var rows=tabs[t].querySelectorAll('thead tr'), y=0;
      for(var i=0;i<rows.length;i++){
        var cells=rows[i].children;
        for(var j=0;j<cells.length;j++) cells[j].style.top=y+'px';
        y+=rows[i].getBoundingClientRect().height;
      }
    }
  }catch(_){}
}
/* วันนี้ในรูป YYYY-MM-DD · ใช้ตัวเดียวกับที่ระบบใช้ทั้งแอป */
function pcNowDS(){ try{ return (typeof poYMD==='function')?poYMD(new Date()):new Date().toISOString().slice(0,10); }
  catch(_){ return new Date().toISOString().slice(0,10); } }
/* เลื่อนตารางให้หัววันของวันนี้มาอยู่บนสุด · ไม่มีวันนี้ในเดือนที่ดูอยู่ก็ไม่ต้องทำอะไร */
function pcJumpToday(){
  try{
    var host=document.getElementById('pc-host-'+_pcPier); if(!host) return;
    var w=host.querySelector('.pc-gw'); if(!w) return;
    var row=host.querySelector('#pcd-'+_pcPier+'-'+pcNowDS()); if(!row) return;
    var head=w.querySelector('thead');
    var hh=head?head.getBoundingClientRect().height:0;
    w.scrollTop = Math.max(0, row.offsetTop - hh - 4);
  }catch(_){}
}

/* ══ §pcPrint · พิมพ์เงินสดย่อยตามวันที่เลือก ═══════════════════════════════
   ทั้งสามชีทเดิมพิมพ์ไม่ได้เลย · เป็นหน้าเดียวในกลุ่มหน้าท่าที่ไม่มีปุ่มพิมพ์
   บัญชีจึงต้องคีย์รายจ่ายซ้ำลงใบรับรองแทนใบเสร็จรับเงินเองทุกวัน
   ทั้งที่ตัวเลขทุกตัวอยู่ในระบบแล้ว · คีย์ซ้ำเมื่อไรก็มีโอกาสพิมพ์ผิดเมื่อนั้น

   ใช้แบบ "เปิดหน้าต่างใหม่แล้วเขียน HTML ลงไป" ตามใบงานเรือ (pjPrint)
   ได้ปุ่มบันทึก PNG มาฟรีจาก pjShotScript() ซึ่งบังคับว่าต้องมี
     id="sheet" ที่กล่องกระดาษ · <style id="sty"> · ปุ่ม id="bimg"
   สไตล์ตารางยกจาก pcCSS('#sheet') มาทั้งก้อน ตารางบนกระดาษจะได้เหมือนบนจอ

   ชื่อบริษัทเก็บที่ po_cash_co · ต้องเป็นสตริงเท่านั้น (ดู §pcFix ข้างบน)
   ═════════════════════════════════════════════════════════════════════════ */
function pcCoName(){
  try{ var b=laBlob(); return (typeof b.po_cash_co==='string')?b.po_cash_co:''; }catch(_){ return ''; }
}
function pcCoNameSet(v){
  v=String(v==null?'':v).trim();
  try{
    var b=laBlob();
    if(v) b.po_cash_co=v; else delete b.po_cash_co;
    laBlobSave();
  }catch(e){ try{ console.warn('[pcPrint] company name save failed', e && e.message); }catch(_){} }
}
function pcCoEdit(next){
  if(!pcGuard()) return;
  _pcCoNext=(typeof next==='function')?next:null;
  var host=document.getElementById('ck-reason-host');
  if(!host){ host=document.createElement('div'); host.id='ck-reason-host'; document.body.appendChild(host); }
  host.innerHTML=''
   +'<div id="ck-reason-ov" onclick="if(event.target===this)ckReasonClose()" class="ck-ovl"><div class="ck-dlg">'
   +'  <div class="ck-dh"><div><div class="t1">ชื่อบริษัทในใบรับรองแทนใบเสร็จรับเงิน</div>'
   +'    <div class="t2">พิมพ์ครั้งเดียว ระบบจำไว้ให้ · ใช้ทุกท่า</div></div>'
   +'    <button class="x" onclick="ckReasonClose()">&times;</button></div>'
   +'  <div class="ck-db">'
   +'    <div class="lb">ชื่อบริษัท (บจ. / หจก.)</div>'
   +'    <input id="pc-co-inp" class="ck-inp" type="text" value="'+pcE(pcCoName())+'" placeholder="เช่น บริษัท เลิฟ ไอแลนด์ จำกัด">'
   +'    <div class="ck-fn">ชื่อนี้จะไปอยู่หัวฟอร์มตรงช่อง บจ./หจก. และในประโยครับรองท้ายฟอร์ม<br>'
   +'      ช่องผู้เบิกจ่าย ตำแหน่ง และลายเซ็น เว้นว่างไว้ให้เขียนมือตามเดิม</div>'
   +'  </div>'
   +'  <div class="ck-df"><button class="c" onclick="ckReasonClose()">ยกเลิก</button>'
   +'    <button class="k" onclick="pcCoSave()">บันทึก</button></div>'
   +'</div></div>';
}
function pcCoSave(){
  var el=document.getElementById('pc-co-inp');
  pcCoNameSet(el?el.value:'');
  if(typeof ckReasonClose==='function') ckReasonClose();
  var n=_pcCoNext; _pcCoNext=null;
  if(n && pcCoName()) setTimeout(n,0); else pcKeep();
}
function _pcThGroup(s){          /* s = ตัวเลขไม่เกิน 6 หลัก (หนึ่งกลุ่มล้าน) */
  var out='', L=s.length, prev=false;   /* prev = มีหลักที่ไม่ใช่ศูนย์มาก่อนในกลุ่มนี้แล้ว */
  for(var i=0;i<L;i++){
    var d=+s[i], pos=L-1-i;
    if(!d) continue;
    if(pos===1 && d===1) out+='สิบ';
    else if(pos===1 && d===2) out+='ยี่สิบ';
    /* "เอ็ด" ใช้ได้ต่อเมื่อมีหลักอื่นนำหน้าอยู่ในกลุ่มเดียวกัน
       1,000,001 = หนึ่งล้านหนึ่งบาท ไม่ใช่ หนึ่งล้านเอ็ดบาท · กลุ่มหลังมีเลข 1 ตัวเดียว */
    else if(pos===0 && d===1 && prev) out+='เอ็ด';
    else out+=PC_TH_D[d]+PC_TH_P[pos];
    prev=true;
  }
  return out;
}
function pcBahtText(n){
  n=Math.round(Math.abs(+n||0));
  if(!n) return 'ศูนย์บาทถ้วน';
  var s=String(n), out='';
  /* เกินล้าน · ตัดเป็นกลุ่มละ 6 หลักจากขวา แล้วต่อคำว่า "ล้าน" คั่น */
  var groups=[];
  while(s.length>6){ groups.unshift(s.slice(-6)); s=s.slice(0,-6); }
  groups.unshift(s);
  groups.forEach(function(g,i){
    var t=_pcThGroup(g);
    if(t) out+=t;
    if(i<groups.length-1) out+='ล้าน';
  });
  return out+'บาทถ้วน';
}
/* วันที่แบบไทย พ.ศ. · DD/MM/2569 · ใช้ในตารางใบรับรอง */
function pcThDate(ds){
  try{
    var d=new Date(ds+'T12:00:00'); if(isNaN(d.getTime())) return ds;
    var p=function(v){ return (v<10?'0':'')+v; };
    return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+(d.getFullYear()+543);
  }catch(_){ return ds; }
}

/* ── หน้าต่างพิมพ์ · ตัวกลางของทุกปุ่ม ────────────────────────────────────
   css = สไตล์เพิ่มเติมเฉพาะใบนั้น · sheet = เนื้อกระดาษ (จะถูกห่อด้วย #sheet) */
function pcPrintWin(title, fname, css, sheet, land){
  var scr=(typeof pjShotScript==='function')?pjShotScript(fname):'function shot(){}';
  var base=pcCSS('#sheet')
    +'body{margin:0;background:#EDF0F5;font-family:Sarabun,-apple-system,sans-serif}'
    +'#sheet{background:#fff;margin:14px auto;padding:14mm 12mm;box-sizing:border-box;'
      +'width:'+(land?'292mm':'205mm')+';max-width:calc(100vw - 28px);box-shadow:0 4px 18px rgba(0,0,0,.14)}'
    /* บนจอตารางเลื่อนได้ · บนกระดาษต้องกางออกทั้งหมด ไม่งั้นโดนตัด */
    +'#sheet .pc-gw{overflow:visible;max-height:none}'
    +'#sheet .pc-t th{position:static}'
    +'#sheet .pc-sheet{border:none;border-radius:0}'
    /* บนจอทุกช่องห้ามตัดบรรทัด เพราะเลื่อนดูได้ · บนกระดาษเลื่อนไม่ได้
       ช่องที่เป็นตัวหนังสือยาว (ชื่อโปรแกรม · รายการ · หมายเหตุ) ต้องยอมขึ้นบรรทัดใหม่
       ไม่งั้นตารางดันกว้างเกินหน้าแล้วโดนตัดขวา */
    +'#sheet .pc-t td.rt,#sheet .pc-t td.ctx,#sheet .pc-t td.tx{white-space:normal}'
    +'#sheet .pc-t{table-layout:auto}'
    +'.tb{display:flex;gap:9px;align-items:center;padding:11px 16px;background:#16265C;color:#fff;'
      +'font:600 12px Sarabun,sans-serif;flex-wrap:wrap;position:sticky;top:0;z-index:9}'
    +'.tb button{border:none;border-radius:8px;padding:8px 15px;font:700 12px Sarabun,sans-serif;cursor:pointer}'
    +'.tb .pri{background:#fff;color:#16265C}'
    +'.tb .img{background:rgba(255,255,255,.18);color:#fff}'
    +'.tb .hint{opacity:.72;font-weight:400;font-size:11px}'
    +'@media print{.tb{display:none!important}body{background:#fff}'
      +'#sheet{margin:0;padding:0;width:auto;max-width:none;box-shadow:none}'
      +'@page{size:A4'+(land?' landscape':'')+';margin:12mm}}';
  var html='<!doctype html><html lang="th"><head><meta charset="utf-8">'
   +'<title>'+pcE(title)+'</title>'
   +'<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
   +'<style id="sty">'+base+(css||'')+'</style></head><body>'
   +'<div class="tb">'
     +'<button class="pri" onclick="window.print()">&#128424; พิมพ์ / บันทึก PDF</button>'
     +'<button class="img" id="bimg" onclick="shot()">&#128247; บันทึกเป็นรูป PNG</button>'
     +'<span class="hint">ปุ่มสองปุ่มนี้อยู่บนหน้าจอเท่านั้น · ไม่ติดไปกับกระดาษและไม่ติดในรูป</span>'
   +'</div>'
   +'<div id="sheet">'+sheet+'</div>'
   +'<script>'+scr+'<\/script></body></html>';
  var w=window.open('','_blank','width=1220,height=880');
  if(!w){ alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ · อนุญาต pop-up ของหน้านี้ก่อน'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try{ w.focus(); }catch(_){} }, 300);
}
/* หัวกระดาษที่ทุกใบใช้ร่วมกัน */
function pcPierName(){
  try{ var P=(typeof PO_PIERS!=='undefined')?(PO_PIERS.filter(function(x){ return x.k===_pcPier; })[0]||{}):{};
       return P.n||_pcPier; }catch(_){ return _pcPier; }
}
function pcPrintHead(t1,t2){
  return '<div class="pcp-hd"><div><div class="h1">'+pcE(t1)+'</div>'
    +'<div class="h2">'+pcE(t2)+'</div></div>'
    +'<div class="h3">'+pcE(pcPierName())+'<br><span>'+pcE(pcDL(_pcDate))+'</span></div></div>';
}

/* ── 1 · ใบรับรองแทนใบเสร็จรับเงิน ─────────────────────────────────────────
   เอาเฉพาะ "รายจ่าย" ของวันที่เลือก · รายรับไม่เกี่ยว ฟอร์มนี้ใช้เบิกคืนเงิน
   เรียงตามเวลาแบบเดียวกับสมุด · ที่ไม่ใส่เวลาไปท้าย (ดู pcRk ใน pcSheetMain) */
/* §pcPick · opt.only = เอาเฉพาะรายการจ่ายที่ติ๊กไว้ในสมุด · ไม่ส่ง opt คือทั้งวันเหมือนเดิม
   ต้องห่อ callback ตอนถามชื่อบริษัท ไม่งั้นกดพิมพ์ครั้งแรกแล้ว opt หายไปกับการเรียกซ้ำ */
function pcPrintCert(opt){
  opt=opt||{};
  if(!pcCoName()){ pcCoEdit(function(){ pcPrintCert(opt); }); return; }
  var ds=_pcDate, D=pcDay(_pcPier,ds,false)||{out:[]};
  var rk=function(at){ var m=/^(\d{1,2}):(\d{2})$/.exec(String(at||'')); return m?(+m[1]*60 + +m[2]):90000; };
  var rows=(D.out||[]).slice();
  if(opt.only){
    rows=rows.filter(function(x){ return pcSelHas('out',x.id); });
    if(!rows.length){ alert('No rows selected.'); return; }
  }
  rows.sort(function(a,b){ return rk(a.at)-rk(b.at); });
  var CAT={lt:'ค่าเรือหางยาว',pk:'ค่าอุทยาน',dock:'ค่าจอดเรือ'};
  var tot=0, body='';
  rows.forEach(function(x){
    var amt=+x.amt||0; tot+=amt;
    body+='<tr><td class="d">'+pcE(pcThDate(ds))+'</td>'
      +'<td class="t">'+pcE(x.txt||CAT[x.src]||'—')+'</td>'
      +'<td class="m">'+pcN(amt)+'</td><td class="n"></td></tr>';
  });
  /* เติมแถวเปล่าให้เต็มหน้าเหมือนกระดาษจริง · เขียนเพิ่มด้วยมือได้ */
  for(var i=rows.length;i<14;i++) body+='<tr><td class="d">&nbsp;</td><td class="t"></td><td class="m"></td><td class="n"></td></tr>';

  var css=PC_PRINT_HEAD_CSS
    +'#sheet .cf-t{font-size:16px;font-weight:800;text-align:center;color:#16265C;margin:2px 0 16px}'
    +'#sheet .cf-co{display:flex;align-items:flex-end;gap:8px;font-size:12.5px;margin-bottom:10px}'
    +'#sheet .cf-co .fill{flex:1;border-bottom:1px dotted #6b7280;font-weight:700;text-align:center;padding-bottom:2px}'
    +'#sheet .cf-tb{width:100%;border-collapse:collapse;font-size:12px}'
    +'#sheet .cf-tb th,#sheet .cf-tb td{border:1px solid #16265C;padding:5px 8px}'
    +'#sheet .cf-tb th{background:#EEF1F6;font-size:11px;font-weight:800;color:#16265C;text-align:center}'
    +'#sheet .cf-tb td.d{width:92px;text-align:center;white-space:nowrap}'
    +'#sheet .cf-tb td.m{width:96px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}'
    +'#sheet .cf-tb td.n{width:104px}'
    +'#sheet .cf-tb tr.sum td{background:#EEF1F6;font-weight:800}'
    +'#sheet .cf-tb tr.sum .w{text-align:center;font-weight:700}'
    +'#sheet .cf-ft{font-size:12px;line-height:2.3;margin-top:16px}'
    +'#sheet .cf-ft .u{display:inline-block;border-bottom:1px dotted #6b7280;min-width:170px}'
    +'#sheet .cf-ft .u.s{min-width:96px}'
    +'#sheet .cf-sg{display:flex;justify-content:flex-end;gap:64px;margin-top:26px;text-align:center;font-size:12px}'
    +'#sheet .cf-sg .l{border-bottom:1px dotted #6b7280;min-width:168px;margin-bottom:4px}';

  var sheet=pcPrintHead('เงินสดย่อย · ใบเบิก Petty Cash',
     opt.only ? ('ดึงเฉพาะ '+rows.length+' รายการจ่ายที่เลือกไว้ในสมุดเดินบัญชี ไม่ได้คีย์ใหม่')
              : 'ดึงรายจ่ายของวันที่เลือกจากสมุดเดินบัญชี ไม่ได้คีย์ใหม่')
   +'<div class="cf-t">ใบรับรองแทนใบเสร็จรับเงิน</div>'
   +'<div class="cf-co"><span>บจ. / หจก.</span><span class="fill">'+pcE(pcCoName())+'</span>'
     +'<span>(ผู้ซื้อ/ผู้รับเงิน)</span></div>'
   +'<table class="cf-tb"><thead><tr><th>วัน เดือน ปี</th><th>รายละเอียดรายจ่าย</th>'
     +'<th>จำนวนเงิน</th><th>หมายเหตุ</th></tr></thead><tbody>'+body+'</tbody>'
   +'<tfoot><tr class="sum"><td class="w" colspan="2">'+pcE(pcBahtText(tot))+'</td>'
     +'<td class="m">'+pcN(tot)+'</td><td>รวมทั้งสิ้น</td></tr></tfoot></table>'
   +'<div class="cf-ft">ข้าพเจ้า <span class="u"></span> (ผู้เบิกจ่าย) &nbsp; ตำแหน่ง <span class="u s"></span><br>'
     +'ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกใบเสร็จรับเงินจากผู้รับได้ '
     +'และข้าพเจ้าได้จ่ายไปในงานของ '+pcE(pcCoName())+' โดยแท้<br>'
     +'ตั้งแต่วันที่ <span class="u s">'+pcE(pcThDate(ds))+'</span> ถึงวันที่ <span class="u s">'+pcE(pcThDate(ds))+'</span></div>'
   +'<div class="cf-sg"><div><div class="l"></div>(ผู้เบิกจ่าย)</div>'
     +'<div><div class="l"></div>(ผู้อนุมัติ)</div></div>';

  pcPrintWin('ใบรับรองแทนใบเสร็จรับเงิน · '+pcPierName()+' · '+ds+(opt.only?(' · เลือก '+rows.length+' รายการ'):''),
    ('pettycash_cert_'+_pcPier+'_'+ds+(opt.only?'_sel':'')).replace(/[^A-Za-z0-9_.-]+/g,'_'), css, sheet, false);
}

/* ── 2 · สมุดเดินบัญชีของวัน ─────────────────────────────────────────────── */
function pcPrintLedger(){
  var ds=_pcDate, D=pcDay(_pcPier,ds,false)||{in:[],out:[]};
  var T=pcTotals(_pcPier,ds), op=pcOpening(_pcPier,ds), bal=op+T.net;
  var rk=function(at){ var m=/^(\d{1,2}):(\d{2})$/.exec(String(at||'')); return m?(+m[1]*60 + +m[2]):90000; };
  var rows=[];
  (D.in||[]).forEach(function(x){ rows.push({t:rk(x.at),k:'in',x:x}); });
  (D.out||[]).forEach(function(x){ rows.push({t:rk(x.at),k:'out',x:x}); });
  rows.sort(function(a,b){ return a.t-b.t; });
  var run=op, body='', i=0;
  body+='<tr><td class="rn">—</td><td class="c">—</td><td><i>ยอดยกมาจากวันก่อนหน้า</i></td>'
    +'<td class="rt">ยกมา</td><td class="rt">ระบบ</td><td></td><td></td>'
    +'<td class="r v">'+pcN(op)+'</td></tr>';
  rows.forEach(function(r){
    i++;
    var isIn=(r.k==='in'), amt=+r.x.amt||0;
    var cat=isIn?'รับเงิน':(r.x.src?({lt:'หางยาว',pk:'อุทยาน',dock:'ค่าจอด'}[r.x.src]||'จ่ายอื่น'):'จ่ายอื่น');
    run += isIn ? amt : -amt;
    body+='<tr><td class="rn">'+i+'</td><td class="c">'+pcE(r.x.at||'—')+'</td>'
      +'<td class="tx">'+pcE(r.x.txt||'—')+'</td><td class="rt">'+cat+'</td><td class="rt">'+pcE(r.x.by||'—')+'</td>'
      +'<td class="r v">'+(isIn?pcN(amt):'')+'</td><td class="r v">'+(!isIn?pcN(amt):'')+'</td>'
      +'<td class="r v">'+pcN(run)+'</td></tr>';
  });
  if(!rows.length) body+='<tr><td class="rn"></td><td colspan="7" style="color:#B9BCC6;padding:18px 12px">'
    +'ไม่มีรายการของวันนี้</td></tr>';

  var css=PC_PRINT_HEAD_CSS
    +'#sheet .pcp-sg{display:flex;justify-content:flex-end;gap:64px;margin-top:30px;text-align:center;font-size:12px}'
    +'#sheet .pcp-sg .l{border-bottom:1px dotted #6b7280;min-width:168px;margin-bottom:4px}';
  var sheet=pcPrintHead('สมุดเดินบัญชีเงินสดย่อย','ยอดยกมา · รับ · จ่าย · คงเหลือ ของวันที่เลือก')
   +'<div class="pc-sheet"><div class="pc-gw"><table class="pc-t"><thead><tr>'
     +'<th class="rn">#</th><th class="c" style="width:64px">เวลา</th><th>รายการ</th>'
     +'<th style="width:96px">หมวด</th><th style="width:96px">ผู้บันทึก</th>'
     +'<th class="r" style="width:104px">รับ</th><th class="r" style="width:104px">จ่าย</th>'
     +'<th class="r" style="width:116px">คงเหลือ</th></tr></thead>'
     +'<tbody>'+body+'</tbody>'
     +'<tfoot><tr class="grand"><td class="rn"></td><td colspan="4">รวมวันนี้</td>'
       +'<td class="r">'+pcN(T.in)+'</td><td class="r">'+pcN(T.out)+'</td>'
       +'<td class="r">'+pcN(bal)+'</td></tr></tfoot></table></div></div>'
   +'<div class="pcp-sg"><div><div class="l"></div>(ผู้บันทึก)</div>'
     +'<div><div class="l"></div>(ผู้ตรวจ)</div></div>';

  pcPrintWin('สมุดเดินบัญชี · '+pcPierName()+' · '+ds,
    ('pettycash_book_'+_pcPier+'_'+ds).replace(/[^A-Za-z0-9_.-]+/g,'_'), css, sheet, false);
}

/* ── 3 · หางยาว / อุทยาน · เฉพาะวันที่เลือก ───────────────────────────────
   ชีทบนจอเป็นมุมมองทั้งเดือน · ส่ง opt.only เข้าไปให้เหลือวันเดียว
   opt.print ทำให้ช่องกรอกกลายเป็นตัวหนังสือ กระดาษจะได้ไม่มีกล่องว่างเปล่า */
function pcPrintLT(){
  var ds=_pcDate;
  var sheet=pcPrintHead('สรุปเรือหางยาว','จอย/เหมาอ่านจากใบจอง · ใช้จริงกับเงินเป็นตัวที่หน้าท่ากรอกเอง')
    +pcSheetLT(_pcPier,{only:ds, print:true});
  pcPrintWin('เรือหางยาว · '+pcPierName()+' · '+ds,
    ('longtail_'+_pcPier+'_'+ds).replace(/[^A-Za-z0-9_.-]+/g,'_'), PC_PRINT_HEAD_CSS, sheet, false);
}
function pcPrintPK(){
  var ds=_pcDate;
  var sheet=pcPrintHead('สรุปค่าอุทยาน','ฝั่งซ้ายตามใบจอง · ฝั่งขวาจ่ายจริงที่ด่าน · ต่างกันเพราะอะไรดูได้จากสองฝั่ง')
    +pcSheetPK(_pcPier,{only:ds, print:true});
  /* 25 คอลัมน์ · A4 แนวนอนถึงจะพอ · ตัวหนังสือย่อลงอีกนิดให้ครบหน้า */
  pcPrintWin('ค่าอุทยาน · '+pcPierName()+' · '+ds,
    ('parkfee_'+_pcPier+'_'+ds).replace(/[^A-Za-z0-9_.-]+/g,'_'),
    PC_PRINT_HEAD_CSS+'#sheet .pc-t{font-size:10.5px}#sheet .pc-t th,#sheet .pc-t td{padding:4px 5px}',
    sheet, true);
}
function poKinds(){
  return (PIER_KINDS||[]).filter(function(k){ return k && k.active!==false; })
    .sort(function(a,b){ return (+a.ord||0)-(+b.ord||0); });
}
/* ประกอบ PO_KIND / PO_KORDER ใหม่จากข้อมูล · เรียกทุกครั้งที่ประเภทเปลี่ยน
   จุดเรียกใช้เดิมทั้งหมดอ่านสองตัวนี้ จึงไม่ต้องแก้ที่ไหนอีก */
function poKindSync(){
  if(!Array.isArray(PIER_KINDS) || !PIER_KINDS.length)
    PIER_KINDS=PO_KIND_SEED.map(function(x){ return Object.assign({},x); });
  PO_KIND={}; PO_KORDER=[];
  /* §poKindEn · ของที่ติดตั้งไปก่อนหน้านี้ไม่มี name_en · เติมให้สามตัวตั้งต้นจาก id
     เทียบด้วย id ไม่ใช่ชื่อ เพราะชื่อไทยผู้ใช้เปลี่ยนได้ตลอด แต่ id ไม่เคยเปลี่ยน */
  var EN={}; PO_KIND_SEED.forEach(function(x){ EN[x.id]=x.name_en; });
  poKinds().forEach(function(k){
    /* เขียนกลับลงตัวข้อมูลด้วย · ไม่งั้นช่อง EN ในทะเบียนของจะว่างทั้งที่ใบพิมพ์ออกมาเป็น FINS
       ดูแล้วสับสนว่าค่าอยู่ตรงไหน · เขียนไว้เฉย ๆ ไม่ได้สั่งเซฟ ติดไปเองตอนบันทึกครั้งถัดไป */
    if(!k.name_en && EN[k.id]) k.name_en=EN[k.id];
    PO_KIND[k.id]={t:k.name||k.id, e:(k.name_en||''), u:k.unit||'ชิ้น', c:k.color||'#5F6C7B'};
    PO_KORDER.push(k.id);
  });
  // ของที่อ้างประเภทซึ่งไม่มีอยู่แล้ว · เติมที่ว่างไว้ ดีกว่าปล่อยให้อ่านค่าจาก undefined แล้วหน้าขาว
  try{ (PIER_ITEMS||[]).forEach(function(it){
    var k=it&&it.kind; if(!k || PO_KIND[k]) return;
    PO_KIND[k]={t:String(k)+' (ประเภทถูกลบ)', u:'ชิ้น', c:'#9A9A93'}; PO_KORDER.push(k);
  }); }catch(_){}
}
function poPersist(){
  if(!poCanEdit()) return;   /* §pierEdit · ถามหมวดของ Pier Office เอง ไม่ใช่ operations */
  // §pierBlob · ต้องผ่านแคชกลางเหมือนโมดูลอื่นทุกตัว
  //   อ่าน-เขียน localStorage ดิบ = อ่าน snapshot เก่าแล้วทับงานที่คนอื่นเพิ่งเขียน
  //   และโมดูลอื่นที่เขียนจากแคชก็จะลบของเราทิ้งเพราะแคชไม่มีข้อมูลนี้
  //   อาการที่เห็นหน้างานคือ "กรอกแล้วรีเฟรชเด้งกลับ"
  try{
    var d=(typeof laBlob==='function')?laBlob():null;
    if(!d){   // ยังไม่มีแคชกลาง (โหลดไม่ครบ) · ถอยไปทางเดิม ดีกว่าไม่บันทึกเลย
      var K=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2');
      d=JSON.parse(localStorage.getItem(K)||'{}');
    }
    d.pier_kinds=PIER_KINDS;   // §poKinds
    d.pier_items=PIER_ITEMS; d.pier_moves=PIER_MOVES; d.pier_staff=PIER_STAFF; d.pier_duty=PIER_DUTY;
    d.pier_team=PIER_TEAM; d.pier_job=PIER_JOB;
    d.pier_lic_types=PIER_LIC_TYPES; d.pier_lic_classes=PIER_LIC_CLASSES;
    d.pier_licenses=PIER_LICENSES; d.pier_cfg=PIER_CFG;
    d.pier_codes=PIER_CODES; d.pier_shift=PIER_SHIFT; d.pier_sect=PIER_SECT;
    d.pier_sheet=PIER_SHEET;   // §poSheet
    if(typeof laBlobSave==='function') laBlobSave();
    else localStorage.setItem((typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'), JSON.stringify(d));
  }catch(e){ console.warn('pier office persist failed', e); }
}
function poCanEdit(){
  try{
    if(typeof window.laCanEditArea!=='function') return true;
    if(window.laCanEditArea('pier')) return true;
    // §pierEdit · บัญชีที่ตั้งสิทธิ์ไว้ก่อนแยกหมวด "ท่าเรือ" จะไม่มีคำว่า pier ในรายการ
    //   ถ้ายังแก้ "ปฏิบัติการ" ได้ ให้ถือว่าได้สิทธิ์เดิมต่อ ไม่ตัดสิทธิ์เพราะเราไปแยกหมวดทีหลัง
    var ea=(typeof window.laEditAreas==='function')?window.laEditAreas():null;
    if(Array.isArray(ea) && ea.indexOf('pier')<0) return !!window.laCanEditArea('operations');
    return false;
  }catch(_){ return true; }
}
/* §pierEdit · กดแล้วเงียบคือสิ่งที่แยกไม่ออกจากระบบพัง · บอกเหตุผลทุกครั้ง */
function poGuard(){
  if(poCanEdit()) return true;
  try{ if(typeof window.laGuardEdit==='function') return window.laGuardEdit('pier'); }catch(_){}
  try{ alert('ส่วนนี้คุณมีสิทธิ์ดูอย่างเดียว · แก้ไขไม่ได้ (ติดต่อ admin)'); }catch(_){}
  return false;
}
function poE(x){ return (typeof ckEsc==='function')?ckEsc(x):String(x==null?'':x); }
function poUid(p){ return p+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4); }
function poWho(){ try{ return (ME&&(ME.name||ME.username))||''; }catch(_){ return ''; } }
function poYMD(d){ return (typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); }
function poNum(v){ var n=parseInt(v,10); return isFinite(n)?n:0; }
function poBaht(n){ return '&#3647;'+Math.round(n||0).toLocaleString(); }

/* ── ทะเบียนของ · เฉพาะท่านี้ ── */
function poItems(pier){ return (PIER_ITEMS||[]).filter(function(i){ return i.pier===pier && i.active!==false; })
  .sort(function(a,b){ return PO_KORDER.indexOf(a.kind)-PO_KORDER.indexOf(b.kind) || String(a.label).localeCompare(String(b.label)); }); }
/* §poFix1 · รวมของที่ปิดใช้งานแล้วด้วย · ปิดใช้งาน = ไม่เบิกใหม่ ไม่ใช่ของหายไปจากโลก
   ของที่ออกไปกับเรือก่อนถูกปิด ยังต้องตามคืนและยังต้องนับ */
function poItemsAll(pier){ return (PIER_ITEMS||[]).filter(function(i){ return i.pier===pier; })
  .sort(function(a,b){ return PO_KORDER.indexOf(a.kind)-PO_KORDER.indexOf(b.kind) || String(a.label).localeCompare(String(b.label)); }); }
function poItem(id){ return (PIER_ITEMS||[]).filter(function(i){ return i.id===id; })[0]||null; }
function poMoves(f){ return (PIER_MOVES||[]).filter(f||function(){return true;}); }

/* ── ยอดคงเหลือ · คำนวณจาก moves ทั้งหมด ไม่เคยเก็บเป็นตัวเลขนิ่ง ── */
function poBal(itemId){
  var it=poItem(itemId); if(!it) return {ready:0,onboat:0,dirty:0,laundry:0,repair:0,gone:0,inhand:0};
  var b={ready:poNum(it.total),onboat:0,dirty:0,laundry:0,repair:0,gone:0};
  var isTowel=(it.kind==='towel');
  (PIER_MOVES||[]).forEach(function(m){
    if(m.itemId!==itemId) return;
    var q=poNum(m.qty);
    switch(m.type){
      case 'issue':       b.ready-=q; b.onboat+=q; break;
      case 'return':      b.onboat-=q; if(isTowel) b.dirty+=q; else b.ready+=q; break;
      case 'repair':      b.onboat-=q; b.repair+=q; break;
      case 'fixed':       b.repair-=q; b.ready+=q; break;
      case 'writeoff':    if(m.from==='repair') b.repair-=q; else b.onboat-=q; b.gone+=q; break;
      case 'lost':        b.onboat-=q; b.gone+=q; break;
      case 'laundry_out': b.dirty-=q; b.laundry+=q; break;
      case 'laundry_in':  b.laundry-=q; b.ready+=q; break;
      case 'adjust':      b.ready+=q; break;
    }
  });
  b.inhand=b.ready+b.onboat+b.dirty+b.laundry+b.repair;
  return b;
}
/* §poCapReady · ยอดพร้อมใช้ที่เอาไปโชว์ · ไม่เกินทะเบียนของชิ้นนั้น
   บัญชีเก็บค่าจริงไว้เหมือนเดิม ตัวเลขบนจอเกินทะเบียนไม่ได้ ของจริงในตู้ก็ไม่เคยเกิน
   ส่วนที่เกินไม่ได้ถูกกลบ · ตัวเลขเปลี่ยนเป็นสีแดงและบอกไว้ใน title ว่าบัญชีขึ้นเท่าไหร่ */
function poReadyShown(it, b){
  var cap=poNum(it&&it.total); b=b||poBal(it&&it.id);
  return Math.min(b.ready, cap);
}

/* ── เรือที่ออกวันนี้ที่ท่านี้ · ดึงจาก TRIPS + ROUTES.pier ของเดิม ── */
/* ══ §poOrder · ใบเบิก–คืน (บนจอ) กับ ใบเซ็น (ที่พิมพ์) ต้องเรียงแถวชุดเดียวกัน ══
   สองใบนี้ถูกกรอกคู่กันหน้าท่า — กระดาษอยู่บนโต๊ะ จออยู่ข้าง ๆ ลอกกันไปมา
   ของเดิมใบพิมพ์เรียงตามรถ+ชื่อ แต่ป๊อปอัปบนจอไม่ได้เรียงเลย ใช้ลำดับดิบที่วนเจอ
   วัดของจริง 17 ส.ค. เรือ b2 · 30 แถว ตำแหน่งไม่ตรงกันทั้ง 30 แถว
   เรียงตามรถก่อน เพราะหน้าท่าเดินไล่ทีละคัน ไม่ได้ไล่ทีละ voucher
   ตัวรองใช้ชื่อคนแรกที่พิมพ์อยู่บนกระดาษ · ไม่ใช้ voucher เพราะมันไม่มีบนใบแล้ว */
function poRowCmp(a,b){
  return String((a&&a.car)||'zzz').localeCompare(String((b&&b.car)||'zzz'))
      || String((((a&&a.names)||[])[0])||'').localeCompare(String((((b&&b.names)||[])[0])||''));
}
/* ══ §poPaxReal · จำนวนคนที่ "ไปจริง" ของใบจองหนึ่ง ══════════════════════════
   ยังไม่มีใครกด No-show / CXL → คืนยอดจองเต็มตามเดิม (พิมพ์ใบตอนเช้ายังได้ครบ)
   กดแล้ว → หักออกให้ · ตัวเดียวกับที่ใบงานเรือ (pjPax §pjPaxReal) ทะเบียนผู้เดินทาง
   และ Travel Summary ใช้อยู่แล้ว · สามใบจึงพูดเลขเดียวกัน */
function poPaxLeft(b, date, t){
  var P=(typeof ckPaxBreak==='function')?ckPaxBreak(t&&t.pax):null;
  if(!P) return {ad:0,chd:0,inf:0,foc:0,tot:0};
  if(typeof ckPaxLeft!=='function') return {ad:P.ad,chd:P.chd,inf:P.inf,foc:P.foc,
    tot:P.ad+P.chd+P.inf+P.foc};
  var o={ ad:ckPaxLeft(b,date,'ad',P.ad),   chd:ckPaxLeft(b,date,'chd',P.chd),
          inf:ckPaxLeft(b,date,'inf',P.inf), foc:ckPaxLeft(b,date,'foc',P.foc) };
  o.tot=o.ad+o.chd+o.inf+o.foc;
  return o;
}
function poBoats(date, pier){
  var out=[], seen={};
  var day=(typeof TRIPS!=='undefined' && TRIPS[date])?TRIPS[date]:{};
  Object.keys(day).forEach(function(bid){
    var op=day[bid]; if(!op||!op.route) return;
    var rt=(typeof getRoute==='function')?getRoute(op.route):null; if(!rt) return;
    if((rt.pier||'')!==pier) return;
    var boat=(typeof getBoat==='function')?getBoat(bid):null;
    seen[bid]=1;
    out.push({bid:bid, boat:boat||{id:bid,name:bid}, rid:op.route, route:rt,
              dep:(rt.times&&rt.times[0])||'', pax:0, paxReal:0, bks:[]});
  });
  /* จำนวน ลค · นับจาก booking ที่ผูกลำไว้แล้ว (ops.boatId) แบบเดียวกับเช็คอินหน้าท่า */
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var rt=(typeof getRoute==='function')?getRoute(t.routeId):null; if(!rt||(rt.pier||'')!==pier) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    var bid=O.boatId||t.charterBoatId||'';
    var pax=(typeof ckBookedPax==='function')?ckBookedPax(t):0;
    var real=poPaxLeft(b,date,t).tot;   /* §poPaxReal */
    var row=null;
    for(var i=0;i<out.length;i++){ if(out[i].bid===bid){ row=out[i]; break; } }
    if(!row){
      if(bid && !seen[bid]){
        var boat=(typeof getBoat==='function')?getBoat(bid):null;
        row={bid:bid, boat:boat||{id:bid,name:bid}, rid:t.routeId, route:rt, dep:(rt.times&&rt.times[0])||'', pax:0, paxReal:0, bks:[]};
        seen[bid]=1; out.push(row);
      } else return;   /* ยังไม่ผูกลำ · ไปโผล่ในกล่อง "ยังไม่ระบุเรือ" */
    }
    row.pax+=pax; row.paxReal=(row.paxReal||0)+real;
    row.bks.push({b:b,t:t,pax:pax,paxReal:real});
  });
  out.sort(function(a,b){ return String(a.dep||'99').localeCompare(String(b.dep||'99')) || String(a.boat.name||'').localeCompare(String(b.boat.name||'')); });
  return out;
}
/* ลค ของวันนี้ที่ยังไม่ผูกลำเรือ · เตือนไว้เฉย ๆ */
function poUnassigned(date, pier){
  var n=0;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var rt=(typeof getRoute==='function')?getRoute(t.routeId):null; if(!rt||(rt.pier||'')!==pier) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if(!(O.boatId||t.charterBoatId)) n+=((typeof ckBookedPax==='function')?ckBookedPax(t):0);
  });
  return n;
}

/* ── ยอดเบิก / คืน ของลำหนึ่งในวันหนึ่ง ── */
function poDayMoves(date, boatId){ return (PIER_MOVES||[]).filter(function(m){ return m.date===date && m.boatId===boatId; }); }
function poBoatSum(date, boatId, pier){
  var out={}; poItemsAll(pier).forEach(function(it){ out[it.id]={iss:0,ret:0,rep:0,wo:0,lost:0,ob:0}; });
  poDayMoves(date, boatId).forEach(function(m){
    var o=out[m.itemId]; if(!o) return; var q=poNum(m.qty);
    if(m.type==='issue') o.iss+=q;
    else if(m.type==='return') o.ret+=q;
    else if(m.type==='repair') o.rep+=q;
    else if(m.type==='writeoff') o.wo+=q;
    else if(m.type==='lost') o.lost+=q;
    else if(m.type==='onboard') o.ob+=q;
  });
  return out;
}
/* รวมตามหมวด (ตีนกบ/หน้ากาก/ผ้า) เพื่อโชว์ในตาราง */
function poBoatKindSum(date, boatId, pier){
  var S=poBoatSum(date,boatId,pier), K={};
  PO_KORDER.forEach(function(k){ K[k]={iss:0,back:0,miss:0}; });
  poItemsAll(pier).forEach(function(it){
    var o=S[it.id]; if(!o) return; var k=K[it.kind]; if(!k) return;
    k.iss+=o.iss; k.back+=o.ret; k.miss+=(o.rep+o.wo+o.lost+o.ob);
  });
  return K;
}
/* §poFix2 · ของที่ยังอยู่กับลำนี้ตั้งแต่วันก่อน ๆ · รายไซส์
   'onboard' (ยังอยู่บนเรือ) ตั้งใจไม่หักออก · ของยังอยู่บนเรือจริง จึงยกมาวันถัดไปเอง */
function poBoatCarry(date, boatId){
  var out={};
  (PIER_MOVES||[]).forEach(function(m){
    if(!m || m.boatId!==boatId) return;
    if(!(String(m.date||'') < String(date||''))) return;
    var q=poNum(m.qty), id=m.itemId;
    if(m.type==='issue') out[id]=(out[id]||0)+q;
    else if(m.type==='return'||m.type==='repair'||m.type==='writeoff'||m.type==='lost') out[id]=(out[id]||0)-q;
  });
  Object.keys(out).forEach(function(k){ if(!(out[k]>0)) delete out[k]; });
  return out;
}
function poCarryTot(date, boatId){ var C=poBoatCarry(date,boatId), n=0;
  Object.keys(C).forEach(function(k){ n+=C[k]; }); return n; }
function poBoatStage(date, boatId, pier){
  var S=poBoatSum(date,boatId,pier), iss=0, done=0, ob=0;
  Object.keys(S).forEach(function(id){ var o=S[id];
    iss+=o.iss; done+=(o.ret+o.rep+o.wo+o.lost+o.ob); ob+=o.ob; });
  var carry=poCarryTot(date, boatId);
  if(!iss && !carry) return {k:'none',t:'ยังไม่เบิก',c:'#9A9A93'};
  /* ยอดค้างต้องหักของที่คืนไปแล้ววันนี้เสมอ · ไม่งั้นคืนครบแล้วการ์ดยังขึ้นเลขเดิม ดูเหมือนคืนไม่เข้า */
  var left=carry+iss-done;
  if(left<=0) return ob
    ? {k:'closed',t:'ปิดยอดแล้ว · ยกไป '+ob,c:'#1C7A4E'}
    : {k:'closed',t:'ปิดยอดแล้ว',c:'#1C7A4E'};
  if(!iss) return {k:'carry',t:'ค้างจากวันก่อน '+left,c:'#B4560A'};
  return {k:'open',t:'ค้างคืน '+left,c:'#B4560A'};
}

/* ── บันทึก move ── */
function poAdd(o){
  o.id=poUid('pm_'); o.at=new Date().toISOString(); o.by=o.by||poWho();
  PIER_MOVES.push(o); return o;
}

/* ── พนักงานลงเรือ ── */
function poDutyKey(date,boatId){ return date+'::'+boatId; }
function poDuty(date,boatId){ var a=PIER_DUTY[poDutyKey(date,boatId)]; return Array.isArray(a)?a:[]; }
function poStaff(pier){ return (PIER_STAFF||[]).filter(function(s){ return s.pier===pier && s.active!==false; }); }
function poStaffName(id){ var s=(PIER_STAFF||[]).filter(function(x){ return x.id===id; })[0]; return s?(s.nick||s.name||id):id; }
function poTodayYMD(){ try{ return poYMD(new Date()); }catch(_){ return _poDate; } }
function poDaysAgo(ymd){
  if(!ymd) return 0;
  var a=new Date(String(ymd)+'T12:00:00'), b=new Date(poTodayYMD()+'T12:00:00');
  if(isNaN(a)||isNaN(b)) return 0;
  return Math.round((b-a)/86400000);
}
function poDShort(ymd){
  var p=String(ymd||'').split('-'), m=+p[1], d=+p[2];
  if(!m||!d) return String(ymd||'');
  var MS=(typeof MONTHS_TH_SHORT!=='undefined')?MONTHS_TH_SHORT:[];
  return d+' '+(MS[m-1]||m);
}
/* §towelQ · เดินรายการเคลื่อนไหวเรียงตามวัน แล้วต่อคิวเข้าก่อนออกก่อน
   คืนกอง {date, q} เรียงเก่า → ใหม่ ของแต่ละถัง · ยอดรวมแต่ละถังเท่ากับ poBal เสมอ */
function poTowelQ(pier, only){
  var ids={};
  poItemsAll(pier).forEach(function(it){ if(it.kind==='towel' && (!only||it.id===only)) ids[it.id]=1; });
  var mv=[];
  (PIER_MOVES||[]).forEach(function(m,i){ if(m && ids[m.itemId]) mv.push({m:m,i:i}); });
  mv.sort(function(a,b){
    var d=String(a.m.date||'').localeCompare(String(b.m.date||'')); if(d) return d;
    var t=String(a.m.at||'').localeCompare(String(b.m.at||'')); if(t) return t;
    return a.i-b.i; });
  var Q={onboat:[], dirty:[], laundry:[]};
  var push=function(q,date,n){ if(n<=0) return;
    var t=q[q.length-1]; if(t && t.date===date) t.q+=n; else q.push({date:date,q:n}); };
  var takeF=function(q,n){ while(n>0 && q.length){ var h=q[0];
    if(h.q<=n){ n-=h.q; q.shift(); } else { h.q-=n; n=0; } } };
  var takeB=function(q,n){ while(n>0 && q.length){ var t=q[q.length-1];
    if(t.q<=n){ n-=t.q; q.pop(); } else { t.q-=n; n=0; } } };
  mv.forEach(function(x){
    var m=x.m, q=poNum(m.qty), d=String(m.date||'');
    if(!q) return;
    switch(m.type){
      case 'issue':
        if(q>0) push(Q.onboat,d,q); else takeB(Q.onboat,-q); break;
      case 'return':
        /* ผ้าที่คืนเข้ามาเริ่มนับอายุกองสกปรกตั้งแต่วันที่คืน ไม่ใช่วันที่เบิก */
        if(q>0){ takeF(Q.onboat,q); push(Q.dirty,d,q); }
        else { takeB(Q.dirty,-q); push(Q.onboat,d,-q); } break;
      case 'repair': case 'writeoff': case 'lost':
        if(q>0) takeF(Q.onboat,q); else push(Q.onboat,d,-q); break;
      case 'laundry_out':
        if(q>0){ takeF(Q.dirty,q); push(Q.laundry,d,q); }
        else { takeB(Q.laundry,-q); push(Q.dirty,d,-q); } break;
      case 'laundry_in':
        if(q>0) takeF(Q.laundry,q); else push(Q.laundry,d,-q); break;
    }
  });
  /* บังคับให้ยอดรวมของคิวเท่ากับยอดจริงเสมอ
     เกิน = ตัดกองเก่าสุดทิ้ง (ของที่ออกไปแล้วย่อมเป็นกองเก่าก่อน)
     ขาด = เติมกองท้ายคิวแบบไม่ทราบวัน · ดีกว่าโชว์ตัวเลขที่บวกกันไม่ได้ */
  var bal={onboat:0,dirty:0,laundry:0};
  Object.keys(ids).forEach(function(id){ var b=poBal(id);
    bal.onboat+=b.onboat; bal.dirty+=b.dirty; bal.laundry+=b.laundry; });
  ['onboat','dirty','laundry'].forEach(function(k){
    var q=Q[k], t=poQTot(q), n;
    if(t>bal[k]){ n=t-bal[k];
      while(n>0 && q.length){ var h=q[0]; if(h.q<=n){ n-=h.q; q.shift(); } else { h.q-=n; n=0; } } }
    else if(t<bal[k]) q.push({date:'', q:bal[k]-t});
  });
  return Q;
}
function poQTot(a){ var n=0; (a||[]).forEach(function(x){ n+=x.q; }); return n; }
/* ผ้าที่ค้างร้านซักนานผิดปกติ · ดูจากกอง "เก่าสุดที่ยังไม่ได้รับกลับ" ไม่ใช่ครั้งที่ส่งล่าสุด
   ของเดิมอ่านวันที่ส่งครั้งล่าสุด · ส่งกองใหม่ทับ กองเก่าที่ค้างอยู่ก็หายจากคำเตือนทันที */
function poLaundryOpen(pier){
  var Q=poTowelQ(pier), out=[];
  Q.laundry.forEach(function(b){ if(!b.date) return;
    out.push({qty:b.q, since:b.date, days:poDaysAgo(b.date)}); });
  return out;
}
function poIco(n, sz){
  return '<svg viewBox="0 0 24 24" width="'+(sz||20)+'" height="'+(sz||20)+'" fill="none" stroke="currentColor" '
    +'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(PO_ICON[n]||'')+'</svg>';
}
function poCSS(){
  var H='.po-host';
  /* §poSkin · โทน slate · การ์ดมุมมนใหญ่ · เงานุ่ม — ตามไฟล์ที่ตกลงกัน */
  return H+'{color:#1E293B;background:#F0F2F5;margin:-22px;padding:22px;min-height:calc(100vh - 44px)}'
  +'@media(max-width:820px){'+H+'{margin:-12px -10px;padding:12px 10px;min-height:calc(100vh - 24px)}}'
  +H+' .po-h{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}'
  +H+' .po-hl{display:flex;align-items:center;gap:12px}'
  +H+' .po-badge{width:40px;height:40px;border-radius:14px;background:#0F172A;color:#fff;display:flex;align-items:center;'
     +'justify-content:center;font-weight:800;font-size:15px;letter-spacing:.02em;flex:0 0 auto;box-shadow:0 4px 12px rgba(15,23,42,.18)}'
  +H+' .po-h h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0;color:#0F172A}'
  +H+' .po-h p{font-size:11.5px;color:#64748B;margin:2px 0 0;line-height:1.6}'
  /* แถบเมนูแบบ pill · เมนูซ้าย เส้นคั่น แล้ววันที่ */
  +H+' .po-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:rgba(255,255,255,.85);'
     +'border:1px solid rgba(226,232,240,.7);border-radius:18px;padding:6px;box-shadow:0 1px 2px rgba(15,23,42,.04)}'
  +H+' .po-bar button{border:none;background:none;border-radius:12px;padding:9px 15px;font:600 12.5px inherit;'
     +'color:#475569;cursor:pointer;white-space:nowrap;transition:.14s}'
  +H+' .po-bar button:hover{background:#F1F5F9;color:#0F172A}'
  +H+' .po-bar button.pri{background:#0F172A;color:#fff;font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.14)}'
  +H+' .po-bar button.pri:hover{background:#1E293B;color:#fff}'
  +H+' .po-bar button.now{background:#EEF2FF;color:#4F46E5;font-weight:700;padding:7px 12px;font-size:11.5px}'
  +H+' .po-bar button.now:hover{background:#E0E7FF;color:#4338CA}'
  +H+' .po-bar button.nav{padding:7px 11px;color:#64748B}'
  +H+' .po-bar input[type=date]{border:none;background:#F1F5F9;border-radius:12px;padding:7px 11px;'
     +'font:600 11.5px inherit;color:#1E293B;cursor:pointer;outline:none}'
  +H+' .po-bar .sep{width:1px;height:22px;background:#E2E8F0;margin:0 3px}'
  /* KPI · ป้ายไอคอนสีอยู่ขวา */
  /* ══ §pkTk4 · หน้าตั๋วอุทยาน · ชีทตามแบบฟอร์มของด่าน ═════════════════
     คอลัมน์เรียงเหมือนใบที่เขายื่นจริง (ที่ · ชื่อ-นามสกุล · สัญชาติ ·
     บัตร/พาส · ผู้ใหญ่ · เด็ก · เด็กเล็ก · หมายเหตุ · Code)
     เส้นตารางครบ หัวตรึง แถบคั่นรายลำตรึงชั้นสอง · เลขที่เริ่มใหม่ทุกลำ
     เพราะแบบฟอร์มของด่านเป็นใบต่อลำ                                      */
  +H+' .pk-sheet{overflow:auto;max-height:calc(100vh - 260px)}'
  +H+' .pk-sheet::-webkit-scrollbar{width:10px;height:10px}'
  +H+' .pk-sheet::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:6px}'
  /* ล็อกความกว้างทุกคอลัมน์ · ของเดิมปล่อยให้ auto ช่องชื่อเลยกินที่ไปเกือบครึ่งจอ
     ทั้งที่ชื่อยาวสุดก็แค่ ~34 ตัว · ที่เหลือคือช่องที่ต้องอ่านเร็ว (1/0 กับ Code) */
  +H+' .pk-sheet table{width:100%;table-layout:fixed;border-collapse:separate;'
     +'border-spacing:0;font-size:12.5px}'
  +H+' .pk-sheet col.c-no{width:44px}'
  +H+' .pk-sheet col.c-nm{width:290px}'
  +H+' .pk-sheet col.c-na{width:74px}'
  +H+' .pk-sheet col.c-id{width:132px}'
  +H+' .pk-sheet col.c-g{width:58px}'
  +H+' .pk-sheet col.c-nt{width:auto}'   /* ช่องหมายเหตุเป็นตัวยืด เหมือนแบบฟอร์มของด่าน */
  +H+' .pk-sheet col.c-cd{width:148px}'
  +H+' .pk-sheet thead th{position:sticky;top:0;z-index:3;background:#F1F5F9;color:#334155;'
     +'font-size:11px;font-weight:800;text-align:left;padding:9px 10px;white-space:nowrap;'
     +'border-bottom:1px solid #CBD5E1;border-right:1px solid #E2E8F0;'
     +'box-shadow:inset 0 -1px 0 #CBD5E1}'
  +H+' .pk-sheet thead th.n{text-align:center}'
  +H+' .pk-sheet thead th.g{text-align:center}'
  +H+' .pk-sheet tbody td{padding:6px 10px;border-bottom:1px solid #E8EDF3;'
     +'border-right:1px solid #F1F5F9;color:#1E293B;white-space:nowrap;'
     +'max-width:340px;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pk-sheet tbody tr:hover td{background:#F8FAFC}'
  +H+" .pk-sheet td.n{text-align:center;font:600 11px 'DM Mono',monospace;color:#64748B}"
  +H+' .pk-sheet td.b{font-weight:600;color:#0F172A}'
  /* ช่องชื่อ · ที่มาจากใบจองเป็นข้อความ · ที่ยังไม่มีชื่อเป็นช่องพิมพ์ได้ */
  +H+' .pk-sheet td.nmc{padding:2px 6px}'
  +H+' .pk-sheet td.nmc .fx{display:block;padding:4px 4px;font-weight:600;color:#0F172A;'
     +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .pk-sheet td.nmc .nn{display:block;padding:4px;color:#B4560A;font-style:italic}'
  +H+' .pk-sheet td.nmc .tp{display:block;padding:4px;color:#0F172A;font-weight:600}'
  +H+' .pk-sheet .nmin{width:100%;border:1px dashed #E2C89B;background:#FFFDF6;border-radius:7px;'
     +'padding:4px 8px;font:600 12.5px inherit;color:#0F172A;outline:none}'
  +H+' .pk-sheet .nmin::placeholder{color:#C9A76B;font-weight:500;font-style:italic}'
  +H+' .pk-sheet .nmin:focus{border-color:#94A3B8;border-style:solid;background:#fff}'
  +H+' .pk-sheet .nmin.has{border-color:#BFE6D2;background:#F6FDF9}'
  /* ไฮไลต์คนไทย · ด่านคิดคนละราคา ต้องกวาดตาเจอทันทีว่าใบนี้มีคนไทยกี่คน */
  +H+' .pk-sheet tr.pk-th td{background:#F3FBF6}'
  +H+' .pk-sheet tr.pk-th:hover td{background:#E7F6EE}'
  +H+' .pk-sheet tr.pk-th td:first-child{box-shadow:inset 3px 0 0 #0F6E56}'
  +H+' .pk-sheet td.nat.th{color:#0F6E56;font-weight:800}'
  +H+' .pk-sheet td.nat.inh{opacity:.62}'
  +H+' .pk-sheet td.g.on{color:#0F172A;font-weight:800}'
  +H+" .pk-sheet td.m{font-family:'DM Mono',monospace;font-size:11.5px}"
  +H+' .pk-sheet td.ctr{text-align:center}'
  +H+' .pk-sheet td.id{background:#FCFDFE}'
  +H+" .pk-sheet td.g{text-align:center;font:700 12px 'DM Mono',monospace;color:#CBD5E1}"
  +H+' .pk-sheet td.nt{font-size:10.5px;color:#94A3B8;padding:4px 6px}'
  +H+' .pk-sheet td.nt span{display:inline-block;border-radius:5px;padding:1px 6px;'
     +'font-size:9.5px;font-weight:700;white-space:nowrap}'
  +H+' .pk-sheet td.nt .fxb{color:#B4560A;background:#FFFBEB}'
  +H+' .pk-sheet td.nt .tpb{color:#0C6B47;background:#E9F8F0}'
  +H+' .pk-sheet td.nt .nnb{color:#A32D2D;background:#FDECEC}'
  +H+' .pk-sheet td.nt .msb{color:#7A5CC4;background:#F1EDFC}'
  +H+' .pk-sheet td.nt .ovb{color:#A32D2D;background:#FDECEC}'
  /* ชื่อซ้ำ · ต้องเด้งเข้าตา ด่านออกตั๋วตามรายชื่อ ซ้ำแล้วกลายเป็นคนเดียวได้สองใบ */
  +H+' .pk-sheet td.nt .dpb{color:#fff;background:#A32D2D}'
  +H+' .pk-sheet tr.pk-dup td{background:#FDECEC !important}'
  +H+' .pk-sheet tr.pk-dup td:first-child{box-shadow:inset 3px 0 0 #A32D2D}'
  +H+' .pk-sheet .nmin.dup{border-color:#E09B9B;border-style:solid;background:#FFF6F6}'
  +H+' .pk-sheet td.nt span+span{margin-left:4px}'
  +H+' .pk-sheet td.nn{color:#B4560A;font-weight:600;font-style:italic}'
  +H+' .pk-sheet tr.pk-nn td{background:#FFFCF5}'
  +H+' .pk-sheet tr.pk-nn:hover td{background:#FEF6E7}'
  +H+' .pk-sheet tr.pk-nn.pk-th td{background:#FBFBF2}'
  +H+' .pk-sheet tr.pk-fx td{background:#FFFDF7}'
  +H+' .pk-sheet tr.pk-tp td{background:#FAFEFB}'
  /* ปุ่มบนแถบคั่นรายลำ */
  +H+' .pk-fill{border:none;background:#0F172A;color:#fff;border-radius:8px;padding:4px 11px;'
     +'font:700 10.5px inherit;cursor:pointer;flex:none}'
  +H+' .pk-fill:hover{background:#1E293B}'
  +H+' .pk-clr{border:1px solid #E2E8F0;background:#fff;color:#64748B;border-radius:8px;'
     +'padding:3px 10px;font:600 10.5px inherit;cursor:pointer;flex:none}'
  +H+' .pk-clr:hover{background:#F8FAFC}'
  +H+' .po-sec .chip.ok{background:#E9F8F0;color:#0C6B47}'
  /* ช่อง Code · เป็น dropdown เปลี่ยนประเภทของคนนั้นได้เลย */
  +H+' .pk-sheet td.cd{position:relative;padding:3px 6px}'
  +H+" .pk-sheet td.cd .cv{display:block;font:800 11px 'DM Mono',monospace;color:#0F172A;"
     +'pointer-events:none;padding:3px 8px}'
  +H+' .pk-sheet td.cd select{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);'
     +'opacity:0;cursor:pointer;font-family:inherit}'
  +H+' .pk-sheet td.cd:hover{background:#EFF6FF}'
  +H+' .pk-sheet td.cd:hover .cv{color:#12518F}'
  +H+' .pk-sheet td.cd:hover .cv:after{content:" ▾";color:#64748B;font-size:9px}'
  +H+" .pk-sheet td.cd .ro{display:block;font:800 11px 'DM Mono',monospace;color:#475569;padding:3px 8px}"
  /* ══ แถบสรุปทั้งวัน · แทนการ์ด KPI 5 ใบที่กินที่ไปครึ่งจอ ════════════
     ตัวเลขพวกนี้เป็นของ "ทั้งวัน" ซึ่งดูแค่ผ่านตา ไม่ได้เอาไปกรอกอะไร
     จึงไม่คุ้มกับพื้นที่ 5 การ์ด · ยอดรายประเภทที่ต้องใช้จริงอยู่บนหัวลำแล้ว */
  +H+' .pk-day{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 12px}'
  /* §pkTk8 · ย้ายลงท้ายหน้าแล้ว · ทำให้จางลงด้วย จะได้ไม่แย่งสายตากับตารางรายชื่อ */
  +H+' .pk-tyb{margin-top:26px;opacity:.72}'
  +H+' .pk-tyb:hover,.pk-tyb[open]{opacity:1}'
  +H+' .pk-day .s{background:#fff;border:1px solid #F1F5F9;border-radius:999px;'
     +'padding:6px 15px;font-size:11.5px;font-weight:600;color:#475569;'
     +'box-shadow:0 4px 14px -4px rgba(0,0,0,.05)}'
  +H+" .pk-day .s b{font-family:'DM Mono',monospace;font-size:14px;font-weight:800;"
     +'color:#0F172A;margin-right:4px}'
  +H+" .pk-day .s i{font-style:normal;font-family:'DM Mono',monospace;font-size:10.5px;color:#94A3B8}"
  +H+' .pk-day .s.warn{background:#FFFBEB;border-color:#F3E4C0;color:#8A5A0B}'
  +H+' .pk-day .s.warn b{color:#B4560A}'
  +H+' .pk-day .s.ok{background:#F0FAF4;border-color:#CFE9DC;color:#0C6B47}'
  +H+' .pk-day .s.ok b{color:#0C6B47}'
  +H+' .pk-day .s.bad{background:#FDECEC;border-color:#F3C9C9;color:#A32D2D}'
  +H+' .pk-day .s.bad b{color:#A32D2D}'
  /* ══ หัวทริป + แท็บชื่อเรือ ═══════════════════════════════════════════ */
  +H+' .pk-trip{margin:0 0 22px}'
  +H+' .pk-th2{display:flex;align-items:center;gap:11px;flex-wrap:wrap;'
     +'padding-left:11px;box-shadow:inset 4px 0 0 var(--rc);margin-bottom:10px}'
  +H+' .pk-th2 .rn{font-size:17px;font-weight:800;color:#0F172A;letter-spacing:-.01em}'
  +H+' .pk-th2 .mt{font-size:11.5px;color:#64748B;font-weight:600}'
  +H+' .pk-th2 .wn{font-size:10.5px;font-weight:700;color:#B4560A;background:#FFFBEB;'
     +'border-radius:999px;padding:2px 10px}'
  +H+' .pk-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}'
  +H+' .pk-tab{border:1px solid #E2E8F0;background:#fff;border-radius:12px;padding:7px 13px;'
     +'font:700 12.5px inherit;color:#475569;cursor:pointer;display:inline-flex;align-items:center;gap:7px}'
  +H+' .pk-tab:hover{background:#F8FAFC;border-color:#CBD5E1}'
  +H+" .pk-tab i{font-style:normal;font-family:'DM Mono',monospace;font-size:10.5px;color:#94A3B8}"
  +H+" .pk-tab b{font-family:'DM Mono',monospace;font-size:12px;font-weight:800;color:#0F172A;"
     +'background:#F1F5F9;border-radius:6px;padding:1px 7px}'
  +H+" .pk-tab u{text-decoration:none;font-family:'DM Mono',monospace;font-size:10.5px;"
     +'font-weight:800;color:#B4560A;background:#FFFBEB;border-radius:6px;padding:1px 6px}'
  +H+' .pk-tab.on{background:#0F172A;border-color:#0F172A;color:#fff}'
  +H+' .pk-tab.on i{color:#94A3B8}'
  +H+' .pk-tab.on b{background:rgba(255,255,255,.16);color:#fff}'
  +H+' .pk-tab.on u{background:rgba(255,190,120,.22);color:#FFCE8A}'
  /* หัวของลำที่เลือกอยู่ · อยู่นอกตาราง จะได้ไม่ต้องตรึงซ้อนกันสองชั้น */
  +H+' .pk-bhd{display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:#F1F5F9;'
     +'border:1px solid #E2E8F0;border-bottom:none;border-radius:14px 14px 0 0;padding:9px 14px}'
  +H+' .pk-bhd .bn{font-size:13px;font-weight:800;color:#0F172A}'
  +H+" .pk-bhd .tm{font:700 11px 'DM Mono',monospace;color:#475569;background:#fff;"
     +'border-radius:7px;padding:2px 9px}'
  +H+' .pk-bhd .cc{display:flex;gap:4px;flex-wrap:wrap}'
  +H+' .pk-bhd .sp{margin-left:auto}'
  +H+" .pk-bhd .tt{font:800 13px 'DM Mono',monospace;color:#0F172A}"
  +H+" .pk-bhd .dl{font:600 10px 'DM Mono',monospace;color:#B4560A}"
  /* ปุ่มบันทึกที่แถวเรือ · เป็นปุ่มหลักของหน้า จึงเข้มกว่าปุ่มอื่นบนแถวเดียวกัน */
  +H+' .pk-bhd .pk-xls{background:#0F172A;color:#fff;border:0;border-radius:10px;'
     +'padding:6px 13px;font:700 11.5px inherit;cursor:pointer;white-space:nowrap}'
  +H+' .pk-bhd .pk-xls:hover{background:#1E293B}'
  /* ══ ตารางกระทบยอดรายลำ · กระชับ ไม่ซ่อน ═══════════════════════════════
     ตัวเลขชุดนี้ต้องอ่านทุกวันก่อนไปด่าน จึงไม่ควรต้องกดเปิด
     แต่ก็ห้ามกินที่จนดันตารางรายชื่อตกจอ — บีบแถวและตัวหนังสือลงแทน
     คำอธิบายคอลัมน์ย้ายไปอยู่ใน title ของหัวตาราง (ชี้ค้างแล้วขึ้น) */
  +H+' .pk-rec{background:#fff;border:1px solid #E2E8F0;border-top:0;padding:0 13px 9px}'
  +H+' .pk-rch{display:flex;align-items:center;gap:8px;padding:7px 0 5px}'
  +H+' .pk-rch .t{font-size:11.5px;font-weight:700;color:#334155}'
  +H+" .pk-rch .m{font-family:'DM Mono',monospace;font-size:10.5px;color:#94A3B8}"
  +H+' .pk-rch .fl{margin-left:auto;font-size:9.5px;font-weight:800;border-radius:999px;'
     +'padding:2px 9px;background:#FFFBEB;color:#B4560A}'
  +H+' .pk-rch .fl.ok{background:#F0FAF4;color:#0C6B47}'
  +H+' .pk-rch .fl.bad{background:#FDECEC;color:#A32D2D}'
  +H+' .pk-rw{overflow:auto}'
  +H+' .pk-rw table{border-collapse:collapse;width:100%;min-width:600px}'
  +H+' .pk-rw th{font-size:9.5px;font-weight:700;color:#94A3B8;text-align:right;'
     +'padding:2px 8px 4px;border-bottom:1px solid #E2E8F0;white-space:nowrap}'
  +H+' .pk-rw th.ty,.pk-rw th.cd{text-align:left}'
  +H+' .pk-rw th[title]{cursor:help;text-decoration:underline dotted #CBD5E1;text-underline-offset:3px}'
  +H+' .pk-rw td{padding:3px 8px;border-bottom:1px solid #F5F7FA;font-size:11.5px;color:#334155}'
  +H+' .pk-rw td.ty{white-space:nowrap;font-weight:600}'
  +H+' .pk-rw td.ty .dot{display:inline-block;width:6px;height:6px;border-radius:50%;'
     +'margin-right:6px;vertical-align:middle}'
  +H+" .pk-rw td.cd b{font-family:'DM Mono',monospace;font-size:10px;font-weight:800;"
     +'color:#0F172A;background:#F1F5F9;border-radius:5px;padding:1px 7px}'
  +H+' .pk-rw td.cd .no{font-size:10px;font-weight:700;color:#A32D2D;'
     +'background:#FDECEC;border-radius:5px;padding:1px 7px}'
  +H+" .pk-rw td.n{text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:#475569}"
  +H+' .pk-rw td.n.big{font-size:13px;font-weight:800;color:#0F172A}'
  +H+' .pk-rw td.n.d{color:#94A3B8;font-size:10.5px}'
  +H+' .pk-rw td.n.w{color:#B4560A;background:#FFFBEB}'
  +H+' .pk-rw tr.mv td.n.d{color:#B4560A}'
  +H+' .pk-rw tfoot td{border-bottom:0;border-top:1.5px solid #E2E8F0;font-weight:800;'
     +'color:#0F172A;background:#F8FAFC;padding-top:4px;padding-bottom:4px}'
  +H+' .pk-vd{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:7px 0 0}'
  +H+' .pk-vd .v{font-size:10.5px;font-weight:600;border-radius:8px;padding:3px 9px;line-height:1.45}'
  +H+' .pk-vd .v.ok{background:#F0FAF4;color:#0C6B47}'
  +H+' .pk-vd .v.warn{background:#FFFBEB;color:#8A5A0B}'
  +H+' .pk-vd .v.bad{background:#FDECEC;color:#A32D2D}'
  +H+' .pk-vd .v.note{background:#F1F5F9;color:#475569}'
  /* §pkTk9 · ปุ่มล้างชื่อที่เกิน · อยู่ติดกับคำเตือนที่บอกว่ามีกี่ชื่อ */
  +H+' .pk-ovb{background:#A32D2D;color:#fff;border:0;border-radius:8px;padding:3px 11px;'
     +'font:700 10.5px inherit;cursor:pointer;white-space:nowrap}'
  +H+' .pk-ovb:hover{background:#8A2424}'
  /* หัวลำต่อกับกล่องกระทบยอด แล้วค่อยเป็นตาราง · มุมโค้งจึงอยู่ที่หัวกับท้ายเท่านั้น */
  +H+' .pk-trip .po-card{border-radius:0 0 14px 14px}'
  +H+' .pk-c{font-size:9.5px;font-weight:700;border-radius:6px;padding:2px 7px;white-space:nowrap}'
  +H+" .pk-c b{font-family:'DM Mono',monospace;font-size:10.5px;font-weight:800}"
  +H+" .pk-c i{font-style:normal;font-family:'DM Mono',monospace;font-size:9px;opacity:.75;"
     +'margin-left:4px;padding-left:4px;border-left:1px solid currentColor}'
  /* กล่องตั้งค่าประเภทตั๋ว */
  +H+' .pk-tyb{background:#fff;border:1px solid #F1F5F9;border-radius:18px;padding:12px 15px;margin:0 0 6px;'
     +'box-shadow:0 10px 30px -5px rgba(0,0,0,.04)}'
  +H+' .pk-tyb>summary{font-size:12px;font-weight:700;color:#475569;cursor:pointer;list-style:none}'
  +H+' .pk-tyb>summary::-webkit-details-marker{display:none}'
  +H+' .pk-tyb>summary:before{content:"▸ ";color:#94A3B8}'
  +H+' .pk-tyb[open]>summary:before{content:"▾ "}'
  +H+' .pk-tyb[open]>summary{margin-bottom:10px}'
  +H+' .pk-tyl{display:flex;flex-direction:column;gap:6px}'
  +H+' .pk-ty{display:flex;align-items:center;gap:8px}'
  +H+' .pk-ty .dot{width:9px;height:9px;border-radius:3px;flex:none}'
  +H+' .pk-ty input,.pk-ty select{border:1px solid #E2E8F0;border-radius:8px;padding:4px 9px;'
     +'font:600 11.5px inherit;color:#0F172A;outline:none;background:#fff}'
  +H+' .pk-ty input:focus,.pk-ty select:focus{border-color:#94A3B8}'
  +H+' .pk-ty .nm{flex:1;min-width:0}'
  +H+' .pk-ty .gp{width:104px;flex:none}'
  +H+" .pk-ty .cd{width:132px;flex:none;font-family:'DM Mono',monospace;font-weight:700;text-align:center}"
  +H+' .pk-ty .bs{font-size:9.5px;font-weight:700;color:#94A3B8;width:64px;text-align:right;flex:none}'
  +H+' .pk-ty .del{width:64px;flex:none;border:none;background:#FEF2F2;color:#A32D2D;border-radius:8px;'
     +'padding:4px 0;font:800 13px inherit;cursor:pointer}'
  +H+' .pk-ty .del:hover{background:#FEE2E2}'
  +H+' .pk-add{margin-top:9px;border:1px dashed #CBD5E1;background:#F8FAFC;color:#475569;'
     +'border-radius:9px;padding:6px 14px;font:700 11.5px inherit;cursor:pointer}'
  +H+' .pk-add:hover{background:#F1F5F9}'
  +H+' .pk-tyn{font-size:10px;line-height:1.8;color:#94A3B8;margin-top:9px}'
  +H+' .pk-tyn b{color:#475569}'
  +H+' .pk-e{text-align:center;color:#94A3B8;padding:40px 0 !important}'
  +H+' .po-sec .chip.warn{background:#FFFBEB;color:#B4560A}'
  +H+' .pk-iso{margin:14px 0 0;padding:9px 13px;border-radius:11px;background:#F1F5F9;'
     +'border:1px solid #E2E8F0;font-size:11px;line-height:1.7;color:#475569}'
  +H+' .pk-iso b{color:#0F172A}'
  +H+' .pk-foot{font-size:10.5px;line-height:1.9;color:#94A3B8;margin:12px 2px 0}'
  +H+' .pk-foot b{color:#475569}'
  +H+' .po-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:14px;margin:22px 0}'
  +H+' .po-kpi{background:#fff;border:1px solid #F1F5F9;border-radius:22px;padding:17px 18px;display:flex;'
     +'align-items:center;justify-content:space-between;gap:12px;box-shadow:0 10px 30px -5px rgba(0,0,0,.04),0 4px 12px -2px rgba(0,0,0,.02)}'
  +H+' .po-kpi .k{font-size:11px;font-weight:500;color:#94A3B8;display:block;margin-bottom:3px}'
  +H+" .po-kpi .v{font:800 26px 'DM Mono',monospace;line-height:1.1;color:#0F172A;letter-spacing:-.02em}"
  +H+' .po-kpi .v em{font-style:normal;font-size:11px;font-weight:500;color:#64748B;margin-left:5px;font-family:inherit}'
  +H+' .po-kpi .s{font-size:10.5px;color:#94A3B8;margin-top:3px}'
  +H+' .po-kpi .ic{width:46px;height:46px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}'
  /* หัวข้อส่วน · เลขวงกลมดำ */
  +H+' .po-sec{font-size:16px;font-weight:800;color:#0F172A;margin:26px 0 12px;display:flex;align-items:center;gap:11px}'
  +H+' .po-sec span.n{background:#0F172A;color:#fff;border-radius:999px;width:26px;height:26px;display:inline-flex;'
     +'align-items:center;justify-content:center;font-size:11.5px;font-weight:800;flex:0 0 auto}'
  +H+' .po-sec .chip{background:#F1F5F9;color:#475569;font-size:11px;font-weight:600;border-radius:999px;padding:3px 10px}'
  +H+' .po-card{background:#fff;border:1px solid #F1F5F9;border-radius:22px;overflow:hidden;'
     +'box-shadow:0 10px 30px -5px rgba(0,0,0,.04),0 4px 12px -2px rgba(0,0,0,.02)}'
  /* แถบกรองประเภท + คำอธิบายย่อ ในหัวการ์ดสต็อก */
  +H+' .po-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;'
     +'padding:13px 16px 12px;border-bottom:1px solid #F1F5F9}'
  +H+' .po-cf{display:inline-flex;background:#F1F5F9;padding:4px;border-radius:13px;gap:3px;flex-wrap:wrap}'
  +H+' .po-cf button{border:none;background:none;border-radius:9px;padding:5px 12px;font:600 11.5px inherit;'
     +'color:#64748B;cursor:pointer;white-space:nowrap;transition:.12s}'
  +H+' .po-cf button:hover{color:#0F172A}'
  +H+' .po-cf button.on{background:#fff;color:#0F172A;font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.07)}'
  +H+' .po-mini{display:flex;align-items:center;gap:11px;font-size:10.5px;color:#94A3B8;font-weight:500;flex-wrap:wrap}'
  +H+' .po-mini span{display:inline-flex;align-items:center;gap:5px}'
  +H+' .po-mini i{width:8px;height:8px;border-radius:999px;display:inline-block}'
  /* empty state แบบเส้นประ */
  +H+' .po-blank{background:rgba(248,250,252,.6);border:1px dashed #E2E8F0;border-radius:18px;padding:38px 16px;'
     +'text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:16px}'
  +H+' .po-blank .ic{width:60px;height:60px;border-radius:999px;background:#fff;color:#CBD5E1;display:flex;'
     +'align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 1px 3px rgba(15,23,42,.06)}'
  +H+' .po-blank h4{margin:0 0 5px;font-size:13px;font-weight:700;color:#334155}'
  +H+' .po-blank p{margin:0;font-size:11.5px;color:#94A3B8;max-width:420px;line-height:1.7}'
  +H+' table.po-t{border-collapse:collapse;width:100%}'
  +H+' table.po-t th{background:#F7F7F4;border-bottom:1px solid #E3E3DF;font-size:10px;font-weight:700;color:#7C8091;text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:8px 10px;white-space:nowrap}'
  +H+' table.po-t td{border-bottom:1px solid #F0F0EC;padding:9px 10px;font-size:12.5px;vertical-align:middle}'
  +H+' table.po-t tr:last-child td{border-bottom:none}'
  +H+' .po-bname{font-size:14px;font-weight:800;color:#1B2A55}'
  +H+' .po-rt{font-size:11px;color:#7C8091;margin-top:1px}'
  +H+' .po-pill{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap}'
  +H+' .po-q{font-variant-numeric:tabular-nums;font-weight:700}'
  +H+' .po-q .b{color:#9A9A93;font-weight:600}'
  +H+' .po-btn{border:1px solid #E2E8F0;background:#fff;border-radius:10px;padding:5px 12px;font:600 11px inherit;'
     +'color:#475569;cursor:pointer;white-space:nowrap;margin:1px;transition:.12s}'
  +H+' .po-btn:hover{border-color:#0F172A;background:#0F172A;color:#fff}'
  +H+' .po-btn.pri{background:#0F172A;border-color:#0F172A;color:#fff;font-weight:700}'
  +H+' .po-btn.pri:hover{background:#1E293B;border-color:#1E293B}'
  +H+' .po-btn.warn{background:#F59E0B;border-color:#F59E0B;color:#fff;font-weight:700}'
  +H+' .po-btn.warn:hover{background:#D97706;border-color:#D97706}'
  +H+' .po-bar2{height:11px;border-radius:6px;overflow:hidden;display:flex;background:#F0F0EC;margin-top:4px}'
  +H+' .po-bar2 i{display:block;height:100%}'
  +H+' .po-lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#5F5E5A;margin-top:9px;padding:0 12px 11px}'
  +H+' .po-lg span{display:flex;align-items:center;gap:5px}'
  +H+' .po-lg i{width:9px;height:9px;border-radius:2px;display:inline-block}'
  /* §poFlowStrip · แถบเดียว สี่ขั้นต่อกันด้วยลูกศร */
  +H+' .po-flow{display:flex;align-items:stretch;background:#fff;border:1px solid #F1F5F9;border-radius:22px;overflow:hidden;'
     +'box-shadow:0 10px 30px -5px rgba(0,0,0,.04),0 4px 12px -2px rgba(0,0,0,.02)}'
  +H+' .po-fl{flex:1;min-width:0;padding:14px 16px 14px 18px;position:relative}'
  +H+' .po-fl:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--sc,#CBD5E1)}'
  +H+' .po-fl+.po-fl{border-left:1px solid #F1F5F9}'
  +H+' .po-fl .t{font-size:11px;font-weight:700;display:flex;align-items:center;gap:7px;white-space:nowrap;color:var(--st,#475569)}'
  +H+" .po-fl .t b{width:19px;height:19px;border-radius:999px;background:var(--sb,#F1F5F9);color:var(--st,#64748B);"
     +"font:800 9.5px 'DM Mono',monospace;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}"
  +H+" .po-fl .v{font:800 28px 'DM Mono',monospace;margin-top:5px;line-height:1.1;color:#0F172A;letter-spacing:-.02em}"
  +H+' .po-fl .v em{font-style:normal;font-size:11px;font-weight:500;color:#94A3B8;margin-left:5px;font-family:inherit}'
  +H+' .po-fl .a{margin-top:8px}'
  /* §towelQ · อายุกอง + รายการวันที่เข้าคิว */
  +H+' .po-fl .ag{margin-top:6px;font-size:10.5px;font-weight:700;color:var(--st,#64748B)}'
  +H+' .po-fl .ag.w{color:#B4560A}'
  +H+" .po-fl .bl{margin-top:6px;display:flex;flex-direction:column;gap:2px}"
  +H+" .po-fl .bl div{display:flex;align-items:baseline;gap:7px;font:500 10.5px 'DM Mono',monospace;color:#64748B}"
  +H+' .po-fl .bl div i{font-style:normal;min-width:46px}'
  +H+' .po-fl .bl div s{text-decoration:none;font-weight:700;color:#334155}'
  +H+' .po-fl .bl div.o{color:#B4560A}'
  +H+' .po-fl .bl div.o s{color:#B4560A}'
  +H+" .po-fl .bl div.o:after{content:'เก่าสุด';font-family:inherit;font-size:9px;font-weight:700;"
     +"background:#FEF3E2;border:1px solid #EFD9AE;border-radius:999px;padding:0 7px;color:#8A5A00}"
  +H+' .po-fl .bl div.more{color:#94A3B8;font-size:10px}'
  +H+' .po-fl.zero{background:#FCFDFE}'
  +H+' .po-fl.zero .v{color:#CBD5E1}'
  +H+' .po-arw{align-self:center;color:#E2E8F0;font-size:15px;line-height:1;margin:0 -9px;padding:0 3px;'
     +'background:#fff;border-radius:999px;position:relative;z-index:1}'
  /* §poStockCards · การ์ดต่อประเภท */
  +H+' .po-kg{display:grid;grid-template-columns:repeat(auto-fill,minmax(470px,1fr));gap:13px;align-items:start;padding:16px}'
  +H+' .po-kc{border:1px solid #F1F5F9;border-radius:18px;overflow:hidden;background:#fff}'
  +H+' .po-kh{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#F8FAFC;border-bottom:1px solid #F1F5F9}'
  +H+' .po-kh b{font-size:11.5px;font-weight:800;color:#0F172A}'
  +H+' .po-kh .dot{width:9px;height:9px;border-radius:3px;flex:0 0 auto}'
  +H+" .po-kh .sum{margin-left:auto;font:600 11px 'DM Mono',monospace;color:#94A3B8;white-space:nowrap}"
  +H+' .po-kh .sum em{font-style:normal;color:#10B981;font-weight:700}'
  /* §poRowFit · ซ้ายยืดได้และตกบรรทัดได้ · ขวากว้างคงที่ ตรงคอลัมน์กันทุกแถว */
  +H+' .po-ir{display:flex;align-items:center;gap:10px;padding:6px 14px;border-bottom:1px solid #F8FAFC;line-height:1.35}'
  +H+' .po-ir:last-child{border-bottom:0}'
  +H+' .po-ir:hover{background:#F8FAFC}'
  +H+' .po-ir .lw{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
  +H+' .po-ir .l{font-size:12px;font-weight:700;color:#334155}'
  +H+' .po-ir .rw{flex:0 0 auto;display:flex;align-items:center;gap:9px}'
  +H+" .po-ir .v{font:800 14px 'DM Mono',monospace;color:#10B981;min-width:30px;text-align:right;flex:0 0 auto}"
  +H+" .po-ir .u{font:500 10px 'DM Mono',monospace;color:#94A3B8;width:48px;flex:0 0 auto;white-space:nowrap}"
  +H+' .po-ir .ac{display:flex;gap:3px;flex:0 0 auto;width:118px;justify-content:flex-end}'
  +H+' .po-mb{width:64px;height:6px;border-radius:999px;overflow:hidden;display:flex;background:#F1F5F9;flex:0 0 auto}'
  +H+' .po-mb i{display:block;height:100%}'
  +H+' .po-chs{display:flex;gap:5px;flex-wrap:wrap}'
  /* §poChip · คำใช้ฟอนต์ปกติ ตัวเลขใช้ mono · แบบเดียวกับที่ใช้ทั้งแอป */
  +H+' .po-ch{display:inline-flex;align-items:center;gap:5px;font:600 10px inherit;border-radius:999px;'
     +'padding:2px 9px;white-space:nowrap;line-height:1.6}'
  +H+" .po-ch b{font:800 10px 'DM Mono',monospace}"
  +H+' .po-go{border:none;background:none;color:#CBD5E1;border-radius:9px;padding:3px 9px;'
     +'font:600 10.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap;transition:.12s}'
  +H+' .po-ir:hover .po-go{color:#475569;background:#F1F5F9}'
  +H+' .po-ir .po-go:hover{background:#0F172A;color:#fff}'
  +H+' .po-go:disabled{opacity:.4;cursor:default}'
  +H+' .po-warn{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;border-radius:14px;padding:11px 15px;font-size:12px;margin-top:12px}'
  +H+' .po-empty{padding:26px 14px;text-align:center;color:#94A3B8;font-size:12.5px}'
  +H+' table.po-t th{background:#F8FAFC;border-bottom:1px solid #F1F5F9;color:#94A3B8}'
  +H+' table.po-t td{border-bottom:1px solid #F8FAFC}'
  +H+' .po-lg{color:#64748B}'

  /* ══════ §mobPark · โทรศัพท์ ════════════════════════════════════════════
     คนใช้หน้านี้ยืนอยู่หน้าด่านอุทยาน ถือโทรศัพท์ข้างเดียว
     สิ่งที่ต้องทำได้โดยไม่ปัดจอ: อ่านว่าต้องซื้อรหัสไหนกี่ใบ · กรอกชื่อที่ขาด
     ของเดิมทั้งสองอย่างซ่อนอยู่หลังการเลื่อนแนวนอน */
  +'@media(max-width:820px){'
    /* ── แถบหัว ── ของเดิมพันกันจนปุ่มย้อนวันกับปุ่มถัดไปอยู่คนละแถว */
    +H+' .po-h{margin-bottom:14px;gap:10px}'
    +H+' .po-h h1{font-size:19px;line-height:1.3}'
    /* คำอธิบายยาว 4 บรรทัดบนจอแคบ · ดันของที่ต้องใช้จริงตกจอไปหมด
       ตัดเหลือ 2 บรรทัด · แตะที่ข้อความเพื่อกางอ่านเต็มได้ */
    +H+' .po-h p{font-size:11px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;'
      +'-webkit-box-orient:vertical;overflow:hidden}'
    +H+' .po-h p:active{-webkit-line-clamp:unset}'
    +H+' .po-bar{flex-wrap:wrap;gap:6px;width:100%}'
    /* ปุ่มสลับหน้า (ตั๋วอุทยาน · เบิก-คืน · เงินสดย่อย) เลื่อนเป็นแถบเดียว
       ไม่ตัดบรรทัด · กินที่แนวตั้งน้อยกว่าและคุ้นมือกว่าบนมือถือ */
    +H+' .po-bar>button:not(.pri):not(.nav):not(.now){flex:none;font-size:12.5px;padding:8px 12px}'
    +H+' .po-bar .sep{flex:1 0 100%;height:0;margin:0;border:0;background:none;display:block}'
    /* ‹ [วันที่] › วันนี้  ต้องอยู่แถวเดียวกันเสมอ · เป็นชุดเดียวกันในหัว */
    +H+' .po-bar input[type=date]{flex:1 1 90px;min-width:0;min-height:42px;font-size:15px}'
    /* ปุ่มบันทึกทั้งวันอยู่แถวสุดท้ายของตัวเอง · เต็มบรรทัดไปเลย จะได้กดไม่พลาด
       ระวัง: .pri คือ "ปุ่มหน้าที่เปิดอยู่" ไม่ใช่ปุ่มบันทึก · เอามาใช้ตรงนี้ไม่ได้ */
    +H+' .po-bar>button:last-child{flex:1 1 100%;width:100%;min-height:44px;background:#0F172A;'
      +'color:#fff;border-color:#0F172A;font-weight:700}'
    +H+' .po-bar .nav{min-width:42px;min-height:42px;flex:none}'
    +H+' .po-bar .now{min-height:42px;flex:none}'
    +H+' .po-bar button{min-height:40px}'

    /* ── หัวทริป/แท็บเรือ ── */
    +H+' .pk-th2 .rn{font-size:15px}'
    +H+' .pk-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;padding-bottom:3px}'
    +H+' .pk-tab{flex:none;min-height:42px}'
    /* ปุ่มบันทึก Excel เต็มบรรทัด · เป็นปุ่มปลายทางของหน้า ต้องกดง่ายที่สุด */
    +H+' .pk-bhd{flex-wrap:wrap;padding:9px 11px}'
    +H+' .pk-bhd .sp{display:none}'
    +H+' .pk-bhd .pk-xls{flex:1 1 100%;min-height:44px;font-size:13px;order:9}'
    +H+' .pk-bhd .pk-fill,'+H+' .pk-bhd .pk-clr{flex:1 1 calc(50% - 5px);min-height:40px}'

    /* ══ ตารางกระทบยอด → การ์ดรายประเภท ══════════════════════════════
       8 คอลัมน์ไม่มีทางพอใน 390px · ของเดิมเห็นแค่ 3 คอลัมน์แรก
       ซึ่งไม่มีคอลัมน์ "ในชีทนี้" อยู่ด้วยเลย = เห็นทุกอย่างยกเว้นเลขที่ต้องใช้
       ทำเป็นการ์ดต่อประเภท · เลขที่ต้องจ่ายเป็นตัวใหญ่สุด ที่เหลือเป็นบรรทัดรอง */
    +H+' .pk-rw table,'+H+' .pk-rw thead,'+H+' .pk-rw tbody,'+H+' .pk-rw tfoot,'
      +H+' .pk-rw tr,'+H+' .pk-rw td{display:block;width:auto;min-width:0}'
    +H+' .pk-rw{overflow:visible}'
    +H+' .pk-rw thead{display:none}'
    +H+' .pk-rw tbody tr,'+H+' .pk-rw tfoot tr{border:1px solid #EEF1F5;border-radius:11px;'
      +'padding:8px 10px;margin-bottom:7px;'
      +'display:flex;flex-wrap:wrap;align-items:center;column-gap:9px;row-gap:3px}'
    +H+' .pk-rw tbody tr.mv{border-color:#F0D9B8;background:#FFFDF7}'
    +H+' .pk-rw td{border:0;padding:0;text-align:left !important}'
    +H+' .pk-rw td.ty{order:1;flex:1 1 auto;font-size:12.5px}'
    +H+' .pk-rw td.cd{order:2;flex:0 0 auto}'
    /* เลขที่ต้องเอาไปจ่าย · ตัวใหญ่สุดในการ์ด อ่านได้จากระยะแขน ตอนยืนต่อคิวที่ด่าน */
    +H+' .pk-rw td.n.big{order:3;flex:0 0 auto;margin-left:auto;font-size:26px;line-height:1}'
    /* บรรทัดรอง · ไหลต่อกันในบรรทัดเดียว ติดป้ายกำกับเองเพราะหัวตารางถูกซ่อนไปแล้ว */
    +H+' .pk-rw td.n:not(.big){order:4;flex:0 0 auto;font-size:11px}'
    +H+' .pk-rw td.n:not(.big):before{font-weight:600;color:#94A3B8;margin-right:2px}'
    +H+' .pk-rw td:nth-of-type(3):before{content:"จากใบจอง "}'
    +H+' .pk-rw td:nth-of-type(5):before{content:"ต่าง "}'
    +H+' .pk-rw td:nth-of-type(6):before{content:"มีชื่อ "}'
    +H+' .pk-rw td:nth-of-type(7):before{content:"รอชื่อ "}'
    +H+' .pk-rw td:nth-of-type(8):before{content:"เงินสดย่อย "}'
    +H+' .pk-rw tfoot tr{background:#F8FAFC;border:1.5px solid #CBD5E1;margin-bottom:0}'
    +H+' .pk-rw tfoot td.cd{display:none}'
    +H+' .pk-rw tfoot td.ty{font-size:12.5px;font-weight:800}'
    /* เส้นบนของแถวรวมย้ายไปอยู่ที่กรอบการ์ดแล้ว · ถ้าปล่อยไว้ที่ td จะขาดเป็นท่อน ๆ */
    +H+' .pk-rw tfoot td{border-top:0;background:none}'
    +H+' .pk-rec{padding:0 10px 10px}'
    +H+' .pk-vd .v{font-size:11px;line-height:1.55}'
    +H+' .pk-ovb{flex:1 1 100%;min-height:40px}'

    /* ══ ชีทรายชื่อ ══════════════════════════════════════════════════
       ยังเป็นตารางเลื่อนได้เหมือนเดิม (ด่านอ่านเรียงคอลัมน์) แต่ช่องพิมพ์ชื่อ
       ต้องกว้างพอและตัวหนังสือ 16px ไม่งั้น iOS จะซูมเข้าเองทุกครั้งที่แตะ */
    +H+' .pk-sheet{max-height:none}'
    +H+' .pk-sheet .nmin{min-height:40px;font-size:16px}'
    +H+' .pk-sheet td.cd select{min-height:38px;font-size:15px}'
    +H+' .pk-day{gap:6px;margin:12px 0 10px}'
    +H+' .pk-day .s{font-size:11px;padding:5px 12px}'
    +H+' .po-kpis{grid-template-columns:minmax(0,1fr);gap:10px;margin:14px 0}'
  +'}';
}
/* ปุ่มข้ามไปหน้าอื่นของท่าเดียวกัน */
function poGoView(pfx){
  var el=document.querySelector('[data-view="'+pfx+'-'+_poPier+'"]');
  if(el && typeof nav==='function') nav(el);
}
/* §poPrintAll · ใบสรุปเบิก-คืนรวมทุกลำของวันนั้น · A4 แนวนอน
   ตัวเลขทุกตัวอ่านจาก poBoatSum ตัวเดียวกับที่ตารางบนจอใช้ ไม่ได้นับเองใหม่ */
function poPrintAll(){
  var P=PO_PIERS.filter(function(p){ return p.k===_poPier; })[0]||PO_PIERS[0];
  var date=_poDate, pier=_poPier, e=poE;
  var boats=poBoats(date,pier);
  if(!boats.length){ alert('วันที่เลือกไม่มีเรือออกจากท่านี้ · ยังไม่มีอะไรให้พิมพ์'); return; }

  var S={}; boats.forEach(function(b){ S[b.bid]=poBoatSum(date,b.bid,pier); });
  var zero={iss:0,ret:0,rep:0,wo:0,lost:0,ob:0};
  var cell=function(bid,iid){ return (S[bid]&&S[bid][iid])||zero; };
  /* ทะเบียนของท่าหนึ่งมีเป็นร้อยรายการ · เอาเฉพาะที่ขยับจริงวันนั้น
     ไม่งั้นได้กระดาษเปล่าสิบหน้า */
  var items=poItemsAll(pier).filter(function(it){
    return boats.some(function(b){ var o=cell(b.bid,it.id);
      return o.iss||o.ret||o.rep||o.wo||o.lost||o.ob; });
  });

  var css='@page{size:A4 landscape;margin:8mm}'
   +'*{box-sizing:border-box}body{margin:0;font-family:"Sarabun","DM Sans",sans-serif;color:#242730;font-size:10px}'
   +'.hd{display:flex;justify-content:space-between;align-items:flex-end;'
     +'border-bottom:2px solid #16265C;padding-bottom:6px;margin-bottom:9px}'
   +'.t1{font-size:16px;font-weight:800;color:#16265C}'
   +'.t2{font-size:10.5px;color:#5A6270;margin-top:2px}'
   +'.t3{font-size:9.5px;color:#5A6270;text-align:right;line-height:1.5}'
   +'h2{font-size:11px;font-weight:800;color:#16265C;margin:11px 0 5px;'
     +'letter-spacing:.04em;text-transform:uppercase}'
   +'table{border-collapse:collapse;width:100%;margin-bottom:2px}'
   +'th,td{border:1px solid #C7CCD4;padding:3px 5px;font-size:9px;text-align:center}'
   +'th{background:#EEF1F6;font-weight:800;color:#2A3444}'
   +'th.gp{background:#DCE3EE}'
   +'td.l,th.l{text-align:left}'
   +'tr.kd td{background:#E8EDF5;text-align:left;font-weight:800;letter-spacing:.05em;font-size:8.5px}'
   +'tr.tt td{background:#F2F6F3;font-weight:800}'
   +'td.z{color:#C3C7CE}'
   +'td.bad{color:#C0271C;font-weight:800;background:#FDF1EF}'
   +'td.ok{color:#0F6E56;font-weight:700}'
   +'.sg{display:flex;gap:26px;margin-top:16px}'
   +'.sg div{flex:1;border-top:1px solid #8B93A1;padding-top:5px;text-align:center;'
     +'font-size:9.5px;color:#5A6270}'
   +'.nt{font-size:8.5px;color:#6E7684;margin-top:7px;line-height:1.6}';

  /* ── ตารางเรือ ── */
  var bHead='<tr><th class="l">เรือ</th><th class="l">เส้นทาง</th><th>ออก</th><th>ลค</th>'
    +'<th class="l">พนักงานลงเรือ</th><th>สถานะ</th><th>เบิก</th><th>คืน</th><th>ยังไม่คืน</th></tr>';
  var bBody=boats.map(function(b){
    var o=S[b.bid], i=0,r=0,x=0;
    Object.keys(o).forEach(function(id){ var v=o[id];
      i+=v.iss; r+=v.ret; x+=(v.iss-v.ret-v.rep-v.wo-v.lost-v.ob); });
    var st=poBoatStage(date,b.bid,pier);
    var duty=poDuty(date,b.bid).map(function(id){ return poStaffName(id); }).join(', ');
    return '<tr><td class="l"><b>'+e(b.boat.name||b.bid)+'</b></td>'
      +'<td class="l">'+e((b.route&&b.route.name)||b.rid)+'</td>'
      +'<td>'+e(b.dep||'—')+'</td><td>'+(+b.pax||0)+'</td>'
      +'<td class="l">'+(duty?e(duty):'—')+'</td>'
      +'<td>'+e(st.t)+'</td><td>'+(i||'—')+'</td><td>'+(r||'—')+'</td>'
      +'<td'+(x>0?' class="bad"':(i?' class="ok"':''))+'>'+(x>0?x:(i?'ครบ':'—'))+'</td></tr>';
  }).join('');

  /* ── ตารางของ · แถวคือของ คอลัมน์คือเรือ ── */
  var iHead='';
  if(items.length){
    iHead='<tr><th class="l" rowspan="2" style="width:190px">รายการ</th>'
      + boats.map(function(b){ return '<th class="gp" colspan="2">'+e(b.boat.name||b.bid)+'</th>'; }).join('')
      + '<th class="gp" colspan="2">รวมทั้งวัน</th>'
      + '<th rowspan="2">ค้าง<br>บนเรือ</th><th rowspan="2">ซ่อม/หาย<br>ตัดจำหน่าย</th>'
      + '<th rowspan="2">ยังไม่คืน</th></tr>'
      + '<tr>'+boats.map(function(){ return '<th>เบิก</th><th>คืน</th>'; }).join('')
      + '<th>เบิก</th><th>คืน</th></tr>';
  }
  var kSeen='', iBody='', gI=0,gR=0,gO=0,gM=0,gX=0;
  items.forEach(function(it){
    if(it.kind!==kSeen){ kSeen=it.kind;
      var kt=(PO_KIND[it.kind]&&PO_KIND[it.kind].t)||it.kind;
      iBody+='<tr class="kd"><td colspan="'+(boats.length*2+6)+'">'+e(kt)+'</td></tr>';
    }
    var ti=0,tr=0,to=0,tm=0;
    var tds=boats.map(function(b){ var o=cell(b.bid,it.id);
      ti+=o.iss; tr+=o.ret; to+=o.ob; tm+=(o.rep+o.wo+o.lost);
      return '<td'+(o.iss?'':' class="z"')+'>'+(o.iss||'·')+'</td>'
           + '<td'+(o.ret?'':' class="z"')+'>'+(o.ret||'·')+'</td>'; }).join('');
    var left=ti-tr-to-tm;
    gI+=ti; gR+=tr; gO+=to; gM+=tm; gX+=left;
    iBody+='<tr><td class="l">'+e(it.label||it.id)+'</td>'+tds
      +'<td><b>'+(ti||'·')+'</b></td><td><b>'+(tr||'·')+'</b></td>'
      +'<td'+(to?'':' class="z"')+'>'+(to||'·')+'</td>'
      +'<td'+(tm?' class="bad"':' class="z"')+'>'+(tm||'·')+'</td>'
      +'<td'+(left>0?' class="bad"':(ti?' class="ok"':' class="z"'))+'>'
        +(left>0?left:(ti?'ครบ':'·'))+'</td></tr>';
  });
  if(items.length){
    iBody+='<tr class="tt"><td class="l">รวมทุกรายการ</td>'
      + boats.map(function(b){ var o=S[b.bid], i=0,r=0;
          Object.keys(o).forEach(function(id){ i+=o[id].iss; r+=o[id].ret; });
          return '<td>'+(i||'·')+'</td><td>'+(r||'·')+'</td>'; }).join('')
      + '<td>'+gI+'</td><td>'+gR+'</td><td>'+(gO||'·')+'</td>'
      + '<td'+(gM?' class="bad"':'')+'>'+(gM||'·')+'</td>'
      + '<td'+(gX>0?' class="bad"':' class="ok"')+'>'+(gX>0?gX:'ครบ')+'</td></tr>';
  }

  /* §poDep · สรุปมัดจำของท่า · แทนที่สรุปเงินสดย่อยของเดิม
     ใบนี้ชื่อ "สรุปเบิก-คืนอุปกรณ์" · มัดจำคือเงินที่ผูกกับการเบิก-คืนตรง ๆ
     ส่วนเงินสดย่อย (ค่าเรือหางยาว ค่าอุทยาน ค่าจอดเรือ) เป็นคนละเรื่อง
     และมีใบของมันเองอยู่แล้ว · เอามาแปะตรงนี้คนอ่านต้องแยกเองว่าอันไหนเรื่องอะไร

     อ่านจาก poIsSaved ตัวเดียวกับที่หน้าจอใช้ ไม่ได้คำนวณใหม่
     แถวที่ยังไม่ปิดนับด้วย poIsRowState ตัวเดิม เลขจึงตรงกับการ์ดบนหน้าจอ */
  var _money='';
  try{
    if(typeof poIsSaved==='function'){
      var B=function(n){ n=+n||0; return n.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}); };
      var _KS=(typeof PO_KORDER!=='undefined')?PO_KORDER:[];
      var _RS=(typeof poIsRowState==='function')?poIsRowState:null;
      var per=boats.map(function(b){
        var o={bid:b.bid, name:(b.boat&&b.boat.name)||b.bid, dep:0, back:0, cut:0, nDep:0, nBack:0, wait:0, rows:0};
        var SV=poIsSaved(date, b.bid);
        if(SV && Array.isArray(SV.rows)) SV.rows.forEach(function(r){
          if(!r) return;
          var d=+r.dep||0, k=+r.back||0, c=+r.cut||0;
          o.dep+=d; o.back+=k; o.cut+=c; o.rows++;
          if(d>0) o.nDep++;
          if(k>0) o.nBack++;
          if(_RS){ var st=_RS({iss:r.iss||{}, ret:r.ret||{}}, _KS);
                   if(st.c==='b'||st.c==='a') o.wait++; }
        });
        return o;
      });
      var G={dep:0,back:0,cut:0,nDep:0,nBack:0,wait:0,rows:0};
      per.forEach(function(o){ G.dep+=o.dep; G.back+=o.back; G.cut+=o.cut;
        G.nDep+=o.nDep; G.nBack+=o.nBack; G.wait+=o.wait; G.rows+=o.rows; });
      /* ไม่มีใบไหนบันทึกมัดจำไว้เลย ก็ไม่ต้องพิมพ์ตารางเปล่า */
      if(G.rows){
        var owe=G.dep-G.back-G.cut;
        var cell=function(v, cls){ return '<td'+(v?(cls?(' class="'+cls+'"'):''):' class="z"')+'>'
          +(v?B(v):'·')+'</td>'; };
        _money=''
         +'<h2>สรุปมัดจำของท่า · วันเดียวกัน</h2>'
         +'<table><thead><tr>'
           +'<th class="l" style="width:190px">รายการ</th>'
           + per.map(function(o){ return '<th style="width:120px">'+e(o.name)+'</th>'; }).join('')
           +'<th style="width:130px">รวมทั้งวัน</th>'
           +'<th class="l">หมายเหตุ</th></tr></thead><tbody>'
         +'<tr><td class="l">รับมัดจำวันนี้</td>'
           + per.map(function(o){ return cell(o.dep); }).join('')
           +'<td><b>'+B(G.dep)+'</b></td>'
           +'<td class="l">'+G.nDep+' แถวที่มีการวางมัดจำ</td></tr>'
         +'<tr><td class="l">คืนมัดจำแล้ว</td>'
           + per.map(function(o){ return cell(o.back,'ok'); }).join('')
           +'<td class="ok"><b>'+B(G.back)+'</b></td>'
           +'<td class="l">'+G.nBack+' แถวที่คืนเงินไปแล้ว</td></tr>'
         +'<tr><td class="l">หักไว้ (ของหาย / เสีย)</td>'
           + per.map(function(o){ return cell(o.cut,'bad'); }).join('')
           +'<td'+(G.cut?' class="bad"':'')+'><b>'+B(G.cut)+'</b></td>'
           +'<td class="l">'+(G.cut?'หักจากมัดจำ ไม่ต้องคืนส่วนนี้':'ยังไม่มีการหัก')+'</td></tr>'
         +'<tr class="tt"><td class="l">ค้างคืนลูกค้า</td>'
           + per.map(function(o){ var v=o.dep-o.back-o.cut;
               return '<td'+(v>0.004?' class="bad"':' class="z"')+'>'+(v>0.004?B(v):'·')+'</td>'; }).join('')
           +'<td'+(owe>0.004?' class="bad"':' class="ok"')+'><b>'+B(owe)+'</b></td>'
           +'<td class="l">'+G.wait+' แถวยังไม่ปิด · รับ − คืน − หัก</td></tr>'
         +'</tbody></table>'
         +'<div class="nt" style="margin-top:5px">'
           +'เงินมัดจำในตารางนี้เป็น<b>บันทึกของหน้าท่า</b> ไว้ให้รู้ว่าใครวางเท่าไหร่ '
           +'ได้คืนไปแล้วหรือยัง · <b>ไม่ได้ไหลเข้าระบบบัญชี</b> · '
           +'“ค้างคืนลูกค้า” คือเงินที่ยังต้องคืน = รับ − คืน − หัก · '
           +'“ยังไม่ปิด” นับจากของที่ยังคืนไม่ครบ ไม่ใช่จากตัวเงิน แถวที่ของครบแล้ว'
           +'แต่ยังไม่ได้คืนเงินจึงไม่ถูกนับตรงนี้'
         +'</div>';
      }
    }
  }catch(_){ _money=''; }

  var html='<!doctype html><html lang="th"><head><meta charset="utf-8">'
   +'<title>สรุปเบิก-คืนอุปกรณ์ · '+e(P.n||P.t)+' · '+e(date)+'</title>'
   +'<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
   +'<style>'+css+'</style></head><body>'
   +'<div class="hd"><div><div class="t1">สรุปเบิก – คืนอุปกรณ์ · รวมทุกลำ</div>'
     +'<div class="t2">'+e(P.n||P.t)+' · '+e(P.t||'')+' &nbsp;·&nbsp; วันที่ '+e(date)+'</div></div>'
   +'<div class="t3">เรือ '+boats.length+' ลำ · รายการที่เคลื่อนไหว '+items.length+' ชนิด<br>'
     +'พิมพ์เมื่อ '+e(new Date().toLocaleString('th-TH'))+'</div></div>'
   +'<h2>เรือที่ออกวันนี้</h2>'
   +'<table><thead>'+bHead+'</thead><tbody>'+bBody+'</tbody></table>'
   +(items.length
      ? ('<h2>รายการอุปกรณ์ · เบิก / คืน แยกตามลำ</h2>'
         +'<table><thead>'+iHead+'</thead><tbody>'+iBody+'</tbody></table>')
      : '<h2>รายการอุปกรณ์</h2><table><tbody><tr><td class="l">'
        +'วันนี้ยังไม่มีการเบิก-คืนของลำไหนเลย</td></tr></tbody></table>')
   +_money
   +'<div class="nt">'
     +'<b>ยังไม่คืน</b> = เบิก − คืน − ค้างบนเรือ − ซ่อม/หาย/ตัดจำหน่าย · เป็นตัวที่ต้องตามเก็บ<br>'
     +'<b>ค้างบนเรือ</b> คือของที่ยังอยู่จริงและยกไปวันถัดไป ไม่ใช่ของหาย · '
     +'<b>ซ่อม/หาย/ตัดจำหน่าย</b> คือของที่ต้องตัดออกจากยอดคลัง<br>'
     +'ตัวเลขทุกตัวมาจากใบเบิก-คืนที่บันทึกไว้ในระบบของวันนี้ · ยอดที่ยังไม่กดยืนยันจะยังไม่ปรากฏในใบนี้'
   +'</div>'
   +'<div class="sg"><div>ผู้เบิก</div><div>ผู้รับคืน</div><div>ผู้ตรวจ / หัวหน้าท่า</div></div>'
   +'</body></html>';

  var w=window.open('','_blank','width=1200,height=800');
  if(!w){ alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ · อนุญาต pop-up ของหน้านี้ก่อน'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try{ w.focus(); w.print(); }catch(_){} }, 600);
}
function poPierName(){ var p=PO_PIERS.filter(function(x){return x.k===_poPier;})[0]; return p?(p.n+' · '+p.t):_poPier; }
function poSetDate(v){ if(v) _poDate=v; renderPierOffice(); }
function poShift(n){ var d=new Date(_poDate+'T12:00:00'); d.setDate(d.getDate()+n); _poDate=poYMD(d); renderPierOffice(); }
function poToday(){ _poDate=poYMD(new Date()); renderPierOffice(); }

function poBoatTable(boats, items, ro){
  // §poSkin · ที่ว่างแบบเส้นประ · บอกด้วยว่าไปทำต่อที่ไหน ไม่ใช่แค่บอกว่าไม่มี
  if(!boats.length) return '<div class="po-blank"><div class="ic">'+poIco('anchor',26)+'</div>'
    +'<h4>ไม่มีเรือออกจากท่านี้ในวันที่เลือก</h4>'
    +'<p>ผูกเรือกับเส้นทางได้ที่หน้า Boat Operation เพื่อเปิดรายการเบิกอุปกรณ์สำหรับเที่ยวเรือ</p></div>';
  var hd='<tr><th style="width:170px">เรือ</th><th>เส้นทาง</th><th style="width:60px;text-align:center">ลค</th>'
    +'<th style="width:150px">พนักงานลงเรือ</th>'
    +PO_KORDER.map(function(k){ return '<th style="width:96px;text-align:center">'+PO_KIND[k].t+'<br><span style="font-weight:400;text-transform:none">เบิก / คืน</span></th>'; }).join('')
    +'<th style="width:104px">สถานะ</th><th style="width:210px"></th></tr>';
  var body=boats.map(function(b){
    var K=poBoatKindSum(_poDate,b.bid,_poPier), st=poBoatStage(_poDate,b.bid,_poPier);
    var duty=poDuty(_poDate,b.bid);
    var dutyTxt=duty.length?duty.map(function(id){ return poE(poStaffName(id)); }).join(', ')
      :'<span style="color:#C0271C;font-weight:700">ยังไม่จัด</span>';
    var cells=PO_KORDER.map(function(k){
      var o=K[k];
      if(!o.iss) return '<td style="text-align:center;color:#C9C9C2">—</td>';
      var col=(o.miss>0)?'#C0271C':(o.back>=o.iss?'#1C7A4E':'#B4560A');
      return '<td style="text-align:center" class="po-q">'+o.iss+' <span class="b">/</span> <span style="color:'+col+'">'+o.back+'</span>'
        +(o.miss>0?'<div style="font-size:10px;color:#C0271C;font-weight:700">ขาด '+o.miss+'</div>':'')+'</td>';
    }).join('');
    return '<tr>'
      +'<td><div class="po-bname">'+poE(b.boat.name||b.bid)+'</div>'
        +'<div class="po-rt">'+poE(b.boat.type||'')+(b.dep?(' · ออก '+poE(b.dep)):'')+'</div></td>'
      +'<td><span class="po-pill" style="background:'+((b.route&&b.route.color)||'#5F5E5A')+'22;color:'+((b.route&&b.route.color)||'#5F5E5A')+'">'+poE((b.route&&b.route.name)||b.rid)+'</span></td>'
      +'<td style="text-align:center;font-weight:800;font-size:15px">'+b.pax+'</td>'
      +'<td style="font-size:11.5px">'+dutyTxt+'</td>'
      +cells
      /* §poDraft · ใบที่กรอกแล้วแต่ยังไม่ยืนยัน · ถ้าไม่ติดป้ายไว้ จะดูเหมือนลำนี้ยังไม่มีใครแตะ */
      +'<td><span class="po-pill" style="background:'+st.c+'1f;color:'+st.c+'">'+st.t+'</span>'
        +(poSheetPending(_poDate,b.bid)
          ? '<div style="margin-top:4px"><span class="po-pill" style="background:#FEF6E7;color:#8A5A00" '
            +'title="กรอกใบเบิก–คืนไว้แล้ว แต่ยังไม่ได้กดยืนยัน · สต็อกยังไม่ถูกตัด">ร่าง · ยังไม่ตัดสต็อก</span></div>'
          : '')
      +'</td>'
      +'<td style="text-align:right">'
        +'<button class="po-btn" onclick="poDutyOpen(\''+b.bid+'\')"'+(ro?' disabled':'')+'>พนักงาน</button>'
        +'<button class="po-btn'+(st.k==='none'?' pri':'')+'" onclick="poIssueOpen(\''+b.bid+'\')"'+(ro?' disabled':'')+'>เบิก–คืน</button>'
        +((st.k==='open'||st.k==='carry')?'<button class="po-btn warn" onclick="poCloseOpen(\''+b.bid+'\')"'+(ro?' disabled':'')+'>ปิดยอด</button>':'')
        +'<button class="po-btn" onclick="poSignSheet(\''+b.bid+'\')">ใบเซ็น</button>'
      +'</td></tr>';
  }).join('');
  return '<table class="po-t"><thead>'+hd+'</thead><tbody>'+body+'</tbody></table>';
}

/* §poStockCards · แถบสัดส่วนย่อของหนึ่งรายการ */
function poStockBar(b, cls){
  var live=b.ready+b.onboat+b.dirty+b.laundry+b.repair, denom=live||1;
  return '<div class="'+(cls||'po-bar2')+'">'+PO_BUCKET.filter(function(k){ return k.k!=='gone'; })
    .map(function(k){ var v=Math.max(0,b[k.k]); if(!v) return '';
      return '<i style="width:'+(v/denom*100).toFixed(2)+'%;background:'+k.c+'" title="'+poE(k.t)+' '+v+'"></i>'; }).join('')+'</div>';
}
/* ถังที่ไม่ใช่ "พร้อมใช้" และไม่เป็นศูนย์ · คือตัวที่ยังต้องตามเก็บ จึงเป็นตัวเดียวที่ควรกินที่ */
function poStockChips(b){
  return PO_BUCKET.filter(function(k){ return k.k!=='ready'; }).map(function(k){
    var v=b[k.k]; if(!v) return '';
    /* §poNoNeg · ติดลบ = ไม่มีทางเป็นจริง · ต้องสะดุดตา ไม่ใช่กลมกลืนไปกับยอดปกติ */
    var bad=(v<0), c=bad?'#C0271C':k.c;
    var tip=bad?(k.t+' ติดลบ · เป็นไปไม่ได้ · ตรวจใบเบิก–คืนของวันที่แก้ยอดล่าสุด'):k.t;
    return '<span class="po-ch" style="background:'+c+(bad?'22':'14')+';color:'+c
      +(bad?';font-weight:800':'')+'" title="'+poE(tip)+'">'
      +poE(k.t.split(' ')[0])+'<b>'+v+'</b></span>'; }).join('');
}
function poCatSet(k){ _poCat=k||'all'; renderPierOffice(); }
function poStockTable(items, ro){
  if(!items.length) return '<div class="po-empty">ยังไม่มีของในทะเบียนของท่านี้ · กด "ทะเบียนของ" เพื่อเพิ่ม</div>';
  // แถบกรอง · นับจากของทั้งหมดเสมอ ไม่ใช่จากที่กรองแล้ว ตัวเลขในปุ่มจะได้ไม่เปลี่ยนตามตัวเอง
  var cnt={}; items.forEach(function(it){ cnt[it.kind]=(cnt[it.kind]||0)+1; });
  var tools='<div class="po-tools"><div class="po-cf">'
    +'<button class="'+(_poCat==='all'?'on':'')+'" onclick="poCatSet(\'all\')">ทั้งหมด ('+items.length+')</button>'
    + poKinds().filter(function(k){ return cnt[k.id]; }).map(function(k){
        return '<button class="'+(_poCat===k.id?'on':'')+'" onclick="poCatSet(\''+poE(k.id)+'\')">'
          +poE(k.name||k.id)+' ('+cnt[k.id]+')</button>'; }).join('')
    +'</div><div class="po-mini">'
    + PO_BUCKET.filter(function(b){ return b.k!=='gone'; }).map(function(b){
        return '<span><i style="background:'+b.c+'"></i>'+poE(b.t)+'</span>'; }).join('')
    +'</div></div>';
  if(_poCat!=='all'){
    var f=items.filter(function(it){ return it.kind===_poCat; });
    if(f.length) items=f; else _poCat='all';   // ประเภทที่กรองอยู่ถูกลบไปแล้ว · ถอยกลับไปทั้งหมด
  }
  var by={}, order=[];
  items.forEach(function(it){ if(!by[it.kind]){ by[it.kind]=[]; order.push(it.kind); } by[it.kind].push(it); });
  // เรียงตามลำดับประเภทที่ผู้ใช้ตั้งไว้ · ประเภทที่ถูกลบไปแล้วไปต่อท้าย
  order.sort(function(a,b){ var ia=PO_KORDER.indexOf(a), ib=PO_KORDER.indexOf(b);
    return (ia<0?999:ia)-(ib<0?999:ib); });
  var cards=order.map(function(k){
    /* §poStockRev · กลับมาเป็นการ์ดต่อประเภทเหมือนเดิม
       เคยลองกางเป็นตารางคอลัมน์คงที่แล้วแย่กว่า · การ์ดกินแนวนอนสามคอลัมน์
       ท่าที่มีของ 18 รายการ 6 ประเภทจบในหน้าจอเดียว ไม่ต้องเลื่อนหาหัวข้อ */
    var K=PO_KIND[k]||{t:k,u:'ชิ้น',c:'#9A9A93'}, list=by[k];
    var tot=0, rd=0;
    list.forEach(function(it){ tot+=poNum(it.total); rd+=poReadyShown(it); });
    return '<div class="po-kc"><div class="po-kh"><span class="dot" style="background:'+K.c+'"></span>'
      +'<b>'+poE(K.t)+'</b><span class="sum">พร้อมใช้ <em>'+rd+'</em> / '+tot+' '+poE(K.u)+'</span></div>'
      + list.map(function(it){
          var b=poBal(it.id);
          var tip=it.label+' · ทะเบียน '+poNum(it.total)+' '+K.u+(b.gone?(' · ตัดออกสะสม '+b.gone):'');
          /* §poNoNeg · พร้อมใช้เกินทะเบียนแปลว่ามีของคืนกลับมามากกว่าที่เบิกออกไป · ไม่ใช่ของที่มีจริง */
          var vOver=(b.ready>poNum(it.total));
          if(vOver) tip+=' · บัญชีขึ้น '+b.ready+' ซึ่งเกินทะเบียน '+(b.ready-poNum(it.total))
            +' — ยอดคืนมากกว่ายอดเบิก · ตัวเลขนี้ตัดไว้ที่ทะเบียนแล้ว';
          return '<div class="po-ir">'
            +'<span class="lw"><b class="l" title="'+poE(tip)+'">'+poE(it.label)+'</b>'
              +'<span class="po-chs">'+poStockChips(b)+'</span></span>'
            +'<span class="rw">'
            +poStockBar(b,'po-mb')
            +'<span class="v"'+(vOver?' style="color:#C0271C" title="'+poE(tip)+'"':'')+'>'+poReadyShown(it,b)+'</span>'
            +'<span class="u">/'+poNum(it.total)+' '+poE(K.u)+'</span>'
            +'<span class="ac">'
              +(b.repair>0?'<button class="po-go" onclick="poFixOpen(\''+it.id+'\')" title="ซ่อมเสร็จ"'+(ro?' disabled':'')+'>ซ่อม&#10003;</button>':'')
              +'<button class="po-go" onclick="poAdjOpen(\''+it.id+'\')" title="ปรับยอด"'+(ro?' disabled':'')+'>ปรับยอด</button>'
            +'</span></span></div>'; }).join('')
      +'</div>';
  }).join('');
  return tools+'<div class="po-kg">'+cards+'</div>';
}

function poLaundryBlock(ro){
  var tw=poItems(_poPier).filter(function(i){ return i.kind==='towel'; });
  if(!tw.length) return '<div class="po-card"><div class="po-empty">ท่านี้ยังไม่มีผ้าเช็ดตัวในทะเบียน</div></div>';
  var t={ready:0,onboat:0,dirty:0,laundry:0};
  tw.forEach(function(it){ var b=poBal(it.id); t.ready+=b.ready; t.onboat+=b.onboat; t.dirty+=b.dirty; t.laundry+=b.laundry; });
  /* §towelQ · กองของแต่ละขั้น เรียงเก่า → ใหม่ */
  var Q=poTowelQ(_poPier), TODAY=poTodayYMD();
  var blist=function(arr, due){
    if(!arr.length) return '';
    var show=arr.slice(0,3), rest=arr.length-show.length, restQ=0;
    arr.slice(3).forEach(function(b){ restQ+=b.q; });
    return '<div class="bl">'+show.map(function(b,i){
        var old=(i===0 && b.date && due!=null && poDaysAgo(b.date)>due);
        return '<div'+(old?' class="o"':'')+'><i>'+(b.date?poE(poDShort(b.date)):'ไม่ทราบวัน')+'</i>'
          +'<s>'+b.q+'</s></div>'; }).join('')
      +(rest>0?('<div class="more">+ อีก '+rest+' วัน · '+restQ+' ผืน</div>'):'')+'</div>';
  };
  var ageLine=function(arr, due, one, many){
    if(!arr.length || !arr[0].date) return '';
    var d=poDaysAgo(arr[0].date), w=(due!=null && d>due);
    return '<div class="ag'+(w?' w':'')+'">'+(d<=0?one:many.replace('{d}',d))+'</div>';
  };
  /* ผ้าที่ยังอยู่กับเรือจากวันก่อน ๆ · ตัวที่ไม่เคยกลับมามักจมอยู่ในยอดรวมนี้ */
  var obOld=0; Q.onboat.forEach(function(b){ if(b.date<TODAY) obOld+=b.q; });
  var obNew=t.onboat-obOld;
  // §poSkin · แต่ละขั้นมีสีของตัวเอง · แถบซ้าย ตัวเลข และป้ายเลขขั้น ใช้สีเดียวกัน
  var st=[['พร้อมใช้ในคลัง',t.ready,'#059669','#ECFDF5','ผ้าสะอาดพร้อมแจกจ่าย'],
          ['อยู่กับเรือ',t.onboat,'#2563EB','#EFF6FF','ออกเที่ยวทะเลวันนี้'],
          ['คืนแล้ว รอส่งซัก',t.dirty,'#D97706','#FFFBEB','รับกลับมาจากเรือแล้ว'],
          ['อยู่ร้านซัก',t.laundry,'#7C3AED','#F5F3FF','ซักและอบแห้งนอกสถานที่']];
  // §poFlowStrip · ลูกศรบอกว่าสี่ขั้นนี้ต่อกัน · ขั้นที่ยังไม่มีของจางลง จะได้เห็นว่าคิวอยู่ตรงไหน
  var flow=st.map(function(x,i){
    var act='', extra='';
    if(i===1 && t.onboat>0){
      extra=(obOld>0
        ? '<div class="ag w">ค้างจากวันก่อน '+obOld+' ผืน'+(obNew>0?(' · ออกวันนี้ '+obNew):'')+'</div>'
        : '<div class="ag">ออกวันนี้ '+obNew+' ผืน</div>')
        + blist(Q.onboat, 0);
    }
    if(i===2 && t.dirty>0){
      extra=ageLine(Q.dirty, PO_DIRTY_DUE, 'คืนเข้ามาวันนี้', 'เก่าสุดค้างมา {d} วัน')
          + blist(Q.dirty, PO_DIRTY_DUE);
      act='<div class="a"><button class="po-btn pri" onclick="poLaundryOutOpen()"'+(ro?' disabled':'')
        +' title="ส่งซักตัดจากกองเก่าสุดก่อนเสมอ">ส่งซัก '+t.dirty+' ผืน</button></div>';
    }
    if(i===3 && t.laundry>0){
      extra=ageLine(Q.laundry, PO_LAUNDRY_DUE, 'ส่งไปวันนี้', 'ส่งไปแล้ว {d} วัน')
          + blist(Q.laundry, PO_LAUNDRY_DUE);
      act='<div class="a"><button class="po-btn pri" onclick="poLaundryInOpen()"'+(ro?' disabled':'')+'>รับเข้า</button></div>';
    }
    return '<div class="po-fl'+(x[1]?'':' zero')+'" style="--sc:'+x[2]+';--st:'+x[2]+';--sb:'+x[3]+'">'
      +'<div class="t"><b>'+(i+1)+'</b>'+x[0]+'</div>'
      +'<div class="v"'+(x[1]?(' style="color:'+x[2]+'"'):'')+'>'+x[1]+'<em>ผืน</em></div>'+extra+act+'</div>';
  }).join('<div class="po-arw">&#10230;</div>');
  /* §towelQ · เตือนสองฝั่ง · ของเดิมเตือนเฉพาะผ้าที่อยู่ร้านซัก
     ผ้าที่รอส่งซักกองอยู่ที่ท่าเราเองไม่เคยเตือน ทั้งที่เป็นกองที่เราสั่งได้เอง */
  var W=[];
  var lo=Q.laundry.filter(function(b){ return b.date && poDaysAgo(b.date)>PO_LAUNDRY_DUE; });
  if(lo.length) W.push('<b>ผ้าค้างที่ร้านซักนานผิดปกติ</b> — '
    +lo.map(function(b){ return poE(poDShort(b.date))+' '+b.q+' ผืน ('+poDaysAgo(b.date)+' วัน)'; }).join(' · ')
    +' · เกิน '+PO_LAUNDRY_DUE+' วันที่ตั้งไว้ ควรโทรตามร้าน');
  var dv=Q.dirty.filter(function(b){ return b.date && poDaysAgo(b.date)>PO_DIRTY_DUE; });
  if(dv.length) W.push('<b>ผ้ารอส่งซักค้างที่ท่า</b> — '
    +dv.map(function(b){ return poE(poDShort(b.date))+' '+b.q+' ผืน ('+poDaysAgo(b.date)+' วัน)'; }).join(' · ')
    +' · ยังไม่ได้ส่งซัก');
  var warn=W.length?('<div class="po-warn">'+W.join('<br>')+'</div>'):'';
  return '<div class="po-flow">'+flow+'</div>'+warn;
}

function poModal(title, bodyHtml, footHtml, w){
  poModalClose();
  var d=document.createElement('div'); d.id='po-modal';
  d.style.cssText='position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:"DM Sans","Noto Sans Thai",sans-serif';
  d.innerHTML='<div style="background:#fff;border-radius:14px;width:'+(w||620)+'px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.3)">'
    +'<div style="padding:15px 18px;border-bottom:1px solid #E3E3DF;display:flex;align-items:center;justify-content:space-between;gap:12px">'
      +'<div style="font-size:15px;font-weight:800;color:#16265C">'+title+'</div>'
      +'<button onclick="poModalClose()" style="border:none;background:#F0F0EC;border-radius:8px;width:28px;height:28px;font-size:16px;cursor:pointer;color:#5F5E5A">&times;</button></div>'
    +'<div style="padding:16px 18px;overflow:auto;flex:1">'+bodyHtml+'</div>'
    +(footHtml?('<div style="padding:12px 18px;border-top:1px solid #E3E3DF;display:flex;gap:9px;justify-content:flex-end;align-items:center;flex-wrap:wrap">'+footHtml+'</div>'):'')
    +'</div>';
  d.addEventListener('click', function(ev){ if(ev.target===d) poModalClose(); });
  document.body.appendChild(d);
}
function poModalClose(){ var m=document.getElementById('po-modal'); if(m) m.remove(); }
function poBtn(label,fn,pri){ return '<button onclick="'+fn+'" style="border:1px solid '+(pri?'#16265C':'#D8D4CA')+';background:'+(pri?'#16265C':'#fff')+';color:'+(pri?'#fff':'#5F5E5A')+';border-radius:9px;padding:8px 16px;font:700 12.5px inherit;cursor:pointer;font-family:inherit">'+label+'</button>'; }
function poRowCss(){ return 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F0F0EC'; }
function poIn(id,val,ph,w){ return '<input id="'+id+'" value="'+(val==null?'':poE(val))+'" placeholder="'+(ph||'')+'" style="border:1px solid #D8D4CA;border-radius:8px;padding:6px 9px;font:600 12.5px inherit;width:'+(w||70)+'px;font-family:inherit">'; }
function poV(id){ var el=document.getElementById(id); return el?el.value:''; }

function poIsKey(date, boatId){ return date+'::'+boatId; }
function poIsSaved(date, boatId){ var v=PIER_SHEET[poIsKey(date,boatId)]; return (v&&typeof v==='object')?v:null; }
function poIsPax(r){ return (+r.ad||0)+(+r.chd||0)+(+r.foc||0); }   /* ทารกไม่ได้ใช้ของ */
function poIsNum(id){ return poNum(poV(id)); }

/* กระจายจำนวนของประเภทหนึ่งลงไซส์ · ไซส์ที่มีของเยอะสุดก่อน · ไม่เกินที่มี */
function poIsDist(k, need){
  var its=(_poIs.items[k]||[]), out={};
  its.forEach(function(it){ out[it.id]=0; });
  if(!its.length) return out;
  var cap=its.map(function(it){
    var had=_poIs.base[it.id]?_poIs.base[it.id].iss:0;
    return {id:it.id, c:Math.max(0, poBal(it.id).ready+had)};
  });
  var left=Math.max(0, need|0), tot=0;
  cap.forEach(function(x){ tot+=x.c; });
  if(!tot){ out[cap[0].id]=left; return out; }
  /* ปันตามสัดส่วนของที่มีก่อน · เศษไปให้ไซส์ที่เศษมากสุด */
  var frac=cap.map(function(x){
    var raw=left*x.c/tot, q=Math.floor(raw);
    out[x.id]=q; return {id:x.id, f:raw-q, c:x.c};
  });
  var used=0; cap.forEach(function(x){ used+=out[x.id]; });
  frac.sort(function(a,b){ return b.f-a.f || b.c-a.c; });
  for(var i=0; used<left && frac.length; i++){ out[frac[i%frac.length].id]++; used++; }
  /* เกินของที่มีไซส์ไหน ก็ย้ายไปไซส์ที่ยังเหลือ */
  var spill=0;
  cap.forEach(function(x){ if(out[x.id]>x.c){ spill+=out[x.id]-x.c; out[x.id]=x.c; } });
  cap.slice().sort(function(a,b){ return b.c-a.c; }).forEach(function(x){
    if(spill<=0) return;
    var room=x.c-out[x.id]; if(room<=0) return;
    var q=Math.min(room, spill); out[x.id]+=q; spill-=q;
  });
  if(spill>0) out[cap[0].id]+=spill;   /* ของไม่พอจริง ๆ · กองไว้ที่ไซส์แรก ให้ยอดติดลบเห็นชัด */
  return out;
}

/* ── ประกอบแถวตั้งต้น · ใบจองบนลำนี้ + แถวที่ผู้ใช้เพิ่มเองที่เคยบันทึกไว้ ── */
function poIsBuild(bid){
  poKindSync();
  var B=poBoats(_poDate,_poPier).filter(function(x){return x.bid===bid;})[0];
  if(!B) return null;
  var items=poItems(_poPier), S=poBoatSum(_poDate,bid,_poPier), SV=poIsSaved(_poDate,bid);
  var KS=PO_KORDER.filter(function(k){ return items.some(function(it){ return it.kind===k; }); });
  /* §poFix1 · ของที่ปิดใช้งานแล้วแต่ยังมียอดของวันนี้ ต้องมีช่องให้ลง ไม่งั้นยอดยกมาไม่มีที่อยู่ */
  var dead=poItemsAll(_poPier).filter(function(it){
    return it.active===false && S[it.id] && (S[it.id].iss||S[it.id].ret); });
  if(dead.length){ items=items.concat(dead);
    KS=PO_KORDER.filter(function(k){ return items.some(function(it){ return it.kind===k; }); }); }
  var byKind={}; KS.forEach(function(k){ byKind[k]=items.filter(function(it){ return it.kind===k; }); });
  var issued=0; items.forEach(function(it){ if(S[it.id]) issued+=S[it.id].iss; });

  var old={}; if(SV && Array.isArray(SV.rows)) SV.rows.forEach(function(r){ if(r&&r.bkId) old[r.bkId]=r; });
  /* ยอดคืนที่อยู่ในบัญชีสต็อกจริง แยกรายประเภท · ใช้เทียบว่ามีคนไปคืนผ่านหน้าปิดยอดหรือเปล่า */
  var ledRet={}; KS.forEach(function(k){ var n=0;
    byKind[k].forEach(function(it){ n+=(S[it.id]?S[it.id].ret:0); }); ledRet[k]=n; });
  var PT=(typeof bkV2PaxTot==='function')?bkV2PaxTot:function(){return 0;};
  var rows=B.bks.map(function(x){
    var b=x.b, t=x.t, O=(typeof bkOpsRead==='function')?bkOpsRead(b,_poDate):(b.ops||{});
    var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var px=(t&&t.pax)||{}, nm=[];
    (b.passengers||[]).forEach(function(p){ if(p&&p.name) nm.push(String(p.name)); });
    if(!nm.length && b.leadPax) nm.push(String(b.leadPax));
    var van=(O&&O.vanId&&typeof vehGet==='function')?vehGet(O.vanId):null;
    var _PL=poPaxLeft(b,_poDate,t);   /* §poPaxReal · คนที่ไปจริง ไม่ใช่ยอดจอง */
    var R={ id:'bk_'+(b.id||''), bkId:b.id||'', extra:false,
            car:van?(van.name||van.id||''):'',   /* §poOrder · ไว้เรียงให้ตรงกับใบที่พิมพ์ */
            booked:PT(px,'ad')+PT(px,'chd')+PT(px,'inf')+PT(px,'foc'),
            agN:(ag&&ag.name)||(b.agentId?b.agentId:'Love Andaman'),
            agC:poSignColor(b.agentId)||((ag&&ag.color)||''),
            names:nm.length?nm:[String(b.leadPax||'-')],
            sub:[(b.hotelName||b.pickup||''), (van?(van.name||van.id):'')].filter(Boolean).join(' · '),
            ad:_PL.ad, chd:_PL.chd, inf:_PL.inf, foc:_PL.foc,
            iss:{}, ret:{}, dep:0, back:0, cut:0, note:'' };
    var O2=old[R.bkId];
    KS.forEach(function(k){
      /* §poSheet2 · ไม่เติมให้เอง · ของที่แจกจริงกับหัวที่จองไม่เท่ากันเสมอไป
         เติมมาแล้วตรงพอดีเป็นส่วนใหญ่ คนกรอกจะเลื่อนผ่าน แถวที่ไม่ตรงเลยหลุดไปทั้งใบ */
      R.iss[k]=O2?(+((O2.iss||{})[k])||0):0;
      R.ret[k]=O2?(+((O2.ret||{})[k])||0):0;
    });
    if(O2){ R.dep=+O2.dep||0; R.back=+O2.back||0; R.cut=+O2.cut||0; R.note=O2.note||''; }
    return R;
  });
  /* §poOrder · เรียงเฉพาะแถวใบจอง · แถว "ยกมา"/แถวที่หน้าท่าเพิ่มเอง ต่อท้ายทีหลังอยู่แล้ว */
  rows.sort(poRowCmp);
  /* §poFix3 · ยังไม่เคยบันทึกใบนี้ แต่ในบัญชีมียอดของลำนี้อยู่แล้ว (ของเดิม / เบิกจากที่อื่น)
     ยกขึ้นตารางเป็นแถว "ยกมา" ให้ยอดตรงกันตั้งแต่เปิด · ไม่งั้นกดบันทึกครั้งเดียวยอดหายทั้งวัน
     ผู้ใช้ย้ายตัวเลขจากแถวนี้ไปใส่แถวใบจองทีหลังได้ ยอดรวมไม่ขยับ จึงไม่เกิด move ใหม่ */
  if(!SV){
    var cIss={}, cRet={}, anyC=0;
    KS.forEach(function(k){ var a=0, b2=0;
      byKind[k].forEach(function(it){ if(S[it.id]){ a+=S[it.id].iss; b2+=S[it.id].ret; } });
      cIss[k]=a; cRet[k]=b2; anyC+=a+b2; });
    if(anyC){
      var CR={ id:poUid('px_'), bkId:'', extra:true, agN:'ยกมา', agC:'',
               names:['ยอดเดิมในบัญชีสต็อก'], sub:'ยังไม่ได้ระบุว่าเป็นของใบจองไหน',
               ad:0, chd:0, inf:0, foc:0, iss:{}, ret:{}, dep:0, back:0, cut:0,
               note:'ยกมาจากยอดที่บันทึกไว้ก่อนใช้ตารางนี้' };
      KS.forEach(function(k){ CR.iss[k]=cIss[k]; CR.ret[k]=cRet[k]; });
      rows.push(CR);
    }
  }
  if(SV && Array.isArray(SV.rows)) SV.rows.forEach(function(r){
    if(!r || !r.extra) return;
    var R={ id:r.id||poUid('px_'), bkId:'', extra:true, agN:r.agN||'พนักงาน', agC:'',
            names:[r.label||''], sub:'ไม่ผูกกับใบจอง', ad:+r.ad||0, chd:0, inf:0, foc:0,
            iss:{}, ret:{}, dep:+r.dep||0, back:+r.back||0, cut:+r.cut||0, note:r.note||'' };
    KS.forEach(function(k){ R.iss[k]=+((r.iss||{})[k])||0; R.ret[k]=+((r.ret||{})[k])||0; });
    rows.push(R);
  });

  /* ไซส์ · เคยเบิกไปแล้ววันนี้ก็ยกตัวเลขจริงมา · ยังไม่เคยก็เกลี่ยจากของที่มี */
  var size={}, rsz={};
  _poIs={ bid:bid, B:B, KS:KS, items:byKind, base:S, rows:rows, size:size, rsz:rsz, all:items,
          cy:(typeof poBoatCarry==='function')?poBoatCarry(_poDate,bid):{},
          ledRet:ledRet, wrote:(SV&&SV.wrote&&typeof SV.wrote==='object')?SV.wrote:null };
  KS.forEach(function(k){
    size[k]={};
    var need=0; rows.forEach(function(r){ need+=(+r.iss[k]||0); });
    var saved=(SV&&SV.size&&SV.size[k])?SV.size[k]:null;
    if(saved){ byKind[k].forEach(function(it){ size[k][it.id]=+saved[it.id]||0; }); }
    else if(issued){ byKind[k].forEach(function(it){ size[k][it.id]=S[it.id]?S[it.id].iss:0; }); }
    else size[k]=poIsDist(k, need);
    /* §poRetSplit · ฝั่งคืนแยกรายชิ้นเหมือนฝั่งเบิก
       ใบเก่าที่ยังไม่มี rsz · ตั้งต้นจากยอดคืนที่อยู่ในบัญชีสต็อกจริง ส่วนต่างจึงเป็นศูนย์ */
    rsz[k]={};
    var savedR=(SV&&SV.rsz&&SV.rsz[k])?SV.rsz[k]:null;
    byKind[k].forEach(function(it){
      rsz[k][it.id]= savedR ? (+savedR[it.id]||0) : (S[it.id]?S[it.id].ret:0); });
  });
  return _poIs;
}

/* ── อ่านทุกช่องกลับเข้า state · เรียกก่อนทุกครั้งที่จะวาดใหม่หรือบันทึก ── */
function poIsRead(){
  if(!_poIs) return;
  _poIs.rows.forEach(function(r,i){
    if(!document.getElementById('poid_'+i)) return;
    _poIs.KS.forEach(function(k){
      r.iss[k]=poIsNum('pois_'+i+'_'+k);
      r.ret[k]=poIsNum('poir_'+i+'_'+k);
    });
    r.dep=poIsNum('poid_'+i); r.back=poIsNum('poib_'+i); r.cut=poIsNum('poic_'+i);
    r.note=poV('poin_'+i);
    if(r.extra){ r.names=[poV('poil_'+i)]; r.ad=poIsNum('poia_'+i); }
  });
  _poIs.KS.forEach(function(k){
    (_poIs.items[k]||[]).forEach(function(it){
      if(document.getElementById('poiz_'+it.id))  _poIs.size[k][it.id]=poIsNum('poiz_'+it.id);
      if(document.getElementById('poirz_'+it.id)) _poIs.rsz[k][it.id]=poIsNum('poirz_'+it.id);   /* §poRetSplit */
    });
  });
}
/* §poRetSplit · ของชิ้นนี้ยังอยู่กับเรืออีกกี่ชิ้น · ค้างจากวันก่อน + เบิกวันนี้ − คืน/ซ่อม/ทิ้ง/หาย */
function poIsOut(it){
  var o=(_poIs.base||{})[it.id]||{iss:0,ret:0,rep:0,wo:0,lost:0,ob:0};
  var k=it.kind, cy=(_poIs.cy||{})[it.id]||0;
  var iss=+(((_poIs.size||{})[k]||{})[it.id])||0;
  var ret=+(((_poIs.rsz ||{})[k]||{})[it.id])||0;
  return cy+iss-(ret+o.rep+o.wo+o.lost+o.ob);
}

function poIsRowState(r, KS){
  var ti=0, tr=0;
  KS.forEach(function(k){ ti+=(+r.iss[k]||0); tr+=(+r.ret[k]||0); });
  if(!ti) return {t:'—', c:'mut'};
  if(tr>=ti) return {t:'ครบ', c:'g'};
  if(tr>0)   return {t:'ขาด '+(ti-tr), c:'a'};
  return {t:'รอคืน', c:'b'};
}

/* ── คิดยอดสด · แถวรวม / ป้ายสถานะ / แถบไซส์ / การ์ดเงิน ── */
function poIsCalc(){
  if(!_poIs) return;
  poIsRead();
  var KS=_poIs.KS, rows=_poIs.rows;
  var pax=0, tI={}, tR={}, dep=0, back=0, cut=0, nDep=0, nBack=0, waiting=0, elsewhere=[];
  KS.forEach(function(k){ tI[k]=0; tR[k]=0; });
  rows.forEach(function(r,i){
    pax+=poIsPax(r);
    KS.forEach(function(k){ tI[k]+=(+r.iss[k]||0); tR[k]+=(+r.ret[k]||0); });
    dep+=r.dep; back+=r.back; cut+=r.cut;
    if(r.dep>0) nDep++;
    if(r.back>0) nBack++;
    var st=poIsRowState(r,KS);
    if(st.c==='b'||st.c==='a') waiting++;
    var el=document.getElementById('poist_'+i);
    if(el) el.innerHTML='<span class="poi-pill '+st.c+'">'+poE(st.t)+'</span>';
  });
  var el=document.getElementById('poitp'); if(el) el.textContent=pax;
  KS.forEach(function(k){
    var a=document.getElementById('poiti_'+k);
    if(a){ a.textContent=tI[k]; a.className=tI[k]===pax?'ok':(tI[k]?'warn':''); }
    var b=document.getElementById('poitr_'+k);
    if(b){ b.textContent=tR[k]; b.className=(tI[k]&&tR[k]>=tI[k])?'ok':(tR[k]?'warn':''); }
    var lw=(_poIs.wrote&&_poIs.wrote.ret&&_poIs.wrote.ret[k]!=null)?(+_poIs.wrote.ret[k]||0):0;
    if(((_poIs.ledRet||{})[k]||0)>lw) elsewhere.push(PO_KIND[k].t+' '+(((_poIs.ledRet||{})[k]||0)-lw));
    /* แถบไซส์ · ต้องรวมได้เท่ายอดเบิกของประเภทนั้น */
    var z=0, zr=0;
    (_poIs.items[k]||[]).forEach(function(it){ z+=(+_poIs.size[k][it.id]||0); zr+=(+_poIs.rsz[k][it.id]||0); });
    var sb=document.getElementById('poizs_'+k);
    if(sb){
      var ok=(z===tI[k]);
      sb.className='poi-zs '+(ok?'ok':'no');
      sb.textContent=ok?('เบิก '+z+' ✓'):('เบิก '+z+' / '+tI[k]+' · '+(z<tI[k]?('ขาด '+(tI[k]-z)):('เกิน '+(z-tI[k]))));
    }
    /* §poRetSplit · ฝั่งคืนก็ต้องตรงกับตารางเหมือนกัน */
    var rb=document.getElementById('poizr_'+k);
    if(rb){
      var okr=(zr===tR[k]);
      rb.className='poi-zs '+(okr?'ok':'no');
      rb.textContent=okr?('คืน '+zr+' ✓'):('คืน '+zr+' / '+tR[k]+' · '+(zr<tR[k]?('ขาด '+(tR[k]-zr)):('เกิน '+(zr-tR[k]))));
    }
    /* §poRetSplit · ของที่ยังอยู่กับเรือ รายชิ้น · เห็นตั้งแต่ตรงนี้ ไม่ต้องรอหน้าปิดยอด */
    (_poIs.items[k]||[]).forEach(function(it){
      var u=document.getElementById('poizl_'+it.id); if(!u) return;
      var left=poIsOut(it), un=(PO_KIND[k]||{u:'ชิ้น'}).u;
      u.className=(left>0?'w':(left<0?'x':''));
      u.textContent=(left>0)?('ค้าง '+left+' '+un):((left<0)?('คืนเกิน '+(-left)):'ครบ · ไม่ค้าง');
    });
  });
  var set=function(id,v){ var x=document.getElementById(id); if(x) x.innerHTML=v; };
  set('poimd', poBaht(dep));      set('poimdn', nDep+' แถว');
  set('poimb', poBaht(back));     set('poimbn', nBack+' แถว');
  set('poimc', poBaht(cut));      set('poimcn', cut?'หักจากมัดจำ':'ยังไม่มี');
  set('poimo', poBaht(dep-back-cut)); set('poimon', waiting+' แถวยังไม่ปิด');
  set('poitd', poBaht(dep)); set('poitb', poBaht(back)); set('poitc', poBaht(cut));
  set('poitn', waiting?('ค้างคืน '+waiting+' แถว'):'ปิดครบทุกแถว');
  /* ของที่คืนผ่านหน้า "ปิดยอด" ไม่รู้ว่าเป็นของแถวไหน · บอกไว้ตรง ๆ ดีกว่าปล่อยให้ตัวเลขสองที่ไม่ตรงกันเงียบ ๆ */
  var ew=document.getElementById('poi-ew');
  if(ew){
    ew.style.display=elsewhere.length?'block':'none';
    ew.innerHTML=elsewhere.length?('บัญชีสต็อกมีของคืนเข้ามาจากหน้า <b>ปิดยอด</b> อีก '+poE(elsewhere.join(' · '))
      +' · ตารางนี้ไม่รู้ว่าเป็นของแถวไหน จึงไม่นับให้ · กรอกฝั่งคืนในตารางเพิ่มได้ตามปกติ ไม่ทับกัน'):'';
  }
}

function poIsAuto(k){
  poIsRead();
  var need=0; _poIs.rows.forEach(function(r){ need+=(+r.iss[k]||0); });
  var d=poIsDist(k, need);
  (_poIs.items[k]||[]).forEach(function(it){
    _poIs.size[k][it.id]=d[it.id]||0;
    var el=document.getElementById('poiz_'+it.id); if(el) el.value=d[it.id]||0;
  });
  poIsCalc();
}

/* §poRetSplit · วันที่ของกลับครบ · เติมให้เท่าที่ยังค้างอยู่ทุกชิ้น จะได้ไม่ต้องพิมพ์ทีละช่อง */
function poIsAutoR(k){
  poIsRead();
  (_poIs.items[k]||[]).forEach(function(it){
    var o=(_poIs.base||{})[it.id]||{rep:0,wo:0,lost:0,ob:0};
    var full=Math.max(0, ((_poIs.cy||{})[it.id]||0)+(+_poIs.size[k][it.id]||0)-(o.rep+o.wo+o.lost+o.ob));
    _poIs.rsz[k][it.id]=full;
    var el=document.getElementById('poirz_'+it.id); if(el) el.value=full;
  });
  poIsCalc();
}
function poIsAddRow(){
  poIsRead();
  var R={ id:poUid('px_'), bkId:'', extra:true, agN:'พนักงาน', agC:'',
          names:[''], sub:'ไม่ผูกกับใบจอง', ad:0, chd:0, inf:0, foc:0,
          iss:{}, ret:{}, dep:0, back:0, cut:0, note:'' };
  _poIs.KS.forEach(function(k){ R.iss[k]=0; R.ret[k]=0; });
  _poIs.rows.push(R);
  poIsRender();
  var el=document.getElementById('poil_'+(_poIs.rows.length-1)); if(el) el.focus();
}
function poIsDelRow(i){
  poIsRead();
  if(!_poIs.rows[i] || !_poIs.rows[i].extra) return;
  _poIs.rows.splice(i,1); poIsRender();
}

/* ── HTML ── */
function poIsCss(){
  var H='#po-modal .poi';
  return '<style>'
  +H+'{font-family:inherit}'
  +H+' .hint{font-size:11.5px;color:#7C8091;line-height:1.7;margin-bottom:11px}'
  +H+' .hint b{color:#16265C;font-weight:800}'
  +H+' .tw{border:1px solid #E3E3DF;border-radius:12px;overflow:auto}'
  +H+' table{width:100%;border-collapse:collapse;min-width:1060px}'
  +H+' th,td{border-right:1px solid #EDEDE8;border-bottom:1px solid #EDEDE8}'
  +H+' th{background:#FAF9F5;font-size:9.5px;font-weight:800;color:#16265C;letter-spacing:.03em;'
     +'padding:6px 5px;text-align:center;white-space:nowrap;position:sticky;top:0;z-index:2}'
  +H+' th.l{text-align:left;padding-left:10px}'
  +H+' th.gp{background:#EEF6F1;color:#0F6E56}'
  +H+' th.gr{background:#EAF1FB;color:#185FA5}'
  +H+' th.gm{background:#FBF2E4;color:#B4560A}'
  +H+' td{padding:4px 5px;font-size:12px;vertical-align:middle;text-align:center}'
  +H+' td.nm{text-align:left;padding-left:10px;line-height:1.4}'
  +H+' td.nm span{display:block;font-size:11.5px;font-weight:600;color:#2c2c2a}'
  +H+' td.nm small{display:block;font-size:10px;color:#8a8a82;font-weight:400}'
  +H+' td.agc{padding:3px 5px}'
  +H+' .agp{font-size:10.5px;font-weight:800;border-radius:6px;padding:3px 7px;display:inline-block;line-height:1.25;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}'
  +H+' tr.ex td{background:#FCFAF4}'
  +H+' tr.tot td{background:#F5F7FB;font-weight:800;border-top:2px solid #C9D3E8;font-size:12.5px}'
  +H+' tr.tot td.ok,'+H+' tr.tot .ok{background:#ECFDF5;color:#047857}'
  +H+' tr.tot td.warn,'+H+' tr.tot .warn{background:#FDF3E3;color:#B4560A}'
  +H+' input.q{width:44px;border:1px solid #D8D4CA;border-radius:7px;padding:4px 2px;text-align:center;'
     +'font:700 12.5px "DM Mono",monospace;background:#fff;font-family:"DM Mono",monospace}'
  +H+' input.q:focus{outline:none;border-color:#16265C;box-shadow:0 0 0 2px #16265C22}'
  +H+' input.q.pk{border-color:#B7D9C9;background:#FBFEFC}'
  +H+' input.q.rt{border-color:#BFD3EC;background:#FBFCFE}'
  +H+' input.m{width:66px;border:1px solid #E0C79A;border-radius:7px;padding:4px 5px;text-align:right;'
     +'font:700 12.5px "DM Mono",monospace;background:#FFFDF8;font-family:"DM Mono",monospace}'
  +H+' input.tx{width:100%;min-width:96px;border:1px solid #E6E4DD;border-radius:7px;padding:4px 7px;'
     +'font:500 11.5px inherit;background:#fff;font-family:inherit}'
  +H+' .poi-pill{font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 9px;display:inline-block;white-space:nowrap}'
  +H+' .poi-pill.g{background:#ECFDF5;color:#047857}'
  +H+' .poi-pill.a{background:#FDF3E3;color:#B4560A}'
  +H+' .poi-pill.b{background:#EAF1FB;color:#2A5EA8}'
  +H+' .poi-pill.mut{background:#F2F2EE;color:#9A9A93}'
  +H+' .add{display:flex;gap:8px;align-items:center;padding:9px 10px;background:#FAF9F5;border-top:1px dashed #D8D4CA;flex-wrap:wrap}'
  +H+' .add .tip{font-size:11px;color:#7C8091}'
  +H+' .xb{border:none;background:none;color:#C0271C;font-size:15px;cursor:pointer;line-height:1;padding:0 2px}'
  +H+' .ew{margin-top:9px;background:#FDF3E3;border:1px solid #F0D8A8;border-radius:10px;padding:8px 12px;'
     +'font-size:11px;color:#7A4A00;line-height:1.6}'
  +H+' .sz{margin-top:13px;border:1px solid #E3E3DF;border-radius:12px;overflow:hidden}'
  +H+' .szh{background:#FAF9F5;padding:9px 12px;border-bottom:1px solid #EDEDE8}'
  +H+' .szh b{font-size:12px;font-weight:800;color:#16265C}'
  +H+' .szh p{margin:2px 0 0;font-size:10.5px;color:#7C8091;line-height:1.6}'
  +H+' .szr{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #F2F2EE}'
  +H+' .szr:last-child{border-bottom:0}'
  +H+' .szk{font-size:11.5px;font-weight:800;min-width:74px}'
  +H+' .szi{display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #E6E4DD;border-radius:8px;padding:3px 6px}'
  /* §poRetSplit · หนึ่งกล่อง = หนึ่งลาย · มีทั้งเบิกและคืน แล้วบอกว่าค้างเท่าไหร่ */
  +H+' .szi2{display:flex;flex-direction:column;gap:4px;background:#fff;border:1px solid #E6E4DD;border-radius:10px;padding:6px 9px 7px}'
  +H+' .szi2 label{font-size:10.5px;font-weight:700;color:#3a3a36;white-space:nowrap}'
  +H+' .szi2 .bx{display:flex;gap:6px;align-items:center}'
  +H+' .szi2 .b1{display:flex;align-items:center;gap:4px;border:1px solid #E6E4DD;border-radius:7px;padding:2px 5px}'
  +H+' .szi2 .b1.p{background:#F7FAFF;border-color:#D6E2F5}'
  +H+' .szi2 .b1.r{background:#F6FBF8;border-color:#CFE9DF}'
  +H+' .szi2 .b1 i{font-style:normal;font-size:9.5px;font-weight:700;color:#7C8091}'
  +H+' .szi2 .b1 input{width:36px;border:none;text-align:center;font:800 12.5px "DM Mono",monospace;background:none;outline:none;font-family:"DM Mono",monospace}'
  +H+' .szi2 u{text-decoration:none;font-size:9.5px;font-weight:700;color:#9A9A93}'
  +H+' .szi2 u.w{color:#B4560A}'
  +H+' .szi2 u.x{color:#C0271C}'
  +H+' .szbs{display:flex;gap:5px}'
  +H+' .szi label{font-size:10px;color:#7C8091;white-space:nowrap}'
  +H+' .szi input{width:40px;border:none;text-align:center;font:700 12px "DM Mono",monospace;background:none;outline:none;font-family:"DM Mono",monospace}'
  +H+' .poi-zs{font-size:11px;font-weight:700;border-radius:999px;padding:3px 11px}'
  +H+' .poi-zs.ok{background:#ECFDF5;color:#047857}'
  +H+' .poi-zs.no{background:#FDF3E3;color:#B4560A}'
  +H+' .szb{border:1px solid #D8D4CA;background:#fff;border-radius:8px;padding:4px 10px;font:700 11px inherit;'
     +'color:#16265C;cursor:pointer;font-family:inherit}'
  +H+' .mny{margin-top:13px;display:flex;gap:9px;flex-wrap:wrap}'
  +H+' .mc{flex:1;min-width:142px;background:#FFFDF8;border:1px solid #EBD9B4;border-radius:11px;padding:9px 12px}'
  +H+' .mc small{display:block;font-size:10px;color:#8a7550;font-weight:700;letter-spacing:.03em}'
  +H+' .mc b{display:block;font-size:17px;font-weight:800;color:#B4560A;font-family:"DM Mono",monospace;margin-top:2px}'
  +H+' .mc u{display:block;text-decoration:none;font-size:10.5px;color:#8a7550;margin-top:1px}'
  +H+' .mc.o{background:#F5F7FB;border-color:#C9D3E8}'
  +H+' .mc.o small,'+H+' .mc.o u{color:#5A6B8C}'
  +H+' .mc.o b{color:#16265C}'
  +'</style>';
}

function poIsInner(){
  var e=poE, KS=_poIs.KS, B=_poIs.B, nk=KS.length;
  var h='<div class="hint">กรอกเฉพาะจำนวนที่<b>เบิกเพิ่ม</b>วันนี้ · เบิกระหว่างวันได้ '
   +'· ช่องฝั่ง<b>คืน</b>เว้นว่างไว้ตอนเช้า เย็นค่อยกลับมากรอก<br>'
   +'ทุกช่องเริ่มจากว่าง · กรอกตามของที่แจกจริง ไม่ใช่ตามจำนวนคนในใบจอง<br>'
   +'ตัวเลขชุดนี้เป็นชุดเดียวกับที่ขึ้นใบเซ็น · กรอกที่นี่แล้วไม่ต้องกรอกซ้ำอีกรอบ</div>';

  h+='<div class="tw"><table><thead><tr>'
   +'<th class="l" rowspan="2" style="min-width:106px">Agent</th>'
   +'<th class="l" rowspan="2" style="min-width:162px">ชื่อลูกค้า</th>'
   +'<th rowspan="2">AD</th><th rowspan="2">CHD</th><th rowspan="2">INF</th><th rowspan="2">FOC</th>'
   +'<th class="gp" colspan="'+(nk+1)+'">เบิก · Pick-up</th>'
   +'<th class="gr" colspan="'+(nk+1)+'">คืน · Return</th>'
   +'<th class="gm" colspan="2">เงิน</th>'
   +'<th rowspan="2" style="min-width:104px">หมายเหตุ</th></tr><tr>'
   +KS.map(function(k){ return '<th class="gp">'+e(PO_KIND[k].t)+'</th>'; }).join('')
   +'<th class="gp">มัดจำ ฿</th>'
   +KS.map(function(k){ return '<th class="gr">'+e(PO_KIND[k].t)+'</th>'; }).join('')
   +'<th class="gr">คืนมัดจำ ฿</th>'
   +'<th class="gm">หัก ฿</th><th class="gm" style="min-width:64px">สถานะ</th>'
   +'</tr></thead><tbody>';

  h+=_poIs.rows.map(function(r,i){
    var ink=(r.agC&&typeof bkV2ContrastInk==='function')?bkV2ContrastInk(r.agC):'#2c2c2a';
    var chip='<span class="agp" style="background:'+e(r.agC||'#F2F2EE')+';color:'+(r.agC?ink:'#5F5E5A')+'">'+e(r.agN)+'</span>';
    var nm = r.extra
      ? ('<input class="tx" id="poil_'+i+'" value="'+e(r.names[0]||'')+'" placeholder="ไกด์ / สตาฟ / ลูกค้านอกใบจอง">'
         +'<small>'+e(r.sub)+'</small>')
      : (r.names.slice(0,3).map(function(x){ return '<span>'+e(x)+'</span>'; }).join('')
         +(r.names.length>3?('<span>+'+(r.names.length-3)+'</span>'):'')
         +(r.sub?('<small>'+e(r.sub)+'</small>'):''));
    var pax = r.extra
      ? ('<td><input class="q" id="poia_'+i+'" value="'+(r.ad||'')+'" oninput="poIsCalc()"></td><td>—</td><td>—</td><td>—</td>')
      : ('<td>'+(r.ad||'')+'</td><td>'+(r.chd||'')+'</td><td>'+(r.inf||'')+'</td><td>'+(r.foc||'')+'</td>');
    return '<tr'+(r.extra?' class="ex"':'')+'>'
      +'<td class="agc">'+chip+(r.extra?('<button class="xb" title="ลบแถวนี้" onclick="poIsDelRow('+i+')">&times;</button>'):'')+'</td>'
      +'<td class="nm">'+nm+'</td>'+pax
      +KS.map(function(k){ return '<td><input class="q pk" id="pois_'+i+'_'+k+'" value="'+(r.iss[k]||'')+'" oninput="poIsCalc()"></td>'; }).join('')
      +'<td><input class="m" id="poid_'+i+'" value="'+(r.dep||'')+'" oninput="poIsCalc()"></td>'
      +KS.map(function(k){ return '<td><input class="q rt" id="poir_'+i+'_'+k+'" value="'+(r.ret[k]||'')+'" oninput="poIsCalc()"></td>'; }).join('')
      +'<td><input class="m" id="poib_'+i+'" value="'+(r.back||'')+'" oninput="poIsCalc()"></td>'
      +'<td><input class="m" id="poic_'+i+'" value="'+(r.cut||'')+'" oninput="poIsCalc()"></td>'
      +'<td id="poist_'+i+'"></td>'
      +'<td><input class="tx" id="poin_'+i+'" value="'+e(r.note||'')+'"></td>'
      +'</tr>';
  }).join('');

  h+='<tr class="tot"><td class="nm" colspan="2">รวม · '+_poIs.rows.length+' แถว</td>'
   +'<td colspan="4"><span id="poitp"></span> คน</td>'
   +KS.map(function(k){ return '<td><span id="poiti_'+k+'"></span></td>'; }).join('')
   +'<td id="poitd"></td>'
   +KS.map(function(k){ return '<td><span id="poitr_'+k+'"></span></td>'; }).join('')
   +'<td id="poitb"></td><td id="poitc"></td><td>—</td>'
   +'<td class="nm" id="poitn"></td></tr>';
  h+='</tbody></table>'
   +'<div class="add"><button class="szb" onclick="poIsAddRow()">+ เพิ่มแถว (พนักงาน / ลูกค้านอกใบจอง)</button>'
   +'<span class="tip">แถวที่เพิ่มเองไม่ผูกกับใบจอง แต่ยังตัดสต็อกและนับเงินตามปกติ</span></div></div>'
   +'<div class="ew" id="poi-ew" style="display:none"></div>';

  /* ── แยกลาย / ไซส์ · §poRetSplit · ทั้งฝั่งเบิกและฝั่งคืน ── */
  h+='<div class="sz"><div class="szh"><b>แยกลาย / ไซส์ เพื่อตัดสต็อก</b>'
   +'<p>ตารางข้างบนนับ<b>รายประเภท</b>เหมือนใบเซ็น · สต็อกเก็บ<b>รายลาย/รายไซส์</b> จึงต้องบอกอีกทีว่ายอดรวมเป็นลายไหนบ้าง<br>'
   +'กรอกทั้งฝั่ง<b>เบิก</b>และฝั่ง<b>คืน</b> · ระบบไม่เกลี่ยยอดคืนให้เอง จะได้รู้ว่าของที่หายเป็นลายไหนจริง ๆ<br>'
   +'ป้ายท้ายแถวเขียวเมื่อยอดตรงกับตารางข้างบน · ตัวเลขใต้กล่องคือของที่ยังอยู่กับเรือ</p></div>';
  h+=KS.map(function(k){
    var K=PO_KIND[k];
    return '<div class="szr"><span class="szk" style="color:'+e(K.c)+'">'+e(K.t)+'</span>'
      +(_poIs.items[k]||[]).map(function(it){
          var lb=String(it.label||'').replace(K.t,'').replace(/^\s*[·\-]\s*/,'') || it.label;
          return '<span class="szi2" title="'+e(it.label)+' · พร้อมใช้ '+poBal(it.id).ready+'">'
            +'<label>'+e(lb)+'</label>'
            +'<span class="bx">'
              +'<span class="b1 p"><i>เบิก</i><input id="poiz_'+it.id+'" value="'+(_poIs.size[k][it.id]||0)+'" oninput="poIsCalc()"></span>'
              +'<span class="b1 r"><i>คืน</i><input id="poirz_'+it.id+'" value="'+(_poIs.rsz[k][it.id]||0)+'" oninput="poIsCalc()"></span>'
            +'</span><u id="poizl_'+it.id+'"></u></span>';
        }).join('')
      +'<span class="szbs"><button class="szb" onclick="poIsAuto(\''+e(k)+'\')" title="เกลี่ยยอดเบิกตามของที่มีในสต็อก">เกลี่ยเบิก</button>'
      +'<button class="szb" onclick="poIsAutoR(\''+e(k)+'\')" title="ของกลับครบทุกชิ้น · เติมยอดคืนให้เท่าที่ค้างอยู่">คืนครบ</button></span>'
      +'<span class="poi-zs" id="poizs_'+k+'"></span>'
      +'<span class="poi-zs" id="poizr_'+k+'"></span></div>';
  }).join('');
  h+='</div>';

  /* ── เงินมัดจำ · บันทึกของหน้าท่าอย่างเดียว ── */
  h+='<div class="mny">'
   +'<div class="mc"><small>รับมัดจำวันนี้</small><b id="poimd"></b><u id="poimdn"></u></div>'
   +'<div class="mc"><small>คืนมัดจำแล้ว</small><b id="poimb"></b><u id="poimbn"></u></div>'
   +'<div class="mc"><small>หักไว้ (ของหาย/เสีย)</small><b id="poimc"></b><u id="poimcn"></u></div>'
   +'<div class="mc o"><small>ค้างคืนลูกค้า</small><b id="poimo"></b><u id="poimon"></u></div>'
   +'</div>'
   +'<div class="hint" style="margin:9px 0 0">เงินมัดจำในตารางนี้เป็น<b>บันทึกของหน้าท่า</b> ไว้ให้รู้ว่าใครวางเท่าไหร่ ได้คืนไปแล้วหรือยัง · ไม่ได้ไหลเข้าระบบบัญชี</div>';
  return h;
}

function poIsRender(){
  var el=document.getElementById('poi-wrap');
  if(!el) return;
  el.innerHTML=poIsInner();
  poIsCalc();
}

function poIssueOpen(bid){
  if(!poCanEdit()) return;
  if(!poIsBuild(bid)) return;
  var B=_poIs.B;
  var PD=poSheetPending(_poDate,bid);
  var head='<div style="font-size:11.5px;color:#7C8091;margin:-4px 0 10px">'
    +poE((B.route&&B.route.name)||'')+(B.dep?(' · ออก '+poE(B.dep)):'')+' · '+poE(_poDate)
    /* §poPaxReal · โชว์ยอดที่ไปจริง · ต่างจากยอดจองเมื่อไหร่ ค่อยบอกทั้งสองเลข
       ไม่งั้นคนอ่านไม่รู้ว่าเลขที่เห็นคือ "จองไว้" หรือ "ไปจริง" */
    +' · <b style="color:#16265C">ลูกค้า '+(B.paxReal!=null?B.paxReal:B.pax)+' ท่าน · '+B.bks.length+' ใบจอง</b>'
    +((B.paxReal!=null && B.paxReal!==B.pax)
        ? ('<span style="margin-left:8px;background:#FCEBEB;border:1px solid #E6C9C3;color:#A32D2D;'
          +'border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800" '
          +'title="ยอดจอง '+B.pax+' คน · ไม่ได้ไป '+(B.pax-B.paxReal)+' คน (No-show / ยกเลิกหน้างาน) '
          +'· ตัวเลขในตารางเป็นคนที่ไปจริง">จอง '+B.pax+' · ไม่ได้ไป '+(B.pax-B.paxReal)+'</span>')
        : '')
    +(PD?('<span style="margin-left:9px;background:#FEF6E7;border:1px solid #EFD9AE;color:#8A5A00;'
        +'border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800">ร่าง · ยังไม่ตัดสต็อก</span>'):'')
    +'</div>';
  poModal('เบิก–คืน · '+poE(B.boat.name||bid),
    poIsCss()+'<div class="poi">'+head+'<div id="poi-wrap"></div></div>',
    '<div style="flex:1;font-size:11px;color:#7C8091;line-height:1.5">'
      +'<b style="color:#16265C">บันทึกร่าง</b> เก็บที่กรอกไว้เฉย ๆ สต็อกไม่ขยับ · '
      +'<b style="color:#16265C">ยืนยัน</b> ถึงจะตัดสต็อกจริง</div>'
    +poBtn('ยกเลิก','poModalClose()')
    +poBtn('พิมพ์ใบเซ็นจากตารางนี้',"poIsPrint('"+bid+"')")
    +poBtn('บันทึกร่าง',"poIssueDraft('"+bid+"')")
    +poBtn('ยืนยัน · ตัดสต็อก',"poIssueSave('"+bid+"')",1), 1240);
  poIsRender();
}

/* ── บันทึก · ใบเบิกเก็บตามที่กรอก · สต็อกเขียนเป็นส่วนต่างจากที่เคยบันทึกไว้แล้ว ── */
/* ใบร่างที่ยังไม่ได้ตัดสต็อก · เทียบใบที่บันทึกไว้กับบัญชีจริง
   คืน null เมื่อยอดในใบตรงกับบัญชีแล้ว (ยืนยันไปแล้ว หรือไม่มีอะไรค้าง) */
function poSheetPending(date, bid){
  var SH=PIER_SHEET[poIsKey(date,bid)]; if(!SH) return null;
  var pier=SH.pier||_poPier, S=poBoatSum(date, bid, pier), n=0, dI=0, dR=0;
  var byK={}; poItemsAll(pier).forEach(function(it){ (byK[it.kind]=byK[it.kind]||[]).push(it.id); });
  var rI={}, rR={};
  (SH.rows||[]).forEach(function(r){
    Object.keys(r.iss||{}).forEach(function(k){ rI[k]=(rI[k]||0)+(+r.iss[k]||0); });
    Object.keys(r.ret||{}).forEach(function(k){ rR[k]=(rR[k]||0)+(+r.ret[k]||0); }); });
  Object.keys(rI).forEach(function(k){
    var led=0; (byK[k]||[]).forEach(function(id){ led+=(S[id]?S[id].iss:0); });
    var d=rI[k]-led; if(d){ n++; dI+=d; } });
  var W=(SH.wrote&&SH.wrote.ret)||{};
  Object.keys(rR).forEach(function(k){ var d=rR[k]-(+W[k]||0); if(d){ n++; dR+=d; } });
  return n ? {n:n, iss:dI, ret:dR} : null;
}
/* mode · 'draft' = เก็บใบอย่างเดียว · อย่างอื่น = ตรวจครบแล้วเขียนลงบัญชี */
function poIsCommit(bid, mode){
  if(!_poIs || _poIs.bid!==bid) return false;
  poIsRead();
  var KS=_poIs.KS, S=_poIs.base, over=[];
  var DRAFT=(mode==='draft');

  /* §poDraft · ร่างไม่ตรวจอะไรทั้งนั้น · กรอกค้างไว้ครึ่งใบก็ต้องเซฟได้
     ของเดิมที่เคยเขียนลงบัญชีไว้แล้วไม่ถูกแตะ (wrote คงไว้ตามเดิม) */
  if(DRAFT){
    var OLD=poIsSaved(_poDate,bid);
    PIER_SHEET[poIsKey(_poDate,bid)]={
      pier:_poPier, boatId:bid, date:_poDate, at:new Date().toISOString(), by:poWho(),
      size:JSON.parse(JSON.stringify(_poIs.size)),
      rsz:JSON.parse(JSON.stringify(_poIs.rsz)),                       /* §poRetSplit */
      wrote:(OLD&&OLD.wrote)?OLD.wrote:null,
      rows:poIsRowsOut()
    };
    poPersist();
    return true;
  }

  /* 1 · ตรวจไซส์ให้ตรงกับตารางก่อน · ไม่ตรงแปลว่าสต็อกจะเพี้ยนทันที */
  var bad=[];
  KS.forEach(function(k){
    var need=0; _poIs.rows.forEach(function(r){ need+=(+r.iss[k]||0); });
    var got=0; (_poIs.items[k]||[]).forEach(function(it){ got+=(+_poIs.size[k][it.id]||0); });
    if(got!==need) bad.push(PO_KIND[k].t+' · เบิก · ตาราง '+need+' แต่แยกลายได้ '+got);
    /* §poRetSplit · ฝั่งคืนก็ต้องตรง · ไม่งั้นสต็อกรายลายเพี้ยนทันทีเหมือนกัน */
    var needR=0; _poIs.rows.forEach(function(r){ needR+=(+r.ret[k]||0); });
    var gotR=0; (_poIs.items[k]||[]).forEach(function(it){ gotR+=(+_poIs.rsz[k][it.id]||0); });
    if(gotR!==needR) bad.push(PO_KIND[k].t+' · คืน · ตาราง '+needR+' แต่แยกลายได้ '+gotR);
  });
  if(bad.length){
    alert('ยอดแยกลาย/ไซส์ยังไม่ตรงกับตาราง · แก้ให้ตรงก่อนบันทึก\n\n'+bad.join('\n')
      +'\n\n(ปุ่ม "เกลี่ยเบิก" และ "คืนครบ" ช่วยเติมให้ได้)');
    return false;
  }

  /* 2 · ส่วนต่างฝั่งเบิก · รายไซส์ตรง ๆ */
  var plan=[];
  KS.forEach(function(k){
    (_poIs.items[k]||[]).forEach(function(it){
      var tgt=+_poIs.size[k][it.id]||0, had=S[it.id]?S[it.id].iss:0, d=tgt-had;
      if(!d) return;
      if(d>0 && d>poBal(it.id).ready) over.push(it.label+' (พร้อมใช้ '+poBal(it.id).ready+' · จะเบิกเพิ่ม '+d+')');
      plan.push({itemId:it.id, type:'issue', qty:d});
    });
  });
  if(over.length && !confirm('เบิกเกินจำนวนที่พร้อมใช้:\n'+over.join('\n')
      +'\n\nบันทึกต่อไหม? (ยอดพร้อมใช้จะติดลบ ให้ไปปรับยอดทีหลัง)')) return false;

  /* 3 · ส่วนต่างฝั่งคืน · §poRetSplit · รายลาย/ไซส์ตรง ๆ · ระบบไม่เดาให้แล้ว
     ของที่หายผูกกับค่าปรับและทะเบียนรายลาย · เกลี่ยให้เท่ากับสร้างตัวเลขที่ไม่มีอยู่จริง */
  /* §poFix2 · ของที่ค้างจากวันก่อนนับเป็นของที่ยังอยู่กับลำนี้ */
  var CY=poBoatCarry(_poDate,bid);
  var WR=(_poIs.wrote && _poIs.wrote.rsz && typeof _poIs.wrote.rsz==='object')?_poIs.wrote.rsz:null;
  KS.forEach(function(k){
    (_poIs.items[k]||[]).forEach(function(it){
      var tgt=+_poIs.rsz[k][it.id]||0;
      /* เทียบกับที่ "ใบนี้" เคยเขียนรายชิ้น · ใบเก่าที่ยังไม่มี rsz เทียบกับบัญชีจริง
         ส่วนต่างจึงเป็นศูนย์ตอนเปิดครั้งแรก ไม่มีการเขียนซ้ำโดยไม่ได้ตั้งใจ */
      var had=WR ? (+WR[it.id]||0) : (S[it.id]?S[it.id].ret:0);
      var d=tgt-had; if(!d) return;
      plan.push({itemId:it.id, type:'return', qty:d});
    });
  });

  /* 3.5 · §poNoNeg · ยอดคืนถูกเกลี่ยลงไซส์ตั้งแต่ตอนคืน · พอมาแก้ไซส์ฝั่งเบิกทีหลัง
     การเกลี่ยเดิมค้างอยู่กับไซส์เก่า ไซส์ที่ถูกลดจึงกลายเป็น "คืนมากกว่าที่เบิก"
     ปล่อยไว้จะได้ อยู่กับเรือ -2 และ พร้อมใช้ 90 จากทะเบียน 88 ซึ่งเป็นสถานะที่ไม่มีจริง
     ทางแก้คือย้ายยอดคืนจากไซส์ที่เกินไปให้ไซส์ที่ขาด · ยอดคืนรวมของประเภทนั้นเท่าเดิม */
  var realloc=[];
  KS.forEach(function(k){
    var net={};
    plan.forEach(function(p){ if(!net[p.itemId]) net[p.itemId]={iss:0,ret:0};
      net[p.itemId][p.type==='issue'?'iss':'ret']+=p.qty; });
    var rows=(_poIs.items[k]||[]).map(function(it){
      var o=S[it.id]||{iss:0,ret:0,rep:0,wo:0,lost:0,ob:0}, x=net[it.id]||{iss:0,ret:0};
      /* §poFix2 · ของที่ค้างมาจากวันก่อนก็เป็นของที่อยู่กับเรือ · ไม่นับด้วยจะกลายเป็นคืนเกินทั้งที่คืนถูก */
      return {id:it.id, label:it.label,
              out:(CY[it.id]||0)+(o.iss+x.iss)-(o.ret+x.ret+o.rep+o.wo+o.lost+o.ob)}; });
    var under=rows.filter(function(r){ return r.out>0; });
    rows.filter(function(r){ return r.out<0; }).forEach(function(a){
      under.forEach(function(b){
        if(a.out>=0 || b.out<=0) return;
        var q=Math.min(-a.out, b.out);
        plan.push({itemId:a.id, type:'return', qty:-q, _ra:1});
        plan.push({itemId:b.id, type:'return', qty:q, _ra:1});
        a.out+=q; b.out-=q;
        realloc.push(a.label+' \u2192 '+b.label+' \u00b7 ย้ายยอดคืน '+q); });
      /* ไม่มีไซส์ไหนรับไปได้ = ใบนี้คืนมากกว่าที่เบิกจริง ๆ · ตัดยอดคืนลงให้เหลือศูนย์ */
      if(a.out<0){ plan.push({itemId:a.id, type:'return', qty:a.out, _ra:1});
        realloc.push(a.label+' \u00b7 ลดยอดคืน '+(-a.out)+' (คืนมากกว่าที่เบิก)'); a.out=0; } });
  });
  if(realloc.length && !confirm('ใบนี้บันทึกการคืนไปแล้ว · แก้ยอดเบิกจึงต้องขยับยอดคืนตามด้วย:\n\n'
      +realloc.join('\n')+'\n\nไม่ขยับตาม ยอด "อยู่กับเรือ" จะติดลบ และ "พร้อมใช้" จะเกินทะเบียน\nบันทึกต่อไหม?')) return false;

  /* §poFix3 · ยอดที่จะ "ลด" ต้องถามก่อนทุกครั้ง
     การลดยอดเป็นการล้างสิ่งที่เคยบันทึกไปแล้ว · เงียบ ๆ แล้วยอดหายคือสิ่งที่แก้กลับไม่ได้
     ข้ามรายการที่ §poNoNeg เพิ่งเพิ่มเข้ามา (_ra) · อันนั้นถามไปแล้วในคำถามข้างบน */
  var cuts=plan.filter(function(p){ return p.qty<0 && !p._ra; });
  if(cuts.length){
    var ctxt=cuts.map(function(p){ var it=poItem(p.itemId);
      return '\u2022 '+((it&&it.label)||p.itemId)+' \u00b7 '+(p.type==='issue'?'เบิก':'คืน')
        +' ลดลง '+Math.abs(p.qty); }).join('\n');
    if(!confirm('บันทึกนี้จะ "ลด" ยอดที่เคยบันทึกไว้:\n\n'+ctxt
      +'\n\nเกิดขึ้นเมื่อตัวเลขในตารางน้อยกว่ายอดที่อยู่ในบัญชี\n'
      +'ถ้าไม่ได้ตั้งใจแก้ยอด ให้กดยกเลิกแล้วตรวจตารางก่อน\n\nยืนยันลดยอด?')) return false;
  }

  /* 4 · เขียน */
  plan.forEach(function(p){
    if(!p.qty) return;
    poAdd({date:_poDate, pier:_poPier, itemId:p.itemId, boatId:bid, type:p.type, qty:p.qty,
           note:(p.qty<0?'แก้ยอดจากใบเบิก–คืน':'จากใบเบิก–คืน')});
  });

  /* 5 · ใบเบิก · เก็บที่กรอกไว้ทั้งใบ รวมเงินมัดจำ */
  PIER_SHEET[poIsKey(_poDate,bid)]={
    pier:_poPier, boatId:bid, date:_poDate, at:new Date().toISOString(), by:poWho(),
    size:JSON.parse(JSON.stringify(_poIs.size)),
    rsz:JSON.parse(JSON.stringify(_poIs.rsz)),                         /* §poRetSplit */
    wrote:{ ret:(function(){ var o={};
      KS.forEach(function(k){ var t=0; _poIs.rows.forEach(function(r){ t+=(+r.ret[k]||0); }); o[k]=t; }); return o; })(),
      /* §poRetSplit · จำรายชิ้นไว้ด้วย · รอบหน้าจะได้คิดส่วนต่างรายชิ้นได้ตรง */
      rsz:(function(){ var o={};
        KS.forEach(function(k){ (_poIs.items[k]||[]).forEach(function(it){ o[it.id]=+_poIs.rsz[k][it.id]||0; }); });
        return o; })() },
    rows:poIsRowsOut()
  };
  poPersist();
  return true;
}
function poIsRowsOut(){
  return _poIs.rows.map(function(r){
    return { id:r.id, bkId:r.bkId, extra:!!r.extra, agN:r.agN, label:r.extra?(r.names[0]||''):'',
             ad:r.extra?(+r.ad||0):0,
             iss:JSON.parse(JSON.stringify(r.iss)), ret:JSON.parse(JSON.stringify(r.ret)),
             dep:+r.dep||0, back:+r.back||0, cut:+r.cut||0, note:r.note||'' };
  });
}
/* §poDraft · เก็บใบไว้เฉย ๆ · สต็อกไม่ขยับ */
function poIssueDraft(bid){
  if(!poIsCommit(bid,'draft')) return;
  poModalClose(); renderPierOffice();
}
/* §poDraft · ยืนยัน = ตรวจครบแล้วเขียนลงบัญชีสต็อก */
function poIssueSave(bid){
  if(!poIsCommit(bid)) return;
  poModalClose(); renderPierOffice();
}
/* พิมพ์ใบเซ็น · เก็บเป็นร่างพอ ไม่ต้องตัดสต็อกเพราะแค่จะเอากระดาษไปให้เซ็น */
function poIsPrint(bid){
  if(!poIsCommit(bid,'draft')) return;
  renderPierOffice();
  poSignSheet(bid);
}

function poCloseOpen(bid){
  if(!poCanEdit()) return;
  var boats=poBoats(_poDate,_poPier), B=boats.filter(function(x){return x.bid===bid;})[0]||{boat:{name:bid}};
  var items=poItemsAll(_poPier), S=poBoatSum(_poDate,bid,_poPier), C=poBoatCarry(_poDate,bid);
  var rows=items.filter(function(it){ return (S[it.id] && S[it.id].iss>0) || (C[it.id]>0); });
  if(!rows.length){ alert('ลำนี้ยังไม่มีของค้างอยู่ · ทั้งวันที่เลือกและวันก่อนหน้า'); return; }
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:12px">'
    +'กรอกจำนวนที่<b style="color:#16265C">คืนเข้ามาจริง</b> · ถ้าไม่ครบ ระบบจะบังคับให้ระบุว่าส่วนที่ขาดหายไปไหน จนครบทุกชิ้นถึงจะปิดยอดได้</div>';
  body+=rows.map(function(it){
    var o=S[it.id], u=(PO_KIND[it.kind]||{u:'ชิ้น'}).u, cy=C[it.id]||0;
    var out=cy+o.iss-(o.ret+o.rep+o.wo+o.lost+o.ob);
    return '<div id="pocw_'+it.id+'" style="border:1px solid #E3E3DF;border-radius:10px;padding:11px 12px;margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;gap:10px">'
        +'<div style="flex:1"><div style="font-weight:700;font-size:12.5px">'+poE(it.label)
          +(it.active===false?' <span style="font-size:10px;font-weight:700;color:#8a8a82">(ปิดใช้งานแล้ว)</span>':'')+'</div>'
        +'<div style="font-size:11px;color:#7C8091">'
          +(cy?('<b style="color:#B4560A">ค้างจากวันก่อน '+cy+'</b> · '):'')
          +'เบิกวันนี้ '+o.iss+' '+u+' · ยังค้าง '+out+'</div></div>'
        +'<span style="font-size:11.5px;color:#7C8091">คืน</span>'
        +'<input id="poret_'+it.id+'" value="'+out+'" oninput="poCloseCalc(\''+it.id+'\','+out+')" style="border:1px solid #D8D4CA;border-radius:8px;padding:6px 9px;font:700 13px inherit;width:70px;font-family:inherit">'
        +'<span style="font-size:11.5px;color:#7C8091;width:30px">'+u+'</span></div>'
      +'<div id="pomiss_'+it.id+'" style="margin-top:9px"></div></div>';
  }).join('');
  poModal('ปิดยอด '+poE(B.boat.name||bid)+' · '+poE(_poDate), body,
    '<div id="pocwmsg" style="flex:1;font-size:11.5px;color:#C0271C;font-weight:700"></div>'
    +poBtn('ยกเลิก','poModalClose()')+poBtn('ปิดยอด',"poCloseSave('"+bid+"')",1), 680);
  rows.forEach(function(it){ var o=S[it.id];
    poCloseCalc(it.id, (C[it.id]||0)+o.iss-(o.ret+o.rep+o.wo+o.lost+o.ob)); });
}
function poCloseCalc(itemId, out){
  var box=document.getElementById('pomiss_'+itemId); if(!box) return;
  var ret=poNum(poV('poret_'+itemId));
  var miss=out-ret;
  if(miss<=0){ box.innerHTML=(miss<0?'<div style="font-size:11.5px;color:#C0271C;font-weight:700">คืนมากกว่าที่เบิก · ตรวจตัวเลขอีกครั้ง</div>':''); return; }
  /* §laDerived · เคยพัง 7 จาก 21 ชิ้น ตอน PO_KIND ยังไม่มีประเภทที่ผู้ใช้สร้างเอง
     ตอนนี้ประกอบตารางครบทุกทางแล้ว · ค่าสำรองไว้กันเหนียว ปุ่มต้องกดได้เสมอ */
  var it=poItem(itemId), u=(it&&PO_KIND[it.kind]||{u:'ชิ้น'}).u;
  box.innerHTML='<div style="background:#FFF6E8;border:1px solid #F0D8A8;border-radius:9px;padding:10px 11px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#7A4A00;margin-bottom:7px">ขาด '+miss+' '+u+' — ระบุให้ครบก่อนปิดยอด</div>'
    +PO_MISS.map(function(m){
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
        +'<span style="flex:1;font-size:12px;color:'+m.c+';font-weight:700">'+m.t+'</span>'
        +(m.k==='lost'?('<span style="font-size:11px;color:#7C8091">ค่าปรับ</span>'+poIn('pofine_'+itemId,'','0',66)):'')
        +'<input id="pom_'+m.k+'_'+itemId+'" value="0" oninput="poMissSum(\''+itemId+'\','+miss+')" style="border:1px solid #D8D4CA;border-radius:8px;padding:5px 8px;font:700 12.5px inherit;width:62px;font-family:inherit"></div>';
    }).join('')
    +'<div id="pomsum_'+itemId+'" style="font-size:11.5px;font-weight:700;margin-top:6px"></div></div>';
  poMissSum(itemId, miss);
}
function poMissSum(itemId, miss){
  var t=0; PO_MISS.forEach(function(m){ t+=poNum(poV('pom_'+m.k+'_'+itemId)); });
  var el=document.getElementById('pomsum_'+itemId); if(!el) return;
  el.style.color=(t===miss)?'#1C7A4E':'#C0271C';
  el.textContent=(t===miss)?('ระบุครบแล้ว '+t+'/'+miss):('ระบุแล้ว '+t+' จาก '+miss+' · ยังขาด '+(miss-t));
}
function poCloseSave(bid){
  var items=poItemsAll(_poPier), S=poBoatSum(_poDate,bid,_poPier), C=poBoatCarry(_poDate,bid), bad=[], plan=[];
  items.forEach(function(it){
    var o=S[it.id], cy=C[it.id]||0; if(!o || (!o.iss && !cy)) return;
    var out=cy+o.iss-(o.ret+o.rep+o.wo+o.lost+o.ob); if(out<=0) return;
    var ret=poNum(poV('poret_'+it.id));
    if(ret<0 || ret>out){ bad.push(poE(it.label)+' · จำนวนคืนไม่ถูกต้อง'); return; }
    var miss=out-ret, sum=0, parts={};
    PO_MISS.forEach(function(m){ var q=poNum(poV('pom_'+m.k+'_'+it.id)); parts[m.k]=q; sum+=q; });
    if(miss>0 && sum!==miss){ bad.push(poE(it.label)+' · ระบุของที่ขาดได้ '+sum+' จาก '+miss); return; }
    plan.push({it:it, ret:ret, parts:parts, fine:poNum(poV('pofine_'+it.id))});
  });
  var msg=document.getElementById('pocwmsg');
  if(bad.length){ if(msg) msg.innerHTML=bad.join(' · '); else alert(bad.join('\n')); return; }
  plan.forEach(function(p){
    if(p.ret>0) poAdd({date:_poDate,pier:_poPier,itemId:p.it.id,boatId:bid,type:'return',qty:p.ret});
    PO_MISS.forEach(function(m){
      var q=p.parts[m.k]; if(!q) return;
      var mv={date:_poDate,pier:_poPier,itemId:p.it.id,boatId:bid,type:m.k,qty:q};
      if(m.k==='lost' && p.fine>0){ mv.fine=p.fine; mv.finePaid=false; }
      poAdd(mv);
    });
  });
  poPersist(); poModalClose(); renderPierOffice();
}

function poDutyOpen(bid){
  if(!poCanEdit()) return;
  var st=poStaff(_poPier), on=poDuty(_poDate,bid);
  var B=poBoats(_poDate,_poPier).filter(function(x){return x.bid===bid;})[0]||{boat:{name:bid}};
  var body=st.length?st.map(function(s){
    return '<label style="'+poRowCss()+';cursor:pointer">'
      +'<input type="checkbox" id="podu_'+s.id+'"'+(on.indexOf(s.id)>=0?' checked':'')+' style="width:17px;height:17px">'
      +'<div style="flex:1"><div style="font-weight:700;font-size:12.5px">'+poE(s.nick||s.name)+'</div>'
      +'<div style="font-size:11px;color:#7C8091">'+poE(s.name||'')+(s.role?(' · '+poE(s.role)):'')+(s.phone?(' · '+poE(s.phone)):'')+'</div></div></label>';
  }).join('')
  :'<div style="color:#9A9A93;font-size:12.5px;padding:14px 0">ยังไม่มีพนักงานของท่านี้ในทะเบียน · เพิ่มได้ที่หน้า ตารางการทำงาน › ทะเบียนพนักงาน</div>';
  poModal('พนักงานลง '+poE(B.boat.name||bid)+' · '+poE(_poDate), body,
    poBtn('ยกเลิก','poModalClose()')+poBtn('บันทึก',"poDutySave('"+bid+"')",1), 480);
}
function poDutySave(bid){
  var pick=[]; poStaff(_poPier).forEach(function(s){ var el=document.getElementById('podu_'+s.id); if(el&&el.checked) pick.push(s.id); });
  if(pick.length) PIER_DUTY[poDutyKey(_poDate,bid)]=pick; else delete PIER_DUTY[poDutyKey(_poDate,bid)];
  poPersist(); poModalClose(); renderPierOffice();
}

function poStaffOpen(){
  var st=(PIER_STAFF||[]).filter(function(s){ return s.pier===_poPier; });
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:10px;line-height:1.7">'
    +'พนักงาน<b style="color:#16265C">ประจำท่า</b> '+poE(poPierName())+'<br>'
    +'ท่าประจำใช้กำหนดว่าชื่อจะไปอยู่ในตารางการทำงานของท่าไหน · '
    +'<b style="color:#16265C">ทุกคนถูกจัดลงเรือได้ทั้ง 3 ท่า</b> ไม่ต้องย้ายท่าประจำเวลาไปช่วย</div>';
  body+=st.map(function(s){
    return '<div style="'+poRowCss()+'">'
      +'<div style="flex:1"><div style="font-weight:700;font-size:12.5px">'+poE(s.nick||s.name)+(s.active===false?' <span style="color:#9A9A93;font-weight:600">(ปิดใช้)</span>':'')+'</div>'
      +'<div style="font-size:11px;color:#7C8091">'+poE(s.name||'')+(s.role?(' · '+poE(s.role)):'')+(s.phone?(' · '+poE(s.phone)):'')+'</div></div>'
      +'<select onchange="poStaffPier(\''+s.id+'\',this.value)" title="ท่าประจำ · ชื่อจะไปอยู่ในตารางการทำงานของท่านี้" style="border:1px solid #D8D4CA;border-radius:8px;padding:5px 7px;font:600 11.5px inherit;font-family:inherit">'
        +PO_PIERS.map(function(p){ return '<option value="'+p.k+'"'+(s.pier===p.k?' selected':'')+'>'+poE(p.n||p.t)+'</option>'; }).join('')+'</select>'
      +'<span style="font-size:10.5px;color:#8B93A1">วันที่ไม่ได้ลงเรือ</span>'
      +'<input value="'+poE(s.defCode||'')+'" placeholder="'+poE(typeof paDefFallback==='function'?paDefFallback():'SE')+'" title="รหัสตั้งต้นในตารางการทำงาน เมื่อวันนั้นมีใบงานแล้วแต่คนนี้ไม่ได้ลงเรือ" '
        +'oninput="poStaffDef(\''+s.id+'\',this.value)" style="width:74px;border:1px solid #D8D4CA;border-radius:8px;padding:5px 8px;font:700 12px inherit;text-align:center;font-family:inherit">'
      +'<button class="po-btn" onclick="poStaffToggle(\''+s.id+'\')">'+(s.active===false?'เปิดใช้':'ปิดใช้')+'</button></div>';
  }).join('');
  body+='<div style="margin-top:14px;border-top:1px dashed #D8D4CA;padding-top:12px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#16265C;margin-bottom:7px">เพิ่มพนักงาน</div>'
    +'<div style="display:flex;gap:7px;flex-wrap:wrap">'
    +poIn('postf_nick','','ชื่อเล่น',110)+poIn('postf_name','','ชื่อ-สกุล',180)
    +poIn('postf_role','','หน้าที่ เช่น อุปกรณ์',150)+poIn('postf_phone','','เบอร์',120)
    +poBtn('เพิ่ม','poStaffAdd()',1)+'</div></div>';
  poModal('ทะเบียนพนักงานท่าเรือ', body, poBtn('ปิด','poModalClose()'), 640);
}
function poStaffAdd(){
  var nick=poV('postf_nick').trim(), name=poV('postf_name').trim();
  if(!nick && !name){ alert('ใส่ชื่ออย่างน้อยหนึ่งช่อง'); return; }
  PIER_STAFF.push({id:poUid('ps_'), pier:_poPier, nick:nick||name, name:name||nick,
                   role:poV('postf_role').trim(), phone:poV('postf_phone').trim(), active:true});
  poPersist(); poStaffOpen();
}
function poStaffPier(id,v){
  if(!poCanEdit()) return;
  (PIER_STAFF||[]).forEach(function(s){ if(s.id===id) s.pier=v; });
  poPersist(); poStaffOpen();
}
function poStaffDef(id,v){
  if(!poCanEdit()) return;
  (PIER_STAFF||[]).forEach(function(s){ if(s.id===id) s.defCode=String(v||'').trim().toUpperCase(); });
  poPersist();
}
function poStaffToggle(id){
  (PIER_STAFF||[]).forEach(function(s){ if(s.id===id) s.active=(s.active===false); });
  poPersist(); poStaffOpen();
}

/* §poKinds · ตั้งประเภทเอง · ใช้ร่วมกันทุกท่า เพราะของชนิดเดียวกันควรนับหน่วยเดียวกัน */
function poKindId(){ return 'pk_'+Math.random().toString(36).slice(2,7); }
function poKindAdd(){
  if(!poGuard()) return;
  var L=poKinds();
  PIER_KINDS.push({id:poKindId(), name:'', unit:'ชิ้น', color:'#5F6C7B',
                   ord:(L.length?((+L[L.length-1].ord||0)+1):1), active:true});
  poKindSync(); poPersist(); poItemsOpen();
}
function poKindSet(id, f, v){
  if(!poGuard()) return;
  var k=(PIER_KINDS||[]).filter(function(x){ return x.id===id; })[0]; if(!k) return;
  k[f]=String(v==null?'':v).slice(0,40);
  poKindSync(); poPersist();
  if(f!=='name' && f!=='name_en' && f!=='unit') poItemsOpen();   // พิมพ์ชื่อ/หน่วยอยู่ ไม่ต้องวาดใหม่ให้หลุดโฟกัส
}
function poKindMove(id, dir){
  if(!poGuard()) return;
  var L=poKinds(), i=-1; L.forEach(function(x,n){ if(x.id===id) i=n; });
  var j=i+dir; if(i<0 || j<0 || j>=L.length) return;
  var a=L[i].ord, b=L[j].ord;
  if(a===b || a==null || b==null){ L.forEach(function(x,n){ x.ord=n+1; }); a=L[i].ord; b=L[j].ord; }
  L[i].ord=b; L[j].ord=a;
  poKindSync(); poPersist(); poItemsOpen();
}
function poKindDel(id){
  if(!poGuard()) return;
  var n=(PIER_ITEMS||[]).filter(function(i){ return i.kind===id; }).length;
  if(n){ alert('ลบไม่ได้ · ยังมีของ '+n+' รายการอยู่ในประเภทนี้\n\nย้ายของไปประเภทอื่นหรือปิดของเหล่านั้นก่อน'); return; }
  if(!confirm('ลบประเภทนี้?')) return;
  PIER_KINDS=(PIER_KINDS||[]).filter(function(x){ return x.id!==id; });
  poKindSync(); poPersist(); poItemsOpen();
}
function poItemsOpen(){
  poKindSync();
  var its=(PIER_ITEMS||[]).filter(function(i){ return i.pier===_poPier; });
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:10px">"ทะเบียน" คือจำนวนที่ซื้อเข้ามาทั้งหมด · ยอดคงเหลือคำนวณจากรายการเคลื่อนไหว ไม่ต้องมาแก้มือ</div>';
  body+=its.map(function(it){
    var b=poBal(it.id), u=PO_KIND[it.kind]?PO_KIND[it.kind].u:'ชิ้น';
    var KM=PO_KIND[it.kind]||{t:it.kind,u:'ชิ้น',c:'#9A9A93'};
    return '<div style="'+poRowCss()+'">'
      // §poKinds · ย้ายของข้ามประเภทได้ · ไม่งั้นเพิ่มประเภทใหม่แล้วของเก่าย้ายมาไม่ได้เลย
      +'<select onchange="poItemKind(\''+it.id+'\',this.value)" class="po-kpick" '
        +'style="border:1px solid '+KM.c+'55;background:'+KM.c+'14;color:'+KM.c+'">'
        + poKinds().map(function(k){ return '<option value="'+poE(k.id)+'"'+(k.id===it.kind?' selected':'')+'>'
            +poE(k.name||k.id)+'</option>'; }).join('')
        + (PO_KIND[it.kind]&&poKinds().some(function(k){ return k.id===it.kind; })?''
            :('<option value="'+poE(it.kind)+'" selected>'+poE(KM.t)+'</option>'))
      +'</select>'
      +'<div style="flex:1"><input id="poit_'+it.id+'" value="'+poE(it.label)+'" style="border:1px solid #D8D4CA;border-radius:8px;padding:5px 9px;font:600 12.5px inherit;width:100%;font-family:inherit"></div>'
      +poIn('poitt_'+it.id, poNum(it.total), '', 66)
      +'<span style="font-size:11px;color:#7C8091;width:56px">'+u+' · เหลือ '+b.inhand+'</span>'
      +'<button class="po-btn" onclick="poItemOff(\''+it.id+'\')">'+(it.active===false?'เปิดใช้':'ปิด')+'</button></div>';
  }).join('');
  // §poKinds · จัดประเภทเอง · อยู่เหนือช่องเพิ่มรายการ เพราะต้องมีประเภทก่อนถึงจะเพิ่มของได้
  body+='<div style="margin-top:14px;border-top:1px dashed #D8D4CA;padding-top:12px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#16265C;margin-bottom:3px">ประเภทของ</div>'
    +'<div style="font-size:11px;color:#8a8a82;margin-bottom:8px">ตั้งเองได้ · ชื่อ หน่วยนับ สี และลำดับที่โชว์ · '
      +'ใช้ร่วมกันทุกท่า เพราะของชนิดเดียวกันควรนับหน่วยเดียวกัน<br>'
      +'ช่อง <b>EN</b> คือชื่อที่จะไปขึ้นบน<b>ใบเซ็น</b> ซึ่งเป็นภาษาอังกฤษทั้งใบเพราะลูกค้าต่างชาติเป็นคนเซ็น · '
      +'เว้นว่างได้ จะใช้ชื่อไทยแทน</div>'
    + poKinds().map(function(k,i,arr){
        return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
          +'<input type="color" value="'+poE(k.color||'#5F6C7B')+'" onchange="poKindSet(\''+poE(k.id)+'\',\'color\',this.value)" '
            +'style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0">'
          +'<input value="'+poE(k.name||'')+'" placeholder="ชื่อประเภท เช่น เสื้อชูชีพ" '
            +'oninput="poKindSet(\''+poE(k.id)+'\',\'name\',this.value)" '
            +'style="flex:1;border:1px solid #D8D4CA;border-radius:8px;padding:5px 9px;font:600 12.5px inherit;font-family:inherit">'
          /* §poKindEn · ชื่ออังกฤษ · ใช้เฉพาะตอนพิมพ์ใบเซ็น หน้าจอยังเป็นไทยหมด */
          +'<input value="'+poE(k.name_en||'')+'" placeholder="EN เช่น LIFE JACKET" '
            +'title="ชื่อภาษาอังกฤษ · ใช้เป็นหัวคอลัมน์ในใบเซ็นซึ่งเป็นภาษาอังกฤษทั้งใบ · เว้นว่างได้ จะใช้ชื่อไทยแทน" '
            +'oninput="poKindSet(\''+poE(k.id)+'\',\'name_en\',this.value)" '
            +'style="width:132px;border:1px solid #D8D4CA;border-radius:8px;padding:5px 9px;'
            +'font:600 12.5px inherit;font-family:inherit;letter-spacing:.02em">'
          +'<input value="'+poE(k.unit||'')+'" placeholder="หน่วย" title="หน่วยนับ เช่น คู่ · ตัว · ชิ้น" '
            +'oninput="poKindSet(\''+poE(k.id)+'\',\'unit\',this.value)" '
            +'style="width:74px;border:1px solid #D8D4CA;border-radius:8px;padding:5px 9px;font:600 12.5px inherit;font-family:inherit">'
          +'<button class="po-btn" onclick="poKindMove(\''+poE(k.id)+'\',-1)"'+(i===0?' disabled':'')+' title="ขึ้น">&#9650;</button>'
          +'<button class="po-btn" onclick="poKindMove(\''+poE(k.id)+'\',1)"'+(i===arr.length-1?' disabled':'')+' title="ลง">&#9660;</button>'
          +'<button class="po-btn" onclick="poKindDel(\''+poE(k.id)+'\')" title="ลบประเภท">&times;</button>'
        +'</div>'; }).join('')
    + poBtn('+ เพิ่มประเภท','poKindAdd()')
    +'</div>';
  body+='<div style="margin-top:14px;border-top:1px dashed #D8D4CA;padding-top:12px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#16265C;margin-bottom:7px">เพิ่มรายการ</div>'
    +'<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">'
    +'<select id="poni_kind" style="border:1px solid #D8D4CA;border-radius:8px;padding:6px 9px;font:600 12.5px inherit;font-family:inherit">'
    +poKinds().map(function(k){ return '<option value="'+poE(k.id)+'">'+poE(k.name||k.id)+' ('+poE(k.unit||'ชิ้น')+')</option>'; }).join('')+'</select>'
    +poIn('poni_label','','ชื่อ/แบบ เช่น ตีนกบ · L (42-44)',230)+poIn('poni_total','','จำนวน',80)
    +poBtn('เพิ่ม','poItemAdd()',1)+'</div></div>';
  poModal('ทะเบียนของ · '+poE(poPierName()), body,
    poBtn('ปิด','poModalClose()')+poBtn('บันทึกชื่อ/จำนวน','poItemsSave()',1), 700);
}
function poItemsSave(){
  (PIER_ITEMS||[]).forEach(function(it){
    if(it.pier!==_poPier) return;
    var l=document.getElementById('poit_'+it.id), t=document.getElementById('poitt_'+it.id);
    if(l && l.value.trim()) it.label=l.value.trim();
    if(t) it.total=poNum(t.value);
  });
  poPersist(); poModalClose(); renderPierOffice();
}
function poItemAdd(){
  var lb=poV('poni_label').trim(); if(!lb){ alert('ใส่ชื่อรายการ'); return; }
  var L=poKinds();
  if(!L.length){ alert('ยังไม่มีประเภทของ · กด "+ เพิ่มประเภท" ก่อน'); return; }
  PIER_ITEMS.push({id:poUid('pi_'), pier:_poPier, kind:poV('poni_kind')||L[0].id,
                   label:lb, total:poNum(poV('poni_total')), active:true, note:''});
  poPersist(); poItemsOpen();
}
/* §poKinds · ย้ายของไปประเภทอื่น · หน่วยนับกับสีจะเปลี่ยนตามทันที */
function poItemKind(id, kind){
  if(!poGuard()) return;
  (PIER_ITEMS||[]).forEach(function(i){ if(i.id===id) i.kind=kind; });
  poPersist(); poItemsOpen();
}
function poItemOff(id){
  (PIER_ITEMS||[]).forEach(function(i){ if(i.id===id) i.active=(i.active===false); });
  poPersist(); poItemsOpen();
}

function poAdjOpen(itemId){
  if(!poCanEdit()) return;
  var it=poItem(itemId); if(!it) return; var b=poBal(itemId), u=(PO_KIND[it.kind]||{u:'ชิ้น'}).u;   // §laDerived · ค่าสำรอง · ปุ่มต้องกดได้เสมอ
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:11px">ใช้ตอนซื้อของเข้าใหม่ หรือนับสต็อกแล้วไม่ตรง · ใส่ตัวเลขติดลบเพื่อหักออก</div>'
    +'<div style="font-weight:700;font-size:13px;margin-bottom:8px">'+poE(it.label)+' · พร้อมใช้ตอนนี้ '+b.ready+' '+u+'</div>'
    +'<div style="display:flex;gap:9px;align-items:center">'+poIn('poadj','','+/- จำนวน',110)
    +'<input id="poadjn" placeholder="เหตุผล เช่น ซื้อเข้า 20 คู่" style="border:1px solid #D8D4CA;border-radius:8px;padding:7px 10px;font:500 12.5px inherit;flex:1;font-family:inherit"></div>';
  poModal('ปรับยอด · '+poE(it.label), body, poBtn('ยกเลิก','poModalClose()')+poBtn('บันทึก',"poAdjSave('"+itemId+"')",1), 520);
}
function poAdjSave(itemId){
  var q=poNum(poV('poadj')); if(!q){ poModalClose(); return; }
  poAdd({date:_poDate, pier:_poPier, itemId:itemId, boatId:'', type:'adjust', qty:q, note:poV('poadjn')});
  poPersist(); poModalClose(); renderPierOffice();
}

function poFixOpen(itemId){
  if(!poCanEdit()) return;
  var it=poItem(itemId); if(!it) return; var b=poBal(itemId), u=(PO_KIND[it.kind]||{u:'ชิ้น'}).u;   // §laDerived · ค่าสำรอง · ปุ่มต้องกดได้เสมอ
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:11px">ของที่ซ่อมเสร็จแล้วกลับเข้าคลังพร้อมใช้ · ถ้าซ่อมไม่ไหวให้ตัดทิ้งแทน</div>'
    +'<div style="font-weight:700;font-size:13px;margin-bottom:8px">'+poE(it.label)+' · รอซ่อม '+b.repair+' '+u+'</div>'
    +'<div style="display:flex;gap:9px;align-items:center">'
    +'<span style="font-size:12px">ซ่อมเสร็จ</span>'+poIn('pofix', b.repair, '', 70)
    +'<span style="font-size:12px;margin-left:10px">ตัดทิ้ง</span>'+poIn('pofixw','0','',70)+'</div>';
  poModal('ซ่อมเสร็จ · '+poE(it.label), body, poBtn('ยกเลิก','poModalClose()')+poBtn('บันทึก',"poFixSave('"+itemId+"')",1), 520);
}
function poFixSave(itemId){
  var b=poBal(itemId), f=poNum(poV('pofix')), w=poNum(poV('pofixw'));
  if(f+w>b.repair){ alert('รวมกันเกินจำนวนที่รอซ่อม ('+b.repair+')'); return; }
  if(f>0) poAdd({date:_poDate,pier:_poPier,itemId:itemId,boatId:'',type:'fixed',qty:f});
  if(w>0) poAdd({date:_poDate,pier:_poPier,itemId:itemId,boatId:'',type:'writeoff',qty:w,from:'repair'});
  poPersist(); poModalClose(); renderPierOffice();
}

/* §towelQ · อายุกองรายชิ้น · ใช้ในกล่องส่งซัก/รับเข้า */
function poQAge(itemId, bucket){
  var Q=poTowelQ(_poPier, itemId), a=Q[bucket]||[];
  if(!a.length || !a[0].date) return '';
  var d=poDaysAgo(a[0].date);
  var due=(bucket==='laundry')?PO_LAUNDRY_DUE:PO_DIRTY_DUE;
  return ' · <span style="color:'+(d>due?'#B4560A':'#7C8091')+';font-weight:'+(d>due?'700':'500')+'">'
    +'เก่าสุด '+poE(poDShort(a[0].date))+' ('+d+' วัน)</span>';
}
function poLaundryOutOpen(){
  if(!poCanEdit()) return;
  var tw=poItems(_poPier).filter(function(i){ return i.kind==='towel'; });
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:11px">ผ้าที่คืนเข้ามาแล้วรอส่งซัก · กรอกจำนวนที่ส่งออกไปวันนี้<br>'
    +'<b style="color:#16265C">ระบบตัดจากกองเก่าสุดก่อนเสมอ</b> · ไม่ต้องเลือกเองว่าส่งกองไหน</div>'
    +tw.map(function(it){ var b=poBal(it.id);
      return '<div style="'+poRowCss()+'"><div style="flex:1"><div style="font-weight:700;font-size:12.5px">'+poE(it.label)+'</div>'
        +'<div style="font-size:11px;color:#7C8091">รอส่งซัก '+b.dirty+' ผืน'+poQAge(it.id,'dirty')+'</div></div>'
        +poIn('polo_'+it.id, b.dirty, '', 70)+'</div>'; }).join('')
    +'<div style="margin-top:11px"><input id="ponote_l" placeholder="ร้านซัก / เลขที่ใบส่ง" style="border:1px solid #D8D4CA;border-radius:8px;padding:7px 10px;font:500 12.5px inherit;width:100%;font-family:inherit"></div>';
  poModal('ส่งผ้าไปซัก · '+poE(_poDate), body, poBtn('ยกเลิก','poModalClose()')+poBtn('บันทึก','poLaundrySave(1)',1), 560);
}
function poLaundryInOpen(){
  if(!poCanEdit()) return;
  var tw=poItems(_poPier).filter(function(i){ return i.kind==='towel'; });
  var body='<div style="font-size:12px;color:#7C8091;margin-bottom:11px">ผ้าที่ร้านซักส่งกลับ · เข้าคลังพร้อมใช้ทันที ถ้าขาดให้ปรับยอดแยก</div>'
    +tw.map(function(it){ var b=poBal(it.id);
      return '<div style="'+poRowCss()+'"><div style="flex:1"><div style="font-weight:700;font-size:12.5px">'+poE(it.label)+'</div>'
        +'<div style="font-size:11px;color:#7C8091">อยู่ร้านซัก '+b.laundry+' ผืน'+poQAge(it.id,'laundry')+'</div></div>'
        +poIn('poli_'+it.id, b.laundry, '', 70)+'</div>'; }).join('')
    +'<div style="margin-top:11px"><input id="ponote_l" placeholder="หมายเหตุ" style="border:1px solid #D8D4CA;border-radius:8px;padding:7px 10px;font:500 12.5px inherit;width:100%;font-family:inherit"></div>';
  poModal('รับผ้าเข้าจากร้านซัก · '+poE(_poDate), body, poBtn('ยกเลิก','poModalClose()')+poBtn('บันทึก','poLaundrySave(0)',1), 560);
}
function poLaundrySave(isOut){
  var tw=poItems(_poPier).filter(function(i){ return i.kind==='towel'; }), note=poV('ponote_l'), n=0;
  tw.forEach(function(it){
    var q=poNum(poV((isOut?'polo_':'poli_')+it.id)); if(q<=0) return;
    var b=poBal(it.id), cap=isOut?b.dirty:b.laundry;
    if(q>cap) q=cap;
    if(q<=0) return;
    poAdd({date:_poDate,pier:_poPier,itemId:it.id,boatId:'',type:isOut?'laundry_out':'laundry_in',qty:q,note:note}); n++;
  });
  if(n) poPersist();
  poModalClose(); renderPierOffice();
}
function poLdgFilter(k){ _poLdgF=(PO_LDG_G[k]!==undefined)?k:'all'; poLedgerOpen(); }
function poLdgBoatNm(id){
  var b=(typeof getBoat==='function' && id)?getBoat(id):null;
  return b?(b.name||id):(id||'ไม่ระบุลำ');
}
function poLdgCard(k,v,sub,cls){
  var C={ amber:['#FFFBEB','#FDE68A','#B45309'], rose:['#FEF2F2','#FECACA','#B91C1C'],
          green:['#fff','#E2E8F0','#047857'], '':['#fff','#E2E8F0','#0F172A'] };
  var c=C[cls||'']||C[''];
  return '<div style="background:'+c[0]+';border:1px solid '+c[1]+';border-radius:14px;padding:11px 13px">'
    +'<div style="font-size:10.5px;color:#64748B;font-weight:600;margin-bottom:3px">'+k+'</div>'
    +'<div style="font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.15;color:'+c[2]
      +';font-variant-numeric:tabular-nums">'+v+'</div>'
    +'<div style="font-size:10.5px;color:#94A3B8;margin-top:2px">'+sub+'</div></div>';
}
function poLdgBox(h,em,lines){
  return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:11px 13px">'
    +'<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;'
      +'color:#475569;margin-bottom:5px"><span>'+h+'</span>'
    +'<span style="color:#94A3B8;font-weight:600">'+em+'</span></div>'+(lines||'')+'</div>';
}
function poLdgLine(nm,v,col){
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
    +'padding:3.5px 0;font-size:12.5px;border-top:1px solid #F1F5F9">'
    +'<span style="color:#334155">'+nm+'</span>'
    +'<b style="font-weight:700;font-variant-numeric:tabular-nums;color:'+(col||'#0F172A')+'">'+v+'</b></div>';
}
function poLedgerOpen(){
  var all=(PIER_MOVES||[]).filter(function(m){ return m.pier===_poPier; });
  var T={issue:'เบิก',['return']:'คืน',repair:'เสีย·ซ่อมได้',writeoff:'ตัดทิ้ง',lost:'หาย·ลค',onboard:'ค้างบนเรือ',
         laundry_out:'ส่งซัก',laundry_in:'รับเข้าจากซัก',fixed:'ซ่อมเสร็จ',adjust:'ปรับยอด'};
  /* สีป้ายประเภท · เบิกน้ำเงิน คืนเขียว หายแดง งานผ้าเหลือง ที่เหลือเทา */
  var TC={issue:['#EFF6FF','#1D4ED8'],['return']:['#ECFDF5','#047857'],
          lost:['#FEF2F2','#B91C1C'],writeoff:['#FEF2F2','#B91C1C'],repair:['#FFFBEB','#B45309'],
          laundry_out:['#FFFBEB','#92400E'],laundry_in:['#FFFBEB','#92400E']};

  /* ── รวมยอดทั้งท่า · ไม่สนตัวกรอง เพราะสรุปต้องเป็นภาพรวมเสมอ ───────────── */
  var S={issue:0,ret:0,lost:0,fine:0,fineN:0,nfN:0,nfQ:0,lout:0,lin:0,
         out:{},boat:{},kind:{},d0:'',d1:'',nf:[]};
  var dset={};
  all.forEach(function(m){
    var q=poNum(m.qty), t=m.type, id=m.itemId, bo=m.boatId||'';
    if(m.date){ dset[m.date]=1; if(!S.d0||m.date<S.d0) S.d0=m.date; if(!S.d1||m.date>S.d1) S.d1=m.date; }
    var it=poItem(id), kd=(it&&it.kind)||'';
    if(kd) S.kind[kd]=(S.kind[kd]||0)+1;
    if(t==='issue'){ S.issue+=q; S.out[id]=(S.out[id]||0)+q; S.boat[bo]=(S.boat[bo]||0)+q; }
    else if(t==='return'){ S.ret+=q; S.out[id]=(S.out[id]||0)-q; S.boat[bo]=(S.boat[bo]||0)-q; }
    else if(t==='lost'||t==='writeoff'){
      S.lost+=q; S.out[id]=(S.out[id]||0)-q; S.boat[bo]=(S.boat[bo]||0)-q;
      var f=poNum(m.fine);
      if(f>0){ S.fine+=f; S.fineN++; }
      else { S.nfN++; S.nfQ+=q; if(S.nf.length<4) S.nf.push({d:m.date,l:(it?it.label:id),q:q}); }
    }
    else if(t==='laundry_out') S.lout+=q;
    else if(t==='laundry_in') S.lin+=q;
  });
  var nDay=Object.keys(dset).length;
  var OUT=Object.keys(S.out).map(function(id){ return {id:id,v:S.out[id]}; })
    .filter(function(x){ return x.v>0; }).sort(function(a,b){ return b.v-a.v; });
  var outTot=OUT.reduce(function(s2,x){ return s2+x.v; },0);
  var BO=Object.keys(S.boat).map(function(b){ return {b:b,v:S.boat[b]}; })
    .sort(function(a,b){ return b.v-a.v; });
  var boOut=BO.filter(function(x){ return x.v>0; });

  var sum='';
  if(all.length){
    sum='<div style="font:700 11px/1 inherit;letter-spacing:.06em;color:#94A3B8;margin:0 0 8px">'
       +'สรุป · '+poE(S.d0)+(S.d1&&S.d1!==S.d0?(' – '+poE(S.d1)):'')+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-bottom:11px">'
      +poLdgCard('เคลื่อนไหวทั้งหมด', all.length, 'รายการ · '+nDay+' วัน','')
      +poLdgCard('เบิก / คืน', S.issue+' <span style="color:#CBD5E1;font-weight:600">/</span> '+S.ret, 'ชิ้น','')
      +poLdgCard('ยังไม่ได้คืน', outTot,
          outTot?('ชิ้น · '+OUT.length+' รายการ · '+boOut.length+' ลำ'):'คืนครบทุกรายการ',
          outTot?'amber':'green')
      +poLdgCard('หาย / ตัดทิ้ง', S.lost,
          'ชิ้น'+(S.fine?(' · ค่าปรับ '+poBaht(S.fine)):' · ยังไม่มีค่าปรับ'), S.lost?'rose':'')
      +'</div>';

    /* ของหายที่ยังไม่ได้ตั้งค่าปรับ · เงินที่ยังไม่ได้เรียกเก็บ ต้องเห็นก่อนยอดสะสม */
    if(S.nfN) sum+='<div style="background:#FEF2F2;border:1px solid #FECACA;color:#7F1D1D;border-radius:14px;'
      +'padding:11px 15px;font-size:12px;margin-bottom:9px">ของหาย <b style="color:#B91C1C">'+S.nfN
      +' รายการ ('+S.nfQ+' ชิ้น) ยังไม่ได้ตั้งค่าปรับ</b> · '
      +S.nf.map(function(x){ return poE(x.d)+' '+poE(x.l)+' ×'+x.q; }).join(' · ')
      +(S.nfN>S.nf.length?(' · และอีก '+(S.nfN-S.nf.length)):'')+'</div>';

    var two='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:9px;margin-bottom:11px';
    if(outTot) sum+='<div style="'+two+'">'
      +poLdgBox('ยังไม่ได้คืน · แยกรายการ', outTot+' ชิ้น',
          OUT.slice(0,6).map(function(x){ var it=poItem(x.id);
            var c=(it&&PO_KIND[it.kind])?PO_KIND[it.kind].c:'#94A3B8';
            return poLdgLine('<i style="display:inline-block;width:7px;height:7px;border-radius:50%;'
              +'background:'+c+';margin-right:6px;vertical-align:1px"></i>'+poE(it?it.label:x.id), x.v);
          }).join('')
          +(OUT.length>6?poLdgLine('<span style="color:#94A3B8">และอีก '+(OUT.length-6)+' รายการ</span>',
              OUT.slice(6).reduce(function(s2,x){ return s2+x.v; },0),'#94A3B8'):''))
      +poLdgBox('ยังไม่ได้คืน · แยกตามเรือ', boOut.length+' ลำ',
          BO.filter(function(x){ return x.v!==0 || x.b; }).slice(0,6).map(function(x){
            return poLdgLine(poE(poLdgBoatNm(x.b)), x.v>0?x.v:'ครบ', x.v>0?'#B45309':'#047857');
          }).join(''))
      +'</div>';

    var KL=Object.keys(S.kind).sort(function(a,b){ return S.kind[b]-S.kind[a]; });
    sum+='<div style="'+two+'">'
      +poLdgBox('ผ้าซัก', S.lout+' ส่ง / '+S.lin+' รับ',
          poLdgLine('ส่งซัก', S.lout)+poLdgLine('รับกลับ', S.lin)
          +poLdgLine('ค้างที่ร้าน', Math.max(0,S.lout-S.lin),
                     (S.lout-S.lin)>0?'#B45309':'#047857'))
      +poLdgBox('แยกตามประเภทของ', all.length+' รายการ',
          KL.map(function(k){ return poLdgLine(poE((PO_KIND[k]||{}).t||k), S.kind[k]); }).join(''))
      +'</div>';
  }

  /* ── ชิปกรองประเภท ─────────────────────────────────────────────── */
  var gc={};
  Object.keys(PO_LDG_G).forEach(function(k){
    gc[k]=(k==='all')?all.length
      :all.filter(function(m){ return PO_LDG_G[k].indexOf(m.type)>=0; }).length;
  });
  if(PO_LDG_G[_poLdgF]===undefined || (_poLdgF!=='all' && !gc[_poLdgF])) _poLdgF='all';
  var chips=all.length?('<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 9px">'
    +Object.keys(PO_LDG_G).map(function(k){
      if(k!=='all' && !gc[k]) return '';
      var on=(_poLdgF===k);
      return '<button onclick="poLdgFilter(\''+k+'\')" style="border:1px solid '+(on?'#0F172A':'#E2E8F0')
        +';background:'+(on?'#0F172A':'#fff')+';color:'+(on?'#fff':'#475569')
        +';border-radius:99px;padding:4px 11px;font:600 11.5px inherit;font-family:inherit;cursor:pointer">'
        +poE(PO_LDG_GN[k])+' <span style="opacity:.55">'+gc[k]+'</span></button>';
    }).join('')+'</div>'):'';

  /* ── ตาราง · เรียงวันที่ล่าสุดก่อน แล้วค่อยเวลาที่บันทึก ────────────────── */
  var sel=PO_LDG_G[_poLdgF];
  var rows=all.filter(function(m){ return !sel || sel.indexOf(m.type)>=0; })
    .sort(function(a,b){
      var da=String(a.date||''), db=String(b.date||'');
      if(da!==db) return da<db?1:-1;
      return String(b.at||'').localeCompare(String(a.at||''));
    }).slice(0,300);

  var body=rows.length?('<table class="po-t" style="width:100%"><thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th style="text-align:center">จำนวน</th><th>เรือ</th><th>โดย</th></tr></thead><tbody>'
    +rows.map(function(m){
      var it=poItem(m.itemId), bo=(typeof getBoat==='function'&&m.boatId)?getBoat(m.boatId):null;
      var tc=TC[m.type]||['#F1F5F9','#475569'], q=poNum(m.qty);
      return '<tr><td style="white-space:nowrap">'+poE(m.date)+'</td><td>'+poE(it?it.label:m.itemId)+'</td>'
        +'<td><span style="display:inline-block;background:'+tc[0]+';color:'+tc[1]
          +';border-radius:99px;padding:1px 8px;font-size:10.5px;font-weight:700;white-space:nowrap">'
          +poE(T[m.type]||m.type)+'</span>'
          +(m.fine?(' <span style="color:#B4560A;font-weight:700;font-size:11px">ค่าปรับ '+poBaht(m.fine)+'</span>'):'')+'</td>'
        +'<td style="text-align:center;font-weight:700'+(q<0?';color:#B91C1C':'')+'">'+q+'</td>'
        +'<td>'+poE(bo?(bo.name||m.boatId):(m.boatId||'—'))+'</td><td style="color:#7C8091">'+poE(m.by||'')+'</td></tr>';
    }).join('')+'</tbody></table>'
    +(rows.length>=300?'<div style="font-size:11px;color:#94A3B8;margin-top:8px">แสดง 300 รายการล่าสุด · ตัวสรุปข้างบนนับครบทุกรายการ</div>':'')
    +'<div style="font-size:11px;color:#94A3B8;margin-top:6px">เรียงตามวันที่ล่าสุดก่อน · ตัวเลขติดลบคือการแก้ยอดย้อนหลังของใบเดิม</div>')
    :'<div style="color:#9A9A93;font-size:12.5px;padding:16px 0">'
      +(all.length?'ไม่มีรายการในตัวกรองนี้':'ยังไม่มีรายการเคลื่อนไหวที่ท่านี้')+'</div>';

  var head=S.fineN?('<div class="po-warn" style="margin:0 0 11px">ค่าปรับของหาย/ลูกค้าไม่คืนสะสม <b>'+poBaht(S.fine)+'</b> จาก '+S.fineN+' รายการ · เก็บแยกจากยอด Booking</div>'):'';
  poModal('ประวัติการเคลื่อนไหว · '+poE(poPierName()),
    '<style>'+poCSS().replace(/\.po-host/g,'#po-modal')+'</style>'+sum+head+chips+body,
    poBtn('ปิด','poModalClose()'), 880);
}

/* §poSign2 · สี Agent ของใบเซ็นโดยเฉพาะ · คนละชุดกับสีในหน้าจอง
   หน้าจองใช้สีไว้กวาดตาหาใบ · ใบเซ็นใช้สีไว้แยกกองตอนแจกของหน้าท่า
   คนละคนดู คนละงาน · มัดให้ใช้สีเดียวกันแล้วจะมีฝ่ายหนึ่งเสียเสมอ
   เก็บใน PIER_CFG ซึ่ง poPersist ส่งขึ้นฐานข้อมูลอยู่แล้ว · ตั้งที่เครื่องไหนก็เห็นทุกเครื่อง */
function poSignColors(){
  if(!PIER_CFG.signAgentColors || typeof PIER_CFG.signAgentColors!=='object') PIER_CFG.signAgentColors={};
  return PIER_CFG.signAgentColors;
}
function poSignColor(agId){ return (agId && poSignColors()[agId]) || ''; }
function poSignColorSet(agId, hex){
  var M=poSignColors();
  if(hex) M[agId]=hex; else delete M[agId];
  try{ poPersist(); }catch(_){}
}
function poSignColorClear(bid, agId){ poSignColorSet(agId,''); poSignSheet(bid); }
function poSignKindsGet(){
  try{ var v=JSON.parse(localStorage.getItem(PO_SIGN_KEY)||'null');
       if(Array.isArray(v)) return v.filter(function(k){ return PO_KIND[k]; }); }catch(_){}
  return null;
}
function poSignKindsSave(list){ try{ localStorage.setItem(PO_SIGN_KEY, JSON.stringify(list||[])); }catch(_){} }

/* ── หน้าถามก่อนพิมพ์ · เลือกว่าจะเอาของประเภทไหนขึ้นใบ ── */
function poSignSheet(bid){
  var B=poBoats(_poDate,_poPier).filter(function(x){return x.bid===bid;})[0];
  if(!B){ alert('ไม่พบเรือลำนี้ในวันที่เลือก'); return; }
  poKindSync();
  var items=poItems(_poPier), S=poBoatSum(_poDate,bid,_poPier);
  /* ประเภทที่ "เบิกจริงวันนี้" · ใช้เป็นค่าตั้งต้นครั้งแรก เพราะเป็นของที่อยู่บนเรือแน่ ๆ */
  var issued=PO_KORDER.filter(function(k){
    return items.some(function(it){ return it.kind===k && S[it.id] && S[it.id].iss>0; }); });
  var pick=poSignKindsGet();
  if(!pick) pick=(issued.length?issued:PO_KORDER.slice(0,2));
  var e=poE;
  var body='<div style="font-size:12px;color:#7C8091;line-height:1.6;margin-bottom:11px">'
    +'ประเภทของมาจาก<b>ทะเบียนของ</b> · เพิ่มประเภทใหม่แล้วจะมาโผล่ที่นี่เอง<br>'
    +'ติ๊กเฉพาะที่จะใช้จริงวันนี้ · ยิ่งติ๊กเยอะคอลัมน์ยิ่งแคบ กระดาษมีอยู่เท่าเดิม · '
    +'<b>ที่ติ๊กไว้จะจำไว้ให้</b> ครั้งหน้าเปิดมาเป็นชุดเดิม</div>';
  body+=PO_KORDER.map(function(k){
    var KM=PO_KIND[k]||{t:k,u:'ชิ้น',c:'#9A9A93'}, on=pick.indexOf(k)>=0, iss=issued.indexOf(k)>=0;
    return '<label style="display:flex;align-items:center;gap:9px;padding:8px 11px;margin-bottom:6px;'
      +'border:1px solid '+(on?'#16265C33':'#E3E3DF')+';border-radius:10px;cursor:pointer;'
      +'background:'+(on?'#F5F7FB':'#fff')+'">'
      +'<input type="checkbox" class="po-sgk" value="'+e(k)+'"'+(on?' checked':'')
        +' onchange="this.parentNode.style.background=this.checked?\'#F5F7FB\':\'#fff\'" style="cursor:pointer">'
      +'<span style="width:11px;height:11px;border-radius:3px;background:'+e(KM.c)+';flex:0 0 auto"></span>'
      +'<span style="font-weight:700;font-size:12.5px;color:#16265C">'+e(KM.t)+'</span>'
      /* §poKindEn · ชื่อที่จะไปขึ้นบนกระดาษจริง · ยังไม่ตั้งก็เตือนตรงนี้เลย จะได้ไม่ไปเจอตอนพิมพ์แล้ว */
      +(KM.e ? '<span style="font-size:11px;font-weight:700;color:#185FA5;letter-spacing:.02em">'+e(KM.e)+'</span>'
             : '<span style="font-size:10.5px;color:#B4560A" title="หัวคอลัมน์ในใบเซ็นจะเป็นภาษาไทย · '
               +'ตั้งชื่ออังกฤษได้ที่ ทะเบียนของ → ประเภทของ">ยังไม่มีชื่ออังกฤษ</span>')
      +'<span style="font-size:11px;color:#8a8a82">'+e(KM.u)+'</span>'
      +(iss?'<span style="margin-left:auto;font-size:10.5px;font-weight:700;color:#047857;'
        +'background:#ECFDF5;border-radius:999px;padding:2px 9px">เบิกวันนี้</span>':'')
      +'</label>'; }).join('');
  if(!PO_KORDER.length) body+='<div style="font-size:12px;color:#B4560A">ยังไม่ได้ตั้งประเภทของ · '
    +'ใบเซ็นจะออกมาโดยไม่มีคอลัมน์ของ</div>';

  /* §poSign2 · ตั้งสี Agent ของใบนี้ · เฉพาะเอเจนต์ที่มีคนอยู่บนลำนี้วันนี้จริง ๆ
     ไม่ยกทั้งทะเบียนมากอง เพราะที่ต้องแยกกองคือของที่อยู่ตรงหน้า ไม่ใช่ทั้งบริษัท */
  var AG={}, agOrd=[];
  B.bks.forEach(function(x){
    var id=x.b.agentId; if(!id || AG[id]) return;
    var a=(typeof sbGetAgent==='function')?sbGetAgent(id):null;
    AG[id]=(a&&a.name)||id; agOrd.push(id);
  });
  body+='<div style="margin-top:16px;border-top:1px dashed #D8D4CA;padding-top:13px">'
    +'<div style="font-size:11.5px;font-weight:800;color:#16265C;margin-bottom:3px">สี Agent ในใบเซ็น</div>'
    +'<div style="font-size:11px;color:#8a8a82;line-height:1.6;margin-bottom:9px">'
      +'สีชุดนี้<b>ใช้เฉพาะใบเซ็น</b> · ไม่เกี่ยวกับสีเอเจนต์ในหน้าจอง แก้ที่นี่ไม่กระทบที่นั่น<br>'
      +'ตั้งครั้งเดียวจำไว้ให้ · ขึ้นทุกใบทุกวันจนกว่าจะเปลี่ยนเอง · ไม่ตั้งก็ปล่อยเป็นช่องขาว</div>';
  body+=agOrd.length ? agOrd.map(function(id){
      var c=poSignColor(id);
      return '<div style="display:flex;gap:9px;align-items:center;margin-bottom:6px">'
        +'<input type="color" value="'+(c||'#ffffff')+'" title="เลือกสีของ '+e(AG[id])+'" '
          +'onchange="poSignColorSet(\''+e(id)+'\',this.value)" '
          +'style="width:30px;height:28px;border:1px solid #D8D4CA;border-radius:7px;background:none;cursor:pointer;padding:1px">'
        +'<span style="flex:1;font-weight:700;font-size:12.5px;color:#16265C">'+e(AG[id])+'</span>'
        + (c?('<button class="po-btn" onclick="poSignColorClear(\''+bid+'\',\''+e(id)+'\')">ล้างสี</button>')
            :'<span style="font-size:11px;color:#b8b6ad">ยังไม่ตั้ง</span>')
        +'</div>'; }).join('')
    : '<div style="font-size:11.5px;color:#b8b6ad">ลำนี้ยังไม่มีใบจองของเอเจนต์ · '
      +'งานที่มาจาก Love Andaman เองจะขึ้นเป็นโลโก้ ไม่ใช้สี</div>';
  body+='</div>';

  poModal('ใบเซ็น · '+e(B.boat.name||bid)+' · '+e((B.route&&B.route.name)||''), body,
    poBtn('ปิด','poModalClose()')+poBtn('เปิดใบเซ็น','poSignGo(\''+bid+'\')',1), 520);
}
function poSignGo(bid){
  var ks=[];
  try{ [].slice.call(document.querySelectorAll('#po-modal .po-sgk')).forEach(function(x){
         if(x.checked) ks.push(x.value); }); }catch(_){}
  poSignKindsSave(ks); poModalClose(); poSignPrint(bid, ks);
}

function poSignPrint(bid, kinds){
  var B=poBoats(_poDate,_poPier).filter(function(x){return x.bid===bid;})[0];
  if(!B){ alert('ไม่พบเรือลำนี้ในวันที่เลือก'); return; }
  var e=poE, P=PO_PIERS.filter(function(p){return p.k===_poPier;})[0]||PO_PIERS[0];
  var KS=(kinds||[]).filter(function(k){ return PO_KIND[k]; });

  /* ── หนึ่งแถวต่อหนึ่งใบจอง · ชื่อทุกคนซ้อนกันในช่องเดียว เหมือนไฟล์ที่ใช้อยู่ ── */
  var rows=B.bks.map(function(x){
    var b=x.b, t=x.t;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,_poDate):(b.ops||{});
    var van=(O&&O.vanId&&typeof vehGet==='function')?vehGet(O.vanId):null;
    var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var names=[];
    (b.passengers||[]).forEach(function(p){ if(p&&p.name) names.push(String(p.name)); });
    if(!names.length && b.leadPax) names.push(String(b.leadPax));
    var tel=String(b.leadPhone||b.phone||'').trim();
    if(tel) names.splice(1,0,tel);   /* เบอร์อยู่ใต้ชื่อคนแรก เหมือนที่เขาเขียนกันในไฟล์ */
    var px=(t&&t.pax)||{}, PT=(typeof bkV2PaxTot==='function')?bkV2PaxTot:function(){return 0;};
    var _PL=poPaxLeft(b,_poDate,t);   /* §poPaxReal · คนที่ไปจริง */
    var _bk=PT(px,'ad')+PT(px,'chd')+PT(px,'inf')+PT(px,'foc');
    return {
      bkId: b.id||'',   /* §poSheet · ไว้จับคู่กับใบเบิก–คืน */
      booked:_bk, gone:(_bk>0 && _PL.tot===0),   /* ทั้งใบไม่ได้ไป */
      agN: ag?(ag.name||''):'',
      /* §poSign2 · สีของใบเซ็นเอง · ไม่ตั้งก็ปล่อยขาว ไม่ไปหยิบสีของหน้าจองมาใส่แทน */
      agC: poSignColor(b.agentId),
      /* งานของ Love Andaman เอง · ขึ้นโลโก้ชุดเดียวกับหน้าอื่นทั้งระบบ */
      agLa: (typeof laAgencyMark==='function')?laAgencyMark(b,14,{inline:true,margin:false,pad:'2px 7px',radius:'6px'}):'',
      names: names.length?names:[''],
      ad:_PL.ad, chd:_PL.chd, inf:_PL.inf, foc:_PL.foc,
      car: van?(van.name||van.id||''):'',
      pu:  b.hotelName||b.pickup||'' };
  });
  /* §poOrder · ตัวเรียงย้ายไปอยู่ที่เดียวกับใบเบิก–คืน (poRowCmp)
     เดิมเขียนแยกกันสองที่ · ที่หนึ่งเรียง อีกที่ไม่เรียง แล้วไม่มีใครรู้จนกระดาษไม่ตรงจอ */
  rows.sort(poRowCmp);

  /* ── ความกว้างคอลัมน์ · คิดเป็นน้ำหนักแล้วหารเป็น % ทีเดียว
        จะได้ไม่ล้นกระดาษไม่ว่าติ๊กของมากี่ประเภท ── */
  /* §poSign4 · 8 คอลัมน์ซ้าย · Voucher ออกไปอีกช่อง
     ที่ว่างกระจายไปทุกคอลัมน์ตามสัดส่วนอยู่แล้ว · เติมให้ชื่อกับจุดรับเพิ่มอีก
     เพราะสองช่องนั้นคือที่ที่ตัวหนังสือตกบรรทัดบ่อยที่สุด */
  var WL=[7.4,15.6,2.4,3.0,2.8,3.2,4.0,14.0];
  var wArr=WL.slice(), n=KS.length;
  for(var g=0; g<2; g++){
    for(var q=0;q<n;q++) wArr.push(3.0);   /* ของแต่ละประเภท · แค่ติ๊กจำนวน ไม่ต้องกว้าง */
    wArr.push(4.0); wArr.push(8.6); wArr.push(6.0);   /* DEPOSIT/RETURN · Signature · Remark */
  }
  wArr.push(2.6); wArr.push(3.0); wArr.push(6.6);     /* Money Change · Give / Return / Signature */
  var wSum=0; wArr.forEach(function(w){ wSum+=w; });
  var pc=function(w){ return (w/wSum*100).toFixed(3)+'%'; };
  var cols='<colgroup>'+wArr.map(function(w){ return '<col style="width:'+pc(w)+'">'; }).join('')+'</colgroup>';
  /* คอลัมน์ยิ่งเยอะตัวยิ่งเล็ก · ทุกอย่างต้องอยู่แผ่นเดียว */
  var fs = wArr.length<=25 ? 8.6 : (wArr.length<=29 ? 8.0 : 7.4);

  var css='@page{size:A4 landscape;margin:7mm}'
   /* §poSign3 · เบราว์เซอร์ตัดสีพื้นหลังทิ้งตอนพิมพ์เป็นค่าเริ่มต้น เพื่อประหยัดหมึก
      แต่ใบนี้ใช้สีเป็นข้อมูล · ชมพู=ขารับ เหลือง=ขาคืน สี Agent=ตัวแยกกองตอนแจกของ
      ตัดสีทิ้งแล้วใบเสียความหมายไปครึ่งใบ · จึงบังคับให้พิมพ์สีเสมอ */
   +'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}'
   +'body{margin:0;background:#E9EBEF;font-family:"Noto Sans Thai","DM Sans",sans-serif;color:#111}'
   +'.tb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:1160px;margin:0 auto 14px}'
   +'.tb button{border:1px solid #E2E8F0;background:#fff;border-radius:11px;padding:8px 15px;'
     +'font:700 12.5px inherit;color:#475569;cursor:pointer}'
   +'.tb button.pri{background:#0F172A;border-color:#0F172A;color:#fff}'
   +'.tb button.img{background:#4F46E5;border-color:#4F46E5;color:#fff}'
   +'.tb button[disabled]{opacity:.55;cursor:progress}'
   +'.tb .hint{font-size:11px;color:#94A3B8}'
   +'.sheet{background:#fff;margin:0 auto;padding:10px 12px 14px;border:1px solid #CBD5E1;border-radius:6px;'
     +'max-width:1160px;box-shadow:0 2px 12px rgba(15,23,42,.07)}'
   +'@media screen{body{padding:18px 16px 60px}}'
   +'@media print{body{background:#fff;padding:0}.tb{display:none}'
     +'.sheet{max-width:none;border:0;border-radius:0;box-shadow:none;padding:0;margin:0}}'
   /* หัวกระดาษ · โลโก้กลางแผ่น แล้วขีดน้ำเงินคาด เหมือนไฟล์เดิมเป๊ะ */
   +'.lg{display:flex;justify-content:center;padding:2px 0 6px}'
   +'.lg img{height:30px;width:auto;display:block}'
   +'.hrow{display:flex;align-items:center;gap:12px;border-top:2px solid #1E5FA8;padding:6px 2px 8px}'
   +'.hrow .rn{font-size:14px;font-weight:800;color:#C00000;line-height:1.2}'
   +'.hrow .bt{font-size:11px;font-weight:700;color:#475569}'
   +'.hrow .dt{flex:1;text-align:center;font-size:14px;font-weight:800;color:#111}'
   +'.hrow .dn{background:#00B050;color:#fff;font-weight:800;font-size:15px;border-radius:3px;'
     +'padding:3px 16px;min-width:64px;text-align:center;line-height:1.3}'
   +'table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:'+fs+'px}'
   +'th,td{border:1px solid #9AA3AE;padding:2px 3px;word-break:break-word;overflow:hidden}'
   /* หัวตารางชั้นล่างตัวเล็กลงหน่อย · ชื่อประเภทของเป็นภาษาไทยยาวกว่า FINS/TOWEL ในไฟล์เดิม */
   +'thead th{background:#fff;font-weight:700;text-align:center;line-height:1.2;font-size:'+(fs-0.8)+'px;padding:3px 1px}'
   +'thead tr.g th{font-size:'+(fs+2)+'px;padding:4px 2px}'
   /* สามช่วงสีตามไฟล์ · ชมพูขารับ เหลืองขาคืน ขาวเงินทอน */
   +'th.gp{background:#E7A9A9}td.pk{background:#F6DDDD}'
   +'th.gr{background:#FFD98A}td.rt{background:#FDF0D2}'
   +'th.gm{background:#fff}td.mn{background:#fff}'
   +'td{height:'+(fs*3.1).toFixed(0)+'px;vertical-align:middle}'
   +'td.c{text-align:center}'
   +'td.nm{padding:2px 4px;line-height:1.3}'
   +'td.nm span{display:block}'
   /* ช่อง Agent ทาสีเต็มช่อง · สีมาจากที่ผู้ใช้ตั้งไว้ให้ Agent นั้นในหน้าจอง */
   +'td.ag{padding:0}'
   +'td.ag .chip{display:flex;align-items:center;justify-content:center;height:100%;min-height:'+(fs*3.1).toFixed(0)+'px;'
     +'font-weight:800;font-size:'+(fs-0.3)+'px;line-height:1.2;text-align:center;padding:2px 3px}'
   +'td.ag .la{display:flex;align-items:center;justify-content:center;padding:2px}'
   +'.sg{display:flex;gap:16px;margin-top:10px}'
   +'.sg div{flex:1;border-top:1px solid #94A3B8;padding-top:4px;text-align:center;font-size:9px;color:#64748B}'
   /* §poPaxReal · ใบที่คนไม่มาทั้งใบ · ยังพิมพ์ไว้ให้เห็น แต่ขีดฆ่าและไม่นับยอด
      ลบทิ้งไม่ได้ · ใบที่พิมพ์รอบเช้ากับรอบสายต้องเทียบกันได้บรรทัดต่อบรรทัด */
   +'tr.gone td{background:#F6F4F1;color:#A0A0A0}'
   +'tr.gone td.nm span{text-decoration:line-through}'
   +'tr.gone td.ag .chip{filter:grayscale(1);opacity:.5}';

  var th=function(t,cls,span,rs){ return '<th'+(cls?' class="'+cls+'"':'')
    +(span?' colspan="'+span+'"':'')+(rs?' rowspan="'+rs+'"':'')+'>'+t+'</th>'; };
  var L8=['Agent','Customer&#39;s Name','AD','CHD','INF','FOC','Car','Pickup'];
  var head='<thead><tr class="g">'
    + L8.map(function(t){ return th(t, '', 0, 2); }).join('')
    + th('Pick-up','gp',KS.length+3) + th('Return','gr',KS.length+3) + th('Money Change','gm',3)
    +'</tr><tr>'
    /* §poKindEn · ใบนี้เป็นภาษาอังกฤษทั้งใบ · ยังไม่ได้ตั้งชื่ออังกฤษก็ใช้ชื่อไทยไปก่อน */
    + KS.map(function(k){ return th(e(PO_KIND[k].e||PO_KIND[k].t),'gp'); }).join('')
    + th('DEPOSIT','gp')+th('Signature','gp')+th('Remark','gp')
    + KS.map(function(k){ return th(e(PO_KIND[k].e||PO_KIND[k].t),'gr'); }).join('')
    + th('RETURN','gr')+th('Signature','gr')+th('Remark','gr')
    + th('Give','gm')+th('Return','gm')+th('Signature','gm')
    +'</tr></thead>';

  var blanks=function(){
    return KS.map(function(){ return '<td class="pk"></td>'; }).join('')+'<td class="pk"></td><td class="pk"></td><td class="pk"></td>'
         + KS.map(function(){ return '<td class="rt"></td>'; }).join('')+'<td class="rt"></td><td class="rt"></td><td class="rt"></td>'
         + '<td class="mn"></td><td class="mn"></td><td class="mn"></td>'; };
  var EMPTY=blanks();
  /* §poSheet · ตัวเลขที่กรอกในกล่อง "เบิก–คืน" ขึ้นบนกระดาษเลย · ช่องไหนยังไม่กรอกก็ปล่อยว่างให้เขียนมือ
     ของเดิมพิมพ์ใบเปล่าเสมอ แล้วต้องมาลอกใส่จอทีหลังอีกรอบ */
  var SH=(typeof poIsSaved==='function')?poIsSaved(_poDate,bid):null;
  var SHR={}; if(SH && Array.isArray(SH.rows)) SH.rows.forEach(function(r){ if(r&&r.bkId) SHR[r.bkId]=r; });
  var money=function(v){ v=+v||0; return v?Math.round(v).toLocaleString():''; };
  var cells=function(R){
    if(!R) return EMPTY;
    var q=function(o,k){ var v=+((o||{})[k])||0; return v?String(v):''; };
    return KS.map(function(k){ return '<td class="pk c">'+q(R.iss,k)+'</td>'; }).join('')
      +'<td class="pk c">'+money(R.dep)+'</td><td class="pk"></td><td class="pk"></td>'
      + KS.map(function(k){ return '<td class="rt c">'+q(R.ret,k)+'</td>'; }).join('')
      +'<td class="rt c">'+money(R.back)+'</td><td class="rt"></td>'
      +'<td class="rt" style="font-size:'+(fs-1.2)+'px;padding:2px 3px">'+e(R.note||'')+'</td>'
      +'<td class="mn"></td><td class="mn"></td><td class="mn"></td>';
  };
  /* แถวที่หน้าท่าเพิ่มเอง (ไกด์/สตาฟ/ลูกค้านอกใบจอง) · ขึ้นบนกระดาษด้วย ไม่งั้นของหายไปจากใบ */
  var xtra=(SH && Array.isArray(SH.rows))?SH.rows.filter(function(r){ return r && r.extra; }):[];
  var bn=e(B.boat.name||bid);
  var body=rows.map(function(r){
    var ink=(r.agC&&typeof bkV2ContrastInk==='function')?bkV2ContrastInk(r.agC):'#2c2c2a';
    return '<tr'+(r.gone?' class="gone"':'')+'>'
      +'<td class="ag">'+(r.agLa ? '<span class="la">'+r.agLa+'</span>'
          : r.agN ? '<span class="chip" style="background:'+e(r.agC||'#fff')+';color:'+(r.agC?ink:'#2c2c2a')+'">'+e(r.agN)+'</span>'
          : '')+'</td>'
      +'<td class="nm">'+r.names.map(function(x){ return '<span>'+e(x)+'</span>'; }).join('')
        +(r.gone?'<span style="text-decoration:none;font-weight:800;color:#A32D2D">&#10007; ไม่ได้ไป</span>':'')+'</td>'
      +'<td class="c">'+(r.ad||'')+'</td><td class="c">'+(r.chd||'')+'</td>'
      +'<td class="c">'+(r.inf||'')+'</td><td class="c">'+(r.foc||'')+'</td>'
      +'<td class="c">'+e(r.car)+'</td>'
      +'<td class="c">'+e(r.pu)+'</td>'
      + cells(SHR[r.bkId]) +'</tr>'; }).join('')
   + xtra.map(function(R){
       return '<tr><td class="ag"><span class="chip" style="background:#F0F0EC;color:#2c2c2a">'
         +e(R.agN||'STAFF')+'</span></td>'
         +'<td class="nm"><span>'+e(R.label||'')+'</span></td>'
         +'<td class="c">'+((+R.ad||0)||'')+'</td><td class="c"></td><td class="c"></td><td class="c"></td>'
         +'<td class="c"></td><td class="c"></td>'+cells(R)+'</tr>'; }).join('')
   /* แถวว่างท้ายใบ · ที่หน้าท่ามีลูกค้าโผล่มาเพิ่มเสมอ เขียนมือลงไปได้เลย */
   + Array.apply(null,{length:Math.max(2, 6-xtra.length)}).map(function(){
       return '<tr><td class="ag"></td><td></td><td></td><td></td><td></td><td></td>'
         +'<td></td><td></td>'+EMPTY+'</tr>'; }).join('');

  var tot=0; rows.forEach(function(r){ tot+=(r.ad||0)+(r.chd||0)+(r.inf||0)+(r.foc||0); });
  var DW=(typeof pjDateWords==='function')?pjDateWords(_poDate):{big:_poDate};
  var sheet='<div class="sheet" id="sheet">'
    +'<div class="lg"><img src="'+LA_LOGO_FULL+'" alt="LOVE andaman"></div>'
    +'<div class="hrow">'
      +'<span class="rn">'+e((B.route&&B.route.name)||'')+'</span>'
      +'<span class="bt">'+bn+(B.dep?(' · '+e(B.dep)):'')+'</span>'
      +'<span class="dt">'+e(DW.sm||_poDate)+'</span>'
      +'<span class="dn">'+tot+'</span>'
    +'</div>'
    +'<table>'+cols+head+'<tbody>'+body+'</tbody></table>'
    +'<div class="sg"><div>Issued by (AM)</div><div>Received by (PM)</div><div>Pier Supervisor</div></div>'
    +'</div>';

  var fn=('signsheet_'+(P.k||_poPier||'pier')+'_'+(B.boat.name||bid)+'_'+_poDate)
    .replace(/[^A-Za-z0-9_.-]+/g,'_');
  var scr=pjShotScript(fn);

  var html='<!doctype html><html lang="th"><head><meta charset="utf-8">'
   +'<title>ใบเซ็น · '+e(B.boat.name||bid)+' · '+e(_poDate)+'</title>'
   +'<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" rel="stylesheet">'
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
  /* ไม่สั่งพิมพ์เอง · ให้ดูก่อนแล้วเลือกเองว่าจะพิมพ์หรือเก็บเป็นรูป เหมือนใบงานเรือ */
  setTimeout(function(){ try{ w.focus(); }catch(_){} }, 300);
}
