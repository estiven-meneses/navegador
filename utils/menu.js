const readline = require('readline');
const { getCountryList, getCountryByIndex } = require('../config/countries');

/**
 * Muestra el menú de selección de país y espera la respuesta del usuario
 * @returns {Promise<Object>} Configuración del país seleccionado
 */
async function showCountryMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     🌍 SELECCIONA TU PAÍS DE CONEXIÓN      ║');
    console.log('╠════════════════════════════════════════════╣');
    
    const countries = getCountryList();
    
    countries.forEach((country) => {
      const paddedIndex = String(country.index).padStart(2, ' ');
      const paddedName = country.name.padEnd(20, ' ');
      console.log(`║  ${paddedIndex}. ${country.flag}  ${paddedName}        ║`);
    });
    
    console.log('╠════════════════════════════════════════════╣');
    console.log('║   0. ❌ Salir                               ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    rl.question('👉 Ingresa el número del país: ', (answer) => {
      rl.close();
      
      const selection = parseInt(answer, 10);
      
      if (selection === 0) {
        console.log('👋 ¡Hasta luego!');
        process.exit(0);
      }
      
      const selectedCountry = getCountryByIndex(selection);
      
      if (!selectedCountry) {
        console.log('❌ Selección inválida. Usando El Salvador por defecto.');
        resolve(getCountryByIndex(1)); // El Salvador es el primero
      } else {
        console.log(`✅ Conectando desde: ${selectedCountry.flag} ${selectedCountry.name}`);
        resolve(selectedCountry);
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
  showCountryMenu,
  showCountryInfo
};

