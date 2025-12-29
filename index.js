const { chromium } = require('playwright');
const { proxyConfig, validateProxy } = require('./config/proxy');
const { launchArgs, getContextConfig } = require('./config/browser');
const { applyStealthScripts, setupPageListener } = require('./utils/stealth');

/**
 * Navegador con proxy de El Salvador
 * Configuración anti-detección activada
 */
(async () => {
  // Validar configuración
  validateProxy();

  console.log('🚀 Iniciando navegador...');
  
  // Lanzar navegador
  const browser = await chromium.launch({
    headless: false,
    args: launchArgs
  });

  // Crear contexto con proxy y configuración regional
  const context = await browser.newContext(getContextConfig(proxyConfig));

  // Aplicar scripts de sigilo
  await applyStealthScripts(context);

  // Configurar listener para nuevas pestañas
  setupPageListener(context);

  // Abrir páginas de prueba
  const page1 = await context.newPage();
  await page1.goto('https://browserleaks.com/ip');
  console.log('✅ Página 1: browserleaks.com/ip');

  const page2 = await context.newPage();
  await page2.goto('https://www.ipqualityscore.com/free-ip-lookup-proxy-vpn-test');
  console.log('✅ Página 2: ipqualityscore.com');

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🌐 Navegador listo - IP de El Salvador');
  console.log('📍 Puedes abrir nuevas pestañas con Ctrl+T');
  console.log('═══════════════════════════════════════════');

  // Mantener el navegador abierto
  await new Promise(() => {});
})();

