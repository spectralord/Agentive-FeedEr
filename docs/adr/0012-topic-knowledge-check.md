# ADR 0012 — Topic-Knowledge-Check: Korroboration + Freshness vereint auf Clustering

- Status: akzeptiert (Design; Umsetzung offen)
- Datum: 2026-07-23
- Berührt/ersetzt: ADR 0011 (Verifier-Stufe 2), Epic 11 (SOTA-Re-Check); baut auf
  ADR 0004 (abgeleitete Ansichten), ADR 0008 (Schichten, `superseded_by`).

## Kontext / Problem

Zwei geplante Fähigkeiten vergleichen jeweils *ein Thema über mehrere Quellen*:
- **Korroboration** (ehemals Verifier-Stufe 2, ADR 0011): wie gut ist ein Claim durch
  unabhängige Quellen gestützt → `confidence`.
- **Freshness/Supersession** (ehemals Epic 11): ist Neueres da, das Älteres ablöst
  (z. B. „Parameter `batch` → `fork`") → `superseded_by`/Deprecation.

Getrennt gebaut würden sie dieselbe Cluster-/Quervergleichs-Logik doppeln.

## Entscheidung

Beide werden **ein Feature — der „Topic-Knowledge-Check"** — auf Basis **Clustering**
(`topic_cluster` / Content-Modell C). Er liefert **zwei Ausgaben** desselben Schritts:
`confidence` und `freshness`/Supersession.

- **Recheneinheit ist der Topic-Cluster** (dort liegen die vergleichbaren Quellen).
  `confidence`/`freshness` sind **Cluster-Eigenschaften** und **propagieren** auf alles,
  was Items des Clusters referenziert (Skill-Nodes, gespeicherte Reels, SOTA-Einträge) —
  „dein Wissen zu X ist veraltet, siehe Neueres" bzw. Stütz-Grad. Supersession lebt an den
  Items via `superseded_by` (ADR 0008), die Sichten leiten ab (ADR 0004).
- **Clustering ist die Voraussetzung** und wird von einer Vision-Skizze zu einem echten
  Vorläufer-Epic (Topic-Clustering) hochgezogen. Ohne Clustering ist der Check nicht baubar.

## Alternativen

- **Zwei getrennte Features** (Confidence vs. Freshness): dupliziert Cluster-Logik,
  zwei Blickwinkel auf dasselbe „was sagen die Quellen, wie aktuell". Verworfen.
- **Am Skill-Node statt Cluster rechnen:** verliert die feinkörnige Claim-Ebene, auf der
  Supersession real passiert. Verworfen (Cluster als Einheit + Propagation).

## Konsequenzen

- Epic 11 wird zum „Topic-Knowledge-Check"; Verifier-Stufe 2 (ADR 0011) fällt hier hinein.
  Verifier-**Stufe 1** (Reel-`caveat`) bleibt eigenständig und baubar ohne Clustering.
- Neuer Vorläufer: **Topic-Clustering-Epic** (muss vor dem Check gebaut/gegrillt werden).
- Offen (im Grill auf Clustering-Basis zu klären): Wie wird Supersession erkannt
  (LLM-Widerspruchsvergleich im Cluster + explizite Deprecation-Signale)? Auto-anwenden
  vs. vorschlagen? Kadenz (eigener Schritt/Cron)? „Unabhängig/stützend" — Definition?
