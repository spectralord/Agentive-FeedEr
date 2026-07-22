# ADR 0002 — Ingestion und Enrichment entkoppeln

- Status: akzeptiert
- Datum: 2026-07-21

## Kontext / Problem

Der einzige variable Kostentreiber des Tools ist die LLM-Nutzung (Tokens pro Aufruf).
Das Einsammeln von Feeds ist dagegen praktisch kostenlos. Würde man beim Einsammeln
sofort jedes Item durch das LLM schicken, zahlt man leicht mehrfach fürs selbe Item und
koppelt die Kosten an die Abrufhäufigkeit.

## Entscheidung

Die Pipeline wird in zwei getrennte Phasen zerlegt:

1. **Ingestion**: alle Quellen abrufen, neue Einträge als **Raw Item** roh speichern
   (dedupliziert über Source-ID/Link/Datum). Keine KI.
2. **Enrichment**: nur **noch nicht angereicherte** Raw Items durch das LLM schicken und
   zu Reels verarbeiten.

## Alternativen

- **Ein kombinierter Schritt** (abrufen → sofort anreichern): einfacher im ersten
  Moment, aber teuer (Doppelverarbeitung) und schlechter kontrollierbar.

## Konsequenzen

- LLM-Kosten sind kontrollierbar: pro Item wird höchstens einmal bezahlt.
- Rohdaten bleiben erhalten → spätere Re-Verarbeitung (z. B. „Vertiefen", geänderte
  Prompts, neues Profil) ist möglich, **ohne** erneut zu scrapen.
- Es braucht einen Zustand pro Raw Item („angereichert ja/nein").
