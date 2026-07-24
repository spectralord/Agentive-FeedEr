import { getSavedReels } from "@/lib/interactions";
import { SavedList } from "@/components/SavedList";

// Newest-save-first list recomputed per request (same reasoning as /today and
// /overview — a static build-time snapshot would never reflect new saves).
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const reels = await getSavedReels();

  return (
    <div className="pb-16 pt-4">
      <div className="mx-auto max-w-xl px-4">
        <h1 className="text-sm font-semibold text-zinc-100">🔖 Saved ({reels.length})</h1>
      </div>
      <SavedList reels={reels} />
    </div>
  );
}
