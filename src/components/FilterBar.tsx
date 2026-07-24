import Link from "next/link";
import { CATEGORIES } from "@/lib/enrichment/schema";
import { CATEGORY_LABELS } from "./labels";

/** Filter state carried entirely in the URL — no client-state library (T3.4). */
export interface FilterState {
  category?: string;
  new?: string;
  weak?: string;
  before?: string;
}

/**
 * Builds the feed URL for a filter change. Preserves category/new/weak from
 * `current` unless overridden; always drops `before` — changing a filter
 * restarts pagination from the top.
 */
export function buildFilterHref(
  current: FilterState,
  overrides: Partial<Pick<FilterState, "category" | "new" | "weak">>,
): string {
  const merged = {
    category: current.category,
    new: current.new,
    weak: current.weak,
    ...overrides,
  };

  const params = new URLSearchParams();
  if (merged.category) params.set("category", merged.category);
  if (merged.new) params.set("new", merged.new);
  if (merged.weak) params.set("weak", merged.weak);

  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * Builds the "Load older" href: keeps category/new/weak from `current`
 * and sets `before` to the given cursor (T3.5 — server-side pagination).
 */
export function buildLoadMoreHref(current: FilterState, beforeIso: string): string {
  const params = new URLSearchParams();
  if (current.category) params.set("category", current.category);
  if (current.new) params.set("new", current.new);
  if (current.weak) params.set("weak", current.weak);
  params.set("before", beforeIso);
  return `/?${params.toString()}`;
}

function chipClass(active: boolean): string {
  return `shrink-0 rounded-full px-3 py-1 transition-colors ${
    active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
  }`;
}

export function FilterBar({ current }: { current: FilterState }) {
  const isNew = current.new === "1";
  const isWeak = current.weak === "1";

  return (
    <nav
      aria-label="Feed filter"
      className="fixed inset-x-0 top-12 z-10 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur"
    >
      <div className="mx-auto flex max-w-xl items-center gap-1.5 overflow-x-auto px-4 py-2 text-sm">
        {CATEGORIES.map((category) => {
          const active = current.category === category;
          return (
            <Link
              key={category}
              href={buildFilterHref(current, { category: active ? undefined : category })}
              className={chipClass(active)}
            >
              {CATEGORY_LABELS[category]}
            </Link>
          );
        })}
        <Link
          href={buildFilterHref(current, { new: isNew ? undefined : "1" })}
          className={chipClass(isNew)}
        >
          🆕 New
        </Link>
        <Link
          href={buildFilterHref(current, { weak: isWeak ? undefined : "1" })}
          className={`ml-auto shrink-0 rounded-full px-3 py-1 transition-colors ${
            isWeak
              ? "bg-amber-900/60 text-amber-200"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          Weak signal {isWeak ? "hide" : "show"}
        </Link>
      </div>
    </nav>
  );
}
