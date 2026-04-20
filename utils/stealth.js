/**
 * Scripts de sigilo para evitar detección de automatización
 */

/**
 * Script que se inyecta en todas las páginas
 * Bloquea WebRTC y oculta indicadores de automatización
 */
const stealthScript = () => {
  // ATENCIÓN: Ya no sobreescribimos navigator.webdriver ni anulamos WebRTC
  // manualmente. Hacer `window.RTCPeerConnection = null` es una señal de alerta
  // gigante para los sistemas de Google y causa un loop infinito en los captchas.
  // Ahora confiamos en puppeteer-extra-plugin-stealth para falsear todo.
};

/**
 * Aplica los scripts de sigilo al contexto del navegador
 * @param {BrowserContext} context - Contexto de Playwright
 */
async function applyStealthScripts(context) {
  await context.addInitScript(stealthScript);
  console.log('🛡️ Scripts de sigilo aplicados.');
}

/**
 * Configura el listener para nuevas pestañas
 * @param {BrowserContext} context - Contexto de Playwright
 */
function setupPageListener(context) {
  context.on('page', async (newPage) => {
    console.log('📄 Nueva pestaña detectada.');
  });
  console.log('👂 Listener de pestañas configurado.');
}

module.exports = {
  stealthScript,
  applyStealthScripts,
  setupPageListener
};
