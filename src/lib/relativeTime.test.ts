import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

const NOW = new Date("2026-07-22T12:00:00Z");

describe("formatRelativeTime", () => {
  it("handles just now", () => {
    expect(formatRelativeTime(new Date("2026-07-22T11:59:30Z"), NOW)).toBe("just now");
  });

  it("handles minutes, singular and plural", () => {
    expect(formatRelativeTime(new Date("2026-07-22T11:59:00Z"), NOW)).toBe("1 minute ago");
    expect(formatRelativeTime(new Date("2026-07-22T11:45:00Z"), NOW)).toBe("15 minutes ago");
  });

  it("handles hours", () => {
    expect(formatRelativeTime(new Date("2026-07-22T09:00:00Z"), NOW)).toBe("3 hours ago");
  });

  it("handles days (the spec example: 2 days ago)", () => {
    expect(formatRelativeTime(new Date("2026-07-20T12:00:00Z"), NOW)).toBe("2 days ago");
  });

  it("handles weeks", () => {
    expect(formatRelativeTime(new Date("2026-07-08T12:00:00Z"), NOW)).toBe("2 weeks ago");
  });

  it("handles months", () => {
    expect(formatRelativeTime(new Date("2026-05-01T12:00:00Z"), NOW)).toBe("2 months ago");
  });
});
