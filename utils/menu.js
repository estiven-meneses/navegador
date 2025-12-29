const readline = require('readline');
const { getCountryList, getCountryByIndex } = require('../config/countries');
const { showCurrentUsage } = require('./stats');

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
 * Muestra el menú principal con países y opciones
 * @returns {Promise<{country: Object|null, useProxy: boolean}>}
 */
async function showMainMenu() {
  const rl = createReadline();

  return new Promise((resolve) => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║      🌍 NAVEGADOR - SELECCIONA OPCIÓN      ║');
    console.log('╠════════════════════════════════════════════╣');
    
    const countries = getCountryList();
    
    countries.forEach((country) => {
      const paddedIndex = String(country.index).padStart(2, ' ');
      const paddedName = country.name.padEnd(20, ' ');
      console.log(`║  ${paddedIndex}. ${country.flag}  ${paddedName}        ║`);
    });
    
    console.log('╠════════════════════════════════════════════╣');
    console.log('║  99. ⚡ Sin proxy (navegador normal)        ║');
    console.log('║  88. 📊 Ver consumo del proxy               ║');
    console.log('║   0. ❌ Salir                               ║');
    console.log('╚════════════════════════════════════════════╝');
    
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
      
      if (selection === 88) {
        // Ver consumo detallado y volver al menú
        const { showDetailedUsage } = require('./stats');
        console.log('');
        showCurrentUsage();
        console.log('');
        // Volver a mostrar menú
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
  showMainMenu,
  showCountryInfo
};
