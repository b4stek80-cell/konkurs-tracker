// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS — requestNotifPermission, sendNotif, checkNotifications, enableNotifs
// ═══════════════════════════════════════════════════════════

async function requestNotifPermission(){
  if(!('Notification' in window)) return false;
  if(Notification.permission==='granted') return true;
  const p = await Notification.requestPermission();
  return p==='granted';
}

function sendNotif(title, body, tag='kt'){
  if(Notification.permission!=='granted') return;
  new Notification(title, {body, tag, icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏆</text></svg>'});
}

function checkNotifications(){
  if(Notification.permission!=='granted') return;
  const now = new Date();

  // Kończące się terminy zgłoszeń (3 dni)
  S.contests.filter(c=>c.status==='active').forEach(c=>{
    const d=daysLeft(c.deadline);
    if(d===1){
      sendNotif(
        '⏰ Jutro ostatni dzień!',
        c.name + (c.prize?' · '+c.prize:''),
        'deadline_'+c.id
      );
    } else if(d===0){
      sendNotif('🚨 Dziś ostatni dzień!', c.name, 'deadline_today_'+c.id);
    }
  });

  // Ogłoszenie wyników (dzień wcześniej i w dniu)
  S.contests.forEach(c=>{
    if(!c.results_date) return;
    const d=daysLeft(c.results_date);
    const myEntries=S.entries.filter(e=>e.contestId===c.id&&['sent','pending','contacted'].includes(e.status));
    if(!myEntries.length) return;
    if(d===1) sendNotif('🎯 Jutro ogłoszenie wyników!', c.name, 'results_'+c.id);
    if(d===0) sendNotif('🎯 Dziś ogłoszenie wyników!', c.name, 'results_today_'+c.id);
  });
}

// Sprawdzaj powiadomienia co godzinę (gdy aplikacja otwarta)
setInterval(checkNotifications, 60*60*1000);

// ─── Panel ustawień powiadomień w sidebar footer ──────────────────────────────

async function enableNotifs(){
  const ok=await requestNotifPermission();
  if(ok){ checkNotifications(); }
  renderNotifStatus();
}
// — eksport na window (onclick= compatibility)
Object.assign(window, {requestNotifPermission, sendNotif, checkNotifications, enableNotifs});
