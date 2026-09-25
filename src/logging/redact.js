/**
 * Elimina secretos (credenciales del proxy) de cualquier texto u objeto
 * antes de escribirlo en logs. Todo lo que va a disco pasa por aquí.
 */
const config = require('../config');

function secrets() {
  return [config.proxy.password, config.proxy.username].filter(s => s && s.length >= 4);
}

function redactString(str) {
  if (typeof str !== 'string') return str;
  let out = str.replace(/(\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1***:***@'); // user:pass@ en URLs
  for (const s of secrets()) out = out.split(s).join('***');
  return out;
}

function redact(value, depth = 0) {
  if (depth > 6) return '[profundidad máxima]';
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = /password|passwd|secret|token|authorization/i.test(k) ? '***' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = { redact, redactString };
