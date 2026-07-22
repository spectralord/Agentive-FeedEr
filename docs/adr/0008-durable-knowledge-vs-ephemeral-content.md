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

- **Ephemere Inhaltsschicht:** News-Reels + `curated` Experience Reports. Dürfen altern,
  überholt/ersetzt werden.
- **Dauerhafte Wissensschicht:** Skill-Nodes + `user_progress`/Adoption-Log + `own`
  Experience Reports. Wächst an, wird **nie automatisch** verworfen.

Regeln, die Beständigkeit garantieren:
1. **Skill-Nodes sind First-Class-Entitäten.** Inhalte *referenzieren* Nodes
   (`content.skill → node`), nie umgekehrt. Ein Node hängt nicht davon ab, dass ein
   bestimmter Inhalt existiert.
2. **Nodes werden einmal erzeugt und nie automatisch gelöscht** (nur manuelles
   Archivieren). Ein Node darf null aktuelle Inhalte haben und trotzdem bestehen.
3. **Fortschritt und Notizen leben am Node**, nicht am Inhalt — sie überleben jeden
   Inhalts-Austausch.
4. **„Dauerhaft" ≠ „unsterblich":** Auch `own`/Firmen-Berichte können manuell als
   `outdated`/`superseded` markiert (mit Grund/Verweis) und manuell gelöscht werden — sie
   sind nur nicht Teil des *automatischen* Churns.

## Alternativen

- **Skill-Nodes aus vorhandenen Inhalten ableiten (kein First-Class):** einfacher, aber
  Baum und Fortschritt churnen mit dem Feed. Verworfen — widerspricht der geforderten
  Beständigkeit.

## Konsequenzen

- Der Feed churnt, der Skill-Tree akkumuliert.
- Eigene Erfahrungsberichte **verankern** Nodes zusätzlich (dauerhafter Inhalt, der
  bleibt, wenn alle News zum Thema veraltet sind).
- Erfordert Aufräum-Disziplin (Archivieren) statt Auto-Delete; bewusst gewählt.
