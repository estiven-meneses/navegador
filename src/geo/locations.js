/**
 * Países y ciudades disponibles para el proxy.
 *
 * `locale` es el idioma que usará el navegador en ese país (navigator.language,
 * cabecera Accept-Language). `timezone` y coordenadas son SOLO respaldo: en el
 * arranque se usan los datos reales de la IP de salida (ver proxy/ipCheck.js).
 *
 * Las ciudades se envían a DataImpulse como slug: minúsculas, sin tildes ni espacios
 * ("San Salvador" -> "sansalvador"). La ciudad cuesta el doble en DataImpulse.
 * Se puede escribir cualquier ciudad; esta lista solo sugiere las más comunes.
 */

const countries = {
  sv: { name: 'El Salvador', flag: '🇸🇻', locale: 'es-SV', timezone: 'America/El_Salvador', geo: [13.6929, -89.2182], cities: ['San Salvador', 'Santa Ana', 'San Miguel', 'Soyapango'] },
  co: { name: 'Colombia', flag: '🇨🇴', locale: 'es-CO', timezone: 'America/Bogota', geo: [4.711, -74.0721], cities: ['Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira'] },
  mx: { name: 'México', flag: '🇲🇽', locale: 'es-MX', timezone: 'America/Mexico_City', geo: [19.4326, -99.1332], cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Cancun'] },
  gt: { name: 'Guatemala', flag: '🇬🇹', locale: 'es-GT', timezone: 'America/Guatemala', geo: [14.6349, -90.5069], cities: ['Guatemala City'] },
  hn: { name: 'Honduras', flag: '🇭🇳', locale: 'es-HN', timezone: 'America/Tegucigalpa', geo: [14.0723, -87.1921], cities: ['Tegucigalpa', 'San Pedro Sula'] },
  cr: { name: 'Costa Rica', flag: '🇨🇷', locale: 'es-CR', timezone: 'America/Costa_Rica', geo: [9.9281, -84.0907], cities: ['San Jose'] },
  pa: { name: 'Panamá', flag: '🇵🇦', locale: 'es-PA', timezone: 'America/Panama', geo: [8.9824, -79.5199], cities: ['Panama City'] },
  do: { name: 'República Dominicana', flag: '🇩🇴', locale: 'es-DO', timezone: 'America/Santo_Domingo', geo: [18.4861, -69.9312], cities: ['Santo Domingo', 'Santiago'] },
  ec: { name: 'Ecuador', flag: '🇪🇨', locale: 'es-EC', timezone: 'America/Guayaquil', geo: [-0.1807, -78.4678], cities: ['Quito', 'Guayaquil'] },
  pe: { name: 'Perú', flag: '🇵🇪', locale: 'es-PE', timezone: 'America/Lima', geo: [-12.0464, -77.0428], cities: ['Lima', 'Arequipa'] },
  cl: { name: 'Chile', flag: '🇨🇱', locale: 'es-CL', timezone: 'America/Santiago', geo: [-33.4489, -70.6693], cities: ['Santiago'] },
  ar: { name: 'Argentina', flag: '🇦🇷', locale: 'es-AR', timezone: 'America/Argentina/Buenos_Aires', geo: [-34.6037, -58.3816], cities: ['Buenos Aires', 'Cordoba', 'Rosario'] },
  br: { name: 'Brasil', flag: '🇧🇷', locale: 'pt-BR', timezone: 'America/Sao_Paulo', geo: [-23.5505, -46.6333], cities: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia'] },
  us: { name: 'Estados Unidos', flag: '🇺🇸', locale: 'en-US', timezone: 'America/New_York', geo: [40.7128, -74.006], cities: ['New York', 'Miami', 'Los Angeles', 'Chicago', 'Houston', 'Dallas', 'Phoenix', 'Seattle', 'Atlanta', 'San Francisco'] },
  ca: { name: 'Canadá', flag: '🇨🇦', locale: 'en-CA', timezone: 'America/Toronto', geo: [43.6532, -79.3832], cities: ['Toronto', 'Montreal', 'Vancouver'] },
  es: { name: 'España', flag: '🇪🇸', locale: 'es-ES', timezone: 'Europe/Madrid', geo: [40.4168, -3.7038], cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'] },
  gb: { name: 'Reino Unido', flag: '🇬🇧', locale: 'en-GB', timezone: 'Europe/London', geo: [51.5074, -0.1278], cities: ['London', 'Manchester', 'Birmingham'] },
  de: { name: 'Alemania', flag: '🇩🇪', locale: 'de-DE', timezone: 'Europe/Berlin', geo: [52.52, 13.405], cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'] },
  fr: { name: 'Francia', flag: '🇫🇷', locale: 'fr-FR', timezone: 'Europe/Paris', geo: [48.8566, 2.3522], cities: ['Paris', 'Lyon', 'Marseille'] },
  it: { name: 'Italia', flag: '🇮🇹', locale: 'it-IT', timezone: 'Europe/Rome', geo: [41.9028, 12.4964], cities: ['Rome', 'Milan'] },
  tr: { name: 'Turquía', flag: '🇹🇷', locale: 'tr-TR', timezone: 'Europe/Istanbul', geo: [41.0082, 28.9784], cities: ['Istanbul', 'Ankara'] },
  ng: { name: 'Nigeria', flag: '🇳🇬', locale: 'en-NG', timezone: 'Africa/Lagos', geo: [6.5244, 3.3792], cities: ['Lagos', 'Abuja'] },
  in: { name: 'India', flag: '🇮🇳', locale: 'en-IN', timezone: 'Asia/Kolkata', geo: [28.6139, 77.209], cities: ['New Delhi', 'Mumbai', 'Bangalore'] },
  au: { name: 'Australia', flag: '🇦🇺', locale: 'en-AU', timezone: 'Australia/Sydney', geo: [-33.8688, 151.2093], cities: ['Sydney', 'Melbourne', 'Brisbane'] },
};

/** "San Salvador" -> "sansalvador" (formato de ciudad de DataImpulse). */
function citySlug(city) {
  return String(city || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getCountry(code) {
  if (!code) return null;
  const c = countries[String(code).toLowerCase()];
  return c ? { code: String(code).toLowerCase(), ...c } : null;
}

function listCountries() {
  return Object.entries(countries).map(([code, c]) => ({
    code, name: c.name, flag: c.flag, locale: c.locale, cities: c.cities,
  }));
}

module.exports = { countries, getCountry, listCountries, citySlug };
