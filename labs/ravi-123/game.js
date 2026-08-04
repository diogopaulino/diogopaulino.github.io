/* ==========================================================================
   Ravi 1·2·3 — lógica no molde de Mickey's 123: The Big Surprise Party
   Controles: apenas números 0–9 (teclado ou numpad na tela)
   ========================================================================== */

import { Audio } from './audio.js';
import * as Art from './art.js';

const {
  W, H, C, HEROES, TOYS, VEHICLES, MARKET,
  drawSky, drawGrass, drawRavi, drawHero, drawSheep, drawFence,
  drawArmchair, drawHouseInterior, drawSignpost, drawFactoryBg, drawGear,
  drawMarketBg, drawPostBg, drawPartyBg, drawStreet, drawVehicle,
  drawMarketItem, drawNumberBadge, drawConfetti, makeConfetti
} = Art;

/* --------------------------------------------------------------------------
   Estado
   -------------------------------------------------------------------------- */

function fresh() {
  const honoree = (Math.random() * HEROES.length) | 0;
  return {
    scene: 'title',
    busy: false,
    t: 0,
    honoree,
    invited: [],
    present: null,
    presentDone: false,
    cart: {},
    marketDone: false,
    inviteDone: false,
    balloons: 0,
    destination: null,
    vehicle: null,
    travelX: -80,
    sheep: [],
    countN: 0,
    flash: 0,
    beltX: 180,
    beltItem: null,
    mold: 0,
    marketIdx: 0,
    marketCount: 0,
    marketShown: [],
    serveIdx: 0,
    serveItem: 0,
    partyPhase: 'prep',
    confetti: makeConfetti(50),
    mailmanX: -60,
    mailmanTarget: null,
    fridge: false,
    signHung: false,
    balloonsHung: 0,
    guestsIn: 0,
    goodbye: 0
  };
}

let S = fresh();
let sayTimer = 0;

/* --------------------------------------------------------------------------
   UI helpers
   -------------------------------------------------------------------------- */

const els = {};

function roundRectLocal(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function bindUI() {
  els.canvas = document.getElementById('game');
  els.ctx = els.canvas.getContext('2d');
  els.bubble = document.getElementById('speech-bubble');
  els.flash = document.getElementById('flashcard');
  els.flashNum = document.getElementById('flash-num');
  els.choice = document.getElementById('choice-panel');
  els.choicePrompt = document.getElementById('choice-prompt');
  els.choiceGrid = document.getElementById('choice-grid');
  els.numpad = document.getElementById('numpad');
  els.title = document.getElementById('title-overlay');

  document.querySelectorAll('.num-key').forEach((btn) => {
    const fire = () => {
      const n = parseInt(btn.dataset.n, 10);
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
      onNumber(n);
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(); });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      onNumber(parseInt(e.key, 10));
      const btn = document.querySelector(`.num-key[data-n="${e.key}"]`);
      if (btn) {
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
      }
    }
  });

  document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);
  document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = '/labs/';
  });

  // toque na intro também inicia
  els.title.addEventListener('pointerdown', () => {
    if (S.scene === 'title') onNumber(1 + ((Math.random() * 9) | 0));
  });
}

function say(text, ms = 3200) {
  els.bubble.textContent = text;
  els.bubble.classList.remove('hidden');
  // re-trigger animation
  els.bubble.style.animation = 'none';
  void els.bubble.offsetWidth;
  els.bubble.style.animation = '';
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => els.bubble.classList.add('hidden'), ms);
  Audio.say(text);
}

function showFlash(n) {
  els.flashNum.textContent = String(n);
  els.flash.classList.remove('hidden');
}

function hideFlash() {
  els.flash.classList.add('hidden');
}

function showChoices(prompt, items) {
  els.choicePrompt.textContent = prompt;
  els.choiceGrid.innerHTML = '';
  items.forEach((it, i) => {
    const div = document.createElement('div');
    div.className = 'choice-item' + (it.done ? ' done' : '') + (it.locked ? ' locked' : '');
    div.style.animationDelay = `${i * 0.04}s`;
    div.innerHTML = `<span class="n">${it.n}</span><span>${it.label}</span>`;
    els.choiceGrid.appendChild(div);
  });
  els.choice.classList.remove('hidden');
}

function hideChoices() {
  els.choice.classList.add('hidden');
}

function setPad(active) {
  els.numpad.classList.toggle('dim', !active);
}

function toggleFullscreen() {
  const root = document.documentElement;
  const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (req) req.call(root);
      else document.body.classList.add('fs-fallback');
    } else if (exit) {
      exit.call(document);
      document.body.classList.remove('fs-fallback');
    } else {
      document.body.classList.toggle('fs-fallback');
    }
  } catch (_) {
    document.body.classList.toggle('fs-fallback');
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readyForParty() {
  return S.presentDone && S.marketDone && S.inviteDone;
}

/* --------------------------------------------------------------------------
   Input
   -------------------------------------------------------------------------- */

async function onNumber(n) {
  Audio.init();
  // Durante a esteira, números moldam o presente mesmo com busy
  if (S.scene === 'factoryBelt') {
    if (n === 0) S.beltBoost = (S.beltBoost || 0) + 28;
    else S.mold = n;
    Audio.pop();
    return;
  }
  if (S.busy) return;

  switch (S.scene) {
    case 'title':
      await startDream(n === 0 ? 5 : n);
      break;
    case 'sign':
      await pickDestination(n);
      break;
    case 'transport':
      await pickTransport(n);
      break;
    case 'factoryPick':
      if (n >= 1 && n <= 9) await makePresent(n - 1);
      else if (n === 0) goSign();
      break;
    case 'marketItem':
      if (n >= 1 && n <= 9) await buyItem(n);
      else if (n === 0) await buyItem(0);
      break;
    case 'post':
      await inviteHero(n);
      break;
    case 'partyServe':
      if (n >= 1 && n <= 9) await serveFood(n);
      break;
    case 'end':
      restart();
      break;
    default:
      break;
  }
}

/* --------------------------------------------------------------------------
   Cenas / fluxo
   -------------------------------------------------------------------------- */

async function startDream(n) {
  S.busy = true;
  document.body.classList.add('is-playing');
  els.title.classList.add('hidden');
  S.scene = 'dream';
  S.sheep = [];
  hideChoices();
  say('Ravi está sonhando... vamos contar carneirinhos!', 2500);
  await wait(600);

  await Audio.countTo(n, (i) => {
    showFlash(i);
    S.sheep.push({ x: -40, born: S.t, i });
    Audio.sheep();
  });
  hideFlash();
  await wait(700);

  S.scene = 'wake';
  say(`Bom dia! Hoje vou preparar uma festa surpresa para ${HEROES[S.honoree].name}!`, 4000);
  Audio.magic();
  await wait(3800);

  say(`${HEROES[S.honoree].name}, ${HEROES[S.honoree].title}, vai adorar! Vamos à placa de caminhos!`, 3500);
  await wait(2800);
  goSign();
  S.busy = false;
}

function goSign() {
  S.scene = 'sign';
  S.destination = null;
  hideFlash();
  const items = [
    { n: 1, label: 'Fábrica de Presentes', done: S.presentDone },
    { n: 2, label: 'Mercado', done: S.marketDone },
    { n: 3, label: 'Correios', done: S.inviteDone }
  ];
  if (readyForParty()) items.push({ n: 4, label: 'A FESTA!', done: false });
  showChoices('Para onde vamos? Aperte um número!', items);
  say(readyForParty()
    ? 'Tudo pronto! Aperte 4 para a FESTA!'
    : 'Aperte 1, 2 ou 3 para escolher o caminho!');
  setPad(true);
}

async function pickDestination(n) {
  if (n === 4 && readyForParty()) {
    hideChoices();
    await startParty();
    return;
  }
  if (n < 1 || n > 3) {
    Audio.bonk();
    return;
  }
  S.destination = ['factory', 'market', 'post'][n - 1];
  S.scene = 'transport';
  showChoices('Como vamos? Escolha o transporte (0–9)!', VEHICLES.map((v, i) => ({
    n: i,
    label: `${v.name}${v.wheels ? ` · ${v.wheels} roda${v.wheels > 1 ? 's' : ''}` : ''}`
  })));
  say('Escolha de 0 a 9: cada número é um jeito de ir!');
}

async function pickTransport(n) {
  if (n < 0 || n > 9) return;
  S.busy = true;
  S.vehicle = VEHICLES[n];
  hideChoices();
  S.scene = 'travel';
  S.travelX = -100;
  Audio.engine();
  say(`${S.vehicle.name}! Contando as rodas...`, 2000);

  if (S.vehicle.wheels > 0) {
    await Audio.countTo(S.vehicle.wheels, (i) => showFlash(i));
    hideFlash();
  } else {
    showFlash(0);
    await wait(500);
    hideFlash();
  }

  // anima viagem
  const start = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      const elapsed = (performance.now() - start) / 1000;
      S.travelX = -100 + elapsed * 280;
      if (S.travelX > W + 80) resolve();
      else requestAnimationFrame(step);
    };
    step();
  });

  S.busy = false;
  if (S.destination === 'factory') enterFactory();
  else if (S.destination === 'market') enterMarket();
  else enterPost();
}

function enterFactory() {
  S.scene = 'factoryPick';
  showChoices('Qual presente vamos fazer? (0 = voltar)', TOYS.map((t, i) => ({
    n: i + 1,
    label: t.name
  })).concat([{ n: 0, label: 'Voltar à placa' }]));
  say('Na fábrica mágica: aperte 1 a 9 para escolher o presente!');
}

async function makePresent(idx) {
  S.busy = true;
  S.present = TOYS[idx];
  hideChoices();
  S.scene = 'factoryBelt';
  S.beltX = 180;
  S.mold = 0;
  S.beltBoost = 0;
  say(`Vamos fazer: ${S.present.name}! Aperte números para moldar. 0 acelera a esteira!`, 4000);

  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      S.beltX = 180 + elapsed * 70 + (S.beltBoost || 0);
      if (S.beltX >= 520) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });

  showFlash(idx + 1);
  Audio.success();
  S.presentDone = true;
  say(`Presente pronto: ${S.present.name}!`, 2500);
  await wait(1800);
  hideFlash();
  S.busy = false;
  goSign();
}

function enterMarket() {
  S.scene = 'marketItem';
  S.marketIdx = 0;
  S.marketShown = [];
  S.cart = {};
  askMarketItem();
}

function askMarketItem() {
  if (S.marketIdx >= MARKET.length) {
    finishMarket();
    return;
  }
  const item = MARKET[S.marketIdx];
  showChoices(`Quantos(as) ${item.name}? (1–9)`, [
    { n: '1–9', label: item.name }
  ]);
  say(`Quantos ${item.name.toLowerCase()} vamos levar para a festa?`);
  setPad(true);
}

async function buyItem(n) {
  if (S.busy) return;
  S.busy = true;
  const item = MARKET[S.marketIdx];
  const qty = Math.max(0, Math.min(9, n));
  hideChoices();

  if (qty === 0) {
    S.cart[item.id] = 0;
    say(`Nenhum ${item.name.toLowerCase()}... ok!`, 1500);
    await wait(1000);
  } else {
    S.cart[item.id] = qty;
    if (item.id === 'balloon') S.balloons = qty;
    say(`${qty} ${item.name}!`, 1500);
    await Audio.countTo(qty, (i) => {
      showFlash(i);
      S.marketShown.push({ id: item.id, i, born: S.t });
    });
    hideFlash();
  }

  S.marketIdx++;
  S.busy = false;
  askMarketItem();
}

async function finishMarket() {
  S.marketDone = true;
  S.scene = 'marketDone';
  Audio.success();
  say('Compras feitas! De volta à placa!', 2500);
  await wait(2000);
  goSign();
}

function enterPost() {
  S.scene = 'post';
  const items = HEROES.map((h, i) => ({
    n: i + 1,
    label: h.name,
    done: S.invited.includes(i),
    locked: i === S.honoree
  }));
  items.push({ n: 0, label: 'Voltar à placa' });
  showChoices('Quem vamos convidar? (aniversariante bloqueado)', items);
  say(`Convide heróis! Não pode ser ${HEROES[S.honoree].name} — a festa é surpresa!`);
}

async function inviteHero(n) {
  if (n === 0) {
    if (S.invited.length > 0) S.inviteDone = true;
    goSign();
    return;
  }
  if (n < 1 || n > 9) return;
  const idx = n - 1;
  if (idx === S.honoree) {
    Audio.bonk();
    say(`Shh! ${HEROES[idx].name} não pode saber da surpresa!`);
    return;
  }
  if (S.invited.includes(idx)) {
    Audio.bonk();
    say(`${HEROES[idx].name} já foi convidado(a)!`);
    return;
  }

  S.busy = true;
  S.invited.push(idx);
  S.mailmanTarget = idx;
  S.mailmanX = -60;
  hideChoices();
  S.scene = 'mailman';
  showFlash(n);
  Audio.note(n - 1);
  say(`Convite para ${HEROES[idx].name}! O carteiro está a caminho!`, 2500);

  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const e = (performance.now() - start) / 1000;
      S.mailmanX = -60 + e * 200;
      if (S.mailmanX > W + 40) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });

  hideFlash();
  S.inviteDone = S.invited.length > 0;
  S.busy = false;
  enterPost();
}

async function startParty() {
  S.busy = true;
  S.scene = 'party';
  S.partyPhase = 'fridge';
  hideChoices();
  say('Hora da festa! Guardando a comida na geladeira...', 2800);
  Audio.party();
  await wait(2800);

  S.partyPhase = 'sign';
  say('Colocando a placa: SURPRESA!', 2200);
  await wait(2200);

  S.partyPhase = 'balloons';
  const b = Math.max(S.balloons, 1);
  say(`Vamos pendurar ${b} balões!`, 2000);
  await Audio.countTo(b, (i) => {
    showFlash(i);
    S.balloonsHung = i;
  });
  hideFlash();

  S.partyPhase = 'wait';
  say('Shh... os convidados estão chegando!', 2500);
  await wait(2200);

  S.partyPhase = 'arrive';
  for (let i = 0; i <= S.invited.length; i++) {
    S.guestsIn = i;
    Audio.pop();
    await wait(450);
  }
  // aniversariante entra por último
  S.guestsIn = S.invited.length + 1;
  await wait(400);

  S.partyPhase = 'surprise';
  Audio.magic();
  say(`SURPRESA, ${HEROES[S.honoree].name}!!!`, 3500);
  await wait(3000);

  if (S.invited.length === 0) {
    await endParty();
    return;
  }

  S.partyPhase = 'serve';
  S.scene = 'partyServe';
  S.serveIdx = 0;
  S.serveItem = 0;
  askServe();
  S.busy = false;
}

function askServe() {
  if (S.serveIdx >= S.invited.length) {
    S.busy = true;
    endParty();
    return;
  }
  const hero = HEROES[S.invited[S.serveIdx]];
  const foods = MARKET.filter((m) => m.id !== 'balloon' && (S.cart[m.id] || 0) > 0);
  if (foods.length === 0) {
    S.serveIdx++;
    askServe();
    return;
  }
  const food = foods[S.serveItem % foods.length];
  showChoices(`Quantos ${food.name} para ${hero.name}?`, [
    { n: '1–9', label: `${hero.name} quer ${food.name}` }
  ]);
  say(`Quantos ${food.name.toLowerCase()} para ${hero.name}?`);
}

async function serveFood(n) {
  S.busy = true;
  hideChoices();
  const hero = HEROES[S.invited[S.serveIdx]];
  await Audio.countTo(n, (i) => showFlash(i));
  hideFlash();
  say(`${n} para ${hero.name}!`, 1200);
  await wait(900);

  S.serveItem++;
  const foods = MARKET.filter((m) => m.id !== 'balloon' && (S.cart[m.id] || 0) > 0);
  if (S.serveItem >= foods.length) {
    S.serveItem = 0;
    S.serveIdx++;
  }
  S.busy = false;
  askServe();
}

async function endParty() {
  S.busy = true;
  hideChoices();
  S.scene = 'party';
  S.partyPhase = 'leave';
  say('Que festa incrível! Os heróis dançam até a porta...', 3500);
  Audio.success();
  await wait(3500);

  S.partyPhase = 'bye';
  S.scene = 'end';
  say('Obrigado por ajudar! Aperte qualquer número para outra festa!', 5000);
  setPad(true);
  S.busy = false;
}

function restart() {
  S = fresh();
  document.body.classList.remove('is-playing');
  els.title.classList.remove('hidden');
  hideChoices();
  hideFlash();
  els.bubble.classList.add('hidden');
  S.scene = 'title';
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

function render() {
  const ctx = els.ctx;
  ctx.clearRect(0, 0, W, H);
  S.t += 1 / 60;

  switch (S.scene) {
    case 'title':
      drawTitle(ctx);
      break;
    case 'dream':
      drawDream(ctx);
      break;
    case 'wake':
      drawWake(ctx);
      break;
    case 'sign':
      drawSign(ctx);
      break;
    case 'transport':
      drawSign(ctx);
      break;
    case 'travel':
      drawTravel(ctx);
      break;
    case 'factoryPick':
    case 'factoryBelt':
      drawFactory(ctx);
      break;
    case 'marketItem':
    case 'marketDone':
      drawMarket(ctx);
      break;
    case 'post':
    case 'mailman':
      drawPost(ctx);
      break;
    case 'party':
    case 'partyServe':
    case 'end':
      drawParty(ctx);
      break;
    default:
      drawSky(ctx);
      break;
  }
}

function drawTitle(ctx) {
  drawHouseInterior(ctx, true);
  drawArmchair(ctx, 300, 250);
  drawRavi(ctx, 300, 220, 'sleep', S.t);
  // estrela cadente
  ctx.strokeStyle = C.yellow;
  ctx.lineWidth = 2;
  const sx = (S.t * 80) % (W + 100) - 50;
  ctx.beginPath();
  ctx.moveTo(sx, 60); ctx.lineTo(sx + 30, 75);
  ctx.stroke();
}

function drawDream(ctx) {
  drawSky(ctx, { night: true });
  drawFence(ctx, 250);
  drawGrass(ctx, 310);
  drawRavi(ctx, 80, 280, 'sleep', S.t);

  S.sheep.forEach((sh, i) => {
    const age = S.t - sh.born;
    const x = -40 + age * 140;
    drawSheep(ctx, x, 240, S.t + i);
  });
}

function drawWake(ctx) {
  drawHouseInterior(ctx, false);
  drawArmchair(ctx, 300, 250);
  drawRavi(ctx, 300, 220, 'cheer', S.t);
  drawHero(ctx, HEROES[S.honoree], 480, 260, 1.1, S.t);
  // balão pensamento
  ctx.fillStyle = C.cream;
  roundBubble(ctx, 480, 160, 100, 50);
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 13px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Festa para', 480, 155);
  ctx.fillText(HEROES[S.honoree].name.split(' ')[0], 480, 175);
}

function roundBubble(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawSign(ctx) {
  drawStreet(ctx);
  drawSignpost(ctx, 200, 140);
  if (readyForParty()) {
    ctx.save();
    ctx.translate(220, 300);
    roundRectLocal(ctx, 8, 0, 130, 32, 6);
    ctx.fillStyle = C.yellow;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText('4  FESTA!', 22, 21);
    ctx.restore();
  }
  drawRavi(ctx, 420, 270, 'wave', S.t);
  drawHero(ctx, HEROES[S.honoree], 520, 280, 0.85, S.t);
  // checkmarks
  ctx.font = 'bold 18px sans-serif';
  if (S.presentDone) { ctx.fillStyle = C.green; ctx.fillText('✓ Presente', 20, 30); }
  if (S.marketDone) { ctx.fillStyle = C.green; ctx.fillText('✓ Mercado', 20, 52); }
  if (S.inviteDone) { ctx.fillStyle = C.green; ctx.fillText('✓ Convites', 20, 74); }
}

function drawTravel(ctx) {
  drawStreet(ctx);
  const v = S.vehicle;
  if (v && v.id !== 'walk') {
    drawVehicle(ctx, v.id, S.travelX, 300, S.t);
    drawRavi(ctx, S.travelX, 250, 'walk', S.t);
  } else {
    drawRavi(ctx, S.travelX, 270, 'walk', S.t);
  }
  if (v && v.wheels > 0) {
    drawNumberBadge(ctx, v.wheels, 80, 80, 0.9);
  }
}

function drawFactory(ctx) {
  drawFactoryBg(ctx);
  drawGear(ctx, 100, 100, 28, S.t * 2);
  drawGear(ctx, 145, 85, 18, -S.t * 3);

  if (S.scene === 'factoryBelt' && S.present) {
    // material na esteira
    const morph = S.mold / 9;
    ctx.save();
    ctx.translate(S.beltX, 230);
    if (morph < 0.3) {
      ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.arc(0, 0, 20 + S.mold, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      S.present.draw(ctx, 0, 0, 0.7 + morph * 0.4);
    }
    ctx.restore();
  }

  drawRavi(ctx, 560, 300, 'idle', S.t);

  if (S.presentDone && S.present && S.scene !== 'factoryBelt') {
    S.present.draw(ctx, 500, 200, 1);
  }
}

function drawMarket(ctx) {
  drawMarketBg(ctx);
  drawRavi(ctx, 80, 300, 'idle', S.t);

  // item atual grande
  if (S.marketIdx < MARKET.length && S.scene === 'marketItem') {
    const item = MARKET[S.marketIdx];
    drawMarketItem(ctx, item.id, 320, 200, 2.2);
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 22px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, 320, 270);
  }

  // itens já comprados
  S.marketShown.forEach((m, i) => {
    const col = i % 8;
    const row = (i / 8) | 0;
    drawMarketItem(ctx, m.id, 200 + col * 40, 320 + row * 30, 0.7);
  });
}

function drawPost(ctx) {
  drawPostBg(ctx);
  drawRavi(ctx, 120, 280, 'wave', S.t);

  // heróis em miniatura
  HEROES.forEach((h, i) => {
    const x = 80 + (i % 5) * 100;
    const y = 40 + ((i / 5) | 0) * 70;
    const locked = i === S.honoree;
    const invited = S.invited.includes(i);
    ctx.globalAlpha = locked ? 0.35 : 1;
    drawHero(ctx, h, x, y, 0.55, S.t);
    ctx.globalAlpha = 1;
    ctx.fillStyle = locked ? C.gray : invited ? C.green : C.ink;
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}. ${h.name.split(' ')[0]}`, x, y + 55);
    if (invited) ctx.fillText('✓', x + 28, y - 20);
  });

  if (S.scene === 'mailman') {
    ctx.save();
    ctx.translate(S.mailmanX, 300);
    // bicicleta
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(-22, 24, 14, 0, Math.PI * 2);
    ctx.arc(22, 24, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.gray;
    ctx.beginPath();
    ctx.arc(-22, 24, 6, 0, Math.PI * 2);
    ctx.arc(22, 24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 24); ctx.lineTo(0, 0); ctx.lineTo(22, 24);
    ctx.moveTo(0, 0); ctx.lineTo(0, -18);
    ctx.stroke();
    // carteiro
    roundRectLocal(ctx, -14, -40, 28, 32, 8);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -52, 14, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.skin;
    ctx.fill();
    ctx.stroke();
    // chapéu
    roundRectLocal(ctx, -16, -68, 32, 12, 3);
    ctx.fillStyle = '#1d4ed8';
    ctx.fill();
    ctx.stroke();
    // envelope
    ctx.fillStyle = C.cream;
    ctx.fillRect(16, -36, 26, 18);
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(16, -36, 26, 18);
    ctx.beginPath();
    ctx.moveTo(16, -36); ctx.lineTo(29, -26); ctx.lineTo(42, -36);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParty(ctx) {
  drawPartyBg(ctx);

  // balões pendurados
  for (let i = 0; i < S.balloonsHung; i++) {
    const x = 100 + i * Math.min(50, 440 / Math.max(S.balloonsHung, 1));
    drawMarketItem(ctx, 'balloon', x, 100 + (i % 3) * 10, 0.9);
  }

  if (S.partyPhase === 'fridge' || S.partyPhase === 'sign') {
    // geladeira
    roundRectLocal(ctx, 40, 140, 70, 140, 6);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = C.blue;
    ctx.fillRect(95, 200, 8, 20);
  }

  if (S.partyPhase === 'sign' || ['balloons', 'wait', 'arrive', 'surprise', 'serve', 'leave', 'bye'].includes(S.partyPhase)) {
    ctx.fillStyle = C.yellow;
    roundRectLocal(ctx, 240, 100, 160, 40, 8);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = C.red;
    ctx.font = 'bold 20px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SURPRESA!', 320, 128);
  }

  drawRavi(ctx, 120, 310, S.partyPhase === 'surprise' || S.partyPhase === 'leave' ? 'cheer' : 'wave', S.t);

  // convidados em fila na frente da mesa
  const guests = [...S.invited];
  if (S.guestsIn > S.invited.length) guests.push(S.honoree);

  const shown = Math.min(S.guestsIn, guests.length);
  for (let i = 0; i < shown; i++) {
    const hi = guests[i];
    const spread = Math.min(70, 360 / Math.max(shown, 1));
    const x = 220 + i * spread;
    const dance = (S.partyPhase === 'leave' || S.partyPhase === 'surprise') ? Math.sin(S.t * 8 + i) * 10 : 0;
    const leaveX = S.partyPhase === 'leave' || S.partyPhase === 'bye' ? ((S.t * 40) % 220) : 0;
    drawHero(ctx, HEROES[hi], x + leaveX, 318 + dance, 1.05, S.t);
  }

  // presente ao lado do bolo
  if (S.present) {
    S.present.draw(ctx, 420, 248, 0.95);
  }

  if (S.partyPhase === 'surprise' || S.partyPhase === 'leave' || S.partyPhase === 'bye') {
    drawConfetti(ctx, S.confetti, S.t);
  }

  if (S.scene === 'end') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.cream;
    roundRectLocal(ctx, 120, 120, 400, 120, 16);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = C.red;
    ctx.font = 'bold 28px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Festa Encerrada!', 320, 170);
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.fillText('Aperte um número para recomeçar', 320, 210);
  }
}

/* --------------------------------------------------------------------------
   Loop + resize (estica fullscreen como DOS)
   -------------------------------------------------------------------------- */

function resize() {
  // Canvas interno fixo 640x400; CSS estica para 100vw×100vh
  els.canvas.width = W;
  els.canvas.height = H;
}

function loop() {
  render();
  requestAnimationFrame(loop);
}

export function boot() {
  bindUI();
  resize();
  window.addEventListener('resize', resize);
  setPad(true);
  say('Aperte qualquer número para começar!', 4000);
  loop();
}
