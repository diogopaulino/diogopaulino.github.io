import { VIEW_W, VIEW_H } from './config.js?v=4';
import { KongAudio } from './audio.js?v=4';
import { createInput } from './input.js?v=4';
import { KongGame } from './game.js?v=4';
import { LEVELS } from './levels.js?v=4';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const announcer = document.getElementById('announcer');
const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const pad = document.getElementById('touchPad');
const stage = document.getElementById('stage');

const titleScreen = document.getElementById('titleScreen');
const menuScreen = document.getElementById('menuScreen');
const menuKicker = document.getElementById('menuKicker');
const menuTitle = document.getElementById('menuTitle');
const menuText = document.getElementById('menuText');
const menuStats = document.getElementById('menuStats');
const menuPrimary = document.getElementById('menuPrimary');
const menuSecondary = document.getElementById('menuSecondary');
const mapBar = document.getElementById('mapBar');
const mapPlay = document.getElementById('mapPlay');
const easyBtn = document.getElementById('easyBtn');
const normalBtn = document.getElementById('normalBtn');

const audio = new KongAudio();
const input = createInput();
const game = new KongGame(audio, input);

input.bindHold(document.getElementById('btnLeft'), 'left');
input.bindHold(document.getElementById('btnRight'), 'right');
input.bindHold(document.getElementById('btnUp'), 'up');
input.bindHold(document.getElementById('btnDown'), 'down');
input.bindHold(document.getElementById('btnJump'), 'jump');
input.bindHold(document.getElementById('btnRoll'), 'roll');

/* ---------- resolução: nítido em qualquer tela ----------
 * O mundo é desenhado em coordenadas fixas VIEW_W × VIEW_H (480 × 270).
 * O canvas real tem VIEW × escala, escala = tamanho CSS × devicePixelRatio
 * (DPR limitado a 2 e escala a 3 para não pesar). Medido só no resize — nada de
 * leitura de layout dentro do loop. */
let renderScale = 1;
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
  const s = Math.max(1, Math.min(3, fit * dpr));
  const w = Math.round(VIEW_W * s);
  const h = Math.round(VIEW_H * s);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderScale = w / VIEW_W;
}
// Paisagem com toque: o direcional cobre o canto de baixo, então a câmera
// mostra Kong mais alto na tela (sobra espaço para ver buracos embaixo dele).
const landscapeTouch = matchMedia('(max-height: 520px) and (orientation: landscape)');
function syncCamera() {
  game.camAnchorY = landscapeTouch.matches ? 0.5 : 0.64;
}
landscapeTouch.addEventListener?.('change', syncCamera);
syncCamera();

if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
else window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ---------- som ---------- */
let lastMuted;
function syncMute() {
  const muted = audio.muted;
  if (lastMuted === muted) return;
  lastMuted = muted;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
  muteBtn.textContent = muted ? '×' : '♪';
}

// Botões do HUD não ficam com foco (senão o Espaço de pular "clicaria" neles).
for (const btn of [muteBtn, pauseBtn]) btn.addEventListener('pointerdown', (e) => e.preventDefault());

muteBtn.addEventListener('click', () => {
  audio.toggleMute();
  syncMute();
});

pauseBtn.addEventListener('click', () => {
  audio.ensure();
  if (game.mode === 'play') game.pause();
  else if (game.mode === 'pause') game.resume();
});

/* ---------- painéis HTML ---------- */
function syncEasy() {
  easyBtn.setAttribute('aria-pressed', String(game.easy));
  normalBtn.setAttribute('aria-pressed', String(!game.easy));
}
easyBtn.addEventListener('click', () => { game.setEasy(true); syncEasy(); audio.play('select'); });
normalBtn.addEventListener('click', () => { game.setEasy(false); syncEasy(); audio.play('select'); });
syncEasy();

document.getElementById('playBtn').addEventListener('click', () => {
  audio.ensure();
  game.startRun();
});
mapPlay.addEventListener('click', () => {
  audio.ensure();
  if (game.mode === 'map') game.startLevel(game.cursor);
});
document.getElementById('mapPrev').addEventListener('click', () => game.moveCursor(-1));
document.getElementById('mapNext').addEventListener('click', () => game.moveCursor(1));
document.getElementById('mapHome').addEventListener('click', () => game.toTitle());

/** Conteúdo de cada tela: [kicker, título, texto, primário, secundário]. */
const MENU = {
  pause: () => ['Pausa', 'Pausado', 'Respire fundo. O jogo espera você.', ['Continuar', () => game.resume()], ['Mapa', () => game.toMap()]],
  clear: () => [
    `Fase ${game.levelIndex + 1} de ${LEVELS.length}`,
    'Fase concluída!',
    'Muito bem! Kong Kong chegou à bandeira.',
    ['Próxima fase', () => game.nextLevel()],
    ['Mapa', () => game.toMap()]
  ],
  gameover: () => [
    'Fim de jogo',
    'Ah, não!',
    game.easy
      ? 'Acabaram as vidas. Tente de novo — você já sabe o caminho!'
      : 'Acabaram as vidas. Dica: o modo Fácil dá 7 vidas e não tem susto nos buracos.',
    ['Jogar de novo', () => game.retryLevel()],
    ['Mapa', () => game.toMap()]
  ],
  credits: () => [
    'Você venceu!',
    'Ilha salva!',
    'Kong Kong derrotou o Rei Croco e recuperou todas as bananas.',
    ['Jogar de novo', () => game.toMap()],
    ['Início', () => game.toTitle()]
  ]
};

let primaryAction = null;
let secondaryAction = null;
menuPrimary.addEventListener('click', () => primaryAction && primaryAction());
menuSecondary.addEventListener('click', () => secondaryAction && secondaryAction());

function stat(label, value) {
  const el = document.createElement('span');
  el.className = 'stat';
  const b = document.createElement('b');
  b.textContent = value;
  el.append(b, label);
  return el;
}

let shownMode = '';
let shownCursor = -1;
function syncMapLabel() {
  shownCursor = game.cursor;
  mapPlay.textContent = `Jogar fase ${game.cursor + 1}`;
  mapPlay.setAttribute('aria-label', `Jogar fase ${game.cursor + 1}: ${LEVELS[game.cursor].title}`);
}
function syncScreens() {
  const mode = game.mode;
  if (mode === 'map' && shownCursor !== game.cursor) syncMapLabel();
  if (mode === shownMode) return;
  const prev = shownMode;
  shownMode = mode;
  shownCursor = -1;
  if (mode === 'map') syncMapLabel();

  titleScreen.hidden = mode !== 'title';
  mapBar.hidden = mode !== 'map';
  const menu = MENU[mode];
  menuScreen.hidden = !menu;
  stage.dataset.mode = mode;
  pad.classList.toggle('is-hidden', mode !== 'play');
  pauseBtn.classList.toggle('is-dim', mode !== 'play' && mode !== 'pause');
  pauseBtn.textContent = mode === 'pause' ? '▶' : 'Ⅱ';
  pauseBtn.setAttribute('aria-label', mode === 'pause' ? 'Continuar' : 'Pausar');

  if (menu) {
    const [kicker, title, text, primary, secondary] = menu();
    menuKicker.textContent = kicker;
    menuTitle.textContent = title;
    menuText.textContent = text;
    menuPrimary.textContent = primary[0];
    menuSecondary.textContent = secondary[0];
    primaryAction = primary[1];
    secondaryAction = secondary[1];
    menuStats.replaceChildren();
    if (mode === 'clear' || mode === 'credits') {
      menuStats.append(stat(' bananas', String(game.levelBananas)), stat(' vidas', String(Math.max(0, game.lives))));
    } else if (mode === 'gameover') {
      menuStats.append(stat(' bananas nesta fase', String(game.levelBananas)));
    }
    menuScreen.dataset.kind = mode;
  }

  // Foco no botão principal só para quem usa teclado (não abre teclado/realce no toque).
  const keyboardUser = !matchMedia('(pointer: coarse)').matches;
  if (keyboardUser && prev !== '') {
    if (menu) menuPrimary.focus({ preventScroll: true });
    else if (mode === 'map') mapPlay.focus({ preventScroll: true });
    else if (mode === 'title') document.getElementById('playBtn').focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.closest('[data-ui]')) document.activeElement.blur();
  }
}

/* ---------- toque no canvas: escolher fase no mapa ---------- */
canvas.addEventListener('pointerdown', (ev) => {
  audio.ensure();
  if (game.mode !== 'map') return;
  // Conversão considerando object-fit: contain (pode haver faixas laterais).
  const rect = canvas.getBoundingClientRect();
  const s = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
  const ox = rect.left + (rect.width - VIEW_W * s) / 2;
  const oy = rect.top + (rect.height - VIEW_H * s) / 2;
  game.tapMap((ev.clientX - ox) / s, (ev.clientY - oy) / s);
});

/* ---------- aba oculta: pausa o jogo e o som ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.pause();
    audio.suspend();
  } else {
    audio.resume();
  }
});

/* ---------- loop ---------- */
let lastAnnounce = '';
let last = performance.now();

function frame(now) {
  // dt limitado: uma aba que volta ou um frame lento não "teleportam" a física.
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  game.update(dt);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  game.render(ctx);

  if (game.announce && game.announce !== lastAnnounce) {
    lastAnnounce = game.announce;
    announcer.textContent = game.announce;
  }
  syncScreens();
  syncMute();
}

// Gancho só para testes automatizados (?test): expõe o estado para leitura.
if (new URLSearchParams(location.search).has('test')) window.__kong = { game, LEVELS };

syncMute();
if (window.LabRuntime) {
  LabRuntime.createLoop(frame).start();
} else {
  const fallbackLoop = (now) => {
    frame(now);
    requestAnimationFrame(fallbackLoop);
  };
  requestAnimationFrame(fallbackLoop);
}
