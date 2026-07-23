# Design-Prozess — Entwurf zum Grillen (2026-07-23)

> **Zweck:** Unseren bislang *organisch gewachsenen* Arbeits-/Design-Prozess explizit machen,
> Lücken benennen und gemeinsam grillen, wie wir ihn bewusst gestalten. Grundlage sind die
> bereits vereinbarten Bausteine (CLAUDE.md) und die geparkten Ideen (`future-todos.md` T4/T5).
> Ergebnis des Grills wird in CLAUDE.md (Konventionen) bzw. einem ADR festgehalten.

---

## 1. Ist-Zustand (beobachtet, was wir de facto tun)

**Design-/Entscheidungs-Schleife:**
1. **Grillen** (grill-with-docs): starkes Modell (Opus) interviewt eine Frage nach der
   anderen, geerdet an Code + Glossar + bisherigen ADRs.
2. **Festhalten**: Entscheidungen landen als (a) Glossar-Begriff in `CONTEXT.md`,
   (b) **ADR** in `docs/adr/`, (c) Task-Plan im Epic-File `docs/plan/epic-*.md`.
3. **Bauen**: Implementierung wird an **Subagenten (Sonnet)** delegiert — je ein Epic-File,
   auf einem **eigenen Feature-Branch** (`claude/epic-<N>-<kurz>`), häufige Commits.
4. **Review**: starkes Modell prüft (Build/Tests grün, Verifikation erfüllt, keine
   ADR-Verletzung) **vor** dem Merge.
5. **Merge → Deploy**: Feature-Branch nach `main`, Railway deployt `main`.

**Bereits vereinbarte Regeln (CLAUDE.md):** Modell-Arbeitsteilung, Branch-Strategie,
häufige Subagenten-Commits, Sprache (UI/Doku Deutsch, Code/Commits Englisch).

## 2. Stärken (behalten)
- Ein-Frage-Grill zwingt zu echten Entscheidungen statt Scheinkonsens.
- Durable Records (ADR/Glossar/Epic) → Kontext überlebt Context-Kompaktierung & Sessions.
- Delegation an schwächeres Modell spart Kosten; Review hält Qualität.
- Branch-Isolation erlaubt parallele Epics ohne Kollision.

## 3. Lücken / offene Fragen (Grill-Kandidaten)

- **L1 — ADR-Schwelle:** Wann verdient etwas einen ADR vs. nur eine Epic-Notiz vs. nur einen
  Glossar-Eintrag? (Heute nach Gefühl.) Klare Trigger fehlen.
- **L2 — Grillen vs. direkt bauen:** Welche Änderung braucht einen Design-Grill, welche ist
  mechanisch genug für direkte Delegation? (Untergrenze für „designwürdig".)
- **L3 — UI/UX-Design hat *keinen* Prozess.** Bislang rein funktional/„dürftig" (eigene
  Einschätzung des Benutzers). Wo im Lebenszyklus kommt ein bewusster UX-/Gamification-Pass
  rein? Als **eigene Design-Experten-Session** (T4) mit Übergabe-Prompt? Wann/wie oft?
- **L4 — Inhalts-/Mehrwert-Bewertung (T5):** Soll ein **Persona-Agent** die *generierten
  Inhalte* aus Entwickler-Sicht bewerten (Feedback-Loop auf die Produktqualität, nicht den
  Code)? Wo dockt das an?
- **L5 — Review-Tiefe:** Wie rigoros prüft das starke Modell Subagenten-Ergebnisse? Fester
  Checklisten-Umfang vs. situativ?
- **L6 — „Designed enough to build":** Woran erkennen wir, dass ein Grill *fertig* ist und in
  einen Plan übergeht? (Exit-Kriterium.)
- **L7 — Parallelitätsgrad:** Wie viele Epics/Subagenten gleichzeitig, und wie halten wir den
  Überblick (Task-Board, Status-Tabelle) aktuell?

## 4. Grobe Zielrichtung (unverbindlich, wird im Grill geschärft)
- Prozess in **drei Ebenen** denken: **Produkt-/Architektur-Design** (grill→ADR),
  **UX-/Gamification-Design** (eigener Pass, evtl. Experten-Session), **Inhalts-Qualität**
  (Persona-Feedback-Loop). Heute ist nur die erste Ebene ausgeprägt.
- Jede Ebene braucht: einen *Auslöser* (wann), einen *Owner* (wer/welches Modell), ein
  *Artefakt* (was bleibt zurück).

## 5. Offene Grill-Fragen
_(werden hier während des Grills als Entscheidungen protokolliert)_
