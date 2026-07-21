# ADR 0004 — Labels aus Fakten ableiten statt fest stempeln

- Status: akzeptiert
- Datum: 2026-07-21

## Kontext / Problem

Das Tool soll kennzeichnen, was „neu", „State of the Art" oder „Best Practice" ist, und
zusätzlich eine Übersichts-/Verlaufsseite bieten, auf der man auch Älteres nach
Relevanz/Alter filtern kann. Würde man diese Labels beim Verarbeiten fest an ein Reel
stempeln, wären sie statisch, inkonsistent und schwer neu zu berechnen, wenn sich die
Sicht („was ist *jetzt* SOTA") ändert.

## Entscheidung

Reels speichern **Fakten/Attribute** (`published_at`, `ingested_at`, `category`,
`maturity`, `relevance_score`, `quality_score`, `experimentell`). Anzeige-Labels wie
„🆕 Neu", „⭐ State of the Art", „🛠️ Best Practice" sind **abgeleitete Ansichten/Filter**
über diese Fakten (z. B. „neu" = junges `published_at`; „SOTA" = etabliert + hohe
Relevanz, altersunabhängig).

**Ausnahme:** `experimentell` ist **kein** ableitbares Label, sondern ein gespeichertes
Flag, da es sich nicht aus Datum/Relevanz ergibt.

Das Attribut-Set ist über ein flexibles Metadaten-Feld erweiterbar, ohne Schema-Migration.

## Alternativen

- **Feste gestempelte Labels** pro Reel: einfacher abzufragen, aber unflexibel; die
  Übersichts-/Verlaufsseite würde teure Neuberechnungen oder Duplikate erfordern.

## Konsequenzen

- Die Übersichts-/Verlaufs-/SOTA-Seite ist „geschenkt" — nur eine andere Abfrage über
  dieselben Daten.
- Filterlogik lebt an einer Stelle (Ansicht), nicht in gespeicherten Zuständen.
- Erfordert ein flexibles Metadaten-Feld (z. B. JSONB), damit neue Attribute
  migrationsfrei dazukommen.
