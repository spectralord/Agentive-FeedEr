import { NextResponse } from "next/server";
import { setProgressBySlug } from "@/lib/skills/map";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Route handler backing the status-change forms on `/skills/[slug]` (T7.3):
 * self-declared `seen -> tried -> mastered`, downgrade allowed, optional
 * note. Plain HTML form POST + redirect, same pattern as the SkillTagger
 * confirm/merge/discard routes and the Experience lifecycle route.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const form = await request.formData();
  const status = String(form.get("status") ?? "");
  const noteRaw = String(form.get("note") ?? "").trim();

  const updated = await setProgressBySlug(slug, status, noteRaw || undefined);
  if (!updated) {
    return NextResponse.json({ error: "invalid slug or status" }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/skills/${slug}`, request.url), 303);
}
