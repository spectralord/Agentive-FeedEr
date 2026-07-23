# ADR 0015 — Ausführungs-Modell: zwei Achsen (Trigger × Executor) + Profile

- Status: akzeptiert (Design gegrillt 2026-07-23; **Umsetzung offen**, Bau erst auf Benutzer-Go)
- Baut auf: ADR 0003 (strukturierter Single-Pass, „null statt Halluzination"), ADR 0002
  (entkoppelte Ingestion/Enrichment), ADR 0006 (All-in-one-Container-Hosting), ADR 0010
  (Admin/manueller Trigger). Umsetzung: Epic 17.

## Kontext / Problem

Die LLM-Arbeit der Pipeline (Enrichment, SkillTagger, Clustering, Knowledge-Check,
Feedback-Summary) läuft heute über die **Anthropic-API** mit `ANTHROPIC_API_KEY` → verbraucht
**bezahlte API-Tokens**. Ist **Claude-Code-Kontingent** (Subscription) übrig, soll dieselbe
Arbeit wahlweise **darüber** laufen (kostenneutral). Zusätzlich soll ein **lokaler** Betrieb
möglich sein, der **nie** mit Railway oder der API interagiert.

## Entscheidung

**Zwei orthogonale Achsen** steuern jeden Lauf, gebündelt über Umgebungs-**Profile**:

- **Achse 1 — Trigger** (wer stößt den Lauf an): `railway-cron` | `claude-code-cron` | `manuell`.
- **Achse 2 — Executor** (was macht die Inferenz): `api` (SDK + Key) | `claude-code` (Agent-Turn,
  Kontingent).

**Profil-Matrix:**

| Profil | Trigger | Executor | DB | Railway | API |
|---|---|---|---|---|---|
| **local** | manuell | `claude-code` | lokal | **nie** | **nie** |
| cloud · „Cloud" | `railway-cron` | `api` | Railway | ja | ja |
| cloud · „Claude Code Cron" | `claude-code-cron` | `claude-code` | Railway | ja | nein |
| cloud · „Claude Code API" | `claude-code-cron` | `api` | Railway | ja | ja |

- **Ausgeschlossen:** `railway-cron` + `claude-code` (Railway kann kein CC-Kontingent verbrauchen).
- **`APP_PROFILE=local|cloud`** setzt Defaults; einzelne Achsen sind per Env überschreibbar.
- **Harte Leitplanke local:** null API-Calls, **kein stiller API-Fallback**. Misslingt der
  CC-Weg, wird abgebrochen/geskippt, nie über die API nachgeholt. `ANTHROPIC_API_KEY` darf
  ungesetzt sein.

**Executor-Naht + Schema-Disziplin:** Der Executor ist die bestehende `StructuredCaller`-Naht
(Enrichment/SkillTagger/Clustering/Knowledge-Check/Feedback nutzen sie schon). Neben dem
`ApiExecutor` (heute) tritt ein `ClaudeCodeExecutor`: der Agent verarbeitet einen **Batch** in
einem Turn und ruft **pro Item ein lokales Tool `emit_reel(...)`** auf, das **serverseitig
zod-validiert und schreibt** — der Schema-Zwang steckt im Tool, nicht im Freitext, sodass die
„forced tool_choice"-Garantie (ADR 0003, „null statt Halluzination") pro Item erhalten bleibt.
Der Executor wird **einmal** gewählt und an **allen** Aufruf-Stellen injiziert (uniform, kein
Mischmasch); Baureihenfolge enrichment-first.

**Datenpfad:** Die Claude-Code-Session greift **direkt** auf die DB zu (dieselbe Drizzle-Schicht
wie die App) — im local-Profil die lokale DB, im cloud-Override die Railway-DB.

## Alternativen

- **Ein einziger Schalter** (Trigger und Executor gekoppelt): kann „CC plant, aber API inferiert"
  nicht abbilden. Verworfen — zwei Achsen sind nötig.
- **Datenzugriff über admin-geschützte App-Endpunkte** statt direkter DB: mehr Bewegungsteile,
  neue API-Fläche; für ein Single-User-Tool unnötig. Verworfen (F1).
- **Pro-Schritt-Executor-Konfiguration:** unnötige Konfig-Fläche; uniform reicht. Verworfen (F4).
- **Stiller API-Fallback im CC-Modus:** würde die Kostengarantie brechen. Verworfen (F4).

## Konsequenzen

- Neue `StructuredCaller`-Implementierung `ClaudeCodeExecutor` (Batch + `emit_reel`-Tool).
- `env.ts`: `APP_PROFILE` + Achsen-Overrides + Validierung (illegale Kombi
  `railway-cron`+`claude-code` ablehnen; local ⇒ kein API/kein Railway).
- Claude-Code-Routine als Scheduler-Option (für `claude-code-cron`).
- Lokaler Job-Einstieg (`npm run job:cc` o. ä.), der ohne API/Railway läuft.
- Umsetzung in **Epic 17**; bleibt geparkt bis Benutzer-Go.
- Teilt die Claude-Code-Routine-Mechanik mit dem geplanten Refactoring-Agent (Epic 16).
