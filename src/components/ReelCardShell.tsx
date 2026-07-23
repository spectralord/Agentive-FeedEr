"use client";

import { useState } from "react";
import type { ReelActionFlags } from "@/lib/interactions";
import { ReelActions } from "./ReelActions";

interface ReelCardShellProps {
  reelId: number;
  initial: ReelActionFlags;
  children: React.ReactNode;
}

/**
 * Wraps one reel card with the hide-to-remove behaviour (T6.2): clicking 🙈
 * in ReelActions removes this card from the current view immediately, no
 * full reload. `children` is the (server-rendered) reel content passed down
 * from ReelCard — a Client Component may render Server Component output as
 * children like this.
 */
export function ReelCardShell({ reelId, initial, children }: ReelCardShellProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <article className="reel relative min-h-dvh snap-start [scroll-snap-stop:always]">
      {children}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
        <div className="pointer-events-auto flex w-full max-w-xl justify-end">
          <ReelActions reelId={reelId} initial={initial} onHidden={() => setHidden(true)} />
        </div>
      </div>
    </article>
  );
}
