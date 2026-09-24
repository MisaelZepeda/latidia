/* Latidia — núcleo compartido (página + service worker).
   Script clásico: se carga con <script> en la página y con importScripts() en sw.js */
(function (g) {
  'use strict';

  // Bases locales. La principal se queda en versión 1: subirla exigiría cerrar las conexiones de
  // versiones anteriores de la app (p. ej. el service worker instalado) y podría bloquear el arranque.
  // Las colecciones nuevas van en bases aparte.
  const DATABASES = [
    { name: 'medicsoft', version: 1, stores: ['vitals', 'meds', 'intakes', 'appts', 'kv'] },
    { name: 'latidia-labs', version: 1, stores: ['labs'] }
  ];
  const STORES = ['vitals', 'meds', 'intakes', 'appts', 'labs', 'kv'];
  const dbOf = store => DATABASES.find(d => d.stores.includes(store));

  const dbPromises = {};
  function open(def) {
    if (dbPromises[def.name]) return dbPromises[def.name];
    dbPromises[def.name] = new Promise((resolve, reject) => {
      const req = indexedDB.open(def.name, def.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of def.stores) {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: s === 'kv' ? 'key' : 'id' });
          }
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); delete dbPromises[def.name]; };
        resolve(db);
      };
      req.onerror = () => { delete dbPromises[def.name]; reject(req.error); };
    });
    return dbPromises[def.name];
  }

  function tx(store, mode, fn) {
    return open(dbOf(store)).then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      const res = fn(os);
      t.oncomplete = () => resolve(res && 'result' in res ? res.result : res);
      t.onerror = () => reject(t.error);
    }));
  }

  const DB = {
    all: store => tx(store, 'readonly', os => os.getAll()),
    get: (store, id) => tx(store, 'readonly', os => os.get(id)),
    put: (store, obj) => tx(store, 'readwrite', os => { os.put(obj); return obj; }),
    del: (store, id) => tx(store, 'readwrite', os => { os.delete(id); }),
    clear: store => tx(store, 'readwrite', os => { os.clear(); }),
    async getKV(key, def) {
      const r = await DB.get('kv', key);
      return r ? r.value : def;
    },
    setKV: (key, value) => DB.put('kv', { key, value }),
    async exportAll() {
      const out = { app: 'medicsoft', version: 1, exported: new Date().toISOString() };
      for (const s of STORES) out[s] = await DB.all(s);
      return out;
    },
    async importAll(data) {
      if (!data || data.app !== 'medicsoft') throw new Error('Archivo no válido');
      for (const s of STORES) {
        if (!Array.isArray(data[s])) continue;
        await DB.clear(s);
        for (const item of data[s]) await DB.put(s, item);
      }
    }
  };

  // ---------- Utilidades de fecha ----------
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeKey = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function at(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Medicamento por intervalo ("cada N horas" desde la primera toma) o por horarios fijos (formato original)
  const isInterval = med => med.mode === 'interval' && Number(med.every) > 0;

  // ¿Le toca este medicamento en esta fecha?
  function medScheduledOn(med, dateStr) {
    if (med.active === false) return false;
    if (med.start && dateStr < med.start) return false;
    if (med.end && dateStr > med.end) return false;
    if (!isInterval(med) && med.days && med.days.length && med.days.length < 7) {
      const dow = at(dateStr).getDay();
      if (!med.days.includes(dow)) return false;
    }
    return true;
  }

  // Horas de toma de un medicamento en una fecha (HH:MM)
  function medTimesOn(med, dateStr) {
    if (!isInterval(med)) return med.times || [];
    const step = Number(med.every) * 3600000;
    const anchor = at(med.start || dateStr, med.firstTime || '08:00').getTime();
    const dayStart = at(dateStr).getTime();
    const dayEnd = at(dateStr).setDate(at(dateStr).getDate() + 1);
    if (dayEnd <= anchor) return [];
    const out = [];
    let t = anchor + Math.max(0, Math.ceil((dayStart - anchor) / step)) * step;
    for (; t < dayEnd; t += step) out.push(timeKey(new Date(t)));
    return [...new Set(out)];
  }

  // Dosis programadas de un día: [{med, time, key}]
  function dosesForDate(meds, dateStr) {
    const out = [];
    for (const med of meds) {
      if (!medScheduledOn(med, dateStr)) continue;
      for (const t of medTimesOn(med, dateStr)) out.push({ med, time: t, key: `${med.id}|${dateStr}|${t}` });
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }

  // Próximas N tomas a partir de un momento: [{date, time, when}]
  function nextDoses(med, from, count) {
    const out = [];
    let ds = dateKey(from);
    for (let i = 0; i < 400 && out.length < count; i++, ds = dateKey(new Date(at(ds).setDate(at(ds).getDate() + 1)))) {
      if (med.end && ds > med.end) break;
      if (!medScheduledOn(Object.assign({}, med, { active: true }), ds)) continue;
      for (const t of medTimesOn(med, ds)) {
        const when = at(ds, t);
        if (when >= from && out.length < count) out.push({ date: ds, time: t, when });
      }
    }
    return out;
  }

  // ---------- Clasificación de presión arterial (AHA/ACC 2017) ----------
  function bpCategory(sys, dia) {
    if (!sys || !dia) return null;
    if (sys > 180 || dia > 120) return { id: 'crisis', label: 'Crisis hipertensiva', color: 'var(--bp-crisis)' };
    if (sys >= 140 || dia >= 90) return { id: 'h2', label: 'Hipertensión grado 2', color: 'var(--bp-h2)' };
    if (sys >= 130 || dia >= 80) return { id: 'h1', label: 'Hipertensión grado 1', color: 'var(--bp-h1)' };
    if (sys < 90 || dia < 60) return { id: 'low', label: 'Presión baja', color: 'var(--bp-low)' };
    if (sys >= 120) return { id: 'elev', label: 'Elevada', color: 'var(--bp-elev)' };
    return { id: 'normal', label: 'Normal', color: 'var(--bp-normal)' };
  }

  // ---------- Recordatorios ----------
  const WINDOW_MS = 60 * 60 * 1000; // una notificación atrasada sigue valiendo hasta 1 h
  const MED_ACTIONS = [{ action: 'taken', title: '✔ Tomada' }, { action: 'snooze', title: '⏰ 10 min' }];

  // Todos los recordatorios programados entre dos momentos (Date): [{tag, when, title, body, data, actions}]
  async function remindersBetween(from, to) {
    const settings = await DB.getKV('settings', {});
    if (settings.notify === false) return [];
    const [meds, intakes, appts] = await Promise.all([DB.all('meds'), DB.all('intakes'), DB.all('appts')]);
    const taken = new Set(intakes.map(i => i.id));
    const out = [];
    const inRange = when => when >= from && when <= to;

    for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d.setDate(d.getDate() + 1)) {
      const ds = dateKey(d);
      if (settings.notifyMeds !== false) {
        for (const x of dosesForDate(meds, ds)) {
          const when = at(ds, x.time);
          if (taken.has(x.key) || !inRange(when)) continue;
          out.push({
            tag: 'med:' + x.key, when,
            title: '💊 Hora de tu medicamento',
            body: `${x.med.name}${x.med.dose ? ' — ' + x.med.dose : ''} (${x.time})`,
            data: { kind: 'med', key: x.key, medId: x.med.id, date: ds, time: x.time, url: './#/medicamentos' },
            actions: MED_ACTIONS
          });
        }
      }
      if (settings.notifyBP !== false) {
        for (const t of settings.bpTimes || []) {
          const when = at(ds, t);
          if (!inRange(when)) continue;
          out.push({
            tag: `bp:${ds}|${t}`, when,
            title: '❤️ Toma tu presión',
            body: `Es momento de registrar tu presión arterial y pulso (${t}).`,
            data: { kind: 'bp', url: './#/signos?nuevo=1' }
          });
        }
      }
    }

    if (settings.notifyAppts !== false) {
      for (const a of appts) {
        if (a.done) continue;
        const start = at(a.date, a.time || '08:00');
        const mins = [Number(a.remind ?? 60)];
        if (a.remindDayBefore !== false) mins.push(24 * 60);
        for (const m of mins) {
          const when = new Date(start.getTime() - m * 60000);
          if (!inRange(when) || when > start) continue;
          const label = a.type === 'examen' ? '🧪 Examen' : a.type === 'consulta' ? '🩺 Cita médica' : '📅 Evento';
          const hrs = m >= 1440 ? 'mañana' : m >= 60 ? `en ${Math.round(m / 60)} h` : m ? `en ${m} min` : 'ahora';
          out.push({
            tag: `appt:${a.id}:${m}`, when,
            title: `${label} ${hrs}`,
            body: `${a.title}${a.time ? ' a las ' + a.time : ''}${a.place ? ' — ' + a.place : ''}`,
            data: { kind: 'appt', id: a.id, url: './#/agenda' }
          });
        }
      }
    }
    return out.sort((x, y) => x.when - y.when);
  }

  // Recordatorios que tocan ahora (avisos locales, con la app abierta)
  async function computeDue(now) {
    now = now || new Date();
    const sent = await DB.getKV('sent', {});
    const due = (await remindersBetween(new Date(now.getTime() - WINDOW_MS), now)).filter(n => !sent[n.tag]);

    // Recordatorios pospuestos
    const intakes = await DB.all('intakes');
    const taken = new Set(intakes.map(i => i.id));
    const snoozed = await DB.getKV('snoozed', []);
    const keep = [];
    for (const s of snoozed) {
      if (new Date(s.at) <= now) {
        if (!taken.has(s.data && s.data.key)) due.push(Object.assign({}, s, { tag: s.tag + ':s' + s.at }));
      } else keep.push(s);
    }
    if (keep.length !== snoozed.length) await DB.setKV('snoozed', keep);
    return due;
  }

  // Lista para el servidor de notificaciones (los próximos `days` días)
  async function pushReminders(days) {
    const now = Date.now();
    const settings = await DB.getKV('settings', {});
    const list = await remindersBetween(new Date(now - 90 * 60000), new Date(now + days * 86400000));
    return list.map(n => ({
      id: n.tag, at: n.when.getTime(), title: n.title, body: n.body, data: n.data, actions: n.actions || [],
      requireInteraction: n.data.kind === 'med', repeatMin: n.data.kind === 'med' && settings.pushRepeat !== false ? 30 : 0
    }));
  }

  // Con el servidor activo (sincronizado en las últimas 36 h) no se duplican los avisos locales
  async function serverPushActive() {
    const last = await DB.getKV('pushActive', 0);
    return last && Date.now() - last < 36 * 3600000;
  }

  async function markSent(tags) {
    const sent = await DB.getKV('sent', {});
    const limit = Date.now() - 3 * 86400000;
    for (const k of Object.keys(sent)) if (sent[k] < limit) delete sent[k];
    for (const t of tags) sent[t] = Date.now();
    await DB.setKV('sent', sent);
  }

  // Revisa y muestra notificaciones usando el registro del service worker
  async function runReminders(registration) {
    if (!registration || typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
    if (await serverPushActive()) return 0; // el servidor ya envía los recordatorios
    const due = await computeDue(new Date());
    for (const n of due) {
      await registration.showNotification(n.title, {
        body: n.body,
        tag: n.tag,
        data: n.data,
        actions: n.actions || [],
        icon: 'icons/icon-192.png',
        badge: 'icons/badge-96.png',
        vibrate: [200, 100, 200],
        requireInteraction: n.data && n.data.kind === 'med',
        renotify: true
      });
    }
    if (due.length) {
      await markSent(due.map(n => n.tag));
      await logNotifications(due);
    }
    return due.length;
  }

  // Historial local para el centro de notificaciones (últimos 50)
  async function logNotifications(list) {
    const log = await DB.getKV('notiflog', []);
    const nowIso = new Date().toISOString();
    for (const n of list) log.unshift({ title: n.title, body: n.body, kind: n.data && n.data.kind, at: nowIso });
    await DB.setKV('notiflog', log.slice(0, 50));
  }

  async function markTaken(key, status) {
    const [medId, date, time] = key.split('|');
    await DB.put('intakes', { id: key, medId, date, time, status: status || 'taken', at: new Date().toISOString() });
  }

  async function snooze(n, minutes) {
    const list = await DB.getKV('snoozed', []);
    list.push({ tag: n.tag || 'snooze', title: n.title, body: n.body, data: n.data, actions: n.actions,
      at: new Date(Date.now() + minutes * 60000).toISOString() });
    await DB.setKV('snoozed', list);
  }

  g.MS = { DB, pad, dateKey, timeKey, at, uid, medScheduledOn, medTimesOn, nextDoses, isInterval, dosesForDate, bpCategory, computeDue, runReminders, markTaken, snooze,
    markSent, logNotifications, pushReminders, serverPushActive };
})(typeof self !== 'undefined' ? self : window);
