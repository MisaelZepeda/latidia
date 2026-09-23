/* MedicSoft — service worker: caché offline + notificaciones */
importScripts('js/core.js');

const CACHE = 'medicsoft-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/core.js',
  'js/icons.js',
  'js/chart.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/badge-96.png',
  'icons/favicon.svg',
  'icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero para HTML (para recibir actualizaciones), caché primero para lo demás
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});

// Revisión periódica en segundo plano (Chrome/Edge con la app instalada)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'medicsoft-reminders') e.waitUntil(MS.runReminders(self.registration));
});

// Mensajes desde la página
self.addEventListener('message', e => {
  if (e.data === 'check-reminders') e.waitUntil(MS.runReminders(self.registration));
});

// Push (por si en el futuro se conecta un servidor de notificaciones)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'MedicSoft', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: d.data || {}
  }).then(() => MS.runReminders(self.registration)));
});

self.addEventListener('notificationclick', e => {
  const n = e.notification;
  const data = n.data || {};
  n.close();
  e.waitUntil((async () => {
    if (e.action === 'taken' && data.key) {
      await MS.markTaken(data.key, 'taken');
      await broadcast({ type: 'data-changed' });
      return;
    }
    if (e.action === 'snooze') {
      await MS.snooze({ tag: n.tag, title: n.title, body: n.body, data,
        actions: Array.from(n.actions || []).map(x => ({ action: x.action, title: x.title })) }, 10);
      return;
    }
    const url = new URL(data.url || './', self.registration.scope).href;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); if ('navigate' in w) w.navigate(url).catch(() => {}); return; }
    }
    await self.clients.openWindow(url);
  })());
});

async function broadcast(msg) {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  wins.forEach(w => w.postMessage(msg));
}
