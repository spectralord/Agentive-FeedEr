/**
 * T18.14 (§10.8): the one client-side POST helper shared by every optimistic
 * mutation this task adds (progress on `/skills/[slug]`, the Reel Detail
 * Skill tab's "Mark as tried", and Experience lifecycle transitions).
 *
 * It always POSTs to the *caller-supplied* `action`/`method` — the exact
 * route + server mutation the plain `<form method="post">` already posts
 * to (§8.4's hard constraint: never a second write path). This file
 * contains no routing/mutation logic of its own; it is purely "send this
 * FormData to this URL, tell me if it worked" — every call site builds its
 * `FormData` from the real `<form>` element being submitted, so JS-driven
 * and no-JS submissions always carry identical fields.
 *
 * No-JS users never execute this: without JS, the plain
 * `<form method="post" action="...">` submits natively (full page POST +
 * redirect, unchanged) — this helper is only ever invoked from a
 * `"use client"` component's `onSubmit` handler, which only runs once React
 * has hydrated.
 */
export interface OptimisticPost {
  action: string;
  /** Defaults to "POST" — every call site's form is a POST, but this stays
   *  a parameter rather than a hardcoded literal so the helper mirrors
   *  whatever the real `<form>` element says, not an assumption about it. */
  method?: string;
  formData: FormData;
}

export async function submitFormOptimistic({ action, method, formData }: OptimisticPost): Promise<boolean> {
  try {
    const res = await fetch(action, { method: method || "POST", body: formData });
    return res.ok;
  } catch {
    return false;
  }
}
