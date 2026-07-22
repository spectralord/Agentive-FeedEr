# Epic 5 — Übersicht / SOTA / Verlauf (MVP-nah)

**Ziel:** Eine Übersichtsseite, die zeigt „was ist gerade State of the Art" —
altersunabhängig — plus Verlauf mit Filtern nach Zeitraum, Kategorie, Relevanz.
Alles abgeleitete Ansichten über dieselben Reels.

**Referenzen:** ADR 0004 (abgeleitete Labels — Kern dieses Epics), Glossar: Label.

---

## Tasks

### ✅ T5.1 — Label-Logik (`src/lib/labels.ts`)
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

### ✅ T5.2 — `/overview`-Seite: SOTA-Sektion
- Oben: „⭐ Aktueller State of the Art" — SOTA-Reels gruppiert nach Kategorie,
  innerhalb der Gruppe sortiert nach `relevanceScore * qualityScore` (nicht nach Datum!),
  max. 5 je Kategorie, kompakte Listendarstellung (Titel, Summary 1. Satz, Datum, Link
  → springt zur Karte im Feed via `/?category=…`).
- **Verifikation:** Altes Reel (> 30 Tage) mit hohen Scores erscheint in SOTA. ✅ Bestätigt
  gegen `scripts/seed-dev.sql`: "Seed Item 13" (39 Tage alt, established, R94/Q98) erscheint
  als einziges SOTA-Reel unter Kategorie „Technik", Link zeigt auf `/?category=technique`.

### ✅ T5.3 — `/overview`-Seite: Verlauf mit Filtern
- Darunter: chronologische Kompaktliste (kein Snap — normale Scroll-Liste) mit
  Filterleiste: Zeitraum (7/30/90 Tage/alles), Kategorie, Maturity,
  Min-Relevanz (Slider oder Stufen 0/50/70), Checkbox „nur Best Practice",
  Checkbox „🧪 experimentell zeigen" (Default: an).
- Zustand wieder rein über searchParams; Wiederverwendung der FilterBar-Bausteine
  aus Epic 3, soweit sinnvoll.
- **Verifikation:** Filterkombinationen gegen Seed-Daten; ältere hochrelevante Items
  sind über Zeitraum „alles" + Min-Relevanz 70 gezielt auffindbar. ✅ Bestätigt per curl
  gegen `npm run start -p 3200` nach Reseed — siehe Abweichungen für die geprüften URLs
  und erwarteten/beobachteten Ergebnisse.

---

## Abschlusskriterien (Epic-DoD)
- Label-Logik existiert genau einmal (`labels.ts`) und wird von Feed **und** Übersicht
  genutzt; SOTA ist altersunabhängig belegbar; Verlauf filterbar.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_

- **`showWeak: true` für die SOTA-Abfrage:** Der globale `QUALITY_THRESHOLD`-Floor von
  `getReels` (Default 60) ist eine Feed-spezifische Vereinfachung (Epic 3, „schwaches
  Signal ausblenden"). `isSota` hat ohnehin eine strengere eigene Quality-Schwelle (≥70),
  daher wird die SOTA-Kandidatenmenge mit `showWeak: true` geholt, um sicherzugehen, dass
  kein potenzielles SOTA-Reel durch den Feed-Floor verloren geht.
- **`getReels`-Erweiterung statt neuer Query-Funktion (T5.3):** Verlauf brauchte Filter, die
  `getReels` noch nicht kannte (`maturity`, `minRelevance`, `publishedAfter`,
  `excludeExperimental`). Diese wurden als zusätzliche, rein faktenbasierte
  `GetReelsOptions`-Felder in `src/lib/feed.ts` ergänzt (kein neues Query-Modul, keine
  Duplikation der bestehenden Filterlogik). Die **Label-Logik selbst** (`isBestPractice`)
  läuft explizit **nicht** in SQL, sondern als JS-Filter über die Ergebnisse von
  `getReels`, unter Wiederverwendung von `src/lib/labels.ts` — damit bleibt Label-Logik
  exakt an einer Stelle (ADR 0004 / DoD).
- **`showWeak: true` auch für den Verlauf:** Aus demselben Grund wie bei SOTA — Verlauf
  soll laut Task explizit über eigene, sichtbare Filter (Min-Relevanz, Maturity,
  Best-Practice, experimentell) gesteuert werden, nicht über einen versteckten
  Qualitäts-Floor aus dem Feed. Konservative, dokumentierte Interpretation — bei Bedarf
  leicht auf einen sichtbaren Verlauf-Toggle umstellbar.
- **„🧪 experimentell zeigen"-Checkbox bezieht sich auf das gespeicherte `experimental`-Flag**,
  nicht auf `maturity === "experimental"` (zwei unterschiedliche Facts laut ADR 0004 —
  `maturity` ist eine Reifegrad-Einstufung, `experimental` ist das separat gespeicherte
  Flag, das auch ReelCards 🧪-Badge steuert). Default an = Flag-Reels werden angezeigt;
  `experimental=0` in der URL blendet sie aus.
- **Kein Infinite-Scroll/„Mehr laden" im Verlauf:** Beide Übersicht-Queries holen bis zu
  1000 Reels auf einmal (`FETCH_LIMIT` in `src/app/overview/page.tsx`), analog zum
  `CANDIDATE_LIMIT`-Muster aus Epic 4 (`src/lib/today.ts`). Für MVP-Datenmengen
  ausreichend; bei starkem Wachstum müsste Verlauf eine eigene Cursor-Pagination wie der
  Feed (`before`) bekommen — im Epic nicht gefordert, daher nicht gebaut.
- **Zeitraum-Grenze inklusiv (`gte`), nicht wie `onlyNew` exklusiv (`gt`):** Für die
  Verlauf-Zeitraum-Stufen (7/30/90 Tage) wurde `publishedAfter` mit `gte` gegen
  `published_at` umgesetzt (im Gegensatz zum Feed-eigenen, NEW_DAYS-spezifischen
  `onlyNew`, das strikt `gt` nutzt). Beide Grenzsemantiken sind für ihre jeweiligen
  Use-Cases plausibel; da das Epic keine exakte Grenzsemantik vorschreibt, wurde die
  einfachste/vorhersagbarste gewählt („Tag X liegt noch im Fenster").
- **Neue Overview-Komponenten** (`src/components/OverviewFilterBar.tsx`,
  `src/components/HistoryList.tsx`): FilterBar aus Epic 3 hat ein anderes Filter-Set
  (Kategorie/Neu/Schwach) und wurde nicht direkt wiederverwendet, aber ihr Muster
  (URL-State, `buildXHref`, Chip-Styling) 1:1 übernommen — wie in T5.3 vorgesehen
  ("Wiederverwendung der FilterBar-Bausteine, soweit sinnvoll").
- **Kein eigener Seiten-Test für `src/app/overview/page.tsx`:** Wie bei `/` (Epic 3) und
  `/today` (Epic 4) bleibt die Server-Component-Seite selbst ungetestet (DB-Zugriff async);
  stattdessen Unit-/Rendertests für die extrahierten Komponenten (`SotaSection.test.tsx`,
  `HistoryList.test.tsx`, `OverviewFilterBar.test.tsx`) plus manuelle curl-Verifikation.
- **Curl-Verifikation (nach Reseed via `scripts/seed-dev.sql`, `npm run start -p 3200`):**
  - `GET /overview` → SOTA zeigt genau „Seed Item 13" (established, R94/Q98, 39 Tage alt,
    Kategorie Technik) unter „Technik", Link `/?category=technique`; Verlauf zeigt alle 14
    Items neueste zuerst.
  - `GET /overview?period=7` → Verlauf genau {Seed Item 0, 1, 2} (0/3/6 Tage alt).
  - `GET /overview?minRelevance=70` (Zeitraum implizit „alles") → Verlauf genau
    {Seed Item 4, 5, 6, 11, 12, 13} — R∈{75,86,97,72,83,94}, Alter bis zu 39 Tage: bestätigt
    die geforderte "ältere hochrelevante Items über Zeitraum alles + Min-Relevanz 70"-Suche.
  - `GET /overview?category=tooling` → Verlauf genau {Seed Item 0, 6, 12}.
  - `GET /overview?maturity=established` → Verlauf genau {Seed Item 1, 4, 7, 10, 13}.
  - `GET /overview?bestPractice=1` → Verlauf genau {Seed Item 3, 7, 13}.
  - `GET /overview?experimental=0` → Verlauf 12 Items, exkl. {Seed Item 4, 9} (die beiden mit
    gesetztem `experimental`-Flag).
  - `GET /overview?category=technique&maturity=established` (Kombination) → Verlauf genau
    {Seed Item 1, 7, 13}.
  - Regressionscheck: `/` zeigt weiterhin 🆕-Neu-Badges, `/today` liefert weiterhin 200.
