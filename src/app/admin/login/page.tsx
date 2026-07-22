import { redirect } from "next/navigation";
import { adminEnabled, isAuthed } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  if (!adminEnabled()) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-medium">Admin deaktiviert</p>
        <p className="text-sm text-zinc-400">
          Setze die Umgebungsvariable{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">ADMIN_TOKEN</code>{" "}
          (z. B. in Railway), um den Admin-Bereich zu aktivieren.
        </p>
      </div>
    );
  }

  if (await isAuthed()) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-lg font-semibold">Admin-Login</h1>
      {error && <p className="text-sm text-red-400">Falsches Token.</p>}
      <form method="post" action="/api/admin/login" className="flex flex-col gap-3">
        <input
          type="password"
          name="token"
          placeholder="ADMIN_TOKEN"
          autoComplete="off"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
        >
          Anmelden
        </button>
      </form>
    </div>
  );
}
