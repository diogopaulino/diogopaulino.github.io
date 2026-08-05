import { STEP, FIGHTERS, STAGES, SPECIAL_COST } from './constants.js';
import { $, $$ } from './utils.js';
import { InputBuffer, bindKeyboard, bindTouch } from './input.js';
import audio from './audio.js';
import { Fighter } from './fighter.js';
import { resolveCombat, bodyPush, updateProjectiles, updateEffects } from './combat.js';
import { updateCpu } from './ai.js';
import { initRenderer, render } from './renderer.js';
import { updateHud, announce, showCombo, showScreen, renderRoster } from './ui.js';

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
let animationId = 0;
let lastTime = performance.now();
let accumulator = 0;

const playerInput = new InputBuffer();
const cpuInput = new InputBuffer();
const { ctx, renderState } = initRenderer($('#game'));

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
}

function startRound() {
  match.timerFrames = 99 * 60;
  match.phase = 'intro';
  match.phaseFrame = 140;
  match.projectiles.length = 0;
  match.effects.length = 0;
  match.rings.length = 0;
  if (!match.damageNumbers) match.damageNumbers = [];
  match.damageNumbers.length = 0;
  if (!match.events) match.events = [];
  match.events.length = 0;
  match.cpuThink = 30;
  
  $('#round-label').textContent = `ROUND ${match.round}`;
  $('#timer').textContent = '99';
  hudSignature = updateHud(match, hudSignature);
  announce(`ROUND ${match.round}`, 900);
}

function endRound() {
  if (match.phase !== 'fight') return;
  match.phase = 'roundEnd';
  audio.sfx('ko');
  
  if (match.p1.health === match.p2.health) {
    match.roundWinner = null;
    match.phaseFrame = 90;
    announce('DRAW!', 1000);
  } else {
    match.phaseFrame = 145;
    const winner = match.p1.health > match.p2.health ? match.p1 : match.p2;
    match.roundWinner = winner;
    winner.wins++;
    winner.state = 'victory';
    announce(match.timerFrames <= 0 ? 'TIME!' : 'K.O.!', 1000);
  }
  
  hudSignature = updateHud(match, hudSignature);
}

function finishRound() {
  if (match.roundWinner && match.roundWinner.wins >= 2) {
    finishMatch(match.roundWinner);
    return;
  }
  if (match.roundWinner) {
    match.round++;
  }
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
  }, 650);
}

function startMatch() {
  if (!selected || !assetsReady) return;
  selectedCpu = selectedCpu || FIGHTERS.filter(f => f !== selected)[Math.floor(Math.random() * 2)];
  
  playerInput.clear();
  cpuInput.clear();
  
  const p1 = new Fighter(selected, playerInput, false);
  const p2 = new Fighter(selectedCpu, cpuInput, true);
  
  // Assign loaded sprite images to fighters
  p1.image = images.get(selected.sheet);
  p2.image = images.get(selectedCpu.sheet);
  
  match = {
    p1,
    p2,
    round: 1,
    timerFrames: 99 * 60,
    phase: 'intro',
    phaseFrame: 140,
    hitStop: 0,
    freeze: 0,
    shake: 0,
    effects: [],
    rings: [],
    projectiles: [],
    damageNumbers: [],
    events: [],
    cpuThink: 30,
    stage: STAGES[stageId],
    stageId,
    roundWinner: null
  };
  
  match.p1.setMatch(match);
  match.p2.setMatch(match);
  
  showScreen('arena-screen');
  audio.startMusic(stageId);
  startRound();
}

function fixedUpdate() {
  if (!match || paused) return;
  frameNumber++;
  
  // Sync frame counter to input buffers
  playerInput.updateFrame(frameNumber);
  cpuInput.updateFrame(frameNumber);
  
  if (match.freeze > 0) {
    match.freeze--;
    updateEffects(match);
    return;
  }
  
  if (match.hitStop > 0) {
    match.hitStop--;
    updateEffects(match);
    return;
  }

  if (match.phase === 'intro') {
    if (--match.phaseFrame === 70) {
      announce('FIGHT!', 850);
      audio.sfx('round');
    }
    if (match.phaseFrame <= 0) match.phase = 'fight';
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
  
  if (--match.timerFrames % 60 === 0) {
    $('#timer').textContent = Math.max(0, Math.ceil(match.timerFrames / 60));
  }
  
  if (match.p1.health <= 0 || match.p2.health <= 0 || match.timerFrames <= 0) {
    endRound();
  }
  
  if (match.events && match.events.length > 0) {
    for (const event of match.events) {
      if (event.type === 'announce') {
        announce(event.text, event.duration);
      } else if (event.type === 'combo') {
        showCombo(event.fighter, match);
      }
    }
    match.events.length = 0;
  }
  
  if ((frameNumber & 1) === 0) {
    hudSignature = updateHud(match, hudSignature);
  }
}

function togglePause(force) {
  if (!match || match.phase === 'complete') return;
  paused = typeof force === 'boolean' ? force : !paused;
  $('#pause-layer').hidden = !paused;
  
  if (paused) {
    audio.stopMusic();
  } else {
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
  animationId = requestAnimationFrame(loop);
}

// Event Listeners
$('#enter-button').addEventListener('click', () => {
  audio.ensure();
  audio.sfx('ui');
  showScreen('select-screen');
});

$('#select-back').addEventListener('click', () => showScreen('hero-screen'));

$('#fight-button').addEventListener('click', startMatch);

$('#rematch-button').addEventListener('click', startMatch);

$('#change-button').addEventListener('click', () => {
  match = null;
  selected = null;
  selectedCpu = null;
  $('#fight-button').disabled = true;
  $$('.fighter-card').forEach(card => card.classList.remove('is-selected'));
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

$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());

$('#help-close').addEventListener('click', () => $('#help-dialog').close());

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

// Initialization
renderRoster(FIGHTERS, (selFighter, cpuFighter) => {
  selected = selFighter;
  selectedCpu = cpuFighter;
  $('#p1-preview').textContent = selected.short;
  $('#cpu-preview').textContent = selectedCpu.short;
  $('#fight-button').disabled = false;
  audio.sfx('ui');
});

bindKeyboard(playerInput, () => togglePause());

// Ensure audio context on first keyboard interaction
addEventListener('keydown', () => audio.ensure(), { once: true });
bindTouch(playerInput);

loadAssets().catch(error => {
  $('#loading span').textContent = error.message;
  console.error(error);
});

animationId = requestAnimationFrame(loop);
