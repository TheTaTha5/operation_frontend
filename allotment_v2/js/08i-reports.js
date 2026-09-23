// 08i-reports.js · Reports · analysis · daily report · market data · pickup map · B2C dashboard
// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original
// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.

function mdFmt(n){ return Math.round(n||0).toLocaleString(); }
function mdThaiDateToISO(str){ const m=String(str).match(/(\d{1,2})\s+([ก-๛]+)\s+(\d{4})/); if(!m) return null; const day=+m[1], mon=MD_TH_MONTHS[m[2]]||0, be=+m[3]; if(!mon) return null; const yr=be>2400?be-543:be; return yr+'-'+String(mon).padStart(2,'0')+'-'+String(day).padStart(2,'0'); }
function mdDetectDir(aoa,fname){ if(/IN1/i.test(fname||'')) return 'in'; if(/OUT1/i.test(fname||'')) return 'out'; const txt=aoa.map(r=>(r||[]).join(' ')).join(' '); if(txt.includes('ขาเข้า')) return 'in'; if(txt.includes('ขาออก')) return 'out'; return null; }
function mdIngest(aoa,fname){
  const dir=mdDetectDir(aoa,fname); if(!dir){ alert('Cannot tell IN or OUT: '+fname); return false; }
  let iso=null; for(const row of aoa){ const j=(row||[]).join(' '); if(j.includes('ประจำวันที่')){ iso=mdThaiDateToISO(j); if(iso) break; } }
  if(!iso){ alert('Cannot read date from: '+fname); return false; }
  const data={}; let grand=0;
  aoa.forEach(row=>{
    const cells=(row||[]).map(c=>String(c==null?'':c).trim());
    const nums=cells.map(c=>c.replace(/,/g,'')).filter(c=>/^\d{1,8}$/.test(c)).map(Number);
    // Official grand-total row ("รวม" / "รวมทั้งสิ้น") · authoritative day total (incl. unknown-nationality)
    if(cells.some(c=>c==='รวม'||c==='รวมทั้งสิ้น'||c==='ผลรวม'||/รวมทั้งสิ้น/.test(c))){ if(nums.length) grand=Math.max(grand,nums[nums.length-1]); return; }
    const natCell=cells.find(c=>c.includes('/') && /[ก-๛]/.test(c));
    if(!natCell || natCell.includes('ประเทศ')) return;
    const nat=natCell.split('/').pop().trim(); if(!nat) return;
    if(!nums.length) return;
    data[nat]=(data[nat]||0)+nums[nums.length-1];
  });
  if(Object.keys(data).length===0){ alert('No rows parsed: '+fname); return false; }
  if(!SB_MARKET_STATS[iso]) SB_MARKET_STATS[iso]={date:iso,in:null,out:null};
  SB_MARKET_STATS[iso][dir]=data;
  SB_MARKET_STATS[iso][dir+'Total']=grand||Object.values(data).reduce((s,v)=>s+v,0);   // official total
  SB_MARKET_STATS[iso][dir+'At']=new Date().toISOString();
  sbMarketStatsPersist();
  return iso;
}
function mdImportFiles(files){
  if(typeof XLSX==='undefined'){ alert('Excel reader (SheetJS) not loaded — check internet connection and reload.'); return; }
  const arr=[...files]; let done=0, oks=[];
  arr.forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{ try{ const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'}); const sh=wb.Sheets[wb.SheetNames[0]]; const aoa=XLSX.utils.sheet_to_json(sh,{header:1,raw:false,defval:''}); const r=mdIngest(aoa,file.name); if(r) oks.push(r); }catch(err){ alert('Parse failed: '+file.name+' · '+err.message); } done++; if(done===arr.length){ renderMarketData(); } };
    reader.onerror=()=>{ done++; if(done===arr.length) renderMarketData(); };
    reader.readAsArrayBuffer(file);
  });
}
function mdDeleteDay(iso){ if(!confirm('Remove imported data for '+iso+'?')) return; delete SB_MARKET_STATS[iso]; sbMarketStatsPersist(); renderMarketData(); }
function mdSum(o){ return Object.values(o||{}).reduce((s,v)=>s+(+v||0),0); }
// authoritative day total for a direction · official grand-total (incl. unknown nationality) if captured, else sum of breakdown
function mdDirTot(d,dir){ const t=d&&d[dir+'Total']; return (typeof t==='number'&&t>0)?t:mdSum(d&&d[dir]); }
// arrivals summed by 2-letter code (mapped) across all imported days
function mdArrivalsByCode(){ const out={}; Object.values(SB_MARKET_STATS).forEach(d=>{ const o=d.in||{}; Object.entries(o).forEach(([nat,v])=>{ const code=MD_NAT_TH2CODE[nat]; if(code) out[code]=(out[code]||0)+(+v||0); }); }); return out; }
// our non-cancelled booking pax by lead nationality code
// A nationality code is valid if it's ISO-2 (AA) OR a known custom code (any length · e.g. "BAR") — not just 2 letters
function mdValidNat(c){ c=String(c||'').toUpperCase(); if(/^[A-Z]{2}$/.test(c)) return c; if(c && typeof SB_CUSTOM_NATIONALITIES!=='undefined' && Array.isArray(SB_CUSTOM_NATIONALITIES) && SB_CUSTOM_NATIONALITIES.some(n=>String(n.code).toUpperCase()===c)) return c; return ''; }
// resolve a nationality code for a booking · field → guess from lead name → passenger nationality/name
function mdBkCode(b){
  let c=mdValidNat(b.leadNationality); if(c) return c;
  if(typeof bkV2GuessNationality==='function'){ c=mdValidNat(bkV2GuessNationality(b.leadPax||b.customerName||'')); if(c) return c; }
  if(Array.isArray(b.passengers)){ for(const p of b.passengers){ let pc=mdValidNat(p.nationality); if(pc) return pc; pc=(typeof bkV2GuessNationality==='function')?mdValidNat(bkV2GuessNationality(p.name||'')):''; if(pc) return pc; } }
  return '';
}
// Per-booking nationality MIX · distributes pax across the ACTUAL passengers' nationalities
// (fixes big groups where the Lead is a Thai guide but the guests are foreign — no longer lumps all pax under the lead)
function mdBkMix(b){
  const mix={}; const G=(typeof bkV2GuessNationality==='function');
  const add=(code,n)=>{ const c=mdValidNat(code); if(!c||n<=0) return; mix[c]=(mix[c]||0)+n; };
  const tot=(b.trips||[]).reduce((s,t)=>s+((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0),0);
  let leadCode=mdValidNat(b.leadNationality);
  if(!leadCode && G) leadCode=mdValidNat(bkV2GuessNationality(b.leadPax||b.customerName||''));
  let counted=0;
  // each additional passenger (#2..) by their own nationality (guess from name → fall back to lead)
  if(Array.isArray(b.passengers)){
    b.passengers.forEach(p=>{ let pc=mdValidNat(p.nationality); if(!pc && G) pc=mdValidNat(bkV2GuessNationality(p.name||'')); if(!pc) pc=leadCode; if(pc){ add(pc,1); counted++; } });
  }
  // lead = pax #1
  if(leadCode){ add(leadCode,1); counted++; }
  // any remaining pax (counts > named rows) → lead, else dominant code
  const rem=tot-counted;
  if(rem>0){ const fb=leadCode||(Object.keys(mix).sort((x,y)=>mix[y]-mix[x])[0]||''); add(fb,rem); }
  return mix;
}
function mdOurMixByCode(){ const out={}; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; const mix=mdBkMix(b); Object.keys(mix).forEach(c=>{ out[c]=(out[c]||0)+mix[c]; }); }); return out; }
function mdOurNatCoverage(){ let w=0,t=0; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; t++; if(mdBkCode(b)) w++; }); return {with:w,total:t}; }
// bookings whose nationality can't be resolved (even by guessing) → need manual fill
function mdMissingNat(){ return (SB_BOOKINGS||[]).filter(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return false; return !mdBkCode(b); }); }
function mdOpenBk(id){ const nb=[...document.querySelectorAll('.nav-item')].find(n=>n.dataset.view==='booking'); if(nb && typeof nav==='function') nav(nb); if(typeof bkV2OpenDetail==='function') bkV2OpenDetail(id); }
function mdCleanupNats(){ if(typeof bkV2CleanupNats!=='function') return; if(!confirm('Clean up the nationality list?\n\n· Fix names with stray brackets / " · CODE" labels\n· Merge duplicates (and any that match a built-in)\n· Re-point affected bookings to the kept entry')) return; const r=bkV2CleanupNats(); try{ alert('Nationality list cleaned\n\nRemoved/merged: '+r.removed+'\nKept (custom): '+r.kept+'\nBookings re-pointed: '+r.bookingsRemapped); }catch(e){} renderMarketData(); }
function mdMissingNatCard(){
  const list=mdMissingNat(); if(!list.length) return '';
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows=list.slice(0,60).map(b=>{ const a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null; const date=(b.trips||[]).map(t=>t.date).filter(Boolean).sort()[0]||''; return `<div style="display:flex;align-items:center;gap:11px;padding:6px 0;border-top:0.5px solid var(--fd-line-soft);font-size:11.5px">
    <span style="font-family:'DM Mono',monospace;font-size:10.5px;min-width:96px;color:var(--fd-ink-soft)">${esc(b.voucherRef||b.code||b.id)}</span>
    <span style="font-weight:600;min-width:110px">${esc(a?a.name:(b.agentId||'B2C'))}</span>
    <span style="flex:1;min-width:0">${esc(b.leadPax||b.customerName||'—')}</span>
    <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--fd-ink-soft);min-width:80px">${esc(date)}</span>
    <button onclick="mdOpenBk('${esc(b.id)}')" style="background:#1683C7;color:#fff;border:none;font-size:10px;font-weight:600;padding:4px 11px;border-radius:6px;cursor:pointer">Fix &rarr;</button></div>`; }).join('');
  return mdCard('&#9888; Bookings missing nationality','cannot auto-guess from name · '+list.length+' booking'+(list.length>1?'s':'')+' · open each to pick',rows+(list.length>60?`<div style="font-size:10px;color:var(--fd-ink-soft);padding-top:6px">+${list.length-60} more…</div>`:''));
}
// One-time backfill: write guessed nationality onto existing bookings that have none (keeps existing values)
function mdBackfillNat(){
  if(!confirm('Auto-fill Nationality on existing bookings by guessing from the customer name?\n\n· Existing nationalities are kept\n· Only fills blanks the guesser is confident about')) return;
  let had=0,filled=0,blank=0,total=0;
  (SB_BOOKINGS||[]).forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; total++;
    const cur=mdValidNat(b.leadNationality); if(cur){ had++; return; }
    let g=(typeof bkV2GuessNationality==='function')?mdValidNat(bkV2GuessNationality(b.leadPax||b.customerName||'')):'';
    if(!g && Array.isArray(b.passengers)){ for(const p of b.passengers){ const pc=mdValidNat(p.nationality); if(pc){g=pc;break;} const pg=(typeof bkV2GuessNationality==='function')?mdValidNat(bkV2GuessNationality(p.name||'')):''; if(pg){g=pg;break;} } }
    if(g){ b.leadNationality=g; if(typeof bkV2AddHistory==='function') bkV2AddHistory(b,'edit','Nationality auto-filled: '+g,'Edited'); filled++; } else { blank++; }
  });
  if(filled && typeof acctPersistBookings==='function') acctPersistBookings();
  try{ alert('Nationality backfill\n\nAlready had: '+had+'\nFilled by guess: '+filled+'\nStill blank (need manual): '+blank+'\nTotal active bookings: '+total); }catch(e){}
  renderMarketData();
}
function mdSetNetWin(n){ _mdNetWin=n; if(typeof renderMarketData==='function') renderMarketData(); }
function mdSetTab(t){ _mdTab=t; renderMarketData(); }
function mdToday(){ try{ return (typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);}catch(e){ return new Date().toISOString().slice(0,10);} }
function mdDaysBetween(a,b){ try{ return Math.round((new Date(b+'T00:00')-new Date(a+'T00:00'))/86400000);}catch(e){ return null;} }
function mdMarketName(id){ const m=(typeof SB_MARKETS!=='undefined'?SB_MARKETS:[]).find(x=>x.id===id); return m?m.name:(id||'—'); }
// guide-language buckets from arrivals-by-code
function mdLangBuckets(byCode){ const o={Russian:0,Chinese:0,English:0}; Object.entries(byCode||{}).forEach(([c,v])=>{ if(c==='RU') o.Russian+=v; else if(['CN','TW','HK','MO'].includes(c)) o.Chinese+=v; else o.English+=v; }); return o; }
// our bookings lead-time buckets per market
function mdLeadByMarket(){
  const buckets=['0-3d','4-7d','8-14d','15-30d','30d+']; const out={};
  (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    const bd=b.bookingDate||b.createdAt; const td=(b.trips||[]).map(t=>t.date).filter(Boolean).sort()[0]; if(!bd||!td) return;
    const lt=mdDaysBetween(String(bd).slice(0,10),td); if(lt==null||lt<0) return;
    const pax=(b.trips||[]).reduce((s,t)=>s+((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0),0);
    const mk=(b.marketSnapshot&&b.marketSnapshot.market)||(typeof sbGetAgent==='function'&&sbGetAgent(b.agentId)?.market)||(b.b2cChannel||b.channelType==='b2c'?'B2C':'unassigned');
    const bi= lt<=3?0: lt<=7?1: lt<=14?2: lt<=30?3:4;
    if(!out[mk]) out[mk]=[0,0,0,0,0]; out[mk][bi]+=pax;
  });
  return {buckets, out};
}
// on-the-books future pax by week (next 8 weeks)
function mdOnTheBooks(){
  const today=mdToday(); const weeks={};
  (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    (b.trips||[]).forEach(t=>{ if(!t.date||t.date<today) return; const dd=mdDaysBetween(today,t.date); if(dd==null||dd>56) return; const wk=Math.floor(dd/7);
      const pax=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; weeks[wk]=(weeks[wk]||0)+pax; });
  });
  return weeks;
}
function mdArrivalsByWeekday(){ const wd=[0,0,0,0,0,0,0]; Object.values(SB_MARKET_STATS).forEach(d=>{ if(!d.in) return; const dt=new Date((d.date||'')+'T00:00'); if(isNaN(dt)) return; wd[dt.getDay()]+=mdDirTot(d,'in'); }); return wd; }
function mdOurPaxByMarket(){ const out={}; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; const mk=(b.marketSnapshot&&b.marketSnapshot.market)||(typeof sbGetAgent==='function'&&sbGetAgent(b.agentId)?.market)||(b.b2cChannel||b.channelType==='b2c'?'B2C':'unassigned'); const pax=(b.trips||[]).reduce((s,t)=>s+((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0),0); if(!out[mk]) out[mk]={pax:0,bookings:0}; out[mk].pax+=pax; out[mk].bookings++; }); return out; }
function mdCard(title,sub,inner){ return `<div class="md-card"><div style="font-size:12px;font-weight:700">${title}${sub?` <span style="font-weight:400;color:var(--fd-ink-soft)">· ${sub}</span>`:''}</div><div style="margin-top:9px">${inner}</div></div>`; }
function mdNote(t){ return `<div style="font-size:10.5px;color:#7A4A00;background:#FBF0DD;border:1px solid #EAD9B0;border-radius:8px;padding:7px 10px;margin-bottom:12px">${t}</div>`; }
function mdHbars(rows,max,col){ max=Math.max(1,max); return rows.map(r=>`<div style="display:flex;align-items:center;gap:9px;padding:4px 0"><div style="width:130px;font-size:11.5px;flex-shrink:0">${r.label}</div><div style="flex:1;background:#eef0f3;border-radius:4px;height:14px;overflow:hidden"><div style="width:${Math.round(100*r.val/max)}%;height:100%;background:${r.col||col||'#1683C7'}"></div></div><div style="width:64px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;font-weight:700">${mdFmt(r.val)}</div>${r.extra?`<div style="width:80px;text-align:right;font-size:10px;color:var(--fd-ink-soft)">${r.extra}</div>`:''}</div>`).join(''); }
function _mdOvFmt(v){ v=Math.round(v||0); if(v>=1000000) return (v/1000000).toFixed(2)+'M'; if(v>=10000) return Math.round(v/1000)+'K'; return v.toLocaleString('en-US'); }
function _mdOvMonthly(days){
  const m={}, pres={};
  days.forEach(d=>{ const ds=d.date||''; if(ds.length<7) return; const y=+ds.slice(0,4), mo=+ds.slice(5,7)-1; if(isNaN(y)||isNaN(mo)) return; if(!m[y]){m[y]=new Array(12).fill(0); pres[y]=new Set();} m[y][mo]+=mdDirTot(d,'in'); pres[y].add(mo); });
  // Monthly-summary fallback · fills only months that have NO daily data (daily wins for accuracy)
  if(typeof SB_MARKET_MONTHLY==='object' && SB_MARKET_MONTHLY){
    Object.keys(SB_MARKET_MONTHLY).forEach(ym=>{ const y=+ym.slice(0,4), mo=+ym.slice(5,7)-1; const v=+SB_MARKET_MONTHLY[ym]||0; if(isNaN(y)||isNaN(mo)||v<=0) return; if(!m[y]){m[y]=new Array(12).fill(0); pres[y]=new Set();} if(!pres[y].has(mo)){ m[y][mo]=v; pres[y].add(mo); } });
  }
  return {m,pres};
}
function _mdOvSmooth(P){ if(!P.length) return ''; if(P.length===1) return 'M'+P[0].x.toFixed(1)+','+P[0].y.toFixed(1); let d='M'+P[0].x.toFixed(1)+','+P[0].y.toFixed(1); for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;const c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6,c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;d+=' C'+c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+' '+p2.x.toFixed(1)+','+p2.y.toFixed(1);} return d; }
function mdTabOverview(days){
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const latest=days[days.length-1]||{date:'',in:{},out:{}}; const li=latest.in||{}, lo=latest.out||{};
  const sorted=Object.entries(li).sort((a,b)=>b[1]-a[1]);
  const arrC=mdArrivalsByCode(), ourC=mdOurMixByCode(); const totA=mdSum(arrC)||1, totO=mdSum(ourC)||1;
  const capIdx=code=>{ if(!code||!arrC[code]) return null; const aS=arrC[code]/totA, oS=(ourC[code]||0)/totO; return aS>0?Math.round(oS/aS*100):0; };
  const dt=new Date(latest.date+'T00:00'); const dlbl=isNaN(dt)?latest.date:dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const GP='class="md-gp" style="padding:14px 16px"';
  // ── monthly / daily aggregation for the hero chart ──
  const _mm=_mdOvMonthly(days); const m=_mm.m, pres=_mm.pres;
  const years=Object.keys(m).map(Number).sort((a,b)=>a-b);
  const curY=years.length?years[years.length-1]:new Date().getFullYear();
  const prevY=years.includes(curY-1)?curY-1:(years.length>1?years[years.length-2]:null);
  const curArr=m[curY]||new Array(12).fill(0); const curPres=pres[curY]||new Set();
  const prevArr=prevY!=null?(m[prevY]||new Array(12).fill(0)):null; const prevPres=prevY!=null?pres[prevY]:new Set();
  const curYTD=curArr.reduce((a,b)=>a+b,0); const prevTot=prevArr?prevArr.reduce((a,b)=>a+b,0):0;
  const frac=prevTot>0?Math.min(1,curYTD/prevTot):(curYTD>0?0.75:0);
  let lastMo=-1; for(let i=0;i<12;i++) if(curPres.has(i)) lastMo=i;
  const latestVal=lastMo>=0?curArr[lastMo]:0; const peakVal=Math.max(...curArr,1);
  const pacePct=Math.round(latestVal/peakVal*100);
  let prevMoIdx=-1; for(let i=lastMo-1;i>=0;i--) if(curPres.has(i)){prevMoIdx=i;break;}
  const mom=(prevMoIdx>=0&&curArr[prevMoIdx])?Math.round((latestVal-curArr[prevMoIdx])/curArr[prevMoIdx]*100):null;
  const yoy=(prevArr&&lastMo>=0&&prevPres.has(lastMo)&&prevArr[lastMo])?Math.round((latestVal-prevArr[lastMo])/prevArr[lastMo]*100):null;
  // YEAR config (two series by year)
  const yearSeries=[];
  if(prevArr) yearSeries.push({label:String(prevY),color:'#F4762E',pts:[...prevPres].sort((a,b)=>a-b).map(i=>({i,v:prevArr[i]}))});
  yearSeries.push({label:String(curY),color:'#E0738F',pts:[...curPres].sort((a,b)=>a-b).map(i=>({i,v:curArr[i]}))});
  const yearCfg={labels:MON,n:12,series:yearSeries};
  // MONTH config (daily of latest month present)
  const latestDay=days.length?(days[days.length-1].date||''):''; const ym=latestDay.slice(0,7);
  const dim=ym?new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate():30;
  const dayMap={}; days.forEach(d=>{ if((d.date||'').slice(0,7)===ym){ dayMap[+d.date.slice(8,10)]=mdDirTot(d,'in'); } });
  const mLabels=[]; for(let i=1;i<=dim;i++) mLabels.push((i%5===0||i===1)?String(i):'');
  const monthPts=Object.keys(dayMap).map(Number).sort((a,b)=>a-b).map(dd=>({i:dd-1,v:dayMap[dd]}));
  const monthCfg={labels:mLabels,n:dim,series:[{label:ym,color:'#F4762E',pts:monthPts}]};
  // WEEK config (last 7 imported days)
  const last7=days.slice(-7);
  const wLabels=last7.map(d=>(d.date||'').slice(5));
  const weekPts=last7.map((d,i)=>({i,v:mdDirTot(d,'in')}));
  const weekCfg={labels:wLabels,n:Math.max(last7.length,1),series:[{label:'7d',color:'#F4762E',pts:weekPts}]};
  const cnt=c=>c.series.reduce((s,se)=>s+se.pts.length,0);
  let def='year'; if(cnt(monthCfg)>=2 && cnt(monthCfg)>cnt(yearCfg)) def='month'; else if(cnt(yearCfg)<2 && cnt(weekCfg)>=2) def='week';
  _mdOv={year:yearCfg,month:monthCfg,week:weekCfg,def,
    kpi:{ year:[_mdOvFmt(latestVal), (yoy!=null?yoy:(mom!=null?mom:0))], month:[_mdOvFmt(latestVal),(mom!=null?mom:0)], week:[_mdOvFmt(weekPts.length?weekPts[weekPts.length-1].v:0),0] }};
  // ── hero card 1: total arrivals gauge ──
  const actLen=(301.6*frac).toFixed(1);
  const gaugeCard=`<div class="md-gp" style="padding:16px 18px;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#333d4b;margin-bottom:4px"><span>Total arrivals</span></div>
    <div style="position:relative;display:flex;justify-content:center;align-items:center;height:140px">
      <svg viewBox="0 0 190 170" width="170" height="140"><circle cx="95" cy="95" r="72" fill="none" stroke="rgba(20,30,50,.10)" stroke-width="14" stroke-linecap="round" stroke-dasharray="301.6 150.8" transform="rotate(150 95 95)"/><circle cx="95" cy="95" r="72" fill="none" stroke="#F4762E" stroke-width="14" stroke-linecap="round" stroke-dasharray="${actLen} 999" transform="rotate(150 95 95)"/></svg>
      <div style="position:absolute;text-align:center;top:52%;transform:translateY(-50%)"><b style="display:block;font-size:28px;font-weight:500;color:#161d28;font-family:'DM Mono',monospace">${_mdOvFmt(curYTD)}</b><span style="font-size:11px;color:#525a69">Arrivals YTD ${curY}</span></div>
    </div>
    <p style="font-size:11.5px;line-height:1.5;color:#525a69;text-align:center;margin:2px 0 0">Phuket airport immigration · ${prevY!=null?`vs ${_mdOvFmt(prevTot)} total ${prevY}`:`current year to date`}</p>
  </div>`;
  // ── hero card 2: current-month pace slider ──
  const sliderCard=`<div class="md-gp" style="padding:16px 18px">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#333d4b;margin-bottom:4px"><span>Current month pace</span></div>
    <div style="font-size:44px;font-weight:500;line-height:1.05;margin:4px 0 2px;color:#161d28">${pacePct}%</div>
    <div style="font-size:13px;color:${mom!=null&&mom<0?'#C2421F':'#0F6E56'};display:flex;align-items:center;gap:5px;margin-bottom:20px">${mom!=null?`${mom<0?'▼':'▲'} ${Math.abs(mom)}% vs last month`:`latest month`}</div>
    <div style="position:relative;height:12px;border-radius:8px;background:rgba(20,30,50,.14)">
      <div style="position:absolute;left:0;top:0;height:100%;width:${pacePct}%;border-radius:8px;background:linear-gradient(90deg,#F4762E,#F79A4E)"></div>
      <div style="position:absolute;left:${pacePct}%;top:50%;width:18px;height:18px;border-radius:50%;background:#fff;border:4px solid #F4762E;transform:translate(-50%,-50%);box-shadow:0 2px 8px rgba(40,30,20,.25)"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:11.5px;color:#525a69"><span>0</span><span style="color:#C2421F;font-weight:500">${mdFmt(latestVal)}</span><span>${mdFmt(peakVal)}</span></div>
  </div>`;
  // ── hero card 3: recent arrivals chart (Year/Month/Week) ──
  const allIn=years.reduce((s,y)=>s+(m[y]||[]).reduce((a,b)=>a+b,0),0);
  const seg=(k,l)=>`<button id="mdOvSeg-${k}" onclick="mdOvMode('${k}')" style="border:none;background:transparent;color:#414b59;font-family:inherit;font-size:13px;padding:6px 14px;border-radius:9px;cursor:pointer">${l}</button>`;
  const chartCard=`<div class="md-gp" style="padding:16px 18px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div><div style="font-size:15px;font-weight:500;color:#161d28">Recent arrivals · Phuket airport</div><div style="font-size:11.5px;color:#525a69;margin-top:2px">More than ${_mdOvFmt(allIn)} arrivals tracked</div></div>
      <div style="display:flex;background:rgba(255,255,255,.35);border:1px solid rgba(20,30,50,.10);border-radius:12px;padding:3px">${seg('year','Year')}${seg('month','Month')}${seg('week','Week')}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:12px 0 2px"><b id="mdOvKpiVal" style="font-size:24px;font-weight:500;color:#161d28;font-family:'DM Mono',monospace"></b><span id="mdOvKpiBadge" style="font-size:12px;padding:3px 9px;border-radius:8px"></span></div>
    <svg id="mdOvChart" viewBox="0 0 940 300" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-height:300px" role="img" aria-label="Arrivals trend chart"></svg>
    <div style="display:flex;gap:18px;justify-content:flex-end;font-size:11.5px;color:#414b59;margin-top:2px">${prevY!=null?`<span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#F4762E;margin-right:6px;vertical-align:middle"></i>${prevY}</span>`:''}<span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#E0738F;margin-right:6px;vertical-align:middle"></i>${curY}</span></div>
  </div>`;
  // ── Leaderboard top 50 (2-col · 25/25 · fills the tall right panel) ──
  const top15=sorted.slice(0,50); const maxN=Math.max(...top15.map(([n,v])=>Math.abs(v-(lo[n]||0))),1);
  const _lbHd=`<div style="display:flex;font-size:9px;color:#8a97a6;text-transform:uppercase;letter-spacing:.04em;padding:0 4px 5px;border-bottom:1px solid rgba(0,0,0,.08)"><span style="width:18px">#</span><span style="flex:1">Nationality</span><span style="width:50px;text-align:right">In</span><span style="width:50px;text-align:right">Out</span><span style="width:112px;text-align:right">Net flow</span></div>`;
  const _mkLbRow=([nat,v],i)=>{ const out=lo[nat]||0; const nt=v-out; const c=MD_NAT_TH2CODE[nat]; const pos=nt>=0; const w=Math.round(Math.abs(nt)/maxN*44); return `<div style="display:flex;align-items:center;padding:6px 4px;border-bottom:0.5px solid rgba(0,0,0,.05)${i%2?';background:rgba(255,255,255,.28)':''}"><span style="width:18px;font-family:'DM Mono',monospace;color:#9aa3b0;font-size:10px">${i+1}</span><span style="flex:1;font-size:12px;color:#27384a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nat}${c?` <span style="color:#185FA5;font-size:9px;font-weight:700">${c}</span>`:''}</span><span style="width:50px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#0F6E56">${mdFmt(v)}</span><span style="width:50px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#A05A1A">${mdFmt(out)}</span><span style="width:112px;display:inline-flex;align-items:center;justify-content:flex-end;gap:7px"><span style="width:${w}px;height:7px;border-radius:4px;background:${pos?'#1D9E75':'#E2655F'}"></span><span style="width:56px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${nt===0?'#8a97a6':(pos?'#0F7A5A':'#C2421F')}">${nt===0?'0':(pos?'▲ ':'▼ ')+mdFmt(Math.abs(nt))}</span></span></div>`; };
  const _lbHalf=Math.ceil(top15.length/2);
  const _lbColA=top15.slice(0,_lbHalf).map((e,i)=>_mkLbRow(e,i)).join('');
  const _lbColB=top15.slice(_lbHalf).map((e,i)=>_mkLbRow(e,i+_lbHalf)).join('');
  const lbCard=`<div class="md-gp" style="padding:14px 18px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-size:15px;font-weight:500">Nationality leaderboard <span style="color:#C2421F;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">· TOP ${top15.length} · ${dlbl}</span></div><div style="font-size:10px;color:#8a97a6"><span style="color:#0F6E56">In</span> · <span style="color:#A05A1A">Out</span> · Net flow (in − out)</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">${_lbColB?`<div>${_lbHd}${_lbColA}</div><div>${_lbHd}${_lbColB}</div>`:`<div style="grid-column:1 / -1">${_lbHd}${_lbColA}</div>`}</div></div>`;
  // ── Top markets cumulative ──
  const cumNat={}; days.forEach(d=>Object.entries(d.in||{}).forEach(([n,v])=>cumNat[n]=(cumNat[n]||0)+v));
  const topCum=Object.entries(cumNat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const pal=['#BA7517','#185FA5','#A32D2D','#0F6E56','#3B6D11','#534AB7'];
  const tmRows=topCum.map(([nat,v],i)=>{ const c=MD_NAT_TH2CODE[nat]; const today=li[nat]||0; return `<div style="display:flex;align-items:center;gap:10px;padding:8.5px 0;border-bottom:0.5px solid rgba(0,0,0,.06);${i===0?'background:rgba(232,100,42,.09);border-radius:9px;padding-left:6px;padding-right:6px':''}"><div style="width:40px;height:36px;border-radius:9px;background:linear-gradient(135deg,${pal[i%6]},#C98F7E);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:10px;flex-shrink:0">${c||'·'}</div><div style="flex:1;min-width:0"><div style="font-size:12.5px;color:${i===0?'#A8472F':'#27384a'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nat}</div><div style="font-size:10px;color:#8a97a6">${mdFmt(v)} arrivals</div></div><span style="font-size:10px;font-weight:500;padding:3px 9px;border-radius:11px;background:${today>0?'#E1F5EE':'#eef1f5'};color:${today>0?'#0F6E56':'#6c7a8c'}">${today>0?'+'+mdFmt(today):'—'}</span></div>`; }).join('');
  const tmCard=`<div class="md-gp" style="padding:14px 16px"><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:14px;font-weight:500">Top markets</div></div><div style="font-size:10px;color:#8a97a6;margin:2px 0 6px">cumulative since records began · <b style="color:#27384a">${days.length}</b> day(s)</div>${tmRows}</div>`;
  // ── Opportunities ──
  const opp=Object.entries(arrC).map(([c,a])=>{const ours=ourC[c]||0;return {c,a,ours,share:a>0?ours/a*100:0,idx:capIdx(c)};}).filter(o=>o.idx!=null&&o.idx<=70).sort((x,y)=>y.a-x.a).slice(0,6);
  const _shFmt=s=>s>=10?Math.round(s)+'%':s>=0.1?s.toFixed(1)+'%':(s>0?'<0.1%':'0%');
  const opHead=`<div style="display:flex;font-size:9.5px;color:#8a97a6;padding-bottom:4px;border-bottom:0.5px solid rgba(0,0,0,.06)"><span style="flex:1">Nationality</span><span style="width:48px;text-align:right">Arr.</span><span style="width:44px;text-align:right">Ours</span><span style="width:48px;text-align:right">Share</span></div>`;
  const opRows=opp.length?opp.map((o,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:0.5px solid rgba(0,0,0,.06)"><span style="width:14px;height:14px;border-radius:4px;border:1.5px solid ${i===0?'#E8642A':'#c7d2de'};background:${i===0?'#E8642A':'transparent'}"></span><span style="flex:1;font-size:12px;color:#27384a">${MD_CODE2EN[o.c]||o.c}</span><span style="width:48px;text-align:right;font-size:11px;font-family:'DM Mono',monospace">${mdFmt(o.a)}</span><span style="width:44px;text-align:right;font-size:11px;font-family:'DM Mono',monospace;color:#0F6E56">${mdFmt(o.ours)}</span><span style="width:48px;text-align:right;font-size:11px;font-family:'DM Mono',monospace;color:#A32D2D">${_shFmt(o.share)}</span></div>`).join(''):'<div style="font-size:11px;color:#8a97a6;padding:10px 0">Good coverage · no under-captured markets</div>';
  const opCard=`<div class="md-gp" style="padding:14px 16px;display:flex;flex-direction:column;flex:1"><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:14px;font-weight:500">Top opportunities</div><span style="background:#E8642A;color:#fff;font-size:10px;font-weight:500;padding:4px 10px;border-radius:11px">Act</span></div><div style="font-size:10px;color:#8a97a6;margin:3px 0 7px">big arrivals · low share · Share = ours ÷ arrivals</div>${opHead}${opRows}<div style="flex:1"></div></div>`;
  // ── Net flow by nationality (rolling window · momentum, not all-time stock) ──
  const _win=_mdNetWin||7; const _netDays=days.slice(-_win); const _winN=_netDays.length;
  const cumNet2={}; _netDays.forEach(d=>{ Object.entries(d.in||{}).forEach(([n,v])=>cumNet2[n]=(cumNet2[n]||0)+(+v||0)); Object.entries(d.out||{}).forEach(([n,v])=>cumNet2[n]=(cumNet2[n]||0)-(+v||0)); });
  const netTop=Object.entries(cumNet2).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const netPal=['#1D9E75','#185FA5','#BA7517','#A32D2D','#534AB7','#0F6E56'];
  const netTileRows=netTop.map(([nat,v],i)=>{ const c=MD_NAT_TH2CODE[nat]; const pos=v>=0; const today=(li[nat]||0)-(lo[nat]||0); const tcol=today>0?'#0F6E56':today<0?'#A32D2D':'#8a97a6'; const tstr=today>0?'+'+mdFmt(today):today<0?'−'+mdFmt(Math.abs(today)):'±0'; return `<div style="display:flex;align-items:center;gap:10px;padding:8.5px 0;border-bottom:0.5px solid rgba(0,0,0,.06);${i===0?'background:rgba(29,158,117,.10);border-radius:9px;padding-left:6px;padding-right:6px':''}"><div style="width:40px;height:36px;border-radius:9px;background:linear-gradient(135deg,${netPal[i%6]},#C98F7E);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:10px;flex-shrink:0">${c||'·'}</div><div style="flex:1;min-width:0"><div style="font-size:12.5px;color:${i===0?'#0F6E56':'#27384a'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nat}</div><div style="font-size:10px;color:${tcol}">${tstr} today</div></div><span title="net flow over last ${_winN} day(s)" style="font-size:11px;font-weight:600;font-family:'DM Mono',monospace;padding:3px 10px;border-radius:11px;background:${pos?'#E1F5EE':'#FCEBEB'};color:${pos?'#0F6E56':'#A32D2D'}">${pos?'▲ ':'▼ '}${mdFmt(Math.abs(v))}</span></div>`; }).join('');
  const _winBtn=n=>`<button onclick="event.stopPropagation();mdSetNetWin(${n})" style="border:none;background:${_win===n?'#1D9E75':'transparent'};color:${_win===n?'#fff':'#6c7a8c'};border-radius:8px;padding:2px 8px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit">${n}d</button>`;
  const netTileCard=`<div class="md-gp" style="padding:14px 16px;display:flex;flex-direction:column;flex:1"><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:14px;font-weight:500">Net flow <span style="font-size:11px;color:#8a97a6;font-weight:400">· ${_winN}d</span></div><div style="display:inline-flex;gap:2px;background:rgba(0,0,0,.05);border-radius:9px;padding:2px">${_winBtn(7)}${_winBtn(14)}${_winBtn(30)}</div></div><div style="font-size:10px;color:#8a97a6;margin:2px 0 6px">arrivals − departures · last ${_winN} day(s) · ▲ building / ▼ thinning</div>${netTop.length?netTileRows:'<div style="font-size:11px;color:#8a97a6;padding:8px 0">Import departures (OUT1) to compare</div>'}<div style="flex:1"></div></div>`;
  // 3-column dashboard · left = KPIs+chart+opportunity · middle = market panels · right = big leaderboard
  // align-items:stretch → all 3 columns share the tallest height; the bottom card of cols 1 & 2 (flex:1) fills to align the baselines
  return `<div style="display:grid;grid-template-columns:1.25fr 0.85fr 1.9fr;gap:12px;align-items:stretch;width:100%">`
    // Col 1 · gauge+pace (top, side by side) → Recent arrivals chart → Top opportunities
    + `<div style="display:flex;flex-direction:column;gap:12px">`
      + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${gaugeCard}${sliderCard}</div>`
      + chartCard
      + opCard
    + `</div>`
    // Col 2 · Top markets + Net in-island, stacked
    + `<div style="display:flex;flex-direction:column;gap:12px">${tmCard}${netTileCard}</div>`
    // Col 3 · Nationality leaderboard (big · 2-col internal)
    + lbCard
    + `</div>`;
}
function mdOvDraw(mode){
  if(!_mdOv) return; const cfg=_mdOv[mode]||_mdOv.year;
  const W=940,padL=52,padR=20,padT=16,padB=34, plotW=W-padL-padR, plotH=300-padT-padB;
  let vals=[]; cfg.series.forEach(s=>s.pts.forEach(p=>vals.push(p.v))); if(!vals.length) vals=[0,1];
  let mn=Math.min(...vals), mx=Math.max(...vals); const pad=(mx-mn)*0.25||Math.max(mx*0.1,1000); const yMin=Math.max(0,mn-pad), yMax=mx+pad;
  const X=i=> padL+(cfg.n<=1?plotW/2:i*(plotW/(cfg.n-1)));
  const Y=v=> padT+(1-(v-yMin)/((yMax-yMin)||1))*plotH;
  let svg='';
  for(let g=0;g<=4;g++){ const gv=yMin+(yMax-yMin)*g/4, gy=Y(gv); svg+='<line x1="'+padL+'" y1="'+gy.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+gy.toFixed(1)+'" stroke="rgba(20,30,50,.08)" stroke-width="1"/><text x="'+(padL-8)+'" y="'+(gy+4).toFixed(1)+'" fill="#6b7280" font-size="10" text-anchor="end" font-family="\'DM Mono\',monospace">'+_mdOvFmt(gv)+'</text>'; }
  cfg.labels.forEach((lb,i)=>{ if(!lb) return; svg+='<text x="'+X(i).toFixed(1)+'" y="288" fill="#6b7280" font-size="10" text-anchor="middle" font-family="\'DM Mono\',monospace">'+lb+'</text>'; });
  // gradient defs (twin gradient area)
  svg+='<defs>'+cfg.series.map((s,si)=>'<linearGradient id="mdov-g'+si+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity="0.30"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient>').join('')+'</defs>';
  const _baseY=padT+plotH;
  cfg.series.forEach((s,si)=>{ if(!s.pts.length) return; const P=s.pts.map(p=>({x:X(p.i),y:Y(p.v)})); const d=_mdOvSmooth(P); if(P.length>=2){ svg+='<path d="'+d+' L'+P[P.length-1].x.toFixed(1)+','+_baseY+' L'+P[0].x.toFixed(1)+','+_baseY+' Z" fill="url(#mdov-g'+si+')"/>'; } svg+='<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="3" stroke-linecap="round"/>'; P.forEach(p=>{ svg+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.4" fill="#fff" stroke="'+s.color+'" stroke-width="2"/>'; }); });
  const hs=cfg.series[cfg.series.length-1];
  // %-change pills on the highlighted series · YoY (vs other series, same slot) when 2 series · else vs previous point · skip when too many points
  if(hs && hs.pts.length && hs.pts.length<=12){
    const _other=cfg.series.length>=2?cfg.series[0]:null; const _om={}; if(_other) _other.pts.forEach(p=>_om[p.i]=p.v);
    hs.pts.forEach((p,k)=>{ let prev=_other?(_om[p.i]!=null?_om[p.i]:null):(k>0?hs.pts[k-1].v:null); if(prev==null||prev===0) return; const pct=Math.round((p.v-prev)/prev*100); const up=pct>=0; const txt=(up?'▲ +':'▼ ')+Math.abs(pct)+'%'; const w=txt.length*5.6+10; const px=Math.max(padL,Math.min(X(p.i)-w/2,W-padR-w)); const py=Y(p.v)-22; svg+='<rect x="'+px.toFixed(1)+'" y="'+py.toFixed(1)+'" width="'+w.toFixed(1)+'" height="15" rx="7.5" fill="'+(up?'#E1F5EE':'#FCEBEB')+'"/><text x="'+(px+w/2).toFixed(1)+'" y="'+(py+10.5).toFixed(1)+'" fill="'+(up?'#0F7A5A':'#C2421F')+'" font-size="9" text-anchor="middle" font-weight="500">'+txt+'</text>'; });
  }
  const hpts=hs.pts.map(p=>({px:X(p.i),py:Y(p.v),v:p.v}));
  _mdOv.cur={mode,W,padL,padR,padT,plotH,pts:hpts,hoverColor:hs.color};
  svg+='<g id="mdOvCross"></g>';
  svg+='<rect x="'+padL+'" y="'+padT+'" width="'+plotW+'" height="'+plotH+'" fill="transparent" onmousemove="mdOvHover(event)" onmouseleave="mdOvHover(-1)"/>';
  const el=document.getElementById('mdOvChart'); if(el){ el.innerHTML=svg; const cg=document.getElementById('mdOvCross'); if(cg) cg.innerHTML=mdOvCrossHTML(hpts.length-1); }
  const k=(_mdOv.kpi&&_mdOv.kpi[mode])||['',0]; const kv=document.getElementById('mdOvKpiVal'); const kb=document.getElementById('mdOvKpiBadge');
  if(kv) kv.textContent=k[0]; if(kb){ const pc=k[1]||0; kb.textContent=(pc>=0?'+':'')+pc+'%'; kb.style.background=pc>=0?'rgba(36,160,90,.20)':'rgba(227,75,74,.18)'; kb.style.color=pc>=0?'#136037':'#A32D2D'; }
  ['year','month','week'].forEach(mm=>{ const b=document.getElementById('mdOvSeg-'+mm); if(b){ b.style.background=mm===mode?'#F4762E':'transparent'; b.style.color=mm===mode?'#fff':'#414b59'; } });
}
function mdOvCrossHTML(idx){
  if(!_mdOv||!_mdOv.cur) return ''; const cur=_mdOv.cur; const p=cur.pts[idx]; if(!p) return '';
  const W=cur.W||640; const bw=86; let bx=Math.max(cur.padL,Math.min(p.px-bw/2,W-cur.padR-bw)); const by=p.py-40;
  return '<line x1="'+p.px.toFixed(1)+'" y1="'+cur.padT+'" x2="'+p.px.toFixed(1)+'" y2="'+(cur.padT+cur.plotH)+'" stroke="rgba(40,50,70,.4)" stroke-width="1" stroke-dasharray="4 4"/>'
   +'<line x1="'+cur.padL+'" y1="'+p.py.toFixed(1)+'" x2="'+(W-cur.padR)+'" y2="'+p.py.toFixed(1)+'" stroke="rgba(40,50,70,.4)" stroke-width="1" stroke-dasharray="4 4"/>'
   +'<circle cx="'+p.px.toFixed(1)+'" cy="'+p.py.toFixed(1)+'" r="7" fill="#fff" stroke="'+cur.hoverColor+'" stroke-width="4"/>'
   +'<rect x="'+bx.toFixed(1)+'" y="'+by.toFixed(1)+'" width="'+bw+'" height="26" rx="7" fill="rgba(22,29,40,.92)"/>'
   +'<text x="'+(bx+bw/2).toFixed(1)+'" y="'+(by+17).toFixed(1)+'" fill="#fff" font-size="12" text-anchor="middle" font-weight="500" font-family="\'DM Mono\',monospace">'+mdFmt(p.v)+'</text>';
}
function mdOvHover(e){
  if(!_mdOv||!_mdOv.cur) return; const cur=_mdOv.cur; let idx;
  if(e===-1||e==null){ idx=cur.pts.length-1; }
  else { const svg=document.getElementById('mdOvChart'); if(!svg) return; const r=svg.getBoundingClientRect(); const sx=(e.clientX-r.left)/r.width*(cur.W||640); let best=0,bd=1e9; cur.pts.forEach((p,i)=>{const dd=Math.abs(p.px-sx); if(dd<bd){bd=dd;best=i;}}); idx=best; }
  const g=document.getElementById('mdOvCross'); if(g) g.innerHTML=mdOvCrossHTML(idx);
}
function mdOvMode(m){ if(_mdOv) mdOvDraw(m); }
function mdOvInit(){ if(_mdOv) mdOvDraw(_mdOv.def); }

function mdTabForecast(days){
  let html='';
  // net flow by nationality (rolling window · momentum, not all-time stock)
  const _fwin=_mdNetWin||7; const _fdays=days.slice(-_fwin); const _fwinN=_fdays.length;
  const cum={}; _fdays.forEach(d=>{ Object.entries(d.in||{}).forEach(([n,v])=>cum[n]=(cum[n]||0)+v); Object.entries(d.out||{}).forEach(([n,v])=>cum[n]=(cum[n]||0)-v); });
  const net=Object.entries(cum).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([n,v])=>({label:n,val:Math.abs(v),col:v>=0?'#0F6E56':'#A32D2D',extra:(v>=0?'▲ ':'▼ ')+mdFmt(Math.abs(v))}));
  html+=mdNote('Net flow = arrivals − departures per nationality over the last '+_fwinN+' day(s). ▲ market building up · ▼ thinning out. (Rolling window — not an all-time on-island total.)');
  html+=mdCard('Net flow by nationality · '+_fwinN+'d','demand momentum',mdHbars(net,Math.max(...net.map(r=>r.val),1)));
  // on-the-books pipeline (our future bookings by week)
  const wk=mdOnTheBooks(); const wkRows=[]; for(let i=0;i<8;i++) wkRows.push({label:`Week +${i} `,val:wk[i]||0,col:'#1683C7'});
  const totFut=Object.values(wk).reduce((s,v)=>s+v,0);
  html+=mdCard('On-the-books pipeline','our confirmed pax · next 8 weeks · '+mdFmt(totFut)+' pax', totFut>0?mdHbars(wkRows,Math.max(...wkRows.map(r=>r.val),1)):'<div style="font-size:12px;color:var(--fd-ink-soft)">No future bookings yet</div>');
  html+=mdNote('Forecast model (arrivals → predicted bookings with market lead-time) unlocks after ~1-3 months of daily imports. Until then this shows the live demand pool + your current pipeline.');
  return html;
}
// ── TAB: Market Gap (theme 2 + 5) ──
function mdTabGap(days){
  const arrC=mdArrivalsByCode(), ourC=mdOurMixByCode(); const totA=mdSum(arrC)||1, totO=mdSum(ourC)||1;
  const _capFmt=s=>s>=10?Math.round(s)+'%':s>=0.1?s.toFixed(1)+'%':(s>0?'<0.1%':'0%');
  // include nationalities we actually have customers from (ourC>0) even if they have NO arrivals data (e.g. Spanish/Mexican groups)
  const codes=[...new Set([...Object.keys(arrC),...Object.keys(ourC)])].filter(c=>(arrC[c]||0)>0||(ourC[c]||0)>0).sort((a,b)=>((arrC[b]||0)-(arrC[a]||0))||((ourC[b]||0)-(ourC[a]||0))).slice(0,28);
  const ourNatCount=Object.keys(ourC).filter(c=>(ourC[c]||0)>0).length;
  const rows=codes.map(c=>{ const arr=arrC[c]||0, our=ourC[c]||0; const aS=arr/totA*100, oS=our/totO*100; const noArr=arr<=0;
    const idx=noArr?null:Math.round(oS/aS*100);
    const f = noArr ? ['#185FA5','new · no arrival data'] : (idx>=120?['#0F6E56','over-index']:idx<=70?['#A32D2D','UNDER · opportunity']:['#7A4A00','~ par']);
    const arrCell = noArr?'<span style="color:#c7c3b8">—</span>':mdFmt(arr);
    const arrShareCell = noArr?'<span style="color:#c7c3b8">—</span>':aS.toFixed(1)+'%';
    const idxCell = noArr?`<span style="font-size:9px">${f[1]}</span>`:`${idx} <span style="font-size:9px">${f[1]}</span>`;
    const cap = noArr?null:(arr>0?our/arr*100:0);
    const capCell = noArr?'<span style="color:#c7c3b8">—</span>':_capFmt(cap);
    return `<tr style="border-top:0.5px solid var(--fd-line-soft)${noArr?';background:#F4F8FC':''}"><td style="padding:6px 8px;font-size:12px">${MD_CODE2EN[c]||c} <span style="color:#185FA5;font-size:9px;font-weight:700">${c}</span></td><td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">${arrCell}</td><td style="padding:6px 8px;text-align:right;font-size:11px;color:var(--fd-ink-soft)">${arrShareCell}</td><td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">${mdFmt(our)}</td><td style="padding:6px 8px;text-align:right;font-size:11px;color:var(--fd-ink-soft)">${oS.toFixed(1)}%</td><td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-weight:700;font-size:11px;color:#161d28">${capCell}</td><td style="padding:6px 8px;text-align:right;font-weight:700;font-size:11px;color:${f[0]}">${idxCell}</td></tr>`; }).join('');
  const table=`<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#fafaf8"><th style="padding:6px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Nationality</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Arrivals</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">share</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Our pax</th><th style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">share</th><th title="our pax ÷ arrivals · real market share" style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Capture</th><th title="mix index · our share ÷ arrival share ×100 (relative, not real share)" style="padding:6px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft);text-transform:uppercase">Index</th></tr></thead><tbody>${rows}</tbody></table>`;
  // top opportunities (under-index + high arrivals)
  const opps=codes.map(c=>{ const aS=(arrC[c]||0)/totA*100,oS=(ourC[c]||0)/totO*100; const arr=arrC[c]||0; return {c,arr,our:ourC[c]||0,cap:arr>0?(ourC[c]||0)/arr*100:0,idx:aS>0?oS/aS*100:0}; }).filter(o=>o.arr>0 && o.idx<=70).slice(0,4);
  const oppHtml=opps.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${opps.map(o=>`<div style="background:#FDEEEC;border:1px solid #E6B0AA;border-radius:9px;padding:8px 12px"><div style="font-size:12px;font-weight:800;color:#A32D2D">${MD_CODE2EN[o.c]||o.c}</div><div style="font-size:9.5px;color:#8a3a30">${mdFmt(o.arr)} arrivals · ours ${mdFmt(o.our)} · capture <b>${_capFmt(o.cap)}</b> · push this market</div></div>`).join('')}</div>`:'';
  const cov=(typeof mdOurNatCoverage==='function')?mdOurNatCoverage():{with:0,total:0};
  const covPct=cov.total?Math.round(100*cov.with/cov.total):0;
  const covNote = cov.with===0
    ? `⚠ <b>Our pax shows 0 because none of your bookings have a nationality yet.</b> The system tried to guess from customer names but couldn't. Fill <b>Nationality</b> on bookings (the form has a GUESS helper) — then this column populates. Arrivals side is fine.`
    : `Our pax attributed by booking nationality (or guessed from the lead name). <b>${cov.with}/${cov.total} bookings (${covPct}%)</b> attributed — fill Nationality on the rest for an accurate share.`;
  const backfillBtn = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button onclick="mdBackfillNat()" style="background:#1683C7;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer">↺ Auto-fill nationality on existing bookings</button><button onclick="mdCleanupNats()" style="background:#fff;color:#5B289A;border:1px solid #D9C7EE;font-family:inherit;font-size:11px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer">🧹 Clean up nationality list (duplicates / junk)</button></div>`;
  return mdNote('Two views: <b>Capture</b> = our pax ÷ arrivals = the REAL share of that market we actually got (small everywhere — our book is tiny vs the whole airport). <b>Index</b> = our mix share ÷ arrival mix share ×100 = relative weighting inside our own book (100 = par · &gt;100 over-weighted · ≤70 under-weighted). Index ≤70 flags opportunities; Capture tells you the honest size of what you hold.')+mdNote(covNote)+backfillBtn+(oppHtml?mdCard('🎯 Top opportunities','under-indexed markets',oppHtml):'')+mdCard('Penetration index',`our booking mix vs Phuket arrival mix · we serve <b>${ourNatCount}</b> nationalities · <b>${mdFmt(totO)}</b> pax`,table)+mdMissingNatCard();
}
// ── TAB: Season & Pricing (theme 3) ──
function mdTabSeason(days){
  const wd=mdArrivalsByWeekday(); const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const rows=names.map((n,i)=>({label:n,val:wd[i],col:'#185FA5'}));
  const maxWd=Math.max(...wd,1); const avg=wd.reduce((s,v)=>s+v,0)/(wd.filter(v=>v>0).length||1);
  const tierRows=names.map((n,i)=>{ const v=wd[i]; if(!v) return ''; const tier=v>=avg*1.15?['Peak','#A32D2D']:v<=avg*0.85?['Low','#0F6E56']:['Normal','#7A4A00']; return `<span style="font-size:10px;font-weight:700;color:${tier[1]};background:#fff;border:1px solid var(--fd-line);border-radius:6px;padding:2px 8px;margin:2px">${n}: ${tier[0]}</span>`; }).join('');
  const lead=mdLeadByMarket(); const lmRows=Object.entries(lead.out).map(([mk,arr])=>{ const tot=arr.reduce((s,v)=>s+v,0)||1; const early=Math.round((arr[3]+arr[4])/tot*100); return `<tr style="border-top:0.5px solid var(--fd-line-soft)"><td style="padding:5px 8px;font-size:11.5px">${mdMarketName(mk)}</td>${arr.map(v=>`<td style="padding:5px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;${v?'':'color:#c7c5bb'}">${v}</td>`).join('')}<td style="padding:5px 8px;text-align:right;font-size:10px;color:${early>=50?'#185FA5':'#A32D2D'}">${early}% early</td></tr>`; }).join('');
  return mdNote('Seasonality fills in as you import more days (a few weeks → weekday/monthly pattern). Demand tier suggests peak/normal/low for pricing — feeds the Peak-Season pricing module.')
    +mdCard('Arrivals by weekday','demand rhythm',rows.some(r=>r.val)?mdHbars(rows,maxWd):'<div style="font-size:12px;color:var(--fd-ink-soft)">Import a few days to see the weekday pattern</div>')
    +(tierRows?mdCard('Suggested demand tier','vs average · for pricing',`<div>${tierRows}</div>`):'')
    +mdCard('Lead-time by market','how far ahead each market books (our bookings) · 0-3 / 4-7 / 8-14 / 15-30 / 30d+', lmRows?`<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#fafaf8"><th style="padding:5px 8px;text-align:left;font-size:9px;color:var(--fd-ink-soft)">Market</th><th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft)">0-3d</th><th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft)">4-7</th><th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft)">8-14</th><th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft)">15-30</th><th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft)">30d+</th><th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--fd-ink-soft)">early%</th></tr></thead><tbody>${lmRows}</tbody></table>`:'<div style="font-size:12px;color:var(--fd-ink-soft)">Need bookings with booking-date + travel-date</div>');
}
// ── TAB: Ops & Guides (theme 4) ──
function mdTabOps(days){
  const latest=days[days.length-1]; const arrByCode={}; Object.entries(latest.in||{}).forEach(([n,v])=>{ const c=MD_NAT_TH2CODE[n]; if(c) arrByCode[c]=(arrByCode[c]||0)+v; });
  const lang=mdLangBuckets(arrByCode); const langRows=[{label:'🇷🇺 Russian guide',val:lang.Russian,col:'#A32D2D'},{label:'🇨🇳 Chinese guide',val:lang.Chinese,col:'#BA7517'},{label:'🇬🇧 English guide',val:lang.English,col:'#185FA5'}];
  // pickup zone demand from our bookings
  const zone={}; (SB_BOOKINGS||[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return; (b.trips||[]).forEach(t=>{ const z=t.zone||b.pickupZone||'NoTransfer'; const pax=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; zone[z]=(zone[z]||0)+pax; }); });
  const zlab=z=>({PK:'Phuket (PK)',KL:'Khao Lak (KL)',RN:'Ranong (RN)',NoTransfer:'No transfer',NT:'No transfer'})[z]||z;   /* §rnZone */
  const zoneRows=Object.entries(zone).sort((a,b)=>b[1]-a[1]).map(([z,v])=>({label:zlab(z),val:v,col:'#0F6E56'}));
  return mdNote('Guide-language demand is estimated from arrival nationalities (latest day) — Russian/Chinese get their own guide, the rest map to English. Pickup-zone demand comes from your bookings.')
    +mdCard('Guide-language demand','from arrivals · '+latest.date,mdHbars(langRows,Math.max(lang.Russian,lang.Chinese,lang.English,1)))
    +mdCard('Pickup-zone demand','our bookings',zoneRows.length?mdHbars(zoneRows,Math.max(...zoneRows.map(r=>r.val),1)):'<div style="font-size:12px;color:var(--fd-ink-soft)">No bookings yet</div>');
}
// ── TAB: Sales & Agents (theme 5) ──
function mdTabSales(days){
  const SALES=(typeof SB_SALES!=='undefined')?SB_SALES:[];
  const AG=(typeof SB_AGENTS!=='undefined')?SB_AGENTS:[];
  const BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[];
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const isCancel=b=>b.status==='cancelled'||b.status==='cancelled_weather';
  const paxOf=b=>(b.trips||[]).reduce((s,t)=>s+((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0),0);
  const valOf=b=>(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0);
  const ownerOf=b=>{ if(b.soldBy) return b.soldBy; const a=sbGetAgent(b.agentId); return a?(a.sales||''):''; };
  const invOf=b=>(typeof acctBookingInvoice==='function')?acctBookingInvoice(b.id):null;
  const bkDate=b=> b.bookingDate || ((b.trips||[]).map(t=>t.date).filter(Boolean).sort()[0])||'';
  const fK=n=>{ n=Math.round(n||0); return n>=1e6?'฿'+(n/1e6).toFixed(2)+'M':n>=1e3?'฿'+Math.round(n/1e3)+'k':'฿'+n; };
  const pf=(n,d)=>d>0?Math.round(n/d*1000)/10:0;
  const now=new Date(); const curYM=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const pv=new Date(now.getFullYear(),now.getMonth()-1,1); const prevYM=`${pv.getFullYear()}-${String(pv.getMonth()+1).padStart(2,'0')}`;
  const ymOf=d=>{ const t=d?new Date(d):null; return t&&!isNaN(t)?`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`:''; };
  const recentCut=new Date(now.getTime()-30*864e5);
  const recentAg=new Set(); BK.forEach(b=>{ if(b.status==='rejected'||isCancel(b))return; const d=bkDate(b); if(d&&new Date(d)>=recentCut) recentAg.add(b.agentId); });
  // per-sales
  const P={}; SALES.forEach(s=>P[s.id]={s,val:0,pax:0,bk:0,tot:0,cancel:0,noShow:0,paid:0,ar:0,cur:0,prev:0});
  let tVal=0,tPax=0,tBk=0,tTot=0,tCancel=0,tNoShow=0,tPaid=0,tAr=0;
  BK.forEach(b=>{ if(b.status==='rejected')return; const sid=ownerOf(b); const p=P[sid]; tTot++; if(p)p.tot++;
    if(isCancel(b)){ tCancel++; if(p)p.cancel++; if(b.cancelCategory==='no_show'){tNoShow++; if(p)p.noShow++;} return; }
    const v=valOf(b), px=paxOf(b); tVal+=v; tPax+=px; tBk++;
    if(p){ p.val+=v; p.pax+=px; p.bk++; const ym=ymOf(bkDate(b)); if(ym===curYM)p.cur+=v; else if(ym===prevYM)p.prev+=v; }
    const iv=invOf(b); if(iv){ const paid=Math.max(0,acctInvoicePaid(iv)), bal=acctInvoiceBalance(iv); tPaid+=paid; tAr+=bal; if(p){p.paid+=paid; p.ar+=bal;} } });
  const tActive=AG.filter(a=>recentAg.has(a.id)).length, tAgents=AG.length;
  const tColl=pf(tPaid,tPaid+tAr), tCancelR=pf(tCancel,tTot), tNoShowR=pf(tNoShow,tTot);
  const tCur=Object.values(P).reduce((s,p)=>s+p.cur,0), tPrev=Object.values(P).reduce((s,p)=>s+p.prev,0);
  const tMoM=tPrev>0?Math.round((tCur-tPrev)/tPrev*100):(tCur>0?100:0);
  if(!BK.length){ return mdNote('No bookings yet — Sales KPIs populate from confirmed bookings (agent → owner via agent.sales).'); }
  // ── north-star ──
  const kpi=(lab,val,sub,col)=>`<div style="background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:12px;padding:12px 13px"><div style="font-size:11px;color:var(--fd-ink-soft)">${lab}</div><div style="font-size:21px;font-weight:700;margin-top:3px;color:${col||'#1B2A55'};font-family:'DM Mono',monospace">${val}</div><div style="font-size:10.5px;color:var(--fd-ink-soft);margin-top:1px">${sub}</div></div>`;
  const north=`<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">
    ${kpi('Sales value',fK(tVal),(tMoM>=0?'▲ ':'▼ ')+Math.abs(tMoM)+'% vs last mo','#185FA5')}
    ${kpi('Pax sold',tPax.toLocaleString(),tBk+' bookings')}
    ${kpi('Collected',(tColl||0)+'%','AR '+fK(tAr),'#0F6E56')}
    ${kpi('Cancel rate',tCancelR+'%','no-show '+tNoShowR+'%','#A32D2D')}
    ${kpi('Active agents',tActive+'<span style="font-size:12px;color:var(--fd-ink-soft)">/'+tAgents+'</span>',(tAgents-tActive)+' dormant')}
  </div>`;
  // ── leaderboard ──
  const sName=s=>esc((s.name||'').replace(/^Khun\s+/,''));
  const sRows=Object.values(P).filter(p=>p.tot>0).sort((a,b)=>b.val-a.val).map(p=>{
    const coll=pf(p.paid,p.paid+p.ar), cr=pf(p.cancel,p.tot), mom=p.prev>0?Math.round((p.cur-p.prev)/p.prev*100):(p.cur>0?100:0);
    const act=AG.filter(a=>a.sales===p.s.id), actN=act.filter(a=>recentAg.has(a.id)).length;
    return `<tr style="border-top:0.5px solid rgba(0,0,0,.06)">
      <td style="text-align:left;padding:7px 0;font-size:12px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.s.color||'#888'};margin-right:6px;vertical-align:middle"></span>${sName(p.s)} <span style="font-size:9px;color:var(--fd-ink-soft)">${esc((p.s.designation||'').replace('Sales ','').replace('Executive','Exec'))}</span></td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${fK(p.val)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${p.pax}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${p.bk}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:${coll<75?'#A32D2D':'#0F6E56'}">${coll}%</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${fK(p.ar)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:${cr>7?'#A32D2D':'inherit'}">${cr}%</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${actN}/${act.length}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:${mom>=0?'#0F6E56':'#A32D2D'}">${mom>=0?'+':''}${mom}%</td></tr>`;
  }).join('');
  const th='font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--fd-ink-soft);text-align:right;padding:0 0 6px;font-weight:600';
  const lbCard=`<div class="md-card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">Team leaderboard</div>
    <table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th};text-align:left">Salesperson</th><th style="${th}">Sales</th><th style="${th}">Pax</th><th style="${th}">Bk</th><th style="${th}">Coll</th><th style="${th}">AR</th><th style="${th}">Cancel</th><th style="${th}">Active</th><th style="${th}">MoM</th></tr></thead><tbody>${sRows}</tbody></table></div>`;
  // ── top agents ──
  const famShort=id=>({similan:'Similan',surin:'Surin',phiphi:'Phi Phi',krabi:'Krabi',whaleshark:'Whale Shark'}[id]||id);
  const FAM_ORDER=['similan','surin','phiphi','krabi','whaleshark']; const famHdr={similan:'Similan',surin:'Surin',phiphi:'Phi Phi',krabi:'Krabi',whaleshark:'Whale'}; const famCol={similan:'#185fa5',surin:'#3B6D11',phiphi:'#c0392b',krabi:'#0F6E56',whaleshark:'#BA7517'};
  const A={}; BK.forEach(b=>{ if(b.status==='rejected')return; const a=sbGetAgent(b.agentId); if(!a)return; const o=(A[a.id]=A[a.id]||{a,val:0,pax:0,cancel:0,tot:0,paid:0,ar:0,fam:{}}); o.tot++; if(isCancel(b)){o.cancel++;return;} o.val+=valOf(b); o.pax+=paxOf(b); (b.trips||[]).forEach(t=>{ const f=bkV2RouteFamily(t.routeId); if(f){ o.fam[f.id]=o.fam[f.id]||{id:f.id,color:f.color,pax:0}; o.fam[f.id].pax+=bkV2PaxAllTot(t.pax||{}); } }); const iv=invOf(b); if(iv){o.paid+=Math.max(0,acctInvoicePaid(iv)); o.ar+=acctInvoiceBalance(iv);} });
  const topA=Object.values(A).sort((x,y)=>y.val-x.val).slice(0,8);
  const aRows=topA.map(o=>{ const own=SALES.find(s=>s.id===o.a.sales); const coll=pf(o.paid,o.paid+o.ar), cr=pf(o.cancel,o.tot);
    const fams=Object.values(o.fam||{}).sort((x,y)=>y.pax-x.pax); const tf=fams[0];
    const famCells=FAM_ORDER.map(fid=>{ const v=(o.fam[fid]&&o.fam[fid].pax)||0; const isTop=tf&&tf.id===fid&&v>0; return `<td style="text-align:right;font-family:'DM Mono',monospace;${isTop?'font-weight:700;color:'+famCol[fid]:('color:'+(v?'#27384a':'#cdcdc7'))}">${v||'·'}</td>`; }).join('');
    return `<tr style="border-top:0.5px solid rgba(0,0,0,.06)">
      <td style="text-align:left;padding:7px 0;font-size:12px">${esc(o.a.name||o.a.code||o.a.id)}</td>
      <td style="text-align:left;font-size:11px">${own?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${own.color||'#888'};margin-right:5px"></span>${sName(own)}`:'<span style="color:var(--fd-ink-soft)">—</span>'}</td>
      <td style="text-align:left"><span style="font-size:9px;background:#eef0f3;color:#444;padding:1px 6px;border-radius:7px">${esc((o.a.market||'—').toUpperCase())}</span></td>
      ${famCells}
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${o.pax}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${fK(o.val)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:${coll<75?'#A32D2D':'#0F6E56'}">${coll}%</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:${cr>7?'#A32D2D':'inherit'}">${cr}%</td></tr>`;
  }).join('');
  const taCard=`<div class="md-card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">Top agents <span style="font-weight:400;color:var(--fd-ink-soft)">· by sales value</span></div>
    <table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th};text-align:left">Agent</th><th style="${th};text-align:left">Owner</th><th style="${th};text-align:left">Market</th>${FAM_ORDER.map(fid=>`<th style="${th}">${famHdr[fid]}</th>`).join('')}<th style="${th}">Pax</th><th style="${th}">Sales</th><th style="${th}">Coll</th><th style="${th}">Cancel</th></tr></thead><tbody>${aRows}</tbody></table></div>`;
  // ── sales by person bars ──
  const barRows=Object.values(P).filter(p=>p.val>0).sort((a,b)=>b.val-a.val);
  const maxV=Math.max(...barRows.map(p=>p.val),1);
  const bars=`<div class="md-card"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Sales value by person</div>${barRows.map(p=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span>${sName(p.s)}</span><span style="font-family:'DM Mono',monospace">${fK(p.val)}</span></div><div style="height:8px;border-radius:4px;background:#eef0f3"><div style="width:${Math.round(p.val/maxV*100)}%;height:100%;border-radius:4px;background:${p.s.color||'#185FA5'}"></div></div></div>`).join('')||'<div style="font-size:11px;color:var(--fd-ink-soft)">No sales yet</div>'}</div>`;
  // ── Groups 7-9: discounts/FOC · product mix · market effectiveness ──
  const chOf=b=>{ const a=sbGetAgent(b.agentId); if(!a) return 'B2C / Walk-in'; const pt=(a.payType||'').toLowerCase(); return pt==='proforma'?'Pro Forma':pt==='cot'?'Cash on tour':pt==='invoice'?'Invoice (credit)':'Other'; };
  const labelPier=k=> k==='tublamu'?'Tub Lamu':k==='panwa'?'Visit Panwa':(k||'—');
  const bar=(label,val,max,col,fmt)=>`<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:2px"><span>${esc(label)}</span><span style="font-family:'DM Mono',monospace">${fmt(val)}</span></div><div style="height:7px;border-radius:4px;background:#eef0f3"><div style="width:${Math.round(val/Math.max(1,max)*100)}%;height:100%;border-radius:4px;background:${col}"></div></div></div>`;
  let gGross=0,gDisc=0,gExtra=0,gFoc=0,gPaxAll=0,withAddon=0,activeBk=0;
  const fam={},pier={},chan={},mkt={};
  BK.forEach(b=>{ if(b.status==='rejected'||isCancel(b))return; activeBk++;
    const pb=b.priceBreakdown||null; const disc=pb?(pb.discount||0):0, extra=pb?(pb.extra||0):0; const net=valOf(b);
    gDisc+=disc; gExtra+=extra; gGross+=net+disc-extra;
    (b.trips||[]).forEach(t=>{ const px=bkV2PaxAllTot(t.pax||{}); gPaxAll+=px; gFoc+=bkV2PaxTot(t.pax,'foc');
      const f=bkV2RouteFamily(t.routeId); if(f){ fam[f.id]=fam[f.id]||{name:f.name,color:f.color,pax:0}; fam[f.id].pax+=px; }
      const r=(typeof getRoute==='function')?getRoute(t.routeId):null; const pk=r?r.pier:'?'; pier[pk]=(pier[pk]||0)+px; });
    chan[chOf(b)]=(chan[chOf(b)]||0)+net;
    const a=sbGetAgent(b.agentId); const mk=a?(a.market||'unassigned'):'b2c'; mkt[mk]=(mkt[mk]||0)+paxOf(b);
    if(b.addOns && Object.keys(b.addOns).length) withAddon++; });
  // 7 · discounts & FOC
  const stat=(lab,val,col)=>`<div><div style="font-size:10.5px;color:var(--fd-ink-soft)">${lab}</div><div style="font-size:17px;font-weight:700;font-family:'DM Mono',monospace;color:${col||'#1B2A55'}">${val}</div></div>`;
  const disc7=`<div class="md-card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Discounts &amp; FOC</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${stat('Gross sales',fK(gGross))}${stat('Discount given',fK(gDisc)+' ('+pf(gDisc,gGross)+'%)','#A32D2D')}${stat('Extra charges',fK(gExtra),'#0F6E56')}${stat('FOC pax',gFoc+' ('+pf(gFoc,gPaxAll)+'%)')}</div></div>`;
  // 7b · FOC detail — grouped by AGENT (header row) · rows = travel date · columns = program family (Top-agents style) · Pax/Sales EXCLUDE FOC
  const focChip=st=> st==='approved'?'<span style="font-size:8px;font-weight:700;color:#0F6E56;background:#E1F5EE;border-radius:4px;padding:1px 5px;margin-left:5px;vertical-align:1px">approved</span>':(st==='pending'?'<span style="font-size:8px;font-weight:700;color:#854F0B;background:#FAEEDA;border-radius:4px;padding:1px 5px;margin-left:5px;vertical-align:1px">pending</span>':'');
  const focAg={};
  BK.forEach(b=>{ if(b.status==='rejected'||isCancel(b))return;
    const a=sbGetAgent(b.agentId); const sid=ownerOf(b); const sp=SALES.find(s=>s.id===sid);
    const reason=((b.focApproval&&b.focApproval.reason)||b.focReason||'').trim();
    const st=(b.focApproval&&b.focApproval.status)||(b.status==='pending_foc'||b.status==='pending'?'pending':'');
    const key=b.agentId||('b2c:'+(b.b2cChannel||'walk-in'));
    (b.trips||[]).forEach(t=>{ const f=bkV2PaxTot(t.pax,'foc'); if(f<=0)return;
      const date=t.date||''; const fam=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(t.routeId):null; const fid=fam?fam.id:'other';
      const g=focAg[key]=focAg[key]||{ agentId:b.agentId, agentName:a?(a.name||a.code||a.id):(b.b2cChannel||'B2C / Walk-in'), fc:0, bks:{}, sps:{}, byDate:{} };
      g.fc+=f; g.bks[b.id]=1; if(sp) g.sps[sp.id]=sp;
      const D=g.byDate[date]=g.byDate[date]||{date, total:0, fam:{}, reasons:{}, anyPending:false, allApproved:true};
      D.total+=f; D.fam[fid]=(D.fam[fid]||0)+f;
      if(reason) D.reasons[reason]=(D.reasons[reason]||0)+1;
      if(st==='pending') D.anyPending=true;
      if(st!=='approved') D.allApproved=false;
    });
  });
  const focRecs=Object.values(focAg).sort((x,y)=>y.fc-x.fc);
  const fmtFocD=ds=>{ if(!ds) return '—'; const dt=new Date(ds+'T00:00:00'); if(isNaN(dt)) return ds; return dt.getDate()+'/'+(dt.getMonth()+1); };
  const famHdrs=FAM_ORDER.map(fid=>`<th style="${th};text-align:center;white-space:nowrap">${famHdr[fid]||fid}</th>`).join('');
  const renderRec=(r,ai)=>{
    const o=A[r.agentId]; const coll=o?pf(o.paid,o.paid+o.ar):0; const a=sbGetAgent(r.agentId); const mkt=a?(a.market||'—'):'—';
    const paidPax=o?Math.max(0,(o.pax||0)-r.fc):0;   // paying customers · EXCLUDES FOC
    const bkN=Object.keys(r.bks).length;
    const sps=Object.values(r.sps);
    const spTxt=sps.length?sps.map(s=>`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color||'#888'};margin-right:6px;vertical-align:0"></span>${sName(s)}`).join('<br>'):'<span style="color:var(--fd-ink-soft)">—</span>';
    const anyPending=Object.values(r.byDate).some(D=>D.anyPending);
    const allApproved=Object.values(r.byDate).every(D=>D.allApproved);
    const chip=anyPending?focChip('pending'):(allApproved?focChip('approved'):'');
    const bkTag=bkN>1?` <span style="font-size:8.5px;color:#9a9a90;background:#f1f0ea;border-radius:5px;padding:1px 5px">${bkN} bk</span>`:'';
    const dates=Object.values(r.byDate).sort((x,y)=>(x.date||'').localeCompare(y.date||''));
    const nd=dates.length||1; const RS=`rowspan="${nd}"`;
    const ztint=ai%2?'#FAFAF7':'#FFFFFF';
    const TOP=`border-top:1px solid #E7E5DD;background:${ztint}`;
    const cellBg=`background:${ztint}`;
    const tdAgent=`<td ${RS} style="text-align:left;padding:10px 12px 10px 10px;font-size:12.5px;font-weight:700;color:#1B2A55;vertical-align:middle;white-space:nowrap;border-left:3px solid ${o&&o.val>0?'#185FA5':'#D9C28A'};${TOP}">${esc(r.agentName)}${chip}${bkTag}</td>`;
    const tdSale=`<td ${RS} style="text-align:left;font-size:11px;color:#444;vertical-align:middle;white-space:nowrap;${TOP}">${spTxt}</td>`;
    const tdMkt=`<td ${RS} style="text-align:left;vertical-align:middle;${TOP}"><span style="font-size:9px;font-weight:600;letter-spacing:.04em;background:#ECEEF2;color:#56627A;padding:2px 7px;border-radius:7px">${esc((mkt||'—').toUpperCase())}</span></td>`;
    const tdTot=`<td ${RS} style="text-align:center;vertical-align:middle;border-left:1px solid #ECEAE2;${TOP}"><span style="display:inline-block;min-width:24px;padding:3px 10px;border-radius:9px;background:#F6E1C6;color:#7A4A00;font-weight:800;font-family:'DM Mono',monospace;font-size:13px">${r.fc}</span></td>`;
    const tdCus=`<td ${RS} style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:#1B2A55;font-size:12.5px;vertical-align:middle;${TOP}">${o?paidPax:'—'}</td>`;
    const tdVal=`<td ${RS} style="text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:#0F6E56;vertical-align:middle;padding-right:10px;${TOP}">${o?fK(o.val):'—'}</td>`;
    return dates.map((D,i)=>{
      const bt=i===0?TOP:`border-top:0.5px solid #F0EFE8;${cellBg}`;
      const dateCell=`<td style="text-align:left;font-size:11px;font-weight:700;color:#56627A;white-space:nowrap;padding:5px 10px 5px 12px;${bt}">${fmtFocD(D.date)}</td>`;
      const famR=FAM_ORDER.map(fid=>{ const c=D.fam[fid]; const col=famCol[fid]||'#854F0B';
        const inner=c?`<span style="display:inline-block;min-width:20px;padding:2px 8px;border-radius:8px;background:${col}1A;color:${col};font-weight:700;font-family:'DM Mono',monospace;font-size:11.5px">${c}</span>`:`<span style="color:#D8D6CE">·</span>`;
        return `<td style="text-align:center;padding:4px 5px;${bt}">${inner}</td>`; }).join('');
      const rk=Object.keys(D.reasons); const reasonTxt=rk.length?rk.map(esc).join(', '):'<span style="color:#bdbcb2;font-style:italic">—</span>';
      const reasonCell=`<td style="text-align:left;font-size:11px;color:#555;max-width:240px;white-space:normal;line-height:1.4;padding:4px 10px;${bt}">${reasonTxt}</td>`;
      if(i===0) return `<tr>${tdAgent}${tdSale}${tdMkt}${dateCell}${famR}${tdTot}${reasonCell}${tdCus}${tdVal}</tr>`;
      return `<tr>${dateCell}${famR}${reasonCell}</tr>`;
    }).join('');
  };
  const isStaffRec=r=>{ const a=sbGetAgent(r.agentId); return !!(a&&(a.code==='STAFF'||a.id==='a_staff')); };
  const grpAgent=focRecs.filter(r=>!isStaffRec(r));
  const grpStaff=focRecs.filter(r=>isStaffRec(r));
  let _focAi=0;
  const focSecHdr=(label,recs)=>{ const fc=recs.reduce((s,x)=>s+x.fc,0); return `<tr><td colspan="13" style="padding:9px 12px 7px;background:#F1EFE8;border-top:2px solid #DAD5C6;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#6B6456">${esc(label)} <span style="font-weight:600;color:#9a9486;letter-spacing:.02em;text-transform:none">· ${recs.length} agent${recs.length===1?'':'s'} · ${fc} FOC</span></td></tr>`; };
  const focBody=[
    grpAgent.length?focSecHdr('Agent',grpAgent)+grpAgent.map(r=>renderRec(r,_focAi++)).join(''):'',
    grpStaff.length?focSecHdr('Staff',grpStaff)+grpStaff.map(r=>renderRec(r,_focAi++)).join(''):''
  ].join('');
  const thF=`${th};padding-bottom:9px;border-bottom:1.5px solid #E5E2D8`;
  const focDetail=focRecs.length?`<div class="md-card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#E0A23C"></span>FOC detail <span style="font-weight:400;color:var(--fd-ink-soft)">· ${focRecs.length} agent${focRecs.length===1?'':'s'} · ${gFoc} FOC pax</span></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#FAF9F5"><th style="${thF};text-align:left;padding-left:10px">Agent</th><th style="${thF};text-align:left">Sale</th><th style="${thF};text-align:left">Market</th><th style="${thF};text-align:left;padding-left:12px">Date</th>${FAM_ORDER.map(fid=>`<th style="${thF};text-align:center;white-space:nowrap">${famHdr[fid]||fid}</th>`).join('')}<th style="${thF};text-align:center;border-left:1px solid #ECEAE2">Total FOC</th><th style="${thF};text-align:left">Reason</th><th style="${thF}">Number cus</th><th style="${thF};padding-right:10px">Sale value</th></tr></thead><tbody>${focBody}</tbody></table></div>
    <div style="font-size:10px;color:var(--fd-ink-soft);margin-top:8px">คอลัมน์โปรแกรม = จำนวน FOC ต่อทริปต่อวัน · Total FOC = รวมต่อเอเจ้น · <b>Number cus / Sale value = ลูกค้าที่จ่ายเงิน (ไม่รวม FOC) และยอดขาย</b></div></div>`:'';
  // 8 · product mix
  const famB=Object.values(fam).sort((a,b)=>b.pax-a.pax), famMax=Math.max(...famB.map(f=>f.pax),1);
  const pierE=Object.entries(pier).sort((a,b)=>b[1]-a[1]), pierMax=Math.max(...pierE.map(x=>x[1]),1);
  const chanE=Object.entries(chan).sort((a,b)=>b[1]-a[1]), chanMax=Math.max(...chanE.map(x=>x[1]),1);
  const col=(t,inner)=>`<div><div style="font-size:11px;font-weight:700;margin-bottom:7px">${t}</div>${inner||'<span style="font-size:11px;color:var(--fd-ink-soft)">—</span>'}</div>`;
  const mix8=`<div class="md-card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:13px;font-weight:700">Product mix</div><div style="font-size:10.5px;color:var(--fd-ink-soft)">Add-on attach rate <b style="color:#1B2A55">${pf(withAddon,activeBk)}%</b></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">${col('By program (pax)',famB.map(f=>bar(f.name,f.pax,famMax,f.color,mdFmt)).join(''))}${col('By pier (pax)',pierE.map(([k,v])=>bar(labelPier(k),v,pierMax,'#185FA5',mdFmt)).join(''))}${col('By channel (฿)',chanE.map(([k,v])=>bar(k,v,chanMax,'#5B289A',fK)).join(''))}</div></div>`;
  // 9 · market effectiveness
  const mktE=Object.entries(mkt).sort((a,b)=>b[1]-a[1]), mktMax=Math.max(...mktE.map(x=>x[1]),1);
  const mktLabel=k=> k==='b2c'?'B2C':k==='unassigned'?'Unassigned':mdMarketName(k);
  const arrC=(typeof mdArrivalsByCode==='function')?mdArrivalsByCode():{}, ourC=(typeof mdOurMixByCode==='function')?mdOurMixByCode():{};
  const capRows=Object.entries(ourC).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,our])=>{ const arr=arrC[c]||0, cap=arr>0?our/arr*100:0; const en=(typeof MD_CODE2EN!=='undefined'&&MD_CODE2EN[c])?MD_CODE2EN[c]:c; return `<tr style="border-top:0.5px solid rgba(0,0,0,.06)"><td style="text-align:left;padding:5px 0;font-size:11.5px">${esc(en)}</td><td style="text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#0F6E56">${mdFmt(our)}</td><td style="text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:var(--fd-ink-soft)">${arr?mdFmt(arr):'—'}</td><td style="text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#A32D2D">${arr?(cap>=10?Math.round(cap):cap.toFixed(1))+'%':'—'}</td></tr>`; }).join('');
  const market9=`<div class="md-card"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Market effectiveness</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><div style="font-size:11px;font-weight:700;margin-bottom:7px">Sales pax by market</div>${mktE.map(([k,v])=>bar(mktLabel(k),v,mktMax,'#1683C7',mdFmt)).join('')||'<span style="font-size:11px;color:var(--fd-ink-soft)">—</span>'}</div><div><div style="font-size:11px;font-weight:700;margin-bottom:7px">Top nationalities · capture</div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th};text-align:left">Nat</th><th style="${th}">Ours</th><th style="${th}">Arrivals</th><th style="${th}">Capture</th></tr></thead><tbody>${capRows||'<tr><td style="font-size:11px;color:var(--fd-ink-soft);padding:6px 0">Import arrivals to compare</td></tr>'}</tbody></table></div></div></div>`;
  return mdNote('Live Sales KPIs · booking → agent → owner (agent.sales). Collected/AR from invoices · cancel from category · active = agents with a booking in the last 30 days. (Agent table + FOC detail moved to the ⑥ Agents tab.)')+north+lbCard+bars+disc7+mix8+market9;
}
function mdToggleAgZone(){ _mdAgZone=!_mdAgZone; if(typeof renderMarketData==='function') renderMarketData(); }
function mdTabAgents(days){
  const SALES=(typeof SB_SALES!=='undefined')?SB_SALES:[];
  const BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[];
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const isCancel=b=>b.status==='cancelled'||b.status==='cancelled_weather';
  const paxOf=b=>(b.trips||[]).reduce((s,t)=>s+((typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0),0);
  const valOf=b=>(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0);
  const invOf=b=>(typeof acctBookingInvoice==='function')?acctBookingInvoice(b.id):null;
  const fK=n=>{ n=Math.round(n||0); return n>=1e6?'฿'+(n/1e6).toFixed(2)+'M':n>=1e3?'฿'+Math.round(n/1e3)+'k':'฿'+n; };
  const pf=(n,d)=>d>0?Math.round(n/d*1000)/10:0;
  const sName=s=>esc((s.name||'').replace(/^Khun\s+/,''));
  if(!BK.length) return mdNote('No bookings yet — agent stats populate from bookings.');
  const FAM_ORDER=['similan','surin','phiphi','krabi','whaleshark']; const famHdr={similan:'Similan',surin:'Surin',phiphi:'Phi Phi',krabi:'Krabi',whaleshark:'Whale'}; const famCol={similan:'#185fa5',surin:'#3B6D11',phiphi:'#c0392b',krabi:'#0F6E56',whaleshark:'#BA7517'};
  const A={};
  BK.forEach(b=>{ if(b.status==='rejected')return; const a=sbGetAgent(b.agentId); if(!a)return; const o=(A[a.id]=A[a.id]||{a,val:0,pax:0,cancel:0,tot:0,paid:0,ar:0,fam:{},area:{}}); o.tot++; if(isCancel(b)){o.cancel++;return;} o.val+=valOf(b); o.pax+=paxOf(b);
    const aid=b.pickupAreaId||'';   // configured pickup area (Phuket Town, Patong, …) · booking-level
    (b.trips||[]).forEach(t=>{ const px=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; const f=bkV2RouteFamily(t.routeId); if(f) o.fam[f.id]=(o.fam[f.id]||0)+px; const k=aid||('_z'+String(t.zone||b.pickupZone||'NT').toUpperCase()); o.area[k]=(o.area[k]||0)+px; });
    const iv=invOf(b); if(iv){o.paid+=Math.max(0,acctInvoicePaid(iv)); o.ar+=acctInvoiceBalance(iv);} });
  const zClr=z=>z==='PK'?['#E6F1FB','#185FA5']:z==='KL'?['#EAF3DE','#3B6D11']:['#F1EFE8','#5F5E5A'];
  /* §rnZone */
  const areaInfo=k=>{ if(k && k.slice(0,2)==='_z'){ const z=k.slice(2); return {nm:(z==='PK'?'Phuket (no area)':z==='KL'?'Khao Lak (no area)':z==='RN'?'Ranong (no area)':z==='NT'||z==='NOTRANSFER'?'No transfer':z),z:(z==='PK'||z==='KL'||z==='RN')?z:'NT'}; } const ar=(typeof bkV2GetArea==='function')?bkV2GetArea(k):null; return {nm:ar?ar.name:(k||'—'), z:ar?ar.zone:'NT'}; };
  const list=Object.values(A).sort((x,y)=>y.val-x.val);
  if(!list.length) return mdNote('No agent bookings yet.');
  const th='font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--fd-ink-soft);text-align:right;padding:0 0 6px;font-weight:600';
  const zoneOn=_mdAgZone;
  // ── Area matrix columns (one column per pickup area · ordered by total pax · top N + Other) ──
  const areaTot={}; list.forEach(o=>Object.keys(o.area).forEach(k=>areaTot[k]=(areaTot[k]||0)+o.area[k]));
  const areaColsAll=Object.keys(areaTot).sort((a,b)=>areaTot[b]-areaTot[a]);
  const TOPN=16; const acShown=areaColsAll.slice(0,TOPN); const acOther=areaColsAll.slice(TOPN); const hasOther=acOther.length>0;
  const shortNm=n=>{ n=String(n).replace(/\s*\(self-?arrive\)/i,'').replace(/^Visit\s+/i,'').trim(); return n.length>11?n.slice(0,10)+'…':n; };
  const _faint='font-weight:400;color:#b7b7af;font-size:8.5px;font-family:\'DM Mono\',monospace;margin-top:1px';
  const _otherTot=acOther.reduce((s,k)=>s+(areaTot[k]||0),0);
  const areaHdr = zoneOn ? (acShown.map((k,i)=>{ const ai=areaInfo(k); const cc=zClr(ai.z); return `<th style="${th};text-align:right;${i===0?'border-left:1px solid #ECEAE2;padding-left:6px;':''}color:${cc[1]};white-space:nowrap" title="${esc(ai.nm)} · รวม ${areaTot[k]} pax">${esc(shortNm(ai.nm))}<div style="${_faint}">${areaTot[k]||0}</div></th>`; }).join('')+(hasOther?`<th style="${th}" title="${acOther.length} more areas · รวม ${_otherTot} pax">Other<div style="${_faint}">${_otherTot}</div></th>`:'')) : '';
  const rows=list.map(o=>{ const own=SALES.find(s=>s.id===o.a.sales); const coll=pf(o.paid,o.paid+o.ar), cr=pf(o.cancel,o.tot);
    const fams=FAM_ORDER.map(fid=>o.fam[fid]||0); const topPax=Math.max.apply(null,fams.concat([0]));
    const famCells=FAM_ORDER.map((fid,i)=>{ const v=fams[i]; const isTop=v>0&&v===topPax; return `<td style="text-align:right;font-family:'DM Mono',monospace;${isTop?'font-weight:700;color:'+famCol[fid]:('color:'+(v?'#27384a':'#cdcdc7'))}">${v||'·'}</td>`; }).join('');
    const areaCells = zoneOn ? (acShown.map((k,i)=>{ const v=o.area[k]||0; const ai=areaInfo(k); const cc=zClr(ai.z); return `<td style="text-align:right;font-family:'DM Mono',monospace;${i===0?'border-left:1px solid #ECEAE2;padding-left:6px;':''}color:${v?cc[1]:'#dcdcd5'};font-weight:${v?600:400}">${v||'·'}</td>`; }).join('')+(hasOther?`<td style="text-align:right;font-family:'DM Mono',monospace;color:#5F5E5A">${(acOther.reduce((s,k)=>s+(o.area[k]||0),0))||'·'}</td>`:'')) : '';
    return `<tr style="border-top:0.5px solid rgba(0,0,0,.06)">
      <td style="text-align:left;padding:7px 0;font-size:12px">${esc(o.a.name||o.a.code||o.a.id)}</td>
      <td style="text-align:left;font-size:11px">${own?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${own.color||'#888'};margin-right:5px"></span>${sName(own)}`:'<span style="color:var(--fd-ink-soft)">—</span>'}</td>
      <td style="text-align:left"><span style="font-size:9px;background:#eef0f3;color:#444;padding:1px 6px;border-radius:7px">${esc((o.a.market||'—').toUpperCase())}</span></td>
      ${zoneOn?areaCells:famCells}
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${o.pax}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${fK(o.val)}</td>
      ${zoneOn?'':`<td style="text-align:right;font-family:'DM Mono',monospace;color:${coll<75?'#A32D2D':'#0F6E56'}">${coll}%</td><td style="text-align:right;font-family:'DM Mono',monospace;color:${cr>7?'#A32D2D':'inherit'}">${cr}%</td>`}</tr>`;
  }).join('');
  const totPax=list.reduce((s,o)=>s+o.pax,0);
  return `<div class="md-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div style="font-size:14px;font-weight:700">All agents <span style="font-weight:400;color:var(--fd-ink-soft)">· ${list.length} agents · ${totPax} pax · sorted by sales value</span></div>
      <button onclick="mdToggleAgZone()" style="font-size:11px;font-weight:600;border:1px solid ${zoneOn?'#185FA5':'rgba(0,0,0,.15)'};background:${zoneOn?'#E6F1FB':'#fff'};color:${zoneOn?'#185FA5':'#5F5E5A'};border-radius:8px;padding:5px 12px;cursor:pointer;font-family:inherit">${zoneOn?'▾ Pickup areas · ซ่อน (โชว์โปรแกรม)':'▸ Pickup areas · แสดง (เทียบราย area)'}</button>
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>
      <th style="${th};text-align:left">Agent</th><th style="${th};text-align:left">Owner</th><th style="${th};text-align:left">Market</th>
      ${zoneOn?areaHdr:FAM_ORDER.map(fid=>`<th style="${th}">${famHdr[fid]}</th>`).join('')}
      <th style="${th}">Pax</th><th style="${th}">Sales</th>${zoneOn?'':`<th style="${th}">Coll</th><th style="${th}">Cancel</th>`}
    </tr></thead><tbody>${rows}</tbody></table></div>
    ${zoneOn?`<div style="font-size:10px;color:var(--fd-ink-soft);margin-top:8px">คอลัมน์ = area จุดรับ (เรียงตาม pax รวมมาก→น้อย · top ${TOPN}${hasOther?' + Other':''}) · ตัวเลข = pax · สีตามโซน <b style="color:#185FA5">ฟ้า PK</b> ภูเก็ต · <b style="color:#3B6D11">เขียว KL</b> เขาหลัก · เทา = ไม่รับส่ง/ไม่ระบุ · เลื่อนแนวนอนดูครบ · (ปิดโหมดนี้เพื่อดูคอลัมน์โปรแกรม + Coll/Cancel)</div>`:''}
  </div>`;
}
// คีย์ agent ของ booking · ต้องคิดแบบเดียวกับในการ์ด Agent × โซน ไม่งั้นกรองแล้วไม่ตรง
function pmAgKeyOf(b){ return (b&&b.agentId) || ((b&&(b.b2cChannel||b.channelType==='b2c'))?'_b2c':('_'+((b&&b.channel)||'walkin'))); }
function pmAgSkip(b){ return !!(_pmapAgFilter && pmAgKeyOf(b)!==_pmapAgFilter); }
function pmapSetAg(k){ _pmapAgFilter=(_pmapAgFilter===k)?null:(k||null); _pmapSel=null; pmapRefresh(); }
function pmapAgName(){
  if(!_pmapAgFilter) return '';
  const ag=(typeof sbGetAgent==='function')?sbGetAgent(_pmapAgFilter):null;
  if(ag) return ag.name||ag.code||_pmapAgFilter;
  if(_pmapAgFilter==='_b2c') return 'เว็บไซต์ (B2C)';
  return (typeof pmChannelName==='function')?pmChannelName(String(_pmapAgFilter).replace(/^_/,'')):String(_pmapAgFilter);
}
function pmInLand(x,y){ const r=_PMRING; let inside=false; for(let i=0,j=r.length-1;i<r.length;j=i++){ const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1]; if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi)) inside=!inside; } return inside; }
function _pmYmd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _pmPrevAnchor(){ const d=new Date(_pmapAnchor+'T00:00'); if(_pmapMode==='year')d.setFullYear(d.getFullYear()-1); else if(_pmapMode==='week')d.setDate(d.getDate()-7); else d.setMonth(d.getMonth()-1); return _pmYmd(d); }
function pmFmtB(n){ n=Math.round(n||0); return n>=1e6?'฿'+(n/1e6).toFixed(2)+'M':n>=1e3?'฿'+Math.round(n/1e3)+'k':'฿'+n; }
function pmVal(o){ return _pmapMetric==='value'?(o&&o.val||0):(o&&o.pax||0); }
function pmCount(o){ return _pmapMetric==='value'?Math.max(0,Math.round((o&&o.val||0)/(_PM.unit||1))):(o&&o.pax||0); }
function pmShowNum(v){ return _pmapMetric==='value'?pmFmtB(v):String(v); }
function pmapSetMetric(m){ if(_pmapMetric===m)return; _pmapMetric=m; pmapRefresh(); }
function pmapArrivals(per){ let a=0,has=false; Object.values(SB_MARKET_STATS||{}).forEach(d=>{ if(per.test(d.date||'')){ const t=(typeof mdDirTot==='function')?mdDirTot(d,'in'):0; if(t){a+=t;has=true;} } }); return has?a:null; }
function pmapMoM(key){ const c=_PM.areas.find(x=>x.key===key); if(!c)return null; const cv=pmVal(c); const p=_PM.prev[key]; if(!p)return null; const pv=_pmapMetric==='value'?p.val:p.pax; if(!pv)return null; return Math.round((cv/pv-1)*100); }
function pmapAreaDetail(key){ const BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[]; const per=pmapPeriod(); const H={},A={}; let bk=0;
  BK.forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; if(pmAgSkip(b))return; const ar=b.pickupAreaId&&typeof bkV2GetArea==='function'?bkV2GetArea(b.pickupAreaId):null; const rk=ar?pmNormArea(ar.name):''; if(rk!==key)return; if(_pmapMkFilter&&pmMarket(b)!==_pmapMkFilter)return; let cp=0;(b.trips||[]).forEach(t=>{if(per.test(t.date||''))cp+=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0;}); if(cp<=0)return; bk++; const val=(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0); const w=_pmapMetric==='value'?val:cp; const hn=(b.hotelName||b.pickup||'—'); H[hn]=(H[hn]||0)+w; const ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null; const an=ag?ag.name:((b.b2cChannel||b.channelType==='b2c')?'B2C':'—'); A[an]=(A[an]||0)+w; });
  const srt=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,5); return {hotels:srt(H),agents:srt(A),bk}; }
function pmapPeriod(anchor){ const a=anchor||_pmapAnchor, d=new Date(a+'T00:00');
  if(_pmapMode==='year'){ const y=a.slice(0,4); return {test:s=>s.slice(0,4)===y, label:'ปี '+(+y+543)}; }
  if(_pmapMode==='week'){ const wd=(d.getDay()+6)%7, st=new Date(d); st.setDate(d.getDate()-wd); const en=new Date(st); en.setDate(st.getDate()+6); const sS=_pmYmd(st),eS=_pmYmd(en); return {test:s=>s>=sS&&s<=eS, label:st.getDate()+' '+_PMTH[st.getMonth()]+' – '+en.getDate()+' '+_PMTH[en.getMonth()]}; }
  return {test:s=>s.slice(0,7)===a.slice(0,7), label:_PMTH[d.getMonth()]+' '+(d.getFullYear()+543)}; }
function pmapShift(n){ const d=new Date(_pmapAnchor+'T00:00'); if(_pmapMode==='year')d.setFullYear(d.getFullYear()+n); else if(_pmapMode==='week')d.setDate(d.getDate()+7*n); else d.setMonth(d.getMonth()+n); _pmapAnchor=_pmYmd(d); _pmapSel=null; pmapRefresh(); }
function pmapSetMode(m){ if(_pmapMode===m)return; _pmapMode=m; _pmapSel=null; pmapRefresh(); }
function pmapSetMk(mk){ _pmapMkFilter=(_pmapMkFilter===mk?null:mk); pmapRefresh(); }
function pmapSelect(k){ _pmapSel=(k&&_pmapSel===k)?null:k; const p=document.getElementById('pmap-panel'); if(p)p.innerHTML=pmapPanel(); pmapDraw(); }
function pmMarket(b){ return (b.marketSnapshot&&b.marketSnapshot.market)||((typeof sbGetAgent==='function'&&sbGetAgent(b.agentId))?sbGetAgent(b.agentId).market:null)||((b.b2cChannel||b.channelType==='b2c')?'b2c':'unassigned'); }
function pmMktColor(mk){ const m=(typeof sbGetMarket==='function')?sbGetMarket(mk):null; if(m&&m.color)return m.color; return ({b2c:'#1683C7',unassigned:'#B6B4AB',walkin:'#8A8880'})[mk]||'#7F77DD'; }
function pmMktName(mk){ const m=(typeof sbGetMarket==='function')?sbGetMarket(mk):null; if(m&&m.name)return m.name; return ({b2c:'B2C',unassigned:'ไม่ระบุ',walkin:'Walk-in'})[mk]||String(mk||'—').toUpperCase(); }
function pmVivid(hex){ if(!hex||hex[0]!=='#'||hex.length<7) return hex||'#7F77DD'; let r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0,l=(mx+mn)/2; if(mx!==mn){ const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn); h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4; h/=6; } if(s<0.08) return hex; s=Math.min(1,s*1.55+0.12); if(l>0.68)l=0.58; else if(l<0.34)l=0.43; const hue=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; }; const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q; r=hue(p,q,h+1/3); g=hue(p,q,h); b=hue(p,q,h-1/3); const hx=v=>('0'+Math.round(Math.min(1,Math.max(0,v))*255).toString(16)).slice(-2); return '#'+hx(r)+hx(g)+hx(b); }
function pmNormArea(nm){ return String(nm||'').replace(/\(self-?arrive\)/i,'').replace(/\(beach\)/i,'').replace(/^Visit\s+/i,'').trim(); }
function pmapAgg(){ const BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[]; const per=pmapPeriod(), prevPer=pmapPeriod(_pmPrevAnchor());
  const agg={},mkTot={}; const tot={pax:0,val:0}, other={pax:0,val:0}; const otherAreas={}; const prev={};
  const bump=(o,mk,pax,val)=>{ o.pax+=pax;o.val+=val; const m=o.mk[mk]=o.mk[mk]||{pax:0,val:0}; m.pax+=pax;m.val+=val; };
  BK.forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return; if(pmAgSkip(b))return; const mk=pmMarket(b); const ar=b.pickupAreaId&&typeof bkV2GetArea==='function'?bkV2GetArea(b.pickupAreaId):null; const nm=ar?ar.name:''; const rk=nm?pmNormArea(nm):''; const key=(rk&&PHUKET_LL[rk])?rk:''; const val=(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0);
    let cp=0,pp=0; (b.trips||[]).forEach(t=>{ const px=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; if(per.test(t.date||''))cp+=px; if(prevPer.test(t.date||''))pp+=px; });
    if(cp>0){ mkTot[mk]=mkTot[mk]||{pax:0,val:0}; mkTot[mk].pax+=cp; mkTot[mk].val+=val; tot.pax+=cp; tot.val+=val;
      if(key){ const e=agg[key]=agg[key]||{key,pax:0,val:0,mk:{}}; bump(e,mk,cp,val); } else { other.pax+=cp; other.val+=val; otherAreas[nm||'ไม่ระบุ']=(otherAreas[nm||'ไม่ระบุ']||0)+cp; } }
    if(pp>0 && key){ const pe=prev[key]=prev[key]||{pax:0,val:0}; pe.pax+=pp; pe.val+=val; } });
  _PM.areas=Object.values(agg); _PM.mkTot=mkTot; _PM.tot=tot; _PM.other=other; _PM.otherAreas=otherAreas; _PM.prev=prev; _PM.unit=tot.pax>0?(tot.val/tot.pax):1; _PM.arr=pmapArrivals(per); }
function pmapBuildDots(){ const D2R=Math.PI/180; _PM.areas.forEach(a=>{ const useMk=_pmapMkFilter?(a.mk[_pmapMkFilter]?{[_pmapMkFilter]:a.mk[_pmapMkFilter]}:{}):a.mk; const counts={}; let n=0; Object.keys(useMk).forEach(mk=>{ const c=pmCount(useMk[mk]); if(c>0){counts[mk]=c; n+=c;} }); a.shown=n;
  const base=PHUKET_LL[a.key]; const nn=Math.max(1,n); const geoR=0.00072*Math.max(2,Math.sqrt(nn)); a.geoR=geoR; a.r=Math.max(10,Math.sqrt(nn)*2.2);
  // pull the scatter centre a touch toward the island centroid so coastal areas spread INLAND, not into the sea
  let dlat=_PMCEN[1]-base[0], dlng=_PMCEN[0]-base[1]; const dl=Math.hypot(dlat,dlng)||1; const nd=Math.min(0.0026,dl*0.14); const cLat=base[0]+dlat/dl*nd, cLng=base[1]+dlng/dl*nd;
  const arr=[]; Object.keys(counts).forEach(mk=>{for(let i=0;i<counts[mk];i++)arr.push(mk);});
  let seed=0; for(let i=0;i<a.key.length;i++) seed=(seed*31+a.key.charCodeAt(i))&0x7fffffff; seed=seed||1; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=arr[i];arr[i]=arr[j];arr[j]=t;}
  // organic scatter WITHIN the area (uniform-density disc · random) · clipped to LAND for masked areas; capes the coarse outline misses (e.g. Panwa) → free · contained (no straying)
  const masked=pmInLand(cLng,cLat); const cosL=Math.cos(cLat*D2R);
  a.dots=arr.map(mk=>{ let la=cLat,lo=cLng; const tries=masked?22:1; for(let k=0;k<tries;k++){ const rr=geoR*Math.sqrt(rnd()), ang=rnd()*6.2832; const cla=cLat+rr*Math.cos(ang), clo=cLng+rr*Math.sin(ang)/cosL; if(!masked||pmInLand(clo,cla)){ la=cla; lo=clo; break; } if(k===tries-1){ la=cla; lo=clo; } } return {lat:la,lng:lo,c:pmVivid(pmMktColor(mk))}; }); }); }
// จุดรับ (ชื่อที่ normalize แล้ว) → โซน · สร้างครั้งเดียวจาก SB_PICKUP_AREAS
function pmZoneOfArea(key){
  if(!_PM.zoa){ const m={};
    (typeof SB_PICKUP_AREAS!=='undefined'?SB_PICKUP_AREAS:[]).forEach(a=>{ const k=pmNormArea(a.name); if(k&&m[k]==null) m[k]=a.region||''; });
    // ชื่อบนแผนที่บางอันไม่ตรงกับในตารางจุดรับเป๊ะ ๆ
    if(m['Nai Harn']==null) m['Nai Harn']=m['Naiharn']||'phuket-south';
    if(m['Naiharn']==null)  m['Naiharn']='phuket-south';
    if(m['Panwa Pier']==null) m['Panwa Pier']='pier';
    if(m['Kathu']==null) m['Kathu']='phuket-central';
    _PM.zoa=m; }
  return _PM.zoa[key]||'';
}
function pmapZoneBgOn(){ if(_pmapZoneBg==null){ let v=null; try{ v=(typeof ctRead==='function')?ctRead('pmap_zonebg'):null; }catch(_){}
    _pmapZoneBg=(v===0||v===false)?false:true; } return _pmapZoneBg; }
function pmapZoneBgToggle(){ _pmapZoneBg=!pmapZoneBgOn();
  try{ if(typeof ctWrite==='function') ctWrite('pmap_zonebg', _pmapZoneBg?1:0); }catch(_){}
  pmapRefresh(); }
// พื้นสีโซน · วงไล่สีที่จุดรับแต่ละจุด ซ้อนกันเป็นแถบของฝั่งนั้น + ป้ายชื่อโซนนอกชายฝั่ง
function pmapDrawZones(ctx, map){
  const grp={};
  _PM.areas.forEach(a=>{ if(!a.shown||!PHUKET_LL[a.key])return; const z=pmZoneOfArea(a.key); (grp[z]=grp[z]||[]).push(a); });
  const keys=Object.keys(grp); if(!keys.length)return;
  ctx.save(); ctx.globalCompositeOperation='multiply';
  keys.forEach(z=>{
    const col=pmZone(z)[1];
    grp[z].forEach(a=>{
      const ll=PHUKET_LL[a.key], pt=map.latLngToContainerPoint(ll);
      const pe=map.latLngToContainerPoint([ll[0]+0.032, ll[1]]);
      const R=Math.max(34, Math.abs(pe.y-pt.y));
      const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,R);
      g.addColorStop(0,col+'40'); g.addColorStop(.5,col+'22'); g.addColorStop(1,col+'00');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(pt.x,pt.y,R,0,6.2832); ctx.fill();
    });
  });
  ctx.restore();
  // ป้ายชื่อโซน · ดันออกนอกเกาะจากจุดกึ่งกลางของโซน จะได้ไม่ทับกลุ่มจุด
  //   ถ้าป้ายสองอันชนกัน (โซนเล็ก ๆ ที่อยู่ติดกัน) ดันอันหลังออกไปอีกทีละขั้น
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='800 12.5px sans-serif';
  const placed=[];
  keys.slice().sort((x,y)=>grp[y].length-grp[x].length).forEach(z=>{
    const ps=grp[z]; let la=0,lo=0; ps.forEach(a=>{ la+=PHUKET_LL[a.key][0]; lo+=PHUKET_LL[a.key][1]; });
    la/=ps.length; lo/=ps.length;
    const dla=la-_PMCEN[1], dlo=lo-_PMCEN[0], dl=Math.hypot(dla,dlo)||1;
    const nm=pmZone(z)[0].replace(' · มาเอง','');
    const half=ctx.measureText(nm).width/2+6;
    let pt=null;
    for(let k=0;k<7;k++){
      const push=0.050+(ps.length>2?0.012:0)+k*0.020;
      const p=map.latLngToContainerPoint([la+dla/dl*push, lo+dlo/dl*push]);
      const clash=placed.some(q=>Math.abs(q.x-p.x)<(q.half+half) && Math.abs(q.y-p.y)<22);
      pt=p; if(!clash) break;
    }
    placed.push({x:pt.x,y:pt.y,half:half});
    ctx.lineJoin='round'; ctx.miterLimit=2;
    ctx.lineWidth=3.5; ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.strokeText(nm,pt.x,pt.y);
    ctx.fillStyle=pmZone(z)[1]; ctx.fillText(nm,pt.x,pt.y);
  });
  ctx.restore();
}
function pmapDraw(){ const map=_PM.map,cv=_PM.canvas; if(!map||!cv)return; const sz=map.getSize(); const dpr=window.devicePixelRatio||1; if(cv.width!==Math.round(sz.x*dpr)||cv.height!==Math.round(sz.y*dpr)){ cv.width=Math.round(sz.x*dpr); cv.height=Math.round(sz.y*dpr); cv.style.width=sz.x+'px'; cv.style.height=sz.y+'px'; } const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,sz.x,sz.y);
  if(pmapZoneBgOn()) pmapDrawZones(ctx, map);
  _PM.areas.forEach(a=>{ if(!a.shown)return; const pt=map.latLngToContainerPoint(PHUKET_LL[a.key]); ctx.globalAlpha=.95; a.dots.forEach(dd=>{ const p=map.latLngToContainerPoint([dd.lat,dd.lng]); ctx.beginPath(); ctx.arc(p.x,p.y,2.0,0,6.2832); ctx.fillStyle=dd.c; ctx.fill(); });
    const pe=map.latLngToContainerPoint([PHUKET_LL[a.key][0]+a.geoR,PHUKET_LL[a.key][1]]); const rPx=Math.max(8,Math.abs(pe.y-pt.y));
    if(_pmapSel===a.key){ ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(pt.x,pt.y,rPx+5,0,6.2832); ctx.setLineDash([3,2]); ctx.strokeStyle='#111'; ctx.lineWidth=1.4; ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha=1; ctx.textAlign='center'; const up=PM_LBLUP[a.key]; const ny=up?(pt.y-rPx-15):(pt.y+rPx+12), cy=up?(pt.y-rPx-4):(pt.y+rPx+23); ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.font='600 11px sans-serif'; ctx.strokeText(a.key,pt.x,ny); ctx.fillStyle='#27343B'; ctx.fillText(a.key,pt.x,ny); const _ln=pmShowNum(pmVal(a)); ctx.font='11px ui-monospace,monospace'; ctx.strokeText(_ln,pt.x,cy); ctx.fillStyle='#566'; ctx.fillText(_ln,pt.x,cy); }); }
function pmapHits(){ const map=_PM.map; if(!map)return; if(_PM.hits)_PM.hits.clearLayers(); else _PM.hits=L.layerGroup().addTo(map);
  _PM.areas.forEach(a=>{ if(!a.shown)return; const cm=L.circleMarker(PHUKET_LL[a.key],{radius:Math.max(9,a.r),weight:0,opacity:0,fillOpacity:0.001,interactive:true}); cm.on('click',()=>pmapSelect(a.key)); cm.bindTooltip(a.key+' · '+pmShowNum(pmVal(a))+(_pmapMetric==='pax'?' pax':''),{direction:'top'}); cm.addTo(_PM.hits); }); }
function pmZone(r){ return PM_ZONE[r||''] || PM_ZONE['']; }
// ใบที่ไม่มี agent · ตั้งชื่อกลุ่มให้อ่านออกแทนรหัสช่องทางดิบ ๆ
function pmChannelName(c){
  c=String(c||'').trim(); if(!c) return 'Walk-in / Direct';
  return ({ direct:'Walk-in / Direct', walkin:'Walk-in / Direct', 'walk-in':'Walk-in / Direct',
            web:'เว็บไซต์ (B2C)', b2c:'เว็บไซต์ (B2C)', online:'เว็บไซต์ (B2C)',
            phone:'โทรจอง', line:'LINE', facebook:'Facebook', staff:'Staff / Internal'
          })[c.toLowerCase()] || (c.charAt(0).toUpperCase()+c.slice(1));
}
// รวมยอดเป็น agent × โซน · ใช้ช่วงเวลา หน่วยวัด และตัวกรองตลาดชุดเดียวกับแผนที่
// โรงแรมทั้งหมดของ agent ที่กำลังเจาะดู · เรียงจากมากไปน้อย
function pmapAgHotels(){
  if(!_pmapAgFilter) return [];
  const BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[]; const per=pmapPeriod();
  const H={}, HO=[];
  BK.forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status))return;
    if(pmAgKeyOf(b)!==_pmapAgFilter)return;
    if(_pmapMkFilter && pmMarket(b)!==_pmapMkFilter)return;
    let cp=0; (b.trips||[]).forEach(t=>{ if(per.test(t.date||'')) cp+=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; });
    if(cp<=0)return;
    const val=(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0);
    const w=_pmapMetric==='value'?val:cp; if(w<=0)return;
    const ar=(b.pickupAreaId&&typeof bkV2GetArea==='function')?bkV2GetArea(b.pickupAreaId):null;
    const zk=(ar&&ar.region)||'', area=ar?pmNormArea(ar.name):'';
    const nm=String(b.hotelName||b.pickup||'').trim()||'ไม่ระบุโรงแรม';
    // รวมตามชื่อโรงแรมอย่างเดียว · โรงแรมเดียวอาจถูกผูกกับจุดรับต่างกันในแต่ละใบ
    //   ไม่งั้นชื่อเดียวกันจะแตกเป็นหลายแถวจนอ่านไม่รู้เรื่อง · จุดรับเอาอันที่คนเยอะสุด
    if(!H[nm]){ H[nm]={name:nm, zone:zk, area:area, w:0, n:0, _a:{}, _z:{}}; HO.push(nm); }
    const e=H[nm]; e.w+=w; e.n++;
    if(area){ e._a[area]=(e._a[area]||0)+w; }
    if(zk){   e._z[zk]  =(e._z[zk]  ||0)+w; }
  });
  HO.forEach(k=>{ const e=H[k];
    const ta=Object.keys(e._a).sort((x,y)=>e._a[y]-e._a[x]);
    const tz=Object.keys(e._z).sort((x,y)=>e._z[y]-e._z[x]);
    e.area=ta[0]||''; e.zone=tz[0]||''; e.nArea=ta.length;
  });
  HO.sort((x,y)=>H[y].w-H[x].w);
  return HO.map(k=>H[k]);
}
function pmapAgentZone(){
  const BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[]; const per=pmapPeriod();
  const AG={}, AO=[], ZT={}, ZO=[]; let tot=0;
  BK.forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status))return;
    if(_pmapMkFilter && pmMarket(b)!==_pmapMkFilter)return;
    if(pmAgSkip(b))return;   // §pmapAgFilter
    let cp=0; (b.trips||[]).forEach(t=>{ if(per.test(t.date||'')) cp+=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0; });
    if(cp<=0)return;
    const val=(typeof acctBookingTotal==='function')?acctBookingTotal(b):(b.total||0);
    const w=_pmapMetric==='value'?val:cp; if(w<=0)return;
    const ar=(b.pickupAreaId&&typeof bkV2GetArea==='function')?bkV2GetArea(b.pickupAreaId):null;
    const zk=(ar&&ar.region)||'';
    const ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    const key=b.agentId||((b.b2cChannel||b.channelType==='b2c')?'_b2c':('_'+(b.channel||'walkin')));
    const nm=ag?(ag.name||ag.code||key):((b.b2cChannel||b.channelType==='b2c')?'เว็บไซต์ (B2C)':pmChannelName(b.channel));
    if(!AG[key]){ AG[key]={key,name:nm,mk:pmMarket(b),w:0,n:0,pax:0,z:{},zo:[]}; AO.push(key); }
    const a=AG[key]; a.w+=w; a.n++; a.pax+=cp;
    if(a.z[zk]==null){ a.z[zk]=0; a.zo.push(zk); }
    a.z[zk]+=w;
    if(ZT[zk]==null){ ZT[zk]=0; ZO.push(zk); }
    ZT[zk]+=w; tot+=w;
  });
  AO.sort((x,y)=>AG[y].w-AG[x].w);
  ZO.sort((x,y)=>ZT[y]-ZT[x]);
  return {AG,AO,ZT,ZO,tot};
}
function pmapAgOpen(){ if(_pmapAgOpen==null){ let v=null; try{ v=(typeof ctRead==='function')?ctRead('pmap_agpanel'):null; }catch(_){}
    _pmapAgOpen=(v===0||v===false)?false:true; } return _pmapAgOpen; }
function pmapAgToggle(){ _pmapAgOpen=!pmapAgOpen();
  try{ if(typeof ctWrite==='function') ctWrite('pmap_agpanel', _pmapAgOpen?1:0); }catch(_){}
  const h=document.getElementById('pmap-zpanel'); if(h) h.innerHTML=pmapZonePanel(); }
function pmapZonePanel(){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const D=pmapAgentZone();
  if(!pmapAgOpen())
    return `<button onclick="pmapAgToggle()" title="กางการ์ดสรุป Agent × โซน" style="display:inline-flex;align-items:center;gap:7px;`
      +`background:rgba(255,255,255,.97);border:0.5px solid #ddd;border-radius:99px;padding:7px 13px 7px 11px;`
      +`box-shadow:0 3px 14px rgba(0,0,0,.1);cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:#3A3A36">`
      +`<span style="width:9px;height:9px;border-radius:50%;background:#0F6E56"></span>Agent &times; โซน `
      +`<b style="font-family:'DM Mono',monospace;font-weight:500;color:#8A8880">${D.AO.length}</b> &raquo;</button>`;
  if(!D.AO.length)
    return `<div style="background:rgba(255,255,255,.97);border-radius:12px;border:0.5px solid #ddd;padding:13px 15px;`
      +`box-shadow:0 3px 14px rgba(0,0,0,.1);font-size:12px;color:#8A8880">ไม่มีข้อมูลในช่วงนี้`
      +`<span onclick="pmapAgToggle()" style="cursor:pointer;color:#185FA5;margin-left:8px">&laquo;</span></div>`;
  const TOPN=_pmapAgFilter?D.AO.length:8, top=D.AO.slice(0,TOPN), restN=D.AO.length-top.length;
  let restW=0; D.AO.slice(TOPN).forEach(k=>{ restW+=D.AG[k].w; });
  const rows=top.map(k=>{
    const a=D.AG[k]; const zo=a.zo.slice().sort((x,y)=>a.z[y]-a.z[x]);
    const bar=zo.map(z=>`<i style="display:block;height:100%;width:${(a.z[z]/a.w*100).toFixed(1)}%;background:${pmZone(z)[1]}" title="${esc(pmZone(z)[0])} ${pmShowNum(a.z[z])}"></i>`).join('');
    // §pmapAgFilter · ตอนเจาะดูเจ้าเดียว โชว์โซนให้ครบ ไม่ต้องย่อเหลือสองอันแรก
    const capN=_pmapAgFilter?zo.length:2;
    const cap=zo.slice(0,capN).map(z=>`<span style="white-space:nowrap"><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${pmZone(z)[1]};margin-right:4px"></i>${esc(pmZone(z)[0])} ${pmShowNum(a.z[z])}</span>`).join(' &middot; ')
      + (zo.length>capN?` &middot; <span style="color:#B4B2AA">+${zo.length-capN} โซน</span>`:'');
    const _on=(_pmapAgFilter===k);
    return `<div onclick="pmapSetAg('${esc(k).replace(/'/g,'')}')" title="${_on?'กดอีกครั้งเพื่อดูทุกเจ้า':'กดเพื่อดูเฉพาะเจ้านี้บนแผนที่'}"`
      +` style="padding:8px 7px 9px;margin:0 -7px;border-bottom:0.5px solid #F0EEE7;cursor:pointer;border-radius:8px;`
      +`background:${_on?'#EAF4F0':'transparent'}"`
      +` onmouseover="this.style.background='${_on?'#EAF4F0':'#F7F6F2'}'" onmouseout="this.style.background='${_on?'#EAF4F0':'transparent'}'">`
      +`<div style="display:flex;align-items:baseline;gap:7px">`
        +`<span style="width:9px;height:9px;border-radius:50%;background:${pmMktColor(a.mk)};flex:none;align-self:center" title="${esc(pmMktName(a.mk))}"></span>`
        +`<span style="flex:1;font-size:12.5px;font-weight:700;color:#27343B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.name)}</span>`
        +`<span style="font-family:'DM Mono',monospace;font-size:13.5px">${pmShowNum(a.w)}</span>`
        +`<span style="font-size:10px;color:#A0A099;width:30px;text-align:right">${D.tot?Math.round(a.w/D.tot*100):0}%</span></div>`
      +`<div style="display:flex;height:7px;border-radius:5px;overflow:hidden;margin:6px 0 5px;background:#F0EEE7">${bar}</div>`
      +`<div style="font-size:10.5px;color:#8A8880;line-height:1.45">${cap}</div></div>`;
  }).join('');
  const legend=D.ZO.slice(0,8).map(z=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#8A8880;white-space:nowrap">`
      +`<i style="width:8px;height:8px;border-radius:2px;background:${pmZone(z)[1]}"></i>${esc(pmZone(z)[0])} ${pmShowNum(D.ZT[z])}</span>`).join('');
  return `<div style="max-height:calc(100vh - 236px);overflow:auto;background:rgba(255,255,255,.97);border-radius:12px;`
    +`border:0.5px solid #ddd;padding:12px 14px 11px;box-shadow:0 3px 14px rgba(0,0,0,.1)">`
    +`<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">`
      +`<span style="flex:1;font-size:13px;font-weight:700">Agent &times; โซน</span>`
      +`<span style="font-size:11px;color:#A0A099;font-family:'DM Mono',monospace">${D.AO.length} ราย</span>`
      +`<button onclick="pmapAgToggle()" title="ย่อการ์ด" style="border:none;background:#F1EFEA;width:22px;height:22px;`
        +`border-radius:7px;cursor:pointer;color:#5F5E5A;font-size:13px;line-height:1;flex:none;font-family:inherit">&laquo;</button></div>`
    +(_pmapAgFilter
        ? `<div onclick="pmapSetAg(null)" style="cursor:pointer;font-size:11.5px;color:#185FA5;margin:2px 0 7px">&larr; ดูทุกเจ้า</div>`
        : `<div style="font-size:10.5px;color:#A0A099;margin:0 0 6px;line-height:1.5">`
          +`กดชื่อเจ้าเพื่อดูเฉพาะของเจ้านั้นบนแผนที่ · แถบสีคือโซนที่รับ ${_pmapMkFilter?('· กรอง '+esc(pmMktName(_pmapMkFilter))):''}</div>`)
    + rows
    + (function(){   // §pmapAgHotels · ลิสต์โรงแรมของเจ้าที่เจาะดูอยู่
        if(!_pmapAgFilter) return '';
        const HL=pmapAgHotels();
        if(!HL.length) return `<div style="font-size:11.5px;color:#A0A099;padding:10px 0 2px">ไม่มีรายชื่อโรงแรมในช่วงนี้</div>`;
        const tot=HL.reduce((a,h)=>a+h.w,0);
        const items=HL.map(h=>{
          const z=pmZone(h.zone);
          const jump=h.area?` onclick="event.stopPropagation();pmapSelect('${esc(h.area).replace(/'/g,'')}')" style="cursor:pointer;`:` style="`;
          return `<div${jump}display:flex;align-items:center;gap:7px;font-size:12px;padding:5px 0;border-bottom:0.5px solid #F4F2EC"`
            +` title="${esc(h.area||'ไม่ระบุจุดรับ')}${h.nArea>1?(' และอีก '+(h.nArea-1)+' จุดรับ'):''} &middot; ${h.n} booking${h.area?' · กดเพื่อดูจุดรับนี้':''}">`
            +`<i style="width:8px;height:8px;border-radius:50%;background:${z[1]};flex:none"></i>`
            +`<span style="flex:1;color:#3A3A36;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.name)}</span>`
            +`<span style="font-size:10px;color:#B4B2AA;max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.area||'')}</span>`
            +`<b style="font-family:'DM Mono',monospace;font-size:12.5px">${pmShowNum(h.w)}</b></div>`;
        }).join('');
        return `<div style="margin-top:9px;padding-top:9px;border-top:0.5px solid #ECEAE2">`
          +`<div style="display:flex;align-items:baseline;gap:7px;margin-bottom:3px">`
            +`<span style="flex:1;font-size:11.5px;font-weight:700;color:#5F5E5A">โรงแรม / จุดรับ</span>`
            +`<span style="font-size:10.5px;color:#A0A099;font-family:'DM Mono',monospace">${HL.length} แห่ง &middot; ${pmShowNum(tot)}</span></div>`
          +`<div style="max-height:44vh;overflow:auto">${items}</div></div>`;
      })()
    + (restN>0?`<div style="display:flex;align-items:center;gap:7px;font-size:11px;color:#8A8880;padding:8px 0 0">`
        +`<span style="flex:1">อีก ${restN} ราย</span><b style="font-family:'DM Mono',monospace;color:#3A3A36">${pmShowNum(restW)}</b></div>`:'')
    +`<div style="display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:10px;padding-top:9px;border-top:0.5px solid #ECEAE2">${legend}</div>`
    +`</div>`;
}
function pmapPanel(){ const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); const unit=_pmapMetric==='pax'?'pax':'';
  const mom=(v)=>{ if(v==null)return ''; const up=v>=0; return `<span style="font-size:11px;font-weight:700;color:${up?'#2E7D43':'#C0392B'};margin-left:6px">${up?'▲':'▼'} ${Math.abs(v)}%</span>`; };
  if(_pmapSel){ const e=_PM.areas.find(x=>x.key===_pmapSel); if(e){ const tv=pmVal(e); const segs=Object.keys(e.mk).sort((a,b)=>pmVal(e.mk[b])-pmVal(e.mk[a])); const det=pmapAreaDetail(e.key);
    const row=(nm,v)=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0"><span style="flex:1;color:#3A3A36;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nm)}</span><b style="font-family:'DM Mono',monospace">${pmShowNum(v)}</b></div>`;
    return `<div style="font-size:15px;font-weight:700;display:flex;justify-content:space-between;align-items:baseline">${esc(e.key)}<span style="font-size:19px;font-family:'DM Mono',monospace">${pmShowNum(tv)}<span style="font-size:11px;color:#999"> ${unit}</span></span></div>
      <div style="margin:2px 0 11px">${mom(pmapMoM(e.key))}<span style="font-size:10.5px;color:#A0A099"> vs ช่วงก่อน</span></div>
      <div style="display:flex;height:11px;border-radius:6px;overflow:hidden;margin:0 0 12px">${segs.map(mk=>`<div style="width:${(pmVal(e.mk[mk])/tv*100).toFixed(1)}%;background:${pmMktColor(mk)}" title="${esc(pmMktName(mk))}"></div>`).join('')}</div>
      ${segs.map(mk=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0"><span style="width:10px;height:10px;border-radius:50%;background:${pmMktColor(mk)};flex:none"></span><span style="flex:1;color:#3A3A36">${esc(pmMktName(mk))}</span><b style="font-family:'DM Mono',monospace">${pmShowNum(pmVal(e.mk[mk]))}</b><span style="color:#A0A099;font-size:11px;width:34px;text-align:right">${Math.round(pmVal(e.mk[mk])/tv*100)}%</span></div>`).join('')}
      ${det.hotels.length?`<div style="font-size:10.5px;font-weight:700;color:#8a8880;text-transform:uppercase;letter-spacing:.03em;margin:13px 0 3px">โรงแรมท็อป</div>${det.hotels.map(h=>row(h[0],h[1])).join('')}`:''}
      ${det.agents.length?`<div style="font-size:10.5px;font-weight:700;color:#8a8880;text-transform:uppercase;letter-spacing:.03em;margin:11px 0 3px">เอเจนซี่ท็อป</div>${det.agents.map(g=>row(g[0],g[1])).join('')}`:''}
      <div style="font-size:11px;color:#999;margin-top:9px">${det.bk} booking</div>
      <div style="font-size:11px;color:#185FA5;margin-top:8px;cursor:pointer" onclick="pmapSelect(null)">← ทุกจุด</div>`; } }
  const ranked=_PM.areas.slice().filter(a=>a.shown).sort((a,b)=>pmVal(b)-pmVal(a));
  return `<div style="font-size:13px;font-weight:700;margin-bottom:9px">ทุกจุดรับ · ${ranked.length} จุด${_pmapMetric==='value'?' · มูลค่า':''}</div>`+ranked.map(e=>{ const top=Object.keys(e.mk).sort((a,b)=>pmVal(e.mk[b])-pmVal(e.mk[a]))[0]; return `<div onclick="pmapSelect('${esc(e.key)}')" style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:5px 0;border-bottom:0.5px solid #ECEAE2;cursor:pointer"><span style="width:9px;height:9px;border-radius:50%;background:${pmMktColor(top)};flex:none"></span><span style="flex:1;color:#3A3A36">${esc(e.key)}</span>${mom(pmapMoM(e.key))}<b style="font-family:'DM Mono',monospace">${pmShowNum(pmVal(e))}</b></div>`; }).join('')+((pmVal(_PM.other)>0&&!_pmapMkFilter)?`<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;color:#8A8880"><span style="width:9px;height:9px;border-radius:50%;background:#CFCDC5;flex:none"></span><span style="flex:1">อื่น ๆ / ไม่มีพิกัด</span><b style="font-family:'DM Mono',monospace">${pmShowNum(pmVal(_PM.other))}</b></div>`:''); }
function pmapToolbar(){ const per=pmapPeriod(); const mb=(m,l)=>`<button onclick="pmapSetMode('${m}')" style="border:none;background:${_pmapMode===m?'#1683C7':'transparent'};color:${_pmapMode===m?'#fff':'#5F5E5A'};font-weight:${_pmapMode===m?700:500};font-size:12px;padding:5px 13px;border-radius:7px;cursor:pointer;font-family:inherit">${l}</button>`;
  const met=(m,l)=>`<button onclick="pmapSetMetric('${m}')" style="border:none;background:${_pmapMetric===m?'#0F6E56':'transparent'};color:${_pmapMetric===m?'#fff':'#5F5E5A'};font-weight:${_pmapMetric===m?700:500};font-size:12px;padding:5px 12px;border-radius:7px;cursor:pointer;font-family:inherit">${l}</button>`;
  const mkL=Object.keys(_PM.mkTot).sort((a,b)=>pmVal(_PM.mkTot[b])-pmVal(_PM.mkTot[a]));
  const chips=mkL.map(mk=>{ const on=_pmapMkFilter===mk,dim=_pmapMkFilter&&!on; return `<span onclick="pmapSetMk('${mk}')" title="กดเพื่อกรองเฉพาะตลาดนี้" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;border:1px solid ${on?pmMktColor(mk):'#e0ddd5'};background:${on?pmMktColor(mk)+'22':'#fff'};opacity:${dim?.4:1};font-size:11.5px"><span style="width:10px;height:10px;border-radius:50%;background:${pmMktColor(mk)}"></span>${pmMktName(mk)} <b style="font-family:'DM Mono',monospace;color:#1A1A1A">${pmShowNum(pmVal(_PM.mkTot[mk]))}</b></span>`; }).join('');
  const cap=(_PM.arr&&_PM.tot.pax)?Math.round(_PM.tot.pax/_PM.arr*1000)/10:null;
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:11px">
    <span style="display:inline-flex;background:#F1EFEA;border-radius:9px;padding:2px">${mb('week','สัปดาห์')}${mb('month','เดือน')}${mb('year','ปี')}</span>
    <span style="display:inline-flex;align-items:center;gap:2px;background:#fff;border:0.5px solid #e0ddd5;border-radius:99px;padding:3px 5px"><button onclick="pmapShift(-1)" style="background:none;border:none;width:24px;height:24px;cursor:pointer;font-size:14px;color:#888">‹</button><b style="font-size:12.5px;font-weight:600;padding:0 8px;min-width:130px;text-align:center">${per.label}</b><button onclick="pmapShift(1)" style="background:none;border:none;width:24px;height:24px;cursor:pointer;font-size:14px;color:#888">›</button></span>
    <span style="display:inline-flex;background:#EAF3EF;border-radius:9px;padding:2px">${met('pax','คน')}${met('value','฿ มูลค่า')}</span>
    <button onclick="pmapZoneBgToggle()" title="พื้นสีอ่อนบอกโซนบนแผนที่ · สีเดียวกับการ์ดซ้าย" style="display:inline-flex;align-items:center;gap:6px;border:1px solid ${pmapZoneBgOn()?'#B9D8CB':'#e0ddd5'};background:${pmapZoneBgOn()?'#EAF3EF':'#fff'};color:#5F5E5A;font-size:11.5px;font-weight:${pmapZoneBgOn()?700:500};padding:5px 11px;border-radius:99px;cursor:pointer;font-family:inherit"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${pmapZoneBgOn()?'linear-gradient(135deg,#E2725B,#4A9BB8)':'#DAD7CF'}"></span>พื้นสีโซน</button>
    <span style="font-size:12.5px;color:#5F5E5A">รวม <b style="font-family:'DM Mono',monospace;color:#1A1A1A">${pmShowNum(pmVal(_PM.tot))}</b> ${_pmapMetric==='pax'?'pax':''}${cap!=null?` · <span title="ส่วนแบ่งทั้งเกาะ = pax เรา ÷ ผู้โดยสารขาเข้าทั้งเกาะ (จาก Demand) · ระดับเกาะ ไม่ใช่รายย่าน">ส่วนแบ่งเกาะ <b style="color:#0F6E56">${cap}%</b> <span style="color:#bbb">(${_PM.tot.pax}/${_PM.arr})</span></span>`:''}</span>
    <span style="flex:1;min-width:10px"></span>
    ${_pmapAgFilter?`<span onclick="pmapSetAg(null)" title="กดเพื่อกลับไปดูทุกเจ้า" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;border:1px solid #0F6E56;background:#EAF4F0;font-size:11.5px;font-weight:700;color:#0F6E56">เฉพาะ ${((s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'))(pmapAgName())} <b style="font-weight:800">&times;</b></span>`:''}
    <span style="font-size:11px;color:#999">กรองตลาด:</span>${chips}${_pmapMkFilter?`<span onclick="pmapSetMk('${_pmapMkFilter}')" style="cursor:pointer;font-size:11px;color:#185FA5">ล้าง</span>`:''}
  </div>`; }
function pmapRefresh(){ pmapAgg(); pmapBuildDots(); const bar=document.getElementById('pmap-bar'); if(bar)bar.innerHTML=pmapToolbar(); const pn=document.getElementById('pmap-panel'); if(pn)pn.innerHTML=pmapPanel();
  const zp=document.getElementById('pmap-zpanel'); if(zp)zp.innerHTML=pmapZonePanel(); if(_PM.map){ try{_PM.map.invalidateSize();}catch(e){} pmapHits(); pmapDraw(); } }
function pmapEnsureLeaflet(cb){ if(window.L){cb();return;} if(!document.getElementById('pm-leaflet-css')){ const l=document.createElement('link'); l.id='pm-leaflet-css'; l.rel='stylesheet'; l.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(l); } window._pmCbs=window._pmCbs||[]; window._pmCbs.push(cb); if(window._pmLoading)return; window._pmLoading=true; const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload=function(){ (window._pmCbs||[]).forEach(f=>f()); window._pmCbs=[]; }; s.onerror=function(){ const w=document.getElementById('pickupmap-wrap'); if(w)w.innerHTML='<div style="padding:40px;text-align:center;color:#a33;font-size:13px">โหลดแผนที่ไม่สำเร็จ · ต้องต่ออินเทอร์เน็ต (Leaflet/แผนที่)</div>'; window._pmLoading=false; }; document.body.appendChild(s); }
function drTrendMode(m){ _drTrendMode=m; drAfter(); }
// ค่าที่ระบบไม่มีให้ · ทีมตั้งเองได้ในหน้านี้ · เก็บแบบเดียวกับสูตรต้นทุน (blob → app_meta)
function drCfg(){
  var c = (typeof ctRead === 'function') ? ctRead('dr_cfg') : null;
  c = c || {};
  return { vanCost:(+c.vanCost>0?+c.vanCost:1200), vanQuota:(+c.vanQuota>0?+c.vanQuota:6),
           targetPerPax:(+c.targetPerPax>0?+c.targetPerPax:130) };
}
function drCfgSet(k, v){
  var c = drCfg(); c[k] = Math.max(0, Math.round(parseFloat(String(v).replace(/[^0-9.]/g,''))||0));
  if(typeof ctWrite === 'function') ctWrite('dr_cfg', c);
  drAfter();
}
/* ══ §drReal · ต้นทุนใน Daily Report ต้องมาจากที่เดียวกับ P&L ═══════════════════
   เดิม DR มีเลขของตัวเอง · ค่ารถคันละ ฿1,200 เท่ากันหมด และหางยาวเหมาลำละ ฿600 ฝังในโค้ด
   ของจริงคือรถบริษัท ฿900 รถร่วม ฿1,800 แยกตามเส้นทางและโซนรับ (หน้า ราคาจริง)
   เทียบ 1–16 ส.ค. เลขเก่าต่ำกว่าจริง ฿32,700 · ผิด 15 จาก 16 วัน
   ═══════════════════════════════════════════════════════════════════════════════ */
function drVanReal(date){
  var out = { byVan:{}, total:0, nDefault:0, def:{} };
  if(typeof SB_BOOKINGS === 'undefined' || typeof vehGet !== 'function') return out;
  var all = {}, cell = {}, order = [];
  SB_BOOKINGS.forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status) >= 0) return;
    var t = (typeof ckTripOn==='function') ? ckTripOn(b, date) : null; if(!t) return;
    var O = (typeof bkOpsRead==='function') ? bkOpsRead(b, date) : (b.ops||{});
    var vid = O.vanId; if(!vid) return;
    var pax = (typeof ckBookedPax==='function') ? ckBookedPax(t) : 0;
    all[vid] = (all[vid] || 0) + pax;
    var bid = (O.boatId || t.charterBoatId) || '';
    var k = vid + '|' + bid;
    if(!cell[k]){ cell[k] = { vid:vid, bid:bid, pax:0, zone:'' }; order.push(k); }
    cell[k].pax += pax;
    /* คันเดียวรับปนสองโซน · ยึดโซนที่แพงกว่า เพราะรถวิ่งไกลสุดจริง */
    var a = (b.pickupAreaId && typeof bkV2GetArea==='function') ? bkV2GetArea(b.pickupAreaId) : null;
    var z = (a && a.zone) || '';
    if(z === 'KL') cell[k].zone = 'KL'; else if(!cell[k].zone) cell[k].zone = 'PK';
  });
  order.forEach(function(k){
    var c = cell[k], v = vehGet(c.vid); if(!v) return;
    var rid = '';
    try{ rid = (typeof TRIPS!=='undefined' && TRIPS[date] && TRIPS[date][c.bid] && TRIPS[date][c.bid].route) || ''; }catch(_){}
    var day = (typeof vanDayCost==='function') ? vanDayCost(v, rid, c.zone || 'PK') : 0;
    /* รถคันเดียวส่งขึ้นสองลำ → หารตามจำนวนหัวที่ส่งขึ้นแต่ละลำ · รวมกันแล้วเท่าค่าเช่าหนึ่งวันพอดี */
    var share = (all[c.vid] > 0) ? (c.pax / all[c.vid]) : 1;
    out.byVan[c.vid] = (out.byVan[c.vid] || 0) + day * share;
    out.total += day * share;
    /* ยังไม่ได้ตั้งเรตให้กลุ่มนี้เลย = กำลังใช้ค่าเริ่มต้น ไม่ใช่ราคาที่ตกลงกันจริง */
    var gk = (typeof vanGroupKey==='function') ? vanGroupKey(v) : 'own';
    var noRate = !(v.costPerDay != null && v.costPerDay !== '')
              && (typeof vanRateRaw==='function')
              && vanRateRaw(gk, rid, c.zone === 'KL' ? 'KL' : 'PK') === ''
              && vanRateRaw(gk, rid, 'base') === ''
              && vanRateRaw(gk, '', '') === '';
    if(noRate && !out.def[c.vid]){ out.def[c.vid] = 1; out.nDefault++; }
  });
  out.total = Math.round(out.total);
  Object.keys(out.byVan).forEach(function(k){ out.byVan[k] = Math.round(out.byVan[k]); });
  return out;
}
/* ราคาเรือหางยาวของเส้นทางหนึ่ง · อ่านจากสูตร (บรรทัด ltc/ltj) ผ่านแผนของเส้นทางนั้น
   เดิมฝังไว้ในโค้ดว่าเหมาลำละ 600 · ค่าเริ่มต้นของสูตรก็ 600 เท่ากัน วันแรกเลขจึงไม่ขยับ
   ต่างกันตรงที่ตั้งแต่นี้ไปแก้ได้ที่หน้าต้นทุน และแยกรายเส้นทางได้ */
function drLtRate(routeId){
  var out = { chtr:600, join:0 };
  try{
    var T = ctTpl(), pl = (typeof pxPlanFor==='function') ? pxPlanFor(routeId) : null;
    (T.lines || []).forEach(function(ln){
      if(ln.id !== 'ltc' && ln.id !== 'ltj') return;
      if(typeof ctGrpCfg==='function' && ctGrpCfg(pl || {}, ln.g || 'อื่นๆ').off){
        if(ln.id === 'ltc') out.chtr = 0; else out.join = 0; return;
      }
      var L = (typeof ctEffLine==='function') ? ctEffLine(ln, pl || {}) : ln;
      if(L.off){ if(ln.id === 'ltc') out.chtr = 0; else out.join = 0; return; }
      var p = (L.parts || [])[0] || {};
      if(ln.id === 'ltc') out.chtr = +p.u || 0; else out.join = +p.u || 0;
    });
  }catch(_){}
  return out;
}
function drB(n){ return '฿' + Math.round(+n||0).toLocaleString('en-US'); }
function drK(n){ n=+n||0; return n>=1000 ? ('฿'+(Math.round(n/100)/10)+'k') : drB(n); }
function drPct(a,b){ return (b>0) ? (Math.round(a/b*1000)/10) : 0; }
function drDateShift(d){ var x=new Date(_drDate+'T12:00:00'); x.setDate(x.getDate()+d); _drDate=x.toISOString().slice(0,10); drAfter(); }
function drToday(){ _drDate=(typeof TODAY_STR!=='undefined')?TODAY_STR:new Date().toISOString().slice(0,10); drAfter(); }
function drPickDay(v){ if(v) _drDate=v; drAfter(); }
function drTab(t){ _drTab=t; drAfter(); }
function drAfter(){ var y=window.scrollY||0; renderDailyReport(); try{ window.scrollTo(0,y); }catch(_){} }
function drPaint(order, map){
  order.forEach(function(id,i){ if(map[id]) map[id].color=DR_PALETTE[i%DR_PALETTE.length]; });
}
function drMarket(b){
  var ag = (b && b.agentId && typeof sbGetAgent==='function') ? sbGetAgent(b.agentId) : null;
  var mid = (ag && ag.market) || '';
  var M = null;
  if(mid && typeof SB_MARKETS!=='undefined' && Array.isArray(SB_MARKETS)){
    for(var i=0;i<SB_MARKETS.length;i++) if(SB_MARKETS[i].id===mid){ M=SB_MARKETS[i]; break; }
  }
  if(M) return { id:M.id, name:M.name||M.id, color:M.color||'#64748b', sub:(ag&&ag.sub)||'' };
  if(mid) return { id:mid, name:mid, color:'#94a3b8', sub:(ag&&ag.sub)||'' };
  // ทริปพนักงาน · ไม่ใช่ยอดขาย ต้องแยกถังของตัวเอง
  if(b && (b.purpose==='staff_welfare'||b.purpose==='staff_inspection'||b.staffId))
    return { id:'staff', name:'Staff / Internal', color:'#6c5ce7', sub:'' };
  if(b && !b.agentId) return { id:'walkin', name:'Walk-in / Direct', color:'#2d9a6a', sub:'' };
  return { id:'_none', name:'ยังไม่ระบุ Market', color:'#94a3b8', sub:'' };
}
// แยก pax ตามประเภทและสัญชาติจาก trip เดียว · ช่องเปล่า (ไม่มี _th/_fr) = ยังไม่ระบุสัญชาติ
function drPaxOf(t){
  var p=(t&&t.pax)||{}, o={ad:0,chd:0,inf:0,foc:0,th:0,fr:0,un:0,tot:0};
  ['ad','chd','inf','foc'].forEach(function(k){
    var th=+p[k+'_th']||0, fr=+p[k+'_fr']||0, un=+p[k]||0;
    o[k]+=th+fr+un; o.th+=th; o.fr+=fr; o.un+=un; o.tot+=th+fr+un;
  });
  return o;
}

// ── รวบรวมทุกอย่างของวันนั้นครั้งเดียว ───────────────────────────────────
function drData(date){
  var rows = (typeof tsRows==='function') ? tsRows(date) : [];
  var cxl  = (typeof tsCxlRows==='function') ? tsCxlRows(date) : [];
  var D = { date:date, rows:rows, cxl:cxl, pax:{ad:0,chd:0,inf:0,foc:0,th:0,fr:0,un:0,tot:0},
            rev:0, routes:{}, rOrder:[], mkt:{}, mOrder:[], boats:{}, bOrder:[], noBoat:{n:0,pax:0},
            vans:{}, vOrder:[], noVan:{n:0,pax:0}, selfArr:{n:0,pax:0}, zones:{}, zOrder:[],
            pay:{invoice:0,proforma:0,cot:0,card:0,transfer:0,other:0}, due:0, got:0, noSlip:0,
            meals:{veg:0,vegan:0,halal:0,allergy:0}, langs:{}, docs:{verified:0,issue:0,pending:0,nofiles:0},
            extras:0, upDue:0, upGot:0, ltJoin:0, ltChtr:0, ltBy:{},
            ret:{same:0,samePax:0,arr:0,arrPax:0,todo:0,todoPax:0,self:0,selfPax:0},
            ovn:{n:0, pax:0, days:{}},
            warn:{noVan:0,noBoat:0,doc:0,over:0,dueAmt:0} };

  rows.forEach(function(r){
    var b=r.b, t=r.t, px=drPaxOf(t);
    // §ovnDaily · คนรับกลับอยู่บนเรือจริง จึงนับใน "ผู้โดยสารทั้งวัน" และในที่นั่งของเรือ
    //   แต่รายได้ของเขาถูกลงไปแล้ววันขาไป และวันนี้ไม่มีงานขารับ
    var _ovn=!!r.ovnBack;
    if(_ovn){ D.ovn.n++; D.ovn.pax+=px.tot; if(r.ovnOut) D.ovn.days[r.ovnOut]=(D.ovn.days[r.ovnOut]||0)+px.tot; }
    ['ad','chd','inf','foc','th','fr','un','tot'].forEach(function(k){ D.pax[k]+=px[k]; });
    var amt=(+r.amount||0); D.rev+=amt;

    // เส้นทาง
    var rid=r.routeId||'', R=(typeof getRoute==='function'?getRoute(rid):null)||{};
    if(!D.routes[rid]){ D.routes[rid]={id:rid,name:R.name||rid||'—',color:R.color||'#94a3b8',n:0,pax:0,rev:0,seats:0,cap:0}; D.rOrder.push(rid); }
    D.routes[rid].n++; D.routes[rid].pax+=px.tot; D.routes[rid].rev+=amt;

    // กลุ่มตลาด
    var m=drMarket(b);
    if(!D.mkt[m.id]){ D.mkt[m.id]={id:m.id,name:m.name,color:m.color,pax:0,n:0,rev:0}; D.mOrder.push(m.id); }
    D.mkt[m.id].pax+=px.tot; D.mkt[m.id].n++; D.mkt[m.id].rev+=amt;

    // เรือ
    if(r.boat){
      var B=(typeof getBoat==='function'?getBoat(r.boat):null)||{};
      if(!D.boats[r.boat]){ D.boats[r.boat]={id:r.boat,name:B.name||r.boat,type:B.type||'',
        homePier:B.pier||'', pier:'', piers:{},
        cap:(+B.cap||+B.capacity||0),pax:0,n:0,routes:{},dep:''}; D.bOrder.push(r.boat); }
      var bo=D.boats[r.boat]; bo.pax+=px.tot; bo.n++; bo.routes[rid]=(bo.routes[rid]||0)+px.tot;
      // §drBoatPier · ท่าที่ต้องไปขึ้นเรือ = ท่าของเส้นทางที่เรือลำนี้รับวันนั้น
      //   ไม่ใช่ท่าประจำของเรือ · เรือย้ายท่าไปวิ่งโปรแกรมอีกฝั่งได้
      if(R && R.pier) bo.piers[R.pier]=(bo.piers[R.pier]||0)+px.tot;
      if(!bo.dep && Array.isArray(R.times) && R.times.length) bo.dep=R.times[0];
    } else { D.noBoat.n++; D.noBoat.pax+=px.tot; D.warn.noBoat++; }

    // รถ
    var zRaw=t.zone||b.pickupZone||'NoTransfer';
    var selfArr=(zRaw==='NoTransfer'||zRaw==='NT'||b.pickupSelf);
    if(r.van){
      var V=(typeof vehGet==='function'?vehGet(r.van):null)||{};
      if(!D.vans[r.van]){ D.vans[r.van]={id:r.van,name:V.name||r.van,plate:V.plate||'',cap:(+V.capacity||0),
        type:V.type||'',own:V.ownership||'',pax:0,n:0,zone:zRaw,first:'',boats:{}}; D.vOrder.push(r.van); }
      var vn=D.vans[r.van]; vn.pax+=px.tot; vn.n++;
      var tm=String((r.O&&r.O.pickupTimeFinal)||t.pickupTime||'');
      if(tm && (!vn.first || tm<vn.first)) vn.first=tm;
      if(r.boat) vn.boats[r.boat]=1;
    } else if(_ovn){ /* §ovnDaily · ไม่มีรถกลับ = เรื่องของขากลับ ไม่ใช่ "มาเอง" · เตือนที่ warn.noVan พอ */ D.warn.noVan++; }
    else if(selfArr){ D.selfArr.n++; D.selfArr.pax+=px.tot; }   // ไม่มีรถและเป็นโซนมาเอง
    else { D.noVan.n++; D.noVan.pax+=px.tot; D.warn.noVan++; }

    // โซนรับ · §ovnDaily · ขากลับไม่มีการไปรับ · โซนที่ติดมาคือโซนส่ง ไม่ใช่โซนรับ
    if(_ovn){ /* ข้าม */ }
    else if(!selfArr || r.van){
      var zl=(r.van&&(zRaw==='NoTransfer'||zRaw==='NT')) ? 'ยังไม่ระบุโซน'
             : ((typeof bkV2ZoneLabel==='function')?bkV2ZoneLabel(zRaw):zRaw);
      if(!D.zones[zl]){ D.zones[zl]={name:zl,pax:0,n:0,vans:{},first:'',last:''}; D.zOrder.push(zl); }
      var z=D.zones[zl]; z.pax+=px.tot; z.n++; if(r.van) z.vans[r.van]=1;
      var t2=String((r.O&&r.O.pickupTimeFinal)||t.pickupTime||'');
      if(t2){ if(!z.first||t2<z.first) z.first=t2; if(!z.last||t2>z.last) z.last=t2; }
    }

    // ขากลับ
    var ri=(typeof bkV2RetInfo==='function')?bkV2RetInfo(b,date):null;
    if(!ri||!ri.sep){ D.ret.same++; D.ret.samePax+=px.tot; }
    else if(ri.selfRet){ D.ret.self++; D.ret.selfPax+=px.tot; }
    else if(ri.arranged||ri.sameVan){ D.ret.arr++; D.ret.arrPax+=px.tot; }
    else { D.ret.todo++; D.ret.todoPax+=px.tot; }

    // เงิน
    var M=(typeof pckMoney==='function')?pckMoney(b,date):{};
    var pt=String(M.payType||'');
    if(pt==='invoice'||pt==='credit') D.pay.invoice+=amt;
    else if(pt==='proforma'||pt==='prepaid') D.pay.proforma+=amt;
    else if(pt==='cot') D.pay.cot+=amt;
    else if(pt==='bt') D.pay.transfer+=amt;
    else D.pay.other+=amt;
    D.due+=(+M.due||0); D.got+=(+M.pierPaid||0); D.noSlip+=(+M.noSlip||0);
    D.extras+=(+M.extrasTot||0); D.upDue+=(+M.upDue||0); D.upGot+=(+M.upGot||0);

    // อาหาร · ภาษา
    var mm=b.specialMeals||{};
    D.meals.veg+=+mm.veg||0; D.meals.vegan+=+mm.vegan||0; D.meals.halal+=+mm.halal||0;
    D.meals.allergy+=(typeof bkV2AllergyCount==='function')?bkV2AllergyCount(mm):(String(mm.allergies||'').trim()?1:0);
    // §langNorm · กติกาเดียวกับใบงานไกด์ · ไม่งั้น Daily Report นับ Spanish แยกเป็นหลายภาษา
    var addL=function(c,n){ if(!c||!n) return; D.langs[c]=(D.langs[c]||0)+n; };
    ((typeof pckGuideLangs==='function')?pckGuideLangs(b):[]).forEach(function(c){ addL(c,px.tot); });

    // เอกสาร
    var st=(typeof docCheckStatus==='function')?docCheckStatus(b):'nofiles';
    if(D.docs[st]==null) D.docs[st]=0; D.docs[st]++;
    if(b.agentId && st!=='verified') D.warn.doc++;

    // หางยาว · §ovnDaily · ของที่จองมากับใบถูกใช้และจ่ายไปแล้ววันขาไป · นับซ้ำ = ค่าใช้จ่ายเกินจริง
    /* §ltOne · คำถามเดียวกับใบงานไกด์ · ใช้ตัวเดียวกัน เลขสองหน้าจะได้ตรงกันเสมอ */
    var LT=(_ovn || typeof bkLtState!=='function') ? {mode:'none'} : bkLtState(b,rid,date);
    if(!D.ltBy[rid]) D.ltBy[rid]={chtr:0, join:0};
    if(LT.mode==='charter'){ D.ltChtr+=LT.boats; D.ltBy[rid].chtr+=LT.boats; }
    else if(LT.mode==='join'){
      if(LT.joinBooked){ D.ltJoin+=px.tot; D.ltBy[rid].join+=px.tot; }
      if(LT.joinExtra){ D.ltJoin+=LT.joinExtra; D.ltBy[rid].join+=LT.joinExtra; }
    }
  });

  // ความจุเรือลงไปที่เส้นทาง · เรือลำเดียวอาจวิ่งหลายเส้นทางในวันเดียว จึงเฉลี่ยตามสัดส่วนคน
  D.bOrder.forEach(function(id){
    var bo=D.boats[id];
    Object.keys(bo.routes).forEach(function(rid){
      if(!D.routes[rid]) return;
      var share=(bo.pax>0)?(bo.routes[rid]/bo.pax):0;
      D.routes[rid].seats+=bo.routes[rid];
      D.routes[rid].cap+=Math.round(bo.cap*share);
    });
    if(bo.cap>0 && bo.pax>bo.cap) D.warn.over++;
  });
  // §drBoatPier · ท่าหลักของเรือแต่ละลำ = ท่าที่รับผู้โดยสารมากสุด · ไม่มีข้อมูลค่อยใช้ท่าประจำ
  D.bOrder.forEach(function(id){ var b=D.boats[id];
    var ks=Object.keys(b.piers||{});
    ks.sort(function(x,y){ return b.piers[y]-b.piers[x]; });
    b.pier = ks[0] || b.homePier || '';
    b.pierAll = ks;                                        // เรือลำเดียวรับหลายท่าในวันเดียว
    b.moved = !!(b.pier && b.homePier && b.pier!==b.homePier);   // ต้องย้ายเรือไปอีกท่า
  });
  // §ovnDaily · ตัวหารของค่าเฉลี่ยรายได้ = คนที่มีรายได้ของวันนี้ · ไม่รวมคนรับกลับ (ลงเงินไปแล้ววันขาไป)
  D.paxPay=Math.max(0, D.pax.tot - D.ovn.pax);
  D.capTot=D.bOrder.reduce(function(a,id){ return a+D.boats[id].cap; },0);
  D.seatTot=D.bOrder.reduce(function(a,id){ return a+D.boats[id].pax; },0);

  var C=drCfg();
  D.nVan=D.vOrder.length;
  D.vanIn=Math.min(D.nVan, C.vanQuota);
  D.vanOut=Math.max(0, D.nVan-C.vanQuota);
  /* §drReal · ค่ารถจากเรตจริงรายคัน ไม่ใช่เลขเฉลี่ยตัวเดียว
     ช่อง "ค่ารถ/คัน" ในหน้านี้เหลือไว้เป็นตัวสำรองของคันที่ยังไม่ได้ตั้งเรต */
  D.vanReal=drVanReal(date);
  D.vanCost=D.vanReal.total || (D.nVan*C.vanCost);
  D.vanEst=!D.vanReal.total;                       /* ไม่มีข้อมูลเลย → ถอยไปใช้เลขเฉลี่ยเหมือนเดิม */
  D.vanNoRate=D.vanReal.nDefault;                  /* กี่คันที่ยังใช้ค่าเริ่มต้น ไม่ใช่ราคาที่ตกลงกันจริง */
  D.vanPax=D.vOrder.reduce(function(a,id){ return a+D.vans[id].pax; },0);
  D.perPax=(D.vanPax>0)?(D.vanCost/D.vanPax):0;
  /* §drReal · หางยาวคิดจากสูตรของเส้นทางนั้น ๆ · จอยมีราคาต่อหัวได้ด้วย ไม่ใช่นับแต่เหมาลำ */
  D.ltCost=0;
  Object.keys(D.ltBy).forEach(function(rid){
    var L=D.ltBy[rid], R=drLtRate(rid);
    D.ltCost += (L.chtr||0)*R.chtr + (L.join||0)*R.join;
  });
  D.ltCost=Math.round(D.ltCost);
  D.warn.dueAmt=D.due;
  D.mOrder.sort(function(a,b){ return D.mkt[b].pax-D.mkt[a].pax; });
  drPaint(D.mOrder, D.mkt);
  D.rOrder.sort(function(a,b){ return D.routes[b].pax-D.routes[a].pax; });
  D.bOrder.sort(function(a,b){ return drPct(D.boats[b].pax,D.boats[b].cap)-drPct(D.boats[a].pax,D.boats[a].cap); });
  D.zOrder.sort(function(a,b){ return D.zones[b].pax-D.zones[a].pax; });
  return D;
}

// ── กราฟ 14 วัน · ชั้นสีตามกลุ่มตลาด ─────────────────────────────────────
function drTrend(date, nDays, back){
  back = back||2; nDays = nDays||14;
  var out=[], base=new Date(date+'T12:00:00');
  var mkt={}, order=[];
  for(var i=0;i<nDays;i++){
    var d=new Date(base.getTime()); d.setDate(d.getDate()-back+i);
    var ds=d.toISOString().slice(0,10);
    var rows=(typeof tsRows==='function')?tsRows(ds):[];
    var by={}, tot=0;
    rows.forEach(function(r){
      var m=drMarket(r.b), px=drPaxOf(r.t).tot;
      if(!mkt[m.id]){ mkt[m.id]={id:m.id,name:m.name,color:m.color,tot:0}; order.push(m.id); }
      mkt[m.id].tot+=px; by[m.id]=(by[m.id]||0)+px; tot+=px;
    });
    out.push({ date:ds, by:by, tot:tot, today:(ds===date),
               lb:(d.getDate()+(i===0||d.getDate()===1?(' '+['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()]):'')) });
  }
  order.sort(function(a,b){ return mkt[b].tot-mkt[a].tot; });
  drPaint(order, mkt);
  // เกิน 5 กลุ่มรวมเป็น "อื่น ๆ" · ชั้นสีเยอะกว่านี้อ่านไม่ออก
  var keep=order.slice(0,5), rest=order.slice(5);
  if(rest.length){
    out.forEach(function(p){ var o=0; rest.forEach(function(id){ o+=(p.by[id]||0); delete p.by[id]; }); if(o) p.by._etc=o; });
    mkt._etc={id:'_etc',name:'อื่น ๆ',color:'#94a3b8'}; keep.push('_etc');
    drPaint(keep, mkt);
  }
  return { pts:out, keys:keep, mkt:mkt };
}
// นับตาม "วันที่ลงบุคกิ้ง" · ย้อนหลัง nDays วันจบที่วันที่เลือก
//   pax นับทุกทริปในใบนั้น เพราะใบเดียวอาจขายหลายวัน · ใบที่ยกเลิกไม่นับ (ตรงกับที่อื่น)
function drTrendBooked(date, nDays){
  nDays=nDays||14;
  var end=new Date(date+'T12:00:00'), map={}, days=[], i;
  var TH=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  for(i=nDays-1;i>=0;i--){
    var d=new Date(end.getTime()); d.setDate(d.getDate()-i);
    var ds=d.toISOString().slice(0,10);
    days.push(ds);
    map[ds]={ date:ds, by:{}, tot:0, today:(ds===date),
              lb:(d.getDate()+((i===nDays-1||d.getDate()===1)?(' '+TH[d.getMonth()]):'')) };
  }
  var mkt={}, order=[];
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var cd=String(b.bookingDate||b.createdAt||'').slice(0,10);
    var p=map[cd]; if(!p) return;
    var px=0; (b.trips||[]).forEach(function(t){ px+=drPaxOf(t).tot; });
    if(!px) return;
    var m=drMarket(b);
    if(!mkt[m.id]){ mkt[m.id]={id:m.id,name:m.name,color:m.color,tot:0}; order.push(m.id); }
    mkt[m.id].tot+=px; p.by[m.id]=(p.by[m.id]||0)+px; p.tot+=px;
  });
  order.sort(function(a,b){ return mkt[b].tot-mkt[a].tot; });
  drPaint(order, mkt);
  var keep=order.slice(0,5), rest=order.slice(5), pts=days.map(function(ds){ return map[ds]; });
  if(rest.length){
    pts.forEach(function(p){ var o=0; rest.forEach(function(id){ o+=(p.by[id]||0); delete p.by[id]; }); if(o) p.by._etc=o; });
    mkt._etc={id:'_etc',name:'อื่น ๆ',color:'#94a3b8'}; keep.push('_etc'); drPaint(keep, mkt);
  }
  return { pts:pts, keys:keep, mkt:mkt };
}
function drSmooth(pts){
  if(!pts.length) return '';
  var d='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1), t=0.28;
  for(var i=0;i<pts.length-1;i++){
    var p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||pts[i+1];
    d+=' C'+(p1[0]+(p2[0]-p0[0])*t).toFixed(1)+','+(p1[1]+(p2[1]-p0[1])*t).toFixed(1)
      +' '+(p2[0]-(p3[0]-p1[0])*t).toFixed(1)+','+(p2[1]-(p3[1]-p1[1])*t).toFixed(1)
      +' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
  }
  return d;
}
function drChart(T){
  var e=ckEsc, W=880, H=300, L=38, R=16, TP=36, BT=42, n=T.pts.length;
  if(!n) return '<div class="dr-empty">ไม่มีข้อมูล</div>';
  var mx=1; T.pts.forEach(function(p){ if(p.tot>mx) mx=p.tot; });
  mx=Math.ceil(mx/8)*8 || 8;
  var step=(n>1)?((W-L-R)/(n-1)):0, xs=[], i;
  for(i=0;i<n;i++) xs.push(L+step*i);
  var yb=H-BT, yt=TP, Y=function(v){ return yb-(v/mx)*(yb-yt); };
  var o='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="none" style="overflow:visible">';
  o+='<defs>';
  T.keys.forEach(function(k,i2){ var c=(T.mkt[k]||{}).color||'#94a3b8';
    o+='<linearGradient id="drg'+i2+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c+'" stop-opacity=".95"/>'
      +'<stop offset="1" stop-color="'+c+'" stop-opacity=".7"/></linearGradient>'; });
  o+='</defs>';
  o+='<g stroke="#f3f4f6" stroke-width="1" stroke-dasharray="4 4">';
  for(i=0;i<5;i++){ var gy=yt+(yb-yt)*i/4; o+='<line x1="'+(L-14)+'" y1="'+gy.toFixed(1)+'" x2="'+(W-R+6)+'" y2="'+gy.toFixed(1)+'"/>'; }
  o+='</g><g fill="#9ca3af" font-size="10" text-anchor="end">';
  for(i=0;i<5;i++){ var gy2=yt+(yb-yt)*i/4; o+='<text x="'+(L-18)+'" y="'+(gy2+3).toFixed(1)+'">'+Math.round(mx*(4-i)/4)+'</text>'; }
  o+='</g>';
  var cum=[]; for(i=0;i<n;i++) cum.push(0);
  T.keys.forEach(function(k,i2){
    var lo=cum.slice(), hi=[];
    for(i=0;i<n;i++){ cum[i]+=(T.pts[i].by[k]||0); hi.push(cum[i]); }
    var top=[], bot=[];
    for(i=0;i<n;i++){ top.push([xs[i],Y(hi[i])]); bot.push([xs[i],Y(lo[i])]); }
    var rv=drSmooth(bot.slice().reverse());
    o+='<path d="'+drSmooth(top)+' L'+rv.slice(1)+' Z" fill="url(#drg'+i2+')"/>';
  });
  var tot=[]; for(i=0;i<n;i++) tot.push([xs[i],Y(T.pts[i].tot)]);
  o+='<path d="'+drSmooth(tot)+'" fill="none" stroke="#1f2937" stroke-width="1.6" stroke-opacity=".18"/>';
  var ti=-1; for(i=0;i<n;i++) if(T.pts[i].today) ti=i;
  if(ti>=0){
    o+='<line x1="'+xs[ti].toFixed(1)+'" y1="'+(yt-16)+'" x2="'+xs[ti].toFixed(1)+'" y2="'+yb+'" stroke="#111827" stroke-width="1.4" stroke-dasharray="5 4" opacity=".5"/>'
      +'<rect x="'+(xs[ti]-24).toFixed(1)+'" y="'+(yt-31)+'" width="48" height="18" rx="9" fill="#111827"/>'
      +'<text x="'+xs[ti].toFixed(1)+'" y="'+(yt-18)+'" fill="#fff" font-size="10" font-weight="700" text-anchor="middle">วันนี้</text>';
  }
  o+='<g text-anchor="middle">';
  for(i=0;i<n;i++){ var big=(i===ti);
    o+='<text x="'+xs[i].toFixed(1)+'" y="'+(Y(T.pts[i].tot)-9).toFixed(1)+'" font-size="'+(big?12.5:11)
      +'" font-weight="800" fill="'+(big?'#111827':'#4b5563')+'">'+T.pts[i].tot+'</text>'; }
  o+='</g><g font-size="10" text-anchor="middle">';
  for(i=0;i<n;i++){ o+='<text x="'+xs[i].toFixed(1)+'" y="'+(yb+18)+'" fill="'+((i===ti)?'#111827':'#9ca3af')
      +'" font-weight="'+((i===ti)?700:400)+'">'+e(T.pts[i].lb)+'</text>'; }
  o+='</g>';
  // แถบโปร่งใสไว้รับเมาส์ · ชี้วันไหนขึ้นกล่องแยกทีละตลาด
  for(i=0;i<n;i++){
    var tip=T.pts[i].date+' · รวม '+T.pts[i].tot+' คน';
    T.keys.forEach(function(k){ var v=T.pts[i].by[k]||0; if(v) tip+='\n'+((T.mkt[k]||{}).name||k)+' '+v; });
    o+='<rect x="'+(xs[i]-step/2).toFixed(1)+'" y="'+yt+'" width="'+Math.max(8,step).toFixed(1)+'" height="'+(yb-yt)
      +'" fill="transparent"><title>'+e(tip)+'</title></rect>';
  }
  return o+'</svg>';
}

// ── โดนัท ────────────────────────────────────────────────────────────────
function drDonut(items, total, label){
  var o='<svg width="186" height="186" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f3f4f6" stroke-width="5.3"></circle>';
  var off=25;
  items.forEach(function(it){
    var p=(total>0)?(it.v/total*100):0;
    o+='<circle cx="21" cy="21" r="15.9155" fill="none" stroke="'+it.c+'" stroke-width="5.3" stroke-dasharray="'
      +p.toFixed(2)+' '+(100-p).toFixed(2)+'" stroke-dashoffset="'+off.toFixed(2)+'"></circle>';
    off-=p;
  });
  return '<div class="dr-dn">'+o+'</div><div class="dr-mid"><b>'+total+'</b><span>'+ckEsc(label||'Total')+'</span></div>';
}
// ── CSS · scope ใต้ #dailyreport-host เท่านั้น ──────────────────────────
function drCSS(){ var S='#dailyreport-host'; return ''
 +S+'{--dg:#f3f4f6;--di:#111827;--d2:#1f2937;--dm:#6b7280;--df:#9ca3af;--dl:#f3f4f6;--dl2:#e5e7eb;'
   +'--dind:#4f46e5;--dblu:#2563eb;--dem:#10b981;--dem7:#047857;--dor:#f97316;--dpu:#8b5cf6;'
   +'--dam:#f59e0b;--dam7:#b45309;--dte:#14b8a6;--dro:#e11d48;--dro7:#be123c;--dsl:#64748b;'
   +'background:var(--dg);margin:-22px;padding:22px;font-family:inherit;color:var(--d2);font-size:13px;display:block}'
 +S+' *{box-sizing:border-box}'
 +S+' .dr-wrap{max-width:1460px;margin:0 auto;display:flex;flex-direction:column;gap:22px}'
 +S+' .eg{background:#fff;border-radius:24px;box-shadow:0 10px 25px -5px rgba(0,0,0,.03),0 8px 10px -6px rgba(0,0,0,.02);transition:box-shadow .3s}'
 +S+' .eg:hover{box-shadow:0 20px 30px -10px rgba(0,0,0,.06),0 10px 15px -5px rgba(0,0,0,.03)}'
 +S+' .p5{padding:20px}'+S+' .p6{padding:22px}'
 +S+' .dr-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fff;border-radius:24px;padding:12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.04);flex-wrap:wrap}'
 +S+' .dr-brand{display:flex;align-items:center;gap:9px;padding-left:4px}'
 +S+' .dr-logo{width:38px;height:38px;border-radius:14px;background:linear-gradient(45deg,#4f46e5,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;box-shadow:0 4px 10px rgba(79,70,229,.3)}'
 +S+' .dr-brand b{font-size:17px;font-weight:800;letter-spacing:-.02em;color:var(--di)}'
 +S+' .dr-pills{display:flex;gap:4px;background:#f3f4f6;padding:4px;border-radius:16px;font-size:12.5px;font-weight:600}'
 +S+' .dr-pill{padding:8px 15px;border-radius:12px;color:var(--dm);cursor:pointer;border:none;background:none;font:inherit;white-space:nowrap;transition:.15s}'
 +S+' .dr-pill:hover{color:var(--di)}'
 +S+' .dr-pill.on{background:var(--di);color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05)}'
 +S+' .dr-title{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}'
 +S+' .dr-title h1{font-size:27px;font-weight:800;letter-spacing:-.025em;margin:0;color:var(--di)}'
 +S+' .dr-title p{margin:5px 0 0;font-size:12.5px;color:var(--dm);display:flex;align-items:center;gap:8px}'
 +S+' .dr-live{width:8px;height:8px;border-radius:50%;background:var(--dem);box-shadow:0 0 0 3px rgba(16,185,129,.2)}'
 +S+' .dr-ctl{display:flex;gap:9px;flex-wrap:wrap;align-items:center}'
 +S+' .dr-btn{display:inline-flex;align-items:center;gap:7px;background:#fff;padding:9px 14px;border-radius:15px;font:inherit;font-size:12px;font-weight:700;color:#374151;border:1px solid #f3f4f6;box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:pointer}'
 +S+' .dr-btn:hover{background:#f9fafb}'
 +S+' .dr-btn.pri{background:var(--di);color:#fff;border-color:var(--di)}'
 +S+' input.dr-btn{font-family:inherit}'
 +S+' .dr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}'
 +S+' .dr-k .r1{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}'
 +S+' .dr-k .lb{font-size:12px;font-weight:500;color:var(--dm);margin:0}'
 +S+' .dr-k .big{display:flex;align-items:baseline;gap:8px;margin-top:8px}'
 +S+' .dr-k .big b{font-size:29px;font-weight:800;color:var(--di);letter-spacing:-.02em;line-height:1}'
 +S+' .dr-k .big em{font-style:normal;font-size:12px;font-weight:700;color:var(--dem7)}'
 +S+' .dr-k .big em.i{color:var(--dind)}'+S+' .dr-k .big em.g{color:var(--dm);font-weight:500}'+S+' .dr-k .big em.r{color:var(--dro7)}'
 +S+' .dr-k .sm{font-size:11px;color:var(--df);margin:6px 0 0}'
 +S+' .dr-k .sm.ok{color:var(--dem7);font-weight:500}'+S+' .dr-k .sm.bad{color:var(--dro7);font-weight:500}'
 +S+' .dr-k .ico{width:40px;height:40px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 1px 2px rgba(0,0,0,.05);flex:none}'
 +S+' .dr-k .ft{margin-top:13px;padding-top:11px;border-top:1px solid var(--dl);display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--dm)}'
 +S+' .dr-k .ft b{color:var(--d2);font-weight:700}'+S+' .dr-k .ft .sep{color:#d1d5db}'
 +S+' .ico.blue{background:#eff6ff;color:var(--dblu)}'+S+' .ico.em{background:#ecfdf5;color:var(--dem7)}'
 +S+' .ico.pu{background:#f5f3ff;color:var(--dpu)}'+S+' .ico.or{background:#fff7ed;color:var(--dor)}'
 +S+' .ico.ro{background:#fff1f2;color:var(--dro7)}'+S+' .ico.te{background:#f0fdfa;color:#0d9488}'
 +S+' .dr-main{display:grid;grid-template-columns:2fr 1fr;gap:22px;align-items:stretch}'
 +S+' .dr-main > .dr-col:last-child > *:last-child{flex:1 1 auto}'
 +S+' .dr-col{display:flex;flex-direction:column;gap:22px}'
 +S+' .dr-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:18px}'
 +S+' .dr-hd h2{margin:0;font-size:16px;font-weight:800;color:var(--di)}'
 +S+' .dr-hd h2.sm{font-size:14.5px}'
 +S+' .dr-hd p{margin:2px 0 0;font-size:11.5px;color:var(--dm)}'
 +S+' .dr-hd .rt{font-size:11.5px;font-weight:600;color:var(--df)}'
 +S+' .dr-chip{padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap;display:inline-block}'
 +S+' .dr-chip.i{background:#eef2ff;color:var(--dind)}'+S+' .dr-chip.e{background:#d1fae5;color:#047857}'
 +S+' .dr-chip.b{background:#eff6ff;color:var(--dblu)}'+S+' .dr-chip.p{background:#f5f3ff;color:#7c3aed}'
 +S+' .dr-chip.a{background:#fef3c7;color:#b45309}'+S+' .dr-chip.n{background:#e5e7eb;color:#4b5563}'
 +S+' .dr-chip.r{background:#ffe4e6;color:#be123c}'
 +S+' .dr-duo{display:grid;grid-template-columns:1fr 1fr;gap:22px}'
 +S+' .dr-b{margin-bottom:18px}'+S+' .dr-b:last-child{margin-bottom:0}'
 +S+' .dr-bl{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:6px;gap:10px}'
 +S+' .dr-bl .n{font-weight:700;color:#1f2937;display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .dr-bl .n i{width:10px;height:10px;border-radius:50%;font-style:normal;flex:none}'
 +S+' .dr-bl .v{font-weight:700;white-space:nowrap}'+S+' .dr-bl .v span{color:var(--df);font-weight:400}'
 +S+' .dr-trk{width:100%;height:12px;background:#f3f4f6;border-radius:999px;overflow:hidden;display:flex}'
 +S+' .dr-trk i{display:block;height:100%}'
 +S+' .dr-bs{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--df);margin-top:5px}'
 +S+' .dr-tile{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:16px;background:#f9fafb;margin-bottom:12px}'
 +S+' .dr-tile:last-child{margin-bottom:0}'
 +S+' .dr-tile .t{font-size:11.5px;color:var(--dm);margin:0}'
 +S+' .dr-tile .b{font-size:14px;font-weight:800;color:var(--di);margin:2px 0 0}'
 +S+' .dr-tile.acc{background:rgba(238,242,255,.6);border:1px solid #e0e7ff}'
 +S+' .dr-tile.acc .t{color:#4338ca}'+S+' .dr-tile.acc .b{color:#1e1b4b}'
 +S+' .dr-tile.warn{background:#fff1f2;border:1px solid #ffe4e6}'
 +S+' .dr-tile.warn .t{color:#be123c}'+S+' .dr-tile.warn .b{color:#9f1239}'
 +S+' .dr-tile.amber{background:#fffbeb;border:1px solid #fef3c7}'
 +S+' .dr-tile.amber .t{color:#b45309}'+S+' .dr-tile.amber .b{color:#78350f}'
 +S+' .dr-tile.gr{background:#ecfdf5;border:1px solid #d1fae5}'
 +S+' .dr-tile.gr .t{color:#047857}'+S+' .dr-tile.gr .b{color:#064e3b}'
 +S+' .dr-tile .rr{text-align:right}'+S+' .dr-tile .rr .t{font-size:10px;font-weight:500}'
 +S+' .dr-tile .rr .b{font-size:14px;color:var(--dind)}'
 +S+' .dr-donut{position:relative;height:196px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}'
 +S+' .dr-mid{position:absolute;display:flex;flex-direction:column;align-items:center;pointer-events:none;top:50%;left:50%;transform:translate(-50%,-50%)}'
 +S+' .dr-mid b{font-size:26px;font-weight:800;color:var(--di);line-height:1}'
 +S+' .dr-mid span{font-size:10px;color:var(--df);text-transform:uppercase;letter-spacing:.09em;font-weight:700;margin-top:3px}'
 +S+' .dr-lg{display:flex;flex-direction:column;gap:7px;font-size:12px}'
 +S+' .dr-lg .li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:12px;background:#f9fafb}'
 +S+' .dr-lg .li .n{display:flex;align-items:center;gap:8px;font-weight:500;color:#374151;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .dr-lg .li i{width:10px;height:10px;border-radius:50%;font-style:normal;flex:none}'
 +S+' .dr-lg .li b{font-weight:700;color:var(--di);white-space:nowrap}'
 +S+' .dr-ins{border-radius:24px;padding:22px;color:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;min-height:246px;'
   +'background:linear-gradient(135deg,#f97316 0%,#f59e0b 50%,#ea580c 100%);box-shadow:0 20px 25px -5px rgba(249,115,22,.25)}'
 +S+' .dr-ins.g2{background:linear-gradient(135deg,#4f46e5 0%,#8b5cf6 50%,#6366f1 100%);box-shadow:0 20px 25px -5px rgba(79,70,229,.25)}'
 +S+' .dr-ins .blob1{position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.1);filter:blur(18px)}'
 +S+' .dr-ins .blob2{position:absolute;left:-40px;bottom:-40px;width:160px;height:160px;border-radius:50%;background:rgba(0,0,0,.1);filter:blur(18px)}'
 +S+' .dr-ins .z{position:relative;z-index:1}'
 +S+' .dr-ins .tp{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}'
 +S+' .dr-ins .cp{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.2);border-radius:999px;padding:5px 12px;font-size:11px;font-weight:600}'
 +S+' .dr-ins h3{margin:8px 0 0;font-size:17px;font-weight:700;line-height:1.4}'
 +S+' .dr-ins p{margin:8px 0 0;font-size:12px;line-height:1.65;color:#ffedd5}'
 +S+' .dr-ins.g2 p{color:#e0e7ff}'+S+' .dr-ins p b{color:#fff;font-weight:700}'
 +S+' .dr-rts{display:grid;grid-template-columns:repeat(auto-fit,minmax(228px,1fr));gap:14px}'
 +S+' .dr-rc{border-radius:20px;background:#f9fafb;padding:15px}'
 +S+' .dr-rc .h{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--di);margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .dr-rc .h i{width:10px;height:10px;border-radius:50%;font-style:normal;flex:none}'
 +S+' .dr-rc .m{display:flex;justify-content:space-between;font-size:11.5px;color:var(--dm);padding:3px 0}'
 +S+' .dr-rc .m b{color:var(--di);font-weight:700}'+S+' .dr-rc .dr-trk{margin-top:9px;height:8px}'
 +S+' .dr-tbl{width:100%;border-collapse:collapse;text-align:left}'
 +S+' .dr-tbl thead th{font-size:11px;font-weight:600;color:var(--df);text-transform:uppercase;letter-spacing:.05em;padding:11px 13px;border-bottom:1px solid var(--dl);white-space:nowrap}'
 +S+' .dr-tbl tbody td{font-size:12px;color:#374151;padding:12px 13px;border-bottom:1px solid #f9fafb}'
 +S+' .dr-tbl tbody tr:hover td{background:rgba(249,250,251,.8)}'
 +S+' .dr-tbl th.c,'+S+' .dr-tbl td.c{text-align:center}'
 +S+' .dr-tbl th.r,'+S+' .dr-tbl td.r{text-align:right}'
 +S+' .dr-ag{display:flex;align-items:center;gap:9px}'
 +S+' .dr-ag .sq{width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none}'
 +S+' .dr-ag b{display:block;font-weight:700;color:var(--di);font-size:12.5px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +S+' .dr-ag span{display:block;font-size:10px;color:var(--df);margin-top:1px}'
 +S+' .dr-z0{color:#d1d5db}'
 +S+' .dr-tag{padding:4px 9px;border-radius:12px;font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-block}'
 +S+' .dr-mono{font-family:\'DM Mono\',ui-monospace,monospace;font-variant-numeric:tabular-nums}'
 +S+' .dr-sum{margin-top:20px;padding-top:15px;border-top:1px solid var(--dl);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;font-size:12px}'
 +S+' .dr-sum .l{display:flex;flex-wrap:wrap;gap:14px;color:var(--dm)}'
 +S+' .dr-sum .l b{color:var(--di);font-weight:700}'
 +S+' .dr-sum .r span{color:var(--dm)}'
 +S+' .dr-sum .r b{font-size:17px;font-weight:800;color:var(--dem7);margin-left:6px}'
 +S+' .dr-legrow{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--dm);margin-top:12px;align-items:center}'
 +S+' .dr-legrow span{display:inline-flex;align-items:center;gap:6px}'
 +S+' .dr-legrow i{width:9px;height:9px;border-radius:3px;font-style:normal}'
 +S+' .dr-legrow b{color:var(--di)}'
 +S+' .dr-empty{padding:40px;text-align:center;color:var(--df);font-size:13px}'
 +S+' .dr-seg{display:inline-flex;gap:3px;background:#f3f4f6;padding:3px;border-radius:13px}'
 +S+' .dr-seg button{border:none;background:none;font:inherit;font-size:11.5px;font-weight:700;color:var(--dm);'
   +'padding:6px 12px;border-radius:10px;cursor:pointer;white-space:nowrap}'
 +S+' .dr-seg button:hover{color:var(--di)}'
 +S+' .dr-seg button.on{background:#fff;color:var(--di);box-shadow:0 1px 2px rgba(0,0,0,.08)}'
 +'#dr-mail-host .dr-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:900}'
 +'#dr-mail-host .dr-modal{position:fixed;inset:24px;z-index:901;background:#fff;border-radius:22px;'
   +'box-shadow:0 30px 70px -20px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;'
   +'font-family:inherit;color:#1f2937;max-width:1240px;margin:0 auto}'
 +'#dr-mail-host .dr-mh{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;'
   +'padding:18px 22px;border-bottom:1px solid #f1f2f4;flex:none}'
 +'#dr-mail-host .dr-mh b{display:block;font-size:16px;font-weight:800;color:#111827}'
 +'#dr-mail-host .dr-mh span{display:block;font-size:11.5px;color:#6b7280;margin-top:3px}'
 +'#dr-mail-host .dr-x{width:34px;height:34px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;'
   +'cursor:pointer;font-size:14px;color:#6b7280;flex:none}'
 +'#dr-mail-host .dr-mb{flex:1;display:grid;grid-template-columns:400px 1fr;gap:0;min-height:0}'
 +'#dr-mail-host .dr-mform{padding:18px 22px;overflow:auto;border-right:1px solid #f1f2f4;display:flex;flex-direction:column;gap:13px}'
 +'#dr-mail-host .dr-mform label{display:block;font-size:11.5px;font-weight:700;color:#6b7280}'
 +'#dr-mail-host .dr-mform input,#dr-mail-host .dr-mform textarea{display:block;width:100%;margin-top:5px;'
   +'padding:9px 12px;border:1px solid #e5e7eb;border-radius:12px;font:inherit;font-size:13px;color:#111827;outline:none;resize:vertical}'
 +'#dr-mail-host .dr-mform input:focus,#dr-mail-host .dr-mform textarea:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.12)}'
 +'#dr-mail-host .dr-mchk{border:1px solid #f1f2f4;border-radius:14px;padding:12px 14px;background:#f9fafb}'
 +'#dr-mail-host .dr-mchk .lb{display:block;font-size:11.5px;font-weight:700;color:#6b7280;margin-bottom:8px}'
 +'#dr-mail-host .dr-mchk .ck{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:500;'
   +'color:#374151;padding:4px 0;cursor:pointer}'
 +'#dr-mail-host .dr-mchk input{width:auto;margin:0}'
 +'#dr-mail-host .dr-mact{display:flex;flex-direction:column;gap:8px}'
 +'#dr-mail-host .dr-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;'
   +'padding:11px 14px;border-radius:14px;font:inherit;font-size:12.5px;font-weight:700;color:#374151;'
   +'border:1px solid #e5e7eb;cursor:pointer}'
 +'#dr-mail-host .dr-btn:hover{background:#f9fafb}'
 +'#dr-mail-host .dr-btn.pri{background:#111827;color:#fff;border-color:#111827}'
 +'#dr-mail-host .dr-mhint{font-size:11px;color:#9ca3af;line-height:1.7;margin:0}'
 +'#dr-mail-host .dr-mprev{display:flex;flex-direction:column;min-height:0;background:#f3f4f6}'
 +'#dr-mail-host .dr-mprev .lb{padding:11px 18px;font-size:11.5px;font-weight:700;color:#6b7280;'
   +'border-bottom:1px solid #e5e7eb;background:#fff;flex:none}'
 +'#dr-mail-host iframe{flex:1;width:100%;border:none;background:#f3f4f6}'
 +'#dr-mail-host .dr-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:#111827;'
   +'color:#fff;padding:10px 18px;border-radius:999px;font-size:12.5px;font-weight:600;opacity:0;'
   +'transition:opacity .25s;pointer-events:none;z-index:5}'
 +'@media print{#dr-mail-host{display:none!important}}'
 +S+' .dr-cfg{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dm)}'
 +S+' .dr-cfg input{width:64px;padding:4px 8px;border:1px solid var(--dl2);border-radius:9px;font:inherit;font-size:11.5px;font-weight:700;text-align:right;color:var(--di)}'
 +'@media print{'+S+'{background:#fff;margin:0;padding:0}'
   +S+' .dr-noprint{display:none!important}'
   +S+' .eg{box-shadow:none;border:1px solid #e5e7eb;break-inside:avoid}'
   +S+' .dr-main{grid-template-columns:1.7fr 1fr}'
   +S+' .dr-kpis{grid-template-columns:repeat(4,1fr)}'
   +S+' .dr-tbl{font-size:8.6px}'+S+' .dr-tbl td{padding:4px 6px}'+S+' .dr-tbl th{padding:6px}'
   +S+' .dr-ins{break-inside:avoid}'
   +S+' .dr-k,'+S+' .dr-rc,'+S+' .dr-tile{break-inside:avoid}'
   // การ์ดใหญ่ต้องไหลข้ามหน้าได้ ไม่งั้นกระโดดทั้งใบแล้วหน้าก่อนหน้าโล่งครึ่งหน้า
   +S+' .eg{break-inside:auto}'
   +S+' .dr-tbl tr{break-inside:avoid}'+S+' .dr-tbl thead{display:table-header-group}'
   // ตอนสั่งพิมพ์ · ซ่อนเมนูซ้าย/ป้ายลอย/หน้าอื่น แล้วปล่อยรายงานกินกระดาษเต็มใบ
   +'body.dr-printing .sidebar{display:none!important}'
   +'body.dr-printing .app{display:block!important}'
   +'body.dr-printing .main{display:block!important;margin:0!important;padding:0!important;'
     +'width:100%!important;max-width:none!important;overflow:visible!important}'
   +'body.dr-printing .view:not(#view-dailyreport){display:none!important}'
   +'body.dr-printing #view-dailyreport{display:block!important;padding-bottom:0!important}'
   +'body.dr-printing #la-userbadge,body.dr-printing #la-viewonly,body.dr-printing #la-refresh,'
     +'body.dr-printing .topbar{display:none!important}'
   +'body.dr-printing{background:#fff!important;margin:0!important;padding:0!important}'
   +'@page{size:A4 landscape;margin:9mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
}
// ── ชิ้นส่วนที่ใช้ซ้ำ ────────────────────────────────────────────────────
function drK(cls, ico, lb, val, unit, unitCls, sub, subCls, ftHtml){
  return '<div class="eg p5 dr-k"><div class="r1"><div><p class="lb">'+lb+'</p>'
    +'<div class="big"><b>'+val+'</b>'+(unit?('<em class="'+(unitCls||'')+'">'+unit+'</em>'):'')+'</div>'
    +(sub?('<p class="sm '+(subCls||'')+'">'+sub+'</p>'):'')+'</div>'
    +'<div class="ico '+cls+'">'+ico+'</div></div>'
    +(ftHtml?('<div class="ft">'+ftHtml+'</div>'):'')+'</div>';
}
function drBar(name, dotColor, valHtml, segs, l1, l2){
  var t='';
  segs.forEach(function(g){ if(g.w>0) t+='<i style="width:'+g.w.toFixed(2)+'%;background:'+g.c+'"></i>'; });
  return '<div class="dr-b"><div class="dr-bl"><span class="n">'+(dotColor?('<i style="background:'+dotColor+'"></i>'):'')+name+'</span>'
    +'<span class="v">'+valHtml+'</span></div><div class="dr-trk">'+t+'</div>'
    +((l1||l2)?('<div class="dr-bs"><span>'+(l1||'')+'</span><span>'+(l2||'')+'</span></div>'):'')+'</div>';
}
function drTile(cls, t, b, right){
  return '<div class="dr-tile '+(cls||'')+'"><div><p class="t">'+t+'</p><p class="b">'+b+'</p></div>'+(right||'')+'</div>';
}
function drInitials(nm){
  var w=String(nm||'').replace(/[^A-Za-z฀-๿ ]/g,' ').trim().split(/\s+/);
  if(!w[0]) return '—';
  return (w.length>1 ? (w[0].charAt(0)+w[1].charAt(0)) : w[0].slice(0,2)).toUpperCase();
}
function drSq(color, nm){
  var c=color||'#94a3b8';
  return '<span class="dr-ag"><span class="sq" style="background:'+c+'1f;color:'+c+'">'+ckEsc(drInitials(nm))+'</span>';
}

// ══ แท็บ 1 · ภาพรวม ══════════════════════════════════════════════════════
function drPaneOv(D){
  var e=ckEsc, bkMode=(_drTrendMode==='booked');
  var T=bkMode ? drTrendBooked(D.date, 14) : drTrend(D.date, 14, 2);
  var kp=''
   + drK('blue','&#128101;','ผู้โดยสารทั้งวัน', D.pax.tot, 'คน','g',
       'ผู้ใหญ่ '+D.pax.ad+' · เด็ก '+D.pax.chd+' · ทารก '+D.pax.inf+' · FOC '+D.pax.foc,'',
       '<span>ไทย <b>'+D.pax.th+'</b></span><span class="sep">|</span><span>ต่างชาติ <b>'+D.pax.fr+'</b></span>'
       +'<span class="sep">|</span><span>'+D.rOrder.length+' เส้นทาง</span>'
       /* §ovnDaily · ในยอดรวมมีคนที่กลับจากเกาะปนอยู่ · บอกไว้ ไม่งั้นเทียบกับยอดขายแล้วงง */
       +(D.ovn.pax?('<span class="sep">|</span><span title="ค้างคืนบนเกาะ · วันนี้เรือไปรับกลับ · รายได้ลงไปแล้ววันขาไป">&#8617; รับกลับ <b>'+D.ovn.pax+'</b></span>'):''))
   + drK('em','&#128176;','รายได้ทั้งวัน', drB(D.rev),'','',
       'เฉลี่ย '+drB(D.paxPay?D.rev/D.paxPay:0)+' / คน'+(D.ovn.pax?(' (จาก '+D.paxPay+' คน · ไม่รวมรับกลับ)'):''),'ok',
       '<span>Invoice <b>'+drK2(D.pay.invoice)+'</b></span><span class="sep">|</span>'
       +'<span>PFM <b>'+drK2(D.pay.proforma)+'</b></span><span class="sep">|</span>'
       +'<span>COT <b>'+drK2(D.pay.cot)+'</b></span>')
   + drK('pu','&#128676;','ที่นั่งเรือที่ใช้', drPct(D.seatTot,D.capTot)+'%','เฉลี่ย','i',
       D.seatTot+' ที่นั่ง จากความจุ '+D.capTot+' · '+D.bOrder.length+' ลำ','',
       (D.bOrder.length
         ? ('<span>เต็มสุด <b style="color:#047857">'+e(D.boats[D.bOrder[0]].name)+' '+drPct(D.boats[D.bOrder[0]].pax,D.boats[D.bOrder[0]].cap)+'%</b></span>'
           +(D.bOrder.length>1?('<span class="sep">|</span><span>ว่างสุด <b style="color:#4f46e5">'+e(D.boats[D.bOrder[D.bOrder.length-1]].name)+' '+drPct(D.boats[D.bOrder[D.bOrder.length-1]].pax,D.boats[D.bOrder[D.bOrder.length-1]].cap)+'%</b></span>'):''))
         : '<span>ยังไม่จัดเรือ</span>'))
   + drK('or','&#128656;','ต้นทุนรถรับส่ง', drB(D.perPax),'/ คน','g',
       D.vanIn+' คันในโควตา'+(D.vanOut?(' · นอกโควตา '+D.vanOut):'')+' · รับส่ง '+D.vanPax+' คน','',
       '<span>ค่ารถรวม <b>'+drB(D.vanCost)+'</b></span>'
       +(D.vanOut?'<span style="color:#be123c;font-weight:600">เกินโควตา</span>':'<span style="color:#047857;font-weight:500">อยู่ในโควตา</span>'));

  // แถบเส้นทาง
  var rts=D.rOrder.map(function(id){ var r=D.routes[id], pc=drPct(r.seats,r.cap);
    return '<div class="dr-rc"><div class="h"><i style="background:'+r.color+'"></i>'+e(r.name)+'</div>'
      +'<div class="m"><span>ผู้โดยสาร</span><b>'+r.pax+' คน</b></div>'
      +'<div class="m"><span>booking</span><b>'+r.n+' ใบ</b></div>'
      +'<div class="m"><span>รายได้</span><b>'+drB(r.rev)+'</b></div>'
      +'<div class="m"><span>ที่นั่ง</span><b>'+r.seats+' / '+(r.cap||'—')+(r.cap?(' · '+pc+'%'):'')+'</b></div>'
      +'<div class="dr-trk"><i style="width:'+Math.min(100,pc)+'%;background:linear-gradient(90deg,'+r.color+'66,'+r.color+')"></i></div></div>'; }).join('');

  // โดนัทกลุ่มตลาด
  var items=D.mOrder.slice(0,7).map(function(id){ var m=D.mkt[id]; return {v:m.pax,c:m.color,n:m.name}; });
  var leg=items.map(function(it){ return '<div class="li"><span class="n"><i style="background:'+it.c+'"></i>'+e(it.n)+'</span>'
      +'<b>'+it.v+' คน ('+drPct(it.v,D.pax.tot)+'%)</b></div>'; }).join('');

  // สิ่งที่ต้องเคลียร์
  var W=[];
  if(D.warn.noVan) W.push(['warn','ยังไม่จัดรถ',D.warn.noVan+' booking · '+D.noVan.pax+' คน','r','&#9888; ต้องจัด']);
  if(D.warn.noBoat) W.push(['warn','ยังไม่จัดเรือ',D.warn.noBoat+' booking · '+D.noBoat.pax+' คน','r','&#9888; ต้องจัด']);
  if(D.warn.over) W.push(['warn','เรือเกินความจุ',D.warn.over+' ลำ','r','&#9888;']);
  if(D.ret.todo) W.push(['warn','ส่งคนละที่ · ยังไม่จัดรถกลับ',D.ret.todo+' booking · '+D.ret.todoPax+' คน','r','&#9888;']);
  if(D.warn.doc) W.push(['amber','เอกสารยังไม่ครบ',D.warn.doc+' booking','a','รอตรวจ']);
  if(D.due>0) W.push(['amber','ยอดที่ต้องเก็บหน้างาน',drB(D.due),'a','ก่อนปิดวัน']);
  if(D.noSlip) W.push(['amber','ยังไม่มีสลิปโอนเงิน',D.noSlip+' รายการ','a','&#9888;']);
  if(!W.length) W.push(['gr','ไม่มีรายการค้าง','ทุกอย่างพร้อมเดินทาง','e','&#10003; เรียบร้อย']);
  var half=Math.ceil(W.length/2);
  var wcol=function(a){ return a.map(function(w){ return drTile(w[0], e(w[1]), e(w[2]),
      '<span class="dr-chip '+w[3]+'">'+w[4]+'</span>'); }).join(''); };

  var top=D.bOrder.length?D.boats[D.bOrder[0]]:null;
  var m1=D.mOrder.length?D.mkt[D.mOrder[0]]:null;
  var insight='<h3>'+(top?(e(top.name)+' ขายไปแล้ว '+drPct(top.pax,top.cap)+'%'
      +(top.cap>top.pax?(' · เหลืออีก '+(top.cap-top.pax)+' ที่นั่ง'):' · เต็มลำแล้ว')):'ยังไม่จัดเรือของวันนี้')+'</h3>'
    +'<p>'+(m1?('กลุ่ม <b>'+e(m1.name)+'</b> ครองสัดส่วนสูงสุด '+drPct(m1.pax,D.pax.tot)+'% ของทั้งวัน '):'')
    +'รายได้รวม <b>'+drB(D.rev)+'</b>'
    +((D.warn.noVan||D.warn.noBoat)?(' ยังมี <b>'+(D.warn.noVan?(D.warn.noVan+' ใบที่ยังไม่จัดรถ'):'')
        +((D.warn.noVan&&D.warn.noBoat)?' และ ':'')+(D.warn.noBoat?(D.warn.noBoat+' ใบยังไม่จัดเรือ'):'')+'</b> ต้องเคลียร์ก่อนปิดวัน'):' ทุกอย่างจัดครบแล้ว')+'</p>';

  // เทียบ 7 วันก่อน
  var pv=new Date(D.date+'T12:00:00'); pv.setDate(pv.getDate()-7);
  var P7=drData(pv.toISOString().slice(0,10));
  var cmp=function(lb,now,was,fmt,unit){
    var d=(was>0)?Math.round((now-was)/was*1000)/10:null;
    var up=(d!=null&&d>=0);
    return drTile(d==null?'':(up?'gr':''), e(lb), fmt(now),
      '<div class="rr"><p class="t">สัปดาห์ก่อน '+fmt(was)+'</p><p class="b" style="color:'+(up?'#047857':'#be123c')+'">'
      +(d==null?'—':((up?'+':'')+d+'%'))+'</p></div>');
  };

  return '<div class="dr-kpis">'+kp+'</div>'
   +'<div class="dr-main"><div class="dr-col">'
     +'<div class="eg p6"><div class="dr-hd"><div>'
       +'<h2>'+(bkMode?'ยอดที่รับเข้ามา · ตามวันที่ลงบุคกิ้ง · 14 วันย้อนหลัง'
                      :'ผู้โดยสาร · ตามวันเดินทาง · 14 วัน')+'</h2>'
       +'<p>'+(bkMode
           ? 'นับจากวันที่ลงบุคกิ้งในระบบ (bookingDate) — ใช้ดูจังหวะการขายว่าแต่ละวันรับงานเข้ามาเท่าไหร่ · หนึ่งใบนับ pax ของทุกทริปในใบนั้น'
           : 'นับจากวันเดินทางของแต่ละใบ — ใช้วางแผนเรือ/รถล่วงหน้า · <b>ไม่ใช่</b>วันที่ลงบุคกิ้ง')
         +' · แยกชั้นสีตาม Market · ตัวเลขบนยอดคือรวมทั้งวัน · ชี้เมาส์ดูแยกทีละตลาด</p></div>'
       +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
         +'<div class="dr-seg dr-noprint">'
           +'<button class="'+(bkMode?'':'on')+'" onclick="drTrendMode(\'travel\')">วันเดินทาง</button>'
           +'<button class="'+(bkMode?'on':'')+'" onclick="drTrendMode(\'booked\')">วันที่ลงบุคกิ้ง</button>'
         +'</div>'
         +'<span class="dr-chip i">'+(bkMode?('รับเข้ามาวันนี้ '+((T.pts[T.pts.length-1]||{}).tot||0)+' คน')
                                            :('เดินทางวันนี้ '+D.pax.tot+' คน'))+'</span></div></div>'
       +'<div style="height:300px;padding:0 2px">'+drChart(T)+'</div>'
       +'<div class="dr-legrow">'+T.keys.map(function(k){ var m=T.mkt[k]||{};
           return '<span><i style="background:'+(m.color||'#94a3b8')+'"></i>'+e(m.name||k)+'</span>'; }).join('')
         +'<span style="margin-left:auto">'+(bkMode?'รับเข้ามารวม 14 วัน':'เดินทางรวม 14 วัน')+' <b>'
           +T.pts.reduce(function(a,p){return a+p.tot;},0)+' คน</b></span></div></div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>แยกตามเส้นทาง</h2>'
       +'<p>คน · booking · รายได้ · ที่นั่งเรือของแต่ละโปรแกรม</p></div>'
       +'<span class="dr-chip n">'+D.rOrder.length+' เส้นทาง · '+D.rows.length+' booking</span></div>'
       +(rts?('<div class="dr-rts">'+rts+'</div>'):'<div class="dr-empty">ไม่มี booking ในวันนี้</div>')+'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>สิ่งที่ต้องเคลียร์ก่อนปิดวัน</h2>'
       +'<p>รายการที่ยังค้างอยู่ในวันนี้</p></div><span class="dr-chip '+(W[0][0]==='gr'?'e':'r')+'">'+W.length+' เรื่อง</span></div>'
       +'<div class="dr-duo" style="gap:14px"><div>'+wcol(W.slice(0,half))+'</div><div>'+wcol(W.slice(half))+'</div></div></div>'
   +'</div><div class="dr-col">'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">สัดส่วนลูกค้า</h2></div><span class="rt">แบ่งตาม Market</span></div>'
       +'<div class="dr-donut">'+drDonut(items, D.pax.tot, 'Total pax')+'</div>'
       +'<div class="dr-lg">'+(leg||'<div class="dr-empty">ไม่มีข้อมูล</div>')+'</div></div>'
     +'<div class="dr-ins"><div class="blob1"></div><div class="blob2"></div><div class="z">'
       +'<div class="tp"><span class="cp">&#128161; ข้อสังเกตของวัน</span></div>'+insight+'</div></div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">เทียบกับ 7 วันก่อน</h2></div><span class="rt">วันเดียวกันสัปดาห์ที่แล้ว</span></div>'
       +cmp('ผู้โดยสาร', D.pax.tot, P7.pax.tot, function(v){ return v+' คน'; })
       +cmp('รายได้', D.rev, P7.rev, function(v){ return drB(v); })
       +cmp('ที่นั่งเรือที่ใช้', drPct(D.seatTot,D.capTot), drPct(P7.seatTot,P7.capTot), function(v){ return v+'%'; })
     +'</div>'
   +'</div></div>';
}
function drK2(n){ n=+n||0; return n>=1000 ? ('฿'+(Math.round(n/100)/10)+'k') : ('฿'+Math.round(n).toLocaleString('en-US')); }
// ══ แท็บ 2 · ผู้โดยสาร ═══════════════════════════════════════════════════
function drPanePx(D){
  var e=ckEsc, P=D.pax;
  var special=P.tot?0:0;
  var mealTot=D.meals.veg+D.meals.vegan+D.meals.halal;
  var lk=Object.keys(D.langs).sort(function(a,b){ return D.langs[b]-D.langs[a]; });
  var lmax=lk.length?D.langs[lk[0]]:1;
  var LC={EN:'#c4b5fd',RU:'#8b5cf6',CN:'#a78bfa',TH:'#ddd6fe'};
  var kp=''
   + drK('blue','&#128101;','ผู้โดยสารทั้งวัน', P.tot, 'คน','g',
       'จาก '+D.rows.length+' booking · '+D.rOrder.length+' เส้นทาง','',
       '<span>เฉลี่ย <b>'+(D.rows.length?(Math.round(P.tot/D.rows.length*10)/10):0)+' คน/ใบ</b></span>'
       +'<span class="sep">|</span><span>ใบใหญ่สุด <b>'+D.rows.reduce(function(a,r){ var n=drPaxOf(r.t).tot; return n>a?n:a; },0)+' คน</b></span>')
   + drK('te','&#128106;','แยกตามประเภท', P.ad, 'ผู้ใหญ่','g',
       'เด็ก '+P.chd+' · ทารก '+P.inf+' · FOC '+P.foc,'',
       '<span>เด็ก <b>'+drPct(P.chd,P.tot)+'%</b></span><span class="sep">|</span><span>FOC <b>'+drPct(P.foc,P.tot)+'%</b></span>')
   + drK('pu','&#127760;','สัญชาติ', P.fr, 'ต่างชาติ','g',
       'ไทย '+P.th+' คน'+(P.un?(' · ยังไม่ระบุ '+P.un+' คน'):''),(P.un?'bad':''),
       '<span>ต่างชาติ <b>'+drPct(P.fr,P.tot)+'%</b></span><span class="sep">|</span>'
       +'<span>ไทย <b>'+drPct(P.th,P.tot)+'%</b></span>'
       +(P.un?('<span class="sep">|</span><span style="color:#be123c">ไม่ระบุ <b>'+P.un+'</b></span>'):''))
   + drK('ro','&#9888;','ต้องดูแลพิเศษ', (mealTot+D.meals.allergy), 'รายการ',(mealTot+D.meals.allergy)?'r':'g',
       'อาหารพิเศษ '+mealTot+' · แพ้อาหาร '+D.meals.allergy, (D.meals.allergy?'bad':''),
       lk.length ? lk.slice(0,3).map(function(k){ return '<span>'+e(k)+' <b>'+D.langs[k]+'</b></span>'; }).join('<span class="sep">|</span>')
                 : '<span>ไม่มีภาษาที่ต้องจัดไกด์</span>');

  // ประเภทรายเส้นทาง
  var bars=D.rOrder.map(function(id){
    var r=D.routes[id], ad=0,chd=0,inf=0,foc=0;
    D.rows.forEach(function(x){ if(x.routeId!==id) return; var p=drPaxOf(x.t); ad+=p.ad;chd+=p.chd;inf+=p.inf;foc+=p.foc; });
    var t=ad+chd+inf+foc||1;
    var segs=[{w:ad/t*100,c:r.color},{w:chd/t*100,c:r.color+'99'},{w:inf/t*100,c:r.color+'66'},{w:foc/t*100,c:r.color+'33'}];
    var det=[]; if(ad)det.push('ผู้ใหญ่ '+ad); if(chd)det.push('เด็ก '+chd); if(inf)det.push('ทารก '+inf); if(foc)det.push('FOC '+foc);
    return drBar(e(r.name), r.color, r.pax+' คน', segs, det.join(' · '), r.n+' booking');
  }).join('');

  // ตารางผู้โดยสาร
  var body=D.rows.map(function(r){
    var b=r.b, p=drPaxOf(r.t), m=drMarket(b);
    var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var agName=ag?(ag.name||ag.code||'—'):(b.channel||'walk-in');
    var agC=(b.agentId&&typeof bkV2AgentColor==='function')?bkV2AgentColor(b.agentId):'#64748b';
    var R=(typeof getRoute==='function'?getRoute(r.routeId):null)||{};
    var sb=(typeof tsSendBack==='function')?tsSendBack(b,D.date):null;
    var mm=b.specialMeals||{}, ml=[];
    if(+mm.veg) ml.push('มังสวิรัติ '+(+mm.veg));
    if(+mm.vegan) ml.push('วีแกน '+(+mm.vegan));
    if(+mm.halal) ml.push('ฮาลาล '+(+mm.halal));
    var al=String(mm.allergies||'').trim();
    var gd=b.guides||{}, lg=[];
    if(gd.english)lg.push('EN'); if(gd.russian)lg.push('RU'); if(gd.chinese)lg.push('CN');
    if(String(gd.otherLang||'').trim()) lg.push(String(gd.otherLang).trim());
    var cell=function(v){ return v ? ('<td class="c" style="font-weight:700">'+v+'</td>') : '<td class="c dr-z0">0</td>'; };
    return '<tr><td class="dr-mono" style="font-weight:700">'+e(b.voucherRef||b.code||'—')+'</td>'
      +'<td>'+drSq(agC,b.leadPax||agName)+'<span><b>'+e(b.leadPax||'—')+'</b><span>'+e(b.leadPhone||b.phone||'')+'</span></span></span></td>'
      +'<td><span class="dr-tag" style="background:'+agC+'1f;color:'+agC+'">'+e(agName)+'</span></td>'
      +cell(p.ad)+cell(p.chd)+cell(p.inf)+cell(p.foc)
      +'<td>'+e(R.name||r.routeId||'—')+'</td>'
      +'<td>'+e(b.hotelName||b.pickup||'—')+' · <b class="dr-mono">'+e((r.O&&r.O.pickupTimeFinal)||r.t.pickupTime||'—')+'</b></td>'
      +'<td>'+(sb?('<b>'+e(sb.t)+'</b>'):'<span class="dr-z0">จุดเดิม</span>')+'</td>'
      +'<td>'+(lg.length?lg.map(function(x){ return '<span class="dr-tag" style="background:#f5f3ff;color:#7c3aed">'+e(x)+'</span>'; }).join(' '):'<span class="dr-z0">—</span>')+'</td>'
      +'<td>'+(ml.length?('<span class="dr-tag" style="background:#d1fae5;color:#047857">'+e(ml.join(' · '))+'</span>'):'')
        +(al?('<span class="dr-tag" style="background:#ffe4e6;color:#be123c">&#9888; '+e(al)+'</span>'):'')
        +((!ml.length&&!al)?'<span class="dr-z0">—</span>':'')+'</td></tr>';
  }).join('');

  return '<div class="dr-kpis">'+kp+'</div>'
   +'<div class="dr-duo">'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ประเภทผู้โดยสารรายเส้นทาง</h2>'
       +'<p>ผู้ใหญ่ · เด็ก · ทารก · FOC</p></div></div>'
       +(bars||'<div class="dr-empty">ไม่มีข้อมูล</div>')+'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">อาหารพิเศษ · ภาษาไกด์</h2>'
       +'<p>สิ่งที่ครัวและไกด์ต้องเตรียมล่วงหน้า</p></div>'
       +'<span class="dr-chip '+((mealTot+D.meals.allergy)?'a':'n')+'">'+(mealTot+D.meals.allergy)+' รายการ</span></div>'
       +drTile('','มังสวิรัติ / วีแกน',(D.meals.veg+D.meals.vegan)+' คน','<span class="dr-chip e">&#127807; แจ้งครัว</span>')
       +drTile('','ฮาลาล',D.meals.halal+' คน','<span class="dr-chip e">&#127807; แจ้งครัว</span>')
       +drTile(D.meals.allergy?'warn':'','แพ้อาหาร',D.meals.allergy+' รายการ',
          '<span class="dr-chip '+(D.meals.allergy?'r':'n')+'">'+(D.meals.allergy?'&#9888; ต้องยืนยัน':'ไม่มี')+'</span>')
       +'<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--dl)">'
       +'<div class="dr-hd" style="margin-bottom:12px"><div><h2 class="sm">ภาษาไกด์ที่ต้องใช้</h2></div></div>'
       +(lk.length?lk.map(function(k){ return drBar(e(k), LC[k]||'#a78bfa', D.langs[k]+' คน',
           [{w:D.langs[k]/lmax*100,c:LC[k]||'#a78bfa'}], '', ''); }).join('')
         :'<div class="dr-empty">ไม่มีภาษาที่ต้องจัดไกด์</div>')+'</div></div>'
   +'</div>'
   +'<div class="eg p6"><div class="dr-hd"><div><h2>รายชื่อผู้โดยสารทั้งวัน</h2>'
     +'<p>เรียงตามเส้นทาง → Agency → Voucher · ข้อมูลที่ไกด์และคนขับต้องใช้</p></div>'
     +'<span class="dr-chip n">'+D.rows.length+' booking · '+P.tot+' คน</span></div>'
     +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
     +'<th>Voucher</th><th>Customer (lead)</th><th>Agency</th><th class="c">AD</th><th class="c">CHD</th>'
     +'<th class="c">INF</th><th class="c">FOC</th><th>Route</th><th>Pickup · Time</th><th>Drop-off</th>'
     +'<th>ภาษา</th><th>อาหารพิเศษ</th></tr></thead><tbody>'
     +(body||'<tr><td colspan="12" class="dr-empty">ไม่มี booking ในวันนี้</td></tr>')+'</tbody></table></div>'
     +'<div class="dr-sum"><div class="l"><span>ผู้ใหญ่ <b>'+P.ad+'</b></span><span>เด็ก <b>'+P.chd+'</b></span>'
       +'<span>ทารก <b>'+P.inf+'</b></span><span>FOC <b>'+P.foc+'</b></span>'
       +'<span>ไทย <b>'+P.th+'</b></span><span>ต่างชาติ <b>'+P.fr+'</b></span>'
       +(P.un?('<span>ยังไม่ระบุสัญชาติ <b style="color:#be123c">'+P.un+'</b></span>'):'')+'</div>'
     +'<div class="r"><span>รวมผู้โดยสารทั้งวัน</span><b style="color:#111827">'+P.tot+' คน</b></div></div></div>';
}
function drPierNm(p){ return DR_PIER_NM[p] || p || ''; }
function drPierTxt(b){
  if(!b) return '';
  var ks=(b.pierAll && b.pierAll.length) ? b.pierAll : (b.pier?[b.pier]:[]);
  if(!ks.length) return '';
  var txt=ks.map(drPierNm).join(' + ');
  if(b.moved && b.homePier) txt += ' (ย้ายจาก '+drPierNm(b.homePier)+')';
  return txt;
}

// ══ แท็บ 3 · เรือ ════════════════════════════════════════════════════════
function drPaneBt(D){
  var e=ckEsc;
  var piers={}; D.bOrder.forEach(function(id){ var b=D.boats[id]; var p=b.pier||'—'; piers[p]=1; });
  var PIER={tublamu:'Tub Lamu Pier', panwa:'Visit Panwa', ranong:'Ranong Pier'};
  var kp=''
   + drK('pu','&#128676;','เรือที่ออกวันนี้', D.bOrder.length, 'ลำ','g',
       Object.keys(piers).length+' ท่า · '+D.bOrder.map(function(id){ return e(D.boats[id].name); }).slice(0,3).join(' · '),'',
       '<span>booking <b>'+D.rows.length+'</b></span><span class="sep">|</span><span>ผู้โดยสาร <b>'+D.seatTot+'</b></span>')
   + drK('em','&#128101;','ที่นั่งที่ขายไปแล้ว', D.seatTot, '/ '+D.capTot,'g',
       'เฉลี่ย '+drPct(D.seatTot,D.capTot)+'% ของความจุรวม','',
       '<span>เหลือ <b>'+Math.max(0,D.capTot-D.seatTot)+' ที่นั่ง</b></span>'
       +(D.bOrder.length?('<span class="sep">|</span><span>เต็มสุด <b>'+e(D.boats[D.bOrder[0]].name)+' '+drPct(D.boats[D.bOrder[0]].pax,D.boats[D.bOrder[0]].cap)+'%</b></span>'):''))
   + drK('ro','&#9888;','ยังไม่จัดเรือ', D.noBoat.n, 'booking', D.noBoat.n?'r':'g',
       D.noBoat.n?('&#9888; '+D.noBoat.pax+' คน ยังไม่มีลำรองรับ'):'จัดครบทุกใบแล้ว', D.noBoat.n?'bad':'ok',
       '<span>เกินความจุ <b style="color:'+(D.warn.over?'#be123c':'#047857')+'">'+D.warn.over+' ลำ</b></span>'
       +'<span class="sep">|</span><span>ต้องเคลียร์ก่อนปิดวัน</span>')
   + drK('or','&#9973;','เรือหางยาว', D.ltChtr, 'ลำเหมา','g',
       'Join '+D.ltJoin+' คน · ต้นทุนเหมา '+drB(D.ltCost),'',
       '<span>Join <b>'+D.ltJoin+' คน</b></span><span class="sep">|</span><span>เหมา <b>'+D.ltChtr+' ลำ</b></span>');

  var bars=D.bOrder.map(function(id){ var b=D.boats[id], pc=drPct(b.pax,b.cap), over=(b.cap>0&&b.pax>b.cap);
    var col=over?'#e11d48':(pc>=80?'#10b981':(pc>=50?'#14b8a6':'#4f46e5'));
    var rn=Object.keys(b.routes).map(function(rid){ return ((typeof getRoute==='function'?getRoute(rid):null)||{}).name||rid; }).join(' · ');
    return drBar(e(b.name)+(b.type?(' · '+e(b.type)):''), col,
      b.pax+' / '+(b.cap||'—')+' <span>('+pc+'%)</span>',
      [{w:Math.min(100,pc),c:col}],
      e(rn)+(b.pier?(' · '+e(drPierTxt(b))):'')+(b.dep?(' · ออก '+e(b.dep)):''),
      over?('<b style="color:#be123c">&#9888; เกิน '+(b.pax-b.cap)+' ที่นั่ง</b>')
          :(b.cap>b.pax?('เหลือ '+(b.cap-b.pax)+' ที่นั่ง'):'เต็มลำ'));
  }).join('');

  var deps=D.bOrder.slice().sort(function(a,b){ return String(D.boats[a].dep||'99').localeCompare(String(D.boats[b].dep||'99')); })
    .map(function(id){ var b=D.boats[id], over=(b.cap>0&&b.pax>b.cap);
      var rn=Object.keys(b.routes).map(function(rid){ return ((typeof getRoute==='function'?getRoute(rid):null)||{}).name||rid; }).join(' · ');
      return drTile(over?'warn':'', e(drPierTxt(b)||'—')+' · '+e(b.dep||'—'),
        e(b.name)+' · '+e(rn),
        '<div class="rr"><p class="t">'+(over?'เกินความจุ':'ผู้โดยสาร')+'</p><p class="b"'+(over?' style="color:#be123c"':'')+'>'
        +b.pax+(over?(' / '+b.cap):' คน')+'</p></div>'); }).join('');

  var body=D.bOrder.map(function(id){ var b=D.boats[id], pc=drPct(b.pax,b.cap), over=(b.cap>0&&b.pax>b.cap);
    var col=over?'#e11d48':(pc>=80?'#047857':'#4f46e5');
    var rn=Object.keys(b.routes).map(function(rid){ return ((typeof getRoute==='function'?getRoute(rid):null)||{}).name||rid; }).join(' · ');
    return '<tr><td>'+drSq(col,b.name)+'<span><b>'+e(b.name)+'</b><span>'+e(b.type||'')+'</span></span></span></td>'
      +'<td>'+e(b.type||'—')+'</td><td>'+e(drPierTxt(b)||'—')+'</td>'
      +'<td class="c dr-mono">'+e(b.dep||'—')+'</td><td>'+e(rn)+'</td><td class="c">'+b.n+'</td>'
      +'<td class="c dr-mono">'+(b.cap||'—')+'</td>'
      +'<td class="c dr-mono" style="font-weight:700'+(over?';color:#be123c':'')+'">'+b.pax+'</td>'
      +'<td class="c dr-mono"'+(over?' style="color:#be123c"':'')+'>'+(b.cap?(b.cap-b.pax):'—')+'</td>'
      +'<td class="c" style="font-weight:700;color:'+col+'">'+(b.cap?(pc+'%'):'—')+'</td>'
      +'<td class="c">'+(over?'<span class="dr-tag" style="background:#ffe4e6;color:#be123c">&#9888; เกินความจุ</span>'
        :(pc>=80?'<span class="dr-tag" style="background:#d1fae5;color:#047857">ใกล้เต็ม</span>'
                :'<span class="dr-tag" style="background:#eff6ff;color:#2563eb">ยังรับได้</span>'))+'</td></tr>';
  }).join('');
  if(D.noBoat.n){
    body+='<tr style="opacity:.75"><td>'+drSq('#9ca3af','—')+'<span><b>ยังไม่จัดเรือ</b><span>'+D.noBoat.n+' booking</span></span></span></td>'
      +'<td class="dr-z0">—</td><td class="dr-z0">—</td><td class="c dr-z0">—</td><td class="dr-z0">—</td>'
      +'<td class="c">'+D.noBoat.n+'</td><td class="c dr-z0">—</td>'
      +'<td class="c dr-mono" style="font-weight:700;color:#be123c">'+D.noBoat.pax+'</td>'
      +'<td class="c dr-z0">—</td><td class="c dr-z0">—</td>'
      +'<td class="c"><span class="dr-tag" style="background:#ffe4e6;color:#be123c">&#9888; ต้องจัดเรือ</span></td></tr>';
  }

  return '<div class="dr-kpis">'+kp+'</div>'
   +'<div class="dr-duo">'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ที่นั่งรายลำ</h2><p>เรียงจากเต็มที่สุด</p></div></div>'
       +(bars||'<div class="dr-empty">ยังไม่จัดเรือของวันนี้</div>')+'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ท่าเรือ · เวลาออก</h2><p>ลำดับการออกเรือของวันนี้</p></div></div>'
       +(deps||'<div class="dr-empty">ไม่มีข้อมูล</div>')
       +(D.ltChtr?drTile('amber','เรือหางยาวเหมา', D.ltChtr+' ลำ',
           '<b style="font-size:13px;color:#78350f">-'+drB(D.ltCost)+'</b>'):'')+'</div>'
   +'</div>'
   +'<div class="eg p6"><div class="dr-hd"><div><h2>ตารางเรือทั้งวัน</h2>'
     +'<p>ความจุ · ที่ขายแล้ว · ที่เหลือ · เส้นทาง · สถานะ</p></div>'
     +'<span class="dr-chip n">'+D.bOrder.length+' ลำ · '+D.capTot+' ที่นั่ง</span></div>'
     +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
     +'<th>Boat</th><th>Type</th><th>Pier</th><th class="c">Depart</th><th>Route</th><th class="c">Booking</th>'
     +'<th class="c">Capacity</th><th class="c">Sold</th><th class="c">Left</th><th class="c">Load</th><th class="c">Status</th>'
     +'</tr></thead><tbody>'+(body||'<tr><td colspan="11" class="dr-empty">ไม่มีเรือของวันนี้</td></tr>')+'</tbody></table></div>'
     +'<div class="dr-sum"><div class="l"><span>ความจุรวม <b>'+D.capTot+' ที่นั่ง</b></span>'
       +'<span>ขายแล้ว <b>'+D.seatTot+'</b></span><span>เหลือ <b>'+Math.max(0,D.capTot-D.seatTot)+'</b></span>'
       +'<span>Load เฉลี่ย <b>'+drPct(D.seatTot,D.capTot)+'%</b></span></div>'
     +'<div class="r"><span>booking ที่ยังไม่จัดเรือ</span><b style="color:'+(D.noBoat.n?'#be123c':'#047857')+'">'
       +D.noBoat.n+' ใบ · '+D.noBoat.pax+' คน</b></div></div></div>';
}
// ══ แท็บ 4 · รถรับส่ง ════════════════════════════════════════════════════
function drPaneVn(D){
  var e=ckEsc, C=drCfg();
  var zmax=D.zOrder.length?D.zones[D.zOrder[0]].pax:1;
  var ZC=['#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe'];
  var kp=''
   + drK('or','&#128656;','รถที่ใช้วันนี้', D.nVan, 'คัน','g',
       'ในโควตา '+D.vanIn+' · นอกโควตา '+D.vanOut, D.vanOut?'bad':'',
       '<span>ค่ารถรวม <b>'+drB(D.vanCost)+'</b></span>'
       +(D.vanOut?'<span style="color:#be123c;font-weight:600">เกินโควตา</span>':'<span style="color:#047857;font-weight:500">อยู่ในโควตา</span>'))
   + drK('blue','&#128101;','คนที่ใช้รถรับส่ง', D.vanPax, '/ '+D.pax.tot+' คน','g',
       'มาเอง '+D.selfArr.pax+' คน ('+drPct(D.selfArr.pax,D.pax.tot)+'%)','',
       '<span>เฉลี่ย <b>'+(D.nVan?(Math.round(D.vanPax/D.nVan*10)/10):0)+' คน/คัน</b></span>'
       +'<span class="sep">|</span><span>ความจุรวม <b>'+D.vOrder.reduce(function(a,id){ return a+D.vans[id].cap; },0)+'</b></span>')
   + drK('em','&#128176;','ต้นทุนต่อหัว', drB(D.perPax), '/ คน','g',
       (D.perPax<=C.targetPerPax?'&#10003; ต่ำกว่าเป้า ':'&#9888; สูงกว่าเป้า ')+drB(C.targetPerPax),
       (D.perPax<=C.targetPerPax?'ok':'bad'),
       '<span class="dr-cfg dr-noprint" title="ใช้เฉพาะคันที่ยังไม่ได้ตั้งเรตในหน้า ต้นทุน › ราคาจริง">'
         +(D.vanEst?'ค่ารถ/คัน ':'สำรอง ฿/คัน ')+'<input value="'+C.vanCost+'" onchange="drCfgSet(\'vanCost\',this.value)"></span>'
       +'<span class="dr-cfg dr-noprint">โควตา <input value="'+C.vanQuota+'" onchange="drCfgSet(\'vanQuota\',this.value)"></span>'
       +(D.vanEst
          ? '<span class="dr-cfg dr-noprint" style="color:#b45309">ยังไม่มีเรตจริง · ใช้เลขเฉลี่ย</span>'
          : ('<span class="dr-cfg dr-noprint" style="color:#047857">เรตจริงรายคัน · แหล่งเดียวกับ P&amp;L</span>'
             +(D.vanNoRate?('<span class="dr-cfg dr-noprint" style="color:#b45309">'+D.vanNoRate+' คันยังไม่ตั้งเรต</span>'):''))))
   + drK('ro','&#9888;','ยังไม่จัดรถ', D.noVan.n, 'booking', D.noVan.n?'r':'g',
       D.noVan.n?('&#9888; '+D.noVan.pax+' คน · ต้องจัดก่อนปิดวัน'):'จัดครบทุกใบแล้ว', D.noVan.n?'bad':'ok',
       '<span>รถกลับยังไม่จัด <b style="color:'+(D.ret.todo?'#be123c':'#047857')+'">'+D.ret.todo+' ใบ</b></span>'
       +'<span class="sep">|</span><span>ส่งคนละที่ <b>'+(D.ret.todo+D.ret.arr)+' ใบ</b></span>');

  var zbars=D.zOrder.map(function(z0,i){ var z=D.zones[z0];
    return drBar(e(z.name), ZC[i%ZC.length], z.pax+' คน · '+Object.keys(z.vans).length+' คัน',
      [{w:z.pax/zmax*100,c:ZC[i%ZC.length]}],
      (z.first?('รับแรก '+e(z.first)+(z.last&&z.last!==z.first?(' · รับสุดท้าย '+e(z.last)):'')):''),
      z.n+' booking'); }).join('');

  var body=D.vOrder.map(function(id){ var v=D.vans[id], pc=drPct(v.pax,v.cap);
    var rd=(typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(id,D.date):{driver:'',phone:'',plate:v.plate};
    var col=(v.cap&&v.pax>v.cap)?'#be123c':(pc>=80?'#047857':'#4f46e5');
    var bts=Object.keys(v.boats).map(function(bid){ var B=(typeof getBoat==='function'?getBoat(bid):null)||{};
      return '<span class="dr-tag" style="background:#ecfdf5;color:#047857">'+e(B.name||bid)+'</span>'; }).join(' ');
    var zl=(typeof bkV2ZoneLabel==='function')?bkV2ZoneLabel(v.zone):v.zone;
    return '<tr><td>'+drSq('#8b5cf6',v.name)+'<span><b>'+e(v.name)+'</b><span>'+e(v.type||'')+(v.own==='partner'?' · รถร่วม':'')+'</span></span></span></td>'
      +'<td class="dr-mono">'+e(rd.plate||v.plate||'—')+'</td>'
      +'<td>'+e(rd.driver||'—')+(rd.phone?('<div style="font-size:10px;color:#9ca3af" class="dr-mono">'+e(rd.phone)+'</div>'):'')+'</td>'
      +'<td>'+e(zl||'—')+'</td><td class="c dr-mono">'+e(v.first||'—')+'</td><td class="c">'+v.n+'</td>'
      +'<td class="c dr-mono" style="font-weight:700">'+v.pax+'</td><td class="c dr-mono">'+(v.cap||'—')+'</td>'
      +'<td class="c" style="font-weight:700;color:'+col+'">'+(v.cap?(pc+'%'):'—')+'</td>'
      +'<td>'+(bts||'<span class="dr-z0">—</span>')+'</td>'
      +'<td class="r dr-mono" style="font-weight:700">'
        +drB((D.vanReal&&D.vanReal.byVan[id]!=null)?D.vanReal.byVan[id]:C.vanCost)
        +((D.vanReal&&D.vanReal.def[id])?'<div style="font-size:9px;font-weight:600;color:#b45309">ยังไม่ตั้งเรต</div>':'')
      +'</td></tr>';
  }).join('');
  if(D.noVan.n){
    body+='<tr style="opacity:.75"><td>'+drSq('#9ca3af','—')+'<span><b>ยังไม่จัดรถ</b><span>'+D.noVan.n+' booking</span></span></span></td>'
      +'<td class="dr-z0">—</td><td class="dr-z0">—</td><td class="dr-z0">—</td><td class="c dr-z0">—</td>'
      +'<td class="c">'+D.noVan.n+'</td>'
      +'<td class="c dr-mono" style="font-weight:700;color:#be123c">'+D.noVan.pax+'</td>'
      +'<td class="c dr-z0">—</td><td class="c dr-z0">—</td><td class="dr-z0">—</td><td class="r dr-z0">—</td></tr>';
  }

  return '<div class="dr-kpis">'+kp+'</div>'
   +'<div class="dr-duo">'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">แยกตามโซนรับ</h2>'
       +'<p>จำนวนคนที่ต้องรับในแต่ละโซนและเวลารับแรก</p></div></div>'
       +(zbars||'<div class="dr-empty">ไม่มีใบที่ต้องรับส่ง</div>')
       +drTile('','มาเองที่ท่าเรือ · ไม่ใช้รถ', D.selfArr.pax+' คน · '+D.selfArr.n+' booking',
          '<span class="dr-chip n">Self-arrive</span>')+'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">ขากลับ · จุดส่ง</h2>'
       +'<p>ใบที่ส่งคนละที่กับตอนรับ ต้องจัดรถกลับแยก</p></div>'
       +'<span class="dr-chip '+(D.ret.todo?'r':'n')+'">'+(D.ret.todo+D.ret.arr)+' ใบ</span></div>'
       +drTile('gr','ส่งจุดเดิม · ใช้รถคันเดิม', D.ret.same+' booking · '+D.ret.samePax+' คน',
          '<span class="dr-chip e">&#10003; ไม่ต้องจัดเพิ่ม</span>')
       +drTile('amber','ส่งคนละที่ · จัดรถกลับแล้ว', D.ret.arr+' booking · '+D.ret.arrPax+' คน',
          '<span class="dr-chip a">จัดแล้ว</span>')
       +drTile(D.ret.todo?'warn':'','ส่งคนละที่ · ยังไม่จัดรถกลับ', D.ret.todo+' booking · '+D.ret.todoPax+' คน',
          '<span class="dr-chip '+(D.ret.todo?'r':'n')+'">'+(D.ret.todo?'&#9888; ต้องจัด':'ไม่มี')+'</span>')
       +drTile('','กลับเอง · ลงท่าเรือ', D.ret.self+' booking · '+D.ret.selfPax+' คน',
          '<span class="dr-chip n">Self-return</span>')+'</div>'
   +'</div>'
   +'<div class="eg p6"><div class="dr-hd"><div><h2>ตารางรถรับส่ง</h2>'
     +'<p>คนขับ · ทะเบียน · โซน · เวลารับแรก · จำนวนคน · ส่งขึ้นเรือลำไหน · ต้นทุน</p></div>'
     +'<span class="dr-chip n">'+D.nVan+' คัน · '+D.vanPax+' คน</span></div>'
     +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
     +'<th>Van</th><th>ทะเบียน</th><th>คนขับ</th><th>โซน</th><th class="c">รับแรก</th><th class="c">Booking</th>'
     +'<th class="c">Pax</th><th class="c">ความจุ</th><th class="c">Load</th><th>ส่งขึ้นเรือ</th><th class="r">ต้นทุน</th>'
     +'</tr></thead><tbody>'+(body||'<tr><td colspan="11" class="dr-empty">ไม่มีรถของวันนี้</td></tr>')+'</tbody></table></div>'
     +'<div class="dr-sum"><div class="l"><span>รถในโควตา <b>'+D.vanIn+' คัน</b></span>'
       +'<span>นอกโควตา <b'+(D.vanOut?' style="color:#be123c"':'')+'>'+D.vanOut+' คัน</b></span>'
       +'<span>คนที่ใช้รถ <b>'+D.vanPax+' / '+D.pax.tot+'</b></span>'
       +'<span>เฉลี่ยต่อหัว <b>'+drB(D.perPax)+'</b></span></div>'
     +'<div class="r"><span>ค่ารถรวมทั้งวัน</span><b>'+drB(D.vanCost)+'</b></div></div></div>';
}

// ══ แท็บ 5 · การเงิน ═════════════════════════════════════════════════════
function drPaneFi(D){
  var e=ckEsc;
  var cost=D.vanCost+D.ltCost;
  var kp=''
   + drK('em','&#128176;','รายได้ทั้งวัน', drB(D.rev),'','',
       'เฉลี่ย '+drB(D.paxPay?D.rev/D.paxPay:0)+' / คน','ok',
       '<span>'+D.rows.length+' booking</span><span class="sep">|</span><span>'+D.pax.tot+' คน</span>')
   + drK('or','&#128179;','ต้องเก็บหน้างาน', drB(D.due), D.due>0?'ค้าง':'','r',
       D.due>0?('เก็บไปแล้ว '+drB(D.got)):'เก็บครบแล้ว', D.due>0?'bad':'ok',
       '<span>เก็บแล้ว <b>'+drB(D.got)+'</b></span><span class="sep">|</span>'
       +'<span>รอสลิป <b'+(D.noSlip?' style="color:#be123c"':'')+'>'+D.noSlip+'</b></span>')
   + drK('ro','&#128184;','ต้นทุนที่ทราบแล้ว', drB(cost),'','',
       'ค่ารถ '+drB(D.vanCost)+' · หางยาว '+drB(D.ltCost),'',
       '<span>ต่อหัว <b>'+drB(D.pax.tot?cost/D.pax.tot:0)+'</b></span>'
       +'<span class="sep">|</span><span>'+drPct(cost,D.rev)+'% ของรายได้</span>')
   + drK('pu','&#128717;','ขายเพิ่มหน้างาน', drB(D.extras+D.upDue+D.upGot), '&#9650; upsell','',
       'Add-on '+drB(D.extras)+' · upgrade '+drB(D.upDue+D.upGot),'',
       '<span>'+drPct(D.extras+D.upDue+D.upGot,D.rev)+'% ของรายได้</span><span class="sep">|</span>'
       +'<span>เฉลี่ย <b>'+drB(D.pax.tot?(D.extras+D.upDue+D.upGot)/D.pax.tot:0)+' / คน</b></span>');

  var CH=[['invoice','Invoice · เครดิต','#2563eb'],['proforma','Proforma · จ่ายล่วงหน้า','#8b5cf6'],
          ['cot','COT · เก็บหน้างาน','#f59e0b'],['transfer','โอนล่วงหน้า','#14b8a6'],['other','อื่น ๆ / ยังไม่ระบุ','#64748b']];
  var chBars=CH.filter(function(c){ return D.pay[c[0]]>0; }).map(function(c){
    var v=D.pay[c[0]], pc=drPct(v,D.rev);
    return drBar(e(c[1]), c[2], drB(v)+' <span>('+pc+'%)</span>', [{w:pc,c:c[2]}],
      '', (c[0]==='cot'&&D.due>0)?('<b style="color:#be123c">&#9888; ยังเก็บไม่ครบ '+drB(D.due)+'</b>'):''); }).join('');

  var rbody=D.rOrder.map(function(id){ var r=D.routes[id];
    return '<tr><td><span style="display:inline-flex;align-items:center;gap:8px">'
      +'<i style="width:10px;height:10px;border-radius:50%;background:'+r.color+';font-style:normal"></i>'
      +'<b>'+e(r.name)+'</b></span></td><td class="c">'+r.n+'</td><td class="c">'+r.pax+'</td>'
      +'<td class="r dr-mono" style="font-weight:700">'+drB(r.rev)+'</td>'
      +'<td class="r dr-mono">'+drB(r.pax?r.rev/r.pax:0)+'</td>'
      +'<td class="c" style="font-weight:700;color:'+r.color+'">'+drPct(r.rev,D.rev)+'%</td></tr>'; }).join('');

  // ตาม agent
  var AG={}, AO=[];
  D.rows.forEach(function(r){ var b=r.b;
    var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var key=b.agentId||('_'+(b.channel||'walk-in'));
    var nm=ag?(ag.name||ag.code||key):(b.channel||'Walk-in');
    if(!AG[key]){ AG[key]={k:key,name:nm,color:(b.agentId&&typeof bkV2AgentColor==='function')?bkV2AgentColor(b.agentId):'#64748b',
      mkt:drMarket(b),n:0,ad:0,chd:0,inf:0,foc:0,pax:0,rev:0,due:0,pay:'',doc:{verified:0,issue:0,pending:0,nofiles:0}}; AO.push(key); }
    var a=AG[key], p=drPaxOf(r.t);
    a.n++; a.ad+=p.ad; a.chd+=p.chd; a.inf+=p.inf; a.foc+=p.foc; a.pax+=p.tot; a.rev+=(+r.amount||0);
    var M=(typeof pckMoney==='function')?pckMoney(b,D.date):{};
    a.due+=(+M.due||0); if(!a.pay) a.pay=String(M.payType||'');
    var st=(typeof docCheckStatus==='function')?docCheckStatus(b):'nofiles';
    if(a.doc[st]==null) a.doc[st]=0; a.doc[st]++;
  });
  AO.sort(function(x,y){ return AG[y].rev-AG[x].rev; });
  var PT={invoice:['Invoice','#2563eb'],credit:['Invoice','#2563eb'],proforma:['Proforma','#8b5cf6'],
          prepaid:['Proforma','#8b5cf6'],cot:['COT','#f59e0b'],bt:['โอนล่วงหน้า','#14b8a6']};
  var abody=AO.map(function(k){ var a=AG[k], pt=PT[a.pay]||['Walk-in','#64748b'];
    var dc=(a.doc.issue?['&#9888; มีปัญหา '+a.doc.issue,'#be123c','#ffe4e6']
      :(a.doc.pending?['รอตรวจ '+a.doc.pending,'#b45309','#fef3c7']
      :(a.doc.nofiles?['ยังไม่แนบ '+a.doc.nofiles,'#4b5563','#e5e7eb']
      :['&#10003; ครบ','#047857','#d1fae5'])));
    var cell=function(v){ return v?('<td class="c" style="font-weight:700">'+v+'</td>'):'<td class="c dr-z0">0</td>'; };
    return '<tr><td>'+drSq(a.color,a.name)+'<span><b>'+e(a.name)+'</b><span>'+a.n+' booking</span></span></span></td>'
      +'<td><span class="dr-tag" style="background:'+a.mkt.color+'1f;color:'+a.mkt.color+'">'+e(a.mkt.name)+'</span></td>'
      +cell(a.ad)+cell(a.chd)+cell(a.inf)+cell(a.foc)
      +'<td class="c" style="font-weight:700">'+a.pax+'</td>'
      +'<td><span class="dr-tag" style="background:'+pt[1]+'1f;color:'+pt[1]+'">'+e(pt[0])+'</span></td>'
      +'<td class="r dr-mono" style="font-weight:700">'+drB(a.rev)+'</td>'
      +'<td class="r dr-mono"'+(a.due>0?' style="font-weight:700;color:#b45309"':' class="r dr-z0"')+'>'+(a.due>0?drB(a.due):'—')+'</td>'
      +'<td class="c"><span class="dr-tag" style="background:'+dc[2]+';color:'+dc[1]+'">'+dc[0]+'</span></td></tr>';
  }).join('');

  var net=D.rev+D.extras-cost;
  return '<div class="dr-kpis">'+kp+'</div>'
   +'<div class="dr-main"><div class="dr-col">'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>รายได้แยกตามช่องทางชำระ</h2>'
       +'<p>สัดส่วนยอดเงินตามวิธีที่ agent ชำระ</p></div><span class="dr-chip e">'+drB(D.rev)+'</span></div>'
       +(chBars||'<div class="dr-empty">ไม่มีรายได้ในวันนี้</div>')+'</div>'
     +'<div class="eg p6"><div class="dr-hd"><div><h2>รายได้แยกตามเส้นทาง</h2>'
       +'<p>ยอดเงินและรายได้เฉลี่ยต่อหัวของแต่ละโปรแกรม</p></div></div>'
       +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr><th>Route</th><th class="c">Booking</th>'
       +'<th class="c">Pax</th><th class="r">รายได้</th><th class="r">เฉลี่ย/คน</th><th class="c">สัดส่วน</th></tr></thead>'
       +'<tbody>'+(rbody||'<tr><td colspan="6" class="dr-empty">ไม่มีข้อมูล</td></tr>')+'</tbody></table></div></div>'
   +'</div><div class="dr-col">'
     +'<div class="eg p6"><div class="dr-hd"><div><h2 class="sm">สรุปเงินเข้า-ออก</h2></div><span class="rt">ประมาณการวันนี้</span></div>'
       +drTile('gr','รายได้รวม', drB(D.rev),'<span class="dr-chip e">+ เข้า</span>')
       +drTile('','ขายเพิ่มหน้างาน', drB(D.extras),'<span class="dr-chip p">+ upsell</span>')
       +drTile('warn','ค่ารถรับส่ง','-'+drB(D.vanCost),'<span class="dr-chip r">- ออก</span>')
       +(D.ltCost?drTile('warn','เรือหางยาวเหมา','-'+drB(D.ltCost),'<span class="dr-chip r">- ออก</span>'):'')
       +drTile('acc','คงเหลือก่อนต้นทุนเรือ/ครัว','<span style="font-size:17px">'+drB(net)+'</span>','')
       +'<p style="font-size:10.5px;color:var(--df);margin:12px 0 0;line-height:1.6">'
       +'* ยังไม่รวมน้ำมัน · ค่าอุทยาน · อาหาร · ค่าไกด์/ลูกเรือ ซึ่งคิดจากสูตรต้นทุนของแต่ละเส้นทาง</p></div>'
     +'<div class="dr-ins g2"><div class="blob1"></div><div class="blob2"></div><div class="z">'
       +'<div class="tp"><span class="cp">&#128176; การเงินวันนี้</span></div>'
       +'<h3>'+(D.due>0?('ยังเก็บเงินหน้างานไม่ครบ '+drB(D.due)):'เก็บเงินหน้างานครบแล้ว')+'</h3>'
       +'<p>'+(D.due>0?('มี booking ที่ต้องเก็บหน้าท่า เก็บไปแล้ว <b>'+drB(D.got)+'</b> · เหลือ <b>'+drB(D.due)+'</b>'):'ยอดที่ต้องเก็บหน้าท่าเคลียร์ครบ')
       +(D.noSlip?(' และมี <b>'+D.noSlip+' รายการยังไม่มีสลิป</b> ต้องตามให้ครบก่อนปิดวัน ไม่งั้นกระทบยอดกับ statement ไม่ได้'):'')+'</p></div></div>'
   +'</div></div>'
   +'<div class="eg p6"><div class="dr-hd"><div><h2>รายละเอียดตาม Agent</h2>'
     +'<p>Market · จำนวนคน · ช่องทางชำระ · ยอดเงิน · สถานะเอกสาร</p></div>'
     +'<span class="dr-chip n">'+AO.length+' agent · '+D.rows.length+' booking</span></div>'
     +'<div style="overflow-x:auto"><table class="dr-tbl"><thead><tr>'
     +'<th>Agency / Source</th><th>Market</th><th class="c">AD</th><th class="c">CHD</th><th class="c">INF</th>'
     +'<th class="c">FOC</th><th class="c">Pax</th><th>Payment</th><th class="r">Amount</th><th class="r">ต้องเก็บ</th>'
     +'<th class="c">เอกสาร</th></tr></thead><tbody>'
     +(abody||'<tr><td colspan="11" class="dr-empty">ไม่มี booking ในวันนี้</td></tr>')+'</tbody></table></div>'
     +'<div class="dr-sum"><div class="l">'
       +CH.filter(function(c){ return D.pay[c[0]]>0; }).map(function(c){ return '<span>'+e(c[1].split(' · ')[0])+' <b>'+drB(D.pay[c[0]])+'</b></span>'; }).join('')
       +(D.due>0?('<span>ต้องเก็บหน้างาน <b style="color:#be123c">'+drB(D.due)+'</b></span>'):'')+'</div>'
     +'<div class="r"><span>รายได้รวมทั้งวัน</span><b>'+drB(D.rev)+'</b></div></div></div>';
}

// ══ ตัวหน้า ══════════════════════════════════════════════════════════════
function drPrint(){
  document.body.classList.add('dr-printing');
  var back=function(){ document.body.classList.remove('dr-printing'); };
  try{ window.addEventListener('afterprint', back, {once:true}); }catch(_){}
  try{ window.print(); }catch(_){}
  setTimeout(back, 1500);   // กันเบราว์เซอร์ที่ไม่ยิง afterprint
}
// ── ค่าที่จำไว้ให้ (ผู้รับ/หัวเรื่อง/ข้อความนำ) ─────────────────────────
function drMailCfg(){
  var c=(typeof ctRead==='function')?ctRead('dr_mail'):null; c=c||{};
  return { to:c.to||'', cc:c.cc||'', note:(c.note!=null?c.note:'เรียนทีมงาน\n\nส่งรายงานสรุปก่อนวันเดินทางตามรายละเอียดด้านล่างครับ'),
           inc:c.inc||{ov:1,rt:1,px:1,bt:1,vn:1,fi:1,todo:1,list:1} };
}
function drMailSet(k,v){ var c=drMailCfg(); c[k]=v; if(typeof ctWrite==='function') ctWrite('dr_mail',c); }
function drMailToggle(k,on){ var c=drMailCfg(); c.inc[k]=on?1:0; if(typeof ctWrite==='function') ctWrite('dr_mail',c); drMailPaint(); }
function drMailField(k,v){ drMailSet(k,v); if(k!=='to'&&k!=='cc') drMailPaint(); }
function drmSec(t, right){
  return '<tr><td style="padding:20px 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    +'<td style="font-size:14px;font-weight:800;color:#111827">'+t+'</td>'
    +(right?('<td align="right" style="font-size:11.5px;color:#9ca3af;font-weight:600">'+right+'</td>'):'')
    +'</tr></table></td></tr>';
}
function drmDot(c){ return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c+';margin-right:6px"></span>'; }
function drmChip(t, fg, bg){
  return '<span style="display:inline-block;padding:2px 9px;border-radius:11px;background:'+bg+';color:'+fg
    +';font-size:10.5px;font-weight:700;white-space:nowrap">'+t+'</span>';
}
// การ์ด KPI · 4 ช่องเรียงแถวเดียวเหมือนบนหน้าจอ
function drmKpis(items){
  var w=Math.floor(100/items.length);
  return '<tr><td style="padding:4px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    + items.map(function(k,i){
      return '<td width="'+w+'%" valign="top" style="padding:0 '+(i<items.length-1?'5px':'0')+' 0 '+(i?'5px':'0')+'">'
        +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        +'style="background:#ffffff;border:1px solid #e9ebef;border-radius:14px">'
        +'<tr><td style="padding:12px 13px 11px">'
          +'<div style="font-size:11px;color:#6b7280;font-weight:500">'+k[0]+'</div>'
          +'<div style="font-size:22px;font-weight:800;color:'+(k[3]||'#111827')+';letter-spacing:-.02em;padding-top:4px;line-height:1.1">'+k[1]
            +(k[4]?('<span style="font-size:11px;font-weight:600;color:#9ca3af;padding-left:4px">'+k[4]+'</span>'):'')+'</div>'
          +(k[2]?('<div style="font-size:10.5px;color:#9ca3af;padding-top:4px;line-height:1.45">'+k[2]+'</div>'):'')
        +'</td></tr></table></td>'; }).join('')
    +'</tr></table></td></tr>';
}
// ตารางกระชับ · หัวเล็ก แถวบรรทัดเดียว
// เนื้อตารางล้วน ๆ · เอาไปวางในคอลัมน์ได้
function drmTbl(head, rows, align, widths){
  if(!rows) return '<div style="padding:10px 2px;font-size:12px;color:#9ca3af">ไม่มีข้อมูล</div>';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
    +'<tr>'+head.map(function(h,i){
      return '<th'+(widths&&widths[i]?(' width="'+widths[i]+'"'):'')+' style="padding:6px 8px;border-bottom:1px solid #e9ebef;'
        +'font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;'
        +'text-align:'+((align&&align[i])||'left')+'">'+h+'</th>'; }).join('')+'</tr>'
    + rows +'</table>';
}
function drmT(head, rows, align, widths){
  if(!rows) return '<tr><td style="padding:10px 2px;font-size:12px;color:#9ca3af">ไม่มีข้อมูล</td></tr>';
  return '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
    +'<tr>'+head.map(function(h,i){
      return '<th'+(widths&&widths[i]?(' width="'+widths[i]+'"'):'')+' style="padding:6px 8px;border-bottom:1px solid #e9ebef;'
        +'font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;'
        +'text-align:'+((align&&align[i])||'left')+'">'+h+'</th>'; }).join('')+'</tr>'
    + rows +'</table></td></tr>';
}
function drmR(cells, align){
  return '<tr>'+cells.map(function(c,i){
    return '<td style="padding:7px 8px;border-bottom:1px solid #f4f5f7;font-size:12px;color:#374151;'
      +'text-align:'+((align&&align[i])||'left')+'">'+c+'</td>'; }).join('')+'</tr>';
}
// แถบสัดส่วนในเซลล์ · div ธรรมดา รองรับเกือบทุกโปรแกรมเมล
function drmBar(pct, color){
  pct=Math.max(0,Math.min(100,+pct||0));
  return '<div style="height:6px;background:#f0f1f4;border-radius:6px;overflow:hidden;margin-top:3px">'
    +'<div style="height:6px;width:'+pct.toFixed(1)+'%;background:'+color+';border-radius:6px"></div></div>';
}

// ── ตัวจดหมาย ───────────────────────────────────────────────────────────
function drmCard(inner, pad, bg, bd, radius, full){
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'+(full?' height="100%"':'')
    +' style="background:'+(bg||'#ffffff')+';border:1px solid '+(bd||DRM.line)+';border-radius:'+(radius||'16px')
    +(full?';height:100%':'')+'"><tr><td valign="top" style="padding:'+(pad||'16px 18px')+'">'+inner+'</td></tr></table>';
}
// หัวข้อเล็กในการ์ด · ซ้ายชื่อ ขวาคำกำกับ · ใช้ให้การ์ดสองใบเริ่มบรรทัดแรกตรงกัน
function drmCardHd(title, right){
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>'
    +'<td style="font-size:12.5px;font-weight:800;color:'+DRM.ink+'">'+title+'</td>'
    +(right?('<td align="right" style="font-size:10.5px;font-weight:600;color:'+DRM.fain+'">'+right+'</td>'):'')
    +'</tr></table>';
}
// การ์ด KPI แบบเดียวกับหน้าจอ · ไอคอนวงกลม + แถวย่อยคั่นเส้น
function drmKpi(label, value, unit, sub, foot, icon, iconbg, vcolor){
  var f='';
  if(foot && foot.length){
    var tds='', w=Math.floor(100/foot.length);
    foot.forEach(function(x,i){ tds+='<td width="'+w+'%" style="'+(i?('border-left:1px solid '+DRM.line+';'):'')
      +'padding:0 5px;font-size:10px;color:'+DRM.mut+';text-align:center;line-height:1.4">'+x+'</td>'; });
    f='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:11px;border-top:1px solid '
      +DRM.line+'"><tr><td style="padding-top:9px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
      +'<tr>'+tds+'</tr></table></td></tr></table>';
  }
  return drmCard('<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    +'<td valign="top"><div style="font-size:11.5px;color:'+DRM.mut+';font-weight:600">'+label+'</div>'
    +'<div style="font-size:23px;font-weight:800;color:'+(vcolor||DRM.ink)+';letter-spacing:-.03em;padding-top:3px;line-height:1.15">'+value
    +(unit?('<span style="font-size:12px;font-weight:600;color:'+DRM.fain+';padding-left:5px">'+unit+'</span>'):'')+'</div>'
    +(sub?('<div style="font-size:10.5px;color:'+DRM.fain+';padding-top:5px;line-height:1.5">'+sub+'</div>'):'')+'</td>'
    +'<td width="34" valign="top" align="right"><table role="presentation" cellpadding="0" cellspacing="0"><tr>'
    +'<td width="30" height="30" align="center" valign="middle" style="background:'+iconbg
    +';border-radius:10px;font-size:15px;line-height:30px">'+icon+'</td></tr></table></td></tr></table>'+f,
    '13px 13px 12px');
}
function drmPair(a,b){
  return '<tr><td style="padding:10px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    +'<td width="50%" valign="top" style="padding-right:5px">'+a+'</td>'
    +'<td width="50%" valign="top" style="padding-left:5px">'+(b||'')+'</td></tr></table></td></tr>';
}
// การ์ด KPI เรียงแถวเดียว 4 ใบ · ตรงกับหน้าจอ และใช้ความกว้างที่มีให้คุ้ม
function drmQuad(arr){
  var tds='';
  arr.forEach(function(c,i){ tds+='<td width="25%" valign="top" style="padding:0 '
    +(i<arr.length-1?'5px':'0')+' 0 '+(i?'5px':'0')+'">'+c+'</td>'; });
  return '<tr><td style="padding:10px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    +'<tr>'+tds+'</tr></table></td></tr>';
}
// กราฟ 14 วัน · แท่งซ้อนสีด้วย div ล้วน · ไม่มี SVG/รูป เพราะเมลบล็อก
function drmTrend(T, e, full){
  var MAXH=168, mx=1;
  T.pts.forEach(function(p){ if(p.tot>mx) mx=p.tot; });
  var cols='';
  T.pts.forEach(function(p){
    var h=Math.round(p.tot/mx*MAXH), segs='', used=0, ks=T.keys.slice();
    ks.forEach(function(k,i){
      var v=p.by[k]||0; if(!v && i<ks.length-1) return;
      var sh=(i===ks.length-1)? Math.max(0,h-used) : Math.round(h*(v/(p.tot||1)));
      used+=sh;
      if(sh>0) segs+='<div style="height:'+sh+'px;background:'+((T.mkt[k]||{}).color||'#94a3b8')
        +';font-size:0;line-height:0">&nbsp;</div>';
    });
    cols+='<td valign="bottom" align="center" style="padding:0 2px">'
      +'<div style="font-size:'+(p.today?11:10)+'px;font-weight:'+(p.today?800:600)+';color:'+(p.today?DRM.ink:DRM.fain)+';padding-bottom:4px">'+p.tot+'</div>'
      +'<div style="width:100%;border-radius:4px;overflow:hidden">'+segs+'</div>'
      +'<div style="font-size:9.5px;color:'+(p.today?DRM.ink:DRM.fain)+';padding-top:5px;font-weight:'+(p.today?800:500)+'">'+e(p.lb)+'</div></td>';
  });
  var lg=T.keys.map(function(k){ var m=T.mkt[k]||{};
    return '<span style="display:inline-block;margin:0 12px 4px 0;font-size:10.5px;color:'+DRM.mut+'">'
      +drmDot(m.color||'#94a3b8')+e(m.name||k)+'</span>'; }).join('');
  var tot=T.pts.reduce(function(a,p){ return a+p.tot; },0);
  return drmCard(drmCardHd('ผู้โดยสาร 14 วัน','นับตามวันเดินทาง')
    +'<div style="font-size:11px;color:'+DRM.fain+';line-height:1.55;padding-bottom:12px">'
    +'นับจากวันเดินทางของแต่ละใบ — ใช้วางแผนเรือ/รถล่วงหน้า <b>ไม่ใช่</b>วันที่ลงบุคกิ้ง · แยกชั้นสีตาม Market</div>'
    +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'+cols+'</tr></table>'
    +'<div style="border-top:1px solid '+DRM.line+';margin-top:12px;padding-top:10px">'+lg
    +'<span style="float:right;font-size:10.5px;color:'+DRM.mut+'">เดินทางรวม 14 วัน <b style="color:'+DRM.ink+'">'+tot+' คน</b></span></div>',
    null,null,null,null,full);
}
function drImgKey(D){ return D.date+'|'+_drTrendMode+'|'+D.pax.tot+'|'+D.rev; }
function drmPngTrend(T){
  var W=1040, H=420, L=46, R=18, TP=42, BT=46, n=T.pts.length, S=2;
  if(!n) return '';
  var cv=document.createElement('canvas'); cv.width=W*S; cv.height=H*S;
  var c=cv.getContext('2d'); c.setTransform(S,0,0,S,0,0);
  c.fillStyle='#ffffff'; c.fillRect(0,0,W,H);
  var FT="'DM Sans','Noto Sans Thai',-apple-system,Segoe UI,Helvetica,Arial,sans-serif";
  var mx=1; T.pts.forEach(function(p){ if(p.tot>mx) mx=p.tot; });
  mx=Math.ceil(mx/8)*8 || 8;
  var step=(n>1)?((W-L-R)/(n-1)):0, xs=[], i;
  for(i=0;i<n;i++) xs.push(L+step*i);
  var yb=H-BT, yt=TP, Y=function(v){ return yb-(v/mx)*(yb-yt); };
  // เส้นกริด + ป้ายแกน
  c.strokeStyle='#eef0f3'; c.lineWidth=1; c.setLineDash([4,4]);
  for(i=0;i<5;i++){ var gy=Math.round(yt+(yb-yt)*i/4)+.5;
    c.beginPath(); c.moveTo(L-14,gy); c.lineTo(W-R+6,gy); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle='#9ca3af'; c.font='10px '+FT; c.textAlign='right'; c.textBaseline='middle';
  for(i=0;i<5;i++){ c.fillText(String(Math.round(mx*(4-i)/4)), L-18, yt+(yb-yt)*i/4); }
  // พื้นที่ซ้อนสี · ไล่สีบนเข้มล่างอ่อนเหมือนบนหน้าจอ
  var cum=[]; for(i=0;i<n;i++) cum.push(0);
  T.keys.forEach(function(k){
    var col=(T.mkt[k]||{}).color||'#94a3b8';
    var lo=cum.slice(), hi=[], top=[], bot=[];
    for(i=0;i<n;i++){ cum[i]+=(T.pts[i].by[k]||0); hi.push(cum[i]); }
    for(i=0;i<n;i++){ top.push([xs[i],Y(hi[i])]); bot.push([xs[i],Y(lo[i])]); }
    var g=c.createLinearGradient(0,yt,0,yb);
    g.addColorStop(0,col+'F2'); g.addColorStop(1,col+'B3');
    c.beginPath(); _dcSmooth(c,top);
    _dcSmooth(c, bot.slice().reverse(), true);
    c.closePath(); c.fillStyle=g; c.fill();
  });
  // เส้นยอดรวมจาง ๆ
  var tot=[]; for(i=0;i<n;i++) tot.push([xs[i],Y(T.pts[i].tot)]);
  c.beginPath(); _dcSmooth(c,tot); c.strokeStyle='rgba(31,41,55,.18)'; c.lineWidth=1.6; c.stroke();
  // เส้นวันนี้ + ป้าย
  var ti=-1; for(i=0;i<n;i++) if(T.pts[i].today) ti=i;
  if(ti>=0){
    c.save(); c.globalAlpha=.5; c.setLineDash([5,4]); c.strokeStyle='#111827'; c.lineWidth=1.4;
    c.beginPath(); c.moveTo(xs[ti],yt-16); c.lineTo(xs[ti],yb); c.stroke(); c.restore();
    c.fillStyle='#111827';
    var bx=xs[ti]-25, by=yt-32, bw=50, bh=19, br=9.5;
    c.beginPath(); c.moveTo(bx+br,by); c.arcTo(bx+bw,by,bx+bw,by+bh,br); c.arcTo(bx+bw,by+bh,bx,by+bh,br);
    c.arcTo(bx,by+bh,bx,by,br); c.arcTo(bx,by,bx+bw,by,br); c.closePath(); c.fill();
    c.fillStyle='#fff'; c.font='700 10px '+FT; c.textAlign='center'; c.textBaseline='middle';
    c.fillText('วันนี้', xs[ti], by+bh/2+.5);
  }
  // ตัวเลขบนยอด + ป้ายวัน
  c.textAlign='center'; c.textBaseline='alphabetic';
  for(i=0;i<n;i++){ var big=(i===ti);
    c.font=(big?'800 12.5px ':'800 11px ')+FT; c.fillStyle=big?'#111827':'#4b5563';
    c.fillText(String(T.pts[i].tot), xs[i], Y(T.pts[i].tot)-9); }
  for(i=0;i<n;i++){ c.font=((i===ti)?'700 10px ':'400 10px ')+FT;
    c.fillStyle=(i===ti)?'#111827':'#9ca3af'; c.fillText(String(T.pts[i].lb), xs[i], yb+18); }
  return cv.toDataURL('image/png');
}
function drmPngDonut(D){
  var SZ=230, S=2, cv=document.createElement('canvas'); cv.width=SZ*S; cv.height=SZ*S;
  var c=cv.getContext('2d'); c.setTransform(S,0,0,S,0,0);
  c.fillStyle='#ffffff'; c.fillRect(0,0,SZ,SZ);
  var FT="'DM Sans','Noto Sans Thai',-apple-system,Segoe UI,Helvetica,Arial,sans-serif";
  var cx=SZ/2, cy=SZ/2, r=78, w=30, tot=D.pax.tot||0;
  c.lineWidth=w; c.strokeStyle='#f3f4f6';
  c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke();
  var a0=-Math.PI/2;
  D.mOrder.slice(0,7).forEach(function(id){ var m=D.mkt[id];
    var frac=tot>0?(m.pax/tot):0; if(frac<=0) return;
    var a1=a0+frac*Math.PI*2;
    c.beginPath(); c.strokeStyle=m.color; c.arc(cx,cy,r,a0,a1); c.stroke();
    a0=a1;
  });
  c.textAlign='center';
  c.fillStyle='#111827'; c.font='800 34px '+FT; c.textBaseline='alphabetic';
  c.fillText(String(tot), cx, cy+5);
  c.fillStyle='#9ca3af'; c.font='700 9.5px '+FT;
  c.fillText('TOTAL PAX', cx, cy+21);
  return cv.toDataURL('image/png');
}
function drmUpload(dataUrl, name){
  var b64=String(dataUrl||'').split(',')[1]||'';
  if(!b64) return Promise.reject(new Error('no image'));
  return fetch('/api/mailimg',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({filename:name,dataB64:b64})})
    .then(function(r){ return r.json(); })
    .then(function(j){ if(!j||!j.url) throw new Error((j&&j.error)||'upload failed');
      return location.origin+j.url; });
}
// เตรียมรูปกราฟไว้ก่อนเขียนจดหมาย · ทำครั้งเดียวต่อวัน/โหมด แล้วจำไว้
function drmEnsureImgs(D, done){
  var key=drImgKey(D);
  if(_drImg.key===key && (_drImg.state==='ok'||_drImg.state==='run')){ if(done&&_drImg.state==='ok') done(); return; }
  _drImg={ key:key, trend:'', donut:'', state:'run' };
  if(done) drMailPaint();
  var T=(_drTrendMode==='booked')?drTrendBooked(D.date,14):drTrend(D.date,14,2);
  var jobs=[];
  try{ jobs.push(drmUpload(drmPngTrend(T),'trend-'+D.date+'.png').then(function(u){ _drImg.trend=u; })); }catch(_){}
  try{ if(D.mOrder.length) jobs.push(drmUpload(drmPngDonut(D),'donut-'+D.date+'.png').then(function(u){ _drImg.donut=u; })); }catch(_){}
  Promise.all(jobs).then(function(){
    if(_drImg.key!==key) return;
    _drImg.state='ok'; if(done) done(); drMailPaint();
  }).catch(function(err){
    if(_drImg.key!==key) return;
    _drImg.state='err'; console.warn('[dailyreport] chart upload failed', err);
    if(done) done(); drMailPaint();
  });
}
function drMailHTML(D){
  var e=ckEsc, C=drMailCfg(), I=C.inc, o='';
  var dNice=D.date; try{ dNice=new Date(D.date+'T12:00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(_){}
  var cost=D.vanCost+D.ltCost;
  var GRN='#047857', AMB='#b45309', RED='#b91c1c';

  // ── หัวจดหมาย ──
  o+='<tr><td style="padding:0 0 4px">'
    +'<div style="font-size:10px;font-weight:800;letter-spacing:.1em;color:#65a30d;text-transform:uppercase">LOVE ANDAMAN &middot; OPERATIONS</div>'
    +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px"><tr>'
    +'<td style="font-size:23px;font-weight:800;color:#111827;letter-spacing:-.03em">Daily Report</td>'
    +'<td align="right" style="font-size:12px;color:#6b7280">สรุปก่อนวันเดินทาง<br><b style="color:#111827">'+e(dNice)+'</b></td>'
    +'</tr></table></td></tr>';
  if((C.note||'').trim())
    o+='<tr><td style="padding:14px 0 4px;font-size:12.5px;color:#374151;line-height:1.7">'
      +e(C.note).replace(/\n/g,'<br>')+'</td></tr>';

  // ── KPI 4 ใบ ──
  if(I.ov){
    var bF=D.bOrder.length
      ? ('เต็มสุด <b style="color:'+GRN+'">'+e(D.boats[D.bOrder[0]].name)+' '+drPct(D.boats[D.bOrder[0]].pax,D.boats[D.bOrder[0]].cap)+'%</b>')
      : 'ยังไม่จัดเรือ';
    var bF2=(D.bOrder.length>1)
      ? ('ว่างสุด <b style="color:#4338ca">'+e(D.boats[D.bOrder[D.bOrder.length-1]].name)+' '
         +drPct(D.boats[D.bOrder[D.bOrder.length-1]].pax,D.boats[D.bOrder[D.bOrder.length-1]].cap)+'%</b>') : '';
    var k1=drmKpi('ผู้โดยสารทั้งวัน', D.pax.tot, 'คน',
      'ผู้ใหญ่ '+D.pax.ad+' · เด็ก '+D.pax.chd+' · ทารก '+D.pax.inf+' · FOC '+D.pax.foc,
      ['ไทย <b style="color:#111827">'+D.pax.th+'</b>','ต่างชาติ <b style="color:#111827">'+D.pax.fr+'</b>',
       '<b style="color:#111827">'+D.rOrder.length+'</b> เส้นทาง'], '&#128101;', '#eef2ff');
    var k2=drmKpi('รายได้ทั้งวัน', drB(D.rev), '',
      'เฉลี่ย <b style="color:'+GRN+'">'+drB(D.paxPay?D.rev/D.paxPay:0)+'</b> / คน',
      ['Invoice <b style="color:#111827">'+drK2(D.pay.invoice)+'</b>','PFM <b style="color:#111827">'+drK2(D.pay.proforma)+'</b>',
       'COT <b style="color:#111827">'+drK2(D.pay.cot)+'</b>'], '&#128176;', '#ecfdf5', GRN);
    var k3=drmKpi('ที่นั่งเรือที่ใช้', drPct(D.seatTot,D.capTot)+'%', 'เฉลี่ย',
      D.seatTot+' ที่นั่ง จากความจุ '+D.capTot+' · '+D.bOrder.length+' ลำ',
      bF2?[bF,bF2]:[bF], '&#128676;', '#f5f3ff', '#4338ca');
    var k4=drmKpi('ต้นทุนรถรับส่ง', drB(D.perPax), '/ คน',
      D.vanIn+' คันในโควตา'+(D.vanOut?(' · นอกโควตา '+D.vanOut):'')+' · รับส่ง '+D.vanPax+' คน',
      ['ค่ารถรวม <b style="color:#111827">'+drB(D.vanCost)+'</b>',
       D.vanOut?('<b style="color:'+RED+'">เกินโควตา</b>'):('<b style="color:'+GRN+'">อยู่ในโควตา</b>')],
      '&#128656;', '#fff7ed', '#c2410c');
    o+=drmQuad([k1,k2,k3,k4]);

    // ── กราฟ 14 วัน (ซ้าย) + สัดส่วนลูกค้า (ขวา) · วาง 2 คอลัมน์เหมือนหน้าจอ ──
    var T=(_drTrendMode==='booked')?drTrendBooked(D.date,14):drTrend(D.date,14,2);
    var useImg=(_drImg.key===drImgKey(D) && _drImg.state==='ok');
    var chartBody;
    if(useImg && _drImg.trend){
      chartBody=drmCardHd('ผู้โดยสาร 14 วัน','นับตามวันเดินทาง')
        +'<div style="font-size:11px;color:'+DRM.fain+';line-height:1.55;padding-bottom:10px">'
        +'นับจากวันเดินทางของแต่ละใบ — ใช้วางแผนเรือ/รถล่วงหน้า <b>ไม่ใช่</b>วันที่ลงบุคกิ้ง · แยกชั้นสีตาม Market</div>'
        +'<img src="'+_drImg.trend+'" width="100%" alt="ผู้โดยสาร 14 วัน" '
        +'style="display:block;width:100%;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">'
        +'<div style="border-top:1px solid '+DRM.line+';margin-top:10px;padding-top:10px">'
        + T.keys.map(function(k){ var m=T.mkt[k]||{};
            return '<span style="display:inline-block;margin:0 12px 4px 0;font-size:10.5px;color:'+DRM.mut+'">'
              +drmDot(m.color||'#94a3b8')+e(m.name||k)+'</span>'; }).join('')
        +'<span style="float:right;font-size:10.5px;color:'+DRM.mut+'">เดินทางรวม 14 วัน <b style="color:'+DRM.ink+'">'
        + T.pts.reduce(function(a,p){return a+p.tot;},0)+' คน</b></span></div>';
      chartBody=drmCard(chartBody,null,null,null,null,true);
    } else {
      chartBody=drmTrend(T,e,true);
    }
    var MO=D.mOrder.slice(0,7), mktBody='';
    if(MO.length){
      var stack='', lst='';
      MO.forEach(function(id){ var m=D.mkt[id];
        stack+='<td width="'+(D.pax.tot?(m.pax/D.pax.tot*100).toFixed(1):0)+'%" style="background:'+m.color
          +';height:14px;font-size:0;line-height:0">&nbsp;</td>'; });
      MO.forEach(function(id,i){ var m=D.mkt[id], last=(i===MO.length-1), bd=last?'none':'1px solid #f4f5f7';
        lst+='<tr><td style="padding:6px 2px;border-bottom:'+bd+';font-size:12px;color:#374151">'
          +drmDot(m.color)+'<b style="color:'+DRM.ink+'">'+e(m.name)+'</b></td>'
          +'<td align="right" style="padding:6px 2px;border-bottom:'+bd+';font-size:12px;color:'+DRM.mut+';white-space:nowrap">'
          +'<b style="color:'+DRM.ink+'">'+m.pax+'</b> คน <span style="color:'+DRM.fain+'">('+drPct(m.pax,D.pax.tot)+'%)</span></td></tr>'; });
      mktBody=drmCard(
        drmCardHd('สัดส่วนลูกค้า','แบ่งตาม Market · '+D.pax.tot+' pax')+
        (useImg && _drImg.donut
          ? ('<div style="text-align:center;padding-bottom:2px"><img src="'+_drImg.donut+'" width="176" alt="สัดส่วนลูกค้า" '
             +'style="display:inline-block;width:176px;max-width:100%;height:auto;border:0"></div>')
          : ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden">'
             +'<tr>'+stack+'</tr></table>'))
        +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">'+lst+'</table>',
        null,null,null,null,true);
    }
    o+=drmSec('ผู้โดยสาร · ตามวันเดินทาง · 14 วัน','เดินทางวันนี้ '+D.pax.tot+' คน');
    o+='<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      +'<td width="65%" valign="top" style="padding-right:6px">'+chartBody+'</td>'
      +'<td width="35%" valign="top" style="padding-left:6px">'+(mktBody||'')+'</td></tr></table></td></tr>';

  }

  // ── แยกตามเส้นทาง · การ์ดเรียงข้างกัน ──
  if(I.rt && D.rOrder.length){
    o+=drmSec('แยกตามเส้นทาง', D.rOrder.length+' เส้นทาง · '+D.rows.length+' booking');
    var mk=function(k,v){ return '<tr><td style="padding:3px 0;font-size:11.5px;color:'+DRM.mut+'">'+k+'</td>'
      +'<td align="right" style="padding:3px 0;font-size:12px;font-weight:700;color:'+DRM.ink+'">'+v+'</td></tr>'; };
    var cards=D.rOrder.map(function(id){ var r=D.routes[id], pc=drPct(r.seats,r.cap);
      return drmCard('<div style="font-size:12.5px;font-weight:800;color:'+DRM.ink+';padding-bottom:8px;line-height:1.3">'
        +drmDot(r.color)+e(r.name)+'</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        +mk('ผู้โดยสาร',r.pax+' คน')+mk('booking',r.n+' ใบ')+mk('รายได้',drB(r.rev))
        +mk('ที่นั่ง',r.seats+' / '+(r.cap||'—')+(r.cap?(' · '+pc+'%'):''))
        +'</table>'+drmBar(pc,r.color),'13px 14px',DRM.soft,'#eef0f3'); });
    var PERROW=4;
    for(var ci=0; ci<cards.length; ci+=PERROW){
      var g=cards.slice(ci,ci+PERROW), tds='';
      for(var gj=0; gj<PERROW; gj++) tds+='<td width="'+Math.floor(100/PERROW)+'%" valign="top" style="padding:0 '
        +(gj<PERROW-1?'5px':'0')+' 0 '+(gj?'5px':'0')+'">'+(g[gj]||'')+'</td>';
      o+='<tr><td style="padding:0 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'+tds+'</tr></table></td></tr>';
    }
  }

  // ── ต้องเคลียร์ก่อนปิดวัน ──
  if(I.todo){
    var W=[];
    if(D.warn.noVan)  W.push([RED,'#fee2e2','ยังไม่จัดรถ '+D.warn.noVan+' ใบ ('+D.noVan.pax+' คน)']);
    if(D.warn.noBoat) W.push([RED,'#fee2e2','ยังไม่จัดเรือ '+D.warn.noBoat+' ใบ ('+D.noBoat.pax+' คน)']);
    if(D.warn.over)   W.push([RED,'#fee2e2','เรือเกินความจุ '+D.warn.over+' ลำ']);
    if(D.ret.todo)    W.push([AMB,'#fef3c7','ยังไม่จัดรถกลับ '+D.ret.todo+' ใบ ('+D.ret.todoPax+' คน)']);
    if(D.warn.doc)    W.push([AMB,'#fef3c7','เอกสารไม่ครบ '+D.warn.doc+' ใบ']);
    if(D.due>0)       W.push([AMB,'#fef3c7','ต้องเก็บหน้างาน '+drB(D.due)]);
    if(D.noSlip)      W.push([AMB,'#fef3c7','ยังไม่มีสลิป '+D.noSlip+' รายการ']);
    o+=drmSec('สิ่งที่ต้องเคลียร์ก่อนปิดวัน', W.length?(W.length+' เรื่อง'):'เรียบร้อย');
    o+='<tr><td>'+drmCard(W.length
      ? (W.map(function(w){ return drmChip(w[2],w[0],w[1]); }).join('')
         +'<div style="font-size:11px;color:'+DRM.fain+';padding-top:6px">เคลียร์ให้จบก่อนปิดวัน</div>')
      : '<div style="font-size:12.5px;color:'+GRN+';font-weight:700">&#10003; ไม่มีรายการค้าง · ทุกอย่างพร้อมเดินทาง</div>',
      '13px 15px', W.length?'#fffbf2':'#f2faf7', W.length?'#f6e6c9':'#cfe9de')+'</td></tr>';
  }

  // ── ผู้โดยสาร ──
  if(I.px){
    o+=drmSec('ผู้โดยสาร', D.pax.tot+' คน');
    var pr='';
    [['ผู้ใหญ่ (AD)',D.pax.ad],['เด็ก (CHD)',D.pax.chd],['ทารก (INF)',D.pax.inf],['FOC / ไม่คิดเงิน',D.pax.foc]]
      .forEach(function(x){ if(x[1]) pr+=drmR([x[0],'<b>'+x[1]+'</b>',drPct(x[1],D.pax.tot)+'%'],['left','center','right']); });
    var dr0='';
    [['ตรวจแล้ว',D.docs.verified,GRN,'#dcfce7'],['มีปัญหา',D.docs.issue,RED,'#fee2e2'],
     ['รอตรวจ',D.docs.pending,AMB,'#fef3c7'],['ยังไม่แนบไฟล์',D.docs.nofiles,DRM.mut,'#f1f2f4']]
      .forEach(function(x){ if(x[1]) dr0+=drmR([drmChip(x[0],x[2],x[3]),'<b>'+x[1]+'</b>'],['left','right']); });
    // ตารางแคบสองอัน วางคู่กัน · จอกว้างจะได้ไม่มีช่องว่างกลางบรรทัด
    o+='<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      +'<td width="50%" valign="top" style="padding-right:9px">'
        +drmTbl(['ประเภทผู้โดยสาร','คน','สัดส่วน'],pr,['left','center','right'],['','18%','18%'])+'</td>'
      +'<td width="50%" valign="top" style="padding-left:9px">'
        +(dr0?drmTbl(['สถานะเอกสาร','ใบ'],dr0,['left','right'],['','18%'])
             :'<div style="padding:10px 2px;font-size:12px;color:'+DRM.fain+'">ไม่มีข้อมูลเอกสาร</div>')+'</td>'
      +'</tr></table></td></tr>';
    var ml=[]; if(D.meals.veg)ml.push('มังสวิรัติ '+D.meals.veg); if(D.meals.vegan)ml.push('วีแกน '+D.meals.vegan);
    if(D.meals.halal)ml.push('ฮาลาล '+D.meals.halal); if(D.meals.allergy)ml.push('แพ้อาหาร '+D.meals.allergy);
    var lgs=Object.keys(D.langs||{}).map(function(k){ return e(k)+' '+D.langs[k]+' คน'; }).join(' · ');
    o+='<tr><td style="padding:8px 0 0">'+drmCard(
      '<b style="color:'+DRM.ink+'">สัญชาติ</b> &nbsp; ไทย <b>'+D.pax.th+'</b> · ต่างชาติ <b>'+D.pax.fr+'</b>'
      +(D.pax.un?(' · ยังไม่ระบุ <b>'+D.pax.un+'</b>'):'')+'<br>'
      +'<b style="color:'+DRM.ink+'">อาหารพิเศษ</b> &nbsp; '+(ml.join(' · ')||'ไม่มี')+'<br>'
      +'<b style="color:'+DRM.ink+'">ภาษาไกด์</b> &nbsp; '+(lgs||'—'),
      '11px 14px',DRM.soft,'#eef0f3')+'</td></tr>';
    o+='<tr><td style="padding:8px 0 0">'+drmCard(
      '<b style="color:'+DRM.ink+'">รถกลับ</b> &nbsp; ส่งจุดเดิม <b>'+D.ret.same+'</b> ใบ ('+D.ret.samePax+' คน) · '
      +'จัดรถแล้ว <b>'+D.ret.arr+'</b> ใบ · <span style="color:'+(D.ret.todo?RED:DRM.mut)+';font-weight:700">'
      +'ยังไม่จัด '+D.ret.todo+' ใบ ('+D.ret.todoPax+' คน)</span> · ลูกค้ากลับเอง <b>'+D.ret.self+'</b> ใบ',
      '11px 14px',DRM.soft,'#eef0f3')+'</td></tr>';
  }

  // ── เรือ ──
  if(I.bt){
    o+=drmSec('เรือ', D.bOrder.length+' ลำ · '+D.capTot+' ที่นั่ง');
    var br='';
    D.bOrder.forEach(function(id){ var b=D.boats[id], pc=drPct(b.pax,b.cap), over=b.pax>b.cap;
      var col=over?RED:(pc>=85?AMB:GRN);
      var rl=Object.keys(b.routes).sort(function(x,y){ return b.routes[y]-b.routes[x]; })
        .map(function(k){ var r=D.routes[k]; return (r?r.name:k)+' '+b.routes[k]; }).join(' · ');
      br+=drmR(['<b>'+e(b.name)+'</b><div style="font-size:10px;color:'+DRM.fain+';padding-top:2px">'
          +e((b.type||'เรือ')+(b.pier?(' · ท่า '+drPierTxt(b)):'')+(b.dep?(' · ออก '+b.dep):''))+'</div>',
        b.n, '<b>'+b.pax+'</b> / '+(b.cap||'—'),
        '<span style="font-size:11px;font-weight:700;color:'+col+'">'+pc+'%'+(over?' &#9888;':'')+'</span>'+drmBar(Math.min(pc,100),col),
        '<span style="font-size:10.5px;color:'+DRM.mut+'">'+e(rl)+'</span>'],['left','center','center','left','left']); });
    if(D.noBoat.n) br+=drmR(['<span style="color:'+RED+'">ยังไม่จัดเรือ</span>',D.noBoat.n,'<b>'+D.noBoat.pax+'</b>','',''],
      ['left','center','center','left','left']);
    o+=drmT(['เรือ','ใบ','คน / ที่นั่ง','Load','เส้นทางที่รับ'],br,['left','center','center','left','left'],['26%','6%','13%','18%','']);
  }

  // ── รถรับส่ง ──
  if(I.vn){
    o+=drmSec('รถรับส่ง', D.vOrder.length+' คัน · รับส่ง '+D.vanPax+' คน');
    var vr='';
    D.vOrder.forEach(function(id){ var v=D.vans[id], pc=drPct(v.pax,v.cap), col=(v.pax>v.cap)?RED:(pc>=85?AMB:GRN);
      var bl=Object.keys(v.boats).map(function(k){ return (D.boats[k]?D.boats[k].name:k); }).join(' · ');
      vr+=drmR(['<b>'+e(v.name)+'</b><div style="font-size:10px;color:'+DRM.fain+';padding-top:2px">'
          +e((v.plate||'—')+' · '+(v.type||'van')+' · '+(v.own==='own'?'รถบริษัท':'รถพาร์ทเนอร์'))+'</div>',
        e(v.first||'—'), v.n, '<b>'+v.pax+'</b> / '+(v.cap||'—'),
        '<span style="font-size:11px;font-weight:700;color:'+col+'">'+pc+'%</span>'+drmBar(Math.min(pc,100),col),
        '<span style="font-size:10.5px;color:'+DRM.mut+'">'+e(bl)+'</span>'],['left','center','center','center','left','left']); });
    if(D.noVan.n) vr+=drmR(['<span style="color:'+RED+'">ยังไม่จัดรถ</span>','',D.noVan.n,'<b>'+D.noVan.pax+'</b>','',''],
      ['left','center','center','center','left','left']);
    if(D.selfArr.n) vr+=drmR(['<span style="color:'+DRM.mut+'">ลูกค้ามาเอง</span>','',D.selfArr.n,'<b>'+D.selfArr.pax+'</b>','',''],
      ['left','center','center','center','left','left']);
    o+=drmT(['รถ','รับแรก','ใบ','คน / ที่นั่ง','Load','ส่งขึ้นเรือ'],vr,
      ['left','center','center','center','left','left'],['24%','9%','6%','13%','16%','']);
    if(D.zOrder.length){
      var zr='';
      D.zOrder.forEach(function(k){ var z=D.zones[k];
        zr+=drmR(['<b>'+e(z.name)+'</b>',z.n,'<b>'+z.pax+'</b>',Object.keys(z.vans).length,
          '<span style="font-size:11px;color:'+DRM.mut+'">'+e((z.first||'—')+' – '+(z.last||'—'))+'</span>'],
          ['left','center','center','center','right']); });
      o+=drmSec('โซนรับ', D.zOrder.length+' โซน');
      o+=drmT(['โซน','ใบ','คน','รถ','ช่วงเวลารับ'],zr,['left','center','center','center','right'],['','7%','7%','7%','16%']);
    }
    o+='<tr><td style="padding:8px 0 0">'+drmCard(
      '<b style="color:'+DRM.ink+'">ต้นทุนรับส่ง</b> &nbsp; ในโควตา <b>'+D.vanIn+'</b> คัน'
      +(D.vanOut?(' · <span style="color:'+RED+';font-weight:700">นอกโควตา '+D.vanOut+' คัน</span>'):'')
      +' · ค่ารถรวม <b style="color:#c2410c">'+drB(D.vanCost)+'</b>'
      +(D.ltCost?(' · หางยาว <b>'+drB(D.ltCost)+'</b>'):'')
      +' &nbsp;·&nbsp; เฉลี่ย <b>'+drB(D.perPax)+'</b> / คน (เป้า '+drB((drCfg()||{}).targetPerPax||0)+')',
      '11px 14px',DRM.soft,'#eef0f3')+'</td></tr>';
  }

  // ── การเงิน ──
  if(I.fi){
    o+=drmSec('การเงิน', drB(D.rev));
    var PAY=[['Invoice / เครดิต',D.pay.invoice,'#1d4ed8'],['Pro forma / จ่ายล่วงหน้า',D.pay.proforma,'#0891b2'],
             ['Cash on Tour',D.pay.cot,'#b45309'],['โอนล่วงหน้า',D.pay.transfer,'#7c3aed'],
             ['บัตรเครดิต',D.pay.card,'#db2777'],['อื่น ๆ / ยังไม่ระบุ',D.pay.other,'#6b7280']];
    var fr='';
    PAY.forEach(function(p){ if(!p[1]) return; var pc=drPct(p[1],D.rev);
      fr+=drmR([drmDot(p[2])+p[0],
        '<span style="font-size:11px;font-weight:700;color:'+p[2]+'">'+pc+'%</span>'+drmBar(pc,p[2]),
        drB(p[1])],['left','left','right']); });
    o+=drmT(['ช่องทางชำระ','สัดส่วน','ยอดเงิน'],fr,['left','left','right'],['','34%','18%']);
    o+='<tr><td style="padding:8px 0 0">'+drmCard(
      '<b style="color:'+DRM.ink+'">เงินหน้างาน</b> &nbsp; ขายเพิ่ม <b>'+drB(D.extras)+'</b> · อัปเกรดเก็บแล้ว <b>'+drB(D.upGot)+'</b>'
      +(D.upDue?(' · <span style="color:'+AMB+';font-weight:700">อัปเกรดรอเก็บ '+drB(D.upDue)+'</span>'):'')+'<br>'
      +'<b style="color:'+DRM.ink+'">ต้องเก็บวันนี้</b> &nbsp; <span style="color:'+(D.due?AMB:GRN)+';font-weight:800">'+drB(D.due)+'</span>'
      +' · เก็บไปแล้ว <b>'+drB(D.got)+'</b>'
      +(D.noSlip?(' · <span style="color:'+RED+';font-weight:700">ขาดสลิป '+D.noSlip+'</span>'):'')+'<br>'
      +'<b style="color:'+DRM.ink+'">Longtail</b> &nbsp; Join <b>'+D.ltJoin+'</b> คน · เหมาลำ <b>'+D.ltChtr+'</b> ลำ',
      '11px 14px',DRM.soft,'#eef0f3')+'</td></tr>';
  }
  if(I.list){
    // ใบที่ไม่มี agent · ตั้งชื่อกลุ่มให้อ่านออก แทนที่จะโชว์รหัสช่องทางดิบ ๆ
    var _CHN={ direct:'Walk-in / Direct', walkin:'Walk-in / Direct', 'walk-in':'Walk-in / Direct',
               web:'เว็บไซต์ (B2C)', b2c:'เว็บไซต์ (B2C)', online:'เว็บไซต์ (B2C)',
               phone:'โทรจอง', line:'LINE', facebook:'Facebook', staff:'Staff / Internal' };
    function drChannelName(c){
      c=String(c||'').trim(); if(!c) return 'Walk-in / Direct';
      return _CHN[c.toLowerCase()] || (c.charAt(0).toUpperCase()+c.slice(1));
    }
    // จัดกลุ่ม agent → เส้นทาง · ใบที่ agent เดียวกันขายเส้นทางเดียวกันยุบเป็นบรรทัดเดียว
    var AG={}, AO=[];
    D.rows.forEach(function(r){
      var b=r.b, p=drPaxOf(r.t), amt=(+r.amount||0), m=drMarket(b);
      var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
      var key=b.agentId||('_'+(b.channel||'walk-in'));
      var nm=ag?(ag.name||ag.code||key):drChannelName(b.channel);
      if(!AG[key]){ AG[key]={ k:key, name:nm, mkt:m, n:0, pax:0, rev:0, rt:{}, ro:[] }; AO.push(key); }
      var a=AG[key]; a.n++; a.pax+=p.tot; a.rev+=amt;
      var rid=r.routeId||'', R=(typeof getRoute==='function'?getRoute(rid):null)||{};
      if(!a.rt[rid]){ a.rt[rid]={ id:rid, name:R.name||rid||'—', color:R.color||'#94a3b8', n:0, pax:0, rev:0 }; a.ro.push(rid); }
      var x=a.rt[rid]; x.n++; x.pax+=p.tot; x.rev+=amt;
    });
    AO.sort(function(x,y){ return (AG[y].rev-AG[x].rev) || (AG[y].pax-AG[x].pax); });
    // Gmail ตัดจดหมายที่เกิน ~102KB · วันที่ agent เยอะ ๆ ให้โชว์ 12 เจ้าแรกแล้วยุบที่เหลือ
    var AOTOP=AO.slice(0,12), AOREST=AO.slice(12);
    var restN=0, restPax=0, restRev=0;
    AOREST.forEach(function(k){ restN+=AG[k].n; restPax+=AG[k].pax; restRev+=AG[k].rev; });
    var rowsHtml='';
    AOTOP.forEach(function(k){
      var a=AG[k];
      a.ro.sort(function(x,y){ return (a.rt[y].rev-a.rt[x].rev) || (a.rt[y].pax-a.rt[x].pax); });
      // หัวกลุ่ม · ชื่อ agent + Market + ยอดรวมของเจ้านั้น
      rowsHtml+='<tr><td colspan="2" style="padding:9px 8px 7px;border-bottom:1px solid #eef0f3;background:#f7f8fa">'
        +'<b style="font-size:12.5px;color:#111827">'+ckEsc(a.name)+'</b>'
        +(a.mkt.name===a.name ? ''
          : '<span style="font-size:10.5px;color:#9ca3af;padding-left:8px">'+drmDot(a.mkt.color)+ckEsc(a.mkt.name)+'</span>')+'</td>'
        +'<td style="padding:9px 8px 7px;border-bottom:1px solid #eef0f3;background:#f7f8fa;text-align:center;'
          +'font-size:12px;font-weight:700;color:#374151">'+a.n+'</td>'
        +'<td style="padding:9px 8px 7px;border-bottom:1px solid #eef0f3;background:#f7f8fa;text-align:center;'
          +'font-size:12px;font-weight:800;color:#111827">'+a.pax+'</td>'
        +'<td style="padding:9px 8px 7px;border-bottom:1px solid #eef0f3;background:#f7f8fa;text-align:right;'
          +'font-size:12px;font-weight:800;color:#047857">'+drB(a.rev)+'</td></tr>';
      // บรรทัดเส้นทางของ agent นั้น
      a.ro.forEach(function(rid){ var x=a.rt[rid];
        rowsHtml+=drmR(['', drmDot(x.color)+ckEsc(x.name), x.n, '<b>'+x.pax+'</b>', drB(x.rev)],
          ['left','left','center','center','right']);
      });
    });
    if(AOREST.length) rowsHtml+=drmR(['','<span style="color:'+DRM.fain+'">…และอีก '+AOREST.length+' agent</span>',
      restN,'<b>'+restPax+'</b>',drB(restRev)],['left','left','center','center','right']);
    o+=drmSec('ยอดตาม Agent · เส้นทาง', AO.length+' agent · '+D.rows.length+' booking');
    o+=drmT(['','Agent · เส้นทาง','ใบ','คน','ยอดเงิน'], rowsHtml,
      ['left','left','center','center','right'], ['14','','8%','9%','16%']);
    o+='<tr><td style="padding:9px 8px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
      +'style="background:#f7f8fa;border:1px solid #eef0f3;border-radius:12px"><tr>'
      +'<td style="padding:10px 14px;font-size:12px;color:#374151">รวมทั้งวัน</td>'
      +'<td align="right" style="padding:10px 14px;font-size:12px;color:#374151">'
        +'<b style="color:#111827">'+D.rows.length+'</b> ใบ &middot; <b style="color:#111827">'+D.pax.tot+'</b> คน &middot; '
        +'<b style="font-size:14px;color:#047857">'+drB(D.rev)+'</b></td></tr></table></td></tr>';
  }


  // ── สรุปทั้งวัน ──
  o+='<tr><td style="padding:12px 0 0">'+drmCard(
    '<div style="font-size:13px;font-weight:800;color:'+DRM.ink+';padding-bottom:5px">สรุปทั้งวัน</div>'
    +'รายได้ <b style="color:'+GRN+'">'+drB(D.rev)+'</b> · ต้นทุนรับส่ง <b style="color:#c2410c">-'+drB(cost)+'</b>'
    +(D.extras?(' · ขายเพิ่มหน้างาน <b style="color:'+GRN+'">+'+drB(D.extras)+'</b>'):'')
    +' &nbsp;&rarr;&nbsp; คงเหลือก่อนต้นทุนเรือ/ครัว <b style="font-size:16px;color:'+GRN+'">'
    +drB(D.rev-cost+D.extras)+'</b>','13px 16px','#f2faf7','#cfe9de')+'</td></tr>';

  o+='<tr><td style="padding:20px 0 0;border-top:1px solid #e9ebef;font-size:10.5px;color:#9ca3af;line-height:1.7">'
    +'สร้างจากระบบ LOVE Andaman Operations &middot; ตัวเลขอ่านจากฐานข้อมูลเดียวกับหน้า Daily Report และ Travel Summary '
    +'&middot; หัวข้อที่ไม่ต้องการส่ง ปิดได้ในกล่องเขียนอีเมล</td></tr>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>'
    +'<body style="margin:0;padding:0;background:#f3f4f6">'
    +'<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:18px 12px">'
    +'<tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
    +'style="width:100%;max-width:1240px;background:#ffffff;border-radius:18px;padding:24px 28px;'
    +'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">'
    + o +'</table></td></tr></table></body></html>';
}
function drMailSubject(D){
  var d=D.date; try{ d=new Date(D.date+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }catch(_){}
  return 'LOVE Andaman · รายงานประจำวัน '+d+' — '+D.pax.tot+' คน · '+D.rows.length+' booking · '+D.rOrder.length+' เส้นทาง';
}
function drMailText(D){
  var C=drMailCfg(), L=[];
  L.push('LOVE ANDAMAN · รายงานประจำวัน '+D.date);
  if(String(C.note||'').trim()) L.push('', C.note);
  L.push('', '— ภาพรวม —',
    'ผู้โดยสาร '+D.pax.tot+' คน (ผู้ใหญ่ '+D.pax.ad+' · เด็ก '+D.pax.chd+' · ทารก '+D.pax.inf+' · FOC '+D.pax.foc+')',
    'booking '+D.rows.length+' ใบ · '+D.rOrder.length+' เส้นทาง',
    'รายได้ '+drB(D.rev)+' · เฉลี่ย '+drB(D.paxPay?D.rev/D.paxPay:0)+'/คน',
    'ที่นั่งเรือ '+D.seatTot+'/'+D.capTot+' ('+drPct(D.seatTot,D.capTot)+'%)',
    'ค่ารถ '+drB(D.vanCost)+' · '+drB(D.perPax)+'/คน');
  L.push('', '— Market —');
  D.mOrder.forEach(function(id){ var m=D.mkt[id]; L.push('  '+m.name+' — '+m.pax+' คน ('+drPct(m.pax,D.pax.tot)+'%) · '+drB(m.rev)); });
  L.push('', '— เส้นทาง —');
  D.rOrder.forEach(function(id){ var r=D.routes[id];
    L.push('  '+r.name+' — '+r.pax+' คน · '+r.n+' ใบ · ที่นั่ง '+r.seats+'/'+(r.cap||'-')+' · '+drB(r.rev)); });
  L.push('', '— ต้องเคลียร์ก่อนปิดวัน —');
  var any=false;
  if(D.warn.noVan){ any=true; L.push('  ! ยังไม่จัดรถ '+D.warn.noVan+' ใบ ('+D.noVan.pax+' คน)'); }
  if(D.warn.noBoat){ any=true; L.push('  ! ยังไม่จัดเรือ '+D.warn.noBoat+' ใบ ('+D.noBoat.pax+' คน)'); }
  if(D.warn.over){ any=true; L.push('  ! เรือเกินความจุ '+D.warn.over+' ลำ'); }
  if(D.ret.todo){ any=true; L.push('  ! ส่งคนละที่ยังไม่จัดรถกลับ '+D.ret.todo+' ใบ'); }
  if(D.warn.doc){ any=true; L.push('  ! เอกสารยังไม่ครบ '+D.warn.doc+' ใบ'); }
  if(D.due>0){ any=true; L.push('  ! ต้องเก็บหน้างาน '+drB(D.due)); }
  if(!any) L.push('  ไม่มีรายการค้าง');
  L.push('', '— ยอดตาม Agent · เส้นทาง —');
  var AG2={}, AO2=[];
  D.rows.forEach(function(r){
    var b=r.b, p=drPaxOf(r.t), amt=(+r.amount||0);
    var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var key=b.agentId||('_'+(b.channel||'walk-in'));
    var nm=ag?(ag.name||ag.code||key):(({direct:'Walk-in / Direct','walk-in':'Walk-in / Direct',walkin:'Walk-in / Direct',web:'เว็บไซต์ (B2C)',b2c:'เว็บไซต์ (B2C)'})[String(b.channel||'').toLowerCase()]||b.channel||'Walk-in / Direct');
    if(!AG2[key]){ AG2[key]={name:nm,n:0,pax:0,rev:0,rt:{},ro:[]}; AO2.push(key); }
    var a=AG2[key]; a.n++; a.pax+=p.tot; a.rev+=amt;
    var rid=r.routeId||'', R=(typeof getRoute==='function'?getRoute(rid):null)||{};
    if(!a.rt[rid]){ a.rt[rid]={name:R.name||rid||'-',n:0,pax:0,rev:0}; a.ro.push(rid); }
    var x=a.rt[rid]; x.n++; x.pax+=p.tot; x.rev+=amt;
  });
  AO2.sort(function(x,y){ return AG2[y].rev-AG2[x].rev; });
  AO2.forEach(function(k){ var a=AG2[k];
    L.push('  '+a.name+' — '+a.n+' ใบ · '+a.pax+' คน · '+drB(a.rev));
    a.ro.forEach(function(rid){ var x=a.rt[rid];
      L.push('     · '+x.name+' — '+x.n+' ใบ · '+x.pax+' คน · '+drB(x.rev)); });
  });
  L.push('  รวม '+D.rows.length+' ใบ · '+D.pax.tot+' คน · '+drB(D.rev));
  L.push('', 'สร้างจากระบบ LOVE Andaman Operations');
  return L.join('\n');
}
function drMailShow(){ _drMailOpen=true; drMailPaint();
  try{ drmEnsureImgs(drData(_drDate)); }catch(_){} }
function drMailClose(){ _drMailOpen=false; var h=document.getElementById('dr-mail-host'); if(h) h.innerHTML=''; }
function drMailToast(t){
  var h=document.getElementById('dr-mail-toast'); if(!h) return;
  h.textContent=t; h.style.opacity='1';
  setTimeout(function(){ try{ h.style.opacity='0'; }catch(_){} }, 2200);
}
// คัดลอกแบบ rich text · วางใน Gmail/Outlook แล้วตารางกับสียังอยู่
function drMailCopy(){
  var html=drMailHTML(drData(_drDate)), txt=drMailText(drData(_drDate));
  var done=function(){ drMailToast('คัดลอกแล้ว · ไปวางในช่องเขียนอีเมลได้เลย'); };
  try{
    if(navigator.clipboard && window.ClipboardItem){
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html],{type:'text/html'}),
        'text/plain': new Blob([txt],{type:'text/plain'})
      })]).then(done, function(){ drMailCopyFallback(html); });
      return;
    }
  }catch(_){}
  drMailCopyFallback(html);
}
function drMailCopyFallback(html){
  try{
    var d=document.createElement('div');
    d.contentEditable='true'; d.innerHTML=html;
    d.style.cssText='position:fixed;left:-9999px;top:0;white-space:pre-wrap';
    document.body.appendChild(d);
    var r=document.createRange(); r.selectNodeContents(d);
    var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.execCommand('copy'); sel.removeAllRanges(); d.remove();
    drMailToast('คัดลอกแล้ว · ไปวางในช่องเขียนอีเมลได้เลย');
  }catch(e){ drMailToast('คัดลอกไม่สำเร็จ · ใช้ปุ่มดาวน์โหลด .eml แทน'); }
}
// .eml · เปิดเป็นฉบับร่างในโปรแกรมเมล ผู้รับ/หัวเรื่อง/เนื้อหาครบ กดส่งได้เลย
function drMailEml(){
  var D=drData(_drDate), C=drMailCfg();
  var b64=function(str){
    var u=new TextEncoder().encode(str), s2='';
    for(var i=0;i<u.length;i++) s2+=String.fromCharCode(u[i]);
    var raw=btoa(s2), out='';
    for(var j=0;j<raw.length;j+=76) out+=raw.slice(j,j+76)+'\r\n';
    return out;
  };
  var subj='=?UTF-8?B?'+btoa(String.fromCharCode.apply(null, new TextEncoder().encode(drMailSubject(D))))+'?=';
  var bd='LA-'+Math.abs(D.date.replace(/-/g,'')|0)+'-boundary';
  var eml=['To: '+(C.to||''), (C.cc?('Cc: '+C.cc):''), 'Subject: '+subj,
    'MIME-Version: 1.0', 'X-Unsent: 1',
    'Content-Type: multipart/alternative; boundary="'+bd+'"', '',
    '--'+bd, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    b64(drMailText(D)),
    '--'+bd, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    b64(drMailHTML(D)),
    '--'+bd+'--', ''].filter(function(x){ return x!==''||true; }).join('\r\n');
  try{
    var blob=new Blob([eml],{type:'message/rfc822'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='LOVE_Andaman_DailyReport_'+D.date+'.eml';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 800);
    drMailToast('ดาวน์โหลดแล้ว · เปิดไฟล์ .eml เพื่อกดส่ง');
  }catch(e){ drMailToast('สร้างไฟล์ไม่สำเร็จ · ใช้ปุ่มคัดลอกแทน'); }
}
function drMailto(){
  var D=drData(_drDate), C=drMailCfg();
  var url='mailto:'+encodeURIComponent(C.to||'')
    +'?subject='+encodeURIComponent(drMailSubject(D))
    +(C.cc?('&cc='+encodeURIComponent(C.cc)):'')
    +'&body='+encodeURIComponent(drMailText(D).slice(0,1800));
  try{ window.location.href=url; }catch(_){}
}
function drMailPaint(){
  var host=document.getElementById('dr-mail-host'); if(!host) return;
  if(!_drMailOpen){ host.innerHTML=''; return; }
  var e=ckEsc, D=drData(_drDate), C=drMailCfg();
  var _imgSt=(_drImg.key===drImgKey(D))?_drImg.state:'';
  var IMGLINE = _imgSt==='ok'
      ? '<span style="color:#047857">&#10003; กราฟพร้อมแล้ว · ส่งไปจะเห็นเป็นรูปเหมือนหน้าจอ</span>'
      : _imgSt==='run' ? '<span style="color:#b45309">กำลังเตรียมรูปกราฟ…</span>'
      : _imgSt==='err' ? '<span style="color:#be123c">เตรียมรูปกราฟไม่สำเร็จ · จดหมายจะใช้กราฟแท่งแทน</span>'
      : '';
  var SEC=[['ov','ภาพรวม + Market'],['rt','แยกตามเส้นทาง'],['bt','เรือ'],['vn','รถรับส่ง'],
           ['px','ผู้โดยสาร · เอกสาร · ขากลับ'],['fi','การเงิน'],['todo','ต้องเคลียร์ก่อนปิดวัน'],['list','ยอดตาม Agent · เส้นทาง']];
  host.innerHTML='<div class="dr-mask" onclick="drMailClose()"></div><div class="dr-modal">'
    +'<div class="dr-mh"><div><b>ส่งรายงานทางอีเมล</b>'
      +'<span>ประกอบจดหมายให้ครบแล้วคัดลอกไปวาง หรือดาวน์โหลดเป็นฉบับร่าง (.eml)</span></div>'
      +'<button class="dr-x" onclick="drMailClose()">&#10005;</button></div>'
    +'<div class="dr-mb">'
      +'<div class="dr-mform">'
        +'<label>ถึง<input value="'+e(C.to)+'" placeholder="ops@loveandaman.com, manager@..." '
          +'oninput="drMailField(\'to\',this.value)"></label>'
        +'<label>สำเนา (Cc)<input value="'+e(C.cc)+'" placeholder="เว้นว่างได้" oninput="drMailField(\'cc\',this.value)"></label>'
        +'<label>หัวเรื่อง<input value="'+e(drMailSubject(D))+'" readonly style="background:#f9fafb;color:#6b7280"></label>'
        +'<label>ข้อความนำ<textarea rows="4" oninput="drMailField(\'note\',this.value)">'+e(C.note)+'</textarea></label>'
        +'<div class="dr-mchk"><span class="lb">หัวข้อที่จะใส่ในอีเมล</span>'
        + SEC.map(function(x){ return '<label class="ck"><input type="checkbox" '+(C.inc[x[0]]?'checked':'')
            +' onchange="drMailToggle(\''+x[0]+'\',this.checked)">'+e(x[1])+'</label>'; }).join('')
        +'</div>'
        +(IMGLINE?('<div style="font-size:11px;font-weight:600;padding:2px 0 6px">'+IMGLINE+'</div>'):'')
        +'<div class="dr-mact">'
          +'<button class="dr-btn pri" onclick="drMailCopy()">&#128203; คัดลอกไปวางในอีเมล</button>'
          +'<button class="dr-btn" onclick="drMailEml()">&#11015; ดาวน์โหลดฉบับร่าง .eml</button>'
          +'<button class="dr-btn" onclick="drMailto()">&#9993; เปิดโปรแกรมเมล</button>'
        +'</div>'
        +'<p class="dr-mhint">คัดลอกแล้ววางใน Gmail / Outlook จะได้ตารางและสีครบ · ไฟล์ .eml เปิดแล้วเป็นฉบับร่างพร้อมผู้รับ กดส่งได้เลย · '
          +'ปุ่มเปิดโปรแกรมเมลจะได้ข้อความล้วน (ระบบเมลไม่รองรับ HTML ผ่าน mailto)</p>'
      +'</div>'
      +'<div class="dr-mprev"><div class="lb">ตัวอย่างจดหมาย</div>'
        +'<iframe id="dr-mail-frame" title="preview"></iframe></div>'
    +'</div><div id="dr-mail-toast" class="dr-toast"></div></div>';
  try{
    var f=document.getElementById('dr-mail-frame');
    var doc=f.contentDocument||f.contentWindow.document;
    doc.open(); doc.write(drMailHTML(D)); doc.close();
  }catch(_){}
}
/* §agAll · ตาราง Agent contribution ตัดที่ 15 เจ้า · ที่เหลือเป็นบรรทัด "… N more" ที่กดไม่ได้
   118 เจ้าเห็นแค่ 15 แปลว่า 103 เจ้าที่เหลือดูไม่ได้เลยจากหน้านี้
   และเจ้าที่ขาดทุนมักไม่ได้อยู่ 15 อันดับแรก (เรียงตาม total net) — คือกลุ่มที่ต้องดูที่สุด */
function pxAgAll(){ _px.agAll=!_px.agAll; renderTripPL(); }
/* §pxMkt · กางตลาดหนึ่งตลาดเพื่อดูว่าเจ้าไหนดันขึ้น เจ้าไหนถ่วงลง · ทีละตลาดพอ
   กางพร้อมกันหลายตลาดทำให้ตารางยาวจนหาที่ค้างไว้ไม่เจอ */
function pxMkOpen(k){ _px.mkO=(_px.mkO===k)?'':String(k||''); renderTripPL(); }

/* แผนต้นทุนของเส้นทางนี้ · ใช้แค่ ovr/grp (ที่ปรับ-ปิดรายเส้นทาง)
   ไม่ใช้ pax/price/boats/fuel ของแผน เพราะนั่นเป็นค่าไว้ลองเล่นในหน้าต้นทุน
   ถ้าเอามาใช้ วันหนึ่งมีคนเลื่อน pax เล่น กำไรของเมื่อวานจะขยับตาม */
function pxPlanFor(routeId){
  var fam=(typeof bkV2RouteFamily==='function')?bkV2RouteFamily(routeId):null;
  var fid=(fam&&fam.id)||routeId;
  var P=(typeof ctPlans==='function')?ctPlans():[];
  /* §ctRoute · เส้นทางตรงมาก่อนเสมอ · แผนที่ผูกไว้ระดับกลุ่ม (ของเก่า) เป็นตัวสำรอง */
  var hit=P.filter(function(p){ return p.famId===routeId; })[0]
        || P.filter(function(p){ return p.famId===fid; })[0];
  /* §fuelPlan · ส่ง fuel ออกมาด้วยแต่ตั้งชื่อแยกให้ชัด · ใช้เป็น "ตัวสำรองท้ายสุด" เท่านั้น
     ไม่ได้ป้อนเข้า ctCalc · กติกาเดิมยังอยู่ ตัวเลขที่ไว้ลองเล่นในหน้าแผนต้องไม่ขยับกำไรของเมื่อวาน
     แต่ถ้า "ไม่มีราคาจริงเลย" การใช้ราคาที่ตั้งไว้ ยังใกล้ความจริงกว่าการคิดเป็น ฿0 */
  return hit ? {id:hit.id, name:hit.name, ovr:hit.ovr||{}, grp:hit.grp||{}, planFuel:+hit.fuel||0} : null;
}
/* หัวที่เดินทางจริงของลำหนึ่ง · แยกไทย/ต่างชาติเพื่อคิดค่าอุทยาน
   คนที่ไม่ระบุสัญชาติ นับเป็นต่างชาติ · คิดสูงไว้ก่อนดีกว่าคิดต่ำแล้วขาดทุนแบบไม่รู้ตัว */
function pxPax(date, bid){
  var o={ad:0,chd:0,inf:0,foc:0,tot:0,th:0,fr:0,bk:0,rev:0};
  var KIND=['ad','chd','inf','foc'];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;
    var booked=ckBookedPax(t);
    var tot=pckOnBoard(b,date,booked);                     /* §ckPierSelf2 */
    if(!tot) return;
    o.bk++;
    var px=t.pax||{}, bookedTot=0, th=0;
    KIND.forEach(function(k){ bookedTot+=(+px[k]||0)+(+px[k+'_fr']||0)+(+px[k+'_th']||0); th+=(+px[k+'_th']||0); });
    /* คนหายไปกี่คน หักตามสัดส่วน · ไม่มีทางรู้ว่าคนที่ไม่มาเป็นสัญชาติไหน */
    var ratio=bookedTot?(tot/bookedTot):0;
    KIND.forEach(function(k){
      var n=((+px[k]||0)+(+px[k+'_fr']||0)+(+px[k+'_th']||0))*ratio;
      o[k]+=n;
    });
    o.th+=th*ratio; o.tot+=tot;
    o.rev+=(typeof tsTripAmount==='function')?(+tsTripAmount(b,t)||0):0;
  });
  ['ad','chd','inf','foc'].forEach(function(k){ o[k]=Math.round(o[k]); });
  o.th=Math.round(o.th); o.fr=Math.max(0,o.tot-o.th);
  return o;
}
/* §pxOd · หางยาวที่ลูกค้าสั่งจริงของลำนั้น · เหมากี่ลำ จอยกี่คน
   เดิม P&L เอาเรตต่อหัวไปคูณหัวทั้งลำ ทั้งที่คนซื้อจริงมีไม่กี่คน */
/* §ltUpg (2 ก.ย. 2026) · ใบที่จอยแล้วอัปเกรดเป็นเหมาหน้างาน ตัวนี้ไม่เคยเห็น
   เดิมอ่านจาก bkV2AddOnFlags + ของขายเพิ่มหน้างานเท่านั้น · รายการอัปเกรดอยู่ที่ b.upgrades
   ซึ่งเก็บเป็น "รายการเงิน + ข้อความ" ไม่มีช่องไหนบอกว่าการจัดเรือเปลี่ยนไป
   ผลคือคนที่อัปเกรดแล้วยังถูกนับเป็นจอยอยู่ และเรือเหมาที่ต้องจัดจริงไม่โผล่เลย
   (ในฐานข้อมูลมี 7 ใบ)

   ระบบมีคำตอบที่ถูกอยู่แล้วที่ bkLtState() (§ltOne) ซึ่งรวม วอยเชอร์ + ขายเพิ่ม + อัปเกรด
   ใบงานไกด์กับสรุปหัวทริปใช้ตัวนี้อยู่แล้ว · ชีทหางยาวกับ P&L รายทริปยังไม่ได้ใช้
   ย้ายมาใช้ตัวเดียวกันทั้งหมด จะได้ไม่มีสองคำตอบในระบบเดียว */
function pxLongtail(date, bid){
  var chtr = 0, join = 0, upg = 0, upgDue = 0;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;
    var LT=(typeof bkLtState==='function')?bkLtState(b, t.routeId, date):null;
    if(!LT || LT.mode==='none') return;
    if(LT.mode==='charter'){
      chtr += (+LT.boats||0);
      upg += (+LT.up||0); upgDue += (+LT.upDue||0);
    } else {
      /* §pcReal · จอยคิดเป็นหัว · คนไม่มา = ไม่ได้ลงหางยาว ต้องหักออก
         ใช้ pckOnBoard ตัวเดียวกับ pxPax / ค่าอุทยาน จะได้ไม่มีสองคำตอบในระบบ
         ฝั่งเหมาไม่หัก · สั่งเป็นลำไปแล้วตั้งแต่ก่อนออก ต่อให้ขาดคนก็ยังต้องจ่ายทั้งลำ */
      var _bk=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0;
      var pax=(typeof pckOnBoard==='function')?pckOnBoard(b,date,_bk):_bk;
      /* §ltJoinQty · ระบุจำนวนไว้ = ใช้เลขนั้น · แต่ยังครอบด้วยคนที่อยู่บนเรือจริง
         คนที่ไม่มาก็ลงหางยาวไม่ได้ ต่อให้จองจอยไว้ */
      var _jb=(LT.joinPax!=null)?Math.min(+LT.joinPax||0,pax):pax;
      join += (LT.joinBooked?_jb:0) + (+LT.joinExtra||0);
    }
  });
  return { chtr:chtr, join:join, upg:upg, upgDue:upgDue };
}
/* §pxOd · ของที่ขายเพิ่มหน้างาน · เก็บอยู่สองที่ (ขายเพิ่ม กับ อัพเกรด) โครงเดียวกัน
   นับเฉพาะ "บริษัทได้" ไม่ใช่ยอดขาย · ค่าคอมหักอยู่ในนั้นแล้ว จึงไม่ต้องมีบรรทัดต้นทุนค่าคอม
   ผูกเข้าลำตามใบจองที่ขายให้ · ทุกรายการในระบบมีเลขใบจองครบ */
function pxUpsell(date, bid){
  var rows=[], sell=0, comp=0, comm=0, mine={};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    mine[b.id]=b; if(b.code) mine[b.code]=b;
    /* อัพเกรดผูกกับใบจอง ไม่ได้ผูกกับวัน · ใบที่มีหลายทริปให้ลงวันแรกวันเดียว กันนับซ้ำ */
    var first=((b.trips||[])[0]||{}).date||'';
    if(first && first!==date) return;
    (b.upgrades||[]).forEach(function(u){
      var c=+u.toCompany||0, m=+u.commission||0, sp=+u.sellPrice||0;
      rows.push({ vc:(b.voucherRef||b.code||b.id||''), label:u.label||'อัพเกรด', sell:sp, comp:c, comm:m,
                  seller:u.seller||'', got:!!u.collected, kind:'upg' });
      sell+=sp; comp+=c; comm+=m;
    });
  });
  (typeof SB_EXTRAS!=='undefined'?SB_EXTRAS:[]).forEach(function(e){
    if(String(e.tripDate||'')!==date) return;
    var b=mine[e.bookingId]; if(!b) return;
    var sp=+e.total||0, c=+e.toCompany||0, m=+e.commission||0;
    rows.push({ vc:(b.voucherRef||b.code||b.id||''), label:e.service||'ขายเพิ่ม', sell:sp, comp:c, comm:m,
                seller:e.seller||'', got:((typeof bkxExGot==='function')?bkxExGot(e):true), kind:'ex' });
    sell+=sp; comp+=c; comm+=m;
  });
  return { rows:rows, sell:Math.round(sell), company:Math.round(comp), comm:Math.round(comm) };
}
/* §pxAgent · เงินของลำนี้มาจากเจ้าไหนบ้าง · เงื่อนไขคัดใบจองต้องตรงกับ pxPax เป๊ะ
   ไม่งั้นยอดรวมสองที่จะไม่ตรงกัน แล้วไม่มีใครรู้ว่าอันไหนถูก */
/* §agFair · รวมตัวนับสองก้อนเข้าด้วยกัน / หาคีย์ที่มีน้ำหนักมากสุด
   ใช้บอกว่า "ช่องนี้ส่วนใหญ่เป็นสัญญาไหน โซนไหน" โดยไม่ต้องเก็บรายใบไว้ทั้งเดือน */
function pxMrg(D,S){ if(!D||!S) return; Object.keys(S).forEach(function(k){ D[k]=(D[k]||0)+S[k]; }); }
function pxTopK(m){ var b='',v=-1; Object.keys(m||{}).forEach(function(k){ if(m[k]>v){ v=m[k]; b=k; } }); return b; }
function pxAgents(date, bid){
  var M={}, ord=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    if(typeof pckVoidInfo==='function' && pckVoidInfo(b,date,t)) return;
    var booked=ckBookedPax(t);
    var tot=pckOnBoard(b,date,booked);                     /* §ckPierSelf2 */
    if(!tot) return;
    var b2c=/^b2c_/.test(String(b.id||''));
    var ag=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null;
    var nm=ag?(ag.name||ag.code||'—'):(b2c?'Love Andaman':String(b.channel||'walk-in'));
    var key=(ag&&ag.id)||(b2c?'_b2c':('_'+nm));
    /* §pxMkt · ตลาดของเจ้านี้ · ใบตรง/หน้าเคาน์เตอร์ให้ตกไปอยู่ walkin ไม่ใช่ค้างเป็นช่องว่าง */
    var mk=(ag&&ag.market)||(b2c?'walkin':'');
    if(!M[key]){ M[key]={ key:key, name:nm, b2c:b2c, mk:mk, n:0, head:0, ad:0, chd:0, amt:0,
                          exp:0, expAmt:0, expPax:0, expMiss:0, zn:{}, rtn:{} }; ord.push(key); }
    var A=M[key], px=t.pax||{}, PT=(typeof bkV2PaxTot==='function')?bkV2PaxTot:function(){return 0;};
    var chd=Math.min(PT(px,'chd'), tot);
    A.n++; A.head+=tot; A.chd+=chd; A.ad+=Math.max(0,tot-chd);
    var _amt=(typeof tsTripAmount==='function')?(+tsTripAmount(b,t)||0):0;
    A.amt+=_amt;
    /* §agFair · ราคาที่ควรได้ตาม rate card ของใบนี้เอง (โซน สัญชาติ เด็ก/ผู้ใหญ่ ตามที่จองจริง)
       ตัวเทียบเดิมคือค่าเฉลี่ยรวมทุกเอเจนต์ทุกโซน · สัญญาโปรฯ + โซนไม่รับส่ง จึงถูกฟ้องว่า
       "จ่ายต่ำกว่าราคา" ทั้งที่จ่ายครบตามที่เราตั้งเอง
       ฐานเทียบต้องเป็นจำนวนที่จอง ไม่ใช่จำนวนที่ขึ้นเรือ เพราะเงินคิดจากที่จอง
       ใบไหนจับคู่เรตไม่ได้ (ตั้งราคาเอง / ไม่มี rate type) นับ expMiss แล้วกันออก ไม่เอามาเฉลี่ยปน */
    var _nf=null;
    try{ _nf=(typeof tsNetOf==='function')?tsNetOf({b:b,t:t}):null; }catch(_){ _nf=null; }
    if(_nf && _nf.tot>0){
      A.exp+=_nf.tot; A.expAmt+=_amt; A.expPax+=booked;
      if(_nf.zone) A.zn[_nf.zone]=(A.zn[_nf.zone]||0)+booked;
      if(_nf.rt)   A.rtn[_nf.rt]=(A.rtn[_nf.rt]||0)+booked;
    } else A.expMiss++;
  });
  return ord.map(function(k){ return M[k]; }).sort(function(a,b){ return b.amt-a.amt; });
}
/* รถที่วิ่งให้ลำนี้จริง · นับเป็นคัน ไม่ใช่เป็นใบจอง
   รถคันเดียวส่งขึ้นสองลำ → หารตามจำนวนหัวที่ส่งขึ้นแต่ละลำ ไม่ใช่หารครึ่ง */
function pxVanCost(date, bid, routeId){
  var mine={}, all={};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=ckTripOn(b,date); if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    var vid=O.vanId; if(!vid) return;
    var tb=(O.boatId||t.charterBoatId)||'';
    var pax=(typeof ckBookedPax==='function')?ckBookedPax(t):0;
    all[vid]=(all[vid]||0)+pax;
    if(tb===bid){
      mine[vid]=(mine[vid]||0)+pax;
      /* โซนที่ไปรับ · คันเดียวรับปนสองโซน ให้ยึดโซนที่แพงกว่า เพราะรถวิ่งไกลสุดจริง */
      var a=(b.pickupAreaId && typeof bkV2GetArea==='function')?bkV2GetArea(b.pickupAreaId):null;
      var z=(a&&a.zone)||'';
      if(z==='KL') mine['_z'+vid]='KL'; else if(!mine['_z'+vid]) mine['_z'+vid]='PK';
    }
  });
  var tot=0, list=[];
  Object.keys(mine).forEach(function(vid){
    if(vid.indexOf('_z')===0) return;
    var v=(typeof vehGet==='function')?vehGet(vid):null; if(!v) return;
    var day=vanDayCost(v, routeId, mine['_z'+vid]||'PK');
    var share=(all[vid]>0)?(mine[vid]/all[vid]):1;
    tot+=day*share;
    list.push({name:v.name||vid, day:day, share:share, zone:mine['_z'+vid]||'PK'});
  });
  return {total:Math.round(tot), vans:list};
}
/* หนึ่งทริป · รายได้ ต้นทุน กำไร พร้อมที่มาของทุกบรรทัด */
function pxTrip(date, bid){
  var boat=(typeof getBoat==='function'?getBoat(bid):null)||{};
  var op=(typeof TRIPS!=='undefined' && TRIPS[date])?TRIPS[date][bid]:null;
  var rid=(op&&op.route)||'';
  var rt=(typeof getRoute==='function'?getRoute(rid):null)||{};
  var PX=pxPax(date,bid);
  var A=(typeof taGet==='function')?(taGet(date,bid)||{}):{};
  var T=(typeof ctTpl==='function')?ctTpl():null;
  var R=(typeof ctVatR==='function')?ctVatR(T):0;
  var plan=pxPlanFor(rid);
  /* §fuelEff · ไม่มีราคาของวันนั้นก็ไล่หาที่ใกล้เคียงที่สุด · ศูนย์บาทไม่ใช่คำตอบที่ถูก
     ชั้นสุดท้ายคือราคาที่ตั้งไว้ในแผนของเส้นทางนั้น (หน้าต้นทุน) ซึ่งเป็นตัวเลขที่ทีมตั้งเอง */
  var FP=(typeof flFuelPriceEff==='function')?flFuelPriceEff(date,boat):{price:0,src:'',from:''};
  if(!FP.price && plan && plan.planFuel>0) FP={price:plan.planFuel, src:'plan', from:''};
  var fuelPr=FP.price||0;
  /* §pxOd · จำนวนที่ลูกค้าสั่งจริงของลำนี้ · ป้อนเข้าสูตรแทนจำนวนที่คาดไว้ในแผน */
  var LT=(typeof pxLongtail==='function')?pxLongtail(date,bid):{chtr:0,join:0};
  var ctx={ eng:((+boat.engineCount||3)>=4?'4EN':'3EN'), boats:1, fuel:fuelPr,
            boatId:bid, date:date,            /* §boatRent · ลำที่ออกจริง · §rentSpan · วันที่เทียบช่วงสัญญา */
            odQty:{ ltj:LT.join, ltc:LT.chtr },
            pax:PX.tot, paxTH:PX.th, paxFR:PX.fr,
            /* §ctChd · ทารกนับรวมกับเด็ก · ไม่มีทางที่ทารกจะกินเท่าผู้ใหญ่ */
            paxCh:Math.min(PX.tot, (PX.chd||0) + (PX.inf||0)) };
  var C=(typeof ctCalc==='function')?ctCalc(plan||{}, ctx, T):{rows:[],net:0};

  /* ของจริงทับค่าประมาณเป็นรายบรรทัด */
  var act={};
  try{
    var FD=(typeof FL_DAILY!=='undefined' && FL_DAILY[date])?FL_DAILY[date][bid]:null;
    if(FD && +FD.fuel>0 && fuelPr>0) act.fuel={amt:Math.round((+FD.fuel)*fuelPr),
      why:(+FD.fuel)+' ลิตร × ฿'+fuelPr+(FP.src==='boat'||FP.src==='pier'?'':(' · '+flFuelSrcTxt(FP)))};
  }catch(_){}
  if(A.meal && A.meal.amount!=null)
    act.meal={amt:Math.round(+A.meal.amount||0),
              why:(A.meal.name||'')+' · ผู้ใหญ่ '+(A.meal.ad||0)+'×'+(A.meal.priceAd||0)
                  +(A.meal.chd?(' + เด็ก '+A.meal.chd+'×'+(A.meal.priceCh||0)):'')};
  var VN=pxVanCost(date,bid,rid);
  if(VN.vans.length)
    act.van={amt:VN.total, why:VN.vans.map(function(v){
      return v.name+' ฿'+Math.round(v.day)+(v.share<0.999?(' ×'+Math.round(v.share*100)+'%'):'')+' ('+v.zone+')'; }).join(' · ')};

  /* §pxSrc · บรรทัดนี้ถูกปรับในแผนของเส้นทางนี้ไหม · ไม่ใช่แค่ว่ามี key แต่ต้องมีค่าจริง */
  var ovrOf=(plan&&plan.ovr)||{}, grpOf=(plan&&plan.grp)||{};
  function pxIsOvr(id, g){
    var o=ovrOf[id];
    if(o){
      if(o.off) return true;
      var ps=o.p||[];
      for(var i=0;i<ps.length;i++){ var q=ps[i]||{};
        for(var k in q){ if(q[k]!=='' && q[k]!=null) return true; } }
    }
    var G=grpOf[g]; if(G && (G.off || (+G.mul && +G.mul!==100 && +G.mul!==1))) return true;
    return false;
  }
  /* ร้านอาหารที่ตั้งไว้แล้วแต่ยังไม่ได้กดส่งรายการ · ตัวเลขที่ใช้อยู่จึงยังเป็นสูตร ทั้งที่ของจริงรออยู่ */
  var mealWait=null;
  try{
    if(!act.meal){
      var V=(typeof mvForTrip==='function')?mvForTrip(date,bid,rid):null;
      if(V){
        var nCh=Math.min(PX.chd, PX.tot), nAd=Math.max(0, PX.tot-nCh-PX.inf);
        var exp=(typeof mvCost==='function')?mvCost(V, nAd, nCh):null;
        mealWait={ name:(V.name||''), exp:exp,
                   why:'\u0e23\u0e49\u0e32\u0e19 '+(V.name||'')+' \u00b7 '+nAd+'\u00d7\u0e3f'+(+V.priceAd||0)
                       +(nCh?(' + \u0e40\u0e14\u0e47\u0e01 '+nCh+'\u00d7\u0e3f'+(+V.priceCh||0)):'')
                       +' = \u0e3f'+Math.round(exp||0).toLocaleString()+' \u00b7 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e2a\u0e48\u0e07\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e23\u0e49\u0e32\u0e19' };
      }
    }
  }catch(_){}
  var rows=(C.rows||[]).map(function(r){
    var a=act[r.id];
    var est=r.net;                                   /* สูตรคิดเป็นยอดหลังหัก VAT ซื้อแล้ว */
    var real=a ? (a.amt - (r.vat ? a.amt*R : 0)) : null;
    var src = (real!=null) ? 'r' : (pxIsOvr(r.id, r.g) ? 'p' : 'f');
    var why = a ? a.why : '';
    /* §pxOd · จำนวนมาจากใบจองจริง ไม่ใช่ตัวประมาณ · ป้ายจึงเป็น "ของจริง" */
    if(r.id==='fuel' && real==null){
      if(!fuelPr) why='ยังไม่ได้ลงราคาน้ำมัน · บรรทัดนี้จึงเป็น ฿0 ทั้งที่เรือวิ่งจริง';
      else if(FP.src==='sib' || FP.src==='back' || FP.src==='plan') why=flFuelSrcTxt(FP)+' · ฿'+fuelPr+'/ลิตร';
    }
    /* §boatRent · ค่าเช่าเป็นเลขตามสัญญา ไม่ใช่ค่าประมาณจากสูตร ป้ายจึงเป็น "ของจริง" */
    if(r.id==='rent' && real==null && C.rent){
      src='r';
      why=ctB(C.rent.amt)+'/'+C.rent.days+' วัน · หยุด '+C.rent.off+' → วิ่ง '+C.rent.runDays+' วัน'
         +' = '+ctB(C.rent.perDay)+'/วัน'+(C.rent.trips>1?(' ÷ '+C.rent.trips+' รอบ'):'');
    }
    if(r.id==='ltj' && real==null){ src='r'; why='จอยจริง '+LT.join+' คน (ไม่ใช่ '+PX.tot+' หัวทั้งลำ)'; }
    if(r.id==='ltc' && real==null){ src='r'; why='เหมาจริง '+LT.chtr+' ลำ'; }
    if(r.id==='meal' && real==null && mealWait){ src='w'; why=mealWait.why; }
    return { id:r.id, g:r.g, l:r.l, vat:!!r.vat, est:est, real:real, why:why, src:src,
             gross:(a?a.amt:null), use:(real!=null?real:est) };
  });
  var cost=0; rows.forEach(function(r){ cost+=r.use; });
  var revGross=PX.rev;
  /* §pxOd · เงินขายเพิ่มหน้างานไม่ได้อยู่ในยอดใบจอง · ต้องบวกเข้ามาเอง
     บวกเฉพาะส่วนที่บริษัทได้ ค่าคอมจึงไม่ต้องตั้งเป็นต้นทุนอีกบรรทัด */
  var UP=(typeof pxUpsell==='function')?pxUpsell(date,bid):{rows:[],sell:0,company:0,comm:0};
  var revNet=(revGross+UP.company)*(1-R);             /* รายได้ไม่รวม VAT ขาย */
  /* §pxFreeze · ปิดยอดแล้ว = ตัวเลขเงินหยุดนิ่ง · แก้สูตรหรือขึ้นราคาทีหลังต้องไม่ย้อนมาขยับ
     หัวคนยังคิดสดอยู่ เพราะนั่นเป็นข้อเท็จจริงของวันนั้น ไม่ใช่ราคาที่เราตั้งเอง */
  var frozen=null;
  if(A.closed){
    var Z=A.closed, ZM={};
    (Z.rows||[]).forEach(function(x){ ZM[x.id]=x; });
    rows=rows.map(function(r){
      var z=ZM[r.id]; if(!z) return r;
      return { id:r.id, g:r.g, l:r.l, vat:r.vat, est:r.est, real:(z.real?z.amt:r.real),
               why:r.why, src:r.src, gross:r.gross, use:z.amt };
    });
    cost=+Z.cost||0; revNet=+Z.rev||0;
    frozen={ at:Z.at||'', by:Z.by||'', pax:Z.pax };
  }
  /* ══ §pxNoSail · เรือที่อยู่บนกระดาน แต่ไม่มีใครขึ้นเลย ═══════════════════
     pxDay หยิบ "ทุกลำที่มีเส้นทางอยู่ใน TRIPS ของวันนั้น" มาคิดต้นทุน
     ซึ่งแปลว่า "จัดเรือไว้" ไม่ใช่ "เรือออก" — สองอย่างนี้ไม่เหมือนกัน
     สูตรต้นทุนส่วนใหญ่ไม่ผูกกับจำนวนคน (ค่าเสื่อม กัปตัน เด็กเรือ ไกด์ ค่าเทียบท่า
     และน้ำมันที่คิดจากชั่วโมงเครื่อง) ลำที่ไม่มีใครขึ้นจึงยังโดนชาร์จเต็มจำนวน
     ตัวอย่างจริง 30 ส.ค. 2026 · Aluminous2 Whale Shark 0 คน แต่ ฿32,764
     ทั้งเดือน ก.ค. มี 18 ลำแบบนี้ รวม ฿466,683 ดัน cost ratio ของเดือนจาก 89% เป็น 98%

     กติกา: 0 คน + 0 ใบจอง = ไม่ได้ออก · ต้นทุนเป็น 0
     "0 ใบจอง" สำคัญกว่า "0 คน" — ลำที่มีใบจองแต่ลูกค้าไม่มาทั้งลำ ยังถือว่าออก
     และของที่ลงจริงไว้แล้ว (น้ำมันจากใบงานเรือ / ค่าอาหารร้าน / ค่ารถ) ก็หายไปด้วย
     ซึ่งถูกแล้ว: ถ้าเรือไม่ได้ออก ของพวกนั้นไม่ควรมีตั้งแต่แรก มีเมื่อไหร่ = สัญญาณว่าออกจริง
     → จึงมีปุ่ม "ออกจริง" (A.ran) ให้กดกลับเมื่อเรือออกแต่ไม่มีผู้โดยสาร
       (ออกไปส่งของ · กลุ่มยกเลิกหน้างานหลังเติมน้ำมันแล้ว · เรือสำรองที่ต้องวิ่งตาม)
     est ของทุกบรรทัดยังอยู่ครบ ไม่ได้ลบทิ้ง จึงยังเปิดดูได้ว่า "ถ้าออกจะเท่าไหร่" */
  var estCost=cost;
  var noSail=(PX.tot===0 && PX.bk===0 && !A.ran);
  if(noSail){
    rows=rows.map(function(r){
      return { id:r.id, g:r.g, l:r.l, vat:r.vat, est:r.est, real:r.real, why:r.why,
               src:r.src, gross:r.gross, use:0 };
    });
    cost=0;
  }
  var nReal=rows.filter(function(r){ return r.real!=null; }).length;
  var st = noSail ? 'nosail' : (A.closed ? 'done' : (nReal ? 'part' : 'est'));
  var be=null;
  try{ if(typeof ctBreakEven==='function'){
    var cap=(typeof boatCapFor==='function')?boatCapFor(bid,date):(boat.cap||0);
    /* §boatRent · จุดคุ้มทุนของทริปนี้ต้องรู้ว่าลำที่ออกเป็นเรือเช่าไหม ไม่งั้นคิดต้นทุนผิดชุด */
    be=ctBreakEven(Object.assign({}, plan||{}, {eng:ctx.eng, boats:1, fuel:fuelPr, paxTH:PX.th,
        boatId:bid, _asOf:date, price:(PX.tot?revGross/PX.tot:0), comm:0}), Math.max(1,cap||60), T);
  } }catch(_){}
  return { bid:bid, boat:boat, name:boat.name||bid, rid:rid, route:rt, dep:(rt.times&&rt.times[0])||'',
           px:PX, ctx:ctx, plan:plan, rows:rows, cost:Math.round(cost), up:UP, lt:LT, fp:FP,
           noSail:noSail, ran:!!A.ran, wouldCost:Math.round(estCost),   /* §pxNoSail */
           revGross:Math.round(revGross), rev:Math.round(revNet),
           profit:Math.round(revNet-cost), st:st, nReal:nReal, closed:!!A.closed, frozen:frozen, be:be,
           fuelPr:fuelPr };
}
function pxDay(date, pier){
  var out=[];
  var day=(typeof TRIPS!=='undefined' && TRIPS[date])?TRIPS[date]:{};
  Object.keys(day).forEach(function(bid){
    var op=day[bid]; if(!op||!op.route) return;
    var rt=(typeof getRoute==='function')?getRoute(op.route):null; if(!rt) return;
    if(pier && (rt.pier||'')!==pier) return;
    out.push(pxTrip(date,bid));
  });
  out.sort(function(a,b){ return String(a.dep||'99').localeCompare(String(b.dep||'99')); });
  return out;
}
/* ปิดยอด · แช่ตัวเลขไว้ ณ วินาทีที่กด · แก้สูตรทีหลังจะไม่ย้อนมาขยับ */
function pxClose(bid){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  var date=_px.date, A=(taGet(date,bid)||{});
  if(A.closed){ if(!confirm('เปิดยอดทริปนี้ใหม่? · ตัวเลขจะกลับไปคิดตามสูตรและราคาปัจจุบัน')) return;
    taSet(date,bid,{closed:null}); renderTripPL(); return; }
  var t=pxTrip(date,bid);
  if(!confirm('ปิดยอดทริปนี้?\n\n'+t.name+' · '+(t.route.name||'')+'\n'
    +'รายได้ '+t.rev.toLocaleString()+' − ต้นทุน '+t.cost.toLocaleString()
    +' = '+(t.profit>=0?'กำไร ':'ขาดทุน ')+Math.abs(t.profit).toLocaleString()+'\n\n'
    +'ตัวเลขจะถูกแช่ไว้ · แก้สูตรหรือขึ้นราคาทีหลังจะไม่ย้อนมาขยับทริปนี้')) return;
  taSet(date,bid,{closed:{rev:t.rev, cost:t.cost, profit:t.profit,
    rows:t.rows.map(function(r){ return {id:r.id,l:r.l,amt:Math.round(r.use),real:r.real!=null}; }),
    pax:t.px.tot, at:new Date().toISOString(), by:(typeof ckMe==='function')?ckMe():''}});
  renderTripPL();
}
/* §pxNoSail · ยืนยันว่าลำนี้ออกจริงทั้งที่ไม่มีผู้โดยสาร · กดซ้ำเพื่อยกเลิก
   เก็บใน trip_actuals ที่เดียวกับการปิดยอด จึงติดไปกับวัน+ลำนั้นตลอด ไม่ใช่ค่าชั่วคราวบนหน้าจอ */
function pxRan(bid){
  if(typeof laGuardEdit==='function' && !laGuardEdit('accounting')) return;
  var date=_px.date, A=(taGet(date,bid)||{});
  if(A.ran){
    if(!confirm('\u0e01\u0e25\u0e31\u0e1a\u0e44\u0e1b\u0e40\u0e1b\u0e47\u0e19 "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e2d\u0e2d\u0e01"? \u00b7 \u0e15\u0e49\u0e19\u0e17\u0e38\u0e19\u0e02\u0e2d\u0e07\u0e25\u0e33\u0e19\u0e35\u0e49\u0e08\u0e30\u0e01\u0e25\u0e31\u0e1a\u0e44\u0e1b\u0e40\u0e1b\u0e47\u0e19 0')) return;
    taSet(date,bid,{ran:null}); renderTripPL(); return;
  }
  var t=pxTrip(date,bid);
  if(!confirm('ยืนยันว่าเรือลำนี้ออกจริง?\n\n'+t.name+' · '+(t.route.name||'')+'\n'
    +'ไม่มีผู้โดยสารและไม่มีใบจองเลย · ถ้าออกจริงจะคิดต้นทุน '+pxN(t.wouldCost)+' ฿\n\n'
    +'ต้นทุนก้อนนี้จะถูกนับรวมในยอดของวันและของเดือนทันที')) return;
  taSet(date,bid,{ran:1}); renderTripPL();
}
function pxShift(n){ var d=new Date(_px.date+'T12:00:00'); d.setDate(d.getDate()+n);
  _px.date=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); renderTripPL(); }
function pxToday(){ _px.date=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10); renderTripPL(); }
function pxPick(v){ if(v) _px.date=v; renderTripPL(); }
function pxPier(v){ _px.pier=v||''; renderTripPL(); }
function pxOpen(bid){ _px.open=_px.open||{}; if(_px.open[bid]) delete _px.open[bid]; else _px.open[bid]=1; renderTripPL(); }
function pxGColor(g){ return PX_GC[g]||'#94A3B8'; }
function pxB(n){ return '\u0e3f'+Math.round(n||0).toLocaleString(); }
function pxN(n){ return Math.round(n||0).toLocaleString(); }
function pxAColor(a){
  if(a.b2c) return '#4F46E5';
  var h=0, k=String(a.name||'');
  for(var i=0;i<k.length;i++) h=(h*31+k.charCodeAt(i))>>>0;
  return PX_AGC[h%PX_AGC.length];
}

/* หมวดต้นทุนของทริปหนึ่ง · เรียงตามลำดับในสูตร ไม่เรียงตามขนาด จะได้เทียบข้ามทริปได้
   เทียบกับ undefined ไม่ใช่ความจริง/เท็จ · หมวดที่รวมได้ 0 เป็นค่าเท็จ แล้วจะถูกดันเข้า ord ซ้ำ */
function pxGroups(t){
  var by={}, ord=[];
  t.rows.forEach(function(r){ if(by[r.g]===undefined){ by[r.g]=0; ord.push(r.g); } by[r.g]+=r.use; });
  return ord.filter(function(g){ return Math.round(by[g])!==0; })
            .map(function(g){ return { g:g, v:by[g], c:pxGColor(g),
              real:t.rows.some(function(r){ return r.g===g && r.src==='r'; }) }; });
}
/* §gridRows · ลำดับหมวดต้นทุนที่ "ทุกลำในวันนั้นใช้ร่วมกัน"
   ต้องเป็นชุดเดียวกันทุกคอลัมน์ ไม่งั้นแถวในกริดจะเลื่อนไม่ตรงกัน
   ลำที่ไม่มีหมวดนั้นจะได้กล่องเส้นประ "—" ค้างแถวไว้แทนการข้าม */
function pxGOrd(D){
  var seen={}, base=Object.keys(PX_GC), out=[];
  base.forEach(function(g){ seen[g]=1; out.push(g); });
  D.forEach(function(t){ (t.rows||[]).forEach(function(r){ if(!seen[r.g]){ seen[r.g]=1; out.push(r.g); } }); });
  return out;
}
/* ค่าที่จะไปอยู่ใน onclick="...('X')" · กันทั้งฝั่ง JS และฝั่ง HTML attribute */
function pxQ(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function pxCostTog(g){
  g=String(g==null?'':g);
  if(!_px.oc) _px.oc={};
  if(_px.oc[g]) delete _px.oc[g]; else _px.oc[g]=1;
  renderTripPL();
}
/* แผงรายละเอียดหนึ่งหมวด · ของที่เคยซ่อนอยู่ใน title ตอน hover ย้ายมาอยู่ตรงนี้ทั้งหมด */
function pxCostPane(t, g, lines, e){
  var pax=Math.max(1, t.px.tot), tot=0, est=0, whys=[];
  lines.forEach(function(r){ tot+=r.use; est+=(+r.est||0); });
  var body=lines.map(function(r){
    var d=(r.real!=null)?Math.round(r.real-r.est):0;
    var ec=(r.real==null)
      ? '<span class="mut">\u2014</span>'
      : ('<span class="estv n'+(d?' old':'')+'">'+pxN(r.est)+'</span>'
         +(d?('<span class="dlt '+(d>0?'up':'dn')+' n">'+(d>0?'+':'\u2212')+pxN(Math.abs(d))+'</span>'):''));
    if(r.why) whys.push('<div><b>'+e(r.l)+'</b> \u00b7 '+e(r.why)+'</div>');
    return '<tr><td class="l"><span class="ln">'+e(r.l)+'</span></td>'
      +'<td>'+ec+'</td>'
      +'<td><span class="amt n">'+pxN(r.use)+'</span> <span class="src '+e(r.src)+'">'
        +(PX_SRCT[r.src]||'')+'</span></td>'
      +'<td><span class="n">'+pxN(r.use/pax)+'</span></td></tr>';
  }).join('');
  var shr=t.cost?Math.round(tot/t.cost*100):0;
  var anyReal=lines.some(function(r){ return r.real!=null; });
  return '<div class="csd"><table><thead><tr><th class="l">Line item</th><th>Formula</th>'
    +'<th>Used</th><th>\u0e3f / pax</th></tr></thead>'
    +'<tbody>'+(body||'<tr><td class="l mut" colspan="4">No line items</td></tr>')+'</tbody>'
    +'<tfoot><tr><td class="l">'+e(g)+' \u00b7 '+shr+'% of trip cost</td>'
    +'<td>'+(anyReal?('<span class="n">'+pxN(est)+'</span>'):'<span class="mut">\u2014</span>')+'</td>'
    +'<td><span class="n">'+pxN(tot)+'</span></td>'
    +'<td><span class="n">'+pxN(tot/pax)+'</span></td></tr></tfoot></table>'
    +(whys.length?('<div class="why">'+whys.join('')+'</div>'):'')+'</div>';
}
function pxIcoSvg(d){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
  +'stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px">'+d+'</svg>'; }
function pxJump(bid){
  try{
    var el=document.getElementById('px-col-'+bid), sc=document.getElementById('px-dscroll');
    if(el&&sc) sc.scrollTo({left:Math.max(0, el.offsetLeft-sc.offsetLeft-8), behavior:'smooth'});
  }catch(_){}
}
function pxScroll(dir){
  try{ var sc=document.getElementById('px-dscroll'); if(sc) sc.scrollBy({left:dir*486, behavior:'smooth'}); }catch(_){}
}
function pxTab(k){ _px.tab=k||'d'; renderTripPL(); }
function pxMonPick(v){ if(v) _px.mon=v; renderTripPL(); }
function pxMonShift(n){
  var m=_px.mon||String(_px.date||'').slice(0,7), y=+m.slice(0,4), mm=+m.slice(5,7)-1+n;
  var d=new Date(y, mm, 1);
  _px.mon=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); renderTripPL();
}
function pxAnRange(v){ _px.an=+v||47; renderTripPL(); }

/* ── การ์ดรายละเอียดหนึ่งลำ · คืนเป็น "เซลล์ของกริด" 6 + n หมวด + 1 ใบ ──
   ห้ามห่อด้วย div ใบเดียว · กริดต้องเห็นทุกบล็อกเป็นลูกโดยตรงถึงจะจัดแถวให้ตรงกันได้ */
function pxDetail(t, e, GORD, DAVG){
  var pax=Math.max(1, t.px.tot), R=(typeof ctVatR==='function')?ctVatR(ctTpl()):0;
  var cph=t.cost/pax, loss=t.profit<0, L=loss?' ls':'';
  var col=(typeof pckBoatColor==='function'?pckBoatColor(t.bid):'')||t.route.color||'#64748B';
  var O=[];

  /* 1 · หัวเรือ */
  var stTxt={est:'Estimated', part:'Actuals on '+t.nReal, done:'Locked', nosail:'ไม่ได้ออก'}[t.st]||'';
  /* §pxNoSail · ทางกลับมีอยู่เสมอ · ระบบเดาว่า "ไม่ได้ออก" จากการไม่มีใบจอง
     ซึ่งผิดได้ (เรือออกไปส่งของ · กลุ่มยกเลิกหน้างานหลังเติมน้ำมันแล้ว)
     ปุ่มจึงบอกทั้งสถานะปัจจุบันและตัวเลขที่จะกลับมาถ้ากด */
  var nsPill = t.noSail
    ? ('<span class="pill ns clk" onclick="pxRan(\''+e(t.bid)+'\')" title="'
       +e('ไม่มีผู้โดยสารและไม่มีใบจองเลย ระบบจึงถือว่าเรือไม่ได้ออกและไม่คิดต้นทุน '
         +'· ถ้าออกจริง ต้นทุนจะเป็น '+pxN(t.wouldCost)+' ฿ · กดเพื่อยืนยันว่าออกจริง')
       +'">ไม่ได้ออก · กดถ้าออกจริง</span>')
    : ((t.ran && t.px.tot===0)
       ? ('<span class="pill am clk" onclick="pxRan(\''+e(t.bid)+'\')" title="'
          +e('ยืนยันไว้แล้วว่าลำนี้ออกจริงทั้งที่ไม่มีผู้โดยสาร · ต้นทุนจึงถูกคิดตามสูตร · กดเพื่อยกเลิก')
          +'">ออกจริง · ไม่มีผู้โดยสาร</span>')
       : '');
  /* §revFlag · เตือนตรงหัวลำเลย · คนที่เปิดหน้านี้คือคนที่แก้ใบจองได้ */
  var rphNow=t.rev/pax, revBad=(DAVG>0 && t.px.tot>0 && rphNow<DAVG*0.3);
  var revPill=revBad
    ? ('<span class="pill ro" title="'+e('This boat took '+pxN(rphNow)+' \u0e3f per head while the rest of '
        +'the day averaged '+pxN(DAVG)+' \u0e3f. A gap this big is almost always a booking entered as a '
        +'total instead of a per-head price \u2014 check the booking before reading the loss as real. '
        +'Priced like the rest of the day this trip would have taken '+pxN(DAVG*t.px.tot)+' \u0e3f '
        +'instead of '+pxN(t.rev)+' \u0e3f.')+'">\u26a0 check revenue</span>')
    : '';
  O.push('<div class="r1'+L+'" id="px-col-'+e(t.bid)+'"><div class="dth">'
    +'<div class="bar" style="background:'+e(col)+'"></div>'
    +'<div style="min-width:0"><h2>'+e(t.name)
      +'<span class="pill '+(loss?'ro':'pu')+' n">'+e(t.dep||'--:--')+'</span>'
      /* §pxNoSail · ลำที่ไม่ได้ออกไม่ต้องมีปุ่มปิดยอด · ไม่มีตัวเลขอะไรให้แช่
         และคำว่า "ไม่ได้ออก" อยู่ในปุ่มถัดไปแล้ว จะได้ไม่ขึ้นซ้ำสองป้าย */
      +(t.noSail?'':('<span class="pill g clk" onclick="pxClose(\''+e(t.bid)+'\')" title="'
        +(t.closed?'Re-open this trip':'Lock the numbers for this trip')+'">'+stTxt+'</span>'))
      +revPill+nsPill+'</h2>'
    +'<div class="rt">'+e(t.route.name||'—')
      +(t.plan?(' · plan "'+e(t.plan.name||'')+'"')
             :' · <b style="color:#B45309">no cost plan — using the default formula</b>')
      +'</div></div></div></div>');

  /* 2 · ป้ายผู้โดยสาร */
  var AG=pxAgents(_px.date, t.bid);
  O.push('<div class="'+(L?'ls':'')+'"><div class="pxb">'
    +'<span>Adult <b>'+t.px.ad+'</b></span><span>Child <b>'+t.px.chd+'</b></span>'
    +'<span>Infant <b>'+t.px.inf+'</b></span><span>FOC <b>'+t.px.foc+'</b></span>'
    +'<span class="on">Foreign <b>'+t.px.fr+'</b></span>'
    +'<span class="ok">'+t.px.bk+' bookings · '+AG.length+' agents</span></div></div>');

  /* 3 · ค่าเฉลี่ยต่อหัว · บล็อกแรกของเนื้อหา */
  var GS=pxGroups(t), tot=GS.reduce(function(a,x){ return a+x.v; },0)||1;
  var stk=GS.map(function(G){ return '<i style="width:'+(G.v/tot*100).toFixed(2)+'%;background:'+G.c+'"></i>'; }).join('');
  var lgd=GS.map(function(G){ return '<span><i style="background:'+G.c+'"></i>'+e(G.g)
    +' <b class="n">'+pxN(G.v/pax)+'</b></span>'; }).join('');
  var tgt=(typeof drCfg==='function')?((drCfg()||{}).targetPerPax||0):0;
  var pph=Math.round(t.profit/pax);
  O.push('<div class="pphw'+L+'"><div class="pph"'+(loss?' style="background:#FFF7F8;border-color:#FBD5DB"':'')+'>'
    +'<div class="h"><i'+(loss?' style="background:#E11D48"':'')+'></i>Per-head economics · '+t.px.tot+' pax</div>'
    +'<div class="s">Revenue/pax − Cost/pax = Net/pax</div>'
    +'<div class="row">'
    +'<div class="cell"><small>Revenue</small><b class="n" style="color:#0F172A">'+pxN(t.rev/pax)+'</b><u>ex-VAT</u></div>'
    +'<span class="op">−</span>'
    +'<div class="cell"><small>Cost</small><b class="n" style="color:#D97706">'+pxN(cph)+'</b><u>'
      +(t.rev?(Math.round(t.cost/t.rev*100)+'%'):'—')+'</u></div>'
    +'<span class="op">=</span>'
    +'<div class="cell"><small>Net</small><b class="n" style="color:'+(loss?'#E11D48':'#059669')+'">'
      +(loss?'−':'+')+pxN(Math.abs(pph))+'</b><u>'
      +(tgt?('target '+tgt+' · '+(pph>=tgt?'pass':'fail')):('total '+(loss?'−':'+')+pxN(Math.abs(t.profit))))+'</u></div>'
    +'</div>'
    +'<div class="rail">'+stk+'</div><div class="lgd">'+lgd+'</div></div></div>');

  /* 4 · หัวข้อรายได้ */
  O.push('<div class="'+(L?'ls':'')+'"><div class="sech"><h4><i style="background:#10B981"></i> Revenue by agent</h4>'
    +'<span class="rt">'+AG.length+' agent'+(AG.length===1?'':'s')+'</span></div></div>');

  /* 5 · รายเอเจนต์ · 5 อันดับ + รวมที่เหลือ */
  var TOP=AG.slice(0,5), REST=AG.slice(5);
  var agRows=TOP.map(function(a){
    var c=pxAColor(a), net=a.head?(a.amt*(1-R)/a.head):0, ok=(net-cph)>=0;
    return '<div class="agc"><div class="lf"><i style="background:'+c+'"></i>'
      +'<div style="min-width:0"><div class="nm">'+e(a.name)+'</div>'
      +'<div class="sb">'+a.n+' booking'+(a.n===1?'':'s')+' · '+a.head+' pax</div></div></div>'
      +'<div class="rg"><b class="n">'+pxN(a.amt)+'</b>'
      +'<u class="n'+(ok?'':' neg')+'">'+pxN(net)+'/pax</u></div></div>';
  }).join('');
  if(REST.length){
    var rAmt=0,rN=0,rH=0; REST.forEach(function(a){ rAmt+=a.amt; rN+=a.n; rH+=a.head; });
    var rNet=rH?(rAmt*(1-R)/rH):0;
    agRows+='<div class="agc"><div class="lf"><i style="background:#94A3B8"></i>'
      +'<div style="min-width:0"><div class="nm">Other agents ('+REST.length+')</div>'
      +'<div class="sb">'+rN+' bookings · '+rH+' pax</div></div></div>'
      +'<div class="rg"><b class="n">'+pxN(rAmt)+'</b>'
      +'<u class="n'+((rNet-cph)>=0?'':' neg')+'">'+pxN(rNet)+'/pax</u></div></div>';
  }
  O.push('<div class="agw'+L+'">'
    +(agRows||'<div style="font-size:11.5px;color:#94A3B8;padding:10px 2px">No bookings on this trip</div>')
    +'<div class="agtot"><span class="nm">Total revenue (ex-VAT)</span><b class="n">'+pxN(t.rev)+' ฿</b></div></div>');

  /* 6 · หัวข้อต้นทุน */
  var srcSeen={}; t.rows.forEach(function(r){ if(Math.round(r.use)!==0||r.real!=null) srcSeen[r.src]=1; });
  var srcChips=PX_SRCO.filter(function(k){ return srcSeen[k]; })
    .map(function(k){ return '<span class="src '+k+'">'+PX_SRCT[k]+'</span>'; }).join(' ');
  O.push('<div class="'+(L?'ls':'')+'"><div class="sech"><h4><i style="background:#F59E0B"></i> Trip cost breakdown</h4>'
    +'<span class="rt">'+srcChips+'</span></div></div>');

  /* 7..n · หมวดต้นทุน · หมวดละ 1 แถว 1 บรรทัด · ลำดับเดียวกันทุกลำ */
  var byG={}; GS.forEach(function(G){ byG[G.g]=G; });
  if(!_px.oc) _px.oc={};
  GORD.forEach(function(g){
    var G=byG[g], c=pxGColor(g), op=!!_px.oc[g], qg=pxQ(g);
    if(!G){ O.push('<div class="csw'+L+'"><div class="csr zero"><i></i>'+PX_CHEV
        +'<span class="gn">'+e(g)+'</span><span class="fml"></span>'
        +'<span class="gv n">\u2014</span></div></div>'); return; }
    var lines=t.rows.filter(function(r){ return r.g===g && (Math.round(r.est)!==0 || r.real!=null); });
    var fml=pxN(G.v/pax)+'/pax'
      + (lines.length?(' \u00b7 '+lines.map(function(r){ return r.l; }).join(' + ')):'');
    var chips={}; lines.forEach(function(r){ chips[r.src]=1; });
    var sx=PX_SRCO.filter(function(k){ return chips[k]; })
      .map(function(k){ return '<span class="src '+k+'">'+PX_SRCT[k]+'</span>'; }).join('');
    O.push('<div class="csw'+L+(op?' ope':'')+'">'
      +'<div class="csr" onclick="pxCostTog(\''+qg+'\')" title="'
        +(op?'Hide the expense detail':'Show the expense detail')+'">'
      +'<i style="background:'+c+'"></i>'+PX_CHEV
      +'<span class="gn" style="color:'+c+'">'+e(g)+'</span>'
      +'<span class="fml">'+e(fml)+'</span><span class="sx">'+sx+'</span>'
      +'<span class="gv n" style="color:'+c+'">'+pxN(G.v)+'</span></div>'
      +(op?pxCostPane(t, g, lines, e):'')+'</div>');
  });

  /* สุดท้าย · รวมต้นทุน */
  O.push('<div class="rz'+L+'"><div class="cstot"'+(loss?' style="background:#FFF1F2;border-color:#FECDD3"':'')+'>'
    +'<span class="nm"'+(loss?' style="color:#9F1239"':'')+'>Total cost · '+pxN(cph)+' ฿/pax</span>'
    +'<b class="n"'+(loss?' style="color:#BE123C"':'')+'>'+pxN(t.cost)+' ฿</b></div></div>');
  return O.join('');
}

/* ── หัวหน้าจอ · ใช้ร่วมกันทุกแท็บ ── */
function pxBar(e){
  var T=_px.tab||'d';
  var pierSel='<select onchange="pxPier(this.value)"><option value="">All piers</option>'
    +((typeof PO_PIERS!=='undefined')?PO_PIERS:[]).map(function(p){
        return '<option value="'+e(p.k)+'"'+(_px.pier===p.k?' selected':'')+'>'+e(p.t||p.n)+'</option>'; }).join('')
    +'</select>';
  var ctl='';
  if(T==='d') ctl='<button class="pbtn arw" onclick="pxShift(-1)">'+pxIcoSvg(PX_SVG.lt)+'</button>'
      +'<input type="date" value="'+e(_px.date)+'" onchange="pxPick(this.value)">'
      +'<button class="pbtn arw" onclick="pxShift(1)">'+pxIcoSvg(PX_SVG.rt)+'</button>'
      +'<button class="pbtn" onclick="pxToday()">Today</button>'+pierSel;
  else if(T==='m') ctl='<button class="pbtn arw" onclick="pxMonShift(-1)">'+pxIcoSvg(PX_SVG.lt)+'</button>'
      +'<input type="month" value="'+e(_px.mon||String(_px.date).slice(0,7))+'" onchange="pxMonPick(this.value)">'
      +'<button class="pbtn arw" onclick="pxMonShift(1)">'+pxIcoSvg(PX_SVG.rt)+'</button>'+pierSel;
  else ctl='<select onchange="pxAnRange(this.value)">'
      +[30,47,60,90].map(function(n){ return '<option value="'+n+'"'+(_px.an===n?' selected':'')+'>Last '+n+' days</option>'; }).join('')
      +'</select>'+pierSel;
  return '<div class="pbar">'
    +'<div class="pbrand"><div class="plogo">฿</div>'
    +'<div><b>Trip P&amp;L</b><small>Profit &amp; loss by boat and trip</small></div></div>'
    +'<nav class="pnav">'
      +'<button class="'+(T==='d'?'on':'')+'" onclick="pxTab(\'d\')">Daily</button>'
      +'<button class="'+(T==='m'?'on':'')+'" onclick="pxTab(\'m\')">Monthly</button>'
      +'<button class="'+(T==='a'?'on':'')+'" onclick="pxTab(\'a\')">Analysis</button>'
    +'</nav><div class="pctl">'+ctl+'</div></div>';
}

/* ══ DAILY ══════════════════════════════════════════════════════════════════ */
function pxDaily(e){
  var D=pxDay(_px.date,_px.pier);
  var DW=(typeof pjDateWords==='function')?pjDateWords(_px.date):{sm:_px.date};
  var tR=0,tC=0,tP=0,tPax=0,tBk=0,tGross=0,nLoss=0,nReal=0,nProfit=0;
  /* §pxNoSail · ลำที่ไม่ได้ออกมีต้นทุน 0 อยู่แล้ว แต่ตัวนับสถานะต้องตัดออกด้วย
     ไม่งั้นกำไร 0 บาทจะถูกนับเป็น "ทริปที่ทำกำไร" และตัวหารของ Data confidence จะเกินจริง */
  var SAIL=D.filter(function(t){ return !t.noSail; }), nNo=D.length-SAIL.length, noCost=0;
  D.forEach(function(t){ tR+=t.rev; tC+=t.cost; tPax+=t.px.tot; tBk+=t.px.bk; tGross+=t.revGross;
    if(t.noSail) noCost+=(+t.wouldCost||0); });
  SAIL.forEach(function(t){ tP+=t.profit;
    if(t.profit<0) nLoss++; else nProfit++; if(t.nReal) nReal++; });
  var per=tPax?Math.round(tP/tPax):0;
  var tgt=(typeof drCfg==='function')?((drCfg()||{}).targetPerPax||0):0;
  var pct=tR?Math.round(tC/tR*100):0;
  /* §pxNoSail · เตือนเรื่องแผนต้นทุน/ราคาน้ำมันเฉพาะลำที่ออกจริง
     ลำที่ไม่ได้ออกไม่ได้ใช้ทั้งสองอย่าง เตือนไปก็ไม่มีอะไรให้แก้ */
  var nNoPlan=SAIL.filter(function(t){ return !t.plan; }).length;
  var nNoFuel=SAIL.filter(function(t){ return !t.fuelPr; }).length;
  var nFuelBack=SAIL.filter(function(t){ return t.fp && (t.fp.src==='back'||t.fp.src==='sib'||t.fp.src==='plan'); }).length;

  if(!D.length) return '<div class="phero"><div><h1>Daily performance <span>('+e(DW.sm||_px.date)+')</span></h1></div></div>'
    +'<div class="empty">No boats scheduled on this date'+(_px.pier?' at this pier':'')+'</div>';

  var hero='<div class="phero"><div><h1>Daily performance <span>('+e(DW.sm||_px.date)+')</span></h1>'
    +'<p><span class="htag">'+SAIL.length+' trip'+(SAIL.length===1?'':'s')+' · '+tPax+' pax</span>'
    +(nNo?('<span class="htag ns" title="'+e('เรือที่จัดไว้บนกระดานแต่ไม่มีผู้โดยสารและไม่มีใบจองเลย '
        +'· ถือว่าไม่ได้ออก จึงไม่คิดต้นทุน (ถ้าออกจริงจะเป็น '+pxN(noCost)+' ฿) '
        +'· ถ้าลำไหนออกจริง กดปุ่ม "ไม่ได้ออก" บนการ์ดของลำนั้นเพื่อให้คิดต้นทุน')+'">'
      +nNo+' boat'+(nNo===1?'':'s')+' did not sail · '+pxN(noCost)+' ฿ not charged</span>'):'')
    +(nNoPlan?('<span class="htag w">'+nNoPlan+' boat'+(nNoPlan===1?'':'s')+' not mapped to a cost plan</span>'):'')
    +(nNoFuel?('<span class="htag w">'+nNoFuel+' boat'+(nNoFuel===1?'':'s')+' with no fuel price</span>'):'')
    +'Costs use the same formula as the Costing &amp; Break-even page</p></div>'
    +'<div class="pnet'+(tP<0?' neg':'')+'"><div class="pnic">'+pxIcoSvg(PX_SVG.up)+'</div>'
    +'<div><small>'+(tP<0?'NET LOSS TODAY':'NET PROFIT TODAY')+'</small>'
    +'<b class="n">'+(tP<0?'−':'+')+pxN(Math.abs(tP))+' ฿</b></div></div></div>';

  var kpi='<div class="pk4">'
    +'<div class="kc"><div class="k1"><div><p class="lb">Revenue (ex-VAT)</p>'
      +'<h3 class="n">'+pxN(tR)+'<u>฿</u></h3></div><div class="pxico blue">'+pxIcoSvg(PX_SVG.rev)+'</div></div>'
      +'<div class="kft"><span><b class="n">'+pxN(tR/Math.max(1,tPax))+'</b> ฿/pax · '+tBk+' bookings</span>'
      +'<span class="pill g n">VAT out '+pxN(tGross-tR)+'</span></div></div>'
    +'<div class="kc"><div class="k1"><div><p class="lb">Total cost <span class="pill '+(pct>=100?'ro':'am')+'">'+pct+'%</span></p>'
      +'<h3 class="n">'+pxN(tC)+'<u>฿</u></h3></div><div class="pxico or">'+pxIcoSvg(PX_SVG.cost)+'</div></div>'
      +'<div class="kft"><span><b class="n">'+pxN(tC/Math.max(1,tPax))+'</b> ฿/pax</span>'
      +'<span class="pill '+(nNoFuel?'ro':(nFuelBack?'am':'g'))+'">'
      +(nNoFuel?(nNoFuel+' with no fuel price'):(nFuelBack?('fuel borrowed on '+nFuelBack):('actuals on '+nReal+'/'+SAIL.length)))
      +'</span></div></div>'
    +'<div class="kc"><div class="k1"><div><p class="lb">Net profit '
      +'<span class="pill '+(tP<0?'ro':'em')+'">'+(tR?((tP<0?'':'+')+Math.round(tP/tR*100)+'%'):'—')+'</span></p>'
      +'<h3 class="n" style="color:'+(tP<0?'#E11D48':'#059669')+'">'+(tP<0?'−':'+')+pxN(Math.abs(tP))
      +'<u style="color:'+(tP<0?'#FB7185':'#10B981')+'">฿</u></h3></div>'
      +'<div class="pxico em">'+pxIcoSvg(PX_SVG.pro)+'</div></div>'
      +'<div class="kft"><span style="color:'+(per<0?'#BE123C':'#047857')+';font-weight:600">'
      +(per<0?'−':'+')+pxN(Math.abs(per))+' ฿/pax'+(tgt?(' · target '+tgt):'')+'</span>'
      +'<span class="pill '+(nLoss?'ro':'em')+'">'+nProfit+' profitable · '+nLoss+' loss</span></div></div>'
    +'<div class="kc"><div class="k1"><div><p class="lb">Data confidence</p>'
      +'<h3 class="n">'+nReal+' / '+SAIL.length+'<u>boats</u></h3></div>'
      +'<div class="pxico pu">'+pxIcoSvg(PX_SVG.ok)+'</div></div>'
      +'<div class="kft"><span>Plan mapped <b>'+(SAIL.length-nNoPlan)+'/'+SAIL.length+'</b></span>'
      +'<span class="pill pu">'+D.filter(function(t){ return t.closed; }).length+' locked</span></div></div>'
    +'</div>';

  var sumRows=D.map(function(t){
    /* §pxNoSail · ลำที่ไม่ได้ออกต้องไม่ขึ้นแถบแดง 100% · ไม่มีรายได้ ไม่มีต้นทุน ไม่มีอะไรให้เทียบ */
    var loss=t.profit<0, ratio=t.rev?Math.min(140, t.cost/t.rev*100):(t.noSail?0:100);
    var bc=t.noSail?'#CBD5E1':((ratio>=100)?'#E11D48':(ratio>=70?'#F59E0B':'#10B981'));
    var col=(typeof pckBoatColor==='function'?pckBoatColor(t.bid):'')||t.route.color||'#64748B';
    return '<tr class="br'+(t.noSail?' nosail':(loss?' loss':''))+'" onclick="pxJump(\''+e(t.bid)+'\')">'
      +'<td class="l"><div class="bn"><i style="background:'+e(col)+'"></i><div><b>'+e(t.name)+'</b>'
        +'<small>'+e(t.route.name||'—')+(t.plan?'':' · no cost plan')+'</small></div></div></td>'
      +'<td class="c"><span class="tm n">'+e(t.dep||'--:--')+'</span></td>'
      +'<td class="c"><span class="num n">'+t.px.tot+'</span><div class="per">TH '+t.px.th+' · FR '+t.px.fr+'</div></td>'
      +'<td><span class="num n">'+pxN(t.rev)+'</span><div class="per n">'+pxN(t.rev/Math.max(1,t.px.tot))+' / pax</div></td>'
      +'<td><span class="num cost'+(t.noSail?' mut':'')+' n">'+pxN(t.cost)+'</span><div class="per n">'
        +(t.noSail?('<span class="nsx">ถ้าออกจริง '+pxN(t.wouldCost)+'</span>')
                  :(pxN(t.cost/Math.max(1,t.px.tot))+' / pax'))+'</div></td>'
      +(t.noSail
        ? ('<td class="netc"><span class="net mut n">—</span><div class="per">ไม่ได้ออก · ไม่คิดต้นทุน</div></td>')
        : ('<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
        +(loss?'−':'+')+pxN(Math.abs(t.profit))+'</span>'
        +'<div class="per '+(loss?'negp':'pos')+' n">'+(loss?'−':'+')
        +pxN(Math.abs(t.profit/Math.max(1,t.px.tot)))+' / pax'+(t.rev?(' · '+Math.round(t.profit/t.rev*100)+'%'):'')+'</div></td>'))
      +'<td><div class="bars"><i style="width:'+Math.min(100,ratio).toFixed(0)+'%;background:'+bc+'"></i></div>'
        +'<div class="bmeta"><span class="a" style="color:'+(t.noSail?'#94A3B8':bc)+'">'
          +(t.noSail?'ไม่ได้ออก':('Cost '+Math.round(ratio)+'%'))+'</span>'
        +'<span class="b">'+(t.noSail?'—':(t.be?('B/E '+t.be+' pax'):'—'))+'</span></div></td></tr>';
  }).join('');
  var totRow='<tr class="tot"><td class="l">Σ Day total · '+SAIL.length+' boat'+(SAIL.length===1?'':'s')
    +(nNo?(' <span class="nsx">+'+nNo+' ไม่ได้ออก</span>'):'')+'</td>'
    +'<td class="c"><span class="num mut">—</span></td>'
    +'<td class="c"><span class="num n">'+tPax+'</span><div class="per">'+tBk+' bookings</div></td>'
    +'<td><span class="num n">'+pxN(tR)+'</span><div class="per n">avg '+pxN(tR/Math.max(1,tPax))+' / pax</div></td>'
    +'<td><span class="num cost n">'+pxN(tC)+'</span><div class="per n">avg '+pxN(tC/Math.max(1,tPax))+' / pax</div></td>'
    +'<td class="netc'+(tP<0?' neg':'')+'"><span class="net'+(tP<0?' neg':'')+' n">'
      +(tP<0?'−':'+')+pxN(Math.abs(tP))+'</span>'
      +'<div class="per '+(tP<0?'negp':'pos')+' n">'+(per<0?'−':'+')+pxN(Math.abs(per))+' / pax'
      +(tR?(' · '+Math.round(tP/tR*100)+'%'):'')+'</div></td>'
    +'<td><div class="bars"><i style="width:'+Math.min(100,pct)+'%;background:#4F46E5"></i></div>'
      +'<div class="bmeta"><span class="a" style="color:#3730A3">Cost is '+pct+'% of revenue</span><span class="b"></span></div></td></tr>';

  var GORD=pxGOrd(D);
  /* §revFlag · รายได้ต่อหัวของลำนี้ต่ำกว่าค่าเฉลี่ยของวันมากผิดปกติ = น่าจะกรอกใบจองผิด
     ต้องมีอย่างน้อย 2 ลำถึงจะมีตัวเทียบ · ลำเดียวทั้งวันเทียบกับอะไรไม่ได้ */
  var DAVG=0;
  if(D.length>1 && tPax>=10) DAVG=tR/tPax;
  var cells=D.map(function(t){ return pxDetail(t, e, GORD, DAVG); }).join('');

  return hero+kpi
    +'<div class="eg"><div class="phd"><div><h2>Boat summary '
      +'<span class="pill pu">'+D.length+' boat'+(D.length===1?'':'s')+' scheduled</span>'
      +(nNo?('<span class="pill ns">'+nNo+' did not sail</span>'):'')+'</h2>'
      +'<p>Which route each boat ran, how many pax it carried, what came in, what went out, what is left · '
      +'click a row to jump to that boat</p></div></div>'
    +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:760px">'
    +'<thead><tr><th class="l">Boat · Route</th><th class="c">Dep</th><th class="c">Pax</th>'
    +'<th>Revenue (฿)</th><th>Cost (฿)</th><th>Net (฿)</th>'
    +'<th class="c">Cost ratio / Break-even</th></tr></thead><tbody>'
    +sumRows+totRow+'</tbody></table></div></div>'
    +'<div class="legend"><div class="ls"><b>Cost-ratio bar:</b>'
      +'<span><i style="background:#10B981"></i> Healthy (&lt;70%)</span>'
      +'<span><i style="background:#F59E0B"></i> Watch (70–95%)</span>'
      +'<span><i style="background:#E11D48"></i> Loss (&gt;100%)</span></div>'
      +'<span style="color:#94A3B8">* Live from bookings + the cost formula mapped to that route</span></div></div>'
    +'<div class="dwrap"><div class="dbar"><div><h2>Boat detail '
      +'<span class="pill g">'+D.length+' boat'+(D.length===1?'':'s')+'</span></h2>'
      +'<p>Every heading sits on the same row across boats · scroll sideways to compare line by line</p></div>'
      +'<div class="dnav"><button onclick="pxScroll(-1)">'+pxIcoSvg(PX_SVG.lt)+'</button>'
      +'<button onclick="pxScroll(1)">'+pxIcoSvg(PX_SVG.rt)+'</button></div></div>'
    +'<div class="dscroll" id="px-dscroll"><div class="dgrid" style="grid-template-rows:repeat('
      +(7+GORD.length)+',auto)">'+cells+'</div></div></div>';
}
function pxAggReset(){ _pxAgg={}; _pxAggKey=''; }
function pxDayAgg(date, pier){
  var stamp=String(window.__savedAt||0)+'|'+(pier||'');
  if(_pxAggKey!==stamp){ _pxAgg={}; _pxAggKey=stamp; }
  if(_pxAgg[date]) return _pxAgg[date];
  var R=(typeof ctVatR==='function')?ctVatR(ctTpl()):0;
  var D=pxDay(date,pier);
  var a={ date:date, trips:D.length, rev:0, cost:0, profit:0, pax:0, bk:0, loss:0, cap:0,
          routes:{}, agents:{}, groups:{}, gdet:{}, bandN:[0,0,0,0], bandNet:[0,0,0,0], bandPax:[0,0,0,0],
          best:null, boats:[], tr:[] };
  D.forEach(function(t){
    a.rev+=t.rev; a.cost+=t.cost; a.profit+=t.profit; a.pax+=t.px.tot; a.bk+=t.px.bk;
    if(t.profit<0) a.loss++;
    if(!a.best || t.profit>a.best.profit) a.best={ name:t.name, profit:t.profit };
    a.boats.push({ bid:t.bid, name:t.name, profit:t.profit });
    var cap=0;
    try{ cap=(typeof boatCapFor==='function')?(boatCapFor(t.bid,date)||0):(+t.boat.cap||0); }catch(_){ cap=+t.boat.cap||0; }
    a.cap+=cap;
    var rk=t.rid||(t.route.name||'—');
    var RR=a.routes[rk]||(a.routes[rk]={ name:t.route.name||'—', color:t.route.color||'#64748B',
      n:0, pax:0, rev:0, cost:0, profit:0, cap:0, be:0, beN:0, pier:(t.route.pier||'') });
    RR.n++; RR.pax+=t.px.tot; RR.rev+=t.rev; RR.cost+=t.cost; RR.profit+=t.profit; RR.cap+=cap;
    if(t.be){ RR.be+=t.be; RR.beN++; }
    /* §trRaw · ทริปดิบรายใบ · หน้าวิเคราะห์ต้องใช้หา "ต้นทุนคงที่ต่อทริป" จากของจริง
       ตัวรวมรายวันบอกไม่ได้ว่าต้นทุนก้อนไหนไม่ขยับตามจำนวนคน ต้องมีรายทริปถึงจะ fit ได้ */
    a.tr.push({ rid:rk, bid:t.bid, name:t.name, date:date, pax:t.px.tot,
                cost:t.cost, rev:t.rev, cap:cap, foc:t.px.foc||0, inf:t.px.inf||0 });
    /* §csDetail · แยกเก็บรายบรรทัด / ที่มาของตัวเลข / เส้นทางที่ดันหมวดนั้น */
    var _gs={};
    (t.rows||[]).forEach(function(r){
      a.groups[r.g]=(a.groups[r.g]||0)+r.use;
      var GD=a.gdet[r.g]||(a.gdet[r.g]={ v:0, est:0, trips:0, src:{}, lines:{}, routes:{} });
      GD.v+=r.use; GD.est+=(+r.est||0);
      GD.src[r.src]=(GD.src[r.src]||0)+r.use;
      if(Math.round(r.use)!==0 || r.real!=null) GD.lines[r.l]=(GD.lines[r.l]||0)+r.use;
      GD.routes[rk]=(GD.routes[rk]||0)+r.use;
      if(!_gs[r.g]){ _gs[r.g]=1; GD.trips++; }
    });
    var cph=t.cost/Math.max(1,t.px.tot);
    (pxAgents(date,t.bid)||[]).forEach(function(g){
      var AA=a.agents[g.name]||(a.agents[g.name]={ name:g.name, b2c:!!g.b2c, mk:(g.mk||''), n:0, pax:0, rev:0, cost:0, routes:{},
        exp:0, expAmt:0, expPax:0, expMiss:0, zn:{}, rtn:{} });
      AA.n+=g.n; AA.pax+=g.head; AA.rev+=g.amt*(1-R); AA.cost+=cph*g.head;
      /* §agFair · หัก VAT ด้วยตัวเดียวกับรายได้ ไม่งั้นสองตัวเลขเทียบกันไม่ได้ */
      AA.exp+=(g.exp||0)*(1-R); AA.expAmt+=(g.expAmt||0)*(1-R);
      AA.expPax+=(g.expPax||0); AA.expMiss+=(g.expMiss||0);
      pxMrg(AA.zn,g.zn); pxMrg(AA.rtn,g.rtn);
      /* §agRoute · เอเจนต์คนเดียวกันส่งหลายเส้นทาง กำไรต่อหัวคนละเรื่องกัน ต้องแยกเก็บ */
      if(!AA.routes) AA.routes={};
      var AR=AA.routes[rk]||(AA.routes[rk]={ n:0, pax:0, rev:0, cost:0,
        exp:0, expAmt:0, expPax:0, expMiss:0, zn:{}, rtn:{} });
      AR.n+=g.n; AR.pax+=g.head; AR.rev+=g.amt*(1-R); AR.cost+=cph*g.head;
      AR.exp+=(g.exp||0)*(1-R); AR.expAmt+=(g.expAmt||0)*(1-R);
      AR.expPax+=(g.expPax||0); AR.expMiss+=(g.expMiss||0);
      pxMrg(AR.zn,g.zn); pxMrg(AR.rtn,g.rtn);
    });
    if(cap>0){
      var lf=t.px.tot/cap, i=(lf<0.4)?0:(lf<0.6?1:(lf<0.8?2:3));
      a.bandN[i]++; a.bandNet[i]+=t.profit; a.bandPax[i]+=t.px.tot;
    }
  });
  return (_pxAgg[date]=a);
}
function pxDaysOf(ym){
  var y=+String(ym).slice(0,4), m=+String(ym).slice(5,7);
  if(!y||!m) return [];
  var last=new Date(y, m, 0).getDate();
  var today=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  var out=[];
  for(var d=1; d<=last; d++){
    var s=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    if(s>today) break;
    out.push(s);
  }
  return out;
}
function pxBackDays(n, endYmd){
  var out=[], d=new Date(String(endYmd)+'T12:00:00');
  for(var i=0;i<n;i++){
    out.unshift((typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10));
    d.setDate(d.getDate()-1);
  }
  return out;
}
function pxDW(ymd){
  var p=String(ymd).split('-'), w=-1;
  try{ var dt=new Date(String(ymd)+'T12:00:00'); if(!isNaN(dt)) w=dt.getDay(); }catch(_){}
  return { w:w, d:+p[2], txt:(w>=0?PX_DOW[w]+' ':'')+(+p[2])+' '+(PX_MON[(+p[1])-1]||''), we:(w===0||w===6) };
}

/* ══ §rentIdle · ค่าเช่าวันที่เรือไม่ได้วิ่ง ═══════════════════════════════════
   P&L รายทริปลงค่าเช่า = ค่าเช่า/ทริป x ทริปที่วิ่งจริง
   แต่ค่าเช่าจ่ายเต็มก้อนทุกงวดไม่ว่าเรือจะออกหรือไม่ · วิ่งน้อยกว่าที่ตั้งไว้เมื่อไหร่
   ค่าเช่าจะลงไม่ครบ และกำไรของเดือนจะดูสวยเกินจริงโดยไม่มีใครเห็น
   ก้อนนี้คือส่วนที่หายไป · เป็นตัวชี้ว่าการเช่าลำนี้คุ้มหรือไม่คุ้ม
   ไม่ใช่กำไรรายทริป ซึ่งคุ้มอยู่แล้วเพราะแบกค่าเช่าแค่ส่วนของตัวเอง

   ไม่ผูกกับตัวกรองท่า · ค่าเช่าจ่ายทั้งลำ ไม่ได้จ่ายเป็นท่า
   กรองท่าไว้แล้วซ่อนก้อนนี้ = ซ่อนเงินที่จ่ายจริง */
function pxRentIdle(days){
  if(typeof ctRentAll !== 'function' || !days || !days.length) return [];
  var d0 = days[0], d1 = days[days.length - 1], out = [];
  var ALL = ctRentAll();
  Object.keys(ALL).forEach(function(bid){
    var RN = ctRentOf(bid); if(!RN) return;
    var SP = ctRentSpan(RN, d0, d1); if(!SP) return;
    var slots = 0, sail = 0;
    days.forEach(function(d){
      if(d < SP.from || d > SP.to) return;
      var op = (typeof TRIPS !== 'undefined' && TRIPS[d]) ? TRIPS[d][bid] : null;
      if(!op || !op.route) return;
      slots++;
      var t = pxTrip(d, bid);
      if(!t.noSail) sail++;                   /* ลำที่อยู่บนกระดานแต่ไม่ได้ออก ไม่ได้ดูดซับค่าเช่า */
    });
    var I = ctRentIdle(RN, sail, SP.due);
    out.push({ bid:bid, name:RN.name, RN:RN, SP:SP, slots:slots, sail:sail,
               daysRan:sail / RN.trips, opPlan:SP.opDays,
               booked:I.booked, due:SP.due, gap:I.gap });
  });
  return out.sort(function(a, b){ return b.gap - a.gap; });
}
/* แถบสรุปในงบรายเดือน · ไม่ไปแตะยอด Net MTD ด้านบน
   เพราะนั่นคือผลรวมของทริป · ก้อนนี้เป็นต้นทุนของงวดที่ไม่มีทริปไหนรับไป
   แสดงคู่กันแล้วบอกยอดหลังหักให้ชัด ดีกว่าแอบเอาไปบวกลบข้างบนเงียบ ๆ */
function pxRentIdleHtml(e, rows, netMTD){
  if(!rows.length) return '';
  var gap = rows.reduce(function(a, r){ return a + r.gap; }, 0);
  var due = rows.reduce(function(a, r){ return a + r.due; }, 0);
  var bkd = rows.reduce(function(a, r){ return a + r.booked; }, 0);
  var adj = netMTD - gap;
  var tr = rows.map(function(r){
    var bad = r.gap > 0, run = Math.round(r.daysRan), plan = Math.round(r.opPlan);
    return '<tr class="br' + (bad ? ' loss' : '') + '">'
      + '<td class="l"><b style="font-size:12.5px">' + e(r.name) + '</b>'
        + '<div class="per">' + e(r.SP.from) + ' → ' + e(r.SP.to)
        + (r.RN.to ? '' : ' · ไม่ระบุวันจบ') + '</div></td>'
      + '<td class="c"><span class="num n">' + run + ' / ' + plan + '</span></td>'
      + '<td><span class="num n">' + pxN(r.due) + '</span></td>'
      + '<td><span class="num n">' + pxN(r.booked) + '</span></td>'
      + '<td class="netc' + (bad ? ' neg' : '') + '"><span class="net' + (bad ? ' neg' : '') + ' n">'
        + (bad ? ('−' + pxN(r.gap)) : '0') + '</span></td>'
      + '<td class="c"><span class="pill ' + (bad ? (r.gap / Math.max(1, r.due) > .25 ? 'ro' : 'am') : 'em') + '">'
        + Math.round(r.booked / Math.max(1, r.due) * 100) + '%</span></td></tr>';
  }).join('');
  return '<div class="eg mb"><div class="phd"><div><h2>Unabsorbed boat rent '
      + '<span class="pill ' + (gap > 0 ? 'ro' : 'em') + '">' + pxN(gap) + ' ฿</span></h2>'
      + '<p>ค่าเช่าเรือที่จ่ายจริงทั้งงวด เทียบกับส่วนที่ทริปรับไปแล้ว · '
      + 'ส่วนต่างคือ<b>ค่าเช่าวันที่เรือไม่ได้วิ่ง</b> ซึ่งไม่มีทริปไหนแบกให้</p></div></div>'
    + '<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:620px">'
    + '<thead><tr><th class="l">Boat · contract</th><th class="c">Days run / plan</th>'
    + '<th>Rent due</th><th>Absorbed by trips</th><th>Unabsorbed</th><th class="c">Coverage</th></tr></thead>'
    + '<tbody>' + tr
    + '<tr class="tot"><td class="l">Σ ' + rows.length + ' rented boat' + (rows.length === 1 ? '' : 's') + '</td>'
    + '<td class="c"></td><td><span class="num n">' + pxN(due) + '</span></td>'
    + '<td><span class="num n">' + pxN(bkd) + '</span></td>'
    + '<td class="netc' + (gap > 0 ? ' neg' : '') + '"><span class="net' + (gap > 0 ? ' neg' : '') + ' n">'
    + (gap > 0 ? ('−' + pxN(gap)) : '0') + '</span></td>'
    + '<td class="c"><span class="pill ' + (gap > 0 ? 'ro' : 'em') + '">'
    + Math.round(bkd / Math.max(1, due) * 100) + '%</span></td></tr></tbody></table></div></div>'
    + '<div class="mst"><div class="b"><small>Net profit MTD (จากทริป)</small>'
      + '<b class="n" style="color:' + (netMTD < 0 ? '#BE123C' : '#0F172A') + '">'
      + (netMTD < 0 ? '−' : '+') + pxN(Math.abs(netMTD)) + ' ฿</b>'
      + '<u class="n">ผลรวมของทุกทริปในเดือนนี้</u></div>'
    + '<div class="b"><small>ค่าเช่าที่ยังไม่ถูกดูดซับ</small>'
      + '<b class="n" style="color:#BE123C">−' + pxN(gap) + ' ฿</b>'
      + '<u class="n">จ่ายจริงแต่ไม่มีทริปไหนรับไป</u></div>'
    + '<div class="b"><small>Net หลังหักค่าเช่าเต็มก้อน</small>'
      + '<b class="n" style="color:' + (adj < 0 ? '#BE123C' : '#047857') + '">'
      + (adj < 0 ? '−' : '+') + pxN(Math.abs(adj)) + ' ฿</b>'
      + '<u class="n">ตัวเลขนี้คือคำตอบว่าการเช่าคุ้มหรือไม่</u></div>'
    + '<div class="b"><small>ต้องวิ่งเพิ่มอีก</small>'
      + '<b class="n">' + rows.reduce(function(a, r){
          return a + Math.max(0, Math.ceil(r.gap / Math.max(1, r.RN.perTrip * r.RN.trips))); }, 0) + ' วัน</b>'
      + '<u class="n">ถึงจะดูดซับค่าเช่าที่เหลือหมด</u></div></div></div>';
}

/* ══ MONTHLY ════════════════════════════════════════════════════════════════ */
function pxMonth(e){
  var ym=_px.mon||String(_px.date||'').slice(0,7);
  var days=pxDaysOf(ym);
  if(!days.length) return '<div class="empty">No days to report for '+e(ym)+' yet</div>';
  var A=days.map(function(d){ return pxDayAgg(d,_px.pier); });
  var T={rev:0,cost:0,profit:0,pax:0,bk:0,trips:0,loss:0,cap:0};
  A.forEach(function(x){ T.rev+=x.rev; T.cost+=x.cost; T.profit+=x.profit; T.pax+=x.pax;
    T.bk+=x.bk; T.trips+=x.trips; T.loss+=x.loss; T.cap+=x.cap; });

  /* เดือนก่อน ช่วงวันเดียวกัน · เทียบกันได้จริง ไม่ใช่ทั้งเดือนเทียบครึ่งเดือน */
  var py=+ym.slice(0,4), pm=+ym.slice(5,7)-1, pd=new Date(py,pm-1,1);
  var pym=pd.getFullYear()+'-'+String(pd.getMonth()+1).padStart(2,'0');
  var plast=new Date(pd.getFullYear(), pd.getMonth()+1, 0).getDate();
  var P={rev:0,profit:0,pax:0};
  days.forEach(function(d){
    var dd=+d.slice(8,10); if(dd>plast) return;
    var x=pxDayAgg(pym+'-'+String(dd).padStart(2,'0'), _px.pier);
    P.rev+=x.rev; P.profit+=x.profit; P.pax+=x.pax;
  });
  var dRev=P.rev?Math.round((T.rev-P.rev)/P.rev*100):0;
  var pct=T.rev?Math.round(T.cost/T.rev*100):0;
  var per=T.pax?Math.round(T.profit/T.pax):0;
  var lf=T.cap?Math.round(T.pax/T.cap*100):0;
  var mLbl=(PX_MON[(+ym.slice(5,7))-1]||'')+' '+ym.slice(0,4);

  var hero='<div class="phero"><div><h1>Monthly performance <span>('+e(mLbl)+' · 1–'+days.length+')</span></h1>'
    +'<p><span class="htag">'+T.trips+' trips · '+T.pax+' pax</span>'
    +(T.loss?('<span class="htag w">'+T.loss+' loss-making trip'+(T.loss===1?'':'s')+'</span>'):'')
    +'Month to date · compared with the same period in '+(PX_MON[(+pym.slice(5,7))-1]||'')+'</p></div>'
    +'<div class="pnet'+(T.profit<0?' neg':'')+'"><div class="pnic">'+pxIcoSvg(PX_SVG.up)+'</div>'
    +'<div><small>'+(T.profit<0?'NET LOSS MTD':'NET PROFIT MTD')+'</small>'
    +'<b class="n">'+(T.profit<0?'−':'+')+pxN(Math.abs(T.profit))+' ฿</b></div></div></div>';

  var kpi='<div class="pk4">'
    +'<div class="kc"><div class="k1"><div><p class="lb">Revenue MTD'
      +(P.rev?(' <span class="pill '+(dRev<0?'ro':'em')+'">'+(dRev>=0?'+':'')+dRev+'%</span>'):'')+'</p>'
      +'<h3 class="n">'+pxN(T.rev)+'<u>฿</u></h3></div><div class="pxico blue">'+pxIcoSvg(PX_SVG.rev)+'</div></div>'
      +'<div class="kft"><span><b class="n">'+pxN(T.rev/Math.max(1,T.pax))+'</b> ฿/pax · '+T.bk+' bookings</span>'
      +(P.rev?('<span class="pill g n">prev '+pxN(P.rev)+'</span>'):'')+'</div></div>'
    +'<div class="kc"><div class="k1"><div><p class="lb">Cost MTD '
      +'<span class="pill '+(pct>=100?'ro':'am')+'">'+pct+'%</span></p>'
      +'<h3 class="n">'+pxN(T.cost)+'<u>฿</u></h3></div><div class="pxico or">'+pxIcoSvg(PX_SVG.cost)+'</div></div>'
      +'<div class="kft"><span><b class="n">'+pxN(T.cost/Math.max(1,T.pax))+'</b> ฿/pax</span>'
      +'<span class="pill g">'+T.trips+' trips</span></div></div>'
    +'<div class="kc"><div class="k1"><div><p class="lb">Net profit MTD '
      +'<span class="pill '+(T.profit<0?'ro':'em')+'">'+(T.rev?(Math.round(T.profit/T.rev*100)+'%'):'—')+'</span></p>'
      +'<h3 class="n" style="color:'+(T.profit<0?'#E11D48':'#059669')+'">'+(T.profit<0?'−':'+')
      +pxN(Math.abs(T.profit))+'<u style="color:'+(T.profit<0?'#FB7185':'#10B981')+'">฿</u></h3></div>'
      +'<div class="pxico em">'+pxIcoSvg(PX_SVG.pro)+'</div></div>'
      +'<div class="kft"><span style="color:'+(per<0?'#BE123C':'#047857')+';font-weight:600">'
      +(per<0?'−':'+')+pxN(Math.abs(per))+' ฿/pax</span>'
      +(P.profit?('<span class="pill g n">prev '+(P.profit<0?'−':'+')+pxN(Math.abs(P.profit))+'</span>'):'')+'</div></div>'
    +'<div class="kc"><div class="k1"><div><p class="lb">Avg load factor</p>'
      +'<h3 class="n">'+lf+'<u>%</u></h3></div><div class="pxico pu">'+pxIcoSvg(PX_SVG.ppl)+'</div></div>'
      +'<div class="kft"><span>'+Math.round(T.pax/Math.max(1,T.trips))+' pax avg · cap '
      +Math.round(T.cap/Math.max(1,T.trips))+'</span>'
      +'<span class="pill pu">'+T.loss+' loss trips</span></div></div></div>';

  /* กราฟแท่ง · สูงตามรายได้ · แถบล่างคือกำไร/ขาดทุนของวันนั้น */
  var mx=A.reduce(function(m,x){ return Math.max(m,x.rev); },0)||1;
  var bars=A.map(function(x){
    var W=pxDW(x.date);
    var hR=Math.round(x.rev/mx*100), hN=Math.round(Math.abs(x.profit)/mx*100);
    return '<div class="cd" onclick="pxGoDay(\''+e(x.date)+'\')">'
      +'<div class="tip">'+e(W.txt)+' · Rev '+pxN(x.rev)+' ฿ · Net '
        +(x.profit<0?'−':'+')+pxN(Math.abs(x.profit))+' ฿ · '+x.trips+' trips</div>'
      +'<div class="rev" style="height:'+hR+'%"></div>'
      +'<div class="net'+(x.profit<0?' neg':'')+'" style="height:'+Math.max(x.rev?2:0,hN)+'%"></div></div>';
  }).join('');
  var xax=A.map(function(x){ var W=pxDW(x.date);
    return '<span class="'+(W.we?'we':'')+'" onclick="pxGoDay(\''+e(x.date)+'\')">'+W.d+'</span>'; }).join('');

  var best=null, worst=null;
  A.forEach(function(x){ if(!x.trips) return;
    if(!best||x.profit>best.profit) best=x; if(!worst||x.profit<worst.profit) worst=x; });

  /* รวมรายเส้นทางทั้งเดือน */
  var RT={};
  A.forEach(function(x){ Object.keys(x.routes).forEach(function(k){
    var s=x.routes[k], r=RT[k]||(RT[k]={name:s.name,color:s.color,n:0,pax:0,rev:0,cost:0,profit:0});
    r.n+=s.n; r.pax+=s.pax; r.rev+=s.rev; r.cost+=s.cost; r.profit+=s.profit; }); });
  var RL=Object.keys(RT).map(function(k){ return RT[k]; }).sort(function(a,b){ return b.profit-a.profit; });
  var rkCls=['t1','t2','t3'];
  var rtRows=RL.map(function(r,i){
    var loss=r.profit<0, mg=r.rev?Math.round(r.profit/r.rev*100):0;
    return '<tr class="br'+(loss?' loss':'')+'"><td class="l"><span class="rank '
      +(loss?'bad':(rkCls[i]||''))+'">'+(i+1)+'</span></td>'
      +'<td class="l"><b style="font-size:12.5px">'+e(r.name)+'</b>'
      +'<div class="per">'+r.n+' trips · '+r.pax+' pax</div></td>'
      +'<td class="c"><span class="num n">'+r.n+'</span></td>'
      +'<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
      +(loss?'−':'+')+pxN(Math.abs(r.profit))+'</span>'
      +'<div class="per '+(loss?'negp':'pos')+' n">'+pxN(r.profit/Math.max(1,r.pax))+'/pax</div></td>'
      +'<td class="c"><span class="pill '+(mg<0?'ro':(mg<12?'am':'em'))+'">'+mg+'%</span></td></tr>';
  }).join('');
  var badR=RL.filter(function(r){ return r.profit<0; });

  var dayRows=A.map(function(x){
    if(!x.trips) return '';
    var W=pxDW(x.date), loss=x.profit<0, mg=x.rev?Math.round(x.profit/x.rev*100):0;
    return '<tr class="br'+(loss?' loss':'')+'" onclick="pxGoDay(\''+e(x.date)+'\')">'
      +'<td class="l"><b style="font-size:12.5px'+(W.we?';color:#BE123C':'')+'">'+e(W.txt)+'</b></td>'
      +'<td class="c"><span class="num n">'+x.trips+'</span></td>'
      +'<td class="c"><span class="num n">'+x.pax+'</span></td>'
      +'<td><span class="num n">'+pxN(x.rev)+'</span></td>'
      +'<td><span class="num cost n">'+pxN(x.cost)+'</span></td>'
      +'<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
      +(loss?'−':'+')+pxN(Math.abs(x.profit))+'</span></td>'
      +'<td class="c"><span class="pill '+(mg<0?'ro':(mg<12?'am':'em'))+'">'+mg+'%</span></td></tr>';
  }).join('');

  var rentIdle=pxRentIdleHtml(e, pxRentIdle(days), T.profit);   /* §rentIdle */

  return hero+kpi+rentIdle
    +'<div class="eg mb"><div class="phd"><div><h2>Daily revenue and net '
      +'<span class="pill bl">'+e(mLbl)+'</span></h2>'
      +'<p>Light blue = revenue · green/red = the net result of that day · click a bar to open that day</p></div>'
      +'<div style="display:flex;gap:10px;align-items:center;font-size:11px;color:#64748B">'
      +'<span style="display:flex;align-items:center;gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#BFDBFE;display:inline-block"></i>Revenue</span>'
      +'<span style="display:flex;align-items:center;gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#10B981;display:inline-block"></i>Net</span>'
      +'<span style="display:flex;align-items:center;gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#E11D48;display:inline-block"></i>Loss</span></div></div>'
    +'<div class="chart">'+bars+'</div><div class="xaxis">'+xax+'</div>'
    +'<div class="mst">'
      +'<div class="b"><small>Best day</small><b class="n">'+(best?e(pxDW(best.date).txt):'—')+'</b>'
        +'<u class="n">'+(best?('+'+pxN(best.profit)+' ฿ · '+best.trips+' trips · '+best.pax+' pax'):'')+'</u></div>'
      +'<div class="b"><small>Worst day</small><b class="n" style="color:'+((worst&&worst.profit<0)?'#BE123C':'#0F172A')+'">'
        +(worst?e(pxDW(worst.date).txt):'—')+'</b>'
        +'<u class="n">'+(worst?((worst.profit<0?'−':'+')+pxN(Math.abs(worst.profit))+' ฿ · '+worst.trips+' trips · '+worst.pax+' pax'):'')+'</u></div>'
      +'<div class="b"><small>Best route</small><b>'+(RL.length?e(RL[0].name):'—')+'</b>'
        +'<u class="n">'+(RL.length?('+'+pxN(RL[0].profit)+' ฿ · '+RL[0].n+' trips'):'')+'</u></div>'
      +'<div class="b"><small>Cost ratio</small><b class="n">'+pct+'%</b>'
        +'<u class="n">'+pxN(T.cost/Math.max(1,T.pax))+' ฿/pax on '+pxN(T.rev/Math.max(1,T.pax))+'</u></div>'
    +'</div></div>'
    +'<div class="g3"><div class="eg"><div class="phd"><div><h2>Day by day</h2>'
      +'<p>Click a row to open that day in the Daily tab</p></div></div>'
      +'<div class="twrap"><div class="tscroll cap"><table class="sum" style="min-width:620px">'
      +'<thead><tr><th class="l">Date</th><th class="c">Trips</th><th class="c">Pax</th>'
      +'<th>Revenue</th><th>Cost</th><th>Net</th><th class="c">Margin</th></tr></thead><tbody>'
      +dayRows
      +'<tr class="tot"><td class="l">Σ '+e(mLbl)+'</td><td class="c"><span class="num n">'+T.trips+'</span></td>'
      +'<td class="c"><span class="num n">'+T.pax+'</span></td>'
      +'<td><span class="num n">'+pxN(T.rev)+'</span></td>'
      +'<td><span class="num cost n">'+pxN(T.cost)+'</span></td>'
      +'<td class="netc'+(T.profit<0?' neg':'')+'"><span class="net'+(T.profit<0?' neg':'')+' n">'
      +(T.profit<0?'−':'+')+pxN(Math.abs(T.profit))+'</span></td>'
      +'<td class="c"><span class="pill '+(T.profit<0?'ro':'em')+'">'
      +(T.rev?Math.round(T.profit/T.rev*100):0)+'%</span></td></tr>'
      +'</tbody></table></div></div></div>'
    +'<div class="eg"><div class="phd"><div><h2>By route this month</h2>'
      +'<p>Where the month\'s profit actually came from</p></div></div>'
      +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:400px">'
      +'<thead><tr><th class="l">#</th><th class="l">Route</th><th class="c">Trips</th>'
      +'<th>Net</th><th class="c">Margin</th></tr></thead><tbody>'+rtRows
      +'<tr class="tot"><td class="l">Σ</td><td class="l">'+RL.length+' routes</td>'
      +'<td class="c"><span class="num n">'+T.trips+'</span></td>'
      +'<td class="netc'+(T.profit<0?' neg':'')+'"><span class="net'+(T.profit<0?' neg':'')+' n">'
      +(T.profit<0?'−':'+')+pxN(Math.abs(T.profit))+'</span>'
      +'<div class="per pos n">'+pxN(T.profit/Math.max(1,T.pax))+'/pax</div></td>'
      +'<td class="c"><span class="pill '+(T.profit<0?'ro':'em')+'">'
      +(T.rev?Math.round(T.profit/T.rev*100):0)+'%</span></td></tr></tbody></table></div></div>'
      +(badR.length?('<div class="hint"><b>'+e(badR.map(function(r){return r.name;}).join(', '))
        +(badR.length===1?' is the only route':' are the routes')+' losing money this month.</b> '
        +badR.map(function(r){ return e(r.name)+': '+r.n+' trips, '+r.pax+' pax, '
          +Math.round(r.pax/Math.max(1,r.n))+' pax per trip on average, '
          +pxN(r.profit/Math.max(1,r.pax))+' ฿ per head.'; }).join(' ')+'</div>')
        :'<div class="hint"><b>Every route made money this month.</b> The weakest is '
          +(RL.length?(e(RL[RL.length-1].name)+' at '+pxN(RL[RL.length-1].profit/Math.max(1,RL[RL.length-1].pax))+' ฿ per head.'):'—')+'</div>')
      +'</div></div>';
}
function pxGoDay(d){ _px.date=d; _px.tab='d'; renderTripPL(); }

/* ══ ANALYSIS ═══════════════════════════════════════════════════════════════ */
function pxAnalysis(e){
  var N=_px.an||47;
  var end=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  var days=pxBackDays(N, end);
  var A=days.map(function(d){ return pxDayAgg(d,_px.pier); });
  var T={rev:0,cost:0,profit:0,pax:0,bk:0,trips:0,cap:0};
  var RT={}, AGN={}, GRP={}, bandN=[0,0,0,0], bandNet=[0,0,0,0], bandPax=[0,0,0,0];
  A.forEach(function(x){
    T.rev+=x.rev; T.cost+=x.cost; T.profit+=x.profit; T.pax+=x.pax; T.bk+=x.bk; T.trips+=x.trips; T.cap+=x.cap;
    Object.keys(x.routes).forEach(function(k){ var s=x.routes[k];
      var r=RT[k]||(RT[k]={name:s.name,color:s.color,pier:s.pier,n:0,pax:0,rev:0,cost:0,profit:0,cap:0,be:0,beN:0});
      r.n+=s.n; r.pax+=s.pax; r.rev+=s.rev; r.cost+=s.cost; r.profit+=s.profit; r.cap+=s.cap;
      r.be+=s.be; r.beN+=s.beN; });
    Object.keys(x.agents).forEach(function(k){ var s=x.agents[k];
      /* §agFair · ตัวเลขสัญญาต้องเดินทางมาถึงชั้นนี้ด้วย ไม่งั้นช่องในตารางไม่มีอะไรให้เทียบ */
      var g=AGN[k]||(AGN[k]={name:s.name,b2c:s.b2c,mk:(s.mk||''),n:0,pax:0,rev:0,cost:0,routes:{},
        exp:0, expAmt:0, expPax:0, expMiss:0, zn:{}, rtn:{}});
      if(!g.mk && s.mk) g.mk=s.mk;
      g.n+=s.n; g.pax+=s.pax; g.rev+=s.rev; g.cost+=s.cost;
      g.exp+=(s.exp||0); g.expAmt+=(s.expAmt||0); g.expPax+=(s.expPax||0); g.expMiss+=(s.expMiss||0);
      pxMrg(g.zn,s.zn); pxMrg(g.rtn,s.rtn);
      Object.keys(s.routes||{}).forEach(function(rk2){ var q=s.routes[rk2];
        var d=g.routes[rk2]||(g.routes[rk2]={n:0,pax:0,rev:0,cost:0,
          exp:0, expAmt:0, expPax:0, expMiss:0, zn:{}, rtn:{}});
        d.n+=q.n; d.pax+=q.pax; d.rev+=q.rev; d.cost+=q.cost;
        d.exp+=(q.exp||0); d.expAmt+=(q.expAmt||0); d.expPax+=(q.expPax||0); d.expMiss+=(q.expMiss||0);
        pxMrg(d.zn,q.zn); pxMrg(d.rtn,q.rtn); }); });
    Object.keys(x.groups).forEach(function(k){ GRP[k]=(GRP[k]||0)+x.groups[k]; });
    for(var i=0;i<4;i++){ bandN[i]+=x.bandN[i]; bandNet[i]+=x.bandNet[i]; bandPax[i]+=x.bandPax[i]; }
  });
  if(!T.trips) return '<div class="empty">No trips in the last '+N+' days'+(_px.pier?' at this pier':'')+'</div>';

  var RL=Object.keys(RT).map(function(k){ var r=RT[k];
    r.k=k;
    r.rph=r.rev/Math.max(1,r.pax); r.cph=r.cost/Math.max(1,r.pax); r.nph=r.profit/Math.max(1,r.pax);
    r.lf=r.cap?(r.pax/r.cap):0; r.beAvg=r.beN?Math.round(r.be/r.beN):0;
    r.avgPax=Math.round(r.pax/Math.max(1,r.n)); r.avgCap=Math.round(r.cap/Math.max(1,r.n));
    return r; }).sort(function(a,b){ return b.nph-a.nph; });
  var AL=Object.keys(AGN).map(function(k){ var g=AGN[k];
    g.rph=g.rev/Math.max(1,g.pax); g.cph=g.cost/Math.max(1,g.pax); g.nph=g.rph-g.cph;
    g.net=g.rev-g.cost; return g; }).sort(function(a,b){ return b.net-a.net; });
  var below=AL.filter(function(g){ return g.nph<0; });
  var belowDrag=below.reduce(function(s,g){ return s+g.net; },0);
  var GL=Object.keys(GRP).map(function(k){ return {g:k, v:GRP[k], c:pxGColor(k)}; })
    .filter(function(x){ return Math.round(x.v)!==0; }).sort(function(a,b){ return b.v-a.v; });
  var gTot=GL.reduce(function(s,x){ return s+x.v; },0)||1;
  var tgt=(typeof drCfg==='function')?((drCfg()||{}).targetPerPax||0):0;
  var lfAll=T.cap?Math.round(T.pax/T.cap*100):0;

  /* §beFit · ต้นทุนจริงของทริปที่แล่นไปแล้ว · cost = คงที่ต่อทริป + ต่อหัว × จำนวนคน
     สูตรในแผนบอกจุดคุ้มทุน "ตามที่ตั้งใจ" · อันนี้บอก "ตามที่เกิดขึ้นจริง"
     น้ำมันกับค่าจ้างลูกเรือแทบไม่ขยับตามจำนวนคน ต้นทุนต่อหัวจึงพุ่งเมื่อเรือไม่เต็ม */
  var TRR={}, ALLTR=[];
  A.forEach(function(x){ (x.tr||[]).forEach(function(t){
    ALLTR.push(t); (TRR[t.rid]||(TRR[t.rid]=[])).push(t); }); });
  function pxFit(L){
    if(!L || L.length<4) return null;
    var n=L.length, sx=0, sy=0, sxx=0, sxy=0;
    L.forEach(function(t){ sx+=t.pax; sy+=t.cost; sxx+=t.pax*t.pax; sxy+=t.pax*t.cost; });
    var den=n*sxx-sx*sx; if(!den) return null;
    var vpp=(n*sxy-sx*sy)/den, fix=(sy-vpp*sx)/n;
    /* ต้นทุนคงที่ติดลบ หรือต่อหัวติดลบ = เส้นตรงมั่ว ข้อมูลน้อยเกินไป · อย่าเอาไปโชว์ */
    if(!isFinite(fix) || !isFinite(vpp) || fix<=0 || vpp<0) return null;
    return { fix:fix, vpp:vpp, n:n };
  }
  RL.forEach(function(r){
    r.fit=pxFit(TRR[r.k]);
    r.beFit=null;
    if(r.fit){ var m=r.rph-r.fit.vpp; if(m>0) r.beFit=Math.ceil(r.fit.fix/m); }
  });

  /* §revFlag · รายได้ต่อหัวต่ำผิดวิสัย = เกือบทุกครั้งคือใบจองกรอกผิด ไม่ใช่ขาดทุนจากการเดินเรือ
     เทียบกับค่าเฉลี่ยของเส้นทางเดียวกัน · เส้นทางที่มีคนน้อยเกินไปไม่มีค่าเฉลี่ยที่เชื่อได้ ข้ามไป */
  var FLAG=[];
  ALLTR.forEach(function(t){
    if(!t.pax) return;
    var R0=RT[t.rid]; if(!R0 || R0.pax<20) return;
    var avg=R0.rev/Math.max(1,R0.pax), rph=t.rev/t.pax;
    if(avg>0 && rph<avg*0.3)
      FLAG.push({ date:t.date, name:t.name, route:R0.name||t.rid, pax:t.pax,
                  rph:Math.round(rph), avg:Math.round(avg), gap:Math.round(t.rev-t.cost),
                  miss:Math.round(avg*t.pax-t.rev) });
  });
  FLAG.sort(function(a,b){ return a.gap-b.gap; });
  var flagMiss=FLAG.reduce(function(a,x){ return a+x.miss; },0);

  /* §csDetail · รวมรายละเอียดรายหมวดข้ามทุกวันในช่วง */
  var GDT={};
  A.forEach(function(x){ var gd=x.gdet||{};
    Object.keys(gd).forEach(function(g){
      var sc=gd[g], d=GDT[g]||(GDT[g]={ v:0, est:0, trips:0, src:{}, lines:{}, routes:{} });
      d.v+=sc.v; d.est+=sc.est; d.trips+=sc.trips;
      Object.keys(sc.src||{}).forEach(function(k){ d.src[k]=(d.src[k]||0)+sc.src[k]; });
      Object.keys(sc.lines||{}).forEach(function(k){ d.lines[k]=(d.lines[k]||0)+sc.lines[k]; });
      Object.keys(sc.routes||{}).forEach(function(k){ d.routes[k]=(d.routes[k]||0)+sc.routes[k]; });
    });
  });
  /* ช่วงก่อนหน้าที่ยาวเท่ากัน · ไม่มีตัวเทียบก็ไม่ต้องเดา ปล่อยเป็นขีด */
  var PT={rev:0,cost:0,pax:0,trips:0}, PG={}, pOK=false;
  try{
    var pEnd=pxBackDays(2, days[0])[0];
    pxBackDays(N, pEnd).forEach(function(d){
      var x=pxDayAgg(d,_px.pier);
      PT.rev+=x.rev; PT.cost+=x.cost; PT.pax+=x.pax; PT.trips+=x.trips;
      Object.keys(x.groups||{}).forEach(function(k){ PG[k]=(PG[k]||0)+x.groups[k]; });
    });
    pOK=PT.trips>0;
  }catch(_){}
  function pxTrd(cur, prev){
    if(!pOK || !prev) return '<span class="trd fl">\u2014</span><div class="per">no history</div>';
    var p=(cur-prev)/Math.abs(prev)*100, d=Math.round(cur-prev);
    var k=(Math.abs(p)<1)?'fl':(p>0?'up':'dn');
    return '<span class="trd '+k+'">'
      +(k==='fl'?'\u2014 ':(p>0?'\u25b2 ':'\u25bc '))+Math.abs(p).toFixed(1)+'%</span>'
      +'<div class="per'+(k==='fl'?'':(p>0?' negp':' pos'))+'">'
      +(k==='fl'?'flat':((d>0?'+':'\u2212')+pxN(Math.abs(d))+' \u0e3f'))+'</div>';
  }
  var PXQC={ r:'#10B981', p:'#3B82F6', f:'#CBD5E1', w:'#F59E0B' };
  var qAll=0, qReal=0;
  var GLx=Object.keys(GDT).map(function(g){
    var d=GDT[g], sc=d.src||{};
    var rk=Object.keys(d.routes).sort(function(a,b){ return Math.abs(d.routes[b])-Math.abs(d.routes[a]); })[0];
    var R0=rk?RT[rk]:null;
    var tt=0; ['r','p','f','w'].forEach(function(k){ tt+=Math.abs(sc[k]||0); });
    qAll+=tt; qReal+=Math.abs(sc.r||0);
    return { g:g, v:d.v, c:pxGColor(g), trips:d.trips,
             nline:Object.keys(d.lines||{}).length,
             rn:R0?R0.name:'', rc:R0?R0.color:'#CBD5E1',
             rsh:(rk&&d.v)?Math.round(Math.abs(d.routes[rk]/d.v)*100):0,
             pv:(PG[g]||0),
             q:{ r:tt?Math.abs(sc.r||0)/tt:0, p:tt?Math.abs(sc.p||0)/tt:0,
                 f:tt?Math.abs(sc.f||0)/tt:0, w:tt?Math.abs(sc.w||0)/tt:0 } };
  }).filter(function(x){ return Math.round(x.v)!==0; }).sort(function(a,b){ return b.v-a.v; });
  var qPct=qAll?Math.round(qReal/qAll*100):0;
  var movers=GLx.filter(function(x){ return pOK && x.pv>0 && (x.v-x.pv)/x.pv>0.05; })
    .sort(function(a,b){ return (b.v-b.pv)-(a.v-a.pv); }).slice(0,2);

  /* §wkTrend · ก้อนละ 7 วัน นับถอยจากวันสุดท้าย · สัปดาห์ที่ไม่มีทริปเลยไม่ต้องโชว์ */
  var WK=[];
  for(var wi=A.length; wi>0; wi-=7){
    var seg=A.slice(Math.max(0,wi-7), wi);
    var w={ rev:0, cost:0, pax:0, trips:0, d1:seg[seg.length-1].date, d0:seg[0].date };
    seg.forEach(function(x){ w.rev+=x.rev; w.cost+=x.cost; w.pax+=x.pax; w.trips+=x.trips; });
    if(w.trips) WK.unshift(w);
  }
  WK=WK.slice(-8);
  var wMax=1, wWorst=null;
  WK.forEach(function(w){
    w.rph=w.rev/Math.max(1,w.pax); w.cph=w.cost/Math.max(1,w.pax); w.nph=w.rph-w.cph;
    if(w.rph>wMax) wMax=w.rph; if(w.cph>wMax) wMax=w.cph;
    if(!wWorst || w.nph<wWorst.nph) wWorst=w;
  });
  var wkHtml=WK.map(function(w){
    var loss=w.nph<0;
    var hC=Math.round(w.cph/wMax*100), hN=Math.round(Math.max(0,w.nph)/wMax*100);
    return '<div class="wkc" title="'+e(w.d0)+' \u2192 '+e(w.d1)+' \u00b7 '+w.trips+' trips \u00b7 '
      +w.pax+' pax \u00b7 rev '+pxN(w.rph)+'/pax \u00b7 cost '+pxN(w.cph)+'/pax">'
      +'<span class="wkv'+(loss?' neg':'')+'">'+(loss?'\u2212':'+')+pxN(Math.abs(w.nph))+'</span>'
      +'<div class="wkst">'+(hN>0?('<i style="height:'+hN+'%;background:#059669"></i>'):'')
      +'<i style="height:'+hC+'%;background:'+(loss?'#E11D48':'#F59E0B')+'"></i></div>'
      +'<span class="wklb">'+e(String(pxDW(w.d1).txt).replace(/^[A-Za-z]+ /,''))+'</span></div>';
  }).join('');

  var csRows=GLx.map(function(x){
    return '<tr class="br"><td class="l"><div class="bn"><i style="background:'+e(x.c)+'"></i><div>'
      +'<b>'+e(x.g)+'</b><small>'+x.nline+' item'+(x.nline===1?'':'s')+' \u00b7 '+x.trips+' trips</small>'
      +'</div></div></td>'
      +'<td><span class="num n">'+pxN(x.v)+'</span></td>'
      +'<td class="c"><span class="num n">'+(gTot?(x.v/gTot*100).toFixed(1):'0.0')+'%</span></td>'
      +'<td class="c"><span class="num n">'+(T.rev?(x.v/T.rev*100).toFixed(1):'0.0')+'%</span></td>'
      +'<td><span class="num cost n">'+pxN(x.v/Math.max(1,T.pax))+'</span></td>'
      +'<td class="c">'+pxTrd(x.v, x.pv)+'</td>'
      +'<td class="l">'+(x.rn
        ?('<div class="bn"><i style="background:'+e(x.rc)+';height:16px"></i><div>'
          +'<b style="font-size:11.5px">'+e(x.rn)+'</b><small>'+x.rsh+'% of the line</small></div></div>')
        :'<span class="mut">\u2014</span>')+'</td>'
      +'<td class="c"><div class="qbar">'
      +['r','p','f','w'].map(function(k){ var q=x.q[k]||0;
          return q>0.001?('<i style="width:'+(q*100).toFixed(1)+'%;background:'+PXQC[k]+'"></i>'):''; }).join('')
      +'</div><div class="qmeta">'+Math.round(x.q.r*100)+'% receipted</div></td></tr>';
  }).join('');

  var hero='<div class="phero"><div><h1>Analysis <span>(last '+N+' days · to '+e(end)+')</span></h1>'
    +'<p><span class="htag">'+T.trips+' trips · '+T.pax+' pax</span>'
    +(below.length?('<span class="htag w">'+below.length+' agent'+(below.length===1?'':'s')+' priced below cost</span>'):'')
    +'Which routes, agents and cost lines actually move the number</p></div>'
    +'<div class="pnet'+(T.profit<0?' neg':'')+'"><div class="pnic">'+pxIcoSvg(PX_SVG.up)+'</div>'
    +'<div><small>NET OVER '+N+' DAYS</small><b class="n">'+(T.profit<0?'−':'+')
    +pxN(Math.abs(T.profit))+' ฿</b></div></div></div>';

  var top=RL[0], bot=RL[RL.length-1];
  var ins='<div class="ins">'
    +'<div class="icd good"><small>Most profitable route</small><b>'+(top?e(top.name):'—')+'</b>'
      +'<p>'+(top?(pxN(top.nph)+' ฿ net per pax across '+top.n+' trips at '+Math.round(top.lf*100)
        +'% load factor.'):'')+'</p></div>'
    +'<div class="icd '+((bot&&bot.nph<0)?'bad':'warn')+'"><small>Weakest route</small><b>'+(bot?e(bot.name):'—')+'</b>'
      +'<p>'+(bot?(pxN(bot.nph)+' ฿ per pax. Averages '+bot.avgPax+' pax against a '
        +(bot.beAvg||'—')+'-pax break-even.'):'')+'</p></div>'
    +'<div class="icd '+(below.length?'warn':'good')+'"><small>Below-cost agents</small>'
      +'<b>'+below.length+' of '+AL.length+' agents</b>'
      +'<p>'+(below.length?('They pay less per head than the trip costs. Combined drag of '
        +pxN(belowDrag)+' ฿ over '+N+' days.'):'Every agent is paying above the cost of carrying them.')+'</p></div>'
    +'<div class="icd"><small>Biggest cost line</small><b>'+(GL.length?(e(GL[0].g)+' · '
      +Math.round(GL[0].v/Math.max(1,T.rev)*100)+'%'):'—')+'</b>'
      +'<p>'+(GL.length?(pxN(GL[0].v/Math.max(1,T.pax))+' ฿ per head, '
        +Math.round(GL[0].v/gTot*100)+'% of all cost.'):'')+'</p></div></div>';

  /* §beFit · ช่องจุดคุ้มทุน · ตัวเลขจากของจริงมาก่อน ไม่มีค่อยถอยไปใช้สูตรในแผน
     ต่างกันคนละเรื่อง จึงต้องเขียนกำกับว่าอันไหนเป็นอันไหน ไม่งั้นไม่มีใครรู้ว่าเชื่อได้แค่ไหน */
  function pxBeCell(r){
    if(r.fit){
      var m=r.rph-r.fit.vpp;
      if(m>0){
        var be=Math.ceil(r.fit.fix/m), pc=r.avgCap?Math.round(be/r.avgCap*100):0;
        return '<span class="tm fit n" title="'+e('Fitted from '+r.fit.n+' actual trips: cost = '
          +pxN(r.fit.fix)+' \u0e3f fixed per trip + '+pxN(r.fit.vpp)+' \u0e3f per head. '
          +'At the '+pxN(r.rph)+' \u0e3f average sold per head, every seat contributes '+pxN(m)
          +' \u0e3f toward the fixed cost, so the trip clears it at '+be+' pax'
          +(r.avgCap?(' \u2014 '+pc+'% of a '+r.avgCap+'-seat boat'):'')+'.')+'">'+be+'</span>'
          +'<div class="per">'+(r.avgCap?(pc+'% full'):'actual')+'</div>';
      }
      return '<span class="tm n" style="color:#BE123C" title="'+e('At the current average of '
        +pxN(r.rph)+' \u0e3f per head, each seat only covers '+pxN(r.rph)+' \u0e3f against a variable '
        +'cost of '+pxN(r.fit.vpp)+' \u0e3f \u2014 the boat never clears its '+pxN(r.fit.fix)
        +' \u0e3f fixed cost no matter how full it sails. This is a price problem, not a load problem.')
        +'">never</span><div class="per negp">at this price</div>';
    }
    return '<span class="tm plan n" title="From the route\'s cost plan \u2014 not enough completed '
      +'trips yet to fit the real fixed cost">'+(r.beAvg||'\u2014')+'</span>'
      +(r.beAvg?'<div class="per">from plan</div>':'');
  }
  var rtRows=RL.map(function(r,i){
    var loss=r.nph<0, lfp=Math.round(r.lf*100);
    var bc=(lfp>=75)?'#10B981':(lfp>=55?'#F59E0B':'#E11D48');
    return '<tr class="br'+(loss?' loss':'')+'">'
      +'<td class="l"><span class="rank '+(loss?'bad':(rkc(i)))+'">'+(i+1)+'</span></td>'
      +'<td class="l"><div class="bn"><i style="background:'+e(r.color)+'"></i><div><b>'+e(r.name)+'</b>'
        +'<small>cap '+r.avgCap+' · '+r.n+' trips</small></div></div></td>'
      +'<td class="c"><span class="num n">'+r.n+'</span></td>'
      +'<td class="c"><span class="num n">'+r.avgPax+'</span></td>'
      +'<td><span class="num n">'+pxN(r.rph)+'</span></td>'
      +'<td><span class="num cost n">'+pxN(r.cph)+'</span></td>'
      +'<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
        +(loss?'−':'+')+pxN(Math.abs(r.nph))+'</span>'
        +'<div class="per '+(loss?'negp':'pos')+'">'+(r.rev?Math.round(r.profit/r.rev*100):0)+'% margin</div></td>'
      +'<td class="c">'+pxBeCell(r)+'</td>'
      +'<td><div class="bars"><i style="width:'+Math.min(100,lfp)+'%;background:'+bc+'"></i></div>'
        +'<div class="bmeta"><span class="a" style="color:'+bc+'">'+lfp+'%</span>'
        +'<span class="b">'+r.avgPax+' / '+r.avgCap+'</span></div></td></tr>';
  }).join('');

  var stack=GL.map(function(x){ var w=x.v/gTot*100;
    return '<i style="width:'+w.toFixed(2)+'%;background:'+x.c+'">'+(w>=7?(Math.round(w)+'%'):'')+'</i>'; }).join('');
  var slg=GL.map(function(x){ return '<span><i style="background:'+x.c+'"></i>'+e(x.g)
    +' <b class="n">'+Math.round(x.v/Math.max(1,T.rev)*100)+'%</b> of revenue · <b class="n">'
    +pxN(x.v/Math.max(1,T.pax))+'</b>/pax</span>'; }).join('');

  var bandLbl=['Under 40%','40 – 60%','60 – 80%','Over 80%'];

  var bandRows=bandLbl.map(function(L,i){
    var nph=bandPax[i]?(bandNet[i]/bandPax[i]):0, loss=nph<0;
    var avg=bandN[i]?Math.round(bandPax[i]/bandN[i]):0;
    return '<tr><td class="l"><b>'+L+'</b><div class="per">'
      +(bandN[i]?('avg '+avg+' pax'):'no trips')+'</div></td>'
      +'<td class="c"><span class="num n">'+bandN[i]+'</span></td>'
      +'<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
      +(bandN[i]?((loss?'−':'+')+pxN(Math.abs(nph))):'—')+'</span></td>'
      +'<td class="c"><span class="pill '+(loss?'ro':(nph<(tgt||130)?'am':'em'))+'">'
      +(bandN[i]?(loss?'Loss':(nph<(tgt||130)?'Thin':'Healthy')):'—')+'</span></td></tr>';
  }).join('');
  var thin=bandN[0]+bandN[1];

  /* §agMx · เอเจนต์ × เส้นทาง · เอเจนต์คนเดียวกันกำไรคนละเรื่องในแต่ละเส้นทาง
     ตัวเลขรวมของเขาจึงกลบเส้นทางที่ขาดทุนไว้ · คอลัมน์เรียงตามหัวคน เส้นทางหลักอยู่ติดชื่อ */
  var AGN_TOP=_px.agAll ? Math.max(1,AL.length) : 15;   /* §agAll */
  var RCOL=RL.slice().sort(function(a,b){ return b.pax-a.pax; });
  var mxStep=Math.max(1, +tgt||130);
  function pxMxCls(v){
    if(v>=3*mxStep) return 'd3p';
    if(v>=mxStep)   return 'd2p';
    if(v>0)         return 'd1p';
    if(v===0)       return 'd0';
    if(v>-mxStep)   return 'd1n';
    if(v>-3*mxStep) return 'd2n';
    return 'd3n';
  }
  /* §mxWhy · ทำไมช่องนี้ติดลบ · สี่สาเหตุคนละเรื่อง แก้คนละทาง
     1 ไม่มีรายได้เลย = FOC / ทริปภายใน  2 รายได้ต่ำผิดวิสัย = ข้อมูลผิด
     3 ต้นทุนต่อหัวสูงกว่าเส้นทาง = ไปนั่งเรือที่ไม่เต็ม  4 ราคาต่ำกว่าเส้นทาง = rate card */
  function pxMxWhy(q, R0){
    var px=Math.max(1,q.pax), rph=q.rev/px, cph=q.cost/px;
    var rAvg=R0?(R0.rev/Math.max(1,R0.pax)):0, cAvg=R0?(R0.cost/Math.max(1,R0.pax)):0;
    /* §agFair · ตัวเทียบที่ถูกต้องคือ rate card ของช่องนี้เอง ไม่ใช่ค่าเฉลี่ยรวมของเส้นทาง
       eph = ราคาที่ควรได้ต่อหัว · aph = ที่เก็บได้จริงต่อหัว · คิดจากเฉพาะใบที่จับคู่เรตได้ */
    var _ep=+q.expPax||0;
    var eph=(_ep>0)?((+q.exp||0)/_ep):0;
    var aph=(_ep>0)?((+q.expAmt||0)/_ep):0;
    var zn=(typeof pxTopK==='function')?pxTopK(q.zn):'';
    var rtn=(typeof pxTopK==='function')?pxTopK(q.rtn):'';
    var ctx=(rtn||'rate card')+(zn?(' \u00b7 zone '+zn):'');
    var miss=+q.expMiss||0;
    if(rph<=5) return { tag:'FOC', cls:'dq',
      txt:'No revenue recorded against these heads \u2014 free-of-charge or an internal trip. '
         +'The cost is real, the loss is a welfare cost, not a pricing problem.' };
    if(rAvg>0 && rph<rAvg*0.3) return { tag:'check data', cls:'dq',
      txt:'Takes only '+pxN(rph)+' \u0e3f per head against a route average of '+pxN(rAvg)
         +' \u0e3f \u2014 that is almost always a booking typed as a total instead of a per-head price. '
         +'Check it before treating this as a real loss.' };
    /* จ่ายไม่ครบตามสัญญาของตัวเอง · นี่คือเงินหาย ต้องไปตาม ไม่ใช่เรื่องการตั้งราคา */
    if(eph>0 && aph<eph*0.97) return { tag:'under contract', cls:'dq',
      txt:'Its own rate card ('+ctx+') prices these heads at '+pxN(eph)
         +' \u0e3f, but only '+pxN(aph)+' \u0e3f was taken \u2014 a gap of '+pxN(eph-aph)
         +' \u0e3f per head, '+pxN((eph-aph)*_ep)+' \u0e3f on this cell. That is money not '
         +'collected, not a pricing decision. Check these bookings before reading anything '
         +'else in this row.' };
    if(cAvg>0 && cph>cAvg*1.15) return { tag:'empty boats', cls:'',
      txt:'Cost per head is '+Math.round((cph/cAvg-1)*100)+'% above the route average ('+pxN(cph)
         +' vs '+pxN(cAvg)+' \u0e3f) \u2014 these heads rode boats that sailed under-filled, so they '
         +'carried a bigger share of the fuel and crew. Fill the boat, not the rate card.' };
    /* จ่ายครบตามสัญญา แต่ยังต่ำกว่าค่าเฉลี่ยเส้นทาง · ตัวปัญหาคือสัญญาที่เราตั้งเอง ไม่ใช่เอเจนต์ */
    if(eph>0 && rAvg>0 && rph<rAvg*0.85) return { tag:'contract < cost', cls:'ct',
      txt:'Pays the rate card in full \u2014 '+ctx+' = '+pxN(eph)+' \u0e3f per head after VAT'
         +(miss?(' ('+miss+' booking'+(miss===1?'':'s')+' here carry no rate card and are left '
           +'out of this check)'):'')
         +'. It reads '+Math.round((rph/rAvg-1)*100)+'% under the route average of '+pxN(rAvg)
         +' \u0e3f only because that average blends every agent and every zone. The contract '
         +'itself sits '+pxN(cph-rph)+' \u0e3f per head below cost \u2014 that moves at the next '
         +'rate negotiation, not by chasing the agent.'
         +(zn==='NoTransfer'?(' Note: the cost shown still spreads the route\u2019s van cost '
           +'across these heads, and no-transfer guests never rode a van.'):'') };
    /* จับคู่เรตไม่ได้เลย · บอกได้แค่ว่าต่ำกว่าค่าเฉลี่ย ซึ่งเป็นตัวเทียบที่หยาบ · อย่าสรุปแทน */
    if(rAvg>0 && rph<rAvg*0.85) return { tag:'no rate card', cls:'dq',
      txt:'Pays '+pxN(rph)+' \u0e3f per head where the route averages '+pxN(rAvg)
         +' \u0e3f, against a cost of '+pxN(cph)+' \u0e3f. No rate card could be matched to these '
         +'bookings \u2014 priced by hand, or no rate type on the booking \u2014 so this can only '
         +'be read against the route average, which mixes every agent and zone. Check the rate '
         +'type on these bookings first.' };
    var lf=(R0&&R0.lf)?Math.round(R0.lf*100):0;
    return { tag:'thin route', cls:'',
      txt:'Priced in line with the route \u2014 the route itself is the problem. It sails '
         +(lf?(lf+'% full on average, so its '):'at a load factor that leaves its ')
         +'cost per head sits at '+pxN(cAvg)+' \u0e3f against '+pxN(rAvg)
         +' \u0e3f sold. Filling these boats, or running fewer of them, is what moves this cell.' };
  }
  function pxMxCell(q, label, R0, noWhy){
    if(!q || (!q.pax && Math.round(q.rev||0)===0))
      return '<td class="mx e"><div><span>\u2014</span></div></td>';
    var px=Math.max(1,q.pax), nph=Math.round((q.rev-q.cost)/px), loss=nph<0;
    var W=(loss && !noWhy)?pxMxWhy(q,R0):null;
    /* §agFair · ราคาตามสัญญาอยู่บรรทัดถัดจากรายได้จริงเสมอ · ไม่ต้องรอให้ขาดทุนถึงจะเห็น */
    var _ep2=+q.expPax||0;
    var _cp=(_ep2>0)?((+q.exp||0)/_ep2):0;      /* ควรได้ตามการ์ด */
    var _ca=(_ep2>0)?((+q.expAmt||0)/_ep2):0;   /* เก็บได้จริง · ฐานเดียวกัน = จำนวนที่จอง */
    var _cz=(typeof pxTopK==='function')?pxTopK(q.zn):'';
    var _cr=(typeof pxTopK==='function')?pxTopK(q.rtn):'';
    var ttl=label+' \u00b7 '+q.pax+' pax \u00b7 rev '+pxN(q.rev/px)+'/pax \u00b7 cost '
      +pxN(q.cost/px)+'/pax \u00b7 net '+pxN(q.rev-q.cost)+' \u0e3f'
      +(_cp>0?('\nRate card '+pxN(_cp)+' \u0e3f/pax \u00b7 taken '+pxN(_ca)+' \u0e3f/pax'
        +'\nBasis: '+_ep2+' booked pax matched to a rate card'
        +(_cr?(' \u00b7 '+_cr):'')+(_cz?(' \u00b7 zone '+_cz):'')):'')
      +(W?('\n\nWhy: '+W.txt):'');
    return '<td class="mx '+pxMxCls(nph)+'" title="'+e(ttl)+'">'
      +'<div><b class="'+(loss?'neg':'pos')+' n">'+(loss?'\u2212':'+')+pxN(Math.abs(nph))+'</b>'
      +'<small>'+q.pax+' pax</small>'
      +(W?('<u class="'+W.cls+'">'+e(W.tag)+'</u>'):'')+'</div></td>';
  }
  var agRows=AL.slice(0,AGN_TOP).map(function(g){
    var loss=g.nph<0, RS=g.routes||{};
    return '<tr class="br'+(loss?' loss':'')+'">'
      +'<td class="l stk"><div class="bn"><i style="background:'+pxAColor(g)+'"></i><div>'
      +'<b>'+e(g.name)+'</b><small>'+(g.b2c?'Direct \u00b7 no commission':'Agent')
      +' \u00b7 '+g.n+' booking'+(g.n===1?'':'s')+'</small></div></div></td>'
      +'<td class="c"><span class="num n">'+g.pax+'</span></td>'
      +RCOL.map(function(r){ return pxMxCell(RS[r.k], r.name, r); }).join('')
      +'<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
        +(loss?'\u2212':'+')+pxN(Math.abs(g.nph))+'</span></td>'
      +'<td class="netc'+(loss?' neg':'')+'"><span class="net'+(loss?' neg':'')+' n">'
        +(loss?'\u2212':'+')+pxN(Math.abs(g.net))+'</span></td>'
      +'<td class="c"><span class="pill '+(loss?'ro':(g.nph<(tgt||130)?'am':'em'))+'">'
        +(loss?'Below cost':(g.nph<(tgt||130)?'Thin':'Strong'))+'</span></td></tr>';
  }).join('');
  var mxHead=RCOL.map(function(r){
    return '<th class="rth"><i style="background:'+e(r.color)+'"></i>'+e(r.name)+'</th>'; }).join('');
  var mxFoot=RCOL.map(function(r){
    return pxMxCell({pax:r.pax, rev:r.rev, cost:r.cost}, r.name, r, true); }).join('');
  var mxWide=430+118*RCOL.length;
  /* เส้นทางที่ทั้งบริษัทขาดทุน · เอาไว้เขียนสรุปใต้ตาราง */
  var mxBad=RCOL.filter(function(r){ return r.nph<0; });

  /* §pxMkt · รายตลาด · ตารางเอเย่นต์บอกว่า "เจ้าไหน" แต่ไม่บอกว่า "ตลาดไหน"
     ซึ่งเป็นหน่วยที่ใช้ตัดสินใจจริง — จะไปออกงาน จะทำโปรฯ จะขึ้นราคา ทำกันเป็นตลาด ไม่ใช่รายเจ้า
     เรียงด้วยกำไรต่อหัว เพื่อไม่ให้ตลาดใหญ่ที่กำไรบางกลบตลาดเล็กที่กำไรดี · ยอดรวมโชว์คู่ไว้ให้เห็นน้ำหนัก */
  var MKM={};
  AL.forEach(function(g){
    var k=g.mk||'_none';
    var M=MKM[k]||(MKM[k]={ k:k, n:0, pax:0, rev:0, cost:0, ags:[] });
    M.n+=g.n; M.pax+=g.pax; M.rev+=g.rev; M.cost+=g.cost; M.ags.push(g);
  });
  var ML=Object.keys(MKM).map(function(k){
    var m=MKM[k];
    var mo=(k!=='_none' && typeof sbGetMarket==='function')?sbGetMarket(k):null;
    /* §pxMkt · ใบตรงถูกตั้ง market เป็น b2c ซึ่งไม่ได้อยู่ในทะเบียนตลาด · ใส่ชื่อให้เอง
       ไม่งั้นตารางขึ้นรหัสดิบ "b2c" ปนกับชื่อเต็มของตลาดอื่น */
    var FB={ b2c:'Direct · B2C', walkin:'Walk-in / Direct', staff:'Staff / Internal' };
    m.name=(mo&&mo.name)||FB[k]||(k==='_none'?'ไม่ระบุตลาด':String(k));
    m.color=(mo&&mo.color)||'#94A3B8';
    m.net=m.rev-m.cost;
    m.rph=m.rev/Math.max(1,m.pax); m.cph=m.cost/Math.max(1,m.pax);
    m.nph=m.net/Math.max(1,m.pax);
    m.ags.sort(function(a,b){ return b.nph-a.nph; });
    m.loss=m.ags.filter(function(a){ return a.nph<0; });
    m.drag=m.loss.reduce(function(s2,a){ return s2+a.net; },0);
    return m;
  }).filter(function(m){ return m.pax>0; }).sort(function(a,b){ return b.nph-a.nph; });

  var mkGood=ML.slice(0,5);
  var mkLossAll=ML.filter(function(m){ return m.nph<0; });
  /* §pxMkt · แผงขวาเป็น "5 อันดับท้าย" เสมอ ไม่ใช่เฉพาะตลาดที่ติดลบ
     ถ้ามีตลาดขาดทุนน้อยกว่า 5 แผงจะเหลือแถวเดียวสองแถว อ่านแล้วเหมือนไม่มีอะไรต้องดู
     ทั้งที่ตลาดที่กำไรบางเฉียบคือกลุ่มถัดไปที่จะพลิกเป็นลบ */
  var mkBad=ML.slice().sort(function(a,b){ return a.nph-b.nph; }).slice(0,5);
  var mkLossDrag=mkLossAll.reduce(function(s2,m){ return s2+m.net; },0);

  function pxMkRow(m, i, neg){
    return '<div class="mkr"><span class="rk">'+(i+1)+'</span>'
      +'<i style="background:'+e(m.color)+'"></i>'
      +'<div class="nm"><b>'+e(m.name)+'</b><small>'+m.ags.length+' agent'+(m.ags.length===1?'':'s')
        +' · '+m.pax+' pax'
        +(m.loss.length?(' · '+m.loss.length+' เจ้าขาดทุน'):'')+'</small></div>'
      +'<div class="v '+(neg?'neg':'pos')+'">'+(neg?'\u2212':'+')+pxN(Math.abs(m.nph))
        +'<small>'+(m.net<0?'\u2212':'+')+pxN(Math.abs(m.net))+' \u0e3f total</small></div></div>';
  }
  function pxMkAgLine(g, i){
    var neg=g.nph<0;
    return '<div class="mkr"><span class="rk">'+(i+1)+'</span>'
      +'<i style="background:'+pxAColor(g)+'"></i>'
      +'<div class="nm"><b>'+e(g.name)+'</b><small>'+g.pax+' pax · '+g.n+' booking'
        +(g.n===1?'':'s')+'</small></div>'
      +'<div class="v '+(neg?'neg':'pos')+'">'+(neg?'\u2212':'+')+pxN(Math.abs(g.nph))
        +'<small>'+(g.net<0?'\u2212':'+')+pxN(Math.abs(g.net))+' \u0e3f total</small></div></div>';
  }

  var mktCard = ML.length ? ('<div class="eg mb"><div class="phd"><div><h2>Market contribution</h2>'
    +'<p>Net per pax by market · ranked per head so a big thin market cannot hide a small strong one '
    +'· คลิกแถวในตารางเพื่อดูว่าเจ้าไหนดันขึ้น เจ้าไหนถ่วงลง</p></div>'
    +'<div><span class="pill pu">'+ML.length+' markets · '+AL.length+' agents</span></div></div>'
    +'<div class="mkw">'
      +'<div class="mkp"><h3>5 ตลาดที่กำไรต่อหัวดีที่สุด</h3>'
      +'<p>เรียงตามกำไรต่อหัว · ตัวเลขเล็กด้านล่างคือกำไรรวมของตลาดนั้น</p>'
      +mkGood.map(function(m,i){ return pxMkRow(m,i,m.nph<0); }).join('')+'</div>'
      +'<div class="mkp bad"><h3>5 ตลาดที่อ่อนที่สุด</h3>'
      +'<p>'+(mkLossAll.length
        ?(mkLossAll.length+' ตลาดขาดทุน · ลากกำไรรวมลง '+pxN(Math.abs(mkLossDrag))
          +' \u0e3f · ที่เหลือในแผงนี้คือกลุ่มถัดไปที่จะพลิกเป็นลบ')
        :'ไม่มีตลาดไหนขาดทุน · นี่คือกลุ่มที่กำไรต่อหัวบางที่สุด')+'</p>'
      +mkBad.map(function(m,i){ return pxMkRow(m,i,m.nph<0); }).join('')+'</div>'
    +'</div>'
    +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:760px">'
    +'<thead><tr><th class="l" style="min-width:212px">Market</th><th class="c">Agents</th>'
    +'<th class="c">Pax</th><th>Rev / pax</th><th>Cost / pax</th><th>Net / pax</th>'
    +'<th>Total net</th><th class="c">Status</th></tr></thead><tbody>'
    +ML.map(function(m){
      var neg=m.nph<0, on=(_px.mkO===m.k);
      var row='<tr class="br mkrow'+(neg?' loss':'')+(on?' on':'')+'" onclick="pxMkOpen(\''+e(m.k)+'\')">'
        +'<td class="l"><div class="bn"><i style="background:'+e(m.color)+'"></i><div>'
          +'<b>'+e(m.name)+'</b><small>'+(m.loss.length
            ?(m.loss.length+' เจ้าขาดทุน · ลาก '+pxN(Math.abs(m.drag))+' \u0e3f')
            :'ทุกเจ้ากำไร')+'</small></div></div></td>'
        +'<td class="c"><span class="num n">'+m.ags.length+'</span></td>'
        +'<td class="c"><span class="num n">'+m.pax+'</span></td>'
        +'<td><span class="num n">'+pxN(m.rph)+'</span></td>'
        +'<td><span class="num n">'+pxN(m.cph)+'</span></td>'
        +'<td class="netc'+(neg?' neg':'')+'"><span class="net'+(neg?' neg':'')+' n">'
          +(neg?'\u2212':'+')+pxN(Math.abs(m.nph))+'</span></td>'
        +'<td class="netc'+(m.net<0?' neg':'')+'"><span class="net'+(m.net<0?' neg':'')+' n">'
          +(m.net<0?'\u2212':'+')+pxN(Math.abs(m.net))+'</span></td>'
        +'<td class="c"><span class="pill '+(neg?'ro':(m.nph<(tgt||130)?'am':'em'))+'">'
          +(neg?'Below cost':(m.nph<(tgt||130)?'Thin':'Strong'))+'</span></td></tr>';
      if(!on) return row;
      var best=m.ags.filter(function(a){ return a.nph>=0; }).slice(0,5);
      var worst=m.loss.slice().sort(function(a,b){ return a.nph-b.nph; }).slice(0,5);
      return row+'<tr class="mkdet"><td colspan="8"><div class="mkdw">'
        +'<div><h4>Top 5 เจ้าที่ทำกำไรดีสุดในตลาดนี้</h4>'
          +(best.length?best.map(pxMkAgLine).join('')
            :'<div class="none">ไม่มีเจ้าที่กำไรเป็นบวกในตลาดนี้</div>')+'</div>'
        +'<div><h4>Top 5 เจ้าที่ขาดทุนหนักสุดในตลาดนี้</h4>'
          +(worst.length?worst.map(pxMkAgLine).join('')
            :'<div class="none">ไม่มีเจ้าไหนขาดทุนในตลาดนี้</div>')+'</div>'
        +'</div></td></tr>';
    }).join('')
    +'<tr class="tot"><td class="l">Σ '+ML.length+' markets</td>'
    +'<td class="c"><span class="num n">'+AL.length+'</span></td>'
    +'<td class="c"><span class="num n">'+T.pax+'</span></td>'
    +'<td><span class="num n">'+pxN(T.rev/Math.max(1,T.pax))+'</span></td>'
    +'<td><span class="num n">'+pxN(T.cost/Math.max(1,T.pax))+'</span></td>'
    +'<td class="netc"><span class="net n">'+pxN(T.profit/Math.max(1,T.pax))+'</span></td>'
    +'<td class="netc"><span class="net n">'+(T.profit<0?'\u2212':'+')+pxN(Math.abs(T.profit))+'</span></td>'
    +'<td class="c"><span class="pill pu">'+(T.rev?Math.round(T.profit/T.rev*100):0)+'%</span></td>'
    +'</tr></tbody></table></div></div>'
    +'<div class="hint"><b>'+e(ML[0].name)+' ทำกำไรต่อหัวสูงสุดที่ '+pxN(ML[0].nph)+' \u0e3f</b>'
      +(mkLossAll.length
        ?(' ส่วน '+e(mkBad[0].name)+' ขาดทุน '+pxN(Math.abs(mkBad[0].nph))
          +' \u0e3f ต่อหัว รวม '+pxN(Math.abs(mkBad[0].net))+' \u0e3f จาก '+mkBad[0].ags.length
          +' เจ้า · คลิกแถวนั้นเพื่อดูว่าเจ้าไหนเป็นตัวถ่วงจริง ๆ ก่อนจะไปแก้ทั้งตลาด')
        :(' ท้ายตาราง '+e(mkBad[0].name)+' เหลือ '+pxN(mkBad[0].nph)
          +' \u0e3f ต่อหัว · ยังบวกอยู่แต่บางที่สุด'))+'</div>'
    +'</div>') : '';

  /* §revFlag · การ์ดนี้ต้องอยู่ก่อนทุกอย่าง · ถ้าตัวเลขต้นทางผิด ทุกตารางข้างล่างก็ผิดตาม */
  var flagCard = FLAG.length ? ('<div class="eg warn mb"><div class="phd">'
    +'<div><h2>Revenue to check <span class="pill ro">'+FLAG.length+' trip'
      +(FLAG.length===1?'':'s')+'</span></h2>'
    +'<p>These trips took less than 30% of what their own route averages per head \u00b7 '
    +'almost always a booking entered as a total instead of a per-head price, not a real loss</p></div>'
    +'<div><span class="pill ro">'+pxN(flagMiss)+' \u0e3f unaccounted</span></div></div>'
    +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:820px">'
    +'<thead><tr><th class="l">Date</th><th class="l">Boat \u00b7 route</th><th class="c">Pax</th>'
    +'<th>Taken / pax</th><th>Route avg / pax</th><th>Shows as</th>'
    +'<th>Gap if priced normally</th></tr></thead><tbody>'
    +FLAG.slice(0,8).map(function(x){
      return '<tr class="br"><td class="l"><b>'+e(String(pxDW(x.date).txt))+'</b></td>'
        +'<td class="l"><div class="bn"><i style="background:#E11D48"></i><div><b>'+e(x.name)+'</b>'
        +'<small>'+e(x.route)+'</small></div></div></td>'
        +'<td class="c"><span class="num n">'+x.pax+'</span></td>'
        +'<td><span class="num n" style="color:#BE123C">'+pxN(x.rph)+'</span></td>'
        +'<td><span class="num n">'+pxN(x.avg)+'</span></td>'
        +'<td class="netc'+(x.gap<0?' neg':'')+'"><span class="net'+(x.gap<0?' neg':'')+' n">'
        +(x.gap<0?'\u2212':'+')+pxN(Math.abs(x.gap))+'</span></td>'
        +'<td><span class="num n">'+pxN(x.miss)+'</span></td></tr>';
    }).join('')
    +(FLAG.length>8?('<tr><td class="l" colspan="7" style="text-align:center;font-size:11.5px;'
      +'color:#94A3B8">\u2026 '+(FLAG.length-8)+' more</td></tr>'):'')
    +'</tbody></table></div></div>'
    +'<div class="hint"><b>Why this matters more than it looks.</b> '
    +'A trip like this drags the route average, the agent that booked it, and the load-factor bands '
    +'all at once \u2014 '+pxN(Math.abs(FLAG[0].gap))+' \u0e3f of the '+e(FLAG[0].route)
    +' loss sits in a single trip on '+e(String(pxDW(FLAG[0].date).txt))+'. '
    +'Fix the booking and every number below moves with it.</div></div>') : '';

  return hero+ins+flagCard
    +'<div class="eg mb"><div class="phd"><div><h2>Route profitability</h2>'
      +'<p>Ranked by net per pax · the break-even column is how many seats must sell before the trip stops losing money</p></div></div>'
      +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:900px">'
      +'<thead><tr><th class="l">#</th><th class="l">Route</th><th class="c">Trips</th><th class="c">Avg pax</th>'
      +'<th>Rev / pax</th><th>Cost / pax</th><th>Net / pax</th>'
      +'<th class="c" title="Seats that must sell before the trip stops losing money">B/E pax</th>'
      +'<th class="c">Load factor</th></tr></thead><tbody>'+rtRows
      +'<tr class="tot"><td class="l">Σ</td><td class="l">'+RL.length+' routes · '+T.trips+' trips</td>'
      +'<td class="c"><span class="num n">'+T.trips+'</span></td>'
      +'<td class="c"><span class="num n">'+Math.round(T.pax/Math.max(1,T.trips))+'</span></td>'
      +'<td><span class="num n">'+pxN(T.rev/Math.max(1,T.pax))+'</span></td>'
      +'<td><span class="num cost n">'+pxN(T.cost/Math.max(1,T.pax))+'</span></td>'
      +'<td class="netc"><span class="net n">'+pxN(T.profit/Math.max(1,T.pax))+'</span>'
      +'<div class="per pos">'+(T.rev?Math.round(T.profit/T.rev*100):0)+'% margin</div></td>'
      +'<td class="c"><span class="num mut">—</span></td>'
      +'<td><div class="bars"><i style="width:'+Math.min(100,lfAll)+'%;background:#4F46E5"></i></div>'
      +'<div class="bmeta"><span class="a" style="color:#3730A3">'+lfAll+'% avg</span>'
      +'<span class="b">'+Math.round(T.pax/Math.max(1,T.trips))+' / '+Math.round(T.cap/Math.max(1,T.trips))+'</span></div></td>'
      +'</tr></tbody></table></div></div>'
      +'<div class="hint"><b>The break-even column is fitted from real trips, not from the plan.</b> '
      +'Every completed trip gives one (pax, cost) pair; the line through them splits cost into what the '
      +'boat spends before anyone boards and what each extra head adds. '
      +(RL.filter(function(r){ return r.fit; }).length
        ? ('Right now '+RL.filter(function(r){ return r.fit; }).length+' of '+RL.length
           +' routes have enough trips to fit \u2014 hover any number to see the split. '
           +(function(){ var f=RL.filter(function(r){ return r.fit; })
                 .sort(function(a,b){ return b.fit.fix-a.fit.fix; })[0];
              return f?('The heaviest is '+e(f.name)+' at '+pxN(f.fit.fix)
                +' \u0e3f before a single passenger boards.'):''; })())
        : 'None of the routes has enough completed trips to fit yet \u2014 the numbers shown come from the plan. ')
      +'</div>'
      +'<div class="hint" style="margin-top:10px"><b>Load factor is the lever, not price.</b> '
      +'Every empty seat still carries its share of fuel, crew and pier fees. '+(bot&&bot.beAvg?('Moving '+e(bot.name)+' from '+bot.avgPax+' to '
      +Math.max(bot.beAvg+8, bot.avgPax+8)+' pax is worth roughly '
      +pxN(Math.abs(bot.cph*bot.avgPax/Math.max(1,bot.avgPax+8)-bot.cph))+' ฿ per head on the cost side alone.'):'')
      +'</div></div>'
    /* §csCard · การ์ดต้นทุน · เต็มความกว้าง · แถบสัดส่วน + ตารางรายหมวด + คุณภาพข้อมูล */
    +'<div class="eg mb"><div class="phd"><div><h2>Cost structure</h2>'
      +'<p>Last '+N+' days \u00b7 '+pxN(T.cost)+' \u0e3f spent against '+pxN(T.rev)+' \u0e3f of revenue'
      +(pOK?(' \u00b7 compared with the '+N+' days before that'):'')+'</p></div>'
      +'<div><span class="pill pu">'+(T.rev?Math.round(T.cost/T.rev*100):0)+'% of revenue</span></div></div>'
      +'<div class="stackbar">'+stack+'</div><div class="cslg">'+slg+'</div>'
      +'<div class="twrap" style="margin-top:16px"><div class="tscroll">'
      +'<table class="sum" style="min-width:1000px"><thead><tr>'
      +'<th class="l">Cost line</th><th>Total \u0e3f</th><th class="c">% of cost</th>'
      +'<th class="c">% of revenue</th><th>\u0e3f / pax</th><th class="c">vs prev '+N+'d</th>'
      +'<th class="l">Biggest driver</th><th class="c">Data quality</th></tr></thead><tbody>'
      +csRows
      +'<tr class="tot"><td class="l">\u03a3 '+GLx.length+' cost lines</td>'
      +'<td><span class="num n">'+pxN(T.cost)+'</span></td>'
      +'<td class="c"><span class="num n">100%</span></td>'
      +'<td class="c"><span class="num n">'+(T.rev?(T.cost/T.rev*100).toFixed(1):'0.0')+'%</span></td>'
      +'<td><span class="num cost n">'+pxN(T.cost/Math.max(1,T.pax))+'</span></td>'
      +'<td class="c">'+pxTrd(T.cost, PT.cost)+'</td>'
      +'<td class="l"><span class="mut">all routes</span></td>'
      +'<td class="c"><span class="pill '+(qPct>=60?'em':(qPct>=35?'am':'ro'))+'">'
      +qPct+'% receipted</span></td></tr></tbody></table></div></div>'
      +'<div class="dqx"><span class="t">Where each number comes from</span>'
      +'<span class="q"><i style="background:#10B981"></i>Actual \u2014 a receipt or logged expense</span>'
      +'<span class="q"><i style="background:#3B82F6"></i>Plan \u2014 the route\'s cost plan</span>'
      +'<span class="q"><i style="background:#CBD5E1"></i>Formula \u2014 system default, no plan linked</span>'
      +'<span class="q"><i style="background:#F59E0B"></i>Pending \u2014 expected but nothing entered yet</span>'
      +'</div>'
      +'<div class="hint"><b>Total cost is '+(T.rev?Math.round(T.cost/T.rev*100):0)+'% of revenue'
      +(pOK&&PT.rev?(', against '+Math.round(PT.cost/PT.rev*100)+'% in the previous '+N+' days'):'')+'.</b> '
      +(GL.length?('The top three lines \u2014 '+e(GL.slice(0,3).map(function(x){return x.g;}).join(', '))
        +' \u2014 are '+Math.round(GL.slice(0,3).reduce(function(s,x){return s+x.v;},0)/gTot*100)
        +'% of everything spent. '):'')
      +(movers.length?('Moving fastest: '+e(movers.map(function(x){ return x.g; }).join(' and '))
        +' \u2014 together '+pxN(movers.reduce(function(a,x){ return a+(x.v-x.pv); },0))
        +' \u0e3f more than the previous period. '):'')
      +'Only '+qPct+'% of spend is backed by a real receipt'
      +(GLx.length?(' \u00b7 the least trustworthy line is '
        +e(GLx.slice().sort(function(a,b){ return a.q.r-b.q.r; })[0].g)+' at '
        +Math.round(GLx.slice().sort(function(a,b){ return a.q.r-b.q.r; })[0].q.r*100)
        +'% receipted'):'')+'.</div></div>'

    /* §wkCard · จุดคุ้มทุนตามอัตราบรรทุก คู่กับแนวโน้มต่อหัวรายสัปดาห์ */
    +'<div class="g2 mb"><div class="eg"><div class="phd"><div><h2>Load factor vs margin</h2>'
      +'<p>What each occupancy band actually earns per head</p></div></div>'
      +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:360px">'
      +'<thead><tr><th class="l">Load factor</th><th class="c">Trips</th><th>Net / pax</th>'
      +'<th class="c">Result</th></tr></thead><tbody>'+bandRows
      +'<tr class="tot"><td class="l">All trips</td><td class="c"><span class="num n">'+T.trips+'</span></td>'
      +'<td class="netc"><span class="net n">'+pxN(T.profit/Math.max(1,T.pax))+'</span></td>'
      +'<td class="c"><span class="pill pu">'+(T.rev?Math.round(T.profit/T.rev*100):0)+'%</span></td></tr>'
      +'</tbody></table></div></div>'
      +'<div class="hint" style="margin-top:auto"><b>'+thin+' of '+T.trips+' trips ('
      +Math.round(thin/Math.max(1,T.trips)*100)+'%) sailed under 60% full.</b> '
      +'Consolidating even half of them into fuller boats is the single biggest lever on this page.</div></div>'
    +'<div class="eg"><div class="phd"><div><h2>Per-head trend</h2>'
      +'<p>Revenue, cost and net per pax by week \u00b7 bar height is revenue per head, '
      +'the amber part is what it cost</p></div>'
      +'<div>'+(pOK?('<span class="pill '+((T.cost/Math.max(1,T.pax))>(PT.cost/Math.max(1,PT.pax))?'am':'em')
      +'">cost/pax '+pxTrdTxt(T.cost/Math.max(1,T.pax), PT.cost/Math.max(1,PT.pax))+'</span>'):'')+'</div></div>'
      +(WK.length?('<div class="wkw">'+wkHtml+'</div>'
      +'<div class="cslg" style="margin-top:10px">'
      +'<span><i style="background:#F59E0B"></i>Cost / pax</span>'
      +'<span><i style="background:#059669"></i>Net / pax</span>'
      +'<span style="color:#94A3B8">week ending \u00b7 hover for the detail</span></div>'
      +'<div class="hint" style="margin-top:auto">'
      +(wWorst?('<b>The weakest week ended '+e(String(pxDW(wWorst.d1).txt))+' \u2014 '
        +(wWorst.nph<0?'\u2212':'+')+pxN(Math.abs(wWorst.nph))+' \u0e3f net per head.</b> '
        +'It ran '+wWorst.trips+' trips at '+pxN(wWorst.cph)+' \u0e3f cost per head against '
        +pxN(wWorst.rph)+' \u0e3f of revenue per head.'):'')+'</div>')
      :'<div class="empty">Not enough days to draw a weekly trend</div>')
      +'</div></div>'
    +mktCard
    +'<div class="eg"><div class="phd"><div><h2>Agent contribution</h2>'
      +'<p>Net per pax, split by route \u00b7 the same agent earns a different margin on every route, '
      +'so their headline number hides the ones that lose money</p></div>'
      +'<div><span class="pill pu clk" onclick="pxAgAll()" title="'
        +(_px.agAll?'ย่อกลับเหลือ 15 อันดับแรก':'ดูครบทุกเจ้า')+'">'
        +(_px.agAll?('ทั้งหมด '+AL.length+' agents'):('top '+Math.min(AGN_TOP,AL.length)+' of '+AL.length+' agents'))
        +'</span></div></div>'   /* §agAll */
      +'<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:'+mxWide+'px">'
      +'<thead><tr><th class="l stk" style="min-width:212px">Agent</th><th class="c">Pax</th>'
      +mxHead
      +'<th>Net / pax</th><th>Total net</th><th class="c">Status</th></tr></thead><tbody>'+agRows
      /* §agAll · เดิมเป็นบรรทัดเทาที่กดไม่ได้ · ทำให้กดได้ แล้วมีทางย่อกลับด้วย */
      +(AL.length>AGN_TOP
        ?('<tr class="agmore" onclick="pxAgAll()"><td class="l stk">\u2026 '
          +(AL.length-AGN_TOP)+' more</td><td colspan="'+(RCOL.length+4)+'">'
          +'<b>\u0e14\u0e39\u0e04\u0e23\u0e1a\u0e17\u0e38\u0e01\u0e40\u0e08\u0e49\u0e32</b> \u00b7 \u0e2d\u0e35\u0e01 '
          +(AL.length-AGN_TOP)+' \u0e40\u0e08\u0e49\u0e32 \u00b7 '+below.length
          +' \u0e40\u0e08\u0e49\u0e32\u0e02\u0e32\u0e14\u0e17\u0e38\u0e19\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14 <span class="cv">\u203a</span></td></tr>')
        :(_px.agAll && AL.length>15
          ?('<tr class="agmore" onclick="pxAgAll()"><td class="l stk">\u0e22\u0e48\u0e2d\u0e01\u0e25\u0e31\u0e1a</td>'
            +'<td colspan="'+(RCOL.length+4)+'">\u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e41\u0e04\u0e48 15 \u0e2d\u0e31\u0e19\u0e14\u0e31\u0e1a\u0e41\u0e23\u0e01 <span class="cv up">\u203a</span></td></tr>')
          :''))
      +'<tr class="tot"><td class="l stk">\u03a3 '+AL.length+' agents</td>'
      +'<td class="c"><span class="num n">'+T.pax+'</span></td>'
      +mxFoot
      +'<td class="netc"><span class="net n">'+pxN(T.profit/Math.max(1,T.pax))+'</span></td>'
      +'<td class="netc"><span class="net n">'+(T.profit<0?'\u2212':'+')+pxN(Math.abs(T.profit))+'</span></td>'
      +'<td class="c"><span class="pill pu">'+(T.rev?Math.round(T.profit/T.rev*100):0)+'%</span></td>'
      +'</tr></tbody></table></div></div>'
      +'<div class="mxlg"><span class="t">Net per pax</span>'
      +'<div class="ramp"><span>\u2212'+pxN(3*mxStep)+' or worse</span>'
      +'<i style="background:#FDA4AF"></i><i style="background:#FECDD3"></i><i style="background:#FFE4E6"></i>'
      +'<i style="background:#F1F5F9"></i>'
      +'<i style="background:#ECFDF5"></i><i style="background:#D1FAE5"></i><i style="background:#A7F3D0"></i>'
      +'<span>+'+pxN(3*mxStep)+' or better</span></div>'
      +'<span class="q"><i style="background:#F8FAFC;border:1px solid #E2E8F0"></i>'
      +'\u2014 = never sent on this route</span>'
      +'<span class="q">top number = \u0e3f per head \u00b7 bottom = pax \u00b7 hover for the full split</span>'
      +'</div>'
      +(mxBad.length?('<div class="hint"><b>'+mxBad.length+' route'+(mxBad.length===1?' loses':'s lose')
        +' money across the whole company.</b> '
        +e(mxBad.map(function(r){ return r.name; }).slice(0,3).join(', '))
        +' \u2014 every agent carrying them is being subsidised by the rest of the table. ')
        :'<div class="hint"><b>No route is loss-making company-wide.</b> ')
      +(below.length?(below.length+' agent'+(below.length===1?' is':'s are')
        +' priced below what it costs to carry them, led by '
        +e(below.slice(0,3).map(function(g){ return g.name; }).join(', '))
        +' \u00b7 combined drag '+pxN(belowDrag)+' \u0e3f against a cost per head of '
        +pxN(T.cost/Math.max(1,T.pax))+' \u0e3f.')
        :'No agent is priced below cost overall.')
      +'</div>'
      +'</div>';
}
function pxTrdTxt(cur, prev){
  if(!prev) return '\u2014';
  var p=(cur-prev)/Math.abs(prev)*100;
  if(Math.abs(p)<1) return 'flat';
  return (p>0?'\u25b2 ':'\u25bc ')+Math.abs(p).toFixed(1)+'%';
}

function b2cIconSVG(icon){
  const map = {
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>',
    store: '<path d="M3 9l1-5h16l1 5M3 9v11h18V9M3 9h18M9 22V14h6v8"/>',
    chat:  '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
    fb:    '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
    ig:    '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01"/>',
    tag:   '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${map[icon]||map.globe}</svg>`;
}

function b2cCard(c){
  const isCampaign = c.type==='campaign';
  const bookings = SB_BOOKINGS.filter(b=>b.channel===c.id);
  const rev = bookings.reduce((s,b)=>s+(b.total||0),0);
  return `
    <div class="b2c-card ${isCampaign?'campaign':''}" onclick="b2cOpen('${c.id}')">
      <div class="b2c-card-hd">
        <div class="b2c-card-icon">${b2cIconSVG(c.icon||'globe')}</div>
        <div style="flex:1;min-width:0">
          <div class="b2c-card-name">${c.name}</div>
          <div class="b2c-card-type">${isCampaign?'Campaign':'Channel'}${isCampaign?` · -${Math.round((c.discount||0)*100)}%`:c.priceMul!==1?` · ×${c.priceMul}`:''}</div>
        </div>
      </div>
      ${c.note?`<div class="b2c-card-note">${c.note}</div>`:''}
      <div class="b2c-card-stats">
        <div class="b2c-card-stat"><div class="b2c-card-stat-lbl">Bookings</div><div class="b2c-card-stat-val">${bookings.length}</div></div>
        <div class="b2c-card-stat"><div class="b2c-card-stat-lbl">Revenue</div><div class="b2c-card-stat-val">${sbFmtTHB(rev/1000)}K</div></div>
      </div>
      ${isCampaign && c.validFrom?`<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);font-size:9px;font-family:'DM Mono',monospace;color:var(--ink-soft);letter-spacing:.04em">VALID · ${c.validFrom} → ${c.validTo}</div>`:''}
    </div>
  `;
}

function b2cOpen(cId){
  const c = sbGetB2C(cId); if(!c) return;
  alert(`${c.name}\n\nเปิดหน้าจัดการ — เฟสถัดไปจะมีหน้า edit/detail`);
}
function b2cAddChannel(){ alert('เพิ่ม Channel ใหม่ — เฟสถัดไป'); }
function b2cAddCampaign(){ alert('เพิ่ม Campaign — เฟสถัดไป'); }

function b2dEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function b2dIso(s){ if(!s) return null; s=String(s).slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null; }   // §10 non-ISO → null
function b2dShiftDay(iso,n){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function b2dThD(iso){ return iso ? (+iso.slice(8,10))+' '+B2D_MON[+iso.slice(5,7)-1]+' '+(+iso.slice(0,4))%100 : '—'; }
function b2dB(n){ return '฿'+Math.round(n||0).toLocaleString('en-US'); }
function b2dK(n){ n=Math.round(n||0); const a=Math.abs(n); if(a>=1e6) return (n<0?'−':'')+'฿'+(a/1e6).toFixed(2)+'M'; if(a>=1e4) return (n<0?'−':'')+'฿'+Math.round(a/1e3)+'K'; return (n<0?'−':'')+'฿'+a.toLocaleString('en-US'); }   // mockup fmtC parity: K from 10k up
function b2dPctS(g){ return g==null ? '—' : (g>=0?'+':'−')+Math.abs(g).toFixed(0)+'%'; }   // mockup dstr parity: whole-% display
function b2dDeltaHtml(g,cls){   // InvestIQ pill style + mockup dcell parity (new/churned show the word)
  const pill=(txt,st)=>'<span style="'+st+'display:inline-flex;align-items:center;gap:2px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap">'+txt+'</span>';
  if(cls==='new') return pill('new',B2D_UI.pillG);
  if(cls==='churn') return pill('churned',B2D_UI.pillR);
  if(g==null) return '<span style="color:#CBD5E1">—</span>';
  if(g>0) return pill('↗ '+b2dPctS(g),B2D_UI.pillG);
  if(g<0) return pill('↘ '+b2dPctS(g),B2D_UI.pillR);
  return pill(b2dPctS(g),B2D_UI.pillN); }
// smooth Catmull-Rom → cubic-bezier path (InvestIQ curves are smooth, not angular)
function b2dSmoothPath(pts){
  if(pts.length<3) return pts.map((p,i)=>(i?'L ':'M ')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  let d='M '+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    d+=' C '+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+' '+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)
      +' '+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+' '+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)
      +' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);
  }
  return d;
}
// sparkline (InvestIQ market-summary card style): smooth line + gradient fill + end dot
function b2dSparkHtml(vals,pos,gid){
  if(!vals||vals.length<2) return '<div style="height:52px"></div>';
  const W=200,H=44,mx=Math.max.apply(null,vals),mn=Math.min.apply(null,vals),sp=(mx-mn)||1;
  const pts=vals.map((v,i)=>[i/(vals.length-1)*W, 5+(H-12)*(1-(v-mn)/sp)]);
  const line=b2dSmoothPath(pts);
  const col=pos?B2D_UI.green:B2D_UI.red, e=pts[pts.length-1];
  return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:52px;overflow:visible;display:block">'
    +'<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+col+'" stop-opacity=".22"/><stop offset="100%" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
    +'<path d="'+line+' L '+W+' '+H+' L 0 '+H+' Z" fill="url(#'+gid+')"/>'
    +'<path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round"/>'
    +'<circle cx="'+e[0].toFixed(1)+'" cy="'+e[1].toFixed(1)+'" r="3.2" fill="'+col+'"/>'
    +'<circle cx="'+e[0].toFixed(1)+'" cy="'+e[1].toFixed(1)+'" r="6.5" fill="'+col+'" fill-opacity=".3"/></svg>'; }
function b2dPeriodLabel(){ const m=_b2d.mode; return m==='wow'?'Last 7 days':m==='mom'?'Last 30 days':m==='wly'?'Week vs LY':m==='mly'?'Calendar month':'Last 12 months'; }
// monthly metric series for KPI sparklines (active basis · full history)
function b2dMonthlySeries(L){
  const k=_b2d.basis, m={};
  L.forEach(l=>{ const d=l[k]; if(!d) return; const ym=d.slice(0,7);
    const r=m[ym]=m[ym]||{rev:0,pax:0,ags:{}}; r.rev+=l.rev; r.pax+=l.pax; if(l.rev>0) r.ags[l.agid]=1; });
  return Object.keys(m).sort().map(ym=>({ym:ym,rev:m[ym].rev,pax:m[ym].pax,agents:Object.keys(m[ym].ags).length}));
}

// ── §3/§4 trip-lines ──
function b2dLines(){
  const agM={}, slM={}, mkM={};
  (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).forEach(a=>agM[a.id]=a);
  (typeof SB_SALES!=='undefined'?SB_SALES:[]).forEach(s=>slM[s.id]=s);
  (typeof SB_MARKETS!=='undefined'?SB_MARKETS:[]).forEach(m=>mkM[m.id]=m);
  const out=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{
    if(b.status!=='confirmed') return;                                          // §4.1 confirmed only
    if(b.channelType==='b2c' || b.b2cChannel || b.agentId==='a_b2c') return;    // B2B channel only — B2C-synced bookings excluded
    const bd=b2dIso(b.bookingDate)||b2dIso(b.bookedAt)||b2dIso(b.createdAt);    // §10 fallback chain
    const ag=agM[b.agentId];
    const sl=(ag&&ag.sales)?slM[ag.sales]:null;                                 // §2.2 agent.sales = sb_sales.id
    const own=(ag&&ag.sales)?((sl&&(sl.name||sl.code))||'House'):'House';
    const ownId=(ag&&ag.sales)?ag.sales:'__house';
    const mkCode=(b.marketSnapshot&&b.marketSnapshot.market)||(ag&&ag.market)||'';
    const mk=mkCode?mkM[mkCode]:null;
    const total=Number(b.priceBreakdown&&b.priceBreakdown.total!=null?b.priceBreakdown.total:b.total)||0;   // §4.4
    const trips=(Array.isArray(b.trips)&&b.trips.length)?b.trips:[{}];
    const paxOf=t=>{const p=(t&&t.pax)||{};return (Number(p.ad_th)||0)+(Number(p.ad_fr)||0)+(Number(p.chd_th)||0)+(Number(p.chd_fr)||0);};   // §4.5
    const paxT=trips.reduce((s,t)=>s+paxOf(t),0);
    trips.forEach(t=>{
      const p=paxOf(t);
      const rev=trips.length===1?total:(paxT>0?total*p/paxT:total/trips.length);   // §4.4 pax-share allocation (reconciles: Σrev===Σtotals)
      out.push({ bd:bd, td:b2dIso(t&&t.date), fam:B2D_FAM[t&&t.routeId]||'Other',
        ag:(ag&&ag.name)||b.agentId||'?', agid:b.agentId||'?', code:(ag&&ag.code)||'',
        own:own, ownId:ownId, mkt:mkCode?((mk&&mk.name)||mkCode):'Unspecified', mktCode:mkCode||'__none',
        rev:rev, pax:p, bkid:b.id });
    });
  });
  return out;
}

// ── §4.3 period windows ──
function b2dLatestDate(L){ const k=_b2d.basis; let mx=null; L.forEach(l=>{ const d=l[k]; if(d&&(!mx||d>mx)) mx=d; }); return mx||new Date().toISOString().slice(0,10); }
function b2dWin(L){
  const ref=b2dIso(_b2d.ref)||b2dLatestDate(L), m=_b2d.mode;
  let w;
  if(m==='wow')      w={cs:b2dShiftDay(ref,-6),ce:ref,ps:b2dShiftDay(ref,-13),pe:b2dShiftDay(ref,-7)};
  else if(m==='mom') w={cs:b2dShiftDay(ref,-29),ce:ref,ps:b2dShiftDay(ref,-59),pe:b2dShiftDay(ref,-30)};
  else if(m==='wly'){ const cs=b2dShiftDay(ref,-6); w={cs:cs,ce:ref,ps:b2dShiftDay(cs,-364),pe:b2dShiftDay(ref,-364)}; }
  else if(m==='mly'){ const y=+ref.slice(0,4), mo=ref.slice(5,7);
    const eom=(yy,mm)=>String(new Date(yy,+mm,0).getDate()).padStart(2,'0');
    w={cs:y+'-'+mo+'-01',ce:y+'-'+mo+'-'+eom(y,mo),ps:(y-1)+'-'+mo+'-01',pe:(y-1)+'-'+mo+'-'+eom(y-1,mo)}; }
  else               w={cs:b2dShiftDay(ref,-364),ce:ref,ps:b2dShiftDay(ref,-729),pe:b2dShiftDay(ref,-365)};   // rolling 12M
  w.ref=ref; return w;
}

// ── §4.6 classification (shared for agent grain AND agent×route grain) ──
function b2dCls(c,p,T){
  if(p<=0&&c>0) return {cls:'new',g:null};
  if(c<=0&&p>0) return {cls:'churn',g:null};
  if(p<=0&&c<=0) return {cls:'stable',g:null};
  const g=(c-p)/p*100;
  return {cls:(g>T?'growth':(g<-T?'loss':'stable')), g:g};
}

function b2dSum(L,from,to,filter){
  const k=_b2d.basis, bks={}; let rev=0,pax=0;
  L.forEach(l=>{ const d=l[k]; if(!d||d<from||d>to) return; if(filter&&!filter(l)) return; rev+=l.rev; pax+=l.pax; bks[l.bkid]=1; });
  return {rev:rev,pax:pax,bookings:Object.keys(bks).length};
}
// per-agent current/prev aggregation + class · filter narrows the grain (e.g. one route → §6.4)
function b2dAgents(L,w,filter){
  const k=_b2d.basis, m={};
  L.forEach(l=>{ if(filter&&!filter(l)) return; const d=l[k]; if(!d) return;
    const inC=d>=w.cs&&d<=w.ce, inP=d>=w.ps&&d<=w.pe; if(!inC&&!inP) return;
    let r=m[l.agid]; if(!r) r=m[l.agid]={agid:l.agid,ag:l.ag,code:l.code,own:l.own,ownId:l.ownId,mkt:l.mkt,mktCode:l.mktCode,cur:0,prev:0,curPax:0,bks:{}};
    if(inC){ r.cur+=l.rev; r.curPax+=l.pax; r.bks[l.bkid]=1; } else { r.prev+=l.rev; }
  });
  return Object.keys(m).map(id=>{ const r=m[id]; const c=b2dCls(r.cur,r.prev,_b2d.T);
    r.cls=c.cls; r.g=c.g; r.bookings=Object.keys(r.bks).length; delete r.bks; return r; });
}

// ── navigation (§5.4) — history stack shared by tabs + detail pages ──
function b2dGo(scr){ _b2d.stack.push(_b2d.screen?JSON.parse(JSON.stringify(_b2d.screen)):null); _b2d.screen=scr; renderB2BDash(); const v=document.getElementById('view-b2b-dash'); if(v) v.scrollTop=0; }
function b2dBack(){ _b2d.screen=_b2d.stack.length?_b2d.stack.pop():null; renderB2BDash(); }
function b2dTab(t){ _b2d.tab=t; _b2d.stack=[]; _b2d.screen=null; renderB2BDash(); }
function b2dSet(k,v){ if(k==='T') v=Math.max(1,Math.min(50,Number(v)||10)); _b2d[k]=v; renderB2BDash(); }
function b2dSelTrip(f){ _b2d.trip=f; renderB2BDash(); }
function b2dOpenAgentExt(id,code){   // §7 external sales-system link (placeholder until URL provided)
  if(!SALES_SYS_URL){ alert('Sales-system URL not configured (SALES_SYS_URL)'); return; }
  window.open(SALES_SYS_URL.replace('{id}',encodeURIComponent(id)).replace('{code}',encodeURIComponent(code||id)),'_blank');
}
function b2dAgLink(a){ return '<a onclick="b2dGo({t:\'agent\',id:\''+b2dEsc(a.agid)+'\'})" style="color:#059669;font-weight:600;cursor:pointer">'+b2dEsc(a.ag||a.name)+'</a>'; }
function b2dOwnLink(ownId,own){ return '<a onclick="b2dGo({t:\'staff\',id:\''+b2dEsc(ownId)+'\'})" style="color:#7C3AED;font-weight:500;cursor:pointer">'+b2dEsc(own)+'</a>'; }
function b2dMktLink(code,name){ return '<a onclick="b2dGo({t:\'market\',id:\''+b2dEsc(code)+'\'})" style="color:#2563EB;font-weight:500;cursor:pointer">'+b2dEsc(name)+'</a>'; }
function b2dClsChip(cls){ const c=B2D_CLS[cls]||B2D_CLS.stable; return '<span style="background:'+c.bg+';color:'+c.c+';padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700">'+c.t+'</span>'; }

// ── §8 CSV export (UTF-8 BOM · current screen's table) ──
function b2dExport(){
  const rows=window._b2dCsvRows||[];
  if(!rows.length){ alert('No table to export on this page'); return; }
  const csv='\uFEFF'+rows.map(r=>r.map(c=>{ c=String(c==null?'':c); return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c; }).join(',')).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='LA_'+(window._b2dCsvName||'dashboard')+'_'+((window._b2dW&&window._b2dW.ref)||'')+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

// ── §6.3 G/S/L segmented bar ──
function b2dGsl(agents){
  const g=agents.filter(a=>a.cls==='growth'||a.cls==='new').length,
        s=agents.filter(a=>a.cls==='stable').length,
        l=agents.filter(a=>a.cls==='loss'||a.cls==='churn').length, tot=(g+s+l)||1;
  return '<div style="min-width:120px"><div style="display:flex;height:9px;border-radius:5px;overflow:hidden;background:#F1F5F9">'
    +(g?'<div style="width:'+(g/tot*100)+'%;background:#10B981"></div>':'')
    +(s?'<div style="width:'+(s/tot*100)+'%;background:#CBD5E1"></div>':'')
    +(l?'<div style="width:'+(l/tot*100)+'%;background:#F43F5E"></div>':'')
    +'</div><div style="font-size:9.5px;color:#777;margin-top:2px;white-space:nowrap">'+g+' grow · '+s+' stable · '+l+' decline</div></div>';
}

// ── §6.1 revenue bridge (waterfall · floating bars) ──
function b2dBridge(agents){
  let prevT=0,curT=0,growth=0,nw=0,stab=0,loss=0,churn=0;
  agents.forEach(a=>{ prevT+=a.prev; curT+=a.cur;
    if(a.cls==='growth') growth+=a.cur-a.prev;
    else if(a.cls==='new') nw+=a.cur;
    else if(a.cls==='stable') stab+=a.cur-a.prev;
    else if(a.cls==='loss') loss+=a.prev-a.cur;
    else if(a.cls==='churn') churn+=a.prev; });
  return {prevT:prevT,curT:curT,growth:growth,nw:nw,stab:stab,loss:loss,churn:churn};   // identity: prevT+growth+nw+stab-loss-churn === curT
}
function b2dWaterfallHtml(br){
  // InvestIQ portfolio-chart look: slim rounded pill bars, dashed gridlines, green/navy duotone
  const steps=[
    {k:'Prev',v:br.prevT,abs:1,c:'#CBD5E1'}, {k:'+Growth',v:br.growth,c:'#00D084'}, {k:'+New',v:br.nw,c:'#34D399'},
    {k:'±Stable',v:br.stab,c:'#94A3B8'}, {k:'−Loss',v:-br.loss,c:'#1E293B'}, {k:'−Churn',v:-br.churn,c:'#0F172A'},
    {k:'Now',v:br.curT,abs:1,c:'#64748B'}];
  let cum=0;
  const boxes=steps.map(s=>{ let lo,hi;
    if(s.abs){ lo=Math.min(0,s.v); hi=Math.max(0,s.v); cum=s.v; }
    else { lo=Math.min(cum,cum+s.v); hi=Math.max(cum,cum+s.v); cum+=s.v; }
    return {k:s.k,v:s.v,c:s.c,lo:lo,hi:hi}; });
  const hi=Math.max.apply(null,boxes.map(b=>b.hi).concat([1])), lo=Math.min.apply(null,boxes.map(b=>b.lo).concat([0]));
  const H=190, span=(hi-lo)||1;
  const grid='<div style="position:absolute;left:0;right:0;top:0;height:'+H+'px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none">'
    +'<div style="border-top:1px dashed #E2E8F0"></div><div style="border-top:1px dashed #E2E8F0"></div><div style="border-top:1px dashed #E2E8F0"></div><div style="border-top:1px solid #E2E8F0"></div></div>';
  return '<div style="position:relative;padding:8px 2px 0">'+grid
    +'<div style="position:relative;display:flex;align-items:flex-end;gap:10px">'+boxes.map(b=>
    '<div style="flex:1;min-width:0;text-align:center;font-size:10px">'
    +'<div style="height:'+H+'px;position:relative"><div style="position:absolute;left:50%;transform:translateX(-50%);width:16px;top:'+((hi-b.hi)/span*H).toFixed(1)+'px;height:'+Math.max(8,(b.hi-b.lo)/span*H).toFixed(1)+'px;background:'+b.c+';border-radius:99px" title="'+b2dB(b.v)+'"></div></div>'
    +'<div style="margin-top:9px;color:#94A3B8;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+b.k+'</div>'
    +'<div style="font-weight:800;color:'+B2D_UI.ink+';font-variant-numeric:tabular-nums;font-size:11px;margin-top:1px">'+b2dK(b.v)+'</div></div>').join('')+'</div></div>';
}

// ── §6.2 monthly stacked trend (all history · active basis) ──
function b2dMonthlyHtml(L,keyFn,colorFn){
  const k=_b2d.basis, months={}, seriesTot={};
  L.forEach(l=>{ const d=l[k]; if(!d) return; const s=keyFn(l); if(s==null) return;
    const ym=d.slice(0,7); (months[ym]=months[ym]||{})[s]=(months[ym][s]||0)+l.rev; seriesTot[s]=(seriesTot[s]||0)+l.rev; });
  const ymL=Object.keys(months).sort(), sL=Object.keys(seriesTot).sort((a,b)=>seriesTot[b]-seriesTot[a]);
  if(!ymL.length) return '<div style="color:#999;font-size:12px;padding:20px;text-align:center">No data</div>';
  const colOf={}; sL.forEach((s,i)=>colOf[s]=colorFn?(colorFn(s)||B2D_PALETTE[i%B2D_PALETTE.length]):B2D_PALETTE[i%B2D_PALETTE.length]);
  const max=Math.max.apply(null,ymL.map(ym=>sL.reduce((t,s)=>t+(months[ym][s]||0),0)).concat([1]));
  const H=150;
  const grid='<div style="position:absolute;left:0;right:0;top:6px;height:'+H+'px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none">'
    +'<div style="border-top:1px dashed #E2E8F0"></div><div style="border-top:1px dashed #E2E8F0"></div><div style="border-top:1px dashed #E2E8F0"></div><div style="border-top:1px solid #E2E8F0"></div></div>';
  return '<div style="position:relative">'+grid
    +'<div style="position:relative;display:flex;align-items:flex-end;gap:6px;overflow-x:auto;padding-top:6px">'+ymL.map(ym=>{
      const tot=sL.reduce((t,s)=>t+(months[ym][s]||0),0);
      // pill-shaped stacked column (InvestIQ portfolio bars): rounded wrapper clips the segments
      return '<div style="flex:1;min-width:36px;text-align:center;font-size:9.5px">'
        +'<div style="height:'+H+'px;display:flex;flex-direction:column-reverse;align-items:center">'
        +'<div style="width:13px;border-radius:99px;overflow:hidden;display:flex;flex-direction:column-reverse">'+sL.map(s=>{
          const v=months[ym][s]||0; return v>0?'<div style="height:'+Math.max(3,v/max*H).toFixed(1)+'px;background:'+colOf[s]+'" title="'+b2dEsc(s)+' · '+b2dK(v)+'"></div>':''; }).join('')
        +'</div></div><div style="margin-top:6px;color:#94A3B8;font-weight:700;white-space:nowrap">'+B2D_MON[+ym.slice(5,7)-1]+' '+ym.slice(2,4)+'</div>'
        +'<div style="font-size:9px;color:'+B2D_UI.mut+';font-variant-numeric:tabular-nums">'+b2dK(tot)+'</div></div>';
    }).join('')+'</div></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:10.5px;color:'+B2D_UI.ink2+'">'+sL.slice(0,12).map(s=>
      '<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:'+colOf[s]+'"></span>'+b2dEsc(s)+'</span>').join('')+(sL.length>12?'<span style="color:#999">+'+(sL.length-12)+'</span>':'')+'</div>';
}

// ── §6.4 route-shift signal ──
function b2dShiftSignal(routeCls,overallG){
  const T=_b2d.T;
  if(routeCls==='loss'||routeCls==='churn'){
    if(overallG!==null&&overallG>-T) return {t:'↘ Down here · moved to other routes',c:'#B45309',bg:'#FEF3C7'};
    return {t:'↘ Whole portfolio down',c:'#E11D48',bg:'#FFF1F2'};
  }
  if(routeCls==='growth'&&overallG!==null&&overallG<=T) return {t:'↗ Pulling into this route',c:'#2563EB',bg:'#EFF6FF'};
  return null;
}
function b2dSignalChip(sig){ return sig?'<span style="background:'+sig.bg+';color:'+sig.c+';padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;white-space:nowrap">'+sig.t+'</span>':''; }

// ── shared table shell ──
function b2dTable(headers,rowsHtml){
  return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;color:'+B2D_UI.ink2+'">'
    +'<thead><tr>'+headers.map(h=>'<th style="text-align:'+(h.r?'right':'left')+';padding:8px;font-size:10px;font-weight:700;color:'+B2D_UI.mut+';text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid '+B2D_UI.line+';white-space:nowrap">'+h.t+'</th>').join('')+'</tr></thead>'
    +'<tbody>'+rowsHtml+'</tbody></table></div>';
}
function b2dTd(v,r){ return '<td style="padding:8px;border-bottom:1px solid '+B2D_UI.line2+';'+(r?'text-align:right;font-variant-numeric:tabular-nums;':'')+'white-space:nowrap">'+v+'</td>'; }
function b2dCard(title,inner,extra){ return '<div style="'+B2D_UI.card+'padding:20px 22px;margin-bottom:16px">'+(title?'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><span style="font-weight:700;font-size:14px;color:'+B2D_UI.ink+'">'+title+'</span>'+(extra||'')+'</div>':'')+inner+'</div>'; }

// ═══════════ TABS SCREEN ═══════════
function b2dTabsScreen(L,w,agAll,cur,prev){
  const st=_b2d;
  // KPI row (§5.2)
  const activeCur=agAll.filter(a=>a.cur>0).length, activePrev=agAll.filter(a=>a.prev>0).length;
  const dRev=prev.rev>0?(cur.rev-prev.rev)/prev.rev*100:null;
  const dPax=prev.pax>0?(cur.pax-prev.pax)/prev.pax*100:null;
  const avgC=activeCur?cur.rev/activeCur:0, avgP=activePrev?prev.rev/activePrev:0;
  const dAvg=avgP>0?(avgC-avgP)/avgP*100:null;
  // InvestIQ market-summary cards: icon circle + title, sparkline, big value + arrow pill, vs-last-period
  const ms=b2dMonthlySeries(L);
  const kpi=(id,letter,letterBg,label,val,deltaHtml,vsTxt,series,pos)=>'<div style="'+B2D_UI.card+'flex:1;min-width:200px;padding:18px 20px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">'
    +'<div style="display:flex;align-items:center;gap:8px"><div style="width:26px;height:26px;border-radius:50%;background:'+letterBg+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">'+letter+'</div>'
    +'<span style="font-size:13.5px;font-weight:700;color:'+B2D_UI.ink+'">'+label+'</span></div>'
    +'<span style="font-size:10.5px;font-weight:600;color:'+B2D_UI.mut+';white-space:nowrap">'+b2dPeriodLabel()+'</span></div>'
    +b2dSparkHtml(series,pos,'b2dspark_'+id)
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:10px">'
    +'<span style="font-size:24px;font-weight:800;letter-spacing:-.03em;color:'+B2D_UI.ink+';font-variant-numeric:tabular-nums">'+val+'</span>'+deltaHtml+'</div>'
    +'<div style="font-size:11px;font-weight:500;color:'+B2D_UI.mut+';margin-top:3px">'+vsTxt+'</div></div>';
  const dAg=activeCur-activePrev;
  const agPill='<span style="'+(dAg>=0?B2D_UI.pillG:B2D_UI.pillR)+'display:inline-flex;align-items:center;gap:2px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap">'+(dAg>=0?'↗ +':'↘ −')+Math.abs(dAg)+'</span>';
  const kpis='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:16px">'
    +kpi('rev','R','#00D084','B2B revenue',b2dK(cur.rev),b2dDeltaHtml(dRev),'vs '+b2dK(prev.rev)+' last period',ms.map(x=>x.rev),(dRev==null||dRev>=0))
    +kpi('ag','A','#3B82F6','Active agents',activeCur,agPill,'vs '+activePrev+' last period',ms.map(x=>x.agents),dAg>=0)
    +kpi('pax','P','#F59E0B','Pax',cur.pax.toLocaleString(),b2dDeltaHtml(dPax),'vs '+prev.pax.toLocaleString()+' last period',ms.map(x=>x.pax),(dPax==null||dPax>=0))
    +kpi('avg','฿','#8B5CF6','Avg / agent',b2dK(avgC),b2dDeltaHtml(dAvg),'vs '+b2dK(avgP)+' last period',ms.map(x=>x.agents?x.rev/x.agents:0),(dAvg==null||dAvg>=0))+'</div>';

  const nG=agAll.filter(a=>a.cls==='growth'||a.cls==='new').length,
        nS=agAll.filter(a=>a.cls==='stable').length,
        nL=agAll.filter(a=>a.cls==='loss'||a.cls==='churn').length;
  const tabs=[['overview','Overview'],['staff','By staff'],['trip','By trip'],['market','By market'],['growth','Growth ('+nG+')'],['loss','Loss ('+nL+')'],['stable','Stable ('+nS+')']];
  const tabBar='<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px">'+tabs.map(t=>
    '<button onclick="b2dTab(\''+t[0]+'\')" style="padding:8px 17px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;'+(st.tab===t[0]?'background:'+B2D_UI.accent+';color:#fff;border:1px solid '+B2D_UI.accent+';box-shadow:0 3px 10px rgba(0,208,132,.28)':'background:#fff;color:#64748B;border:1px solid #E2E8F0')+'">'+t[1]+'</button>').join('')+'</div>';

  let inner='';
  if(st.tab==='overview') inner=b2dTabOverview(agAll);
  else if(st.tab==='staff') inner=b2dTabStaff(L,w,agAll);
  else if(st.tab==='trip') inner=b2dTabTrip(L,w,agAll);
  else if(st.tab==='market') inner=b2dTabMarket(agAll,cur);
  else inner=b2dTabClass(agAll,st.tab);
  return kpis+tabBar+inner;
}

// ── Overview: bridge + watchlist ──
function b2dTabOverview(agAll){
  const br=b2dBridge(agAll);
  const gained=br.growth+br.nw, lost=br.loss+br.churn, net=br.curT-br.prevT;   // mockup parity: stable delta excluded from gained/lost
  const chip=(t,v,c)=>'<span style="font-size:11.5px;color:#666">'+t+' <b style="color:'+c+';font-variant-numeric:tabular-nums">'+b2dK(v)+'</b></span>';
  const summary='<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">'+chip('Gained',gained,'#059669')+chip('Lost',-lost,'#E11D48')+chip('Net',net,net>=0?'#059669':'#E11D48')+'</div>';
  const watch=agAll.filter(a=>a.cls==='loss'||a.cls==='churn').map(a=>({...a,lostAmt:a.prev-a.cur})).sort((a,b)=>b.lostAmt-a.lostAmt).slice(0,10);
  window._b2dCsvName='overview_watchlist';
  window._b2dCsvRows=[['agent','code','owner','market','prev','current','lost','class']].concat(watch.map(a=>[a.ag,a.code,a.own,a.mkt,Math.round(a.prev),Math.round(a.cur),Math.round(a.lostAmt),a.cls]));
  const rows=watch.map(a=>'<tr>'+b2dTd(b2dAgLink(a))+b2dTd(b2dOwnLink(a.ownId,a.own))+b2dTd(b2dMktLink(a.mktCode,a.mkt))
    +b2dTd(b2dB(a.prev),1)+b2dTd(b2dB(a.cur),1)+b2dTd('<span style="color:#E11D48;font-weight:700">−'+b2dB(a.lostAmt).slice(1)+'</span>',1)+b2dTd(b2dDeltaHtml(a.g,a.cls),1)+b2dTd(b2dClsChip(a.cls))+'</tr>').join('');
  return b2dCard('Revenue bridge — who drove the change',b2dWaterfallHtml(br)+summary)
    +b2dCard('Watchlist — top 10 agents by revenue lost',watch.length?b2dTable([{t:'Agent'},{t:'Sales'},{t:'Market'},{t:'Prev',r:1},{t:'Current',r:1},{t:'Lost',r:1},{t:'Δ',r:1},{t:'Class'}],rows):'<div style="color:#999;font-size:12px">No agents losing revenue in this period 🎉</div>');
}

// ── By staff ──
function b2dTabStaff(L,w,agAll){
  const slCol={}; (typeof SB_SALES!=='undefined'?SB_SALES:[]).forEach(s=>{ if(s.name&&s.color) slCol[s.name]=s.color; });
  const chart=b2dMonthlyHtml(L,l=>l.own,s=>slCol[s]);
  const m={};
  agAll.forEach(a=>{ let r=m[a.ownId]; if(!r) r=m[a.ownId]={ownId:a.ownId,own:a.own,cur:0,prev:0,agents:[],active:0};
    r.cur+=a.cur; r.prev+=a.prev; r.agents.push(a); if(a.cur>0) r.active++; });
  const allTime={}; L.forEach(l=>allTime[l.ownId]=(allTime[l.ownId]||0)+l.rev);   // mockup ownerOrder parity: rank by all-time revenue
  const list=Object.keys(m).map(k=>m[k]).sort((a,b)=>(allTime[b.ownId]||0)-(allTime[a.ownId]||0));
  window._b2dCsvName='by_staff';
  window._b2dCsvRows=[['sales','active_agents','revenue','prev','delta_pct']].concat(list.map(o=>[o.own,o.active,Math.round(o.cur),Math.round(o.prev),o.prev>0?((o.cur-o.prev)/o.prev*100).toFixed(1):'']));
  const rows=list.map(o=>{ const g=o.prev>0?(o.cur-o.prev)/o.prev*100:null;
    return '<tr>'+b2dTd(b2dOwnLink(o.ownId,o.own))+b2dTd(o.active,1)+b2dTd(b2dB(o.cur),1)+b2dTd(b2dDeltaHtml(g),1)+b2dTd(b2dGsl(o.agents))+'</tr>'; }).join('');
  return b2dCard('Monthly revenue by sales owner (stacked)',chart)
    +b2dCard('Summary by sales owner',b2dTable([{t:'Sales'},{t:'Active agents',r:1},{t:'Revenue',r:1},{t:'Δ',r:1},{t:'G/S/L'}],rows));
}

// ── By trip (§6.4 route-shift) ──
function b2dTabTrip(L,w,agAll){
  const st=_b2d;
  const famRev={}; B2D_FAM_ORDER.forEach(f=>famRev[f]=b2dSum(L,w.cs,w.ce,l=>l.fam===f));
  const fams=B2D_FAM_ORDER.filter(f=>{ const has=L.some(l=>l.fam===f); return has; });
  if(!fams.length) return b2dCard('By trip','<div style="color:#999;font-size:12px">No trip data</div>');
  const sel=(st.trip&&fams.indexOf(st.trip)>=0)?st.trip:fams.slice().sort((a,b)=>famRev[b].rev-famRev[a].rev)[0];
  const chips='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+fams.map(f=>
    '<button onclick="b2dSelTrip(\''+b2dEsc(f)+'\')" style="padding:8px 17px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;'+(f===sel?'background:'+B2D_UI.accent+';color:#fff;border:1px solid '+B2D_UI.accent+';box-shadow:0 3px 10px rgba(0,208,132,.28)':'background:#fff;color:#475569;border:1px solid #E2E8F0')+'">'+b2dEsc(f)+'<span style="opacity:.8;font-weight:500;margin-left:6px;font-size:10.5px">'+b2dK(famRev[f].rev)+'</span></button>').join('')+'</div>';
  const curF=famRev[sel], prevF=b2dSum(L,w.ps,w.pe,l=>l.fam===sel);
  const gF=prevF.rev>0?(curF.rev-prevF.rev)/prevF.rev*100:null;
  const routeAg=b2dAgents(L,w,l=>l.fam===sel).sort((a,b)=>b.cur-a.cur);
  const overall={}; agAll.forEach(a=>overall[a.agid]=a);
  window._b2dCsvName='trip_'+sel.replace(/\s+/g,'');
  window._b2dCsvRows=[['agent','code','owner','route_prev','route_current','route_delta_pct','route_class','overall_delta_pct','signal']];
  const rows=routeAg.map((a,i)=>{ const ov=overall[a.agid]||{g:null};
    const sig=b2dShiftSignal(a.cls,ov.g==null?null:ov.g);
    window._b2dCsvRows.push([a.ag,a.code,a.own,Math.round(a.prev),Math.round(a.cur),a.g==null?'':a.g.toFixed(1),a.cls,ov.g==null?'':ov.g.toFixed(1),sig?sig.t:'']);
    return '<tr>'+b2dTd('<span style="color:#999;font-size:10.5px">'+(i+1)+'</span>')+b2dTd(b2dAgLink(a))+b2dTd(b2dOwnLink(a.ownId,a.own))
      +b2dTd(b2dB(a.prev),1)+b2dTd(b2dB(a.cur),1)+b2dTd(b2dDeltaHtml(a.g,a.cls),1)+b2dTd(b2dClsChip(a.cls))+b2dTd(b2dSignalChip(sig))+'</tr>'; }).join('');
  const head='<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:#555;margin-bottom:4px">'
    +'<span>Revenue <b style="font-variant-numeric:tabular-nums">'+b2dB(curF.rev)+'</b> '+b2dDeltaHtml(gF)+'</span>'
    +'<span>Pax <b>'+curF.pax.toLocaleString()+'</b></span><span>booking <b>'+curF.bookings+'</b></span>'
    +'<span>agents on this route <b>'+routeAg.filter(a=>a.cur>0).length+'</b></span></div>';
  return chips+b2dCard(b2dEsc(sel)+' — all agents by revenue (class = this route only · signal vs whole portfolio)',
    head+b2dTable([{t:'#'},{t:'Agent'},{t:'Sales'},{t:'Prev',r:1},{t:'Current',r:1},{t:'Δ this route',r:1},{t:'Class'},{t:'Route-shift signal'}],rows));
}

// ── By market ──
function b2dTabMarket(agAll,cur){
  const m={};
  agAll.forEach(a=>{ let r=m[a.mktCode]; if(!r) r=m[a.mktCode]={code:a.mktCode,name:a.mkt,cur:0,prev:0,agents:[],active:0};
    r.cur+=a.cur; r.prev+=a.prev; r.agents.push(a); if(a.cur>0) r.active++; });
  const list=Object.keys(m).map(k=>m[k]).sort((a,b)=>b.cur-a.cur);
  window._b2dCsvName='by_market';
  window._b2dCsvRows=[['market','active_agents','revenue','prev','delta_pct','share_pct']].concat(list.map(o=>[o.name,o.active,Math.round(o.cur),Math.round(o.prev),o.prev>0?((o.cur-o.prev)/o.prev*100).toFixed(1):'',cur.rev>0?(o.cur/cur.rev*100).toFixed(1):'']));
  const rows=list.map(o=>{ const g=o.prev>0?(o.cur-o.prev)/o.prev*100:null;
    return '<tr>'+b2dTd(b2dMktLink(o.code,o.name))+b2dTd(o.active,1)+b2dTd(b2dB(o.cur),1)+b2dTd(b2dDeltaHtml(g),1)
      +b2dTd(cur.rev>0?(o.cur/cur.rev*100).toFixed(1)+'%':'—',1)+b2dTd(b2dGsl(o.agents))+'</tr>'; }).join('');
  return b2dCard('Summary by market',b2dTable([{t:'Market'},{t:'Active agents',r:1},{t:'Revenue',r:1},{t:'Δ',r:1},{t:'% of total',r:1},{t:'G/S/L'}],rows));
}

// ── Growth / Loss / Stable tabs (§4.6 tab mapping) ──
function b2dTabClass(agAll,tab){
  const want = tab==='growth'?['growth','new'] : tab==='loss'?['loss','churn'] : ['stable'];
  const list=agAll.filter(a=>want.indexOf(a.cls)>=0).sort((a,b)=>b.cur-a.cur||b.prev-a.prev);
  // mockup parity: header carries the class's aggregate ฿ delta
  const delta=list.reduce((s,a)=>s+(a.cls==='loss'||a.cls==='churn'?a.prev-a.cur:a.cls==='new'?a.cur:a.cur-a.prev),0);
  const dLbl = tab==='loss'?'−'+b2dK(delta) : tab==='growth'?'+'+b2dK(delta) : '±'+b2dK(Math.abs(delta));
  const title = (tab==='growth'?'Growing agents (growth + new)' : tab==='loss'?'Declining agents (loss + churned)' : 'Stable agents')+' · '+dLbl;
  window._b2dCsvName='class_'+tab;
  window._b2dCsvRows=[['agent','code','owner','market','prev','current','delta_pct','class']].concat(list.map(a=>[a.ag,a.code,a.own,a.mkt,Math.round(a.prev),Math.round(a.cur),a.g==null?'':a.g.toFixed(1),a.cls]));
  const rows=list.map(a=>'<tr>'+b2dTd(b2dAgLink(a))+b2dTd(b2dOwnLink(a.ownId,a.own))+b2dTd(b2dMktLink(a.mktCode,a.mkt))
    +b2dTd(b2dB(a.prev),1)+b2dTd(b2dB(a.cur),1)+b2dTd(b2dDeltaHtml(a.g,a.cls),1)+b2dTd(b2dClsChip(a.cls))
    +b2dTd('<span style="font-size:10.5px;color:#777">'+B2D_HINT[a.cls]+'</span>')+'</tr>').join('');
  return b2dCard(title+' — '+list.length+' agents',list.length?b2dTable([{t:'Agent'},{t:'Sales'},{t:'Market'},{t:'Prev',r:1},{t:'Current',r:1},{t:'Δ',r:1},{t:'Class'},{t:'Action'}],rows):'<div style="color:#999;font-size:12px">No agents in this class</div>');
}

// ═══════════ DETAIL PAGES (§5.4) ═══════════
function b2dBackBar(title,sub){ return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><button onclick="b2dBack()" style="border:1px solid #E2E8F0;background:#fff;color:#475569;border-radius:12px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">‹ Back</button><div><div style="font-weight:800;font-size:17px;letter-spacing:-.01em;color:'+B2D_UI.ink+'">'+title+'</div>'+(sub?'<div style="font-size:11px;color:'+B2D_UI.mut+';margin-top:1px">'+sub+'</div>':'')+'</div></div>'; }
function b2dKpiRow(items){ return '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:16px">'+items.map(i=>'<div style="'+B2D_UI.card+'flex:1;min-width:140px;padding:14px 16px"><div style="font-size:10.5px;font-weight:600;color:'+B2D_UI.mut+'">'+i[0]+'</div><div style="font-size:18px;font-weight:800;letter-spacing:-.01em;margin-top:3px;color:'+B2D_UI.ink+';font-variant-numeric:tabular-nums">'+i[1]+'</div>'+(i[2]?'<div style="font-size:11px;margin-top:3px">'+i[2]+'</div>':'')+'</div>').join('')+'</div>'; }

function b2dAgentDetail(L,w,agAll,agid){
  const a=agAll.filter(x=>x.agid===agid)[0];
  const agRec=(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).filter(x=>x.id===agid)[0];
  const name=(a&&a.ag)||(agRec&&agRec.name)||agid;
  const code=(a&&a.code)||(agRec&&agRec.code)||'';
  const own=(a&&a.own)||'House', ownId=(a&&a.ownId)||'__house';
  const mkt=(a&&a.mkt)||'Unspecified', mktCode=(a&&a.mktCode)||'__none';
  const mine=l=>l.agid===agid;
  const c=b2dSum(L,w.cs,w.ce,mine), p=b2dSum(L,w.ps,w.pe,mine);
  const g=p.rev>0?(c.rev-p.rev)/p.rev*100:null;
  const famsSent={}; L.forEach(l=>{ if(!mine(l))return; const d=l[_b2d.basis]; if(d&&d>=w.cs&&d<=w.ce&&l.rev>0) famsSent[l.fam]=1; });
  const header=b2dBackBar(b2dEsc(name)+' '+b2dClsChip(a?a.cls:'stable'),
    (code?'code <b>'+b2dEsc(code)+'</b> · ':'')+'sales '+b2dOwnLink(ownId,own)+' · market '+b2dMktLink(mktCode,mkt)
    +' · <a onclick="b2dOpenAgentExt(\''+b2dEsc(agid)+'\',\''+b2dEsc(code)+'\')" style="color:#059669;cursor:pointer">↗ Open in sales system</a>');
  const kpis=b2dKpiRow([['Revenue',b2dK(c.rev),b2dDeltaHtml(g)],['Pax',c.pax.toLocaleString()],['Bookings',c.bookings],['Routes sent',Object.keys(famsSent).length]]);
  const chart=b2dCard('Monthly revenue (stacked by route)',b2dMonthlyHtml(L.filter(mine),l=>l.fam,null));
  // routes table (§5.4) — per-route class reuses §4.6 at agent×route grain
  window._b2dCsvName='agent_'+(code||agid);
  window._b2dCsvRows=[['route','bookings','pax','revenue','prev','delta_pct','class']];
  const famRows=B2D_FAM_ORDER.map(f=>{
    const fc=b2dSum(L,w.cs,w.ce,l=>mine(l)&&l.fam===f), fp=b2dSum(L,w.ps,w.pe,l=>mine(l)&&l.fam===f);
    if(fc.rev<=0&&fp.rev<=0) return '';
    const cl=b2dCls(fc.rev,fp.rev,_b2d.T);
    window._b2dCsvRows.push([f,fc.bookings,fc.pax,Math.round(fc.rev),Math.round(fp.rev),cl.g==null?'':cl.g.toFixed(1),cl.cls]);
    return '<tr>'+b2dTd(b2dEsc(f))+b2dTd(fc.bookings,1)+b2dTd(fc.pax,1)+b2dTd(b2dB(fc.rev),1)+b2dTd(b2dDeltaHtml(cl.g,cl.cls),1)+b2dTd(b2dClsChip(cl.cls))+'</tr>';
  }).join('');
  const routesCard=b2dCard('Routes sent (current period)',famRows?b2dTable([{t:'Route'},{t:'Bookings',r:1},{t:'Pax',r:1},{t:'Revenue',r:1},{t:'Δ',r:1},{t:'Class'}],famRows):'<div style="color:#999;font-size:12px">Nothing sent in this period</div>');
  // recent bookings — mockup parity: current-window trip-lines, newest first by active basis, top 40
  const k=_b2d.basis;
  const recent=L.filter(l=>mine(l)&&l[k]&&l[k]>=w.cs&&l[k]<=w.ce)
    .sort((x,y)=>String(y[k]||'').localeCompare(String(x[k]||''))).slice(0,40);
  const recRows=recent.map(r=>'<tr>'+b2dTd(r.bd?b2dThD(r.bd):'—')+b2dTd(r.td?b2dThD(r.td):'—')+b2dTd(b2dEsc(r.fam))+b2dTd(r.pax,1)+b2dTd(b2dB(r.rev),1)+'</tr>').join('');
  const recCard=b2dCard('Bookings in period (latest '+recent.length+')',recent.length?b2dTable([{t:'Booking date'},{t:'Travel date'},{t:'Route'},{t:'Pax',r:1},{t:'฿',r:1}],recRows):'<div style="color:#999;font-size:12px">No bookings in this period</div>');
  return header+kpis+chart+routesCard+recCard;
}

function b2dStaffDetail(L,w,agAll,ownId){
  const slRec=(typeof SB_SALES!=='undefined'?SB_SALES:[]).filter(s=>s.id===ownId)[0];
  const name=ownId==='__house'?'House':((slRec&&(slRec.name||slRec.code))||ownId);
  const role=(slRec&&slRec.designation)||'';
  const mine=l=>l.ownId===ownId;
  const agents=agAll.filter(a=>a.ownId===ownId).sort((a,b)=>b.cur-a.cur);
  const c=b2dSum(L,w.cs,w.ce,mine), p=b2dSum(L,w.ps,w.pe,mine);
  const tot=b2dSum(L,w.cs,w.ce,null);
  const g=p.rev>0?(c.rev-p.rev)/p.rev*100:null;
  const header=b2dBackBar(b2dEsc(name),b2dEsc(role||'Sales'));
  const kpis=b2dKpiRow([['Revenue',b2dK(c.rev),b2dDeltaHtml(g)],['Active agents',agents.filter(a=>a.cur>0).length],['Pax',c.pax.toLocaleString()],['% of team',tot.rev>0?(c.rev/tot.rev*100).toFixed(1)+'%':'—']]);
  const gsl=b2dCard('Portfolio health',b2dGsl(agents));
  const chart=b2dCard('Monthly revenue (stacked by agent)',b2dMonthlyHtml(L.filter(mine),l=>l.ag,null));
  window._b2dCsvName='staff_'+name.replace(/\s+/g,'');
  window._b2dCsvRows=[['agent','code','market','primary_trip','revenue','prev','delta_pct','class']];
  const rows=agents.map(a=>{
    const famRev={}; L.forEach(l=>{ if(l.agid!==a.agid)return; const d=l[_b2d.basis]; if(!d)return; if(d>=w.cs&&d<=w.ce) famRev[l.fam]=(famRev[l.fam]||0)+l.rev; });
    const prim=Object.keys(famRev).sort((x,y)=>famRev[y]-famRev[x])[0]||'—';
    window._b2dCsvRows.push([a.ag,a.code,a.mkt,prim,Math.round(a.cur),Math.round(a.prev),a.g==null?'':a.g.toFixed(1),a.cls]);
    return '<tr>'+b2dTd(b2dAgLink(a))+b2dTd(b2dMktLink(a.mktCode,a.mkt))+b2dTd(b2dEsc(prim))
      +b2dTd(b2dB(a.cur),1)+b2dTd(b2dDeltaHtml(a.g,a.cls),1)+b2dTd(b2dClsChip(a.cls))+'</tr>'; }).join('');
  const table=b2dCard('Agents in portfolio — '+agents.length,agents.length?b2dTable([{t:'Agent'},{t:'Market'},{t:'Primary trip'},{t:'Revenue',r:1},{t:'Δ',r:1},{t:'Class'}],rows):'<div style="color:#999;font-size:12px">No agents</div>');
  return header+kpis+gsl+chart+table;
}

function b2dMarketDetail(L,w,agAll,mktCode){
  const mkRec=(typeof SB_MARKETS!=='undefined'?SB_MARKETS:[]).filter(m=>m.id===mktCode)[0];
  const name=mktCode==='__none'?'Unspecified':((mkRec&&mkRec.name)||mktCode);
  const mine=l=>l.mktCode===mktCode;
  const agents=agAll.filter(a=>a.mktCode===mktCode).sort((a,b)=>b.cur-a.cur);
  const c=b2dSum(L,w.cs,w.ce,mine), p=b2dSum(L,w.ps,w.pe,mine);
  const tot=b2dSum(L,w.cs,w.ce,null);
  const g=p.rev>0?(c.rev-p.rev)/p.rev*100:null;
  const header=b2dBackBar(b2dEsc(name),'Market · '+agents.length+' agents in period');
  const kpis=b2dKpiRow([['Revenue',b2dK(c.rev),b2dDeltaHtml(g)],['Active agents',agents.filter(a=>a.cur>0).length],['Pax',c.pax.toLocaleString()],['% of total',tot.rev>0?(c.rev/tot.rev*100).toFixed(1)+'%':'—']]);
  const gsl=b2dCard('Market health',b2dGsl(agents));
  const chart=b2dCard('Monthly revenue (stacked by agent)',b2dMonthlyHtml(L.filter(mine),l=>l.ag,null));
  window._b2dCsvName='market_'+(mktCode==='__none'?'none':mktCode);
  window._b2dCsvRows=[['agent','code','owner','revenue','prev','delta_pct','class']];
  const rows=agents.map(a=>{ window._b2dCsvRows.push([a.ag,a.code,a.own,Math.round(a.cur),Math.round(a.prev),a.g==null?'':a.g.toFixed(1),a.cls]);
    return '<tr>'+b2dTd(b2dAgLink(a))+b2dTd(b2dOwnLink(a.ownId,a.own))+b2dTd(b2dB(a.cur),1)+b2dTd(b2dDeltaHtml(a.g,a.cls),1)+b2dTd(b2dClsChip(a.cls))+'</tr>'; }).join('');
  const table=b2dCard('Agents in market (by revenue)',agents.length?b2dTable([{t:'Agent'},{t:'Sales'},{t:'Revenue',r:1},{t:'Δ',r:1},{t:'Class'}],rows):'<div style="color:#999;font-size:12px">No agents</div>');
  return header+kpis+gsl+chart+table;
}
function repSt(kind){
  if(!REP_ST[kind]){
    var t=new Date(), y=t.getFullYear(), m=t.getMonth();
    var f=new Date(y,m,1), l=new Date(y,m+1,0);
    REP_ST[kind]={ from:repYMD(f), to:repYMD(l), mode:'full', built:false };
  }
  return REP_ST[kind];
}
function repYMD(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function repParse(ds){ return new Date(ds+'T12:00:00'); }
function repDayCount(from,to){ return Math.round((repParse(to)-repParse(from))/86400000)+1; }
/* ช่วงก่อนหน้าที่ยาวเท่ากันเป๊ะ · ติดกันพอดี ไม่เว้นวัน ไม่ทับวัน */
function repPrevRange(from,to){
  var n=repDayCount(from,to);
  var pt=repParse(from); pt.setDate(pt.getDate()-1);
  var pf=new Date(pt); pf.setDate(pf.getDate()-(n-1));
  return {from:repYMD(pf), to:repYMD(pt)};
}
function repDays(from,to){
  var out=[], d=repParse(from), e=repParse(to);
  while(d<=e){ out.push(repYMD(d)); d.setDate(d.getDate()+1); }
  return out;
}
function repDateTH(ds){ var d=repParse(ds); return REP_TH_MON[d.getMonth()]+' '+d.getDate(); }
function repMonTH(ds){ var d=repParse(ds); return REP_TH_MON[d.getMonth()]+" '"+String(d.getFullYear()).slice(-2); }
function repRangeTH(from,to){
  var a=repParse(from), b=repParse(to);
  var yr=(a.getFullYear()===b.getFullYear())?(' '+a.getFullYear()):'';
  return repDateTH(from)+' – '+repDateTH(to)+yr;
}
function repN(n){ return Math.round(+n||0).toLocaleString(); }
function repMoney(n){
  n=+n||0;
  if(Math.abs(n)>=1000000) return (n/1000000).toFixed(2).replace(/\.?0+$/,'')+'M';
  if(Math.abs(n)>=1000) return Math.round(n/1000)+'K';
  return repN(n);
}
function repE(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
/* เทียบกับช่วงก่อน · คืนทั้งตัวเลขและทิศทาง เพื่อให้สไลด์เอาไปเขียนประโยคเองได้ */
function repDelta(now, prev, invert){
  now=+now||0; prev=+prev||0;
  var d=now-prev, pct=prev>0?Math.round(Math.abs(d)/prev*100):(now>0?100:0);
  var dir=d>0?'up':(d<0?'dn':'flat');
  var good=(dir==='flat')?'flat':((dir==='up')!==!!invert?'good':'bad');
  return {d:d, pct:pct, dir:dir, good:good, prev:prev,
          txt:(d===0?'no change':((d>0?'+':'−')+repN(Math.abs(d))+' ('+pct+'%)')) };
}

/* ── เก็บตัวเลขฝั่งปฏิบัติการทั้งหมดในรอบเดียว ─────────────────────────────
   วนใบจองรอบเดียวแล้วแยกลงถังต่าง ๆ · กองใบจองมี 3,000+ ใบ
   ถ้าวนใหม่ทุกสไลด์จะกลายเป็นสิบกว่ารอบโดยไม่จำเป็น                        */
function repOpsGather(from,to){
  var BK=(typeof SB_BOOKINGS!=='undefined')?SB_BOOKINGS:[];
  var O={ pax:0, paxBooked:0, bookings:0, revenue:0, tripRuns:0,
          byDate:{}, byRoute:{}, byBoat:{}, byPier:{}, byAgent:{}, byNat:{},
          natTH:0, natFR:0, lost:0, wxBk:0, wxPax:0, cxlBk:0, cxlPax:0,
          b2b:{bk:0,pax:0,rev:0}, b2c:{bk:0,pax:0,rev:0},
          namedBk:0, cap:0, capDays:0, boatDays:{} };
  var seen={}, DEAD=['cancelled','rejected'], DRAFT=['quote','pending_approval'];
  BK.forEach(function(b){
    (b.trips||[]).forEach(function(t){
      var d=String(t.date||'').slice(0,10); if(!d||d<from||d>to) return;
      var booked=(typeof ckBookedPax==='function')?ckBookedPax(t):0;
      if(b.status==='cancelled_weather'){ O.wxBk++; O.wxPax+=booked; return; }
      if(DEAD.indexOf(b.status)>=0){ O.cxlBk++; O.cxlPax+=booked; return; }
      if(DRAFT.indexOf(b.status)>=0) return;
      /* หัวที่ไปจริง · หักคนไม่มา/ยกเลิกหน้างานแล้ว ชุดเดียวกับที่หน้าท่าใช้ */
      var real=booked;
      try{ if(typeof poPaxLeft==='function') real=poPaxLeft(b,d,t).tot; }catch(_){}
      O.paxBooked+=booked; O.pax+=real; O.lost+=Math.max(0,booked-real);
      if(!seen[b.id]){ seen[b.id]=1; O.bookings++; O.revenue+=(+b.total||0);
        if((b.passengers||[]).some(function(p){ return p&&p.name; })) O.namedBk++; }
      /* รายวัน */
      var dd=O.byDate[d]||(O.byDate[d]={pax:0,booked:0,boats:{}}); dd.pax+=real; dd.booked+=booked;
      /* เส้นทาง */
      var rid=t.routeId||'-';
      var rr=O.byRoute[rid]||(O.byRoute[rid]={pax:0,booked:0,bk:0,rev:0,days:{},runs:{},bo:{}});
      rr.pax+=real; rr.booked+=booked; rr.bk++;
      rr.days[d]=1;                        /* §repSched · วันที่โปรแกรมนี้ออกจริง */
      rr.rev+=(+b.total||0)/Math.max(1,(b.trips||[]).length);
      /* เรือ + ท่า */
      var op=(typeof bkOpsRead==='function')?bkOpsRead(b,d):(b.ops||{});
      var bid=(op&&op.boatId)||t.charterBoatId||'';
      if(bid){
        var bb=O.byBoat[bid]||(O.byBoat[bid]={pax:0,days:{},bk:0}); bb.pax+=real; bb.bk++; bb.days[d]=1;
        dd.boats[bid]=1;
        /* §repSched · หนึ่งเที่ยว = หนึ่งลำในหนึ่งวันของโปรแกรมนั้น
           นับเป็นเซ็ตเพื่อไม่ให้หลายใบจองบนเรือลำเดียวกันกลายเป็นหลายเที่ยว */
        if(rr){ rr.runs[d+'|'+bid]=1; rr.bo[bid]=1; }
      }
      var rt=(typeof getRoute==='function')?getRoute(rid):null;
      var pier=(rt&&rt.pier)||'-';
      var pp=O.byPier[pier]||(O.byPier[pier]={pax:0,bk:0,boats:{}}); pp.pax+=real; pp.bk++; if(bid) pp.boats[d+'|'+bid]=1;
      /* ช่องทางขาย */
      var isB2C=(typeof laIsB2C==='function')?laIsB2C(b):!b.agentId;   /* §b2cOne · เกณฑ์เดียวกับ Dashboard */
      var side=isB2C?O.b2c:O.b2b; side.pax+=real;
      if(!seen[b.id+'|ch']){ seen[b.id+'|ch']=1; side.bk++; side.rev+=(+b.total||0); }
      if(b.agentId && !isB2C){
        var aa=O.byAgent[b.agentId]||(O.byAgent[b.agentId]={pax:0,bk:0,rev:0});
        aa.pax+=real;
        if(!seen[b.id+'|ag']){ seen[b.id+'|ag']=1; aa.bk++; aa.rev+=(+b.total||0); }
      }
      /* สัญชาติ · ตัวเลขไทย/ตปท มาจากช่องที่คีย์จริง · รายประเทศยืมจากหัวกรุ๊ป */
      var th=0;
      try{ ['ad','chd','inf','foc'].forEach(function(k){ th+=(typeof bkNatTH==='function')?bkNatTH(t,k):0; }); }catch(_){}
      th=Math.min(th, booked);
      var ratio=booked>0?(real/booked):0;
      O.natTH+=th*ratio; O.natFR+=(booked-th)*ratio;
      var nat=String(b.leadNationality||'').trim().toUpperCase()||'—';
      O.byNat[nat]=(O.byNat[nat]||0)+real;
    });
  });
  /* ความจุ · ใช้ getAllotment ตัวเดียวกับปฏิทินหน้า Dashboard ตัวเลขจะได้ตรงกัน */
  var RT=(typeof ROUTES!=='undefined')?ROUTES:[];
  repDays(from,to).forEach(function(ds){
    var any=false;
    RT.forEach(function(r){
      try{
        if(typeof bkV2IsRouteOpenOn==='function' && !bkV2IsRouteOpenOn(r.id,ds)) return;
        if(typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(r.id,ds)) return;
        var al=(typeof getAllotment==='function')?getAllotment(r.id,ds):null;
        if(al&&al.hasAllotment){ O.cap+=al.availableCapacity||0; any=true;
          var rr=O.byRoute[r.id]; if(rr) rr.cap=(rr.cap||0)+(al.availableCapacity||0); }
      }catch(_){}
    });
    if(any) O.capDays++;
  });
  Object.keys(O.byDate).forEach(function(d){ O.tripRuns+=Object.keys(O.byDate[d].boats).length; });
  O.fill = O.cap>0 ? Math.round(O.pax/O.cap*100) : 0;
  return O;
}


/* ── ชิ้นส่วนสไลด์ · ยกโครงมาจากการ์ดในหน้า Dashboard ───────────────────
   การ์ดหนึ่งใบ = หัวการ์ด → แถวตัวเลข → หัวข้อย่อย → รายการ
   สไลด์หนึ่งแผ่น = พื้น navy + กริดการ์ด · ไม่ใช่แผ่นขาวใบเดียวแบบเดิม      */
/* ไล่สีแท่งจากสีที่สั่ง ไปหาสีเดียวกันแบบจาง · ให้เข้ากับตัวเลขที่ไล่สี */
function repFade(c){
  c=c||'#6B4BEA';
  return 'linear-gradient(90deg,'+c+' 0%,'+c+'AA 100%)';
}
/* เครื่องหมายบริษัท · ขีดเฉียงสามเส้นซ้อนกัน วาดด้วย svg ไม่ต้องโหลดรูป */
function repMark(sz){
  sz=sz||34;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 34 34" aria-hidden="true">'
    +'<g fill="none" stroke="#6B4BEA" stroke-width="3" stroke-linecap="round">'
    +'<path d="M8 12.5 L20 6.5"/><path d="M8 18 L23 10.5"/><path d="M8 23.5 L26 14.5"/>'
    +'</g></svg>';
}
function repBrand(){ return '<div class="rep-brand">'+repMark(34)+'<span>LOVE ANDAMAN</span></div>'; }
/* ปก · วงแหวนซ้อนกลางหน้า ตามเทมเพลต */
function repCover(o){
  return repSl({lv:'exec', cover:true, body:
     '<div class="rep-cvw"><div class="rep-cv">'
    +repBrand()
    +'<h1>'+o.title+'</h1>'
    +'<span class="lb">'+repE(o.label||'ช่วงรายงาน')+'</span>'
    +'<span class="rg">'+repE(o.range)+'</span>'
    +(o.meta?('<span class="mt">'+repE(o.meta)+'</span>'):'')
    +'</div></div>'});
}
/* สารบัญ · ซ้ายเป็นชื่อเรื่อง ขวาเป็นการ์ดเลขลำดับ */
function repAgenda(o){
  var items=o.items||[];
  return repSl({lv:'exec', bare:true, body:
     '<div class="rep-ag">'
    +'<div class="rep-agl">'+repBrand()
      +'<p>'+repE(o.lead||'')+'</p>'
      +'<h2>'+repE(o.title||'สารบัญ')+'</h2></div>'
    +'<div class="rep-agg">'+items.map(function(it,i){
        return '<div class="rep-agc"><span class="nn">'+(i<9?'0':'')+(i+1)+'<em>.</em></span>'
          +'<span class="tt">'+repE(it[0])+(it[1]?('<i>'+repE(it[1])+'</i>'):'')+'</span></div>';
      }).join('')+'</div></div>'});
}
/* ประโยคสรุปใหญ่กลางหน้า · ใช้กับข้อความที่อยากให้คนอ่านจำได้ประโยคเดียว */
function repQuoteSl(o){
  return repSl({lv:'exec', bare:true, body:
     '<div class="rep-qw">'+repBrand()
    +'<div class="rep-quote"><div class="q">'+o.text
      +(o.note?('<u>'+o.note+'</u>'):'')+'</div>'
      +'<div class="qm">&rdquo;</div></div>'
    +'<div class="qf"><i></i><span>'+repE(o.tag||'')+'</span></div>'
    +'</div>'});
}
/* ── แผนงานเป็นแถว · ใช้กับข้อมูลที่เดินไปตามเวลา (เดือน/ไตรมาส) ──
   ป้ายบนสุด · ชื่อ · ตัวเลข · เส้นนอน · คำอธิบายห้อยลงมาจากเส้น          */
function repRoadmap(items){
  var col='repeat('+items.length+',minmax(0,1fr))';
  return '<div class="rep-rm">'
    +'<div class="rep-rmh" style="grid-template-columns:'+col+'">'
    +items.map(function(it){
       return '<div class="rep-rmi"><span class="qb">'+repE(it.k)+'</span>'
         +'<span class="qt">'+repE(it.t)+'</span>'
         +(it.v?('<span class="qv">'+it.v+'</span>'):'')+'</div>'; }).join('')
    +'</div><div class="rep-rmline"></div>'
    +'<div class="rep-rmb" style="grid-template-columns:'+col+'">'
    +items.map(function(it){ return '<div class="rep-rmd">'+(it.d||'')+'</div>'; }).join('')
    +'</div></div>';
}
/* ── วงแหวนเปอร์เซ็นต์ · ใช้กับอัตราส่วนที่มีเพดาน 100% ── */
function repDonut(o){
  var p=Math.max(0,Math.min(100,+o.pct||0)), r=62, C=2*Math.PI*r;
  return '<div class="rep-dn"><div class="rep-dnr">'
    +'<svg viewBox="0 0 150 150">'
    +'<circle cx="75" cy="75" r="'+r+'" fill="none" stroke="#DDE2EC" stroke-width="19"/>'
    +'<circle cx="75" cy="75" r="'+r+'" fill="none" stroke="'+(o.c||'#6B4BEA')+'" stroke-width="19" '
      +'stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" '
      +'stroke-dashoffset="'+(C*(1-p/100)).toFixed(1)+'"/></svg>'
    +'<span>'+(o.disp||(Math.round(p)+'%'))+'</span></div>'
    +'<div class="rep-dnt"><b>'+repE(o.t)+'</b><span>'+(o.d||'')+'</span></div></div>';
}
/* ── ตัวเลขใหญ่พร้อมย่อหน้า · ใช้กับ "สามเรื่องที่ต้องรู้" ── */
function repBigPct(items, cols){
  return '<div class="rep-bp" style="grid-template-columns:repeat('+(cols||1)+',minmax(0,1fr))">'
    +items.map(function(it){
      return '<div class="rep-bpi"><span class="pv">'+it.v+'</span>'
        +'<span class="pt"><b>'+repE(it.t)+'</b><span>'+(it.d||'')+'</span></span></div>'; }).join('')
    +'</div>';
}
/* ── การ์ดเลขลำดับเรียงกัน · ใช้กับ 3-4 หัวข้อที่เทียบกันตรง ๆ ── */
function repNumCards(items){
  return '<div class="rep-nc" style="grid-template-columns:repeat('+items.length+',minmax(0,1fr))">'
    +items.map(function(it){
      return '<div class="rep-nci"><span class="nv">'+it.v+'</span>'
        +'<span class="nt">'+repE(it.t)+'</span>'
        +(it.s?('<span class="ns">'+it.s+'</span>'):'')+'</div>'; }).join('')
    +'</div>';
}
/* ── สี่มุมรอบลูกกลม · ใช้กับสี่กลุ่มที่ไม่มีลำดับ (เช่นระดับความรุนแรง) ── */
function repOrbit(o){
  var it=o.items||[];
  var cell=function(i,side,row){
    var x=it[i]; if(!x) return '<div></div>';
    return '<div class="rep-obi'+(side==='r'?' r':'')+(x.hot?' hot':'')+'" '
      +'style="grid-column:'+(side==='r'?3:1)+';grid-row:'+row+'">'
      +'<div class="oh"><span class="ok'+(String(x.k).length>3?' s':'')+'">'+repE(x.k)+'</span>'
      +'<span class="on">'+repE(x.t)+'</span></div>'
      +'<div class="od">'+(x.d||'')+'</div></div>';
  };
  return '<div class="rep-ob">'+cell(0,'l',1)+cell(1,'r',1)
    +'<div class="rep-obc"><b>'+o.cv+'</b><span>'+repE(o.ck||'')+'</span></div>'
    +cell(2,'l',2)+cell(3,'r',2)+'</div>';
}
/* แท่งตั้งเจ็ดคอลัมน์ · ใช้กับจังหวะรายวันในสัปดาห์ ที่ต้องอ่านซ้ายไปขวา */
function repWeekBars(rows){
  var max=Math.max.apply(null,rows.map(function(r){return +r.v||0;}).concat([1]));
  return '<div class="rep-wk">'+rows.map(function(r){
    var h=Math.max(6,(+r.v||0)/max*100);
    return '<div class="rep-wkc"><span class="v">'+(r.disp||repN(r.v))+'</span>'
      +'<span class="b" style="height:'+h.toFixed(1)+'%"></span>'
      +'<span class="n">'+repE(r.n)+'</span>'
      +(r.x?('<span class="s">'+repE(r.x)+'</span>'):'')+'</div>';
  }).join('')+'</div>';
}
function repSl(o){
  return '<section class="rep-sl'+(o.cover?' cover':'')+(o.bare?' bare':'')
      +'" data-lv="'+(o.lv||'full')+'">'
    +((o.cover||o.bare)?'':'<div class="rep-shd"><div><span class="n">'+repE(o.kicker||'')+'</span>'
        +'<h2>'+repE(o.title||'')+'</h2></div>'
        +(o.sub?'<span class="s">'+o.sub+'</span>':'')+'</div>')
    +'<div class="rep-bd">'+(o.body||'')+'</div>'
    +'</section>';
}
/* การ์ด · โครงเดียวกับ .dv-c + .dv-ct ในหน้า Dashboard */
function repCard(o){
  o=o||{};
  return '<div class="rep-c'+(o.cls?(' '+o.cls):'')+'">'
    +(o.t?('<div class="rep-cth"><span class="big">'+repE(o.t)+'</span>'
        +(o.sub?'<span class="sm">'+repE(o.sub)+'</span>':'')
        +'<span class="sp"></span>'
        +(o.pill?('<span class="rep-pill'+(o.pillCls?(' '+o.pillCls):'')+'">'+o.pill+'</span>'):'')
      +'</div>'):'')
    +'<div class="rep-cbd">'+(o.body||'')+'</div>'
    +(o.foot?('<div class="rep-cfoot '+(o.footCls||'')+'">'+o.foot+'</div>'):'')
  +'</div>';
}
function repGrid(cls, cards){ return '<div class="rep-grid '+(cls||'')+'">'+cards.join('')+'</div>'; }
/* แถวตัวเลข · เส้นคั่นบาง ๆ ระหว่างช่อง แบบ .dv-avrow + .dv-avs */
function repStats(rows){
  return '<div class="rep-avrow">'+rows.map(function(r,i){
    return (i?'<span class="rep-avs"></span>':'')
      +'<div class="rep-av"><span class="v'+(r.c?' sol':'')+'"'
      +(r.c?(' style="color:'+r.c+'"'):'')+'>'+r.v+'</span>'
      +'<span class="k">'+repE(r.k)+'</span>'
      +(r.u?'<span class="u">'+repE(r.u)+'</span>':'')
      +(r.dl?('<span class="dl '+r.dl.good+'">'+(r.dl.dir==='up'?'&#9650;':(r.dl.dir==='dn'?'&#9660;':'&#9679;'))
              +' '+r.dl.txt+'</span>'):'')
      +'</div>';
  }).join('')+'</div>';
}
/* รายการย่อย · แบบ .dv-pr2 · ป้ายสี + ชื่อ/คำอธิบาย + ตัวเลขขวา */
function repRows(rows){
  return '<div class="rep-rows">'+rows.map(function(r){
    return '<div class="rep-row">'
      +'<span class="pm" style="background:'+(r.c||'#94A3B8')+'">'+repE(r.b||'')+'</span>'
      +'<span class="tx"><span class="n">'+repE(r.n)+'</span>'
        +(r.s?'<span class="s">'+repE(r.s)+'</span>':'')+'</span>'
      +'<span class="rt"><b>'+(r.v==null?'':r.v)+'</b>'
        +(r.u?'<i>'+repE(r.u)+'</i>':'')+'</span>'
    +'</div>';
  }).join('')+'</div>';
}
function repSec(t){ return '<div class="rep-csec">'+repE(t)+'</div>'; }
/* แท่งเทียบ · อยู่ในการ์ด จึงบางลงกว่าเดิม */
function repBars(rows, opt){
  opt=opt||{};
  var max=Math.max.apply(null,rows.map(function(r){return +r.v||0;}).concat([1]));
  /* opt.sem = แท่งที่สีสื่อความหมาย (แดง=จอดซ่อม ส้ม=รุนแรง) ให้ใช้สีที่ส่งมา
     นอกนั้นใช้ม่วงชุดเดียวกันหมด · สีประจำตัวยังอยู่ที่ป้ายข้างชื่อในรายการย่อย */
  return '<div class="rep-bars">'+rows.map(function(r){
    var w=Math.max(1.5,(+r.v||0)/max*100);
    return '<div class="rep-bar">'
      +'<span class="nm" title="'+repE(r.n)+'">'+repE(r.n)+'</span>'
      +'<span class="tr"><i style="width:'+w.toFixed(1)+'%;background:'
        +repFade(opt.sem?r.c:'#7C5CF2')+'"></i></span>'
      +'<span class="vv">'+(r.disp||repN(r.v))+'</span>'
      +(r.x?'<span class="xx">'+r.x+'</span>':'')
    +'</div>';
  }).join('')+'</div>';
}
function repTrend(days, key, color){
  var max=Math.max.apply(null,days.map(function(d){return d[key]||0;}).concat([1]));
  var n=days.length, w=1600, h=300, cw=w/n;
  var bars=days.map(function(d,i){
    var hh=(d[key]||0)/max*h;
    return '<rect x="'+(i*cw+cw*0.16).toFixed(1)+'" y="'+(h-hh).toFixed(1)+'" width="'+(cw*0.68).toFixed(1)
      +'" height="'+Math.max(1,hh).toFixed(1)+'" rx="3" fill="'+color+'"/>';
  }).join('');
  var lbl=days.map(function(d,i){
    var dt=repParse(d.ds); var show=(n<=14)||(dt.getDate()===1)||(dt.getDate()%5===0);
    return show?('<text x="'+(i*cw+cw/2).toFixed(1)+'" y="'+(h+26)+'" text-anchor="middle" '
      +'font-size="17" fill="#A5AAB8" font-weight="700" '
      +'font-family="Poppins,sans-serif">'+dt.getDate()+'</text>'):'';
  }).join('');
  return '<div class="rep-trend"><svg viewBox="0 0 '+w+' '+(h+40)+'" preserveAspectRatio="none">'+bars+lbl+'</svg></div>';
}
function repTable(head, rows){
  return '<table class="rep-tb"><thead><tr>'
    +head.map(function(h,i){ return '<th'+(i?' class="n"':'')+'>'+repE(h)+'</th>'; }).join('')
    +'</tr></thead><tbody>'+rows.map(function(r){
      return '<tr>'+r.map(function(c,i){ return '<td'+(i?' class="n"':'')+'>'+c+'</td>'; }).join('')+'</tr>';
    }).join('')+'</tbody></table>';
}
function repSay(kind, txt){ return '<div class="rep-say '+(kind||'')+'">'+txt+'</div>'; }
function repNote(t){ return '<div class="rep-cnote">'+t+'</div>'; }

/* ══ สไลด์ฝั่งปฏิบัติการ ═══════════════════════════════════════════════ */
function repOpsSlides(st){
  var D=repOpsGather(st.from, st.to);
  var pv=repPrevRange(st.from, st.to);
  var P=repOpsGather(pv.from, pv.to);
  var nDay=repDayCount(st.from, st.to);
  var S=[];
  var rn=function(id){ var r=(typeof getRoute==='function')?getRoute(id):null; return (r&&r.name)||id; };
  var rc=function(id){ var r=(typeof getRoute==='function')?getRoute(id):null; return (r&&r.color)||'#94A3B8'; };
  var ini=function(t){ return String(t||'').trim().slice(0,2).toUpperCase(); };
  var pc=function(a,b){ return b>0?Math.round(a/b*100):0; };

  /* ── 1 · ปก ── */
  S.push(repCover({ title:'Operations<br>Report',
    label:'Reporting period', range:repRangeTH(st.from,st.to),
    meta:nDay+' days · compared with '+repRangeTH(pv.from,pv.to) }));

  /* ── 2 · สรุปหน้าเดียว · กริดการ์ด (ตัวเลขเยอะ ต้องเห็นพร้อมกัน) ── */
  var dPax=repDelta(D.pax,P.pax), dTrip=repDelta(D.tripRuns,P.tripRuns),
      dFill=repDelta(D.fill,P.fill), dRev=repDelta(D.revenue,P.revenue);
  var days=repDays(st.from,st.to).map(function(ds){
    var e=D.byDate[ds]||{pax:0,boats:{}};
    return {ds:ds, pax:e.pax, boats:Object.keys(e.boats||{}).length}; });
  var rows=Object.keys(D.byRoute).map(function(id){
    var r=D.byRoute[id], pr=P.byRoute[id]||{pax:0};
    return {id:id, n:rn(id), v:r.pax, c:rc(id), cap:r.cap||0, prev:pr.pax,
      rev:(+r.rev||0), x:(r.cap?pc(r.pax,r.cap)+'%':'—')};
  }).sort(function(a,b){return b.v-a.v;});
  S.push(repSl({lv:'exec', kicker:'Overview', title:'The period at a glance',
    sub:repE(repRangeTH(st.from,st.to))+'<br>vs '+repE(repRangeTH(pv.from,pv.to))+' · same '+nDay+' days',
    body: repGrid('g1', [ repCard({ t:'Headline figures', pill:nDay+' days',
        body: repStats([
          {v:repN(D.pax), k:'Passengers carried', u:repN(D.paxBooked)+' seats booked', dl:dPax},
          {v:repN(D.tripRuns), k:'Sailings operated', u:'across '+D.capDays+' operating days', dl:dTrip},
          {v:D.fill+'%', k:'Seat fill rate', u:'of '+repN(D.cap)+' seats offered', dl:dFill},
          {v:repMoney(D.revenue), k:'Sales value', u:repN(D.bookings)+' bookings', dl:dRev}]),
        foot:_repOpsHeadline(D,P,dPax,dFill), footCls:dPax.good }) ])
      +repGrid('g2', [
        repCard({ t:'Passengers by day', pill:repN(D.pax/Math.max(1,nDay))+' avg/day',
                  body: repTrend(days,'pax','#7C5CF2') }),
        repCard({ t:'Best selling programmes', pill:rows.length+' running',
                  body: repRows(rows.slice(0,4).map(function(r){
                    return {b:ini(r.n), c:r.c, n:r.n, s:r.x+' seats filled', v:repN(r.v), u:'pax'}; })) })
      ])}));

  /* ── 3 · เดินตามเดือน · roadmap (ข้อมูลไล่ไปตามเวลา) ── */
  var mo={}, mor=[];
  days.forEach(function(d){
    var k=d.ds.slice(0,7);
    if(!mo[k]){ mo[k]={k:k, ds:d.ds, pax:0, nd:0, run:0}; mor.push(k); }
    mo[k].pax+=d.pax; mo[k].nd++; if(d.pax>0) mo[k].run++;
  });
  var mos=mor.map(function(k){ return mo[k]; });
  if(mos.length>=2 && mos.length<=6){
    var mbest=mos.slice().sort(function(a,b){return b.pax-a.pax;})[0]||{};
    S.push(repSl({lv:'exec', kicker:'Pace', title:'How the period unfolded',
      sub:mos.length+' months in this range',
      body: repRoadmap(mos.map(function(m,i){
        var prev=i>0?mos[i-1].pax:0;
        var dd=i>0?(m.pax-prev):0;
        return { k:repMonTH(m.ds).split(" '")[0].toUpperCase(),
          t:repMonTH(m.ds),
          v:repN(m.pax),
          d:'<b>'+repN(m.pax)+' passengers</b> over '+m.run+' operating days'
            +(i>0?('<br>'+(dd>=0?'up ':'down ')+repN(Math.abs(dd))+' vs '+repMonTH(mos[i-1].ds)):'')
            +'<br>'+repN(m.pax/Math.max(1,m.run))+' per operating day' };
      }))
      +'<div class="rep-cnote" style="text-align:center;padding-top:26px">'
      +'Busiest month <b>'+repE(repMonTH(mbest.ds||''))+'</b> with '+repN(mbest.pax||0)+' passengers'
      +'</div>'}));
  }

  /* ── 4 · รายวัน · กราฟ + วันที่แน่นสุด ── */
  var busiest=days.slice().sort(function(a,b){return b.pax-a.pax;})[0]||{};
  var quiet=days.filter(function(d){return d.pax>0;}).sort(function(a,b){return a.pax-b.pax;})[0]||{};
  var run=days.filter(function(d){return d.pax>0;}).length;
  S.push(repSl({lv:'exec', kicker:'Rhythm', title:'Passengers by day',
    sub:run+' operating days out of '+nDay,
    body: repGrid('g21', [
      repCard({ t:'Daily volume', pill:'peak '+repN(busiest.pax||0), pillCls:'ok',
                body: repTrend(days,'pax','#7C5CF2'),
                foot:'Busiest day <b>'+repDateTH(busiest.ds||'')+'</b> ('+repN(busiest.pax||0)+' pax) '
                    +'· quietest operating day <b>'+repDateTH(quiet.ds||'')+'</b> ('+repN(quiet.pax||0)+' pax) '
                    +'— a spread of '+repN((busiest.pax||0)-(quiet.pax||0))+' passengers' }),
      repCard({ t:'This period',
                body: repStats([{v:repN(D.pax/Math.max(1,nDay)), k:'Average per day', u:'passengers'}])
                  +repSec('Busiest days')
                  +repRows(days.slice().sort(function(a,b){return b.pax-a.pax;}).slice(0,5).map(function(d){
                     return {b:String(repParse(d.ds).getDate()), c:'#7C5CF2', n:repDateTH(d.ds),
                             s:d.boats+' boats out', v:repN(d.pax), u:'pax'}; })) })
    ])}));

  /* ── 5 · โปรแกรม · ตัวเลขใหญ่ + ย่อหน้า (หน้า Our Objective) ── */
  var grew=rows.slice().sort(function(a,b){return (b.v-b.prev)-(a.v-a.prev);})[0]||{};
  var fell=rows.slice().sort(function(a,b){return (a.v-a.prev)-(b.v-b.prev);})[0]||{};
  S.push(repSl({lv:'exec', kicker:'Product', title:'Where the passengers went',
    sub:rows.length+' programmes ran in this period',
    body: repBigPct(rows.slice(0,3).map(function(r){
        var d=r.v-r.prev;
        return { v:pc(r.v,D.pax)+'%', t:r.n,
          d:'<b>'+repN(r.v)+' passengers</b> · '+r.x+' of the seats offered were sold'
            +'<br>'+(d===0?'level with the previous period'
                     :((d>0?'up ':'down ')+repN(Math.abs(d))+' vs the previous period'))
            +' · '+repMoney(r.rev)+' in sales' };
      }), 1)}));

  /* ── 6 · โปรแกรมทั้งหมด · แท่ง (รายการยาว ต้องเทียบขนาด) ── */
  S.push(repSl({kicker:'Product', title:'Programme mix in full',
    body: repGrid('g21', [
      repCard({ t:'Passengers per programme', sub:'faint figure on the right is the seat fill rate',
                body: repBars(rows.slice(0,8)) }),
      repCard({ t:'Movement vs previous period',
                body: repRows(rows.slice().sort(function(a,b){
                    return Math.abs(b.v-b.prev)-Math.abs(a.v-a.prev); }).slice(0,6).map(function(r){
                  var d=r.v-r.prev;
                  return {b:ini(r.n), c:r.c, n:r.n, s:'was '+repN(r.prev)+' pax',
                          v:(d>0?'+':(d<0?'−':''))+repN(Math.abs(d)), u:'pax'}; })),
                foot:(grew.n?('<b>'+repE(grew.n)+'</b> grew the most, +'+repN(grew.v-grew.prev)+' passengers'):'')
                    +(fell.n&&fell!==grew?('<br><b>'+repE(fell.n)+'</b> fell the most, −'+repN(Math.abs(fell.v-fell.prev))+' passengers'):'') })
    ])}));

  /* ── 6b · ตารางเดินเรือรายโปรแกรม ──
     ตารางจริง ๆ ที่ใช้เทียบได้ทีละคอลัมน์ · ยุบเป็นรายโปรแกรมเพราะช่วงรายงาน
     มักยาวหลายสิบวัน การลงทุกเที่ยวจะกลายเป็นหลายร้อยแถวที่ไม่มีใครอ่าน */
  var PIERN={panwa:'Panwa', tublamu:'Tab Lamu', ranong:'Ranong'};
  var sched=Object.keys(D.byRoute).map(function(id){
    var r=D.byRoute[id];
    var rt=(typeof getRoute==='function')?getRoute(id):null;
    var nd=Object.keys(r.days||{}).length;
    var nr=Object.keys(r.runs||{}).length;
    var nb=Object.keys(r.bo||{}).length;
    return { n:rn(id), c:rc(id),
      pier:(rt&&PIERN[rt.pier])||(rt&&rt.pier)||'—',
      tm:((rt&&rt.times&&rt.times.length)?rt.times.join(' · '):'—'),
      nd:nd, nr:nr, nb:nb, pax:r.pax,
      avg:(nr?Math.round(r.pax/nr):0),
      fill:(r.cap?pc(r.pax,r.cap):0) };
  }).sort(function(a,b){return b.pax-a.pax;});
  var runTot=sched.reduce(function(a,x){return a+x.nr;},0);
  /* จังหวะรายวันในสัปดาห์ · นับจากจำนวนลำที่ออกในแต่ละวัน แล้วรวมตามวันในสัปดาห์
     เริ่มวันจันทร์ เพราะตารางเดินเรืออ่านเป็นสัปดาห์ทำงาน ไม่ได้อ่านเป็นปฏิทิน */
  var DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var dw7=DOW.map(function(n){ return {n:n, v:0, d:0, pax:0}; });
  days.forEach(function(x){
    var k=(repParse(x.ds).getDay()+6)%7;      /* อาทิตย์=0 → ท้ายแถว */
    dw7[k].v+=x.boats; dw7[k].pax+=x.pax; if(x.boats>0) dw7[k].d++;
  });
  var dwBest=dw7.slice().sort(function(a,b){return b.v-a.v;})[0]||{};
  var dwWorst=dw7.filter(function(x){return x.d>0;}).sort(function(a,b){return a.v-b.v;})[0]||{};
  S.push(repSl({lv:'exec', kicker:'Schedule', title:'Sailing schedule by programme',
    sub:sched.length+' programmes ran over '+nDay+' days',
    body: repGrid('g1', [
      repCard({ t:'Across the period',
        body: repStats([
          {v:repN(runTot), k:'Sailings run', u:'one boat, one day, one programme'},
          {v:repN(D.capDays), k:'Operating days', u:'days with at least one programme open'},
          {v:repN(Object.keys(D.byBoat).length), k:'Boats used', u:'across all programmes'},
          {v:repN(runTot?D.pax/runTot:0), k:'Average per sailing', u:'passengers'}]) }) ])
      +repGrid('g1', [
      repCard({ t:'Programme by programme', pill:sched.length+' programmes',
        body: (sched.length
          ? repTable(['Programme','Pier','Departs','Days run','Sailings','Boats','Passengers','Avg / sailing','Seat fill'],
              sched.slice(0,9).map(function(x){
                return [repE(x.n), repE(x.pier), repE(x.tm), repN(x.nd), repN(x.nr), repN(x.nb),
                        repN(x.pax), repN(x.avg), (x.fill?(x.fill+'%'):'—')]; }))
          : '<div class="rep-say">No programme ran in this period</div>')
          +repSec('Sailings by day of week')
          +repWeekBars(dw7.map(function(x){
              return {n:x.n, v:x.v, disp:repN(x.v),
                      x:(x.d?repN(x.pax/Math.max(1,x.d))+' pax':'—')}; })),
        foot:'Departure times are the scheduled ones, not what each boat actually cast off at · '
            +'one sailing = one boat, one day, one programme'
            +(sched.length>9?(' · showing 9 of '+sched.length+' programmes'):'')
            +(dwBest.n?('<br>Busiest day of the week is <b>'+dwBest.n+'</b> with '+repN(dwBest.v)+' sailings'
              +(dwWorst.n&&dwWorst.n!==dwBest.n?(', lightest is <b>'+dwWorst.n+'</b> with '+repN(dwWorst.v)):'')):'') }) ])}));

  /* ── 7 · เรือรายลำ · ตาราง (ต้องอ่านหลายคอลัมน์พร้อมกัน) ── */
  var bt=Object.keys(D.byBoat).map(function(id){
    var b=D.byBoat[id], nd=Object.keys(b.days).length;
    var bo=(typeof getBoat==='function')?getBoat(id):null;
    var cap=(bo&&bo.cap)||0;
    return {nm:(bo&&bo.name)||id, nd:nd, pax:b.pax, avg:Math.round(b.pax/Math.max(1,nd)),
            fill:cap?pc(b.pax,nd*cap):0};
  }).sort(function(a,b){return b.pax-a.pax;});
  S.push(repSl({kicker:'Assets', title:'How hard each boat worked',
    sub:'counting only the days that boat actually sailed',
    body: repGrid('g1', [
      repCard({ t:'Fleet usage',
                body: repStats([
                  {v:repN(bt.length), k:'Boats that sailed', u:'in this period'},
                  {v:repN(bt.reduce(function(a,b){return a+b.nd;},0)), k:'Boat-days worked',
                   u:'all boats combined'},
                  {v:repN(bt.length?Math.round(bt.reduce(function(a,b){return a+b.avg;},0)/bt.length):0),
                   k:'Average per sailing', u:'passengers'},
                  {v:'<span class="txt">'+(bt[0]?repE(bt[0].nm):'—')+'</span>', k:'Hardest working boat',
                   u:(bt[0]?(repN(bt[0].pax)+' pax over '+bt[0].nd+' days'):'')}]) }) ])
      +repGrid('g1', [
      repCard({ t:'Boat by boat', pill:bt.length+' boats',
                body: repTable(['Boat','Days out','Passengers','Avg / sailing','Seat fill'],
                  bt.slice(0,9).map(function(b){ return [repE(b.nm), repN(b.nd), repN(b.pax),
                    repN(b.avg), b.fill?(b.fill+'%'):'—']; })) }) ])}));

  /* ── 8 · ท่าเรือ · ข้ามถ้ามีท่าเดียว ── */
  var PN={panwa:'Phuket · Panwa', tublamu:'Tab Lamu', ranong:'Ranong'};
  var pr=Object.keys(D.byPier).map(function(k){
    var p=D.byPier[k], pp=P.byPier[k]||{pax:0};
    return {k:k, n:PN[k]||k, v:p.pax, c:'#7C5CF2',
      trips:Object.keys(p.boats).length, prev:pp.pax}; }).sort(function(a,b){return b.v-a.v;});
  if(pr.length>1)
  S.push(repSl({kicker:'Geography', title:'Passengers by departure pier',
    body: repGrid('g1', [
      repCard({ t:'Pier comparison', pill:pr.length+' piers',
                body: repStats(pr.map(function(p){
                  return {v:repN(p.v), k:p.n, u:p.trips+' sailings', dl:repDelta(p.v,p.prev)}; })) })
    ])
    +repGrid('g1', [ repCard({ t:'Share of traffic', body: repBars(pr) }) ])}));

  /* ── 9 · ช่องทางขาย · การ์ดเลขสี่ใบ (สี่ตัวเลขที่เทียบกันตรง ๆ) ── */
  var ags=Object.keys(D.byAgent).map(function(id){
    var a=D.byAgent[id], g=(typeof sbGetAgent==='function')?sbGetAgent(id):null;
    return {n:(g&&(g.name||g.code))||id, v:a.pax, bk:a.bk, rev:a.rev,
            c:(g&&g.color)||'#6B4BEA'}; }).sort(function(a,b){return b.v-a.v;});
  S.push(repSl({lv:'exec', kicker:'Channel', title:'Where the business came from',
    sub:repN(ags.length)+' agents sent work in this period',
    body: repNumCards([
        {v:pc(D.b2b.pax,D.pax)+'%', t:'Through agents',
         s:repN(D.b2b.pax)+' pax · '+repN(D.b2b.bk)+' bookings<br>'+repMoney(D.b2b.rev)+' in sales'},
        {v:pc(D.b2c.pax,D.pax)+'%', t:'Sold direct',
         s:repN(D.b2c.pax)+' pax · '+repN(D.b2c.bk)+' bookings<br>'+repMoney(D.b2c.rev)+' in sales'},
        {v:repN(ags.length), t:'Active agents',
         s:'was '+repN(Object.keys(P.byAgent).length)+' in the previous period'},
        {v:(ags[0]?pc(ags[0].v,D.pax)+'%':'—'), t:'Largest single agent',
         s:(ags[0]?(repE(ags[0].n)+'<br>'+repN(ags[0].v)+' pax · '+repMoney(ags[0].rev)):'')}
      ])}));

  /* ── 10 · เอเยนต์ · แท่ง + รายการ ── */
  S.push(repSl({kicker:'Channel', title:'Agents in detail',
    body: repGrid('g2', [
        repCard({ t:'Top 10 agents by passengers',
                  body: repBars(ags.slice(0,10).map(function(a){
                    return {n:a.n, v:a.v, x:repMoney(a.rev)}; })) }),
        repCard({ t:'Top 5 · detail',
                  body: repRows(ags.slice(0,5).map(function(a){
                    return {b:ini(a.n), c:a.c, n:a.n, s:repN(a.bk)+' bookings',
                            v:repN(a.v), u:repMoney(a.rev)}; })) })
      ])}));

  /* ── 11 · สัญชาติ · สี่มุมรอบลูกกลม + แท่งเต็ม ── */
  var NA=(typeof BKV2_NATIONALITIES!=='undefined')?BKV2_NATIONALITIES:[];
  var natName=function(c){ var f=NA.filter(function(x){return x.code===c;})[0]; return f?f.name:(c||'—'); };
  var nats=Object.keys(D.byNat).map(function(c){
    return {code:c, n:natName(c), v:D.byNat[c], c:'#8B6FF2'}; }).sort(function(a,b){return b.v-a.v;});
  var thPct=pc(D.natTH,D.pax);
  S.push(repSl({lv:'exec', kicker:'Customers', title:'Who travelled with us',
    sub:repN(nats.length)+' nationalities in this period',
    body: repOrbit({ cv:repN(D.pax), ck:'passengers carried',
      items:[
        {k:'TH', t:'Thai nationals', hot:(thPct>=50),
         d:'<b>'+repN(D.natTH)+' passengers</b> — '+thPct+'% of everyone we carried in this period'},
        {k:(nats[0]?nats[0].code:'—'), t:(nats[0]?nats[0].n:'—'), hot:true,
         d:(nats[0]?('<b>'+repN(nats[0].v)+' passengers</b> — '+pc(nats[0].v,D.pax)
            +'% of the total, the single largest source market'):'')},
        {k:'INT', t:'International', hot:(thPct<50),
         d:'<b>'+repN(D.natFR)+' passengers</b> — '+(100-thPct)+'% of the total, spread across '
           +repN(Math.max(0,nats.length-1))+' other nationalities'},
        {k:'5', t:'Top five markets',
         d:'<b>'+repN(nats.slice(0,5).reduce(function(a,x){return a+x.v;},0))+' passengers</b> — '
           +pc(nats.slice(0,5).reduce(function(a,x){return a+x.v;},0),D.pax)
           +'% of the total comes from just five countries'}
      ]})}));
  S.push(repSl({kicker:'Customers', title:'Source markets in full',
    body: repGrid('g2', [
        repCard({ t:'Top 10 nationalities',
                  body: repBars(nats.slice(0,10).map(function(x){
                    return {n:x.n+' ('+x.code+')', v:x.v}; })) }),
        repCard({ t:'Top 5',
                  body: repRows(nats.slice(0,5).map(function(x){
                    return {b:x.code, c:'#8B6FF2', n:x.n,
                            s:pc(x.v,D.pax)+'% of all passengers',
                            v:repN(x.v), u:'pax'}; })),
                  foot:'Thai / international split comes from the counts keyed on each booking · '
                      +'country breakdown uses the lead passenger’s nationality for the whole booking' })
      ])}));

  /* ── 12 · จองไว้ vs ไปจริง · วงแหวน (อัตราส่วนมีเพดาน 100%) ── */
  var lostPct=pc(D.lost,D.paxBooked);
  var dLost=repDelta(D.lost,P.lost,true);
  var namedPct=pc(D.namedBk,D.bookings);
  S.push(repSl({lv:'exec', kicker:'Delivery quality', title:'Booked versus travelled',
    sub:repN(D.paxBooked)+' seats sold in this period',
    body: repGrid('g21', [
      repCard({ t:'Rates that matter',
        body: repDonut({ pct:100-lostPct, t:'Show-up rate',
            d:'<i>'+repN(D.pax)+'</i> of <i>'+repN(D.paxBooked)+'</i> booked seats actually travelled. '
              +'The remaining '+repN(D.lost)+' were sold but never used — '
              +(dLost.dir==='flat'?'unchanged from the previous period'
                :(dLost.dir==='up'?'worse by ':'better by ')+repN(Math.abs(dLost.d))+' seats') })
          +repDonut({ pct:namedPct, t:'Bookings with passenger names',
            d:'<i>'+repN(D.namedBk)+'</i> of <i>'+repN(D.bookings)+'</i> bookings arrived with names on them. '
              +'The national park issues tickets against names, so the rest have to be filled in at the pier.',
            c:(namedPct>=80?'#6B4BEA':'#D9701F') })
          +repDonut({ pct:D.fill, t:'Seat fill rate',
            d:'<i>'+repN(D.pax)+'</i> of the <i>'+repN(D.cap)+'</i> seats put on sale were used. '
              +'The gap is capacity that sailed empty.',
            c:(D.fill>=70?'#6B4BEA':'#D9701F') }) }),
      repCard({ t:'Bookings that never sailed', sub:'cancelled before departure day',
                body: repStats([
                  {v:repN(D.cxlBk), k:'Cancelled', u:repN(D.cxlPax)+' seats', dl:repDelta(D.cxlBk,P.cxlBk,true)},
                  {v:repN(D.wxBk), k:'Weather', u:repN(D.wxPax)+' seats', dl:repDelta(D.wxBk,P.wxBk,true)}])
                  +repSec('Seats lost in total')
                  +repStats([
                    {v:repN(D.cxlPax+D.wxPax), k:'Seats cancelled outright',
                     u:pc(D.cxlPax+D.wxPax,D.paxBooked+D.cxlPax+D.wxPax)+'% of everything ever booked'},
                    {v:repN(D.lost), k:'Booked but never showed up', u:'still counted as sold'}]),
                foot:'No-shows are counted from the pier check-in screen · '
                    +'bookings cancelled outright before the travel day are the card on the left' })
    ])}));

  /* ── 13 · การเงิน ── */
  var INV=(typeof SB_INVOICES!=='undefined')?SB_INVOICES:[];
  var inv=INV.filter(function(v){ var d=String(v.issuedAt||'').slice(0,10); return d>=st.from&&d<=st.to; });
  var invTot=inv.reduce(function(a,v){return a+(+v.total||0);},0);
  var unpaid=inv.filter(function(v){ return v.status!=='paid'; });
  var unpaidTot=unpaid.reduce(function(a,v){return a+(+v.total||0);},0);
  S.push(repSl({lv:'exec', kicker:'Money', title:'Sales and invoicing',
    body: repGrid('g1', [
      repCard({ t:'Value booked in this period',
                body: repStats([
                  {v:repMoney(D.revenue), k:'Sales value', u:repN(D.bookings)+' bookings', dl:repDelta(D.revenue,P.revenue)},
                  {v:repMoney(invTot), k:'Invoiced', u:repN(inv.length)+' invoices raised'},
                  {v:repMoney(unpaidTot), k:'Still unpaid', u:repN(unpaid.length)+' invoices',
                   c:(unpaidTot>0?'#B4560A':'')}]),
                foot:'Average <b>'+repN(D.pax>0?D.revenue/D.pax:0)+' THB</b> per passenger '
                    +'· <b>'+repN(D.bookings>0?D.revenue/D.bookings:0)+' THB</b> per booking',
                footCls:(unpaidTot>0?'warn':'good') }) ])
      +repGrid('g2', [
        repCard({ t:'Sales by programme',
                  body: repBars(rows.slice(0,6).map(function(r){
                    return {n:r.n, v:Math.round(r.rev||0), disp:repMoney(r.rev||0)}; })) }),
        repCard({ t:'Revenue per passenger · by programme',
                  body: repRows(rows.slice(0,5).map(function(r){
                    return {b:ini(r.n), c:r.c, n:r.n, s:repN(r.v)+' passengers',
                            v:repN(r.v>0?(r.rev||0)/r.v:0), u:'THB / pax'}; })) })
      ])}));

  /* ── 14 · สิ่งที่ต้องตัดสินใจ ── */
  var todo=[];
  if(lostPct>5) todo.push(['bad','No-shows are running at '+lostPct+'% of seats sold',
    repN(D.lost)+' seats were paid for but never used · worth checking whether they cluster on one agent or one programme']);
  if(namedPct<80) todo.push(['warn','Only '+namedPct+'% of bookings arrive with passenger names',
    'The national park issues tickets against names · the rest have to be typed in at the pier, which risks names not matching what was paid for']);
  if(D.fill<70) todo.push(['warn','Seat fill rate is '+D.fill+'%',
    repN(D.cap-D.pax)+' seats went out empty in this period · decide whether to cut sailings or push the programmes that still have room']);
  if(D.wxBk>0) todo.push(['note',repN(D.wxBk)+' bookings cancelled for weather ('+repN(D.wxPax)+' seats)',
    'Check that every one of them has been refunded or rebooked']);
  if(!todo.length) todo.push(['good','Nothing urgent to decide for this period','Every headline figure is inside its normal range']);
  var okl=[];
  if(lostPct<=5) okl.push(['No-shows at '+lostPct+'% of seats sold', 'Inside range — 5% is the level that would need attention']);
  if(namedPct>=80) okl.push(['Passenger names on '+namedPct+'% of bookings', 'The park can issue tickets from the names already on file']);
  if(D.fill>=70) okl.push(['Seat fill rate '+D.fill+'%', 'The capacity put on sale is being used as intended']);
  if(!D.wxBk) okl.push(['No weather cancellations', 'Nothing to refund or rebook on weather grounds in this period']);
  S.push(repSl({lv:'exec', kicker:'Next', title:'What needs a decision',
    sub:repN(todo.length)+' to look at'+(okl.length?(' · '+okl.length+' checked and clear'):''),
    body:'<div class="rep-todo">'+todo.map(function(t){
      return '<div class="rep-td '+t[0]+'"><b>'+t[1]+'</b><span>'+t[2]+'</span></div>'; }).join('')
      +(okl.length?('<div class="rep-todosec">Checked and inside range</div>'
        +okl.map(function(t){
          return '<div class="rep-td ok"><b>'+t[0]+'</b><span>'+t[1]+'</span></div>'; }).join('')):'')
      +'</div>'}));

  /* สารบัญกับประโยคสรุป แทรกหลังปก · สร้างท้ายสุดเพราะต้องใช้ตัวเลขระหว่างทาง */
  S.splice(1,0,
    repAgenda({ title:'Contents',
      lead:'Operations for '+repRangeTH(st.from,st.to)
          +'. Every figure here is read straight out of the booking system — nothing is retyped.',
      items:[
        ['The period at a glance','Passengers, sailings, fill rate, sales'],
        ['Pace and daily volume','How the months and days ran'],
        ['Programme mix','What sold, what moved, and the sailing schedule'],
        ['Fleet usage','How hard each boat worked'],
        ['Channels and markets','Agents, direct sales, nationalities'],
        ['Quality and money','Booked vs travelled, sales and invoicing'] ] }),
    repQuoteSl({ tag:'Operations Report · '+repRangeTH(st.from,st.to),
      text:_repOpsHeadline(D,P,dPax,dFill),
      note:repN(D.pax)+' passengers carried on '+repN(D.tripRuns)+' sailings'
          +' · '+D.fill+'% seat fill · '+repMoney(D.revenue)+' THB in sales' }));

  return S;
}
function _repOpsHeadline(D,P,dPax,dFill){
  if(dPax.dir==='flat') return 'Passenger numbers held level with the previous period';
  var up=dPax.dir==='up';
  var t='Passengers '+(up?'rose by ':'fell by ')+'<b>'+repN(Math.abs(dPax.d))+' ('+dPax.pct+'%)</b>';
  if(dFill.dir==='dn'&&up) t+=', but seat fill <b>dropped '+dFill.pct+'%</b> — capacity was added faster than bookings came in';
  else if(dFill.dir==='up'&&!up) t+=', yet seat fill <b>improved '+dFill.pct+'%</b> — sailings were trimmed to match the work available';
  else if(dFill.dir==='up') t+=' and seat fill improved <b>'+dFill.pct+'%</b>';
  else if(dFill.dir==='dn') t+=' and seat fill weakened <b>'+dFill.pct+'%</b>';
  return t;
}

/* ── แถบควบคุม + วาดหน้า ─────────────────────────────────────────────── */
function repPreset(kind,k){
  var st=repSt(kind), t=new Date(), y=t.getFullYear(), m=t.getMonth(), f,l;
  if(k==='this'){ f=new Date(y,m,1); l=new Date(y,m+1,0); }
  else if(k==='last'){ f=new Date(y,m-1,1); l=new Date(y,m,0); }
  else if(k==='q'){ var q=Math.floor(m/3); f=new Date(y,q*3,1); l=new Date(y,q*3+3,0); }
  else if(k==='30'){ l=new Date(y,m,t.getDate()); f=new Date(l); f.setDate(f.getDate()-29); }
  else if(k==='ytd'){ f=new Date(y,0,1); l=new Date(y,m,t.getDate()); }
  st.from=repYMD(f); st.to=repYMD(l); renderReport(kind);
}
function repSetFrom(kind,v){ var st=repSt(kind); if(v){ st.from=v; if(st.to<v) st.to=v; } renderReport(kind); }
function repSetTo(kind,v){ var st=repSt(kind); if(v){ st.to=v; if(st.from>v) st.from=v; } renderReport(kind); }
function repSetMode(kind,m){ repSt(kind).mode=m; renderReport(kind); }
/* พิมพ์ · ย่อสไลด์ 1920x1080 ลงกระดาษแนวนอนหนึ่งแผ่นต่อสไลด์
   ไม่พึ่งไลบรารีนอก · เครือข่ายของบริษัทบล็อก CDN อยู่แล้ว (เจอมาตอนทำ Excel) */
function repPrint(kind){
  document.body.classList.add('rep-printing');
  var host=document.getElementById('rep-host-'+kind);
  if(host) host.classList.add('rep-print-src');
  setTimeout(function(){
    window.print();
    setTimeout(function(){ document.body.classList.remove('rep-printing');
      if(host) host.classList.remove('rep-print-src'); },400);
  },120);
}
/* เลื่อนทีละแผ่น · หาแผ่นที่อยู่กลางจอตอนนี้ก่อน แล้วขยับจากตรงนั้น */
function repStep(kind,d){
  var host=document.getElementById('rep-host-'+kind); if(!host) return;
  var sl=[].slice.call(host.querySelectorAll('.rep-sl')).filter(function(e){ return e.style.display!=='none'; });
  if(!sl.length) return;
  var mid=(window.innerHeight||900)/2, cur=0, best=1e9;
  sl.forEach(function(e,i){ var r=e.getBoundingClientRect();
    var dd=Math.abs((r.top+r.height/2)-mid); if(dd<best){ best=dd; cur=i; } });
  var n=Math.max(0,Math.min(sl.length-1,cur+d));
  sl[n].scrollIntoView({behavior:'smooth',block:'center'});
}
function repGo(kind,i){
  var host=document.getElementById('rep-host-'+kind); if(!host) return;
  var sl=host.querySelectorAll('.rep-sl'); if(!sl.length) return;
  var n=Math.max(0,Math.min(sl.length-1,i));
  sl[n].scrollIntoView({behavior:'smooth',block:'center'});
  var d=host.querySelectorAll('.rep-dot');
  d.forEach(function(x,j){ x.classList.toggle('on',j===n); });
}
/* สไลด์กว้าง 1920 คงที่ · ย่อด้วย scale ให้พอดีจอ จะได้เห็นหน้าตาจริงเป๊ะ
   ตอนพิมพ์ก็ใช้วิธีเดียวกัน ตัวเลขจึงไม่ขยับระหว่างจอกับกระดาษ */
/* §repEN1 · โหมดนำเสนอ · ซ่อนทุกอย่างรอบสไลด์แล้วย่อให้พอดีทั้งหน้าต่าง
   กด Esc หรือปุ่มมุมขวาบนเพื่อออก · ลูกศรซ้ายขวาเลื่อนสไลด์ */
function repFull(kind){
  var on=document.body.classList.toggle('rep-full');
  document.body.dataset.repFullKind=on?kind:'';
  if(on && !window._repFullKey){
    window._repFullKey=function(e){
      if(!document.body.classList.contains('rep-full')) return;
      var k=document.body.dataset.repFullKind||'ops';
      if(e.key==='Escape'){ repFull(k); e.preventDefault(); }
      else if(e.key==='ArrowRight'||e.key==='PageDown'){ repStep(k,1); e.preventDefault(); }
      else if(e.key==='ArrowLeft'||e.key==='PageUp'){ repStep(k,-1); e.preventDefault(); }
    };
    document.addEventListener('keydown',window._repFullKey);
  }
  if(on && !document.getElementById('rep-fx')){
    var b=document.createElement('button'); b.id='rep-fx'; b.textContent='✕';
    b.title='Exit presentation (Esc)';
    b.onclick=function(){ repFull(document.body.dataset.repFullKind||'ops'); };
    document.body.appendChild(b);
  }
  var x=document.getElementById('rep-fx'); if(x) x.style.display=on?'':'none';
  /* วัดหลายรอบ · แถบข้างมี transition ถ้าวัดรอบเดียวจะได้ความกว้างเก่า */
  requestAnimationFrame(function(){ repFit(kind); });
  setTimeout(function(){ repFit(kind); },90);
  setTimeout(function(){ repFit(kind); },340);
}
function repFit(kind){
  var host=document.getElementById('rep-host-'+kind); if(!host) return;
  var wrap=host.querySelector('.rep-stage'); if(!wrap) return;
  var w=wrap.clientWidth||1;
  /* พื้นที่แนวตั้งที่เหลือจริง = ความสูงหน้าต่าง ลบทุกอย่างที่อยู่เหนือเวที
     ย่อให้พอดีทั้งสองด้าน (contain) เอาค่าที่เล็กกว่า · เห็นสไลด์เต็มใบในจอเดียว */
  var full=document.body.classList.contains('rep-full');
  var top=wrap.getBoundingClientRect().top;
  /* โหมดนำเสนอไม่ต้องเผื่อขอบล่างและขอบข้าง · ใช้ทั้งหน้าต่างได้เต็ม */
  var h=Math.max(260,(window.innerHeight||900)-top-(full?0:26));
  var k=Math.min(1,(w-(full?0:8))/1920, h/1080);
  wrap.style.setProperty('--repk',k.toFixed(4));
  wrap.style.setProperty('--reph',(1080*k).toFixed(1)+'px');
}


function repCSS(){
  var H='.rep-host';
  /* ── ชุดสี ──────────────────────────────────────────────────────────────
     พื้นเทาอ่อนอมฟ้า · การ์ดสีใกล้พื้นมาก แล้วดันขึ้นมาด้วยเงาคู่
     เงาสว่างอยู่บนซ้าย เงาเข้มอยู่ล่างขวา เหมือนมีไฟส่องจากมุมบนซ้าย   */
  var GND='#E8EBF1';
  var CARD='linear-gradient(145deg,#EFF1F6 0%,#E2E5ED 100%)';
  var SHD='-9px -9px 20px rgba(255,255,255,.95), 12px 14px 30px rgba(155,164,186,.42)';
  var SHDS='-5px -5px 12px rgba(255,255,255,.9), 6px 8px 18px rgba(155,164,186,.34)';
  var INSET='inset 3px 3px 7px rgba(155,164,186,.45), inset -3px -3px 7px rgba(255,255,255,.95)';
  var INK='#1C1D22', MUT='#7C8291', FNT='#A5AAB8';
  var PUR='#6B4BEA', PURL='#A78BFA';
  var PG='linear-gradient(150deg,#6B4BEA 0%,#8B6FF2 46%,#C3B2FB 100%)';   /* ตัวเลขใหญ่ */
  var PBTN='linear-gradient(135deg,#7C5CF2 0%,#5B37D8 100%)';
  /* ลูกกลม · วาดเป็นวงกลมจริงด้วย svg ฝังในไฟล์
     ใช้ radial-gradient ไม่ได้ เพราะมันวัดรัศมีจากมุมไกลสุดของกล่อง
     วงเลยล้นกล่องแล้วโดนตัดเป็นสี่เหลี่ยมมุมมน */
  var SPH="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'"
    +"%3E%3Cdefs%3E%3CradialGradient id='s' cx='34%25' cy='28%25' r='76%25'%3E"
    +"%3Cstop offset='0' stop-color='%23ffffff'/%3E"
    +"%3Cstop offset='0.42' stop-color='%23f3f5fa'/%3E"
    +"%3Cstop offset='1' stop-color='%23dbe0eb'/%3E%3C/radialGradient%3E%3C/defs%3E"
    +"%3Ccircle cx='50' cy='50' r='50' fill='url(%23s)'/%3E%3C/svg%3E\")";
  /* Poppins คือฟอนต์เรขาคณิตชุดเดียวกับที่เทมเพลตใช้
     Noto Sans Thai ตามหลังไว้เผื่อมีคำไทยหลงเหลือ (ชื่อเรือ ชื่อของ ชื่อผู้ขาย) */
  var FONT="'Poppins','Noto Sans Thai',-apple-system,system-ui,sans-serif";

  return H+'{position:relative;isolation:isolate;background:'+GND+';margin:-22px;padding:10px 10px 14px;'
     +'min-height:calc(100vh - 44px);font-family:'+FONT+'}'
  +'@media(max-width:820px){'+H+'{margin:-12px -10px;padding:8px}}'

  /* ══ แถบควบคุมด้านบน · นูนขึ้นมาจากพื้นเหมือนการ์ด ══════════════════ */
  +H+' .rep-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-radius:18px;'
     +'padding:11px 16px;margin-bottom:9px;background:'+CARD+';box-shadow:'+SHDS+'}'
  +H+' .rep-tl h1{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0;color:'+INK+'}'
  +H+' .rep-tl p{font-size:10.5px;color:'+MUT+';margin:2px 0 0;font-weight:600}'
  +H+' .rep-tr{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}'
  +H+' .rep-dates{display:flex;align-items:center;gap:7px;border-radius:12px;padding:6px 12px;'
     +'background:'+GND+';box-shadow:'+INSET+'}'
  +H+" .rep-dates input{border:0;background:none;font:700 12px 'DM Mono',monospace;color:"+INK+';outline:none}'
  +H+' .rep-dates span{font-size:10.5px;color:'+MUT+';font-weight:700}'
  +H+' .rep-psets{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}'
  +H+' .rep-ps{background:'+CARD+';border:0;border-radius:999px;padding:6px 13px;'
     +'font:700 10.5px inherit;color:'+MUT+';cursor:pointer;box-shadow:'+SHDS+';transition:all .14s}'
  +H+' .rep-ps:hover{color:'+PUR+'}'
  +H+' .rep-ps:active{box-shadow:'+INSET+'}'
  +H+' .rep-top .sp{flex:1}'
  +H+' .rep-top>.rep-dates,'+H+' .rep-top>.rep-psets{flex:none}'
  +H+' .rep-bar2{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;padding:0 4px}'
  /* ── โหมดนำเสนอ · เหลือแต่สไลด์ ── */
  +'body.rep-full .sidebar,body.rep-full .topbar,body.rep-full #la-userbadge,'
   +'body.rep-full #la-viewonly,body.rep-full '+H+' .rep-top{display:none !important}'
  +'body.rep-full .main{margin:0 !important;padding:0 !important;max-width:none !important}'
  +'body.rep-full '+H+'{margin:0;padding:0;min-height:100vh}'
  +'body.rep-full '+H+' .rep-stage{gap:0}'
  +'body.rep-full '+H+' .rep-sl{border-radius:0;box-shadow:none}'
  +'#rep-fx{position:fixed;top:16px;right:18px;z-index:9999;width:38px;height:38px;border:0;'
   +'border-radius:12px;background:'+CARD+';box-shadow:'+SHDS+';color:'+MUT+';font-size:16px;'
   +"cursor:pointer;font-family:'Poppins',sans-serif;display:none}"
  +'body.rep-full #rep-fx{display:block}'

  /* ══ เลย์เอาต์ · แผนงานเป็นแถว (หน้า The Roadmap) ═════════════════ */
  +H+' .rep-rm{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;'
     +'padding:10px 6px 0}'
  +H+' .rep-rmh{display:grid;gap:34px;align-items:end}'
  +H+' .rep-rmi{display:flex;flex-direction:column;gap:20px}'
  +H+' .rep-rmi .qb{width:118px;height:118px;border-radius:28px;background:'+PBTN+';color:#fff;'
     +'display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:700;'
     +'box-shadow:0 16px 32px rgba(91,55,216,.32);letter-spacing:-.02em}'
  +H+' .rep-rmi .qt{font-size:36px;font-weight:800;letter-spacing:-.03em;line-height:1.14;color:'+INK+'}'
  +H+' .rep-rmi .qv{font-size:56px;font-weight:800;letter-spacing:-.045em;line-height:1;'
     +'background:'+PG+';-webkit-background-clip:text;background-clip:text;'
     +'-webkit-text-fill-color:transparent;margin-top:-6px}'
  +H+' .rep-rmline{height:2.5px;border-radius:2px;background:rgba(255,255,255,.95);margin:38px 0 0;'
     +'box-shadow:0 1px 3px rgba(155,164,186,.5)}'
  +H+' .rep-rmb{display:grid;gap:34px;margin-top:30px}'
  +H+' .rep-rmd{font-size:20px;line-height:1.62;color:'+MUT+';font-weight:600;position:relative;'
     +'padding-left:32px}'
  +H+" .rep-rmd::before{content:'';position:absolute;left:0;top:-26px;width:14px;height:44px;"
     +'border-left:2.5px solid rgba(255,255,255,.95);border-bottom:2.5px solid rgba(255,255,255,.95);'
     +'border-bottom-left-radius:12px}'
  +H+' .rep-rmd b{color:'+INK+';font-weight:800}'

  /* ══ เลย์เอาต์ · วงแหวนเปอร์เซ็นต์ (หน้า KPI Dashboard) ═══════════ */
  +H+' .rep-dn{display:flex;align-items:center;gap:34px;padding:20px 0}'
  +H+' .rep-dn+'+H+' .rep-dn{border-top:1.5px solid rgba(255,255,255,.9)}'
  +H+' .rep-dnr{flex:none;width:150px;height:150px;position:relative}'
  +H+' .rep-dnr svg{width:100%;height:100%;transform:rotate(-90deg)}'
  +H+' .rep-dnr span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
     +'font-size:31px;font-weight:800;letter-spacing:-.03em;color:'+INK+'}'
  +H+' .rep-dnt{flex:1;min-width:0}'
  +H+' .rep-dnt b{display:block;font-size:29px;font-weight:800;letter-spacing:-.03em;color:'+INK+'}'
  +H+' .rep-dnt span{display:block;font-size:18px;line-height:1.55;color:'+MUT+';font-weight:600;'
     +'margin-top:9px}'
  +H+' .rep-dnt span i{font-style:normal;color:'+PUR+';font-weight:800}'

  /* ══ เลย์เอาต์ · ตัวเลขใหญ่พร้อมย่อหน้า (หน้า Our Objective) ═══════ */
  +H+' .rep-bp{flex:1;display:grid;gap:38px 56px;align-content:center;min-height:0;padding:6px 4px}'
  +H+' .rep-bpi{display:flex;gap:30px;align-items:flex-start}'
  +H+' .rep-bpi .pv{flex:none;min-width:190px;font-size:86px;font-weight:800;letter-spacing:-.055em;'
     +'line-height:.92;background:'+PG+';-webkit-background-clip:text;background-clip:text;'
     +'-webkit-text-fill-color:transparent}'
  +H+' .rep-bpi .pt{flex:1;min-width:0;padding-top:8px}'
  +H+' .rep-bpi .pt b{display:block;font-size:31px;font-weight:800;letter-spacing:-.03em;color:'+INK+'}'
  +H+' .rep-bpi .pt span{display:block;font-size:18.5px;line-height:1.6;color:'+MUT+';'
     +'font-weight:600;margin-top:11px}'
  +H+' .rep-bpi .pt span b{display:inline;font-size:inherit;color:'+PUR+'}'

  /* ══ เลย์เอาต์ · การ์ดเลขลำดับเรียงกัน (หน้า Strategic Initiatives) ═ */
  +H+' .rep-nc{flex:1;display:grid;gap:24px;align-items:stretch;min-height:0;padding:4px 2px}'
  +H+' .rep-nci{background:'+CARD+';border-radius:30px;box-shadow:'+SHD+';padding:38px 32px;'
     +'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;'
     +'gap:14px;min-height:0}'
  +H+' .rep-nci .nv{font-size:78px;font-weight:800;letter-spacing:-.06em;line-height:.9;'
     +'background:'+PG+';-webkit-background-clip:text;background-clip:text;'
     +'-webkit-text-fill-color:transparent}'
  +H+' .rep-nci .nt{font-size:26px;font-weight:800;letter-spacing:-.025em;line-height:1.24;color:'+INK+'}'
  +H+' .rep-nci .ns{font-size:16px;line-height:1.5;color:'+MUT+';font-weight:600}'

  /* ══ เลย์เอาต์ · สี่มุมรอบลูกกลม (หน้า SWOT) ══════════════════════ */
  +H+' .rep-ob{flex:1;position:relative;display:grid;grid-template-columns:1fr auto 1fr;'
     +'grid-template-rows:1fr 1fr;gap:26px 40px;align-items:center;min-height:0;padding:6px 0}'
  +H+' .rep-obc{grid-column:2;grid-row:1 / span 2;width:330px;height:330px;border-radius:50%;'
     +'background:radial-gradient(circle at 34% 28%,#fff 0%,#f2f4fa 42%,#dbe0eb 100%);'
     +'box-shadow:16px 20px 44px rgba(150,160,182,.4);align-self:center;justify-self:center;'
     +'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}'
  +H+' .rep-obc b{font-size:62px;font-weight:800;letter-spacing:-.05em;line-height:1;'
     +'background:'+PG+';-webkit-background-clip:text;background-clip:text;'
     +'-webkit-text-fill-color:transparent}'
  +H+' .rep-obc span{font-size:17px;font-weight:700;color:'+MUT+'}'
  +H+' .rep-obi{max-width:430px}'
  +H+' .rep-obi.r{text-align:right;justify-self:end}'
  +H+' .rep-obi .oh{display:flex;align-items:center;gap:16px;margin-bottom:12px}'
  +H+' .rep-obi.r .oh{flex-direction:row-reverse}'
  +H+' .rep-obi .ok{width:64px;height:64px;border-radius:50%;flex:none;display:flex;'
     +'align-items:center;justify-content:center;font-size:22px;font-weight:800;'
     +'background:'+GND+';color:'+MUT+';box-shadow:'+INSET+'}'
  +H+' .rep-obi .ok.s{font-size:13px;letter-spacing:.05em}'
  +H+' .rep-obi.hot .ok{background:'+PBTN+';color:#fff;box-shadow:0 10px 22px rgba(91,55,216,.34)}'
  +H+' .rep-obi .on{font-size:27px;font-weight:800;letter-spacing:-.03em;color:'+INK+'}'
  +H+' .rep-obi .od{font-size:17.5px;line-height:1.6;color:'+MUT+';font-weight:600}'
  +H+' .rep-modes{display:flex;border-radius:999px;padding:4px;background:'+GND+';box-shadow:'+INSET+'}'
  +H+' .rep-md{background:none;border:0;padding:5px 15px;cursor:pointer;font-family:inherit;border-radius:999px;'
     +'display:flex;align-items:baseline;gap:6px;line-height:1.2}'
  +H+' .rep-md b{font-size:11.5px;font-weight:800;color:'+MUT+'}'
  +H+' .rep-md i{font-style:normal;font-size:9px;color:'+FNT+';font-weight:600}'
  +H+' .rep-md.on{background:'+CARD+';box-shadow:'+SHDS+'}'
  +H+' .rep-md.on b{color:'+PUR+'}'+H+' .rep-md.on i{color:'+MUT+'}'
  +H+' .rep-meta{font-size:10.5px;color:'+MUT+';font-weight:600}'
  +H+' .rep-bar2 .sp{flex:1}'
  +H+" .rep-cnt{font:800 10.5px 'DM Mono',monospace;color:"+MUT+';background:'+GND+';'
     +'border-radius:999px;padding:4px 11px;box-shadow:'+INSET+'}'
  +H+' .rep-nav{display:flex;gap:6px}'
  +H+' .rep-nb{width:30px;height:30px;border:0;background:'+CARD+';box-shadow:'+SHDS+';'
     +'border-radius:10px;color:'+MUT+';font-size:15px;cursor:pointer;font-family:inherit;line-height:1;'
     +'display:flex;align-items:center;justify-content:center}'
  +H+' .rep-nb:hover{color:'+PUR+'}'+H+' .rep-nb:active{box-shadow:'+INSET+'}'
  +H+' .rep-pr{background:'+PBTN+';color:#fff;border:0;border-radius:999px;padding:8px 17px;'
     +'font:800 11.5px inherit;cursor:pointer;box-shadow:0 6px 16px rgba(91,55,216,.34)}'

  /* ══ สไลด์ · พื้นเทาอ่อน + ลูกกลม + เส้นโค้ง ═══════════════════════════ */
  +H+' .rep-stage{--repk:1;display:flex;flex-direction:column;align-items:center;gap:16px;'
     +'scroll-snap-type:y mandatory}'
  +H+' .rep-sl{width:1920px;height:1080px;flex:none;padding:56px 64px 60px;box-sizing:border-box;'
     +'position:relative;overflow:hidden;display:flex;flex-direction:column;scroll-snap-align:center;'
     +'border-radius:20px;background:'+GND+';box-shadow:0 20px 48px rgba(120,130,155,.30);'
     +'color:'+INK+';transform:scale(var(--repk));transform-origin:top center;'
     +'margin-bottom:calc((var(--repk) - 1) * 1080px)}'
  /* ลูกกลมสี่ใบ · สลับตำแหน่งตามลำดับสไลด์ จะได้ไม่ซ้ำกันทุกแผ่น */
  +H+" .rep-sl::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;"
     +'background-repeat:no-repeat;background-image:'+SPH+','+SPH+','+SPH+','+SPH+';'
     +'background-size:210px 210px,120px 120px,290px 290px,86px 86px;'
     +'background-position:-70px 44%,93% 7%,105% 86%,74% 97%;'
     +'filter:drop-shadow(12px 16px 26px rgba(150,160,182,.34))}'
  +H+' .rep-sl:nth-of-type(3n+2)::before{background-size:150px 150px,250px 250px,110px 110px,190px 190px;'
     +'background-position:104% 22%,-90px 88%,88% 62%,46% -70px}'
  +H+' .rep-sl:nth-of-type(3n)::before{background-size:260px 260px,96px 96px,170px 170px,130px 130px;'
     +'background-position:96% -80px,12% 96%,-60px 26%,80% 92%}'
  /* เส้นโค้งบาง ๆ · วงกลมใหญ่ที่โผล่มาแค่ส่วนโค้ง */
  +H+" .rep-sl::after{content:'';position:absolute;width:1720px;height:1720px;border-radius:50%;"
     +'border:1.6px solid rgba(255,255,255,.9);left:-330px;top:-560px;z-index:0;pointer-events:none}'
  +H+' .rep-sl:nth-of-type(2n)::after{left:auto;right:-420px;top:auto;bottom:-660px}'
  +H+' .rep-sl>*{position:relative;z-index:1}'

  /* ── หัวสไลด์ ── */
  +H+' .rep-shd{display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap;'
     +'padding:0 4px 22px;margin-bottom:20px;flex:none}'
  +H+' .rep-shd .n{display:block;font-size:14px;font-weight:800;letter-spacing:.24em;'
     +'text-transform:uppercase;color:'+FNT+';margin-bottom:10px}'
  +H+' .rep-shd h2{font-size:52px;font-weight:800;letter-spacing:-.035em;margin:0;line-height:1.02;'
     +'color:'+INK+'}'
  +H+' .rep-shd .s{margin-left:auto;font-size:18px;color:'+MUT+';font-weight:700;padding-bottom:8px;'
     +'text-align:right}'
  +H+' .rep-bd{position:relative;flex:1;display:flex;flex-direction:column;gap:20px;min-height:0}'

  /* ── กริดการ์ด ── */
  +H+' .rep-grid{display:grid;gap:20px;flex:1;min-height:0}'
  +H+' .rep-grid.g1{grid-template-columns:minmax(0,1fr)}'
  +H+' .rep-grid.g2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}'
  +H+' .rep-grid.g21{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}'
  +H+' .rep-bd>.rep-grid.g1:first-child:not(:only-child){flex:0 0 auto}'

  /* ── การ์ด · นูนขึ้นจากพื้น ── */
  +H+' .rep-c{background:'+CARD+';border-radius:26px;box-shadow:'+SHD+';'
     +'display:flex;flex-direction:column;min-height:0;overflow:hidden}'
  +H+' .rep-cth{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:26px 32px 12px;flex:none}'
  +H+' .rep-cth .big{font-size:27px;font-weight:800;letter-spacing:-.025em;color:'+INK+'}'
  +H+' .rep-cth .sm{font-size:15px;color:'+FNT+';font-weight:700}'
  +H+' .rep-cth .sp{margin-left:auto}'
  +H+' .rep-pill{background:'+GND+';color:'+MUT+';border-radius:999px;padding:7px 16px;'
     +'font:800 15px inherit;white-space:nowrap;box-shadow:'+INSET+'}'
  +H+' .rep-pill.ok{color:#0F7A5A}'
  +H+' .rep-pill.warn{color:#B4560A}'
  +H+' .rep-cbd{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 32px 10px;'
     +'overflow:hidden}'
  +H+' .rep-cfoot{flex:none;margin:0;padding:18px 32px;font-size:19px;line-height:1.5;font-weight:700;'
     +'color:'+MUT+';background:rgba(255,255,255,.46);border-top:1.5px solid rgba(255,255,255,.9)}'
  +H+' .rep-cfoot b{color:'+PUR+';font-weight:800}'
  +H+' .rep-cfoot.good{color:#15705A}'+H+' .rep-cfoot.good b{color:#0F7A5A}'
  +H+' .rep-cfoot.bad{color:#8C2626}'+H+' .rep-cfoot.bad b{color:#A32D2D}'
  +H+' .rep-cfoot.warn{color:#7A4A00}'+H+' .rep-cfoot.warn b{color:#B4560A}'
  +H+' .rep-cnote{font-size:15px;color:'+FNT+';line-height:1.55;font-weight:600;padding:10px 0 4px}'

  /* ── แถวตัวเลขใหญ่ · ไล่สีม่วง ── */
  +H+' .rep-avrow{display:flex;align-items:stretch;padding:14px 0 22px;flex:none}'
  +H+' .rep-av{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;'
     +'padding:0 16px;text-align:center}'
  +H+' .rep-av .v{font-size:68px;font-weight:800;line-height:1.0;letter-spacing:-.045em;'
     +'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
     +'background:'+PG+';-webkit-background-clip:text;background-clip:text;'
     +'-webkit-text-fill-color:transparent;color:transparent;padding:2px 0}'
  /* ช่องที่กำหนดสีมาเอง (เช่นสีเตือน) ต้องยกเลิกการไล่สี ไม่งั้นสีที่สั่งจะไม่ขึ้น */
  +H+' .rep-av .v.sol{background:none;-webkit-text-fill-color:currentColor}'
  +H+' .rep-av .v.txt{font-size:36px;letter-spacing:-.02em}'
  +H+' .rep-av .k{font-size:17px;color:'+INK+';font-weight:800;margin-top:6px}'
  +H+' .rep-av .u{font-size:14px;color:'+FNT+';font-weight:600}'
  +H+' .rep-av .dl{font:800 14px inherit;border-radius:999px;padding:4px 12px;margin-top:8px;'
     +'background:'+GND+';box-shadow:'+INSET+'}'
  +H+' .rep-av .dl.good{color:#0F7A5A}'
  +H+' .rep-av .dl.bad{color:#A32D2D}'
  +H+' .rep-av .dl.flat{color:'+MUT+'}'
  +H+' .rep-avs{width:1.5px;margin:14px 0;border-radius:2px;'
     +'background:linear-gradient(180deg,rgba(155,164,186,0),rgba(155,164,186,.40),rgba(155,164,186,0))}'

  /* ── หัวข้อย่อยในการ์ด ── */
  +H+' .rep-csec{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;'
     +'color:'+FNT+';padding:14px 0 8px;margin-top:2px;flex:none;'
     +'border-top:1.5px solid rgba(255,255,255,.9)}'

  /* ── รายการย่อย ── */
  +H+' .rep-rows{display:flex;flex-direction:column;flex:1;min-height:0;justify-content:space-evenly}'
  /* §repEN5 · มีแถวเดียวไม่ต้องยืดเต็มการ์ด ช่องว่างจะถ่างจนดูเหมือนหน้าพัง */
  +H+' .rep-rows:has(>.rep-row:only-child){flex:none;justify-content:flex-start}'
  /* การ์ดวงแหวน · จัดกลางแนวตั้งเมื่อมีไม่กี่วง */
  +H+' .rep-cbd:has(>.rep-dn){justify-content:center}'
  +H+' .rep-row{display:flex;align-items:center;gap:16px;padding:9px 0}'
  +H+' .rep-row .pm{width:46px;height:46px;border-radius:14px;color:#fff;display:flex;'
     +'align-items:center;justify-content:center;font:800 15px inherit;flex:none;'
     +'box-shadow:4px 6px 14px rgba(120,130,155,.34)}'
  +H+' .rep-row .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}'
  +H+' .rep-row .tx .n{font-size:21px;font-weight:800;color:'+INK+';letter-spacing:-.015em;'
     +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .rep-row .tx .s{font-size:14.5px;color:'+FNT+';font-weight:600;white-space:nowrap;'
     +'overflow:hidden;text-overflow:ellipsis}'
  +H+' .rep-row .rt{flex:none;text-align:right}'
  +H+' .rep-row .rt b{display:block;font-size:27px;font-weight:800;line-height:1.1;'
     +'letter-spacing:-.03em;color:'+PUR+'}'
  +H+' .rep-row .rt i{display:block;font-style:normal;font-size:13.5px;color:'+FNT+';font-weight:600}'

  /* ── แท่งเทียบ · รางเป็นร่องจม แท่งนูนขึ้น ── */
  +H+' .rep-bars{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;'
     +'justify-content:space-evenly;padding:6px 0 10px}'
  +H+' .rep-bar{display:flex;align-items:center;gap:16px;flex:0 1 auto;min-height:34px}'
  +H+' .rep-bar .nm{width:32%;flex:none;font-size:18px;font-weight:700;color:'+INK+';'
     +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +H+' .rep-bar .tr{flex:1;height:26px;background:'+GND+';border-radius:999px;box-shadow:'+INSET+'}'
  +H+' .rep-bar .tr i{display:block;height:100%;border-radius:999px;min-width:26px}'
  +H+' .rep-bar .vv{width:110px;flex:none;text-align:right;font:800 21px inherit;'
     +'letter-spacing:-.02em;color:'+INK+'}'
  +H+' .rep-bar .xx{width:76px;flex:none;text-align:right;font:700 14px inherit;color:'+FNT+'}'

  /* ── จังหวะรายวันในสัปดาห์ · แท่งตั้ง ── */
  +H+' .rep-wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:16px;flex:none;'
     +'height:138px;padding:0 0 4px}'
  +H+' .rep-wkc{display:grid;grid-template-rows:auto 1fr auto auto;align-items:end;'
     +'justify-items:center;gap:7px;min-width:0}'
  +H+' .rep-wkc{gap:5px}'
  +H+' .rep-wkc .v{font-size:18px;font-weight:800;letter-spacing:-.02em;color:'+INK+'}'
  +H+' .rep-wkc .b{width:100%;align-self:end;border-radius:10px 10px 5px 5px;background:'+PBTN+';'
     +'box-shadow:0 7px 16px rgba(91,55,216,.24)}'
  +H+' .rep-wkc .n{font-size:15px;font-weight:800;color:'+MUT+'}'
  +H+' .rep-wkc .s{font-size:12px;font-weight:600;color:'+FNT+';margin-top:-3px}'

  /* ── กราฟรายวัน ── */
  +H+' .rep-trend{flex:1;display:flex;flex-direction:column;min-height:0;padding:8px 0 12px}'
  +H+' .rep-trend svg{width:100%;flex:1;min-height:180px;display:block}'

  /* ── ตาราง ── */
  +H+' .rep-tb{width:100%;border-collapse:collapse;font-size:19px;flex:none;align-self:stretch}'
  +H+' .rep-tb th{text-align:left;font-size:12.5px;font-weight:800;color:'+FNT+';letter-spacing:.14em;'
     +'text-transform:uppercase;padding:6px 14px 12px}'
  +H+' .rep-tb th.n,'+H+' .rep-tb td.n{text-align:right}'
  +H+' .rep-tb td{padding:13px 14px;border-top:1.5px solid rgba(255,255,255,.9);font-weight:700;'
     +'color:'+INK+'}'
  +H+' .rep-tb td.n{font-weight:800;letter-spacing:-.02em;color:'+MUT+'}'
  +H+' .rep-cbd:has(>.rep-tb){justify-content:flex-start}'

  /* ══ ปก · วงแหวนซ้อนกลางหน้า ═══════════════════════════════════════ */
  +H+' .rep-sl.cover{padding:0;align-items:center;justify-content:center}'
  +H+' .rep-sl.cover::after{display:none}'
  +H+' .rep-cvw{position:relative;width:100%;height:100%;display:flex;align-items:center;'
     +'justify-content:center}'
  +H+" .rep-cvw::before,"+H+" .rep-cvw::after{content:'';position:absolute;border-radius:50%;"
     +'border:1.6px solid rgba(255,255,255,.9);left:50%;top:50%;transform:translate(-50%,-50%)}'
  +H+' .rep-cvw::before{width:1080px;height:1080px}'
  +H+' .rep-cvw::after{width:1560px;height:1560px}'
  +H+' .rep-cv{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;'
     +'text-align:center;gap:0}'
  +H+' .rep-brand{display:flex;align-items:center;gap:13px;margin-bottom:44px}'
  +H+' .rep-brand span{font-size:27px;font-weight:800;letter-spacing:-.02em;color:'+INK+'}'
  +H+' .rep-cv h1{font-size:132px;font-weight:800;letter-spacing:-.05em;margin:0;line-height:.94;'
     +'color:'+INK+'}'
  +H+' .rep-cv .lb{font-size:22px;font-weight:700;color:'+MUT+';margin-top:56px}'
  +H+' .rep-cv .rg{margin-top:14px;background:'+PBTN+';color:#fff;border-radius:999px;'
     +'padding:15px 44px;font-size:26px;font-weight:800;letter-spacing:-.01em;'
     +'box-shadow:0 14px 30px rgba(91,55,216,.34)}'
  +H+' .rep-cv .mt{font-size:17px;color:'+FNT+';font-weight:600;margin-top:22px}'

  /* ══ สารบัญ ══════════════════════════════════════════════════════════ */
  +H+' .rep-ag{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.6fr);gap:56px;flex:1;'
     +'min-height:0;align-items:center}'
  +H+' .rep-agl{display:flex;flex-direction:column;justify-content:center;height:100%}'
  +H+' .rep-agl p{font-size:19px;line-height:1.62;color:'+MUT+';font-weight:600;margin:26px 0 0}'
  +H+' .rep-agl h2{font-size:76px;font-weight:800;letter-spacing:-.05em;line-height:.98;'
     +'margin:auto 0 0;color:'+INK+'}'
  +H+' .rep-agg{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-content:center}'
  +H+' .rep-agc{display:flex;align-items:center;gap:22px;background:'+CARD+';border-radius:26px;'
     +'padding:26px 30px;box-shadow:'+SHD+';min-height:132px}'
  +H+' .rep-agc .nn{font-size:62px;font-weight:800;letter-spacing:-.06em;line-height:1;flex:none;'
     +'background:'+PG+';-webkit-background-clip:text;background-clip:text;'
     +'-webkit-text-fill-color:transparent}'
  +H+' .rep-agc .nn em{font-style:normal;-webkit-text-fill-color:'+PUR+'}'
  +H+' .rep-agc .tt{font-size:25px;font-weight:800;letter-spacing:-.025em;line-height:1.24;color:'+INK+'}'
  +H+' .rep-agc .tt i{display:block;font-style:normal;font-size:15px;font-weight:600;'
     +'color:'+FNT+';margin-top:5px;letter-spacing:0}'

  /* ══ ประโยคสรุปใหญ่ · แบบหน้า mission ══════════════════════════════ */
  +H+' .rep-qw{flex:1;display:flex;flex-direction:column;min-height:0}'
  +H+' .rep-qw .rep-brand{margin-bottom:0;align-self:flex-start}'
  +H+' .rep-quote{flex:1;display:flex;flex-direction:column;align-items:center;'
     +'justify-content:center;padding:10px 0;min-height:0}'
  +H+' .rep-quote .qm{font-size:86px;line-height:.6;font-weight:800;color:'+PUR+';'
     +'margin-top:26px;letter-spacing:-.06em}'
  +H+' .rep-qf{display:none}'
  +H+' .qf{display:flex;align-items:center;gap:18px;justify-content:flex-end;flex:none;padding-top:6px}'
  +H+' .qf i{display:block;width:62px;height:2.5px;border-radius:2px;background:'+PUR+'}'
  +H+' .qf span{font-size:19px;font-weight:700;color:'+MUT+'}'
  +H+' .rep-quote .q{background:'+CARD+';border-radius:40px;box-shadow:'+SHD+';padding:80px 96px;'
     +'font-size:54px;font-weight:800;letter-spacing:-.035em;line-height:1.34;text-align:center;'
     +'color:'+INK+';max-width:1620px}'
  +H+' .rep-quote .q b{color:'+PUR+';font-weight:800}'
  +H+' .rep-quote .q u{display:block;text-decoration:none;font-size:21px;font-weight:600;'
     +'color:'+MUT+';letter-spacing:0;margin-top:30px;line-height:1.5}'

  /* ══ สิ่งที่ต้องตัดสินใจ ═════════════════════════════════════════════ */
  +H+' .rep-todo{display:flex;flex-direction:column;gap:18px;flex:1;min-height:0;'
     +'justify-content:space-evenly;overflow:hidden}'
  /* §repEN8 · หกใบขึ้นไปต้องบีบ ไม่งั้นใบสุดท้ายตกขอบล่าง */
  +H+' .rep-todo:has(>.rep-td:nth-child(6)){gap:13px}'
  +H+' .rep-todo:has(>.rep-td:nth-child(6)) .rep-td{min-height:0;padding:19px 30px}'
  +H+' .rep-todo:has(>.rep-td:nth-child(6)) .rep-td b{font-size:25px}'
  +H+' .rep-todo:has(>.rep-td:nth-child(6)) .rep-td span{font-size:16px;margin-top:7px}'
  +H+' .rep-td{flex:0 1 auto;min-height:112px;max-height:210px;display:flex;flex-direction:column;'
     +'justify-content:center;background:'+CARD+';border-radius:24px;padding:26px 34px;'
     +'box-shadow:'+SHD+';position:relative;overflow:hidden}'
  +H+" .rep-td::before{content:'';position:absolute;left:0;top:22px;bottom:22px;width:7px;"
     +'border-radius:0 999px 999px 0;background:'+PUR+'}'
  +H+' .rep-td b{display:block;font-size:29px;font-weight:800;color:'+INK+';letter-spacing:-.03em}'
  +H+' .rep-td span{display:block;font-size:17.5px;color:'+MUT+';margin-top:9px;line-height:1.5;'
     +'font-weight:600}'
  +H+' .rep-td.bad::before{background:#C0392B}'
  +H+' .rep-td.warn::before{background:#D9701F}'
  +H+' .rep-td.good::before{background:#12876A}'
  +H+' .rep-todosec{font:800 13px/1 inherit;letter-spacing:.18em;text-transform:uppercase;'
     +'color:'+FNT+';margin:8px 0 -4px;padding-left:2px}'
  +H+' .rep-td.ok{min-height:0;padding:18px 34px;box-shadow:'+SHDS+'}'
  +H+' .rep-td.ok::before{background:rgba(155,164,186,.5)}'
  +H+' .rep-td.ok b{font-size:22px;font-weight:700;color:'+MUT+'}'
  +H+' .rep-td.ok span{font-size:15.5px;margin-top:5px;color:'+FNT+'}'

  +H+' .rep-say{background:'+GND+';border-radius:18px;box-shadow:'+INSET+';padding:20px 26px;'
     +'font-size:19px;line-height:1.5;color:'+MUT+';font-weight:700}'
  +H+' .rep-say b{color:'+PUR+';font-weight:800}'
  +H+' .rep-say.warn{color:#8A5A0B}'
  +H+' .rep-err{padding:120px 0;text-align:center;font-size:30px;font-weight:800;color:'+INK+'}'
  +H+' .rep-err span{display:block;font-size:17px;font-weight:600;color:'+MUT+';margin-top:12px}'
  +H+' .rep-pg{position:absolute;right:44px;bottom:30px;font:800 15px inherit;'
     +'color:'+FNT+';z-index:2}'
  +H+' .rep-sl.cover .rep-pg{display:none}'

  /* ══ พิมพ์ ══ */
  +'@media print{'
    +'@page{size:A4 landscape;margin:0}'
    +'body.rep-printing .sidebar,body.rep-printing .topbar,body.rep-printing #la-userbadge,'
    +'body.rep-printing #la-viewonly,body.rep-printing .rep-top,body.rep-printing .rep-bar2{display:none !important}'
    +'body.rep-printing .main{margin:0 !important;padding:0 !important}'
    +'body.rep-printing '+H+'{margin:0;padding:0;background:#fff;min-height:0}'
    +'body.rep-printing '+H+' .rep-stage{gap:0;--repk:0.5843;scroll-snap-type:none}'
    +'body.rep-printing '+H+' .rep-sl{transform-origin:top left;border-radius:0;box-shadow:none;'
      +'margin:0;page-break-after:always;break-after:page;'
      +'-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'body.rep-printing '+H+' .rep-sl:last-child{page-break-after:auto;break-after:auto}'
  +'}';
}


/* ── เก็บตัวเลขฝั่งเรือ ────────────────────────────────────────────────────
   ตรวจความครบของข้อมูลไปด้วยในรอบเดียว · รายงานฝ่ายเรือมีรูโหว่หลายจุด
   ถ้าไม่บอกว่าตัวเลขคิดจากกี่รายการ คนอ่านจะเข้าใจว่าเป็นยอดทั้งหมด          */
function repFleetGather(from,to){
  var MT=(typeof FL_MAINT!=='undefined')?FL_MAINT:[];
  var IN=(typeof FL_INCIDENTS!=='undefined')?FL_INCIDENTS:[];
  var PJ=(typeof FL_PROJECTS!=='undefined')?FL_PROJECTS:[];
  var MO=(typeof FL_MEMOS!=='undefined')?FL_MEMOS:[];
  var SF=(typeof FL_SAFETY!=='undefined')?FL_SAFETY:[];
  var IV=(typeof FL_INVENTORY!=='undefined')?FL_INVENTORY:[];
  var EN=(typeof FL_ENGINES!=='undefined')?FL_ENGINES:[];
  var DL=(typeof FL_DAILY!=='undefined')?FL_DAILY:{};
  var BO=(typeof BOATS!=='undefined')?BOATS:[];
  var days=repDays(from,to), nD=days.length, inR=function(d){ return d&&d>=from&&d<=to; };
  var O={ nDays:nD, boats:BO.length,
          inc:0, incBy:{}, incSev:{}, incOpen:0,
          mjOpen:0, mjDone:0, mjCost:0, mjCostN:0, mjDays:[], mjOpenList:[], downBy:{}, downTot:0,
          pjActive:0, pjDone:0, pjLate:0, pjList:[],
          memoN:0, memoAmt:0, memoPend:0, memoPendAmt:0, memoBySup:{}, memoByType:{},
          engHrs:{}, engTot:0,
          invZero:0, invLow:0, invHave:0, invVal:0, invOut:[],
          gaps:[] };

  /* เหตุการณ์ */
  IN.forEach(function(x){
    if(!inR(String(x.date||'').slice(0,10))) return;
    O.inc++;
    var sv=String(x.severity||'—');
    O.incSev[sv]=(O.incSev[sv]||0)+1;
    var bid=x.boatId||'—'; O.incBy[bid]=(O.incBy[bid]||0)+1;
    if(['open','inprogress'].indexOf(String(x.status))>=0) O.incOpen++;
  });

  /* งานซ่อม · วันจอดคิดจากช่วงที่ทับกับช่วงรายงานเท่านั้น
     งานที่เริ่มก่อนช่วงและยังไม่จบ ต้องนับเฉพาะวันที่อยู่ในช่วง ไม่ใช่ทั้งงาน */
  MT.forEach(function(m){
    var a=String(m.startDate||'').slice(0,10), b=String(m.endDate||'').slice(0,10)||to;
    if(!a) return;
    if(a>to || b<from) return;
    if(inR(a)){ if(String(m.status)==='done') O.mjDone++; else O.mjOpen++; }
    /* §repLayout6 · เก็บใบที่ยังไม่ปิดไว้ทั้งหมด (ไม่ใช่เฉพาะที่เปิดในช่วง)
       เพราะใบที่เปิดค้างมาก่อนช่วงคือใบที่ค้างนานที่สุด ซึ่งเป็นใบที่ต้องรู้ */
    if(String(m.status)!=='done'){
      var _ag=Math.round((repParse(to)-repParse(a))/86400000)+1;
      var _bo=(typeof getBoat==='function')?getBoat(m.boatId):null;
      O.mjOpenList.push({ nm:String(m.title||m.no||m.type||'งานซ่อม'),
        bt:(_bo&&_bo.name)||m.boatId||'', age:_ag, st:a, so:String(m.status||'') });
    }
    if((+m.cost||0)>0 && inR(a)){ O.mjCost+=(+m.cost||0); O.mjCostN++; }
    if(m.startDate && m.endDate){
      var dd=Math.round((repParse(b)-repParse(a))/86400000)+1;
      if(inR(a)) O.mjDays.push(dd);
    }
  });
  /* ── วันที่เรือออกงานไม่ได้ ───────────────────────────────────────────
     ห้ามนับจากช่วงวันของใบงานซ่อม · ใบส่วนใหญ่ไม่เคยถูกปิด (21 จาก 24 ไม่มีวันจบ
     มีใบเปิดค้างตั้งแต่ปลายปีก่อน) และใบซ้ำของลำเดียวกันจะถูกนับทับกันอีกชั้น
     ใช้ getCurStatus(เรือ, วัน) ตัวเดียวกับที่ Dashboard ใช้ตัดสิน "พร้อม/ไม่พร้อม"
     ไล่ทีละลำทีละวัน · นับซ้ำไม่ได้โดยธรรมชาติ และตอบตรงกับหน้าอื่นเสมอ */
  var _act=BO.filter(function(b){ return b && !b.retired; });
  O.boatsAll=_act.length;
  /* ลำที่ "ไม่ว่างเลยสักวัน" ทั้งช่วง = จอดทิ้ง/เลิกใช้ แต่ยังไม่ถูกทำเครื่องหมายปลดระวาง
     ถ้าเอามาหารรวมด้วย อัตราพร้อมใช้จะเพี้ยนไปทั้งกอง (วัดได้ 25% ทั้งที่ลำที่ใช้จริง ~95%)
     จึงคิดเฉพาะลำที่ยังมีวันพร้อมใช้อยู่บ้าง · ลำที่เหลือยกไปเป็นข้อสังเกตเรื่องข้อมูล */
  var _av={}, _idle=[];
  _act.forEach(function(bt){
    var n=0;
    days.forEach(function(ds){
      var stt=null;
      try{ stt=(typeof getCurStatus==='function')?getCurStatus(bt,ds):null; }catch(_){}
      if(String((stt&&stt.s)||'available')==='available') n++;
    });
    _av[bt.id]=n;
    if(n===0) _idle.push(bt);
  });
  O.idleBoats=_idle.length;
  O.idleNames=_idle.map(function(b){ return b.name||b.id; });
  var _use=_act.filter(function(b){ return _av[b.id]>0; });
  O.boats=_use.length;
  _use.forEach(function(bt){
    var dn=nD-_av[bt.id];
    if(dn>0){ O.downBy[bt.id]=dn; O.downTot+=dn; }
  });
  O.mjAvgDays = O.mjDays.length ? Math.round(O.mjDays.reduce(function(a,b){return a+b;},0)/O.mjDays.length) : 0;
  O.avail = (O.boats*nD>0) ? Math.max(0,Math.round((1-O.downTot/(O.boats*nD))*100)) : 0;

  /* โครงการ · ไม่มีงบตั้งไว้เลยสักโครงการ จึงดูที่ "ตรงแผนไหม" แทน */
  PJ.forEach(function(p){
    var a=String(p.actualFrom||p.planFrom||'').slice(0,10);
    var e=String(p.planTo||'').slice(0,10);
    if(!a) return;
    if(a>to) return;
    if(e && e<from && String(p.status)==='completed') return;
    var late=0;
    if(e && String(p.status)!=='completed' && e<to) late=Math.round((repParse(to)-repParse(e))/86400000);
    if(String(p.status)==='completed') O.pjDone++; else O.pjActive++;
    if(late>0) O.pjLate++;
    O.pjList.push({name:p.name||p.no||'-', boatId:p.boatId, type:p.type||'-',
                   status:p.status, planTo:e, late:late});
  });

  /* จัดซื้อ */
  MO.forEach(function(m){
    var d=String(m.createdDate||'').slice(0,10); if(!inR(d)) return;
    if(String(m.status)==='cancelled') return;
    var amt=+(m.afterDiscount||m.amount||0)||0;
    O.memoN++; O.memoAmt+=amt;
    if(String(m.status)==='pending_approval'){ O.memoPend++; O.memoPendAmt+=amt; }
    var sup=String(m.supplier||'—'); O.memoBySup[sup]=(O.memoBySup[sup]||0)+amt;
    var ty=String(m.memoType||'—'); O.memoByType[ty]=(O.memoByType[ty]||0)+amt;
  });

  /* ── ชั่วโมงเดินเครื่อง ────────────────────────────────────────────────
     ค่าใน FL_DAILY เป็น "เลขไมล์ชั่วโมง" ที่อ่านจากหน้าปัด (2,231 → 5,907)
     ไม่ใช่ชั่วโมงที่เดินในวันนั้น · เอามาบวกกันทุกวันจะได้เลขหลักล้าน
     ชั่วโมงที่เดินจริงในช่วง = ค่าอ่านครั้งสุดท้าย ลบ ค่าอ่านครั้งแรก ของเครื่องนั้น */
  var _rd={};
  days.forEach(function(ds){
    var day=DL[ds]; if(!day) return;
    Object.keys(day).forEach(function(bid){
      var tr=(day[bid]||{}).trips||{};
      Object.keys(tr).forEach(function(mode){
        var eg=(tr[mode]||{}).engines||{};
        Object.keys(eg).forEach(function(eid){
          var h=+eg[eid]||0; if(!h) return;
          var k=bid+'|'+eid, r=_rd[k];
          if(!r) _rd[k]={bid:bid, lo:h, hi:h, n:1};
          else { if(h<r.lo) r.lo=h; if(h>r.hi) r.hi=h; r.n++; }
        });
      });
    });
  });
  O.engReads=0;
  Object.keys(_rd).forEach(function(k){
    var r=_rd[k]; O.engReads+=r.n;
    var run=Math.max(0, r.hi-r.lo);      /* อ่านครั้งเดียวในช่วง = บอกไม่ได้ว่าเดินเท่าไร = 0 */
    if(run>0){ O.engHrs[r.bid]=(O.engHrs[r.bid]||0)+run; O.engTot+=run; }
  });

  /* อะไหล่ · ค่าขั้นต่ำถูกตั้งไว้ 5 เท่ากันหมด ไม่ใช่จุดสั่งซื้อจริงรายชิ้น
     ตัวเลขที่มีความหมายจริงคือ "เหลือศูนย์" ไม่ใช่ "ต่ำกว่าขั้นต่ำ" */
  var minSet={};
  IV.forEach(function(i){
    var q=+(i.totalQty!=null?i.totalQty:i.qty)||0, mn=+i.minQty||0;
    if(q<=0){ O.invZero++;
      /* §repSkin7 · "เหลือ 0 อยู่กี่รายการ" ยังสั่งของไม่ได้ ต้องรู้ว่าเป็นของอะไร
         เรียงตามราคาทุนต่อชิ้น · ของแพงที่ขาดคือของที่ทำให้งานซ่อมค้าง */
      var _IC={engine:'เครื่องยนต์', gearbox:'เกียร์', propeller:'ใบจักร',
               hull:'ตัวเรือ', general:'ทั่วไป'};
      O.invOut.push({ n:String(i.name||i.partNo||'—'),
        cat:(_IC[i.category]||String(i.category||'—')), cost:(+i.cost||0),
        loc:String(i.primaryLocation||i.location||'') });
    }
    if(mn>0){ O.invHave++; minSet[mn]=(minSet[mn]||0)+1; if(q<mn) O.invLow++; }
    O.invVal+=q*(+i.cost||0);
  });
  O.invMinUniform = (Object.keys(minSet).length===1) ? Object.keys(minSet)[0] : '';
  O.invN=IV.length;

  /* ความครบของข้อมูล · เอาไปทำสไลด์ตรง ๆ ไม่ซ่อน */
  var mjInR=MT.filter(function(m){ return inR(String(m.startDate||'').slice(0,10)); }).length;
  if(mjInR>0 && O.mjCostN<mjInR)
    O.gaps.push(['warn','Repair cost was entered on '+O.mjCostN+' of '+mjInR+' jobs',
      'The repair figure on the earlier slide is therefore what was recorded, not what was actually spent']);
  if(PJ.length && !PJ.some(function(p){ return (+p.plannedBudget||0)>0; }))
    O.gaps.push(['warn','Not one of the '+PJ.length+' projects has a budget set',
      'Planned versus actual spend cannot be compared · the report can only show whether the schedule held']);
  var pmDef=SF.filter(function(x){ return String(x.nextPM||'')==='2026-01-01'; }).length;
  if(pmDef>0)
    O.gaps.push(['warn',pmDef+' of '+SF.length+' safety items still carry the default 1 Jan inspection date',
      'No real inspection cycle has been set per item, so nothing can tell us which ones are actually due']);
  var cl=(typeof FL_CONSUMABLE_LOGS!=='undefined')?FL_CONSUMABLE_LOGS.length:0;
  if(cl<10)
    O.gaps.push(['bad','Only '+cl+' fuel and consumable issue'+(cl===1?' has':'s have')+' been logged',
      'Fuel cost per sailing or per seat cannot be worked out at all — one of the figures worth having most']);
  if(O.idleBoats>0)
    O.gaps.push(['bad',O.idleBoats+' of '+O.boatsAll+' boats were never available on a single day',
      'These look like boats that have been retired or laid up but never marked as such · '
      +'this report excludes them from the availability figure, otherwise the whole fleet number is distorted ('
      +O.idleNames.slice(0,5).join(' · ')+(O.idleNames.length>5?(' and '+(O.idleNames.length-5)+' more'):'')+')']);
  if(O.invMinUniform)
    O.gaps.push(['note','Minimum stock is set to '+O.invMinUniform+' on every item alike',
      'That is the default, not a real reorder point · do not read “below minimum” as genuinely short']);
  return O;
}


/* ══ สไลด์ฝ่ายเรือ · ใช้ชิ้นส่วนและโครงการ์ดชุดเดียวกับฝั่งปฏิบัติการ ══ */
function repFleetSlides(st){
  var D=repFleetGather(st.from, st.to);
  var pv=repPrevRange(st.from, st.to);
  var P=repFleetGather(pv.from, pv.to);
  var nDay=repDayCount(st.from, st.to);
  var S=[];
  var bn=function(id){ var b=(typeof getBoat==='function')?getBoat(id):null; return (b&&b.name)||id||'—'; };
  var ini=function(t){ return String(t||'').trim().slice(0,2).toUpperCase(); };
  var pc=function(a,b){ return b>0?Math.round(a/b*100):0; };
  var SEV={critical:'Critical', major:'Major', high:'High', medium:'Medium', low:'Minor'};
  var SEVC={critical:'#C0392B', major:'#D9701F', high:'#D89C2B', medium:'#3E7FB0', low:'#8a857d'};

  /* ── 1 · ปก ── */
  S.push(repCover({ title:'Fleet<br>Report',
    label:'Reporting period', range:repRangeTH(st.from,st.to),
    meta:nDay+' days · compared with '+repRangeTH(pv.from,pv.to) }));

  /* ── 2 · สรุปหน้าเดียว ── */
  var dw=Object.keys(D.downBy).map(function(id){
    return {id:id, n:bn(id), v:D.downBy[id], c:'#C0392B',
      x:pc(nDay-D.downBy[id],nDay)+'%'}; }).sort(function(a,b){return b.v-a.v;});
  var sv=Object.keys(D.incSev).map(function(k){
    return {k:k, n:SEV[k]||k, v:D.incSev[k], c:SEVC[k]||'#8a857d'}; }).sort(function(a,b){return b.v-a.v;});
  S.push(repSl({lv:'exec', kicker:'Overview', title:'The period at a glance',
    sub:repE(repRangeTH(st.from,st.to))+'<br>vs '+repE(repRangeTH(pv.from,pv.to))+' · same '+nDay+' days',
    body: repGrid('g1', [
      repCard({ t:'Headline figures', pill:D.boats+' boats in service',
        body: repStats([
          {v:D.avail+'%', k:'Average availability', u:D.boats+' boats × '+nDay+' days',
           dl:repDelta(D.avail,P.avail), c:(D.avail>=90?'':(D.avail>=80?'#B4560A':'#A32D2D'))},
          {v:repN(D.downTot), k:'Boat-days out of service',
           u:(D.mjAvgDays?('a job takes '+D.mjAvgDays+' days on average'):''), dl:repDelta(D.downTot,P.downTot,true)},
          {v:repN(D.inc), k:'Incidents logged',
           u:(D.incOpen?(D.incOpen+' still open'):'all closed'), dl:repDelta(D.inc,P.inc,true)},
          {v:repMoney(D.mjCost+D.memoAmt), k:'Total spend',
           u:'repairs '+repMoney(D.mjCost)+' · purchasing '+repMoney(D.memoAmt),
           dl:repDelta(D.mjCost+D.memoAmt,P.mjCost+P.memoAmt,true)}]),
        foot:'Boats were ready to sail <b>'+D.avail+'%</b> of the time · '
            +(D.downTot>0?('<b>'+repN(D.downTot)+' boat-days</b> were lost to repairs'):'no days were lost to repairs'),
        footCls:(D.avail>=90?'good':(D.avail>=80?'warn':'bad')) }) ])
      +repGrid('g2', [
        repCard({ t:'Days out of service', pill:(dw.length?dw.length+' boats':'none'), pillCls:(dw.length?'warn':'ok'),
                  body: dw.length?repBars(dw,{sem:1}):'<div class="rep-say">No boat was out of service in this period</div>' }),
        repCard({ t:'Incidents by severity', pill:repN(D.inc)+' logged',
                  body: sv.length?repBars(sv,{sem:1}):'<div class="rep-say">No incidents in this period</div>' })
      ])}));

  /* ── 3 · ความพร้อม · วงแหวน (อัตราส่วนมีเพดาน 100%) ── */
  var topDown=dw[0]||{};
  S.push(repSl({lv:'exec', kicker:'Readiness', title:'Which boats could sail',
    sub:'from the '+D.boats+' boats actually in service',
    body: repGrid('g21', [
      repCard({ t:'Availability',
        body: repDonut({ pct:D.avail, t:'Ready to sail', c:(D.avail>=90?'#6B4BEA':'#D9701F'),
            d:'Counted boat by boat, day by day, from the same status the Dashboard uses — '
              +'not from the date range on repair jobs, because most of those were never closed.' })
          +repDonut({ pct:pc(D.boats,D.boatsAll||D.boats), t:'Of the registered fleet in use',
            disp:D.boats+' / '+(D.boatsAll||D.boats),
            d:(D.idleBoats
               ? ('<i>'+repN(D.idleBoats)+'</i> registered boats were never available on a single day. '
                  +'They are excluded here, otherwise the whole fleet figure is distorted.')
               : 'Every registered boat was available at least once in this period.'),
            c:(D.idleBoats?'#D9701F':'#6B4BEA') }) }),
      repCard({ t:'Longest out of service', pill:(dw.length?dw.length+' boats':'none'),
                body: (dw.length?repRows(dw.slice(0,5).map(function(x){
                      return {b:ini(x.n), c:'#C0392B', n:x.n, s:x.x+' of days available',
                              v:repN(x.v), u:'days'}; }))
                    :'<div class="rep-say good">No boat was out of service at any point</div>'),
                foot:(topDown.n?('<b>'+repE(topDown.n)+'</b> lost the most time — '
                     +repN(topDown.v)+' of '+nDay+' days'):''), footCls:'warn' })
    ])}));

  /* ── 4 · เหตุการณ์ · สี่มุมรอบลูกกลม (สี่กลุ่มที่ไม่มีลำดับ) ── */
  var ib=Object.keys(D.incBy).map(function(id){ return {n:bn(id), v:D.incBy[id], c:'#D9701F'}; })
    .sort(function(a,b){return b.v-a.v;});
  var dInc=repDelta(D.inc,P.inc,true);
  var sevN=function(k){ return D.incSev[k]||0; };
  var hard=sevN('critical')+sevN('major');
  S.push(repSl({lv:'exec', kicker:'Risk', title:'What went wrong',
    sub:repN(D.inc)+' incidents logged in this period',
    body: repOrbit({ cv:repN(D.inc), ck:'incidents logged',
      items:[
        {k:'SEV', t:'Serious or worse', hot:(hard>0),
         d:'<b>'+repN(hard)+' incidents</b> — '+pc(hard,D.inc)+'% of everything logged '
           +'reached major or critical severity'},
        {k:'OPEN', t:'Still open', hot:(D.incOpen>0),
         d:(D.incOpen
            ? ('<b>'+repN(D.incOpen)+' incidents</b> have not been closed out yet — '
               +'worth checking whether they are waiting on parts, on a technician, or on approval')
            : 'Every incident logged in this period has been closed out')},
        {k:'FLEET', t:'Boats affected',
         d:'<b>'+repN(ib.length)+' boats</b> logged at least one incident'
           +(ib[0]?(' · <b>'+repE(ib[0].n)+'</b> the most, with '+repN(ib[0].v)):'')},
        {k:'TREND', t:'Versus previous period',
         d:(dInc.dir==='flat' ? 'Level with the previous period'
            : ('<b>'+(dInc.dir==='up'?'Up ':'Down ')+repN(Math.abs(dInc.d))+' incidents</b> '
               +'compared with '+repE(repRangeTH(pv.from,pv.to))))}
      ]})}));
  S.push(repSl({kicker:'Risk', title:'Incidents in detail',
    body: repGrid('g2', [
        repCard({ t:'By severity',
                  body: sv.length?repBars(sv,{sem:1}):'<div class="rep-say good">No incidents in this period</div>' }),
        repCard({ t:'By boat', pill:ib.length+' boats',
                  body: ib.length?repRows(ib.slice(0,5).map(function(x){
                    return {b:ini(x.n), c:'#D9701F', n:x.n, s:'incidents in this period', v:repN(x.v), u:'logged'}; }))
                    :'<div class="rep-cnote">No incidents in this period</div>' })
      ])}));

  /* ── 5 · งานซ่อม · ตัวเลขใหญ่ + ย่อหน้า ── */
  var _mjO=(D.mjOpenList||[]).slice().sort(function(a,b){ return b.age-a.age; });
  S.push(repSl({lv:'exec', kicker:'Maintenance', title:'Opened and closed',
    sub:repN(D.mjDone)+' jobs closed in this period',
    body: repBigPct([
      { v:repN(D.mjDone), t:'Jobs closed in this period',
        d:'Against <b>'+repN(D.mjOpen)+'</b> newly opened. '
          +'A job takes <b>'+(D.mjAvgDays||'—')+' days</b> on average from opening to closing.' },
      { v:repN(_mjO.length), t:'Job cards still open',
        d:(_mjO.length
           ? ('Including work carried over from before this period. The oldest is <b>'+repE(_mjO[0].nm)
              +'</b> on '+repE(_mjO[0].bt||'—')+', open for <b>'+repN(_mjO[0].age)+' days</b>. '
              +'If the work is finished but the card was never closed, the out-of-service figure is wrong too.')
           : 'Nothing is left open.') },
      { v:repMoney(D.mjCost), t:'Repair cost recorded',
        d:'Taken from the <b>'+D.mjCostN+' jobs</b> that actually had a cost entered. '
          +'Jobs left blank are not counted, so the real figure is higher than this.' }
    ], 1)}));
  S.push(repSl({kicker:'Maintenance', title:'Jobs open the longest',
    sub:repN(_mjO.length)+' job cards still open',
    body: repGrid('g1', [
      repCard({ t:'Oldest open job cards', pill:repN(_mjO.length)+' open',
        body: _mjO.length
          ? repTable(['Job','Boat','Opened','Open for'],
              _mjO.slice(0,7).map(function(j){
                return [repE(j.nm), repE(j.bt||'—'), repDateTH(j.st), repN(j.age)+' days']; }))
          : '<div class="rep-say good">No job cards are left open</div>',
        foot:(_mjO.length
          ? ('The '+repN(D.mjOpen)+' shown as newly opened counts only cards raised inside this period · '
             +'this table also includes cards carried over from before it')
          : ''),
        footCls:(_mjO.length&&_mjO[0].age>120?'warn':'') }) ])}));

  /* ── 6 · ชั่วโมงเครื่องยนต์ · แท่ง + สรุป ── */
  var eh=Object.keys(D.engHrs).map(function(id){
    return {n:bn(id), v:Math.round(D.engHrs[id]), c:'#7C5CF2',
      x:(nDay?(Math.round(D.engHrs[id]/nDay*10)/10)+' h/day':'')}; }).sort(function(a,b){return b.v-a.v;});
  S.push(repSl({kicker:'Utilisation', title:'Engine hours run',
    sub:repN(D.engTot)+' hours across the period',
    body: repGrid('g21', [
      repCard({ t:'By boat', pill:eh.length+' boats',
                body: eh.length?repBars(eh):'<div class="rep-say warn">No engine hours were logged in this period</div>',
                foot:'Taken from the hour-meter readings on the daily sheets — last reading minus first. '
                    +'An engine read only once in the period cannot tell us how far it ran.' }),
      repCard({ t:'Summary',
                body: repStats([{v:repN(D.engTot), k:'Total hours', u:'all boats combined'}])
                  +repSec('Hardest running engines')
                  +(eh.length?repRows(eh.slice(0,5).map(function(x){
                     return {b:ini(x.n), c:'#7C5CF2', n:x.n, s:x.x, v:repN(x.v), u:'hrs'}; }))
                    :'<div class="rep-cnote">Nothing logged in this period</div>') })
    ])}));

  /* ── 7 · โครงการ ── */
  var pj=D.pjList.slice().sort(function(a,b){ return b.late-a.late; });
  S.push(repSl({lv:'exec', kicker:'Projects', title:'Bigger work in progress',
    body: repGrid('g1', [
      repCard({ t:'Project status',
                body: repStats([
                  {v:repN(D.pjActive), k:'In progress', u:'during this period'},
                  {v:repN(D.pjDone), k:'Completed', u:'during this period'},
                  {v:repN(D.pjLate), k:'Behind plan', u:'past the planned finish date',
                   c:(D.pjLate?'#A32D2D':'')}]) }) ])
      +repGrid('g1', [
      repCard({ t:'Detail', pill:pj.length+' projects',
                body: pj.length?repTable(['Project','Boat','Type','Status','Behind'],
                  pj.slice(0,7).map(function(p){ return [repE(p.name), repE(bn(p.boatId)), repE(p.type),
                    (p.status==='completed'?'Completed':'In progress'),
                    (p.late>0?('<b style="color:#A32D2D">'+p.late+' days</b>'):'on plan')]; }))
                  :'<div class="rep-say">No projects overlap this period</div>',
                foot:'No project has a budget set in the system, so planned versus actual spend cannot be shown · '
                    +'only whether the schedule held', footCls:'warn' }) ])}));

  /* ── 8 · อะไหล่ ── */
  var _iv=(D.invOut||[]).slice().sort(function(a,b){ return b.cost-a.cost; });
  S.push(repSl({kicker:'Parts', title:'What the store has run out of',
    body: repGrid('g1', [
      repCard({ t:'Stock position', pill:repN(D.invN)+' line items',
                body: repStats([
                  {v:repN(D.invZero), k:'Items at zero', u:'of '+repN(D.invN)+' line items',
                   c:(D.invZero>D.invN*0.3?'#A32D2D':'')},
                  {v:repN(D.invN-D.invZero), k:'Items in stock',
                   u:pc(D.invN-D.invZero,D.invN)+'% of all line items'},
                  {v:repMoney(D.invVal), k:'Value on hand', u:'at recorded unit cost'}]),
                foot:(D.invMinUniform?('Minimum levels are set to '+D.invMinUniform+' on every single item, '
                  +'which is the default rather than a real reorder point · '
                  +'this slide therefore counts <b>“at zero”</b> instead of “below minimum”'):''), footCls:'warn' }) ])
      +repGrid('g1', [
        repCard({ t:'Items at zero · most expensive first', pill:repN(_iv.length)+' items',
          body: _iv.length
            ? repTable(['Item','Category','Store','Unit cost'],
                _iv.slice(0,6).map(function(x){
                  return [repE(x.n), repE(x.cat), repE(x.loc||'—'),
                          x.cost>0?repMoney(x.cost):'—']; }))
            : '<div class="rep-say good">Nothing is at zero right now</div>',
          foot:(_iv.length>6?('Showing 6 of '+repN(_iv.length)+' items at zero · the rest are on the parts page'):'') }) ])}));

  /* ── 9 · จัดซื้อ · การ์ดเลขสี่ใบ ── */
  var sup=Object.keys(D.memoBySup).map(function(k){ return {n:k, v:D.memoBySup[k], c:'#6B4BEA',
      disp:repMoney(D.memoBySup[k])}; }).sort(function(a,b){return b.v-a.v;});
  var TY={parts:'Parts', labor:'Labour'};
  var tys=Object.keys(D.memoByType).map(function(k){ return {n:TY[k]||k, v:D.memoByType[k],
      disp:repMoney(D.memoByType[k])}; }).sort(function(a,b){return b.v-a.v;});
  S.push(repSl({lv:'exec', kicker:'Spend', title:'What was bought',
    sub:repN(D.memoN)+' purchase requests raised in this period',
    body: repNumCards([
        {v:repMoney(D.memoAmt), t:'Requested in total',
         s:repN(D.memoN)+' purchase requests<br>'
           +(D.memoAmt===P.memoAmt?'no change'
             :((D.memoAmt>P.memoAmt?'+':'−')+repMoney(Math.abs(D.memoAmt-P.memoAmt))))+' vs previous period'},
        {v:repN(D.memoPend), t:'Waiting for approval',
         s:repMoney(D.memoPendAmt)+' THB held up<br>'+(D.memoPend?'may be what is holding repairs':'nothing held up')},
        {v:(tys[0]?pc(tys[0].v,D.memoAmt)+'%':'—'), t:(tys[0]?('Spent on '+tys[0].n.toLowerCase()):'—'),
         s:(tys[0]?(repMoney(tys[0].v)+' THB of '+repMoney(D.memoAmt)):'')},
        {v:(sup[0]?pc(sup[0].v,D.memoAmt)+'%':'—'), t:'Largest supplier',
         s:(sup[0]?(repE(sup[0].n)+'<br>'+repMoney(sup[0].v)+' THB'):'')}
      ])}));
  S.push(repSl({kicker:'Spend', title:'Purchasing in detail',
    body: repGrid('g2', [
        repCard({ t:'By category',
                  body: tys.length?repBars(tys):'<div class="rep-cnote">No purchase requests in this period</div>' }),
        repCard({ t:'Top 5 suppliers',
                  body: sup.length?repRows(sup.slice(0,5).map(function(x){
                    return {b:ini(x.n), c:'#6B4BEA', n:x.n, s:'total in this period',
                            v:repMoney(x.v), u:'THB'}; }))
                    :'<div class="rep-cnote">No purchase requests in this period</div>' })
      ])}));

  /* ── 10 · ความครบของข้อมูล ── */
  S.push(repSl({kicker:'Data quality', title:'Where the data is thin',
    sub:'this report is only as accurate as what was recorded',
    body: D.gaps.length?('<div class="rep-todo">'+D.gaps.map(function(g){
        return '<div class="rep-td '+g[0]+'"><b>'+repE(g[1])+'</b><span>'+repE(g[2])+'</span></div>'; }).join('')+'</div>')
      :repGrid('g1',[repCard({t:'Complete', body:'<div class="rep-say good">Every field this report needs was filled in</div>'})])}));

  /* ── 11 · สิ่งที่ต้องตัดสินใจ ── */
  var todo=[];
  if(D.incOpen>0) todo.push(['bad',repN(D.incOpen)+' incidents are still open',
    'Worth checking whether each one is waiting on a part, on a technician, or on an approval']);
  if(D.idleBoats>0) todo.push(['bad',repN(D.idleBoats)+' boats sat unavailable for the whole period',
    'If they are retired they should be marked as such · if they are still meant to sail, we need to know what is holding them. As it stands they distort every fleet-wide figure']);
  if(D.pjLate>0) todo.push(['warn',repN(D.pjLate)+' projects are behind plan',
    'Check whether the schedule slipped or the plan was never realistic']);
  if(D.memoPend>0) todo.push(['note',repN(D.memoPend)+' purchase requests are waiting for approval ('+repMoney(D.memoPendAmt)+' THB)',
    'Parts waiting on a signature may be what is holding repair work']);
  if(D.avail<90) todo.push(['warn','Average availability is '+D.avail+'%',
    repN(D.downTot)+' boat-days were lost · worth separating planned dockings from breakdowns']);
  if(!todo.length) todo.push(['good','Nothing urgent to decide for this period','Every headline figure is inside its normal range']);
  S.push(repSl({lv:'exec', kicker:'Next', title:'What needs a decision',
    sub:repN(todo.length)+' to look at',
    body:'<div class="rep-todo">'+todo.map(function(t){
      return '<div class="rep-td '+t[0]+'"><b>'+t[1]+'</b><span>'+t[2]+'</span></div>'; }).join('')+'</div>'}));

  S.splice(1,0,
    repAgenda({ title:'Contents',
      lead:'Fleet operations for '+repRangeTH(st.from,st.to)
          +'. Availability is measured with the same boat status the Dashboard uses, day by day.',
      items:[
        ['Readiness','Which boats could sail, and for how long'],
        ['What went wrong','Incidents by severity and by boat'],
        ['Maintenance','Jobs opened, closed, and left open'],
        ['Engine hours','Hours run, taken from meter readings'],
        ['Projects and parts','Bigger work, and what the store ran out of'],
        ['Spend and data quality','Purchasing, and where the numbers are thin'] ] }),
    repQuoteSl({ tag:'Fleet Report · '+repRangeTH(st.from,st.to),
      text:_repFleetHeadline(D,P,nDay),
      note:repN(D.boats)+' boats in service · '+repN(D.mjDone)+' maintenance jobs closed'
          +' · '+repN(D.inc)+' incidents logged · '+repN(D.engTot)+' engine hours run' }));

  return S;
}
function _repFleetHeadline(D,P,nDay){
  var t='The <b>'+repN(D.boats)+' boats</b> actually in service were ready to sail <b>'+D.avail+'%</b> '
       +'of the time in this period';
  if(D.idleBoats>0)
    t+=', but <b>'+repN(D.idleBoats)+' more</b> sat marked unavailable throughout — '
      +'if they are retired they should be marked as such, otherwise every fleet-wide figure is distorted';
  else if(D.downTot>0)
    t+=', losing <b>'+repN(D.downTot)+' boat-days</b> to repairs';
  return t;
}
