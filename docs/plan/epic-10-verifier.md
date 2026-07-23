# Epic 10 — Content-Verifier (zweistufig)

**Ziel:** Inhalte kritisch gegenchecken — verlässlich (geerdet), ohne dass der Prüfer
selbst halluziniert. Zwei Stufen: **Reel-Verifier** (Treue + Skepsis → `caveat`) und
**Cluster-Korroboration** (`confidence` aus unabhängigen Quellen).

**Referenzen:** ADR 0011 (zweistufig, Kern), ADR 0003 (Single-Pass — revidiert),
ADR 0004 (getrennte Fakten/Ansichten), ADR 0007 (Erfahrungsberichte), ADR 0008 (Schichten).
Glossar: Verifier, caveat, confidence, Korroboration.

> **MVP = Stufe 1 (Reel-Verifier).** Stufe 2 (Korroboration/`confidence`) braucht das
> **Clustering** (`topic_cluster` / Content-Modell C / Vision V1) und kommt danach.
> Externe Web-Korroboration ist eine noch spätere, separat zu entscheidende Erweiterung
> (rührt an ADR 0001). Vor Bau: Benutzer-Go.

---

## Stufe 1 — Reel-Verifier (MVP)

### ☐ T10.1 — Schema: `caveat` an `reels`
- `reels.caveat text` (nullable). Migration. **Verifikation:** Migration grün; Feld
  default `null`.

### ☐ T10.2 — Kritiker-Pass (`src/lib/verifier/run.ts`)
- Eigener LLM-Call (injizierbarer `StructuredCaller` wie Enrichment/SkillTagger),
  Modell konfigurierbar (Default Haiku). Input: **Quelle (`raw_item`) + fertiges Reel**
  (summary/example/action). Output (JSON-Schema, zod-validiert):
  `{ caveat: string | null }` — `null`, wenn nichts zu bemängeln (Normalfall).
- **Prüf-Regeln im Prompt (bindend):**
  - **Treue (A):** Behauptet Summary/Example/Action mehr, als die Quelle hergibt? Wenn ja,
    knapper Vorbehalt („Summary überzeichnet: Quelle sagt X, nicht Y").
  - **Skepsis (B):** Riskante Aussage-Typen markieren (unbelegte Benchmarks/Zahlen,
    Superlative/„ersetzt/killt X", Einzelfall-Verallgemeinerung).
  - Kein externer Faktencheck, kein Erfinden. Im Zweifel `null`.
- **Gated:** nur Reels verarbeiten, die angezeigt werden (quality_score ≥ QUALITY_THRESHOLD
  bzw. relevanz-relevant) und noch keinen Verifier-Lauf hatten.
- **Verifikation:** Unit-Tests mit gemocktem Caller: Überzeichnung → caveat; treues Reel → null.

### ☐ T10.3 — In die Pipeline einhängen
- Als **eigener Schritt nach dem Enrichment** (Muster wie SkillTagger, ADR 0011/0009),
  idempotent („nur Reels ohne Verifier-Lauf"). In `src/lib/pipeline.ts` einklinken, sodass
  Cron **und** Admin-Button ihn mitlaufen lassen. Verifier-Fehler brechen den Lauf nicht ab.
- **Verifikation:** Integrationstest: neuer Reel → nach Lauf `caveat` gesetzt oder `null`;
  zweiter Lauf verarbeitet 0.

### ☐ T10.4 — Anzeige + Filter
- `ReelCard`: wenn `caveat` gesetzt, ⚠️-Hinweis anzeigen (dezent, nicht alarmistisch),
  **getrennt** von den Scores.
- Feed-/Overview-Filter: optionaler Toggle „mit Vorbehalt ausblenden/zeigen" (Default:
  zeigen — Transparenz). `caveat` fließt **nicht** in `quality_score` (ADR 0004).
- **Verifikation:** curl — Reel mit caveat zeigt ⚠️; Toggle blendet aus/ein; Scores unverändert.

---

## Stufe 2 — Cluster-Korroboration

> **Verschoben:** Stufe 2 ist in **Epic 11 (Topic-Knowledge-Check)** aufgegangen (ADR 0012),
> zusammen mit Freshness/Supersession, weil beide dieselbe Cluster-Maschinerie brauchen.
> Voraussetzung: Epic 15 (Topic-Clustering). Die folgenden Tasks bleiben als Referenz.

### ☐ T10.5 — `confidence` aus dem eigenen Korpus (Skizze)
- Sobald `topic_cluster` existiert: pro Cluster die Zahl **unabhängiger Quellen** zählen,
  die denselben Claim stützen → `confidence` (z. B. 0–100 oder few/some/strong). Auf der
  Wissens-/Cluster-Ebene anzeigen (nicht an einzelnen Reels).
- Design-Details (Was zählt als „unabhängig/stützend"?) im eigenen Grill vor Bau.

### ☐ T10.6 — Erfahrungsberichte (später)
- Stufe-2-Korroboration + **enger Überclaim-Flag** (nur Absolutaussagen), nie Subjektivität
  an sich (ADR 0007). Kommt mit dem Clustering.

### ☐ T10.7 — Externe Web-Korroboration (noch später, eigener Entscheid)
- Aktive Web-Suche nach stützenden Quellen; gefundene Quellen erweitern den Korpus.
  Rührt an ADR 0001 → eigener ADR/Grill vor Bau.

---

## Abschlusskriterien (Stufe-1-MVP)
- Reels bekommen im Pipeline-Lauf einen `caveat` (oder `null`); ⚠️ sichtbar + filterbar,
  getrennt von den Scores; Kritiker-Pass gated + idempotent; Build + Tests grün.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
