# Epic 8 — Agentic deepening (Vision)

**Goal:** A "Deepen" button per reel: on demand, an agent researches the topic
further and enriches **the same reel object** (ADR 0003: the JSON object is the
docking point). Dogfooding of the product's own theme.

**References:** ADR 0001/0003/0005, glossary: Vertiefen (deep dive).

---

## Guardrails (binding)
- **Source whitelist:** the agent may only fetch: (a) the reel's original URL,
  (b) links found in the original article, (c) domains from the source registry.
  No open web search (deliberate — ADR 0001 applies here too).
- **Sourced-only still applies:** the deep dive cites/paraphrases what it fetched
  and lists every URL used; no unsupported claims.
- Model: `env.DEEPEN_MODEL` (default `claude-sonnet-5`), budget: max. 5 fetches,
  max. 2 agent rounds.

## Tasks

### ☐ T8.1 — Fetch utility with whitelist (`src/lib/deepdive/fetch.ts`)
- `fetchAllowed(url, reel)`: checks the URL against the whitelist rule above; loads
  HTML, extracts the main text (simple approach: strip tags, cap at 20,000
  characters); timeout 15s. Disallowed URL ⇒ error with a clear message.
- **Verification:** unit tests of the whitelist (allowed/forbidden) with mocked fetches.

### ☐ T8.2 — Deep-dive runner (`src/lib/deepdive/run.ts`)
- Agent loop with the SDK (tool `fetch_page(url)` → T8.1):
  system prompt: "Deepen this reel for the developer profile. Use fetch_page on the
  original article and its outbound links (max 5). Then produce…" →
  final tool `submit_deep_dive` with schema:
  `{ content: string (Markdown, 300–600 words), key_takeaways: string[3–5], sources: string[] (all URLs used) }`.
- Write the result, after zod validation, into `reels.metadata.deep_dive =
  { ...output, created_at }` (re-run overwrites).
- **Verification:** integration test with a mocked SDK (tool-use round simulated).

### ☐ T8.3 — API + UI
- `POST /api/reels/[id]/deepen` → run the runner synchronously (container, no
  serverless limit, ADR 0006; UI shows a "researching…" spinner, timeout hint from 60s on).
- ReelCard: button "🔍 Deepen"; if `metadata.deep_dive` exists, show "View deep dive"
  instead → expandable section (Markdown rendered, takeaways, source list) + button
  "Deepen again".
- **Verification:** end-to-end on a real reel (1 API spend), manually check the
  result for source fidelity and note it here.

---

## Completion criteria (epic DoD)
- Deepening delivers a sourced, source-listed write-up into the same reel;
  whitelist demonstrably effective; repeatable without duplicate ingestion.

## Deviations/Questions
_(to be maintained by the executing model)_
