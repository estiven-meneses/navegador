require('dotenv').config();
const { Server } = require('proxy-chain');

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

let dynamicProxyServer = null;
let currentUpstreamProxyUrl = null;

let activeConnections = new Set();

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
  
  if (baseUsername.includes('__cr.')) {
    baseUsername = baseUsername.split('__cr.')[0];
  }
  
  const username = `${baseUsername}__cr.${countryCode.toLowerCase()}`;
  const serverUrl = new URL(proxyBase.server);
  
  return `http://${username}:${proxyBase.password}@${serverUrl.host}`;
}

/**
 * Crea un servidor proxy local dinámico.
 * Todas las peticiones irán al upstream que configuremos.
 */
async function createLocalProxy(countryCode) {
  if (countryCode) {
    currentUpstreamProxyUrl = getProxyUrl(countryCode);
  } else {
    currentUpstreamProxyUrl = null;
  }
  
  if (!dynamicProxyServer) {
    console.log('🔄 Iniciando servidor de proxy dinámico local...');
    dynamicProxyServer = new Server({
      port: 8000,
      verbose: false,
      prepareRequestFunction: () => {
        return {
          upstreamProxyUrl: currentUpstreamProxyUrl
        };
      },
    });

    dynamicProxyServer.server.on('connection', (conn) => {
      activeConnections.add(conn);
      conn.on('close', () => activeConnections.delete(conn));
    });
    
    await dynamicProxyServer.listen();
    console.log('✅ Servidor proxy dinámico iniciado (localhost:8000).');
  } else {
    console.log('✅ Proxy dinámico actualizado.');
  }

  return 'http://127.0.0.1:8000';
}

/**
 * Cambia el proxy en tiempo de ejecución y destruye los sockets activos para forzar recarga
 */
function updateProxyUpstream(countryCode) {
  if (countryCode) {
    currentUpstreamProxyUrl = getProxyUrl(countryCode);
  } else {
    currentUpstreamProxyUrl = null; // Direct connection
  }
  
  // Forzar cierre de conexiones TCP que Chromium mantiene "vivas"
  // para que en la próxima petición el nuevo proxy se use inmediatamente
  let count = 0;
  for (const conn of activeConnections) {
    conn.destroy();
    count++;
  }
  if (count > 0) {
    console.log(`🧹 ${count} conexiones de proxy en caché limpiadas para forzar el cambio.`);
  }
}

/**
 * Cierra el proxy local cuando se cierra el navegador
 */
async function closeLocalProxy() {
  if (dynamicProxyServer) {
    await dynamicProxyServer.close(true);
    dynamicProxyServer = null;
  }
}

module.exports = {
  proxyBase,
  validateProxy,
  getProxyUrl,
  createLocalProxy,
  closeLocalProxy,
  updateProxyUpstream
};
