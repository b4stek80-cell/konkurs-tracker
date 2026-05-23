# Postępy prac — KonkursTracker

---

## 2026-05-23

### Analiza projektu (start sesji)
- Przeanalizowano strukturę projektu: single-file SPA (`index.html`, ~4626 linii, 160KB)
- Stos: Vanilla JS + Supabase (PostgreSQL + Auth + Storage) + Google Gemini 2.5 Flash + PWA
- Moduły: Gracze, Agencje, Profile, Konkursy, Zgłoszenia, Paragony, Rodziny, Kalendarz, AI, Statystyki, Backup
- Baza: 10 tabel Supabase (kt_players, kt_agencies, kt_profiles, kt_contests, kt_entries, kt_receipts, kt_templates, kt_families, kt_family_members, kt_invites)
- Stan: aplikacja production-ready, w pełni funkcjonalna
- Założono plik śledzenia postępów (ten plik)

## 2026-05-23

### Faza 1 modularyzacji — CSS + config.js
- Przeniesiono cały CSS (78 linii) z `<style>` w index.html do nowego pliku `style.css`
- Zastąpiono `<style>` tagiem `<link rel="stylesheet" href="style.css">` w index.html
- Stworzono plik `src/config.js` z 5 globalnymi stałymi: `KEYS`, `SB_URL`, `SB_KEY`, `NAV`, `TAGS`
- Dodano `<script src="src/config.js"></script>` do index.html (po Supabase CDN, przed main script)
- Usunięto przeniesione stałe z głównego `<script>` w index.html
- Żadna logika nie została zmieniona — tylko przenoszenie kodu

## 2026-05-23

### Naprawa 3 błędów z konsoli przeglądarki
- **Bug #1 (kt_profiles.created_at):** `syncFromSupabase` używał `order=created_at.asc.nullsfirst` dla wszystkich tabel, ale `kt_profiles` nie ma tej kolumny → zmieniono na `order=id.asc` (bezpieczne dla wszystkich tabel)
- **Bug #2 (initRealtime not defined):** Funkcje `manualRefresh` i `initRealtime` oraz zmienna `_realtimeChannel` były przypadkowo zagnieżdżone wewnątrz `handleLogin`'s `try{}` zamiast na poziomie globalnym → przeniesiono je po zamknięciu `handleLogin` (linia ~4182), `setTimeout(initRealtime,1000)` pozostaje wewnątrz try jako wywołanie
- **Bug #3 (SW blob):** Drobny błąd PWA Service Worker — niekrytyczny, pozostawiony bez zmian

## 2026-05-23

### Faza 2 modularyzacji — state.js + utils.js
- Stworzono `src/state.js`: 22 zmienne globalne (`_sb`, `_currentUser`, `_currentFamilyId`, `_currentRole`, `_syncStatus`, `_syncPending`, `_deletedIds`, `S`, `_modalStack`, `_currentReceiptsPlayerId`, `_rcPhotoData`, `_rcPhotoOriginal`, `contestFilter`, `contestTagFilter`, `contestShopFilter`, `contestSearch`, `contestSort`, `calMonth`, `_searchTimer`, `entryFilterPlayer`, `entryFilterStatus`, `receiptTabFilter`, `receiptTabPlayer`, `receiptTabAddedBy`, `deferredPrompt`)
- Stworzono `src/utils.js`: 14 funkcji (`uid`, `today`, `daysLeft`, `fmt`, `esc`, `gv`, `field`, `finp`, `ftex`, `fsel`, `agencyOpts`, `fixUrl`, `ktTodayStr`, `parseDailyLimit`)
- Usunięto wszystkie przeniesione deklaracje z index.html (0 pozostałości)
- `let S = {}` zmienione na przypisanie `S = {}` (load() działa po deklaracji w state.js)
- `const _sb = ...` zmienione na `_sb = ...` (deklaracja w state.js)
- Kolejność `<script>`: supabase CDN → config.js → state.js → utils.js → main script

## 2026-05-23

### Faza 3 modularyzacji — warstwa bazodanowa (src/db/)
- Stworzono `src/db/supabase.js`: `SB_TABLES` (7 tabel z toRow/fromRow), `sbFetch`, `sbDelete`
- Stworzono `src/db/sync.js`: `setSyncStatus`, `isOwner`, `validateReceiptDate`, `validateExpireDate`, `persistAndSync`, `syncToSupabase`, `syncToSupabaseRaw`, `syncFromSupabase`, `initialSync`, `manualRefresh`, `_realtimeChannel` + `initRealtime`, `autoBackup`
- Usunięto wszystkie przeniesione funkcje z index.html (0 pozostałości)
- Składnia wszystkich 5 plików JS: OK (node --check)
- Kolejność `<script>`: supabase CDN → config.js → state.js → utils.js → db/supabase.js → db/sync.js → main script

## 2026-05-23

### Faza 4 modularyzacji — autoryzacja (src/auth/auth.js)
- Stworzono `src/auth/auth.js`: 17 funkcji auth/rodzina/zaproszenia:
  - Auth UI: `showAuthScreen`, `showFamilySetup`, `handleLogin`, `handleRegister`, `handleSolo`, `handleCreateFamily`, `handleJoinFamily`
  - Auth API: `authSignIn`, `authSignUp`, `authSignOut`
  - Rodzina: `getMyFamily`, `createFamily`, `joinFamily`
  - Zaproszenia: `showInviteModal`, `generateAndShowCode`, `generateInviteCode`
  - Bootstrap: `initAuth` + nasłuchiwacz `onAuthStateChange`
- Usunięto wszystkie przeniesione funkcje z index.html (0 pozostałości — zweryfikowano grep'em)
- Dodano `<script src="src/auth/auth.js"></script>` do index.html po db/sync.js
- Składnia pliku: OK (node --check)
- Kolejność `<script>`: supabase CDN → config.js → state.js → utils.js → db/supabase.js → db/sync.js → auth/auth.js → main script

## 2026-05-23

### Faza 5 modularyzacji — moduły danych (contests.js + entries.js)

**src/modules/contests.js** (dokończono):
- Plik już istniał (stworzony w poprzedniej sesji), ale funkcje nie były usunięte z index.html
- Przeniesione (26 funkcji): `resultsDeadlineHtml`, `deadlineHtml`, `tagBadge`, `tagsFieldHtml`, `toggleTag`, `getSelectedTags`, `shopBadge`, `shopsFieldHtml`, `getSelectedShops`, `entriesToday`, `limitBadgeHtml`, `archiveContest`, `unarchiveContest`, `contestCardHtml`, `renderContests`, `setContestFilter`, `contestSearchDebounced`, `renderContestList`, `setContestTag`, `setContestShop`, `setContestSort`, `contestForm`, `addContest`, `editContest`, `deleteContest`
- Dodano `<script src="src/modules/contests.js"></script>` do index.html

**src/modules/entries.js** (nowy plik):
- Przeniesione (14 funkcji): `addEntry`, `findDuplicateCodes`, `normAnswer`, `answerSimilarity`, `findSimilarAnswers`, `uploadPrizePhoto`, `showPrizePhotoModal`, `deletePrizePhoto`, `previewPrizePhoto`, `renderEntries`, `quickStatus`, `quickStatusMenu`, `editEntry`, `deleteEntry`
- Dodano `<script src="src/modules/entries.js"></script>` do index.html

- Usunięto wszystkie przeniesione funkcje z index.html (0 pozostałości — zweryfikowano grep'em)
- Składnia obu plików: OK (node --check)
- index.html: 4627 → 2060 linii po całej fazie 5
- Kolejność `<script>`: ... → auth/auth.js → agencies.js → players.js → receipts.js → contests.js → entries.js → main script

## 2026-05-23

### Faza 6 modularyzacji — moduł AI (src/ai/ai.js)

- Stworzono `src/ai/ai.js` (866 linii) z 16 funkcjami:
  `aiState` (zmienna globalna), `fetchPageText`, `parseGeminiJSON`, `extractFieldsFallback`, `analyzeWithGemini`, `analyzeWithGeminiVision`, `renderAI`, `aiTab`, `pdfLoad`, `fillAIForm`, `runAI`, `saveAIContest`, `generateForContest`, `copyAiResult`, `generateCustom`, `promptForApiKey`
- Funkcje `render`, `bindEntryFilters`, `renderTemplates` pozostały w index.html (nie są częścią AI)
- Naprawiono osierocony `}` po sekcji PLAYERS (błąd z poprzedniej sesji — powodował SyntaxError)
- Usunięto wszystkie przeniesione funkcje z index.html (0 pozostałości)
- Składnia ai.js: OK (node --check)
- index.html: 2060 → 1280 linii po fazie 6
- Kolejność `<script>`: ... → entries.js → ai/ai.js → main script

## 2026-05-23

### Faza 7 modularyzacji — warstwa UI (src/ui/)

- Stworzono `src/ui/modal.js` (4 funkcje): `openModal`, `closeModal`, `confirm`, `showConfirm`
- Stworzono `src/ui/components.js` (3 funkcje): `statusColor`, `badge`, `renderNotifStatus`
- Stworzono `src/ui/calendar.js` (4 funkcje): `calShift`, `calToday`, `renderCalendar`, `calDayClick`
- Stworzono `src/ui/render.js` (9 funkcji): `renderNav`, `setTab`, `closeSidebar`, `renderDashboard`, `renderStats`, `render`, `bindEntryFilters`, `renderTemplates`, `showBackupModal`
- Usunięto wszystkie przeniesione funkcje z index.html (0 pozostałości — zweryfikowano grep'em)
- Składnia wszystkich 4 plików UI: OK (node --check)
- index.html: 1280 → 615 linii po fazie 7
- Kolejność `<script>`: ... → ai/ai.js → ui/modal.js → ui/components.js → ui/calendar.js → ui/render.js → main script

## 2026-05-23

### Faza 8 modularyzacji — finalne sprzątanie (src/features/)

- Stworzono `src/features/notifications.js` (4 funkcje + setInterval): `requestNotifPermission`, `sendNotif`, `checkNotifications`, `enableNotifs`
- Stworzono `src/features/export.js` (7 funkcji): `exportData`, `importData`, `exportWonCSV`, `exportViaEmail`, `exportToClipboard`, `handleImportText`, `handleImportFile`
- Stworzono `src/features/pwa.js`: SW rejestracja, `beforeinstallprompt`/`appinstalled` listenery, `installPWA`
- Oczyszczono inline `<script>` w index.html — zostało TYLKO: `load()`, inicjalizacja `_sb`, inicjalizacja `S`, listener menu-btn, cleanup localStorage, `DOMContentLoaded` → `initAuth`, `setTimeout(autoBackup)`, `setTimeout(renderNotifStatus/checkNotifications)`
- Składnia wszystkich 3 plików features: OK (node --check)
- index.html: 615 → **182 linii** / **11KB** po fazie 8 (cel < 20KB — osiągnięty)
- Łącznie 20 skryptów modułowych + 1 inline skrypt inicjalizacyjny
- Git: pierwsze commitowanie projektu — gałąź `refactor` + `main` (ten sam root commit)
- GitHub Pages: https://b4stek80-cell.github.io/konkurs-tracker/
