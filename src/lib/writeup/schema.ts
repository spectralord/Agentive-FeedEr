import { z } from "zod";

/**
 * Forced-tool-call output for on-demand Write-up generation (ADR 0024, T19.1):
 * a single nullable field, same shape/rationale as src/lib/verifier/schema.ts.
 * `null` is not an edge case to guard against — it is the correct answer
 * whenever the stored source content is too thin to elaborate on honestly
 * (ADR 0003 "null over hallucination"; ADR 0005 sourced-only). The runner
 * (run.ts) leaves `reels.writeup` untouched when this comes back null.
 */
export const writeupOutputSchema = z.object({
  writeup: z.string().min(1).nullable(),
});

export type WriteupOutput = z.infer<typeof writeupOutputSchema>;

/** JSON schema handed to the model as forced tool input (kept in sync with zod above). */
export const writeupOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["writeup"],
  properties: {
    writeup: {
      type: ["string", "null"],
      description:
        "A few paragraphs of plain prose elaborating on the supplied source content — no headings, no invented claims, no outside knowledge. null if the supplied source content is too thin to honestly elaborate on (do not pad).",
    },
  },
} as const;
