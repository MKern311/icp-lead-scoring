# Tasks: Lizenz für die Online-Recherche

**Input**: specs/012-licence/ (BRIEFING.md, spec.md, contracts/licence.md)
**Zwei Repos**: [S] = `50_dev/icp-licence` (neu) · [W] = `50_dev/icp-lead-scoring`

## Phase 1: Verfassung & Spezifikation

- [X] T1201 [W] `.specify/memory/constitution.md` → v3.0.0 (Sync-Impact-Report,
      Lizenz-Ausnahme in III, Backend-Satz in IV ersetzt, Export-Constraint erweitert)
- [X] T1202 [W] `specs/012-licence/spec.md`, `contracts/licence.md`, `tasks.md`
- [X] T1203 [P] [W] `specs/007-editing-sharing-access/spec.md`: Zugangswort als abgelöst

## Phase 2: Lizenzdienst — Gerüst und reine Logik (testgetrieben)

- [X] T1204 [S] Repo-Gerüst: `package.json`, `.gitignore`, `.env.example`, `schema.sql`
- [X] T1205 [P] [S] `tests/key.test.js` → `src/core/key.js`
- [X] T1206 [P] [S] `tests/token.test.js` → `src/core/token.js`
- [X] T1207 [P] [S] `tests/devices.test.js` → `src/core/devices.js`
- [X] T1208 [P] [S] `tests/stripe.test.js` → `src/core/stripe.js` (mehrere `v1=`)
- [X] T1209 [P] [S] `tests/mail-templates.test.js` → `src/core/mail-templates.js`
- [X] T1210 [S] `node --test tests/*.test.js` grün

## Phase 3: Lizenzdienst — HTTP-Schicht

- [X] T1211 [S] `src/config.js` (Env beim Start hart prüfen) und `src/http.js`
      (`readBody` als Buffer, `sendJson` setzt CORS auch auf Fehlerantworten, Preflight)
- [X] T1212 [S] `src/db.js`: Pool, `schema.sql` beim Start, `withTransaction`
- [X] T1213 [S] `src/mail.js`: Resend per `fetch`, Konsolen-Fallback ohne Schlüssel
- [X] T1214 [S] `src/routes/webhook.js` (Signatur → `payment_status` → Upsert → Mail)
- [X] T1215 [S] `src/routes/activate.js` (`FOR UPDATE`) und `src/routes/verify.js`
- [X] T1216 [S] `src/routes/admin.js` (Liste, `reset-devices`, `revoke`)
- [X] T1217 [S] `src/index.js`: Routing, `/healthz`, Fehlerfangnetz

## Phase 4: Lizenzdienst — Auslieferung

- [X] T1218 [S] `wrangler.toml` (D1-Bindung, `nodejs_compat`, Custom Domain, `[vars]`),
      `.dev.vars.example`, `schema.sql` im SQLite-Dialekt
- [X] T1219 [P] [S] `README.md` und `CLAUDE.md` (Betrieb, drei `curl`-Rezepte)

## Phase 5: Werkzeug — reine Logik und Speicher (testgetrieben)

- [X] T1220 [W] `tests/licence.test.js` → `docs/js/core/licence.js`
- [X] T1221 [W] `docs/js/store.js`: Gerätekennung, Merkmal, Schlüssel, `licenceApiBase`
- [X] T1222 [W] `docs/js/licence.js`: `activate`, `verify`, `ensureLicence`, `licenceState`
- [X] T1223 [P] [W] `serve.mjs` + `.env.example`: `LICENCE_API` durchreichen

## Phase 6: Werkzeug — Oberfläche

- [X] T1224 [W] `workflow.js`: `licenceBlockHtml()`, Schritt 2 und 3, neue Aktionen,
      Selektor bei :948 erweitern
- [X] T1225 [W] `workflow.js`: Wächter in `startLonglist` und `runDeepLoop` mit
      **synchroner** Sperre vor dem `await`; Sperrbedingungen der Knöpfe
- [X] T1226 [P] [W] `docs/css/components.css`: `.gate*` entfernen

## Phase 7: Umzug und Aufräumen

- [X] T1227 [W] `docs/index.html` lädt `js/app.js`; `docs/js/gate.js` löschen
- [X] T1228 [W] `docs/sw.js`: `icp-cache-v17`, `gate.js` raus, Lizenzmodule rein
- [X] T1229 [P] [W] `docs/_headers` für Cloudflare Pages
- [X] T1230 [P] [W] `README.md`, `CLAUDE.md`, Memory fortschreiben
- [X] T1231 [W] Regression `node --test tests/*.test.js` + Syntaxprüfung
- [X] T1232 [W] **Grabstein-Fassung** vorbereitet: `deploy/pages-tombstone/` meldet den
      alten Service Worker ab (`registration.unregister()`), löscht alle `icp-cache-*`
      und verweist auf die neue Adresse. Die README dort enthält den `gh-pages`-Weg,
      der `main` unangetastet lässt.

## Phase 8: Inbetriebnahme — **Nutzer-Tasks**

- [X] T1234 Cloudflare Worker `icp-licence` steht: D1 `icp-licence`
      (`f00e20ad-7328-459c-a72e-b775fe4b3654`), Schema eingespielt, `TOKEN_SECRET`,
      `ADMIN_TOKEN` und `STRIPE_WEBHOOK_SECRET` als Secrets, Custom Domain
      `licence.manuelkern.com`, `/healthz` grün. **Konto `manuelkern311@gmail.com`** —
      die Zone liegt dort, ein erster Anlauf unter `mankern@gmx.de` scheiterte an
      „Could not find zone" und wurde zurückgebaut.
- [X] T1235 Auslieferung des Werkzeugs unter `icp.manuelkern.com`. **Abweichung:**
      nicht Cloudflare Pages, sondern ein **Worker mit statischen Assets**
      (`wrangler.toml`, `[assets] directory = "./docs"`, kein `main`). Gleiches
      Ergebnis, gleiche Kosten, aber ein Werkzeug statt zweier Produkte — und `docs/`
      bleibt ohne Build-Schritt die Wurzel. `_headers` wird unterstützt.
- [X] T1236 Stripe **Testmodus**: Produkt 99 € einmalig, Payment Link, Webhook auf
      `https://licence.manuelkern.com/v1/stripe/webhook` (nur
      `checkout.session.completed`), echtes `STRIPE_WEBHOOK_SECRET` eingetragen und
      durch einen Testkauf belegt. Nebenbefund: Payment Links füllen
      `customer_details` — die Annahme aus dem Contract hält.
- [ ] T1236b Stripe **Livemodus**: eigenes Produkt, eigener Payment Link, eigener
      Webhook-Endpunkt, neues `whsec_` per `wrangler secret put`. Testmodus-Werte
      gelten dort **nicht** — **Nutzer-Task**
- [ ] T1237 Resend: Absender-Domain verifizieren, `npx wrangler secret put
      RESEND_API_KEY`. **Bis dahin bekommt kein Käufer seinen Schlüssel** — die Mail
      landet im Worker-Log statt im Postfach. Härtester offener Punkt vor dem
      Livegang — **Nutzer-Task**
- [X] T1238a Testkauf → Webhook → Lizenz `ICP-P7NE-0Z9H-VD7D` angelegt → im Browser
      aktiviert, Gerät 1 von 2 („Chrome auf macOS") serverseitig bestätigt.
- [ ] T1238b Rest der Abnahme: Gerät 2 aktivieren → drittes Gerät ergibt `409` mit
      **beiden** Gerätenamen → `./admin.sh reset` → Aktivierung gelingt wieder →
      `./admin.sh revoke` → nächste Recherche stoppt, **Export und Sicherung laufen
      weiter**
- [ ] T1233 Grabstein **aufspielen**, bevor Pages abgeschaltet wird — sonst bedient der
      alte Service Worker Altbesucher unbegrenzt mit der lizenzfreien Fassung
      — **Nutzer-Task**
- [ ] T1239 GitHub Pages abschalten (nach T1233), Repo auf privat; Test-Lizenzzeile
      entfernen und die Testzahlung in Stripe aufräumen
