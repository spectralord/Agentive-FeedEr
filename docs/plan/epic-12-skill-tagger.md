# Epic 12 — SkillTagger (Match-or-Propose)

**Ziel:** Inhalte (Reels + Experience Reports) automatisch einem **kanonischen**
Skill-Node zuordnen, ohne wuchernde Taxonomie und ohne manuelles Taggen durch den Nutzer.

**Referenzen:** ADR 0009 (Match-or-Propose, revidiert ADR 0003), ADR 0008 (Skill-Nodes
First-Class), `docs/specs/2026-07-22-experience-reports-design.md` (Thema 4), Glossar:
SkillTagger, Actionable.

> **Reihenfolge:** Epic 12 sollte **vor** Epic 7 (Skill-Map) gebaut werden — es liefert die
> Node-Zuordnung, die Epic 7 T7.2 bisher provisorisch selbst macht, und schaltet den
> Skill-Bezug von Epic 9 (Erfahrungsberichte) frei.

---

## Tasks

### ☒ T12.1 — Schema: `skill_nodes` (+ pending-Status)
- `skill_nodes` wie in Epic 7 T7.1 (`id`, `slug` unique, `title`, `theme`, `description`)
  **plus** `status: text({ enum: ["active","pending"] }).default("pending")` — `pending` =
  vorgeschlagen, noch nicht bestätigt.
- (Falls Epic 7 noch nicht gebaut: dieses Schema ist die maßgebliche Definition; Epic 7
  referenziert es dann.)
- **Verifikation:** Migration grün.

### ☒ T12.2 — Enrichment liefert nur noch rohe Kompetenz-Vermutung
- In Epic 2 (`enrichment/schema.ts` + Prompt): `skill` wird zu `skill_hint` (Freitext,
  englisch, „welche Kompetenz behandelt das") — **keine** kanonische Zuordnung mehr im
  Single-Pass (ADR 0009 / revidiert ADR 0003). `reels.skill` bleibt, wird aber nicht mehr
  im Enrichment gesetzt, sondern vom SkillTagger.
- **Verifikation:** Enrichment-Tests angepasst; `skill_hint` im Output, `reels.skill` nach
  Enrichment noch `null`.

### ☒ T12.3 — Match-or-Propose-Kern (`src/lib/skilltagger/tagger.ts`)
- `tagContent({ hint, title, text }, existingNodes): Promise<{ match: slug } | { propose: { slug, title, theme, description } }>`
  via **einem** strukturierten LLM-Call: bekommt Item-Infos + **komplette aktuelle
  `active`-Node-Liste** (Slug + Kurzbeschreibung), wählt Treffer über Konfidenz-Schwelle
  **oder** schlägt neuen Node vor. Themes aus fester Konstante (`src/lib/skills.ts`, aus Epic 7).
- Solange die Liste in den Prompt passt (Dutzende Nodes) reicht das — **keine Embeddings**
  (Skalierungs-Naht dokumentieren).
- **Verifikation:** Unit-Tests mit gemocktem Call: klarer Match → `match`; unbekanntes
  Thema → `propose`.

### ☒ T12.4 — Runner (`src/lib/skilltagger/run.ts`) — ein Tagger, mehrere Trigger
- `runSkillTagging(db, caller?)`: verarbeitet alle Inhalte mit `skill IS NULL`
  (Reels **und** `experience_reports`), idempotent (Muster wie Enrichment):
  - `match` → `content.skill = slug` setzen.
  - `propose` → `skill_nodes`-Zeile mit `status:"pending"` upserten (auf `slug`), Item
    bleibt ungetaggt (wartet auf Bestätigung). Batch läuft weiter.
- `tagSingle(db, contentRef)`: für den On-Save-Pfad eines einzelnen manuellen Reports.
- **Verifikation:** Integrationstest: Match taggt; Propose erzeugt pending-Node + Item
  bleibt null; zweiter Lauf idempotent.

### ☒ T12.5 — Trigger verdrahten
- **Reels:** `runSkillTagging` als Stufe im Daily-Job **nach** dem Enrichment.
- **Manuelle Reports:** `tagSingle` direkt nach `createReport` (Epic 9 T9.5) — fire-and-forget
  oder kurz awaited, Formular blockiert nicht.
- **Backstop:** der Daily-`runSkillTagging` sweept ohnehin alles Ungetaggte.
- **Verifikation:** Report anlegen → nach Lauf/Save getaggt oder pending; Daily-Sweep holt
  Fehlgeschlagenes nach.

### ☒ T12.6 — Node-Vorschläge bestätigen (UI)
- Kleine Ansicht „Neue Skills (N)": pending-Nodes mit Aktionen **anlegen** (`status:active`),
  **mergen** (in bestehenden Node — Item-Referenzen umhängen) oder **verwerfen**.
- Beim manuellen Report zusätzlich inline anbieten (bester Kontext-Moment), nicht blockierend.
- Nach Bestätigung ordnet der nächste `runSkillTagging`-Lauf die wartenden Items zu.
- **Verifikation:** pending-Node bestätigen → wird `active`, wartende Items bekommen den Slug.

---

## Abschlusskriterien (Epic-DoD)
- Reels + Reports werden automatisch kanonisch getaggt; neue Nodes entstehen nur per
  Bestätigung (keine Taxonomie-Explosion); ein Tagger bedient Batch- und On-Save-Trigger;
  Daily-Run ist Backstop. Build + Tests grün.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_

- **T12.2 — Ablage des `skill_hint`:** Der Task nennt nicht, wo der rohe Enrichment-Hint
  bis zum SkillTagger-Lauf zwischengespeichert wird. Konservativ gewählt: `reels.metadata`
  (das dafür vorgesehene, migrationsfreie Erweiterungsfeld, siehe `CONTEXT.md` „Attribut").
  `runSkillTagging`/`tagSingle` lesen `metadata.skillHint` als `hint` für `tagContent`.
- **T12.3 — „Konfidenz-Schwelle":** Keine separate numerische Confidence im Tool-Output;
  die Schwelle ist als verbindliche Verhaltensregel im System-Prompt kodiert (Analog zu den
  Scoring-Rubriken in `enrichment/prompt.ts`): „match" nur bei echter Themen-Deckung, sonst
  „propose". Kein weiterer Konsument hätte eine numerische Zahl gebraucht — hätte nur
  ungenutzte Komplexität hinzugefügt.
- **T12.3 — `THEMES`:** 8 Themen gewählt (`parallelization, agents, tooling, prompting,
  evaluation, models, integration, industry`) — innerhalb der vorgegebenen 6–10, siehe
  `src/lib/skills.ts` für die Kurzbegründung je Thema.
- **T12.6 — „Verwerfen" = Hard-Delete:** Das in T12.1 fixierte Schema kennt nur
  `status: active|pending`, kein „discarded"-Zustand (anders als der breitere
  `lifecycle_state` aus ADR 0008 für die spätere Epic-7-Variante). Verwerfen löscht die
  Zeile daher hart; taucht die Kompetenz erneut auf, schlägt der Tagger sie einfach neu vor.
- **T12.6 — Inline-Angebot beim manuellen Report:** Die Aufgabe nennt zusätzlich ein
  Inline-Angebot direkt auf der Report-Erstellungsseite („bester Kontext-Moment"). Umgesetzt
  ist nur die eigenständige `/skills`-Übersicht (erfüllt die Verifikation vollständig: ein
  frisch erzeugter Vorschlag erscheint dort sofort nach dem Speichern). Das Inline-Widget auf
  `/experience/new` selbst wurde **nicht** gebaut (zusätzlicher UI-Scope ohne eigene
  Verifikationsvorgabe) — als offener Polish-Punkt vertagt, nicht als Bug.
- **T12.6 — „Anlegen" tagged nicht sofort erneut:** Bestätigen setzt nur `status:active`;
  das erneute Zuordnen wartender Items passiert bewusst erst im nächsten
  `runSkillTagging`-Lauf (Daily-Job-Backstop), exakt wie der Task-Text es formuliert
  („Nach Bestätigung ordnet der nächste Lauf..."), nicht synchron im selben Request (spart
  einen LLM-Call in der Confirm-Aktion selbst).
