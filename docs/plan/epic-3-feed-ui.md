# Epic 3 — Reel-Feed-UI (MVP)

**Ziel:** Vertikaler, mobil-first Scroll-Snap-Feed der Reels (iPad ist das
Referenzgerät), mit Basis-Filtern und Low-Signal-Toggle.

**Referenzen:** ADR 0004 (Labels = Filter), Glossar: Feed, Reel, Label.

---

## Tasks

### ☐ T3.1 — Datenzugriff (`src/lib/feed.ts`)
- `getReels(opts: { before?: Date; category?: string; onlyNew?: boolean; showWeak?: boolean; limit?: number })`
  → Join `reels` + `raw_items` (+ `sources.name`), sortiert `published_at DESC`,
  Default-Limit 50.
- Filterlogik:
  - Standard: `quality_score >= env.QUALITY_THRESHOLD`; `showWeak` hebt das auf.
  - `onlyNew`: `published_at > now() - env.NEW_DAYS`.
  - `category`: exakte Übereinstimmung.
  - `before`: Cursor für „mehr laden" (ältere Items).
- **Verifikation:** Unit-/Integrationstests der Filterkombinationen gegen Seed-Daten.

### ☐ T3.2 — ReelCard-Komponente (`src/components/ReelCard.tsx`)
Aufbau einer Karte (volle Viewport-Höhe):
1. Kopfzeile: Source-Name · relatives Datum („vor 2 Tagen").
2. Badges: Kategorie, Maturity, `🧪 experimentell` (nur wenn Flag), abgeleitetes
   `🆕`-Badge (published < NEW_DAYS — Anzeige-Logik, nicht gespeichert!).
3. Titel (aus raw_item) + Summary.
4. Falls `example`: monospaced Block mit Überschrift „Beispiel (aus der Quelle)".
5. Falls `action`: hervorgehobene Zeile „➜ Für dich:" + Text + Effort-Tag-Chip
   (`5-Min-Test` / `Nachmittag` / `Nur wissen`).
6. Fußzeile: Quell-Link (öffnet neuen Tab) · dezente Score-Anzeige (`R 82 · Q 74`).
- **Verifikation:** Rendertest mit Voll-Reel und Minimal-Reel (alle nullables null).

### ☐ T3.3 — Scroll-Snap-Feed (`src/app/page.tsx`)
- Server Component lädt via `getReels` (searchParams → Filter).
- Layout:
```css
.feed { height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; }
.reel { min-height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; }
```
- `100dvh` (nicht `vh`) wegen iOS/iPadOS-Browserleisten; Karteninhalt selbst
  scrollbar (`overflow-y:auto` innerhalb der Karte), falls er höher als der Viewport ist.
- Leerzustand: freundlicher Hinweis + Hinweis auf `npm run job:daily`.
- **Verifikation:** Manuell in Safari-Simulation (responsive Mode, iPad-Größe):
  sauberes Einrasten pro Karte, kein horizontales Scrollen.

### ☐ T3.4 — Filterleiste (`src/components/FilterBar.tsx`)
- Kompakte, horizontale Chip-Leiste (fixiert oben, halbtransparent):
  Kategorie-Chips (aus Enum), Chip „🆕 Neu", Toggle „schwaches Signal zeigen".
- Zustand ausschließlich über URL-searchParams (`?category=`, `?new=1`, `?weak=1`,
  `?before=`) — keine Client-State-Library.
- **Verifikation:** Jede Filterkombination ist als URL teil-/bookmarkbar und lädt korrekt.

### ☐ T3.5 — „Mehr laden"
- Unter der letzten Karte Button „Ältere laden" → gleiche Route mit
  `?before=<publishedAt der letzten Karte>` (Server-seitig, kein Infinite-Scroll-JS).
- **Verifikation:** Zwei Seiten durchblättern, keine Duplikate/Lücken.

---

## Abschlusskriterien (Epic-DoD)
- Feed am iPad (bzw. Simulation) flüssig vertikal snappend; Filter + Toggle + Cursor
  funktionieren rein über URL; Low-Signal standardmäßig ausgeblendet, nie gelöscht.
- Build + Tests grün.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
