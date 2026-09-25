/**
 * Registro persistente de errores con estado (logs/errors.json).
 *
 * - Cada error distinto es una "incidencia" con id estable (ERR-0001...).
 * - Si el mismo error se repite, NO se duplica: suben `count` y `lastSeen`.
 * - Estados: open (presente) · fixed (resuelto) · ignored (no es un bug).
 * - Si una incidencia "fixed" vuelve a ocurrir, se reabre sola y se anota
 *   en su historial como regresión: así se sabe si un arreglo funcionó de verdad.
 *
 * El archivo se relee antes de cada escritura (read-modify-write atómico)
 * para que el servidor y el CLI (`npm run errors`) no se pisen.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { redact, redactString } = require('./redact');

const STATUSES = ['open', 'fixed', 'ignored'];
const MAX_OCCURRENCES = 10; // últimas ocurrencias guardadas por incidencia

function emptyDb() {
  return { version: 1, nextNumber: 1, issues: [] };
}

function load(file = config.paths.errorsFile) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Archivo corrupto: se aparta para no perderlo y se empieza de nuevo.
      try { fs.renameSync(file, `${file}.corrupt-${Date.now()}`); } catch {}
    }
    return emptyDb();
  }
}

function save(db, file = config.paths.errorsFile) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, file);
}

/**
 * Normaliza el mensaje para que el mismo error con datos variables
 * (números, ids, rutas temporales, IPs) produzca la misma huella.
 */
function normalizeMessage(message) {
  return String(message || '')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, '<ip>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
}

function firstStackFrame(stack) {
  if (!stack) return '';
  const line = stack.split('\n').find(l => l.trim().startsWith('at ') && !l.includes('node:internal'));
  return (line || '').trim().replace(/:\d+:\d+\)?$/, '');
}

function fingerprintOf({ source, code, message, stack }) {
  const basis = [source, code || '', normalizeMessage(message), firstStackFrame(stack)].join('|');
  return crypto.createHash('sha1').update(basis).digest('hex').slice(0, 12);
}

/**
 * Registra un error. Devuelve la incidencia resultante.
 * @param {object} e
 * @param {'server'|'browser'|'proxy'|'ui'|'process'|'detection'} e.source  módulo de origen
 * @param {string} e.message
 * @param {string} [e.title]   resumen legible (por defecto el mensaje)
 * @param {'error'|'warn'} [e.level]
 * @param {string} [e.code]    código estable opcional (p.ej. PROXY_AUTH) — agrupa mejor que el mensaje
 * @param {string} [e.stack]
 * @param {object} [e.context] datos útiles para reproducir (se redactan)
 */
function record(e, file = config.paths.errorsFile) {
  const now = new Date().toISOString();
  const entry = {
    source: e.source || 'server',
    level: e.level || 'error',
    code: e.code || null,
    message: redactString(String(e.message || 'Error sin mensaje')),
    stack: e.stack ? redactString(String(e.stack)).split('\n').slice(0, 12).join('\n') : null,
    context: e.context ? redact(e.context) : null,
  };
  const fp = fingerprintOf(entry);

  const db = load(file);
  let issue = db.issues.find(i => i.fingerprint === fp);

  if (!issue) {
    issue = {
      id: `ERR-${String(db.nextNumber++).padStart(4, '0')}`,
      fingerprint: fp,
      status: 'open',
      title: redactString(e.title || entry.message).slice(0, 160),
      source: entry.source,
      level: entry.level,
      code: entry.code,
      message: entry.message,
      stack: entry.stack,
      firstSeen: now,
      lastSeen: now,
      count: 0,
      regressions: 0,
      occurrences: [],
      history: [{ at: now, action: 'detectado', note: 'Primera aparición' }],
    };
    db.issues.push(issue);
  } else if (issue.status === 'fixed') {
    issue.status = 'open';
    issue.regressions += 1;
    issue.history.push({
      at: now,
      action: 'reabierto',
      note: 'Volvió a ocurrir después de marcarse como resuelto: el arreglo no fue suficiente.',
    });
  }

  issue.count += 1;
  issue.lastSeen = now;
  issue.stack = entry.stack || issue.stack;
  issue.occurrences.push({ at: now, message: entry.message, context: entry.context });
  if (issue.occurrences.length > MAX_OCCURRENCES) issue.occurrences.shift();

  save(db, file);
  return issue;
}

/**
 * Cambia el estado de una incidencia y deja nota en el historial.
 * @param {string} id
 * @param {'open'|'fixed'|'ignored'} status
 * @param {string} note  qué se hizo / por qué
 * @param {object} [meta] { by: 'agente/persona', commit: 'sha' }
 */
function setStatus(id, status, note, meta = {}, file = config.paths.errorsFile) {
  if (!STATUSES.includes(status)) throw new Error(`Estado inválido: ${status}. Usa: ${STATUSES.join(', ')}`);
  const db = load(file);
  const issue = db.issues.find(i => i.id.toLowerCase() === String(id).toLowerCase());
  if (!issue) throw new Error(`No existe la incidencia ${id}`);
  const now = new Date().toISOString();
  issue.status = status;
  if (status === 'fixed') {
    issue.fixedAt = now;
    issue.fixNote = note || null;
    issue.fixedIn = meta.commit || null;
  }
  issue.history.push({
    at: now,
    action: { open: 'reabierto', fixed: 'resuelto', ignored: 'ignorado' }[status],
    note: note || null,
    by: meta.by || null,
    commit: meta.commit || null,
  });
  save(db, file);
  return issue;
}

function list({ status } = {}, file = config.paths.errorsFile) {
  const db = load(file);
  const issues = status ? db.issues.filter(i => i.status === status) : db.issues;
  return [...issues].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

function get(id, file = config.paths.errorsFile) {
  return load(file).issues.find(i => i.id.toLowerCase() === String(id).toLowerCase()) || null;
}

module.exports = { record, setStatus, list, get, fingerprintOf, normalizeMessage, STATUSES };
