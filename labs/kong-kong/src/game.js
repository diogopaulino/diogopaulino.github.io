/**
 * Simulação do Kong Kong: física, inimigos, barris, chefão e estados de tela.
 */

import {
  VIEW_W, VIEW_H, TILE, PHYS, START_LIVES, BANANAS_PER_LIFE, SAVE_KEY, EASY_KEY, EASY,
  ROLL_BARREL_VX, ROLL_BARREL_LIFE, THEMES, clamp, lerp, aabb, hash2
} from './config.js?v=5';
import { LEVELS } from './levels.js?v=5';
import {
  drawKong, drawScarfPickup, drawBanana, drawLetter, drawBalloon, drawBarrel,
  drawEnemy, drawBoss, drawExit, drawTile, drawBackground, drawForeground,
  drawWorldMap, drawTitle, drawHud, drawRollBarrel, roundRect
} from './sprites.js?v=5';

const SOLID = new Set(['#', '=', '@', '*']);
// Conjuntos fixos: evitam criar um Set novo a cada frame em overlapsTile().
const VINE = new Set(['|']);
const WATER = new Set(['~']);
const SPIKES = new Set(['^']);
const ONE_WAY = new Set(['-']);

/** Tempo (s) em que telas de resultado ignoram pulo/Enter — evita pular a tela sem querer. */
const SCREEN_LOCK = 0.5;

/** Teste de sobreposição sem alocar: ator (x,y,w,h) contra caixa centrada em (cx,cy). */
function hitCentered(a, cx, cy, w, h) {
  return a.x < cx + w / 2 && a.x + a.w > cx - w / 2 && a.y < cy + h / 2 && a.y + a.h > cy - h / 2;
}

function loadEasy() {
  try {
    return localStorage.getItem(EASY_KEY) !== 'false';
  } catch {
    return true;
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        unlocked: clamp(s.unlocked ?? 1, 1, LEVELS.length),
        clear: Array.isArray(s.clear) ? s.clear : []
      };
    }
  } catch { /* ignore */ }
  return { unlocked: 1, clear: [] };
}

function persist(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

function tileChar(level, tx, ty) {
  if (tx < 0 || tx >= level.w || ty < 0) return '#';
  if (ty >= level.h) return '.';
  return level.tiles[ty][tx];
}

function isSolid(ch) {
  return SOLID.has(ch);
}

function parseLevel(def, easy = false) {
  const speed = easy ? EASY.ENEMY_SPEED : 1;
  const tiles = def.map.map((r) => r.split(''));
  const bananas = [];
  const enemies = [];
  const barrels = [];
  const letters = [];
  const extras = [];
  let spawn = { x: TILE * 2, y: TILE };
  let exit = { x: (def.w - 3) * TILE, y: (def.h - 4) * TILE };
  let boss = null;

  const at = (tx, ty) => ({ x: tx * TILE, y: ty * TILE });

  for (let ty = 0; ty < def.h; ty++) {
    for (let tx = 0; tx < def.w; tx++) {
      const ch = tiles[ty][tx];
      const p = at(tx, ty);
      const wipe = () => { tiles[ty][tx] = '.'; };
      switch (ch) {
        case 'S':
          spawn = { x: p.x + 2, y: p.y + TILE - PHYS.HITBOX_H };
          wipe();
          break;
        case 'X':
          exit = { x: p.x + TILE / 2, y: p.y + TILE };
          wipe();
          break;
        case 'b':
          bananas.push({ x: p.x + 8, y: p.y + 8, w: 12, h: 12, bunch: false, taken: false });
          wipe();
          break;
        case 'u':
          bananas.push({ x: p.x + 8, y: p.y + 8, w: 14, h: 14, bunch: true, taken: false });
          wipe();
          break;
        case 'K':
        case 'O':
        case 'N':
        case 'G':
          letters.push({ x: p.x + 8, y: p.y + 8, w: 14, h: 16, ch, taken: false });
          wipe();
          break;
        case '1':
          extras.push({ kind: '1up', x: p.x + 8, y: p.y + 8, w: 12, h: 16, taken: false });
          wipe();
          break;
        case 'e':
          enemies.push({ type: 'lizard', x: p.x + 1, y: p.y + 4, w: 14, h: 12, vx: 42 * speed, vy: 0, alive: true });
          wipe();
          break;
        case 'f':
          enemies.push({
            type: 'bee', x: p.x + 1, y: p.y + 2, w: 14, h: 12, vx: 36 * speed, vy: 0,
            baseY: p.y + 2, alive: true, t: hash2(tx, ty) * 10
          });
          wipe();
          break;
        case 'p':
          enemies.push({ type: 'quill', x: p.x + 1, y: p.y + 4, w: 14, h: 12, vx: 28 * speed, vy: 0, alive: true });
          wipe();
          break;
        case 'W':
          boss = {
            x: p.x, y: p.y - 16, w: 36, h: 32, vx: 50, vy: 0, hp: easy ? EASY.BOSS_HP : 5,
            maxHp: easy ? EASY.BOSS_HP : 5, speed: easy ? EASY.BOSS_SPEED : 1,
            state: 'walk', timer: 0, invuln: 0, alive: true
          };
          wipe();
          break;
        case 'B':
          barrels.push({ kind: 'wood', x: p.x + 8, y: p.y + 8, w: 16, h: 18, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'C':
          barrels.push({ kind: 'cannon', x: p.x + 8, y: p.y + 8, w: 20, h: 18, angle: 0, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'Q':
          barrels.push({ kind: 'cannon', x: p.x + 8, y: p.y + 8, w: 20, h: 18, angle: -Math.PI / 4, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'U':
          barrels.push({ kind: 'cannon', x: p.x + 8, y: p.y + 8, w: 20, h: 18, angle: -Math.PI / 2, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'L':
          barrels.push({ kind: 'cannon', x: p.x + 8, y: p.y + 8, w: 20, h: 18, angle: Math.PI, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'T':
          barrels.push({ kind: 'tnt', x: p.x + 8, y: p.y + 8, w: 16, h: 18, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'o':
          barrels.push({ kind: 'bounce', x: p.x + 8, y: p.y + 8, w: 16, h: 16, occupied: false, fuse: 0 });
          wipe();
          break;
        case 'H':
          barrels.push({ kind: 'dk', x: p.x + 8, y: p.y + 8, w: 16, h: 18, occupied: false, used: false });
          wipe();
          break;
        default:
          break;
      }
    }
  }
  return {
    def, tiles, w: def.w, h: def.h, spawn, exit, bananas, enemies, barrels, letters, extras, boss,
    hazards: []
  };
}

export class KongGame {
  constructor(audio, input) {
    this.audio = audio;
    this.input = input;
    this.mode = 'title';
    this.save = loadSave();
    this.cursor = 0;
    this.levelIndex = 0;
    this.t = 0;
    this.lives = START_LIVES;
    this.bananas = 0;
    this.particles = [];
    this.shake = 0;
    this.hitFlash = 0;
    this.hitStop = 0;
    this.camX = 0;
    this.camY = 0;
    this.announce = '';
    this.overlayTimer = 0;
    this.level = null;
    this.player = null;
    this.checkpoint = null;
    this.scarfDrop = null;
    this.gotLetters = { K: false, O: false, N: false, G: false };
    this.toast = '';
    this.toastT = 0;
    this.easy = loadEasy();
    this.lockT = 0;
    this.lastSafe = null;
    this.levelBananas = 0;
    this.camAnchorY = 0.64; // altura dos pés do Kong na tela (0 = topo, 1 = base)
    this.hint = '';
    this.hintT = 0;
  }

  setEasy(on) {
    this.easy = !!on;
    try { localStorage.setItem(EASY_KEY, String(this.easy)); } catch { /* ignore */ }
  }

  /** Troca de tela: limpa pulsos pendentes e trava a entrada por SCREEN_LOCK s. */
  setMode(mode) {
    this.mode = mode;
    this.lockT = SCREEN_LOCK;
    this.input.clearPulses();
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    this.input.clearPulses();
    this.setAnnounce('Pausa');
  }

  resume() {
    if (this.mode !== 'pause') return;
    this.mode = 'play';
    this.input.clearPulses();
  }

  toMap() {
    if (this.mode === 'title' || this.mode === 'gameover' || this.mode === 'credits') {
      this.startRun();
      return;
    }
    this.setMode('map');
    this.cursor = clamp(this.levelIndex, 0, this.save.unlocked - 1);
    this.setAnnounce('Mapa da Ilha do Lenço');
  }

  toTitle() {
    this.setMode('title');
    this.audio.stopMusic();
  }

  /** "Jogar de novo" após o fim de jogo: vidas cheias, mesma fase. */
  retryLevel() {
    this.lives = this.easy ? EASY.LIVES : START_LIVES;
    this.bananas = 0;
    this.audio.startMusic();
    this.startLevel(this.levelIndex);
  }

  nextLevel() {
    if (this.levelIndex < LEVELS.length - 1) this.startLevel(this.levelIndex + 1);
  }

  moveCursor(dir) {
    const next = clamp(this.cursor + dir, 0, this.save.unlocked - 1);
    if (next !== this.cursor) {
      this.cursor = next;
      this.audio.play('select');
    }
  }

  setAnnounce(msg) {
    this.announce = msg;
  }

  toastMsg(msg) {
    this.toast = msg;
    this.toastT = 2.2;
  }

  startRun() {
    this.lives = this.easy ? EASY.LIVES : START_LIVES;
    this.bananas = 0;
    this.setMode('map');
    this.cursor = Math.min(this.save.unlocked - 1, LEVELS.length - 1);
    this.audio.startMusic();
    this.setAnnounce('Mapa da Ilha do Lenço');
  }

  startLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index], this.easy);
    this.checkpoint = { ...this.level.spawn };
    this.lastSafe = { ...this.level.spawn };
    this.levelBananas = 0;
    this.gotLetters = { K: false, O: false, N: false, G: false };
    this.scarfDrop = null;
    this.particles.length = 0;
    this.spawnPlayer(this.checkpoint, true);
    this.setMode('play');
    this.lockT = 0;
    this.camX = clamp(this.player.x - VIEW_W * 0.35, 0, this.level.w * TILE - VIEW_W);
    this.camY = clamp(this.player.y - VIEW_H * 0.6, 0, this.level.h * TILE - VIEW_H);
    this.setAnnounce(LEVELS[index].title + '. ' + LEVELS[index].hint);
    this.toastMsg(LEVELS[index].title);
    this.hint = LEVELS[index].hint;
    this.hintT = 5;
    this.audio.play('select');
  }

  spawnPlayer(pos, withScarf) {
    this.player = {
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      w: PHYS.HITBOX_W,
      h: PHYS.HITBOX_H,
      facing: 1,
      onGround: false,
      coyote: 0,
      jumpBuf: 0,
      state: 'idle',
      rollT: 0,
      invuln: 1.1,
      climbing: false,
      inBarrel: null,
      blastT: 0,
      scarf: withScarf,
      swimming: false,
      dead: false,
      winT: 0,
      squash: 0,
      rollDustT: 0,
      noCut: false
    };
  }

  burst(x, y, n, color, speed = 80) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: 0.4 + Math.random() * 0.4, color, size: 1.5 + Math.random() * 2
      });
    }
  }

  landingImpact(vy) {
    const p = this.player;
    const n = clamp(Math.floor(vy / 90), 4, 10);
    this.burst(p.x + p.w / 2, p.y + p.h, n, 'rgba(110,80,45,0.6)', 42);
    p.squash = clamp(vy / PHYS.MAX_FALL, 0.35, 1);
  }

  addBananas(n) {
    this.bananas += n;
    this.levelBananas += n;
    while (this.bananas >= BANANAS_PER_LIFE) {
      this.bananas -= BANANAS_PER_LIFE;
      this.lives += 1;
      this.audio.play('1up');
      this.toastMsg('1-UP!');
    }
  }

  /* ---------- física de tiles ---------- */

  moveActor(actor, dt, opts = {}) {
    const ignoreOneWay = opts.ignoreOneWay;
    actor.x += actor.vx * dt;
    this.resolveX(actor);

    const prevBottom = actor.y + actor.h;
    actor.y += actor.vy * dt;
    actor.onGround = false;
    this.resolveY(actor, prevBottom, ignoreOneWay);
  }

  resolveX(actor) {
    const x0 = Math.floor(actor.x / TILE);
    const x1 = Math.floor((actor.x + actor.w - 0.001) / TILE);
    const y0 = Math.floor(actor.y / TILE);
    const y1 = Math.floor((actor.y + actor.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!isSolid(tileChar(this.level, tx, ty))) continue;
        if (actor.vx > 0) actor.x = tx * TILE - actor.w;
        else if (actor.vx < 0) actor.x = (tx + 1) * TILE;
        else {
          const cx = actor.x + actor.w / 2;
          if (cx < tx * TILE + TILE / 2) actor.x = tx * TILE - actor.w;
          else actor.x = (tx + 1) * TILE;
        }
        actor.vx = 0;
      }
    }
    actor.x = clamp(actor.x, 0, this.level.w * TILE - actor.w);
  }

  resolveY(actor, prevBottom, ignoreOneWay) {
    const x0 = Math.floor(actor.x / TILE);
    const x1 = Math.floor((actor.x + actor.w - 0.001) / TILE);
    const y0 = Math.floor(actor.y / TILE);
    const y1 = Math.floor((actor.y + actor.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = tileChar(this.level, tx, ty);
        const top = ty * TILE;
        const oneWay = ch === '-' && !ignoreOneWay && actor.vy >= 0 && prevBottom <= top + 3;
        if (!isSolid(ch) && !oneWay) continue;
        if (actor.vy > 0 || oneWay) {
          actor.y = top - actor.h;
          actor.vy = 0;
          actor.onGround = true;
        } else if (actor.vy < 0 && isSolid(ch)) {
          // Correção de quina: só uma lasca da cabeça pegou no bloco → desliza e segue subindo.
          if (actor === this.player && this.nudgeCorner(actor, tx)) return;
          actor.y = (ty + 1) * TILE;
          actor.vy = 0;
        }
      }
    }
  }

  /** Desloca o ator até PHYS.CORNER px para fora da quina do bloco `tx`, se o espaço estiver livre. */
  nudgeCorner(actor, tx) {
    const fromLeft = actor.x + actor.w - tx * TILE;   // penetração entrando pela esquerda do bloco
    const fromRight = (tx + 1) * TILE - actor.x;     // penetração entrando pela direita
    const shift = fromLeft <= PHYS.CORNER ? -fromLeft - 0.01 : fromRight <= PHYS.CORNER ? fromRight + 0.01 : 0;
    if (!shift) return false;
    const ox = actor.x;
    actor.x += shift;
    if (this.boxHitsSolid(actor)) {
      actor.x = ox;
      return false;
    }
    return true;
  }

  boxHitsSolid(actor) {
    const x0 = Math.floor(actor.x / TILE);
    const x1 = Math.floor((actor.x + actor.w - 0.001) / TILE);
    const y0 = Math.floor(actor.y / TILE);
    const y1 = Math.floor((actor.y + actor.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolid(tileChar(this.level, tx, ty))) return true;
      }
    }
    return false;
  }

  overlapsTile(actor, set) {
    const x0 = Math.floor(actor.x / TILE);
    const x1 = Math.floor((actor.x + actor.w - 0.001) / TILE);
    const y0 = Math.floor(actor.y / TILE);
    const y1 = Math.floor((actor.y + actor.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (set.has(tileChar(this.level, tx, ty))) return { tx, ty };
      }
    }
    return null;
  }

  breakCrates(cx, cy, r) {
    const t0x = Math.floor((cx - r) / TILE);
    const t1x = Math.floor((cx + r) / TILE);
    const t0y = Math.floor((cy - r) / TILE);
    const t1y = Math.floor((cy + r) / TILE);
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const ch = tileChar(this.level, tx, ty);
        if (ch === '@' || ch === '*') {
          this.level.tiles[ty][tx] = '.';
          this.burst(tx * TILE + 8, ty * TILE + 8, 8, '#c07838');
        }
      }
    }
  }

  /* ---------- player ---------- */

  updatePlayer(dt) {
    const p = this.player;
    const inpt = this.input;
    if (p.dead) return;
    if (p.winT > 0) {
      p.winT -= dt;
      p.vx = 0;
      p.state = 'idle';
      if (p.winT <= 0) this.completeLevel();
      return;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.squash = Math.max(0, p.squash - dt * 7);
    if (p.rollT > 0) p.rollT -= dt;

    if (this.input.consume('jump')) p.jumpBuf = this.easy ? EASY.JUMP_BUF : PHYS.JUMP_BUF;
    else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (p.onGround) p.coyote = this.easy ? EASY.COYOTE : PHYS.COYOTE;
    else p.coyote = Math.max(0, p.coyote - dt);

    if (p.inBarrel) {
      this.updateInBarrel(dt);
      return;
    }

    const vine = this.overlapsTile(p, VINE);
    const water = this.overlapsTile(p, WATER);
    p.swimming = !!(water && !p.onGround);

    if (vine && (inpt.up() || inpt.downHeld() || p.climbing) && p.rollT <= 0 && p.blastT <= 0) {
      p.climbing = true;
      p.vx = 0;
      p.vy = inpt.up() ? -PHYS.CLIMB_SPEED : inpt.downHeld() ? PHYS.CLIMB_SPEED : 0;
      p.state = 'climb';
      if (p.jumpBuf > 0) {
        p.climbing = false;
        p.vy = PHYS.JUMP_VEL * 0.78;
        p.jumpBuf = 0;
        p.coyote = 0;
        this.audio.play('jump');
        p.state = 'jump';
      }
      this.moveActor(p, dt);
      return;
    }
    p.climbing = false;

    if (p.blastT > 0) {
      p.blastT -= dt;
      p.vy += PHYS.GRAVITY * PHYS.BLAST_GRAV * dt;
      p.state = 'jump';
      this.moveActor(p, dt);
      this.tryEnterBarrel(true);
      return;
    }

    const rolling = p.rollT > 0;
    if (inpt.consume('roll') && p.onGround && !rolling) {
      p.rollT = PHYS.ROLL_TIME;
      p.vx = p.facing * PHYS.ROLL_SPEED;
      this.audio.play('roll');
      this.burst(p.x + p.w / 2, p.y + p.h, 6, '#c07838', 50);
    }

    if (rolling) {
      p.vx = p.facing * PHYS.ROLL_SPEED;
      p.state = 'roll';
      p.rollDustT -= dt;
      if (p.rollDustT <= 0 && p.onGround) {
        p.rollDustT = 0.05;
        this.burst(p.x + p.w / 2 - p.facing * 4, p.y + p.h - 2, 2, '#c07838', 30);
      }
    } else {
      const wish = (inpt.left() ? -1 : 0) + (inpt.right() ? 1 : 0);
      if (wish) p.facing = wish;
      // Virar contra o embalo freia com TURN_ACCEL/AIR_TURN (derrapagem com poeira no chão).
      const turning = wish !== 0 && p.vx !== 0 && Math.sign(p.vx) !== wish;
      const acc = p.onGround
        ? (turning ? PHYS.TURN_ACCEL : PHYS.ACCEL)
        : (turning ? PHYS.AIR_TURN : PHYS.AIR_ACCEL);
      if (turning && p.onGround && Math.abs(p.vx) > PHYS.MAX_VX * 0.5) {
        p.rollDustT -= dt;
        if (p.rollDustT <= 0) {
          p.rollDustT = 0.06;
          this.burst(p.x + p.w / 2, p.y + p.h - 1, 2, 'rgba(150,110,60,0.7)', 26);
        }
      }
      if (wish) p.vx += wish * acc * dt;
      else {
        const fr = p.onGround ? PHYS.FRICTION : PHYS.FRICTION * 0.25;
        if (Math.abs(p.vx) <= fr * dt) p.vx = 0;
        else p.vx -= Math.sign(p.vx) * fr * dt;
      }
      p.vx = clamp(p.vx, -PHYS.MAX_VX, PHYS.MAX_VX);
    }

    if (p.swimming) {
      p.vy += PHYS.SWIM_GRAVITY * dt;
      if (inpt.up()) p.vy -= 520 * dt;
      if (inpt.downHeld()) p.vy += 280 * dt;
      p.vy = clamp(p.vy, -PHYS.SWIM_MAX, PHYS.SWIM_MAX);
      if (p.jumpBuf > 0) {
        p.vy = PHYS.SWIM_JUMP;
        p.jumpBuf = 0;
        this.audio.play('jump');
      }
      p.state = 'swim';
    } else {
      // Ápice leve: com o pulo preso, perto do topo a gravidade afrouxa.
      const apex = !p.onGround && inpt.jumpHeld() && Math.abs(p.vy) < PHYS.APEX_VY;
      p.vy += PHYS.GRAVITY * (apex ? PHYS.APEX_GRAV : 1) * dt;
      if (p.vy > PHYS.MAX_FALL) p.vy = PHYS.MAX_FALL;
      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = PHYS.JUMP_VEL;
        p.noCut = false;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuf = 0;
        this.audio.play('jump');
      }
      // Impulsos externos (barril-mola, empurrão do dano) não são cortados pelo botão.
      if (p.vy >= 0) p.noCut = false;
      if (!inpt.jumpHeld() && p.vy < 0 && !p.noCut) p.vy *= Math.pow(PHYS.JUMP_CUT, dt * PHYS.CUT_RATE);
      if (!rolling) {
        if (!p.onGround) p.state = p.vy < 0 ? 'jump' : 'fall';
        else if (Math.abs(p.vx) > 20) p.state = 'run';
        else p.state = 'idle';
      }
    }

    const wasGrounded = p.onGround;
    const fallSpeed = p.vy;
    this.moveActor(p, dt, { ignoreOneWay: inpt.downHeld() && p.vy >= 0 && this.overlapsTile(p, ONE_WAY) });

    if (!wasGrounded && p.onGround && fallSpeed > 260 && !rolling) {
      this.landingImpact(fallSpeed);
    }

    if (p.y > this.level.h * TILE + 8) {
      if (this.easy) this.easyFall();
      else this.hurt(true);
      return;
    }

    const onSpikes = this.overlapsTile(p, SPIKES);
    if (onSpikes && p.invuln <= 0 && p.rollT <= 0) {
      if (this.easy) {
        this.easyFall();
        return;
      }
      this.hurt(false);
    }
    if (p.onGround && !onSpikes && !p.inBarrel) this.recordSafe(p);

    this.tryEnterBarrel(false);
    this.collectPickups();
    this.collideEnemies();
    this.collideHazards();
    this.collideBoss();

    const boss = this.level.boss;
    const canExit = !boss || !boss.alive;
    const ex = this.level.exit;
    if (canExit && Math.abs(p.x + p.w / 2 - ex.x) < 14 && Math.abs(p.y + p.h - ex.y) < 18) {
      p.winT = 1.15;
      this.audio.play('win');
      this.burst(ex.x, ex.y - 10, 18, '#f6d03a', 90);
    }
  }

  /** Guarda o último ponto de chão firme (os dois pés apoiados) — usado no modo fácil. */
  recordSafe(p) {
    const ty = Math.floor((p.y + p.h + 1) / TILE);
    const l = tileChar(this.level, Math.floor((p.x - 2) / TILE), ty);
    const r = tileChar(this.level, Math.floor((p.x + p.w + 2) / TILE), ty);
    const firm = (ch) => isSolid(ch) || ch === '-';
    if (!firm(l) || !firm(r)) return;
    if (!this.lastSafe) this.lastSafe = { x: p.x, y: p.y };
    this.lastSafe.x = p.x;
    this.lastSafe.y = p.y;
  }

  /** Último chão seguro, se ele ainda existe (caixas quebram); senão, o checkpoint. */
  safeSpot() {
    const s = this.lastSafe;
    if (!s) return this.checkpoint;
    const ty = Math.floor((s.y + PHYS.HITBOX_H + 1) / TILE);
    const ch = tileChar(this.level, Math.floor((s.x + PHYS.HITBOX_W / 2) / TILE), ty);
    return isSolid(ch) || ch === '-' ? s : this.checkpoint;
  }

  placeAtSafe() {
    const p = this.player;
    const s = this.safeSpot();
    p.x = s.x;
    p.y = s.y;
    p.vx = 0;
    p.vy = 0;
    p.rollT = 0;
    p.blastT = 0;
    p.climbing = false;
    if (p.inBarrel) p.inBarrel.occupied = false;
    p.inBarrel = null;
  }

  /** Modo fácil: buraco/espinho = batida comum + volta ao último chão seguro. */
  easyFall() {
    const p = this.player;
    if (p.dead || p.winT > 0) return;
    if (p.scarf) {
      p.scarf = false;
      this.placeAtSafe();
      p.invuln = 1.5;
      this.audio.play('hurt');
      this.shake = 0.18;
      this.hitFlash = 0.22;
      this.toastMsg('Ops! O lenço voou');
      return;
    }
    this.hurt(true);
  }

  tryEnterBarrel(fromBlast) {
    const p = this.player;
    if (p.inBarrel) return;
    for (const b of this.level.barrels) {
      if (b.used || (b.cool > 0)) continue;
      if (!hitCentered(p, b.x, b.y, b.w, b.h)) continue;
      if (b.kind === 'bounce') {
        p.vy = PHYS.BOUNCE_VEL;
        p.noCut = true;
        p.blastT = 0;
        p.onGround = false;
        this.audio.play('jump');
        continue;
      }
      if (b.kind === 'dk') {
        b.used = true;
        this.checkpoint = { x: b.x - p.w / 2, y: b.y - p.h };
        this.audio.play('checkpoint');
        this.toastMsg('Checkpoint!');
        this.burst(b.x, b.y, 12, '#e31b23', 70);
        continue;
      }
      const want = fromBlast || this.input.downHeld() || b.kind === 'cannon' || (p.vy > 40 && !p.onGround);
      if (!want && b.kind === 'wood') continue;
      if (!want && b.kind === 'tnt') continue;
      p.inBarrel = b;
      b.occupied = true;
      b.fuse = b.kind === 'tnt' ? 1.05 : b.kind === 'cannon' ? 0.85 : 0;
      p.vx = 0;
      p.vy = 0;
      p.blastT = 0;
      this.audio.play('barrel');
      break;
    }
  }

  updateInBarrel(dt) {
    const p = this.player;
    const b = p.inBarrel;
    p.x = b.x - p.w / 2;
    p.y = b.y - p.h / 2;
    p.state = 'barrel';
    p.vx = 0;
    p.vy = 0;

    if (b.kind === 'wood') {
      const wish = (this.input.left() ? -1 : 0) + (this.input.right() ? 1 : 0);
      if (wish) p.facing = wish;
      // O barril carregado não entra em paredes nem sai da fase (senão Kong era ejetado
      // dentro de um bloco e podia ficar preso).
      if (wish) {
        const nx = clamp(b.x + wish * 90 * dt, p.w, this.level.w * TILE - p.w);
        p.x = nx - p.w / 2;
        if (!this.boxHitsSolid(p)) b.x = nx;
      }
      p.x = b.x - p.w / 2;
      if (this.input.consume('jump') || p.jumpBuf > 0) {
        this.ejectBarrel(0, PHYS.JUMP_VEL * 0.85);
        p.jumpBuf = 0;
      }
      return;
    }

    b.fuse -= dt;
    if (b.kind === 'tnt' && b.fuse <= 0) {
      this.explode(b.x, b.y);
      this.ejectBarrel(p.facing * 80, -200);
      return;
    }
    if (b.kind === 'cannon' && (p.jumpBuf > 0 || b.fuse <= 0)) {
      p.jumpBuf = 0;
      this.fireCannon(b);
    }
  }

  fireCannon(b) {
    const p = this.player;
    const sp = PHYS.BLAST_SPEED;
    p.vx = Math.cos(b.angle) * sp;
    p.vy = Math.sin(b.angle) * sp;
    p.facing = p.vx < 0 ? -1 : 1;
    p.blastT = PHYS.BLAST_FLOAT;
    p.inBarrel = null;
    b.occupied = false;
    b.cool = 0.4;
    p.onGround = false;
    this.audio.play('blast');
    this.burst(b.x, b.y, 10, '#c07838', 90);
  }

  ejectBarrel(vx, vy) {
    const p = this.player;
    const b = p.inBarrel;
    if (b) b.occupied = false;
    p.inBarrel = null;
    p.vx = vx;
    p.vy = vy;
    p.onGround = false;
    this.audio.play('jump');
  }

  explode(x, y) {
    this.audio.play('boom');
    this.shake = 0.35;
    this.hitStop = 0.05;
    this.burst(x, y, 22, '#f06b4f', 140);
    this.burst(x, y, 10, '#f6d03a', 80);
    this.breakCrates(x, y, 40);
    const r = 38;
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      const dx = e.x + e.w / 2 - x;
      const dy = e.y + e.h / 2 - y;
      if (dx * dx + dy * dy < r * r) this.killEnemy(e);
    }
    const p = this.player;
    const dx = p.x + p.w / 2 - x;
    const dy = p.y + p.h / 2 - y;
    if (dx * dx + dy * dy < r * r && p.invuln <= 0) this.hurt(false);
    this.level.barrels = this.level.barrels.filter((b) => !(Math.abs(b.x - x) < 4 && Math.abs(b.y - y) < 4 && b.kind === 'tnt'));
  }

  collectPickups() {
    const p = this.player;
    for (const b of this.level.bananas) {
      if (b.taken) continue;
      if (!hitCentered(p, b.x, b.y, b.w, b.h)) continue;
      b.taken = true;
      const n = b.bunch ? 10 : 1;
      this.addBananas(n);
      this.audio.play(b.bunch ? 'bunch' : 'banana');
      this.burst(b.x, b.y, 6, '#f6d03a', 50);
    }
    for (const L of this.level.letters) {
      if (L.taken) continue;
      if (!hitCentered(p, L.x, L.y, L.w, L.h)) continue;
      L.taken = true;
      this.gotLetters[L.ch] = true;
      this.audio.play('letter');
      this.toastMsg(L.ch);
      this.burst(L.x, L.y, 10, '#f6d03a', 70);
      if (this.gotLetters.K && this.gotLetters.O && this.gotLetters.N && this.gotLetters.G) {
        this.lives += 1;
        this.audio.play('1up');
        this.toastMsg('KONG! 1-UP');
      }
    }
    for (const e of this.level.extras) {
      if (e.taken) continue;
      if (!hitCentered(p, e.x, e.y, e.w, e.h)) continue;
      e.taken = true;
      this.lives += 1;
      this.audio.play('1up');
      this.toastMsg('1-UP!');
    }
    if (this.scarfDrop && this.scarfDrop.alive && this.scarfDrop.grabT <= 0) {
      const s = this.scarfDrop;
      if (hitCentered(p, s.x, s.y, 16, 12)) {
        p.scarf = true;
        s.alive = false;
        this.audio.play('scarf');
        this.toastMsg('Lenço!');
      }
    }
  }

  collideEnemies() {
    const p = this.player;
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      if (!aabb(p, e)) continue;
      const stomp = p.vy > 40 && p.y + p.h - 6 < e.y + 8;
      if (p.rollT > 0) {
        this.killEnemy(e);
        this.hitStop = 0.035;
        continue;
      }
      if (stomp && e.type !== 'quill') {
        this.killEnemy(e);
        p.vy = PHYS.STOMP_VEL;
        this.audio.play('stomp');
        this.hitStop = 0.045;
        continue;
      }
      if (p.invuln <= 0) this.hurt(false);
    }
  }

  /** Barris rolados pelo Rei Croco: rolar ou pisar quebra (+1 banana); encostar machuca. */
  collideHazards() {
    const p = this.player;
    for (const h of this.level.hazards) {
      if (h.life <= 0 || !aabb(p, h)) continue;
      const stomp = p.vy > 40 && p.y + p.h - 6 < h.y + 6;
      if (p.rollT > 0 || stomp) {
        h.life = -2; // -2: quebrado (sem segundo estouro em updateHazards)
        this.burst(h.x + h.w / 2, h.y + h.h / 2, 10, '#c07838', 80);
        this.addBananas(1);
        if (stomp) p.vy = PHYS.STOMP_VEL;
        this.audio.play('stomp');
        this.hitStop = 0.035;
        continue;
      }
      if (p.invuln <= 0) this.hurt(false);
    }
  }

  killEnemy(e) {
    e.alive = false;
    this.burst(e.x + e.w / 2, e.y + e.h / 2, 10, '#4cb05a', 70);
    this.addBananas(1);
  }

  collideBoss() {
    const b = this.level.boss;
    const p = this.player;
    if (!b || !b.alive || b.state === 'dead') return;
    if (!aabb(p, b)) return;
    const stomp = p.vy > 40 && p.y + p.h - 8 < b.y + 10;
    if ((p.rollT > 0 || stomp) && b.invuln <= 0) {
      b.hp -= 1;
      b.invuln = 0.7;
      b.state = 'hurt';
      b.timer = 0.45;
      p.vy = PHYS.STOMP_VEL;
      this.audio.play('boss');
      this.shake = 0.25;
      this.hitStop = 0.07;
      this.burst(b.x + b.w / 2, b.y + 8, 14, '#f6d03a', 90);
      if (b.hp <= 0) {
        b.alive = false;
        b.state = 'dead';
        this.audio.play('win');
        this.toastMsg('Rei Croco derrotado!');
        this.burst(b.x + b.w / 2, b.y, 28, '#e31b23', 120);
        this.player.winT = 1.8;
        this.hitStop = 0.12;
      }
      return;
    }
    if (p.invuln <= 0 && b.invuln <= 0) this.hurt(false);
  }

  hurt(fell) {
    const p = this.player;
    if (p.dead || p.winT > 0) return;
    if (!fell && p.scarf) {
      p.scarf = false;
      p.invuln = 1.35;
      p.vy = PHYS.KNOCKBACK_Y;
      p.noCut = true;
      p.vx = -p.facing * PHYS.KNOCKBACK_X;
      p.inBarrel = null;
      p.blastT = 0;
      p.rollT = 0;
      this.audio.play('hurt');
      this.shake = 0.18;
      this.hitFlash = 0.22;
      this.scarfDrop = {
        x: p.x + p.w / 2,
        y: p.y,
        vx: p.facing * 40,
        vy: -120,
        // Sem atraso, o lenço caía de volta em cima do Kong (ex.: preso no fosso de
        // espinhos) e era recuperado na hora — batida sem efeito, laço infinito.
        grabT: 0.7,
        alive: true
      };
      this.toastMsg('O lenço voou!');
      return;
    }
    p.dead = true;
    this.lives -= 1;
    this.audio.play('die');
    this.shake = 0.3;
    this.overlayTimer = 1.1;
    this.mode = 'dying';
    this.setAnnounce('Kong Kong caiu');
  }

  respawnOrOver() {
    if (this.lives < 0) {
      this.setMode('gameover');
      this.setAnnounce('Fim de jogo');
      return;
    }
    this.scarfDrop = null;
    if (this.easy) {
      // Fácil: a fase continua como estava; Kong volta ao último chão seguro.
      this.spawnPlayer(this.safeSpot(), true);
      this.player.invuln = 1.6;
      this.level.hazards.length = 0;
    } else {
      this.level = parseLevel(LEVELS[this.levelIndex], this.easy);
      this.lastSafe = { ...this.checkpoint };
      this.spawnPlayer(this.checkpoint, true);
    }
    this.mode = 'play';
    this.input.clearPulses();
    this.toastMsg(this.lives === 0 ? 'Última vida!' : 'De novo!');
  }

  completeLevel() {
    if (!this.save.clear.includes(this.levelIndex)) this.save.clear.push(this.levelIndex);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, this.levelIndex + 2));
    persist(this.save);
    this.setMode(this.levelIndex === LEVELS.length - 1 ? 'credits' : 'clear');
    if (this.mode === 'credits') this.audio.play('win');
    this.setAnnounce(this.mode === 'credits' ? 'Ilha salva!' : 'Fase concluída');
  }

  /* ---------- mundo ---------- */

  updateEnemies(dt) {
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      if (e.type === 'bee') {
        e.t += dt;
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 3) * 18;
        if (this.overlapsTile({ x: e.x, y: e.y + 4, w: e.w, h: 4 }, SOLID) || e.x < 8 || e.x > this.level.w * TILE - 16) {
          e.vx *= -1;
          e.x += e.vx * dt;
        }
        continue;
      }
      e.vy += PHYS.GRAVITY * dt;
      if (e.vy > PHYS.MAX_FALL) e.vy = PHYS.MAX_FALL;
      const ahead = e.x + (e.vx > 0 ? e.w + 2 : -2);
      const footX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      const wall = isSolid(tileChar(this.level, Math.floor(ahead / TILE), Math.floor((e.y + 4) / TILE)));
      const ledge = !isSolid(tileChar(this.level, Math.floor(footX / TILE), Math.floor((e.y + e.h + 2) / TILE)))
        && tileChar(this.level, Math.floor(footX / TILE), Math.floor((e.y + e.h + 2) / TILE)) !== '-';
      if (wall || ledge) e.vx *= -1;
      this.moveActor(e, dt);
      if (e.y > this.level.h * TILE) e.alive = false;
    }
  }

  updateBoss(dt) {
    const b = this.level.boss;
    if (!b || !b.alive) return;
    b.invuln = Math.max(0, b.invuln - dt);
    b.timer -= dt;
    b.vy += PHYS.GRAVITY * dt;
    if (b.state === 'hurt') {
      b.vx = 0;
      if (b.timer <= 0) b.state = 'walk';
    } else if (b.state === 'walk') {
      const p = this.player;
      const dir = p.x > b.x ? 1 : -1;
      b.vx = dir * (40 + (b.maxHp - b.hp) * 8) * b.speed;
      if (b.timer <= 0) {
        b.state = 'jump';
        b.vy = -380;
        b.timer = 0.9;
        this.audio.play('boss');
      }
    } else if (b.state === 'jump') {
      if (b.onGround && b.timer < 0.5) {
        b.state = 'walk';
        b.timer = 1.6 + Math.random();
        if (Math.random() < 0.7) {
          // Antes o barril era de madeira "entrável" e afundava no chão (podia
          // levar Kong junto). Agora é um obstáculo que rola e some sozinho.
          const dir = this.player.x > b.x ? 1 : -1;
          this.level.hazards.push({
            x: b.x + b.w / 2 - 7 + dir * 14,
            y: b.y + b.h - 16,
            w: 14,
            h: 14,
            vx: dir * ROLL_BARREL_VX * (this.easy ? EASY.ENEMY_SPEED : 1),
            vy: -140,
            onGround: false,
            life: ROLL_BARREL_LIFE,
            spin: 0
          });
        }
      }
    }
    this.moveActor(b, dt);
  }

  updateBarrels(dt) {
    for (const b of this.level.barrels) {
      if (b.cool > 0) b.cool -= dt;
      if (b.vx) {
        b.x += b.vx * dt;
        b.y += 40 * dt;
        if (b.x < 8 || b.x > this.level.w * TILE - 8) b.vx *= -1;
      }
    }
  }

  updateHazards(dt) {
    const list = this.level.hazards;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      h.life -= dt;
      h.vy = Math.min(PHYS.MAX_FALL, h.vy + PHYS.GRAVITY * dt);
      const vx = h.vx;
      this.moveActor(h, dt);
      if (h.vx === 0) h.vx = -vx; // bateu na parede: volta rolando
      h.spin += (vx * dt) / 7;
      if (h.life > 0 && h.y < this.level.h * TILE) list[w++] = h;
      else if (h.life > -1) this.burst(h.x + h.w / 2, h.y + h.h / 2, 6, '#c07838', 50);
    }
    list.length = w;
  }

  updateScarf(dt) {
    const s = this.scarfDrop;
    if (!s || !s.alive) return;
    if (s.grabT > 0) s.grabT -= dt;
    s.vy += 380 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const dummy = { x: s.x - 6, y: s.y - 4, w: 12, h: 8, vx: s.vx, vy: s.vy, onGround: false };
    const prev = dummy.y + dummy.h;
    this.resolveY(dummy, prev, false);
    s.y = dummy.y + 4;
    if (dummy.onGround) {
      s.vy = 0;
      s.vx *= 0.9;
    }
  }

  updateParticles(dt) {
    // Compacta no lugar: sem array novo por frame.
    const list = this.particles;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      q.life -= dt;
      if (q.life <= 0) continue;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 420 * dt;
      list[w++] = q;
    }
    list.length = w;
    if (w > 260) list.splice(0, w - 260);
  }

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x + p.w / 2 - VIEW_W * 0.38;
    const ty = p.y + p.h - VIEW_H * this.camAnchorY;
    const k = 1 - Math.pow(0.0008, dt);
    this.camX = lerp(this.camX, clamp(tx, 0, Math.max(0, this.level.w * TILE - VIEW_W)), k);
    this.camY = lerp(this.camY, clamp(ty, 0, Math.max(0, this.level.h * TILE - VIEW_H)), k);
    if (this.shake > 0) this.shake -= dt;
  }

  /* ---------- estados ---------- */

  update(dt) {
    this.t += dt;
    if (this.toastT > 0) this.toastT -= dt;
    if (this.hintT > 0 && this.mode === 'play') this.hintT -= dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.audio.tick();

    if (this.input.consume('mute')) {
      const muted = this.audio.toggleMute();
      this.toastMsg(muted ? 'Som desligado' : 'Som ligado');
    }

    // Telas de menu: trava curta após a troca para um pulo "atrasado" não pular a tela.
    if (this.lockT > 0) {
      this.lockT = Math.max(0, this.lockT - dt);
      if (this.mode !== 'play') {
        this.input.clearPulses();
        return;
      }
    }

    if (this.mode === 'title') {
      if (this.input.consume('start') || this.input.consume('jump')) this.startRun();
      return;
    }

    if (this.mode === 'map') {
      if (this.input.consume('pause')) {
        this.toTitle();
        return;
      }
      if (this.input.consume('jump') || this.input.consume('start') || this.input.consume('up')) {
        this.startLevel(this.cursor);
        return;
      }
      const tapL = this.input.consume('left');
      const tapR = this.input.consume('right');
      if (tapL || tapR) {
        this.moveCursor(tapL ? -1 : 1);
        this._mapHold = 0.35; // segurar: repete depois de 0,35 s
      } else if (this.input.left()) {
        this._mapHold = (this._mapHold || 0) - dt;
        if (this._mapHold <= 0) {
          this.moveCursor(-1);
          this._mapHold = 0.22;
        }
      } else if (this.input.right()) {
        this._mapHold = (this._mapHold || 0) - dt;
        if (this._mapHold <= 0) {
          this.moveCursor(1);
          this._mapHold = 0.22;
        }
      } else this._mapHold = 0;
      return;
    }

    if (this.mode === 'pause') {
      if (this.input.consume('pause') || this.input.consume('start') || this.input.consume('jump')) {
        this.resume();
      }
      return;
    }

    if (this.mode === 'clear') {
      if (this.input.consume('start') || this.input.consume('jump')) this.nextLevel();
      else if (this.input.consume('pause')) this.toMap();
      return;
    }

    if (this.mode === 'gameover') {
      if (this.input.consume('start') || this.input.consume('jump')) this.retryLevel();
      else if (this.input.consume('pause')) this.toMap();
      return;
    }

    if (this.mode === 'credits') {
      if (this.input.consume('start') || this.input.consume('jump')) this.toMap();
      else if (this.input.consume('pause')) this.toTitle();
      return;
    }

    if (this.mode === 'dying') {
      this.overlayTimer -= dt;
      this.updateParticles(dt);
      if (this.overlayTimer <= 0) this.respawnOrOver();
      return;
    }

    if (this.mode !== 'play') return;

    if (this.input.consume('pause') || this.input.consume('start')) {
      this.pause();
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.updateParticles(dt);
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateBarrels(dt);
    this.updateHazards(dt);
    this.updateScarf(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
  }

  /* ---------- render ---------- */

  render(ctx) {
    if (this.mode === 'title') {
      drawTitle(ctx, this.t);
      return;
    }
    if (this.mode === 'map') {
      drawWorldMap(ctx, this.save, this.cursor, this.t);
      return;
    }
    if (this.mode === 'credits') {
      // Texto e botões da vitória ficam no painel HTML (legível no celular).
      drawBackground(ctx, 'jungle', this.t * 10, 0, this.t);
      ctx.fillStyle = 'rgba(10,20,8,0.35)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 9; i++) {
        drawBanana(ctx, 30 + i * 52, 30 + ((this.t * 40 + i * 37) % 240), this.t, i % 3 === 0);
      }
      drawKong(ctx, VIEW_W / 2, 236 - Math.abs(Math.sin(this.t * 5)) * 18, { facing: 1, t: this.t, state: 'jump', scarf: true });
      return;
    }

    const level = this.level;
    if (!level) return;
    const theme = level.def.theme;
    const sx = this.shake > 0 ? (hash2(this.t * 40, 1) - 0.5) * 8 : 0;
    const sy = this.shake > 0 ? (hash2(this.t * 40, 2) - 0.5) * 8 : 0;

    drawBackground(ctx, theme, this.camX, this.camY, this.t);

    ctx.save();
    ctx.translate(-this.camX + sx, -this.camY + sy);

    const tx0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const ty0 = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const tx1 = Math.min(level.w - 1, Math.ceil((this.camX + VIEW_W) / TILE) + 1);
    const ty1 = Math.min(level.h - 1, Math.ceil((this.camY + VIEW_H) / TILE) + 1);
    const themeObj = THEMES[theme];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        drawTile(ctx, level.tiles[ty][tx], tx, ty, themeObj, this.t);
      }
    }

    drawExit(ctx, level.exit.x, level.exit.y, this.t);

    for (const b of level.bananas) {
      if (!b.taken) drawBanana(ctx, b.x, b.y, this.t, b.bunch);
    }
    for (const L of level.letters) {
      if (!L.taken) drawLetter(ctx, L.x, L.y, L.ch, this.t);
    }
    for (const e of level.extras) {
      if (!e.taken) drawBalloon(ctx, e.x, e.y, this.t);
    }
    for (const b of level.barrels) {
      if (b.used) continue;
      const chargeMax = b.kind === 'tnt' ? 1.05 : 0.85;
      const charge = b.occupied && (b.kind === 'tnt' || b.kind === 'cannon')
        ? clamp(1 - b.fuse / chargeMax, 0, 1)
        : 0;
      drawBarrel(ctx, b.x, b.y, b.kind === 'cannon' ? 'cannon' : b.kind, this.t, b.angle || 0, charge);
    }
    for (const e of level.enemies) {
      if (e.alive) drawEnemy(ctx, e, this.t);
    }
    for (const h of level.hazards) drawRollBarrel(ctx, h.x + h.w / 2, h.y + h.h / 2, h.spin);
    if (level.boss && (level.boss.alive || level.boss.state === 'dead')) {
      if (level.boss.invuln <= 0 || Math.floor(this.t * 18) % 2 === 0) drawBoss(ctx, level.boss, this.t);
    }
    if (this.scarfDrop && this.scarfDrop.alive) {
      drawScarfPickup(ctx, this.scarfDrop.x, this.scarfDrop.y, this.t);
    }

    const p = this.player;
    if (p && !p.inBarrel) {
      drawKong(ctx, p.x + p.w / 2, p.y + p.h, {
        facing: p.facing,
        t: this.t,
        state: p.state,
        scarf: p.scarf,
        flash: p.invuln > 0 && !p.dead,
        squash: p.squash
      });
    }

    for (const q of this.particles) {
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x, q.y, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    drawForeground(ctx, theme, this.camX, this.t);

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(227,27,35,${this.hitFlash * 0.85})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (this.mode === 'play' || this.mode === 'pause' || this.mode === 'dying' || this.mode === 'clear') {
      const boss = level.boss;
      drawHud(ctx, {
        lives: Math.max(0, this.lives),
        bananas: this.bananas,
        letters: this.gotLetters,
        scarf: p?.scarf,
        bossHp: boss ? Math.max(0, boss.hp) : -1,
        bossMax: boss ? boss.maxHp : 0,
        t: this.t
      });
    }

    if (this.toastT > 0 && this.mode === 'play') {
      // Aparece com um "pop" e some suavemente.
      const a = clamp(this.toastT * 3, 0, 1);
      const pop = 1 + Math.max(0, this.toastT - 2) * 0.6;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(VIEW_W / 2, 70);
      ctx.scale(pop, pop);
      ctx.font = '14px "Titan One", system-ui';
      const w = Math.max(120, ctx.measureText(this.toast).width + 36);
      ctx.fillStyle = 'rgba(12,20,10,0.78)';
      roundRect(ctx, -w / 2, -14, w, 28, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(246,208,58,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f6d03a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.toast, 0, 1);
      ctx.restore();
    }

    // Dica da fase nos primeiros segundos (frase curta, sem jargão).
    if (this.hintT > 0 && this.mode === 'play' && this.hint) {
      ctx.save();
      ctx.globalAlpha = clamp(this.hintT, 0, 1);
      ctx.font = 'bold 12px "Nunito", system-ui';
      const w = ctx.measureText(this.hint).width + 28;
      ctx.fillStyle = 'rgba(12,20,10,0.72)';
      roundRect(ctx, VIEW_W / 2 - w / 2, 92, w, 24, 12);
      ctx.fill();
      ctx.fillStyle = '#fff6ea';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.hint, VIEW_W / 2, 104.5);
      ctx.restore();
    }

    // Pausa / fase concluída / fim de jogo: o texto e os botões vêm do painel HTML.
    if (this.mode === 'pause' || this.mode === 'clear' || this.mode === 'gameover') {
      ctx.fillStyle = 'rgba(8,16,8,0.5)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.mode === 'dying') {
      ctx.fillStyle = `rgba(80,0,0,${0.25 + (1 - this.overlayTimer) * 0.3})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  tapMap(mx, my) {
    if (this.mode !== 'map') return;
    const nodes = [90, 150, 220, 290, 350, 410];
    const ys = [176, 148, 168, 140, 166, 132];
    for (let i = 0; i < nodes.length; i++) {
      if (i >= this.save.unlocked) continue;
      const dx = mx - nodes[i];
      const dy = my - ys[i];
      // Raio generoso (30 px de jogo ≈ 44 px de dedo no celular).
      if (dx * dx + dy * dy < 30 * 30) {
        this.cursor = i;
        this.startLevel(i);
        return;
      }
    }
  }
}
