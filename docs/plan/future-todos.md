# Future-TODOs / Ideen (roh, zum späteren Aufgreifen)

Vom Benutzer geparkte Gedanken (2026-07-23). Noch nicht gegrillt — vor Umsetzung je ein
kurzes Design-/Grill-Gespräch.

## T1 — Zwei Detailtiefen pro Inhalt (Kompakt → Aufgeklappt)
Der Feed bleibt wie jetzt der *zusammengefasste* Modus. Aber ein Reel soll **anklickbar**
sein und dann eine **besser aufgearbeitete, tiefere Zusammenfassung** zeigen (Detail-Ansicht).
- Verwandt mit, aber nicht identisch zu Epic 8 (agentisches „Vertiefen"): hier geht es
  zunächst um eine *vorhandene* tiefere Aufbereitung on click, nicht um Live-Recherche.
- Denkbar: das Enrichment erzeugt zwei Ebenen (kompakt + ausführlich), oder die Detailtiefe
  wird on-demand nachgeladen.

## T2 — Actionables / „To-Try"-Aufforderungen überarbeiten
> **AUFGEGRIFFEN 2026-08-01 → ADR 0019 (akzeptiert).** `reels.action` wird zum abhakbaren
> Actionable befördert, zweispuriger Fortschritt (declared/evidenced) ohne Gating, `effort_tag`
> wird funktional (Filter „5-Minuten-Gewinn"). Der hier notierte Kern — „die Aufforderungen sind
> zu schwach" — ist damit *strukturell* adressiert (abhakbar + rollt auf den Skill Node auf);
> die *Formulierungsqualität* der generierten `action`-Texte bleibt eine separate Prompt-Frage.
Die aktuellen Handlungs-/TODO-Aufforderungen (`action`/`effort_tag`) sind noch **zu schwach**.
Bei Gelegenheit überarbeiten — konkreter, motivierender, klarer Anreiz zum Ausprobieren.
Hängt mit dem Actionable-Konzept (Epic 6/7-Revision) zusammen.

## T3 — Auf Englisch umstellen (Chat + gesamte App)
Perspektivisch **Chat und sämtliche App-Inhalte/UI auf Englisch** umstellen. Betrifft dann
auch `CLAUDE.md` (Sprach-Konvention „UI/Doku Deutsch" → Englisch) und alle bestehenden
UI-Strings. Bewusste, einmalige Umstellung — erst auf explizites Go.

## T4 — Design-/UX-Experten-Agent (eigene Session) + Übergabe-Prompt
Design/UX ist aktuell dürftig. Ziel: Claude baut einen **umfassenden Prompt**, den der
Benutzer einer **weiteren Session** gibt; diese agiert als **Design-Experte**, schaut sich
das Projekt an und erarbeitet mit **Gamifying- + Good-UX-Mindset** konkrete, umsetzbare
Design-Vorschläge. (Deliverable: der Übergabe-Prompt.)
> **Update 2026-07-23:** Übergabe-Prompt **geliefert** →
> `docs/specs/design-expert-handoff-prompt.md` (Leitmotiv: Look-and-Feel + Gamification
> gleichrangig). Offen ist nur noch, dass der Benutzer die Design-Session damit startet.

## T5 — Persona-Agent „Entwickler-Sicht auf den Mehrwert" (Zukunftsmusik)
Später eine Session, die die **generierten Inhalte aus Entwickler-Perspektive** bewertet:
Wie viel echten Mehrwert/Erfahrung gewinnt ein Entwickler daraus? Gut über einen
**Persona-Agenten** abbildbar. Bewusst Zukunftsmusik.

## T6 — Zweiter Ausführungsmodus: Pipeline über Claude-Code-Kontingent statt API-Key
> **Hochgezogen 2026-07-23:** gegrillt (F1–F5 unten) → **ADR 0015** + **Epic 17**
> (`epic-17-execution-modes.md`). Bauen erst auf Benutzer-Go.
**Motiv:** Der Daily-Task ruft die LLM-Arbeit (Enrichment/Summaries etc.) heute über die
**Anthropic-API** (`ANTHROPIC_API_KEY`) → verbraucht **API-Tokens (Geld)**. Wenn noch
**Claude-Code-Kontingent** (Subscription) übrig ist, soll dieselbe Arbeit stattdessen darüber
laufen — und man soll **umschalten** können, *wie* der Lauf ausgeführt wird.

**Kern-Idee:** Zwei Ausführungs-Modi hinter einem Schalter (z. B. `PIPELINE_EXECUTOR=api|claude-code`):
- **`api` (heute):** Railway-Cron ruft die App, die per SDK die API mit dem Key aufruft.
- **`claude-code` (neu):** Eine **Claude-Code-Scheduled-Task/Routine** feuert eine Session, die
  den Pipeline-Lauf anstößt.

**Wichtiger technischer Haken (für den Grill):** Damit wirklich **Kontingent statt API-Tokens**
verbraucht wird, muss die **Inferenz im Claude-Code-Agent-Turn** passieren (der Agent liest die
Raw-Items und erzeugt die strukturierten Summaries selbst, schreibt sie in die DB) — eine bloße
Routine, die die App triggert, die *dann* die API ruft, spart **nichts**. Das ist ein anderer
Ausführungspfad als das deterministische, tool-use-strukturierte Enrichment (ADR 0003).
- **Naht/Seam:** Das bestehende **`StructuredCaller`-Interface** (Enrichment/SkillTagger/…) ist
  der Ansatzpunkt — eine zweite Implementierung „Agent-getrieben" dahinter.
- **Trade-offs zu grillen:** Konsistenz/Qualität (Agent-Freitext vs. erzwungenes JSON-Schema +
  zod-Validierung), Idempotenz/Fehlertoleranz pro Item, Kadenz/Scheduling (Railway-Cron vs.
  Claude-Code-Routine), wie „null statt Halluzination" (ADR 0003) im Agent-Modus garantiert wird,
  und ob nur *Teile* (z. B. Enrichment) oder die ganze Pipeline umgeschaltet werden.
- **Ergebnis vermutlich:** eigener ADR (Ausführungs-Modell) + Env-Schalter + zweite
  `StructuredCaller`-Implementierung. **Vor Bau grillen** (echte architektonische Weggabelung).

### Grill-Protokoll (läuft, 2026-07-23)
- **F1 — Datenpfad im `claude-code`-Modus → ENTSCHIEDEN: A (direkter DB-Zugriff).** Die
  CC-Session nutzt dieselbe Drizzle-Schicht wie die App (liest `raw_items`, schreibt `reels`),
  gleiche Idempotenz/Validierung — kein Endpunkt-Zoo. Für ein Single-User-Tool der einfachste,
  robusteste Weg.

- **F2 — Profil-Struktur → ENTSCHIEDEN: C (Profil mit Defaults + Override).** Ein
  `APP_PROFILE=local|cloud` setzt sinnvolle Defaults (local→Claude Code + lokale DB;
  cloud→API + Railway), einzelne Achsen (v. a. Executor) sind per Env überschreibbar
  (⇒ auch Cloud+Claude-Code möglich). Nicht die volle 4er-Kombinatorik als Normalfall.
- **F3 — Schema-Disziplin/Granularität → ENTSCHIEDEN: C (Agent-Batch + erzwungenes Tool-Use).**
  Der Agent verarbeitet einen Batch in einem Turn, ruft aber **pro Item ein lokales Tool
  `emit_reel(reel)`** auf, das **serverseitig zod-validiert + schreibt** — Schema-Zwang im Tool,
  Per-Item-Validierung/-Isolation (ADR 0003 gewahrt) bei Batch-Effizienz. Bildet die heutige
  „forced tool_choice"-Disziplin nach. Fallback bei Setup-Problemen: (A) Agent-Batch → Skript
  validiert das Array.
- **F4 — Scope → ENTSCHIEDEN: B (uniformer Executor, inkrementell gebaut).** Ein einmal
  gewählter Executor wird an **allen** `StructuredCaller`-Stellen injiziert (Enrichment,
  SkillTagger, Clustering, Knowledge-Check, Feedback-Summary) → einheitlicher Lauf, kein
  Mischmasch. Baureihenfolge enrichment-first als erste Scheibe. **Harte Leitplanke:** Im
  Claude-Code-/local-Modus laufen **null** API-Calls und es gibt **keinen stillen API-Fallback**
  (sonst entstünden Kosten). Fehlt/misslingt der CC-Weg, wird **abgebrochen/geskippt**, nie über
  die API nachgeholt. `ANTHROPIC_API_KEY` darf im local-Modus ungesetzt sein.
- **F5 — Trigger/Scheduling → ENTSCHIEDEN: zwei unabhängige Achsen + Profil-Matrix.**
  - **Achse 1 Trigger:** `railway-cron` | `claude-code-cron` | `manuell/lokal`.
  - **Achse 2 Executor:** `api` | `claude-code` (siehe F4).
  - **local:** Trigger manuell/lokal, Executor `claude-code`, DB lokal — **nie Railway, nie API**
    (hart abgeschottet).
  - **cloud** (DB=Railway), drei nutzbare Kombis:
    - „Cloud" = `railway-cron` + `api` (Status quo).
    - „Claude Code Cron" = `claude-code-cron` + `claude-code` (Kontingent, kein API).
    - „Claude Code API" = `claude-code-cron` + `api` (CC plant, API inferiert).
  - **Ausgeschlossen:** `railway-cron` + `claude-code` (Railway kann kein CC-Kontingent nutzen).

### Erweiterung (Benutzer 2026-07-23): zwei **Umgebungs-Profile** lokal ↔ cloud
Der Schalter ist eigentlich **zweidimensional** — Umgebung *und* Inferenz:
- **Umgebung:** **`local`** (eigener Rechner, **lokale DB**, Ausführung in Claude Code) vs.
  **`cloud`** (Railway + Cloud-DB).
- **Inferenz:** **`api`** (Anthropic-Key) vs. **`claude-code`** (Kontingent).
- **Kopplung/Motiv:** **`local` ⇒ Claude Code + lokale DB** — spart *sowohl* Railway- *als auch*
  API-Kosten (Entwicklung/Nutzung am eigenen Rechner). **`cloud`** ist v. a. für **Tablet-Nutzung**
  interessant (kein eigener Rechner zur Hand); auch dort ist eine `api`-vs-`claude-code`-Unterscheidung
  gewünscht. Ziel: unsere Tools/Services **einmal „lokal" und einmal „cloud" startbar** machen.
- **Folgen für den Bau:** nicht nur ein `PIPELINE_EXECUTOR`-Flag, sondern **Umgebungs-Profile**
  (DB-Ziel + Executor + Scheduling gebündelt), z. B. `APP_PROFILE=local|cloud` mit sinnvollen
  Defaults (`local`→`claude-code`+lokale DB; `cloud`→heute `api`+Railway, optional `claude-code`).
  Lokaler Start-Pfad ohne Railway (eigenes `npm`-Kommando / Claude-Code-Routine gegen lokale DB).

## T7 — Curator / user system with trust-weighted evaluation
> Parked by the user on 2026-07-24, during the T11.7 grill (reports ↔ topic clusters).
> Needs its own grill before any build. New docs are English per README §2.

**Motive:** colleagues should be able to act as **curators** — curating Reels and posting
Experience Reports — and content from a known, trusted curator should carry a **markedly
higher evaluation** than content the system fished off the web by itself.

**The distinction that drives this:** a "report from the web" and a "report added by a known
person" are fundamentally different trust objects, even though both are Experience Reports
today. The existing `author_type` enum already encodes the two ends:
- `curated` — **AI-fished** from a public source (Reddit/comment threads). Low trust; the
  author is a handle, not a person we know. *(Beware the naming trap: `curated` here means
  machine-harvested, NOT "a human curator curated it" — the opposite trust level. If this
  feature lands, seriously consider renaming the enum value to something like `web` /
  `harvested` to kill the ambiguity, rather than overloading `curated` with both meanings.)*
- `colleague` — a real, known person. High trust. Currently an unused enum value with no
  creation path; this is the value a curator system would actually populate.

**What it would touch:**
- **Real user/auth:** ADR 0007 already names the seam — `author_label` → `user_id`. Today
  `author_type`/`author_label` stand in for authentication that does not exist. A curator
  system is the point where that stops being sufficient.
- **`relevance_score`:** reserved in the schema as "curated only; MVP always null" — a trust
  model would give it an actual meaning and a source of truth.
- **`confidence` weighting (ADR 0021, Epic 11 T11.7):** the MVP rule counts every distinct
  author as exactly **one** independent voice, deliberately unweighted, because
  `confidence` is a coarse `few/some/strong` scale (ADR 0013 point 4). A trust model is
  precisely the thing that would reopen that: a trusted curator's first-hand report
  arguably outweighs an anonymous web handle. Note the MVP rule **scales gracefully** into
  this — each curator is a distinct `author_label` and so already counts as a distinct
  voice; only the *weighting* would be new.
- **Reel curation by colleagues:** a posting path for Reels that does not go through
  ingestion/enrichment at all, which brushes against ADR 0005 (sourced-only) and needs an
  explicit decision — is a trusted colleague's word a "source"?
- **The deferred `curated` echo judgment (ADR 0021):** once web-harvested reports can
  actually be created, they need the Reel-style `is_primary` echo check that own/colleague
  reports do not. Same grill.

## T8 — Curator inbox: an approval gate before content becomes visible
> Owner idea 2026-08-02. **Flagged for a design session** → **ADR 0028** (proposed, ungrilled).
> New docs are English per README §2.

**Motive:** a review surface listing every newly-arrived item with (a) the date it was added,
(b) a short explanation of *why* that relevance/quality level was chosen, (c) manual override of
those judgements, and (d) an explicit approve step. Unapproved items sit in a holding area instead
of the main feed.

**T7 and T8 compose — clarified by the owner 2026-08-02.** They answer different questions
(T7: *who* is giving input; T8: *when* — before or after publication), and combining them gives
per-curator queues whose judgements are weighted by T7's trust model, so several curators can
review the same item without their votes counting equally. Still keep the concepts distinct when
designing: neither depends on the other, and T8's post-publication half works with a single user.

**Two surfaces, very different cost:**
- **Pre-publication queue** (per registered curator) — the expensive half: lifecycle state, a
  rationale field, a holding area.
- **Post-publication input** on already-visible content — **cheap and independent**: no lifecycle
  state, no back-fill, no holding area. `src/lib/feedback/run.ts` is the natural seam. Ship first.

**Why it needs a grill rather than an epic plan** (detail in ADR 0028):
- Enrichment emits **no rationale field** today, so (b) changes ADR 0003's output contract and
  cannot be back-filled without re-running enrichment.
- Visibility is currently a pure computed threshold with **no lifecycle state**, so (d) is a real
  schema and pipeline change, not a UI addition.
- It is in tension with **ADR 0004** (derive labels, don't stamp them) and with ADR 0023's rule
  that new surfaces go into a hub, never onto the fixed four-item tab bar.
- Sharpest open question: **what happens when the curator is away?** An approval gate turns
  "signal over noise" into "nothing at all" during absence.

## T9 — Click-to-explain glossary with inline term highlighting
> Owner idea 2026-08-03. **Rough note only — no ADR, not grilled.**

**Motive:** click any word or term in the app to trigger an explanation workflow. The result is saved
into a **glossary / knowledge base**. Reels and other text then render already-known terms
**highlighted**, and hovering one shows a short pop-up explanation.

**Reference for the feel:** *Warhammer 40k: Rogue Trader* does this well for setting-specific terms.

**First thoughts (not decisions):**
- Distinct from **Skill Nodes**: a skill is a competency you progress on; a glossary term is just a
  definition. Overlap is possible but conflating them would repeat the T7/T8 naming trap.
- There are already two glossary files (`CONTEXT.md` DE, `CONTEXT.en.md` EN) — those are *developer*
  docs, not user-facing. Decide whether this is a third store or a promotion of those.
- Highlighting means matching term occurrences inside rendered prose — a text-processing pass, and
  the first thing in the app to modify Reel text at render time.
- Explanation generation should go through the executor seam (ADR 0015) and, following ADR 0024,
  probably user-triggered on the Claude Code subscription rather than a batch pass.
- Sourced-only (ADR 0005) needs thought: a definition of "MCP" is general knowledge, not something
  the source text supports. That is a genuine tension with the app's trust model.

## T10 — Token/cost accounting per pipeline run
> Owner idea 2026-08-03. **Rough note — no ADR yet.** Cheaper than it looks: the data already
> exists and is being thrown away.

**Motive:** see where tokens go. "If I run the daily task, how many tokens does that cost?" — to get
a feel for the cost of each pass and each interaction.

**The data is already there, on both executors (verified 2026-08-03):**
- **API path** — `client.messages.create()` returns `response.usage`
  (`input_tokens`, `output_tokens`, cache read/creation counts). `callStructured`
  (`src/lib/claude.ts:33`) returns **only** `toolUse.input` and discards the rest.
- **Claude Code path** — the CLI's `--output-format json` envelope carries `usage` **and**
  `total_cost_usd`. `extractResultJson` (`src/lib/executor/claudeCode.ts`) pulls out `result` and
  discards the envelope, including usage.

So no new LLM calls are needed — just stop dropping what comes back.

**The one real design obstacle:** `Executor` is typed
`(opts: StructuredCallOptions) => Promise<unknown>` (`src/lib/executor/executor.ts:11`). Usage has
nowhere to travel without changing that seam, which is **ADR 0015 territory** and touches all six
LLM steps. Options, none chosen:
1. Widen the return to `{ result, usage }` — honest, but a breaking change across every step and
   every mocked-caller test.
2. An out-of-band collector (an injected counter the executor writes to) — leaves the seam alone,
   but is implicit state.
3. Wrap the executor in a metering decorator at the one place it is resolved
   (`pipeline.ts:53`) — no signature change, and the natural home for a per-run total.

Option 3 looks cheapest and matches how the executor is already resolved exactly once per run.

**Where to store it:** `pipeline_runs.summary` is already `jsonb` and already holds per-phase
counts, so a `tokens`/`cost` block fits with no migration. The admin console already renders run
summaries, so it is also the natural place to display it.

**Also worth surfacing:** per-*item* cost (which Reels were expensive), and the on-demand features
(write-up, ADR 0024) where the user presses a button and might want to know what it cost.

**Caveat on the cost figure:** under `APP_PROFILE=local` the spend is Claude Code **subscription
quota**, not money — `total_cost_usd` from the CLI is what the same work *would* have cost on the
API. Label it as such or it will read as a bill.
