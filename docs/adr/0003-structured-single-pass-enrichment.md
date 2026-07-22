# ADR 0003 — Strukturierte Anreicherung in einem einzigen LLM-Pass

- Status: akzeptiert
- Datum: 2026-07-21

## Kontext / Problem

Ein Reel braucht viele abgeleitete Felder: Zusammenfassung, `category`, `maturity`,
`experimentell`, `relevance_score`, `quality_score`, belegtes Beispiel, Action,
Effort-Tag und `skill`-Tag. Diese über mehrere spezialisierte LLM-Aufrufe zu erzeugen
vervielfacht Kosten und Latenz. Gleichzeitig darf das LLM nichts erfinden.

## Entscheidung

Jedes Raw Item wird in **einem** LLM-Aufruf mit **striktem JSON-Schema** (Structured
Output) angereichert. Der Aufruf liefert genau ein validiertes Reel-Objekt. Felder, die
sich nicht aus der Quelle belegen lassen, kommen als `null` zurück — nicht geraten.
Auch der `quality_score` (Substanz vs. Hype) entsteht in **demselben** Pass, nicht als
zweiter Aufruf.

## Alternativen

- **Mehrere spezialisierte Aufrufe** (Summarizer, Klassifikator, Judge …): sauberere
  Einzelverantwortung, aber n-fache Kosten/Latenz. Für Single-User-Tagesbatch unnötig.
- **Freitext-Ausgabe** statt JSON-Schema: fehleranfälliger im Parsing, lädt zum
  Halluzinieren ein.

## Konsequenzen

- Günstig und schnell: ein Aufruf pro Item.
- `null`-statt-Raten macht das Sourced-only-Prinzip (siehe ADR 0005) technisch
  durchsetzbar.
- Das JSON-Objekt ist die stabile Andockstelle für spätere Anreicherung (Vertiefen).
- Ein sehr großer Prompt trägt viel Verantwortung; Schema-Validierung und klare
  Feld-Anweisungen sind Pflicht.
