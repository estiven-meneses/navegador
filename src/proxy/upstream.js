/**
 * Construye la URL del proxy de DataImpulse para un perfil.
 *
 * Formato del usuario (docs.dataimpulse.com/proxies/parameters):
 *   LOGIN__cr.<pais>[;city.<ciudad>];sessid.<id>;sessttl.<min>
 *
 * `sessid` = sesión "sticky": la MISMA IP durante `sessttl` minutos. Sin él,
 * DataImpulse rota la IP en cada conexión y los sitios ven saltar la IP a mitad
 * de la navegación (señal fuerte de bot). Cada perfil tiene su propio sessid;
 * incrementar `proxy.rotation` del perfil fuerza una IP nueva.
 */
const config = require('../config');
const { citySlug } = require('../geo/locations');

function sessionId(profile) {
  // Solo alfanumérico: DataImpulse separa parámetros con ';' y '.'
  return `${profile.id}r${profile.proxy.rotation || 0}`.replace(/[^a-zA-Z0-9]/g, '');
}

function buildUsername(profile) {
  const p = profile.proxy;
  const parts = [`cr.${p.country.toLowerCase()}`];
  const city = citySlug(p.city);
  if (city) parts.push(`city.${city}`);
  parts.push(`sessid.${sessionId(profile)}`);
  parts.push(`sessttl.${config.proxy.sessionTtlMinutes}`);
  return `${config.proxy.username}__${parts.join(';')}`;
}

/** URL completa con credenciales, o null si el perfil va sin proxy. */
function buildUpstreamUrl(profile) {
  if (!profile.proxy?.enabled || !profile.proxy.country) return null;
  if (!config.proxy.configured) {
    throw Object.assign(new Error('Faltan PROXY_USERNAME / PROXY_PASSWORD en .env'), { code: 'PROXY_NOT_CONFIGURED' });
  }
  const user = encodeURIComponent(buildUsername(profile));
  const pass = encodeURIComponent(config.proxy.password);
  return `http://${user}:${pass}@${config.proxy.host}:${config.proxy.port}`;
}

module.exports = { buildUpstreamUrl, buildUsername, sessionId };
