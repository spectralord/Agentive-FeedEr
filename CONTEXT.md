# CONTEXT — Glossar

> Dieses Dokument ist **ausschließlich ein Glossar**: es definiert die Bedeutung der
> Domänenbegriffe von Agentive-FeedEr. Keine Implementierungsdetails, keine
> Begründungen, kein How-to — das steht in `docs/specs/` und `docs/adr/`.

| Begriff | Definition |
|---|---|
| **Agentive-FeedEr** | Persönliches Web-Tool, das KI-News (Fokus: neue Claude-Features und agentische KI-Nutzung in der Entwicklung) aus kuratierten Quellen einsammelt, KI-gestützt aufbereitet und als vertikal scrollbaren Feed konsumierbar macht. Nicht kommerziell, primär Single-User. |
| **Source (Quelle)** | Eine kuratierte, strukturiert abrufbare Herkunft von Rohinhalten (RSS/Atom-Feed, offizieller Changelog, API wie Hacker News/Reddit, Newsletter). Offenes Web-Scraping und offene Web-Suche sind **keine** Sources im MVP. |
| **Ingestion** | Der tägliche Vorgang, bei dem alle Sources abgerufen und ihre neuen Einträge als **Raw Item** roh gespeichert werden. Enthält keine KI-Verarbeitung. |
| **Raw Item** | Ein unverarbeiteter, aus einer Source eingesammelter Eintrag (Titel, Text/HTML, Link, Veröffentlichungsdatum, Source-Referenz). Rohzustand vor der Anreicherung. |
| **Enrichment (Anreicherung)** | Der KI-Verarbeitungsschritt, der ein **neues** Raw Item in ein **Reel** verwandelt. Läuft als ein einziger strukturierter LLM-Aufruf pro Item. |
| **Reel** | Die atomare, konsumierbare Inhaltseinheit: eine aus **einem** Raw Item aufbereitete Karte. Trägt Zusammenfassung, Attribute (siehe unten), belegtes Beispiel, Handlungszeile und Quell-Link. Wird im Feed vertikal durchgescrollt. |
| **Feed** | Die vertikal (Scroll-Snap, mobil-first) durchscrollbare Ansicht der Reels, neueste zuerst, filterbar. |
| **Attribut** | Ein gespeichertes Faktum über ein Reel. Kern-Attribute: `published_at`, `ingested_at`, `category`, `maturity`, `experimentell`, `relevance_score`, `quality_score`, `skill`. Erweiterbar über ein flexibles Metadaten-Feld ohne Schema-Migration. |
| **category** | Grobe Themenzuordnung eines Reels (z. B. „Claude-Feature", „Tooling", „Technik"). Vom Enrichment vergeben. |
| **maturity (Reifegrad)** | Einschätzung, wie etabliert ein Inhalt ist, auf einer Achse `experimentell ↔ etabliert`. |
| **experimentell** | Gespeichertes Flag: markiert Inhalte, die ein Impuls/eine Spielerei sind und (noch) nicht Production-reif — z. B. etwas, das eine Quelle „mal ausprobiert" hat. Wird **nicht** aus Datum/Relevanz abgeleitet, sondern ist eine eigene Eigenschaft. |
| **relevance_score** | KI-Einschätzung, wie relevant ein Item für den Nutzer ist, bewertet gegen das **Developer-Profil**. |
| **quality_score** | KI-Einschätzung der inhaltlichen Substanz eines Items (Substanz vs. Marketing-Hype). Steuert das Ausblenden von Low-Signal-Inhalten — führt **nie** zum Löschen. |
| **Label** | Eine anzeigeseitige Kennzeichnung wie „🆕 Neu", „⭐ State of the Art", „🛠️ Best Practice". Labels sind **abgeleitete Ansichten/Filter** über Attribute, keine fest gespeicherten Tags. Ausnahme: `experimentell` ist ein gespeichertes Flag. |
| **Developer-Profil** | Eine handgepflegte Beschreibung des Nutzers (Stack, Tools, Senioritätslevel, Interessen, „was mich nervt"), als Datei geführt. Dient als Kontext für die Relevanz-Bewertung im Enrichment. Kein ML, kein Training. |
| **Sourced-only (belegt)** | Grundprinzip: Beispiele und Handlungszeilen in einem Reel dürfen nur zeigen, was **in der Quelle belegt** ist. Ist nichts belegt, bleibt das Feld leer (`null`) — es wird nichts erfunden. |
| **Action (Handlungszeile)** | Die „Was heißt das für mich?"-Zeile eines Reels: eine konkrete, aus der Quelle belegte Handlung. An sie hängt ein **Effort-Tag**. |
| **Effort-Tag** | Aufwandsschätzung an einer Action (z. B. `5-Min-Test`, `Nachmittag`, `nur wissen`). Schätzung, keine belegpflichtige Aussage. |
| **Today's Top-N** | Eine abgeleitete Ansicht der N (Default 3) wichtigsten Reels des Tages, gerankt nach `relevance × quality × recency`. Keine eigene Datenstruktur. |
| **Topic-Cluster** | Optionale Zuordnung eines Reels zu einem Thema, um mehrere Quellen zum selben Thema zu bündeln. Im MVP im Datenmodell vorgesehen, aber noch nicht aktiv genutzt. |
| **Skill-Node (Kompetenz-Knoten)** | Eine Kompetenz/ein Thema (z. B. „Agentische Tool-Nutzung", „Prompt-Caching einsetzen") in der Skill-Map. Reels hängen als Belege/Content unter Skill-Nodes; ein Reel referenziert seinen Skill über das `skill`-Attribut. |
| **Skill-Map** | Visuelle, an einem Ort gesammelte Sicht der Skill-Nodes, gruppiert in Themen-Cluster, **ohne** harte Voraussetzungs-Ketten. Zeigt pro Node den Fortschritt. |
| **user_progress (Fortschritt)** | Der Zustand eines Skill-Nodes für den Nutzer: `gesehen → ausprobiert → gemeistert`. Der Übergang wird **selbst bestätigt** (ehrlichkeitsbasiert), optional mit einer Notiz. |
| **Adoption-Log** | Die Sammlung der Selbst-Bestätigungen und Notizen („so hab ich's genutzt"), die beim Anwenden von Skills entstehen. |
| **Vertiefen (Deep-Dive)** | Vision-Feature: eine on-demand ausgelöste, agentische Nachrecherche zu einem Reel/Thema, die dasselbe Reel-Objekt weiter anreichert. |
| **Experience Report (Erfahrungsbericht)** | Ein subjektiver, nicht zwingend validierter Erfahrungs-/Praxisbericht (z. B. „wie lange halte ich eine Session offen"). Eigener Inhaltstyp, getrennt von Reels — unterliegt **nicht** der Sourced-only-Regel (ADR 0005). Trägt einen Autor statt einer Quelle. |
| **author_type** | Herkunftsart eines Experience Reports: `own` (selbst/Firma verfasst) · `curated` (von der KI aus einer Quelle wie Reddit/Kommentarspalten gefischt) · später `colleague`. Ersetzt im MVP eine echte Nutzer-Authentifizierung (die es nicht gibt). |
| **author_label** | Anzeigename der Herkunft eines Reports: bei `own` ein konfigurierter Name, bei `curated` das Quell-Handle (z. B. „r/ClaudeAI / u/xyz"). Wird bei späterem echten Mehrbenutzer-Betrieb zu einer `user_id`. |
| **Ephemere Inhaltsschicht** | Inhalte, die mit der Zeit automatisch aus den *aktiven* Ansichten **herausrotieren** (`active → deprecated → archived`): News-**Reels** und **kuratierte** Experience Reports. „Ephemer" bezieht sich auf die Sichtbarkeit, **nicht** auf Löschung — die Inhalte bleiben gespeichert und historisch nachvollziehbar. |
| **Dauerhafte Wissensschicht** | Inhalte/Zustände, die anwachsen und in den aktiven Ansichten bleiben, bis sie *manuell* zustandsverschoben werden: **Skill-Nodes**, **user_progress**/**Adoption-Log** und **eigene** Experience Reports. Werden nie automatisch heruntergestuft oder gelöscht. |
| **lifecycle_state** | Einheitlicher Lebenszyklus-Zustand von Inhalten (Reels, Experience Reports) *und* Skill-Nodes: `active` (in normalen Ansichten sichtbar) → `deprecated` (überholt, aus aktiven Ansichten raus, aber im Verlauf/History sichtbar; mit `reason`/`superseded_by`) → `archived` (nur noch in expliziter Archiv-/Historien-Ansicht). **Nichts wird automatisch gelöscht**; alles bleibt historisch nachvollziehbar. |
| **superseded_by** | Optionaler Verweis von einem `deprecated`/`archived` Inhalt auf die ablösende neuere Variante (Reel/Report). |
| **Hartes Löschen** | Endgültiges Entfernen aus der DB — **kein** Teil des automatischen Flusses, nur seltene, bewusste manuelle Aktion (Notausgang). Der Normalfall ist `deprecated`/`archived`, nicht Löschen. |
| **Actionable (To-Try)** | Eine diskrete, abhakbare, skill-getaggte Handlungsempfehlung, **abgeleitet aus** Reels *und* Experience Reports („das solltest du mal ausprobieren"). Der Nutzer hakt Actionables ab — **nie** Reels oder Reports selbst. Erledigte Actionables sind Fortschritts-Belege für einen Skill-Node. |
| **SkillTagger** | Der Pipeline-Schritt/Task, der Inhalten (Reels + Reports) per **Match-or-Propose** einen kanonischen Skill-Node zuordnet: bestehenden Knoten matchen (automatisch im Hintergrund) oder einen neuen vorschlagen (nur mit Nutzer-Bestätigung anlegen). Verhindert eine wuchernde Taxonomie. |
| **Verifier (Prüfer)** | Vision-Feature: ein kritischer KI-Schritt, der Inhalte beliebiger Herkunft gegencheckt und zweifelhafte Aussagen mit Vorbehalt (`caveat`) markiert. |
| **Admin-Console** | Geschützte Operator-Sicht (`/admin`), um Backend-Tasks manuell auszulösen (v. a. die Pipeline) und den Systemzustand zu sehen. Durch `ADMIN_TOKEN` (Shared-Secret) gesichert; ungesetzt ⇒ deaktiviert. |
| **Pipeline-Run** | Ein Durchlauf der täglichen Pipeline (Ingestion und/oder Enrichment), ausgelöst per Cron (`trigger=cron`) oder Admin-Button (`trigger=manual`). In `pipeline_runs` protokolliert (Status, Dauer, Summary, Fehler); es läuft nie mehr als einer gleichzeitig. |
| **Pipeline-Mode** | Umfang eines Pipeline-Runs: `full` (Ingestion + Enrichment), `ingestion` (nur Einsammeln) oder `enrichment` (nur Aufbereiten). |
