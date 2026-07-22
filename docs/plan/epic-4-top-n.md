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

### ☐ T4.2 — `/today`-Seite
- Kandidaten: Reels mit `ingested_at` in den letzten 24 h; wenn < N Ergebnisse ⇒
  Fenster auf 48 h erweitern (dann Hinweiszeile „inkl. gestern").
- Low-Signal-Regel gilt (QUALITY_THRESHOLD), Top-`env.TOP_N` nach `topScore`.
- Darstellung: gleiche `ReelCard`s im Snap-Feed, oben Kopf „Heute wichtig (N)" +
  Datum; unter der letzten Karte eine Abschluss-Karte: „Das war's für heute ✅" mit
  Link „Zum vollen Feed".
- Leerzustand (auch 48 h leer): „Heute nichts Wichtiges — genieß die Ruhe."
- **Verifikation:** Integrationstest der Kandidaten-/Fallback-Logik mit Seed-Daten;
  manueller Blick auf die Seite.

### ☐ T4.3 — Navigation & Default
- „Heute" als **Startpunkt der Navigation** prominent links/erste Position; die
  App-Route `/` bleibt der volle Feed (kein Redirect).
- **Verifikation:** Nav-Reihenfolge: Heute · Feed · Übersicht.

---

## Abschlusskriterien (Epic-DoD)
- `/today` zeigt deterministisch die Top-N nach Formel; Fallback- und Leerzustände
  funktionieren; Ranking-Tests grün.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
