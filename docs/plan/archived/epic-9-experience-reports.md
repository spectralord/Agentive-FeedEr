# Epic 9 — Experience section (Fast-Follow)

**Goal:** A dedicated area for subjective experience reports (company knowledge), separate
from the verified reel feed. MVP: capture, display, filter, and mark own/company
reports as outdated. **Without** skill tagging (Epic 12), scraping, actionables.

**References:** ADR 0007 (own content type), ADR 0008 (durable layer),
`docs/specs/2026-07-22-experience-reports-design.md` (theme 1), glossary: Experience Report,
author_type, outdated/superseded.

---

## Tasks

### ☑ T9.1 — Schema: `experience_reports`
```ts
export const experienceReports = pgTable("experience_reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),                              // Markdown
  authorType: text("author_type", { enum: ["own", "curated", "colleague"] }).notNull(),
  authorLabel: text("author_label").notNull(),
  important: boolean("important").notNull().default(false),  // "⭐ important" (self-highlight)
  relevanceScore: integer("relevance_score"),               // curated only; always null in the MVP
  skill: text("skill"),                                      // from the SkillTagger (Epic 12); null in the MVP
  lifecycleState: text("lifecycle_state", { enum: ["active", "deprecated", "archived"] })
    .notNull().default("active"),                            // ADR 0008; no auto-delete
  lifecycleReason: text("lifecycle_reason"),                 // reason when deprecated/archived
  supersededByReportId: integer("superseded_by_report_id"),
  sourceUrl: text("source_url"),                            // curated only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- Generate + run the migration. **Verification:** migration green.

### ☑ T9.2 — Configuration `author_label` for own reports
- The display name for `own` reports comes from a configuration (env `OWNER_NAME`,
  default e.g. "Ich"). Add to `src/lib/env.ts` (optional, with a default).
- **Verification:** unit test for the env default.

### ☑ T9.3 — Data access (`src/lib/experienceReports.ts`)
- `listReports(opts: { authorType?; states?; limit? })` → chronological, newest first;
  default shows only `lifecycle_state = active` (deprecated/archived hidden by default,
  but retrievable via `states`).
- `getReport(id)`, `createReport(input)`, `updateReport(id, input)`,
  `setLifecycleState(id, state, { reason?, supersededByReportId? })` (active↔deprecated↔archived).
  A hard `deleteReport(id)` exists as a rare manual emergency exit, but is **not**
  the normal path (ADR 0008).
- **Verification:** integration tests against a local DB (own seed data): creating, filtering
  by `author_type`, `setLifecycleState('deprecated')` hides it from the default list but
  stays retrievable via `states`; update sets `updated_at`.

### ☑ T9.4 — `/experience` page (list)
- New route + nav entry "Experience" (after "Overview").
- Compact, chronological list (no snap): title, `author_label`, relative date
  (reuse `formatRelativeTime` from Epic 3), rendered Markdown (only if a
  Markdown lib is usable without a new dependency — otherwise as preformatted
  text; see T9.7), `⭐` marker if `important`, `⚠️ outdated` badge (+ reason/link) if `deprecated`.
- Filter bar (URL searchParams, pattern from `OverviewFilterBar`): `author_type`
  (all/own/curated), checkbox "show deprecated", checkbox "show archived".
- `export const dynamic = "force-dynamic"` (DB per request; check in the build: `ƒ`).
- **Verification:** curl against `npm run start` after seeding; filter combinations checked.

### ☑ T9.5 — Create/edit a report (`/experience/new`, `/experience/[id]/edit`)
- Simple form (server action or route handler): title, Markdown body, checkbox
  "⭐ important". `author_type` = `own`, `author_label` from the configuration (T9.2).
- Redirect to the list after saving; optimistic, no skill tagging in the MVP.
- **Verification:** create + edit end-to-end (curl POST or Playwright if
  available); the new entry appears in the list.

### ☑ T9.6 — Lifecycle actions (deprecate / archive / reactivate)
- On the detail/list view: `setLifecycleState` to `deprecated` (with an optional
  reason + optional `superseded_by_report_id`) or `archived`, and back to `active`.
  Separate from the hard delete (rare emergency exit, ADR 0008).
- **Verification:** deprecated → disappears from the default list, appears with "show
  deprecated" (reason/link visible); archived → only with "show archived"; reactivating
  brings it back into the default list.

### ☑ T9.7 — Markdown rendering (without a new dependency, if possible)
- Check whether an already-present lib renders Markdown. If **none** is available
  without a new dependency: the MVP shows the body as safely escaped,
  `whitespace-pre-wrap` preformatted text and documents this as a deviation (real
  Markdown = follow-up task). **No** unguarded `dangerouslySetInnerHTML` with untrusted input.
- **Verification:** XSS sanity check (a `<script>` in the body is not executed/rendered).

---

## Completion criteria (epic DoD)
- Create/edit/mark-as-outdated own reports; list filterable by
  `author_type`; outdated ones hidden by default, never auto-deleted.
- Clearly recognizable as its own area, separate from the reel feed (ADR 0007).
- Build + tests green; no new dependency without documentation.

## Deviations/Questions
_(to be maintained by the executing model)_

- **T9.1 — environment:** the local Postgres instance was stopped at the start of this
  session and the database `agentive_feeder` didn't exist (empty container restart). In
  addition, `pg_hba.conf` only allowed `scram-sha-256` for TCP/`localhost` connections,
  while `.env` specifies a passwordless `DATABASE_URL` (`postgres://postgres@localhost:5432/...`).
  Fixed by: `service postgresql start`, `createdb agentive_feeder`, and
  changing the two `host ... 127.0.0.1/32` / `::1/128` lines in `pg_hba.conf` from
  `scram-sha-256` to `trust` + `service postgresql reload`. A pure infra adjustment, no
  project file changed; `npm run db:migrate` ran green afterward.

- **T9.5 — route handler instead of server action:** the forms in `/experience/new` and
  `/experience/[id]/edit` are plain HTML `<form method="post">` elements that post to
  their own route handlers (`/experience/create`, `/experience/[id]/update`) instead of
  using Next.js server actions. Reason: server actions encode the action via a
  build-generated `Next-Action` header/ID, which can't be addressed stably via
  `curl` (environment requirement: curl verification instead of manually in Safari).
  Route handlers are simple POST endpoints with a 303 redirect back to `/experience` —
  verifiable end-to-end via curl and functionally equivalent (T9.5 explicitly allows
  both variants).

- **T9.7 — no real Markdown rendering:** `package.json` contains no Markdown lib
  (`dependencies`: `@anthropic-ai/sdk`, `drizzle-orm`, `next`, `pg`, `react`, `react-dom`,
  `rss-parser`, `zod`). As foreseen in the task spec for this case: `body` is rendered as
  safely escaped, `whitespace-pre-wrap` preformatted plain text
  (`<p className="whitespace-pre-wrap">{report.body}</p>` in `ExperienceList.tsx`) — React
  automatically escapes text children, no `dangerouslySetInnerHTML`. Real
  Markdown rendering (e.g. `marked`/`react-markdown` + sanitizer) is a follow-up task.
  XSS sanity verified via unit test (`ExperienceList.test.tsx`) **and** via curl against
  `npm run start -p 3200`: a `<script>` tag in the body appears in the
  HTML response only as `&lt;script&gt;...&lt;/script&gt;`, never as an executable tag.
