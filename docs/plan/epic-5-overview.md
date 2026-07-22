# Epic 5 — Übersicht / SOTA / Verlauf (MVP-nah)

**Ziel:** Eine Übersichtsseite, die zeigt „was ist gerade State of the Art" —
altersunabhängig — plus Verlauf mit Filtern nach Zeitraum, Kategorie, Relevanz.
Alles abgeleitete Ansichten über dieselben Reels.

**Referenzen:** ADR 0004 (abgeleitete Labels — Kern dieses Epics), Glossar: Label.

---

## Tasks

### ☐ T5.1 — Label-Logik (`src/lib/labels.ts`)
Eine Funktion pro Label, pure Functions, zentral und getestet — **nirgendwo sonst
Label-Logik duplizieren** (ReelCard aus Epic 3 auf diese Funktionen umstellen):

```ts
export const isNew = (r, now = new Date()) =>
  r.publishedAt > new Date(now.getTime() - env.NEW_DAYS * 86_400_000);

export const isSota = (r) =>
  r.maturity === "established" && r.relevanceScore >= 70 && r.qualityScore >= 70;

export const isBestPractice = (r) =>
  r.maturity !== "experimental" && r.action !== null && r.qualityScore >= 70;
```
- `isSota` ist bewusst **altersunabhängig** (das war die explizite Anforderung).
- **Verifikation:** Unit-Tests inkl. Grenzwerte (Score 69/70, Maturity-Varianten).

### ☐ T5.2 — `/overview`-Seite: SOTA-Sektion
- Oben: „⭐ Aktueller State of the Art" — SOTA-Reels gruppiert nach Kategorie,
  innerhalb der Gruppe sortiert nach `relevanceScore * qualityScore` (nicht nach Datum!),
  max. 5 je Kategorie, kompakte Listendarstellung (Titel, Summary 1. Satz, Datum, Link
  → springt zur Karte im Feed via `/?category=…`).
- **Verifikation:** Altes Reel (> 30 Tage) mit hohen Scores erscheint in SOTA.

### ☐ T5.3 — `/overview`-Seite: Verlauf mit Filtern
- Darunter: chronologische Kompaktliste (kein Snap — normale Scroll-Liste) mit
  Filterleiste: Zeitraum (7/30/90 Tage/alles), Kategorie, Maturity,
  Min-Relevanz (Slider oder Stufen 0/50/70), Checkbox „nur Best Practice",
  Checkbox „🧪 experimentell zeigen" (Default: an).
- Zustand wieder rein über searchParams; Wiederverwendung der FilterBar-Bausteine
  aus Epic 3, soweit sinnvoll.
- **Verifikation:** Filterkombinationen gegen Seed-Daten; ältere hochrelevante Items
  sind über Zeitraum „alles" + Min-Relevanz 70 gezielt auffindbar.

---

## Abschlusskriterien (Epic-DoD)
- Label-Logik existiert genau einmal (`labels.ts`) und wird von Feed **und** Übersicht
  genutzt; SOTA ist altersunabhängig belegbar; Verlauf filterbar.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
