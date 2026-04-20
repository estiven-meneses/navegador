// Eliminar importacion de playwright-extra
// const { chromium } = require('playwright-extra');
// const stealth = require('puppeteer-extra-plugin-stealth')();
// chromium.use(stealth);

// const { FingerprintGenerator } = require('fingerprint-generator');
// const { FingerprintInjector } = require('fingerprint-injector');

const fs = require('fs');
const path = require('path');
const { validateProxy, createLocalProxy, closeLocalProxy, updateProxyUpstream } = require('./config/proxy');
const { launchArgs, getContextConfigNoProxy } = require('./config/browser');
const { setupPageListener } = require('./utils/stealth');
const { askProfileName, showMainMenu, showCountryInfo } = require('./utils/menu');
const { ProxyStats, setupStatsTracking } = require('./utils/stats');

/**
 * Navegador con proxy multi-país y perfiles persistentes
 * Configuración anti-detección activada + proxy dinámico
 */
(async () => {
  validateProxy();

  // 1. Preguntar por el perfil de la sesión y prepararlo
  const profileName = await askProfileName();
  const sessionsDir = path.join(__dirname, 'sessions', profileName);
  
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log(`✨ Nuevo perfil creado: ${profileName}`);
  } else {
    console.log(`📂 Perfil cargado: ${profileName}`);
  }

  // 2. Mostrar menú principal para elegir ubicación INICIAL
  const { country, useProxy } = await showMainMenu();

  if (useProxy && country) {
    showCountryInfo(country);
  }

  // 3. Iniciar el servidor local de proxy dinámico con la selección inicial
  const localProxyUrl = await createLocalProxy(useProxy ? country?.code : null);

  // 4. Importar cloakbrowser para contexto persistente
  const cloakbrowser = await import('cloakbrowser');

  console.log('');
  console.log('🚀 Iniciando navegador con sesión persistente...');

  // Configuración persistente unificada.
  const browserConfig = {
    userDataDir: sessionsDir,
    headless: false,
    args: [...launchArgs, '--disable-features=IsolateOrigins,site-per-process', '--test-type'], 
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    viewport: null,
    proxy: { server: localProxyUrl },
    permissions: ['geolocation'],
    // Inyectar timezone, locale e IP según el proxy inicial escogido
    ...(useProxy && country ? {
      locale: country.locale,
      timezoneId: country.timezone,
      geolocation: country.geo,
      userAgent: country.userAgent
    } : {})
  };

  const context = await cloakbrowser.launchPersistentContext(browserConfig);

  context.on('close', async () => {
    console.log('\n🚪 Navegador cerrado por el usuario. Ejecutando limpieza...');
    stats.showStats();
    await closeLocalProxy();
    process.exit(0);
  });

  // Intentamos abrir Google o la web inicial
  try {
    const pages = context.pages();
    const activePage = pages.length > 0 ? pages[0] : await context.newPage();
    await activePage.goto('https://browserleaks.com/ip', { timeout: 60000 });
  } catch (error) {
    // ignorar
  }

  // Configurar listener
  setupPageListener(context);

  const stats = new ProxyStats();
  setupStatsTracking(context, stats);

  console.log('✅ Navegador funcionando');
  
  // Bucle infinito: Menú interactivo en tiempo de ejecución para cambiar Proxy sin cerrar
  while (true) {
    const nextMenu = await showMainMenu();
    const nextCountry = nextMenu.country;
    const nextUseProxy = nextMenu.useProxy;

    if (nextUseProxy && nextCountry) {
      showCountryInfo(nextCountry);
      updateProxyUpstream(nextCountry.code); // Cambia el proxy al instante
      stats.start();
      
      // Intentar actualizar geo al instante (solo aplica en vivo para geolocalización,
      // timezone y locale seguirán siendo los iniciales de la sesión)
      try { 
        await context.setGeolocation(nextCountry.geo); 
      } catch (e) {}

      console.log(`🌐 Proxy cambiado activo: ${nextCountry.flag} ${nextCountry.name}`);
    } else {
      updateProxyUpstream(null); // Directo
      stats.start();
      try { 
        await context.setGeolocation(null); 
      } catch (e) {}

      console.log(`⚡ Proxy desactivado (IP real activa) en todo el navegador`);
    }

    // Recargar la pestaña activa automáticamente para reflejar el cambio
    try {
      const pages = context.pages();
      if (pages.length > 0) {
        await pages[0].reload({ waitUntil: 'domcontentloaded' });
      }
    } catch (error) {}
  }
})();
