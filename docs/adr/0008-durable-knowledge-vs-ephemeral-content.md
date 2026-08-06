# ADR 0008 — Durable knowledge layer vs. ephemeral content layer

- Status: accepted
- Date: 2026-07-22

## Context / Problem

Reels (and curated reports) are transient — they age, become superseded, and are
eventually replaced by newer content. The skill tree, however, should be **durable**: the
competency "prompt caching" does not disappear just because the article that taught it
has aged out of the feed. If skill nodes and progress were *derived from and discarded
along with* the currently present content, the tree would churn with the feed and
progress/notes would be lost.

## Decision

There are two layers with different lifecycles:

- **Ephemeral content layer:** news Reels + `curated` Experience Reports. Automatically
  rotate out of the *active* views over time — **not** via deletion, but
  via the lifecycle `active → deprecated → archived`.
- **Durable knowledge layer:** Skill Nodes + `user_progress`/adoption log + `own`
  Experience Reports. Grows, stays active until *manually* transitioned.

**Unified lifecycle (no auto-delete):** Everything — Reels, reports, *and*
Skill Nodes — carries a `lifecycle_state`:
- `active` → visible in normal views.
- `deprecated` → superseded (with `reason`/`superseded_by`); out of active views, but
  still findable in history.
- `archived` → only in an explicit archive/history view.
Nothing is **automatically deleted**; everything remains historically traceable. Hard
deletion is exclusively a rare, deliberate manual action.

Rules that guarantee durability:
1. **Skill Nodes are first-class entities.** Content *references* nodes
   (`content.skill → node`), never the reverse. A node does not depend on a
   particular piece of content existing.
2. **Nodes are created once and never automatically deleted** (only manual
   archiving). A node may have zero current content and still persist.
3. **Progress and notes live on the node**, not on the content — they survive any
   content turnover.
4. **"Durable" ≠ "forever active":** `own`/company reports too can manually be
   `deprecated`/`archived` (with a reason/`superseded_by`) — they are just not part of the
   *automatic* rotation-out. They also are not auto-deleted.

## Alternatives

- **Derive skill nodes from existing content (not first-class):** simpler, but
  the tree and progress churn with the feed. Rejected — contradicts the required
  durability.

## Consequences

- The feed rotates (active view), the skill tree accumulates — both layers
  retain their full history.
- Own experience reports additionally **anchor** nodes (durable content that
  remains even when all news on the topic has become outdated).
- Requires cleanup discipline (archiving) instead of auto-delete; a deliberate choice.
