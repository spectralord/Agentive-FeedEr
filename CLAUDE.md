# CLAUDE.md — Arbeitsweise in diesem Repo

## Modell-Arbeitsteilung (vereinbart am 2026-07-22)

Sofern der Benutzer nicht explizit etwas anderes anweist, gilt:

- **Konzeption, Architektur, Analyse, Review:** übernimmt das starke Session-Modell
  (Standard: **Opus**) selbst — dazu zählen Design-Entscheidungen, ADRs, Plan-Pflege,
  Code-Review der Subagenten-Ergebnisse und alles, was Urteilsvermögen braucht.
  **Fable** wird nur verwendet, wenn der Benutzer es explizit anfordert.
- **Implementierung:** wird an **Subagenten mit schwächerem Modell** delegiert
  (Standard: `sonnet`; rein mechanische Tasks ggf. `haiku`). Auftrag an den Subagenten
  ist immer ein konkretes Epic-/Task-File aus `docs/plan/` inkl. Verweis auf die
  bindenden Arbeitsanweisungen in `docs/plan/README.md` §1.
- **Qualitätssicherung:** Vor jedem Commit eines Subagenten-Ergebnisses prüft das
  starke Modell: Build grün, Tests grün, Verifikationsschritte des Tasks erfüllt,
  keine ADR-Verletzung.
- Epics mit hoher Verzahnung (Fundament) dürfen nach Ankündigung auch direkt vom
  starken Modell implementiert werden, wenn Delegation mehr kostet als spart.

## Branch-Strategie (vereinbart am 2026-07-23)

- **`main` ist Basis und Deploy-Branch** (Railway deployt `main`).
- **Pro Epic ein eigener Feature-Branch, abgezweigt von aktuellem `main`** —
  Namensschema `claude/epic-<N>-<kurz>` (z. B. `claude/epic-6-interactions`).
  So kommen sich parallel laufende Subagenten nicht in dieselben Dateien.
- Ein Subagent arbeitet **immer auf dem Feature-Branch seines Epics**, nie auf einem
  fremden. Laufen mehrere Epics parallel, hat **jedes seinen eigenen Branch**.
- Nach Review durch das starke Modell wird der Feature-Branch nach `main` gemergt;
  der Merge löst den Railway-Deploy aus. `main` bleibt jederzeit deploybar.
- Vor dem Abzweigen eines neuen Feature-Branches: `main` frisch ziehen
  (`git fetch origin main`), damit die Basis aktuell ist.
- **Subagenten committen häufig** auf ihrem Feature-Branch — mindestens **pro Task
  ein Commit**, bei längeren Tasks auch für sinnvolle Zwischenstände. Grund: Wird eine
  Session angehalten/resumed, geht ein Subagenten-Prozess mitsamt **nicht committeter**
  Arbeit verloren (bereits verbrauchte Tokens sind dann weg). Committete Arbeit auf dem
  Feature-Branch überlebt. Push am Task-/Epic-Ende; bei riskanten/langen Läufen ruhig
  zwischendurch pushen, damit auch ein Container-Recycling nichts kostet.

## Design-Prozess (vom starken Modell gegrillt am 2026-07-23; siehe ADR 0014)

> Entscheidungen des starken Modells laut Modell-Arbeitsteilung. Vom Benutzer jederzeit
> kippbar. Ausführliche Herleitung: `docs/specs/2026-07-23-design-process.md`.

Der Prozess läuft auf **drei Ebenen**, jede mit Auslöser / Owner / Artefakt:
1. **Produkt-/Architektur-Design** — Auslöser: echte Weggabelung oder Datenmodell-Änderung.
   Owner: starkes Modell (Grill/Selbst-Grill). Artefakt: ADR + Epic-Plan + Glossar.
2. **UX-/Gamification-Design** — Auslöser: neues nutzerseitiges Epic *oder* periodischer
   Ganzheits-Pass. Owner: **Design-Experten-Session** (Übergabe-Prompt:
   `docs/specs/design-expert-handoff-prompt.md`). Artefakt: UX-Spec/Design-ADR + baubare UI-Tasks.
3. **Inhalts-Qualität** — Auslöser: periodische Stichprobe generierter Reels. Owner:
   Persona-Agent (Zukunftsmusik, `future-todos.md` T5). Artefakt: Bewertung → Enrichment-Prompt/
   `QUALITY_THRESHOLD`.

**Arbeitsregeln:**
- **ADR-Schwelle:** ADR, wenn eine Entscheidung schwer reversibel ist / Struktur prägt, eine
  plausible Alternative verwirft, oder später referenziert wird. Sonst Glossar oder Epic-Notiz.
  Faustregel: *„Würde ein künftiges Ich/ein Subagent das ohne das Warum falsch wiederholen?"*
- **Grillen vs. direkt bauen:** Grillen bei echter Weggabelung/Trade-off/unklarer Intention;
  direkt delegieren, wenn die Epic-Tasks *eindeutig ohne Entscheidung* schreibbar sind.
- **Exit-Kriterium „designed enough":** jeder Ast aufgelöst oder bewusst mit Notiz vertagt;
  Epic-Tasks eindeutig mit Verifikationsschritten schreibbar; kein „TBD" im kritischen Pfad.
- **Review-Mindest-Checkliste:** Build grün · Tests grün · Task-Verifikationen ausgeführt ·
  keine ADR-Verletzung · keine neuen Libs · Diff auf das Epic begrenzt. Situativ tiefer bei
  architektonisch bedeutsamen Änderungen.
- **Parallelitätsgrad:** max. ~2–3 gleichzeitige Subagenten (so viel wie gut reviewbar), jeder
  auf eigenem Branch; **Task-Board + README-Status-Tabelle** sind die einzige Wahrheitsquelle,
  an jeder Epic-Grenze aktualisiert.
- **KI-Funktionen immer über die Executor-Naht — beide Ausprägungen (bindend, ADR 0015):**
  Jeder neue LLM-Schritt (SkillTagger, Clustering, Knowledge-Check, künftige) läuft über einen
  **injizierten `Executor`** (`src/lib/executor/`, = `StructuredCaller`-Signatur), **nie** direkt
  über `callStructured`/die API. Dadurch funktioniert er automatisch in **beiden** Ausprägungen
  (`api` **und** `claude-code`). Pflicht je neuem Schritt: injizierter Executor (Default
  `callStructured`), Verdrahtung über den in `pipeline.ts` einmal aufgelösten Executor,
  **zod-Validierung** des Outputs (ADR 0003), Unit-Test mit **gemocktem** Caller. Kein direkter
  API-Zugriff, kein stiller API-Fallback im `claude-code`-Pfad.

## Projekt-Dokumentation

- Glossar: `CONTEXT.md` · ADRs: `docs/adr/` · Design: `docs/specs/` ·
  Ausführbarer Entwicklungsplan: `docs/plan/README.md` (Epics 0–8 + Vision-Backlog).
- Sprache: UI-Texte und Doku Deutsch, Code/Kommentare/Commits Englisch.
