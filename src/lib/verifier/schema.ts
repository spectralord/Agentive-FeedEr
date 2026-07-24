import { z } from "zod";

/**
 * Forced-tool-call output for the Stage-1 Reel-Verifier (ADR 0011, T10.2):
 * a single nullable field. `null` is the expected, normal case (ADR 0003 —
 * "null instead of hallucination"; nothing to flag beats an invented flag).
 */
export const verifierOutputSchema = z.object({
  caveat: z.string().min(1).nullable(),
});

export type VerifierOutput = z.infer<typeof verifierOutputSchema>;

/** JSON schema handed to the model as forced tool input (kept in sync with zod above). */
export const verifierOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["caveat"],
  properties: {
    caveat: {
      type: ["string", "null"],
      description:
        "A short, factual, non-alarmist caveat if (A) the reel overclaims relative to the source text, or (B) the reel repeats a risky claim type (unsupported benchmark numbers, superlatives like 'replaces/kills X', single-case generalization) uncritically. null if the reel is faithful to the source and makes no risky claims — the normal, expected case.",
    },
  },
} as const;
