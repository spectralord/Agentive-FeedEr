# Erfahrungsberichte & Qualitäts-Erweiterungen — Design

- Datum: 2026-07-22
- Status: zur Review / Grundlage der Umsetzung (Epics 9–12)
- Verwandt: `docs/specs/2026-07-21-agentive-feeder-design.md`, ADRs 0007–0009, `CONTEXT.md`

Aus der Grill-Session vom 2026-07-22 sind **vier** benannte Design-Themen entstanden.
Nur Thema 1 ist voll durchgegrillt; 2–4 sind bewusst skizziert und werden vor Umsetzung
je einzeln durchgegrillt.

---

## Thema 1 — Erfahrungs-Sektion (Epic 9)

### Zweck
Ein Ort für subjektive, gelebte Erfahrung („wie lange Session offen", „wann welches
Modell", Tricks) — nicht zwingend validiert, zum Nachdenken anregend, als **Company-Wissen**
von Kollegen ergänzbar. Bewusst **außerhalb** von ADR 0005 (Sourced-only), sauber vom
verifizierten Reel-Feed getrennt (ADR 0007).

### Datenmodell (`experience_reports`)
- `id`, `title`, `body` (Markdown), `created_at`, `updated_at`
- `author_type`: `own` | `curated` (später `colleague`)
- `author_label`: Name (own) / Quell-Handle (curated)
- `relevance_score` (nullable): nur für `curated` KI-vergeben; Bedeutung „breit nützlich /
  anregend", nicht „passt zu meinem Profil"
- `skill` (nullable): kanonischer Skill-Slug — **nicht vom Nutzer**, vom SkillTagger
  (Thema 4) gesetzt
- `lifecycle_state` (`active`|`deprecated`|`archived`), `lifecycle_reason` (nullable), `superseded_by` (nullable → report/reel)
- `source_url` (nullable): nur bei `curated`
- `metadata JSONB`

### Relevanz-Score (Grill-Ergebnis)
- **Eigene Berichte:** neutral dargestellt, **nicht** heruntergerankt. Optional kann der
  Nutzer *aktiv* eine KI-Einschätzung als **Selbst-Feedback** anfordern (kein Filter).
- **Kuratierte Berichte:** KI-bewertet fürs Ranking (Ausbaupfad A→C: erst KI-Score,
  später „hilfreich"-Votes, sobald Mehrbenutzer).

### Beständigkeit (ADR 0008)
Eigene Berichte gehören zur **dauerhaften Wissensschicht** — rotieren nicht automatisch
heraus, sind aber manuell über den `lifecycle_state` (`active → deprecated → archived`,
mit Grund/`superseded_by`) verschiebbar. **Kein Auto-Delete**; alles bleibt historisch
nachvollziehbar (ADR 0008). Hartes Löschen nur als seltener manueller Notausgang.

### Skill-Bezug & Actionables
- Berichte tragen denselben optionalen `skill`-Bezug wie Reels ⇒ tauchen auf Skill-Nodes
  **gelabelt** (nicht als eigene Rubrik) neben Reels auf.
- Aus Reels *und* Berichten werden **Actionables** („To-Try") abgeleitet — die abhakbare
  Fortschritts-Einheit. Reels/Berichte selbst werden **nie** abgehakt. (Actionable-Konzept
  = Thema-übergreifend, greift in Epic 6/7 — siehe „Revidierte Annahmen".)

### MVP-Schnitt (Epic 9)
**Drin:** Entität + Migration · eigene/Firmen-Berichte erfassen/bearbeiten (Formular:
Titel, Markdown, optional „⭐ wichtig") · Anzeige-Seite, filterbar nach `author_type` ·
Lifecycle-Aktionen (`deprecated`/`archived`/reaktivieren) mit Grund + optionalem `superseded_by`.
**Nicht drin (Folge-Themen):** kuratierte Berichte + Scraping (Reddit/Kommentare) ·
KI-Selbst-Feedback · Skill-Tagging (Thema 4) · Actionables (eigenes Thema, greift Epic 7).

---

## Thema 2 — Content Verifier (Epic 10, Vision)

Ein kritischer KI-Schritt, der Inhalte **beliebiger Herkunft** gegencheckt und
zweifelhafte Aussagen mit `caveat` markiert (Reels *und* Berichte). Besonders wertvoll für
unvalidierte Erfahrungsberichte. Berührt den Enrichment-Pfad und rüttelt an ADR 0003
(Single-Pass) → eigener Grill + eigener ADR vor Umsetzung. Skizze: zusätzliches
`caveat`-Feld/-Schritt, Anzeige als Warnhinweis an der Karte.

---

## Thema 3 — SOTA-Frische-Re-Check (Epic 11, Vision)

`isSota` ist bewusst altersunabhängig (Epic 5), daher können überholte Einträge als „State
of the Art" hängenbleiben. Ein periodischer Job re-evaluiert aktuelle SOTA-Einträge gegen
Neueres und setzt Überholtes auf `lifecycle_state = deprecated` (`superseded_by` — dieselbe
Mechanik wie bei Berichten, ADR 0008) oder stuft `maturity` herab. Passt ins Daily-Job-Muster. Eigener Grill vor
Umsetzung (Kriterien „noch SOTA?").

---

## Thema 4 — SkillTagger (Epic 12) — siehe ADR 0009

**Match-or-Propose** ordnet Inhalten kanonische Skill-Nodes zu:
- Match auf bestehenden Node → automatisch im Hintergrund.
- Kein Treffer → neuen Node *vorschlagen*, Anlegen nur mit Nutzer-Bestätigung.
- Solange Taxonomie in den Prompt passt: reine LLM-Zuordnung; Embeddings später.
- **Ein Tagger, mehrere Trigger:** Reels im Daily-Job (Batch); manuelle Reports on-save
  (Einzel-Item); Daily-Run als Backstop für alles noch Ungetaggte.
- Enrichment liefert künftig nur eine **rohe Kompetenz-Vermutung**; der SkillTagger
  reconciled sie gegen die kontrollierte Vokabelliste (revidiert ADR 0003).

SkillTagger ist **Voraussetzung** für die Skill-Map (Epic 7) und für den Skill-Bezug der
Erfahrungs-Sektion.

---

## Revidierte Annahmen bestehender Epics

Diese Grill-Session ändert Annahmen in noch **nicht gebauten** Epics (6/7). Die
Änderungen sind hier festgehalten; die betroffenen Epic-Files verweisen hierher.

- **Actionable/To-Try als Fortschritts-Einheit:** Nicht Reels/Reports werden abgehakt,
  sondern daraus abgeleitete Actionables. Der Skill-Node steigt über erledigte Actionables.
  → Betrifft Epic 6 („tried"-Interaktion) und Epic 7 (Fortschritts-Logik).
- **Skill-Node hat zusätzlich einen Selbst-Status** („kenne ich" / „schon verprobt"):
  Wer das Wissen schon hat, muss keine Actionables erledigen. Selbst-Deklaration **und**
  Actionable-Belege existieren nebeneinander. → Epic 7.
- **Skill-Zuordnung kommt vom SkillTagger** (Epic 12), nicht aus dem Enrichment-Pass und
  nicht vom Nutzer. → Epic 7 (Node-Aggregation T7.2 wird durch Epic 12 ersetzt/erweitert).

---

## Reihenfolge / Abhängigkeiten
- **Epic 9** (Erfahrungs-Sektion MVP) ist unabhängig baubar (ohne Skill-Tagging/Actionables).
- **Epic 12** (SkillTagger) sollte **vor** Epic 7 (Skill-Map) kommen und schaltet den
  Skill-Bezug für Epic 9 frei.
- **Epic 10/11** (Verifier, SOTA-Re-Check) sind unabhängige Vision-Erweiterungen.
- Alle 9–12: erst nach explizitem Benutzer-Go bzw. eigenem Grill (10/11) bauen.
