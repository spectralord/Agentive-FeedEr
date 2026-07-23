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

## 4. Drei Ebenen des Design-Prozesses (Zielbild)

Jede Ebene braucht **Auslöser** (wann), **Owner** (wer), **Artefakt** (was bleibt):

| Ebene | Auslöser | Owner | Artefakt |
|---|---|---|---|
| **Produkt-/Architektur-Design** | echte Weggabelung / Datenmodell-Änderung | starkes Modell (Opus), Grill | ADR + Epic-Plan + Glossar |
| **UX-/Gamification-Design** | neues nutzerseitiges Epic *oder* periodischer Ganzheits-Pass | **Design-Experten-Session** (T4) | UX-Spec / Design-ADR + baubare UI-Tasks |
| **Inhalts-Qualität** | periodisch, Stichprobe generierter Reels | **Persona-Agent** (T5, Zukunftsmusik) | Bewertung → speist Enrichment-Prompt/Threshold |

Heute ist nur die erste Ebene ausgeprägt.

## 5. Vorschlag des starken Modells je offener Frage (im Grill zu bestätigen/kippen)

> Das sind **meine Empfehlungen**, keine getroffenen Entscheidungen — der Benutzer bestätigt
> oder kippt sie im Grill. Erst dann wandern sie nach CLAUDE.md bzw. in einen ADR.

- **L1 — ADR-Schwelle → Vorschlag:** ADR, wenn eine Entscheidung (a) schwer reversibel ist
  oder Struktur/Datenmodell prägt, (b) eine plausible Alternative *verwirft*, die man sich
  merken sollte, oder (c) von späterer Arbeit referenziert wird. Sonst reicht Glossar (neuer
  Begriff) oder Epic-Notiz (lokales Detail). Faustregel: *„Würde ein künftiges Ich/ein
  Subagent das ohne das Warum falsch wiederholen?"* → ADR.
- **L2 — Grillen vs. direkt bauen → Vorschlag:** Grillen bei echter Weggabelung mit
  Trade-offs, unklarer Intention oder querschnittlicher Wirkung. Direkt delegieren bei
  mechanischen/klar spezifizierten Tasks. Lackmustest: *„Kann ich die Epic-Tasks eindeutig
  schreiben, ohne eine Entscheidung zu treffen?"* ja → bauen, nein → grillen.
- **L3 — UX-Design-Prozess → Vorschlag:** Eigener **UX-/Gamification-Pass** als distinkte
  Phase, ausgelöst (a) *vor* dem Bau jedes nutzerseitigen Epics mit neuen Screens/Interaktionen
  und (b) einmal jetzt als **Ganzheits-Review** (weil UX aktuell dürftig). Owner: die geparkte
  **T4-Design-Experten-Session** (Opus/Design-Agent, umfassender Übergabe-Prompt, Mindset
  Gamification + gute UX). Artefakt: UX-Spec/Design-ADR + konkrete, baubare UI-Tasks.
- **L4 — Persona-Loop (T5) → Vorschlag:** Zukunftsmusik lassen, aber Andockpunkt definieren:
  Persona-Agent zieht periodisch Stichproben generierter Reels, bewertet Entwickler-Mehrwert;
  Ergebnis fließt in Enrichment-Prompt/`QUALITY_THRESHOLD`-Tuning. Nicht jetzt bauen.
- **L5 — Review-Tiefe → Vorschlag:** Feste **Mindest-Checkliste** (Build grün, Tests grün,
  Task-Verifikationen ausgeführt, keine ADR-Verletzung, keine neuen Libs, Diff auf das Epic
  begrenzt) **plus** situativ tiefer bei architektonisch bedeutsamen Änderungen.
- **L6 — „Designed enough" → Vorschlag:** Exit-Kriterium = jeder Ast des Entscheidungsbaums
  ist *aufgelöst oder bewusst mit Notiz vertagt*; Epic-Tasks eindeutig mit Verifikationsschritten
  schreibbar; kein „TBD" im kritischen Pfad.
- **L7 — Parallelitätsgrad → Vorschlag:** Gleichzeitige Subagenten auf das begrenzen, was das
  starke Modell gut reviewen kann (~2–3), jeder auf eigenem Branch; **Task-Board + README-
  Status-Tabelle** als einzige Wahrheitsquelle, an jeder Epic-Grenze aktualisiert.

## 6. Offene Grill-Fragen (Protokoll)
- **F1 (offen):** Scope-Priorität — UX-Praxis (A) vs. Engineering-Workflow formalisieren (B)
  vs. beides integriert (C)? Empfehlung des starken Modells: **A**, danach B nachziehen.
_(weitere Fragen + Entscheidungen werden hier während des Grills protokolliert)_
