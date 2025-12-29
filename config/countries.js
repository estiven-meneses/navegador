/**
 * Configuración de países disponibles para el proxy
 * Cada país tiene: código, nombre, coordenadas, timezone, locale y user-agent
 */

const countries = {
  sv: {
    code: 'sv',
    name: 'El Salvador',
    flag: '🇸🇻',
    geo: {
      latitude: 13.6929,
      longitude: -89.2182
    },
    timezone: 'America/El_Salvador',
    locale: 'es-SV',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  tr: {
    code: 'tr',
    name: 'Turquía',
    flag: '🇹🇷',
    geo: {
      latitude: 41.0082,
      longitude: 28.9784
    },
    timezone: 'Europe/Istanbul',
    locale: 'tr-TR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  ng: {
    code: 'ng',
    name: 'Nigeria',
    flag: '🇳🇬',
    geo: {
      latitude: 6.5244,
      longitude: 3.3792
    },
    timezone: 'Africa/Lagos',
    locale: 'en-NG',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  in: {
    code: 'in',
    name: 'India',
    flag: '🇮🇳',
    geo: {
      latitude: 28.6139,
      longitude: 77.2090
    },
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  us: {
    code: 'us',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    geo: {
      latitude: 40.7128,
      longitude: -74.0060
    },
    timezone: 'America/New_York',
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  de: {
    code: 'de',
    name: 'Alemania',
    flag: '🇩🇪',
    geo: {
      latitude: 52.5200,
      longitude: 13.4050
    },
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  au: {
    code: 'au',
    name: 'Australia',
    flag: '🇦🇺',
    geo: {
      latitude: -33.8688,
      longitude: 151.2093
    },
    timezone: 'Australia/Sydney',
    locale: 'en-AU',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  fr: {
    code: 'fr',
    name: 'Francia',
    flag: '🇫🇷',
    geo: {
      latitude: 48.8566,
      longitude: 2.3522
    },
    timezone: 'Europe/Paris',
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },

  gb: {
    code: 'gb',
    name: 'Reino Unido',
    flag: '🇬🇧',
    geo: {
      latitude: 51.5074,
      longitude: -0.1278
    },
    timezone: 'Europe/London',
    locale: 'en-GB',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }
};

/**
 * Obtiene la lista de países disponibles
 * @returns {Array} Lista de países con código, nombre y bandera
 */
function getCountryList() {
  return Object.values(countries).map((country, index) => ({
    index: index + 1,
    code: country.code,
    name: country.name,
    flag: country.flag
  }));
}

/**
 * Obtiene la configuración de un país por su código
 * @param {string} code - Código del país (sv, tr, ng, etc.)
 * @returns {Object|null} Configuración del país o null si no existe
 */
function getCountryByCode(code) {
  return countries[code.toLowerCase()] || null;
}

/**
 * Obtiene la configuración de un país por su índice en el menú
 * @param {number} index - Índice del país (1-based)
 * @returns {Object|null} Configuración del país o null si no existe
 */
function getCountryByIndex(index) {
  const list = Object.values(countries);
  return list[index - 1] || null;
}

module.exports = {
  countries,
  getCountryList,
  getCountryByCode,
  getCountryByIndex
};

