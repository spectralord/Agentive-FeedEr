import { describe, expect, it } from "vitest";
import { applyTestDatabaseUrl, resolveTestDatabaseUrl, type DatabaseUrlSource } from "./databaseUrl";

const DEV = "postgres://feedr:feedr_local_dev@localhost:5432/feedr_dev";
const TEST = "postgres://feedr:feedr_local_dev@localhost:5432/feedr_test";

describe("resolveTestDatabaseUrl", () => {
  it("uses TEST_DATABASE_URL when it differs from DATABASE_URL", () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: TEST })).toBe(TEST);
  });

  it("uses TEST_DATABASE_URL when no dev DATABASE_URL is configured", () => {
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: TEST })).toBe(TEST);
  });

  it("returns undefined when neither is set (fresh clone / CI)", () => {
    expect(resolveTestDatabaseUrl({})).toBeUndefined();
  });

  it("throws instead of falling back to a configured DATABASE_URL", () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: DEV })).toThrow(/TEST_DATABASE_URL is not set/);
  });

  it("treats blank values as unset", () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: "   ", TEST_DATABASE_URL: "" })).toBeUndefined();
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: "  " })).toThrow(
      /TEST_DATABASE_URL is not set/,
    );
  });

  it("throws when both point at the same database", () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: DEV })).toThrow(
      /same database/,
    );
  });

  it("sees through cosmetic URL differences when comparing", () => {
    // Different password, explicit vs. default port, extra query string — still
    // the same host/port/database, so still destructive.
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL: "postgres://feedr:one@localhost/feedr_dev",
        TEST_DATABASE_URL: "postgres://feedr:two@localhost:5432/feedr_dev?sslmode=disable",
      }),
    ).toThrow(/same database/);
  });

  it("does not confuse the same database name on different hosts", () => {
    const remote = "postgres://feedr:pw@db.example.com:5432/feedr_dev";
    expect(resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: remote })).toBe(remote);
  });
});

describe("applyTestDatabaseUrl", () => {
  it("replaces DATABASE_URL with the test URL", () => {
    const source = { DATABASE_URL: DEV, TEST_DATABASE_URL: TEST };
    applyTestDatabaseUrl(source);
    expect(source.DATABASE_URL).toBe(TEST);
  });

  it("leaves no DATABASE_URL behind when there is no test database", () => {
    const source: DatabaseUrlSource = {};
    applyTestDatabaseUrl(source);
    expect("DATABASE_URL" in source).toBe(false);
  });

  it("aborts rather than leaving the dev URL in place", () => {
    // The throw is what makes the dev database unreachable: the run never gets
    // as far as forking a worker, so nothing can read the value that survives.
    expect(() => applyTestDatabaseUrl({ DATABASE_URL: DEV })).toThrow(/TEST_DATABASE_URL is not set/);
  });
});
