const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tracker = require('../src/logging/errorTracker');

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'errs-')), 'errors.json');

test('el mismo error se agrupa en una sola incidencia', () => {
  const f = tmpFile();
  const a = tracker.record({ source: 'proxy', message: 'Timeout tras 3000 ms en 1.2.3.4' }, f);
  const b = tracker.record({ source: 'proxy', message: 'Timeout tras 5000 ms en 9.9.9.9' }, f);
  assert.strictEqual(a.id, b.id);
  assert.strictEqual(tracker.get(a.id, f).count, 2);
});

test('una incidencia resuelta que reaparece se reabre como regresión', () => {
  const f = tmpFile();
  const i = tracker.record({ source: 'server', message: 'boom' }, f);
  tracker.setStatus(i.id, 'fixed', 'arreglado', { commit: 'abc' }, f);
  assert.strictEqual(tracker.get(i.id, f).status, 'fixed');
  tracker.record({ source: 'server', message: 'boom' }, f);
  const after = tracker.get(i.id, f);
  assert.strictEqual(after.status, 'open');
  assert.strictEqual(after.regressions, 1);
  assert.ok(after.history.some(h => h.action === 'reabierto'));
});

test('errores distintos obtienen ids consecutivos', () => {
  const f = tmpFile();
  const a = tracker.record({ source: 'server', message: 'uno' }, f);
  const b = tracker.record({ source: 'ui', message: 'dos' }, f);
  assert.strictEqual(a.id, 'ERR-0001');
  assert.strictEqual(b.id, 'ERR-0002');
});

test('estado inválido lanza error', () => {
  const f = tmpFile();
  const i = tracker.record({ source: 'server', message: 'x' }, f);
  assert.throws(() => tracker.setStatus(i.id, 'hecho', '', {}, f));
});
