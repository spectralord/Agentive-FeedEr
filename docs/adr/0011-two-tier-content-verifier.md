# ADR 0011 — Zwei-Stufen-Content-Verifier

- Status: akzeptiert (Design; Umsetzung offen)
- Datum: 2026-07-23
- Berührt: ADR 0003 (Single-Pass), ADR 0001 (kuratierte Quellen), ADR 0004
  (abgeleitete Ansichten), ADR 0007 (Erfahrungsberichte), ADR 0008 (Schichten)

## Kontext / Problem

Der Verifier soll Inhalte kritisch gegenchecken. Ein LLM, das „Wahrheit" beurteilt,
halluziniert aber selbst am ehesten genau dort — ein unzuverlässiger Prüfer ist schlimmer
als keiner. Gleichzeitig gibt es bereits `quality_score` (Substanz vs. Hype), sodass der
Verifier *etwas anderes* liefern muss, um nicht redundant zu sein.

## Entscheidung

Der Verifier ist **zweistufig**, entlang der Schichten aus ADR 0008:

**Stufe 1 — Reel-Verifier (ephemere Reels):**
- Ein **eigener Kritiker-Pass** (separater LLM-Call, „Kritiker"-Rolle) bekommt **Quelle +
  fertiges Reel** und prüft: **(A) Treue** — überzeichnet die Aufbereitung die Quelle? —
  und **(B) Skepsis** — riskante Aussage-Typen (unbelegte Benchmarks, Superlative/
  „X ersetzt Y", Einzelfall-Verallgemeinerungen).
- Ergebnis: `caveat` (Text, nullable). **Gated:** nur Reels prüfen, die überhaupt
  angezeigt werden (über der Quality/Relevanz-Schwelle) → Kosten im Rahmen.
- `caveat` ist ein **eigener gespeicherter Fakt**, wird als ⚠️ sichtbar gemacht und ist
  filterbar, **fließt aber nicht in `quality_score`** ein (getrennte Signale, ADR 0004;
  „Transparenz statt stilles Ausblenden").

**Stufe 2 — Cluster-Korroboration (dauerhafte Wissensschicht):**
- Auf der Cluster-/Wissens-Ebene wird eine **`confidence`** aus der Zahl **unabhängiger
  stützender Quellen** abgeleitet — ein **Konsens-Signal**, keine LLM-Wahrheitsbewertung.
- **Eigener Korpus zuerst** (Topic-Cluster mit N unabhängigen Quellen); **externe
  Web-Suche später** als bewusste Erweiterung (rührt an ADR 0001 → eigener Entscheid).
- Hängt am **Clustering** (`topic_cluster` / Content-Modell C / Vision V1).

**Erfahrungsberichte (ADR 0007 gewahrt):** Stufe-1-Treue entfällt (kein externer Quell-
Bezug); Skepsis nur als **enger Überclaim-Flag** (Absolutaussagen), **nie** die
Subjektivität an sich. Hauptwert ist Stufe-2-Korroboration. Der `caveat` **rahmt**, er
diskreditiert nicht.

Stufe 1 ist ein **zweiter Pass** und **revidiert damit ADR 0003** (Single-Pass) — im
selben Geist wie ADR 0009 (SkillTagger): eigenständige Belange bekommen einen eigenen
Pass mit passendem Kontext.

## Alternativen

- **Echter Faktenchecker gegen externes Wissen (Stufe-1-C):** höchste Halluzinationsgefahr
  beim Prüfer selbst. Verworfen; falls überhaupt, dann als geerdete Korroboration (Stufe 2).
- **Selbst-Flaggen im Enrichment-Single-Pass:** billig, aber Selbstkritik-Bias untergräbt
  den Zweck. Verworfen zugunsten des dedizierten Kritiker-Passes.
- **`caveat` in `quality_score` einrechnen:** vermischt zwei verschiedene Signale
  (Treue-Vorbehalt vs. Substanz). Verworfen (ADR 0004).

## Konsequenzen

- Zwei Prüf-Ebenen mit unterschiedlichem Aufwand/Takt: Stufe 1 pro Reel (billig, gated),
  Stufe 2 selten auf Cluster-Ebene (braucht Clustering).
- Neues gespeichertes Feld `caveat` an Reels; `confidence` auf Cluster-Ebene (später).
- Verlässlichkeit durch Geerdetheit (Treue = Vergleich mit Quelle; Confidence = Zählen
  unabhängiger Quellen) statt durch erfundene Zweitmeinung.
- Kosten: +1 LLM-Call pro anzuzeigendem Reel (Haiku, gated). Externe Web-Korroboration
  ist eine spätere, separat zu entscheidende Erweiterung.
