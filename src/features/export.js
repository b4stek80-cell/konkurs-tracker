// ═══════════════════════════════════════════════════════════
// EXPORT / IMPORT — exportData, importData, exportWonCSV,
//   exportViaEmail, exportToClipboard, handleImportText, handleImportFile
// ═══════════════════════════════════════════════════════════

function exportData(){
  const data={
    version:2,
    exported: new Date().toISOString(),
    players:S.players,
    agencies:S.agencies,
    profiles:S.profiles,
    contests:S.contests,
    entries:S.entries,
    receipts:S.receipts,
    templates:S.templates,
  };
  const json=JSON.stringify(data,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='KonkursTracker_backup_'+ktTodayStr()+'.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange=async e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.contests&&!data.players) throw new Error('Nieprawidłowy plik backup');
        // Zamknij wszystkie modale przed importem
        document.querySelectorAll('.overlay').forEach(m=>m.remove());
        if(data.players)   S.players=data.players;
        if(data.agencies)  S.agencies=data.agencies;
        if(data.profiles)  S.profiles=data.profiles;
        if(data.contests)  S.contests=data.contests;
        if(data.entries)   S.entries=data.entries;
        if(data.receipts)  S.receipts=data.receipts;
        if(data.templates) S.templates=data.templates;
        // Zapisz do localStorage
        localStorage.setItem(KEYS.players,   JSON.stringify(S.players));
        localStorage.setItem(KEYS.agencies,  JSON.stringify(S.agencies));
        localStorage.setItem(KEYS.profiles,  JSON.stringify(S.profiles));
        localStorage.setItem(KEYS.contests,  JSON.stringify(S.contests));
        localStorage.setItem(KEYS.entries,   JSON.stringify(S.entries));
        localStorage.setItem(KEYS.receipts,  JSON.stringify(S.receipts));
        localStorage.setItem(KEYS.templates, JSON.stringify(S.templates));
        render();
        // Sync do Supabase
        setSyncStatus('syncing');
        const syncKeys=[KEYS.players,KEYS.agencies,KEYS.profiles,KEYS.contests,KEYS.entries,KEYS.receipts];
        for(const k of syncKeys){
          try{ await syncToSupabase(k); }
          catch(err){ console.warn('sync err',k,err.message); }
        }
        setSyncStatus('ok');
        alert('✅ Import zakończony!\nGraczy: '+S.players.length+' · Konkursów: '+S.contests.length+' · Zgłoszeń: '+S.entries.length);
      }catch(err){
        alert('❌ Błąd importu: '+err.message);
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function exportWonCSV(){
  const won=S.entries.filter(e=>['won','prize_received','prize_pending'].includes(e.status));
  if(!won.length){ alert('Brak wygranych do eksportu'); return; }
  const rows=[['Data','Konkurs','Agencja','Nagroda','Wartość','Gracz','Status']];
  won.forEach(e=>{
    const ct=S.contests.find(x=>x.id===e.contestId);
    const ag=ct?S.agencies.find(a=>a.id===ct.agencyId):null;
    const p=S.players.find(x=>x.id===e.playerId);
    const status={won:'Wygrano',prize_pending:'Nagroda w drodze',prize_received:'Nagroda odebrana'}[e.status]||e.status;
    rows.push([e.date||'',ct?.name||'',ag?.name||'',ct?.prize||'',ct?.prize_value||'',p?.name||'',status]);
  });
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='KonkursTracker_wygrane_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); URL.revokeObjectURL(url);
}
function exportViaEmail(){
  const data={
    version:2,
    exported: new Date().toISOString(),
    players:S.players,
    agencies:S.agencies,
    profiles:S.profiles,
    contests:S.contests,
    entries:S.entries,
    receipts:S.receipts.map(r=>({...r,photo:'',photo_local:''})),
    templates:S.templates,
  };
  const json=JSON.stringify(data);
  const date=new Date().toLocaleDateString('pl-PL').replace(/\./g,'-');
  const subject=encodeURIComponent('KonkursTracker backup '+date);
  const body=encodeURIComponent(
    'Backup KonkursTracker z dnia '+date+'\n\n'+
    'Graczy: '+S.players.length+' · Agencji: '+S.agencies.length+
    ' · Konkursów: '+S.contests.length+' · Zgłoszeń: '+S.entries.length+
    '\n\n--- DANE (nie edytuj poniżej) ---\n\n'+json
  );
  // Otwórz klienta email
  window.location.href='mailto:?subject='+subject+'&body='+body;
}
function exportToClipboard(btn){
  const data={
    version:2,
    exported: new Date().toISOString(),
    players:S.players,
    agencies:S.agencies,
    profiles:S.profiles,
    contests:S.contests,
    entries:S.entries,
    receipts:S.receipts.map(r=>({...r,photo:'',photo_local:''})), // bez zdjęć
    templates:S.templates,
  };
  const json=JSON.stringify(data);
  navigator.clipboard.writeText(json).then(()=>{
    const orig=btn.textContent;
    btn.textContent='✓ Skopiowano!';
    btn.style.background='#16a34a';
    setTimeout(()=>{ btn.textContent=orig; btn.style.background='#22c55e'; },2500);
  }).catch(()=>{
    // Fallback - pokaż w textarea
    const ta=document.createElement('textarea');
    ta.value=json; ta.style.cssText='position:fixed;top:10px;left:10px;right:10px;height:200px;z-index:99999;font-size:10px;background:#0a0e1a;color:#f1f5f9;border:2px solid #22c55e;border-radius:8px;padding:8px';
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    alert('Dane skopiowane! Teraz wklej w notatnik żeby zapisać.');
    document.body.removeChild(ta);
  });
}

async function handleImportText(){
  let text=document.getElementById('import_json_text')?.value?.trim();
  if(!text){ alert('Wklej zawartość emaila lub JSON'); return; }
  // Wyodrębnij JSON z treści emaila (szukaj od pierwszego '{')
  const jsonStart=text.indexOf('{"version"');
  if(jsonStart>0) text=text.slice(jsonStart);
  else {
    const jsonStart2=text.indexOf('{');
    if(jsonStart2>0) text=text.slice(jsonStart2);
  }
  document.querySelectorAll('.overlay').forEach(m=>m.remove());
  try{
    const data=JSON.parse(text);
    if(!data.players&&!data.contests) throw new Error('Nieprawidłowy format JSON');
    if(data.players)   S.players=data.players;
    if(data.agencies)  S.agencies=data.agencies;
    if(data.profiles)  S.profiles=data.profiles;
    if(data.contests)  S.contests=data.contests;
    if(data.entries)   S.entries=data.entries;
    if(data.receipts)  S.receipts=data.receipts;
    if(data.templates) S.templates=data.templates;
    localStorage.setItem(KEYS.players,   JSON.stringify(S.players));
    localStorage.setItem(KEYS.agencies,  JSON.stringify(S.agencies));
    localStorage.setItem(KEYS.profiles,  JSON.stringify(S.profiles));
    localStorage.setItem(KEYS.contests,  JSON.stringify(S.contests));
    localStorage.setItem(KEYS.entries,   JSON.stringify(S.entries));
    localStorage.setItem(KEYS.receipts,  JSON.stringify(S.receipts));
    localStorage.setItem(KEYS.templates, JSON.stringify(S.templates));
    render();
    setSyncStatus('syncing');
    const keys=[KEYS.players,KEYS.agencies,KEYS.profiles,KEYS.contests,KEYS.entries,KEYS.receipts];
    for(const k of keys){ try{ await syncToSupabase(k); }catch(e){ console.warn(k,e.message); } }
    setSyncStatus('ok');
    alert('✅ Zaimportowano!\nGraczy: '+S.players.length+' · Konkursów: '+S.contests.length+' · Zgłoszeń: '+S.entries.length);
  }catch(e){
    alert('❌ Błąd: '+e.message);
  }
}

async function handleImportFile(inp){
  const file=inp.files[0]; if(!file) return;
  document.querySelectorAll('.overlay').forEach(m=>m.remove());
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const text=ev.target.result;
      const data=JSON.parse(text);
    if(!data.players&&!data.contests) throw new Error('Nieprawidłowy plik');
    if(data.players)   S.players=data.players;
    if(data.agencies)  S.agencies=data.agencies;
    if(data.profiles)  S.profiles=data.profiles;
    if(data.contests)  S.contests=data.contests;
    if(data.entries)   S.entries=data.entries;
    if(data.receipts)  S.receipts=data.receipts;
    if(data.templates) S.templates=data.templates;
    localStorage.setItem(KEYS.players,   JSON.stringify(S.players));
    localStorage.setItem(KEYS.agencies,  JSON.stringify(S.agencies));
    localStorage.setItem(KEYS.profiles,  JSON.stringify(S.profiles));
    localStorage.setItem(KEYS.contests,  JSON.stringify(S.contests));
    localStorage.setItem(KEYS.entries,   JSON.stringify(S.entries));
    localStorage.setItem(KEYS.receipts,  JSON.stringify(S.receipts));
    localStorage.setItem(KEYS.templates, JSON.stringify(S.templates));
    render();
    setSyncStatus('syncing');
    const keys=[KEYS.players,KEYS.agencies,KEYS.profiles,KEYS.contests,KEYS.entries,KEYS.receipts];
    for(const k of keys){ try{ await syncToSupabase(k); }catch(e){ console.warn(k,e.message); } }
    setSyncStatus('ok');
    alert('✅ Zaimportowano!\nGraczy: '+S.players.length+' · Konkursów: '+S.contests.length+' · Zgłoszeń: '+S.entries.length);
    }catch(e){
      alert('❌ Błąd: '+e.message);
    }
  };
  reader.onerror=()=>alert('❌ Nie można odczytać pliku');
  reader.readAsText(file);
}
function exportCalendarICS(){
  const active=S.contests.filter(c=>c.status==='active'&&c.deadline);
  if(!active.length){ alert('Brak aktywnych konkursów z terminem'); return; }
  const esc2=s=>(s||'').replace(/[\\;,]/g,'\\$&').replace(/\n/g,'\\n');
  const d2s=s=>s.replace(/-/g,'');
  const now=new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const events=active.map(c=>{
    const ag=S.agencies.find(a=>a.id===c.agencyId);
    const desc=[
      c.prize?'Nagroda: '+c.prize:'',
      ag?'Agencja: '+ag.name:'',
      c.task?'Zadanie: '+c.task:'',
      c.link?'Link: '+c.link:'',
    ].filter(Boolean).join('\\n');
    return [
      'BEGIN:VEVENT',
      'UID:kt-'+c.id+'@konkurs-tracker',
      'DTSTAMP:'+now,
      'DTSTART;VALUE=DATE:'+d2s(c.deadline),
      'DTEND;VALUE=DATE:'+d2s(c.deadline),
      'SUMMARY:🏆 '+esc2(c.name),
      desc?'DESCRIPTION:'+desc:'',
      c.link?'URL:'+fixUrl(c.link):'',
      'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',
      'DESCRIPTION:Jutro deadline: '+esc2(c.name),
      'END:VALARM','END:VEVENT',
    ].filter(Boolean).join('\r\n');
  });
  const ics=[
    'BEGIN:VCALENDAR','VERSION:2.0',
    'PRODID:-//KonkursTracker//PL',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:KonkursTracker — Deadliny',
    'X-WR-TIMEZONE:Europe/Warsaw',
    ...events,'END:VCALENDAR',
  ].join('\r\n');
  const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='KonkursTracker_kalendarz_'+ktTodayStr()+'.ics';
  a.click(); URL.revokeObjectURL(url);
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {exportData, importData, exportWonCSV, exportViaEmail, exportToClipboard, handleImportText, handleImportFile, exportCalendarICS});
