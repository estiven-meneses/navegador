const fs = require('fs');
const path = require('path');
const { validateProxy, createLocalProxy, closeLocalProxy, updateProxyUpstream } = require('../config/proxy');
const { launchArgs } = require('../config/browser');
const { setupPageListener } = require('../utils/stealth');
const { ProxyStats, setupStatsTracking } = require('../utils/stats');

let activeContext = null;
let statsTracker = null;
let currentProfile = null;
let activeCountry = null;
let isProxyActive = false;

/**
 * Inicia el navegador con el perfil y configuración de país especificados.
 */
async function launchBrowser(profileName, country, useProxy) {
  if (activeContext) {
    throw new Error('Ya hay una sesión de navegador abierta. Ciérrala primero.');
  }

  validateProxy();

  const sessionsDir = path.join(__dirname, '..', 'sessions', profileName);
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  // 1. Iniciar el servidor local de proxy dinámico
  const localProxyUrl = await createLocalProxy(useProxy ? country?.code : null);

  // 2. Importar cloakbrowser dinámicamente
  const cloakbrowser = await import('cloakbrowser');

  const browserConfig = {
    userDataDir: sessionsDir,
    headless: false,
    args: [...launchArgs, '--disable-features=IsolateOrigins,site-per-process', '--test-type'], 
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    viewport: null,
    proxy: { server: localProxyUrl },
    permissions: ['geolocation'],
    ...(useProxy && country ? {
      locale: country.locale,
      timezoneId: country.timezone,
      geolocation: country.geo,
      userAgent: country.userAgent
    } : {})
  };

  const context = await cloakbrowser.launchPersistentContext(browserConfig);
  activeContext = context;
  currentProfile = profileName;
  activeCountry = country;
  isProxyActive = useProxy;

  context.on('close', async () => {
    console.log(`[BrowserLauncher] Navegador para perfil ${profileName} cerrado.`);
    await cleanup();
  });

  try {
    const pages = context.pages();
    const activePage = pages.length > 0 ? pages[0] : await context.newPage();
    await activePage.goto('https://browserleaks.com/ip', { timeout: 60000 });
  } catch (error) {
    // ignorar
  }

  setupPageListener(context);
  statsTracker = new ProxyStats();
  setupStatsTracking(context, statsTracker);

  return { success: true, profile: profileName };
}

/**
 * Cambia el proxy en caliente.
 */
async function changeProxy(country, useProxy) {
  if (!activeContext) {
    throw new Error('No hay navegador activo para cambiar el proxy.');
  }

  if (useProxy && country) {
    updateProxyUpstream(country.code);
    activeCountry = country;
    isProxyActive = true;
    if (statsTracker) statsTracker.start();

    try {
      await activeContext.setGeolocation(country.geo);
    } catch (e) {}

  } else {
    updateProxyUpstream(null);
    activeCountry = null;
    isProxyActive = false;
    if (statsTracker) statsTracker.start();

    try {
      await activeContext.setGeolocation(null);
    } catch (e) {}
  }

  try {
    const pages = activeContext.pages();
    if (pages.length > 0) {
      await pages[0].reload({ waitUntil: 'domcontentloaded' });
    }
  } catch (error) {}

  return { success: true, activeCountry, isProxyActive };
}

/**
 * Cierra la sesión activa de navegador
 */
async function stopBrowser() {
  if (!activeContext) {
    return { success: true, message: 'Ningún navegador activo.' };
  }
  
  await activeContext.close(); // Esto disparará el evento 'close' que llama a cleanup
  return { success: true, message: 'Navegador cerrado.' };
}

/**
 * Limpieza de recursos y proxy
 */
async function cleanup() {
  activeContext = null;
  currentProfile = null;
  activeCountry = null;
  isProxyActive = false;
  if (statsTracker) {
    statsTracker.showStats();
    statsTracker = null;
  }
  await closeLocalProxy();
}

/**
 * Retorna el estado actual del lanzador
 */
function getStatus() {
  return {
    isRunning: !!activeContext,
    currentProfile,
    isProxyActive,
    activeCountry
  };
}

module.exports = {
  launchBrowser,
  changeProxy,
  stopBrowser,
  getStatus
};