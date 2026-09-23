// 08f-vans.js · Vans · van jobs · van bill · vehicles · pickup setup
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

// Vehicle status timeline · push {at,kind,text} · kind: created|status|zone|driver|edit
function vehLog(id, kind, text){ const v=(SB_VEHICLES||[]).find(x=>x.id===id); if(!v||!text) return; if(!Array.isArray(v.log)) v.log=[]; v.log.push({at:new Date().toISOString(), kind:kind||'edit', text:String(text)}); if(v.log.length>100) v.log=v.log.slice(-100); }
function vjShade(hex, pct){                        // pct<0 = darker
  const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||'')); if(!m) return hex||'#64748B';
  const num=parseInt(m[1],16); const f=(100+(pct||0))/100;
  const cl=x=>Math.max(0,Math.min(255,Math.round(x*f)));
  const r=cl((num>>16)&255), g=cl((num>>8)&255), b=cl(num&255);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function vehColor(vid){
  const v=(typeof vehGet==='function'?vehGet(vid):null)||{};
  if(v.color && /^#[0-9a-fA-F]{6}$/.test(v.color)) return v.color;
  const s=String(vid||''); let acc=0; for(let i=0;i<s.length;i++) acc=(acc*31+s.charCodeAt(i))>>>0;
  return VEH_COLORS[acc % VEH_COLORS.length];      // stable per-vehicle fallback, never position-based
}
function vehGrad(vid){ const c=vehColor(vid); return [c, vjShade(c,-22)]; }
function vjTint(hex, pct){                          // pct 0..1 = ผสมกับสีขาว
  const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||'')); if(!m) return '#EFEDE6';
  const num=parseInt(m[1],16); const mix=x=>Math.round(x+(255-x)*pct);
  const r=mix((num>>16)&255), g=mix((num>>8)&255), b=mix(num&255);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
// [พื้นอ่อน, ตัวหนังสือเข้ม] — รูปแบบเดียวกับ PAL_BOAT เดิม จึงเสียบแทนได้ตรงๆ
function vehChipPair(vid){ const c=vehColor(vid); return [vjTint(c,.87), vjShade(c,-30)]; }
function vehSetColor(vid, hex){
  const v=(typeof vehGet==='function'?vehGet(vid):null); if(!v) return;
  if(hex) v.color=hex; else delete v.color;        // no hex = back to the automatic colour
  if(typeof vehLog==='function') vehLog(vid,'edit','เปลี่ยนสีประจำรถ → '+(hex||'อัตโนมัติ'));
  if(typeof sbVehiclesPersist==='function') sbVehiclesPersist();
  vehColorClose();
  if(typeof renderVanJobs==='function' && document.getElementById('vanjobs-host')) renderVanJobs();
  if(typeof renderVehicles==='function' && document.getElementById('vehicles-host')) renderVehicles();
}
// ลากใน color picker แล้วเห็นผลทันที (ไม่ปิด popup · ไม่ยิง log ทุก pixel)
function vehSetColorLive(vid, hex){
  const v=(typeof vehGet==='function'?vehGet(vid):null); if(!v) return;
  if(!/^#[0-9a-fA-F]{6}$/.test(hex||'')) return;
  v.color=String(hex).toLowerCase();
  if(typeof sbVehiclesPersist==='function') sbVehiclesPersist();
  if(typeof renderVanJobs==='function' && document.getElementById('vanjobs-host')) renderVanJobs();
  if(typeof renderVehicles==='function' && document.getElementById('vehicles-host')) renderVehicles();
}
function vehColorClose(){ const p=document.getElementById('veh-color-pop'); if(p) p.remove(); }
function vehColorPick(vid, ev){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no color change */
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  vehColorClose();
  const v=(typeof vehGet==='function'?vehGet(vid):null)||{};
  const cur=vehColor(vid), custom=!!v.color;
  const r=(ev&&ev.currentTarget&&ev.currentTarget.getBoundingClientRect)?ev.currentTarget.getBoundingClientRect():{left:80,bottom:80};
  const pop=document.createElement('div'); pop.id='veh-color-pop';
  pop.style.cssText='position:fixed;z-index:9999;background:#fff;border:1px solid rgba(0,0,0,.10);border-radius:12px;'
    +'box-shadow:0 14px 40px -10px rgba(0,0,0,.30);padding:12px;width:236px;'
    +'left:'+Math.max(8, Math.min(window.innerWidth-248, r.left))+'px;top:'+Math.max(8, Math.min(window.innerHeight-300, r.bottom+8))+'px';
  pop.onclick=e=>e.stopPropagation();
  pop.innerHTML='<div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.04em;text-transform:uppercase;margin-bottom:9px">'
      +'สีประจำ '+String(v.name||vid).replace(/</g,'&lt;')+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px">'
    + VEH_COLORS.map(c=>'<button onclick="vehSetColor(\''+vid+'\',\''+c+'\')" title="'+c+'" style="width:22px;height:22px;border-radius:6px;'
        +'background:'+c+';border:2px solid '+(custom&&cur.toLowerCase()===c.toLowerCase()?'#111':'transparent')+';cursor:pointer;padding:0"></button>').join('')
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:7px;margin-top:10px">'
      +'<input type="color" value="'+cur+'" oninput="vehSetColorLive(\''+vid+'\',this.value)" title="เลือกสีเองได้ไม่จำกัด" style="width:36px;height:32px;flex:none;padding:2px;border:1px solid #e5e7eb;border-radius:7px;background:#fff;cursor:pointer">'
      +'<span style="font-size:10.5px;color:#9ca3af">เลือกสีเองได้ไม่จำกัด &#8594;</span>'
    +'</div>'
    +'<button onclick="vehSetColor(\''+vid+'\',\'\')" style="margin-top:8px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:8px;'
      +'padding:6px;font-size:11.5px;font-weight:600;color:#6b7280;cursor:pointer;font-family:inherit">'
      +(custom?'ล้างสี · กลับเป็นอัตโนมัติ':'ใช้สีอัตโนมัติอยู่')+'</button>';
  document.body.appendChild(pop);
  setTimeout(()=>document.addEventListener('click', vehColorClose, {once:true}), 0);
}
function vehGet(id){ return (SB_VEHICLES||[]).find(v=>v.id===id); }
function vehName(id){ const v=vehGet(id); return v?(v.name+(v.plate&&v.plate!=='-'?(' · '+v.plate):'')):'—'; }

// Expand a legacy timeGroup-keyed times object into areaId-keyed
// e.g. { r5: { 'pk-w2': '06:00-06:15' } } → { r5: { 'pk-patong':'06:00-06:15', 'pk-karon':'06:00-06:15', 'pk-kata':'06:00-06:15' } }
function _psuExpandTimesToAreas(times){
  const out = {};
  Object.keys(times||{}).forEach(rid => {
    out[rid] = {};
    Object.keys(times[rid]||{}).forEach(key => {
      const val = times[rid][key];
      // Check if key is an area id (matches an area directly) or a timeGroup (legacy)
      const directArea = (SB_PICKUP_AREAS||[]).find(a => a.id === key);
      if(directArea){
        // Already an areaId
        out[rid][key] = val;
      } else {
        // Treat as timeGroup · expand to all areas in this group
        const members = (SB_PICKUP_AREAS||[]).filter(a => a.timeGroup === key);
        members.forEach(a => { out[rid][a.id] = val; });
      }
    });
  });
  return out;
}
// Resolve the profile that applies for a given date (YYYY-MM-DD)
// Tiebreaker: narrower range wins (more specific) · then newer createdAt
function psuResolveProfile(dateStr){
  if(!dateStr) dateStr = new Date().toISOString().slice(0,10);
  const matches = (SB_PICKUP_TIME_PROFILES||[]).filter(p => p.from && p.to && p.from <= dateStr && dateStr <= p.to);
  if(matches.length === 0) return null;
  matches.sort((a,b) => {
    const aSpan = new Date(a.to) - new Date(a.from);
    const bSpan = new Date(b.to) - new Date(b.from);
    if(aSpan !== bSpan) return aSpan - bSpan;  // narrower wins
    return String(b.createdAt||'').localeCompare(String(a.createdAt||''));  // then newer wins
  });
  return matches[0];
}

// ═══════════════════════════════════════════════════════════════
// PICKUP SETUP · admin UI for SB_PICKUP_AREAS + SB_PICKUP_TIMES
// ═══════════════════════════════════════════════════════════════

function psuPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */ 
  // Read-modify-write to loveandaman_v2 (CLAUDE.md §6.2)
  try {
    const raw = localStorage.getItem('loveandaman_v2');
    const obj = raw ? JSON.parse(raw) : {};
    obj.sb_pickup_areas = SB_PICKUP_AREAS;
    obj.sb_pickup_times = SB_PICKUP_TIMES;
    obj.sb_pickup_time_profiles = SB_PICKUP_TIME_PROFILES;
    localStorage.setItem('loveandaman_v2', JSON.stringify(obj));
  } catch(e){ console.warn('[psuPersist] failed:', e); }
}

function psuRenderShell(){
  const totAreas = (SB_PICKUP_AREAS||[]).length;
  const groupCnt = new Set((SB_PICKUP_AREAS||[]).map(a => a.timeGroup)).size;
  const profileCnt = (SB_PICKUP_TIME_PROFILES||[]).length;
  const activeProf = psuResolveProfile();  // today's active profile
  // Ensure _psuActiveProfileId is set · default to active profile · then first
  if(!_psuActiveProfileId){
    _psuActiveProfileId = activeProf?.id || (SB_PICKUP_TIME_PROFILES[0]?.id) || null;
  }
  const currentProf = (SB_PICKUP_TIME_PROFILES||[]).find(p => p.id === _psuActiveProfileId);
  // Coverage · per-route × per-area cells in current profile
  const activeRouteIds = (typeof ROUTES!=='undefined' ? ROUTES.filter(r => r.active !== false).map(r => r.id) : []);
  const allAreaIds = (SB_PICKUP_AREAS||[]).map(a => a.id);
  const totCells = activeRouteIds.length * allAreaIds.length;
  let filledCells = 0;
  const curTimes = currentProf?.times || {};
  activeRouteIds.forEach(rid => allAreaIds.forEach(aid => { if(curTimes?.[rid]?.[aid]) filledCells++; }));
  const cov = totCells > 0 ? Math.round(filledCells / totCells * 100) : 0;

  return `
    <style>
      #view-pickup-setup{font-family:'DM Sans',sans-serif;color:#1a1a1a;padding:24px 28px}
      #view-pickup-setup .psu-h1{font-size:24px;font-weight:700;color:#1B2A55;letter-spacing:-.02em;margin:0 0 4px}
      #view-pickup-setup .psu-sub{font-size:12px;color:#8a8a82;margin:0 0 20px}
      #view-pickup-setup .psu-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
      #view-pickup-setup .psu-kpi-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:6px;padding:13px 16px}
      #view-pickup-setup .psu-kpi-lab{font-size:9px;color:#8a8a82;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      #view-pickup-setup .psu-kpi-val{font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#1B2A55;letter-spacing:-.02em;line-height:1.1;margin-top:5px}
      #view-pickup-setup .psu-kpi-sub{font-size:10px;color:#8a8a82;margin-top:1px;font-family:'DM Mono',monospace}
      #view-pickup-setup .psu-tabs{display:flex;gap:2px;background:#f5f3ef;padding:3px;border-radius:6px;width:fit-content;margin-bottom:14px}
      #view-pickup-setup .psu-tab{padding:7px 14px;font-size:12px;font-weight:600;color:#8a8a82;border:none;background:transparent;border-radius:4px;cursor:pointer;font-family:inherit}
      #view-pickup-setup .psu-tab.on{background:#fff;color:#1B2A55;box-shadow:0 1px 2px rgba(0,0,0,.05)}
      #view-pickup-setup .psu-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:6px;padding:0;overflow:hidden}
      #view-pickup-setup .psu-toolbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.06);background:#fafafa}
      #view-pickup-setup .psu-search{border:1px solid rgba(0,0,0,.1);border-radius:5px;padding:6px 10px;font-size:12px;font-family:inherit;width:220px}
      #view-pickup-setup .psu-search:focus{outline:none;border-color:#1B2A55}
      #view-pickup-setup .psu-zone-pill{padding:5px 10px;font-size:11px;font-weight:600;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:14px;cursor:pointer;color:#8a8a82;font-family:inherit}
      #view-pickup-setup .psu-zone-pill.on{background:#1B2A55;color:#fff;border-color:#1B2A55}
      #view-pickup-setup .psu-btn{padding:7px 14px;font-size:12px;font-weight:600;border:none;border-radius:5px;cursor:pointer;font-family:inherit}
      #view-pickup-setup .psu-btn-pri{background:#1B2A55;color:#fff}
      #view-pickup-setup .psu-btn-pri:hover{background:#0F1A3B}
      #view-pickup-setup .psu-btn-ghost{background:transparent;color:#1B2A55;border:1px solid rgba(27,42,85,.2)}
      #view-pickup-setup table{width:100%;border-collapse:collapse}
      #view-pickup-setup th{background:#f5f3ef;padding:9px 12px;text-align:left;font-size:9px;color:#8a8a82;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid rgba(0,0,0,.06)}
      #view-pickup-setup td{padding:9px 12px;font-size:12px;border-bottom:1px solid #f5f3ef;vertical-align:middle}
      #view-pickup-setup tr:hover td{background:#fafafa}
      #view-pickup-setup .psu-zone-tag{display:inline-block;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:.04em;border-radius:3px;font-family:'DM Mono',monospace}
      #view-pickup-setup .psu-zone-tag.PK{background:#E8F2FB;color:#185FA5}
      #view-pickup-setup .psu-zone-tag.KL{background:#FFF2E8;color:#A05A1A}
      #view-pickup-setup .psu-zone-tag.RN{background:#F3EEFB;color:#6A3FA0}   /* §rnZone */
      #view-pickup-setup .psu-zone-tag.NoTransfer{background:#F0F0EC;color:#6B6B62}
      #view-pickup-setup .psu-tg-pill{display:inline-block;padding:2px 8px;font-size:10px;font-weight:600;background:#F0EEE8;color:#5A5A52;border-radius:3px;font-family:'DM Mono',monospace}
      #view-pickup-setup .psu-pier-tag{display:inline-block;padding:2px 7px;font-size:9px;font-weight:700;letter-spacing:.04em;border-radius:3px;font-family:'DM Sans',sans-serif}
      #view-pickup-setup .psu-row-btn{padding:4px 9px;font-size:10px;font-weight:600;background:transparent;border:1px solid rgba(0,0,0,.1);border-radius:4px;cursor:pointer;font-family:inherit;color:#5A5A52}
      #view-pickup-setup .psu-row-btn:hover{border-color:#1B2A55;color:#1B2A55}
      #view-pickup-setup .psu-row-btn.danger:hover{border-color:#a32d2d;color:#a32d2d}
      /* Matrix view */
      #view-pickup-setup .psu-mat-wrap{overflow-x:auto;max-width:100%}
      #view-pickup-setup .psu-mat{min-width:100%;table-layout:fixed}
      #view-pickup-setup .psu-mat th, #view-pickup-setup .psu-mat td{border-right:1px solid #f0eee8;padding:7px 6px}
      #view-pickup-setup .psu-mat th:first-child, #view-pickup-setup .psu-mat td:first-child{position:sticky;left:0;background:#f5f3ef;z-index:2;border-right:2px solid rgba(0,0,0,.08);min-width:240px;max-width:240px;width:240px}
      #view-pickup-setup .psu-mat td:first-child{background:#fff;font-weight:600}
      #view-pickup-setup .psu-mat tr:hover td:first-child{background:#fafafa}
      #view-pickup-setup .psu-mat th{width:80px;min-width:80px;font-size:9px;text-align:center;letter-spacing:.04em}
      #view-pickup-setup .psu-mat td{text-align:center}
      #view-pickup-setup .psu-mat-cell{width:74px;padding:3px 4px;font-family:'DM Mono',monospace;font-size:10px;font-weight:600;color:#1B2A55;text-align:center;background:#E8F2FB;border:1px solid transparent;border-radius:3px}
      #view-pickup-setup .psu-mat-cell:focus{outline:none;background:#fff;border-color:#1B2A55;box-shadow:0 0 0 2px rgba(27,42,85,.1)}
      #view-pickup-setup .psu-mat-cell.empty{background:transparent;color:#c0bdb3}
      #view-pickup-setup .psu-tg-head{font-size:9px;color:#1B2A55;font-weight:700;letter-spacing:.06em;font-family:'DM Mono',monospace;line-height:1.2}
      #view-pickup-setup .psu-tg-head-sub{font-size:8px;color:#8a8a82;font-weight:500;margin-top:2px;font-family:'DM Sans',sans-serif;display:block;letter-spacing:0;text-transform:none}
      /* Modal */
      #view-pickup-setup .psu-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;display:flex;align-items:center;justify-content:center}
      #view-pickup-setup .psu-modal{background:#fff;border-radius:8px;padding:0;width:480px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden}
      #view-pickup-setup .psu-modal-h{padding:14px 18px;border-bottom:1px solid rgba(0,0,0,.06);font-size:14px;font-weight:700;color:#1B2A55;display:flex;align-items:center;justify-content:space-between}
      #view-pickup-setup .psu-modal-body{padding:18px}
      #view-pickup-setup .psu-modal-foot{padding:12px 18px;border-top:1px solid rgba(0,0,0,.06);display:flex;justify-content:flex-end;gap:8px;background:#fafafa}
      #view-pickup-setup .psu-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
      #view-pickup-setup .psu-label{font-size:10px;font-weight:700;color:#8a8a82;letter-spacing:.06em;text-transform:uppercase}
      #view-pickup-setup .psu-input{border:1px solid rgba(0,0,0,.1);border-radius:5px;padding:8px 11px;font-size:13px;font-family:inherit;color:#1a1a1a}
      #view-pickup-setup .psu-input:focus{outline:none;border-color:#1B2A55;box-shadow:0 0 0 2px rgba(27,42,85,.08)}
    </style>
    <h1 class="psu-h1">Pickup Setup</h1>
    <p class="psu-sub">Manage pickup areas (where guests get picked up) and the route × time-group matrix (when each route picks up from each group).</p>

    <div class="psu-kpi">
      <div class="psu-kpi-card"><div class="psu-kpi-lab">Profiles</div><div class="psu-kpi-val">${profileCnt}</div><div class="psu-kpi-sub">schedule versions</div></div>
      <div class="psu-kpi-card"><div class="psu-kpi-lab">Active Today</div><div class="psu-kpi-val" style="font-size:13px;line-height:1.3;color:${activeProf?'#0F6E56':'#a32d2d'}">${activeProf ? (activeProf.name.length > 22 ? activeProf.name.slice(0,20)+'…' : activeProf.name) : 'None'}</div><div class="psu-kpi-sub">${activeProf ? `${activeProf.from} → ${activeProf.to}` : 'no profile covers today'}</div></div>
      <div class="psu-kpi-card"><div class="psu-kpi-lab">Pickup Areas</div><div class="psu-kpi-val">${totAreas}</div><div class="psu-kpi-sub">${groupCnt} time groups</div></div>
      <div class="psu-kpi-card"><div class="psu-kpi-lab">Editing Coverage</div><div class="psu-kpi-val">${cov}%</div><div class="psu-kpi-sub">${filledCells} / ${totCells} cells</div></div>
    </div>

    <div class="psu-tabs">
      <button class="psu-tab ${_psuTab==='profiles'?'on':''}" onclick="psuSetTab('profiles')">📅 Schedule Profiles</button>
      <button class="psu-tab ${_psuTab==='areas'?'on':''}" onclick="psuSetTab('areas')">📍 Pickup Areas</button>
      <button class="psu-tab ${_psuTab==='matrix'?'on':''}" onclick="psuSetTab('matrix')">⏱ Time Matrix</button>
      <button class="psu-tab ${_psuTab==='hotels'?'on':''}" onclick="psuSetTab('hotels')">🏨 ชื่อโรงแรมซ้ำ</button>
    </div>

    ${_psuTab === 'profiles' ? psuRenderProfilesTab() : _psuTab === 'areas' ? psuRenderAreasTab()
      : _psuTab === 'hotels' ? psuRenderHotelsTab() : psuRenderMatrixTab()}

    ${_psuAreaDraft ? psuRenderAreaModal() : ''}
    ${_psuProfileDraft ? psuRenderProfileModal() : ''}
    ${_psuExportRouteId ? psuRenderExportModal() : ''}
  `;
}

function psuSetTab(tab){ _psuTab = tab; renderPickupSetup(); }
function psuSetHotelMin(v){ _psuHotelMin=Math.max(0.5,Math.min(1,parseFloat(v)||0.82)); _psuHotelPick={}; renderPickupSetup(); }
// §hotelArea · ปกติไม่รวมข้ามพื้นที่รับ · เปิดได้ถ้าข้อมูลพื้นที่ของเก่ายังไม่ครบ
function psuToggleHotelXArea(){ _psuHotelXArea=!_psuHotelXArea; _psuHotelPick={}; renderPickupSetup(); }
function psuHotelGroups(){
  var BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[];
  var byName={}, order=[];
  BK.forEach(function(b){
    if(!b) return;
    ['hotelName','pickup'].forEach(function(f){
      var s=String(b[f]||'').replace(/\s+/g,' ').trim(); if(!s) return;
      if(!byName[s]){ byName[s]={name:s, n:0, last:'', areas:{}}; order.push(s); }
      byName[s].n++;
      var d=((b.trips&&b.trips[0])?b.trips[0].date:'')||'';
      if(d>byName[s].last) byName[s].last=d;
      if(b.pickupAreaId) byName[s].areas[b.pickupAreaId]=(byName[s].areas[b.pickupAreaId]||0)+1;
    });
  });
  // union-find บนชื่อทั้งหมด
  var idx={}, par=[];
  order.forEach(function(nm,i){ idx[nm]=i; par[i]=i; });
  var find=function(i){ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
  var uni=function(a,b){ a=find(a); b=find(b); if(a!==b) par[b]=a; };
  // §hotelArea · เชื่อมกันได้ต่อเมื่อเคยอยู่พื้นที่รับเดียวกัน
  //   ชื่อที่ไม่เคยระบุพื้นที่เลยถือว่าเข้ากับใครก็ได้ (ของเก่าบางใบไม่มีข้อมูล)
  var sameArea=function(a,b){
    if(_psuHotelXArea) return true;
    var ka=Object.keys(a.areas||{}), kb=Object.keys(b.areas||{});
    if(!ka.length || !kb.length) return true;
    for(var t=0;t<ka.length;t++) if(b.areas[ka[t]]) return true;
    return false;
  };
  for(var i=0;i<order.length;i++){
    for(var j=i+1;j<order.length;j++){
      if(bkV2HotelSim(order[i],order[j])>=_psuHotelMin && sameArea(byName[order[i]],byName[order[j]])) uni(i,j);
    }
  }
  var g={};
  order.forEach(function(nm){ var r=find(idx[nm]); (g[r]=g[r]||[]).push(byName[nm]); });
  var out=Object.keys(g).map(function(k){
    var arr=g[k].sort(function(x,y){ return y.n-x.n || x.name.localeCompare(y.name); });
    // ชื่อที่ควรเก็บโดยปริยาย · ใช้บ่อยสุดก่อน · เสมอกันเอาที่พิมพ์เป็นชื่อเฉพาะ (มีตัวใหญ่) และยาวกว่า
    var keep=arr.slice().sort(function(x,y){
      if(y.n!==x.n) return y.n-x.n;
      var ux=/[A-Z\u0E00-\u0E7F]/.test(x.name)?1:0, uy=/[A-Z\u0E00-\u0E7F]/.test(y.name)?1:0;
      if(ux!==uy) return uy-ux;
      return y.name.length-x.name.length;
    })[0].name;
    return { id:'g'+k, items:arr, keep:keep, tot:arr.reduce(function(a,x){return a+x.n;},0) };
  }).filter(function(x){ return x.items.length>1; });
  out.sort(function(a,b){ return b.items.length-a.items.length || b.tot-a.tot; });
  return out;
}
function psuHotelPick(gid, name){ _psuHotelPick[gid]=name; renderPickupSetup(); }
function psuHotelMerge(gid){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  var G=psuHotelGroups().filter(function(x){ return x.id===gid; })[0]; if(!G) return;
  var keep=_psuHotelPick[gid]||G.keep;
  var drop=G.items.map(function(x){return x.name;}).filter(function(x){ return x!==keep; });
  if(!drop.length){ alert('กลุ่มนี้เหลือชื่อเดียวแล้ว'); return; }
  if(!confirm('รวม '+drop.length+' ชื่อเข้าเป็น "'+keep+'"\n\n'
    +drop.map(function(x){return '  · '+x;}).join('\n')
    +'\n\nจะเขียนทับชื่อโรงแรมใน booking ที่เกี่ยวข้องทั้งหมด · ย้อนกลับไม่ได้')) return;
  var set={}; drop.forEach(function(x){ set[x]=1; });
  var n=0;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(!b) return; var hit=false;
    if(b.hotelName && set[String(b.hotelName).replace(/\s+/g,' ').trim()]){ b.hotelName=keep; hit=true; }
    if(b.pickup && set[String(b.pickup).replace(/\s+/g,' ').trim()]){ b.pickup=keep; hit=true; }
    if(hit){ n++; if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','รวมชื่อโรงแรมเป็น "'+keep+'"','Hotel merge'); }
  });
  try{ if(typeof acctPersistBookings==='function') acctPersistBookings(); }catch(_){}
  delete _psuHotelPick[gid];
  alert('รวมเรียบร้อย · แก้ไป '+n+' booking');
  renderPickupSetup();
}
// ชื่อพื้นที่รับของชื่อโรงแรมหนึ่ง ๆ · เรียงจากที่ใช้บ่อยสุด
function psuHotelAreaLabel(it){
  var ks=Object.keys(it.areas||{}); if(!ks.length) return 'ไม่ระบุพื้นที่';
  ks.sort(function(a,b){ return it.areas[b]-it.areas[a]; });
  var nm=function(id){ var a=(typeof bkV2GetArea==='function')?bkV2GetArea(id):null; return (a&&a.name)||id; };
  var out=nm(ks[0]);
  if(ks.length>1) out+=' +'+(ks.length-1);
  return out;
}
function psuRenderHotelsTab(){
  var esc=function(s){ return String(s||'').replace(/[&<>"']/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var G=psuHotelGroups();
  var nNames=0; G.forEach(function(g){ nNames+=g.items.length; });
  var head='<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div style="font-size:13px;color:#5a5a52">พบ <b style="color:#1B2A55">'+G.length+'</b> กลุ่มที่น่าจะเป็นโรงแรมเดียวกัน '
      +'(รวม <b>'+nNames+'</b> ชื่อ) · เลือกชื่อที่จะเก็บไว้แล้วกดรวม</div>'
    +'<label style="margin-left:auto;font-size:12px;color:#8a8a82;display:inline-flex;align-items:center;gap:6px;cursor:pointer" '
      +'title="ปกติจะไม่รวมชื่อที่มาจากพื้นที่รับต่างกัน เพราะเชนเดียวกันคนละสาขาชื่อคล้ายกันมาก">'
    +'<input type="checkbox"'+(_psuHotelXArea?' checked':'')+' onchange="psuToggleHotelXArea()" style="accent-color:#0F6E56">'
    +'รวมข้ามพื้นที่รับ</label>'
    +'<label style="font-size:12px;color:#8a8a82;display:inline-flex;align-items:center;gap:7px">ความเข้มการจับคู่'
      +'<select onchange="psuSetHotelMin(this.value)" style="font-family:inherit;font-size:12px;border:1px solid #e0ddd5;border-radius:6px;padding:5px 8px;background:#fff">'
      +[['0.92','เข้มมาก · เฉพาะที่เกือบเหมือน'],['0.82','ปกติ'],['0.7','หลวม · จับได้เยอะแต่ต้องตรวจ']]
        .map(function(o){ return '<option value="'+o[0]+'"'+(String(_psuHotelMin)===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      +'</select></label></div>';
  if(!G.length) return head+'<div style="padding:26px;text-align:center;color:#8a8a82;font-size:13px;background:#fff;border:1px solid #eceae2;border-radius:10px">ไม่พบชื่อที่ซ้ำกันในระดับนี้ &#127881;</div>';
  var body=G.map(function(g){
    var keep=_psuHotelPick[g.id]||g.keep;
    var rows=g.items.map(function(it){
      var on=(it.name===keep);
      return '<label style="display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;cursor:pointer;'
        +'background:'+(on?'#EAF4F0':'transparent')+'">'
        +'<input type="radio" name="hg-'+g.id+'"'+(on?' checked':'')+' onchange="psuHotelPick(\''+g.id+'\',this.dataset.n)" data-n="'+esc(it.name)+'" style="accent-color:#0F6E56">'
        +'<span style="flex:1;font-size:13px;color:#1a1a1a;'+(on?'font-weight:700':'')+'">'+esc(it.name)+'</span>'
        +'<span style="font-size:11px;color:#8a8a82;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          +esc(psuHotelAreaLabel(it))+'</span>'
        +'<span style="font-size:11px;color:#8a8a82;font-family:\'DM Mono\',monospace;width:74px;text-align:right">'+it.n+' booking</span>'
        +(it.last?'<span style="font-size:10.5px;color:#b4b2aa;width:82px;text-align:right">ล่าสุด '+esc(it.last)+'</span>':'')
        +'</label>';
    }).join('');
    return '<div style="background:#fff;border:1px solid #eceae2;border-radius:10px;padding:11px 13px;margin-bottom:9px">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">'
        +'<span style="font-size:11px;font-weight:700;color:#8a8a82;letter-spacing:.05em;text-transform:uppercase">'+g.items.length+' ชื่อ · '+g.tot+' booking</span>'
        +'<button onclick="psuHotelMerge(\''+g.id+'\')" style="margin-left:auto;background:#0F6E56;color:#fff;border:none;'
          +'border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">รวมเป็นชื่อนี้</button></div>'
      +rows+'</div>';
  }).join('');
  return head+body;
}

// ─── Schedule Profiles Tab ───
function psuRenderProfilesTab(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const today = new Date().toISOString().slice(0,10);
  const profs = [...(SB_PICKUP_TIME_PROFILES||[])].sort((a,b) => (a.from||'').localeCompare(b.from||''));
  const activeProf = psuResolveProfile(today);

  const cellCount = p => {
    let n = 0;
    Object.keys(p.times||{}).forEach(rid => { n += Object.keys(p.times[rid]||{}).length; });
    return n;
  };
  const dayCount = p => {
    if(!p.from || !p.to) return 0;
    return Math.round((new Date(p.to) - new Date(p.from)) / (1000*60*60*24)) + 1;
  };
  const statusOf = p => {
    if(!p.from || !p.to) return { label:'Invalid dates', color:'#a32d2d', bg:'#FDE7E7' };
    if(today >= p.from && today <= p.to) return { label:'Active now', color:'#0F6E56', bg:'#E1F5EE' };
    if(today < p.from) return { label:'Upcoming', color:'#A05A1A', bg:'#FFF2E0' };
    return { label:'Past', color:'#8a8a82', bg:'#F0F0EC' };
  };

  const rows = profs.map(p => {
    const st = statusOf(p);
    const isCurrentlyEditing = p.id === _psuActiveProfileId;
    return `
      <div class="psu-prof-card${isCurrentlyEditing?' editing':''}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:14px;font-weight:700;color:#1B2A55">${escapeHTML(p.name)}</span>
            <span style="background:${st.bg};color:${st.color};font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:3px">${st.label.toUpperCase()}</span>
            ${isCurrentlyEditing?'<span style="background:#1B2A55;color:#fff;font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:3px">EDITING</span>':''}
            ${p.clonedFrom?`<span style="font-size:9px;color:#8a8a82;font-style:italic">cloned from ${escapeHTML((SB_PICKUP_TIME_PROFILES.find(x=>x.id===p.clonedFrom)?.name)||p.clonedFrom)}</span>`:''}
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:#5A5A52;margin-top:4px">${p.from||'—'} → ${p.to||'—'} &middot; ${dayCount(p)} days &middot; ${cellCount(p)} cells filled</div>
          ${p.notes?`<div style="font-size:10px;color:#8a8a82;font-style:italic;margin-top:3px;max-width:600px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(p.notes)}</div>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="psu-row-btn" onclick="psuOpenProfileMatrix('${p.id}')">${isCurrentlyEditing?'Editing':'Open matrix'}</button>
          <button class="psu-row-btn" onclick="psuOpenEditProfile('${p.id}')">Edit info</button>
          <button class="psu-row-btn" onclick="psuOpenCloneProfile('${p.id}')" title="Clone this profile to create next season">Clone</button>
          ${profs.length > 1 ? `<button class="psu-row-btn danger" onclick="psuDeleteProfile('${p.id}')">Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <style>
      #view-pickup-setup .psu-prof-card{background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:6px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:14px}
      #view-pickup-setup .psu-prof-card.editing{border-color:#1B2A55;background:#F4F6FB;border-width:2px;padding:11px 13px}
    </style>
    <div class="psu-card">
      <div class="psu-toolbar">
        <div style="font-size:11px;color:#5A5A52;font-weight:600">${profs.length} profile${profs.length===1?'':'s'} &middot; ${activeProf ? `Active today: <strong style="color:#0F6E56">${escapeHTML(activeProf.name)}</strong>` : '<strong style="color:#a32d2d">No profile covers today</strong>'}</div>
        <div style="flex:1"></div>
        <button class="psu-btn psu-btn-ghost" onclick="psuOpenNewProfile(false)">+ New blank profile</button>
        <button class="psu-btn psu-btn-pri" onclick="psuOpenNewProfile(true)">+ Clone latest as next season</button>
      </div>
      <div style="padding:14px 16px;background:#fafafa">
        ${rows || '<div style="text-align:center;padding:30px;color:#8a8a82;font-style:italic">No profiles yet · create one to start</div>'}
      </div>
      <div style="padding:12px 16px;border-top:1px solid rgba(0,0,0,.06);background:#FFF6E5;font-size:11px;color:#633806;line-height:1.5">
        <strong>How it works:</strong> Each profile = one season's full pickup schedule (Active – End). Booking flow auto-picks the profile that covers each trip's date. When a season ends, <strong>Clone</strong> the previous profile and adjust only the times that changed — usually just 5-10 cells out of 168.
      </div>
    </div>
  `;
}

function psuOpenProfileMatrix(pid){
  _psuActiveProfileId = pid;
  _psuTab = 'matrix';
  renderPickupSetup();
}

function psuOpenNewProfile(cloneLatest){
  const profs = [...(SB_PICKUP_TIME_PROFILES||[])].sort((a,b) => (b.from||'').localeCompare(a.from||''));
  const latest = profs[0];
  _psuProfileDraft = {
    id: '', name: '', from: '', to: '', notes: '',
    startFrom: (cloneLatest && latest) ? 'clone' : 'blank',
    cloneSourceId: latest?.id || null,
    isNew: true
  };
  renderPickupSetup();
}

function psuOpenEditProfile(pid){
  const p = (SB_PICKUP_TIME_PROFILES||[]).find(x => x.id === pid);
  if(!p) return;
  _psuProfileDraft = {
    id: p.id, name: p.name, from: p.from, to: p.to, notes: p.notes||'',
    startFrom: 'existing', cloneSourceId: null,
    isNew: false, editOnly: true  // only metadata · don't touch times
  };
  renderPickupSetup();
}

function psuOpenCloneProfile(pid){
  const src = (SB_PICKUP_TIME_PROFILES||[]).find(x => x.id === pid);
  if(!src) return;
  // Suggest next year same dates
  const nextYear = d => {
    if(!d) return '';
    const dt = new Date(d);
    dt.setFullYear(dt.getFullYear() + 1);
    return dt.toISOString().slice(0,10);
  };
  _psuProfileDraft = {
    id: '',
    name: src.name.replace(/(\d{4})/g, m => String(Number(m)+1)) || (src.name + ' · next'),
    from: nextYear(src.from),
    to: nextYear(src.to),
    notes: '',
    startFrom: 'clone',
    cloneSourceId: src.id,
    isNew: true
  };
  renderPickupSetup();
}

function psuCloseProfileModal(){ _psuProfileDraft = null; renderPickupSetup(); }

function psuSetProfileDraftField(key, val){
  if(!_psuProfileDraft) return;
  _psuProfileDraft[key] = val;
  // Only re-render for radio (cloneSource selection) · skip text inputs for focus
  if(key === 'startFrom' || key === 'cloneSourceId') renderPickupSetup();
}

function psuSaveProfile(){
  const d = _psuProfileDraft;
  if(!d) return;
  const name = (d.name||'').trim();
  if(!name){ alert('Profile name is required'); return; }
  if(!d.from || !d.to){ alert('Validity period (Start and End dates) is required'); return; }
  if(d.from > d.to){ alert('Start date must be before End date'); return; }
  // Overlap warning (non-blocking)
  if(d.isNew){
    const overlap = (SB_PICKUP_TIME_PROFILES||[]).find(p => p.from <= d.to && p.to >= d.from);
    if(overlap){
      if(!confirm(`Validity overlaps with "${overlap.name}" (${overlap.from} → ${overlap.to}).\nBooking flow will pick the more recently-created profile for the overlap.\nContinue?`)) return;
    }
  }

  if(d.isNew){
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    let id = 'prof-' + slug;
    let i = 1;
    while((SB_PICKUP_TIME_PROFILES||[]).some(p => p.id === id)){ id = 'prof-' + slug + '-' + (++i); }
    let times = {};
    let clonedFrom = null;
    if(d.startFrom === 'clone' && d.cloneSourceId){
      const src = (SB_PICKUP_TIME_PROFILES||[]).find(p => p.id === d.cloneSourceId);
      if(src){
        times = JSON.parse(JSON.stringify(src.times || {}));
        clonedFrom = src.id;
      }
    }
    SB_PICKUP_TIME_PROFILES.push({ id, name, from:d.from, to:d.to, notes:d.notes||'', clonedFrom, times, createdAt: new Date().toISOString() });
    _psuActiveProfileId = id;
    _psuTab = 'matrix';  // jump straight to editing
  } else {
    const p = SB_PICKUP_TIME_PROFILES.find(x => x.id === d.id);
    if(p){
      p.name = name; p.from = d.from; p.to = d.to; p.notes = d.notes||'';
    }
  }
  psuPersist();
  _psuProfileDraft = null;
  renderPickupSetup();
}

function psuDeleteProfile(pid){
  const p = (SB_PICKUP_TIME_PROFILES||[]).find(x => x.id === pid);
  if(!p) return;
  if(!confirm(`Delete profile "${p.name}"?\nAll pickup times in this profile will be lost. Bookings already created keep their snapshotted times.`)) return;
  SB_PICKUP_TIME_PROFILES = SB_PICKUP_TIME_PROFILES.filter(x => x.id !== pid);
  if(_psuActiveProfileId === pid){
    _psuActiveProfileId = SB_PICKUP_TIME_PROFILES[0]?.id || null;
  }
  psuPersist();
  renderPickupSetup();
}

function psuRenderProfileModal(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const d = _psuProfileDraft;
  const profs = (SB_PICKUP_TIME_PROFILES||[]).filter(p => p.id !== d.id);
  const src = d.cloneSourceId ? profs.find(p => p.id === d.cloneSourceId) : null;
  let srcCellCount = 0;
  if(src){ Object.keys(src.times||{}).forEach(rid => { srcCellCount += Object.keys(src.times[rid]||{}).length; }); }
  let dayCount = 0;
  if(d.from && d.to && d.from <= d.to){
    dayCount = Math.round((new Date(d.to) - new Date(d.from)) / (1000*60*60*24)) + 1;
  }
  // Overlap detection (live)
  const overlapsWith = (SB_PICKUP_TIME_PROFILES||[]).filter(p => p.id !== d.id && d.from && d.to && p.from <= d.to && p.to >= d.from);

  return `
    <div class="psu-modal-backdrop" onclick="if(event.target===this)psuCloseProfileModal()">
      <div class="psu-modal" style="width:520px">
        <div class="psu-modal-h">
          <span>${d.isNew ? '+ New Schedule Profile' : (d.editOnly ? 'Edit Profile Info' : 'Edit Profile')}</span>
          <button onclick="psuCloseProfileModal()" style="background:transparent;border:none;font-size:18px;color:#8a8a82;cursor:pointer">&times;</button>
        </div>
        <div class="psu-modal-body">
          <div class="psu-field">
            <label class="psu-label">Profile name *</label>
            <input class="psu-input" type="text" value="${escapeHTML(d.name)}" placeholder="e.g. High Season 2026-2027" oninput="psuSetProfileDraftField('name', this.value)">
          </div>
          <div class="psu-field">
            <label class="psu-label">Validity period * <em style="font-weight:500;color:#b4b2a9;font-style:normal">· when this schedule is active</em></label>
            <div style="display:flex;align-items:center;gap:8px">
              <input class="psu-input" type="date" value="${escapeHTML(d.from)}" style="flex:1" oninput="psuSetProfileDraftField('from', this.value)">
              <span style="color:#8a8a82">→</span>
              <input class="psu-input" type="date" value="${escapeHTML(d.to)}" style="flex:1" oninput="psuSetProfileDraftField('to', this.value)">
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:${dayCount>0?'#5A5A52':'#a32d2d'};margin-top:4px">
              ${dayCount > 0 ? `${dayCount} days` : 'Start must be before End'}
              ${overlapsWith.length > 0 ? ` · <span style="color:#A05A1A">⚠ overlaps with ${overlapsWith.map(p=>escapeHTML(p.name)).join(', ')}</span>` : ''}
            </div>
          </div>
          ${d.isNew ? `
            <div class="psu-field">
              <label class="psu-label">Start from *</label>
              <div style="display:flex;flex-direction:column;gap:6px">
                <label style="display:flex;align-items:flex-start;gap:8px;padding:9px 12px;background:${d.startFrom==='clone'?'#E8F2FB':'#fff'};border:1px solid ${d.startFrom==='clone'?'#1B2A55':'rgba(0,0,0,.1)'};border-radius:5px;cursor:pointer">
                  <input type="radio" name="psu-startfrom" ${d.startFrom==='clone'?'checked':''} onchange="psuSetProfileDraftField('startFrom','clone')" style="accent-color:#1B2A55;margin-top:2px">
                  <div style="flex:1">
                    <div style="font-size:12px;font-weight:700;color:${d.startFrom==='clone'?'#1B2A55':'#1a1a1a'}">Clone from existing profile</div>
                    ${profs.length > 0 ? `
                      <select onchange="psuSetProfileDraftField('cloneSourceId', this.value)" style="margin-top:6px;font-size:11px;padding:4px 8px;border:1px solid rgba(0,0,0,.1);border-radius:4px;font-family:inherit;width:100%" ${d.startFrom!=='clone'?'disabled':''}>
                        ${profs.map(p => `<option value="${p.id}" ${d.cloneSourceId===p.id?'selected':''}>${escapeHTML(p.name)} · ${p.from} → ${p.to}</option>`).join('')}
                      </select>
                      ${src && d.startFrom==='clone' ? `<div style="font-size:10px;color:#185FA5;margin-top:4px"><strong>${srcCellCount}</strong> cells will be prefilled · edit only what changed</div>` : ''}
                    ` : '<div style="font-size:10px;color:#8a8a82;margin-top:4px;font-style:italic">No existing profiles to clone from</div>'}
                  </div>
                </label>
                <label style="display:flex;align-items:flex-start;gap:8px;padding:9px 12px;background:${d.startFrom==='blank'?'#E8F2FB':'#fff'};border:1px solid ${d.startFrom==='blank'?'#1B2A55':'rgba(0,0,0,.1)'};border-radius:5px;cursor:pointer">
                  <input type="radio" name="psu-startfrom" ${d.startFrom==='blank'?'checked':''} onchange="psuSetProfileDraftField('startFrom','blank')" style="accent-color:#1B2A55;margin-top:2px">
                  <div>
                    <div style="font-size:12px;font-weight:700;color:${d.startFrom==='blank'?'#1B2A55':'#1a1a1a'}">Start blank</div>
                    <div style="font-size:10px;color:#8a8a82;margin-top:2px">Fill the matrix from scratch</div>
                  </div>
                </label>
              </div>
            </div>
          ` : ''}
          <div class="psu-field">
            <label class="psu-label">Notes <em style="font-weight:500;color:#b4b2a9;font-style:normal">· optional</em></label>
            <textarea class="psu-input" rows="2" placeholder="e.g. Whale Shark starts 15min later · Surin season opens" style="width:100%;box-sizing:border-box;font-family:inherit;resize:vertical" oninput="psuSetProfileDraftField('notes', this.value)">${escapeHTML(d.notes||'')}</textarea>
          </div>
        </div>
        <div class="psu-modal-foot">
          <button class="psu-btn psu-btn-ghost" onclick="psuCloseProfileModal()">Cancel</button>
          <button class="psu-btn psu-btn-pri" onclick="psuSaveProfile()">${d.isNew ? 'Create &amp; edit matrix' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  `;
}

function psuRenderAreasTab(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const zoneLabel = z => laZoneLabel(z);                  /* §rnZone */
  const zoneCounts = { PK:0, KL:0, RN:0, NoTransfer:0 };
  (SB_PICKUP_AREAS||[]).forEach(a => { if(zoneCounts[a.zone]!==undefined) zoneCounts[a.zone]++; });
  const q = _psuAreaSearch.toLowerCase();
  const filtered = (SB_PICKUP_AREAS||[]).filter(a => {
    if(_psuAreaZoneFilter !== 'all' && a.zone !== _psuAreaZoneFilter) return false;
    if(q && !((a.name||'').toLowerCase().includes(q) || (a.region||'').toLowerCase().includes(q) || (a.timeGroup||'').toLowerCase().includes(q) || (a.id||'').toLowerCase().includes(q))) return false;
    return true;
  });
  // Group by zone, then by region
  const grouped = {};
  filtered.forEach(a => {
    if(!grouped[a.zone]) grouped[a.zone] = {};
    const reg = a.region || 'other';
    if(!grouped[a.zone][reg]) grouped[a.zone][reg] = [];
    grouped[a.zone][reg].push(a);
  });

  return `
    <div class="psu-card">
      <div class="psu-toolbar">
        <input class="psu-search" type="text" placeholder="Search by name, region, time group..." value="${escapeHTML(_psuAreaSearch)}" oninput="psuSetAreaSearch(this.value)">
        <div style="display:flex;gap:5px;margin-left:6px">
          <button class="psu-zone-pill ${_psuAreaZoneFilter==='all'?'on':''}" onclick="psuSetAreaZoneFilter('all')">All</button>
          <button class="psu-zone-pill ${_psuAreaZoneFilter==='PK'?'on':''}" onclick="psuSetAreaZoneFilter('PK')">PK · ${zoneCounts.PK}</button>
          <button class="psu-zone-pill ${_psuAreaZoneFilter==='KL'?'on':''}" onclick="psuSetAreaZoneFilter('KL')">KL · ${zoneCounts.KL}</button>
          <button class="psu-zone-pill ${_psuAreaZoneFilter==='RN'?'on':''}" onclick="psuSetAreaZoneFilter('RN')">RN · ${zoneCounts.RN}</button>
          <button class="psu-zone-pill ${_psuAreaZoneFilter==='NoTransfer'?'on':''}" onclick="psuSetAreaZoneFilter('NoTransfer')">NT · ${zoneCounts.NoTransfer}</button>
        </div>
        <div style="flex:1"></div>
        <button class="psu-btn psu-btn-pri" onclick="psuOpenAddArea()">+ Add Area</button>
      </div>
      <div style="max-height:600px;overflow-y:auto">
        <table>
          <thead>
            <tr>
              <th style="width:35%">Area Name</th>
              <th style="width:90px">Zone</th>
              <th style="width:25%">Region</th>
              <th style="width:18%">Time Group <em style="font-weight:500;color:#b4b2a9;font-style:normal;text-transform:none;letter-spacing:0">· legacy hint</em></th>
              <th style="width:80px">ID</th>
              <th style="width:120px;text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(grouped).length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:30px;color:#8a8a82;font-style:italic">No areas match filter</td></tr>' : ''}
            ${LA_PICKUP_ZONES.filter(z => grouped[z]).flatMap(z => {
              const out = [`<tr style="background:#f8f7f3"><td colspan="6" style="font-size:10px;font-weight:700;color:#5A5A52;letter-spacing:.08em;text-transform:uppercase;padding:8px 12px">${zoneLabel(z)} &middot; ${(Object.values(grouped[z]).flat()).length} area(s)</td></tr>`];
              Object.keys(grouped[z]).sort().forEach(reg => {
                grouped[z][reg].forEach(a => {
                  out.push(`
                    <tr>
                      <td style="font-weight:600">${escapeHTML(a.name)}</td>
                      <td><span class="psu-zone-tag ${a.zone}">${a.zone}</span></td>
                      <td style="color:#8a8a82;font-size:11px">${escapeHTML(a.region||'—')}</td>
                      <td><span class="psu-tg-pill">${escapeHTML(a.timeGroup||'—')}</span></td>
                      <td style="font-family:'DM Mono',monospace;font-size:10px;color:#8a8a82">${escapeHTML(a.id)}</td>
                      <td style="text-align:right">
                        <button class="psu-row-btn" onclick="psuOpenEditArea('${a.id}')">Edit</button>
                        <button class="psu-row-btn danger" onclick="psuDeleteArea('${a.id}')">Delete</button>
                      </td>
                    </tr>
                  `);
                });
              });
              return out;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function psuSetAreaSearch(v){ _psuAreaSearch = v; renderPickupSetup(); const inp = document.querySelector('.psu-search'); if(inp){ inp.focus(); inp.setSelectionRange(v.length, v.length); } }
function psuSetAreaZoneFilter(z){ _psuAreaZoneFilter = z; renderPickupSetup(); }

function psuOpenAddArea(){
  _psuAreaDraft = { id:'', name:'', zone:'PK', region:'', timeGroup:'', isNew:true };
  renderPickupSetup();
}
function psuOpenEditArea(aid){
  const a = bkV2GetArea(aid);
  if(!a){ alert('Area not found: '+aid); return; }
  _psuAreaDraft = { id:a.id, name:a.name, zone:a.zone, region:a.region||'', timeGroup:a.timeGroup||'', isNew:false };
  renderPickupSetup();
}
function psuCloseAreaModal(){ _psuAreaDraft = null; renderPickupSetup(); }

function psuSetDraftField(key, val){
  if(!_psuAreaDraft) return;
  _psuAreaDraft[key] = val;
  // Only re-render for non-text fields (preserve focus)
  if(key === 'zone') renderPickupSetup();
}

// Auto-fill a new/edited area's pickup times by inheriting from siblings in the SAME time group
// (per-area schema · copies into every profile · only fills EMPTY cells · never overwrites)
function _psuInheritTimesForArea(area){
  if(!area || !area.timeGroup) return 0;
  const sibs = (SB_PICKUP_AREAS||[]).filter(a => a.timeGroup===area.timeGroup && a.id!==area.id);
  let filled = 0;
  (SB_PICKUP_TIME_PROFILES||[]).forEach(p => {
    if(!p.times) return;
    Object.keys(p.times).forEach(routeId => {
      const byRoute = p.times[routeId]; if(!byRoute || byRoute[area.id]) return;  // skip if already set
      let val = '';
      for(const s of sibs){ if(byRoute[s.id]){ val = byRoute[s.id]; break; } }   // copy from a group sibling
      if(!val && SB_PICKUP_TIMES?.[routeId]?.[area.timeGroup]) val = SB_PICKUP_TIMES[routeId][area.timeGroup];  // legacy group fallback
      if(val){ byRoute[area.id] = val; filled++; }
    });
  });
  return filled;
}
function psuSaveArea(){
  if(!_psuAreaDraft) return;
  const d = _psuAreaDraft;
  const name = (d.name||'').trim();
  if(!name){ alert('Name is required'); return; }
  if(!d.timeGroup){ alert('Time group is required'); return; }
  let savedArea = null;
  if(d.isNew){
    // Generate ID from zone + name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
    const zoneSlug = d.zone === 'PK' ? 'pk' : d.zone === 'KL' ? 'kl' : d.zone === 'RN' ? 'rn' : 'nt';   /* §rnZone */
    let id = `${zoneSlug}-${slug}`;
    // Ensure unique
    let i = 1;
    while((SB_PICKUP_AREAS||[]).some(a => a.id === id)){ id = `${zoneSlug}-${slug}-${++i}`; }
    savedArea = { id, name, zone:d.zone, region:d.region||'', timeGroup:d.timeGroup };
    SB_PICKUP_AREAS.push(savedArea);
  } else {
    const a = SB_PICKUP_AREAS.find(x => x.id === d.id);
    if(a){
      a.name = name;
      a.zone = d.zone;
      a.region = d.region || '';
      a.timeGroup = d.timeGroup;
      savedArea = a;
    }
  }
  // Auto-inherit pickup times from the time group (fills empty cells across all profiles)
  const filled = savedArea ? _psuInheritTimesForArea(savedArea) : 0;
  psuPersist();
  _psuAreaDraft = null;
  renderPickupSetup();
  if(filled && typeof flShowToast==='function') flShowToast(`Auto-filled ${filled} time cell(s) from group ${savedArea.timeGroup}`);
}

function psuDeleteArea(aid){
  const a = bkV2GetArea(aid);
  if(!a) return;
  if(!confirm(`Delete "${a.name}"?\nThis will not affect existing bookings (they store area name + zone snapshot).`)) return;
  SB_PICKUP_AREAS = SB_PICKUP_AREAS.filter(x => x.id !== aid);
  psuPersist();
  renderPickupSetup();
}

function psuRenderAreaModal(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const d = _psuAreaDraft;
  // Existing time groups for autocomplete (per zone)
  const tgList = [...new Set((SB_PICKUP_AREAS||[]).filter(a => a.zone === d.zone).map(a => a.timeGroup))].sort();
  const regList = [...new Set((SB_PICKUP_AREAS||[]).filter(a => a.zone === d.zone).map(a => a.region).filter(Boolean))].sort();
  return `
    <div class="psu-modal-backdrop" onclick="if(event.target===this)psuCloseAreaModal()">
      <div class="psu-modal">
        <div class="psu-modal-h">
          <span>${d.isNew ? '+ Add Pickup Area' : 'Edit Pickup Area'}</span>
          <button onclick="psuCloseAreaModal()" style="background:transparent;border:none;font-size:18px;color:#8a8a82;cursor:pointer">&times;</button>
        </div>
        <div class="psu-modal-body">
          <div class="psu-field">
            <label class="psu-label">Area Name *</label>
            <input class="psu-input" type="text" value="${escapeHTML(d.name)}" placeholder="e.g. Patong Beach" oninput="psuSetDraftField('name', this.value)">
          </div>
          <div class="psu-field">
            <label class="psu-label">Zone *</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${/* §rnZone · 4 โซนแล้ว · เรียงเป็น 2 แถวไม่ให้บีบจนอ่านไม่ออก */''}
              ${LA_PICKUP_ZONES.map(z => `
                <label style="flex:1 1 46%;display:flex;align-items:center;gap:6px;padding:8px 11px;background:${d.zone===z?'#E8F2FB':'#fff'};border:1px solid ${d.zone===z?'#1B2A55':'rgba(0,0,0,.1)'};border-radius:5px;cursor:pointer">
                  <input type="radio" name="psu-zone" ${d.zone===z?'checked':''} onchange="psuSetDraftField('zone','${z}')" style="accent-color:#1B2A55">
                  <span style="font-size:12px;font-weight:600;color:${d.zone===z?'#1B2A55':'#5A5A52'};white-space:nowrap">${laZoneLabel(z)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="psu-field">
            <label class="psu-label">Region <em style="font-weight:500;color:#b4b2a9;font-style:normal">· grouping label · optional</em></label>
            <input class="psu-input" type="text" list="psu-dl-regions" value="${escapeHTML(d.region)}" placeholder="e.g. phuket-west" oninput="psuSetDraftField('region', this.value)">
            <datalist id="psu-dl-regions">${regList.map(r => `<option value="${escapeHTML(r)}"></option>`).join('')}</datalist>
          </div>
          <div class="psu-field">
            <label class="psu-label">Time Group * <em style="font-weight:500;color:#b4b2a9;font-style:normal">· areas with same time group share pickup time</em></label>
            <input class="psu-input" type="text" list="psu-dl-tgs" value="${escapeHTML(d.timeGroup)}" placeholder="e.g. pk-w2" oninput="psuSetDraftField('timeGroup', this.value)">
            <datalist id="psu-dl-tgs">${tgList.map(t => `<option value="${escapeHTML(t)}"></option>`).join('')}</datalist>
            ${tgList.length > 0 ? `<div style="font-size:10px;color:#8a8a82;margin-top:4px">Existing groups in ${d.zone}: ${tgList.map(t => `<code style="background:#f5f3ef;padding:1px 5px;border-radius:3px;font-size:9px">${t}</code>`).join(' ')}</div>` : ''}
          </div>
          ${!d.isNew ? `<div style="font-size:10px;color:#8a8a82;font-family:'DM Mono',monospace;margin-top:4px">ID: ${escapeHTML(d.id)}</div>` : ''}
        </div>
        <div class="psu-modal-foot">
          <button class="psu-btn psu-btn-ghost" onclick="psuCloseAreaModal()">Cancel</button>
          <button class="psu-btn psu-btn-pri" onclick="psuSaveArea()">${d.isNew ? 'Add Area' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Time Matrix Tab ───
function psuRenderMatrixTab(){
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  // Profile resolution
  const currentProf = (SB_PICKUP_TIME_PROFILES||[]).find(p => p.id === _psuActiveProfileId);
  if(!currentProf){
    return `<div class="psu-card" style="padding:30px;text-align:center;color:#8a8a82">
      <div style="font-size:13px;margin-bottom:8px">No profile selected</div>
      <button class="psu-btn psu-btn-pri" onclick="psuSetTab('profiles')">Go to Schedule Profiles →</button>
    </div>`;
  }
  const profTimes = currentProf.times || (currentProf.times = {});
  const cloneSrc = currentProf.clonedFrom ? (SB_PICKUP_TIME_PROFILES||[]).find(p => p.id === currentProf.clonedFrom) : null;
  const cloneSrcTimes = cloneSrc?.times || null;
  const today = new Date().toISOString().slice(0,10);
  const isActiveNow = currentProf.from && currentProf.to && currentProf.from <= today && today <= currentProf.to;
  // Columns = pickup areas (grouped by zone) · ordered PK → KL → RN → NoTransfer
  const tgs = [];
  LA_PICKUP_ZONES.forEach(z => {                          /* §rnZone */
    const inZone = (SB_PICKUP_AREAS||[]).filter(a => a.zone === z);
    // Sort by region then name for stable order
    inZone.sort((a,b) => (a.region||'').localeCompare(b.region||'') || (a.name||'').localeCompare(b.name||''));
    inZone.forEach(area => tgs.push({ id:area.id, zone:z, name:area.name, region:area.region||'', timeGroup:area.timeGroup||'' }));
  });
  // Routes from ROUTES (active only)
  const allRoutes = (typeof ROUTES!=='undefined' ? ROUTES.filter(r => r.active !== false) : []);
  // Pier labels + counts
  const pierLabel = p => p==='tublamu'?'Tub Lamu':p==='panwa'?'Visit Panwa':p==='ranong'?'Ranong':(p||'—');
  const pierColor = p => p==='tublamu'?'#3B6D11':p==='panwa'?'#185FA5':p==='ranong'?'#8B4789':'#8a8a82';
  const pierBg    = p => p==='tublamu'?'#E8F4DE':p==='panwa'?'#E8F2FB':p==='ranong'?'#F5E8F5':'#F0F0EC';
  const pierCounts = {};
  allRoutes.forEach(r => { pierCounts[r.pier] = (pierCounts[r.pier]||0) + 1; });
  const piersPresent = Object.keys(pierCounts).sort();
  // Open-today helper (use existing isRouteActiveToday)
  const isOpen = r => (typeof isRouteActiveToday === 'function') ? isRouteActiveToday(r) : true;
  // Filter chain
  const q = _psuMatrixSearch.toLowerCase();
  const filteredRoutes = allRoutes.filter(r => {
    if(_psuMatrixPier !== 'all' && r.pier !== _psuMatrixPier) return false;
    if(_psuMatrixHideClosed && !isOpen(r)) return false;
    if(q && !((r.name||'').toLowerCase().includes(q) || (r.id||'').toLowerCase().includes(q))) return false;
    return true;
  });
  const closedCount = allRoutes.filter(r => !isOpen(r)).length;

  if(tgs.length === 0){
    return `<div class="psu-card" style="padding:30px;text-align:center;color:#8a8a82">Add pickup areas first to enable time matrix editing.</div>`;
  }

  // Header per area · color band by zone
  const zoneBg = z => z==='PK'?'#E8F2FB':z==='KL'?'#FFF2E8':z==='RN'?'#F3EEFB':'#F0F0EC';   /* §rnZone */
  const zoneTxt = z => z==='PK'?'#185FA5':z==='KL'?'#A05A1A':z==='RN'?'#6A3FA0':'#5A5A52';
  const headers = tgs.map(tg => `<th style="background:${zoneBg(tg.zone)};color:${zoneTxt(tg.zone)}"><div class="psu-tg-head" style="color:${zoneTxt(tg.zone)}">${escapeHTML(tg.name)}<span class="psu-tg-head-sub" style="color:${zoneTxt(tg.zone)};opacity:.7">${escapeHTML(tg.region||tg.zone)}</span></div></th>`).join('');
  const rows = filteredRoutes.map(r => {
    // Coverage: count filled cells for this route in current profile (per-area now)
    const filled = tgs.filter(tg => profTimes?.[r.id]?.[tg.id]).length;
    const covPct = tgs.length > 0 ? Math.round(filled/tgs.length*100) : 0;
    const covColor = covPct >= 70 ? '#0F6E56' : covPct >= 30 ? '#A05A1A' : '#a32d2d';
    const covBg    = covPct >= 70 ? '#E1F5EE' : covPct >= 30 ? '#FFF2E0' : '#FDE7E7';
    const cells = tgs.map(tg => {
      const v = profTimes?.[r.id]?.[tg.id] || '';  // tg.id = areaId now
      const srcVal = cloneSrcTimes?.[r.id]?.[tg.id] || '';
      const isChanged = cloneSrc && v !== srcVal;
      const cellClass = v ? '' : 'empty';
      const cellStyle = isChanged ? 'background:#FFF2E0;color:#A05A1A;font-weight:700' : '';
      const title = isChanged ? `Changed from "${escapeHTML(srcVal||'(empty)')}" in ${escapeHTML(cloneSrc.name)}` : escapeHTML(`${r.name||r.id} × ${tg.name}`);
      return `<td><input class="psu-mat-cell ${cellClass}" type="text" placeholder="—" value="${escapeHTML(v)}" style="${cellStyle}" title="${title}" onblur="psuSetTimeCell('${r.id}','${tg.id}', this.value)"></td>`;
    }).join('');
    const rname = escapeHTML(r.name||r.id);
    const depTime = Array.isArray(r.times) && r.times.length ? r.times.join(' / ') : '—';
    const openBadge = !isOpen(r) ? `<span style="background:#FDE7E7;color:#a32d2d;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:700;letter-spacing:.06em;margin-left:4px">CLOSED</span>` : '';
    return `<tr>
      <td title="${rname}" style="overflow:hidden">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="psu-pier-tag" style="background:${pierBg(r.pier)};color:${pierColor(r.pier)}">${pierLabel(r.pier)}</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:#8a8a82">${escapeHTML(r.id)}</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:700;color:#1B2A55;background:#E8F2FB;padding:1px 5px;border-radius:3px">↗ ${escapeHTML(depTime)}</span>
          ${openBadge}
          <span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;color:${covColor};background:${covBg};padding:1px 6px;border-radius:3px" title="${filled} of ${tgs.length} time groups filled">${filled}/${tgs.length} · ${covPct}%</span>
        </div>
        <div style="font-size:11px;color:#1a1a1a;font-weight:600;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rname}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:4px">
          ${/* §rnZone · เดิมขึ้นปุ่ม PK+KL ทุกเส้นทางไม่ว่าจะออกจากท่าไหน
                เส้นระนองไม่มีทางรับที่ภูเก็ต การ์ดที่พิมพ์ออกมาจึงว่างเปล่า
                ผูกกับท่าของเส้นทางแทน · ท่าอื่นยังได้ PK+KL เหมือนเดิม */''}
          ${r.pier==='ranong'
            ? `<button onclick="psuOpenExport('${r.id}','RN')" title="Export Ranong pickup card" style="background:transparent;border:1px solid #cdbaf0;font-size:9px;font-weight:700;color:#6A3FA0;padding:2px 7px;border-radius:3px;cursor:pointer;font-family:inherit">↗ RN card</button>`
            : `<button onclick="psuOpenExport('${r.id}','PK')" title="Export Phuket pickup card" style="background:transparent;border:1px solid #f5c4b3;font-size:9px;font-weight:700;color:#e63946;padding:2px 7px;border-radius:3px;cursor:pointer;font-family:inherit">↗ PK card</button>
               <button onclick="psuOpenExport('${r.id}','KL')" title="Export Khao Lak pickup card" style="background:transparent;border:1px solid #b5d4f4;font-size:9px;font-weight:700;color:#185FA5;padding:2px 7px;border-radius:3px;cursor:pointer;font-family:inherit">↗ KL card</button>`}
        </div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  // Profile selector banner
  const profSelectorOpts = (SB_PICKUP_TIME_PROFILES||[]).map(p => {
    const isActiveNowOpt = p.from <= today && today >= p.from && today <= p.to;
    return `<option value="${p.id}" ${p.id===_psuActiveProfileId?'selected':''}>${escapeHTML(p.name)} · ${p.from} → ${p.to}${isActiveNowOpt?' · ACTIVE':''}</option>`;
  }).join('');
  const bannerBg = isActiveNow ? '#E1F5EE' : '#FFF6E5';
  const bannerBorder = isActiveNow ? '#B8E5D2' : '#EAD9B0';
  const bannerColor = isActiveNow ? '#0F6E56' : '#633806';
  const profBanner = `
    <div style="background:${bannerBg};border:1px solid ${bannerBorder};border-radius:5px;padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">
      <div style="font-size:18px;color:${bannerColor}">📅</div>
      <div style="flex:1">
        <div style="font-size:9px;color:${bannerColor};font-weight:700;letter-spacing:.1em;text-transform:uppercase">Editing profile ${isActiveNow ? '· active now' : ''}</div>
        <div style="font-size:13px;font-weight:700;color:${bannerColor};margin-top:2px">${escapeHTML(currentProf.name)} <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:500;margin-left:6px">${currentProf.from} → ${currentProf.to}</span></div>
        ${cloneSrc ? `<div style="font-size:10px;color:${bannerColor};margin-top:2px;font-style:italic">Cloned from "${escapeHTML(cloneSrc.name)}" · amber cells = changed from source</div>` : ''}
      </div>
      <select onchange="psuSetActiveProfile(this.value)" style="font-family:'DM Mono',monospace;font-size:11px;padding:6px 10px;border:1px solid ${bannerBorder};border-radius:4px;background:#fff;color:${bannerColor};font-weight:600">
        ${profSelectorOpts}
      </select>
    </div>
  `;

  return `
    <div class="psu-card">
      <div style="padding:14px 16px 0">${profBanner}</div>
      <div class="psu-toolbar" style="flex-wrap:wrap;gap:8px">
        <input class="psu-search" type="text" placeholder="Search routes..." value="${escapeHTML(_psuMatrixSearch)}" oninput="psuSetMatrixSearch(this.value)">
        <div style="display:flex;gap:5px">
          <button class="psu-zone-pill ${_psuMatrixPier==='all'?'on':''}" onclick="psuSetMatrixPier('all')">All piers</button>
          ${piersPresent.map(p => `<button class="psu-zone-pill ${_psuMatrixPier===p?'on':''}" onclick="psuSetMatrixPier('${p}')" style="${_psuMatrixPier===p?`background:${pierColor(p)};border-color:${pierColor(p)}`:''}">${pierLabel(p)} · ${pierCounts[p]}</button>`).join('')}
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#5A5A52;cursor:pointer;padding:4px 9px;background:${_psuMatrixHideClosed?'#FDE7E7':'#fff'};border:1px solid ${_psuMatrixHideClosed?'#F5B7B7':'rgba(0,0,0,.1)'};border-radius:14px;font-weight:600">
          <input type="checkbox" ${_psuMatrixHideClosed?'checked':''} onchange="psuToggleHideClosed()" style="accent-color:#a32d2d">
          Hide closed-season ${closedCount > 0 ? `<span style="color:#a32d2d">· ${closedCount}</span>` : ''}
        </label>
        <div style="flex:1"></div>
        <div style="font-size:11px;color:#8a8a82">${filteredRoutes.length} of ${allRoutes.length} routes &middot; ${tgs.length} time groups</div>
      </div>
      <div class="psu-mat-wrap">
        <table class="psu-mat">
          <thead><tr><th style="text-align:left">Route &middot; pier &middot; departure &middot; coverage</th>${headers}</tr></thead>
          <tbody>${rows || `<tr><td colspan="${tgs.length+1}" style="text-align:center;padding:30px;color:#8a8a82;font-style:italic">No routes match filter</td></tr>`}</tbody>
        </table>
      </div>
      <div style="padding:12px 16px;border-top:1px solid rgba(0,0,0,.06);background:#fafafa;font-size:10px;color:#8a8a82;line-height:1.5">
        <strong style="color:#5A5A52">Format:</strong> <code style="background:#fff;padding:1px 5px;border-radius:3px;border:1px solid rgba(0,0,0,.1);font-size:10px">07:00-07:15</code> · <code style="background:#fff;padding:1px 5px;border-radius:3px;border:1px solid rgba(0,0,0,.1);font-size:10px">Before 08:30 at pier</code> · empty to clear · click cell · type · Tab out to save (auto-saves to the profile above)<br>
        <strong style="color:#5A5A52">Coverage:</strong> <span style="color:#0F6E56">green ≥70%</span> · <span style="color:#A05A1A">amber 30-69%</span> · <span style="color:#a32d2d">red &lt;30%</span> · counts cells filled in this profile
        ${cloneSrc ? `<br><strong style="color:#A05A1A">Amber cells:</strong> changed from clone source "${escapeHTML(cloneSrc.name)}" · clear cell to revert` : ''}
      </div>
    </div>
  `;
}

function psuSetMatrixPier(p){ _psuMatrixPier = p; renderPickupSetup(); }
function psuToggleHideClosed(){ _psuMatrixHideClosed = !_psuMatrixHideClosed; renderPickupSetup(); }
function psuSetActiveProfile(pid){ _psuActiveProfileId = pid; renderPickupSetup(); }

function psuSetMatrixSearch(v){
  _psuMatrixSearch = v;
  renderPickupSetup();
  const inp = document.querySelector('.psu-search');
  if(inp){ inp.focus(); inp.setSelectionRange(v.length, v.length); }
}

function psuSetTimeCell(routeId, tgId, val){
  const v = (val||'').trim();
  const prof = (SB_PICKUP_TIME_PROFILES||[]).find(p => p.id === _psuActiveProfileId);
  if(!prof){ console.warn('[psuSetTimeCell] no active profile'); return; }
  if(!prof.times) prof.times = {};
  if(!prof.times[routeId]) prof.times[routeId] = {};
  if(v) prof.times[routeId][tgId] = v;
  else delete prof.times[routeId][tgId];
  psuPersist();
  // Don't re-render to keep cursor flow · cell already has the value
}

function psuOpenExport(routeId, zone){
  _psuExportRouteId = routeId;
  _psuExportZone = zone || 'PK';
  _psuExportProfileId = _psuActiveProfileId;
  renderPickupSetup();
}
function psuCloseExport(){
  _psuExportRouteId = null;
  renderPickupSetup();
}
function psuSetExportZone(z){ _psuExportZone = z; renderPickupSetup(); }
function psuSetExportProfile(pid){ _psuExportProfileId = pid; renderPickupSetup(); }

// Auto-group areas by same time (per route) · returns [{areas:[name1,name2], time}]
function psuGroupAreasByTime(routeId, zone, profileTimes){
  const areas = (SB_PICKUP_AREAS||[]).filter(a => a.zone === zone);
  // Sort by region first then name for natural ordering inside groups
  areas.sort((a,b) => (a.region||'').localeCompare(b.region||'') || (a.name||'').localeCompare(b.name||''));
  const groups = new Map();   // time → { areas:[], firstSeq }
  let seq = 0;
  areas.forEach(area => {
    const t = profileTimes?.[routeId]?.[area.id] || '';
    if(!t) return;
    if(!groups.has(t)) groups.set(t, { areas:[], firstSeq:seq });
    groups.get(t).areas.push(area.name);
    seq++;
  });
  // Sort groups by their earliest appearance order
  return [...groups.entries()]
    .map(([time, info]) => ({ time, areas: info.areas, firstSeq: info.firstSeq }))
    .sort((a,b) => a.firstSeq - b.firstSeq);
}

function psuRenderExportModal(){
  const r = (typeof ROUTES!=='undefined' ? ROUTES.find(x => x.id === _psuExportRouteId) : null);
  if(!r) return '';
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const prof = (SB_PICKUP_TIME_PROFILES||[]).find(p => p.id === _psuExportProfileId) || (SB_PICKUP_TIME_PROFILES||[])[0];
  if(!prof){ return ''; }

  const zone = _psuExportZone;
  const groups = psuGroupAreasByTime(r.id, zone, prof.times);
  // No Transfer time · look at nt-* areas matching pier
  const pierAreaId = r.pier === 'panwa' ? 'nt-panwa-pier' : r.pier === 'tublamu' ? 'nt-tublamu-pier' : null;
  const noTransferTime = pierAreaId ? (prof.times?.[r.id]?.[pierAreaId] || '') : '';

  const pierLabel = r.pier === 'tublamu' ? 'Tuplamu Pier' : r.pier === 'panwa' ? 'Visit Panwa Pier' : (r.pier || '—');
  const zoneLabel = zone === 'PK' ? 'PHUKET ZONE' : zone === 'KL' ? 'KHAO LAK ZONE' : 'PICKUP ZONE';
  const fromLabel = zone === 'PK' ? 'FROM PHUKET' : zone === 'KL' ? 'FROM KHAO LAK' : '';
  const depTime = (r.times && r.times[0]) || '—';
  const heroColor = r.color || '#185FA5';
  // Theme accent · Phuket = red · Khao Lak = navy blue
  const accent = zone === 'PK' ? '#e63946' : zone === 'KL' ? '#185FA5' : '#5A5A52';
  // Hero image · explicit route.heroImage > convention assets/hero/<id>.jpg > gradient fallback
  const heroImg = r.heroImage || `assets/hero/${r.id}.jpg`;
  const tagline = r.tagline || r.islands || '';

  // Available profiles for selector
  const profOpts = (SB_PICKUP_TIME_PROFILES||[]).map(p => `<option value="${p.id}" ${p.id===prof.id?'selected':''}>${escapeHTML(p.name)}</option>`).join('');

  return `
    <style>
      #view-pickup-setup .ex-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto}
      #view-pickup-setup .ex-wrap{display:flex;gap:14px;align-items:flex-start;width:fit-content;margin:0 auto}
      #view-pickup-setup .ex-sidebar{background:#fff;border-radius:8px;padding:16px;width:280px;box-shadow:0 8px 28px rgba(0,0,0,.18);position:sticky;top:0}
      #view-pickup-setup .ex-sidebar h3{font-size:13px;margin:0 0 12px;color:#1B2A55;font-weight:700}
      #view-pickup-setup .ex-side-row{margin-bottom:12px}
      #view-pickup-setup .ex-side-l{font-size:9px;color:#8a8a82;font-weight:700;letter-spacing:.1em;text-transform:uppercase;display:block;margin-bottom:5px}
      #view-pickup-setup .ex-zone-pills{display:flex;gap:5px}
      #view-pickup-setup .ex-zone-pill{flex:1;padding:7px 10px;font-size:11px;font-weight:600;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:5px;cursor:pointer;color:#5A5A52;font-family:inherit;text-align:center}
      #view-pickup-setup .ex-zone-pill.on{background:#1B2A55;color:#fff;border-color:#1B2A55}
      #view-pickup-setup .ex-card{background:#fff;border-radius:8px;width:560px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.18)}
      /* Marketing card · matches LOVE Andaman template */
      .pcard{font-family:'DM Sans',sans-serif;color:#1a1a1a;background:#fff;width:560px;min-height:740px;display:flex;flex-direction:column}
      .pcard .pc-hero{height:280px;position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:center}
      .pcard .pc-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}
      .pcard .pc-hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 100%)}
      .pcard .pc-logo-pill{position:absolute;top:10px;left:14px;background:#fff;border-radius:0 0 8px 8px;padding:10px 16px 8px;display:flex;flex-direction:column;align-items:center;line-height:1.1}
      .pcard .pc-logo-pill svg{height:22px;width:auto}
      .pcard .pc-logo-pill div{font-size:7px;color:#5A5A52;letter-spacing:.3em;margin-top:2px}
      .pcard .pc-title{position:relative;z-index:1;color:#fff;text-align:center;padding:0 24px 24px;width:100%}
      .pcard .pc-title h1{font-size:24px;font-weight:700;margin:0 0 4px;text-shadow:0 2px 6px rgba(0,0,0,.4);line-height:1.15}
      .pcard .pc-title p{font-size:12px;margin:0;opacity:.92;font-weight:500;text-shadow:0 1px 4px rgba(0,0,0,.4)}
      .pcard .pc-depbar{padding:14px 24px;background:#fff;text-align:center;position:relative}
      .pcard .pc-depbar .pc-pill{display:inline-block;background:#e63946;color:#fff;font-size:9px;font-weight:700;letter-spacing:.08em;padding:3px 12px;border-radius:14px;margin-bottom:6px;text-transform:uppercase}
      .pcard .pc-depbar h2{font-size:17px;font-weight:700;color:#1a1a1a;margin:0;letter-spacing:-.01em}
      .pcard .pc-depbar .pc-pier{font-size:11px;color:#5A5A52;font-weight:500;margin-top:2px}
      .pcard .pc-table-wrap{margin:0 18px 14px;background:#fff;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.06);overflow:hidden;flex:1}
      .pcard .pc-thead{display:grid;grid-template-columns:1fr 1fr;padding:11px 18px;border-bottom:1px solid rgba(0,0,0,.08);background:#fff}
      .pcard .pc-thead-col{font-size:11px;color:#185FA5;font-weight:700;letter-spacing:.04em;text-align:center;display:flex;align-items:center;justify-content:center;gap:5px}
      .pcard .pc-thead-col .pc-icon{font-size:12px}
      .pcard .pc-row{display:grid;grid-template-columns:1fr 1fr;padding:7px 18px;border-bottom:1px solid #f5f3ef;align-items:center}
      .pcard .pc-row:last-child{border-bottom:none}
      .pcard .pc-row-areas{font-size:11px;color:#1a1a1a;font-weight:500;line-height:1.3}
      .pcard .pc-row-time{font-size:11px;color:#1a1a1a;font-weight:500;text-align:center}
      .pcard .pc-row-nt .pc-row-time{color:#e63946;font-weight:700}
      .pcard .pc-note{padding:12px 18px 14px;background:#fff;border-top:1px solid #f5f3ef}
      .pcard .pc-note-badge{display:block;width:fit-content;margin:0 auto 8px;background:#f0a235;color:#fff;font-size:9px;font-weight:700;letter-spacing:.08em;padding:3px 14px;border-radius:3px}
      .pcard .pc-note-list{font-size:9px;color:#1a1a1a;line-height:1.5;list-style:decimal inside;padding:0;margin:0}
      .pcard .pc-note-list li{margin-bottom:3px}
      .pcard .pc-note-list li ul{font-size:9px;padding-left:14px;list-style:none;margin:1px 0}
      /* Print styling */
      @media print {
        body * { visibility: hidden; }
        body.psu-printing #psu-print-host, body.psu-printing #psu-print-host * { visibility: visible; }
        #psu-print-host {
          position: absolute; top: 0; left: 0; right: 0; width: 100%;
          padding: 18mm 8mm 0; margin: 0;
          display: flex; justify-content: center;
        }
        body.psu-printing #psu-print-host *, body.psu-printing #psu-print-host {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .pcard {
          width: 100%; max-width: 130mm; box-shadow: none; min-height: auto;
          page-break-inside: avoid; break-inside: avoid;
        }
        .pcard .pc-hero { height: 200px !important; }
        .pcard .pc-hero-bg { background-size: cover !important; background-position: center !important; }
        .pcard .pc-depbar { padding: 10px 18px !important; }
        .pcard .pc-table-wrap { margin: 0 14px 10px !important; }
        .pcard .pc-row { padding: 5px 16px !important; }
        .pcard .pc-note { padding: 10px 16px 12px !important; }
        .pcard .pc-note-list { font-size: 8px !important; }
        @page { size: A5 portrait; margin: 0; }
      }
    </style>
    <div class="ex-backdrop" onclick="if(event.target===this)psuCloseExport()">
      <div class="ex-wrap">
        <div class="ex-sidebar">
          <h3>Export pickup card</h3>
          <div class="ex-side-row">
            <span class="ex-side-l">Route</span>
            <div style="font-size:12px;font-weight:600;color:#1a1a1a">${escapeHTML(r.name)}</div>
            <div style="font-size:10px;color:#8a8a82;margin-top:2px;font-family:'DM Mono',monospace">${escapeHTML(r.id)} · ${escapeHTML(pierLabel)} · ↗ ${escapeHTML(depTime)}</div>
          </div>
          <div class="ex-side-row">
            <span class="ex-side-l">Pickup zone</span>
            <div class="ex-zone-pills">
              <button class="ex-zone-pill ${zone==='PK'?'on':''}" onclick="psuSetExportZone('PK')" style="${zone==='PK'?'background:#e63946;border-color:#e63946;color:#fff':''}">Phuket</button>
              <button class="ex-zone-pill ${zone==='KL'?'on':''}" onclick="psuSetExportZone('KL')" style="${zone==='KL'?'background:#185FA5;border-color:#185FA5;color:#fff':''}">Khao Lak</button>
              <button class="ex-zone-pill ${zone==='RN'?'on':''}" onclick="psuSetExportZone('RN')" style="${zone==='RN'?'background:#6A3FA0;border-color:#6A3FA0;color:#fff':''}">Ranong</button>
            </div>
          </div>
          <div class="ex-side-row">
            <span class="ex-side-l">Profile</span>
            <select onchange="psuSetExportProfile(this.value)" style="width:100%;font-size:11px;padding:6px 8px;border:1px solid rgba(0,0,0,.12);border-radius:4px;font-family:inherit">${profOpts}</select>
          </div>
          <div class="ex-side-row" style="margin-top:18px">
            <span class="ex-side-l">Stats</span>
            <div style="font-size:10px;color:#5A5A52;font-family:'DM Mono',monospace;line-height:1.6">
              ${groups.length} groups<br>
              ${groups.reduce((s,g)=>s+g.areas.length,0)} areas<br>
              ${noTransferTime ? 'NT: '+escapeHTML(noTransferTime) : 'No NT set'}
            </div>
          </div>
          ${(!r.heroImage)?`<div class="ex-side-row" style="background:#FFF6E5;border:1px solid #EAD9B0;border-radius:5px;padding:8px 10px;margin-top:14px">
            <div style="font-size:9px;font-weight:700;color:#A05A1A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">Hero image</div>
            <div style="font-size:10px;color:#633806;line-height:1.4">Using color gradient. To use a photo, save image to <code style="background:#fff;padding:1px 4px;border-radius:2px;font-size:9px">assets/hero/${r.id}.jpg</code> and set <code style="background:#fff;padding:1px 4px;border-radius:2px;font-size:9px">route.heroImage</code></div>
          </div>`:''}
          <div style="display:flex;gap:6px;margin-top:14px">
            <button class="psu-btn psu-btn-ghost" style="flex:1" onclick="psuCloseExport()">Close</button>
            <button class="psu-btn psu-btn-pri" style="flex:1" onclick="psuPrintExport()">Print / PDF</button>
          </div>
        </div>
        <div id="psu-print-host" class="ex-card">
          <div class="pcard">
            <div class="pc-hero">
              <div class="pc-hero-bg" style="background:linear-gradient(135deg, ${heroColor} 0%, ${heroColor}cc 50%, ${heroColor}99 100%)"></div>
              <div class="pc-hero-bg" style="background-image:url('${escapeHTML(heroImg)}');background-size:cover;background-position:center"></div>
            </div>
            <div class="pc-depbar">
              <span class="pc-pill" style="background:${accent}">Pick up time ${fromLabel}</span>
              <h2>Departure ${escapeHTML(depTime)}</h2>
              <div class="pc-pier">(${escapeHTML(pierLabel)})</div>
            </div>
            <div class="pc-table-wrap" style="border-top:3px solid ${accent}">
              <div class="pc-thead">
                <div class="pc-thead-col" style="color:${accent}"><span class="pc-icon">📍</span> ${zoneLabel}</div>
                <div class="pc-thead-col" style="color:${accent}"><span class="pc-icon">🕐</span> TIME</div>
              </div>
              ${groups.length === 0 ? `<div style="padding:30px;text-align:center;color:#8a8a82;font-style:italic;font-size:11px">No pickup times set for this route in ${zoneLabel}</div>` : ''}
              ${groups.map(g => `
                <div class="pc-row">
                  <div class="pc-row-areas">${escapeHTML(g.areas.join(', '))}</div>
                  <div class="pc-row-time">${escapeHTML(g.time)} a.m.</div>
                </div>
              `).join('')}
              ${noTransferTime ? `
                <div class="pc-row pc-row-nt">
                  <div class="pc-row-areas">No Transfer</div>
                  <div class="pc-row-time" style="color:${accent};font-weight:700">${escapeHTML(noTransferTime).replace(/^before/i,'Before')}${noTransferTime.toLowerCase().includes('pier')?'':' a.m.'}</div>
                </div>
              ` : ''}
            </div>
            <div class="pc-note">
              <span class="pc-note-badge">NOTE</span>
              <ol class="pc-note-list">
                <li>For joined transportations, customers should be on time and wait at the hotel lobby.<br><span style="margin-left:16px;display:inline-block;color:#5A5A52">Driver can wait only 10 minutes prior pick up time.</span></li>
                <li>We will confirm the pick up time 1 day prior the trip before 7 p.m.</li>
                <li>For Luggages bigger than 20 inches, customers should pay an additional fee 200 baht per piece.</li>
                <li>Please check your belongings before leaving the van. For returning your forgotten belonging will be charged.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function psuPrintExport(){
  // Detach print host to body for clean print (cascade visibility fix)
  const host = document.getElementById('psu-print-host');
  if(!host) return;
  const origParent = host.parentElement;
  const origNext = host.nextSibling;
  document.body.appendChild(host);
  document.body.classList.add('psu-printing');
  const restore = () => {
    document.body.classList.remove('psu-printing');
    if(origParent){ origParent.insertBefore(host, origNext); }
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  setTimeout(() => window.print(), 100);
}
// Effective zone of a vehicle on a date · honors temporary zone overrides ({zone,from,to})
function vehEffectiveZone(v, date){ if(!v) return null; const _dr=(typeof _vehDayRoutes==='function')?_vehDayRoutes(v,date):((v.dayRoute&&v.dayRoute[date])?[].concat(v.dayRoute[date]):[]); if(date && _dr.length){ for(const rid of _dr){ let z=(typeof _vehRouteZone==='function')?_vehRouteZone(rid):null; if(!z && typeof _vehFamZone==='function') z=_vehFamZone(rid); if(z) return z; } } if(date && v.dayZone && v.dayZone[date]) return v.dayZone[date]; if(date && Array.isArray(v.zoneOverrides)){ const o=v.zoneOverrides.find(o=>o.zone && (!o.from||date>=o.from) && (!o.to||date<=o.to)); if(o) return o.zone; } return v.zoneBase; }
// _vehUsableOn = active AND not หยุด/ซ่อม on that date (vehStatusOn: ''/'available' = OK · 'off'/'maintenance' = excluded from van pools)
function _vehUsableOn(v, date){ if(!v||!v.active) return false; const st=(typeof vehStatusOn==='function')?vehStatusOn(v,date):''; return st!=='off' && st!=='maintenance'; }
function vanVehiclesForZone(zone, date){ if(zone==='NoTransfer'||zone==='NT') return []; const z=(zone==='PK')?'PK':(zone==='KL')?'KL':null; return (SB_VEHICLES||[]).filter(v=>_vehUsableOn(v,date) && (!z || vehEffectiveZone(v,date)===z)); }
// Vans assigned to THIS program (route) that day via the month-matrix; if none assigned yet, fall back to all active vans in the zone
// Vans selectable for a route+date = ONLY those assigned to this route in the Transfer-Fleet month matrix (v.dayRoute[date]===routeId).
// (No zone fallback · per user: a van not assigned in the month matrix must NOT be pickable here — assign it in the matrix first.)
function vanVehiclesForRoute(date, routeId, zone){ return (SB_VEHICLES||[]).filter(v=>_vehUsableOn(v,date) && _vehDayRoutes(v,date).includes(routeId)); }
function vanJobsPickupThPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */  try{ const lsKey=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const d=JSON.parse(localStorage.getItem(lsKey)||'{}'); d.vanjob_pickup_th=VANJOB_PICKUP_TH; localStorage.setItem(lsKey,JSON.stringify(d)); }catch(_){} }
function vanJobsPickupThKey(name){ return String(name||'').trim(); }
function vanJobsGetPickupTh(name){ return VANJOB_PICKUP_TH[vanJobsPickupThKey(name)]||''; }
function vanJobsSetPickupTh(el){ const k=vanJobsPickupThKey(el.getAttribute('data-pk')); if(!k) return; const v=(el.value||'').trim(); if(v) VANJOB_PICKUP_TH[k]=v; else delete VANJOB_PICKUP_TH[k]; vanJobsPickupThPersist(); }   // save on input · NO re-render (keep focus)
function vanJobsSreqPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */  try{ const lsKey=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const d=JSON.parse(localStorage.getItem(lsKey)||'{}'); d.vanjob_sreq=VANJOB_SREQ; localStorage.setItem(lsKey,JSON.stringify(d)); }catch(_){} }
function vanJobsSreqAuto(b){ b=b||{}; return (b.notes||'').trim(); }   // Special request = the booking's Notes / Special Request field only
function vanJobsSreqFinal(b){ return (b && (b.id in VANJOB_SREQ)) ? VANJOB_SREQ[b.id] : vanJobsSreqAuto(b); }   // override (incl. '' = cleared) wins · else auto
function vanJobsSetSreq(el){ const id=el.getAttribute('data-bk'); if(!id) return; VANJOB_SREQ[id]=el.value; vanJobsSreqPersist(); }   // save on input (store '' too = deleted) · NO re-render
function vanJobsResetSreq(id){ if(id in VANJOB_SREQ) delete VANJOB_SREQ[id]; vanJobsSreqPersist(); renderVanJobs(); }   // back to auto
function vanJobsSentPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */  try{ const lsKey=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const d=JSON.parse(localStorage.getItem(lsKey)||'{}'); d.vanjob_sent=VANJOB_SENT; localStorage.setItem(lsKey,JSON.stringify(d)); }catch(_){} }
function vanJobsSentAt(date,key){ return VANJOB_SENT[date+'::'+key]||null; }
function vanJobsToggleSent(date,key){ const k=date+'::'+key; if(VANJOB_SENT[k]) delete VANJOB_SENT[k]; else VANJOB_SENT[k]=new Date().toISOString(); vanJobsSentPersist(); const sy=window.scrollY; renderVanJobs(); window.scrollTo(0,sy); }
function vanJobsSentLbl(iso){ if(!iso)return ''; const dt=new Date(iso); const th=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return dt.getDate()+' '+th[dt.getMonth()]+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0'); }
function vanJobsSentCellInner(date,key){ var s=vanJobsSentAt(date,key); return '<label onclick="event.stopPropagation()" style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer"><input type="checkbox" '+(s?'checked':'')+' onchange="event.stopPropagation();vanJobsToggleSent(\''+date+'\',\''+key+'\')" style="width:17px;height:17px;cursor:pointer;accent-color:#0F6E56"><span style="font-size:8.5px;'+(s?'color:#0F6E56;font-weight:700':'color:#c2c0b7')+';white-space:nowrap;margin-top:1px">'+(s?vanJobsSentLbl(s):'ยังไม่ส่ง')+'</span></label>'; }
/* ══ §vjRound · รถคันเดียววิ่งโปรแกรมเดิมได้หลายรอบใน 1 วัน ═══════════════════
   ของจริง: Love2 รับป่าตอง 07:30 · ส่งถึงท่า ~08:15 · แล้ววิ่งอีกรอบรับพันวา 08:20
   เพราะพันวาอยู่ติดท่าเรือ · สองรอบนั้นในระบบคือคนละ "กรุ๊ป" อยู่แล้วตั้งแต่ต้น
   จึงไม่มีข้อมูลใหม่ต้องเก็บเลย · ที่ขาดคือระบบอ่านไม่ออกว่ากรุ๊ปไหนของคันนี้
   คือรอบที่เท่าไหร่ พอถึงใบงานเลยรวมสองรอบเป็นก้อนเดียว คนขับได้ใบที่มีป่าตอง
   ปนพันวา ยอด 19 คนบนรถ 13 ที่นั่ง แล้วไม่รู้ว่าต้องกลับมาวิ่งอีกรอบ
   เรียงรอบตาม "เวลารับ" ไม่ใช่เลขกรุ๊ป · เลขกรุ๊ปคือลำดับที่คนจับกลุ่ม
   ไม่ใช่ลำดับที่รถวิ่งจริง (จับกรุ๊ป 5 ก่อนกรุ๊ป 1 ได้ตามใจคนจัด) */
function vjRoundAll(date){
  var A={};   /* "รถ~โปรแกรม" → { เลขกรุ๊ป: เวลารับที่เร็วที่สุดของกรุ๊ปนั้น } */
  try{
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b) return;
      /* ใบที่ยกเลิกแต่ยังจัดรถค้างไว้ ต้องนับเป็นรอบด้วย · ไม่งั้นลบใบสุดท้ายของรอบ 2
         แล้วรอบ 2 หายไปจากสารบบทั้งที่คนขับยังถือใบอยู่ */
      if(typeof ckIsCxl==='function' && ckIsCxl(b)
         && !(typeof ckHasArrange==='function' && ckHasArrange(b,date))) return;
      (b.trips||[]).forEach(function(t){
        if(!t || (t.date||'')!==date || t.ovnLeg) return;
        var o=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{}); if(!o) return;
        var tm=String((o&&o.pickupTimeFinal)||t.pickupTime||b.pickupTime||'').trim();
        var put=function(sv,sg){ var g=+sg||0; if(!sv||!g) return;
          var k=sv+'~'+(t.routeId||''); var m=A[k]||(A[k]={});
          if(!(g in m)) m[g]='';
          if(tm && (!m[g] || tm<m[g])) m[g]=tm; };
        if(Array.isArray(o.vanSplits)&&o.vanSplits.length) o.vanSplits.forEach(function(x){ if(x) put(x.vanId,x.vanGroup); });
        else put(o.vanId,o.vanGroup);
      });
    });
  }catch(_e){}
  return A;
}
/* คืน null เมื่อคันนี้วิ่งรอบเดียวในโปรแกรมนั้น
   null คือทางลัดสำคัญ · ทุกที่ที่เรียกจะแปลว่า "ไม่ต้องแสดงอะไรเพิ่ม"
   งานที่จัดไว้แล้วทั้งหมดจึงหน้าตาเหมือนเดิมทุกพิกเซล */
function vjRoundPick(m,g){
  if(!m) return null;
  var gs=Object.keys(m); if(gs.length<2) return null;
  gs.sort(function(a,b){ var ta=m[a]||'~~', tb=m[b]||'~~';
    if(ta!==tb) return ta<tb?-1:1; return (+a)-(+b); });
  var i=gs.indexOf(String(+g||0)); if(i<0) return null;
  return {no:i+1, tot:gs.length, tm:m[String(+g||0)]||'', all:gs,
          tms:gs.map(function(x){ return m[x]||''; })};
}
function vjRoundAllC(date){
  var k=String(date||'');
  if(_VJRA_C[k]) return _VJRA_C[k];
  var r=vjRoundAll(k); _VJRA_C[k]=r;
  /* ตารางเดือน Transfer Fleet ถามทีละวัน วนรถทุกคัน = ถามซ้ำวันละหลายสิบครั้ง
     เก็บทีละวันไว้ทั้งก้อน · ล้างทั้งก้อนทีเดียวท้าย tick */
  if(!_VJRA_T){ _VJRA_T=true;
    try{ Promise.resolve().then(function(){ _VJRA_C={}; _VJRA_T=false; }); }
    catch(_e){ _VJRA_C={}; _VJRA_T=false; }
  }
  return r;
}
/* จำนวนรอบที่รถคันนี้วิ่งโปรแกรมนี้ในวันนั้น · 0 = ยังไม่มีกรุ๊ป · 1 = รอบเดียว */
function vehDayRoundN(vid,date,rid){
  try{ var m=vjRoundAllC(date)[String(vid||'')+'~'+String(rid||'')];
       return m?Object.keys(m).length:0; }catch(_e){ return 0; }
}
function vjRoundOfC(date,vid,routeId,g){
  if(!vid||!g) return null;
  return vjRoundPick(vjRoundAllC(date)[String(vid)+'~'+String(routeId||'')], g);
}
function vjRoundOf(date,vid,routeId,g){
  if(!g) return null;
  return vjRoundPick(vjRoundAll(date)[String(vid||'')+'~'+String(routeId||'')], g);
}
/* ป้ายสั้น ๆ ที่ใช้ซ้ำทุกที่ · "รอบ 2 / 2" */
function vjRoundLbl(r){ return r?('รอบ '+r.no+' / '+r.tot):''; }
function vanJobsBookingsFor(date, vid, routeId, leg, grp){ const ret=leg==='ret'; const out=[]; const _G=+grp||0;
  (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return;
    const has=(b.trips||[]).some(t=>(t.date||'')===date && (!routeId||t.routeId===routeId)); if(!has)return;
    const o=bkOpsRead(b, date);                                                     // per-day van
    const sp=Array.isArray(o.vanSplits)&&o.vanSplits.length ? o.vanSplits : null;
    let inVan;
    if(ret){ inVan = sp ? sp.some(s=>s.vanReturnId===vid && s.vanReturnId!==s.vanId)
                        : (o.vanReturnId===vid && o.vanReturnId!==o.vanId); }
    /* §vjRound · ใบงานของรอบใดรอบหนึ่ง = เอาเฉพาะกรุ๊ปนั้น · ไม่ส่ง grp มา = ทั้งคัน (เหมือนเดิม) */
    else   { inVan = sp ? sp.some(s=>s.vanId===vid && (!_G || (+s.vanGroup||0)===_G))
                        : (o.vanId===vid && (!_G || (+o.vanGroup||0)===_G)); }
    if(inVan && !out.some(x=>x.id===b.id)) out.push(b); });
  return out; }
// §fit-to-page — 'พอดี' means the WHOLE sheet is visible: width AND height, no scrolling in either
// direction. Measure the sheet unzoomed, then scale it down to whatever fits the drawer. Never scale
// UP past 100% — that is what the + button is for.
function vjFit(){
  var pg=document.getElementById('vjo-page'); if(!pg) return;
  var box=pg.parentElement; if(!box) return;
  pg.style.zoom=1;                                     // measure at natural size
  var sw=Math.max(VJ_SHEET_MIN, pg.scrollWidth||0);
  var sh=pg.scrollHeight||0;
  var aw=(box.clientWidth||1000)-28, ah=(box.clientHeight||800)-28;   // minus the 14px padding on each side
  var z=Math.min(aw/sw, sh?(ah/sh):1);
  _vanJobsZoom=Math.max(0.3, Math.min(1, Math.floor(z*100)/100));
  vjApplyZoom();
}
function vjApplyZoom(){
  var pg=document.getElementById('vjo-page'); if(pg) pg.style.zoom=_vanJobsZoom;
  var lb=document.getElementById('vjo-zoom-lbl'); if(lb) lb.textContent=Math.round((_vanJobsZoom||1)*100)+'%';
}
function vjPrevW(){
  const saved=+(localStorage.getItem(VJ_W_KEY)||0);
  const max=Math.max(VJ_W_MIN, window.innerWidth-120);
  const dflt=Math.min(1420, Math.round(window.innerWidth*0.72));   // wide enough for the sheet at ~100%
  return Math.max(VJ_W_MIN, Math.min(saved||dflt, max));
}
function vjSetPrevW(px){
  const max=Math.max(VJ_W_MIN, window.innerWidth-120);
  const w=Math.max(VJ_W_MIN, Math.min(Math.round(px), max));
  localStorage.setItem(VJ_W_KEY, String(w));
  const d=document.getElementById('vjo-drawer'); if(d) d.style.width=w+'px';
  const l=document.getElementById('vjo-listwrap'); if(l) l.style.marginRight=(w+20)+'px';
  if(!_vjZoomManual) requestAnimationFrame(vjFit);   // widen the drawer → the sheet grows to match
  return w;
}
// drag the left edge to resize
function vjResizeStart(ev){
  ev.preventDefault();
  const startX=ev.clientX, startW=vjPrevW();
  const move=e=>vjSetPrevW(startW + (startX - e.clientX));
  const up=()=>{ document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up);
    document.body.style.cursor=''; document.body.style.userSelect=''; };
  document.body.style.cursor='col-resize'; document.body.style.userSelect='none';
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}
function vanJobsOpenPreview(key){ _vanJobsPreview=key; _vanJobsZoom=null; _vjZoomManual=false; renderVanJobs(); }   // re-fit for each van
function vanJobsClosePreview(){ _vanJobsPreview=null; renderVanJobs(); }
function vanJobsSetZoom(dir){ var pg=document.getElementById('vjo-page'); if(!pg) return; var cur=_vanJobsZoom||(parseFloat(pg.style.zoom)||1);
  if(dir==='fit'){ _vanJobsZoom=null; _vjZoomManual=false; renderVanJobs(); return; }
  if(dir==='in') cur=Math.min(1.6, Math.round((cur+0.1)*100)/100); else if(dir==='out') cur=Math.max(0.4, Math.round((cur-0.1)*100)/100);
  _vanJobsZoom=cur; _vjZoomManual=true; pg.style.zoom=cur; var lb=document.getElementById('vjo-zoom-lbl'); if(lb) lb.textContent=Math.round(cur*100)+'%';
}
function vanJobsOpenFull(key){ _vanJobsFull=key; _vanJobsPreview=null; renderVanJobs(); }
function vanJobsCloseFull(){ _vanJobsFull=null; renderVanJobs(); }
function vanJobsToggleExpand(vid){ if(_vanJobsExpand[vid]) delete _vanJobsExpand[vid]; else _vanJobsExpand[vid]=true; renderVanJobs(); }
function vanJobsDriverPersist(){ if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;   /* §edit-guard · ดูอย่างเดียว → ไม่ persist */  try{ const lsKey=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const d=JSON.parse(localStorage.getItem(lsKey)||'{}'); d.vanjob_driver=VANJOB_DRIVER; localStorage.setItem(lsKey,JSON.stringify(d)); }catch(_){} }
function vanJobsDriverInfo(vanId, date){ const v=(typeof vehGet==='function'?vehGet(vanId):null)||{}; const o=VANJOB_DRIVER[date+'::'+vanId]||null; const od=(o&&o.driver!=null&&String(o.driver).trim())?String(o.driver):''; const op=(o&&o.phone!=null&&String(o.phone).trim())?String(o.phone):''; const opl=(o&&o.plate!=null&&String(o.plate).trim())?String(o.plate):''; return { driver: od||v.driver||'', phone: op||v.driverPhone||'', plate: opl||v.plate||'', override: !!(od||op||opl), plateOverride: !!opl }; }
function vanJobsSetDriver(date, vanId, field, el){ const k=date+'::'+vanId; const cur=VANJOB_DRIVER[k]||{}; cur[field]=el.value; VANJOB_DRIVER[k]=cur; vanJobsDriverPersist(); }   // save on input · NO re-render (keep focus)
function vanJobsResetDriver(date, vanId){ delete VANJOB_DRIVER[date+'::'+vanId]; vanJobsDriverPersist(); renderVanJobs(); }
function vanJobsSetOwner(v){ _vanJobsOwner=v; renderVanJobs(); }
function vanJobsSetRoute(v){ _vanJobsRoute=v; renderVanJobs(); }
function vanJobsOwnerGroup(vid){ const ow=((typeof vehGet==='function'?vehGet(vid):null)||{}).ownership; return ow==='partner'?'partner':'company'; }
function vanJobsOwnerTag(vid){ const ow=((typeof vehGet==='function'?vehGet(vid):null)||{}).ownership; if(ow==='partner') return {t:'รถร่วม',bg:'#FBF0E0',c:'#9A5B00'}; if(ow==='rental'||ow==='charter') return {t:'เช่า',bg:'#EAF1FB',c:'#185FA5'}; return {t:'บริษัท',bg:'#E3F0EA',c:'#0F6E56'}; }
function vanJobsDateShift(delta){ const d=new Date(_vanJobsDate+'T12:00:00'); d.setDate(d.getDate()+delta); _vanJobsDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); renderVanJobs(); }
function vanJobsToday(){ _vanJobsDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10); renderVanJobs(); }
function vanJobsSetDate(ds){ if(!ds) return; _vanJobsDate=ds; renderVanJobs(); }   /* §laDatePick */
function vbPersist(){
  /* §vbEdit · ระหว่างแก้ไขยังไม่เขียนขึ้นเซิร์ฟเวอร์ · ไม่งั้นปุ่มยกเลิกจะไม่มีความหมาย
     เพราะของเดิมถูกทับไปแล้วตั้งแต่พิมพ์ตัวแรก */
  if(_vb.edit) return;
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('accounting')) return;
  try{ laBlob().van_bill=VAN_BILL; laBlobSave(); }catch(_){}
}
function vbMode(m){
  if(!vbLeave()) return;
  _vb.mode=m; _vb.open={}; _vb.foc=''; renderVanBill();
}
function vbOpenSup(sup){
  if(!vbLeave()) return;
  _vb.sup=String(sup||''); _vb.van=''; _vb.mode='one'; _vb.open={}; _vb.foc=''; renderVanBill();
}
/* ── §vbFill · ช่องที่ยังไม่เคยกรอก คีย์ได้เลย ──────────────────────────
   งานหลักของหน้านี้คือ "กรอกครั้งแรก" · บังคับให้กดแก้ไขก่อนทุกครั้งคือขวางงานหลัก
   สิ่งที่โหมดแก้ไขมีไว้กันจริง ๆ คือการเผลอทับตัวเลขที่ตกลงกับเจ้าของรถไปแล้ว
   → ช่องว่าง = กรอกได้ทันที บันทึกเลย · ช่องที่มีตัวเลขแล้ว = ต้องกดแก้ไขก่อน
   ช่องที่เพิ่งกรอกไปในรอบนี้ยังเปิดค้างไว้ พิมพ์ผิดตัวเดียวจะได้ไม่ต้องกดแก้ไขทั้งหน้า
   (_vb.open ล้างทุกครั้งที่เปลี่ยนรอบบิล / เข้าออกโหมดแก้ไข) */
function vbCanSet(cur, k){
  if(_vb.edit) return true;
  if(k && _vb.open[k]) return true;
  if(cur!=null && cur!=='' && +cur!==0) return false;
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return false;
  return true;
}
/* กรอกนอกโหมดแก้ไข = บันทึกทันที · ไม่มีปุ่มบันทึกให้กดในเส้นทางนี้ */
function vbStamp(k){
  if(_vb.edit) return;
  if(k){ _vb.open[k]=1; _vb.foc=k; }
  var st=vbState();
  st.by=(typeof laBy==='function')?laBy():''; st.at=new Date().toISOString();
  vbPersist();
}
/* ── โหมดแก้ไข ─────────────────────────────────────────────────────────
   ใบวางบิลเป็นเอกสารที่ส่งให้เจ้าของรถ · เผลอปัดโดนช่องแล้วตัวเลขเปลี่ยนทันที
   โดยไม่มีใครรู้ คือเรื่องใหญ่ · ปกติหน้านี้จึงอ่านอย่างเดียว ต้องกดแก้ไขก่อน */
function vbEdit(){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  _vb.snap=JSON.stringify(vbState());
  _vb.edit=1; _vb.open={}; _vb.foc=''; renderVanBill();
}
function vbSave(){
  _vb.edit=0; _vb.snap=null; _vb.open={}; _vb.foc='';
  var st=vbState();
  /* §vbSeen · กดบันทึก = ได้เห็นแถวชุดนี้แล้ว · เก็บไว้เทียบว่าคราวหน้ามีอะไรโผล่เพิ่ม
     เก็บเฉพาะตอนกดบันทึกจริง ไม่เก็บตอนพิมพ์ทีละช่อง (vbStamp)
     ไม่งั้นพิมพ์ช่องเดียวก็ปิดคำเตือนของแถวอื่นที่ยังไม่ได้ดูไปด้วย */
  try{ st.seen=vbRows().map(function(r){ return vbRowKey(r); }); }catch(_){}
  st.by=(typeof laBy==='function')?laBy():''; st.at=new Date().toISOString();
  vbPersist(); renderVanBill();
  if(typeof flShowToast==='function') flShowToast('บันทึกใบวางบิลแล้ว');
}
function vbCancel(quiet){
  if(!quiet && !confirm('ทิ้งที่แก้ไว้ กลับไปเป็นค่าที่บันทึกไว้ล่าสุด?')) return;
  if(_vb.snap){ try{ VAN_BILL[vbKey()]=JSON.parse(_vb.snap); }catch(_){} }
  _vb.edit=0; _vb.snap=null; _vb.open={}; _vb.foc=''; renderVanBill();
}
/* เปลี่ยนรอบบิล/เจ้าของรถระหว่างแก้ไข = ที่แก้ไว้ของรอบเดิมหลุด · ถามก่อน */
function vbLeave(){
  if(!_vb.edit) return true;
  if(!confirm('ยังไม่ได้บันทึก · ออกจากรอบบิลนี้แล้วที่แก้ไว้จะหาย · ไปต่อไหม')) return false;
  vbCancel(1); return true;
}
function vbCode(rid){ return VB_CODE[rid] || {c:'—', col:'#8B96A0'}; }
function vbPierOf(rid){ return String((((typeof getRoute==='function')?getRoute(rid):null)||{}).pier||''); }
/* §vbAreaTh · จุดรับใช้ตารางชื่อไทยตัวเดียวกับใบงานรถ (VANJOB_AREA_TH)
   เดิมหน้านี้มีตารางย่อของตัวเองแค่ 10 ชื่อ · จุดรับที่ไม่อยู่ในนั้นขึ้นเป็นภาษาอังกฤษ
   คอลัมน์เดียวกันเลยมีทั้งไทยและอังกฤษปนกัน (กมลา · Kalim · Phuket Town)
   มีตารางเดียวก็พอ · ชื่อใหม่เติมที่เดียวแล้วได้ทุกหน้า ไม่ต้องมาไล่เติมสองที่ */
function vbArea(a){
  var k=String(a||'').trim(); if(!k) return '';
  try{ if(typeof VANJOB_AREA_TH!=='undefined' && VANJOB_AREA_TH[k]) return VANJOB_AREA_TH[k]; }catch(_){}
  return k;
}
function vbShort(a, n){ a=String(a||''); n=n||20; return a.length>n ? (a.slice(0,n-1)+'…') : a; }
function vbIsFar(a){ return !!VB_FAR[String(a||'').trim().toLowerCase()] || !!VB_FAR[String(a||'').trim()]; }
function vbVans(){
  var V=(typeof SB_VEHICLES!=='undefined'&&Array.isArray(SB_VEHICLES))?SB_VEHICLES:
        ((typeof VEHICLES!=='undefined'&&Array.isArray(VEHICLES))?VEHICLES:[]);
  return V.filter(function(v){ return v && v.ownership==='partner'; });
}
function vbSuppliers(){
  var m={}; vbVans().forEach(function(v){ var n=String(v.partnerName||'').trim()||'(ไม่ระบุผู้ให้บริการ)'; m[n]=1; });
  return Object.keys(m).sort(function(a,b){ return a.localeCompare(b,'th'); });
}
function vbSupOf(v){ return String((v&&v.partnerName)||'').trim()||'(ไม่ระบุผู้ให้บริการ)'; }
function vbPeriod(){
  var ym=_vb.ym, y=+ym.slice(0,4), mo=+ym.slice(5,7);
  var last=new Date(y,mo,0).getDate();
  var a=(_vb.per===1)?1:(_vb.per===2?11:21), b=(_vb.per===1)?10:(_vb.per===2?20:last);
  var p=function(d){ return ym+'-'+String(d).padStart(2,'0'); };
  return {from:p(a), to:p(b), label:a+'–'+b, last:last};
}
/* §vbOv · คีย์ผูกกับ เจ้าของรถ + เดือน + งวด เท่านั้น · ไม่ผูกกับคันรถแล้ว
   ของเดิมเลือกคันไหนก็ได้ใบคนละใบ · ตัวเลือกคันคือ "ตัวกรองสำหรับดู" ไม่ใช่คนละบิล
   (บิลออกให้เจ้าของรถ ไม่ได้ออกรายคัน · แต่ละแถวบอกคันอยู่แล้ว)
   ถ้ายังผูกกับคัน หน้าภาพรวมจะรวมเลขไม่ได้ เพราะเงินกระจายอยู่หลายคีย์
   ⚠ บรรทัดเดิมตรงนี้เขียนว่า "หน้านี้เพิ่งเปิดใช้ ยังไม่มีใครกรอก" — ไม่จริงแล้ว
     ตรวจ backup_2026-09-14_1355: van_bill มี 14 ใบ · กรอกตัวเลขจริง 8 ใบ
     โดย AP.Petch กับ admin · ใบล่าสุด 2026-09-14 03:17
     เปลี่ยนรูปคีย์ตอนนี้ = ของที่กรอกไว้หลุดหายทั้งหมด เพราะอ่านด้วยคีย์ใหม่ไม่เจอ
     จะเปลี่ยนต้องเขียน migration ย้ายคีย์เก่ามาคีย์ใหม่ก่อน ไม่ใช่เปลี่ยนเฉย ๆ */
function vbKey(){ return _vb.sup+'|'+_vb.ym+'|'+_vb.per; }
function vbState(){
  var k=vbKey();
  if(!VAN_BILL[k]) VAN_BILL[k]={ perPax:0, rate:0, rows:{}, extra:[], by:'', at:'' };
  var st=VAN_BILL[k];
  if(!st.rows) st.rows={}; if(!Array.isArray(st.extra)) st.extra=[];
  return st;
}
/* §vbRateCode · เรตตั้งต้นของรหัสหนึ่ง · ไม่มีค่ารายรหัส ค่อยถอยไปใช้ st.rate ตัวเดิม
   (ของที่กรอกไว้ก่อนมีรหัสจึงยังใช้ได้ ไม่ต้องมาไล่กรอกใหม่) */
function vbRateOf(code, st){
  var C=st && st.rateC;
  if(C && C[code]!=null && C[code]!=='') return +C[code]||0;
  return +(st&&st.rate)||0;
}
/* รหัสที่มีงานจริงในรอบนี้ · เรียงตามจำนวนเที่ยว · รอบไหนมีรหัสเดียวก็เห็นช่องเดียว */
function vbCodesIn(rows){
  var m={}, out=[];
  (rows||[]).forEach(function(r){ var c=vbCode(r.routeId);
    if(!m[c.c]){ m[c.c]={c:c.c, col:c.col, n:0, rid:r.routeId}; out.push(m[c.c]); }
    m[c.c].n++; });
  out.sort(function(a,b){ return b.n-a.n; });
  return out;
}
/* ── §vbDrop · จุดส่ง (2026-09-22) ───────────────────────────────────────
   เรตต่อคันขึ้นกับ "รถวิ่งไปไหน" ไม่ใช่แค่ "รับที่ไหน" · ขากลับที่ส่งสนามบิน/เขาหลัก
   เป็นคนละระยะทางกับส่งกลับโรงแรมเดิม แต่บนใบวางบิลเดิมมองไม่เห็นเลย
   จุดส่งของ split เองมาก่อน (แยกส่งรายคน §altDrop) แล้วถอยไปใช้ของทั้งใบ
   ส่งที่เดิม = ไม่มีอะไรเก็บไว้ จึงถอยไปใช้จุดรับของแถวนั้นเป็นคำตอบ */
function vbAreaNm(id){
  if(!id || typeof bkV2GetArea!=='function') return '';
  return String((bkV2GetArea(id)||{}).name||'').trim();
}
function vbPickName(b, sp){ return (sp?vbAreaNm(sp.pickAreaId):'') || String((b&&b.pickupArea)||'').trim(); }
/* §vbDropWhy · คืนทั้งชื่อ และ "ใบนี้ตั้งจุดส่งใหม่จริงหรือเปล่า" มาด้วยกัน
   ที่มา (2026-09-22) · ของเดิมตัดสินสีตอนวาดด้วยการเทียบสตริงกับจุดรับของ "แถว"
   แต่แถวหนึ่งรวมหลายใบ · รถไปส่งกรุ๊ปหนึ่งแล้วรับอีกกรุ๊ปกลับ จุดส่งจึงเป็นของกรุ๊ปที่
   ไม่ได้อยู่ในแถวนั้นตั้งแต่แรก และแทบทุกครั้งก็คือ "ส่งที่เดิม" ของกรุ๊ปนั้นเอง
   วัดจาก backup_2026-09-17 เดือน ก.ย. · ชิป 24 ตัว ขึ้นม่วง 22 ตัว
   แต่ที่ลูกค้าตั้งจุดส่งใหม่จริงมีใบเดียว → ป้ายเตือนดังผิด 21 ครั้ง
   ตัวชี้ขาดต้องเป็นเจตนาบนใบ (bkDropOf บอกเองว่ามีจุดส่งของตัวเองไหม)
   ไม่ใช่ผลเทียบสตริงข้ามใบ · ชื่อยังขึ้นเหมือนเดิมทุกกรณี เพราะรถวิ่งไปที่นั่นจริง */
function vbDropInfo(b, sp){
  var d=(typeof bkDropOf==='function')?bkDropOf(b,sp):null;
  var nm=d ? (String(d.area||'').trim()||String(d.place||'').trim()) : '';
  var pk=vbPickName(b, sp);
  /* ตั้งจุดส่งใหม่ = ใบนี้ (หรือ split นี้) มีจุดส่งเก็บไว้ และไม่ใช่ที่เดียวกับที่รับของใบนั้นเอง
     ส่งที่เดิม → bkDropOf คืนค่าว่าง → ถอยไปใช้จุดรับของใบนั้น และไม่นับว่าเปลี่ยน */
  return { nm:(nm||pk), chg:(!!nm && nm!==pk) };
}
function vbDropName(b, sp){ return vbDropInfo(b, sp).nm; }
/* §vbRetLeg · แถวขากลับเก็บเรตคนละช่องกับขาไป · เรตไป-กลับไม่จำเป็นต้องเท่ากัน */
function vbRowKey(r){ return r.date+'~'+r.routeId+'~'+r.vanId+(r.ret?'~R':''); }
/* อ่านอย่างเดียว · ห้ามสร้างระเบียนเปล่า ไม่งั้นแค่เปิดดูภาพรวมก็เกิดใบเปล่าทุกเจ้าทุกงวด */
function vbStateOf(k){
  var st=VAN_BILL[k];
  return st ? st : { perPax:0, rate:0, rows:{}, extra:[], by:'', at:'' };
}
/* ── ดึงงานจริงจากใบจอง · หนึ่งแถว = หนึ่งวัน หนึ่งเส้นทาง หนึ่งคัน ── */
function vbRows(){
  var P=vbPeriod(), vans=vbVans().filter(function(v){
    return vbSupOf(v)===_vb.sup && (!_vb.van || v.id===_vb.van); });
  var ok={}; vans.forEach(function(v){ ok[v.id]=v; });
  var map={}, pendRet=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    (b.trips||[]).forEach(function(t){
      var ds=t.date||''; if(ds<P.from || ds>P.to) return;
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,ds):(b.ops||{});
      /* §vbPaxReal · ราคาขายคิดจากคนที่ขึ้นรถจริง ไม่ใช่ยอดจอง
         แหล่งเดียวกับใบงานเรือและทะเบียนรายชื่อ (ckPaxLeft) เลขสามใบจึงตรงกันเสมอ
         ⚠ แถวยังต้องอยู่แม้คนเหลือ 0 · รถออกไปแล้วและเจ้าของรถยังวางบิลตามปกติ
           ตัดแถวทิ้งเมื่อไหร่ = พลาดรถที่ต้องจ่ายจริง */
      var pb=(typeof ckPaxBreak==='function')?ckPaxBreak(t.pax):{ad:0,chd:0,inf:0,foc:0};
      var RL=function(kk,v){ return (typeof ckPaxLeft==='function')?ckPaxLeft(b,ds,kk,v):v; };
      var real={ad:RL('ad',pb.ad||0), chd:RL('chd',pb.chd||0),
                inf:RL('inf',pb.inf||0), foc:RL('foc',pb.foc||0)};
      var bkN=(pb.ad||0)+(pb.chd||0)+(pb.inf||0)+(pb.foc||0);
      var rlN=real.ad+real.chd+real.inf+real.foc;
      /* รถหลายคันในใบเดียว · แยกตามที่จัดไว้ */
      var legs=(Array.isArray(O.vanSplits)&&O.vanSplits.length)
        ? O.vanSplits.map(function(x){ return {vid:x.vanId, pax:+x.pax||0, sp:x}; })
        : [{vid:O.vanId, pax:null, sp:null}];
      /* คนที่ไม่ได้ไปเป็นของทั้งใบ ระบุไม่ได้ว่าหายจากคันไหน · เกลี่ยตามสัดส่วนที่จัดไว้
         แล้วโยนเศษให้คันสุดท้าย ผลรวมของทุกคันจะได้เท่ากับยอดจริงของใบเป๊ะ */
      if(legs.length && legs[0].pax!=null){
        var tb=0; legs.forEach(function(x){ tb+=(+x.pax||0); });
        var used=0;
        legs.forEach(function(x,i){
          x.real=(i===legs.length-1) ? Math.max(0, rlN-used)
                                     : ((tb>0)?Math.round((+x.pax||0)*rlN/tb):0);
          used+=x.real;
        });
      }
      legs.forEach(function(L){
        if(!L.vid || !ok[L.vid]) return;
        var k=ds+'~'+(t.routeId||'')+'~'+L.vid;
        if(!map[k]) map[k]={date:ds, routeId:t.routeId||'', vanId:L.vid,
                            ad:0,chd:0,inf:0,foc:0, pax:0, bkPax:0, bk:0, retSame:0, areas:{}, drops:{}};
        var r=map[k];
        if(L.pax!=null){ r.pax+=(+L.real||0); r.ad+=(+L.real||0); r.bkPax+=L.pax; }
        else {
          r.ad+=real.ad; r.chd+=real.chd; r.inf+=real.inf; r.foc+=real.foc;
          r.pax+=rlN; r.bkPax+=bkN;
        }
        r.bk++;
        var a=vbPickName(b, L.sp); if(a) r.areas[a]=1;
        /* §vbSameVan · "กลับคันเดิม" คือทางกลับทางที่สอง · bkV2SetReturnSameVan เคลียร์
           vanReturnId ทิ้งตอนติ๊ก (บรรทัด ~7599) ของเดิมจึงอ่านไม่เจอเลยสักใบ
           ทั้งที่คอมเมนต์ที่ bkV2VanAlert เขียนไว้เองว่ากรณีนี้คือ "รถขาไปพากลับ · ส่งจุดใหม่"
           วัดจาก backup_2026-09-17 ทั้งไฟล์ · ติ๊กกลับคันเดิม 10 leg · เป็นส่งจุดใหม่จริง 9
           ทั้งสิบขึ้น "—" มาตลอด = เงียบตรงเคสที่คอลัมน์นี้ถูกสร้างมาจับพอดี
           ⚠ ไม่แตะ pax / retPax / จำนวนคัน · รถคันเดิม รอบเดิม ใบเดิม ยอดเรียกเก็บต้องไม่ขยับ
             นับแยกที่ retSame ไว้ติดป้ายอย่างเดียว ไม่ใช่ retBk ซึ่งแปลว่ารับกลับให้ใบอื่น */
        var rsv=(L.sp && L.sp.returnSameVan!=null) ? !!L.sp.returnSameVan : !!O.returnSameVan;
        if(rsv){
          var ds2=vbDropInfo(b, L.sp);
          r.retSame=(r.retSame||0)+1;
          if(ds2.nm) r.drops[ds2.nm]=(r.drops[ds2.nm]||0)|(ds2.chg?1:0);
        }
      });
      /* §vbRetLeg · ขากลับคือรถอีกเที่ยวหนึ่ง · ของเดิมอ่านแต่ ops.vanId
         เจ้าของรถที่รับเฉพาะขากลับจึงไม่เคยขึ้นบิลเลยสักแถว
         (วัดจาก backup_2026-09-14: ตกไป 22 เที่ยว · งวด 11-20 ก.ย. ภูเก็ตล่ำซำ ตก 4)
         ⚠ pax=0 โดยตั้งใจ · เป็นลูกค้ากลุ่มเดิมที่ขายไปแล้วตอนขาไป
           ใส่ pax เมื่อไหร่ ราคาขาย/กำไรเด้งเป็นสองเท่าทันที · คนจริงเก็บไว้ที่ retPax ไว้โชว์เฉย ๆ
         returnSameVan (กลับคันเดิม) ไม่มี vanReturnId อยู่แล้ว จึงไม่เกิดแถวซ้ำที่นี่
         · ทางนั้นไปจบที่ §vbSameVan ข้างบน ซึ่งแปะจุดส่งลงแถวขาไปของคันเดิมโดยไม่เพิ่มแถว */
      var rlegs=(Array.isArray(O.vanSplits)&&O.vanSplits.length)
        ? O.vanSplits.map(function(x){ return {vid:x.vanReturnId, sp:x}; })
        : [{vid:O.vanReturnId, sp:null}];
      rlegs.forEach(function(R){
        if(!R.vid || !ok[R.vid]) return;
        /* พักไว้ก่อน · ตอนนี้ยังไม่รู้ว่าคันนี้มีขาไปในวันเดียวกันหรือเปล่า
           (ใบที่จัดขาไปอาจมาทีหลังในลูป) */
        var di=vbDropInfo(b, R.sp);
        pendRet.push({ds:ds, rid:t.routeId||'', vid:R.vid, pax:rlN, drop:di.nm, chg:di.chg});
      });
    });
  });
  /* §vbRetMerge · รถคันเดียววิ่งไปส่งแล้ววิ่งกลับ = เที่ยวเดียว ไม่ใช่สองเที่ยว
     ของเดิม (§vbRetLeg รอบแรก) แยกแถวขากลับเสมอ · คันที่ไปส่งกรุ๊ปหนึ่งแล้วรับอีกกรุ๊ปกลับ
     จึงถูกนับเป็น 2 คัน ทั้งที่รถวิ่งรอบเดียว = เรียกเก็บซ้ำ
     วัด 2026-09-14: คีย์ขากลับ 13 · ซ้ำกับขาไป 9 · เป็นคันที่ไม่มีขาไปเลยจริง ๆ แค่ 4
     → มีขาไปอยู่แล้ว = เอาคนกลับไปแปะแถวเดิม ไม่เพิ่มคัน
       ไม่มีขาไป = คันนั้นมารับกลับอย่างเดียว ต้องมีแถวของตัวเอง (เช่น VAN3 14/9) */
  pendRet.forEach(function(x){
    var base=x.ds+'~'+x.rid+'~'+x.vid;
    if(map[base]){ map[base].retPax=(map[base].retPax||0)+x.pax; map[base].retBk=(map[base].retBk||0)+1;
                   if(x.drop) map[base].drops[x.drop]=(map[base].drops[x.drop]||0)|(x.chg?1:0); return; }
    var k=base+'~R';
    if(!map[k]) map[k]={date:x.ds, routeId:x.rid, vanId:x.vid, ret:1,
                        ad:0,chd:0,inf:0,foc:0, pax:0, bkPax:0, retPax:0, bk:0, areas:{}, drops:{}};
    map[k].retPax+=x.pax; map[k].bk++;
    if(x.drop) map[k].drops[x.drop]=(map[k].drops[x.drop]||0)|(x.chg?1:0);
  });
  return Object.keys(map).sort().map(function(k){ return map[k]; });
}
function vbSet(field,val){
  var st=vbState(), k='@'+field;
  if(!vbCanSet(st[field], k)) return;
  st[field]=Math.max(0, parseFloat(String(val).replace(/[^0-9.]/g,''))||0);
  vbStamp(k); renderVanBill();
}
function vbSetRateC(code, val){
  var st=vbState(), k='@rate:'+code;
  if(!st.rateC) st.rateC={};
  if(!vbCanSet(st.rateC[code], k)) return;
  st.rateC[code]=Math.max(0, parseFloat(String(val).replace(/[^0-9.]/g,''))||0);
  vbStamp(k); renderVanBill();
}
/* §vbRateCode · เติมเรตจากที่ตั้งไว้ในหน้า Transfer Fleet (van_rates)
   ไม่ผูกกันอัตโนมัติ · กดเองเมื่ออยากใช้ แล้วแก้ทับได้
   เหตุผลที่ไม่ผูก: van_rates เป็นค่าที่ตั้งไว้ล่วงหน้า ส่วนใบวางบิลคือที่ตกลงกันจริงในรอบนั้น
   วันไหนสองอันไม่ตรงกัน ใบวางบิลต้องชนะเสมอ ไม่ใช่โดนเรตกลางเขียนทับเงียบ ๆ */
function vbPullRates(){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  if(typeof vanRate!=='function'){ alert('ยังไม่มีตารางเรตรถในระบบ'); return; }
  var st=vbState(), rows=vbRows(), codes=vbCodesIn(rows);
  var vans=vbVans().filter(function(v){ return vbSupOf(v)===_vb.sup; });
  var gk=(typeof vanGroupKey==='function' && vans[0]) ? vanGroupKey(vans[0]) : ('p:'+_vb.sup);
  var zone=String((vans[0]||{}).zoneBase||'PK');
  if(!st.rateC) st.rateC={};
  var got=[], none=[], gen=[];
  codes.forEach(function(C){
    /* หาเรตจากเส้นทางที่มีงานจริงของรหัสนั้น · เจอตัวแรกที่ไม่เป็นศูนย์ก็พอ */
    var v=0, spec=false;
    rows.forEach(function(r){ if(v||vbCode(r.routeId).c!==C.c) return;
      var x=+vanRate(gk, r.routeId, zone)||0; if(!(x>0)) return;
      v=x;
      /* ตั้งไว้เจาะจงเส้นทางนี้จริง หรือหล่นมาใช้เรตกลางของเจ้านี้ (base)
         ต่างกันมาก · สิมิลันวิ่งไกลกว่าพีพีเกือบเท่าตัว ถ้าเงียบไว้จะเรียกเก็บต่ำไปโดยไม่รู้ตัว */
      if(typeof vanRateRaw==='function'){
        var q=vanRateRaw(gk, r.routeId, zone);
        spec = (q!=='' && q!=null && +q>0);
      }
    });
    if(v>0){ st.rateC[C.c]=v; _vb.open['@rate:'+C.c]=1;
      got.push(C.c+' '+v.toLocaleString()+(spec?'':' *'));
      if(!spec) gen.push(C.c);
    } else none.push(C.c);
  });
  if(!got.length){ alert('ยังไม่ได้ตั้งเรตของ "'+_vb.sup+'" ไว้ในหน้า Transfer Fleet'); return; }
  vbStamp('');
  renderVanBill();
  var msg='ดึงเรตมาแล้ว · '+got.join(' · ')
    +(none.length?(' · ยังไม่มีเรตของ '+none.join(', ')):'')
    +(gen.length?(' · * '+gen.join(', ')+' ยังไม่ได้ตั้งเรตของเส้นทางนี้ ใช้เรตกลางของเจ้านี้ไปก่อน — ตรวจก่อนวางบิล'):'');
  if(typeof flShowToast==='function') flShowToast(msg); else console.warn(msg);
}
function vbSetRow(rk, field, val){
  var st=vbState(), k=rk+'|'+field;
  if(!vbCanSet((st.rows[rk]||{})[field], k)) return;
  if(!st.rows[rk]) st.rows[rk]={};
  /* §vbMinus · ช่องหักแสดงเป็นลบ · ตัดเครื่องหมายทิ้งแล้วเก็บเป็นบวก
     พิมพ์ "-100" หรือ "100" ได้ค่าเดียวกัน ไม่ต้องมาลุ้นว่าต้องใส่ลบไหม */
  st.rows[rk][field]=Math.max(0, parseFloat(String(val).replace(/[^0-9.]/g,''))||0);
  vbStamp(k); renderVanBill();
}
function vbAddExtra(){
  if(!_vb.edit && typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  var st=vbState(); var P=vbPeriod();
  var id='x'+Date.now().toString(36);
  st.extra.push({id:id, date:P.from, note:'รถนอก', van:1, pax:0, rate:0, ex:0, cut:0, per:0});
  /* แถวที่เพิ่งเพิ่มมีค่าเริ่มต้นอยู่แล้ว · ถ้าไม่เปิดไว้จะล็อกทันทีที่เพิ่ม แก้อะไรไม่ได้เลย */
  ['date','note','van','pax','rate','ex','cut','per'].forEach(function(f){ _vb.open['x'+id+'|'+f]=1; });
  vbStamp(''); renderVanBill();
}
function vbSetExtra(id, field, val){
  var st=vbState(), r=st.extra.filter(function(x){ return x.id===id; })[0]; if(!r) return;
  var k='x'+id+'|'+field;
  if(!vbCanSet(r[field], k)) return;
  r[field]=(field==='date'||field==='note')?String(val):Math.max(0, parseFloat(String(val).replace(/[^0-9.]/g,''))||0);
  vbStamp(k); renderVanBill();
}
function vbDelExtra(id){
  if(!_vb.edit) return;
  var st=vbState(); st.extra=st.extra.filter(function(x){ return x.id!==id; });
  renderVanBill();
}
function vbPick(field,val){
  if(!vbLeave()){ renderVanBill(); return; }
  /* §vbFill · ออกจากรอบบิลนี้แล้ว ช่องที่เพิ่งกรอกไปต้องกลับไปล็อก
     ไม่งั้นเดินออกไปงวดอื่นแล้วกลับมา ยังพิมพ์ทับตัวเลขที่บันทึกแล้วได้อยู่ */
  _vb.open={}; _vb.foc='';
  _vb[field]=(field==='per')?(+val||1):val; if(field==='sup') _vb.van=''; renderVanBill();
}
function vbShiftMonth(n){
  if(!vbLeave()) return;
  _vb.open={}; _vb.foc='';
  var y=+_vb.ym.slice(0,4), m=+_vb.ym.slice(5,7)-1+n, d=new Date(y,m,1);
  _vb.ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); renderVanBill();
}
/* ── §vbOv · ยอดของทุกเจ้าในงวดเดียวกัน ────────────────────────────────
   ยืม vbRows() ตัวเดิมมาใช้ โดยสลับ _vb.sup ชั่วคราวแล้วคืนค่าเมื่อจบ
   เขียนตัวรวมแยกอีกตัวก็ได้ แต่วันไหนกติกาการดึงงานเปลี่ยน สองที่จะเพี้ยนไม่ตรงกัน */
/* §vbCalc · การ์ดสรุปเดิมบอกแค่ยอดรวมกับ "3 คัน · 21 คน" · คนวางบิลอ่านแล้วยังต้อง
   เปิดใบรายเจ้าไปไล่เองว่ายอดนี้มาจากเรตเท่าไร คูณกี่คัน
   เรตในรอบเดียวกันไม่จำเป็นต้องเท่ากัน (แก้รายแถวได้) จึงจับกลุ่มตามเรตแล้วต่อกันด้วย +
   คันที่ยังไม่ใส่เรตแยกออกมาบอกต่างหาก · เอาไปรวมเป็น "฿0 × n" จะอ่านเหมือนคิดเงินศูนย์บาท */
/* §vbMix · extra กับหักเป็นของ "รายคัน" ไม่ใช่ก้อนเดียวของทั้งรหัส
   คนวางบิลเขียนกันแบบนี้:  1,500 + 300 = 1,800 × 3 คัน = 5,400
   จึงต้องจับกลุ่มด้วยชุด (เรต, extra, หัก) ที่เหมือนกันทั้งชุด แล้วคูณจำนวนคันของกลุ่มนั้น
   จับกลุ่มด้วยเรตอย่างเดียวไม่พอ · คันที่เรตเท่ากันแต่ extra ต่างกันคือคนละราคาต่อคัน */
function _vbN(v){ return Math.round(+v||0).toLocaleString('en-US'); }
function vbCalcHtml(g, B){
  var M=(g&&g.mix)||{}, L=[];
  Object.keys(M).forEach(function(k){ L.push(M[k]); });
  /* กลุ่มที่มีคันเยอะสุดขึ้นก่อน · เท่ากันค่อยเรียงด้วยราคาต่อคันจากมากไปน้อย */
  L.sort(function(a,b){ return (b.n-a.n) || ((b.rate+b.ex-b.cut)-(a.rate+a.ex-a.cut)); });
  var rows='', tv=0, tb=0, zero=0, MAXL=6, more=0, moreN=0, moreB=0;
  L.forEach(function(x, i){
    tv+=x.n;
    if(!(x.rate>0) && !x.ex && !x.cut){ zero+=x.n; return; }
    var per=x.rate+x.ex-x.cut, amt=per*x.n;
    tb+=amt;
    if(rows.split('class="ln"').length-1 >= MAXL){ more++; moreN+=x.n; moreB+=amt; return; }
    var f=_vbN(x.rate);
    if(x.ex)  f+=' + '+_vbN(x.ex);
    if(x.cut) f+=' − '+_vbN(x.cut);
    if(x.ex||x.cut) f+=' = '+_vbN(per);
    rows+='<div class="ln"><span class="f">'+f+'</span>'
        +'<span class="x">× '+x.n+'</span>'
        +'<span class="a">'+B(amt)+'</span></div>';
  });
  if(more) rows+='<div class="ln o"><span class="f">อีก '+more+' แบบ</span>'
      +'<span class="x">× '+moreN+'</span><span class="a">'+B(moreB)+'</span></div>';
  if(zero) rows+='<div class="ln z"><span class="f">ยังไม่ใส่เรต</span>'
      +'<span class="x">× '+zero+'</span><span class="a">—</span></div>';
  if(!rows) return '';
  return '<div class="vb-mix">'+rows
    +'<div class="ln t"><span class="f">รวม</span><span class="x">'+tv+' คัน</span>'
    +'<span class="a">'+B(tb)+'</span></div></div>';
}
function vbAgg(){
  var keepS=_vb.sup, keepV=_vb.van;
  _vb.van='';
  var out=[];
  try{
    vbSuppliers().forEach(function(sup){
      _vb.sup=sup;
      var rows=vbRows(), st=vbStateOf(vbKey());
      var g={ sup:sup, vans:vbVans().filter(function(v){ return vbSupOf(v)===sup; }),
              trips:0, pax:0, bkPax:0, miss:0, bill:0, sale:0, ex:0, cut:0, code:{} };
      var take=function(rate,ex,cut,per,pax,rid,n){
        g.trips+=n; g.pax+=pax; g.ex+=ex; g.cut+=cut;
        /* "ยังไม่ได้กรอก" = ยังไม่มีเรต · ไม่มีเรตคือยังไม่มีตัวเลขจะเรียกเก็บ
           กรอก EXTRA ไปแล้วแต่ยังไม่มีเรต ก็ยังถือว่าไม่ครบ */
        if(!(rate>0)) g.miss+=n;
        var bill=n*rate+ex-cut;
        g.bill+=bill; g.sale+=pax*per;
        if(rid!=null){ var c=vbCode(rid);
          /* §vbCalc · เก็บเรตไว้ด้วย เพื่อประกอบข้อความ "เรต × คัน" ที่การ์ดสรุป */
          if(!g.code[c.c]) g.code[c.c]={van:0,pax:0,bill:0,ex:0,cut:0,mix:{},col:c.col};
          var C=g.code[c.c];
          C.van+=n; C.pax+=pax; C.bill+=bill; C.ex+=ex; C.cut+=cut;
          /* §vbMix · คีย์คือชุดตัวเลขทั้งชุด ไม่ใช่เรตอย่างเดียว */
          if(n>0){ var mk=rate+'|'+ex+'|'+cut;
            if(!C.mix[mk]) C.mix[mk]={rate:rate, ex:ex, cut:cut, n:0};
            C.mix[mk].n+=n; } }
      };
      rows.forEach(function(r){
        var m=(st.rows||{})[vbRowKey(r)]||{};
        g.bkPax+=(+r.bkPax||0);
        take((m.rate!=null?m.rate:vbRateOf(vbCode(r.routeId).c, st))||0, +m.ex||0, +m.cut||0,
             (m.per!=null?m.per:st.perPax)||0, r.pax, r.routeId, 1);
      });
      (st.extra||[]).forEach(function(x){
        g.bkPax+=(+x.pax||0);
        take(+x.rate||0, +x.ex||0, +x.cut||0, +x.per||0, +x.pax||0, null, +x.van||0);
      });
      if(g.trips>0) out.push(g);
    });
  } finally { _vb.sup=keepS; _vb.van=keepV; }
  out.sort(function(a,b){ return (b.trips-a.trips) || String(a.sup).localeCompare(String(b.sup),'th'); });
  return out;
}
/* แถบสลับ ภาพรวม / รายเจ้า · ใช้ร่วมกันสองหน้า */
function vbModeTabs(){
  return '<span class="vb-mode">'
    +'<button class="'+(_vb.mode==='ov'?'on':'')+'" onclick="vbMode(\'ov\')">ภาพรวม</button>'
    +'<button class="'+(_vb.mode==='ov'?'':'on')+'" onclick="vbMode(\'one\')">รายเจ้า</button></span>';
}
function vbRenderOv(host){
  var e=(typeof ckEsc==='function')?ckEsc:function(x){ return String(x==null?'':x); };
  var P=vbPeriod(), G=vbAgg();
  var B=function(n){ n=Math.round(n||0); return (n<0?'−฿':'฿')+Math.abs(n).toLocaleString(); };
  var mLbl=new Date(+_vb.ym.slice(0,4), +_vb.ym.slice(5,7)-1, 1).toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  var segBtn=function(n,l){ return '<button onclick="vbPick(\'per\','+n+')" class="vb-seg'+(_vb.per===n?' on':'')+'">'+l+'</button>'; };

  var T={vans:0,trips:0,pax:0,bkPax:0,bill:0,sale:0,miss:0,ex:0,cut:0}, byCode={};
  G.forEach(function(g){
    T.vans+=g.vans.length; T.trips+=g.trips; T.pax+=g.pax; T.bkPax+=(+g.bkPax||0); T.bill+=g.bill;
    T.sale+=g.sale; T.miss+=g.miss; T.ex+=g.ex; T.cut+=g.cut;
    Object.keys(g.code).forEach(function(c){ var x=g.code[c];
      if(!byCode[c]) byCode[c]={van:0,pax:0,bill:0,ex:0,cut:0,mix:{},col:x.col};
      var Y=byCode[c];
      Y.van+=x.van; Y.pax+=x.pax; Y.bill+=x.bill; Y.ex+=(+x.ex||0); Y.cut+=(+x.cut||0);
      Object.keys(x.mix||{}).forEach(function(k){ var m=x.mix[k];
        if(!Y.mix[k]) Y.mix[k]={rate:m.rate, ex:m.ex, cut:m.cut, n:0};
        Y.mix[k].n+=m.n; }); });
  });
  var done=G.filter(function(g){ return g.miss===0; }).length;
  var pl=T.sale-T.bill, avg=T.trips?(T.pax/T.trips):0;

  var body=G.map(function(g){
    /* ยังไม่แตะเลย ช่องเงินขึ้นเป็นจุด ไม่ใช่ ฿0 · ศูนย์บาทจริงกับยังไม่ได้กรอกเป็นคนละเรื่อง
       ถ้าขึ้น ฿0 เหมือนกันหมด จะแยกไม่ออกว่าเจ้าไหนกรอกแล้วได้ศูนย์ เจ้าไหนยังไม่เริ่ม */
    var none=(g.miss===g.trips);
    var M=function(v){ return none?'<span class="vb-mut">·</span>':B(v); };
    var pill = (g.miss===0) ? '<span class="vb-pill ok">&#10003; กรอกครบ</span>'
      : (none ? '<span class="vb-pill none">ยังไม่เริ่ม · '+g.trips+' รายการ</span>'
              : '<span class="vb-pill part">ขาด '+g.miss+' รายการ</span>');
    var gp=g.sale-g.bill;
    return '<tr class="vb-clk" data-sup="'+e(g.sup)+'" onclick="vbOpenSup(this.dataset.sup)">'
     +'<td class="l"><span class="vb-av">'+e(String(g.sup).slice(0,6))+'</span>'
       +'<span class="vb-supn">'+e(g.sup)+'</span>'
       +'<div class="vb-supm">'+e(g.vans.map(function(v){ return v.name||v.id; }).join(' · ')||'—')+'</div></td>'
     +'<td><b>'+g.vans.length+'</b></td><td><b>'+g.trips+'</b></td>'
     +'<td><b>'+g.pax+'</b>'+((g.bkPax>g.pax)
        ? ('<div class="vb-cxl" title="ใบจองรวม '+g.bkPax+' คน · ไม่ได้ขึ้นรถ '+(g.bkPax-g.pax)+' คน">จอง '+g.bkPax+' · −'+(g.bkPax-g.pax)+'</div>')
        : '')+'</td>'
     +'<td>'+(g.trips?(g.pax/g.trips).toFixed(2):'0.00')+'</td>'
     +'<td class="r"><b>'+M(g.bill)+'</b></td><td class="r">'+M(g.sale)+'</td>'
     +'<td class="r" style="font-weight:800;color:'+(none?'#B6BCC3':(gp<0?'#A32D2D':'#0F6E56'))+'">'+M(gp)+'</td>'
     +'<td>'+pill+'</td><td class="vb-go">&rsaquo;</td></tr>';
  }).join('');

  var codeCards=['PP','PB','MT'].map(function(c){
    var g=byCode[c]||{van:0,pax:0,bill:0,ex:0,cut:0,mix:{},col:(c==='PP'?'#C0392B':c==='PB'?'#1C7A4E':'#BA7517')};
    return '<div class="vb-sb"><div class="t"><span class="vb-lg" style="background:'+g.col+'"></span>'+c+'</div>'
      +'<div class="b">'+B(g.bill)+'</div><div class="s">'+(g.van?(g.van+' คัน · '+g.pax+' คน'):'ไม่มีงานรอบนี้')+'</div>'
      /* §vbMix · ที่มาของยอด · โผล่เฉพาะรหัสที่มีงานจริงในรอบนี้ */
      +(g.van?vbCalcHtml(g,B):'')+'</div>';
  }).join('');

  host.innerHTML=vbCss()
   +'<div class="vb">'
   +'<div class="vb-h1">&#128656; วางบิลรถร่วม · Van Supplier Billing</div>'
   +'<div class="vb-sub2"><span class="vb-k1">พื้นขาว = ระบบดึงให้เอง</span> &nbsp;·&nbsp; '
     +'<span class="vb-k2">ช่องเส้นประฟ้า = กรอกเอง</span> &nbsp;·&nbsp; '
     +'<span style="color:#98A2AD">ภาพรวมทุกเจ้าในรอบบิลนี้ · กดที่แถวเพื่อเปิดใบของเจ้านั้น · '
       +'ยอดคน = คนที่ขึ้นรถจริง</span></div>'
   +'<div class="vb-bar">'+vbModeTabs()
   +'<span class="vb-segwrap">'+segBtn(1,'1–10')+segBtn(2,'11–20')+segBtn(3,'21–สิ้นเดือน')+'</span>'
   +'<span class="vb-mo"><button onclick="vbShiftMonth(-1)">&lsaquo;</button><b>'+e(mLbl)+'</b><button onclick="vbShiftMonth(1)">&rsaquo;</button></span>'
   +'<span style="flex:1"></span>'
   +'<button class="vb-btn pri" onclick="vbPrint()">&#128424; พิมพ์สรุปรอบบิล</button></div>'
   +'<div class="vb-kpi">'
     +'<div class="k"><div class="l">เจ้าของรถ</div><div class="v">'+G.length+' <s>เจ้า</s></div></div>'
     +'<div class="k"><div class="l">เที่ยวรวม</div><div class="v">'+T.trips+' <s>คัน</s></div></div>'
     +'<div class="k"><div class="l">ลูกค้ารวม</div><div class="v">'+T.pax+' <s>คน</s></div></div>'
     +'<div class="k bill"><div class="l">ราคาเรียกเก็บ</div><div class="v">'+B(T.bill)+'</div></div>'
     +'<div class="k '+(pl<0?'loss':'gain')+'"><div class="l">กำไร / ขาดทุน</div><div class="v">'+B(pl)+'</div></div>'
     +'<div class="k '+(T.miss?'todo':'')+'"><div class="l">ยังไม่ได้กรอก</div>'
       +'<div class="v">'+(T.miss?(T.miss+' <s>รายการ</s>'):'&#10003; <s>ครบแล้ว</s>')+'</div></div>'
   +'</div>'
   +'<div class="vb-card"><table class="vb-t vb-ovt"><thead><tr>'
     +'<th class="l" style="min-width:230px">เจ้าของรถ</th>'
     +'<th style="width:60px">รถ</th><th style="width:70px">เที่ยว</th><th style="width:70px">คน</th>'
     +'<th style="width:86px">เฉลี่ย</th><th style="width:108px">ราคาเรียกเก็บ</th>'
     +'<th style="width:98px">ราคาขาย</th><th style="width:108px">กำไร/ขาดทุน</th>'
     +'<th style="width:136px">สถานะการกรอก</th><th style="width:40px"></th></tr></thead>'
   +'<tbody>'+(body||'<tr><td colspan="10" style="padding:26px;text-align:center;color:#98A2AD">ไม่มีงานรถร่วมในรอบบิลนี้</td></tr>')+'</tbody>'
   +'<tfoot><tr><td class="l">รวม '+G.length+' เจ้า</td>'
     +'<td>'+T.vans+'</td><td>'+T.trips+'</td>'
     +'<td>'+T.pax+(T.bkPax>T.pax?('<div class="vb-cxl" style="color:#FFD79A">จอง '+T.bkPax+' · −'+(T.bkPax-T.pax)+'</div>'):'')+'</td>'
     +'<td>'+avg.toFixed(2)+'</td>'
     +'<td class="r">'+B(T.bill)+'</td><td class="r">'+B(T.sale)+'</td>'
     +'<td class="r" style="color:'+(pl<0?'#FF9E9E':'#9BE6BC')+'">'+B(pl)+'</td>'
     +'<td colspan="2" style="color:'+(T.miss?'#FFD79A':'#9BE6BC')+'">'
       +(T.miss?('ยังไม่ได้กรอก '+T.miss+' รายการ'):'กรอกครบทุกเจ้า')+'</td></tr></tfoot></table></div>'
   +'<div class="vb-sum">'+codeCards
     +'<div class="vb-sb"><div class="t">EXTRA − หัก</div><div class="b">'+B(T.ex-T.cut)+'</div>'
       +'<div class="s">extra +'+T.ex+' · หัก <b style="color:#A32D2D">'+(T.cut>0?('−'+T.cut.toLocaleString()):'0')+'</b></div>'
       +'<div class="s2">'+B(T.ex)+'  −  '+B(T.cut)+'  =  '+B(T.ex-T.cut)+'</div></div>'
     /* §vbCalc · ยอดรวมต้องอ่านออกว่าประกอบจากอะไร · ค่ารถล้วน + extra − หัก */
     +'<div class="vb-sb dark"><div class="t">รวมเรียกเก็บ</div><div class="b">'+B(T.bill)+'</div>'
       +'<div class="s">'+done+' เจ้าครบแล้ว · '+(G.length-done)+' เจ้ายังไม่ครบ</div>'
       +'<div class="s2">ค่ารถ '+B(T.bill-T.ex+T.cut)+'  +  extra '+B(T.ex)
         +'  −  หัก '+B(T.cut)+'  =  '+B(T.bill)+'</div></div>'
   +'</div></div>';
}
function vbPrint(){
  var el=document.getElementById('vanbill-host'); if(!el) return;
  var w=window.open('','_blank'); if(!w) return;
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบวางบิลรถร่วม</title>'
    +'<style>@page{size:A4 landscape;margin:8mm}body{font-family:Sarabun,sans-serif;margin:0}'
    +'.vb-bar,.vb-set,.vb-btn,.vb-segwrap,.vb-mo,.vb-dirty,select,input[type=date]{display:none!important}'
    +'.vb-ro{border:0!important;padding:0!important}'
    +'input{border:0!important;background:transparent!important;padding:0!important;text-align:right}'
    +'</style></head><body>'+el.innerHTML+'</body></html>');
  w.document.close(); w.focus(); setTimeout(function(){ try{ w.print(); }catch(_){} }, 400);
}
function vbCss(){
  return '<style>'
  /* §vbGrey · พื้นหลังเทาเต็มพื้นที่เหมือนหน้า P&L รายทริป · การ์ดขาวจะได้ลอยขึ้นมา
     .main มี padding ที่ถูก !important ทับในหลาย breakpoint · ระบายที่ .main ด้วย :has()
     เบราว์เซอร์ที่ไม่รู้จัก :has() จะได้เทาเฉพาะในกรอบ view ซึ่งยังดูได้ ไม่พัง */
  +'.main:has(#view-vanbill.active){background:#F3F4F8}'
  +'#view-vanbill{background:#F3F4F8;min-height:calc(100vh - 120px)}'
  +'.vb{padding:16px 18px 60px;font-family:Sarabun,"DM Sans","Noto Sans Thai",sans-serif;color:#1A1A1A}'
  +'.vb-h1{font-size:19px;font-weight:800;margin-bottom:3px}'
  +'.vb-sub2{font-size:12px;color:#6B7280;margin-bottom:14px}'
  +'.vb-k1{border-bottom:2px solid #DDE1E9}.vb-k2{border-bottom:2px dashed #9EC4E4;color:#0E6AA8}'
  +'.vb-bar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:12px}'
  +'.vb-sel{border:1px solid #DDE1E9;background:#fff;border-radius:11px;padding:8px 12px;font:700 12.5px inherit;color:#16265C;font-family:inherit}'
  +'.vb-segwrap{display:flex;background:#EAEDF3;border-radius:11px;padding:3px}'
  +'.vb-seg{border:none;background:transparent;border-radius:9px;padding:6px 13px;font:600 12px inherit;color:#6B7280;cursor:pointer;font-family:inherit}'
  +'.vb-seg.on{background:#16265C;color:#fff;font-weight:700}'
  +'.vb-mo{display:flex;align-items:center;gap:3px;border:1px solid #DDE1E9;background:#fff;border-radius:11px;padding:4px 6px}'
  +'.vb-mo b{font-size:12.5px;padding:0 6px}'
  +'.vb-mo button{border:none;background:#EFF1F6;border-radius:8px;width:24px;height:26px;cursor:pointer;color:#6b7280;font-size:14px;font-family:inherit}'
  +'.vb-btn{border:1px solid #DDE1E9;background:#fff;border-radius:11px;padding:8px 14px;font:600 12.5px inherit;color:#3F4654;cursor:pointer;font-family:inherit}'
  +'.vb-btn.pri{background:#16265C;border-color:#16265C;color:#fff;font-weight:700}'
  +'.vb-newrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 10px;padding:9px 12px;border:1px solid #F0C98A;background:#FFF8EC;border-radius:10px;font-size:12px;color:#7A4E00;line-height:1.5}.vb-newrow span{font-size:11px;color:#946515}.vb-newrow span.m{flex-basis:100%;color:#8A6A2F}.vb-who{display:flex;align-items:center;gap:12px;background:#FFFFFF;border:1px solid #E4E7EE;border-radius:13px;padding:11px 15px;margin-bottom:12px}'
  +'.vb-who .av{min-width:44px;height:38px;padding:0 8px;border-radius:11px;background:#16265C;color:#fff;display:flex;align-items:center;justify-content:center;font:800 11px "DM Mono",monospace;flex:none}'
  +'.vb-who .n{font-size:14px;font-weight:800}.vb-who .m{font-size:11.5px;color:#6B7280;margin-top:2px;font-family:"DM Mono",monospace}'
  +'.vb-lab{font-size:10px;font-weight:800;letter-spacing:.06em;color:#A9AFB6;text-transform:uppercase}'
  +'.vb-set{display:flex;align-items:center;gap:9px;background:#F2F7FC;border:1px solid #CFE2F2;border-radius:12px;padding:9px 15px;margin-bottom:13px;font-size:12.5px;color:#0E6AA8}'
  +'.vb-set b{color:#0B4F7E}.vb-hint{color:#5C86A8}'
  +'.vb-kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin-bottom:13px}'
  +'.vb-kpi .k{background:#fff;border:1px solid #E4E7EE;border-radius:13px;padding:11px 13px}'
  +'.vb-kpi .l{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A9AFB6}'
  +'.vb-kpi .v{font-size:21px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums;line-height:1.1}'
  +'.vb-kpi .v s{text-decoration:none;font-size:11px;font-weight:600;color:#9AA0A6}'
  +'.vb-kpi .k.bill{background:#16265C;border-color:#16265C}.vb-kpi .k.bill .l{color:#9FB3D8}.vb-kpi .k.bill .v{color:#fff}'
  +'.vb-kpi .k.loss{background:#FFF6F5;border-color:#F2D2CC}.vb-kpi .k.loss .v{color:#A32D2D}'
  +'.vb-kpi .k.gain .v{color:#0F6E56}'
  +'.vb-card{background:#fff;border:1px solid #E4E7EE;border-radius:16px;overflow-x:auto}'
  +'.vb-t{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}'
  +'.vb-t th{font:700 9.5px "DM Sans",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#8B96A0;padding:7px 8px;text-align:center;background:#F7F8FB;border-bottom:1px solid #E4E7EE;white-space:nowrap}'
  +'.vb-t th.l{text-align:left}.vb-t th.man{background:#F2F7FC;color:#0E6AA8}'
  +'.vb-t td{padding:7px 8px;border-bottom:1px solid #EDEFF4;text-align:center;font-variant-numeric:tabular-nums}'
  +'.vb-t td.l{text-align:left}.vb-t td.r{text-align:right}'
  +'.vb-mono{font-family:"DM Mono",monospace;font-weight:700}'
  +'.vb-code{display:inline-block;font:800 10px "DM Mono",monospace;border-radius:6px;padding:2px 7px;margin-right:6px;color:#fff}'
  +'.vb-rn{font-size:11.5px;color:#4A5058}'
  +'.vb-area{display:inline-block;font-size:10.5px;font-weight:700;background:#F1F4F7;color:#6B7280;border:1px solid #E1E5EA;border-radius:7px;padding:2px 8px;margin:1px 3px 1px 0;white-space:nowrap}'
  +'.vb-area.far{background:#FBF3E6;color:#8A5B00;border-color:#EEDCBE}'
  +'.vb-area.alt{background:#F3EDFB;color:#5B289A;border-color:#E0D3F2}'
  +'.vb-sub{font-size:9.5px;color:#9AA0A6;font-weight:500}'
  +'.vb-mut{color:#B6BCC3}'
  +'.vb-t tr.vb-ex td{background:#F8FAFD}'
  +'.vb-din,.vb-tin{border:1px dashed #9EC4E4;background:#F8FCFF;border-radius:7px;padding:4px 7px;font:600 11.5px inherit;color:#0B4F7E;font-family:inherit}'
  +'.vb-tin{width:100%}'
  +'.vb-t tfoot td{background:#16265C;color:#fff;font-weight:800;border:0;padding:10px 8px}'
  +'.vb-t tfoot td.l{color:#9FB3D8;font-size:10px;letter-spacing:.05em;text-transform:uppercase}'
  +'.vb-sum{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:13px}'
  +'.vb-sb{border:1px solid #E4E7EE;border-radius:12px;padding:10px 13px;background:#FFFFFF}'
  +'.vb-sb .t{font-size:10px;font-weight:800;letter-spacing:.05em;color:#8B96A0;text-transform:uppercase}'
  +'.vb-sb .b{font-size:16px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}'
  +'.vb-sb .s{font-size:11px;color:#6B7280;margin-top:2px}'
  /* §vbCalc · บรรทัดที่มาของยอด · เล็กกว่าบรรทัดสรุป แต่ตัวเลขต้องกว้างเท่ากันเพื่อไล่สายตา */
  +'.vb-sb .s2{font-size:10.5px;color:#98A2AD;margin-top:4px;line-height:1.6;'
    +'font-variant-numeric:tabular-nums;border-top:1px dashed #E4E7EE;padding-top:5px}'
  /* §vbMix · ตารางที่มาของยอด · หนึ่งบรรทัดต่อหนึ่งราคาต่อคัน แล้วปิดท้ายด้วยแถวรวม */
  +'.vb-sb .vb-mix{margin-top:5px;border-top:1px dashed #E4E7EE;padding-top:5px;'
    +'font-size:10.5px;font-variant-numeric:tabular-nums}'
  +'.vb-mix .ln{display:flex;align-items:baseline;gap:7px;padding:1.5px 0;color:#6B7280}'
  +'.vb-mix .ln .f{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.vb-mix .ln .x{flex:none;color:#A6AFBA}'
  +'.vb-mix .ln .a{flex:none;min-width:58px;text-align:right;font-weight:700;color:#3E4756}'
  +'.vb-mix .ln.z,.vb-mix .ln.z .a{color:#B6BCC3;font-weight:500}'
  +'.vb-mix .ln.o{color:#98A2AD}'
  +'.vb-mix .ln.t{border-top:1px solid #EDEFF3;margin-top:3px;padding-top:4px;'
    +'font-weight:800;color:#16265C}'
  +'.vb-mix .ln.t .a{color:#16265C}'
  +'.vb-mix .ln.t .x{color:#5B6B86;font-weight:700}'
  +'.vb-sb.dark{background:#16265C;border-color:#16265C}.vb-sb.dark .t,.vb-sb.dark .s{color:#9FB3D8}.vb-sb.dark .b{color:#fff}'
  +'.vb-sb.dark .s2{color:#B9C9E6;border-top-color:rgba(255,255,255,.16)}'
  +'.vb-lg{display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:5px}'
  /* §vbEdit · ช่องกรอกกับช่องอ่านอย่างเดียวต้องกินที่เท่ากัน ตารางจะได้ไม่ขยับตอนสลับโหมด */
  +'.vb-in{border:1px dashed #9EC4E4;background:#F8FCFF;border-radius:7px;padding:4px 7px;'
    +'text-align:right;font:700 12px "DM Mono",monospace;color:#0B4F7E;font-family:"DM Mono",monospace}'
  +'.vb-in.neg{border-color:#E8B4B4;background:#FFF8F8;color:#A32D2D}'
  +'.vb-ro{display:inline-block;text-align:right;font:700 12px "DM Mono",monospace;'
    +'color:#3F4654;padding:4px 7px;border:1px solid transparent}'
  +'.vb-ro.neg{color:#A32D2D}.vb-ro.mut{color:#C2C7CE;font-weight:600}'
  +'.vb-btn.ok{background:#0F6E56;border-color:#0F6E56;color:#fff;font-weight:700}'
  +'.vb-dirty{font-size:11.5px;font-weight:700;color:#8A5B00;background:#FBF3E6;'
    +'border:1px solid #EEDCBE;border-radius:9px;padding:6px 11px}'
  /* §vbOv · หน้าภาพรวม */
  +'.vb-mode{display:flex;background:#EAEDF3;border-radius:11px;padding:3px;margin-right:4px}'
  +'.vb-mode button{border:none;background:transparent;border-radius:9px;padding:6px 15px;'
    +'font:700 12px inherit;color:#6B7280;cursor:pointer;font-family:inherit}'
  +'.vb-mode button.on{background:#fff;color:#16265C;box-shadow:0 1px 3px rgba(22,38,92,.14)}'
  +'.vb-kpi .k.todo{background:#FFF9EF;border-color:#EFD9AE}'
  +'.vb-kpi .k.todo .l{color:#B98A2A}.vb-kpi .k.todo .v{color:#8A5B00}'
  +'.vb-ovt td{padding:10px 8px}'
  +'.vb-clk{cursor:pointer}.vb-clk:hover td{background:#F7FAFE}'
  +'.vb-av{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:26px;'
    +'padding:0 8px;border-radius:8px;background:#16265C;color:#fff;font:800 10px "DM Mono",monospace;'
    +'margin-right:9px;vertical-align:middle}'
  +'.vb-supn{font-size:13px;font-weight:800;vertical-align:middle}'
  +'.vb-supm{font-size:10.5px;color:#98A2AD;margin-top:2px;margin-left:43px}'
  +'.vb-pill{display:inline-block;font-size:10.5px;font-weight:800;border-radius:999px;padding:3px 11px;white-space:nowrap}'
  +'.vb-pill.ok{background:#E3F0EA;color:#0F6E56}'
  +'.vb-pill.part{background:#FBF3E6;color:#8A5B00}'
  +'.vb-pill.none{background:#EEF0F4;color:#8B96A0}'
  +'.vb-go{color:#0E6AA8;font-weight:800;font-size:15px}'
  /* §vbRateCode · ช่องเรตรายรหัส + ป้ายท่าเรือ */
  +'.vb-rt{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #CFE2F2;'
    +'border-radius:9px;padding:3px 5px 3px 3px;margin-left:5px}'
  +'.vb-rt .c{display:inline-block;font:800 10px "DM Mono",monospace;border-radius:6px;padding:3px 7px;color:#fff}'
  +'.vb-rt .vb-in,.vb-rt .vb-ro{border-radius:6px;padding:3px 6px}'
  +'.vb-btn.sm{padding:5px 11px;font-size:11.5px;margin-left:7px;border-color:#CFE2F2;color:#0E6AA8}'
  +'.vb-pier{display:inline-block;font-size:9.5px;font-weight:800;border-radius:6px;padding:2px 7px;margin-left:6px}'
  +'.vb-cxl{font-size:9px;font-weight:700;color:#B98A2A;margin-top:1px;white-space:nowrap;line-height:1.2}'
  +'</style>';
}
function vjTpl(){
  if(_VJT_DRAFT) return _VJT_DRAFT;
  var raw='';
  try{ var b=laBlob(); raw=(typeof b.vanjob_tpl==='string')?b.vanjob_tpl:''; }catch(_){ raw=''; }
  if(_VJT===null || _VJT_SRC!==raw){
    var o={}; if(raw){ try{ o=JSON.parse(raw)||{}; }catch(_){ o={}; } }
    var out={}; for(var k in VJT_DEF){ out[k]=(o[k]===undefined||o[k]===null||o[k]==='')?VJT_DEF[k]:o[k]; }
    /* กันค่าพังจากการแก้มือ · ขนาดตัวอักษรต้องอยู่ในช่วงที่ยังพิมพ์ออกมาอ่านได้ */
    for(var n in VJT_NUM){ var v=+out[n]; if(!isFinite(v)) v=VJT_DEF[n];
      out[n]=Math.max(VJT_NUM[n][0], Math.min(VJT_NUM[n][1], v)); }
    _VJT=out; _VJT_SRC=raw;
  }
  return _VJT;
}
function vjTplSave(T){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){ alert('ดูอย่างเดียว · แก้ไม่ได้'); return false; }
  try{
    var keep={}; for(var k in VJT_DEF){ if(String(T[k])!==String(VJT_DEF[k])) keep[k]=T[k]; }
    var b=laBlob();
    if(Object.keys(keep).length){ var str=JSON.stringify(keep); b.vanjob_tpl=str; _VJT_SRC=str; }
    else { delete b.vanjob_tpl; _VJT_SRC=''; }
    _VJT=null; laBlobSave(); return true;
  }catch(e){ try{ console.warn('[vjTpl] save failed', e&&e.message); }catch(_){} return false; }
}
/* ── ไล่เฉดจากสีเดียว · ใช้ตัวเดียวกับที่ใบงานใช้อยู่แล้ว ── */
function vjtT(c,t){ return (typeof vjTint==='function')?vjTint(c,t):c; }
function vjtD(c,p){ return (typeof vjShade==='function')?vjShade(c,p):c; }
/* ── ตัวแปร CSS ของใบงาน · วางบนกล่องนอกสุด ── */
function vjTplVars(vanId){
  var T=vjTpl();
  var VC=(T.useVanColor&&vanId&&typeof vehColor==='function')?vehColor(vanId):T.main;
  var PAD={t:'7px 9px',n:'11px 11px',w:'15px 13px'}[T.rowH]||'11px 11px';
  /* เบราว์เซอร์ปัดเส้นของตารางแบบ collapse เป็นพิกเซลเต็มเสมอ · 0.6px กับ 1.7px
     จึงออกมาเท่ากับ 1px หมด · "จาง" ใช้เส้น 1px แต่ไล่สีให้อ่อนลงแทน */
  var LW={t:'1px',n:'1px',w:'2px'}[T.lineW]||'1px';
  var LN=(T.lineW==='t')?vjtT(T.line,0.52):T.line;
  return '--vjt-van:'+T.fVan+'px;--vjt-route:'+T.fRoute+'px;--vjt-th:'+T.fTh+'px;'
    +'--vjt-td:'+T.fTd+'px;--vjt-name:'+T.fName+'px;--vjt-time:'+T.fTime+'px;'
    +'--vjt-loc:'+T.fLoc+'px;--vjt-locth:'+(Math.round(T.fLoc*1.24*10)/10)+'px;--vjt-note:'+T.fNote+'px;'
    +'--vjt-main:'+VC+';--vjt-main2:'+vjtD(VC,-22)+';--vjt-thbg:'+T.thBg+';--vjt-think:'+T.thInk+';'
    +'--vjt-hi:'+T.hi+';--vjt-line:'+LN+';--vjt-pad:'+PAD+';--vjt-lw:'+LW+';'
    /* ชุดสีหัวตารางต้องคุมแถบโปรแกรมและแถวรวมด้วย ไม่งั้นเปลี่ยนเป็นขาวดำแล้วยังมีฟ้าค้าง */
    +'--vjt-thbd:'+vjtT(T.thInk,0.74)+';--vjt-ink2:'+vjtD(T.thInk,-28)+';'
    +'--vjt-hlret:'+T.hlRet+';--vjt-hlret-bg:'+vjtT(T.hlRet,0.80)+';--vjt-hlret-ink:'+vjtD(T.hlRet,-38)+';'
    +'--vjt-hlwarn:'+T.hlWarn+';--vjt-hlwarn-bg:'+vjtT(T.hlWarn,0.88)+';--vjt-hlwarn-ink:'+vjtD(T.hlWarn,-32)+';'
    +'--vjt-hlconf:'+T.hlConf+';--vjt-hlconf-bg:'+vjtT(T.hlConf,0.88)+';--vjt-hlconf-ink:'+vjtD(T.hlConf,-28)+';'
    +'--vjt-hlupd:'+T.hlUpd+';--vjt-hlupd-ink:'+vjtD(T.hlUpd,-64)+';'
    +'--vjt-hlcxl:'+T.hlCxl+';--vjt-hlcxl-bg:'+vjtT(T.hlCxl,0.86)+';'
    +'--vjt-hlcall:'+T.hlCall+';--vjt-hlcall-bg:'+vjtT(T.hlCall,0.90)+';--vjt-hlcall-bd:'+vjtT(T.hlCall,0.58)+';'
    +'--vjt-secout:'+T.secOut+';--vjt-secret:'+T.secRet+';--vjt-hlextra:'+T.hlExtra+';';
}
function vjHlColor(v){
  v=String(v||'');
  if(/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return VJ_HL_OLD[v]||'';
}
function vjHlAll(){
  var raw='';
  try{ var b=laBlob(); raw=(typeof b.vanjob_rowhl==='string')?b.vanjob_rowhl:''; }catch(_){ raw=''; }
  if(_VJ_HL===null || _VJ_HL_SRC!==raw){
    var o={}; if(raw){ try{ o=JSON.parse(raw)||{}; }catch(_){ o={}; } }
    _VJ_HL=o; _VJ_HL_SRC=raw;
  }
  return _VJ_HL;
}
function vjHlKey(date,vanId,routeId,isRet,bkId){
  return String(date||'')+'|'+String(vanId||'')+'|'+String(routeId||'')+'|'+(isRet?'r':'o')+'|'+String(bkId||'');
}
function vjHlOf(key){ return vjHlAll()[key]||''; }
function vjHlPersist(justSet){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')) return;
  try{
    var A=vjHlAll();
    /* ตัดของเก่ากว่า 45 วันทิ้ง · ใบงานที่ผ่านไปแล้วไม่มีใครกลับไปพิมพ์
       ยกเว้นบรรทัดที่เพิ่งกด · ไม่งั้นเปิดใบเก่ามาทาสีแล้วมันหายทันทีตรงหน้า */
    var cut=new Date(); cut.setDate(cut.getDate()-45);
    var cutS=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(cut):cut.toISOString().slice(0,10);
    var keep={}; for(var k in A){ if(!A[k]) continue; if(k===justSet || String(k).slice(0,10)>=cutS) keep[k]=A[k]; }
    var b=laBlob();
    if(Object.keys(keep).length){ var str=JSON.stringify(keep); b.vanjob_rowhl=str; _VJ_HL=keep; _VJ_HL_SRC=str; }
    else { delete b.vanjob_rowhl; _VJ_HL={}; _VJ_HL_SRC=''; }
    laBlobSave();
  }catch(e){ try{ console.warn('[vjRowHl] save failed', e&&e.message); }catch(_){} }
}
function vjHlToggle(){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){ alert('ดูอย่างเดียว · แก้ไม่ได้'); return; }
  _VJ_HL_ON=!_VJ_HL_ON; _VJ_HL_POP=false; renderVanJobs();
}
function vjHlPick(c){ if(!/^#[0-9a-fA-F]{6}$/.test(String(c||''))) return; _VJ_HL_C=c; _VJ_HL_POP=false; renderVanJobs(); }
function vjHlPopToggle(){ _VJ_HL_POP=!_VJ_HL_POP; renderVanJobs(); }
/* เลือกสีเองระหว่างลาก · อัปเดตแค่กรอบที่เลือกไว้ ไม่วาดใหม่ (เหตุผลเดียวกับจานสีของ Template) */
function vjHlLive(c){
  if(!/^#[0-9a-fA-F]{6}$/.test(String(c||''))) return;
  _VJ_HL_C=c;
  var box=document.getElementById('vjhl-cst'); if(box) box.style.background=c;
  var pk=document.querySelector('.vjhl-b .pk i'); if(pk) pk.style.background=c;
  var g=document.getElementById('vjhl-g');
  if(g) [].forEach.call(g.querySelectorAll('button[data-c]'), function(b){
    b.className=(String(b.getAttribute('data-c')).toLowerCase()===String(c).toLowerCase())?'on':''; });
}
function vjHlClick(key){
  if(!_VJ_HL_ON) return;
  var A=vjHlAll();
  /* กดสีเดิมซ้ำ = ล้างบรรทัดนั้น · ไม่ต้องมีปุ่มยางลบแยก */
  var on=(A[key]!==_VJ_HL_C);
  if(on) A[key]=_VJ_HL_C; else delete A[key];
  vjHlPersist(on?key:null); renderVanJobs();
}
function vjHlClearSheet(date,vanId,routeId){
  var A=vjHlAll(), pre=String(date)+'|'+String(vanId)+'|'+String(routeId||'')+'|', n=0;
  for(var k in A){ if(k.indexOf(pre)===0) n++; }
  if(!n){ alert('ใบนี้ยังไม่มีบรรทัดที่ไฮไลต์ไว้'); return; }
  if(!confirm('ล้างไฮไลต์ทั้งใบนี้ '+n+' บรรทัด?')) return;
  for(var k2 in A){ if(k2.indexOf(pre)===0) delete A[k2]; }
  vjHlPersist(); renderVanJobs();
}
function vjHlBar(date,vanId,routeId){
  if(!_VJ_HL_ON) return '';
  var clr='vjHlClearSheet(\''+date+'\',\''+vanId+'\',\''+(routeId||'')+'\')';
  /* จานสีเดิมกางเรียงยาว 20 ช่องคาแถบไว้ตลอด กินที่และหาสีที่ใช้อยู่ไม่เจอ
     เปลี่ยนเป็นปุ่มสีเดียว กดแล้วค่อยกางจาน · แบบเดียวกับจานสีประจำรถ */
  return '<div class="vjhl-b"><b>&#128396; ไฮไลต์แถว</b>'
   +'<span class="s">เลือกสี แล้วคลิกที่แถวในใบ &middot; คลิกซ้ำสีเดิม = ล้างบรรทัดนั้น</span>'
   +'<span class="act">'
     +'<button class="pk'+(_VJ_HL_POP?' open':'')+'" onclick="vjHlPopToggle()" title="เลือกสีไฮไลต์">'
       +'<i style="background:'+_VJ_HL_C+'"></i><span>สีที่ใช้</span><em>&#9662;</em></button>'
     +'<button class="cl" onclick="'+clr+'" title="ล้างไฮไลต์ทั้งใบนี้">ล้างทั้งใบ</button>'
   +'</span>'
   +'<span class="n">ผูกกับใบนี้ใบเดียว (วันที่ &middot; รถ &middot; โปรแกรม) &middot; ติดไปกับตอนพิมพ์และบันทึกรูป</span>'
   +(_VJ_HL_POP?vjHlPop(clr):'')
   +'</div>';
}
function vjHlPop(clr){
  return '<div class="vjhl-pop" onclick="event.stopPropagation()">'
   +'<div class="ph">สีไฮไลต์แถว</div>'
   +'<div class="pg" id="vjhl-g">'
   +VJ_HL.map(function(c){ return '<button data-c="'+c+'" class="'+(String(_VJ_HL_C).toLowerCase()===c.toLowerCase()?'on':'')
       +'" style="background:'+c+'" title="'+c+'" onclick="vjHlPick(\''+c+'\')"></button>'; }).join('')
   +'</div>'
   +'<div class="pc"><label id="vjhl-cst" style="background:'+_VJ_HL_C+'">'
     +'<input type="color" value="'+_VJ_HL_C+'" oninput="vjHlLive(this.value)" onchange="vjHlPick(this.value)"></label>'
     +'<span>เลือกสีเองได้ไม่จำกัด &rarr;</span></div>'
   +'<button class="px" onclick="'+clr+'">ล้างไฮไลต์ทั้งใบนี้</button>'
   +'</div>';
}
function vjHlCss(){
  return '<style id="vjhl-css">'
   +'.vjhl-b{display:flex;align-items:center;gap:11px;background:#FFFBF0;border:2px solid #C99A2E;'
     +'border-radius:10px;padding:7px 12px;margin-bottom:10px;font-family:inherit}'
   +'.vjhl-b b{font-size:12.5px;color:#7A4A00;flex:none}'
   +'.vjhl-b .s{font-size:11px;color:#8a6a2a}'
   +'.vjhl-b{position:relative}'
   +'.vjhl-b .act{display:flex;gap:7px;align-items:center;margin-left:auto;flex:none}'
   +'.vjhl-b .act .pk{display:inline-flex;align-items:center;gap:7px;border:1.5px solid #d7c9a8;background:#fff;'
     +'border-radius:9px;padding:4px 10px 4px 5px;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;color:#7A4A00}'
   +'.vjhl-b .act .pk.open{border-color:#7A4A00;background:#FFF4DC}'
   +'.vjhl-b .act .pk i{width:22px;height:22px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}'
   +'.vjhl-b .act .pk em{font-style:normal;font-size:9px;color:#a89468}'
   +'.vjhl-b .act .cl{border:1px solid #d7c9a8;background:#fff;color:#8a6a2a;border-radius:9px;'
     +'padding:5px 11px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700}'
   +'.vjhl-b .act .cl:hover{border-color:#C0392B;color:#B5271F}'
   /* จานสี · กางใต้ปุ่ม แบบเดียวกับจานสีประจำรถ */
   +'.vjhl-pop{position:absolute;right:12px;top:calc(100% + 6px);z-index:40;background:#fff;'
     +'border:1px solid #e3ddcd;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.18);padding:12px;width:270px}'
   +'.vjhl-pop .ph{font-size:11.5px;font-weight:800;color:#7A4A00;margin-bottom:9px}'
   +'.vjhl-pop .pg{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}'
   +'.vjhl-pop .pg button{width:100%;aspect-ratio:1;border-radius:8px;border:none;cursor:pointer;'
     +'box-shadow:inset 0 0 0 1px rgba(0,0,0,.13);font-family:inherit;padding:0}'
   +'.vjhl-pop .pg button.on{box-shadow:inset 0 0 0 1px rgba(0,0,0,.13),0 0 0 2.5px #7A4A00}'
   +'.vjhl-pop .pc{display:flex;align-items:center;gap:9px;margin-top:11px;padding-top:10px;border-top:1px solid #f0ebdd}'
   +'.vjhl-pop .pc label{width:34px;height:28px;border-radius:8px;cursor:pointer;position:relative;overflow:hidden;flex:none;'
     +'box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}'
   +'.vjhl-pop .pc label input{position:absolute;inset:-6px;width:52px;height:46px;opacity:0;cursor:pointer;border:none;padding:0}'
   +'.vjhl-pop .pc span{font-size:10.5px;color:#8a8a82}'
   +'.vjhl-pop .px{width:100%;margin-top:10px;border:1px solid #e3ddcd;background:#fff;color:#8a6a2a;'
     +'border-radius:9px;padding:7px;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700}'
   +'.vjhl-pop .px:hover{border-color:#C0392B;color:#B5271F}'
   +'.vjhl-b .g button.on{box-shadow:inset 0 0 0 1px rgba(0,0,0,.13),0 0 0 2.5px #7A4A00}'
   +'.vjhl-b .g button.x{background:#fff;border:1px solid #d7c9a8;color:#8a6a2a;font-size:15px;line-height:1}'
   +'.vjhl-b .n{font-size:9.5px;color:#a89468;flex:none;max-width:180px;line-height:1.45}'
   /* ในโหมดไฮไลต์ · ทั้งแถวกดได้ ต้องบอกด้วยว่ากดได้ */
   +'.vjo.vjhl tbody tr{cursor:pointer}'
   +'.vjo.vjhl tbody tr:hover>td{outline:1.5px dashed #C99A2E;outline-offset:-2px}'
   +'</style>';
}
function vjTplPreset(k){
  var T={}; for(var a in VJT_DEF) T[a]=VJT_DEF[a];
  var P=VJT_PRESET[k]||{}; for(var b in P) T[b]=P[b];
  _VJT_DRAFT=T; renderVanJobs();
}
function vjTplOpen(){
  if(typeof window.laCanEditArea==='function' && !window.laCanEditArea('operations')){ alert('ดูอย่างเดียว · แก้ไม่ได้'); return; }
  var T=vjTpl(), D={}; for(var k in VJT_DEF) D[k]=T[k];
  _VJT_DRAFT=D; renderVanJobs();
}
function vjTplCancel(){ _VJT_DRAFT=null; renderVanJobs(); }
function vjTplApply(){ var T=_VJT_DRAFT; if(!T) return; if(vjTplSave(T)) _VJT_DRAFT=null; renderVanJobs(); }
function vjTplResetAsk(){
  if(!confirm('คืนค่า Template ของใบงานรถกลับเป็นค่าเริ่มต้นทั้งหมด?')) return;
  var T={}; for(var k in VJT_DEF) T[k]=VJT_DEF[k];
  _VJT_DRAFT=T; renderVanJobs();
}
function vjTplSet(k,v){
  if(!_VJT_DRAFT) return;
  if(VJT_NUM[k]){ var n=+v; if(!isFinite(n)) return;
    _VJT_DRAFT[k]=Math.max(VJT_NUM[k][0], Math.min(VJT_NUM[k][1], Math.round(n*10)/10)); }
  else _VJT_DRAFT[k]=v;
  renderVanJobs();
}
function vjTplBump(k,d){ if(!_VJT_DRAFT) return; vjTplSet(k, (+_VJT_DRAFT[k]||0)+d); }
/* ── ชิ้นส่วนของพาเนล ── */
function _vjtStep(lbl,k,hot){
  var T=_VJT_DRAFT||vjTpl();
  return '<div class="ct'+(hot?' hot':'')+'"><span class="cl">'+lbl+'</span>'
   +'<span class="cs"><i onclick="vjTplBump(\''+k+'\',-0.5)">&minus;</i>'
   +'<input value="'+T[k]+'" onchange="vjTplSet(\''+k+'\',this.value)">'
   +'<i onclick="vjTplBump(\''+k+'\',0.5)">+</i></span><span class="cu">px</span></div>';
}
/* §vjFix1 · ระหว่างลากสีในจานของเบราว์เซอร์ ห้ามวาดใหม่ทั้งหน้า
   ไม่งั้น input ที่กำลังถืออยู่ถูกลบ จานสีปิดตัวเอง (เด้ง)
   ทำแค่ยัดค่าลงตัวแปร CSS ของใบ · ใบเปลี่ยนสีตามทันทีโดยไม่ต้องวาดใหม่
   ค่อยวาดใหม่ตอน change (ปิดจานสีแล้ว) เพื่อให้ส่วนที่ไม่ใช่ตัวแปรตามไปด้วย */
function _vjtPrevVan(){
  var k=String(_vanJobsPreview||''); if(!k) return null;
  return k.split('|')[0].split('~')[0] || null;
}
function vjTplLiveVars(){
  var pg=document.getElementById('vjo-page'); if(!pg) return;
  vjTplVars(_vjtPrevVan()).split(';').forEach(function(d){
    var i=d.indexOf(':'); if(i>0) pg.style.setProperty(d.slice(0,i).trim(), d.slice(i+1).trim());
  });
}
function vjTplLive(k,v){
  if(!_VJT_DRAFT) return;
  _VJT_DRAFT[k]=v;
  var lb=document.getElementById('vjtsw-'+k); if(lb) lb.textContent=String(v).toUpperCase();
  vjTplLiveVars();
}
function _vjtSw(lbl,k,note){
  var T=_VJT_DRAFT||vjTpl(), c=T[k]||'#000000';
  return '<div class="ct"><span class="cl">'+lbl+'</span>'
   +'<span class="cw"><input type="color" value="'+c+'" oninput="vjTplLive(\''+k+'\',this.value)" onchange="vjTplSet(\''+k+'\',this.value)">'
   +'<code id="vjtsw-'+k+'">'+String(c).toUpperCase()+'</code></span>'
   +(note?'<span class="cn">'+note+'</span>':'')+'</div>';
}
function _vjtSeg(lbl,k,opts){
  var T=_VJT_DRAFT||vjTpl(), cur=String(T[k]);
  return '<div class="ct"><span class="cl">'+lbl+'</span><span class="cg">'
   +opts.map(function(o){ return '<button class="'+(cur===String(o[0])?'on':'')
      +'" onclick="vjTplSet(\''+k+'\',\''+o[0]+'\')">'+o[1]+'</button>'; }).join('')
   +'</span></div>';
}
function vjTplPanel(){
  if(!_VJT_DRAFT) return '';
  var T=_VJT_DRAFT;
  return '<div class="vjt-p"><div class="vjt-h"><b>&#9881; Template ใบงานรถ</b>'
   +'<span class="s">ตั้งครั้งเดียว · ใช้กับใบงานรถทุกใบ ทุกวัน ทุกคัน</span>'
   +'<span class="pre">พรีเซ็ต'
     +'<button onclick="vjTplPreset(\'std\')">มาตรฐาน</button>'
     +'<button onclick="vjTplPreset(\'big\')">ตัวใหญ่</button>'
     +'<button onclick="vjTplPreset(\'ink\')">ประหยัดหมึก</button></span>'
   +'<button class="x" onclick="vjTplCancel()" title="ปิดโดยไม่บันทึก">&times;</button></div>'
   +'<div class="vjt-b">'
     +'<div class="vjt-c"><div class="t">ขนาดตัวอักษร</div>'
       +_vjtStep('ชื่อรถ (หัวใบ)','fVan')
       +_vjtStep('ชื่อโปรแกรม','fRoute')
       +_vjtStep('หัวตาราง','fTh')
       +_vjtStep('เนื้อตาราง','fTd')
       +_vjtStep('ชื่อลูกค้า','fName')
       +_vjtStep('เวลารับ','fTime')
       +_vjtStep('จุดรับ / จุดส่ง','fLoc')
       +_vjtStep('หมายเหตุท้ายใบ','fNote')
     +'</div>'
     +'<div class="vjt-c"><div class="t">สีของใบ</div>'
       +_vjtSw('สีหลักของใบ','main','หัวใบ + แถบโปรแกรม')
       +'<div class="ct"><span class="cl"></span><label class="ck"><input type="checkbox"'
         +(T.useVanColor?' checked':'')+' onchange="vjTplSet(\'useVanColor\',this.checked?1:0)"> ใช้สีประจำรถแทน</label></div>'
       +_vjtSw('พื้นหัวตาราง','thBg')
       +_vjtSw('ตัวอักษรหัวตาราง','thInk')
       +_vjtSw('สีเน้น (เวลารับ)','hi')
       +_vjtSw('เส้นตาราง','line')
       +'<div class="t" style="margin-top:12px">ระยะและเส้น</div>'
       +_vjtSeg('ความสูงแถว','rowH',[['t','แน่น'],['n','ปกติ'],['w','โปร่ง']])
       +_vjtSeg('เส้นตาราง','lineW',[['t','จาง'],['n','ปกติ'],['w','หนา']])
       +_vjtSeg('ชื่อไทยใต้จุดรับ','showTh',[[0,'ซ่อน'],[1,'แสดง']])
     +'</div>'
     +'<div class="vjt-c"><div class="t">สีไฮไลต์ที่ระบบขึ้นเอง</div>'
       +'<div class="n">ป้ายและกล่องที่ใบงานขึ้นให้เองเมื่อเจอเคสพิเศษ</div>'
       +_vjtSw('&#9312; หัวข้อขาไป','secOut')
       +_vjtSw('&#9313; หัวข้อขากลับ','secRet')
       +_vjtSw('พื้นแถวเปลี่ยนรถ / ที่ส่ง','hlExtra','ทั้งแถว')
       +_vjtSw('&#8617; ขากลับใช้รถคันอื่น','hlRet')
       +_vjtSw('&#9888; ยังไม่ได้จัดรถ','hlWarn')
       +_vjtSw('&#9888; รถปนกันในกรุ๊ป','hlConf')
       +_vjtSw('&#128204; อัปเดตคนขับวันนี้','hlUpd')
       +_vjtSw('&#9888; ยกเลิก / เลื่อนวัน','hlCxl')
       +_vjtSw('&#9742; กล่องเตือนท้ายใบ','hlCall')
     +'</div>'
   +'</div>'
   +'<div class="vjt-f"><button class="r" onclick="vjTplResetAsk()">&#8634; คืนค่าเริ่มต้น</button>'
     +'<span style="flex:1"></span>'
     +'<button class="c" onclick="vjTplCancel()">ยกเลิก</button>'
     +'<button class="k" onclick="vjTplApply()">ใช้กับทุกใบ</button></div></div>';
}
function vjTplCss(){
  return '<style id="vjt-css">'
   +'.vjt-p{background:#fff;border:2px solid #0F6E56;border-radius:11px;margin-bottom:10px;'
     +'box-shadow:0 3px 14px -6px rgba(15,110,86,.4);overflow:hidden;font-family:inherit}'
   +'.vjt-h{display:flex;align-items:center;gap:12px;padding:8px 13px;background:#F1FBF6;border-bottom:1px solid #DFF0E8}'
   +'.vjt-h b{font-size:13px;color:#0C6B47}.vjt-h .s{font-size:11px;color:#6b7280}'
   +'.vjt-h .pre{margin-left:auto;font-size:10.5px;color:#8a8a82;display:flex;align-items:center;gap:5px}'
   +'.vjt-h .pre button{border:1px solid #d7dbe2;background:#fff;border-radius:6px;padding:3px 9px;'
     +'font:600 10.5px inherit;font-family:inherit;color:#5F5E5A;cursor:pointer}'
   +'.vjt-h .pre button:hover{border-color:#0F6E56;color:#0F6E56}'
   +'.vjt-h .x{background:transparent;border:none;font-size:17px;color:#9aa;cursor:pointer;font-family:inherit}'
   +'.vjt-b{display:grid;grid-template-columns:1fr 1.05fr 1.1fr}'
   +'.vjt-c{padding:10px 14px 12px;border-right:1px solid #EEF0EC;min-width:0}'
   +'.vjt-c:last-child{border-right:0}'
   +'.vjt-c .t{font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:#94918a;font-weight:800;margin-bottom:7px}'
   +'.vjt-c .n{font-size:10px;color:#a8a49c;line-height:1.5;margin:-3px 0 7px}'
   +'.vjt-p .ct{display:flex;align-items:center;gap:8px;margin-bottom:5px;min-height:26px}'
   +'.vjt-p .cl{font-size:11.5px;color:#4b5563;width:124px;flex:none}'
   +'.vjt-p .cs{display:flex;align-items:center;border:1px solid #d7dbe2;border-radius:7px;overflow:hidden;background:#fff}'
   +'.vjt-p .cs i{font-style:normal;padding:3px 8px;color:#0F6E56;font-size:13px;background:#F7F9F8;cursor:pointer;user-select:none}'
   +'.vjt-p .cs i:hover{background:#E3F0EA}'
   +'.vjt-p .cs input{width:52px;border:none;outline:none;text-align:center;font:500 11.5px \'DM Mono\',monospace;color:#1B2A55;padding:3px 0;background:#fff}'
   +'.vjt-p .cu{font-size:10px;color:#a8a49c}'
   +'.vjt-p .cw{display:flex;align-items:center;gap:6px;border:1px solid #d7dbe2;border-radius:7px;padding:2px 8px 2px 3px;background:#fff}'
   +'.vjt-p .cw input[type=color]{width:23px;height:21px;border:none;background:none;padding:0;cursor:pointer}'
   +'.vjt-p .cw code{font:500 10.5px \'DM Mono\',monospace;color:#5F5E5A}'
   +'.vjt-p .cn{font-size:9.5px;color:#a8a49c}'
   +'.vjt-p .ck{font-size:11px;color:#0C6B47;display:flex;align-items:center;gap:6px;cursor:pointer}'
   +'.vjt-p .cg{display:flex;border:1px solid #d7dbe2;border-radius:7px;overflow:hidden}'
   +'.vjt-p .cg button{border:none;background:#fff;font:600 10.5px inherit;font-family:inherit;color:#5F5E5A;'
     +'padding:4px 11px;cursor:pointer;border-right:1px solid #eef0ec}'
   +'.vjt-p .cg button:last-child{border-right:0}'
   +'.vjt-p .cg button.on{background:#0F6E56;color:#fff;font-weight:700}'
   +'.vjt-f{display:flex;align-items:center;gap:8px;padding:8px 13px;border-top:1px solid #EEF0EC;background:#FCFDFC}'
   +'.vjt-f button{border-radius:8px;padding:7px 14px;font:600 12px inherit;font-family:inherit;cursor:pointer}'
   +'.vjt-f .r{background:#fff;border:1px solid #d7dbe2;color:#8a8a82}'
   +'.vjt-f .c{background:#fff;border:1px solid #d7dbe2;color:#5F5E5A}'
   +'.vjt-f .k{background:#0F6E56;border:none;color:#fff}'
   +'</style>';
}
function vanJobsOrderCss(scoped){ const p=scoped?'.vjo ':'';
  return '<style>'
    +(scoped?".vjo{font-family:'DM Sans',Arial,sans-serif;color:#1B2A55}":"*{box-sizing:border-box} body{font-family:'DM Sans',Arial,sans-serif;color:#1B2A55;margin:0;padding:22px}")
    +p+'.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #185FA5;padding-bottom:10px;margin-bottom:14px}'
    +p+'.h1{font-size:20px;font-weight:800}'+p+'.h1 small{display:block;font-size:12px;font-weight:500;color:#666}'
    /* §vjTpl · ค่าเริ่มต้นวางไว้ที่กล่องเอง · ถ้ามีตัวแปรจาก vjTplVars มาทับ (สีประจำรถ) ก็ใช้ของนั้น */
    +(scoped?'.vjo{':'body{')+vjTplVars(null)+'}'
    +p+'.meta{text-align:right;font-size:13px;color:#444;line-height:1.5}'+p+'.meta b{font-size:16px;color:#185FA5}'
    +p+'.bighd{background:var(--vjt-thbg,#F4F8FC);border:1px solid var(--vjt-thbd,#d8e6f3);border-radius:10px;padding:13px 20px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +p+'.bh-lbl{font-size:10px;color:var(--vjt-think,#5b86a3);opacity:.75;letter-spacing:.07em;text-transform:uppercase}'
    +p+'.bh-line{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:4px 0 2px}'
    +p+'.bh-route{font-size:var(--vjt-route,24px);font-weight:800;color:var(--vjt-ink2,#15396B);line-height:1.15}'
    +p+'.bh-sep{font-size:20px;color:#9db6cc;font-weight:400}'
    +p+'.bh-date{font-size:var(--vjt-route,24px);font-weight:800;color:var(--vjt-think,#185FA5);line-height:1.15;white-space:nowrap}'
    +p+'table{width:100%;border-collapse:collapse;font-size:var(--vjt-td,15px)}'
    +p+'th{background:var(--vjt-thbg,#EAF3FB);color:var(--vjt-think,#185FA5);text-align:left;padding:9px 10px;border:var(--vjt-lw,1px) solid var(--vjt-thbd,#cfe0ef);font-size:var(--vjt-th,12.5px);text-transform:uppercase;letter-spacing:.03em;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +p+'th small{display:block;font-weight:400;color:var(--vjt-think,#5b86a3);opacity:.78;text-transform:none;font-size:.86em}'
    +p+'td{padding:var(--vjt-pad,11px 11px);border:var(--vjt-lw,1px) solid var(--vjt-line,#e2e2da);vertical-align:top;font-size:var(--vjt-td,15px);overflow-wrap:anywhere;word-break:break-word}'
    +p+'.ag{font-size:12px;color:#777;margin-top:2px}'
    +p+'.note{margin-top:13px;font-size:var(--vjt-note,12px);color:#555;line-height:1.6}'
    +p+'.callnote{margin-top:10px;font-size:calc(var(--vjt-note,12px) + 3px);font-weight:700;color:var(--vjt-hlcall,#9B1B12);background:var(--vjt-hlcall-bg,#FBECEA);border:1.5px solid var(--vjt-hlcall-bd,#E6A9A2);border-radius:8px;padding:11px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:center;line-height:1.5}'
    /* §vjTpl · ชื่อไทยใต้จุดรับ · ปิดได้จาก Template */
    +p+'.pkth{font-size:var(--vjt-locth,18px)}'
    +(vjTpl().showTh?'':(p+'.pkth{display:none}'))
    /* §strandVjClear · ปุ่มล้างมีไว้ให้กดบนจอ · ใบที่ส่งคนขับต้องไม่มีปุ่ม
       ใบนี้ใช้ HTML ชุดเดียวกันทั้งบนจอและในหน้าต่างพิมพ์ จึงซ่อนตอนพิมพ์แทนการแยกธง */
    +p+'.vj-sxclr{vertical-align:middle}'
    +'@media print{'+p+'.vj-sxclr{display:none !important}}'
    +(scoped?'':'@media print{@page{size:A4 landscape;margin:10mm}body{padding:0}}')
    +'</style>';
}
function vanJobsOrderInner(date, vanId, routeId, legIgnored, grp){
  /* §vjRound · grp = เลขกรุ๊ป · ใส่มาแปลว่าใบนี้เป็นของรอบเดียว ไม่ใช่ทั้งวันของรถคันนี้ */
  const _G=+grp||0;
  const _RND=_G?((typeof vjRoundOf==='function')?vjRoundOf(date,vanId,routeId,_G):null):null;
  /* §vjTpl · หัวใบใช้สีประจำรถหรือสีหลักของบริษัท แล้วแต่ที่ตั้งไว้ใน Template */
  const _T=vjTpl();
  const VC=(_T.useVanColor?vehColor(vanId):_T.main), VC2=vjShade(VC,-22);
  if(typeof bkV2HealAltSplits==='function') bkV2HealAltSplits(date);   // §altPickups · auto van-splits for รับหลายจุด before building the sheet
  if(typeof bkV2VanGroupHeal==='function') bkV2VanGroupHeal(date);   // ensure grouped bookings have their group's vanId before building the sheet (prevents ตกบุคกิ้งในใบงาน)
  const v=vehGet(vanId)||{};
  const _drv=(typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(vanId,date):{driver:v.driver||'',phone:v.driverPhone||'',override:false};
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const _ptime=(b,t)=>(bkOpsRead(b,(t&&t.date)||date).pickupTimeFinal)||t.pickupTime||b.pickupTime||'';   /* §per-trip ops · เวลารับที่คนจัดรถตั้งไว้ เป็นของวันนั้น */
  const _allRoutes={};
  // RETURN leg = every booking this van brings back: returnVan = vanReturnId || outbound vanId (default same-van return).
  // OUTBOUND leg = bookings this van picks up (vanId). outVid carried so the return row can show กลับคันเดิม / มาจากรถอื่น.
  const _collect=isRet=>{ const rows=[]; (SB_BOOKINGS||[]).forEach(b=>{
      /* §strandVj · ยกเลิกแล้วแต่จัดรถไว้แล้ว → ยังพิมพ์ในใบ แต่ขีดฆ่าและไม่นับยอด
         เพื่อให้ใบใหม่เทียบกับใบเก่าที่คนขับถืออยู่ได้บรรทัดต่อบรรทัด */
      let _sx=false;
      if(typeof ckIsCxl==='function' && ckIsCxl(b)){
        if(!(typeof ckHasArrange==='function' && ckHasArrange(b,date))) return;
        _sx=true;
      }
      if(isRet && typeof bkV2RetInfo==='function' && bkV2RetInfo(b,date).selfRet) return;   // ขากลับ "กลับเอง" (drop-off ท่า self-arrive) → ไม่ต้องมีรถไปส่ง → ไม่ขึ้นในใบงานขากลับ
      if(!isRet && b.pickupSelf) return;   // ขารับ "มาเอง" (self-arrive) → ไม่มีรถไปรับ → ไม่ขึ้นในใบงานขาไป
    (b.trips||[]).forEach(t=>{ if((t.date||'')!==date) return; if(routeId && t.routeId!==routeId) return;   // this sheet = one program(route) only
      // §OVN outbound — they sleep on the island. No return run for them TODAY (the return is its own day).
      if(isRet && typeof bkIsOvnOutbound==='function' && bkIsOvnOutbound(t)) return;
      /* §OVN return leg — วันนี้ไม่มีขารับที่โรงแรม (แขกอยู่บนเกาะ) รถไปเจอเรือที่ท่า แล้วส่งเข้าโรงแรม
         = งานขากลับล้วนๆ · แต่ตารางขาไปจับคู่ด้วย vanId และขากลับใช้ vanReturnId||vanId → ลำเดียวกัน
         แถวเลยโผล่ทั้งสองตาราง คนขับเห็น "ไปรับที่ท่าเรือ" ตอนเช้าทั้งที่แขกยังไม่กลับมา */
      if(!isRet && t.ovnLeg) return;
      const _O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
      if(Array.isArray(_O.vanSplits)&&_O.vanSplits.length){ _O.vanSplits.forEach(s=>{ const ov=s.vanId||null; const rv=s.vanReturnId||ov; const hit=isRet?(rv===vanId):(ov===vanId && (!_G || (+s.vanGroup||0)===_G)); if(hit) rows.push({b,t,strand:_sx,splitPax:+s.pax||0,splitBd:bkSplitPax(s),retId:s.vanReturnId||null,outVid:ov,seq:+s.vanSeq||0, sHotel:s.pickHotel||'', sAreaId:s.pickAreaId||'', sZone:s.pickZone||'', sWho:s.altWho||'', sMain:!!s.main, sp:s}); }); }
      else { const o=_O; const ov=o.vanId||null; const rv=o.vanReturnId||ov; const hit=isRet?(rv===vanId):(ov===vanId && (!_G || (+o.vanGroup||0)===_G)); if(hit) rows.push({b,t,strand:_sx,splitPax:null,retId:o.vanReturnId||null,outVid:ov,seq:+(o.vanSeq)||0}); }
    }); });
    /* ══ §altDrop · ใบงานขาไปต้องหน้าตาเท่าเดิม ══════════════════════════
       การแยก "ส่งคนละที่" บังคับให้สร้าง split เพิ่ม ทั้งที่ฝั่งรับเหมือนกันทุกอย่าง
       ปล่อยไว้ = คนขับเห็นชื่อโรงแรมเดิมซ้ำสองบรรทัด แล้วไม่รู้ว่าต้องไปกี่รอบ
       ยุบแถวที่ "จุดรับเดียวกันของใบเดียวกัน" กลับเป็นแถวเดียว แล้วรวมยอดคน
       ขากลับไม่ยุบ · ตรงนั้นแหละที่ต้องแยกจริง                                */
    if(!isRet && rows.length>1){
      var _mg=[], _at={};
      rows.forEach(function(x){
        var own=(!x.sMain)&&((x.sHotel||'').trim()||x.sAreaId);
        var k=x.b.id+'|'+(own?((x.sAreaId||'')+'~'+((x.sHotel||'').trim())):'MAIN');
        if(_at[k]!=null){
          var t0=_mg[_at[k]];
          if(t0.splitPax!=null || x.splitPax!=null){
            t0.splitPax=(+t0.splitPax||0)+(+x.splitPax||0);
            t0.splitBd=(typeof bkPaxAdd==='function')?bkPaxAdd(t0.splitBd||{ad:0,chd:0,inf:0,foc:0}, x.splitBd||{ad:0,chd:0,inf:0,foc:0}):t0.splitBd;
          }
          t0._mgN=(t0._mgN||1)+1;
          return;
        }
        _at[k]=_mg.length; _mg.push(x);
      });
      /* rows เป็น const · เขียนทับในที่ ไม่ผูกใหม่ */
      if(_mg.length!==rows.length){ rows.length=0; _mg.forEach(function(x){ rows.push(x); }); }
    }
    /* §strandMove · ใบที่เลื่อนวันไปแล้วแต่เคยอยู่ในใบงานของคันนี้ · พิมพ์ขีดฆ่าคาไว้ */
    if(typeof ckStrandMovedRows==='function') ckStrandMovedRows(date).forEach(function(r){
      if(routeId && r.t.routeId!==routeId) return;
      var hit=isRet ? ((r.O.vanReturnId||r.O.vanId)===vanId) : (r.O.vanId===vanId && (!_G || (+r.O.vanGroup||0)===_G));
      if(!hit) return;
      rows.push({b:r.b, t:r.t, strand:'mv', strandWhy:r.strandWhy, splitPax:null,
                 retId:r.O.vanReturnId||null, outVid:r.O.vanId||null, seq:+r.O.vanSeq||0});
    });
    rows.sort((a,b)=>{
      if(isRet){ const ea=(a.outVid&&a.outVid!==vanId)?1:0, eb=(b.outVid&&b.outVid!==vanId)?1:0; if(ea!==eb) return ea-eb; }   // return: "came from another van" rows go LAST
      const sa=a.seq||0, sb=b.seq||0; if(sa||sb){ const da=sa||9999, db=sb||9999; if(da!==db) return da-db; } return String(_ptime(a.b,a.t)).localeCompare(String(_ptime(b.b,b.t))); });
    return rows; };
  // Shared column widths so the OUTBOUND and RETURN tables line up exactly (table-layout:fixed)
  const _colg='<colgroup><col style="width:2.5%"><col style="width:11%"><col style="width:11%"><col style="width:3.3%"><col style="width:3.3%"><col style="width:3.3%"><col style="width:3.3%"><col style="width:8.5%"><col style="width:13.5%"><col style="width:4.5%"><col style="width:6%"><col style="width:14%"><col style="width:3.8%"><col style="width:8.5%"></colgroup>';
  // Build one detail section (table) for a leg — SAME columns as the original job order
  const _section=isRet=>{
    const rows=_collect(isRet); if(!rows.length) return {rows:[], totPax:0, html:''};
    let totPax=0, totAd=0, totChd=0, totInf=0, totFoc=0, _nSx=0, _seqNo=0;
    const tr=rows.map((x,i)=>{ const b=x.b,t=x.t; const pax=(x.splitPax!=null)?x.splitPax:((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0);
      /* §strandVj · ของค้างไม่เข้ายอดและไม่กินเลขลำดับ · เลขต้องตรงกับใบเก่าที่คนขับถืออยู่ */
      const _sxR=!!x.strand; if(_sxR) _nSx++; else totPax+=pax;
      const _no=_sxR?'&#10007;':(++_seqNo);
      const route=(typeof getRoute==='function'?getRoute(t.routeId):null);
      if(route&&route.name) _allRoutes[route.name]=1; else if(t.routeId) _allRoutes[t.routeId]=1;
      // §altPickups · an alt-pickup split allocation carries its OWN pickup location (Lead/main uses the booking's)
      const _splitPick=(!x.sMain)&&(x.sHotel||x.sAreaId);
      const _splitArea=(_splitPick&&x.sAreaId&&typeof bkV2GetArea==='function')?bkV2GetArea(x.sAreaId):null;
      const _hotel=_splitPick?((x.sHotel)||(_splitArea?_splitArea.name:'')||b.hotelName||''):(b.hotelName||b.pickup||b.pickupArea||'');
      const _route2=(typeof getRoute==='function'?getRoute(t.routeId):null);
      const _pierNm=_route2&&_route2.pier?(_route2.pier==='panwa'?'Visit Panwa Pier':_route2.pier==='tublamu'?'Tub Lamu Pier':_route2.pier):'ท่าเรือ / Pier';
      // §OVN — on the return day the customer arrives BY BOAT. Their hotel is where they get dropped,
      // never where they are collected. This row used to print the hotel as a pickup point, so a driver
      // was sent to a lobby the customer had checked out of the day before.
      const _ovnRet = !!t.ovnLeg;
      const _ovnOut = !!(t.ovn==='return' && t.ovnReturnDate);
      const pickup  = (isRet || _ovnRet) ? _pierNm : _hotel;
      const _pickArea=(typeof bkV2GetArea==='function'&&b.pickupAreaId)?bkV2GetArea(b.pickupAreaId):null;
      // §bug2 · ตาราง RETURN ต้องโชว์โซนของ "จุดส่ง (drop-off)" ไม่ใช่จุดรับ — เดิมดึง pickupAreaId เสมอ ทั้ง 2 leg
      //   ทำให้ขากลับที่ส่งคนละโซน (เช่น รับ Patong · ส่ง Chalong) โชว์ Patong → คนขับงง
      //   dropoffSame / มาเอง → จุดส่ง = จุดรับ จึง fallback เป็น pickArea
      const _dropAreaObj=(b.dropoffSame===false && b.dropoffAreaId && typeof bkV2GetArea==='function')?bkV2GetArea(b.dropoffAreaId):_pickArea;
      const _area=_splitPick?_splitArea:(isRet?_dropAreaObj:_pickArea);
      const _areaEn=_area?_area.name:'';
      const _pt=k=>(typeof bkV2PaxTot==='function'?bkV2PaxTot(t.pax,k):0);
      const _ad=_pt('ad'),_chd=_pt('chd'),_inf=_pt('inf'),_foc=_pt('foc');
      // §pax breakdown · a split now carries its own ad/chd/inf/foc, so a child on a second pickup
      // point stays a child. (Old data with only a headcount reads back as all-adult — same as before.)
      const _bd = (x.splitPax!=null) ? (x.splitBd || {ad:pax,chd:0,inf:0,foc:0}) : {ad:_ad,chd:_chd,inf:_inf,foc:_foc};
      if(!_sxR){ totAd+=_bd.ad; totChd+=_bd.chd; totInf+=_bd.inf; totFoc+=_bd.foc; }
      const _pc='text-align:center;font-size:16.5px;font-weight:700;color:#15396B';
      const _pcSplit=_pc+';color:#5B289A';   // split pax shown in the AD column · purple to signal it's a split portion
      // split rows are tinted purple in the AD column only so the eye can tell a split portion from a
      // whole booking — but CHD / INF / FOC now show their real numbers instead of a hard-coded 0.
      const _cAd=(x.splitPax!=null)?_pcSplit:_pc;
      const paxCells=`<td style="${_cAd}">${_bd.ad}</td><td style="${_pc}">${_bd.chd}</td><td style="${_pc}">${_bd.inf}</td><td style="${_pc}">${_bd.foc}</td>`;
      // Zone in English with the Thai name under it — the same two-line treatment the pick-up column
      // already gets, so a Thai driver reads the zone without translating in his head.
      const _zoneTh = _areaEn ? ((typeof VANJOB_AREA_TH!=='undefined' && VANJOB_AREA_TH[_areaEn]) || '') : '';
      const zoneCell = _areaEn
        ? `<div style="font-weight:600;line-height:1.25">${e(_areaEn)}</div>${_zoneTh?`<div style="font-size:11px;color:#185FA5;line-height:1.25">${e(_zoneTh)}</div>`:''}`
        : '-';
      const _pkTh=(typeof vanJobsGetPickupTh==='function')?vanJobsGetPickupTh(pickup):'';
      const _sreqTxt=(typeof vanJobsSreqFinal==='function')?vanJobsSreqFinal(b):'';
      const sreqCell=(_sreqTxt&&_sreqTxt.trim())?e(_sreqTxt):'<span style="color:#bbb">-</span>';
      /* §altDrop · จุดส่งของแถวนี้ · ของ split เองมาก่อน แล้วค่อยถอยไปใช้ของทั้งใบ */
      const _dOwn=(typeof bkDropOf==='function')?bkDropOf(b, x.sp):{place:'',own:false};
      const _sepDrop=_dOwn.place || ((b.dropoffSame===false)?(b.dropoffHotelName||b.dropoffArea||''):'');
      const dropoff=isRet ? (_sepDrop||_hotel) : _sepDrop;
      const retDiff=!isRet && x.retId && x.retId!==vanId;
      const retName=retDiff?((vehGet(x.retId)||{}).name||x.retId):'';
      // return-row origin tag: same van as outbound (กลับคันเดิม) vs came on another van
      const _retTag = isRet ? ((x.outVid===vanId) ? '<span style="color:#9aa0aa;font-size:11px"> · กลับคันเดิม</span>' : (x.outVid?` <span style="color:#9aa0aa;font-size:11px">· มาจากรถอื่น (ขาไป ${e((vehGet(x.outVid)||{}).name||x.outVid)})</span>`:'')) : '';
      // §OVN — the drop-off cell is where the driver reads what happens to this passenger at the end of
      // the run, so that is where the overnight instruction belongs (it used to be crammed under the name).
      const _ovnDrop = _ovnOut
        ? `<div style="color:#4A2E86;font-weight:700;font-size:12px;line-height:1.35">&#127765; ค้างคืนบนเกาะ</div><div style="color:#6b5a95;font-size:11px;line-height:1.35">ไม่ต้องรอส่งกลับวันนี้<br>กลับ ${e(t.ovnReturnDate||'')}</div>`
        : _ovnRet
        ? `<div style="font-weight:700;font-size:12px;line-height:1.35">${e(dropoff||b.hotelName||'—')}</div><div style="color:#8a5500;font-size:11px;line-height:1.35">&#8617; ส่งกลับ · มาจากเกาะ</div>`
        : null;
      /* §altDrop · แถวที่มีจุดส่งของตัวเอง ต้องเห็นชัดว่าไม่ใช่จุดเดียวกับคนอื่นในใบ */
      const _dTag = _dOwn.own
        ? `<div style="margin-top:3px"><span style="display:inline-block;background:#EDE7FB;color:#5B289A;font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#9986; แยกส่ง${x.sWho?(' · '+e(x.sWho)):''}</span></div>`
        : '';
      const dropCell = _ovnDrop ? _ovnDrop : (dropoff
        ? (isRet ? (`<b>${e(dropoff)}</b>`+_retTag+_dTag) : (((!isRet&&_sepDrop)?'<b style="color:#9A5B00">&#8617; กลับ:</b> ':'')+e(dropoff)+_dTag))
        : (isRet ? '<span style="color:#888">—</span>' : '<span style="color:#5a6b80">&#8594; ท่าเรือ</span>'));
      // soft highlight for rows that are "extra" so they're not forgotten:
      //  return-section row that came in on ANOTHER van · outbound-section row whose return uses another van
      const _extra = isRet ? (x.outVid && x.outVid!==vanId) : !!retDiff;
      // §vjRetNS · สถานะจากหน้าเช็คอิน · ใส่เฉพาะใบงานขากลับ (ขาไปพิมพ์ก่อนเช็คอิน ยังไม่มีข้อมูล)
      let _ckTag='';
      if(isRet){
        try{
          const _dte=t.date||date;
          const _sp=(typeof pckSelfPierNote==='function')?pckSelfPierNote(b,_dte):null;
          // §vjRetNS2 · อีกทางหนึ่ง · หน้าท่ากดยืนยันเองว่ามาแล้ว (เหตุผลตอนกด No-show เป็นแบบปกติ)
          const _re=(typeof ckReinstateOf==='function')?ckReinstateOf(b,_dte):null;
          const _vn=(typeof ckVanNsPax==='function')?ckVanNsPax(b,_dte):0;
          const _bd0=(typeof ckPaxBreak==='function')?ckPaxBreak(t.pax):null;
          let _left=null;
          if(_bd0 && typeof ckPaxLeft==='function'){
            _left=['ad','chd','inf','foc'].reduce((s2,k)=>s2+ckPaxLeft(b,t.date||date,k,_bd0[k]||0),0);
          }
          if(_left===0){
            _ckTag='<div style="margin-top:3px"><span style="display:inline-block;background:#FBE3E1;color:#B5271F;font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#10007; ไม่ได้เดินทาง · ไม่ต้องรอ</span></div>';
          } else if(_sp || (_re && _vn>0)){
            const _why=_sp ? ('('+e(_sp.label)+')') : '(หน้าท่ายืนยันว่ามาแล้ว)';
            _ckTag='<div style="margin-top:3px"><span style="display:inline-block;background:#F1E7FB;color:#5B289A;font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#128694; เช้าไม่ได้ขึ้นรถ '+_why+' · ขากลับส่งตามปกติ</span></div>';
          }
        }catch(_e){}
      }
      /* §vjRowHl · สีที่คนจัดรถทาเอง ชนะสีอัตโนมัติ · เขาเห็นของจริงตรงหน้าแล้วจึงทา */
      const _hlKey = vjHlKey(date, vanId, routeId, isRet, b.id);
      const _hlCol = vjHlColor(vjHlOf(_hlKey));
      const _rowBg = _hlCol
        ? ` style="background:${_hlCol};-webkit-print-color-adjust:exact;print-color-adjust:exact"`
        : (_sxR
        ? ' style="background:#F5F3F0;color:#9b9a93;-webkit-print-color-adjust:exact;print-color-adjust:exact"'
        : (_extra ? ' style="background:var(--vjt-hlextra,#FFF6E6);-webkit-print-color-adjust:exact;print-color-adjust:exact"' : ''));
      /* กดได้เฉพาะตอนเปิดโหมด · หน้าต่างพิมพ์ไม่มีฟังก์ชันพวกนี้ จึงต้องไม่ติดไปด้วย */
      const _hlClick = _VJ_HL_ON ? ` onclick="vjHlClick('${_hlKey}')"` : '';
      const _sxMv = x.strand==='mv';
      /* ══ §strandVjClear · ปุ่มล้างต้องอยู่ตรงที่คนเห็นปัญหา ══════════════════════════════
         แถวค้างขึ้นเด่นที่สุดในใบงานรถ · แต่ปุ่มล้างมีแค่ที่เช็คอินรถ / เช็คอินหน้าท่า /
         Travel Summary · ป้ายบอกเองด้วยซ้ำว่า "กดล้างการจัดรถที่หน้าเช็คอินรถ"
         คือระบบรู้ว่าต้องไปกดที่อื่น แล้วให้คนเดินไปเอง

         ⚠ เคสเลื่อนวันยิ่งหนัก · แถวนั้นมาจากภาพที่ถ่ายไว้ (ops_stranded) ไม่ได้มาจาก ops.vanId
           ปลดรถที่หน้าจัดรถจึงไม่มีผลอะไรเลย เพราะวันเดิมไม่เหลือ ops ให้ปลดอยู่แล้ว
           ckStrandMvDrop ถูกเรียกจากที่เดียวคือปุ่มนี้ · ไม่มีทางอื่นให้มันหาย
         ⚠ ซ่อนตอนพิมพ์ · ใบที่ส่งคนขับไม่ควรมีปุ่ม และหน้าต่างพิมพ์ไม่มีฟังก์ชันพวกนี้ */
      const _sxClr = (_sxR && b && b.id)
        ? `<button class="vj-sxclr" onclick="event.stopPropagation();ckStrandClear('${b.id}','${date}')" title="ล้างแถวค้างนี้ออกจากใบงานของวันนี้ · ใบจองไม่ถูกแตะ" style="margin-left:6px;background:#fff;border:1px solid #E4C0C0;color:#A32D2D;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">ล้างออก</button>`
        : '';
      const _sxTag = _sxR
        ? `<div style="margin-top:3px"><span style="display:inline-block;background:${_sxMv?'#EDE3FB':'var(--vjt-hlcxl-bg,#FBE3E1)'};color:${_sxMv?'#5B289A':'var(--vjt-hlcxl,#B5271F)'};font-weight:700;font-size:11px;border-radius:7px;padding:2px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#10007; ${_sxMv?('เลื่อนวันแล้ว'+(x.strandWhy?(' · '+e(String(x.strandWhy).split(' · ')[0])):'')):'ยกเลิกแล้ว'} · ไม่ต้องไปรับ</span>${_sxClr}</div>`
        : '';
      return `<tr${_rowBg}${_hlClick}>
        <td style="text-align:center;${_sxR?'color:#B5271F;font-weight:700':''}">${_no}</td>
        <td style="font-size:12.5px;word-break:break-all;font-variant-numeric:tabular-nums;color:#444">${e(b.voucherRef||b.code||b.id)}</td>
        <td style="font-size:var(--vjt-name,15.5px);font-weight:700;color:${_sxR?'#8f8e88':'#1B2A55'}${_sxR?';text-decoration:line-through;text-decoration-thickness:1.5px':''}">${e(b.leadPax||'-')}${_sxTag}${_ckTag}${(_ovnRet||_ovnOut)?`<div style="margin-top:2px"><span style="display:inline-block;background:${_ovnOut?'#EDE7FB':'#FBE4C9'};color:${_ovnOut?'#4A2E86':'#8a5500'};font-weight:700;font-size:10px;border-radius:7px;padding:1px 7px;white-space:nowrap">${_ovnOut?'&#127765; OVN':'&#8617; OVN'}</span></div>`:''}${(function(){ const _lead=String(b.leadPax||'').trim(); const _ex=(b.passengers||[]).map(p=>String((p&&p.name)||'').trim()).filter(n=>n&&n!==_lead); if(_ex.length){ let h=_ex.slice(0,2).map(n=>`<div class="ag" style="font-weight:600;color:#3F4654">${e(n)}</div>`).join(''); if(_ex.length>2) h+=`<div class="ag">+${_ex.length-2} more</div>`; return h; } return (b.passengers&&b.passengers.length)?`<div class="ag">+${b.passengers.length} more</div>`:''; })()}${x.splitPax!=null?`<div class="ag" style="color:#5B289A">${x.sMain?('&#128652; จุดหลัก'):(((x.sHotel||'').trim()||x.sAreaId)?('&#128652; แยกรับ'):('&#9986; แยกส่ง'))+(x.sWho?(' · '+e(x.sWho)):'')} · เดียวกัน ${e(b.voucherRef||b.code||b.id)}</div>`:''}${(x._mgN>1)?`<div class="ag" style="color:#0C6B47">&#128652; รับจุดเดียวกัน ${x._mgN} กลุ่ม · ขากลับแยกส่ง</div>`:''}</td>
        ${paxCells}
        <td style="text-align:center;font-variant-numeric:tabular-nums;font-weight:800;font-size:var(--vjt-time,17px);color:var(--vjt-hi,#C0271C);white-space:nowrap">${isRet?'<span style="color:#aaa;font-weight:400;font-size:14px">—</span>':(e(_ptime(b,t))||'-')}</td>
        <td style="font-size:var(--vjt-loc,14.5px);font-weight:600;color:#1B2A55">${e(pickup)||'<span style="color:#b00">— no pickup —</span>'}${_pkTh?`<div class="ag pkth" style="color:var(--vjt-think,#185FA5);font-weight:600;line-height:1.3;margin-top:1px">${e(_pkTh)}</div>`:''}${(!isRet&&Array.isArray(b.altPickups)&&b.altPickups.some(a=>(a.who||'').trim()||(a.place||'').trim()))?b.altPickups.filter(a=>(a.who||'').trim()||(a.place||'').trim()||a.area||a.areaId).map(a=>`<div style="color:#5B289A;font-size:11.5px;margin-top:2px">&#128652; <b>${Math.max(1,parseInt(a.qty)||1)} คน</b>${(a.who||'').trim()?(' · '+e((a.who||'').trim())):''}${a.zone?(' ['+e(a.zone)+']'):''} @ ${e((a.place||'').trim()||a.area||'?')}</div>`).join(''):''}</td>
        <td style="text-align:center">${e(b.roomNumber||'')||'-'}</td>
        <td>${zoneCell}</td>
        <td style="font-size:var(--vjt-loc,14.5px)">${dropCell}${retDiff?`<div style="margin-top:4px"><span style="display:inline-block;background:var(--vjt-hlret-bg,#FBE4C9);color:var(--vjt-hlret-ink,#8a5500);font-weight:700;font-size:12px;border-radius:7px;padding:3px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#8617; ขากลับ โดย ${e(retName)}</span></div>`:''}</td>
        <td style="text-align:center">${b.largeLuggage?('🧳 '+b.largeLuggage):'-'}</td>
        <td style="font-size:12.5px">${sreqCell}</td>
      </tr>`; }).join('');
    const secHd=`<div style="display:flex;align-items:center;gap:9px;margin:0 0 7px"><span style="background:${isRet?'var(--vjt-secret,#B07A1F)':'var(--vjt-secout,#0F6E56)'};color:#fff;font-size:12.5px;font-weight:700;border-radius:7px;padding:4px 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact">${isRet?'② ขากลับ · RETURN':'① ขาไป · OUTBOUND'}</span><span style="font-size:11.5px;color:#6b7280">${isRet?'รับจากท่าเรือ → ส่งจุดหมาย':'รับจากโรงแรม → ส่งท่าเรือ'}</span></div>`;
    const table=`<table style="table-layout:fixed;width:100%">
      ${_colg}
      <thead>
        <tr>
          <th rowspan="2">#</th><th rowspan="2">Voucher<small>VC</small></th><th rowspan="2">Lead name<small>ชื่อลูกค้า</small></th>
          <th colspan="4" style="text-align:center">Pax<small>จำนวน (คน)</small></th>
          <th rowspan="2">Pick-up time<small>เวลารับ</small></th><th rowspan="2">Pick-up location<small>จุดรับ</small></th>
          <th rowspan="2">Room<small>ห้อง</small></th><th rowspan="2">Zone<small>โซน</small></th>
          <th rowspan="2">Drop-off<small>จุดส่ง (ถ้าเปลี่ยน)</small></th><th rowspan="2">Bags<small>กระเป๋า</small></th>
          <th rowspan="2">Special request<small>คำขอพิเศษ</small></th>
        </tr>
        <tr><th style="text-align:center">AD</th><th style="text-align:center">CHD</th><th style="text-align:center">INF</th><th style="text-align:center">FOC</th></tr>
      </thead>
      <tbody>${tr}</tbody>
      <tfoot><tr style="font-weight:700;background:var(--vjt-thbg,#F4F8FC);color:var(--vjt-ink2,#15396B);-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <td colspan="3" style="text-align:right">รวม / Total</td>
        <td style="text-align:center">${totAd}</td><td style="text-align:center">${totChd}</td><td style="text-align:center">${totInf}</td><td style="text-align:center">${totFoc}</td>
        <td colspan="7">${totPax} pax · ${(function(){
            /* §altDrop · แยกส่งทำให้แถวเพิ่ม แต่จำนวน "ใบ" เท่าเดิม · ต้องนับใบไม่ใช่แถว */
            const _ids={}; let n=0, nd=0;
            rows.forEach(function(z){ if(z.strand) return; const k=z.b&&z.b.id; if(k&&!_ids[k]){_ids[k]=1;n++;}
              if(z.sp && ((z.sp.dropHotel||'').trim()||z.sp.dropAreaId)) nd++; });
            return n+' booking'+(nd>0?(' · แยกส่ง '+nd+' จุด'):'');
          })()}${_nSx>0?` <span style="color:#B5271F">· ค้างจัดการ ${_nSx} (ยกเลิก/เลื่อนวัน · ไม่นับ)</span>`:''}</td>
      </tr></tfoot>
    </table>`;
    return {rows, totPax, html:secHd+table};
  };
  /* ══ §vjRound3 · ขากลับไม่มีรอบ ══════════════════════════════════════════
     ขาไปแบ่งรอบเพราะรถวิ่งไปรับสองเที่ยว · แต่ขากลับทุกคนลงเรือลำเดียวกลับมา
     พร้อมกัน รถวิ่งส่งเที่ยวเดียว = งานเดียว
     ถ้าพิมพ์ตารางขากลับชุดเดิมลงทุกใบ คนขับได้รายชื่อขากลับซ้ำสองใบ
     แล้วอาจนึกว่าต้องวิ่งส่งสองรอบ · ให้ขากลับอยู่ในใบรอบแรกใบเดียว
     ใบรอบหลังบอกไว้บรรทัดเดียวว่าไปดูที่ใบรอบแรก */
  const _retSkip=!!(_RND && _RND.no>1);
  const out=_section(false), ret=_retSkip?{rows:[],totPax:0,html:''}:_section(true);
  const _retMoved=_retSkip?_section(true):null;
  // ⚠ Late-booking guard — bookings on THIS van's route(s) that day with NO van yet (likely a booking added after the van was arranged → would silently drop off this sheet)
  const _vanRoutes=new Set(); if(routeId){ _vanRoutes.add(routeId); } else { out.rows.forEach(x=>{ if(x.t&&x.t.routeId) _vanRoutes.add(x.t.routeId); }); _vehDayRoutes(v,date).forEach(r=>_vanRoutes.add(r)); }
  // bookings already visible on THIS sheet (outbound OR return) can't "drop off this sheet" → exclude from the guard (fixes the confusing warning for a booking that returns with this van but has no outbound van — it's shown in the return section)
  const _onSheet=new Set(); out.rows.forEach(x=>{ if(x.b) _onSheet.add(x.b.id); }); ret.rows.forEach(x=>{ if(x.b) _onSheet.add(x.b.id); });
  let _unaPax=0,_unaBk=0; const _unaTrip={};
  if(_vanRoutes.size){ (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; if(b.pickupSelf)return; if(_onSheet.has(b.id))return;   // already on this sheet
    (b.trips||[]).forEach(t=>{ if((t.date||'')!==date) return; if(!_vanRoutes.has(t.routeId)) return; const z=bkV2EffZone(b,t); if(z==='NoTransfer'||z==='NT') return;
      const o=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{}); const _nm=((typeof getRoute==='function'?getRoute(t.routeId):null)||{}).name||t.routeId;   /* §per-trip ops · เดิมอ่าน b.ops → OVN วันที่ 2 ที่ยังไม่มีรถ ถูกมองว่า "มีรถแล้ว" เพราะไปเห็นรถของวันที่ 1 → คำเตือน "ยังไม่มีรถ" ไม่ขึ้น */
      if(Array.isArray(o.vanSplits)&&o.vanSplits.length){ o.vanSplits.forEach(s=>{ if(!s.vanId){ const hp=+s.pax||0; _unaPax+=hp; _unaBk++; _unaTrip[_nm]=(_unaTrip[_nm]||0)+hp; } }); }
      else if(!o.vanId){ const hp=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; _unaPax+=hp; _unaBk++; _unaTrip[_nm]=(_unaTrip[_nm]||0)+hp; }
    }); }); }
  const _unaTxt=Object.keys(_unaTrip).map(k=>e(k)+' '+_unaTrip[k]+' คน').join(' · ');
  const _unaBanner = _unaPax>0 ? `<div style="background:var(--vjt-hlwarn-bg,#FBE9E7);border:2px solid var(--vjt-hlwarn,#C0392B);border-radius:9px;padding:10px 15px;margin:0 0 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:var(--vjt-hlwarn-ink,#9B1B12)">&#9888; เส้นทางนี้ยังมี ${_unaBk} booking (${_unaPax} คน) ที่ยังไม่ได้จัดรถ — อาจตกจากใบงานนี้</div><div style="font-size:12px;color:var(--vjt-hlwarn-ink,#8A1C1C);opacity:.85;margin-top:3px">${_unaTxt} · ไปจัดรถที่ By trip date &rarr; โหมด Van แล้วพิมพ์ใบงานใหม่</div></div>` : '';
  // ⚠ van-group conflict touching THIS van → some of its members are routed to a different van → this sheet may be wrong
  const _conf=(typeof bkV2VanGroupConflicts==='function')?bkV2VanGroupConflicts(date).filter(c=>c.vans[vanId]):[];
  const _confTxt=_conf.map(c=>e(c.routeName)+' กรุ๊ป '+c.gid+': '+Object.keys(c.vans).map(x=>e((vehGet(x)||{}).name||x)+'×'+c.vans[x]).join(' / ')).join(' · ');
  const _confBanner=_conf.length?`<div style="background:var(--vjt-hlconf-bg,#F3E0F7);border:2px solid var(--vjt-hlconf,#7A1FA2);border-radius:9px;padding:10px 15px;margin:0 0 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:var(--vjt-hlconf-ink,#5E1480)">&#9888; รถปนกันในกรุ๊ป — บาง booking ถูกจัดไปคนละคัน ใบงานนี้อาจไม่ครบ/ผิดคัน</div><div style="font-size:12px;color:var(--vjt-hlconf-ink,#6A1C8A);opacity:.85;margin-top:3px">${_confTxt} · ไป By trip date &rarr; โหมด Van เลือกรถของกรุ๊ปให้เป็นคันเดียว แล้วพิมพ์ใหม่</div></div>`:'';
  let dlabel=date; try{ dlabel=new Date(date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}); }catch(_){}
  const routesStr=Object.keys(_allRoutes).map(e).join(' · ')||'—';
  const metaCounts=(out.rows.length||ret.rows.length||(_retMoved&&_retMoved.rows.length))
    ? `<span style="font-size:15px;font-weight:700;color:#fff">ขาไป ${out.totPax||0} คน${_retSkip?'':(' · ขากลับ '+(ret.totPax||0)+' คน')}</span>`
    : 'ไม่มี booking';
  const _retNote=(_retSkip && _retMoved && _retMoved.rows.length)
    ? `<div style="background:#FBF3E6;border:2px solid #E3C489;border-radius:9px;padding:10px 15px;margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:#7A5200">&#8617; ขากลับไม่ได้อยู่ในใบนี้ — อยู่ในใบรอบ 1</div><div style="font-size:12px;color:#8A6200;margin-top:3px">ขากลับทุกคนลงเรือลำเดียวกลับมาพร้อมกัน รถวิ่งส่งเที่ยวเดียว (${_retMoved.totPax||0} คน) จึงพิมพ์ไว้ใบเดียว ไม่ซ้ำทุกรอบ</div></div>`
    : '';
  const body = (out.html||'') + (ret.html?((out.html?'<div style="height:16px"></div>':'')+ret.html):'') + _retNote + ((!out.html&&!ret.html&&!_retNote)?'<div style="text-align:center;padding:24px;color:#888">No bookings assigned to this van</div>':'');
  void VC; void VC2;   /* §vjFix1 · สีหัวใบย้ายไปอยู่ในตัวแปร CSS แล้ว จะได้เปลี่ยนสดๆ ได้ */
  return `<div class="hd" style="align-items:center;background:linear-gradient(100deg,var(--vjt-main,#0F6E56) 0%,var(--vjt-main2,#0b5443) 100%);color:#fff;border:none;border-radius:12px;padding:15px 22px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
      <div class="h1" style="flex:1;min-width:0;color:#fff">LOVE ANDAMAN · Van Job Order<small style="color:rgba(255,255,255,.72)">ใบงานรถรับ-ส่ง · ขาไป + ขากลับ ในใบเดียว</small></div>
      <div style="flex:0 0 auto;text-align:center;padding:0 18px">
        <div style="font-size:var(--vjt-van,32px);font-weight:800;color:#fff;line-height:1.05;letter-spacing:.01em">${e(v.name||v.plate||vanId)}${_drv.plate&&_drv.plate!=='-'?` <span style="font-size:19px;color:rgba(255,255,255,.80);font-weight:700;font-variant-numeric:tabular-nums">${e(_drv.plate)}${_drv.plateOverride?' <span style="font-size:11px;color:#FFE9A8">&#128204;</span>':''}</span>`:''}</div>
        <div style="font-size:16px;color:rgba(255,255,255,.92);margin-top:5px;font-weight:600">คนขับ <b style="color:#fff">${e(_drv.driver||'-')}</b>${_drv.phone?` · <b style="font-variant-numeric:tabular-nums;color:#fff">${e(_drv.phone)}</b>`:''}${_drv.override?` <span style="font-size:11px;font-weight:700;color:var(--vjt-hlupd-ink,#5a3b00);background:var(--vjt-hlupd,#FFE08A);border-radius:6px;padding:2px 8px;margin-left:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#128204; อัปเดตวันนี้</span>`:''}</div>
      </div>
      <div class="meta" style="flex:1;color:rgba(255,255,255,.92)">${e(v.ownership==='partner'?('รถร่วม '+(v.partnerName||'')):'รถบริษัท')} · ${e(v.zoneBase||'')}<br>${e(dlabel)}<br>${metaCounts}${_RND?`<br><span style="display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.5);border-radius:7px;padding:2px 10px;font-size:14px;font-weight:800;color:#fff;margin-top:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact">&#8635; ${e(vjRoundLbl(_RND))}</span>`:''}</div>
    </div>
    <div class="bighd">
      <div class="bh-lbl">Route / โปรแกรม</div>
      <div class="bh-line"><span class="bh-route">${routesStr}</span><span class="bh-sep">·</span><span class="bh-date">${e(dlabel)}</span>${_RND?`<span class="bh-sep">·</span><span class="bh-route" style="color:#5B289A">&#8635; ${e(vjRoundLbl(_RND))}${_RND.tm?(' · ออก '+e(_RND.tm)):''}</span>`:''}</div>
    </div>
    ${_RND?`<div style="background:#F4F2FB;border:2px solid #C9BCEA;border-radius:9px;padding:9px 15px;margin:0 0 13px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:14px;font-weight:800;color:#4A2E86">&#8635; ใบนี้คือ${e(vjRoundLbl(_RND))} ของรถคันนี้ในโปรแกรมนี้${_RND.tm?(' · ออก '+e(_RND.tm)):''}</div><div style="font-size:12px;color:#5B4A8A;margin-top:3px">วันนี้รถคันนี้วิ่งโปรแกรมนี้ ${_RND.tot} รอบ คนละเวลา — ${_RND.tot>1?('อีก '+(_RND.tot-1)+' รอบอยู่คนละใบ ดูใบของรอบนั้นแยกต่างหาก'):''}</div></div>`:''}
    ${_confBanner}
    ${_unaBanner}
    ${body}
    <div class="note">หมายเหตุ / Notes: ① ขาไป = รถคันนี้รับจากโรงแรมส่งท่าเรือ · ② ขากลับ = รถคันนี้รับจากท่าเรือส่งจุดหมาย · รายที่ป้าย "↩ ขากลับ โดย ‹รถ›" = ขากลับใช้รถคันอื่น (ดูใบงานของรถคันนั้น)</div>
    <div class="callnote">&#9742; หาลูกค้าไม่เจอ ให้รอไม่เกิน <b>5 นาที</b> · มีปัญหาในการรับลูกค้า ติดต่อ <b>088-765-4678</b> · <b>081-970-9977</b> · <b>093-583-7962</b></div>`;
}
function vanCkDateShift(delta){ var d=new Date(_vanCkDate+'T12:00:00'); d.setDate(d.getDate()+delta); _vanCkDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); renderVanCheckin(); }
function vanCkToday(){ _vanCkDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10); renderVanCheckin(); }
// Save the van job order as a high-res PNG · captured at the width you actually see in the drawer
// (1360–2000px) at scale 2 → 2720–4000px wide. Wider drawer = bigger, sharper PNG, not a blurrier one. · for sending to drivers on LINE/WhatsApp
function _vjEnsureH2C(cb){ if(window.html2canvas){cb();return;} var s=document.getElementById('vj-h2c'); if(s){ s.addEventListener('load',cb); return; } s=document.createElement('script'); s.id='vj-h2c'; s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload=cb; s.onerror=function(){ alert('โหลดตัวสร้างรูปไม่สำเร็จ · ต้องต่ออินเทอร์เน็ต แล้วลองใหม่'); }; document.body.appendChild(s); }
function vanJobsSaveImage(date, vanId, routeId, leg, grp){
  _vjEnsureH2C(function(){
    var _pg=document.getElementById('vjo-page');
    var _sw=Math.max(1360, Math.min(2000, (_pg&&_pg.clientWidth)||1360));   // capture at the width you actually see
    var _hw=_sw+64;                                                          // + 32px margin each side
    var host=document.createElement('div'); host.id='vj-imghost';
    host.style.cssText='position:fixed;left:-99999px;top:0;width:'+_hw+'px;background:#fff;box-sizing:border-box;z-index:-1';
    var _hlWas=_VJ_HL_ON; _VJ_HL_ON=false;   /* §vjRowHl · รูปเอาสีไปด้วย แต่ไม่เอา onclick */
    host.innerHTML=vanJobsOrderCss(true)
      +'<div id="vj-shot" style="width:'+_hw+'px;background:#fff;padding:32px;box-sizing:border-box">'
      +'<div class="vjo" style="'+vjTplVars(vanId)+'">'+vanJobsOrderInner(date,vanId,routeId,leg,grp)+'</div></div>';
    document.body.appendChild(host); _VJ_HL_ON=_hlWas;
    var tgt=host.querySelector('#vj-shot')||host;   // capture the padded wrapper, not the sheet inside it
    window.html2canvas(tgt,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:_hw+48}).then(function(canvas){
      canvas.toBlob(function(blob){
        try{ var vn=((typeof vehGet==='function'&&vehGet(vanId))||{}).name||vanId; var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; var _rr=(typeof vjRoundOf==='function')?vjRoundOf(date,vanId,routeId,+grp||0):null;
             a.download='vanjob-'+String(vn).replace(/\s+/g,'')+'-'+date+(_rr?('-รอบ'+_rr.no):'')+(leg==='ret'?'-return':'')+'.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); },4000); }catch(e){}
        host.remove();
      },'image/png');
    }).catch(function(e){ host.remove(); alert('สร้างรูปไม่สำเร็จ: '+((e&&e.message)||e)); });
  });
}
function vehSetOwnerF(o){ _vehOwnerF=o; renderVehicles(); }
function _vehOwnerMatch(v){ return _vehOwnerF==='all' ? true : _vehOwnerF==='partner' ? (v.ownership==='partner') : (v.ownership!=='partner'); }
function vehSelect(id){ _vehSel=(_vehSel===id?null:id); renderVehicles(); }
function vehSetZoneF(z){ _vehZoneF=z; renderVehicles(); }
function vehSetStatusF(s){ _vehStatusF=s; renderVehicles(); }
function vehSetTab(t){ _vehTab=t; renderVehicles(); }
function vehSetVehDate(delta){ const d=new Date(_vehDate+'T12:00:00'); d.setDate(d.getDate()+delta); _vehDate=bkV2LocalYMD(d); renderVehicles(); }
function vehCalShift(n){ const [y,m]=_vehCalMonth.split('-').map(Number); const d=new Date(y,m-1+n,1); _vehCalMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); renderVehicles(); }
function vehMonthShift(n){ const [y,m]=_vehMonth.split('-').map(Number); const d=new Date(y,m-1+n,1); _vehMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); renderVehicles(); }
function _vehDayJobN(id,date){ let jb=0; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; if(bkOpsRead(b,date).vanId!==id)return; (b.trips||[]).forEach(t=>{ if((t.date||'')===date) jb++; }); }); return jb; }
function _vehDayCellInner(v,date){
  const st=(typeof vehStatusOn==='function')?vehStatusOn(v,date):((v.dayStatus&&v.dayStatus[date])||'');
  const routes=_vehDayRoutes(v,date);
  const jb=_vehDayJobN(v.id,date);
  let bg='transparent',bd='1px solid #eceae3',fg='#888',txt='',ttl='';
  if(st==='off'){ bg='#FCEBEB';bd='1px solid #E6C9C3';fg='#A32D2D';txt='&#9941;'; }
  else if(st==='maintenance'){ bg='#FAEEDA';bd='1px solid #EAD9B0';fg='#854F0B';txt='&#128295;'; }
  else if(routes.length>=2){
    // van runs 2+ programs this day → split-colour cell + program count
    const cols=routes.map(rid=>{ const rt=_vehRoute(rid); return (rt&&rt.color)?rt.color:'#9AA3AF'; });
    const n=cols.length;
    const stops=cols.map((c,i)=>`${c} ${Math.round(i/n*100)}%, ${c} ${Math.round((i+1)/n*100)}%`).join(', ');
    bg=`linear-gradient(135deg, ${stops})`; bd='1px solid rgba(0,0,0,.12)'; fg='#fff'; txt=n;
    ttl=routes.map(rid=>(typeof _vehRouteAbbr==='function'?_vehRouteAbbr(rid):rid)).join(' + ');
  }
  else if(routes.length===1){
    const dr=routes[0]; const rt=_vehRoute(dr); const rc=rt?rt.color:null;
    if(rc){ bg=rc;bd='1px solid '+rc;fg='#fff';txt=(typeof _vehRouteAbbr==='function'?_vehRouteAbbr(dr):dr); }
    else if(jb>0){ bg='#1D9E75';bd='none';fg='#fff';txt=jb; }
    else if(st==='available'){ bg='#E9F7EF';bd='1px solid #C4E6D5';fg='#0F6E56';txt=''; }
  }
  else if(jb>0){ bg='#1D9E75';bd='none';fg='#fff';txt=jb; }
  else if(st==='available'){ bg='#E9F7EF';bd='1px solid #C4E6D5';fg='#0F6E56';txt=''; }   // no ✓ mark · availability shown by colour
  /* §vehRound · ช่องนี้เคยบอกแค่ "วิ่งโปรแกรมไหน" กับ "กี่ booking"
     ไม่เคยบอกว่ากี่รอบ · รถคันเดียววิ่งโปรแกรมเดิมสองรอบ (ป่าตองเช้า · พันวาสาย)
     หน้าตาเหมือนคันที่วิ่งรอบเดียวเป๊ะ คนดูตารางเดือนเลยนับกำลังรถผิด */
  const _rnTot=routes.reduce(function(a,rid){ return a+Math.max(1,(typeof vehDayRoundN==='function')?vehDayRoundN(v.id,date,rid):1); },0);
  const _rnMore=(routes.length>0 && _rnTot>routes.length);
  if(_rnMore){ ttl=(ttl||routes.map(function(rid){ return (typeof _vehRouteAbbr==='function'?_vehRouteAbbr(rid):rid); }).join(' + '))+' · วิ่ง '+_rnTot+' รอบ'; }
  const rnBadge=_rnMore?`<span title="วันนี้วิ่ง ${_rnTot} รอบ (คนละเวลา) — ใบงานรถแยกใบตามรอบ" style="position:absolute;bottom:-5px;left:-5px;height:13px;padding:0 3px;border-radius:7px;background:#fff;border:1.5px solid #5B289A;color:#5B289A;font-size:7.5px;line-height:10px;font-weight:800;letter-spacing:-.02em">&times;${_rnTot}</span>`:'';
  const jbBadge=(routes.length>0&&jb>0)?`<span style="position:absolute;top:-4px;right:-4px;min-width:13px;height:13px;padding:0 2px;border-radius:7px;background:#1B2A55;color:#fff;font-size:8px;line-height:13px;text-align:center;font-weight:700">${jb}</span>`:'';
  const warn=(jb>0 && (st==='maintenance'||st==='off'))?'<span style="position:absolute;top:-3px;right:-3px;font-size:9px">&#9888;</span>':'';
  return `<div ${ttl?`title="${ttl}"`:''} style="position:relative;margin:3px auto;width:28px;height:24px;border-radius:5px;background:${bg};border:${bd};color:${fg};display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-weight:700;font-size:10px;cursor:pointer">${txt}${jbBadge}${rnBadge}${warn}</div>`;
}
// Per-day popup · set zone + status + see trips
function vehDayPopup(id,date){
  const v=vehGet(id); if(!v) return; const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const old=document.getElementById('veh-day-modal'); if(old) old.remove();
  const dz=(v.dayZone&&v.dayZone[date])||''; const st=(typeof vehStatusOn==='function')?vehStatusOn(v,date):((v.dayStatus&&v.dayStatus[date])||'');
  let dlbl=date; try{ dlbl=new Date(date+'T12:00:00').toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'}); }catch(_){}
  // trips today for this van
  const jobs=[]; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; if(bkOpsRead(b,date).vanId!==id)return; (b.trips||[]).forEach(t=>{ if((t.date||'')===date) jobs.push({b,t}); }); });
  const jrows=jobs.length?jobs.map(x=>{ const a=sbGetAgent(x.b.agentId); const tm=(x.b.ops&&x.b.ops.pickupTimeFinal)||x.t.pickupTime||x.b.pickupTime||'—'; const px=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(x.t.pax||{}):0; return `<div style="display:flex;gap:8px;padding:5px 0;border-top:1px solid #f3f1ea;font-size:11.5px"><span style="font-family:'DM Mono',monospace;color:#185FA5;min-width:50px">${e(tm)}</span><span style="flex:1;min-width:0">${e(x.b.leadPax||x.b.voucherRef||x.b.id)} <span style="color:#8a8a82">· ${e(a?a.name:'')}</span></span><span style="font-family:'DM Mono',monospace">${px} pax</span></div>`; }).join(''):'<div style="font-size:11px;color:#c7c5bb;padding:6px 0">ไม่มีงานวันนี้</div>';
  /* ══ §vehRound · งานวันนี้ของคันนี้ แบ่งเป็นรอบ ══════════════════════════
     รอบไม่ใช่ข้อมูลที่เก็บไว้ · มันคือ "กรุ๊ป" ที่คนจัดรถจับไว้ตอนจัดรถอยู่แล้ว
     ตรงนี้แค่แปลกลับ: กรุ๊ปไหนของคันนี้ในโปรแกรมนี้ คือรอบที่เท่าไหร่
     เรียงตามเวลารับ ไม่ใช่เลขกรุ๊ป */
  const _rnd=(function(){
    var by={}, ord=[];
    jobs.forEach(function(x){
      var o=(typeof bkOpsRead==='function')?bkOpsRead(x.b,date):{}; if(!o) return;
      var gg=0;
      if(Array.isArray(o.vanSplits)&&o.vanSplits.length){
        var _s=o.vanSplits.filter(function(q){ return q&&q.vanId===id; })[0];
        gg=+((_s&&_s.vanGroup)||0);
      } else gg=+(o.vanGroup)||0;
      if(!gg) return;
      var rr=(typeof vjRoundOfC==='function')?vjRoundOfC(date,id,x.t.routeId||'',gg):null;
      if(!rr) return;
      var k=(x.t.routeId||'')+'#'+rr.no;
      if(!by[k]){ by[k]={rid:x.t.routeId||'', no:rr.no, tot:rr.tot, tm:rr.tm, n:0, pax:0}; ord.push(k); }
      by[k].n++;
      by[k].pax+=((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(x.t.pax||{}):0);
    });
    return ord.map(function(k){ return by[k]; })
              .sort(function(a,b){ return (a.rid<b.rid?-1:a.rid>b.rid?1:0)||(a.no-b.no); });
  })();
  const _rndHtml=(_rnd.length>=2)?('<div style="background:#F4F2FB;border:1px solid #D9CEF0;border-radius:8px;padding:8px 11px;margin-bottom:12px">'
    +'<div style="font-size:11px;font-weight:800;color:#4A2E86;margin-bottom:5px">&#8635; วันนี้วิ่ง '+_rnd.length+' รอบ คนละเวลา <span style="font-weight:500;color:#7a6aa5">· ใบงานรถแยกใบตามรอบ</span></div>'
    +_rnd.map(function(r){ var rn=(typeof _vehRouteShort==='function')?_vehRouteShort(r.rid):r.rid;
        return '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:#3a3a36;padding:2px 0">'
          +'<span style="flex:none;background:#5B289A;color:#fff;border-radius:5px;padding:1px 7px;font-size:10px;font-weight:800">รอบ '+r.no+'</span>'
          +'<span style="font-family:\'DM Mono\',monospace;color:#185FA5;min-width:52px">'+e(r.tm||'—')+'</span>'
          +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e(rn)+'</span>'
          +'<span style="font-family:\'DM Mono\',monospace;color:#6a6a64;flex:none">'+r.n+' bk · '+r.pax+' pax</span>'
          +'</div>'; }).join('')
    +'</div>'):'';
  const routes=_vehDayRoutes(v,date);
  const fams=(typeof _vehRoutesOpenOn==='function')?_vehRoutesOpenOn(date):[];
  const rBtn=f=>{ const on=routes.includes(f.id); const z=(typeof _vehRouteZone==='function')?_vehRouteZone(f.id):null; const zl=z==='PK'?'ภูเก็ต':z==='KL'?'เขาหลัก':'—'; const dm=(typeof _vehRouteDemand==='function')?_vehRouteDemand(f.id,date):{pax:0,pickup:0}; const paxChip=dm.pax?`<span style="font-size:10px;font-family:'DM Mono',monospace;font-weight:700;padding:1px 6px;border-radius:6px;background:${on?'rgba(255,255,255,.22)':'#EEF5FC'};color:${on?'#fff':'#185FA5'}">ลค ${dm.pax}</span>`:''; const chk=on?'<span style="width:15px;height:15px;border-radius:4px;background:#fff;color:'+f.color+';font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none">&#10003;</span>':'<span style="width:15px;height:15px;border-radius:4px;border:1.5px solid '+f.color+';flex:none"></span>'; return `<button onclick="vehDayToggleRoute('${id}','${date}','${f.id}')" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:1px solid ${on?f.color:'#e3e1da'};background:${on?f.color:'#fff'};color:${on?'#fff':'#444'};border-radius:8px;padding:8px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:5px">${chk}<span style="flex:1">${e(f.name)}</span>${paxChip}<span style="font-size:10px;font-family:'DM Mono',monospace;opacity:.85">${(typeof _vehRouteAbbr==='function'?_vehRouteAbbr(f.id):'')} · ${zl}</span></button>`; };
  const sBtn=(val,lbl,col)=>`<button onclick="vehDaySetStatus('${id}','${date}','${val}')" style="flex:1;border:1px solid ${st===val?col:'#ddd'};background:${st===val?col:'#fff'};color:${st===val?'#fff':'#555'};border-radius:7px;padding:7px 0;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${lbl}</button>`;
  const ov=document.createElement('div'); ov.id='veh-day-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;width:380px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.28)" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid #eee">
      <div><div style="font-size:14px;font-weight:800;color:#1B2A55">${e(v.name||id)}</div><div style="font-size:11px;color:#8a8a82">${e(dlbl)} · โซนหลัก ${e(v.zoneBase)}</div></div>
      <button onclick="vehDayClose()" style="background:transparent;border:none;font-size:20px;color:#999;cursor:pointer">&times;</button>
    </div>
    <div style="padding:14px 16px">
      <div style="font-size:11px;color:#8a8a82;font-weight:600;margin-bottom:5px">สถานะวันนี้ <span style="color:#bbb;font-weight:500">· จากหน้าสถานะ</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:12px;font-weight:700;padding:4px 11px;border-radius:7px;background:${st==='off'?'#FCEBEB':st==='maintenance'?'#FAEEDA':st==='available'?'#E1F5EE':'#F1EFE8'};color:${st==='off'?'#A32D2D':st==='maintenance'?'#854F0B':st==='available'?'#0F6E56':'#8a8a82'}">${st==='off'?'⛔ ':st==='maintenance'?'🔧 ':st==='available'?'✓ ':''}${st?(VEH_ST_LBL[st]||st):'ยังไม่กำหนด'}</span>
        <button onclick="vehDayClose();vehStatusOpen('${id}')" style="margin-left:auto;background:#fff;border:1px solid #ddd;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#185FA5">จัดการช่วงสถานะ (จาก–ถึง)</button>
      </div>
      ${(st==='off'||st==='maintenance')?`<div style="background:#FCF4F2;border:1px solid #F0D9D2;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#A32D2D;margin-bottom:4px">รถ${st==='maintenance'?'ติดซ่อม':'หยุดวิ่ง'}วันนี้ — แนะนำไม่จัดเส้นทาง (แก้สถานะที่หน้าสถานะก่อน)</div>`:`
      <div style="font-size:11px;color:#8a8a82;font-weight:600;margin-bottom:6px">วิ่งเส้นทางไหนวันนี้ <span style="color:#bbb;font-weight:500">· เลือกได้หลายเส้นทางถ้าวิ่งหลายงาน</span></div>
      ${routes.length>=2?`<div style="background:#EEF5FC;border:1px solid #CFE3F5;border-radius:8px;padding:7px 10px;font-size:11.5px;color:#185FA5;margin-bottom:8px;font-weight:600">🚐 วันนี้วิ่ง ${routes.length} เส้นทาง — จะเลือกได้ในทุกเส้นทางตอนจัดรถ (Van Assign)</div>`:''}
      <div style="margin-bottom:4px;max-height:280px;overflow:auto">${fams.length?fams.map(rBtn).join(''):'<div style="font-size:11px;color:#c7c5bb;padding:4px 0">ไม่มีโปรแกรมเปิดวันนี้</div>'}${routes.length?`<button onclick="vehDayClearRoutes('${id}','${date}')" style="border:1px solid #ddd;background:#fff;color:#A32D2D;border-radius:7px;padding:6px 11px;font-size:11px;cursor:pointer;font-family:inherit;margin-top:2px">ล้างทั้งหมด</button>`:''}</div>`}
      <div style="font-size:11px;color:#185FA5;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:12px;margin-bottom:8px">งานวันนี้ · ${jobs.length}</div>
      ${_rndHtml}
      ${jrows}
    </div>
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) vehDayClose(); };
  document.body.appendChild(ov);
}
function _vehDayRefresh(id,date){ const v=vehGet(id); const cell=document.getElementById('vehcell-'+id+'-'+date); if(cell&&v) cell.innerHTML=_vehDayCellInner(v,date); if(document.getElementById('veh-day-modal')) vehDayPopup(id,date); }
function vehDaySetZone(id,date,z){ const v=vehGet(id); if(!v)return; v.dayZone=v.dayZone||{}; if(z){ v.dayZone[date]=z; } else { delete v.dayZone[date]; } vehLog(id,'zone',date+' · โซน '+(z||'ตามหลัก')); sbVehiclesPersist(); _vehDayRefresh(id,date); }
function _vehFam(fid){ return (typeof _BKV2_FAMILIES!=='undefined'?_BKV2_FAMILIES:[]).find(f=>f.id===fid)||null; }
function _vehFamPier(fid){ if(typeof ROUTES==='undefined')return null; const r=ROUTES.find(rr=>{ const f=bkV2RouteFamily(rr.id); return f&&f.id===fid; }); return r?r.pier:null; }
function _vehFamZone(fid){ const p=_vehFamPier(fid); return p==='panwa'?'PK':p==='tublamu'?'KL':null; }
function _vehFamsOpenOn(date){ if(typeof ROUTES==='undefined') return (typeof _BKV2_FAMILIES!=='undefined'?_BKV2_FAMILIES:[]); const set={}; ROUTES.forEach(r=>{ if(typeof bkV2IsRouteOpenOn==='function' && !bkV2IsRouteOpenOn(r.id,date)) return; const f=bkV2RouteFamily(r.id); if(f) set[f.id]=f; }); const arr=Object.values(set); return arr.length?arr:(typeof _BKV2_FAMILIES!=='undefined'?_BKV2_FAMILIES:[]); }
// ── Real-program (route) helpers · matrix assigns actual ROUTES, not grouped families ──
function _vehRoute(rid){ return (typeof ROUTES!=='undefined'?ROUTES:[]).find(r=>r.id===rid)||null; }
function _vehRouteZone(rid){ const r=_vehRoute(rid); if(!r)return null; return r.pier==='panwa'?'PK':r.pier==='tublamu'?'KL':null; }
function _vehRouteAbbr(rid){ return String(rid||'').replace(/^r/i,''); }
function _vehRouteShort(rid){ const r=_vehRoute(rid); if(!r)return rid; return String(r.name||rid).replace(/\bIslands?\b/gi,'').replace(/\bby\b/gi,'').replace(/\s+/g,' ').trim(); }
function _vehRoutesOpenOn(date){ const rs=(typeof ROUTES!=='undefined'&&ROUTES)||[]; const open=rs.filter(r=> typeof bkV2IsRouteOpenOn!=='function' || bkV2IsRouteOpenOn(r.id,date)); return open.length?open:rs; }
// Customer demand on a route+date · pax = total seat pax · pickup = pax needing transfer (zone PK/KL, not No-Transfer)
function _vehRouteDemand(routeId,date){ let pax=0,pickup=0; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; (b.trips||[]).forEach(t=>{ if(t.routeId!==routeId||t.date!==date)return; if(t.bookingMode==='charter')return; const p=(typeof getTripPaxTotal==='function')?getTripPaxTotal(t):((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0); pax+=p; const z=t.zone||b.pickupZone||''; if(z&&z!=='NoTransfer'&&z!=='NT')pickup+=p; }); }); return {pax,pickup}; }
// A van can run MORE THAN ONE program in a day (2 jobs) → dayRoute[date] may be a single routeId (legacy) OR an array of routeIds. Always read via this normalizer.
function _vehDayRoutes(v,date){ const dr=v&&v.dayRoute&&v.dayRoute[date]; if(!dr)return []; return Array.isArray(dr)?dr.filter(Boolean):[dr]; }
function vehDaySetRoute(id,date,fid){ const v=vehGet(id); if(!v)return; v.dayRoute=v.dayRoute||{}; if(fid){ v.dayRoute[date]=fid; } else { delete v.dayRoute[date]; } const f=_vehRoute(fid); vehLog(id,'zone',date+' · เส้นทาง '+(f?f.name:'ล้าง')); sbVehiclesPersist(); _vehDayRefresh(id,date); _vehSumRefresh(); }
// Toggle one route in/out of the day's list (for vans running multiple programs that day)
function vehDayToggleRoute(id,date,rid){ const v=vehGet(id); if(!v||!rid)return; v.dayRoute=v.dayRoute||{}; const arr=_vehDayRoutes(v,date); const i=arr.indexOf(rid); if(i>=0) arr.splice(i,1); else arr.push(rid); if(arr.length){ v.dayRoute[date]=arr.length===1?arr[0]:arr; } else { delete v.dayRoute[date]; } const f=_vehRoute(rid); vehLog(id,'zone',date+' · '+(i>=0?'เอาออก':'เพิ่ม')+'เส้นทาง '+(f?f.name:rid)); sbVehiclesPersist(); _vehDayRefresh(id,date); _vehSumRefresh(); }
function vehDayClearRoutes(id,date){ const v=vehGet(id); if(!v||!v.dayRoute)return; delete v.dayRoute[date]; vehLog(id,'zone',date+' · ล้างเส้นทาง'); sbVehiclesPersist(); _vehDayRefresh(id,date); _vehSumRefresh(); }
// Click cell = cycle program fast (blank → fam1 → fam2 … → blank). Off/maintenance → open detail popup instead.
function vehDayCellClick(id,date){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no day route/status edit */
  const v=vehGet(id); if(!v)return; const st=(typeof vehStatusOn==='function')?vehStatusOn(v,date):''; if(st==='off'||st==='maintenance'){ vehDayPopup(id,date); return; } const routes=_vehDayRoutes(v,date); if(routes.length>=2){ vehDayPopup(id,date); return; } /* multi-route day → manage in popup */ const rts=(typeof _vehRoutesOpenOn==='function')?_vehRoutesOpenOn(date):[]; if(!rts.length){ vehDayPopup(id,date); return; } const order=['',...rts.map(r=>r.id)]; const cur=routes[0]||''; let i=order.indexOf(cur); if(i<0)i=0; const nx=order[(i+1)%order.length]; vehDaySetRoute(id,date,nx); }
function vehSumSelectDay(date){ window._vehSumDay=date; if(typeof renderVehicles==='function') renderVehicles(); }
function _vehSumRefresh(){ const el=document.getElementById('veh-matrix-summary'); if(el && window._vehSumDay) el.innerHTML=_vehMatrixSummaryHTML(window._vehSumDay); }
// Summary cards — vehicles per real PROGRAM (route) on the selected day
function _vehGroupsForDay(routeId,day){
  const set=new Set(); const vanByKey={};
  (SB_BOOKINGS||[]).forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status))return;
    (b.trips||[]).forEach(t=>{
      if(t.routeId!==routeId||t.date!==day)return; if(t.bookingMode==='charter')return;
      const zone=t.zone||b.pickupZone||''; const ops=b.ops||{};
      const addG=(g,vid)=>{ if(!g)return; const k=zone+'|'+g; set.add(k); if(vid)vanByKey[k]=vid; };
      if(Array.isArray(ops.vanSplits)&&ops.vanSplits.length){ ops.vanSplits.forEach(s=>addG(s.vanGroup,s.vanId)); }
      else addG(ops.vanGroup,ops.vanId);
    });
  });
  let withVan=0,woVan=0; set.forEach(k=>{ if(vanByKey[k])withVan++; else woVan++; });
  return {total:set.size, withVan, woVan};
}
function _vehMatrixSummaryHTML(day){
  const rts=(typeof ROUTES!=='undefined'&&ROUTES)||[];
  const counts={}; let avail=0, busy=0;
  (SB_VEHICLES||[]).forEach(v=>{ if(!v.active)return; const st=(typeof vehStatusOn==='function')?vehStatusOn(v,day):''; if(st==='off'||st==='maintenance'){ busy++; return; } const rs=_vehDayRoutes(v,day); if(rs.length){ rs.forEach(r=>counts[r]=(counts[r]||0)+1); } else if(st==='available'){ avail++; } });
  let dlbl=day; try{ dlbl=new Date(day+'T12:00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'short'}); }catch(_){}
  const cards=rts.filter(r=>{ const dm=_vehRouteDemand(r.id,day); return counts[r.id]||dm.pax; }).map(r=>{ const z=(typeof _vehRouteZone==='function')?_vehRouteZone(r.id):null; const zl=z==='PK'?'ภูเก็ต':z==='KL'?'เขาหลัก':'—'; const nv=counts[r.id]||0; const dm=_vehRouteDemand(r.id,day); const grp=_vehGroupsForDay(r.id,day); const needFlag=(dm.pickup>0&&nv===0)?'<span style="font-size:8.5px;color:#A32D2D;background:#FCEBEB;border-radius:5px;padding:0 4px;margin-left:4px;font-weight:700">ยังไม่จัดรถ</span>':''; const grpChip=grp.total?`<span style="font-size:9px;color:#534AB7;font-weight:700"><span style="font-family:'DM Mono',monospace;font-size:11px">${grp.total}</span>ก${grp.woVan?` <span style="color:#A32D2D">·${grp.woVan}✗</span>`:''}</span>`:''; const _ok=grp.total>0&&grp.woVan===0&&!(dm.pickup>0&&nv===0); const _corner=(grp.total>0||dm.pickup>0)?`<span title="${_ok?'จัดรถครบ':'ยังจัดรถไม่ครบ'}" style="position:absolute;top:-5px;left:-5px;width:13px;height:13px;border-radius:50%;background:${_ok?'#1D9E75':'#C0392B'};color:#fff;font-size:8px;line-height:13px;text-align:center;font-weight:700;box-shadow:0 0 0 2px #fff">${_ok?'&#10003;':'&#10005;'}</span>`:''; return `<div style="position:relative;display:flex;align-items:center;gap:7px;background:#fff;border:1px solid ${dm.pickup>0&&nv===0?'#F0D0C8':'rgba(0,0,0,.07)'};border-left:3px solid ${r.color};border-radius:8px;padding:3px 8px">${_corner}<span style="width:15px;height:15px;border-radius:4px;background:${r.color};color:#fff;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">${_vehRouteAbbr(r.id)}</span><div style="min-width:0;flex:1"><div style="font-size:11px;font-weight:700;color:#1B2A55;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}${needFlag}</div><div style="font-size:9px;color:#8a8a82;line-height:1.2">${zl} · <span style="color:#185FA5;font-weight:600">ลค ${dm.pax}</span>${dm.pickup<dm.pax?` <span style="color:#aaa">(รับ ${dm.pickup})</span>`:''}${grpChip?' · '+grpChip:''}</div></div><div style="text-align:right;flex:none"><span style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:${r.color}">${nv}</span><span style="font-size:9px;color:#8a8a82"> คัน</span></div></div>`; }).join('');
  const extras=[];
  if(avail) extras.push(`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#0F6E56;background:#E9F7EF;border:1px solid #C4E6D5;border-radius:7px;padding:5px 10px">✓ พร้อม·ยังไม่จัด <b style="font-family:'DM Mono',monospace">${avail}</b></span>`);
  if(busy) extras.push(`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#854F0B;background:#FAEEDA;border:1px solid #EAD9B0;border-radius:7px;padding:5px 10px">🔧 ซ่อม/หยุด <b style="font-family:'DM Mono',monospace">${busy}</b></span>`);
  const tot=Object.values(counts).reduce((a,b)=>a+b,0);
  let totG=0,totGwo=0; rts.forEach(r=>{ const g=_vehGroupsForDay(r.id,day); totG+=g.total; totGwo+=g.woVan; });
  const grpHdr=totG?` · <b style="color:#534AB7">${totG} กรุ๊ป</b>${totGwo?` <span style="color:#A32D2D;font-weight:700">(${totGwo} ยังไม่มีรถ)</span>`:''}`:'';
  return `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px"><span style="font-size:11.5px;font-weight:700;color:#1B2A55">สรุปการจัดรถ</span><span style="font-size:10.5px;color:#8a8a82">· ${dlbl} · จัดแล้ว ${tot} คัน${grpHdr}</span></div>
  ${cards?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:5px;margin-bottom:4px">${cards}</div>`:`<div style="font-size:11px;color:#c7c5bb;padding:3px 0 4px">ยังไม่ได้จัดรถวันนี้ · คลิกช่องในตารางเพื่อสลับโปรแกรม</div>`}
  ${extras.length?`<div style="display:flex;gap:6px;flex-wrap:wrap">${extras.join('')}</div>`:''}`;
}
function vehDaySetStatus(id,date,s){ const v=vehGet(id); if(!v)return; v.dayStatus=v.dayStatus||{}; if(s){ v.dayStatus[date]=s; } else { delete v.dayStatus[date]; } const LB={available:'พร้อม',maintenance:'ซ่อม',off:'หยุด'}; vehLog(id,'status',date+' · '+(s?LB[s]:'ล้างสถานะ')); sbVehiclesPersist(); _vehDayRefresh(id,date); }
function vehDayClose(){ const m=document.getElementById('veh-day-modal'); if(m) m.remove(); }
// ── Status as date ranges (พร้อม/ซ่อม/หยุด · จาก–ถึง) ──
function vehStatusOn(v,date){ if(!v) return '';
  if(v.dayStatus&&v.dayStatus[date]) return v.dayStatus[date];   // per-day click-override wins
  if(Array.isArray(v.statusRanges)){ const cov=v.statusRanges.filter(r=>r.s&&r.from&&date>=r.from&&(!r.to||date<=r.to)); if(cov.length) return cov[cov.length-1].s; }
  return ''; }
function vehStatusCycleDay(id,date){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no status cycle */
  const v=vehGet(id); if(!v)return; v.dayStatus=v.dayStatus||{}; const order=['','available','maintenance','off']; const cur=v.dayStatus[date]||''; const nx=order[(order.indexOf(cur)+1)%order.length]; if(nx) v.dayStatus[date]=nx; else delete v.dayStatus[date]; vehLog(id,'status',date+' · '+(nx?(VEH_ST_LBL[nx]):'ล้าง')+' (override)'); sbVehiclesPersist(); if(typeof renderVehicles==='function') renderVehicles(); }
function vehStatusAdd(id){ const v=vehGet(id); if(!v)return; v.statusRanges=v.statusRanges||[]; const t=bkV2LocalYMD(new Date()); v.statusRanges.push({s:'maintenance',from:t,to:t,note:''}); sbVehiclesPersist(); vehStatusOpen(id); }
function vehStatusSet(id,i,f,val){ const v=vehGet(id); if(v&&v.statusRanges&&v.statusRanges[i]){ v.statusRanges[i][f]=val; const r=v.statusRanges[i]; if((f==='to'||f==='s')&&r.s&&r.from&&r.to) vehLog(id,'status',(VEH_ST_LBL[r.s]||r.s)+' '+r.from+'→'+r.to); sbVehiclesPersist(); } }
function vehStatusDel(id,i){ const v=vehGet(id); if(v&&v.statusRanges){ v.statusRanges.splice(i,1); sbVehiclesPersist(); vehStatusOpen(id); } }
function vehStatusModalClose(){ const m=document.getElementById('veh-status-modal'); if(m) m.remove(); renderVehicles(); }
function vehStatusOpen(id){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no status editor */
  const v=vehGet(id); if(!v) return; const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const old=document.getElementById('veh-status-modal'); if(old) old.remove();
  const inp='border:1px solid #ddd;border-radius:6px;padding:5px 7px;font-size:12px;font-family:inherit';
  const rs=v.statusRanges||[];
  const rows=rs.length?rs.map((r,i)=>`<div style="display:flex;align-items:center;gap:7px;padding:7px 0;border-top:1px solid #f0eee7;flex-wrap:wrap">
    <select onchange="vehStatusSet('${id}',${i},'s',this.value)" style="${inp}">${[['available','พร้อม'],['maintenance','ซ่อม'],['off','หยุด']].map(o=>`<option value="${o[0]}" ${r.s===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>
    <input type="date" value="${e(r.from)}" onchange="vehStatusSet('${id}',${i},'from',this.value)" style="${inp}">
    <span style="color:#999">→</span>
    <input type="date" value="${e(r.to)}" onchange="vehStatusSet('${id}',${i},'to',this.value)" style="${inp}">
    <input value="${e(r.note)}" oninput="vehStatusSet('${id}',${i},'note',this.value)" placeholder="โน้ต" style="${inp};flex:1;min-width:90px">
    <button onclick="vehStatusDel('${id}',${i})" style="background:transparent;border:1px solid #FCEBEB;color:#A32D2D;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer">ลบ</button>
  </div>`).join(''):'<div style="padding:14px 0;color:#8a8a82;font-size:12px;text-align:center">ยังไม่มีช่วงสถานะ · default = พร้อมใช้งาน</div>';
  const ov=document.createElement('div'); ov.id='veh-status-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;width:520px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.28)" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 17px;border-bottom:1px solid #eee">
      <div><div style="font-size:14px;font-weight:800;color:#1B2A55">สถานะรถ · ${e(v.name||id)}</div><div style="font-size:11px;color:#8a8a82">กำหนด พร้อม/ซ่อม/หยุด เป็นช่วงวันที่</div></div>
      <button onclick="vehStatusModalClose()" style="background:transparent;border:none;font-size:20px;color:#999;cursor:pointer">&times;</button>
    </div>
    <div style="padding:6px 17px 12px">${rows}</div>
    <div style="padding:11px 17px;border-top:1px solid #eee;display:flex;gap:8px">
      <button onclick="vehStatusAdd('${id}')" style="background:#185FA5;color:#fff;border:none;border-radius:7px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer">+ เพิ่มช่วง</button>
      <button onclick="vehStatusModalClose()" style="margin-left:auto;background:#fff;border:1px solid #ddd;border-radius:7px;padding:7px 15px;font-size:12px;font-weight:600;cursor:pointer">เสร็จ</button>
    </div>
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) vehStatusModalClose(); };
  document.body.appendChild(ov);
}
function vehAdd(){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no add */
  let mx=0; SB_VEHICLES.forEach(v=>{ const n=parseInt(String(v.id).replace(/^veh/,''))||0; if(n>mx)mx=n; });
  const id='veh'+String(mx+1).padStart(2,'0')+Math.random().toString(36).slice(2,5);   // +random · multi-user unique (parser reads leading digits)
  SB_VEHICLES.push({id, name:'', plate:'', type:'van', capacity:9, ownership:'own', partnerName:'', zoneBase:'PK', driver:'', driverPhone:'', active:true, note:'', log:[{at:new Date().toISOString(),kind:'created',text:'เพิ่มรถใหม่'}]});
  sbVehiclesPersist(); renderVehicles();
}
function vehSetField(id, field, val){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')){ renderVehicles(); return; }   /* §edit-guard · VC view-only → revert control */
  const v=vehGet(id); if(!v) return;
  if(field==='active'){ const nv=!!val; if(nv!==v.active) vehLog(id,'status', nv?'เปลี่ยนเป็น Active':'เปลี่ยนเป็น Inactive'); v.active=nv; }
  else if(field==='capacity'){ v.capacity=Math.max(1,parseInt(val)||1); }
  else if(field==='zoneBase'){ if(val!==v.zoneBase) vehLog(id,'zone','ย้ายโซนหลัก '+(v.zoneBase||'?')+' → '+val); v.zoneBase=val; }
  else if(field==='driver'){ if((val||'')!==(v.driver||'')) vehLog(id,'driver','เปลี่ยนคนขับ → '+(val||'—')); v.driver=val; }
  else { v[field]=val; }
  sbVehiclesPersist(); if(field==='ownership'||field==='active'||field==='zoneBase') renderVehicles(); }
function vehDelete(id){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no delete */
  const v=vehGet(id); if(!v) return; if(!confirm('Delete vehicle "'+(v.name||id)+'"?')) return; SB_VEHICLES=SB_VEHICLES.filter(x=>x.id!==id); sbVehiclesPersist(); renderVehicles(); }
// ── Registry list search (no re-render · keeps focus) ──
function vehListFilter(q){ q=(q||'').toLowerCase().trim(); document.querySelectorAll('#vehicles-host [data-vsearch]').forEach(el=>{ el.style.display=(!q||el.getAttribute('data-vsearch').indexOf(q)>=0)?'':'none'; }); }
function vehFormOpen(id){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no add/edit form */
  const v=id?vehGet(id):null;
  _vehForm = v ? {id:v.id, name:v.name||'', plate:v.plate||'', type:v.type||'van', capacity:v.capacity||9, ownership:v.ownership||'own', partnerName:v.partnerName||'', zoneBase:v.zoneBase||'PK', driver:v.driver||'', driverPhone:v.driverPhone||'', active:v.active!==false}
              : {id:null, name:'', plate:'', type:'van', capacity:9, ownership:'own', partnerName:'', zoneBase:'PK', driver:'', driverPhone:'', active:true};
  vehFormRender();
}
// เลือกสีในฟอร์ม · '' = กลับไปใช้สีอัตโนมัติ (hash ของ id)
function vehFormSetColor(hex){ if(!_vehForm) return; _vehForm.color = /^#[0-9a-fA-F]{6}$/.test(hex||'') ? String(hex).toLowerCase() : ''; vehFormRender(); }
function vehFormSetField(f,val){ if(!_vehForm) return; if(f==='active'){_vehForm.active=!!val;} else if(f==='capacity'){_vehForm.capacity=Math.max(1,parseInt(val)||1);} else {_vehForm[f]=val;} if(f==='ownership') vehFormRender(); }
function vehFormClose(){ const m=document.getElementById('veh-form-modal'); if(m) m.remove(); _vehForm=null; }
function vehFormSave(){
  const d=_vehForm; if(!d) return;
  if(!(d.name||'').trim()){ alert('Please enter a vehicle name'); return; }
  if(d.id){
    const v=vehGet(d.id); if(!v){ vehFormClose(); return; }
    if((!!v.active)!==(!!d.active)) vehLog(d.id,'status', d.active?'เปลี่ยนเป็น Active':'เปลี่ยนเป็น Inactive');
    if((v.zoneBase||'')!==(d.zoneBase||'')) vehLog(d.id,'zone','ย้ายโซนหลัก '+(v.zoneBase||'?')+' → '+d.zoneBase);
    if((v.driver||'')!==(d.driver||'')) vehLog(d.id,'driver','เปลี่ยนคนขับ → '+(d.driver||'—'));
    if((v.color||'')!==(d.color||'')) vehLog(d.id,'edit','เปลี่ยนสีประจำรถ → '+(d.color||'อัตโนมัติ'));
    if(d.color) v.color=d.color; else delete v.color;
    v.name=d.name.trim(); v.plate=d.plate; v.type=d.type; v.capacity=d.capacity; v.ownership=d.ownership; v.partnerName=(d.ownership==='own')?'':d.partnerName; v.zoneBase=d.zoneBase; v.driver=d.driver; v.driverPhone=d.driverPhone; v.active=!!d.active;
  } else {
    let mx=0; SB_VEHICLES.forEach(v=>{ const n=parseInt(String(v.id).replace(/^veh/,''))||0; if(n>mx)mx=n; });
    const id='veh'+String(mx+1).padStart(2,'0');
    SB_VEHICLES.push({id, color:d.color||undefined, name:d.name.trim(), plate:d.plate, type:d.type, capacity:d.capacity, ownership:d.ownership, partnerName:(d.ownership==='own')?'':d.partnerName, zoneBase:d.zoneBase, driver:d.driver, driverPhone:d.driverPhone, active:!!d.active, note:'', log:[{at:new Date().toISOString(),kind:'created',text:'เพิ่มรถใหม่'}]});
  }
  sbVehiclesPersist(); vehFormClose(); renderVehicles();
}
function vehFormRender(){
  const d=_vehForm; if(!d) return; const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const old=document.getElementById('veh-form-modal'); if(old) old.remove();
  const lab='font-size:11px;color:#8a8a82;font-weight:600';
  const inp='width:100%;height:34px;box-sizing:border-box;border:1px solid #ddd;border-radius:7px;padding:5px 9px;font-size:13px;font-family:inherit;margin-top:3px';
  const TYPES=['sedan','van','minibus','bus']; const TYLBL={sedan:'Sedan',van:'Van',minibus:'Minibus',bus:'Bus'};
  const supLbl=d.ownership==='partner'?'ชื่อซัพ (supplier)':'ผู้ให้เช่า';
  const ov=document.createElement('div'); ov.id='veh-form-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;width:460px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.28);overflow:hidden" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #eee">
      <span style="font-size:15px;font-weight:800;color:#1B2A55">&#128656; ${d.id?'แก้ไขรถ':'เพิ่มรถใหม่'}</span>
      <button onclick="vehFormClose()" style="background:transparent;border:none;font-size:20px;color:#999;cursor:pointer">&times;</button>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="${lab}">สีประจำรถ · ใช้บนหัวใบงาน และป้ายรถในหน้าจัดรถ</label>
        <div style="display:flex;align-items:center;gap:9px;margin-top:4px">
          <div style="width:44px;height:34px;border-radius:8px;flex:none;background:linear-gradient(135deg,${vehColor(d.id||'_new')},${vjShade(vehColor(d.id||'_new'),-22)});box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></div>
          <div style="flex:1;display:flex;flex-wrap:wrap;gap:4px">${VEH_COLORS.map(c=>`<button type="button" onclick="vehFormSetColor('${c}')" title="${c}" style="width:19px;height:19px;border-radius:5px;background:${c};border:2px solid ${(d.color||'').toLowerCase()===c.toLowerCase()?'#111':'transparent'};cursor:pointer;padding:0"></button>`).join('')}</div>
          <input type="color" value="${/^#[0-9a-fA-F]{6}$/.test(d.color||'')?d.color:vehColor(d.id||'_new')}" oninput="vehFormSetColor(this.value)" title="เลือกสีอื่นได้ไม่จำกัด" style="width:34px;height:34px;flex:none;padding:2px;border:1px solid #ddd;border-radius:7px;background:#fff;cursor:pointer">
          <button type="button" onclick="vehFormSetColor('')" title="กลับไปใช้สีอัตโนมัติ" style="flex:none;height:34px;padding:0 9px;font-size:11px;font-weight:600;color:${d.color?'#6b7280':'#c4c1b8'};background:#fff;border:1px solid #e5e7eb;border-radius:7px;cursor:pointer;font-family:inherit">อัตโนมัติ</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
        <div><label style="${lab}">ชื่อรถ</label><input value="${e(d.name)}" oninput="vehFormSetField('name',this.value)" placeholder="เช่น Van 3" style="${inp}"></div>
        <div><label style="${lab}">ทะเบียน</label><input value="${e(d.plate)}" oninput="vehFormSetField('plate',this.value)" placeholder="กข 0000" style="${inp};font-family:'DM Mono',monospace"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div><label style="${lab}">ชนิด</label><select onchange="vehFormSetField('type',this.value)" style="${inp}">${TYPES.map(t=>`<option value="${t}" ${d.type===t?'selected':''}>${TYLBL[t]}</option>`).join('')}</select></div>
        <div><label style="${lab}">ที่นั่ง</label><input type="number" min="1" value="${d.capacity}" oninput="vehFormSetField('capacity',this.value)" style="${inp};font-family:'DM Mono',monospace"></div>
        <div><label style="${lab}">โซนหลัก</label><select onchange="vehFormSetField('zoneBase',this.value)" style="${inp}">${['PK','KL'].map(z=>`<option value="${z}" ${d.zoneBase===z?'selected':''}>${z}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px">
        <div><label style="${lab}">ประเภท</label><select onchange="vehFormSetField('ownership',this.value)" style="${inp}">${[['own','บริษัท'],['rented','เช่า'],['partner','ร่วม']].map(o=>`<option value="${o[0]}" ${d.ownership===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
        <div>${d.ownership!=='own'?`<label style="${lab}">${supLbl}</label><input value="${e(d.partnerName)}" oninput="vehFormSetField('partnerName',this.value)" placeholder="${supLbl}" style="${inp}">`:'<label style="'+lab+'">&nbsp;</label><div style="height:34px;margin-top:3px;display:flex;align-items:center;color:#c7c5bb;font-size:12px">รถบริษัท · ไม่ต้องระบุซัพ</div>'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${lab}">คนขับ</label><input value="${e(d.driver)}" oninput="vehFormSetField('driver',this.value)" placeholder="ชื่อคนขับ" style="${inp}"></div>
        <div><label style="${lab}">เบอร์โทร</label><input value="${e(d.driverPhone)}" oninput="vehFormSetField('driverPhone',this.value)" placeholder="08x-xxx-xxxx" style="${inp};font-family:'DM Mono',monospace"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#444;margin-top:2px;cursor:pointer"><input type="checkbox" ${d.active?'checked':''} onchange="vehFormSetField('active',this.checked)" style="width:16px;height:16px"> Active (พร้อมใช้งาน)</label>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;padding:13px 18px;border-top:1px solid #eee">
      <button onclick="vehFormClose()" style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">ยกเลิก</button>
      <button onclick="vehFormSave()" style="background:#185FA5;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer">บันทึก</button>
    </div>
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) vehFormClose(); };
  document.body.appendChild(ov);
}
// ── Temporary zone overrides per vehicle ({zone,from,to}) · van runs another zone for a date range ──
function vehZoneAdd(id){ const v=vehGet(id); if(!v) return; v.zoneOverrides=v.zoneOverrides||[]; v.zoneOverrides.push({zone:(v.zoneBase==='PK'?'KL':'PK'), from:'', to:''}); sbVehiclesPersist(); vehZoneOpen(id); }
function vehZoneSet(id,i,field,val){ const v=vehGet(id); if(v&&v.zoneOverrides&&v.zoneOverrides[i]){ v.zoneOverrides[i][field]=val; const o=v.zoneOverrides[i]; if(field==='to'&&o.zone&&o.from&&o.to) vehLog(id,'zone','สลับโซน '+o.zone+' · '+o.from+'→'+o.to); sbVehiclesPersist(); } }
function vehZoneDel(id,i){ const v=vehGet(id); if(v&&v.zoneOverrides){ const o=v.zoneOverrides[i]; if(o) vehLog(id,'zone','ลบช่วงสลับโซน '+(o.zone||'')+(o.from?(' '+o.from):'')); v.zoneOverrides.splice(i,1); sbVehiclesPersist(); vehZoneOpen(id); } }
function vehZoneClose(){ const m=document.getElementById('veh-zone-modal'); if(m) m.remove(); renderVehicles(); }
function vehZoneOpen(id){ if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;   /* §edit-guard · VC view-only → no zone-override editor */
  const v=vehGet(id); if(!v) return; const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const old=document.getElementById('veh-zone-modal'); if(old) old.remove();
  const inp='border:1px solid #ddd;border-radius:6px;padding:5px 7px;font-size:12px;font-family:inherit';
  const ovs=v.zoneOverrides||[];
  const rows=ovs.length?ovs.map((o,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #f0eee7">
    <select onchange="vehZoneSet('${id}',${i},'zone',this.value)" style="${inp}">${['PK','KL'].map(z=>`<option value="${z}" ${o.zone===z?'selected':''}>${z}</option>`).join('')}</select>
    <input type="date" value="${e(o.from)}" onchange="vehZoneSet('${id}',${i},'from',this.value)" style="${inp}">
    <span style="color:#999">→</span>
    <input type="date" value="${e(o.to)}" onchange="vehZoneSet('${id}',${i},'to',this.value)" style="${inp}">
    <button onclick="vehZoneDel('${id}',${i})" style="margin-left:auto;background:transparent;border:1px solid #FCEBEB;color:#A32D2D;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer">ลบ</button>
  </div>`).join(''):'<div style="padding:14px 0;color:#8a8a82;font-size:12px;text-align:center">ยังไม่มีช่วงสลับโซน · ปกติวิ่งโซน '+e(v.zoneBase)+'</div>';
  const ov=document.createElement('div'); ov.id='veh-zone-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;width:440px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.28);font-family:'DM Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 17px;border-bottom:1px solid #eee">
      <div><div style="font-size:14px;font-weight:800;color:#185FA5">สลับโซนชั่วคราว · ${e(v.name||id)}</div><div style="font-size:11px;color:#8a8a82">โซนหลัก ${e(v.zoneBase)} · ระบุช่วงวันที่ไปวิ่งโซนอื่น</div></div>
      <button onclick="vehZoneClose()" style="background:transparent;border:none;font-size:20px;color:#999;cursor:pointer">&times;</button>
    </div>
    <div style="padding:6px 17px 12px">${rows}</div>
    <div style="padding:11px 17px;border-top:1px solid #eee;display:flex;gap:8px">
      <button onclick="vehZoneAdd('${id}')" style="background:#185FA5;color:#fff;border:none;border-radius:7px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer">+ เพิ่มช่วง</button>
      <button onclick="vehZoneClose()" style="margin-left:auto;background:#fff;border:1px solid #ddd;border-radius:7px;padding:7px 15px;font-size:12px;font-weight:600;cursor:pointer">เสร็จ</button>
    </div>
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) vehZoneClose(); };
  document.body.appendChild(ov);
}
function vehJobsFor(date){
  const jobs={}; (SB_VEHICLES||[]).forEach(v=>jobs[v.id]={bk:0,pax:0,list:[]});
  (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; const vid=bkOpsRead(b,date).vanId; if(!vid||!jobs[vid]) return;
    (b.trips||[]).forEach(t=>{ if((t.date||'')===date){ jobs[vid].bk++; jobs[vid].pax+=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; jobs[vid].list.push({b,t}); } }); });
  return jobs;
}
// Group a vehicle list by category (own/rented/partner) · partner sub-grouped by supplier.
// hd(col,label,count) → category header · subhd(name,count) → supplier sub-header · rowFn(v) → row html
// natural name sort so Love1 < Love2 < … < Love9 < Love10 (not lexical) · keeps the fleet list in a stable, human order regardless of backend row order
function _vehNameCmp(a,b){ return String(a.name||a.id||'').localeCompare(String(b.name||b.id||''), undefined, {numeric:true, sensitivity:'base'}); }
function vehBuildGrouped(list, rowFn, hd, subhd){
  let html='';
  [['own','รถบริษัท','#185FA5'],['rented','รถเช่า','#0F6E56'],['partner','รถร่วม','#534AB7']].forEach(([key,lbl,col])=>{
    const cv=list.filter(v=>(v.ownership||'own')===key).slice().sort(_vehNameCmp); if(!cv.length) return;
    html+=hd(col,lbl,cv.length);
    if(key==='partner'){
      const sups={}; cv.forEach(v=>{ const s=(v.partnerName||'').trim()||'(ไม่ระบุซัพ)'; (sups[s]=sups[s]||[]).push(v); });
      Object.keys(sups).sort().forEach(s=>{ html+=subhd(s,sups[s].length); html+=sups[s].slice().sort(_vehNameCmp).map(rowFn).join(''); });
    } else { html+=cv.map(rowFn).join(''); }
  });
  return html;
}
// Status-view list row · matches Boat Status buildBoatRow styling
function vehListRow(v, jobsT, today, dim, PINK, initials, TYLBL){
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const j=(jobsT&&jobsT[v.id])||{bk:0,pax:0};
  const sel=(_vehSel===v.id);
  const ez=vehEffectiveZone(v,today);
  const c = v.ownership==='partner'?'#534AB7':(ez==='KL'?'#0F6E56':'#185FA5');
  const ss = v.active?{bg:'#E1F5EE',color:'#0F6E56',label:'ACTIVE'}:{bg:'#F4F2EE',color:'#666',label:'INACTIVE'};
  const ovToday = Array.isArray(v.zoneOverrides) && v.zoneOverrides.some(o=>o.zone && (!o.from||today>=o.from) && (!o.to||today<=o.to));
  const ovBadge = ovToday?`<span style="display:inline-flex;align-items:center;gap:3px;background:#FAEEDA;color:#854F0B;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600" title="วันนี้สลับไปโซน ${e(ez)}">&#128197; ${e(ez)}</span>`:'';
  const meta=`${e(TYLBL[v.type]||v.type)} · ${v.capacity||0} PAX${v.driver?(' · '+e(v.driver)):''}`;
  const OWN={own:['#E6F1FB','#185FA5','บริษัท'],rented:['#E1F5EE','#0F6E56','เช่า'],partner:['#EEEDFE','#534AB7','ร่วม']}[v.ownership||'own']||['#F1EFE8','#666','—'];
  const ownTag=`<span style="background:${OWN[0]};color:${OWN[1]};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600">${OWN[2]}${(v.ownership!=='own'&&v.partnerName)?(' · '+e(v.partnerName)):''}</span>`;
  const jobPill = !v.active?'' : (j.bk?`<span style="display:inline-flex;align-items:center;gap:3px;background:#E1F5EE;color:#0F6E56;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600">${j.bk} job · ${j.pax} pax</span>`:`<span style="font-size:9px;color:${dim.ink4}">idle</span>`);
  return `<div onclick="vehSelect('${v.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;cursor:pointer;${sel?'background:'+PINK.soft+';border:1px solid #F0C0D0;':'border:1px solid transparent;border-top:0.5px solid '+dim.line+';margin-top:2px;'}${v.active?'':'opacity:.65;'}">
    <div style="width:32px;height:32px;border-radius:50%;background:${c};color:white;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${e(initials(v.name||v.id))}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:13px;font-weight:600;color:${dim.ink}">${e(v.name||v.id)}</span><span style="background:${ss.bg};color:${ss.color};padding:1px 7px;border-radius:8px;font-size:9px;font-weight:600;letter-spacing:.04em">${ss.label}</span>${ovBadge}</div>
      <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap"><span style="font-size:9px;color:${sel?PINK.text:dim.ink3}">${e(meta)}</span>${ownTag}${v.plate&&v.plate!=='-'?`<span style="font-size:9px;color:${dim.ink4};font-family:'DM Mono',monospace">${e(v.plate)}</span>`:''}${jobPill}</div>
    </div>
  </div>`;
}
// Status-view right detail panel
function vehDetailPanel(id, jobsT, today, initials, TYLBL){
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  if(!id || !vehGet(id)) return `<div style="padding:60px 20px;text-align:center;color:#b4b2a9"><div style="font-size:34px">&#128656;</div><div style="font-size:14px;font-weight:700;color:#8a8a82;margin-top:10px">เลือกรถเพื่อดูรายละเอียด</div><div style="font-size:12px;margin-top:4px">คลิกรถทางซ้ายเพื่อดูข้อมูล คนขับ และงานวันนี้</div></div>`;
  const v=vehGet(id); const ez=vehEffectiveZone(v,today);
  const col = v.ownership==='partner'?['#EEEDFE','#534AB7']:(ez==='KL'?['#E1F5EE','#0F6E56']:['#E6F1FB','#185FA5']);
  const j=(jobsT&&jobsT[id])||{bk:0,pax:0,list:[]};
  const row=(l,val)=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid #f3f1ea;font-size:12.5px"><span style="color:#8a8a82">${l}</span><span style="font-weight:600;color:#1B2A55;text-align:right">${val}</span></div>`;
  const ovs=(v.zoneOverrides||[]).map(o=>`${e(o.zone)} ${e(o.from||'?')}→${e(o.to||'?')}`).join(' · ')||'—';
  const jobs=(j.list||[]).slice().sort((a,b)=>String((a.b.ops&&a.b.ops.pickupTimeFinal)||a.t.pickupTime||'').localeCompare(String((b.b.ops&&b.b.ops.pickupTimeFinal)||b.t.pickupTime||''))).map(x=>{ const a=sbGetAgent(x.b.agentId); const tm=(x.b.ops&&x.b.ops.pickupTimeFinal)||x.t.pickupTime||x.b.pickupTime||'—'; const pax=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(x.t.pax||{}):0; return `<div style="display:flex;gap:9px;padding:7px 0;border-top:1px solid #f3f1ea;font-size:12px"><span style="font-family:'DM Mono',monospace;color:#185FA5;min-width:54px">${e(tm)}</span><span style="flex:1;min-width:0">${e(x.b.leadPax||x.b.voucherRef||x.b.id)} <span style="color:#8a8a82">· ${e(a?a.name:'')}</span><div style="font-size:10.5px;color:#8a8a82">${e(x.b.hotelName||x.b.pickup||x.b.pickupArea||'')}</div></span><span style="font-family:'DM Mono',monospace">${pax} pax</span></div>`; }).join('')||'<div style="font-size:11.5px;color:#c7c5bb;padding:8px 0">ยังไม่มีงานวันนี้ (รอ Van Assign)</div>';
  return `<div style="padding:16px 18px">
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:12px">
      <div style="width:44px;height:44px;border-radius:50%;background:${col[0]};color:${col[1]};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;font-family:'DM Mono',monospace">${e(initials(v.name||v.id))}</div>
      <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:7px"><span style="font-size:17px;font-weight:700;color:#1B2A55">${e(v.name||v.id)}</span>${v.active?'<span style="font-size:9px;font-weight:700;background:#E1F5EE;color:#0F6E56;border-radius:5px;padding:1px 7px">ACTIVE</span>':'<span style="font-size:9px;font-weight:700;background:#F1EFE8;color:#8a8a82;border-radius:5px;padding:1px 7px">INACTIVE</span>'}</div><div style="font-size:12px;color:#8a8a82;font-family:'DM Mono',monospace">${v.plate&&v.plate!=='-'?e(v.plate):'—'}</div></div>
      <button onclick="vehSetTab('registry')" style="background:#fff;border:1px solid var(--border,#e5e5e5);border-radius:7px;padding:5px 11px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#185FA5">แก้ไข</button>
    </div>
    ${(function(){
      const sc=(l,val,col)=>`<div style="background:#f7f7f4;border-radius:8px;padding:8px 11px"><div style="font-size:11px;color:#8a8a82">${l}</div><div style="font-size:15px;font-weight:700;margin-top:1px;color:${col||'#1B2A55'}">${val}</div></div>`;
      const oTxt=v.ownership==='own'?'บริษัท':v.ownership==='rented'?'เช่า':'ร่วม'; const oCol=v.ownership==='own'?'#185FA5':v.ownership==='rented'?'#0F6E56':'#534AB7';
      const zoneVal=e(v.zoneBase)+(ez!==v.zoneBase?` <span style="font-size:10px;color:#854F0B">→${e(ez)}</span>`:'');
      const supLine=(v.ownership!=='own'&&v.partnerName)?`<div style="font-size:11.5px;color:#8a8a82;margin-bottom:10px"><span style="color:${oCol};font-weight:600">${oTxt}</span> · ${e(v.partnerName)}</div>`:'';
      const ovLine=(ovs!=='—')?`<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#854F0B;background:#FAEEDA;border-radius:7px;padding:5px 10px;margin-bottom:10px"><span>&#128197;</span> สลับโซน: ${ovs}<button onclick="vehZoneOpen('${v.id}')" style="margin-left:auto;background:#fff;border:1px solid #EAD9B0;color:#854F0B;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:inherit">แก้</button></div>`:'';
      const stToday=(typeof vehStatusOn==='function')?vehStatusOn(v,today):''; const nR=(v.statusRanges||[]).length;
      const stLbl=stToday?({available:'พร้อม',maintenance:'ซ่อม',off:'หยุด'})[stToday]:'พร้อม'; const stPC=stToday==='off'?['#FCEBEB','#A32D2D']:stToday==='maintenance'?['#FAEEDA','#854F0B']:['#E1F5EE','#0F6E56'];
      return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        ${sc('ชนิด', e(TYLBL[v.type]||v.type))}
        ${sc('ที่นั่ง', `<span style="font-family:'DM Mono',monospace">${v.capacity||0}</span>`)}
        ${sc('ประเภท', oTxt, oCol)}
        ${sc('โซน', zoneVal)}
      </div>
      ${supLine}${ovLine}
      <div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #f3f1ea;font-size:13px"><span style="font-size:15px">&#128100;</span><span style="font-weight:600;color:#1B2A55">${e(v.driver||'—')}</span>${v.ownership==='partner'?'<span style="font-size:10px;font-weight:700;color:#8a5500;background:#FBF1DE;border-radius:5px;padding:1px 7px">ค่าตั้งต้น</span>':''}<span style="margin-left:auto;font-family:'DM Mono',monospace;color:#8a8a82">${e(v.driverPhone||'')}</span></div>
      ${v.ownership==='partner'?'<div style="font-size:11px;color:#8a5500;background:#FFF8EC;border-radius:7px;padding:6px 10px;margin:2px 0">&#129309; รถร่วม — นี่คือคนขับ/เบอร์ <b>ค่าตั้งต้น</b> · คนขับจริงเปลี่ยนรายวัน ระบุในใบงานก่อนเดินทาง (กด ✎ ในหน้าใบงานรถ)</div>':''}
      <div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #f3f1ea;font-size:13px"><span style="font-size:14px;color:${stPC[1]}">&#9679;</span><span style="color:#8a8a82">ความพร้อม</span><span style="margin-left:auto;font-size:12px;font-weight:700;background:${stPC[0]};color:${stPC[1]};padding:2px 9px;border-radius:7px">${stLbl}${nR?` · ${nR} ช่วง`:''}</span><button onclick="vehStatusOpen('${v.id}')" style="background:#fff;border:1px solid var(--border,#e5e5e5);border-radius:6px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;color:#185FA5;margin-left:8px">จัดการช่วง</button></div>`;
    })()}
    ${(function(){
      const cm=_vehCalMonth||today.slice(0,7); const [cy,cmo]=cm.split('-').map(Number);
      const first=new Date(cy,cmo-1,1); const startWd=(first.getDay()+6)%7; const dimN=new Date(cy,cmo,0).getDate();
      const MONTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const SC={available:'#1D9E75',maintenance:'#BA7517',off:'#A32D2D'};
      const DOW=['จ','อ','พ','พฤ','ศ','ส','อา'];
      let cells=''; for(let i=0;i<startWd;i++) cells+='<div></div>';
      for(let d=1;d<=dimN;d++){ const ds=cm+'-'+String(d).padStart(2,'0'); const st=(typeof vehStatusOn==='function')?vehStatusOn(v,ds):''; const isToday=ds===today; const bg=SC[st]||'#fff'; const col=st?'#fff':'#9aa3b0'; const ring=isToday?'box-shadow:0 0 0 2px #fff,0 0 0 3px #185FA5;':'';
        cells+=`<div onclick="vehStatusCycleDay('${v.id}','${ds}')" title="${ds}${st?(' · '+({available:'พร้อม',maintenance:'ซ่อม',off:'หยุด'})[st]):''} · คลิกวนสถานะ" style="aspect-ratio:1;background:${bg};border:${st?'none':'0.5px solid rgba(0,0,0,.06)'};border-radius:5px;display:flex;align-items:flex-end;justify-content:flex-start;padding:3px;font-size:9px;font-family:'DM Mono',monospace;color:${col};cursor:pointer;${ring}">${d}</div>`; }
      return `<div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;max-width:520px"><span style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;letter-spacing:.05em">Status timeline</span><span style="display:inline-flex;align-items:center;gap:6px"><button onclick="vehStatusOpen('${v.id}')" style="background:#185FA5;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">+ เพิ่มช่วง</button><button onclick="vehCalShift(-1)" style="border:none;background:transparent;cursor:pointer;font-size:14px;color:#888">&lsaquo;</button><b style="font-size:12px;color:#1B2A55">${MONTHS[cmo-1]} ${cy}</b><button onclick="vehCalShift(1)" style="border:none;background:transparent;cursor:pointer;font-size:14px;color:#888">&rsaquo;</button></span></div>
        <div style="background:#FBFAF7;border-radius:10px;padding:12px 14px;margin-top:8px;max-width:520px">
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:9px;color:#b4b2a9;margin-bottom:4px">${DOW.map(x=>`<span>${x}</span>`).join('')}</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells}</div>
          <div style="display:flex;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06);font-size:10px;color:#8a8a82;flex-wrap:wrap"><span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#1D9E75;vertical-align:-1px"></span> พร้อม</span><span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#BA7517;vertical-align:-1px"></span> ซ่อม</span><span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#A32D2D;vertical-align:-1px"></span> หยุด</span><span style="color:#b4b2a9">คลิกวัน = วน · + เพิ่มช่วง = จาก–ถึง</span></div>
        </div>`;
    })()}
    ${(function(){
      const KCOL={created:'#0F6E56',status:'#185FA5',zone:'#854F0B',driver:'#6B289A',edit:'#5F5E5A'};
      const fmt=iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(_){ return iso||''; } };
      const items=(Array.isArray(v.log)?v.log.slice().reverse():[]);
      const tl = items.length ? items.map(it=>{ const c=KCOL[it.kind]||'#5F5E5A'; return `<div style="display:flex;gap:9px;padding:6px 0;border-top:1px solid #f3f1ea"><span style="width:8px;height:8px;border-radius:50%;background:${c};margin-top:5px;flex:none"></span><div style="flex:1;min-width:0"><div style="font-size:12px;color:#1B2A55">${e(it.text)}</div><div style="font-size:10px;color:#b4b2a9;font-family:'DM Mono',monospace">${e(fmt(it.at))}</div></div></div>`; }).join('') : '<div style="font-size:11.5px;color:#c7c5bb;padding:8px 0">ยังไม่มีประวัติ · เปลี่ยนสถานะ/โซน/คนขับ จะถูกบันทึกที่นี่</div>';
      return `<div style="margin-top:16px;font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;letter-spacing:.05em">Status Timeline</div>${tl}`;
    })()}
  </div>`;
}

/* §plCost2 · รถวิ่งเป็นกลุ่ม ไม่ได้วิ่งเป็นคัน · รถของเจ้าเดียวกันราคาเดียวกัน
   กลุ่มของรถบริษัทคือ 'own' · ของรถร่วมคือชื่อเจ้าของ */
function vanGroupKey(v){
  if(!v) return 'own';
  if(v.ownership === 'own') return 'own';
  var p = String(v.partnerName || '').trim();
  return 'p:' + (p || '—');
}
function vanGroupName(k){
  if(k === 'own') return 'รถของบริษัท';
  var p = String(k).slice(2);
  return (p === '—') ? 'รถร่วม (ยังไม่ระบุเจ้าของ)' : p;
}
/* กลุ่มทั้งหมดที่มีรถอยู่จริง · เรียงรถบริษัทขึ้นก่อน แล้วตามด้วยรถร่วมตามตัวอักษร */
function vanGroups(){
  var by = {}, order = [];
  (typeof SB_VEHICLES !== 'undefined' ? SB_VEHICLES : []).forEach(function(v){
    if(!v || v.active === false) return;
    var k = vanGroupKey(v);
    if(!by[k]){ by[k] = { key:k, name:vanGroupName(k), own:(k === 'own'), vans:[] }; order.push(k); }
    by[k].vans.push(v);
  });
  order.sort(function(a, b){
    if((a === 'own') !== (b === 'own')) return (a === 'own') ? -1 : 1;
    return vanGroupName(a).localeCompare(vanGroupName(b), 'th');
  });
  return order.map(function(k){ return by[k]; });
}

/* ตารางราคา · { <กลุ่ม>: { base, rt:{ <เส้นทาง>: {base, PK, KL} } } }
   สามชั้นที่ถอยหากันได้ · เว้นว่าง = ใช้ชั้นบน · จะได้กรอกเท่าที่ต่างจริง */
function vanRates(){ var r = ctRead('van_rates'); return (r && typeof r === 'object') ? r : {}; }
function vanRatesSave(r){ ctWrite('van_rates', r); }
function vanRateSet(gk, routeId, field, val){
  var R = vanRates();
  var G = R[gk] = R[gk] || {};
  var v = (String(val).trim() === '') ? null : (+val || 0);
  if(!routeId){ if(v == null) delete G.base; else G.base = v; }
  else {
    G.rt = G.rt || {};
    var T = G.rt[routeId] = G.rt[routeId] || {};
    if(v == null) delete T[field]; else T[field] = v;
    if(!Object.keys(T).length) delete G.rt[routeId];
  }
  vanRatesSave(R);
}
function vanRateRaw(gk, routeId, field){
  var G = vanRates()[gk] || {};
  if(!routeId) return (G.base == null) ? '' : G.base;
  var T = (G.rt || {})[routeId] || {};
  return (T[field] == null) ? '' : T[field];
}
/* ราคาที่ใช้จริง · ไล่จากละเอียดสุดขึ้นไปหาหยาบสุด */
function vanRate(gk, routeId, zone){
  var G = vanRates()[gk] || {}, T = (G.rt || {})[routeId] || {};
  var z = (zone === 'KL') ? 'KL' : 'PK';
  if(T[z] != null) return +T[z] || 0;
  if(T.base != null) return +T.base || 0;
  if(G.base != null) return +G.base || 0;
  return (gk === 'own') ? MV_VAN_DEF.own : MV_VAN_DEF.partner;
}
/* ค่ารถของคันหนึ่งในทริปหนึ่ง · ราคาเฉพาะคันมาก่อนเสมอ ถ้าตกลงกันไว้พิเศษจริง ๆ */
function vanDayCost(v, routeId, zone){
  if(!v) return 0;
  if(v.costPerDay != null && v.costPerDay !== '') return +v.costPerDay || 0;
  return vanRate(vanGroupKey(v), routeId, zone);
}
function vanCostSet(vid, v){
  var x = (typeof vehGet === 'function') ? vehGet(vid) : null; if(!x) return;
  x.costPerDay = (String(v).trim() === '') ? null : (+v || 0);
  if(typeof sbVehiclesPersist === 'function') sbVehiclesPersist();
}
