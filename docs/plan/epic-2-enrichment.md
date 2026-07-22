# Epic 2 — Enrichment (MVP)

**Ziel:** Jedes neue Raw Item wird in **einem** strukturierten LLM-Pass zu einem Reel —
mit Developer-Profil als Relevanz-Kontext, Sourced-only-Regel und `null` statt Raten.

**Referenzen:** ADR 0002 (nur neue Items), ADR 0003 (Single-Pass, JSON-Schema),
ADR 0005 (Sourced-only), Glossar: Enrichment, Reel, Attribut, Developer-Profil.

---

## Tasks

### ☑ T2.1 — Schema: `reels`
```ts
export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  rawItemId: integer("raw_item_id").notNull().references(() => rawItems.id).unique(),
  summary: text("summary").notNull(),                       // Deutsch, 2–4 Sätze
  category: text("category", { enum: ["claude-feature","tooling","technique","industry-news","research","opinion"] }).notNull(),
  maturity: text("maturity", { enum: ["experimental","emerging","established"] }).notNull(),
  experimental: boolean("experimental").notNull().default(false), // Impuls/Spielerei-Flag (≠ maturity)
  relevanceScore: integer("relevance_score").notNull(),     // 0–100
  qualityScore: integer("quality_score").notNull(),         // 0–100
  example: text("example"),                                 // null wenn nicht belegt
  action: text("action"),                                   // null wenn nicht belegt
  effortTag: text("effort_tag", { enum: ["5-min-test","afternoon","know-only"] }),
  skill: text("skill"),                                     // engl. Slug, z. B. "agentic-tool-use"
  topicClusterId: integer("topic_cluster_id"),              // reserviert (Vision), immer null im MVP
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- Invariante: `action == null ⇒ effortTag == null`.
- Migration generieren + ausführen. **Verifikation:** Migration grün.

### ☑ T2.2 — Developer-Profil (`/profile.md`)
Template anlegen (Benutzer füllt/verfeinert später — **Benutzer-Aktion** vermerken):

```md
# Developer-Profil
## Stack & Tools
TypeScript, React/Next.js, Node; Claude Code (Web/CLI); GitHub.
## Rolle & Level
Erfahrener Entwickler; führt/mentort Team-Kollegen.
## Interessen (hoch relevant)
Neue Claude-Features; agentische Workflows in der Entwicklung; MCP; Prompt-/Context-Engineering; praktische Best Practices.
## Wenig relevant
Reine ML-Forschung/Mathematik; Non-Dev-KI-News (Kunst, Consumer-Apps); Krypto.
## Was mich nervt
Marketing-Hype ohne Substanz; Clickbait; „Top 10 Tools"-Listicles.
```
- Loader `src/lib/enrichment/profile.ts`: liest Datei, wirft klaren Fehler wenn fehlt.
- **Verifikation:** Unit-Test Loader.

### ☑ T2.3 — Output-Vertrag: zod + JSON-Schema (`src/lib/enrichment/schema.ts`)
- zod-Schema `ReelOutput` exakt spiegelnd zu T2.1 (Felder: `summary`, `category`,
  `maturity`, `experimental`, `relevance_score`, `quality_score`, `example|null`,
  `action|null`, `effort_tag|null`, `skill|null`).
- Zusätzlich `.refine`: Score-Bereiche 0–100; `action === null ⇒ effort_tag === null`.
- Daraus (manuell, daneben gepflegt) das JSON-Schema-Objekt für den Tool-Call.
- **Verifikation:** Unit-Tests: valides Objekt passt; Verstöße (Score 101,
  effort ohne action) schlagen fehl.

### ☑ T2.4 — Prompt-Builder (`src/lib/enrichment/prompt.ts`)
System-Prompt (englisch, sinngemäß — exakte Formulierung darf das ausführende Modell
feinschleifen, die **Regeln sind bindend**):
- Rolle: „You turn one raw AI-news item into one structured 'reel' for a developer."
- **Sourced-only:** `example` and `action` MUST only contain what is supported by the
  source text. If the source contains no usable example/action, return `null`. Never invent.
- `summary`: German, 2–4 sentences, factual, no hype language.
- `action`: German, one concrete sentence („Probier X…", „Ersetz Y…"), only if sourced.
- `effort_tag`: estimate only when `action` is set: `5-min-test` (sofort ausprobierbar),
  `afternoon` (braucht einen Block Zeit), `know-only` (nur Wissen, nichts zu tun).
- `skill`: short English kebab-case competency slug (e.g. `agentic-tool-use`,
  `prompt-caching`, `mcp-servers`) or null if no clear competency.
- Scoring-Rubriken (verbindlich in den Prompt aufnehmen):
  - `quality_score`: 0–30 Marketing/Hype/kein Inhalt · 40–60 etwas Substanz, wenig
    Konkretes · 70–100 konkret, technisch, nachvollziehbar/verifizierbar.
  - `relevance_score`: gegen das mitgegebene Profil; 0–30 außerhalb der Interessen ·
    40–60 randständig · 70–100 Kerninteresse.
- `experimental`: true, wenn Inhalt ein Impuls/Experiment/„mal ausprobiert" ist
  (unabhängig von maturity).
- User-Content: Profil-Text + Quelle (name), Titel, URL, publishedAt, rawContent.
- **Verifikation:** Snapshot-Test des gebauten Prompts.

### ☑ T2.5 — Enrichment-Runner (`src/lib/enrichment/run.ts`)
`runEnrichment()`:
1. Select `raw_items` mit `enriched_at IS NULL AND enrich_error IS NULL`,
   Reihenfolge `published_at ASC`, Limit `env.MAX_ENRICH_PER_RUN`.
2. Pro Item: `callStructured` (T0.5) mit Modell `env.ANTHROPIC_MODEL` →
   zod-Validierung → Insert `reels` + `enriched_at = now()` (in einer Transaktion).
3. Fehlerpfad: 1× Retry; danach `enrich_error` setzen (Item wird nie erneut versucht,
   taucht nie im Feed auf) und weitermachen.
4. Rückgabe/Log: `{ processed, succeeded, failed }`.
- **Verifikation:** Integrationstest mit gemocktem Claude-Call (valide + invalide
  Antwort): valide ⇒ Reel existiert; invalide 2× ⇒ `enrich_error` gesetzt, kein Reel;
  zweiter Lauf verarbeitet 0 Items (Idempotenz).

### ☑ T2.6 — In den Daily-Job einhängen
- `src/jobs/daily.ts`: nach Ingestion `runEnrichment()` aufrufen; Gesamtsummary loggen.
- **Verifikation (echt, kleiner API-Spend):** `MAX_ENRICH_PER_RUN=5 npm run job:daily`
  mit echtem API-Key; 5 Reels stichprobenartig prüfen: deutsche Summary, plausible
  Scores, `example/action` nur wenn wirklich im Quelltext belegt (manuell gegenlesen!).
  Ergebnis der Stichprobe hier im File notieren.

---

## Abschlusskriterien (Epic-DoD)
- Pipeline Ende-zu-Ende: neue Raw Items ⇒ validierte Reels; genau 1 LLM-Call pro Item.
- Kein Reel ohne Quell-Item; kein zweiter Verarbeitungsversuch abgeschlossener Items.
- Sourced-only-Stichprobe dokumentiert. Build + Tests grün.

## Abweichungen/Fragen
- **Ergänzung zu T2.5 (bewusste Verbesserung):** API-/Infrastrukturfehler
  (`Anthropic.APIError`: Auth, Rate-Limit, 5xx) setzen **kein** `enrich_error`,
  sondern brechen den Lauf ab — die Items bleiben unangetastet und werden beim
  nächsten Lauf erneut versucht. Nur inhaltliche Fehler (Schema-Validierung nach
  Retry) markieren ein Item dauerhaft. Verhindert, dass z. B. ein fehlender
  API-Key die gesamte Queue vergiftet. Durch Integrationstest abgedeckt.
- **T2.6-Echtlauf offen (Benutzer-Aktion):** In der Build-Umgebung gibt es keinen
  echten `ANTHROPIC_API_KEY`. Der Stichproben-Lauf
  (`MAX_ENRICH_PER_RUN=5 npm run job:daily`) muss beim ersten Lauf mit echtem Key
  (lokal/Railway) gemacht und das Ergebnis hier notiert werden. Der Code-Pfad ist
  vollständig durch Integrationstests mit gemocktem Claude-Call verifiziert.
