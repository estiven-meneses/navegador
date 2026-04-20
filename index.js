// Eliminar importacion de playwright-extra
// const { chromium } = require('playwright-extra');
// const stealth = require('puppeteer-extra-plugin-stealth')();
// chromium.use(stealth);

// const { FingerprintGenerator } = require('fingerprint-generator');
// const { FingerprintInjector } = require('fingerprint-injector');

const { validateProxy, createLocalProxy, closeLocalProxy } = require('./config/proxy');
const { launchArgs, getContextConfigWithProxy, getContextConfigNoProxy } = require('./config/browser');
const { applyStealthScripts, setupPageListener } = require('./utils/stealth');
const { showMainMenu, showCountryInfo } = require('./utils/menu');
const { ProxyStats, setupStatsTracking } = require('./utils/stats');

/**
 * Navegador con proxy multi-país
 * Configuración anti-detección activada
 */
(async () => {
  // Mostrar menú principal
  const { country, useProxy } = await showMainMenu();

  let contextConfig;
  let localProxyUrl = null;
  const stats = new ProxyStats();

  if (useProxy && country) {
    // Validar y configurar proxy
    validateProxy();
    showCountryInfo(country);
    
    // Crear proxy local sin autenticación
    localProxyUrl = await createLocalProxy(country.code);
    contextConfig = getContextConfigWithProxy(localProxyUrl, country);
  } else {
    // Navegador normal sin configuraciones
    contextConfig = getContextConfigNoProxy();
  }

  console.log('');
  console.log('🚀 Iniciando navegador...');
  
  // Importar cloakbrowser dinámicamente porque es ESM Only
  const cloakbrowser = await import('cloakbrowser');

  // Lanzar navegador con un binario anti-detección parcheado a nivel C++
  const browser = await cloakbrowser.launch({
    headless: false,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation']
  });

  // Crear contexto
  const context = await browser.newContext(contextConfig);

  // Ya NO se aplican los scripts stealth JS (pueden interferir con los parches de C++ de CloakBrowser)
  // await applyStealthScripts(context);

  // Configurar listener para nuevas pestañas
  setupPageListener(context);

  // Iniciar rastreo de estadísticas (solo si usa proxy)
  if (useProxy) {
    stats.start();
    setupStatsTracking(context, stats);
  }

  // Abrir página inicial
  const page1 = await context.newPage();
  try {
    await page1.goto('https://browserleaks.com/ip', { timeout: 60000 });
    console.log('✅ Página: browserleaks.com/ip');
  } catch (error) {
    console.error('❌ Error al cargar la página inicial:', error.message);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  if (useProxy && country) {
    console.log(`🌐 Navegador listo - ${country.flag} ${country.name}`);
  } else {
    console.log(`🌐 Navegador normal - Tu IP real`);
  }
  console.log('📍 Puedes abrir nuevas pestañas con Ctrl+T');
  console.log('═══════════════════════════════════════════════════');

  // Esperar a que se cierre el navegador
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
  });

  // Mostrar estadísticas al cerrar (solo si usó proxy)
  if (useProxy) {
    stats.showStats();
  }

  // Limpiar proxy local al cerrar
  if (localProxyUrl) {
    await closeLocalProxy(localProxyUrl);
    console.log('🧹 Proxy local cerrado');
  }
  
  console.log('👋 ¡Hasta luego!');
})();
