// ═══════════════════════════════════════════════════════════
// COMPONENTS — statusColor, badge, renderNotifStatus
// ═══════════════════════════════════════════════════════════

function statusColor(s){
  const colors={sent:'#f59e0b',pending:'#8b5cf6',contacted:'#06b6d4',
    prize_pending:'#f97316',prize_received:'#34d399',won:'#22c55e',
    lost:'#ef4444',no_response:'#64748b',expired:'#475569'};
  return colors[s]||'#64748b';
}

function badge(status){
  const m={
    active:['#22c55e','Aktywny'],planned:['#3b82f6','Planowany'],ended:['#6b7280','Zakończony'],
    sent:['#f59e0b','Wysłano'],won:['#22c55e','Wygrano'],lost:['#ef4444','Przegrano'],
    pending:['#8b5cf6','Oczekuje wyników'],
    contacted:['#06b6d4','Kontaktowali się'],
    prize_pending:['#f97316','Nagroda w drodze'],
    prize_received:['#22c55e','Nagroda odebrana'],
    expired:['#6b7280','Termin minął'],
    no_response:['#ef4444','Brak odpowiedzi']
  };
  const [c,l]=m[status]||['#9ca3af',status];
  return `<span class="badge" style="background:${c}22;color:${c};border-color:${c}44">${esc(l)}</span>`;
}

function renderNotifStatus(){
  const el=document.getElementById('notif_status');
  if(!el) return;
  if(!('Notification' in window)){
    el.innerHTML='<span style="color:#475569;font-size:11px">Przeglądarka nie wspiera powiadomień</span>';
    return;
  }
  const p=Notification.permission;
  if(p==='granted'){
    el.innerHTML='<span style="color:#22c55e;font-size:11px">🔔 Powiadomienia włączone</span>';
  } else if(p==='denied'){
    el.innerHTML='<span style="color:#ef4444;font-size:11px">🔕 Powiadomienia zablokowane</span>';
  } else {
    el.innerHTML='<button onclick="enableNotifs()" style="background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer">🔔 Włącz powiadomienia</button>';
  }
}
// — eksport na window (onclick= compatibility)
Object.assign(window, {statusColor, badge, renderNotifStatus});
