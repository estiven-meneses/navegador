# Arquitectura

Última revisión: 2026-09-24 (v2.0.0)

## Visión general

```
 Navegador del usuario (UI)            Node.js (server.js → src/)                         Internet
 ┌──────────────────────┐   HTTP    ┌──────────────────────────────┐
 │ public/index.html    │ ────────► │ server/app.js (API REST)     │
 │ public/app.js        │ ◄──────── │   ├─ profiles/profileStore   │
 └──────────────────────┘ 127.0.0.1 │   ├─ browser/sessionManager ─┼─► CloakBrowser (Chromium parcheado)
                                    │   │     │                    │        │ proxy http://127.0.0.1:<libre>
                                    │   │     ▼                    │        ▼
                                    │   │  proxy/localProxy ───────┼─► gw.dataimpulse.com:823 ──► sitio web
                                    │   │  (1 por sesión)          │     usuario: login__cr.sv;city.x;sessid.y;sessttl.60
                                    │   ├─ usage/usageStore        │
                                    │   └─ logging/ (logger+errores)
                                    └──────────────────────────────┘
```

## Arranque de un perfil (sessionManager.launch)

1. **upstream.js** construye el usuario de DataImpulse con país, ciudad opcional, `sessid` fijo
   del perfil (`<id>r<rotation>`) y `sessttl` (minutos que se mantiene la IP).
2. **ipCheck.js** abre un túnel HTTPS por ese proxy (prueba de salud del nodo) y obtiene la IP de
   salida y su geolocalización real (ip-api.com, respaldo ipwho.is).
   - Nodo roto (≈1/6 de sesiones sticky) o país equivocado → `rotateIp` y reintento (máx. 4).
3. **localProxy.js** levanta un proxy local en un puerto libre que reenvía a DataImpulse.
4. **chromePrefs.js** escribe en `Preferences` el Accept-Language coherente y el cierre limpio.
5. **launchOptions.js** arma las opciones de CloakBrowser (ver reglas de coherencia abajo).
6. CloakBrowser abre Chromium con `launchPersistentContext` sobre `profiles/<id>/browser-data`.
7. **window.js** ajusta la ventana a la pantalla que reporta la huella.
8. Se enganchan: detección de captchas, caídas de pestaña, monitor de IP (cada 5 min),
   guardado de consumo (cada 1 min). Se abre la URL de inicio.

Cerrar la ventana a mano o `POST /stop` → `cleanup`: guarda consumo, cierra el proxy local.

## Reglas de coherencia de la huella

| Señal | De dónde sale | Por qué |
|---|---|---|
| User-Agent / Client Hints | El binario de CloakBrowser (nunca se fuerza) | Un UA inventado contradice versión/plataforma reales |
| Canvas, WebGL, audio, GPU, fuentes… | Semilla fija `--fingerprint=<seed>` por perfil | Mismo perfil = mismo dispositivo siempre |
| Plataforma | Nativa (macOS en Mac) | En Mac el binario gratis no puede imitar Windows de forma coherente |
| Zona horaria | IP de salida real (`--fingerprint-timezone`) | Debe coincidir con la IP |
| Idioma (`navigator.languages`, Accept-Language) | País del proxy o `profile.locale` (`--lang` + Preferences) | Ambos deben coincidir entre sí |
| Geolocalización | Coordenadas de la IP ± desplazamiento fijo por semilla (≤1,5 km); permiso NO concedido | Un GPS real está cerca de la IP; los sitios preguntan como siempre |
| WebRTC | `--fingerprint-webrtc-ip=<IP de salida>` | Sin fuga de la IP real (verificado: "No Leak") |
| Tamaño de ventana | Ajustado a `screen.avail*` de la huella | Ventana > pantalla es imposible en un equipo real |
| IP | Sesión sticky por perfil | La IP no salta a mitad de la navegación |

## Almacenamiento

```
profiles/<id>/profile.json      { id, name, notes, fingerprint:{seed}, proxy:{enabled,country,city,rotation},
                                  locale, startUrl, lastExit, lastLaunchedAt, needsSetup, ... }
profiles/<id>/browser-data/     directorio de usuario de Chromium
logs/app/AAAA-MM-DD.jsonl       todos los eventos del día (una línea JSON por evento)
logs/errors.json                incidencias deduplicadas con estado e historial
data/usage.json                 consumo del proxy (total y por perfil)
```

El `<id>` es interno (`p` + 8 hex): renombrar un perfil solo cambia el JSON y ningún nombre puede
salir de la carpeta.

## Registro de errores

- `logger.js`: `log.info/warn/error`. Todo va al archivo diario; `error` (y `warn` con `track:true`)
  crea o actualiza una incidencia.
- `errorTracker.js`: huella = hash(origen + código + mensaje normalizado + primer frame del stack).
  Los números, IPs y hex se normalizan, así el mismo error con datos distintos se agrupa.
  Si una incidencia `fixed` reaparece, pasa a `open` y `regressions++`.
- `redact.js`: quita credenciales del proxy de todo lo que va a disco.
- Fuentes de captura: rutas Express (middleware final), `uncaughtException`/`unhandledRejection`,
  errores JS de la interfaz (`window.onerror` → `POST /api/errors/report`), proxy local,
  sesiones de navegador y detección de captchas.

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | /api/profiles | lista (con `running`) |
| POST | /api/profiles | crear |
| PUT | /api/profiles/:id | editar (si está abierto, la UI llama después a relaunch) |
| DELETE | /api/profiles/:id | borrar (409 si está abierto) |
| POST | /api/profiles/:id/fingerprint | nueva huella |
| POST | /api/profiles/:id/launch · /stop · /relaunch `{rotate}` · /rotate-ip | sesiones |
| GET | /api/sessions | sesiones abiertas (IP, huella, bytes) |
| GET | /api/countries | países y ciudades |
| GET | /api/usage · POST /api/usage/balance | consumo |
| GET | /api/errors?status= · PATCH /api/errors/:id `{status,note}` · POST /api/errors/report | errores |
| GET | /api/logs?date= | registro del día |
