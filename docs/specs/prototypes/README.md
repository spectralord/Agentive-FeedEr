# Design prototypes — visual reference for the UX pass

- Date: 2026-07-24
- Belongs to: `docs/specs/2026-07-24-ux-gamification-design.md`
- Status: **accepted design references** — the three prototypes the product owner signed off on,
  out of ~16 iterations. The rejected/superseded ones are deliberately not kept.

## What these are

Self-contained HTML files. Open one directly in a browser (no build, no server, no network — the
CSS/JS is inline and there are zero external requests). They are the **visual source of truth**
for the redesign: if the written spec and these files disagree about how something should *look*,
these files win, because they are what was actually reviewed and accepted.

| File | Covers | Spec section |
|---|---|---|
| `reel-card-and-detail.html` | Reel card (Compact) + push-navigation Detail view with its tabs | §1–§3, §5.2 |
| `skill-constellation.html` | Skill constellation map + Knowledge Base view + node panel | §5.1, §9 |
| `nav-ia.html` | Navigation IA: 7 links → 4 destinations, hubs, Today's completion moment | §10.1, §10.4 |

All three are interactive — click things. `reel-card-and-detail.html` has three stacked Reels you can
scroll between; tap a card to push into Detail, tap the skill badge to jump straight to the Skill
tab. `skill-constellation.html` has 28 nodes across the 8 real themes; click any node, toggle
**Knowledge decay**, and switch to the **Knowledge Base** view. `nav-ia.html` shows the proposed
bottom tab bar — tap through all four destinations; Skills and Library have segmented sub-navs.

## What is binding vs. illustrative

**Binding — reproduce this:**
- The colour values and how they are used. `--accent` / `--action` / `--gold` / `--caution` each
  carry exactly one meaning (ADR 0016) — the prototypes are the reference for what those hexes are
  and where each one is allowed to appear.
- Type treatment: sans for reading, mono for meta/data and labels, and the relative sizes.
- The status-ring language: gray outline → partial teal → full gold, plus the `★` on mastered.
  One visual language across the map tile, node detail, and the Reel's Skill tab.
- Progress-as-luminosity on the constellation, and the fact that gold appears **only** for
  mastered.
- The Compact → Detail push transition (Detail slides in from the right, Compact slides slightly
  out beneath it), and the tab bar's look.
- Spacing rhythm, border/hairline weights, corner radii.

**Illustrative — do not copy:**
- **All content is invented sample data.** No real Reel, skill node, guide, or To-Try in these
  files came from the database. The prose was written to exercise the layout at realistic length,
  nothing more.
- **The constellation's node placement is the fallback tier only.** These files use
  `hash(slug) → angle + radius` with relaxation, which is stable but encodes no meaning.
  **ADR 0020 supersedes this** with a three-tier model (manual override ?? stored computed layout
  ?? hash fallback). Reproducing the hash math verbatim is correct as the *fallback*, wrong as the
  *whole* answer.
- The vanilla HTML/CSS/JS itself. Production is Next.js + Tailwind with the token system from
  ADR 0016; these files hand-roll everything because they had to run standalone. Read them for
  *what it should look like*, not for how to build it.
- Fixed pixel dimensions (the 680px phone frame, the 1000×640 SVG viewBox). Real layout is
  responsive; the frames exist only to simulate a device in a desktop browser.

## Known gaps these files do not show

- **Mobile constellation.** The map is shown at desktop/iPad size. Phone-size needs
  tap-a-constellation-to-zoom (design doc §9.8) — not prototyped.
- **Edit mode** for node placement (ADR 0020) — planned, not prototyped.
- **The Write-up tab's real content shape.** The Detail prototype predates ADR 0017; its Write-up
  text is invented, and the real `reels.writeup` field does not exist yet.
- **Light theme.** The product is dark-first by decision; no light variant was designed.
- **Desktop navigation.** `nav-ia.html` shows the mobile bottom bar only. The four-destination
  structure holds on wide viewports, but the rendering (side rail? top bar?) is an open question
  in ADR 0022 — do not assume "the mobile bar, wider".
- **Auto-hide on scroll** for the feed's tab bar (ADR 0022) is described, not implemented in the
  prototype.

## Provenance

These came out of an iterative design session (~15 rounds of interactive prototypes) rather than
being drawn up front. Earlier rounds explored a filmstrip-paging Detail view, a tabbed card, six
different card-body templates, and a multi-step To-Try checklist — all rejected or superseded, and
the reasoning for the significant ones is recorded in the design doc's §8 and in ADRs 0017–0020.
The multi-step checklist in particular was dropped because it had no backing data model; see
ADR 0019.
