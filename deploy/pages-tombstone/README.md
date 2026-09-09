# Grabstein für die alte GitHub-Pages-Adresse

Wer https://mkern311.github.io/icp-lead-scoring/ schon einmal besucht hat, trägt
einen **Service Worker** im Browser, der die App cache-first ausliefert. Wird
GitHub Pages einfach abgeschaltet, bedient dieser Worker seinen Nutzer
unbegrenzt weiter — mit der alten, **lizenzfreien** Fassung. Der Umzug wäre für
genau die Leute wirkungslos, die das Werkzeug schon kennen.

## Zwei Dateien, und beide werden gebraucht

- **`sw.js`** — der eigentliche Hebel. Der alte Worker lieferte **cache-first ohne
  Revalidierung** aus (`caches.match(...).then((cached) => cached || fetch(...))`) und
  hatte `index.html` im Vorrat. Eine neue `index.html` allein bekäme ein Altbesucher
  deshalb **nie** zu sehen. Was am Cache vorbeiführt, ist das Worker-Skript selbst:
  Der Browser prüft es bei jeder Navigation über das Netz. Diese Fassung installiert
  sich, löscht alle Zwischenspeicher, meldet sich ab und lädt offene Tabs neu.
- **`index.html`** — was der Mensch danach sieht: Verweis auf die neue Adresse und der
  Hinweis, Daten vorher zu sichern.

## So aufspielen — ohne `main` und ohne den Arbeitsbaum anzufassen

Der Weg über `git checkout --orphan` samt `rm -rf` im Arbeitsbaum ist unnötig
gefährlich. Mit Plumbing entsteht der Commit direkt aus den beiden Dateien:

```bash
cd /Users/manuelkern/Claude/50_dev/icp-lead-scoring

TREE=$(
  { printf '100644 blob %s\tindex.html\n' "$(git hash-object -w deploy/pages-tombstone/index.html)"
    printf '100644 blob %s\tsw.js\n'      "$(git hash-object -w deploy/pages-tombstone/sw.js)"
  } | git mktree
)
COMMIT=$(git commit-tree "$TREE" -m "Grabstein: Umzug auf icp.manuelkern.com")
git push origin "$COMMIT:refs/heads/gh-pages"
```

Danach die Pages-Quelle von `main /docs` auf **`gh-pages` / (root)** umstellen:

```bash
gh api -X PUT repos/MKern311/icp-lead-scoring/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

## Reihenfolge — sie trägt

1. `icp.manuelkern.com` läuft und ist geprüft
2. Grabstein auf `gh-pages` (**mit `sw.js`**), Pages darauf umgestellt, Deploy
   abgewartet und die neue `sw.js` unter der alten Adresse abgerufen
3. **Erst dann** Pages abschalten und das Repo auf privat stellen

Wer Schritt 2 überspringt, lässt Altbesucher in der alten Fassung stehen.
