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

## Projekt-Dokumentation

- Glossar: `CONTEXT.md` · ADRs: `docs/adr/` · Design: `docs/specs/` ·
  Ausführbarer Entwicklungsplan: `docs/plan/README.md` (Epics 0–8 + Vision-Backlog).
- Sprache: UI-Texte und Doku Deutsch, Code/Kommentare/Commits Englisch.
