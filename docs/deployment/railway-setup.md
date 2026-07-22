# Railway-Einrichtung — Schritt-für-Schritt

> Bezug: ADR [0006](../adr/0006-all-in-one-container-hosting.md) (All-in-one-Container
> statt Serverless), Epic [0 — Projekt-Skelett](../plan/epic-0-skeleton.md), Task T0.7.

**Hinweis zum Zeitpunkt:** Das Repo ist aktuell in der Design-Phase — es gibt noch keine
lauffähige Next.js-App (siehe [`README.md`](../../README.md)). Diese Anleitung kannst du
schon jetzt durchgehen, um Konto/Projekt/Postgres vorzubereiten; der eigentliche Deploy
(Build + Start) liefert erst ein sichtbares Ergebnis, sobald Epic 0 umgesetzt ist. Ohne
Code schlägt der erste Build fehl — das ist in dieser Phase erwartbar.

Diese Anleitung ist reine Doku für dich zum Selbst-Ausführen im Railway-Dashboard — es
werden dabei keine Dateien im Repo verändert und kein Code deployt.

---

## 1. Account & Projekt anlegen

1. Auf [railway.app](https://railway.app) mit GitHub-Account einloggen (vereinfacht
   später das Verbinden des Repos).
2. **New Project** → **Deploy from GitHub repo**.
3. Repo `spectralord/agentive-feeder` auswählen (ggf. Railway-GitHub-App-Zugriff für
   dieses Repo freigeben, falls noch nicht geschehen).
4. Branch für den produktiven Deploy festlegen (i. d. R. `main`, sobald Epic 0 dort
   gemerged ist).

## 2. Postgres hinzufügen

1. Im Projekt: **+ New** → **Database** → **Add PostgreSQL**.
2. Railway legt automatisch eine `DATABASE_URL` an und stellt sie als Referenz-Variable
   bereit — die kannst du im App-Service unter **Variables** per Referenz einbinden
   (`${{Postgres.DATABASE_URL}}`), statt sie manuell zu kopieren.

## 3. App-Service konfigurieren

Im App-Service (dem GitHub-Repo-Service, nicht der Postgres-Datenbank):

- **Settings → Build**: Railway erkennt Next.js i. d. R. automatisch (Nixpacks). Falls
  nicht: Build-Command `npm run build`.
- **Settings → Deploy → Start Command**: `npm run start`.
- **Variables** (siehe Abschnitt 5) setzen.
- **Settings → Networking**: **Generate Domain**, um eine öffentlich erreichbare
  `*.up.railway.app`-URL zu bekommen (für Zugriff vom iPad/Browser gemäß ADR 0006).

## 4. Zweiter Service für den täglichen Cron-Job

Der tägliche Ingestion-/Enrichment-Batch läuft als **eigener Service** im selben
Projekt, nicht als Route der Web-App:

1. Im Projekt: **+ New** → **GitHub Repo** → dasselbe Repo erneut auswählen (oder
   **Empty Service**, falls du lieber ein separates Deploy-Target ohne Web-Traffic willst).
2. **Settings → Deploy → Cron Schedule** aktivieren, z. B. `0 5 * * *` (täglich 05:00 UTC).
3. **Start Command**: `npm run job:daily`.
4. Dieselben Variablen wie beim App-Service hinterlegen (insbesondere `DATABASE_URL` und
   `ANTHROPIC_API_KEY`), da der Job dieselbe DB und denselben Claude-Zugang braucht.
5. **Networking**: für diesen Service keine Domain generieren — er braucht keinen
   eingehenden Web-Traffic.

## 5. Environment-Variablen setzen

Mindestens (Namen final gemäß `.env.example`, sobald T0.3 umgesetzt ist):

| Variable | Wert / Quelle |
|---|---|
| `DATABASE_URL` | Referenz auf den Postgres-Service (`${{Postgres.DATABASE_URL}}`) |
| `ANTHROPIC_API_KEY` | Dein Anthropic-API-Key ([console.anthropic.com](https://console.anthropic.com)) |
| `NODE_ENV` | `production` |

Beide Services (App + Cron) brauchen dieselben Werte für `DATABASE_URL` und
`ANTHROPIC_API_KEY`. Weitere optionale Variablen ergänzt T0.3 (`src/lib/env.ts` +
`.env.example`) — dann diese Tabelle entsprechend erweitern.

## 6. Migrationen ausführen

Nach dem ersten erfolgreichen Deploy (sobald `drizzle`-Setup aus T0.4 existiert):

- Entweder einmalig lokal gegen die Railway-`DATABASE_URL` migrieren
  (`npm run db:migrate` mit der Railway-Connection-String in `.env`), oder
- einen einmaligen Railway-Run über **Deploy Logs → Shell**/`railway run npm run
  db:migrate` (Railway-CLI, `npm i -g @railway/cli` + `railway login` + `railway link`).

## 7. Verifikation

- Web-App: `https://<deine-domain>.up.railway.app/api/health` liefert
  `{ ok: true, db: true }` (Healthcheck-Route aus T0.7).
- Cron-Service: **Deployments → Logs** nach dem geplanten Lauf prüfen, ob
  `npm run job:daily` fehlerfrei durchläuft und neue `raw_item`-Zeilen entstehen.

## 8. Kosten

- Hobby-Tier (~5 $/Monat) deckt App + Cron + kleine Postgres-Instanz laut ADR 0006.
- LLM-Kosten (Anthropic) laufen separat über die Anthropic-Rechnung, nicht über Railway.

---

## Checkliste

- [ ] Railway-Account verbunden mit GitHub
- [ ] Projekt angelegt, Repo verbunden
- [ ] Postgres-Plugin hinzugefügt
- [ ] App-Service: Start-Command `npm run start`, Domain generiert
- [ ] Cron-Service: Start-Command `npm run job:daily`, Schedule gesetzt
- [ ] `DATABASE_URL` + `ANTHROPIC_API_KEY` in beiden Services gesetzt
- [ ] Migrationen gegen Railway-Postgres gelaufen
- [ ] `/api/health` liefert `{ ok: true, db: true }`
