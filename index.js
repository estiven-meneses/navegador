const { chromium } = require('playwright');
const { validateProxy, getProxyConfig } = require('./config/proxy');
const { launchArgs, getContextConfig } = require('./config/browser');
const { applyStealthScripts, setupPageListener } = require('./utils/stealth');
const { showCountryMenu, showCountryInfo } = require('./utils/menu');

/**
 * Navegador con proxy multi-país
 * Configuración anti-detección activada
 */
(async () => {
  // Validar configuración del proxy
  validateProxy();

  // Mostrar menú de selección de país
  const selectedCountry = await showCountryMenu();
  showCountryInfo(selectedCountry);

  // Obtener configuración del proxy para el país seleccionado
  const proxyConfig = getProxyConfig(selectedCountry.code);

  console.log('');
  console.log('🚀 Iniciando navegador...');
  
  // Lanzar navegador
  const browser = await chromium.launch({
    headless: false,
    args: launchArgs
  });

  // Crear contexto con proxy y configuración regional del país
  const context = await browser.newContext(getContextConfig(proxyConfig, selectedCountry));

  // Aplicar scripts de sigilo
  await applyStealthScripts(context);

  // Configurar listener para nuevas pestañas
  setupPageListener(context);

  // Abrir páginas de prueba para verificar IP
  const page1 = await context.newPage();
  await page1.goto('https://browserleaks.com/ip');
  console.log('✅ Página 1: browserleaks.com/ip');

  const page2 = await context.newPage();
  // await page2.goto('https://www.ipqualityscore.com/free-ip-lookup-proxy-vpn-test');
  // console.log('✅ Página 2: ipqualityscore.com');

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Navegador listo - ${selectedCountry.flag} ${selectedCountry.name}`);
  console.log('📍 Puedes abrir nuevas pestañas con Ctrl+T');
  console.log('═══════════════════════════════════════════════════');

  // Mantener el navegador abierto
  await new Promise(() => {});
})();
