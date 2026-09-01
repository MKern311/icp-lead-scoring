# Feature 012: Lizenzserver für den ICP-Agenten

**Status**: geplant · **Datum**: 2026-08-31
**Zweck**: Beim Kauf wird ein Lizenzschlüssel vergeben. Er lässt sich auf **zwei**
Geräten aktivieren. Mehr nicht.

Dieses Dokument ist die Startvorlage für eine eigene Session. Es beschreibt einen
neuen, eigenständigen Dienst — **nicht** eine Erweiterung des GEO Optimizers.

---

## 1. Umfang

**Enthalten**
- Neues Render-Projekt: ein Web-Dienst + eine Postgres-Datenbank
- Stripe-Zahlung → Webhook → Lizenzschlüssel erzeugen → per E-Mail versenden
- Aktivierung: Schlüssel + Gerätekennung → Freigabe, maximal zwei Geräte je Schlüssel
- Prüfung im ICP-Werkzeug, **nur** vor einer Online-Recherche
- Minimaler Admin-Zugriff: Lizenzen auflisten, Geräte zurücksetzen, Lizenz sperren

**Nicht enthalten** — bewusst nicht bauen, auch wenn es naheliegt
- Kein Nutzerkonto, kein Login, kein Passwort. Der Schlüssel *ist* der Zugang.
- Keine Abrechnung nach Verbrauch, keine Verlängerung, kein Abo. Einmalzahlung.
- Kein Weiterleiten von Recherchen über den Server. Das Werkzeug spricht weiterhin
  direkt mit Anthropic, mit dem Schlüssel des Kunden.
- Keine Personalisierung der Datei, kein Einzeldatei-Build. Ausgeliefert wird die
  gehostete Fassung unter einer eigenen Adresse.
- Keine Admin-Oberfläche. Zwei `curl`-Aufrufe genügen.

---

## 2. Architektur

```
Kunde ──Stripe Payment Link──▶ Stripe
                                 │  checkout.session.completed
                                 ▼
                      icp-licence (Render Web Service)
                                 │  Lizenz anlegen
                                 ├──▶ Postgres
                                 └──▶ Resend ──▶ E-Mail mit Schlüssel

ICP-Werkzeug (GitHub Pages) ──POST /v1/activate──▶ icp-licence
        │                       { key, deviceId }
        └── Token in localStorage, danach kein Serverkontakt mehr
```

**Neues Repo**: `/Users/manuelkern/Claude/50_dev/icp-licence`

**Warum ein eigener Dienst und nicht in GEO hinein**: GEO hat Workspaces, Nutzer,
Queue und Worker — der Lizenzserver braucht nichts davon. Ein Datenmodell mit zwei
Tabellen in einer fremden Prisma-Schemadatei zu ergänzen, koppelt zwei Produkte
aneinander, die nichts miteinander zu tun haben. Getrennt bleibt jedes für sich
verständlich und einzeln abschaltbar.

---

## 3. Technik

- **Node ≥ 22**, `node:http` direkt, kein Framework
- **Abhängigkeiten: genau zwei** — `stripe` (Signaturprüfung des Webhooks; hier
  nicht selbst bauen, die Prüfung hat Zeitfenster und Timing-Fallen) und `pg`.
  Resend wird per `fetch` angesprochen, Schlüssel und Token über `node:crypto`.
- **Kein ORM, kein Migrationswerkzeug.** Eine `schema.sql` mit
  `CREATE TABLE IF NOT EXISTS`, beim Start ausgeführt.
- **Tests**: `node --test tests/*.test.js`. Getestet wird die reine Logik —
  Schlüsselerzeugung, Geräteregel, Tokensignatur. Kein Test gegen die Datenbank.

### Datenmodell

```sql
CREATE TABLE IF NOT EXISTS licence (
  id            TEXT PRIMARY KEY,           -- uuid
  key           TEXT UNIQUE NOT NULL,       -- ICP-XXXX-XXXX-XXXX, im Klartext
  email         TEXT NOT NULL,
  name          TEXT,
  stripe_event  TEXT UNIQUE,                -- Idempotenz: Stripe wiederholt Webhooks
  max_devices   INTEGER NOT NULL DEFAULT 2,
  status        TEXT NOT NULL DEFAULT 'active',   -- active | revoked
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device (
  licence_id  TEXT NOT NULL REFERENCES licence(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL,                -- vom Browser erzeugte uuid
  label       TEXT,                         -- z. B. "Chrome auf macOS"
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (licence_id, device_id)
);
```

Der Schlüssel liegt **im Klartext**, nicht als Hash. Begründung: Kunden verlieren
ihn, und „ich kann Ihnen den Schlüssel nicht erneut schicken" ist ein garantierter
Supportfall. Ein Datenbankleck kostet hier entgangenen Umsatz, keine fremden
Zugangsdaten — der API-Schlüssel des Kunden liegt nie auf dem Server.

`stripe_event UNIQUE` ist die Idempotenz: Stripe stellt Webhooks mehrfach zu, ohne
diesen Index entstünden mehrere Lizenzen für einen Kauf.

### Schlüsselformat

`ICP-XXXX-XXXX-XXXX`, Crockford-Base32 (ohne I, L, O, U — keine Verwechslung
zwischen 0/O und 1/I beim Abtippen), aus `crypto.randomBytes(10)`. Beim Prüfen
Groß-/Kleinschreibung und Bindestriche normalisieren.

### Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/v1/stripe/webhook` | Rohkörper prüfen, Lizenz anlegen, E-Mail senden |
| `POST` | `/v1/activate` | `{ key, deviceId, label }` → `{ token, exp }` |
| `POST` | `/v1/verify` | `{ token }` → `{ ok }` oder `{ ok: false, reason }` |
| `GET`  | `/healthz` | Render-Health-Check |
| `GET`  | `/admin/licences` | Liste, hinter `ADMIN_TOKEN` als Bearer |
| `POST` | `/admin/licences/:id/reset-devices` | Gerätebindungen löschen |
| `POST` | `/admin/licences/:id/revoke` | `status = 'revoked'` |

**Regel für `/v1/activate`** — genau diese Reihenfolge:
1. Schlüssel unbekannt oder `status = 'revoked'` → `404` bzw. `403`
2. `(licence_id, device_id)` existiert bereits → `last_seen` setzen, Token
   ausgeben. **Idempotent** — eine erneute Aktivierung desselben Geräts darf
   niemals einen zweiten Platz verbrauchen.
3. Weniger als `max_devices` Geräte gebunden → binden, Token ausgeben
4. Sonst → `409` mit einer Meldung, die die beiden belegten Geräte nennt
   („Chrome auf macOS, zuletzt am 14.08.") und auf die Kontaktadresse verweist

Das Zurücksetzen der Geräte ist **kein** überflüssiger Luxus: Wer den Browser
wechselt, den Speicher leert oder einen neuen Rechner bekommt, verbraucht einen
Platz. Ohne diesen Endpunkt endet der zweite Laptop in einer Sackgasse.

### Token

HMAC-SHA256 über `{ licenceId, deviceId, exp }` mit `TOKEN_SECRET`, Laufzeit
30 Tage, als `base64url(payload).signatur`. Das Werkzeug legt ihn in
`localStorage` unter `icp.v1.licence` ab.

---

## 4. Änderungen im ICP-Werkzeug

Kleiner Umfang, eine neue Datei plus zwei Berührungspunkte:

- **`docs/js/licence.js`** (neu): Gerätekennung (`crypto.randomUUID()`, einmalig
  in `icp.v1.device`), Token lesen/schreiben, `activate(key)`, `hasValidLicence()`
- **`docs/js/ui/workflow.js`**: vor `data-action="start"` (Longlist) und
  `data-deep="start"` prüfen; ohne gültigen Token einen Aktivierungsdialog
  zeigen statt der Recherche
- **`docs/sw.js`**: Cache-Version erhöhen, `./js/licence.js` in `ASSETS`

**Drei Regeln, die nicht verhandelbar sind:**

1. **Die Prüfung sitzt nur vor der Online-Recherche.** Profile anlegen, Leads
   pflegen, bewerten, CSV und Sicherung — alles bleibt ohne Lizenz nutzbar. Der
   Prüfpunkt liegt damit genau dort, wo das Werkzeug ohnehin online ist; das
   Offline-Versprechen des Rests bleibt unangetastet.
2. **Daten werden nie als Geisel genommen.** Export und Sicherung funktionieren
   auch bei abgelaufener oder gesperrter Lizenz. Immer.
3. **Netzfehler blockieren nicht.** Nur eine eindeutige Antwort des Servers
   (`unbekannt`, `gesperrt`, `Gerätezahl erreicht`) hält die Recherche an. Ist der
   Server nicht erreichbar, gilt der vorhandene Token weiter.

**CORS**: `ALLOWED_ORIGIN` auf die Adresse der ausgelieferten Fassung setzen.
CORS ist hier keine Schutzmaßnahme, sondern nur Browser-Formalität — die
Absicherung leistet der Token.

---

## 5. Umgebungsvariablen

```
DATABASE_URL              # von Render gesetzt
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
MAIL_FROM                 # z. B. "ICP-Agent <lizenz@manuelkern.com>"
TOKEN_SECRET              # openssl rand -hex 32
ADMIN_TOKEN               # openssl rand -hex 32
ALLOWED_ORIGIN
```

## 6. Render

`render.yaml` mit zwei Diensten in Frankfurt:
- `icp-licence-web` — Web Service, Node, Starter
- `icp-licence-db` — Postgres, basic-256mb

Laufende Kosten rund 13 $ im Monat (Tarife vor dem Anlegen in der Render-Konsole
gegenprüfen). Günstigere Variante: SQLite auf einer Render-Festplatte statt
Postgres, rund 7 $ — spart aber die täglichen Sicherungen, die bei einer
Lizenzdatenbank den Aufpreis wert sind.

---

## 7. Offene Entscheidungen

| Frage | Vorschlag | Blockiert den Start? |
|---|---|---|
| Preis | einmalig, Betrag festlegen | nein, Platzhalter genügt |
| Stripe direkt oder Merchant of Record | Stripe, wie bei GEO — Umsatzsteuer-OSS ist dort schon geklärt | nein |
| Kaufstrecke | **Stripe Payment Link**, keine eigene Checkout-Route | nein |
| Adresse der Auslieferung | Unterverzeichnis auf manuelkern.com oder eigene Domain | vor dem Setzen von `ALLOWED_ORIGIN` |

Ein Stripe Payment Link spart die gesamte Kaufstrecke: kein Checkout-Endpunkt,
keine Preis-Logik im Code. Der Webhook allein genügt.

---

## 8. Einstieg in die neue Session

> Lies `specs/012-licence/BRIEFING.md` im Repo `icp-lead-scoring`. Lege das neue
> Projekt unter `/Users/manuelkern/Claude/50_dev/icp-licence` an und baue den
> Lizenzserver wie dort beschrieben. Halte dich an den Abschnitt „Nicht
> enthalten". Beginne mit `schema.sql`, der reinen Logik samt Tests und dem
> Webhook; die Aktivierung danach, die Anbindung im Werkzeug zuletzt.

Reihenfolge, jeder Schritt für sich prüfbar:
1. Repo, `schema.sql`, reine Logik (Schlüssel, Geräteregel, Token) **mit Tests**
2. Webhook, mit Stripes CLI lokal gegengeprüft
3. `/v1/activate` und `/v1/verify`
4. Auf Render bringen, echten Testkauf im Stripe-Testmodus durchführen
5. `docs/js/licence.js` und der Dialog im Werkzeug
6. Admin-Endpunkte
