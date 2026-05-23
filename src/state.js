// ═══════════════════════════════════════════════════════════
// STATE — globalne zmienne stanu aplikacji
// ═══════════════════════════════════════════════════════════

// Supabase client (inicjalizowany po załadowaniu SDK)
let _sb = null;

// Auth
let _currentUser = null;
let _currentFamilyId = null;
let _currentRole = null;

// Sync
let _syncStatus = 'ok';
let _syncPending = {};
let _deletedIds = {};

// Główny stan aplikacji
let S = { players:[], agencies:[], profiles:[], contests:[], entries:[], receipts:[], templates:[], tab:'dashboard' };

// Modal
let _modalStack = [];

// Paragony
let _currentReceiptsPlayerId = null;
let _rcPhotoData = '';
let _rcPhotoOriginal = '';

// Filtry konkursów
let contestFilter = 'active';
let contestTagFilter = '';
let contestShopFilter = '';
let contestSearch = '';
let contestSort = 'deadline';

// Kalendarz
let calMonth = { y: new Date().getFullYear(), m: new Date().getMonth() };

// Filtry zgłoszeń
let _searchTimer = null;
let entryFilterPlayer = '';
let entryFilterStatus = '';

// Filtry paragonów
let receiptTabFilter = 'all';
let receiptTabPlayer = '';
let receiptTabAddedBy = '';

// PWA
let deferredPrompt = null;
