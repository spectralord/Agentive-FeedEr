# Agentive-FeedEr — Entwicklungsplan (Master)

- Datum: 2026-07-21
- Grundlage: `docs/specs/2026-07-21-agentive-feeder-design.md` + ADRs 0001–0006 + `CONTEXT.md`
- Zielgruppe dieses Plans: **ein ausführendes Modell/Entwickler**, das die Epics
  stückweise und ohne eigene Design-Entscheidungen umsetzen kann.

---

## 1. Arbeitsanweisung für das ausführende Modell (bindend)

1. **Reihenfolge einhalten:** Epics in numerischer Reihenfolge, Tasks innerhalb eines
   Epics in Reihenfolge. Ein Task gilt erst als fertig, wenn seine **Verifikation**
   erfolgreich ausgeführt wurde.
2. **Pro Task ein Commit.** Commit-Format: `feat(epic-N): TN.x <Kurzbeschreibung>`
   (bzw. `chore`/`fix` wo passend). Nach jedem Task: Checkbox im Epic-File abhaken
   und mitcommitten.
3. **Nichts erfinden.** Die ADRs sind bindend (insb. ADR 0003 „null statt
   Halluzination", ADR 0005 „Sourced-only"). Kein zusätzlicher Scope, keine
   zusätzlichen Bibliotheken außer den hier genannten, außer es ist technisch
   zwingend — dann unter „Abweichungen" im Epic-File dokumentieren.
4. **Bei Unklarheit:** nicht raten. Abweichung/Frage im Epic-File unter
   „Abweichungen/Fragen" notieren, konservativste Interpretation wählen, weiterarbeiten.
5. **Nach jedem Epic:** `npm run build` und `npm test` müssen grün sein; kurzen
   Statusreport in der Status-Tabelle unten eintragen.
6. **Benutzer-Aktionen** (z. B. Railway-Account, API-Keys, Feed-URLs bestätigen) sind
   als solche markiert — nicht simulieren, sondern den Benutzer auffordern.
7. **Branch:** Es wird auf dem bestehenden Arbeits-Branch weiterentwickelt und nach
   jedem Epic gepusht.

## 2. Konventionen

- **Sprache:** UI-Texte Deutsch. Code, Kommentare, Bezeichner, Commits Englisch.
- **Stack (fix):** Next.js (App Router, TypeScript, `src/`-Layout, Tailwind CSS),
  Drizzle ORM + `pg` (node-postgres), Postgres, Anthropic SDK (`@anthropic-ai/sdk`),
  `rss-parser`, `zod`, `tsx` (Job-Runner), `vitest` (Tests). Package-Manager: **npm**.
- **DB-Namensgebung:** snake_case-Tabellen/Spalten, Drizzle-Schema in
  `src/db/schema.ts`, Migrationen via `drizzle-kit` in `/drizzle`.
- **Fehlerbehandlung Jobs:** pro Quelle/Item try/catch — ein Fehler bricht nie den
  Gesamtlauf ab; am Ende Zusammenfassung loggen (ok/failed counts).
- **Keine Authentifizierung im MVP** (Single-User, nicht öffentlich verlinkt).

## 3. Projektstruktur (Ziel)

```
/profile.md                  # Developer-Profil (Relevanz-Kontext)
/drizzle/                    # generierte Migrationen
/src
  /app
    /page.tsx                # Feed (Epic 3)
    /today/page.tsx          # Today's Top-N (Epic 4)
    /overview/page.tsx       # Übersicht/SOTA/Verlauf (Epic 5)
    /saved/page.tsx          # Saves (Epic 6)
    /skills/page.tsx         # Skill-Map (Epic 7)
    /api/health/route.ts
    /api/interactions/route.ts        # Epic 6
    /api/reels/[id]/deepen/route.ts   # Epic 8
  /components                # ReelCard, FilterBar, Badges, ...
  /db
    /schema.ts
    /client.ts
  /lib
    /env.ts                  # zod-validierte Env-Vars
    /claude.ts               # Anthropic-Client-Wrapper
    /sources.ts              # Source-Registry (Code = Quelle der Wahrheit)
    /ingestion/              # Fetcher + Runner (Epic 1)
    /enrichment/             # Schema, Prompt, Runner (Epic 2)
    /ranking.ts              # Top-N-Score (Epic 4)
    /labels.ts               # abgeleitete Labels (Epic 5)
  /jobs
    /daily.ts                # täglicher Pipeline-Einstieg
```

## 4. Environment-Variablen (vollständige Liste)

| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `DATABASE_URL` | ja | — | Postgres-Verbindung |
| `ANTHROPIC_API_KEY` | nur Job/Enrichment | — | Claude API. Web-Prozess bootet auch ohne (leer = ungesetzt); Enrichment/Cron brauchen ihn. |
| `ANTHROPIC_MODEL` | nein | `claude-haiku-4-5-20251001` | Enrichment-Modell |
| `DEEPEN_MODEL` | nein | `claude-sonnet-5` | Vertiefen (Epic 8) |
| `MAX_ENRICH_PER_RUN` | nein | `100` | Kosten-Guard pro Lauf |
| `QUALITY_THRESHOLD` | nein | `60` | Feed blendet darunter aus |
| `TOP_N` | nein | `3` | Today's Top-N |
| `NEW_DAYS` | nein | `7` | „Neu"-Fenster in Tagen |
| `OWNER_NAME` | nein | `Ich` | Autor-Anzeigename eigener Erfahrungsberichte (Epic 9) |
| `ADMIN_TOKEN` | nein | — | Aktiviert die Admin-Console (Epic 13). Ungesetzt ⇒ Admin deaktiviert. |
| `APP_PROFILE` | nein | `cloud` | Ausführungs-Profil (Epic 17/ADR 0015): `cloud` (railway-cron+api) oder `local` (manual+claude-code, nie Railway/API). |
| `PIPELINE_EXECUTOR` | nein | profil-abh. | Override: `api` \| `claude-code` (Kontingent via lokales CLI). |
| `PIPELINE_TRIGGER` | nein | profil-abh. | Override: `railway-cron` \| `claude-code-cron` \| `manual`. Illegale Kombi wirft. |

`.env.example` führt alle Variablen; `src/lib/env.ts` validiert sie mit zod
(Defaults dort zentral, nirgendwo sonst hartkodiert).

## 5. Definition of Done (global)

Ein Epic ist fertig, wenn:
- alle Tasks abgehakt, Verifikationen gelaufen,
- `npm run build` und `npm test` grün,
- keine ADR-Verletzung (Kurz-Check gegen ADR 0001–0006),
- Status-Tabelle aktualisiert, committet und gepusht.

## 6. Epic-Übersicht & Status

| Epic | Datei | Tier | Status |
|---|---|---|---|
| 0 — Projekt-Skelett | `epic-0-skeleton.md` | MVP | ✅ fertig (Railway-Deploy = Benutzer-Aktion offen) |
| 1 — Ingestion | `epic-1-ingestion.md` | MVP | ✅ fertig (Feed-URLs außerhalb GitHubs erst im ersten Railway-/Lokal-Lauf voll verifizierbar — siehe Abweichungen) |
| 2 — Enrichment | `epic-2-enrichment.md` | MVP | ✅ fertig (Echtlauf-Stichprobe mit API-Key = Benutzer-Aktion offen) |
| 3 — Reel-Feed-UI | `epic-3-feed-ui.md` | MVP | ✅ fertig (Verifikation via `curl` gegen `npm run start` statt manuell in Safari/iPad — siehe Abweichungen) |
| 4 — Today's Top-N | `epic-4-top-n.md` | MVP | ✅ fertig (Verifikation via `curl` gegen `npm run start` statt manuell in Safari/iPad — siehe Abweichungen) |
| 5 — Übersicht/SOTA | `epic-5-overview.md` | MVP-nah | ✅ fertig (Verifikation via `curl` gegen `npm run start` statt manuell in Safari/iPad — siehe Abweichungen) |
| 6 — Saves/Feedback/Resurfacing | `epic-6-interactions.md` | Fast-Follow | ✅ fertig (siehe Abweichungen in `epic-6-interactions.md`) |
| 7 — Skill-Map | `epic-7-skill-map.md` | Vision | ☐ offen (nach Epic 12; siehe Revidierte Annahmen) |
| 8 — Agentisches Vertiefen | `epic-8-deep-dive.md` | Vision | ☐ offen |
| 9 — Erfahrungs-Sektion | `epic-9-experience-reports.md` | Fast-Follow | ✅ fertig (kein echtes Markdown-Rendering ohne neue Dependency — siehe Abweichungen in `epic-9-experience-reports.md`) |
| 10 — Content Verifier | `epic-10-verifier.md` | Fast-Follow | ✅ gegrillt (ADR 0011); Stufe-1 (Reel-`caveat`) baubar; Stufe 2 → in Epic 11 aufgegangen |
| 11 — Topic-Knowledge-Check (Freshness + Korroboration) | `epic-11-sota-recheck.md` | Fast-Follow | ✅ gegrillt + **Plan** (ADR 0012/0013; T11.1–T11.8); braucht Epic 15 |
| 12 — SkillTagger | `epic-12-skill-tagger.md` | Fast-Follow (vor Epic 7) | ☐ offen |
| 13 — Admin-Console | `epic-13-admin-console.md` | Fast-Follow | ✅ T13.1–T13.6 fertig (Cron-Button + Status; `ADMIN_TOKEN` in Railway = Benutzer-Aktion; T13.7 offen) |
| 14 — Quellen-Validierung & -Überprüfung | `epic-14-source-health.md` | Fast-Follow (erst grillen) | ☐ geparkt (bauen „wenn der Rest steht") |
| 15 — Topic-Clustering (Fundament) | `epic-15-topic-clustering.md` | Fast-Follow | ✅ gegrillt + **Plan** (ADR 0013; T15.1–T15.5); Vorläufer für Epic 11 |
| 16 — Refactoring-Agent (nächtl. Claude-Code-Cron) | `epic-16-refactoring-agent.md` | Tooling/Vision (erst grillen) | ☐ geparkt (teilt CC-Routine-Mechanik mit Epic 17) |
| 17 — Ausführungs-Modi (Trigger × Executor) | `epic-17-execution-modes.md` | Tooling/Vision | ◑ in Umsetzung (ADR 0015): T17.1–T17.4+T17.7 fertig & getestet; T17.5 teilw.; T17.6 offen (Infra) |
| — Vision-Backlog (optional) | `vision-backlog.md` | Vision | ☐ offen |

**MVP = Epic 0–5 (fertig).** Danach Fast-Follow: 6 (Saves), 9 (Erfahrung), 12 (SkillTagger,
vor 7). Vision: 7 (Skill-Map), 8 (Vertiefen), 10 (Verifier), 11 (SOTA-Re-Check). 7–12 nur
nach explizitem Benutzer-Go; 10 und 11 zusätzlich erst nach eigenem Grill.

### Revidierte Annahmen (Grill-Session 2026-07-22)
Siehe `docs/specs/2026-07-22-experience-reports-design.md` → „Revidierte Annahmen". Kurz:
- **Actionable/To-Try** ist die abhakbare Fortschritts-Einheit (abgeleitet aus Reels *und*
  Erfahrungsberichten) — nicht Reels/Reports selbst. Betrifft Epic 6 („tried") und Epic 7.
- **Skill-Nodes** haben zusätzlich einen Selbst-Status („kenne ich"/„schon verprobt");
  Selbst-Deklaration und Actionable-Belege existieren nebeneinander. Betrifft Epic 7.
- **Skill-Zuordnung** kommt vom **SkillTagger (Epic 12)**, nicht aus dem Enrichment-Pass
  und nicht vom Nutzer. Epic 7 T7.2 (Node-Aggregation) wird durch Epic 12 ersetzt/erweitert
  — deshalb Epic 12 **vor** Epic 7 bauen.
