import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AdminGearLink, AppBarTitle, TabBar } from "@/components/TabBar";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <header className="fixed inset-x-0 top-0 z-20 flex h-[var(--header-h)] items-center border-b border-hairline bg-ground/95 px-4 backdrop-blur">
          <AppBarTitle />
          <div className="ml-auto flex items-center gap-2.5">
            <AdminGearLink />
          </div>
        </header>
        <main className="pt-[var(--header-h)] pb-[var(--tabbar-h)]">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
