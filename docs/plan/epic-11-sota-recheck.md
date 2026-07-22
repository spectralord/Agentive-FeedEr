# Epic 11 — SOTA-Frische-Re-Check (Vision)

> **Status: NUR SKIZZE — vor Umsetzung eigenen Grill durchführen.**
> Nicht ohne Benutzer-Go und geklärte „noch SOTA?"-Kriterien bauen.

**Ziel:** Verhindern, dass altersunabhängig als „State of the Art" markierte Einträge
(Epic 5, `isSota`) hängenbleiben, obwohl sie längst überholt sind. Ein periodischer Job
re-evaluiert aktuelle SOTA-Einträge gegen Neueres und markiert Überholtes.

**Referenzen:** ADR 0004 (`isSota` altersunabhängig), ADR 0008 (outdated/superseded als
gemeinsame Mechanik), `docs/specs/2026-07-22-experience-reports-design.md` (Thema 3).

## Offene Design-Fragen (im Grill zu klären)
- Woran erkennt der Job „überholt"? Neueres Reel im selben Skill/Kategorie mit höherem
  Score? Explizite Widerlegung? Rein zeitbasiert wäre falsch (SOTA ist bewusst zeitlos).
- Aktion bei „überholt": `outdated`/`superseded_by` setzen (Verweis auf Nachfolger) oder
  `maturity` herabstufen? Automatisch oder nur vorschlagen?
- Kadenz: eigener Cron oder Stufe im Daily-Job? (Analogie: Enrichment/SkillTagger sind
  Stufen — vermutlich hier auch.)

## Grobe Skizze (unverbindlich)
- Task `runSotaRecheck`: nimmt aktuelle SOTA-Einträge (via `isSota`), sucht je Skill/
  Kategorie neuere, stärkere Kandidaten; bei Verdrängung `outdated`/`superseded_by` setzen
  (dieselbe Mechanik wie bei Erfahrungsberichten, ADR 0008).
- Konservativ: eher **vorschlagen** als automatisch herabstufen (mensch-im-Loop), damit
  nichts fälschlich verschwindet.

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
