/** Small source-initial avatar (first two alphanumeric characters of the
 *  source name, uppercased) — shared between `ReelStackCard`'s expandable
 *  source list (T18.2) and the Reel Detail's Context tab source list
 *  (T18.6), so both surfaces render "N sources on this topic" identically
 *  rather than each re-inventing the same small piece of chrome.
 *  Matches `docs/specs/prototypes/reel-card-and-detail.html`'s
 *  `.source-avatar`. */
export function initials(sourceName: string): string {
  return sourceName.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
}

export function SourceAvatar({ sourceName }: { sourceName: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-hairline-strong bg-surface-raised font-mono text-[10.5px] font-semibold text-accent"
    >
      {initials(sourceName)}
    </span>
  );
}
