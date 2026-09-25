/**
 * Orquesta las sesiones de navegador abiertas (varias a la vez, una por perfil).
 *
 * Flujo de arranque (launch):
 *   1. Construir URL del proxy con sesión fija (proxy/upstream.js)
 *   2. Verificar IP de salida real + país (proxy/ipCheck.js). Si el país no coincide
 *      se pide otra IP una vez; si sigue sin coincidir, NO se abre (sería incoherente).
 *   3. Proxy local propio (proxy/localProxy.js)
 *   4. Preferences coherentes (browser/chromePrefs.js)
 *   5. Opciones coherentes con la IP (browser/launchOptions.js) -> CloakBrowser
 *   6. Ventana ajustada a la pantalla de la huella (browser/window.js)
 *   7. Detección de captchas, caídas de pestañas, monitor de IP y de consumo
 *
 * Cambiar de país/ciudad o pedir IP nueva = REINICIAR la sesión (relaunch), porque
 * zona horaria e IP de WebRTC son flags del proceso y no se pueden cambiar en caliente.
 * Las pestañas abiertas se vuelven a abrir tras el reinicio.
 */
const config = require('../config');
const profiles = require('../profiles/profileStore');
const usage = require('../usage/usageStore');
const { buildUpstreamUrl } = require('../proxy/upstream');
const { checkExitIp } = require('../proxy/ipCheck');
const { LocalProxy } = require('../proxy/localProxy');
const { buildLaunchOptions, acceptLanguages } = require('./launchOptions');
const { preparePreferences } = require('./chromePrefs');
const { attachDetection } = require('./detection');
const { fitWindowToScreen } = require('./window');
const { getCountry, citySlug } = require('../geo/locations');
const log = require('../logging/logger').child('browser');

/** @type {Map<string, object>} profileId -> sesión */
const sessions = new Map();

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

const MAX_IP_ATTEMPTS = 4;

/**
 * Consigue una IP sticky que funcione y sea del país pedido. Si el nodo está
 * roto (no abre túneles HTTPS) o es de otro país, pide otra IP (sessid nuevo).
 */
async function resolveExit(profile) {
  let lastProblem = '';
  for (let attempt = 1; attempt <= MAX_IP_ATTEMPTS; attempt++) {
    if (attempt > 1) profile = profiles.rotateIp(profile.id);
    const upstream = buildUpstreamUrl(profile);
    let exit;
    try {
      exit = await checkExitIp(upstream);
    } catch (err) {
      if (err.code !== 'PROXY_NODE_BAD') throw err;
      lastProblem = err.message;
      log.warn(`Intento ${attempt}: nodo del proxy defectuoso, pidiendo otra IP`, { code: 'PROXY_NODE_BAD', err, track: false, context: { profile: profile.name } });
      continue;
    }
    if (exit.countryCode !== profile.proxy.country) {
      lastProblem = `llegó una IP de ${exit.country}`;
      log.warn(`Intento ${attempt}: IP de ${exit.country} en vez de ${profile.proxy.country}, pidiendo otra`, {
        code: 'PROXY_WRONG_COUNTRY', track: false, context: { profile: profile.name, got: exit.countryCode },
      });
      continue;
    }
    if (attempt > 1) log.info(`IP válida conseguida en el intento ${attempt}`, { context: { profile: profile.name, ip: exit.ip } });
    return checkExitDetails(profile, upstream, exit);
  }
  throw httpError(502,
    `No se consiguió una IP funcional de ${getCountry(profile.proxy.country)?.name} tras ${MAX_IP_ATTEMPTS} intentos (${lastProblem}). Prueba de nuevo o quita la ciudad.`,
    'PROXY_NO_WORKING_IP');
}

function checkExitDetails(profile, upstream, exit) {

  if (profile.proxy.city && citySlug(exit.city) !== citySlug(profile.proxy.city)) {
    // Las bases GeoIP no siempre nombran igual la ciudad: se avisa, no se bloquea.
    log.warn(`Ciudad pedida "${profile.proxy.city}", la IP se ubica en "${exit.city}"`, {
      code: 'PROXY_CITY_MISMATCH', track: false, context: { profile: profile.name, exit },
    });
  }
  if (exit.flaggedProxy) {
    log.warn(`La IP ${exit.ip} aparece marcada como proxy/datacenter`, {
      code: 'IP_FLAGGED', title: 'IP de salida marcada como proxy/datacenter por ip-api', context: { profile: profile.name, exit },
    });
  }
  return { profile, upstream, exit };
}

async function launch(profileId, { reopenUrls } = {}) {
  if (sessions.has(profileId)) throw httpError(409, 'Este perfil ya está abierto');
  let profile = profiles.getProfile(profileId);
  if (profile.needsSetup) throw httpError(400, 'Confirma la ubicación del proxy de este perfil antes de abrirlo (botón Editar).', 'NEEDS_SETUP');

  const session = { profileId, profileName: profile.name, status: 'starting', startedAt: new Date().toISOString(), exit: null, ipChanged: false, persistedBytes: 0 };
  sessions.set(profileId, session);

  try {
    let upstream = null;
    if (profile.proxy.enabled) {
      ({ profile, upstream, exit: session.exit } = await resolveExit(profile));
      session.localProxy = new LocalProxy(upstream, { profileName: profile.name });
    }
    const localProxyUrl = session.localProxy ? await session.localProxy.start() : null;

    const userDataDir = profiles.browserDataDir(profile.id);
    const options = buildLaunchOptions({ profile, userDataDir, localProxyUrl, exit: session.exit });
    preparePreferences(userDataDir, { languages: acceptLanguages(options.locale) });

    const cloak = await import('cloakbrowser');
    const context = await cloak.launchPersistentContext(options);
    session.context = context;
    session.upstream = upstream;
    session.status = 'running';
    session.fingerprint = { seed: profile.fingerprint.seed, locale: options.locale || 'sistema', timezone: options.timezone || 'sistema' };

    wireSession(session, context);

    try {
      await fitWindowToScreen(context);
    } catch (err) {
      log.warn('No se pudo ajustar la ventana a la pantalla de la huella', { err, code: 'WINDOW_FIT', track: true, context: { profile: profile.name } });
    }

    profiles.patchProfile(profile.id, { lastLaunchedAt: session.startedAt, ...(session.exit ? { lastExit: { ...session.exit, checkedAt: session.startedAt } } : {}) });
    usage.countSession();
    log.info(`Navegador abierto: ${profile.name}`, { context: { exit: session.exit, fingerprint: session.fingerprint } });

    openInitialPages(session, context, reopenUrls?.length ? reopenUrls : [profile.startUrl || config.browser.defaultStartUrl]);
    return publicSession(session);
  } catch (err) {
    await session.context?.close().catch(() => {});
    await cleanup(session);
    if (err.code === 'PROXY_AUTH') {
      log.error('Credenciales del proxy rechazadas', { err, code: 'PROXY_AUTH', title: 'DataImpulse rechaza usuario/contraseña (407)', context: { profile: profile.name } });
      throw httpError(502, 'DataImpulse rechazó el usuario/contraseña del proxy. Revisa .env', 'PROXY_AUTH');
    }
    if (/ProcessSingleton|SingletonLock|profile.*in use/i.test(err.message)) {
      log.error('Carpeta del perfil bloqueada por otro Chromium', { err, code: 'PROFILE_LOCKED', context: { profile: profile.name } });
      throw httpError(409, 'Otro Chromium tiene abierto este perfil. Ciérralo e inténtalo de nuevo.', 'PROFILE_LOCKED');
    }
    log.error(`No se pudo abrir el navegador de "${profile.name}"`, { err, code: err.code || 'LAUNCH_FAILED', context: { profile: profile.name, proxy: profile.proxy } });
    throw err.status ? err : httpError(500, `No se pudo abrir el navegador: ${err.message}`, 'LAUNCH_FAILED');
  }
}

function wireSession(session, context) {
  const info = () => ({ profile: session.profileName, seed: session.fingerprint?.seed, exitIp: session.exit?.ip, country: session.exit?.countryCode, city: session.exit?.city, timezone: session.fingerprint?.timezone });

  context.on('close', () => {
    log.info(`Navegador cerrado: ${session.profileName}`);
    cleanup(session);
  });

  const watchPage = (page) => {
    page.on('crash', () => log.error('Una pestaña se cayó (crash)', { code: 'PAGE_CRASH', context: { ...info(), url: page.url().slice(0, 200) } }));
  };
  context.pages().forEach(watchPage);
  context.on('page', watchPage);

  attachDetection(context, info);

  // Consumo: se guarda cada minuto para no perderlo si la app se cierra de golpe.
  session.usageTimer = setInterval(() => persistUsage(session), 60_000);

  // La IP sticky dura `sessttl` minutos; si DataImpulse la cambia, avisar.
  if (session.upstream) {
    session.ipTimer = setInterval(async () => {
      try {
        const now = await checkExitIp(session.upstream);
        if (now.ip !== session.exit.ip) {
          session.ipChanged = true;
          log.warn(`La IP cambió durante la sesión (${session.exit.ip} -> ${now.ip}, ${now.city})`, {
            code: 'IP_CHANGED', title: 'La IP del proxy cambió en mitad de la sesión', track: true,
            context: { ...info(), newIp: now.ip, newCity: now.city, newTimezone: now.timezone },
          });
          session.exit = now;
        }
      } catch (err) {
        if (err.code === 'PROXY_NODE_BAD') {
          session.ipChanged = true;
          log.warn('El nodo del proxy dejó de funcionar durante la sesión', {
            code: 'PROXY_NODE_DIED', title: 'El nodo del proxy murió en mitad de la sesión (usar "Nueva IP")', track: true, err, context: info(),
          });
        } else {
          log.warn('No se pudo verificar la IP durante la sesión', { err, code: 'IP_MONITOR', track: false, context: info() });
        }
      }
    }, config.browser.ipMonitorIntervalMs);
  }
}

async function openInitialPages(session, context, urls) {
  for (let i = 0; i < urls.length; i++) {
    try {
      const page = i === 0 ? (context.pages()[0] || await context.newPage()) : await context.newPage();
      await page.goto(urls[i], { timeout: 60_000, waitUntil: 'domcontentloaded' });
    } catch (err) {
      if (session.status !== 'running') return; // se cerró mientras cargaba
      log.warn(`No cargó la página inicial ${urls[i]}`, { err, code: 'START_URL_FAILED', track: true, context: { profile: session.profileName, url: urls[i] } });
    }
  }
}

function persistUsage(session) {
  if (!session.localProxy) return;
  const total = session.localProxy.bytes();
  usage.addBytes(session.profileId, total - session.persistedBytes);
  session.persistedBytes = total;
}

async function cleanup(session) {
  if (session.cleaning) return session.cleaning;
  session.cleaning = (async () => {
    session.status = 'stopped';
    clearInterval(session.usageTimer);
    clearInterval(session.ipTimer);
    if (session.localProxy) {
      try {
        persistUsage(session);
        await session.localProxy.close();
      } catch (err) {
        log.error('Error cerrando el proxy local', { err, code: 'PROXY_CLOSE', context: { profile: session.profileName } });
      }
    }
    if (sessions.get(session.profileId) === session) sessions.delete(session.profileId);
  })();
  return session.cleaning;
}

async function stop(profileId) {
  const session = sessions.get(profileId);
  if (!session) return { stopped: false };
  session.status = 'stopping';
  try {
    await session.context?.close();
  } catch (err) {
    log.error('Error cerrando el navegador', { err, code: 'BROWSER_CLOSE', context: { profile: session.profileName } });
  }
  await cleanup(session);
  return { stopped: true };
}

/** Reinicia la sesión (p.ej. tras cambiar ubicación o pedir IP nueva) reabriendo las pestañas. */
async function relaunch(profileId, { rotate = false } = {}) {
  const session = sessions.get(profileId);
  const urls = session?.context
    ? session.context.pages().map(p => p.url()).filter(u => /^https?:\/\//.test(u))
    : [];
  if (session) await stop(profileId);
  if (rotate) profiles.rotateIp(profileId);
  return launch(profileId, { reopenUrls: urls });
}

async function stopAll() {
  await Promise.all([...sessions.keys()].map(id => stop(id)));
}

function publicSession(s) {
  return {
    profileId: s.profileId,
    profileName: s.profileName,
    status: s.status,
    startedAt: s.startedAt,
    exit: s.exit,
    fingerprint: s.fingerprint || null,
    ipChanged: s.ipChanged,
    bytes: s.localProxy ? s.localProxy.bytes() : 0,
  };
}

function list() {
  return [...sessions.values()].map(publicSession);
}

function isRunning(profileId) {
  return sessions.has(profileId);
}

module.exports = { launch, stop, relaunch, stopAll, list, isRunning, resolveExit };
