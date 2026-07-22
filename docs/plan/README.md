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
| `ANTHROPIC_API_KEY` | ja | — | Claude API |
| `ANTHROPIC_MODEL` | nein | `claude-haiku-4-5-20251001` | Enrichment-Modell |
| `DEEPEN_MODEL` | nein | `claude-sonnet-5` | Vertiefen (Epic 8) |
| `MAX_ENRICH_PER_RUN` | nein | `100` | Kosten-Guard pro Lauf |
| `QUALITY_THRESHOLD` | nein | `60` | Feed blendet darunter aus |
| `TOP_N` | nein | `3` | Today's Top-N |
| `NEW_DAYS` | nein | `7` | „Neu"-Fenster in Tagen |

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
| 3 — Reel-Feed-UI | `epic-3-feed-ui.md` | MVP | ☐ offen |
| 4 — Today's Top-N | `epic-4-top-n.md` | MVP | ☐ offen |
| 5 — Übersicht/SOTA | `epic-5-overview.md` | MVP-nah | ☐ offen |
| 6 — Saves/Feedback/Resurfacing | `epic-6-interactions.md` | Fast-Follow | ☐ offen |
| 7 — Skill-Map | `epic-7-skill-map.md` | Vision | ☐ offen |
| 8 — Agentisches Vertiefen | `epic-8-deep-dive.md` | Vision | ☐ offen |
| 9 — Vision-Backlog (optional) | `vision-backlog.md` | Vision | ☐ offen |

**MVP = Epic 0–4.** Epic 5 direkt danach (fast geschenkt). 6 nach erster
Nutzungserfahrung. 7–9 nur nach explizitem Benutzer-Go.
