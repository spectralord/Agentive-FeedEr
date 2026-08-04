import { z } from "zod";

/**
 * Flat, forced-tool-call output (same convention as
 * src/lib/skilltagger/schema.ts: all fields required in the JSON schema so
 * the model always fills them, nullability + cross-field consistency
 * enforced by zod `.refine` on the way back). See ./cluster.ts for the
 * mapping onto the narrower `{ match } | { propose }` result type ADR 0009 /
 * ADR 0013 describe.
 *
 * `is_primary` is required by the forced tool schema, but ./cluster.ts only
 * honours it for `decision=match` — for `decision=propose` the first member of
 * a brand-new cluster is primary by definition (ADR 0013 point 4), so the
 * model's judgement is intentionally not consulted there (see toResult in
 * ./cluster.ts).
 *
 * It is therefore **nullable**: the field's own description tells the model it is
 * "Ignored when decision=propose", and on the real corpus (2026-08-03) the model
 * took that at its word and returned `null` when proposing — which a
 * `z.boolean()` rejected, failing the whole item with a ZodError even though the
 * value would have been discarded. Accepting null here costs nothing (the
 * propose branch never reads it) and stops a well-behaved response from being
 * treated as a content-level failure.
 */
export const clusterOutputSchema = z
  .object({
    decision: z.enum(["match", "propose"]),
    match_cluster_id: z.number().int().positive().nullable(),
    propose_title: z.string().min(1).nullable(),
    is_primary: z.boolean().nullable(),
  })
  .refine((o) => o.decision !== "match" || o.match_cluster_id !== null, {
    message: "decision=match requires match_cluster_id",
    path: ["match_cluster_id"],
  })
  .refine((o) => o.decision !== "propose" || o.propose_title !== null, {
    message: "decision=propose requires propose_title",
    path: ["propose_title"],
  });

export type ClusterOutput = z.infer<typeof clusterOutputSchema>;

/** JSON schema handed to the model as forced tool input (kept in sync with zod above). */
export const clusterOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "match_cluster_id", "propose_title", "is_primary"],
  properties: {
    decision: {
      type: "string",
      enum: ["match", "propose"],
      description:
        "'match' if the new reel is genuinely about the same narrow, specific topic as one of the provided candidate clusters (a superficial keyword/theme overlap is NOT enough); 'propose' if none fits closely enough (when in doubt, propose rather than force a match).",
    },
    match_cluster_id: {
      type: ["number", "null"],
      description: "The id of the matched candidate cluster. Required iff decision=match, else null.",
    },
    propose_title: {
      type: ["string", "null"],
      description:
        "Short, specific English title for a new cluster naming the concrete thing (e.g. 'Claude Code batch command'). Required iff decision=propose, else null.",
    },
    is_primary: {
      type: "boolean",
      description:
        "Only meaningful when decision=match: true if this reel is an independent/first-hand account of the topic, false if it is a recognizable reblog/restatement of one of the cluster's existing sources. When in doubt, true. Ignored when decision=propose (the first member of a new cluster is primary by definition).",
    },
  },
} as const;
