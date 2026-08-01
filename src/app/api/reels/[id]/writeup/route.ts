import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { resolveExecutionConfig } from "@/lib/executor/config";
import { getExecutor } from "@/lib/executor/executor";
import { runWriteupForReel } from "@/lib/writeup/run";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * On-demand Write-up generation for one Reel (T19.3, ADR 0024): the button
 * in the Write-up tab POSTs here with no body. Called from a client
 * component, so this returns JSON (`{ status }` from runWriteupForReel) —
 * unlike the admin mutation routes, which POST-and-redirect a full page.
 *
 * No auth (single-user MVP, docs/plan/README.md §2).
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const reelId = Number(id);
  if (!Number.isInteger(reelId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // Cloud guard (ADR 0024 decision 3): the claude-code executor spawns the
  // `claude` CLI, which only exists on the app host. Under APP_PROFILE=cloud
  // the resolved executor is `api` — the paid Anthropic API, which this
  // feature must never use (ADR 0024 decision 2) — so fail loudly and
  // explicitly here instead of either silently spending API credit or
  // mysteriously failing deeper in the stack.
  const config = resolveExecutionConfig(env());
  if (config.executor === "api") {
    return NextResponse.json(
      {
        error:
          "Write-up generation requires the claude-code executor (local subscription quota) and is unavailable under the current cloud/api execution profile.",
      },
      { status: 503 },
    );
  }

  const executor = getExecutor(config);
  const result = await runWriteupForReel(db(), reelId, executor);
  return NextResponse.json(result);
}
