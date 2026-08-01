import { NextResponse } from "next/server";
import { z } from "zod";
import { toggleActionable } from "@/lib/actionables";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ note: z.string().min(1).optional() });

/**
 * The ONE HTTP entry point for `toggleActionable` (design doc §8.4, same
 * rule as `setProgress`/`/skills/[slug]/progress`). Both the Reel Detail
 * Skill tab and the node page's To-Try list POST here — there is no second
 * route or a direct DB write from either surface.
 */
export async function POST(request: Request, { params }: { params: Promise<{ reelId: string }> }) {
  const { reelId: reelIdRaw } = await params;
  const reelId = Number(reelIdRaw);
  if (!Number.isInteger(reelId) || reelId <= 0) {
    return NextResponse.json({ error: "invalid reelId" }, { status: 400 });
  }

  let note: string | undefined;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) note = parsed.data.note;
  } catch {
    // Empty/absent body is fine — note is optional.
  }

  const result = await toggleActionable(reelId, note);
  if (!result.ok) {
    const status = result.reason === "not-found" ? 404 : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }

  if (result.state === "incomplete") {
    return NextResponse.json({ state: "incomplete" as const });
  }
  return NextResponse.json({
    state: "completed" as const,
    completion: {
      actionText: result.completion.actionText,
      effortTag: result.completion.effortTag,
      note: result.completion.note,
      doneAt: result.completion.doneAt.toISOString(),
    },
  });
}
