import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { db } from "@/db/client";
import { getFreshnessInfo } from "@/lib/freshness";
import { getLatestSuccessfulRunFinishedAt } from "@/lib/pipeline";
import { AdminGearLink, AppBarFreshness, AppBarTitle, TabBar } from "@/components/TabBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agentive-FeedEr",
  description: "AI news as Reels — curated, prepared, actionable.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

// T18.11 (§10.3): the root layout now reads `pipeline_runs` on every request
// (the freshness indicator). Without forcing this segment dynamic, Next's
// static-optimization pass tries to execute that query at *build* time for
// any still-statically-eligible leaf page (`/experience/new`, `/_not-found`)
// — which fails the production build outright if Postgres isn't reachable
// during the build step (a real, reproduced failure: `next build` with
// Postgres stopped throws `ECONNREFUSED` prerendering `/experience/new`).
// Every other page in this app is already `force-dynamic` (§10.2) for the
// same "never a frozen build-time snapshot" reason: pipeline_runs is exactly
// as live as the reels it fetches from.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // T18.11 (§10.3): fetched unconditionally in the root layout (one cheap
  // single-row query per request, same "always fetch, let the component hide
  // itself" approach the prototype's own script uses for `#fresh`) — pre-
  // formatted into a string server-side (see T18.6's notes on why Dates
  // aren't passed across the server/client boundary directly in this repo).
  const lastRunAt = await getLatestSuccessfulRunFinishedAt(db());
  const freshness = getFreshnessInfo(lastRunAt);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* T18.10 (§10.1, ADR 0023): the old 7-links-plus-brand flex row
          overflowed a 375px phone with no wrap/scroll. Replaced with a
          slim app bar (contextual title + gear) and a persistent bottom
          tab bar carrying the four real destinations — see TabBar.tsx for
          the tab list and the binding "new surfaces go in a hub" rule. */}
      <body className="min-h-full bg-ground text-ink">
        <header className="fixed inset-x-0 top-0 z-20 flex h-[var(--header-h)] items-center gap-2.5 border-b border-hairline bg-ground/95 px-4 backdrop-blur">
          <AppBarTitle />
          <div className="ml-auto flex items-center gap-2.5">
            <AppBarFreshness label={freshness.label} stale={freshness.stale} />
            <AdminGearLink />
          </div>
        </header>
        <main className="pt-[var(--header-h)] pb-[var(--tabbar-h)]">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
