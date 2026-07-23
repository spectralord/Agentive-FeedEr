# ADR 0014 — Design-Prozess auf drei Ebenen (Produkt, UX, Inhalt)

- Status: akzeptiert (vom starken Modell gegrillt/entschieden; Benutzer-Override jederzeit möglich)
- Datum: 2026-07-23
- Grundlage: `docs/specs/2026-07-23-design-process.md`; CLAUDE.md (Modell-Arbeitsteilung,
  Branch-Strategie); `future-todos.md` T4 (Design-Experten-Session) / T5 (Persona-Agent).

## Kontext / Problem

Unser Arbeits-/Design-Prozess ist organisch gewachsen: Grill → ADR/Glossar/Epic → Delegation
an Subagenten → Review → Merge/Deploy. Die **Produkt-/Architektur-Ebene** funktioniert, aber
(a) es fehlten explizite Schwellen (wann ADR? wann grillen? wann „fertig designed"?), und (b)
zwei Ebenen fehlten ganz: **UX-/Gamification-Design** (bislang „dürftig") und eine
**Inhalts-Qualitäts-Bewertung** der generierten Reels.

## Entscheidung

Der Design-Prozess wird **explizit in drei Ebenen** geführt, jede mit *Auslöser, Owner,
Artefakt* (Details/Regeln in CLAUDE.md → „Design-Prozess"):

1. **Produkt-/Architektur-Design** — starkes Modell, Grill/Selbst-Grill → ADR + Epic + Glossar.
2. **UX-/Gamification-Design** — eigener Pass vor nutzerseitigen Epics und als periodischer
   Ganzheits-Review; ausgeführt von einer **Design-Experten-Session** mit festem
   **Übergabe-Prompt** (`docs/specs/design-expert-handoff-prompt.md`).
3. **Inhalts-Qualität** — periodischer **Persona-Agent** (bewusst Zukunftsmusik), dessen
   Bewertung in Enrichment-Prompt/`QUALITY_THRESHOLD` zurückfließt.

Ergänzend werden die **Arbeitsregeln** festgeschrieben: ADR-Schwelle, Grillen-vs-direkt-bauen,
Exit-Kriterium „designed enough", Review-Mindest-Checkliste, Parallelitätsgrad (~2–3 Subagenten).

**Sequenzierung:** Die günstigen Engineering-Regeln gelten sofort (kein Nachteil); die erste
*aktive* neue Arbeit ist der **UX-Ganzheits-Pass** (größter Hebel am Kernwert), dafür ist der
Übergabe-Prompt das nächste Deliverable. Ebene 3 bleibt geparkt.

## Alternativen

- **Nur Engineering-Workflow formalisieren** (Ebene 1 schärfen, UX/Inhalt ignorieren): lässt die
  größte Produktschwäche (UX) unadressiert. Verworfen — die günstigen Regeln nehmen wir mit,
  aber der Schwerpunkt liegt auf der fehlenden UX-Ebene.
- **Sofort alles integriert bauen** (drei Ebenen gleichzeitig scharf): zu groß/langsam bis zum
  ersten nutzbaren Ergebnis. Verworfen zugunsten Sequenzierung.
- **UX inline im jeweiligen Epic mitmachen** (kein eigener Pass): reproduziert das bisherige
  „dürftig", weil UX dann immer dem Funktionsdruck weicht. Verworfen — eigener Pass mit eigenem
  Owner/Artefakt.

## Konsequenzen

- CLAUDE.md bekommt einen Abschnitt „Design-Prozess" mit Ebenen + Arbeitsregeln.
- Neues Deliverable: `docs/specs/design-expert-handoff-prompt.md` (Übergabe-Prompt für die
  UX-Experten-Session, Mindset Gamification + gute UX).
- Nutzerseitige Epics (z. B. 6, 7, 8) bekommen künftig vor dem Bau einen UX-Pass-Check.
- Entscheidung ist eine **Selbst-Grill-Entscheidung des starken Modells**; der Benutzer kann
  einzelne Punkte im nächsten Austausch kippen, dann wird dieser ADR revidiert.
