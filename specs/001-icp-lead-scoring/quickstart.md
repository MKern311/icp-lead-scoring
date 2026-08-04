# Quickstart & Validierung: ICP Definition & Lead Scoring

**Plan**: [plan.md](plan.md) | **Contracts**: [contracts/](contracts/)

## Voraussetzungen

- Node.js ≥ 20 (nur für Tests; die App selbst braucht kein Node)
- Ein moderner Browser (Chrome, Edge, Firefox oder Safari)
- Python 3 **oder** beliebiger statischer Fileserver für den lokalen Start

## Lokal starten

```bash
cd /Users/manuelkern/Claude/50_dev/icp-lead-scoring
python3 -m http.server 8080 --directory docs
# → http://localhost:8080 im Browser öffnen
```

> Hinweis: Der Service Worker registriert sich unter `localhost` und nach Deployment
> unter der GitHub-Pages-URL (HTTPS). Beim lokalen Entwickeln nach Änderungen
> Hard-Reload (Cmd+Shift+R) verwenden.

## Tests ausführen (Scoring-Kernlogik)

```bash
node --test tests/*.test.js
```

**Erwartung**: alle Tests grün; abgedeckt sind mindestens die Referenzbeispiele L1–L6 aus
[contracts/scoring-engine.md](contracts/scoring-engine.md) sowie CSV-Parser-, Modell-
validierungs- und Profil-IO-Roundtrip-Fälle.

## End-to-End-Validierungsszenarien (manuell, je User Story)

### V1 — ICP-Profil definieren (US1)

1. App öffnen → „Neues Profil" → Name „Test-ICP" vergeben.
2. Fünf Kriterien anlegen: je eines vom Typ Auswahlliste, Zahlenbereich, Ja/Nein, Skala
   (+ ein beliebiges fünftes); Gewichte 40/30/20/5/5; Ja/Nein-Kriterium als K.o. markieren.
3. Stufen A ≥ 75, B ≥ 50, C ≥ 0 anlegen. Speichern.
4. Browser-Tab schließen, neu öffnen → Profil vollständig und unverändert vorhanden.
5. Gewicht eines Kriteriums auf 90 ändern → Hinweis „Summe ≠ 100 %" mit Normalisierungs-
   angebot erscheint (FR-015).

**Erwartung**: Szenarien 1–4 der US1-Akzeptanzkriterien erfüllt.

### V2 — Einzelnen Lead bewerten (US2)

1. Lead „Muster GmbH" mit Werten zu allen Kriterien erfassen.
2. Punktzahl (0–100, 1 Dezimalstelle), Stufe und Aufschlüsselung je Kriterium erscheinen sofort.
3. Einen Wert ändern → Ergebnis aktualisiert sich ohne Neuladen.
4. Einen Wert leeren → Kennzeichnung „unvollständig" + Ausweis des Umgangs mit dem
   fehlenden Wert.
5. K.o.-Kriterium auf „Nein" setzen → Status „disqualifiziert" unabhängig von der Punktzahl.

### V3 — CSV-Import & Rangliste (US3)

1. Beispiel-CSV mit ≥ 20 Zeilen (Semikolon-getrennt, mit Umlauten, eine absichtlich
   kaputte Zeile) importieren.
2. Spalten zuordnen (Vorbelegung bei namensgleichen Spalten prüfen) → Import melden:
   n importiert, 1 Zeilenfehler mit Grund.
3. Rangliste: Sortierung nach Punktzahl absteigend; Filter nach Stufe wirkt.
4. Export → Datei öffnet in Excel korrekt (Umlaute, Semikolon, Dezimalkomma);
   enthält Rohwerte, Punktzahl, Stufe, Status ([csv-format.md](contracts/csv-format.md)).

### V4 — Profil weitergeben & Vorlagen (US4)

1. „Test-ICP" exportieren (`icp-profil-test-icp-v1.json`).
2. In einem anderen Browser(-Profil) die App öffnen, Profil importieren → identischer Lead
   liefert identische Punktzahl und Stufe (SC-005).
3. Vorlage („B2B-Dienstleistung" oder „SaaS") laden → unter neuem Namen speichern und ein
   Kriterium ändern — Original-Vorlage bleibt unverändert.

### V5 — Offline (Constitution III)

1. App einmal online laden, dann Netzwerk trennen (DevTools → Offline).
2. Neu laden → App startet, alle Daten vorhanden, Bewertung funktioniert.

## Deployment (GitHub Pages)

```bash
gh repo create MKern311/icp-lead-scoring --public --source . --push
gh api -X POST repos/MKern311/icp-lead-scoring/pages \
  -f "source[branch]=main" -f "source[path]=/docs"
# → https://mkern311.github.io/icp-lead-scoring/
```
