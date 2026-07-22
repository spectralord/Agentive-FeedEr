# Epic 1 — Ingestion (MVP)

**Ziel:** Täglicher, idempotenter Einzug aller kuratierten Quellen als `raw_items` —
ohne KI, dedupliziert, fehlertolerant pro Quelle.

**Referenzen:** ADR 0001 (kuratierte Quellen), ADR 0002 (Entkopplung), Glossar:
Source, Ingestion, Raw Item.

---

## Tasks

### ☐ T1.1 — Schema: `sources` + `raw_items`
In `src/db/schema.ts`:

```ts
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type", { enum: ["rss", "hn_algolia", "reddit_rss", "github_releases"] }).notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").notNull().default({}),           // z. B. { query, minPoints }
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
});

export const rawItems = pgTable("raw_items", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  externalId: text("external_id").notNull(),               // GUID/Link/API-ID
  title: text("title").notNull(),
  url: text("url").notNull(),
  rawContent: text("raw_content").notNull().default(""),   // Text/HTML-Auszug
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),  // null = noch nicht angereichert
  enrichError: text("enrich_error"),                       // gesetzt bei dauerhaftem Fehler
}, (t) => [uniqueIndex("raw_items_source_external_uq").on(t.sourceId, t.externalId)]);
```
- Migration generieren + ausführen.
- **Verifikation:** Migration läuft; Unique-Index existiert.

### ☐ T1.2 — Source-Registry (`src/lib/sources.ts`)
- Deklaratives Array `SOURCE_REGISTRY: Array<{ name; type; url; config? }>` — **Code ist
  die Quelle der Wahrheit**; ein Seed-Schritt upsertet die Registry beim Jobstart in die
  `sources`-Tabelle (match auf `name`; DB hält nur Zustand wie `lastPolledAt`/`enabled`).
- Start-Registry (⚠ = URL beim Umsetzen manuell verifizieren, ggf. korrigieren und hier
  im File dokumentieren; nicht erreichbare Quellen mit `enabled:false` seeden):

| name | type | url | config |
|---|---|---|---|
| simon-willison | rss | `https://simonwillison.net/atom/everything/` | — |
| hn-claude | hn_algolia | `https://hn.algolia.com/api/v1/search_by_date` | `{ "query": "Claude", "minPoints": 20 }` |
| hn-ai-agents | hn_algolia | dito | `{ "query": "AI agent", "minPoints": 30 }` |
| reddit-claudeai | reddit_rss | `https://www.reddit.com/r/ClaudeAI/top/.rss?t=day` | — |
| reddit-localllama | reddit_rss | `https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day` | — |
| huggingface-blog ⚠ | rss | `https://huggingface.co/blog/feed.xml` | — |
| openai-news ⚠ | rss | `https://openai.com/news/rss.xml` | — |
| anthropic-news ⚠ | rss | _prüfen: offizieller Feed; falls keiner existiert → `enabled:false` + Notiz_ | — |
| claude-code-releases | github_releases | `https://github.com/anthropics/claude-code/releases.atom` | — |
| anthropic-sdk-releases | github_releases | `https://github.com/anthropics/anthropic-sdk-typescript/releases.atom` | — |
| latent-space ⚠ | rss | `https://www.latent.space/feed` | — |

- **Verifikation:** Seed-Funktion zweimal ausführen ⇒ keine Duplikate in `sources`.

### ☐ T1.3 — Fetcher (ein Modul pro `type`, gemeinsames Interface)
`src/lib/ingestion/fetchers/*.ts`, alle mit Signatur
`fetchItems(source): Promise<NormalizedItem[]>` und
`NormalizedItem = { externalId; title; url; content; publishedAt }`:
- **rss / github_releases / reddit_rss:** via `rss-parser` (`guid ?? link` als
  `externalId`; `contentSnippet`/`content` als `content`, auf 8.000 Zeichen kappen).
  Bei Reddit einen eigenen `User-Agent`-Header setzen (`agentive-feeder/1.0`).
- **hn_algolia:** `GET {url}?tags=story&query={config.query}&numericFilters=points>{config.minPoints}`;
  `externalId = objectID`, `url = story-URL ?? HN-Item-Link`, `content = title` (+ ggf. `story_text`).
- Alle Fetcher: Timeout 15 s, Fehler werfen (Handling macht der Runner).
- **Verifikation:** Unit-Tests mit fixture-Daten (gespeicherte Beispiel-XML/JSON-Antworten,
  keine Netz-Calls im Test).

### ☐ T1.4 — Ingestion-Runner (`src/lib/ingestion/run.ts`)
Ablauf `runIngestion()`:
1. Registry-Seed (T1.2).
2. Für jede `enabled`-Source: Fetcher aufrufen → Items einfügen mit
   `onConflictDoNothing` auf `(source_id, external_id)` → `lastPolledAt` setzen.
3. try/catch **pro Quelle**; Ergebnis sammeln.
4. Rückgabe + Log: `{ perSource: [{ name, fetched, inserted, error? }], totalInserted }`.
- Items älter als 30 Tage (publishedAt) werden übersprungen (Erstlauf-Flutschutz).
- **Verifikation:** Integrationstest gegen lokale DB mit gemockten Fetchern:
  zweimaliger Lauf ⇒ zweiter Lauf `inserted = 0` (Idempotenz).

### ☐ T1.5 — Job-Einstieg (`src/jobs/daily.ts`)
- Ruft `runIngestion()` auf, loggt Zusammenfassung, `process.exit(0)`
  (Exit-Code 1 nur, wenn **alle** Quellen fehlschlagen).
- Platzhalter-Aufruf `runEnrichment()` (kommt in Epic 2) als auskommentierter TODO.
- **Verifikation:** `npm run job:daily` lokal gegen echte Feeds: mind. 3 Quellen liefern
  Items; erneuter Lauf fügt 0 Duplikate ein.

### ☐ T1.6 — Quellen-Verifikation (teilweise Benutzer-Aktion)
- Jede ⚠-URL real prüfen (Abruf + Parse). Ergebnis in der Tabelle in T1.2 festhalten
  (URL korrigiert / `enabled:false` + Grund).
- **Benutzer-Aktion:** Finale Quellenliste kurz bestätigen lassen.

---

## Abschlusskriterien (Epic-DoD)
- Ein `npm run job:daily` füllt `raw_items` idempotent aus ≥ 6 funktionierenden Quellen.
- Ausfall einer Quelle bricht den Lauf nicht ab und wird geloggt.
- Build + Tests grün.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
