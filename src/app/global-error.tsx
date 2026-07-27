"use client";

/**
 * T18.8 (§10.2): the root layout (`layout.tsx`) itself reads the DB on every
 * request (T18.11's freshness indicator, `force-dynamic`) — so a DB outage
 * doesn't just break one page, it can throw *inside the layout*. A
 * segment's own `error.tsx` never catches errors thrown by that same
 * segment's `layout.tsx` (only by its `page.tsx`/children) — that is a Next
 * rule, not a bug — so without this file, a layout-level failure falls
 * through to Next's raw, unstyled built-in fallback: the exact "dead app"
 * failure mode §10.2 is about, just one level higher than a normal page
 * error. `global-error.tsx` is the one boundary that *can* catch a root
 * layout error; Next requires it to render its own `<html>`/`<body>` since
 * it replaces the entire root layout when active.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0d10", color: "#eef1f2" }}>
        <div
          style={{
            margin: "0 auto",
            display: "flex",
            minHeight: "100dvh",
            maxWidth: "36rem",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "0 1.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "1.125rem", fontWeight: 500 }}>Something went wrong</p>
          <p style={{ fontSize: "0.875rem", color: "#9aa7ac" }}>
            The app couldn&apos;t load. Nothing was lost — try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "9999px",
              border: "1px solid #2e373e",
              background: "#171d22",
              color: "#eef1f2",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
