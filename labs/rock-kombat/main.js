// ==========================================================================
// Rock Kombat — Main Game Loop & State Orchestrator
// Fixed 60Hz deterministic step with MvC Hyper freezes, MK FINISH HIM
// match-point dizzy phase, and zero-GC event pipeline.
//
// Regras (resumo para quem lê o código):
// - Luta melhor de 3: quem vencer 2 rounds leva a partida (finishMatch).
// - Round: 99 s (99 × 60 passos). Vida chega a 0 → K.O.; no fim do tempo vence
//   quem tem mais vida; vida igual = empate (ninguém pontua, novo round).
//   Depois de 2 empates na mesma luta, o próximo empate vai para o jogador
//   ("DECISÃO DOS JUÍZES"), então a luta sempre termina.
// - Match point: o golpe que zeraria a vida deixa o rival tonto com 1 de vida
//   (FINALIZE!) por 210 passos; se ninguém acertar, ele cai sozinho.
// - Barra de energia: 300 = 3 barras. EX/Especial = 1 barra, Hyper = 2,
//   Repelir = 0,4. Começa com 1 barra (Fighter.reset).
// - Controles: A/D andar, W pular, S agachar, J soco, K chute, I forte,
//   H lançar, U agarrar, Espaço especial, P hyper, Shift dash, Esc pausa.
//   Toque: direcional à esquerda e botões à direita (input.js bindTouch).
// - Dificuldade (AI_CONFIG): Fácil é o padrão — CPU lenta, 70% de dano, sem Hyper.
// - Loop: passo fixo de 60 Hz; delta limitado a 50 ms e no máximo 3 passos por
//   quadro, então um quadro longo nunca "teleporta" a física. Para em aba oculta.
// ==========================================================================

import { STEP, FIGHTERS, STAGES, GROUND, GRAVITY, LEFT_WALL, RIGHT_WALL, AI_CONFIG, DEFAULT_DIFFICULTY } from './constants.js?v=23';
import { $, $$, approach, clamp } from './utils.js';
import { InputBuffer, bindKeyboard, bindTouch } from './input.js';
import audio from './audio.js';
import { Fighter } from './fighter.js';
import { resolveCombat, bodyPush, updateProjectiles, updateEffects, addDust } from './combat.js';
import { updateCpu } from './ai.js?v=23';
import { initRenderer, render } from './renderer.js';
import { updateHud, announce, showCombo, showCallout, showScreen, renderRoster, fillVersus, resetCallouts } from './ui.js';

let match = null;
let paused = false;
let selected = null;
let selectedCpu = null;
let stageId = 'seattle';

function readStored(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// New players start on Fácil (kid-friendly); a stored choice is respected.
let difficulty = readStored('rk-difficulty', DEFAULT_DIFFICULTY);
if (!Object.hasOwn(AI_CONFIG, difficulty)) difficulty = DEFAULT_DIFFICULTY;
const DIFFICULTY_HINTS = {
  easy: 'Ótimo para começar: o rival é mais lento e bate mais fraco.',
  normal: 'Desafio equilibrado: o rival defende e faz combos.',
  hard: 'Para quem já domina: o rival quase não erra.'
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = $('#game');
// Cached HUD nodes touched every fixed step (no querySelector inside the loop).
const roundHud = $('.round-hud');
const timerEl = $('#timer');
const fightTip = $('#fight-tip');
// Round-1 tip ("chegue perto e aperte J K I") stays until the player lands a hit or ~7 s pass.
const TIP_FRAMES = 7 * 60;
const images = new Map();
const assetRequests = new Map();
let loadingMatch = false;
let frameNumber = 0;
let controlFrame = 0;
let lastTime = performance.now();
let accumulator = 0;
let vsTimer = 0;
let rosterApi = null;

const playerInput = new InputBuffer();
const cpuInput = new InputBuffer();
const { ctx, renderState } = initRenderer(canvas, () => {
  if (paused && match) render(ctx, match, frameNumber, images, renderState, 1, 0);
});

function arenaActive() {
  return Boolean(match) && $('#arena-screen').classList.contains('is-active');
}

function helpOpen() {
  return $('#help-dialog').open;
}

function refreshFightButton() {
  $('#fight-button').disabled = !(selected && selectedCpu) || loadingMatch;
  $('#quick-fight-button').disabled = loadingMatch;
}

function loadImage(path) {
  if (!assetRequests.has(path)) {
    const image = new Image();
    image.src = path;
    const request = image.decode().then(() => images.set(path, image)).catch(error => {
      assetRequests.delete(path);
      throw error;
    });
    assetRequests.set(path, request);
  }
  return assetRequests.get(path);
}

function snapshotFighters() {
  // Runs every fixed step: no temporary arrays.
  match.p1.prevX = match.p1.x;
  match.p1.prevY = match.p1.y;
  match.p2.prevX = match.p2.x;
  match.p2.prevY = match.p2.y;
}

function startRound() {
  match.timerFrames = 99 * 60;
  match.phase = 'intro';
  match.phaseFrame = match.round === 1 ? 92 : 75;
  match.projectiles.length = 0;
  match.effects.length = 0;
  match.rings.length = 0;
  match.damageNumbers.length = 0;
  match.events.length = 0;
  match.cpuThink = 22;
  match.cpuComboMove = null;
  match.cpuHold = [];
  match.hitStop = 0;
  match.freeze = 0;
  match.shake = 0;
  match.roundWinner = null;
  match.koSlow = 0;
  match.koZoom = 0;
  match.superFlash = 0;
  match.hyperFinish = false;
  match.stageFinisher = '';
  match.firstHitDone = false;
  match.finishHimShown = false;
  match.finishTimer = 0;

  match.p1.x = 385;
  match.p2.x = 1215;
  match.p1.y = GROUND;
  match.p2.y = GROUND;
  match.p1.facing = 1;
  match.p2.facing = -1;
  match.p1.state = 'walk';
  match.p2.state = 'walk';

  snapshotFighters();
  playerInput.clear();
  cpuInput.clear();
  renderState.camX = 800;
  renderState.camY = 360;
  renderState.camZoom = 1.02;

  resetCallouts();
  roundHud.classList.remove('is-finish');
  $('#round-label').textContent = `ROUND ${match.round}`;
  timerEl.textContent = '99';
  match.tipFrames = match.round === 1 ? TIP_FRAMES : 0;
  fightTip.classList.remove('show');
  updateHud(match);
  announce(`ROUND ${match.round}`, 720);
}

function koLabel() {
  const p1Dead = match.p1.health <= 0;
  const p2Dead = match.p2.health <= 0;
  if (p1Dead && p2Dead) return 'DOUBLE K.O.!';
  if (match.hyperFinish) return 'HYPER K.O.!!';
  if ((p1Dead && match.p2.health === 100) || (p2Dead && match.p1.health === 100)) return 'VITÓRIA PERFEITA';
  if (match.timerFrames <= 0) return 'TEMPO ESGOTADO';
  return 'K.O.!';
}

function beginKo() {
  if (match.phase !== 'fight') return;
  match.phase = 'ko';
  match.koSlow = match.hyperFinish ? 64 : 52;
  match.shake = Math.max(match.shake, match.hyperFinish ? 16 : 11);
  audio.sfx('ko');
  announce(match.stageFinisher || koLabel(), 1150);
}

function endRound() {
  if (match.phase !== 'fight' && match.phase !== 'ko') return;
  match.phase = 'roundEnd';
  match.phaseFrame = 104;

  const decided = match.p1.health === match.p2.health && (match.draws || 0) >= 2;
  if (decided) {
    // Desempate: evita rounds sem fim (inclusive duplo K.O.) quando a luta empata de novo.
    if (match.p1.health > 0) match.p2.health = match.p1.health - 1;
    else match.p1.health = 1;
    announce('DECISÃO DOS JUÍZES', 1000);
  }
  if (match.p1.health === match.p2.health) {
    match.draws = (match.draws || 0) + 1;
    match.roundWinner = null;
    match.p1.move = null;
    match.p2.move = null;
    match.phaseFrame = 96;
    if (match.timerFrames <= 0) announce('TEMPO ESGOTADO', 1000);
    else if (match.p1.health > 0) announce('EMPATE', 1000);
  } else {
    const winner = match.p1.health > match.p2.health ? match.p1 : match.p2;
    const loser = winner === match.p1 ? match.p2 : match.p1;
    match.roundWinner = winner;
    winner.wins++;
    winner.state = 'victory';
    winner.move = null;
    loser.move = null;
    loser.state = 'knockdown';
    loser.y = GROUND;
    winner.y = GROUND;
    loser.knockdown = 90;
    if (!decided && match.timerFrames <= 0 && winner.health > 0) announce('TEMPO ESGOTADO', 1000);
  }

  updateHud(match);
}

function finishRound() {
  if (match.roundWinner && match.roundWinner.wins >= 2) {
    finishMatch(match.roundWinner);
    return;
  }
  match.round++;
  match.p1.reset(560, true);
  match.p2.reset(1040, true);
  startRound();
}

function finishMatch(winner) {
  match.phase = 'complete';
  audio.stopMusic();
  audio.sfx('win');
  fightTip.classList.remove('show');
  const playerWon = winner === match.p1;
  const figure = $('#result-figure');
  figure.style.setProperty('--sheet', `url("${winner.data.sheet}")`);
  figure.style.setProperty('--winner', winner.data.color);
  $('#results-screen').classList.toggle('is-loss', !playerWon);
  // Kid-friendly result copy: clear "you won / try again" plus one simple tip on a loss.
  $('#result-title').innerHTML = playerWon ? 'VOCÊ <em>VENCEU!</em>' : `${winner.data.short} <em>VENCEU</em>`;
  $('#result-copy').textContent = playerWon
    ? winner.data.quote
    : difficulty === 'easy'
      ? 'Quase! Chegue bem perto e bata sem parar. Para se defender, segure para longe do rival.'
      : 'Quase! Dica: no modo Fácil o rival é mais lento e bate mais fraco.';
  $('#result-score').textContent = `${match.p1.data.short} ${match.p1.wins} × ${match.p2.wins} ${match.p2.data.short}`;
  $('#result-overline').textContent = playerWon
    ? match.stageFinisher || (match.hyperFinish ? 'HYPER K.O.' : 'VITÓRIA')
    : 'NÃO FOI DESSA VEZ';
  stopLoop();
  showScreen('results-screen', '#rematch-button');
}

function startMatch() {
  if (!selected || !selectedCpu
    || ![selected.sheet, selectedCpu.sheet, STAGES[stageId].image].every(path => images.has(path))) return;
  clearTimeout(vsTimer);
  playerInput.clear();
  cpuInput.clear();

  const p1 = new Fighter(selected, playerInput, false);
  const p2 = new Fighter(selectedCpu, cpuInput, true);

  match = {
    p1, p2,
    round: 1,
    timerFrames: 99 * 60,
    phase: 'intro',
    phaseFrame: 0,
    hitStop: 0,
    freeze: 0,
    shake: 0,
    superFlash: 0,
    hyperColor: '#ff4733',
    hyperFinish: false,
    firstHitDone: false,
    finishHimShown: false,
    finishTimer: 0,
    koSlow: 0,
    koZoom: 0,
    effects: [],
    rings: [],
    projectiles: [],
    damageNumbers: [],
    events: [],
    cpuThink: 24,
    cpuHold: [],
    stage: STAGES[stageId],
    stageId,
    cpuDamage: AI_CONFIG[difficulty].damage ?? 1,
    tipFrames: 0,
    roundWinner: null,
    reducedMotion: reducedMotion.matches
  };

  match.p1.setMatch(match);
  match.p2.setMatch(match);
  lastTime = performance.now();
  accumulator = 0;
  startLoop();
  paused = false;
  $('#pause-layer').close();
  showScreen('arena-screen', '#game');
  audio.startMusic(stageId);
  startRound();
  // The versus timer can fire while "Comandos" is open or the tab is hidden:
  // start paused instead of fighting (and playing music) behind the dialog.
  if (helpOpen() || document.hidden) togglePause(true);
}

async function beginVersus() {
  if (!selected || !selectedCpu || loadingMatch) return;
  loadingMatch = true;
  refreshFightButton();
  audio.ensure();
  fillVersus(selected, selectedCpu, STAGES[stageId]);
  const action = $('#versus-start');
  const status = $('#versus-status');
  status.textContent = '';
  action.disabled = true;
  action.textContent = 'CARREGANDO ARENA';
  $('#versus-back').hidden = true;
  showScreen('versus-screen', '#versus-title');

  try {
    await Promise.all([selected.sheet, selectedCpu.sheet, STAGES[stageId].image].map(loadImage));
    action.disabled = false;
    action.textContent = 'IR PARA A ARENA';
    action.focus({ preventScroll: true });
    audio.sfx('round');
    vsTimer = setTimeout(startMatch, 1500);
  } catch {
    action.disabled = false;
    status.textContent = 'A arena não carregou.';
    action.textContent = 'TENTAR DE NOVO';
    $('#versus-back').hidden = false;
    action.focus({ preventScroll: true });
  } finally {
    loadingMatch = false;
    refreshFightButton();
  }
}

function skipVersus() {
  if (!$('#versus-screen').classList.contains('is-active')) return;
  if (loadingMatch) return;
  if (!$('#versus-back').hidden) {
    beginVersus();
    return;
  }
  startMatch();
}

function flushEvents() {
  for (let i = 0; i < match.events.length; i++) {
    const event = match.events[i];
    if (event.type === 'announce') announce(event.text, event.duration);
    else if (event.type === 'combo') showCombo(event.fighter, match);
    else if (event.type === 'callout') showCallout(event.fighter, match, event.text, event.color);
    else if (event.type === 'dust') addDust(match, event.x, event.y);
  }
  match.events.length = 0;
}

function updateIntro() {
  match.p1.x = approach(match.p1.x, 560, 6.2);
  match.p2.x = approach(match.p2.x, 1040, 6.2);
  match.p1.facing = 1;
  match.p2.facing = -1;
  match.p1.state = Math.abs(match.p1.x - 560) < 2 ? 'idle' : 'walk';
  match.p2.state = Math.abs(match.p2.x - 1040) < 2 ? 'idle' : 'walk';
  match.p1.stateFrame++;
  match.p2.stateFrame++;
  match.p1.walkCycle += 0.26;
  match.p2.walkCycle += 0.26;
}

function updateKoPhysics() {
  koFighter(match.p1);
  koFighter(match.p2);
}

function koFighter(fighter) {
  fighter.stateFrame++;
  if (fighter.health <= 0) {
    fighter.x = clamp(fighter.x + fighter.vx, LEFT_WALL, RIGHT_WALL);
    fighter.vx *= 0.9;
  }
  if (!fighter.grounded() || fighter.vy) {
    fighter.y += fighter.vy;
    fighter.vy += GRAVITY;
    if (fighter.y >= GROUND) {
      fighter.y = GROUND;
      fighter.vy = 0;
      if (fighter.health <= 0) fighter.state = 'knockdown';
    }
  }
}

function fixedUpdate() {
  if (!match || paused) return;
  frameNumber++;
  snapshotFighters();

  if (match.freeze > 0) {
    match.freeze--;
    updateEffects(match);
    flushEvents();
    return;
  }

  if (match.hitStop > 0) {
    match.hitStop--;
    updateEffects(match);
    flushEvents();
    return;
  }

  controlFrame++;
  playerInput.updateFrame(controlFrame);
  cpuInput.updateFrame(controlFrame);

  if (match.phase === 'intro') {
    updateIntro();
    if (--match.phaseFrame === 34) {
      announce('LUTEM!', 650);
      audio.sfx('round');
    }
    if (match.phaseFrame <= 0) {
      match.phase = 'fight';
      match.p1.state = 'idle';
      match.p2.state = 'idle';
    }
    updateEffects(match);
    return;
  }

  if (match.phase === 'ko') {
    if (match.koSlow <= 28 || match.koSlow % 2 === 0) updateKoPhysics();
    if (--match.koSlow <= 0) endRound();
    updateEffects(match);
    return;
  }

  if (match.phase === 'roundEnd') {
    match.p1.stateFrame++;
    match.p2.stateFrame++;
    if (--match.phaseFrame <= 0) finishRound();
    updateEffects(match);
    return;
  }

  if (match.phase !== 'fight') return;

  // FINISH HIM timer decay: if attacker doesn't finish dizzy opponent in time, opponent collapses
  if (match.finishTimer > 0) {
    if (--match.finishTimer <= 0) {
      if (match.p1.state === 'dizzy') match.p1.health = 0;
      if (match.p2.state === 'dizzy') match.p2.health = 0;
    }
  }

  updateCpu(match, difficulty, cpuInput);
  match.p1.update(match.p2);
  match.p2.update(match.p1);
  bodyPush(match);

  resolveCombat(match);

  updateProjectiles(match);
  updateEffects(match);
  flushEvents();

  const finishing = match.finishTimer > 0;
  if (finishing !== match.finishShown) {
    match.finishShown = finishing;
    roundHud.classList.toggle('is-finish', finishing);
  }
  if (finishing) {
    const tenths = (match.finishTimer / 60).toFixed(1);
    if (timerEl.textContent !== tenths) timerEl.textContent = tenths;
  } else if (--match.timerFrames % 60 === 0 || match.finishHimShown) {
    const seconds = String(Math.max(0, Math.ceil(match.timerFrames / 60)));
    if (timerEl.textContent !== seconds) timerEl.textContent = seconds;
  }

  if (match.tipFrames > 0) {
    const tipOn = --match.tipFrames > 0 && match.p2.health === 100;
    if (!tipOn) match.tipFrames = 0;
    if (tipOn !== fightTip.classList.contains('show')) fightTip.classList.toggle('show', tipOn);
  }

  if (match.p1.health <= 0 || match.p2.health <= 0) beginKo();
  else if (match.timerFrames <= 0) endRound();

  if ((frameNumber & 1) === 0) updateHud(match);
}

let rafId = 0;

function startLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (!rafId) return;
  const id = rafId;
  rafId = 0;
  cancelAnimationFrame(id);
}

function togglePause(force) {
  if (!match || match.phase === 'complete') return;
  paused = typeof force === 'boolean' ? force : !paused;
  const dialog = $('#pause-layer');
  if (paused) {
    if (!dialog.open && !helpOpen()) dialog.showModal();
    playerInput.clear();
    audio.stopMusic();
    stopLoop();
  } else {
    dialog.close();
    canvas.focus({ preventScroll: true });
    lastTime = performance.now();
    accumulator = STEP;
    audio.startMusic(match.stageId);
    if (!document.hidden) startLoop();
  }
}

function loop(now) {
  if (!match || paused || document.hidden) {
    rafId = 0;
    return;
  }
  const delta = clamp(now - lastTime, 0, 50);
  lastTime = now;
  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP && steps < 3) {
    fixedUpdate();
    accumulator -= STEP;
    steps++;
  }
  if (accumulator > STEP) accumulator = 0;
  if (!rafId) return;
  render(ctx, match, frameNumber, images, renderState, accumulator / STEP, delta);
  rafId = requestAnimationFrame(loop);
}

function goSelect() {
  showScreen('select-screen', '.roster-portrait');
}

$('#enter-button').addEventListener('click', () => {
  audio.ensure();
  audio.sfx('ui');
  goSelect();
});

$('#quick-fight-button')?.addEventListener('click', () => {
  audio.ensure();
  audio.sfx('ui');
  rosterApi.reset();
  stageId = 'seattle';
  syncOptions(stageOptions, 'stage', stageId);
  beginVersus();
});

$('#select-back').addEventListener('click', () => showScreen('hero-screen', '#enter-button'));
$('#fight-button').addEventListener('click', beginVersus);
$('#versus-start').addEventListener('click', skipVersus);
$('#versus-back').addEventListener('click', goSelect);
$('#rematch-button').addEventListener('click', startMatch);

$('#change-button').addEventListener('click', () => {
  match = null;
  goSelect();
});

$('#pause-button').addEventListener('click', () => togglePause());
$('#resume-button').addEventListener('click', () => togglePause(false));

$('#quit-button').addEventListener('click', () => {
  paused = false;
  $('#pause-layer').close();
  audio.stopMusic();
  match = null;
  goSelect();
});

$('#help-button').addEventListener('click', () => {
  $('#help-dialog').showModal();
  if (arenaActive() && !paused) togglePause(true);
});

$('#help-dialog').addEventListener('close', () => {
  if (arenaActive() && paused && !$('#pause-layer').open) $('#pause-layer').showModal();
});
$('#pause-layer').addEventListener('cancel', event => {
  event.preventDefault();
  togglePause(false);
});

$('#help-close').addEventListener('click', () => $('#help-dialog').close());

$('#sound-button').addEventListener('click', () => {
  const muted = !audio.muted;
  audio.setMuted(muted);
  updateSoundButton();
  if (!muted) {
    audio.ensure();
    if (arenaActive() && !paused && match.phase !== 'complete') audio.startMusic(match.stageId);
  }
});
function updateSoundButton() {
  const button = $('#sound-button');
  button.textContent = audio.muted ? 'SOM OFF' : 'SOM ON';
  button.setAttribute('aria-pressed', String(!audio.muted));
}
updateSoundButton();

function syncOptions(selector, dataKey, value) {
  for (const button of $$(selector)) {
    const active = button.dataset[dataKey] === value;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

const stageOptions = '#stage-options button';
for (const button of $$(stageOptions)) {
  button.addEventListener('click', () => {
    stageId = button.dataset.stage;
    syncOptions(stageOptions, 'stage', stageId);
    audio.sfx('ui');
  });
}
const difficultyOptions = '#difficulty-options button';
syncOptions(difficultyOptions, 'difficulty', difficulty);
$('#difficulty-hint').textContent = DIFFICULTY_HINTS[difficulty];
for (const button of $$(difficultyOptions)) {
  button.addEventListener('click', () => {
    difficulty = button.dataset.difficulty;
    writeStored('rk-difficulty', difficulty);
    syncOptions(difficultyOptions, 'difficulty', difficulty);
    $('#difficulty-hint').textContent = DIFFICULTY_HINTS[difficulty];
    audio.sfx('ui');
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (match && !paused) togglePause(true);
    stopLoop();
  } else if (match && match.phase !== 'complete' && !paused) {
    lastTime = performance.now();
    startLoop();
  }
});

rosterApi = renderRoster(FIGHTERS, (p1, cpu) => {
  selected = p1;
  selectedCpu = cpu;
  refreshFightButton();
  if ($('#select-screen').classList.contains('is-active')) audio.sfx('ui');
});

bindKeyboard(playerInput, {
  shouldIgnore: () => helpOpen() || $('#pause-layer').open,
  isArena: () => arenaActive() && !paused,
  onEscape() {
    if ($('#versus-screen').classList.contains('is-active')) {
      skipVersus();
      return;
    }
    if (arenaActive()) togglePause();
  },
  onMenuKey(event) {
    const hero = $('#hero-screen').classList.contains('is-active');
    const select = $('#select-screen').classList.contains('is-active');
    const versus = $('#versus-screen').classList.contains('is-active');
    const results = $('#results-screen').classList.contains('is-active');

    const isActivation = event.code === 'Enter' || event.code === 'Space';
    if (isActivation && event.target instanceof Element && event.target.closest('button, a, input, select')) return false;
    if (hero && (event.code === 'Enter' || event.code === 'Space')) {
      $('#quick-fight-button').click();
      return true;
    }
    if (versus && (event.code === 'Enter' || event.code === 'Space')) {
      skipVersus();
      return true;
    }
    if (results && event.code === 'Enter') {
      $('#rematch-button').click();
      return true;
    }
    if (select) {
      if (event.code === 'Digit1' || event.code === 'Numpad1') rosterApi.selectIndex(0);
      if (event.code === 'Digit2' || event.code === 'Numpad2') rosterApi.selectIndex(1);
      if (event.code === 'Digit3' || event.code === 'Numpad3') rosterApi.selectIndex(2);
      if (event.code === 'Enter' && !$('#fight-button').disabled) {
        beginVersus();
        return true;
      }
      return ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(event.code);
    }
    return false;
  }
});

const unlockAudio = () => audio.ensure();
addEventListener('keydown', unlockAudio, { once: true });
addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
bindTouch(playerInput, () => arenaActive() && !paused);
addEventListener('blur', () => playerInput.clear());
reducedMotion.addEventListener('change', () => {
  if (match) match.reducedMotion = reducedMotion.matches;
});

// Warm only the default matchup; other stages are decoded on demand.
for (const path of [FIGHTERS[0].sheet, FIGHTERS[1].sheet, STAGES.seattle.image]) {
  loadImage(path).catch(() => {});
}

if (new URLSearchParams(location.search).has('debug')) {
  window.__lab = { get match() { return match; }, step: fixedUpdate };
}
