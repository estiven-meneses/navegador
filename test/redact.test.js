const { test } = require('node:test');
const assert = require('node:assert');
process.env.PROXY_PASSWORD = 'superSecreta123';
process.env.PROXY_USERNAME = 'miusuario';
const { redact, redactString } = require('../src/logging/redact');

test('borra credenciales de URLs y valores conocidos', () => {
  const s = redactString('fallo http://miusuario__cr.sv:superSecreta123@gw.dataimpulse.com:823');
  assert.ok(!s.includes('superSecreta123'));
  assert.ok(!s.includes('miusuario'));
});

test('borra claves sensibles en objetos anidados', () => {
  const o = redact({ a: { password: 'x', ok: 'superSecreta123 aquí' } });
  assert.strictEqual(o.a.password, '***');
  assert.ok(!o.a.ok.includes('superSecreta123'));
});
