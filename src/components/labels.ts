import type { FeedCategory } from "@/lib/feed";

/** Display labels for reel attributes — used by ReelCard and FilterBar. */
export const CATEGORY_LABELS: Record<FeedCategory, string> = {
  "claude-feature": "Claude Feature",
  tooling: "Tooling",
  technique: "Technique",
  "industry-news": "Industry News",
  research: "Research",
  opinion: "Opinion",
};

export const MATURITY_LABELS: Record<"experimental" | "emerging" | "established", string> = {
  experimental: "Experimental",
  emerging: "Emerging",
  established: "Established",
};

export const EFFORT_LABELS: Record<"5-min-test" | "afternoon" | "know-only", string> = {
  "5-min-test": "5-min test",
  afternoon: "Afternoon",
  "know-only": "Know only",
};

/** Epic 11 (ADR 0012, T11.5): the cluster corroboration scale, subtle wording
 *  deliberately separate from R/Q scores. */
export const CONFIDENCE_LABELS: Record<"few" | "some" | "strong", string> = {
  few: "Few sources",
  some: "Some sources",
  strong: "Strong corroboration",
};
