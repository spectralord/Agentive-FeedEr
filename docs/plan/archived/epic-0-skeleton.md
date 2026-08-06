# Epic 0 — Project Skeleton (MVP)

**Goal:** Runnable, deployable Next.js app with DB connection, env validation,
Claude client, and empty feed page. After this, every further epic can build purely
on the domain logic.

**References:** ADR 0006 (container/Railway), master plan §2–4.

---

## Tasks

### ☑ T0.1 — Initialize Next.js project
- In the repo root: `npx create-next-app@latest . --typescript --app --src-dir --tailwind --eslint --no-import-alias` (existing files like `README.md`, `docs/`, `CONTEXT.md` stay untouched; on conflict prompts, keep existing files).
- `package.json` name: `agentive-feeder`.
- **Verification:** `npm run dev` starts, home page renders.

### ☑ T0.2 — Install dependencies
```
npm i drizzle-orm pg zod @anthropic-ai/sdk rss-parser
npm i -D drizzle-kit tsx vitest @types/pg
```
- Add `package.json` scripts:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "job:daily": "tsx src/jobs/daily.ts",
  "test": "vitest run"
}
```
- **Verification:** `npm run build` green.

### ☑ T0.3 — Env validation (`src/lib/env.ts`)
- zod schema for all variables from master plan §4 (required vs. optional with default).
- Export as a typed `env` object; throws a comprehensible error at import time if a
  required variable is missing.
- Create `.env.example` with all variables (no real values). `.env` in `.gitignore`.
- **Verification:** unit test: parsing with dummy values set returns correct defaults.

### ☑ T0.4 — DB client & Drizzle setup
- `src/db/client.ts`: `pg` pool + `drizzle(pool)`; pool singleton (globalThis guard for dev hot reload).
- `drizzle.config.ts`: schema `./src/db/schema.ts`, out `./drizzle`, dialect `postgresql`, `dbCredentials.url` from `DATABASE_URL`.
- Create `src/db/schema.ts` (initially empty/placeholder export; tables come in Epic 1/2).
- **User action:** provision Postgres (locally: Docker `postgres:16`, or Neon free tier) and set `DATABASE_URL` in `.env`.
- **Verification:** `npm run db:generate` runs without errors (even with an empty schema).

### ☑ T0.5 — Claude client wrapper (`src/lib/claude.ts`)
- Anthropic SDK client singleton with `env.ANTHROPIC_API_KEY`.
- One helper function `callStructured<T>(opts: { system: string; user: string; toolName: string; inputSchema: object; model?: string; maxTokens?: number }): Promise<unknown>` — calls `messages.create` with a single tool (`input_schema = inputSchema`) and `tool_choice: { type: "tool", name: toolName }`, and returns the `input` of the tool-use block. (Validation is done by the caller via zod — Epic 2.)
- **Verification:** unit test with a mocked SDK client (no real API call).

### ☑ T0.6 — Base layout & empty pages
- `src/app/layout.tsx`: dark, mobile-first base layout, title "Agentive-FeedEr", simple bottom/top navigation with links: Feed (`/`), Today (`/today`), Overview (`/overview`).
- `src/app/page.tsx`: empty feed with placeholder text "No reels yet — pipeline coming in Epic 1/2."
- `/today`, `/overview` as placeholder pages.
- **Verification:** all three routes render without errors.

### ☑ T0.7 — Health check & deployment prep
- `src/app/api/health/route.ts`: `GET` → `{ ok: true, db: <boolean> }` (DB check via `SELECT 1`, error ⇒ `db:false`, HTTP stays 200).
- Add a "Development & deployment" section to `README.md`: local steps (`npm i`, `.env`, `db:migrate`, `dev`) + Railway steps.
- **User action (Railway):** create project, connect repo, add Postgres plugin, set env vars, start command `npm run start`; second service/cron schedule (daily, e.g. 05:00 UTC) with command `npm run job:daily`.
- **Verification:** locally: `curl localhost:3000/api/health` → `{ ok: true, db: true }`.

---

## Completion criteria (epic DoD)
- App runs locally with a DB connection; build, tests, lint green.
- `.env.example` complete; no secrets in the repo.
- Deployment instructions in the README; the Railway deploy itself is a user action and may remain open.

## Deviations/Questions
- T0.1: `create-next-app` refuses non-empty directories ⇒ scaffolded in a temporary
  directory and copied the files over (existing docs untouched).
  Scaffold used import alias `@/*` — kept as is.
- T0.1+T0.2 in one commit (a scaffold without deps isn't meaningfully verifiable).
- Verification ran against a local system Postgres 16 (Docker daemon not available
  in the build environment); `{ ok: true, db: true }` confirmed.
