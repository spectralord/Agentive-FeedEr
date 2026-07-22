# Epic 3 — Reel-Feed-UI (MVP)

**Ziel:** Vertikaler, mobil-first Scroll-Snap-Feed der Reels (iPad ist das
Referenzgerät), mit Basis-Filtern und Low-Signal-Toggle.

**Referenzen:** ADR 0004 (Labels = Filter), Glossar: Feed, Reel, Label.

---

## Tasks

### ☑ T3.1 — Datenzugriff (`src/lib/feed.ts`)
- `getReels(opts: { before?: Date; category?: string; onlyNew?: boolean; showWeak?: boolean; limit?: number })`
  → Join `reels` + `raw_items` (+ `sources.name`), sortiert `published_at DESC`,
  Default-Limit 50.
- Filterlogik:
  - Standard: `quality_score >= env.QUALITY_THRESHOLD`; `showWeak` hebt das auf.
  - `onlyNew`: `published_at > now() - env.NEW_DAYS`.
  - `category`: exakte Übereinstimmung.
  - `before`: Cursor für „mehr laden" (ältere Items).
- **Verifikation:** Unit-/Integrationstests der Filterkombinationen gegen Seed-Daten.

### ☑ T3.2 — ReelCard-Komponente (`src/components/ReelCard.tsx`)
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

### ☑ T3.3 — Scroll-Snap-Feed (`src/app/page.tsx`)
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

### ☑ T3.4 — Filterleiste (`src/components/FilterBar.tsx`)
- Kompakte, horizontale Chip-Leiste (fixiert oben, halbtransparent):
  Kategorie-Chips (aus Enum), Chip „🆕 Neu", Toggle „schwaches Signal zeigen".
- Zustand ausschließlich über URL-searchParams (`?category=`, `?new=1`, `?weak=1`,
  `?before=`) — keine Client-State-Library.
- **Verifikation:** Jede Filterkombination ist als URL teil-/bookmarkbar und lädt korrekt.

### ☑ T3.5 — „Mehr laden"
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

- **Verifikationsmethode statt „manuell in Safari/iPad":** Wie in der Aufgabe für
  dieses Modell vorgegeben, wurde die manuelle Simulation durch
  `npm run build` + `npm run start -- -p 3200` + `curl` gegen die gerenderte
  HTML-Struktur ersetzt. Geprüft: `.feed`-Container trägt `h-dvh snap-y
  snap-mandatory overflow-y-auto overflow-x-hidden`, jede Karte
  `min-h-dvh snap-start [scroll-snap-stop:always]`, Karteninhalt selbst
  `h-dvh overflow-y-auto` (scrollt intern, falls höher als Viewport). Kein
  automatisierter Cross-Browser-/Touch-Test möglich — bei echtem
  iPad/Safari-Zugriff sollte das Einrasten trotzdem einmal visuell
  gegengeprüft werden.
- **`getReels`-Signatur:** exakt wie im Plan spezifiziert (`getReels(opts)`,
  kein injizierbarer `db`-Parameter wie bei `runEnrichment`/`runIngestion`),
  weil der Plan-Text die Signatur wörtlich vorgibt. Tests seeden über
  `db()` direkt (gleicher Singleton-Pool) — funktioniert identisch.
- **Unbekannter `category`-Wert in der URL:** wird still ignoriert (Filter
  greift nicht, kein Fehler, keine leere Liste) statt z. B. 400 zu werfen —
  konservativste Interpretation, da der Plan dazu nichts festlegt und Chips
  in der FilterBar ohnehin nur gültige Werte erzeugen.
- **Kein Rendertest-Framework (kein `@testing-library/react`, kein jsdom):**
  Da `vitest.config.ts` `environment: "node"` nutzt und keine neuen
  Dependencies erlaubt sind, werden `ReelCard` und `FilterBar` über
  `renderToStaticMarkup` aus dem bereits vorhandenen `react-dom` gerendert
  und die HTML-Ausgabe auf erwartete Fragmente geprüft (Voll-/Minimal-Reel
  für T3.2, aktive/inaktive Chips + Hrefs für T3.4). Deckt die geforderte
  Verifikation ab, ohne neue Bibliotheken einzuführen.
- **Zusätzliche Dateien außerhalb der im Plan genannten drei:**
  `src/lib/relativeTime.ts` (+ Test) für „vor 2 Tagen"-Formatierung und
  `src/components/labels.ts` für die deutschen Kategorie-/Reife-/Effort-Labels
  (von `ReelCard` und `FilterBar` gemeinsam genutzt). Reine Hilfsmodule ohne
  neue Dependencies, kein Scope über T3.1–T3.5 hinaus.
- **„Mehr laden" nur bei vollem Ergebnis sichtbar:** Der Button erscheint nur,
  wenn `reels.length === DEFAULT_FEED_LIMIT` (50) ist, als günstiges Signal,
  dass ältere Items existieren könnten. Bei den 12 Seed-Reels ist das nie der
  Fall; die Cursor-Logik selbst wurde separat end-to-end per `curl` mit einem
  manuell gesetzten `?before=`-Parameter gegen den laufenden Server verifiziert
  (siehe Abschlussbericht) sowie durch einen dedizierten Mehrseiten-Test in
  `src/lib/feed.test.ts` (T3.1) mit `limit: 2`.
- **Geseedete Test-Reels durch Integrationstests gelöscht und neu erzeugt:**
  Wie in den Umgebungsfakten antizipiert, TRUNCATEn die Integrationstests
  (`feed.test.ts`, plus die bereits bestehenden Ingestion-/Enrichment-Tests)
  `reels`/`raw_items`/`sources`. Die ursprünglichen 12 Seed-Reels/20 Raw-Items
  wurden dadurch entfernt. Für die HTML-Verifikation wurden sie über ein
  temporäres, nicht committetes Skript (`tmp-reseed.ts`, nach Gebrauch
  gelöscht) mit vergleichbarer Varianz neu erzeugt (Quality-Score 30–98,
  alle 6 Kategorien, alle 3 Reifegrade, mit/ohne Example/Action). Nach dem
  finalen `npm test`-Lauf wurde erneut mit diesem Skript reseedet, sodass die
  DB am Ende wieder 12 Reels/20 Raw-Items enthält — inhaltlich aber nicht
  identisch mit dem ursprünglichen Zustand vor dieser Session.
