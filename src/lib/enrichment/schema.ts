import { z } from "zod";

export const CATEGORIES = [
  "claude-feature",
  "tooling",
  "technique",
  "industry-news",
  "research",
  "opinion",
] as const;

export const MATURITIES = ["experimental", "emerging", "established"] as const;
export const EFFORT_TAGS = ["5-min-test", "afternoon", "know-only"] as const;

export const reelOutputSchema = z
  .object({
    summary: z.string().min(1),
    category: z.enum(CATEGORIES),
    maturity: z.enum(MATURITIES),
    experimental: z.boolean(),
    relevance_score: z.number().int().min(0).max(100),
    quality_score: z.number().int().min(0).max(100),
    example: z.string().min(1).nullable(),
    action: z.string().min(1).nullable(),
    effort_tag: z.enum(EFFORT_TAGS).nullable(),
    skill: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "skill must be a kebab-case slug")
      .nullable(),
  })
  .refine((o) => o.action !== null || o.effort_tag === null, {
    message: "effort_tag requires action",
    path: ["effort_tag"],
  });

export type ReelOutput = z.infer<typeof reelOutputSchema>;

/** JSON schema handed to the model as forced tool input (kept in sync with zod above). */
export const reelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "category",
    "maturity",
    "experimental",
    "relevance_score",
    "quality_score",
    "example",
    "action",
    "effort_tag",
    "skill",
  ],
  properties: {
    summary: {
      type: "string",
      description: "German summary, 2-4 sentences, factual, no hype language.",
    },
    category: { type: "string", enum: [...CATEGORIES] },
    maturity: { type: "string", enum: [...MATURITIES] },
    experimental: {
      type: "boolean",
      description:
        "true if the content is an impulse/experiment/'just tried this out', independent of maturity.",
    },
    relevance_score: { type: "integer", minimum: 0, maximum: 100 },
    quality_score: { type: "integer", minimum: 0, maximum: 100 },
    example: {
      type: ["string", "null"],
      description:
        "Concrete example/code taken from the source only. null if the source contains none. Never invent.",
    },
    action: {
      type: ["string", "null"],
      description:
        "One concrete German action sentence supported by the source. null if none. Never invent.",
    },
    effort_tag: {
      type: ["string", "null"],
      enum: [...EFFORT_TAGS, null],
      description: "Effort estimate for the action; must be null when action is null.",
    },
    skill: {
      type: ["string", "null"],
      description:
        "Short English kebab-case competency slug (e.g. agentic-tool-use, prompt-caching, mcp-servers) or null.",
    },
  },
} as const;
