import { z } from "zod";
import type { InteractionType } from "@/lib/interactions";

export const FEEDBACK_TOOL_NAME = "submit_feedback_summary";

export const FEEDBACK_SYSTEM_PROMPT = `You analyze a developer's recent reactions (save/hide/up/down) to items in a personal AI-news feed and distill the observable pattern.

Binding rules:
- Output 5-8 short bullet points in English describing what the developer likes or skips, each phrased like "likes: …" or "skips: …" (e.g. "likes: concrete Claude Code examples", "skips: pure announcement news without substance").
- Base every bullet ONLY on the interactions provided below — no invented preferences, no speculation beyond what the data actually shows. If the data is too thin or mixed for a bullet, omit it rather than guessing (never invent, same principle as sourced-only content).
- Look for patterns across titles/categories/skills, not single-item anecdotes.
- Answer exclusively via the ${FEEDBACK_TOOL_NAME} tool.`;

export const feedbackSummarySchema = z.object({
  bullets: z.array(z.string().min(1)).min(5).max(8),
});
export type FeedbackSummaryOutput = z.infer<typeof feedbackSummarySchema>;

export const feedbackSummaryJsonSchema = {
  type: "object",
  properties: {
    bullets: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 8,
      description:
        '5-8 short English bullet points describing observed like/skip patterns, e.g. "likes: …" / "skips: …".',
    },
  },
  required: ["bullets"],
};

/** One interaction row enriched with the reel context the model needs to spot patterns. */
export interface RecentInteractionRow {
  type: InteractionType;
  createdAt: Date;
  title: string;
  category: string;
  skill: string | null;
}

const TYPE_LABELS: Record<InteractionType, string> = {
  save: "saved",
  hide: "hidden",
  up: "👍",
  down: "👎",
};

export function buildFeedbackUserPrompt(rows: RecentInteractionRow[]): string {
  const lines = rows.map(
    (r) =>
      `- ${TYPE_LABELS[r.type]}: "${r.title}" (Category: ${r.category}, Skill: ${r.skill ?? "—"})`,
  );
  return ["## Recent interactions (newest first)", ...lines].join("\n");
}
