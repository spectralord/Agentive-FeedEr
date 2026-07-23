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

## Offene Design-Fragen (im Grill zu klären)
- **Cluster-Bildung:** rein LLM (Titel+Summaries eines Zeitfensters → Cluster-Vorschläge),
  Embeddings + Schwellwert, oder Hybrid? (Analog SkillTagger-Skalierungs-Naht: solange es
  in den Prompt passt, LLM; Embeddings erst bei Größe.)
- **Granularität:** Wie eng ist „dasselbe Thema"? (Ein Release vs. eine ganze Feature-Familie.)
- **Stabilität:** Cluster über die Zeit stabil halten (neue Items einem bestehenden Cluster
  zuordnen), nicht bei jedem Lauf neu würfeln — analog zur Skill-Node-Beständigkeit (ADR 0008).
- **Unabhängigkeit von Quellen:** Für Korroboration zählt „unabhängige" Quellen — wie
  erkennen (verschiedene `source`, nicht dieselbe Meldung rebloggt)?

## Grobe Skizze (unverbindlich)
- Neue Tabelle `topic_clusters { id, title, created_at }`; `reels.topic_cluster_id` aktivieren.
- Pipeline-Schritt nach Enrichment/SkillTagger: neue Items einem bestehenden Cluster
  zuordnen (Match) oder neuen Cluster anlegen (Propose) — Muster wie SkillTagger (ADR 0009).
- Feed zeigt gebündelte Reels als Stapel-Karte („N Quellen zu diesem Thema").

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
