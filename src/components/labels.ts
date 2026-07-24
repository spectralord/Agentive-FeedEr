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
