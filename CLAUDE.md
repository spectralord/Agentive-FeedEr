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

## Projekt-Dokumentation

- Glossar: `CONTEXT.md` · ADRs: `docs/adr/` · Design: `docs/specs/` ·
  Ausführbarer Entwicklungsplan: `docs/plan/README.md` (Epics 0–8 + Vision-Backlog).
- Sprache: UI-Texte und Doku Deutsch, Code/Kommentare/Commits Englisch.
