# Epic 14 — Quellen-Validierung & -Überprüfung (geparkt)

> **Status: GEPARKT** — auf Benutzerwunsch als Epic vorgemerkt, gebaut „wenn der Rest
> steht". Vor Umsetzung eigener Grill + ggf. ADR. Nicht ohne Benutzer-Go bauen.

**Ziel:** Sicherstellen, dass die kuratierten Quellen dauerhaft funktionieren — erkennen,
wenn eine Quelle blockt/wegbricht (z. B. Reddit 403/429, tote Feed-URLs, Format-Änderung),
und sinnvoll darauf reagieren, statt still Rauschen/Fehler zu produzieren.

**Referenzen:** ADR 0001 (kuratierte Quellen), Epic 1 (Ingestion, `sources`,
`disabled`-Flag), Epic 13 (Admin-Console, `pipeline_runs`), vision-backlog V6 (Reddit OAuth).

## Motivation (aus dem Betrieb 2026-07-22/23)
- Reddit-Feeds liefern serverseitig 403/429 (deaktiviert, siehe `sources.ts` + V6).
- Feed-URLs außerhalb GitHubs waren aus der Build-Sandbox nie testbar — erst der erste
  echte Railway-Lauf zeigte, welche wirklich antworten.

## Offene Design-Fragen (im Grill zu klären)
- **Health-Signal:** Woran macht sich „Quelle kaputt" fest — N aufeinanderfolgende
  Fehler? HTTP-Status-Muster? Null neue Items über X Tage trotz aktiver Quelle?
- **Reaktion:** nur anzeigen/alarmieren, oder **auto-disable** nach Schwelle? Manuelle
  Bestätigung? (Kollision mit dem seed-authoritative `enabled` bedenken — dann braucht es
  ein separates `auto_disabled`/`manual_override`-Feld, siehe Kommentar in `sources.ts`.)
- **Validierung neuer Quellen:** Beim Hinzufügen einer Quelle einmal testen (Abruf +
  Parse ok?), bevor sie aktiv wird.
- **Sichtbarkeit:** in der Admin-Console (Epic 13 T13.7 Quellen-Liste) — Status je Quelle,
  letzter Erfolg, Fehlerquote, Toggle.
- **Alerting:** Benachrichtigung (Mail/Push), wenn eine wichtige Quelle länger ausfällt.

## Grobe Skizze (unverbindlich)
- Health je Quelle aus `pipeline_runs`-Summaries ableiten (Fehler pro Quelle über Zeit)
  oder eigenes `source_health`-Feld (`consecutive_failures`, `last_success_at`).
- Admin-Ansicht „Quellen" mit Status + manuellem Toggle + „neu validieren".
- Optionaler Auto-Disable nach Schwelle (konservativ, mit manueller Reaktivierung).

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
