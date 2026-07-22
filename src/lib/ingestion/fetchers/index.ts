import type { Fetcher } from "../types";
import { fetchHnItems } from "./hnAlgolia";
import { fetchRssItems } from "./rss";

export const fetchers: Record<string, Fetcher> = {
  rss: fetchRssItems,
  reddit_rss: fetchRssItems,
  github_releases: fetchRssItems,
  hn_algolia: fetchHnItems,
};
