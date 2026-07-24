# Epic 7 — Skill-Map (Vision-Flaggschiff)

**Ziel:** Kompetenz-Knoten statt Reel-Konfetti: Reels sammeln sich unter Skill-Nodes,
gruppiert in Themen-Cluster, mit Fortschritt `gesehen → ausprobiert → gemeistert`
per Selbst-Bestätigung + Adoption-Log. **Kein** Voraussetzungs-Baum (bewusste
Entscheidung: Skill-*Map*, Variante A).

**Referenzen:** Glossar: Skill-Node, Skill-Map, user_progress, Adoption-Log;
Grill-Entscheidungen (Knoten = Kompetenzen; Selbst-Bestätigung; keine Gates).

> **Revidiert 2026-07-22** (siehe `docs/specs/2026-07-22-experience-reports-design.md`):
> (1) **Epic 12 (SkillTagger) zuerst bauen** — T7.2 (Node-Aggregation) wird davon
> ersetzt/erweitert; `skill_nodes` ist in Epic 12 T12.1 definiert (inkl. `pending`-Status).
> (2) Fortschritt läuft zusätzlich über abgehakte **Actionables** (aus Reels *und*
> Erfahrungsberichten), nicht nur über Selbst-Status; beides existiert nebeneinander.
> (3) Auf Skill-Nodes tauchen auch **Erfahrungsberichte** (Epic 9) gelabelt neben Reels auf.

---

## Tasks

### ☑ T7.1 — Schema: `skill_nodes` + `user_progress`
```ts
export const skillNodes = pgTable("skill_nodes", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),        // = reels.skill (kebab-case)
  title: text("title").notNull(),               // deutsch, lesbar
  theme: text("theme").notNull(),               // Cluster, z. B. "Agentic Development"
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userProgress = pgTable("user_progress", {
  skillNodeId: integer("skill_node_id").primaryKey().references(() => skillNodes.id),
  status: text("status", { enum: ["seen","tried","mastered"] }).notNull().default("seen"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- **Verifikation:** Migration grün.

### ☐ T7.2 — Node-Aggregation im Daily-Job
- Nach dem Enrichment: alle distinct `reels.skill`-Slugs ohne `skill_nodes`-Eintrag →
  **ein** Claude-Call (Batch) erzeugt pro neuem Slug `{ title, theme, description }`;
  Themes aus fester kleiner Liste wählen lassen (z. B. „Claude & Modelle",
  „Agentic Development", „Tooling & Workflow", „Prompt/Context Engineering",
  „Grundlagen & Technik") — Liste als Konstante in `src/lib/skills.ts`.
- Upsert; bestehende Nodes nie überschreiben.
- **Verifikation:** Test mit gemocktem Call; zweimaliger Lauf erzeugt keine Duplikate.

### ☐ T7.3 — `/skills`-Seite (Skill-Map)
- Gruppierung nach `theme` (CSS-Grid-Cluster; **kein** Graph-Layout, keine neue Lib).
- Node-Kachel: Titel, Reel-Anzahl, Status-Ring (grau=seen/blau=tried/gold=mastered),
  „🧪"-Punkt wenn > 50 % der zugehörigen Reels experimentell.
- Klick auf Node ⇒ Detailpanel: Beschreibung, zugehörige Reels (kompakt, mit Links),
  Statuswechsel-Buttons (seen→tried→mastered, jeweils mit optionaler Notiz;
  Rückstufung erlaubt), bisherige Notizen chronologisch (= Adoption-Log des Nodes).
- Statuswechsel legt zusätzlich `interactions` mit `type:"tried"` auf ein
  repräsentatives Reel **nicht** an — Fortschritt lebt ausschließlich in
  `user_progress` (eine Wahrheit, keine Doppelbuchung).
- **Verifikation:** Seed mit 3 Themes/6 Nodes; Statuswechsel + Notizen persistieren.

### ☐ T7.4 — Adoption-Log-Ansicht
- Auf `/skills` ein Tab/Abschnitt „Adoption-Log": alle `user_progress`-Notizen +
  tried-Notizen aus Epic 6, chronologisch — „was habe ich durch das Tool wirklich
  übernommen".
- **Verifikation:** Einträge aus beiden Quellen erscheinen zusammengeführt.

---

## Abschlusskriterien (Epic-DoD)
- Reels aggregieren sich automatisch unter Nodes; Map ist am iPad benutzbar;
  Fortschritt + Notizen persistieren; keine Gates/Voraussetzungen irgendwo im Code.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_

**Foundation-slice re-scope (2026-07-24, executing model):** built per an explicit
narrower brief from the strong model, superseding some of this file's original task
descriptions:
- **T7.2 (node-aggregation) is NOT built here** — Epic 12's SkillTagger already creates
  `skill_nodes` via Match-or-Propose; this epic only reads `status: "active"` nodes.
- **`user_progress_notes` table added** (not in this file's original T7.1 snippet):
  `user_progress` keeps exactly the given shape (one row per node, single `note` =
  latest note, so map tiles never need a join). Full chronological history — needed
  for the node detail panel and the Adoption-Log (T7.4) — lives in a small append-only
  `user_progress_notes` table (id, skill_node_id, status, note, created_at), same shape
  as other event-log tables in this schema (`interactions`). Only written when
  `setProgress` receives a non-empty note; a bare status change with no note updates
  `user_progress` but leaves no log entry (a silent status flip isn't "adopted").
- **`/skills/[slug]`** (not `/skills/[id]`) is the node detail route, since nodes are
  addressed by slug everywhere else in the UI (SkillTagger's `active`/`pending` list
  already uses slug as the stable identifier).
- **Content counts / associated-content lists are not quality/experimental-filtered**:
  the Skill Map is an index of everything tagged to a node, not the feed — it counts
  and lists all reels with `reels.skill == slug` regardless of `qualityScore`/
  `experimental`, and all experience reports with `lifecycleState: "active"` only
  (matching the default view elsewhere, ADR 0008; deprecated/archived reports are
  omitted from the count but not from the underlying data).
- **T7.4 Adoption-Log = `user_progress_notes` only.** Epic 6 dropped the reel "tried"
  interaction (see `epic-6-interactions.md`, "Revidiert 2026-07-23") — there is no
  second note source left to merge in, unlike this file's original T7.4 wording assumed.
- **No gamified visuals invented.** Status is shown as plain text/badges, not the
  gray/blue/gold rings described in the original T7.3; that visual pass is explicitly
  deferred to a future UX/gamification design session (see `CLAUDE.md`
  Design-Prozess Ebene 2). Marked in the code with `{/* TODO(UX pass): ... */}`.
