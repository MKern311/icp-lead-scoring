# Feature 007: Kriterien anpassen, Profile teilen, Zugang beschränken

**Status**: umgesetzt · **Datum**: 2026-08-27
**Basis**: Features 001–006

## User Scenarios

### US1 — Vorgeschlagene Kriterien anpassen und entfernen (P1)

Die Katalog-Vorschläge sind ein guter Startpunkt, aber selten wörtlich passend.

**Akzeptanz**
1. In Schritt 1 des Workflows lässt sich jedes Kriterium aufklappen und dort
   ändern: Name, Beschreibung, Gewicht, K.-o.-Status sowie die Ausprägungen
   samt Punkten — inklusive Hinzufügen und Entfernen einzelner Ausprägungen.
2. Ein Kriterium lässt sich mit Rückfrage ganz aus dem Profil entfernen.
3. Änderungen wirken sofort im Profil; der geöffnete Editor bleibt beim
   Neuzeichnen offen und das Tippen im Namensfeld verliert nicht den Fokus.
4. Wird eine Ausprägung entfernt, verschwindet sie auch aus der Suchauswahl —
   `searchTargets` zeigt nie auf etwas Gelöschtes.
5. Die Gewichtssumme ist sichtbar und lässt sich auf 100 % normieren.

### US2 — Profile über einen Code weitergeben (P2)

**Akzeptanz**
1. Zu jedem Profil lässt sich ein Textcode erzeugen, der Kriterien, Gewichte,
   Punktregeln und Stufen enthält — keine Leads, keinen API-Schlüssel.
2. Der Code lässt sich auf einem anderen Gerät einfügen und legt dort ein neues
   Profil an; vorhandene bleiben unberührt, der Name wird bei Bedarf eindeutig gemacht.
3. Der Code funktioniert ohne Server — auch auf GitHub Pages.
4. Unbrauchbare Codes führen zu einer konkreten deutschen Meldung, nie zu einem Absturz.

### US3 — Die öffentliche Seite ist nicht für jeden (P2)

**Akzeptanz**
1. Auf der öffentlich erreichbaren Seite erscheint vor der App eine Abfrage des
   Zugangsworts; erst danach wird die Anwendung geladen.
2. Die Freigabe wird auf dem Gerät gemerkt.
3. Lokal (`localhost`) entfällt die Abfrage.
4. Die Oberfläche benennt ausdrücklich, was die Hürde leistet und was nicht.

## Functional Requirements

- **FR-419** `ui/criterion-editor.js` liefert Editor-Bausteine für ein Kriterium
  und meldet über den Rückgabewert, ob neu gezeichnet werden muss.
- **FR-420** Schritt 1 des Workflows hält den Zustand geöffneter Editoren in
  `editing` (flüchtig) und speichert jede Änderung sofort über `store.saveProfile`.
- **FR-421** `core/profile-code.js` kodiert das Export-Objekt als
  `ICP1-<base64url(gzip(json))>` und dekodiert es zurück; `ICP0-` ist die
  unkomprimierte Rückfallebene.
- **FR-422** `js/gate.js` lädt `app.js` erst nach erfolgreicher Wortprüfung
  (SHA-256-Vergleich); auf localhost sofort.

## Success Criteria

- **SC-417** Ein Code überlebt Kodieren → Dekodieren → Import unverändert und
  ergibt ein gültiges Profil. *(testverankert)*
- **SC-418** Eingefügte Codes mit Zeilenumbrüchen werden akzeptiert; leere,
  fremde, beschädigte und nicht-JSON-Codes werfen je eine eigene deutsche
  Meldung. *(testverankert)*
- **SC-419** Der komprimierte Code ist deutlich kürzer als das rohe JSON. *(testverankert)*

## Ausdrücklich nicht enthalten

- **Der API-Schlüssel wird nicht auf der öffentlichen Seite hinterlegt.** Alles
  unter `docs/` ist öffentlich abrufbar; ein dort abgelegter Schlüssel wäre für
  jeden lesbar, unabhängig von der Zugangshürde, und würde von GitHubs
  Secret Scanning ohnehin binnen Minuten gesperrt. Auf der öffentlichen Seite
  bleibt die Eingabe im Browser der Weg (einmal je Gerät, dann gemerkt).
- Echte Zugriffskontrolle: Dafür wäre ein Server nötig, der die Seite erst nach
  Anmeldung ausliefert (z. B. Cloudflare Access) — bewusst offen gelassen.
