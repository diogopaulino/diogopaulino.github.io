import { loadGeography, clamp, rad } from './geo.js';
import { create as createRenderer } from './renderer.js';
import { create as createMap } from './map.js';
import { create as createAudio } from './audio.js';
import { config } from './config.js';

const $ = selector => document.querySelector(selector);
const state = { mode: 'aerial', meters: 0, playing: false, look: 0, perspective: 'tourist', renderer: null, geography: null, pendingMode: 0, held: 0, keyHeld: new Set(), paused: false };
let map, audio, toastTimer, dragTimer, lastTime = performance.now(), lastUI = 0;
const dialogs = ['settings', 'about'];
function notify(text, duration = 6500) {
  $('#toast').textContent = text; $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, duration);
}
function openDialog(id) {
  state.keyHeld.clear(); state.held = 0; $(`#${id}`).showModal();
}
function closeDialog(id) { $(`#${id}`).close(); }
function loading(text) { $('#loading-text').textContent = text; $('#loading').hidden = false; }
function ready() { $('#loading').hidden = true; }
function sourceStatus(type) {
  $('#source-badge').textContent = type === 'google' ? 'Google · cidade 3D' : 'Satélite · Esri';
  $('#google-credit').hidden = type !== 'google';
  $('#imagery-note').textContent = type === 'google' ? 'Malha 3D real. Imagens não são ao vivo.' : 'Imagens de satélite reais. Não são ao vivo.';
}
function enter() { $('#app').classList.add('exploring'); }
function resetMovement() { state.playing = false; state.held = 0; state.keyHeld.clear(); $('#walk-play').textContent = '▶'; $('#walk-play').setAttribute('aria-pressed', 'false'); $('#walk-play').setAttribute('aria-label', 'Iniciar caminhada automática'); }
function syncUI() {
  if (!state.geography) return;
  const { route, places } = state.geography;
  $('#progress').value = Math.round(state.meters / route.length * 1000);
  $('#distance').textContent = `${(state.meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} / ${(route.length / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  const nearest = places.filter(p => p.type !== 'PAISAGEM').reduce((a, p) => Math.abs(p.meters - state.meters) < Math.abs(a.meters - state.meters) ? p : a, places[0]);
  $('#location').textContent = state.meters < 120 ? 'José Menino' : state.meters > route.length - 120 ? 'Ponta da Praia · Canal 7' : nearest.name.split(' / ')[0];
  map?.update(state.meters);
}
function renderPlaces() {
  $('#places').replaceChildren();
  const list = state.perspective === 'resident' ? state.geography.places.filter(p => p.resident) : state.geography.places.filter(p => p.type !== 'CANAL');
  list.forEach((p, i) => {
    const button = document.createElement('button'); button.className = 'place-row';
    const number = document.createElement('span'); number.className = 'place-number'; number.textContent = String(i + 1).padStart(2, '0');
    const content = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = p.name;
    const detail = document.createElement('small'); detail.textContent = `${p.type} · ${(p.meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km do início`;
    const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '↗';
    content.append(title, detail); button.append(number, content, arrow);
    button.addEventListener('click', () => selectPlace(p)); $('#places').append(button);
  });
}
function hidePlaces() { $('#places-panel').hidden = true; $('#places-open').setAttribute('aria-expanded', 'false'); }
async function selectPlace(p) {
  enter(); hidePlaces(); resetMovement(); state.meters = p.meters;
  if (state.mode === 'walk' || state.mode === 'drone') await setMode('aerial');
  $('#place-name').textContent = p.name; $('#place-type').textContent = p.type; $('#place-description').textContent = p.description;
  $('#streetview').href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.coordinates[1]},${p.coordinates[0]}`;
  $('#place-detail').hidden = false;
  if (state.mode !== 'map') state.renderer?.goTo(p.coordinates, { height: 550, pitch: -48 });
  syncUI();
}
async function setMode(mode) {
  const request = ++state.pendingMode;
  resetMovement(); state.paused = false;
  ready();
  if (!state.renderer && mode !== 'map') {
    mode = 'map';
    notify('A vista 3D não está disponível. O mapa e os lugares continuam funcionando.');
  }
  if (mode === 'walk') {
    if (!state.renderer?.google) {
      openDialog('settings');
      $('#key-status').textContent = 'A caminhada em escala humana precisa da malha 3D. O satélite funciona nos modos Aérea, Drone e Mapa.';
      return;
    }
    loading('Carregando o chão deste trecho…');
    const covered = await state.renderer.prepareWalk(state.meters);
    if (request !== state.pendingMode) return;
    ready();
    if (!covered) { notify('Não há chão 3D disponível neste trecho. Tente outro ponto ou volte à vista aérea.'); return; }
  }
  state.renderer?.cancelFlight();
  enter(); state.mode = mode; state.look = 0;
  $('#map-view').hidden = mode !== 'map'; $('#globe').hidden = mode === 'map';
  $('#walk-controls').hidden = mode !== 'walk'; $('#drone-pause').hidden = mode !== 'drone';
  $('#drone-pause').textContent = 'Pausar voo'; $('#drone-pause').setAttribute('aria-pressed', 'false');
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  state.renderer?.interaction(mode === 'aerial');
  if (mode === 'aerial') state.renderer?.goTo(state.geography.route.at(state.meters), { height: 1200 });
  if (mode === 'drone' && matchMedia('(prefers-reduced-motion: reduce)').matches) { state.paused = true; $('#drone-pause').textContent = 'Iniciar voo'; $('#drone-pause').setAttribute('aria-pressed', 'true'); }
  if (mode === 'walk' || mode === 'drone') state.renderer?.update(state.meters, mode, 0);
  syncUI();
}
function moveTo(meters) { state.meters = clamp(meters, 0, state.geography.route.length); syncUI(); }
function bind() {
  $('#explore').addEventListener('click', () => { enter(); $('#places-panel').hidden = false; $('#places-open').setAttribute('aria-expanded', 'true'); if (state.renderer) state.renderer.goTo(state.geography.route.at(state.meters), { height: 2000 }); });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#places-open').addEventListener('click', () => { enter(); $('#place-detail').hidden = true; $('#places-panel').hidden = !$('#places-panel').hidden; $('#places-open').setAttribute('aria-expanded', String(!$('#places-panel').hidden)); });
  $('#places-close').addEventListener('click', hidePlaces);
  $('#detail-close').addEventListener('click', () => { $('#place-detail').hidden = true; });
  document.querySelectorAll('[data-perspective]').forEach(b => b.addEventListener('click', () => { state.perspective = b.dataset.perspective; document.querySelectorAll('[data-perspective]').forEach(button => button.setAttribute('aria-pressed', String(button === b))); renderPlaces(); }));
  $('#settings-open').addEventListener('click', () => openDialog('settings'));
  $('#about-open').addEventListener('click', () => openDialog('about'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(b.dataset.close)));
  dialogs.forEach(id => { const dialog = $(`#${id}`); dialog.addEventListener('click', e => { if (e.target === dialog) { const box = dialog.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close(); } }); });
  $('#progress').addEventListener('input', () => {
    enter(); resetMovement(); $('#place-detail').hidden = true;
    moveTo(Number($('#progress').value) / 1000 * state.geography.route.length);
    clearTimeout(dragTimer);
    dragTimer = setTimeout(async () => {
      if (state.mode === 'walk') await setMode('walk');
      else if (state.mode === 'aerial') state.renderer?.goTo(state.geography.route.at(state.meters), { height: 900, duration: .8 });
    }, 200);
  });
  $('#key-form').addEventListener('submit', async e => {
    e.preventDefault(); const key = $('#api-key').value.trim();
    if (!key) { $('#key-status').textContent = 'Informe a chave da Map Tiles API.'; return; }
    if (!state.renderer) { $('#key-status').textContent = 'O motor 3D não carregou. Recarregue a página para tentar novamente.'; return; }
    const button = $('#connect'); button.disabled = true; $('#key-status').textContent = 'Conectando ao Google…';
    try {
      const connected = await state.renderer.connect(key);
      if (connected) { $('#api-key').value = ''; $('#key-status').textContent = ''; closeDialog('settings'); await setMode('aerial'); notify('3D conectado. Os detalhes dependem da cobertura de Santos. Experimente Caminhar.'); }
    } catch { $('#key-status').textContent = 'Não foi possível conectar. Confira a chave, Map Tiles API, faturamento e restrição de domínio.'; }
    finally { button.disabled = false; }
  });
  $('#satellite').addEventListener('click', async () => {
    if (!state.renderer) { closeDialog('settings'); await setMode('map'); return; }
    const button = $('#satellite'); button.disabled = true;
    try { await state.renderer.satellite(); $('#api-key').value = ''; closeDialog('settings'); await setMode('aerial'); } catch { $('#key-status').textContent = 'O satélite não carregou. Tente a vista Mapa.'; } finally { button.disabled = false; }
  });
  $('#sound').addEventListener('click', async () => {
    try { if (!audio) audio = createAudio(); const enabled = await audio.toggle(); $('#sound').setAttribute('aria-pressed', String(enabled)); $('#sound').setAttribute('aria-label', enabled ? 'Desativar som do mar' : 'Ativar som do mar'); $('#sound').textContent = enabled ? '♫' : '♪'; } catch { notify('O áudio não está disponível neste navegador.'); }
  });
  $('#share').addEventListener('click', async () => {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('trecho', Math.round(state.meters)); url.hash = '';
    try {
      if (navigator.share) await navigator.share({ title: 'Santos Orla 3D', url: url.href });
      else { await navigator.clipboard.writeText(url.href); notify('Link do trecho copiado.'); }
    } catch (e) { if (e.name !== 'AbortError') notify('Não foi possível compartilhar neste navegador.'); }
  });
  function hold(button, direction) {
    button.addEventListener('pointerdown', e => { if (state.mode !== 'walk') return; e.preventDefault(); resetMovement(); state.held = direction; button.setPointerCapture(e.pointerId); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => { state.held = 0; });
  }
  hold($('#walk-forward'), 1); hold($('#walk-back'), -1);
  $('#walk-play').addEventListener('click', () => {
    state.playing = !state.playing; $('#walk-play').textContent = state.playing ? 'Ⅱ' : '▶'; $('#walk-play').setAttribute('aria-pressed', String(state.playing)); $('#walk-play').setAttribute('aria-label', state.playing ? 'Pausar caminhada' : 'Iniciar caminhada automática');
  });
  $('#drone-pause').addEventListener('click', () => { state.paused = !state.paused; $('#drone-pause').textContent = state.paused ? 'Continuar voo' : 'Pausar voo'; $('#drone-pause').setAttribute('aria-pressed', String(state.paused)); });
  $('#drone-pause').addEventListener('click', () => { if (!state.paused && state.meters >= state.geography.route.length) moveTo(0); });
  let drag;
  $('#globe').addEventListener('pointerdown', e => {
    if (state.mode !== 'walk' || e.button !== 0) return;
    drag = { x: e.clientX, id: e.pointerId }; $('#globe').setPointerCapture(e.pointerId);
  });
  $('#globe').addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || state.mode !== 'walk') return;
    state.look += (e.clientX - drag.x) * .004; drag.x = e.clientX;
    state.renderer?.update(state.meters, 'walk', state.look);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#globe').addEventListener(event, () => { drag = undefined; });
  document.addEventListener('keydown', e => {
    if (state.mode !== 'walk' || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    if (['w', 's', 'a', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(e.key)) { e.preventDefault(); state.keyHeld.add(e.key); }
  });
  document.addEventListener('keyup', e => state.keyHeld.delete(e.key));
  window.addEventListener('blur', resetMovement);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetMovement(); audio?.update(performance.now() / 1000); });
}
async function weather() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-23.97&longitude=-46.33&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return;
    const data = await r.json(), current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m)) return;
    const words = current.weather_code === 0 ? 'Céu limpo' : current.weather_code < 4 ? 'Nuvens' : current.weather_code < 50 ? 'Neblina' : 'Chuva';
    const age = Date.now() - new Date(`${current.time}-03:00`).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 3 * 3600 * 1000) return;
    $('#weather').textContent = `${Math.round(current.temperature_2m)}° · ${words} · ${current.time.slice(11, 16)}`;
    $('#weather').title = 'Clima modelado por Open-Meteo · horário de Santos';
  } catch { /* Optional context must never block geographic exploration. */ }
}
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, .1); lastTime = time;
  if (state.geography && !document.hidden && $('#loading').hidden && !document.querySelector('dialog[open]') && $('#places-panel').hidden && $('#place-detail').hidden) {
    const k = state.keyHeld;
    let direction = state.held || (k.has('w') || k.has('ArrowUp') ? 1 : k.has('s') || k.has('ArrowDown') ? -1 : state.playing ? 1 : 0);
    const moving = state.mode === 'drone' && !state.paused || state.mode === 'walk' && direction !== 0;
    const looking = state.mode === 'walk' && (k.has('a') || k.has('d') || k.has('ArrowLeft') || k.has('ArrowRight'));
    if (moving || looking) {
      if (state.mode === 'walk') state.look += (k.has('a') || k.has('ArrowLeft') ? -1 : k.has('d') || k.has('ArrowRight') ? 1 : 0) * dt * .8;
      // Pedestrian = 1.4m/s (5 km/h), Shift = 3m/s; drone = 45m/s.
      const previous = state.meters;
      if (moving) state.meters = clamp(state.meters + dt * (state.mode === 'drone' ? 45 : (k.has('Shift') ? 3 : 1.4) * direction), 0, state.geography.route.length);
      const drawn = state.renderer?.update(state.meters, state.mode, state.look);
      if (state.mode === 'walk' && drawn === false) { state.meters = previous; resetMovement(); notify('Este trecho ainda não tem chão 3D carregado. Selecione outro ponto pela barra da orla.'); }
      if (state.meters === state.geography.route.length || state.meters === 0 && direction < 0) {
        resetMovement(); if (state.mode === 'drone') { state.paused = true; $('#drone-pause').textContent = 'Recomeçar voo'; $('#drone-pause').setAttribute('aria-pressed', 'true'); }
      }
      if (time - lastUI > 100) { syncUI(); lastUI = time; }
    }
  }
  audio?.update(time / 1000);
  requestAnimationFrame(frame);
}
async function start() {
  try {
    state.geography = await loadGeography();
    map = createMap({ geography: state.geography, onPlace: selectPlace });
    const initial = Number(new URL(location.href).searchParams.get('trecho'));
    state.meters = Number.isFinite(initial) ? clamp(initial, 0, state.geography.route.length) : 0;
    renderPlaces(); syncUI(); bind();
    // Independent module failure never removes the usable geographic map.
    try {
      state.renderer = await createRenderer({ geography: state.geography, onPlace: selectPlace, onStatus: sourceStatus, onError: text => notify(text) });
      ready();
      if (initial > 0) { enter(); state.renderer.goTo(state.geography.route.at(state.meters)); }
      if (config.googleMapsApiKey) {
        try { await state.renderer.connect(config.googleMapsApiKey); } catch { notify('A cidade 3D não conectou. A vista por satélite continua disponível.'); }
      }
    } catch {
      ready(); $('#source-badge').textContent = 'Mapa · OpenStreetMap';
      await setMode('map'); notify('O motor 3D não carregou. Explore os lugares no mapa ou recarregue para tentar novamente.');
    }
    weather(); requestAnimationFrame(frame);
  } catch {
    ready(); $('#source-badge').textContent = 'Dados indisponíveis';
    $('#explore').disabled = true; $('#explore').textContent = 'Recarregue para tentar novamente';
    document.querySelectorAll('.dock button').forEach(b => { b.disabled = true; });
    notify('Os dados da orla não carregaram. Recarregue a página.', 20000);
  }
}
start();
