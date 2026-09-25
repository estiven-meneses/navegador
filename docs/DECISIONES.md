# Registro de decisiones

Cada decisión de diseño con su motivo. **No revertir una decisión sin leer su justificación**
y, si se revierte, añadir una entrada nueva que explique por qué (no borrar la antigua).

Formato: `## D-NNN — Título (AAAA-MM-DD)` · Contexto · Decisión · Consecuencias.

---

## D-013 — La región que muestra un sitio también depende de cuentas y cookies, no solo de la huella (2026-09-24)
**Contexto:** perfil con proxy de EE. UU. mostraba sitios en español/Latam. Investigado: IP, zona horaria,
idioma y cabeceras eran de EE. UU.; un perfil limpio se ve 100% estadounidense. La región venía de las
cuentas iniciadas (Google, Eneba) y de cookies antiguas del perfil migrado.
**Decisión:** no "forzar" idioma en los sitios (sería otra incoherencia): una laptop real de EE. UU. con una
cuenta de Google en español también ve Google en español. Se documenta la regla para el dueño:
**un perfil = una identidad = un país**. Para cambiar de país de verdad, crear un perfil nuevo e iniciar sesión
con cuentas configuradas en ese idioma/región. La UI avisa al cambiar el país de un perfil ya usado.
El corrector ortográfico sí se alinea con el país (Preferences).

---

## D-012 — Idioma de `Intl` en macOS se deja como el del sistema (2026-09-24)
**Contexto:** en macOS Chromium ignora `--lang`; `Intl.DateTimeFormat().resolvedOptions().locale`
devuelve el idioma del sistema (en-US) aunque `navigator.languages` sea `es-SV`. Probado:
Playwright rechaza el truco `-AppleLanguages (es-SV)` ("Arguments can not specify page").
**Decisión:** se acepta. "Sistema en inglés + navegador que prefiere español" es una configuración
real y común, no una contradicción imposible. La alternativa (`defaults write` sobre la app
Chromium) sería global para todos los perfiles y afectaría a otras apps.
**Consecuencias:** si algún sitio lo penaliza, revisar esta decisión (ver PENDIENTES).

## D-011 — Ajustar la ventana a la pantalla de la huella (2026-09-24)
**Contexto:** en un Mac de 1680 px lógicos la huella reportó `screen` 1440×900; con
`--start-maximized` la ventana medía 1680 → `outerWidth > screen.width`, imposible en un equipo real.
**Decisión:** al arrancar, `window.js` lee `screen.avail*` en about:blank y redimensiona la
ventana por CDP (`Browser.setWindowBounds`). Una sola llamada, antes de visitar sitios.

## D-010 — Probar el nodo del proxy con un túnel HTTPS y rotar si falla (2026-09-24)
**Contexto:** con sesiones sticky, ~1 de cada 6 `sessid` de DataImpulse cae en un nodo que responde
HTTP plano pero rechaza CONNECT (`502 NO_HOST_CONNECTION` o `405`). Con IP rotativa no se notaba.
**Decisión:** `ipCheck` abre primero un túnel HTTPS (ipwho.is); si falla → `PROXY_NODE_BAD` y
`sessionManager.resolveExit` pide otra IP (hasta 4 intentos). El monitor de sesión avisa si el nodo
muere después (`PROXY_NODE_DIED`) y la UI ofrece "Nueva IP".

## D-009 — Cambiar ubicación = reiniciar el navegador (2026-09-24)
**Contexto:** la versión 1 cambiaba el proxy en caliente, pero la zona horaria (flag del proceso) y la
IP de WebRTC se quedaban con el país anterior → incoherencia grave.
**Decisión:** cambiar país/ciudad o pedir IP nueva reinicia la sesión (`relaunch`) y reabre las
pestañas http(s). Cookies y sesiones se conservan (perfil persistente).

## D-008 — Proxy local por sesión en vez de pasar credenciales a Chromium (2026-09-24)
**Decisión:** cada sesión levanta `proxy-chain` en 127.0.0.1:<puerto libre>. Chromium no ve
credenciales (Playwright las inyectaría por CDP en cada petición), los bytes medidos son los reales
del proxy y varios perfiles pueden estar abiertos a la vez con proxies distintos.

## D-007 — Timezone y GPS desde la IP de salida real, no desde tablas (2026-09-24)
**Decisión:** `ipCheck` consulta la IP real a través del mismo `sessid`; su zona horaria y coordenadas
alimentan la huella. `geo/locations.js` solo es respaldo si la consulta falla. El permiso de
geolocalización NO se concede automáticamente (un navegador real pregunta).

## D-006 — Sesión sticky de DataImpulse por perfil (2026-09-24)
**Contexto:** v1 usaba solo `__cr.xx`: IP distinta en cada conexión → los sitios ven la IP saltar.
**Decisión:** usuario `LOGIN__cr.<pais>[;city.<ciudad>];sessid.<id>r<rotation>;sessttl.<min>`
(docs: docs.dataimpulse.com/proxies/parameters). `sessttl` por defecto 60 (`PROXY_SESSION_TTL_MIN`).
Cambiar país/ciudad incrementa `rotation` automáticamente. La ciudad cuesta el doble en DataImpulse
(aviso en la UI).

## D-005 — Semilla de huella fija por perfil (2026-09-24)
**Contexto:** CloakBrowser genera `--fingerprint=<aleatorio>` en cada arranque si no se le pasa uno;
v1 no lo pasaba → mismas cookies con un "dispositivo" distinto cada vez (muy sospechoso para Google).
**Decisión:** `profile.fingerprint.seed` se genera al crear el perfil y se pasa siempre. Solo cambia
con el botón "Generar otra" (acción explícita del dueño).

## D-004 — No forzar User-Agent (2026-09-24)
**Contexto:** v1 forzaba "Windows, Chrome 123" sobre un Chromium 145 de macOS: UA, Client Hints,
`navigator.platform` y la GPU se contradecían.
**Decisión:** nunca se pasa `userAgent`. Verificado: UA de cabecera = UA de JS = Client Hints
(Chrome 145, macOS).

## D-003 — Perfiles en `profiles/<id>/` con metadatos, migración automática (2026-09-24)
**Decisión:** carpeta por id interno + `profile.json`. Los perfiles antiguos `sessions/<nombre>/` se
**mueven** (no copian) a `profiles/<id>/browser-data` al arrancar, conservando cookies. Quedan con
`needsSetup: true` y el país adivinado por el nombre, para que el dueño confirme antes de abrirlos
(así nunca se abre por error sin proxy un perfil que antes usaba proxy).

## D-002 — Registro de errores con estado en JSON local (2026-09-24)
**Decisión:** `logs/errors.json` (incidencias deduplicadas con estados open/fixed/ignored, historial y
reapertura automática) + `logs/app/AAAA-MM-DD.jsonl`. JSON y no base de datos: cero dependencias,
legible por cualquier IA con un `cat`. CLI `npm run errors` para agentes; pestaña "Errores" para el
dueño. `logs/` no se sube a git (puede contener URLs visitadas).

## D-001 — Arquitectura modular en `src/` y eliminación del CLI de terminal (2026-09-24)
**Decisión:** la lógica vive en `src/` por dominio (browser, proxy, profiles, logging, usage, geo,
server). Se eliminó el menú de terminal (`cli.js`, `utils/menu.js`): duplicaba la interfaz web y
tenía la misma lógica copiada. Sigue en el historial de git (commit 0015b30) si se quiere recuperar.
Dependencias: se quitan `playwright`, `playwright-extra` y `cors` (no usadas / CORS abierto era un
riesgo); se usa `playwright-core`, que es lo que necesita CloakBrowser.
