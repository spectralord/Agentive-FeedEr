import { z } from "zod";
import { THEMES } from "@/lib/skills";

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Flat, forced-tool-call output (same convention as
 * src/lib/enrichment/schema.ts: all fields required in the JSON schema so the
 * model always fills them, nullability + cross-field consistency enforced by
 * zod `.refine` on the way back). See ./tagger.ts for the mapping onto the
 * narrower `{ match } | { propose }` result type ADR 0009 describes.
 */
export const tagOutputSchema = z
  .object({
    decision: z.enum(["match", "propose"]),
    match_slug: z.string().min(1).nullable(),
    propose_slug: z
      .string()
      .regex(KEBAB_RE, "propose_slug must be a kebab-case slug")
      .nullable(),
    propose_title: z.string().min(1).nullable(),
    propose_theme: z.enum(THEMES).nullable(),
    propose_description: z.string().min(1).nullable(),
  })
  .refine((o) => o.decision !== "match" || o.match_slug !== null, {
    message: "decision=match requires match_slug",
    path: ["match_slug"],
  })
  .refine(
    (o) =>
      o.decision !== "propose" ||
      (o.propose_slug !== null &&
        o.propose_title !== null &&
        o.propose_theme !== null &&
        o.propose_description !== null),
    {
      message: "decision=propose requires all propose_* fields",
      path: ["propose_slug"],
    },
  );

export type TagOutput = z.infer<typeof tagOutputSchema>;

/** JSON schema handed to the model as forced tool input (kept in sync with zod above). */
export const tagOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "decision",
    "match_slug",
    "propose_slug",
    "propose_title",
    "propose_theme",
    "propose_description",
  ],
  properties: {
    decision: {
      type: "string",
      enum: ["match", "propose"],
      description:
        "'match' if the item genuinely is the same competency as one of the provided existing nodes; 'propose' if none fits well enough (a superficial keyword overlap is NOT enough — when in doubt, propose rather than force a match).",
    },
    match_slug: {
      type: ["string", "null"],
      description: "The slug of the matched existing node. Required iff decision=match, else null.",
    },
    propose_slug: {
      type: ["string", "null"],
      description:
        "English kebab-case slug for a new node (e.g. 'prompt-caching'). Required iff decision=propose, else null.",
    },
    propose_title: {
      type: ["string", "null"],
      description:
        "Short German title for the new node (e.g. 'Prompt-Caching einsetzen'). Required iff decision=propose, else null.",
    },
    propose_theme: {
      type: ["string", "null"],
      enum: [...THEMES, null],
      description: "One of the fixed themes. Required iff decision=propose, else null.",
    },
    propose_description: {
      type: ["string", "null"],
      description:
        "One short German sentence describing the competency. Required iff decision=propose, else null.",
    },
  },
} as const;
