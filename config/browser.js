require('dotenv').config();

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
 * Configuración de geolocalización
 */
const geoConfig = {
  latitude: parseFloat(process.env.GEO_LATITUDE) || 13.75,
  longitude: parseFloat(process.env.GEO_LONGITUDE) || -89.2099
};

/**
 * User Agent para simular Chrome real
 */
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/**
 * Configuración regional
 */
const localeConfig = {
  locale: process.env.LOCALE || 'es-SV',
  timezoneId: process.env.TIMEZONE || 'America/El_Salvador'
};

/**
 * Genera la configuración completa del contexto del navegador
 * @param {Object} proxyConfig - Configuración del proxy
 */
function getContextConfig(proxyConfig) {
  return {
    viewport: null,
    proxy: proxyConfig,
    userAgent,
    locale: localeConfig.locale,
    timezoneId: localeConfig.timezoneId,
    geolocation: geoConfig,
    permissions: ['geolocation']
  };
}

module.exports = {
  launchArgs,
  geoConfig,
  userAgent,
  localeConfig,
  getContextConfig
};

