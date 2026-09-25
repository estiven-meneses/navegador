/**
 * Logger único del proyecto.
 *
 * - Consola: legible para humanos.
 * - Disco: logs/app/AAAA-MM-DD.jsonl (una línea JSON por evento, un archivo por día).
 * - log.error(...) y log.warn(..., { track: true }) además crean/actualizan una
 *   incidencia en logs/errors.json (ver errorTracker.js).
 *
 * Uso: const log = require('./logging/logger').child('proxy');
 *      log.info('Proxy iniciado', { port });
 *      log.error('Fallo de autenticación', { err, code: 'PROXY_AUTH', context: {...} });
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const tracker = require('./errorTracker');
const { redact, redactString } = require('./redact');

const ICONS = { debug: '·', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' };

function localDate(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function writeLine(obj) {
  try {
    fs.mkdirSync(config.paths.dailyLogs, { recursive: true });
    fs.appendFileSync(path.join(config.paths.dailyLogs, `${localDate()}.jsonl`), JSON.stringify(obj) + '\n');
  } catch (err) {
    // Nunca dejar que el logger tumbe la app.
    console.error('[logger] No se pudo escribir el log:', err.message);
  }
}

/**
 * @param {string} source módulo que emite el log
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object} [opts] { err, code, title, context, track }
 */
function emit(source, level, message, opts = {}) {
  const { err, code, title, context } = opts;
  const track = opts.track ?? level === 'error';
  const entry = {
    ts: new Date().toISOString(),
    level,
    source,
    message: redactString(message),
    ...(code ? { code } : {}),
    ...(context ? { context: redact(context) } : {}),
    ...(err ? { error: redactString(err.message || String(err)) } : {}),
  };

  if (level !== 'debug' || process.env.DEBUG) {
    const extra = err ? ` — ${entry.error}` : '';
    const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    out(`${ICONS[level]} [${source}] ${entry.message}${extra}`);
  }

  let issueId;
  if (track && (level === 'error' || level === 'warn')) {
    try {
      const issue = tracker.record({
        source,
        level,
        code,
        title: title || message,
        message: err && !message.includes(err.message || String(err)) ? `${message}: ${err.message || err}` : message,
        stack: err?.stack,
        context,
      });
      issueId = issue.id;
      entry.issue = issueId;
    } catch (e) {
      console.error('[logger] No se pudo registrar la incidencia:', e.message);
    }
  }
  writeLine(entry);
  return issueId;
}

function child(source) {
  return {
    debug: (msg, opts) => emit(source, 'debug', msg, opts),
    info: (msg, opts) => emit(source, 'info', msg, opts),
    warn: (msg, opts) => emit(source, 'warn', msg, opts),
    error: (msg, opts) => emit(source, 'error', msg, opts),
  };
}

/** Lee las últimas N líneas del log de un día (para la UI / diagnóstico). */
function readDay(date = localDate(), limit = 300) {
  try {
    const lines = fs.readFileSync(path.join(config.paths.dailyLogs, `${date}.jsonl`), 'utf8').trim().split('\n');
    return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

function listDays() {
  try {
    return fs.readdirSync(config.paths.dailyLogs).filter(f => f.endsWith('.jsonl')).map(f => f.slice(0, -6)).sort().reverse();
  } catch {
    return [];
  }
}

module.exports = { child, emit, readDay, listDays, localDate };
