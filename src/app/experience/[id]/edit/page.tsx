import { notFound } from "next/navigation";
import { getReport } from "@/lib/experienceReports";

// Must reflect the report's current state per request (title/body/lifecycle
// can change between requests) — never a frozen build-time snapshot.
export const dynamic = "force-dynamic";

interface EditExperienceReportPageProps {
  params: Promise<{ id: string }>;
}

/**
 * `/experience/[id]/edit` (T9.5): prefilled form, posts to
 * `/experience/[id]/update`. No skill-tagging field in the MVP.
 */
export default async function EditExperienceReportPage({ params }: EditExperienceReportPageProps) {
  const { id } = await params;
  const reportId = Number(id);
  const report = Number.isInteger(reportId) ? await getReport(reportId) : undefined;

  if (!report) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16">
      <h1 className="text-sm font-semibold text-zinc-100">Bericht bearbeiten</h1>
      <form
        action={`/experience/${report.id}/update`}
        method="post"
        className="mt-4 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Titel
          <input
            type="text"
            name="title"
            required
            defaultValue={report.title}
            className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Text (Markdown)
          <textarea
            name="body"
            required
            rows={10}
            defaultValue={report.body}
            className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" name="important" value="1" defaultChecked={report.important} />
          ⭐ wichtig
        </label>
        <button
          type="submit"
          className="mt-2 self-start rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
        >
          Speichern
        </button>
      </form>
    </div>
  );
}
