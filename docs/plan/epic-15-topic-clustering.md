# Epic 15 — Topic-Clustering (Fundament)

> **Status: DESIGN GEGRILLT (2026-07-23), Umsetzung offen.** Vorläufer-Fundament,
> hochgezogen aus Vision-Backlog V1 (Content-Modell C), weil der Topic-Knowledge-Check
> (Epic 11) und die Content-Bündelung darauf aufsetzen.

**Ziel:** Reels (und später Erfahrungsberichte), die **dasselbe spezifische Thema**
behandeln, zu **Topic-Clustern** gruppieren — die Grundlage für Content-Bündelung
(Content-Modell C) sowie `confidence` und `freshness` (Epic 11).

**Referenzen:** ADR 0013 (Kern — Clustering-Design), ADR 0009 (Match-or-Propose,
Muster-Vorlage), ADR 0012 (Topic-Knowledge-Check baut darauf), ADR 0008 (Schichten),
ADR 0004 (abgeleitete Ansichten). Content-Modell C (Design-Doc 2026-07-21),
Vision-Backlog V1. Glossar: Topic-Cluster.

## Motivation
- Das reservierte Feld `reels.topic_cluster_id` existiert seit Epic 2, wird aber nicht genutzt.
- Feed wirkt bei mehreren Quellen zum selben Thema repetitiv (ursprüngliche Grill-Sorge C).
- Korroboration/Freshness (Epic 11) brauchen „mehrere Quellen zu einem Claim" — das *ist* ein Cluster.

---

## Gegrillte Entscheidungen (2026-07-23)

1. **Cluster-Bildung = Match-or-Propose gegen *aktive* Cluster** (Muster wie SkillTagger,
   ADR 0009): Jedes neue Reel sucht in einem Zeitfenster den nächstliegenden bestehenden
   Cluster (**Match**) oder schlägt einen neuen vor (**Propose**). Stabil über die Zeit,
   kein Neu-Würfeln pro Lauf, LLM-Kontext bleibt beschränkt. Embeddings sind spätere
   Skalierungs-Naht, **kein MVP**.

2. **Granularität = eng / feature- bzw. meldungs-spezifisch.** Ein Cluster bündelt Inhalte
   zu *einem konkreten Ding und seiner Verwendung* (Beispiel des Benutzers: „der Batch-Command
   & seine Nutzung"), **nicht** auf generischer Skill-Ebene. Das hält die Korroborations-Zahl
   ehrlich (mehrere unabhängige Quellen zum *selben spezifischen* Claim).

3. **Breite thematische Ebene = die Skill-Node (Epic 12), kein eigener Cluster-Typ.**
   Ein Reel hat (a) einen **engen Topic-Cluster** (Epic 15) *und* (b) hängt an einer/mehreren
   **Skill-Nodes** (Epic 12, via SkillTagger). Das sind die zwei „Peer-Mengen": **eng** für
   Korroboration/Freshness, **breit** für die thematische Wissens-/Browsing-Sicht. Epic 15
   baut daher **nur den einen engen Cluster-Typ**; keine zweistufige Cluster-Hierarchie.
   (Beispiel: enger Cluster „Batch-Command", Skill-Node „Parallelisierung".)

4. **Unabhängigkeit von Quellen = `is_primary`-Signal pro Cluster-Mitglied, bewusst grob.**
   Für die spätere Korroboration zählt nicht die reine Zahl der Cluster-Mitglieder, sondern
   die **unabhängigen** darunter. Epic 15 hält pro Reel im Cluster ein einfaches
   `is_primary` fest: **first-hand/eigenständig** (offizielle Primärquelle, eigener Test,
   Erfahrungsbericht) ⇒ `true`; erkennbare **Wiedergabe/Reblog** eines anderen
   Cluster-Mitglieds (verlinkt es / gibt es ohne eigene Beobachtung wieder) ⇒ `false`.
   Die eigentliche `confidence` rechnet **Epic 11** daraus — als **grobe Skala
   (few/some/strong)**, damit Fehlklassifikationen beim Echo-Erkennen kaum wehtun.

### MVP-Schnitt (was Epic 15 selbst baut vs. Epic 11)
- **Epic 15 (dieses Epic):** Schema (`topic_clusters` + `reels.is_primary` + Aktivierung
  `topic_cluster_id`), Match-or-Propose-Pass inkl. `is_primary`-Urteil, Pipeline-Einhängung,
  Feed-Bündelung als Stapelkarte („N Quellen zu diesem Thema").
- **Epic 11 (danach):** `confidence` (few/some/strong aus `is_primary`), `freshness`/
  Supersession, Propagation auf referenzierende Items, entsprechende Anzeige.

---

## Tasks

### ☐ T15.1 — Schema: `topic_clusters` + `reels.is_primary` + `topic_cluster_id` aktivieren
```ts
export const topicClusters = pgTable("topic_clusters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),                 // kurzer, spezifischer Cluster-Titel (LLM-vergeben)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastMatchedAt: timestamp("last_matched_at", { withTimezone: true })
    .notNull().defaultNow(),                       // für das „aktive Fenster" der Match-Kandidaten
});
```
- `reels`: bestehendes `topicClusterId` per FK an `topic_clusters(id)` binden (bleibt nullable)
  und neues Feld `isPrimary boolean` (nullable — gesetzt vom Clustering-Pass; `null` = noch
  nicht geclustert).
- Migration via `drizzle-kit`. **Verifikation:** Migration grün; neue Felder default `null`
  bzw. `lastMatchedAt` default now; FK vorhanden.

### ☐ T15.2 — Cluster-Zuordnung (`src/lib/clustering/run.ts`): Match-or-Propose
- Eigenes Modul mit **injizierbarem `StructuredCaller`** (Muster wie Enrichment/SkillTagger),
  Modell konfigurierbar (Default Haiku, `ANTHROPIC_MODEL`).
- **Kandidaten:** aktive Cluster mit `lastMatchedAt` innerhalb `CLUSTER_WINDOW_DAYS`,
  auf `MAX_CLUSTER_CANDIDATES` begrenzt (Titel als Kontext).
- **Input je Reel:** Titel + Summary + `source`-Name des neuen Reels **+** Kandidaten-Cluster
  (id + Titel) **+** knappe Info zu bereits im Cluster hängenden Quellen (für `is_primary`).
- **Output (JSON-Schema, zod-validiert):**
  ```ts
  { matchClusterId: number | null, newClusterTitle: string | null, isPrimary: boolean }
  ```
  Genau eins von `matchClusterId` / `newClusterTitle` ist gesetzt (Match **oder** Propose,
  ADR 0009). `isPrimary`: eigenständige/first-hand Aussage vs. Wiedergabe eines
  Cluster-Mitglieds.
- **Semantik:** bei Match → Reel an bestehenden Cluster hängen, dessen `lastMatchedAt`
  auf now setzen. Bei Propose → neuen Cluster anlegen, Reel zuordnen, `isPrimary` i. d. R.
  `true` (erstes Mitglied ist per Definition Primär).
- **Gated:** nur Reels verarbeiten, die angezeigt werden (`quality_score ≥ QUALITY_THRESHOLD`
  bzw. relevanz-relevant) und noch **kein** `topic_cluster_id` haben. Idempotent.
- **Nichts erfinden** (ADR 0003): im Zweifel neuen Cluster proposen statt fälschlich matchen;
  `isPrimary` im Zweifel `true` (konservativ — lieber eigenständig zählen als Echo verstecken).
- **Verifikation:** Unit-Tests mit gemocktem Caller: (a) Reel passt zu bestehendem Cluster
  → zugeordnet; (b) neues Thema → neuer Cluster; (c) Reblog eines Mitglieds → `isPrimary=false`.

### ☐ T15.3 — In die Pipeline einhängen
- Als **eigener Schritt nach dem Enrichment** (und nach dem SkillTagger, sobald Epic 12 steht)
  in `src/lib/pipeline.ts` (`runPipelinePhases`), sodass Cron **und** Admin-Button ihn
  mitlaufen lassen. Clustering-Fehler brechen den Lauf **nicht** ab (try/catch pro Reel,
  Zusammenfassung loggen). Idempotent („nur Reels ohne `topic_cluster_id`").
- **Verifikation:** Integrationstest: neue Reels → nach Lauf `topic_cluster_id` + `isPrimary`
  gesetzt; zweiter Lauf verarbeitet 0.

### ☐ T15.4 — Feed: Bündelung als Stapelkarte
- Feed-Query gruppiert anzeigbare Reels nach `topic_cluster_id`. Cluster mit **≥ 2** Reels
  erscheinen als **eine Stapelkarte**: Titel des Clusters, „N Quellen zu diesem Thema",
  oben das **Primär**-Reel (`isPrimary=true`, sonst neuestes), die übrigen aufklappbar.
  Reels ohne Cluster (oder Solo-Cluster) erscheinen wie bisher als Einzelkarte.
- Additiv zu bestehenden Feed-Mechaniken (Hide/Scores/`caveat`): eine ausgeblendete
  (`hide`) Quelle zählt nicht zum Stapel; leert sich ein Stapel auf 1, wird es wieder Einzelkarte.
- **Verifikation:** curl gegen `npm run start` — Cluster mit N Reels zeigt Stapelkarte mit
  „N Quellen"; Aufklappen zeigt Mitglieder; Primär oben; Solo-Reels unverändert.

### ☐ T15.5 — Cluster-Anzeige-Feinschliff (klein)
- Stapelkarte zeigt die **Quellen-Namen** der Mitglieder (Transparenz, welche Quellen).
  **Kein** `confidence`-Badge hier — few/some/strong kommt in Epic 11; Epic 15 zeigt nur die
  rohe Quellenzahl + Namen.
- **Verifikation:** curl — Quellen-Namen sichtbar, keine confidence-Semantik vorgezogen.

---

## Konfiguration (neue Env-Vars, in `env.ts` + `.env.example` + README §4)
| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `CLUSTER_WINDOW_DAYS` | nein | `30` | „Aktives Fenster": nur Cluster mit `last_matched_at` darin sind Match-Kandidaten |
| `MAX_CLUSTER_CANDIDATES` | nein | `40` | Kosten-/Kontext-Guard: max. Kandidaten-Cluster pro Reel-Prompt |

(Modell = `ANTHROPIC_MODEL`, Default Haiku — kein eigener Key nötig.)

## Abschlusskriterien (Epic-DoD)
- Reels bekommen im Pipeline-Lauf `topic_cluster_id` + `isPrimary` (oder bleiben `null`,
  wenn nicht anzeigbar); Match-or-Propose gated + idempotent; Feed zeigt Stapelkarten
  („N Quellen"); keine `confidence`-Semantik vorgezogen; `npm run build` + `npm test` grün;
  keine neuen Libs; keine ADR-Verletzung.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
