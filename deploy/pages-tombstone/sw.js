// Selbstabbau des alten Service Workers ("kill switch").
//
// Der Grabstein braucht diese Datei zwingend. Der frühere Worker lieferte
// cache-first aus und hatte `index.html` im Vorrat — eine neue index.html allein
// bekäme ein Altbesucher nie zu sehen, und ihr Abmelde-Skript liefe nie.
//
// Der Weg, der am Cache vorbeiführt: Der Browser prüft bei jeder Navigation das
// Worker-Skript selbst über das Netz. Ändert es sich, wird die neue Fassung
// installiert — und diese hier räumt sich und alle Zwischenspeicher ab.
//
// Auf `caches.keys()` ohne Präfixfilter: Unter dieser Herkunft lief nur diese
// App, und der Sinn der Seite ist, nichts zurückzulassen.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.registration.unregister();
    // Offene Tabs zeigen noch die Fassung aus dem Cache. Nach dem Abmelden
    // holt ein Neuladen die Seite aus dem Netz — also den Grabstein.
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});

// Kein fetch-Handler: Anfragen gehen unverändert ins Netz.
