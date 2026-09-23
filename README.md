# MedicSoft — Monitoreo personal de salud

App web progresiva (PWA) para registrar **presión arterial, pulso y otros signos vitales**, controlar la **toma de medicamentos**, llevar un **calendario de citas médicas y exámenes**, generar **reportes por rango de fechas** (PDF / CSV) y recibir **notificaciones** en el celular y la computadora.

Sin servidores ni dependencias: HTML + CSS + JavaScript puro, lista para GitHub Pages.

## Funciones

| Sección | Qué hace |
|---|---|
| **Inicio** | Última toma, promedios de 7 días, dosis de hoy, próximas citas y tendencia de 14 días |
| **Signos** | Presión (sistólica/diastólica), pulso, temperatura, SpO₂, glucosa y peso. Clasificación automática AHA/ACC 2017 y gráfico |
| **Medicinas** | Horarios y días por medicamento, marcar dosis tomada/omitida, adherencia, exportación de alarmas al calendario del teléfono (.ics) |
| **Agenda** | Calendario mensual de consultas, exámenes y otros eventos, con recordatorio configurable y aviso un día antes |
| **Reportes** | Rango por fechas o atajos (7/30/90 días, este mes, mes anterior): promedios, mín–máx, clasificación, promedios por horario, adherencia y tabla. Imprimir/Guardar PDF, CSV para Excel y Compartir |
| **Ajustes** | Perfil para reportes, notificaciones, horarios para medir la presión, tema claro/oscuro, respaldo e importación JSON |

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

Todo se guarda **solo en tu dispositivo** (IndexedDB). No se envía nada a ningún servidor. Cada dispositivo tiene sus propios datos: usa **Ajustes → Exportar respaldo / Importar** para pasar tu información entre el celular y la computadora y para no perderla.

## Desarrollo local

```bash
python -m http.server 5173
```
Abre `http://localhost:5173`. (El service worker y las notificaciones requieren `localhost` o HTTPS.)

Al publicar cambios, sube el número de `CACHE` en `sw.js` (`medicsoft-v2`, `v3`…) para que los dispositivos instalados descarguen la versión nueva.

---
*MedicSoft es una herramienta de registro personal, no un dispositivo médico. Ante valores alarmantes o síntomas, consulta a tu médico.*
