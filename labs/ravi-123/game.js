/* ==========================================================================
   Ravi 1·2·3 — máquina de estados e roteiro
   --------------------------------------------------------------------------
   Fluxo do original: sonho com carneirinhos → placa de caminhos → fábrica de
   presentes / mercado / correios → decorar a casa → convidados chegam →
   SURPRESA → servir a comida → todos dançam para fora.

   Nenhuma sequência usa setTimeout ou promise: tudo é uma Timeline declarativa
   avançada pelo update(dt), então trocar de cena descarta o roteiro inteiro
   sem deixar callback órfão para trás.
   ========================================================================== */

import { W } from './screen.js';
import { K, Pen, blit, blitMid, blitFoot } from './assets.js';
import * as F from './font.js';
import { Audio } from './audio.js';
import { SPR, HEROES, TOYS, FOODS, VEHICLES, buildSprites } from './sprites.js';
import * as Sc from './scenes.js';

const STAGE_H = Sc.STAGE_H;

/* --------------------------------------------------------------------------
   Timeline — sequências temporizadas sem timers
   -------------------------------------------------------------------------- */

class Timeline {
  constructor() {
    this.steps = [];
    this.i = 0;
    this.t = 0;
    this.entered = false;
  }

  /** `onUpdate` recebe o progresso 0..1 do passo. */
  add(dur, onEnter, onUpdate) {
    this.steps.push({ dur, onEnter, onUpdate });
    return this;
  }

  update(dt) {
    let budget = dt;
    while (this.i < this.steps.length) {
      const step = this.steps[this.i];
      if (!this.entered) {
        this.entered = true;
        this.t = 0;
        if (step.onEnter) step.onEnter();
      }
      this.t += budget;
      budget = 0;
      const p = step.dur > 0 ? Math.min(1, this.t / step.dur) : 1;
      if (step.onUpdate) step.onUpdate(p);
      if (this.t < step.dur) return false;
      this.i++;
      this.entered = false;
    }
    return true;
  }

  get done() {
    return this.i >= this.steps.length;
  }
}

/* --------------------------------------------------------------------------
   Estado
   -------------------------------------------------------------------------- */

let S;
let scene = null;
let timeline = null;
let clock = 0;

function freshState() {
  return {
    honoree: (Math.random() * HEROES.length) | 0,
    invited: [],
    present: null,
    presentDone: false,
    made: [],
    cart: {},
    marketDone: false,
    inviteDone: false,
    balloons: 0,
    destination: null,
    vehicle: null,
    message: '',
    flash: null,
    flashPop: 0,
    sheep: [],
    travelX: -100,
    mailmanX: -60,
    mold: 0,
    lumpX: 96,
    marketIdx: 0,
    serveIdx: 0,
    guestsIn: 0,
    balloonsHung: 0,
    bannerUp: false,
    fridgeFull: false,
    guestX: [],
    confetti: Sc.makeConfetti(60)
  };
}

function honoree() {
  return HEROES[S.honoree];
}

function readyForParty() {
  return S.presentDone && S.marketDone && S.inviteDone;
}

/** Comidas efetivamente compradas (balão não é comida). */
function boughtFoods() {
  return FOODS.filter((f) => f.id !== 'balloon' && (S.cart[f.id] || 0) > 0);
}

/* --------------------------------------------------------------------------
   Fala e flashcard
   -------------------------------------------------------------------------- */

/**
 * Fala do jogo: escreve na barra de diálogo, sintetiza a voz e espelha o texto numa região
 * `aria-live`. Sem esse espelho, todo o conteúdo do jogo — que é justamente o que a barra
 * diz — ficava invisível para leitor de tela, porque vive dentro de um canvas.
 */
function say(message, speak = true) {
  S.message = message;
  const live = typeof document !== 'undefined' && document.getElementById('announcer');
  if (live) live.textContent = message;
  if (speak) Audio.speak(message);
}

function showFlash(n) {
  S.flash = n;
  S.flashPop = 0;
}

function hideFlash() {
  S.flash = null;
  S.flashPop = 0;
}

/**
 * Anexa à timeline uma contagem de 1 até n: flashcard, nota e número falado.
 * É o coração educativo do jogo — aparece em quase toda cena.
 */
function addCount(tl, n, onStep, stepDur = 0.72) {
  for (let i = 1; i <= n; i++) {
    tl.add(stepDur, () => {
      showFlash(i);
      Audio.countStep(i);
      if (onStep) onStep(i);
    });
  }
  tl.add(0.45, () => hideFlash());
  return tl;
}

/* --------------------------------------------------------------------------
   Troca de cena
   -------------------------------------------------------------------------- */

function go(next) {
  if (scene && scene.exit) scene.exit();
  scene = next;
  timeline = null;
  hideFlash();
  if (scene.enter) scene.enter();
}

/**
 * Hotspots da cena atual — usados pelo hit-test do ponteiro.
 * Cenas em animação zeram `spots`, então o toque fica inerte enquanto a
 * sequência roda, exatamente como o teclado.
 */
export function currentSpots() {
  return scene ? scene.spots : null;
}

/* --------------------------------------------------------------------------
   Cenas
   -------------------------------------------------------------------------- */

/** Balões numerados da tela de título: dão o toque e ensinam o controle. */
function titleSpots() {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: 12 + i * 34, y: 70, w: 30, h: 42 });
  }
  return spots;
}

const SCENES = {
  /* ---------------------------------------------------------------- título */
  title: {
    backdrop: 'houseNight',
    spots: null,
    enter() {
      this.spots = titleSpots();
      say('Aperte um número para acordar o Ravi!');
    },
    update() {},
    input(n) {
      go(SCENES.dream);
      SCENES.dream.begin(n === 0 ? 3 : n);
    },
    draw(ctx) {
      const pen = new Pen(ctx);
      blitFoot(ctx, SPR.ravi.sleep, 150, 152);

      // Logotipo — alto o bastante para cobrir a janela do cenário
      pen.col(K.BLACK).rect(28, 4, 264, 70);
      pen.bevel(30, 6, 260, 66, K.NAVY, K.BLU, K.NIGHT);
      F.textCenter(ctx, 'RAVI', 160, 13, K.YEL_L, { scale: 3, shadow: K.RED_D });
      F.textCenter(ctx, '1 · 2 · 3', 160, 38, K.CYAN, { scale: 2, shadow: K.BLACK });
      F.textCenter(ctx, 'A GRANDE FESTA SURPRESA', 160, 57, K.WHITE, { shadow: K.BLACK });

      // Balões numerados
      for (const spot of this.spots) {
        const bob = Math.round(2 * Math.sin(clock * 2 + spot.n));
        const cx = spot.x + spot.w / 2;
        const cy = spot.y + 14 + bob;
        const color = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.ORANGE, K.CYAN, K.PUR, K.RED_L][spot.n - 1];
        pen.col(K.BLACK).ellipse(cx, cy, 12, 14);
        pen.col(color).ellipse(cx, cy, 11, 13);
        pen.col(K.WHITE).ellipse(cx - 4, cy - 5, 2, 3);
        pen.col(K.CREAM).vline(cx, cy + 14, 14);
        const label = String(spot.n);
        const tw = F.measure(label, 2);
        F.text(ctx, label, Math.round(cx - tw / 2), cy - 7, K.BLACK, { scale: 2 });
      }
    }
  },

  /* ----------------------------------------------------------------- sonho */
  dream: {
    backdrop: 'field',
    spots: null,
    begin(n) {
      S.sheep = [];
      say(`O Ravi está sonhando. Vamos contar ${n} carneirinho${n > 1 ? 's' : ''}!`);
      const tl = new Timeline();
      tl.add(1.6, () => {});
      addCount(tl, n, (i) => {
        S.sheep.push({ born: clock, i });
        Audio.sheep();
      });
      tl.add(0.9, () => {
        Audio.magic();
        say('Bom dia! Já sei: vou fazer uma festa surpresa!');
      });
      tl.add(3.2, null);
      tl.add(0.1, () => go(SCENES.wake));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      blitFoot(ctx, SPR.ravi.sleep, 40, 160);
      for (const sh of S.sheep) {
        const age = clock - sh.born;
        const x = -20 + age * 120;
        if (x > W + 24) continue;
        // Salto sobre a cerca
        const jump = Math.max(0, Math.sin(Math.min(1, (x - 40) / 240) * Math.PI)) * 26;
        blitFoot(ctx, SPR.misc.sheep, x, 140 - jump);
      }
    }
  },

  /* ---------------------------------------------------------- acordar */
  wake: {
    backdrop: 'houseDay',
    spots: null,
    enter() {
      const h = honoree();
      say(`A festa é para ${h.name}, ${h.title}!`);
      const tl = new Timeline();
      tl.add(3.4, () => Audio.fanfare());
      tl.add(0.2, () => say('Vamos à placa de caminhos escolher para onde ir!'));
      tl.add(2.8, null);
      tl.add(0.1, () => go(SCENES.crossroads));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      const pen = new Pen(ctx);
      blitFoot(ctx, SPR.ravi.cheer, 110, 160);
      // Balão de pensamento com o aniversariante
      pen.col(K.BLACK).ellipse(224, 62, 47, 39);
      pen.col(K.WHITE).ellipse(224, 62, 45, 37);
      pen.col(K.BLACK).ellipse(180, 100, 6, 5).ellipse(168, 112, 4, 3);
      pen.col(K.WHITE).ellipse(180, 100, 5, 4).ellipse(168, 112, 3, 2);
      blitFoot(ctx, SPR.hero[honoree().id], 224, 88);
      F.textCenter(ctx, honoree().name, 224, 32, K.RED_D);
    }
  },

  /* ---------------------------------------------------- placa de caminhos */
  crossroads: {
    backdrop: 'street',
    spots: null,
    enter() {
      this.spots = Sc.signpostSpots(readyForParty());
      S.destination = null;
      say(readyForParty()
        ? 'Tudo pronto! Aperte 4 para começar a festa!'
        : 'Aperte 1, 2 ou 3 para escolher o caminho!');
    },
    update() {},
    input(n) {
      if (n === 4 && readyForParty()) {
        go(SCENES.partyPrep);
        return;
      }
      if (n < 1 || n > 3) {
        Audio.bonk();
        return;
      }
      Audio.click();
      S.destination = ['factory', 'market', 'post'][n - 1];
      go(SCENES.transport);
    },
    draw(ctx) {
      Sc.drawSignpost(ctx, this.spots, S);
      blitFoot(ctx, SPR.ravi.wave, 40, 160);
      blitFoot(ctx, SPR.hero[honoree().id], 288, 160);
    }
  },

  /* ------------------------------------------------------------ transporte */
  transport: {
    backdrop: 'street',
    spots: null,
    enter() {
      this.spots = Sc.vehicleSpots();
      say('Como vamos? Escolha de 0 a 9 e conte as rodas!');
    },
    update() {},
    input(n) {
      if (n < 0 || n > 9) return;
      Audio.click();
      S.vehicle = VEHICLES[n];
      go(SCENES.travel);
    },
    draw(ctx) {
      Sc.drawVehicleRack(ctx, this.spots);
    }
  },

  /* ---------------------------------------------------------------- viagem */
  travel: {
    backdrop: 'street',
    spots: null,
    enter() {
      const v = S.vehicle;
      S.travelX = -100;
      Audio.engine();
      say(v.wheels === 0
        ? 'A pé! Nenhuma roda. Zero!'
        : `${v.name}! Vamos contar as rodas.`);

      const tl = new Timeline();
      tl.add(1.4, null);
      if (v.wheels === 0) {
        tl.add(1.0, () => { showFlash(0); Audio.countStep(0); });
        tl.add(0.4, () => hideFlash());
      } else {
        addCount(tl, v.wheels, null);
      }
      tl.add(2.4, () => say('Lá vamos nós!'), (p) => {
        S.travelX = -100 + (W + 160) * easeInOut(p);
      });
      tl.add(0.1, () => {
        if (S.destination === 'factory') go(SCENES.factoryPick);
        else if (S.destination === 'market') go(SCENES.market);
        else go(SCENES.post);
      });
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      const v = S.vehicle;
      const bob = Math.round(Math.sin(clock * 14));
      if (v.wheels === 0) {
        blitFoot(ctx, SPR.ravi[Math.floor(clock * 8) % 2 ? 'walk1' : 'walk0'], S.travelX, 160);
      } else {
        const sprite = SPR.vehicle[v.id];
        blit(ctx, sprite, Math.round(S.travelX - sprite.w / 2), 160 - sprite.h + bob);
        blitFoot(ctx, SPR.ravi.wave, S.travelX, 160 - sprite.h + 12 + bob);
      }
      if (v.wheels > 0) {
        const pen = new Pen(ctx);
        pen.col(K.BLACK).rect(8, 8, 54, 26);
        pen.bevel(9, 9, 52, 24, K.CREAM, K.WHITE, K.GRAY_D);
        F.text(ctx, 'RODAS', 13, 12, K.GRAY_XD);
        F.text(ctx, String(v.wheels), 42, 14, K.RED, { scale: 2 });
      }
    }
  },

  /* -------------------------------------------- fábrica: escolher brinquedo */
  factoryPick: {
    backdrop: 'factory',
    spots: null,
    enter() {
      this.spots = Sc.toyColumnSpots();
      say('Aperte de 1 a 9 e escolha o presente que vamos fabricar!');
    },
    update() {},
    input(n) {
      if (n < 1 || n > 9) {
        Audio.bonk();
        return;
      }
      Audio.click();
      S.present = TOYS[n - 1];
      go(SCENES.factoryBelt);
    },
    draw(ctx) {
      Sc.drawToyColumn(ctx, this.spots, S.made);
      blitFoot(ctx, SPR.ravi.idle, 68, 160);
    }
  },

  /* ------------------------------------------------ fábrica: esteira/prensa */
  factoryBelt: {
    backdrop: 'factory',
    spots: null,
    enter() {
      this.spots = Sc.machinePanelSpots();
      S.mold = 0;
      S.lumpX = 62;
      this.finishing = false;
      say(`Aperte os números para moldar: ${S.present.name}!`);
    },
    update(dt) {
      if (timeline) {
        timeline.update(dt);
        return;
      }
      S.lumpX += dt * (14 + S.mold * 5);
      if (S.lumpX >= 238 && !this.finishing) {
        this.finishing = true;
        const tl = new Timeline();
        tl.add(0.5, () => Audio.stamp());
        tl.add(0.9, () => {
          S.presentDone = true;
          if (!S.made.includes(S.present.id)) S.made.push(S.present.id);
          Audio.success();
          showFlash(TOYS.findIndex((t) => t.id === S.present.id) + 1);
          say(`Pronto! Um ${S.present.name} lindo para a festa!`);
        });
        tl.add(2.4, null);
        tl.add(0.1, () => go(SCENES.crossroads));
        timeline = tl;
      }
    },
    input(n) {
      if (this.finishing) return;
      if (n >= 1 && n <= 9) {
        S.mold = n;
        Audio.pop();
      }
    },
    draw(ctx) {
      const pen = new Pen(ctx);

      // Esteira
      pen.col(K.BLACK).rect(54, 104, 194, 14);
      pen.col(K.PUR).rect(55, 105, 192, 12);
      pen.col(K.PUR_L);
      const shift = Math.floor(clock * 26) % 12;
      for (let x = 55 - shift; x < 247; x += 12) pen.vline(Math.max(55, x), 105, 12);

      // Prensa no fim da esteira
      pen.col(K.BLACK).rect(248, 26, 60, 78);
      pen.bevel(249, 27, 58, 76, K.GRAY, K.GRAY_L, K.GRAY_D);
      pen.col(K.CYAN).rect(257, 36, 42, 20);
      pen.col(K.BLACK).ellipse(269, 46, 5, 5).ellipse(287, 46, 5, 5);
      pen.col(K.WHITE).ellipse(269, 46, 3, 3).ellipse(287, 46, 3, 3);
      pen.col(K.BLACK).ellipse(269, 47, 1, 2).ellipse(287, 47, 1, 2);
      const press = this.finishing ? 26 : 12;  // o pistão desce ao carimbar
      pen.col(K.BLACK).rect(258, 62, 40, press);
      pen.col(K.GRAY_D).rect(259, 62, 38, press - 1);

      // Massa / brinquedo na esteira
      const lump = Math.round(S.lumpX);
      if (S.presentDone && this.finishing) {
        blitMid(ctx, SPR.toy[S.present.id], lump, 96);
      } else {
        pen.col(K.BLACK).ellipse(lump, 96, 10, 8);
        pen.col(K.GRAY).ellipse(lump, 96, 9, 7);
        pen.col(K.GRAY_L).ellipse(lump - 3, 93, 3, 2);
        if (S.mold > 0) {
          // A massa vai virando o brinquedo conforme os números são apertados
          ctx.save();
          ctx.globalAlpha = S.mold / 9;
          blitMid(ctx, SPR.toy[S.present.id], lump, 96);
          ctx.restore();
        }
      }

      blitFoot(ctx, SPR.ravi.idle, 26, 158);
      Sc.drawMachinePanel(ctx, this.spots, S.mold);
    }
  },

  /* --------------------------------------------------------------- mercado */
  market: {
    backdrop: 'market',
    spots: null,
    enter() {
      S.marketIdx = 0;
      S.cart = {};
      this.spots = Sc.quantitySpots();
      this.ask();
    },
    ask() {
      if (S.marketIdx >= FOODS.length) {
        this.spots = null;
        const tl = new Timeline();
        tl.add(0.2, () => {
          S.marketDone = true;
          Audio.success();
          say('Compras feitas! De volta à placa.');
        });
        tl.add(2.4, null);
        tl.add(0.1, () => go(SCENES.crossroads));
        timeline = tl;
        return;
      }
      this.spots = Sc.quantitySpots();
      const item = FOODS[S.marketIdx];
      say(`Quantos ${item.name.toLowerCase()} vamos levar? Aperte de 1 a 9.`);
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    input(n) {
      if (!this.spots) return;  // contagem em andamento
      if (n < 1 || n > 9) {
        Audio.bonk();
        return;
      }
      const item = FOODS[S.marketIdx];
      S.cart[item.id] = n;
      if (item.id === 'balloon') S.balloons = n;
      this.spots = null;

      const tl = new Timeline();
      tl.add(0.3, () => say(`${n} ${item.name.toLowerCase()}!`));
      addCount(tl, n, null);
      tl.add(0.1, () => {
        S.marketIdx++;
        timeline = null;
        this.ask();
      });
      timeline = tl;
    },
    draw(ctx) {
      blitFoot(ctx, SPR.ravi.idle, 40, 160);

      if (S.marketIdx < FOODS.length) {
        const item = FOODS[S.marketIdx];
        const pen = new Pen(ctx);
        // Vitrine com o produto da vez
        pen.col(K.BLACK).rect(98, 26, 96, 76);
        pen.bevel(99, 27, 94, 74, K.CREAM, K.WHITE, K.GRAY_D);
        const sprite = SPR.food[item.id];
        ctx.drawImage(sprite.canvas, 125, 34, sprite.w * 3, sprite.h * 3);
        F.textCenter(ctx, item.name, 146, 88, K.GRAY_XD);
        if (this.spots) Sc.drawQuantityBoard(ctx, this.spots, 'QUANTOS?');
      }

      // Carrinho de compras já preenchido
      let slot = 0;
      for (const food of FOODS) {
        const qty = S.cart[food.id] || 0;
        for (let i = 0; i < qty && slot < 18; i++, slot++) {
          const col = slot % 9;
          const row = (slot / 9) | 0;
          blitMid(ctx, SPR.food[food.id], 74 + col * 17, 128 + row * 18);
        }
      }
    }
  },

  /* -------------------------------------------------------------- correios */
  post: {
    backdrop: 'post',
    spots: null,
    enter() {
      this.spots = Sc.mailboxSpots();
      say(`Convide os heróis! ${honoree().name} não pode saber, é surpresa.`);
    },
    update() {},
    input(n) {
      if (n === 0) {
        S.inviteDone = S.invited.length > 0;
        if (!S.inviteDone) {
          Audio.bonk();
          say('Convide pelo menos um herói antes de voltar!');
          return;
        }
        Audio.click();
        go(SCENES.crossroads);
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
        say(`${HEROES[idx].name} já foi convidado!`);
        return;
      }
      S.invited.push(idx);
      S.inviteDone = true;
      go(SCENES.mailman);
      SCENES.mailman.begin(idx);
    },
    draw(ctx) {
      Sc.drawMailboxes(ctx, this.spots, S);
      blitFoot(ctx, SPR.ravi.wave, 292, 164);
    }
  },

  /* -------------------------------------------------------------- carteiro */
  mailman: {
    backdrop: 'post',
    spots: null,
    begin(idx) {
      S.mailmanX = -40;
      // Cacheado aqui: recalcular a grade a cada frame alocaria no render
      this.boxes = Sc.mailboxSpots();
      const hero = HEROES[idx];
      say(`Convite para ${hero.name}! O carteiro já está a caminho.`);
      const tl = new Timeline();
      tl.add(0.4, () => { showFlash(idx + 1); Audio.note(idx); });
      tl.add(2.6, null, (p) => { S.mailmanX = -40 + (W + 80) * easeOut(p); });
      tl.add(0.2, () => { hideFlash(); Audio.pop(); });
      tl.add(0.1, () => go(SCENES.post));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      Sc.drawMailboxes(ctx, this.boxes, S);
      blitFoot(ctx, SPR.misc.mailman, S.mailmanX, 164);
      blit(ctx, SPR.misc.envelope, Math.round(S.mailmanX + 14), 118);
    }
  },

  /* ------------------------------------------------ festa: preparar a casa */
  partyPrep: {
    backdrop: 'party',
    spots: null,
    enter() {
      S.balloonsHung = 0;
      S.bannerUp = false;
      S.fridgeFull = false;
      S.guestsIn = 0;
      Audio.party();
      say('Hora da festa! Vamos guardar a comida.');

      const tl = new Timeline();
      tl.add(2.6, () => { S.fridgeFull = true; });
      tl.add(0.2, () => say('Agora a faixa: SURPRESA!'));
      tl.add(2.2, () => { S.bannerUp = true; });
      const balloons = Math.max(1, S.balloons);
      tl.add(0.2, () => say(`Vamos pendurar ${balloons} balão${balloons > 1 ? 'ões' : ''}!`));
      addCount(tl, balloons, (i) => { S.balloonsHung = i; });
      tl.add(0.2, () => say('Shh... os convidados estão chegando!'));
      tl.add(2.0, null);
      tl.add(0.1, () => go(SCENES.partyArrive));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, SPR.ravi.wave, 46, 160);
    }
  },

  /* ------------------------------------------------- festa: chegada e surpresa */
  partyArrive: {
    backdrop: 'party',
    spots: null,
    enter() {
      S.guestsIn = 0;
      S.guestX = layoutGuests(S.invited.length + 1);
      const tl = new Timeline();
      for (let i = 0; i < S.invited.length; i++) {
        tl.add(0.55, () => { S.guestsIn = i + 1; Audio.pop(); });
      }
      tl.add(0.6, () => { S.guestsIn = S.invited.length + 1; Audio.click(); });
      tl.add(0.3, () => {
        Audio.fanfare();
        say(`SURPRESA, ${honoree().name}!`);
      });
      tl.add(3.4, null);
      tl.add(0.1, () => {
        if (boughtFoods().length === 0 || S.invited.length === 0) go(SCENES.partyEnd);
        else go(SCENES.partyServe);
      });
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, SPR.ravi.cheer, 46, 160);
      if (S.guestsIn > S.invited.length) {
        Sc.drawConfetti(ctx, S.confetti, clock);
        if (Math.floor(clock * 3) % 2 === 0) {
          F.textCenter(ctx, 'SURPRESA!', 160, 74, K.YEL_L, { scale: 2, shadow: K.RED_D });
        }
      }
    }
  },

  /* ------------------------------------------------------- festa: servir */
  partyServe: {
    backdrop: 'party',
    spots: null,
    enter() {
      S.serveIdx = 0;
      S.guestsIn = S.invited.length + 1;
      S.guestX = layoutGuests(S.invited.length + 1);
      this.spots = Sc.plateSpots();
      this.ask();
    },
    ask() {
      const menu = boughtFoods();
      if (S.serveIdx >= S.invited.length || menu.length === 0) {
        this.spots = null;
        const tl = new Timeline();
        tl.add(0.1, () => go(SCENES.partyEnd));
        timeline = tl;
        return;
      }
      const hero = HEROES[S.invited[S.serveIdx]];
      const food = menu[S.serveIdx % menu.length];
      this.food = food;
      this.spots = Sc.plateSpots();
      say(`Quantos ${food.name.toLowerCase()} para ${hero.name}? Aperte de 1 a 9.`);
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    input(n) {
      if (!this.spots) return;  // contagem em andamento
      if (n < 1 || n > 9) {
        Audio.bonk();
        return;
      }
      const hero = HEROES[S.invited[S.serveIdx]];
      this.spots = null;
      const tl = new Timeline();
      addCount(tl, n, null);
      tl.add(0.9, () => say(`${n} para ${hero.name}!`));
      tl.add(0.1, () => {
        S.serveIdx++;
        timeline = null;
        this.ask();
      });
      timeline = tl;
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, SPR.ravi.wave, 22, 158);
      if (this.spots) Sc.drawPlates(ctx, this.spots, this.food);
    }
  },

  /* ------------------------------------------------------------ festa: fim */
  partyEnd: {
    backdrop: 'party',
    spots: null,
    enter() {
      this.leave = 0;
      Audio.party();
      say('Que festa incrível! Os heróis dançam até a porta.');
      const tl = new Timeline();
      tl.add(3.6, null, (p) => { this.leave = p; });
      tl.add(0.2, () => {
        Audio.success();
        say('Obrigado por ajudar! Aperte um número para outra festa.');
      });
      tl.add(1.2, null);
      tl.add(0.1, () => {
        this.done = true;
        // A tela inteira vira alvo de toque para recomeçar
        this.spots = [{ n: 1, x: 0, y: 0, w: W, h: STAGE_H }];
      });
      timeline = tl;
      this.done = false;
      this.spots = null;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    input() {
      if (!this.done) return;
      restart();
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx, Math.round(this.leave * 210));
      drawPartyFront(ctx);
      blitFoot(ctx, SPR.ravi.cheer, 46, 160);
      Sc.drawConfetti(ctx, S.confetti, clock);

      if (this.done) {
        const pen = new Pen(ctx);
        pen.col(K.BLACK).rect(48, 50, 224, 62);
        pen.bevel(50, 52, 220, 58, K.NAVY, K.BLU, K.NIGHT);
        F.textCenter(ctx, 'FESTA ENCERRADA!', 160, 62, K.YEL_L, { scale: 2, shadow: K.RED_D });
        if (Math.floor(clock * 1.5) % 2 === 0) {
          F.textCenter(ctx, 'APERTE UM NÚMERO PARA RECOMEÇAR', 160, 92, K.WHITE, { shadow: K.BLACK });
        }
      }
    }
  }
};

/* --------------------------------------------------------------------------
   Desenho compartilhado da sala de festa
   -------------------------------------------------------------------------- */

/* Os convidados ficam ATRÁS da mesa: pés na linha do tampo, para o corpo
   aparecer inteiro e os pés sumirem por trás do móvel. Por isso a sala é
   desenhada em duas camadas, com os heróis no meio. */
const GUEST_FOOT_Y = 118;

function layoutGuests(count) {
  const xs = [];
  const spread = Math.min(34, 292 / Math.max(count, 1));
  const start = 160 - ((count - 1) * spread) / 2;
  for (let i = 0; i < count; i++) xs.push(Math.round(start + i * spread));
  return xs;
}

/** Camada de fundo da sala: geladeira, faixa e balões. */
function drawPartyBack(ctx) {
  const pen = new Pen(ctx);

  // Geladeira
  pen.col(K.BLACK).rect(8, 60, 34, 68);
  pen.col(K.WHITE).rect(9, 61, 32, 66);
  pen.col(K.GRAY_L).hline(9, 94, 32);
  pen.col(K.GRAY_D).rect(36, 70, 3, 16).rect(36, 100, 3, 16);
  if (S.fridgeFull) {
    pen.col(K.RED).rect(14, 66, 6, 6);
    pen.col(K.GRN).rect(24, 66, 6, 6);
    pen.col(K.YEL).rect(19, 76, 6, 6);
  }

  // Faixa SURPRESA
  if (S.bannerUp) {
    pen.col(K.BLACK).rect(96, 14, 128, 22);
    pen.bevel(97, 15, 126, 20, K.YEL, K.YEL_L, K.OCHRE);
    F.textCenter(ctx, 'SURPRESA!', 160, 21, K.RED, { shadow: K.SAND });
  }

  Sc.drawBalloons(ctx, S.balloonsHung, clock);
}

/** Camada da frente: o que está apoiado sobre a mesa, na frente dos heróis. */
function drawPartyFront(ctx) {
  blitFoot(ctx, SPR.misc.cake, 62, 125);
  if (S.presentDone && S.present) blitFoot(ctx, SPR.misc.gift, 262, 125);
}

function drawGuests(ctx, offsetX = 0) {
  for (let i = 0; i < S.guestsIn && i < S.guestX.length; i++) {
    const isHonoree = i >= S.invited.length;
    const hi = isHonoree ? S.honoree : S.invited[i];
    const dance = isHonoree && S.guestsIn > S.invited.length
      ? Math.round(3 * Math.sin(clock * 7 + i))
      : 0;
    blitFoot(ctx, SPR.hero[HEROES[hi].id], S.guestX[i] + offsetX, GUEST_FOOT_Y + dance);
  }
}

/* --------------------------------------------------------------------------
   Easing
   -------------------------------------------------------------------------- */

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOut(t) {
  return t * (2 - t);
}

/* --------------------------------------------------------------------------
   API pública
   -------------------------------------------------------------------------- */

export function initGame() {
  buildSprites();
  S = freshState();
  scene = SCENES.title;
  timeline = null;
  clock = 0;
  if (scene.enter) scene.enter();
}

function restart() {
  Audio.stopSpeech();
  S = freshState();
  go(SCENES.title);
}

/**
 * Entrada de número, venha do teclado ou do toque num hotspot.
 * Cenas puramente animadas simplesmente não têm `input`, então a entrada
 * é ignorada sem precisar de flag de "ocupado" espalhada pelo estado.
 */
export function handleNumber(n) {
  Audio.init();
  if (scene && scene.input) scene.input(n);
}

export function update(dt) {
  clock += dt;
  if (S.flash !== null && S.flashPop < 1) {
    S.flashPop = Math.min(1, S.flashPop + dt * 7);
  }
  if (scene && scene.update) scene.update(dt);
}

export function draw(ctx) {
  ctx.drawImage(Sc.backdrop(scene.backdrop), 0, 0);
  if (scene.draw) scene.draw(ctx);
  if (S.flash !== null) Sc.flashcard(ctx, S.flash, S.flashPop);
  Sc.speechBar(ctx, S.message);
}

export function getClock() {
  return clock;
}
