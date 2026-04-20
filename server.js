const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { launchBrowser, changeProxy, stopBrowser, getStatus } = require('./utils/browserLauncher');
const { getCountryList, getCountryByIndex } = require('./config/countries');

const app = express();
app.use(cors());
app.use(express.json());

// Servir la interfaz gráfica
app.use(express.static(path.join(__dirname, 'public')));

const sessionsPath = path.join(__dirname, 'sessions');

// ========================
// Endpoints API
// ========================

// Obtener la lista de perfiles (carpetas en sessions/)
app.get('/api/profiles', (req, res) => {
  let profiles = [];
  if (fs.existsSync(sessionsPath)) {
    profiles = fs.readdirSync(sessionsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }
  res.json({ profiles });
});

// Crear nuevo perfil
app.post('/api/profiles', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre de perfil es requerido' });

  const profileDir = path.join(sessionsPath, name);
  if (fs.existsSync(profileDir)) {
    return res.status(400).json({ error: 'El perfil ya existe' });
  }

  fs.mkdirSync(profileDir, { recursive: true });
  res.json({ success: true, message: `Perfil ${name} creado` });
});

// Eliminar perfil
app.delete('/api/profiles/:name', (req, res) => {
  const { name } = req.params;
  const profileDir = path.join(sessionsPath, name);
  
  if (!fs.existsSync(profileDir)) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  fs.rmSync(profileDir, { recursive: true, force: true });
  res.json({ success: true, message: `Perfil ${name} eliminado` });
});

// Renombrar perfil
app.put('/api/profiles/:oldName', (req, res) => {
  const { oldName } = req.params;
  const { newName } = req.body;
  
  if (!newName) return res.status(400).json({ error: 'Nuevo nombre requerido' });

  const oldPath = path.join(sessionsPath, oldName);
  const newPath = path.join(sessionsPath, newName);

  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Perfil original no encontrado' });
  if (fs.existsSync(newPath)) return res.status(400).json({ error: 'El nuevo nombre ya existe' });

  fs.renameSync(oldPath, newPath);
  res.json({ success: true, message: `Perfil renombrado a ${newName}` });
});

// Obtener lista de países
app.get('/api/countries', (req, res) => {
  const countries = getCountryList();
  res.json({ countries });
});

// Obtener estado del navegador
app.get('/api/browser/status', (req, res) => {
  res.json(getStatus());
});

// Arrancar navegador con perfil y proxy
app.post('/api/browser/launch', async (req, res) => {
  const { profileName, countryCode, useProxy } = req.body;
  
  if (!profileName) return res.status(400).json({ error: 'Falta perfil' });
  
  const status = getStatus();
  if (status.isRunning) {
    return res.status(400).json({ error: 'Ya hay un navegador abierto. Ciérralo primero.' });
  }

  let selectedCountry = null;
  if (useProxy && countryCode) {
    selectedCountry = getCountryList().find(c => c.code === countryCode);
    if (!selectedCountry) {
      return res.status(400).json({ error: 'Código de país inválido' });
    }
  }

  try {
    await launchBrowser(profileName, selectedCountry, useProxy);
    res.json({ success: true, message: 'Navegador iniciado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al arrancar navegador: ' + err.message });
  }
});

// Cambiar proxy al vuelo
app.post('/api/browser/proxy', async (req, res) => {
  const { countryCode, useProxy } = req.body;
  
  let selectedCountry = null;
  if (useProxy && countryCode) {
    selectedCountry = getCountryList().find(c => c.code === countryCode);
    if (!selectedCountry) {
      return res.status(400).json({ error: 'País no encontrado' });
    }
  }

  try {
    const result = await changeProxy(selectedCountry, useProxy);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detener navegador
app.post('/api/browser/stop', async (req, res) => {
  try {
    const result = await stopBrowser();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error deteniendo navegador' });
  }
});

// Arranque
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor Web UI Iniciado.`);
  console.log(`🌐 Visita: http://localhost:${PORT} en tu navegador`);
});