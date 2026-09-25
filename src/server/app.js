/**
 * Servidor web (API + interfaz en public/). Solo escucha en 127.0.0.1.
 *
 * Captura de errores en todas las capas:
 *  - Rutas: middleware final -> incidencia (source "server")
 *  - Proceso: uncaughtException / unhandledRejection -> incidencia (source "process")
 *  - Interfaz: window.onerror del navegador -> POST /api/errors/report (source "ui")
 */
const express = require('express');
const config = require('../config');
const logger = require('../logging/logger');
const tracker = require('../logging/errorTracker');
const profiles = require('../profiles/profileStore');
const sessions = require('../browser/sessionManager');
const usage = require('../usage/usageStore');
const { listCountries } = require('../geo/locations');

const log = logger.child('server');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(config.paths.public));

  // ---------- Perfiles ----------
  app.get('/api/profiles', (req, res) => {
    const running = new Set(sessions.list().map(s => s.profileId));
    res.json({ profiles: profiles.listProfiles().map(p => ({ ...p, running: running.has(p.id) })) });
  });

  app.post('/api/profiles', (req, res) => {
    res.status(201).json({ profile: profiles.createProfile(req.body || {}) });
  });

  app.put('/api/profiles/:id', (req, res) => {
    res.json({ profile: profiles.updateProfile(req.params.id, req.body || {}), running: sessions.isRunning(req.params.id) });
  });

  app.delete('/api/profiles/:id', (req, res) => {
    if (sessions.isRunning(req.params.id)) {
      return res.status(409).json({ error: 'Cierra el navegador de este perfil antes de eliminarlo' });
    }
    profiles.deleteProfile(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/profiles/:id/fingerprint', (req, res) => {
    if (sessions.isRunning(req.params.id)) {
      return res.status(409).json({ error: 'Cierra el navegador antes de cambiar la huella' });
    }
    res.json({ profile: profiles.regenerateFingerprint(req.params.id) });
  });

  // ---------- Sesiones de navegador ----------
  app.get('/api/sessions', (req, res) => {
    res.json({ sessions: sessions.list(), proxyConfigured: config.proxy.configured });
  });

  app.post('/api/profiles/:id/launch', async (req, res) => {
    res.json({ session: await sessions.launch(req.params.id) });
  });

  app.post('/api/profiles/:id/stop', async (req, res) => {
    res.json(await sessions.stop(req.params.id));
  });

  // Reinicia aplicando la ubicación guardada; con {rotate:true} además pide IP nueva.
  app.post('/api/profiles/:id/relaunch', async (req, res) => {
    res.json({ session: await sessions.relaunch(req.params.id, { rotate: Boolean(req.body?.rotate) }) });
  });

  app.post('/api/profiles/:id/rotate-ip', (req, res) => {
    res.json({ profile: profiles.rotateIp(req.params.id) });
  });

  // ---------- Datos ----------
  app.get('/api/countries', (req, res) => res.json({ countries: listCountries() }));

  app.get('/api/usage', (req, res) => {
    const live = sessions.list().reduce((sum, s) => sum + s.bytes, 0);
    res.json({ ...usage.summary(), liveBytes: live });
  });

  app.post('/api/usage/balance', (req, res) => {
    res.json(usage.resetBalance(req.body?.balanceGB));
  });

  // ---------- Errores ----------
  app.get('/api/errors', (req, res) => {
    const status = ['open', 'fixed', 'ignored'].includes(req.query.status) ? req.query.status : undefined;
    res.json({ issues: tracker.list({ status }) });
  });

  app.patch('/api/errors/:id', (req, res) => {
    const { status, note } = req.body || {};
    try {
      res.json({ issue: tracker.setStatus(req.params.id, status, note, { by: 'usuario (interfaz)' }) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Errores de JavaScript de la propia interfaz.
  app.post('/api/errors/report', (req, res) => {
    const { message, stack, url, line } = req.body || {};
    logger.child('ui').error(String(message || 'Error en la interfaz').slice(0, 300), {
      code: 'UI_ERROR',
      err: stack ? Object.assign(new Error(String(message)), { stack: String(stack).slice(0, 4000) }) : undefined,
      context: { url, line },
    });
    res.status(204).end();
  });

  app.get('/api/logs', (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : logger.localDate();
    res.json({ date, days: logger.listDays(), entries: logger.readDay(date, 500) });
  });

  // ---------- Manejo de errores ----------
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
      log.error(`${req.method} ${req.path} falló`, { err, code: err.code || 'HTTP_500', context: { method: req.method, path: req.path, body: req.body } });
    } else {
      log.warn(`${req.method} ${req.path} -> ${status}: ${err.message}`, { track: false });
    }
    res.status(status).json({ error: err.message, code: err.code });
  });

  return app;
}

function installProcessHandlers() {
  const plog = logger.child('process');
  process.on('unhandledRejection', (reason) => {
    plog.error('Promesa rechazada sin manejar', { err: reason instanceof Error ? reason : new Error(String(reason)), code: 'UNHANDLED_REJECTION' });
  });
  process.on('uncaughtException', (err) => {
    plog.error('Excepción no capturada', { err, code: 'UNCAUGHT_EXCEPTION' });
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Recibido ${signal}: cerrando navegadores abiertos...`);
    await sessions.stopAll();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function start() {
  installProcessHandlers();
  profiles.migrateLegacySessions();
  if (!config.proxy.configured) {
    log.warn('PROXY_USERNAME / PROXY_PASSWORD no configurados en .env: solo funcionarán perfiles sin proxy', { code: 'PROXY_NOT_CONFIGURED' });
  }
  const app = createApp();
  const server = app.listen(config.server.port, config.server.host, () => {
    log.info(`Servidor listo en http://localhost:${config.server.port}`);
  });
  server.on('error', (err) => {
    log.error(`No se pudo iniciar el servidor en el puerto ${config.server.port}`, { err, code: err.code === 'EADDRINUSE' ? 'PORT_IN_USE' : 'SERVER_LISTEN' });
    process.exit(1);
  });
  return server;
}

module.exports = { createApp, start };
