/**
 * Ajusta la ventana a la pantalla que reporta la huella.
 *
 * En macOS la huella de CloakBrowser puede reportar una pantalla más pequeña que
 * la real (p.ej. screen 1440x900 en un Retina de 1680x1050 lógicos). Con
 * --start-maximized la ventana mide 1680 y queda outerWidth > screen.width:
 * una ventana más grande que la pantalla es IMPOSIBLE en un equipo real y los
 * detectores lo marcan. Aquí se redimensiona la ventana a la pantalla reportada.
 *
 * Se hace una sola vez al arrancar, sobre about:blank (antes de visitar sitios).
 */
async function fitWindowToScreen(context) {
  const page = context.pages()[0] || await context.newPage();
  const s = await page.evaluate(() => ({
    w: screen.availWidth, h: screen.availHeight,
    l: screen.availLeft || 0, t: screen.availTop || 0,
    ow: window.outerWidth, oh: window.outerHeight,
  }));
  if (s.ow <= s.w && s.oh <= s.h) return { resized: false, screen: s };

  const cdp = await context.newCDPSession(page);
  try {
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    // Un ventana maximizada no acepta tamaño: primero a estado normal.
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: s.l, top: s.t, width: s.w, height: s.h } });
  } finally {
    await cdp.detach().catch(() => {});
  }
  return { resized: true, screen: s };
}

module.exports = { fitWindowToScreen };
