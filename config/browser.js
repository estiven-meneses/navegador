/**
 * Argumentos de lanzamiento del navegador
 */
const launchArgs = [
  '--start-maximized',
  '--disable-blink-features=AutomationControlled',
  // Los captchas de Google fallan en loop infinito si desactivas WebRTC por completo,
  // por lo que se quita '--disable-webrtc' para hacerlo pasar por un browser normal.
  '--disable-features=IsolateOrigins,site-per-process', // Útil para frames y captchas
  '--disable-search-engine-choice-screen' // Evita la pantalla de selección de buscador
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
