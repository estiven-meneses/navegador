# Pendientes y mejoras futuras

Ordenado por impacto. Marca con `[x]` lo terminado (con fecha) en vez de borrarlo.

## Alta prioridad
- [ ] **Binario más nuevo de CloakBrowser** (Chromium 151, 87 parches vs. 145 con 26 en Mac).
      Requiere clave gratuita: el dueño debe ejecutar `npx cloakbrowser login` (inicio de sesión con
      GitHub). Límite gratis: 1 sesión simultánea. Tras activarla, verificar coherencia en
      browserleaks/pixelscan y registrar el resultado en DECISIONES.
- [ ] Revisar incidencias `detection` (captchas) tras unos días de uso real y buscar patrones
      (¿sitio?, ¿país?, ¿IP marcada?).

## Media
- [ ] "Calentar" perfiles nuevos (navegación inicial automática suave para crear cookies/historial):
      Google muestra captcha a perfiles vacíos que buscan de inmediato, incluso con Chrome original (ver BITACORA 2026-09-24 noche).
- [ ] Botón "Borrar datos de un sitio" por perfil (p.ej. cookies de google.com) para quitar preferencias de región antiguas.
- [ ] Idioma de `Intl` en macOS (ver D-012) si algún sitio lo penaliza.
- [ ] Importar/exportar cookies por perfil (formato JSON estándar).
- [ ] Duplicar perfil (con huella nueva) y carpetas/etiquetas de perfiles.
- [ ] Proxies de otros proveedores o propios (HTTP/SOCKS5) por perfil, no solo DataImpulse.
- [ ] Botón "Probar coherencia" que abra browserleaks/pixelscan y resuma el resultado.

## Baja
- [ ] Empaquetar Tailwind localmente en vez de CDN (la UI no carga sin internet).
- [ ] Rotación de logs antiguos (borrar `logs/app/*.jsonl` de más de 60 días).

## Hecho
- [x] 2026-09-24 — Registro de errores con estados, reapertura automática y CLI.
- [x] 2026-09-24 — Huella coherente (UA nativo, semilla fija, tz/GPS/WebRTC desde la IP real).
- [x] 2026-09-24 — Sesión sticky por perfil, salud del nodo y reintento automático.
- [x] 2026-09-24 — Varios perfiles abiertos a la vez, cada uno con su proxy local.
- [x] 2026-09-24 — Documentación para agentes (AGENTS.md + docs/).
