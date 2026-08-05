# ADRs — numbering and how to avoid collisions

## The problem this exists to prevent

Multiple sessions work in parallel on separate branches (CLAUDE.md, branch strategy). Each picks
"the next free number" by looking at `main` **at the time it branches** — so two sessions branching
the same afternoon both see `0020` as the highest and both write `0021`. Git merges cleanly
(different filenames), and `main` ends up with two ADR 0021s.

That happened on 2026-07-24: `0021-experience-reports-in-topic-clusters` and
`0021-retire-sota-section` both landed. Resolved by renumbering the second one (the later merge
yields), but it is cheap to avoid and expensive to untangle once other docs cite the number.

## Rules

1. **Before writing a new ADR, check the remotes, not just your local `main`:**
   ```
   git fetch --all
   git branch -r | grep -v HEAD | while read b; do git ls-tree --name-only "$b" docs/adr/; done \
     | sort -u
   ```
   Take the next number above everything that appears — including numbers only present on someone
   else's unmerged branch.

2. **On collision, the later merge yields.** Whoever is already on `main` keeps the number. The
   later ADR renumbers *and* fixes every reference to it — grep before assuming there are none:
   ```
   grep -rn "ADR 00NN" docs/ *.md
   ```
   Be careful to only rewrite references to *your* ADR; the same number may legitimately appear in
   other docs pointing at the ADR that kept it.

3. **Renumber before merging when you can.** A number that never reached `main` is free to change;
   one that other epic files already cite is not.

4. **Never renumber someone else's ADR** to make room for yours.

## Current allocation (2026-08-01)

| Range | Workstream |
|---|---|
| 0001–0015 | Core product & architecture |
| 0016–0020 | UX/gamification design pass (design-expert session) |
| 0021 | Experience Reports in Topic Clusters |
| 0022–0023 | UX phase 2 — SOTA retirement, navigation IA |
| 0024 | On-demand Write-up generation on the Claude Code subscription |
| 0025 | Deferred task queue + typed handlers (**REJECTED** 2026-08-03 — one consumer, and `pipeline_runs` already covers it) |
| 0026 | Reusable writing-assistance service (**proposed**) |
| 0027 | Node seeding by fetching for a declared node (**DEFERRED** 2026-08-03 — ADR 0001 collision dissolved; blocked on Epic 8) |
| 0028 | Curator inbox / approval gate (**proposed — flagged for a design session**) |

Not reserved blocks, just a record of what is taken. Next free: **0029**.
