require('dotenv').config();

/**
 * Configuración del proxy
 */
const proxyConfig = {
  server: process.env.PROXY_SERVER || 'http://gw.dataimpulse.com:823',
  username: process.env.PROXY_USERNAME,
  password: process.env.PROXY_PASSWORD
};

/**
 * Valida que las credenciales del proxy estén configuradas
 */
function validateProxy() {
  if (!proxyConfig.username || !proxyConfig.password) {
    console.error('❌ Error: Credenciales del proxy no configuradas.');
    console.error('   Crea un archivo .env con PROXY_USERNAME y PROXY_PASSWORD');
    process.exit(1);
  }
  return true;
}

module.exports = {
  proxyConfig,
  validateProxy
};

