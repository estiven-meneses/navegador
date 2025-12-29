/**
 * Argumentos de lanzamiento del navegador
 */
const launchArgs = [
  '--start-maximized',
  '--disable-blink-features=AutomationControlled',
  '--disable-webrtc',
  '--disable-features=WebRtcHideLocalIpsWithMdns'
];

/**
 * Genera la configuración del contexto CON proxy local (sin autenticación)
 * @param {string} localProxyUrl - URL del proxy local
 * @param {Object} country - Configuración del país seleccionado
 * @returns {Object} Configuración del contexto de Playwright
 */
function getContextConfigWithProxy(localProxyUrl, country) {
  return {
    viewport: null,
    proxy: {
      server: localProxyUrl
      // No necesita username/password porque el proxy local no requiere autenticación
    },
    userAgent: country.userAgent,
    locale: country.locale,
    timezoneId: country.timezone,
    geolocation: country.geo,
    permissions: ['geolocation']
  };
}

/**
 * Genera la configuración del contexto SIN proxy (navegador normal)
 * @returns {Object} Configuración básica
 */
function getContextConfigNoProxy() {
  return {
    viewport: null
  };
}

module.exports = {
  launchArgs,
  getContextConfigWithProxy,
  getContextConfigNoProxy
};
