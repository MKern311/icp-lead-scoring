# Feature 012: Lizenz für die Online-Recherche

**Status**: umgesetzt · **Datum**: 2026-08-31
**Basis**: Features 001–011 · **Briefing**: `BRIEFING.md` (Vorlage, in Teilen überholt —
die Abweichungen stehen unten und im Contract)

## Problem

Das Werkzeug soll verkauft werden. Bisher gab es dafür nichts: `js/gate.js` fragte ein
Zugangswort ab (Feature 007), das jeder weitergeben kann und das mit einer Zahlung nichts
zu tun hat. Die Adresse war eine kostenlose GitHub-Pages-URL.

Gebraucht wird das Kleinstmögliche: Beim Kauf entsteht ein Lizenzschlüssel, er lässt sich
auf **zwei** Geräten aktivieren, und vor einer Online-Recherche wird geprüft, ob eine
Lizenz vorliegt. Kein Konto, kein Login, kein Abo — der Schlüssel *ist* der Zugang.

Der Prüfpunkt liegt bewusst **nur** vor der Online-Recherche. Genau dort ist das Werkzeug
ohnehin am Netz; alles andere (Profile, Leads, Bewertung, CSV, Sicherung) bleibt offline
und lizenzfrei. Die Verfassung wurde dafür auf **v3.0.0** amendiert.

## User Scenarios

### US1 — Kaufen und den Schlüssel bekommen (P1)

**Akzeptanz**
1. Eine abgeschlossene Stripe-Zahlung erzeugt genau **eine** Lizenz und schickt den
   Schlüssel per E-Mail an die im Kauf angegebene Adresse.
2. Stripe stellt Webhooks mehrfach zu — eine Wiederholung erzeugt **keine** zweite Lizenz.
3. Zahlungen, die noch nicht bestätigt sind (`payment_status: "unpaid"` bei SEPA, Sofort,
   Klarna), erzeugen **keine** Lizenz und keine E-Mail.
4. Eine Anfrage ohne gültige Stripe-Signatur wird abgewiesen, bevor irgendetwas angelegt
   oder eine Event-Kennung verbraucht wird.

### US2 — Auf zwei Geräten aktivieren (P1)

**Akzeptanz**
1. Schlüssel eintragen gibt die Online-Recherche frei; Groß-/Kleinschreibung, fehlende
   Bindestriche und die Verwechslungszeichen `O`/`0` und `I`/`L`/`1` werden verziehen.
2. Ein zweites Gerät lässt sich ebenso aktivieren.
3. Dasselbe Gerät erneut zu aktivieren verbraucht **nie** einen zweiten Platz.
4. Ein drittes Gerät wird abgewiesen — mit einer Meldung, die **beide** belegten Geräte
   samt Datum nennt und auf die Kontaktadresse verweist.
5. Ein unbekannter Schlüssel und eine gesperrte Lizenz führen zu unterschiedlichen,
   verständlichen deutschen Meldungen.
6. Nach 30 Tagen erneuert sich die Freigabe still — wer das Werkzeug nutzt, merkt vom
   Ablauf nichts.

### US3 — Ohne Lizenz weiterarbeiten (P1)

**Akzeptanz**
1. Ohne Lizenz bleiben Profile anlegen und ändern, Leads erfassen, Bewertung, Rangliste,
   CSV-Import, CSV-Export, Profil-Export, Profil-Code und Sicherung **vollständig**
   nutzbar.
2. Auch bei **abgelaufener oder gesperrter** Lizenz funktionieren Export und Sicherung.
   Daten werden nie als Geisel genommen.
3. Nur die beiden Recherche-Läufe (Longlist, Tiefen-Screening) sind gesperrt; der Grund
   steht im Schritt selbst, nicht in einer Fehlermeldung nach dem Klick.

### US4 — Netzfehler halten nichts an (P1)

**Akzeptanz**
1. Ist der Lizenzdienst nicht erreichbar oder antwortet er zu langsam (> 3 s), läuft die
   Recherche mit dem vorhandenen Freigabe-Merkmal weiter.
2. Antwortet er mit einem Serverfehler, ebenso.
3. Nur eine **eindeutige** Absage (`unbekannt`, `gesperrt`, `ungültig`) hält die Recherche
   an.

### US5 — Lizenzen verwalten (P2)

**Akzeptanz**
1. Eine Liste aller Lizenzen ist über einen Bearer-Token abrufbar, mit Schlüssel im
   Klartext (Kunden verlieren ihn — das ist der häufigste Supportfall).
2. Gerätebindungen lassen sich zurücksetzen; danach gelingt die Aktivierung wieder.
3. Eine Lizenz lässt sich sperren; die nächste Recherche wird angehalten.

## Anforderungen

**FR-1201**: Der Lizenzdienst erzeugt bei bestätigter Zahlung genau eine Lizenz je
Stripe-Event und versendet den Schlüssel per E-Mail.

**FR-1202**: `/v1/activate` folgt der Vier-Zweig-Regel in genau dieser Reihenfolge
(unbekannt → gesperrt → bereits gebunden → freier Platz → voll) und bindet niemals mehr
als `max_devices` Geräte, auch nicht bei gleichzeitigen Anfragen.

**FR-1203**: `/v1/verify` prüft bis in die Datenbank — Signatur, Ablauf, Lizenzstatus und
Gerätebindung — und gibt bei Erfolg ein frisches Freigabe-Merkmal zurück.

**FR-1204**: Das Werkzeug prüft die Lizenz ausschließlich vor `startLonglist` und
`runDeepLoop`. Jede andere Funktion bleibt unberührt.

**FR-1205**: Die Prüfung ist **fail-open**: nur eine eindeutige Absage hält an.

**FR-1206**: Lizenzschlüssel, Freigabe-Merkmal und Gerätekennung erscheinen nie in
Profil-Export, Profil-Code oder Sicherung.

**FR-1207**: Das Zugangswort aus Feature 007 entfällt ersatzlos.

## Regeln (verbindlich)

Schlüsselformat, Merkmalsformat, Vier-Zweig-Regel, Statuscodes und die Fail-open-Tabelle
stehen in `contracts/licence.md` und sind dort zuerst zu ändern.

- `docs/js/core/licence.js` ist pure und DOM-frei; nur diese Ebene wird getestet.
- `normaliseKey` existiert **zweimal** — hier und im Lizenzdienst. Beide Testdateien
  tragen dieselbe Fallvektor-Tabelle wortgleich (Contract, Regel 2).
- Die CORS-Kopfzeile steht auch auf jeder Fehlerantwort. Ohne sie kann das Werkzeug
  „gesperrt" nicht von „offline" unterscheiden und lässt fälschlich laufen
  (Contract, Regel 10).

## Abweichungen vom Briefing

Das Briefing ist die Vorlage, nicht die Wahrheit. Sechs Punkte weichen ab:

1. **Keine Laufzeit-Abhängigkeiten.** Die Signaturprüfung ist aus dem GEO-Projekt
   portiert (Toleranzfenster, `timingSafeEqual`) statt aus dem `stripe`-SDK übernommen —
   und dabei um einen Fehler dort bereinigt: mehrere `v1=`-Werte im Kopf, was Stripe
   **während einer Geheimnis-Rotation** schickt, werden alle geprüft. Auch `pg` entfällt,
   siehe Punkt 6.
2. **`STRIPE_SECRET_KEY` entfällt.** Der Dienst ruft die Stripe-API nie auf; er prüft nur
   eingehende Webhooks, und `customer_details` steht bereits im Event.
3. **`SUPPORT_EMAIL` und `APP_URL` kommen hinzu.** Die 409-Meldung braucht eine
   Kontaktadresse, die E-Mail einen Verweis auf das Werkzeug.
4. **Die Architektur-Skizze („Token in localStorage, danach kein Serverkontakt mehr")
   gilt nicht.** Sie widerspricht der Endpunkt-Tabelle desselben Dokuments. Es gilt: ein
   `/v1/verify` je Recherche-Lauf, 3 s Zeitlimit, fail-open. Ohne das hätten Sperren und
   Gerätereset bis zu 30 Tage lang keine Wirkung.
5. **Der Schlüssel liegt zusätzlich lokal** (`icp.v1.licencekey`), damit sich die Freigabe
   nach 30 Tagen still erneuern kann. Sonst stünde jeder zahlende Kunde am 31. Tag vor
   einer Eingabemaske.
6. **Cloudflare Worker + D1 statt Render + Postgres.** Das Briefing sah einen Web-Dienst
   und eine eigene Datenbank auf Render vor, rund 13 $ im Monat. Für ein paar Dutzend
   Anfragen am Tag und ein paar hundert Zeilen ist das nicht zu rechtfertigen — Workers
   und D1 decken das Hundertfache im **kostenlosen** Rahmen ab, kennen keine Kaltstarts
   und bieten Wiederherstellung auf jeden Zeitpunkt der letzten 30 Tage (das Briefing
   hatte die täglichen Sicherungen ausdrücklich als Grund für Postgres genannt).
   Der getestete Kern blieb dabei unverändert: `nodejs_compat` deckt `node:crypto`
   vollständig ab. Statt `SELECT … FOR UPDATE` sichert eine **atomare bedingte
   Einfüge-Anweisung** die Platzvergabe — testverankert.

## Ausdrücklich nicht enthalten

- **Kein Kopierschutz.** Die Prüfung läuft im Browser, alles unter `docs/` ist öffentlich
  abrufbar, und fail-open plus Service Worker heißt: ein kopierter Ordner funktioniert
  offline weiter. Der Schlüssel ist eine **Zahlungskonvention**. Wer sie umgeht, spart die
  Lizenz und zahlt weiterhin seinen eigenen Anthropic-Schlüssel. Jeder Versuch, das zu
  „härten", verletzt den Offline-Kern (Verfassung III/IV) — das ist der Grund, warum es
  hier steht.
- **Kein Nutzerkonto, kein Login, kein Passwort.** Der Schlüssel ist der Zugang.
- **Kein Abo, keine Verlängerung, keine Abrechnung nach Verbrauch.** Einmalzahlung. Die
  30 Tage des Freigabe-Merkmals sind eine **Zwischenspeicherfrist**, keine Lizenzdauer.
- **Kein Weiterleiten von Recherchen über den Server.** Das Werkzeug spricht weiterhin
  direkt mit Anthropic, mit dem Schlüssel des Kunden. Der Lizenzdienst sieht nie ein
  Kriterium, nie einen Lead, nie den API-Schlüssel.
- **Keine Ratenbegrenzung.** Ein 60-Bit-Schlüssel ist nicht zu erraten; eine Flut kostet
  nur Rechenzeit. Bewusst weggelassen, damit es später nicht als „Lücke" gilt.
- **Keine Admin-Oberfläche.** Drei `curl`-Aufrufe genügen, sie stehen in der README des
  Lizenzdienstes.
- **Keine Personalisierung der Auslieferung.** Alle bekommen dieselbe gehostete Fassung
  unter `icp.manuelkern.com`; es gibt keinen Einzeldatei-Build und keinen Build-Schritt.
