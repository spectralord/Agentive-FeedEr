import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Singleton across Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { __agentiveFeederPool?: Pool };

function getPool(): Pool {
  globalForDb.__agentiveFeederPool ??= new Pool({ connectionString: env().DATABASE_URL });
  return globalForDb.__agentiveFeederPool;
}

let cached: NodePgDatabase<typeof schema> | undefined;

export function db(): NodePgDatabase<typeof schema> {
  cached ??= drizzle(getPool(), { schema });
  return cached;
}

export { getPool };
