import type { Source } from "@/db/schema";

export interface NormalizedItem {
  externalId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: Date;
}

export type Fetcher = (source: Source) => Promise<NormalizedItem[]>;

export const MAX_CONTENT_LENGTH = 8_000;
export const FETCH_TIMEOUT_MS = 15_000;
export const USER_AGENT = "agentive-feeder/1.0";

export function capContent(text: string): string {
  return text.length > MAX_CONTENT_LENGTH ? text.slice(0, MAX_CONTENT_LENGTH) : text;
}
