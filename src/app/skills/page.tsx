import { listActiveNodes, listPendingNodes } from "@/lib/skilltagger/nodes";

// Pending proposals change with every pipeline run — never a frozen
// build-time snapshot (same reasoning as /overview, /experience).
export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const [pending, active] = await Promise.all([listPendingNodes(), listActiveNodes()]);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-lg font-semibold text-zinc-100">
        Neue Skills {pending.length > 0 && `(${pending.length})`}
      </h1>
      <p className="mt-1 text-xs text-zinc-500">
        Vorschläge des SkillTaggers (Match-or-Propose) — anlegen, in einen bestehenden Skill
        mergen oder verwerfen. Bestätigte Skills ordnet der nächste Lauf automatisch zu.
      </p>

      {pending.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Keine offenen Vorschläge.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {pending.map((node) => (
            <li key={node.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-100">{node.title}</span>
                <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                  {node.theme}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{node.description}</p>
              <p className="mt-1 text-[11px] text-zinc-600">Slug: {node.slug}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form method="post" action={`/skills/${node.id}/confirm`}>
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
                  >
                    Anlegen
                  </button>
                </form>

                {active.length > 0 && (
                  <form method="post" action={`/skills/${node.id}/merge`} className="flex items-center gap-1.5">
                    <select
                      name="targetSlug"
                      required
                      defaultValue=""
                      className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300"
                    >
                      <option value="" disabled>
                        In Skill mergen…
                      </option>
                      {active.map((a) => (
                        <option key={a.id} value={a.slug}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                    >
                      Mergen
                    </button>
                  </form>
                )}

                <form method="post" action={`/skills/${node.id}/discard`}>
                  <button type="submit" className="text-xs text-zinc-500 hover:text-red-400">
                    Verwerfen
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Bestehende Skills ({active.length})</h2>
          <ul className="flex flex-wrap gap-1.5">
            {active.map((node) => (
              <li
                key={node.id}
                className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400"
                title={node.description}
              >
                {node.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
