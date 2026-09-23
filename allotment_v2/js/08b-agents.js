// 08b-agents.js · Agents · sales team · add-on services · seed data
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

// ── Agent activity log (audit trail) · push {at,by,kind,text} to a.activity ──
// kind: 'created' | 'rate' | 'credit' | 'profile' | 'programs' | 'company' | 'sales' | 'contract' | 'note' | 'edit'
function agLog(agentId, kind, text){
  const a = (typeof sbGetAgent==='function') ? sbGetAgent(agentId) : (SB_AGENTS||[]).find(x=>x.id===agentId);
  if(!a || !text) return;
  if(!Array.isArray(a.activity)) a.activity = [];
  a.activity.push({ at:new Date().toISOString(), by:(window._rmUser||''), kind:kind||'edit', text:String(text) });
  if(a.activity.length>200) a.activity = a.activity.slice(-200);   // cap
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
}

// ── Apply default contract-info structure to all agents (so renderers don't break) ──
function _seedAgentContractDefaults(){
  SB_AGENTS.forEach(a=>{
    if(!a.contractStatus) a.contractStatus = 'active';
    if(!a.contractVersion) a.contractVersion = 'v2025-1';
    if(!a.programPeriods) a.programPeriods = (a.programs||[]).map(rId=>({
      routeId:rId,
      bookFrom:'2025-10-01', bookTo:'2026-09-30',
      travelFrom:'2025-10-01', travelTo:'2026-09-30',
      note:''
    }));
    if(!a.companyInfo) a.companyInfo = { legalName:a.name, tatLicense:'', address:'—', tel:a.phone||'—', hotline:'', fax:'', website:'' };
    if(!a.agentSignatory) a.agentSignatory = { name:a.contact||'—', designation:'Authorized Signatory', tel:a.phone||'', signedDate:'' };
    if(!a.bookingChannel) a.bookingChannel = { method:'Email', cutoff:'1 วันก่อน 18:00 น.', cancelPolicy:'< 1 day = 50% · No-show = 100%', email:'book@loveandaman.com', phone:'+66 88 765 4678' };
    if(typeof a.creditBalance !== 'number') a.creditBalance = Math.max(0, (a.creditLimit||0) - Math.floor((a.creditLimit||0)*0.3));

    // Derive contract validity dates from programPeriods
    if(!a.contractStart || !a.contractEnd){
      const allDates = (a.programPeriods||[]).flatMap(p=>[p.bookFrom,p.bookTo,p.travelFrom,p.travelTo]).filter(Boolean).sort();
      a.contractStart = a.contractStart || allDates[0] || '2025-10-01';
      a.contractEnd   = a.contractEnd   || allDates[allDates.length-1] || '2026-09-30';
    }
    if(!a.contractHistory) a.contractHistory = []; // array of archived snapshots
  });
}

// ── Add mock variety: a few agents have contracts about to expire / already expired ──
function _seedContractExpiryVariety(){
  const today = new Date('2026-09-02'); // Reference "now" relative to existing dates
  // Make a few agents expire soon
  const soonAgents = ['a01','a10','a30']; // Biblio Globus, Klook, Marriott Patong
  soonAgents.forEach(aid=>{
    const a = SB_AGENTS.find(x=>x.id===aid); if(!a) return;
    // Set contractEnd to ~25 days from today
    const end = new Date(today); end.setDate(end.getDate()+25);
    a.contractEnd = end.toISOString().slice(0,10);
  });
  // One agent expired
  const expired = SB_AGENTS.find(x=>x.id==='a40');
  if(expired){
    const end = new Date(today); end.setDate(end.getDate()-5);
    expired.contractEnd = end.toISOString().slice(0,10);
    expired.contractStatus = 'expired';
  }
  // Add fake history to ALL IN TRAVEL
  const allin = SB_AGENTS.find(x=>x.id==='a73');
  if(allin){
    allin.contractHistory = [
      {
        version:'v2024-1', archivedAt:'2025-09-30',
        contractStart:'2024-10-01', contractEnd:'2025-09-30',
        snapshot:{
          programPeriods:[
            {routeId:'r6',  bookFrom:'2024-10-01', bookTo:'2025-09-30', travelFrom:'2024-10-01', travelTo:'2025-09-30', note:''},
            {routeId:'r10', bookFrom:'2024-10-01', bookTo:'2025-09-30', travelFrom:'2024-10-01', travelTo:'2025-09-30', note:''},
            {routeId:'r11', bookFrom:'2024-10-01', bookTo:'2025-09-30', travelFrom:'2024-10-01', travelTo:'2025-09-30', note:''},
            {routeId:'r5',  bookFrom:'2024-10-01', bookTo:'2025-05-15', travelFrom:'2024-10-15', travelTo:'2025-05-15', note:'High Season Only'},
            {routeId:'r12', bookFrom:'2024-10-01', bookTo:'2025-05-15', travelFrom:'2024-10-15', travelTo:'2025-05-15', note:'High Season Only'},
          ],
          addonServices:[
            { svcId:'aos_ltb', variants:[
              { varId:'v_ltb_join',    selling:280,  net:180 },
              { varId:'v_ltb_private', selling:1400, net:1200 },
            ]},
            { svcId:'aos_van', variants:[
              { varId:'v_van_tublamu', selling:3300, net:3300 },
              { varId:'v_van_panwa',   selling:1900, net:1900 },
            ]},
          ],
          agentSignatory:{ name:'K. เจ้าคุณ', designation:'Authorized Signatory', tel:'083-303-6655', signedDate:'2024-10-05' },
        }
      },
      {
        version:'v2023-1', archivedAt:'2024-09-30',
        contractStart:'2023-10-01', contractEnd:'2024-09-30',
        snapshot:{
          programPeriods:[
            {routeId:'r6',  bookFrom:'2023-10-01', bookTo:'2024-09-30', travelFrom:'2023-10-01', travelTo:'2024-09-30', note:''},
            {routeId:'r10', bookFrom:'2023-10-01', bookTo:'2024-09-30', travelFrom:'2023-10-01', travelTo:'2024-09-30', note:''},
            {routeId:'r5',  bookFrom:'2023-10-01', bookTo:'2024-05-15', travelFrom:'2023-10-15', travelTo:'2024-05-15', note:'High Season Only'},
          ],
          addonServices:[
            { svcId:'aos_ltb', variants:[
              { varId:'v_ltb_join',    selling:250,  net:150 },
              { varId:'v_ltb_private', selling:1300, net:1100 },
            ]},
          ],
          agentSignatory:{ name:'K. เจ้าคุณ', designation:'Authorized Signatory', tel:'083-303-6655', signedDate:'2023-10-10' },
        }
      },
    ];
  }
}

// ── Pricing Matrix: prices[agentId][routeId][zone][paxType] ──
// paxType: adult-thai, adult-fr, child-thai, child-fr, infant-thai, infant-fr
// zone: PK, KL, NoTransfer
function _seedAgentPrices(){
  const prices = {};
  SB_AGENTS.forEach(ag=>{
    prices[ag.id] = {};
    (ag.programs||[]).forEach(rId=>{ /* UI-created agents have no programs array */
      const r = ROUTES.find(x=>x.id===rId);
      if(!r) return;
      // Base prices vary by market & route type
      const isWS = rId==='r12';           // whale shark - premium
      const isSurin = rId==='r6';         // surin - long distance
      const isPP = rId==='r10' || rId==='r9' || rId==='r7' || rId==='r8';
      // base adult thai (NoTransfer) by route
      let baseT = 1800;
      if(isWS) baseT = 3500;
      else if(isSurin) baseT = 2800;
      else if(isPP) baseT = 1500;
      else baseT = 2200; // similan default
      // market premium
      const mktMul = {ru:1.05, ota:1.15, ap:1.10, hpk:1.20, hkl:1.18, cpk:1.00, ckl:1.00, ww:1.12}[ag.market]||1;
      const adjT = Math.round(baseT*mktMul/10)*10;
      const adjF = Math.round(adjT*1.45/10)*10;  // foreigner usually higher
      prices[ag.id][rId] = {
        PK: {
          'adult-thai':adjT+200,'adult-fr':adjF+200,
          'child-thai':Math.round((adjT+200)*0.6/10)*10,'child-fr':Math.round((adjF+200)*0.6/10)*10,
          'infant-thai':0,'infant-fr':0
        },
        KL: {
          'adult-thai':adjT+100,'adult-fr':adjF+100,
          'child-thai':Math.round((adjT+100)*0.6/10)*10,'child-fr':Math.round((adjF+100)*0.6/10)*10,
          'infant-thai':0,'infant-fr':0
        },
        NoTransfer: {
          'adult-thai':adjT,'adult-fr':adjF,
          'child-thai':Math.round(adjT*0.6/10)*10,'child-fr':Math.round(adjF*0.6/10)*10,
          'infant-thai':0,'infant-fr':0
        }
      };
    });
  });
  return prices;
}

// Agent credit · used = confirmed (non-cancelled) credit-mode bookings not yet fully paid
function agCreditState(agentId){
  const a=(typeof sbGetAgent==='function')?sbGetAgent(agentId):null;
  const limit=(a&&a.creditLimit)||0;
  let used=0;
  if(a && a.payType==='invoice'){
    (SB_BOOKINGS||[]).forEach(bk=>{
      if(bk.agentId!==agentId) return;
      if(ACCT_PAID_STATES.includes(bk.status)) return;
      if(bk.status==='quote' || bk.status==='draft') return;  // not yet committed
      if(acctBookingPaid(bk)) return;                          // paid → credit restored
      used += acctBookingTotal(bk);
    });
  }
  return { limit, used, available: limit-used, pct: limit>0?Math.round(used/limit*100):0, mode: a?a.payType:null };
}

function _agImpClean(v){
  if(v==null) return '';
  return String(v).replace(/\r/g,'').replace(/\n+/g,', ').replace(/\s+/g,' ').trim();
}
function _agImpEmail(v){
  const s=_agImpClean(v).replace(/\s+/g,'');                 // "andreevaCO@yandex. Ru" → strip inner spaces
  if(!s) return '';
  return /^[^@]+@[^@]+\.[^@]+$/.test(s) ? s.toLowerCase() : s.toLowerCase();
}
function _agImpNorm(s){
  return String(s||'').toLowerCase()
    .replace(/\(([^)]*)\)/g,' $1 ')                          // brand often lives in brackets
    .replace(/\b(co|company|ltd|limited|llc|inc|dmc|thailand)\b\.?/g,' ')
    .replace(/[^a-z0-9฀-๿]+/g,' ').trim().replace(/\s+/g,' ');   // §เก็บอักษรไทยไว้ · เดิม [^a-z0-9] ลบไทยทิ้งหมด → ชื่อไทยล้วน normalize เป็น "" แล้ว match มั่วทุกแถว
}
function _agImpKeys(src){
  const out=new Set();
  [src.name, (src.companyInfo&&src.companyInfo.legalName)].filter(Boolean).forEach(v=>{
    out.add(_agImpNorm(v));
    (String(v).match(/\(([^)]+)\)/g)||[]).forEach(x=>out.add(_agImpNorm(x)));
    out.add(_agImpNorm(String(v).replace(/\([^)]*\)/g,'')));
  });
  return [...out].filter(k=>k && k.length>2);
}
function _agImpFind(src){
  if(src.code){ const byCode=(SB_AGENTS||[]).find(a=>(a.code||'').toLowerCase()===String(src.code).toLowerCase()); if(byCode) return byCode; }
  const ks=_agImpKeys(src);
  const cks=[...new Set(ks.map(k=>k.replace(/\s+/g,'')).filter(k=>k.length>2))];   // §compact keys · ตัดเว้นวรรค/เครื่องหมายออกหมด → "Hana Tour" = "HANATOUR"
  const full=_agImpNorm(src.name||''); const fullC=full.replace(/\s+/g,'');
  return (SB_AGENTS||[]).find(a=>{ const n=_agImpNorm(a.name); if(!n) return false; const nc=n.replace(/\s+/g,'');
    if(ks.some(k => k && k===n)) return true;    // §exact match (มีเว้นวรรค · รวม brand ในวงเล็บ)
    if(cks.some(k => k && k===nc)) return true;   // §exact แบบตัดเว้นวรรค → กัน "HANATOUR" vs "Hana Tour" หลุดเป็นคนละเจ้า
    // §fuzzy · เข้มขึ้น: เทียบสตริง compact + ตัวสั้นต้อง ≥85% ของตัวยาว (เดิม 60% ทำให้ "HANATOUR TD" ≈ "Hana Tour" · ข้ามบริษัทมั่ว)
    if(fullC.length>4 && nc.length>4){ const sh=fullC.length<nc.length?fullC:nc, lo=fullC.length<nc.length?nc:fullC;
      if(lo.indexOf(sh)>=0 && (sh.length/lo.length)>=0.85) return true; }
    return false;
  }) || null;
}
function _agImpCode(name){
  let base=String(name||'AG').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8) || 'AGENT';
  let c=base, i=1;
  while((SB_AGENTS||[]).some(a=>(a.code||'').toUpperCase()===c)) c = base.slice(0,7)+(i++);
  return c;
}
function _agImpSales(v){
  const s=_agImpClean(v); if(!s) return '';
  const hit=(SB_SALES||[]).find(x=>(x.name||'').toLowerCase()===s.toLowerCase() || (x.code||'').toLowerCase()===s.toLowerCase());
  return hit ? hit.id : '';
}
/* §rtImpCode · จับคู่เรทตอนนำเข้า Agent · ห้ามเดา
   ของเดิมใช้ find() ตัวแรกที่เจอ ไม่ว่าจะเจอกี่ตัว · และยอมชนกันได้ทั้ง code และ name
   ของจริงมีเรท 5 ชุดใช้โค้ด RT-NANA เหมือนกัน ราคาต่างกันถึง 900 บาท/คน
   ลำดับใน SB_RATE_TYPES มาจากลำดับแถวใน Postgres ซึ่งไม่การันตี — ไฟล์เดิมนำเข้าคนละวันจึงได้คนละเรท
   กติกาใหม่ · id ก่อน → ชื่อ (ต้องตรงตัวเดียว) → โค้ด (ต้องตรงตัวเดียว)
   ถ้ากำกวม คืนค่าว่างพร้อมเหตุผล ให้หน้าพรีวิวขึ้นเตือน แล้วคนเลือกเองทีหลัง ดีกว่าผูกผิดเงียบ ๆ */
function _agImpRate(v, note){
  const s=_agImpClean(v); if(!s) return '';
  const L=(SB_RATE_TYPES||[]);
  const byId = L.filter(x=>x.id===s);
  if(byId.length===1) return byId[0].id;
  const low = s.toLowerCase();
  const byName = L.filter(x=>String(x.name||'').trim().toLowerCase()===low);
  if(byName.length===1) return byName[0].id;
  const byCode = L.filter(x=>String(x.code||'').trim().toLowerCase()===low);
  if(byCode.length===1) return byCode[0].id;
  const amb = byName.length>1 ? byName : (byCode.length>1 ? byCode : null);
  if(note){
    note.rateAmb = amb
      ? { txt:s, names:amb.map(x=>x.name||x.id) }          // ตรงหลายตัว · ต้องเลือกเอง
      : { txt:s, names:[] };                                // ไม่ตรงสักตัว · สะกดผิดหรือยังไม่มีเรทนี้
  }
  return '';
}
function _agImpPrograms(v){
  const s=_agImpClean(v); if(!s) return null;
  const ids=s.split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean)
    .map(x=>{ if((ROUTES||[]).some(r=>r.id===x)) return x;
              const r=(ROUTES||[]).find(r=>(r.name||'').toLowerCase()===x.toLowerCase()); return r?r.id:null; })
    .filter(Boolean);
  return ids.length ? [...new Set(ids)] : null;
}

// Map ONE spreadsheet row → a clean agent-shaped object (only fields the file actually filled)
function _agImpRow(o, note){
  const g=k=>o[k]!==undefined?o[k]:o[k+'*'];
  const src={};
  const name=_agImpClean(g('name')); if(name) src.name=name;
  const code=_agImpClean(g('code')); if(code) src.code=code.toUpperCase();
  const mk=_agImpClean(g('market')).toLowerCase(); if(mk) src.market=mk;
  const sub=_agImpClean(g('sub')); if(sub) src.sub=sub;
  const sl=_agImpSales(g('sales')); if(sl) src.sales=sl;
  const pt=_agImpClean(g('payType')).toLowerCase(); if(pt) src.payType=pt;
  const cd=g('creditDays'); if(cd!==''&&cd!=null&&!isNaN(+cd)) src.creditDays=+cd;
  const cl=g('creditLimit'); if(cl!==''&&cl!=null&&!isNaN(+cl)) src.creditLimit=+cl;
  const vm=_agImpClean(g('vatMode')).toLowerCase(); if(vm) src.vatMode=vm;
  const pg=_agImpPrograms(g('programs')); if(pg) src.programs=pg;
  const rt=_agImpRate(g('rateType'), note); if(rt) src.rateTypeId=rt;
  ['contact','note'].forEach(f=>{ const v=_agImpClean(g(f)); if(v) src[f]=v; });
  const em=_agImpEmail(g('email')); if(em) src.email=em;
  const ph=_agImpClean(g('phone')); if(ph) src.phone=ph;
  // company block → nested (the only shape the app + DB actually store)
  const ci={};
  AGIMP_CI.forEach(f=>{ const v=_agImpClean(g(f)); if(v) ci[f]=v; });
  if(Object.keys(ci).length) src.companyInfo=ci;
  return src;
}
function agImportTemplate(){
  if(typeof XLSX==='undefined'){ alert('ตัวอ่าน Excel (SheetJS) ยังไม่โหลด · เช็คอินเทอร์เน็ตแล้วรีเฟรช'); return; }
  const salesList=(SB_SALES||[]).map(s=>s.name||s.code).filter(Boolean).join(' / ')||'(ยังไม่มี Sales)';
  const rateList=(SB_RATE_TYPES||[]).map(r=>r.code||r.name).filter(Boolean).slice(0,12).join(' / ')||'(ยังไม่มี Rate Type)';
  const progList=(ROUTES||[]).map(r=>r.id).filter(Boolean).join(' / ')||'(ยังไม่มีโปรแกรม)';
  const example={
    name:'Sample Travel Co., Ltd', code:'SAMPLE', market:'ru', sub:'', sales:(SB_SALES&&SB_SALES[0]&&(SB_SALES[0].name||SB_SALES[0].code))||'', payType:'invoice',
    creditDays:30, creditLimit:200000, vatMode:'exclude', programs:((ROUTES&&ROUTES[0]&&ROUTES[0].id)||'')+((ROUTES&&ROUTES[1])?', '+ROUTES[1].id:''),
    rateType:(SB_RATE_TYPES&&SB_RATE_TYPES[0]&&(SB_RATE_TYPES[0].code||SB_RATE_TYPES[0].name))||'', contact:'Ivan Petrov', email:'sales@sample.com', phone:'+66 80 000 0000',
    legalName:'Sample Travel Company Limited', taxId:'0105500000000', tatLicense:'11/00000', address:'123 Beach Rd, Patong, Phuket 83150', tel:'076 000 000', hotline:'', fax:'', website:'www.sample.com', note:'ตัวอย่าง — ลบแถวนี้ออกก่อนนำเข้าได้'
  };
  const header={}; AGIMP_COLS.forEach(c=>header[c]='');
  const wsAgents=XLSX.utils.json_to_sheet([example], {header:AGIMP_COLS});
  wsAgents['!cols']=AGIMP_COLS.map(c=>({wch: c==='address'?34 : (c==='legalName'||c==='email'||c==='note')?26 : Math.max(11,c.length+2)}));
  const guide=[
    ['คอลัมน์','ต้องกรอกไหม','ความหมาย','ค่าที่รับได้ / ตัวอย่าง'],
    ['name','จำเป็น','ชื่อ Agent (ใช้จับคู่ของเดิม แถวไม่มีชื่อจะถูกข้าม)','เช่น Sample Travel Co., Ltd'],
    ['code','แนะนำ','รหัส Agent (ใช้จับคู่แม่นสุด · ไม่ใส่ระบบสร้างให้)','ตัวอักษร/ตัวเลข เช่น SAMPLE'],
    ['market','','ตลาด','รหัสตลาด เช่น ru / cn / en'],
    ['sub','','ตลาดย่อย / หมายเหตุกลุ่ม','ข้อความอิสระ'],
    ['sales','','Sales Person ผู้ดูแล (จับคู่ตามชื่อหรือรหัส)', salesList],
    ['payType','','ประเภทการชำระเงิน','invoice / proforma / cash'],
    ['creditDays','','เครดิต (วัน)','ตัวเลข เช่น 30'],
    ['creditLimit','','วงเงินเครดิต','ตัวเลข เช่น 200000'],
    ['vatMode','','โหมด VAT','none / exclude / include'],
    ['programs','','โปรแกรมที่ขาย (คั่นด้วย , )', progList],
    ['rateType','','Rate Type (จับคู่ตามรหัสหรือชื่อ)', rateList],
    ['contact','','ชื่อผู้ติดต่อ','ข้อความอิสระ'],
    ['email','','อีเมล','sales@sample.com'],
    ['phone','','เบอร์โทร','+66 ...'],
    ['legalName','','ชื่อนิติบุคคล (บริษัท)','สำหรับใบกำกับ/สัญญา'],
    ['taxId','','เลขผู้เสียภาษี','13 หลัก'],
    ['tatLicense','','เลขใบอนุญาต ททท.',''],
    ['address','','ที่อยู่บริษัท',''],
    ['tel','','โทรบริษัท',''],
    ['hotline','','ฮอตไลน์',''],
    ['fax','','แฟกซ์',''],
    ['website','','เว็บไซต์',''],
    ['note','','หมายเหตุ',''],
    ['','','',''],
    ['วิธีใช้','','',''],
    ['1) กรอกข้อมูลในชีต "Agents" (1 แถว = 1 Agent) ลบแถวตัวอย่างออกได้','','',''],
    ['2) กลับมากดปุ่ม "นำเข้า Excel" ในหน้า Agent List','','',''],
    ['3) ระบบจะจับคู่ Agent เดิมให้อัตโนมัติ (อัปเดต ไม่สร้างซ้ำ) · ค่าว่างจะไม่ทับของเดิม','','',''],
    ['* คอลัมน์ที่ระบบไม่รู้จักจะถูกข้าม ไม่ต้องลบหัวคอลัมน์','','','']
  ];
  const wsGuide=XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols']=[{wch:16},{wch:12},{wch:40},{wch:46}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsAgents, 'Agents');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Notes');
  XLSX.writeFile(wb, 'LOVE_Andaman_Agent_Import_Template.xlsx');
}

function agImportPick(){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('sales')) return;
  if(typeof XLSX==='undefined'){ alert('ตัวอ่าน Excel (SheetJS) ยังไม่โหลด · เช็คอินเทอร์เน็ตแล้วรีเฟรช'); return; }
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(f) agImportFile(f); };
  inp.click();
}

function agImportFile(file){
  const rd=new FileReader();
  rd.onload=e=>{
    let raw=[];
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const shName = wb.SheetNames.find(n=>/agent/i.test(n)) || wb.SheetNames[0];
      raw = XLSX.utils.sheet_to_json(wb.Sheets[shName], {defval:''});
    }catch(err){ alert('อ่านไฟล์ไม่ได้: '+err.message); return; }
    if(!raw.length){ alert('ไม่พบข้อมูลในไฟล์'); return; }

    const rows=[];
    raw.forEach((o,i)=>{
      const note={};
      const src=_agImpRow(o, note);
      if(!src.name) return;                                  // skip blank lines
      const match=_agImpFind(src);
      /* §rtImpCode · แถวที่ระบุเรทไว้แต่จับคู่ไม่ได้แน่ชัด · ไม่ผูกให้ แต่ต้องขึ้นให้เห็นในพรีวิว */
      rows.push({ n:i+2, src, match, action: match?'update':'create', checked:true, rateAmb: note.rateAmb||null });
    });
    if(!rows.length){ alert('ไม่พบแถวที่มีชื่อเอเจ้น (คอลัมน์ name)'); return; }
    _agImp={ rows, overwrite:false, fileName:file.name };
    agImportComputeWrites();
    agImportRender();
  };
  rd.readAsArrayBuffer(file);
}

// Which fields would actually be written for each row (depends on the overwrite toggle)
function agImportComputeWrites(){
  if(!_agImp) return;
  _agImp.rows.forEach(r=>{
    if(r.action==='create'){ r.writes=Object.keys(r.src); return; }
    const a=r.match, w=[];
    const consider = (path, val)=>{
      const cur=_agGet(a, path);
      const empty = cur==null || cur==='' || cur==='—' || (Array.isArray(cur)&&!cur.length);
      if(JSON.stringify(cur)===JSON.stringify(val)) return;
      if(empty || _agImp.overwrite) w.push(path);
    };
    Object.keys(r.src).forEach(f=>{
      if(f==='name') return;                                 // never rename an existing agent
      if(f==='sales') return;                                // §ล็อกเจ้าของ · import ห้ามเปลี่ยน sales ของ agent เดิม (กันแย่งลูกค้าข้ามเซลล์ · แม้ติ๊กทับข้อมูล)
      if(f==='companyInfo'){ Object.keys(r.src.companyInfo).forEach(k=>consider('companyInfo.'+k, r.src.companyInfo[k])); return; }
      consider(f, r.src[f]);
    });
    r.writes=w;
    // §เตือน · agent เดิมเป็นของเซลล์อื่น แต่ไฟล์ระบุเซลล์ใหม่ → conflict (จะไม่ย้ายเจ้าของ · แค่เตือน)
    r.ownerConflict = !!(a && a.sales && r.src.sales && a.sales !== r.src.sales);
    r.ownerSalesId  = (a && a.sales) || '';
  });
}

function agImportSetOverwrite(v){ if(!_agImp) return; _agImp.overwrite=!!v; agImportComputeWrites(); agImportRender(); }
function agImportToggle(i){ if(!_agImp) return; const r=_agImp.rows[i]; if(r) r.checked=!r.checked; agImportRender(); }
function agImportAll(v){ if(!_agImp) return; _agImp.rows.forEach(r=>r.checked=!!v); agImportRender(); }
function agImportClose(){ _agImp=null; const m=document.getElementById('agimp-modal'); if(m) m.remove(); }

function agImportRender(){
  if(!_agImp) return;
  const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const _snm=id=>{const s=(typeof SB_SALES!=='undefined'?SB_SALES:[]).find(x=>x.id===id);return s?(s.name||s.code||id):id;};
  const R=_agImp.rows;
  const nNew=R.filter(r=>r.action==='create').length;
  const nUpd=R.filter(r=>r.action==='update').length;
  const nConf=R.filter(r=>r.ownerConflict).length;
  const nRateAmb=R.filter(r=>r.rateAmb).length;   /* §rtImpCode */
  const nSel=R.filter(r=>r.checked && (r.action==='create' || r.writes.length)).length;
  const nSkip=R.filter(r=>r.action==='update' && !r.writes.length).length;

  const body = R.map((r,i)=>{
    const isNew=r.action==='create';
    const nothing = !isNew && !r.writes.length;
    const badge = isNew
      ? '<span style="font-size:10px;font-weight:700;color:#0F6E56;background:#E1F5EE;border-radius:9px;padding:2px 8px">ใหม่ · สร้าง</span>'
      : nothing
        ? '<span style="font-size:10px;font-weight:700;color:#5F5E5A;background:#F1EFE8;border-radius:9px;padding:2px 8px">มีแล้ว · ไม่มีอะไรเปลี่ยน</span>'
        : '<span style="font-size:10px;font-weight:700;color:#854F0B;background:#FAEEDA;border-radius:9px;padding:2px 8px">มีแล้ว · อัปเดต '+r.writes.length+' ช่อง</span>';
    const chips = (r.writes||[]).map(f=>{
      const doc=AGIMP_DOCF.indexOf(f)>=0;
      return '<span style="font-size:9.5px;color:'+(doc?'#185FA5':'#7A4A00')+';background:'+(doc?'#E6F1FB':'#FAEEDA')+';border-radius:7px;padding:1px 6px;margin:0 3px 3px 0;display:inline-block">'+e(f)+'</span>';
    }).join('') || '<span style="font-size:10px;color:#b9beb8">—</span>';
    return '<tr style="border-top:1px solid #f1efe9;'+(nothing?'opacity:.55':'')+'">'
      +'<td style="padding:7px 6px"><input type="checkbox" '+(r.checked?'checked':'')+' '+(nothing?'disabled':'')+' onchange="agImportToggle('+i+')"></td>'
      +'<td style="padding:7px 6px;font-size:11px;color:#98a29c">'+r.n+'</td>'
      +'<td style="padding:7px 6px"><div style="font-size:12px;font-weight:600;color:#2b3a34">'+e(r.src.name)+'</div>'
        +(r.match?'<div style="font-size:10.5px;color:#98a29c">→ ตรงกับ <b>'+e(r.match.name)+'</b> ['+e(r.match.market||'')+']</div>':'')
        +(r.ownerConflict?'<div style="font-size:10px;font-weight:700;color:#A32D2D;background:#FCEBEB;border-radius:6px;padding:2px 8px;margin-top:3px;display:inline-block">⚠ เป็นของเซลล์ '+e(_snm(r.ownerSalesId))+' อยู่แล้ว · ไม่ย้ายเจ้าของ</div>':'')
        /* §rtImpCode · จับคู่เรทไม่ได้แน่ชัด · ไม่ผูกให้ · ต้องเห็นก่อนกดนำเข้า ไม่ใช่รู้ทีหลังตอนราคาออกมาผิด */
        +(r.rateAmb?'<div style="font-size:10px;font-weight:700;color:#8A5410;background:#FDF3E4;border-radius:6px;padding:2px 8px;margin-top:3px;display:inline-block">⚠ Rate "'+e(r.rateAmb.txt)+'" '+(r.rateAmb.names.length?('ตรงกับ '+r.rateAmb.names.length+' ชุด ('+e(r.rateAmb.names.slice(0,3).join(' · '))+') · ไม่ผูกให้'):'ไม่ตรงกับเรทไหนเลย')+'</div>':'')+'</td>'
      +'<td style="padding:7px 6px">'+badge+'</td>'
      +'<td style="padding:7px 6px">'+chips+'</td></tr>';
  }).join('');

  const old=document.getElementById('agimp-modal'); if(old) old.remove();
  const ov=document.createElement('div'); ov.id='agimp-modal';
  ov.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",sans-serif';
  ov.onclick=ev=>{ if(ev.target===ov) agImportClose(); };
  ov.innerHTML='<div style="background:#fff;border-radius:14px;width:1000px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;padding:16px 18px">'
   +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
     +'<div><div style="font-size:16px;font-weight:800;color:#15396B">นำเข้า Agent จาก Excel</div>'
     +'<div style="font-size:11.5px;color:#8b9a94;margin-top:2px">'+e(_agImp.fileName)+' · '+R.length+' แถว &nbsp;·&nbsp; '
       +'<b style="color:#0F6E56">ใหม่ '+nNew+'</b> &nbsp; <b style="color:#854F0B">มีอยู่แล้ว '+nUpd+'</b>'+(nConf?' &nbsp; <b style="color:#A32D2D">⚠ เป็นของเซลล์อื่น '+nConf+'</b>':'')+(nRateAmb?' &nbsp; <b style="color:#8A5410">⚠ จับคู่เรทไม่ได้ '+nRateAmb+'</b>':'')
       +(nSkip?' &nbsp; <span style="color:#98a29c">ไม่มีอะไรเปลี่ยน '+nSkip+'</span>':'')+'</div></div>'
     +'<button onclick="agImportClose()" style="border:0;background:#eee;color:#444;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit">ปิด</button></div>'

   +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#faf9f6;border:1px solid #eee9e0;border-radius:10px;padding:9px 12px;margin-bottom:10px">'
     +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" '+(_agImp.overwrite?'checked':'')+' onchange="agImportSetOverwrite(this.checked)"><b>ทับข้อมูลเดิม</b> <span style="color:#98a29c">(ไม่ติ๊ก = เติมเฉพาะช่องที่ยังว่าง · ปลอดภัยกว่า)</span></label>'
     +'<div style="flex:1"></div>'
     +'<button onclick="agImportAll(true)" style="border:1px solid #cfcabf;background:#fff;border-radius:7px;padding:4px 10px;font-size:11.5px;cursor:pointer;font-family:inherit">เลือกทั้งหมด</button>'
     +'<button onclick="agImportAll(false)" style="border:1px solid #cfcabf;background:#fff;border-radius:7px;padding:4px 10px;font-size:11.5px;cursor:pointer;font-family:inherit">ไม่เลือกเลย</button>'
   +'</div>'

   +'<div style="flex:1;overflow:auto;border:1px solid #eee9e0;border-radius:10px">'
     +'<table style="width:100%;border-collapse:collapse">'
     +'<thead style="position:sticky;top:0;background:#f7f6f2;z-index:1"><tr>'
       +'<th style="padding:8px 6px;width:32px"></th>'
       +'<th style="padding:8px 6px;text-align:left;font-size:10.5px;color:#98a29c;font-weight:600">แถว</th>'
       +'<th style="padding:8px 6px;text-align:left;font-size:10.5px;color:#98a29c;font-weight:600">ชื่อในไฟล์</th>'
       +'<th style="padding:8px 6px;text-align:left;font-size:10.5px;color:#98a29c;font-weight:600">สถานะ</th>'
       +'<th style="padding:8px 6px;text-align:left;font-size:10.5px;color:#98a29c;font-weight:600">ช่องที่จะเขียน</th>'
     +'</tr></thead><tbody>'+body+'</tbody></table></div>'

   +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">'
     +'<div style="font-size:11.5px;color:#8b9a94">จะดำเนินการ <b style="color:#15396B">'+nSel+'</b> แถว · เอเจ้นที่มีอยู่จะถูก <b>อัปเดต</b> ไม่สร้างซ้ำ</div>'
     +'<button onclick="agImportApply()" '+(nSel?'':'disabled')+' style="border:0;background:'+(nSel?'#1C4A30':'#c9cec9')+';color:#fff;border-radius:9px;padding:9px 18px;font-size:13px;font-weight:700;cursor:'+(nSel?'pointer':'not-allowed')+';font-family:inherit">ยืนยันนำเข้า '+nSel+' แถว</button>'
   +'</div></div>';
  document.body.appendChild(ov);
}

function agImportApply(){
  if(!_agImp) return;
  const todo=_agImp.rows.filter(r=>r.checked && (r.action==='create' || (r.writes||[]).length));
  if(!todo.length) return;
  let created=0, updated=0, fields=0;
  todo.forEach(r=>{
    if(r.action==='create'){
      const a={ id: (typeof LA_UID==='function'?LA_UID('a'):'a'+Date.now().toString(36)),
                code: r.src.code || _agImpCode(r.src.name), programs: [], ...r.src };
      a.companyInfo = Object.assign({legalName:'',taxId:'',tatLicense:'',address:'',tel:'',hotline:'',fax:'',website:''}, r.src.companyInfo||{});
      if(!a.companyInfo.legalName) a.companyInfo.legalName = a.name;
      if(!a.code) a.code=_agImpCode(a.name);
      SB_AGENTS.push(a); created++; fields+=Object.keys(r.src).length;
    } else {
      const a=r.match;
      r.writes.forEach(p=>{
        if(p.indexOf('companyInfo.')===0){
          const k=p.slice('companyInfo.'.length);
          a.companyInfo = a.companyInfo || {};               // merge — keep sub-fields the file didn't supply
          a.companyInfo[k] = r.src.companyInfo[k];
        } else { a[p]=r.src[p]; }
        fields++;
      });
      updated++;
    }
  });
  try{ sbAgentsPersist(); }catch(e){ console.warn('persist agents failed', e); }
  agImportClose();
  if(typeof renderAgents==='function') renderAgents();
  if(typeof laSaveToast==='function')
    laSaveToast({kind:'success', title:'นำเข้า Agent สำเร็จ', status:(created+updated)+' รายการ',
      sub:'สร้างใหม่ '+created+' · อัปเดต '+updated+' · เขียนข้อมูล '+fields+' ช่อง', dur:5200});
  else alert('นำเข้าสำเร็จ · สร้าง '+created+' · อัปเดต '+updated);
}

// nested-aware read
function agGet(a, k){
  if(!a) return undefined;
  if(k.indexOf('.')<0) return a[k];
  return k.split('.').reduce((o,p)=> o==null?o:o[p], a);
}
// nested-aware write — MERGES into companyInfo, never replaces it
function agSet(a, k, v){
  if(k.indexOf('.')<0){ a[k]=v; return; }
  const [head, ...rest] = k.split('.');
  a[head] = a[head] || {};
  let o = a[head];
  for(let i=0;i<rest.length-1;i++){ o[rest[i]] = o[rest[i]] || {}; o = o[rest[i]]; }
  o[rest[rest.length-1]] = v;
}

// what a cell shows when it isn't being edited
function agCellText(a, c){
  const v = agGet(a, c.k);
  if(c.type==='programs') return agEmpty(v) ? '' : (v.length + ' โปรแกรม');
  if(c.type==='select'){
    const o = (c.opts(a)||[]).find(x=>x.v===v);
    return o ? o.t : (v||'');
  }
  if(c.type==='num') return agEmpty(v) ? '' : Number(v).toLocaleString();
  return v==null ? '' : String(v);
}

// ── gap counters (drive the filter chips) ──
function agGapCounts(){
  const A = SB_AGENTS||[];
  const docMissing = a => AG_COLS.filter(c=>c.doc).some(c=>agEmpty(agGet(a,c.k)));
  return {
    all: A.length,
    programs: A.filter(a=>agEmpty(a.programs)).length,
    rate:     A.filter(a=>agEmpty(a.rateTypeId)).length,
    vat:      A.filter(a=>agEmpty(a.vatMode)).length,
    docs:     A.filter(docMissing).length,
  };
}
function agTblRows(){
  const q = (document.getElementById('agtbl-q')?.value||'').toLowerCase().trim();
  let rows = (typeof laScopeAgents==='function') ? laScopeAgents((SB_AGENTS||[]).slice()) : (SB_AGENTS||[]).slice();   /* §user→sales · เซลล์เห็นเฉพาะเอเยนต์ของตัว */
  if(_agMktFilter && _agMktFilter!=='all') rows = rows.filter(a=>a.market===_agMktFilter);
  if(_agSalesFilter==='__none') rows = rows.filter(a=>agEmpty(a.sales));
  else if(_agSalesFilter && _agSalesFilter!=='all') rows = rows.filter(a=>a.sales===_agSalesFilter);
  if(_agGap==='programs') rows = rows.filter(a=>agEmpty(a.programs));
  else if(_agGap==='rate') rows = rows.filter(a=>agEmpty(a.rateTypeId));
  else if(_agGap==='vat') rows = rows.filter(a=>agEmpty(a.vatMode));
  else if(_agGap==='docs') rows = rows.filter(a=>AG_COLS.filter(c=>c.doc).some(c=>agEmpty(agGet(a,c.k))));
  if(q) rows = rows.filter(a => (String(a.name||'')+' '+String(a.code||'')).toLowerCase().includes(q));
  return rows;
}

function agSetView(v){
  _agView = v;
  const wrap = document.querySelector('#view-agents .sb-wrap');
  const tbl  = document.getElementById('ag-table-wrap');
  if(wrap) wrap.style.display = (v==='table') ? 'none' : '';
  if(tbl)  tbl.style.display  = (v==='table') ? 'block' : 'none';
  /* §agHd · ปุ่มสลับมุมมองอยู่บนแถบกรมท่าแล้ว · สถานะมาจากคลาส .on ที่ renderAgKPI วาดให้
     เดิมยัด cssText สีอ่อนทับตรงนี้ ซึ่งจะกลายเป็นปุ่มขาวบนพื้นกรมท่า อ่านไม่ออก */
  const bc=document.getElementById('agv-card'), bt=document.getElementById('agv-table');
  if(bc) bc.classList.toggle('on', v!=='table');
  if(bt) bt.classList.toggle('on', v==='table');
  renderAgents();
}
function agTblSetGap(g){ _agGap=g; _agSel.clear(); _agCell=null; agRenderTable(); }
function agTblSetMkt(v){ _agMktFilter = v||'all'; _agSel.clear(); _agCell=null; agRenderTable(); }
function agTblSetSales(v){ _agSalesFilter = v||'all'; _agSel.clear(); _agCell=null; agRenderTable(); }
function agTblClearFilters(){ _agMktFilter='all'; _agSalesFilter='all'; _agGap='all'; _agSel.clear(); _agCell=null;
  const q=document.getElementById('agtbl-q'); if(q) q.value=''; agRenderTable(); }
function agTblFiltersOn(){ const q=(document.getElementById('agtbl-q')?.value||'').trim();
  return (_agMktFilter&&_agMktFilter!=='all') || (_agSalesFilter&&_agSalesFilter!=='all') || _agGap!=='all' || !!q; }
function agTblToggleDocs(){ _agDocCols=!_agDocCols; _agCell=null; agRenderTable(); }
function agTblSelAll(on){ _agSel = on ? new Set(agTblRows().map(a=>a.id)) : new Set(); agRenderTable(); }
function agTblSel(id){ _agSel.has(id) ? _agSel.delete(id) : _agSel.add(id); agRenderTable(); }
function agTblClearSel(){ _agSel.clear(); agRenderTable(); }
// §Delete selected agents · admin-only (same gate as the detail-view Delete button)
function agTblDeleteSelected(){
  if(!(typeof window.laIsAdmin==='function' && window.laIsAdmin())){ alert('Only an admin can delete agent profiles.'); return; }
  const ids=[..._agSel]; if(!ids.length) return;
  const names=ids.map(id=>{ const a=(SB_AGENTS||[]).find(x=>x.id===id); return a?a.name:id; });
  const preview=names.slice(0,10).join('\n')+(names.length>10?('\n…+'+(names.length-10)+' more'):'');
  if(!confirm('Delete '+ids.length+' agent'+(ids.length>1?'s':'')+'?\n\n'+preview+'\n\nThis removes them from the list.')) return;
  const kill=new Set(ids);
  SB_AGENTS=(SB_AGENTS||[]).filter(a=>!kill.has(a.id));
  _agSel.clear(); _agCell=null;
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  agRenderTable(); if(typeof renderAgKPI==='function') renderAgKPI();
}

// ── inline cell editing ──
function agTblEdit(id, k){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('sales')) return;
  const c = AG_COLS.find(x=>x.k===k); if(!c) return;
  if(c.type==='programs'){ agTblProgramsOpen(id); return; }
  _agCell = {id, k};
  agRenderTable();
  const el = document.querySelector('#ag-tbody .agtbl-in');
  if(el){ el.focus(); if(el.select) el.select(); }
}
function agTblCommit(save){
  const cur=_agCell; if(!cur) return;
  const el = document.querySelector('#ag-tbody .agtbl-in');
  if(save && el){
    const a=(SB_AGENTS||[]).find(x=>x.id===cur.id);
    const c=AG_COLS.find(x=>x.k===cur.k);
    if(a && c){
      let v = el.value;
      if(c.type==='num') v = (String(v).replace(/[^\d.-]/g,'')==='') ? null : Number(String(v).replace(/[^\d.-]/g,''));   /* §empty numeric → null, never '' (a "" wedges the whole save batch on a bigint column) */
      else v = String(v).trim();
      const old = agGet(a, c.k);
      if(JSON.stringify(old)!==JSON.stringify(v)){ agSet(a, c.k, v); agTblPersist(); }
    }
  }
  _agCell=null;
}
function agTblKey(ev){
  const cur=_agCell; if(!cur) return;
  if(ev.key==='Escape'){ ev.preventDefault(); _agCell=null; agRenderTable(); return; }
  if(ev.key!=='Enter' && ev.key!=='Tab') return;
  ev.preventDefault();
  agTblCommit(true);
  const rows=agTblRows(), cols=agCols();
  const ri=rows.findIndex(a=>a.id===cur.id), ci=cols.findIndex(c=>c.k===cur.k);
  let nxt=null;
  if(ev.key==='Tab'){
    if(ci < cols.length-1) nxt={id:cur.id, k:cols[ci+1].k};
    else if(ri < rows.length-1) nxt={id:rows[ri+1].id, k:cols[0].k};
  } else {
    if(ri < rows.length-1) nxt={id:rows[ri+1].id, k:cur.k};
  }
  agRenderTable();
  if(nxt){ const c=AG_COLS.find(x=>x.k===nxt.k); if(c && c.type!=='programs') agTblEdit(nxt.id, nxt.k); }
}

// ── programs picker (an array field — a plain cell won't do) ──
function agTblProgramsOpen(id){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('sales')) return;
  const a=(SB_AGENTS||[]).find(x=>x.id===id); if(!a) return;
  agProgPicker(a.programs||[], sel=>{ a.programs = sel; agTblPersist(); agRenderTable(); }, 'Programs · '+a.name, a.rateTypeId||null);
}
// §autoFromRateType · The rate type IS the contract: it lists exactly the routes this agent has an
// agreed price for, and each route carries its own active period (rt.routeValidity, falling back to
// the rate type's own validFrom/validTo). So open the picker pre-ticked from the rate type when the
// agent has no programs yet, show each route's period and state inline, and push routes outside the
// rate type into their own section — ticking one there means selling a route with no agreed price,
// which should be a deliberate act rather than an accident of alphabetical order.
// rtId is optional: the bulk picker has no single agent and keeps the plain flat list.
function agProgPicker(current, onOk, title, rtId){
  const cur=new Set(current||[]);
  const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const rt = (rtId && typeof getRateType==='function') ? getRateType(rtId) : null;
  const rtIds = rt ? (rt.routes||[]).slice() : [];
  const inRt = new Set(rtIds);
  const autoFilled = !!(rt && rtIds.length && !cur.size);
  if(autoFilled) rtIds.forEach(id=>cur.add(id));
  const fmtD = v => (typeof _rtFmtDate==='function' ? _rtFmtDate(v) : (v||''));
  const _rv = (rt && rt.routeValidity) || {};
  const periodOf = rId => {
    const v = _rv[rId] || {};
    return { from: v.from || (rt&&rt.validFrom) || '', to: v.to || (rt&&rt.validTo) || '' };
  };
  const stateOf = (from,to) => {
    if(!from && !to) return {lbl:'Always', bg:'#F1EFE8', fg:'#5F5E5A'};
    const t=new Date(); t.setHours(0,0,0,0);
    if(from && t < new Date(from)) return {lbl:'Upcoming', bg:'#E6F1FB', fg:'#0C447C'};
    if(to   && t > new Date(to))   return {lbl:'Expired',  bg:'#FDECEA', fg:'#A32D2D'};
    return {lbl:'Active', bg:'#E1F5EE', fg:'#0F6E56'};
  };
  const old=document.getElementById('agprog-modal'); if(old) old.remove();
  const ov=document.createElement('div'); ov.id='agprog-modal';
  ov.style.cssText='position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",sans-serif';
  ov.onclick=ev=>{ if(ev.target===ov) ov.remove(); };
  const PIER={tublamu:'Tub Lamu', panwa:'Visit Panwa'};
  const ALL = (ROUTES||[]);
  const byId = id => ALL.find(r=>r.id===id);
  const row = (r, outside) => {
    const p = periodOf(r.id), st = stateOf(p.from,p.to);
    const dateTxt = (p.from||p.to) ? ((fmtD(p.from)||'…')+' – '+(fmtD(p.to)||'…')) : '';
    return '<label style="display:flex;align-items:center;gap:8px;padding:6px 7px;border-radius:7px;cursor:pointer;font-size:12.5px'+(outside?';opacity:.6':'')+'">'
      +'<input type="checkbox" value="'+e(r.id)+'" '+(cur.has(r.id)?'checked':'')+'>'
      +'<span style="width:6px;height:6px;border-radius:50%;background:'+e(r.color||'#ccc')+';flex:none"></span>'
      +'<span style="flex:1;min-width:0"><span style="display:block">'+e(r.name)+'</span>'
        + (!rt ? '' : outside
            ? '<span style="display:block;font-size:9.5px;color:#a0784f">ไม่อยู่ใน rate type — ยังไม่มีราคา</span>'
            : (dateTxt ? '<span style="display:block;font-size:9.5px;color:#8b9a94;font-variant-numeric:tabular-nums">'+e(dateTxt)+'</span>' : ''))
      +'</span>'
      + (rt && !outside ? '<span style="font-size:9px;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:6px;flex:none;background:'+st.bg+';color:'+st.fg+'">'+e(st.lbl)+'</span>' : '')
      +'<span style="font-size:10px;color:#a8b0aa;flex:none">'+e(PIER[r.pier]||r.pier||'')+'</span></label>';
  };
  const sec = (lbl,n) => '<div style="font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8b9a94;padding:9px 7px 3px">'+e(lbl)+' <span style="color:#c3bdb3">'+n+'</span></div>';
  let listHtml;
  if(rt && rtIds.length){
    const mine = rtIds.map(byId).filter(Boolean);
    const rest = ALL.filter(r=>!inRt.has(r.id));
    listHtml = sec('จาก Rate Type · '+(rt.code||''), mine.length) + mine.map(r=>row(r,false)).join('')
             + (rest.length ? sec('นอก Rate Type', rest.length) + rest.map(r=>row(r,true)).join('') : '');
  } else {
    listHtml = ALL.map(r=>row(r,false)).join('');
  }
  const sub = rt
    ? (autoFilled?'ติ๊กมาให้ตาม Rate Type แล้ว · ':'')+'Rate Type: '+e(rt.code||'')+' · '+e(rt.name||'')
      + ((rt.validFrom||rt.validTo) ? ' · '+e((fmtD(rt.validFrom)||'…')+' – '+(fmtD(rt.validTo)||'…')) : ' · Always')
    // rtId === null means a specific agent was opened but has no rate type bound; undefined means
    // there is no single agent at all (bulk picker), where the hint would make no sense.
    : 'ติ๊กโปรแกรมที่เอเจ้นนี้ขายได้'+(rtId===null?' · เอเจ้นนี้ยังไม่ผูก rate type':'');
  ov.innerHTML='<div style="background:#fff;border-radius:14px;width:540px;max-width:94vw;max-height:80vh;display:flex;flex-direction:column;padding:16px 18px">'
   +'<div style="font-size:15px;font-weight:800;color:#15396B;margin-bottom:4px">'+e(title||'เลือก Programs')+'</div>'
   +'<div style="font-size:11.5px;color:#8b9a94;margin-bottom:10px">'+sub+'</div>'
   +'<div style="flex:1;overflow:auto;border:1px solid #eee9e0;border-radius:9px;padding:6px">'+listHtml+'</div>'
   +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:11px;gap:8px">'
     +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
       + (rt&&rtIds.length?'<button id="agprog-rt" style="border:1px solid #1C4A30;background:#fff;color:#1C4A30;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit">ตาม Rate Type ('+rtIds.length+')</button>':'')
       +'<button id="agprog-all" style="border:1px solid #cfcabf;background:#fff;border-radius:7px;padding:5px 10px;font-size:11.5px;cursor:pointer;font-family:inherit">เลือกทั้งหมด</button>'
       +'<button id="agprog-none" style="border:1px solid #cfcabf;background:#fff;border-radius:7px;padding:5px 10px;font-size:11.5px;cursor:pointer;font-family:inherit">ล้าง</button></div>'
     +'<div style="display:flex;gap:6px">'
       +'<button id="agprog-cancel" style="border:0;background:#eee;color:#444;border-radius:8px;padding:7px 13px;font-size:12.5px;cursor:pointer;font-family:inherit">ยกเลิก</button>'
       +'<button id="agprog-ok" style="border:0;background:#1C4A30;color:#fff;border-radius:8px;padding:7px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">ตกลง</button></div>'
   +'</div></div>';
  document.body.appendChild(ov);
  const boxes=()=>[...ov.querySelectorAll('input[type=checkbox]')];
  const rtBtn=ov.querySelector('#agprog-rt');
  if(rtBtn) rtBtn.onclick=()=>boxes().forEach(b=>b.checked=inRt.has(b.value));
  ov.querySelector('#agprog-all').onclick=()=>boxes().forEach(b=>b.checked=true);
  ov.querySelector('#agprog-none').onclick=()=>boxes().forEach(b=>b.checked=false);
  ov.querySelector('#agprog-cancel').onclick=()=>ov.remove();
  ov.querySelector('#agprog-ok').onclick=()=>{ const sel=boxes().filter(b=>b.checked).map(b=>b.value); ov.remove(); onOk(sel); };
}

// ── bulk apply ──
function agBulkApply(){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('sales')) return;
  const ids=[..._agSel]; if(!ids.length) return;
  const g=id=>document.getElementById(id);
  const sets=[];
  const rt=g('agb-rate')?.value;        if(rt)  sets.push(['rateTypeId', rt]);
  const sl=g('agb-sales')?.value;       if(sl)  sets.push(['sales', sl]);
  const mk=g('agb-market')?.value;      if(mk)  sets.push(['market', mk]);
  const pt=g('agb-pay')?.value;         if(pt)  sets.push(['payType', pt]);
  const vt=g('agb-vat')?.value;         if(vt)  sets.push(['vatMode', vt]);
  const sb=(g('agb-sub')?.value||'').trim();  if(sb) sets.push(['sub', sb]);
  const cl=(g('agb-limit')?.value||'').trim(); if(cl!=='') sets.push(['creditLimit', Number(cl.replace(/[^\d.-]/g,''))]);
  const cd=(g('agb-days')?.value||'').trim();  if(cd!=='') sets.push(['creditDays',  Number(cd.replace(/[^\d.-]/g,''))]);
  const pg=window.__agBulkPrograms || null;    if(pg) sets.push(['programs', pg]);

  if(!sets.length){ alert('ยังไม่ได้เลือกค่าที่จะตั้ง'); return; }
  const names = sets.map(([k])=>(AG_COLS.find(c=>c.k===k)||{}).t || k);
  if(!confirm('จะเขียน '+sets.length+' ช่อง × '+ids.length+' เอเจ้น = '+(sets.length*ids.length)+' ค่า\n\nช่อง: '+names.join(', ')+'\n\nยืนยัน?')) return;

  let n=0;
  ids.forEach(id=>{ const a=(SB_AGENTS||[]).find(x=>x.id===id); if(!a) return;
    sets.forEach(([k,v])=>{ agSet(a,k,Array.isArray(v)?v.slice():v); n++; }); });
  window.__agBulkPrograms=null;
  agTblPersist();
  _agSel.clear();
  agRenderTable();
  if(typeof laSaveToast==='function')
    laSaveToast({kind:'success', title:'อัปเดตหลายรายการแล้ว', status:ids.length+' เอเจ้น',
      sub:'เขียน '+n+' ค่า · '+names.join(', '), dur:4600});
}
function agBulkProgramsPick(){
  agProgPicker(window.__agBulkPrograms||[], sel=>{
    window.__agBulkPrograms = sel.length? sel : null;
    agRenderTable();
  }, 'ตั้ง Programs ให้ '+_agSel.size+' เอเจ้น');
}
// fill-down: copy the value of the cell you last touched into every ticked row
function agFillDown(){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('sales')) return;
  const src=window.__agFillSrc;
  if(!src){ alert('คลิกช่องต้นแบบก่อน (ค่าที่จะคัดลอกลงทุกแถวที่ติ๊ก)'); return; }
  const ids=[..._agSel]; if(!ids.length){ alert('ติ๊กแถวปลายทางก่อน'); return; }
  const a0=(SB_AGENTS||[]).find(x=>x.id===src.id); if(!a0) return;
  const v=agGet(a0, src.k);
  const label=(AG_COLS.find(c=>c.k===src.k)||{}).t||src.k;
  if(!confirm('คัดลอกค่าของช่อง "'+label+'" จาก '+a0.name+'\nลงไปยัง '+ids.length+' แถวที่ติ๊กไว้?')) return;
  ids.forEach(id=>{ const a=(SB_AGENTS||[]).find(x=>x.id===id); if(a) agSet(a, src.k, Array.isArray(v)?v.slice():v); });
  agTblPersist(); agRenderTable();
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:'เติมค่าลงแถวแล้ว', status:ids.length+' เอเจ้น', sub:label, dur:3600});
}
function agTblPersist(){ try{ sbAgentsPersist(); }catch(e){ console.warn('persist agents failed', e); } }

function agRenderTable(){
  const host=document.getElementById('ag-table-wrap'); if(!host) return;
  // ── scroll-keep: innerHTML rebuilds the whole grid, which would fling the user back to row 1
  //    after every single cell edit. Remember where they were (grid scroll, page scroll, and the
  //    search box caret) and put it back once the new DOM is in.
  const _sc = document.getElementById('ag-tbl-scroll');
  const _st = _sc ? _sc.scrollTop : 0;
  const _sl = _sc ? _sc.scrollLeft : 0;
  const _mn = document.querySelector('main');
  const _mt = _mn ? _mn.scrollTop : 0;
  const _wy = window.scrollY || 0;
  const _q  = document.getElementById('agtbl-q');
  const _qFocus = !!(_q && document.activeElement===_q);
  const _qPos = _q ? _q.selectionStart : 0;
  const _restore = () => { try{
    const sc = document.getElementById('ag-tbl-scroll');
    if(sc){ sc.scrollTop = _st; sc.scrollLeft = _sl; }
    if(_mn && _mt) _mn.scrollTop = _mt;
    if(_wy) window.scrollTo(0, _wy);
    if(_qFocus){ const q2=document.getElementById('agtbl-q');
      if(q2){ q2.focus(); try{ q2.setSelectionRange(_qPos,_qPos); }catch(_){} } }
  }catch(_){} };
  const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const cols=agCols(), rows=agTblRows(), G=agGapCounts();
  const chip=(k,label,n,danger)=>{
    const on=_agGap===k;
    return '<button onclick="agTblSetGap(\''+k+'\')" style="border:1px solid '+(on?'#15396B':'#e0dcd3')+';background:'+(on?'#E6F1FB':'#fff')+';color:'+(on?'#15396B':(danger&&n?'#A32D2D':'#5F5E5A'))+';border-radius:8px;padding:5px 11px;font-size:12px;font-weight:'+(on?'700':'500')+';cursor:pointer;font-family:inherit;white-space:nowrap">'+e(label)+' <b>'+n+'</b></button>';
  };
  const allOn = rows.length>0 && rows.every(a=>_agSel.has(a.id));

  const head = '<tr>'
    +'<th style="width:30px;padding:7px 6px;background:#f7f6f2;border-bottom:1px solid #e0dcd3;position:sticky;top:0;z-index:2"><input type="checkbox" '+(allOn?'checked':'')+' onchange="agTblSelAll(this.checked)"></th>'
    + cols.map(c=>'<th style="width:'+c.w+'px;min-width:'+c.w+'px;padding:7px 8px;text-align:left;font-size:10.5px;color:#8b9a94;font-weight:600;background:#f7f6f2;border-bottom:1px solid #e0dcd3;white-space:nowrap;position:sticky;top:0;z-index:2">'+e(c.t)+'</th>').join('')
    +'</tr>';

  const body = rows.length ? rows.map(a=>{
    const on=_agSel.has(a.id);
    return '<tr style="'+(on?'background:#EDF4FB':'')+'">'
      +'<td style="text-align:center;border-bottom:1px solid #f1efe9;border-right:1px solid #f1efe9"><input type="checkbox" '+(on?'checked':'')+' onchange="agTblSel(\''+e(a.id)+'\')"></td>'
      + cols.map(c=>{
          const editing = _agCell && _agCell.id===a.id && _agCell.k===c.k;
          const v = agGet(a,c.k);
          const blank = agEmpty(v);
          if(editing){
            const inner = c.type==='select'
              ? '<select class="agtbl-in" onblur="agTblCommit(true);agRenderTable()" onkeydown="agTblKey(event)" style="width:100%;height:30px;border:0;box-shadow:inset 0 0 0 2px #185FA5;font-size:12px;padding:0 5px;font-family:inherit;background:#fff">'
                  +'<option value=""></option>'
                  + (c.opts(a)||[]).map(o=>'<option value="'+e(o.v)+'"'+(o.v===v?' selected':'')+'>'+e(o.t)+'</option>').join('')
                  +'</select>'
              : '<input class="agtbl-in" value="'+e(v==null?'':v)+'" onblur="agTblCommit(true);agRenderTable()" onkeydown="agTblKey(event)" style="width:100%;height:30px;border:0;box-shadow:inset 0 0 0 2px #185FA5;font-size:12px;padding:0 6px;font-family:inherit;background:#fff">';
            return '<td style="padding:0;border-bottom:1px solid #f1efe9;border-right:1px solid #f1efe9">'+inner+'</td>';
          }
          const txt = agCellText(a,c);
          return '<td onclick="window.__agFillSrc={id:\''+e(a.id)+'\',k:\''+e(c.k)+'\'};agTblEdit(\''+e(a.id)+'\',\''+e(c.k)+'\')" '
            +'style="padding:7px 8px;border-bottom:1px solid #f1efe9;border-right:1px solid #f1efe9;font-size:12px;cursor:cell;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:'+c.w+'px;'
            +(blank?'background:#FDF6E3;color:#a9884a':'color:#2b3a34')+'" title="'+e(txt||'ว่าง')+'">'+(blank?'— ว่าง —':e(txt))+'</td>';
        }).join('')
      +'</tr>';
  }).join('') : '<tr><td colspan="'+(cols.length+1)+'" style="padding:26px;text-align:center;color:#9aa8a2;font-size:12.5px">ไม่มีเอเจ้นตามเงื่อนไขที่เลือก</td></tr>';

  const nSel=_agSel.size;
  const sel=(id,label,opts)=>'<div><label style="font-size:11px;color:#8b9a94;display:block;margin-bottom:3px">'+e(label)+'</label>'
    +'<select id="'+id+'" style="width:100%;height:31px;border:1px solid #d7d3ca;border-radius:7px;font-size:12px;font-family:inherit;padding:0 6px">'
    +'<option value="">— ไม่เปลี่ยน —</option>'+opts.map(o=>'<option value="'+e(o.v)+'">'+e(o.t)+'</option>').join('')+'</select></div>';
  const txt=(id,label,ph)=>'<div><label style="font-size:11px;color:#8b9a94;display:block;margin-bottom:3px">'+e(label)+'</label>'
    +'<input id="'+id+'" placeholder="'+e(ph||'— ไม่เปลี่ยน —')+'" style="width:100%;height:31px;border:1px solid #d7d3ca;border-radius:7px;font-size:12px;font-family:inherit;padding:0 8px"></div>';

  const nPg = (window.__agBulkPrograms||[]).length;
  const bulk = nSel ? '<div style="border:1px solid #cfd6d2;background:#fff;border-radius:11px;padding:11px 13px;margin-top:11px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">'
      +'<span style="font-size:13px;font-weight:700;color:#15396B">เลือก '+nSel+' เอเจ้น</span>'
      +'<div style="display:flex;gap:6px">'
        +'<button onclick="agFillDown()" title="คัดลอกค่าของช่องที่คลิกล่าสุด ลงทุกแถวที่ติ๊ก" style="border:1px solid #cfcabf;background:#fff;border-radius:7px;padding:5px 10px;font-size:11.5px;cursor:pointer;font-family:inherit">↓ เติมค่าจากช่องที่คลิก ลงทุกแถว</button>'
        +'<button onclick="agTblClearSel()" style="border:1px solid #cfcabf;background:#fff;border-radius:7px;padding:5px 10px;font-size:11.5px;cursor:pointer;font-family:inherit">ล้างการเลือก</button>'
        +((typeof window.laIsAdmin==='function' && window.laIsAdmin()) ? '<button onclick="agTblDeleteSelected()" title="ลบโปรไฟล์ Agent ที่ติ๊กไว้ (เฉพาะ admin)" style="border:1px solid #E4A0A0;background:#FCEBEB;color:#A32D2D;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">🗑 ลบที่เลือก</button>' : '')
        +'</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'
      /* §rtLoginScope · กรองตามสิทธิ์ + ตัดตัวที่ Deactivate ทิ้ง · ฝั่งการ์ดกันไม่ให้เลือกอยู่แล้ว
         ถ้าตรงนี้ยังเลือกได้ จะตั้งเรทที่ปิดใช้งานทับ agent ทีละหลายสิบใบโดยไม่มีอะไรเตือน */
      + sel('agb-rate','ตั้ง Rate Type',((typeof rtScopeList==='function')?rtScopeList((SB_RATE_TYPES||[]).filter(r=>r.active!==false)):(SB_RATE_TYPES||[]).filter(r=>r.active!==false)).map(r=>({v:r.id,t:r.name})))
      + '<div><label style="font-size:11px;color:#8b9a94;display:block;margin-bottom:3px">ตั้ง Programs</label>'
        +'<button onclick="agBulkProgramsPick()" style="width:100%;height:31px;border:1px solid '+(nPg?'#0F6E56':'#d7d3ca')+';background:'+(nPg?'#E1F5EE':'#fff')+';color:'+(nPg?'#0F6E56':'#8b9a94')+';border-radius:7px;font-size:12px;cursor:pointer;font-family:inherit">'+(nPg? nPg+' โปรแกรม' : '— ไม่เปลี่ยน —')+'</button></div>'
      + sel('agb-sales','ตั้ง เซลล์',(SB_SALES||[]).map(s=>({v:s.id,t:s.name})))
      + sel('agb-market','ตั้ง ตลาด',(SB_MARKETS||[]).map(m=>({v:m.id,t:m.name})))
      + sel('agb-pay','ตั้ง การชำระ',[{v:'invoice',t:'invoice'},{v:'proforma',t:'proforma'},{v:'cot',t:'cot'}])
      + sel('agb-vat','ตั้ง VAT',[{v:'none',t:'ไม่มี VAT'},{v:'include',t:'รวม VAT'},{v:'exclude',t:'แยก VAT'}])
      + txt('agb-sub','ตั้ง Sub-market')
      + txt('agb-limit','ตั้ง วงเงิน')
      + txt('agb-days','ตั้ง เครดิต (วัน)')
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:11px;padding-top:10px;border-top:1px solid #f1efe9">'
      +'<span style="font-size:11.5px;color:#8b9a94">ช่องที่ปล่อยเป็น “— ไม่เปลี่ยน —” จะไม่ถูกแตะ · จะมีสรุปให้ยืนยันก่อนเขียนจริง</span>'
      +'<button onclick="agBulkApply()" style="border:0;background:#1C4A30;color:#fff;border-radius:9px;padding:8px 17px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">ใช้กับ '+nSel+' เอเจ้น</button>'
    +'</div></div>' : '';

  host.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + chip('all','ทั้งหมด',G.all)
      + chip('programs','ขาด Programs',G.programs,1)
      + chip('rate','ขาด Rate Type',G.rate,1)
      + chip('vat','ขาด VAT',G.vat,1)
      + chip('docs','ขาด เอกสาร',G.docs)
    +'</div>'
    +'<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">'
      +'<input id="agtbl-q" value="'+e(document.getElementById('agtbl-q')?.value||'')+'" oninput="agRenderTable()" placeholder="ค้นหาชื่อ / code" style="height:31px;border:1px solid #d7d3ca;border-radius:8px;font-size:12px;padding:0 10px;width:150px;font-family:inherit">'
      +'<select onchange="agTblSetMkt(this.value)" style="height:31px;border:1px solid '+((_agMktFilter&&_agMktFilter!=='all')?'#15396B':'#d7d3ca')+';border-radius:8px;font-size:12px;padding:0 6px;font-family:inherit;background:'+((_agMktFilter&&_agMktFilter!=='all')?'#E6F1FB':'#fff')+';color:'+((_agMktFilter&&_agMktFilter!=='all')?'#15396B':'#5F5E5A')+'">'
        +'<option value="all">ทุกตลาด</option>'
        + (SB_MARKETS||[]).map(m=>'<option value="'+e(m.id)+'"'+(m.id===_agMktFilter?' selected':'')+'>'+e(m.name)+'</option>').join('')
      +'</select>'
      +'<select onchange="agTblSetSales(this.value)" style="height:31px;border:1px solid '+((_agSalesFilter&&_agSalesFilter!=='all')?'#15396B':'#d7d3ca')+';border-radius:8px;font-size:12px;padding:0 6px;font-family:inherit;background:'+((_agSalesFilter&&_agSalesFilter!=='all')?'#E6F1FB':'#fff')+';color:'+((_agSalesFilter&&_agSalesFilter!=='all')?'#15396B':'#5F5E5A')+'">'
        +'<option value="all">ทุกเซลล์</option>'
        + (SB_SALES||[]).map(x=>'<option value="'+e(x.id)+'"'+(x.id===_agSalesFilter?' selected':'')+'>'+e(x.name)+'</option>').join('')
        +'<option value="__none">— ไม่มีเซลล์ —</option>'
      +'</select>'
      + (agTblFiltersOn() ? '<button onclick="agTblClearFilters()" title="ล้างตัวกรองทั้งหมด" style="border:1px solid #d99;background:#fff;color:#A32D2D;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap">✕ ล้างตัวกรอง</button>' : '')
      +'<button onclick="agTblToggleDocs()" style="border:1px solid '+(_agDocCols?'#15396B':'#d7d3ca')+';background:'+(_agDocCols?'#E6F1FB':'#fff')+';color:'+(_agDocCols?'#15396B':'#5F5E5A')+';border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap">'+(_agDocCols?'ซ่อน':'แสดง')+'คอลัมน์เอกสาร</button>'
    +'</div></div>'
    +'<div style="border:1px solid #e0dcd3;border-radius:11px;overflow:hidden;background:#fff">'
      +'<div id="ag-tbl-scroll" style="overflow:auto;max-height:60vh"><table style="border-collapse:collapse;width:100%"><thead>'+head+'</thead><tbody id="ag-tbody">'+body+'</tbody></table></div>'
      +'<div style="padding:6px 10px;background:#faf9f6;border-top:1px solid #e0dcd3;display:flex;justify-content:space-between;align-items:center">'
        +'<span style="font-size:11px;color:#98a29c">คลิกช่องเพื่อแก้ · <b>Tab</b> ช่องถัดไป · <b>Enter</b> แถวถัดไป · <b>Esc</b> ยกเลิก · ช่องเหลือง = ยังว่าง</span>'
        +'<span style="font-size:11px;color:#98a29c">'+rows.length+' แถว'+(rows.length!==(SB_AGENTS||[]).length?(' จาก '+(SB_AGENTS||[]).length):'')+'</span>'
      +'</div>'
    +'</div>'
    + bulk;

  _restore();
  // When a cell is being edited, the input's own focus() scrolls it into view — a second restore
  // one frame later would yank it back off-screen and break Tab-walking a scrolled grid.
  if(!_agCell) requestAnimationFrame(_restore);
}

/* ══ §agProgBulk · เติมโปรแกรมให้ตรงกับเรท ทีเดียวหลายเจ้า ════════════════════
   §agProgFill แก้ของ "ตั้งแต่วันนี้ไป" · ก้อนนี้คือของที่ค้างอยู่แล้ว
   เติมอย่างเดียว ไม่ตัดอะไรทั้งนั้น — การตัดคือการลบของที่คนตั้งใจใส่ ต้องดูทีละเจ้า
   เจ้าที่มีเส้นซึ่งเรทไม่มีราคา จึงแค่ "ขึ้นให้เห็น" ในกล่อง ไม่ได้ถูกแตะ
   ═══════════════════════════════════════════════════════════════════════════ */
function agProgBulkPlan(){
  var A = (typeof SB_AGENTS!=='undefined') ? SB_AGENTS : [];
  if(typeof laScopeAgents==='function') A = laScopeAgents(A.slice());
  /* แยกสองกอง เพราะผลของการเติมไม่เหมือนกันเลย
       empty   · ยังไม่ได้กรอกโปรแกรมสักเส้น → วันนี้ "ไม่มีขอบเขต" อะไรทั้งนั้น
                 เติมแล้วได้ขอบเขตขึ้นมา = แคบลง ปลอดภัยเสมอ
       partial · Sales กรอกไว้แล้วบางส่วน → เติมคือการ "เปิดสิทธิ์ขายเพิ่ม"
                 อาจเป็นเส้นที่เขาตั้งใจไม่ให้ขาย · ต้องเป็นปุ่มแยก ไม่รวมกับกองแรก */
  var empty = [], partial = [], mismatch = [], nEmpty = 0, nPartial = 0;
  A.forEach(function(a){
    if(!a || !a.rateTypeId) return;
    var P = agProgPlan(a, a.rateTypeId);
    if(!P.rt) return;
    if(P.add.length){
      if((a.programs||[]).length){ partial.push({a:a, add:P.add}); nPartial += P.add.length; }
      else { empty.push({a:a, add:P.add}); nEmpty += P.add.length; }
    }
    if(P.drop.length) mismatch.push({a:a, drop:P.drop});
  });
  var by = function(x,y){ return y.add.length - x.add.length; };
  empty.sort(by); partial.sort(by);
  return {empty:empty, partial:partial, mismatch:mismatch, nEmpty:nEmpty, nPartial:nPartial};
}
function agProgBulkPanel(hostId){
  var host = document.getElementById(hostId); if(!host) return;
  var P;
  try{ P = agProgBulkPlan(); }catch(e){ console.warn('agProgBulkPlan failed', e); host.innerHTML=''; return; }
  if(!P.empty.length && !P.partial.length && !P.mismatch.length){ host.innerHTML=''; return; }
  var line = function(txt, btn){ return '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;'
    +'border-top:1px solid #F1F3F6;padding:7px 0;font-size:11.5px;color:#4A5360;line-height:1.55">'
    + txt + (btn||'') + '</div>'; };
  var b = function(scope, label, dark){ return '<button onclick="agProgBulkOpen(\''+scope+'\')" '
    +'style="margin-left:auto;border:'+(dark?'0':'1px solid #D6DCE5')+';background:'+(dark?'#0F172A':'#fff')
    +';color:'+(dark?'#fff':'#5A6270')+';border-radius:999px;padding:5px 14px;font:700 11px inherit;'
    +'cursor:pointer;font-family:inherit;white-space:nowrap">'+label+'</button>'; };
  host.innerHTML = '<div style="background:#fff;border:1px solid #E7EAEF;border-radius:11px;'
    +'padding:12px 15px;margin:0 0 14px">'
    +'<div style="font-size:12.5px;font-weight:800;color:#2C3440">โปรแกรมในสัญญา กับ เรทที่ผูกอยู่</div>'
    +'<div style="font-size:11px;color:#6B7280;line-height:1.6;margin-bottom:4px">'
      +'เรทบอกว่ามีราคาของเส้นทางไหนบ้าง · สัญญาบอกว่าเอเย่นต์ขายเส้นทางไหนบ้าง '
      +'และรายการในสัญญายังเป็น<b>ขอบเขตที่ขายได้</b>ตอนเปิดบุกกิ้งด้วย</div>'
    + (P.empty.length ? line('<b style="color:#2C3440">'+P.empty.length+' เจ้ายังไม่ได้กรอกโปรแกรมเลย</b>'
        +'<span>· วันนี้จึงจองเส้นไหนก็ได้ ไม่มีอะไรกั้น · เติมตามเรทแล้วจะมีขอบเขตขึ้นมา (+'+P.nEmpty+' เส้นทาง)</span>',
        b('empty','เติมให้ '+P.empty.length+' เจ้า', true)) : '')
    + (P.partial.length ? line('<b style="color:#8A5410">'+P.partial.length+' เจ้ากรอกไว้แล้วบางส่วน</b>'
        +'<span>· เติมคือการเปิดสิทธิ์ขายเพิ่ม (+'+P.nPartial+' เส้นทาง) ซึ่งอาจเป็นเส้นที่ Sales ตั้งใจไม่ให้ขาย · ดูก่อนค่อยตัดสิน</span>',
        b('partial','ดู '+P.partial.length+' เจ้า', false)) : '')
    + (P.mismatch.length ? line('<b style="color:#A32D2D">'+P.mismatch.length+' เจ้ามีเส้นที่เรทไม่มีราคาให้</b>'
        +'<span>· กล่องนี้ไม่ตัดให้ · ขึ้นเป็นเตือนในบล็อก Needs action ของเจ้านั้นอยู่แล้ว ต้องยืนยันทีละเจ้า</span>','') : '')
    +'</div>';
}
function agProgBulkOpen(scope){
  if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return;
  _agProgBulkScope = (scope==='partial') ? 'partial' : 'empty';
  var P = agProgBulkPlan();
  var list = (_agProgBulkScope==='partial') ? P.partial : P.empty;
  var nAdd = (_agProgBulkScope==='partial') ? P.nPartial : P.nEmpty;
  if(!list.length) return;
  var e = _rtExpE, isP = (_agProgBulkScope==='partial');
  var h = '<div style="padding:16px 18px;border-bottom:1px solid #EEF0F3">'
    +'<div style="font-size:15px;font-weight:800;color:#1F2937">เติมโปรแกรมให้ตรงกับเรท</div>'
    +'<div style="font-size:11.5px;color:#6B7280;margin-top:3px">'
      + (isP ? 'กลุ่มที่กรอกไว้แล้วบางส่วน · ' : 'กลุ่มที่ยังไม่ได้กรอกเลย · ')
      + list.length + ' เอเย่นต์ · เติมรวม ' + nAdd + ' เส้นทาง</div></div>'
    +'<div style="padding:14px 18px">';
  h += isP
    ? '<div style="background:#FEF6E7;border:1px solid #EFD9AE;border-radius:9px;padding:9px 12px;'
      +'font-size:11.5px;color:#8A5410;line-height:1.65;margin-bottom:12px">'
      +'<b>กลุ่มนี้มีคนกรอกไว้แล้ว</b> — การเติมคือการเปิดให้ขายเส้นที่วันนี้ขายไม่ได้<br>'
      +'<span style="color:#9A6A2A">ถ้า Sales ตั้งใจให้ขายแค่บางเส้น อย่ากดทั้งกลุ่ม · เข้าไปเติมทีละเจ้าที่หน้า Agent</span></div>'
    : '<div style="background:#F1F8F5;border:1px solid #BEE0D2;border-radius:9px;padding:9px 12px;'
      +'font-size:11.5px;color:#0F6E56;line-height:1.65;margin-bottom:12px">'
      +'<b>เติมอย่างเดียว ไม่ตัดอะไรเลย</b> — กลุ่มนี้ยังไม่มีโปรแกรมสักเส้น จึงไม่มีของเดิมให้ทับ<br>'
      +'<span style="color:#4E7F6C">ช่วงจองของแถวที่เติม = ช่วงสัญญาของเจ้านั้น · ช่วงเดินทาง = ตามที่เรทกำหนดไว้</span></div>';
  list.slice(0, 40).forEach(function(f){
    h += '<div style="border-top:1px solid #EEF0F3;padding:7px 0;font-size:11.5px;line-height:1.55">'
      +'<b style="color:#2C3440">' + e(f.a.code || f.a.name || f.a.id) + '</b> '
      + (isP ? ('<span style="color:#9AA3AE">มีอยู่ '+(f.a.programs||[]).length+'</span> ') : '')
      +'<span style="color:#0F6E56;font-weight:700">+' + f.add.length + '</span> '
      +'<span style="color:#6B7280">' + f.add.slice(0,5).map(function(r){ return e(agProgRouteName(r)); }).join(' · ')
      + (f.add.length>5 ? (' · และอีก '+(f.add.length-5)) : '') + '</span></div>';
  });
  if(list.length > 40)
    h += '<div style="font-size:11px;color:#8A929E;padding-top:7px">· และอีก ' + (list.length-40) + ' เจ้า</div>';
  h += '</div><div style="padding:12px 18px;border-top:1px solid #EEF0F3;display:flex;gap:8px;justify-content:flex-end">'
    +'<button onclick="acctModalClose()" style="border:1px solid #D6DCE5;background:#fff;color:#5A6270;'
      +'border-radius:8px;padding:7px 15px;font:600 11.5px inherit;cursor:pointer;font-family:inherit">ปิด</button>'
    +'<button onclick="agProgBulkApply()" style="border:0;background:'+(isP?'#8A5410':'#0F172A')+';color:#fff;'
      +'border-radius:8px;padding:7px 17px;font:700 11.5px inherit;cursor:pointer;font-family:inherit">'
      +'เติมให้ ' + list.length + ' เอเย่นต์</button></div>';
  acctModal(h);
}
function agProgBulkApply(){
  if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return;
  var P = agProgBulkPlan();
  var list = (_agProgBulkScope==='partial') ? P.partial : P.empty;
  if(!list.length) return;
  var who = (typeof window!=='undefined' && window._rmUser) ? window._rmUser : '';
  var at = new Date().toISOString(), n = 0, routes = 0;
  list.forEach(function(f){
    var R = agProgFill(f.a, f.a.rateTypeId, {});      /* เติมอย่างเดียว · removeExtra ไม่ถูกส่ง */
    if(!R || !R.add.length) return;
    /* เขียน activity เองแล้วเซฟทีเดียวตอนจบ · agLog เซฟทุกครั้งที่เรียก (ดู §rtExpBulk) */
    if(!Array.isArray(f.a.activity)) f.a.activity = [];
    f.a.activity.push({ at:at, by:who, kind:'programs',
      text:'เติมโปรแกรมตามเรทแบบกลุ่ม · +' + R.add.length + ' · ' + R.add.map(agProgRouteName).join(' · ') });
    if(f.a.activity.length > 200) f.a.activity = f.a.activity.slice(-200);
    n++; routes += R.add.length;
  });
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  acctModalClose();
  if(typeof renderRateAdmin==='function') renderRateAdmin();
  var av = document.getElementById('view-agents');
  if(av && av.classList.contains('active') && typeof renderAgents==='function') renderAgents();
  if(typeof flShowToast==='function') flShowToast('เติมโปรแกรมให้ ' + n + ' เอเย่นต์ · ' + routes + ' เส้นทาง');
  else console.log('[agProgBulk] filled ' + n + ' agents / ' + routes + ' routes');
}

// Jump from 3rd-col agent card → Agent List view with that agent selected
function agSelectFromRtCol(agentId, ev){
  if(ev){ ev.stopPropagation(); }
  if(typeof nav === 'function'){
    // Find the nav item for "agents" view and click it
    const navItem = document.querySelector('[data-view="agents"]');
    if(navItem) nav(navItem);
  }
  setTimeout(()=>{
    if(typeof agSelect === 'function') agSelect(agentId);
  }, 50);
}

function agRenderFilters(){
  const inkColor = '#1a1a1a';

  // Build a single chip — returns HTML string
  // C1 structure: first <span> is the dot (becomes pill with count when .on)
  function buildChip(opts){
    const {isOn, color, label, count, onclick, dataAttr} = opts;
    if(isOn){
      // Active: dot grows into pill containing count, inline style for bg color
      return `<span class="fp on" ${dataAttr} onclick="${onclick}"><span style="background:${color};color:#fff;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.3;display:inline-flex;align-items:center;justify-content:center;min-width:22px">${count}</span>${label}</span>`;
    } else {
      // Inactive: small dot 10px + label + count outside
      return `<span class="fp" ${dataAttr} onclick="${onclick}"><span style="background:${color};width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0"></span>${label} <span class="fp-cnt">${count}</span></span>`;
    }
  }

  /* §user→sales · ตัวเลขบนชิป/KPI ต้องนับเฉพาะเอเยนต์ในขอบเขตของ user ด้วย ไม่งั้นเซลล์เห็น "ทั้งหมด 320" แต่ในตารางมี 12 */
  const _ags = (typeof laScopeAgents==='function') ? laScopeAgents(SB_AGENTS) : SB_AGENTS;
  // Market chips
  const mktHost = document.getElementById('ag-mkt-filter');
  if(mktHost){
    const counts = {};
    _ags.forEach(a=>{ counts[a.market]=(counts[a.market]||0)+1; });
    let html = buildChip({
      isOn: _agMktFilter==='all', color: inkColor, label:'ทั้งหมด',
      count: _ags.length, dataAttr:'data-mkt="all"',
      onclick:"agSetMktFilter('all')"
    });
    const shortMap = {
      'Online Travel Agent':'OTA',
      'Counter Tour Phuket':'Counter PK',
      'Counter Tour Khao Lak':'Counter KL',
      'Hotel Phuket':'Hotel PK',
      'Hotel Khao Lak':'Hotel KL',
      'Asia Pacific':'Asia-Pac',
      'Russian Market':'Russian',
      'World Wide':'WW',
    };
    SB_MARKETS.forEach(m=>{
      const c = counts[m.id]||0;
      if(c===0) return;
      const shortName = shortMap[m.name] || m.name;
      html += buildChip({
        isOn: _agMktFilter===m.id, color: m.color || '#7a8fa3',
        label: shortName, count: c,
        dataAttr: `data-mkt="${m.id}"`,
        onclick: `agSetMktFilter('${m.id}')`
      });
    });
    mktHost.innerHTML = html;
  }
  // Sales chips · §user→sales · เซลล์ถูก scope แล้ว → ซ่อนแถวกรองเซลล์ไปเลย (มีแค่ตัวเอง เลือกไปก็ไม่มีความหมาย)
  const salesHost = document.getElementById('ag-sales-filter');
  if(salesHost && (typeof laSalesScoped==='function') && laSalesScoped()){ salesHost.innerHTML=''; }
  else if(salesHost){
    const counts = {};
    _ags.forEach(a=>{ counts[a.sales]=(counts[a.sales]||0)+1; });
    let html = buildChip({
      isOn: _agSalesFilter==='all', color: inkColor, label:'ทั้งหมด',
      count: _ags.length, dataAttr:'data-sales="all"',
      onclick:"agSetSalesFilter('all')"
    });
    SB_SALES.forEach(s=>{
      const c = counts[s.id]||0;
      html += buildChip({
        isOn: _agSalesFilter===s.id, color: s.color,
        label: s.name, count: c,
        dataAttr: `data-sales="${s.id}"`,
        onclick: `agSetSalesFilter('${s.id}')`
      });
    });
    salesHost.innerHTML = html;
  }
}

/* ══ §agHd · แถบหัวหน้า Agent List ════════════════════════════════════════════
   ยกแถบของหน้า Dashboard (.dv-hd) มาทั้งชุด · ที่ของ "กล่องวันที่" = จำนวนเอเย่นต์
   ของเดิมเป็นการ์ดขาวสี่ใบ บอก Top Market กับ Credit Limit — ตัวเลขที่ไม่มีใครต้องทำอะไรต่อ
   ชุดใหม่บอกเฉพาะสิ่งที่พาไปทำงานได้: มีกี่เจ้า ขายจริงกี่เจ้า และมีกี่เจ้าที่ราคาเพี้ยนอยู่

   อ่านที่เดียว ใช้สองที่ · agHdScan() เป็นตัวนับเดียวของทั้งหน้า
   ป๊อป "Needs action" กับจุดเตือนในแผงของเอเย่นต์แต่ละรายจึงพูดเลขชุดเดียวกันเสมอ
   ═══════════════════════════════════════════════════════════════════════════ */
/* เรทที่ใช้จริงของเอเย่นต์รายหนึ่ง · a.rateTypeId ถูก sidecar sb_agents_rate_bindings เขียนทับตอนโหลดแล้ว
   ฟังก์ชันนี้จึงอ่านตัวเดียวพอ — เขียนเป็นฟังก์ชันไว้เพื่อให้ที่อื่นเรียกใช้คำนิยามเดียวกัน */
function agHdRateOf(a){
  if(!a || !a.rateTypeId) return null;
  return (typeof getRateType==='function') ? getRateType(a.rateTypeId) : null;
}
/* เรื่องที่กระทบ "ราคา" ของเอเย่นต์รายหนึ่ง · คืนเป็น key เพื่อให้นับรวมและวาดแถวได้จากที่เดียว
   นับเฉพาะเจ้าที่ขายโปรแกรมอยู่จริง — เจ้าที่ยังไม่มีโปรแกรมเลยไม่มีราคาให้ผิด */
function agHdIssues(a){
  const out = {};
  if(!a || !(a.programs||[]).length) return out;
  const rt = agHdRateOf(a);
  if(!rt){ out.norate = 1; return out; }
  const to = String(rt.validTo||'');
  if(to && typeof rtExpDaysTo==='function'){
    const d = rtExpDaysTo(to);
    /* ตั้งฤดูถัดไปรับไว้แล้ว = ตอบคำถามแล้ว ไม่ต้องนับ · กติกาเดียวกับ rtExpForAgent */
    const answered = (typeof laSeasonAt==='function' && typeof laDayAfter==='function')
      ? !!laSeasonAt(a, laDayAfter(to)) : false;
    if(d!==null && d<=60 && !answered) out.exp = 1;
  }
  const have = rt.seatRates||{};
  if((a.programs||[]).some(p=>p && !have[p])) out.orph = 1;
  const nx = (typeof rtExpNextOf==='function') ? rtExpNextOf(a.id) : '';
  if(nx && nx!==a.rateTypeId) out.drift = 1;
  return out;
}
function agHdScan(){
  const ags = (typeof laScopeAgents==='function') ? laScopeAgents(SB_AGENTS) : SB_AGENTS;
  const s = {total:ags.length, selling:0, credit:0, limit:0, ctSoon:0,
             exp:0, drift:0, orph:0, norate:0, need:0};
  ags.forEach(a=>{
    if(a.payType==='invoice'){ s.credit++; s.limit += (a.creditLimit||0); }
    const ce = (typeof ctDaysUntilExpiry==='function') ? ctDaysUntilExpiry(a) : null;
    if(ce!==null && ce!==undefined && ce<=30) s.ctSoon++;
    if(!(a.programs||[]).length) return;
    s.selling++;
    const iss = agHdIssues(a);
    const keys = Object.keys(iss);
    keys.forEach(k=>{ s[k]++; });
    if(keys.length) s.need++;
  });
  return s;
}
/* ป๊อปปิดเมื่อกดที่อื่น · ผูกครั้งเดียวพอ ไม่ผูกซ้ำทุกครั้งที่วาดแถบใหม่ */
function agHdPopToggle(ev){
  if(ev) ev.stopPropagation();
  const p = document.getElementById('ag-hd-pop'); if(!p) return;
  p.classList.toggle('on');
  if(p.classList.contains('on') && !window._agHdPopBound){
    window._agHdPopBound = true;
    document.addEventListener('click', function(){
      const q = document.getElementById('ag-hd-pop'); if(q) q.classList.remove('on');
    });
  }
}
/* §agPhone · ลิสต์เอเย่นต์บนจอโทรศัพท์ · ยุบ/กาง · จอใหญ่ไม่เคยเห็นปุ่มนี้ */
function agSideToggle(){
  const side = document.querySelector('#view-agents .sb-side'); if(!side) return;
  const on = side.classList.toggle('open');
  const b = document.getElementById('ag-side-tgl'); if(b) b.textContent = on ? 'Hide' : 'Browse';
}

// Required fields for a "complete" agent · used for the incomplete-data warning
function agIncompleteFields(a){
  const miss=[];
  if(!a.market) miss.push('Market');
  if(!a.sales) miss.push('Sales owner');
  if(!a.payType) miss.push('Payment');
  if(!a.rateTypeId) miss.push('Rate Type');
  if(!((a.programs||[]).length)) miss.push('Programs');
  if(!((a.email||'').trim() || (a.phone||'').trim() || (a.contact||'').trim())) miss.push('Contact');
  return miss;
}
function agRenderList(){
  const q = (document.getElementById('ag-search')?.value||'').toLowerCase().trim();
  const host = document.getElementById('ag-list');
  if(!host) return;

  // Filter: market + sales + search
  let filtered = (typeof laScopeAgents==='function') ? laScopeAgents(SB_AGENTS.slice()) : SB_AGENTS.slice();   /* §user→sales · เซลล์เห็นเฉพาะของตัว */
  if(_agMktFilter !== 'all') filtered = filtered.filter(a=>a.market===_agMktFilter);
  if(_agSalesFilter !== 'all') filtered = filtered.filter(a=>a.sales===_agSalesFilter);
  if(q) filtered = filtered.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.code.toLowerCase().includes(q) ||
    (a.sub||'').toLowerCase().includes(q) ||
    (sbGetMarket(a.market)?.name||'').toLowerCase().includes(q) ||
    (sbGetSales(a.sales)?.name||'').toLowerCase().includes(q)
  );

  // Sort A-Z by name
  filtered.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));

  // Group by first letter for A-Z section headers
  const groups = {};
  filtered.forEach(a=>{
    const letter = a.name.charAt(0).toUpperCase();
    if(!groups[letter]) groups[letter] = [];
    groups[letter].push(a);
  });

  const letters = Object.keys(groups).sort();
  let html = '';
  letters.forEach(L=>{
    html += `<div class="sb-az-hd">${L}</div>`;
    groups[L].forEach(a=>{
      const mkt = sbGetMarket(a.market);
      const sales = sbGetSales(a.sales);
      const mktShort = mkt?.name.match(/^(\w+)/)?.[1] || '';
      // Initials from first two words of agent name (or first 2 chars of single word)
      const nameParts = a.name.replace(/[()]/g,'').split(/\s+/).filter(Boolean);
      const initials = (nameParts.length>=2 ? (nameParts[0][0]+nameParts[1][0]) : a.name.slice(0,2)).toUpperCase();
      const mktColor = mkt?.color || '#7a8fa3';
      const pay = (typeof sbGetPayment==='function') ? sbGetPayment(a.payType) : null;
      const payShort = pay?.short || (a.payType||'').slice(0,3).toUpperCase();
      const payCol = a.payType==='invoice'?'#185FA5':(a.payType==='cot'?'#A05A1A':'#5F6B7A');
      const payBg  = a.payType==='invoice'?'#E6F1FB':(a.payType==='cot'?'#FBF0DD':'#EFF1F4');
      const nProg = (a.programs||[]).length;
      let ctDot='';
      try {
        const exp =(typeof ctIsExpired==='function')&&ctIsExpired(a);
        const soon=(typeof ctIsExpiringSoon==='function')&&ctIsExpiringSoon(a);
        if(exp) ctDot='<span class="ag-ct-dot" style="background:#C0392B" title="Contract expired"></span>';
        else if(soon) ctDot='<span class="ag-ct-dot" style="background:#D48A14" title="Contract expiring soon"></span>';
        else if(a.contractVersion) ctDot='<span class="ag-ct-dot" style="background:#2d9a6a" title="Contract active"></span>';
        else ctDot='<span class="ag-ct-dot" style="background:#CBD2DA" title="No contract yet"></span>';
      } catch(e){}
      const _miss = agIncompleteFields(a);
      const incBadge = _miss.length ? `<span title="ข้อมูลไม่ครบ — ขาด: ${_miss.join(', ')}" style="font-size:9px;font-weight:700;color:#A05A1A;background:#FBF0DD;border:1px solid #EAD9B0;padding:0 6px;border-radius:8px;line-height:1.6;white-space:nowrap">⚠ ${_miss.length}</span>` : '';
      html += `
        <div class="sb-ag-row ${_agSelected===a.id?'sel':''}" onclick="agSelect('${a.id}')">
          <span class="sb-ag-dot" style="background:${mktColor}">${initials}</span>
          <div class="sb-ag-row-name-wrap" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
            <div style="display:flex;align-items:center;gap:6px"><span style="font-weight:600">${a.name}</span>${ctDot}${incBadge}</div>
            <div class="ag-row-meta">
              <span class="ag-row-mkt" style="color:${mktColor}">${mktShort}</span>${a.sub?`<span class="ag-row-sub">· ${a.sub}</span>`:''}
              <span class="ag-pay-chip" style="color:${payCol};background:${payBg}">${payShort}</span>
              ${nProg?`<span class="ag-prog-chip">${nProg} rt</span>`:''}
            </div>
          </div>
          ${sales?`<span class="sb-sales-badge" style="background:${sales.color}15;color:${sales.color};border:1px solid ${sales.color}40" title="${sales.name}">${sales.code}</span>`:''}
        </div>
      `;
    });
  });

  host.innerHTML = html || '<div class="sb-empty" style="padding:30px 16px">ไม่พบ Agent ที่ตรงเงื่อนไข</div>';

  // Update count in sidebar header
  const countEl = document.getElementById('ag-list-count');
  if(countEl) countEl.textContent = `${filtered.length} / ${SB_AGENTS.length}`;
}

function agSetMktFilter(mId){
  _agMktFilter = mId;
  agRenderFilters();
  agRenderList();
  agUpdateFilterBtn();
}

function agSetSalesFilter(sId){
  _agSalesFilter = sId;
  agRenderFilters();
  agRenderList();
  agUpdateFilterBtn();
}

function agClearFilters(){
  _agMktFilter = 'all';
  _agSalesFilter = 'all';
  agRenderFilters();
  agRenderList();
  agUpdateFilterBtn();
}

function agToggleFilterPop(ev){
  if(ev) ev.stopPropagation();
  const pop = document.getElementById('ag-filter-pop');
  if(!pop) return;
  const isOpen = pop.style.display !== 'none';
  if(isOpen){
    pop.style.display = 'none';
    document.removeEventListener('click', agClosePopOnOutside);
  } else {
    pop.style.display = 'flex';
    setTimeout(()=>document.addEventListener('click', agClosePopOnOutside), 0);
  }
}

function agClosePopOnOutside(ev){
  const pop = document.getElementById('ag-filter-pop');
  const btn = document.getElementById('ag-filter-btn');
  if(!pop) return;
  if(pop.contains(ev.target) || (btn && btn.contains(ev.target))) return;
  pop.style.display = 'none';
  document.removeEventListener('click', agClosePopOnOutside);
}

function agUpdateFilterBtn(){
  const btn = document.getElementById('ag-filter-btn');
  const cntEl = document.getElementById('ag-filter-active-cnt');
  if(!btn || !cntEl) return;
  let active = 0;
  if(_agMktFilter !== 'all') active++;
  if(_agSalesFilter !== 'all') active++;
  if(active > 0){
    btn.classList.add('has-filter');
    cntEl.textContent = active;
  } else {
    btn.classList.remove('has-filter');
    cntEl.textContent = '';
  }
}

function agSelect(aId){
  _agSelected = aId;
  agRenderList();
  agRenderDetail(aId);
  /* §agPhone · เลือกเจ้าแล้วยุบลิสต์เอง แล้วเลื่อนไปที่ชื่อ · ไม่งั้นต้องปัดผ่านรายชื่อลงไปหาเอง */
  try{
    if(window.innerWidth<=900){
      const side=document.querySelector('#view-agents .sb-side');
      if(side && side.classList.contains('open')) agSideToggle();
      const main=document.getElementById('ag-main');
      if(main) main.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }catch(e){ console.warn('agSelect phone collapse failed', e); }
}

function agEditOpen(section, agentId){
  const a = sbGetAgent(agentId); if(!a) return;
  _agEditAgentId = agentId;
  _agEditSection = section;
  // Deep clone the relevant part to draft
  if(section==='sales')        _agEditDraft = { sales: a.sales };
  else if(section==='programs') _agEditDraft = { programPeriods: JSON.parse(JSON.stringify(a.programPeriods||[])) };
  else if(section==='profile')  _agEditDraft = { payType:a.payType, vatMode:a.vatMode||'none', creditDays:a.creditDays||0, creditLimit:a.creditLimit||0, creditBalance:a.creditBalance||0 };
  else if(section==='company') {
    _agEditDraft = JSON.parse(JSON.stringify(a.companyInfo||{}));
    _agEditDraft.name = a.name;
    _agEditDraft.market = a.market;
    _agEditDraft.sub = a.sub||'';
    _agEditDraft.email = a.email||'';
    _agEditDraft.color = a.color||'';
  }
  else if(section==='signatory')_agEditDraft = JSON.parse(JSON.stringify(a.agentSignatory||{}));
  else if(section==='booking')  _agEditDraft = JSON.parse(JSON.stringify(a.bookingChannel||{}));
  else if(section==='notes')    _agEditDraft = { note: a.note||'' };
  else if(section==='ratetype') _agEditDraft = { rateTypeId: a.rateTypeId || null };
  else if(section==='contracttmpl') _agEditDraft = { contractTemplateId: a.contractTemplateId || null };
  else return;
  document.getElementById('ag-edit-modal').style.display = 'flex';
  agEditRender();
}

function agEditClose(){
  document.getElementById('ag-edit-modal').style.display = 'none';
  _agEditAgentId = null;
  _agEditSection = null;
  _agEditDraft = null;
  _agNewDraft = null;
}

function agEditSetField(key, val){
  if(_agEditDraft) _agEditDraft[key] = val;
}
function _agSubEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function agSubDDRender(q){
  const p=document.getElementById('ag-sub-panel'); if(!p) return;
  const raw=(q||''); const ql=raw.toLowerCase();
  const opts=_agSubOpts.filter(s=>String(s).toLowerCase().includes(ql));
  let html=opts.map(s=>`<div class="ag-sub-opt" onmousedown="agSubDDPick('${String(s).replace(/'/g,"\\'")}')">${_agSubEsc(s)}</div>`).join('');
  if(raw.trim() && !_agSubOpts.some(s=>String(s).toLowerCase()===ql)){
    html += `<div class="ag-sub-opt ag-sub-new" onmousedown="agSubDDPick('${raw.trim().replace(/'/g,"\\'")}')">+ ใช้ &quot;${_agSubEsc(raw.trim())}&quot;</div>`;
  }
  if(!html) html=`<div style="padding:9px 12px;font-size:11px;color:var(--fd-ink-soft)">พิมพ์เพื่อสร้างใหม่</div>`;
  p.innerHTML=html;
}
function agSubDDShow(){ const p=document.getElementById('ag-sub-panel'); const i=document.getElementById('ag-sub-input'); if(p&&i){ agSubDDRender(i.value); p.style.display='block'; } }
function agSubDDHide(){ const p=document.getElementById('ag-sub-panel'); if(p) setTimeout(()=>{ p.style.display='none'; },150); }
function agSubDDFilter(v){ agEditSetField('sub',v); agSubDDRender(v); const p=document.getElementById('ag-sub-panel'); if(p) p.style.display='block'; }
// Remember a (possibly new) sub-market under its Market → persists to SB_MARKETS for reuse + analysis
function agSubMarketRemember(marketId, sub){
  sub=(sub||'').trim(); if(!sub||!marketId) return false;
  const m=(typeof SB_MARKETS!=='undefined'?SB_MARKETS:[]).find(x=>x.id===marketId);
  if(!m) return false;
  if(!Array.isArray(m.subs)) m.subs=[];
  if(m.subs.some(s=>String(s).toLowerCase()===sub.toLowerCase())) return false; // already known
  m.subs.push(sub);
  if(typeof sbMarketsPersist==='function') sbMarketsPersist();
  return true;
}
function agSubDDPick(v){
  agEditSetField('sub',v);
  const mid=_agEditDraft&&_agEditDraft.market;
  if(agSubMarketRemember(mid, v)){ const m=SB_MARKETS.find(x=>x.id===mid); if(m) _agSubOpts=m.subs.slice(); }
  const i=document.getElementById('ag-sub-input'); if(i) i.value=v;
  const p=document.getElementById('ag-sub-panel'); if(p) p.style.display='none';
}

function agEditSetNested(obj, key, val){
  // For programPeriods rows: agEditSetNested('programPeriods', idx, fieldName, value)
  // But we'll keep it simple: pp uses direct array index access in builder
}

function agEditRender(){
  const body = document.getElementById('ag-edit-body');
  const ttl = document.getElementById('ag-edit-ttl');
  const sec = _agEditSection;
  const d = _agEditDraft;
  if(!d) return;

  if(sec==='sales'){
    ttl.textContent = 'แก้ไข Sales Person (ผู้ดูแล)';
    body.innerHTML = `
      <div class="ag-fld">
        <label class="ag-fld-lbl">Sales Person <span class="req">*</span></label>
        <select onchange="agEditSetField('sales', this.value)">
          <option value="">— ไม่ระบุ —</option>
          ${SB_SALES.map(s=>`<option value="${s.id}" ${d.sales===s.id?'selected':''}>${s.code} · ${s.name}${s.fullName?` (${s.fullName})`:''}</option>`).join('')}
        </select>
        <div class="ag-fld-hint">Sales Person ที่ดูแล Agent นี้ จะเป็นคนเซ็นสัญญาฝั่ง Love Andaman ด้วย</div>
      </div>
    `;
  }
  else if(sec==='programs'){
    ttl.textContent = 'แก้ไข Programs in Contract';
    // ─── Coverage check vs bound Rate Type ───
    const aObj = _agEditAgentId ? sbGetAgent(_agEditAgentId) : null;
    const rtObj = (aObj && aObj.rateTypeId && typeof getRateType==='function') ? getRateType(aObj.rateTypeId) : null;
    const contractedRouteIds = (d.programPeriods||[]).map(p => p.routeId);
    const rtRouteIds = rtObj ? (rtObj.routes||[]) : [];
    const missingRouteIds = rtRouteIds.filter(rId => !contractedRouteIds.includes(rId));
    const orphanRouteIds  = contractedRouteIds.filter(rId => rId && !rtRouteIds.includes(rId));
    let coverageBanner = '';
    if(rtObj){
      const rtTint = rtObj.color + '14';
      const headerChip = `<span style="display:inline-flex;align-items:center;gap:5px;background:${rtTint};color:${rtObj.color};padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">↳ ${rtObj.code}</span>`;
      const statusOk = missingRouteIds.length === 0 && orphanRouteIds.length === 0;
      if(statusOk){
        coverageBanner = `<div style="background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:9px 13px;margin-bottom:10px;display:flex;align-items:center;gap:10px;font-size:11px">
          ${headerChip}
          <span style="color:#0F6E56;font-weight:600">✓ Programs ครอบคลุมทุก route ใน Rate Type</span>
          <span style="color:var(--fd-ink-soft);font-size:10.5px">${contractedRouteIds.length} / ${rtRouteIds.length} routes</span>
        </div>`;
      } else {
        const missingChips = missingRouteIds.map(rId => {
          const r = ROUTES.find(x => x.id === rId);
          return `<span style="background:#fff;border:1px dashed #C8C6BF;color:var(--fd-ink-mid);padding:2px 8px;border-radius:9px;font-size:10px;font-weight:500">${r ? r.name : rId}</span>`;
        }).join(' ');
        const orphanChips = orphanRouteIds.map(rId => {
          const r = ROUTES.find(x => x.id === rId);
          return `<span style="background:#FDECEA;color:#A32D2D;padding:2px 8px;border-radius:9px;font-size:10px;font-weight:600">${r ? r.name : rId}</span>`;
        }).join(' ');
        coverageBanner = `<div style="background:#FFF5EB;border:1px solid #F5C896;border-radius:8px;padding:10px 13px;margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:${(missingChips||orphanChips)?'8px':'0'}">
            <div style="display:flex;align-items:center;gap:10px">
              ${headerChip}
              <span style="color:#854F0B;font-weight:600;font-size:11px">⚠ Programs ไม่ตรงกับ Rate Type</span>
              <span style="color:var(--fd-ink-soft);font-size:10.5px">${contractedRouteIds.length} / ${rtRouteIds.length} routes covered</span>
            </div>
            ${missingRouteIds.length ? `<button onclick="agEditPPAddMissing()" type="button" style="background:#854F0B;color:#fff;border:none;font-family:inherit;font-size:10.5px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;gap:5px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:11px;height:11px"><path d="M12 5v14M5 12h14"/></svg>
              Add missing · ${missingRouteIds.length}
            </button>` : ''}
          </div>
          ${missingChips ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px"><span style="font-size:9.5px;color:var(--fd-ink-soft);font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-right:4px">Missing</span>${missingChips}</div>` : ''}
          ${orphanChips ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px"><span style="font-size:9.5px;color:#A32D2D;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-right:4px">Orphan</span>${orphanChips}<span style="font-size:10px;color:#A32D2D;margin-left:6px;font-style:italic">route นี้ไม่อยู่ใน Rate Type · Travel period จะว่าง</span></div>` : ''}
        </div>`;
      }
    }
    body.innerHTML = `
      <div style="font-size:11px;color:var(--fd-ink-soft);line-height:1.5;margin-bottom:8px">
        ระบุโปรแกรมในสัญญา · Booking Period กรอกเอง · Travel Period inherit จาก Rate Type
      </div>
      ${coverageBanner}
      <div id="ag-edit-pp-list" style="display:flex;flex-direction:column;gap:8px">
        ${d.programPeriods.map((p,i)=>agEditRenderPP(p,i)).join('')}
      </div>
      <button class="ag-pp-add" onclick="agEditPPAdd()" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มโปรแกรม
      </button>
    `;
  }
  else if(sec==='profile'){
    ttl.textContent = 'แก้ไข Payment Details';
    body.innerHTML = `
      <div style="font-size:11px;color:var(--fd-ink-soft);line-height:1.5;margin-bottom:4px">
        กำหนดประเภทการชำระเงิน · เครดิต · วงเงิน · ยอดคงเหลือ
      </div>
      <div class="ag-fld-row-3">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Payment Type</label>
          <select onchange="agEditSetField('payType',this.value)">
            <option value="invoice"  ${d.payType==='invoice'?'selected':''}>Invoice (Credit)</option>
            <option value="proforma" ${d.payType==='proforma'?'selected':''}>Pro Forma</option>
            <option value="cot"      ${d.payType==='cot'?'selected':''}>Cash on Tour</option>
            <option value="bank"     ${d.payType==='bank'?'selected':''}>Bank Transfer</option>
          </select>
          <div class="ag-fld-hint">Invoice = ให้เครดิต วางบิลทีหลัง · Pro Forma / Bank = จ่ายก่อนเดินทาง · Cash on Tour = เก็บเงินสดวันเดินทาง</div>
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Credit Days</label>
          <input type="number" min="0" value="${d.creditDays||0}" oninput="agEditSetField('creditDays',parseInt(this.value)||0)">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Credit Limit (฿)</label>
          <input type="number" min="0" value="${d.creditLimit||0}" oninput="agEditSetField('creditLimit',parseInt(this.value)||0)">
        </div>
      </div>
      <div class="ag-fld" style="margin-top:10px">
        <label class="ag-fld-lbl">VAT · ภาษีมูลค่าเพิ่ม</label>
        <select onchange="agEditSetField('vatMode',this.value)">
          <option value="none"    ${(d.vatMode||'none')==='none'?'selected':''}>ไม่มี VAT</option>
          <option value="exclude" ${d.vatMode==='exclude'?'selected':''}>Exclude VAT · ราคา Net + 7%</option>
          <option value="include" ${d.vatMode==='include'?'selected':''}>Include VAT · ราคารวม 7% แล้ว</option>
        </select>
        <div class="ag-fld-hint">Exclude = บวก 7% เพิ่มตอนวางบิล (ลูกค้าจ่ายเพิ่ม) · Include = ราคารวม VAT แล้ว (ใบแจ้งหนี้ถอด VAT ให้เห็น) · None = ไม่คิดภาษี</div>
      </div>
      <div class="ag-fld">
        <label class="ag-fld-lbl">Credit Balance (Remaining ฿)</label>
        <input type="number" min="0" value="${d.creditBalance||0}" oninput="agEditSetField('creditBalance',parseInt(this.value)||0)">
        <div class="ag-fld-hint">ยอด credit ที่เหลือใช้ได้ (Limit - Used)</div>
      </div>
    `;
  }
  else if(sec==='company'){
    ttl.textContent = 'แก้ไข Company Information';
    const _agMkt = (typeof SB_MARKETS!=='undefined'?SB_MARKETS:[]).find(m=>m.id===d.market);
    _agSubOpts = (_agMkt && Array.isArray(_agMkt.subs)) ? _agMkt.subs.slice() : [];
    const _agMktName = _agMkt ? _agMkt.name : 'market';
    body.innerHTML = `
      <div class="ag-fld">
        <label class="ag-fld-lbl">Company Name (ชื่อในระบบ) <span class="req">*</span></label>
        <input type="text" value="${d.name||''}" oninput="agEditSetField('name',this.value)" placeholder="เช่น ALL IN TRAVEL">
        <div class="ag-fld-hint">ชื่อที่ทีมเรียก/รู้จัก · ใช้แสดงในระบบ</div>
      </div>
      <div class="ag-fld">
        <label class="ag-fld-lbl">สี Agent (แสดงในตาราง By trip date)</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="color" value="${d.color||(typeof bkV2AgentColor==='function'?bkV2AgentColor(_agEditAgentId):'#888888')}" oninput="agEditSetField('color',this.value)" style="width:46px;height:30px;border:1px solid var(--fd-line,#ddd);border-radius:7px;background:#fff;cursor:pointer;padding:2px">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#fff;background:${d.color||(typeof bkV2AgentColor==='function'?bkV2AgentColor(_agEditAgentId):'#888')};border-radius:6px;padding:3px 9px;font-weight:600">${_agSubEsc(d.name||'Agent')}</span>
          <span style="font-size:11px;color:#8a8a82">${d.color?'ตั้งเอง':'อัตโนมัติ (ตาม id)'}</span>
          ${d.color?`<button type="button" onclick="agEditSetField('color','');agEditRender()" style="font-size:11px;border:1px solid var(--fd-line,#ddd);background:#fff;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit">ใช้สีอัตโนมัติ</button>`:''}
        </div>
        <div class="ag-fld-hint">เว้นว่าง = ระบบเลือกสีให้อัตโนมัติ · ตั้งเองแล้วจะจดจำใช้ตลอด</div>
      </div>
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Company Legal Name <span class="req">*</span></label>
          <input type="text" value="${d.legalName||''}" oninput="agEditSetField('legalName',this.value)" placeholder="เช่น ALL IN TRAVEL CO., LTD">
          <div class="ag-fld-hint">ชื่อเต็มตามกฎหมาย · ใช้ในสัญญา PDF</div>
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">TAT License No.</label>
          <input type="text" value="${d.tatLicense||''}" oninput="agEditSetField('tatLicense',this.value)" placeholder="เช่น 31/00986">
        </div>
      </div>

      <div class="ag-edit-subhd">Classification</div>
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Market <span class="req">*</span></label>
          <select onchange="agEditSetField('market',this.value);agEditSetField('sub','');agEditRender()">
            ${SB_MARKETS.map(m=>`<option value="${m.id}" ${d.market===m.id?'selected':''}>${m.name}</option>`).join('')}
          </select>
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Sub-market</label>
          <div style="position:relative">
            <input id="ag-sub-input" type="text" autocomplete="off" value="${d.sub||''}" oninput="agSubDDFilter(this.value)" onfocus="agSubDDShow()" onblur="agSubDDHide()" placeholder="เลือกหรือพิมพ์ · เช่น OTA-INT" style="padding-right:28px">
            <span style="position:absolute;right:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--fd-ink-soft);font-size:9px">&#9660;</span>
            <div id="ag-sub-panel" class="ag-sub-dd" style="display:none"></div>
          </div>
          <div class="ag-fld-hint">เลือกจาก ${_agMktName} หรือพิมพ์ใหม่ได้</div>
        </div>
      </div>

      <div class="ag-edit-subhd">Contact</div>
      <div class="ag-fld">
        <label class="ag-fld-lbl">Address</label>
        <textarea oninput="agEditSetField('address',this.value)" placeholder="ที่อยู่บริษัท">${d.address||''}</textarea>
      </div>
      <div class="ag-fld-row-3">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Telephone</label>
          <input type="text" value="${d.tel||''}" oninput="agEditSetField('tel',this.value)" placeholder="02-XXX-XXXX">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Hotline</label>
          <input type="text" value="${d.hotline||''}" oninput="agEditSetField('hotline',this.value)" placeholder="08X-XXX-XXXX">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Fax</label>
          <input type="text" value="${d.fax||''}" oninput="agEditSetField('fax',this.value)" placeholder="(ถ้ามี)">
        </div>
      </div>
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Email</label>
          <input type="email" value="${d.email||''}" oninput="agEditSetField('email',this.value)" placeholder="contact@example.com">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Website</label>
          <input type="text" value="${d.website||''}" oninput="agEditSetField('website',this.value)" placeholder="example.com">
        </div>
      </div>
    `;
  }
  else if(sec==='signatory'){
    ttl.textContent = 'แก้ไข Agent Signatory (ผู้เซ็นฝั่ง Agent)';
    body.innerHTML = `
      <div style="font-size:11px;color:var(--fd-ink-soft);line-height:1.5;margin-bottom:4px">
        ผู้เซ็นสัญญาฝั่ง Agent (ฝั่ง Love Andaman ระบบจะดึงจาก Sales Person ที่ดูแล)
      </div>
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Name <span class="req">*</span></label>
          <input type="text" value="${d.name||''}" oninput="agEditSetField('name',this.value)" placeholder="ชื่อผู้เซ็น">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Designation</label>
          <input type="text" value="${d.designation||''}" oninput="agEditSetField('designation',this.value)" placeholder="เช่น Managing Director">
        </div>
      </div>
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Telephone</label>
          <input type="text" value="${d.tel||''}" oninput="agEditSetField('tel',this.value)" placeholder="เบอร์ติดต่อ">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Signed Date</label>
          <input type="date" value="${d.signedDate||''}" oninput="agEditSetField('signedDate',this.value)">
          <div class="ag-fld-hint">วันที่เซ็นสัญญา (ว่างไว้ = ยังไม่เซ็น)</div>
        </div>
      </div>
    `;
  }
  else if(sec==='booking'){
    ttl.textContent = 'แก้ไข Booking Channel';
    body.innerHTML = `
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Booking Method</label>
          <input type="text" value="${d.method||''}" oninput="agEditSetField('method',this.value)" placeholder="เช่น Email + Phone, API, ฯลฯ">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Cutoff Time</label>
          <input type="text" value="${d.cutoff||''}" oninput="agEditSetField('cutoff',this.value)" placeholder="เช่น 1 วันก่อน 18:00">
        </div>
      </div>
      <div class="ag-fld">
        <label class="ag-fld-lbl">Cancellation Policy</label>
        <input type="text" value="${d.cancelPolicy||''}" oninput="agEditSetField('cancelPolicy',this.value)" placeholder="เช่น < 1 day = 50% · No-show = 100%">
      </div>
      <div class="ag-fld-row">
        <div class="ag-fld">
          <label class="ag-fld-lbl">Booking Email</label>
          <input type="email" value="${d.email||''}" oninput="agEditSetField('email',this.value)" placeholder="book@loveandaman.com">
        </div>
        <div class="ag-fld">
          <label class="ag-fld-lbl">Booking Phone</label>
          <input type="text" value="${d.phone||''}" oninput="agEditSetField('phone',this.value)" placeholder="+66 88 XXX XXXX">
        </div>
      </div>
    `;
  }
  else if(sec==='notes'){
    ttl.textContent = 'แก้ไข Internal Notes';
    body.innerHTML = `
      <div class="ag-fld">
        <label class="ag-fld-lbl">Internal Notes (ไม่แสดงในสัญญา)</label>
        <textarea rows="6" oninput="agEditSetField('note',this.value)" placeholder="โน้ตภายในของทีม · ใช้แสดงในระบบเท่านั้น">${d.note||''}</textarea>
        <div class="ag-fld-hint">ขึ้นบรรทัดใหม่ได้ — โน้ตนี้จะไม่ออกในสัญญา PDF</div>
      </div>
    `;
  }
  else if(sec==='ratetype'){
    ttl.textContent = 'เลือก Rate Type';
    body.innerHTML = agEditBuildRateTypePicker();
  }
  else if(sec==='contracttmpl'){
    ttl.textContent = 'เลือก Contract Template';
    body.innerHTML = agEditBuildTmplPicker();
  }
}

/* §template · รายการ template ให้เลือก · "ใช้ค่าตั้งต้น" = ไม่ผูก (contractTemplateId = null)
   ต่างจาก Rate Type ตรงที่ "ไม่เลือก" ไม่ได้แปลว่าไม่มีสัญญา — แปลว่าใช้ตัว default ซึ่งเปลี่ยนตามส่วนกลางได้ */
function agEditBuildTmplPicker(){
  const d = _agEditDraft;
  const all = (typeof ctTmplAll==='function') ? ctTmplAll().filter(t=>t.active) : [];
  const def = (typeof ctTmplDefault==='function') ? ctTmplDefault() : null;
  const esc = s => String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const row = (t) => {
    const on = d.contractTemplateId === t.id;
    return `<div onclick="agEditSetField('contractTemplateId','${t.id}');agEditRender()" style="display:flex;align-items:center;gap:11px;padding:11px 13px;border-top:1px solid var(--fd-line-soft);cursor:pointer;background:${on?'#F3FBF7':'#fff'}">
      <span style="width:16px;height:16px;border-radius:50%;border:2px solid ${on?'#0F6E56':'#d4d1c9'};background:${on?'#0F6E56':'#fff'};flex:none;box-shadow:${on?'inset 0 0 0 3px #fff':'none'}"></span>
      <span style="flex:1;min-width:0">
        <span style="font-size:12.5px;font-weight:600;color:var(--fd-ink)">${esc(t.name)}</span>
        ${t.isDefault?'<span style="margin-left:7px;font-size:9px;font-weight:700;background:#E1F5EE;color:#0F6E56;border-radius:5px;padding:1px 7px">DEFAULT</span>':''}
        <div style="font-size:10px;color:var(--fd-ink-soft);font-variant-numeric:tabular-nums;margin-top:1px">${esc(t.code||t.id)}${t.note?(' · '+esc(t.note)):''}</div>
      </span>
    </span></div>`;
  };
  const noneOn = !d.contractTemplateId;
  const noneRow = `<div onclick="agEditSetField('contractTemplateId',null);agEditRender()" style="display:flex;align-items:center;gap:11px;padding:11px 13px;cursor:pointer;background:${noneOn?'#F3FBF7':'#fff'}">
    <span style="width:16px;height:16px;border-radius:50%;border:2px solid ${noneOn?'#0F6E56':'#d4d1c9'};background:${noneOn?'#0F6E56':'#fff'};flex:none;box-shadow:${noneOn?'inset 0 0 0 3px #fff':'none'}"></span>
    <span style="flex:1;min-width:0">
      <span style="font-size:12.5px;font-weight:600;color:var(--fd-ink)">ใช้ค่าตั้งต้นของระบบ</span>
      <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:1px">ตอนนี้คือ <b>${esc(def?def.name:'— ยังไม่มี template')}</b> · ถ้าเปลี่ยน default ส่วนกลาง เอเยนต์นี้เปลี่ยนตาม</div>
    </span></div>`;
  return `<div class="ag-fld">
    <label class="ag-fld-lbl">Contract Template</label>
    <div style="border:1px solid var(--fd-line);border-radius:8px;overflow:hidden;background:#fff">${noneRow}${all.map(row).join('')}</div>
    <div class="ag-fld-hint">ข้อความในสัญญา (ข้อยกเลิก · ข้อจำกัดสุขภาพ · ข้อกฎหมาย) ดึงจาก template นี้ · <b>ราคายังมาจาก Rate Type เหมือนเดิม</b><br>สัญญาที่ export ไปแล้วจะไม่เปลี่ยนตาม — มันเก็บข้อความ ณ วันที่สร้างไว้แล้ว</div>
  </div>`;
}
function agEditRTToggleAll(){ _agEditRTAll=!_agEditRTAll; agEditRender(); }
function agEditBuildRateTypePicker(){
  const d = _agEditDraft;
  const esc = s => String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const currentId = d.rateTypeId;
  // §rtBySales · เห็นเฉพาะเรทของเซลล์เจ้าของ + ส่วนกลาง · เรทของเซลล์อื่นซ่อนไว้ กดดูได้
  const _G = rtForSales(d.sales||'', currentId);
  const _salesNm = (d.sales && typeof sbGetSales==='function') ? ((sbGetSales(d.sales)||{}).name||'') : '';
  // §rtLoginScope · ทั้งปุ่ม "แสดงเรทของเซลล์อื่น" และกรณี agent ยังไม่ได้ตั้งเซลล์ ต้องอยู่ในสิทธิ์ของคน login
  const _rtPool = (typeof rtScopeList==='function') ? rtScopeList((SB_RATE_TYPES||[]).slice(), currentId) : (SB_RATE_TYPES||[]).slice();
  const _hidden = _G.noSales ? 0 : _rtPool.filter(r=>r.active!==false && _rtOwnerId(r) && _rtOwnerId(r)!==d.sales && r.id!==currentId).length;
  const items = (_G.noSales || _agEditRTAll)
    ? _rtPool.slice().sort((a,b) => {
        if((a.active!==false) !== (b.active!==false)) return (a.active!==false) ? -1 : 1;
        return (a.code||'').localeCompare(b.code||'');
      })
    : _G.all;
  const rows = items.map(rt => {
    const isInactive = rt.active === false;
    const isSel = rt.id === currentId;
    const tint = (rt.color||'#666') + '14';
    const nRoutes = (rt.routes||[]).length;
    const hasCharter = Object.keys(rt.charterRates||{}).length > 0;
    const nAddOns = Object.keys(rt.addOns||{}).length;
    const validHint = (rt.validFrom||rt.validTo)
      ? `${_rtFmtDate(rt.validFrom)||'—'} → ${_rtFmtDate(rt.validTo)||'—'}`
      : 'always valid';
    if(isInactive && !isSel){
      // Inactive option: greyed out, cannot click
      return `<div title="Rate Type ถูก Deactivate · ไปที่ Rate Types page เพื่อ Activate ก่อน" style="padding:10px 13px;border-top:1px solid var(--fd-line-soft);background:#fafaf8;cursor:not-allowed;opacity:.6">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="background:#fff;color:#5F5E5A;font-size:9.5px;padding:2px 7px;border-radius:6px;font-weight:600;font-variant-numeric:tabular-nums">${rt.code||''}</span>
          <span style="font-size:12px;font-weight:600;color:var(--fd-ink-soft);text-decoration:line-through">${rt.name||''}</span>
          <span style="background:#F1EFE8;color:#5F5E5A;font-size:9px;padding:1px 6px;border-radius:5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Inactive</span>
        </div>
        <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:3px">Cannot be assigned · ${nRoutes} routes${hasCharter?' · charter':''} · ${validHint}</div>
      </div>`;
    }
    // Inactive but currently selected: show with warning
    if(isInactive && isSel){
      return `<div onclick="agEditSetField('rateTypeId',null);agEditRender()" style="padding:10px 13px;border-top:1px solid var(--fd-line-soft);background:#FFF5EB;cursor:pointer">
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:${tint};color:${rt.color};font-size:9.5px;padding:2px 7px;border-radius:6px;font-weight:600;font-variant-numeric:tabular-nums">${rt.code||''}</span>
            <span style="font-size:12px;font-weight:600;color:#854F0B">${rt.name||''}</span>
            <span style="background:#FFF5EB;color:#854F0B;font-size:9px;padding:1px 6px;border-radius:5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Inactive · Selected</span>
          </div>
          <span style="font-size:10px;color:#854F0B;font-weight:600">⚠ Click to unbind</span>
        </div>
        <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:3px">Rate Type นี้ถูก Deactivate · agent ยังผูกอยู่ — แนะนำให้เปลี่ยน หรือ activate ใน Rate Types page</div>
      </div>`;
    }
    return `<div onclick="agEditSetField('rateTypeId','${rt.id}');agEditRender()" style="padding:10px 13px;border-top:1px solid var(--fd-line-soft);background:${isSel?tint:'#fff'};cursor:pointer">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="background:${isSel?'#fff':tint};color:${rt.color};font-size:9.5px;padding:2px 7px;border-radius:6px;font-weight:700;font-variant-numeric:tabular-nums">${rt.code||''}</span>
          <span style="font-size:12.5px;font-weight:600;color:${isSel?rt.color:'var(--fd-ink)'}">${rt.name||''}</span>
          <span style="background:#E1F5EE;color:#0F6E56;font-size:9px;padding:1px 6px;border-radius:5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Active</span>
        </div>
        ${isSel?`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${rt.color}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`:''}
      </div>
      <div style="font-size:10.5px;color:${isSel?rt.color:'var(--fd-ink-soft)'};margin-top:3px;${isSel?'opacity:.85':''}">${nRoutes} routes${hasCharter?' · charter':''}${nAddOns>0?' · '+nAddOns+' add-on'+(nAddOns>1?'s':''):''} · ${validHint}</div>
    </div>`;
  }).join('');
  // "No rate type" option at bottom
  const isNone = !currentId;
  const noneRow = `<div onclick="agEditSetField('rateTypeId',null);agEditRender()" style="padding:10px 13px;border-top:1px solid var(--fd-line-soft);background:${isNone?'#FCEBEB':'#fff'};cursor:pointer">
    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        <span style="font-size:12px;font-weight:600;color:#A32D2D">No rate type</span>
      </div>
      ${isNone?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
    </div>
    <div style="font-size:10.5px;color:#A32D2D;margin-top:3px;opacity:.85">Agent นี้จะไม่มีราคา default — ต้องใส่ราคาเองทุก booking</div>
  </div>`;
  // Preview section
  const previewHtml = currentId ? agEditBuildRTPreview(getRateType(currentId)) : '';
  return `
    <div class="ag-fld">
      <label class="ag-fld-lbl">Rate Type · Pricing Package</label>
      <div style="border:1px solid var(--fd-line);border-radius:8px;overflow:hidden;background:#fff">
        ${rows}${noneRow}
      </div>
      <div class="ag-fld-hint">${_G.noSales
        ? '<b style="color:#854F0B">&#9888; Agent นี้ยังไม่ได้ระบุเซลล์ผู้ดูแล</b> — เลยกรองให้ไม่ได้ กำลังแสดงเรททั้งหมด ตั้งเซลล์ก่อนแล้วลิสต์จะสั้นลงเอง'
        : ('แสดงเฉพาะ <b>เรทของ '+esc(_salesNm||'เซลล์ผู้ดูแล')+'</b> ('+_G.own.length+') และ <b>ส่วนกลาง</b> ('+_G.shared.length+')'
           + (_G.other.length?' · รวมเรทของเซลล์อื่นที่ผูกไว้อยู่แล้ว '+_G.other.length:'')
           + (_hidden?(' · ซ่อนเรทของเซลล์อื่นอยู่ '+_hidden+' รายการ'):''))}
        <br>ราคาทั้งหมด (seat/charter/add-ons) จะ resolve จาก rate type นี้</div>
      ${(!_G.noSales && (_hidden||_agEditRTAll))?`<div style="margin-top:7px"><button onclick="agEditRTToggleAll()" style="border:1px solid var(--fd-line);background:#fff;color:var(--fd-ink-soft);border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit">${_agEditRTAll?'ซ่อนเรทของเซลล์อื่น':('แสดงเรทของเซลล์อื่นด้วย ('+_hidden+')')}</button></div>`:''}
    </div>
    ${previewHtml}
  `;
}

function agEditBuildRTPreview(rt){
  if(!rt) return '';
  const ROUTES_ARR = (typeof ROUTES !== 'undefined' && ROUTES) || [];
  const fmt = n => (n||0).toLocaleString();
  // Pick first route for seat preview
  const firstRoute = (rt.routes||[])[0];
  const rName = id => (ROUTES_ARR.find(r=>r.id===id)||{}).name || id;
  let seatPreview = '—';
  let seatLbl = '';
  if(firstRoute && rt.seatRates && rt.seatRates[firstRoute]){
    const z = rt.seatRates[firstRoute].PK || rt.seatRates[firstRoute].NoTransfer || {};
    if(z['adult-thai'] || z['adult-fr']){
      seatPreview = `${fmt(z['adult-thai'])} / ${fmt(z['adult-fr'])}`;
      seatLbl = `${rName(firstRoute)} · PK · Adult TH/FR`;
    }
  }
  // First charter
  const charterEntries = [];
  Object.keys(rt.charterRates||{}).forEach(rId => {
    Object.keys(rt.charterRates[rId]).forEach(bt => {
      charterEntries.push({rId, bt, ch:rt.charterRates[rId][bt]});
    });
  });
  let charterPreview = '—', charterLbl = 'No charter';
  if(charterEntries.length){
    const c = charterEntries[0];
    charterPreview = `${fmt(c.ch.starterPrice)}`;
    charterLbl = `${rName(c.rId)} · ${c.bt} · starter / ${c.ch.starterIncludes||4} pax · +${fmt(c.ch.extraPerPax)} ea`;
  }
  // First add-on (longtail or transfer)
  const _ap = (typeof _rtAddonPreview==='function')?_rtAddonPreview(rt):{preview:'—',lbl:'No add-on'};
  let addOnPreview = _ap.preview, addOnLbl = _ap.lbl;
  const tint = rt.color + '14';
  return `<div class="ag-fld" style="margin-top:4px">
    <label class="ag-fld-lbl">Preview · ตัวอย่างราคาที่ resolve จาก rate type นี้</label>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div style="background:${tint};border-radius:8px;padding:10px 12px">
        <div style="font-size:9.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Seat</div>
        <div style="font-size:15px;font-weight:700;color:${rt.color};font-variant-numeric:tabular-nums;margin-top:3px">${seatPreview}</div>
        <div style="font-size:9.5px;color:var(--fd-ink-soft);margin-top:2px">${seatLbl||'No seat rate'}</div>
      </div>
      <div style="background:${tint};border-radius:8px;padding:10px 12px">
        <div style="font-size:9.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Charter</div>
        <div style="font-size:15px;font-weight:700;color:${rt.color};font-variant-numeric:tabular-nums;margin-top:3px">${charterPreview}</div>
        <div style="font-size:9.5px;color:var(--fd-ink-soft);margin-top:2px">${charterLbl}</div>
      </div>
      <div style="background:${tint};border-radius:8px;padding:10px 12px">
        <div style="font-size:9.5px;color:var(--fd-ink-soft);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Add-on</div>
        <div style="font-size:15px;font-weight:700;color:${rt.color};font-variant-numeric:tabular-nums;margin-top:3px">${addOnPreview}</div>
        <div style="font-size:9.5px;color:var(--fd-ink-soft);margin-top:2px">${addOnLbl}</div>
      </div>
    </div>
  </div>`;
}

function agEditRenderPP(p, i){
  // Travel Period is FULLY OWNED by Rate Type · agent cannot edit travel dates here
  const a  = _agEditAgentId ? sbGetAgent(_agEditAgentId) : null;
  const rt = (a && a.rateTypeId && typeof getRateType==='function') ? getRateType(a.rateTypeId) : null;
  const rv = (rt && rt.routeValidity && rt.routeValidity[p.routeId]) || null;
  // Effective travel dates always come from rate type; if missing → empty
  const travelFrom = rv ? (rv.from||'') : '';
  const travelTo   = rv ? (rv.to||'')   : '';
  // Sync inherited dates back into draft so save() captures snapshot of rate type's dates
  if(_agEditDraft && _agEditDraft.programPeriods && _agEditDraft.programPeriods[i]){
    _agEditDraft.programPeriods[i].travelFrom = travelFrom;
    _agEditDraft.programPeriods[i].travelTo   = travelTo;
  }
  // Status messaging based on rt + rv state
  let badge = '';
  let hint = '';
  if(rt && rv){
    badge = `<span style="display:inline-flex;align-items:center;gap:5px;background:${rt.color}1A;color:${rt.color};padding:2px 9px;border-radius:10px;font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-left:6px" title="Owned by Rate Type · edit there to change">
              ↳ from ${rt.code}
            </span>`;
    hint = `<div style="font-size:10px;color:var(--fd-ink-soft);margin-top:5px;line-height:1.4">Travel period mirrors <strong style="color:${rt.color}">${rt.name}</strong> · edit in <em>Rate Types → ${rt.code}</em> to change</div>`;
  } else if(rt && !rv){
    badge = `<span style="display:inline-flex;align-items:center;gap:5px;background:#FFF5EB;color:#854F0B;padding:2px 9px;border-radius:10px;font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-left:6px">
              ⚠ Not set in ${rt.code}
            </span>`;
    hint = `<div style="font-size:10px;color:#854F0B;margin-top:5px;line-height:1.4">Rate Type <strong>${rt.name}</strong> ยังไม่ได้ตั้ง Active period สำหรับเส้นทางนี้ · ไปตั้งใน <em>Rate Types → ${rt.code} → § 1 Seat rates → Active</em></div>`;
  } else {
    badge = `<span style="display:inline-flex;align-items:center;gap:5px;background:#FCEBEB;color:#A32D2D;padding:2px 9px;border-radius:10px;font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-left:6px">
              ⚠ No Rate Type
            </span>`;
    hint = `<div style="font-size:10px;color:#A32D2D;margin-top:5px;line-height:1.4">Agent ยังไม่ได้ผูก Rate Type · Travel period ต้องดึงจาก Rate Type · ตั้งใน <em>Agent → Rate Type</em> ก่อน</div>`;
  }
  // Inputs are ALWAYS disabled — travel dates are not user-editable here
  const lockedAttrs = 'disabled style="background:#F5F4EE;color:#5F5E5A;cursor:not-allowed"';
  return `
    <div class="ag-pp-row" data-idx="${i}">
      <div class="ag-pp-row-hd">
        <div class="ag-pp-route-pick ag-fld">
          <select onchange="agEditPPSetRoute(${i}, this.value)">
            ${ROUTES.map(r=>`<option value="${r.id}" ${p.routeId===r.id?'selected':''}>${r.name}</option>`).join('')}
          </select>
        </div>
        <button class="ag-pp-row-rm" onclick="agEditPPRemove(${i})" type="button" title="ลบ">✕</button>
      </div>
      <div class="ag-pp-dates">
        <div class="ag-pp-period-block">
          <div class="ag-pp-period-ttl book">Booking Period</div>
          <div class="ag-pp-period-inputs">
            <div class="ag-fld"><input type="date" value="${p.bookFrom||''}" onchange="agEditPPSet(${i},'bookFrom',this.value)"></div>
            <div class="ag-fld"><input type="date" value="${p.bookTo||''}" onchange="agEditPPSet(${i},'bookTo',this.value)"></div>
          </div>
        </div>
        <div class="ag-pp-period-block">
          <div class="ag-pp-period-ttl travel">Travel Period ${badge}</div>
          <div class="ag-pp-period-inputs">
            <div class="ag-fld"><input type="date" value="${travelFrom}" ${lockedAttrs}></div>
            <div class="ag-fld"><input type="date" value="${travelTo}"   ${lockedAttrs}></div>
          </div>
          ${hint}
        </div>
      </div>
      <div class="ag-fld">
        <input type="text" placeholder="โน้ตเพิ่มเติม (เช่น 'Includes Long-tail boat')" value="${p.note||''}" oninput="agEditPPSet(${i},'note',this.value)">
      </div>
    </div>
  `;
}

function agEditPPSet(idx, key, val){
  if(!_agEditDraft?.programPeriods) return;
  if(_agEditDraft.programPeriods[idx]) _agEditDraft.programPeriods[idx][key] = val;
}

function agEditPPSetRoute(idx, routeId){
  if(!_agEditDraft?.programPeriods) return;
  if(_agEditDraft.programPeriods[idx]) _agEditDraft.programPeriods[idx].routeId = routeId;
  // Re-render so Travel Period reflects the new route's inherited validity from Rate Type
  agEditRender();
}

function agEditPPAdd(){
  if(!_agEditDraft?.programPeriods) _agEditDraft.programPeriods = [];
  // Pick first route not already used
  const usedIds = _agEditDraft.programPeriods.map(p=>p.routeId);
  const firstAvail = ROUTES.find(r=>!usedIds.includes(r.id)) || ROUTES[0];
  _agEditDraft.programPeriods.push({
    routeId:firstAvail?.id||'r1',
    bookFrom:'2025-10-01', bookTo:'2026-09-30',
    travelFrom:'2025-10-01', travelTo:'2026-09-30',
    note:''
  });
  agEditRender();
}

// Bulk-add all routes from agent's bound Rate Type that aren't yet in programPeriods
function agEditPPAddMissing(){
  if(!_agEditDraft) return;
  if(!_agEditDraft.programPeriods) _agEditDraft.programPeriods = [];
  const aObj = _agEditAgentId ? sbGetAgent(_agEditAgentId) : null;
  const rtObj = (aObj && aObj.rateTypeId && typeof getRateType==='function') ? getRateType(aObj.rateTypeId) : null;
  if(!rtObj) return;
  const usedIds = _agEditDraft.programPeriods.map(p=>p.routeId);
  const missing = (rtObj.routes||[]).filter(rId => !usedIds.includes(rId));
  if(!missing.length) return;
  missing.forEach(rId => {
    const rv = (rtObj.routeValidity && rtObj.routeValidity[rId]) || {};
    _agEditDraft.programPeriods.push({
      routeId: rId,
      // Booking Period defaults — user edits these
      bookFrom: '2025-10-01', bookTo: '2026-09-30',
      // Travel Period inherits from Rate Type's routeValidity (empty if not set there)
      travelFrom: rv.from || '', travelTo: rv.to || '',
      note: ''
    });
  });
  agEditRender();
}

function agEditPPRemove(idx){
  if(!_agEditDraft?.programPeriods) return;
  if(!confirm('ลบโปรแกรมนี้ออกจากสัญญา?')) return;
  _agEditDraft.programPeriods.splice(idx,1);
  agEditRender();
}

function agEditSave(){
  if(_agEditSection==='new'){ agCreateSubmit(); return; }   // Add-agent flow
  const a = sbGetAgent(_agEditAgentId); if(!a){ agEditClose(); return; }
  const d = _agEditDraft;
  const sec = _agEditSection;
  // ── snapshot "before" for audit log ──
  const _b = { rateTypeId:a.rateTypeId, payType:a.payType, creditDays:a.creditDays, creditLimit:a.creditLimit, vatMode:a.vatMode, creditBalance:a.creditBalance, sales:a.sales, name:a.name, market:a.market, sub:a.sub, note:a.note, progN:(a.programs||[]).length };
  const _rtNm = id => { const r=(typeof getRateType==='function'&&id)?getRateType(id):null; return r?(r.name+(r.code?' ('+r.code+')':'')):(id?id:'—'); };
  const _slNm = id => { const s=(typeof sbGetSales==='function'&&id)?sbGetSales(id):null; return s?(s.name||id):(id?id:'—'); };

  if(sec==='sales'){
    if(!d.sales){ if(!confirm('ไม่ระบุ Sales Person — ดำเนินการต่อ?')) return; }
    a.sales = d.sales || null;
    if(_b.sales!==a.sales) agLog(a.id,'sales','Salesperson: '+_slNm(_b.sales)+' → '+_slNm(a.sales));
  }
  else if(sec==='programs'){
    if(!Array.isArray(d.programPeriods)) return alert('ข้อมูลผิดพลาด');
    a.programPeriods = d.programPeriods;
    // Sync a.programs to match programPeriods
    a.programs = d.programPeriods.map(p=>p.routeId);
    if(_b.progN!==a.programs.length) agLog(a.id,'programs','Programs updated ('+_b.progN+' → '+a.programs.length+' routes)');
    else agLog(a.id,'programs','Programs / periods updated');
  }
  else if(sec==='profile'){
    a.payType = d.payType; a.creditDays = d.creditDays; a.vatMode = d.vatMode;
    a.creditLimit = d.creditLimit; a.creditBalance = d.creditBalance;
    const ch=[];
    if(_b.payType!==a.payType) ch.push('payment '+(_b.payType||'—')+'→'+(a.payType||'—'));
    if((_b.creditLimit||0)!==(a.creditLimit||0)) ch.push('credit limit '+(_b.creditLimit||0).toLocaleString()+'→'+(a.creditLimit||0).toLocaleString());
    if((_b.creditDays||0)!==(a.creditDays||0)) ch.push('credit days '+(_b.creditDays||0)+'→'+(a.creditDays||0));
    if((_b.vatMode||'none')!==(a.vatMode||'none')) ch.push('VAT '+(_b.vatMode||'none')+'→'+(a.vatMode||'none'));
    if((_b.creditBalance||0)!==(a.creditBalance||0)) ch.push('credit balance '+(_b.creditBalance||0).toLocaleString()+'→'+(a.creditBalance||0).toLocaleString());
    if(ch.length) agLog(a.id,'credit','Profile · '+ch.join(' · '));
  }
  else if(sec==='company'){
    if(!d.name) return alert('กรุณาระบุ Company Name');
    if(!d.legalName) return alert('กรุณาระบุ Company Legal Name');
    a.name = d.name; a.market = d.market; a.sub = (d.sub||'').trim();
    if('email' in d) a.email = d.email;
    if('color' in d) a.color = d.color || null;   // per-agent colour · null = auto
    if(typeof agSubMarketRemember==='function') agSubMarketRemember(a.market, a.sub);  // persist custom sub-market for reuse + analysis
    // Separate companyInfo (only contract fields, not identity)
    a.companyInfo = { legalName:d.legalName, tatLicense:d.tatLicense, address:d.address, tel:d.tel, hotline:d.hotline, fax:d.fax, website:d.website };
    const ch=[];
    if(_b.name!==a.name) ch.push('name "'+_b.name+'"→"'+a.name+'"');
    if(_b.market!==a.market) ch.push('market '+_b.market+'→'+a.market);
    if((_b.sub||'')!==(a.sub||'')) ch.push('sub "'+(_b.sub||'—')+'"→"'+(a.sub||'—')+'"');
    agLog(a.id,'company', ch.length ? ('Company · '+ch.join(' · ')) : 'Company info updated');
  }
  else if(sec==='signatory'){
    a.agentSignatory = {...d};
    agLog(a.id,'edit','Signatory updated');
  }
  else if(sec==='booking'){
    a.bookingChannel = {...d};
    agLog(a.id,'edit','Booking channel updated');
  }
  else if(sec==='notes'){
    a.note = d.note;
    if((_b.note||'')!==(a.note||'')) agLog(a.id,'note','Notes updated');
  }
  else if(sec==='contracttmpl'){
    a.contractTemplateId = d.contractTemplateId || null;
    if(_b.contractTemplateId!==a.contractTemplateId){
      const _tn = id => id ? (((typeof ctTmplGet==='function'?ctTmplGet(id):null)||{}).name || id) : 'ค่าตั้งต้น';
      agLog(a.id,'contract','Contract template: '+_tn(_b.contractTemplateId)+' → '+_tn(a.contractTemplateId));
    }
  }
  else if(sec==='ratetype'){
    a.rateTypeId = d.rateTypeId || null;
    if(_b.rateTypeId!==a.rateTypeId) agLog(a.id,'rate','Rate type: '+_rtNm(_b.rateTypeId)+' → '+_rtNm(a.rateTypeId));
    /* §ctRateSync · การ์ดสัญญาด้านบนอ่านจาก SB_CONTRACTS ไม่ใช่ a.rateTypeId
       ถ้าไม่ตามไปด้วย จะเปลี่ยนแล้วข้างบนไม่เปลี่ยน · และเอกสารสัญญาจะออกด้วยชุดเก่า */
    if(_b.rateTypeId!==a.rateTypeId) _ctSyncMainRate(a.id, a.rateTypeId, 'เปลี่ยน Rate Type');
    /* §agProgFill · เลือกเรทแล้วโปรแกรมในสัญญาตามไปเอง · เติมเงียบ ๆ ตัดต้องยืนยัน
       ทำหลัง _ctSyncMainRate เพราะตัวนั้นแตะใบสัญญา ส่วนตัวนี้แตะรายการโปรแกรมของเอเย่นต์ */
    if(_b.rateTypeId!==a.rateTypeId && a.rateTypeId && typeof agProgSyncOnRate==='function')
      agProgSyncOnRate(a, a.rateTypeId);
    if(typeof rtPersist === 'function') rtPersist();
    // Re-render rate type cards too (in case usage count changed)
    if(typeof rtRenderCards === 'function') rtRenderCards();
    if(typeof _rtSelected !== 'undefined' && _rtSelected && typeof rtRenderDetail === 'function') rtRenderDetail(_rtSelected);
  }

  if(typeof sbAgentsPersist==='function') sbAgentsPersist();   // persist agent edits
  agEditClose();
  agRenderList();
  agRenderDetail(a.id);
}

/* ══ §agAlert · เรื่องที่ต้องจัดการของเอเย่นต์รายนี้ ══════════════════════════
   ของเดิมกระจายอยู่สี่ที่ · แบนเนอร์สัญญาบนสุด · กล่องเครดิต · กล่องข้อมูลไม่ครบ
   และจุดแดงเล็ก ๆ บนแท็บ Rate Type ที่ต้องกดเข้าไปจึงจะรู้ว่าเรื่องอะไร
   สี่ที่นั้นไม่เคยเรียงตามความด่วน · เครดิตเกินวงเงินอยู่ล่างกว่าสัญญาที่ยังเหลืออีกเดือน

   รวมมาที่เดียว เรียงตามความด่วน และทุกแถวมีปุ่มพาไปแก้
   คืนเป็น array เพื่อให้ "จำนวนเรื่อง" กับ "ตัวแถว" มาจากการนับครั้งเดียวกัน
   ═══════════════════════════════════════════════════════════════════════════ */
function agAlerts(a){
  const out = [];
  if(!a) return out;
  const E = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money = n => '฿'+sbFmtTHB(n||0);
  /* 1 · เครดิตเกินวงเงิน — เรื่องเงินสด ด่วนที่สุด ใบจองใหม่ไม่ควรออกจนกว่าจะเคลียร์ */
  const cs = (typeof agCreditState==='function') ? agCreditState(a.id) : null;
  if(cs && cs.mode==='invoice' && cs.limit>0){
    if(cs.available<0){
      out.push({tone:'red', t:'Credit over limit',
        d:'<b>'+money(cs.used)+'</b> / '+money(cs.limit)+' · over by <b>'+money(-cs.available)+'</b> ('+cs.pct+'%)',
        tip:'ใบจองใหม่ควรรอเคลียร์ยอดก่อน',
        go:'View statement', on:"acctStatementOpen('"+a.id+"')"});
    } else if(cs.pct>=80){
      out.push({tone:'amber', t:'Credit near limit', day:cs.pct+'%',
        d:'<b>'+money(cs.used)+'</b> / '+money(cs.limit)+' · <b>'+money(cs.available)+'</b> left',
        go:'View statement', on:"acctStatementOpen('"+a.id+"')"});
    }
  }
  /* 2 · สัญญา — หมดแล้วหรือใกล้หมด · ใช้เกณฑ์เดียวกับที่หน้าอื่นใช้ (ctIsExpired / ctIsExpiringSoon) */
  const dl = (typeof ctDaysUntilExpiry==='function') ? ctDaysUntilExpiry(a) : null;
  const _fd = s => (typeof ctFmtDate==='function') ? ctFmtDate(s) : s;
  if(typeof ctIsExpired==='function' && ctIsExpired(a)){
    out.push({tone:'red', t:'Contract expired', day:Math.abs(dl)+' days ago',
      d:E(a.contractVersion||'')+' ended <b>'+E(_fd(a.contractEnd))+'</b>',
      tip:'booking ใหม่ควรหยุดจนกว่าจะต่อสัญญา',
      go:'Renew now', on:"ctOpenRenewal('"+a.id+"')"});
  } else if(typeof ctIsExpiringSoon==='function' && ctIsExpiringSoon(a)){
    out.push({tone:'red', t:'Contract expiring', day:dl+' days',
      d:E(a.contractVersion||'')+' ends <b>'+E(_fd(a.contractEnd))+'</b>',
      tip:'ต่อก่อนหมดเพื่อให้ราคาต่อเนื่อง',
      go:'Renew', on:"ctOpenRenewal('"+a.id+"')"});
  }
  /* 3 · โปรแกรมที่เรทไม่มีราคาให้ — ของจริงคือหน้าจองกด Save ไม่ได้ (noRate) จึงต้องอยู่เหนือเรื่องเรทหมดอายุ */
  const rt = (typeof agHdRateOf==='function') ? agHdRateOf(a) : null;
  if(!rt && (a.programs||[]).length){
    out.push({tone:'red', t:'No rate bound', sev:'Blocked',
      d:'sells <b>'+(a.programs||[]).length+' routes</b> · no Rate Type at all',
      tip:'ไม่มีเรท = ไม่มีราคาให้คิด จองไม่ได้ทุกเส้น',
      go:'Pick a rate', on:"agEditOpen('ratetype','"+a.id+"')"});
  }
  if(rt){
    const have = rt.seatRates||{};
    const orph = (a.programs||[]).filter(p=>p && !have[p]);
    if(orph.length){
      const names = orph.map(p=>{ const r=(typeof getRoute==='function')?getRoute(p):null; return E((r&&r.name)||p); });
      out.push({tone:'amber', t:'Route with no price', sev:'Blocked',
        d:'<b>'+orph.length+' route'+(orph.length===1?'':'s')+'</b> · '+names.join(' · '),
        tip:'เรทที่ผูกอยู่ไม่มีราคาของเส้นเหล่านี้ · ปุ่มบันทึกในหน้าจองถูกล็อก (noRate)',
        go:'Open Pricing Matrix', on:"agSwitchTab('prices','"+a.id+"')"});
    }
    /* 4 · เรทใกล้หมด/หมดแล้ว และยังไม่ได้ตั้งฤดูรับ · rtExpForAgent ตอบว่า "ยังไม่ได้ตอบคำถามนี้" */
    const X = (typeof rtExpForAgent==='function') ? rtExpForAgent(a) : null;
    if(X){
      out.push({tone:'amber', t:X.days<0?'Rate expired':'Rate expiring',
        day:(X.days<0?Math.abs(X.days)+' days ago':'in '+X.days+' days'),
        d:'<b>'+E(rt.code||rt.name||'')+'</b> ends '+E(_rtFmtDate(X.to)||X.to)+' · no season set to take over',
        tip:'วันหมดอายุไม่ได้กั้นการคิดเงิน · พ้นวันนั้นไประบบยังคิดราคาชุดเดิมต่อเงียบ ๆ',
        go:'Set season schedule', on:"agSwitchTab('ratemgmt','"+a.id+"')"});
    }
    /* 5 · เรทยังไม่เริ่ม · validFrom ไม่ใช่ประตูคิดเงิน (ดู §promoMx) ระบบจึงคิดราคาชุดนี้ให้อยู่เงียบ ๆ */
    const vf = String(rt.validFrom||'');
    if(vf && typeof rtExpDaysTo==='function'){
      const dvf = rtExpDaysTo(vf);
      if(dvf!==null && dvf>0){
        out.push({tone:'blue', t:'Rate not started', day:'in '+dvf+' days',
          d:'<b>'+E(rt.code||rt.name||'')+'</b> starts '+E(_rtFmtDate(vf)||vf),
          tip:'วันเดินทางก่อนหน้านั้นไม่มีฤดูคุม · ระบบคิดราคาชุดนี้ให้อยู่ดี',
          go:'Set season schedule', on:"agSwitchTab('ratemgmt','"+a.id+"')"});
      }
    }
  }
  /* 6 · สัญญาระบุเรทคนละตัวกับที่ผูกจริง · เอกสารที่พิมพ์ออกไปจะอ้างราคาคนละชุดกับที่ระบบคิด (ดู §ctRateSync) */
  const nx = (typeof rtExpNextOf==='function') ? rtExpNextOf(a.id) : '';
  if(nx && a.rateTypeId && nx!==a.rateTypeId){
    const nrt = (typeof getRateType==='function') ? getRateType(nx) : null;
    out.push({tone:'blue', t:'Contract ≠ bound rate',
      d:'contract <b>'+E((nrt&&(nrt.code||nrt.name))||nx)+'</b> · bound <b>'+E((rt&&(rt.code||rt.name))||a.rateTypeId)+'</b>',
      tip:'เอกสารสัญญาจะพิมพ์ราคาชุดที่ระบุในสัญญา ไม่ใช่ชุดที่ระบบคิดจริง',
      go:'Sync to bound rate', on:"agAlertSyncRate('"+a.id+"')"});
  }
  /* 7 · ข้อมูลโปรไฟล์ไม่ครบ · ท้ายสุด ไม่ได้ทำให้จองไม่ได้ แต่ทำให้ติดต่อกลับไม่ได้ */
  const miss = (typeof agIncompleteFields==='function') ? agIncompleteFields(a) : [];
  if(miss.length){
    out.push({tone:'amber', t:'Incomplete profile', sev:'Attention', day:miss.length+' items',
      d:'missing <b>'+E(miss.join(' · '))+'</b>',
      go:'Edit profile', on:"agEditOpen('profile','"+a.id+"')"});
  }
  return out;
}
/* ปุ่ม Sync · เขียนเรทที่ผูกจริงลงใบสัญญา MAIN ที่ยังไม่หมดอายุ (ใบเก่าเก็บของเดิมไว้ · ดู _ctSyncMainRate) */
function agAlertSyncRate(agentId){
  const a = (typeof sbGetAgent==='function') ? sbGetAgent(agentId) : null; if(!a) return;
  const n = (typeof _ctSyncMainRate==='function') ? _ctSyncMainRate(agentId, a.rateTypeId, 'sync from agent page') : 0;
  alert(n>0 ? ('Synced '+n+' main contract(s) to the bound rate.') : 'Nothing to sync.');
  agRenderDetail(agentId);
}
function agAlertsHTML(a){
  const A = agAlerts(a);
  if(!A.length) return '<div class="ag-ok">&#10003; Nothing needs action for this agent</div>';
  return '<div class="ag-als">' + A.map(function(x){
    const cls = AG_AL_TONE[x.tone] || 'blu';
    const sev = x.sev || x.day || AG_AL_SEV[x.tone] || 'Review';
    return '<div class="ag-al '+cls+'"'+(x.tip?(' title="'+String(x.tip).replace(/"/g,'&quot;')+'"'):'')+'>'
      + '<span class="sev"><i></i>'+sev+'</span>'
      + '<span class="t">'+x.t+'</span>'
      + '<span class="d">'+x.d+'</span>'
      + (x.go?'<button class="go" onclick="'+x.on+'">'+x.go+'</button>':'')
      + '</div>';
  }).join('') + '</div>';
}

/* ══ §agHist · ชิปประวัติสัญญา · เคยเป็นแถบคั่นระหว่างชื่อเอเย่นต์กับแถวแท็บ
   ตอนนี้อยู่ในกล่อง Contract ของบล็อก Commercial · วาดด้วยชิปของตัวเอง (_ctVerChips ใน agTabInfo)
   ไม่ใช้คอมโพเนนต์ .ct-history เดิม เพราะมันออกแบบมาสำหรับแถบเต็มความกว้าง
   ยัดลงกล่องกว้าง 280px แล้วตัวอักษรถูกบีบจนอ่านเป็นแนวตั้ง
   ═══════════════════════════════════════════════════════════════════════════ */


/* ══ §agProgFill · เลือก Rate Type แล้ว "Programs in Contract" ตามไปเอง ══════
   ที่มา (2026-09-18) · สองอย่างนี้ต้องตรงกันอยู่แล้วโดยธรรมชาติ
   เรทคือ "ราคาของเส้นทางไหนบ้าง" · โปรแกรมในสัญญาคือ "เอเย่นต์ขายเส้นทางไหนบ้าง"
   แต่ก่อนหน้านี้คนต้องกรอกสองรอบ และรอบที่สองมักถูกลืม
   ผลคือ 44 เจ้าขายเส้นที่เรทของตัวเองไม่มีราคา — หน้าจองกด Save ไม่ได้ตั้งแต่วันแรกของฤดู

   กติกา · เติมเงียบ ๆ ตัดต้องยืนยัน
     เติม  = เส้นที่เรทมีราคาให้ แต่ยังไม่อยู่ในสัญญา → ใส่ให้เลย ไม่ต้องถาม (ไม่มีอะไรเสียหาย)
     ตัด   = เส้นที่อยู่ในสัญญา แต่เรทใหม่ไม่มีราคาให้ → ถามก่อนทุกครั้ง
             เพราะการตัดคือการลบของที่ Sales ตั้งใจใส่ไว้ · ไม่ตัดก็ยังเห็นเป็นเตือนในบล็อก Needs action

   "เรทมีราคาให้" อ่านจาก seatRates ไม่ใช่ rt.routes
   rt.routes คือรายการที่ประกาศไว้ · seatRates คือราคาที่มีจริง · ตัวที่ทำให้จองได้คือตัวหลัง
   ═══════════════════════════════════════════════════════════════════════════ */
function agRtRoutes(rt){
  if(!rt) return [];
  var sr = rt.seatRates || {};
  var declared = (rt.routes||[]).filter(function(r){ return r && sr[r]; });
  return declared.length ? declared : Object.keys(sr);
}
/* แผนของเอเย่นต์รายเดียว · ไม่แตะข้อมูล แค่บอกว่าจะเติมอะไร ตัดอะไร */
function agProgPlan(a, rtId){
  var rt = (typeof getRateType==='function' && rtId) ? getRateType(rtId) : null;
  var cover = agRtRoutes(rt);
  var have  = (a && Array.isArray(a.programs)) ? a.programs.filter(Boolean) : [];
  return {
    rt: rt, cover: cover,
    add:  cover.filter(function(r){ return have.indexOf(r) < 0; }),
    drop: have.filter(function(r){ return cover.indexOf(r) < 0; })
  };
}
function agProgRouteName(id){
  var r = (typeof getRoute==='function') ? getRoute(id) : null;
  return (r && r.name) || id;
}
/* ลงมือจริง · คืนแผนที่ใช้ไป เพื่อให้คนเรียกเอาไปเขียน log ได้โดยไม่ต้องคำนวณซ้ำ
   ช่วงวันของแถวที่เติม · จอง = ช่วงสัญญาของเอเย่นต์ · เดินทาง = routeValidity ของเรท
   (หน้า Information เอา routeValidity มาทับตอนวาดอยู่แล้ว เก็บลงข้อมูลด้วยให้ตรงกันตั้งแต่ต้น) */
function agProgFill(a, rtId, opt){
  opt = opt || {};
  var P = agProgPlan(a, rtId);
  if(!P.rt) return P;
  var rv = P.rt.routeValidity || {};
  var bf = a.contractStart || '', bt = a.contractEnd || '';
  if(!Array.isArray(a.programPeriods)) a.programPeriods = [];
  P.add.forEach(function(r){
    var v = rv[r] || {};
    a.programPeriods.push({ routeId:r, bookFrom:bf, bookTo:bt,
      travelFrom: v.from || '', travelTo: v.to || '', note:'' });
  });
  if(opt.removeExtra && P.drop.length){
    a.programPeriods = a.programPeriods.filter(function(x){ return x && P.drop.indexOf(x.routeId) < 0; });
  }
  /* programs ต้องเป็นรายการไม่ซ้ำเสมอ · programPeriods ของจริงมีแถวซ้ำเส้นเดียวกันอยู่ (คนละช่วงวัน) */
  a.programs = a.programPeriods.map(function(x){ return x.routeId; })
    .filter(function(r, i, arr){ return r && arr.indexOf(r) === i; });
  return P;
}
/* เรียกตอนเปลี่ยนเรทจากหน้า Agent · ตัวที่ถามคำถามเรื่อง "ตัด" อยู่ตรงนี้ที่เดียว */
function agProgSyncOnRate(a, rtId){
  var P = agProgPlan(a, rtId);
  if(!P.rt || (!P.add.length && !P.drop.length)) return 0;
  var rm = false;
  if(P.drop.length){
    var names = P.drop.map(agProgRouteName).join('\n  · ');
    rm = confirm('This rate has no price for ' + P.drop.length + ' program(s) already in the contract:\n\n  · '
      + names + '\n\nOK = remove them from Programs in Contract\n'
      + 'Cancel = keep them (they will be flagged as "Route with no price" and booking Save stays blocked)');
  }
  if(!P.add.length && !rm) return 0;
  agProgFill(a, rtId, { removeExtra: rm });
  var parts = [];
  if(P.add.length)   parts.push('+' + P.add.length + ' ' + P.add.map(agProgRouteName).join(' · '));
  if(rm)             parts.push('-' + P.drop.length + ' ' + P.drop.map(agProgRouteName).join(' · '));
  if(typeof agLog==='function')
    agLog(a.id, 'programs', 'Programs ตามเรทอัตโนมัติ · ' + parts.join(' · '));
  return P.add.length + (rm ? P.drop.length : 0);
}

function agRenderDetail(aId){
  const a = sbGetAgent(aId); if(!a) return;
  /* §user→sales · กันเปิดเอเยนต์นอกขอบเขตผ่าน id ตรงๆ (เช่น auto-select ตัวแรกที่ไม่ใช่ของเซลล์คนนี้) */
  if(typeof laAgentInScope==='function' && !laAgentInScope(a)){
    const host0 = document.getElementById('ag-main');
    if(host0) host0.innerHTML = '<div style="padding:40px;text-align:center;color:#9b9590;font-size:12.5px">เอเยนต์รายนี้ไม่ได้อยู่ในความดูแลของคุณ</div>';
    return;
  }
  const mkt = sbGetMarket(a.market);
  const pay = sbGetPayment(a.payType);
  const host = document.getElementById('ag-main');
  /* §agAlert · แบนเนอร์สี่ชุดที่เคยกองอยู่ตรงนี้ (สัญญา · เครดิต · ข้อมูลไม่ครบ · จุดแดงบนแท็บ)
     ย้ายไปรวมเป็นแถบเดียวในบล็อก 1 ของแท็บ Information · เรียงตามความด่วนแล้วที่นั่น
     ตรงนี้จึงไม่เหลือแบนเนอร์ · ชื่อเอเย่นต์ได้ขึ้นเป็นบรรทัดแรกจริง ๆ */
  const bannerHtml = '';

  host.innerHTML = `
    ${bannerHtml}
    <div class="sb-main-hd" style="${mkt?`border-left:6px solid ${mkt.color};background:linear-gradient(90deg, ${mkt.color}1a 0%, transparent 45%)`:''}">
      <div>
        <div class="sb-main-ttl">
          ${a.name}
          ${mkt?`<span class="sb-chip" style="background:${mkt.color}26;color:${mkt.color};font-weight:700;letter-spacing:.04em;font-variant-numeric:tabular-nums;font-size:10px;padding:3px 9px;border-radius:10px">${mkt.name.split(' ').slice(0,2).join(' ').toUpperCase()}</span>`:''}
          ${(function(){
            const arts = (typeof ctArtifactsFor === 'function') ? ctArtifactsFor(a.id) : [];
            if(!arts.length) return '';
            const latest = arts[0];
            const outdated = latest.version !== a.contractVersion;
            const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const d = new Date(latest.generatedAt);
            const dateStr = isNaN(d) ? '—' : `${String(d.getDate()).padStart(2,'0')} ${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
            const bg = outdated ? '#FFF5EB' : '#E1F5EE';
            const fg = outdated ? '#854F0B' : '#0F6E56';
            const icon = outdated ? '⚠' : '✓';
            const label = outdated
              ? `${icon} Contract outdated · last ${latest.version}`
              : `${icon} Contract · ${dateStr}`;
            return `<span title="Last contract generated · ${arts.length} document${arts.length===1?'':'s'} in history" style="background:${bg};color:${fg};font-size:10px;font-weight:700;letter-spacing:.03em;padding:3px 9px;border-radius:10px;display:inline-flex;align-items:center;gap:4px">${label}</span>`;
          })()}
        </div>
        <div class="sb-main-sub">${mkt?.name||''} · ${a.sub||''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button onclick="ctDocOpen('${a.id}')" title="Generate Contract document"
          style="background:#1A2B43;color:#fff;border:none;font-family:inherit;font-size:11.5px;font-weight:600;padding:7px 14px;border-radius:18px;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Generate Contract
        </button>
        <button onclick="agEdit('${a.id}')" title="แก้ไขข้อมูล Agent"
          style="background:#F1F2EF;color:#2b3a34;border:1px solid #e0dcd3;font-family:inherit;font-size:11.5px;font-weight:600;padding:7px 15px;border-radius:18px;cursor:pointer">Edit</button>
        ${(typeof window.laIsAdmin==='function' && window.laIsAdmin())?`<button onclick="agDelete('${a.id}')" title="ลบโปรไฟล์ Agent (เฉพาะ admin)"
          style="background:#FCEBEB;color:#A32D2D;border:1px solid #E4A0A0;font-family:inherit;font-size:11.5px;font-weight:700;padding:7px 15px;border-radius:18px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">🗑 ลบ Agent</button>`:''}
      </div>
    </div>
    <div class="sb-tabs">
      <div class="sb-tab on" data-tab="info" onclick="agSwitchTab('info','${a.id}')">Information</div>
      <div class="sb-tab" data-tab="prices" onclick="agSwitchTab('prices','${a.id}')">Pricing Matrix</div>
      <div class="sb-tab" data-tab="hist" onclick="agSwitchTab('hist','${a.id}')">Recent Bookings</div>
      <div class="sb-tab" data-tab="contracts" onclick="agSwitchTab('contracts','${a.id}')">Generated Contracts${(function(){
        const n = (typeof ctArtifactsFor==='function') ? ctArtifactsFor(a.id).length : 0;
        return n ? ` <span style="background:var(--fd-coral-soft);color:var(--fd-coral-deep);font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:4px;font-variant-numeric:tabular-nums">${n}</span>` : '';
      })()}</div>
      <div class="sb-tab" data-tab="activity" onclick="agSwitchTab('activity','${a.id}')">Activity${(function(){
        const n = Array.isArray(a.activity)?a.activity.length:0;
        return n ? ` <span style="background:#EEE9FB;color:#6c5ce7;font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:4px;font-variant-numeric:tabular-nums">${n}</span>` : '';
      })()}</div>
      <!-- §rtTab · งานจัดการเรทของเอเย่นต์รายนี้ · ย้ายออกจาก Pricing Matrix มาอยู่แท็บของตัวเอง -->
      <div class="sb-tab" data-tab="ratemgmt" onclick="agSwitchTab('ratemgmt','${a.id}')">Rate Type${(function(){
        /* จุดสีขึ้นเมื่อมีเรื่องต้องจัดการ · เรทใกล้หมดและยังไม่ได้ตั้งตารางรับ
           ไม่มีเรื่อง = ไม่มีจุด · แท็บจะได้ไม่ส่งเสียงตลอดเวลา */
        try{
          const X = (typeof rtExpForAgent==='function') ? rtExpForAgent(a) : null;
          if(!X) return '';
          const T = rtExpTone(X.days);
          return ` <span title="${X.days<0?'เรทหมดอายุแล้ว':'เรทใกล้หมดอายุ'} · ยังไม่ได้ตั้งตารางฤดูกาลรับ" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${T.fg};margin-left:5px;vertical-align:middle"></span>`;
        }catch(_){ return ''; }
      })()}</div>
    </div>
    <div class="sb-main-body" id="ag-tabbody">${agTabInfo(a)}</div>
  `;
}

function agTabInfo(a){
  const pay = sbGetPayment(a.payType);
  const sales = sbGetSales(a.sales);
  const mkt = sbGetMarket(a.market);
  const periodsRaw = a.programPeriods || [];
  const ci = a.companyInfo || {};
  const sig = a.agentSignatory || {};
  const bc = a.bookingChannel || {};
  // Rate Type is source of truth for Travel Period · resolve once and overlay onto periods
  const rtForPeriods = (a.rateTypeId && typeof getRateType==='function') ? getRateType(a.rateTypeId) : null;
  const _rvMap = rtForPeriods ? (rtForPeriods.routeValidity || {}) : {};
  const periods = periodsRaw.map(p => {
    const rv = _rvMap[p.routeId];
    if(rv){
      return Object.assign({}, p, {
        travelFrom: rv.from || '',
        travelTo:   rv.to   || ''
      });
    }
    // No routeValidity → if agent has a rate type but route is missing there, blank out travel dates
    if(rtForPeriods) return Object.assign({}, p, {travelFrom:'', travelTo:''});
    return p;
  });
  // Contract validity (earliest/latest dates across all programs)
  const allDates = periods.flatMap(p=>[p.bookFrom,p.bookTo,p.travelFrom,p.travelTo]).filter(Boolean).sort();
  const validityStart = allDates[0] || '';
  const validityEnd = allDates[allDates.length-1] || '';
  const earliestCutoff = periods.length ? periods.map(p=>p.travelTo).filter(Boolean).sort()[0] || '' : '';
  const earliestCutoffRoute = periods.find(p=>p.travelTo===earliestCutoff);
  const earliestCutoffName = earliestCutoffRoute ? (ROUTES.find(r=>r.id===earliestCutoffRoute.routeId)?.name||'') : '';
  // Format date helper
  const fmtD = (iso)=>{
    if(!iso) return '—';
    const d = new Date(iso); if(isNaN(d)) return iso;
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  };
  // Credit utilization
  const creditUsed = (a.creditLimit||0) - (a.creditBalance||0);
  const utilPct = a.creditLimit ? Math.round(creditUsed/a.creditLimit*100) : 0;

  /* ── เครื่องมือวาดของบล็อกนี้ ─────────────────────────────────────────────
     §agStd · กติกาเดียวของชุดนี้: โครงสร้างเป็นเทา-ขาว · สีใช้บอกสถานะอย่างเดียว
       sec()  หัวข้อ = ป้าย + เส้นคั่น (ไม่มีแถบสี ไม่มีเลขในวงกลม)
       box()  การ์ดขาวขอบเส้นเดียว · สถานะไปอยู่บนป้ายที่หัวการ์ด ไม่ย้อมกรอบ
       cls ของ box คือความกว้างในกริด 12 คอลัมน์ (c3/c5/c6/c8/wide · ไม่ใส่ = 4)
     esc/escapeHTML ไม่ใช่ตัวแปร global จึงประกาศเองตรงนี้ (§escLocal) */
  const E = t => String(t==null?'':t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const tag = (txt, tone) => `<span class="ag-tag ${tone||''}">${E(txt)}</span>`;
  const sec = (ttl, note, act, cls) => {
    const acts = !act ? [] : (Array.isArray(act) ? act : [act]);
    return `<div class="ag-band ${cls||''}"><span class="ttl">${E(ttl)}</span><span class="rule"></span>`
      + (note ? `<span class="note">${note}</span>` : '')
      + acts.map(x=>`<button class="act" onclick="${x.on}">${E(x.txt)}</button>`).join('')
      + `</div>`;
  };
  const rowS = (k, v, cls) =>
    `<div class="r"><span class="k">${E(k)}</span><span class="v ${cls||''}">${v||'<span style="color:var(--ag-ink4)">—</span>'}</span></div>`;
  const box = (ttl, rows, meta, cls) =>
    `<div class="ag-box ${cls||''}"><div class="bh">${E(ttl)}${meta?`<em>${meta}</em>`:''}</div>`
    + `<div class="ag-sh one">${rows}</div></div>`;

  /* ── บล็อก 1 · เรื่องที่ต้องจัดการ ── */
  const _AL = (typeof agAlerts==='function') ? agAlerts(a) : [];
  const sect1 = sec('Needs action',
      _AL.length ? (_AL.length + ' item' + (_AL.length===1?'':'s') + ' · most urgent first') : 'nothing outstanding',
      null, _AL.length ? 'alert' : 'clear')
    + ((typeof agAlertsHTML==='function') ? agAlertsHTML(a) : '');

  /* ── บล็อก 2 · เงื่อนไขการค้า · สัญญา เครดิต ช่องทางจอง ── */
  const _cs = (typeof agCreditState==='function') ? agCreditState(a.id) : null;
  let creditRows = '';
  if(_cs && _cs.mode==='invoice' && _cs.limit>0){
    const over=_cs.available<0, near=_cs.pct>=80;
    const col = over?'#A32D2D':(near?'#8A5410':'#0F6E56');
    creditRows = rowS('Limit', `<span class="mono">${acctFmt(_cs.limit)}</span> · ${a.creditDays||0} days`)
      + rowS('Used', `<span class="mono" style="color:${col}">${acctFmt(_cs.used)} · ${_cs.pct}%</span>`
        + `<span class="ag-bar"><i style="width:${Math.min(100,Math.max(0,_cs.pct))}%;background:${col}"></i></span>`
        + `<span class="sub">${over ? ('<strong style="color:var(--ag-red)" title="ใบจองใหม่ควรรอเคลียร์ยอดก่อน">over '+acctFmt(-_cs.available)+'</strong>')
                                    : (acctFmt(_cs.available)+' left')}`
        + ` · <span onclick="acctStatementOpen('${a.id}')" style="cursor:pointer;color:var(--ag-blu)">statement</span></span>`);
  } else {
    creditRows = rowS('Limit', `<span style="color:var(--ag-ink3);font-weight:400">none · paid before travel</span>`);
  }
  const _ctDays = (typeof ctDaysUntilExpiry==='function') ? ctDaysUntilExpiry(a) : null;
  /* ชิปเวอร์ชันสัญญา · ใบที่ใช้อยู่เป็นสีเขียว ใบเก่าเป็นสีเทา · กดดูใบไหนก็ได้ */
  const _ctHist = Array.isArray(a.contractHistory) ? a.contractHistory : [];
  const _nCt = 1 + _ctHist.length;
  const _ctChip = (v, from, to, on, cur) =>
    `<span onclick="ctViewContract('${a.id}','${on}')" title="${E(fmtD(from))} → ${E(fmtD(to))}" style="display:inline-block;`
    + `font-size:10px;font-weight:700;border-radius:7px;padding:2px 8px;margin:0 4px 4px 0;cursor:pointer;white-space:nowrap;`
    + (cur ? 'background:#E7F5EE;color:#0F6E56;border:1px solid #BFE3D4' : 'background:#F1EFE8;color:#6E6A63;border:1px solid #E2DED5')
    + `">${E(v||'—')}</span>`;
  const _ctVerChips = _ctChip(a.contractVersion, a.contractStart, a.contractEnd, 'active', true)
    + _ctHist.map(h => _ctChip(h.version, h.contractStart, h.contractEnd, h.version, false)).join('');
  const _credOver = !!(_cs && _cs.mode==='invoice' && _cs.limit>0 && _cs.available<0);
  const _credNear  = !!(_cs && _cs.mode==='invoice' && _cs.limit>0 && !_credOver && _cs.pct>=80);
  /* §agStd · สถานะของกล่องไปอยู่บนป้ายที่หัวกล่อง ไม่ใช่การย้อมกรอบ
     กรอบสีทำให้ทั้งใบดูเป็นเรื่องด่วน ทั้งที่ด่วนอยู่ค่าเดียวในนั้น */
  const _ctTag = (_ctDays===null||_ctDays===undefined) ? (_nCt + ' version' + (_nCt===1?'':'s'))
    : (_ctDays<0 ? tag('Expired '+Math.abs(_ctDays)+'d', 'red')
                 : (_ctDays<=30 ? tag(_ctDays+' days left', 'red')
                                : (_ctDays<=60 ? tag(_ctDays+' days left', 'amb') : tag(_ctDays+' days left'))));
  const sect2 = sec('Commercial', null,
      [{txt:'Edit payment', on:`agEditOpen('profile','${a.id}')`},
       {txt:'Edit booking channel', on:`agEditOpen('booking','${a.id}')`}])
    + `<div class="ag-grp">`
      /* ประวัติสัญญาเป็นชิปของตัวเอง ไม่ใช้ .ct-history เดิม
         คอมโพเนนต์นั้นถูกออกแบบมาสำหรับแถบเต็มความกว้าง · ยัดลงกล่อง 280px แล้วตัวอักษรบีบเป็นแนวตั้ง */
      + box('Contract',
          rowS('Current', `${E(a.contractVersion||'—')}`
            + `<span class="sub mono">${fmtD(a.contractStart)} → ${fmtD(a.contractEnd)}</span>`)
          + rowS('Versions', _ctVerChips + `<span class="sub">${_nCt} kept</span>`),
          _ctTag)
      + box('Credit & payment',
          rowS('Payment', `${E(pay?.name||'—')}${a.payType==='invoice'?` · ${a.creditDays} days`:''}${a.vatMode&&a.vatMode!=='none'?` · VAT ${a.vatMode==='include'?'incl':'excl'}`:''}`)
          + creditRows,
          _credOver ? tag(_cs.pct+'%','red') : (_credNear ? tag(_cs.pct+'%','amb') : ''))
      + box('Booking channel',
          rowS('Method', `${E(bc.method||'—')}${bc.cutoff?` · ${E(bc.cutoff)}`:''}`)
          + rowS('Cancellation', E(bc.cancelPolicy||''))
          + rowS('Send to', `${E(bc.email||'')}${bc.phone?(`<span class="sub mono">${E(bc.phone)}</span>`):''}`))
    + `</div>`;

  /* ── บล็อก 3 · เรทที่ใช้คิดราคา ─────────────────────────────────────────
     สี่บรรทัดนี้ตอบคำถามที่คนถามจริงเวลาเปิดหน้านี้:
     ผูกเรทไหนอยู่ · วันนี้เรทนั้นอยู่ในช่วงของตัวเองหรือเปล่า ·
     ใบสัญญาระบุตัวเดียวกันไหม · แล้วพ้นวันหมดไปใช้อะไรต่อ */
  const _rtNow = (typeof agHdRateOf==='function') ? agHdRateOf(a) : null;
  const _conRtId = (typeof rtExpNextOf==='function') ? rtExpNextOf(a.id) : '';
  const _conRt = (_conRtId && typeof getRateType==='function') ? getRateType(_conRtId) : null;
  const _seasons = (typeof laSeasonsOf==='function') ? laSeasonsOf(a) : [];
  /* เส้นทางที่เรทมีราคาให้ · ใช้ทั้งในกล่อง Coverage และปุ่มเติมที่ขาดของบล็อก 4 · อ่านที่เดียว */
  const _rtCover = _rtNow ? (typeof agRtRoutes==='function' ? agRtRoutes(_rtNow) : (_rtNow.routes||[])) : [];
  const _missing = _rtCover.filter(r => !periods.some(p => p.routeId === r));
  let boxBound = '', boxToday = '', boxSeason = '';
  if(!_rtNow){
    boxBound = box('Bound rate',
      rowS('Rate', `<span style="color:var(--ag-red)">No rate type assigned</span>`
        + `<span class="sub">every price on this agent comes from a rate type · without one, booking Save is blocked</span>`),
      tag('Blocked','red'), 'c8');
  } else {
    const vf = String(_rtNow.validFrom||''), vt = String(_rtNow.validTo||'');
    const dvf = (vf && typeof rtExpDaysTo==='function') ? rtExpDaysTo(vf) : null;
    const dvt = (vt && typeof rtExpDaysTo==='function') ? rtExpDaysTo(vt) : null;
    /* "วันนี้เรทอยู่ในช่วงของตัวเองไหม" เคยเป็นกล่องของตัวเอง · เป็นค่าเดียวบรรทัดเดียว
       ยุบลงมาเป็นแถวในกล่อง Bound rate · สถานะอยู่บนป้าย ไม่ต้องใช้กรอบทั้งใบมาบอก */
    let today = tag('Within its normal window','grn');
    if(dvf!==null && dvf>0){
      today = tag('Starts in '+dvf+' days','amb')
        + `<span class="sub" title="validFrom ไม่ใช่ประตูคิดเงิน (ดู §promoMx) · ระบบยังคิดราคาชุดนี้ให้อยู่">prices still charged from this set</span>`;
    } else if(dvt!==null && dvt<0){
      today = tag('Expired '+Math.abs(dvt)+' days ago','red')
        + `<span class="sub">prices still charged from this set</span>`;
    } else if(dvt!==null && dvt<=60){
      today = tag('In window · ends in '+dvt+' days','amb');
    }
    boxBound = box('Bound rate',
      rowS('Rate', `${E(_rtNow.name||'')}<span class="sub mono">${E(_rtNow.code||'')}</span>`)
      + rowS('Active', `<span class="mono">${E(_rtFmtDate(vf)||vf||'—')} → ${E(_rtFmtDate(vt)||vt||'no end date')}</span>`)
      + rowS('In effect today', today),
      tag(_rtCover.length + ' route' + (_rtCover.length===1?'':'s')), 'c5');
    boxSeason = box('Contract & season',
      rowS('Named in contract', _conRt
        ? (_conRtId===a.rateTypeId
            ? `${E(_conRt.name||_conRt.code||'')}<span class="sub">matches the bound rate</span>`
            : `${E(_conRt.name||_conRt.code||'')}<span class="sub" title="เอกสารสัญญาจะพิมพ์ราคาชุดนี้ ไม่ใช่ชุดที่ผูกอยู่">documents print this set · <span onclick="agAlertSyncRate('${a.id}')" style="cursor:pointer;color:var(--ag-blu)">sync</span></span>`)
        : `<span style="color:var(--ag-ink3);font-weight:400">Not named on any contract</span>`)
      + rowS('Season schedule', _seasons.length
        ? `${_seasons.length} period${_seasons.length===1?'':'s'} set`
          + `<span class="sub">${_seasons.map(x=>E((_rtFmtDate(x.from)||x.from)+' → '+(x.to?(_rtFmtDate(x.to)||x.to):'open'))).join(' · ')}</span>`
        : `<span style="color:var(--ag-ink3);font-weight:400" title="ตั้งล่วงหน้าได้ · ราคาก่อนวันแบ่งไม่ขยับ">Not set</span>`
          + `<span class="sub">set it in the Rate Type tab</span>`),
      (_conRt && _conRtId!==a.rateTypeId) ? tag('Mismatch','blu') : '', 'c4');
    const _nCharter = Object.keys(_rtNow.charterRates||{}).length;
    const _nAdd = Object.keys(_rtNow.addOns||{}).length;
    boxToday = box('Coverage',
      rowS('Routes priced', `<span class="mono">${_rtCover.filter(r=>periods.some(p=>p.routeId===r)).length}</span>`
        + `<span style="color:var(--ag-ink4);font-weight:400"> / ${periods.length} sold</span>`)
      + rowS('Extras', [_nCharter?'Charter':'', _nAdd?(_nAdd+' add-on'+(_nAdd>1?'s':'')):''].filter(Boolean).join(' · ')),
      '', 'c3');
  }
  const sect3 = sec('Rate used for pricing', 'read from the bound rate, not the contract',
      {txt:_rtNow?'Change rate':'Pick a rate', on:`agEditOpen('ratetype','${a.id}')`})
    + `<div class="ag-grp">` + boxBound + boxSeason + boxToday + `</div>`;

  /* ── บล็อก 4 · โปรแกรมที่ขาย ── */
  /* §agTight · สามค่าสรุป (จำนวนเส้น · ช่วงสัญญา · เส้นที่ปิดก่อนเพื่อน) เคยเป็นแถบของตัวเองสูงราว 60px
     ทั้งสามเป็นค่าสั้น ๆ ที่อ่านครั้งเดียว · ย้ายขึ้นไปอยู่บนหัวข้อ ได้ความสูงคืนโดยไม่เสียข้อมูล */
  const sect4 = sec('Programs sold',
      `${periods.length} route${periods.length===1?'':'s'} · contract <span class="mono">${fmtD(validityStart)} → ${fmtD(validityEnd)}</span>`
      + (earliestCutoff ? ` · first to close <span class="mono">${fmtD(earliestCutoff)}</span>${earliestCutoffName?(' '+E(earliestCutoffName.split(' ').slice(0,2).join(' '))):''}` : ''),
      [].concat(_missing.length ? [{txt:'Fill missing · '+_missing.length, on:`agEditOpen('programs','${a.id}')`}] : [],
                [{txt:'Edit programs', on:`agEditOpen('programs','${a.id}')`}]));

  /* ── บล็อก 5 · บริษัทและผู้ติดต่อ · ของที่ไปโผล่บนเอกสารสัญญา ── */
  const sect5 = sec('Company & Contact', 'printed onto contract documents',
      [{txt:'Company', on:`agEditOpen('company','${a.id}')`},
       {txt:'Signatory', on:`agEditOpen('signatory','${a.id}')`},
       {txt:'Notes', on:`agEditOpen('notes','${a.id}')`}]);

  return `
    ${sect1}
    ${sect2}
    ${sect3}
    ${(function(){
      /* §agStd · บล็อก Sample prices ถูกถอดออก
         สามตัวเลขนั้นเป็นตัวอย่างของเส้นทางแรกที่เจอเท่านั้น ไม่ใช่ราคาที่ใช้ตัดสินใจอะไรได้
         ใครอยากดูราคาจริงต้องไปแท็บ Pricing Matrix อยู่แล้ว ซึ่งมีครบทุกเส้นทุกโซน
         เหลือไว้แค่เรื่องที่ต้องลงมือ: เรทที่ผูกอยู่ถูกปิดใช้งาน */
      const rt = a.rateTypeId ? (typeof getRateType==='function' ? getRateType(a.rateTypeId) : null) : null;
      if(!rt || rt.active!==false) return '';
      return `<div class="ag-al red" style="border:1px solid var(--ag-line);border-radius:8px;background:#fff;margin-top:9px">`
        + `<span class="sev"><i></i>Inactive</span><span class="t">Rate type deactivated</span>`
        + `<span class="d">prices still resolve from it · activate it or bind another set</span>`
        + `<button class="go" onclick="nav(document.querySelector('.nav-item[data-view=&quot;rate-types&quot;]'))">Open rate types</button></div>`;
    })()}
    ${sect4}
      <!-- §agTight · แถบ coverage กับแถบสรุปถูกถอดออก
           เส้นที่เรทไม่มีราคาถูกพูดไปแล้วในบล็อก 1 (Needs action) พร้อมปุ่มพาไปแก้
           พูดสองที่แล้ววันหนึ่งจะไม่ตรงกัน · ปุ่ม "เติมที่ขาด" ย้ายขึ้นไปอยู่บนหัวข้อ -->
      <div class="agi-prog-wrap">
      <div class="agi-prog-header">
        <div>Route</div>
        <div class="agi-prog-pier-col">Pier</div>
        <div class="agi-col-bk">Booking period</div>
        <div>Travel period</div>
        <div>Status</div>
        <div></div>
      </div>

      <div class="agi-prog-list">
        ${periods.map(p=>{
          const r = ROUTES.find(rt=>rt.id===p.routeId);
          if(!r) return '';
          const pierTag = (r.pier||'').toUpperCase().replace('TUBLAMU','TUB LAMU').replace('PANWA','VISIT PANWA');
          const noteSuffix = p.note ? ` · ${p.note}` : '';
          const rv = rtForPeriods && _rvMap[p.routeId];
          const inheritedTravel = !!rv;
          const orphanRow = rtForPeriods && !rv;   // route not in RT
          /* §agStd · ชิป "↳ RT" ถูกถอด · ช่วงเดินทางทุกแถวมาจากเรทอยู่แล้ว (หัวข้อบอกไว้แล้วว่าอ่านจากเรท)
             แถวที่เรทไม่ได้บอกวัน ขึ้น "No dates" ในคอลัมน์สถานะแทน · ชิปที่ติดทุกแถวไม่ได้แยกอะไรออก
             และมันดันคอลัมน์วันให้กว้างขึ้นราว 35px จนชื่อเส้นทางโดนตัด */
          const travelInheritChip = '';
          /* §agStd · คอลัมน์สถานะ · "ขายได้วันนี้ไหม" เคยต้องอ่านช่วงวันสองช่องแล้วคิดเอง
             เส้นที่เรทไม่มีราคา อ่านจาก seatRates ที่เดียวกับที่ §agAlert ใช้
             (แยกกันเมื่อไหร่ ตารางกับแถบเตือนจะบอกคนละเรื่องในหน้าจอเดียวกัน) */
          let st = '<span style="color:var(--ag-ink4)">—</span>';
          if(_rtNow && !((_rtNow.seatRates||{})[p.routeId])) st = tag('No price','red');
          /* มีราคาแต่เรทไม่ได้บอกช่วงเดินทาง · ขายไม่ได้เหมือนกัน แต่คนละสาเหตุกับไม่มีราคา
             เดิมช่องนี้ขึ้น "—" ซึ่งไม่ได้บอกอะไรเลยทั้งที่เป็นเรื่องต้องแก้ */
          else if(orphanRow) st = tag('No dates','amb');
          else if(p.travelTo && p.travelTo < TODAY_STR) st = tag('Ended');
          else if(p.travelFrom && p.travelFrom > TODAY_STR) st = tag('Future');
          else if(p.travelFrom || p.travelTo) st = tag('Selling','grn');
          return `
            <div class="agi-prog-row">
              <div class="agi-prog-name-wrap">
                <div class="agi-prog-name" title="${E(r.name)}${pierTag?(' · '+E(pierTag)):''}${E(noteSuffix)}">${r.name}</div>
              </div>
              <!-- §agStd · ท่าเรือเป็นคอลัมน์ของตัวเอง · โผล่เฉพาะจอที่กว้างพอจริง (ดูกฎใน 01-base.css)
                   จอแคบกว่านั้นมันซ่อนตัวเอง แล้วไปอยู่ใน title ของชื่อเส้นทางแทน
                   เหตุผลเป็นเรื่องที่วัดได้: แผงนี้กว้างเท่าจอลบ 718px เสมอ (ลิสต์เอเย่นต์ + ขอบ)
                   คอลัมน์ครบหกช่องต้องการราว 800px · จอ 1440 เหลือแค่ 696px -->
              <div class="agi-prog-pier-col">${pierTag}</div>
              <div class="agi-period-col agi-col-bk">
                <div class="agi-period-lbl book">Booking</div>
                <div class="agi-period-val">${fmtD(p.bookFrom)} <span class="arrow">→</span> ${fmtD(p.bookTo)}</div>
              </div>
              <div class="agi-period-col">
                <div class="agi-period-lbl travel">Travel${travelInheritChip}</div>
                <div class="agi-period-val" ${orphanRow?'style="color:var(--ag-ink4)"':''}>${p.travelFrom||p.travelTo ? `${fmtD(p.travelFrom)} <span class="arrow">→</span> ${fmtD(p.travelTo)}` : '<span style="color:var(--ag-red)">not set in rate</span>'}</div>
              </div>
              <div class="agi-prog-st">${st}</div>
              <div class="agi-prog-actions">
                <!-- §agStd · เหลือปุ่มเดียว · ปุ่ม "ดู Pricing" ที่เคยอยู่คู่กันเป็นทางเข้าที่ซ้ำกับ
                     แท็บ Pricing Matrix และปุ่มในแถบ Needs action อยู่แล้ว · คืนที่ให้ชื่อเส้นทางไม่ต้องโดนตัด -->
                <button class="agi-prog-act-btn" title="Edit programs" onclick="agEditOpen('programs','${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              </div>
            </div>
          `;
        }).join('')}
        <div class="agi-prog-add" onclick="agEditOpen('programs','${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Add a program to this contract</div>
      </div>
      </div>

      <div class="agi-note">
        <span><b>Booking period</b> = when the booking may be taken · <b>Travel period</b> = when the trip may run, read from the rate type</span>
      </div>

    ${sect5}
    <div class="ag-grp">
      ${/* §agStd · "Name in system" กับ "Market" ถูกถอดออกจากกล่องนี้
            ทั้งคู่อยู่บนหัวแผงไปแล้ว (ชื่อเอเย่นต์ + บรรทัดตลาดใต้ชื่อ)
            ซ้ำสองที่แล้ววันหนึ่งจะไม่ตรงกัน และกินความสูงไปสองแถวเปล่า ๆ */''}
      ${box('Company',
          rowS('Legal name', E(ci.legalName||a.name))
        + rowS('TAT license', ci.tatLicense?`<span class="mono">${E(ci.tatLicense)}</span>`:'')
        + rowS('Address', E(ci.address||'')))}
      ${box('Contact',
          rowS('Person', E(a.contact||''))
        + rowS('Telephone', ci.tel?`<span class="mono">${E(ci.tel)}</span>`:'')
        + rowS('Hotline', ci.hotline?`<span class="mono">${E(ci.hotline)}</span>`:'')
        + rowS('Email', E(a.email||''))
        + rowS('Website', ci.website?`<a href="https://${E(ci.website)}" target="_blank" style="color:var(--ag-blu);text-decoration:none">${E(ci.website)}</a>`:''))}
      ${box('Sales owner',
          rowS('Owner', sales
            ? `${E(sales.name||'')}${sales.fullName?`<span class="sub">${E(sales.fullName)}</span>`:''}`
            : '')
        + rowS('Role', E(sales?.designation||''))
        + rowS('Reach at', `${E(sales?.email||'')}${sales?.tel?(`<span class="sub mono">${E(sales.tel)}</span>`):''}`),
        `<span onclick="agEditOpen('sales','${a.id}')" style="cursor:pointer;color:var(--ag-navy);font-weight:500">Change</span>`)}
      ${box('Agent signatory',
          rowS('Signs for', E(ci.legalName||a.name))
        + rowS('Name', E(sig.name||''))
        + rowS('Designation', E(sig.designation||'Authorized Signatory'))
        + rowS('Signed', sig.signedDate ? E(fmtD(sig.signedDate)) : tag('Not signed','amb')))}
      ${(()=>{
        const _t  = (typeof ctTmplForAgent==='function') ? ctTmplForAgent(a) : null;
        const _bound = !!a.contractTemplateId;
        const _nSec = _t && _t.sections ? Object.keys(_t.sections).filter(k=>_t.sections[k]).length : 0;
        return box('Contract template',
            rowS('Template', _t
              ? `${E(_t.name||'')}<span class="sub mono">${E(_t.code||_t.id)}</span>`
              : `<span style="color:var(--ag-red)">No contract template in the system</span>`)
          + rowS('Sections', _t ? `${_nSec} enabled<span class="sub" title="${_bound?'ผูกกับเอเยนต์รายนี้โดยตรง':'เปลี่ยน default ส่วนกลางแล้วเอเยนต์นี้เปลี่ยนตาม'}">${_bound?'bound to this agent':'workspace default'}</span>` : ''),
          `<span onclick="agEditOpen('contracttmpl','${a.id}')" style="cursor:pointer;color:var(--ag-navy);font-weight:500">Change</span>`);
      })()}
      ${box('Internal notes',
          a.note
            ? `<div class="r" style="border-bottom:none"><span class="v" style="font-weight:400">${a.note.replace(/\n/g,'<br>').replace(/(•|·)/g,'•')}</span></div>`
            : `<div class="r" style="border-bottom:none"><span class="v" style="font-weight:400;color:var(--ag-ink4)">No notes yet.</span></div>`,
          `<span onclick="agEditOpen('notes','${a.id}')" style="cursor:pointer;color:var(--ag-navy);font-weight:500">${a.note?'Edit':'Add'}</span>`)}
    </div>
  `;
}

function agTabPrices(a){
  let html = '';

  /* §promoMx · สัญญา + Promotion อยู่บนสุดของหน้าราคา
     ตารางข้างล่างคือราคาของ "เรตมาตรฐาน" ใบเดียว · ถ้ามีโปรทับอยู่
     ราคาที่ระบบคิดจริงในช่วงนั้นจะไม่ใช่ตัวเลขในตาราง — ต้องเห็นพร้อมกัน */
  html += (typeof ctContractsPanelHTML==='function') ? ctContractsPanelHTML(a.id) : '';

  // Resolve rate type — Rate Type is the source of truth for prices
  const rt = a.rateTypeId && typeof getRateType==='function' ? getRateType(a.rateTypeId) : null;

  // ════ SECTION 1: PRICING MATRIX ════
  html += `
    <div class="agp-sect">
      <div class="agp-sect-hd">
        <div>
          <div class="agp-sect-ttl">Pricing Matrix</div>
          <div class="agp-sect-desc">ราคาดึงจาก Rate Type ที่ผูกกับ Agent · Program × Transfer Zone × Pax Type</div>
        </div>
      </div>
  `;

  if(!rt){
    // No rate type — empty state, CTA to assign
    html += `<div style="background:#FCEBEB;border:1px solid rgba(163,45,45,.2);border-radius:10px;padding:18px 20px;margin:6px 0">
      <div style="display:flex;align-items:center;gap:8px;color:#A32D2D;font-size:13px;font-weight:600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        No rate type assigned
      </div>
      <div style="font-size:11.5px;color:#A32D2D;margin-top:6px;line-height:1.55;opacity:.88">Agent นี้ยังไม่มี Rate Type ผูกไว้ — ราคาในระบบจึงยังไม่ถูก resolve · จองให้ agent นี้ต้องใส่ราคาเองทุก booking</div>
      <div style="margin-top:12px"><button onclick="agEditOpen('ratetype','${a.id}')" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:11.5px;font-weight:600;padding:7px 14px;border-radius:7px;cursor:pointer">เลือก Rate Type</button></div>
    </div>`;
    html += `</div>`;
    // Skip add-on section (also depends on rate type's addOns)
    return html;
  }

  // Rate type found — show source chip + render from rt.seatRates
  const tint = rt.color + '14';
  const isInactive = rt.active === false;
  const validHint = (rt.validFrom||rt.validTo) ? ((typeof _rtFmtDate==='function'?_rtFmtDate(rt.validFrom):rt.validFrom)||'—')+' → '+((typeof _rtFmtDate==='function'?_rtFmtDate(rt.validTo):rt.validTo)||'—') : 'always valid';
  html += `<div style="background:${isInactive?'#FFF5EB':tint};border:1px solid ${isInactive?'#F0997B':rt.color+'33'};border-radius:10px;padding:9px 13px;margin:4px 0 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:${isInactive?'#854F0B':rt.color};flex-wrap:wrap">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
      <span style="font-weight:500">Source: Rate Type</span>
      <span style="background:#fff;color:${rt.color};font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:6px;font-variant-numeric:tabular-nums;letter-spacing:.02em">${rt.code}</span>
      <span style="font-weight:600">${rt.name}</span>
      ${isInactive?'<span style="background:#F1EFE8;color:#5F5E5A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;text-transform:uppercase;letter-spacing:.04em">Inactive</span>':''}
      <span style="font-size:10px;color:${isInactive?'#854F0B':rt.color};opacity:.7;font-variant-numeric:tabular-nums" title="ช่วงที่ตกลงราคากันไว้ · ไม่ได้กั้นการคิดเงิน — จองนอกช่วงก็ยังคิดราคาชุดนี้">${validHint}</span>
      <span style="font-size:9.5px;color:#8A929E;font-weight:500">(ช่วงที่ตกลงราคา &middot; ไม่ได้กั้นการคิดเงิน)</span>
    </div>
    <button onclick="agEditOpen('ratetype','${a.id}')" style="background:#fff;color:${rt.color};border:1px solid ${rt.color}55;font-family:inherit;font-size:10.5px;font-weight:600;padding:4px 11px;border-radius:6px;cursor:pointer">เปลี่ยน Rate Type</button>
  </div>`;
  /* §rtTab · งานจัดการเรท (วันหมด · ตารางฤดูกาล) ย้ายไปแท็บ Rate Type แล้ว
     หน้านี้ชื่อ Pricing Matrix · หน้าที่เดียวคือโชว์ตารางราคา ไม่ต้องมีของให้ตั้ง
     เหลือบรรทัดชี้ทางไว้บรรทัดเดียว เพราะคนที่สงสัยเรื่องเรทมักสงสัยตอนมองราคาอยู่ */
  html += (typeof rtMatrixHint==='function') ? rtMatrixHint(a) : '';

  /* §promoMx · ACTIVE PERIOD ในตารางดูเหมือนประตูกั้นราคา แต่วัดแล้วไม่ใช่
     จองนอกช่วงก็ยังคิดราคาเดิม · และตามที่ตกลงกันไว้ก็ควรเป็นแบบนั้น
     ราคามาตรฐานคือตัวสำรองที่ต้องมีเสมอ ตัวที่สลับราคาตามวันคือ Promotion
     อยู่เหนือตาราง เพราะต้องอ่านก่อนเห็นตัวเลข ไม่ใช่หลังอ่านจบไปสามหน้าจอ */
  html += `<div style="margin:0 0 12px;background:#F7F8FA;border:1px solid #E7EAEF;border-radius:8px;padding:9px 13px;font-size:11px;color:#5A6270;line-height:1.6">
    <b style="color:#3C4553">\u0e04\u0e2d\u0e25\u0e31\u0e21\u0e19\u0e4c ACTIVE PERIOD</b> \u0e04\u0e37\u0e2d\u0e24\u0e14\u0e39\u0e01\u0e32\u0e25\u0e17\u0e35\u0e48\u0e15\u0e01\u0e25\u0e07\u0e23\u0e32\u0e04\u0e32\u0e01\u0e31\u0e19\u0e44\u0e27\u0e49 \u00b7 \u0e43\u0e0a\u0e49\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07\u0e41\u0e25\u0e30\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e25\u0e07\u0e2a\u0e31\u0e0d\u0e0d\u0e32
    <span style="color:#8A929E">\u2014 \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e1b\u0e34\u0e14\u0e01\u0e31\u0e49\u0e19\u0e01\u0e32\u0e23\u0e04\u0e34\u0e14\u0e40\u0e07\u0e34\u0e19 \u0e08\u0e2d\u0e07\u0e19\u0e2d\u0e01\u0e0a\u0e48\u0e27\u0e07\u0e01\u0e47\u0e22\u0e31\u0e07\u0e44\u0e14\u0e49\u0e23\u0e32\u0e04\u0e32\u0e19\u0e35\u0e49</span><br>
    \u0e15\u0e31\u0e27\u0e17\u0e35\u0e48\u0e2a\u0e25\u0e31\u0e1a\u0e23\u0e32\u0e04\u0e32\u0e15\u0e32\u0e21\u0e27\u0e31\u0e19\u0e08\u0e23\u0e34\u0e07 \u0e04\u0e37\u0e2d <b style="color:#9A5410">Promotion</b> \u0e14\u0e49\u0e32\u0e19\u0e1a\u0e19 \u00b7 \u0e2d\u0e22\u0e32\u0e01\u0e43\u0e2b\u0e49\u0e0a\u0e48\u0e27\u0e07\u0e44\u0e2b\u0e19\u0e04\u0e34\u0e14\u0e2d\u0e35\u0e01\u0e23\u0e32\u0e04\u0e32 \u0e43\u0e2b\u0e49\u0e40\u0e1e\u0e34\u0e48\u0e21 Promotion \u0e04\u0e23\u0e2d\u0e1a\u0e0a\u0e48\u0e27\u0e07\u0e19\u0e31\u0e49\u0e19
  </div>`;

  // Intersection of agent.programs and rt.routes (used for mismatch warnings below)
  const agentProgRouteIds = a.programs || [];
  const rtRouteIds = rt.routes || [];
  const inBoth = agentProgRouteIds.filter(rId => rtRouteIds.includes(rId)).map(rId => ROUTES.find(x => x.id === rId)).filter(Boolean);
  const inAgentNotRT = agentProgRouteIds.filter(rId => !rtRouteIds.includes(rId)).map(rId => ROUTES.find(x => x.id === rId)).filter(Boolean);
  const inRTNotAgent = rtRouteIds.filter(rId => !agentProgRouteIds.includes(rId)).map(rId => ROUTES.find(x => x.id === rId)).filter(Boolean);

  /* §agPromoCov (2026-09-12) · "Rate type ที่เลือกไว้จะเป็น Rate มาตรฐาน · หลังจากนั้น
     เพิ่ม Promotion ระบุวันที่แอคทีฟ · ราคาอันไหนมีสำหรับโปรโมชั่นใช้อันนั้น
     อันไหนไม่มี เตือนว่าไม่มีโปรโมชั่น ใช้เรทมาตรฐาน"

     ตรวจแล้วเครื่องคิดราคาทำตามนี้อยู่แล้วทุกข้อ (bkV2ResolveRateType + bkV2GetRTForTrip)
     ที่ขาดคือ "การเตือน" — หน้าจอไม่เคยบอกว่า route ไหนมีโปรทับ route ไหนตกไปเรทมาตรฐาน
     ต้องไล่เปิดใบโปรทีละใบเทียบเอง

     สองอย่างที่ต้องแยกให้ออก และเคยพลาดกันได้ง่าย:
       ก) route ไม่มีใบโปรคลุมเลย            → ใช้เรทมาตรฐาน (ปกติ)
       ข) มีใบโปรคลุม แต่ Rate Type ของใบนั้นไม่มีราคาของ route นี้
          → ตัวคิดราคา "ข้าม" กลับไปใช้เรทมาตรฐาน (กติกาข้อ 2 · ไม่คิดเป็น 0)
          อันนี้อันตรายกว่า เพราะคนตั้งคิดว่าโปรทำงานอยู่ แต่จริง ๆ ไม่ได้ทับ */
  (function(){
    var _PR=((typeof SB_CONTRACTS!=='undefined'&&Array.isArray(SB_CONTRACTS))?SB_CONTRACTS:[])
      .filter(function(c){ return c && c.agentId===a.id && c.kind==='promo'
        && c.status!=='void' && c.status!=='cancelled' && c.status!=='expired'; });
    var routes=(inBoth||[]);
    if(!routes.length) return;
    var fd=function(x){ return x?((typeof _rtFmtDate==='function')?(_rtFmtDate(x)||x):x):'…'; };
    var rows='', nCov=0, nSkip=0;
    routes.forEach(function(R){
      var hits=[];
      _PR.forEach(function(c){
        (c.programPeriods||[]).forEach(function(p){
          if(p.routeId!==R.id) return;
          /* §b2bPromo · เช็คผ่าน laPromoHasRate · รู้จักทั้งใบที่ดึงจาก Rate Type และใบที่กรอกราคาเอง
             เขียนกติกาซ้ำตรงนี้เมื่อไหร่ หน้าจอกับตัวคิดราคาจะแยกร่างกันทันที */
          var own=(c.priceMode||'rate')==='own';
          var prt=own?null:(SB_RATE_TYPES||[]).find(function(x){ return x.id===c.rateTypeId; });
          var has=laPromoHasRate(c, R.id);
          hits.push({ ver:c.version||c.id||'promo',
                      rtCode:own?'ราคาในใบโปร':(prt?(prt.code||''):'(ไม่พบ Rate Type)'),
                      own:own, bf:(c.bookWin?(p.bookFrom||''):''), bt:(c.bookWin?(p.bookTo||''):''),
                      from:p.travelFrom||c.activeFrom||'', to:p.travelTo||c.activeTo||'', has:has });
        });
      });
      var live=hits.filter(function(h){ return h.has; });
      var dead=hits.filter(function(h){ return !h.has; });
      if(live.length) nCov++; if(dead.length) nSkip++;
      var tag = live.length
        ? live.map(function(h){ return '<span style="background:#FBF0DD;color:#7A4A00;border:1px solid #EAD9B0;border-radius:6px;padding:2px 7px;font-size:9.5px;font-weight:700;white-space:nowrap" title="'
            +_ctEsc(h.own?'ราคากรอกไว้ในใบโปรเอง':('ราคามาจาก Rate Type '+h.rtCode))
            +_ctEsc(h.bf||h.bt?(' · ต้องจองระหว่าง '+fd(h.bf)+' – '+fd(h.bt)):' · ไม่จำกัดวันจอง')
            +'">PROMO '+_ctEsc(h.ver)+' &middot; '+fd(h.from)+' &rarr; '+fd(h.to)
            +(h.own?' &middot; \u0e23\u0e32\u0e04\u0e32\u0e43\u0e19\u0e43\u0e1a':'')
            +((h.bf||h.bt)?' &middot; &#128197;':'')+'</span>'; }).join(' ')
        : '<span style="color:#8A929E;font-size:10.5px">ไม่มีโปรโมชั่น &middot; ใช้เรทมาตรฐาน</span>';
      var warn = dead.length
        ? '<div style="margin-top:3px;font-size:10px;color:#A32D2D">&#9888; '+dead.length+' ใบคลุม route นี้ไว้ แต่'
          +(dead[0].own?'ไม่ได้กรอกราคาของ route นี้ไว้ในใบ':('Rate Type ของใบนั้น ('+_ctEsc(dead[0].rtCode)+') ไม่มีราคาของ route นี้'))
          +' &rarr; ระบบข้าม ใช้เรทมาตรฐานแทน</div>'
        : '';
      rows += '<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-top:1px solid #EFECE6">'
        + '<div style="flex:1;min-width:0;font-size:11.5px;font-weight:600;color:#3C4553">'+_ctEsc(R.name||R.id)+warn+'</div>'
        + '<div style="flex:none;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:58%">'+tag+'</div>'
        + '</div>';
    });
    html += '<div style="margin:0 0 12px;background:#FBFAF8;border:1px solid #EFECE6;border-radius:9px;padding:10px 13px">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#3C4553;font-weight:600">'
      + 'โปรโมชั่นที่ทับเรทมาตรฐาน'
      + '<span style="background:#F1EFE8;color:#5F5E5A;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:700">'+_PR.length+' ใบ</span>'
      + '<span style="font-weight:500;color:#8A929E;font-size:10.5px">'
      + nCov+' จาก '+routes.length+' route มีโปรทับบางช่วง &middot; ที่เหลือใช้เรทมาตรฐานทั้งปี'
      + (nSkip?(' &middot; <b style="color:#A32D2D">'+nSkip+' route โปรไม่มีราคา &rarr; ถูกข้าม</b>'):'')
      + '</span></div>'
      /* §prList · ไม่มีใบโปรสักใบ = ไม่ต้องไล่ route ทีละบรรทัดมาบอกว่า "ไม่มีโปรโมชั่น"
         12 route ก็ 12 บรรทัดที่พูดเรื่องเดียวกัน ดันตารางราคาตกจอไปฟรี ๆ
         มีโปรเมื่อไหร่ค่อยกาง · ตอนนั้นแต่ละบรรทัดมีเนื้อหาต่างกันจริง */
      + (_PR.length ? rows : '') + '</div>';
  })();

  // Full Rate Type detail form — seat rates (with Active period + Not-Offered),
  // charter, and add-ons. Same renderer as the Rate Type page (single source of truth).
  html += rtBuildDetailBody(rt);

  // Mismatch warnings
  if(inAgentNotRT.length > 0){
    html += `<div style="margin-top:10px;background:#FFF5EB;border:1px solid #F0997B33;border-radius:8px;padding:8px 12px;font-size:11px;color:#854F0B">
      <strong>⚠ ${inAgentNotRT.length} route ใน contract แต่ไม่มีใน Rate Type:</strong>
      <span style="opacity:.85"> ${inAgentNotRT.map(r => r.name).join(', ')} — ไม่มีราคาให้ resolve (booking ต้องใส่เอง หรือเพิ่ม route ใน rate type)</span>
    </div>`;
  }
  if(inRTNotAgent.length > 0){
    html += `<div style="margin-top:6px;background:#F1EFE8;border:1px solid var(--fd-line);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--fd-ink-soft)">
      <strong>ℹ ${inRTNotAgent.length} route ใน Rate Type แต่ไม่มีใน contract:</strong>
      <span> ${inRTNotAgent.map(r => r.name).join(', ')} — Rate Type มีราคารองรับ แต่ Agent ยังไม่ได้รวมไว้ในสัญญา</span>
    </div>`;
  }

  html += `</div>`;

  // ════ SECTION 2: ADDITIONAL SERVICES ════
  html += agpRenderAddonSection(a);

  return html;
}

function agpRenderAddonSection(a){
  const picked = a.addonServices || [];
  const totalVariants = picked.reduce((acc,p)=>acc+(p.variants||[]).length, 0);
  let html = `
    <div class="agp-sect">
      <div class="agp-sect-hd">
        <div>
          <div class="agp-sect-ttl">Additional Services <span class="agp-sect-cnt">${picked.length} service${picked.length===1?'':'s'} · ${totalVariants} variant${totalVariants===1?'':'s'}</span></div>
          <div class="agp-sect-desc">บริการเสริม · เลือกจาก Master list + ระบุราคา Selling / Net</div>
        </div>
        <button class="agp-sect-act" onclick="agpAddonPick('${a.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          เลือก Service
        </button>
      </div>
  `;

  if(picked.length===0){
    html += `
      <div class="agp-addon-empty">
        <div style="font-size:24px;margin-bottom:6px;opacity:.4">⊕</div>
        <div style="font-weight:600;color:var(--ink);margin-bottom:3px">ยังไม่มี Add-on Service</div>
        <div style="font-size:11px;color:var(--ink-soft)">กดปุ่ม "เลือก Service" ด้านบนเพื่อเพิ่มจาก Master list</div>
      </div>
    `;
  } else {
    html += `<div class="agp-addon-list">`;
    picked.forEach(p=>{
      const svc = SB_ADDON_SVCS.find(s=>s.id===p.svcId);
      if(!svc) return;
      html += `
        <div class="agp-addon-card">
          <div class="agp-addon-card-hd">
            <div class="aos-svc-icon ${svc.icon||'other'}" style="width:32px;height:32px">${AOS_ICONS[svc.icon||'other']}</div>
            <div class="agp-addon-card-info">
              <div class="agp-addon-card-name">${svc.name}</div>
              <div class="agp-addon-card-meta">${(p.variants||[]).length} variant${(p.variants||[]).length===1?'':'s'} in contract</div>
            </div>
            <div style="display:flex;gap:5px">
              <button class="aos-icon-btn" onclick="agpAddonEditVariants('${a.id}','${p.svcId}')" title="แก้ราคา">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="aos-icon-btn danger" onclick="agpAddonRemove('${a.id}','${p.svcId}')" title="ลบ Service ออกจากสัญญา">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </div>
          <div class="agp-addon-card-body">
            <div class="agp-addon-variants">
              ${(p.variants||[]).map(av=>{
                const v = svc.variants.find(x=>x.id===av.varId);
                if(!v) return '';
                return `
                  <div class="agp-addon-variant">
                    <div class="agp-addon-variant-info">
                      <div class="agp-addon-variant-ttl">${v.name}</div>
                      <div class="agp-addon-variant-unit">${v.unit||'—'}</div>
                    </div>
                    <div class="agp-addon-pcol">
                      <div class="agp-addon-plbl">Selling</div>
                      <div class="agp-addon-pval">${av.selling?`฿${sbFmtTHB(av.selling)}`:'—'}</div>
                    </div>
                    <div class="agp-addon-pcol">
                      <div class="agp-addon-plbl">Net</div>
                      <div class="agp-addon-pval net">${av.net?`฿${sbFmtTHB(av.net)}`:'—'}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function agpAddonPick(agentId){
  const a = sbGetAgent(agentId); if(!a) return;
  _agpAddonAgentId = agentId;
  _agpAddonEditSvcId = null;
  _agpAddonDraft = null;
  agpAddonOpenPickerModal();
}
function agpAddonEditVariants(agentId, svcId){
  const a = sbGetAgent(agentId); if(!a) return;
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  const picked = (a.addonServices||[]).find(p=>p.svcId===svcId);
  if(!picked) return;
  _agpAddonAgentId = agentId;
  _agpAddonEditSvcId = svcId;
  _agpAddonDraft = { svcId, variants: JSON.parse(JSON.stringify(picked.variants||[])) };
  agpAddonOpenVariantModal(svc);
}
function agpAddonRemove(agentId, svcId){
  const a = sbGetAgent(agentId); if(!a) return;
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId);
  if(!confirm(`ลบ "${svc?.name||'Service นี้'}" ออกจากสัญญา ?`)) return;
  a.addonServices = (a.addonServices||[]).filter(p=>p.svcId!==svcId);
  agRenderDetail(agentId);
}

function agpAddonOpenPickerModal(){
  const a = sbGetAgent(_agpAddonAgentId); if(!a) return;
  const used = (a.addonServices||[]).map(p=>p.svcId);
  const available = SB_ADDON_SVCS.filter(s=>!used.includes(s.id));
  const modal = document.getElementById('agp-addon-modal');
  document.getElementById('agp-addon-ttl').textContent = 'เลือก Service จาก Master list';
  const body = document.getElementById('agp-addon-body');
  if(available.length===0){
    body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ink-soft);font-size:13px">ทุก Service ใน Master list อยู่ในสัญญานี้แล้ว · ถ้าอยากเพิ่ม Service ใหม่ ไปที่ Add-on Services Config</div>';
  } else {
    body.innerHTML = `
      <div style="font-size:11px;color:var(--ink-soft);line-height:1.5;margin-bottom:4px">เลือก Service ที่ต้องการเพิ่ม · ระบบจะเอา variants ทั้งหมดของ service นั้นมาเป็นค่าตั้งต้น (ยังไม่มีราคา) จากนั้นกดแก้ไขเพื่อระบุราคา</div>
      <div class="agp-pick-list">
        ${available.map(s=>`
          <div class="agp-pick-card" onclick="agpAddonAddService('${s.id}')">
            <div class="aos-svc-icon ${s.icon||'other'}" style="width:32px;height:32px">${AOS_ICONS[s.icon||'other']}</div>
            <div class="agp-pick-info">
              <div class="agp-pick-name">${s.name}</div>
              <div class="agp-pick-meta">${s.variants.length} variant${s.variants.length===1?'':'s'}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--coral)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        `).join('')}
      </div>
    `;
  }
  document.getElementById('agp-addon-actions').innerHTML = `<button class="agp-btn-ghost" onclick="agpAddonCloseModal()" type="button">ปิด</button>`;
  modal.style.display = 'flex';
}

function agpAddonAddService(svcId){
  const a = sbGetAgent(_agpAddonAgentId); if(!a) return;
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  if(!a.addonServices) a.addonServices = [];
  // Add with all variants but no prices
  a.addonServices.push({
    svcId,
    variants: svc.variants.map(v=>({ varId:v.id, selling:0, net:0 }))
  });
  // Switch to variant edit modal directly
  _agpAddonEditSvcId = svcId;
  _agpAddonDraft = { svcId, variants: JSON.parse(JSON.stringify(a.addonServices.find(p=>p.svcId===svcId).variants)) };
  agpAddonOpenVariantModal(svc);
}

function agpAddonOpenVariantModal(svc){
  const modal = document.getElementById('agp-addon-modal');
  document.getElementById('agp-addon-ttl').textContent = `ระบุราคา · ${svc.name}`;
  const body = document.getElementById('agp-addon-body');
  body.innerHTML = `
    <div style="font-size:11px;color:var(--ink-soft);line-height:1.5;margin-bottom:4px">ระบุราคา Selling และ Net ของแต่ละ variant · ปล่อยว่างถ้าไม่ใช้ variant นั้น</div>
    <div class="agp-var-list">
      ${svc.variants.map((v,i)=>{
        const draftV = _agpAddonDraft.variants.find(x=>x.varId===v.id) || {varId:v.id,selling:0,net:0};
        return `
          <div class="agp-var-row">
            <div class="agp-var-info">
              <div class="agp-var-ttl">${v.name}</div>
              <div class="agp-var-unit">${v.unit||'—'}</div>
            </div>
            <div class="agp-var-fld">
              <label>Selling (฿)</label>
              <input type="number" min="0" value="${draftV.selling||0}" oninput="agpAddonSetPrice('${v.id}','selling',this.value)">
            </div>
            <div class="agp-var-fld">
              <label>Net (฿)</label>
              <input type="number" min="0" value="${draftV.net||0}" oninput="agpAddonSetPrice('${v.id}','net',this.value)">
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  document.getElementById('agp-addon-actions').innerHTML = `
    <button class="agp-btn-ghost" onclick="agpAddonCloseModal()" type="button">ยกเลิก</button>
    <button class="agp-btn-primary" onclick="agpAddonSaveVariants()" type="button">บันทึก</button>
  `;
  modal.style.display = 'flex';
}

function agpAddonSetPrice(varId, key, val){
  if(!_agpAddonDraft) return;
  let v = _agpAddonDraft.variants.find(x=>x.varId===varId);
  if(!v){ v={varId,selling:0,net:0}; _agpAddonDraft.variants.push(v); }
  v[key] = parseInt(val)||0;
}

function agpAddonSaveVariants(){
  const a = sbGetAgent(_agpAddonAgentId); if(!a){ agpAddonCloseModal(); return; }
  if(!a.addonServices) a.addonServices = [];
  const idx = a.addonServices.findIndex(p=>p.svcId===_agpAddonEditSvcId);
  if(idx>=0){
    a.addonServices[idx].variants = _agpAddonDraft.variants;
  }
  agpAddonCloseModal();
  agRenderDetail(_agpAddonAgentId);
}

function agpAddonCloseModal(){
  document.getElementById('agp-addon-modal').style.display = 'none';
  _agpAddonAgentId = null;
  _agpAddonEditSvcId = null;
  _agpAddonDraft = null;
}

// ── Nav notification: count + badge ──
function agUpdateExpiringBadge(){
  const count = ctCountExpiringAgents();
  // Find the nav item for "agents"
  const navItem = document.querySelector('.nav-item[data-view="agents"]');
  if(!navItem) return;
  // Remove old badge
  const old = navItem.querySelector('.ct-nav-badge');
  if(old) old.remove();
  if(count > 0){
    const badge = document.createElement('span');
    badge.className = 'ct-nav-badge';
    badge.textContent = count;
    badge.title = `${count} contract${count===1?'':'s'} expiring within 30 days`;
    navItem.appendChild(badge);
  }
}


// ════ Generated Contracts tab · history of all generated PDFs ════
function agTabContracts(a){
  const artifacts = (typeof ctArtifactsFor === 'function') ? ctArtifactsFor(a.id) : [];
  const fmtDateTime = (iso) => {
    if(!iso) return '—';
    const d = new Date(iso); if(isNaN(d)) return iso;
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const HH = String(d.getHours()).padStart(2,'0');
    const MM = String(d.getMinutes()).padStart(2,'0');
    return `${String(d.getDate()).padStart(2,'0')} ${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)} · ${HH}:${MM}`;
  };
  /* §promoMx · กล่องสัญญา + Promotion ย้ายไปอยู่แท็บ Pricing Matrix แล้ว
     Promotion คือของที่เปลี่ยนราคา · ที่ของมันคือหน้าราคา ไม่ใช่หน้าเก็บ PDF
     แท็บนี้เหลือแค่เอกสารที่ generate ไปแล้ว ตรงตามชื่อแท็บ */
  return `
    <div class="agi-sect" style="margin:0">
      <div class="agi-sect-hd">
        <div>
          <div class="agi-sect-ttl">Generated Contracts <span class="agi-sect-cnt">${artifacts.length} document${artifacts.length===1?'':'s'}</span></div>
          <div class="agi-sect-desc">เอกสารสัญญาที่ generate ไปแล้ว · เปิดดู · พิมพ์ซ้ำ · แก้แล้วบันทึกเป็น version ใหม่</div>
        </div>
        <button class="agi-sect-act" onclick="ctDocOpen('${a.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Generate New
        </button>
      </div>
      ${artifacts.length === 0 ? `
        <div style="background:#fafaf8;border:1px dashed var(--fd-line);border-radius:10px;padding:36px 18px;text-align:center">
          <div style="font-size:32px;opacity:.35;margin-bottom:8px">📄</div>
          <div style="font-size:13px;font-weight:600;color:var(--fd-ink);margin-bottom:5px">ยังไม่เคย generate เอกสาร</div>
          <div style="font-size:11px;color:var(--fd-ink-soft);max-width:340px;margin:0 auto;line-height:1.55">คลิก <strong>Generate New</strong> ด้านบน หรือปุ่ม <strong>Generate Contract</strong> สีกรมท่าที่ header เพื่อสร้างเอกสาร PDF ฉบับใหม่</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${artifacts.map((art, i) => {
            const isLatest = i === 0;
            const langFlag = art.lang === 'th' ? '🇹🇭' : '🇬🇧';
            return `
              <div style="background:#fff;border:1px solid var(--fd-line);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px">
                <div style="width:40px;height:40px;border-radius:50%;background:${isLatest?'#0F6E56':'#9b9590'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📄</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
                    <span style="font-size:14px;font-weight:700;color:var(--fd-ink)">${art.version}</span>
                    <span style="font-size:11.5px;color:var(--fd-ink-soft)">${langFlag} ${art.lang === 'th' ? 'Thai' : 'English'}</span>
                    <span style="font-size:10.5px;color:var(--fd-ink-soft);font-variant-numeric:tabular-nums">· ${art.pageCount} page${art.pageCount===1?'':'s'}</span>
                    ${isLatest ? '<span style="background:#E1F5EE;color:#0F6E56;font-size:9.5px;font-weight:700;letter-spacing:.04em;padding:2px 8px;border-radius:7px;text-transform:uppercase">Latest</span>' : ''}
                  </div>
                  <div style="font-size:11px;color:var(--fd-ink-soft);font-variant-numeric:tabular-nums;line-height:1.45">Generated ${fmtDateTime(art.generatedAt)}${art.rateTypeRef ? ` · based on RT <strong style="color:var(--fd-ink-mid)">${art.rateTypeRef}</strong>` : ''}${(art.customClauses||[]).length ? ` · ${art.customClauses.length} custom clause${art.customClauses.length===1?'':'s'}` : ''}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  <button onclick="ctArtifactReopen('${a.id}','${art.id}')" title="Reopen in wizard · view or edit + reprint"
                    style="background:#fff;border:1px solid var(--fd-line);font-family:inherit;font-size:11px;font-weight:600;color:var(--fd-ink);padding:7px 13px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View / Edit
                  </button>
                  <button onclick="ctArtifactRemove('${a.id}','${art.id}')" title="Remove from history"
                    style="background:transparent;border:1px solid var(--fd-line);font-family:inherit;font-size:14px;color:#A32D2D;padding:7px 11px;border-radius:8px;cursor:pointer">✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}
function agHistGo(aId,p){ _agHistPage=p; const a=sbGetAgent(aId); if(!a) return; const body=document.getElementById('ag-tabbody'); if(body) body.innerHTML=agTabHist(a); }
function agTabHist(a){
  // Match by agentId (bookings link to agent via .agentId) · handle v2 (trips[]) + legacy v1 schema
  // Paginated: 15 per page, newest first · page tabs below
  const all = SB_BOOKINGS.filter(b=>b.agentId===a.id).slice().reverse();
  if(all.length===0) return '<div class="sb-empty">ยังไม่มีการจองจาก Agent นี้</div>';
  const PER=15; const pages=Math.max(1,Math.ceil(all.length/PER));
  const page=Math.min(Math.max(0,_agHistPage||0),pages-1);
  const list=all.slice(page*PER, page*PER+PER);
  const rName = id => (ROUTES.find(x=>x.id===id)||{}).name || '—';
  let html = `<div style="overflow-x:auto"><table class="bk-recent-tbl">
    <thead><tr><th>BK-ID</th><th>วันเดินทาง</th><th>Customer</th><th>Program</th><th class="num">PAX</th><th class="num">Total</th><th>สถานะ</th></tr></thead>
    <tbody>`;
  list.forEach(bk=>{
    let dateStr='—', prog='—', totPax=0;
    if(bk.schemaVer===2 || Array.isArray(bk.trips)){
      const trips = bk.trips || [];
      const dates = trips.map(t=>t.date).filter(Boolean).sort();
      dateStr = dates.length ? (sbFmtDate(dates[0]) + (dates.length>1?` +${dates.length-1}`:'')) : '—';
      prog = trips.length ? (rName(trips[0].routeId) + (trips.length>1?` +${trips.length-1}`:'')) : '—';
      totPax = trips.reduce((s,t)=> s + (typeof bkV2PaxAllTot==='function'?bkV2PaxAllTot(t.pax):0), 0);
    } else {
      dateStr = sbFmtDate(bk.travelDate);
      prog = rName(bk.programId);
      totPax = ((bk.pax||{}).adult||0)+((bk.pax||{}).child||0)+((bk.pax||{}).infant||0);
    }
    const cust = bk.leadPax || bk.customerName || '—';
    const st = bk.status || '—';
    html += `<tr>
      <td class="bk-id">${bk.code||bk.id}</td>
      <td>${dateStr}</td>
      <td>${cust}</td>
      <td>${prog}</td>
      <td class="num">${totPax}</td>
      <td class="num">฿${sbFmtTHB(bk.total)}</td>
      <td><span class="pill ${st==='confirmed'?'pill-green':'pill-amber'}">${st}</span></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  // ── pagination nav ──
  const start=page*PER+1, end=page*PER+list.length;
  const btn=(p,label,dis,on)=>`<button ${dis?'disabled':''} ${dis?'':`onclick="agHistGo('${a.id}',${p})"`} style="border:1px solid var(--fd-line);background:${on?'var(--fd-ink)':'#fff'};color:${on?'#fff':(dis?'#c7c5bb':'var(--fd-ink)')};border-radius:7px;min-width:28px;padding:4px 9px;font-size:11px;font-weight:${on?700:500};cursor:${dis?'default':'pointer'};font-family:inherit">${label}</button>`;
  let nav=`<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:11px 2px 2px"><span style="font-size:11.5px;color:var(--fd-ink-soft);margin-right:6px">${all.length} bookings${pages>1?` · แสดง ${start}–${end}`:''}</span>`;
  if(pages>1){ nav+=btn(page-1,'‹',page===0,false); for(let i=0;i<pages;i++) nav+=btn(i,String(i+1),false,i===page); nav+=btn(page+1,'›',page===pages-1,false); }
  nav+=`</div>`;
  html+=nav;
  return html;
}
/* ── ตัวแท็บ ────────────────────────────────────────────────────────────── */
function agTabRate(a){
  if(!a) return '';
  if(_rtmAgent!==a.id || _rtmDraft===null) rtmInit(a.id);
  var e=_rtmE, T=(typeof TODAY_STR!=='undefined')?TODAY_STR:'';
  var rt=(typeof getRateType==='function')?getRateType(a.rateTypeId):null;
  var ro=(typeof laCanEditArea==='function') && !laCanEditArea('sales');
  var card='background:#fff;border:1px solid #E7EAEF;border-radius:12px;padding:14px 16px;margin:0 0 12px';
  var h='<div style="padding:18px 22px 26px">';

  /* ① เรทที่ใช้อยู่ */
  var X=(typeof rtExpForAgent==='function')?rtExpForAgent(a):null;
  h+='<div style="'+card+'">'
    +'<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;'
      +'color:#9AA3AE;margin-bottom:9px">1 · เรทที่ผูกไว้</div>';
  if(!rt){
    h+='<div style="font-size:12.5px;color:#A32D2D;font-weight:600">ยังไม่ได้ผูก Rate Type — '
      +'ราคายังไม่ถูก resolve จองให้เอเย่นต์นี้ต้องใส่ราคาเองทุกใบ</div>';
  }else{
    var tn=X?rtExpTone(X.days):null;
    h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<span style="width:10px;height:10px;border-radius:3px;background:'+(rt.color||'#5F5E5A')+';flex:none"></span>'
      +'<b style="font-size:14.5px;color:#1F2937">'+e(rt.name||rt.id)+'</b>'
      +'<span style="background:#F1F3F6;color:#5A6270;font-size:9.5px;font-weight:700;padding:2px 8px;'
        +'border-radius:6px;font-variant-numeric:tabular-nums">'+e(rt.code||'')+'</span>'
      +'<span style="font-size:11.5px;color:#8A929E;font-variant-numeric:tabular-nums">'
        +e(_rtmD(rt.validFrom))+' → '+e(_rtmD(rt.validTo))+'</span>'
      +(tn?('<span style="background:'+tn.bg+';border:1px solid '+tn.bd+';color:'+tn.fg
        +';font-size:10px;font-weight:800;border-radius:999px;padding:2px 10px">'+e(tn.t)+'</span>'):'')
      +'<button onclick="agEditOpen(\'ratetype\',\''+e(a.id)+'\')"'+(ro?' disabled':'')
        +' style="margin-left:auto;border:1px solid #D6DCE5;background:#fff;color:#33506F;border-radius:7px;'
        +'padding:5px 13px;font:600 11px inherit;cursor:pointer;font-family:inherit">เปลี่ยน Rate Type</button>'
    +'</div>';
    if(X && X.blocked.length){
      h+='<div style="margin-top:8px;background:#FCEBEB;border:1px solid #E8C4C0;border-radius:8px;'
        +'padding:7px 11px;font-size:11.5px;color:#A32D2D;line-height:1.6">'
        +'<b>จองไม่ได้ '+X.blocked.length+' โปรแกรม</b> — '
        + X.blocked.slice(0,5).map(function(p){ return e(rtExpRouteName(p)); }).join(' · ')
        + (X.blocked.length>5?(' · และอีก '+(X.blocked.length-5)):'')
        +'<div style="color:#8A5A00;font-weight:500;margin-top:2px">เรทชุดนี้ไม่มีราคาของโปรแกรมพวกนี้ '
        +'· ปุ่มบันทึกใบจองจะถูกล็อก · ตั้งตารางฤดูกาลให้ไปใช้ชุดที่มีราคา แล้วจะจองได้</div></div>';
    }
  }
  h+='</div>';

  /* ② ตารางฤดูกาล · ตัวแก้อยู่ในหน้า */
  var D=_rtmDraft||[], probe={rateSeasons:D}, iss=laSeasonIssues(probe);
  var dirty=!_rtmSame(a);
  var opts=((typeof SB_RATE_TYPES!=='undefined')?SB_RATE_TYPES:[]).filter(function(r){ return r && r.active!==false; });
  var inp='border:1px solid #D6DCE5;border-radius:7px;padding:6px 9px;font:inherit;font-size:12px;'
    +'font-family:inherit;box-sizing:border-box;background:#fff';
  var sug=rtmSuggest(a);
  h+='<div style="'+card+'">'
    +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">'
      +'<span style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA3AE">'
      +'2 · ตารางฤดูกาล</span>'
      +(D.length?('<span style="background:#EDF2F8;border:1px solid #D6DEE8;color:#33506F;font-size:10px;'
        +'font-weight:800;border-radius:999px;padding:2px 9px">'+D.length+' ช่วง</span>'):'')
      +(dirty?('<span style="background:#FEF6E7;border:1px solid #EFD9AE;color:#8A5A00;font-size:10px;'
        +'font-weight:800;border-radius:999px;padding:2px 9px">ยังไม่ได้บันทึก</span>'):'')
    +'</div>'
    +'<div style="font-size:11.5px;color:#6B7280;line-height:1.65;margin-bottom:11px">'
      +'ราคาสลับตาม<b>วันเดินทาง</b>ของแต่ละทริป · ใบจองใบเดียวที่ข้ามฤดูจะได้คนละราคาต่อทริป<br>'
      +'ช่วงสุดท้าย<b>เว้นวันจบไว้ว่าง</b> จะได้ไม่มีวันไหนไม่มีราคา'
    +'</div>';
  if(!D.length){
    h+='<div style="background:#F7F8FA;border:1px dashed #D6DCE5;border-radius:9px;padding:14px;'
      +'text-align:center;font-size:12px;color:#8A929E">ยังไม่ได้ตั้ง · เอเย่นต์นี้ใช้ชุดราคาเดียวตลอดทั้งปี</div>';
  }
  D.forEach(function(x,i){
    var live=x.from && T>=x.from && (!x.to||T<=x.to);
    h+='<div style="border:1px solid '+(live?'#BEE0D2':'#E7EAEF')+';background:'+(live?'#F6FBF9':'#FCFCFD')+';'
      +'border-radius:9px;padding:9px 11px;margin-bottom:8px">'
      +'<div style="display:flex;gap:8px;align-items:center;margin-bottom:7px">'
        +'<span style="flex:none;width:18px;font-size:11px;font-weight:700;color:#9AA3AE">'+(i+1)+'</span>'
        +'<select onchange="rtmSet('+i+',\'rt\',this.value)"'+(ro?' disabled':'')+' style="'+inp+';flex:1;min-width:0">'
          +'<option value="">— เลือกชุดราคา —</option>'
          + opts.map(function(r){ return '<option value="'+e(r.id)+'"'+(r.id===x.rt?' selected':'')+'>'
              +e(r.name||r.id)+'</option>'; }).join('')
        +'</select>'
        +(live?'<span style="flex:none;font-size:9.5px;font-weight:800;color:#0F6E56;background:#E3F3EC;'
          +'border-radius:999px;padding:3px 9px;white-space:nowrap">ใช้อยู่วันนี้</span>':'')
        +'<button onclick="rtmDel('+i+')"'+(ro?' disabled':'')+' title="เอาช่วงนี้ออก" '
          +'style="flex:none;border:1px solid #EAD6D6;background:#fff;color:#A32D2D;border-radius:7px;'
          +'padding:5px 10px;font:700 12px inherit;cursor:pointer;font-family:inherit">&#10005;</button>'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center;padding-left:26px;flex-wrap:wrap">'
        +'<label style="font-size:10.5px;color:#8A929E;flex:none">ตั้งแต่</label>'
        +'<input type="date" value="'+e(x.from)+'"'+(ro?' disabled':'')
          +' onchange="rtmSet('+i+',\'from\',this.value)" style="'+inp+';width:150px">'
        +'<label style="font-size:10.5px;color:#8A929E;flex:none">ถึง</label>'
        +'<input type="date" value="'+e(x.to)+'"'+(ro?' disabled':'')
          +' onchange="rtmSet('+i+',\'to\',this.value)" style="'+inp+';width:150px">'
        +'<span style="font-size:10.5px;color:'+(x.to?'#9AA3AE':'#0F6E56')+';font-weight:'+(x.to?'500':'700')+'">'
          +(x.to?'':'← เว้นว่าง = ใช้ยาวไม่มีวันจบ')+'</span>'
      +'</div>'
    +'</div>';
  });
  if(!ro){
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
      +'<button onclick="rtmAdd()" style="border:1px dashed #C9D2DE;background:#fff;color:#33506F;'
        +'border-radius:8px;padding:7px 15px;font:700 11.5px inherit;cursor:pointer;font-family:inherit">+ เพิ่มช่วง</button>'
      +(D.length>1?('<button onclick="rtmSnap()" title="ปิดวันจบของแต่ละช่วงให้ชนวันเริ่มของช่วงถัดไปพอดี" '
        +'style="border:1px solid #C9D2DE;background:#fff;color:#33506F;border-radius:8px;padding:7px 15px;'
        +'font:600 11.5px inherit;cursor:pointer;font-family:inherit">จัดวันให้ต่อกันพอดี</button>'):'')
      +(sug?('<button onclick="rtmFillFromContract()" title="สร้างตารางจากเรทตัวถัดไปที่สัญญาระบุไว้" '
        +'style="border:1px solid #BEE0D2;background:#F1F8F5;color:#0F6E56;border-radius:8px;padding:7px 15px;'
        +'font:700 11.5px inherit;cursor:pointer;font-family:inherit">'
        +'เติมจากสัญญา · '+e(sug.next.name||sug.next.id)+' ตั้งแต่ '+e(_rtmD(sug.split))+'</button>'):'')
      +'<span style="margin-left:auto;display:flex;gap:8px">'
        +(dirty?('<button onclick="rtmReset()" style="border:1px solid #D6DCE5;background:#fff;color:#5A6270;'
          +'border-radius:8px;padding:7px 15px;font:600 11.5px inherit;cursor:pointer;font-family:inherit">'
          +'ยกเลิกการแก้</button>'):'')
        +'<button onclick="rtmSave()"'+(dirty?'':' disabled')+' style="border:0;background:'+(dirty?'#0F172A':'#E7EAEF')
          +';color:'+(dirty?'#fff':'#9AA3AE')+';border-radius:8px;padding:7px 19px;font:700 11.5px inherit;'
          +'cursor:'+(dirty?'pointer':'default')+';font-family:inherit">บันทึก</button>'
      +'</span></div>';
  }
  if(iss.length){
    h+='<div style="margin-top:10px;background:#FEF6E7;border:1px solid #EFD9AE;border-radius:9px;'
      +'padding:8px 12px;font-size:11.5px;color:#8A5A00;line-height:1.65">'
      + iss.map(function(t){ return '&#9888; '+e(t); }).join('<br>')
      +'<div style="color:#A08558;margin-top:3px">บันทึกได้อยู่ · ข้อทักพวกนี้ไม่ปิดกั้น แต่ควรแก้ก่อนใช้จริง</div></div>';
  }
  h+='</div>';

  /* ③ ผลลัพธ์ · วันไหนใช้ชุดไหน · อ่านจากร่างที่กำลังแก้อยู่ จะได้เห็นผลก่อนกดบันทึก */
  h+='<div style="'+card+';margin-bottom:0">'
    +'<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;'
      +'color:#9AA3AE;margin-bottom:3px">3 · สรุป · วันไหนใช้ชุดไหน</div>'
    +'<div style="font-size:11px;color:#8A929E;margin-bottom:9px">'
      +(dirty?'ดูจากที่กำลังแก้อยู่ (ยังไม่บันทึก)':'ดูจากที่บันทึกไว้')+'</div>';
  var probeA={ id:a.id, rateTypeId:a.rateTypeId, rateSeasons:D };
  var dates=[{d:T, lbl:'วันนี้'}];
  D.forEach(function(x){ if(x.from && x.from>T) dates.push({d:x.from, lbl:'เริ่มช่วงที่ '+(D.indexOf(x)+1)}); });
  if(dates.length===1 && rt && rt.validTo && laDayAfter(rt.validTo)>T)
    dates.push({d:laDayAfter(rt.validTo), lbl:'วันถัดจากเรทหมด'});
  dates.forEach(function(p){
    var hit=laSeasonAt(probeA, p.d);
    var id=(hit&&hit.rt)||a.rateTypeId||'';
    var nm=id?rtSeasonName(id):'—';
    h+='<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid #F1F3F6;font-size:12px">'
      +'<span style="flex:none;width:150px;color:#6B7280;font-variant-numeric:tabular-nums">'
        +e(_rtmD(p.d))+' <span style="color:#B6BDC6;font-size:10.5px">'+e(p.lbl)+'</span></span>'
      +'<b style="color:#2C3440">'+e(nm)+'</b>'
      +(hit?'':'<span style="font-size:10.5px;color:#8A929E">(ไม่มีช่วงไหนคลุม → ใช้เรทที่ผูกไว้)</span>')
    +'</div>';
  });
  h+='<div style="margin-top:10px;background:#F1F8F5;border:1px solid #BEE0D2;border-radius:9px;'
    +'padding:8px 12px;font-size:11.5px;color:#0F6E56;line-height:1.65">'
    +'<b>ตั้งตาราง ≠ เปลี่ยนเรท</b> — ตารางไม่แตะราคาก่อนวันแบ่งเลยสักบาท '
    +'เปลี่ยนเฉพาะทริปที่<b>เดินทาง</b>ตั้งแต่วันแบ่งไป · ใบที่ขายไปแล้วล็อกราคาเดิมไว้ ไม่คิดใหม่ย้อนหลัง</div>'
    +'</div>';
  return h+'</div>';
}

function agSwitchTab(tab, aId){
  const a = sbGetAgent(aId); if(!a) return;
  document.querySelectorAll('#ag-main .sb-tab').forEach(t=>t.classList.remove('on'));
  document.querySelector(`#ag-main .sb-tab[data-tab="${tab}"]`).classList.add('on');
  const body = document.getElementById('ag-tabbody');
  if(tab==='info')      body.innerHTML = agTabInfo(a);
  if(tab==='prices')    body.innerHTML = agTabPrices(a);
  if(tab==='hist')    { _agHistPage=0; body.innerHTML = agTabHist(a); }
  if(tab==='contracts') body.innerHTML = agTabContracts(a);
  if(tab==='activity')  body.innerHTML = agTabActivity(a);
  if(tab==='ratemgmt'){ rtmInit(aId); body.innerHTML = agTabRate(a); }   /* §rtTab */
}

// ── Agent Activity timeline (audit trail) ──
function agTabActivity(a){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const items=(Array.isArray(a.activity)?a.activity:[]).slice().reverse();   // newest first
  const KCOL={created:'#0F6E56',rate:'#6c5ce7',credit:'#854F0B',profile:'#854F0B',programs:'#185FA5',company:'#185FA5',sales:'#A32D2D',contract:'#B5179E',note:'#5F5E5A',edit:'#5F5E5A'};
  const KLBL={created:'Created',rate:'Rate type',credit:'Credit/Pay',profile:'Profile',programs:'Programs',company:'Company',sales:'Sales',contract:'Contract',note:'Note',edit:'Edit'};
  const fmt=iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return iso||''; } };
  if(!items.length) return `<div style="padding:30px 22px"><div style="background:#fafaf8;border:1px dashed var(--fd-line);border-radius:12px;padding:34px;text-align:center;color:var(--fd-ink-soft);font-size:13px">ยังไม่มีประวัติการเปลี่ยนแปลงของ agent นี้<div style="font-size:11px;margin-top:6px;color:var(--fd-ink-faint)">การแก้เรท · เครดิต · โปรแกรม · ข้อมูลบริษัท · การออกสัญญา จะถูกบันทึกที่นี่อัตโนมัติ</div></div></div>`;
  const rows=items.map(it=>{ const c=KCOL[it.kind]||'#5F5E5A'; const l=KLBL[it.kind]||it.kind;
    return `<div style="display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--fd-line-soft)">
      <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${c};margin-top:5px"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="background:${c}1a;color:${c};font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:6px;letter-spacing:.03em;text-transform:uppercase">${l}</span>
          <span style="font-size:12.5px;color:var(--fd-ink)">${esc(it.text)}</span>
        </div>
        <div style="font-size:10.5px;color:var(--fd-ink-faint);margin-top:3px;font-variant-numeric:tabular-nums">${fmt(it.at)}${it.by?(' · '+esc(it.by)):''}</div>
      </div>
    </div>`; }).join('');
  return `<div style="padding:18px 22px">
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
      <h3 style="font-size:13px;font-weight:700;color:var(--fd-ink);margin:0">Activity log</h3>
      <span style="font-size:11px;color:var(--fd-ink-soft)">${items.length} รายการ · ใหม่สุดอยู่บน</span>
    </div>
    ${rows}
  </div>`;
}
function _agLinkedCounts(id){
  const bk = (typeof SB_BOOKINGS!=='undefined'&&Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS.filter(b=>b.agentId===id).length : 0;
  const ct = (typeof _CT_ARTIFACTS!=='undefined'&&_CT_ARTIFACTS&&_CT_ARTIFACTS[id]) ? _CT_ARTIFACTS[id].length : 0;
  const lk = (typeof SB_SEAT_LOCKS!=='undefined'&&Array.isArray(SB_SEAT_LOCKS)) ? SB_SEAT_LOCKS.filter(l=>l.holderType==='agent'&&l.holderId===id).length : 0;
  return {bk, ct, lk};
}
function agClearOpen(){
  if(typeof ctArtifactsLoad==='function'){ try{ ctArtifactsLoad(); }catch(e){} }
  _agClearSel = new Set(); _agClearConfirm = '';
  let ov = document.getElementById('ag-clear-modal');
  if(!ov){ ov = document.createElement('div'); ov.id='ag-clear-modal'; document.body.appendChild(ov); }
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,20,25,.5);display:flex;align-items:center;justify-content:center;padding:24px';
  ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:620px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.35)">
    <div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:15px;font-weight:700;color:#A32D2D">ล้างรายชื่อ Agent</div>
      <div style="font-size:11px;color:var(--fd-ink-soft);margin-top:2px">เลือก agent ที่จะลบ · ข้อมูลที่ผูกกัน (booking · contract · seat lock) จะถูกลบไปด้วย</div></div>
      <button onclick="agClearClose()" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer;padding:4px 8px;line-height:1">✕</button>
    </div>
    <div id="ag-clear-body" style="padding:14px 20px;overflow:auto;flex:1"></div>
    <div id="ag-clear-foot" style="padding:14px 20px;border-top:1px solid var(--fd-line);background:#fafaf8"></div>
  </div>`;
  ov.onclick=(e)=>{ if(e.target===ov) agClearClose(); };
  agClearRenderBody();
}
function agClearClose(){ const ov=document.getElementById('ag-clear-modal'); if(ov) ov.remove(); }
function agClearRenderBody(){
  const host=document.getElementById('ag-clear-body'); if(!host) return;
  const all=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]);
  const allSel = all.length>0 && all.every(a=>_agClearSel.has(a.id));
  const rows = all.length ? all.map(a=>{
    const c=_agLinkedCounts(a.id); const on=_agClearSel.has(a.id);
    const mkt=(typeof sbGetMarket==='function'&&sbGetMarket(a.market))?sbGetMarket(a.market).name:(a.market||'');
    const linked=[c.bk?`${c.bk} booking`:'', c.ct?`${c.ct} contract`:'', c.lk?`${c.lk} lock`:''].filter(Boolean).join(' · ')||'ไม่มีข้อมูลผูก';
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid ${on?'#E3B7B1':'var(--fd-line-soft)'};border-radius:9px;margin-bottom:6px;cursor:pointer;background:${on?'#FCEFED':'#fff'}">
      <input type="checkbox" ${on?'checked':''} onchange="agClearToggle('${a.id}',this.checked)" style="width:16px;height:16px;margin:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--fd-ink)"><span style="font-variant-numeric:tabular-nums;color:var(--fd-ink-soft);font-size:10.5px;margin-right:6px">${a.code||''}</span>${a.name||a.id}</div>
        <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:1px">${mkt} · <span style="color:#A3623A">${linked}</span></div>
      </div>
    </label>`;
  }).join('') : '<div style="font-size:12px;color:var(--fd-ink-soft);font-style:italic;padding:20px;text-align:center">ไม่มี agent ในระบบ</div>';
  host.innerHTML = `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--fd-line);margin-bottom:10px;cursor:pointer">
      <input type="checkbox" ${allSel?'checked':''} onchange="agClearToggleAll(this.checked)" style="width:16px;height:16px;margin:0">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fd-ink-soft)">เลือกทั้งหมด (${all.length})</span>
    </label>
    ${rows}`;
  agClearRenderFoot();
}
function agClearRenderFoot(){
  const foot=document.getElementById('ag-clear-foot'); if(!foot) return;
  let bk=0,ct=0,lk=0; _agClearSel.forEach(id=>{ const c=_agLinkedCounts(id); bk+=c.bk; ct+=c.ct; lk+=c.lk; });
  const n=_agClearSel.size; const _cw=_agClearConfirm.trim(); const ready = n>0 && (_cw==='ลบ' || _cw.toUpperCase()==='DELETE');
  foot.innerHTML = `
    <div style="font-size:11.5px;color:var(--fd-ink);margin-bottom:10px;line-height:1.5">จะลบ: <strong style="color:#A32D2D">${n} agent</strong> · ${bk} booking · ${ct} contract · ${lk} seat lock <span style="color:var(--fd-ink-soft)">(ลบถาวร · กู้คืนไม่ได้ — สำรองด้วยปุ่ม 💾 ก่อนถ้าต้องการ)</span></div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <input id="ag-clear-confirm" type="text" value="${_agClearConfirm.replace(/"/g,'&quot;')}" oninput="agClearConfirmInput(this.value)" placeholder='พิมพ์ ลบ เพื่อยืนยัน' style="flex:1;min-width:180px;height:34px;font-size:12px;font-family:inherit;letter-spacing:.06em;border:1px solid ${ready?'#A32D2D':'var(--fd-line)'};border-radius:8px;padding:2px 10px;background:#fff;outline:none">
      <button onclick="agClearClose()" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer">ยกเลิก</button>
      <button id="ag-clear-go" ${ready?'':'disabled'} onclick="agClearExecute()" style="background:${ready?'#A32D2D':'#E0C7C3'};color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:700;padding:8px 16px;border-radius:8px;cursor:${ready?'pointer':'not-allowed'}">ลบถาวร (${n})</button>
    </div>`;
}
function agClearToggle(id, on){ if(on) _agClearSel.add(id); else _agClearSel.delete(id); agClearRenderFoot(); }
function agClearToggleAll(on){ const all=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]); _agClearSel = on ? new Set(all.map(a=>a.id)) : new Set(); agClearRenderBody(); }
function agClearConfirmInput(v){ _agClearConfirm=v; agClearRenderFoot(); const el=document.getElementById('ag-clear-confirm'); if(el){ el.focus(); try{ el.setSelectionRange(v.length,v.length); }catch(e){} } }
function agClearExecute(){
  const ids=[..._agClearSel];
  const _cw=_agClearConfirm.trim(); if(!ids.length || !(_cw==='ลบ' || _cw.toUpperCase()==='DELETE')) return;
  const idset=new Set(ids);
  // 1) agents
  SB_AGENTS = SB_AGENTS.filter(a=>!idset.has(a.id));
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  // 2) bookings (read-modify-write · same pattern as commit)
  if(typeof SB_BOOKINGS!=='undefined' && Array.isArray(SB_BOOKINGS)){
    SB_BOOKINGS = SB_BOOKINGS.filter(b=>!idset.has(b.agentId));
    try{ const o=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); o.sb_bookings=SB_BOOKINGS; localStorage.setItem(LS_KEY, JSON.stringify(o)); }catch(e){ console.warn('persist sb_bookings failed', e); }
  }
  // 3) contracts (agent_artifacts keyed by agentId)
  if(typeof ctArtifactsLoad==='function'){ try{ ctArtifactsLoad(); }catch(e){} }
  if(typeof _CT_ARTIFACTS!=='undefined' && _CT_ARTIFACTS){ ids.forEach(id=>{ delete _CT_ARTIFACTS[id]; }); if(typeof ctArtifactsPersist==='function') ctArtifactsPersist(); }
  // 4) seat locks held by these agents
  if(typeof SB_SEAT_LOCKS!=='undefined' && Array.isArray(SB_SEAT_LOCKS)){
    SB_SEAT_LOCKS = SB_SEAT_LOCKS.filter(l=>!(l.holderType==='agent' && idset.has(l.holderId)));
    if(typeof sbSeatLocksPersist==='function') sbSeatLocksPersist();
  }
  const n=ids.length;
  agClearClose();
  if(typeof renderAgents==='function') renderAgents();
  const main=document.getElementById('ag-main'); if(main) main.innerHTML='<div class="sb-empty">เลือก Agent จากเมนูด้านซ้ายเพื่อดูรายละเอียดและราคา</div>';
  try{ alert('Cleared '+n+' agent(s) and linked data.'); }catch(e){}
}

function agNew(){
  _agEditAgentId = null;
  _agEditSection = 'new';
  const firstSub = (SB_MARKETS.find(m=>m.id==='ru')?.subs||[])[0] || '';
  /* §ผู้ลงนาม · ฟอร์มสร้างเอเยนต์ไม่เคยถามใครเป็นคนเซ็นสัญญา แล้ว _seedAgentContractDefaults()
     ก็เดาให้เป็น a.contact || '—' → เอเยนต์ที่ไม่ได้กรอก Contact Person จะได้ผู้ลงนามชื่อ "—"
     ซึ่งพิมพ์ลงหน้าเซ็นของสัญญาตรงๆ · ถามตั้งแต่ตอนสร้างเลย ดีกว่าไปตามแก้ทีหลัง */
  _agNewDraft = { code:'', name:'', market:'ru', sub:firstSub, sales:'', payType:'invoice', vatMode:'none', creditDays:30, creditLimit:0, contact:'', email:'', phone:'', note:'',
                  legalName:'', taxId:'', tatLicense:'', address:'', website:'',
                  sigName:'', sigDesignation:'Authorized Signatory', sigTel:'', rateTypeId:'' };
  _agNewReqShow = false;   // เริ่มฟอร์มใหม่ · ยังไม่โชว์กรอบแดง
  document.getElementById('ag-edit-modal').style.display = 'flex';
  agNewRender();
}
function agNewSetField(k, v, rerender){ if(!_agNewDraft) return; _agNewDraft[k] = v; if(rerender) agNewRender(); }
function agNewNeed(el, key){
  const w=el&&el.closest?el.closest('.ag-fld'):null; if(!w) return;
  if(_AG_NEEDK.indexOf(key)>=0 && !String(el.value||'').trim()) w.classList.add('ag-need'); else w.classList.remove('ag-need');
}
// §เลือก Sales → Rate Type ต้อง match เซลล์นั้น · ล้างเรทเดิมถ้าไม่ใช่ของเซลล์ใหม่ (และไม่ใช่ส่วนกลาง) แล้ว re-render
function agNewSetSales(v){
  if(!_agNewDraft) return;
  _agNewDraft.sales = v || '';
  const rid=_agNewDraft.rateTypeId;
  if(rid){ const rt=(typeof getRateType==='function')?getRateType(rid):null; const own=(rt&&rt.owner)?rt.owner:''; if(own && own!==(v||'')) _agNewDraft.rateTypeId=''; }
  agNewRender();
}

// §OCR fill · read a business card / letterhead / contract image and rough-fill the
// create-agent draft. Reuses the Doc-Check Tesseract worker (English). Fills only the
// draft fields that are still empty (never clobbers what the user already typed); any
// extra it finds (website / tax id / address) is appended to Note so nothing is lost.
function _agOcrStatus(html, color){ const el=document.getElementById('ag-ocr-status'); if(!el) return;
  el.style.display=html?'block':'none'; el.style.color=color||'#185FA5'; el.innerHTML=html||''; }
function agNewOcrPick(){
  if(typeof window.Tesseract==='undefined' && typeof _docOcrGetWorker!=='function'){ alert('ตัวอ่าน OCR ยังไม่พร้อม'); return; }
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(f) agNewOcrRun(f); };
  inp.click();
}
function agNewOcrRun(file){
  if(!_agNewDraft) return;
  _agOcrStatus('<span style="display:inline-block;width:12px;height:12px;border:2px solid #BFDCF2;border-top-color:#185FA5;border-radius:50%;animation:docspin .8s linear infinite;vertical-align:-2px;margin-right:6px"></span>กำลังโหลดตัวอ่าน…');
  const url=URL.createObjectURL(file);
  _docOcrGetWorker().then(function(worker){
    _agOcrStatus('<span style="display:inline-block;width:12px;height:12px;border:2px solid #BFDCF2;border-top-color:#185FA5;border-radius:50%;animation:docspin .8s linear infinite;vertical-align:-2px;margin-right:6px"></span>กำลังอ่านรูป…');
    return worker.recognize(url);
  }).then(function(r){
    URL.revokeObjectURL(url);
    const text=(r&&r.data&&r.data.text)||'';
    if(!text.trim()){ _agOcrStatus('อ่านข้อความจากรูปไม่ได้ · ลองรูปที่ชัด/ตรงกว่านี้', '#B5271F'); return; }
    agNewOcrApply(text);
  }).catch(function(e){ URL.revokeObjectURL(url); _agOcrStatus('OCR ไม่สำเร็จ: '+((e&&e.message)||e)+' (เช็คอินเทอร์เน็ต)', '#B5271F'); });
}
// Pull rough fields out of raw OCR text.
function _agOcrParse(text){
  const lines=String(text||'').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const flat=lines.join('  ');
  const out={};
  const em=flat.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if(em) out.email=em[0].toLowerCase();
  const web=flat.match(/(?:https?:\/\/)?(?:www\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}[\w\/#?.=-]*/) ||
            flat.match(/\b[A-Za-z0-9-]+\.(?:com|net|org|co\.th|travel|asia)\b(?![@\w])/);
  if(web && (!out.email || web[0].toLowerCase()!==out.email)) out.website=web[0].replace(/^https?:\/\//,'');
  // phone: keep only phone-shaped runs · REJECT dates ("2025 10 15") and bare ids by
  // requiring a real phone signal — a '+' , a leading 0, or a leading 66 country code.
  const phones=[]; (flat.match(/\+?\d[\d\s().-]{6,}\d/g)||[]).forEach(function(p){
    const digits=p.replace(/\D/g,''); if(digits.length<8||digits.length>15) return;
    if(/^\d{13}$/.test(digits)) return;                                   // tax id, not phone
    const hasPlus=/\+/.test(p);
    const dateish=/^(19|20)\d{2}[\s.\/-]?\d{1,2}[\s.\/-]?\d{1,2}$/.test(p.trim()) || (!hasPlus && p.charAt(0)!=='0' && /^(19|20)\d{2}/.test(digits) && digits.length<=8);
    if(dateish) return;
    const phoneLike = hasPlus || /^0/.test(digits) || /^66/.test(digits);  // reject bare 8-digit dates/ids
    if(!phoneLike) return;
    const c=p.trim(); if(phones.indexOf(c)<0) phones.push(c);
  });
  if(phones.length) out.phone=phones[0];
  // Thai tax id = 13 digits (may be spaced/dashed) · scan ALL numeric runs, keep the one
  // that strips to exactly 13 digits (avoids grabbing a phone number, which matches first)
  const taxHit=(flat.match(/\d[\d\s-]{11,}\d/g)||[]).map(t=>t.replace(/\D/g,'')).find(dd=>dd.length===13);
  if(taxHit) out.taxId=taxHit;
  // label/header lines to NEVER treat as a name (contracts have "TRAVEL PERIOD :", "DATE:", …)
  const labelRe=/(travel period|contract|agreement|validity|reference|attention|subject|quotation|invoice|booking|voucher|^date\b|^period\b|^ref\b|^no\.?\b|^to\b|^from\b|^between\b|:\s*$)/i;
  const clean=s=>s.replace(/^["'“”\s]+|["'“”\s:]+$/g,'')
    .replace(/^(and|between|agent|company|client|operator|party|name|address|to|from)\b\s*[:\-]\s*/i,'')   // drop contract label prefixes ("And:", "Address:")
    .replace(/[|_]+/g,' ').replace(/\s+/g,' ').trim();
  const compRe=/(co\.?,?\s*ltd|company|limited|travel|tours?|dmc|agency|holidays?|enterprise|international|\bgroup\b)/i;
  // display name — a company-looking line that is NOT a header label
  let name=lines.find(l=>compRe.test(l) && !labelRe.test(l) && l.length<=60);
  if(!name) name=lines.find(l=>l.length>=3 && l.length<=48 && !/[:@]|www\.|\d{4}/.test(l) && !labelRe.test(l));
  if(name) out.name=clean(name);
  // legal name — prefer a line explicitly carrying a legal suffix
  const legal=lines.find(l=>/(co\.?,?\s*ltd|company limited|\blimited\b|ltd\.?$|บริษัท|จำกัด)/i.test(l) && !labelRe.test(l) && l.length<=70);
  if(legal) out.legalName=clean(legal);
  // address — a line with a real place/street word (NOT a bare 5-digit run, which also
  // appears inside a tax id) · exclude tax/phone/email lines
  const addr=lines.find(l=>/(road|\brd\.?\b|soi|\bmoo\b|floor|building|จ\.|จังหวัด|ถนน|ซอย|phuket|bangkok|krabi|khao ?lak|patong|chalong|kathu)/i.test(l)
    && !/tax\s*id|เลขประจำ|เลขผู้เสีย|@|www\.|\btel\b|\bphone\b|โทร/i.test(l)
    && l.length>=10 && l.length<=110 && !labelRe.test(l));
  if(addr) out.address=clean(addr);
  // person / contact — a line with a title (not the company/legal line)
  const person=lines.find(l=>/\b(mr|mrs|ms|khun|director|manager|sales|owner|ceo|managing)\b/i.test(l) && l.length<=50 && l!==name && l!==legal);
  if(person) out.contact=clean(person);
  return out;
}
function agNewOcrApply(text){
  const d=_agNewDraft; if(!d) return;
  const f=_agOcrParse(text);
  const filled=[];
  const put=(key,val,label)=>{ if(!val) return; if(!(String(d[key]||'')).trim()){ d[key]=val; filled.push(label); } };
  put('name', f.name, 'Name');
  put('legalName', f.legalName||f.name, 'Company');
  put('email', f.email, 'Email');
  put('phone', f.phone, 'Phone');
  put('contact', f.contact, 'Contact');
  put('website', f.website, 'Website');
  put('taxId', f.taxId, 'Tax ID');
  put('address', f.address, 'Address');
  agNewRender();
  const e=s=>String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  if(filled.length) _agOcrStatus('✓ เติมให้: <b>'+e(filled.join(', '))+'</b> · โปรดตรวจ/แก้ก่อนบันทึก', '#0F6E56');
  else _agOcrStatus('อ่านได้ แต่จับข้อมูลอัตโนมัติไม่ได้ · กรอกมือได้เลย', '#8a6d1f');
}
function agNewRender(){
  const body = document.getElementById('ag-edit-body');
  const ttl = document.getElementById('ag-edit-ttl');
  const d = _agNewDraft; if(!d) return;
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  ttl.textContent = 'เพิ่ม Agent ใหม่';
  const mkt = SB_MARKETS.find(m=>m.id===d.market) || SB_MARKETS[0];
  const isCredit = (d.payType==='invoice');
  const REQK=['name','legalName','address','market','rateTypeId','payType','vatMode'];   // §ช่องบังคับ · โชว์กรอบแดงทันทีถ้ายังว่าง
  const _rtSel = (d.sales||'') || (typeof laMySalesId==='function'?(laMySalesId()||''):'');   // §Rate Type กรองตาม Sales ที่เลือก (ไม่เลือก = ของคน login)
  // §Rate Type dropdown · แบ่งกลุ่ม: เรทของเซลล์นั้นขึ้นก่อน → ส่วนกลางไว้ล่าง (optgroup คั่นให้)
  const _rtSalesNm = (_rtSel && typeof sbGetSales==='function') ? ((sbGetSales(_rtSel)||{}).name||'') : '';
  const _rtO = r => (typeof _rtOwnerId==='function') ? _rtOwnerId(r) : (r.owner||'');
  const _rtOpt = (r,shared) => `<option value="${r.id}" ${d.rateTypeId===r.id?'selected':''}>${esc(r.name)}${r.code?(' · '+esc(r.code)):''}${shared?' · กลาง':''}</option>`;
  // §rtLoginScope · เลือกเซลล์คนอื่นในหน้านี้ได้ แต่เรทของคนอื่นต้องไม่โผล่ให้เซลล์ที่ถูก scope เห็น
  const _rtActive = ((typeof rtScopeList==='function')?rtScopeList((SB_RATE_TYPES||[]).filter(r=>r.active!==false)):(SB_RATE_TYPES||[]).filter(r=>r.active!==false)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const _rtOwnList = _rtSel ? _rtActive.filter(r=>_rtO(r)===_rtSel) : [];
  const _rtSharedList = _rtActive.filter(r=>!_rtO(r));
  const _rtOptions = `<option value="">${d.sales?'— เลือกเรท —':'— เลือก Sales ก่อน —'}</option>`
    + (_rtOwnList.length?`<optgroup label="&#9733; เรทของ ${esc(_rtSalesNm||'เซลล์นี้')}">${_rtOwnList.map(r=>_rtOpt(r,false)).join('')}</optgroup>`:'')
    + (_rtSharedList.length?`<optgroup label="ส่วนกลาง (Shared)">${_rtSharedList.map(r=>_rtOpt(r,true)).join('')}</optgroup>`:'');
  const nd=k=>(REQK.indexOf(k)>=0 && !String(d[k]||'').trim())?' ag-need':'';
  const R='<span class="req">*</span>';
  const ic=p=>`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1683C7" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${p}</svg>`;
  const IC={
    user: ic('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-3.6 3.5-5.8 7.5-5.8s7.5 2.2 7.5 5.8"/>'),
    building: ic('<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15"/>'),
    tag: ic('<path d="M4 4.5h7L20 13l-7 7-9-9z"/><circle cx="9" cy="9" r="1.3"/>'),
    cash: ic('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/>'),
    contact: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10.5" r="2"/><path d="M5.8 16c.7-2 5.7-2 6.4 0M14.5 9.5H18M14.5 13H18"/>'),
    sign: ic('<path d="M3 17.5c3 0 3-4 6-4s3 4 6 4"/><path d="M14.5 6.5l3 3L9 18l-3.5.5.5-3.5z"/>'),
    note: ic('<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/>')
  };
  const card=(icon,title,sub,inner)=>`<div style="background:#fff;border:1px solid #d8d4ca;border-radius:12px;overflow:hidden;flex:none"><div style="display:flex;align-items:center;gap:9px;padding:11px 15px;border-bottom:1px solid #ece9e1;background:#fbfaf7"><span style="display:inline-flex;align-items:center;flex:none" aria-hidden="true">${icon}</span><span style="font-size:13.5px;font-weight:700;color:#2a2a28">${title}</span>${sub?`<span style="font-size:11px;color:#9a968c;font-weight:400">${sub}</span>`:''}</div><div style="padding:13px 15px">${inner}</div></div>`;
  body.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:6px">
      <button type="button" onclick="agNewOcrPick()" title="อ่านจากรูป (นามบัตร / หัวจดหมาย / สัญญา) · เติมชื่อ/อีเมล/เบอร์ให้อัตโนมัติ" aria-label="อ่านจากรูป" style="width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;background:#E6F1FB;border:1px solid #CFE0F2;border-radius:9px;cursor:pointer"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1683C7" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
    </div>
    <div id="ag-ocr-status" style="font-size:11.5px;margin:-2px 0 10px;display:none"></div>
    ${card(IC.user,'Agent name','',`
      <div class="ag-fld${nd('name')}" style="margin:0"><label class="ag-fld-lbl">Agent Name ${R}</label><input type="text" value="${esc(d.name)}" oninput="agNewSetField('name',this.value);agNewNeed(this,'name');agNewDupCheck()" placeholder="เช่น All In Travel"><div class="ag-fld-hint">ชื่อที่ทีมเรียก/แสดงในระบบ · Code สร้างอัตโนมัติจากชื่อ</div></div>
      <div id="ag-dup-warn" style="display:none;margin-top:7px"></div>`)}
    ${card(IC.building,'Company · ข้อมูลบริษัท','สำหรับใบแจ้งหนี้ / สัญญา',`
      <div class="ag-fld-row">
        <div class="ag-fld${nd('legalName')}"><label class="ag-fld-lbl">ชื่อนิติบุคคล · Legal Name ${R}</label><input type="text" value="${esc(d.legalName)}" oninput="agNewSetField('legalName',this.value);agNewNeed(this,'legalName')" placeholder="เช่น All In Travel Co., Ltd."></div>
        <div class="ag-fld"><label class="ag-fld-lbl">เลขผู้เสียภาษี · Tax ID</label><input type="text" value="${esc(d.taxId)}" oninput="agNewSetField('taxId',this.value)" placeholder="13 หลัก"></div>
      </div>
      <div class="ag-fld-row">
        <div class="ag-fld"><label class="ag-fld-lbl">ใบอนุญาต ททท. · TAT License</label><input type="text" value="${esc(d.tatLicense)}" oninput="agNewSetField('tatLicense',this.value)" placeholder="เช่น 34/00000"></div>
        <div class="ag-fld"><label class="ag-fld-lbl">Website</label><input type="text" value="${esc(d.website)}" oninput="agNewSetField('website',this.value)" placeholder="www.example.com"></div>
      </div>
      <div class="ag-fld${nd('address')}" style="margin-bottom:0"><label class="ag-fld-lbl">ที่อยู่ · Address ${R}</label><textarea oninput="agNewSetField('address',this.value);agNewNeed(this,'address')" placeholder="ที่อยู่บริษัท (สำหรับออกใบกำกับ)">${esc(d.address)}</textarea></div>`)}
    ${card(IC.tag,'Classification','',`
      <div class="ag-fld-row">
        <div class="ag-fld"><label class="ag-fld-lbl">Market ${R}</label><select onchange="agNewSetField('market',this.value,true)">${SB_MARKETS.map(m=>`<option value="${m.id}" ${d.market===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
        <div class="ag-fld"><label class="ag-fld-lbl">Sub-market</label><select onchange="agNewSetField('sub',this.value)">${(mkt.subs||[]).map(s=>`<option value="${esc(s)}" ${d.sub===s?'selected':''}>${esc(s)}</option>`).join('')}<option value="" ${!d.sub?'selected':''}>— other —</option></select></div>
      </div>
      <div class="ag-fld-row" style="margin-bottom:0">
        <div class="ag-fld"><label class="ag-fld-lbl">Sales Person</label><select onchange="agNewSetSales(this.value)"><option value="">— เลือก —</option>${SB_SALES.map(s=>`<option value="${s.id}" ${d.sales===s.id?'selected':''}>${esc(s.name)} (${esc(s.code)})</option>`).join('')}</select></div>
        <div class="ag-fld${nd('rateTypeId')}"><label class="ag-fld-lbl">Rate Type · เรทราคา ${R}</label><select onchange="agNewSetField('rateTypeId',this.value);agNewNeed(this,'rateTypeId')">${_rtOptions}</select><div class="ag-fld-hint">${d.sales?('เรทของ '+esc((SB_SALES.find(s=>s.id===d.sales)||{}).name||'เซลล์นี้')+' + ส่วนกลาง'):'เรทของเซลล์ที่เลือก + ส่วนกลาง'}</div></div>
      </div>`)}
    ${card(IC.cash,'Payment','',`
      <div class="ag-fld-row">
        <div class="ag-fld"><label class="ag-fld-lbl">Payment Type ${R}</label><select onchange="agNewSetField('payType',this.value,true)">${SB_PAYMENT_TYPES.map(p=>`<option value="${p.id}" ${d.payType===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select><div class="ag-fld-hint">Invoice = ให้เครดิต · Pro Forma / Bank = จ่ายก่อน · Cash on Tour = เก็บสดวันเดินทาง</div></div>
        ${isCredit?`<div class="ag-fld"><label class="ag-fld-lbl">Credit Days</label><input type="number" min="0" value="${d.creditDays||0}" oninput="agNewSetField('creditDays',parseInt(this.value)||0)"><div class="ag-fld-hint">จำนวนวันเครดิต</div></div>`:'<div class="ag-fld"></div>'}
      </div>
      <div class="ag-fld-row" style="margin-bottom:0">
        ${isCredit?`<div class="ag-fld"><label class="ag-fld-lbl">Credit Limit (฿)</label><input type="number" min="0" value="${d.creditLimit||0}" oninput="agNewSetField('creditLimit',parseInt(this.value)||0)"><div class="ag-fld-hint">วงเงินสูงสุด · จองเกินจะเตือน</div></div>`:'<div class="ag-fld"></div>'}
        <div class="ag-fld"><label class="ag-fld-lbl">VAT · ภาษีมูลค่าเพิ่ม ${R}</label><select onchange="agNewSetField('vatMode',this.value)"><option value="none" ${(d.vatMode||'none')==='none'?'selected':''}>ไม่มี VAT</option><option value="exclude" ${d.vatMode==='exclude'?'selected':''}>Exclude VAT · Net + 7%</option><option value="include" ${d.vatMode==='include'?'selected':''}>Include VAT · รวม 7% แล้ว</option></select><div class="ag-fld-hint">Exclude = บวก 7% ตอนวางบิล · Include = รวมแล้ว · None = ไม่คิด</div></div>
      </div>`)}
    ${card(IC.contact,'Contact','',`
      <div class="ag-fld-row">
        <div class="ag-fld"><label class="ag-fld-lbl">Contact Person</label><input type="text" value="${esc(d.contact)}" oninput="agNewSetField('contact',this.value)" placeholder="ชื่อผู้ติดต่อ"></div>
        <div class="ag-fld"><label class="ag-fld-lbl">Phone</label><input type="text" value="${esc(d.phone)}" oninput="agNewSetField('phone',this.value)" placeholder="+66 ..."></div>
      </div>
      <div class="ag-fld" style="margin-bottom:0"><label class="ag-fld-lbl">Email</label><input type="text" value="${esc(d.email)}" oninput="agNewSetField('email',this.value)" placeholder="ops@example.com"></div>`)}
    ${card(IC.sign,'Agent Signatory · ผู้ลงนามในสัญญา','',`
      <div class="ag-fld-row">
        <div class="ag-fld"><label class="ag-fld-lbl">ชื่อผู้ลงนาม</label><input type="text" value="${esc(d.sigName)}" oninput="agNewSetField('sigName',this.value)" placeholder="${esc(d.contact)||'ชื่อคนที่จะเซ็นสัญญา'}"><div class="ag-fld-hint">พิมพ์ลงหน้าเซ็นสัญญาตรงๆ · เว้นว่าง = ใช้ชื่อผู้ติดต่อ</div></div>
        <div class="ag-fld"><label class="ag-fld-lbl">ตำแหน่ง</label><input type="text" value="${esc(d.sigDesignation)}" oninput="agNewSetField('sigDesignation',this.value)" placeholder="Authorized Signatory"></div>
      </div>
      <div class="ag-fld" style="margin-bottom:0"><label class="ag-fld-lbl">โทรผู้ลงนาม</label><input type="text" value="${esc(d.sigTel)}" oninput="agNewSetField('sigTel',this.value)" placeholder="เว้นว่าง = ใช้เบอร์ด้านบน"></div>`)}
    ${card(IC.note,'Note','',`<div class="ag-fld" style="margin:0"><textarea oninput="agNewSetField('note',this.value)" placeholder="หมายเหตุ">${esc(d.note)}</textarea></div>`)}
    <div class="ag-fld-hint" style="margin-top:2px">หลังสร้าง · ตั้งค่า Programs (โปรแกรมในสัญญา) · Contract เพิ่มได้จากหน้า Agent detail</div>
  `;
}
// §กันสร้างซ้ำ · หาเอเยนต์เดิมที่ชื่อ (normalize แบบเดียวกับ import) หรือ code ตรงกัน
function agFindDup(name, code, exceptId){
  const agents=(SB_AGENTS||[]);
  const cd=(code||'').trim().toLowerCase();
  if(cd){ const byCode=agents.find(a=>a.id!==exceptId && (a.code||'').trim().toLowerCase()===cd); if(byCode) return byCode; }
  const norm=s=>(typeof _agImpNorm==='function')?_agImpNorm(s):String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const n=norm(name); if(!n || n.length<2) return null;
  const nc=n.replace(/\s+/g,'');   // §compact · เทียบแบบตัดเว้นวรรคออก → "HANATOUR" = "Hana Tour" (เตือนซ้ำได้เหมือน import)
  return agents.find(a=>{ if(a.id===exceptId) return false; const an=norm(a.name); return an===n || (an.replace(/\s+/g,'')===nc); }) || null;
}
// live warning under the name row while typing
function agNewDupCheck(){
  const d=_agNewDraft, box=document.getElementById('ag-dup-warn'); if(!box) return;
  const dup = d ? agFindDup(d.name, d.code) : null;
  if(dup){
    const e=s=>String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    box.style.display='block';
    box.innerHTML='<div style="background:#FEF3F2;border:1px solid #F3B7B4;border-radius:9px;padding:8px 11px;font-size:11.5px;color:#B5271F"><b>⚠ อาจซ้ำ</b> — มีเอเยนต์ชื่อ/โค้ดใกล้เคียงอยู่แล้ว: <b>'+e(dup.name)+'</b>'+(dup.code?(' ('+e(dup.code)+')'):'')+' · ถ้าเป็นตัวเดียวกัน แก้ที่ตัวเดิมแทนการสร้างใหม่</div>';
  } else { box.style.display='none'; box.innerHTML=''; }
}
function agCreateSubmit(){
  const d = _agNewDraft; if(!d) return;
  const _req=[['name','Agent Name'],['legalName','ชื่อนิติบุคคล · Legal Name'],['address','ที่อยู่ · Address'],['market','Market'],['rateTypeId','Rate Type'],['payType','Payment Type'],['vatMode','VAT']];
  const _miss=_req.filter(([k])=>!String(d[k]||'').trim());
  if(_miss.length){ _agNewReqShow=true; if(typeof agNewRender==='function') agNewRender(); alert('กรุณากรอกช่องที่จำเป็น (*):\n\n· '+_miss.map(m=>m[1]).join('\n· ')); return; }
  const dup = agFindDup(d.name, d.code);   /* §กันสร้างซ้ำ · เตือน+ยืนยันก่อนสร้าง */
  if(dup && !confirm('มีเอเยนต์ที่ชื่อ/โค้ดใกล้เคียงกันอยู่แล้ว:\n\n  “'+dup.name+'”'+(dup.code?(' ('+dup.code+')'):'')+'\n\nยืนยันสร้างเป็นเอเยนต์ใหม่แยกอีกตัว?')) return;
  const id = LA_UID('a');   // multi-user unique (was first-free 'aNN' → collided across concurrent users)
  const code = (d.code||'').trim() || d.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,8) || id.toUpperCase();
  const isCredit = (d.payType==='invoice');
  const a = { id, code, name:d.name.trim(), market:d.market, sub:d.sub||'', sales:d.sales||null, payType:d.payType||'invoice', vatMode:d.vatMode||'none',
    creditDays:isCredit?(d.creditDays||0):0, creditLimit:isCredit?(d.creditLimit||0):0, creditBalance:0,
    contact:d.contact||'', email:d.email||'', phone:d.phone||'', note:d.note||'', programs:[] };
  if((d.rateTypeId||'').trim()) a.rateTypeId = d.rateTypeId;   // §เลือก Rate Type ตอนสร้างได้เลย (scope เฉพาะของตัว + ส่วนกลาง)
  /* §companyInfo · nested block (DB has a column per sub-field: companyinfo_legalname, …).
     Only add sub-fields the user actually filled · tel mirrors phone so the contract has a number. */
  const ci={}; ['legalName','taxId','tatLicense','address','website'].forEach(k=>{ const v=(d[k]||'').trim(); if(v) ci[k]=v; });
  if(Object.keys(ci).length){ if((d.phone||'').trim()) ci.tel=d.phone.trim(); a.companyInfo=ci; }
  /* §ผู้ลงนาม · ต้องเซ็ตก่อนเรียก _seedAgentContractDefaults() — ตัวนั้นมี if(!a.agentSignatory) แล้วเดาเป็น
     { name: a.contact || '—' } · ถ้าเซ็ตทีหลังจะไม่ทับ แต่ถ้าไม่เซ็ตเลย เอเยนต์ที่ไม่มี Contact Person
     จะได้ผู้ลงนามชื่อ "—" ซึ่งพิมพ์ลงหน้าเซ็นของสัญญาจริงๆ · เว้นว่าง = ยอมให้ seed เดาจาก contact ตามเดิม */
  const _sigName = (d.sigName||'').trim() || (d.contact||'').trim();
  if(_sigName || (d.sigTel||'').trim()){
    a.agentSignatory = {
      name: _sigName,
      designation: (d.sigDesignation||'').trim() || 'Authorized Signatory',
      tel: (d.sigTel||'').trim() || (d.phone||'').trim(),
      signedDate: ''
    };
  }
  if(typeof _seedAgentContractDefaults==='function'){ const prev=SB_AGENTS; SB_AGENTS=[a]; try{_seedAgentContractDefaults();}catch(e){} SB_AGENTS=prev; }
  /* §agProgFill · เอเยนต์ใหม่ที่เลือกเรทมาแล้ว ได้โปรแกรมครบตั้งแต่วินาทีแรก
     ต้องอยู่หลัง _seedAgentContractDefaults() เพราะตัวนั้นเป็นคนใส่ contractStart/End
     ซึ่งเป็นช่วง "จอง" ของแถวที่เติมให้ · ตัวใหม่ไม่มีอะไรให้ตัด จึงไม่มีคำถาม */
  if(a.rateTypeId && typeof agProgFill==='function'){
    const _pf = agProgFill(a, a.rateTypeId, {});
    if(_pf && _pf.add && _pf.add.length) a._progAutoN = _pf.add.length;
  }
  SB_AGENTS.unshift(a);
  if(typeof agLog==='function') agLog(a.id,'created','Agent created'+(a.rateTypeId?(' · rate type '+((getRateType(a.rateTypeId)||{}).name||a.rateTypeId)):'')
    +(a._progAutoN?(' · programs ตามเรทอัตโนมัติ '+a._progAutoN+' เส้นทาง'):''));
  delete a._progAutoN;
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  agEditClose();
  agRenderList();
  agRenderDetail(a.id);
}
function agEdit(id){ alert('Edit Agent — UI พร้อมเชื่อมในเฟสถัดไป'); }
function agDelete(id){
  if(!(typeof window.laIsAdmin==='function' && window.laIsAdmin())){ alert('Only an admin can delete an agent profile.'); return; }   /* §admin-only · ลบโปรไฟล์ Agent ได้เฉพาะ admin */
  const a = sbGetAgent(id); if(!a){ return; }
  if(!confirm('Delete agent "'+a.name+'"?\n\nThis removes it from the list.')) return;
  const i = SB_AGENTS.findIndex(x=>x.id===id);
  if(i>=0) SB_AGENTS.splice(i,1);
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  agRenderList();
  const host=document.getElementById('ag-main'); if(host) host.innerHTML='';
  const _first = ((typeof laScopeAgents==='function') ? laScopeAgents(SB_AGENTS) : SB_AGENTS)[0];   /* §user→sales · เด้งไปตัวแรกที่อยู่ในขอบเขต */
  if(_first){ _agSelected = _first.id; agRenderDetail(_first.id); }
}
function agExport(){ alert('Export CSV — UI พร้อมเชื่อมในเฟสถัดไป'); }

// ── Sales CRUD ──
function tmAddSales(){
  // Auto code from name first letters; user can override
  _tmModalType = 'sales';
  _tmModalEditId = null;
  _tmModalDraft = { id:'s'+String(Date.now()).slice(-6), code:'', name:'', color:TM_COLORS[Math.floor(Math.random()*TM_COLORS.length)], email:'', fullName:'', designation:'Sales Executive', tel:'', signature:'' };
  tmOpenModal('เพิ่ม Sales Person');
}

function tmEditSales(sId){
  const s = sbGetSales(sId); if(!s) return;
  _tmModalType = 'sales';
  _tmModalEditId = sId;
  _tmModalDraft = {...s};
  tmOpenModal('แก้ไข Sales Person');
}

function tmDeleteSales(sId){
  const s = sbGetSales(sId); if(!s) return;
  const count = SB_AGENTS.filter(a=>a.sales===sId).length;
  let msg = `ยืนยันลบ "${s.name}"?`;
  if(count>0) msg += `\n\n⚠️ ${s.name} ดูแลอยู่ ${count} agents — agents เหล่านี้จะไม่มีผู้ดูแล (ต้องไปกำหนดใหม่)`;
  if(!confirm(msg)) return;
  // unassign agents
  SB_AGENTS.filter(a=>a.sales===sId).forEach(a=>{ a.sales = null; });
  SB_SALES = SB_SALES.filter(x=>x.id!==sId);
  if(typeof sbSalesPersist==='function') sbSalesPersist();
  if(typeof sbAgentsPersist==='function') sbAgentsPersist();
  renderTeamMkt();
}

// ── Market CRUD ──
function tmAddMarket(){
  _tmModalType = 'market';
  _tmModalEditId = null;
  _tmModalDraft = { id:'m'+String(Date.now()).slice(-5), name:'', color:TM_COLORS[Math.floor(Math.random()*TM_COLORS.length)], subs:[] };
  tmOpenModal('เพิ่ม Market');
}

function tmEditMarket(mId){
  const m = sbGetMarket(mId); if(!m) return;
  _tmModalType = 'market';
  _tmModalEditId = mId;
  _tmModalDraft = {...m, subs:[...(m.subs||[])]};
  tmOpenModal('แก้ไข Market');
}

function tmDeleteMarket(mId){
  const m = sbGetMarket(mId); if(!m) return;
  const count = SB_AGENTS.filter(a=>a.market===mId).length;
  if(count>0){
    alert(`ไม่สามารถลบ "${m.name}" ได้\n\nมี ${count} agents อยู่ในตลาดนี้ — ย้าย agents ไปตลาดอื่นก่อน`);
    return;
  }
  if(!confirm(`ยืนยันลบ Market "${m.name}"?`)) return;
  SB_MARKETS = SB_MARKETS.filter(x=>x.id!==mId);
  if(typeof sbMarketsPersist==='function') sbMarketsPersist();
  renderTeamMkt();
}

// ── Modal ──
function tmOpenModal(title){
  document.getElementById('tm-modal').style.display = 'flex';
  document.getElementById('tm-modal-ttl').textContent = title;
  tmRenderModalBody();
}

function tmCloseModal(){
  document.getElementById('tm-modal').style.display = 'none';
  _tmModalDraft = null;
  _tmModalEditId = null;
  _tmModalType = null;
}

function tmRenderModalBody(){
  if(!_tmModalDraft) return;
  const body = document.getElementById('tm-modal-body');
  const d = _tmModalDraft;

  let colorPicker = '<div class="tm-color-picker">';
  TM_COLORS.forEach(c=>{
    colorPicker += `<div class="tm-color-sw ${d.color===c?'on':''}" style="background:${c}" onclick="tmSetColor('${c}')"></div>`;
  });
  colorPicker += '</div>';
  colorPicker += `<div class="tm-color-hex">
    <div class="preview" style="background:${d.color}"></div>
    <input type="text" value="${d.color}" oninput="tmSetColor(this.value)" placeholder="#hex">
  </div>`;

  if(_tmModalType === 'sales'){
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="tm-fld">
          <label class="tm-fld-lbl">Code (2-3 ตัวอักษร) <span style="color:var(--coral)">*</span></label>
          <input type="text" maxlength="3" value="${d.code}" oninput="tmSetField('code',this.value.toUpperCase())" placeholder="เช่น NK, JD">
        </div>
        <div class="tm-fld">
          <label class="tm-fld-lbl">ชื่อเล่น (Display) <span style="color:var(--coral)">*</span></label>
          <input type="text" value="${d.name}" oninput="tmSetField('name',this.value)" placeholder="เช่น Khun Nok">
        </div>
      </div>

      <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:10px">For Contract Signatory · ใช้ตอน Export สัญญา</div>
        <div class="tm-fld">
          <label class="tm-fld-lbl">ชื่อ-นามสกุลเต็ม (Full Name)</label>
          <input type="text" value="${d.fullName||''}" oninput="tmSetField('fullName',this.value)" placeholder="เช่น Natthaphat Chotejirawarachat">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="tm-fld">
            <label class="tm-fld-lbl">ตำแหน่ง (Designation)</label>
            <input type="text" value="${d.designation||''}" oninput="tmSetField('designation',this.value)" placeholder="เช่น Sales Executive">
          </div>
          <div class="tm-fld">
            <label class="tm-fld-lbl">เบอร์ติดต่อ (Tel)</label>
            <input type="text" value="${d.tel||''}" oninput="tmSetField('tel',this.value)" placeholder="เช่น 062-242-6315">
          </div>
        </div>
        <div class="tm-fld">
          <label class="tm-fld-lbl">ลายเซ็น (Signature)</label>
          <div class="tm-sig-upload">
            ${d.signature ? `
              <div class="tm-sig-preview">
                <img src="${d.signature}" alt="signature" />
                <button type="button" class="tm-sig-remove" onclick="tmSetField('signature','');tmRenderModalBody()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ` : `
              <label class="tm-sig-drop">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                <span>คลิกเพื่ออัพโหลดลายเซ็น (PNG ขาว-โปร่ง)</span>
                <input type="file" accept="image/png,image/jpeg" style="display:none" onchange="tmUploadSignature(this)">
              </label>
            `}
          </div>
        </div>
      </div>

      <div class="tm-fld">
        <label class="tm-fld-lbl">Email</label>
        <input type="email" value="${d.email||''}" oninput="tmSetField('email',this.value)" placeholder="name@loveandaman.com">
      </div>
      <div class="tm-fld">
        <label class="tm-fld-lbl">สีประจำตัว</label>
        ${colorPicker}
      </div>
    `;
  } else if(_tmModalType === 'market'){
    body.innerHTML = `
      <div class="tm-fld">
        <label class="tm-fld-lbl">ชื่อ Market <span style="color:var(--coral)">*</span></label>
        <input type="text" value="${d.name}" oninput="tmSetField('name',this.value)" placeholder="เช่น Russian Market">
      </div>
      <div class="tm-fld">
        <label class="tm-fld-lbl">Market ID (ตัวเล็ก ไม่มีช่องว่าง) <span style="color:var(--coral)">*</span></label>
        <input type="text" value="${d.id}" oninput="tmSetField('id',this.value.toLowerCase().replace(/[^a-z0-9]/g,''))" placeholder="เช่น ru, ota, ap" ${_tmModalEditId?'disabled style="background:var(--sand);color:var(--ink-soft);cursor:not-allowed"':''}>
        ${_tmModalEditId?'<div style="font-size:9px;color:var(--ink-soft);margin-top:3px">ไม่สามารถเปลี่ยน ID หลังจากสร้างแล้ว</div>':''}
      </div>
      <div class="tm-fld">
        <label class="tm-fld-lbl">Sub-categories (ขึ้นบรรทัดใหม่)</label>
        <textarea rows="4" oninput="tmSetSubs(this.value)" placeholder="DMC&#10;OTA-RU&#10;..." style="resize:vertical;font-family:'DM Sans',sans-serif">${(d.subs||[]).join('\n')}</textarea>
      </div>
      <div class="tm-fld">
        <label class="tm-fld-lbl">สีประจำ Market</label>
        ${colorPicker}
      </div>
    `;
  }
}

function tmSetField(key, val){
  if(_tmModalDraft) _tmModalDraft[key] = val;
}

function tmSetSubs(val){
  if(!_tmModalDraft) return;
  _tmModalDraft.subs = val.split('\n').map(s=>s.trim()).filter(Boolean);
}

function tmSetColor(c){
  if(!_tmModalDraft) return;
  _tmModalDraft.color = c;
  tmRenderModalBody();
}

function tmUploadSignature(input){
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];
  if(file.size > 10*1024*1024){   // §sanity cap ที่ไฟล์ต้นทาง · เราย่อให้เล็กก่อนเก็บอยู่แล้ว จึงรับได้ถึง 10MB
    alert('ขนาดไฟล์ต้องน้อยกว่า 10 MB');
    return;
  }
  const _apply = url => { if(_tmModalDraft){ _tmModalDraft.signature = url; tmRenderModalBody(); } };
  const reader = new FileReader();
  reader.onload = (e)=>{
    const dataUrl = e.target.result;
    // §ย่อลายเซ็นให้ด้านยาวสุดไม่เกิน 900px แล้วเก็บเป็น PNG (คง alpha โปร่งใส) · กันบล็อบบวมเพราะ base64 sync ขึ้น Postgres ทุกครั้งที่บันทึก
    const img = new Image();
    img.onload = ()=>{
      try{
        const MAXDIM = 900;
        let w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
        if(!w || !h){ _apply(dataUrl); return; }
        const scale = Math.min(1, MAXDIM/Math.max(w,h));   // ย่อเท่านั้น (ด้านยาวสุด ≤900) ไม่ขยาย
        const cw = Math.round(w*scale), ch = Math.round(h*scale);
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0,0,cw,ch);   // เริ่มด้วยพื้นโปร่ง
        ctx.drawImage(img,0,0,cw,ch);
        // §ทำพื้นขาว/เกือบขาวให้โปร่งใส · ลายเซ็นที่สแกน/ถ่ายมาพื้นขาว จะได้พื้นโปร่งจริง (ไม่มีกล่องขาวในสัญญา)
        try{ const idata=ctx.getImageData(0,0,cw,ch), px=idata.data;
          for(let i=0;i<px.length;i+=4){ if(px[i]>=236 && px[i+1]>=236 && px[i+2]>=236){ px[i+3]=0; } }
          ctx.putImageData(idata,0,0);
        }catch(_e){}   // getImageData ไม่ได้ (เช่น canvas ถูก taint) → ข้าม knock-out
        _apply(cv.toDataURL('image/png'));
      }catch(err){ _apply(dataUrl); }   // ประมวลผลไม่ได้ → เก็บไฟล์เดิม
    };
    img.onerror = ()=>{ _apply(dataUrl); };   // โหลดรูปไม่ได้ (ไม่ใช่ไฟล์ภาพ?) → เก็บของเดิม
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function tmSaveModal(){
  if(!_tmModalDraft) return;
  const d = _tmModalDraft;

  if(_tmModalType === 'sales'){
    if(!d.code) return alert('กรุณาระบุ Code');
    if(!d.name) return alert('กรุณาระบุชื่อ');
    // Check duplicate code
    const dup = SB_SALES.find(s=>s.code===d.code && s.id!==_tmModalEditId);
    if(dup) return alert(`Code "${d.code}" ถูกใช้แล้วโดย ${dup.name}`);

    if(_tmModalEditId){
      const idx = SB_SALES.findIndex(s=>s.id===_tmModalEditId);
      if(idx>=0) SB_SALES[idx] = {...d};
    } else {
      SB_SALES.push({...d});
    }
    if(typeof sbSalesPersist==='function') sbSalesPersist();
  } else if(_tmModalType === 'market'){
    if(!d.name) return alert('กรุณาระบุชื่อ Market');
    if(!d.id) return alert('กรุณาระบุ Market ID');
    // Check duplicate id (only on add)
    if(!_tmModalEditId){
      const dup = SB_MARKETS.find(m=>m.id===d.id);
      if(dup) return alert(`Market ID "${d.id}" ถูกใช้แล้ว`);
    }

    if(_tmModalEditId){
      const idx = SB_MARKETS.findIndex(m=>m.id===_tmModalEditId);
      if(idx>=0) SB_MARKETS[idx] = {...d};
    } else {
      SB_MARKETS.push({...d});
    }
    if(typeof sbMarketsPersist==='function') sbMarketsPersist();
  }

  tmCloseModal();
  renderTeamMkt();
}

function aosUsedBy(svcId){
  // Count agents that have this service in their addonServices (placeholder for Phase 2.2)
  return (SB_AGENTS||[]).filter(a=>(a.addonServices||[]).some(s=>s.svcId===svcId)).length;
}

function aosAddService(){
  _aosModalType = 'service';
  _aosModalSvcId = null;
  _aosModalDraft = { id:'aos_'+String(Date.now()).slice(-6), name:'', desc:'', icon:'other', variants:[] };
  aosOpenModal('เพิ่ม Service ใหม่');
}
function aosEditService(svcId){
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  _aosModalType = 'service';
  _aosModalSvcId = svcId;
  _aosModalDraft = {...svc, variants:svc.variants}; // keep variants ref untouched
  aosOpenModal('แก้ไข Service');
}
function aosDeleteService(svcId){
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  const used = aosUsedBy(svcId);
  let msg = `ลบ "${svc.name}" ?`;
  if(used>0) msg += `\n\n⚠️ Service นี้ถูกใช้อยู่ใน ${used} agent — agents เหล่านี้จะเสียข้อมูล Service นี้`;
  if(!confirm(msg)) return;
  SB_ADDON_SVCS = SB_ADDON_SVCS.filter(s=>s.id!==svcId);
  // Clean up from agents
  (SB_AGENTS||[]).forEach(a=>{ if(a.addonServices) a.addonServices = a.addonServices.filter(s=>s.svcId!==svcId); });
  renderAddonSvc();
}

function aosAddVariant(svcId){
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  _aosModalType = 'variant';
  _aosModalSvcId = svcId;
  _aosModalVarId = null;
  _aosModalDraft = { id:'v_'+String(Date.now()).slice(-6), name:'', unit:'' };
  aosOpenModal(`เพิ่ม Variant ใน ${svc.name}`);
}
function aosEditVariant(svcId, varId){
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  const v = svc.variants.find(x=>x.id===varId); if(!v) return;
  _aosModalType = 'variant';
  _aosModalSvcId = svcId;
  _aosModalVarId = varId;
  _aosModalDraft = {...v};
  aosOpenModal(`แก้ไข Variant`);
}
function aosDeleteVariant(svcId, varId){
  const svc = SB_ADDON_SVCS.find(s=>s.id===svcId); if(!svc) return;
  const v = svc.variants.find(x=>x.id===varId); if(!v) return;
  if(!confirm(`ลบ Variant "${v.name}" ?`)) return;
  svc.variants = svc.variants.filter(x=>x.id!==varId);
  // Clean up from agents
  (SB_AGENTS||[]).forEach(a=>{
    if(a.addonServices){
      a.addonServices.forEach(s=>{ if(s.svcId===svcId && s.variants) s.variants = s.variants.filter(av=>av.varId!==varId); });
    }
  });
  renderAddonSvc();
}

function aosOpenModal(title){
  document.getElementById('aos-modal').style.display = 'flex';
  document.getElementById('aos-modal-ttl').textContent = title;
  aosRenderModalBody();
}
function aosCloseModal(){
  document.getElementById('aos-modal').style.display = 'none';
  _aosModalType = null;
  _aosModalSvcId = null;
  _aosModalVarId = null;
  _aosModalDraft = null;
}
function aosSetField(key, val){ if(_aosModalDraft) _aosModalDraft[key] = val; }
function aosSetIcon(icon){ if(!_aosModalDraft) return; _aosModalDraft.icon = icon; aosRenderModalBody(); }

function aosRenderModalBody(){
  if(!_aosModalDraft) return;
  const body = document.getElementById('aos-modal-body');
  const d = _aosModalDraft;
  if(_aosModalType==='service'){
    const icons = ['boat','van','guide','other'];
    body.innerHTML = `
      <div class="aos-fld">
        <label class="aos-fld-lbl">ชื่อ Service <span class="req">*</span></label>
        <input type="text" value="${d.name||''}" oninput="aosSetField('name',this.value)" placeholder="เช่น Long-tail Boat (Pileh Lagoon)">
      </div>
      <div class="aos-fld">
        <label class="aos-fld-lbl">คำอธิบาย</label>
        <textarea oninput="aosSetField('desc',this.value)" placeholder="อธิบายสั้นๆ ว่า service นี้คืออะไร">${d.desc||''}</textarea>
      </div>
      <div class="aos-fld">
        <label class="aos-fld-lbl">Icon</label>
        <div class="aos-icon-picker">
          ${icons.map(ic=>`<div class="aos-icon-sw ${ic} ${d.icon===ic?'on':''}" onclick="aosSetIcon('${ic}')" title="${ic}">${AOS_ICONS[ic]}</div>`).join('')}
        </div>
        <div class="aos-fld-hint">เลือก icon ที่ตรงกับประเภท service</div>
      </div>
    `;
  } else if(_aosModalType==='variant'){
    body.innerHTML = `
      <div class="aos-fld">
        <label class="aos-fld-lbl">ชื่อ Variant <span class="req">*</span></label>
        <input type="text" value="${d.name||''}" oninput="aosSetField('name',this.value)" placeholder="เช่น Join Long-tail, Van to Tub Lamu">
      </div>
      <div class="aos-fld">
        <label class="aos-fld-lbl">Unit (หน่วยการคิดราคา)</label>
        <input type="text" value="${d.unit||''}" oninput="aosSetField('unit',this.value)" placeholder="เช่น per person, per van (8-10 pax)">
        <div class="aos-fld-hint">บอกว่าราคาคิดต่อหน่วยอะไร · จะแสดงเป็น tag เล็กๆ ใต้ชื่อ variant</div>
      </div>
    `;
  }
}

function aosSaveModal(){
  if(!_aosModalDraft) return;
  const d = _aosModalDraft;
  if(_aosModalType==='service'){
    if(!d.name) return alert('กรุณาระบุชื่อ Service');
    if(_aosModalSvcId){
      const idx = SB_ADDON_SVCS.findIndex(s=>s.id===_aosModalSvcId);
      if(idx>=0) {
        // Keep existing variants
        const existingVariants = SB_ADDON_SVCS[idx].variants;
        SB_ADDON_SVCS[idx] = {...d, variants:existingVariants};
      }
    } else {
      SB_ADDON_SVCS.push({...d, variants:[]});
    }
  } else if(_aosModalType==='variant'){
    if(!d.name) return alert('กรุณาระบุชื่อ Variant');
    const svc = SB_ADDON_SVCS.find(s=>s.id===_aosModalSvcId); if(!svc) return;
    if(_aosModalVarId){
      const idx = svc.variants.findIndex(v=>v.id===_aosModalVarId);
      if(idx>=0) svc.variants[idx] = {...d};
    } else {
      svc.variants.push({...d});
    }
  }
  aosCloseModal();
  renderAddonSvc();
}
