# Local setup — run Agentive-FeedEr on your own machine

Postgres in Docker, the Next.js app on your host. Should take about five minutes.

## Prerequisites

- **Node 22+** (`node -v`). The repo declares no `engines`; everything has been built and tested
  against v22.
- **Docker** — Docker Desktop on macOS/Windows, Docker Engine on Linux. Make sure it is actually
  *running* before step 3.
- That's it. **No `ANTHROPIC_API_KEY` is needed to browse the UI** — see "Do I need an API key?".

## The happy path

```bash
git pull                     # get onto the latest main
cp .env.example .env         # defaults work as-is; nothing to edit
npm ci
npm run setup                # docker Postgres up -> migrate -> seed
npm run dev                  # http://localhost:3000
```

`npm run setup` chains three things, each also runnable on its own:

| Command | What it does |
|---|---|
| `npm run db:up` | Starts Postgres 16 in Docker and waits for its healthcheck |
| `npm run db:migrate` | Applies every migration in `drizzle/` from scratch |
| `npm run db:seed` | Loads `scripts/seed-dev.sql` (**destructive** — full reset, safe to re-run) |
| `npm run db:down` | Stops the container (data survives in a named volume) |

## Running the tests

```bash
npm test
```

The suite needs its **own** database, because integration tests `TRUNCATE` every table
as setup. `.env.example` already contains the line that provides one:

```bash
TEST_DATABASE_URL=postgres://feedr:feedr_local_dev@localhost:5432/feedr_test
```

That's `feedr_test` **alongside** `feedr_dev` in the same container — no second service, no
second port. Nothing else to do: the first `npm test` creates the database if it is missing and
applies every migration to it, and later runs pick up new migrations the same way.

vitest uses `TEST_DATABASE_URL` **instead of** `DATABASE_URL`, and never falls back to it. If
`TEST_DATABASE_URL` is missing (or points at the same database as `DATABASE_URL`) while a dev
`DATABASE_URL` is configured, the run aborts before a single test starts, with a message telling
you what to add. That is deliberate: a silent fallback is precisely the bug this replaced —
until 2026-07-27 the tests inherited the dev `DATABASE_URL` and every `npm test` wiped the seed,
leaving the app on "The feed is empty" until you re-ran `npm run db:seed`.

On a clone with no `.env` at all (CI), neither variable is set: unit tests run, and integration
tests fail loudly on the missing `DATABASE_URL` rather than touching anything.

`db:seed` runs psql *inside* the container, so you do **not** need Postgres client tools on your
machine.

## You should see

The seed exists to make the redesign visible. After `npm run dev`, use this as your check:

- **Feed (`/`)** — a vertical snap-scrolling reel view above a bottom tab bar. At least
  **two stack cards** ("N sources on this topic"). Scores as small R/Q bars top-right of each
  card. Skill badges (the only coloured badge) on some cards but not all.
- **Tap a card** → the Detail view pushes in from the right, with tabs.
  - **Write-up** is always present and currently shows an *explicitly-labelled placeholder* —
    that is correct and deliberate; the field exists but nothing generates it yet (ADR 0017).
  - **Context** shows related sources / the full caveat text where there is one.
  - **Skill** appears only on reels that have a skill, and carries the action line + a
    "Mark as tried" button when the node is at `seen`.
- **One reel** carries a ⚠ caveat marker, and **one cluster** shows the 🕓 "Newer available"
  notice with a "Confirm superseded" button.
- **Skills (`/skills`)** — four nodes showing **all four ring states**: untouched (bare outline),
  seen, tried, mastered (full gold + ★). One node carries the experimental-dot.
- **Bottom tab bar** — exactly four destinations (Today · Feed · Skills · Library); Admin is the
  gear in the app bar, not a tab. Nothing should overflow horizontally, even at 375px.
- **Admin (`/admin`)** — log in with the `ADMIN_TOKEN` value from your `.env`.

If any of that is missing, re-run `npm run db:seed` and reload.

## Do I need an API key?

**Not to look at the app.** The seed data covers every surface. `ANTHROPIC_API_KEY` and the
`claude` CLI are only needed to actually *run the pipeline* (`npm run job:cc`), which fetches
sources and generates content.

`.env.example` sets `APP_PROFILE=local`, which per **ADR 0015** resolves to
executor=`claude-code`, trigger=`manual` and **throws on boot** if you try to combine it with the
paid API or Railway cron. Local development therefore cannot accidentally spend API credit or
touch production.

## Troubleshooting

**Port 5432 already in use** (very common if you already run Postgres locally). Pick another port
in `.env`:

```bash
POSTGRES_PORT=5433
DATABASE_URL=postgres://feedr:feedr_local_dev@localhost:5433/feedr_dev
```

Both must match. Then `npm run db:down && npm run db:up`.

**"Cannot connect to the Docker daemon"** — Docker Desktop isn't running. Start it and retry.

**Migrations fail / schema looks wrong** — nuke and rebuild; the volume is the only state:

```bash
npm run db:down          # or: docker compose down -v   (also deletes the volume)
docker volume rm agentive-feedr-pgdata
npm run setup
```

**The app boots but every page is empty** — the seed didn't run. `npm run db:seed`.

**`npm test` aborts with "TEST_DATABASE_URL is not set"** — your `.env` predates the split test
database. Copy the `TEST_DATABASE_URL` line out of `.env.example` into it; the database is
created on the next run.

**`npm test` fails on a fresh clone** — unit tests shouldn't; those are hermetic and do not read
your `.env`. If one does start depending on ambient environment, that's a bug in the test — mock
the env module instead (see `src/lib/admin/auth.test.ts` for the pattern). The *integration*
tests do need a database, and fail without `TEST_DATABASE_URL` by design — see "Running the
tests".

## What has and hasn't been verified

Being straight about this, because it was written in a sandbox and not on a Mac:

- ✅ **Migrations apply from zero** — all 11 migrations run in order against a clean Postgres 16,
  producing 11 tables.
- ✅ **The seed applies cleanly** and produces the coverage above: 2 multi-source clusters,
  3 confidence levels, 1 caveat, 10 reels with a skill and 6 without, 1 active supersession
  notice, 0 write-ups (the placeholder path, on purpose), 4 skill nodes of which 3 have progress
  rows — i.e. all four ring states.
- ✅ `npm run build` and the full test suite are green on this codebase.
- ✅ **`npm test` no longer touches the dev database** (2026-07-27) — verified against a real
  Postgres 16 with both databases present: seeded `feedr_dev`, ran the full suite (60 files,
  374 tests, green, `feedr_test` auto-created and migrated to 11 tables), and re-counted
  `feedr_dev` afterwards — identical. Both abort paths were exercised too: a missing
  `TEST_DATABASE_URL` and one pointing at `feedr_dev` each stop the run before any test starts.
- ❌ **The Docker path itself could not be exercised** — the sandbox blocks Docker Hub image
  pulls at the network-policy level, so `docker compose up` was never actually run end to end.
  The compose file is small and conventional, but **you are the first to run it**. If
  `npm run db:up` misbehaves, that's the least-tested step — say so and it'll get fixed.
- ❌ **Not tested on macOS or Windows** (this was a Linux container), so Docker Desktop specifics
  are unverified.
