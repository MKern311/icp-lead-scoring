# Feature Specification: ICP Definition & Lead Scoring

**Feature Branch**: `001-icp-lead-scoring`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "Lösung, mit der ein Ideal Customer Profile (ICP) definiert und anhand festgelegter Kriterien Kunden/Leads für das eigene Geschäft bewertet werden können. Das Tool soll generisch funktionieren, sodass auch andere Nutzer eigene ICP-Definitionen und Kriterien verwenden können."

## Clarifications

### Session 2026-08-04

- Q: In welcher Form soll das Tool genutzt werden (Auslieferungsform)? → A: Gehostete Web-App — über eine Web-Adresse im Browser erreichbar, ohne Installation; alle Nutzdaten verbleiben dennoch ausschließlich auf dem Gerät des Nutzers (keine Konten, kein Backend für Nutzdaten).
- Q: Soll KI-Unterstützung Teil der ersten Version sein? → A: Nein — v1 bewertet rein regelbasiert und deterministisch; KI-Features sind für spätere Versionen denkbar.
- Q: Bleibt es beim Einzelnutzer-Modell mit Weitergabe per Profil-Export? → A: Ja — Einzelnutzer, Weitergabe von ICP-Profilen per Datei-Export/-Import.
- Q: In welcher Sprache soll die Benutzeroberfläche sein? → A: Deutsch — einsprachig deutsche Oberfläche; Nutzerinhalte (Profile, Kriterien, Stufen) bleiben freie Texte und damit sprachneutral.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ICP-Profil mit eigenen Kriterien definieren (Priority: P1)

Als Nutzer lege ich ein Ideal Customer Profile an: Ich gebe dem Profil einen Namen und eine Beschreibung und definiere frei meine eigenen Bewertungskriterien (z. B. Branche, Unternehmensgröße, Budget, Region, Entscheidungsreife). Für jedes Kriterium lege ich fest, welchen Typ es hat (Auswahlliste, Zahlenbereich, Ja/Nein, Skala), wie stark es gewichtet wird und welche Ausprägung wie viele Punkte bringt. Einzelne Kriterien kann ich als K.o.-Kriterium markieren: Wird es nicht erfüllt, ist der Lead disqualifiziert, egal wie gut der Rest aussieht. Es gibt keine fest verdrahteten Branchen-Kriterien — jedes Geschäftsmodell kann sein eigenes Profil abbilden.

**Why this priority**: Ohne definiertes ICP gibt es nichts, wogegen bewertet werden kann. Das frei konfigurierbare Kriterienmodell ist zugleich der Kern der Generik-Anforderung.

**Independent Test**: Kann vollständig getestet werden, indem ein Profil mit mindestens fünf Kriterien unterschiedlicher Typen inkl. Gewichtungen und einem K.o.-Kriterium angelegt, gespeichert, wieder geöffnet und bearbeitet wird.

**Acceptance Scenarios**:

1. **Given** ein leeres System, **When** der Nutzer ein neues Profil mit Namen, Beschreibung und fünf Kriterien (mind. je einmal Auswahlliste, Zahlenbereich, Ja/Nein, Skala) anlegt, **Then** wird das Profil gespeichert und beim erneuten Öffnen vollständig und unverändert angezeigt.
2. **Given** ein Kriterium vom Typ Auswahlliste, **When** der Nutzer den Optionen Punktwerte zuweist (z. B. „SaaS“ = 100, „Handel“ = 40, „Sonstige“ = 0), **Then** werden diese Punktwerte bei späteren Bewertungen exakt angewendet.
3. **Given** Kriterien mit Gewichtungen, deren Summe nicht 100 % ergibt, **When** der Nutzer das Profil speichert, **Then** weist das System auf die Abweichung hin und normalisiert die Gewichte nachvollziehbar oder lässt den Nutzer korrigieren.
4. **Given** ein Kriterium ist als K.o.-Kriterium markiert, **When** ein Lead dieses Kriterium nicht erfüllt, **Then** wird der Lead als „disqualifiziert“ ausgewiesen — unabhängig von seiner sonstigen Punktzahl.

---

### User Story 2 - Einzelnen Lead erfassen und bewerten (Priority: P2)

Als Nutzer erfasse ich einen Lead (z. B. ein Unternehmen aus einer Anfrage) und trage die Ausprägungen zu den Kriterien meines aktiven Profils ein. Das System berechnet sofort eine gewichtete Gesamtpunktzahl (0–100), ordnet den Lead einer Stufe zu (z. B. A/B/C oder Hot/Warm/Cold) und zeigt transparent, welches Kriterium wie viel zum Ergebnis beigetragen hat.

**Why this priority**: Die Bewertung einzelner Leads ist der eigentliche Nutzen des Tools; zusammen mit Story 1 ergibt sie das kleinste sinnvoll nutzbare Produkt.

**Independent Test**: Mit einem vorhandenen Profil einen Lead manuell erfassen und prüfen, dass Gesamtpunktzahl, Stufenzuordnung und Kriterien-Aufschlüsselung korrekt und nachvollziehbar sind.

**Acceptance Scenarios**:

1. **Given** ein Profil mit gewichteten Kriterien, **When** der Nutzer einen Lead mit Werten zu allen Kriterien erfasst, **Then** zeigt das System eine Gesamtpunktzahl von 0–100, die zugehörige Stufe und eine Aufschlüsselung pro Kriterium (Rohwert, Punkte, Gewichtungsbeitrag).
2. **Given** konfigurierbare Stufen-Schwellenwerte (z. B. A ≥ 75, B ≥ 50, C < 50), **When** ein Lead 74 Punkte erreicht, **Then** wird er der Stufe B zugeordnet; bei 75 Punkten der Stufe A.
3. **Given** ein Lead ohne Wert für ein Kriterium, **When** der Nutzer die Bewertung speichert, **Then** kennzeichnet das System die Bewertung als unvollständig und weist aus, wie mit dem fehlenden Wert umgegangen wurde.
4. **Given** ein bewerteter Lead, **When** der Nutzer die Ausprägung eines Kriteriums ändert, **Then** werden Punktzahl, Stufe und Aufschlüsselung sofort neu berechnet.

---

### User Story 3 - Viele Leads importieren, vergleichen und priorisieren (Priority: P3)

Als Nutzer importiere ich eine Liste von Leads (z. B. aus einer Messe- oder CRM-Auswertung) per CSV-Datei, ordne die Spalten den Kriterien meines Profils zu und erhalte eine bewertete, sortierbare Rangliste. So sehe ich auf einen Blick, welche Leads ich zuerst angehen sollte. Ergebnisse kann ich als CSV exportieren, um sie weiterzuverwenden.

**Why this priority**: Der Mehrwert gegenüber Bauchgefühl entsteht vor allem beim Priorisieren vieler Leads; für die Kernfunktion ist Massenverarbeitung aber nicht zwingend.

**Independent Test**: Eine CSV mit mindestens 20 Leads importieren, Spalten zuordnen, Rangliste prüfen (Sortierung nach Punktzahl, Filterung nach Stufe) und Ergebnis-Export öffnen.

**Acceptance Scenarios**:

1. **Given** eine CSV-Datei mit Leads, **When** der Nutzer sie importiert und die Spalten den Kriterien zuordnet, **Then** werden alle Zeilen bewertet und in einer nach Punktzahl sortierten Rangliste angezeigt.
2. **Given** eine importierte Lead-Liste, **When** der Nutzer nach Stufe filtert oder nach einem Kriterium sortiert, **Then** passt sich die Rangliste entsprechend an.
3. **Given** eine CSV mit fehlerhaften oder leeren Zeilen, **When** der Nutzer importiert, **Then** meldet das System die betroffenen Zeilen mit Grund und importiert die gültigen Zeilen trotzdem.
4. **Given** bewertete Leads, **When** der Nutzer exportiert, **Then** enthält die Export-Datei alle Leads mit Rohwerten, Punktzahl, Stufe und Disqualifikations-Status.

---

### User Story 4 - Profile weitergeben und Vorlagen nutzen (Priority: P4)

Als Nutzer exportiere ich mein ICP-Profil als Datei und gebe es an Kollegen oder andere Anwender weiter, die es unverändert importieren und sofort nutzen können. Als neuer Nutzer starte ich alternativ mit einer mitgelieferten Beispiel-Vorlage (z. B. „B2B-Dienstleistung“, „SaaS“), die ich an mein Geschäft anpasse.

**Why this priority**: Macht die Generik praktisch erlebbar und senkt die Einstiegshürde, ist aber für den Erstnutzen des Werkzeugs nicht erforderlich.

**Independent Test**: Ein Profil exportieren, in einer frischen Umgebung importieren und prüfen, dass Kriterien, Gewichte, Punktregeln und Stufen identisch funktionieren; eine Vorlage laden und anpassen.

**Acceptance Scenarios**:

1. **Given** ein vollständig konfiguriertes Profil, **When** der Nutzer es exportiert und in einer anderen Installation importiert, **Then** liefern beide Installationen für denselben Lead dieselbe Punktzahl und Stufe.
2. **Given** ein neuer Nutzer ohne eigenes Profil, **When** er eine mitgelieferte Vorlage öffnet, **Then** kann er sie unter neuem Namen speichern und alle Kriterien frei anpassen.

---

### Edge Cases

- Fehlender Wert bei einem Kriterium: Bewertung wird als „unvollständig“ gekennzeichnet; die Punktzahl wird auf Basis der vorhandenen Kriterien normalisiert ausgewiesen, damit Leads mit Datenlücken nicht systematisch benachteiligt werden. Der Umgang (neutral werten vs. 0 Punkte) ist pro Profil einstellbar.
- Gewichtungssumme ≠ 100 %: System weist darauf hin und bietet Normalisierung an; stillschweigendes Verrechnen ohne Hinweis ist nicht zulässig.
- K.o.-Kriterium ohne Wert: Lead gilt als „nicht bewertbar“ (weder qualifiziert noch disqualifiziert) und wird entsprechend gekennzeichnet.
- Profiländerung nach bereits erfolgten Bewertungen: Bestehende Bewertungen werden auf Basis des geänderten Profils neu berechnet; der Nutzer wird auf die Neuberechnung hingewiesen.
- Löschen eines Profils, zu dem bewertete Leads existieren: System warnt und verlangt explizite Bestätigung; Leads bleiben erhalten, verlieren aber ihre Bewertung.
- CSV-Import mit unbekannten Spalten, Duplikaten (gleicher Lead-Name) oder leerer Datei: unbekannte Spalten bleiben unberücksichtigt, Duplikate werden gemeldet, leere Importe erzeugen eine verständliche Fehlermeldung.
- Kriterium vom Typ Zahlenbereich mit Wert außerhalb aller definierten Bereiche: erhält 0 Punkte und wird in der Aufschlüsselung als „außerhalb der definierten Bereiche“ markiert.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Nutzer MÜSSEN mehrere ICP-Profile anlegen, bearbeiten, duplizieren und löschen können; jedes Profil hat Name und Beschreibung.
- **FR-002**: Nutzer MÜSSEN je Profil beliebige eigene Kriterien definieren können; ein Kriterium hat Name, optionale Beschreibung, Typ und Gewichtung. Es gibt keine fest vorgegebenen, unveränderlichen Kriterien.
- **FR-003**: Das System MUSS mindestens folgende Kriterientypen unterstützen: Auswahlliste (Optionen mit je eigenem Punktwert), Zahlenbereich (Bereiche mit je eigenem Punktwert), Ja/Nein (Punktwert für Ja bzw. Nein) und Skala (z. B. 1–5, linear auf Punkte abgebildet).
- **FR-004**: Nutzer MÜSSEN einzelne Kriterien als K.o.-Kriterium markieren können; die Nichterfüllung führt zur Disqualifikation des Leads unabhängig von der Punktzahl.
- **FR-005**: Das System MUSS aus den Kriterienbewertungen eine gewichtete Gesamtpunktzahl von 0–100 berechnen und die Berechnung pro Kriterium (Rohwert, Punkte, Gewichtungsbeitrag) offenlegen.
- **FR-006**: Nutzer MÜSSEN je Profil Bewertungsstufen mit frei wählbaren Bezeichnungen und Schwellenwerten definieren können (z. B. A/B/C oder Hot/Warm/Cold); jeder bewertete Lead wird genau einer Stufe oder dem Status „disqualifiziert“ zugeordnet.
- **FR-007**: Nutzer MÜSSEN Leads manuell erfassen können; die Eingabefelder ergeben sich dynamisch aus den Kriterien des gewählten Profils, ergänzt um Basisdaten (Lead-Name, optionale Notiz).
- **FR-008**: Das System MUSS Leads per CSV-Datei importieren können, inkl. Zuordnung der CSV-Spalten zu Kriterien und verständlicher Fehlerberichte für nicht importierbare Zeilen.
- **FR-009**: Das System MUSS bewertete Leads als sortier- und filterbare Rangliste anzeigen (Sortierung mindestens nach Punktzahl, Filterung mindestens nach Stufe) und als CSV exportieren können.
- **FR-010**: Das System MUSS Bewertungen mit fehlenden Kriterienwerten als „unvollständig“ kennzeichnen; der Umgang mit fehlenden Werten (neutral oder 0 Punkte) MUSS pro Profil einstellbar sein.
- **FR-011**: Das System MUSS bei Änderungen an einem Profil alle zugehörigen Lead-Bewertungen neu berechnen und den Nutzer darüber informieren.
- **FR-012**: Nutzer MÜSSEN Profile als Datei exportieren und importieren können, sodass andere Anwender identische Bewertungslogik erhalten.
- **FR-013**: Das System MUSS mindestens zwei mitgelieferte Beispiel-Profile (Vorlagen) anbieten, die als Kopie übernommen und frei angepasst werden können.
- **FR-014**: Alle Profile, Leads und Bewertungen MÜSSEN dauerhaft gespeichert bleiben und nach Neustart des Werkzeugs unverändert verfügbar sein.
- **FR-015**: Das System MUSS bei Gewichtungssummen ungleich 100 % einen Hinweis geben und eine nachvollziehbare Normalisierung anbieten.
- **FR-016**: Das Werkzeug MUSS über eine Web-Adresse im Browser nutzbar sein, ohne Installation und ohne Benutzerkonto; sämtliche Nutzdaten (Profile, Leads, Bewertungen) verbleiben dabei ausschließlich auf dem Gerät des Nutzers.
- **FR-017**: Die Benutzeroberfläche MUSS auf Deutsch sein; alle Nutzerinhalte (Namen von Profilen, Kriterien, Stufen, Leads) sind freie Texte und funktionieren sprachunabhängig.

### Key Entities

- **ICP-Profil**: Benannte Definition eines Idealkundenprofils; enthält Beschreibung, Kriterienliste, Stufen-Definitionen und Einstellungen (z. B. Umgang mit fehlenden Werten).
- **Kriterium**: Einzelnes Bewertungsmerkmal eines Profils; hat Typ, Gewichtung, Punktregeln und optional die Eigenschaft „K.o.-Kriterium“.
- **Punktregel**: Zuordnung von Ausprägungen (Option, Zahlenbereich, Ja/Nein, Skalenwert) zu Punktwerten innerhalb eines Kriteriums.
- **Stufe**: Benanntes Ergebnisband eines Profils (Bezeichnung + Schwellenwert), z. B. „A ≥ 75“.
- **Lead**: Zu bewertender Kunde/Interessent; hat Namen, optionale Notizen und Ausprägungen zu den Kriterien eines Profils.
- **Bewertung**: Ergebnis der Anwendung eines Profils auf einen Lead; enthält Gesamtpunktzahl, Stufe bzw. Disqualifikations-Status, Aufschlüsselung pro Kriterium und Vollständigkeits-Kennzeichen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein neuer Nutzer kann ohne Anleitung innerhalb von 15 Minuten ein eigenes ICP-Profil mit mindestens fünf Kriterien inkl. Gewichtungen und Stufen anlegen.
- **SC-002**: Ein einzelner Lead kann in unter 2 Minuten erfasst und bewertet werden; das Ergebnis (Punktzahl, Stufe, Aufschlüsselung) ist ohne weitere Erklärung verständlich.
- **SC-003**: Eine Liste mit 100 Leads ist in unter 5 Minuten importiert, zugeordnet und als priorisierte Rangliste sichtbar.
- **SC-004**: 100 % der Bewertungen sind nachvollziehbar: Für jeden bewerteten Lead ist sichtbar, welches Kriterium mit welchem Beitrag zum Ergebnis geführt hat.
- **SC-005**: Ein exportiertes Profil liefert nach Import in einer anderen Installation für identische Lead-Daten eine identische Punktzahl und Stufe (0 Abweichungen).
- **SC-006**: Das Werkzeug ist ohne branchenspezifische Anpassung des Systems für unterschiedliche Geschäftsmodelle nutzbar — nachweisbar durch die zwei mitgelieferten, inhaltlich verschiedenen Beispiel-Profile.

## Assumptions

- **Einzelnutzer-Werkzeug** *(bestätigt in Clarify-Session)*: v1 ist ein Werkzeug für jeweils eine Person; „generisch für andere nutzbar“ wird über die gemeinsame Web-Adresse und Profil-Export/-Import erreicht, nicht über Benutzerkonten, Rollen oder gleichzeitiges Arbeiten.
- **Gehostet, Daten lokal** *(entschieden in Clarify-Session)*: Das Werkzeug wird als Web-App über eine URL bereitgestellt; sämtliche Nutzdaten verbleiben auf dem Gerät des Nutzers. Nach dem ersten Laden soll das Werkzeug auch ohne Internetverbindung nutzbar bleiben. Das ist auch für vertrauliche Beratungs-Leads angemessen.
- **CSV als Schnittstelle**: Anbindung an CRM-Systeme (z. B. HubSpot) ist in v1 nicht enthalten; CSV-Import/-Export dient als Brücke.
- **Keine KI, keine Datenanreicherung** *(bestätigt in Clarify-Session)*: Das Werkzeug bewertet rein regelbasiert die vom Nutzer bereitgestellten Daten; automatisches Nachschlagen von Firmeninformationen oder KI-gestützte Vorbewertung sind nicht Teil von v1.
- **Punkteskala**: Kriterien werden intern auf 0–100 Punkte normiert; die Gesamtpunktzahl ist der gewichtete Durchschnitt. Andere Skalen sind Darstellungsfragen, keine eigene Anforderung.
- **Sprache** *(entschieden in Clarify-Session)*: Die Oberfläche von v1 ist einsprachig Deutsch; Kriterien, Profile und Stufen sind freie Nutzertexte und damit sprachunabhängig.
- **Datenvolumen**: v1 ist auf typische Beratungs-/Vertriebslisten ausgelegt (bis ca. 5 000 Leads pro Profil), nicht auf CRM-Massendaten.
