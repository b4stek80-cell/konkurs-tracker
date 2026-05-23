// ═══════════════════════════════════════════════════════════
// CONFIG — stałe globalne aplikacji
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SB_URL
const SB_KEY = import.meta.env.VITE_SB_KEY

const KEYS = {
  players:   'kk_players',
  agencies:  'kk_agencies',
  profiles:  'kk_profiles',
  contests:  'kk_contests',
  entries:   'kk_entries',
  receipts:  'kk_receipts',
  templates: 'kk_templates',
  geminiKey: 'kk_gemini_key',
}

const NAV = [
  ['dashboard',    '🏠', 'Dashboard'],
  ['players',      '👤', 'Gracze'],
  ['agencies',     '🏢', 'Agencje'],
  ['contests',     '🏆', 'Konkursy'],
  ['calendar',     '📅', 'Kalendarz'],
  ['entries',      '📨', 'Zgłoszenia'],
  ['receipts_tab', '🧾', 'Paragony'],
  ['stats',        '📊', 'Statystyki'],
  ['templates',    '✨', 'Generuj odpowiedź z AI'],
  ['ai',           '🤖', 'Dodaj konkurs z AI'],
]

const TAGS = [
  { id: 'purchase',   label: '🧾 Z zakupem',    color: '#f59e0b' },
  { id: 'creative',   label: '✏️ Kreatywny',    color: '#6366f1' },
  { id: 'lottery',    label: '🎲 Losowanie',    color: '#22c55e' },
  { id: 'facebook',   label: '📘 Facebook',     color: '#3b82f6' },
  { id: 'instagram',  label: '📸 Instagram',    color: '#e879f9' },
  { id: 'cyclic',     label: '🔁 Cykliczny',    color: '#06b6d4' },
  { id: 'sms',        label: '📱 SMS',          color: '#f97316' },
  { id: 'guaranteed', label: '🎁 Gwarantowany', color: '#34d399' },
  { id: 'jury',       label: '👨‍⚖️ Jury',         color: '#a78bfa' },
  { id: 'easy',       label: '⚡ Łatwy',        color: '#fbbf24' },
  { id: 'gate',       label: '🚪 Bramka',       color: '#f43f5e' },
]

// Eksponuj na window (dostęp z onclick= i pozostałych modułów)
Object.assign(window, { SB_URL, SB_KEY, KEYS, NAV, TAGS, createClient })
