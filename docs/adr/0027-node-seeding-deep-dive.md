# ADR 0027 — Seeding a user-declared Skill Node by fetching content for it

- Status: **proposed** (owner requirement stated 2026-08-01 during the ADR 0018 grill; deferred to
  its own ADR by owner decision. **Needs a grill — it has an unresolved trust-boundary problem.**)
- Date: 2026-08-01
- Related: **ADR 0001 (curated sources over the open web — the binding decision this collides
  with)**, Epic 8 (agentic Deep-Dive — whose whitelist this cannot reuse), ADR 0018 decision 8
  (manually declared nodes), ADR 0005 (sourced-only), ADR 0015 (executor seam, binding),
  ADR 0009/Epic 12 (SkillTagger — how nodes are created today)

> **Scope widened 2026-08-01 (ADR 0020 grill).** The owner wants the same capability at the
> **theme/root level**, not only for individual skill nodes: declare a new root category, have it
> search already-ingested content, *then* fetch new material from the web for it. ADR 0020
> decision 8 establishes that **themes are the root nodes**, so "create a new root" and "create a
> declared node" are the same feature at two levels of the same hierarchy. Both inherit the
> whitelist-anchor problem below and the ADR 0001 collision. Whatever this ADR decides must therefore
> work for a declared *theme* as well as a declared *node* — a theme has even less to anchor to,
> since it has no slug-level topic to search for beyond its own name.

## Context / Problem

The owner wants to **declare a topic/node and have a deep-dive fetch content to fill it** — rather
than waiting for the RSS pipeline to happen to surface enough Reels on that topic for SkillTagger to
propose a node.

The motivation is sound and addresses a real gap: today a node can only exist if the curated feeds
happened to cover its topic. A topic you *want* to learn cannot be willed into the Skill Map.

**But this is a third thing, distinct from both existing generation concepts, and it breaks an
assumption they both rest on.**

### The whitelist-anchor problem (the reason this needs a grill)

Epic 8's Deep-Dive is **per Reel**, and its source whitelist is defined *relative to that Reel*.
Quoting the epic's guardrails, the agent may fetch only: (a) the Reel's original URL, (b) links
appearing in that original article, (c) domains from the source registry.

**A user-declared node has no originating Reel.** Clauses (a) and (b) have nothing to anchor to.
Only (c) survives. So Epic 8's whitelist cannot simply be reused here — the mechanism that makes
Deep-Dive safe is precisely the part that does not transfer.

That leaves the question this ADR exists to answer: **where does a declared node's content legitimately
come from?** And it cannot be answered without touching **ADR 0001**, which chose curated sources
over the open web as a binding decision.

## Options (none yet chosen — this is the grill's job)

The owner was offered these and deferred the choice to this ADR:

1. **Registry domains only.** Search/fetch strictly within the existing curated source registry.
   Keeps ADR 0001 fully intact — no new trust boundary. Cost: a declared node on a topic the
   registry does not cover yields little or nothing, which may defeat the purpose for exactly the
   novel topics most worth declaring.
2. **Open-web search, results recorded as sources with provenance.** Much richer seeding. But it
   **crosses ADR 0001**, which would need *amending*, not merely extending — and ADR 0001 is
   binding, so this is a real architectural decision, not a config change.
3. **User supplies seed URLs.** The owner declares the node and pastes 2–5 starting URLs; the agent
   fetches those plus links within them. Reconstructs Epic 8's whitelist shape with the user
   standing in for the originating Reel. No new trust boundary, no search, quality controlled by the
   person who cares. Cost: manual work per node.

Option 3 is worth noting as the one that solves the anchor problem *structurally* rather than by
loosening a constraint — the user-supplied URLs become the anchor. That is an observation, not a
recommendation; the grill should weigh it against how much manual effort per node is acceptable.

## Open questions — for the grill

1. **Which sourcing option (above), and if option 2, does ADR 0001 get amended or does this get
   rejected?** Everything else depends on this.
2. **What does a seeded node contain — Reels, or only a Guide?** Fetched pages are not Reels: they
   did not come through ingestion, have no `raw_items` row, no relevance/quality scores, no
   enrichment. Do they become synthetic Reels (polluting the feed's provenance model), or do they
   feed the node's Guide directly without ever appearing as Reels? The latter looks cleaner and
   keeps the feed's meaning intact, but it means a node can hold a Guide with no visible Reels
   behind it — which the Guide's mandatory-citation rule (ADR 0018 decision 2) must still satisfy.
3. **How does this interact with SkillTagger's Match-or-Propose?** If the user declares "Prompt
   Caching" and SkillTagger later proposes the same node from ingested Reels, what merges with what?
   `/skills` already has confirm/merge/discard machinery — does a declared node join that flow?
4. **Budget and stopping rule.** Epic 8 caps at 5 fetches / 2 agent rounds. Seeding a whole topic
   plausibly wants more. What is the ceiling, and what stops a runaway?
5. **Executor and profile.** Fetching plus agentic rounds through the injected `Executor`
   (ADR 0015). Under `local` that is the subscription — but this involves *network fetching*, not
   just inference, so is it local-only like ADR 0024/0026, or is fetching profile-independent?
6. **Does a seeded node's Guide need a distinguishing marker?** A Guide synthesised from
   user-directed fetches has a different provenance from one synthesised from curated-feed Reels.
   The reader arguably deserves to know which they are looking at.

## Consequences (if built)

- A fetch utility with whatever whitelist rule question 1 settles, plus an agentic runner — both
  through the executor seam.
- UI to declare a node (ADR 0018 decision 8 already puts create-from-scratch in scope) and to
  trigger seeding.
- Possible amendment to **ADR 0001** — the load-bearing consequence, and the reason this is not a
  small feature.
- Possible new provenance concept for content that entered outside ingestion.
- `CONTEXT.en.md` entry, since this is a fourth generation concept alongside Write-up, Guide and
  Deep-Dive and will otherwise be conflated with Deep-Dive immediately.

## Note on naming

Do **not** call this "Deep-Dive". `CONTEXT.en.md` reserves that term for Epic 8's per-Reel,
on-demand, external-fetching agent, and ADR 0017/0018 both go out of their way to keep the three
existing concepts distinct. This needs its own name — "node seeding" is the working label used here.
