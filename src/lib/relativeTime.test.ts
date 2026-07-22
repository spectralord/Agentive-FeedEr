import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

const NOW = new Date("2026-07-22T12:00:00Z");

describe("formatRelativeTime", () => {
  it("handles just now", () => {
    expect(formatRelativeTime(new Date("2026-07-22T11:59:30Z"), NOW)).toBe("gerade eben");
  });

  it("handles minutes, singular and plural", () => {
    expect(formatRelativeTime(new Date("2026-07-22T11:59:00Z"), NOW)).toBe("vor 1 Minute");
    expect(formatRelativeTime(new Date("2026-07-22T11:45:00Z"), NOW)).toBe("vor 15 Minuten");
  });

  it("handles hours", () => {
    expect(formatRelativeTime(new Date("2026-07-22T09:00:00Z"), NOW)).toBe("vor 3 Stunden");
  });

  it("handles days (the spec example: vor 2 Tagen)", () => {
    expect(formatRelativeTime(new Date("2026-07-20T12:00:00Z"), NOW)).toBe("vor 2 Tagen");
  });

  it("handles weeks", () => {
    expect(formatRelativeTime(new Date("2026-07-08T12:00:00Z"), NOW)).toBe("vor 2 Wochen");
  });

  it("handles months", () => {
    expect(formatRelativeTime(new Date("2026-05-01T12:00:00Z"), NOW)).toBe("vor 2 Monaten");
  });
});
