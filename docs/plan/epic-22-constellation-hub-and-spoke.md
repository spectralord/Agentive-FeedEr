# Epic 22 — Constellation rework: hub-and-spoke, visible edges, reachable edit mode

> **Status: PLAN, ready to delegate — but T22.1 is a DECISION, not code.**
> Written 2026-08-03 by the strong model, from owner feedback on the shipped Epic 21.
> Implementation target: **Sonnet subagent**, branch `claude/epic-22-constellation-rework`.
> **Binding work rules: `docs/plan/README.md` §1.**

**Goal:** the shipped constellation (Epic 21 stage a) renders stable positions but the owner
rejected its *look* after real use: no connections between nodes, dragging appeared broken, and the
dotted theme circles are unwanted. Replace the enclosing-circle reading with **one identifiable key
node per theme, with connections radiating to its member nodes**.

**References (read first, in this order):**
- **`docs/plan/epic-21-constellation-stage-a.md`** → section *"Owner feedback after first real use
  (2026-08-02) — REWORK NEEDED"*. That is the source of this epic.
- **ADR 0020** — accepted. **Decisions 6–9 matter here**, and decision 7 still gates the relaxation
  pass. Decision 8 already establishes **themes are the roots**, which is what makes the hub model a
  small step rather than a new concept.
- `docs/specs/prototypes/skill-constellation.html` — the accepted prototype. **It already defines
  what is missing**: `.link` (line 56) and `.link.hot`.
- **ADR 0016** (reserved colours), **ADR 0001** — not touched here, but see T22.5's boundary.

---

## What is actually true right now (verified 2026-08-03, do not re-derive)

| Claim from the feedback | Verified finding |
|---|---|
| "no connections between nodes" | **Correct.** `SkillConstellation.tsx` renders **zero** `<line>` elements. The prototype defines `.link` + `.link.hot` and the implementation never used them. |
| "i cant drag" | **Root cause found, and it is NOT the drag code.** Dragging is gated behind `editMode` (line 269), and the **"Edit positions" button is `hidden md:inline-flex`** (line 187) — invisible below 768px. The drag handlers, the position route and the reset button all work. **The toggle is simply unreachable at most window widths.** |
| "i dont like the circles around the nodes" | **Correct and intentional** — they are the prototype's own `.theme-ring` (`stroke-dasharray: 2 6`). Removing them therefore **supersedes the prototype**, which is why T22.1 exists. |

**Do not "fix the drag logic".** It is not broken. Fix the affordance (T22.3).

---

## Tasks

### ☐ T22.1 — Amend ADR 0020 first (STRONG MODEL / OWNER — not the subagent)

The hub-and-spoke model contradicts two things that are currently accepted:
- the prototype's `.theme-ring` (dotted enclosing circle), and
- ADR 0020 decision 1's framing of a theme as a *region* (centre + radius) rather than a *node*.

Per the project's standing rule — *where a design conclusion contradicts an earlier ADR, amend the
ADR* — this needs a **decision 10** recording: themes render as **first-class hub nodes** with
spokes to their members; the enclosing region circle is dropped; `THEME_LAYOUT`'s `cx/cy` becomes
the hub's own position and `r` becomes the spoke length / member placement radius rather than a
drawn boundary.

**Blocking.** Do not start T22.2–T22.5 before this lands, or the work contradicts an accepted ADR.

---

### ☐ T22.2 — Render theme hubs and spokes

**Do:**
- Draw one **hub node per theme** at its `THEME_LAYOUT` centre, visually distinct from a skill node
  (larger, and labelled with `THEME_LABELS[theme]`).
- Draw a **spoke** (`<line>`) from each hub to every member node of that theme. Reuse the
  prototype's styling: `stroke: var(--hairline-strong)`, `opacity: .35`, and `.link.hot` in
  `--accent` for the hovered/selected node's own spokes.
- **Remove the dotted `.theme-ring` circles** (per T22.1).
- Member positions keep coming from `resolveNodePosition` — **unchanged**. This task changes what is
  *drawn between* nodes, never where a node sits. Spatial memory (ADR 0020 decisions 2, 3, 9) must
  survive this epic intact.

**Scope boundary — read ADR 0020 decision 7 before writing any edge logic.** Hub→member spokes are
**structural** (a node belongs to exactly one theme) and need no relatedness signal, so they are in
scope. **Member↔member edges are OUT of scope**: they need co-occurrence, which is currently *one
pair corpus-wide*, and decision 7 gates that as stage (b). Drawing edges between members would be
the relaxation pass by another name.

**Verify:** `npm run build` + `npm test` green, then **required** screenshots at both viewports:
```bash
node scripts/design-screenshot.mjs http://localhost:3000/skills?view=constellation --vp phone --vp desktop
```
**Read both PNGs.** Confirm: every member has a visible spoke to its hub, hub labels legible at
375px, no spoke crosses a node ring, body overflow **0**.

---

### ☐ T22.3 — Make edit mode reachable (the real "can't drag" fix)

**Do:** the "Edit positions" toggle at line 187 is `hidden md:inline-flex`. ADR 0020 decision 5
gates *dragging* to desktop/iPad because it is fiddly on phones — it does **not** say the toggle
should be invisible on a narrow desktop window, which is what `md:` (768px) actually enforces.

- Show the toggle whenever a **fine pointer** is available rather than at a width breakpoint:
  `@media (pointer: fine)` / `(hover: hover)`. A 700px-wide desktop window has a mouse; a 900px
  tablet in portrait does not.
- Keep dragging itself gated behind edit mode (that part is correct and prevents accidental drags).
- When edit mode is on, make it visually obvious that nodes are now draggable rather than clickable.

**Verify:** with the dev server running, drag a node at a ~700px window width and confirm the
position persists across a reload. Also confirm a touch-only viewport does **not** show the toggle.

---

### ☐ T22.4 — Label crowding (carried over from the Epic 21 review)

The Epic 21 review recorded a MINOR: in the `agents` region, member labels extend outside their
circle and crowd the neighbouring region. With the circles gone (T22.2) the *visual* crowding
changes shape but the underlying cause does not — labels are placed without regard to the space
their theme owns.

**Do:** keep `assignLabelRows`' row-stacking (it works — measured zero overlaps), and additionally
constrain a label's horizontal extent to its theme's own space, or reveal full labels on
hover/focus only at high density. **Do not move nodes to make labels fit** — that would be a layout
pass (ADR 0020 decision 7).

**Verify:** screenshot at 375px; measure that no label's bounding box overlaps another's, as the
Epic 21 review did.

---

### ☐ T22.5 — Update the prototype OR record the divergence

The prototype is the source of truth on *look* (design-review agent's precedence rule). After
T22.2 the built constellation will deliberately differ from it.

**Do:** either update `docs/specs/prototypes/skill-constellation.html` to the hub-and-spoke model,
or add a short note at its top recording that it is superseded on this specific point by ADR 0020
decision 10. **Do not leave the two silently disagreeing** — that is the drift class this project
has been bitten by repeatedly.

---

## Definition of done

- [ ] ADR 0020 decision 10 exists (T22.1) **before** any code lands
- [ ] `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `npm test` green — baseline **472 tests / 72 files**, may only go up
- [ ] `npx eslint src` reports **zero** problems
- [ ] Screenshots read back at **both** phone and desktop; body overflow 0
- [ ] A node dragged at a ~700px width persists across reload
- [ ] Node positions are unchanged by this epic (spatial memory preserved)
- [ ] Prototype updated or divergence recorded (T22.5)
- [ ] Status row updated in `docs/plan/README.md` §6

## Abweichungen / Fragen

*(Subagent: record here rather than guessing — `README.md` §1.4.)*

## Explicitly out of scope

- **Member↔member edges / any relatedness-driven layout** — ADR 0020 decision 7, gated on
  co-occurrence density (one pair corpus-wide today).
- **The three view layers** (decision 8) — two ADR open questions unanswered: how layer 3 is
  entered, and whether layer-1 dragging turns theme centres from a code constant into stored state.
  **T22.3 does not answer the second one** — it only makes the existing member-drag reachable.
- **Manually creating a theme/root** — ADR 0027, proposed, unresolved ADR 0001 collision.
- **Changing node positions or the three-tier resolution** — decisions 2 and 3 stand.
- **Any gating change.** Skill *Map*, not Skill *Tree*.
