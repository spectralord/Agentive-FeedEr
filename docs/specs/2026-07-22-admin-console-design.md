# Admin-/Operator-Console — Design (Self-Grill)

- Datum: 2026-07-22
- Status: zur Review / Grundlage von Epic 13
- Verwandt: ADR 0010, `docs/plan/epic-13-admin-console.md`
- Kontext: Der Benutzer wünscht eine Admin-Sicht, um u. a. den Cron-Task per Knopf
  auszuführen, plus „andere Funktionen, die dort Sinn machen". Diese Session wurde
  autonom (Benutzer schläft) durchgeführt — Entscheidungen sind hier als Self-Grill
  dokumentiert, damit sie morgen nachvollziehbar/veto-bar sind.

---

## Self-Grill (Frage → Antwort, mit Alternativen)

**F1 — Wie führt ein Web-Button den Cron-Task aus, der minutenlang laufen kann?**
- (A) Synchron in der API-Route, bis fertig → Button „hängt" Minuten, Proxy-/Browser-Timeout-Risiko. Verworfen.
- (B) **Asynchron starten, sofort antworten**, Status über eine `pipeline_runs`-Tabelle verfolgen; Admin-Seite zeigt Laufstatus. **Gewählt.** Robuster, kein hängender Request, Historie inklusive.
- Konsequenz: `pipeline_runs`-Tabelle + „nur ein Lauf gleichzeitig"-Guard (verhindert Doppel-/Überlappungsläufe von Button und Cron).

**F2 — Wird Logik dupliziert (Cron vs. Button)?**
- Nein. Der Kern (`runIngestion` + `runEnrichment`) wird in **eine wiederverwendbare
  Funktion `runDailyPipeline()`** (`src/lib/pipeline.ts`) extrahiert. Sowohl
  `src/jobs/daily.ts` (Cron) als auch die Admin-API rufen dieselbe Funktion. Kein
  zweiter Pfad, keine Divergenz.

**F3 — Sicherheit: Die App ist öffentlich (railway.app-URL). Ein offener „Run"-Button
kann echte Anthropic-Kosten verursachen (LLM-Calls).**
- Das ist ein echtes Risiko. Der Admin-Bereich **muss** geschützt sein.
- (A) Volles Auth-System → Overkill fürs Single-User-MVP.
- (B) **Shared-Secret über `ADMIN_TOKEN`-Env** → Login-Formular setzt httpOnly-Cookie;
  Admin-Seiten + Trigger-API prüfen es. **Gewählt.** Passt zur bereits geplanten
  Team-Feed-Vision (V4, Stufe 1: Shared-Secret).
- **Safe default:** Ist `ADMIN_TOKEN` **nicht gesetzt**, ist der Admin-Bereich
  **deaktiviert** (Seite zeigt Hinweis, Trigger-API antwortet 503). Kein
  ungeschützter Trigger auf einer öffentlichen URL.

**F4 — Welche Funktionen gehören außer „Run" in die Admin-Sicht?**
Ausgewählt nach Nutzen/Aufwand (Operator-Bedürfnisse eines Single-User-News-Tools):
- **Pipeline jetzt ausführen** (voll / nur Ingestion / nur Enrichment) — Kernwunsch.
- **Letzte Läufe** (`pipeline_runs`): Status, Dauer, Ingestion-Zahlen pro Quelle,
  Enrichment-Zahlen, Fehler. Genau die Sicht, die zeigt „welche Quelle 403t".
- **System-Status**: DB erreichbar? `ANTHROPIC_API_KEY` gesetzt? Counts (raw_items,
  reels, unenriched, enrich_errors).
- **Quellen-Übersicht**: Liste mit `enabled`, `last_polled_at`; Toggle enable/disable.
- **Fehler-Items erneut versuchen**: `enrich_error` zurücksetzen, damit der nächste
  Lauf sie neu anreichert.
- Später (wenn die Epics existieren): Buttons für SkillTagger (Epic 12),
  SOTA-Re-Check (Epic 11), Verifier (Epic 10) — dieselbe „named task"-Mechanik.

**F5 — MVP-Schnitt für heute Nacht?**
- **Muss (vom Benutzer verlangt):** „Pipeline jetzt ausführen"-Button end-to-end,
  geschützt, async, mit Laufstatus.
- **Wenn Zeit (Bonus):** Letzte-Läufe-Liste, System-Status/Counts, Quellen-Liste.
- **Nur geplant (nicht heute):** Quellen-Toggle schreibend, Fehler-Retry, Task-Buttons
  für spätere Epics.

---

## Datenmodell

`pipeline_runs`:
- `id`, `trigger` (`manual` | `cron`), `mode` (`full` | `ingestion` | `enrichment`),
  `status` (`running` | `success` | `failed`), `started_at`, `finished_at` (nullable),
  `summary` JSONB (per-source ingestion + enrichment counts), `error` (nullable).
- „Ein Lauf gleichzeitig"-Guard: neuer Lauf nur, wenn kein `status='running'` existiert
  (bzw. keiner jünger als ein Stale-Timeout).

## Task-Ausführung
- `runDailyPipeline(db, { mode })` in `src/lib/pipeline.ts` — von Cron und Admin genutzt.
- Admin-API `POST /api/admin/run` (token-gated): legt `pipeline_runs`-Zeile (`running`)
  an, startet `runDailyPipeline` **ohne await** (fire-and-forget im Always-on-Container,
  ADR 0006), schreibt am Ende `success`/`failed` + `summary`. Gibt sofort die Run-ID zurück.
- `src/jobs/daily.ts` schreibt ebenfalls eine `pipeline_runs`-Zeile (`trigger='cron'`),
  damit Cron-Läufe in der Admin-Historie auftauchen.

## Auth (Shared-Secret)
- Env `ADMIN_TOKEN` (optional). Ungesetzt ⇒ Admin deaktiviert (503/Hinweis).
- `/admin/login`: Formular nimmt Token, vergleicht (constant-time) mit `ADMIN_TOKEN`,
  setzt httpOnly-Cookie `admin_session` (Wert = Hash/HMAC des Tokens, nicht das Token selbst).
- Alle `/admin/*`-Seiten + `/api/admin/*`-Routen prüfen das Cookie. Kein Cookie ⇒ Redirect
  auf Login bzw. 401.

## UI
- `/admin` (geschützt): Status-Kacheln (DB, Key, Counts) · „Pipeline ausführen"-Buttons
  (voll/ingestion/enrichment) mit Live-Laufanzeige · Tabelle „Letzte Läufe".
- Nav-Eintrag „Admin" nur dezent (rechts). `force-dynamic`.

## Betrieb / Benutzer-Aktionen
- **`ADMIN_TOKEN` in Railway setzen** (Web-Service), sonst ist Admin aus.
- Der Web-Service braucht **`ANTHROPIC_API_KEY`** (für den Run-Button), da die Pipeline
  dort ausgeführt wird — als Referenz auf die Projekt-Shared-Variable ergänzen.

## Offene Punkte
- Echte Job-Logs (stdout) in der Admin-UI zeigen wäre schön, ist aber ohne Log-Sammler
  aufwändig — MVP zeigt die strukturierte `summary` statt roher Logs.
- Stale-Run-Erkennung (Container-Neustart mitten im Lauf) — simple Zeitgrenze im MVP.
