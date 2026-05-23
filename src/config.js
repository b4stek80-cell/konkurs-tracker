// ═══════════════════════════════════════════════════════════
// CONFIG — stałe globalne aplikacji
// ═══════════════════════════════════════════════════════════

const KEYS = {players:'kk_players',agencies:'kk_agencies',profiles:'kk_profiles',contests:'kk_contests',entries:'kk_entries',receipts:'kk_receipts',templates:'kk_templates',geminiKey:'kk_gemini_key'};

// ─── Supabase ────────────────────────────────────────────────────────────────
const SB_URL = 'https://eefftuyuuryhrvckpdoi.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZmZ0dXl1dXJ5aHJ2Y2twZG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzIxNzMsImV4cCI6MjA5NDUwODE3M30.nCpF0A5RhSRwCrPcDDI4uwUdxg5LO4P6umUiHb2O7l0';

// ─── Nawigacja ────────────────────────────────────────────────────────────────
const NAV = [
  ['dashboard','🏠','Dashboard'],
  ['players','👤','Gracze'],
  ['agencies','🏢','Agencje'],
  ['contests','🏆','Konkursy'],
  ['calendar','📅','Kalendarz'],
  ['entries','📨','Zgłoszenia'],
  ['receipts_tab','🧾','Paragony'],
  ['stats','📊','Statystyki'],
  ['templates','✨','Generuj odpowiedź z AI'],
  ['ai','🤖','Dodaj konkurs z AI'],
];

// ─── Tagi konkursów ────────────────────────────────────────────────────────────
const TAGS = [
  {id:'purchase',    label:'🧾 Z zakupem',    color:'#f59e0b'},
  {id:'creative',    label:'✏️ Kreatywny',    color:'#6366f1'},
  {id:'lottery',     label:'🎲 Losowanie',    color:'#22c55e'},
  {id:'facebook',    label:'📘 Facebook',     color:'#3b82f6'},
  {id:'instagram',   label:'📸 Instagram',    color:'#e879f9'},
  {id:'cyclic',      label:'🔁 Cykliczny',    color:'#06b6d4'},
  {id:'sms',         label:'📱 SMS',          color:'#f97316'},
  {id:'guaranteed',  label:'🎁 Gwarantowany', color:'#34d399'},
  {id:'jury',        label:'👨‍⚖️ Jury',         color:'#a78bfa'},
  {id:'easy',        label:'⚡ Łatwy',        color:'#fbbf24'},
  {id:'gate',        label:'🚪 Bramka',       color:'#f43f5e'},
];
