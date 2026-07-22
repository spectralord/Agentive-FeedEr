# ADR 0009 — Skill-Tagging als Match-or-Propose-Pipeline-Stufe

- Status: akzeptiert
- Datum: 2026-07-22
- Berührt: ADR 0003 (Single-Pass-Enrichment)

## Kontext / Problem

Inhalte (Reels + Experience Reports) sollen einem Skill-Node zugeordnet werden, ohne dass
der Nutzer manuell taggt. Zwei naive Wege scheitern:
- **Freies Generieren** eines Slugs pro Item ⇒ Taxonomie-Explosion (`prompt-caching`,
  `prompt-cache`, `caching` … als getrennte Nodes).
- **Feste, geschlossene Liste** ⇒ neue/aufkommende Skills können nicht erfasst werden —
  fatal für ein „am Ball bleiben"-Tool.

Zudem kann der Enrichment-Single-Pass (ADR 0003) die Zuordnung nicht sauber leisten: Er
sieht nur *ein* Item, nicht die *globale* aktuelle Knotenliste, die zum Matchen nötig ist.

## Entscheidung

Ein **eigener Pipeline-Schritt „SkillTagger"** ordnet per **Match-or-Propose** zu:
- **Match:** Item + aktuelle Skill-Node-Liste (Slugs + Kurzbeschreibungen) → bester
  Treffer, wenn über Konfidenz-Schwelle. Treffer werden **im Hintergrund automatisch**
  zugeordnet.
- **Propose:** Passt nichts, wird ein neuer Node *vorgeschlagen* — angelegt aber **nur mit
  Nutzer-Bestätigung** (anlegen / in bestehenden mergen / verwerfen). Vorschläge blockieren
  den Batch nicht; das Item bleibt bis zur Bestätigung ungetaggt.
- **Skalierung:** Solange die Taxonomie in den Prompt passt (Dutzende Nodes), reicht die
  reine LLM-Zuordnung. Embedding-basiertes Dedup ist eine **spätere** Optimierung für
  große Taxonomien — nicht im ersten Bau.

Konsequenz für ADR 0003: Die Skill-Zuordnung wandert **aus** dem Single-Pass heraus. Der
Enrichment-Pass liefert nur noch eine **rohe Kompetenz-Vermutung** (Freitext); die
Reconciliation gegen die kontrollierte Vokabelliste macht der SkillTagger.

**Ein Tagger, mehrere Auslöser** (Logik von Trigger entkoppelt, verarbeitet `skill IS NULL`):
- **Reels:** als Stufe im Daily-Job nach dem Enrichment (Batch).
- **Manuelle Reports:** direkt nach dem Speichern für das eine Item (Einzel-Call, billig).
- **Daily-Run als Backstop:** sweept alle noch ungetaggten Items (fehlgeschlagenes
  On-Save-Tagging, nach Bestätigung freigegebene Vorschläge).

## Alternativen

- **Offenes Generieren / geschlossene Liste:** siehe Problem — beide verworfen.
- **Zuordnung im Enrichment-Single-Pass belassen:** kein globaler Taxonomie-Kontext,
  Explosionsgefahr. Verworfen.
- **Sofort Embeddings/Vektor-Dedup:** unnötige Komplexität + Abhängigkeit bei kleiner
  Taxonomie. Auf später verschoben.

## Konsequenzen

- Kontrollierte, aber *wachsende* Taxonomie: automatisch matchen, neue Nodes nur per
  Ein-Klick-Bestätigung — verhindert Wildwuchs.
- Enrichment wird um die harte Skill-Entscheidung entlastet (liefert nur eine Vermutung).
- Neuer Zustand nötig: „pending proposal" für vorgeschlagene, unbestätigte Nodes.
- Embedding-Provider-Wahl bleibt eine offene, bewusst vertagte Entscheidung.
