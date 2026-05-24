// ═══════════════════════════════════════════════════════════
// ENTRIES — zgłoszenia
// ═══════════════════════════════════════════════════════════

// Add entry from contest
function addEntry(contestId){
  // Jeśli brak contestId - pokaż listę wyboru konkursu
  if(!contestId){
    const activeContests = S.contests
      .filter(x=>x.status==='active'||x.status==='planned')
      .sort((a,b)=>a.name.localeCompare(b.name,'pl'));
    if(!activeContests.length){ alert('Brak aktywnych konkursów. Dodaj najpierw konkurs.'); return; }
    const opts=[['','— wybierz konkurs —'],...activeContests.map(x=>[x.id,x.name+(x.deadline?' · '+fmt(x.deadline):'')])]
    openModal({title:'+ Dodaj zgłoszenie',html:`
      ${field('Konkurs',fsel('ae_contest',opts,''))}`,
      submitLabel:'Dalej →',
      onSubmit:()=>{
        const cid=gv('ae_contest');
        if(!cid){ alert('Wybierz konkurs'); return false; }
        addEntry(cid);
        return true;
      }
    });
    return;
  }
  const c=S.contests.find(x=>x.id===contestId);
  // Ostrzeżenie o limicie dziennym
  const dailyLimit=parseDailyLimit(c.notes||c.conditions||'');
  if(dailyLimit){
    const usedToday=entriesToday(contestId);
    if(usedToday>=dailyLimit){
      showConfirm('⛔ UWAGA: Dziś wysłałeś już '+usedToday+' zgłoszeń dla tego konkursu, a limit to '+dailyLimit+'/dzień.\n\nKolejne zgłoszenie może spowodować dyskwalifikację. Kontynuować mimo to?',
        ()=>addEntry(contestId, true));
      return;
    }
  }
  const ag=S.agencies.find(a=>a.id===c.agencyId);
  const playerOpts=[['','— wybierz gracza —'],...S.players.map(p=>[p.id,p.name])];

  const mid=openModal({title:`Zgłoś do: ${c.name}`,html:`
    <div style="background:var(--bg);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--text-2)">
      Agencja: <strong style="color:var(--text)">${esc(ag?.name||'—')}</strong>
    </div>
    ${field('Gracz',fsel('e_player',playerOpts,''))}
    <div id="profile_field">${field('Profil danych',fsel('e_profile',[['','— wybierz gracza —']]))}</div>
    ${field('Data',finp('e_date',today(),'date'))}
    <div id="receipt_sel_field"></div>
    ${field('Status',fsel('e_status',[['sent','Wysłano'],['pending','Oczekuje wyników'],['contacted','Kontaktowali się'],['prize_pending','Nagroda w drodze'],['prize_received','Nagroda odebrana'],['won','Wygrano'],['lost','Przegrano'],['no_response','Brak odpowiedzi'],['expired','Termin minął']],'sent'))}
    ${c.task?`<div style="background:#6366f111;border:1px solid #6366f133;border-radius:8px;padding:8px 12px;margin-bottom:4px;font-size:12px;color:#818cf8"><strong>🎯 Zadanie:</strong> ${esc(c.task)}</div>`:''}
    <div class="field"><label>✏️ Moja odpowiedź konkursowa</label>
      <textarea id="e_answer" style="min-height:90px;border-color:#6366f133" placeholder="Wpisz swoją odpowiedź/hasło konkursowe..."></textarea>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span id="e_dup_warn" style="font-size:11px;color:#f59e0b"></span>
        <span id="e_answer_count" style="font-size:11px;color:var(--text-4)">0 znaków</span>
      </div>
    </div>
    <div id="e_history_box"></div>
    <div class="field"><label>🔑 Kody konkursowe (opcjonalnie)</label>
      <textarea id="e_codes" style="min-height:60px;border-color:#2d3548;font-family:monospace;font-size:13px" placeholder="Wpisz użyte kody, jeden w każdej linii&#10;np. VBG4FK2&#10;ABC123"></textarea>
      <div id="e_codes_warn" style="font-size:11px;color:#ef4444;margin-top:4px"></div>
      <div style="font-size:11px;color:var(--text-4);margin-top:2px">Aplikacja ostrzeże jeśli kod był już użyty w tym konkursie</div>
    </div>
    ${field('Notatki',ftex('e_notes',''))}`,
    submitLabel:'Zapisz',onSubmit:()=>{
      const playerId=gv('e_player');
      if(!playerId){ alert('⚠️ Wybierz gracza'); return false; }
      const edate=gv('e_date');
      if(!edate){ alert('⚠️ Data zgłoszenia jest wymagana'); return false; }
      const receiptId=document.getElementById('e_receipt')?.value||'';
      const answer=document.getElementById('e_answer')?.value||'';
      // Ostrzeżenie o podobnej odpowiedzi u tej samej agencji
      if(answer&&answer.trim().length>=10){
        const similar=findSimilarAnswers(answer,c.agencyId,null);
        if(similar.length){
          const top=similar[0];
          const pct=Math.round(top.similarity*100);
          // Pokaż ostrzeżenie ale nie blokuj - user może zapisać mimo to
        console.warn('Podobna odpowiedź', pct+'%');
        }
      }
      const codes=document.getElementById('e_codes')?.value||'';
      // Sprawdź duplikaty kodów
      const dupCodes=findDuplicateCodes(codes,contestId,null);
      if(dupCodes.length){
        if(!window.confirm('⚠️ Kody już użyte w tym konkursie: '+dupCodes.join(', ')+'\n\nDodać mimo to?')) return false;
      }
      // Blokada: ten sam paragon nie może być użyty 2x w tym samym konkursie
      if(receiptId){
        const alreadyUsed=S.entries.find(e=>e.receiptId===receiptId&&e.contestId===contestId);
        if(alreadyUsed){
          const p=S.players.find(x=>x.id===alreadyUsed.playerId);
          openModal({title:'⚠️ Paragon już użyty',
            html:`<p style="color:#cbd5e1">Ten paragon jest już przypisany do zgłoszenia w tym konkursie.<br><br>
            <span style="color:var(--text-3);font-size:12px">Gracz: ${esc(p?.name||'?')} · Data: ${fmt(alreadyUsed.date)}</span></p>
            <p style="color:#f59e0b;font-size:12px;margin-top:8px">Regulaminy zazwyczaj zabraniają używania tego samego paragonu do wielu zgłoszeń.</p>`,
            submitLabel:'Zamknij', onSubmit:()=>true
          });
          return false;
        }
      }
      S.entries.push({id:uid(),contestId,playerId,profileId:gv('e_profile'),date:gv('e_date'),status:gv('e_status'),notes:gv('e_notes'),receiptId,answer,codes});
      persistAndSync(KEYS.entries,S.entries); render();
    }});

  // Licznik znaków + live wykrywanie duplikatów
  setTimeout(()=>{
    const ans=document.getElementById('e_answer');
    const cnt=document.getElementById('e_answer_count');
    const dup=document.getElementById('e_dup_warn');
    if(ans&&cnt){
      ans.addEventListener('input',()=>{
        const n=ans.value.length;
        cnt.textContent=n+' znaków';
        cnt.style.color=n>250?'#f59e0b':n>300?'#ef4444':'#475569';
        // Sprawdź duplikaty odpowiedzi na żywo
        if(dup){
          const sim=findSimilarAnswers(ans.value,c.agencyId,null);
          if(sim.length){
            const pct=Math.round(sim[0].similarity*100);
            dup.textContent='⚠️ '+pct+'% podobne do: '+sim[0].contest.name;
          } else {
            dup.textContent='';
          }
        }
        // Sprawdź duplikaty kodów na żywo
        setTimeout(()=>{
          const codesEl=document.getElementById('e_codes');
          const codesWarn=document.getElementById('e_codes_warn');
          if(codesEl&&codesWarn){
            codesEl.addEventListener('input',()=>{
              const dupes=findDuplicateCodes(codesEl.value,contestId,null);
              codesWarn.textContent=dupes.length?'⚠️ Już użyte kody: '+dupes.join(', '):'';
            });
          }
        },50);
      });
    }
    // Pokaż historię odpowiedzi tej agencji
    const histBox=document.getElementById('e_history_box');
    if(histBox){
      const agAnswers=[];
      S.entries.forEach(e=>{
        if(!e.answer||e.answer.trim().length<5) return;
        const ct=S.contests.find(x=>x.id===e.contestId);
        if(ct&&ct.agencyId===c.agencyId){
          agAnswers.push({entry:e,contest:ct});
        }
      });
      if(agAnswers.length){
        histBox.innerHTML='<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">'+
          '<div style="font-size:11px;color:var(--text-3);font-weight:600;margin-bottom:6px">📚 Twoje wcześniejsze odpowiedzi dla tej agencji ('+agAnswers.length+')</div>'+
          agAnswers.slice(0,5).map(a=>
            '<div style="font-size:11px;color:var(--text-2);padding:5px 0;border-top:1px solid #1e2a3a">'+
            '<span style="color:#6366f1">'+esc(a.contest.name)+':</span> '+
            esc(a.entry.answer.slice(0,100))+(a.entry.answer.length>100?'…':'')+'</div>'
          ).join('')+
          '</div>';
      }
    }
  },100);

  // Dynamic profile update
  document.getElementById('e_player').addEventListener('change',function(){
    const playerId=this.value;
    const profs=S.profiles.filter(p=>p.playerId===playerId&&p.agencyId===c.agencyId);
    const opts=profs.length
      ? [['','— wybierz profil —'],...profs.map(p=>[p.id,`${p.email} · ${(p.bank||'').slice(0,10)}...`])]
      : [['','⚠️ Brak profilu dla tej agencji']];
    document.getElementById('profile_field').innerHTML=field('Profil danych',fsel('e_profile',opts));
    if(!profs.length) document.getElementById('profile_field').insertAdjacentHTML('beforeend','<div style="font-size:12px;color:#ef4444;margin-top:4px">Dodaj profil w sekcji Gracze</div>');
    // Paragony gracza
    const recs=S.receipts.filter(r=>r.playerId===playerId&&!r.settled);
    const recOpts=[['','— brak / bez paragonu —'],...recs.map(r=>{
      const [col,lbl]=receiptStatus(r);
      return [r.id, (r.shop||'Paragon')+' '+(r.date||'')+(r.amount?' · '+r.amount+'zł':'')+' ['+lbl+']'];
    })];
    const rsf=document.getElementById('receipt_sel_field');
    if(rsf) rsf.innerHTML=field('Paragon do zgłoszenia',fsel('e_receipt',recOpts));
  });
}

// ═══════════════════════════════════════════════════════════
// ENTRIES
// ═══════════════════════════════════════════════════════════
// ── Faza 3: Historia odpowiedzi i wykrywanie duplikatów ──────────────────────
// Normalizuje tekst do porównań (małe litery, bez interpunkcji, bez nadmiarowych spacji)

// ─── Kody konkursowe ──────────────────────────────────────────────────────────
function findDuplicateCodes(codes, contestId, excludeEntryId){
  if(!codes||!codes.trim()) return [];
  const newCodes=codes.split(/[\n,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
  const dupes=[];
  S.entries.forEach(e=>{
    if(e.id===excludeEntryId) return;
    if(e.contestId!==contestId) return;
    if(!e.codes) return;
    const used=e.codes.split(/[\n,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    newCodes.forEach(code=>{
      if(used.includes(code)) dupes.push(code);
    });
  });
  return [...new Set(dupes)];
}
function normAnswer(t){
  return (t||'').toLowerCase()
    .replace(/[.,!?;:"'()\[\]\-\u2013\u2014]/g,' ')
    .replace(/\s+/g,' ').trim();
}

// Liczy podobieństwo dwóch tekstów (0-1) metodą wspólnych słów (Jaccard)
function answerSimilarity(a,b){
  const wa=new Set(normAnswer(a).split(' ').filter(w=>w.length>2));
  const wb=new Set(normAnswer(b).split(' ').filter(w=>w.length>2));
  if(wa.size===0||wb.size===0) return 0;
  let common=0;
  wa.forEach(w=>{ if(wb.has(w)) common++; });
  return common/Math.max(wa.size,wb.size);
}

// Znajduje zgłoszenia z podobną odpowiedzią u tej samej agencji
function findSimilarAnswers(answer, agencyId, excludeEntryId){
  if(!answer||answer.trim().length<10) return [];
  const out=[];
  S.entries.forEach(e=>{
    if(e.id===excludeEntryId) return;
    if(!e.answer||e.answer.trim().length<10) return;
    const ct=S.contests.find(x=>x.id===e.contestId);
    if(!ct||ct.agencyId!==agencyId) return;
    const sim=answerSimilarity(answer,e.answer);
    if(sim>=0.6){
      out.push({entry:e,contest:ct,similarity:sim});
    }
  });
  return out.sort((a,b)=>b.similarity-a.similarity);
}

// ─── Zakładka Paragony ────────────────────────────────────────────────────────
// (renderReceiptsTab..assignReceiptToEntry → src/modules/receipts.js)

// ── Zdjęcia nagród w Storage ──────────────────────────────────────────────────
async function uploadPrizePhoto(base64data, entryId){
  if(!base64data||!_sb) return null;
  try{
    const res=await fetch(base64data);
    const blob=await res.blob();
    const ext=blob.type.includes('png')?'png':'jpg';
    const path=_currentFamilyId+'/prize_'+entryId+'.'+ext;
    const {data,error}=await _sb.storage.from('receipts').upload(path,blob,{upsert:true,contentType:blob.type});
    if(error){ console.warn('Prize upload error:',error.message); return null; }
    const {data:{publicUrl}}=_sb.storage.from('receipts').getPublicUrl(path);
    return publicUrl;
  }catch(e){ console.warn('uploadPrizePhoto:',e.message); return null; }
}

function showPrizePhotoModal(entryId){
  const e=S.entries.find(x=>x.id===entryId);
  if(!e) return;
  const ct=S.contests.find(x=>x.id===e.contestId);
  let previewHtml='<div id="prize_preview" style="margin-bottom:12px;min-height:60px;text-align:center"></div>';
  openModal({
    title:'📸 Zdjęcie nagrody — '+(ct?.name||''),
    html:`
      ${e.prize_photo?`<img src="${e.prize_photo}" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;margin-bottom:12px">`:''}
      ${previewHtml}
      <div class="field"><label>Dodaj/zmień zdjęcie nagrody</label>
        <div onclick="document.getElementById('prize_file_inp').click()"
          style="border:2px dashed #2d3548;border-radius:10px;padding:20px;text-align:center;cursor:pointer;color:var(--text-3);font-size:13px">
          📷 Kliknij aby wybrać zdjęcie
        </div>
        <input type="file" id="prize_file_inp" accept="image/*" style="display:none"
          onchange="previewPrizePhoto(this,'prize_preview')">
        <input type="hidden" id="prize_photo_data">
      </div>`,
    submitLabel:'Zapisz zdjęcie',
    onSubmit:async()=>{
      const data=document.getElementById('prize_photo_data')?.value||'';
      if(!data&&!e.prize_photo){ alert('Wybierz zdjęcie'); return false; }
      if(data){
        const btn=document.querySelector('.overlay .btn-primary');
        if(btn){ btn.textContent='Wysyłam...'; btn.disabled=true; }
        const url=await uploadPrizePhoto(data, entryId);
        if(!url){ alert('Błąd wysyłania zdjęcia'); return false; }
        e.prize_photo=url;
        persistAndSync(KEYS.entries, S.entries);
      }
      render();
      return true;
    },
    extraButtons: e.prize_photo ? `<button onclick="deletePrizePhoto('${entryId}')" 
      style="padding:10px 16px;background:#ef444422;color:#f87171;border:1px solid #ef444433;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">
      🗑 Usuń zdjęcie</button>` : ''
  });
}

async function deletePrizePhoto(entryId){
  // Zamknij modal
  document.querySelectorAll('.overlay').forEach(m=>m.remove());
  const e=S.entries.find(x=>x.id===entryId);
  if(!e) return;
  // Usuń ze Storage
  if(_sb&&_currentFamilyId){
    try{
      await _sb.storage.from('receipts').remove([
        _currentFamilyId+'/prize_'+entryId+'.jpg',
        _currentFamilyId+'/prize_'+entryId+'.png'
      ]);
    }catch(err){ console.warn('Storage delete prize:', err.message); }
  }
  e.prize_photo='';
  persistAndSync(KEYS.entries, S.entries);
  render();
}

function previewPrizePhoto(inp, previewId){
  const file=inp.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    document.getElementById('prize_photo_data').value=ev.target.result;
    const prev=document.getElementById(previewId);
    if(prev) prev.innerHTML=`<img src="${ev.target.result}" style="max-height:120px;border-radius:8px;object-fit:contain">`;
  };
  reader.readAsDataURL(file);
}
function renderEntries(){
  const filtered=S.entries.filter(e=>
    (!entryFilterPlayer||e.playerId===entryFilterPlayer)&&
    (!entryFilterStatus||e.status===entryFilterStatus)
  ).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const list=filtered.map(e=>{
    const c=S.contests.find(x=>x.id===e.contestId);
    const p=S.players.find(x=>x.id===e.playerId);
    const ag=c?S.agencies.find(a=>a.id===c.agencyId):null;
    const pr=S.profiles.find(x=>x.id===e.profileId);
    return `<div class="card" style="border-radius:10px">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-weight:600;color:var(--text);font-size:14px">${esc(c?.name||'?')}</div>
          <div style="font-size:12px;color:var(--text-2)">${esc(p?.name||'?')} · ${esc(ag?.name||'?')} · ${fmt(e.date)}</div>
          ${pr?`<div style="font-size:11px;color:var(--text-4)">📧 ${esc(pr.email)}</div>`:''}
          ${e.notes?`<div style="font-size:12px;color:var(--text-3);font-style:italic">${esc(e.notes)}</div>`:''}
          ${(()=>{ const rc=e.receiptId?S.receipts.find(x=>x.id===e.receiptId):null; return rc?`<div style="display:flex;align-items:center;gap:5px;margin-top:2px">${rc.photo?`<img src="${rc.photo}" style="width:22px;height:22px;border-radius:3px;object-fit:cover">`:'🧾'}<span style="font-size:11px;color:var(--text-4)">${esc(rc.shop||'Paragon')}${rc.receipt_nr?' · nr '+esc(rc.receipt_nr):''}</span></div>`:''; })()}
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <button onclick="quickStatusMenu('${e.id}','${e.status}',this)"
            style="padding:3px 10px;font-size:11px;border-radius:6px;cursor:pointer;border:1px solid ${statusColor(e.status)}44;background:${statusColor(e.status)}18;color:${statusColor(e.status)};font-weight:600">
            ${badge(e.status)} ▾
          </button>
          <button class="btn-sec btn-sm" onclick="editEntry('${e.id}')">✏️</button>
          ${['won','prize_received','prize_pending'].includes(e.status)?`<button class="btn-sec btn-sm" onclick="showPrizePhotoModal('${e.id}')" title="Zdjęcie nagrody" style="${e.prize_photo?'color:#22c55e':''}">📸</button>`:''}
          <button class="btn-sm" style="background:#ef444422;color:#f87171;border:1px solid #ef444433" onclick="deleteEntry('${e.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const playerSel=fsel('ef_player',[['','Wszyscy gracze'],...S.players.map(p=>[p.id,p.name])],entryFilterPlayer);
  const statusSel=fsel('ef_status',[['','Wszystkie statusy'],['sent','Wysłano'],['pending','Oczekuje wyników'],['contacted','Kontaktowali się'],['prize_pending','Nagroda w drodze'],['prize_received','Nagroda odebrana'],['won','Wygrano'],['lost','Przegrano'],['no_response','Brak odpowiedzi'],['expired','Termin minął']],entryFilterStatus);

  // ── Czekam na wyniki — zgłoszenia gdzie deadline minął a status wciąż oczekuje ──
  const awaitingResults=(()=>{
    const waiting=S.entries.filter(e=>['sent','pending','contacted'].includes(e.status));
    const items=waiting.map(e=>{
      const c=S.contests.find(x=>x.id===e.contestId);
      if(!c) return null;
      const deadlinePassed=c.deadline&&daysLeft(c.deadline)<0;
      const hasResultDate=!!c.results_date;
      // Pokaż jeśli: deadline minął LUB ma datę wyników
      if(!deadlinePassed&&!hasResultDate) return null;
      const dr=c.results_date?daysLeft(c.results_date):null;
      return {e,c,dr};
    }).filter(Boolean).sort((a,b)=>{
      // Najpierw z datą wyników (rosnąco), potem bez
      if(a.dr!==null&&b.dr===null) return -1;
      if(a.dr===null&&b.dr!==null) return 1;
      if(a.dr!==null&&b.dr!==null) return a.dr-b.dr;
      return (a.c.deadline||'').localeCompare(b.c.deadline||'');
    });
    if(!items.length) return '';
    return `<div style="background:#8b5cf611;border:1px solid #8b5cf633;border-radius:12px;padding:12px 14px;margin-bottom:14px">
      <div style="font-weight:700;color:#a78bfa;margin-bottom:8px;font-size:13px">🎯 Czekam na wyniki <span style="background:#8b5cf633;border-radius:10px;padding:1px 8px;font-size:12px;margin-left:4px">${items.length}</span></div>
      ${items.slice(0,8).map(({e,c,dr})=>{
        const p=S.players.find(x=>x.id===e.playerId);
        const col=dr===null?'#64748b':dr<=2?'#ef4444':dr<=7?'#f59e0b':'#8b5cf6';
        const drTxt=dr===null?'brak daty wyników':dr===0?'wyniki DZIŚ!':dr<0?'wyniki minęły':'wyniki za '+dr+'d';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2d3548;gap:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div>
            <div style="font-size:11px;color:var(--text-3)">${esc(p?.name||'?')} · <span style="color:${col}">${drTxt}</span></div>
          </div>
          <button onclick="quickStatusMenu('${e.id}','${e.status}',this)" style="font-size:11px;padding:3px 8px;border-radius:6px;cursor:pointer;border:1px solid ${statusColor(e.status)}44;background:${statusColor(e.status)}18;color:${statusColor(e.status)};font-weight:600;flex-shrink:0">${badge(e.status)} ▾</button>
        </div>`;
      }).join('')}
      ${items.length>8?`<div style="font-size:12px;color:var(--text-3);padding-top:6px;text-align:center">...i ${items.length-8} więcej</div>`:''}
    </div>`;
  })();

  return `
    <h1 style="font-size:22px;font-weight:800;color:var(--text);margin-bottom:16px">Zgłoszenia</h1>
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="row" style="gap:10px">${playerSel}${statusSel}</div>
      <button onclick="addEntry()" style="padding:9px 16px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">+ Dodaj zgłoszenie</button>
    </div>
    ${awaitingResults}
    ${list||'<p style="color:var(--text-4);text-align:center;padding:48px">Brak zgłoszeń</p>'}`;
}


// ─── Szybka zmiana statusu zgłoszenia ────────────────────────────────────────
function quickStatus(entryId, newStatus){
  const e=S.entries.find(x=>x.id===entryId);
  if(!e) return;
  e.status=newStatus;
  persistAndSync(KEYS.entries,S.entries);
  render();
}

function quickStatusMenu(entryId, currentStatus, btnEl){
  // Usuń stary dropdown jeśli istnieje
  document.querySelectorAll('.qs-menu').forEach(m=>m.remove());
  const statuses=[
    ['sent','📤 Wysłano','#f59e0b'],
    ['pending','⏳ Oczekuje wyników','#8b5cf6'],
    ['contacted','📞 Kontaktowali się','#06b6d4'],
    ['prize_pending','📦 Nagroda w drodze','#f97316'],
    ['prize_received','✅ Nagroda odebrana','#34d399'],
    ['won','🏆 Wygrano','#22c55e'],
    ['lost','❌ Przegrano','#ef4444'],
    ['no_response','🔕 Brak odpowiedzi','#64748b'],
    ['expired','⌛ Termin minął','#475569'],
  ];
  const menu=document.createElement('div');
  menu.className='qs-menu';
  menu.style.cssText='position:fixed;z-index:9999;background:var(--bg-hover);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 32px #0008;min-width:200px;overflow:hidden';
  // Pozycja
  const rect=btnEl.getBoundingClientRect();
  const top=rect.bottom+4;
  const left=Math.min(rect.left, window.innerWidth-210);
  menu.style.top=top+'px';
  menu.style.left=left+'px';
  menu.innerHTML=statuses.map(([s,l,col])=>`
    <div onclick="quickStatus('${entryId}','${s}');document.querySelectorAll('.qs-menu').forEach(m=>m.remove())"
      style="padding:10px 14px;cursor:pointer;font-size:13px;color:${s===currentStatus?col:'#94a3b8'};background:${s===currentStatus?col+'18':'transparent'};font-weight:${s===currentStatus?700:400};display:flex;align-items:center;gap:8px"
      onmouseover="this.style.background='${col}22'" onmouseout="this.style.background='${s===currentStatus?col+'18':'transparent'}'">
      ${l}${s===currentStatus?' ✓':''}
    </div>`).join('');
  document.body.appendChild(menu);
  // Zamknij po kliknięciu poza
  setTimeout(()=>{
    document.addEventListener('click', function closer(e){
      if(!menu.contains(e.target)&&e.target!==btnEl){
        menu.remove();
        document.removeEventListener('click',closer);
      }
    });
  },10);
}
function editEntry(id){
  const e=S.entries.find(x=>x.id===id);
  const ct=S.contests.find(x=>x.id===e.contestId);
  const html=`
    ${field('Status',fsel('e_status',[['sent','Wysłano'],['pending','Oczekuje wyników'],['contacted','Kontaktowali się'],['prize_pending','Nagroda w drodze'],['prize_received','Nagroda odebrana'],['won','Wygrano'],['lost','Przegrano'],['no_response','Brak odpowiedzi'],['expired','Termin minął']],e.status))}
    ${field('Data',finp('e_date',e.date,'date'))}
    ${ct?.task?`<div style="background:#6366f111;border:1px solid #6366f133;border-radius:8px;padding:8px 12px;margin-bottom:4px;font-size:12px;color:#818cf8"><strong>🎯 Zadanie:</strong> ${esc(ct.task)}</div>`:''}
    <div class="field"><label>✏️ Moja odpowiedź konkursowa</label>
      <textarea id="e_answer" style="min-height:90px;border-color:#6366f133">${esc(e.answer||'')}</textarea>
    </div>
    ${field('Notatki',ftex('e_notes',e.notes||''))}
    <div class="field"><label>🔑 Kody konkursowe</label>
      <textarea id="e_codes" style="min-height:60px;border-color:#2d3548;font-family:monospace;font-size:13px" placeholder="Jeden kod w każdej linii">${esc(e.codes||'')}</textarea>
      <div id="e_codes_warn" style="font-size:11px;color:#ef4444;margin-top:4px"></div>
    </div>`;
  openModal({title:'Edytuj zgłoszenie',html,submitLabel:'Zapisz',onSubmit:()=>{
    const newAnswer=document.getElementById('e_answer')?.value||'';
    if(newAnswer&&newAnswer.trim().length>=10&&ct){
      const similar=findSimilarAnswers(newAnswer,ct.agencyId,e.id);
      if(similar.length){
        const pct=Math.round(similar[0].similarity*100);
        if(false){
          return false;
        }
      }
    }
    const editCodes=document.getElementById('e_codes')?.value||'';
    const editDupCodes=findDuplicateCodes(editCodes,e.contestId,e.id);
    if(editDupCodes.length){
      console.warn('Kody edycja:', editDupCodes);
    }
    const newReceiptId=document.getElementById('e_receipt')?.value||'';
    if(newReceiptId&&newReceiptId!==e.receiptId){
      const conflict=S.entries.find(x=>x.receiptId===newReceiptId&&x.contestId===e.contestId&&x.id!==e.id);
      if(conflict){
        const cp=S.players.find(x=>x.id===conflict.playerId);
        alert('⚠️ Ten paragon jest już użyty w tym konkursie przez: '+(cp?.name||'?'));
        return false;
      }
    }
    Object.assign(e,{status:gv('e_status'),date:gv('e_date'),notes:gv('e_notes'),answer:newAnswer,codes:editCodes,receiptId:newReceiptId||e.receiptId});
    persistAndSync(KEYS.entries,S.entries); render();
  }});
}
function deleteEntry(id){
  if(!isOwner()){ alert('⛔ Tylko właściciel grupy może usuwać zgłoszenia.'); return; }
  confirm('Usunąć zgłoszenie?',()=>{ sbDelete(KEYS.entries,id); S.entries=S.entries.filter(e=>e.id!==id); localStorage.setItem(KEYS.entries,JSON.stringify(S.entries)); render(); });
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {addEntry, findDuplicateCodes, normAnswer, answerSimilarity, findSimilarAnswers, uploadPrizePhoto, showPrizePhotoModal, deletePrizePhoto, previewPrizePhoto, renderEntries, quickStatus, quickStatusMenu, editEntry, deleteEntry});
