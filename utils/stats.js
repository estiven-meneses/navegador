/**
 * Módulo de estadísticas de consumo del proxy
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Archivo para persistir el consumo
const USAGE_FILE = path.join(__dirname, '..', 'data', 'usage.json');

// Límite contratado en bytes (desde .env, default 1GB)
const LIMIT_GB = parseFloat(process.env.PROXY_LIMIT_GB) || 1;
const LIMIT_BYTES = LIMIT_GB * 1024 * 1024 * 1024;

class ProxyStats {
  constructor() {
    this.requests = 0;
    this.responses = 0;
    this.bytesReceived = 0;
    this.bytesSent = 0;
    this.startTime = null;
    this.domains = new Set();
    
    // Cargar consumo histórico
    this.historicalUsage = this.loadUsage();
  }

  /**
   * Carga el consumo histórico desde archivo
   * @returns {Object} Datos de uso histórico
   */
  loadUsage() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const data = fs.readFileSync(USAGE_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('⚠️ No se pudo cargar historial de uso, iniciando nuevo.');
    }
    
    return {
      totalBytes: 0,
      totalSessions: 0,
      firstSession: null,
      lastSession: null
    };
  }

  /**
   * Guarda el consumo en archivo
   */
  saveUsage() {
    const sessionBytes = this.bytesReceived + this.bytesSent;
    
    this.historicalUsage.totalBytes += sessionBytes;
    this.historicalUsage.totalSessions += 1;
    this.historicalUsage.lastSession = new Date().toISOString();
    
    if (!this.historicalUsage.firstSession) {
      this.historicalUsage.firstSession = new Date().toISOString();
    }
    
    try {
      // Crear directorio si no existe
      const dir = path.dirname(USAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.historicalUsage, null, 2));
    } catch (error) {
      console.log('⚠️ No se pudo guardar historial de uso.');
    }
  }

  /**
   * Inicia el rastreo de estadísticas
   */
  start() {
    this.startTime = Date.now();
    console.log('📊 Rastreo de estadísticas iniciado.');
  }

  /**
   * Registra una solicitud saliente
   * @param {Request} request - Objeto request de Playwright
   */
  trackRequest(request) {
    this.requests++;
    
    const postData = request.postData();
    if (postData) {
      this.bytesSent += postData.length;
    }
    this.bytesSent += 500;
    
    try {
      const url = new URL(request.url());
      this.domains.add(url.hostname);
    } catch (e) {}
  }

  /**
   * Registra una respuesta recibida
   * @param {Response} response - Objeto response de Playwright
   */
  trackResponse(response) {
    this.responses++;
    
    const headers = response.headers();
    const contentLength = headers['content-length'];
    
    if (contentLength) {
      this.bytesReceived += parseInt(contentLength, 10);
    } else {
      this.bytesReceived += 1024;
    }
  }

  /**
   * Formatea bytes a una unidad legible
   * @param {number} bytes - Cantidad de bytes
   * @returns {string} Formato legible (KB, MB, GB)
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formatea duración en formato legible
   * @param {number} ms - Milisegundos
   * @returns {string} Formato mm:ss
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Genera una barra de progreso visual
   * @param {number} percentage - Porcentaje (0-100)
   * @param {number} width - Ancho de la barra
   * @returns {string} Barra visual
   */
  generateProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return filledChar.repeat(filled) + emptyChar.repeat(empty);
  }

  /**
   * Muestra las estadísticas en consola
   */
  showStats() {
    // Guardar uso antes de mostrar
    this.saveUsage();
    
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    const sessionBytes = this.bytesReceived + this.bytesSent;
    const totalUsed = this.historicalUsage.totalBytes;
    const remaining = Math.max(0, LIMIT_BYTES - totalUsed);
    const percentage = Math.min(100, (totalUsed / LIMIT_BYTES) * 100);
    
    // Color de la barra según porcentaje
    let statusEmoji = '🟢';
    if (percentage > 50) statusEmoji = '🟡';
    if (percentage > 80) statusEmoji = '🟠';
    if (percentage > 95) statusEmoji = '🔴';
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              📊 ESTADÍSTICAS DE LA SESIÓN                ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  ⏱️  Duración:         ${this.formatDuration(duration).padEnd(30)}║`);
    console.log(`║  📤 Enviado:          ${this.formatBytes(this.bytesSent).padEnd(30)}║`);
    console.log(`║  📥 Recibido:         ${this.formatBytes(this.bytesReceived).padEnd(30)}║`);
    console.log(`║  📦 Esta sesión:      ${this.formatBytes(sessionBytes).padEnd(30)}║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  🔢 Solicitudes:      ${String(this.requests).padEnd(30)}║`);
    console.log(`║  ✅ Respuestas:       ${String(this.responses).padEnd(30)}║`);
    console.log(`║  🌐 Dominios:         ${String(this.domains.size).padEnd(30)}║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║                   💾 CONSUMO TOTAL                       ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  📊 Plan contratado:  ${this.formatBytes(LIMIT_BYTES).padEnd(30)}║`);
    console.log(`║  📈 Total usado:      ${this.formatBytes(totalUsed).padEnd(30)}║`);
    console.log(`║  📉 Restante:         ${this.formatBytes(remaining).padEnd(30)}║`);
    console.log(`║  ${statusEmoji} Porcentaje:        ${percentage.toFixed(2)}%`.padEnd(59) + '║');
    console.log(`║  [${this.generateProgressBar(percentage, 30)}] ${percentage.toFixed(1)}%`.padEnd(58) + '║');
    console.log(`║  📅 Sesiones totales: ${String(this.historicalUsage.totalSessions).padEnd(30)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    
    // Advertencia si queda poco
    if (percentage > 80) {
      console.log('');
      console.log('⚠️  ¡ATENCIÓN! Has usado más del 80% de tu plan.');
    }
    if (percentage > 95) {
      console.log('🚨 ¡CRÍTICO! Tu plan está casi agotado.');
    }
  }
}

/**
 * Configura el rastreo de estadísticas en el contexto
 * @param {BrowserContext} context - Contexto de Playwright
 * @param {ProxyStats} stats - Instancia de ProxyStats
 */
function setupStatsTracking(context, stats) {
  context.on('request', (request) => {
    stats.trackRequest(request);
  });

  context.on('response', (response) => {
    stats.trackResponse(response);
  });
}

/**
 * Muestra el consumo actual sin iniciar sesión
 */
function showCurrentUsage() {
  const stats = new ProxyStats();
  const totalUsed = stats.historicalUsage.totalBytes;
  const remaining = Math.max(0, LIMIT_BYTES - totalUsed);
  const percentage = Math.min(100, (totalUsed / LIMIT_BYTES) * 100);
  
  console.log('');
  console.log(`📊 Consumo actual: ${stats.formatBytes(totalUsed)} / ${stats.formatBytes(LIMIT_BYTES)} (${percentage.toFixed(2)}%)`);
  console.log(`📉 Restante: ${stats.formatBytes(remaining)}`);
}

module.exports = {
  ProxyStats,
  setupStatsTracking,
  showCurrentUsage
};
