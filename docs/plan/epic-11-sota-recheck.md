# Epic 11 — Topic-Knowledge-Check (Freshness + Korroboration)

> **Status: DESIGN GEGRILLT (2026-07-23), Umsetzung offen.** Vereint die frühere
> „SOTA-Frische-Re-Check"-Idee **und** Verifier-Stufe 2 (Korroboration) zu **einem**
> Feature auf Basis Clustering (ADR 0012). **Voraussetzung: Epic 15 (Topic-Clustering).**

**Ziel:** Pro Topic-Cluster zwei Ausgaben aus *einem* Quervergleich über Quellen/Zeit:
- **`confidence`** — wie gut ist der Claim durch **unabhängige** Quellen gestützt (Korroboration).
- **`freshness`/Supersession** — ist Neueres da, das Älteres ablöst (z. B. `batch → fork`)?
  → Älteres via `superseded_by`/`lifecycle_state=deprecated` markieren.

**Referenzen:** ADR 0012 (Kern), ADR 0008 (Schichten, `superseded_by`), ADR 0004 (abgeleitete
Ansichten), ADR 0001 (kuratierte Quellen — externe Web-Korroboration ist separater Entscheid).
Glossar: Topic-Knowledge-Check, confidence, freshness, Korroboration, Topic-Cluster.

## Gegrillte Entscheidungen
- **Recheneinheit = Topic-Cluster**; `confidence`/`freshness` sind Cluster-Eigenschaften und
  **propagieren** auf referenzierende Items (Skill-Nodes, gespeicherte Reels, SOTA) — „dein
  Wissen zu X ist veraltet, siehe Neueres" / Stütz-Grad. Supersession lebt an den Items.
- **Kein „LLM entscheidet Wahrheit":** Korroboration = unabhängige Quellen zählen;
  Freshness = geerdeter Vergleich der Cluster-Items untereinander.
- **Erfahrungsberichte:** bekommen Korroboration (Stütz-Grad); nur enger Überclaim-Flag,
  nie Subjektivität an sich (ADR 0007).

## Offene Design-Fragen (im Grill *auf Clustering-Basis* zu klären)
- **Supersession-Erkennung:** LLM-Widerspruchs-/Ablöse-Vergleich der Cluster-Items
  (geerdet, nicht extern) + explizite Deprecation-Signale aus Quelltext (Changelogs).
- **Auto-anwenden vs. vorschlagen:** konservativ — eher `deprecated` vorschlagen als
  automatisch verschieben (mensch-im-Loop, damit nichts fälschlich verschwindet).
- **`confidence`-Skala** (0–100 vs. few/some/strong) und „unabhängig/stützend"-Definition.
- **Kadenz:** eigener Pipeline-Schritt/Cron nach Clustering.
- **Externe Web-Korroboration** (Quellen erweitern): noch später, rührt an ADR 0001.

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
