# Epic 10 — Content Verifier (Vision)

> **Status: NUR SKIZZE — vor Umsetzung eigenen Grill + eigenen ADR durchführen.**
> Dieses Feature berührt den Kern der Enrichment-Pipeline (ADR 0003) und muss erst
> durchdacht werden. Nicht ohne Benutzer-Go und Design-Entscheid bauen.

**Ziel:** Ein kritischer KI-Schritt, der Inhalte **beliebiger Herkunft** (Reels *und*
Experience Reports) gegencheckt und zweifelhafte Aussagen mit Vorbehalt markiert — der
„KI richtig nutzen"-Gedanke auf die eigenen Inhalte angewandt.

**Referenzen:** ADR 0005 (Sourced-only), ADR 0003 (Single-Pass — wird berührt),
`docs/specs/2026-07-22-experience-reports-design.md` (Thema 2), Glossar: Verifier.

## Offene Design-Fragen (im Grill zu klären)
- Eigener Pass oder Erweiterung des Enrichment-Single-Pass? (ADR-0003-Spannung)
- Was genau prüft der Verifier — faktische Plausibilität, Widersprüche zu bekanntem
  SOTA, Hype-Marker? Woran macht er „zweifelhaft" fest, ohne selbst zu halluzinieren?
- Reine Markierung (`caveat`-Text) oder auch Score-Einfluss (quality_score)?
- Gilt er auch für unvalidierte Erfahrungsberichte — und wie, ohne deren Zweck
  (subjektiv sein zu dürfen) zu untergraben?

## Grobe Skizze (unverbindlich)
- Feld `caveat` (nullable) an Reel/Report; UI zeigt es als Warnhinweis an der Karte.
- Separater Task `runVerifier` über neu angereicherte Inhalte, der `caveat` setzt, wenn
  eine kritische Prüfung anschlägt — sonst `null` (kein Vorbehalt = Normalfall).
- Kosten/Nutzen gegen einen zweiten LLM-Call pro Item abwägen (evtl. nur für bestimmte
  Kategorien/Quellen).

## Abweichungen/Fragen
_(erst nach Grill zu befüllen)_
