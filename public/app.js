/* Interfaz de StealthBrowser. Sin frameworks: estado en `state`, render por vista. */

const state = {
  profiles: [],
  sessions: [],
  countries: [],
  issues: [],
  errorFilter: 'open',
  busy: new Set(),         // ids de perfil con una acción en curso
  proxyConfigured: true,
};

// ---------- utilidades ----------
const $ = (sel) => document.querySelector(sel);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(url, method = 'GET', body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return {};
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Error del servidor (${res.status})`);
  return data;
}

function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.className = `fixed bottom-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg shadow-2xl text-sm fade ${kind === 'error' ? 'bg-red-900/95 border border-red-700' : 'bg-gray-800 border border-gray-600'}`;
  t.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), kind === 'error' ? 8000 : 3500);
}

function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(3, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / 1024 ** i).toFixed(i ? 2 : 0)} ${u[i]}`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function country(code) {
  return state.countries.find(c => c.code === code);
}

function sessionOf(id) {
  return state.sessions.find(s => s.profileId === id);
}

// ---------- navegación ----------
function showTab() {
  const tab = (location.hash || '#profiles').slice(1);
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${tab}`));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  if (tab === 'errors') loadErrors();
  if (tab === 'usage') loadUsage();
  if (tab === 'logs') loadLogs();
}

// ---------- carga de datos ----------
async function loadAll() {
  const [{ profiles }, { sessions, proxyConfigured }] = await Promise.all([api('/api/profiles'), api('/api/sessions')]);
  state.profiles = profiles;
  state.sessions = sessions;
  state.proxyConfigured = proxyConfigured;
  renderProfiles();
  renderHeader();
}

async function pollSessions() {
  try {
    const { sessions } = await api('/api/sessions');
    const changed = JSON.stringify(sessions.map(s => [s.profileId, s.status, s.exit?.ip, s.ipChanged])) !==
      JSON.stringify(state.sessions.map(s => [s.profileId, s.status, s.exit?.ip, s.ipChanged]));
    state.sessions = sessions;
    if (changed) await loadAll(); else { renderSessionStats(); renderHeader(); }
    const { issues } = await api('/api/errors?status=open');
    const badge = $('#errorsBadge');
    badge.textContent = issues.length;
    badge.classList.toggle('hidden', issues.length === 0);
  } catch {}
}

// ---------- render: cabecera ----------
function renderHeader() {
  const running = state.sessions.length;
  $('#headerInfo').innerHTML = running
    ? `<span class="flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>${running} navegador${running > 1 ? 'es' : ''} abierto${running > 1 ? 's' : ''}</span>`
    : '<span>Ningún navegador abierto</span>';
  const banner = $('#banner');
  if (!state.proxyConfigured) {
    banner.className = 'max-w-6xl mx-auto mb-4 bg-amber-900/40 border border-amber-700 text-amber-200 rounded-lg px-4 py-3 text-xs';
    banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Faltan <code>PROXY_USERNAME</code>/<code>PROXY_PASSWORD</code> en <code>.env</code>: solo funcionarán perfiles sin proxy.';
  } else banner.className = 'hidden';
}

// ---------- render: perfiles ----------
function locationLabel(p) {
  if (!p.proxy?.enabled) return '<span class="text-gray-400"><i class="fa-solid fa-house-signal"></i> Sin proxy (IP real)</span>';
  const c = country(p.proxy.country);
  return `<span>${c ? c.flag : ''} ${esc(c ? c.name : p.proxy.country)}${p.proxy.city ? ` · ${esc(p.proxy.city)}` : ''}</span>`;
}

function renderProfiles() {
  const list = $('#profilesList');
  $('#profilesCount').textContent = `${state.profiles.length} perfil${state.profiles.length === 1 ? '' : 'es'}`;
  if (!state.profiles.length) {
    list.innerHTML = `<div class="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded-xl">
      <i class="fa-solid fa-id-card text-3xl mb-3"></i><p>Aún no tienes perfiles.</p>
      <button data-action="new-profile" class="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2">Crear el primero</button></div>`;
    return;
  }
  list.innerHTML = state.profiles.map(p => {
    const s = sessionOf(p.id);
    const busy = state.busy.has(p.id);
    const running = Boolean(s);
    const status = busy ? '<span class="text-indigo-300"><i class="fa-solid fa-spinner fa-spin"></i> Trabajando…</span>'
      : running ? (s.status === 'starting' ? '<span class="text-indigo-300"><i class="fa-solid fa-spinner fa-spin"></i> Abriendo…</span>' : '<span class="text-green-400"><i class="fa-solid fa-circle text-[8px]"></i> Abierto</span>')
      : '<span class="text-gray-500"><i class="fa-regular fa-circle text-[8px]"></i> Cerrado</span>';
    const exit = s?.exit || p.lastExit;
    return `
    <div class="bg-gray-800 border ${running ? 'border-green-700/60' : 'border-gray-700'} rounded-xl p-4 fade" data-id="${esc(p.id)}">
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex-1 min-w-[200px]">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-base text-white">${esc(p.name)}</span>
            ${p.needsSetup ? '<span class="text-[10px] bg-amber-600/30 text-amber-300 border border-amber-700 rounded px-1.5 py-0.5">Confirma la ubicación</span>' : ''}
          </div>
          <div class="text-gray-300 mt-1">${locationLabel(p)}</div>
          ${p.notes ? `<div class="text-gray-500 text-xs mt-1">${esc(p.notes)}</div>` : ''}
        </div>
        <div class="text-xs text-gray-400 min-w-[190px] space-y-0.5">
          <div>${status}</div>
          <div data-stat="ip">${exit ? `IP ${esc(exit.ip)} · ${esc(exit.city || '')}` : 'IP aún no verificada'}${s ? '' : exit ? ' <span class="text-gray-600">(última)</span>' : ''}</div>
          <div data-stat="tz">${s?.fingerprint ? `${esc(s.fingerprint.timezone)} · ${esc(s.fingerprint.locale)}` : `Huella #${esc(p.fingerprint.seed)}`}</div>
          <div data-stat="bytes">${s ? `Tráfico: ${fmtBytes(s.bytes)}` : `Último uso: ${fmtDate(p.lastLaunchedAt)}`}</div>
          ${s?.ipChanged ? '<div class="text-amber-400"><i class="fa-solid fa-triangle-exclamation"></i> La IP cambió o falló: usa “Nueva IP”</div>' : ''}
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          ${running
            ? `<button data-action="stop" ${busy ? 'disabled' : ''} class="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5"><i class="fa-solid fa-stop"></i> Cerrar</button>`
            : `<button data-action="launch" ${busy ? 'disabled' : ''} class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5"><i class="fa-solid fa-play"></i> Abrir</button>`}
          ${p.proxy?.enabled ? `<button data-action="new-ip" ${busy ? 'disabled' : ''} title="Pedir otra IP de la misma ubicación" class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg px-3 py-1.5"><i class="fa-solid fa-rotate"></i> Nueva IP</button>` : ''}
          <button data-action="edit" class="text-gray-400 hover:text-indigo-400 px-2" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button data-action="delete" class="text-gray-400 hover:text-red-500 px-2" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderSessionStats() {
  for (const s of state.sessions) {
    const card = document.querySelector(`[data-id="${CSS.escape(s.profileId)}"] [data-stat="bytes"]`);
    if (card) card.textContent = `Tráfico: ${fmtBytes(s.bytes)}`;
  }
}

// ---------- acciones de perfil ----------
async function withBusy(id, fn) {
  state.busy.add(id);
  renderProfiles();
  try { await fn(); } catch (err) { toast(err.message, 'error'); } finally {
    state.busy.delete(id);
    await loadAll();
  }
}

const profileActions = {
  launch: (p) => withBusy(p.id, async () => {
    if (p.needsSetup) { openProfileModal(p); throw new Error('Primero confirma la ubicación del proxy de este perfil y guarda.'); }
    const { session } = await api(`/api/profiles/${p.id}/launch`, 'POST');
    toast(session.exit ? `Abierto con IP ${session.exit.ip} (${session.exit.city}, ${session.exit.country})` : 'Abierto sin proxy');
  }),
  stop: (p) => withBusy(p.id, () => api(`/api/profiles/${p.id}/stop`, 'POST')),
  'new-ip': (p) => withBusy(p.id, async () => {
    if (sessionOf(p.id)) {
      const { session } = await api(`/api/profiles/${p.id}/relaunch`, 'POST', { rotate: true });
      toast(`Reiniciado con nueva IP ${session.exit?.ip} (${session.exit?.city})`);
    } else {
      await api(`/api/profiles/${p.id}/rotate-ip`, 'POST');
      toast('Se usará una IP nueva la próxima vez que abras el perfil');
    }
  }),
  edit: (p) => openProfileModal(p),
  delete: (p) => confirmDialog({
    title: 'Eliminar perfil',
    text: `Se borrarán para siempre las cookies, sesiones iniciadas e historial de “${p.name}”.`,
    ok: 'Sí, eliminar',
    run: async () => { await api(`/api/profiles/${p.id}`, 'DELETE'); toast('Perfil eliminado'); await loadAll(); },
  }),
};

// ---------- modal de perfil ----------
function fillCountrySelect(selected) {
  const sel = $('#profileForm [name=country]');
  sel.innerHTML = state.countries.map(c => `<option value="${c.code}" ${c.code === selected ? 'selected' : ''}>${c.flag} ${esc(c.name)}</option>`).join('');
  fillCities();
}

function fillCities() {
  const c = country($('#profileForm [name=country]').value);
  $('#cityOptions').innerHTML = (c?.cities || []).map(x => `<option value="${esc(x)}">`).join('');
}

// Aviso si se cambia el país de un perfil que ya tiene historial en otra ubicación.
function updateLocationWarning() {
  const f = $('#profileForm');
  const p = state.profiles.find(x => x.id === f.elements.profileId.value);
  const used = p && (p.lastLaunchedAt || p.needsSetup);
  const was = p?.proxy?.enabled ? p.proxy.country : null;
  const now = f.elements.proxyEnabled.checked ? f.elements.country.value : null;
  $('#locationWarning').classList.toggle('hidden', !(used && was !== now) && !(p?.needsSetup && now));
}

function toggleProxyFields() {
  $('#proxyFields').classList.toggle('opacity-40', !$('#profileForm [name=proxyEnabled]').checked);
}

function openProfileModal(p = null) {
  const f = $('#profileForm');
  f.reset();
  $('#profileFormError').classList.add('hidden');
  $('#profileModalTitle').textContent = p ? `Editar “${p.name}”` : 'Nuevo perfil';
  f.elements.profileId.value = p?.id || '';
  f.elements.name.value = p?.name || '';
  f.elements.proxyEnabled.checked = p ? Boolean(p.proxy?.enabled) : true;
  fillCountrySelect(p?.proxy?.country || 'sv');
  f.elements.city.value = p?.proxy?.city || '';
  f.elements.locale.value = p?.locale || '';
  f.elements.startUrl.value = p?.startUrl || '';
  f.elements.notes.value = p?.notes || '';
  $('#fingerprintBox').classList.toggle('hidden', !p);
  if (p) $('#fpSeed').textContent = `#${p.fingerprint.seed}`;
  $('#profileSubmit').textContent = p && sessionOf(p.id) ? 'Guardar y reiniciar' : 'Guardar';
  toggleProxyFields();
  updateLocationWarning();
  $('#profileModal').classList.remove('hidden');
  setTimeout(() => f.elements.name.focus(), 50);
}

async function submitProfile(e) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.elements.name.value.trim(),
    notes: f.elements.notes.value.trim(),
    locale: f.elements.locale.value.trim() || null,
    startUrl: f.elements.startUrl.value.trim() || null,
    proxy: { enabled: f.elements.proxyEnabled.checked, country: f.elements.country.value, city: f.elements.city.value.trim() || null },
  };
  const id = f.elements.profileId.value;
  try {
    if (id) {
      const { running } = await api(`/api/profiles/${id}`, 'PUT', body);
      closeModals();
      if (running) {
        await withBusy(id, async () => {
          const { session } = await api(`/api/profiles/${id}/relaunch`, 'POST');
          toast(`Reiniciado en ${session.exit ? `${session.exit.city}, ${session.exit.country}` : 'modo sin proxy'}`);
        });
      } else toast('Perfil guardado');
    } else {
      await api('/api/profiles', 'POST', body);
      closeModals();
      toast('Perfil creado');
    }
    await loadAll();
  } catch (err) {
    const el = $('#profileFormError');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
}

// ---------- confirmación ----------
function confirmDialog({ title, text, ok = 'Confirmar', needNote = false, run }) {
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  const note = $('#confirmNote');
  note.value = '';
  note.classList.toggle('hidden', !needNote);
  const btn = $('#confirmOk');
  btn.textContent = ok;
  btn.onclick = async () => {
    if (needNote && !note.value.trim()) { note.focus(); return; }
    try { await run(note.value.trim()); closeModals(); } catch (err) { toast(err.message, 'error'); }
  };
  $('#confirmModal').classList.remove('hidden');
  if (needNote) setTimeout(() => note.focus(), 50);
}

function closeModals() {
  $('#profileModal').classList.add('hidden');
  $('#confirmModal').classList.add('hidden');
}

// ---------- errores ----------
const STATUS_UI = {
  open: ['Abierto', 'bg-red-600/20 text-red-300 border-red-700'],
  fixed: ['Resuelto', 'bg-green-600/20 text-green-300 border-green-700'],
  ignored: ['Ignorado', 'bg-gray-600/20 text-gray-300 border-gray-600'],
};

async function loadErrors() {
  document.querySelectorAll('#errorFilters button').forEach(b => b.classList.toggle('bg-gray-700', b.dataset.filter === state.errorFilter));
  const { issues } = await api(`/api/errors${state.errorFilter ? `?status=${state.errorFilter}` : ''}`);
  state.issues = issues;
  const list = $('#errorsList');
  if (!issues.length) {
    list.innerHTML = `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-xl"><i class="fa-solid fa-circle-check text-2xl text-green-500 mb-2"></i><p>Nada en esta lista.</p></div>`;
    return;
  }
  list.innerHTML = issues.map(i => {
    const [label, cls] = STATUS_UI[i.status];
    const last = i.occurrences[i.occurrences.length - 1];
    return `
    <details class="bg-gray-800 border border-gray-700 rounded-xl fade" data-issue="${esc(i.id)}">
      <summary class="cursor-pointer p-4 flex flex-wrap items-center gap-3">
        <code class="text-gray-500 text-xs">${esc(i.id)}</code>
        <span class="text-[10px] border rounded px-1.5 py-0.5 ${cls}">${label}</span>
        <span class="text-[10px] text-gray-400 border border-gray-600 rounded px-1.5 py-0.5">${esc(i.source)}${i.level === 'warn' ? ' · aviso' : ''}</span>
        <span class="flex-1 min-w-[200px] text-gray-100">${esc(i.title)}</span>
        ${i.regressions ? `<span class="text-amber-400 text-xs" title="Volvió después de marcarse como resuelto"><i class="fa-solid fa-rotate-left"></i> ${i.regressions}</span>` : ''}
        <span class="text-gray-400 text-xs">×${i.count} · ${fmtDate(i.lastSeen)}</span>
      </summary>
      <div class="px-4 pb-4 text-xs space-y-3">
        <div><div class="text-gray-500 mb-1">Mensaje</div><pre class="bg-gray-950 rounded p-2 text-gray-300">${esc(i.message)}</pre></div>
        ${i.stack ? `<div><div class="text-gray-500 mb-1">Stack</div><pre class="bg-gray-950 rounded p-2 text-gray-400 max-h-48 overflow-y-auto">${esc(i.stack)}</pre></div>` : ''}
        ${last?.context ? `<div><div class="text-gray-500 mb-1">Contexto (última vez)</div><pre class="bg-gray-950 rounded p-2 text-gray-400 max-h-48 overflow-y-auto">${esc(JSON.stringify(last.context, null, 2))}</pre></div>` : ''}
        <div><div class="text-gray-500 mb-1">Historial</div>
          <ul class="space-y-1">${i.history.map(h => `<li><span class="text-gray-500">${fmtDate(h.at)}</span> <b>${esc(h.action)}</b>${h.by ? ` <span class="text-gray-500">(${esc(h.by)})</span>` : ''}${h.note ? ` — ${esc(h.note)}` : ''}</li>`).join('')}</ul>
        </div>
        <div class="flex gap-2 pt-1">
          ${i.status !== 'fixed' ? '<button data-issue-action="fixed" class="bg-green-700 hover:bg-green-600 rounded px-3 py-1">Marcar resuelto</button>' : ''}
          ${i.status !== 'ignored' ? '<button data-issue-action="ignored" class="bg-gray-700 hover:bg-gray-600 rounded px-3 py-1">Ignorar</button>' : ''}
          ${i.status !== 'open' ? '<button data-issue-action="open" class="bg-red-800 hover:bg-red-700 rounded px-3 py-1">Reabrir</button>' : ''}
        </div>
      </div>
    </details>`;
  }).join('');
}

function issueAction(id, status) {
  const titles = { fixed: 'Marcar como resuelto', ignored: 'Ignorar incidencia', open: 'Reabrir incidencia' };
  confirmDialog({
    title: `${titles[status]} (${id})`,
    text: status === 'fixed' ? '¿Qué se hizo para arreglarlo? Queda en el historial.' : 'Explica el motivo; queda en el historial.',
    ok: 'Guardar', needNote: true,
    run: async (note) => { await api(`/api/errors/${id}`, 'PATCH', { status, note }); await loadErrors(); pollSessions(); },
  });
}

// ---------- consumo ----------
async function loadUsage() {
  const u = await api('/api/usage');
  const used = u.consumedBytes + u.liveBytes;
  const pct = u.balanceBytes ? Math.min(100, (used / u.balanceBytes) * 100) : 0;
  const remaining = Math.max(0, u.balanceBytes - used);
  const color = pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-orange-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
  const byProfile = Object.entries(u.byProfile || {}).sort((a, b) => b[1] - a[1]).map(([id, bytes]) => {
    const p = state.profiles.find(x => x.id === id);
    return `<tr class="border-t border-gray-700"><td class="py-2">${esc(p ? p.name : `${id} (eliminado)`)}</td><td class="py-2 text-right">${fmtBytes(bytes)}</td></tr>`;
  }).join('');
  $('#usagePanel').innerHTML = `
    <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-4">
      <div class="flex flex-wrap justify-between gap-4 mb-3">
        <div><div class="text-gray-400 text-xs">Consumido (estimado)</div><div class="text-2xl font-bold">${fmtBytes(used)}</div></div>
        <div><div class="text-gray-400 text-xs">Restante</div><div class="text-2xl font-bold">${fmtBytes(remaining)}</div></div>
        <div><div class="text-gray-400 text-xs">Saldo sincronizado</div><div class="text-2xl font-bold">${u.balanceGB} GB</div></div>
      </div>
      <div class="h-3 bg-gray-900 rounded-full overflow-hidden"><div class="${color} h-full" style="width:${pct.toFixed(1)}%"></div></div>
      <p class="text-xs text-gray-500 mt-3">Se mide el tráfico real que pasa por el proxy. Última sincronización: ${fmtDate(u.lastSync)} · Sesiones: ${u.totalSessions}${u.liveBytes ? ` · En vivo: ${fmtBytes(u.liveBytes)}` : ''}</p>
    </div>
    <form id="balanceForm" class="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-4 flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs text-gray-400 mb-1">Sincronizar con el saldo real del <a class="text-indigo-400 underline" href="https://app.dataimpulse.com" target="_blank" rel="noopener">panel de DataImpulse</a> (GB)</label>
        <input name="balanceGB" type="number" step="0.01" min="0" required class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2" placeholder="Ej: 2.35">
      </div>
      <button class="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2">Sincronizar</button>
    </form>
    ${byProfile ? `<div class="bg-gray-800 border border-gray-700 rounded-xl p-6"><h3 class="font-semibold mb-2">Por perfil (desde la versión 2)</h3><table class="w-full text-sm">${byProfile}</table></div>` : ''}`;
}

// ---------- registro ----------
async function loadLogs(date) {
  const { days, entries, date: d } = await api(`/api/logs${date ? `?date=${date}` : ''}`);
  const sel = $('#logDay');
  sel.innerHTML = (days.length ? days : [d]).map(x => `<option ${x === d ? 'selected' : ''}>${x}</option>`).join('');
  const color = { error: 'text-red-400', warn: 'text-amber-300', info: 'text-gray-300', debug: 'text-gray-500' };
  $('#logsList').innerHTML = entries.length
    ? entries.slice().reverse().map(e => `<div class="${color[e.level] || ''}"><span class="text-gray-500">${esc(new Date(e.ts).toLocaleTimeString('es'))}</span> ${esc(e.level.toUpperCase().padEnd(5))} [${esc(e.source)}] ${esc(e.message)}${e.error ? ` — ${esc(e.error)}` : ''}${e.issue ? ` <span class="text-indigo-300">${esc(e.issue)}</span>` : ''}</div>`).join('')
    : '<div class="text-gray-500">Sin registros este día.</div>';
}

// ---------- eventos ----------
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'new-profile') return openProfileModal();
    if (action === 'close-modal') return closeModals();
    if (action === 'regen-fingerprint') {
      const id = $("#profileForm").elements.profileId.value;
      return confirmDialog({
        title: 'Generar otra huella',
        text: 'Los sitios verán este perfil como un equipo nuevo. Úsalo solo si una cuenta quedó marcada.',
        ok: 'Generar',
        run: async () => {
          const { profile } = await api(`/api/profiles/${id}/fingerprint`, 'POST');
          $('#fpSeed').textContent = `#${profile.fingerprint.seed}`;
          toast('Huella nueva generada');
          await loadAll();
        },
      });
    }
    const card = actionEl.closest('[data-id]');
    const profile = card && state.profiles.find(p => p.id === card.dataset.id);
    if (profile && profileActions[action]) return profileActions[action](profile);
  }
  const issueBtn = e.target.closest('[data-issue-action]');
  if (issueBtn) return issueAction(issueBtn.closest('[data-issue]').dataset.issue, issueBtn.dataset.issueAction);
  const filterBtn = e.target.closest('[data-filter]');
  if (filterBtn) { state.errorFilter = filterBtn.dataset.filter; loadErrors(); }
});

document.addEventListener('submit', async (e) => {
  if (e.target.getAttribute("id") === "profileForm") return submitProfile(e);
  if (e.target.getAttribute("id") === "balanceForm") {
    e.preventDefault();
    try { await api('/api/usage/balance', 'POST', { balanceGB: e.target.balanceGB.value }); toast('Saldo sincronizado'); loadUsage(); }
    catch (err) { toast(err.message, 'error'); }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.name === 'country') { fillCities(); updateLocationWarning(); }
  if (e.target.name === 'proxyEnabled') { toggleProxyFields(); updateLocationWarning(); }
  if (e.target.id === 'logDay') loadLogs(e.target.value);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
window.addEventListener('hashchange', showTab);

(async () => {
  try {
    state.countries = (await api('/api/countries')).countries;
    await loadAll();
  } catch (err) {
    $('#profilesList').innerHTML = `<div class="text-red-400 text-center py-8">No se pudo conectar con el servidor: ${esc(err.message)}</div>`;
  }
  showTab();
  pollSessions();
  setInterval(pollSessions, 3000);
})();
