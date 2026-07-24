import Link from "next/link";
import { CATEGORIES, MATURITIES } from "@/lib/enrichment/schema";
import { CATEGORY_LABELS, MATURITY_LABELS } from "./labels";

/**
 * History filter state carried entirely in the URL (T5.3, same pattern as
 * FilterBar/T3.4 — no client-state library). Absent fields mean the widest
 * setting: period=all, no category/maturity filter, minRelevance=0,
 * bestPractice off, experimental included (shown).
 */
export interface OverviewFilterState {
  period?: string; // "7" | "30" | "90" — absent = "alles"
  category?: string;
  maturity?: string;
  minRelevance?: string; // "50" | "70" — absent = "0" (no floor)
  bestPractice?: string; // "1"
  experimental?: string; // "0" hides flagged reels; absent/anything else shows them (default on)
}

const PERIODS: Array<{ value: string | undefined; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: undefined, label: "All" },
];

const RELEVANCE_STEPS: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: "Relevance: all" },
  { value: "50", label: "Relevance ≥ 50" },
  { value: "70", label: "Relevance ≥ 70" },
];

/**
 * Builds the /overview URL for a filter change. Preserves every other field
 * from `current` unless overridden.
 */
export function buildOverviewHref(
  current: OverviewFilterState,
  overrides: Partial<OverviewFilterState>,
): string {
  const merged = { ...current, ...overrides };

  const params = new URLSearchParams();
  if (merged.period) params.set("period", merged.period);
  if (merged.category) params.set("category", merged.category);
  if (merged.maturity) params.set("maturity", merged.maturity);
  if (merged.minRelevance) params.set("minRelevance", merged.minRelevance);
  if (merged.bestPractice) params.set("bestPractice", merged.bestPractice);
  if (merged.experimental) params.set("experimental", merged.experimental);

  const qs = params.toString();
  return qs ? `/overview?${qs}` : "/overview";
}

function chipClass(active: boolean): string {
  return `shrink-0 rounded-full px-3 py-1 transition-colors ${
    active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
  }`;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-1.5 text-sm">
      {children}
    </div>
  );
}

export function OverviewFilterBar({ current }: { current: OverviewFilterState }) {
  const bestPractice = current.bestPractice === "1";
  const hideExperimental = current.experimental === "0";

  return (
    <nav
      aria-label="History filter"
      className="border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur"
    >
      <div className="mx-auto max-w-xl">
        <ChipRow>
          {PERIODS.map((p) => {
            const active = current.period === p.value || (!current.period && !p.value);
            return (
              <Link
                key={p.label}
                href={buildOverviewHref(current, { period: p.value })}
                className={chipClass(active)}
              >
                {p.label}
              </Link>
            );
          })}
        </ChipRow>
        <ChipRow>
          {CATEGORIES.map((category) => {
            const active = current.category === category;
            return (
              <Link
                key={category}
                href={buildOverviewHref(current, { category: active ? undefined : category })}
                className={chipClass(active)}
              >
                {CATEGORY_LABELS[category]}
              </Link>
            );
          })}
        </ChipRow>
        <ChipRow>
          {MATURITIES.map((maturity) => {
            const active = current.maturity === maturity;
            return (
              <Link
                key={maturity}
                href={buildOverviewHref(current, { maturity: active ? undefined : maturity })}
                className={chipClass(active)}
              >
                {MATURITY_LABELS[maturity]}
              </Link>
            );
          })}
        </ChipRow>
        <ChipRow>
          {RELEVANCE_STEPS.map((step) => {
            const active =
              current.minRelevance === step.value || (!current.minRelevance && !step.value);
            return (
              <Link
                key={step.label}
                href={buildOverviewHref(current, { minRelevance: step.value })}
                className={chipClass(active)}
              >
                {step.label}
              </Link>
            );
          })}
          <Link
            href={buildOverviewHref(current, { bestPractice: bestPractice ? undefined : "1" })}
            className={chipClass(bestPractice)}
          >
            🛠️ Best Practice only
          </Link>
          <Link
            href={buildOverviewHref(current, { experimental: hideExperimental ? undefined : "0" })}
            className={`ml-auto shrink-0 rounded-full px-3 py-1 transition-colors ${
              hideExperimental
                ? "bg-amber-900/60 text-amber-200"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            🧪 experimental {hideExperimental ? "show" : "hide"}
          </Link>
        </ChipRow>
      </div>
    </nav>
  );
}
