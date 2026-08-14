import { STEP, FIGHTERS, STAGES, GROUND, GRAVITY } from './constants.js';
import { $, $$, approach } from './utils.js';
import { InputBuffer, bindKeyboard, bindTouch } from './input.js';
import audio from './audio.js';
import { Fighter } from './fighter.js';
import { resolveCombat, bodyPush, updateProjectiles, updateEffects, addDust } from './combat.js';
import { updateCpu } from './ai.js';
import { initRenderer, render } from './renderer.js';
import { updateHud, announce, showCombo, showScreen, renderRoster, fillVersus } from './ui.js';

let match = null;
let paused = false;
let selected = null;
let selectedCpu = null;
let stageId = 'seattle';
let difficulty = localStorage.getItem('rk-difficulty') || 'normal';
const images = new Map();
let assetsReady = false;
let frameNumber = 0;
let hudSignature = '';
let lastTime = performance.now();
let accumulator = 0;
let vsTimer = 0;
let rosterApi = null;

const playerInput = new InputBuffer();
const cpuInput = new InputBuffer();
const { ctx, renderState } = initRenderer($('#game'));

function arenaActive() {
  return Boolean(match) && $('#arena-screen').classList.contains('is-active');
}

function helpOpen() {
  return $('#help-dialog').open;
}

function refreshFightButton() {
  $('#fight-button').disabled = !(selected && selectedCpu && assetsReady);
}

async function loadAssets() {
  const paths = [...FIGHTERS.map(f => f.sheet), ...Object.values(STAGES).map(s => s.image)];
  await Promise.all(paths.map(path => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { images.set(path, image); resolve(); };
    image.onerror = () => reject(new Error(`Falha ao carregar ${path}`));
    image.src = path;
  })));
  assetsReady = true;
  $('#loading').classList.add('is-ready');
  refreshFightButton();
}

function startRound() {
  match.timerFrames = 99 * 60;
  match.phase = 'intro';
  match.phaseFrame = 150;
  match.projectiles.length = 0;
  match.effects.length = 0;
  match.rings.length = 0;
  match.damageNumbers.length = 0;
  match.events.length = 0;
  match.cpuThink = 28;
  match.cpuHold = [];
  match.koSlow = 0;
  match.koZoom = 0;
  match.superFlash = 0;
  match.p1.x = 120;
  match.p2.x = 1160;
  match.p1.y = GROUND;
  match.p2.y = GROUND;
  match.p1.facing = 1;
  match.p2.facing = -1;
  match.p1.state = 'walk';
  match.p2.state = 'walk';

  $('#round-label').textContent = `ROUND ${match.round}`;
  $('#timer').textContent = '99';
  hudSignature = updateHud(match, '');
  announce(`ROUND ${match.round}`, 900);
}

function koLabel() {
  const p1Dead = match.p1.health <= 0;
  const p2Dead = match.p2.health <= 0;
  if (p1Dead && p2Dead) return 'DOUBLE K.O.!';
  if (p1Dead && match.p2.health >= 99.5) return 'PERFECT';
  if (p2Dead && match.p1.health >= 99.5) return 'PERFECT';
  if (match.timerFrames <= 0) return 'TIME OVER';
  return 'K.O.!';
}

function beginKo() {
  if (match.phase !== 'fight') return;
  match.phase = 'ko';
  match.koSlow = 52;
  match.shake = Math.max(match.shake, 10);
  audio.sfx('ko');
  announce(koLabel(), 1200);
}

function endRound() {
  if (match.phase !== 'fight' && match.phase !== 'ko') return;
  match.phase = 'roundEnd';
  match.phaseFrame = 150;

  if (match.p1.health === match.p2.health) {
    match.roundWinner = null;
    match.phaseFrame = 96;
    if (match.timerFrames <= 0) announce('TIME OVER', 1000);
    else if (match.p1.health > 0) announce('DRAW!', 1000);
  } else {
    const winner = match.p1.health > match.p2.health ? match.p1 : match.p2;
    const loser = winner === match.p1 ? match.p2 : match.p1;
    match.roundWinner = winner;
    winner.wins++;
    winner.state = 'victory';
    winner.move = null;
    loser.state = 'knockdown';
    loser.knockdown = 80;
    if (match.timerFrames <= 0 && winner.health > 0) announce('TIME OVER', 1000);
  }

  hudSignature = updateHud(match, '');
}

function finishRound() {
  if (match.roundWinner && match.roundWinner.wins >= 2) {
    finishMatch(match.roundWinner);
    return;
  }
  match.round++;
  match.p1.reset(370, true);
  match.p2.reset(910, true);
  startRound();
}

function finishMatch(winner) {
  match.phase = 'complete';
  audio.stopMusic();
  audio.sfx('win');
  setTimeout(() => {
    const figure = $('#result-figure');
    figure.style.setProperty('--sheet', `url("${winner.data.sheet}")`);
    $('#result-title').innerHTML = `${winner.data.short} <em>VENCEU</em>`;
    $('#result-copy').textContent = winner.data.quote;
    $('#result-overline').textContent = winner === match.p1 ? 'PLAYER 1 WINS' : 'CPU WINS';
    showScreen('results-screen');
  }, 700);
}

function startMatch() {
  if (!selected || !selectedCpu || !assetsReady) return;
  clearTimeout(vsTimer);
  playerInput.clear();
  cpuInput.clear();

  const p1 = new Fighter(selected, playerInput, false);
  const p2 = new Fighter(selectedCpu, cpuInput, true);
  p1.image = images.get(selected.sheet);
  p2.image = images.get(selectedCpu.sheet);

  match = {
    p1, p2,
    round: 1,
    timerFrames: 99 * 60,
    phase: 'intro',
    phaseFrame: 150,
    hitStop: 0,
    freeze: 0,
    shake: 0,
    superFlash: 0,
    koSlow: 0,
    koZoom: 0,
    effects: [],
    rings: [],
    projectiles: [],
    damageNumbers: [],
    events: [],
    cpuThink: 28,
    cpuHold: [],
    stage: STAGES[stageId],
    stageId,
    roundWinner: null
  };

  match.p1.setMatch(match);
  match.p2.setMatch(match);
  paused = false;
  $('#pause-layer').hidden = true;
  showScreen('arena-screen');
  audio.startMusic(stageId);
  startRound();
}

function beginVersus() {
  if (!selected || !selectedCpu || !assetsReady) return;
  audio.ensure();
  audio.sfx('round');
  fillVersus(selected, selectedCpu, STAGES[stageId]);
  showScreen('versus-screen');
  clearTimeout(vsTimer);
  vsTimer = setTimeout(startMatch, 2200);
}

function skipVersus() {
  if (!$('#versus-screen').classList.contains('is-active')) return;
  clearTimeout(vsTimer);
  startMatch();
}

function flushEvents() {
  for (const event of match.events) {
    if (event.type === 'announce') announce(event.text, event.duration);
    else if (event.type === 'combo') showCombo(event.fighter, match);
    else if (event.type === 'dust') addDust(match, event.x, event.y);
  }
  match.events.length = 0;
}

function updateIntro() {
  match.p1.x = approach(match.p1.x, 370, 5.2);
  match.p2.x = approach(match.p2.x, 910, 5.2);
  match.p1.facing = 1;
  match.p2.facing = -1;
  match.p1.state = Math.abs(match.p1.x - 370) < 2 ? 'idle' : 'walk';
  match.p2.state = Math.abs(match.p2.x - 910) < 2 ? 'idle' : 'walk';
  match.p1.stateFrame++;
  match.p2.stateFrame++;
}

function updateKoPhysics() {
  for (const fighter of [match.p1, match.p2]) {
    fighter.x += fighter.vx;
    fighter.vx *= 0.9;
    if (!fighter.grounded() || fighter.vy) {
      fighter.y += fighter.vy;
      fighter.vy += GRAVITY;
      if (fighter.y >= GROUND) {
        fighter.y = GROUND;
        fighter.vy = 0;
        fighter.state = 'knockdown';
      }
    }
  }
}

function fixedUpdate() {
  if (!match || paused) return;
  frameNumber++;
  playerInput.updateFrame(frameNumber);
  cpuInput.updateFrame(frameNumber);

  if (match.freeze > 0) {
    match.freeze--;
    updateEffects(match);
    flushEvents();
    return;
  }

  if (match.hitStop > 0) {
    match.hitStop--;
    updateEffects(match);
    return;
  }

  if (match.phase === 'intro') {
    updateIntro();
    if (--match.phaseFrame === 72) {
      announce('FIGHT!', 850);
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
    if (match.koSlow % 3 === 0) updateKoPhysics();
    if (--match.koSlow <= 0) endRound();
    updateEffects(match);
    return;
  }

  if (match.phase === 'roundEnd') {
    if (--match.phaseFrame <= 0) finishRound();
    updateEffects(match);
    return;
  }

  if (match.phase !== 'fight') return;

  updateCpu(match, difficulty, cpuInput);
  match.p1.update(match.p2);
  match.p2.update(match.p1);
  bodyPush(match);

  resolveCombat(match, match.p1, match.p2);
  resolveCombat(match, match.p2, match.p1);

  updateProjectiles(match);
  updateEffects(match);
  flushEvents();

  if (--match.timerFrames % 60 === 0) {
    $('#timer').textContent = String(Math.max(0, Math.ceil(match.timerFrames / 60)));
  }

  if (match.p1.health <= 0 || match.p2.health <= 0) beginKo();
  else if (match.timerFrames <= 0) endRound();

  if ((frameNumber & 1) === 0) hudSignature = updateHud(match, hudSignature);
}

function togglePause(force) {
  if (!match || match.phase === 'complete') return;
  paused = typeof force === 'boolean' ? force : !paused;
  $('#pause-layer').hidden = !paused;
  if (paused) audio.stopMusic();
  else {
    lastTime = performance.now();
    accumulator = 0;
    audio.startMusic(stageId);
  }
}

function loop(now) {
  const delta = Math.min(50, now - lastTime);
  lastTime = now;
  accumulator += delta;
  while (accumulator >= STEP) {
    fixedUpdate();
    accumulator -= STEP;
  }
  render(ctx, match, frameNumber, images, renderState);
  requestAnimationFrame(loop);
}

function goSelect() {
  showScreen('select-screen');
}

$('#enter-button').addEventListener('click', () => {
  audio.ensure();
  audio.sfx('ui');
  goSelect();
});

$('#select-back').addEventListener('click', () => showScreen('hero-screen'));
$('#fight-button').addEventListener('click', beginVersus);
$('#versus-screen').addEventListener('click', skipVersus);
$('#rematch-button').addEventListener('click', startMatch);

$('#change-button').addEventListener('click', () => {
  match = null;
  selected = null;
  selectedCpu = null;
  rosterApi?.reset();
  refreshFightButton();
  showScreen('select-screen');
});

$('#pause-button').addEventListener('click', () => togglePause());
$('#resume-button').addEventListener('click', () => togglePause(false));

$('#quit-button').addEventListener('click', () => {
  paused = false;
  $('#pause-layer').hidden = true;
  audio.stopMusic();
  match = null;
  showScreen('select-screen');
});

$('#help-button').addEventListener('click', () => {
  if (arenaActive() && !paused) togglePause(true);
  $('#help-dialog').showModal();
});

$('#help-close').addEventListener('click', () => $('#help-dialog').close());
$('#help-dialog').addEventListener('close', () => {
  if (arenaActive() && paused) {
    // keep paused after closing help during a match
  }
});

$('#sound-button').addEventListener('click', event => {
  const muted = !audio.muted;
  audio.setMuted(muted);
  event.currentTarget.textContent = muted ? 'SOM OFF' : 'SOM ON';
  if (!muted) audio.ensure();
});
$('#sound-button').textContent = audio.muted ? 'SOM OFF' : 'SOM ON';

$$('#stage-options .option').forEach(button => button.addEventListener('click', () => {
  stageId = button.dataset.stage;
  $$('#stage-options .option').forEach(item => item.classList.toggle('is-active', item === button));
  audio.sfx('ui');
}));

$$('#difficulty-options button').forEach(button => {
  button.classList.toggle('is-active', button.dataset.difficulty === difficulty);
  button.addEventListener('click', () => {
    difficulty = button.dataset.difficulty;
    localStorage.setItem('rk-difficulty', difficulty);
    $$('#difficulty-options button').forEach(item => item.classList.toggle('is-active', item === button));
    audio.sfx('ui');
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && match && !paused) togglePause(true);
});

rosterApi = renderRoster(FIGHTERS, (p1, cpu) => {
  selected = p1;
  selectedCpu = cpu;
  refreshFightButton();
  if (p1) audio.sfx('ui');
});

bindKeyboard(playerInput, {
  shouldIgnore: () => helpOpen(),
  isArena: arenaActive,
  onEscape() {
    if (helpOpen()) {
      $('#help-dialog').close();
      return;
    }
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

    if (hero && (event.code === 'Enter' || event.code === 'Space')) {
      $('#enter-button').click();
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

addEventListener('keydown', () => audio.ensure(), { once: true });
bindTouch(playerInput);

loadAssets().catch(error => {
  $('#loading span').textContent = error.message;
  console.error(error);
});

requestAnimationFrame(loop);
