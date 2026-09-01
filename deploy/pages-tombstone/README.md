# Grabstein für die alte GitHub-Pages-Adresse

Wer https://mkern311.github.io/icp-lead-scoring/ schon einmal besucht hat, trägt
einen **Service Worker** im Browser, der die App cache-first ausliefert. Wird
GitHub Pages einfach abgeschaltet, bedient dieser Worker seinen Nutzer
unbegrenzt weiter — mit der alten, **lizenzfreien** Fassung. Der Umzug wäre für
genau die Leute wirkungslos, die das Werkzeug schon kennen.

Die Seite hier meldet den Worker ab, löscht alle `icp-cache-*` und verweist auf
die neue Adresse.

## So aufspielen — ohne `main` anzufassen

```bash
cd /Users/manuelkern/Claude/50_dev/icp-lead-scoring

git checkout --orphan gh-pages
git rm -rf --cached . && rm -rf docs specs tests backup .specify   # Arbeitsbaum leeren
cp deploy/pages-tombstone/index.html .
git add index.html && git commit -m "Grabstein: Umzug auf icp.manuelkern.com"
git push -u origin gh-pages
git checkout main
```

Danach in den Repo-Einstellungen unter **Pages** die Quelle von `main /docs` auf
**`gh-pages` / (root)** umstellen und den Deploy abwarten.

## Reihenfolge — sie trägt

1. `icp.manuelkern.com` läuft und ist geprüft
2. Grabstein auf `gh-pages`, Pages darauf umgestellt, Deploy abgewartet
3. **Erst dann** Pages abschalten und das Repo auf privat stellen

Wer Schritt 2 überspringt, lässt Altbesucher in der alten Fassung stehen.
