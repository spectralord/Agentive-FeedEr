# Epic 8 — Agentisches Vertiefen (Vision)

**Ziel:** Ein „Vertiefen"-Knopf pro Reel: on-demand recherchiert ein Agent das Thema
nach und reichert **dasselbe Reel-Objekt** an (ADR 0003: das JSON-Objekt ist die
Andockstelle). Dogfooding des Produktthemas.

**Referenzen:** ADR 0001/0003/0005, Glossar: Vertiefen (Deep-Dive).

---

## Leitplanken (bindend)
- **Quellen-Whitelist:** Der Agent darf nur abrufen: (a) die Original-URL des Reels,
  (b) Links, die im Original-Artikel stehen, (c) Domains aus der Source-Registry.
  Keine offene Websuche (bewusst — ADR 0001 gilt auch hier).
- **Sourced-only gilt weiter:** Der Deep-Dive zitiert/paraphrasiert Abgerufenes und
  listet jede genutzte URL; keine unbelegten Behauptungen.
- Modell: `env.DEEPEN_MODEL` (Default `claude-sonnet-5`), Budget: max. 5 Abrufe,
  max. 2 Agent-Runden.

## Tasks

### ☐ T8.1 — Fetch-Utility mit Whitelist (`src/lib/deepdive/fetch.ts`)
- `fetchAllowed(url, reel)`: prüft URL gegen Whitelist-Regel oben; lädt HTML,
  extrahiert Haupttext (einfacher Ansatz: Tags strippen, auf 20.000 Zeichen kappen);
  Timeout 15 s. Nicht erlaubte URL ⇒ Fehler mit klarer Meldung.
- **Verifikation:** Unit-Tests der Whitelist (erlaubt/verboten) mit gemockten Fetches.

### ☐ T8.2 — Deep-Dive-Runner (`src/lib/deepdive/run.ts`)
- Agent-Schleife mit dem SDK (Tool `fetch_page(url)` → T8.1):
  System-Prompt: „Deepen this reel for the developer profile. Use fetch_page on the
  original article and its outbound links (max 5). Then produce…" →
  Abschluss-Tool `submit_deep_dive` mit Schema:
  `{ content: string (Markdown, deutsch, 300–600 Wörter), key_takeaways: string[3–5], sources: string[] (alle genutzten URLs) }`.
- Ergebnis nach zod-Validierung in `reels.metadata.deep_dive =
  { ...output, created_at }` schreiben (Re-Run überschreibt).
- **Verifikation:** Integrationstest mit gemocktem SDK (Tool-Use-Runde simuliert).

### ☐ T8.3 — API + UI
- `POST /api/reels/[id]/deepen` → Runner synchron ausführen (Container ohne
  Serverless-Limit, ADR 0006; UI zeigt Spinner „recherchiere…", Timeout-Hinweis ab 60 s).
- ReelCard: Knopf „🔍 Vertiefen"; wenn `metadata.deep_dive` existiert stattdessen
  „Vertiefung ansehen" → aufklappbarer Bereich (Markdown gerendert, Takeaways,
  Quellenliste) + Knopf „Neu vertiefen".
- **Verifikation:** Ende-zu-Ende an einem echten Reel (1 API-Spend), Ergebnis
  manuell auf Belegtreue prüfen und hier notieren.

---

## Abschlusskriterien (Epic-DoD)
- Vertiefen liefert belegte, quellengelistete Aufbereitung ins selbe Reel;
  Whitelist nachweislich wirksam; wiederholbar ohne Doppel-Ingestion.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
