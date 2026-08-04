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
   *Ausnahme, bewusst entschieden 2026-08-01:* `playwright` als reine
   **devDependency** für `scripts/design-screenshot.mjs` (Design-Review-Agent).
   Begründung im Script-Header. Gilt nur für Tooling — für **Runtime**-Deps
   bleibt die Regel unverändert streng.
4. **Bei Unklarheit:** nicht raten. Abweichung/Frage im Epic-File unter
   „Abweichungen/Fragen" notieren, konservativste Interpretation wählen, weiterarbeiten.
5. **Nach jedem Epic:** `npm run build` und `npm test` müssen grün sein; kurzen
   Statusreport in der Status-Tabelle unten eintragen.
6. **Benutzer-Aktionen** (z. B. Railway-Account, API-Keys, Feed-URLs bestätigen) sind
   als solche markiert — nicht simulieren, sondern den Benutzer auffordern.
7. **Branch:** Es wird auf dem bestehenden Arbeits-Branch weiterentwickelt und nach
   jedem Epic gepusht.

## 2. Konventionen

- **Sprache:** **Englisch überall** — UI-Texte, generierter Content, Code, Kommentare, Bezeichner,
  Commits, neue Doku (umgestellt 2026-07-24, T3; Domain-Glossar `CONTEXT.en.md`).
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
| `TEST_DATABASE_URL` | nur `npm test` | — | Separate Test-Datenbank (`feedr_test`). Integrationstests machen `TRUNCATE`, laufen deshalb nie gegen `DATABASE_URL`; vitest bricht ab statt zurückzufallen. Wird beim ersten Testlauf angelegt und migriert. Siehe `docs/LOCAL_SETUP.md`. |
| `ANTHROPIC_API_KEY` | nur Job/Enrichment | — | Claude API. Web-Prozess bootet auch ohne (leer = ungesetzt); Enrichment/Cron brauchen ihn. |
| `ANTHROPIC_MODEL` | nein | `claude-haiku-4-5-20251001` | Enrichment-Modell |
| `DEEPEN_MODEL` | nein | `claude-sonnet-5` | Vertiefen (Epic 8) |
| `MAX_ENRICH_PER_RUN` | nein | `100` | Kosten-Guard pro Lauf |
| `QUALITY_THRESHOLD` | nein | `60` | Feed blendet darunter aus |
| `TOP_N` | nein | `3` | Today's Top-N |
| `NEW_DAYS` | nein | `7` | „Neu"-Fenster in Tagen |
| `OWNER_NAME` | nein | `Ich` | Autor-Anzeigename eigener Erfahrungsberichte (Epic 9) |
| `ADMIN_TOKEN` | nein | — | Aktiviert die Admin-Console (Epic 13). Ungesetzt ⇒ Admin deaktiviert. |
| `APP_PROFILE` | nein | **`local`** | Ausführungs-Profil (Epic 17/ADR 0015): `local` (manual+claude-code, nie Railway/API) oder `cloud` (railway-cron+api). **Default am 2026-08-01 von `cloud` auf `local` gekippt** (`src/lib/env.ts`, ADR 0015 ergänzt): `cloud` impliziert `executor=api`, also die **kostenpflichtige** Anthropic-API — ein ungesetztes Profil hieß vorher „gib Geld aus und nimm einen Cloud-Cron an". `cloud` funktioniert weiter, muss aber **explizit** gesetzt werden. Der Default ist per Test in `src/lib/env.test.ts` fixiert, weil alle `resolveExecutionConfig`-Tests `APP_PROFILE` explizit übergeben und ein stilles Zurückkippen sonst nicht auffiele. |
| `PIPELINE_EXECUTOR` | nein | profil-abh. | Override: `api` \| `claude-code` (Kontingent via lokales CLI). |
| `PIPELINE_TRIGGER` | nein | profil-abh. | Override: `railway-cron` \| `claude-code-cron` \| `manual`. Illegale Kombi wirft. |
| `CLUSTER_WINDOW_DAYS` | nein | `30` | Epic 15: „aktives Fenster" für Cluster-Match-Kandidaten (`last_matched_at` darin). |
| `MAX_CLUSTER_CANDIDATES` | nein | `40` | Epic 15: Kosten-/Kontext-Guard, max. Kandidaten-Cluster pro Reel-Prompt. |
| `CONF_SOME_MIN` | nein | `2` | Epic 11: ab so vielen unabhängigen Belegen (distinct Source, `is_primary=true`) ⇒ `confidence=some`. |
| `CONF_STRONG_MIN` | nein | `4` | Epic 11: ab so vielen unabhängigen Belegen ⇒ `confidence=strong`. |
| `KNOWLEDGE_CHECK_MODEL` | nein | `ANTHROPIC_MODEL` | Epic 11: Modell-Override für den Freshness-/Supersession-LLM-Pass. |

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
| 7 — Skill-Map | `epic-7-skill-map.md` | Vision | ✅ fertig (T7.1 Schema `skill_nodes`/`user_progress`/`user_progress_notes`, T7.3 `/skills`-Seite, T7.4 Adoption-Log — 42 Tests grün über `src/lib/skills/` + SkillMap/SkillRing/SkillNodeDetail). **T7.2 (Node-Aggregation) bewusst NICHT gebaut** — von Epic 12s SkillTagger ersetzt, im Epic-File als `⊘` dokumentiert. Visueller Pass separat in Epic 18 (T18.5, ein geteiltes Ring-Component). Tabellen-Status war bis 2026-08-01 fälschlich „offen" |
| 8 — Agentisches Vertiefen | `epic-8-deep-dive.md` | Vision | ☐ offen |
| 9 — Erfahrungs-Sektion | `epic-9-experience-reports.md` | Fast-Follow | ✅ fertig (kein echtes Markdown-Rendering ohne neue Dependency — siehe Abweichungen in `epic-9-experience-reports.md`) |
| 10 — Content Verifier | `epic-10-verifier.md` | Fast-Follow | ◑ Stufe 1 fertig & getestet (ADR 0011; T10.1–T10.4 — Reel-`caveat`, gated + idempotent Kritiker-Pass, in Pipeline eingehängt, ⚠️-Anzeige + Feed-/Übersicht-Filter); **T10.8 gegrillt + baubar** (ADR 0021: Überclaim-Flag für Erfahrungsberichte, Regel B only — kein Clustering nötig, daher Stufe 1); T10.6 durch ADR 0021 aufgelöst/gesplittet; Stufe 2 → in Epic 11 aufgegangen |
| 11 — Topic-Knowledge-Check (Freshness + Korroboration) | `epic-11-sota-recheck.md` | Fast-Follow | ◑ T11.1–T11.6 fertig & getestet (ADR 0012/0013); **T11.7 gegrillt + Plan** (ADR 0021: match-only, primary by construction, ein Autor = eine Stimme; Teilaufgaben T11.7a–e, baubar); T11.8 (externe Web-Korroboration, eigener ADR nötig) weiterhin zurückgestellt |
| 12 — SkillTagger | `epic-12-skill-tagger.md` | Fast-Follow (vor Epic 7) | ✅ fertig (T12.1–T12.6 alle ☒: Schema + pending-Status, Enrichment liefert nur den rohen `skill_hint`, Match-or-Propose-Kern, Runner, Trigger verdrahtet, Bestätigungs-UI unter `/skills` → `#new-skills`) — 15 Tests grün über `src/lib/skilltagger/`. Läuft über die Executor-Naht (ADR 0015). Tabellen-Status war bis 2026-08-01 fälschlich „offen" |
| 13 — Admin-Console | `epic-13-admin-console.md` | Fast-Follow | ✅ fertig (T13.1–T13.7; Cron-Button + Status + Quellen-Liste/Fehler-Retry; `ADMIN_TOKEN` in Railway = Benutzer-Aktion) |
| 14 — Quellen-Validierung & -Überprüfung | `epic-14-source-health.md` | Fast-Follow (erst grillen) | ☐ geparkt (bauen „wenn der Rest steht") |
| 15 — Topic-Clustering (Fundament) | `epic-15-topic-clustering.md` | Fast-Follow | ✅ fertig (ADR 0013; T15.1–T15.5 gebaut & getestet — siehe Abweichungen in `epic-15-topic-clustering.md`); Vorläufer für Epic 11 |
| 16 — Refactoring-Agent (nächtl. Claude-Code-Cron) | `epic-16-refactoring-agent.md` | Tooling/Vision (erst grillen) | ☐ geparkt (teilt CC-Routine-Mechanik mit Epic 17) |
| 17 — Ausführungs-Modi (Trigger × Executor) | `epic-17-execution-modes.md` | Tooling/Vision | ◑ in Umsetzung (ADR 0015): T17.1–T17.5+T17.7 fertig & getestet; T17.6 offen (Infra) |
| 18 — UX-Implementierung (Design-Pass) | `epic-18-ux-implementation.md` | Fast-Follow | ✅ fertig (ADR 0016 akzeptiert). **Phase 1 fertig**: T18.1–T18.7 ✅ (Tokens/Font; Compact restyle; ReelActions/ResurfaceCard restyle; vier ehrliche Status; ein Ring-Component + `/skills`; Reel-Detail Push-Nav + Write-up/Context-Tab inkl. `reels.writeup`, ADR 0017 Entscheidung 1; Skill-Tab inkl. „Mark as tried" durch denselben `setProgress`-Pfad). **Phase 2 teilweise fertig**: T18.9–T18.11 + T18.13 ✅ (Header-Height-Token; Bottom-Tab-Bar 7→4 + Skills-/Library-Hubs, ADR 0023; Freshness-Indikator in der App-Bar; Back-Affordance-Regel für Non-Tab-Seiten). **Phase 2 fertig**: T18.8 (Route-Boundaries loading/error/not-found), T18.12 (Shared Empty-State), T18.14 (optimistische Mutations) ✅ — Epic 18 damit abgeschlossen (Build grün; 364 Tests zum Zeitpunkt des Epic-Abschlusses, Stand 2026-08-01: **377 Tests / 60 Files**). **Entblockt 2026-08-01:** ADR 0017 Entscheidungen 2–4 sind **akzeptiert**, und **ADR 0024** legt den Mechanismus fest — Write-up wird *nutzergetriggert pro Reel* über den bestehenden `claude-code`-Executor erzeugt (Claude-Code-Kontingent, nie die kostenpflichtige API), kein Batch, kein Gating. `writeup` bleibt NULL für alles, was niemand angefordert hat — das ist jetzt der **Soll-Zustand**, keine Lücke. Baubar, noch nicht gebaut. **Guides (ADR 0018) 2026-08-01 gegrillt + akzeptiert** — Design steht, **Bau aber bewusst gesperrt** (Entscheidung 6): die Knoten halten aktuell nur 1–3 getaggte Reels, daraus lässt sich nichts synthetisieren. Damit sind 0020 (Constellation) und 0022 (SOTA-Retirement) *entscheidungsseitig* entblockt, 0022 wartet aber weiter darauf, dass Guides wirklich *laufen*. **Actionables (ADR 0019) 2026-08-01 gegrillt + akzeptiert — und im Gegensatz zu 0018 sofort baubar**: die Prämisse wurde gegen die echten Daten geprüft und hält (8 Reels mit `action`, 7 davon actionable-ready, `action`/`effortTag` rendern bereits read-only im Detail-Skill-Tab). Netto-neu ist nur eine Completion-Tabelle + eine geteilte Mutation. **Constellation (ADR 0020) 2026-08-01 gegrillt + akzeptiert**, in zwei Stufen geteilt: (a) Position-Schema + Hash-Tier rendert schon eine echte Konstellation → **sofort baubar**, (b) der Relaxations-Pass ist auf Co-Occurrence-Dichte gesperrt (aktuell **ein** Paar im gesamten Korpus). **Vorbedingung:** `skill_nodes.theme` muss auf die 8 `THEMES`-Slugs migriert werden (Entscheidung 6) — die DB enthält freitextliche Themen („Agentic Workflows", „Cost & Performance"), für die es keine Map-Region gibt. Neu: drei View-Layer, Themes = Root-Nodes (Entscheidung 8). **Weiterhin blockiert**: Knowledge-Base, Trust-Tag. **Geparkt/vorgeschlagen:** ADR 0025 (Task-Queue), ADR 0026 (wiederverwendbarer Schreib-Assistenz-Service), ADR 0027 (Node-Seeding — kollidiert mit ADR 0001) — alle drei bewusst *nicht* gebaut, jeder braucht erst einen Grill |
| 19 — Write-up on demand | `epic-19-writeup-on-demand.md` | Fast-Follow | ✅ **fertig** (ADR 0024; T19.1–T19.5, Sonnet-Subagent 2026-08-01, Review durch das starke Modell). `src/lib/writeup/` (Prompt + zod-Schema + Runner mit injiziertem Executor), `POST /api/reels/[id]/writeup` inkl. Cloud-Guard (503 wenn Executor `api`), Button im Write-up-Tab (idle → pending → done/error), Guard auf beiden Ebenen per Test fixiert. Build/Typecheck grün, **393 Tests / 64 Files**, eslint 0. Rung-1 verifiziert (Button 143×40px, `--accent`, nicht verdeckt, Overflow 0). **Offen:** ein echter Ende-zu-Ende-Lauf — die `claude`-CLI ist nicht-interaktiv nicht eingeloggt, siehe „Abweichungen" im Epic-File |
| 20 — Actionables & Evidence-Track | `epic-20-actionables.md` | Fast-Follow | 📋 **Plan fertig, delegierbar** (ADR 0019). Kein LLM-Pass nötig — `reels.action`/`effort_tag`/`skill` sind schon befüllt (8/16 bzw. 7/16) und rendern read-only im Detail-Skill-Tab. Netto-neu: `actionable_completions` (mit **Text-Snapshot**, Entscheidung 5), **eine** geteilte Mutation (§8.4), Evidence-Counts, `effort_tag`-Filter. **Unabhängig** von 19/21 |
| 21 — Constellation Stufe (a) | `epic-21-constellation-stage-a.md` | Vision | ✅ **fertig** (ADR 0020, nur Stufe a; Sonnet-Subagent 2026-08-01). T21.1–T21.5 alle ☒: Theme-Vokabular auf die 8 `THEMES`-Slugs migriert (Drizzle-Migration 0012, echter DB-CHECK-Constraint — off-vocabulary Insert verifiziert abgelehnt — `seed-dev.sql` gefixt, `THEME_LABELS` für die UI); `THEME_LAYOUT` (T21.2, 8 handplatzierte, nicht-überlappende Regionen + Exhaustiveness/Overlap-Tests); Position-Schema + `resolveNodePosition` Drei-Stufen-Auflösung (T21.3, Migration 0013); `SkillConstellation.tsx` (T21.4, rendert neben der bestehenden Listenansicht über `?view=constellation`, teilt sich den `SkillRing`); Drag-to-place Desktop/iPad-only + Reset (T21.5, `POST /api/skills/[slug]/position`). Zwei echte Bugs nur durch die Pflicht-Screenshot-Prüfung gefunden (Hash-Tier-Kollision → Sunflower-Spiral; Label-Text-Überlappung bei 375px → `assignLabelRows`), ein dritter nur durch echtes Ziehen im Live-Browser (Reset-Button war im Anchor verschachtelt, jeder Klick startete versehentlich einen neuen Drag). **424 Tests / 67 Files**, Build/Typecheck grün, eslint 0. **Relaxations-Pass, View-Layer und Root-Anlage weiterhin ausdrücklich out of scope** (nicht gebaut) |
| 22 — Constellation Rework (Hub-and-Spoke) | `epic-22-constellation-hub-and-spoke.md` | Vision | 📋 **Plan fertig** (Owner-Feedback zu Epic 21, 2026-08-03). **T22.1 ist eine ENTSCHEIDUNG, kein Code**: das Hub-and-Spoke-Modell widerspricht dem Prototyp (`.theme-ring`) und ADR 0020 Entscheidung 1, braucht also erst eine ADR-Ergänzung (Entscheidung 10). Danach: Theme-Hubs + Spokes (die `.link`-Klasse des Prototyps wird endlich genutzt — die Implementierung rendert aktuell **null** `<line>`-Elemente), Edit-Modus erreichbar machen, Label-Crowding. **Kein Drag-Bug**: das Ziehen funktioniert, aber der „Edit positions"-Knopf ist `hidden md:inline-flex` und damit unter 768px unsichtbar. **Member↔Member-Kanten bleiben out of scope** (Entscheidung 7, ein Co-Occurrence-Paar im gesamten Korpus) |
| — Vision-Backlog (optional) | `vision-backlog.md` | Vision | ☐ offen |

**MVP = Epic 0–5 (fertig).** Danach Fast-Follow: 6 (Saves), 9 (Erfahrung), 12 (SkillTagger,
vor 7). Vision: 7 (Skill-Map), 8 (Vertiefen), 10 (Verifier), 11 (SOTA-Re-Check). 7–12 nur
nach explizitem Benutzer-Go; 10 und 11 zusätzlich erst nach eigenem Grill.

### Delegations-Reihenfolge für Epics 19–21 (Stand 2026-08-01)

Alle drei Pläne sind fertig und **fachlich unabhängig** — es gibt keine Reihenfolge-Pflicht zwischen
ihnen. Praktische Empfehlung:

1. **Epic 19 zuerst** — kleinstes Paket, kein Schema-Change, und macht den sichtbarsten Platzhalter
   der App zu echtem Inhalt.
2. **Epic 20 parallel dazu möglich** — berührt andere Dateien (Skill-Tab-Action-Block + Node-Seite vs.
   Write-up-Tab). Konfliktrisiko in `ReelDetail.tsx` ist real aber klein und liegt in verschiedenen
   Tabs; bei Parallelbetrieb zuerst mergen, dann rebasen.
3. **Epic 21 zuletzt** — größtes Paket, enthält als einziges eine **Daten-Migration** (T21.1), und
   §9.9 warnt ohnehin, die Konstellation nicht vor den Guides „fertig" zu erwarten.

**Max. 2–3 gleichzeitige Subagenten** (CLAUDE.md, Design-Prozess), jeder auf eigenem Feature-Branch
`claude/epic-<N>-<kurz>`. Vor dem Abzweigen `git fetch origin main`. Review durch das starke Modell
vor jedem Merge: Build grün, Tests grün, Task-Verifikationen ausgeführt, keine ADR-Verletzung, keine
neuen Runtime-Deps, Diff auf das Epic begrenzt.

**Für alle drei bindend:** Screenshot-Verifikation ist Teil der Definition of Done, nicht optional —
in diesem Projekt haben zwei BLOCKER einen grünen Build, grünen Typecheck und 363 grüne Tests
überlebt und wurden **nur** durch das Ansehen gerenderter PNGs gefunden.

### Revidierte Annahmen (Grill-Session 2026-07-22)
Siehe `docs/specs/2026-07-22-experience-reports-design.md` → „Revidierte Annahmen". Kurz:
- **Actionable/To-Try** ist die abhakbare Fortschritts-Einheit (abgeleitet aus Reels *und*
  Erfahrungsberichten) — nicht Reels/Reports selbst. Betrifft Epic 6 („tried") und Epic 7.
- **Skill-Nodes** haben zusätzlich einen Selbst-Status („kenne ich"/„schon verprobt");
  Selbst-Deklaration und Actionable-Belege existieren nebeneinander. Betrifft Epic 7.
- **Skill-Zuordnung** kommt vom **SkillTagger (Epic 12)**, nicht aus dem Enrichment-Pass
  und nicht vom Nutzer. Epic 7 T7.2 (Node-Aggregation) wird durch Epic 12 ersetzt/erweitert
  — deshalb Epic 12 **vor** Epic 7 bauen.
