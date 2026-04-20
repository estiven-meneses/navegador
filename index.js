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

  // 2. Iniciar el servidor local de proxy dinámico (siempre corre en background)
  const localProxyUrl = await createLocalProxy(null);

  // 3. Importar cloakbrowser para contexto persistente
  const cloakbrowser = await import('cloakbrowser');

  console.log('');
  console.log('🚀 Iniciando navegador con sesión persistente...');

  // Configuración persistente unificada. Siempre pasa por localhost:8000
  // lo que nos permite cambiar la ruta IP real dinámicamente en NodeJS
  const browserConfig = {
    userDataDir: sessionsDir,
    headless: false,
    args: [...launchArgs, '--disable-features=IsolateOrigins,site-per-process'],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: null,
    proxy: {
      server: localProxyUrl
    },
    permissions: ['geolocation']
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
    const { country, useProxy } = await showMainMenu();

    if (useProxy && country) {
      showCountryInfo(country);
      updateProxyUpstream(country.code); // Cambia el proxy al instante
      stats.start();
      console.log(`🌐 Proxy cambiado activo: ${country.flag} ${country.name}`);
    } else {
      updateProxyUpstream(null); // Directo
      stats.start(); // Podemos pausar las estadísticas, o dejarlas
      console.log(`⚡ Proxy desactivado (IP real activa) en todo el navegador`);
    }
  }
})();
