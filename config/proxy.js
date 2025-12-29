require('dotenv').config();

/**
 * Configuración base del proxy (sin código de país)
 */
const proxyBase = {
  server: process.env.PROXY_SERVER || 'http://gw.dataimpulse.com:823',
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
 * Genera la configuración del proxy para un país específico
 * El formato del username es: usuario__cr.XX (donde XX es el código del país)
 * @param {string} countryCode - Código del país (sv, tr, ng, etc.)
 * @returns {Object} Configuración del proxy con el país seleccionado
 */
function getProxyConfig(countryCode) {
  // Extraer el username base (sin código de país si ya tiene uno)
  let baseUsername = proxyBase.username;
  
  // Si el username ya tiene __cr.XX, lo removemos para agregar el nuevo
  if (baseUsername.includes('__cr.')) {
    baseUsername = baseUsername.split('__cr.')[0];
  }
  
  return {
    server: proxyBase.server,
    username: `${baseUsername}__cr.${countryCode.toLowerCase()}`,
    password: proxyBase.password
  };
}

module.exports = {
  proxyBase,
  validateProxy,
  getProxyConfig
};
