export default function FeedPage() {
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium">Noch keine Reels</p>
      <p className="text-sm text-zinc-400">
        Die Pipeline läuft ab Epic 1/2 — Quellen einsammeln mit{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">
          npm run job:daily
        </code>
      </p>
    </div>
  );
}
