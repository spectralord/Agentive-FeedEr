# ADR 0006 — All-in-one-Container-Hosting statt Serverless

- Status: akzeptiert
- Datum: 2026-07-21

## Kontext / Problem

Das Tool braucht (a) eine von überall — inkl. iPad — per Browser erreichbare Web-App und
(b) einen täglichen Batch-Job, der mehrere Feeds abruft und neue Items per LLM anreichert.
Serverless-Plattformen (z. B. Vercel) bieten das glatteste Next.js-Deploy, erzwingen aber
Zeitlimits pro Funktion, was den täglichen Batch in Häppchen zwingt.

## Entscheidung

Deployment als **einzelner Always-on-Container** auf **Railway** (App + Cron-Job +
verwaltete Postgres an einem Ort). Ziel-Betriebsmodell ist Cloud (von überall erreichbar);
dieselbe Codebasis läuft lokal als Übergangslösung.

## Alternativen

- **Serverless (Vercel + Vercel Cron)**: glattestes Frontend-Deploy, aber
  Funktions-Zeitlimits erfordern Batch-Chunking. Verworfen für den täglichen Batch.
- **Selfhosted daheim (NAS/Raspberry)**: keine externen Kosten, aber Betriebs- und
  Erreichbarkeitsaufwand. Verworfen.

## Konsequenzen

- Kein Serverless-Timeout-Handling beim Scrape-/LLM-Batch nötig.
- Kosten dominiert vom Hosting-Fixpreis (Hobby-Tier ~5 $/Monat), nicht von der Arbeit;
  LLM-Kosten bleiben im Cent-Bereich pro Tag.
- Eine Kiste ist „always on" (statt bei Bedarf hochzufahren) — für Single-User
  vernachlässigbar.
