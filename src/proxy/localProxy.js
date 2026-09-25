/**
 * Proxy local por sesión (127.0.0.1:<puerto libre>) que reenvía al proxy de DataImpulse.
 *
 * ¿Por qué un proxy local y no pasar el proxy directo a Chromium?
 *  - Chromium no necesita credenciales (Playwright las inyectaría por CDP en cada petición).
 *  - Medimos los bytes REALES que pasan por el proxy (para el consumo del plan).
 *  - Cada perfil abierto tiene su propio proxy local: varios perfiles a la vez sin mezclarse.
 */
const { Server } = require('proxy-chain');
const log = require('../logging/logger').child('proxy');

class LocalProxy {
  /** @param {string|null} upstreamUrl  null = conexión directa (sin proxy) */
  constructor(upstreamUrl, { profileName } = {}) {
    this.upstreamUrl = upstreamUrl;
    this.profileName = profileName;
    this.closedBytes = 0;
    this.server = null;
  }

  async start() {
    this.server = new Server({
      port: 0, // puerto libre asignado por el sistema
      host: '127.0.0.1',
      verbose: false,
      prepareRequestFunction: () => ({ upstreamProxyUrl: this.upstreamUrl }),
    });

    this.server.on('connectionClosed', ({ stats }) => {
      // Al cerrar ya se sumaron las conexiones activas en close(): evitar doble conteo.
      if (stats && this.server) this.closedBytes += (stats.trgTxBytes || 0) + (stats.trgRxBytes || 0);
    });

    // El upstream respondió algo distinto de 200 al abrir un túnel HTTPS.
    this.server.on('tunnelConnectFailed', ({ response }) => {
      const status = response?.statusCode;
      if (status === 407 || status === 401) {
        log.error('El proxy rechazó las credenciales', {
          code: 'PROXY_AUTH',
          title: 'DataImpulse rechaza usuario/contraseña (407)',
          context: { profile: this.profileName, status },
        });
      } else {
        // Sitios caídos o bloqueados por el proxy: normal de vez en cuando, solo se anota.
        log.warn(`Túnel rechazado por el proxy (HTTP ${status})`, { code: 'PROXY_TUNNEL', context: { profile: this.profileName, status }, track: false });
      }
    });

    this.server.on('requestFailed', ({ error, request }) => {
      log.warn('Petición fallida en el proxy local', {
        code: 'PROXY_REQUEST_FAILED', err: error, track: false,
        context: { profile: this.profileName, url: request?.url?.slice(0, 200) },
      });
    });

    await this.server.listen();
    return `http://127.0.0.1:${this.server.port}`;
  }

  /** Bytes enviados + recibidos hacia el proxy remoto (conexiones cerradas + abiertas). */
  bytes() {
    if (!this.server) return this.closedBytes;
    let active = 0;
    for (const id of this.server.getConnectionIds()) {
      const s = this.server.getConnectionStats(id);
      if (s) active += (s.trgTxBytes || 0) + (s.trgRxBytes || 0);
    }
    return this.closedBytes + active;
  }

  async close() {
    if (!this.server) return;
    const srv = this.server;
    this.closedBytes = this.bytes();
    this.server = null;
    await srv.close(true);
  }
}

module.exports = { LocalProxy };
