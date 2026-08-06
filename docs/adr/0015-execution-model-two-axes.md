# ADR 0015 — Execution model: two axes (trigger x executor) + profiles

- Status: accepted (design grilled 2026-07-23; **implementation open**, build only on user go-ahead)
- Builds on: ADR 0003 (structured single pass, "null instead of hallucination"), ADR 0002
  (decoupled ingestion/enrichment), ADR 0006 (all-in-one container hosting), ADR 0010
  (admin/manual trigger). Implementation: Epic 17.

## Context / Problem

The pipeline's LLM work (enrichment, SkillTagger, clustering, knowledge check,
feedback summary) today runs via the **Anthropic API** with `ANTHROPIC_API_KEY` → consumes
**paid API tokens**. If **Claude Code quota** (subscription) is available, the same
work should optionally run **over that** (cost-neutral). Additionally, a **local**
operating mode should be possible that **never** interacts with Railway or the API.

## Decision

**Two orthogonal axes** control every run, bundled via environment **profiles**:

- **Axis 1 — trigger** (who kicks off the run): `railway-cron` | `claude-code-cron` | `manual`.
- **Axis 2 — executor** (what performs the inference): `api` (SDK + key) | `claude-code` (agent turn,
  quota).

**Profile matrix:**

| Profile | Trigger | Executor | DB | Railway | API |
|---|---|---|---|---|---|
| **local** | manual | `claude-code` | local | **never** | **never** |
| cloud · "Cloud" | `railway-cron` | `api` | Railway | yes | yes |
| cloud · "Claude Code Cron" | `claude-code-cron` | `claude-code` | Railway | yes | no |
| cloud · "Claude Code API" | `claude-code-cron` | `api` | Railway | yes | yes |

- **Excluded:** `railway-cron` + `claude-code` (Railway cannot consume CC quota).
- **`APP_PROFILE=local|cloud`** sets defaults; individual axes are overridable via env.
- **Amendment 2026-08-01 (user decision):** the **default** of `APP_PROFILE` is changed from
  `cloud` to **`local`** (`src/lib/env.ts`). The matrix above remains unchanged —
  `cloud` is still fully supported, but must be set **explicitly**. Reason: `cloud`
  implies `executor=api`, i.e. the **paid** API. An *unset* `APP_PROFILE` therefore
  meant "spend money and accept a cloud cron"; now it means Claude Code
  quota + manual trigger, which can do neither. Additional reason: the Railway deployment
  is currently dormant. The default is pinned in `src/lib/env.test.ts`, because the
  `resolveExecutionConfig` tests always pass `APP_PROFILE` explicitly, and a silent
  flip-back would otherwise break no test.
- **Hard guardrail for local:** zero API calls, **no silent API fallback**. If the
  CC path fails, it is aborted/skipped, never made up for via the API. `ANTHROPIC_API_KEY`
  is allowed to be unset.

**Executor seam + schema discipline:** the executor is the existing `StructuredCaller`
seam (enrichment/SkillTagger/clustering/knowledge check/feedback already use it). Alongside
the `ApiExecutor` (today), a `ClaudeCodeExecutor` is added: the agent processes a **batch**
in one turn and calls **one local tool `emit_reel(...)` per item**, which is
**server-side zod-validated and written** — the schema enforcement lives in the tool, not
in free text, so the "forced tool_choice" guarantee (ADR 0003, "null instead of
hallucination") is preserved per item. The executor is chosen **once** and injected at
**all** call sites (uniform, no mixing); build order is enrichment-first.

**Data path:** the Claude Code session accesses the DB **directly** (the same Drizzle
layer as the app) — the local DB in the local profile, the Railway DB in the cloud override.

## Alternatives

- **A single switch** (trigger and executor coupled): cannot represent "CC plans, but the
  API infers". Rejected — two axes are necessary.
- **Data access via admin-protected app endpoints** instead of direct DB: more moving
  parts, new API surface; unnecessary for a single-user tool. Rejected (F1).
- **Per-step executor configuration:** unnecessary config surface; uniform is enough. Rejected (F4).
- **Silent API fallback in CC mode:** would break the cost guarantee. Rejected (F4).

## Consequences

- New `StructuredCaller` implementation `ClaudeCodeExecutor` (batch + `emit_reel` tool).
- `env.ts`: `APP_PROFILE` + axis overrides + validation (reject the illegal combination
  `railway-cron`+`claude-code`; local ⇒ no API/no Railway).
- Claude Code routine as a scheduler option (for `claude-code-cron`).
- Local job entry point (`npm run job:cc` or similar) that runs without API/Railway.
- Implementation in **Epic 17**; stays parked until user go-ahead.
- Shares the Claude Code routine mechanics with the planned refactoring agent (Epic 16).
- **Binding follow-on convention (user, 2026-07-23):** *every* future AI feature is built via
  the executor seam and thus runs in **both** variants (`api` + `claude-code`) — never
  a direct API call in an LLM step. See CLAUDE.md → "design process".
