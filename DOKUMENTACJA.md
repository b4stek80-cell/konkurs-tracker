# KonkursTracker — Dokumentacja aplikacji
> Stan: 18 maja 2026 | Stack: HTML/JS + Supabase

---

## 🏗️ Architektura

- **Frontend:** Single-page HTML (jeden plik `index.html`) — bez frameworka, czysty JS
- **Backend/Baza:** Supabase (PostgreSQL + Storage + Auth + Realtime)
- **AI:** Google Gemini API (gemini-2.5-flash-lite + gemini-2.5-flash)
- **Hosting:** GitHub Pages (`b4stek80-cell.github.io/konkurs-tracker`)
- **PWA:** Tak — można zainstalować na telefonie

---

## 📦 Struktura danych (Supabase)

### Tabele i zależności (kolejność zapisu ma znaczenie!):
```
kt_players       ← brak FK (niezależna)
kt_agencies      ← brak FK (niezależna)
kt_profiles      → FK: kt_players + kt_agencies
kt_contests      → FK: kt_agencies
kt_entries       → FK: kt_players + kt_contests + kt_profiles
kt_receipts      ← brak FK (niezależna)
kt_templates     ← brak FK (niezależna)
kt_family_members ← auth.uid()
```

### Klucze lokalne (KEYS):
`players`, `agencies`, `profiles`, `contests`, `entries`, `receipts`, `templates`, `geminiKey`

---

## 🗂️ Zakładki aplikacji

| Zakładka | Opis |
|---|---|
| **Dashboard** | Statystyki, "do wysłania dziś", oczekuję wyników, pilne terminy (≤3 dni) |
| **Konkursy** | Lista aktywnych/planowanych/archiwum, filtry: tag/sklep/sort/search |
| **Gracze** | Zarządzanie graczami, profile agencji, paragony gracza |
| **Zgłoszenia** | Historia zgłoszeń, statusy, przypisanie paragonów |
| **Paragony** | Dodawanie paragonów ze zdjęciem, OCR, terminy ważności |
| **Kalendarz** | Widok miesięczny — deadliny i daty wyników |
| **AI** | Skan regulaminu (URL/PDF/tekst), generowanie odpowiedzi |
| **Szablony** | Gotowe odpowiedzi do konkursów |
| **Statystyki** | Win rate, wykresy |

---

## 🤖 Funkcje AI (Gemini)

### Skan regulaminu (`analyzeWithGemini` / `analyzeWithGeminiVision`)
- **URL** → `fetchPageText` pobiera tekst strony → Gemini Flash Lite analizuje
- **PDF** → base64 → Gemini Flash Vision (OCR) → parse JSON
- **Tekst** → bezpośrednio do Gemini
- Model: `gemini-2.5-flash-lite` (tekst) / `gemini-2.5-flash` (PDF/Vision)
- Wypełnia automatycznie: nazwa, agencja, nagroda, deadline, warunki, limit dzienny, sklepy, zadanie konkursowe

### Generowanie odpowiedzi (`generateForContest`, `generateCustom`)
- Generuje odpowiedzi do zadań konkursowych na podstawie treści zadania
- `findSimilarAnswers` — szuka podobnych odpowiedzi w historii
- `answerSimilarity` — porównuje odpowiedzi by unikać duplikatów

### OCR paragonu (`ocrReceipt`, `runReceiptOCR`)
- Zdjęcie paragonu → Gemini Vision → automatyczne wypełnienie pól (sklep, kwota, data, numer)

---

## 💾 Synchronizacja danych

### Przepływ zapisu:
```
Akcja użytkownika
→ S.xxx.push(nowy_rekord)          # lokalny stan
→ persistAndSync(key, S.xxx)       # zapis do localStorage + async sync
  → localStorage.setItem(...)      # cache
  → syncToSupabase(key)            # REST API do Supabase
    → syncToSupabaseRaw(deps)      # najpierw tabele nadrzędne!
    → syncToSupabaseRaw(key)       # potem właściwa tabela
```

### Przepływ odczytu:
```
initialSync() / manualRefresh()
→ syncFromSupabase(key)
  → sbFetch(table?family_id=eq.XXX)  # filtr po family_id!
  → fromRow(r)                        # mapowanie kolumn DB → JS
→ S.xxx = dane z Supabase
→ render()
```

### sbFetch — kluczowe szczegóły:
- `Authorization: Bearer {access_token}` — token zalogowanego usera (nie anon key!)
- `apikey: SB_KEY` — JWT anon key (`eyJhbGci...`)
- `Prefer: resolution=merge-duplicates,return=representation` — upsert z powrotem rekordów
- Filtr: `?family_id=eq.{_currentFamilyId}` — izolacja danych rodziny

---

## 🔑 Kluczowe zmienne globalne

```javascript
S = {
  players, agencies, profiles,
  contests, entries, receipts,
  templates, tab
}
_currentFamilyId  // UUID rodziny z kt_family_members
_currentUser      // obiekt usera z Supabase Auth
_sb               // klient Supabase JS SDK
```

---

## 🐛 Naprawione błędy (historia)

| # | Problem | Przyczyna | Naprawa |
|---|---|---|---|
| 1 | Zdjęcia paragonów znikały | `toRow` nie wysyłał `photo`, `fromRow` zwracał `photo:''` | Dodano `photo:r.photo\|\|''` w obu |
| 2 | Dane znikały po odświeżeniu | `SB_KEY = 'sb_publishable_...'` — zły format klucza, REST API zwracało 401 | Podmiana na JWT anon key `eyJhbGci...` |
| 3 | Błędy sync niewidoczne | `catch(e){ console.warn() }` — cicho łykał błędy | Dodano `setSyncStatus('error')` + alert |
| 4 | `PGRST102` przy upsert | `toRow: a=>a` wysyłał obiekty z różnymi kluczami | Stały zestaw pól w `toRow` dla players/agencies |
| 5 | `FK violation` przy zapisie | Sync równoległy — contests zapisywały się przed agencies | Kolejność: agencies → profiles → contests → entries |
| 6 | Paragon "nieprzypisany" znikał | `null` vs `"null"` (string) — template literal robił `'${null}'` | Normalizacja `"null"` → `null` w saveReceipt |
| 7 | `dedupeReceipts` kasował paragony | Klucz `shop+date+amount` — dwa różne paragony = jeden znikał | Klucz zmieniony na `id` |
| 8 | `handleLogin` urwany | Brak `}catch` — funkcja nie miała zamknięcia | Dodano brakujące zamknięcie |
| 9 | syncFromSupabase zwracał puste | Poleganie tylko na RLS zamiast jawnego filtra | Dodano `?family_id=eq.XXX` do zapytania |

---

## 🚀 Potencjalne rozbudowy (do dyskusji)

### Wysoki priorytet:
- [ ] **Dedykowana zakładka Paragony** — teraz `receipts_tab` istnieje ale czy jest w nav?
- [ ] **Powiadomienia push** — `checkNotifications()` istnieje, czy działa na telefonie?
- [ ] **Lepszy dashboard** — "ile zgłoszeń dziś zrobiłem" vs dzienny limit

### Średni priorytet:
- [ ] **Statystyki agencji** — które agencje mają najwyższy win rate
- [ ] **Eksport wygranych** — `exportWonCSV()` istnieje, czy działa poprawnie?
- [ ] **Przypomnienia o wynikach** — data wyników z regulaminu → alert

### Do zbadania:
- [ ] Czy realtime (`initRealtime`) działa przy wielu użytkownikach równocześnie?
- [ ] Czy `autoBackup` faktycznie tworzy backup i gdzie go zapisuje?
- [ ] Limity Supabase free tier — ile rekordów, ile storage na zdjęcia

---

## ⚠️ Zasady bezpiecznej pracy

1. **Zawsze wrzucaj plik z outputs Claude** — nie z GitHuba
2. **Jedna zmiana na raz** — test po każdej
3. **Gałąź `dev`** w GitHub — `main` zawsze stabilny
4. **Przed dużą zmianą** — `javascript:localStorage.clear()` po wgraniu
5. **Supabase backup** przed zmianami schematu:
   ```sql
   SELECT * FROM kt_contests; -- skopiuj do notatnika
   ```
