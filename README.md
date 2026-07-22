# Agentive-FeedEr

Persönliches Web-Tool, das KI-News (Fokus: neue Claude-Features und agentische
KI-Nutzung in der Entwicklung) aus kuratierten Quellen einsammelt, KI-gestützt zu kurzen
„Reels" aufbereitet und als vertikal scrollbaren Feed konsumierbar macht — mit Fokus auf
Rauschunterdrückung, Handlungsbezug und tatsächliches Anwenden.

## Dokumentation

- **Glossar:** [`CONTEXT.md`](./CONTEXT.md)
- **Architektur-Design & Epics:** [`docs/specs/2026-07-21-agentive-feeder-design.md`](./docs/specs/2026-07-21-agentive-feeder-design.md)
- **Architektur-Entscheidungen (ADRs):** [`docs/adr/`](./docs/adr/)
- **Entwicklungsplan (pro Epic, ausführbar):** [`docs/plan/README.md`](./docs/plan/README.md)

> Status: In Umsetzung entlang der Epics (siehe Status-Tabelle im Entwicklungsplan).

## Entwicklung

```bash
npm install
cp .env.example .env      # DATABASE_URL + ANTHROPIC_API_KEY eintragen
npm run db:migrate        # Migrationen ausführen
npm run dev               # App auf http://localhost:3000
npm run job:daily         # tägliche Pipeline manuell ausführen
npm test                  # Unit-/Integrationstests
```

Lokale Postgres z. B. via Docker:
`docker run -d -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=agentive_feeder -p 5432:5432 postgres:16-alpine`

## Deployment (Railway)

1. Railway-Projekt anlegen, dieses Repo verbinden, **Postgres-Plugin** hinzufügen.
2. Env-Vars setzen (siehe `.env.example`; `DATABASE_URL` liefert das Plugin).
3. Web-Service: Build `npm run build`, Start `npm run start`.
4. **Cron-Schedule** (z. B. täglich 05:00 UTC) mit Command `npm run job:daily`.
5. Healthcheck: `GET /api/health` → `{ ok, db }`.
