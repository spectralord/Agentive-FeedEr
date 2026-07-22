# Epic 13 — Admin-/Operator-Console (Fast-Follow)

**Ziel:** Geschützte Admin-Sicht in der App, um Backend-Tasks manuell auszulösen
(v. a. den Cron-Task) und den Systemzustand zu sehen.

**Referenzen:** ADR 0010, `docs/specs/2026-07-22-admin-console-design.md`, ADR 0002/0006.

> **Muss** (Benutzer-Wunsch): „Pipeline jetzt ausführen"-Button end-to-end, geschützt,
> async, mit Laufstatus (T13.1–T13.5). **Bonus**, wenn Zeit: T13.6–T13.7.

---

## Tasks

### ☐ T13.1 — Env: `ADMIN_TOKEN`
- `src/lib/env.ts`: `ADMIN_TOKEN` optional (kein Default). Ungesetzt ⇒ Admin deaktiviert.
- `.env.example` ergänzen. **Verifikation:** env-Test (gesetzt/ungesetzt).

### ☐ T13.2 — Schema: `pipeline_runs`
```ts
export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger", { enum: ["manual", "cron"] }).notNull(),
  mode: text("mode", { enum: ["full", "ingestion", "enrichment"] }).notNull(),
  status: text("status", { enum: ["running", "success", "failed"] }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  summary: jsonb("summary"),
  error: text("error"),
});
```
- Migration. **Verifikation:** Migration grün.

### ☐ T13.3 — Pipeline-Refactor (`src/lib/pipeline.ts`)
- `runDailyPipeline(db, { mode }): Promise<PipelineSummary>` — kapselt
  `runIngestion` und/oder `runEnrichment` je nach `mode`; gibt strukturierte Summary zurück.
- `src/jobs/daily.ts` auf `runDailyPipeline(db,{mode:'full'})` umstellen und zusätzlich eine
  `pipeline_runs`-Zeile (`trigger:'cron'`) schreiben (running→success/failed).
- **Verifikation:** bestehende Ingestion/Enrichment-Integrationstests bleiben grün; neuer
  Test für `runDailyPipeline` (mode-Varianten mit gemocktem Enrichment-Caller).

### ☐ T13.4 — Auth-Gate (`src/lib/admin/auth.ts` + `/admin/login`)
- Token-Vergleich constant-time; httpOnly-Cookie `admin_session` = HMAC(Token) (nicht das
  Token selbst). Helper `requireAdmin()` für Seiten/Routen.
- `ADMIN_TOKEN` ungesetzt ⇒ Login zeigt „Admin deaktiviert".
- **Verifikation:** Unit-Tests: falscher Token abgelehnt, richtiger akzeptiert, Cookie-Check.

### ☐ T13.5 — Trigger-API + Admin-Seite (Kern)
- `POST /api/admin/run` (token-gated): body `{ mode }`; Guard „kein laufender Run";
  legt `running`-Zeile an, startet `runDailyPipeline` **ohne await**, schreibt am Ende
  Ergebnis; antwortet sofort `{ runId }`. Ungesetzter `ADMIN_TOKEN` ⇒ 503.
- `/admin` (geschützt, `force-dynamic`): Buttons „Voll ausführen / nur Ingestion / nur
  Enrichment" (POST an die API), Anzeige des aktuell laufenden Runs + Auto-/Manuell-Refresh.
- Nav-Eintrag „Admin".
- **Verifikation:** curl mit/ohne Token (401/503 vs. 200); ein manueller Lauf erzeugt eine
  `pipeline_runs`-Zeile und füllt (lokal) reels; Doppelklick startet keinen zweiten Lauf.

### ☐ T13.6 — Bonus: Letzte Läufe + System-Status
- Tabelle der letzten `pipeline_runs` (Status, Dauer, Ingestion-Zahlen pro Quelle,
  Enrichment-Zahlen, Fehler). Status-Kacheln: DB ok, `ANTHROPIC_API_KEY` gesetzt?, Counts
  (raw_items, reels, unenriched, enrich_errors).
- **Verifikation:** curl zeigt Läufe + Counts.

### ☐ T13.7 — Bonus: Quellen-Liste (read-only) + Fehler-Retry
- Quellen mit `enabled`/`last_polled_at`. Aktion „enrich_error zurücksetzen" (Items neu
  anreicherbar). (Quellen-Toggle schreibend = später.)
- **Verifikation:** Retry setzt `enrich_error=null`; Quelle-Liste rendert.

---

## Abschlusskriterien (Epic-DoD)
- Geschützter Admin-Bereich; „Pipeline ausführen"-Button löst den Task async aus und zeigt
  Status; Cron- und Button-Läufe teilen `runDailyPipeline` und die `pipeline_runs`-Historie;
  ungesetzter `ADMIN_TOKEN` deaktiviert den Bereich sicher. Build + Tests grün.

## Benutzer-Aktionen (Railway)
- `ADMIN_TOKEN` am Web-Service setzen (sonst Admin aus).
- `ANTHROPIC_API_KEY` am **Web-Service** verfügbar machen (Referenz auf Projekt-Shared),
  da der Button die Pipeline im Web-Container ausführt.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
