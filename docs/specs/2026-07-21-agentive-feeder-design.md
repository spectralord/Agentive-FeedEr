# Agentive-FeedEr — Architektur-Design & Epics

- Datum: 2026-07-21
- Status: zur Review / Grundlage der Umsetzung
- Verwandte Docs: `CONTEXT.md` (Glossar), `docs/adr/0001`–`0006`

---

## 1. Zweck & Vision

Ein persönliches Web-Tool, das dich mit minimalem Aufwand auf hohem Signal-Niveau bei
KI-Themen — Fokus **neue Claude-Features** und **agentische KI-Nutzung in der
Entwicklung** — auf dem Laufenden hält, und zwar so, dass du das Gelernte **tatsächlich
anwendest**.

Der Wert liegt nicht im Aggregieren (das kann jeder), sondern in drei Dingen:

1. **Rauschunterdrückung** — Substanz statt Hype, relevant *für dich*.
2. **Handlungsbezug** — jedes Reel beantwortet „Was heißt das für mich?".
3. **Behalten & Anwenden** — vom Konsum zur Adoption (Skill-Map).

Nicht kommerziell, primär Single-User; evtl. später intern mit Kollegen geteilt.

## 2. Leitprinzipien (aus den ADRs)

- **Kuratierte Quellen** statt offenem Web (ADR 0001).
- **Ingestion und Enrichment entkoppelt** — Kosten kontrollierbar, Rohdaten bleiben
  (ADR 0002).
- **Ein strukturierter LLM-Pass** pro Item, `null` statt Halluzination (ADR 0003).
- **Labels sind abgeleitete Ansichten**, nicht gestempelt; `experimentell` ist ein Flag
  (ADR 0004).
- **Nur belegte Beispiele/Handlungen** (ADR 0005).
- **All-in-one-Container** (Railway), gleiche Codebasis lokal & Cloud (ADR 0006).

## 3. Tech-Stack

| Schicht | Wahl |
|---|---|
| App (Frontend + Backend) | **Next.js (React, TypeScript)**, mobil-first |
| Datenbank | **Postgres** (managed, Free-Tier z. B. Neon), **JSONB** für flexible Metadaten |
| ORM / Migrations | **Drizzle** |
| KI | **Claude API via Anthropic SDK**; Default-Modell **Haiku** für Enrichment (leichte Aufgabe, günstig), Opus nur bei Bedarf |
| Scheduler | Täglicher Cron-Job im Container |
| Hosting | **Railway** (App + Cron + Postgres), lokal via Container als Übergang |

## 4. Systemüberblick (Datenfluss)

```
                (täglich, Cron)
  Sources  ──►  Ingestion  ──►  Raw Items (roh gespeichert, dedupliziert)
 (Registry)                          │
                                     │  nur neue Items
                                     ▼
                              Enrichment (1 LLM-Pass, JSON-Schema)
                              + Developer-Profil als Kontext
                                     │
                                     ▼
                                   Reels  ──►  Feed-UI (vertikal, gefiltert)
                                     │            Today's Top-N (abgeleitet)
                                     │            Übersicht/SOTA/Verlauf (abgeleitet)
                                     │
                                     └──►  (Fast-Follow) Saves / Feedback / Resurfacing
                                     └──►  (Vision) Skill-Map, Vertiefen
```

## 5. Datenmodell (Startpunkt, bewusst erweiterbar)

Kern-Entitäten. Attribut-Set ist über `metadata JSONB` migrationsfrei erweiterbar.

- **source**: `id`, `name`, `type` (rss | api | newsletter | …), `url`/Config, `enabled`,
  `last_polled_at`.
- **raw_item**: `id`, `source_id`, `external_id` (für Dedup), `title`, `raw_content`,
  `url`, `published_at`, `ingested_at`, `enriched_at` (nullable → „noch nicht angereichert").
- **reel**: `id`, `raw_item_id`, `summary`, `example` (nullable), `action` (nullable),
  `effort_tag` (nullable), `category`, `maturity`, `experimentell` (bool),
  `relevance_score`, `quality_score`, `skill` (nullable, → skill_node),
  `topic_cluster_id` (nullable, für spätere Bündelung), `metadata JSONB`.
- **skill_node** *(Vision)*: `id`, `name`, `theme/cluster`, Beschreibung.
- **user_progress** *(Vision)*: `skill_node_id`, `status` (gesehen | ausprobiert |
  gemeistert), `note`, `updated_at`.
- **interaction** *(Fast-Follow)*: `id`, `reel_id`, `type` (save | hide | up | down),
  `created_at`.

**Labels** (Neu/SOTA/Best Practice) sind **keine** Spalten — sie sind Abfragen über obige
Fakten (ADR 0004). `topic_cluster_id` existiert im MVP-Schema, wird aber erst mit dem
Content-Clustering (Vision) aktiv genutzt.

## 6. Enrichment-Vertrag (ein LLM-Pass)

**Input:** ein Raw Item + das Developer-Profil (als Kontext).
**Output:** ein JSON-Objekt nach striktem Schema mit u. a.:
`summary`, `category`, `maturity`, `experimentell`, `relevance_score`, `quality_score`,
`example|null`, `action|null`, `effort_tag|null`, `skill|null`.

Regeln:
- `example` und `action` nur, wenn in der Quelle belegt — sonst `null` (ADR 0005).
- `quality_score` bewertet Substanz vs. Hype; niedrig ⇒ im Standard-Feed ausgeblendet,
  nie gelöscht.
- `relevance_score` bewertet gegen das Developer-Profil.

## 7. Developer-Profil

Eine handgepflegte Datei (z. B. `profile.md` / DB-Eintrag) mit Stack, Tools,
Senioritätslevel, Interessen, „was mich nervt". Geht als Kontext in jeden Enrichment-Pass.
Kein ML, kein Tracking. Später (Fast-Follow) ergänzt eine rollierende Zusammenfassung der
Interaktionen (save/hide/👍👎) diesen Kontext.

## 8. UI-Ansichten

- **Feed** — vertikaler Scroll-Snap, mobil-first, neueste zuerst, Quell-Link je Reel,
  Filter (z. B. „nur neu", „nur Claude-Features"), Toggle „schwaches Signal zeigen".
- **Today's Top-N** — abgeleitete Ansicht, Default 3, Ranking `relevance × quality ×
  recency`.
- **Übersicht / SOTA / Verlauf** — abgeleitete Ansicht mit Filtern nach Datum/Alter/
  Relevanz; „was ist aktuell State of the Art".
- **Saves/Interests** *(Fast-Follow)*.
- **Skill-Map** *(Vision)* — Kompetenz-Knoten in Themen-Cluster, Fortschritt je Knoten,
  Selbst-Bestätigung + Adoption-Log.

## 9. Kosten

- Scraping/Polling: praktisch kostenlos (etwas Netzwerk + minimal CPU).
- Hosting: Railway Hobby-Tier (~5 $/Monat), dominiert die Kosten.
- LLM: nur neue Items, Haiku, Batch ⇒ Cent-Beträge pro Tag.

---

## 10. Epics (integrative, stückweise umsetzbar)

Jedes Epic ist eigenständig lauffähig/testbar. Reihenfolge = Baureihenfolge.
**MVP = Epic 0–4** (Epic 5 optional früh, da fast geschenkt).

### Epic 0 — Projekt-Skelett *(MVP)*
Next.js (TS) + Drizzle + Postgres + Anthropic SDK aufsetzen; Container/Railway-Config,
lokale Dev-Umgebung, `.env`-Handling, DB-Migration-Setup, „Hello Feed"-Seite.
*Fertig, wenn:* App lokal und deploybar läuft, DB verbunden, leere Feed-Seite rendert.

### Epic 1 — Ingestion *(MVP)*
Source-Registry (deklarative Quellenliste), täglicher Cron, Feed-/API-Abruf, Dedup über
`external_id`, Speichern als `raw_item`. Startset ~8–10 Quellen.
*Fertig, wenn:* Ein Cron-Lauf füllt `raw_item` idempotent (keine Duplikate bei erneutem Lauf).

### Epic 2 — Enrichment *(MVP)*
Ein-Pass-LLM-Anreicherung mit JSON-Schema (ADR 0003), Developer-Profil als Kontext,
Sourced-only (ADR 0005), `null`-Handling, nur nicht-angereicherte Items. Schreibt `reel`.
*Fertig, wenn:* Neue Raw Items werden zu validierten Reels; belegte Felder gefüllt, sonst `null`.

### Epic 3 — Reel-Feed-UI *(MVP)*
Vertikaler Scroll-Snap-Feed, mobil-first, Reel-Karte (Summary, Attribute-Badges,
Beispiel/Action falls vorhanden, Quell-Link), Basis-Filter, „schwaches Signal"-Toggle.
*Fertig, wenn:* Reels lassen sich am iPad flüssig vertikal durchscrollen und filtern.

### Epic 4 — Today's Top-N *(MVP)*
Abgeleitete Ansicht der N wichtigsten Reels des Tages (`relevance × quality × recency`),
N konfigurierbar (Default 3).
*Fertig, wenn:* Eine „Heute"-Ansicht zeigt die Top-N über dieselben Daten wie der Feed.

### Epic 5 — Übersicht / SOTA / Verlauf *(MVP-nah, optional früh)*
Abgeleitete Übersichtsseite mit Filtern nach Datum/Alter/Relevanz; „was ist aktuell SOTA".
*Fertig, wenn:* Man kann über Zeitraum/Relevanz filtern und Älteres gezielt sichtbar machen.

### Epic 6 — Saves, Feedback & Resurfacing *(Fast-Follow)*
`interaction`-Events (save/hide/👍👎), Saves/Interests-Seite, rollierende
Interaktions-Zusammenfassung als zusätzlicher Enrichment-Kontext, Spaced Resurfacing
gespeicherter Reels („schon ausprobiert?").
*Fertig, wenn:* Reaktionen werden gespeichert und beeinflussen künftige Relevanz; Saves-Seite existiert.

### Epic 7 — Skill-Map *(Vision-Flaggschiff)*
`skill_node` + `user_progress`; `skill`-Tag aus Enrichment zu Knoten aggregieren;
visuelle Skill-Map (Themen-Cluster, ohne harte Voraussetzungen), Fortschritt
`gesehen → ausprobiert → gemeistert` per Selbst-Bestätigung, Adoption-Log.
*Fertig, wenn:* Reels sammeln sich unter Kompetenz-Knoten; Fortschritt ist setz- und sichtbar.

### Epic 8 — Agentisches Vertiefen *(Vision)*
On-demand Nachrecherche zu einem Reel/Thema; reichert dasselbe Reel-Objekt weiter an
(nutzt gespeicherte Rohdaten + gezielten neuen Abruf).
*Fertig, wenn:* Ein „Vertiefen"-Klick liefert eine tiefere, belegte Aufbereitung.

### Weitere Vision (nicht eingeplant)
Content-Clustering (Content-Modell C, `topic_cluster` aktivieren), Audio-Modus (TTS),
Team-Feed / geteilte Saves, LLM-generierte Beispiele als optionale Erweiterung von ADR 0005.

---

## 11. Offene Punkte (bewusst später)

- **Konkrete Darstellung der Beispiele** (Anreiz zum Selbst-Ausprobieren, „was ist möglich"-
  Ausblick) — Format noch offen, bewusst nicht vorab festgenagelt.
- **Finale Quellenliste** — Startset steht, wird beim Bauen von Epic 1 konkretisiert.
- **Ranking-Formel** für Top-N — Startgewichte in Epic 4 festlegen, später justieren.
- **Auth/Teilen mit Kollegen** — erst relevant, wenn aus Single-User „intern geteilt" wird.
