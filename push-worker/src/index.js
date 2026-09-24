/* Latidia — servidor de notificaciones (Cloudflare Worker, plan gratuito)
 *
 * - La app envía (con su sesión de Firebase) los recordatorios de los próximos días y la
 *   suscripción Web Push de cada dispositivo.
 * - Un cron cada minuto envía los recordatorios que tocan, aunque la app esté cerrada.
 * - Web Push estándar: cifrado aes128gcm (RFC 8291) + VAPID (RFC 8292) con WebCrypto.
 *
 * Almacenamiento (KV "PUSH"):
 *   users            → ["uid", ...]
 *   u:<uid>          → { subs: { deviceId: { sub, secret } }, reminders: [...], sent: { id: ts }, extra: [...] }
 *
 * Variables: FIREBASE_PROJECT_ID, VAPID_PUBLIC_KEY, VAPID_SUBJECT, ALLOWED_ORIGINS
 * Secretos:  VAPID_PRIVATE_JWK
 */

const WINDOW_MS = 60 * 60 * 1000;           // un recordatorio atrasado se envía hasta 1 h después
const MAX_REMINDERS = 600;

import { enc, b64u, encryptPayload, vapidAuthorization } from './webpush.js';

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json', ...headers } });

// ---------------------------------------------------------------- Firebase ID token
let jwksCache = null;
async function googleKeys() {
  if (jwksCache && jwksCache.exp > Date.now()) return jwksCache.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const data = await r.json();
  const maxAge = +((r.headers.get('Cache-Control') || '').match(/max-age=(\d+)/) || [0, 3600])[1];
  jwksCache = { keys: data.keys, exp: Date.now() + maxAge * 1000 };
  return data.keys;
}

async function verifyIdToken(token, projectId) {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) throw new Error('token inválido');
  const header = JSON.parse(new TextDecoder().decode(b64u.dec(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64u.dec(p)));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256') throw new Error('alg');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('aud/iss');
  if (payload.exp < now - 60 || payload.iat > now + 300 || !payload.sub) throw new Error('exp');
  const jwk = (await googleKeys()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error('firma');
  return payload.sub;
}

async function authUid(req, env) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try { return await verifyIdToken(m[1], env.FIREBASE_PROJECT_ID); } catch (_) { return null; }
}

// ---------------------------------------------------------------- Web Push
async function sendPush(sub, message, env) {
  const body = await encryptPayload(sub, JSON.stringify(message));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidAuthorization(sub.endpoint, env.VAPID_PRIVATE_JWK, env.VAPID_PUBLIC_KEY, env.VAPID_SUBJECT),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '3600',
      'Urgency': 'high',
      'Topic': String(message.tag || 'latidia').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'latidia'
    },
    body
  });
  return r.status;
}

// Envía a todos los dispositivos del usuario; elimina suscripciones vencidas (404/410)
async function sendToUser(user, message, env) {
  let delivered = 0, changed = false;
  const seen = new Set();
  // El registro más reciente de cada dirección push gana; los duplicados se eliminan
  const entries = Object.entries(user.subs || {}).sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0));
  for (const [id, d] of entries) {
    if (seen.has(d.sub.endpoint)) { delete user.subs[id]; changed = true; continue; }
    seen.add(d.sub.endpoint);
    try {
      const st = await sendPush(d.sub, message, env);
      if (st === 404 || st === 410) { delete user.subs[id]; changed = true; }
      else if (st >= 200 && st < 300) delivered++;
    } catch (_) { /* error de red: se intenta en el siguiente minuto */ }
  }
  return { delivered, changed };
}

// ---------------------------------------------------------------- almacenamiento
const getUser = async (env, uid) => (await env.PUSH.get('u:' + uid, 'json')) || { subs: {}, reminders: [], sent: {}, extra: [] };
const putUser = (env, uid, u) => env.PUSH.put('u:' + uid, JSON.stringify(u));
async function indexAdd(env, uid) {
  const list = (await env.PUSH.get('users', 'json')) || [];
  if (!list.includes(uid)) { list.push(uid); await env.PUSH.put('users', JSON.stringify(list)); }
}
async function indexRemove(env, uid) {
  const list = (await env.PUSH.get('users', 'json')) || [];
  const next = list.filter(u => u !== uid);
  if (next.length !== list.length) await env.PUSH.put('users', JSON.stringify(next));
}

const cleanReminder = r => ({
  id: String(r.id).slice(0, 200), at: +r.at, title: String(r.title || '').slice(0, 120), body: String(r.body || '').slice(0, 300),
  data: r.data && typeof r.data === 'object' ? r.data : {}, actions: Array.isArray(r.actions) ? r.actions.slice(0, 2) : [],
  requireInteraction: !!r.requireInteraction, repeatMin: Math.min(+r.repeatMin || 0, 180)
});

// ---------------------------------------------------------------- HTTP
async function handle(req, env) {
  const url = new URL(req.url);
  const H = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'latidia-push', vapidPublicKey: env.VAPID_PUBLIC_KEY }, 200, H);

  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (_) { return json({ error: 'json' }, 400, H); } }

  // Acciones desde el service worker (sin sesión): se autentican con el secreto del dispositivo
  if (url.pathname === '/device-action') {
    const { uid, deviceId, secret, action, id, minutes, title, body: text, data, actions } = body;
    if (!uid || !deviceId || !secret) return json({ error: 'auth' }, 401, H);
    const u = await getUser(env, uid);
    const dev = u.subs[deviceId];
    if (!dev || dev.secret !== secret) return json({ error: 'auth' }, 401, H);
    if (action === 'done') {
      u.sent[id] = Date.now();
      u.sent[id + ':r'] = Date.now();               // cancela el recordatorio repetido
      u.reminders = u.reminders.filter(r => r.id !== id);
    } else if (action === 'snooze') {
      u.extra = (u.extra || []).filter(r => r.at > Date.now() - WINDOW_MS);
      u.extra.push(cleanReminder({ id: `${id}:s${Date.now()}`, at: Date.now() + (Math.min(+minutes || 10, 120)) * 60000, title, body: text, data, actions, requireInteraction: true }));
    }
    await putUser(env, uid, u);
    return json({ ok: true }, 200, H);
  }

  const uid = await authUid(req, env);
  if (!uid) return json({ error: 'no autorizado' }, 401, H);

  if (url.pathname === '/sync' && req.method === 'POST') {
    const u = await getUser(env, uid);
    const { deviceId, subscription, secret } = body;
    if (deviceId && subscription && subscription.endpoint && subscription.keys) {
      // Un mismo dispositivo (misma dirección push) solo puede estar registrado una vez
      for (const [id, d] of Object.entries(u.subs)) if (id !== deviceId && d.sub.endpoint === subscription.endpoint) delete u.subs[id];
      u.subs[deviceId] = { sub: { endpoint: subscription.endpoint, keys: subscription.keys }, secret: String(secret || ''), updated: Date.now() };
    }
    if (Array.isArray(body.reminders)) {
      u.reminders = body.reminders.map(cleanReminder).filter(r => r.at > Date.now() - WINDOW_MS).sort((a, b) => a.at - b.at).slice(0, MAX_REMINDERS);
    }
    if (Array.isArray(body.done)) for (const id of body.done) { u.sent[id] = u.sent[id] || Date.now(); u.sent[id + ':r'] = Date.now(); }
    await putUser(env, uid, u);
    await indexAdd(env, uid);
    return json({ ok: true, devices: Object.keys(u.subs).length, reminders: u.reminders.length }, 200, H);
  }

  if (url.pathname === '/unsubscribe' && req.method === 'POST') {
    const u = await getUser(env, uid);
    if (body.deviceId) delete u.subs[body.deviceId];
    if (!Object.keys(u.subs).length) { await env.PUSH.delete('u:' + uid); await indexRemove(env, uid); }
    else await putUser(env, uid, u);
    return json({ ok: true }, 200, H);
  }

  if (url.pathname === '/test' && req.method === 'POST') {
    const u = await getUser(env, uid);
    const r = await sendToUser(u, { title: '🔔 Prueba del servidor', body: 'Las notificaciones funcionan aunque Latidia esté cerrada.', tag: 'test-server', data: { kind: 'test', url: './#/inicio' } }, env);
    if (r.changed) await putUser(env, uid, u);
    return json({ ok: true, delivered: r.delivered, devices: Object.keys(u.subs).length }, 200, H);
  }

  return json({ error: 'no encontrado' }, 404, H);
}

// ---------------------------------------------------------------- cron (cada minuto)
async function tick(env) {
  const now = Date.now();
  const users = (await env.PUSH.get('users', 'json')) || [];
  for (const uid of users) {
    const u = await getUser(env, uid);
    if (!Object.keys(u.subs || {}).length) continue;
    let changed = false;
    const due = [];
    for (const r of [...(u.reminders || []), ...(u.extra || [])]) {
      if (r.at <= now && now - r.at < WINDOW_MS && !u.sent[r.id]) due.push({ r, id: r.id });
      // segundo aviso si no se marcó como tomada
      const rid = r.id + ':r';
      if (r.repeatMin && u.sent[r.id] && !u.sent[rid] && r.at + r.repeatMin * 60000 <= now && now - (r.at + r.repeatMin * 60000) < WINDOW_MS) {
        due.push({ r: Object.assign({}, r, { title: '⏰ Recordatorio pendiente', body: r.body + ' — ¿ya la tomaste?' }), id: rid });
      }
    }
    for (const { r, id } of due) {
      const res = await sendToUser(u, { title: r.title, body: r.body, tag: r.id.split(':s')[0], data: r.data, actions: r.actions, requireInteraction: r.requireInteraction, sentId: id }, env);
      u.sent[id] = now; changed = true;
      if (res.changed) changed = true;
    }
    // limpieza
    const limit = now - 3 * 86400000;
    for (const k of Object.keys(u.sent)) if (u.sent[k] < limit) { delete u.sent[k]; changed = true; }
    const before = (u.reminders || []).length + (u.extra || []).length;
    u.reminders = (u.reminders || []).filter(r => r.at > now - 2 * WINDOW_MS - (r.repeatMin || 0) * 60000);
    u.extra = (u.extra || []).filter(r => r.at > now - WINDOW_MS);
    if (u.reminders.length + u.extra.length !== before) changed = true;
    if (changed) await putUser(env, uid, u);
  }
}

export default {
  fetch: (req, env) => handle(req, env).catch(e => json({ error: String(e && e.message || e) }, 500, cors(req, env))),
  scheduled: (event, env, ctx) => ctx.waitUntil(tick(env))
};
