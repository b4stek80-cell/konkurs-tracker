// ═══════════════════════════════════════════════════════════
// RENDER ENGINE — renderNav, setTab, closeSidebar, renderDashboard,
//   renderStats, render, bindEntryFilters, renderTemplates, showBackupModal
// ═══════════════════════════════════════════════════════════

function renderNav(){
  const urgent = S.contests.filter(c=>{const d=daysLeft(c.deadline);return c.status==='active'&&d!==null&&d>=0&&d<=3;}).length;
  const pill = document.getElementById('urgent-pill');
  if(urgent>0){ pill.style.display=''; pill.textContent=`🔔 ${urgent} pilne`; }
  else pill.style.display='none';

  document.getElementById('nav').innerHTML = NAV.map(([id,icon,label])=>`
    <button onclick="setTab('${id}')" class="${S.tab===id?'active':''}">
      <span class="nav-icon">${icon}</span>${esc(label)}
      ${id==='contests'&&urgent>0?`<span class="urgent-badge">${urgent}</span>`:''}
    </button>`).join('');

  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebar-overlay');
  const isMobile=window.innerWidth<=768;
  // Na mobile sidebar zawsze jako overlay (nie w flow)
  if(isMobile){
    if(S.sideOpen){
      sb.classList.remove('hidden');
      ov.style.display='block';
    } else {
      sb.classList.add('hidden');
      ov.style.display='none';
    }
  } else {
    sb.classList.remove('hidden');
    ov.style.display='none';
  }
  const ct=document.getElementById('content');
  if(ct) ct.style.marginLeft='';
}

function setTab(t){ S.tab=t; if(window.innerWidth<=768) S.sideOpen=false; render(); }
function closeSidebar(){ S.sideOpen=false; renderNav(); }

function renderDashboard(){
  const todayStr=today();
  const active=S.contests.filter(c=>c.status==='active');
  const won=S.entries.filter(e=>e.status==='won').length;
  const total=S.entries.length;
  const wr=total>0?Math.round((won/total)*100):0;

  // ── "Do wysłania dziś" – aktywne konkursy bez żadnego zgłoszenia LUB z limitem dziennym
  const notSubmitted=active.filter(c=>{
    const d=daysLeft(c.deadline);
    if(d===null||d<0) return false;
    const myEntries=S.entries.filter(e=>e.contestId===c.id);
    return myEntries.length===0;
  }).sort((a,b)=>daysLeft(a.deadline)-daysLeft(b.deadline));

  // ── "Oczekuję wyników" – zgłoszone, bez wyniku
  const waiting=S.entries.filter(e=>['sent','pending','contacted','prize_pending'].includes(e.status));
  const waitingContests=[...new Map(waiting.map(e=>[e.contestId,e])).values()]
    .map(e=>({entry:e,contest:S.contests.find(c=>c.id===e.contestId)}))
    .filter(x=>x.contest)
    .sort((a,b)=>(a.contest.deadline||'').localeCompare(b.contest.deadline||''));

  // ── Pilne terminy (3 dni)
  const critical=active.filter(c=>{const d=daysLeft(c.deadline);return d!==null&&d>=0&&d<=3;})
    .sort((a,b)=>daysLeft(a.deadline)-daysLeft(b.deadline));

  // ── Statystyki górne
  const urgentContests=S.contests.filter(c=>c.status==='active'&&daysLeft(c.deadline)!==null&&daysLeft(c.deadline)>=0&&daysLeft(c.deadline)<=7).length;
  const stats=[
    ['👤',S.players.length,'Graczy','#818cf8','players'],
    ['🏢',S.agencies.length,'Agencji','#06b6d4','agencies'],
    ['🏆',active.length,'Aktywnych','#34d399','contests'],
    ['📨',total,'Zgłoszeń','#fbbf24','entries'],
    ['🎉',won,'Wygranych','#22c55e','stats'],
    ['🧾',S.receipts.length,'Paragonów','#f97316','receipts_tab'],
    ['📅',urgentContests,'Pilnych (7d)','#ef4444','calendar'],
    ['📊',wr+'%','Win Rate','#818cf8','stats'],
  ];

  // ── Sekcja "Do wysłania" — kompaktowa lista
  const todoHtml = notSubmitted.length===0
    ? '<div style="color:#475569;font-size:13px;padding:8px 0">Wszystkie aktywne konkursy mają zgłoszenia 🎉</div>'
    : notSubmitted.slice(0,5).map(ct=>{
        const d=daysLeft(ct.deadline);
        const ag=S.agencies.find(a=>a.id===ct.agencyId);
        const col=d<=1?'#ef4444':d<=3?'#f59e0b':'#94a3b8';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e2a3a">
          <div style="flex-shrink:0;width:36px;height:36px;background:${col}18;border:1px solid ${col}44;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${col}">${d===0?'Dziś':d+'d'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ct.name)}</div>
            <div style="font-size:11px;color:#64748b">${esc(ag?.name?.split(' ')[0]||'—')}${ct.prize?' · '+esc(ct.prize.slice(0,25))+(ct.prize.length>25?'…':''):''}</div>
            ${ct.shops&&ct.shops.length?`<div style="font-size:10px;color:#ef4444;font-weight:700">⚠️ ${ct.shops.slice(0,2).join(', ')}</div>`:''}
            ${limitBadgeHtml(ct)}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
            ${ct.link?`<button onclick="window.open('${esc(fixUrl(ct.link))}','_blank','noopener,noreferrer')" style="font-size:10px;padding:3px 7px;background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:5px;cursor:pointer;font-weight:600">🔗</button>`:''}
            <button onclick="addEntry('${ct.id}')" style="font-size:10px;padding:3px 7px;background:#22c55e22;color:#4ade80;border:1px solid #22c55e33;border-radius:5px;cursor:pointer;font-weight:600">+Zgłoś</button>
          </div>
        </div>`;
      }).join('')
    + (notSubmitted.length>5?`<button onclick="setTab('contests')" style="width:100%;margin-top:8px;padding:6px;background:none;border:1px solid #1e2a3a;border-radius:7px;color:#6366f1;cursor:pointer;font-size:12px">Zobacz wszystkie (${notSubmitted.length}) →</button>`:'');

  // ── Sekcja "Oczekuję wyników"
  const waitHtml = waitingContests.length===0
    ? '<div style="color:#475569;font-size:13px;padding:8px 0">Brak oczekujących zgłoszeń</div>'
    : waitingContests.slice(0,6).map(({entry:e,contest:ct})=>{
        const ag=S.agencies.find(a=>a.id===ct.agencyId);
        const p=S.players.find(x=>x.id===e.playerId);
        return `<div style="padding:9px 0;border-bottom:1px solid #1e2a3a">
          <div style="font-weight:600;color:#f1f5f9;font-size:13px;margin-bottom:3px">${esc(ct.name)}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">${esc(p?.name||'?')} · ${esc(ag?.name||'—')}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="quickStatusMenu('${e.id}','${e.status}',this)" style="padding:2px 8px;font-size:11px;border-radius:6px;cursor:pointer;border:1px solid ${statusColor(e.status)}44;background:${statusColor(e.status)}18;color:${statusColor(e.status)};font-weight:600">${badge(e.status)} ▾</button>
            <span style="font-size:11px;color:#475569">${fmt(e.date)}</span>
          </div>
        </div>`;
      }).join('')
    + (waitingContests.length>6?`<div style="font-size:12px;color:#475569;padding:8px 0">...i ${waitingContests.length-6} więcej</div>`:'');

  // ── Sekcja "Pilne terminy"
  const critHtml = critical.length===0 ? '' :
    `<div class="card" style="border-color:#ef444433;margin-bottom:12px">
      <div style="font-weight:700;color:#f87171;margin-bottom:10px;display:flex;align-items:center;gap:6px">
        🚨 Pilne — zostały 3 dni lub mniej!
      </div>
      ${critical.map(c=>{
        const d=daysLeft(c.deadline);
        const ag=S.agencies.find(a=>a.id===c.agencyId);
        const hasEntry=S.entries.some(e=>e.contestId===c.id);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2d3548;gap:8px;flex-wrap:wrap">
          <div>
            <span style="font-weight:600;color:#f1f5f9;font-size:13px">${esc(c.name)}</span>
            <span style="font-size:11px;color:#64748b"> · ${esc(ag?.name||'—')}</span>
            ${c.shops&&c.shops.length?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px">${c.shops.map(s=>shopBadge(s)).join('')}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="color:#ef4444;font-weight:700;font-size:14px">${d===0?'DZIŚ!':d+'d'}</span>
            ${hasEntry
              ? '<span style="font-size:11px;color:#22c55e">✓ zgłoszono</span>'
              : `<button onclick="addEntry('${c.id}')" style="font-size:11px;padding:4px 10px;background:#ef444422;color:#f87171;border:1px solid #ef444433;border-radius:6px;cursor:pointer;font-weight:600">Zgłoś!</button>`
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // ── Zbliżają się wyniki (konkurs z results_date <= 3 dni)
  const resultsComingSoon=S.contests.filter(c=>{
    if(!c.results_date) return false;
    const d=daysLeft(c.results_date);
    return d!==null&&d>=0&&d<=7;
  }).sort((a,b)=>daysLeft(a.results_date)-daysLeft(b.results_date));

  const resultsHtml = resultsComingSoon.length===0 ? '' :
    `<div class="card" style="border-color:#8b5cf633;margin-bottom:12px">
      <div style="font-weight:700;color:#a78bfa;margin-bottom:10px">🎯 Ogłoszenie wyników wkrótce</div>
      ${resultsComingSoon.map(ct=>{
        const d=daysLeft(ct.results_date);
        const myEntries=S.entries.filter(e=>e.contestId===ct.id&&['sent','pending','contacted'].includes(e.status));
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2d3548;gap:8px;flex-wrap:wrap">
          <div>
            <span style="font-weight:600;color:#f1f5f9;font-size:13px">${esc(ct.name)}</span>
            <span style="font-size:11px;color:#64748b"> · ${fmt(ct.results_date)}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="color:#8b5cf6;font-weight:700;font-size:13px">${d===0?'DZIŚ!':d+'d'}</span>
            ${myEntries.length>0
              ? `<span style="font-size:11px;color:#94a3b8">${myEntries.length} zgł.</span>`
              : '<span style="font-size:11px;color:#475569">brak zgłoszenia</span>'
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;flex-wrap:wrap;gap:6px">
      <h1 style="font-size:24px;font-weight:800;color:#f1f5f9;margin:0">Dashboard</h1>
      <span style="font-size:12px;color:#475569">${new Date().toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'})}</span>
    </div>

    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      ${stats.map(([icon,val,label,color,nav])=>`
        <div class="stat-card" onclick="setTab('${nav}')" style="cursor:pointer;padding:12px 10px"
          onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='#2d3548'">
          <div style="font-size:18px;margin-bottom:3px">${icon}</div>
          <div class="val" style="color:${color};font-size:22px">${val}</div>
          <div class="lbl">${label}</div>
        </div>`).join('')}
    </div>

    ${critHtml}
    ${resultsHtml}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:12px">
      <div class="card" style="padding:14px">
        <div style="font-weight:700;color:#f1f5f9;margin-bottom:6px;font-size:14px;display:flex;justify-content:space-between;align-items:center">
          <span>📋 Do wysłania <span style="background:#6366f133;color:#818cf8;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px">${notSubmitted.length}</span></span>
          <button onclick="setTab('contests')" style="background:none;border:none;color:#475569;font-size:11px;cursor:pointer">Wszystkie →</button>
        </div>
        ${todoHtml}
      </div>
      <div class="card" style="padding:14px">
        <div style="font-weight:700;color:#f1f5f9;margin-bottom:6px;font-size:14px;display:flex;justify-content:space-between;align-items:center">
          <span>⏳ Oczekuję <span style="background:#f59e0b33;color:#fbbf24;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px">${waitingContests.length}</span></span>
          <button onclick="setTab('entries')" style="background:none;border:none;color:#475569;font-size:11px;cursor:pointer">Wszystkie →</button>
        </div>
        ${waitHtml}
      </div>
    </div>`;
}

function renderStats(){
  const total=S.entries.length;
  const won=S.entries.filter(e=>e.status==='won').length;
  const lost=S.entries.filter(e=>e.status==='lost').length;
  const sent=S.entries.filter(e=>e.status==='sent').length;
  const pending=S.entries.filter(e=>e.status==='pending').length;
  const contacted=S.entries.filter(e=>e.status==='contacted').length;
  const prize_pending=S.entries.filter(e=>e.status==='prize_pending').length;
  const prize_received=S.entries.filter(e=>e.status==='prize_received').length;
  const no_response=S.entries.filter(e=>e.status==='no_response').length;
  const wr=total>0?((won/total)*100).toFixed(1):0;

  const bar=(label,val,color)=>`<div class="bar-wrap">
    <div class="bar-row"><span style="color:#94a3b8">${label}</span><span style="color:${color};font-weight:700">${val}</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${total>0?(val/total)*100:0}%;background:${color}"></div></div>
  </div>`;

  const playerRows=S.players.map(p=>{
    const pe=S.entries.filter(e=>e.playerId===p.id);
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2a3a;flex-wrap:wrap;gap:6px">
      <span style="font-weight:600;color:#f1f5f9;font-size:14px">${esc(p.name)}</span>
      <div class="row" style="gap:12px;font-size:13px">
        <span style="color:#64748b">${pe.length} zgł.</span>
        <span style="color:#22c55e">✓ ${pe.filter(e=>e.status==='won').length}</span>
        <span style="color:#ef4444">✗ ${pe.filter(e=>e.status==='lost').length}</span>
        <span style="color:#f59e0b">~ ${pe.filter(e=>e.status==='sent'||e.status==='pending').length}</span>
      </div>
    </div>`;
  }).join('');

  // ── Faza 4: Skuteczność per agencja ────────────────────────────────────────
  const agencyStats=S.agencies.map(ag=>{
    const agContests=S.contests.filter(ct=>ct.agencyId===ag.id);
    const agContestIds=agContests.map(ct=>ct.id);
    const agEntries=S.entries.filter(e=>agContestIds.includes(e.contestId));
    const agWon=agEntries.filter(e=>['won','prize_received','prize_pending'].includes(e.status)).length;
    const agDecided=agEntries.filter(e=>['won','lost','prize_received','prize_pending'].includes(e.status)).length;
    const agWr=agDecided>0?Math.round((agWon/agDecided)*100):null;
    return {agency:ag,entries:agEntries.length,won:agWon,decided:agDecided,wr:agWr};
  }).filter(s=>s.entries>0).sort((a,b)=>(b.wr||-1)-(a.wr||-1));

  // ── Skuteczność per typ zadania (tag) ──────────────────────────────────────
  const tagLabels={purchase:'🧾 Z zakupem',creative:'✏️ Kreatywny',lottery:'🎲 Losowanie',
    facebook:'📘 Facebook',instagram:'📸 Instagram',cyclic:'🔁 Cykliczny',sms:'📱 SMS',
    guaranteed:'🎁 Gwarantowany',jury:'👨‍⚖️ Jury',easy:'⚡ Łatwy',gate:'🚪 Bramka'};
  const tagStats=Object.keys(tagLabels).map(tag=>{
    const tagContestIds=S.contests.filter(ct=>ct.tags&&ct.tags.includes(tag)).map(ct=>ct.id);
    const tagEntries=S.entries.filter(e=>tagContestIds.includes(e.contestId));
    const tagWon=tagEntries.filter(e=>['won','prize_received','prize_pending'].includes(e.status)).length;
    const tagDecided=tagEntries.filter(e=>['won','lost','prize_received','prize_pending'].includes(e.status)).length;
    return {tag,label:tagLabels[tag],entries:tagEntries.length,won:tagWon,decided:tagDecided,
      wr:tagDecided>0?Math.round((tagWon/tagDecided)*100):null};
  }).filter(s=>s.entries>0).sort((a,b)=>(b.wr||-1)-(a.wr||-1));

  const wrBadge=(wr)=>{
    if(wr===null) return '<span style="color:#475569;font-size:12px">brak rozstrzygnięć</span>';
    const col=wr>=50?'#22c55e':wr>=25?'#f59e0b':'#ef4444';
    return '<span style="background:'+col+'22;color:'+col+';border:1px solid '+col+'44;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">'+wr+'%</span>';
  };

  // Najlepsza i najgorsza agencja
  const decidedAgencies=agencyStats.filter(s=>s.wr!==null);
  const bestAgency=decidedAgencies[0];
  const worstAgency=decidedAgencies[decidedAgencies.length-1];

  return `
    <h1 style="font-size:22px;font-weight:800;color:#f1f5f9;margin-bottom:20px">📊 Statystyki</h1>
    <div class="stat-grid">
      ${[['Zgłoszeń',total,'#f1f5f9'],['Wygranych',won,'#22c55e'],['Przegranych',lost,'#ef4444'],['Oczekuje',sent+pending,'#f59e0b'],['Win Rate',wr+'%','#818cf8']].map(([l,v,c])=>`
        <div class="stat-card"><div class="val" style="color:${c}">${v}</div><div class="lbl">${l}</div></div>`).join('')}
    </div>

    ${bestAgency||worstAgency?`<div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;color:#f1f5f9;margin-bottom:12px;font-size:14px">💡 Podpowiedzi</div>
      ${bestAgency&&bestAgency.wr>0?`<div style="font-size:13px;color:#86efac;margin-bottom:6px">✓ Najlepiej Ci idzie u <strong>${esc(bestAgency.agency.name.split(' ').slice(0,3).join(' '))}</strong> — ${bestAgency.wr}% skuteczności (${bestAgency.won}/${bestAgency.decided})</div>`:''}
      ${worstAgency&&bestAgency&&worstAgency!==bestAgency&&worstAgency.wr===0?`<div style="font-size:13px;color:#fca5a5">✗ Brak wygranych u <strong>${esc(worstAgency.agency.name.split(' ').slice(0,3).join(' '))}</strong> — rozważ inny typ konkursów</div>`:''}
      ${tagStats[0]&&tagStats[0].wr>0?`<div style="font-size:13px;color:#93c5fd;margin-top:6px">🎯 Najskuteczniejszy typ: <strong>${tagStats[0].label}</strong> (${tagStats[0].wr}%)</div>`:''}
    </div>`:''}

    ${total>0?`<div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;color:#f1f5f9;margin-bottom:14px;font-size:14px">Podział zgłoszeń</div>
      ${bar('Wysłane',sent,'#f59e0b')}
  ${bar('Oczekuje wyników',pending,'#8b5cf6')}
  ${bar('Kontaktowali się',contacted,'#06b6d4')}
  ${bar('Nagroda w drodze',prize_pending,'#f97316')}
  ${bar('Nagroda odebrana',prize_received,'#34d399')}
  ${bar('Wygrane',won,'#22c55e')}
  ${bar('Przegrane',lost,'#ef4444')}
  ${no_response>0?bar('Brak odpowiedzi',no_response,'#ef4444'):''}
    </div>`:''}

    ${agencyStats.length?`<div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;color:#f1f5f9;margin-bottom:14px;font-size:14px">🏢 Skuteczność per agencja</div>
      ${agencyStats.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1e2a3a;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#f1f5f9;font-weight:600">${esc(s.agency.name.split(' ').slice(0,3).join(' '))}</div>
          <div style="font-size:11px;color:#64748b">${s.entries} zgłoszeń · ${s.won} wygranych</div>
        </div>
        ${wrBadge(s.wr)}
      </div>`).join('')}
    </div>`:''}

    ${tagStats.length?`<div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;color:#f1f5f9;margin-bottom:14px;font-size:14px">🏷️ Skuteczność per typ konkursu</div>
      ${tagStats.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #1e2a3a;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#f1f5f9;font-weight:600">${s.label}</div>
          <div style="font-size:11px;color:#64748b">${s.entries} zgłoszeń · ${s.won} wygranych</div>
        </div>
        ${wrBadge(s.wr)}
      </div>`).join('')}
    </div>`:''}

    <div class="card">
      <div style="font-weight:700;color:#f1f5f9;margin-bottom:14px;font-size:14px">👤 Wyniki per gracz</div>
      ${playerRows||'<div style="color:#475569;font-size:13px">Brak graczy</div>'}
    </div>

    ${(()=>{
      const prizeEntries=S.entries.filter(e=>e.prize_photo&&['won','prize_received','prize_pending'].includes(e.status));
      if(!prizeEntries.length) return '';
      const galleryItems=prizeEntries.map(e=>{
        const ct=S.contests.find(x=>x.id===e.contestId);
        const p=S.players.find(x=>x.id===e.playerId);
        return `<div style="text-align:center;cursor:pointer" onclick="showPrizePhotoModal('${e.id}')">
          <img src="${e.prize_photo}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:2px solid #22c55e44">
          <div style="font-size:10px;color:#64748b;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ct?.name?.slice(0,20)||'?')}</div>
          <div style="font-size:10px;color:#818cf8">${esc(p?.name?.split(' ')[0]||'?')}</div>
        </div>`;
      }).join('');
      return '<div class="card"><div style="font-weight:700;color:#f1f5f9;margin-bottom:12px;font-size:14px">🏆 Galeria nagród ('+prizeEntries.length+')</div>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">'+galleryItems+'</div></div>';
    })()}`;
}

function render(){
  renderNav();
  // Email w sidebarze
  const emailEl=document.getElementById('sidebar_user_email');
  if(emailEl) emailEl.textContent=_currentUser?'👤 '+_currentUser.email:'';

  // Re-bind filter listeners (need to happen after DOM update)
  const content=document.getElementById('content');
  switch(S.tab){
    case 'dashboard': content.innerHTML=renderDashboard(); break;
    case 'players':   content.innerHTML=renderPlayers(); break;
    case 'agencies':  content.innerHTML=renderAgencies(); break;
    case 'contests':  content.innerHTML=renderContests(); break;
    case 'calendar':  content.innerHTML=renderCalendar(); break;
    case 'entries':   content.innerHTML=renderEntries(); bindEntryFilters(); break;
    case 'receipts_tab': content.innerHTML=renderReceiptsTab(); break;
    case 'stats':     content.innerHTML=renderStats(); break;
    case 'templates':  content.innerHTML=renderTemplates(); break;
    case 'ai':        content.innerHTML=renderAI(); break;
    default:          content.innerHTML=renderDashboard();
  }
  content.scrollTop=0;
}

function bindEntryFilters(){
  const ep=document.getElementById('ef_player');
  const es=document.getElementById('ef_status');
  if(ep) ep.addEventListener('change',e=>{entryFilterPlayer=e.target.value;render();});
  if(es) es.addEventListener('change',e=>{entryFilterStatus=e.target.value;render();});
}

function renderTemplates(){
  const active=S.contests.filter(x=>x.status==='active');
  const withTask=active.filter(x=>x.task);
  const apiKey=localStorage.getItem(KEYS.geminiKey)||'';

  const contestCards = active.length===0
    ? '<p style="color:#475569;text-align:center;padding:32px 0">Brak aktywnych konkursów — dodaj konkursy najpierw</p>'
    : active.map(ct=>{
        const ag=S.agencies.find(a=>a.id===ct.agencyId);
        const d=daysLeft(ct.deadline);
        const col=d!==null&&d<=3?'#ef4444':d!==null&&d<=7?'#f59e0b':'#64748b';
        return `<div style="background:#0a0e1a;border:1px solid #2d3548;border-radius:10px;padding:14px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
            <div style="flex:1">
              <div style="font-weight:700;color:#f1f5f9;font-size:14px">${esc(ct.name)}</div>
              <div style="font-size:11px;color:#64748b">${esc(ag?.name||'—')}${d!==null?` · <span style="color:${col};font-weight:600">${d}d</span>`:''}${ct.prize?` · ${esc(ct.prize)}`:''}</div>
            </div>
            <button onclick="generateForContest('${ct.id}')" class="btn-gemini btn-sm" style="flex-shrink:0">✨ Generuj</button>
          </div>
          ${ct.task
            ? `<div style="background:#6366f111;border:1px solid #6366f133;border-radius:6px;padding:7px 10px;font-size:12px;color:#818cf8"><strong>🎯 Zadanie:</strong> ${esc(ct.task)}</div>`
            : `<div style="color:#475569;font-size:12px;font-style:italic">Brak zadania konkursowego — dodaj je edytując konkurs</div>`
          }
        </div>`;
      }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <h1 style="font-size:22px;font-weight:800;color:#f1f5f9;margin:0">✨ Generuj odpowiedź AI</h1>
      <button onclick="generateCustom()" class="btn-gemini btn-sm">✨ Własny temat</button>
    </div>

    ${!apiKey?`<div style="background:#f59e0b11;border:1px solid #f59e0b33;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#fbbf24">
      ⚠️ Brak klucza Gemini API — <button onclick="promptForApiKey()" style="background:none;border:none;color:#f59e0b;cursor:pointer;font-weight:700;font-size:13px;text-decoration:underline">kliknij aby dodać</button>
    </div>`:''}

    <div style="background:#131929;border:1px solid #1e2a3a;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#475569;line-height:1.6">
      💡 Wybierz konkurs i kliknij <strong style="color:#818cf8">✨ Generuj</strong> — AI napisze 3 różne odpowiedzi pod zadanie konkursowe. Tekst brzmi naturalnie, po ludzku.
    </div>

    <div id="ai_gen_result"></div>

    <div style="font-weight:700;color:#f1f5f9;margin-bottom:10px;font-size:14px">🏆 Aktywne konkursy (${active.length})</div>
    ${contestCards}`;
}

function showBackupModal(){
  openModal({title:'💾 Backup i import danych', html:`
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:#22c55e11;border:1px solid #22c55e33;border-radius:10px;padding:12px 14px;font-size:13px;color:#86efac">
        📦 Baza: ${S.players.length} graczy · ${S.agencies.length} agencji · ${S.contests.length} konkursów · ${S.entries.length} zgłoszeń
      </div>

      <div style="background:#22c55e11;border:1px solid #22c55e33;border-radius:10px;padding:14px">
        <div style="font-size:14px;font-weight:700;color:#4ade80;margin-bottom:6px">⬇️ Eksportuj backup</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:8px">Wyślij dane na email lub skopiuj do schowka</div>
        <button onclick="exportViaEmail()" style="width:100%;padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">
          📧 Wyślij na email
        </button>
        <button onclick="exportToClipboard(this)" style="width:100%;padding:10px;background:#22c55e44;color:#4ade80;border:1px solid #22c55e33;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
          📋 Kopiuj do schowka
        </button>
      </div>

      <div style="background:#f59e0b11;border:1px solid #f59e0b33;border-radius:10px;padding:14px">
        <div style="font-size:14px;font-weight:700;color:#fbbf24;margin-bottom:6px">📊 Eksport wygranych (CSV)</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:8px">Lista wygranych do arkusza kalkulacyjnego (Excel, Sheets)</div>
        <button onclick="exportWonCSV()" style="width:100%;padding:10px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          📊 Pobierz CSV wygranych
        </button>
      </div>
      <div style="background:#6366f111;border:1px solid #6366f133;border-radius:10px;padding:14px">
        <div style="font-size:14px;font-weight:700;color:#818cf8;margin-bottom:6px">⬆️ Importuj (wklej ze schowka)</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:8px">Wklej wcześniej skopiowany JSON poniżej i kliknij Importuj</div>
        <textarea id="import_json_text" style="width:100%;min-height:80px;font-size:11px;font-family:monospace;box-sizing:border-box;background:#0a0e1a;color:#f1f5f9;border:1px solid #2d3548;border-radius:8px;padding:8px" placeholder="Wklej tutaj skopiowany JSON..."></textarea>
        <button onclick="handleImportText()" style="width:100%;margin-top:8px;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          ⬆️ Importuj wklejony JSON
        </button>
      </div>
    </div>`,
    submitLabel:'Zamknij', onSubmit:()=>true
  });
}