# ADR 0001 — Kuratierte Quellen statt offenem Web-Scraping

- Status: akzeptiert
- Datum: 2026-07-21

## Kontext / Problem

Das Tool soll KI-News einsammeln. Die ursprüngliche Idee umfasste „allgemeines Web
scrapen". Offenes Web-Scraping und offene Web-Suche sind jedoch teuer, unzuverlässig
(jede Seite anders, Layouts brechen), wartungsintensiv und die Haupt-Rausch- und
Halluzinationsquelle — im direkten Widerspruch zum Ziel, *verlässlich* zu wissen, was
neu und State of the Art ist.

## Entscheidung

Der MVP bezieht Inhalte ausschließlich aus **kuratierten, strukturiert abrufbaren
Quellen** (RSS/Atom, offizielle Changelogs, HN/Reddit-APIs, Newsletter). Einzelne
seitenspezifische Scraper und offene Web-Suche werden bewusst nach hinten geschoben und
nur bei konkretem Bedarf pro Quelle ergänzt.

## Alternativen

- **Offenes Web-Scraping / Web-Suche von Anfang an**: mächtiger, aber unzuverlässig,
  teuer und rauschintensiv. Verworfen.
- **Gemischt (kuratiert + gezieltes Scraping)** von Start weg: unnötige Komplexität, da
  ~80 % des Fokus aus wenigen hochwertigen Feeds kommt.

## Konsequenzen

- Zuverlässige, günstige, wartungsarme Ingestion.
- Eine **Source-Registry** ist nötig, in der Quellen deklariert werden.
- Themenabdeckung ist durch die Quellauswahl begrenzt — akzeptabel, da kuratiert
  gewünscht ist. Neue Quellen sind additiv nachrüstbar.
