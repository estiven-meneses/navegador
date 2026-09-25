/**
 * Traduce (perfil + IP de salida real) -> opciones de CloakBrowser.
 *
 * REGLAS DE COHERENCIA (no romperlas sin anotar en docs/DECISIONES.md):
 *  1. NUNCA forzar userAgent. El binario de CloakBrowser genera un UA que coincide
 *     con su versión real de Chromium, la plataforma, los Client Hints y la GPU.
 *     Un UA inventado (p.ej. "Windows Chrome 123" en un Chromium 145 de macOS) es
 *     la contradicción más fácil de detectar.
 *  2. Semilla de huella FIJA por perfil (--fingerprint=<seed>): mismo dispositivo siempre.
 *  3. Zona horaria y geolocalización = las de la IP de salida real, no las de una tabla.
 *  4. Idioma = el del país del proxy (o el que fije el perfil).
 *  5. WebRTC anuncia la IP del proxy, nunca la real.
 *  6. timezone/locale van por flags del binario (indetectables), no por emulación CDP.
 *     Por eso NO se pasan `locale`/`timezoneId` dentro de contextOptions.
 */
const { getCountry } = require('../geo/locations');

/** Pequeño desplazamiento determinista (~0-1.5 km) para no dar el centro exacto de la ciudad. */
function jitterFromSeed(seed) {
  const a = ((seed * 9301 + 49297) % 233280) / 233280;
  const b = ((seed * 7919 + 104729) % 233280) / 233280;
  return { dLat: (a - 0.5) * 0.027, dLon: (b - 0.5) * 0.027, accuracy: 25 + Math.round(a * 75) };
}

/**
 * @param {object} p
 * @param {object} p.profile        perfil (profile.json)
 * @param {string} p.userDataDir    carpeta browser-data del perfil
 * @param {string|null} p.localProxyUrl  proxy local, null = conexión directa
 * @param {object|null} p.exit      resultado de checkExitIp()
 */
function buildLaunchOptions({ profile, userDataDir, localProxyUrl, exit }) {
  const usingProxy = Boolean(localProxyUrl);
  const country = usingProxy ? getCountry(profile.proxy.country) : null;

  const args = [
    `--fingerprint=${profile.fingerprint.seed}`,
    '--start-maximized',
    '--disable-search-engine-choice-screen',
    // Oculta la barra "flag no soportado" que provoca el --no-sandbox que añade CloakBrowser.
    '--test-type',
  ];

  const options = {
    userDataDir,
    headless: false,
    viewport: null, // ventana real: el tamaño de página coincide con la ventana
    args,
  };

  if (usingProxy) {
    options.proxy = { server: localProxyUrl };
    options.locale = profile.locale || country?.locale;
    options.timezone = exit?.timezone || country?.timezone;
    if (exit?.ip) args.push(`--fingerprint-webrtc-ip=${exit.ip}`);

    const lat = exit?.lat ?? country?.geo[0];
    const lon = exit?.lon ?? country?.geo[1];
    if (lat != null && lon != null) {
      const j = jitterFromSeed(profile.fingerprint.seed);
      // Solo fija la posición; el permiso NO se concede: el sitio pregunta como en un navegador normal.
      options.contextOptions = {
        geolocation: { latitude: +(lat + j.dLat).toFixed(5), longitude: +(lon + j.dLon).toFixed(5), accuracy: j.accuracy },
      };
    }
  } else if (profile.locale) {
    options.locale = profile.locale;
  }

  return options;
}

/** Lista de idiomas preferidos coherente con el locale: "es-SV" -> ["es-SV", "es"]. */
function acceptLanguages(locale) {
  if (!locale) return null;
  const base = locale.split('-')[0];
  return base === locale ? [locale] : [locale, base];
}

module.exports = { buildLaunchOptions, acceptLanguages, jitterFromSeed };
