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
 * Genera la configuración completa del contexto del navegador
 * @param {Object} proxyConfig - Configuración del proxy
 * @param {Object} country - Configuración del país seleccionado
 * @returns {Object} Configuración del contexto de Playwright
 */
function getContextConfig(proxyConfig, country) {
  return {
    viewport: null,
    proxy: proxyConfig,
    userAgent: country.userAgent,
    locale: country.locale,
    timezoneId: country.timezone,
    geolocation: country.geo,
    permissions: ['geolocation']
  };
}

module.exports = {
  launchArgs,
  getContextConfig
};
