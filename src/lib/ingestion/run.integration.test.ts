// Integration test against the local Postgres from .env (DATABASE_URL).
// Verifies idempotency (second run inserts 0), per-source error isolation,
// and the first-run flood guard.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems } from "@/db/schema";
import type { Fetcher, NormalizedItem } from "./types";
import { runIngestion } from "./run";

const now = new Date("2026-07-21T12:00:00Z");

function item(id: string, daysAgo: number): NormalizedItem {
  return {
    externalId: id,
    title: `Item ${id}`,
    url: `https://example.com/${id}`,
    content: "content",
    publishedAt: new Date(now.getTime() - daysAgo * 86_400_000),
  };
}

// Every registry source type resolves to one of these mocks.
const okFetcher: Fetcher = async () => [item("a", 1), item("b", 2), item("old", 45)];
const failFetcher: Fetcher = async () => {
  throw new Error("boom");
};

const allOk = {
  rss: okFetcher,
  reddit_rss: okFetcher,
  github_releases: okFetcher,
  hn_algolia: okFetcher,
};

describe("runIngestion (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("inserts fresh items, skips items older than 30 days, is idempotent", async () => {
    const first = await runIngestion(db(), allOk, now);
    expect(first.perSource.length).toBeGreaterThanOrEqual(6);
    expect(first.perSource.every((s) => !s.error)).toBe(true);
    // Each source fetched 3 items but only 2 are fresh (flood guard).
    expect(first.totalInserted).toBe(first.perSource.length * 2);

    const second = await runIngestion(db(), allOk, now);
    expect(second.totalInserted).toBe(0); // dedup via unique index

    const rows = await db().select().from(rawItems);
    expect(rows).toHaveLength(first.totalInserted);
    expect(rows.every((r) => r.enrichedAt === null)).toBe(true);
  });

  it("isolates per-source failures", async () => {
    const mixed = { ...allOk, rss: failFetcher };
    const result = await runIngestion(db(), mixed, now);
    const failed = result.perSource.filter((s) => s.error);
    const succeeded = result.perSource.filter((s) => !s.error);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((s) => s.error === "boom")).toBe(true);
    expect(succeeded.length).toBeGreaterThan(0);
    expect(result.totalInserted).toBe(succeeded.length * 2);
  });
});
