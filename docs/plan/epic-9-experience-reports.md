# Epic 9 — Erfahrungs-Sektion (Fast-Follow)

**Ziel:** Ein eigener Bereich für subjektive Erfahrungsberichte (Company-Wissen), getrennt
vom verifizierten Reel-Feed. MVP: eigene/Firmen-Berichte erfassen, anzeigen, filtern,
als veraltet markieren. **Ohne** Skill-Tagging (Epic 12), Scraping, Actionables.

**Referenzen:** ADR 0007 (eigener Inhaltstyp), ADR 0008 (dauerhafte Schicht),
`docs/specs/2026-07-22-experience-reports-design.md` (Thema 1), Glossar: Experience Report,
author_type, outdated/superseded.

---

## Tasks

### ☑ T9.1 — Schema: `experience_reports`
```ts
export const experienceReports = pgTable("experience_reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),                              // Markdown
  authorType: text("author_type", { enum: ["own", "curated", "colleague"] }).notNull(),
  authorLabel: text("author_label").notNull(),
  important: boolean("important").notNull().default(false),  // "⭐ wichtig" (Selbst-Hervorhebung)
  relevanceScore: integer("relevance_score"),               // nur curated; MVP immer null
  skill: text("skill"),                                      // vom SkillTagger (Epic 12); MVP null
  lifecycleState: text("lifecycle_state", { enum: ["active", "deprecated", "archived"] })
    .notNull().default("active"),                            // ADR 0008; kein Auto-Delete
  lifecycleReason: text("lifecycle_reason"),                 // Grund bei deprecated/archived
  supersededByReportId: integer("superseded_by_report_id"),
  sourceUrl: text("source_url"),                            // nur curated
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- Migration generieren + ausführen. **Verifikation:** Migration grün.

### ☑ T9.2 — Konfiguration `author_label` für eigene Berichte
- Der Anzeigename für `own`-Berichte kommt aus einer Konfiguration (Env `OWNER_NAME`,
  Default z. B. „Ich"). In `src/lib/env.ts` ergänzen (optional, mit Default).
- **Verifikation:** Unit-Test env-Default.

### ☐ T9.3 — Datenzugriff (`src/lib/experienceReports.ts`)
- `listReports(opts: { authorType?; states?; limit? })` → chronologisch neueste zuerst;
  Default zeigt nur `lifecycle_state = active` (deprecated/archived standardmäßig raus,
  aber abrufbar über `states`).
- `getReport(id)`, `createReport(input)`, `updateReport(id, input)`,
  `setLifecycleState(id, state, { reason?, supersededByReportId? })` (active↔deprecated↔archived).
  Hartes `deleteReport(id)` existiert als seltener manueller Notausgang, ist aber **nicht**
  der Normalweg (ADR 0008).
- **Verifikation:** Integrationstests gegen lokale DB (eigene Seed-Daten): Anlegen, Filter
  nach `author_type`, `setLifecycleState('deprecated')` blendet aus der Default-Liste aus,
  bleibt aber über `states` abrufbar; Update setzt `updated_at`.

### ☐ T9.4 — Seite `/experience` (Liste)
- Neue Route + Nav-Eintrag „Erfahrung" (nach „Übersicht").
- Kompakte, chronologische Liste (kein Snap): Titel, `author_label`, relatives Datum
  (`formatRelativeTime` aus Epic 3 wiederverwenden), gerendertes Markdown (nur wenn eine
  Markdown-Lib ohne neue Dependency nutzbar ist — sonst als Vorformatierung; siehe T9.7),
  `⭐`-Marker wenn `important`, `⚠️ veraltet`-Badge (+ Grund/Link) wenn `deprecated`.
- Filterleiste (URL-searchParams, Muster von `OverviewFilterBar`): `author_type`
  (alle/own/curated), Checkbox „veraltete (deprecated) zeigen", Checkbox „archivierte zeigen".
- `export const dynamic = "force-dynamic"` (DB pro Request; im Build prüfen: `ƒ`).
- **Verifikation:** curl gegen `npm run start` nach Seed; Filterkombinationen geprüft.

### ☐ T9.5 — Bericht erfassen/bearbeiten (`/experience/new`, `/experience/[id]/edit`)
- Einfaches Formular (Server Action oder Route-Handler): Titel, Markdown-Body, Checkbox
  „⭐ wichtig". `author_type` = `own`, `author_label` aus Konfiguration (T9.2).
- Nach Speichern Redirect auf die Liste; optimistisch, kein Skill-Tagging im MVP.
- **Verifikation:** Anlegen + Bearbeiten end-to-end (curl POST oder Playwright falls
  vorhanden); neuer Eintrag erscheint in der Liste.

### ☐ T9.6 — Lifecycle-Aktionen (deprecate / archive / reaktivieren)
- Auf der Detail-/Listenansicht: `setLifecycleState` nach `deprecated` (mit optionalem
  Grund + optionalem `superseded_by_report_id`) bzw. `archived`, und zurück nach `active`.
  Getrennt vom harten Löschen (seltener Notausgang, ADR 0008).
- **Verifikation:** deprecated → verschwindet aus Default-Liste, erscheint mit „veraltete
  zeigen" (Grund/Link sichtbar); archived → nur mit „archivierte zeigen"; Reaktivieren
  bringt zurück in die Default-Liste.

### ☐ T9.7 — Markdown-Rendering (ohne neue Dependency, wenn möglich)
- Prüfen, ob eine bereits vorhandene Lib Markdown rendert. Falls **keine** ohne neue
  Abhängigkeit verfügbar: MVP zeigt den Body als sicher escapte, `whitespace-pre-wrap`
  Vorformatierung und dokumentiert das als Abweichung (echtes Markdown = Folge-Task).
  **Kein** ungesichertes `dangerouslySetInnerHTML` mit ungetrustetem Input.
- **Verifikation:** XSS-Sanity (ein `<script>` im Body wird nicht ausgeführt/gerendert).

---

## Abschlusskriterien (Epic-DoD)
- Eigene Berichte anlegen/bearbeiten/als-veraltet-markieren; Liste filterbar nach
  `author_type`; veraltete standardmäßig ausgeblendet, nie auto-gelöscht.
- Klar als eigener, vom Reel-Feed getrennter Bereich erkennbar (ADR 0007).
- Build + Tests grün; keine neue Dependency ohne Dokumentation.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_

- **T9.1 — Umgebung:** Die lokale Postgres-Instanz war zu Beginn dieser Session gestoppt
  und die Datenbank `agentive_feeder` existierte nicht (leerer Container-Neustart). Zusätzlich
  erlaubte `pg_hba.conf` für TCP/`localhost`-Verbindungen nur `scram-sha-256`, während
  `.env` einen passwortlosen `DATABASE_URL` (`postgres://postgres@localhost:5432/...`)
  vorgibt. Behoben durch: `service postgresql start`, `createdb agentive_feeder` sowie
  Ändern der beiden `host ... 127.0.0.1/32` / `::1/128`-Zeilen in `pg_hba.conf` von
  `scram-sha-256` auf `trust` + `service postgresql reload`. Reine Infra-Anpassung, keine
  Projektdatei geändert; danach lief `npm run db:migrate` grün.
