# Epic 15 — Topic-Clustering (Fundament, erst grillen)

> **Status: VORLÄUFER-FUNDAMENT** — hochgezogen aus Vision-Backlog V1 (Content-Modell C),
> weil der Topic-Knowledge-Check (Epic 11) und die Content-Bündelung darauf aufsetzen.
> Vor Bau: eigener Grill (Cluster-Bildung ist der knifflige Teil).

**Ziel:** Reels (und später Erfahrungsberichte), die **dasselbe Thema** behandeln, zu
**Topic-Clustern** gruppieren — die Grundlage für Content-Bündelung (Content-Modell C),
`confidence` und `freshness` (Epic 11).

**Referenzen:** Content-Modell C (Design-Doc 2026-07-21), Vision-Backlog V1, ADR 0012
(Topic-Knowledge-Check baut darauf), Glossar: Topic-Cluster.

## Motivation
- Das reservierte Feld `reels.topic_cluster_id` existiert seit Epic 2, wird aber nicht genutzt.
- Feed wirkt bei mehreren Quellen zum selben Thema repetitiv (ursprüngliche Grill-Sorge C).
- Korroboration/Freshness (Epic 11) brauchen „mehrere Quellen zu einem Claim" — das *ist* ein Cluster.

## Gegrillte Entscheidungen (2026-07-23)
- **Cluster-Bildung = Match-or-Propose gegen *aktive* Cluster** (Muster wie SkillTagger,
  ADR 0009): jedes neue Item sucht in einem Zeitfenster den nächstliegenden bestehenden
  Cluster (Match) oder schlägt einen neuen vor (Propose). Stabil über die Zeit, kein
  Neu-Würfeln pro Lauf, LLM-Kontext bleibt beschränkt. Embeddings sind spätere
  Skalierungs-Naht, kein MVP.
- **Granularität = eng / meldungs- bzw. feature-spezifisch.** Ein Cluster bündelt Inhalte
  zu *einem konkreten Ding und seiner Verwendung* (Beispiel: „der Batch-Command & seine
  Nutzung"), **nicht** auf generischer Skill-Ebene. Das hält die Korroborations-Zahl
  ehrlich (mehrere unabhängige Quellen zum *selben spezifischen* Claim).
- **Breite thematische Ebene = die Skill-Node (Epic 12), kein eigener Cluster-Typ.**
  Ein Item hat also (a) einen **engen Topic-Cluster** (Epic 15) *und* (b) hängt an einer
  oder mehreren **Skill-Nodes** (Epic 12, via SkillTagger) — das sind die zwei „Peer-Mengen":
  eng für Korroboration/Freshness, breit für die thematische Wissens-/Browsing-Sicht.
  Epic 15 baut daher **nur den einen engen Cluster-Typ**; keine zweistufige Cluster-Hierarchie.

## Offene Design-Fragen (im Grill zu klären)
- **Unabhängigkeit von Quellen:** Für Korroboration (Epic 11) zählt „unabhängige" Quellen —
  wie erkennen (verschiedene `source`, nicht dieselbe Meldung rebloggt)?
- **MVP-Schnitt:** Was baut Epic 15 selbst (Schema + Match-or-Propose + Feed-Stapelkarte)
  vs. was gehört zu Epic 11 (confidence/freshness auf Cluster-Basis)?

## Grobe Skizze (unverbindlich)
- Neue Tabelle `topic_clusters { id, title, created_at }`; `reels.topic_cluster_id` aktivieren.
- Pipeline-Schritt nach Enrichment/SkillTagger: neue Items einem bestehenden Cluster
  zuordnen (Match) oder neuen Cluster anlegen (Propose) — Muster wie SkillTagger (ADR 0009).
- Feed zeigt gebündelte Reels als Stapel-Karte („N Quellen zu diesem Thema").

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
