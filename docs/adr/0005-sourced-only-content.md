# ADR 0005 — Nur belegte Inhalte (keine erfundenen Beispiele/Handlungen)

- Status: akzeptiert
- Datum: 2026-07-21

## Kontext / Problem

Der Kernzweck des Tools ist „wie nutze ich KI *richtig*". Ein halluziniertes
Code-Beispiel oder eine erfundene Handlungsempfehlung ist damit schlimmer als gar keins
— es bringt aktiv falsche Praxis bei und zerstört das Vertrauen, das die einzige Währung
eines persönlichen Kurations-Tools ist.

## Entscheidung

Beispiele (`example`) und Handlungszeilen (`action`) in einem Reel dürfen **nur** zeigen,
was in der Quelle belegt ist. Ist nichts belegt, bleibt das Feld `null` — es wird nichts
generiert. Der Effort-Tag ist davon ausgenommen: er ist eine Schätzung, keine
belegpflichtige Sachaussage.

## Alternativen

- **LLM-generierte Beispiele/Handlungen** (klar als „KI-generiert, ungeprüft" markiert):
  bessere Abdeckung, aber Halluzinationsrisiko. Bewusst als spätere, optionale Erweiterung
  zurückgestellt, nicht im MVP.
- **Hybrid** (bevorzugt belegt, sonst generiert): dito später möglich.

## Konsequenzen

- Manche Reels haben kein Beispiel/keine Action — akzeptiert zugunsten der Glaubwürdigkeit.
- Setzt technisch das `null`-statt-Raten-Verhalten aus ADR 0003 voraus.
- Jedes Reel behält einen Quell-Link zur Nachprüfbarkeit.
