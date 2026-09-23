/* Latidia — autenticación y sincronización con Firebase.
   Firestore es la fuente de verdad; IndexedDB (MS.DB) es una copia local que usa la app
   y el service worker (recordatorios en segundo plano y uso sin conexión). */
(function (g) {
  'use strict';
  const V = '12.19.0';
  const SDK = m => `https://www.gstatic.com/firebasejs/${V}/firebase-${m}.js`;
  const STORES = ['vitals', 'meds', 'intakes', 'appts', 'labs'];
  const cfg = g.FIREBASE_CONFIG || {};
  const DB = MS.DB;
  const local = { put: DB.put, del: DB.del, clear: DB.clear };

  const Cloud = {
    configured: !!(cfg.apiKey && cfg.projectId),
    failed: false,
    user: null,
    online: navigator.onLine,
    ready: null
  };
  g.Cloud = Cloud;

  let fb = null, fs = null, auth = null, unsubs = [];
  const isSynced = (store, obj) => STORES.includes(store) || (store === 'kv' && obj && obj.key === 'settings');
  const emit = (type, detail) => g.dispatchEvent(new CustomEvent(type, { detail }));

  // ---------- Carga del SDK ----------
  Cloud.ready = (async () => {
    if (!Cloud.configured) return;
    try {
      const [app, a, f] = await Promise.all([import(SDK('app')), import(SDK('auth')), import(SDK('firestore'))]);
      fb = { ...app, ...a, ...f };
      const fapp = fb.initializeApp(cfg);
      auth = fb.getAuth(fapp);
      auth.languageCode = 'es';
      fs = fb.initializeFirestore(fapp, {
        ignoreUndefinedProperties: true,
        localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() })
      });
      patchDB();
      await new Promise(resolve => {
        let first = true;
        fb.onAuthStateChanged(auth, async user => {
          Cloud.user = user;
          if (user) await startSync(user); else stopSync();
          if (first) { first = false; resolve(); } else emit('auth-changed', user);
        });
      });
    } catch (e) {
      console.error('Firebase no disponible', e);
      Cloud.failed = true;
    }
  })();

  g.addEventListener('online', () => { Cloud.online = true; emit('sync-status'); flushOutbox(); });
  g.addEventListener('offline', () => { Cloud.online = false; emit('sync-status'); });

  // ---------- Escrituras: local + nube ----------
  const ref = (store, id) => store === 'kv'
    ? fb.doc(fs, 'users', Cloud.user.uid, 'kv', id)
    : fb.doc(fs, 'users', Cloud.user.uid, store, String(id));

  function patchDB() {
    DB.put = async (store, obj) => {
      const r = await local.put(store, obj);
      if (Cloud.user && isSynced(store, obj)) fb.setDoc(ref(store, store === 'kv' ? obj.key : obj.id), obj).catch(warn);
      return r;
    };
    DB.del = async (store, id) => {
      await local.del(store, id);
      if (Cloud.user && (STORES.includes(store) || (store === 'kv' && id === 'settings'))) fb.deleteDoc(ref(store, id)).catch(warn);
    };
    DB.clear = async store => {
      const items = STORES.includes(store) ? await DB.all(store) : [];
      await local.clear(store);
      if (!Cloud.user) return;
      if (store === 'kv') return fb.deleteDoc(ref('kv', 'settings')).catch(warn);
      batchWrite(items.map(i => b => b.delete(ref(store, i.id))));
    };
  }
  const warn = e => console.warn('Sync:', e);

  function batchWrite(ops) {
    for (let i = 0; i < ops.length; i += 450) {
      const b = fb.writeBatch(fs);
      ops.slice(i, i + 450).forEach(op => op(b));
      b.commit().catch(warn); // se aplica al caché local al instante; sin red, se envía al reconectar
    }
  }

  // Cambios hechos por el service worker (ej. "✔ Tomada" desde la notificación)
  async function flushOutbox() {
    if (!Cloud.user) return;
    const box = await DB.getKV('outbox', []);
    if (!box.length) return;
    await local.put('kv', { key: 'outbox', value: [] });
    for (const it of box) {
      const obj = await DB.get(it.store, it.id);
      if (obj) fb.setDoc(ref(it.store, it.id), obj).catch(warn);
    }
  }
  Cloud.flushOutbox = flushOutbox;

  // ---------- Sincronización nube → local ----------
  async function startSync(user) {
    stopSync();
    const owner = await DB.getKV('owner', null);
    if (owner && owner !== user.uid) await wipeLocal();
    if (!owner) await uploadLegacy();              // datos creados antes de iniciar sesión
    await local.put('kv', { key: 'owner', value: user.uid });
    await flushOutbox(); // antes de escuchar, para que la reconciliación no borre esos cambios

    let changed = null;
    const notify = () => { clearTimeout(changed); changed = setTimeout(() => emit('cloud-data'), 120); };
    const firsts = [];
    for (const store of STORES) {
      firsts.push(new Promise(resolve => {
        let reconciled = false;
        unsubs.push(fb.onSnapshot(fb.collection(fs, 'users', user.uid, store), { includeMetadataChanges: true }, async snap => {
          for (const ch of snap.docChanges()) {
            if (ch.type === 'removed') await local.del(store, ch.doc.id);
            else await local.put(store, ch.doc.data());
          }
          // Primera respuesta del servidor: elimina de la copia local lo que ya no existe en la nube
          if (!reconciled && !snap.metadata.fromCache) {
            reconciled = true;
            const ids = new Set(snap.docs.map(d => d.id));
            for (const it of await DB.all(store)) if (!ids.has(String(it.id))) await local.del(store, it.id);
          }
          resolve(); notify();
        }, e => { warn(e); resolve(); }));
      }));
    }
    firsts.push(new Promise(resolve => {
      unsubs.push(fb.onSnapshot(ref('kv', 'settings'), async snap => {
        if (snap.exists()) await local.put('kv', snap.data());
        resolve(); notify();
      }, e => { warn(e); resolve(); }));
    }));
    // Con caché local la primera respuesta es inmediata; sin red no esperamos más de 5 s
    await Promise.race([Promise.all(firsts), new Promise(r => setTimeout(r, 5000))]);
  }

  function stopSync() { unsubs.forEach(u => u()); unsubs = []; }

  async function uploadLegacy() {
    const ops = [];
    for (const store of STORES) for (const it of await DB.all(store)) ops.push(b => b.set(ref(store, it.id), it));
    const settings = await DB.get('kv', 'settings');
    if (settings) ops.push(b => b.set(ref('kv', 'settings'), settings, { merge: true }));
    if (ops.length) { batchWrite(ops); emit('legacy-uploaded', ops.length); }
  }

  async function wipeLocal() {
    for (const s of STORES) await local.clear(s);
    for (const k of ['settings', 'owner', 'sent', 'snoozed', 'outbox']) await local.del('kv', k);
  }

  // ---------- Autenticación ----------
  const ERR = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/missing-password': 'Escribe tu contraseña.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'Sin conexión a internet.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
    'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado en Firebase.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La configuración de Firebase no es válida (apiKey).'
  };
  const wrap = fn => async (...args) => {
    try { return await fn(...args); }
    catch (e) {
      if (e.code === 'auth/cancelled-popup-request') return;
      throw new Error(ERR[e.code] || e.message.replace(/^Firebase: /, ''));
    }
  };

  Cloud.signIn = wrap((email, pass) => fb.signInWithEmailAndPassword(auth, email, pass));
  Cloud.signUp = wrap(async (name, email, pass) => {
    const cred = await fb.createUserWithEmailAndPassword(auth, email, pass);
    if (name) await fb.updateProfile(cred.user, { displayName: name });
    return cred;
  });
  Cloud.signInGoogle = wrap(() => fb.signInWithPopup(auth, new fb.GoogleAuthProvider()));
  Cloud.resetPassword = wrap(email => fb.sendPasswordResetEmail(auth, email));
  Cloud.signOut = async () => {
    stopSync();
    await fb.signOut(auth);
    await wipeLocal(); // los datos de salud no quedan en el dispositivo al cerrar sesión
  };
})(window);
