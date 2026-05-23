// ═══════════════════════════════════════════════════════════
// SYNC — synchronizacja z Supabase, realtime, backup
// ═══════════════════════════════════════════════════════════

function setSyncStatus(s){
  _syncStatus=s;
  const el=document.getElementById('sync_status');
  if(!el) return;
  const map={idle:['',''],syncing:['🔄','#f59e0b'],ok:['☁️','#22c55e'],error:['⚠️','#ef4444']};
  const [icon,col]=map[s]||['',''];
  el.textContent=icon; el.style.color=col;
  el.title={idle:'',syncing:'Synchronizuję...',ok:'Zsynchronizowano z chmurą',error:'Błąd synchronizacji — dane zapisane lokalnie'}[s]||'';
}

// Pełna synchronizacja przy starcie (pobierz z chmury jeśli są nowsze dane)
// Sprawdź czy zalogowany user jest właścicielem rodziny
function isOwner(){ return _currentRole==='owner'; }

// Walidacja daty paragonu
function validateReceiptDate(dateStr, fieldLabel){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  if(d > now){
    return fieldLabel+': data nie może być w przyszłości';
  }
  if(d < sixMonthsAgo){
    return fieldLabel+': data jest starsza niż 6 miesięcy — czy na pewno poprawna?';
  }
  return null;
}

function validateExpireDate(dateStr, purchaseDateStr){
  if(!dateStr || !purchaseDateStr) return null;
  if(new Date(dateStr) <= new Date(purchaseDateStr)){
    return 'Data ważności musi być późniejsza niż data zakupu';
  }
  return null;
}

// Główna funkcja sync — wywołuj po każdej zmianie
function persistAndSync(key, val){
  // Zapisz do localStorage (cache)
  try {
    const toSave = key===KEYS.receipts
      ? val.map(r=>({...r, photo_local:'', photo: r.photo?.startsWith('http')?r.photo:''}))
      : val;
    localStorage.setItem(key, JSON.stringify(toSave));
  } catch(e) {
    if(key===KEYS.receipts){
      // Ostatnia deska ratunku - zapisz bez zdjęć
      const slim=val.map(r=>({...r,photo:'',photo_local:''}));
      localStorage.setItem(key, JSON.stringify(slim));
    } else {
      throw e;
    }
  }
  // Async sync w tle
  const cfg = SB_TABLES[key];
  if(cfg){
    setSyncStatus('syncing');
    syncToSupabase(key)
      .then(()=>setSyncStatus('ok'))
      .catch(()=>setSyncStatus('error'));
  }
}

// Prześlij lokalną kolekcję do Supabase (upsert wszystkich rekordów)
async function syncToSupabase(key){
  // Kolejność zapisu: najpierw tabele nadrzędne (bez FK), potem zależne
  // players i agencies nie mają FK - można je zapisać zawsze
  // profiles FK -> players + agencies
  // contests FK -> agencies
  // entries FK -> players + contests
  if(key===KEYS.profiles){
    if(S.players.length)  try{ await syncToSupabaseRaw(KEYS.players);  }catch(e){}
    if(S.agencies.length) try{ await syncToSupabaseRaw(KEYS.agencies); }catch(e){}
  }
  if(key===KEYS.contests){
    if(S.agencies.length) try{ await syncToSupabaseRaw(KEYS.agencies); }catch(e){}
  }
  if(key===KEYS.entries){
    if(S.players.length)  try{ await syncToSupabaseRaw(KEYS.players);  }catch(e){}
    if(S.agencies.length) try{ await syncToSupabaseRaw(KEYS.agencies); }catch(e){}
    if(S.contests.length) try{ await syncToSupabaseRaw(KEYS.contests); }catch(e){}
    if(S.profiles.length) try{ await syncToSupabaseRaw(KEYS.profiles); }catch(e){}
  }
  await syncToSupabaseRaw(key);
}

async function syncToSupabaseRaw(key){
  const cfg = SB_TABLES[key];
  if(!cfg) return;
  // Użyj S (stan aplikacji) jako źródła — nie localStorage
  const keyMap = {
    [KEYS.players]: S.players,
    [KEYS.agencies]: S.agencies,
    [KEYS.profiles]: S.profiles,
    [KEYS.contests]: S.contests,
    [KEYS.entries]: S.entries,
    [KEYS.receipts]: S.receipts,
    [KEYS.templates]: S.templates,
  };
  const arr = keyMap[key] || load(key,[]);
  // Filtruj rekordy które zostały usunięte — nie przywracaj ich przez upsert!
  const deletedSet = _deletedIds[cfg.table] || new Set();
  const toSync = arr.filter(r => !deletedSet.has(r.id));
  if(!toSync.length) return;
  if(!_currentFamilyId){ console.warn('syncToSupabase: brak family_id'); return; }
  try{
    const payload = toSync.map(r=>({...cfg.toRow(r), family_id:_currentFamilyId}));
    const result = await sbFetch(cfg.table+'?on_conflict=id', {
      method:'POST',
      body: JSON.stringify(payload)
    });

  } catch(e){
    console.error('Sync error '+key+':', e.message);
    setSyncStatus('error');
    const el=document.getElementById('sync_status');
    if(el){ el.title='Błąd sync: '+e.message; }
    alert('❌ Błąd sync ['+key+']:\n'+e.message);
  }
}

// Pobierz dane z Supabase do localStorage i S
async function syncFromSupabase(key){
  const cfg = SB_TABLES[key];
  if(!cfg) return null;
  try{
    if(!_currentFamilyId) return null;
    const rows = await sbFetch(cfg.table+'?select=*&family_id=eq.'+_currentFamilyId+'&order=id.asc');
    if(!Array.isArray(rows)) return null; // błąd parsowania
    const deletedSet = _deletedIds[cfg.table] || new Set();
    // Nie przywracaj rekordów które właśnie usunęliśmy
    const data = rows.filter(r => !deletedSet.has(r.id)).map(cfg.fromRow);
    return data; // może być pusta tablica [] - to OK
  } catch(e){
    console.warn('Fetch error '+key+':', e.message);
    return null; // null = błąd sieci, nie nadpisuj
  }
}

async function initialSync(){
  // Pobierz rolę usera przy każdym sync — ZAWSZE, nie tylko gdy null
  // Bo rola mogła się zmienić (user dołączył do innej rodziny)
  if(_currentFamilyId && _currentUser){
    try{
      const mem=await sbFetch('kt_family_members?family_id=eq.'+_currentFamilyId+'&user_id=eq.'+_currentUser.id);
      _currentRole=(Array.isArray(mem)&&mem[0]?.role)||'member';

    }catch(e){
      _currentRole='member';

    }
  }
  setSyncStatus('syncing');
  try{
    const keys=[KEYS.players,KEYS.agencies,KEYS.profiles,KEYS.contests,KEYS.entries,KEYS.receipts,KEYS.templates];
    const results = await Promise.all(keys.map(k=>syncFromSupabase(k)));
    const [p,a,pr,ct,en,rc,tp] = results;
    // Nadpisuj tylko jeśli Supabase zwróciło dane (nie null)
    // Nie nadpisuj pustą tablicą jeśli S już ma dane
    // null = błąd sieci (nie nadpisuj), [] = puste dane (nadpisuj)
    if(p!==null)  S.players   = p;
    if(a!==null)  S.agencies  = a;
    if(pr!==null) S.profiles  = pr;
    if(ct!==null) S.contests  = ct;
    if(en!==null) S.entries   = en;
    if(rc!==null) S.receipts  = rc;
    if(tp!==null&&tp.length)  S.templates = tp;
    setSyncStatus('ok');
    render();
  } catch(e){
    console.warn('Initial sync failed:', e.message);
    setSyncStatus('error');
    render();
  }
}

// ── Manual Refresh ────────────────────────────────────────────────────────────
async function manualRefresh(){
  setSyncStatus('syncing');
  try{
    const keys=[KEYS.players,KEYS.agencies,KEYS.profiles,KEYS.contests,KEYS.entries,KEYS.receipts,KEYS.templates];
    const results=await Promise.all(keys.map(k=>syncFromSupabase(k)));
    const [p,a,pr,ct,en,rc,tp]=results;
    if(p!==null)  S.players=p;
    if(a!==null)  S.agencies=a;
    if(pr!==null) S.profiles=pr;
    if(ct!==null) S.contests=ct;
    if(en!==null) S.entries=en;
    if(rc!==null) S.receipts=rc;
    if(tp!==null&&tp.length) S.templates=tp;
    setSyncStatus('ok');
    render();
  }catch(e){
    setSyncStatus('error');
    console.warn('manualRefresh error:',e.message);
  }
}

// ── Supabase Realtime ─────────────────────────────────────────────────────────
let _realtimeChannel = null;

function initRealtime(){
  if(!_sb||!_currentFamilyId) return;
  if(_realtimeChannel){ try{_sb.removeChannel(_realtimeChannel);}catch(e){} _realtimeChannel=null; }

  let _rt=null;
  function scheduleRefresh(){
    if(_rt) clearTimeout(_rt);
    _rt=setTimeout(manualRefresh,1500);
  }

  const dot=document.getElementById('realtime_dot');
  if(dot){ dot.style.background='#f59e0b'; dot.title='Łączenie...'; }

  _realtimeChannel=_sb.channel('kt_'+_currentFamilyId)
    .on('postgres_changes',{event:'*',schema:'public',table:'kt_players',  filter:'family_id=eq.'+_currentFamilyId},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'kt_agencies', filter:'family_id=eq.'+_currentFamilyId},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'kt_contests', filter:'family_id=eq.'+_currentFamilyId},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'kt_entries',  filter:'family_id=eq.'+_currentFamilyId},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'kt_receipts', filter:'family_id=eq.'+_currentFamilyId},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'kt_profiles', filter:'family_id=eq.'+_currentFamilyId},scheduleRefresh)
    .subscribe((status)=>{
      const dot=document.getElementById('realtime_dot');
      if(status==='SUBSCRIBED'){
        if(dot){ dot.style.background='#22c55e'; dot.title='Live — zmiany automatyczne'; }
      } else if(status==='CHANNEL_ERROR'||status==='CLOSED'){
        if(dot){ dot.style.background='#ef4444'; dot.title='Realtime nieaktywny'; }
        setTimeout(initRealtime,10000);
      } else {
        if(dot){ dot.style.background='#f59e0b'; dot.title='Łączenie ('+status+')...'; }
      }
    });
}

// ── Auto-backup ───────────────────────────────────────────────────────────────
function autoBackup(){
  const LAST_KEY='kt_last_auto_backup';
  const last=localStorage.getItem(LAST_KEY)||'';
  const today=ktTodayStr();
  if(last===today) return; // już dziś zrobiony

  // Sprawdź czy jest coś do zapisania
  const total=S.contests.length+S.players.length+S.entries.length;
  if(total===0) return; // brak danych - nie rób pustego backupu

  try{
    const data={
      version:2,
      exported:new Date().toISOString(),
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
    a.download='KonkursTracker_auto_'+today+'.json';
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(LAST_KEY,today);
    console.log('Auto-backup saved:', today);
  }catch(e){
    console.warn('Auto-backup failed:', e.message);
  }
}
