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
- [ ] T1233 Grabstein **aufspielen**, bevor Pages abgeschaltet wird — sonst bedient der
      alte Service Worker Altbesucher unbegrenzt mit der lizenzfreien Fassung
      — **Nutzer-Task**

## Phase 8: Inbetriebnahme — **Nutzer-Tasks**

- [ ] T1234 Cloudflare Worker: `wrangler d1 create icp-licence` → `database_id` in
      `wrangler.toml`; `npm run db:init`; Geheimnisse per `wrangler secret put`
      (`openssl rand -hex 32` für `TOKEN_SECRET` und `ADMIN_TOKEN`,
      `STRIPE_WEBHOOK_SECRET` zunächst als Platzhalter); `npm run deploy`;
      `/healthz` grün. Die Custom Domain `licence.manuelkern.com` legt Cloudflare
      selbst an, weil die Zone dort liegt.
- [ ] T1235 Cloudflare Pages: Projekt auf `icp-lead-scoring`, Framework-Preset
      **None**, Build-Befehl leer, Ausgabeverzeichnis `docs`, Domain
      `icp.manuelkern.com`
- [ ] T1236 Stripe (Testmodus): Produkt 99 € einmalig, Payment Link, Webhook auf
      `https://licence.manuelkern.com/v1/stripe/webhook` (nur
      `checkout.session.completed`), echtes `STRIPE_WEBHOOK_SECRET` nachtragen
- [ ] T1237 Resend: Absender-Domain verifizieren, `MAIL_FROM` und `SUPPORT_EMAIL`
- [ ] T1238 Testkauf: Mail → Aktivierung Gerät 1 und 2 → drittes Gerät ergibt `409` mit
      beiden Namen → `reset-devices` → Aktivierung gelingt → `revoke` → nächste Recherche
      stoppt, **Export und Sicherung laufen weiter**
- [ ] T1239 GitHub Pages abschalten (nach T1233), Repo auf privat; Testzeilen per SQL
      entfernen
