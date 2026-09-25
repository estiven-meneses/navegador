/**
 * Configuración central: variables de entorno, rutas y constantes.
 * Todo módulo que necesite una ruta o un valor global lo toma de aquí.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const ROOT = path.join(__dirname, '..');

const paths = {
  root: ROOT,
  profiles: path.join(ROOT, 'profiles'),        // un directorio por perfil (profile.json + browser-data/)
  legacySessions: path.join(ROOT, 'sessions'),  // formato antiguo, se migra automáticamente
  data: path.join(ROOT, 'data'),
  usageFile: path.join(ROOT, 'data', 'usage.json'),
  logs: path.join(ROOT, 'logs'),
  dailyLogs: path.join(ROOT, 'logs', 'app'),
  errorsFile: path.join(ROOT, 'logs', 'errors.json'),
  public: path.join(ROOT, 'public'),
};

const proxy = {
  host: process.env.PROXY_HOST || 'gw.dataimpulse.com',
  port: Number(process.env.PROXY_PORT || 823),
  // El usuario base nunca lleva parámetros: se limpian por si el .env los trae.
  username: (process.env.PROXY_USERNAME || '').split('__')[0],
  password: process.env.PROXY_PASSWORD || '',
  // Minutos que DataImpulse mantiene la misma IP para un sessid (sticky session).
  sessionTtlMinutes: Number(process.env.PROXY_SESSION_TTL_MIN || 60),
  get configured() { return Boolean(this.username && this.password); },
};

const server = {
  // Solo localhost: la API puede lanzar navegadores y borrar perfiles.
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
};

const browser = {
  defaultStartUrl: process.env.START_URL || 'https://browserleaks.com/ip',
  // Cada cuánto se verifica que la IP de salida siga siendo la misma.
  ipMonitorIntervalMs: 5 * 60 * 1000,
};

module.exports = { paths, proxy, server, browser };
