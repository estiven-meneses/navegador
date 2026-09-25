/**
 * Ajusta el archivo Preferences de Chromium ANTES de abrir el perfil.
 *
 * - intl.accept_languages: la cabecera Accept-Language sale de aquí, no de --lang.
 *   Si no coincide con navigator.languages (que sí controla --lang), es una
 *   incoherencia detectable. Se reescribe en cada arranque según el país.
 * - spellcheck.dictionaries: mismo idioma que el país del perfil.
 * - exit_type/exited_cleanly: evita la burbuja "Chromium no se cerró correctamente"
 *   si la sesión anterior terminó de golpe.
 */
const fs = require('fs');
const path = require('path');

function preparePreferences(userDataDir, { languages }) {
  const file = path.join(userDataDir, 'Default', 'Preferences');
  let prefs = {};
  try {
    prefs = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  if (languages?.length) {
    prefs.intl = { ...(prefs.intl || {}), accept_languages: languages.join(','), selected_languages: languages.join(',') };
    // El corrector ortográfico sigue al idioma del país (antes quedaba fijo en el del primer uso).
    prefs.spellcheck = { ...(prefs.spellcheck || {}), dictionaries: [languages[0]] };
  } else if (prefs.intl) {
    // Sin proxy: se borra para que Chromium use el idioma del sistema (igual que navigator.language).
    delete prefs.intl.accept_languages;
    delete prefs.intl.selected_languages;
  }
  prefs.profile = { ...(prefs.profile || {}), exit_type: 'Normal', exited_cleanly: true };

  fs.writeFileSync(file, JSON.stringify(prefs));
}

module.exports = { preparePreferences };
