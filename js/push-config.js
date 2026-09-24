/* Servidor de notificaciones (Cloudflare Worker del proyecto, carpeta push-worker/).
   La clave VAPID pública no es secreta; la privada vive solo como secreto en Cloudflare. */
window.PUSH_CONFIG = {
  url: 'https://latidia-push.latidia-push.workers.dev',
  vapidPublicKey: 'BJZ5dh3PvqXVygy7zdx7zl2WskHf-7LoaJ_FKR4n8NtRfWYBj2mFBZVGaxF9oFveDA_sdjDxnazoDfuEcCjXaPc'
};
