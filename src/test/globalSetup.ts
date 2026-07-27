// Prepares the test database once per `npm test` run.
//
// Runs in the main vitest process, before any test worker starts, and after
// `vitest.config.ts` has already swapped `DATABASE_URL` to `TEST_DATABASE_URL`
// (see src/test/databaseUrl.ts) — so everything below is by construction
// pointed at the test database, never the dev one.
//
// Creating the database here rather than in docker-compose is deliberate:
// compose init scripts only fire when the volume is first created, so anyone
// with an existing `agentive-feedr-pgdata` volume would never get `feedr_test`.
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Postgres `invalid_catalog_name` — i.e. "that database does not exist". */
const INVALID_CATALOG_NAME = "3D000";

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  // No test database configured. `resolveTestDatabaseUrl` has already thrown if
  // that was the destructive case; reaching here means there is no database at
  // all (fresh clone / CI without `.env`). Unit tests run, integration tests
  // fail loudly on their own.
  if (!url) return;

  await ensureDatabaseExists(url);

  const pool = new Pool({ connectionString: url });
  try {
    // Idempotent — drizzle records applied migrations in its own table, so a
    // second run is a no-op and a newly added migration is picked up without
    // anyone remembering to run a separate command.
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

/**
 * Create the target database if it is missing.
 *
 * Probes by connecting to it directly instead of asking the `postgres`
 * maintenance database up front: in the common case (database already there)
 * that needs no extra privileges at all.
 */
async function ensureDatabaseExists(url: string): Promise<void> {
  const probe = new Client({ connectionString: url });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (error) {
    if (!isMissingDatabase(error)) throw error;
  }

  const target = new URL(url);
  const database = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error(`TEST_DATABASE_URL has no database name: ${url}`);
  }

  // Same server and credentials, but the always-present maintenance database —
  // CREATE DATABASE cannot be issued from inside the database being created.
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    // Not parameterisable — an identifier, not a value. `database` comes from
    // the developer's own TEST_DATABASE_URL, and is quoted for good measure.
    await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
  } catch (error) {
    // 42P04 = duplicate_database: another run won the race. Fine either way.
    if (!isCode(error, "42P04")) throw error;
  } finally {
    await client.end();
  }
}

function isMissingDatabase(error: unknown): boolean {
  return isCode(error, INVALID_CATALOG_NAME);
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
