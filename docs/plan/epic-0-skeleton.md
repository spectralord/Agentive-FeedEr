# Epic 0 — Projekt-Skelett (MVP)

**Ziel:** Lauffähige, deploybare Next.js-App mit DB-Anbindung, Env-Validierung,
Claude-Client und leerer Feed-Seite. Danach kann jedes weitere Epic rein fachlich bauen.

**Referenzen:** ADR 0006 (Container/Railway), Master-Plan §2–4.

---

## Tasks

### ☑ T0.1 — Next.js-Projekt initialisieren
- Im Repo-Root: `npx create-next-app@latest . --typescript --app --src-dir --tailwind --eslint --no-import-alias` (bestehende Dateien wie `README.md`, `docs/`, `CONTEXT.md` bleiben unberührt; bei Konflikt-Nachfrage vorhandene Dateien behalten).
- `package.json`-Name: `agentive-feeder`.
- **Verifikation:** `npm run dev` startet, Startseite rendert.

### ☑ T0.2 — Dependencies installieren
```
npm i drizzle-orm pg zod @anthropic-ai/sdk rss-parser
npm i -D drizzle-kit tsx vitest @types/pg
```
- `package.json`-Scripts ergänzen:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "job:daily": "tsx src/jobs/daily.ts",
  "test": "vitest run"
}
```
- **Verifikation:** `npm run build` grün.

### ☑ T0.3 — Env-Validierung (`src/lib/env.ts`)
- zod-Schema für alle Variablen aus Master-Plan §4 (Pflicht vs. optional mit Default).
- Export als typisiertes `env`-Objekt; wirft beim Import verständlichen Fehler bei
  fehlender Pflicht-Variable.
- `.env.example` mit allen Variablen anlegen (ohne echte Werte). `.env` in `.gitignore`.
- **Verifikation:** Unit-Test: Parsen mit gesetzten Dummy-Werten liefert Defaults korrekt.

### ☑ T0.4 — DB-Client & Drizzle-Setup
- `src/db/client.ts`: `pg`-Pool + `drizzle(pool)`; Pool-Singleton (globalThis-Guard für Dev-Hot-Reload).
- `drizzle.config.ts`: schema `./src/db/schema.ts`, out `./drizzle`, dialect `postgresql`, `dbCredentials.url` aus `DATABASE_URL`.
- `src/db/schema.ts` anlegen (zunächst leer/Platzhalter-Export; Tabellen kommen in Epic 1/2).
- **Benutzer-Aktion:** Postgres bereitstellen (lokal: Docker `postgres:16`, oder Neon-Free-Tier) und `DATABASE_URL` in `.env` setzen.
- **Verifikation:** `npm run db:generate` läuft fehlerfrei (auch mit leerem Schema).

### ☑ T0.5 — Claude-Client-Wrapper (`src/lib/claude.ts`)
- Anthropic-SDK-Client-Singleton mit `env.ANTHROPIC_API_KEY`.
- Eine Hilfsfunktion `callStructured<T>(opts: { system: string; user: string; toolName: string; inputSchema: object; model?: string; maxTokens?: number }): Promise<unknown>` — ruft `messages.create` mit einem einzelnen Tool (`input_schema = inputSchema`) und `tool_choice: { type: "tool", name: toolName }` auf und gibt das `input` des Tool-Use-Blocks zurück. (Validierung macht der Aufrufer per zod — Epic 2.)
- **Verifikation:** Unit-Test mit gemocktem SDK-Client (kein echter API-Call).

### ☑ T0.6 — Basis-Layout & leere Seiten
- `src/app/layout.tsx`: dunkles, mobil-first Grundlayout, Titel „Agentive-FeedEr", einfache Bottom-/Top-Navigation mit Links: Feed (`/`), Heute (`/today`), Übersicht (`/overview`).
- `src/app/page.tsx`: leerer Feed mit Platzhaltertext „Noch keine Reels — Pipeline läuft ab Epic 1/2."
- `/today`, `/overview` als Platzhalter-Seiten.
- **Verifikation:** Alle drei Routen rendern ohne Fehler.

### ☑ T0.7 — Healthcheck & Deployment-Vorbereitung
- `src/app/api/health/route.ts`: `GET` → `{ ok: true, db: <boolean> }` (DB-Check via `SELECT 1`, Fehler ⇒ `db:false`, HTTP bleibt 200).
- `README.md` um Abschnitt „Entwicklung & Deployment" ergänzen: lokale Schritte (`npm i`, `.env`, `db:migrate`, `dev`) + Railway-Schritte.
- **Benutzer-Aktion (Railway):** Projekt anlegen, Repo verbinden, Postgres-Plugin hinzufügen, Env-Vars setzen, Start-Command `npm run start`; zweiter Service/Cron-Schedule (täglich, z. B. 05:00 UTC) mit Command `npm run job:daily`.
- **Verifikation:** Lokal: `curl localhost:3000/api/health` → `{ ok: true, db: true }`.

---

## Abschlusskriterien (Epic-DoD)
- App läuft lokal mit DB-Verbindung; Build, Tests, Lint grün.
- `.env.example` vollständig; keine Secrets im Repo.
- Deployment-Anleitung im README; Railway-Deploy selbst ist Benutzer-Aktion und darf offen bleiben.

## Abweichungen/Fragen
- T0.1: `create-next-app` verweigert nicht-leere Verzeichnisse ⇒ in temporärem
  Verzeichnis gescaffoldet und Dateien kopiert (bestehende Docs unberührt).
  Scaffold nutzte Import-Alias `@/*` — beibehalten.
- T0.1+T0.2 in einem Commit (Scaffold ohne Deps ist nicht sinnvoll verifizierbar).
- Verifikation lief gegen lokale System-Postgres 16 (Docker-Daemon in der
  Build-Umgebung nicht verfügbar); `{ ok: true, db: true }` bestätigt.
