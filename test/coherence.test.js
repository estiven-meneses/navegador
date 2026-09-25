const { test } = require('node:test');
const assert = require('node:assert');
process.env.PROXY_USERNAME = 'login__cr.us';
process.env.PROXY_PASSWORD = 'pw';
const { buildUsername, buildUpstreamUrl } = require('../src/proxy/upstream');
const { buildLaunchOptions, acceptLanguages } = require('../src/browser/launchOptions');
const { citySlug } = require('../src/geo/locations');
const { guessCountry } = require('../src/profiles/profileStore');

const profile = {
  id: 'p1a2b3c4d', fingerprint: { seed: 12345 }, locale: null,
  proxy: { enabled: true, country: 'sv', city: 'San Salvador', rotation: 2 },
};
const exit = { ip: '190.150.164.85', countryCode: 'sv', timezone: 'America/El_Salvador', lat: 13.69, lon: -89.19 };

test('usuario DataImpulse: país, ciudad, sesión fija y TTL; limpia parámetros del .env', () => {
  assert.strictEqual(buildUsername(profile), 'login__cr.sv;city.sansalvador;sessid.p1a2b3c4dr2;sessttl.60');
});

test('sin proxy no hay upstream', () => {
  assert.strictEqual(buildUpstreamUrl({ ...profile, proxy: { ...profile.proxy, enabled: false } }), null);
});

test('las opciones de arranque son coherentes con la IP de salida', () => {
  const o = buildLaunchOptions({ profile, userDataDir: '/tmp/x', localProxyUrl: 'http://127.0.0.1:5000', exit });
  assert.strictEqual(o.userAgent, undefined, 'nunca se fuerza el User-Agent');
  assert.strictEqual(o.timezone, 'America/El_Salvador');
  assert.strictEqual(o.locale, 'es-SV');
  assert.ok(o.args.includes('--fingerprint=12345'));
  assert.ok(o.args.includes('--fingerprint-webrtc-ip=190.150.164.85'));
  assert.ok(Math.abs(o.contextOptions.geolocation.latitude - 13.69) < 0.02);
  assert.strictEqual(o.contextOptions.locale, undefined, 'locale nunca por CDP');
  assert.strictEqual(o.contextOptions.permissions, undefined, 'no se concede geolocalización sin preguntar');
});

test('la misma semilla produce siempre las mismas opciones (dispositivo estable)', () => {
  const a = buildLaunchOptions({ profile, userDataDir: '/x', localProxyUrl: 'http://l', exit });
  const b = buildLaunchOptions({ profile, userDataDir: '/x', localProxyUrl: 'http://l', exit });
  assert.deepStrictEqual(a, b);
});

test('sin proxy se usan los valores reales del sistema', () => {
  const o = buildLaunchOptions({ profile: { ...profile, proxy: { enabled: false } }, userDataDir: '/x', localProxyUrl: null, exit: null });
  assert.strictEqual(o.timezone, undefined);
  assert.strictEqual(o.locale, undefined);
  assert.strictEqual(o.proxy, undefined);
});

test('utilidades', () => {
  assert.deepStrictEqual(acceptLanguages('es-SV'), ['es-SV', 'es']);
  assert.strictEqual(citySlug('Bogotá D.C.'), 'bogotadc');
  assert.strictEqual(guessCountry('platzi salvador'), 'sv');
  assert.strictEqual(guessCountry('usa'), 'us');
  assert.strictEqual(guessCountry('trabajo'), null);
});

test('Preferences: Accept-Language y corrector siguen al país; sin proxy vuelve al sistema', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { preparePreferences } = require('../src/browser/chromePrefs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-'));
  fs.mkdirSync(path.join(dir, 'Default'));
  fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), JSON.stringify({ spellcheck: { dictionaries: ['es'] }, intl: { accept_languages: 'es-CO,es' } }));
  preparePreferences(dir, { languages: acceptLanguages('en-US') });
  let p = JSON.parse(fs.readFileSync(path.join(dir, 'Default', 'Preferences'), 'utf8'));
  assert.strictEqual(p.intl.accept_languages, 'en-US,en');
  assert.deepStrictEqual(p.spellcheck.dictionaries, ['en-US']);
  preparePreferences(dir, { languages: null });
  p = JSON.parse(fs.readFileSync(path.join(dir, 'Default', 'Preferences'), 'utf8'));
  assert.strictEqual(p.intl.accept_languages, undefined);
});
