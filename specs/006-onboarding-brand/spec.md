# Feature 006: Einstiegserklärung, lokaler Schlüssel, Markenauftritt

**Status**: umgesetzt · **Datum**: 2026-08-26
**Basis**: Features 001–005

## Ausgangslage

Nach dem ersten echten Testlauf blieben drei Lücken: Wer die App zum ersten Mal
öffnet, sieht eine leere Profilliste ohne Erklärung; der API-Schlüssel muss bei
jedem Gerätewechsel neu im Browser hinterlegt werden; und das Erscheinungsbild
folgte einem Standard-Blau statt der Marke.

## User Scenarios

### US1 — Der erste Blick erklärt das Tool (P1)

**Akzeptanz**
1. Ohne angelegtes Profil steht über der Profilliste, wie das Tool arbeitet:
   vier Schritte von der Profildefinition bis zur Rangliste, dazu die drei
   tragenden Eigenschaften (lokal, nachvollziehbar, Online-Recherche optional).
2. Sobald ein Profil existiert, klappt die Erklärung zu einem einzeiligen
   Aufklapper zusammen — sie bleibt erreichbar, nimmt aber keinen Platz mehr.
3. Der empfohlene Einstieg (Vorlage) ist als solcher gekennzeichnet.

### US2 — Der eigene Schlüssel liegt in der `.env` (P1)

**Akzeptanz**
1. Ein Schlüssel in `.env` wird beim lokalen Start automatisch verwendet; im
   Browser ist nichts zu hinterlegen.
2. Die Schlüssel-Eingabe im Browser bleibt vollständig erhalten und ist bei
   aktiver `.env` über einen Aufklapper erreichbar — sie greift überall dort,
   wo es keinen lokalen Server gibt (z. B. GitHub Pages).
3. Der `.env`-Schlüssel wird nie in `localStorage` gespiegelt, nie exportiert und
   nie vom Service Worker zwischengespeichert.
4. `.env` ist von Git ausgeschlossen; `.env.example` dokumentiert das Format.

### US3 — Das Tool sieht aus wie die Marke (P2)

**Akzeptanz**
1. Farben, Schriften, Radien und Bewegungsregeln folgen manuelkern.com.
2. Coral trägt genau eine Rolle je Ansicht: die primäre Aktion, dazu den
   Fokus-Ring. Alles andere trägt Indigo, Navy oder Muted.
3. Schriften liegen lokal — keine externen Requests, der Offline-Kern bleibt intakt.

## Functional Requirements

- **FR-414** Die Profilübersicht zeigt eine Einstiegserklärung: offen ohne Profile,
  zusammengeklappt sobald eines existiert. Reine Anzeige, kein gespeicherter Zustand.
- **FR-415** `store.loadLocalConfig()` lädt einmalig `./__local-config`; ein dort
  gelieferter Schlüssel hat Vorrang vor dem Browser-Schlüssel. Schlägt der Abruf
  fehl (statisches Hosting, offline), gilt still der Browser-Schlüssel.
- **FR-416** `serve.mjs` liefert `docs/` aus und den `.env`-Schlüssel unter
  `/__local-config` — nur an localhost, immer `no-store`, bei jeder Anfrage neu
  aus der Datei gelesen.
- **FR-417** Das Erscheinungsbild folgt den Marken-Tokens der Website; Schriften
  werden lokal ausgeliefert.

## Success Criteria

- **SC-413** Ohne Profil erscheint die Erklärung mit allen vier Schritten; mit
  Profil nur der Aufklapper. *(visuell geprüft)*
- **SC-414** `/__local-config` antwortet nur lokal, mit `cache-control: no-store`,
  und spiegelt eine Änderung an `.env` ohne Server-Neustart. *(geprüft)*
- **SC-415** Ohne erreichbaren Endpunkt startet die App unverändert und nutzt den
  Browser-Schlüssel. *(geprüft: Smoke-Test ohne Server)*
- **SC-416** `.env` ist von Git ausgeschlossen. *(git check-ignore)*

## Nicht enthalten

- Ein Schlüssel-Weg für das Deployment auf GitHub Pages: Dort gibt es keinen
  Server, also bleibt die Eingabe im Browser der einzige Weg — bewusst so.
- Dark Mode: Die Website hat sich bewusst dagegen entschieden, das Tool folgt dem.
