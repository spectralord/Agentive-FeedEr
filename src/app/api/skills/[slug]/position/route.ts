import { NextResponse } from "next/server";
import { z } from "zod";
import { LAYOUT_SPACE_SIZE } from "@/lib/skills/layout";
import { resetNodePositionBySlug, setNodePositionBySlug } from "@/lib/skills/map";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// Either a manual override write ({x, y}) or a reset ({reset: true}) — one
// route, discriminated by shape, mirroring T21.5's "same write path, two
// directions" framing (set a lock vs. clear it). Coordinates are clamped to
// the abstract 0-LAYOUT_SPACE_SIZE square client-side already (the drag
// handler never emits outside it), but the API validates independently
// rather than trusting the client.
const positionRequestSchema = z.union([
  z.object({
    x: z.number().min(0).max(LAYOUT_SPACE_SIZE),
    y: z.number().min(0).max(LAYOUT_SPACE_SIZE),
  }),
  z.object({ reset: z.literal(true) }),
]);

/**
 * Drag-to-place write path (T21.5, ADR 0020 decision 5): POST { x, y } sets
 * a manual override (position_locked = true); POST { reset: true } clears
 * it back to the computed/hash tiers. Called from a client component (the
 * drag handler tracks pointer movement, so this can't be a plain HTML form
 * submit), so JSON in, JSON out — same convention as
 * `/api/reels/[id]/writeup` and `/api/interactions`.
 *
 * Desktop/iPad only at the UI layer (ADR 0020 decision 5 — dragging is
 * fiddly on phones and this is a rare curation activity); this route itself
 * has no viewport gate, since a route can't know the caller's screen size
 * and shouldn't try to — the gate is what UI surfaces the drag affordance
 * at all (`SkillConstellation`'s desktop-only edit mode).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = positionRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row =
    "reset" in parsed.data
      ? await resetNodePositionBySlug(slug)
      : await setNodePositionBySlug(slug, parsed.data.x, parsed.data.y);

  if (!row) {
    return NextResponse.json({ error: "unknown or inactive slug" }, { status: 404 });
  }

  return NextResponse.json({
    slug: row.slug,
    positionX: row.positionX,
    positionY: row.positionY,
    positionLocked: row.positionLocked,
  });
}
