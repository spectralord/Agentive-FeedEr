# Epic 2 — Enrichment (MVP)

**Goal:** Every new raw item becomes a reel in **one** structured LLM pass —
with the developer profile as relevance context, the sourced-only rule, and `null`
instead of guessing.

**References:** ADR 0002 (only new items), ADR 0003 (single pass, JSON schema),
ADR 0005 (sourced-only), glossary: Enrichment, Reel, Attribute, Developer profile.

---

## Tasks

### ☑ T2.1 — Schema: `reels`
```ts
export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  rawItemId: integer("raw_item_id").notNull().references(() => rawItems.id).unique(),
  summary: text("summary").notNull(),                       // German, 2–4 sentences
  category: text("category", { enum: ["claude-feature","tooling","technique","industry-news","research","opinion"] }).notNull(),
  maturity: text("maturity", { enum: ["experimental","emerging","established"] }).notNull(),
  experimental: boolean("experimental").notNull().default(false), // impulse/toy flag (≠ maturity)
  relevanceScore: integer("relevance_score").notNull(),     // 0–100
  qualityScore: integer("quality_score").notNull(),         // 0–100
  example: text("example"),                                 // null if not sourced
  action: text("action"),                                   // null if not sourced
  effortTag: text("effort_tag", { enum: ["5-min-test","afternoon","know-only"] }),
  skill: text("skill"),                                     // English slug, e.g. "agentic-tool-use"
  topicClusterId: integer("topic_cluster_id"),              // reserved (Vision), always null in the MVP
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- Invariant: `action == null ⇒ effortTag == null`.
- Generate + run the migration. **Verification:** migration green.

### ☑ T2.2 — Developer profile (`/profile.md`)
Create a template (the user fills in/refines it later — note as a **user action**):

```md
# Developer profile
## Stack & tools
TypeScript, React/Next.js, Node; Claude Code (web/CLI); GitHub.
## Role & level
Experienced developer; leads/mentors teammates.
## Interests (highly relevant)
New Claude features; agentic workflows in development; MCP; prompt/context engineering; practical best practices.
## Less relevant
Pure ML research/mathematics; non-dev AI news (art, consumer apps); crypto.
## What annoys me
Marketing hype with no substance; clickbait; "Top 10 tools" listicles.
```
- Loader `src/lib/enrichment/profile.ts`: reads the file, throws a clear error if missing.
- **Verification:** unit test for the loader.

### ☑ T2.3 — Output contract: zod + JSON schema (`src/lib/enrichment/schema.ts`)
- zod schema `ReelOutput` mirroring T2.1 exactly (fields: `summary`, `category`,
  `maturity`, `experimental`, `relevance_score`, `quality_score`, `example|null`,
  `action|null`, `effort_tag|null`, `skill|null`).
- Additionally `.refine`: score ranges 0–100; `action === null ⇒ effort_tag === null`.
- From that (maintained manually, alongside), the JSON schema object for the tool call.
- **Verification:** unit tests: a valid object passes; violations (score 101,
  effort without action) fail.

### ☑ T2.4 — Prompt builder (`src/lib/enrichment/prompt.ts`)
System prompt (English, to the same effect — the executing model may fine-tune the
exact wording, the **rules are binding**):
- Role: "You turn one raw AI-news item into one structured 'reel' for a developer."
- **Sourced-only:** `example` and `action` MUST only contain what is supported by the
  source text. If the source contains no usable example/action, return `null`. Never invent.
- `summary`: German, 2–4 sentences, factual, no hype language.
- `action`: German, one concrete sentence ("Try X…", "Replace Y…"), only if sourced.
- `effort_tag`: estimate only when `action` is set: `5-min-test` (can be tried
  immediately), `afternoon` (needs a block of time), `know-only` (just knowledge,
  nothing to do).
- `skill`: short English kebab-case competency slug (e.g. `agentic-tool-use`,
  `prompt-caching`, `mcp-servers`) or null if no clear competency.
- Scoring rubrics (include verbatim in the prompt, binding):
  - `quality_score`: 0–30 marketing/hype/no content · 40–60 some substance, little
    concrete · 70–100 concrete, technical, verifiable/traceable.
  - `relevance_score`: against the supplied profile; 0–30 outside the interests ·
    40–60 peripheral · 70–100 core interest.
- `experimental`: true if the content is an impulse/experiment/"just tried this"
  (independent of maturity).
- User content: profile text + source (name), title, URL, publishedAt, rawContent.
- **Verification:** snapshot test of the built prompt.

### ☑ T2.5 — Enrichment runner (`src/lib/enrichment/run.ts`)
`runEnrichment()`:
1. Select `raw_items` with `enriched_at IS NULL AND enrich_error IS NULL`,
   order `published_at ASC`, limit `env.MAX_ENRICH_PER_RUN`.
2. Per item: `callStructured` (T0.5) with model `env.ANTHROPIC_MODEL` →
   zod validation → insert into `reels` + `enriched_at = now()` (in one transaction).
3. Error path: 1× retry; afterward set `enrich_error` (the item is never retried
   again, never shows up in the feed) and continue.
4. Return/log: `{ processed, succeeded, failed }`.
- **Verification:** integration test with a mocked Claude call (valid + invalid
  response): valid ⇒ a reel exists; invalid 2× ⇒ `enrich_error` set, no reel;
  second run processes 0 items (idempotency).

### ☑ T2.6 — Hook into the daily job
- `src/jobs/daily.ts`: call `runEnrichment()` after ingestion; log an overall summary.
- **Verification (real, small API spend):** `MAX_ENRICH_PER_RUN=5 npm run job:daily`
  with a real API key; spot-check 5 reels: German summary, plausible
  scores, `example/action` only if genuinely supported by the source text (proofread
  manually!). Note the spot-check result here in the file.

---

## Completion criteria (epic DoD)
- Pipeline end-to-end: new raw items ⇒ validated reels; exactly 1 LLM call per item.
- No reel without a source item; no second processing attempt on completed items.
- Sourced-only spot check documented. Build + tests green.

## Deviations/Questions
- **Addition to T2.5 (deliberate improvement):** API/infrastructure errors
  (`Anthropic.APIError`: auth, rate limit, 5xx) do **not** set `enrich_error`,
  but abort the run — the items stay untouched and get retried on the
  next run. Only content errors (schema validation after
  retry) permanently mark an item. Prevents e.g. a missing
  API key from poisoning the entire queue. Covered by an integration test.
- **T2.6 real run still open (user action):** the build environment has no
  real `ANTHROPIC_API_KEY`. The spot-check run
  (`MAX_ENRICH_PER_RUN=5 npm run job:daily`) must be done on the first run with a real
  key (local/Railway) and the result noted here. The code path is
  fully verified via integration tests with a mocked Claude call.
