# Agents

Project agents for Claude Code, committed so they travel with the repo and stay in sync with the
design they enforce — unlike a prompt pasted into a chat, which drifts the moment the design moves.

| Agent | Role | Writes files? |
|---|---|---|
| `design-review` | Checks the implemented frontend against the accepted design. Reports conformance findings plus a separate "design drift" section for cases where the *spec* looks wrong rather than the code. | No — read-only by design |
| `design-partner` | Proposes and iterates UI/UX and gamification design, builds interactive prototypes, grills decisions, records outcomes as spec sections and ADRs. | Yes — docs and prototypes only, never production code |

## How to use them

**Ask by name** (most reliable):

> Use the design-review agent on the Reel card

> Have design-partner design the Archive view

**Or just describe the task.** Each agent's `description:` field is written as *"use this
when…"*, so the main session can route to it on its own. Naming it removes the guesswork.

Give it a **scope**. "Review the frontend" works but produces a broad sweep; "review /skills
against the spec" produces something you can act on in one sitting.

### Seeing the actual rendering

`design-review` can compare **screenshots** of the built app against the prototypes, not just read
source. That needs a one-time opt-in, because Playwright is not a committed dependency:

```bash
npm i -D playwright && npx playwright install chromium
```

Then it (or you) can run:

```bash
node scripts/design-screenshot.mjs http://localhost:3000/ --vp phone --vp desktop
node scripts/design-screenshot.mjs docs/specs/prototypes/nav-ia.html --vp phone
```

The script also flags body-level horizontal overflow, which a viewport-clipped screenshot hides
and which is this project's most common mobile bug. It must be installed **in the project** — a
global install does not work, since Node ignores global roots when resolving ESM imports.

Without it, the agent falls back to a source-only review and is instructed to label its findings
"not visually verified" rather than overstate what it checked.

### Smoke test

To confirm they are wired up at all, ask for something with a known answer:

> Use design-review to check only one thing: whether globals.css still overrides the Geist font

It should find the `body { font-family: Arial… }` override (spec §1, "fix this first") or report
that it has already been fixed. If it instead asks what you mean, or reviews something else,
the agent is not being picked up — check that you are running from the repo root and that
`.claude/agents/*.md` is present.

## What an agent actually gets

This is the thing worth understanding, because it explains why the definitions look the way they do:

**An agent starts cold.** It does not inherit your conversation, your open files, or anything you
just explained. It receives exactly two things — its own `.md` body, and the task sentence you
give it. Everything else it must go and read.

That is why the definitions spell out **explicit paths** to the spec, the prototypes, and the
ADRs, and why both agents are told to read `CLAUDE.md` themselves rather than assume it was
provided. It is also why they are told to **stop and say so if a path is missing** instead of
guessing: reviewing against a remembered baseline is worse than not reviewing.

They also do **not** run on their own. Nothing happens automatically on commit or on save — you
invoke them.

## Why the two are split

The reviewer is deliberately read-only. An agent that both judges and fixes tends to rationalise
what it just wrote; separating them keeps the review honest and the fixes attributable.

The reviewer's most valuable output is not "this padding is wrong" — it is **"the spec and the
accepted prototype disagree here, and a human needs to decide which is right."** That has already
happened twice in this project (the spec claimed the To-Try box stays on the Compact card when the
accepted prototype has none; an ADR prescribed auto-hide-on-scroll for a snap-paged feed where it
does not work). Both were caught late, by a human. The reviewer exists to catch the third one.

If you do want it to apply fixes, add `Write, Edit` to its `tools:` line — but prefer keeping them
split and handing findings to a separate implementation pass.

## Changing an agent

Edit the `.md` and commit. No build step. Two fields matter most:

- **`description:`** — this is what the main session reads to decide whether to delegate. Phrase
  it as *when to use this*, not as a title.
- **`tools:`** — least privilege. `design-review` has no `Write`/`Edit` on purpose.

If you find yourself pasting design *facts* into an agent, put them in `docs/` instead and point
at them. The agents deliberately carry only **method and judgment**; the facts live in the spec
and the ADRs. That is what keeps them short enough to actually be followed, and lets the design
move without rewriting them.

## Where the actual design lives

- `docs/specs/2026-07-24-ux-gamification-design.md` — the standing design
- `docs/specs/prototypes/` — three accepted interactive prototypes; the visual source of truth
- `docs/adr/0016`–`0023` — binding decisions and their rationale
- `docs/adr/README.md` — ADR numbering rules (parallel sessions have collided before)
