import Link from "next/link";
import type { FeedCategory, FeedReel } from "@/lib/feed";
import { CATEGORIES } from "@/lib/enrichment/schema";
import { formatRelativeTime } from "@/lib/relativeTime";
import { CATEGORY_LABELS } from "./labels";

const MAX_PER_CATEGORY = 5;

export interface SotaGroup {
  category: FeedCategory;
  reels: FeedReel[];
}

/**
 * Groups already-SOTA-filtered reels by category, sorted within each group by
 * `relevanceScore * qualityScore` descending (T5.2 — explicitly NOT by date:
 * SOTA is age-independent, see ADR 0004 / src/lib/labels.ts#isSota), capped
 * at 5 per category. Category order follows the fixed CATEGORIES list so the
 * section renders deterministically.
 */
export function groupSota(sotaReels: FeedReel[]): SotaGroup[] {
  const byCategory = new Map<FeedCategory, FeedReel[]>();
  for (const reel of sotaReels) {
    const list = byCategory.get(reel.category) ?? [];
    list.push(reel);
    byCategory.set(reel.category, list);
  }

  const groups: SotaGroup[] = [];
  for (const category of CATEGORIES) {
    const list = byCategory.get(category);
    if (!list || list.length === 0) continue;
    const sorted = [...list].sort(
      (a, b) => b.relevanceScore * b.qualityScore - a.relevanceScore * a.qualityScore,
    );
    groups.push({ category, reels: sorted.slice(0, MAX_PER_CATEGORY) });
  }
  return groups;
}

/** First sentence of a summary (falls back to the whole string if no terminator is found). */
function firstSentence(text: string): string {
  const match = /^[^.!?]*[.!?]/.exec(text.trim());
  return match ? match[0].trim() : text.trim();
}

export function SotaSection({ groups }: { groups: SotaGroup[] }) {
  return (
    <section aria-labelledby="sota-heading" className="mx-auto max-w-xl px-4 pt-6">
      <h2 id="sota-heading" className="text-sm font-semibold text-zinc-100">
        ⭐ Aktueller State of the Art
      </h2>

      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">Noch keine SOTA-Reels.</p>
      ) : (
        groups.map((group) => (
          <div key={group.category} className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {CATEGORY_LABELS[group.category]}
            </h3>
            <ul className="mt-1.5 flex flex-col gap-2.5">
              {group.reels.map((reel) => (
                <li key={reel.id} className="text-sm">
                  <Link
                    href={`/?category=${reel.category}`}
                    className="font-medium text-zinc-100 hover:underline"
                  >
                    {reel.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-400">{firstSentence(reel.summary)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    <time dateTime={reel.publishedAt.toISOString()}>
                      {formatRelativeTime(reel.publishedAt)}
                    </time>
                    {" · R "}
                    {reel.relevanceScore} {" · Q "}
                    {reel.qualityScore}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
