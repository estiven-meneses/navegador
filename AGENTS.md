# AGENTS.md — Instrucciones para cualquier agente de IA

> Este archivo es el punto de entrada para **cualquier** IA que trabaje en este proyecto
> (Claude, Codex, Cursor, Copilot, Gemini…). Léelo completo antes de tocar código.
> `CLAUDE.md` solo redirige aquí.

## Qué es este proyecto

**StealthBrowser**: un gestor de perfiles de navegador anti-detección al estilo GoLogin, para uso
personal del dueño (Estiven). Cada perfil equivale a **un dispositivo fijo + una ubicación**: su
propia huella, cookies y sesiones, y un proxy residencial (DataImpulse) del país/ciudad elegido.

**Objetivo del dueño:** navegar sin captchas ni detección de "navegador falso". Todo debe ser
auténtico y **coherente**: la IP, la zona horaria, el idioma, el GPS y WebRTC deben contar la
misma historia.

- Interfaz web: `npm start` → http://localhost:3000
- Motor: [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) (Chromium parcheado en C++) + Playwright.
- Idioma del proyecto: **español** (código comentado en español, UI en español, docs en español).

## Regla de oro: DEJA NOTAS

El dueño puede cambiar de IA en cualquier momento. Lo que no quede escrito se pierde.
**Al terminar cualquier tarea**, antes de dar tu respuesta final:

1. **`docs/BITACORA.md`**: añade una entrada arriba con la fecha, qué pidió el dueño, qué hiciste,
   qué quedó pendiente y el commit.
2. **`docs/DECISIONES.md`**: si tomaste una decisión de diseño (por qué X y no Y), regístrala.
   Si vas a revertir una decisión existente, lee primero su justificación.
3. **`docs/PENDIENTES.md`**: marca lo que terminaste y añade lo nuevo que descubriste.
4. **`docs/ARQUITECTURA.md`**: actualízalo si añadiste, moviste o borraste módulos.
5. Si corregiste errores del registro: márcalos como resueltos (ver abajo).

Nunca borres entradas antiguas de la bitácora ni de las decisiones: son la memoria del proyecto.

## Cuando el dueño diga "revisa los errores" (o "revisa los logs")

Todos los errores se registran solos, con fecha y estado, en `logs/errors.json`.
Flujo obligatorio:

```bash
npm run errors                 # 1. lista las incidencias ABIERTAS (lo pendiente)
npm run errors -- show ERR-0003   # 2. detalle: stack, contexto de la última vez, historial
npm run errors -- logs         # (opcional) registro del día, para ver qué pasó alrededor
```

3. Reproduce/entiende la causa raíz. **No tapes el síntoma** (p.ej. no silencies un catch).
4. Corrige el código, ejecuta `npm test`, y verifica en la app si aplica.
5. Haz commit y marca la incidencia con la nota de qué cambiaste y el commit:

```bash
npm run errors -- fix ERR-0003 "Explicación del arreglo" --commit <sha> --by "<tu nombre de IA>"
npm run errors -- ignore ERR-0007 "Por qué no es un bug (p.ej. sitio caído)"
```

- Si una incidencia marcada como resuelta **vuelve a ocurrir, se reabre sola** y suma una
  regresión. Una incidencia con regresiones significa que el arreglo anterior no bastó:
  lee su historial antes de volver a intentarlo.
- Las incidencias `source: detection` (captchas, desafíos de Cloudflare) no son errores de código,
  sino **señales de que un sitio sospechó**. Analiza el contexto (sitio, IP, país, huella) buscando
  patrones antes de cambiar nada; anota lo aprendido en `docs/DECISIONES.md`.
- Los estados posibles son: `open` (presente), `fixed` (resuelto), `ignored` (no es bug).

## Mapa rápido del código

Detalle completo en `docs/ARQUITECTURA.md`.

```
server.js                       entrada (solo llama a src/server/app.js)
src/config.js                   .env, rutas y constantes (todo lo global sale de aquí)
src/server/app.js               API REST + captura de errores de rutas y del proceso
src/browser/sessionManager.js   abrir/cerrar/reiniciar navegadores (varios a la vez)
src/browser/launchOptions.js    REGLAS DE COHERENCIA de la huella (léelo antes de tocar la huella)
src/browser/window.js           ajusta la ventana a la pantalla de la huella
src/browser/chromePrefs.js      Accept-Language y cierre limpio en Preferences de Chromium
src/browser/detection.js        detecta captchas/desafíos y los registra
src/proxy/upstream.js           usuario de DataImpulse (país, ciudad, sesión fija)
src/proxy/ipCheck.js            IP de salida real + geolocalización + salud del nodo
src/proxy/localProxy.js         proxy local por sesión (sin credenciales en Chromium, mide bytes)
src/profiles/profileStore.js    perfiles en profiles/<id>/ (+ migración del formato antiguo)
src/geo/locations.js            países, idiomas y ciudades sugeridas
src/usage/usageStore.js         consumo del plan de proxy
src/logging/                    logger (logs/app/AAAA-MM-DD.jsonl) + registro de incidencias
scripts/errors.js               CLI `npm run errors`
public/                         interfaz (HTML + JS sin frameworks, Tailwind por CDN)
test/                           pruebas `npm test` (node:test, sin dependencias)
```

## Reglas técnicas que no se deben romper

1. **Nunca forzar el User-Agent.** El binario genera el UA coherente con su versión y plataforma.
2. **La semilla de huella es fija por perfil** (`profile.fingerprint.seed`). Solo cambia si el dueño lo pide.
3. **Zona horaria, GPS e IP de WebRTC salen de la IP de salida real** (`ipCheck`), no de tablas.
4. **Sesión fija (sticky) de DataImpulse por perfil.** Nada de IP rotativa a mitad de la navegación.
5. **Cambiar de ubicación = reiniciar el navegador** (la zona horaria es un flag del proceso).
6. `locale`/`timezone` van por flags del binario, **nunca** por emulación CDP (`contextOptions.locale`).
7. No abusar de `page.evaluate`/CDP en páginas de terceros: es detectable (reCAPTCHA lo mira).
8. **Secretos**: nunca escribas credenciales del proxy en logs, docs ni commits. El logger las redacta
   (`src/logging/redact.js`); si añades un logger nuevo, pásalo por ahí.
9. La API solo escucha en `127.0.0.1` (puede abrir navegadores y borrar perfiles).
10. Todo `catch` que no relance debe registrar con `log.warn/error` (con `code`), nunca tragarse el error en silencio.

## Cómo registrar errores en código nuevo

```js
const log = require('../logging/logger').child('nombre-modulo');
log.info('Algo normal', { context: { ... } });                  // solo registro diario
log.warn('Algo raro pero esperable', { code: 'X', track: false }); // solo registro diario
log.warn('Algo raro que hay que revisar', { code: 'X' , track: true }); // + incidencia
log.error('Falló algo', { err, code: 'CODIGO_ESTABLE', context: { ... } }); // + incidencia
```

Usa un `code` estable y descriptivo: agrupa mejor las incidencias que el texto del mensaje.

## Datos locales (no están en git)

- `.env`: credenciales del proxy (ver `.env.example`).
- `profiles/`: perfiles del navegador (cookies, logins). **Borrarlos es irreversible.**
- `logs/`: registro diario y `errors.json`.
- `data/usage.json`: consumo del proxy.

## Verificación antes de dar algo por terminado

- `npm test` en verde.
- Si tocaste la huella o el proxy: abre un perfil real y comprueba la coherencia en
  https://browserleaks.com/ip, /webrtc y https://pixelscan.net (IP, zona horaria, idioma, sin fugas).
- `npm run errors` no debe mostrar incidencias nuevas causadas por tu cambio.
