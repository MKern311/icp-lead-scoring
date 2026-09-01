# Contract: Lizenz (`docs/js/core/licence.js` und Dienst `icp-licence`)

**Verbindlich.** Änderungen erfordern angepasste Tests **in beiden Repos**.
Der Dienst liegt in `/Users/manuelkern/Claude/50_dev/icp-licence`.

## Pure API im Werkzeug (`docs/js/core/licence.js` — getestet)

```js
normaliseKey(input) → 'ICP-XXXX-XXXX-XXXX' | null   // Crockford-Faltung
tokenPayload(token) → { licenceId, deviceId, exp } | null   // dekodiert, prüft NICHT
isTokenValid(token, nowMs) → boolean                // nur exp
deviceLabelFrom(userAgent) → 'Chrome auf macOS'     // ≤ 80 Zeichen
activationErrorText(status, body) → string          // deutscher Satz je Statuscode
runVerdict(outcome) → 'pass' | 'block' | 'renew'    // die Fail-open-Regel
```

Alle DOM-frei, netzfrei und ohne Zufall. `tokenPayload` prüft bewusst **keine Signatur** —
der Browser hat das Geheimnis nicht und darf es nie haben.

## Pure API im Dienst (`src/core/` — getestet)

```js
generateKey(randomBytes?) → 'ICP-XXXX-XXXX-XXXX'
normaliseKey(input) → 'ICP-XXXX-XXXX-XXXX' | null     // wortgleich zum Werkzeug
signToken({ licenceId, deviceId, exp }, secret) → string
verifyToken(token, secret, nowSec) → { ok, payload? , reason? }
activationDecision({ licence, devices, deviceId }) → Entscheidung   // Vier-Zweig-Regel
verifyStripeSignature({ payload, header, secret, toleranceSec?, nowSec? }) → boolean
parseStripeEvent(raw) → { id, type, email, name, paymentStatus }
isPaidCheckout(paymentStatus) → boolean
licenceEmail({ key, name, appUrl, supportEmail }) → { subject, text, html }
```

## Schlüsselformat

```
ICP-XXXX-XXXX-XXXX
Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ      (Crockford-Base32 — ohne I, L, O, U)
```

## Merkmalsformat (Token)

```
base64url(JSON({ l: licenceId, d: deviceId, exp })) + "." + base64url(HMAC-SHA256)
exp: Unix-Sekunden · Laufzeit 30 Tage · kein iat
```

## Regeln

1. **Schlüsselerzeugung.** `crypto.randomBytes(12)`, je Byte `& 31` als Index ins
   Alphabet. Weil 32 die 256 teilt, ist das ohne Verwerfen gleichverteilt — 60 Bit
   Entropie, keine Base32-Bibliothek. Das Briefing nannte `randomBytes(10)`; das Ergebnis
   ist gleichwertig, dieser Weg kürzer.
2. **Normalisierung faltet.** Genau dafür wurde Crockford gewählt: Großschreibung, alles
   Nicht-Alphanumerische entfernen, `O`→`0`, `I`→`1`, `L`→`1`; `U` bleibt ungültig. Ein
   optionales `ICP`-Präfix wird geschluckt. Zwölf gültige Zeichen ergeben den kanonischen
   Schlüssel, alles andere `null` — **nie** eine Ausnahme.
   Die Funktion existiert **zweimal** (Dienst und Werkzeug, getrennte Repos ohne
   gemeinsame Abhängigkeit). Beide Testdateien tragen **dieselbe Fallvektor-Tabelle
   wortgleich** samt Querverweis. Auseinanderlaufen hieße: ein vertippter Kundenschlüssel
   wird an einer Stelle angenommen, an der anderen abgelehnt.
3. **Merkmal prüfen.** Am **einzigen** `.` trennen → HMAC über das Nutzlast-Segment **wie
   empfangen** neu berechnen → **Längenprüfung vor `timingSafeEqual`** (das wirft bei
   ungleicher Länge) → erst dann dekodieren und `JSON.parse`. `signToken` ist
   deterministisch (kein `iat`), damit Tests Strings vergleichen können.
4. **Vier-Zweig-Regel für `/v1/activate`** — genau diese Reihenfolge:

   | # | Bedingung | Antwort |
   |---|---|---|
   | 1a | Schlüssel unbekannt | `404 {error:'unknown_key'}` |
   | 1b | `status = 'revoked'` | `403 {error:'revoked'}` |
   | 2 | `(licence_id, device_id)` existiert | `200` — `last_seen` setzen, Merkmal ausgeben |
   | 3 | weniger als `max_devices` gebunden | `200` — binden, Merkmal ausgeben |
   | 4 | sonst | `409 {error:'device_limit', message, devices}` |

   **Die Reihenfolge trägt.** Gesperrt schlägt bereits-gebunden: eine gesperrte Lizenz,
   deren Gerät schon eingetragen ist, liefert `403` — kein Merkmal. Testverankert.

   **Zweig 2 ist idempotent.** Dasselbe Gerät erneut zu aktivieren verbraucht **nie**
   einen zweiten Platz — auch dann nicht, wenn beide Plätze belegt sind. Testverankert.

   **Zweig 3 wird atomar geschrieben.** Zwei gleichzeitige Anfragen dürfen niemals
   beide „ein Gerät" lesen und ein drittes binden. Statt einer Zeilensperre steckt die
   Bedingung **in der Einfüge-Anweisung selbst** — damit gibt es gar keinen Zeitraum
   zwischen Zählen und Schreiben:

   ```sql
   INSERT INTO device (licence_id, device_id, label, first_seen, last_seen)
   SELECT ?, ?, ?, <now>, <now>
    WHERE (SELECT count(*) FROM device WHERE licence_id = ?)
        < (SELECT max_devices FROM licence WHERE id = ?)
   ```

   Kommen null geänderte Zeilen zurück, hat eine gleichzeitige Aktivierung den letzten
   Platz genommen: Geräte frisch lesen und mit Zweig 4 antworten. Testverankert —
   drei gleichzeitige Aktivierungen binden genau zwei Geräte.

   Zweig 4 nennt beide Geräte mit Bezeichnung und `last_seen` („Chrome auf macOS, zuletzt
   am 14.08.") und verweist auf `SUPPORT_EMAIL`. Ein Gerät ohne Bezeichnung heißt
   „Unbekanntes Gerät". `max_devices` ist datengetrieben, nie fest verdrahtet.
5. **Prüfung geht bis in die Datenbank.** `/v1/verify`: Signatur → `exp` → Lizenz
   existiert und ist `active` → `(licence_id, device_id)` noch gebunden → `last_seen`
   setzen → **frisches Merkmal zurückgeben** (stille Erneuerung). Nur HMAC zu prüfen hieße,
   dass Sperre und Gerätereset bis zu 30 Tage wirkungslos bleiben — und damit fiele die
   Begründung für den Reset-Endpunkt in sich zusammen.
   Bei wohlgeformter Anfrage immer **HTTP 200**; `ok:false` ist eine fachliche Antwort,
   kein HTTP-Fehler. Genau diese Trennung macht Regel 6 implementierbar.
   Gründe: `invalid | expired | revoked | unknown`.
6. **Fail-open** (`runVerdict`) — die Tabelle ist verbindlich:

   | Antwort des Dienstes | Urteil |
   |---|---|
   | `200 {ok:true}` | `pass` |
   | `200 {ok:false, reason:'revoked'\|'unknown'\|'invalid'}` | `block` |
   | `200 {ok:false, reason:'expired'}` | `renew` |
   | `200 {ok:false, …}` mit jedem anderen Grund | `block` |
   | `500`, `502`, `503`, Netzfehler, Zeitüberschreitung (3 s), unlesbarer Körper | `pass` |
   | jede sonstige Antwort, auch `400` | `pass` |

   Kurzform: **nur** `HTTP 200` mit `ok: false` hält an. Alles andere lässt laufen.

   `renew` löst eine stille Neuaktivierung mit dem lokal hinterlegten Schlüssel aus — das
   trifft Zweig 2 und verbraucht keinen Geräteplatz.

   Bei `block` wirft das Werkzeug das Merkmal weg, **behält aber den Schlüssel** und
   versucht einmal neu zu aktivieren. Grund: `unknown` bedeutet oft nur zurückgesetzte
   Geräte, `invalid` ein gewechseltes `TOKEN_SECRET` — in beiden Fällen ist der Schlüssel
   weiterhin gültig und der neue Anlauf gelingt. Scheitert auch er, trägt seine Meldung
   den wahren Grund (etwa „Diese Lizenz ist gesperrt").
7. **Prüfpunkt.** Ausschließlich am Kopf von `startLonglist` und `runDeepLoop` in
   `docs/js/ui/workflow.js`. Das sind die einzigen zwei Aufrufer von `runScreening` im
   ganzen `docs/js/`; `startLonglist` deckt damit auch die Nachsuche ab, die den
   Knopf-Handler umgeht. Nirgends sonst wird geprüft.
8. **Webhook.** Rohkörper nehmen (`await request.text()` — genau die Bytes, wie sie
   ankamen; **nie** über `JSON.parse`/`stringify`, weil Schlüsselreihenfolge und
   Leerzeichen abwichen und jede Signatur fehlschlüge) → **Signatur prüfen** →
   **dann** Idempotenz. Andernfalls verbrennen unsignierte Anfragen fremde
   Event-Kennungen. Nur `checkout.session.completed` **und** `payment_status ∈ {paid,
   no_payment_required}` erzeugen eine Lizenz; alles andere wird mit `200 {received:true}`
   quittiert, damit Stripe nicht endlos wiederholt.
   Einfügen mit `ON CONFLICT (stripe_event) DO UPDATE … RETURNING *` — `DO NOTHING` gäbe
   keine Zeile zurück, und eine Wiederholung nach einem Mail-Fehler täte still gar nichts.
   Mail-Fehler → **500**, damit Stripe wiederholt. Bewusst hingenommen: eventuell zwei
   Mails. Das kleinere Übel gegenüber einem fehlenden Schlüssel.
9. **Laufzeit.** Der Dienst ist ein Cloudflare Worker mit D1 (SQLite am Rand) und hat
   **keine** Laufzeit-Abhängigkeiten. `src/core/` bleibt reines JavaScript und läuft
   unverändert unter Node (`node --test`) wie im Worker — `nodejs_compat` deckt
   `node:crypto` vollständig ab. Zeitstempel werden als ISO 8601 mit `Z` abgelegt
   (`strftime('%Y-%m-%dT%H:%M:%SZ','now')`), nie im SQLite-Standardformat: `new Date(…)`
   läse `'YYYY-MM-DD HH:MM:SS'` je nach Umgebung als Ortszeit.
10. **CORS-Kopfzeile auch auf Fehlerantworten** (400/403/404/409/500), gesetzt an **einer**
   Stelle in `sendJson`. Fehlt sie, verbirgt der Browser den Antwortkörper, `fetch` wirft
   einen generischen `TypeError`, das Werkzeug hält das für einen Netzfehler und lässt die
   Recherche nach Regel 6 fälschlich laufen. Das ist der wahrscheinlichste Weg, dieses
   Design zu zerbrechen.
   `ALLOWED_ORIGIN` ist eine Komma-Liste; der `Origin` wird nur zurückgespiegelt, wenn er
   darin steht. Fehlender `Origin` (curl, Stripe) → Kopfzeile weglassen, **nicht**
   ablehnen. Nie `Allow-Credentials`. Webhook und Admin bekommen gar keine CORS-Kopfzeilen.
   CORS ist hier Browser-Formalie, kein Schutz — das Merkmal schützt.
11. **Nichts davon gehört in einen Export.** Lizenzschlüssel (`icp.v1.licencekey`),
    Merkmal (`icp.v1.licence`) und Gerätekennung (`icp.v1.device`) erscheinen nie in
    Profil-Export, Profil-Code oder Sicherung (testverankert, wie beim API-Schlüssel).

## Statuscodes

| Route | Code | Bedingung |
|---|---|---|
| `POST /v1/stripe/webhook` | 400 | Signatur fehlt, ist missgestaltet oder falsch; Körper > 1 MiB |
| | 200 `{received:true}` | Signatur gültig, aber falscher Event-Typ oder nicht bezahlt |
| | 200 `{ok:true}` | Lizenz angelegt (oder per Idempotenz gefunden) und Mail versandt |
| | 500 | Datenbank- oder Mail-Fehler — **gewollt**, damit Stripe wiederholt |
| `POST /v1/activate` | 400 | `key` normalisiert zu `null`, `deviceId` nicht 1–64 Zeichen, `label` > 80 |
| | 404 / 403 / 200 / 409 | Vier-Zweig-Regel, siehe Regel 4 |
| `POST /v1/verify` | 400 | `token` fehlt oder ist kein String |
| | 200 | fachliche Antwort, siehe Regel 5 |
| | 500 | Datenbankfehler → das Werkzeug öffnet (Regel 6) |
| `GET /healthz` | 200 | schlichtes `ok`, ohne Datenbankrunde |
| `/admin/*` | 401 | Bearer fehlt oder passt nicht (`timingSafeEqual` nach Längenprüfung) |
| | 404 | unbekannte Lizenz-ID |
| bekannter Pfad, falsche Methode | 405 + `Allow:` | |
| unbekannter Pfad | 404 `{error:'not_found'}` | |

Alle JSON-Antworten: `content-type: application/json; charset=utf-8`,
`cache-control: no-store`. Ein Fehlerfangnetz je Anfrage protokolliert `err.stack`
serverseitig und antwortet mit `{error:'internal'}` — **nie** ein Stacktrace nach außen.

## Speicherorte im Werkzeug

| Schlüssel | Inhalt |
|---|---|
| `icp.v1.device` | Gerätekennung, einmalig `crypto.randomUUID()` |
| `icp.v1.licence` | Freigabe-Merkmal (Token) |
| `icp.v1.licencekey` | Lizenzschlüssel im Klartext, für die stille Erneuerung |

Alle drei über `docs/js/store.js`, wie jede andere Persistenz auch.
