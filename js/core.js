/* MedicSoft — núcleo compartido (página + service worker).
   Script clásico: se carga con <script> en la página y con importScripts() en sw.js */
(function (g) {
  'use strict';

  const DB_NAME = 'medicsoft';
  const DB_VERSION = 1;
  const STORES = ['vitals', 'meds', 'intakes', 'appts', 'kv'];

  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: s === 'kv' ? 'key' : 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
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

  async function computeDue(now) {
    now = now || new Date();
    const settings = await DB.getKV('settings', {});
    if (settings.notify === false) return [];
    const [meds, intakes, appts] = await Promise.all([DB.all('meds'), DB.all('intakes'), DB.all('appts')]);
    const sent = await DB.getKV('sent', {});
    const taken = new Set(intakes.map(i => i.id));
    const due = [];
    const inWindow = when => when <= now && now - when < WINDOW_MS;

    // Hoy y ayer (por si la ventana cruza medianoche)
    const days = [new Date(now.getTime() - 86400000), now].map(dateKey);
    for (const ds of days) {
      if (settings.notifyMeds !== false) {
        for (const d of dosesForDate(meds, ds)) {
          const tag = 'med:' + d.key;
          if (sent[tag] || taken.has(d.key) || !inWindow(at(ds, d.time))) continue;
          due.push({
            tag,
            title: `💊 Hora de tu medicamento`,
            body: `${d.med.name}${d.med.dose ? ' — ' + d.med.dose : ''} (${d.time})`,
            data: { kind: 'med', key: d.key, medId: d.med.id, date: ds, time: d.time, url: './#/medicamentos' },
            actions: [{ action: 'taken', title: '✔ Tomada' }, { action: 'snooze', title: '⏰ 10 min' }]
          });
        }
      }
      if (settings.notifyBP !== false) {
        for (const t of settings.bpTimes || []) {
          const tag = `bp:${ds}|${t}`;
          if (sent[tag] || !inWindow(at(ds, t))) continue;
          due.push({
            tag,
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
        const reminders = [Number(a.remind ?? 60)];
        if (a.remindDayBefore !== false) reminders.push(24 * 60);
        for (const mins of reminders) {
          const tag = `appt:${a.id}:${mins}`;
          const when = new Date(start.getTime() - mins * 60000);
          if (sent[tag] || !inWindow(when) || now > start) continue;
          const label = a.type === 'examen' ? '🧪 Examen' : a.type === 'consulta' ? '🩺 Cita médica' : '📅 Evento';
          const hrs = mins >= 1440 ? 'mañana' : mins >= 60 ? `en ${Math.round(mins / 60)} h` : `en ${mins} min`;
          due.push({
            tag,
            title: `${label} ${hrs}`,
            body: `${a.title}${a.time ? ' a las ' + a.time : ''}${a.place ? ' — ' + a.place : ''}`,
            data: { kind: 'appt', id: a.id, url: './#/agenda' }
          });
        }
      }
    }

    // Recordatorios pospuestos
    const snoozed = await DB.getKV('snoozed', []);
    const keep = [];
    for (const s of snoozed) {
      if (new Date(s.at) <= now) {
        if (!taken.has(s.data.key)) due.push(Object.assign({}, s, { tag: s.tag + ':s' + s.at }));
      } else keep.push(s);
    }
    if (keep.length !== snoozed.length) await DB.setKV('snoozed', keep);

    return due;
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
    if (due.length) await markSent(due.map(n => n.tag));
    return due.length;
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

  g.MS = { DB, pad, dateKey, timeKey, at, uid, medScheduledOn, medTimesOn, nextDoses, isInterval, dosesForDate, bpCategory, computeDue, runReminders, markTaken, snooze };
})(typeof self !== 'undefined' ? self : window);
