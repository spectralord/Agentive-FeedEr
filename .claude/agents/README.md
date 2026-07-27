# Agents

Project agents, invoked from Claude Code (`@design-review`, `@design-partner`, or by asking for
them by name). They are committed so they travel with the repo and stay in sync with the design
they enforce — unlike a prompt pasted into a chat, which drifts the moment the design moves.

| Agent | Role | Writes files? |
|---|---|---|
| `design-review` | Checks the implemented frontend against the accepted design. Reports conformance findings plus a separate "design drift" section for cases where the *spec* looks wrong rather than the code. | No — read-only by design |
| `design-partner` | Proposes and iterates UI/UX and gamification design, builds interactive prototypes, grills decisions, records outcomes as spec sections and ADRs. | Yes — docs and prototypes only, never production code |

## Typical use

**After building or changing UI:**
> Run design-review on the Reel card

**Before building a new surface:**
> Use design-partner to design the Archive view

## Why these are split

The reviewer is deliberately read-only. A single agent that both judges and fixes tends to
rationalise what it already wrote; separating them keeps the review honest, and keeps the fixes
attributable. The reviewer's most valuable output is not "this padding is wrong" — it is
"the spec and the accepted prototype disagree here, and a human needs to decide which is right."

## Where the actual design lives

The agents intentionally do **not** duplicate the design. They point at it:

- `docs/specs/2026-07-24-ux-gamification-design.md` — the standing design
- `docs/specs/prototypes/` — three accepted interactive prototypes; the visual source of truth
- `docs/adr/0016`–`0023` — binding decisions and their rationale
- `docs/adr/README.md` — ADR numbering rules (parallel sessions have collided before)

Keeping the facts in the docs and only the *method and judgment* in the agents means the agents
stay short enough to actually be followed, and the design can move without rewriting them.
