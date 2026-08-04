/**
 * One-off repair: translate German Reel text to English, in place.
 *
 * Why this exists: `profile.md` was written in German and is injected as the first
 * section of every enrichment prompt, so the model mirrored it and produced German
 * `summary`/`example`/`action` text for most of the corpus, despite the system
 * prompt asking for English three times. The profile is fixed (2026-08-03); this
 * repairs the rows already written, which is far cheaper than re-enriching them —
 * re-enrichment would re-read the source and re-score every item.
 *
 * Deliberately a translation, NOT a re-enrichment: scores, category, maturity and
 * every other judgement are left exactly as they were. Only the prose language
 * changes, so this cannot silently alter what is visible in the feed.
 *
 * Batched — many Reels per model call, not one call per Reel.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env scripts/translate-summaries.mts [batchSize]
 */
import { and, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { reels } from "@/db/schema";
import { env } from "@/lib/env";
import { resolveExecutionConfig } from "@/lib/executor/config";
import { getExecutor } from "@/lib/executor/executor";

const BATCH = Number(process.argv[2] ?? 12);

/** Crude German detector — the same word list used to audit the damage. */
const GERMAN = /\m(behebt|verbessert|bringt|Verbesserungen|wurde|werden|nicht|über|für|und die|das System|Fehler|ermöglicht|Nutzer)\M/;

interface Row {
  id: number;
  summary: string;
  example: string | null;
  action: string | null;
}

const schemaForBatch = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "summary", "example", "action"],
        properties: {
          id: { type: "number" },
          summary: { type: "string" },
          example: { type: ["string", "null"] },
          action: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const SYSTEM = `You translate existing feed text from German to English.

Binding rules:
- TRANSLATE ONLY. Do not summarise, shorten, expand, improve, or re-judge anything.
- Preserve meaning exactly, including technical terms, product names, version numbers and numbers.
- Text already in English: return it UNCHANGED, byte for byte.
- A null "example" or "action" stays null. Never invent content for a null field.
- Return every id you were given, exactly once.
- Answer exclusively via the submit_translations tool.`;

async function main() {
  const rows = (await db()
    .select({ id: reels.id, summary: reels.summary, example: reels.example, action: reels.action })
    .from(reels)
    .where(
      or(
        sql`${reels.summary} ~* ${GERMAN.source}`,
        and(isNotNull(reels.action), sql`${reels.action} ~* ${GERMAN.source}`),
        and(isNotNull(reels.example), sql`${reels.example} ~* ${GERMAN.source}`),
      ),
    )) as Row[];

  if (rows.length === 0) {
    console.log("nothing to translate");
    return;
  }
  console.log(`${rows.length} reels to translate, batch size ${BATCH}`);

  const executor = getExecutor(resolveExecutionConfig(env()));
  let translated = 0;
  let failedBatches = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const label = `${i + 1}-${i + batch.length}/${rows.length}`;
    try {
      const raw = await executor({
        system: SYSTEM,
        user: `Translate these ${batch.length} items to English.\n\n${JSON.stringify(batch, null, 1)}`,
        toolName: "submit_translations",
        inputSchema: schemaForBatch as unknown as Record<string, unknown>,
      });

      const parsed = raw as { items?: Row[] };
      if (!Array.isArray(parsed.items)) throw new Error("no items array in response");

      const byId = new Map(batch.map((r) => [r.id, r]));
      await db().transaction(async (tx) => {
        for (const item of parsed.items!) {
          if (!byId.has(item.id) || typeof item.summary !== "string" || !item.summary.trim()) continue;
          await tx
            .update(reels)
            .set({ summary: item.summary, example: item.example ?? null, action: item.action ?? null })
            .where(inArray(reels.id, [item.id]));
          translated++;
        }
      });
      console.log(`  ${label} ok`);
    } catch (error) {
      failedBatches++;
      console.error(`  ${label} FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`translated ${translated} reels; ${failedBatches} batch(es) failed`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
