import { describe, expect, it } from "vitest";
import { getFreshnessInfo } from "./freshness";
import { FRESHNESS_STALE_MS } from "./pipeline";

describe("getFreshnessInfo", () => {
  const now = new Date("2026-07-27T12:00:00Z");

  it("is not stale just under the 36h threshold", () => {
    const finishedAt = new Date(now.getTime() - (FRESHNESS_STALE_MS - 60_000));
    const info = getFreshnessInfo(finishedAt, now);
    expect(info.stale).toBe(false);
    // formatRelativeTime switches to day-granularity past 24h — 35h reads as
    // "1 day ago", same wording used everywhere else in the app.
    expect(info.label).toBe("updated 1 day ago");
  });

  it("is stale just past the 36h threshold", () => {
    const finishedAt = new Date(now.getTime() - (FRESHNESS_STALE_MS + 60_000));
    const info = getFreshnessInfo(finishedAt, now);
    expect(info.stale).toBe(true);
    expect(info.label).toBe("updated 1 day ago");
  });

  it("a recent run reads as fresh", () => {
    const finishedAt = new Date(now.getTime() - 3 * 60 * 60_000);
    const info = getFreshnessInfo(finishedAt, now);
    expect(info.stale).toBe(false);
    expect(info.label).toBe("updated 3 hours ago");
  });

  it("no run ever finished successfully is its own honest, stale state", () => {
    const info = getFreshnessInfo(null, now);
    expect(info.stale).toBe(true);
    expect(info.label).toBe("no successful run yet");
  });
});
