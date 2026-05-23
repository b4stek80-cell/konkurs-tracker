// ═══════════════════════════════════════════════════════════
// PWA — Service Worker, install prompt, installPWA
// ═══════════════════════════════════════════════════════════

if('serviceWorker' in navigator && import.meta.env.PROD){
  navigator.serviceWorker.register('/konkurs-tracker/sw.js', {scope: '/konkurs-tracker/'})
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.warn('SW registration failed:', err));
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
// — eksport na window (onclick= compatibility)
Object.assign(window, {installPWA});
