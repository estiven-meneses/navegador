/**
 * Averigua la IP de salida REAL (a través del proxy), su geolocalización y
 * si el nodo del proxy funciona de verdad.
 *
 * Esto es la base de la coherencia: la zona horaria, las coordenadas y la IP
 * de WebRTC del navegador se toman de aquí, no de una tabla fija.
 *
 * Dos pasos:
 *  1. Túnel HTTPS (CONNECT) a ipwho.is — el navegador usa casi todo HTTPS. Con
 *     sesiones fijas de DataImpulse, ~1 de cada 6 nodos residenciales está roto
 *     (CONNECT responde 502 NO_HOST_CONNECTION o 405) aunque HTTP plano funcione.
 *     Si el túnel falla -> error PROXY_NODE_BAD y quien llama pide otra IP.
 *  2. ip-api.com (HTTP) para geolocalización y bandera proxy/hosting. Si falla,
 *     se usan los datos de ipwho.is.
 */
const http = require('http');
const https = require('https');
const net = require('net');

const TIMEOUT_MS = 20000;

function proxyAuthHeader(proxyUrl) {
  if (!proxyUrl.username) return {};
  const user = decodeURIComponent(proxyUrl.username);
  const pass = decodeURIComponent(proxyUrl.password || '');
  return { 'Proxy-Authorization': 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') };
}

function readJson(res, resolve, reject) {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', c => { data += c; });
  res.on('end', () => {
    if (res.statusCode !== 200) return reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { statusCode: res.statusCode }));
    try { resolve(JSON.parse(data)); } catch { reject(new Error('Respuesta no es JSON')); }
  });
}

/** GET http:// a través de un proxy HTTP (petición con URL absoluta). */
function httpGetViaProxy(targetUrl, proxyUrlStr) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    let opts;
    if (proxyUrlStr) {
      const p = new URL(proxyUrlStr);
      opts = { host: p.hostname, port: Number(p.port || 80), path: target.href, headers: { Host: target.host, ...proxyAuthHeader(p) } };
    } else {
      opts = { host: target.hostname, port: Number(target.port || 80), path: target.pathname + target.search };
    }
    const req = http.request({ ...opts, method: 'GET', agent: false, timeout: TIMEOUT_MS }, res => readJson(res, resolve, reject));
    req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado')));
    req.on('error', reject);
    req.end();
  });
}

/** GET https:// a través de un túnel CONNECT. Errores del túnel llevan code PROXY_NODE_BAD / PROXY_AUTH. */
function httpsGetViaProxy(targetUrl, proxyUrlStr) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    if (!proxyUrlStr) {
      const req = https.get(target, { timeout: TIMEOUT_MS }, res => readJson(res, resolve, reject));
      req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado')));
      req.on('error', reject);
      return;
    }
    const p = new URL(proxyUrlStr);
    const connect = http.request({
      host: p.hostname, port: Number(p.port || 80), method: 'CONNECT', agent: false,
      path: `${target.hostname}:443`, headers: { Host: `${target.hostname}:443`, ...proxyAuthHeader(p) }, timeout: TIMEOUT_MS,
    });
    connect.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        const auth = res.statusCode === 407 || res.statusCode === 401;
        return reject(Object.assign(
          new Error(auth ? 'Credenciales del proxy rechazadas (407)' : `El nodo del proxy no abre túneles HTTPS (${res.statusCode} ${res.statusMessage || ''})`.trim()),
          { code: auth ? 'PROXY_AUTH' : 'PROXY_NODE_BAD', statusCode: res.statusCode },
        ));
      }
      const req = https.get({ host: target.hostname, path: target.pathname + target.search, socket, servername: target.hostname, agent: false, timeout: TIMEOUT_MS },
        r => readJson(r, resolve, reject));
      req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado')));
      req.on('error', reject);
    });
    connect.on('timeout', () => connect.destroy(Object.assign(new Error('El proxy no respondió a tiempo'), { code: 'PROXY_NODE_BAD' })));
    connect.on('error', (err) => reject(err.code === 'PROXY_NODE_BAD' ? err : Object.assign(err, { code: err.code || 'PROXY_UNREACHABLE' })));
    connect.end();
  });
}

/**
 * @param {string|null} proxyUrl URL del proxy (null = conexión directa)
 * @returns {Promise<{ip, countryCode, country, region, city, lat, lon, timezone, isp, flaggedProxy, source}>}
 * @throws code PROXY_AUTH | PROXY_NODE_BAD | IP_CHECK_FAILED
 */
async function checkExitIp(proxyUrl) {
  // 1. Túnel HTTPS: prueba que el nodo sirve para navegar.
  let who = null;
  let whoError = null;
  try {
    const r = await httpsGetViaProxy('https://ipwho.is/', proxyUrl);
    if (r.success && net.isIP(r.ip)) who = r;
    else whoError = r.message || 'respuesta inválida';
  } catch (err) {
    if (err.code === 'PROXY_AUTH' || err.code === 'PROXY_NODE_BAD') throw err;
    whoError = err.message; // el túnel abrió pero el servicio falló: no culpar al nodo
  }

  // 2. Geolocalización principal.
  try {
    const r = await httpGetViaProxy(
      'http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,proxy,hosting,query',
      proxyUrl,
    );
    if (r.status === 'success' && net.isIP(r.query)) {
      return {
        ip: r.query, countryCode: r.countryCode?.toLowerCase(), country: r.country, region: r.regionName,
        city: r.city, lat: r.lat, lon: r.lon, timezone: r.timezone, isp: r.isp,
        flaggedProxy: Boolean(r.proxy || r.hosting), source: 'ip-api.com',
      };
    }
  } catch (err) {
    if (err.statusCode === 407) throw Object.assign(new Error('Credenciales del proxy rechazadas (407)'), { code: 'PROXY_AUTH' });
  }

  if (who) {
    return {
      ip: who.ip, countryCode: who.country_code?.toLowerCase(), country: who.country, region: who.region,
      city: who.city, lat: who.latitude, lon: who.longitude, timezone: who.timezone?.id, isp: who.connection?.isp,
      flaggedProxy: false, source: 'ipwho.is',
    };
  }
  throw Object.assign(new Error(`No se pudo verificar la IP de salida (ipwho.is: ${whoError})`), { code: 'IP_CHECK_FAILED' });
}

module.exports = { checkExitIp };
