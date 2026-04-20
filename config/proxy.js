require('dotenv').config();
const proxyChain = require('proxy-chain');

/**
 * Configuración base del proxy (sin código de país)
 */
const proxyBase = {
  protocol: process.env.PROXY_PROTOCOL || 'http',
  host: process.env.PROXY_HOST || 'gw.dataimpulse.com',
  port: process.env.PROXY_PORT || '823',
  get server() { return `${this.protocol}://${this.host}:${this.port}`; },
  username: process.env.PROXY_USERNAME,
  password: process.env.PROXY_PASSWORD
};

/**
 * Valida que las credenciales del proxy estén configuradas
 */
function validateProxy() {
  if (!proxyBase.username || !proxyBase.password) {
    console.error('❌ Error: Credenciales del proxy no configuradas.');
    console.error('   Crea un archivo .env con PROXY_USERNAME y PROXY_PASSWORD');
    process.exit(1);
  }
  return true;
}

/**
 * Genera la URL completa del proxy con credenciales para un país
 * @param {string} countryCode - Código del país (sv, tr, ng, etc.)
 * @returns {string} URL del proxy con credenciales
 */
function getProxyUrl(countryCode) {
  let baseUsername = proxyBase.username;
  
  // Si el username ya tiene __cr.XX, lo removemos para agregar el nuevo
  if (baseUsername.includes('__cr.')) {
    baseUsername = baseUsername.split('__cr.')[0];
  }
  
  const username = `${baseUsername}__cr.${countryCode.toLowerCase()}`;
  const serverUrl = new URL(proxyBase.server);
  
  return `http://${username}:${proxyBase.password}@${serverUrl.host}`;
}

/**
 * Crea un proxy local sin autenticación que redirige al proxy remoto
 * Esto permite que TODAS las pestañas funcionen con el proxy
 * @param {string} countryCode - Código del país
 * @returns {Promise<string>} URL del proxy local (sin autenticación)
 */
async function createLocalProxy(countryCode) {
  const remoteProxyUrl = getProxyUrl(countryCode);
  console.log('🔄 Creando túnel de proxy...');
  
  const localProxyUrl = await proxyChain.anonymizeProxy(remoteProxyUrl);
  console.log('✅ Túnel de proxy creado');
  
  return localProxyUrl;
}

/**
 * Cierra el proxy local cuando se cierra el navegador
 * @param {string} localProxyUrl - URL del proxy local a cerrar
 */
async function closeLocalProxy(localProxyUrl) {
  await proxyChain.closeAnonymizedProxy(localProxyUrl, true);
}

module.exports = {
  proxyBase,
  validateProxy,
  getProxyUrl,
  createLocalProxy,
  closeLocalProxy
};
