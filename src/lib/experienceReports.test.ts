// Integration test against local Postgres (T9.3 verification): create, filter
// by author_type, lifecycle transitions hide/reveal via the default vs.
// `states` view, update sets updated_at. Seeds its own experience_reports
// rows (TRUNCATE + insert) — same pattern as src/lib/feed.test.ts.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { experienceReports } from "@/db/schema";
import {
  createReport,
  deleteReport,
  getReport,
  listReports,
  setLifecycleState,
  updateReport,
} from "./experienceReports";

describe("experienceReports (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE experience_reports RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("creates a report and lists it newest first by default (active only)", async () => {
    const first = await createReport({
      title: "Erster Bericht",
      body: "Text 1",
      authorType: "own",
      authorLabel: "Ich",
    });
    const second = await createReport({
      title: "Zweiter Bericht",
      body: "Text 2",
      authorType: "own",
      authorLabel: "Ich",
    });

    const rows = await listReports();
    expect(rows.map((r) => r.id)).toEqual([second.id, first.id]);
    expect(rows.every((r) => r.lifecycleState === "active")).toBe(true);
  });

  it("filters by exact author_type and ignores unknown values", async () => {
    await createReport({ title: "Own", body: "b", authorType: "own", authorLabel: "Ich" });
    await createReport({ title: "Curated", body: "b", authorType: "curated", authorLabel: "Quelle X" });

    const own = await listReports({ authorType: "own" });
    expect(own).toHaveLength(1);
    expect(own[0].authorType).toBe("own");

    const unknown = await listReports({ authorType: "not-a-real-type" });
    expect(unknown).toHaveLength(2); // filter silently ignored, not empty
  });

  it("setLifecycleState('deprecated') hides a report from the default list but keeps it reachable via states", async () => {
    const report = await createReport({
      title: "Veraltet",
      body: "b",
      authorType: "own",
      authorLabel: "Ich",
    });

    await setLifecycleState(report.id, "deprecated", { reason: "überholt" });

    const defaultList = await listReports();
    expect(defaultList).toHaveLength(0);

    const withDeprecated = await listReports({ states: ["active", "deprecated"] });
    expect(withDeprecated).toHaveLength(1);
    expect(withDeprecated[0].lifecycleState).toBe("deprecated");
    expect(withDeprecated[0].lifecycleReason).toBe("überholt");
  });

  it("setLifecycleState('archived') is only reachable via explicit states, not via deprecated alone", async () => {
    const report = await createReport({
      title: "Archiviert",
      body: "b",
      authorType: "own",
      authorLabel: "Ich",
    });

    await setLifecycleState(report.id, "archived", {
      reason: "nicht mehr relevant",
      supersededByReportId: 999,
    });

    expect(await listReports()).toHaveLength(0);
    expect(await listReports({ states: ["active", "deprecated"] })).toHaveLength(0);

    const withArchived = await listReports({ states: ["active", "archived"] });
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0].lifecycleState).toBe("archived");
    expect(withArchived[0].supersededByReportId).toBe(999);
  });

  it("reactivating clears reason/supersededByReportId and restores the report to the default list", async () => {
    const report = await createReport({
      title: "Wieder aktiv",
      body: "b",
      authorType: "own",
      authorLabel: "Ich",
    });
    await setLifecycleState(report.id, "deprecated", { reason: "temp" });

    const reactivated = await setLifecycleState(report.id, "active");
    expect(reactivated?.lifecycleState).toBe("active");
    expect(reactivated?.lifecycleReason).toBeNull();
    expect(reactivated?.supersededByReportId).toBeNull();

    const rows = await listReports();
    expect(rows.map((r) => r.id)).toEqual([report.id]);
  });

  it("updateReport changes fields and bumps updated_at", async () => {
    const report = await createReport({
      title: "Original",
      body: "Alter Text",
      authorType: "own",
      authorLabel: "Ich",
    });
    const originalUpdatedAt = report.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));
    const updated = await updateReport(report.id, { title: "Neuer Titel", body: "Neuer Text" });

    expect(updated?.title).toBe("Neuer Titel");
    expect(updated?.body).toBe("Neuer Text");
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it("getReport returns undefined for a missing id", async () => {
    expect(await getReport(999999)).toBeUndefined();
  });

  it("deleteReport hard-deletes (rare manual escape hatch, ADR 0008)", async () => {
    const report = await createReport({
      title: "Löschen",
      body: "b",
      authorType: "own",
      authorLabel: "Ich",
    });

    await deleteReport(report.id);

    expect(await getReport(report.id)).toBeUndefined();
    const [row] = await db().select().from(experienceReports);
    expect(row).toBeUndefined();
  });
});
