# Future-TODOs / Ideen (roh, zum späteren Aufgreifen)

Vom Benutzer geparkte Gedanken (2026-07-23). Noch nicht gegrillt — vor Umsetzung je ein
kurzes Design-/Grill-Gespräch.

## T1 — Zwei Detailtiefen pro Inhalt (Kompakt → Aufgeklappt)
Der Feed bleibt wie jetzt der *zusammengefasste* Modus. Aber ein Reel soll **anklickbar**
sein und dann eine **besser aufgearbeitete, tiefere Zusammenfassung** zeigen (Detail-Ansicht).
- Verwandt mit, aber nicht identisch zu Epic 8 (agentisches „Vertiefen"): hier geht es
  zunächst um eine *vorhandene* tiefere Aufbereitung on click, nicht um Live-Recherche.
- Denkbar: das Enrichment erzeugt zwei Ebenen (kompakt + ausführlich), oder die Detailtiefe
  wird on-demand nachgeladen.

## T2 — Actionables / „To-Try"-Aufforderungen überarbeiten
Die aktuellen Handlungs-/TODO-Aufforderungen (`action`/`effort_tag`) sind noch **zu schwach**.
Bei Gelegenheit überarbeiten — konkreter, motivierender, klarer Anreiz zum Ausprobieren.
Hängt mit dem Actionable-Konzept (Epic 6/7-Revision) zusammen.

## T3 — Auf Englisch umstellen (Chat + gesamte App)
Perspektivisch **Chat und sämtliche App-Inhalte/UI auf Englisch** umstellen. Betrifft dann
auch `CLAUDE.md` (Sprach-Konvention „UI/Doku Deutsch" → Englisch) und alle bestehenden
UI-Strings. Bewusste, einmalige Umstellung — erst auf explizites Go.

## T4 — Design-/UX-Experten-Agent (eigene Session) + Übergabe-Prompt
Design/UX ist aktuell dürftig. Ziel: Claude baut einen **umfassenden Prompt**, den der
Benutzer einer **weiteren Session** gibt; diese agiert als **Design-Experte**, schaut sich
das Projekt an und erarbeitet mit **Gamifying- + Good-UX-Mindset** konkrete, umsetzbare
Design-Vorschläge. (Deliverable: der Übergabe-Prompt.)
> **Update 2026-07-23:** Übergabe-Prompt **geliefert** →
> `docs/specs/design-expert-handoff-prompt.md` (Leitmotiv: Look-and-Feel + Gamification
> gleichrangig). Offen ist nur noch, dass der Benutzer die Design-Session damit startet.

## T5 — Persona-Agent „Entwickler-Sicht auf den Mehrwert" (Zukunftsmusik)
Später eine Session, die die **generierten Inhalte aus Entwickler-Perspektive** bewertet:
Wie viel echten Mehrwert/Erfahrung gewinnt ein Entwickler daraus? Gut über einen
**Persona-Agenten** abbildbar. Bewusst Zukunftsmusik.

## T6 — Zweiter Ausführungsmodus: Pipeline über Claude-Code-Kontingent statt API-Key
> **Hochgezogen 2026-07-23:** gegrillt (F1–F5 unten) → **ADR 0015** + **Epic 17**
> (`epic-17-execution-modes.md`). Bauen erst auf Benutzer-Go.
**Motiv:** Der Daily-Task ruft die LLM-Arbeit (Enrichment/Summaries etc.) heute über die
**Anthropic-API** (`ANTHROPIC_API_KEY`) → verbraucht **API-Tokens (Geld)**. Wenn noch
**Claude-Code-Kontingent** (Subscription) übrig ist, soll dieselbe Arbeit stattdessen darüber
laufen — und man soll **umschalten** können, *wie* der Lauf ausgeführt wird.

**Kern-Idee:** Zwei Ausführungs-Modi hinter einem Schalter (z. B. `PIPELINE_EXECUTOR=api|claude-code`):
- **`api` (heute):** Railway-Cron ruft die App, die per SDK die API mit dem Key aufruft.
- **`claude-code` (neu):** Eine **Claude-Code-Scheduled-Task/Routine** feuert eine Session, die
  den Pipeline-Lauf anstößt.

**Wichtiger technischer Haken (für den Grill):** Damit wirklich **Kontingent statt API-Tokens**
verbraucht wird, muss die **Inferenz im Claude-Code-Agent-Turn** passieren (der Agent liest die
Raw-Items und erzeugt die strukturierten Summaries selbst, schreibt sie in die DB) — eine bloße
Routine, die die App triggert, die *dann* die API ruft, spart **nichts**. Das ist ein anderer
Ausführungspfad als das deterministische, tool-use-strukturierte Enrichment (ADR 0003).
- **Naht/Seam:** Das bestehende **`StructuredCaller`-Interface** (Enrichment/SkillTagger/…) ist
  der Ansatzpunkt — eine zweite Implementierung „Agent-getrieben" dahinter.
- **Trade-offs zu grillen:** Konsistenz/Qualität (Agent-Freitext vs. erzwungenes JSON-Schema +
  zod-Validierung), Idempotenz/Fehlertoleranz pro Item, Kadenz/Scheduling (Railway-Cron vs.
  Claude-Code-Routine), wie „null statt Halluzination" (ADR 0003) im Agent-Modus garantiert wird,
  und ob nur *Teile* (z. B. Enrichment) oder die ganze Pipeline umgeschaltet werden.
- **Ergebnis vermutlich:** eigener ADR (Ausführungs-Modell) + Env-Schalter + zweite
  `StructuredCaller`-Implementierung. **Vor Bau grillen** (echte architektonische Weggabelung).

### Grill-Protokoll (läuft, 2026-07-23)
- **F1 — Datenpfad im `claude-code`-Modus → ENTSCHIEDEN: A (direkter DB-Zugriff).** Die
  CC-Session nutzt dieselbe Drizzle-Schicht wie die App (liest `raw_items`, schreibt `reels`),
  gleiche Idempotenz/Validierung — kein Endpunkt-Zoo. Für ein Single-User-Tool der einfachste,
  robusteste Weg.

- **F2 — Profil-Struktur → ENTSCHIEDEN: C (Profil mit Defaults + Override).** Ein
  `APP_PROFILE=local|cloud` setzt sinnvolle Defaults (local→Claude Code + lokale DB;
  cloud→API + Railway), einzelne Achsen (v. a. Executor) sind per Env überschreibbar
  (⇒ auch Cloud+Claude-Code möglich). Nicht die volle 4er-Kombinatorik als Normalfall.
- **F3 — Schema-Disziplin/Granularität → ENTSCHIEDEN: C (Agent-Batch + erzwungenes Tool-Use).**
  Der Agent verarbeitet einen Batch in einem Turn, ruft aber **pro Item ein lokales Tool
  `emit_reel(reel)`** auf, das **serverseitig zod-validiert + schreibt** — Schema-Zwang im Tool,
  Per-Item-Validierung/-Isolation (ADR 0003 gewahrt) bei Batch-Effizienz. Bildet die heutige
  „forced tool_choice"-Disziplin nach. Fallback bei Setup-Problemen: (A) Agent-Batch → Skript
  validiert das Array.
- **F4 — Scope → ENTSCHIEDEN: B (uniformer Executor, inkrementell gebaut).** Ein einmal
  gewählter Executor wird an **allen** `StructuredCaller`-Stellen injiziert (Enrichment,
  SkillTagger, Clustering, Knowledge-Check, Feedback-Summary) → einheitlicher Lauf, kein
  Mischmasch. Baureihenfolge enrichment-first als erste Scheibe. **Harte Leitplanke:** Im
  Claude-Code-/local-Modus laufen **null** API-Calls und es gibt **keinen stillen API-Fallback**
  (sonst entstünden Kosten). Fehlt/misslingt der CC-Weg, wird **abgebrochen/geskippt**, nie über
  die API nachgeholt. `ANTHROPIC_API_KEY` darf im local-Modus ungesetzt sein.
- **F5 — Trigger/Scheduling → ENTSCHIEDEN: zwei unabhängige Achsen + Profil-Matrix.**
  - **Achse 1 Trigger:** `railway-cron` | `claude-code-cron` | `manuell/lokal`.
  - **Achse 2 Executor:** `api` | `claude-code` (siehe F4).
  - **local:** Trigger manuell/lokal, Executor `claude-code`, DB lokal — **nie Railway, nie API**
    (hart abgeschottet).
  - **cloud** (DB=Railway), drei nutzbare Kombis:
    - „Cloud" = `railway-cron` + `api` (Status quo).
    - „Claude Code Cron" = `claude-code-cron` + `claude-code` (Kontingent, kein API).
    - „Claude Code API" = `claude-code-cron` + `api` (CC plant, API inferiert).
  - **Ausgeschlossen:** `railway-cron` + `claude-code` (Railway kann kein CC-Kontingent nutzen).

### Erweiterung (Benutzer 2026-07-23): zwei **Umgebungs-Profile** lokal ↔ cloud
Der Schalter ist eigentlich **zweidimensional** — Umgebung *und* Inferenz:
- **Umgebung:** **`local`** (eigener Rechner, **lokale DB**, Ausführung in Claude Code) vs.
  **`cloud`** (Railway + Cloud-DB).
- **Inferenz:** **`api`** (Anthropic-Key) vs. **`claude-code`** (Kontingent).
- **Kopplung/Motiv:** **`local` ⇒ Claude Code + lokale DB** — spart *sowohl* Railway- *als auch*
  API-Kosten (Entwicklung/Nutzung am eigenen Rechner). **`cloud`** ist v. a. für **Tablet-Nutzung**
  interessant (kein eigener Rechner zur Hand); auch dort ist eine `api`-vs-`claude-code`-Unterscheidung
  gewünscht. Ziel: unsere Tools/Services **einmal „lokal" und einmal „cloud" startbar** machen.
- **Folgen für den Bau:** nicht nur ein `PIPELINE_EXECUTOR`-Flag, sondern **Umgebungs-Profile**
  (DB-Ziel + Executor + Scheduling gebündelt), z. B. `APP_PROFILE=local|cloud` mit sinnvollen
  Defaults (`local`→`claude-code`+lokale DB; `cloud`→heute `api`+Railway, optional `claude-code`).
  Lokaler Start-Pfad ohne Railway (eigenes `npm`-Kommando / Claude-Code-Routine gegen lokale DB).
