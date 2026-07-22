/**
 * `/experience/new` (T9.5): plain HTML form, no client JS required — posts to
 * the `/experience/create` route handler. `author_type`/`author_label` are
 * fixed server-side ("own" + OWNER_NAME), never user-supplied. No
 * skill-tagging field in the MVP (Epic 12 scope).
 */
export default function NewExperienceReportPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16">
      <h1 className="text-sm font-semibold text-zinc-100">Neuer Erfahrungsbericht</h1>
      <form action="/experience/create" method="post" className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Titel
          <input
            type="text"
            name="title"
            required
            className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Text (Markdown)
          <textarea
            name="body"
            required
            rows={10}
            className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" name="important" value="1" />
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
