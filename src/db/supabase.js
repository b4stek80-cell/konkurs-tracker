// ═══════════════════════════════════════════════════════════
// SUPABASE — mapowania tabel i niskopoziomowe operacje HTTP
// ═══════════════════════════════════════════════════════════

// Mapowanie KEYS -> tabele Supabase i pola
const SB_TABLES = {
  [KEYS.players]:   { table:'kt_players',   toRow: p=>({id:p.id,name:p.name||'',email:p.email||'',phone:p.phone||'',notes:p.notes||'',photo:p.photo&&p.photo.startsWith('http')?p.photo:''}), fromRow: r=>r },
  [KEYS.agencies]:  { table:'kt_agencies',  toRow: a=>({id:a.id,name:a.name||'',website:a.website||'',notes:a.notes||''}), fromRow: r=>r },
  [KEYS.profiles]:  { table:'kt_profiles',  toRow: p=>{return {id:p.id,player_id:p.playerId,agency_id:p.agencyId,email:p.email,bank:p.bank,address:p.address,notes:p.notes}}, fromRow: r=>{return {id:r.id,playerId:r.player_id,agencyId:r.agency_id,email:r.email,bank:r.bank,address:r.address,notes:r.notes}} },
  [KEYS.contests]:  { table:'kt_contests',  toRow: c=>{return {id:c.id,name:c.name,agency_id:c.agencyId,prize:c.prize||'',prize_value:c.prize_value||'',deadline:c.deadline||null,results_date:c.results_date||null,conditions:c.conditions||'',link:c.link||'',rules_link:c.rules_link||'',status:c.status||'active',notes:c.notes||'',tags:Array.isArray(c.tags)?c.tags:[],shops:Array.isArray(c.shops)?c.shops:[],task:c.task||''}}, fromRow: r=>{return {id:r.id,name:r.name,agencyId:r.agency_id,prize:r.prize,prize_value:r.prize_value,deadline:r.deadline,results_date:r.results_date,conditions:r.conditions,link:r.link,rules_link:r.rules_link||'',status:r.status,notes:r.notes,tags:r.tags||[],shops:r.shops||[]}} },
  [KEYS.entries]:   { table:'kt_entries',   toRow: e=>{return {id:e.id,contest_id:e.contestId,player_id:e.playerId,profile_id:e.profileId||null,receipt_id:e.receiptId||null,date:e.date||null,status:e.status||'sent',notes:e.notes||'',answer:e.answer||''}}, fromRow: r=>{return {id:r.id,contestId:r.contest_id,playerId:r.player_id,profileId:r.profile_id,receiptId:r.receipt_id,date:r.date,status:r.status,notes:r.notes,answer:r.answer||''}} },
  [KEYS.receipts]:  { table:'kt_receipts',  toRow: r=>{return {id:r.id,player_id:r.playerId,shop:r.shop||'',amount:r.amount||'',date:r.date||null,notes:r.notes||'',expire_date:r.expire_date||null,receipt_nr:r.receipt_nr||null,cash_register:r.cash_register||null,nip:r.nip||null,photo:r.photo||'',settled:r.settled||false,added_by:r.added_by||null}}, fromRow: r=>{return {id:r.id,playerId:r.player_id,shop:r.shop,amount:r.amount,date:r.date,notes:r.notes,expire_date:r.expire_date||'',receipt_nr:r.receipt_nr||'',cash_register:r.cash_register||'',nip:r.nip||'',photo:r.photo||'',settled:r.settled,added_by:r.added_by||null}} },
  [KEYS.templates]: { table:'kt_templates', toRow: t=>{return {id:t.id,cat:t.cat||'custom',title:t.title,text:t.text,tags:t.tags||[]}}, fromRow: r=>{return {id:r.id,cat:r.cat,title:r.title,text:r.text,tags:r.tags||[],shops:r.shops||[]}} },
};

async function sbFetch(path, opts={}){
  // Pobierz token sesji zalogowanego użytkownika
  let token = SB_KEY;
  if(_sb){
    try{
      const {data:{session}} = await _sb.auth.getSession();
      if(session?.access_token) token = session.access_token;
    }catch(e){}
  }
  const r = await fetch(SB_URL+'/rest/v1/'+path, {
    ...opts,
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer '+token,
      'Content-Type': 'application/json',
      'Prefer': opts.method==='POST'?'resolution=merge-duplicates,return=representation':'',
      ...(opts.headers||{})
    }
  });
  if(!r.ok){
    const t=await r.text();
    throw new Error('HTTP '+r.status+' na '+path.split('?')[0]+': '+t.slice(0,200));
  }
  if(r.status===204||r.headers.get('content-length')==='0') return [];
  return r.json();
}

// Usuń rekord z Supabase
async function sbDelete(key, id){
  const cfg = SB_TABLES[key];
  if(!cfg) return;
  // Zapamiętaj ID jako usunięte — blokada przed re-upsertem
  if(!_deletedIds[cfg.table]) _deletedIds[cfg.table] = new Set();
  _deletedIds[cfg.table].add(id);
  try{ await sbFetch(cfg.table+'?id=eq.'+id+'&family_id=eq.'+_currentFamilyId, {method:'DELETE', headers:{'Prefer':'return=minimal'}}); }
  catch(e){ console.warn('Delete error:', e.message); }
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {sbFetch, sbDelete, SB_TABLES});
