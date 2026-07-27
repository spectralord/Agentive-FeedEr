// Which database the test run is allowed to touch.
//
// Integration tests `TRUNCATE ... RESTART IDENTITY CASCADE` as their setup
// (20 test files do, as of Epic 18). Until 2026-07-27 they inherited the dev
// `DATABASE_URL` from `.env`, so `npm test` wiped the `npm run db:seed` data
// and the app fell back to its empty state. The fix is a separate
// `TEST_DATABASE_URL`; this module is the single place that decides which URL
// a test run gets, so the rule cannot drift between the vitest config and the
// migration step.
//
// Two properties matter, in this order:
//   1. The dev database must be *unreachable* from a test run — not merely
//      "not preferred". `DATABASE_URL` is therefore deleted from the test
//      process env rather than overwritten, so a test that reads it directly
//      (bypassing this module) still cannot connect to it.
//   2. Failure is loud. Silently falling back to `DATABASE_URL` is exactly the
//      bug being fixed, so a dev environment without `TEST_DATABASE_URL`
//      aborts the whole run with an actionable message.

export interface DatabaseUrlSource {
  DATABASE_URL?: string;
  TEST_DATABASE_URL?: string;
  // Index signature so `process.env` itself is assignable, not just literals.
  [key: string]: string | undefined;
}

const SETUP_HINT =
  "  TEST_DATABASE_URL=postgres://feedr:feedr_local_dev@localhost:5432/feedr_test\n\n" +
  "The database is created and migrated automatically on the next `npm test`.\n" +
  "See .env.example and docs/LOCAL_SETUP.md.";

/**
 * Resolve the connection string the test run should use.
 *
 * - `TEST_DATABASE_URL` set, and distinct from `DATABASE_URL` → use it.
 * - Neither set (fresh clone / CI without `.env`) → `undefined`. Unit tests
 *   still run; integration tests fail on their own with "DATABASE_URL is
 *   required", which is the pre-existing behaviour.
 * - `DATABASE_URL` set but `TEST_DATABASE_URL` missing, or the two pointing at
 *   the same database → throw. This is the destructive case.
 */
export function resolveTestDatabaseUrl(source: DatabaseUrlSource): string | undefined {
  const devUrl = source.DATABASE_URL?.trim() || undefined;
  const testUrl = source.TEST_DATABASE_URL?.trim() || undefined;

  if (!testUrl) {
    if (!devUrl) return undefined;
    throw new Error(
      "TEST_DATABASE_URL is not set, but DATABASE_URL is.\n\n" +
        "Integration tests TRUNCATE every table as setup, so they must never run\n" +
        "against your development database. Point them at a separate one in .env:\n\n" +
        SETUP_HINT,
    );
  }

  if (devUrl && sameDatabase(devUrl, testUrl)) {
    throw new Error(
      "TEST_DATABASE_URL points at the same database as DATABASE_URL.\n\n" +
        "Integration tests TRUNCATE every table as setup, so this would destroy\n" +
        "your `npm run db:seed` data. Use a separate database:\n\n" +
        SETUP_HINT,
    );
  }

  return testUrl;
}

/**
 * Apply the resolution to `process.env`, in place.
 *
 * Called from `vitest.config.ts` — i.e. in the main vitest process, before the
 * test workers are forked, so every worker inherits the corrected env. The
 * rest of the codebase keeps reading `DATABASE_URL` (see `src/lib/env.ts`);
 * only its *value* differs under test.
 */
export function applyTestDatabaseUrl(source: DatabaseUrlSource = process.env): void {
  const testUrl = resolveTestDatabaseUrl(source);
  delete source.DATABASE_URL;
  if (testUrl) source.DATABASE_URL = testUrl;
}

/**
 * Same host, port and database name? Compared structurally rather than by
 * string equality so that cosmetic differences (a trailing slash, a different
 * password, an added `?sslmode=`) still count as "the same database".
 * Unparseable URLs fall back to string comparison.
 */
function sameDatabase(a: string, b: string): boolean {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return a === b;
  return (
    left.hostname === right.hostname && left.port === right.port && left.database === right.database
  );
}

function parse(url: string): { hostname: string; port: string; database: string } | undefined {
  try {
    const parsed = new URL(url);
    return {
      hostname: parsed.hostname,
      // Postgres' default port, so `:5432` and an omitted port are the same host.
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return undefined;
  }
}
