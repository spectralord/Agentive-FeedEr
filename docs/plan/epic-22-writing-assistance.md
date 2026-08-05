# Epic 22 — Writing assistance for user-authored prose (ADR 0026)

> **Status: PLAN, ready to delegate.** Written 2026-08-03 by the strong model.
> Implementation target: **Sonnet subagent**, branch `claude/epic-22-writing-assistance`.
> **Binding work rules: `docs/plan/README.md` §1.** Read them before starting.

**Goal:** when the owner writes an Experience Report, offer optional help improving the prose they
typed. The service suggests; the author accepts or rejects. Nothing is rewritten automatically and
nothing is saved before acceptance.

**References (read first, in this order):**
- **ADR 0026** — the decision this implements. Decisions 1–5 **and the "Grill outcome" section**
  are binding; that section resolves all six former open questions and narrows the scope. Do not
  work from the pre-grill text alone.
- **ADR 0015** — the executor seam. **Binding.** Injected `Executor`, zod-validated output, unit
  test with a mocked caller.
- **ADR 0024** — the precedent this copies exactly: user-triggered, local-profile-only, cloud guard.
- **ADR 0005** (sourced-only) — see the boundary note in T22.1.
- `src/lib/writeup/` — **copy this module's shape.** Closest existing analogue, same trigger model.

---

## What already exists (do not rebuild)

Verified against the code on 2026-08-03:

| Thing | Where | State |
|---|---|---|
| The one real consumer | `src/app/experience/new/page.tsx`, `.../[id]/edit/page.tsx` | **ships today** |
| The prose field | `experience_reports.body` (`text NOT NULL`) | exists; `title` is one line and is **out of scope** |
| Form submit path | plain `<form action="/experience/create" method="post">` → `src/app/experience/create/route.ts` | **no client JS today** — see the trap below |
| Executor seam | `getExecutor(resolveExecutionConfig(env()))` | exists; `create/route.ts` already calls it for `tagSingle` |
| Cloud guard precedent | `writeupGenerationAvailable()` in `src/lib/writeup/run.ts` | copy this shape |

**Guide editing is NOT a consumer.** There is no `skill_guides` table and ADR 0018's build is gated.
Do not build a second affordance for it, and do not generalise the UI "ready for guides" — the
module is reusable, the UI is not being pre-wired (ADR 0026 grill outcome).

---

## Tasks

### ☐ T22.1 — `src/lib/writing/` — prompt, schema, and the assist function

**Do:**
- `schema.ts`: zod schema + JSON-schema twin. Shape: **`{ revised: string }`**. Validation is
  deliberately thin — ADR 0026 open question 6 records why (free prose cannot be meaningfully
  validated beyond "non-empty string"; a rationale field was considered and rejected as
  unverifiable prose validating unverifiable prose). Do not "improve" this by adding fields.
- `prompt.ts`: `WRITING_SYSTEM_PROMPT`, `WRITING_TOOL_NAME`, `buildWritingUserPrompt(input)`.
  Two intents only: **`"improve"`** and **`"shorten"`** (ADR 0026 open question 1). Model the intent
  as a discriminated string parameter, not free text.
- The system prompt **must** state: improve *how* the author said it, never introduce facts, claims
  or examples the author did not write; preserve their meaning and voice; return the full revised
  text, not a diff or commentary.
- `assistWriting(input, caller: StructuredCaller = callStructured)` — call, then **zod-parse**.
  Same six-line shape as `generateWriteup` in `src/lib/writeup/run.ts`.

**Sourced-only boundary (ADR 0005 / ADR 0026 decision 5) — the input is the author's own text and
nothing else.** No Reel content, no `raw_content`, no node data. This is what keeps the boundary
trivially safe: the service never sees source material, so it cannot leak an unsourced claim from
one. Do not add context "for coherence".

**Verify:** unit test with a **mocked caller** — asserts the built prompt carries the intent and the
author's text, that a valid response parses, and that a schema-invalid response is rejected.

---

### ☐ T22.2 — `POST /api/writing/assist`

**Do:**
- Route at `src/app/api/writing/assist/route.ts`, `export const dynamic = "force-dynamic"`.
- Body: `{ text: string, intent: "improve" | "shorten" }`. Reject empty text with 400.
- Resolve the executor exactly as `src/app/experience/create/route.ts` already does:
  `getExecutor(resolveExecutionConfig(env()))`.
- **Cloud guard (ADR 0024 decision 3, same reasoning):** if the resolved executor is `api`, return
  **503** and do not call the model. The `claude` CLI only exists on the app host.
- Returns JSON `{ revised }` — called from a client component, so JSON, not form-POST-and-redirect.
- **Nothing is written to the database by this route.** It is a pure suggestion endpoint
  (ADR 0026 open question 3: suggestions live in component state and are lost on navigation).

**Verify:** `npm run build` clean. Manual:
`curl -X POST localhost:3000/api/writing/assist -H 'content-type: application/json' -d '{"text":"i tryed the thing and it worked ok","intent":"improve"}'`

---

### ☐ T22.3 — The affordance on the Experience Report form

**⚠️ Read this before writing any code — it is the main design constraint of this epic.**
`/experience/new` is currently a **plain server-rendered HTML form with no client JS at all**
(`page.tsx` is a Server Component; the form does a native POST to `/experience/create`). Adding a
button that calls an API and mutates a textarea **requires client state**. Do not convert the whole
page to `"use client"`.

**Do:**
- Extract **only the body field** into a small client component (e.g.
  `src/components/AssistedTextarea.tsx`) that owns the textarea value plus suggestion state. The
  page, the `<form>`, the native POST and `/experience/create` all stay exactly as they are — the
  textarea keeps its `name="body"` so the plain form submit is unaffected.
- Below the textarea: two buttons, **"Improve"** and **"Make shorter"** (ADR 0026 open question 2 —
  one affordance below the field, **not** a toolbar, not inline decoration).
- States: idle → pending (disabled, "Working…") → **suggestion shown alongside the original with
  Accept / Discard**. Accept replaces the textarea value; Discard drops it. **Never replace the
  author's text without an explicit accept** (ADR 0026 decision 3).
- Hide the buttons entirely when the cloud guard would reject the call — resolve
  server-side (mirror `writeupGenerationAvailable()`) and pass a plain boolean prop down.

**⚠️ Trap:** `src/lib/env.ts` is **server-only**. Calling `env()` from anything reachable inside a
`"use client"` component throws during hydration — this has bitten the project **six times**.
Resolve on the server, pass plain props. `import type` is always safe.

**Styling (ADR 0016, binding):** neutral action → `--accent` or plain ink/surface tokens. **Not
`--caution`** (caveat/freshness only), **not `--gold`** (mastered only). **No raw
`zinc-*`/`amber-*`/`emerald-*` literals in anything you write.** Touch targets **≥40px** —
`src/components/ReelActions.tsx:31-35` shows the pattern.

**Verify:** `npm run build` + `npm test` green, **and required screenshots**:
```bash
npm run dev &
node scripts/design-screenshot.mjs http://localhost:3000/experience/new --vp phone
```
Then **read the PNG back and look at it**. Confirm: buttons visible and reachable, textarea still
usable, no horizontal overflow. Two BLOCKERs in this project once survived a green build and 363
passing tests; screenshots caught both.

**Also verify the plain form still works** — submit a report without touching the assist buttons and
confirm it saves. The native POST path must not regress.

---

### ☐ T22.4 — Pin the cloud guard

**Do:** a test asserting the route 503s and the buttons are hidden when the resolved executor is
`api`. Precedent: `src/lib/writeup/available.test.ts` and
`src/app/api/reels/[id]/writeup/route.test.ts`.

**Verify:** the test fails if the guard is removed — check by removing it temporarily.

---

## Definition of done

- [ ] `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `npm test` green — **≥ 475 tests / 72 files** at plan time; new tests raise it
- [ ] `npx eslint src` reports **zero** problems (currently zero — do not regress)
- [ ] Screenshot reviewed at `--vp phone` (T22.3)
- [ ] The plain (JS-free) form submit still works — verified manually
- [ ] A real assist call ran locally and returned revised prose
- [ ] No new runtime dependencies
- [ ] Status table row updated in `docs/plan/README.md` §6

## Abweichungen / Fragen

*(Subagent: record here rather than guessing — `README.md` §1.4.)*

## Explicitly out of scope

- **Guide editing.** No `skill_guides` table exists; ADR 0018's build is gated. Do not pre-wire it.
- **The `title` field.** One line, no assistance wanted.
- **A "continue writing" intent** — rejected in the grill: it drifts toward composing *for* the
  author, which decision 2's opt-in framing exists to avoid.
- **Persisting suggestions** before acceptance (open question 3).
- **Passing source material or node content as context** (open question 4) — this is what keeps
  ADR 0005 trivially satisfied.
- **ADR 0018's "flag when better content exists"** — the guide pipeline's job, not this service's.
