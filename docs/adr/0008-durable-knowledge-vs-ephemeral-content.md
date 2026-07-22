# ADR 0008 — Dauerhafte Wissensschicht vs. ephemere Inhaltsschicht

- Status: akzeptiert
- Datum: 2026-07-22

## Kontext / Problem

Reels (und kuratierte Berichte) sind flüchtig — sie altern, werden überholt und
perspektivisch durch Neueres ersetzt. Der Skill-Tree soll aber **beständig** sein: Die
Kompetenz „Prompt-Caching" verschwindet nicht, nur weil der Artikel, der sie einem
beibrachte, aus dem Feed gealtert ist. Würde man Skill-Nodes und Fortschritt aus den
aktuell vorhandenen Inhalten *ableiten und wegwerfen*, würde der Baum mit dem Feed
churnen und Fortschritt/Notizen gingen verloren.

## Entscheidung

Es gibt zwei Schichten mit unterschiedlichem Lebenszyklus:

- **Ephemere Inhaltsschicht:** News-Reels + `curated` Experience Reports. Rotieren mit der
  Zeit automatisch aus den *aktiven* Ansichten heraus — **nicht** durch Löschen, sondern
  über den Lebenszyklus `active → deprecated → archived`.
- **Dauerhafte Wissensschicht:** Skill-Nodes + `user_progress`/Adoption-Log + `own`
  Experience Reports. Wächst an, bleibt aktiv, bis *manuell* zustandsverschoben.

**Einheitlicher Lebenszyklus (kein Auto-Delete):** Alles — Reels, Reports *und*
Skill-Nodes — trägt einen `lifecycle_state`:
- `active` → in normalen Ansichten sichtbar.
- `deprecated` → überholt (mit `reason`/`superseded_by`); raus aus aktiven Ansichten, aber
  im Verlauf/History weiter auffindbar.
- `archived` → nur noch in expliziter Archiv-/Historien-Ansicht.
Nichts wird **automatisch gelöscht**; alles bleibt historisch nachvollziehbar. Hartes
Löschen ist ausschließlich eine seltene, bewusste manuelle Aktion.

Regeln, die Beständigkeit garantieren:
1. **Skill-Nodes sind First-Class-Entitäten.** Inhalte *referenzieren* Nodes
   (`content.skill → node`), nie umgekehrt. Ein Node hängt nicht davon ab, dass ein
   bestimmter Inhalt existiert.
2. **Nodes werden einmal erzeugt und nie automatisch gelöscht** (nur manuelles
   Archivieren). Ein Node darf null aktuelle Inhalte haben und trotzdem bestehen.
3. **Fortschritt und Notizen leben am Node**, nicht am Inhalt — sie überleben jeden
   Inhalts-Austausch.
4. **„Dauerhaft" ≠ „für immer aktiv":** Auch `own`/Firmen-Berichte können manuell
   `deprecated`/`archived` werden (mit Grund/`superseded_by`) — sie sind nur nicht Teil des
   *automatischen* Herausrotierens. Auch sie werden nicht auto-gelöscht.

## Alternativen

- **Skill-Nodes aus vorhandenen Inhalten ableiten (kein First-Class):** einfacher, aber
  Baum und Fortschritt churnen mit dem Feed. Verworfen — widerspricht der geforderten
  Beständigkeit.

## Konsequenzen

- Der Feed rotiert (aktive Ansicht), der Skill-Tree akkumuliert — beide Schichten
  behalten ihre volle Historie.
- Eigene Erfahrungsberichte **verankern** Nodes zusätzlich (dauerhafter Inhalt, der
  bleibt, wenn alle News zum Thema veraltet sind).
- Erfordert Aufräum-Disziplin (Archivieren) statt Auto-Delete; bewusst gewählt.
