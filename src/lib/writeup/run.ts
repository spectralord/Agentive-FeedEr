import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, reels, sources } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import { env } from "@/lib/env";
import { resolveExecutionConfig } from "@/lib/executor/config";
import {
  buildWriteupUserPrompt,
  WRITEUP_SYSTEM_PROMPT,
  WRITEUP_TOOL_NAME,
  type WriteupReelInput,
  type WriteupSourceInput,
} from "./prompt";
import { writeupOutputJsonSchema, writeupOutputSchema } from "./schema";

/**
 * Signature of the structured-call dependency — same shape as
 * src/lib/verifier/run.ts's StructuredCaller / the Executor type in
 * src/lib/executor/executor.ts. Executor seam (ADR 0015): there is
 * deliberately NO direct anthropicClient()/API call in this module, and
 * `callStructured` only ever appears as the injected default below — never
 * called directly.
 */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}) => Promise<unknown>;

export interface GenerateWriteupResult {
  writeup: string | null;
}

/**
 * One generation pass for a single Reel (T19.2 core): source content in,
 * `{ writeup }` out. `writeup` is null whenever the source content is too
 * thin to honestly elaborate on (ADR 0003) — the expected outcome for a
 * short/thin item, not a failure.
 */
export async function generateWriteup(
  source: WriteupSourceInput,
  reel: WriteupReelInput,
  caller: StructuredCaller = callStructured,
): Promise<GenerateWriteupResult> {
  const raw = await caller({
    system: WRITEUP_SYSTEM_PROMPT,
    user: buildWriteupUserPrompt(source, reel),
    toolName: WRITEUP_TOOL_NAME,
    inputSchema: writeupOutputJsonSchema as unknown as Record<string, unknown>,
  });
  const output = writeupOutputSchema.parse(raw);
  return { writeup: output.writeup };
}

/**
 * ADR 0024 decision 3 (cloud guard): the "Generate write-up" button must be
 * hidden — not merely disabled or left to 503 at click time — when the
 * resolved executor is `api` (the `claude-code` executor spawns the local
 * `claude` CLI, which does not exist under `APP_PROFILE=cloud`/Railway).
 * Resolved server-side (this reads `env()`, so it must never be called from
 * a `"use client"` component — see src/lib/env.ts) and passed down as a
 * plain boolean prop, same pattern as `newDays` (env().NEW_DAYS) elsewhere.
 */
export function writeupGenerationAvailable(): boolean {
  return resolveExecutionConfig(env()).executor !== "api";
}

export type WriteupStatus = "generated" | "already-present" | "not-found" | "empty" | "failed";

export interface WriteupResult {
  status: WriteupStatus;
}

/**
 * Runs on-demand Write-up generation for one Reel (T19.2, ADR 0024): loads
 * the Reel joined to raw_items (for raw_content) and sources (for the source
 * name), calls the model, and — only on a non-null result — persists
 * `reels.writeup`.
 *
 * Idempotency (ADR 0024 decision 4): a Reel that already has a write-up is
 * never re-generated — this returns "already-present" without calling the
 * model at all, one-shot per Reel, cached for good.
 *
 * Never throws for content-level problems (route-facing contract, same
 * never-abort-a-caller convention as the batch runners) — any failure to
 * generate or parse the result comes back as `{ status: "failed" }` so the
 * caller (the route) can map it to a clear error state instead of a 500.
 */
export async function runWriteupForReel(
  db: NodePgDatabase<typeof schema>,
  reelId: number,
  caller: StructuredCaller = callStructured,
): Promise<WriteupResult> {
  const rows = await db
    .select({
      id: reels.id,
      writeup: reels.writeup,
      summary: reels.summary,
      title: rawItems.title,
      rawContent: rawItems.rawContent,
      sourceName: sources.name,
    })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(eq(reels.id, reelId));

  const row = rows[0];
  if (!row) {
    return { status: "not-found" };
  }
  if (row.writeup !== null) {
    return { status: "already-present" };
  }

  try {
    const result = await generateWriteup(
      { title: row.title, sourceName: row.sourceName, rawContent: row.rawContent },
      { summary: row.summary },
      caller,
    );

    if (result.writeup === null) {
      return { status: "empty" };
    }

    await db.update(reels).set({ writeup: result.writeup }).where(eq(reels.id, row.id));
    return { status: "generated" };
  } catch (error) {
    console.error(`[writeup] reel ${reelId} failed:`, error);
    return { status: "failed" };
  }
}
