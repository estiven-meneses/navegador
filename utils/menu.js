const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { getCountryList, getCountryByIndex } = require('../config/countries');
const { showCurrentUsage, ProxyStats, getDashboardUrl } = require('./stats');

/**
 * Crea una instancia de readline
 */
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Pregunta el nombre del perfil al usuario para guardar sus sesiones
 */
async function askProfileName() {
  const rl = createReadline();
  const sessionsPath = path.join(__dirname, '..', 'sessions');
  
  let existingProfiles = [];
  if (fs.existsSync(sessionsPath)) {
    existingProfiles = fs.readdirSync(sessionsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  return new Promise((resolve) => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           🗂️  CARGAR O CREAR PERFIL (SESIÓN)            ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    
    if (existingProfiles.length > 0) {
      console.log('║ Perfiles existentes:                                   ║');
      existingProfiles.forEach((p, i) => {
        console.log(`║  ${i + 1}. ${p.padEnd(50)} ║`);
      });
      console.log('╠════════════════════════════════════════════════════════╣');
      console.log('║ Ingresa el NÚMERO del perfil existente                 ║');
      console.log('║ O escribe un NOMBRE NUEVO para crear uno nuevo.        ║');
    } else {
      console.log('║ No hay perfiles guardados.                             ║');
      console.log('║ Ingresa un NOMBRE NUEVO para crear uno ahora.          ║');
    }
    
    console.log('╚════════════════════════════════════════════════════════╝');
    
    rl.question('👉 Número o Nombre (ej: principal): ', (answer) => {
      rl.close();
      const input = answer.trim();
      
      if (!input) {
        resolve('default_profile');
        return;
      }
      
      // Checar si ingresó número
      const num = parseInt(input, 10);
      if (!isNaN(num) && num > 0 && num <= existingProfiles.length) {
        resolve(existingProfiles[num - 1]);
      } else {
        // Tratarlo como nombre nuevo
        resolve(input);
      }
    });
  });
}

/**
 * Sincroniza el balance preguntando al usuario
 */
async function syncBalance() {
  const rl = createReadline();
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           🔄 SINCRONIZAR BALANCE DEL PROXY             ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  1. Abre tu dashboard de DataImpulse                   ║');
  console.log('║  2. Mira el valor de "Tráfico restante"                ║');
  console.log('║  3. Ingresa ese valor aquí                             ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 ${getDashboardUrl()}         ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  
  return new Promise((resolve) => {
    rl.question('👉 ¿Cuántos GB te quedan según el dashboard? (ej: 4.88): ', (answer) => {
      rl.close();
      
      const balance = parseFloat(answer);
      
      if (isNaN(balance) || balance < 0) {
        console.log('❌ Valor inválido. No se sincronizó.');
        resolve(false);
        return;
      }
      
      const stats = new ProxyStats();
      stats.syncBalance(balance);
      resolve(true);
    });
  });
}

/**
 * Muestra el menú principal con países y opciones
 * @returns {Promise<{country: Object|null, useProxy: boolean}>}
 */
async function showMainMenu() {
  const rl = createReadline();

  return new Promise((resolve) => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║          🌍 NAVEGADOR - SELECCIONA OPCIÓN              ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    
    const countries = getCountryList();
    
    countries.forEach((country) => {
      const paddedIndex = String(country.index).padStart(2, ' ');
      const paddedName = country.name.padEnd(22, ' ');
      console.log(`║   ${paddedIndex}. ${country.flag}  ${paddedName}                ║`);
    });
    
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║   99. ⚡ Sin proxy (navegador normal)                   ║');
    console.log('║   77. 🔄 Sincronizar balance desde dashboard            ║');
    console.log('║    0. ❌ Salir                                          ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    // Mostrar consumo rápido
    showCurrentUsage();
    
    console.log('');

    rl.question('👉 Ingresa el número: ', async (answer) => {
      rl.close();
      
      const selection = parseInt(answer, 10);
      
      if (selection === 0) {
        console.log('👋 ¡Hasta luego!');
        process.exit(0);
      }
      
      if (selection === 77) {
        await syncBalance();
        // Volver al menú
        resolve(await showMainMenu());
        return;
      }
      
      if (selection === 99) {
        console.log('⚡ Navegador normal - Sin proxy');
        resolve({ country: null, useProxy: false });
        return;
      }
      
      const selectedCountry = getCountryByIndex(selection);
      
      if (!selectedCountry) {
        console.log('❌ Selección inválida. Usando El Salvador por defecto.');
        resolve({ country: getCountryByIndex(1), useProxy: true });
      } else {
        console.log(`✅ Conectando desde: ${selectedCountry.flag} ${selectedCountry.name}`);
        resolve({ country: selectedCountry, useProxy: true });
      }
    });
  });
}

/**
 * Muestra información del país seleccionado
 * @param {Object} country - Configuración del país
 */
function showCountryInfo(country) {
  console.log('');
  console.log('┌────────────────────────────────────────────┐');
  console.log(`│ ${country.flag} ${country.name.padEnd(38)}│`);
  console.log('├────────────────────────────────────────────┤');
  console.log(`│ 📍 Lat: ${country.geo.latitude}, Lon: ${country.geo.longitude}`.padEnd(45) + '│');
  console.log(`│ 🕐 Timezone: ${country.timezone}`.padEnd(45) + '│');
  console.log(`│ 🌐 Locale: ${country.locale}`.padEnd(45) + '│');
  console.log('└────────────────────────────────────────────┘');
}

module.exports = {
  askProfileName,
  showMainMenu,
  showCountryInfo,
  syncBalance
};
