# Epic 16 — Refactoring-Agent (nächtlicher Claude-Code-Cron, geparkt)

> **Status: GEPARKT** — auf Benutzerwunsch als Epic vorgemerkt. Vor Umsetzung eigener Grill
> (+ ggf. ADR). Nicht ohne Benutzer-Go bauen. Verwandt mit T4 (Design-Experten-Session) und
> **T6** (Ausführung über Claude-Code-Routinen — geteilte Scheduling-/Kontingent-Mechanik).

**Ziel:** Ein wiederkehrender Agent (analog zur Design-Experten-Session, aber **als
Claude-Code-Cron/Routine**), der **nachts über das Repo geht**, Verbesserungspotenzial findet
und **konkrete Vorschläge** liefert — Refactoring, Vereinfachung, Testlücken, Dead-Code,
Inkonsistenzen zu ADRs/Konventionen — ohne selbst Risiko einzubauen.

**Referenzen:** CLAUDE.md („Design-Prozess" Review-Mindest-Checkliste), `future-todos.md` T4
(Muster Experten-Session), Epic 16 teilt die CC-Routine-Mechanik mit `future-todos.md` T6.
Nutzt Claude-Code-**Kontingent** statt API-Tokens (wie T6).

## Motivation
- Code wächst über viele Epics/Subagenten; niemand schaut regelmäßig ganzheitlich auf Qualität.
- Nachts ist ohnehin Leerlauf — ein Kontingent-basierter Routine-Lauf kostet kein API-Geld.
- Passt zum etablierten Muster „Experten-Agent mit klarem Mindset" (wie Design/Persona).

## Offene Design-Fragen (im Grill zu klären)
- **Output-Form:** nur **Report/„Findings-Liste"** (Mensch entscheidet), oder direkt ein
  **PR-Entwurf** mit kleinen, sicheren Änderungen? (Konservativ: Vorschläge/PR-Entwurf, Merge
  bleibt beim Menschen — nichts wird nachts eigenmächtig auf `main` gebracht.)
- **Scope pro Lauf:** ganzes Repo vs. **rotierender Ausschnitt** (Kontext-/Kostengrenzen) —
  z. B. jede Nacht ein anderes Modul/Verzeichnis.
- **Was zählt als „Verbesserung":** Refactoring/Duplikate, Vereinfachung, Testabdeckung,
  ADR-/Konventions-Konformität (CLAUDE.md), Dead-Code, offensichtliche Perf/Kosten. **Kein**
  Feature-Scope, keine großen Rewrites ohne Freigabe.
- **Nicht-Regression (hart):** Der Agent darf **nichts kaputt machen** — Vorschläge müssen
  Build + Tests grün lassen; automatisch angelegte Branches laufen erst durch CI/Review.
- **Kadenz + Kosten:** nächtliche Routine; Kontingent-Nutzung (teilt Infrastruktur mit T6);
  Guardrails gegen Scope-Creep / Endlos-Refactoring.
- **Zusammenspiel mit dem Review-Prozess:** Findings landen als priorisierte Liste, die das
  starke Modell (oder der Benutzer) triagiert — kein paralleler „zweiter Wahrheits-Kanal".

## Grobe Skizze (unverbindlich)
- **Claude-Code-Routine (nightly)** → Agent liest Repo (bzw. rotierenden Ausschnitt) + CLAUDE.md/
  ADRs → erzeugt einen **priorisierten Refactoring-Report** (`docs/…` oder Issue) + optional
  einen **Branch mit kleinen, sicheren Verbesserungen** als PR-Entwurf → normaler Review/Merge.
- Guardrails: harte Größenlimits pro Vorschlag, „nur grün", keine ADR-Verletzung, kein Feature-Scope.

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
