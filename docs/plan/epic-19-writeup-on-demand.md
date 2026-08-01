# Epic 19 — On-demand Write-up generation (ADR 0024)

> **Status: PLAN, ready to delegate.** Written 2026-08-01 by the strong model.
> Implementation target: **Sonnet subagent**, branch `claude/epic-19-writeup`.
> **Binding work rules: `docs/plan/README.md` §1.** Read them before starting.

**Goal:** the Reel Detail **Write-up tab** currently shows a labelled placeholder for every Reel,
because `reels.writeup` is `NULL` everywhere. Give the reader a **"Generate write-up"** button that
fills it for that one Reel, on demand, using the **Claude Code subscription** — never the paid API.

**References (read these first, in this order):**
- **ADR 0024** — the decision this epic implements. All six decisions are binding.
- **ADR 0017** — accepted; decisions 2–4 define the pass (decoupled, sourced-only from stored
  `raw_content`, executor seam). Its "Open questions" section records why generation is
  user-triggered rather than batch.
- **ADR 0015** — the executor seam. **Binding.** Every LLM step goes through an injected `Executor`.
- **ADR 0003** (null over hallucination), **ADR 0005** (sourced-only).
- `src/lib/verifier/run.ts` — **copy this module's shape.** It is the closest existing pass.

---

## What already exists (do not rebuild)

Verified 2026-08-01:

| Thing | Where | State |
|---|---|---|
| `reels.writeup` column | `src/db/schema.ts` (nullable `text`) | **exists** — no migration needed |
| Write-up tab + placeholder | `src/components/ReelDetail.tsx:68-97` | exists; renders prose when non-null, placeholder when null |
| `writeup` on the read model | `src/lib/feed.ts`, `reelDetailData.ts` | already selected and surfaced |
| Executor seam | `src/lib/executor/executor.ts` — `getExecutor(config)` returns `Executor` | exists |
| Profile resolution + guard | `src/lib/executor/config.ts` — `resolveExecutionConfig(env())` **throws** on `local`+`api` | exists |
| Claude Code executor | `src/lib/executor/claudeCode.ts` — spawns the `claude` CLI | exists |
| Wiring precedent | `src/lib/pipeline.ts:53` — `getExecutor(resolveExecutionConfig(env()))` | copy this line |

**So the net-new work is: one module, one route, one button, and the tests.**

---

## Tasks

### ☐ T19.1 — `src/lib/writeup/prompt.ts` + `schema.ts`

**Do:**
- `schema.ts`: a zod schema and its JSON-schema twin, mirroring
  `src/lib/verifier/schema.ts` exactly in structure. Shape:
  `{ writeup: string | null }`. **Nullable on purpose** — ADR 0003: if the stored source content is
  too thin to elaborate on honestly, the model must return `null`, not padding.
- `prompt.ts`: `WRITEUP_SYSTEM_PROMPT`, `WRITEUP_TOOL_NAME`, `buildWriteupUserPrompt(input)`.
  Follow `src/lib/verifier/prompt.ts` for the input-type + builder split.
- The system prompt **must** state: elaborate only on what the supplied source content says; add no
  claims, no outside knowledge, no invented examples (ADR 0005); return `null` rather than padding;
  a few paragraphs, plain prose, no headings.
- Input to the builder: the Reel's `summary`, `title`, source name, and the **stored**
  `raw_items.raw_content`. **Never fetch anything** (ADR 0024 decision 5 — that is Deep-Dive's job,
  a different feature).

**Verify:** `npx tsc --noEmit` clean. No test needed for pure constants.

---

### ☐ T19.2 — `src/lib/writeup/run.ts`: the generation function

**Do:**
- Export `StructuredCaller` typed exactly as in `src/lib/verifier/run.ts:23-27`.
- `generateWriteup(input, caller: StructuredCaller = callStructured): Promise<{ writeup: string | null }>`
  — call the caller with `{ system, user, toolName, inputSchema }`, then **zod-parse the result**
  (never trust it raw). Same six lines as `checkReel` in `verifier/run.ts:38-50`.
- `runWriteupForReel(db, reelId, caller): Promise<WriteupResult>` — load the Reel joined to
  `raw_items` (for `raw_content`) and `sources` (for the name); if the Reel does not exist, return a
  not-found result rather than throwing; call `generateWriteup`; on a non-null result write
  `reels.writeup`; on `null` leave the column untouched.
- **Idempotency:** if `reels.writeup` is already non-null, return early without calling the model
  (ADR 0024 decision 4 — one-shot per Reel, cached for good).
- Result type: `{ status: "generated" | "already-present" | "not-found" | "empty" | "failed"; }`
  — the route maps this to UI state, so make the states explicit rather than boolean.

**Constraints:**
- **No `anthropicClient()`, no `@anthropic-ai/sdk` import, no `callStructured` invoked directly** —
  only as the injected default. (ADR 0015. `src/lib/enrichment/run.ts` imports the SDK for an
  `Anthropic.APIError` check; **do not copy that** — it is a known seam leak recorded in
  `docs/2026-08-01-sweep-findings.md`.)
- Per-item try/catch. Never throw out of the runner for content-level problems; return `"failed"`.

**Verify:** unit test `run.test.ts` with a **mocked caller** (no network, no DB): asserts the caller
receives the built prompt, that a valid response is parsed, that a schema-invalid response is
rejected, and that `null` yields `"empty"` and writes nothing.

---

### ☐ T19.3 — `POST /api/reels/[id]/writeup`

**Do:**
- Route handler at `src/app/api/reels/[id]/writeup/route.ts`. `export const dynamic = "force-dynamic"`.
- Resolve the executor **exactly** as `pipeline.ts:53` does:
  `const executor = getExecutor(resolveExecutionConfig(env()))`, then pass it as the caller.
- **Cloud guard (ADR 0024 decision 3):** if the resolved executor is `api`, return **503** with a
  clear message and do not call the model. The `claude` CLI only exists on the app host; under
  `APP_PROFILE=cloud` this feature cannot work and must fail explicitly rather than mysteriously.
- Return JSON (`{ status }` from T19.2) — this one is called by a client component, so JSON, not the
  form-POST-and-redirect pattern the `/skills/[slug]/progress` route uses.
- No auth (single-user MVP, `docs/plan/README.md` §2).

**Verify:** `npm run build` clean. Manual: `curl -X POST localhost:3000/api/reels/1/writeup` with the
dev server running returns a JSON status.

---

### ☐ T19.4 — The button in the Write-up tab

**Do:**
- In `src/components/ReelDetail.tsx`, inside the **existing** `writeup === null` branch
  (currently lines 76-97, the placeholder block), add a **"Generate write-up"** button.
- Three visible states: idle → **pending** ("Generating…", disabled) → done (re-render with prose) or
  **error** (a short honest message + the button re-enabled to retry).
- On success, refresh the server data so the tab shows the real prose. `ReelDetail` is a client
  component; use `router.refresh()`.
- **Keep the existing placeholder copy above the button.** It is deliberate, honest, and already
  worded correctly — and note it must contain **no ADR/epic numbers** (design doc §10.7; a leaked
  "(ADR 0017)" was removed on 2026-08-01, do not reintroduce it).
- **Styling (ADR 0016 — binding, one meaning per colour):** this is a neutral action. Use
  `--accent` (links/focus/tried) or plain ink/surface tokens. **Do not use `--caution`** (reserved
  for caveat + freshness/supersession only) and **not `--gold`** (mastered only). **Use design tokens,
  not raw `zinc-*`/`amber-*`/`emerald-*` literals.**
- **Touch target ≥ 40px** on both axes — the project has an existing floor and a fixed violation;
  `src/components/ReelActions.tsx:31-35` shows the `min-h-10 min-w-10 grid place-items-center`
  pattern that satisfies it.
- Hide the button entirely when the cloud guard would reject it, rather than showing a button that
  always 503s. Pass a boolean prop down from a Server Component that resolved the executor.

**⚠️ Trap — read before writing this:** `src/lib/env.ts` is a **server-only** module. Calling `env()`
from anything reachable inside a `"use client"` component throws during hydration. This has bitten
the project **six times**. Resolve the profile in a Server Component and pass the result down as a
plain prop. `import type` is always safe.

**Verify:** `npm run build` + `npm test` green, and — **required, not optional** —
```bash
npm run dev &
node scripts/design-screenshot.mjs http://localhost:3000/ --vp phone
```
then **open the PNG and look at it**. Two BLOCKERs once survived a green build, green typecheck and
363 passing tests in this project; screenshots caught both. Confirm: button visible in the tab, sane
size, no horizontal overflow, no white background.

---

### ☐ T19.5 — Pin the cloud guard with a test

**Do:** a test asserting the button/route is unavailable when the resolved executor is `api`.
Precedent for *why*: `src/lib/env.test.ts:56-65` pins the `APP_PROFILE` default for exactly this
reason — nothing else asserted it, so a silent flip would not have failed any test.

**Verify:** the test fails if the guard is removed. Check that by removing it temporarily.

---

## Definition of done

- [ ] `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `npm test` green — **≥ 377 tests** (the count at plan time; new tests raise it)
- [ ] `npx eslint src` reports **zero** problems (it is currently at zero — do not regress it)
- [ ] Screenshot reviewed at `--vp phone` (T19.4)
- [ ] A real end-to-end generation ran locally against one Reel and wrote prose into `reels.writeup`
- [ ] No new runtime dependencies
- [ ] Status table row updated in `docs/plan/README.md` §6

## Abweichungen / Fragen

*(Subagent: record deviations and questions here rather than guessing — `README.md` §1.4.)*

## Explicitly out of scope

- Any **batch** write-up pass. ADR 0017's open questions were resolved as user-triggered-only.
- Regeneration of an existing write-up (ADR 0024 open question, undecided).
- Model selection for the prompt (ADR 0024 open question — the executor decides).
- Experience Reports (they have no `raw_content` in this shape).
