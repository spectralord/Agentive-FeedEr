import type { FeedCategory } from "@/lib/feed";

/** German display labels for reel attributes — used by ReelCard and FilterBar. */
export const CATEGORY_LABELS: Record<FeedCategory, string> = {
  "claude-feature": "Claude-Feature",
  tooling: "Tooling",
  technique: "Technik",
  "industry-news": "Branchen-News",
  research: "Forschung",
  opinion: "Meinung",
};

export const MATURITY_LABELS: Record<"experimental" | "emerging" | "established", string> = {
  experimental: "Experimentell",
  emerging: "Im Kommen",
  established: "Etabliert",
};

export const EFFORT_LABELS: Record<"5-min-test" | "afternoon" | "know-only", string> = {
  "5-min-test": "5-Min-Test",
  afternoon: "Nachmittag",
  "know-only": "Nur wissen",
};
