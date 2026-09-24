/* Latidia — service worker: caché offline + notificaciones */
importScripts('js/core.js');

const CACHE = 'latidia-v10';
// Librerías externas versionadas (no cambian): caché primero
const CDN = ['https://www.gstatic.com/firebasejs/', 'https://cdn.jsdelivr.net/npm/'];
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/core.js',
  'js/firebase-config.js',
  'js/push-config.js',
  'js/cloud.js',
  'js/icons.js',
  'js/chart.js',
  'js/report-pdf.js',
  'js/card.js',
  'js/labs.js',
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

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (CDN.some(c => req.url.startsWith(c))) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (new URL(req.url).origin !== location.origin) return;
  // Archivos propios: red primero (para recibir cambios al publicar), caché si no hay conexión
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key, { ignoreSearch: true }))
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

// Notificaciones del servidor (llegan aunque la app esté cerrada)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Latidia', body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Latidia', {
      body: d.body || '', tag: d.tag || undefined, data: d.data || {}, actions: d.actions || [],
      requireInteraction: !!d.requireInteraction, renotify: !!d.tag,
      icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', vibrate: [200, 100, 200]
    });
    try {
      if (d.tag) await MS.markSent([d.tag]);   // evita que el aviso local lo repita
      await MS.logNotifications([{ title: d.title || 'Latidia', body: d.body || '', data: d.data }]);
    } catch (_) {}
  })());
});

// Avisa al servidor desde el service worker (sin sesión: usa el secreto del dispositivo)
async function deviceAction(payload) {
  const cfg = await MS.DB.getKV('pushCfg', null);
  if (!cfg) return false;
  try {
    const r = await fetch(cfg.url + '/device-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ uid: cfg.uid, deviceId: cfg.deviceId, secret: cfg.secret }, payload))
    });
    return r.ok;
  } catch (_) { return false; }
}

self.addEventListener('notificationclick', e => {
  const n = e.notification;
  const data = n.data || {};
  n.close();
  e.waitUntil((async () => {
    if (e.action === 'taken' && data.key) {
      await MS.markTaken(data.key, 'taken');
      // La página sube este cambio a Firebase la próxima vez que esté abierta
      const box = await MS.DB.getKV('outbox', []);
      box.push({ store: 'intakes', id: data.key });
      await MS.DB.setKV('outbox', box);
      await deviceAction({ action: 'done', id: 'med:' + data.key }); // cancela el recordatorio repetido
      await broadcast({ type: 'data-changed' });
      return;
    }
    if (e.action === 'snooze') {
      const actions = Array.from(n.actions || []).map(x => ({ action: x.action, title: x.title }));
      const viaServer = (await MS.serverPushActive()) &&
        await deviceAction({ action: 'snooze', id: n.tag, minutes: 10, title: n.title, body: n.body, data, actions });
      if (!viaServer) await MS.snooze({ tag: n.tag, title: n.title, body: n.body, data, actions }, 10);
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
