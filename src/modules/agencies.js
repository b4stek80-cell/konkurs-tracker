// ═══════════════════════════════════════════════════════════
// AGENCIES — agencje
// ═══════════════════════════════════════════════════════════

function renderAgencies(){
  const list=S.agencies.map(a=>`
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700;color:#f1f5f9;font-size:16px">${esc(a.name)}</div>
          ${a.website?`<a href="${esc(fixUrl(a.website))}" target="_blank" style="font-size:13px;color:#6366f1;text-decoration:none">${esc(a.website)}</a>`:''}
          <div style="font-size:12px;color:#475569;margin-top:4px">${S.profiles.filter(p=>p.agencyId===a.id).length} profili · ${S.contests.filter(c=>c.agencyId===a.id).length} konkursów</div>
          ${a.notes?`<div style="font-size:12px;color:#94a3b8;margin-top:2px">${esc(a.notes)}</div>`:''}
        </div>
        <div class="row" style="gap:6px">
          <button class="btn-sec btn-sm" onclick="editAgency('${a.id}')">✏️</button>
          <button class="btn-sm" style="background:#ef444422;color:#f87171;border:1px solid #ef444433" onclick="deleteAgency('${a.id}')">🗑</button>
        </div>
      </div>
    </div>`).join('');
  return `
    <div class="row" style="justify-content:space-between;margin-bottom:20px">
      <h1 style="font-size:22px;font-weight:800;color:#f1f5f9">Agencje</h1>
      <button class="btn-primary" onclick="addAgency()">+ Dodaj agencję</button>
    </div>
    ${list||'<p style="color:#475569;text-align:center;padding:48px">Brak agencji</p>'}`;
}

function agencyForm(a={}){
  return `${field('Nazwa agencji',finp('ag_name',a.name||''))}
    ${field('Strona WWW',finp('ag_web',a.website||'','url','https://'))}
    ${field('Notatki',ftex('ag_notes',a.notes||''))}`;
}
function addAgency(){
  openModal({title:'Nowa agencja',html:agencyForm(),submitLabel:'Zapisz',onSubmit:()=>{
    const name=gv('ag_name').trim(); if(!name) return false;
    S.agencies.push({id:uid(),name,website:gv('ag_web'),notes:gv('ag_notes')});
    persistAndSync(KEYS.agencies,S.agencies); render();
  }});
}
function editAgency(id){
  const a=S.agencies.find(x=>x.id===id);
  openModal({title:'Edytuj agencję',html:agencyForm(a),submitLabel:'Zapisz',onSubmit:()=>{
    const name=gv('ag_name').trim(); if(!name) return false;
    Object.assign(a,{name,website:gv('ag_web'),notes:gv('ag_notes')});
    persistAndSync(KEYS.agencies,S.agencies); render();
  }});
}
function deleteAgency(id){
  if(!isOwner()){ alert('⛔ Tylko właściciel grupy może usuwać agencje.'); return; }
  confirm('Usunąć agencję?',()=>{ sbDelete(KEYS.agencies,id); S.agencies=S.agencies.filter(a=>a.id!==id); localStorage.setItem(KEYS.agencies,JSON.stringify(S.agencies)); render(); });
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {renderAgencies, agencyForm, addAgency, editAgency, deleteAgency});
