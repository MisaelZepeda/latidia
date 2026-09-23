# Latidia — Monitoreo personal de salud

App web progresiva (PWA) para registrar **presión arterial, pulso y otros signos vitales**, controlar la **toma de medicamentos**, llevar un **calendario de citas médicas y exámenes**, generar **reportes por rango de fechas** (PDF / CSV) y recibir **notificaciones** en el celular y la computadora.

HTML + CSS + JavaScript puro, alojada en GitHub Pages, con **inicio de sesión y sincronización en la nube con Firebase** (tus datos en todos tus dispositivos).

## Funciones

| Sección | Qué hace |
|---|---|
| **Ficha médica** | Tarjeta de vistazo rápido en Inicio y ficha completa: nombre, edad, sexo, tipo de sangre, CURP (autocompleta fecha de nacimiento y sexo) y NSS ocultos por defecto, institución y clínica, alergias, padecimientos, medicamentos actuales, estatura/peso/IMC, última presión, contacto de emergencia y médico tratante con botón para llamar. Exportable a PDF. **Tarjeta médica** tamaño credencial con código QR (datos esenciales como texto, se lee sin internet): se guarda como imagen en Fotos o se imprime en PDF (frente y reverso, para recortar y doblar) |
| **Inicio** | Última toma, promedios de 7 días, dosis de hoy, próximas citas y tendencia de 14 días |
| **Signos** | Presión (sistólica/diastólica), pulso, temperatura, SpO₂, glucosa y peso. Clasificación automática AHA/ACC 2017 y gráfico |
| **Medicinas** | Presentación (tableta, cápsula, jarabe, suspensión…), dosis con unidad (mg, g, ml, UI…) y cantidad por toma. Frecuencia *cada X horas* desde la primera toma (calcula automáticamente las siguientes tomas, la fecha final y el total del tratamiento) u horarios fijos por día. Marcar dosis tomada/omitida (con confirmación para desmarcar), adherencia, exportación de alarmas al calendario del teléfono (.ics) |
| **Agenda** | Calendario mensual de consultas, exámenes y otros eventos, con recordatorio configurable y aviso un día antes |
| **Análisis** | Resultados de laboratorio: importa el PDF del laboratorio (se lee en el dispositivo con pdf.js; solo se guardan los valores) con pantalla de revisión, o captura manual. Marca valores altos/bajos según la referencia del laboratorio, tendencia por parámetro, aviso de duplicados, enlace desde exámenes de la Agenda, resumen en la ficha y sección opcional en el reporte PDF |
| **Reportes** | Rango por fechas o atajos (7/30/90 días, este mes, mes anterior): promedios, mín–máx, clasificación, promedios por horario, adherencia y tabla. **PDF profesional tamaño carta** (encabezado, datos del paciente y edad, resumen, gráfica, clasificación, medicamentos, detalle y numeración de páginas) y CSV para Excel. En el celular se abre el menú de compartir (guardar en Archivos, imprimir, WhatsApp, correo) |
| **Cuenta** | Inicio de sesión con correo/contraseña o Google, recuperación de contraseña, sincronización en tiempo real y uso sin conexión |
| **Ajustes** | Perfil para reportes, notificaciones, horarios para medir la presión, tema claro/oscuro, respaldo e importación JSON |

## Configurar Firebase (login y sincronización)

Sin configurar, la app funciona en **modo local** (datos solo en el dispositivo). Para activar el login:

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto** (puedes desactivar Google Analytics). El plan gratuito *Spark* es suficiente.
2. **Authentication** → *Comenzar* → pestaña **Método de inicio de sesión**: habilita **Correo electrónico/contraseña** y (opcional) **Google**.
3. **Authentication → Configuración → Dominios autorizados** → *Agregar dominio*: `TU_USUARIO.github.io` (`localhost` ya viene incluido).
4. **Firestore Database** → *Crear base de datos* → modo **producción** → elige la región más cercana (p. ej. `us-central1` o `southamerica-east1`).
5. En Firestore → pestaña **Reglas**, reemplaza el contenido por el de [`firestore.rules`](firestore.rules) y pulsa **Publicar**. Así cada usuario solo puede ver sus propios datos.
6. **Configuración del proyecto** (engrane) → *Tus apps* → ícono **</>** (Web) → registra la app → copia el objeto `firebaseConfig` y pega sus valores en [`js/firebase-config.js`](js/firebase-config.js).
7. Sube los cambios a GitHub. Listo: abre la app, crea tu cuenta y entra con la misma cuenta en el celular y la computadora.

> Los valores de `firebase-config.js` no son secretos (Firebase los expone a propósito); la protección de los datos la dan las reglas de Firestore y el login.

**Cómo se guardan los datos:** Firestore en `users/{tuUID}/vitals|meds|intakes|appts` y `users/{tuUID}/kv/settings`. Cada dispositivo mantiene además una copia local (IndexedDB) que permite usar la app sin conexión y enviar recordatorios; los cambios hechos sin conexión se suben solos al reconectar. Al **cerrar sesión** se borra la copia local del dispositivo (tus datos siguen en tu cuenta). Si ya tenías datos antes de iniciar sesión, se suben automáticamente a tu cuenta la primera vez.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `medicsoft`).
2. Sube el contenido de esta carpeta:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/medicsoft.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
4. En uno o dos minutos estará en `https://TU_USUARIO.github.io/medicsoft/`.

## Instalar la app

- **Android (Chrome):** abre la URL → menú ⋮ → *Instalar aplicación*.
- **iPhone/iPad (Safari, iOS 16.4+):** botón *Compartir* → *Agregar a pantalla de inicio*. Abre la app desde el ícono y luego activa las notificaciones en *Ajustes*.
- **Windows/Mac (Chrome o Edge):** ícono de instalar en la barra de direcciones, o el botón *Instalar app* en la barra lateral.

## Cómo funcionan las notificaciones

GitHub Pages solo sirve archivos estáticos, así que no hay un servidor que envíe notificaciones push. La app revisa los recordatorios desde el propio dispositivo:

- **App abierta o minimizada** (celular o computadora): los avisos llegan a su hora. Las notificaciones de medicamentos incluyen botones **✔ Tomada** y **⏰ 10 min**.
- **App cerrada:** en Chrome/Edge con la app instalada se usa *Periodic Background Sync*, pero el navegador decide cuándo ejecutarla (no es exacta).
- **Para alarmas garantizadas aunque la app esté cerrada**, usa **Añadir a calendario** (Medicamentos) y **Exportar citas** (Agenda). Se descarga un archivo `.ics` con eventos repetitivos y alarmas que tu calendario (Google, Outlook, iCloud) hará sonar siempre.

## Privacidad y datos

Con Firebase configurado, tus datos se guardan en tu propio proyecto de Firebase, protegidos por tu cuenta y las reglas de seguridad; nadie más puede leerlos. En **Ajustes → Exportar respaldo** puedes descargar una copia en JSON cuando quieras. En modo local, los datos viven solo en el dispositivo.

## Desarrollo local

```bash
python -m http.server 5173
```
Abre `http://localhost:5173`. (El service worker y las notificaciones requieren `localhost` o HTTPS.)

Al publicar cambios, sube el número de `CACHE` en `sw.js` (`medicsoft-v2`, `v3`…) para que los dispositivos instalados descarguen la versión nueva.

---
*Latidia es una herramienta de registro personal, no un dispositivo médico. Ante valores alarmantes o síntomas, consulta a tu médico.*
