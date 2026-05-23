# Prompt: Migracja KonkursTracker → Vite + TypeScript + Preact

## Kontekst dla Clauda

Pracujemy nad aplikacją **KonkursTracker** — SPA dla "łowców nagród" (śledzenie konkursów, loterii, paragonów, zgłoszeń). Aplikacja jest w pełni funkcjonalna i wdrożona na GitHub Pages.

**Repo:** https://github.com/b4stek80-cell/konkurs-tracker  
**Live:** https://b4stek80-cell.github.io/konkurs-tracker/  
**Lokalnie:** `D:\Projekty\Konkurs`

---

## Aktualny stan (po refaktoryzacji, fazy 1-8)

### Stos technologiczny (PRZED migracją)
- Vanilla JS (ES5/ES6 mix, brak modułów ES)
- Wszystkie funkcje globalne (`window.foo`)
- Brak bundlera, bezpośredni deploy statycznych plików na GitHub Pages
- Supabase JS SDK v2 ładowany z CDN
- Google Gemini 2.5 Flash API (REST)
- PWA (manifest + SW przez blob URL — niedziałający offline)

### Struktura plików (PRZED migracją)
```
index.html          ← 182 linii, czysty HTML + minimalny init script
style.css           ← wszystkie style
manifest.json
icon-192.png, icon-512.png
src/
  config.js         ← KEYS, SB_URL, SB_KEY, NAV, TAGS (stałe globalne)
  state.js          ← let _sb, _currentUser, _currentFamilyId, _currentRole,
                       _syncStatus, _syncPending, _deletedIds, S, _modalStack,
                       _currentReceiptsPlayerId, _rcPhotoData, _rcPhotoOriginal,
                       contestFilter, contestTagFilter, contestShopFilter,
                       contestSearch, contestSort, calMonth, _searchTimer,
                       entryFilterPlayer, entryFilterStatus, receiptTabFilter,
                       receiptTabPlayer, receiptTabAddedBy, deferredPrompt
  utils.js          ← uid, today, daysLeft, fmt, esc, gv, field, finp, ftex,
                       fsel, agencyOpts, fixUrl, ktTodayStr, parseDailyLimit
  db/
    supabase.js     ← SB_TABLES (7 tabel z toRow/fromRow), sbFetch, sbDelete
    sync.js         ← setSyncStatus, isOwner, validateReceiptDate,
                       validateExpireDate, persistAndSync, syncToSupabase,
                       syncToSupabaseRaw, syncFromSupabase, initialSync,
                       manualRefresh, initRealtime, autoBackup
  auth/
    auth.js         ← showAuthScreen, showFamilySetup, handleLogin,
                       handleRegister, handleSolo, handleCreateFamily,
                       handleJoinFamily, authSignIn, authSignUp, authSignOut,
                       getMyFamily, createFamily, joinFamily, showInviteModal,
                       generateAndShowCode, generateInviteCode, initAuth
  modules/
    agencies.js     ← agencyForm, addAgency, editAgency, deleteAgency,
                       renderAgencies
    players.js      ← photoFieldHtml, printPlayerSummary, copyField,
                       previewPhoto, clearPhoto, addPlayer, editPlayer,
                       deletePlayer, openProfileModal, renderPlayers
    receipts.js     ← receiptStatus, receiptStatusBadge, renderReceiptsTab,
                       addReceipt, editReceipt, deleteReceipt, rcPhotoChange,
                       rcOcrPhoto, saveReceiptWithPhoto, showReceiptPhoto (22 fn)
    contests.js     ← resultsDeadlineHtml, deadlineHtml, tagBadge,
                       tagsFieldHtml, toggleTag, getSelectedTags, shopBadge,
                       shopsFieldHtml, getSelectedShops, entriesToday,
                       limitBadgeHtml, archiveContest, unarchiveContest,
                       contestCardHtml, renderContests, setContestFilter,
                       contestSearchDebounced, renderContestList, setContestTag,
                       setContestShop, setContestSort, contestForm, addContest,
                       editContest, deleteContest (25 fn)
    entries.js      ← addEntry, findDuplicateCodes, normAnswer, answerSimilarity,
                       findSimilarAnswers, uploadPrizePhoto, showPrizePhotoModal,
                       deletePrizePhoto, previewPrizePhoto, renderEntries,
                       quickStatus, quickStatusMenu, editEntry, deleteEntry
  ai/
    ai.js           ← aiState, fetchPageText, parseGeminiJSON,
                       extractFieldsFallback, analyzeWithGemini,
                       analyzeWithGeminiVision, renderAI, aiTab, pdfLoad,
                       fillAIForm, runAI, saveAIContest, generateForContest,
                       copyAiResult, generateCustom, promptForApiKey
  ui/
    modal.js        ← openModal, closeModal, confirm, showConfirm
    components.js   ← statusColor, badge, renderNotifStatus
    calendar.js     ← calShift, calToday, renderCalendar, calDayClick
    render.js       ← renderNav, setTab, closeSidebar, renderDashboard,
                       renderStats, render, bindEntryFilters, renderTemplates,
                       showBackupModal
  features/
    notifications.js ← requestNotifPermission, sendNotif, checkNotifications,
                        enableNotifs
    export.js        ← exportData, importData, exportWonCSV, exportViaEmail,
                        exportToClipboard, handleImportText, handleImportFile
    pwa.js           ← SW rejestracja, beforeinstallprompt, appinstalled,
                        installPWA
```

### Modele danych (Supabase — tabele z prefiksem `kt_`)
```
kt_players:       id, family_id, name, photo_url, created_at
kt_agencies:      id, family_id, name, url, notes
kt_profiles:      id, family_id, player_id, agency_id, login, password, notes
kt_contests:      id, family_id, agency_id, name, status, deadline, results_date,
                  prize, prize_value, task, link, tags[], shops[], daily_limit,
                  notes, archived, created_by, created_at
kt_entries:       id, family_id, contest_id, player_id, status, date, answer,
                  notes, prize_photo, created_by, created_at
kt_receipts:      id, family_id, player_id, shop, amount, date, photo_url,
                  contest_id, added_by, expires_at, created_at
kt_templates:     id, family_id, name, content, created_at
kt_families:      id, name, owner_id, created_at
kt_family_members: id, family_id, user_id, role ('owner'|'member'), joined_at
kt_invites:       id, family_id, code, created_by, expires_at, used_by, used_at
```

### Globalny stan `S` (localStorage + Supabase sync)
```js
S = {
  players: [],    // kt_players
  agencies: [],   // kt_agencies
  profiles: [],   // kt_profiles
  contests: [],   // kt_contests
  entries: [],    // kt_entries
  receipts: [],   // kt_receipts
  templates: [],  // kt_templates
  tab: 'dashboard',
  sideOpen: bool,
}
```
**localStorage prefix:** `kk_xxx` (kk_players, kk_contests, itd.)

### Statusy zgłoszeń (entries.status)
`sent | pending | contacted | prize_pending | prize_received | won | lost | no_response | expired`

### Tagi konkursów (contests.tags[])
`purchase | creative | lottery | facebook | instagram | cyclic | sms | guaranteed | jury | easy | gate`

### Klucze konfiguracyjne (z config.js)
```js
SB_URL = 'https://[projekt].supabase.co'
SB_KEY = '[anon key]'  // NIE zmieniać
KEYS = { players:'kk_players', agencies:'kk_agencies', ... } // localStorage keys
NAV = [['dashboard','🏠','Dashboard'], ['contests','🏆','Konkursy'], ...]
TAGS = [['purchase','🧾','Z zakupem'], ...]
```

---

## Cel migracji

**Stack docelowy:**
- **Vite** — bundler, dev server, build dla GitHub Pages
- **TypeScript** — typy dla wszystkich modeli i funkcji
- **Preact + @preact/signals** — reaktywne UI (zamiast `innerHTML` i `render()`)
- **Vitest** — testy jednostkowe
- **GitHub Actions** — automatyczny deploy na GitHub Pages

**Czego NIE zmieniamy:**
- Supabase (baza, auth, RLS, storage) — zostaje bez zmian
- Gemini API integration — logika zostaje, tylko przepisujemy UI
- Dane użytkowników — zero migracji danych
- URL GitHub Pages — zostaje ten sam

---

## FAZA 1: Vite + GitHub Actions (bez zmian kodu)

**Cel:** Aplikacja działa identycznie jak przed, tylko przez Vite. Zero zmiany logiki.

### Kroki:

**1.1 Inicjalizacja Vite**
```bash
cd D:/Projekty/Konkurs
npm create vite@latest . -- --template vanilla
# Wybierz: vanilla (nie vanilla-ts — TypeScript dodamy w fazie 2)
# Usuń template files: main.js, counter.js, public/vite.svg, src/style.css
```

**1.2 Konfiguracja `vite.config.js`**
```js
import { defineConfig } from 'vite'
export default defineConfig({
  base: '/konkurs-tracker/',  // GitHub Pages subdirectory
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  }
})
```

**1.3 Przenieś Supabase z CDN do npm**
```bash
npm install @supabase/supabase-js
```
Usuń `<script src="https://cdn.jsdelivr.net/...supabase.js">` z index.html.
Dodaj do `src/config.js`:
```js
import { createClient } from '@supabase/supabase-js'
// ... exportuj createClient
```
UWAGA: To wymaga dodania `type="module"` do scriptu w index.html lub użycia import w init script.

**1.4 Przekształć pliki na ES modules**
Każdy plik `src/**/*.js` musi używać `export` dla funkcji które używają inne pliki.
Importy przez `import { fn } from './module.js'` zamiast globalnego scope.

KOLEJNOŚĆ IMPORTÓW (krytyczna, odwzoruj poprzednią kolejność `<script>`):
```
config → state → utils → db/supabase → db/sync → auth/auth
→ modules/* → ai/ai → ui/* → features/*
```

Stwórz `src/main.js` który importuje wszystko w tej kolejności i jest punktem wejścia Vite.

**1.5 Problem: `onclick="functionName()"` w HTML**
Funkcje w `onclick=` muszą być globalne (`window.functionName`).
Dwie opcje:
- A) Zostaw `onclick=` i eksponuj funkcje: `window.addContest = addContest` na końcu każdego modułu
- B) (lepsza, zrób to w Fazie 4) Zamień na `addEventListener`

Na ten moment: **opcja A** — minimum zmian, aplikacja musi działać.

**1.6 Zmienne środowiskowe**
Utwórz `.env` (NIE commituj):
```
VITE_SB_URL=https://[projekt].supabase.co
VITE_SB_KEY=[anon key]
```
W `src/config.js`:
```js
export const SB_URL = import.meta.env.VITE_SB_URL
export const SB_KEY = import.meta.env.VITE_SB_KEY
```
Dodaj `.env` do `.gitignore`. Stwórz `.env.example` z pustymi wartościami.

**1.7 GitHub Actions deploy**
Utwórz `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
        env:
          VITE_SB_URL: ${{ secrets.VITE_SB_URL }}
          VITE_SB_KEY: ${{ secrets.VITE_SB_KEY }}
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```
W GitHub repo → Settings → Secrets: dodaj `VITE_SB_URL` i `VITE_SB_KEY`.

**1.8 Weryfikacja Fazy 1**
```bash
npm run dev         # localhost:5173/konkurs-tracker/
npm run build       # dist/ bez błędów
npm run preview     # podgląd builda
```
- [ ] Logowanie działa
- [ ] Dashboard ładuje dane
- [ ] Dodanie konkursu działa
- [ ] Console: zero błędów

---

## FAZA 2: TypeScript

**Cel:** Pełne typy dla modeli danych i funkcji. Zero zmian w logice.

### Kroki:

**2.1 Dodaj TypeScript**
```bash
npm install -D typescript
npx tsc --init
```
Zmień `vite.config.js` → `vite.config.ts`.
Zmień `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

**2.2 Stwórz `src/types.ts`** — WSZYSTKIE interfejsy:
```typescript
export interface Player {
  id: string
  familyId: string
  name: string
  photoUrl?: string
  createdAt?: string
}

export interface Agency {
  id: string
  familyId: string
  name: string
  url?: string
  notes?: string
}

export type ContestStatus = 'active' | 'planned' | 'ended' | 'archived'
export type EntryStatus = 'sent' | 'pending' | 'contacted' | 'prize_pending' |
  'prize_received' | 'won' | 'lost' | 'no_response' | 'expired'
export type MemberRole = 'owner' | 'member'

export interface Contest {
  id: string
  familyId: string
  agencyId?: string
  name: string
  status: ContestStatus
  deadline?: string
  resultsDate?: string
  prize?: string
  prizeValue?: number
  task?: string
  link?: string
  tags?: string[]
  shops?: string[]
  dailyLimit?: number
  notes?: string
  archived?: boolean
  createdBy?: string
  createdAt?: string
}

export interface Entry {
  id: string
  familyId: string
  contestId: string
  playerId: string
  status: EntryStatus
  date: string
  answer?: string
  notes?: string
  prizePhoto?: string
  createdBy?: string
  createdAt?: string
}

export interface Receipt {
  id: string
  familyId: string
  playerId?: string
  shop?: string
  amount?: number
  date: string
  photoUrl?: string
  contestId?: string
  addedBy?: string
  expiresAt?: string
  createdAt?: string
}

export interface Template {
  id: string
  familyId: string
  name: string
  content: string
  createdAt?: string
}

export interface Family {
  id: string
  name: string
  ownerId: string
  createdAt?: string
}

export interface AppState {
  players: Player[]
  agencies: Agency[]
  profiles: Profile[]
  contests: Contest[]
  entries: Entry[]
  receipts: Receipt[]
  templates: Template[]
  tab: string
  sideOpen: boolean
}

export interface ModalOptions {
  title: string
  html: string
  wide?: boolean
  onSubmit?: (div: HTMLElement) => boolean | Promise<boolean>
  submitLabel?: string
  onClose?: () => void
  id?: string
  extraButtons?: string
}
```

**2.3 Przemianuj pliki `.js` → `.ts` stopniowo**
Zacznij od `types.ts`, potem `config.ts`, `state.ts`, `utils.ts`.
Dodaj typy do sygnatur funkcji — nie przepisuj logiki, tylko typy.

**2.4 Napraw błędy TypeScript**
```bash
npx tsc --noEmit    # pokaże wszystkie błędy
```
Typowe problemy:
- `S.contests` → typuj jako `Contest[]`
- Nullability: `agency?.name` zamiast `agency.name`
- `document.getElementById('x')` → rzutuj: `as HTMLElement`

**2.5 Weryfikacja Fazy 2**
```bash
npx tsc --noEmit    # zero błędów
npm run build       # działa
```
Aplikacja działa identycznie jak w Fazie 1.

---

## FAZA 3: Preact + Signals (state management)

**Cel:** Zastąpienie globalnego `S` reaktywnym store'em. Jeszcze BEZ przepisywania komponentów.

### Kroki:

**3.1 Instalacja**
```bash
npm install preact @preact/signals
```

**3.2 Stwórz `src/store.ts`** — reaktywny state zamiast `S`:
```typescript
import { signal, computed } from '@preact/signals'
import type { AppState, Contest, Entry, Player, Agency, Receipt, Template } from './types'

export const players = signal<Player[]>([])
export const agencies = signal<Agency[]>([])
export const profiles = signal<Profile[]>([])
export const contests = signal<Contest[]>([])
export const entries = signal<Entry[]>([])
export const receipts = signal<Receipt[]>([])
export const templates = signal<Template[]>([])
export const currentTab = signal<string>('dashboard')
export const sideOpen = signal<boolean>(window.innerWidth > 768)

// Auth state
export const currentUser = signal<User | null>(null)
export const currentFamilyId = signal<string | null>(null)
export const currentRole = signal<MemberRole | null>(null)

// UI filters
export const contestFilter = signal<string>('all')
export const contestSearch = signal<string>('')
export const contestTagFilter = signal<string[]>([])
export const entryFilterPlayer = signal<string>('')
export const entryFilterStatus = signal<string>('')

// Computed
export const activeContests = computed(() =>
  contests.value.filter(c => c.status === 'active')
)
export const urgentContests = computed(() =>
  activeContests.value.filter(c => {
    const d = daysLeft(c.deadline)
    return d !== null && d >= 0 && d <= 3
  })
)
```

**3.3 Migracja `state.js` → importuje z `store.ts`**
Stare globalne zmienne zamieniają się na importy sygnałów.
Funkcje które pisały do `S.contests = [...]` teraz piszą do `contests.value = [...]`.

**3.4 Adapter — tymczasowy most między starym `S` a signals**
W `src/state.ts` stwórz obiekt `S` który jest proxy na signals:
```typescript
// Tymczasowy adapter — usuniemy w Fazie 4
export const S = {
  get players() { return players.value },
  set players(v) { players.value = v },
  get contests() { return contests.value },
  set contests(v) { contests.value = v },
  // ... etc
  tab: 'dashboard',
  sideOpen: true,
}
```
Dzięki temu stary kod `S.contests` nadal działa — bez przepisywania wszystkich modułów naraz.

**3.5 Weryfikacja Fazy 3**
Aplikacja działa. Zmiana stanu aktualizuje dane w signals.
Możesz zweryfikować przez console: `import { contests } from './store'; console.log(contests.value)`.

---

## FAZA 4: Preact komponenty (moduł po module)

**Cel:** Zastąpienie `render()` → `innerHTML` prawdziwymi komponentami Preact.

**Strategia:** Zacznij od liścia (bez dzieci), idź w górę do korzenia (`render()`).

### Kolejność migracji (od najprostszego):

**4.1 Komponenty pomocnicze** (`ui/components.ts` → `ui/Badge.tsx`, `ui/StatusBadge.tsx`)
```tsx
import { h } from 'preact'
import type { EntryStatus } from '../types'

export function StatusBadge({ status }: { status: EntryStatus }) {
  const colors: Record<EntryStatus, [string, string]> = {
    sent: ['#f59e0b', 'Wysłano'],
    won: ['#22c55e', 'Wygrano'],
    // ...
  }
  const [c, l] = colors[status] ?? ['#9ca3af', status]
  return (
    <span class="badge" style={{ background: `${c}22`, color: c, borderColor: `${c}44` }}>
      {l}
    </span>
  )
}
```

**4.2 Modal** (`ui/Modal.tsx`)
Zastąp `openModal()` komponentem Preact renderowanym do `#modal-root`.
```tsx
import { render, h } from 'preact'
import { signal } from '@preact/signals'

const modals = signal<ModalData[]>([])

export function openModal(options: ModalOptions) {
  // push do modals signal
}

function ModalRoot() {
  return (
    <div>
      {modals.value.map(m => <Modal key={m.id} {...m} />)}
    </div>
  )
}

// Inicjalizacja
render(<ModalRoot />, document.getElementById('modal-root')!)
```

**4.3 Sidebar/Nav** (`ui/Sidebar.tsx`)
```tsx
import { h } from 'preact'
import { currentTab, sideOpen, urgentContests } from '../store'
import { NAV } from '../config'

export function Sidebar() {
  return (
    <aside id="sidebar" class={sideOpen.value ? '' : 'hidden'}>
      <nav>
        {NAV.map(([id, icon, label]) => (
          <button
            key={id}
            class={currentTab.value === id ? 'active' : ''}
            onClick={() => { currentTab.value = id }}
          >
            {icon} {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
```

**4.4 Moduły danych** (każdy osobno, zrób PR na feature branch):
- `modules/ContestList.tsx` (zastępuje `renderContests`)
- `modules/EntryList.tsx` (zastępuje `renderEntries`)
- `modules/PlayerList.tsx` (zastępuje `renderPlayers`)
- `modules/ReceiptList.tsx` (zastępuje `renderReceiptsTab`)
- `modules/AgencyList.tsx` (zastępuje `renderAgencies`)

**4.5 Dashboard** (`ui/Dashboard.tsx`)
Największy komponent. Zrób go ostatni po opanowaniu reszty.

**4.6 App root** (`App.tsx`)
```tsx
import { h } from 'preact'
import { currentTab } from './store'
import { Sidebar } from './ui/Sidebar'
import { Dashboard } from './ui/Dashboard'
import { ContestList } from './modules/ContestList'
// ...

export function App() {
  return (
    <div id="app">
      <Sidebar />
      <main id="content">
        {currentTab.value === 'dashboard' && <Dashboard />}
        {currentTab.value === 'contests' && <ContestList />}
        {/* ... */}
      </main>
    </div>
  )
}
```

**4.7 Usuń adapter `S`**
Po migracji wszystkich modułów — usuń tymczasowy adapter z Fazy 3.

**4.8 Zastąp `onclick=` w HTML**
Po tym kroku nie ma już `onclick="..."` w żadnym template literal — wszystko to `onClick={handler}` w JSX.

**4.9 Weryfikacja Fazy 4**
- [ ] Zero `innerHTML =` w całej bazie kodu
- [ ] Zero `onclick="..."` stringów
- [ ] Wszystkie zakładki działają
- [ ] Formularze (dodaj/edytuj) działają
- [ ] Sync z Supabase działa
- [ ] AI tab działa

---

## FAZA 5: Testy

**Cel:** Podstawowe testy dla warstwy logiki biznesowej i synchronizacji.

**5.1 Instalacja**
```bash
npm install -D vitest @testing-library/preact jsdom
```

**5.2 `vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    globals: true,
  }
})
```

**5.3 Testy jednostkowe — zacznij od utils**
```typescript
// src/utils.test.ts
import { describe, it, expect } from 'vitest'
import { daysLeft, fmt, uid, esc } from './utils'

describe('daysLeft', () => {
  it('returns null for empty deadline', () => {
    expect(daysLeft(undefined)).toBeNull()
  })
  it('returns 0 for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(daysLeft(today)).toBe(0)
  })
})

describe('esc', () => {
  it('escapes HTML entities', () => {
    expect(esc('<script>alert(1)</script>')).not.toContain('<script>')
  })
})
```

**5.4 Testy sync logiki (z mockowanym Supabase)**
```typescript
// src/db/sync.test.ts
import { vi } from 'vitest'
// mock sbFetch
vi.mock('./supabase', () => ({
  sbFetch: vi.fn().mockResolvedValue([])
}))
// testuj validateReceiptDate, isOwner, etc.
```

**5.5 Testy komponentów (Preact Testing Library)**
```typescript
// src/ui/Badge.test.tsx
import { render } from '@testing-library/preact'
import { StatusBadge } from './Badge'

it('renders correct label for "won" status', () => {
  const { getByText } = render(<StatusBadge status="won" />)
  expect(getByText('Wygrano')).toBeTruthy()
})
```

**5.6 Dodaj testy do GitHub Actions**
W `deploy.yml` przed krokiem `build`:
```yaml
- run: npm test -- --run
```

---

## Ważne pułapki i uwagi

### Supabase auth w modułach ES
`_sb` musi być inicjowany PO załadowaniu Supabase SDK. W Vite jest to proste:
```typescript
import { createClient } from '@supabase/supabase-js'
export const sb = createClient(SB_URL, SB_KEY)
```
Wszystkie moduły importują `sb` bezpośrednio z tego pliku.

### `onclick=` w stringu vs JSX
W starym kodzie jest wiele `onclick="editContest('${id}')"` wewnątrz template literals.
Podczas migracji do komponentów każdy taki pattern staje się:
```tsx
<button onClick={() => editContest(id)}>Edytuj</button>
```
NIE możesz używać string onclick w JSX — Preact traktuje to jako atrybut, nie handler.

### Gemini API key
Aktualnie `localStorage.getItem(KEYS.geminiKey)`.
Zostaw tak — użytkownik sam wpisuje klucz, nie chcemy go w env.

### Supabase Storage URL
Zdjęcia paragonów są w Supabase Storage — URL-e przechowywane w `kt_receipts.photo_url`.
`_sb.storage.from('receipts').upload(...)` — ta logika jest w `src/modules/receipts.js`.
Przy migracji do TS — zwróć uwagę na typy zwracane przez Storage API.

### PWA Service Worker
Aktualny SW przez blob URL nie działa. W Fazie 1 możesz go zostawić.
Docelowo: użyj [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) który automatycznie generuje poprawny SW.
```bash
npm install -D vite-plugin-pwa
```

### GitHub Pages i `base`
`vite.config.ts` musi mieć `base: '/konkurs-tracker/'`.
Wszystkie assety (ikony, style) muszą używać względnych ścieżek lub `import.meta.env.BASE_URL`.

### `window.confirm` shadowing
W starym kodzie `function confirm(msg, onYes)` przysłania `window.confirm`.
Przy migracji do TS — zmień nazwę na `showDeleteConfirm` lub coś unikalnego.

---

## Zalecana kolejność commitów/PR-ów

```
feat: add Vite build + GitHub Actions deploy (Faza 1)
feat: migrate to TypeScript + add type definitions (Faza 2)
feat: add Preact Signals store, keep S adapter (Faza 3)
feat: migrate ui/modal to Preact component (Faza 4a)
feat: migrate ui/sidebar and nav to Preact (Faza 4b)
feat: migrate modules/contests to Preact component (Faza 4c)
feat: migrate modules/entries to Preact component (Faza 4d)
feat: migrate modules/players to Preact component (Faza 4e)
feat: migrate modules/receipts to Preact component (Faza 4f)
feat: migrate ui/dashboard to Preact component (Faza 4g)
feat: remove S adapter, clean up globals (Faza 4h)
test: add unit tests for utils and sync logic (Faza 5a)
test: add component tests for Badge, Modal (Faza 5b)
```

---

## Weryfikacja końcowa (po wszystkich fazach)

1. `npm run build` — zero błędów TypeScript i bundlera
2. `npm test` — wszystkie testy zielone
3. GitHub Actions deploy — zielone
4. Logowanie + wylogowanie — działa
5. Dodaj konkurs przez AI scan — działa
6. Dodaj paragon ze zdjęciem → OCR → zapis → odśwież → zdjęcie zostaje
7. Zaloguj z drugiego urządzenia → te same dane (Supabase sync)
8. Member próbuje usunąć → dostaje blokadę (RLS)
9. DevTools → Console: zero błędów
10. DevTools → Network: brak CDN requestów (wszystko z bundla)
11. Lighthouse PWA score — powinno być > 90

---

## Na start nowej sesji

Powiedz Claudowi:

> "Pracujemy nad migracją KonkursTracker do Vite + TypeScript + Preact.
> Przeczytaj plik MIGRACJA_PROMPT.md z katalogu D:\Projekty\Konkurs — tam jest
> pełny kontekst projektu i plan migracji. Zaczynamy od Fazy [N]."
