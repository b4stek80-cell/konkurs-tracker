// ═══════════════════════════════════════════════════════════
// MODAL ENGINE — openModal, closeModal, confirm, showConfirm
// ═══════════════════════════════════════════════════════════

function openModal({title, html, wide, onSubmit, submitLabel, onClose, id: customId, extraButtons}){
  const id = customId || 'modal_'+uid();
  const div = document.createElement('div');
  div.className='overlay';
  div.id=id;
  div.innerHTML=`
    <div class="modal${wide?' modal-wide':''}">
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="modal-close" onclick="closeModal('${id}')">×</button>
      </div>
      <div id="${id}_body">${html}</div>
      ${onSubmit?`<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap">
        <div id="${id}_extra"></div>
        <div class="row" style="gap:10px">
          <button class="btn-sec" onclick="closeModal('${id}')">Anuluj</button>
          <button class="btn-primary" id="${id}_submit">${esc(submitLabel||'Zapisz')}</button>
        </div>
      </div>`:''}
    </div>`;
  div.addEventListener('click', e => { if(e.target===div){ if(onClose)onClose(); closeModal(id); } });
  document.getElementById('modal-root').appendChild(div);
  _modalStack.push({id, onClose});
  if(extraButtons){
    const extraEl=document.getElementById(id+'_extra');
    if(extraEl) extraEl.innerHTML=extraButtons;
  }
  if(onSubmit){
    document.getElementById(id+'_submit').addEventListener('click', async () => {
      const result = await onSubmit(div);
      if(result!==false) closeModal(id);
    });
  }
  return id;
}

function closeModal(id){
  const el=document.getElementById(id);
  if(el){ const s=_modalStack.find(m=>m.id===id); if(s?.onClose)s.onClose(); el.remove(); window._modalStack=_modalStack.filter(m=>m.id!==id); }
}

function confirm(msg, onYes){
  const modalId='confirm_'+uid();
  const html=`<p style="color:#cbd5e1;margin-bottom:20px">${esc(msg)}</p>`+
    `<div class="row" style="justify-content:flex-end;gap:10px">`+
    `<button class="btn-sec" onclick="closeModal('${modalId}')">Anuluj</button>`+
    `<button class="btn-danger" id="confirm_yes_${modalId}">Usuń</button></div>`;
  openModal({title:'Potwierdź', html, id: modalId});
  setTimeout(()=>{
    const btn=document.getElementById('confirm_yes_'+modalId);
    if(btn) btn.onclick=()=>{ closeModal(modalId); onYes(); };
  },0);
}

function showConfirm(msg, onYes, onNo){
  openModal({
    title:'⚠️ Potwierdzenie',
    html:`<p style="color:#cbd5e1;line-height:1.6">${esc(msg).replace(/\n/g,'<br>')}</p>`,
    submitLabel:'Tak, kontynuuj',
    onSubmit:()=>{ if(onYes) onYes(); return true; },
    onClose:()=>{ if(onNo) onNo(); }
  });
}
// — eksport na window (onclick= compatibility)
Object.assign(window, {openModal, closeModal, confirm, showConfirm});
