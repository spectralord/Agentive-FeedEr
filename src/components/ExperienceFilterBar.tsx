import Link from "next/link";

/**
 * `/experience` filter state carried entirely in the URL (T9.4, same
 * URL-searchParams pattern as OverviewFilterBar — no client-state library).
 * Absent fields mean the widest default per T9.3: no author_type filter,
 * deprecated/archived hidden.
 */
export interface ExperienceFilterState {
  authorType?: string; // "own" | "curated" — absent = alle
  deprecated?: string; // "1" shows deprecated reports too
  archived?: string; // "1" shows archived reports too
}

const AUTHOR_TYPE_FILTERS: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: "Alle" },
  { value: "own", label: "Eigen" },
  { value: "curated", label: "Kuratiert" },
];

/**
 * Builds the /experience URL for a filter change. Preserves every other
 * field from `current` unless overridden.
 */
export function buildExperienceHref(
  current: ExperienceFilterState,
  overrides: Partial<ExperienceFilterState>,
): string {
  const merged = { ...current, ...overrides };

  const params = new URLSearchParams();
  if (merged.authorType) params.set("authorType", merged.authorType);
  if (merged.deprecated) params.set("deprecated", merged.deprecated);
  if (merged.archived) params.set("archived", merged.archived);

  const qs = params.toString();
  return qs ? `/experience?${qs}` : "/experience";
}

function chipClass(active: boolean): string {
  return `shrink-0 rounded-full px-3 py-1 transition-colors ${
    active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
  }`;
}

export function ExperienceFilterBar({ current }: { current: ExperienceFilterState }) {
  const showDeprecated = current.deprecated === "1";
  const showArchived = current.archived === "1";

  return (
    <nav
      aria-label="Erfahrung-Filter"
      className="border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur"
    >
      <div className="mx-auto flex max-w-xl items-center gap-1.5 overflow-x-auto px-4 py-1.5 text-sm">
        {AUTHOR_TYPE_FILTERS.map((f) => {
          const active = current.authorType === f.value || (!current.authorType && !f.value);
          return (
            <Link
              key={f.label}
              href={buildExperienceHref(current, { authorType: f.value })}
              className={chipClass(active)}
            >
              {f.label}
            </Link>
          );
        })}
        <Link
          href={buildExperienceHref(current, { deprecated: showDeprecated ? undefined : "1" })}
          className={`ml-auto shrink-0 rounded-full px-3 py-1 transition-colors ${
            showDeprecated
              ? "bg-amber-900/60 text-amber-200"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          ⚠️ veraltete {showDeprecated ? "ausblenden" : "zeigen"}
        </Link>
        <Link
          href={buildExperienceHref(current, { archived: showArchived ? undefined : "1" })}
          className={`shrink-0 rounded-full px-3 py-1 transition-colors ${
            showArchived
              ? "bg-zinc-700 text-zinc-200"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          🗄️ archivierte {showArchived ? "ausblenden" : "zeigen"}
        </Link>
      </div>
    </nav>
  );
}
