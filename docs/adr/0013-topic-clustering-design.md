# ADR 0013 — Topic-Clustering: Match-or-Propose, enge Granularität, `is_primary`

- Status: akzeptiert (Design; Umsetzung offen)
- Datum: 2026-07-23
- Baut auf: ADR 0009 (Match-or-Propose beim SkillTagging — Muster-Vorlage),
  ADR 0012 (Topic-Knowledge-Check rechnet auf Clustern), ADR 0008 (Schichten),
  ADR 0004 (abgeleitete Ansichten), ADR 0003 (null statt Halluzination).
- Voraussetzung für: Epic 11 (Topic-Knowledge-Check), Content-Bündelung (Content-Modell C).

## Kontext / Problem

Content-Modell C und der Topic-Knowledge-Check (ADR 0012) brauchen eine **Recheneinheit**,
die „mehrere Quellen zu *einem* Thema" fasst: das ist ein **Topic-Cluster**. Offen war,
**wie** Cluster gebildet werden (Stabilität, Granularität), wie sie sich zur breiten
Skill-Ebene (Epic 12) verhalten und wie man „**unabhängige** Quellen" für die spätere
Korroboration ehrlich zählt, ohne dass Reblogs die Zahl aufblähen.

## Entscheidung

1. **Bildung = Match-or-Propose gegen aktive Cluster** (analog ADR 0009). Jedes neue Reel
   wird per LLM-Pass entweder einem bestehenden Cluster innerhalb eines Zeitfensters
   zugeordnet (**Match**) oder begründet einen neuen (**Propose**). Das hält Cluster über
   die Zeit **stabil** (kein Neu-Würfeln pro Lauf) und den LLM-Kontext beschränkt.
   Embeddings/Schwellwert sind eine spätere Skalierungs-Naht, nicht Teil des MVP.

2. **Granularität = eng / feature- bzw. meldungs-spezifisch.** Ein Cluster fasst Inhalte zu
   *einem konkreten Ding und seiner Verwendung* („der Batch-Command"), nicht zur generischen
   Fähigkeit. Nur so ist eine spätere Korroborations-Zahl ehrlich (unabhängige Quellen zum
   *selben spezifischen* Claim, nicht themen-weit vermischt).

3. **Die breite thematische Ebene ist die Skill-Node (Epic 12), kein zweiter Cluster-Typ.**
   Ein Reel trägt zwei „Peer-Mengen": den **engen Topic-Cluster** (Epic 15) für
   Korroboration/Freshness und eine/mehrere **Skill-Nodes** (Epic 12) für die breite
   thematische Wissens-/Browsing-Sicht. Es gibt bewusst **keine** eigenständige
   zweistufige Cluster-Hierarchie.

4. **Unabhängigkeit via `is_primary` pro Cluster-Mitglied, bewusst grob.** Der Clustering-Pass
   markiert je Reel, ob es eine **eigenständige/first-hand** Aussage ist (offizielle
   Primärquelle, eigener Test, Erfahrungsbericht) oder die erkennbare **Wiedergabe** eines
   anderen Cluster-Mitglieds (Reblog). Die eigentliche `confidence` leitet **Epic 11** daraus
   als **grobe Skala (few/some/strong)** ab — nicht als exakte Zahl —, damit Fehler beim
   Echo-Erkennen kaum durchschlagen.

## Alternativen

- **Batch-Clustering / Embeddings ab Start:** mächtiger, aber instabil (Cluster wandern pro
  Lauf) bzw. neue Infrastruktur ohne aktuellen Skalierungsdruck. Verworfen zugunsten
  Match-or-Propose; Embeddings bleiben spätere Option.
- **Weite Granularität (Feature-Familie) als Cluster:** verwässert die Korroborations-Zahl
  (Quellen über verschiedene Claims gezählt). Verworfen — Weite liegt bei der Skill-Node.
- **Eigene zweistufige Cluster-Hierarchie** (enger Cluster + thematischer Über-Cluster):
  dritter Gruppierungsbegriff neben Tag und Skill-Node, mehr Maschinerie ohne Zusatznutzen,
  da die Skill-Node die breite Ebene bereits liefert. Verworfen.
- **Reine `source`-Zählung für „unabhängig":** durch Reblogs verfälscht (Echo zählt wie
  Primär). Verworfen zugunsten `is_primary`.

## Konsequenzen

- Neues Schema: Tabelle `topic_clusters`, `reels.topic_cluster_id` (aktiviert, FK),
  `reels.is_primary`. Neuer Pipeline-Schritt nach Enrichment/SkillTagger (Cron + Admin-Button),
  fehlertolerant und idempotent.
- Feed bündelt Cluster als Stapelkarte („N Quellen zu diesem Thema"), Primär oben.
- Epic 11 (Topic-Knowledge-Check) wird baubar: `confidence` aus `is_primary`, `freshness`/
  Supersession als geerdeter Vergleich der Cluster-Mitglieder; beide propagieren auf
  referenzierende Items (ADR 0012).
- Externe Web-Korroboration (Quellen aktiv erweitern) bleibt außerhalb dieses ADR und rührt
  an ADR 0001 → eigener Entscheid.
