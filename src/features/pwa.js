// ═══════════════════════════════════════════════════════════
// PWA — Service Worker, install prompt, installPWA
// ═══════════════════════════════════════════════════════════

if('serviceWorker' in navigator){
  // Zarejestruj SW przez blob URL (single-file app)
  const swCode = `
const SW_VERSION = '1.0.0';
const CACHE = 'kt-v1';
const OFFLINE_URLS = ['/konkurs-tracker/'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/konkurs-tracker/')))
  );
});
`;
  const swBlob = new Blob([swCode], {type: 'application/javascript'});
  const swUrl = URL.createObjectURL(swBlob);
  navigator.serviceWorker.register(swUrl, {scope: '/konkurs-tracker/'})
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.log('SW blob failed, trying direct:', err));
}

// ── Install prompt ──────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  // Pokaż przycisk instalacji jeśli nie zainstalowano
  const installBtn = document.getElementById('install_btn');
  if(installBtn) installBtn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installBtn = document.getElementById('install_btn');
  if(installBtn) installBtn.style.display = 'none';
});

function installPWA(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
}