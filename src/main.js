// ═══════════════════════════════════════════════════════════
// MAIN — punkt wejścia Vite (importuje moduły w kolejności)
// ═══════════════════════════════════════════════════════════

import './config.js'
import './state.js'
import './utils.js'
import './db/supabase.js'
import './db/sync.js'
import './auth/auth.js'
import './modules/agencies.js'
import './modules/players.js'
import './modules/receipts.js'
import './modules/contests.js'
import './modules/entries.js'
import './ai/ai.js'
import './ui/modal.js'
import './ui/components.js'
import './ui/calendar.js'
import './ui/render.js'
import './features/notifications.js'
import './features/export.js'
import './features/pwa.js'
import './init.js'
