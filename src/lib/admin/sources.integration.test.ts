// Integration test against local Postgres (T13.7): the read-only sources
// list (with per-source enrich-error counts) and the "reset enrich errors"
// retry mutation, same seeding pattern as
// src/lib/clusters.integration.test.ts.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, sources } from "@/db/schema";
import { listSourcesWithErrorCounts, resetEnrichErrors } from "./sources";

async function seedSource(name: string, opts: { enabled?: boolean; lastPolledAt?: Date } = {}) {
  const [source] = await db()
    .insert(sources)
    .values({
      name,
      type: "rss",
      url: "https://example.com/feed",
      enabled: opts.enabled ?? true,
      lastPolledAt: opts.lastPolledAt ?? null,
    })
    .returning();
  return source;
}

async function seedItem(
  sourceId: number,
  externalId: string,
  opts: { enrichError?: string | null; enrichedAt?: Date | null } = {},
) {
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId,
      externalId,
      title: `Item ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "content",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
      enrichError: opts.enrichError ?? null,
      enrichedAt: opts.enrichedAt ?? null,
    })
    .returning();
  return item;
}

describe("admin sources (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  describe("listSourcesWithErrorCounts", () => {
    it("returns every source with its enabled state, last-polled time, and enrich-error count", async () => {
      const polledAt = new Date("2026-07-24T08:00:00Z");
      const a = await seedSource("Source A", { enabled: true, lastPolledAt: polledAt });
      const b = await seedSource("Source B", { enabled: false });
      await seedItem(a.id, "ok-1");
      await seedItem(a.id, "err-1", { enrichError: "boom" });
      await seedItem(a.id, "err-2", { enrichError: "boom again" });
      await seedItem(b.id, "err-3", { enrichError: "other source error" });

      const list = await listSourcesWithErrorCounts(db());
      expect(list).toHaveLength(2);

      const sourceA = list.find((s) => s.id === a.id);
      expect(sourceA).toMatchObject({
        name: "Source A",
        type: "rss",
        enabled: true,
        enrichErrorCount: 2,
      });
      expect(sourceA?.lastPolledAt?.toISOString()).toBe(polledAt.toISOString());

      const sourceB = list.find((s) => s.id === b.id);
      expect(sourceB).toMatchObject({
        name: "Source B",
        enabled: false,
        lastPolledAt: null,
        enrichErrorCount: 1,
      });
    });

    it("reports a zero error count for a source with no errored items", async () => {
      const source = await seedSource("Clean source");
      await seedItem(source.id, "ok-1");

      const list = await listSourcesWithErrorCounts(db());
      expect(list.find((s) => s.id === source.id)?.enrichErrorCount).toBe(0);
    });
  });

  describe("resetEnrichErrors", () => {
    it("clears enrich_error only for the target source's rows, leaving other sources untouched", async () => {
      const a = await seedSource("Source A");
      const b = await seedSource("Source B");
      const aErr1 = await seedItem(a.id, "err-1", { enrichError: "boom" });
      const aErr2 = await seedItem(a.id, "err-2", { enrichError: "boom again" });
      const aOk = await seedItem(a.id, "ok-1");
      const bErr = await seedItem(b.id, "err-3", { enrichError: "other source error" });

      const cleared = await resetEnrichErrors(db(), a.id);
      expect(cleared).toBe(2);

      const rows = await db().select().from(rawItems);
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(aErr1.id)?.enrichError).toBeNull();
      expect(byId.get(aErr2.id)?.enrichError).toBeNull();
      expect(byId.get(aOk.id)?.enrichError).toBeNull(); // was already null
      expect(byId.get(bErr.id)?.enrichError).toBe("other source error"); // untouched
    });

    it("does not touch enriched_at when clearing the error", async () => {
      const source = await seedSource("Source A");
      const item = await seedItem(source.id, "err-1", { enrichError: "boom" });
      expect(item.enrichedAt).toBeNull();

      await resetEnrichErrors(db(), source.id);

      const [row] = await db().select().from(rawItems);
      expect(row.enrichError).toBeNull();
      expect(row.enrichedAt).toBeNull();
    });

    it("returns 0 for a source with no errored items", async () => {
      const source = await seedSource("Clean source");
      await seedItem(source.id, "ok-1");
      expect(await resetEnrichErrors(db(), source.id)).toBe(0);
    });
  });
});
