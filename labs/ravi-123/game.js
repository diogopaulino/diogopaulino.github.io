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
import { SPR, HEROES, TOYS, FOODS, VEHICLES, buildSprites, raviPose, heroSprite } from './sprites.js';
import * as Sc from './scenes.js';
import { wave, hop } from './anim.js';

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
    servePlacing: 0,
    serveHero: -1,
    serveFoodId: null,
    served: {},
    guestsIn: 0,
    balloonsHung: 0,
    bannerUp: false,
    fridgeFull: false,
    guestX: [],
    confetti: Sc.makeConfetti(90),
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

/** Comidas efetivamente compradas (balão não é comida). */
function boughtFoods() {
  return FOODS.filter((f) => f.id !== 'balloon' && (S.cart[f.id] || 0) > 0);
}

/**
 * Lista de quem come na festa: convidados + aniversariante.
 * No Mickey 123 cada personagem recebe cada item comprado.
 */
function partyRoster() {
  return S.invited.concat(S.honoree);
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
function addCount(tl, n, onStep, stepDur = 0.95) {
  for (let i = 1; i <= n; i++) {
    tl.add(stepDur, () => {
      showFlash(i);
      Audio.countStep(i);
      Sc.spawnPops(S.pops, 160, 70, clock);
      if (onStep) onStep(i);
    });
  }
  tl.add(0.45, () => hideFlash());
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
    spots.push({ n: i + 1, x: 8 + i * 35, y: 36, w: 32, h: 50 });
  }
  return spots;
}

function extraHop() {
  return S.joy && (clock - S.joy) < 0.35 ? 4 : 0;
}

const SCENES = {
  /* ---------------------------------------------------------------- título */
  title: {
    backdrop: 'houseNight',
    spots: null,
    enter() {
      this.spots = titleSpots();
      say('Toque um número!');
    },
    update() {},
    input(n) {
      joyBurst(20 + (n ? n : 3) * 32, 60);
      go(SCENES.dream);
      SCENES.dream.begin(n === 0 ? 3 : n);
    },
    draw(ctx) {
      const pen = new Pen(ctx);
      const snore = hop(clock, 1.6, 2);
      const sleep = raviPose('sleep', clock);
      const sw = Math.round(sleep.w * 1.4);
      const sh = Math.round(sleep.h * 1.4);
      ctx.drawImage(sleep.canvas, 148 - (sw >> 1), 154 + snore - sh, sw, sh);
      const zz = ((clock * 1.2) % 3);
      F.text(ctx, 'z', 168, 108 - Math.round(zz * 8), K.CYAN, { scale: 1 + (zz > 1.5 ? 1 : 0), shadow: K.BLACK });
      F.text(ctx, 'z', 178, 98 - Math.round(zz * 6), K.BLU_L, { shadow: K.BLACK });

      const breathe = hop(clock, 1.2, 1);
      pen.col(K.BLACK).rect(36, 2 + 2, 248, 28);
      pen.bevel(38, 2, 244, 28, K.NAVY, K.BLU, K.NIGHT);
      pen.col(K.OCHRE).frame(40, 4, 240, 24);
      F.textCenter(ctx, 'RAVI  1·2·3', 160, 8 - breathe, K.YEL_L, { scale: 2, shadow: K.RED_D });
      F.textCenter(ctx, 'A GRANDE FESTA', 160, 20, K.WHITE, { shadow: K.BLACK });

      for (const spot of this.spots) {
        const bob = wave(clock, 2.1, 4, spot.n * 0.9);
        const sway = wave(clock, 1.5, 3, spot.n);
        const cx = spot.x + spot.w / 2 + sway;
        const cy = spot.y + 16 + bob;
        const color = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.ORANGE, K.CYAN, K.PUR, K.RED_L][spot.n - 1];
        pen.col(K.BLACK).ellipse(cx + 1, cy + 2, 13, 14);
        pen.col(K.BLACK).ellipse(cx, cy, 14, 16);
        pen.col(color).ellipse(cx, cy, 13, 15);
        pen.col(K.WHITE).ellipse(cx - 4, cy - 5, 3, 4);
        pen.col(K.BLACK).px(cx, cy + 15);
        pen.col(color).px(cx, cy + 16);
        pen.col(K.CREAM);
        pen.line(cx, cy + 17, spot.x + spot.w / 2, spot.y + 48);
        const label = String(spot.n);
        const tw = F.measure(label, 2);
        pen.col(K.CREAM).rect(Math.round(cx - tw / 2 - 3), cy - 9, tw + 6, 14);
        pen.col(K.WHITE).hline(Math.round(cx - tw / 2 - 2), cy - 8, tw + 4);
        F.text(ctx, label, Math.round(cx - tw / 2), cy - 8, K.RED, { scale: 2, shadow: K.SAND });
      }
    }
  },

  /* ----------------------------------------------------------------- sonho */
  dream: {
    backdrop: 'field',
    spots: null,
    begin(n) {
      S.sheep = [];
      say(`Vamos contar ${n} carneirinho${n > 1 ? 's' : ''}!`);
      const tl = new Timeline();
      tl.add(1.1, () => {});
      addCount(tl, n, (i) => {
        S.sheep.push({ born: clock, i });
        Audio.sheep();
      }, 1.05);
      tl.add(0.8, () => {
        Audio.magic();
        say('Bom dia! Vamos fazer uma festa!');
      });
      tl.add(2.2, null);
      tl.add(0.1, () => go(SCENES.wake));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    draw(ctx) {
      const pen = new Pen(ctx);
      const snore = hop(clock, 1.5, 2);
      blitFoot(ctx, SPR.ravi.sleep, 40, 160 + snore);
      // Zzz
      const zz = (clock * 1.4) % 2.5;
      F.text(ctx, 'z', 58, 110 - Math.round(zz * 10), K.WHITE, { shadow: K.BLACK });

      for (const sh of S.sheep) {
        const age = clock - sh.born;
        const x = -24 + age * 95;
        if (x > W + 28) continue;
        // Arco sobre a cerca + “squash” no pouso
        const along = Math.min(1, Math.max(0, (x - 30) / 220));
        const jump = Math.sin(along * Math.PI) * 30;
        const squash = jump < 4 && along > 0.85 ? 1 : 0;
        const foot = 142 - jump + squash;
        blitFoot(ctx, SPR.misc.sheep, x, foot);
        // Nuvenzinha de poeira ao pousar
        if (squash) {
          pen.col(K.GRAY_L).px(x - 6, foot).px(x + 6, foot).px(x, foot + 1);
        }
      }
    }
  },

  /* ---------------------------------------------------------- acordar */
  wake: {
    backdrop: 'houseDay',
    spots: null,
    enter() {
      const h = honoree();
      say(`A festa é para ${h.name}!`);
      const tl = new Timeline();
      tl.add(1.6, () => Audio.fanfare());
      tl.add(0.2, () => say('Toque para escolher o caminho!'));
      tl.add(2.2, null);
      tl.add(0.1, () => go(SCENES.crossroads));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() { go(SCENES.crossroads); },
    draw(ctx) {
      const pen = new Pen(ctx);
      const bounce = hop(clock, 3.2, 3) + extraHop();
      blitFoot(ctx, raviPose('cheer', clock), 110, 160 - bounce);
      // Balão de pensamento com moldura e pop suave
      const pop = 0.9 + hop(clock, 2, 1) * 0.02;
      const brx = Math.round(48 * pop);
      const bry = Math.round(40 * pop);
      pen.col(K.BLACK).ellipse(224, 62, brx + 2, bry + 2);
      pen.col(K.NAVY).ellipse(224, 62, brx + 1, bry + 1);
      pen.col(K.WHITE).ellipse(224, 62, brx - 1, bry - 1);
      pen.col(K.CREAM).ellipse(224, 62, brx - 3, bry - 3);
      // Rabicho
      pen.col(K.BLACK).ellipse(180, 100, 7, 6).ellipse(168, 112, 5, 4);
      pen.col(K.WHITE).ellipse(180, 100, 5, 4).ellipse(168, 112, 3, 2);
      blitFoot(ctx, SPR.hero[honoree().id], 224, 88);
      // Plaquinha do nome
      const name = honoree().name;
      const tw = F.measure(name, 1);
      pen.col(K.BLACK).rect(224 - (tw >> 1) - 4, 28, tw + 8, 12);
      pen.bevel(224 - (tw >> 1) - 3, 29, tw + 6, 10, K.YEL, K.YEL_L, K.OCHRE);
      F.textCenter(ctx, name, 224, 31, K.RED, { shadow: K.SAND });
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
        ? 'Tudo pronto! Toque 4 — festa!'
        : 'Toque 1, 2 ou 3!');
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
      Sc.drawSignpost(ctx, this.spots, S, clock);
      blitFoot(ctx, raviPose('wave', clock), 40, 160 - hop(clock, 2.8, 2) - extraHop());
      blitFoot(ctx, heroSprite(honoree().id, true), 288, 160 - hop(clock, 2.4, 2, 1));
    }
  },

  /* ------------------------------------------------------------ transporte */
  transport: {
    backdrop: 'street',
    spots: null,
    enter() {
      this.spots = Sc.vehicleSpots();
      say('Qual veículo? Toque 0 a 9!');
    },
    update() {},
    input(n) {
      if (n < 0 || n > 9) return;
      Audio.click();
      joyBurst(40 + (n % 5) * 60, 50);
      S.vehicle = VEHICLES[n];
      go(SCENES.travel);
    },
    draw(ctx) {
      Sc.drawVehicleRack(ctx, this.spots, clock);
    }
  },

  /* ---------------------------------------------------------------- viagem */
  travel: {
    backdrop: 'street',
    spots: null,
    enter() {
      this.beginTrip();
    },
    /** Como no Mickey's 123: dá para trocar o meio de transporte no caminho. */
    beginTrip() {
      const v = S.vehicle;
      S.travelX = -80;
      this.rolling = false;
      this.spots = Sc.travelSwapSpots();
      Audio.engine();
      say(v.wheels === 0
        ? 'A pé! Zero rodas!'
        : `${v.name}! ${v.wheels} roda${v.wheels > 1 ? 's' : ''}!`);

      const tripDur = 4.4;
      const tl = new Timeline();
      tl.add(0.8, null);
      if (v.wheels === 0) {
        tl.add(1.0, () => { showFlash(0); Audio.countStep(0); });
        tl.add(0.5, () => hideFlash());
      } else {
        addCount(tl, v.wheels, null, 0.9);
      }
      tl.add(0.25, () => {
        this.rolling = true;
        say('Lá vamos nós!');
      });
      tl.add(tripDur * 0.45, null, (p) => {
        S.travelX = -80 + (W / 2 + 80) * easeInOut(p);
      });
      tl.add(0.7, null);
      tl.add(tripDur * 0.55, null, (p) => {
        S.travelX = W / 2 + (W / 2 + 100) * easeInOut(p);
      });
      tl.add(0.2, () => {
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
      const bob = this.rolling ? wave(clock, 9, 2) : 0;
      const groundY = 158;
      const pen = new Pen(ctx);

      // Trilha / poeira quando rola
      if (this.rolling && v.wheels > 0) {
        const dust = ((clock * 14) | 0) % 5;
        pen.col(K.GRAY);
        for (let i = 0; i < 3; i++) {
          pen.px(
            Math.round(S.travelX - 18 - i * 6 - dust),
            groundY - 2 - ((clock * 10 + i * 3) | 0) % 3
          );
        }
      }

      if (v.wheels === 0) {
        blitFoot(ctx, raviPose(this.rolling ? 'walk' : 'idle', clock), S.travelX, groundY);
      } else {
        const sprite = SPR.vehicle[v.id];
        const vx = Math.round(S.travelX - sprite.w / 2);
        const vy = groundY - sprite.h + bob;
        blit(ctx, sprite, vx, vy);
        // “Rodas girando”: tracinhos no aro
        if (this.rolling) {
          const spin = ((clock * 16) | 0) % 4;
          pen.col(K.YEL_L);
          const wy = groundY - 3 + bob;
          for (let i = 0; i < Math.min(v.wheels, 6); i++) {
            const wx = vx + 6 + Math.round((i * (sprite.w - 12)) / Math.max(1, Math.min(v.wheels, 6) - 1));
            if (spin === i % 4) pen.px(wx, wy);
          }
        }
        blitFoot(ctx, raviPose('wave', clock), S.travelX - 4, vy + 10);
      }
      if (v.wheels > 0) {
        pen.col(K.BLACK).rect(7, 27, 56, 30);
        pen.bevel(8, 28, 54, 28, K.NAVY, K.BLU, K.NIGHT);
        pen.col(K.OCHRE).hline(10, 29, 50);
        F.text(ctx, 'RODAS', 14, 32, K.CYAN, { shadow: K.BLACK });
        // Badge do número
        pen.col(K.BLACK).rect(28, 40, 22, 14);
        pen.bevel(29, 41, 20, 12, K.YEL, K.YEL_L, K.OCHRE);
        const tw = F.measure(String(v.wheels), 2);
        F.text(ctx, String(v.wheels), Math.round(39 - tw / 2), 42, K.RED, { scale: 2, shadow: K.SAND });
      }
      if (this.spots) Sc.drawTravelSwap(ctx, this.spots, v.wheels);
    }
  },

  /* -------------------------------------------- fábrica: escolher brinquedo */
  factoryPick: {
    backdrop: 'factory',
    spots: null,
    enter() {
      this.spots = Sc.toyColumnSpots();
      say('Qual presente? Toque 1 a 9!');
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
      Sc.drawToyColumn(ctx, this.spots, S.made, clock);
      blitFoot(ctx, raviPose('idle', clock), 68, 160 - extraHop());
    }
  },

  /* ------------------------------------------------ fábrica: esteira/prensa */
  factoryBelt: {
    backdrop: 'factory',
    spots: null,
    enter() {
      this.spots = Sc.machinePanelSpots();
      S.mold = 0;
      S.stamps = 0;
      S.lumpX = 62;
      this.finishing = false;
      say(`Vamos fazer o ${S.present.name}! Toque, toque, toque!`);
    },
    finishToy() {
      if (this.finishing) return;
      this.finishing = true;
      this.spots = null;
      const tl = new Timeline();
      tl.add(0.35, () => Audio.stamp());
      tl.add(0.7, () => {
        S.presentDone = true;
        if (!S.made.includes(S.present.id)) S.made.push(S.present.id);
        Audio.success();
        showFlash(TOYS.findIndex((t) => t.id === S.present.id) + 1);
        say(`Pronto! Um ${S.present.name}!`);
        joyBurst(S.lumpX, 90);
      });
      tl.add(1.8, null);
      tl.add(0.1, () => go(SCENES.crossroads));
      timeline = tl;
    },
    update(dt) {
      if (timeline) {
        timeline.update(dt);
        return;
      }
      S.lumpX += dt * (28 + S.stamps * 10);
      if (S.lumpX >= 238) this.finishToy();
    },
    input(n) {
      if (this.finishing) return;
      if (n >= 1 && n <= 9) {
        S.mold = n;
        S.stamps++;
        Audio.stamp();
        joyBurst(S.lumpX, 96);
        if (S.stamps >= 3) this.finishToy();
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

      // Prensa — pistão sobe/desce; bate forte ao carimbar
      pen.col(K.BLACK).rect(248, 26, 60, 78);
      pen.bevel(249, 27, 58, 76, K.GRAY, K.GRAY_L, K.GRAY_D);
      pen.col(K.CYAN).rect(257, 36, 42, 20);
      pen.col(K.BLACK).ellipse(269, 46, 5, 5).ellipse(287, 46, 5, 5);
      pen.col(K.WHITE).ellipse(269, 46, 3, 3).ellipse(287, 46, 3, 3);
      pen.col(K.BLACK).ellipse(269, 47, 1, 2).ellipse(287, 47, 1, 2);
      const press = this.finishing
        ? 12 + hop(clock, 10, 14)
        : 10 + hop(clock, 1.2, 2);
      pen.col(K.BLACK).rect(258, 62, 40, press);
      pen.col(K.GRAY_D).rect(259, 62, 38, press - 1);

      // Massa / brinquedo na esteira
      const lump = Math.round(S.lumpX);
      const lumpBob = hop(clock, 8, 1);
      if (S.presentDone && this.finishing) {
        blitMid(ctx, SPR.toy[S.present.id], lump, 96 - lumpBob);
      } else {
        pen.col(K.BLACK).ellipse(lump, 96, 10, 8);
        pen.col(K.GRAY).ellipse(lump, 96, 9, 7);
        pen.col(K.GRAY_L).ellipse(lump - 3, 93, 3, 2);
        if (S.mold > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, S.stamps / 3);
          blitMid(ctx, SPR.toy[S.present.id], lump, 96 - lumpBob);
          ctx.restore();
        }
      }

      const raviBob = hop(clock, 2.8, 2) + extraHop();
      blitFoot(ctx, S.stamps > 0 ? raviPose('wave', clock) : raviPose('idle', clock), 26, 158 - raviBob);
      if (this.spots) Sc.drawMachinePanel(ctx, this.spots, S.mold, clock);
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
        tl.add(0.3, () => {
          S.marketDone = true;
          Audio.success();
          say('Compras prontas!');
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
      tl.add(0.5, () => say(`${n} ${item.ask || item.name.toLowerCase()}!`));
      addCount(tl, n, null);
      tl.add(0.25, () => {
        S.marketIdx++;
        timeline = null;
        this.ask();
      });
      timeline = tl;
    },
    draw(ctx) {
      // Ravi empurra o carrinho; as compras ficam DENTRO do cesto
      const push = hop(clock, 3.5, 1);
      blitFoot(ctx, raviPose('idle', clock), 28, 158 - push - extraHop());
      Sc.drawShoppingCart(ctx, S.cart, 88, 158 - push, clock);

      if (S.marketIdx < FOODS.length) {
        const item = FOODS[S.marketIdx];
        const pen = new Pen(ctx);
        const pulse = hop(clock, 2.4, 2);
        // Vitrine com moldura de madeira + vidro
        pen.col(K.BLACK).rect(128, 16 - pulse, 76, 74);
        pen.bevel(129, 17 - pulse, 74, 72, K.WOOD_D, K.OCHRE, K.GRAY_XD);
        pen.col(K.CREAM).rect(133, 21 - pulse, 66, 48);
        pen.col(K.WHITE).hline(134, 22 - pulse, 20);
        pen.col(K.CYAN).rect(135, 23 - pulse, 62, 44);
        const sprite = SPR.food[item.id];
        ctx.drawImage(sprite.canvas, 148, 28 - pulse, sprite.w * 3, sprite.h * 3);
        pen.col(K.NAVY).rect(133, 70 - pulse, 66, 14);
        F.textCenter(ctx, item.name, 166, 73 - pulse, K.YEL_L, { shadow: K.BLACK });
        if (this.spots) Sc.drawQuantityBoard(ctx, this.spots, 'QUANTOS?', clock);
      }
    }
  },

  /* -------------------------------------------------------------- correios */
  post: {
    backdrop: 'post',
    spots: null,
    enter() {
      this.spots = Sc.mailboxSpots();
      say(`Chame os amigos! Shh, ${honoree().name} não pode saber.`);
    },
    update() {},
    input(n) {
      if (n === 0) {
        S.inviteDone = S.invited.length > 0;
        if (!S.inviteDone) {
          Audio.bonk();
          say('Chame pelo menos um amigo!');
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
        say(`Shh! ${HEROES[idx].name} não pode saber!`);
        return;
      }
      if (S.invited.includes(idx)) {
        Audio.bonk();
        say(`${HEROES[idx].name} já vai!`);
        return;
      }
      S.invited.push(idx);
      S.inviteDone = true;
      joyBurst(40 + ((n - 1) % 5) * 61, 50);
      go(SCENES.mailman);
      SCENES.mailman.begin(idx);
    },
    draw(ctx) {
      Sc.drawMailboxes(ctx, this.spots, S, clock);
      blitFoot(ctx, raviPose('wave', clock), 292, 164 - extraHop());
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
      say(`${hero.name} vai à festa!`);
      const tl = new Timeline();
      tl.add(0.3, () => { showFlash(idx + 1); Audio.note(idx); });
      tl.add(1.8, null, (p) => { S.mailmanX = -40 + (W + 80) * easeOut(p); });
      tl.add(0.2, () => { hideFlash(); Audio.pop(); });
      tl.add(0.1, () => go(SCENES.post));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() { go(SCENES.post); },
    draw(ctx) {
      Sc.drawMailboxes(ctx, this.boxes, S, clock);
      const bob = hop(clock, 11, 2);
      const sway = wave(clock, 14, 1);
      blitFoot(ctx, SPR.misc.mailman, S.mailmanX + sway, 164 - bob);
      blit(ctx, SPR.misc.envelope, Math.round(S.mailmanX + 14 + sway), 118 - bob - hop(clock, 7, 1));
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
      say('Hora da festa!');

      const tl = new Timeline();
      tl.add(1.4, () => { S.fridgeFull = true; });
      tl.add(0.2, () => say('Faixa: SURPRESA!'));
      tl.add(1.2, () => { S.bannerUp = true; });
      const balloons = Math.max(1, S.balloons);
      tl.add(0.2, () => say(`${balloons} balão${balloons > 1 ? 'ões' : ''}!`));
      addCount(tl, balloons, (i) => { S.balloonsHung = i; }, 0.85);
      tl.add(0.2, () => say('Shh... chegaram!'));
      tl.add(1.2, null);
      tl.add(0.1, () => go(SCENES.partyArrive));
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() { go(SCENES.partyArrive); },
    draw(ctx) {
      drawPartyBack(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('wave', clock), 46, 160 - hop(clock, 3.2, 2) - extraHop());
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
        tl.add(0.55, () => { S.guestsIn = i + 1; Audio.pop(); joyBurst(S.guestX[i] || 160, 90); });
      }
      tl.add(0.55, () => { S.guestsIn = S.invited.length + 1; Audio.click(); });
      tl.add(0.25, () => {
        Audio.fanfare();
        say(`SURPRESA, ${honoree().name}!`);
      });
      tl.add(2.2, null);
      tl.add(0.1, () => {
        if (boughtFoods().length === 0 || S.invited.length === 0) go(SCENES.partyEnd);
        else go(SCENES.partyServe);
      });
      timeline = tl;
    },
    update(dt) {
      if (timeline) timeline.update(dt);
    },
    skip() {
      if (boughtFoods().length === 0 || S.invited.length === 0) go(SCENES.partyEnd);
      else go(SCENES.partyServe);
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('cheer', clock), 46, 160 - hop(clock, 5.5, 4) - extraHop());
      if (S.guestsIn > S.invited.length) {
        Sc.drawConfetti(ctx, S.confetti, clock);
      }
    }
  },

  /* ------------------------------------------------------- festa: servir */
  partyServe: {
    backdrop: 'party',
    spots: null,
    enter() {
      // Uma rodada por convidado (não convidado × cada comida) — senão cansa.
      S.serveIdx = 0;
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
      const menu = boughtFoods();
      const roster = partyRoster();
      if (menu.length === 0 || roster.length === 0) {
        this.spots = null;
        const tl = new Timeline();
        tl.add(0.1, () => go(SCENES.partyEnd));
        timeline = tl;
        return;
      }
      if (S.serveIdx >= roster.length) {
        this.spots = null;
        S.servePlacing = 0;
        S.serveHero = -1;
        S.serveFoodId = null;
        const tl = new Timeline();
        tl.add(0.5, () => say('Todo mundo servido!'));
        tl.add(1.4, null);
        tl.add(0.1, () => go(SCENES.partyEnd));
        timeline = tl;
        return;
      }
      const heroIdx = roster[S.serveIdx];
      const hero = HEROES[heroIdx];
      const food = menu[S.serveIdx % menu.length];
      this.food = food;
      S.serveHero = heroIdx;
      S.serveFoodId = food.id;
      S.servePlacing = 0;
      this.spots = Sc.plateSpots();
      const how = food.how || 'Quantos';
      say(`${how} ${food.ask || food.name.toLowerCase()} para ${hero.name}?`);
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
      const menu = boughtFoods();
      const roster = partyRoster();
      const heroIdx = roster[S.serveIdx];
      const hero = HEROES[heroIdx];
      const food = menu[S.serveIdx % menu.length];
      this.spots = null;

      const tl = new Timeline();
      addCount(tl, n, (i) => { S.servePlacing = i; }, 0.8);
      tl.add(0.55, () => {
        if (!S.served[heroIdx]) S.served[heroIdx] = {};
        S.served[heroIdx][food.id] = n;
        S.servePlacing = 0;
        say(`${n} para ${hero.name}!`);
      });
      tl.add(0.7, () => {
        S.serveIdx++;
        timeline = null;
        this.ask();
      });
      timeline = tl;
    },
    draw(ctx) {
      drawPartyBack(ctx);
      drawGuests(ctx);
      drawGuestMeals(ctx);
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('wave', clock), 22, 158 - hop(clock, 3.6, 2) - extraHop());
      if (this.spots) Sc.drawPlates(ctx, this.spots, this.food, clock);
    }
  },

  /* ------------------------------------------------------------ festa: fim */
  partyEnd: {
    backdrop: 'party',
    spots: null,
    enter() {
      this.leave = 0;
      Audio.party();
      say('Que festa boa!');
      const tl = new Timeline();
      tl.add(2.8, null, (p) => { this.leave = p; });
      tl.add(0.2, () => {
        Audio.success();
        say('Toque um número para outra festa!');
      });
      tl.add(1.2, null);
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
      drawGuests(ctx, Math.round(this.leave * 210));
      drawGuestMeals(ctx, Math.round(this.leave * 210));
      drawPartyFront(ctx);
      blitFoot(ctx, raviPose('cheer', clock), 46, 160 - hop(clock, 5.2, 3) - extraHop());
      Sc.drawConfetti(ctx, S.confetti, clock);

      if (this.done) {
        const pen = new Pen(ctx);
        pen.col(K.BLACK).rect(46, 48, 228, 66);
        pen.bevel(48, 50, 224, 62, K.NAVY, K.BLU, K.NIGHT);
        pen.col(K.OCHRE).frame(50, 52, 220, 58);
        pen.col(K.YEL).frame(51, 53, 218, 56);
        for (const sx of [58, 258]) {
          pen.col(K.YEL_L).px(sx, 58).px(sx - 1, 59).px(sx, 59).px(sx + 1, 59).px(sx, 60);
        }
        F.textCenter(ctx, 'FESTA ENCERRADA!', 160, 62, K.YEL_L, { scale: 2, shadow: K.RED_D });
        if (Math.floor(clock * 1.5) % 2 === 0) {
          F.textCenter(ctx, 'TOQUE PARA RECOMEÇAR', 160, 92, K.WHITE, { shadow: K.BLACK });
        }
      }
    }
  }
};

/* --------------------------------------------------------------------------
   Desenho compartilhado da sala de festa
   -------------------------------------------------------------------------- */

/* Convidados na FRENTE da mesa do cenário, bem grandes — antes ficavam
   miudinhos atrás do tampo da foto e quase sumiam. */
const GUEST_FOOT_Y = 142;
const GUEST_SCALE = 1.75;

function layoutGuests(count) {
  const xs = [];
  const spread = Math.min(48, 260 / Math.max(count, 1));
  const start = 168 - ((count - 1) * spread) / 2;
  for (let i = 0; i < count; i++) xs.push(Math.round(start + i * spread));
  return xs;
}

/** Camada de fundo da sala: geladeira, faixa e balões. */
function drawPartyBack(ctx) {
  const pen = new Pen(ctx);

  // Geladeira com as compras visíveis
  pen.col(K.BLACK).rect(7, 58, 36, 72);
  pen.bevel(8, 59, 34, 70, K.WHITE, K.GRAY_L, K.GRAY);
  pen.col(K.GRAY_L).hline(10, 92, 28);
  pen.col(K.CYAN).rect(12, 64, 20, 22); // vidro freezer
  pen.col(K.WHITE).hline(13, 65, 8);
  pen.col(K.GRAY_D).rect(37, 70, 3, 14).rect(37, 104, 3, 14);
  if (S.fridgeFull) {
    const foods = boughtFoods();
    let slot = 0;
    for (const food of foods) {
      const col = slot % 2;
      const row = (slot / 2) | 0;
      blitMid(ctx, SPR.food[food.id], 16 + col * 12, 98 + row * 10);
      slot++;
    }
    if (foods.length === 0) {
      pen.col(K.RED).rect(14, 98, 5, 5);
      pen.col(K.GRN).rect(22, 98, 5, 5);
    }
  }

  // Faixa SURPRESA — cordas + serrilha
  if (S.bannerUp) {
    const pulse = S.guestsIn > S.invited.length && Math.floor(clock * 2) % 2 === 0;
    const bw = pulse ? 168 : 136;
    const bh = pulse ? 26 : 20;
    const bx = Math.round((W - bw) / 2);
    // Cordas
    pen.col(K.CREAM).line(bx - 8, 2, bx, 8).line(bx + bw, 8, bx + bw + 8, 2);
    pen.col(K.BLACK).rect(bx - 2, 4, bw + 4, bh + 4);
    pen.bevel(bx, 6, bw, bh, pulse ? K.YEL_L : K.YEL, K.WHITE, K.OCHRE);
    // Serrilha inferior
    for (let i = 0; i < bw; i += 6) {
      pen.col(K.OCHRE).px(bx + i + 2, 6 + bh);
      pen.col(K.YEL).px(bx + i + 3, 6 + bh);
    }
    F.textCenter(ctx, 'SURPRESA!', 160, pulse ? 10 : 11, K.RED, {
      scale: pulse ? 2 : 1,
      shadow: K.SAND
    });
  }

  // Balões nas laterais, sem atravessar a faixa nem as cabeças
  Sc.drawBalloons(ctx, S.balloonsHung, clock);
}

/** Bolo e presente nas laterais — não cobrem o meio onde estão os convidados. */
function drawPartyFront(ctx) {
  const cakeBob = hop(clock, 2.4, 2);
  blitFoot(ctx, SPR.misc.cake, 48, 128 - cakeBob);
  if (S.presentDone && S.present) {
    const giftBob = hop(clock, 2.1, 2, 1);
    blitFoot(ctx, SPR.misc.gift, 278, 128 - giftBob);
  }
}

/** Pratos do buffet na frente de cada convidado — todas as comidas ficam visíveis. */
function drawGuestMeals(ctx, offsetX = 0) {
  const pen = new Pen(ctx);
  const menu = boughtFoods();
  for (let i = 0; i < S.guestsIn && i < S.guestX.length; i++) {
    const isHonoree = i >= S.invited.length;
    const hi = isHonoree ? S.honoree : S.invited[i];
    const x = S.guestX[i] + offsetX;
    const plateY = GUEST_FOOT_Y - 2;
    const active = S.serveHero === hi;

    // Pratinho
    pen.col(K.BLACK).ellipse(x + 1, plateY + 1, 15, 5);
    pen.col(active ? K.YEL_L : K.GRAY_L).ellipse(x, plateY, 14, 4);
    pen.col(K.CREAM).ellipse(x, plateY, 11, 3);
    if (active) {
      // Marcador “é a vez deste herói”
      pen.col(K.RED).px(x, plateY - 10).px(x - 1, plateY - 9).px(x + 1, plateY - 9);
    }

    const bag = S.served[hi] || {};
    let slot = 0;
    for (const food of menu) {
      let qty = bag[food.id] || 0;
      // Contagem ao vivo do item atual
      if (hi === S.serveHero && food.id === S.serveFoodId && S.servePlacing > 0) {
        qty = S.servePlacing;
      }
      if (qty <= 0) continue;
      const fx = x - 10 + (slot % 3) * 8;
      const fy = plateY - 1 - ((slot / 3) | 0) * 8;
      blitMid(ctx, SPR.food[food.id], fx, fy);
      if (qty > 1) {
        F.text(ctx, String(qty), fx + 3, fy - 7, K.RED, { shadow: K.WHITE });
      }
      slot++;
    }
  }
}

/** Desenha sprite apoiado pelos pés, com escala (convidados maiores na festa). */
function blitFootScaled(ctx, sprite, x, y, scale) {
  if (!sprite) return;
  const w = Math.round(sprite.w * scale);
  const h = Math.round(sprite.h * scale);
  ctx.drawImage(sprite.canvas, (x - (w >> 1)) | 0, (y - h) | 0, w, h);
}

function drawGuests(ctx, offsetX = 0) {
  const pen = new Pen(ctx);
  for (let i = 0; i < S.guestsIn && i < S.guestX.length; i++) {
    const isHonoree = i >= S.invited.length;
    const hi = isHonoree ? S.honoree : S.invited[i];
    const hero = HEROES[hi];
    const sprite = heroSprite(hero.id, dancing);
    const phase = i * 1.7;
    const dancing = S.guestsIn > S.invited.length;
    // Dança: salto + balanço lateral, defasada por convidado
    const danceY = dancing
      ? hop(clock, isHonoree ? 6.5 : 5.2, isHonoree ? 6 : 4, phase)
      : hop(clock, 2.2, 1, phase);
    const sway = dancing ? wave(clock, 3.4, 3, phase) : 0;
    const x = S.guestX[i] + offsetX + sway;
    const footY = GUEST_FOOT_Y + danceY;
    const h = Math.round((sprite?.h || 56) * GUEST_SCALE);

    // Sombra que encolhe no salto
    const shadowW = Math.max(6, Math.round(16 * GUEST_SCALE / 1.5) - (danceY >> 1));
    pen.col(K.BLACK).ellipse(x, GUEST_FOOT_Y + 1, shadowW, 3);

    blitFootScaled(ctx, sprite, x, footY, GUEST_SCALE);

    // Plaquinha com o nome ACIMA da cabeça (apontando pra baixo)
    const serving = S.serveHero === hi;
    const tagY = Math.max(4, footY - h - 12);
    const label = hero.short;
    const tw = F.measure(label, 1);
    const tagW = tw + 8;
    const tagX = x - (tagW >> 1);
    pen.col(K.BLACK).rect(tagX - 1, tagY - 1, tagW + 2, 12);
    pen.bevel(tagX, tagY, tagW, 10,
      serving || isHonoree ? K.YEL : K.NAVY,
      serving || isHonoree ? K.YEL_L : K.BLU,
      serving || isHonoree ? K.OCHRE : K.NIGHT);
    // Setinha
    pen.col(serving || isHonoree ? K.YEL : K.NAVY).px(x - 1, tagY + 10).px(x, tagY + 11).px(x + 1, tagY + 10);
    F.text(ctx, label, x - (tw >> 1), tagY + 2,
      serving || isHonoree ? K.RED : K.YEL_L,
      { shadow: K.BLACK });

    if (isHonoree && dancing) {
      const crownY = footY - h + 2;
      const twinkle = hop(clock, 8, 1);
      pen.col(K.BLACK).rect(x - 8, crownY - 2 - twinkle, 16, 6);
      pen.col(K.YEL).rect(x - 7, crownY - 1 - twinkle, 14, 4);
      pen.col(K.YEL_L).px(x - 7, crownY - 3 - twinkle).px(x, crownY - 4 - twinkle).px(x + 7, crownY - 3 - twinkle);
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

/**
 * Entrada de número, venha do teclado ou do toque num hotspot.
 * Cenas puramente animadas simplesmente não têm `input`, então a entrada
 * é ignorada sem precisar de flag de "ocupado" espalhada pelo estado.
 */
export function handleNumber(n) {
  Audio.init();
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
  ctx.drawImage(Sc.backdrop(scene.backdrop), 0, 0);
  Sc.drawAmbient(ctx, scene.backdrop, clock);
  if (scene.draw) scene.draw(ctx);
  Sc.drawPops(ctx, S.pops, clock);
  if (S.flash !== null) Sc.flashcard(ctx, S.flash, S.flashPop);
  Sc.speechBar(ctx, S.message);
}

export function getClock() {
  return clock;
}

/** Gancho de QA no browser — pular para uma cena ou marcar o prep pronto. */
export function debugApi() {
  return {
    go(name) {
      if (SCENES[name]) go(SCENES[name]);
    },
    ready() {
      S.presentDone = true;
      S.marketDone = true;
      S.inviteDone = true;
      S.invited = [0, 1, 2, 3, 4].filter((i) => i !== S.honoree).slice(0, 2);
      S.cart = { burger: 2, fries: 1, apple: 3 };
      S.balloons = 3;
      S.present = TOYS[0];
      S.made = ['urso'];
    },
    scene() {
      return Object.keys(SCENES).find((k) => SCENES[k] === scene) || '';
    }
  };
}
