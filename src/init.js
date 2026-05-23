// ═══════════════════════════════════════════════════════════
// INIT — inicjalizacja aplikacji
// ═══════════════════════════════════════════════════════════

const load = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
}

// Inicjalizacja Supabase (createClient i klucze dostępne z config.js przez window)
try {
  window._sb = window.createClient(window.SB_URL, window.SB_KEY)
} catch (e) {
  console.error('[init] Supabase createClient failed:', e)
}

// Załaduj stan z localStorage
window.S = {
  players:   load(window.KEYS.players,   []),
  agencies:  load(window.KEYS.agencies,  []),
  profiles:  load(window.KEYS.profiles,  []),
  contests:  load(window.KEYS.contests,  []),
  entries:   load(window.KEYS.entries,   []),
  receipts:  load(window.KEYS.receipts,  []),
  templates: load(window.KEYS.templates, []),
  tab:       'dashboard',
  sideOpen:  window.innerWidth > 768,
}

// Wyczyść stare base64 zdjęć z localStorage
try {
  const receiptsRaw = localStorage.getItem('kk_receipts')
  if (receiptsRaw) {
    const rr = JSON.parse(receiptsRaw)
    localStorage.setItem('kk_receipts', JSON.stringify(
      rr.map(r => ({ ...r, photo_local: '', photo: r.photo?.startsWith('http') ? r.photo : '' }))
    ))
  }
} catch (e) {}

// Listener menu-btn (sidebar toggle)
document.getElementById('menu-btn').addEventListener('click', () => {
  window.S.sideOpen = !window.S.sideOpen
  window.renderNav()
})

// Start aplikacji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
  window.initAuth()
  setTimeout(window.autoBackup, 3000)
  setTimeout(() => { window.renderNotifStatus(); window.checkNotifications(); window.syncContestsToSW(); }, 1000)
})
