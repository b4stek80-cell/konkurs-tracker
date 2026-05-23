// ═══════════════════════════════════════════════════════════
// CALENDAR — calShift, calToday, renderCalendar, calDayClick
// ═══════════════════════════════════════════════════════════

function calShift(delta){
  let m=calMonth.m+delta, y=calMonth.y;
  if(m<0){m=11;y--;} if(m>11){m=0;y++;}
  window.calMonth={y,m};
  render();
}
function calToday(){
  const d=new Date();
  window.calMonth={y:d.getFullYear(),m:d.getMonth()};
  render();
}

function renderCalendar(){
  const {y,m}=calMonth;
  const monthNames=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const first=new Date(y,m,1);
  let startDow=first.getDay(); startDow=startDow===0?6:startDow-1; // pon=0
  const daysInMonth=new Date(y,m+1,0).getDate();
  const todayS=ktTodayStr();

  // Zbierz wydarzenia: deadline zgłoszeń i wyników
  const events={}; // 'YYYY-MM-DD' -> [{type,contest}]
  S.contests.forEach(ct=>{
    if(ct.deadline){
      (events[ct.deadline]=events[ct.deadline]||[]).push({type:'deadline',contest:ct});
    }
    if(ct.results_date){
      (events[ct.results_date]=events[ct.results_date]||[]).push({type:'results',contest:ct});
    }
  });

  // Buduj siatkę
  let cells='';
  for(let i=0;i<startDow;i++) cells+='<div></div>';
  for(let day=1;day<=daysInMonth;day++){
    const ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    const evs=events[ds]||[];
    const isToday=ds===todayS;
    const dl=evs.filter(e=>e.type==='deadline');
    const rs=evs.filter(e=>e.type==='results');
    let dots='';
    if(dl.length) dots+=`<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;margin:1px"></span>`;
    if(rs.length) dots+=`<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#8b5cf6;margin:1px"></span>`;
    cells+=`<div onclick="calDayClick('${ds}')" style="aspect-ratio:1;border:1px solid ${isToday?'#6366f1':'#1e2a3a'};border-radius:8px;padding:4px;cursor:${evs.length?'pointer':'default'};background:${isToday?'#6366f111':evs.length?'#131929':'transparent'};display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px">
      <span style="font-size:13px;color:${isToday?'#818cf8':evs.length?'#f1f5f9':'#475569'};font-weight:${isToday?700:400}">${day}</span>
      <div style="display:flex;flex-wrap:wrap;justify-content:center">${dots}</div>
    </div>`;
  }

  // Lista wydarzeń tego miesiąca
  const monthEvents=[];
  Object.keys(events).sort().forEach(ds=>{
    if(ds.startsWith(y+'-'+String(m+1).padStart(2,'0'))){
      events[ds].forEach(e=>monthEvents.push({date:ds,...e}));
    }
  });

  const eventList=monthEvents.length===0
    ? '<p style="color:#475569;text-align:center;padding:24px 0;font-size:13px">Brak wydarzeń w tym miesiącu</p>'
    : monthEvents.map(e=>{
        const ag=S.agencies.find(a=>a.id===e.contest.agencyId);
        const isDeadline=e.type==='deadline';
        const col=isDeadline?'#ef4444':'#8b5cf6';
        const icon=isDeadline?'⏰':'🏆';
        const label=isDeadline?'Termin zgłoszeń':'Ogłoszenie wyników';
        const dd=parseInt(e.date.slice(8,10));
        return `<div onclick="setTab('contests')" style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #1e2a3a;cursor:pointer">
          <div style="flex-shrink:0;width:38px;height:38px;border-radius:8px;background:${col}18;border:1px solid ${col}44;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-size:14px;font-weight:700;color:${col};line-height:1">${dd}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:#f1f5f9;font-weight:600">${esc(e.contest.name)}</div>
            <div style="font-size:11px;color:#64748b">${icon} ${label} · ${esc(ag?.name||'—')}</div>
          </div>
        </div>`;
      }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="font-size:22px;font-weight:800;color:#f1f5f9;margin:0">📅 Kalendarz</h1>
      <button onclick="calToday()" class="btn-sec btn-sm">Dziś</button>
    </div>

    <div style="background:#131929;border:1px solid #1e2a3a;border-radius:12px;padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <button onclick="calShift(-1)" style="background:#1e2a3a;border:none;border-radius:8px;width:34px;height:34px;color:#94a3b8;cursor:pointer;font-size:16px">‹</button>
        <span style="font-weight:700;color:#f1f5f9;font-size:15px">${monthNames[m]} ${y}</span>
        <button onclick="calShift(1)" style="background:#1e2a3a;border:none;border-radius:8px;width:34px;height:34px;color:#94a3b8;cursor:pointer;font-size:16px">›</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
        ${['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d=>`<div style="text-align:center;font-size:11px;color:#475569;font-weight:600">${d}</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${cells}
      </div>
      <div style="display:flex;gap:14px;margin-top:12px;font-size:11px;color:#64748b">
        <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444"></span> Termin zgłoszeń</span>
        <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#8b5cf6"></span> Wyniki</span>
      </div>
    </div>

    <div style="font-weight:700;color:#f1f5f9;margin-bottom:8px;font-size:14px">Wydarzenia — ${monthNames[m]} ${y}</div>
    <div style="background:#131929;border:1px solid #1e2a3a;border-radius:12px;padding:6px 14px">
      ${eventList}
    </div>`;
}

function calDayClick(ds){
  const evs=[];
  S.contests.forEach(ct=>{
    if(ct.deadline===ds) evs.push({type:'deadline',contest:ct});
    if(ct.results_date===ds) evs.push({type:'results',contest:ct});
  });
  if(!evs.length) return;
  const html=evs.map(e=>{
    const ag=S.agencies.find(a=>a.id===e.contest.agencyId);
    const isDeadline=e.type==='deadline';
    const col=isDeadline?'#ef4444':'#8b5cf6';
    return `<div style="padding:10px;background:#0a0e1a;border:1px solid ${col}33;border-radius:8px;margin-bottom:8px">
      <div style="font-weight:700;color:#f1f5f9;font-size:13px">${esc(e.contest.name)}</div>
      <div style="font-size:11px;color:${col};margin-top:2px">${isDeadline?'⏰ Termin zgłoszeń':'🏆 Ogłoszenie wyników'}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(ag?.name||'—')}${e.contest.prize?' · '+esc(e.contest.prize):''}</div>
      ${e.contest.task?`<div style="font-size:11px;color:#818cf8;margin-top:4px"><strong>🎯</strong> ${esc(e.contest.task)}</div>`:''}
    </div>`;
  }).join('');
  openModal({title:'📅 '+ds,html,submitLabel:'Zamknij',onSubmit:()=>true});
}
// — eksport na window (onclick= compatibility)
Object.assign(window, {calShift, calToday, renderCalendar, calDayClick});
