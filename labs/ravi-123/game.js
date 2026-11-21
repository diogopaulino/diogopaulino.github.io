/* ==========================================================================
   Ravi 1·2·3 — Máquina de Estados e Interações Fiéis ao Mickey's 123 (320×200)
   --------------------------------------------------------------------------
   - Fábrica:
     1) Escolher presente 1..9 na coluna vertical (com o Ravi apontando).
     2) Na esteira: enquanto o material corre, as teclas 1..9 acionam 9 bicos
        transformadores (cortar em fatias, esmagar como panqueca, estrela,
        mola, cubos, coração, espiral, rosquinha, bolinhas!).
     3) A tecla 0 ("0>>") acelera a esteira direto para a prensa final!
     4) No final da esteira, a máquina monta o brinquedo, embrulha na caixa
        de presente com laço e entrega na mão do Ravi!
   - Mercado:
     1) A criança escolhe a quantidade (1..9) de cada um dos 5 itens.
     2) Cada item selecionado voa da prateleira para o balcão/carrinho enquanto
        é contado em voz alta!
   - Correios:
     1) Escolher amigos 1..9 nas caixas postais (segredo para o aniversariante!).
     2) O carteiro pedala até a casa do amigo convidado e entrega o convite!
   - Festa:
     1) Guardar comida na geladeira, pendurar faixa SURPRESA! e contar os balões.
     2) Convidados chegam, gritam SURPRESA! e o aniversariante abre o presente!
     3) Servir CADA comida comprada para CADA personagem na mesa (1..9).
     4) Todos dançam para fora da sala!
   ========================================================================== */

import { W, getContext } from './screen.js';
import { K, Pen, blit, blitMid, blitFoot } from './assets.js';
import * as F from './font.js';
import { Audio } from './audio.js';
import {
  SPR,
  HEROES,
  TOYS,
  FOODS,
  VEHICLES,
  buildSprites,
  raviPose,
  heroSprite
} from './sprites.js';
import * as Sc from './scenes.js';
import { wave, hop } from './anim.js';

const STAGE_H = Sc.STAGE_H;

let sharedPen = null;
function getPen(ctx) {
  if (!sharedPen || sharedPen.ctx !== ctx) sharedPen = new Pen(ctx);
  sharedPen._ci = -1;
  return sharedPen;
}

/* --------------------------------------------------------------------------
   Timeline — sequências temporizadas sem setTimeout
   -------------------------------------------------------------------------- */

class Timeline {
  constructor() {
    this.steps = [];
    this.i = 0;
    this.t = 0;
    this.entered = false;
  }

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
    mailmanTarget: 0,
    mold: 0,
    nozzleDrop: 0,
    beltFast: false,
    packStage: 0, // 0=na esteira, 1=brinquedo pronto, 2=embrulhado na caixa, 3=entregue ao Ravi
    lumpX: 62,
    marketIdx: 0,
    flyFoodP: -1,
    serveQueue: [],
    serveStep: 0,
    servePlacing: 0,
    serveHero: -1,
    serveFoodId: null,
    served: {},
    stock: {},
    guestsIn: 0,
    balloonsHung: 0,
    bannerUp: false,
    fridgeFull: false,
    giftOpened: false,
    giftPop: 0,
    guestX: [],
    confetti: Sc.makeConfetti(70),
    pops: [],
    joy: 0,
    stamps: 0
  };
}

function honoree() {
  return HEROES[S.honoree];
}

function readyForParty() {
  return S.presentDone && S.marketDone && S.inviteDone;
}

function boughtFoods() {
  return FOODS.filter((f) => f.id !== 'balloon' && (S.cart[f.id] || 0) > 0);
}

function partyRoster() {
  return S.invited.concat(S.honoree);
}

/* --------------------------------------------------------------------------
   Fala e flashcard
   -------------------------------------------------------------------------- */

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

function addCount(tl, n, onStep, stepDur = 0.85) {
  for (let i = 1; i <= n; i++) {
    tl.add(stepDur, () => {
      showFlash(i);
      Audio.countStep(i);
      Sc.spawnPops(S.pops, 160, 70, clock);
      if (onStep) onStep(i);
    });
  }
  tl.add(0.4, () => hideFlash());
  return tl;
}

function joyBurst(x = 160, y = 80) {
  S.joy = clock;
  Sc.spawnPops(S.pops, x, y, clock);
}

/* --------------------------------------------------------------------------
   Troca de cena
   -------------------------------------------------------------------------- */

function go(next) {
  if (scene && scene.exit) scene.exit();
  Audio.stopSpeech();
  scene = next;
  timeline = null;
  hideFlash();
  if (scene.music) Audio.setTheme(scene.music);
  if (scene.enter) scene.enter();
}

export function currentSpots() {
  return scene ? scene.spots : null;
}

const TITLE_SPOTS = (() => {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: 8 + i * 35, y: 40, w: 32, h: 48 });
  }
  return spots;
})();

/* --------------------------------------------------------------------------
   Cenas
   -------------------------------------------------------------------------- */

const SCENES = {
  /* ---------------------------------------------------------------- título */
  title: {
    backdrop: 'houseNight',
    music: 'lullaby',
    spots: null,
    enter() {
      this.spots = TITLE_SPOTS;
      say('Toque um número de 1 a 9!');
    },
    update() {},
    input(n) {
      joyBurst(20 + (n ? n : 3) * 32, 60);
      go(SCENES.dream);
      SCENES.dream.begin(n <= 0 ? 3 : n);
    },
    draw(ctx) {
      const pen = getPen(ctx);
      const sleep = raviPose('sleep', clock);
      const sw = Math.round(sleep.w * 1.5);
      const sh = Math.round(sleep.h * 1.5);
      ctx.drawImage(sleep.canvas, 152 - (sw >> 1), 148 - sh, sw, sh);

      pen.col(K.BLACK).rect(40, 3, 240, 33);
      pen.bevel(41, 2, 238, 32, K.NAVY, K.BLU, K.NIGHT);
      pen.col(K.OCHRE).frame(43, 4, 234, 28);
      F.textCenter(ctx, 'RAVI  1·2·3', 160, 7, K.YEL_L, {
        scale: 2,
        shadow: K.RED_D
      });
      F.textCenter(ctx, 'A GRANDE FESTA', 160, 23, K.WHITE, { shadow: K.BLACK });

      const colors = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.ORANGE, K.CYAN, K.PUR, K.RED_L];
      for (const spot of this.spots) {
        const bob = wave(clock, 1.4, 2, spot.n * 0.8);
        const cx = Math.round(spot.x + spot.w / 2);
        const cy = spot.y + 16 + bob;
        const color = colors[spot.n - 1];

        pen.col(K.CREAM).vline(cx, cy + 16, 16);
        pen.col(K.BLACK).ellipse(cx + 1, cy + 2, 13, 14);
        pen.col(K.BLACK).ellipse(cx, cy, 14, 15);
        pen.col(color).ellipse(cx, cy, 13, 14);
        pen.col(K.WHITE).ellipse(cx - 4, cy - 5, 3, 3);
        pen.col(color).px(cx, cy + 15);

        const label = String(spot.n);
        const tw = F.measure(label, 2);
        pen.col(K.CREAM).rect(Math.round(cx - tw / 2 - 3), cy - 8, tw + 6, 15);
        F.text(ctx, label, Math.round(cx - tw / 2), cy - 7, K.RED, {
          scale: 2,
          shadow: K.SAND
        });
      }
    }
  },

  /* ----------------------------------------------------------------- sonho */
  dream: {
    backdrop: 'field',
    music: 'lullaby',
    spots: null,
    begin(n) {
      S.sheep = [];
      say(`Vamos contar ${n} carneirinho${n > 1 ? 's' : ''}!`);
      const tl = new Timeline();
      tl.add(0.85, () => {});
      addCount(
        tl,
        n,
        (i) => {
          S.sheep.push({ born: clock, i });
          Audio.sheep();
        },
        0.95
      );
      tl.add(0.7, () => {
        Audio.magic();
        say('Bom dia! Vamos fazer uma festa!');
      });
      tl.add(1.8, null);
      tl.add(0.1, () => go(SCENES.wake));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      go(SCENES.wake);
    },
    draw(ctx) {
      blitFoot(ctx, SPR.ravi.sleep, 40, 160);

      for (const sh of S.sheep) {
        const age = clock - sh.born;
        const x = -24 + age * 95;
        if (x > W + 28) continue;
        const along = Math.min(1, Math.max(0, (x - 30) / 220));
        const jump = Math.sin(along * Math.PI) * 30;
        const foot = 142 - jump;
        blitFoot(ctx, SPR.misc.sheep, x, foot);
      }
    }
  },

  /* ---------------------------------------------------------- acordar */
  wake: {
    backdrop: 'houseDay',
    music: 'town',
    spots: null,
    enter() {
      const h = honoree();
      say(`Hoje vou fazer uma festa surpresa para ${h.name}!`);
      const tl = new Timeline();
      tl.add(1.4, () => Audio.fanfare());
      tl.add(0.2, () => say('Para onde vamos primeiro?'));
      tl.add(1.9, null);
      tl.add(0.1, () => go(SCENES.crossroads));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      go(SCENES.crossroads);
    },
    draw(ctx) {
      const pen = getPen(ctx);
      blitFoot(ctx, raviPose('cheer', clock), 108, 160);

      const bx = 224;
      const by = 66;
      pen.col(K.BLACK).ellipse(bx, by, 50, 46);
      pen.col(K.NAVY).ellipse(bx, by, 49, 45);
      pen.col(K.WHITE).ellipse(bx, by, 47, 43);
      pen.col(K.CREAM).ellipse(bx, by, 44, 40);
      pen.col(K.BLACK).ellipse(174, 102, 7, 5).ellipse(160, 114, 5, 4);
      pen.col(K.WHITE).ellipse(174, 102, 5, 3).ellipse(160, 114, 3, 2);

      const name = honoree().name;
      const tw = F.measure(name, 1);
      Sc.raised(pen, bx - (tw >> 1) - 6, 26, tw + 12, 13, K.YEL, K.YEL_L, K.OCHRE);
      F.textCenter(ctx, name, bx, 29, K.RED, { shadow: K.SAND });
      blitFoot(ctx, SPR.hero[honoree().id], bx, 92);
    }
  },

  /* ---------------------------------------------------- placa de caminhos */
  crossroads: {
    backdrop: 'street',
    music: 'town',
    spots: null,
    enter() {
      this.spots = Sc.signpostSpots(readyForParty());
      S.destination = null;
      say(
        readyForParty()
          ? 'Tudo pronto! Toque 4 para ir à FESTA!'
          : '1 Fábrica · 2 Mercado · 3 Cartas!'
      );
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
      blitFoot(ctx, raviPose('wave', clock), 44, 160);
      blitFoot(ctx, heroSprite(honoree().id, false), 284, 160);
    }
  },

  /* ------------------------------------------------------------ transporte */
  transport: {
    backdrop: 'street',
    music: 'town',
    spots: null,
    enter() {
      this.spots = Sc.vehicleSpots();
      say('Como vamos viajar? Escolha de 0 a 9 rodas!');
    },
    update() {},
    input(n) {
      if (n < 0 || n > 9) return;
      Audio.click();
      joyBurst(35 + (n % 5) * 62, 45 + ((n / 5) | 0) * 74);
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
    music: 'town',
    spots: null,
    enter() {
      this.beginTrip();
    },
    beginTrip() {
      const v = S.vehicle;
      S.travelX = -80;
      this.rolling = false;
      this.spots = Sc.travelSwapSpots();
      Audio.engine();
      say(
        v.wheels === 0
          ? 'A pé! Zero rodas!'
          : `${v.name}! ${v.wheels} roda${v.wheels > 1 ? 's' : ''}!`
      );

      const tripDur = 2.8;
      const tl = new Timeline();
      tl.add(0.6, null);
      if (v.wheels === 0) {
        tl.add(0.85, () => {
          showFlash(0);
          Audio.countStep(0);
        });
        tl.add(0.4, () => hideFlash());
      } else {
        addCount(tl, v.wheels, null, 0.82);
      }
      tl.add(0.2, () => {
        this.rolling = true;
        say('Lá vamos nós! (Toque 0 a 9 para trocar de veículo!)');
      });
      tl.add(tripDur * 0.45, null, (p) => {
        S.travelX = -80 + (W / 2 + 80) * easeInOut(p);
      });
      tl.add(0.45, null);
      tl.add(tripDur * 0.55, null, (p) => {
        S.travelX = W / 2 + (W / 2 + 100) * easeInOut(p);
      });
      tl.add(0.15, () => {
        if (S.destination === 'factory') go(SCENES.factoryPick);
        else if (S.destination === 'market') go(SCENES.market);
        else go(SCENES.post);
      });
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    input(n) {
      if (n < 0 || n > 9) return;
      if (S.vehicle && S.vehicle.id === VEHICLES[n].id) return;
      Audio.click();
      Audio.stopSpeech();
      hideFlash();
      S.vehicle = VEHICLES[n];
      this.beginTrip();
    },
    draw(ctx) {
      const v = S.vehicle;
      const bob = this.rolling ? wave(clock, 10, 1) : 0;
      const groundY = 158;
      const pen = getPen(ctx);

      if (v.wheels === 0) {
        blitFoot(ctx, raviPose(this.rolling ? 'walk' : 'idle', clock), S.travelX, groundY);
      } else {
        const sprite = SPR.vehicle[v.id];
        const vx = Math.round(S.travelX - sprite.w / 2);
        const vy = groundY - sprite.h + bob;
        blitFoot(ctx, raviPose('wave', clock), S.travelX - 4, vy + 12);
        blit(ctx, sprite, vx, vy);
      }

      if (v.wheels > 0) {
        pen.col(K.BLACK).rect(7, 27, 56, 32);
        pen.bevel(8, 28, 54, 30, K.NAVY, K.BLU, K.NIGHT);
        pen.col(K.OCHRE).hline(10, 29, 50);
        F.textCenter(ctx, 'RODAS', 35, 32, K.CYAN, { shadow: K.BLACK });
        pen.col(K.BLACK).rect(24, 41, 22, 15);
        pen.bevel(25, 42, 20, 13, K.YEL, K.YEL_L, K.OCHRE);
        const tw = F.measure(String(v.wheels), 2);
        F.text(ctx, String(v.wheels), Math.round(35 - tw / 2), 43, K.RED, {
          scale: 2,
          shadow: K.SAND
        });
      }
      if (this.spots) Sc.drawTravelSwap(ctx, this.spots, v.wheels);
    }
  },

  /* -------------------------------------------- fábrica: escolher brinquedo */
  factoryPick: {
    backdrop: 'factory',
    music: 'factory',
    spots: null,
    enter() {
      this.spots = Sc.toyColumnSpots();
      say(`Qual presente vamos fazer para ${honoree().name}? Escolha de 1 a 9!`);
    },
    update() {},
    input(n) {
      if (n < 1 || n > 9) {
        Audio.bonk();
        return;
      }
      Audio.click();
      joyBurst(160, 80);
      S.present = TOYS[n - 1];
      go(SCENES.factoryBelt);
    },
    draw(ctx) {
      Sc.drawToyColumn(ctx, this.spots, S.made);
      blitFoot(ctx, raviPose('wave', clock), 68, 160);
    }
  },

  /* ------------------------------------------------ fábrica: esteira/transformações/empacotadora */
  factoryBelt: {
    backdrop: 'factory',
    music: 'factory',
    spots: null,
    enter() {
      this.spots = Sc.machinePanelSpots();
      S.mold = 0;
      S.nozzleDrop = 0;
      S.beltFast = false;
      S.packStage = 0;
      S.stamps = 0;
      S.lumpX = 58;
      this.finishing = false;
      say(`Toque 1 a 9 para brincar com a massa ou 0 para acelerar a esteira!`);
    },
    finishToy() {
      if (this.finishing) return;
      this.finishing = true;
      this.spots = null;
      const toyIdx = TOYS.findIndex((t) => t.id === S.present.id) + 1;
      const tl = new Timeline();
      // Etapa 1: Prensa desce e monta o brinquedo!
      tl.add(0.45, () => {
        S.packStage = 1;
        Audio.stamp();
        say(`Montando o ${S.present.name}...`);
      });
      // Etapa 2: Empacota na caixa de presente com laço!
      tl.add(0.65, () => {
        S.packStage = 2;
        Audio.wrapRibbon();
        joyBurst(244, 88);
        say('Embrulhando na caixa de presente!');
      });
      // Etapa 3: Entrega nas mãos do Ravi!
      tl.add(0.95, () => {
        S.packStage = 3;
        S.presentDone = true;
        if (!S.made.includes(S.present.id)) S.made.push(S.present.id);
        Audio.success();
        showFlash(toyIdx);
        joyBurst(44, 118);
        say(`Presente pronto! O Ravi guardou o ${S.present.name}!`);
      });
      tl.add(1.8, null);
      tl.add(0.1, () => go(SCENES.crossroads));
      timeline = tl;
    },
    update(dt) {
      if (S.nozzleDrop > 0) S.nozzleDrop = Math.max(0, S.nozzleDrop - dt * 3.5);
      if (timeline) {
        timeline.update(dt);
        return;
      }
      // Velocidade da esteira: normal (18px/s) para dar tempo de brincar com as teclas 1..9,
      // ou turbo (95px/s) quando a criança aperta 0!
      const speed = S.beltFast ? 95 : 18;
      S.lumpX += dt * speed;
      if (S.lumpX >= 238) this.finishToy();
    },
    skip() {
      if (this.finishing) go(SCENES.crossroads);
    },
    input(n) {
      if (this.finishing) return;
      if (n === 0) {
        S.beltFast = true;
        Audio.engine();
        say('Esteira rápida ligada!');
        return;
      }
      if (n >= 1 && n <= 9) {
        S.mold = n;
        S.stamps++;
        S.nozzleDrop = 1;
        Audio.stamp();
        Audio.note(n - 1);
        joyBurst(S.lumpX, 94);
        say(`${n} — ${Sc.MOLD_NAMES[n]}!`);
      }
    },
    draw(ctx) {
      const pen = getPen(ctx);
      const lump = Math.round(S.lumpX);

      // Braço transformador suspenso no teto que desce sobre a massa quando aperta 1..9!
      const armX = Math.max(70, Math.min(220, lump));
      const drop = Math.round(S.nozzleDrop * 26);
      pen.col(K.BLACK).rect(armX - 5, 0, 10, 48 + drop);
      pen.bevel(armX - 4, 0, 8, 47 + drop, K.GRAY, K.GRAY_L, K.GRAY_D);
      Sc.raised(pen, armX - 11, 45 + drop, 22, 10, K.OCHRE, K.YEL, K.WOOD_D);
      if (S.nozzleDrop > 0.2) {
        // Raio/jato colorido de transformação atingindo a massa na esteira
        pen.col(K.YEL_L).rect(armX - 2, 55 + drop, 4, Math.max(0, 92 - (55 + drop)));
      }

      // Esteira rolante
      pen.col(K.BLACK).rect(54, 104, 194, 14);
      pen.col(K.PUR).rect(55, 105, 192, 12);
      pen.col(K.PUR_L);
      const beltSpeed = S.beltFast ? 64 : 20;
      const shift = Math.floor(clock * beltSpeed) % 12;
      for (let x = 55 - shift; x < 247; x += 12) pen.vline(Math.max(55, x), 105, 12);

      // Máquina Montadora & Empacotadora à direita
      pen.col(K.BLACK).rect(248, 24, 62, 80);
      pen.bevel(249, 25, 60, 78, K.GRAY, K.GRAY_L, K.GRAY_D);
      pen.col(K.CYAN).rect(257, 34, 44, 20);
      pen.col(K.BLACK).ellipse(270, 44, 5, 5).ellipse(288, 44, 5, 5);
      pen.col(K.WHITE).ellipse(270, 44, 3, 3).ellipse(288, 44, 3, 3);
      pen.col(K.BLACK).ellipse(270, 45, 1, 2).ellipse(288, 45, 1, 2);
      const press = this.finishing && S.packStage === 1 ? 22 : 10;
      pen.col(K.BLACK).rect(258, 60, 42, press);
      pen.col(K.GRAY_D).rect(259, 60, 40, press - 1);

      // Matéria-prima / Brinquedo / Caixa de Presente conforme a etapa
      if (!this.finishing) {
        Sc.drawMoldedMaterial(ctx, S.mold, lump, 95);
      } else if (S.packStage === 1) {
        blitMid(ctx, SPR.toy[S.present.id], 240, 92);
      } else if (S.packStage === 2) {
        blitFoot(ctx, SPR.misc.gift, 240, 104);
      }

      // Ravi à esquerda (segurando o presente embrulhado na etapa 3!)
      blitFoot(
        ctx,
        S.packStage === 3 ? raviPose('cheer', clock) : S.stamps > 0 ? raviPose('wave', clock) : raviPose('idle', clock),
        26,
        158
      );
      if (S.packStage === 3) {
        blitFoot(ctx, SPR.misc.gift, 46, 156);
        blitMid(ctx, SPR.toy[S.present.id], 46, 120);
      }

      if (this.spots) Sc.drawMachinePanel(ctx, this.spots, S.mold, S.beltFast);
    }
  },

  /* --------------------------------------------------------------- mercado */
  market: {
    backdrop: 'market',
    music: 'market',
    spots: null,
    enter() {
      S.marketIdx = 0;
      S.cart = {};
      S.flyFoodP = -1;
      this.spots = Sc.quantitySpots();
      this.ask();
    },
    ask() {
      if (S.marketIdx >= FOODS.length) {
        this.spots = null;
        const tl = new Timeline();
        tl.add(0.3, () => {
          S.marketDone = true;
          Audio.cashRegister();
          Audio.success();
          say('Compras passadas no caixa e guardadas!');
        });
        tl.add(1.6, null);
        tl.add(0.1, () => go(SCENES.crossroads));
        timeline = tl;
        return;
      }
      this.spots = Sc.quantitySpots();
      const item = FOODS[S.marketIdx];
      say(`${item.how || 'Quantos'} ${item.ask || item.name.toLowerCase()}? Toque 1 a 9!`);
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    input(n) {
      if (!this.spots) return;
      if (n < 1 || n > 9) {
        Audio.bonk();
        return;
      }
      const item = FOODS[S.marketIdx];
      S.cart[item.id] = 0;
      if (item.id === 'balloon') S.balloons = n;
      this.spots = null;

      // Como no Mickey's 123: cada item voa da prateleira para o carrinho enquanto conta 1..n!
      const tl = new Timeline();
      tl.add(0.35, () => say(`Pegando ${n} ${item.ask || item.name.toLowerCase()}!`));
      for (let i = 1; i <= n; i++) {
        tl.add(
          0.78,
          () => {
            showFlash(i);
            Audio.countStep(i);
            S.flyFoodP = 0;
          },
          (p) => {
            S.flyFoodP = p;
            if (p >= 0.95) S.cart[item.id] = i;
          }
        );
      }
      tl.add(0.35, () => {
        S.flyFoodP = -1;
        hideFlash();
        Audio.cashRegister();
        S.marketIdx++;
        timeline = null;
        this.ask();
      });
      timeline = tl;
    },
    draw(ctx) {
      blitFoot(ctx, raviPose('idle', clock), 28, 158);
      Sc.drawShoppingCart(ctx, S.cart, 88, 158);

      if (S.marketIdx < FOODS.length) {
        const item = FOODS[S.marketIdx];
        const pen = getPen(ctx);
        pen.col(K.BLACK).rect(116, 14, 78, 76);
        pen.bevel(117, 15, 76, 74, K.WOOD_D, K.OCHRE, K.GRAY_XD);
        pen.col(K.CREAM).rect(121, 19, 68, 50);
        pen.col(K.CYAN).rect(123, 21, 64, 46);
        const sprite = SPR.food[item.id];
        ctx.drawImage(sprite.canvas, 139, 26, sprite.w * 2, sprite.h * 2);
        pen.col(K.NAVY).rect(121, 71, 68, 14);
        F.textCenter(ctx, item.name, 155, 75, K.YEL_L, { shadow: K.BLACK });

        // Animação do item voando da vitrine (155, 44) até o carrinho (88, 128)
        if (S.flyFoodP >= 0 && S.flyFoodP < 1) {
          const p = S.flyFoodP;
          const fx = Math.round(155 + (88 - 155) * p);
          const fy = Math.round(44 + (128 - 44) * p - Math.sin(p * Math.PI) * 24);
          blitMid(ctx, sprite, fx, fy);
        }

        if (this.spots) Sc.drawQuantityBoard(ctx, this.spots, 'QUANTOS?');
      }
    }
  },

  /* -------------------------------------------------------------- correios */
  post: {
    backdrop: 'post',
    music: 'town',
    spots: null,
    enter() {
      this.spots = Sc.mailboxSpots();
      say(`Quem vamos convidar? (0 para voltar · Shh, ${honoree().name}!)`);
    },
    update() {},
    input(n) {
      if (n === 0) {
        S.inviteDone = S.invited.length > 0;
        if (!S.inviteDone) {
          Audio.bonk();
          say('Convide pelo menos um amigo!');
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
        say(`Shh! É surpresa para ${HEROES[idx].name}!`);
        return;
      }
      if (S.invited.includes(idx)) {
        Audio.bonk();
        say(`${HEROES[idx].name} já recebeu o convite!`);
        return;
      }
      S.invited.push(idx);
      S.inviteDone = true;
      joyBurst(40 + ((n - 1) % 5) * 61, 50);
      go(SCENES.mailman);
      SCENES.mailman.begin(idx);
    },
    draw(ctx) {
      Sc.drawMailboxes(ctx, this.spots, S);
      blitFoot(ctx, raviPose('wave', clock), 292, 162);
    }
  },

  /* -------------------------------------------------------------- carteiro entregando na casa do amigo */
  mailman: {
    backdrop: 'street',
    music: 'town',
    spots: null,
    enter() {},
    begin(idx) {
      S.mailmanX = -36;
      S.mailmanTarget = idx;
      this.delivered = false;
      const hero = HEROES[idx];
      say(`O carteiro levou o convite nº ${idx + 1} até a casa de ${hero.name}!`);
      const tl = new Timeline();
      tl.add(0.25, () => {
        showFlash(idx + 1);
        Audio.note(idx);
      });
      tl.add(1.3, null, (p) => {
        S.mailmanX = -36 + 216 * easeOut(p);
      });
      tl.add(0.7, () => {
        this.delivered = true;
        hideFlash();
        Audio.pop();
        joyBurst(248, 92);
      });
      tl.add(0.6, null, (p) => {
        S.mailmanX = 180 + 165 * p;
      });
      tl.add(0.1, () => go(SCENES.post));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      go(SCENES.post);
    },
    draw(ctx) {
      const pen = getPen(ctx);
      const hero = HEROES[S.mailmanTarget] || HEROES[0];

      // Placa com o número da casa do amigo convidado (à direita da rua)
      Sc.raised(pen, 240, 26, 56, 20, K.YEL, K.YEL_L, K.OCHRE);
      F.textCenter(ctx, `CASA ${S.mailmanTarget + 1}`, 268, 32, K.RED, { shadow: K.SAND });

      // Amigo convidado esperando feliz na porta da casa da direita
      blitFoot(ctx, heroSprite(hero.id, this.delivered), 248, 126);
      if (this.delivered) {
        blit(ctx, SPR.misc.envelope, 232, 96);
      }

      // Carteiro pedalando pela rua
      const bob = hop(clock, 10, 1);
      blitFoot(ctx, SPR.misc.mailman, S.mailmanX, 158 - bob);
      if (!this.delivered) {
        blit(ctx, SPR.misc.envelope, Math.round(S.mailmanX + 14), 112 - bob);
      }
    }
  },

  /* ------------------------------------------------ festa: preparar a casa */
  partyPrep: {
    backdrop: 'party',
    music: 'party',
    spots: null,
    enter() {
      S.balloonsHung = 0;
      S.bannerUp = false;
      S.fridgeFull = false;
      S.guestsIn = 0;
      S.giftOpened = false;
      S.giftPop = 0;
      // Inicializa o estoque da geladeira exatamente com a quantidade comprada no mercado
      S.stock = {};
      for (const food of FOODS) {
        if (food.id !== 'balloon') {
          S.stock[food.id] = S.cart[food.id] || 0;
        }
      }
      Audio.party();
      say('Hora de arrumar a casa para a festa!');

      const tl = new Timeline();
      tl.add(1.1, () => {
        S.fridgeFull = true;
        Audio.pop();
        say('Guardando as compras na geladeira...');
      });
      tl.add(1.0, () => {
        S.bannerUp = true;
        Audio.magic();
        say('Faixa: SURPRESA!');
      });
      const balloons = S.balloons || 0;
      if (balloons > 0) {
        tl.add(0.3, () =>
          say(`Compramos ${balloons} ${balloons === 1 ? 'balão' : 'balões'}! Vamos pendurar!`)
        );
        addCount(
          tl,
          balloons,
          (i) => {
            S.balloonsHung = i;
          },
          0.82
        );
      }
      tl.add(0.25, () =>
        say(
          S.invited.length > 0
            ? `Shh... ${S.invited.length === 1 ? 'o convidado está' : 'os ' + S.invited.length + ' convidados estão'} chegando!`
            : 'Shh... o aniversariante está chegando!'
        )
      );
      tl.add(1.0, null);
      tl.add(0.1, () => go(SCENES.partyArrive));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      S.fridgeFull = true;
      S.bannerUp = true;
      S.balloonsHung = S.balloons || 0;
      go(SCENES.partyArrive);
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('wave', clock), 28, 160);
    }
  },

  /* ------------------------------------------------- festa: chegada e surpresa */
  partyArrive: {
    backdrop: 'party',
    music: 'party',
    spots: null,
    enter() {
      S.guestsIn = 0;
      S.giftOpened = false;
      S.giftPop = 0;
      // Só entram os amigos que você realmente convidou nos correios + o aniversariante!
      S.guestX = layoutGuests(S.invited.length + 1);
      const tl = new Timeline();
      for (let i = 0; i < S.invited.length; i++) {
        const guestHero = HEROES[S.invited[i]];
        tl.add(0.65, () => {
          S.guestsIn = i + 1;
          Audio.pop();
          joyBurst(S.guestX[i] || 160, 90);
          if (guestHero) say(`${guestHero.name} chegou!`);
        });
      }
      tl.add(0.65, () => {
        S.guestsIn = S.invited.length + 1;
        Audio.click();
      });
      tl.add(0.25, () => {
        Audio.fanfare();
        say(`SURPRESA, ${honoree().name}!`);
      });
      tl.add(1.7, null);
      if (S.present) {
        tl.add(
          1.2,
          () => {
            S.giftOpened = true;
            Audio.magic();
            say(`${honoree().name} abriu o presente: um ${S.present.name}!`);
          },
          (p) => {
            S.giftPop = p;
          }
        );
      }
      tl.add(0.25, () => {
        if (boughtFoods().length === 0) go(SCENES.partyEnd);
        else go(SCENES.partyServe);
      });
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      S.guestsIn = S.invited.length + 1;
      S.giftOpened = true;
      S.giftPop = 1;
      if (boughtFoods().length === 0) go(SCENES.partyEnd);
      else go(SCENES.partyServe);
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx, 0, S.guestsIn > S.invited.length);
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('cheer', clock), 28, 160);
      if (S.guestsIn > S.invited.length) {
        Sc.drawConfetti(ctx, S.confetti, clock);
      }
    }
  },

  /* ------------------------------------------------------- festa: servir respeitando o estoque comprado */
  partyServe: {
    backdrop: 'party',
    music: 'party',
    spots: null,
    enter() {
      const menu = boughtFoods();
      const roster = partyRoster();
      // Garante que o estoque reflita as compras caso pule direto para a cena
      if (!S.stock || Object.keys(S.stock).length === 0) {
        S.stock = {};
        for (const food of menu) S.stock[food.id] = S.cart[food.id] || 0;
      }
      S.serveQueue = [];
      for (const food of menu) {
        for (const heroIdx of roster) {
          S.serveQueue.push({ heroIdx, food });
        }
      }
      S.serveStep = 0;
      S.servePlacing = 0;
      S.serveHero = -1;
      S.serveFoodId = null;
      S.served = {};
      S.guestsIn = S.invited.length + 1;
      S.guestX = layoutGuests(S.invited.length + 1);
      this.spots = Sc.plateSpots();
      this.ask();
    },
    ask() {
      // Pula automaticamente itens cujo estoque comprado já acabou!
      while (S.serveStep < S.serveQueue.length) {
        const nextFood = S.serveQueue[S.serveStep].food;
        if ((S.stock[nextFood.id] || 0) > 0) break;
        S.serveStep++;
      }

      if (S.serveQueue.length === 0 || S.serveStep >= S.serveQueue.length) {
        this.spots = null;
        S.servePlacing = 0;
        S.serveHero = -1;
        S.serveFoodId = null;
        const tl = new Timeline();
        tl.add(0.5, () => say('Servimos as comidas da festa!'));
        tl.add(1.4, null);
        tl.add(0.1, () => go(SCENES.partyEnd));
        timeline = tl;
        return;
      }
      const { heroIdx, food } = S.serveQueue[S.serveStep];
      const hero = HEROES[heroIdx];
      const avail = S.stock[food.id] || 0;
      this.food = food;
      S.serveHero = heroIdx;
      S.serveFoodId = food.id;
      S.servePlacing = 0;
      this.spots = Sc.plateSpots();
      const how = food.how || 'Quantos';
      say(
        `${how} ${food.ask || food.name.toLowerCase()} para ${hero.name}? (Temos ${avail}!)`
      );
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    input(n) {
      if (!this.spots) return;
      if (n < 1 || n > 9) {
        Audio.bonk();
        return;
      }
      const { heroIdx, food } = S.serveQueue[S.serveStep];
      const hero = HEROES[heroIdx];
      const avail = S.stock[food.id] || 0;

      // Não permite servir mais do que a quantidade que sobrou na geladeira!
      if (n > avail) {
        Audio.bonk();
        say(
          `Só temos ${avail} ${avail === 1 ? food.name.toLowerCase() : food.ask}! Escolha de 1 a ${avail}!`
        );
        return;
      }

      this.spots = null;

      const tl = new Timeline();
      addCount(
        tl,
        n,
        (i) => {
          S.servePlacing = i;
        },
        0.75
      );
      tl.add(0.45, () => {
        if (!S.served[heroIdx]) S.served[heroIdx] = {};
        S.served[heroIdx][food.id] = n;
        S.stock[food.id] = Math.max(0, avail - n);
        S.servePlacing = 0;
        const left = S.stock[food.id];
        say(
          left > 0
            ? `${n} para ${hero.name}! (Restam ${left})`
            : `${n} para ${hero.name}! Acabou ${food.name.toLowerCase()}!`
        );
      });
      tl.add(0.65, () => {
        S.serveStep++;
        timeline = null;
        this.ask();
      });
      timeline = tl;
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx, 0, false);
      drawGuestMeals(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('wave', clock), 22, 158);
      if (this.spots && this.food) {
        const avail = Math.max(0, (S.stock[this.food.id] || 0) - S.servePlacing);
        Sc.drawPlates(ctx, this.spots, this.food, S.stock[this.food.id] || 0);
        // Mostrador claro do estoque restante do item atual acima da geladeira
        const pen = getPen(ctx);
        Sc.raised(pen, 4, 38, 54, 17, K.NAVY, K.BLU, K.NIGHT);
        blitMid(ctx, SPR.food[this.food.id], 15, 46);
        F.text(ctx, `×${avail}`, 26, 43, K.YEL_L, { shadow: K.BLACK });
      }
    }
  },

  /* ------------------------------------------------------------ festa: fim */
  partyEnd: {
    backdrop: 'party',
    music: 'party',
    spots: null,
    enter() {
      this.leave = 0;
      Audio.party();
      say('Que festa boa! Todos estão dançando!');
      const tl = new Timeline();
      tl.add(2.6, null, (p) => {
        this.leave = p;
      });
      tl.add(0.2, () => {
        Audio.success();
        say('Toque um número para preparar outra festa!');
      });
      tl.add(1.0, null);
      tl.add(0.1, () => {
        this.done = true;
        this.spots = [{ n: 1, x: 0, y: 0, w: W, h: STAGE_H }];
      });
      timeline = tl;
      this.done = false;
      this.spots = null;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      this.done = true;
      this.leave = 1;
      this.spots = [{ n: 1, x: 0, y: 0, w: W, h: STAGE_H }];
      timeline = null;
    },
    input() {
      if (!this.done) return;
      restart();
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx, Math.round(this.leave * 210), true);
      drawGuestMeals(ctx, Math.round(this.leave * 210));
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('cheer', clock), 28, 160);
      Sc.drawConfetti(ctx, S.confetti, clock);

      if (this.done) {
        const pen = getPen(ctx);
        pen.col(K.BLACK).rect(46, 48, 228, 66);
        pen.bevel(48, 50, 224, 62, K.NAVY, K.BLU, K.NIGHT);
        pen.col(K.OCHRE).frame(50, 52, 220, 58);
        pen.col(K.YEL).frame(51, 53, 218, 56);
        F.textCenter(ctx, 'FIM DA FESTA!', 160, 62, K.YEL_L, {
          scale: 2,
          shadow: K.RED_D
        });
        F.textCenter(ctx, 'TOQUE PARA RECOMEÇAR', 160, 92, K.WHITE, { shadow: K.BLACK });
      }
    }
  }
};

/* --------------------------------------------------------------------------
   Desenho compartilhado da sala de festa
   -------------------------------------------------------------------------- */

const GUEST_FOOT_Y = 140;
const GUEST_SCALE = 1.45;

function layoutGuests(count) {
  const xs = [];
  const spread = Math.min(44, 190 / Math.max(count, 1));
  const start = 172 - ((count - 1) * spread) / 2;
  for (let i = 0; i < count; i++) xs.push(Math.round(start + i * spread));
  return xs;
}

function drawPartyBack(ctx) {
  const pen = getPen(ctx);

  // Geladeira com o estoque real que ainda resta de cada comida comprada!
  pen.col(K.BLACK).rect(7, 58, 38, 72);
  pen.bevel(8, 59, 36, 70, K.WHITE, K.GRAY_L, K.GRAY);
  pen.col(K.GRAY_L).hline(10, 88, 32);
  pen.col(K.CYAN).rect(12, 63, 24, 22);
  pen.col(K.WHITE).hline(13, 64, 10);
  pen.col(K.GRAY_D).rect(39, 68, 3, 14).rect(39, 102, 3, 14);
  if (S.fridgeFull) {
    const foods = boughtFoods();
    let slot = 0;
    for (const food of foods) {
      let rem =
        S.stock && S.stock[food.id] !== undefined
          ? S.stock[food.id]
          : S.cart[food.id] || 0;
      if (food.id === S.serveFoodId && S.servePlacing > 0) {
        rem = Math.max(0, rem - S.servePlacing);
      }
      if (rem <= 0) continue;
      const col = slot % 2;
      const row = (slot / 2) | 0;
      const fx = 16 + col * 15;
      const fy = 98 + row * 15;
      blitMid(ctx, SPR.food[food.id], fx, fy);
      F.text(ctx, String(rem), fx + 2, fy - 7, K.RED, { shadow: K.WHITE });
      slot++;
    }
  }

  // Faixa SURPRESA!
  if (S.bannerUp) {
    const bw = 152;
    const bh = 22;
    const bx = Math.round((W - bw) / 2);
    pen.col(K.CREAM).line(bx - 8, 2, bx, 8).line(bx + bw, 8, bx + bw + 8, 2);
    pen.col(K.BLACK).rect(bx - 2, 4, bw + 4, bh + 4);
    pen.bevel(bx, 6, bw, bh, K.YEL, K.YEL_L, K.OCHRE);
    F.textCenter(ctx, 'SURPRESA!', 160, 11, K.RED, {
      scale: 2,
      shadow: K.SAND
    });
  }

  Sc.drawBalloons(ctx, S.balloonsHung, clock);
}

function drawPartyFront(ctx) {
  blitFoot(ctx, SPR.misc.cake, 72, 148);
  if (S.presentDone && S.present) {
    const gx = 278;
    const gy = 148;
    blitFoot(ctx, SPR.misc.gift, gx, gy);
    if (S.giftOpened) {
      const lift = Math.round(18 * easeOut(S.giftPop));
      blitMid(ctx, SPR.toy[S.present.id], gx, gy - 20 - lift);
    }
  }
}

function drawGuestMeals(ctx, offsetX = 0) {
  const pen = getPen(ctx);
  const menu = boughtFoods();
  for (let i = 0; i < S.guestsIn && i < S.guestX.length; i++) {
    const isHonoree = i >= S.invited.length;
    const hi = isHonoree ? S.honoree : S.invited[i];
    const x = S.guestX[i] + offsetX;
    const plateY = GUEST_FOOT_Y - 1;
    const active = S.serveHero === hi;

    pen.col(K.BLACK).ellipse(x + 1, plateY + 1, 15, 5);
    pen.col(active ? K.YEL_L : K.GRAY_L).ellipse(x, plateY, 14, 4);
    pen.col(K.CREAM).ellipse(x, plateY, 11, 3);

    const bag = S.served[hi] || {};
    let slot = 0;
    for (const food of menu) {
      let qty = bag[food.id] || 0;
      if (hi === S.serveHero && food.id === S.serveFoodId && S.servePlacing > 0) {
        qty = S.servePlacing;
      }
      if (qty <= 0) continue;
      const fx = x - 10 + (slot % 3) * 8;
      const fy = plateY - 2 - ((slot / 3) | 0) * 8;
      blitMid(ctx, SPR.food[food.id], fx, fy);
      if (qty > 1) {
        F.text(ctx, String(qty), fx + 3, fy - 7, K.RED, { shadow: K.WHITE });
      }
      slot++;
    }
  }
}

function blitFootScaled(ctx, sprite, x, y, scale) {
  if (!sprite) return;
  const w = Math.round(sprite.w * scale);
  const h = Math.round(sprite.h * scale);
  ctx.drawImage(sprite.canvas, (x - (w >> 1)) | 0, (y - h) | 0, w, h);
}

function drawGuests(ctx, offsetX = 0, dancing = false) {
  const pen = getPen(ctx);
  for (let i = 0; i < S.guestsIn && i < S.guestX.length; i++) {
    const isHonoree = i >= S.invited.length;
    const hi = isHonoree ? S.honoree : S.invited[i];
    const hero = HEROES[hi];
    if (!hero) continue;
    const sprite = heroSprite(hero.id, dancing);
    const phase = i * 1.7;
    const danceY = dancing ? hop(clock, 4.5, 4, phase) : 0;
    const x = S.guestX[i] + offsetX;
    const footY = GUEST_FOOT_Y - danceY;
    const h = Math.round((sprite?.h || 46) * GUEST_SCALE);

    pen.col(K.BLACK).ellipse(x, GUEST_FOOT_Y + 1, 12, 3);
    blitFootScaled(ctx, sprite, x, footY, GUEST_SCALE);

    // Crachá indicando de quem é a vez de receber comida (ou o aniversariante)
    const serving = S.serveHero === hi;
    if (serving || (isHonoree && S.serveHero === -1)) {
      const tagY = Math.max(32, footY - h - 13);
      const label = hero.short;
      const tw = F.measure(label, 1);
      const tagW = tw + 8;
      const tagX = x - (tagW >> 1);
      pen.col(K.BLACK).rect(tagX - 1, tagY - 1, tagW + 2, 12);
      pen.bevel(tagX, tagY, tagW, 10, K.YEL, K.YEL_L, K.OCHRE);
      F.text(ctx, label, x - (tw >> 1), tagY + 2, K.RED, { shadow: K.SAND });
    }
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

export function handleNumber(n) {
  Audio.init();
  if (n === -2) {
    Audio.repeatLast();
    return;
  }
  if (n >= 0 && scene && scene.input) {
    scene.input(n);
    return;
  }
  if (scene && scene.skip) {
    Audio.pop();
    joyBurst();
    scene.skip();
    return;
  }
  Audio.pop();
  joyBurst();
}

export function update(dt) {
  clock += dt;
  if (S.flash !== null && S.flashPop < 1) {
    S.flashPop = Math.min(1, S.flashPop + dt * 5);
  }
  if (scene && scene.update) scene.update(dt);
}

export function draw(ctx) {
  try {
    ctx.drawImage(Sc.backdrop(scene.backdrop), 0, 0);
    Sc.drawAmbient(ctx, scene.backdrop, clock);
    if (scene.draw) scene.draw(ctx);
    Sc.drawPops(ctx, S.pops, clock);
    if (S.flash !== null) Sc.flashcard(ctx, S.flash, S.flashPop);
    Sc.speechBar(ctx, S.message);
  } catch (err) {
    console.error('ravi draw', err);
  }
}

export function getClock() {
  return clock;
}

export function debugApi() {
  return {
    go(name) {
      if (SCENES[name]) go(SCENES[name]);
    },
    ready() {
      S.presentDone = true;
      S.marketDone = true;
      S.inviteDone = S.invited.length > 0;
      if (Object.keys(S.cart).length === 0) {
        S.cart = { burger: 4, fries: 3, apple: 5, milk: 4, balloon: 4 };
        S.balloons = 4;
      }
      if (!S.present) {
        S.present = TOYS[0];
        S.made = ['urso'];
      }
    },
    scene() {
      return Object.keys(SCENES).find((k) => SCENES[k] === scene) || '';
    },
    force(frames = 30) {
      const c = getContext();
      for (let i = 0; i < frames; i++) {
        update(1 / 60);
        if (c) draw(c);
      }
    }
  };
}
