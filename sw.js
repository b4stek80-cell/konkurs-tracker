const CACHE = 'kt-v1';
const NOTIF_CACHE = 'kt-notifications-v1';
const OFFLINE_URLS = ['/konkurs-tracker/'];
const ICON = '/konkurs-tracker/favicon.svg';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== NOTIF_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim()).then(() => checkFromCache())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/konkurs-tracker/')))
  );
});

// Wiadomości ze strony — aktualizacja danych konkursów
self.addEventListener('message', e => {
  if(e.data?.type === 'KT_STORE_CONTESTS') {
    caches.open(NOTIF_CACHE).then(c =>
      c.put('/kt-notifications-data', new Response(JSON.stringify(e.data.payload), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
  }
});

// Periodic Background Sync (Chrome Android, zainstalowane PWA)
self.addEventListener('periodicsync', e => {
  if(e.tag === 'kt-deadline-check') e.waitUntil(checkFromCache());
});

// Powiadomienie push (jeśli kiedyś dojdzie serwer)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(data.title || '🏆 KonkursTracker', {
    body: data.body || '',
    icon: ICON,
    tag: data.tag || 'kt-push',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/konkurs-tracker/'));
});

async function checkFromCache() {
  try {
    const cache = await caches.open(NOTIF_CACHE);
    const resp = await cache.match('/kt-notifications-data');
    if(!resp) return;
    const data = await resp.json();
    if(!data?.contests) return;
    data.contests.forEach(c => {
      const d = daysLeft(c.deadline);
      if(d === 1) notify('⏰ Jutro ostatni dzień!', c.name + (c.prize ? ' · ' + c.prize : ''), 'dl1_' + c.id);
      if(d === 0) notify('🚨 Dziś ostatni dzień!', c.name, 'dl0_' + c.id);
      if(c.results_date) {
        const dr = daysLeft(c.results_date);
        if(dr === 1) notify('🎯 Jutro ogłoszenie wyników!', c.name, 'res1_' + c.id);
        if(dr === 0) notify('🎯 Dziś ogłoszenie wyników!', c.name, 'res0_' + c.id);
      }
    });
  } catch(e) { /* silent */ }
}

function notify(title, body, tag) {
  self.registration.showNotification(title, { body, tag, icon: ICON, badge: ICON });
}

function daysLeft(dateStr) {
  if(!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
