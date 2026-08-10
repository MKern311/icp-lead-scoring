# Quickstart-Validierung: Geführter Screening-Workflow

## Voraussetzungen

```bash
node --test tests/*.test.js                    # Kernlogik-Tests (müssen grün sein)
python3 -m http.server 8080 --directory docs   # App starten → http://localhost:8080
```

Browser hart neu laden (Cmd+Shift+R), damit der Service Worker `icp-cache-v3` übernimmt.
Für V3/V4 wird ein eigener Anthropic-API-Schlüssel benötigt (Kosten je Lauf grob
0,50–1,50 €).

## V1 — Schritt 1: Pflicht-Bestätigung (US1, FR-001/002)

1. Profil aus Vorlage „B2B-Dienstleistung" anlegen und aktivieren.
2. Nav-Punkt „Screening" öffnen → der Workflow startet mit Schrittanzeige „1 · 2 · 3".
3. Erwartet: Alle Kriterien als Liste mit Phasen-Wahl; „Weiter" ist gesperrt, solange
   ein Kriterium unbestätigt ist; nach Bestätigung aller Kriterien wird „Weiter" frei.
4. Profil-Editor öffnen → die im Workflow getroffenen Zuordnungen sind dort sichtbar
   (identische Daten).

## V2 — Schritt 1: Suchhinweise (FR-003, FR-013)

1. In Schritt 1 bei „Unternehmensgröße" den Suchhinweis „bevorzugt 50–250 Mitarbeiter"
   erfassen; bei einem Qualifizierungskriterium gibt es kein Hinweisfeld.
2. Kriterium testweise auf Qualifizierung und zurück stellen → Hinweis bleibt erhalten.
3. Profil exportieren → JSON enthält `searchHint` beim Pre-Screening-Kriterium;
   Re-Import stellt den Hinweis wieder her.

## V3 — Schritt-Gates (FR-004)

1. Alle Kriterien auf „Qualifizierung" stellen → Übergang zu Schritt 2 gesperrt mit
   Erklärung und Rücksprung-Angebot.
2. Mindestens ein Kriterium auf „Pre-Screening", aber keinen Schlüssel hinterlegt →
   Schritt 2 zeigt die Schlüssel-Eingabe an Ort und Stelle; ohne Schlüssel kein Start.

## V4 — Voller Durchlauf (US2 + US3, FR-005–009)

1. Schlüssel hinterlegen, Lauf mit Region „DACH", Anzahl 5 starten.
2. Erwartet: Fortschrittsanzeige, dann Kandidatentabelle mit Quellen; 2 Kandidaten
   auswählen und übernehmen.
3. Erwartet: Workflow wechselt in Schritt 3, „Lead 1 von 2"; Pre-Screening-Werte samt
   Quell-Links nur lesend; Eingabefelder nur für Qualifizierungskriterien;
   Live-Score reagiert auf Eingaben (K.o. „Nein" ⇒ sofort „Disqualifiziert").
4. Lead 1 speichern & weiter, Lead 2 überspringen → Zusammenfassung: 1 bearbeitet,
   1 übersprungen, Stufen-Verteilung, Link zur Rangliste; Rangliste zeigt beide Leads
   mit Quelle „Screening".

## V5 — Wiedereinstieg & Abbruch (FR-010/011, SC-004)

1. Workflow verlassen (z. B. zur Rangliste), Nav-Punkt „Screening" erneut öffnen.
2. Erwartet: Angebot, direkt mit der Qualifizierung der offenen Screening-Leads
   fortzufahren (der übersprungene Lead aus V4 erscheint in der Warteschlange).
3. Browser neu laden → identisches Verhalten (kein persistierter Workflow-Zustand;
   Profil, Leads und Schlüssel unverändert vorhanden).

## Regression

- `node --test tests/*.test.js` — alle Tests grün, inkl. erweitertem SC-004-Anker
  (Suchhinweis eines Qualifizierungskriteriums nie im Request).
- Einzelansichten Profile / Leads / Rangliste / CSV-Import verhalten sich unverändert
  (Stichprobe gemäß `specs/001-icp-lead-scoring/quickstart.md`).
