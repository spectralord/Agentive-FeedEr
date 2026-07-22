import { describe, expect, it } from "vitest";
import { isBestPractice, isNew, isSota } from "./labels";

const NOW = new Date("2026-07-22T12:00:00Z");

// Defaults: NEW_DAYS=7, QUALITY_THRESHOLD=60 (see .env / src/lib/env.ts) unless
// overridden in the test environment.
const NEW_DAYS = 7;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("isNew", () => {
  it("is true just inside the NEW_DAYS window", () => {
    expect(isNew({ publishedAt: daysAgo(NEW_DAYS - 0.01) }, NOW)).toBe(true);
  });

  it("is false exactly at the NEW_DAYS boundary (strict >)", () => {
    expect(isNew({ publishedAt: daysAgo(NEW_DAYS) }, NOW)).toBe(false);
  });

  it("is false just outside the NEW_DAYS window", () => {
    expect(isNew({ publishedAt: daysAgo(NEW_DAYS + 0.01) }, NOW)).toBe(false);
  });

  it("is true for something published right now", () => {
    expect(isNew({ publishedAt: NOW }, NOW)).toBe(true);
  });
});

describe("isSota", () => {
  it("is true for established + relevance 70 + quality 70 (boundary)", () => {
    expect(
      isSota({ maturity: "established", relevanceScore: 70, qualityScore: 70 }),
    ).toBe(true);
  });

  it("is false for relevance 69 (just below boundary)", () => {
    expect(
      isSota({ maturity: "established", relevanceScore: 69, qualityScore: 70 }),
    ).toBe(false);
  });

  it("is false for quality 69 (just below boundary)", () => {
    expect(
      isSota({ maturity: "established", relevanceScore: 70, qualityScore: 69 }),
    ).toBe(false);
  });

  it("is false for maturity emerging, even with high scores", () => {
    expect(
      isSota({ maturity: "emerging", relevanceScore: 99, qualityScore: 99 }),
    ).toBe(false);
  });

  it("is false for maturity experimental, even with high scores", () => {
    expect(
      isSota({ maturity: "experimental", relevanceScore: 99, qualityScore: 99 }),
    ).toBe(false);
  });

  it("is age-independent: true regardless of how old the reel is", () => {
    // isSota() doesn't even take a date/age input — but this documents the
    // explicit requirement (epic-5-overview.md T5.1) that maturity+scores
    // alone decide SOTA, never publishedAt.
    const sota = { maturity: "established" as const, relevanceScore: 100, qualityScore: 100 };
    expect(isSota(sota)).toBe(true);
  });
});

describe("isBestPractice", () => {
  it("is true for emerging/established + action set + quality 70 (boundary)", () => {
    expect(
      isBestPractice({ maturity: "established", action: "Do the thing", qualityScore: 70 }),
    ).toBe(true);
    expect(
      isBestPractice({ maturity: "emerging", action: "Do the thing", qualityScore: 70 }),
    ).toBe(true);
  });

  it("is false for quality 69 (just below boundary)", () => {
    expect(
      isBestPractice({ maturity: "established", action: "Do the thing", qualityScore: 69 }),
    ).toBe(false);
  });

  it("is false for maturity experimental, even with action and high quality", () => {
    expect(
      isBestPractice({ maturity: "experimental", action: "Do the thing", qualityScore: 99 }),
    ).toBe(false);
  });

  it("is false when action is null", () => {
    expect(isBestPractice({ maturity: "established", action: null, qualityScore: 99 })).toBe(
      false,
    );
  });
});
