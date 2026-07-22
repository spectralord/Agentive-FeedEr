# ADR 0010 — Admin-Console: manueller Pipeline-Trigger + Shared-Secret-Gate

- Status: akzeptiert (autonome Session, Benutzer-Veto vorbehalten)
- Datum: 2026-07-22
- Berührt: ADR 0002 (Pipeline), ADR 0006 (Always-on-Container)

## Kontext / Problem

Der tägliche Cron-Task soll auch **manuell per Knopf** aus der App ausgelöst werden
können (Operator-Bedürfnis). Zwei Probleme: (1) der Task läuft minutenlang und ruft die
Anthropic-API (Kosten), (2) die App ist unter einer öffentlichen URL erreichbar — ein
ungeschützter Trigger wäre ein Kosten-/Missbrauchsrisiko.

## Entscheidung

1. **Wiederverwendbare Pipeline-Funktion:** Der Kern wird als `runDailyPipeline(db,{mode})`
   in `src/lib/pipeline.ts` extrahiert; Cron (`jobs/daily.ts`) **und** Admin-API rufen
   dieselbe Funktion — keine Logik-Duplikation.
2. **Asynchroner Lauf mit Status-Tabelle:** `POST /api/admin/run` legt eine
   `pipeline_runs`-Zeile (`running`) an, startet die Pipeline **ohne await** (zulässig im
   Always-on-Container, ADR 0006) und antwortet sofort mit der Run-ID. Am Ende wird
   `success`/`failed` + `summary` geschrieben. Ein **„nur ein Lauf gleichzeitig"-Guard**
   verhindert Überlappung von Button- und Cron-Läufen.
3. **Shared-Secret-Gate:** Der gesamte Admin-Bereich (`/admin/*`, `/api/admin/*`) ist
   durch `ADMIN_TOKEN` (Env) geschützt (Login → httpOnly-Cookie). **Ist `ADMIN_TOKEN`
   nicht gesetzt, ist der Admin-Bereich deaktiviert** (Trigger-API 503) — safe default,
   kein offener Trigger auf öffentlicher URL.

## Alternativen

- **Synchroner Trigger** (Route läuft bis fertig): hängender Request, Timeout-Risiko. Verworfen.
- **Kein Auth** (Single-User-Annahme): unsicher, da die URL öffentlich ist und LLM-Kosten
  entstehen. Verworfen.
- **Volles Auth-System**: Overkill fürs MVP; das Shared-Secret ist die Team-Feed-Vorstufe (V4).

## Konsequenzen

- Cron-Läufe schreiben ebenfalls in `pipeline_runs` → einheitliche Lauf-Historie in der Admin-UI.
- Neuer Betriebs-Schritt: `ADMIN_TOKEN` setzen (sonst Admin aus); der **Web-Service** braucht
  jetzt auch `ANTHROPIC_API_KEY` (Pipeline läuft dort beim Button-Klick).
- Rohe Job-Logs werden nicht gesammelt; die Admin-UI zeigt die strukturierte `summary`.
- Stale-Run-Erkennung (Container-Neustart mitten im Lauf) ist im MVP nur zeitbasiert.
