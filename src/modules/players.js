// ═══════════════════════════════════════════════════════════
// PLAYERS — gracze i profile
// ═══════════════════════════════════════════════════════════

function printPlayerSummary(playerId){
  const p=S.players.find(x=>x.id===playerId);
  if(!p) return;
  const entries=S.entries.filter(e=>e.playerId===playerId);
  const won=entries.filter(e=>['won','prize_received','prize_pending'].includes(e.status));
  const receipts=S.receipts.filter(r=>r.playerId===playerId);

  const rows=entries.map(e=>{
    const ct=S.contests.find(x=>x.id===e.contestId);
    const ag=ct?S.agencies.find(a=>a.id===ct.agencyId):null;
    const statusLabels={sent:'Wysłano',pending:'Oczekuje',contacted:'Kontakt',
      prize_pending:'Nagroda w drodze',prize_received:'Nagroda odebrana',
      won:'Wygrano',lost:'Przegrano',no_response:'Brak odpowiedzi',expired:'Termin minął'};
    return `<tr>
      <td>${e.date||'—'}</td>
      <td>${ct?.name||'?'}</td>
      <td>${ag?.name?.split(' ').slice(0,3).join(' ')||'—'}</td>
      <td>${ct?.prize||'—'}</td>
      <td><strong>${statusLabels[e.status]||e.status}</strong></td>
    </tr>`;
  }).join('');

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>KonkursTracker — ${p.name}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:20px;color:#111;max-width:900px;margin:0 auto}
    h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}
    h2{font-size:16px;margin-top:24px;color:#333}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th{background:#f0f0f0;padding:8px;text-align:left;border:1px solid #ccc}
    td{padding:7px 8px;border:1px solid #ddd}
    tr:nth-child(even){background:#f9f9f9}
    .summary{display:flex;gap:24px;margin:16px 0;flex-wrap:wrap}
    .stat{background:#f5f5f5;border-radius:8px;padding:12px 20px;text-align:center}
    .stat .val{font-size:24px;font-weight:bold;color:#333}
    .stat .lbl{font-size:12px;color:#666;margin-top:2px}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>📋 Podsumowanie: ${p.name}</h1>
  <p style="color:#666;font-size:13px">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} · ${p.email||''} ${p.phone?'· '+p.phone:''}</p>
  <div class="summary">
    <div class="stat"><div class="val">${entries.length}</div><div class="lbl">Zgłoszeń</div></div>
    <div class="stat"><div class="val">${won.length}</div><div class="lbl">Wygranych</div></div>
    <div class="stat"><div class="val">${entries.length>0?Math.round(won.length/entries.length*100):0}%</div><div class="lbl">Win Rate</div></div>
    <div class="stat"><div class="val">${receipts.length}</div><div class="lbl">Paragonów</div></div>
  </div>
  <h2>Historia zgłoszeń</h2>
  <table><thead><tr><th>Data</th><th>Konkurs</th><th>Agencja</th><th>Nagroda</th><th>Status</th></tr></thead>
  <tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:#999">Brak zgłoszeń</td></tr>'}</tbody></table>
  ${receipts.length?`<h2>Paragony (${receipts.length})</h2>
  <table><thead><tr><th>Data</th><th>Sklep</th><th>Kwota</th><th>Ważny do</th><th>Status</th></tr></thead>
  <tbody>${receipts.map(r=>`<tr>
    <td>${r.date||'—'}</td><td>${r.shop||'—'}</td><td>${r.amount?r.amount+' zł':'—'}</td>
    <td>${r.expire_date||'—'}</td><td>${r.settled?'✅ Rozliczony':'⏳ Aktywny'}</td>
  </tr>`).join('')}</tbody></table>`:''}
  <p style="margin-top:32px;font-size:11px;color:#999">KonkursTracker · wydruk wygenerowany automatycznie</p>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`;

  const w=window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
  else { alert('Zezwól na wyskakujące okienka aby wydrukować'); }
}

// ── Kopiowanie danych gracza ──────────────────────────────────────────────────
function copyField(text, btnEl){
  if(!text) return;
  navigator.clipboard.writeText(text).then(()=>{
    const orig=btnEl.textContent;
    btnEl.textContent='✓';
    btnEl.style.color='#22c55e';
    setTimeout(()=>{ btnEl.textContent=orig; btnEl.style.color=''; },1500);
  }).catch(()=>{
    // Fallback
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    const orig=btnEl.textContent;
    btnEl.textContent='✓'; btnEl.style.color='#22c55e';
    setTimeout(()=>{ btnEl.textContent=orig; btnEl.style.color=''; },1500);
  });
}
function renderPlayers(){
  const list = [...S.players].sort((a,b)=>a.name.localeCompare(b.name,'pl')).map(p=>{
    const pe=S.entries.filter(e=>e.playerId===p.id);
    const profTags = S.agencies.map(ag=>{
      const has=S.profiles.find(pr=>pr.playerId===p.id&&pr.agencyId===ag.id);
      return `<button class="profile-tag" onclick="openProfileModal('${p.id}','${ag.id}')"
        style="background:${has?'#6366f122':'#1e2a3a'};color:${has?'#818cf8':'#475569'};border-color:${has?'#6366f144':'#2d3548'}">
        ${has?'✓ ':'+ '}${esc(ag.name.split(' ').slice(0,2).join(' '))}</button>`;
    }).join('');
    const initials=p.name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const avatarHtml=p.photo
      ? `<img src="${p.photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #2d3548">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:#6366f133;border:2px solid #6366f144;display:flex;align-items:center;justify-content:center;font-weight:700;color:#818cf8;font-size:16px;flex-shrink:0">${initials}</div>`;
    return `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
        <div class="row" style="gap:12px;align-items:flex-start;flex:1">
          ${avatarHtml}
          <div style="min-width:0">
            <div style="font-weight:700;color:#f1f5f9;font-size:16px">${esc(p.name)}</div>
            <div style="font-size:13px;color:#64748b;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
              ${p.email?`<span>${esc(p.email)}</span><button onclick="copyField('${esc(p.email)}',this)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:12px;padding:1px 4px" title="Kopiuj email">📋</button>`:''}
              ${p.phone?`<span>· ${esc(p.phone)}</span><button onclick="copyField('${esc(p.phone)}',this)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:12px;padding:1px 4px" title="Kopiuj telefon">📋</button>`:''}
            </div>
            <div style="font-size:12px;color:#475569;margin-top:4px">${pe.length} zgłoszeń · <span style="color:#22c55e">${pe.filter(e=>e.status==='won').length} wygranych</span></div>
          </div>
        </div>
        <div class="row" style="gap:6px;flex-shrink:0">
          <button class="btn-sm" style="background:#f59e0b22;color:#fbbf24;border:1px solid #f59e0b33" onclick="openReceiptsModal('${p.id}')">🧾 ${S.receipts.filter(r=>r.playerId==='${p.id}').length||''}</button>
          <button class="btn-sec btn-sm" onclick="editPlayer('${p.id}')">✏️</button>
          <button class="btn-sm" style="background:#ef444422;color:#f87171;border:1px solid #ef444433" onclick="deletePlayer('${p.id}')">🗑</button>
        </div>
      </div>
      ${S.agencies.length?`<div class="row" style="margin-top:10px;gap:6px"><span style="font-size:11px;color:#475569">Profile agencji:</span>${profTags}</div>`:''}
    </div>`;
  }).join('');

  return `
    <div class="row" style="justify-content:space-between;margin-bottom:20px">
      <h1 style="font-size:22px;font-weight:800;color:#f1f5f9">Gracze</h1>
      <button class="btn-primary" onclick="addPlayer()">+ Dodaj gracza</button>
    </div>
    ${list||'<p style="color:#475569;text-align:center;padding:48px">Brak graczy — dodaj pierwszego!</p>'}`;
}

function photoFieldHtml(existing){
  return `<div class="field"><label>Zdjęcie (opcjonalne)</label>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <div id="photo_preview" style="width:56px;height:56px;border-radius:50%;overflow:hidden;background:#1e2a3a;border:2px solid #2d3548;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px">
        ${existing?`<img src="${existing}" style="width:100%;height:100%;object-fit:cover">`:'👤'}
      </div>
      <div style="flex:1">
        <input type="file" id="p_photo_inp" accept="image/*" style="display:none" onchange="previewPhoto(this)">
        <button type="button" onclick="document.getElementById('p_photo_inp').click()" class="btn-sec btn-sm" style="width:100%;margin-bottom:6px">📷 Wybierz zdjęcie</button>
        ${existing?`<button type="button" onclick="clearPhoto()" class="btn-sm" style="width:100%;background:#ef444418;color:#f87171;border:1px solid #ef444433">Usuń zdjęcie</button>`:''}
      </div>
    </div>
  </div>`;
}

function previewPhoto(inp){
  const file=inp.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    document.getElementById('p_photo_preview_data').value=e.target.result;
    document.getElementById('photo_preview').innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}

function clearPhoto(){
  document.getElementById('p_photo_preview_data').value='__clear__';
  document.getElementById('photo_preview').innerHTML='👤';
}

function addPlayer(){
  const html = `
    ${field('Imię i nazwisko',finp('p_name','','text','Jan Kowalski'))}
    ${field('Email',finp('p_email','','email','jan@gmail.com'))}
    ${field('Telefon',finp('p_phone','','text','600 100 200'))}
    ${field('Notatki',ftex('p_notes'))}
    ${photoFieldHtml('')}
    <input type="hidden" id="p_photo_preview_data" value="">`;
  openModal({title:'Nowy gracz',html,submitLabel:'Zapisz',onSubmit:()=>{
    const name=gv('p_name').trim();
    if(!name) return false;
    const photoData=document.getElementById('p_photo_preview_data')?.value||'';
    S.players.push({id:uid(),name,email:gv('p_email'),phone:gv('p_phone'),notes:gv('p_notes'),photo:photoData||''});
    persistAndSync(KEYS.players,S.players); render();
  }});
}

function editPlayer(id){
  const p=S.players.find(x=>x.id===id);
  const html=`
    ${field('Imię i nazwisko',finp('p_name',p.name))}
    ${field('Email',finp('p_email',p.email,'email'))}
    ${field('Telefon',finp('p_phone',p.phone))}
    ${field('Notatki',ftex('p_notes',p.notes))}
    ${photoFieldHtml(p.photo||'')}
    <input type="hidden" id="p_photo_preview_data" value="${p.photo||''}">`;
  openModal({title:'Edytuj gracza',html,submitLabel:'Zapisz',onSubmit:()=>{
    const name=gv('p_name').trim(); if(!name) return false;
    const photoData=document.getElementById('p_photo_preview_data')?.value||'';
    const newPhoto = photoData==='__clear__' ? '' : (photoData||p.photo||'');
    Object.assign(p,{name,email:gv('p_email'),phone:gv('p_phone'),notes:gv('p_notes'),photo:newPhoto});
    persistAndSync(KEYS.players,S.players); render();
  }});
}

function deletePlayer(id){
  if(!isOwner()){ alert('⛔ Tylko właściciel grupy może usuwać graczy.'); return; }
  confirm('Usunąć gracza i wszystkie jego profile?',()=>{
    // Usuń z bazy - nie upsertuj ponownie po usunięciu
    S.profiles.filter(p=>p.playerId===id).forEach(p=>sbDelete(KEYS.profiles,p.id));
    S.receipts.filter(r=>r.playerId===id).forEach(r=>sbDelete(KEYS.receipts,r.id));
    sbDelete(KEYS.players,id);
    // Usuń z lokalnego stanu
    S.players=S.players.filter(p=>p.id!==id);
    S.profiles=S.profiles.filter(p=>p.playerId!==id);
    S.receipts=S.receipts.filter(r=>r.playerId!==id);
    // Zapisz tylko do localStorage - nie syncuj do Supabase (już usunięte przez sbDelete)
    localStorage.setItem(KEYS.players, JSON.stringify(S.players));
    localStorage.setItem(KEYS.profiles, JSON.stringify(S.profiles));
    localStorage.setItem(KEYS.receipts, JSON.stringify(S.receipts.map(r=>({...r,photo_local:''}))));
    render();
  });
}

function openProfileModal(playerId, agencyId){
  const p=S.players.find(x=>x.id===playerId);
  const ag=S.agencies.find(x=>x.id===agencyId);
  const ex=S.profiles.find(x=>x.playerId===playerId&&x.agencyId===agencyId)||{email:'',bank:'',address:'',notes:''};
  const html=`
    <div style="background:#0a0e1a;border:1px solid #f59e0b33;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#fbbf24">
      ⚠️ Te dane muszą być ZAWSZE takie same dla tej agencji we wszystkich konkursach
    </div>
    ${field('Email do agencji',
      `<div style="display:flex;gap:6px;align-items:center">
        <input id="pr_email" type="email" value="${esc(ex.email)}" style="flex:1">
        ${ex.email?`<button onclick="copyField('${esc(ex.email)}',this)" style="flex-shrink:0;background:#6366f122;border:1px solid #6366f133;border-radius:6px;color:#818cf8;cursor:pointer;padding:6px 10px;font-size:12px" title="Kopiuj email">📋</button>`:''}
      </div>`)}
    ${field('Numer konta bankowego',
      `<div style="display:flex;gap:6px;align-items:center">
        <input id="pr_bank" type="text" value="${esc(ex.bank)}" placeholder="PL61 1090 1014 0000 ..." style="flex:1">
        ${ex.bank?`<button onclick="copyField('${esc(ex.bank)}',this)" style="flex-shrink:0;background:#6366f122;border:1px solid #6366f133;border-radius:6px;color:#818cf8;cursor:pointer;padding:6px 10px;font-size:12px" title="Kopiuj konto">📋</button>`:''}
      </div>`)}
    ${field('Adres korespondencyjny',
      `<div style="display:flex;gap:6px;align-items:flex-start">
        <textarea id="pr_addr" style="flex:1;min-height:70px">${esc(ex.address)}</textarea>
        ${ex.address?`<button onclick="copyField('${esc(ex.address)}',this)" style="flex-shrink:0;background:#6366f122;border:1px solid #6366f133;border-radius:6px;color:#818cf8;cursor:pointer;padding:6px 10px;font-size:12px;margin-top:2px" title="Kopiuj adres">📋</button>`:''}
      </div>`)}
    ${field('Notatki',ftex('pr_notes',ex.notes))}`;
  openModal({title:`Profil: ${p?.name} @ ${ag?.name}`,html,submitLabel:'Zapisz profil',onSubmit:()=>{
    const data={playerId,agencyId,email:gv('pr_email'),bank:gv('pr_bank'),address:gv('pr_addr'),notes:gv('pr_notes')};
    const idx=S.profiles.findIndex(x=>x.playerId===playerId&&x.agencyId===agencyId);
    if(idx>=0) S.profiles[idx]={...S.profiles[idx],...data};
    else S.profiles.push({id:uid(),...data});
    persistAndSync(KEYS.profiles,S.profiles); render();
  }});
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {printPlayerSummary, copyField, renderPlayers, photoFieldHtml, previewPhoto, clearPhoto, addPlayer, editPlayer, deletePlayer, openProfileModal});
