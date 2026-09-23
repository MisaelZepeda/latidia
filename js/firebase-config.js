/* Configuración de Firebase.
   Pega aquí los valores de: Consola de Firebase → Configuración del proyecto → Tus apps → App web → SDK setup (Config).
   Estos valores NO son secretos: la seguridad la dan las reglas de Firestore (firestore.rules).
   Mientras apiKey esté vacío, la app funciona en modo local (sin login ni sincronización). */
window.FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
