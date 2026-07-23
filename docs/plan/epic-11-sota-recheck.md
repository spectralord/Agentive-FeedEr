# Epic 11 — Topic-Knowledge-Check (Freshness + Korroboration)

> **Status: DESIGN GEGRILLT (2026-07-23), Umsetzung offen.** Vereint die frühere
> „SOTA-Frische-Re-Check"-Idee **und** Verifier-Stufe 2 (Korroboration) zu **einem**
> Feature auf Basis Clustering (ADR 0012). **Voraussetzung: Epic 15 (Topic-Clustering).**

**Ziel:** Pro Topic-Cluster zwei Ausgaben aus *einem* Quervergleich über Quellen/Zeit:
- **`confidence`** — wie gut ist der Claim durch **unabhängige** Quellen gestützt (Korroboration).
- **`freshness`/Supersession** — ist Neueres da, das Älteres ablöst (z. B. `batch → fork`)?
  → Älteres via `superseded_by`/`lifecycle_state=deprecated` markieren.

**Referenzen:** ADR 0012 (Kern), ADR 0013 (Clustering-Fundament, `is_primary`), ADR 0008
(Schichten, `superseded_by`), ADR 0004 (abgeleitete Ansichten), ADR 0007 (Erfahrungsberichte),
ADR 0001 (kuratierte Quellen — externe Web-Korroboration bleibt separater Entscheid).
Glossar: Topic-Knowledge-Check, confidence, freshness, Korroboration, Topic-Cluster.

## Gegrillte Entscheidungen
- **Recheneinheit = Topic-Cluster** (Epic 15); `confidence`/`freshness` sind Cluster-Eigen­schaften
  und **propagieren** auf referenzierende Items (Skill-Nodes, gespeicherte Reels, SOTA) — „dein
  Wissen zu X ist veraltet, siehe Neueres" / Stütz-Grad. Supersession lebt an den Items/Clustern.
- **Kein „LLM entscheidet Wahrheit":** Korroboration = **unabhängige Quellen zählen** (aus
  `is_primary`, ADR 0013); Freshness = **geerdeter Vergleich** der Cluster-Items untereinander.
- **`confidence` = grobe Skala `few/some/strong`** (nicht exakte Zahl) — robust gegen
  Fehlklassifikation beim Echo-Erkennen.
- **Konservativ:** Supersession wird **vorgeschlagen** (`deprecated`), nicht automatisch
  verschoben — Mensch-im-Loop, damit nichts fälschlich verschwindet (ADR 0008: kein Auto-Delete).
- **Erfahrungsberichte:** bekommen Korroboration (Stütz-Grad); nur **enger Überclaim-Flag**
  (Absolutaussagen), nie Subjektivität an sich (ADR 0007).

---

## Tasks

### ☐ T11.1 — Schema: Cluster-`confidence` + Freshness/Supersession
- An `topic_clusters` ergänzen:
  ```ts
  confidence: text("confidence", { enum: ["few", "some", "strong"] }),  // nullable bis berechnet
  independentCount: integer("independent_count"),                        // Beleg-Zahl hinter confidence
  lifecycleState: text("lifecycle_state", { enum: ["active", "deprecated"] })
    .notNull().default("active"),                                        // ADR 0008
  supersededByClusterId: integer("superseded_by_cluster_id"),           // self-FK, Vorschlag
  supersedeReason: text("supersede_reason"),                            // knappe Begründung (geerdet)
  knowledgeCheckedAt: timestamp("knowledge_checked_at", { withTimezone: true }),
  ```
- **Verifikation:** Migration grün; Felder default `null` bzw. `active`.

### ☐ T11.2 — Korroboration → `confidence` (`src/lib/knowledge-check/confidence.ts`)
- Pro aktivem Cluster: **unabhängige Belege zählen** = distinct `source` unter den Mitgliedern
  mit `is_primary=true` (jeder eigenständige Erfahrungsbericht zählt ebenfalls). Reine
  Reblogs (`is_primary=false`) zählen **nicht**.
- Mapping Zahl → Skala (Schwellen aus Env, s. u.): `1 = few`, `2–3 = some`, `≥4 = strong`.
  `independentCount` + `confidence` am Cluster speichern. **Rein geerdet, kein LLM.**
- **Verifikation:** Unit-Tests mit geseedeten Cluster-Mitgliedern (Primär/Echo/Erfahrungsbericht)
  → erwartete `confidence`.

### ☐ T11.3 — Freshness/Supersession-Vergleich (`src/lib/knowledge-check/freshness.ts`)
- **Kandidaten-Auswahl:** Cluster, die sich eine **Skill-Node teilen** (breite Ebene, Epic 12),
  sind Vergleichspartner — genau dort passiert Ablösung (enge Cluster innerhalb *eines* Themas).
- **LLM-Pass** (injizierbarer `StructuredCaller`, Default `ANTHROPIC_MODEL`): Input =
  die zu vergleichenden Cluster-Items **+ explizite Deprecation-Signale aus dem Quelltext**
  (Changelog-/„deprecated"-Hinweise). Output (zod):
  ```ts
  { supersededClusterId: number | null, supersededByClusterId: number | null, reason: string | null }
  ```
  Nur **geerdeter** Vergleich der vorliegenden Items, **kein** externer Faktencheck, kein Erfinden
  (ADR 0003). Im Zweifel `null`.
- **Konservativ anwenden:** Ergebnis setzt am älteren Cluster `supersededByClusterId` +
  `supersedeReason` und **schlägt** `lifecycle_state=deprecated` vor — nicht automatisch aktiv
  ausblenden; Bestätigung/Anzeige regelt T11.5 (Mensch-im-Loop).
- **Verifikation:** Unit-Tests mit gemocktem Caller: klare Ablösung → Vorschlag gesetzt;
  unabhängige Themen → `null`.

### ☐ T11.4 — Propagation auf referenzierende Items
- `confidence`/`freshness` sind Cluster-Eigenschaften; abgeleitete Sichten (ADR 0004) ziehen sie
  auf: gespeicherte Reels, SOTA-/Übersichts-Einträge, später Skill-Nodes. Ein Reel „erbt" die
  `confidence` seines Clusters und den Supersession-Hinweis.
- **Verifikation:** Query-Test: Reel eines Clusters mit `deprecated`/`confidence` liefert die
  Cluster-Werte in der Feed-/Saved-/Overview-Sicht.

### ☐ T11.5 — Anzeige (confidence + „Neueres verfügbar")
- Stapelkarte/Cluster-Sicht zeigt `confidence` als dezentes Badge (`few/some/strong`, getrennt
  von `quality_score`/`relevance_score`, ADR 0004). Auf abgelösten Inhalten ein Hinweis
  „🕓 Neueres verfügbar" mit Link zum ablösenden Cluster; **Bestätigen-Aktion**, die
  `lifecycle_state=deprecated` real setzt (kein Auto-Verstecken).
- **Verifikation:** curl — Cluster zeigt confidence-Badge; abgelöstes Item zeigt Hinweis +
  Bestätigen; Scores unverändert.

### ☐ T11.6 — In Pipeline/Cron einhängen (Kadenz)
- Eigener Schritt **nach dem Clustering** in `src/lib/pipeline.ts` (Cron + Admin-Button).
  `confidence` bei jedem Lauf neu berechnen (billig, geerdet); Freshness-Vergleich gated
  (nur Cluster mit neuen Mitgliedern seit letztem `knowledge_checked_at`). Fehler brechen den
  Lauf nicht ab.
- **Verifikation:** Integrationstest: nach Lauf `confidence` gesetzt; zweiter Lauf ohne neue
  Mitglieder macht keinen erneuten LLM-Freshness-Call.

### ☐ T11.7 — Erfahrungsberichte: Korroboration + enger Überclaim-Flag
- Erfahrungsberichte, die (später via SkillTagger/Cluster-Bezug) einem Thema zuhängen, fließen
  als **eigenständige** Belege in `confidence` ein. Zusätzlich ein **enger** Überclaim-Flag nur
  bei **Absolutaussagen** („ersetzt X komplett"), nie gegen Subjektivität an sich (ADR 0007).
- **Verifikation:** Test: Erfahrungsbericht erhöht `independentCount`; Absolutaussage → Flag;
  normale subjektive Aussage → kein Flag.

### ☐ T11.8 — Externe Web-Korroboration (noch später, eigener Entscheid)
- Aktive Web-Suche nach stützenden Quellen; gefundene Quellen erweitern den Korpus. Rührt an
  ADR 0001 → **eigener ADR/Grill vor Bau**. Hier nur als Platzhalter dokumentiert.

---

## Konfiguration (neue Env-Vars, in `env.ts` + `.env.example` + README §4)
| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `CONF_SOME_MIN` | nein | `2` | ab so vielen unabhängigen Belegen ⇒ `some` |
| `CONF_STRONG_MIN` | nein | `4` | ab so vielen ⇒ `strong` |
| `KNOWLEDGE_CHECK_MODEL` | nein | `ANTHROPIC_MODEL` | Modell für den Freshness-LLM-Pass |

## Abschlusskriterien (Epic-DoD)
- Cluster bekommen `confidence` (few/some/strong, geerdet gezählt) und ggf. einen
  Supersession-**Vorschlag**; beides propagiert in die Sichten und ist dezent, getrennt von den
  Scores, sichtbar; Deprecation nur nach Bestätigung (kein Auto-Delete/-Hide); Knowledge-Check
  als idempotenter Pipeline-Schritt (Cron + Admin); `npm run build` + `npm test` grün; keine
  neuen Libs; keine ADR-Verletzung.

## Abweichungen/Fragen
_(vom ausführenden Modell zu pflegen)_
