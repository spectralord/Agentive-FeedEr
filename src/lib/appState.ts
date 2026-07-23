import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { appState } from "@/db/schema";

/**
 * Generic key-value accessors for `app_state` (Epic 6, T6.1). Currently the
 * only consumer is the rolling feedback summary (key "feedback_summary", see
 * src/lib/feedback/run.ts), but the table/helpers are deliberately generic —
 * no feedback-specific logic here.
 */

export async function getAppState<T>(
  db: NodePgDatabase<typeof schema>,
  key: string,
): Promise<T | undefined> {
  const [row] = await db
    .select({ value: appState.value })
    .from(appState)
    .where(eq(appState.key, key));
  return row ? (row.value as T) : undefined;
}

export async function setAppState(
  db: NodePgDatabase<typeof schema>,
  key: string,
  value: unknown,
): Promise<void> {
  await db
    .insert(appState)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appState.key,
      set: { value, updatedAt: new Date() },
    });
}
