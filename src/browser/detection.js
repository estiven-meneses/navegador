/**
 * Detecta cuándo un sitio nos pone un captcha o un desafío anti-bot, y lo
 * registra como incidencia (source "detection") con todo el contexto: sitio,
 * IP de salida, país, semilla de huella. Sirve para medir si el navegador
 * pasa desapercibido y para que la IA analice patrones (¿siempre el mismo sitio?
 * ¿siempre la misma IP/país?).
 *
 * Señales usadas (bajo ruido, no se disparan con captchas invisibles que pasan):
 *  - Google "unusual traffic": navegación a google.*\/sorry/
 *  - Cloudflare: respuesta de documento con cabecera `cf-mitigated: challenge`
 *  - reCAPTCHA: descarga de imágenes del reto (api2/payload o enterprise/payload)
 *  - hCaptcha: petición getcaptcha (el reto visual)
 */
const log = require('../logging/logger').child('detection');

const RULES = [
  { type: 'google-sorry', test: (url) => /^https:\/\/(www\.)?google\.[a-z.]+\/sorry\//.test(url) },
  { type: 'recaptcha', test: (url) => /\/recaptcha\/(api2|enterprise)\/payload/.test(url) },
  { type: 'hcaptcha', test: (url) => /hcaptcha\.com\/getcaptcha/.test(url) },
];

function pageHost(req) {
  try {
    const url = req.frame()?.page()?.url();
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

/**
 * @param {import('playwright-core').BrowserContext} context
 * @param {() => object} getInfo  contexto actual de la sesión (perfil, IP...)
 */
function attachDetection(context, getInfo) {
  const seen = new Map(); // "tipo|host" -> timestamp, para no registrar 20 veces el mismo reto

  const report = (type, host, url) => {
    const key = `${type}|${host}`;
    const last = seen.get(key) || 0;
    if (Date.now() - last < 60_000) return;
    seen.set(key, Date.now());
    log.warn(`Captcha/desafío "${type}" en ${host}`, {
      code: `CAPTCHA_${type.toUpperCase().replace(/-/g, '_')}`,
      title: `Captcha ${type} en ${host}`,
      track: true,
      context: { ...getInfo(), site: host, url: url.slice(0, 200) },
    });
  };

  context.on('request', (req) => {
    const url = req.url();
    for (const rule of RULES) {
      if (rule.test(url)) report(rule.type, pageHost(req) || new URL(url).hostname, url);
    }
  });

  context.on('response', async (res) => {
    try {
      const req = res.request();
      if (!req.isNavigationRequest()) return;
      if ((await res.headerValue('cf-mitigated')) === 'challenge') {
        report('cloudflare', new URL(res.url()).hostname, res.url());
      }
    } catch {
      // La página pudo cerrarse mientras tanto: ignorar.
    }
  });
}

module.exports = { attachDetection, RULES };
