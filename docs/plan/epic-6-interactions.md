# Epic 6 — Saves, Feedback & Resurfacing (Fast-Follow)

**Ziel:** Leichter Feedback-Loop ohne ML: Reaktionen (save/hide/👍👎) speichern,
Saves-Seite, rollierende Feedback-Zusammenfassung als zusätzlicher Enrichment-Kontext,
Spaced Resurfacing gespeicherter Reels.

**Referenzen:** Design-Doc §7, Grill-Entscheidung „kontextbasiert, kein ML".

> **Revidiert 2026-07-22** (siehe `docs/specs/2026-07-22-experience-reports-design.md`):
> Die `tried`-Interaktion bezieht sich künftig auf abgeleitete **Actionables/To-Trys**,
> nicht auf Reels/Reports selbst (die werden nie abgehakt). Save/hide/👍👎 auf Reels
> bleiben unverändert.

---

## Tasks

### ☐ T6.1 — Schema: `interactions` + `app_state`
```ts
export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reels.id),
  type: text("type", { enum: ["save","hide","up","down","tried"] }).notNull(),
  note: text("note"),                                   // optional, v. a. bei "tried"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appState = pgTable("app_state", {          // generischer Key-Value-Store
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- **Verifikation:** Migration grün.

### ☐ T6.2 — API + Buttons
- `POST /api/interactions` `{ reelId, type, note? }` (zod-validiert) → Insert;
  gleicher `type` fürs gleiche Reel togglet (vorhandene Zeile löschen = zurücknehmen).
- `ReelCard` bekommt eine dezente Aktionsleiste (Client-Component): 🔖 Save ·
  👍 · 👎 · 🙈 Hide. Optimistisches UI, kein Full-Reload.
- `hide` wirkt sofort: Feed-Query schließt Reels mit aktiver hide-Interaction aus.
- **Verifikation:** Toggle-Semantik per API-Test; Hide entfernt Karte aus Feed.

### ☐ T6.3 — `/saved`-Seite
- Liste aller Reels mit aktiver `save`-Interaction, neueste Speicherung zuerst,
  Kompaktdarstellung wie Overview-Verlauf; „tried ✓"-Knopf mit optionaler Notiz
  (legt `type:"tried"` + note an — Vorstufe des Adoption-Logs aus Epic 7).
- Navigation um „Gespeichert" erweitern.
- **Verifikation:** Save im Feed ⇒ erscheint hier; tried-Notiz wird gespeichert.

### ☐ T6.4 — Rollierende Feedback-Zusammenfassung
- Im Daily-Job, nach dem Enrichment: falls ≥ 10 neue Interactions seit letzter
  Zusammenfassung, ein kleiner Claude-Call (Haiku): Input = letzte 100 Interactions
  (mit Reel-Titel/Kategorie/Skill), Output = 5–8 Bullet-Points
  („mag: …, überspringt: …"). Ergebnis in `app_state["feedback_summary"]`.
- Enrichment-Prompt (Epic 2) hängt diese Summary — falls vorhanden — als
  Zusatzkontext unter das Profil („Beobachtetes Verhalten: …").
- **Verifikation:** Test mit gemocktem Call; Prompt-Snapshot enthält Summary.

### ☐ T6.5 — Spaced Resurfacing auf `/today`
- Unter den Top-N eine Zusatzkarte „🔁 Dranbleiben": bis zu 2 gespeicherte Reels,
  die 7–21 Tage alt (Speicherzeitpunkt) sind **und** kein `tried` haben —
  Text: „Vor N Tagen gespeichert — schon ausprobiert?" + tried-Knopf.
- **Verifikation:** Seed-Daten mit passenden/unpassenden Zeitfenstern.

---

## Abschlusskriterien (Epic-DoD)
- Reaktionen wirken sofort im UI und fließen (via Summary) in künftige
  Relevanz-Bewertungen; Saves + Resurfacing funktionieren; kein ML, keine neuen Libs.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
