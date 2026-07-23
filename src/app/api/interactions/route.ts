import { NextResponse } from "next/server";
import { interactionRequestSchema, toggleInteraction } from "@/lib/interactions";

export const dynamic = "force-dynamic";

/**
 * Route handler backing the client action bar on ReelCard (T6.2):
 * POST { reelId, type, note? } toggles that interaction on that reel.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = interactionRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await toggleInteraction(parsed.data.reelId, parsed.data.type, parsed.data.note);
  if (!result) {
    return NextResponse.json({ error: "reel not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
