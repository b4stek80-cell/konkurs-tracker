// ═══════════════════════════════════════════════════════════
// RECEIPTS — paragony
// ═══════════════════════════════════════════════════════════

function receiptStatus(r){
  if(r.settled) return ['#6b7280','✅ Rozliczony'];
  const used=S.entries.filter(e=>e.receiptId===r.id);
  if(used.length>0) return ['#f59e0b','🟡 W użyciu ('+used.length+')'];
  return ['#22c55e','🟢 Wolny'];
}

function openReceiptsModal(playerId){
  if(playerId==='null'||playerId===''||playerId===undefined) playerId=null;
  const p=S.players.find(x=>x.id===playerId);
  const recs=S.receipts.filter(r=>r.playerId===playerId);
  window._currentReceiptsPlayerId=playerId;

  const listHtml=recs.length===0
    ? '<p style="color:var(--text-4);text-align:center;padding:20px 0">Brak paragonów — dodaj pierwszy</p>'
    : recs.map(r=>receiptRowHtml(r)).join('');

  const html=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn-primary btn-sm" onclick="addReceiptForm('${playerId}')">+ Dodaj paragon</button>
    </div>
    <div id="receipt_add_form" style="display:none;background:var(--bg);border:1px solid #6366f133;border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-weight:600;color:var(--text);font-size:14px;margin-bottom:10px">Nowy paragon</div>
      <div class="grid2">
        ${field('Sklep',finp('rc_shop','','text','np. Biedronka'))}
        ${field('Kwota (zł)',finp('rc_amount','','text','np. 49.90'))}
      </div>
      ${field('Data zakupu',finp('rc_date',today(),'date'))}
      ${field('Ważny do (zachowaj oryginał do)',finp('rc_expire','','date'))}
      ${field('Numer paragonu *',finp('rc_receipt_nr','','text','np. 1234/2026 (wymagany jeśli brak zdjęcia)'))}
      ${field('Numer kasy fiskalnej',finp('rc_cash_reg','','text','np. K01 (opcjonalny)'))}
      ${field('NIP sprzedawcy',finp('rc_nip','','text','NIP (opcjonalny)','13','numeric'))}
      ${field('Notatki',ftex('rc_notes','','np. Pepsi 2x + Lays'))}
      <div class="field"><label>Zdjęcie paragonu</label>
        <div id="rc_photo_drop" onclick="document.getElementById('rc_photo_inp').click()"
          style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;cursor:pointer;margin-bottom:6px">
          <div id="rc_photo_preview" style="font-size:13px;color:var(--text-3)">📷 Kliknij aby dodać zdjęcie paragonu</div>
        </div>
        <input type="file" id="rc_photo_inp" accept="image/*" style="display:none" onchange="previewReceiptPhoto(this)">
        <input type="hidden" id="rc_photo_data" value="">
      </div>
      <div style="margin-bottom:6px"><button id="ocr_btn" onclick="runReceiptOCR()" style="width:100%;padding:8px;background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">🔍 Skanuj paragon</button></div>
      <input type="hidden" id="rc_contest_id" value="">
      <div id="rc_contest_suggest" style="display:none"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-sec btn-sm" onclick="document.getElementById('receipt_add_form').style.display='none'">Anuluj</button>
        <button class="btn-primary btn-sm" onclick="saveReceipt('${playerId}')">Zapisz paragon</button>
      </div>
    </div>
    <div id="receipt_list">${listHtml}</div>`;

  // Auto-usuń duplikaty przy otwarciu
  const dupes=dedupeReceipts();
  if(dupes>0){ console.log('Usunięto '+dupes+' duplikatów paragonów'); }
  openModal({title:'🧾 Paragony — '+(p?.name||'Nieprzypisane'), html, wide:true});
}

function addReceiptForm(playerId){
  const form=document.getElementById('receipt_add_form');
  if(form) form.style.display=form.style.display==='none'?'block':'none';
}

function previewReceiptPhoto(inp){
  const file=inp.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async e=>{
    const prev=document.getElementById('rc_photo_preview');
    if(prev) prev.innerHTML='⏳ Komprymuję...';
    // Zachowaj oryginał dla OCR
    _rcPhotoOriginal = e.target.result;
    // Kompresuj do uploadu i podglądu
    const compressed = await compressImage(e.target.result, 2, 1200, 0.75);
    _rcPhotoData = compressed;
    const el=document.getElementById('rc_photo_data');
    if(el) el.value=compressed;
    if(prev) prev.innerHTML=`<img src="${compressed}" style="max-height:80px;border-radius:6px;object-fit:contain">`;
  };
  reader.readAsDataURL(file);
}

// ── Supabase Storage — zdjęcia paragonów ─────────────────────────────────────
// Kompresja zdjęcia przed uploadem — max 1200px, jakość 0.75
async function compressImage(base64data, maxSizeMB=2, maxPx=1200, quality=0.75){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      // Sprawdź czy kompresja potrzebna
      const base64size = base64data.length * 0.75 / 1024 / 1024; // przybliżony rozmiar MB
      const needsResize = img.width > maxPx || img.height > maxPx;
      const needsCompress = base64size > maxSizeMB;
      if(!needsResize && !needsCompress){ resolve(base64data); return; }
      // Skaluj
      let w = img.width, h = img.height;
      if(w > maxPx || h > maxPx){
        if(w > h){ h = Math.round(h * maxPx / w); w = maxPx; }
        else { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=>resolve(base64data); // błąd - zwróć oryginał
    img.src = base64data;
  });
}

async function uploadReceiptPhoto(base64data, receiptId){
  if(!base64data||!_sb) return null;
  try{
    // Konwertuj base64 na blob
    const res = await fetch(base64data);
    const blob = await res.blob();
    const ext = blob.type.includes('png')?'png':'jpg';
    const path = _currentFamilyId+'/'+receiptId+'.'+ext;
    const {data,error} = await _sb.storage
      .from('receipts')
      .upload(path, blob, {upsert:true, contentType:blob.type});
    if(error){ console.warn('Storage upload error:', error.message); return null; }
    // Pobierz publiczny URL
    const {data:{publicUrl}} = _sb.storage.from('receipts').getPublicUrl(path);
    return publicUrl;
  }catch(e){ console.warn('uploadReceiptPhoto error:', e.message); return null; }
}

async function deleteReceiptPhoto(receiptId){
  if(!_sb||!_currentFamilyId) return;
  try{
    // Próbuj usunąć oba formaty
    await _sb.storage.from('receipts').remove([
      _currentFamilyId+'/'+receiptId+'.jpg',
      _currentFamilyId+'/'+receiptId+'.png'
    ]);
  }catch(e){ console.warn('deleteReceiptPhoto error:', e.message); }
}

// ── OCR paragonu przez Gemini Vision ─────────────────────────────────────────
async function ocrReceipt(base64img){
  const apiKey=localStorage.getItem('kk_gemini_key')||'';
  if(!apiKey){ alert('Wpisz klucz API Gemini w zakładce "Dodaj konkurs z AI"'); return null; }
  const prompt='Przeanalizuj paragon fiskalny i zwróć TYLKO JSON bez żadnego tekstu: {"shop":"","nip":"","receipt_nr":"","cash_register":"","amount":"","date":""} Zasady: shop=pełna nazwa sklepu/sieci. nip=NIP w formacie XXX-XXX-XX-XX. receipt_nr=numer paragonu (szukaj: "Nr par", "Paragon nr", krótka liczba przy słowie paragon). cash_register=unikalny identyfikator kasy fiskalnej drukowany na dole paragonu - zwykle format: litery+cyfry np. EAZ 2402503461, ABC123456, lub sam ciąg cyfr i liter identyfikujący kasę - NIE jest to nr transakcji ani nr paragonu. amount=kwota końcowa do zapłaty (samo liczba z kropką). date=data zakupu YYYY-MM-DD. Puste pole jeśli nie widać.';
  try{
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key='+apiKey,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        contents:[{parts:[
          {inline_data:{mime_type:'image/jpeg',data:base64img.replace(/^data:image\/[a-z]+;base64,/,'')}},
          {text:prompt}
        ]}],
        generationConfig:{temperature:0,maxOutputTokens:200}
      })
    });
    const data=await res.json();
    const text=(data?.candidates?.[0]?.content?.parts?.[0]?.text||'').replace(/```json|```/g,'').trim();
    return JSON.parse(text);
  }catch(e){ console.warn('OCR error:',e.message); return null; }
}

async function runReceiptOCR(){
  const photoData=_rcPhotoOriginal||_rcPhotoData||document.getElementById('rc_photo_data')?.value||'';
  if(!photoData){ alert('Najpierw dodaj zdjęcie paragonu'); return; }
  const btn=document.getElementById('ocr_btn');
  if(btn){ btn.textContent='⏳ Skanuję...'; btn.disabled=true; }
  const r=await ocrReceipt(photoData);
  if(btn){ btn.textContent='🔍 Skanuj paragon'; btn.disabled=false; }
  if(!r){ alert('Nie udało się odczytać paragonu'); return; }
  if(r.shop&&document.getElementById('rc_shop')) document.getElementById('rc_shop').value=r.shop;
  if(r.receipt_nr&&document.getElementById('rc_receipt_nr')) document.getElementById('rc_receipt_nr').value=r.receipt_nr;
  if(r.cash_register&&document.getElementById('rc_cash_reg')) document.getElementById('rc_cash_reg').value=r.cash_register;
  if(r.amount&&document.getElementById('rc_amount')) document.getElementById('rc_amount').value=r.amount;
  if(r.date&&document.getElementById('rc_date')) document.getElementById('rc_date').value=r.date;
  const filled=[r.shop,r.receipt_nr,r.cash_register,r.amount,r.date].filter(Boolean).length;
  if(!filled){ alert('Nie udało się odczytać danych. Spróbuj z lepszym zdjęciem.'); return; }

  // Auto-przypisanie do konkursu — znajdź pasujące po sklepie
  if(r.shop){
    const shopLower=r.shop.toLowerCase();
    const matching=S.contests.filter(c=>{
      if(c.status!=='active') return false;
      if(!c.shops||!c.shops.length) return false;
      return c.shops.some(s=>s.toLowerCase().includes(shopLower)||shopLower.includes(s.toLowerCase()));
    });
    const suggestEl=document.getElementById('rc_contest_suggest');
    if(suggestEl&&matching.length>0){
      suggestEl.innerHTML=`<div style="background:#22c55e11;border:1px solid #22c55e33;border-radius:8px;padding:10px;margin-top:8px">
        <div style="font-size:12px;font-weight:700;color:#4ade80;margin-bottom:6px">🎯 Pasujące konkursy dla sklepu "${esc(r.shop)}":</div>
        ${matching.map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #1e2a3a;gap:8px">
          <div style="font-size:12px;color:var(--text)">${esc(c.name)}<span style="color:var(--text-3);font-size:11px"> · do ${c.deadline||'?'}</span></div>
          <button onclick="document.getElementById('rc_contest_id')&&(document.getElementById('rc_contest_id').value='${c.id}');this.parentElement.parentElement.parentElement.style.background='#6366f122';this.textContent='✓'"
            style="font-size:11px;padding:3px 8px;background:#22c55e22;color:#4ade80;border:1px solid #22c55e44;border-radius:5px;cursor:pointer;white-space:nowrap">Przypisz</button>
        </div>`).join('')}
      </div>`;
      suggestEl.style.display='block';
    }
  }
}
async function saveReceipt(playerId){
  // Normalize "null" string → actual null
  if(playerId==='null'||playerId===''||playerId===undefined) playerId=null;
  // Blokada podwójnego zapisu
  const saveBtn=document.querySelector('[onclick*="saveReceipt"]');
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Zapisuję...'; }
  try {
    const photoData=_rcPhotoData||document.getElementById('rc_photo_data')?.value||'';
    window._rcPhotoData='';
    const receiptNr=gv('rc_receipt_nr')||'';
    // Walidacja daty zakupu
    const _rcDate = gv('rc_date');
    const _rcExpire = gv('rc_expire');
    const _rcDateErr = validateReceiptDate(_rcDate, 'Data zakupu');
    if(_rcDateErr){ if(!window.confirm('⚠️ '+_rcDateErr+'\n\nCzy zapisać mimo to?')){ if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Zapisz paragon';} return; } }
    const _rcExpErr = validateExpireDate(_rcExpire, _rcDate);
    if(_rcExpErr){ alert('⚠️ '+_rcExpErr); if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Zapisz paragon';} return; }
    if(!receiptNr && !photoData){
      alert('⚠️ Wpisz numer paragonu lub dodaj zdjęcie');
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='Zapisz paragon'; }
      return;
    }
    const rid=uid();
    // Upload zdjęcia do Storage jeśli jest
    let photoUrl='';
    if(photoData){
      if(saveBtn) saveBtn.textContent='Wysyłam zdjęcie...';
      try {
        photoUrl = await uploadReceiptPhoto(photoData, rid) || '';
      } catch(uploadErr) {
        console.warn('Upload zdjęcia nie powiódł się:', uploadErr.message);
        photoUrl = ''; // zapisz bez URL - mamy photo_local jako fallback
      }
    }
    const r={
      id:rid, playerId:playerId||null,
      shop:gv('rc_shop')||'Paragon',
      amount:gv('rc_amount'),
      date:gv('rc_date')||today(),
      expire_date:gv('rc_expire')||'',
      receipt_nr:receiptNr,
      cash_register:gv('rc_cash_reg')||'',
      nip:gv('rc_nip')||'',
      notes:gv('rc_notes'),
      photo: photoUrl,  // URL zamiast base64
      photo_local: photoData, // zachowaj lokalnie jako cache
      settled:false,
      added_by: _currentUser?.email||null
    };
    S.receipts.push(r);
    // Zapisz bez zdjęcia jeśli za duże dla localStorage
    try {
      persistAndSync(KEYS.receipts, S.receipts);
    } catch(storageErr) {
      // Zdjęcie za duże - zapisz bez niego
      const rNoPhoto = S.receipts.map(x=>x.id===r.id?{...x,photo:''}:x);
      r.photo='';
      S.receipts = rNoPhoto;
      persistAndSync(KEYS.receipts, S.receipts);
      alert('⚠️ Paragon zapisany bez zdjęcia — zdjęcie było za duże dla pamięci przeglądarki.');
    }
    // Odśwież listę paragonów w istniejącym modalu
    refreshReceiptList(playerId);
    // Zwiń i zresetuj formularz
    const form = document.getElementById('receipt_add_form');
    if(form){ form.style.display='none'; }
    ['rc_shop','rc_amount','rc_receipt_nr','rc_cash_reg','rc_nip','rc_notes'].forEach(fid=>{
      const el=document.getElementById(fid); if(el) el.value='';
    });
    const dateEl=document.getElementById('rc_date'); if(dateEl) dateEl.value=today();
    const expEl=document.getElementById('rc_expire'); if(expEl) expEl.value='';
    const prev=document.getElementById('rc_photo_preview');
    if(prev) prev.innerHTML='📷 Kliknij aby dodać zdjęcie paragonu';
    const photoInp=document.getElementById('rc_photo_inp'); if(photoInp) photoInp.value='';
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='Zapisz paragon'; }
    // Odśwież zakładkę Paragony jeśli jest aktywna
    if(S.tab==='receipts_tab') render();
  } catch(e) {
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='Zapisz paragon'; }
    alert('Błąd zapisu paragonu: '+e.message);
    console.error('saveReceipt error:', e);
  }
}

// Odśwież tylko listę paragonów w istniejącym modalu (bez re-otwierania)
function refreshReceiptList(playerId){
  if(playerId==='null'||playerId===''||playerId===undefined) playerId=null;
  const listEl = document.getElementById('receipt_list');
  if(!listEl){ openReceiptsModal(playerId); return; }
  const recs = S.receipts.filter(r => r.playerId === playerId);
  if(recs.length === 0){
    listEl.innerHTML = '<p style="color:var(--text-4);text-align:center;padding:20px 0">Brak paragonów — dodaj pierwszy</p>';
    return;
  }
  listEl.innerHTML = recs.map(r => receiptRowHtml(r)).join('');
}

// Renderuje jeden wiersz paragonu (dla refreshReceiptList i openReceiptsModal)
function receiptRowHtml(r){
  const [col,label] = receiptStatus(r);
  const usedIn = S.entries.filter(e=>e.receiptId===r.id).map(e=>{
    const ct = S.contests.find(x=>x.id===e.contestId);
    return ct ? ct.name : '?';
  }).join(', ');
  const photoSrc = r.photo || r.photo_local || '';
  const photoHtml = photoSrc
    ? `<img src="${photoSrc}" onclick="showReceiptPhoto('${r.id}')" style="width:56px;height:56px;border-radius:8px;object-fit:cover;cursor:pointer;flex-shrink:0;border:1px solid var(--border)">`
    : `<div style="width:56px;height:56px;border-radius:8px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🧾</div>`;
  const expHtml = r.expire_date ? (()=>{
    const d=daysLeft(r.expire_date);
    const ec=d<=0?'#ef4444':d<=7?'#f59e0b':d<=30?'#fbbf24':'#64748b';
    const et=d<=0?'⛔ PRZETERMINOWANY!':d<=7?'⚠️ Ważny '+d+'d!':'📅 Ważny do '+fmt(r.expire_date);
    return `<div style="font-size:11px;color:${ec};font-weight:600;margin-top:2px">${et}</div>`;
  })() : '';
  return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
    <div style="display:flex;gap:10px;align-items:flex-start">
      ${photoHtml}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--text);font-size:14px">${esc(r.shop||'Paragon')}</div>
        <div style="font-size:12px;color:var(--text-3)">${r.amount?r.amount+' zł · ':''}${fmt(r.date)}${r.receipt_nr?' · nr: '+esc(r.receipt_nr):''}</div>
        ${r.cash_register?`<div style="font-size:11px;color:var(--text-4)">🖨️ Kasa: ${esc(r.cash_register)}</div>`:''}
        ${r.nip?`<div style="font-size:11px;color:var(--text-4)">NIP: ${esc(r.nip)}</div>`:''}
        ${expHtml}
        ${r.notes?`<div style="font-size:12px;color:var(--text-2);margin-top:2px">${esc(r.notes)}</div>`:''}
        <div style="margin-top:4px"><span style="color:${col};font-size:12px;font-weight:600">${label}</span></div>
        ${usedIn?`<div style="font-size:11px;color:var(--text-4);margin-top:2px">Użyty w: ${esc(usedIn)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
        <button class="btn-sm" style="background:var(--bg-hover);color:var(--text-2);border:1px solid var(--border);font-size:11px" onclick="editReceipt('${r.id}')">✏️</button>
        ${!r.settled?`<button class="btn-sm" style="background:#6366f122;color:#818cf8;border:1px solid #6366f133;font-size:11px" onclick="settleReceipt('${r.id}')">Rozlicz</button>`:''}
        ${r.settled?`<button class="btn-sm" style="background:var(--border);color:var(--text-3);font-size:11px" onclick="unsettleReceipt('${r.id}')">Cofnij</button>`:''}
        <button class="btn-sm" style="background:#ef444422;color:#f87171;border:1px solid #ef444433;font-size:11px" onclick="deleteReceipt('${r.id}')">Usuń</button>
      </div>
    </div>
  </div>`;
}

// Usuń duplikaty paragonów (same shop+date+amount w ciągu 10 sekund)
function dedupeReceipts(){
  const seen=new Set();
  const unique=[];
  S.receipts.forEach(r=>{
    // Deduplikuj tylko po ID — usuwa tylko techniczne duplikaty (ten sam rekord wstawiony 2x)
    // NIE usuwa dwóch różnych paragonów z tego samego sklepu tego samego dnia
    if(!seen.has(r.id)){
      seen.add(r.id);
      unique.push(r);
    }
  });
  if(unique.length < S.receipts.length){
    const removed = S.receipts.length - unique.length;
    S.receipts=unique;
    persistAndSync(KEYS.receipts,S.receipts);
    return removed;
  }
  return 0;
}

function editReceipt(id){
  const r=S.receipts.find(x=>x.id===id);
  if(!r) return;
  let _editPhotoData = null; // nowe zdjęcie wybrane podczas edycji
  const photoPreviewHtml = `
    <div class="field"><label>Zdjęcie paragonu</label>
      <div id="er_photo_preview" onclick="document.getElementById('er_photo_inp').click()"
        style="background:var(--bg);border:2px dashed var(--border);border-radius:10px;padding:12px;text-align:center;cursor:pointer;color:var(--text-3);font-size:13px;min-height:60px;display:flex;align-items:center;justify-content:center">
        ${(r.photo||r.photo_local)?`<img src="${r.photo||r.photo_local}" style="max-height:80px;border-radius:6px;object-fit:contain">`:'📷 Kliknij aby zmienić zdjęcie'}
      </div>
      <input type="file" id="er_photo_inp" accept="image/*" capture="environment" style="display:none"
        onchange="(async()=>{
          const f=this.files[0]; if(!f) return;
          const reader=new FileReader();
          reader.onload=async e=>{
            const compressed = await compressImage(e.target.result, 2, 1200, 0.75);
            _editPhotoData=compressed;
            document.getElementById('er_photo_preview').innerHTML='<img src=\''+compressed+'\' style=\'max-height:80px;border-radius:6px;object-fit:contain\'>';
          };
          reader.readAsDataURL(f);
        })()">
      ${r.photo?`<button type="button" onclick="document.getElementById('er_photo_preview').innerHTML='📷 Kliknij aby zmienić zdjęcie';_editPhotoData='DELETE';"
        style="margin-top:4px;font-size:11px;color:#ef4444;background:none;border:none;cursor:pointer">🗑️ Usuń zdjęcie</button>`:''}
      <button type="button" onclick="erRunOCR()"
        style="margin-top:6px;width:100%;padding:8px;background:#0ea5e922;color:#38bdf8;border:1px solid #0ea5e933;border-radius:8px;font-size:12px;cursor:pointer;font-weight:600">
        🔍 Skanuj paragon (OCR)
      </button>
    </div>`;
  const html=`
    ${photoPreviewHtml}
    ${field('Sklep',finp('er_shop',r.shop||''))}
    ${field('Kwota (zł)',finp('er_amount',r.amount||'','text','np. 49.90'))}
    ${field('Data zakupu',finp('er_date',r.date||today(),'date'))}
    ${field('Ważny do',finp('er_expire',r.expire_date||'','date'))}
    ${field('Numer paragonu',finp('er_receipt_nr',r.receipt_nr||'','text'))}
    ${field('Numer kasy fiskalnej',finp('er_cash_reg',r.cash_register||'','text'))}
    ${field('NIP sprzedawcy',finp('er_nip',r.nip||'','text','NIP (opcjonalny)'))}
    ${field('Notatki',ftex('er_notes',r.notes||''))}`;
  openModal({title:'✏️ Edytuj paragon',html,submitLabel:'Zapisz',
    onSubmit:async()=>{
      r.shop=gv('er_shop')||r.shop;
      r.amount=gv('er_amount');
      // Walidacja dat przy edycji
      const _dateVal=gv('er_date');
      const _expVal=gv('er_expire');
      const _dateErr=validateReceiptDate(_dateVal,'Data zakupu');
      if(_dateErr){ alert('⚠️ '+_dateErr); return false; }
      const _expErr=validateExpireDate(_expVal,_dateVal);
      if(_expErr){ alert('⚠️ '+_expErr); return false; }
      r.date=gv('er_date');
      r.expire_date=gv('er_expire');
      r.receipt_nr=gv('er_receipt_nr');
      r.cash_register=gv('er_cash_reg');
      r.nip=gv('er_nip')||'';
      r.notes=gv('er_notes');
      // Obsługa zdjęcia
      if(_editPhotoData==='DELETE'){
        r.photo=''; r.photo_local='';
      } else if(_editPhotoData){
        r.photo_local=_editPhotoData;
        try{
          const url=await uploadReceiptPhoto(_editPhotoData, r.id);
          if(url) r.photo=url;
        }catch(e){ console.warn('Upload zdjęcia:', e.message); }
      }
      persistAndSync(KEYS.receipts,S.receipts);
      if(S.tab==='receipts_tab') render();
      else openReceiptsModal(_currentReceiptsPlayerId);
      return true;
    }
  });
}

// OCR w trybie edycji
async function erRunOCR(){
  const inp=document.getElementById('er_photo_inp');
  const prev=document.getElementById('er_photo_preview');
  const apiKey=localStorage.getItem(KEYS.geminiKey);
  if(!apiKey){ alert('Brak klucza Gemini API. Ustaw go w zakładce AI.'); return; }

  // Jeśli wybrano nowe zdjęcie - użyj go
  if(inp&&inp.files&&inp.files[0]){
    prev.innerHTML='⏳ Skanowanie...';
    try{
      const reader=new FileReader();
      reader.onload=async e=>{
        const base64=e.target.result.split(',')[1];
        const data=await ocrReceipt(base64, apiKey);
        if(data.shop){const el=document.getElementById('er_shop');if(el)el.value=data.shop;}
        if(data.amount){const el=document.getElementById('er_amount');if(el)el.value=data.amount;}
        if(data.date){const el=document.getElementById('er_date');if(el)el.value=data.date;}
        if(data.receipt_nr){const el=document.getElementById('er_receipt_nr');if(el)el.value=data.receipt_nr;}
        if(data.cash_register){const el=document.getElementById('er_cash_reg');if(el)el.value=data.cash_register;}
        if(data.nip){const el=document.getElementById('er_nip');if(el)el.value=data.nip;}
        prev.innerHTML='<img src="'+e.target.result+'" style="max-height:80px;border-radius:6px;object-fit:contain">';
      };
      reader.readAsDataURL(inp.files[0]);
    }catch(e){ prev.innerHTML='❌ Błąd OCR: '+e.message; }
    return;
  }

  // Jeśli paragon ma już zdjęcie w bazie - użyj istniejącego URL
  const existingImg=prev.querySelector('img');
  if(existingImg&&existingImg.src&&existingImg.src.startsWith('http')){
    prev.innerHTML='⏳ Skanowanie...';
    try{
      // Pobierz zdjęcie z URL i konwertuj do base64
      const resp=await fetch(existingImg.src);
      const blob=await resp.blob();
      const reader=new FileReader();
      reader.onload=async e=>{
        const base64=e.target.result.split(',')[1];
        const data=await ocrReceipt(base64, apiKey);
        if(data.shop){const el=document.getElementById('er_shop');if(el)el.value=data.shop;}
        if(data.amount){const el=document.getElementById('er_amount');if(el)el.value=data.amount;}
        if(data.date){const el=document.getElementById('er_date');if(el)el.value=data.date;}
        if(data.receipt_nr){const el=document.getElementById('er_receipt_nr');if(el)el.value=data.receipt_nr;}
        if(data.cash_register){const el=document.getElementById('er_cash_reg');if(el)el.value=data.cash_register;}
        if(data.nip){const el=document.getElementById('er_nip');if(el)el.value=data.nip;}
        prev.innerHTML='<img src="'+existingImg.src+'" style="max-height:80px;border-radius:6px;object-fit:contain">';
      };
      reader.readAsDataURL(blob);
    }catch(e){ prev.innerHTML='❌ Błąd OCR: '+e.message; }
    return;
  }

  // Brak zdjęcia - poproś o wybór
  alert('Brak zdjęcia do skanowania. Kliknij w pole zdjęcia aby je dodać.');
}
function deleteReceipt(id){
  if(!isOwner()){ alert('⛔ Tylko właściciel grupy może usuwać paragony.'); return; }
  const r=S.receipts.find(x=>x.id===id);
  const info=r?(r.shop||'Paragon')+(r.receipt_nr?' · nr '+r.receipt_nr:''):'';
  // Zamknij aktualny modal (paragony) przed otwarciem potwierdzenia
  document.querySelectorAll('.overlay').forEach(m=>m.remove());
  setTimeout(()=>{
    openModal({title:'🗑 Usuń paragon?',
      html:`<p style="color:#cbd5e1;margin-bottom:8px">Czy na pewno usunąć:<br><strong style="color:var(--text)">${esc(info)}</strong></p>
      <p style="font-size:12px;color:var(--text-3)">Tej operacji nie można cofnąć.</p>`,
      submitLabel:'Usuń',
      onSubmit:()=>{
        deleteReceiptPhoto(id); // usuń zdjęcie ze Storage
        sbDelete(KEYS.receipts,id);
        S.receipts=S.receipts.filter(r=>r.id!==id);
        S.entries.forEach(e=>{ if(e.receiptId===id) delete e.receiptId; });
        persistAndSync(KEYS.receipts,S.receipts);
        persistAndSync(KEYS.entries,S.entries);
        if(S.tab==='receipts_tab') render();
        else openReceiptsModal(_currentReceiptsPlayerId);
        return true;
      },
      onClose:()=>{ openReceiptsModal(_currentReceiptsPlayerId); }
    });
  }, 50);
}

function settleReceipt(id){
  const r=S.receipts.find(x=>x.id===id);
  if(!r) return;
  r.settled=true;
  persistAndSync(KEYS.receipts,S.receipts);
  if(S.tab==='receipts_tab') render();
  else openReceiptsModal(_currentReceiptsPlayerId);
}

function unsettleReceipt(id){
  const r=S.receipts.find(x=>x.id===id);
  if(!r) return;
  r.settled=false;
  persistAndSync(KEYS.receipts,S.receipts);
  if(S.tab!=='receipts_tab') openReceiptsModal(_currentReceiptsPlayerId);
}

function showReceiptPhoto(id){
  const r=S.receipts.find(x=>x.id===id);
  if(!r?.photo) return;
  openModal({title:'Zdjęcie paragonu',html:`<img src="${r.photo}" style="width:100%;border-radius:8px;max-height:70vh;object-fit:contain">`});
}

// ─── Zakładka Paragony ────────────────────────────────────────────────────────
function renderReceiptsTab(){
  const filtered=S.receipts.filter(r=>{
    const playerOk=!receiptTabPlayer||r.playerId===receiptTabPlayer;
    if(!playerOk) return false;
    const addedByOk=!receiptTabAddedBy||r.added_by===receiptTabAddedBy;
    if(!addedByOk) return false;
    if(receiptTabFilter==='free') return !r.settled && S.entries.filter(e=>e.receiptId===r.id).length===0;
    if(receiptTabFilter==='used') return S.entries.filter(e=>e.receiptId===r.id).length>0&&!r.settled;
    if(receiptTabFilter==='settled') return r.settled;
    if(receiptTabFilter==='expiring'){
      if(!r.expire_date) return false;
      const d=daysLeft(r.expire_date);
      return d!==null&&d<=30;
    }
    return true;
  }).sort((a,b)=>{
    // Sortuj: przeterminowane pierwsze, potem po dacie ważności
    const da=a.expire_date?daysLeft(a.expire_date):9999;
    const db=b.expire_date?daysLeft(b.expire_date):9999;
    return da-db;
  });

  const playerSel=fsel('rt_player',[['','Wszyscy gracze'],...S.players.map(p=>[p.id,p.name])],receiptTabPlayer);
  // Zbierz unikalnych "dodał" z paragonów
  const addedByList=[...new Set(S.receipts.map(r=>r.added_by).filter(Boolean))];
  const addedBySel=fsel('rt_added_by',[['','Wszyscy dodający'],...addedByList.map(u=>[u,u])],receiptTabAddedBy);
  const statusFilters=[['all','Wszystkie'],['free','Wolne'],['used','W użyciu'],['settled','Rozliczone'],['expiring','Wygasające ≤30d']];

  const list=filtered.length===0
    ? '<p style="color:var(--text-4);text-align:center;padding:48px">Brak paragonów</p>'
    : filtered.map(r=>{
        const p=S.players.find(x=>x.id===r.playerId);
        const usedIn=S.entries.filter(e=>e.receiptId===r.id).map(e=>{
          const ct=S.contests.find(x=>x.id===e.contestId);
          return ct?esc(ct.name):'?';
        });
        const [col,label]=receiptStatus(r);
        const d=r.expire_date?daysLeft(r.expire_date):null;
        const expCol=d===null?'#64748b':d<=0?'#ef4444':d<=7?'#f59e0b':d<=30?'#fbbf24':'#64748b';
        const expTxt=d===null?'':d<=0?'⛔ PRZETERMINOWANY':d<=7?'⚠️ Ważny '+d+'d':'📅 '+fmt(r.expire_date);

        return `<div class="card" style="border-radius:10px;margin-bottom:10px">
          <div style="display:flex;gap:12px;align-items:flex-start">
            ${r.photo?`<img src="${r.photo}" onclick="showReceiptPhoto('${r.id}')" style="width:52px;height:52px;border-radius:8px;object-fit:cover;cursor:pointer;flex-shrink:0;border:1px solid var(--border)">`
              :`<div style="width:52px;height:52px;border-radius:8px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🧾</div>`}
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div style="font-weight:600;color:var(--text);font-size:14px">${esc(r.shop||'Paragon')}</div>
                  <div style="font-size:12px;color:var(--text-3)">${r.amount?r.amount+' zł · ':''}${fmt(r.date)}${p?' · <span style="color:#818cf8">'+esc(p.name)+'</span>':(!r.playerId?'<span style="color:var(--text-4)"> · nieprzypisany</span>':'')}</div>
                  ${expTxt?`<div style="font-size:11px;color:${expCol};font-weight:600;margin-top:2px">${expTxt}</div>`:''}
                  ${r.notes?`<div style="font-size:11px;color:var(--text-2);margin-top:2px">${esc(r.notes)}</div>`:''}
              ${r.added_by?`<div style="font-size:10px;color:var(--text-4);margin-top:2px">📱 dodał: ${esc(r.added_by.split('@')[0])}</div>`:''}
                  ${usedIn.length?`<div style="font-size:11px;color:var(--text-4);margin-top:2px">📎 ${usedIn.join(', ')}</div>`:''}
                </div>
                <span style="color:${col};font-size:12px;font-weight:600;flex-shrink:0">${label}</span>
              </div>
              <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                ${!r.playerId?`<button onclick="assignReceiptToPlayer('${r.id}')"
                  style="font-size:11px;padding:4px 10px;background:#f59e0b22;color:#fbbf24;border:1px solid #f59e0b33;border-radius:6px;cursor:pointer;font-weight:600">
                  👤 Przypisz do gracza</button>`:''}
                <button onclick="editReceipt('${r.id}')"
                  style="font-size:11px;padding:4px 10px;background:var(--bg-hover);color:var(--text-2);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-weight:600">
                  ✏️ Edytuj
                </button>
                ${S.entries.filter(e=>e.receiptId===r.id).length===0?`<button onclick="assignReceiptToEntry('${r.id}')"
                  style="font-size:11px;padding:4px 10px;background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:6px;cursor:pointer;font-weight:600">
                  📎 Przypisz do konkursu
                </button>`:''}
                ${!r.settled?`<button onclick="settleReceipt('${r.id}');renderTab()"
                  style="font-size:11px;padding:4px 10px;background:#22c55e22;color:#4ade80;border:1px solid #22c55e33;border-radius:6px;cursor:pointer">Rozlicz</button>`:''}
                ${r.settled?`<button onclick="unsettleReceipt('${r.id}');renderTab()"
                  style="font-size:11px;padding:4px 10px;background:var(--bg-hover);color:var(--text-3);border:1px solid var(--border);border-radius:6px;cursor:pointer">Cofnij</button>`:''}
                <button onclick="deleteReceiptGlobal('${r.id}')"
                  style="font-size:11px;padding:4px 10px;background:#ef444422;color:#f87171;border:1px solid #ef444433;border-radius:6px;cursor:pointer">Usuń</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <h1 style="font-size:22px;font-weight:800;color:var(--text);margin:0">🧾 Paragony</h1>
      <button onclick="addReceiptGlobal()" class="btn-primary btn-sm">+ Dodaj paragon</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      ${statusFilters.map(([v,l])=>`<button class="${receiptTabFilter===v?'active':''}" onclick="window.receiptTabFilter='${v}';render()" style="padding:5px 12px;border-radius:8px;border:1px solid ${receiptTabFilter===v?'#6366f1':'#2d3548'};background:${receiptTabFilter===v?'#6366f122':'transparent'};color:${receiptTabFilter===v?'#818cf8':'#64748b'};font-size:12px;cursor:pointer">${l} (${
        v==='all'?S.receipts.length:
        v==='free'?S.receipts.filter(r=>!r.settled&&S.entries.filter(e=>e.receiptId===r.id).length===0).length:
        v==='used'?S.receipts.filter(r=>S.entries.filter(e=>e.receiptId===r.id).length>0&&!r.settled).length:
        v==='settled'?S.receipts.filter(r=>r.settled).length:
        S.receipts.filter(r=>r.expire_date&&daysLeft(r.expire_date)!==null&&daysLeft(r.expire_date)<=30).length
      })</button>`).join('')}
    </div>
    <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap">
      <select onchange="window.receiptTabPlayer=this.value;render()" style="flex:1;min-width:140px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 10px;font-size:13px">
        <option value="">Wszyscy gracze</option>
        ${S.players.map(p=>`<option value="${p.id}" ${receiptTabPlayer===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <select onchange="window.receiptTabAddedBy=this.value;render()" style="flex:1;min-width:140px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 10px;font-size:13px">
        <option value="">Wszyscy dodający</option>
        ${[...new Set(S.receipts.map(r=>r.added_by).filter(Boolean))].map(u=>`<option value="${u}" ${receiptTabAddedBy===u?'selected':''}>${esc(u.split('@')[0])}</option>`).join('')}
      </select>
    </div>
    ${list}`;
}

function renderTab(){
  if(S.tab==='receipts_tab') render();
}

function deleteReceiptGlobal(id){
  if(!isOwner()){ alert('⛔ Tylko właściciel grupy może usuwać paragony.'); return; }
  const r=S.receipts.find(x=>x.id===id);
  const info=r?(r.shop||'Paragon')+(r.receipt_nr?' · nr '+r.receipt_nr:''):'';
  openModal({title:'🗑 Usuń paragon?',
    html:`<p style="color:#cbd5e1;margin-bottom:8px">Czy na pewno usunąć:<br><strong style="color:var(--text)">${esc(info)}</strong></p>
    <p style="font-size:12px;color:var(--text-3)">Tej operacji nie można cofnąć.</p>`,
    submitLabel:'Usuń',
    onSubmit:()=>{
      deleteReceiptPhoto(id); // usuń zdjęcie ze Storage
      sbDelete(KEYS.receipts,id);
      S.receipts=S.receipts.filter(r=>r.id!==id);
      S.entries.forEach(e=>{ if(e.receiptId===id) delete e.receiptId; });
      persistAndSync(KEYS.receipts,S.receipts);
      persistAndSync(KEYS.entries,S.entries);
      render();
      return true;
    }
  });
}

function addReceiptGlobal(){
  const playerSel=fsel('rg_player',[
    ['','— bez przypisania —'],
    ...S.players.map(p=>[p.id,p.name])
  ],'');
  openModal({title:'+ Dodaj paragon',html:`
    <div class="field"><label>Gracz (opcjonalnie)</label>${playerSel}</div>
    <div style="font-size:11px;color:var(--text-3);margin-top:4px">Możesz przypisać do gracza później</div>`,
    submitLabel:'Dalej',
    onSubmit:()=>{
      const pid=gv('rg_player')||null;
      openReceiptsModal(pid);
    }
  });
}

function assignReceiptToPlayer(receiptId){
  const opts=[['','— wybierz gracza —'],...S.players.map(p=>[p.id,p.name])];
  openModal({title:'👤 Przypisz do gracza',
    html:`<div class="field"><label>Gracz</label>${fsel('atp_player',opts,'')}</div>`,
    submitLabel:'Przypisz',
    onSubmit:()=>{
      const pid=gv('atp_player');
      if(!pid){alert('Wybierz gracza');return false;}
      const r=S.receipts.find(x=>x.id===receiptId);
      if(r){ r.playerId=pid; persistAndSync(KEYS.receipts,S.receipts); render(); }
    }
  });
}
function assignReceiptToEntry(receiptId){
  const r=S.receipts.find(x=>x.id===receiptId);
  if(!r) return;
  // Pokaż listę zgłoszeń gracza bez przypisanego paragonu
  const playerEntries=S.entries.filter(e=>e.playerId===r.playerId&&!e.receiptId);
  if(!playerEntries.length){
    alert('Ten gracz nie ma zgłoszeń oczekujących na paragon.\nDodaj najpierw zgłoszenie do konkursu.');
    return;
  }
  const p=S.players.find(x=>x.id===r.playerId);
  const opts=[['','— wybierz zgłoszenie —'],...playerEntries.map(e=>{
    const ct=S.contests.find(x=>x.id===e.contestId);
    return [e.id,(ct?.name||'?')+' · '+fmt(e.date)];
  })];
  openModal({title:'📎 Przypisz paragon do zgłoszenia',
    html:`<div style="font-size:13px;color:var(--text-2);margin-bottom:12px">Paragon: <strong>${esc(r.shop||'Paragon')}</strong> · ${r.amount?r.amount+' zł':''}</div>
    <div class="field"><label>Gracz: ${esc(p?.name||'?')}</label>${fsel('assign_entry',opts,'')}</div>`,
    submitLabel:'Przypisz',
    onSubmit:()=>{
      const eid=gv('assign_entry');
      if(!eid){alert('Wybierz zgłoszenie');return false;}
      const e=S.entries.find(x=>x.id===eid);
      if(e){ e.receiptId=receiptId; persistAndSync(KEYS.entries,S.entries); render(); }
    }
  });
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {receiptStatus, openReceiptsModal, addReceiptForm, previewReceiptPhoto, compressImage, uploadReceiptPhoto, deleteReceiptPhoto, ocrReceipt, runReceiptOCR, saveReceipt, refreshReceiptList, receiptRowHtml, dedupeReceipts, editReceipt, erRunOCR, deleteReceipt, settleReceipt, unsettleReceipt, showReceiptPhoto, renderReceiptsTab, renderTab, deleteReceiptGlobal, addReceiptGlobal, assignReceiptToPlayer, assignReceiptToEntry});
