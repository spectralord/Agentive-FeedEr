import { describe, expect, it } from "vitest";
import { topScore } from "./ranking";

const NOW = new Date("2026-07-22T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("topScore", () => {
  it("published today, R100/Q100 => 1.0", () => {
    const score = topScore(
      { relevanceScore: 100, qualityScore: 100, publishedAt: NOW },
      NOW,
    );
    expect(score).toBe(1.0);
  });

  it("published 7 days ago, R100/Q100 => ≈ 0.3679 (±0.001)", () => {
    const score = topScore(
      { relevanceScore: 100, qualityScore: 100, publishedAt: daysAgo(7) },
      NOW,
    );
    expect(score).toBeCloseTo(0.3679, 3);
  });

  it("published today, R50/Q80 => 0.4", () => {
    const score = topScore(
      { relevanceScore: 50, qualityScore: 80, publishedAt: NOW },
      NOW,
    );
    expect(score).toBeCloseTo(0.4, 10);
  });

  it("ranks a fresh R70/Q70 reel above a 14-day-old R95/Q95 reel", () => {
    const fresh = topScore(
      { relevanceScore: 70, qualityScore: 70, publishedAt: NOW },
      NOW,
    );
    const old = topScore(
      { relevanceScore: 95, qualityScore: 95, publishedAt: daysAgo(14) },
      NOW,
    );
    expect(fresh).toBeGreaterThan(old);
  });
});
