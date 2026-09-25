/**
 * Consumo del plan de proxy (data/usage.json).
 *
 * Se cuentan los bytes REALES que pasan por el proxy local hacia DataImpulse
 * (ver proxy/localProxy.js). Es una estimación: el dato oficial está en el
 * panel de DataImpulse. `resetBalance` sincroniza con ese dato.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function load() {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(config.paths.usageFile, 'utf8')); } catch {}
  return {
    balanceGB: data.balanceGB ?? Number(process.env.PROXY_LIMIT_GB || 5),
    consumedBytes: data.consumedBytes || 0,
    totalSessions: data.totalSessions || 0,
    lastSync: data.lastSync || null,
    lastSession: data.lastSession || null,
    byProfile: data.byProfile || {},
  };
}

function save(data) {
  fs.mkdirSync(path.dirname(config.paths.usageFile), { recursive: true });
  const tmp = `${config.paths.usageFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, config.paths.usageFile);
}

function addBytes(profileId, bytes) {
  if (!bytes) return;
  const data = load();
  data.consumedBytes += bytes;
  data.byProfile[profileId] = (data.byProfile[profileId] || 0) + bytes;
  data.lastSession = new Date().toISOString();
  save(data);
}

function countSession() {
  const data = load();
  data.totalSessions += 1;
  save(data);
}

/** El usuario copia el saldo real del panel de DataImpulse: el contador vuelve a 0. */
function resetBalance(balanceGB) {
  const gb = Number(balanceGB);
  if (!Number.isFinite(gb) || gb < 0) throw Object.assign(new Error('Saldo inválido'), { status: 400 });
  const data = load();
  data.balanceGB = gb;
  data.consumedBytes = 0;
  data.lastSync = new Date().toISOString();
  save(data);
  return summary();
}

function summary() {
  const data = load();
  const balanceBytes = data.balanceGB * 1024 ** 3;
  return { ...data, remainingBytes: Math.max(0, balanceBytes - data.consumedBytes), balanceBytes };
}

module.exports = { addBytes, countSession, resetBalance, summary };
