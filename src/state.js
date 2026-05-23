// ═══════════════════════════════════════════════════════════
// STATE — globalne zmienne stanu (eksponowane na window)
// W ES modules let/const są lokalne — używamy window.xxx
// ═══════════════════════════════════════════════════════════

window._sb              = null
window._currentUser     = null
window._currentFamilyId = null
window._currentRole     = null

window._syncStatus  = 'ok'
window._syncPending = {}
window._deletedIds  = {}

window.S = {
  players: [], agencies: [], profiles: [],
  contests: [], entries: [], receipts: [], templates: [],
  tab: 'dashboard', sideOpen: true,
}

window._modalStack = []

window._currentReceiptsPlayerId = null
window._rcPhotoData     = ''
window._rcPhotoOriginal = ''

window.contestFilter    = 'active'
window.contestTagFilter = ''
window.contestShopFilter = ''
window.contestSearch    = ''
window.contestSort      = 'deadline'

window.calMonth = { y: new Date().getFullYear(), m: new Date().getMonth() }

window._searchTimer     = null
window.entryFilterPlayer = ''
window.entryFilterStatus = ''

window.receiptTabFilter  = 'all'
window.receiptTabPlayer  = ''
window.receiptTabAddedBy = ''

window.deferredPrompt = null

window.aiState = { step: 'input', error: '', extracted: null, form: {} }
