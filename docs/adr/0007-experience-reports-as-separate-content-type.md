# ADR 0007 — Erfahrungsberichte als eigener Inhaltstyp

- Status: akzeptiert
- Datum: 2026-07-22

## Kontext / Problem

Es soll einen Bereich für subjektive Erfahrungs-/Praxisberichte geben („wie lange
Session offenhalten", „wann welches Modell", Tricks) — bewusst *nicht zwingend
validiert*, zum Nachdenken anregend, teils selbst/Firma verfasst, teils später aus
Quellen (Reddit/Kommentarspalten) kuratiert. Das steht in direkter Spannung zu ADR 0005
(Sourced-only): Der Reel-Feed verbietet unbelegte Inhalte, weil Vertrauen die Währung
ist. Beides in dieselbe `reels`-Tabelle zu mischen würde diese Vertrauensgrenze
verwischen.

## Entscheidung

Erfahrungsberichte werden ein **eigener Inhaltstyp** (`experience_reports`), getrennt von
`reels`:
- Sie unterliegen **nicht** ADR 0005 — subjektiv/unvalidiert ist erlaubt und klar so
  gekennzeichnet.
- Statt einer `source` tragen sie einen **Autor**: `author_type` (`own` | `curated`,
  später `colleague`) + `author_label`. Das ersetzt im MVP eine echte
  Authentifizierung; echtes Mehrbenutzer-Login ist ein End-of-Road-Feature.
- Relevanz-Score wird nur für `curated` Berichte KI-vergeben (Bedeutung: „breit
  nützlich / zum Nachdenken anregend"); eigene Berichte bleiben neutral (nicht
  heruntergerankt), optional mit KI-Selbst-Feedback auf Anforderung.
- Gemeinsame Konzepte (Skill-Bezug, `outdated`-Markierung) bekommt der Typ über eigene
  Felder — ohne die Reel-Regeln zu erben.

## Alternativen

- **Flag am Reel** (`is_experience`): einfacher im Schema, aber vermischt zwei
  unvereinbare Inhalts-Verträge (belegt vs. subjektiv) in einer Tabelle und einer
  UI-Logik. Verworfen.

## Konsequenzen

- Saubere Quarantäne: im Datenmodell *und* visuell immer klar „gelebte Erfahrung, keine
  verifizierte News".
- Die Naht für späteres echtes Teilen (`author_label` → `user_id`) existiert von Anfang an.
- Zwei Inhaltstypen bedeuten etwas mehr Query-/UI-Fläche; akzeptiert.
