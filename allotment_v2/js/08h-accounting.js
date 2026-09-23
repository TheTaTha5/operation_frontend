// 08h-accounting.js · Accounting · daily PFM · travel summary
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.


// §permGate (LAM-17) · sb_bookings is written from BOTH the operations area (van/boat ops, check-in)
// AND the accounting area (invoice/payment writes stamp bk.invoiceId/paymentStatus/history on the
// same SB_BOOKINGS rows — see acctCreateInvoice/acctRecordPayment/acctVoidInvoice just above/below).
// Gating this on 'operations' alone let an accounting-only user's sbInvoicesPersist() (gated
// 'accounting') succeed while this sibling call silently no-op'd — invoiceId/paymentStatus/history
// stayed in RAM only and were lost on refresh. Mirror ckCanEdit's OR-of-areas pattern (operations||pier)
// so either area that legitimately writes this table can persist it.
function acctCanEditBookings(){ return (typeof window.laCanEditArea!=='function') || window.laCanEditArea('operations') || window.laCanEditArea('accounting'); }
function acctPersistBookings(){ if(!acctCanEditBookings()) return;
  if(typeof baChMemoClear==='function') baChMemoClear();   // §boatSplit · ข้อมูลเปลี่ยนแล้ว แคชเรือเหมาต้องหมดอายุทันที
  try{ laBlob().sb_bookings=SB_BOOKINGS; laBlobSave(); }catch(e){ console.warn('persist sb_bookings failed',e);} }
function acctBookingBase(bk){ return (bk&&(bk.total || (bk.priceBreakdown&&bk.priceBreakdown.total)))||0; }
function acctBookingTotal(bk){ if(!bk) return 0; const fees=(bk.feeItems||[]).reduce((s,f)=>s+(+f.amount||0),0); return acctBookingBase(bk)+fees; }
function acctFmt(n){ return '฿'+Math.round(n||0).toLocaleString(); }
function acctInvoicePaid(inv){
  let p=0; SB_PAYMENTS.forEach(x=>{ if(x.invoiceId!==inv.id) return; p += (x.type==='refund'? -Math.abs(x.amount||0) : (x.amount||0)); });
  return p;
}
function acctInvoiceBalance(inv){ if(inv && inv.status==='void') return 0; return Math.max(0, (inv.total||0) - acctInvoicePaid(inv)); }
function acctInvoiceState(inv){
  if(inv.status==='void') return 'void';
  if(acctInvoiceBalance(inv)<=0 && (inv.total||0)>0) return 'paid';
  if(acctInvoicePaid(inv)>0) return 'partial';
  return 'issued';
}
function acctBookingInvoice(bkId){ return SB_INVOICES.find(iv => iv.status!=='void' && (iv.bookingIds||[]).includes(bkId)) || null; }
function acctBookingPaid(bk){ const iv=acctBookingInvoice(bk.id); return !!(iv && acctInvoiceBalance(iv)<=0); }

function acctNextInvoiceNo(){
  const ym=new Date(); const pre='INV-'+String(ym.getFullYear()).slice(2)+String(ym.getMonth()+1).padStart(2,'0');
  let n=0; SB_INVOICES.forEach(i=>{ if((i.number||'').startsWith(pre)){ const k=parseInt((i.number.split('-')[2]||'0'),10); if(k>n)n=k; } });
  return pre+'-'+String(n+1).padStart(4,'0');
}
function acctCreateInvoice(agentId, bookingIds, dueDays){
  const ids=(bookingIds||[]).filter(Boolean);
  if(!ids.length) return null;
  const subtotal=ids.reduce((s,id)=>{ const b=SB_BOOKINGS.find(x=>x.id===id); return s+acctBookingTotal(b); },0);
  const now=new Date(); const due=new Date(now.getTime()+ (dueDays||0)*86400000);
  const _a=sbGetAgent(agentId); const vm=(_a&&_a.vatMode)||'none'; const rate=0.07;
  let net=subtotal, vat=0, total=subtotal;
  if(vm==='exclude'){ net=subtotal; vat=Math.round(net*rate); total=net+vat; }
  else if(vm==='include'){ total=subtotal; net=Math.round(subtotal/(1+rate)); vat=subtotal-net; }
  const inv={ id:LA_UID('inv_'), number:acctNextInvoiceNo(), agentId, bookingIds:ids, lineItems:[], subtotal, netAmount:net, vatMode:vm, vatRate:rate, vatAmount:vat, depositApplied:0, total, issuedAt:now.toISOString(), dueAt:due.toISOString(), status:'issued', createdBy:laBy() };
  SB_INVOICES.push(inv); sbInvoicesPersist();
  ids.forEach(id=>{ const b=SB_BOOKINGS.find(x=>x.id===id); if(b){ b.invoiceId=inv.id; b.paymentStatus='invoiced'; if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'invoice','Invoice '+inv.number+' issued · ฿'+Math.round(total).toLocaleString()+(vat>0?' (incl. VAT)':''),'Invoice'); } });
  acctPersistBookings();
  return inv;
}
// Custom fixed-amount invoice (e.g. cancellation fee) · no VAT · stands alone as a receivable
function acctCreateFeeInvoice(agentId, bookingId, amount, note, feeType){
  const amt=Math.max(0, Math.round(Number(amount)||0)); if(amt<=0) return null;
  const now=new Date();
  const inv={ id:LA_UID('inv_'), number:acctNextInvoiceNo(), agentId, bookingIds:[bookingId], lineItems:[{label:note||'Cancellation fee', amount:amt}], subtotal:amt, netAmount:amt, vatMode:'none', vatRate:0, vatAmount:0, depositApplied:0, total:amt, issuedAt:now.toISOString(), dueAt:now.toISOString(), status:'issued', createdBy:laBy(), feeType:feeType||'cancellation', note:note||'' };
  SB_INVOICES.push(inv); sbInvoicesPersist();
  return inv;
}
function acctRecordPayment(invoiceId, amount, method, opt){
  opt=opt||{};
  const inv=SB_INVOICES.find(i=>i.id===invoiceId); if(!inv) return;
  const amt=Math.max(0, +amount||0); if(amt<=0) return;
  const pay={ id:LA_UID('pay_'), invoiceId, agentId:inv.agentId, amount:amt, method:method||'transfer', date:new Date().toISOString(), type:'payment' };
  if(opt.ref) pay.ref=String(opt.ref);
  if(Array.isArray(opt.slips)&&opt.slips.length) pay.slips=opt.slips.slice();   // payment-slip attachment refs (id/name/mime)
  SB_PAYMENTS.push(pay);
  sbPaymentsPersist();
  const bal=acctInvoiceBalance(inv);
  inv.status = bal<=0 ? 'paid' : 'partial';
  sbInvoicesPersist();
  (inv.bookingIds||[]).forEach(id=>{ const b=SB_BOOKINGS.find(x=>x.id===id); if(b){ b.paymentStatus=(bal<=0?'paid':'partial'); if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'payment','Payment ฿'+Math.round(amt).toLocaleString()+' ('+(method||'transfer')+')'+(bal<=0?' · paid in full':' · partial'),'Payment'); } });
  acctPersistBookings();
}
function acctToggleVoid(){ _acctShowVoid=!_acctShowVoid; renderAccounting(); }
function acctVoidInvoice(invoiceId){
  const inv=SB_INVOICES.find(i=>i.id===invoiceId); if(!inv) return;
  inv.status='void'; sbInvoicesPersist();
  (inv.bookingIds||[]).forEach(id=>{ const b=SB_BOOKINGS.find(x=>x.id===id); if(b){ b.invoiceId=null; b.paymentStatus='unpaid'; } });
  acctPersistBookings();
}
function acctStateChip(st){ const c=ACCT_STATE_CHIP[st]||ACCT_STATE_CHIP.issued; return `<span style="background:${c[0]};color:${c[1]};font-size:10px;font-weight:600;padding:2px 9px;border-radius:8px;white-space:nowrap">${c[2]}</span>`; }
function pfmSetMode(m){ _pfmMode=m; renderDailyPFM(); }
// Live filter the day-cards' rows by search text + status (no re-render → keeps input focus)
function pfmFilterRows(){
  const host=document.getElementById('dailypfm-host'); if(!host) return;
  const si=host.querySelector('#pfm-search'); const fi=host.querySelector('#pfm-filter');
  if(si) _pfmSearch=si.value; if(fi) _pfmFilter=fi.value;
  const q=(_pfmSearch||'').trim().toLowerCase(); const f=_pfmFilter||'all';
  host.querySelectorAll('[data-pfmcard]').forEach(card=>{
    let vis=0;
    card.querySelectorAll('tr[data-pfmrow]').forEach(tr=>{
      const txt=tr.getAttribute('data-pfmrow')||''; const st=tr.getAttribute('data-pfmst')||'';
      const ok=(!q||txt.indexOf(q)>=0) && (f==='all'||st===f);
      tr.style.display=ok?'':'none'; if(ok)vis++;
    });
    card.style.display=vis?'':'none';
  });
}
function pfmSetDate(delta){ const d=new Date(_pfmDate+'T12:00:00'); const m=_pfmMode||'daily'; if(m==='week') d.setDate(d.getDate()+delta*7); else if(m==='month') d.setMonth(d.getMonth()+delta); else if(m==='year') d.setFullYear(d.getFullYear()+delta); else d.setDate(d.getDate()+delta); _pfmDate=bkV2LocalYMD(d); renderDailyPFM(); }
function pfmIsProforma(bk){ const a=sbGetAgent(bk.agentId); return !!(a && a.payType==='proforma'); }
function pfmSalesName(bk){ const sid = bk.soldBy || (sbGetAgent(bk.agentId)||{}).sales; const s=sid?sbGetSales(sid):null; return s?(s.name||sid):'—'; }
/* §pfmCotWarn (2026-09-15) · Daily PFM กับคำตัดสิน COT ยังไม่รู้จักกัน
   PFM คิดยอดจาก acctBookingTotal() ตรง ๆ · ไม่เคยเรียก tsCotGet/bkV2CotOf เลย
   ส่วน acctCreateInvoice() ก็ใช้ acctBookingTotal() เหมือนกัน
   ผลคือ ใบที่เก็บเงินสดหน้าท่าแล้วกด "หักทั้งก้อน" ที่ Travel Summary
   ยังขึ้นค้างเต็มจำนวนที่นี่ · กด Issue PFM ต่อ = ออกบิลเต็ม = เก็บซ้ำ

   ⚠ ก้อนนี้เตือนอย่างเดียว ไม่แตะยอดเงินสักบาท (ตัวเลือก ก ที่ตกลงกันไว้)
     ยอดรวม ยอดค้าง และยอดในใบแจ้งหนี้ ยังคิดเหมือนเดิมทุกประการ
     ถ้าจะให้หักจริงต้องเปลี่ยน bal/unpaidAmt ไปใช้ bkV2PayOf().billable
     ซึ่งคิดเผื่อไว้แล้วว่า billable = bkTot - cot.use

   ⚠ เกณฑ์คือ deduct > 0 ไม่ใช่ "มี COT" · COT ที่เป็นค่าอุทยาน (handling 'separate')
     จะถูกกด "ไม่หัก" ซึ่งถูกต้องแล้ว ห้ามไปลดบิล agent · เตือนเคสนั้นคือเตือนผิด */
function pfmCotWarn(bk){
  try{
    if(typeof bkV2CotOf!=='function') return null;
    var c=bkV2CotOf(bk);
    if(!c || !c.settled) return null;              // ยังไม่มีใครตัดสิน = ยังไม่มีอะไรให้เตือน
    var d=+c.deduct||0;
    if(!(d>0)) return null;                        // ไม่หัก / โอนออก / เก็บไม่ได้ = บิล agent ไม่เกี่ยว
    return { deduct:d, amt:+c.amt||0, mode:c.mode||'' };
  }catch(_){ return null; }
}
function pfmCutoff(date){ const c=new Date(date+'T18:00:00'); c.setDate(c.getDate()-1); return c; }   // 18:00 day before
function pfmBookingsFor(date){
  return (SB_BOOKINGS||[]).filter(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return false;
    if(!pfmIsProforma(b)) return false;
    return (b.trips||[]).some(t=>(t.date||'')===date);
  });
}
// Period range for the selected mode (day/week/month/year of the anchor date)
function pfmPeriodRange(date, mode){
  const d=new Date(date+'T12:00:00');
  if(mode==='week'){ const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7)); const sun=new Date(mon); sun.setDate(mon.getDate()+6); return {from:bkV2LocalYMD(mon), to:bkV2LocalYMD(sun)}; }
  if(mode==='month'){ const f=new Date(d.getFullYear(),d.getMonth(),1); const t=new Date(d.getFullYear(),d.getMonth()+1,0); return {from:bkV2LocalYMD(f), to:bkV2LocalYMD(t)}; }
  if(mode==='year'){ return {from:d.getFullYear()+'-01-01', to:d.getFullYear()+'-12-31'}; }
  return {from:date, to:date};
}
// All proforma bookings whose trip falls in the period · sorted newest-first
function pfmBookingsForPeriod(date, mode){
  const r=pfmPeriodRange(date, mode||'daily');
  const repDate=b=>{ const ds=(b.trips||[]).map(t=>t.date||'').filter(x=>x>=r.from&&x<=r.to).sort(); return ds.length?ds[ds.length-1]:''; };
  const out=(SB_BOOKINGS||[]).filter(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return false;
    if(!pfmIsProforma(b)) return false;
    return (b.trips||[]).some(t=>{ const td=t.date||''; return td>=r.from && td<=r.to; });
  });
  out.sort((a,b)=>{ const ad=repDate(a), bd=repDate(b); if(ad!==bd) return ad<bd?1:-1; const ab=(a.bookingDate||a.createdAt||''), bb=(b.bookingDate||b.createdAt||''); return ab<bb?1:(ab>bb?-1:0); });
  return out;
}
// Chart buckets per mode (daily=8d · week=8w · month=8mo · year=5y) · one booking → one bucket by earliest trip date
function pfmChartBuckets(date, mode){
  const d0=new Date(date+'T12:00:00'); const N = mode==='year'?5:8; const out=[];
  const MA=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for(let i=N-1;i>=0;i--){ let from,to,lab;
    if(mode==='week'){ const dd=new Date(d0); dd.setDate(d0.getDate()-i*7); const mon=new Date(dd); mon.setDate(dd.getDate()-((dd.getDay()+6)%7)); const sun=new Date(mon); sun.setDate(mon.getDate()+6); from=bkV2LocalYMD(mon); to=bkV2LocalYMD(sun); lab=from.slice(8)+'/'+from.slice(5,7); }
    else if(mode==='month'){ const dd=new Date(d0.getFullYear(),d0.getMonth()-i,1); from=bkV2LocalYMD(dd); to=bkV2LocalYMD(new Date(dd.getFullYear(),dd.getMonth()+1,0)); lab=MA[dd.getMonth()]; }
    else if(mode==='year'){ const yr=d0.getFullYear()-i; from=yr+'-01-01'; to=yr+'-12-31'; lab=String(yr); }
    else { const dd=new Date(d0); dd.setDate(d0.getDate()-i); from=to=bkV2LocalYMD(dd); lab=from.slice(8); }
    out.push({from,to,lab,cur:i===0,tot:0,paid:0,unpaid:0}); }
  (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; if(!pfmIsProforma(b))return;
    const ds=(b.trips||[]).map(t=>t.date||'').filter(Boolean).sort(); if(!ds.length)return; const rep=ds[0];
    const bk=out.find(o=>rep>=o.from&&rep<=o.to); if(!bk)return;
    const inv=acctBookingInvoice(b.id); const total=acctBookingTotal(b); const bal=inv?acctInvoiceBalance(inv):total;
    bk.tot+=total; bk.paid+=(total-bal); bk.unpaid+=bal; });
  return out;
}
function pfmIssueInvoice(bkId){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  if(acctBookingInvoice(bkId)){ alert('Invoice already exists for this booking'); return; }
  /* §pfmCotWarn · ใบนี้เก็บเงินสดหน้าท่าแล้วและตัดสินว่าหักจากบิล · ออกบิลเต็มจำนวน
     = เก็บซ้ำ · ยังไม่หักให้อัตโนมัติ (ตัวเลือก ก) แต่ต้องให้คนเห็นก่อนกดผ่าน */
  const _cw=pfmCotWarn(b);
  if(_cw){
    const _t=(typeof acctBookingTotal==='function')?acctBookingTotal(b):0;
    if(!confirm('ใบนี้เก็บเงินสดหน้าท่าไปแล้ว '+Math.round(_cw.deduct).toLocaleString()+' บาท'
      +' และตัดสินไว้ว่าหักจากบิล agent\n\n'
      +'ใบแจ้งหนี้ที่กำลังจะออกเป็นยอดเต็ม '+Math.round(_t).toLocaleString()+' บาท'
      +' ยังไม่ได้หักก้อนนั้นออกให้\n'
      +'ถ้าออกแบบนี้แล้วเก็บเงินตามบิล = เก็บซ้ำ\n\n'
      +'ยืนยันออกใบแจ้งหนี้ยอดเต็ม?')) return;
  }
  acctCreateInvoice(b.agentId,[bkId],0);   // proforma · due now
  renderDailyPFM();
}
function pfmRecordPayment(bkId){
  const inv=acctBookingInvoice(bkId); if(!inv){ alert('Issue the PFM invoice first'); return; }
  const bal=acctInvoiceBalance(inv);
  _pfmRec={ bkId, invId:inv.id, amount:Math.round(bal), method:'transfer', ref:'', slips:[] };
  renderDailyPFM();
}
function pfmRecClose(){ _pfmRec=null; renderDailyPFM(); }
function pfmRecSet(f,v){ if(_pfmRec) _pfmRec[f]=v; }   // no re-render (keep focus)
function pfmRecRefreshSlips(){ const el=document.getElementById('pfm-rec-slips'); if(el) el.innerHTML=pfmRecSlipsHTML(); }
function pfmRecSlipsHTML(){
  const ss=(_pfmRec&&_pfmRec.slips)||[];
  if(!ss.length) return `<div style="font-size:11px;color:#b0aea4;text-align:center;padding:14px;border:1px dashed #d7dbe2;border-radius:9px">ยังไม่มีสลิป · อัปโหลด / แคปหน้าจอ / วางรูป</div>`;
  return ss.map(s=>{ const url='/api/attach/'+encodeURIComponent(s.id); const isImg=/^image\//.test(s.mime||'');
    return `<div style="display:flex;align-items:center;gap:9px;border:1px solid #e3e6e1;border-radius:9px;padding:6px 9px;margin-bottom:6px;background:#fff">
      ${isImg?`<a href="${url}" target="_blank" rel="noopener"><img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;display:block"></a>`:`<span style="font-size:18px">📄</span>`}
      <span style="flex:1;font-size:11.5px;color:#3F4654;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(s.kind==='capture'?'🖥 ':s.kind==='paste'?'📋 ':'📎 ')+String(s.name||'slip')}</span>
      <a href="${url}" target="_blank" rel="noopener" style="font-size:11px;color:#185FA5;text-decoration:none">เปิด ↗</a>
      <button onclick="pfmSlipRemove('${s.id}')" title="ลบ" style="border:none;background:transparent;color:#A32D2D;font-size:15px;cursor:pointer;line-height:1">&times;</button>
    </div>`; }).join('');
}
function pfmSlipUpload(file,kind){
  if(!_pfmRec||!file) return; const bid=_pfmRec.bkId;
  const post=(blob,mime,name)=>{ if(blob&&blob.size>6*1024*1024){ alert('ไฟล์ใหญ่เกิน 6MB · กรุณาย่อ/บีบอัดก่อน'); return; } const fr=new FileReader(); fr.onload=()=>{ const b64=String(fr.result).split(',')[1]||''; fetch('/api/attach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:bid,filename:name,mime:mime,dataB64:b64})}).then(r=>r.json()).then(j=>{ if(j&&j.error){ alert('อัปโหลดไม่สำเร็จ: '+j.error); return; } if(!_pfmRec) return; _pfmRec.slips.push({id:j.id,name:j.filename,mime:j.mime,size:j.size,kind:kind||'upload',at:new Date().toISOString()}); pfmRecRefreshSlips(); }).catch(e=>alert('อัปโหลดไม่สำเร็จ: '+e.message)); }; fr.readAsDataURL(blob); };
  if(/^image\//.test(file.type||'')){ (typeof _bkV2DownscaleImage==='function'?_bkV2DownscaleImage:function(f,m,cb){cb(f,f.type);})(file,1600,(b,m)=>{ if(b) post(b,m,((file.name||'slip').replace(/\.[^.]+$/,''))+'.jpg'); else post(file,file.type,file.name||'slip'); }); }
  else post(file,file.type||'application/octet-stream',file.name||'slip');
}
function pfmSlipFromInput(inp){ const fs=(inp&&inp.files)?Array.prototype.slice.call(inp.files):[]; fs.forEach(f=>pfmSlipUpload(f,'upload')); if(inp) inp.value=''; }
function pfmSlipCapture(){
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia)){ alert('เบราว์เซอร์นี้ไม่รองรับ Capture · ใช้ อัปโหลด หรือ วางรูป แทน'); return; }
  navigator.mediaDevices.getDisplayMedia({video:true}).then(stream=>{ const v=document.createElement('video'); v.srcObject=stream; v.muted=true; v.play(); setTimeout(()=>{ try{ const c=document.createElement('canvas'); c.width=v.videoWidth||1280; c.height=v.videoHeight||720; c.getContext('2d').drawImage(v,0,0,c.width,c.height); stream.getTracks().forEach(t=>t.stop()); c.toBlob(b=>{ if(b) pfmSlipUpload(new File([b],'slip-'+Date.now()+'.jpg',{type:'image/jpeg'}),'capture'); },'image/jpeg',0.9); }catch(e){ try{stream.getTracks().forEach(t=>t.stop());}catch(_){} } },350); }).catch(e=>{});
}
function pfmSlipRemove(id){ if(!_pfmRec) return; fetch('/api/attach/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{}); _pfmRec.slips=_pfmRec.slips.filter(s=>s.id!==id); pfmRecRefreshSlips(); }
function pfmRecSubmit(){
  const r=_pfmRec; if(!r) return;
  const amt=Math.max(0,Number(r.amount)||0); if(amt<=0){ alert('ใส่จำนวนเงินก่อน'); return; }
  acctRecordPayment(r.invId, amt, r.method||'transfer', {ref:r.ref, slips:r.slips});
  // keep slip refs on the booking too (for later viewing)
  const b=SB_BOOKINGS.find(x=>x.id===r.bkId);
  if(b && r.slips.length){ b.paymentSlips=Array.isArray(b.paymentSlips)?b.paymentSlips:[]; r.slips.forEach(s=>b.paymentSlips.push({...s, amount:amt, at:new Date().toISOString(), by:laBy()})); try{acctPersistBookings();}catch(e){} }
  _pfmRec=null; renderDailyPFM();
}
function pfmRecModalHTML(){
  const r=_pfmRec; if(!r) return '';
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const b=SB_BOOKINGS.find(x=>x.id===r.bkId)||{}; const a=(typeof sbGetAgent==='function'?sbGetAgent(b.agentId):null);
  const inv=SB_INVOICES.find(i=>i.id===r.invId); const bal=inv?Math.round(acctInvoiceBalance(inv)):0;
  const _mac=(typeof _bkV2IsMac==='function')?_bkV2IsMac():true; const _shot=_mac?'Cmd+Shift+4':'Win+Shift+S'; const _paste=_mac?'Cmd+V':'Ctrl+V';
  const mBtn=(v,l)=>`<button onclick="pfmRecSet('method','${v}');document.querySelectorAll('[data-pfmm]').forEach(x=>{x.style.background='#fff';x.style.color='#5F5E5A'});this.style.background='#163d2b';this.style.color='#eafbe0'" data-pfmm="${v}" style="flex:1;background:${r.method===v?'#163d2b':'#fff'};color:${r.method===v?'#eafbe0':'#5F5E5A'};border:0.5px solid #cfcabf;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${l}</button>`;
  return `
  <div id="pfm-rec-modal" onclick="pfmRecClose()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:460px;max-width:96vw;max-height:92vh;overflow:auto;box-shadow:0 16px 50px rgba(0,0,0,.3)">
      <div style="padding:15px 19px;border-bottom:1px solid #eef0ea">
        <div style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#0F6E56;text-transform:uppercase">Record payment</div>
        <div style="font-size:16px;font-weight:700;color:#15201a;margin-top:2px">${esc(b.voucherRef||b.code||b.id)}</div>
        <div style="font-size:11px;color:#8a8a82;margin-top:2px">${esc(a?a.name:b.agentId||'')} · ค้าง <b style="color:#A32D2D">฿${bal.toLocaleString()}</b></div>
      </div>
      <div style="padding:16px 19px;display:flex;flex-direction:column;gap:13px">
        <div>
          <div style="font-size:10px;color:#8a8a82;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">จำนวนเงินที่รับ (THB)</div>
          <input type="number" min="0" value="${esc(r.amount)}" oninput="pfmRecSet('amount',this.value)" style="width:100%;box-sizing:border-box;height:42px;border:1px solid #d7dbe2;border-radius:9px;padding:0 13px;font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:#15201a">
          <div style="margin-top:5px"><button onclick="pfmRecSet('amount',${bal});this.closest('div').previousElementSibling.value=${bal}" style="font-size:11px;color:#0F6E56;background:#E1F5EE;border:none;border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit;font-weight:600">เต็มยอด ฿${bal.toLocaleString()}</button></div>
        </div>
        <div>
          <div style="font-size:10px;color:#8a8a82;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">ช่องทาง</div>
          <div style="display:flex;gap:7px">${mBtn('transfer','โอน')}${mBtn('cash','เงินสด')}${mBtn('card','บัตร')}</div>
        </div>
        <div>
          <div style="font-size:10px;color:#8a8a82;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">อ้างอิง / เลขที่ (ถ้ามี)</div>
          <input value="${esc(r.ref)}" oninput="pfmRecSet('ref',this.value)" placeholder="เช่น เลขอ้างอิงโอน" style="width:100%;box-sizing:border-box;height:36px;border:1px solid #d7dbe2;border-radius:9px;padding:0 12px;font-family:inherit;font-size:13px">
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:10px;color:#8a8a82;text-transform:uppercase;letter-spacing:.04em">สลิปการชำระ</div>
            <div style="display:flex;gap:7px">
              <label title="แนบไฟล์ · รูป / PDF / Excel / Word — ไฟล์อะไรก็ได้ (สูงสุด 6MB ต่อไฟล์)" style="display:inline-flex;align-items:center;justify-content:center;background:#163d2b;color:#eafbe0;border-radius:8px;width:38px;height:32px;font-size:15px;cursor:pointer">📎<input type="file" multiple style="display:none" onchange="pfmSlipFromInput(this)"></label>
              <button type="button" title="แคปหน้าจอ" onclick="pfmSlipCapture()" style="display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#163d2b;border:0.5px solid #cfcabf;border-radius:8px;width:38px;height:32px;font-size:15px;cursor:pointer">🖥</button>
            </div>
          </div>
          <div style="font-size:10px;color:#9a988f;margin-bottom:7px">📋 ถ่ายหน้าจอ (${_shot}) แล้วกด <b style="color:#15201a">${_paste}</b> วางในหน้านี้ได้เลย</div>
          <div id="pfm-rec-slips">${pfmRecSlipsHTML()}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:13px 19px;background:#fafbf9;border-top:1px solid #eef0ea">
        <button onclick="pfmRecClose()" style="font-size:12px;font-weight:600;color:#5F5E5A;background:#fff;border:1px solid #d7dbe2;border-radius:9px;padding:9px 15px;cursor:pointer;font-family:inherit">ยกเลิก</button>
        <button onclick="pfmRecSubmit()" style="font-size:12px;font-weight:700;color:#eafbe0;background:#163d2b;border:none;border-radius:9px;padding:9px 18px;cursor:pointer;font-family:inherit">บันทึกการชำระ</button>
      </div>
    </div>
  </div>`;
}
function pfmApproveTravel(bkId){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  const def=pfmSalesName(b);   // default approver = booking's salesperson
  const who=prompt('EXTEND travel for an UNPAID proforma booking (past 18:00 cutoff).\nWho is approving this? (salesperson)', def!=='—'?def:'');
  if(who===null) return;       // cancelled
  const by=(who||'').trim()||def;
  b.ops=b.ops||{}; b.ops.pfm={decision:'approved', extendedBy:by, by:by, at:new Date().toISOString(), alertedAt:new Date().toISOString()};
  if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','PFM unpaid · travel EXTENDED by '+by,'Confirmed');
  acctPersistBookings(); renderDailyPFM();
}
function pfmHold(bkId){
  const b=SB_BOOKINGS.find(x=>x.id===bkId); if(!b) return;
  if(!confirm('Mark this booking ON HOLD (do not travel until paid)?')) return;
  b.ops=b.ops||{}; b.ops.pfm={decision:'hold', by:laBy(), at:new Date().toISOString()};
  if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','PFM unpaid · put on hold','Cancel');
  acctPersistBookings(); renderDailyPFM();
}
// Issue a PFM invoice for EVERY booking on the day that has none yet
function pfmIssueAll(){
  const list=pfmBookingsForPeriod(_pfmDate,_pfmMode); const todo=list.filter(b=>!acctBookingInvoice(b.id));
  if(!todo.length){ alert('All bookings already have a PFM invoice.'); return; }
  /* §pfmCotWarn · ออกทีเดียวทั้งชุด · ถ้ามีใบที่หักหน้าท่าไปแล้วปนอยู่ ต้องบอกก่อน
     ไม่งั้นเก็บซ้ำทีละหลายใบโดยไม่มีใครทันเห็น */
  const _cwN=todo.map(pfmCotWarn).filter(Boolean);
  const _cwSum=_cwN.reduce((s,x)=>s+x.deduct,0);
  if(!confirm('Issue PFM invoices for '+todo.length+' booking(s) on '+_pfmDate+'?'
    +(_cwN.length ? ('\n\n\u26a0 ในนั้นมี '+_cwN.length+' ใบที่เก็บเงินสดหน้าท่าไปแล้ว รวม '
       +Math.round(_cwSum).toLocaleString()+' บาท และตัดสินว่าหักจากบิล agent\n'
       +'ใบแจ้งหนี้จะออกยอดเต็ม ยังไม่ได้หักก้อนนั้นออกให้') : ''))) return;
  let n=0; todo.forEach(b=>{ try{ acctCreateInvoice(b.agentId,[b.id],0); n++; }catch(e){} });
  alert('Issued '+n+' PFM invoice(s).');
  renderDailyPFM();
}
// Log a payment reminder on every unpaid booking on the day
function pfmRemindAll(){
  const list=pfmBookingsForPeriod(_pfmDate,_pfmMode); let n=0;
  list.forEach(b=>{ const inv=acctBookingInvoice(b.id); const total=acctBookingTotal(b); const bal=inv?acctInvoiceBalance(inv):total; if(bal<=0) return;
    b.ops=b.ops||{}; b.ops.pfm=b.ops.pfm||{}; b.ops.pfm.remindedAt=new Date().toISOString();
    if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','PFM payment reminder sent','Notify'); n++; });
  if(!n){ alert('No unpaid bookings to remind.'); return; }
  if(typeof acctPersistBookings==='function') acctPersistBookings();
  alert('Logged a payment reminder on '+n+' unpaid booking(s).');
  renderDailyPFM();
}
function tsPersist(){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;
  // §tsCotSave · ผ่านแคชกลางเหมือนของอื่นทุกตัว · อ่าน-เขียน localStorage ดิบจะข้าม _laBlob แล้วทับกันเอง
  try{ laBlob().travel_sum=TRAVEL_SUM; laBlobSave(); }catch(_){}
}
function _tsKey(bkId,date){ return String(date||'')+'::'+String(bkId||''); }
function tsGet(bkId,date){ return TRAVEL_SUM[_tsKey(bkId,date)]||null; }
function tsSet(bkId,date,decision,amount,note){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;   // §tsCotSave · บอกให้รู้ว่าดูอย่างเดียว · และอย่าเพิ่งแก้ค่า
  const k=_tsKey(bkId,date);
  if(!decision){ delete TRAVEL_SUM[k]; }
  else TRAVEL_SUM[k]={decision:decision, amount:Math.max(0,Math.round(+amount||0)), note:String(note||''), by:ckMe(), at:new Date().toISOString()};
  tsPersist();
}
function tsDateShift(n){ const d=new Date(_tsDate+'T12:00:00'); d.setDate(d.getDate()+n); _tsDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); renderTravelSum(); }
function tsToday(){ _tsDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10); renderTravelSum(); }
function tsPickDay(ds){ if(ds){ _tsDate=ds; renderTravelSum(); } }
function tsAfter(){ const sy=window.scrollY||0; renderTravelSum(); try{ window.scrollTo(0,sy); }catch(_){} }
// ราคาของ trip วันนั้น (บุ๊กหลายวันใช้ subtotal ของ trip · วันเดียวใช้ยอดรวมของ booking)
// §tsWho · {ad,chd,inf,foc} → "2 AD · 1 CHD" · ข้ามหมวดที่เป็น 0
function tsPaxWho(pb){
  if(!pb) return '';
  return [['ad','AD'],['chd','CHD'],['inf','INF'],['foc','FOC']]
    .filter(function(k){ return (+pb[k[0]]||0)>0; })
    .map(function(k){ return (+pb[k[0]])+' '+k[1]; }).join(' \u00b7 ');
}
function tsTripAmount(b, t){
  // §ovnBack · ขากลับค้างคืนไม่มีราคาของตัวเอง (ค่าใช้จ่ายอยู่ที่ขาไปแล้ว)
  //   ห้ามปล่อยให้ตกไปถึง priceBreakdown.total เพราะนั่นคือยอดเต็มของทั้งบุ๊กกิ้ง = นับซ้ำ
  if(t && t.ovnLeg) return 0;
  const multi=((b.trips||[]).length>1);
  if(multi && t && typeof t.subtotal==='number' && t.subtotal>0) return t.subtotal;
  if(b.priceBreakdown && typeof b.priceBreakdown.total==='number') return b.priceBreakdown.total;
  return +b.total||0;
}
function tsPolicyText(b){
  const ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  const p=ag&&ag.bookingChannel&&ag.bookingChannel.cancelPolicy;
  return p?String(p):'';
}
// ── ทุก booking ของวันนั้น พร้อมข้อมูลครบสาย: จอง → รถ → เช็คอินรถ → เรือ → เช็คอินหน้าท่า → เดินทางจริง ──
// §tsAgName · ชื่อ agency ของใบหนึ่ง · ที่เดียวที่ตัดสินว่าใบนี้อยู่ใต้ชื่อไหน
//   ถ้าไม่มี agent ให้ใช้ช่องทางขาย (direct / walk-in) แทน จะได้เรียงร่วมกันได้
function tsAgName(b){
  var ag=(typeof sbGetAgent==='function')?sbGetAgent(b&&b.agentId):null;
  return ag?(ag.name||ag.code||'—'):String((b&&b.channel)||'walk-in');
}
function tsRows(date){
  const out=[];
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    const t=ckTripOn(b,date); if(!t) return;
    // §ovnBack · ขากลับค้างคืนเป็นคนที่เดินทางจริงในวันนั้น จึงต้องอยู่ในใบสรุปและชุดเอกสาร
    //   ยอดเงินไม่ซ้ำเพราะ tsTripAmount() คืน 0 ให้ ovnLeg (และ tsNetOf คืน null อยู่แล้ว)
    const O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    const _ovnB=(typeof bkIsOvnReturn==='function') && bkIsOvnReturn(t);
    const s=ckSummary(b,date)||{booked:ckBookedPax(t),noShow:0};
    const v=O.vanCheckin||null, pcv=O.pierCheckin||null;
    const evV=ckEventTally(v), evP=ckEventTally(pcv);
    const events=[].concat(ckEvLive(v&&v.events), ckEvLive(pcv&&pcv.events));   /* §ckBack */
    const booked=s.booked, noShow=s.noShow||0;
    // §tsIssueReal · คนที่ไม่ได้เดินทางจริง (หักเคสมาเองที่ท่า / หน้าท่ายืนยันแล้วออกให้)
    const _L=(typeof ckLostByType==='function')?(ckLostByType(b,date)||{}):{};
    const _lostTot=(+_L.total||0);
    const _decNow=tsGet(b.id,date);
    out.push({
      b:b, t:t, O:O, routeId:t.routeId||'',
      booked:booked, travelled:Math.max(0,booked-noShow), noShow:noShow,
      /* §ckSelfLost · เดิมนับดิบจาก events[] · คนที่แจ้งไปเองที่ท่าแล้วมาถึงจริงยังถูกนับเป็น No-show
         ทั้งที่ขึ้นเรือไปแล้ว · ยอดรวมทั้งวันเลยสูงกว่าความจริง · ใช้ยอดที่หักคืนแล้วแทน */
      ns:(+_L.ns||0), cxl:(+_L.cxl||0), events:events,
      /* §ovnDaily · ขากลับไม่มีรถไปรับ มีแต่รถพากลับ · vanReturnId ว่าง = กลับคันเดิม */
      van:(_ovnB?(O.vanReturnId||O.vanId||''):(O.vanId||'')), vanCk:v, vanDone:!!(v&&v.at), vanActual:(v&&v.actualPax!=null)?v.actualPax:null,
      boat:O.boatId||t.charterBoatId||'', pierCk:pcv, pierDone:!!(pcv&&pcv.at),
      pierActual:(pcv&&pcv.actualPax!=null)?pcv.actualPax:null, pierExp:(pcv&&pcv.expected!=null)?pcv.expected:null,
      // §tsIssueReal · เข้าหัวข้อ "ตัดสินค่าปรับ" เฉพาะตอนมีคนไม่ได้เดินทางจริง
      //   เดิมใช้ events.length>0 ด้วย · กดอะไรหน้างานสักอย่างก็ติดค้างรอตัดสิน
      //   ทั้งที่ผลสุดท้ายที่ท่าเรืออาจเป็น "มาครบ" (มาเองที่ท่า / หน้าท่ายืนยันว่ามาแล้ว)
      issue:(noShow>0 || _lostTot>0 || !!_decNow), amount:tsTripAmount(b,t), policy:tsPolicyText(b), dec:_decNow,
      ovnBack:_ovnB,
      ovnOut:((_ovnB && typeof _ovnOutDate==='function')?_ovnOutDate(b,t):'')
    });
  });
  // §tsSortAZ (2026-08-03) · เรียง A-Z ตาม Agency ในแต่ละเส้นทาง
  //   เดิมเรียงตามเวลารับ — ใบของ agent เดียวกันกระจายทั่วหน้า ตามเช็คทีละเจ้าไม่ได้
  //   ตอนนี้ เส้นทาง → Agency (A-Z) → Voucher (A-Z) · ลิสต์ Reference ใช้ลำดับเดียวกันเป๊ะ
  var _az=function(a,b){ return String(a||'').localeCompare(String(b||''), 'en', { numeric:true, sensitivity:'base' }); };
  return out.sort(function(x,y){
    const rx=((typeof getRoute==='function'?getRoute(x.routeId):null)||{}).name||x.routeId;
    const ry=((typeof getRoute==='function'?getRoute(y.routeId):null)||{}).name||y.routeId;
    return _az(rx,ry)
      || _az(tsAgName(x.b), tsAgName(y.b))
      || _az(x.b.voucherRef||x.b.code||'', y.b.voucherRef||y.b.code||'');
  });
}
function tsCotPersist(){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;
  // §tsCotSave · ผ่านแคชกลาง · ตัว ts_cot เพิ่งมีตารางในแมป (os-backend §tsCot) จึงจะขึ้นเซิร์ฟเวอร์จริงตั้งแต่รอบนี้
  try{ laBlob().ts_cot=TS_COT; laBlobSave(); }catch(_){}
}
function tsCotGet(bkId,date){ return TS_COT[_tsKey(bkId,date)]||null; }
// ค่าที่ตั้งไว้ตอนเปิด booking · ใช้เป็นปุ่มแนะนำ ไม่ได้ตัดสินแทน
function tsCotSugMode(M){ return (M && M.handling==='separate') ? 'none' : 'full'; }
/* §cotNoCol (2026-09-04) · COT ของคนที่ไม่ได้เดินทาง
   เดิมมีให้เลือกแค่ หักทั้งก้อน / บางส่วน / ไม่หัก / โอนออก — ทั้งสี่แบบแปลว่า
   "เงินอยู่ในมือเราแล้ว" ทั้งนั้น · พอลูกค้าไม่มา เงินไม่เคยเข้ามา คนปิดวันจึงกด
   อะไรไม่ได้เลย แล้วยอดค้างลอยข้ามวันไปเรื่อย ๆ โดยไม่มีที่บันทึกว่าทำไม
   เพิ่มทางเลือก "เก็บไม่ได้" พร้อมช่องเหตุผล · เหตุผลเติมให้จากที่หน้างานกดไว้แล้ว
   จะได้ไม่ต้องพิมพ์ซ้ำ และเหตุผลในระบบตรงกันทั้งใบปิดวันกับหน้าเช็คอิน       */
function tsCotWhySug(r){
  if(!r) return '';
  var bits=[];
  (r.events||[]).forEach(function(x){
    if(!x || !(+x.pax||0)) return;
    var lb=(typeof ckReasonLabel==='function')?ckReasonLabel(x.reasonCode):'';
    var t=(x.type==='cxl')?'ยกเลิกหน้างาน':'ไม่มา (No-show)';
    var one=t+' '+(+x.pax||0)+' คน'+(lb?(' · '+lb):'')
      +((x.note&&String(x.note).trim())?(' · '+String(x.note).trim()):'');
    if(bits.indexOf(one)<0) bits.push(one);
  });
  if(!bits.length && r.travelled<=0) bits.push('ลูกค้าไม่ได้เดินทาง');
  return bits.join(' · ');
}
/* เหตุผลเก็บลงช่อง ref · ห้ามเพิ่มช่องใหม่ใน TS_COT
   field_mapping ของ ts_cot มีแค่ mode/deduct/payout/ref/by/at — อะไรที่ไม่อยู่ในนั้น
   หายเงียบตอนขึ้นเซิร์ฟเวอร์ · โหมด nocol ไม่มีเลขโอนให้อ้างอิงอยู่แล้ว ช่อง ref จึงว่าง */
function _tsCotNum(v){ return Math.max(0, Math.round(parseFloat(String(v==null?'':v).replace(/[^0-9.]/g,''))||0)); }
function _tsCotInp(id,w){ var el=document.getElementById('ts-cot'+w+'-'+id); return el?_tsCotNum(el.value):0; }
function _tsCotRefVal(id){ var el=document.getElementById('ts-cotr-'+id); return el?String(el.value||''):''; }
function tsCotPick(bkId,date,mode,cot,why){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;   // §tsCotSave
  var k=_tsKey(bkId,date), cur=TS_COT[k]||{}, d=0, p=0;
  cot=+cot||0;
  if(mode==='full'){ d=cot; }
  else if(mode==='payout'){ p=cot; }
  else if(mode==='part'){ d=(cur.mode==='part')?_tsCotInp(bkId,'d'):cot; p=(cur.mode==='part')?_tsCotInp(bkId,'p'):0; }
  /* §cotNoCol · เก็บไม่ได้ = ไม่มีเงินให้หักหรือโอน · เหลือแค่เหตุผล
     เหตุผลเก็บลงช่อง ref ที่ map ไว้แล้ว (โหมดนี้ไม่มีเลขโอนให้อ้างอิง ช่องจึงว่าง)
     เติมจากที่หน้างานกดไว้ให้เลย ถ้าคนกดยังไม่ได้พิมพ์อะไร จะได้ไม่ต้องพิมพ์ซ้ำ */
  var rf=_tsCotRefVal(bkId)||cur.ref||'';
  if(mode==='nocol' && !rf){ try{ rf=decodeURIComponent(why||''); }catch(_){ rf=String(why||''); } }
  /* §cotSlip · เปลี่ยนใจกดปุ่มอื่นได้ แต่สลิปที่แนบไว้แล้วต้องไม่หายไปด้วย
     (บรรทัดนี้สร้าง object ใหม่ทั้งก้อน · อะไรที่ไม่ยกมาคือหายถาวร) */
  TS_COT[k]={ mode:mode, deduct:d, payout:p, ref:rf, slips:tsCotSlips(cur),
              by:ckMe(), at:new Date().toISOString() };
  tsCotPersist(); tsAfter();
}
function tsCotAmt(bkId,date){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;   // §tsCotSave
  var c=TS_COT[_tsKey(bkId,date)]; if(!c) return;
  c.deduct=_tsCotInp(bkId,'d'); c.payout=_tsCotInp(bkId,'p');
  c.by=ckMe(); c.at=new Date().toISOString();
  tsCotPersist(); tsAfter();
}
function tsCotRefSave(bkId,date){ if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;   /* §tsCotSave */
  var c=TS_COT[_tsKey(bkId,date)]; if(!c) return; c.ref=_tsCotRefVal(bkId); tsCotPersist(); }
function tsCotClear(bkId,date){ if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;   /* §tsCotSave */
  delete TS_COT[_tsKey(bkId,date)]; tsCotPersist(); tsAfter(); }
/* §cotSlip (2026-09-09) · หลักฐานของเงิน COT
   ช่องนี้ตัดสินได้แล้วว่าหัก / โอนออก / เก็บไม่ได้ และพิมพ์เลขอ้างอิงได้ แต่ "รูปสลิป"
   ยังไม่มีที่อยู่ · คนปิดวันถ่ายไว้ในไลน์ แล้วบัญชีตามหาย้อนหลังเอง
   ใช้ท่อเดียวกับสลิปเงินหน้างานในตารางเดียวกันนี้ (pckSlipUpload → /api/attach) ไฟล์จึงไป
   อยู่กับ booking เหมือนกัน · TS_COT เก็บแค่ ref ของไฟล์ ไม่ได้เก็บตัวรูป
   คอลัมน์ slips ของ ts_cot อยู่ในแมปแล้ว (db/migrations/024) — ถ้าไม่มี ข้อมูลนี้จะหาย
   เงียบตอนขึ้นเซิร์ฟเวอร์เหมือนช่องอื่นที่ไม่ได้ map */
function tsCotSlips(c){ return (c && Array.isArray(c.slips)) ? c.slips : []; }
function tsCotSlipPick(bkId,date,inp){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')){ if(inp) inp.value=''; return; }
  var f=(inp&&inp.files&&inp.files[0])||null; if(inp) inp.value='';
  if(!f) return;
  var c=TS_COT[_tsKey(bkId,date)];
  if(!c){ alert('Pick how this COT is handled first, then attach the slip.'); return; }
  if(typeof pckSlipUpload!=='function'){ alert('แนบสลิปไม่ได้ในหน้านี้'); return; }
  pckSlipUpload(f, bkId, function(meta){
    var cc=TS_COT[_tsKey(bkId,date)]; if(!cc) return;   // กดล้างระหว่างอัปโหลด
    cc.slips=tsCotSlips(cc).concat([{ id:meta.id, name:meta.name, mime:meta.mime, size:meta.size,
                                      at:new Date().toISOString(), by:ckMe() }]);
    cc.by=ckMe(); cc.at=new Date().toISOString();
    tsCotPersist(); tsAfter();
  });
}
/* ปลดสลิปออกจากคำตัดสิน · ไม่ลบไฟล์จริงทิ้ง — pckSlipUpload ลงทะเบียนไฟล์ใบเดียวกันไว้ที่
   b.paymentSlips ด้วย ลบจากเซิร์ฟเวอร์จะทำให้หน้าดูสลิปของ booking เหลือรูปเสีย */
function tsCotSlipDrop(bkId,date){
  if(typeof laGuardEdit==='function' && !laGuardEdit('operations')) return;
  var c=TS_COT[_tsKey(bkId,date)]; if(!c) return;
  var n=tsCotSlips(c).length; if(!n) return;
  if(!confirm('ปลดสลิป '+n+' ใบออกจากรายการนี้? (ไฟล์ยังอยู่ในเอกสารของ booking)')) return;
  c.slips=[]; c.by=ckMe(); c.at=new Date().toISOString();
  tsCotPersist(); tsAfter();
}
function tsCotSlipRow(bkId,date,c,e){
  var ss=tsCotSlips(c), lb='สลิป COT';
  var add='<label class="ts-slipb" title="'+e('แนบสลิป · '+lb)+'">&#128206; '+(ss.length?'เพิ่มสลิป':'แนบสลิป')
    +'<input type="file" accept="image/*,application/pdf" style="display:none"'
    +' onchange="tsCotSlipPick(\''+bkId+'\',\''+date+'\',this)"></label>';
  var seen=ss.length
    ? ('<span class="ts-slipok" style="cursor:pointer" '+laSlipClickAttr(ss, lb)
       +' title="'+e('มีสลิปแล้ว '+ss.length+' ใบ · กดเพื่อเปิดดู')+'">&#128206; สลิป '+ss.length+' ใบ</span>'
       +'<a class="ts-slipx" onclick="tsCotSlipDrop(\''+bkId+'\',\''+date+'\')" title="ปลดสลิปออก"'
       +' style="color:var(--rs700);cursor:pointer;font-size:11px;font-weight:800;align-self:center">&times;</a>')
    : '';
  return '<div class="ts-slips">'+seen+add+'</div>';
}
// ช่อง "จัดการ" ของหนึ่งใบ · ใช้ในตารางเงินหน้างาน (ส่วนที่ 3)
function tsCotCell(b, M, date, money, e, r){
  var cot=+((M&&M.cot)||0);
  if(!(cot>0)) return '<span style="color:var(--zn400)">&mdash;</span>';
  /* §cotNoCol · ใบที่ไม่มีใครเดินทางเลย เงินไม่เคยเข้ามา · แนะนำ "เก็บไม่ได้" ให้ตั้งแต่แรก */
  var noGo=!!(r && (+r.travelled||0)<=0);
  var sugWhy=(typeof tsCotWhySug==='function')?tsCotWhySug(r):'';
  var id=b.id, c=tsCotGet(id,date), sug=(noGo?'nocol':tsCotSugMode(M)), mode=c?c.mode:'';
  var ded=c?(+c.deduct||0):0, pay=c?(+c.payout||0):0, over=(ded+pay)>cot, keep=cot-ded-pay;
  var MODES=[['full','หักทั้งก้อน'],['part','บางส่วน'],['none','ไม่หัก'],['payout','โอนออก'],['nocol','เก็บไม่ได้']];
  var _wq=encodeURIComponent(sugWhy||'');
  var h=MODES.map(function(mm){
    var on=(mode===mm[0]), isSug=(!mode && mm[0]===sug);
    return '<button class="ts-db'+(on?' pick':'')+(isSug?' sug':'')+(mm[0]==='nocol'?' nocol':'')+'"'
      +' onclick="tsCotPick(\''+id+'\',\''+date+'\',\''+mm[0]+'\','+cot+',\''+_wq+'\')">'+mm[1]+'</button>';
  }).join('');
  if(mode==='part'){
    h+='<div class="ts-cotp"><span>หัก</span>'
      +'<input id="ts-cotd-'+id+'" class="ts-cotamt" value="'+ded+'" onchange="tsCotAmt(\''+id+'\',\''+date+'\')">'
      +'<span>โอนออก</span>'
      +'<input id="ts-cotp-'+id+'" class="ts-cotamt" value="'+pay+'" onchange="tsCotAmt(\''+id+'\',\''+date+'\')"></div>';
  }
  /* §cotNoCol · เก็บไม่ได้ · ไม่มีเงินให้อ้างอิงเลขโอน มีแต่เหตุผลที่ต้องบันทึก */
  if(mode==='nocol'){
    h+='<input id="ts-cotr-'+id+'" class="ts-note" type="text" value="'+e(c.ref||'')+'"'
      +' placeholder="เก็บไม่ได้เพราะอะไร" onchange="tsCotRefSave(\''+id+'\',\''+date+'\')">';
    h+='<div class="ts-cotsum"><b style="color:var(--rs700)">&#10007; เก็บไม่ได้ '+money(cot)+'</b>'
      +(c.ref
         ? (' <span style="color:var(--zn700)">&middot; '+e(c.ref)+'</span>')
         : ' <span style="color:var(--am700);font-weight:700">&middot; ยังไม่ระบุเหตุผล</span>')
      +' <span style="color:var(--zn400)">&middot; '+e(c.by||'')+(c.at?(' '+e(String(c.at).slice(5,10))):'')+'</span>'
      +' <a onclick="tsCotClear(\''+id+'\',\''+date+'\')" style="color:var(--rs700);cursor:pointer;margin-left:5px">ล้าง</a>'
      +'</div>';
    h+=tsCotSlipRow(id,date,c,e);   // §cotSlip · เก็บไม่ได้ก็ยังแนบหลักฐานได้ (รูปหน้างาน / แชทลูกค้า)
    return h;
  }
  if(mode){
    h+='<input id="ts-cotr-'+id+'" class="ts-note" type="text" value="'+e(c.ref||'')+'"'
      +' placeholder="เลขอ้างอิงการโอน" onchange="tsCotRefSave(\''+id+'\',\''+date+'\')">';
    var L=[];
    if(ded>0) L.push('<b style="color:var(--bl700)">หักบิล '+money(ded)+'</b>');
    if(pay>0) L.push('<b style="color:var(--pu700)">โอนออก '+money(pay)+'</b>');
    if(keep>0) L.push('บริษัทรับไว้ '+money(keep));
    h+='<div class="ts-cotsum">'+(over
        ? '<span style="color:var(--rs700);font-weight:800">&#9888; หัก+โอนออก เกินยอด COT</span>'
        : (L.join(' &middot; ')||'ไม่หักจากบิล')
          +' <span style="color:var(--zn400)">&middot; '+e(c.by||'')+(c.at?(' '+e(String(c.at).slice(5,10))):'')+'</span>'
          +' <a onclick="tsCotClear(\''+id+'\',\''+date+'\')" style="color:var(--rs700);cursor:pointer;margin-left:5px">ล้าง</a>')
      +'</div>';
    h+=tsCotSlipRow(id,date,c,e);   // §cotSlip · สลิปโอน / หลักฐานการหักบิล
  } else {
    h+='<div class="ts-cotsum" style="color:var(--am700);font-weight:700">&#9888; '
      +(noGo?'ลูกค้าไม่ได้เดินทาง · ต้องระบุว่าเก็บไม่ได้เพราะอะไร':'ยังไม่ตัดสิน')+'</div>';
  }
  return h;
}
function tsToggleFilter(){ _tsOnlyIssue=!_tsOnlyIssue; tsAfter(); }
function tsPick(bkId,date,kind,amt){
  const el=document.getElementById('ts-note-'+bkId);
  tsSet(bkId,date,kind,amt,el?el.value:'');
  tsAfter();
}
function tsClear(bkId,date){ tsSet(bkId,date,null); tsAfter(); }
function tsCustom(bkId,date){
  const cur=tsGet(bkId,date);
  const v=prompt('ยอดที่จะเก็บ (บาท)', cur?String(cur.amount):'0');
  if(v==null) return;
  const n=Math.max(0,Math.round(parseFloat(String(v).replace(/[^0-9.]/g,''))||0));
  tsPick(bkId,date,'partial',n);
}
function tsPostpone(bkId,date){
  tsSet(bkId,date,'postpone',0,(document.getElementById('ts-note-'+bkId)||{}).value||'');
  if(typeof bkV2RescheduleModal==='function') bkV2RescheduleModal(bkId);   // เลื่อนวันจริงผ่านโฟลว์เดิม (ล้างเช็คอินของวันเก่าให้เอง)
  else alert('บันทึกว่า "เลื่อนวัน" แล้ว · ไปตั้งวันใหม่ที่หน้า booking');
  tsAfter();
}
// ══ §tsManifest (2026-08-03) · Travel Summary · Daily Operations Manifest ══
//   เอกสารปิดวัน 4 ส่วนในใบเดียว — สรุปเส้นทาง / ตัดสินค่าปรับ / เงินหน้างาน / manifest เต็ม
//   ไม่มีโครงข้อมูลใหม่: คำตัดสินอยู่ที่ TRAVEL_SUM เดิม · เงินหน้างานอ่านจาก bk.pierPayments เดิม
//   โทนเขียวมะนาว (lime/emerald) ตามดีไซน์ที่ทีมส่งมา · แยก scope ใต้ #travelsum-host
function tsCSS(){ var S='#travelsum-host'; return ''
 +S+'{--lm50:#f7fee7;--lm100:#ecfccb;--lm200:#d9f99d;--lm400:#a3e635;--lm600:#65a30d;--lm800:#3f6212;--lm950:#1a2e05;'
   +'--em50:#ecfdf5;--em200:#a7f3d0;--em600:#059669;--em800:#065f46;'
   +'--zn50:#fafaf9;--zn100:#f5f5f4;--zn200:#e7e5e4;--zn400:#a8a29e;--zn500:#78716c;--zn700:#44403c;--zn900:#1c1917;'
   +'--rs50:#fff1f2;--rs200:#fecdd3;--rs700:#be123c;--rs900:#881337;'
   +'--am50:#fffbeb;--am200:#fde68a;--am700:#b45309;--am900:#78350f;'
   +'--bl50:#eff6ff;--bl200:#bfdbfe;--bl700:#1d4ed8;--pu50:#faf5ff;--pu200:#e9d5ff;--pu700:#7e22ce;'
   +'font-family:inherit;color:var(--zn900)}'
 +S+' *{box-sizing:border-box}'
 +S+' .ts-wrap{background:#fff;border:1px solid var(--zn200);border-radius:26px;overflow:hidden;box-shadow:0 18px 50px -18px rgba(15,23,42,.13)}'
 +S+' .ts-hd{position:relative;padding:22px 26px 18px;background:linear-gradient(180deg,#fff, var(--zn50));border-bottom:1px solid var(--zn200)}'
 +S+' .ts-hd::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,var(--lm400),var(--em600),var(--lm200))}'
 +S+' .ts-hdrow{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}'
 +S+' .ts-kick{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px}'
 +S+' .ts-kick b{font-size:11px;font-weight:800;color:var(--lm800);letter-spacing:.09em;text-transform:uppercase}'
 +S+' .ts-mark{width:26px;height:26px;border-radius:9px;background:var(--lm100);border:1px solid var(--lm200);display:grid;place-items:center;color:var(--lm800);font-size:13px}'
 +S+' .ts-h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em}'
 +S+' .ts-h1 em{font-style:normal;color:var(--lm600)}'
 +S+' .ts-sub{font-size:11.5px;color:var(--zn500);margin-top:3px;max-width:560px;line-height:1.6}'
 +S+' .ts-meta{border:1px solid var(--zn200);background:#fff;border-radius:15px;padding:12px 15px;min-width:250px;font-size:11.5px;position:relative;overflow:hidden}'
 +S+' .ts-meta::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--lm400),var(--em600))}'
 +S+' .ts-mrow{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid var(--zn100)}'
 +S+' .ts-mrow:last-child{border-bottom:none}'
 +S+' .ts-mrow span:first-child{color:var(--zn500)}'
 +S+' .ts-mrow b{font-variant-numeric:tabular-nums}'
 +S+' .ts-ok{background:var(--lm400);color:var(--lm950);border-radius:999px;padding:1px 10px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}'
 +S+' .ts-tools{margin-top:16px;padding-top:14px;border-top:1px solid var(--zn200);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}'
 +S+' .ts-btn{border:1px solid var(--zn200);background:#fff;color:var(--zn700);border-radius:11px;padding:7px 13px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}'
 +S+' .ts-btn:hover{border-color:var(--lm600);color:var(--lm800);background:var(--lm50)}'
 +S+' .ts-btn.on{background:var(--lm400);border-color:var(--lm400);color:var(--lm950);font-weight:800}'
 +S+' .ts-btn.pri{background:var(--lm400);border-color:var(--lm400);color:var(--lm950);font-weight:800;box-shadow:0 4px 14px rgba(163,230,53,.35)}'
 +S+' .ts-sec{padding:20px 26px;border-bottom:1px solid var(--zn200)}'
 +S+' .ts-sec:last-child{border-bottom:none}'
 +S+' .ts-sech{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:13px}'
 +S+' .ts-sect{font-size:11.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;display:flex;align-items:center;gap:7px;margin:0}'
 +S+' .ts-secd{font-size:11px;color:var(--zn500);margin-top:3px;line-height:1.6;max-width:640px}'
 +S+' .ts-dot{width:9px;height:9px;border-radius:3px;flex:none}'
 +S+' .ts-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:11px}'
 +S+' .ts-k{border:1px solid var(--zn200);background:#fff;border-radius:16px;padding:13px 15px}'
 +S+' .ts-k .kk{font-size:9.5px;font-weight:800;color:var(--zn500);letter-spacing:.07em;text-transform:uppercase}'
 +S+' .ts-k .kv{font-size:25px;font-weight:800;margin-top:2px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}'
 +S+' .ts-k .kv em{font-style:normal;font-size:12px;font-weight:600;color:var(--zn500);margin-left:4px}'
 +S+' .ts-k .kn{font-size:10px;margin-top:5px;display:inline-block;border-radius:999px;padding:1px 9px;font-weight:700}'
 +S+' .ts-k.lime{background:var(--lm50);border-color:var(--lm200)} '+S+' .ts-k.lime .kk{color:var(--lm800)} '+S+' .ts-k.lime .kv{color:var(--lm950)}'
 +S+' .ts-k.lime .kn{background:var(--lm200);color:var(--lm950)}'
 +S+' .ts-k.rose{background:var(--rs50);border-color:var(--rs200)} '+S+' .ts-k.rose .kk{color:var(--rs900)} '+S+' .ts-k.rose .kv{color:var(--rs700)}'
 +S+' .ts-k.amber{background:var(--am50);border-color:var(--am200)} '+S+' .ts-k.amber .kk{color:var(--am900)} '+S+' .ts-k.amber .kv{color:var(--am700)}'
 +S+' .ts-k.plain .kn{background:var(--zn100);color:var(--zn700)}'
 +S+' .ts-k.act{background:var(--lm100);border-color:var(--lm400)}'
 +S+' .ts-k.act .kn{background:var(--lm400);color:var(--lm950);font-weight:800}'
 +S+' .ts-pay{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:11px;margin-bottom:14px}'
 +S+' .ts-p{border:1px solid var(--zn200);background:#fff;border-radius:16px;padding:13px 15px}'
 +S+' .ts-p .ph{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}'
 +S+' .ts-p .pl{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;gap:6px}'
 +S+' .ts-p .pt{font-size:9px;font-weight:800;border-radius:999px;padding:1px 8px;white-space:nowrap}'
 +S+' .ts-p .pv{font-size:23px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}'
 +S+' .ts-p .pn{font-size:10px;color:var(--zn500);margin-top:3px;line-height:1.5}'
 +S+' .ts-p.cash{border-color:var(--em200);background:var(--em50)} '+S+' .ts-p.cash .pl{color:var(--em800)} '+S+' .ts-p.cash .pt{background:#fff;color:var(--em800);border:1px solid var(--em200)}'
 +S+' .ts-p.tf{border-color:var(--bl200);background:var(--bl50)} '+S+' .ts-p.tf .pl{color:var(--bl700)} '+S+' .ts-p.tf .pt{background:#fff;color:var(--bl700);border:1px solid var(--bl200)}'
 +S+' .ts-p.cc{border-color:var(--pu200);background:var(--pu50)} '+S+' .ts-p.cc .pl{color:var(--pu700)} '+S+' .ts-p.cc .pt{background:#fff;color:var(--pu700);border:1px solid var(--pu200)}'
 +S+' .ts-p.pend{border-color:var(--am200);background:var(--am50)} '+S+' .ts-p.pend .pl{color:var(--am900)} '+S+' .ts-p.pend .pv{color:var(--am700)} '+S+' .ts-p.pend .pt{background:var(--am200);color:var(--am900)}'
 // §tsCashNet · การ์ดเงินที่ต้องจ่ายออก · โทนแดงเพราะเป็นตัวลบ ไม่ใช่รายรับ
 +S+' .ts-p.out{border-color:var(--rs200);background:var(--rs50)} '+S+' .ts-p.out .pl{color:var(--rs900)} '+S+' .ts-p.out .pv{color:var(--rs700)} '+S+' .ts-p.out .pt{background:var(--rs200);color:var(--rs900)}'
 // §tsSlipAdd · ปุ่มแนบสลิปในตารางเงินหน้างาน
 +S+' .ts-slips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}'
 +S+' .ts-slipb{display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;font-weight:700;'
   +'border:1px dashed var(--am700);color:var(--am700);background:var(--am50);border-radius:999px;padding:2px 9px;white-space:nowrap}'
 +S+' .ts-slipb:hover{background:var(--am200)}'
 +S+' .ts-slipok{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;'
   +'border:1px solid var(--em200);color:var(--em800);background:var(--em50);border-radius:999px;padding:2px 9px;white-space:nowrap}'
 +S+' .ts-card{border:1px solid var(--zn200);border-radius:16px;overflow:hidden;background:#fff}'
 +S+' .ts-scroll{overflow-x:auto}'
 +S+' .ts-tbl{width:100%;border-collapse:collapse;font-size:11.5px}'
 +S+' .ts-tbl th{background:var(--zn100);color:var(--zn700);font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;'
   +'padding:9px 11px;text-align:left;border-bottom:1px solid var(--zn200);white-space:nowrap}'
 +S+' .ts-tbl td{padding:8px 11px;border-bottom:1px solid var(--zn100);vertical-align:top}'
 +S+' .ts-tbl tbody tr:last-child td{border-bottom:none}'
 +S+' .ts-tbl tbody tr:hover td{background:var(--lm50)}'
 /* §tsManMv · แถวที่เลื่อนวันใน Manifest · ยืมโครงแถวยกเลิกแต่เป็นสีม่วง
    ต้องแยกจาก "ยกเลิก" ให้ออก เพราะใบยังอยู่ แค่ไปวันอื่น */
 +S+' .ts-tbl tbody tr.ts-mvrow>td:first-child{box-shadow:inset 4px 0 0 #7C4DBE}'
 +S+' .ts-tbl tbody tr.ts-mvrow .ts-lead{text-decoration:line-through;text-decoration-thickness:1.5px}'
 /* §cotNoCol · ปุ่ม "เก็บไม่ได้" เป็นการปิดยอดโดยไม่ได้เงิน · ต้องดูต่างจากปุ่มที่แปลว่าได้เงิน */
 +S+' .ts-db.nocol{border-color:var(--rs200);color:var(--rs700)}'
 +S+' .ts-db.nocol.pick{background:var(--rs700);border-color:var(--rs700);color:#fff}'
 /* §tsStrand · แถวที่เลื่อนวันออกไปแล้ว · จางลงแต่ยังอ่านครบ + ขีดม่วงหน้าแถว
    ต้องแยกออกจากเคสที่ยังรอตัดสินให้ชัด ไม่งั้นคนปิดวันนึกว่ายังมีงานค้าง */
 +S+' .ts-tbl tbody tr.ts-moved>td{background:#FBFAFD;color:var(--zn500)}'
 +S+' .ts-tbl tbody tr.ts-moved:hover>td{background:#F6F3FB}'
 +S+' .ts-tbl tbody tr.ts-moved td:first-child{box-shadow:inset 4px 0 0 #7C4DBE}'
 +S+' .ts-tbl tbody tr.ts-moved .ts-lead{text-decoration:line-through;text-decoration-thickness:1.5px;color:var(--zn500)}'
 +S+' .ts-tbl tbody tr.ts-moved .ts-ag{filter:grayscale(.8);opacity:.7}'
 +S+' .ts-tbl tr.need td{background:var(--am50)}'
 /* §tsCxlNoCount · ใบที่เก็บไม่ได้แล้ว · เห็นได้แต่ไม่ดึงสายตาไปจากใบที่ยังต้องตามเก็บจริง */
 +S+' .ts-tbl tr.ts-cxl td{background:#FAF9F6;color:var(--zn500)}'
 +S+' .ts-tbl tr.ts-cxl .ts-lead,.ts-tbl tr.ts-cxl .ts-vch{opacity:.62}'
 +S+' .ts-tbl tr.need:hover td{background:#fef6e0}'
 +S+' .ts-tbl .r{text-align:right} '+S+' .ts-tbl .c{text-align:center}'
 +S+' .ts-mono{font-family:\'DM Mono\',monospace;font-variant-numeric:tabular-nums}'
 +S+' .ts-vch{font-family:\'DM Mono\',monospace;font-weight:800;color:var(--zn900)}'
 +S+' .ts-ag{display:block;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;line-height:1.22;'
   +'max-width:190px;white-space:normal;word-break:normal;overflow-wrap:break-word;box-shadow:0 1px 2px rgba(0,0,0,.10)}'
 +S+' .ts-man td:nth-child(2){min-width:118px}'
 +S+' .ts-thsub{display:block;font-size:8px;font-weight:600;color:var(--zn400);letter-spacing:0;text-transform:none}'
 +S+' .ts-totb{display:block;font-size:9px;font-weight:600;color:var(--zn400);white-space:nowrap;margin-top:1px}'
 +S+' .ts-totb em{font-style:normal;color:var(--lm700);font-weight:700;margin-left:3px}'
 +S+' .ts-net{display:block;font-size:9.5px;font-weight:600;color:var(--zn500);white-space:nowrap;margin-top:1px}'
 // §tsCotSettle
 +S+' .ts-cotn{white-space:pre-wrap;line-height:1.45;color:var(--zn700);font-size:11.5px}'
 +S+' .ts-cotn.empty{color:var(--zn400);font-style:italic}'
 +S+' .ts-db.sug{border-color:var(--lm600);color:var(--lm800);background:var(--lm50)}'
 +S+' .ts-db.pick{background:var(--zn900);border-color:var(--zn900);color:#fff;font-weight:800}'
 +S+' .ts-cotp{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:5px;font-size:10.5px;color:var(--zn500)}'
 +S+' .ts-cotamt{width:80px;text-align:right;font-family:\'DM Mono\',monospace;border:1px solid var(--zn300);'
   +'border-radius:3px;padding:3px 7px;font-size:11.5px}'
 +S+' .ts-cotsum{margin-top:4px;font-size:10.5px;line-height:1.5;color:var(--zn500)}'
 +S+' .ts-cotcol{min-width:210px}'
 +S+' .ts-lead{font-weight:700;color:var(--zn900)} '+S+' .ts-tel{font-size:9.5px;color:var(--zn500);font-family:\'DM Mono\',monospace}'
 +S+' .ts-chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:9.5px;font-weight:800;white-space:nowrap;border:1px solid;margin:1px 3px 1px 0}'
 +S+' .ts-chip.g{background:var(--lm100);color:var(--lm950);border-color:var(--lm200)}'
 +S+' .ts-chip.r{background:var(--rs50);color:var(--rs700);border-color:var(--rs200)}'
 +S+' .ts-chip.a{background:var(--am50);color:var(--am700);border-color:var(--am200)}'
 +S+' .ts-chip.n{background:var(--zn100);color:var(--zn700);border-color:var(--zn200)}'
 +S+' .ts-chip.b{background:var(--bl50);color:var(--bl700);border-color:var(--bl200)}'
 +S+' .ts-chip.p{background:var(--pu50);color:var(--pu700);border-color:var(--pu200)}'
 +S+' .ts-chip.e{background:var(--em50);color:var(--em800);border-color:var(--em200)}'
 +S+' .ts-db{border:1.5px solid var(--zn200);background:#fff;color:var(--zn700);border-radius:9px;padding:4px 9px;font-family:inherit;'
   +'font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap;margin:1px 3px 1px 0}'
 +S+' .ts-db:hover{border-color:var(--lm600);background:var(--lm50)}'
 +S+' .ts-db.on{border-color:var(--lm600);background:var(--lm400);color:var(--lm950);font-weight:800}'
 +S+' .ts-db.warn.on{border-color:var(--am700);background:var(--am200);color:var(--am900)}'
 +S+' .ts-db.mut.on{border-color:var(--zn400);background:var(--zn200);color:var(--zn900)}'
 +S+' .ts-db.pp.on{border-color:var(--pu700);background:var(--pu200);color:var(--pu700)}'
 +S+' .ts-db.del{border-color:var(--rs200);color:var(--rs700)}'
 +S+' .ts-note{margin-top:5px;width:100%;max-width:300px;border:1px solid var(--zn200);border-radius:9px;padding:5px 9px;font-size:11px;font-family:inherit;box-sizing:border-box}'
 +S+' .ts-note:focus{outline:none;border-color:var(--lm600)}'
 +S+' .ts-empty{padding:26px;text-align:center;color:var(--zn400);font-size:12px}'
 +S+' .ts-grow td{background:var(--zn50);font-weight:800}'
 +S+' .ts-sign{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:22px;padding-top:18px;border-top:1px solid var(--zn200)}'
 +S+' .ts-sg{border:1px solid var(--zn200);border-radius:15px;padding:14px;text-align:center;background:var(--zn50)}'
 +S+' .ts-sg i{display:block;height:34px;border-bottom:1px dashed var(--zn400);margin-bottom:8px}'
 +S+' .ts-sg b{font-size:11.5px;display:block} '+S+' .ts-sg span{font-size:9.5px;color:var(--zn500)}'
 +S+' .ts-rt{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px dashed var(--zn200)}'
 +S+' .ts-rtl{font-size:10px;font-weight:800;color:var(--zn500);letter-spacing:.06em;text-transform:uppercase;margin-right:2px}'
 +S+' .ts-rb{display:inline-flex;align-items:center;border:1px solid var(--zn200);background:#fff;color:var(--zn700);'
   +'border-radius:11px;padding:6px 12px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}'
 +S+' .ts-rb i{font-style:normal;font-size:9.5px;font-weight:600;color:var(--zn400);margin-left:7px}'
 +S+' .ts-rb:hover{border-color:var(--lm600);background:var(--lm50)}'
 +S+' .ts-rb.on{border-color:var(--lm600);background:var(--lm100);color:var(--lm950);font-weight:800}'
 +S+' .ts-rb.on i{color:var(--lm800)}'
 +S+' .ts-dcol{max-width:215px}'
 +S+' .ts-dcell{display:flex;flex-direction:column;align-items:flex-start;gap:2px;line-height:1.25}'
 +S+' .ts-drow{display:flex;align-items:center;gap:5px;flex-wrap:nowrap;max-width:100%}'
 +S+' .ts-dfile em.w{color:var(--zn400);font-weight:600}'
 +S+' .ts-dref{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;font-weight:700;color:var(--zn700);'
   +'background:var(--zn100);border-radius:5px;padding:0 5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .ts-dchk{font-size:9px;font-weight:700;color:var(--am700)}'
 +S+' .ts-dchk.ok{color:var(--em600)}'
 +S+' .ts-dfile{font-size:9px;color:var(--zn500);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .ts-dfile em{font-style:normal;font-weight:700;color:var(--zn700)}'
 +S+' .ts-dby{font-size:8.5px;color:var(--zn400)}'
 +S+' .ts-dnote{font-size:9px;color:var(--rs700);font-weight:600;max-width:100%;overflow:hidden;'
   +'text-overflow:ellipsis;white-space:nowrap}'
 +S+' .ts-dfiles{display:flex;flex-direction:column;gap:1px}'
 +S+' .ts-dfiles .ts-dfile{max-width:250px}'
 +S+' .ts-px{width:30px;padding-left:4px;padding-right:4px;font-variant-numeric:tabular-nums;font-weight:700}'
 +S+' .ts-px.zero{color:var(--zn200);font-weight:500}'
 +S+' .ts-px.lost{color:var(--rs700)}'
 +S+' .ts-px.lost em{font-style:normal;font-size:8.5px;color:var(--zn400);font-weight:600}'
 +S+' .ts-tm b{display:block;font-weight:800}'
 +S+' .ts-dep{display:block;font-size:9px;color:var(--bl700);font-weight:700;white-space:nowrap;margin-top:1px}'
 +S+' .ts-room{display:block;font-size:9px;color:var(--zn500);font-weight:600}'
 +S+' .ts-sbk{font-size:10.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}'
 +S+' .ts-cxc{font-size:9.5px;font-weight:700;color:var(--rs700);margin-left:5px}'
 +S+' .ts-cxr{font-size:9px;color:var(--zn500);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .ts-cxlrow > td{background:var(--rs50);opacity:.78}'
 +S+' .ts-cxlrow .ts-vch,'+S+' .ts-cxlrow .ts-lead{text-decoration:line-through}'
 +S+' .ts-aocol{max-width:210px}'
 +S+' .ts-aos{display:flex;flex-direction:column;align-items:flex-start;gap:2px}'
 +S+' .ts-sls{display:flex;flex-direction:column;align-items:flex-start;gap:2px;max-width:230px}'
 +S+' .ts-sls .ts-ao{white-space:normal;overflow:visible;text-overflow:clip}'
 +S+' .ts-ao{display:inline-block;max-width:100%;font-size:9.5px;font-weight:600;line-height:1.3;'
   +'padding:1px 6px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .ts-ao b{font-weight:800}'
 +S+' .ts-ao.ao-bk{background:var(--bl50);color:var(--bl700)}'
 +S+' .ts-ao.ao-ex{background:var(--em50);color:var(--em800)}'
 +S+' .ts-ao.ao-up{background:var(--am50);color:var(--am900)}'
 +S+' .ts-ao.ao-up.due{background:var(--rs50);color:var(--rs900)}'
 +S+' .ts-ao.ao-pier{background:var(--pu50);color:var(--pu700)}'
 +S+' .ts-aokey{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}'
 +S+' .ts-paycol{max-width:196px}'
 +S+' .ts-payc{display:flex;flex-direction:column;align-items:flex-start;gap:2px;line-height:1.25}'
 +S+' .ts-pyd{font-size:12px;font-weight:800;color:var(--am900);background:var(--am50);'
   +'border:1px solid var(--am200);border-radius:6px;padding:0 6px;white-space:nowrap;font-variant-numeric:tabular-nums}'
 +S+' .ts-pyg{font-size:12px;font-weight:800;color:var(--em800);background:var(--em50);border-radius:6px;padding:1px 7px;white-space:nowrap}'
 +S+' .ts-pyn{font-size:10.5px;color:var(--zn500);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 // §tsPayDetail · บรรทัดประกอบที่ยาวได้ (โน้ต COT / คนรับเงิน) · ตัดคำได้ ไม่ต้องบีบเป็นบรรทัดเดียว
 +S+' .ts-pyn2{font-size:10.5px;color:var(--zn500);line-height:1.35;white-space:normal;max-width:100%}'
 +S+' .ts-pyms{display:flex;flex-wrap:wrap;gap:2px;margin-top:1px}'
 +S+' .ts-chip.ts-pyx{font-size:11px;font-weight:800;padding:2px 8px;margin:0}'
 +S+' .ts-pym{font-size:9px;font-weight:700;color:var(--em600);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .ts-pyw{font-size:10.5px;font-weight:800;color:var(--rs700)}'
 +S+' .ts-chip.ts-nb{position:relative;opacity:.5;filter:grayscale(.85);color:var(--zn500)!important}'
 +S+' .ts-chip.ts-nb::after{content:"";position:absolute;left:3px;right:3px;top:50%;height:1.4px;'
   +'background:var(--rs700);transform:translateY(-50%);border-radius:1px}'
 // ══════ §tsFactSheet · ชั้นทับหน้าตาให้เป็นเอกสาร ══════
 +S+' .ts-wrap{border-radius:4px;border-color:var(--zn300);box-shadow:none}'
 +S+' .ts-hd{padding:20px 26px 0;background:#fff}'
 +S+' .ts-hd::before{height:3px}'
 +S+' .ts-kick b{font-size:9.5px;letter-spacing:.16em}'
 +S+' .ts-mark{width:22px;height:22px;border-radius:3px;font-size:11px}'
 +S+' .ts-h1{font-size:25px;font-weight:700;letter-spacing:-.025em}'
 +S+' .ts-sub{font-size:10px;max-width:660px}'
 // เลขที่เอกสารมุมขวา · แทนการ์ด meta เดิม
 +S+' .ts-docid{text-align:right;flex:none}'
 +S+' .ts-docid .l{font-size:8.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--zn400)}'
 +S+' .ts-docid .v{font-family:\'DM Mono\',monospace;font-size:15px;font-weight:500;margin-top:1px}'
 +S+' .ts-docid .s{font-size:9.5px;color:var(--zn500);margin-top:4px}'
 // แถบ meta เต็มความกว้าง · เห็นครบตั้งแต่บรรทัดแรกโดยไม่ต้องเลื่อน
 +S+' .ts-mbar{display:grid;grid-template-columns:repeat(6,1fr);margin:14px -26px 0;'
   +'border-top:2px solid var(--zn900);border-bottom:1px solid var(--zn200)}'
 +S+' .ts-mbar .c{padding:9px 14px;border-right:1px solid var(--zn200);min-width:0}'
 +S+' .ts-mbar .c:last-child{border-right:none}'
 +S+' .ts-mbar .k{font-size:8.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--zn400)}'
 +S+' .ts-mbar .v{font-size:13px;font-weight:600;margin-top:2px;line-height:1.3;font-variant-numeric:tabular-nums}'
 +S+' .ts-mbar .v small{font-size:10px;font-weight:500;color:var(--zn500)}'
 // แถบเครื่องมือกับแถวชิป · กินเต็มความกว้างเหมือนแถบเอกสาร
 +S+' .ts-tools{margin:0 -26px;padding:11px 26px;border-top:none;border-bottom:1px solid var(--zn200);background:var(--zn50)}'
 +S+' .ts-rt{margin:0 -26px;padding:9px 26px;border-top:none;border-bottom:1px solid var(--zn200)}'
 +S+' .ts-rtl{font-size:8.5px;letter-spacing:.13em;width:52px;flex:none}'
 +S+' .ts-btn{border-radius:3px;padding:5px 11px;font-size:11px;font-weight:600;border-color:var(--zn300)}'
 +S+' .ts-btn.pri{background:var(--zn900);border-color:var(--zn900);color:#fff;box-shadow:none}'
 +S+' .ts-rb{border-radius:3px;padding:4px 10px;font-size:11px;font-weight:600;border-color:var(--zn300)}'
 +S+' .ts-rb i.ts-dot{width:7px;height:7px}'
 // หัวข้อมีเลขกำกับ
 +S+' .ts-sect{font-size:13.5px;font-weight:700;letter-spacing:-.01em;text-transform:none;gap:10px;align-items:baseline}'
 +S+' .ts-sn{font-family:\'DM Mono\',monospace;font-size:11px;font-weight:500;color:#fff;background:var(--zn900);'
   +'padding:2px 6px;border-radius:2px;flex:none}'
 +S+' .ts-secd{display:none}'                                  // §tsTrim · ตัดคำอธิบายใต้หัวข้อออก
 // §tsTrim · แบ่งหัวข้อให้ชัด · แถบเทาหนาคั่นระหว่างส่วน + หัวข้อมีเส้นใต้ของตัวเอง
 +S+' .ts-sec{border-bottom:10px solid var(--zn100);box-shadow:inset 0 -11px 0 -10px var(--zn200),inset 0 1px 0 0 var(--zn200)}'
 +S+' .ts-sec:first-of-type{box-shadow:inset 0 -11px 0 -10px var(--zn200)}'
 +S+' .ts-sec:last-child{border-bottom:none;box-shadow:inset 0 1px 0 0 var(--zn200)}'
 +S+' .ts-sech{margin-bottom:12px;padding-bottom:9px;border-bottom:1px solid var(--zn200);align-items:center}'
 // กลุ่มตัวเลข · เส้นคั่นแทนการ์ดสี
 +S+' .ts-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:0;'
   +'border-top:1px solid var(--zn900);border-bottom:1px solid var(--zn200)}'
 +S+' .ts-k{border:none;border-right:1px solid var(--zn200);border-radius:0;background:#fff !important;padding:11px 14px 12px}'
 +S+' .ts-k:last-child{border-right:none}'
 +S+' .ts-k .kk{font-size:8.5px;letter-spacing:.1em;color:var(--zn400) !important}'
 +S+' .ts-k .kv{font-family:\'DM Mono\',monospace;font-size:28px;font-weight:400;letter-spacing:-.03em;color:var(--zn900)}'
 +S+' .ts-k .kv em{font-family:inherit;font-size:11px}'
 +S+' .ts-k .kn{background:transparent !important;padding:0;margin-top:3px;font-size:9.5px;font-weight:500;color:var(--zn500) !important;border-radius:0}'
 +S+' .ts-k.lime .kv{color:var(--lm600)}'
 +S+' .ts-k.rose .kv{color:var(--rs700)}'
 +S+' .ts-k.amber .kv,'+S+' .ts-k.act .kv{color:var(--am700)}'
 +S+' .ts-read{margin-top:11px;padding:9px 12px;border-left:2px solid var(--lm600);background:var(--lm50);font-size:11.5px;line-height:1.7}'
 +S+' .ts-read b{font-family:\'DM Mono\',monospace;font-weight:500}'
 // การ์ดเงิน · พื้นขาว เหลือแถบสีบาง ๆ ด้านบนเป็นตัวแยก
 +S+' .ts-pay{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:13px;'
   +'border-top:1px solid var(--zn900);border-bottom:1px solid var(--zn200)}'
 +S+' .ts-p{border:none;border-right:1px solid var(--zn200);border-radius:0;background:#fff !important;padding:11px 14px 12px;position:relative}'
 +S+' .ts-p:last-child{border-right:none}'
 +S+' .ts-p::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--zn300)}'
 +S+' .ts-p.cash::before{background:var(--em600)} '+S+' .ts-p.tf::before{background:var(--bl700)}'
 +S+' .ts-p.cc::before{background:var(--pu700)}   '+S+' .ts-p.pend::before{background:var(--am700)}'
 +S+' .ts-p.out::before{background:var(--rs700)}'
 +S+' .ts-pay5{grid-template-columns:repeat(5,1fr)}'
 +S+' .ts-p .pl{font-size:9px;letter-spacing:.08em}'
 +S+' .ts-p .pt{border-radius:2px;font-size:8.5px;font-weight:700;background:#fff !important;border:1px solid var(--zn200) !important;color:var(--zn500) !important}'
 +S+' .ts-p .pv{font-family:\'DM Mono\',monospace;font-size:24px;font-weight:400;letter-spacing:-.03em}'
 +S+' .ts-p .pn{font-size:9.5px}'
 // ตาราง · เส้นตารางจาง ๆ ทุกคอลัมน์ ไล่สายตาง่ายตอนพิมพ์
 +S+' .ts-card{border-radius:3px;border-color:var(--zn300)}'
 +S+' .ts-tbl th{font-size:8.5px;letter-spacing:.09em;padding:7px 9px;border-bottom:1px solid var(--zn900);'
   +'border-right:1px solid var(--zn200);vertical-align:bottom}'
 +S+' .ts-tbl th:last-child{border-right:none}'
 +S+' .ts-tbl td{padding:7px 9px;border-right:1px solid #f4f3f1}'
 +S+' .ts-tbl td:last-child{border-right:none}'
 +S+' .ts-thsub{font-size:8px}'
 +S+' .ts-mono,'+S+' .ts-vch{font-family:\'DM Mono\',monospace}'
 +S+' .ts-chip{border-radius:2px;font-size:9px;padding:1px 6px}'
 +S+' .ts-ag{border-radius:3px;box-shadow:none;padding:6px 9px;font-size:11.5px}'
 +S+' .ts-grow td{background:var(--zn50);border-top:1.5px solid var(--zn900);border-bottom:1px solid var(--zn300)}'
 +S+' .ts-grow .ts-dot{width:3px !important;height:14px !important;border-radius:1px !important}'
 // ท้ายเอกสาร
 +S+' .ts-sign{grid-template-columns:repeat(3,1fr);gap:34px;padding-top:0;border-top:none;margin-top:26px}'
 +S+' .ts-sg{border:none;border-top:1px solid var(--zn400);border-radius:0;background:transparent;padding:7px 0 0;text-align:left}'
 +S+' .ts-sg i{display:none}'
 +S+' .ts-sg b{font-size:10.5px} '+S+' .ts-sg span{font-size:9px}'
 +S+' .ts-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px;padding-top:12px;'
   +'border-top:1px solid var(--zn200);font-family:\'DM Mono\',monospace;font-size:9px;color:var(--zn400)}'
 // ══════ §tsLessLines · เส้นขอบเหลือเฉพาะตาราง ══════
 +S+' .ts-mbar{border-bottom:none;padding-bottom:2px}'
 +S+' .ts-mbar .c{border-right:none;padding:9px 22px 9px 0}'
 +S+' .ts-kpis{border-bottom:none;gap:0}'
 +S+' .ts-k{border-right:none;padding-right:22px}'
 +S+' .ts-pay{border-top:none;border-bottom:none}'
 +S+' .ts-p{border-right:none;padding-right:22px}'
 +S+' .ts-sech{border-bottom:none;padding-bottom:2px}'
 +S+' .ts-tools{border-bottom:none;background:transparent}'
 +S+' .ts-rt{border-bottom:none;padding-top:2px;padding-bottom:5px}'
 // ══════ §tsReadable · ขนาดตัวอักษรบนจอ ══════
 +S+' .ts-tbl{font-size:12.5px}'
 +S+' .ts-tbl th{font-size:9.5px}'
 +S+' .ts-thsub{font-size:9px}'
 +S+' .ts-chip{font-size:10.5px;padding:2px 8px}'
 +S+' .ts-tel{font-size:11px}'
 +S+' .ts-vch{font-size:12px}'
 +S+' .ts-lead{font-size:12.5px}'
 +S+' .ts-ag{font-size:12.5px}'
 +S+' .ts-totb{font-size:10.5px}'
 +S+' .ts-net{font-size:11px}'
 +S+' .ts-ao{font-size:10.5px}'
 +S+' .ts-room,'+S+' .ts-dep,'+S+' .ts-cxr,'+S+' .ts-sbk{font-size:10.5px}'
 +S+' .ts-mbar .k{font-size:9.5px}'+S+' .ts-mbar .v{font-size:14px}'+S+' .ts-mbar .v small{font-size:11px}'
 +S+' .ts-k .kk{font-size:9.5px}'+S+' .ts-k .kn{font-size:11px}'
 +S+' .ts-p .pl{font-size:10px}'+S+' .ts-p .pn{font-size:11px}'+S+' .ts-p .pt{font-size:9.5px}'
 +S+' .ts-read{font-size:12.5px}'
 +S+' .ts-rb{font-size:12px}'+S+' .ts-rb i{font-size:10.5px}'
 +S+' .ts-sg b{font-size:11.5px}'+S+' .ts-sg span{font-size:10.5px}'
 +S+' .ts-foot{font-size:10px}'
 // ══════ §tsReadable · เส้นตารางคมขึ้น · เส้นเดียวที่เหลือในเอกสาร ต้องเห็นชัด ══════
 +S+' .ts-card{border:1.4px solid var(--zn900)}'
 +S+' .ts-tbl th{border-bottom:1.4px solid var(--zn900);border-right:1px solid var(--zn400)}'
 +S+' .ts-tbl td{border-bottom:1px solid var(--zn400);border-right:1px solid var(--zn300)}'
 +S+' .ts-tbl th:last-child,'+S+' .ts-tbl td:last-child{border-right:none}'
 +S+' .ts-grow td{border-top:1.4px solid var(--zn900);border-bottom:1.4px solid var(--zn900);border-right:none}'
 +S+' .ts-doc{cursor:pointer}'+S+' .ts-doc:hover{filter:brightness(.95)}'
 +'@media print{'
   +S+' .ts-noprint{display:none!important}'
   +S+' .ts-wrap{border:none;box-shadow:none;border-radius:0}'
   +S+' .ts-hd{padding:0 0 10px}'+S+' .ts-hd::before{height:3px}'
   // §tsFactSheet · แถบ meta / หัวข้อมีเลข / ท้ายเอกสาร ตอนพิมพ์
   +S+' .ts-mbar{margin:10px 0 0;grid-template-columns:repeat(6,1fr)}'
   +S+' .ts-mbar .c{padding:5px 7px}'+S+' .ts-mbar .v{font-size:10px}'+S+' .ts-mbar .k{font-size:7px}'
   +S+' .ts-docid .v{font-size:12px}'
   +S+' .ts-sect{font-size:12px}'+S+' .ts-sn{font-size:9px;padding:1px 4px}'
   +S+' .ts-k{padding:6px 8px}'+S+' .ts-read{font-size:9px;padding:6px 8px;margin-top:7px}'
   +S+' .ts-p{padding:6px 8px}'
   +S+' .ts-foot{font-size:7.5px;margin-top:10px;padding-top:7px}'
   +S+' .ts-sec{padding:12px 0;break-inside:auto}'
   +S+' .ts-sech{margin-bottom:8px}'
   +S+' .ts-h1{font-size:19px}'+S+' .ts-sub{font-size:9.5px}'
   +S+' .ts-k .kv{font-size:18px}'+S+' .ts-p .pv{font-size:17px}'
   +S+' .ts-tbl{font-size:8.5px}'+S+' .ts-tbl td{padding:3px 5px}'+S+' .ts-tbl th{padding:5px}'
   // §tsPrint · เดิม .ts-card ห้ามแตกหน้า → ตาราง manifest ยาวๆ กระโดดไปทั้งใบ
   //   ทำให้หน้าก่อนหน้าโล่งครึ่งหน้า · การ์ดตารางต้องไหลข้ามหน้าได้
   +S+' .ts-k,'+S+' .ts-p,'+S+' .ts-sg,'+S+' .ts-meta{break-inside:avoid}'
   +S+' .ts-card{break-inside:auto}'+S+' .ts-sec{break-inside:auto}'
   +S+' .ts-tbl tr{break-inside:avoid}'
   +S+' .ts-tbl thead{display:table-header-group}'      // หัวตารางซ้ำทุกหน้า
   +S+' .ts-tbl tbody tr.ts-grow{break-after:avoid}'    // หัวเส้นทางห้ามอยู่ท้ายหน้าเดี่ยวๆ
   // ตัวเลขฝั่งขวาชนกัน · บังคับไม่ให้ตัดบรรทัดและเว้นช่องให้พอ
   +S+' .ts-tbl td.c,'+S+' .ts-tbl td.r,'+S+' .ts-tbl th.c,'+S+' .ts-tbl th.r{white-space:nowrap;padding-left:7px;padding-right:7px}'
   +S+' .ts-chip{white-space:nowrap}'
   +S+' .ts-ag{display:block;max-width:100%;white-space:normal;word-break:normal;overflow-wrap:break-word;'
     +'border-radius:5px;padding:4px 5px;font-size:8.6px;font-weight:700;line-height:1.18;box-shadow:none}'
   +S+' .ts-lead{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
   +S+' .ts-tbl{font-size:7.6px}'+S+' .ts-tbl td{padding:2.5px 3.5px}'+S+' .ts-tbl th{padding:4px 3.5px}'
   // ล็อกความกว้างต่อคอลัมน์ · รวม 99.5% · ที่เหลือเป็นระยะหายใจของขอบตาราง
   +S+' .ts-man{table-layout:fixed;width:100%}'
   +S+' .ts-man td{overflow:hidden}'
   +S+' .ts-man td:nth-child(2){padding-left:2px;padding-right:2px;vertical-align:middle}'
   +S+' .ts-man th{white-space:normal;line-height:1.12;vertical-align:bottom;overflow:hidden}'
   // §tsManNoPickup · 16 คอลัมน์ · รวม 99.8% เผื่อเส้นตารางอีกเล็กน้อย
   +S+' .ts-man th:nth-child(1),'+S+' .ts-man td:nth-child(1){width:5.6%}'     // Voucher
   +S+' .ts-man th:nth-child(2),'+S+' .ts-man td:nth-child(2){width:7.4%}'     // Agency
   +S+' .ts-man th:nth-child(3),'+S+' .ts-man td:nth-child(3){width:9.8%}'     // Customer
   +S+' .ts-man th:nth-child(4),'+S+' .ts-man td:nth-child(4),'
     +S+' .ts-man th:nth-child(5),'+S+' .ts-man td:nth-child(5),'
     +S+' .ts-man th:nth-child(6),'+S+' .ts-man td:nth-child(6),'
     +S+' .ts-man th:nth-child(7),'+S+' .ts-man td:nth-child(7){width:2.7%}'   // AD/CHD/INF/FOC
   +S+' .ts-man th:nth-child(8),'+S+' .ts-man td:nth-child(8){width:5.8%}'     // Actual/Booked
   +S+' .ts-man th:nth-child(9),'+S+' .ts-man td:nth-child(9){width:9.8%}'     // Pickup point
   +S+' .ts-man th:nth-child(10),'+S+' .ts-man td:nth-child(10){width:7.2%}'   // Drop-off
   +S+' .ts-man th:nth-child(11),'+S+' .ts-man td:nth-child(11){width:8.8%}'   // Add-on
   +S+' .ts-man th:nth-child(12),'+S+' .ts-man td:nth-child(12){width:6.2%}'   // Van · Boat
   +S+' .ts-man th:nth-child(13),'+S+' .ts-man td:nth-child(13){width:8.8%}'   // Pay
   +S+' .ts-man th:nth-child(14),'+S+' .ts-man td:nth-child(14){width:6.6%}'   // Total
   +S+' .ts-man th:nth-child(15),'+S+' .ts-man td:nth-child(15){width:7.6%}'   // Cancel · Charge
   +S+' .ts-man th:nth-child(16),'+S+' .ts-man td:nth-child(16){width:5.4%}'   // Status
   // ป้ายในสองคอลัมน์ท้ายยาวกว่าช่อง · ให้ขึ้นบรรทัดใหม่แทนล้นออกไปนอกกระดาษ
   +S+' .ts-man td:nth-child(15) .ts-chip,'+S+' .ts-man td:nth-child(16) .ts-chip{white-space:normal;line-height:1.2}'
   +S+' .ts-pyd{font-size:8px;padding:0 3px}'
   +S+' .ts-pyg,'+S+' .ts-pyn,'+S+' .ts-pyn2,'+S+' .ts-pym,'+S+' .ts-pyw{font-size:7.4px}'
   +S+' .ts-chip.ts-pyx{font-size:7.4px;padding:0 3px}'
   // เบอร์โทรตัดบรรทัดทำให้ทุกแถวสูงขึ้นอีกบรรทัด · บีบให้อยู่บรรทัดเดียว
   +S+' .ts-man td:nth-child(3) .ts-tel{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}'
   +S+' .ts-ao{font-size:6.8px;padding:0 3px;line-height:1.25;white-space:normal;overflow:visible;text-overflow:clip}'
   +S+' .ts-totb{font-size:6.2px;margin-top:0}'+S+' .ts-totb em{margin-left:2px}'
   +S+' .ts-thsub{font-size:6.2px}'
   +S+' .ts-aokey{margin-top:4px;gap:4px}'   // คำอธิบายสีต้องติดไปบนกระดาษด้วย ไม่งั้นอ่านสีไม่ออก
   +S+' .ts-man .ts-ag,'+S+' .ts-man .ts-lead,'+S+' .ts-man .ts-sbk{max-width:100%}'
   +S+' .ts-chip{padding:0 4px;font-size:7.4px}'
   +S+' .ts-ag{font-size:8px;padding:3px 4px}'+S+' .ts-lead{max-width:112px}'
   +S+' .ts-px{width:22px;padding-left:2px;padding-right:2px}'
   +S+' .ts-vch{font-size:7.4px}'
   +S+' .ts-sbk{font-size:7.6px;max-width:104px}'
   +S+' .ts-dep,'+S+' .ts-room,'+S+' .ts-cxr{font-size:6.8px}'
   +S+' .ts-scroll{overflow:visible}'
   // §tsCotSettle · บนกระดาษเอาแค่ผลลัพธ์ · ปุ่มกับช่องกรอกไม่ต้องไป
   +S+' .ts-db,'+S+' .ts-cotamt,'+S+' .ts-cotp,'+S+' .ts-note{display:none !important}'
   +S+' .ts-cotsum{margin-top:0;font-size:8.4px}'
   +S+' .ts-cotn{font-size:8.4px}'
   // ══════ §tsReadable · ตอนพิมพ์ · ตัวโตขึ้นทั้งชุด ══════
   +S+' .ts-tbl{font-size:9px}'+S+' .ts-tbl td{padding:3.5px 4px}'+S+' .ts-tbl th{padding:5px 4px;font-size:7.6px}'
   +S+' .ts-chip{font-size:8.4px;padding:1px 4px}'
   +S+' .ts-vch{font-size:8.6px}'+S+' .ts-ag{font-size:9px;padding:3px 4px}'
   +S+' .ts-tel{font-size:8px}'+S+' .ts-lead{font-size:9px;max-width:118px}'
   +S+' .ts-ao{font-size:8px;padding:1px 3px}'
   +S+' .ts-totb{font-size:7.6px}'+S+' .ts-net{font-size:7.8px}'+S+' .ts-thsub{font-size:7px}'
   +S+' .ts-dep,'+S+' .ts-room,'+S+' .ts-cxr{font-size:8px}'+S+' .ts-sbk{font-size:8.4px}'
   +S+' .ts-pyd{font-size:9px;padding:1px 4px}'
   +S+' .ts-pyg,'+S+' .ts-pyn,'+S+' .ts-pyn2,'+S+' .ts-pym,'+S+' .ts-pyw{font-size:8.4px}'
   +S+' .ts-chip.ts-pyx{font-size:8.4px;padding:1px 4px}'
   +S+' .ts-mbar .k{font-size:7.6px}'+S+' .ts-mbar .v{font-size:11px}'
   +S+' .ts-k .kk{font-size:7.6px}'+S+' .ts-k .kv{font-size:20px}'+S+' .ts-k .kn{font-size:8.4px}'
   +S+' .ts-p .pl{font-size:8.4px}'+S+' .ts-p .pv{font-size:18px}'+S+' .ts-p .pn{font-size:8.4px}'
   +S+' .ts-read{font-size:10px;padding:7px 9px}'
   // ══════ §tsReadable · เส้นตารางบนกระดาษ · หมึกดำล้วน ไม่ใช่เทาอ่อน ══════
   +S+'{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
   +S+' *{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
   +S+' .ts-card{border:1.2px solid #111827}'
   +S+' .ts-tbl th{border-bottom:1.2px solid #111827;border-right:.8px solid #6b7280;background:#eceae6}'
   +S+' .ts-tbl td{border-bottom:.8px solid #6b7280;border-right:.6px solid #a8a29e}'
   +S+' .ts-tbl th:last-child,'+S+' .ts-tbl td:last-child{border-right:none}'
   +S+' .ts-grow td{border-top:1.2px solid #111827;border-bottom:1px solid #111827;border-right:none;background:#e7e5e4}'
   // ตัวโตขึ้นแล้วช่อง Pay ล้น · คืนที่ให้จากช่องที่เหลือที่ว่างกว่า (รวมยังคง 99.8%)
   +S+' .ts-man th:nth-child(10),'+S+' .ts-man td:nth-child(10){width:5.4%}'   // Drop-off
   +S+' .ts-man th:nth-child(11),'+S+' .ts-man td:nth-child(11){width:8.2%}'   // Add-on
   +S+' .ts-man th:nth-child(13),'+S+' .ts-man td:nth-child(13){width:11.5%}'  // Pay
   +S+' .ts-man th:nth-child(15),'+S+' .ts-man td:nth-child(15){width:7.3%}'   // Cancel · Charge
   +S+' .ts-man td:nth-child(13) .ts-chip{white-space:normal;line-height:1.25}'
   +S+' .ts-man td:nth-child(2){vertical-align:top}'   // ป้าย agency เกาะขอบบนเหมือนช่องอื่น
   // ป้ายรถ/เรือ กับสูตร Net ยาวกว่าช่อง · ให้ขึ้นบรรทัดใหม่แทนถูกตัดหาย
   +S+' .ts-man td:nth-child(12) .ts-chip{white-space:normal;line-height:1.25}'
   +S+' .ts-net{white-space:normal;line-height:1.25}'
   +S+' .ts-sign{margin-top:8px;padding-top:8px;gap:8px}'
   +S+' .ts-sg{padding:6px 9px;border-radius:9px}'
   +S+' .ts-sg i{height:18px;margin-bottom:4px}'
   +S+' .ts-sg b{font-size:10px}'+S+' .ts-sg span{font-size:8.5px}'
   +S+' .ts-sec:last-child{padding-bottom:2px}'
   +S+' .ts-rt{display:none}'
   /* §cotSlip · ปุ่ม "แนบสลิป" เป็นช่องอัปโหลด กดบนกระดาษไม่ได้ · ตัดออกตอนพิมพ์
      ป้ายเขียว "มีสลิปแล้ว" เก็บไว้ — คนกระทบยอดใช้ชี้ว่าหน้าสลิปท้ายเล่มมีของใบนี้ */
   +S+' .ts-slipb,'+S+' .ts-slipx{display:none!important}'
   // §tsPrint · ตอนสั่งพิมพ์ · ซ่อนเมนู + view อื่น แล้วปล่อยใบงานกินกระดาษเต็มใบ
   +S+' .ts-kpis{grid-template-columns:repeat(6,1fr)}'      // A4 นอน · 6 การ์ดพอดีแถวเดียว
   +S+' .ts-sign{break-inside:avoid;break-before:avoid}'    // ช่องเซ็นชื่อห้ามหลุดไปอยู่หน้าเปล่า
   +'body.ts-printing .sidebar,body.ts-printing .topbar{display:none!important}'
   +'body.ts-printing .app{display:block!important}'
   +'body.ts-printing .main{display:block!important;margin:0!important;padding:0!important;'
     +'width:100%!important;max-width:none!important;overflow:visible!important}'
   +'body.ts-printing .view:not(#view-travelsum){display:none!important}'
   +'body.ts-printing #view-travelsum,body.ts-printing '+S+'{display:block!important;'
     +'margin:0!important;padding:0!important;width:100%!important;max-width:none!important;'
     +'overflow:visible!important;background:#fff!important}'
   +'body.ts-printing{background:#fff!important;margin:0!important;padding:0!important}'
   +'@page{size:A4 landscape;margin:9mm}'
   +'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
}
// §tsRefPack · รายการที่จะพิมพ์เป็นชุดเอกสารต่อท้าย
//   ใช้ลำดับเดียวกับ manifest (เส้นทาง → Agency A-Z → Voucher) และตามเส้นทางที่เลือกอยู่
//   เอาเฉพาะใบที่มีเอกสารต้องตรวจ · ใบ walk-in ที่ไม่มีไฟล์ไม่ต้องเปลืองกระดาษ
function tsRefPackList(date){
  var rows=tsRows(date);
  if(_tsRoute) rows=rows.filter(function(r){ return (r.routeId||'')===_tsRoute; });
  // §tsRefVat · ต้องเดินตามชิปกรองภาษีเหมือนเนื้อใบสรุป · ไม่งั้นเอกสารของอีกชุดติดมาด้วย
  if(_tsVatF) rows=rows.filter(function(r){
    return _tsVatF==='vat' ? tsHasVat(r.b) : !tsHasVat(r.b);
  });
  // §tsSlipWith · ติด ord (ลำดับในตารางวันนั้น) มาด้วย · ชุดสลิปจะได้แทรกเข้าที่เดิมได้ตรงใบ
  var out=[];
  rows.forEach(function(r,i){
    var b=r.b;
    var keep=(((b.attachments||[]).length)>0)
      || ((typeof _docIsB2B==='function') ? _docIsB2B(b) : !!b.agentId);
    if(keep) out.push({ bk:b, trip:r.t, ord:i });
  });
  return out;
}
/* ══ §tsSlipPack (2026-09-05) · ชุดสลิปการชำระเงินท้ายใบสรุป ══════════════
   เงินที่รับหน้าท่ามีสามทาง · pierPayments (COT/ยอดค้าง) · SB_EXTRAS (ขายเพิ่ม) · upgrades
   ทั้งสามเก็บสลิปไว้ในตัวเอง (slips[]) คนละที่กับ bk.attachments · ชุดเอกสารเดิมจึงไม่เห็น
   บัตรเครดิตต้องมีสลิปคู่กับยอดถึงจะกระทบยอดกับ statement ของ EDC ได้ · ใบปิดวันเลยต้องพิมพ์ติดไปด้วย
   เดินตามชิปกรองเส้นทาง/VAT ชุดเดียวกับ tsRefPackList ไม่งั้นเอกสารของอีกชุดจะหลุดมา */
function tsSlipPackList(date){
  var rows=tsRows(date);
  if(_tsRoute) rows=rows.filter(function(r){ return (r.routeId||'')===_tsRoute; });
  if(_tsVatF) rows=rows.filter(function(r){
    return _tsVatF==='vat' ? tsHasVat(r.b) : !tsHasVat(r.b);
  });
  var LAB={cash:'เงินสด', transfer:'โอนเงิน', card:'บัตรเครดิต'};
  var num=function(n){ return (typeof pckNum==='function')?pckNum(n):String(+n||0); };
  var out=[];
  rows.forEach(function(r,_i){
    var b=r.b, imgs=[], miss=0, tot=0, who=[];
    var push=function(src, title, mth, amt, fee, byWho, note){
      var ss=Array.isArray(src)?src:[];
      tot+=(+amt||0);
      if(byWho && who.indexOf(byWho)<0) who.push(byWho);
      /* สดไม่ต้องมีสลิป · รูด/โอนแล้วไม่มี = ของขาด ต้องขึ้นกระดาษให้เห็น */
      if(!ss.length){ if((mth||'cash')!=='cash') miss++; return; }
      ss.forEach(function(f){
        imgs.push({ f:f, cap:(LAB[mth]||mth||'—')+' ฿'+num(amt)
          +((+fee||0)>0?(' · ค่าธรรมเนียม ฿'+num(fee)):'')
          +' · '+title+(byWho?(' · '+byWho):'')+(note?(' · '+note):'') });
      });
    };
    ((typeof pckPaysFor==='function')?pckPaysFor(b,date):[]).forEach(function(p){
      push(p.slips, 'เงินหน้าท่า', p.method, p.amount, p.fee, p.by, p.note);
    });
    var S=(typeof tsSaleList==='function')?tsSaleList(b,date):{list:[]};
    (S.list||[]).forEach(function(x){
      if(!x.done) return;   /* ยังไม่เก็บ = ยังไม่มีเงิน จึงยังไม่ต้องมีสลิป */
      push(x.slips, (x.kind==='up'?'อัปเกรด · ':'ขายเพิ่ม · ')+x.t, x.method, x.amt, x.fee, x.who, '');
    });
    /* §cotSlip · หลักฐานของเงิน COT · อยู่ที่คำตัดสิน (TS_COT) คนละที่กับสามทางข้างบน
       ไม่ push ผ่าน push() เพราะสองข้อ —
         ไม่บวกเข้า tot · ยอด COT นับอยู่ในเงินหน้าท่าแล้ว บวกซ้ำใบจะโชว์เกินจริง
         ไม่นับเป็น "ของขาด" · คำตัดสินอย่าง ไม่หัก / หักบิล / เก็บไม่ได้ ไม่มีสลิปให้แนบตั้งแต่ต้น
                                จะขึ้นเตือนว่าสลิปหายไม่ได้ */
    (function(){
      var c=(typeof tsCotGet==='function')?tsCotGet(b.id,date):null;
      var ss=(typeof tsCotSlips==='function')?tsCotSlips(c):[];
      if(!ss.length) return;
      var CM={full:'หักทั้งก้อน', part:'หักบางส่วน', none:'ไม่หัก', payout:'โอนออก', nocol:'เก็บไม่ได้'};
      var M=(typeof pckMoney==='function')?pckMoney(b,date):{cot:0};
      var cap='COT ฿'+num(M.cot||0)+' · '+(CM[c.mode]||c.mode||'')
        +((+c.deduct||0)>0?(' · หักบิล ฿'+num(c.deduct)):'')
        +((+c.payout||0)>0?(' · โอนออก ฿'+num(c.payout)):'')
        +(c.ref?(' · '+c.ref):'')+(c.by?(' · '+c.by):'');
      ss.forEach(function(f){ imgs.push({ f:f, cap:cap }); });
    })();
    if(!imgs.length && !miss) return;   /* สดล้วน / ไม่มีเงินเข้าวันนี้ = ไม่ต้องมีหน้า */
    out.push({ bk:b, trip:r.t, ord:_i, imgs:imgs, miss:miss, tot:tot, who:who.join(' · ') });
  });
  return out;
}
/* หน้ากระดาษใช้ class ชุดเดียวกับ _docPackPage จึงได้ CSS · ขนาดกระดาษ · และตัววาด PDF ฟรี */
function _tsSlipPage(r, i, total, seq, date, kicker){
  var e=_docPackEsc, b=r.bk, t=r.trip;
  var R=((typeof getRoute==='function'?getRoute(t.routeId):null)||{});
  var ag=((typeof sbGetAgent==='function'?sbGetAgent(b.agentId):null)||{});
  var num=function(n){ return (typeof pckNum==='function')?pckNum(n):String(+n||0); };
  var n=r.imgs.length;
  var grid=(n<=1)?'one':(n===2)?'two':(n<=4)?'four':'many';
  var body;
  if(!n){
    body='<div class="miss"><div class="mi">&#9888;</div><b>รูด/โอนแล้วแต่ยังไม่มีสลิป</b><span>'+r.miss+' รายการ</span></div>';
  } else {
    body='<div class="grid '+grid+'">'+r.imgs.map(function(x,k){
      var f=x.f||{}, url='/api/attach/'+encodeURIComponent(f.id);
      var isImg=/^image\//.test(f.mime||'');
      var isPdf=/pdf/i.test(f.mime||'') || /\.pdf$/i.test(f.name||'');
      var box=isImg?('<img src="'+url+'" alt="">')
             :isPdf?('<canvas class="pdfc" data-pdf="'+url+'"></canvas>'
                    +'<div class="pdfw">&#128196; '+e(f.name||'file')+' &middot; กำลังเปิดไฟล์ PDF…</div>')
                   :('<div class="nf"><div class="mi">&#128196;</div><span>'+e(f.name||'file')+'</span></div>');
      return '<figure><div class="sc">'+box+'</div><figcaption>'+(k+1)+'/'+n+' &middot; '+e(x.cap)+'</figcaption></figure>';
    }).join('')+'</div>';
    if(r.miss>0) body+='<div class="short">&#9888; ยังมีรายการรูด/โอนที่ไม่มีสลิปอีก '+r.miss+' รายการ</div>';
  }
  return '<section class="pg">'
    + '<header><span>LOVE Andaman &middot; '+e(kicker||'สลิปการชำระเงิน')+' &middot; '+e(date)+'</span><span>หน้า '+(i+1)+' / '+total+'</span></header>'
    + '<div class="trip">ทริป &middot; '+e(R.name||t.routeId)+(R.pier?(' &middot; '+e(_DOCPACK_PIER[R.pier]||R.pier)):'')+'</div>'
    + '<div class="bk"><div class="r1"><b>'+(seq?('#'+seq+' &middot; '):'')+e(b.leadPax||'—')+'</b><span>รับเงินรวม &#3647;'+num(r.tot)+'</span></div>'
    +   '<div class="r2">'+e(ag.name||b.agentId||'')+(b.voucherRef?(' &middot; '+e(b.voucherRef)):'')
    +   (r.who?(' &middot; รับโดย '+e(r.who)):'')+'</div></div>'
    + '<div class="body">'+body+'</div>'
    + '<footer><span>&#9744; ยอดตรงกับ statement</span><span>ผู้ตรวจ ________________</span></footer>'
    + '</section>';
}
/* ══ §tsSlipWith (2026-09-05) · สลิปไปอยู่ติดกับเอกสารของใบนั้น ไม่แยกเป็นปึกท้ายเล่ม ══
   เดิม §tsSlipPack ต่อชุดสลิปทั้งวันไว้หลังชุดเอกสารจบ · คนกระทบยอดต้องพลิกสองปึกไปมา
   เพื่อจับสลิปให้ตรงใบ · ตอนนี้หน้าสลิปของใบไหน วางต่อจากหน้าเอกสารของใบนั้นเลย
   ใบที่มีสลิปแต่ไม่มีในชุดเอกสาร (เช่น walk-in ไม่มีไฟล์แนบ) ยังพิมพ์อยู่ · ต่อท้ายตามลำดับเดิม
   เลข # เดินตามเส้นทางเหมือนเดิม · หน้าสลิปใช้เลขเดียวกับหน้าเอกสารของใบนั้น = เป็นคู่กัน */
function _tsPackPages(refList, slipList, date, kicker, slipKicker){
  var items=[];
  /* ทั้งสองลิสต์เป็นส่วนหนึ่งของแถวชุดเดียวกัน · เรียงด้วย ord แล้วเอกสารมาก่อนสลิปของใบเดียวกัน */
  (refList||[]).forEach(function(r,i){ items.push({ k:'doc',  r:r, ord:(r.ord==null?i:+r.ord), sub:0 }); });
  (slipList||[]).forEach(function(s,i){ items.push({ k:'slip', r:s, ord:(s.ord==null?i:+s.ord), sub:1 }); });
  items.sort(function(a,b){ return (a.ord-b.ord) || (a.sub-b.sub); });
  items.forEach(function(it,i){
    var p=i?items[i-1]:null;
    var id=String(((it.r||{}).bk||{}).id||'');
    it.pair=!!(p && it.k==='slip' && p.k==='doc' && id && String(((p.r||{}).bk||{}).id||'')===id);
  });
  var total=items.length, lastRoute=null, seq=0, html='';
  items.forEach(function(it,i){
    var R=((typeof getRoute==='function'?getRoute(it.r.trip.routeId):null)||{});
    if(!it.pair){                                  /* หน้าสลิปที่ต่อจากเอกสารใบเดียวกัน ไม่กินเลขใหม่ */
      if(R.id!==lastRoute){ lastRoute=R.id; seq=0; }
      seq++;
    }
    html += (it.k==='doc') ? _docPackPage(it.r, i, total, seq, date, kicker)
                           : _tsSlipPage(it.r, i, total, seq, date, slipKicker);
  });
  return html;
}
function tsPrintSheet(){
  var host=document.getElementById('travelsum-host'); if(!host) return;
  var date=_tsDate;
  var list=(typeof tsRefPackList==='function')?tsRefPackList(date):[];
  // §tsSlipWith · สลิปบัตร/โอนของเงินที่รับวันนี้ · แทรกอยู่หลังหน้าเอกสารของใบเดียวกัน
  var slipL=(typeof tsSlipPackList==='function')?tsSlipPackList(date):[];
  var _kick=(_tsVatF ? (_tsVatF==='vat' ? ' · เฉพาะมี VAT' : ' · เฉพาะไม่มี VAT') : '')
          + (_tsRoute ? (' · '+tsRouteName(_tsRoute)) : '');
  var pack=((list.length||slipL.length) && typeof _tsPackPages==='function')
    ? _tsPackPages(list, slipL, date, 'Reference · เอกสารประกอบ'+_kick,
                   'Payment slip · สลิปการชำระเงิน'+_kick) : '';
  var w=window.open('','_blank');
  if(!w){ alert('เบราว์เซอร์บล็อกป๊อปอัป · อนุญาต pop-up แล้วลองใหม่'); return; }
  // ฟอนต์ · ยกทุก <link rel=stylesheet> ที่ชี้ไปโรงฟอนต์จากหน้าหลักไปด้วย
  //   (มี preconnect/preload ปนอยู่ด้วย เอามาทั้งชุดง่ายกว่าและไม่เสียหาย)
  var fontLinks='';
  try{
    [].slice.call(document.querySelectorAll('link[rel="stylesheet"],link[rel="preconnect"]')).forEach(function(L){
      var h=L.getAttribute('href')||'';
      if(/fonts\.(googleapis|gstatic)\.com/.test(h)) fontLinks+=L.outerHTML;
    });
  }catch(_){}
  // สองขนาดกระดาษในไฟล์เดียว · ใบสรุปเป็น A4 นอน · ชุดเอกสารเป็น A4 ตั้ง
  //   @page ต้องอยู่ "ท้ายสุด" ของเอกสาร เพราะ CSS ของ Travel Summary มี @page ของตัวเอง
  //   ฝังมากับ host.innerHTML ถ้าประกาศไว้ก่อน อันหลังจะทับ ชุดเอกสารจะออกมาเป็นแนวนอนหมด
  var pageCSS='@page ts{size:A4 landscape;margin:9mm}@page doc{size:A4 portrait;margin:9mm}';
  var css='html,body{margin:0;padding:0;background:#fff}'
    +'body{font-family:\'DM Sans\',sans-serif;font-size:13px;line-height:1.5;color:#1c1917}'
    +'#travelsum-host{font-family:inherit}'
    +'#travelsum-host{page:ts;display:block}'
    +'.la-docpack{page:doc}'
    +'.la-docpack .pg{page:doc;break-before:page}'
    +'.la-docpack{font-family:"DM Sans",-apple-system,system-ui,sans-serif}'
    +(typeof _docPackCSS==='function'?_docPackCSS('.la-docpack'):'')
    +'@media screen{body{background:#e9e7e1;padding:10px}}';
  var boot=(typeof _docPackBoot==='function')?_docPackBoot():'';
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Travel Summary '+ckEsc(date)+'</title>'
    +fontLinks+'<style>'+css+'</style></head><body class="ts-printing">'
    +'<div id="travelsum-host">'+host.innerHTML+'</div>'
    +(pack?('<div class="la-docpack">'+pack+'</div>'):'')
    +'<style>'+pageCSS+'</style>'
    +boot+'</body></html>');
  w.document.close();
  if(typeof _docPackDrive==='function') _docPackDrive(w);   // §drive
}
function tsPickRoute(id){ _tsRoute=(id===_tsRoute)?'':(id||''); tsAfter(); }
function tsRouteName(id){ var r=(typeof getRoute==='function'?getRoute(id):null)||{}; return r.name||id||'—'; }
// โหมด VAT ของใบนี้ · ตามที่ตั้งไว้ให้ agent · ไม่มี agent (walk-in) = ไม่คิด VAT
function tsVatMode(b){
  if(!b || !b.agentId) return 'none';
  var a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
  var m=(a && a.vatMode) || '';
  return (m==='include' || m==='exclude') ? m : 'none';
}
function tsHasVat(b){ return tsVatMode(b)!=='none'; }
// agent ที่ยังไม่ได้ตั้งโหมด VAT · ตกไปกอง "ไม่มี VAT" โดยปริยาย ต้องเตือนไม่งั้นยอดเพี้ยนเงียบ ๆ
function tsVatGap(rows){
  var g={};
  (rows||[]).forEach(function(r){
    var b=r.b; if(!b || !b.agentId) return;
    var a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    if(a && !a.vatMode) g[b.agentId]=(a.name||a.code||b.agentId);
  });
  return Object.keys(g).map(function(k){ return g[k]; });
}
function tsPickVat(v){ _tsVatF=(v===_tsVatF)?'':(v||''); tsAfter(); }
// §tsFactSheet · ชื่อวันสั้น ๆ กับเวลาที่ออกเอกสาร
function _tsDow(d){ try{ return new Date(d+'T12:00:00').toLocaleDateString('th-TH',{weekday:'short'}); }catch(_){ return ''; } }
function _tsStamp(){ try{ var n=new Date();
  return n.toLocaleDateString('en-GB')+' '+n.toTimeString().slice(0,5); }catch(_){ return ''; } }
// ยอด Net ของ trip หนึ่ง · อ่าน seatRates / charterRates ของ Rate Type ที่ผูกกับ agent
//   คืน {tot, txt} · txt คือที่มาของตัวเลขในรูป "จำนวน × เรตต่อคน" ต่อกันด้วย +
//   คืน null เมื่อหาเรตไม่เจอ (walk-in ตั้งราคาเอง ฯลฯ) → หน้าจอจะขึ้นขีดแทนตัวเลขมั่ว
function _tsNum(v){ return Math.round(+v||0).toLocaleString('en-US'); }
function tsNetOf(r){
  if(!r || !r.b || !r.t) return null;
  var b=r.b, t=r.t;
  if(t.ovnLeg) return null;                      // ขากลับค้างคืน · ไม่คิดเงินซ้ำ
  var rtId=b.rateTypeRef || (b.agentId && typeof sbGetAgent==='function' ? ((sbGetAgent(b.agentId)||{}).rateTypeId) : null);
  if(!rtId || typeof SB_RATE_TYPES==='undefined') return null;
  var rt=null; for(var i=0;i<SB_RATE_TYPES.length;i++) if(SB_RATE_TYPES[i].id===rtId){ rt=SB_RATE_TYPES[i]; break; }
  if(!rt) return null;
  /* §b2bPromo · เลขในวงเล็บของหน้านี้คือ "ตามเรทแล้วควรเป็นเท่าไหร่" ไว้ทานกับยอดจริงในใบจอง
     ⚠ ต้องยึดใบโปร "ที่ล็อกไว้ตอนขาย" ไม่ใช่ใบที่แอคทีฟวันนี้
       ไม่งั้นพอมีคนไปแก้โปรทีหลัง เลขทานของใบเก่าจะขยับตาม แล้วขึ้นเหมือนคีย์ราคาผิด
       ทั้งที่ตอนขายถูกต้องทุกบาท (ก้อน 4 · ข้อ 4 ในเอกสาร) */
  var _pSold=null;
  try{ _pSold=laPromoRateSold(b, t, rt); if(_pSold && _pSold.rt) rt=_pSold.rt; }catch(_){}
  var p=t.pax||{};
  if(t.bookingMode==='charter'){
    var boat=(typeof BOATS!=='undefined')?BOATS.filter(function(x){ return x.id===t.charterBoatId; })[0]:null;
    var ty=String((boat&&boat.type)||'').toLowerCase();
    var cr=rt.charterRates && rt.charterRates[t.routeId] && rt.charterRates[t.routeId][ty];
    if(!cr) return null;
    var all=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(p):0;
    var ex=Math.max(0, all-(+cr.starterIncludes||0));
    var ct=Math.round((+cr.starterPrice||0) + ex*(+cr.extraPerPax||0));
    return { tot:ct, promo:(_pSold?laPromoLabel(_pSold.promo):''), promoSold:!!(_pSold&&_pSold.sold),
             txt:'เหมาลำ '+_tsNum(cr.starterPrice)+(ex?(' + '+ex+'\u00d7'+_tsNum(cr.extraPerPax)):''),
             zone:'charter', rt:(rt.name||rt.code||'') };
  }
  var RR=rt.seatRates && rt.seatRates[t.routeId];
  if(!RR) return null;
  // โซนราคา · ใบเก่า/ใบที่ sync มาบางใบไม่มี t.zone → เดาจากท่าเรือของเส้นทางและการมีจุดรับ
  var zone=t.zone || b.zone || '';
  if(!zone || !RR[zone]){
    var pier=(((typeof getRoute==='function'?getRoute(t.routeId):null)||{}).pier)||'';
    /* §rnZone · เส้นระนองต้องลองเรต RN ก่อน · ถ้าสัญญายังไม่มีคอลัมน์ RN
       ก็ตกไปหาโซนอื่นเหมือนเดิม (ไม่พัง แต่ยังไม่ใช่เรตระนองจริง) */
    var order=(b.hotelName||b.pickup)
      ? (pier==='ranong'?['RN','PK','KL','NoTransfer']
        :pier==='tublamu'?['KL','PK','RN','NoTransfer']:['PK','KL','RN','NoTransfer'])
      : ['NoTransfer','RN','PK','KL'];
    zone=''; for(var z=0;z<order.length;z++) if(RR[order[z]]){ zone=order[z]; break; }
    if(!zone) zone=Object.keys(RR).filter(function(k){ return RR[k]; })[0]||'';
  }
  var sr=zone?RR[zone]:null;
  if(!sr) return null;
  var legAd=+p.ad||0, legChd=+p.chd||0;
  // §tsNetRate · เก็บทีละก้อน (จำนวน × เรตต่อคน) เพื่อโชว์ที่มาของตัวเลข ไม่ใช่ยอดลอย ๆ
  var LN=[['adult-fr',(+p.ad_fr||legAd)],['adult-thai',(+p.ad_th||0)],
          ['child-fr',(+p.chd_fr||legChd)],['child-thai',(+p.chd_th||0)]];
  var n=0, parts=[];
  LN.forEach(function(x){
    var q=+x[1]||0, rate=+sr[x[0]]||0;
    if(q<=0 || rate<=0) return;
    n += q*rate; parts.push(q+'\u00d7'+_tsNum(rate));
  });
  if(!parts.length) return null;
  /* §agFair · โซนกับชื่อสัญญาที่ใช้ตั้งราคาใบนี้ · หน้าวิเคราะห์ต้องบอกได้ว่ากำลังเทียบกับอะไร */
  return { tot:Math.round(n), txt:parts.join(' + '), zone:zone, rt:(rt.name||rt.code||''),
           /* §b2bPromo · ขายด้วยโปรใบไหน · sold=true คือใบที่ล็อกไว้ตอนขาย ไม่ใช่เดาจากวันนี้ */
           promo:(_pSold?laPromoLabel(_pSold.promo):''), promoSold:!!(_pSold&&_pSold.sold) };
}
function tsRouteColor(id){ var r=(typeof getRoute==='function'?getRoute(id):null)||{}; return r.color||'#8b909c'; }
// §tsDocRef · อ้างอิงเอกสารจากหน้าตรวจเอกสาร · ป้ายเดียวกับที่หน้า By-trip ใช้
//   ไม่คิดสถานะเอง — เรียก docCheckStatus ตัวเดียวกับหน้าตรวจเอกสาร เลขสองที่จะได้ตรงกันเสมอ
function tsDocRef(b){
  var st=(typeof docCheckStatus==='function')?docCheckStatus(b):'nofiles';
  var att=((b&&b.attachments)||[]), n=att.length;
  var dc=(b&&b.docCheck)||{};
  var M={ verified:['ตรวจแล้ว','g'], issue:['เอกสารมีปัญหา','r'], pending:['รอตรวจ','a'], nofiles:['ยังไม่แนบ','n'] };
  var m=M[st]||M.nofiles;
  // เช็คลิสต์ 6 ช่องเดียวกับหน้าตรวจเอกสาร · นับเฉพาะที่ติ๊กแล้ว
  var K=(typeof DOCCHK_ITEMS!=='undefined'&&DOCCHK_ITEMS)?DOCCHK_ITEMS:[];
  var it=dc.items||{}, done=0;
  K.forEach(function(x){ if(it[x.k]) done++; });
  // เลขอ้างอิงที่ "อ่านได้จากตัวเอกสาร" · Pre-Check (OCR) เก็บข้อความที่เจอไว้ที่ ev
  var pr=((dc.pre||{}).results||{}).voucher||null;
  var docRef=(pr&&pr.ev)?String(pr.ev).replace(/\s+/g,' ').trim().slice(0,26):'';
  var missing=K.filter(function(x){ return !it[x.k]; }).map(function(x){ return x.label; });
  var fname=n?String(att[0].name||'ไฟล์แนบ'):'';
  var when=''; if(dc.at){ try{ when=new Date(dc.at).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit'}); }catch(_){ when=String(dc.at).slice(0,10); } }
  return { st:st, n:n, label:m[0], cls:m[1], by:dc.by||'', at:dc.at||'', when:when, note:dc.note||'',
           done:done, tot:K.length, missing:missing, docRef:docRef, fname:fname,
           files:att.map(function(a){ return a.name||'ไฟล์แนบ'; }) };
}
function tsDocChip(b, date){
  var d=tsDocRef(b), e=ckEsc;
  var tip=d.label+(d.n?(' · '+d.n+' ไฟล์'):'')+(d.by?(' · '+d.by):'')+(d.note?(' · '+d.note):'');
  return '<span class="ts-chip '+d.cls+' ts-doc" title="'+e(tip)+' · คลิกไปหน้าตรวจเอกสาร"'
    + ' onclick="tsGoDoc(\''+b.id+'\',\''+date+'\')">'+e(d.label)+(d.n?(' '+d.n):'')+'</span>';
}
function tsGoDoc(bkId, date){
  // _docCheck ประกาศด้วย const → อยู่ใน global lexical scope ไม่ได้แปะบน window
  //   (โค้ดเดิมที่หน้า By-trip เช็ค window._docCheck จึงไม่เคยเซ็ตค่าให้เลย · แก้พร้อมกันที่นี่)
  try{ if(typeof _docCheck!=='undefined' && _docCheck){ _docCheck.date=date; _docCheck.openId=bkId; } }catch(_){}
  try{ nav(document.querySelector('[data-view=doccheck]')); }catch(_){}
}
// เงินหน้างานของ booking หนึ่งใบในวันนั้น · แยกตามวิธีรับเงินจาก bk.pierPayments เดิม
// เวลาออกเรือ · อยู่ที่ระดับเส้นทาง (route.times) เรือหลายลำในทริปเดียวกันออกพร้อมกัน
function tsDepTime(routeId){
  var R=(typeof getRoute==='function'?getRoute(routeId):null)||{};
  var t=R.times; if(Array.isArray(t)&&t.length) return t.join(' / ');
  return '';
}
// จุดส่งกลับ · อ่านจาก bkV2RetInfo ตัวเดียวกับใบงานรถและใบงานไกด์
function tsSendBack(b, date){
  var ri=(typeof bkV2RetInfo==='function')?bkV2RetInfo(b,date):null;
  if(!ri) return null;
  if(ri.selfRet) return { t:String(ri.drop||'').replace(/\s*\(self-?arrive\)/i,'').trim()||'—', tag:'กลับเอง', cls:'n' };
  if(!ri.sep) return null;                                   // ส่งจุดเดิมกับตอนรับ
  if(ri.arranged){ var vn=ri.retId?(((typeof vehGet==='function'?vehGet(ri.retId):null)||{}).name||ri.retId):'';
    return { t:ri.drop||'—', tag:'↩ '+vn, cls:'g' }; }
  if(ri.sameVan) return { t:ri.drop||'—', tag:'↩ กลับคันเดิม', cls:'e' };
  return { t:ri.drop||'—', tag:'⚠ ยังไม่จัดรถกลับ', cls:'r' };
}
// แยกจำนวนตามประเภท · เดินทางจริง / ที่จอง
function tsPaxSplit(r, date){
  var pb=(typeof ckPaxBreak==='function')?ckPaxBreak(r.t.pax):{ad:0,chd:0,inf:0,foc:0};
  var out={};
  ['ad','chd','inf','foc'].forEach(function(k){
    var bk=pb[k]||0;
    var left=(typeof ckPaxLeft==='function')?ckPaxLeft(r.b,date,k,bk):bk;
    out[k]={ b:bk, l:left };
  });
  return out;
}
// ยกเลิก / no-show หน้างาน + ผลตัดสินว่าเก็บเงินหรือไม่ · การเงินต้องเห็นในใบเดียวกัน
function tsCxlCell(r, date, DEC, money){
  var b=r.b, e=ckEsc, L=[];
  var cc=b.cancellation||null;
  if(b.status==='cancelled'||b.status==='cancelled_weather'){
    var lbl=cc?((cc.chargeType==='full')?('เก็บเต็ม '+money(cc.chargeAmount||0))
             :(cc.chargeType==='partial')?('เก็บบางส่วน '+money(cc.chargeAmount||0)):'ไม่ชาร์จ')
           :(b.status==='cancelled_weather'?'ยกเลิกเพราะอากาศ':'ยกเลิก');
    L.push('<span class="ts-chip r">ยกเลิกทั้งใบ</span><span class="ts-cxc">'+e(lbl)+'</span>');
    if(cc&&cc.reason) L.push('<span class="ts-cxr" title="'+e(cc.reason)+'">'+e(cc.reason)+'</span>');
    return '<div class="ts-dcell">'+L.join('')+'</div>';
  }
  var Lt=(typeof ckLostByType==='function')?ckLostByType(b,date):null;
  if(!Lt||!Lt.total) return '<span style="color:var(--zn400)">—</span>';
  var w=[];
  if(Lt.ns) w.push('No-show '+Lt.ns);
  if(Lt.cxl) w.push('CXL หน้างาน '+Lt.cxl);
  L.push('<span class="ts-chip r">'+e(w.join(' · ')||('หายไป '+Lt.total))+' คน</span>');
  var d=r.dec;
  if(d && DEC[d.decision]) L.push('<span class="ts-chip '+DEC[d.decision][1]+'">'+DEC[d.decision][0]
      +((d.decision==='postpone')?'':(' · '+money(d.amount)))+'</span>');
  else L.push('<span class="ts-cxr">รอตัดสินค่าปรับ</span>');
  if(d&&d.note) L.push('<span class="ts-cxr" title="'+e(d.note)+'">'+e(d.note)+'</span>');
  return '<div class="ts-dcell">'+L.join('')+'</div>';
}
function tsCxlRows(date){
  var out=[];
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','cancelled_weather'].indexOf(b.status)<0) return;
    var t=((b.trips||[]).filter(function(x){ return (x.date||'')===date; }))[0];
    if(!t) return;
    // §ovnBack · ยกเลิกแล้วก็ยังต้องขึ้น · หน้าท่าจะได้รู้ว่า "ไม่ต้องไปรับกลับแล้ว"
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    out.push({ b:b, t:t, O:O, routeId:t.routeId||'', cxlRow:true,
               ovnBack:(typeof bkIsOvnReturn==='function') && bkIsOvnReturn(t),
               ovnOut:((typeof bkIsOvnReturn==='function' && bkIsOvnReturn(t) && typeof _ovnOutDate==='function')?_ovnOutDate(b,t):''),
               booked:(typeof ckBookedPax==='function')?ckBookedPax(t):0, travelled:0,
               ns:0, cxl:0, events:[], van:'', vanCk:null, vanDone:false, vanActual:null,
               boat:'', pierCk:null, pierDone:false, pierActual:null, pierExp:null,
               issue:false, amount:(typeof tsTripAmount==='function')?tsTripAmount(b,t):0,
               policy:'', dec:null });
  });
  return out;
}
/* §tsManMv (2026-09-04) · ใบที่เลื่อนวันออกไปแล้ว ต้องคาอยู่ใน Manifest ประจำวันด้วย
   ไม่ใช่โผล่แค่ตารางตัดสิน · Manifest คือรายชื่อของ "วันนั้น" ที่ต้องอ่านย้อนหลังได้ว่า
   เดิมใบนี้อยู่ในลิสต์ ขึ้นรถคันไหน ลำไหน แล้วถูกย้ายออกไปวันไหน
   ยืมโครง cxlRow ที่มีอยู่แล้ว (จอง N → ไปจริง 0 · ไม่เข้ายอดเดินทางจริงของวัน)
   ต่างกันแค่ป้ายและสีเท่านั้น                                                 */
function tsMvRows(date){
  var out=[];
  var MV=(typeof ckStrandMovedRows==='function')?ckStrandMovedRows(date):[];
  MV.forEach(function(r){
    out.push({ b:r.b, t:r.t, O:r.O, routeId:(r.t&&r.t.routeId)||'',
      cxlRow:true, mvRow:true, mvWhy:r.strandWhy||'', mvTo:r.mvTo||'',
      ovnBack:false, ovnOut:'',
      booked:(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot((r.t&&r.t.pax)||{}):0, travelled:0,
      ns:0, cxl:0, events:[],
      van:(r.O&&r.O.vanId)||'', vanCk:null, vanDone:false, vanActual:null,
      boat:(r.O&&r.O.boatId)||'', pierCk:null, pierDone:false, pierActual:null, pierExp:null,
      issue:false, amount:0, policy:'',
      dec:(typeof tsGet==='function')?tsGet(r.b.id,date):null });
  });
  return out;
}
function tsAddonList(r, date){
  var b=r.b, rid=(r.t&&r.t.routeId)||'', out=[];
  // 1) จองมาแต่แรก · รวม bundle ที่มาจาก Rate Type ด้วย (ckAddonList จัดการให้แล้ว)
  try{ (ckAddonList(b, rid)||[]).forEach(function(a){
    out.push({ src:'bk', kind:a.kind, t:a.label, note:a.note||'' });
  }); }catch(_){}
  // 2) ขายเพิ่มหน้างาน · SB_EXTRAS · จำกัดเฉพาะรายการของทริปวันนี้ถ้ามีการระบุวัน
  try{ ((typeof bkV2ExtrasFor==='function')?bkV2ExtrasFor(b.id):[]).forEach(function(x){
    if(date && x.tripDate && x.tripDate!==date) return;
    var PM={cash:'เงินสด', transfer:'โอนเงิน', card:'บัตรเครดิต', cot:'เก็บวันเดินทาง'};
    var _g=(typeof bkxExGot==='function')?bkxExGot(x):true;
    out.push({ src:'ex', t:String(x.service||'ขายเพิ่ม'), qty:(+x.qty||1), amt:(+x.total||0), done:_g,
      note:(PM[x.method||'cash']||'เงินสด')+(_g?'':' · ยังไม่เก็บ')+(x.seller?(' · '+x.seller):'')
           +((_g&&x.method&&x.method!=='cash'&&!((x.slips||[]).length))?' · ยังไม่มีสลิป':'') });
  }); }catch(_){}
  // 3) อัปเกรดหน้างาน
  try{ (Array.isArray(b.upgrades)?b.upgrades:[]).forEach(function(u){
    out.push({ src:'up', t:String(u.label||'upgrade'), amt:(+u.sellPrice||0),
      done:!!u.collected, note:(u.collected?'เก็บเงินแล้ว':'ยังไม่เก็บ') });
  }); }catch(_){}
  // 4) อาหารพิเศษ · ถ้ามี pierAt แปลว่าสั่งเพิ่มหน้าท่า ไม่ได้มากับใบจอง
  try{
    var mm=b.specialMeals||{}, ml=[];
    if(+mm.veg)   ml.push('มังสวิรัติ '+(+mm.veg));
    if(+mm.vegan) ml.push('วีแกน '+(+mm.vegan));
    if(+mm.halal) ml.push('ฮาลาล '+(+mm.halal));
    var al=String(mm.allergies||'').trim(); if(al) ml.push('แพ้: '+al);
    if(ml.length) out.push({ src:(mm.pierAt?'pier':'bk'), meal:true, t:ml.join(' · '),
      note:(mm.pierAt?('สั่งหน้าท่า'+(mm.pierBy?(' · '+mm.pierBy):'')):'มากับใบจอง') });
  }catch(_){}
  return out;
}
function tsAddonCell(r, date){
  var L=tsAddonList(r, date), e=ckEsc;
  if(!L.length) return '<span style="color:var(--zn400)">—</span>';
  var m=function(n){ return '฿'+pckNum(n); };   // §pierDecimal · ของที่ขายหน้างานมีสตางค์ได้
  var SRC={ bk:['ao-bk','จองมาแต่แรก'], ex:['ao-ex','ขายเพิ่มหน้างาน'], up:['ao-up','อัปเกรดหน้างาน'], pier:['ao-pier','สั่งหน้าท่า'] };
  return '<div class="ts-aos">'+L.map(function(a){
    var sc=SRC[a.src]||SRC.bk;
    var txt=e(a.t)+((a.qty&&a.qty>1)?(' ×'+a.qty):'')+((a.amt)?(' <b>+'+m(a.amt)+'</b>'):'');
    var tip=sc[1]+(a.note?(' · '+a.note):'');
    return '<span class="ts-ao '+sc[0]+(a.done===false?' due':'')+'" title="'+e(tip)+'">'+txt+'</span>';
  }).join('')+'</div>';
}
// §tsCxlNoCount · กติกาเดียว ใช้ทั้งส่วนเงินหน้างานและ manifest · จะได้ไม่มีวันบอกคนละอย่าง
//   ไม่มีใครได้เดินทางเลย + ยังไม่ได้รับเงินสักบาท = เก็บไม่ได้แล้ว
function tsNoCollect(r, paid){
  if(!r) return false;
  if(+paid>0) return false;                          // §paid · เก็บไปแล้วค่อยยกเลิก = เรื่องคืนเงิน ไม่ใช่ไม่นับ
  return (r.travelled<=0) && ((+r.cxl>0)||(+r.ns>0)||(+r.noShow>0));
}
/* ══ §tsPaySlip · ชิปวิธีรับเงินในตารางหลัก กดเปิดดูสลิปได้ ══════════════════
   ชิปตัวนี้เป็น "ยอดรวมต่อวิธีรับเงิน" ไม่ใช่เงินก้อนเดียว · ยอดหนึ่งชิปมาจาก
   สองที่เก็บคนละแห่ง คือ pierPayments กับของที่ขายเพิ่ม (SB_EXTRAS + upgrades)
   เดิมจึงมีแต่ตัวเลข ไม่มี slips[] ให้กด · ตัวนี้ไล่เก็บสลิปของทั้งสองที่
   ที่ใช้วิธีรับเงินเดียวกัน มารวมเป็นชุดเดียว laSlipView เลื่อนดูทีละใบได้อยู่แล้ว
   รายการที่ยังไม่เก็บเงิน (COT · รอเก็บ) ข้ามไป ยังไม่มีเงินก็ยังไม่มีสลิป */
function tsSlipsForMethod(booking, date, method, saleList){
  var slips=[];
  ((typeof pckPaysFor==='function')?pckPaysFor(booking,date):[]).forEach(function(payment){
    if((payment.method||'cash')!==method) return;
    slips=slips.concat(Array.isArray(payment.slips)?payment.slips:[]);
  });
  ((saleList&&saleList.list)||[]).forEach(function(saleLine){
    if(!saleLine.done) return;
    if((saleLine.method||'cash')!==method) return;
    slips=slips.concat(Array.isArray(saleLine.slips)?saleLine.slips:[]);
  });
  return slips;
}
function tsProformaPaidDate(b){
  try{
    var iv=tsInvSettle(b).inv;
    if(!iv || typeof SB_PAYMENTS==='undefined') return '';
    var pays=SB_PAYMENTS.filter(function(p){ return p.invoiceId===iv.id && p.type==='payment' && (+p.amount||0)>0 && p.date; });
    if(!pays.length) return '';
    pays.sort(function(a,z){ return String(a.date).localeCompare(String(z.date)); });
    var d=String(pays[pays.length-1].date).slice(0,10).split('-');
    return d.length===3 ? d[2]+'/'+d[1]+'/'+d[0] : '';
  }catch(_){ return ''; }
}
function tsPayCell(r, date){
  var b=r.b, e=ckEsc, L=[];
  var m=function(n){ return '฿'+pckNum(n); };   // §pierDecimal · ยอดหน้าท่ามีสตางค์ได้ ต้องโชว์ให้ตรงกับกล่องเก็บเงิน
  var X=tsMoneyOf(b, date), M=X.M;
  // เงื่อนไขการชำระของใบนี้ · Invoice = เครดิต ไม่ต้องเก็บหน้างาน
  var PT={ invoice:['Invoice','n'], credit:['Invoice','n'], proforma:['Proforma','e'], prepaid:['Proforma','e'],
           cot:['COT','a'], bt:['โอนล่วงหน้า','e'] };
  var pt=PT[M.payType||'']||null;
  if(pt){
    var _pfDate=(M.payType==='proforma'||M.payType==='prepaid')?tsProformaPaidDate(b):'';
    L.push('<span class="ts-chip '+pt[1]+'" title="'+e('เงื่อนไขการชำระของ agent'+(_pfDate?' · ชำระวันที่ '+_pfDate:''))+'">'
      +pt[0]+(_pfDate?(' · '+e(_pfDate)):'')+'</span>');
  }
  else if(!b.agentId) L.push('<span class="ts-chip n">Walk-in</span>');
  // §tsInvPaid · เงินที่รับผ่านใบแจ้งหนี้ (หน้า By-trip-date / หน้าบัญชี) · คนละก้อนกับเงินหน้าท่า
  var IV=X.inv||{};
  if(IV.inv){
    if(IV.settled)
      L.push('<span class="ts-chip g" title="'+e('รับเงินครบแล้วตามใบแจ้งหนี้ '+IV.no+' '+m(IV.paid)
        +(IV.nBk>1?(' · ใบนี้คุม '+IV.nBk+' booking'):''))+'">&#10003; จ่ายผ่านบิลแล้ว</span>');
    else if(IV.paid>0)
      L.push('<span class="ts-chip b" title="'+e('ใบแจ้งหนี้ '+IV.no+' รับแล้ว '+m(IV.paid)+' · ค้าง '+m(IV.bal)
        +(IV.nBk>1?(' · ใบนี้คุม '+IV.nBk+' booking ปันส่วนรายใบไม่ได้'):''))+'">บิลชำระบางส่วน</span>');
  }
  if(r.cxlRow){
    var cc=b.cancellation||null;
    L.push('<span class="ts-pyd">'+((cc&&+cc.chargeAmount>0)?('ค่าปรับ '+m(cc.chargeAmount)):'ไม่มียอดเก็บ')+'</span>');
    return '<div class="ts-payc">'+L.join('')+'</div>';
  }
  // §tsCxlNoCount · เก็บไม่ได้แล้ว · manifest ต้องไม่บอกว่ายังต้องเก็บ และไม่ต้องเตือนเรื่องหักบิล
  if(tsNoCollect(r, X.paid)){
    if(X.due>0) L.push('<span class="ts-pyd" style="opacity:.55;text-decoration:line-through">ต้องเก็บ '+m(X.due)+'</span>');
    L.push('<span class="ts-pyn">'+((+r.cxl>0)?'ยกเลิกหน้างาน':'ไม่มา')+' &middot; ไม่นับเข้ายอดวันนี้</span>');
    return '<div class="ts-payc">'+L.join('')+'</div>';
  }
  // ยอดที่ต้องเก็บวันนี้ · แยกให้เห็นว่ามาจากอะไร (COT / ค้าง / upgrade)
  if(X.due>0){
    var parts=[];
    if(M.cot>0)     parts.push('COT '+m(M.cot));
    if(M.balance>0) parts.push('ค้าง '+m(M.balance));
    if(M.upDue>0)   parts.push('upgrade '+m(M.upDue));
    if(X.billed>0)  parts.push('จ่ายผ่านบิล '+m(X.billed));
    if(M.pierPaid>0)parts.push('เก็บแล้ว '+m(M.pierPaid));
    L.push('<span class="ts-pyd" title="'+e(parts.join(' · '))+'">ต้องเก็บ '+m(X.due)+'</span>');
    if(parts.length) L.push('<span class="ts-pyn">'+e(parts.join(' · '))+'</span>');
  } else if(M.pierPaid>0){
    L.push('<span class="ts-pyg">&#10003; เก็บครบ '+m(M.pierPaid)+'</span>');
  } else if(M.payType==='cot' && !(X.inv&&X.inv.settled)){
    L.push('<span class="ts-pyn">COT · ยังไม่ระบุยอด</span>');
  }
  // §tsPayDetail · COT ตกลงกันไว้ยังไง · ก้อนนี้หักจากบิล agent หรือเก็บแยก
  if(M.cot>0){
    // §tsCotOnManifest · ถ้าตัดสินไว้แล้วในส่วนที่ 3 ให้เขียนผลที่ตัดสิน ไม่ใช่ค่าที่ตั้งไว้ตอนเปิด booking
    var _cd=(typeof tsCotGet==='function')?tsCotGet(b.id,date):null;
    var _lb, _cls, _tip;
    if(_cd){
      var _dd=+_cd.deduct||0, _pp=+_cd.payout||0, _kk=(+M.cot||0)-_dd-_pp, _PP=[];
      if(_dd>0) _PP.push('หักบิล '+m(_dd));
      if(_pp>0) _PP.push('โอนออก '+m(_pp));
      if(_kk>0) _PP.push('บริษัทรับไว้ '+m(_kk));
      _lb=_PP.join(' &middot; ')||'ไม่หักบิล';
      _cls=(_pp>0)?'p':(_dd>0?'b':'e');
      _tip='ตัดสินไว้ในส่วนเงินหน้างาน'+(_cd.by?(' โดย '+_cd.by):'')+(_cd.ref?(' · '+_cd.ref):'');
    } else {
      _lb='ตั้งไว้ '+(M.handling==='separate'?'แยกจากบิล':'หักจากบิล');
      _cls=(M.handling==='separate')?'a':'n';
      _tip='ค่าที่ตั้งไว้ตอนเปิด booking · ยังไม่ได้ตัดสินว่าจะหักบิลจริงเท่าไหร่';
    }
    L.push('<span class="ts-chip '+_cls+'" title="'+e(_tip)+'">COT '+m(M.cot)+' &middot; '+_lb+'</span>');
    if(!_cd) L.push('<span class="ts-pyw">&#9888; ยังไม่ตัดสินการหักบิล</span>');
    if(M.note) L.push('<span class="ts-pyn2" title="'+e(M.note)+'">&#128221; '+e(M.note)+'</span>');
  }
  // §tsPayDetail · เก็บด้วยวิธีไหน · รวมเงินหน้าท่า (pierPayments) กับเงินของที่ขายเพิ่มหน้างาน
  //   สองก้อนนี้เก็บคนละที่ · ช่องนี้เคยเห็นแค่ก้อนแรก คนอ่านเลยนึกว่ายังไม่ได้เก็บ
  var PMB={ cash:['เงินสด','e'], transfer:['โอนเงิน','b'], card:['บัตรเครดิต','p'] };
  var S=(typeof tsSaleList==='function')?tsSaleList(b,date):{by:{},noSlip:0,fee:0};
  var byAll={};
  Object.keys(X.by||{}).forEach(function(k){ if(X.by[k]>0) byAll[k]=(byAll[k]||0)+X.by[k]; });
  Object.keys(S.by||{}).forEach(function(k){ if(S.by[k]>0) byAll[k]=(byAll[k]||0)+S.by[k]; });
  var who=[]; if(X.who) who.push(X.who);
  (S.list||[]).forEach(function(x){ if(x.who && who.indexOf(x.who)<0) who.push(x.who); });
  var mk=Object.keys(byAll).filter(function(k){ return byAll[k]>0; });
  if(mk.length){
    L.push('<span class="ts-pyms">'+mk.map(function(k){
      var d=PMB[k]||[k,'n'];
      var label=d[0]+' '+m(byAll[k]);
      /* §tsPaySlip · มีสลิปแล้วค่อยกดได้ · สดกับตัวที่ยังไม่แนบ คงเป็นตัวหนังสือเฉย ๆ */
      var slips=(typeof tsSlipsForMethod==='function')?tsSlipsForMethod(b,date,k,S):[];
      if(!slips.length) return '<span class="ts-chip '+d[1]+' ts-pyx">'+label+'</span>';
      return '<span class="ts-chip '+d[1]+' ts-pyx" style="cursor:pointer" '
        +laSlipClickAttr(slips, label)+' title="'+e(label+' · มีสลิปแล้ว '+slips.length+' ไฟล์ · กดเพื่อเปิดดู')+'">'
        +'&#128206; '+label+'</span>';
    }).join('')+'</span>');
    if(who.length) L.push('<span class="ts-pyn2">'+e('รับโดย '+who.join(' · '))+'</span>');
  }
  var _ns=(+M.noSlip||0)+(+S.noSlip||0);
  if(_ns>0) L.push('<span class="ts-pyw">&#9888; รอสลิป '+_ns+'</span>');
  var _fee=(+M.pierFee||0)+(+S.fee||0);
  if(_fee>0) L.push('<span class="ts-pyn2">ค่าธรรมเนียม '+m(_fee)+'</span>');
  return '<div class="ts-payc">'+L.join('')+'</div>';
}
// แยกยอดของใบหนึ่งออกเป็น "ตาม booking" กับ "ขายเพิ่มหน้างาน"
function tsTotalOf(r, date){
  var base=+r.amount||0;
  var M=(typeof pckMoney==='function')?pckMoney(r.b,date):null;
  var ex=M?(+M.extrasTot||0):0, up=M?((+M.upDue||0)+(+M.upGot||0)):0;
  var parts=[];
  if(ex>0) parts.push(['ขายเพิ่มหน้าท่า', ex]);
  if(up>0) parts.push(['อัปเกรด', up]);
  return { base:base, site:ex+up, all:base+ex+up, parts:parts };
}
// ของที่ขายเพิ่มหน้างานของใบนี้ · extras (SB_EXTRAS) + upgrade
//   คืนทั้งรายการและยอดแยกตามวิธีรับเงิน เพื่อเอาไปรวมกับการ์ดด้านบน
/* §tsComm · ค่าคอมคนขายต้องเดินทางมาถึงหน้าปิดวันด้วย
   commission กับ toCompany มีอยู่ในทั้ง SB_EXTRAS และ bk.upgrades มานานแล้ว
   แต่ตัวนี้อ่านแล้วทิ้ง ป้ายในตารางจึงเห็นแต่ยอดขาย ไม่เห็นว่าเงินก้อนไหน
   เป็นของคนขาย · บรรทัด "เหลือเข้าบริษัท" ก็หักแต่ค่าจ่ายออก เลขเลยสูงเกินจริง
   นับค่าคอมเฉพาะรายการที่เก็บเงินแล้ว ให้เข้าชุดกับ got/fee
   ที่ยังไม่เก็บ (cot) ยังไม่มีเงินเข้ามือใคร จะหักออกจากยอดรับไม่ได้ */
function tsSaleList(b, date){
  var out=[], by={cash:0,transfer:0,card:0}, fee=0, got=0, due=0, noSlip=0, comm=0;
  try{ ((typeof bkV2ExtrasFor==='function')?bkV2ExtrasFor(b.id):[]).forEach(function(x){
    if(date && x.tripDate && x.tripDate!==date) return;
    var amt=+x.total||0; if(!amt) return;
    var mth=x.method||'cash'; if(by[mth]==null) by[mth]=0;
    /* §exCot · ยังไม่ได้เก็บ = ไม่เข้ายอดแยกตามวิธีรับเงิน · ไปอยู่ฝั่ง "ต้องเก็บ" เหมือนอัปเกรด */
    var _g=(typeof bkxExGot==='function')?bkxExGot(x):true;
    var _cm=+x.commission||0;
    if(_g){ by[mth]+=amt; got+=amt; fee+=(+x.fee||0); comm+=_cm; } else due+=amt;
    var slipMissing=(_g && mth!=='cash' && !((x.slips||[]).length));
    if(slipMissing) noSlip++;
    out.push({ kind:'ex', id:x.id||'', t:String(x.service||'ขายเพิ่ม'), qty:(+x.qty||1), amt:amt,
               // §tsSaleFee · fee ของรายการนี้ · รูดจริง = amt + fee (ตัวที่ตรงกับ statement)
               fee:(+x.fee||0), nSlip:((x.slips||[]).length),
               // §slipView · ส่ง ref ของสลิปมาด้วย ของเดิมส่งแต่ตัวนับ กดดูไฟล์ไม่ได้
               slips:(x.slips||[]).slice(),
               // §tsComm · เงินก้อนนี้แบ่งเป็นของบริษัทเท่าไร ของคนขายเท่าไร
               comm:_cm, toCompany:(+x.toCompany||0),
               method:mth, who:x.seller||'', done:_g, noSlip:slipMissing });
  }); }catch(_){}
  try{ (Array.isArray(b.upgrades)?b.upgrades:[]).forEach(function(u){
    var amt=+u.sellPrice||0; if(!amt) return;
    var m2=u.method||'cash';
    if(u.collected){ if(by[m2]==null) by[m2]=0; by[m2]+=amt; got+=amt; fee+=(+u.fee||0);
                     comm+=(+u.commission||0); }
    else due+=amt;
    // §upgPay · รูดบัตร/โอนแล้วยังไม่มีสลิป ต้องขึ้นเตือนเหมือน Extra
    var _uNo=(!!u.collected && m2!=='cash' && !((u.slips||[]).length));
    if(_uNo) noSlip++;
    out.push({ kind:'up', id:u.id||'', t:String(u.label||'upgrade'), qty:1, amt:amt,
               fee:(+u.fee||0), nSlip:((u.slips||[]).length),
               slips:(u.slips||[]).slice(),
               comm:(+u.commission||0), toCompany:(+u.toCompany||0),
               method:m2, who:u.seller||'', done:!!u.collected, noSlip:_uNo });
  }); }catch(_){}
  return { list:out, by:by, fee:fee, got:got, due:due, noSlip:noSlip, comm:comm, tot:got+due, n:out.length };
}
// ป้ายรายการขายเพิ่มสำหรับตารางส่วนที่ 3
function tsSaleCell(S, money, e){
  if(!S.n) return '<span style="color:var(--zn400)">—</span>';
  var PM={cash:'สด', transfer:'โอน', card:'บัตร', cot:'เก็บวันเดินทาง'};
  return '<div class="ts-sls">'+S.list.map(function(x){
    var cls=x.kind==='up' ? 'ao-up' : 'ao-ex';
    // §tsSaleFee · บัตรมีค่าธรรมเนียมแยกจากยอดขายเสมอ · ต้องเห็นทั้งสองตัวถึงจะกระทบยอดได้
    var _fee=+x.fee||0;
    /* §tsComm · ถ้อยคำเดียวกับที่ใช้ในกล่อง Extra กับ upgrade · หน้าท่าจะได้เห็นคำเดิม */
    var _cm=+x.comm||0;
    var tip=(x.qty>1?('จำนวน '+x.qty+' · '):'')+(PM[x.method]||x.method)
      +(_cm>0?(' · บริษัท '+money(x.toCompany)+' · คอม '+money(_cm)):'')
      +(_fee>0?(' · ค่าธรรมเนียมบัตร '+money(_fee)+' · รูดจริง '+money((+x.amt||0)+_fee)):'')
      +(x.who?(' · '+x.who):'')+(x.done?'':' · ยังไม่เก็บ')+(x.noSlip?' · ยังไม่มีสลิป':'');
    return '<span class="ts-ao '+cls+'" title="'+e(tip)+'">'+e(x.t)+(x.qty>1?(' ×'+x.qty):'')
      +' <b>'+money(x.amt)+'</b>'
      +(_cm>0?(' <i style="font-style:normal;opacity:.78">· คอม '+money(_cm)+'</i>'):'')
      +(_fee>0?(' <i style="font-style:normal;opacity:.72">+fee '+money(_fee)+'</i>'):'')
      +(x.done?'':' <i style="font-style:normal;opacity:.75">รอเก็บ</i>')
      +(x.noSlip?' <i style="font-style:normal;color:#A32D2D">⚠</i>':'')+'</span>';
  }).join('')+'</div>';
}
// §tsSlipAdd · แนบสลิปจากหน้าปิดวันโดยตรง · kind 'p' = เงินที่รับหน้าท่า · 'x' = ของที่ขายเพิ่ม
function tsSlipPick(kind, bkId, itemId, inp){
  var f=(inp&&inp.files&&inp.files[0])||null; if(inp) inp.value='';
  if(!f) return;
  if(typeof pckSlipUpload!=='function'){ alert('แนบสลิปไม่ได้ในหน้านี้'); return; }
  pckSlipUpload(f, bkId, function(meta){
    if(kind==='p'){
      var b=(SB_BOOKINGS||[]).find(function(x){ return x.id===bkId; });
      var p=b&&(Array.isArray(b.pierPayments)?b.pierPayments:[]).find(function(x){ return x.id===itemId; });
      if(p){ p.slips=Array.isArray(p.slips)?p.slips:[]; p.slips.push(meta); }
      try{ acctPersistBookings(); }catch(_){}
    } else {
      var x=(typeof SB_EXTRAS!=='undefined'&&Array.isArray(SB_EXTRAS)?SB_EXTRAS:[]).find(function(y){ return y.id===itemId; });
      if(x){ x.slips=Array.isArray(x.slips)?x.slips:[]; x.slips.push(meta); }
      try{ sbExtrasPersist(); }catch(_){}
    }
    if(typeof tsAfter==='function') tsAfter();
  });
}
// สถานะใบแจ้งหนี้ของ booking นี้ · ใช้ตัวเดียวกับหน้าบัญชี ไม่ได้คิดเลขเอง
function tsInvSettle(b){
  var out={ inv:null, no:'', state:'', paid:0, bal:0, nBk:0, settled:false };
  try{
    if(!b || !b.id || typeof acctBookingInvoice!=='function') return out;
    var iv=acctBookingInvoice(b.id); if(!iv) return out;
    out.inv=iv; out.no=iv.number||iv.id||'';
    out.state=(typeof acctInvoiceState==='function')   ? acctInvoiceState(iv)   : '';
    out.paid =(typeof acctInvoicePaid==='function')    ? acctInvoicePaid(iv)    : 0;
    out.bal  =(typeof acctInvoiceBalance==='function') ? acctInvoiceBalance(iv) : 0;
    out.nBk  =((iv.bookingIds||[]).length)||0;
    out.settled=(out.state==='paid');
  }catch(_){}
  return out;
}
function tsMoneyOf(b, date){
  var M=(typeof pckMoney==='function')?pckMoney(b,date):{cot:0,balance:0,upDue:0,due:0,pierPaid:0};
  var pays=(typeof pckPaysFor==='function')?pckPaysFor(b,date):[];
  var by={cash:0,transfer:0,card:0}, who=[];
  pays.forEach(function(p){ var m=p.method||'cash'; if(by[m]==null) by[m]=0; by[m]+=(+p.amount||0);
    if(p.by && who.indexOf(p.by)<0) who.push(p.by); });
  // §tsInvPaid · บิลจ่ายครบแล้ว = ส่วน COT/ยอดค้างถูกเคลียร์ทางบัญชีไปแล้ว ไม่ต้องตามเก็บที่ท่า
  var IV=tsInvSettle(b);
  var billed = IV.settled ? ((+M.cot||0)+(+M.balance||0)) : 0;
  var target = Math.max(0, (+M.cot||0)+(+M.balance||0)+(+M.upDue||0) - billed);
  return { M:M, pays:pays, by:by, who:who.join(' · '), inv:IV, billed:billed,
           target:target, paid:+M.pierPaid||0, due:Math.max(0, target-(+M.pierPaid||0)) };
}

function acctModal(html){
  let ov=document.getElementById('acct-modal');
  if(!ov){ ov=document.createElement('div'); ov.id='acct-modal'; document.body.appendChild(ov); }
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,20,25,.45);display:flex;align-items:center;justify-content:center;padding:24px';
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">${html}</div>`;
  ov.onclick=(e)=>{ if(e.target===ov) acctModalClose(); };
}
function acctModalClose(){ const ov=document.getElementById('acct-modal'); if(ov) ov.remove(); }
function acctNewInvoiceOpen(){ _acctNewInvAgent=''; acctModal(''); acctNewInvoiceRender(); }
function acctNewInvoiceRender(){
  const ov=document.getElementById('acct-modal'); if(!ov) return;
  const agentsWith = (SB_AGENTS||[]).filter(a=>(SB_BOOKINGS||[]).some(b=>b.agentId===a.id && !ACCT_PAID_STATES.includes(b.status) && !acctBookingInvoice(b.id)));
  const aOpts=agentsWith.map(a=>`<option value="${a.id}" ${a.id===_acctNewInvAgent?'selected':''}>${a.code?a.code+' · ':''}${a.name}</option>`).join('');
  let bkList='';
  if(_acctNewInvAgent){
    const bks=(SB_BOOKINGS||[]).filter(b=>b.agentId===_acctNewInvAgent && !ACCT_PAID_STATES.includes(b.status) && !acctBookingInvoice(b.id));
    bkList = bks.length? bks.map(b=>{
      const d=(b.trips&&b.trips[0]&&b.trips[0].date)||b.travelDate||'';
      return `<label style="display:flex;align-items:center;gap:9px;padding:8px 10px;border:0.5px solid var(--fd-line-soft);border-radius:9px;margin-bottom:6px;cursor:pointer">
        <input type="checkbox" class="acct-bk-cb" value="${b.id}" data-amt="${acctBookingTotal(b)}" checked onchange="acctNewInvoiceSum()" style="width:16px;height:16px;margin:0">
        <div style="flex:1"><div style="font-size:12px;font-weight:500">${(b.code||b.id)} · ${(b.leadPax||b.customerName||'—')}</div><div style="font-size:10px;color:var(--fd-ink-soft)">${d} · ${(b.status||'')}</div></div>
        <div style="font-size:12px;font-variant-numeric:tabular-nums;font-weight:600">${acctFmt(acctBookingTotal(b))}</div>
      </label>`;
    }).join('') : '<div style="font-size:11.5px;color:var(--fd-ink-soft);font-style:italic;padding:8px">ไม่มี booking ค้างออกใบแจ้งหนี้สำหรับ agent นี้</div>';
  }
  ov.querySelector('div').innerHTML=`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700">ออกใบแจ้งหนี้ใหม่</div>
      <button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button>
    </div>
    <div style="padding:16px 20px">
      <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Agent</label>
      <select onchange="_acctNewInvAgent=this.value;acctNewInvoiceRender()" style="width:100%;height:34px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:2px 8px;background:#fff;margin-bottom:12px">
        <option value="">— เลือก agent —</option>${aOpts}
      </select>
      ${_acctNewInvAgent?`<div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:7px">Booking ค้างชำระ</div>${bkList}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--fd-line)">
        <span style="font-size:12px;color:var(--fd-ink-soft)">รวม <span id="acct-inv-sum" style="font-weight:700;color:var(--fd-ink);font-variant-numeric:tabular-nums">฿0</span></span>
        <button onclick="acctNewInvoiceCreate()" style="background:var(--fd-coral);color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">ออกใบแจ้งหนี้</button>
      </div>`:''}
    </div>`;
  acctNewInvoiceSum();
}
function acctNewInvoiceSum(){
  const el=document.getElementById('acct-inv-sum'); if(!el) return;
  let s=0; document.querySelectorAll('.acct-bk-cb:checked').forEach(cb=>{ s+=+cb.getAttribute('data-amt')||0; });
  el.textContent=acctFmt(s);
}
function acctNewInvoiceCreate(){
  const ids=[...document.querySelectorAll('.acct-bk-cb:checked')].map(cb=>cb.value);
  if(!ids.length){ alert('Select at least one booking'); return; }
  const a=sbGetAgent(_acctNewInvAgent);
  const dueDays=(a && a.creditDays)|| (a && a.payType==='invoice'?30:0);
  acctCreateInvoice(_acctNewInvAgent, ids, dueDays);
  acctModalClose(); renderAccounting();
}

function acctPayOpen(invId){
  const inv=SB_INVOICES.find(i=>i.id===invId); if(!inv) return;
  const bal=acctInvoiceBalance(inv); const a=sbGetAgent(inv.agentId);
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700">บันทึกรับเงิน · ${inv.number}</div>
      <button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button>
    </div>
    <div style="padding:16px 20px">
      <div style="font-size:12px;color:var(--fd-ink-soft);margin-bottom:12px">${a?a.name:''} · ยอดคงเหลือ <strong style="color:#A05A1A;font-variant-numeric:tabular-nums">${acctFmt(bal)}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">จำนวนเงิน</label>
          <input id="acct-pay-amt" type="number" min="0" value="${Math.round(bal)}" style="width:100%;height:34px;font-size:13px;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:8px;padding:2px 9px;text-align:right"></div>
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">วิธี</label>
          <select id="acct-pay-method" style="width:100%;height:34px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:2px 6px;background:#fff">
            <option value="transfer">โอน</option><option value="cash">เงินสด</option><option value="card">บัตร</option></select></div>
      </div>
      ${(()=>{const dv=acctAgentDepositAvail(inv.agentId);return dv>0?`<div style="background:#F4EEFB;border:1px solid #D9C7EE;border-radius:9px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11.5px;color:#5B289A">มัดจำคงเหลือ ${acctFmt(dv)}</span><button onclick="acctPayUseDeposit('${inv.id}')" style="background:#5B289A;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:6px 12px;border-radius:7px;cursor:pointer">หักมัดจำ</button></div>`:'';})()}
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">ยกเลิก</button>
        <button onclick="acctPaySubmit('${inv.id}')" style="background:#0F7A5A;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">บันทึกรับเงิน</button>
      </div>
    </div>`);
}
function acctPaySubmit(invId){
  const amt=+(document.getElementById('acct-pay-amt')||{}).value||0;
  const method=(document.getElementById('acct-pay-method')||{}).value||'transfer';
  if(amt<=0){ alert('Enter amount'); return; }
  acctRecordPayment(invId, amt, method);
  acctModalClose(); renderAccounting();
}
function acctVoidConfirm(invId){
  if(!confirm('Void this invoice? Linked bookings return to unpaid (credit re-held).')) return;
  acctVoidInvoice(invId); renderAccounting();
}

// ════ ACCOUNTING P2 · printable invoice + receipt (A4, browser print → PDF) ════
function _acctInjectPrintCSS(){
  if(document.getElementById('acct-print-style')) return;
  const st=document.createElement('style'); st.id='acct-print-style';
  st.textContent='@media print{body.acct-printing > *{visibility:hidden !important}body.acct-printing #acct-doc-modal,body.acct-printing #acct-doc-modal *{visibility:visible !important}body.acct-printing #acct-doc-modal{position:absolute !important;inset:0 !important;background:#fff !important;padding:0 !important;overflow:visible !important}body.acct-printing #acct-doc-modal .acct-doc-actions{display:none !important}body.acct-printing #acct-doc-sheet{box-shadow:none !important;border-radius:0 !important;margin:0 !important;max-width:none !important;width:auto !important;min-height:0 !important;padding:14mm !important}@page{size:A4;margin:0}}';
  document.head.appendChild(st);
}
function acctDocLineItems(inv){
  // Standalone fee invoice (e.g. cancellation) → render its own line items
  if(inv.feeType && Array.isArray(inv.lineItems) && inv.lineItems.length){
    return inv.lineItems.map(li=>({ code:'FEE', desc:li.label||'Fee', date:'', pax:'', lead:'', amount:li.amount||0 }));
  }
  const rows=[];
  (inv.bookingIds||[]).forEach(id=>{
    const b=SB_BOOKINGS.find(x=>x.id===id)||{};
    const t=(b.trips&&b.trips[0])||{};
    const rt=(typeof ROUTES!=='undefined'&&ROUTES.find(r=>r.id===t.routeId))||null;
    const pax=(typeof bkV2PaxAllTot==='function'&&t.pax)?bkV2PaxAllTot(t.pax):'';
    const date=t.date||b.travelDate||'';
    rows.push({ code:b.code||id, desc:(rt?rt.name:(t.routeId||'Booking')), date, pax, lead:(b.leadPax||b.customerName||''), amount:acctBookingBase(b) });
    // Fee items attached to the booking (e.g. reschedule fee) ride on this same invoice as labelled lines
    (b.feeItems||[]).forEach(f=> rows.push({ code:b.code||id, desc:f.label||'Fee', date:'', pax:'', lead:'', amount:(+f.amount||0) }));
  });
  return rows;
}
function _acctDocShell(title, bodyHtml){
  return `<div style="font-family:'DM Sans',sans-serif;color:#1a1a1a;font-size:13px;line-height:1.5">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1683C7;padding-bottom:16px;margin-bottom:22px">
      <div><div style="font-size:20px;font-weight:700;color:#0E6AA8;letter-spacing:-.01em">OPERATION LOVE ANDAMAN</div>
      <div style="font-size:11px;color:#666;margin-top:2px">Marine Tourism · Phuket, Thailand · loveandaman.com</div></div>
      <div style="text-align:right"><div style="font-size:22px;font-weight:700;letter-spacing:.02em;color:#1a1a1a">${title}</div></div>
    </div>
    ${bodyHtml}
    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #e5e5e5;font-size:10.5px;color:#888;text-align:center">Operation LOVE Andaman · Thank you for your business</div>
  </div>`;
}
// Integer/decimal Baht → English words (e.g. "Three Thousand Four Hundred Baht")
function _acctBahtText(n){
  n=Math.round((+n||0)*100)/100; const baht=Math.floor(n), sat=Math.round((n-baht)*100);
  const o=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const b3=x=>{ let s=''; if(x>=100){ s+=o[Math.floor(x/100)]+' Hundred'; x%=100; if(x)s+=' '; } if(x>=20){ s+=t[Math.floor(x/10)]; x%=10; if(x)s+='-'+o[x]; } else if(x>0) s+=o[x]; return s; };
  const w=x=>{ if(x===0)return'Zero'; const u=['','Thousand','Million','Billion']; let i=0,p=[]; while(x>0){ const c=x%1000; if(c)p.unshift(b3(c)+(u[i]?' '+u[i]:'')); x=Math.floor(x/1000); i++; } return p.join(' '); };
  let s=w(baht)+' Baht'; if(sat>0) s+=' and '+b3(sat)+' Satang'; return s;
}
// Deterministic faux-QR (decorative · no lib) seeded from the invoice number
function _acctFauxQR(seed){
  seed=String(seed||'x'); let h=0; for(let i=0;i<seed.length;i++) h=(h*31+seed.charCodeAt(i))>>>0;
  const N=21,c=4; const rnd=()=>{ h=(h*1103515245+12345)>>>0; return (h>>>16)&1; };
  const fnd=(ox,oy)=>{ let s=''; for(let y=0;y<7;y++)for(let x=0;x<7;x++){ if((x===0||x===6||y===0||y===6)||(x>=2&&x<=4&&y>=2&&y<=4)) s+=`<rect x="${(ox+x)*c}" y="${(oy+y)*c}" width="${c}" height="${c}"/>`; } return s; };
  let r=''; for(let y=0;y<N;y++)for(let x=0;x<N;x++){ if((x<8&&y<8)||(x>N-9&&y<8)||(x<8&&y>N-9))continue; if(rnd())r+=`<rect x="${x*c}" y="${y*c}" width="${c}" height="${c}"/>`; }
  r+=fnd(0,0)+fnd(N-7,0)+fnd(0,N-7);
  return `<svg width="78" height="78" viewBox="0 0 ${N*c} ${N*c}" fill="#1a1a1a"><rect width="${N*c}" height="${N*c}" fill="#fff"/>${r}</svg>`;
}
function acctInvCfg(){
  var c=(typeof ctRead==='function')?ctRead('inv_cfg'):null; c=(c&&typeof c==='object')?c:{};
  return { seller:Object.assign({}, INV_HEAD_DEF.seller,  c.seller||{}),
           contact:Object.assign({}, INV_HEAD_DEF.contact, c.contact||{}),
           bank:Object.assign({}, INV_HEAD_DEF.bank,    c.bank||{}) };
}
function acctInvCfgSet(grp, field, val){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  var c=(typeof ctRead==='function')?ctRead('inv_cfg'):null; c=(c&&typeof c==='object')?c:{};
  if(!c[grp]) c[grp]={};
  c[grp][field]=String(val==null?'':val);
  if(typeof ctWrite==='function') ctWrite('inv_cfg', c);
}
/* ── ช่องบนใบที่เคยเป็นขีด "-" ตายตัว · ให้กรอกได้จริง ──────────────────
   ref / dear / acceptAt / remark ไม่แตะเงิน แก้ได้ตลอด
   whtAmount ไม่แตะยอดรวมเช่นกัน · มันหักตอน "จ่ายจริง" เท่านั้น (Payment Amount) */
function acctInvSet(invId, field, val){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  var inv=SB_INVOICES.find(function(i){ return i.id===invId; }); if(!inv) return;
  if(field==='whtAmount') inv[field]=Math.max(0, parseFloat(String(val).replace(/[^0-9.]/g,''))||0);
  else inv[field]=String(val==null?'':val).trim();
  sbInvoicesPersist();
  acctOpenDoc(invId, 'invoice');
}
/* ── ส่วนลดรายบรรทัด ────────────────────────────────────────────────────
   ⚠ ตัวนี้แตะเงินจริง · ยอดรวมของใบต้องคิดใหม่ ไม่งั้นใบขัดกันเอง
      (Pre-VAT ลดแต่ Total เท่าเดิม = เอกสารบวกเลขไม่ตรง)
   ใบที่รับเงินไปแล้วห้ามแก้ · ยอดค้างจะเพี้ยนย้อนหลังโดยไม่มีใครรู้ → ให้ยกเลิกใบแล้วออกใหม่ */
function acctInvDiscKey(it, i){ return String(it.code||('#'+i))+'|'+i; }
function acctInvDisc(invId, key, val){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  var inv=SB_INVOICES.find(function(i){ return i.id===invId; }); if(!inv) return;
  if(acctInvoicePaid(inv)>0){ alert('ใบนี้รับเงินไปแล้ว แก้ส่วนลดไม่ได้ · ถ้าต้องแก้จริง ให้ยกเลิกใบแล้วออกใหม่'); return; }
  if(!(+(inv.gross0!=null?inv.gross0:inv.subtotal)>0)){ alert('ใบนี้ไม่มียอดตั้งต้น ใส่ส่วนลดไม่ได้'); return; }
  if(!inv.discounts || typeof inv.discounts!=='object') inv.discounts={};
  var d=Math.max(0, parseFloat(String(val).replace(/[^0-9.]/g,''))||0);
  if(d>0) inv.discounts[key]=d; else delete inv.discounts[key];
  acctInvRecalc(inv);
  sbInvoicesPersist();
  acctOpenDoc(invId, 'invoice');
}
/* คิดยอดใหม่ · สูตร VAT เดียวกับตอนออกใบ (acctCreateInvoice)
   ⚠ ห้ามไปบวกยอดใหม่จากใบจอง · ใบแจ้งหนี้ที่ออกไปแล้วคือตัวเลขที่ตกลงกันแล้ว
     ราคาในใบจองถูกแก้ทีหลังได้ ใบจองถูกถอดออกจากใบได้ → ยอดจะเพี้ยนย้อนหลังเงียบ ๆ
     (เจอตอนทดสอบจริง: ใบเดือน มิ.ย. ที่ใบจองไม่ได้โหลดมาด้วย ยอด 3,600 กลายเป็น 0)
   ยึด gross0 = ยอดตอนออกใบ เก็บไว้ครั้งเดียว แล้วหักส่วนลดจากตัวนั้นอย่างเดียว */
function acctInvRecalc(inv){
  if(inv.gross0==null) inv.gross0=+inv.subtotal||0;
  var D=inv.discounts||{}, disc=0;
  Object.keys(D).forEach(function(k){ disc+=(+D[k]||0); });
  disc=Math.min(disc, +inv.gross0||0);                 /* ส่วนลดเกินยอดไม่ได้ */
  var sub=Math.max(0, (+inv.gross0||0)-disc), rate=inv.vatRate||0.07;
  inv.subtotal=sub;
  if(inv.vatMode==='exclude'){ inv.netAmount=sub; inv.vatAmount=Math.round(sub*rate); inv.total=inv.netAmount+inv.vatAmount; }
  else if(inv.vatMode==='include'){ inv.total=sub; inv.netAmount=Math.round(sub/(1+rate)); inv.vatAmount=sub-inv.netAmount; }
  else { inv.netAmount=sub; inv.vatAmount=0; inv.total=sub; }
  return inv;
}
function acctInvoiceDocHtml(inv){
  const a=sbGetAgent(inv.agentId); const ci=(a&&a.companyInfo)||{};
  const isPF=(a&&a.payType==='proforma');
  const items=acctDocLineItems(inv);
  const rate=inv.vatRate||0.07; const hasVat=(inv.vatAmount||0)>0;
  const f2=n=>Number(Math.round((+n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dmy=s=>{ if(!s)return'-'; try{ const d=new Date(s); const p=x=>String(x).padStart(2,'0'); return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear(); }catch(e){return s;} };
  const wht=(+inv.whtAmount||0); const payAmt=(inv.total||0)-wht;
  const linePre=amt=>!hasVat?amt:(inv.vatMode==='include'?amt/(1+rate):amt);
  /* §invEdit · โลโก้เคยอ้าง assets/logo.png ซึ่งไม่มีไฟล์อยู่จริง (โฟลเดอร์มีแต่ bg.jpg / template_blank.jpg)
     ใบแจ้งหนี้ทุกใบจึงรูปแตกสองจุด — หัวใบ กับช่อง Stamp (Seller)
     ในไฟล์มีโลโก้ตัวจริงฝังเป็น data URI อยู่แล้ว (LA_LOGO_FULL) พร้อมหมายเหตุว่า
     "ใบที่ถูก export เป็นไฟล์เดี่ยว อ้าง path แล้วรูปแตก" · ใช้ตัวนั้น */
  const logo=(typeof LA_LOGO_FULL!=='undefined')
    ? `<img src="${LA_LOGO_FULL}" alt="LOVE andaman" style="height:48px;width:auto;display:block">`
    : `<div style="font-size:15px;font-weight:800;color:#0E6AA8">LOVE andaman</div>`;
  const _CFG=acctInvCfg(), SELL=_CFG.seller, CONTACT=_CFG.contact, BANK=_CFG.bank;
  const ED=!!_acctInvEdit;
  const EIN=(fn,v,ph,w)=>ED
    ? `<input value="${String(v==null?'':v).replace(/"/g,'&quot;')}" placeholder="${ph||''}" onchange="${fn}"
        style="width:${w||'100%'};border:1px dashed #9EC4E4;background:#F8FCFF;border-radius:5px;padding:2px 6px;font:inherit;font-size:11px;color:#0B4F7E">`
    : String(v==null?'':v);
  const ic=(p,col,sz)=>`<svg width="${sz||11}" height="${sz||11}" viewBox="0 0 24 24" fill="none" stroke="${col||'#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:6px">${p}</svg>`;
  const IPH='<path d="M5 4h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 6a2 2 0 0 1 2-2"/>',IML='<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',IWB='<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/>',ISUM='<path d="M9 5h6M9 9h6M9 13h4"/><rect x="4" y="3" width="16" height="18" rx="2"/>',ICARD='<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',ICHAT='<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',ISHIELD='<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>';
  const lab='font-size:11px;color:#1a1a1a;font-weight:700;white-space:nowrap;vertical-align:top';
  const val='font-size:11px;color:#333';
  const boxShade='#EEF0FB';
  const DIS=inv.discounts||{};
  const rowsH=items.map((it,i)=>{ const qty=(it.pax&&+it.pax)||1; const gross=it.amount||0; const price=qty?gross/qty:gross;
    /* §invEdit · Pre-VAT ต้องหักส่วนลดของบรรทัดนั้นด้วย · ไม่งั้นเอกสารบวกเลขไม่ตรงกับ Total */
    const dcut=+DIS[acctInvDiscKey(it,i)]||0; const pre=linePre(Math.max(0,gross-dcut));
    return `<tr style="border-bottom:1px solid #eef0f3">
      <td style="padding:10px 8px;vertical-align:top;font-size:11.5px"><div style="font-weight:600">${i+1}.&nbsp; ${it.desc}</div>${it.code?`<div style="font-size:10px;color:#8a8a8a;margin-top:1px">VC: ${it.code}${it.date?(' · '+dmy(it.date)):''}</div>`:''}</td>
      <td style="padding:10px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11.5px;vertical-align:top">${f2(qty)}</td>
      <td style="padding:10px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11.5px;vertical-align:top">${f2(price)}</td>
      <td style="padding:10px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11.5px;vertical-align:top">${ED?EIN(`acctInvDisc('${inv.id}','${acctInvDiscKey(it,i).replace(/'/g,"")}',this.value)`, dcut||'', '0', '64px'):f2(dcut)}</td>
      <td style="padding:10px 8px;text-align:right;font-size:11.5px;vertical-align:top">${hasVat?Math.round(rate*100)+'%':'-'}</td>
      <td style="padding:10px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11.5px;vertical-align:top">${f2(pre)}</td></tr>`; }).join('');
  const thr='padding:9px 8px;text-align:right;font-size:10.5px;font-weight:700;color:#1a1a1a';
  return `<div style="font-family:'DM Sans',sans-serif;color:#1a1a1a;font-size:12px;line-height:1.5">
    <div style="text-align:right;font-size:10px;color:#555">(Original)</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:2px 0 14px">
      <div>${logo}</div>
      <div style="font-size:30px;font-weight:800;color:#6C6FE0;letter-spacing:-.01em">${isPF?'Pro Forma-Invoice':'Invoice'}</div>
    </div>

    <div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:12px">
      <div style="flex:1">
        <table style="font-size:11px;border-collapse:collapse;width:100%"><tbody>
          <tr><td style="${lab};padding:1px 12px 1px 0">Seller :</td><td style="${val};font-weight:600">${EIN(`acctInvCfgSet('seller','name',this.value);acctOpenDoc('${inv.id}','invoice')`, SELL.name)}</td></tr>
          <tr><td style="${lab};padding:1px 12px 1px 0">Address :</td><td style="${val}">${EIN(`acctInvCfgSet('seller','addr',this.value);acctOpenDoc('${inv.id}','invoice')`, SELL.addr)}</td></tr>
          <tr><td style="${lab};padding:1px 12px 1px 0">Tax No. :</td><td style="${val}">${EIN(`acctInvCfgSet('seller','tax',this.value);acctOpenDoc('${inv.id}','invoice')`, SELL.tax)}</td></tr>
        </tbody></table>
        <div style="display:flex;gap:20px;font-size:11px;color:#333;margin-top:8px;flex-wrap:wrap">
          <span>${ic(IPH)}${EIN(`acctInvCfgSet('seller','tel',this.value);acctOpenDoc('${inv.id}','invoice')`, SELL.tel, '', '120px')}</span>
          <span>${ic(IML)}${EIN(`acctInvCfgSet('seller','email',this.value);acctOpenDoc('${inv.id}','invoice')`, SELL.email, '', '170px')}</span>
        </div>
      </div>
      <div style="width:236px;flex:none;background:${boxShade};border-radius:6px;padding:12px 14px">
        <table style="font-size:11px;border-collapse:collapse;width:100%"><tbody>
          <tr><td style="font-weight:700;padding:2px 8px 2px 0;white-space:nowrap">Doc. No. :</td><td style="text-align:right;font-family:'DM Mono',monospace">${inv.number}</td></tr>
          <tr><td style="font-weight:700;padding:2px 8px 2px 0">Issue Date :</td><td style="text-align:right">${dmy(inv.issuedAt)}</td></tr>
          <tr><td style="font-weight:700;padding:2px 8px 2px 0">Accept Date :</td><td style="text-align:right">${ED?EIN(`acctInvSet('${inv.id}','acceptAt',this.value)`, inv.acceptAt||'', 'dd/mm/yyyy', '110px'):(inv.acceptAt||'-')}</td></tr>
          <tr><td style="font-weight:700;padding:2px 8px 2px 0">Due Date :</td><td style="text-align:right">${dmy(inv.dueAt)}</td></tr>
          <tr><td style="font-weight:700;padding:2px 8px 2px 0">Ref. :</td><td style="text-align:right">${ED?EIN(`acctInvSet('${inv.id}','ref',this.value)`, inv.ref||'', 'เลขอ้างอิงของลูกค้า', '110px'):(inv.ref||'-')}</td></tr>
        </tbody></table>
      </div>
    </div>

    <div style="display:flex;gap:24px;align-items:flex-start;margin:0 0 14px">
      <table style="flex:1;font-size:11px;border-collapse:collapse"><tbody>
        <tr><td style="${lab};padding:1px 12px 1px 0">Customer :</td><td style="${val};font-weight:600">${ci.legalName||(a?a.name:inv.agentId)}</td></tr>
        <tr><td style="${lab};padding:1px 12px 1px 0">Address :</td><td style="${val}">${ci.address||'-'}</td></tr>
        <tr><td style="${lab};padding:1px 12px 1px 0">Tax No. :</td><td style="${val}">${ci.taxId?(ci.taxId+' (Head Office)'):'-'}</td></tr>
        <tr><td style="${lab};padding:1px 12px 1px 0">Dear :</td><td style="${val}">${ED?EIN(`acctInvSet('${inv.id}','dear',this.value)`, inv.dear||'', 'ชื่อผู้รับ', '200px'):(inv.dear||'-')}</td></tr>
      </tbody></table>
      <div style="width:236px;flex:none;font-size:11px;color:#333">
        <div style="font-weight:700;margin-bottom:5px">Contact Person :</div>
        <div style="margin-bottom:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" style="vertical-align:-1px;margin-right:6px"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>${EIN(`acctInvCfgSet('contact','name',this.value);acctOpenDoc('${inv.id}','invoice')`, CONTACT.name, '', '160px')}</div>
        <div style="margin-bottom:3px">${ic(IPH)}${EIN(`acctInvCfgSet('contact','tel',this.value);acctOpenDoc('${inv.id}','invoice')`, CONTACT.tel, '', '160px')}</div>
        <div>${ic(IML)}${EIN(`acctInvCfgSet('contact','email',this.value);acctOpenDoc('${inv.id}','invoice')`, CONTACT.email, '', '160px')}</div>
      </div>
    </div>

    <div style="min-height:104px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
      <thead><tr style="background:${boxShade}">
        <th style="padding:9px 8px;text-align:left;font-size:10.5px;font-weight:700;border-radius:4px 0 0 4px">Description</th>
        <th style="${thr}">Quantity</th><th style="${thr}">Price</th><th style="${thr}">Discount</th><th style="${thr}">VAT</th><th style="${thr};border-radius:0 4px 4px 0">Pre-VAT</th>
      </tr></thead>
      <tbody>${rowsH||'<tr><td colspan="6" style="padding:18px;text-align:center;color:#999">No items</td></tr>'}</tbody>
    </table>
    </div>

    <div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-top:1px solid #d7d9de;margin-top:13px;padding-top:12px">
      <div style="font-weight:700;font-size:12px;white-space:nowrap">${ic(ISUM,'#1a1a1a',14)}Summary</div>
      <div style="flex:1;font-size:11.5px;max-width:430px">
        <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-weight:700">VAT ${Math.round(rate*100)}% Amount</span><span style="font-variant-numeric:tabular-nums">${f2(inv.netAmount||inv.subtotal)} Baht</span></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-weight:700">VAT Amount</span><span style="font-variant-numeric:tabular-nums">${f2(inv.vatAmount||0)} Baht</span></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0;gap:20px"><span style="font-weight:700">Total Amount</span><span style="text-align:right;color:#333">${_acctBahtText(inv.total)}</span></div>
      </div>
      <div style="width:235px;background:${boxShade};border-radius:7px;padding:13px 15px;display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12px;font-weight:600;color:#444">Total Amount</span><span style="font-size:20px;font-weight:800">${f2(inv.total)} <span style="font-size:11px;font-weight:500">Baht</span></span></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:8px"><table style="font-size:11.5px"><tbody>
      <tr><td style="padding:2px 14px 2px 0;font-weight:700;text-align:right">WHT Amount</td><td style="text-align:right;font-variant-numeric:tabular-nums;min-width:90px">${ED?EIN(`acctInvSet('${inv.id}','whtAmount',this.value)`, wht||'', '0', '78px'):f2(wht)} Baht</td></tr>
      <tr><td style="padding:2px 14px 2px 0;font-weight:700;text-align:right">Payment Amount</td><td style="text-align:right;font-variant-numeric:tabular-nums">${f2(payAmt)} Baht</td></tr>
    </tbody></table></div>

    <div style="border-top:1px solid #d7d9de;margin-top:11px;padding-top:11px;display:flex;align-items:center;gap:16px">
      <div style="font-weight:700;font-size:12px;white-space:nowrap">${ic(ICARD,'#1a1a1a',14)}Payment</div>
      <div style="display:flex;align-items:center;gap:11px">
        <span style="width:30px;height:30px;border-radius:50%;background:${BANK.color||'#13a538'};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px">${(BANK.mark||'K').slice(0,2)}</span>
        <div style="font-size:11px;color:#333"><div>${EIN(`acctInvCfgSet('bank','bank',this.value);acctOpenDoc('${inv.id}','invoice')`, BANK.bank, 'ธนาคาร · สาขา', '230px')}</div>
          <div style="font-weight:700">${EIN(`acctInvCfgSet('bank','acc',this.value);acctOpenDoc('${inv.id}','invoice')`, BANK.acc, 'ประเภท · เลขบัญชี', '230px')}</div>
          <div>${EIN(`acctInvCfgSet('bank','name',this.value);acctOpenDoc('${inv.id}','invoice')`, BANK.name, 'ชื่อบัญชี', '230px')}</div></div>
      </div>
    </div>

    <div style="border-top:1px solid #d7d9de;margin-top:11px;padding-top:11px"><div style="font-weight:700;font-size:12px">${ic(ICHAT,'#1a1a1a',14)}Remark</div><div style="min-height:16px;font-size:11px;color:#666">${ED?EIN(`acctInvSet('${inv.id}','remark',this.value)`, inv.remark||'', 'หมายเหตุบนใบ', '100%'):(inv.remark||'')}</div></div>

    <div style="border-top:1px solid #d7d9de;margin-top:11px;padding-top:11px;display:flex;gap:16px;align-items:flex-start">
      <div style="font-weight:700;font-size:12px;white-space:nowrap">${ic(ISHIELD,'#1a1a1a',14)}Certified</div>
      <div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center;font-size:10.5px;color:#444">
        <div><div style="margin-bottom:30px">Created by (Seller)</div><div style="font-weight:600;color:#1a1a1a">${CONTACT.name}</div><div>${dmy(inv.issuedAt)}</div></div>
        <div><div style="margin-bottom:8px">Stamp (Seller)</div><div style="display:flex;justify-content:center;opacity:.9">${logo}</div></div>
        <div><div style="margin-bottom:30px">Received by (Customer)</div><div style="border-top:1px dashed #aaa;padding-top:5px">${ci.legalName||(a?a.name:'')}</div></div>
      </div>
    </div>
  </div>`;
}
function acctReceiptDocHtml(inv){
  const a=sbGetAgent(inv.agentId);
  const pays=SB_PAYMENTS.filter(p=>p.invoiceId===inv.id && p.type!=='refund');
  const paid=acctInvoicePaid(inv), bal=acctInvoiceBalance(inv);
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  const dt=s=>{ if(!s)return'—'; try{return new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(e){return s;} };
  const mlabel={transfer:'Bank transfer',cash:'Cash',card:'Card'};
  const rows=pays.map((p,i)=>`<tr style="border-bottom:1px solid #eee"><td style="padding:9px 6px;font-size:11px;color:#888">${i+1}</td><td style="padding:9px 6px">${dt(p.date)}</td><td style="padding:9px 6px">${mlabel[p.method]||p.method}</td><td style="padding:9px 6px;text-align:right;font-variant-numeric:tabular-nums">${fmt(p.amount)}</td></tr>`).join('');
  const body=`
    <div style="display:flex;justify-content:space-between;gap:30px;margin-bottom:24px">
      <div style="flex:1"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:4px">Received from</div>
        <div style="font-size:14px;font-weight:600">${a?a.name:inv.agentId}</div>${a&&a.code?`<div style="font-size:11px;color:#777">Agent ${a.code}</div>`:''}</div>
      <div style="text-align:right;font-size:11.5px;color:#444">
        <div><span style="color:#999">Against Invoice</span> <strong style="font-family:'DM Mono',monospace">${inv.number}</strong></div>
        <div style="margin-top:3px"><span style="color:#999">Date</span> ${dt(new Date().toISOString())}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
      <thead><tr style="border-bottom:2px solid #1a1a1a"><th style="padding:7px 6px;text-align:left;font-size:9.5px;color:#999;text-transform:uppercase;width:30px">#</th><th style="padding:7px 6px;text-align:left;font-size:9.5px;color:#999;text-transform:uppercase">Date</th><th style="padding:7px 6px;text-align:left;font-size:9.5px;color:#999;text-transform:uppercase">Method</th><th style="padding:7px 6px;text-align:right;font-size:9.5px;color:#999;text-transform:uppercase">Amount</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="4" style="padding:14px;color:#999;font-style:italic">No payments recorded</td></tr>'}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><table style="font-size:13px;min-width:240px">
      <tr style="border-top:1.5px solid #1a1a1a"><td style="padding:7px 0;font-weight:700;color:#0F6E56">Total received</td><td style="padding:7px 0;text-align:right;font-weight:700;color:#0F6E56;font-variant-numeric:tabular-nums">${fmt(paid)}</td></tr>
      ${bal>0?`<tr><td style="padding:4px 0;color:#A05A1A">Balance remaining</td><td style="padding:4px 0;text-align:right;color:#A05A1A;font-variant-numeric:tabular-nums">${fmt(bal)}</td></tr>`:''}
    </table></div>`;
  return _acctDocShell('RECEIPT', body);
}
function acctDocEdit(invId){ _acctInvEdit=!_acctInvEdit; acctOpenDoc(invId,'invoice'); }
function acctOpenDoc(invId, mode){
  const inv=SB_INVOICES.find(i=>i.id===invId); if(!inv) return;
  if(mode==='receipt') _acctInvEdit=false;
  _acctDocId=invId;
  _acctInjectPrintCSS();
  const hasPay=SB_PAYMENTS.some(p=>p.invoiceId===inv.id && p.type!=='refund');
  const doc = (mode==='receipt') ? acctReceiptDocHtml(inv) : acctInvoiceDocHtml(inv);
  let ov=document.getElementById('acct-doc-modal');
  if(!ov){ ov=document.createElement('div'); ov.id='acct-doc-modal'; document.body.appendChild(ov); }
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(15,20,25,.5);overflow:auto;padding:24px';
  ov.innerHTML=`<div style="max-width:210mm;margin:0 auto">
    <div class="acct-doc-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px">
      <button onclick="acctDocClose()" style="background:#fff;border:1px solid #d9d9d9;color:#333;font-family:inherit;font-size:12px;padding:8px 14px;border-radius:9px;cursor:pointer">ปิด</button>
      ${mode==='receipt'?'':`<button onclick="acctDocEdit('${inv.id}')" style="background:${_acctInvEdit?'#0F6E56':'#fff'};border:1px solid ${_acctInvEdit?'#0F6E56':'#d9d9d9'};color:${_acctInvEdit?'#fff':'#333'};font-family:inherit;font-size:12px;font-weight:${_acctInvEdit?'700':'400'};padding:8px 14px;border-radius:9px;cursor:pointer">${_acctInvEdit?'&#10003; แก้เสร็จแล้ว':'&#9998; แก้ไขใบ'}</button>`}
      ${mode==='receipt'?`<button onclick="acctOpenDoc('${inv.id}','invoice')" style="background:#fff;border:1px solid #d9d9d9;color:#333;font-family:inherit;font-size:12px;padding:8px 14px;border-radius:9px;cursor:pointer">ดูใบแจ้งหนี้</button>`:(hasPay?`<button onclick="acctOpenDoc('${inv.id}','receipt')" style="background:#fff;border:1px solid #d9d9d9;color:#333;font-family:inherit;font-size:12px;padding:8px 14px;border-radius:9px;cursor:pointer">ดูใบเสร็จ</button>`:'')}
      <button onclick="acctPrintDoc()" style="background:#1683C7;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:8px 16px;border-radius:9px;cursor:pointer">พิมพ์ / PDF</button>
    </div>
    <div id="acct-doc-sheet" style="width:210mm;min-height:297mm;box-sizing:border-box;margin:0 auto;background:#fff;border-radius:6px;padding:14mm;box-shadow:0 10px 40px rgba(0,0,0,.25)">${doc}</div>
  </div>`;
  ov.onclick=(e)=>{ if(e.target===ov) acctDocClose(); };
}
function acctDocClose(){ _acctInvEdit=false; const ov=document.getElementById('acct-doc-modal'); if(ov) ov.remove(); }
function acctPrintDoc(){
  /* §invEdit · ใบจริงต้องไม่มีกรอบเส้นประของช่องกรอกติดไปด้วย
     วาดใหม่เป็นโหมดอ่านก่อนสั่งพิมพ์ · ไม่แก้ DOM ทิ้ง ไม่งั้นปิดกล่องพิมพ์แล้วหน้าต่างพัง */
  if(_acctInvEdit && _acctDocId){ _acctInvEdit=false; acctOpenDoc(_acctDocId,'invoice'); }
  document.body.classList.add('acct-printing');
  const done=()=>{ document.body.classList.remove('acct-printing'); window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint',done);
  setTimeout(()=>window.print(),50);
}

// ════ ACCOUNTING P3 · deposits · apply-to-invoice · per-agent statement ════
function acctDepositRemaining(dep){ const used=SB_PAYMENTS.filter(p=>p.depositId===dep.id).reduce((s,p)=>s+(p.amount||0),0); return Math.max(0,(dep.amount||0)-used); }
function acctAgentDepositAvail(agentId){ return SB_DEPOSITS.filter(d=>d.agentId===agentId).reduce((s,d)=>s+acctDepositRemaining(d),0); }
function acctDepositHeldTotal(){ return SB_DEPOSITS.reduce((s,d)=>s+acctDepositRemaining(d),0); }
function acctCreateDeposit(agentId, amount, method, note){ const dep={id:LA_UID('dep_'), agentId, amount:Math.max(0,+amount||0), method:method||'transfer', note:note||'', date:new Date().toISOString()}; SB_DEPOSITS.push(dep); sbDepositsPersist(); return dep; }
function acctApplyDeposit(agentId, invoiceId, amount){
  let need=Math.max(0,+amount||0); if(need<=0) return 0;
  const inv=SB_INVOICES.find(i=>i.id===invoiceId); if(!inv) return 0;
  let applied=0;
  for(const dep of SB_DEPOSITS.filter(d=>d.agentId===agentId)){
    if(need<=0) break;
    const rem=acctDepositRemaining(dep); if(rem<=0) continue;
    const take=Math.min(rem,need);
    SB_PAYMENTS.push({id:'pay_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), invoiceId, agentId, amount:take, method:'deposit', depositId:dep.id, date:new Date().toISOString(), type:'deposit'});
    need-=take; applied+=take;
  }
  if(applied>0){ sbPaymentsPersist(); const bal=acctInvoiceBalance(inv); inv.status=bal<=0?'paid':'partial'; sbInvoicesPersist(); (inv.bookingIds||[]).forEach(id=>{const b=SB_BOOKINGS.find(x=>x.id===id);if(b)b.paymentStatus=(bal<=0?'paid':'partial');}); acctPersistBookings(); }
  return applied;
}
function acctPayUseDeposit(invId){
  const inv=SB_INVOICES.find(i=>i.id===invId); if(!inv) return;
  const amt=Math.min(acctInvoiceBalance(inv), acctAgentDepositAvail(inv.agentId));
  if(amt<=0){ alert('No deposit available'); return; }
  acctApplyDeposit(inv.agentId, invId, amt); acctModalClose(); renderAccounting();
}
function acctDepositOpen(presetAgent){ _acctDepAgent=presetAgent||''; acctDepositRender(); }
function acctDepositRender(){
  const aOpts=(SB_AGENTS||[]).map(a=>`<option value="${a.id}" ${a.id===_acctDepAgent?'selected':''}>${a.code?a.code+' · ':''}${a.name}</option>`).join('');
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700">รับมัดจำ (Deposit)</div>
      <button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      <label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">Agent</label>
      <select id="acct-dep-agent" style="width:100%;height:34px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:2px 8px;background:#fff;margin-bottom:12px"><option value="">— เลือก agent —</option>${aOpts}</select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">จำนวนเงิน</label>
          <input id="acct-dep-amt" type="number" min="0" placeholder="0" style="width:100%;height:34px;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;border:1px solid var(--fd-line);border-radius:8px;padding:2px 9px"></div>
        <div><label style="font-size:10.5px;color:var(--fd-ink-soft);display:block;margin-bottom:4px">วิธี</label>
          <select id="acct-dep-method" style="width:100%;height:34px;font-size:12px;font-family:inherit;border:1px solid var(--fd-line);border-radius:8px;padding:2px 6px;background:#fff"><option value="transfer">โอน</option><option value="cash">เงินสด</option><option value="card">บัตร</option></select></div></div>
      <input id="acct-dep-note" type="text" placeholder="หมายเหตุ (optional)" style="width:100%;height:34px;font-size:12px;border:1px solid var(--fd-line);border-radius:8px;padding:2px 9px;margin-bottom:14px">
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button onclick="acctModalClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">ยกเลิก</button>
        <button onclick="acctDepositSubmit()" style="background:#5B289A;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:600;padding:9px 18px;border-radius:9px;cursor:pointer">บันทึกมัดจำ</button></div>
    </div>`);
}
function acctDepositSubmit(){
  const ag=(document.getElementById('acct-dep-agent')||{}).value;
  const amt=+(document.getElementById('acct-dep-amt')||{}).value||0;
  const method=(document.getElementById('acct-dep-method')||{}).value||'transfer';
  const note=(document.getElementById('acct-dep-note')||{}).value||'';
  if(!ag){ alert('เลือก agent'); return; } if(amt<=0){ alert('ใส่จำนวนเงิน'); return; }
  acctCreateDeposit(ag, amt, method, note); acctModalClose(); renderAccounting();
}
// Per-agent statement
function acctStatementOpen(agentId){
  const a=sbGetAgent(agentId); if(!a) return;
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  const dt=s=>{ if(!s)return'—'; try{return new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(e){return s;} };
  const invs=SB_INVOICES.filter(i=>i.agentId===agentId && i.status!=='void');
  const totalInv=invs.reduce((s,i)=>s+(i.total||0),0);
  const totalPaid=invs.reduce((s,i)=>s+acctInvoicePaid(i),0);
  const outstanding=invs.reduce((s,i)=>s+acctInvoiceBalance(i),0);
  const depHeld=acctAgentDepositAvail(agentId);
  const cs=agCreditState(agentId);
  const invRows=invs.slice().sort((a,b)=>(b.issuedAt||'').localeCompare(a.issuedAt||'')).map(i=>`<tr style="border-top:0.5px solid var(--fd-line-soft)">
    <td style="padding:7px 8px;font-family:'DM Mono',monospace;font-size:11px">${i.number}</td>
    <td style="padding:7px 8px;font-size:10.5px;color:var(--fd-ink-soft)">${dt(i.issuedAt)}</td>
    <td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums">${fmt(i.total)}</td>
    <td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums;color:#0F6E56">${fmt(acctInvoicePaid(i))}</td>
    <td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums;color:${acctInvoiceBalance(i)>0?'#A05A1A':'var(--fd-ink-soft)'}">${fmt(acctInvoiceBalance(i))}</td>
    <td style="padding:7px 8px">${acctStateChip(acctInvoiceState(i))}</td></tr>`).join('') || '<tr><td colspan="6" style="padding:14px;color:var(--fd-ink-soft);font-style:italic;font-size:11px">ยังไม่มีใบแจ้งหนี้</td></tr>';
  const deps=SB_DEPOSITS.filter(d=>d.agentId===agentId);
  const depRows=deps.map(d=>`<tr style="border-top:0.5px solid var(--fd-line-soft)"><td style="padding:6px 8px;font-size:10.5px;color:var(--fd-ink-soft)">${dt(d.date)}</td><td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums">${fmt(d.amount)}</td><td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;color:#5B289A">${fmt(acctDepositRemaining(d))}</td><td style="padding:6px 8px;font-size:10px;color:var(--fd-ink-soft)">${d.note||''}</td></tr>`).join('');
  const stat=(lab,val,col)=>`<div style="flex:1;min-width:110px;background:#fafaf8;border-radius:9px;padding:9px 11px"><div style="font-size:9.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.04em">${lab}</div><div style="font-size:16px;font-weight:700;color:${col||'var(--fd-ink)'};font-variant-numeric:tabular-nums">${val}</div></div>`;
  acctModal(`
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:15px;font-weight:700">Statement · ${a.name}</div><div style="font-size:11px;color:var(--fd-ink-soft)">${a.code||''} · ${a.payType==='invoice'?'เครดิต':'Prepaid'}</div></div>
      <button onclick="acctModalClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>
    <div style="padding:16px 20px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        ${stat('Invoiced',fmt(totalInv))}${stat('Paid',fmt(totalPaid),'#0F6E56')}${stat('Outstanding',fmt(outstanding),'#A05A1A')}${stat('Deposit held',fmt(depHeld),'#5B289A')}
      </div>
      ${cs.mode==='invoice'&&cs.limit>0?`<div style="font-size:11.5px;color:var(--fd-ink-soft);margin-bottom:14px">Credit: ใช้ <strong style="color:#185FA5">${fmt(cs.used)}</strong> / ${fmt(cs.limit)} · เหลือ <strong style="color:#0F6E56">${fmt(cs.available)}</strong></div>`:''}
      <div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">Invoices</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px"><thead><tr style="background:#fafaf8"><th style="padding:6px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Invoice</th><th style="padding:6px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Issued</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Total</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Paid</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Bal</th><th style="padding:6px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Status</th></tr></thead><tbody>${invRows}</tbody></table>
      ${deps.length?`<div style="font-size:10px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">Deposits</div>
      <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#fafaf8"><th style="padding:6px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Date</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Amount</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Remaining</th><th style="padding:6px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Note</th></tr></thead><tbody>${depRows}</tbody></table>`:''}
      <div style="margin-top:16px;display:flex;justify-content:flex-end"><button onclick="acctDepositOpen('${a.id}')" style="background:#5B289A;color:#fff;border:none;font-family:inherit;font-size:11.5px;font-weight:600;padding:8px 15px;border-radius:9px;cursor:pointer">+ รับมัดจำ</button></div>
    </div>`);
}

// ════ ACCOUNTING P4 · money dashboard (aging · collection trend · top outstanding) ════
function acctDashboardHtml(){
  const fmt=n=>'฿'+Math.round(n||0).toLocaleString();
  const now=new Date();
  const live=SB_INVOICES.filter(i=>i.status!=='void');
  const buckets={cur:0,b30:0,b60:0,b90:0};
  live.forEach(i=>{ const bal=acctInvoiceBalance(i); if(bal<=0) return; const due=i.dueAt?new Date(i.dueAt):now; const days=Math.floor((now-due)/86400000); if(days<=0)buckets.cur+=bal; else if(days<=30)buckets.b30+=bal; else if(days<=60)buckets.b60+=bal; else buckets.b90+=bal; });
  const agMax=Math.max(1,buckets.cur,buckets.b30,buckets.b60,buckets.b90);
  const agRow=(lab,val,col)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:64px;font-size:10.5px;color:var(--fd-ink-soft)">${lab}</span><div style="flex:1;height:13px;background:#f1efe9;border-radius:4px;overflow:hidden"><div style="width:${Math.round(val/agMax*100)}%;height:100%;background:${col}"></div></div><span style="width:74px;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums">${fmt(val)}</span></div>`;
  const months=[]; for(let k=5;k>=0;k--){ const d=new Date(now.getFullYear(),now.getMonth()-k,1); months.push(d.toISOString().slice(0,7)); }
  const colByM=months.map(ym=>SB_PAYMENTS.filter(p=>p.type==='payment'&&(p.date||'').slice(0,7)===ym).reduce((s,p)=>s+(p.amount||0),0));
  const cMax=Math.max(1,Math.max.apply(null,colByM));
  const bars=months.map((ym,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;display:flex;align-items:flex-end;justify-content:center;height:68px"><div title="${fmt(colByM[i])}" style="width:62%;background:#1683C7;border-radius:3px 3px 0 0;height:${Math.max(2,Math.round(colByM[i]/cMax*68))}px"></div></div><span style="font-size:8.5px;color:var(--fd-ink-soft)">${ym.slice(5)}</span></div>`).join('');
  const byAg={}; live.forEach(i=>{ const bal=acctInvoiceBalance(i); if(bal<=0)return; byAg[i.agentId]=(byAg[i.agentId]||0)+bal; });
  const top=Object.keys(byAg).map(id=>({id,bal:byAg[id]})).sort((a,b)=>b.bal-a.bal).slice(0,5);
  const tMax=Math.max(1,Math.max.apply(null,top.map(t=>t.bal).concat([1])));
  const topRows=top.length?top.map(t=>{ const a=sbGetAgent(t.id); return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer" onclick="acctStatementOpen('${t.id}')"><span style="width:96px;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a?a.name:t.id}</span><div style="flex:1;height:12px;background:#f1efe9;border-radius:4px;overflow:hidden"><div style="width:${Math.round(t.bal/tMax*100)}%;height:100%;background:#A05A1A"></div></div><span style="width:70px;text-align:right;font-size:10.5px;font-variant-numeric:tabular-nums">${fmt(t.bal)}</span></div>`;}).join(''):'<div style="font-size:11px;color:var(--fd-ink-soft);font-style:italic">ไม่มียอดค้าง</div>';
  const card=(title,inner)=>`<div style="flex:1;min-width:250px;background:#fff;border:0.5px solid var(--fd-line-soft);border-radius:12px;padding:14px 16px"><div style="font-size:12px;font-weight:600;margin-bottom:11px">${title}</div>${inner}</div>`;
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    ${card('Receivables aging', agRow('Not due',buckets.cur,'#1D9E75')+agRow('1–30d',buckets.b30,'#D4A017')+agRow('31–60d',buckets.b60,'#D87A30')+agRow('60d+',buckets.b90,'#A32D2D'))}
    ${card('Collection · last 6 mo', `<div style="display:flex;gap:5px;align-items:flex-end">${bars}</div>`)}
    ${card('Top outstanding · agents', topRows)}
  </div>`;
}
function acctExtrasMonthTotal(){ const ym=new Date().toISOString().slice(0,7); return SB_EXTRAS.filter(e=>(e.date||'').slice(0,7)===ym).reduce((s,e)=>s+(e.total||0),0); }
function pfmViewSlips(bkId){
  const b = (SB_BOOKINGS||[]).find(x => x.id===bkId); if(!b) return;
  _pfmSlipBk = bkId;
  const old = document.getElementById('pfm-slipview'); if(old) old.remove();
  const ov = document.createElement('div'); ov.id='pfm-slipview';
  ov.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",sans-serif';
  ov.onmousedown = ev => { ov._d = (ev.target===ov); };
  ov.onclick = ev => { if(ev.target===ov && ov._d) pfmSlipsClose(); };
  document.body.appendChild(ov);
  pfmSlipsRender();
}
function pfmSlipsClose(){ _pfmSlipBk=null; const ov=document.getElementById('pfm-slipview'); if(ov) ov.remove(); if(typeof renderDailyPFM==='function') renderDailyPFM(); }
function pfmSlipsRender(){
  const ov = document.getElementById('pfm-slipview'); if(!ov || !_pfmSlipBk) return;
  const b = (SB_BOOKINGS||[]).find(x => x.id===_pfmSlipBk); if(!b) return;
  const ss = (b.paymentSlips||[]);
  const e = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const tot = ss.reduce((s,x)=> s + (+x.amount||0), 0);
  const _mac = (typeof _bkV2IsMac==='function') ? _bkV2IsMac() : true;
  const _shot = _mac ? 'Cmd+Shift+4' : 'Win+Shift+S', _paste = _mac ? 'Cmd+V' : 'Ctrl+V';
  const _one = ss.length===1;
  const kB = n => { n=+n||0; return n>=1048576 ? (n/1048576).toFixed(1)+' MB' : (n>=1024 ? Math.round(n/1024)+' KB' : n+' B'); };
  const ext = nm => { const m=String(nm||'').match(/\.([A-Za-z0-9]{1,6})$/); return m ? m[1].toUpperCase() : 'FILE'; };
  const bar = `<div style="display:flex;gap:7px;align-items:center">
      <label title="แนบไฟล์ · รูป / PDF / Excel / Word — ไฟล์อะไรก็ได้ (สูงสุด 6MB ต่อไฟล์)" style="display:inline-flex;align-items:center;gap:6px;background:#163d2b;color:#eafbe0;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer">&#128206; แนบไฟล์<input type="file" multiple style="display:none" onchange="pfmSlipsFromInput(this)"></label>
      <button type="button" title="แคปหน้าจอแล้วแนบเลย" onclick="pfmSlipsCapture()" style="display:inline-flex;align-items:center;gap:6px;background:#fff;color:#163d2b;border:0.5px solid #cfcabf;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#128421; แคปจอ</button>
      <button onclick="pfmSlipsClose()" style="border:0;background:#eee;color:#444;border-radius:8px;padding:7px 13px;font-size:12px;cursor:pointer;font-family:inherit">ปิด</button>
    </div>`;
  const empty = `<div style="grid-column:1/-1;border:1px dashed #d7dbe2;border-radius:12px;padding:34px 18px;text-align:center;color:#a8a69d">
      <div style="font-size:30px;margin-bottom:6px">&#129534;</div>
      <div style="font-size:13px;font-weight:600;color:#8b9a94">ยังไม่มีสลิปแนบ</div>
      <div style="font-size:11.5px;margin-top:4px">กด <b style="color:#163d2b">แนบไฟล์</b> · <b style="color:#163d2b">แคปจอ</b> · หรือถ่ายหน้าจอ (${_shot}) แล้วกด <b style="color:#163d2b">${_paste}</b> วางตรงนี้</div>
    </div>`;
  const cards = ss.map(s => {
    const url = '/api/attach/' + encodeURIComponent(s.id);
    const mime = String(s.mime||'');
    const isImg = /^image\//.test(mime), isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(s.name||'');
    const H = _one ? '66vh' : '42vh';
    let when=''; try{ if(s.at) when = new Date(s.at).toLocaleString('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(_){}
    /* ยอดเงิน 0 = สลิปที่แนบเพิ่มทีหลัง (ไม่ได้ผูกกับการบันทึกชำระครั้งไหน) */
    const amt = (+s.amount||0);
    const meta = [ amt>0 ? ('฿'+amt.toLocaleString()) : '<span style="color:#9a988f">แนบเพิ่มภายหลัง</span>', when, (s.by?e(s.by):''), (s.size?kB(s.size):'') ].filter(Boolean).join(' · ');
    const prev = isImg
      ? `<a href="${url}" target="_blank" rel="noopener" title="คลิกเพื่อเปิดเต็มจอ"><img src="${url}" style="width:100%;height:${H};min-height:260px;object-fit:contain;background:#f1efe9;display:block;cursor:zoom-in"></a>`
      : (isPdf
        ? `<iframe src="${url}#toolbar=0&navpanes=0" title="${e(s.name||'slip')}" style="width:100%;height:${H};min-height:260px;border:0;background:#f1efe9;display:block"></iframe>`
        : `<div style="height:${H};min-height:260px;background:#f1efe9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8a938d"><div style="font-size:34px">&#128196;</div><div style="font-size:11px;font-weight:700;letter-spacing:.06em;background:#e2e0d8;color:#5F5E5A;border-radius:6px;padding:3px 9px">${e(ext(s.name))}</div></div>`);
    return `<div style="border:1px solid #e3e6e1;border-radius:10px;overflow:hidden;background:#faf9f6">${prev}
      <div style="padding:8px 10px">
        <div style="font-size:11.5px;color:#3F4654;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e(s.name||'slip')}">${e(s.name||'slip')}</div>
        <div style="font-size:10.5px;color:#8b9a94;margin-top:2px">${meta}</div>
        <div style="display:flex;gap:5px;margin-top:7px">
          <a href="${url}" target="_blank" rel="noopener" style="flex:1;text-align:center;border:0.5px solid #cfcabf;border-radius:7px;padding:4px;font-size:11px;color:#185FA5;text-decoration:none">เปิดเต็ม &#8599;</a>
          <a href="${url}" download="${e(s.name||'slip')}" style="flex:1;text-align:center;border:0.5px solid #cfcabf;border-radius:7px;padding:4px;font-size:11px;color:#3F4654;text-decoration:none">ดาวน์โหลด</a>
          <button onclick="pfmSlipDelete('${e(s.id)}')" title="ลบสลิปนี้ทิ้ง (แนบผิด)" style="flex:none;border:0.5px solid #E6C9C3;background:#fff;color:#A32D2D;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">ลบ</button>
        </div>
      </div></div>`; }).join('');
  ov.innerHTML = `<div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;width:${_one?'760px':'1040px'};max-width:95vw;max-height:92vh;overflow:auto;padding:18px 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:12px">
      <div><div style="font-size:15px;font-weight:800;color:#15396B">สลิปการชำระเงิน${ss.length?(' · '+ss.length+' ไฟล์'):''}</div>
      <div style="font-size:11.5px;color:#8b9a94;margin-top:2px">${e(b.leadPax||'')} · ${e(b.voucherRef||b.id)}${tot>0?(' · รวม ฿'+tot.toLocaleString()):''}</div></div>
      ${bar}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px">${ss.length?cards:empty}</div>
  </div>`;
}
/* แนบไฟล์เพิ่มเข้าบุ๊กกิ้งโดยตรง (ไม่ผ่าน Record modal) · amount=0 = ไม่ผูกกับการชำระครั้งไหน */
function pfmSlipsAttach(file, kind){
  if(!_pfmSlipBk || !file) return;
  const bid = _pfmSlipBk;
  const post = (blob, mime, name) => {
    if(blob && blob.size > 6*1024*1024){ alert('ไฟล์ "'+name+'" ใหญ่เกิน 6MB · ย่อ/บีบอัดก่อน'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const b64 = String(fr.result).split(',')[1]||'';
      fetch('/api/attach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:bid,filename:name,mime:mime,dataB64:b64})})
        .then(r=>r.json()).then(j=>{
          if(j&&j.error){ alert('อัปโหลดไม่สำเร็จ: '+j.error); return; }
          const b=(SB_BOOKINGS||[]).find(x=>x.id===bid); if(!b) return;
          b.paymentSlips = Array.isArray(b.paymentSlips) ? b.paymentSlips : [];
          b.paymentSlips.push({ id:j.id, name:j.filename, mime:j.mime, size:j.size, kind:kind||'upload', amount:0, at:new Date().toISOString(), by:(typeof laBy==='function'?laBy():'') });
          try{ acctPersistBookings(); }catch(_){}
          if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','แนบสลิปเพิ่ม: '+(j.filename||''),'Payment');
          pfmSlipsRender();
        }).catch(err=>alert('อัปโหลดไม่สำเร็จ: '+err.message));
    };
    fr.readAsDataURL(blob);
  };
  if(/^image\//.test(file.type||'')){
    const dn = (typeof _bkV2DownscaleImage==='function') ? _bkV2DownscaleImage : function(f,m,cb){ cb(f,f.type); };
    dn(file, 1600, (bl,mi)=>{ if(bl) post(bl, mi, ((file.name||'slip').replace(/\.[^.]+$/,''))+'.jpg'); else post(file, file.type, file.name||'slip'); });
  } else post(file, file.type||'application/octet-stream', file.name||'file');
}
function pfmSlipsFromInput(inp){ const fs=(inp&&inp.files)?Array.prototype.slice.call(inp.files):[]; fs.forEach(f=>pfmSlipsAttach(f,'upload')); if(inp) inp.value=''; }
function pfmSlipsCapture(){
  if(!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)){ alert('เบราว์เซอร์นี้ไม่รองรับ Capture · ใช้ แนบไฟล์ หรือ วางรูป (Ctrl/Cmd+V) แทน'); return; }
  navigator.mediaDevices.getDisplayMedia({video:true}).then(stream=>{
    const v=document.createElement('video'); v.srcObject=stream; v.muted=true; v.play();
    setTimeout(()=>{ try{
      const c=document.createElement('canvas'); c.width=v.videoWidth||1280; c.height=v.videoHeight||720;
      c.getContext('2d').drawImage(v,0,0,c.width,c.height);
      stream.getTracks().forEach(t=>t.stop());
      c.toBlob(bl=>{ if(bl) pfmSlipsAttach(new File([bl],'slip-'+Date.now()+'.jpg',{type:'image/jpeg'}),'capture'); },'image/jpeg',0.9);
    }catch(_){ try{ stream.getTracks().forEach(t=>t.stop()); }catch(__){} } },350);
  }).catch(()=>{});
}
/* ลบสลิปที่แนบผิด · ต้องถอดออกจาก 3 ที่: ไฟล์จริงใน DB · b.paymentSlips · pay.slips ของ SB_PAYMENTS
   (ถ้าลืมตัวหลัง ใบเสร็จ/รายงานจะยังอ้างไฟล์ที่ถูกลบไปแล้ว → ลิงก์ตาย) */
function pfmSlipDelete(id){
  if(!_pfmSlipBk) return;
  const b=(SB_BOOKINGS||[]).find(x=>x.id===_pfmSlipBk); if(!b) return;
  const s=(b.paymentSlips||[]).find(x=>x.id===id);
  if(!confirm('ลบสลิป "'+((s&&s.name)||id)+'" ทิ้งถาวร?\n\nไฟล์จะถูกลบออกจากระบบ · ยอดเงินที่บันทึกไว้ไม่เปลี่ยน')) return;
  fetch('/api/attach/'+encodeURIComponent(id),{method:'DELETE'}).then(r=>r.json()).then(j=>{ if(j&&j.error) alert('ลบไฟล์บนเซิร์ฟเวอร์ไม่สำเร็จ: '+j.error); }).catch(()=>{});
  b.paymentSlips=(b.paymentSlips||[]).filter(x=>x.id!==id);
  try{ acctPersistBookings(); }catch(_){}
  let _touched=false;
  (typeof SB_PAYMENTS!=='undefined'?SB_PAYMENTS:[]).forEach(p=>{ if(Array.isArray(p.slips) && p.slips.some(x=>x.id===id)){ p.slips=p.slips.filter(x=>x.id!==id); _touched=true; } });
  if(_touched && typeof sbPaymentsPersist==='function'){ try{ sbPaymentsPersist(); }catch(_){} }
  if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','ลบสลิป: '+((s&&s.name)||id),'Payment');
  pfmSlipsRender();
}

// ══ Daily PFM · printable daily report — summary + payments + attached slips ══
// ══ Daily PFM · printable report (A4 landscape) ═══════════════════════════════
// Card-style summary + the FULL table (every on-screen column kept) + a slip column,
// then one detail card per attached slip (image + who/when/how much/which invoice).
function pfmPrintReport(){
  const date = _pfmDate, mode = _pfmMode || 'daily';
  const list = (typeof pfmBookingsForPeriod==='function') ? pfmBookingsForPeriod(date, mode) : [];
  if(!list.length){ alert('ไม่มีรายการในช่วงนี้'); return; }
  const e = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const B = n => '฿' + Math.round(+n||0).toLocaleString();
  const when = v => { try{ return v ? new Date(v).toLocaleString('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''; }catch(_){ return ''; } };
  // big, unmistakable date label for the report header
  const DLABEL = (function(){
    try{
      const D = new Date(date+'T12:00:00');
      const long = D.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      if(mode==='daily') return long;
      if(typeof pfmPeriodRange==='function'){
        const R = pfmPeriodRange(date, mode);
        const f = new Date(R.from+'T12:00:00'), t = new Date(R.to+'T12:00:00');
        const sh = x => x.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
        if(mode==='month') return D.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
        if(mode==='year')  return D.toLocaleDateString('th-TH',{year:'numeric'});
        return sh(f) + ' – ' + sh(t);
      }
      return long;
    }catch(_){ return date; }
  })();
  const MODETH = {daily:'รายวัน', week:'รายสัปดาห์', month:'รายเดือน', year:'รายปี'}[mode] || mode;

  let billed=0, collected=0, nPaid=0, nUnpaid=0, nNoInv=0;
  const rows=[], slipCards=[];

  list.forEach(b => {
    const ag  = ((typeof sbGetAgent==='function' ? sbGetAgent(b.agentId) : null) || {});
    const t   = (b.trips||[])[0] || {};
    const R   = ((typeof getRoute==='function' ? getRoute(t.routeId) : null) || {});
    const pax = (typeof bkV2PaxAllTot==='function') ? bkV2PaxAllTot(t.pax||{}) : 0;
    const inv = (typeof acctBookingInvoice==='function') ? acctBookingInvoice(b.id) : null;
    const tot = (typeof acctBookingTotal==='function') ? acctBookingTotal(b) : (b.total||0);
    const bal = inv ? ((typeof acctInvoiceBalance==='function') ? acctInvoiceBalance(inv) : 0) : tot;
    const paid = Math.max(0, tot - bal);
    const pct  = tot>0 ? Math.round(paid/tot*100) : 0;
    const ss   = (b.paymentSlips||[]);
    const pays = inv ? (SB_PAYMENTS||[]).filter(p => p.invoiceId===inv.id && p.type!=='refund') : [];

    if(inv){ billed += tot; collected += paid; if(bal<=0) nPaid++; else nUnpaid++; } else { billed += tot; nNoInv++; }

    const st = !inv ? {t:'ยังไม่ออกใบ', c:'#5F5E5A', bg:'#F1EFE8'}
             : bal<=0 ? {t:'จ่ายครบ',   c:'#0F6E56', bg:'#E1F5EE'}
             : paid>0 ? {t:'จ่ายบางส่วน', c:'#854F0B', bg:'#FAEEDA'}
             :          {t:'ค้างชำระ',  c:'#A32D2D', bg:'#FCEBEB'};

    rows.push({
      vc: b.voucherRef || b.code || b.id,
      agent: ag.name || b.agentId || '',
      sales: (typeof pfmSalesName==='function') ? (pfmSalesName(b)||'—') : '—',
      route: R.name || t.routeId || '',
      pax, tot, bal, paid, pct, st,
      slip: ss.length ? { n:ss.length, amt:ss.reduce((s,x)=>s+(+x.amount||0),0), at:ss[0].at, id:ss[0].id, mime:ss[0].mime } : null
    });

    ss.forEach(s => slipCards.push({
      ...s, lead:b.leadPax||'', agent:ag.name||'', vc:b.voucherRef||b.code||b.id,
      inv: inv ? inv.id : '—', settled: inv && bal<=0,
      method: (pays[0]&&pays[0].method) || '—', payRef: (pays[0]&&pays[0].ref) || ''
    }));
  });

  const outstanding = Math.max(0, billed - collected);
  const collPct = billed>0 ? Math.round(collected/billed*100) : 0;
  const overdue = rows.filter(r => r.bal>0 && r.st.t!=='ยังไม่ออกใบ').sort((a,b)=>b.bal-a.bal).slice(0,4);

  // ── page 1 · summary cards + full table ──
  let html = '<section class="pg">'
   + '<header><div><div class="ttl">Daily PFM <span class="sep">·</span> <span class="dt">'+e(DLABEL)+'</span></div>'
   +   '<div class="sub">รายงานการเก็บเงิน '+e(MODETH)+' · '+list.length+' booking</div></div>'
   +   '<div class="sub" style="text-align:right">พิมพ์ '+when(new Date())+'<br>ผู้จัดทำ ________________</div></header>'

   + '<div class="cards">'
   +   '<div class="c"><div class="ch">ความคืบหน้า</div>'
   +     '<div class="big">'+nPaid+'<span class="of"> / '+list.length+'</span></div>'
   +     '<div class="lg"><span><i class="d" style="background:#1D9E75"></i>จ่ายครบ <b>'+nPaid+'</b></span>'
   +     '<span><i class="d" style="background:#E24B4A"></i>ค้างชำระ <b>'+nUnpaid+'</b></span>'
   +     '<span><i class="d" style="background:#B4B2A9"></i>ยังไม่ออกใบ <b>'+nNoInv+'</b></span></div></div>'
   +   '<div class="c"><div class="ch">ยอดเรียกเก็บ</div>'
   +     '<div class="big">'+B(billed)+'</div>'
   +     '<div class="bar"><i style="width:'+collPct+'%"></i></div>'
   +     '<div class="lg2"><span class="ok">เก็บแล้ว '+B(collected)+'</span><span class="bad">ค้าง '+B(outstanding)+'</span></div>'
   +     '<div class="ft2">เก็บได้ <b>'+collPct+'%</b> ของยอดทั้งหมด</div></div>'
   +   '<div class="c"><div class="ch">ต้องรีบตาม</div>'
   +     '<div class="big bad">'+B(outstanding)+'</div>'
   +     (overdue.length ? '<div class="od">'+overdue.map(r=>'<div><span>'+e(r.agent)+'</span><b>'+B(r.bal)+'</b></div>').join('')+'</div>'
                         : '<div class="ft2">เก็บครบทุกรายการ</div>')
   +   '</div></div>'

   + '<table class="tb"><thead><tr>'
   +   '<th>VOUCHER</th><th>AGENT</th><th>SALES</th><th>ROUTE</th><th class="r">PAX</th>'
   +   '<th class="r">TOTAL</th><th class="r">BALANCE</th><th>STATUS</th><th>SLIP</th></tr></thead><tbody>'
   + rows.map(r =>
      '<tr><td class="mono">'+e(r.vc)+'</td><td>'+e(r.agent)+'</td><td>'+e(r.sales)+'</td><td>'+e(r.route)+'</td>'
      + '<td class="r">'+r.pax+'</td><td class="r mono">'+B(r.tot)+'</td>'
      + '<td class="r mono'+(r.bal>0?' bad':'')+'">'+B(r.bal)+'</td>'
      + '<td><span class="pill" style="color:'+r.st.c+';background:'+r.st.bg+'">'+r.st.t+'</span>'
      +   '<div class="pbar"><i style="width:'+Math.max(r.pct,2)+'%;background:'+(r.pct>=100?'#1D9E75':r.pct>0?'#EF9F27':'#E24B4A')+'"></i></div>'
      +   '<span class="pct">'+r.pct+'%</span></td>'
      + '<td>'+(r.slip
          ? '<div class="sl">'+(/^image\//.test(r.slip.mime||'')
              ? '<img src="/api/attach/'+encodeURIComponent(r.slip.id)+'" alt="">'
              : '<span class="sn">📄</span>')
            + '<div><b>'+B(r.slip.amt)+'</b>'+(r.slip.n>1?(' <span class="of">· '+r.slip.n+' ใบ</span>'):'')
            + '<br><span class="of">'+e(when(r.slip.at))+'</span></div></div>'
          : '<span class="nos">— ยังไม่มีสลิป —</span>')+'</td></tr>').join('')
   + '</tbody></table></section>';

  // ── slip detail cards · 2 per page ──
  for(let i=0; i<slipCards.length; i+=2){
    const chunk = slipCards.slice(i, i+2);
    html += '<section class="pg"><header><div><div class="ttl">สลิปการชำระเงิน <span class="sep">·</span> <span class="dt">'+e(DLABEL)+'</span></div>'
      + '<div class="sub">ใบที่ '+(i+1)+'–'+Math.min(i+2, slipCards.length)+' จาก '+slipCards.length+' ใบ</div></div>'
      + '<div class="sub" style="text-align:right">Daily PFM</div></header>'
      + '<div class="sgrid">' + chunk.map(s => {
          const url='/api/attach/'+encodeURIComponent(s.id);
          const isImg=/^image\//.test(s.mime||'');
          return '<div class="sc">'
           + (isImg ? '<div class="sim"><img src="'+url+'" alt=""></div>' : '<div class="sim nf">📄 '+e(s.name||'')+'</div>')
           + '<table class="dt">'
           +   '<tr><td>ลูกค้า</td><td>'+e(s.lead)+'</td></tr>'
           +   '<tr><td>เอเจ้น</td><td>'+e(s.agent)+'</td></tr>'
           +   '<tr><td>Voucher</td><td class="mono">'+e(s.vc)+'</td></tr>'
           +   '<tr><td>ยอดในสลิป</td><td><b>'+B(s.amount)+'</b></td></tr>'
           +   '<tr><td>วิธีชำระ</td><td>'+e(s.method)+(s.payRef?(' · '+e(s.payRef)):'')+'</td></tr>'
           +   '<tr><td>เวลาแนบ</td><td>'+e(when(s.at))+'</td></tr>'
           +   '<tr><td>บันทึกโดย</td><td>'+e(s.by||'—')+'</td></tr>'
           +   '<tr><td>ใบแจ้งหนี้</td><td class="mono">'+e(s.inv)+'</td></tr>'
           +   '<tr><td>ตัดยอด</td><td class="'+(s.settled?'ok':'bad')+'">'+(s.settled?'ครบแล้ว':'ยังไม่ครบ')+'</td></tr>'
           +   '<tr><td>ไฟล์</td><td class="of">'+e(s.name||'')+'</td></tr>'
           + '</table></div>';
        }).join('') + '</div></section>';
  }

  const css = '@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}'
   + 'body{margin:0;font-family:"DM Sans",-apple-system,system-ui,sans-serif;color:#1f2a24;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
   + '.pg{width:281mm;min-height:194mm;page-break-after:always;display:flex;flex-direction:column}.pg:last-child{page-break-after:auto}'
   + 'header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:3mm;border-bottom:1px solid #e3e1da}'
   + '.ttl{font-size:14pt;font-weight:700}.sub{font-size:8pt;color:#8b9a94;margin-top:1mm}'
   + '.ttl .dt{font-size:14pt;font-weight:700;color:#0F6E56}'
   + '.ttl .sep{color:#c9cec9;font-weight:400;margin:0 1mm}'
   + '.cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;margin:4mm 0}'
   + '.c{border:0.4mm solid #e6e3dc;border-radius:2.5mm;padding:3mm 3.5mm}'
   + '.ch{font-size:8.5pt;font-weight:600;color:#5F5E5A}'
   + '.big{font-size:19pt;font-weight:700;margin-top:1.5mm;line-height:1.1}.big .of{font-size:11pt;color:#a8b0aa;font-weight:400}'
   + '.bad{color:#A32D2D}.ok{color:#0F6E56}'
   + '.lg{display:flex;flex-direction:column;gap:1mm;margin-top:2.5mm;font-size:8pt;color:#5F5E5A}'
   + '.lg .d{display:inline-block;width:2mm;height:2mm;border-radius:50%;margin-right:1.5mm}'
   + '.bar{height:2.4mm;background:#F1EFE8;border-radius:1.2mm;overflow:hidden;margin-top:2.5mm}'
   + '.bar i{display:block;height:100%;background:#1D9E75;border-radius:1.2mm}'
   + '.lg2{display:flex;justify-content:space-between;font-size:8pt;margin-top:1.5mm}'
   + '.ft2{font-size:8pt;color:#8b9a94;margin-top:2mm;border-top:0.3mm solid #eceae4;padding-top:1.5mm}'
   + '.od{margin-top:2mm;display:flex;flex-direction:column;gap:1mm}'
   + '.od div{display:flex;justify-content:space-between;background:#FCEBEB;border-radius:1.5mm;padding:1mm 2mm;font-size:8pt;color:#791F1F}'
   + '.tb{width:100%;border-collapse:collapse;font-size:8pt}'
   + '.tb th{text-align:left;font-size:7pt;color:#8b9a94;font-weight:600;letter-spacing:.04em;border-bottom:0.4mm solid #d7d3ca;padding:2mm 1.5mm}'
   + '.tb td{padding:2mm 1.5mm;border-bottom:0.25mm solid #f0eee8;vertical-align:middle}'
   + '.tb .r{text-align:right}.mono{font-family:"DM Mono",ui-monospace,monospace}'
   + '.pill{display:inline-block;font-size:7pt;padding:0.6mm 2mm;border-radius:3mm;font-weight:600}'
   + '.pbar{height:1.6mm;background:#F1EFE8;border-radius:1mm;overflow:hidden;margin-top:1mm;width:22mm;display:inline-block;vertical-align:middle}'
   + '.pbar i{display:block;height:100%;border-radius:1mm}'
   + '.pct{font-size:7pt;color:#8b9a94;margin-left:1.5mm}'
   + '.sl{display:flex;align-items:center;gap:2mm}'
   + '.sl img{width:11mm;height:11mm;object-fit:cover;border:0.3mm solid #e6e3dc;border-radius:1.5mm;background:#f4f2ec}'
   + '.sl .sn{width:11mm;height:11mm;display:flex;align-items:center;justify-content:center;border:0.3mm solid #e6e3dc;border-radius:1.5mm;background:#f4f2ec}'
   + '.sl b{font-size:8pt}.of{color:#a8b0aa;font-size:7pt}'
   + '.nos{color:#b9beb8;font-size:7.5pt}'
   + '.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:4mm;flex:1;min-height:0}'
   + '.sc{border:0.4mm solid #e6e3dc;border-radius:2.5mm;padding:3mm;display:grid;grid-template-columns:1fr 62mm;gap:4mm;min-height:0}'
   + '.sim{border:0.3mm solid #e6e3dc;border-radius:2mm;background:#f4f2ec;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0}'
   + '.sim img{max-width:100%;max-height:100%;object-fit:contain}'
   + '.sim.nf{color:#8a938d;font-size:8pt;text-align:center;padding:3mm}'
   + '.dt{width:100%;border-collapse:collapse;font-size:8pt;align-self:start}'
   + '.dt td{padding:1.2mm 0;border-bottom:0.25mm solid #f0eee8;vertical-align:top}'
   + '.dt td:first-child{color:#8b9a94;width:22mm}.dt td:last-child{text-align:right}'
   + '@media screen{body{background:#e9e7e1;padding:8mm}.pg{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15);margin:0 auto 6mm;padding:8mm}}';

  const boot = '<' + 'script>window.onload=function(){var im=[].slice.call(document.images);var n=im.filter(function(x){return !x.complete;}).length;'
    + 'if(!n){setTimeout(function(){window.print();},350);return;}'
    + 'im.forEach(function(x){ if(x.complete) return; x.onload=x.onerror=function(){ if(--n<=0) setTimeout(function(){window.print();},350); }; });};<' + '/script>';

  const w = window.open('','_blank');
  if(!w){ alert('เบราว์เซอร์บล็อกป๊อปอัป · อนุญาต pop-up แล้วลองใหม่'); return; }
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Daily PFM '+e(date)+'</title><style>'+css+'</style></head><body>'+html+boot+'</body></html>');
  w.document.close();
}
