# Epic 17 — Ausführungs-Modi (Trigger × Executor, Claude-Code-Kontingent)

> **Status: IN UMSETZUNG (2026-07-23, ADR 0015).** T17.1–T17.4 + T17.7 fertig & getestet
> (Executor-Naht, Profile/Validierung, `ClaudeCodeExecutor`, `job:cc`, Fehlerbehandlung);
> T17.5 teil-erledigt (Enrichment + Feedback laufen über den Executor); **T17.6 offen**
> (CC-Routine-Scheduler = reine Infra, nicht in dieser Umgebung end-to-end testbar).
> Aus `future-todos.md` T6 hochgezogen.

**Ziel:** Die LLM-Arbeit der Pipeline wahlweise über die **API** (`ANTHROPIC_API_KEY`, kostet)
oder über **Claude-Code-Kontingent** (Agent-Turn, kostenneutral) laufen lassen, plus einen
lokalen Modus, der **nie** mit Railway/API interagiert. Zwei unabhängige Achsen (Trigger ×
Executor) über Profile.

**Referenzen:** ADR 0015 (Kern), ADR 0003 (Schema-Disziplin/„null statt Halluzination"),
ADR 0002 (entkoppelte Ingestion/Enrichment), ADR 0010 (manueller Trigger). Glossar-Kandidaten:
Executor, Trigger, Profil.

---

## Tasks

### ✅ T17.1 — Executor-Naht formalisieren
- Bestehendes `StructuredCaller`-Interface zum expliziten **`Executor`** machen; sicherstellen,
  dass **alle** LLM-Schritte (Enrichment, SkillTagger, Clustering, Knowledge-Check,
  Feedback-Summary) ihn injiziert bekommen (heute teils schon). Ein Ort, der den Executor je
  Lauf konstruiert.
- **Verifikation:** alle Aufruf-Stellen beziehen den Executor per Injektion; bestehende Tests grün.

### ✅ T17.2 — `env.ts`: Profile + Achsen + Validierung
- `APP_PROFILE=local|cloud` (Default `cloud`) setzt Defaults; Overrides:
  `PIPELINE_EXECUTOR=api|claude-code`, `PIPELINE_TRIGGER=railway-cron|claude-code-cron|manual`.
- **Validierung (zod, in `env.ts`):** illegale Kombi `railway-cron`+`claude-code` ablehnen;
  `local` erzwingt `executor=claude-code` + lokale DB + **kein** `ANTHROPIC_API_KEY`-Zwang;
  `api`-Executor verlangt Key.
- **Verifikation:** Unit-Tests der Profil-Auflösung (jede Zeile der ADR-Matrix), illegale Kombi
  wirft.

### ✅ T17.3 — `ClaudeCodeExecutor` (per-Item via `claude`-CLI; siehe Abweichung)
- Neue `Executor`-Implementierung: verarbeitet einen **Batch** unenriched Items in einem
  Agent-Turn; stellt ein lokales Tool **`emit_reel(reel)`** bereit, das **serverseitig
  zod-validiert und schreibt** (pro Item verwerfbar; `null` statt Halluzination, ADR 0003).
- **Kein API-Aufruf** in diesem Pfad; kein stiller Fallback. Fehler pro Item isoliert; Batch
  läuft weiter.
- **Verifikation:** Test mit simuliertem Agent, der valides/invalides Item emittiert →
  valides geschrieben, invalides verworfen; kein API-Client instanziiert.

### ✅ T17.4 — Lokaler Job-Einstieg (`npm run job:cc`)
- Einstieg, der im `local`-Profil den Pipeline-Lauf gegen die **lokale DB** über den
  `ClaudeCodeExecutor` fährt — ohne Railway, ohne API. Ingestion (kein LLM) unverändert.
- **Verifikation:** Lauf gegen lokale DB ohne gesetzten `ANTHROPIC_API_KEY` erzeugt Reels;
  Netzwerk-Assertion: kein Anthropic-API-Call.

### ◑ T17.5 — Enrichment-first ausrollen, dann restliche Schritte
- Zuerst nur Enrichment über den gewählten Executor; danach SkillTagger/Clustering/
  Knowledge-Check/Feedback über dieselbe Naht (jeweils eigenes `emit_*`-Tool bzw. Reuse).
- **Verifikation:** Enrichment im CC-Modus grün; Schritte einzeln nachgezogen, Tests grün.

### ☐ T17.6 — Scheduler: Claude-Code-Routine (`claude-code-cron`)
- Für den Cloud-Fall „Claude Code Cron"/„Claude Code API": geplante **Claude-Code-Routine**,
  die eine Session mit dem Job-Prompt feuert (gegen Railway-DB, F1-Direktzugriff). Setup
  dokumentieren (Routine/`create_trigger`, benötigte Env in der CC-Umgebung).
- **Verifikation:** manueller Testlauf der Routine erzeugt Reels in der Ziel-DB; Doku vorhanden.

### ✅ T17.7 — Fehlerbehandlung/Benachrichtigung geplanter CC-Läufe
- Was passiert, wenn ein geplanter CC-Lauf fehlschlägt (kein stiller API-Fallback!): Lauf als
  `failed` in `pipeline_runs` (ADR 0010) + optionale Benachrichtigung. Konservativ.
- **Verifikation:** simulierter Fehlschlag → `pipeline_runs.status=failed`, keine API-Nachholung.

---

## Konfiguration (neue Env-Vars, in `env.ts` + `.env.example` + README §4)
| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `APP_PROFILE` | nein | `cloud` | `local` (CC + lokale DB, nie Railway/API) oder `cloud` |
| `PIPELINE_EXECUTOR` | nein | profil-abhängig | `api` \| `claude-code` (Override) |
| `PIPELINE_TRIGGER` | nein | profil-abhängig | `railway-cron` \| `claude-code-cron` \| `manual` |

## Abschlusskriterien (Epic-DoD)
- Executor per Profil/Override wählbar; `local` läuft nachweislich **ohne** API/Railway;
  illegale Kombi wird abgelehnt; `ClaudeCodeExecutor` hält ADR-0003-Garantie via `emit`-Tool;
  Enrichment-first grün, restliche Schritte nachgezogen; `npm run build` + `npm test` grün;
  keine neuen Libs; keine ADR-Verletzung.

## Abweichungen/Fragen
- **T17.3 per-Item-CLI statt Batch+`emit_reel`-Tool (bewusst).** Der `ClaudeCodeExecutor`
  macht **pro Item** einen headless `claude`-CLI-Aufruf (`claude -p --output-format json`),
  der die Subscription-**Kontingent** nutzt; die Antwort wird tolerant zu JSON geparst und vom
  Aufrufer **zod-validiert** (ADR 0003 „null statt Halluzination" gewahrt). Das fügt sich exakt
  in die bestehende per-item `StructuredCaller`-Naht ein (gleiche Validierung/Isolation) und ist
  robust unit-testbar (injizierbarer Runner). Das in ADR 0015 (F3=C) beschriebene
  **Agent-Batch + `emit_reel`-Tool** bleibt eine spätere **Optimierung** (ADR 0015 nannte
  per-Item explizit als Fallback A/B). Kein API-Zugriff, kein stiller Fallback.
- **T17.5 „restliche Schritte" noch nicht anwendbar.** SkillTagger/Clustering/Knowledge-Check
  (Epics 11/12/15) sind noch **nicht gebaut**. Enrichment **und** Feedback-Summary laufen bereits
  über den injizierten Executor; sobald die weiteren Schritte über dieselbe Naht entstehen, greift
  die uniforme Executor-Injektion automatisch. Deshalb T17.5 als teil-erledigt (◑) markiert.
- **T17.6 offen (Infra).** Der Claude-Code-Routine-Scheduler (`claude-code-cron` gegen die
  Railway-DB) ist Setup/Infra und in dieser Umgebung nicht end-to-end verifizierbar; Bau + Doku
  später (teilt Mechanik mit Epic 16 Refactoring-Agent).
- **Voraussetzung Laufzeit:** Der `claude-code`-Executor setzt voraus, dass das `claude`-CLI in
  der Ausführungsumgebung verfügbar + eingeloggt ist (im local-Profil gegeben).
