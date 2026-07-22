# Epic 4 — Today's Top-N (MVP)

**Ziel:** Eine „Heute"-Ansicht mit den N (Default 3) wichtigsten Reels — der
Anti-Doomscroll: fertig sein dürfen. Reine abgeleitete Ansicht, keine neue Datenstruktur.

**Referenzen:** ADR 0004, Glossar: Today's Top-N.

---

## Tasks

### ✅ T4.1 — Ranking (`src/lib/ranking.ts`)
```ts
// score ∈ [0,1]; Halbwertszeit der Frische ≈ 7 Tage
export function topScore(r: { relevanceScore: number; qualityScore: number; publishedAt: Date }, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - r.publishedAt.getTime()) / 86_400_000);
  const recency = Math.exp(-ageDays / 7);
  return (r.relevanceScore / 100) * (r.qualityScore / 100) * recency;
}
```
- **Verifikation (Unit-Tests, exakt):**
  - heute, R100/Q100 ⇒ 1.0
  - 7 Tage alt, R100/Q100 ⇒ ≈ 0.3679 (±0.001)
  - heute, R50/Q80 ⇒ 0.4
  - Reihenfolge: frisches R70/Q70 schlägt 14 Tage altes R95/Q95.

### ✅ T4.2 — `/today`-Seite
- Kandidaten: Reels mit `ingested_at` in den letzten 24 h; wenn < N Ergebnisse ⇒
  Fenster auf 48 h erweitern (dann Hinweiszeile „inkl. gestern").
- Low-Signal-Regel gilt (QUALITY_THRESHOLD), Top-`env.TOP_N` nach `topScore`.
- Darstellung: gleiche `ReelCard`s im Snap-Feed, oben Kopf „Heute wichtig (N)" +
  Datum; unter der letzten Karte eine Abschluss-Karte: „Das war's für heute ✅" mit
  Link „Zum vollen Feed".
- Leerzustand (auch 48 h leer): „Heute nichts Wichtiges — genieß die Ruhe."
- **Verifikation:** Integrationstest der Kandidaten-/Fallback-Logik mit Seed-Daten;
  manueller Blick auf die Seite.

### ✅ T4.3 — Navigation & Default
- „Heute" als **Startpunkt der Navigation** prominent links/erste Position; die
  App-Route `/` bleibt der volle Feed (kein Redirect).
- **Verifikation:** Nav-Reihenfolge: Heute · Feed · Übersicht.

---

## Abschlusskriterien (Epic-DoD)
- `/today` zeigt deterministisch die Top-N nach Formel; Fallback- und Leerzustände
  funktionieren; Ranking-Tests grün.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_

- **`src/lib/today.ts` (neue Datei, nicht explizit im Epic-File genannt):**
  Die Kandidaten-/Fallback-Logik (24h → 48h, Top-N nach `topScore`) braucht
  einen eigenen Ort außerhalb der reinen Ranking-Funktion (`ranking.ts` bleibt
  bewusst pure) und außerhalb der Seite selbst, damit T4.2 wie gefordert per
  Integrationstest (nicht nur manuell) verifizierbar ist — analog zu
  `getReels()`/`feed.test.ts` aus Epic 3. `src/app/today/page.tsx` ruft nur
  noch `getTodayTopReels()` auf und rendert. Keine neue Datenstruktur, keine
  neue Abhängigkeit — ADR 0004 bleibt gewahrt (abgeleitete Ansicht über
  dieselben `reels`-Daten).
- **`getReels()` erweitert** (`src/lib/feed.ts`) um die Option
  `sinceIngested`, um den `ingested_at`-Kandidatenfilter wiederzuverwenden,
  statt eine parallele Query-Konstruktion zu duplizieren. Bestehende
  Filter/Tests bleiben unverändert.
- **`export const dynamic = "force-dynamic"` auf `/today`:** `next build`
  hätte die Seite sonst (mangels `searchParams`/Cookies/Headers) statisch zur
  Build-Zeit vorgerendert und einen einmaligen DB-Snapshot eingefroren —
  falsch für eine Zeitfenster-Ansicht (24h/48h relativ zu „jetzt"). Ohne
  diesen Fix hätte `/today` nach dem Build nie wieder aktualisiert. Verifiziert:
  vor dem Fix zeigte `next build` `/today` als `○ (Static)`, danach als
  `ƒ (Dynamic)`.
- **Verifikation „manuell in Safari/iPad" ersetzt durch `npm run build` +
  `npm run start -- -p 3200` + `curl`** (wie in Epic 3, dort bereits als
  Abweichung dokumentiert). Zusätzlich wurde der Leerzustand durch temporäres
  `TRUNCATE` + Reseed manuell erzwungen und per curl geprüft, da die Seed-Daten
  aktuell immer Kandidaten liefern.
- Reihenfolge der Top-3 bei knappen Score-Unterschieden (z. B. Seed-Item 2 vs.
  3, Scores 0.1597 vs. 0.1554) ist deterministisch durch die exakte Formel
  gegeben, nicht durch zusätzliche Tie-Break-Regeln — keine Abweichung vom
  Epic-Text, nur zur Nachvollziehbarkeit notiert.
- **Nav-Reihenfolge:** in `src/app/layout.tsx` von Feed·Heute·Übersicht auf
  Heute·Feed·Übersicht getauscht (T4.3); `/` bleibt unverändert die Route für
  den vollen Feed, kein Redirect.
