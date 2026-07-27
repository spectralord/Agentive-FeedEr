import Link from "next/link";

/**
 * T18.12 (§10.7): one shared empty-state component, routed through by every
 * empty surface in the app — no CLI/build instructions in a user-facing
 * empty state (the feed's old copy told the reader to run
 * `npm run job:daily`; dropped here, replaced with something honest and
 * meaningful to a reader who has no idea what that command is).
 *
 * Three variants, matching the three shapes empty states already took
 * across the app before this task (kept, not invented, so nothing looks
 * newly cramped or newly spacious):
 * - "page": the whole route has nothing to show — centered in the
 *   remaining viewport height (feed, Today, a fully-empty list route).
 * - "inline": a list/section that would otherwise render a list has
 *   nothing — a centered paragraph inside the same `max-w-xl` column the
 *   list itself would have used (Saved, Experience, History).
 * - "compact": a smaller section embedded inside a page that has other
 *   content around it (Adoption Log, SOTA, the Skill Map) — a short,
 *   left-aligned muted line, matching those sections' pre-existing style.
 */

export interface EmptyStateAction {
  href: string;
  label: string;
}

export interface EmptyStateProps {
  title: string;
  message?: string;
  action?: EmptyStateAction;
  variant?: "page" | "inline" | "compact";
}

const CONTAINER_CLASS: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
  page: "mx-auto flex h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center",
  inline: "mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-10 text-center",
  compact: "mt-4 flex flex-col items-start gap-1",
};

export function EmptyState({ title, message, action, variant = "page" }: EmptyStateProps) {
  const compact = variant === "compact";

  return (
    <div className={CONTAINER_CLASS[variant]}>
      <p className={compact ? "text-sm text-ink-muted" : "text-lg font-medium text-ink"}>{title}</p>
      {message && <p className="text-sm text-ink-muted">{message}</p>}
      {action && (
        <Link
          href={action.href}
          className="rounded-full border border-hairline-strong bg-surface-raised px-4 py-2 text-sm text-ink transition-colors hover:bg-hairline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
