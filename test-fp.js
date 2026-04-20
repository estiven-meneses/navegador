const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const { FingerprintGenerator } = require('fingerprint-generator');
const { FingerprintInjector } = require('fingerprint-injector');

(async () => {
    const generator = new FingerprintGenerator({
        devices: ['desktop'],
        operatingSystems: ['windows']
    });
    
    // Obtenemos todo el objeto que contiene fingerprint + headers
    const fpGenRes = generator.getFingerprint();
    const { fingerprint } = fpGenRes;
    const injector = new FingerprintInjector();
    
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
        ],
        ignoreDefaultArgs: ['--enable-automation']
    });
    
    const context = await browser.newContext({
        userAgent: fingerprint.navigator.userAgent,
        locale: fingerprint.navigator.language,
        viewport: {
            width: fingerprint.screen.width,
            height: fingerprint.screen.height
        }
    });
    
    await injector.attachFingerprintToPlaywright(context, fpGenRes);
    const page = await context.newPage();
    await page.goto('https://browserleaks.com/ip', { waitUntil: 'load' });
    console.log('Tested! Wait, no errors?');
    // setTimeout(() => browser.close(), 5000);
})();
