#!/usr/bin/env node
/**
 * CLI de incidencias (logs/errors.json). Pensado para humanos y para agentes de IA.
 *
 *   npm run errors                         lista las abiertas (lo pendiente)
 *   npm run errors -- all                  lista todas
 *   npm run errors -- show ERR-0003        detalle completo (stack, contexto, historial)
 *   npm run errors -- fix ERR-0003 "qué se cambió" [--commit <sha>] [--by <quién>]
 *   npm run errors -- ignore ERR-0003 "por qué no es un bug"
 *   npm run errors -- reopen ERR-0003 "motivo"
 *   npm run errors -- logs [AAAA-MM-DD]    últimas líneas del log de un día (hoy por defecto)
 */
const tracker = require('../src/logging/errorTracker');
const logger = require('../src/logging/logger');

const LABEL = { open: '🔴 ABIERTO', fixed: '🟢 RESUELTO', ignored: '⚪ IGNORADO' };

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

function printList(issues, title) {
  console.log(`\n${title} (${issues.length})\n`);
  if (!issues.length) return console.log('  Nada por aquí. ✨\n');
  for (const i of issues) {
    const reg = i.regressions ? ` · ⚠️ reabierto ${i.regressions}x` : '';
    console.log(`  ${i.id}  ${LABEL[i.status]}  [${i.source}/${i.level}]  ×${i.count}${reg}`);
    console.log(`         ${i.title}`);
    console.log(`         última vez: ${fmtDate(i.lastSeen)}  ·  primera: ${fmtDate(i.firstSeen)}\n`);
  }
}

function printIssue(i) {
  console.log(`\n${i.id} — ${LABEL[i.status]}`);
  console.log(`Título:     ${i.title}`);
  console.log(`Origen:     ${i.source} (${i.level})${i.code ? `  código: ${i.code}` : ''}`);
  console.log(`Veces:      ${i.count}   Regresiones: ${i.regressions}`);
  console.log(`Primera:    ${fmtDate(i.firstSeen)}   Última: ${fmtDate(i.lastSeen)}`);
  console.log(`\nMensaje:\n  ${i.message}`);
  if (i.stack) console.log(`\nStack:\n${i.stack.split('\n').map(l => '  ' + l).join('\n')}`);
  const last = i.occurrences[i.occurrences.length - 1];
  if (last?.context) console.log(`\nContexto (última vez):\n${JSON.stringify(last.context, null, 2).split('\n').map(l => '  ' + l).join('\n')}`);
  console.log('\nHistorial:');
  for (const h of i.history) {
    console.log(`  ${fmtDate(h.at)}  ${h.action}${h.by ? ` (${h.by})` : ''}${h.commit ? ` [${h.commit}]` : ''}${h.note ? ` — ${h.note}` : ''}`);
  }
  console.log('');
}

function flag(args, name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  args.splice(idx, 2);
  return val;
}

function main() {
  const args = process.argv.slice(2);
  const commit = flag(args, 'commit');
  const by = flag(args, 'by') || 'agente IA';
  const [cmd = 'open', id, ...noteParts] = args;
  const note = noteParts.join(' ');

  switch (cmd) {
    case 'open':
    case 'list':
      return printList(tracker.list({ status: 'open' }), 'Incidencias ABIERTAS');
    case 'all':
      return printList(tracker.list(), 'Todas las incidencias');
    case 'show': {
      const i = tracker.get(id);
      if (!i) throw new Error(`No existe ${id}`);
      return printIssue(i);
    }
    case 'fix':
    case 'ignore':
    case 'reopen': {
      if (!id) throw new Error(`Uso: npm run errors -- ${cmd} ERR-0001 "nota"`);
      if (!note) throw new Error('Añade una nota explicando qué se hizo o por qué (queda en el historial).');
      const status = { fix: 'fixed', ignore: 'ignored', reopen: 'open' }[cmd];
      const i = tracker.setStatus(id, status, note, { by, commit });
      return console.log(`\n${i.id} -> ${LABEL[i.status]}  (${note})\n`);
    }
    case 'logs': {
      const entries = logger.readDay(id || logger.localDate(), 80);
      if (!entries.length) return console.log('\nSin registros para ese día.\n');
      for (const e of entries) {
        console.log(`${new Date(e.ts).toLocaleTimeString('es', { hour12: false })} ${e.level.padEnd(5)} [${e.source}] ${e.message}${e.error ? ` — ${e.error}` : ''}${e.issue ? ` (${e.issue})` : ''}`);
      }
      return;
    }
    default:
      console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0]);
  }
}

try {
  main();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
