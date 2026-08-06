# Epic 1 — Ingestion (MVP)

**Goal:** Daily, idempotent intake of all curated sources as `raw_items` —
no AI, deduplicated, error-tolerant per source.

**References:** ADR 0001 (curated sources), ADR 0002 (decoupling), glossary:
Source, Ingestion, Raw Item.

---

## Tasks

### ☑ T1.1 — Schema: `sources` + `raw_items`
In `src/db/schema.ts`:

```ts
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type", { enum: ["rss", "hn_algolia", "reddit_rss", "github_releases"] }).notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").notNull().default({}),           // e.g. { query, minPoints }
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
});

export const rawItems = pgTable("raw_items", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  externalId: text("external_id").notNull(),               // GUID/link/API ID
  title: text("title").notNull(),
  url: text("url").notNull(),
  rawContent: text("raw_content").notNull().default(""),   // text/HTML excerpt
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),  // null = not yet enriched
  enrichError: text("enrich_error"),                       // set on a permanent error
}, (t) => [uniqueIndex("raw_items_source_external_uq").on(t.sourceId, t.externalId)]);
```
- Generate + run the migration.
- **Verification:** migration runs; unique index exists.

### ☑ T1.2 — Source registry (`src/lib/sources.ts`)
- Declarative array `SOURCE_REGISTRY: Array<{ name; type; url; config? }>` — **code is
  the source of truth**; a seed step upserts the registry into the `sources` table at
  job start (matched on `name`; the DB only holds state like `lastPolledAt`/`enabled`).
- Starting registry (⚠ = manually verify the URL during implementation, correct if
  needed, and document it here in the file; seed unreachable sources with `enabled:false`):

| name | type | url | config |
|---|---|---|---|
| simon-willison | rss | `https://simonwillison.net/atom/everything/` | — |
| hn-claude | hn_algolia | `https://hn.algolia.com/api/v1/search_by_date` | `{ "query": "Claude", "minPoints": 20 }` |
| hn-ai-agents | hn_algolia | ditto | `{ "query": "AI agent", "minPoints": 30 }` |
| reddit-claudeai | reddit_rss | `https://www.reddit.com/r/ClaudeAI/top/.rss?t=day` | — |
| reddit-localllama | reddit_rss | `https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day` | — |
| huggingface-blog ⚠ | rss | `https://huggingface.co/blog/feed.xml` | — |
| openai-news ⚠ | rss | `https://openai.com/news/rss.xml` | — |
| anthropic-news ⚠ | rss | _check: official feed; if none exists → `enabled:false` + note_ | — |
| claude-code-releases | github_releases | `https://github.com/anthropics/claude-code/releases.atom` | — |
| anthropic-sdk-releases | github_releases | `https://github.com/anthropics/anthropic-sdk-typescript/releases.atom` | — |
| latent-space ⚠ | rss | `https://www.latent.space/feed` | — |

- **Verification:** run the seed function twice ⇒ no duplicates in `sources`.

### ☑ T1.3 — Fetchers (one module per `type`, shared interface)
`src/lib/ingestion/fetchers/*.ts`, all with the signature
`fetchItems(source): Promise<NormalizedItem[]>` and
`NormalizedItem = { externalId; title; url; content; publishedAt }`:
- **rss / github_releases / reddit_rss:** via `rss-parser` (`guid ?? link` as
  `externalId`; `contentSnippet`/`content` as `content`, capped at 8,000 characters).
  For Reddit, set a custom `User-Agent` header (`agentive-feeder/1.0`).
- **hn_algolia:** `GET {url}?tags=story&query={config.query}&numericFilters=points>{config.minPoints}`;
  `externalId = objectID`, `url = story URL ?? HN item link`, `content = title` (+ `story_text` if present).
- All fetchers: 15s timeout, throw errors (handling is done by the runner).
- **Verification:** unit tests with fixture data (stored example XML/JSON responses,
  no network calls in the test).

### ☑ T1.4 — Ingestion runner (`src/lib/ingestion/run.ts`)
`runIngestion()` flow:
1. Registry seed (T1.2).
2. For each `enabled` source: call the fetcher → insert items with
   `onConflictDoNothing` on `(source_id, external_id)` → set `lastPolledAt`.
3. try/catch **per source**; collect results.
4. Return + log: `{ perSource: [{ name, fetched, inserted, error? }], totalInserted }`.
- Items older than 30 days (publishedAt) are skipped (first-run flood protection).
- **Verification:** integration test against a local DB with mocked fetchers:
  running twice ⇒ second run `inserted = 0` (idempotency).

### ☑ T1.5 — Job entry point (`src/jobs/daily.ts`)
- Calls `runIngestion()`, logs a summary, `process.exit(0)`
  (exit code 1 only if **all** sources fail).
- Placeholder call to `runEnrichment()` (comes in Epic 2) as a commented-out TODO.
- **Verification:** `npm run job:daily` locally against real feeds: at least 3 sources
  deliver items; running again inserts 0 duplicates.

### ☑ T1.6 — Source verification (partly a user action)
- Actually check every ⚠ URL (fetch + parse). Record the result in the T1.2 table
  (URL corrected / `enabled:false` + reason).
- **User action:** have the final source list briefly confirmed.

---

## Completion criteria (epic DoD)
- One `npm run job:daily` idempotently fills `raw_items` from ≥ 6 working sources.
- The failure of one source doesn't abort the run and gets logged.
- Build + tests green.

## Deviations/Questions
- **T1.5/T1.6 — live verification only partially possible:** the build environment
  (sandbox) only allows outbound access to GitHub hosts; all other feeds respond here
  with a proxy 403. Successfully verified live: `claude-code-releases` and
  `anthropic-sdk-releases` (10 items each, 2nd run 0 inserts ⇒ idempotency actually
  confirmed). The remaining URLs are **not** marked as broken — they need to be
  double-checked on the first run in an environment without an egress block
  (local/Railway). ⇒ **User action:** check the log of the first Railway/local run.
- `anthropic-news` (⚠ without a confirmed feed URL) is not yet in the registry —
  add it once a verifiable URL is available.
- Atom feeds: `externalId` uses `item.id` (Atom) or `guid` (RSS), fallback link.
- The DoD criterion "≥ 6 working sources" cannot be conclusively checked from within
  the sandbox (only 2 GitHub sources reachable); the code path for all
  types is covered by fixture and integration tests.
