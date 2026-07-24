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

### ☑ T11.1 — Schema: Cluster-`confidence` + Freshness/Supersession
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

### ☑ T11.2 — Korroboration → `confidence` (`src/lib/knowledge-check/confidence.ts`)
- Pro aktivem Cluster: **unabhängige Belege zählen** = distinct `source` unter den Mitgliedern
  mit `is_primary=true` (jeder eigenständige Erfahrungsbericht zählt ebenfalls). Reine
  Reblogs (`is_primary=false`) zählen **nicht**.
- Mapping Zahl → Skala (Schwellen aus Env, s. u.): `1 = few`, `2–3 = some`, `≥4 = strong`.
  `independentCount` + `confidence` am Cluster speichern. **Rein geerdet, kein LLM.**
- **Verifikation:** Unit-Tests mit geseedeten Cluster-Mitgliedern (Primär/Echo/Erfahrungsbericht)
  → erwartete `confidence`.

### ☑ T11.3 — Freshness/Supersession-Vergleich (`src/lib/knowledge-check/freshness.ts`)
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

### ☑ T11.4 — Propagation auf referenzierende Items
- `confidence`/`freshness` sind Cluster-Eigenschaften; abgeleitete Sichten (ADR 0004) ziehen sie
  auf: gespeicherte Reels, SOTA-/Übersichts-Einträge, später Skill-Nodes. Ein Reel „erbt" die
  `confidence` seines Clusters und den Supersession-Hinweis.
- **Verifikation:** Query-Test: Reel eines Clusters mit `deprecated`/`confidence` liefert die
  Cluster-Werte in der Feed-/Saved-/Overview-Sicht.

### ☑ T11.5 — Anzeige (confidence + „Neueres verfügbar")
- Stapelkarte/Cluster-Sicht zeigt `confidence` als dezentes Badge (`few/some/strong`, getrennt
  von `quality_score`/`relevance_score`, ADR 0004). Auf abgelösten Inhalten ein Hinweis
  „🕓 Neueres verfügbar" mit Link zum ablösenden Cluster; **Bestätigen-Aktion**, die
  `lifecycle_state=deprecated` real setzt (kein Auto-Verstecken).
- **Verifikation:** curl — Cluster zeigt confidence-Badge; abgelöstes Item zeigt Hinweis +
  Bestätigen; Scores unverändert.

### ☑ T11.6 — In Pipeline/Cron einhängen (Kadenz)
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

**Status: T11.1–T11.6 gebaut & getestet (`npm run build` + `npm test` grün, 260 Tests).
T11.7 und T11.8 bewusst nicht gebaut (siehe unten) — Checkboxen bleiben offen.**

- **T11.7 (Erfahrungsberichte-Korroboration) — bewusst zurückgestellt.** Vor dem Bau
  geprüft: `experience_reports` hat keine `topic_cluster_id`-Spalte oder sonstige
  Cluster-Verknüpfung, und Epic 15s Clustering-Pass clustert ausschließlich `reels`, nie
  `experience_reports`. T11.7s eigener Text hedged das bereits mit „(später via
  SkillTagger/Cluster-Bezug)" — die Verknüpfung selbst ist unentworfen. Sie zu bauen hätte
  bedeutet, dieses Verknüpfungsdesign zu erfinden (README §1 Regel 3: kein erfundener
  Scope; Regel 4: bei Unklarheit nicht raten). Also: `computeConfidenceForActiveClusters`
  in `src/lib/knowledge-check/confidence.ts` zählt ausschließlich `reels`-Mitglieder;
  `experience_reports` bleibt unangetastet (keine neue Spalte, keine Korroborationslogik).
  Bevor T11.7 gebaut wird, braucht es einen eigenen Grill: wie/wann bekommt ein
  Erfahrungsbericht einen `topic_cluster_id`-Bezug (SkillTagger-Zeitpunkt? eigener
  Match-or-Propose-Pass? nur lose über `skill`?).
- **T11.8 (externe Web-Korroboration)** — wie im Epic-File selbst als „Platzhalter"
  markiert: braucht eigenen ADR/Grill (rührt an ADR 0001, kuratierte Quellen). Nicht gebaut.

**Judgment calls bei T11.1–T11.6 (konservativste Interpretation gewählt):**

- **T11.2 Schwellenwert-Mapping:** Der Epic-Text sagt wörtlich „1 = few,
  CONF_SOME_MIN..CONF_STRONG_MIN-1 = some, >= CONF_STRONG_MIN = strong". Das hardcodet
  „1" für „few", was bei einer Env-Konfiguration mit `CONF_SOME_MIN=1` inkonsistent würde
  (und deckt den theoretischen `independentCount=0`-Fall gar nicht ab — kann aktuell nicht
  vorkommen, weil das erste Mitglied eines neuen Clusters per ADR 0013 Punkt 4 immer
  `is_primary=true` ist, aber die Funktion soll dafür trotzdem nicht falsch/undefiniert
  sein). Generalisiert in `confidenceForCount` (`src/lib/knowledge-check/confidence.ts`)
  zu: `< CONF_SOME_MIN ⇒ few`, `CONF_SOME_MIN..CONF_STRONG_MIN-1 ⇒ some`,
  `>= CONF_STRONG_MIN ⇒ strong`. Mit den Defaults (2/4) identisch zum Epic-Text; nur bei
  abweichender Env-Konfiguration verhält es sich konsistenter.
- **T11.3 Kandidaten-Paarung — Vergleichseinheit ist die Skill-Gruppe, nicht das Paar:**
  Der Epic-Text sagt „Cluster, die sich eine Skill-Node teilen, sind Vergleichspartner"
  und das Output-Schema ist singulär (`{ supersededClusterId, supersededByClusterId,
  reason }`, kein Array). Interpretiert als: ein LLM-Call pro Skill-Gruppe (alle Cluster,
  die über ihre Mitglieder-Reels denselben `reels.skill`-Wert teilen), nicht ein Call pro
  Cluster-*Paar* — sonst würde bei 3 Clustern zur selben Skill-Node dieselbe Information
  3× (bzw. bei n Clustern n·(n-1)/2×) redundant vorgelegt. Das Modell sieht alle Cluster
  der Gruppe gleichzeitig und liefert höchstens eine Supersession-Aussage pro Call.
  Model-erfundene Ids außerhalb der vorgelegten Kandidatengruppe werden defensiv verworfen
  (gleiches Prinzip wie Clusterings `match_cluster_id`-Guard, ADR 0003).
- **T11.3 Link-Ziel für „Neueres verfügbar" (T11.5):** Der Epic-Text verlangt „Link zum
  ablösenden Cluster", ohne eine bestehende Cluster-Detailseite vorauszusetzen. Da der
  Deprecate-Route-Pfad selbst schon `src/app/clusters/[id]/deprecate/route.ts` vorgibt,
  wurde eine minimale `src/app/clusters/[id]/page.tsx` (Mitgliederliste + Confidence-Badge
  + ggf. eigene Supersession-Anzeige) ergänzt statt nur auf die externe Quelle zu verlinken
  — das ist die naheliegendste, in sich geschlossene Interpretation von „Link zu den Items
  des ablösenden Clusters" ohne zusätzlichen Scope zu erfinden (keine neue Navigation/kein
  neuer Menüpunkt, nur die für den Link nötige Zielseite).
- **T11.6 Gating-Granularität:** „Cluster mit neuen Mitgliedern seit `knowledge_checked_at`"
  wird pro Cluster über `EXISTS (reels.created_at > topic_clusters.knowledge_checked_at)`
  geprüft (`loadDirtyClusterIds` in `src/lib/knowledge-check/run.ts`). Ein "dirty" Cluster
  zieht bei der Freshness-Vergleichsgruppe auch seine (ggf. nicht-dirty) Geschwister-Cluster
  derselben Skill-Node mit hinein (volle Vergleichsgruppe nötig, damit das Modell den
  vollen Kontext hat) — aber ein Lauf ohne jegliche dirty Cluster macht global keinen
  einzigen LLM-Call (verifiziert im Integrationstest). `confidence` wird davon unabhängig
  bei jedem Lauf für alle aktiven Cluster neu berechnet (billig, kein Gating nötig, wie im
  Epic-Text explizit verlangt).
- **`KNOWLEDGE_CHECK_MODEL`-Fallback:** Es gibt in `env.ts` kein bestehendes Muster für
  „optional, fällt automatisch auf einen anderen Env-Wert zurück" auf Schema-Ebene (
  `DEEPEN_MODEL` hat einen eigenen hartkodierten Default, keinen Bezug zu
  `ANTHROPIC_MODEL`). Deshalb: `KNOWLEDGE_CHECK_MODEL` ist optional/undefined im Schema
  (gleiches „leerer String = unset"-Preprocess wie `ANTHROPIC_API_KEY`/`ADMIN_TOKEN`), der
  Fallback auf `ANTHROPIC_MODEL` passiert am Call-Ort in
  `src/lib/knowledge-check/freshness.ts` (`knowledgeCheckModel()`), analog zu
  `callStructured`s eigenem `opts.model ?? env().ANTHROPIC_MODEL`-Muster in
  `src/lib/claude.ts`.
