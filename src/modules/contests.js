// ═══════════════════════════════════════════════════════════
// CONTESTS — konkursy
// ═══════════════════════════════════════════════════════════

function resultsDeadlineHtml(date){
  const d=daysLeft(date);
  if(d===null) return '';
  if(d<0) return '<span style="color:#6b7280">(minął)</span>';
  if(d===0) return '<span style="color:#8b5cf6;font-weight:700">dziś!</span>';
  return `<span style="color:#8b5cf6;font-weight:700">(za ${d}d)</span>`;
}

function deadlineHtml(date){
  const d=daysLeft(date);
  if(d===null) return '<span style="color:#475569">—</span>';
  const c=d<0?'#475569':d<=2?'#ef4444':d<=7?'#f59e0b':'#22c55e';
  const t=d<0?'Minął':d===0?'Dziś!':`${d}d`;
  return `<span style="color:${c};font-weight:700;font-size:13px">${t}</span>`;
}

// ── Tagi konkursów ────────────────────────────────────────────────────────────
function tagBadge(tagId){
  const t=TAGS.find(x=>x.id===tagId);
  if(!t) return '';
  return `<span style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;white-space:nowrap">${t.label}</span>`;
}

function tagsFieldHtml(selected=[]){
  return '<div class="field"><label>Tagi</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px">'+
    TAGS.map(t=>{
      const on=selected.includes(t.id);
      return `<button type="button" onclick="toggleTag('${t.id}',this)"
        data-tagid="${t.id}"
        style="background:${on?t.color+'33':'#1e2a3a'};color:${on?t.color:'#64748b'};border:1px solid ${on?t.color+'55':'#2d3548'};border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:${on?700:400}"
        >${t.label}</button>`;
    }).join('')+
  '</div></div>';
}

function toggleTag(tagId, btn){
  const on=btn.style.fontWeight==='700';
  const t=TAGS.find(x=>x.id===tagId);
  if(!t) return;
  if(on){
    btn.style.background='#1e2a3a'; btn.style.color='#64748b';
    btn.style.borderColor='#2d3548'; btn.style.fontWeight='400';
  } else {
    btn.style.background=t.color+'33'; btn.style.color=t.color;
    btn.style.borderColor=t.color+'55'; btn.style.fontWeight='700';
  }
}

function getSelectedTags(){
  return [...document.querySelectorAll('[data-tagid]')]
    .filter(b=>b.style.fontWeight==='700')
    .map(b=>b.dataset.tagid);
}

// Sklepy
function shopBadge(name){return '<span style="background:#ef444422;color:#f87171;border:1px solid #ef444455;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap">🏪 '+esc(name)+'</span>';}

function shopsFieldHtml(selected){
  selected=selected||[];
  const val=selected.join(', ');
  return '<div class="field">'+
    '<label>Sklepy (gdzie wymagany zakup)</label>'+
    '<div style="font-size:11px;color:#475569;margin-bottom:5px">Wpisz nazwy sklepów oddzielone przecinkami. AI uzupełni automatycznie z regulaminu.</div>'+
    '<input id="c_shops_input" type="text" value="'+esc(val)+'" placeholder="np. Biedronka, Lidl, Żabka" style="background:#0a0e1a;border:1px solid #2d3548;border-radius:8px;color:#f1f5f9;padding:8px 12px;width:100%;font-size:13px;outline:none;box-sizing:border-box">'+
    '</div>';
}

function getSelectedShops(){
  const inp=document.getElementById('c_shops_input');
  if(!inp||!inp.value.trim()) return [];
  return inp.value.split(',').map(s=>s.trim()).filter(Boolean);
}

function entriesToday(contestId){
  const today=ktTodayStr();
  return S.entries.filter(e=>e.contestId===contestId && e.date===today).length;
}

function limitBadgeHtml(contest){
  const limit=parseDailyLimit(contest.notes||contest.conditions||'');
  if(!limit) return '';
  const used=entriesToday(contest.id);
  const left=limit-used;
  const col=left<=0?'#ef4444':left<=2?'#f59e0b':'#22c55e';
  const bg=left<=0?'#ef444418':left<=2?'#f59e0b18':'#22c55e18';
  const txt=left<=0?'⛔ Limit dzienny wyczerpany':'📊 Dziś: '+used+'/'+limit+' · zostało '+left;
  return '<div style="display:inline-flex;align-items:center;gap:5px;background:'+bg+';border:1px solid '+col+'44;border-radius:6px;padding:3px 9px;font-size:11px;color:'+col+';font-weight:600;margin-top:4px">'+txt+'</div>';
}

// ─── Archiwizacja konkursu ────────────────────────────────────────────────────
function archiveContest(id){
  const ct=S.contests.find(x=>x.id===id);
  if(!ct) return;
  ct.status='ended';
  persistAndSync(KEYS.contests,S.contests);
  render();
}

function unarchiveContest(id){
  const ct=S.contests.find(x=>x.id===id);
  if(!ct) return;
  ct.status='active';
  persistAndSync(KEYS.contests,S.contests);
  render();
}

function contestCardHtml(c){
  const ag=S.agencies.find(a=>a.id===c.agencyId);
  const ce=S.entries.filter(e=>e.contestId===c.id);
  const d=daysLeft(c.deadline);
  const isUrgent=d!==null&&d>=0&&d<=2&&c.status==='active';
  const hasShops=c.shops&&c.shops.length>0;
  const cid='c_'+c.id.replace(/-/g,'');

  const collapseBtn=(id,txt,content,previewLen=120)=>{
    if(!content) return '';
    const short=content.length<=previewLen;
    return `<div style="margin-top:5px">
      <span style="font-size:12px;color:#94a3b8">${esc(content.slice(0,previewLen))}${short?'':'…'}</span>
      ${!short?`<span id="${id}_full" style="display:none;font-size:12px;color:#94a3b8">${esc(content.slice(previewLen))}</span>
      <button onclick="const f=document.getElementById('${id}_full');const show=f.style.display==='none';f.style.display=show?'inline':'none';this.textContent=show?'▴ zwiń':'▾ więcej'"
        style="background:none;border:none;color:#475569;font-size:11px;cursor:pointer;padding:0 4px">▾ więcej</button>`:''}
    </div>`;
  };

  return `<div class="card" style="border-color:${isUrgent?'#ef444466':hasShops?'#ef444433':'#2d3548'};padding:12px 14px">

    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">

      <div style="flex:1;min-width:0">
        <!-- Wiersz 1: nazwa + status + pilne -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <span style="font-weight:700;color:#f1f5f9;font-size:14px">${esc(c.name)}${c.products?`<span style="font-weight:400;color:#94a3b8;font-size:13px"> (${esc(c.products)})</span>`:''}</span>
          ${badge(c.status)}
          ${isUrgent?'<span style="font-size:11px;color:#ef4444;font-weight:700">🔴 PILNE</span>':''}
        </div>

        <!-- Wiersz 2: nagroda -->
        ${c.prize?`<div style="font-size:13px;color:#fbbf24;margin-bottom:6px">🏆 ${esc(c.prize)}${c.prize_value?' · <span style="color:#fb923c">'+esc(c.prize_value)+'</span>':''}</div>`:''}

        <!-- Wiersz 3: meta — agencja · deadline · wyniki -->
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:#64748b;margin-bottom:6px">
          ${ag?`<span style="color:#94a3b8;font-weight:500">${esc(ag.name)}</span><span style="color:#2d3548">·</span>`:''}
          <span>📅 ${fmt(c.deadline)}</span>
          ${deadlineHtml(c.deadline)}
          ${c.results_date?`<span style="color:#2d3548">·</span><span style="color:#8b5cf6">🎯 wyniki: ${fmt(c.results_date)} ${resultsDeadlineHtml(c.results_date)}</span>`:''}
        </div>

        <!-- Wiersz 4: sklepy (jeśli są) -->
        ${hasShops?`<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:6px">
          <span style="font-size:11px;color:#ef4444;font-weight:700">⚠️ tylko w:</span>
          ${c.shops.map(s=>shopBadge(s)).join('')}
        </div>`:''}

        <!-- Wiersz 5: tagi -->
        ${c.tags&&c.tags.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${c.tags.map(t=>tagBadge(t)).join('')}</div>`:''}

        <!-- Zadanie — zawsze widoczne (zwykle krótkie) -->
        ${c.task?`<div style="background:#6366f111;border:1px solid #6366f133;border-radius:6px;padding:6px 10px;margin-bottom:5px;font-size:12px;color:#818cf8"><strong>🎯</strong> ${esc(c.task)}</div>`:''}

        <!-- Warunki — zwinięte -->
        ${c.conditions?`<div style="margin-top:4px"><span style="font-size:11px;color:#475569;font-weight:600">📋 Warunki:</span>${collapseBtn(cid+'_cond','',c.conditions,120)}</div>`:''}

        <!-- Notatki — zwinięte -->
        ${c.notes?`<div style="margin-top:3px"><span style="font-size:11px;color:#475569;font-weight:600">💡 Notatki:</span>${collapseBtn(cid+'_notes','',c.notes,80)}</div>`:''}

        <!-- Stopka: liczba zgłoszeń + limit -->
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap">
          <span style="font-size:12px;color:#475569">${ce.length} zgłoszeń${c.status==='ended'&&ce.length>0?(()=>{
            const w=ce.filter(e=>['won','prize_received','prize_pending'].includes(e.status)).length;
            return w>0?' · <span style="color:#22c55e;font-weight:600">🏆 '+w+' wygranych</span>':' · <span style="color:#ef4444">0 wygranych</span>';
          })():''}</span>
          ${c.status==='active'?limitBadgeHtml(c):''}
        </div>
      </div>

      <!-- Przyciski akcji — pionowo po prawej -->
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
        ${c.status==='active'?`<button class="btn-sm" style="background:#22c55e22;color:#4ade80;border:1px solid #22c55e33;white-space:nowrap" onclick="addEntry('${c.id}')">+ Zgłoś</button>`:''}
        ${c.link?`<button onclick="window.open('${esc(fixUrl(c.link))}','_blank','noopener,noreferrer')" style="padding:4px 10px;background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">🔗 Zgłoś się</button>`:''}
        ${c.rules_link?`<a href="${esc(fixUrl(c.rules_link))}" target="_blank" style="padding:4px 10px;background:#1e2a3a;color:#64748b;border:1px solid #2d3548;border-radius:7px;text-decoration:none;font-size:12px;white-space:nowrap">📄 Regulamin</a>`:''}
        <div style="display:flex;gap:5px">
          <button class="btn-sec btn-sm" onclick="editContest('${c.id}')">✏️</button>
          <button class="btn-sm" style="background:#ef444422;color:#f87171;border:1px solid #ef444433" onclick="deleteContest('${c.id}')">🗑</button>
        </div>
      </div>

    </div>
  </div>`;
}

function renderContests(){
  const filters=[['active','Aktywne'],['planned','Planowane'],['ended','📦 Archiwum'],['all','Wszystkie']];
  const sq=contestSearch.toLowerCase().trim();
  const filtered=S.contests.filter(c=>{
    const statusOk=contestFilter==='all'||c.status===contestFilter;
    const tagOk=!contestTagFilter||(c.tags&&c.tags.includes(contestTagFilter));
    const shopOk=!contestShopFilter||(c.shops&&c.shops.includes(contestShopFilter));
    const searchOk=!sq||
      (c.name&&c.name.toLowerCase().includes(sq))||
      (c.prize&&c.prize.toLowerCase().includes(sq))||
      (c.conditions&&c.conditions.toLowerCase().includes(sq))||
      (S.agencies.find(a=>a.id===c.agencyId)?.name?.toLowerCase().includes(sq));
    return statusOk&&tagOk&&shopOk&&searchOk;
  }).sort((a,b)=>{
    if(contestSort==='deadline'){
      if(!a.deadline&&!b.deadline) return 0;
      if(!a.deadline) return 1;
      if(!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    if(contestSort==='name') return (a.name||'').localeCompare(b.name||'');
    if(contestSort==='prize'){
      const pv=s=>{const m=(s||'').match(/(\d[\d\s]*(?:[,.]\d+)?)/);return m?parseFloat(m[1].replace(/\s/g,'').replace(',','.')):0;};
      return pv(b.prize_value)-pv(a.prize_value);
    }
    if(contestSort==='added') return (b.id||'').localeCompare(a.id||'');
    return 0;
  });

  const list=filtered.map(c=>contestCardHtml(c)).join('');
;

  return `
    <div class="row" style="justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <h1 style="font-size:22px;font-weight:800;color:#f1f5f9">Konkursy</h1>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select onchange="setContestSort(this.value)" style="background:#1e2a3a;border:1px solid #2d3548;border-radius:7px;color:#94a3b8;padding:5px 10px;font-size:12px;cursor:pointer">
          <option value="deadline" ${contestSort==='deadline'?'selected':''}>⏰ Termin</option>
          <option value="name" ${contestSort==='name'?'selected':''}>🔤 Nazwa</option>
          <option value="prize" ${contestSort==='prize'?'selected':''}>💰 Nagroda</option>
          <option value="added" ${contestSort==='added'?'selected':''}>🆕 Dodane</option>
        </select>
        <button class="btn-gemini btn-sm" onclick="setTab('ai')">✨ Dodaj konkurs z AI</button>
        <button class="btn-primary" onclick="addContest()">+ Ręcznie</button>
      </div>
    </div>
    <div style="position:relative;margin-bottom:12px">
      <input type="text" id="contest_search_inp" value="${esc(contestSearch)}" placeholder="🔍 Szukaj — nazwa, agencja, nagroda..."
        oninput="contestSearchDebounced(this.value)"
        style="background:#131929;border:1px solid #2d3548;border-radius:10px;color:#f1f5f9;padding:10px 36px 10px 14px;width:100%;font-size:14px;outline:none;box-sizing:border-box">
      ${contestSearch?'<button onclick="window.contestSearch=\'\';render()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;font-size:16px">✕</button>':''}
    </div>
    <div class="filter-tabs" style="margin-bottom:8px">${filters.map(([v,l])=>`
      <button class="${contestFilter===v?'active':''}" onclick="setContestFilter('${v}')">${l} (${v==='all'?S.contests.length:S.contests.filter(c=>c.status===v).length})</button>`).join('')}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;align-items:center">
      <span style="font-size:11px;color:#475569;margin-right:2px">Tagi:</span>
      <button onclick="setContestTag('')"
        style="padding:3px 10px;font-size:11px;border:none;border-radius:6px;cursor:pointer;background:${!contestTagFilter?'#6366f1':'#1e2a3a'};color:${!contestTagFilter?'#fff':'#64748b'}">
        Wszystkie
      </button>
      ${TAGS.map(t=>{
        const cnt=S.contests.filter(c=>c.tags&&c.tags.includes(t.id)).length;
        if(cnt===0) return '';
        const on=contestTagFilter===t.id;
        return `<button onclick="setContestTag('${t.id}')"
          style="padding:3px 10px;font-size:11px;border:1px solid ${on?t.color+'55':'#2d3548'};border-radius:6px;cursor:pointer;background:${on?t.color+'33':'#1e2a3a'};color:${on?t.color:'#64748b'};font-weight:${on?700:400}">
          ${t.label} <span style="opacity:.7">(${cnt})</span>
        </button>`;
      }).join('')}
    </div>
    <div id="contests_list">${contestSearch&&!filtered.length?'<p style="color:#475569;text-align:center;padding:48px">Brak wyników dla: <strong>'+esc(contestSearch)+'</strong></p>':(list||'<p style="color:#475569;text-align:center;padding:48px">Brak konkursów w tej kategorii</p>')}`;
}

function setContestFilter(f){ window.contestFilter=f; render(); }

// Debounce dla wyszukiwarki - nie rerenderuje przy każdej literce
function contestSearchDebounced(val){
  window.contestSearch=val;
  clearTimeout(_searchTimer);
  window._searchTimer=setTimeout(()=>{
    // Zapisz pozycję kursora
    const inp=document.getElementById('contest_search_inp');
    const pos=inp?inp.selectionStart:0;
    // Renderuj tylko listę konkursów bez przeładowania całej strony
    renderContestList();
  },150);
}

function renderContestList(){
  // Renderuj tylko karty konkursów i filtr sklepów - bez całej strony
  const listEl=document.getElementById('contests_list');
  if(!listEl) { render(); return; }
  const sq=contestSearch.toLowerCase().trim();
  const filtered=S.contests.filter(c=>{
    const statusOk=contestFilter==='all'||c.status===contestFilter;
    const tagOk=!contestTagFilter||(c.tags&&c.tags.includes(contestTagFilter));
    const shopOk=!contestShopFilter||(c.shops&&c.shops.includes(contestShopFilter));
    const searchOk=!sq||
      (c.name&&c.name.toLowerCase().includes(sq))||
      (c.prize&&c.prize.toLowerCase().includes(sq))||
      (c.conditions&&c.conditions.toLowerCase().includes(sq))||
      (S.agencies.find(a=>a.id===c.agencyId)?.name?.toLowerCase().includes(sq));
    return statusOk&&tagOk&&shopOk&&searchOk;
  }).sort((a,b)=>{
    if(contestSort==='deadline'){
      if(!a.deadline&&!b.deadline) return 0;
      if(!a.deadline) return 1;
      if(!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    if(contestSort==='name') return (a.name||'').localeCompare(b.name||'');
    if(contestSort==='prize'){
      const pv=s=>{const m=(s||'').match(/(\d[\d\s]*(?:[,.]\d+)?)/);return m?parseFloat(m[1].replace(/\s/g,'').replace(',','.')):0;};
      return pv(b.prize_value)-pv(a.prize_value);
    }
    if(contestSort==='added') return (b.id||'').localeCompare(a.id||'');
    return 0;
  });
  const html=filtered.map(ct=>contestCardHtml(ct)).join('');
  listEl.innerHTML=html||
    (sq?`<p style="color:#475569;text-align:center;padding:48px">Brak wyników dla: <strong>${esc(sq)}</strong></p>`
       :'<p style="color:#475569;text-align:center;padding:48px">Brak konkursów w tej kategorii</p>');
  // Przywróć focus na pole
  const inp=document.getElementById('contest_search_inp');
  if(inp){ const l=inp.value.length; inp.focus(); inp.setSelectionRange(l,l); }
}
function setContestTag(t){ window.contestTagFilter=t; render(); }
function setContestShop(s){ window.contestShopFilter=s; render(); }
function setContestSort(s){ window.contestSort=s; render(); }

function contestForm(c={}){
  return `
    ${field('Nazwa *',
      `<input id="c_name" type="text" value="${esc(c.name||'')}"
        oninput="const w=document.getElementById('c_name_warn');if(w)w.style.display=this.value.trim()?'none':'block'">`,
      `<span id="c_name_warn" style="color:#ef4444;font-size:11px;display:${c.name?'none':'block'}">⛔ Nazwa jest wymagana</span>`)}
    ${field('Agencja',fsel('c_agency',agencyOpts(),c.agencyId||''),
      !c.agencyId?'<span style="color:#64748b;font-size:11px">💡 Bez agencji statystyki będą niepełne</span>':'')}
    ${field('Nagroda',finp('c_prize',c.prize||'','text','np. 10 000 zł, Samochód'))}
    ${field('Produkty konkursowe',finp('c_products',c.products||'','text','np. Pepsi, Lay\'s, Tymbark (pojawi się w nawiasie przy nazwie)'),'<span style="font-size:11px;color:#64748b">Opcjonalnie — gdy nazwa konkursu nie wskazuje jakie produkty kupić</span>')}
    <div class="grid2">
      ${field('Termin zgłoszeń',finp('c_deadline',c.deadline||'','date'),
      !c.deadline?'<span style="color:#f59e0b;font-size:11px">⚠️ Brak terminu — konkurs nie pojawi się w kalendarzu</span>':'')}
      ${field('Termin wyników',finp('c_results_date',c.results_date||'','date'))}
    </div>
    ${field('Warunki uczestnictwa',ftex('c_cond',c.conditions||''))}
    ${field('🎯 Zadanie konkursowe',ftex('c_task',c.task||''))}
    <div class="grid2">
      ${field('Link do zgłoszeń',finp('c_link',c.link||'','url','https://strona-konkursu.pl/zgloszenia'))}
      ${field('Link do regulaminu (opcjonalnie)',finp('c_rules_link',c.rules_link||'','url','https://strona-konkursu.pl/regulamin'))}
    </div>
    ${field('Status',fsel('c_status',[['planned','Planowany'],['active','Aktywny'],['ended','Zakończony']],c.status||'active'))}
    ${field('Notatki / luki w regulaminie',ftex('c_notes',c.notes||''))}
    ${shopsFieldHtml(c.shops||[])}
    ${tagsFieldHtml(c.tags||[])}`;
}
function addContest(){
  openModal({title:'Nowy konkurs',html:contestForm(),submitLabel:'Zapisz',onSubmit:()=>{
    const name=gv('c_name').trim(); if(!name) return false;
    const _dl=gv('c_deadline');
    if(_dl && new Date(_dl) < new Date() && !window._deadlineWarned){
      if(!confirm('⚠️ Deadline '+fmt(_dl)+' już minął. Dodać mimo to?')) return false;
    }
    S.contests.push({id:uid(),name,agencyId:gv('c_agency'),prize:gv('c_prize'),prize_value:gv('c_prize_value'),products:gv('c_products'),deadline:gv('c_deadline'),results_date:gv('c_results_date'),conditions:gv('c_cond'),task:gv('c_task'),link:gv('c_link'),rules_link:gv('c_rules_link'),status:gv('c_status'),notes:gv('c_notes'),tags:getSelectedTags(),shops:getSelectedShops()});
    persistAndSync(KEYS.contests,S.contests); render();
  }});
}
function editContest(id){
  const c=S.contests.find(x=>x.id===id);
  openModal({title:'Edytuj konkurs',html:contestForm(c),submitLabel:'Zapisz',onSubmit:()=>{
    const name=gv('c_name').trim(); if(!name) return false;
    Object.assign(c,{name,agencyId:gv('c_agency'),prize:gv('c_prize'),prize_value:gv('c_prize_value'),products:gv('c_products'),deadline:gv('c_deadline'),results_date:gv('c_results_date'),conditions:gv('c_cond'),task:gv('c_task'),link:gv('c_link'),rules_link:gv('c_rules_link'),status:gv('c_status'),notes:gv('c_notes'),tags:getSelectedTags(),shops:getSelectedShops()});
    persistAndSync(KEYS.contests,S.contests); render();
  }});
}
function deleteContest(id){
  if(!isOwner()){ alert('⛔ Tylko właściciel grupy może usuwać konkursy.'); return; }
  confirm('Usunąć konkurs?',()=>{ sbDelete(KEYS.contests,id); S.contests=S.contests.filter(c=>c.id!==id); localStorage.setItem(KEYS.contests,JSON.stringify(S.contests)); render(); });
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {resultsDeadlineHtml, deadlineHtml, tagBadge, tagsFieldHtml, toggleTag, getSelectedTags, shopBadge, shopsFieldHtml, getSelectedShops, entriesToday, limitBadgeHtml, archiveContest, unarchiveContest, contestCardHtml, renderContests, setContestFilter, contestSearchDebounced, renderContestList, setContestTag, setContestShop, setContestSort, contestForm, addContest, editContest, deleteContest});
