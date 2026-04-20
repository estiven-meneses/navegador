document.addEventListener('DOMContentLoaded', async () => {
  await fetchCountries();
  await fetchProfiles();
  checkBrowserStatus();
  setInterval(checkBrowserStatus, 3000); // Poll status every 3s
});

let countriesList = [];

async function api(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server Error');
  return data;
}

// ------------------------
// UI Navigation
// ------------------------
function switchTab(tabId, el) {
  // Ocultar todas las vistas
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('block');
  });
  // Mostrar la seleccionada
  document.getElementById(`view-${tabId}`).classList.remove('hidden');
  document.getElementById(`view-${tabId}`).classList.add('block');
  
  // Actualizar clases de los links del nav
  document.querySelectorAll('.tab-link').forEach(link => {
    link.classList.remove('bg-gray-800', 'text-indigo-400');
    link.classList.add('text-gray-400');
  });
  if (el) {
    el.classList.add('bg-gray-800', 'text-indigo-400');
    el.classList.remove('text-gray-400');
  }
}

// ------------------------
// Fetch Data
// ------------------------
async function fetchProfiles() {
  try {
    const { profiles } = await api('/api/profiles');
    renderProfiles(profiles);
  } catch (err) {
    console.error('Error fetching profiles:', err);
    document.getElementById('profilesTableBody').innerHTML = 
      `<tr><td colspan="3" class="text-red-400 text-center py-4"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Error: ${err.message}</td></tr>`;
  }
}

async function fetchCountries() {
  try {
    const { countries } = await api('/api/countries');
    countriesList = countries;
    renderCountryOptions();
  } catch (err) {}
}

async function checkBrowserStatus() {
  try {
    const data = await api('/api/browser/status');
    updateStatusBar(data);
  } catch (err) {}
}

// ------------------------
// Renderers
// ------------------------
function renderProfiles(profiles) {
  const tbody = document.getElementById('profilesTableBody');
  if (profiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-gray-500 font-medium">No tienes perfiles. ¡Crea uno para empezar!</td></tr>`;
    return;
  }

  tbody.innerHTML = profiles.map(p => `
    <tr class="hover:bg-gray-800/50 transition duration-200">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
          <div class="h-10 w-10 flex-shrink-0 bg-indigo-900/40 text-indigo-400 border border-indigo-700 flex items-center justify-center rounded-lg shadow-inner mr-4">
            <i class="fa-regular fa-folder-open text-lg"></i>
          </div>
          <div class="text-sm font-semibold text-gray-100">${escapeHtml(p)}</div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
        <span class="bg-gray-900 px-2 py-1 rounded inline-flex items-center">
          <i class="fa-solid fa-clock-rotate-left mr-1.5 opacity-50"></i> 
          Reciente
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-center space-x-2">
        <!-- Proxy Select -->
        <select id="sel_proxy_${escapeHtml(p)}" class="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 max-w-[150px] inline-block mr-2 cursor-pointer shadow-inner">
          <option value="none">🌎 Directo (Sin Proxy)</option>
          ${countriesList.map(c => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}
        </select>

        <!-- Launch btn -->
        <button onclick="startBrowser('${escapeHtml(p)}')" class="inline-flex items-center text-sm bg-green-600/20 text-green-400 border border-green-500/50 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded transition-all mr-3 shadow font-medium">
          <i class="fa-solid fa-play mr-2"></i> Start
        </button>

        <!-- Actions -->
        <button onclick="showRenameModal('${escapeHtml(p)}')" class="text-gray-500 hover:text-indigo-400 transition" title="Renombrar"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="showDeleteModal('${escapeHtml(p)}')" class="text-gray-500 hover:text-red-500 transition ml-2" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderCountryOptions() {
  const qSelect = document.getElementById('quickProxySelect');
  qSelect.innerHTML = `<option value="none">🌎 Directo</option>` +
    countriesList.map(c => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('');
}

function updateStatusBar(status) {
  const sb = document.getElementById('statusBar');
  const spProfile = document.getElementById('statusProfile');
  const spProxy = document.getElementById('statusProxy');
  const qSelect = document.getElementById('quickProxySelect');
  
  if (status.isRunning) {
    sb.classList.remove('hidden');
    spProfile.innerText = status.currentProfile;
    if (status.isProxyActive && status.activeCountry) {
      spProxy.innerText = `${status.activeCountry.flag} ${status.activeCountry.name}`;
      qSelect.value = status.activeCountry.code;
    } else {
      spProxy.innerText = 'Director (Sin Proxy)';
      qSelect.value = 'none';
    }
  } else {
    sb.classList.add('hidden');
  }
}

// ------------------------
// Browser Actions
// ------------------------
async function startBrowser(profileName) {
  try {
    const proxyVal = document.getElementById(`sel_proxy_${profileName}`).value;
    const useProxy = proxyVal !== 'none';
    
    // UI Feedback
    const btn = event.currentTarget;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Arrancando...`;
    btn.disabled = true;

    await api('/api/browser/launch', 'POST', {
      profileName,
      countryCode: useProxy ? proxyVal : null,
      useProxy
    });
    
    await checkBrowserStatus();
    
    btn.innerHTML = oldHtml;
    btn.disabled = false;
  } catch (err) {
    alert(err.message);
    const btns = document.querySelectorAll('button');
    btns.forEach(b => { if(b.innerHTML.includes('Arrancando')) { b.innerHTML = `<i class="fa-solid fa-play mr-2"></i> Start`; b.disabled=false; }});
  }
}

async function stopBrowser() {
  try {
    await api('/api/browser/stop', 'POST');
    await checkBrowserStatus();
  } catch (err) { alert(err.message); }
}

async function changeActiveProxy() {
  try {
    const proxyVal = document.getElementById('quickProxySelect').value;
    const useProxy = proxyVal !== 'none';
    
    await api('/api/browser/proxy', 'POST', {
      countryCode: useProxy ? proxyVal : null,
      useProxy
    });
    await checkBrowserStatus();
  } catch (err) { alert(err.message); }
}

// ------------------------
// Modals & Profile Management
// ------------------------
function showCreateModal() { 
  document.getElementById('createModal').classList.remove('hidden');
  setTimeout(()=> document.getElementById('newProfileName').focus(), 50);
}

function showRenameModal(oldName) {
  document.getElementById('renameOldName').value = oldName;
  document.getElementById('renameNewName').value = oldName;
  document.getElementById('renameModal').classList.remove('hidden');
  setTimeout(()=> document.getElementById('renameNewName').focus(), 50);
}

function showDeleteModal(name) {
  document.getElementById('deleteProfileName').value = name;
  document.getElementById('deleteProfileNameDisplay').innerText = name;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeModals() {
  ['createModal', 'renameModal', 'deleteModal'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('newProfileName').value = '';
}

async function createProfile() {
  const name = document.getElementById('newProfileName').value.trim();
  if(!name) return;
  try {
    await api('/api/profiles', 'POST', { name });
    closeModals();
    fetchProfiles();
  } catch (err) { alert(err.message); }
}

async function submitRenameProfile() {
  const oldName = document.getElementById('renameOldName').value;
  const newName = document.getElementById('renameNewName').value.trim();
  if (!newName || newName === oldName) { closeModals(); return; }
  
  try {
    await api(`/api/profiles/${oldName}`, 'PUT', { newName });
    closeModals();
    fetchProfiles();
  } catch (err) { alert(err.message); }
}

async function submitDeleteProfile() {
  const name = document.getElementById('deleteProfileName').value;
  try {
    await api(`/api/profiles/${name}`, 'DELETE');
    closeModals();
    fetchProfiles();
  } catch (err) { alert(err.message); }
}

function escapeHtml(unsafe) {
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}
