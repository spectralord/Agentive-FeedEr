# Agentive-FeedEr — Architecture design & epics

- Date: 2026-07-21
- Status: for review / basis for implementation
- Related docs: `CONTEXT.md` (glossary), `docs/adr/0001`–`0006`

---

## 1. Purpose & vision

A personal web tool that keeps you on top of AI topics — focus on **new Claude
features** and **agentic AI use in development** — at a high signal level with
minimal effort, in a way that means you **actually apply** what you learn.

The value isn't in aggregating (anyone can do that), but in three things:

1. **Noise suppression** — substance instead of hype, relevant *to you*.
2. **Actionability** — every reel answers "what does this mean for me?".
3. **Retention & application** — from consumption to adoption (skill map).

Not commercial, primarily single-user; possibly shared internally with colleagues later.

## 2. Guiding principles (from the ADRs)

- **Curated sources** instead of the open web (ADR 0001).
- **Ingestion and enrichment decoupled** — costs stay controllable, raw data is kept
  (ADR 0002).
- **One structured LLM pass** per item, `null` instead of hallucination (ADR 0003).
- **Labels are derived views**, not stamped; `experimental` is a flag
  (ADR 0004).
- **Only sourced examples/actions** (ADR 0005).
- **All-in-one container** (Railway), same codebase locally & in the cloud (ADR 0006).

## 3. Tech stack

| Layer | Choice |
|---|---|
| App (frontend + backend) | **Next.js (React, TypeScript)**, mobile-first |
| Database | **Postgres** (managed, free tier e.g. Neon), **JSONB** for flexible metadata |
| ORM / migrations | **Drizzle** |
| AI | **Claude API via Anthropic SDK**; default model **Haiku** for enrichment (lightweight task, cheap), Opus only when needed |
| Scheduler | Daily cron job in the container |
| Hosting | **Railway** (app + cron + Postgres), locally via container as a transition |

## 4. System overview (data flow)

```
                (daily, cron)
  Sources  ──►  Ingestion  ──►  Raw Items (stored raw, deduplicated)
 (Registry)                          │
                                     │  only new items
                                     ▼
                              Enrichment (1 LLM pass, JSON schema)
                              + developer profile as context
                                     │
                                     ▼
                                   Reels  ──►  Feed UI (vertical, filtered)
                                     │            Today's Top-N (derived)
                                     │            Overview/SOTA/history (derived)
                                     │
                                     └──►  (Fast-Follow) Saves / Feedback / Resurfacing
                                     └──►  (Vision) Skill map, Deepening
```

## 5. Data model (starting point, deliberately extensible)

Core entities. The attribute set is extensible via `metadata JSONB` with no migration needed.

- **source**: `id`, `name`, `type` (rss | api | newsletter | …), `url`/config, `enabled`,
  `last_polled_at`.
- **raw_item**: `id`, `source_id`, `external_id` (for dedup), `title`, `raw_content`,
  `url`, `published_at`, `ingested_at`, `enriched_at` (nullable → "not yet enriched").
- **reel**: `id`, `raw_item_id`, `summary`, `example` (nullable), `action` (nullable),
  `effort_tag` (nullable), `category`, `maturity`, `experimental` (bool),
  `relevance_score`, `quality_score`, `skill` (nullable, → skill_node),
  `topic_cluster_id` (nullable, for later bundling), `metadata JSONB`.
- **skill_node** *(Vision)*: `id`, `name`, `theme/cluster`, description.
- **user_progress** *(Vision)*: `skill_node_id`, `status` (seen | tried |
  mastered), `note`, `updated_at`.
- **interaction** *(Fast-Follow)*: `id`, `reel_id`, `type` (save | hide | up | down),
  `created_at`.

**Labels** (new/SOTA/best practice) are **not** columns — they are queries over the
facts above (ADR 0004). `topic_cluster_id` exists in the MVP schema but is only actively
used once content clustering (Vision) lands.

## 6. Enrichment contract (one LLM pass)

**Input:** one raw item + the developer profile (as context).
**Output:** a JSON object following a strict schema, including:
`summary`, `category`, `maturity`, `experimental`, `relevance_score`, `quality_score`,
`example|null`, `action|null`, `effort_tag|null`, `skill|null`.

Rules:
- `example` and `action` only if supported by the source — otherwise `null` (ADR 0005).
- `quality_score` rates substance vs. hype; low ⇒ hidden in the standard feed,
  never deleted.
- `relevance_score` rates against the developer profile.

## 7. Developer profile

A hand-maintained file (e.g. `profile.md` / DB entry) with stack, tools,
seniority level, interests, "what annoys me". Goes into every enrichment pass as
context. No ML, no tracking. Later (Fast-Follow) a rolling summary of the
interactions (save/hide/👍👎) supplements this context.

## 8. UI views

- **Feed** — vertical scroll-snap, mobile-first, newest first, source link per reel,
  filters (e.g. "new only", "Claude features only"), toggle "show weak signal".
- **Today's Top-N** — derived view, default 3, ranking `relevance × quality ×
  recency`.
- **Overview / SOTA / history** — derived view with filters by date/age/
  relevance; "what is currently state of the art".
- **Saves/Interests** *(Fast-Follow)*.
- **Skill map** *(Vision)* — skill nodes in theme clusters, progress per node,
  self-confirmation + adoption log.

## 9. Costs

- Scraping/polling: practically free (some network + minimal CPU).
- Hosting: Railway hobby tier (~$5/month), dominates costs.
- LLM: only new items, Haiku, batched ⇒ cents per day.

---

## 10. Epics (integrative, buildable piece by piece)

Each epic is independently runnable/testable. Order = build order.
**MVP = Epic 0–4** (Epic 5 optional early, since it's nearly free).

### Epic 0 — Project skeleton *(MVP)*
Set up Next.js (TS) + Drizzle + Postgres + Anthropic SDK; container/Railway config,
local dev environment, `.env` handling, DB migration setup, "hello feed" page.
*Done when:* the app runs locally and is deployable, DB connected, empty feed page renders.

### Epic 1 — Ingestion *(MVP)*
Source registry (declarative source list), daily cron, feed/API fetch, dedup via
`external_id`, storage as `raw_item`. Starting set ~8–10 sources.
*Done when:* one cron run idempotently fills `raw_item` (no duplicates on a repeat run).

### Epic 2 — Enrichment *(MVP)*
Single-pass LLM enrichment with a JSON schema (ADR 0003), developer profile as context,
sourced-only (ADR 0005), `null` handling, only non-enriched items. Writes `reel`.
*Done when:* new raw items become validated reels; sourced fields filled, otherwise `null`.

### Epic 3 — Reel feed UI *(MVP)*
Vertical scroll-snap feed, mobile-first, reel card (summary, attribute badges,
example/action if present, source link), basic filters, "weak signal" toggle.
*Done when:* reels can be scrolled through smoothly vertically on iPad and filtered.

### Epic 4 — Today's Top-N *(MVP)*
Derived view of the N most important reels of the day (`relevance × quality × recency`),
N configurable (default 3).
*Done when:* a "today" view shows the top N over the same data as the feed.

### Epic 5 — Overview / SOTA / history *(near-MVP, optional early)*
Derived overview page with filters by date/age/relevance; "what is currently SOTA".
*Done when:* you can filter by time range/relevance and surface older items on purpose.

### Epic 6 — Saves, feedback & resurfacing *(Fast-Follow)*
`interaction` events (save/hide/👍👎), saves/interests page, rolling
interaction summary as additional enrichment context, spaced resurfacing of
saved reels ("already tried?").
*Done when:* reactions are stored and influence future relevance; a saves page exists.

### Epic 7 — Skill map *(Vision flagship)*
`skill_node` + `user_progress`; aggregate the `skill` tag from enrichment into nodes;
visual skill map (theme clusters, no hard prerequisites), progress
`seen → tried → mastered` via self-confirmation, adoption log.
*Done when:* reels collect under skill nodes; progress can be set and is visible.

### Epic 8 — Agentic deepening *(Vision)*
On-demand follow-up research on a reel/topic; further enriches the same reel object
(uses stored raw data + targeted new fetches).
*Done when:* a "deepen" click delivers a deeper, sourced write-up.

### Further vision (not scheduled)
Content clustering (content model C, activate `topic_cluster`), audio mode (TTS),
team feed / shared saves, LLM-generated examples as an optional extension of ADR 0005.

---

## 11. Open points (deliberately later)

- **Concrete presentation of the examples** (incentive to try it yourself, "what's
  possible" preview) — format still open, deliberately not pinned down in advance.
- **Final source list** — starting set is set, will be made concrete while building Epic 1.
- **Ranking formula** for Top-N — set starting weights in Epic 4, adjust later.
- **Auth/sharing with colleagues** — only relevant once single-user becomes "shared internally".
