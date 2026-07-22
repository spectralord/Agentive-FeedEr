# Vision-Backlog (optional, nur nach explizitem Benutzer-Go)

Bewusst grob gehaltene Skizzen — vor Umsetzung je ein kurzes Grill-Gespräch mit dem
Benutzer führen und ggf. einen ADR ergänzen.

## V1 — Topic-Clustering (Content-Modell C)
- Ziel: mehrere Quellen zum selben Thema bündeln (das reservierte
  `reels.topic_cluster_id` aktivieren).
- Skizze: neue Tabelle `topic_clusters { id, title, created_at }`. Im Daily-Job nach
  dem Enrichment ein Batch-Call: Titel+Summaries der letzten 7 Tage → Cluster-Vorschläge;
  Zuordnung nur bei hoher Sicherheit, sonst null. Feed zeigt gebündelte Reels als
  Stapel-Karte („3 Quellen zu diesem Thema").
- Vorbedingung: Feed fühlt sich nachweislich repetitiv an (sonst nicht bauen).

## V2 — Generierte Beispiele (Erweiterung von ADR 0005)
- Env-Flag `ALLOW_GENERATED_EXAMPLES=false` (Default). Wenn aktiviert: fehlt ein
  belegtes `example`, darf ein zweiter, expliziter Call ein Beispiel generieren —
  Anzeige zwingend mit Warn-Label „⚠️ KI-generiert, ungeprüft", gespeichert in
  `metadata.generated_example` (nie im `example`-Feld — belegt und generiert bleiben
  getrennt).
- Vorbedingung: ADR 0005 um diese Erweiterung fortschreiben (Status-Update).

## V3 — Audio-Modus (TTS)
- „Heute anhören": Top-N-Summaries zu einem Audio-Snippet (TTS-Anbieter offen —
  vor Umsetzung wählen), Player auf `/today`. Kein Podcast-Feed im ersten Schritt.

## V4 — Teilen mit Kollegen / Team-Feed
- Stufe 1: Read-only-Zugang hinter einfachem Shared-Secret (Env `ACCESS_PASSWORD`,
  Middleware-Check, Cookie) — kein Account-System.
- Stufe 2 (nur bei echtem Bedarf): getrennte Profile/Saves je Person ⇒ dann echtes
  Auth (z. B. Auth.js), eigene Grill-Session vorab (ändert Datenmodell: user_id-Spalten).
- Datenschutz-Hinweis: ab Stufe 1 ist das Tool nicht mehr „nur privat" — Quellen-
  Nutzungsbedingungen kurz prüfen.

## V5 — Betriebs-Nettigkeiten
- Wöchentliche Digest-Mail (Top der Woche) · Health-Alarm, wenn Daily-Job 2× in Folge
  scheitert (einfacher Webhook/Mail) · Backfill-Kommando für neue Quellen
  (`npm run job:backfill -- --source=<name> --days=90`).
