# Bitácora de trabajo

Una entrada por sesión de trabajo, **la más reciente arriba**. Nunca borres entradas.

Plantilla:
```
## AAAA-MM-DD — Título corto (agente: nombre)
**Pedido:** qué pidió el dueño, con sus palabras resumidas.
**Hecho:** qué se cambió y dónde.
**Verificado:** cómo se comprobó (tests, prueba real…).
**Pendiente / avisos:** lo que quedó abierto.
**Commit:** sha
```

---

## 2026-09-24 (noche) — "Con proxy de EE. UU. las páginas salen en español/Latam" (agente: Claude Code)
**Pedido:** con el perfil "usa" (proxy EE. UU.) Eneba abría `eneba.com/latam/` en "Español Latinoamericano" y
otras páginas salían en español; el dueño espera ver todo como en una laptop de EE. UU.

**Investigación (con evidencia):**
- La sesión era correcta: IP residencial Comcast (Yuba City, CA), tz `America/Los_Angeles`, idioma `en-US`,
  Accept-Language `en-US,en`.
- Perfil limpio de EE. UU. (sin cuentas): Eneba → "English · USD", Amazon → "Delivering to Santa Clara 95050",
  YouTube → inglés. **La huella y la IP se ven de EE. UU.**
- Causa real: identidad, no huella. (1) El perfil "usa" es migrado y tiene cookies de Google/YouTube desde
  2026-04-20 (creadas con la v1, a veces sin proxy). Google guarda el idioma en sus cookies/cuenta → resultados
  en español que enlazan a versiones Latam (`/latam/?srsltid=...` viene de un resultado de Google).
  (2) La cookie `lng` de Eneba se creó 2 s después de la cookie `auth` (inicio de sesión): Eneba aplicó el
  idioma guardado en la cuenta del dueño.
- Captcha de Google: 4/4 perfiles limpios recibieron `/sorry` con IPs distintas de EE. UU. Control: **Google
  Chrome original, sin automatizar, perfil vacío e IP real también recibió `/sorry`** → no es culpa del navegador
  anti-detección; Google desconfía de perfiles vacíos que buscan de inmediato (y las búsquedas de prueba
  repetidas empeoran la reputación). OJO: curl recibe 200 aunque un navegador sería bloqueado (el chequeo es JS);
  no usar curl como control para Google. No hacer más búsquedas de prueba en Google desde la IP real.

**Hecho:**
- `chromePrefs.js`: el corrector ortográfico sigue al idioma del país (el perfil "usa" lo tenía en `es`). Test nuevo.
- UI: aviso al cambiar el país de un perfil ya usado (las cuentas y cookies recuerdan la región anterior).
- Docs: D-013.

**Pendiente / avisos:** PENDIENTES (calentamiento de perfiles nuevos, limpiar cookies por sitio).
El cambio de `chromePrefs` aplica al reiniciar el servidor (`npm start`).

**Commit:** 4223b44 (rama `v2-perfiles-coherentes`)

---

## 2026-09-24 — Reconstrucción v2: errores con estado, coherencia estilo GoLogin, memoria para IA (agente: Claude Code)
**Pedido:** (1) registrar todos los errores con fecha y estado (resuelto/presente) para que una IA
los revise y corrija con "revisa los errores"; (2) mejorar mucho el programa para que funcione como
GoLogin: sin captchas ni detección, proxy del país/ciudad elegido, todo coherente; (3) estructura y
notas para que cualquier IA recuerde todo.

**Diagnóstico de la v1 (causas probables de captchas/detección):**
- UA forzado "Windows Chrome 123" sobre Chromium 145 de macOS (contradicción UA/Client Hints/plataforma).
- Semilla de huella aleatoria en cada arranque (mismo perfil, dispositivo distinto cada vez).
- IP rotativa por conexión (sin `sessid`).
- Geolocalización nunca aplicada (CloakBrowser ignoraba esa opción donde se pasaba).
- Cambio de país en caliente dejaba la zona horaria anterior.
- Seguridad: API en todas las interfaces con CORS abierto; nombres de perfil con `../` podían borrar
  carpetas arbitrarias.

**Hecho:**
- Nueva arquitectura `src/` (ver ARQUITECTURA.md) y eliminación del CLI de terminal duplicado.
- Registro de errores: `logs/errors.json` + `logs/app/<día>.jsonl`, CLI `npm run errors`, pestaña Errores.
- Huella coherente (D-004 a D-011), detección de captchas, monitor de IP, ventana ajustada.
- Perfiles con id, semilla fija, país/ciudad, "Nueva IP", "Generar otra huella", migración automática
  de `sessions/` (copia de seguridad en `../navegador-backup-sessions-2026-09-24/`).
- Consumo medido en bytes reales del proxy; pestaña Consumo con sincronización de saldo.
- CloakBrowser 0.3.25 → 0.5.11 (mismo binario en Mac); `npm audit` → 0 vulnerabilidades.
- Documentación: AGENTS.md, CLAUDE.md, docs/.

**Verificado:** `npm test` (12 pruebas). Prueba real por proxy de El Salvador: UA = Client Hints
(Chrome 145 macOS), `webdriver=false`, tz `America/El_Salvador` = IP, Accept-Language `es-SV,es`
= `navigator.languages`, WebRTC "No Leak" en browserleaks, ventana 1440×805 dentro de pantalla
1440×900, consumo medido. Ciclo de errores: detectado → resuelto → reabierto automáticamente.

**Pendiente / avisos:** ver PENDIENTES.md (binario Chromium 151 requiere `npx cloakbrowser login`
del dueño). Los perfiles migrados "platzi salvador" y "usa" necesitan que el dueño confirme su
ubicación (botón Editar → Guardar) antes de abrirlos.

**Commit:** 4223b44 (rama `v2-perfiles-coherentes`)
