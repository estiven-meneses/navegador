# StealthBrowser

Gestor de perfiles de navegador anti-detección (estilo GoLogin) con proxy residencial coherente
por país y ciudad.

## Usar

```bash
npm install
npm start          # abre http://localhost:3000
```

1. Copia `.env.example` a `.env` y pon tu usuario/contraseña de DataImpulse.
2. Crea un perfil, elige país (y ciudad si quieres) y pulsa **Abrir**.
3. Cada perfil es un "dispositivo" fijo: sus cookies, sesiones y huella se mantienen.
   La zona horaria, el idioma, el GPS y WebRTC se ajustan solos a la IP real del proxy.

- **Nueva IP**: otra IP de la misma ubicación (reinicia el navegador conservando las pestañas).
- **Editar** un perfil abierto y cambiar la ubicación → se reinicia con la nueva ubicación.

## Errores

Todo error queda registrado con fecha y estado (pestaña **Errores** o `npm run errors`).
Para corregirlos, dile a tu IA: **"revisa los errores"**. Si un error arreglado vuelve, se reabre solo.

## Para agentes de IA

Lee [AGENTS.md](AGENTS.md). Documentación en [docs/](docs/).
