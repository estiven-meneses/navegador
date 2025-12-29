/**
 * Scripts de sigilo para evitar detección de automatización
 */

/**
 * Script que se inyecta en todas las páginas
 * Bloquea WebRTC y oculta indicadores de automatización
 */
const stealthScript = () => {
  // Ocultar que es un navegador automatizado
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  
  // Bloqueo total de WebRTC para evitar filtración de IP real
  window.RTCPeerConnection = null;
  window.webkitRTCPeerConnection = null;
  window.mozRTCPeerConnection = null;
};

/**
 * Aplica los scripts de sigilo al contexto del navegador
 * @param {BrowserContext} context - Contexto de Playwright
 */
async function applyStealthScripts(context) {
  await context.addInitScript(stealthScript);
  console.log('🛡️ Scripts de sigilo aplicados al contexto.');
}

/**
 * Configura el listener para nuevas pestañas
 * @param {BrowserContext} context - Contexto de Playwright
 */
function setupPageListener(context) {
  context.on('page', async (newPage) => {
    console.log('📄 Nueva pestaña detectada.');
    await newPage.waitForLoadState('domcontentloaded').catch(() => {});
  });
  console.log('👂 Listener de pestañas configurado.');
}

module.exports = {
  stealthScript,
  applyStealthScripts,
  setupPageListener
};

