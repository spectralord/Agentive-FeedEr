import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
  description: "KI-News als Reels — kuratiert, aufbereitet, anwendbar.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

const navItems = [
  { href: "/today", label: "Heute" },
  { href: "/", label: "Feed" },
  { href: "/overview", label: "Übersicht" },
  { href: "/saved", label: "Gespeichert" },
  { href: "/experience", label: "Erfahrung" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <header className="fixed inset-x-0 top-0 z-20 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
          <nav className="mx-auto flex max-w-xl items-center gap-1 px-4 py-2">
            <span className="mr-auto text-sm font-semibold tracking-tight">
              Agentive-FeedEr
            </span>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="pt-12">{children}</main>
      </body>
    </html>
  );
}
