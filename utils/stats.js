/**
 * Módulo de estadísticas de consumo del proxy
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Archivo para persistir el consumo
const USAGE_FILE = path.join(__dirname, '..', 'data', 'usage.json');

// URL del dashboard de DataImpulse
const DASHBOARD_URL = 'https://app.dataimpulse.com/products/725379';

class ProxyStats {
  constructor() {
    this.requests = 0;
    this.responses = 0;
    this.bytesReceived = 0;
    this.bytesSent = 0;
    this.startTime = null;
    this.domains = new Set();
    
    // Cargar datos guardados
    this.data = this.loadData();
  }

  /**
   * Carga los datos desde archivo
   * @returns {Object} Datos guardados
   */
  loadData() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const data = fs.readFileSync(USAGE_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('⚠️ No se pudo cargar datos, iniciando nuevo.');
    }
    
    return {
      balanceGB: 5, // Balance inicial por defecto (5GB)
      consumedBytes: 0,
      totalSessions: 0,
      lastSync: null,
      lastSession: null
    };
  }

  /**
   * Guarda los datos en archivo
   */
  saveData() {
    const sessionBytes = this.bytesReceived + this.bytesSent;
    
    this.data.consumedBytes += sessionBytes;
    this.data.totalSessions += 1;
    this.data.lastSession = new Date().toISOString();
    
    try {
      const dir = path.dirname(USAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.log('⚠️ No se pudo guardar datos.');
    }
  }

  /**
   * Sincroniza el balance con el valor del dashboard
   * @param {number} balanceGB - Balance actual en GB desde el dashboard
   */
  syncBalance(balanceGB) {
    this.data.balanceGB = balanceGB;
    this.data.consumedBytes = 0; // Resetear consumo local
    this.data.lastSync = new Date().toISOString();
    
    try {
      const dir = path.dirname(USAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.data, null, 2));
      console.log(`✅ Balance sincronizado: ${balanceGB} GB`);
    } catch (error) {
      console.log('⚠️ No se pudo guardar.');
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
   * Formatea bytes a unidad legible
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formatea duración
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
   * Genera barra de progreso
   */
  generateProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Obtiene el balance restante estimado
   */
  getRemainingGB() {
    const balanceBytes = this.data.balanceGB * 1024 * 1024 * 1024;
    const remaining = balanceBytes - this.data.consumedBytes;
    return Math.max(0, remaining / (1024 * 1024 * 1024));
  }

  /**
   * Muestra las estadísticas
   */
  showStats() {
    this.saveData();
    
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    const sessionBytes = this.bytesReceived + this.bytesSent;
    const balanceBytes = this.data.balanceGB * 1024 * 1024 * 1024;
    const remainingBytes = balanceBytes - this.data.consumedBytes;
    const usedPercentage = Math.min(100, (this.data.consumedBytes / balanceBytes) * 100);
    const remainingPercentage = 100 - usedPercentage;
    
    let statusEmoji = '🟢';
    if (remainingPercentage < 50) statusEmoji = '🟡';
    if (remainingPercentage < 20) statusEmoji = '🟠';
    if (remainingPercentage < 5) statusEmoji = '🔴';
    
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
    console.log('║              💾 BALANCE DEL PROXY (estimado)             ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  📊 Balance inicial:  ${(this.data.balanceGB + ' GB').padEnd(30)}║`);
    console.log(`║  📈 Consumido:        ${this.formatBytes(this.data.consumedBytes).padEnd(30)}║`);
    console.log(`║  ${statusEmoji} Restante:         ~${this.getRemainingGB().toFixed(2)} GB`.padEnd(59) + '║');
    console.log(`║  [${this.generateProgressBar(remainingPercentage, 30)}] ${remainingPercentage.toFixed(1)}%`.padEnd(58) + '║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  💡 Para ver el balance REAL, visita el dashboard:       ║');
    console.log('║     https://app.dataimpulse.com/products/725379          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
    if (remainingPercentage < 20) {
      console.log('');
      console.log('⚠️  ¡ATENCIÓN! Tu balance está bajo. Verifica en el dashboard.');
    }
  }
}

/**
 * Configura el rastreo de estadísticas
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
 * Muestra el consumo actual rápido
 */
function showCurrentUsage() {
  const stats = new ProxyStats();
  const remaining = stats.getRemainingGB();
  const balanceGB = stats.data.balanceGB;
  const percentage = (remaining / balanceGB) * 100;
  
  let emoji = '🟢';
  if (percentage < 50) emoji = '🟡';
  if (percentage < 20) emoji = '🟠';
  if (percentage < 5) emoji = '🔴';
  
  console.log('');
  console.log(`${emoji} Balance: ~${remaining.toFixed(2)} GB restante de ${balanceGB} GB (${percentage.toFixed(1)}%)`);
  
  if (stats.data.lastSync) {
    const syncDate = new Date(stats.data.lastSync).toLocaleDateString('es');
    console.log(`📅 Última sincronización: ${syncDate}`);
  } else {
    console.log('⚠️  Balance no sincronizado. Usa opción 77 para sincronizar.');
  }
}

/**
 * Obtiene la URL del dashboard
 */
function getDashboardUrl() {
  return DASHBOARD_URL;
}

module.exports = {
  ProxyStats,
  setupStatsTracking,
  showCurrentUsage,
  getDashboardUrl
};
