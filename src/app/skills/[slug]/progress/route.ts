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
 *
 * T18.5: when the status actually changed, the redirect carries `?from=<old
 * status>` so the destination page can play `SkillRing`'s one-time fill
 * animation (its `previousStatus` prop) — never on an ordinary page view,
 * only right after a real transition.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const form = await request.formData();
  const status = String(form.get("status") ?? "");
  const noteRaw = String(form.get("note") ?? "").trim();

  const result = await setProgressBySlug(slug, status, noteRaw || undefined);
  if (!result) {
    return NextResponse.json({ error: "invalid slug or status" }, { status: 400 });
  }

  const url = new URL(`/skills/${slug}`, request.url);
  if (result.previousStatus !== result.row.status) {
    url.searchParams.set("from", result.previousStatus);
  }
  return NextResponse.redirect(url, 303);
}
