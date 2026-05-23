# 🏆 KonkursTracker

Aplikacja webowa dla łowców nagród — zarządzanie konkursami, zgłoszeniami, paragonami i graczami w systemie rodzinnym.

**Live:** https://b4stek80-cell.github.io/konkurs-tracker/

---

## Stack techniczny

- **Frontend:** Vanilla JS, HTML/CSS — single file (`index.html`)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Google Gemini 2.5 Flash (analiza regulaminów, generowanie odpowiedzi)
- **Hosting:** GitHub Pages

---

## Funkcje

### Gracze i profile
- Gracze z avatarami, emailem, telefonem
- Profile per agencja (osobny email/konto/adres dla każdej agencji)
- Kopiowanie danych jednym kliknięciem 📋
- Wydruk podsumowania gracza 🖨️

### Agencje
- Baza agencji reklamowych
- Statystyki skuteczności per agencja

### Konkursy
- Dodawanie ręczne lub przez AI (analiza regulaminu z URL/PDF/tekstu)
- Tagi: 🧾 Z zakupem, ✏️ Kreatywny, 🎲 Losowanie, 📘 Facebook, 📸 Instagram, 🔁 Cykliczny, 📱 SMS, 🎁 Gwarantowany, 👨‍⚖️ Jury, ⚡ Łatwy, 🚪 Bramka
- Sklepy konkursowe z alertami
- Limity dzienne zgłoszeń
- Archiwum konkursów 📦
- Kalendarz terminów

### Zgłoszenia
- 9 statusów (Wysłano → Wygrano/Przegrano)
- Generowanie odpowiedzi AI (4 style: Osobista/Z humorem/Prosta/Rymowana)
- Historia odpowiedzi, wykrywanie duplikatów
- Kody konkursowe z walidacją
- Zdjęcie nagrody 📸 (Supabase Storage)
- Galeria nagród w Statystykach

### Paragony
- Zakładka Paragony — centralny hub
- Zdjęcia w Supabase Storage (widoczne dla całej rodziny)
- Numer paragonu + kasa fiskalna
- Przypisanie do gracza i konkursu
- Daty ważności z alertami
- Blokada duplikatów tego samego paragonu w konkursie

### System rodzinny
- Supabase Auth (email + hasło)
- Rodziny z zaproszeniami (kod 6-znakowy, ważny 7 dni)
- Dane współdzielone w rodzinie przez RLS
- Informacja kto dodał paragon

### Dashboard
- 8 kafelków statystyk z nawigacją
- Sekcje: Do wysłania, Oczekuję wyników
- Alerty pilnych terminów (≤3 dni)
- Alerty ogłoszenia wyników

### Inne
- PWA (instalacja na telefonie)
- Auto-backup raz dziennie
- Backup/Import przez schowek
- Powiadomienia push (terminy, wyniki)
- Statystyki per agencja, per tag
- Sortowanie i filtrowanie konkursów

---

## Supabase — tabele

| Tabela | Opis |
|--------|------|
| `kt_players` | Gracze |
| `kt_agencies` | Agencje reklamowe |
| `kt_profiles` | Profile graczy per agencja |
| `kt_contests` | Konkursy |
| `kt_entries` | Zgłoszenia |
| `kt_receipts` | Paragony |
| `kt_templates` | Szablony odpowiedzi AI |
| `kt_families` | Rodziny |
| `kt_family_members` | Członkowie rodzin |
| `kt_invites` | Kody zaproszeń |

**Storage bucket:** `receipts` (zdjęcia paragonów i nagród)

---

## Ważne SQL (historia migracji)

```sql
-- Brakujące kolumny kt_contests (kluczowa poprawka!)
ALTER TABLE kt_contests ADD COLUMN IF NOT EXISTS shops TEXT[] DEFAULT '{}';
ALTER TABLE kt_contests ADD COLUMN IF NOT EXISTS task TEXT DEFAULT '';
ALTER TABLE kt_contests ADD COLUMN IF NOT EXISTS rules_link TEXT DEFAULT '';
ALTER TABLE kt_contests ADD COLUMN IF NOT EXISTS prize_value TEXT DEFAULT '';
ALTER TABLE kt_contests ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT NULL;

-- Paragony
ALTER TABLE kt_receipts ADD COLUMN IF NOT EXISTS receipt_nr TEXT DEFAULT NULL;
ALTER TABLE kt_receipts ADD COLUMN IF NOT EXISTS cash_register TEXT DEFAULT NULL;
ALTER TABLE kt_receipts ADD COLUMN IF NOT EXISTS expire_date TEXT DEFAULT NULL;
ALTER TABLE kt_receipts ADD COLUMN IF NOT EXISTS added_by TEXT DEFAULT NULL;

-- Zgłoszenia
ALTER TABLE kt_entries ADD COLUMN IF NOT EXISTS prize_photo TEXT DEFAULT NULL;
```

---

## Znane problemy / TODO

- [ ] Synchronizacja między użytkownikami wymaga kliknięcia ☁️ (brak real-time)
- [ ] Zdjęcia paragonów nie są w backupie (są w Supabase Storage)
- [ ] Aplikacja wymaga połączenia z internetem (online-only)
- [ ] Jeden plik 160KB — trudny w utrzymaniu

---

## Deweloper

Projekt rozwijany iteracyjnie przez Sebastiana Świderskigo z pomocą Claude (Anthropic).
