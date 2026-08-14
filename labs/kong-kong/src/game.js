/**
 * Simulação do Kong Kong: física, inimigos, barris, chefão e estados de tela.
 */

import {
  VIEW_W, VIEW_H, TILE, PHYS, START_LIVES, BANANAS_PER_LIFE, SAVE_KEY,
  THEMES, clamp, lerp, aabb, hash2
} from './config.js';
import { LEVELS } from './levels.js';
import {
  drawKong, drawScarfPickup, drawBanana, drawLetter, drawBalloon, drawBarrel,
  drawEnemy, drawBoss, drawExit, drawTile, drawBackground, drawForeground,
  drawWorldMap, drawTitle, drawHud, roundRect
} from './sprites.js';

const SOLID = new Set(['#', '=', '@', '*']);

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

function parseLevel(def) {
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
          enemies.push({ type: 'lizard', x: p.x + 1, y: p.y + 4, w: 14, h: 12, vx: 42, vy: 0, alive: true });
          wipe();
          break;
        case 'f':
          enemies.push({
            type: 'bee', x: p.x + 1, y: p.y + 2, w: 14, h: 12, vx: 36, vy: 0,
            baseY: p.y + 2, alive: true, t: hash2(tx, ty) * 10
          });
          wipe();
          break;
        case 'p':
          enemies.push({ type: 'quill', x: p.x + 1, y: p.y + 4, w: 14, h: 12, vx: 28, vy: 0, alive: true });
          wipe();
          break;
        case 'W':
          boss = {
            x: p.x, y: p.y - 16, w: 36, h: 32, vx: 50, vy: 0, hp: 5,
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
    def, tiles, w: def.w, h: def.h, spawn, exit, bananas, enemies, barrels, letters, extras, boss
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
  }

  setAnnounce(msg) {
    this.announce = msg;
  }

  toastMsg(msg) {
    this.toast = msg;
    this.toastT = 2.2;
  }

  startRun() {
    this.lives = START_LIVES;
    this.bananas = 0;
    this.mode = 'map';
    this.cursor = Math.min(this.save.unlocked - 1, LEVELS.length - 1);
    this.audio.startMusic();
    this.setAnnounce('Mapa da Ilha do Lenço');
  }

  startLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    this.checkpoint = { ...this.level.spawn };
    this.gotLetters = { K: false, O: false, N: false, G: false };
    this.scarfDrop = null;
    this.particles.length = 0;
    this.spawnPlayer(this.checkpoint, true);
    this.mode = 'play';
    this.camX = clamp(this.player.x - VIEW_W * 0.35, 0, this.level.w * TILE - VIEW_W);
    this.camY = clamp(this.player.y - VIEW_H * 0.6, 0, this.level.h * TILE - VIEW_H);
    this.setAnnounce(LEVELS[index].title + '. ' + LEVELS[index].hint);
    this.toastMsg(LEVELS[index].title);
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
      winT: 0
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

  addBananas(n) {
    this.bananas += n;
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
          actor.y = (ty + 1) * TILE;
          actor.vy = 0;
        }
      }
    }
  }

  overlapsTile(actor, chs) {
    const set = typeof chs === 'string' ? new Set(chs) : chs;
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
    if (p.rollT > 0) p.rollT -= dt;

    if (this.input.consume('jump')) p.jumpBuf = PHYS.JUMP_BUF;
    else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (p.onGround) p.coyote = PHYS.COYOTE;
    else p.coyote = Math.max(0, p.coyote - dt);

    if (p.inBarrel) {
      this.updateInBarrel(dt);
      return;
    }

    const vine = this.overlapsTile(p, '|');
    const water = this.overlapsTile(p, '~');
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
    } else {
      const wish = (inpt.left() ? -1 : 0) + (inpt.right() ? 1 : 0);
      if (wish) p.facing = wish;
      const acc = p.onGround ? PHYS.ACCEL : PHYS.AIR_ACCEL;
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
      p.vy += PHYS.GRAVITY * dt;
      if (p.vy > PHYS.MAX_FALL) p.vy = PHYS.MAX_FALL;
      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = PHYS.JUMP_VEL;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuf = 0;
        this.audio.play('jump');
      }
      if (!inpt.jumpHeld() && p.vy < 0) p.vy *= Math.pow(PHYS.JUMP_CUT, dt * 8);
      if (!rolling) {
        if (!p.onGround) p.state = p.vy < 0 ? 'jump' : 'fall';
        else if (Math.abs(p.vx) > 20) p.state = 'run';
        else p.state = 'idle';
      }
    }

    this.moveActor(p, dt, { ignoreOneWay: inpt.downHeld() && p.vy >= 0 && this.overlapsTile(p, '-') });

    if (p.y > this.level.h * TILE + 8) {
      this.hurt(true);
      return;
    }

    if (this.overlapsTile(p, '^') && p.invuln <= 0 && p.rollT <= 0) this.hurt(false);

    this.tryEnterBarrel(false);
    this.collectPickups();
    this.collideEnemies();
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

  tryEnterBarrel(fromBlast) {
    const p = this.player;
    if (p.inBarrel) return;
    for (const b of this.level.barrels) {
      if (b.used || (b.cool > 0)) continue;
      const box = { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h };
      if (!aabb(p, box)) continue;
      if (b.kind === 'bounce') {
        p.vy = PHYS.BOUNCE_VEL;
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
      b.x += wish * 90 * dt;
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
      if (!aabb(p, { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h })) continue;
      b.taken = true;
      const n = b.bunch ? 10 : 1;
      this.addBananas(n);
      this.audio.play(b.bunch ? 'bunch' : 'banana');
      this.burst(b.x, b.y, 6, '#f6d03a', 50);
    }
    for (const L of this.level.letters) {
      if (L.taken) continue;
      if (!aabb(p, { x: L.x - L.w / 2, y: L.y - L.h / 2, w: L.w, h: L.h })) continue;
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
      if (!aabb(p, { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h })) continue;
      e.taken = true;
      this.lives += 1;
      this.audio.play('1up');
      this.toastMsg('1-UP!');
    }
    if (this.scarfDrop && this.scarfDrop.alive) {
      const s = this.scarfDrop;
      if (aabb(p, { x: s.x - 8, y: s.y - 6, w: 16, h: 12 })) {
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
        continue;
      }
      if (stomp && e.type !== 'quill') {
        this.killEnemy(e);
        p.vy = PHYS.STOMP_VEL;
        this.audio.play('stomp');
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
      this.burst(b.x + b.w / 2, b.y + 8, 14, '#f6d03a', 90);
      if (b.hp <= 0) {
        b.alive = false;
        b.state = 'dead';
        this.audio.play('win');
        this.toastMsg('Rei Croco derrotado!');
        this.burst(b.x + b.w / 2, b.y, 28, '#e31b23', 120);
        this.player.winT = 1.8;
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
      p.vx = -p.facing * PHYS.KNOCKBACK_X;
      p.inBarrel = null;
      p.blastT = 0;
      p.rollT = 0;
      this.audio.play('hurt');
      this.shake = 0.18;
      this.scarfDrop = {
        x: p.x + p.w / 2,
        y: p.y,
        vx: p.facing * 40,
        vy: -120,
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
      this.mode = 'gameover';
      this.setAnnounce('Fim de jogo');
      return;
    }
    this.level = parseLevel(LEVELS[this.levelIndex]);
    this.scarfDrop = null;
    this.spawnPlayer(this.checkpoint, true);
    this.mode = 'play';
    this.toastMsg('Cuidado!');
  }

  completeLevel() {
    if (!this.save.clear.includes(this.levelIndex)) this.save.clear.push(this.levelIndex);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, this.levelIndex + 2));
    persist(this.save);
    this.mode = this.levelIndex === LEVELS.length - 1 ? 'credits' : 'clear';
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
      b.vx = dir * (40 + (5 - b.hp) * 8);
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
          this.level.barrels.push({
            kind: 'wood',
            x: b.x + b.w / 2,
            y: b.y + 8,
            w: 16,
            h: 18,
            occupied: false,
            fuse: 0,
            vx: (this.player.x > b.x ? 1 : -1) * 120
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

  updateScarf(dt) {
    const s = this.scarfDrop;
    if (!s || !s.alive) return;
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
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 420 * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x + p.w / 2 - VIEW_W * 0.38;
    const ty = p.y + p.h - VIEW_H * 0.64;
    const k = 1 - Math.pow(0.0008, dt);
    this.camX = lerp(this.camX, clamp(tx, 0, Math.max(0, this.level.w * TILE - VIEW_W)), k);
    this.camY = lerp(this.camY, clamp(ty, 0, Math.max(0, this.level.h * TILE - VIEW_H)), k);
    if (this.shake > 0) this.shake -= dt;
  }

  /* ---------- estados ---------- */

  update(dt) {
    this.t += dt;
    if (this.toastT > 0) this.toastT -= dt;
    this.audio.tick();

    if (this.input.consume('mute')) {
      const muted = this.audio.toggleMute();
      this.toastMsg(muted ? 'Som off' : 'Som on');
    }

    if (this.mode === 'title') {
      if (this.input.consume('start') || this.input.consume('jump')) this.startRun();
      return;
    }

    if (this.mode === 'map') {
      if (this.input.consume('pause')) {
        this.mode = 'title';
        return;
      }
      if (this.input.consume('jump') || this.input.consume('start') || this.input.consume('up')) {
        this.startLevel(this.cursor);
        return;
      }
      if (this.input.left()) {
        this._mapHold = (this._mapHold || 0) - dt;
        if (this._mapHold <= 0) {
          this.cursor = Math.max(0, this.cursor - 1);
          this._mapHold = 0.18;
          this.audio.play('select');
        }
      } else if (this.input.right()) {
        this._mapHold = (this._mapHold || 0) - dt;
        if (this._mapHold <= 0) {
          this.cursor = Math.min(this.save.unlocked - 1, this.cursor + 1);
          this._mapHold = 0.18;
          this.audio.play('select');
        }
      } else this._mapHold = 0;
      return;
    }

    if (this.mode === 'pause') {
      if (this.input.consume('pause') || this.input.consume('start') || this.input.consume('jump')) {
        this.mode = 'play';
      }
      return;
    }

    if (this.mode === 'clear') {
      if (this.input.consume('start') || this.input.consume('jump')) {
        this.startLevel(this.levelIndex + 1);
      }
      if (this.input.consume('pause')) this.mode = 'map';
      return;
    }

    if (this.mode === 'gameover' || this.mode === 'credits') {
      if (this.input.consume('start') || this.input.consume('jump')) {
        this.mode = 'title';
        this.audio.stopMusic();
      }
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
      this.mode = 'pause';
      this.setAnnounce('Pausa');
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateBarrels(dt);
    this.updateScarf(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
  }

  /* ---------- render ---------- */

  render(ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (this.mode === 'title') {
      drawTitle(ctx, this.t);
      return;
    }
    if (this.mode === 'map') {
      drawWorldMap(ctx, this.save, this.cursor, this.t);
      return;
    }
    if (this.mode === 'credits') {
      drawBackground(ctx, 'jungle', this.t * 10, 0, this.t);
      ctx.fillStyle = 'rgba(10,20,8,0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#f6d03a';
      ctx.font = '28px "Titan One", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('ILHA SALVA', VIEW_W / 2, 80);
      ctx.fillStyle = '#fff6ea';
      ctx.font = '12px Nunito, system-ui';
      ctx.fillText('Kong Kong recuperou as bananas.', VIEW_W / 2, 112);
      ctx.fillText('O lenço vermelho voa ao vento da canópia.', VIEW_W / 2, 132);
      drawKong(ctx, VIEW_W / 2, 190, { facing: 1, t: this.t, state: 'idle', scarf: true });
      ctx.fillStyle = '#f6d03a';
      ctx.font = '11px Titan One, system-ui';
      ctx.fillText('ENTER — título', VIEW_W / 2, 250);
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
      drawBarrel(ctx, b.x, b.y, b.kind === 'cannon' ? 'cannon' : b.kind, this.t, b.angle || 0);
    }
    for (const e of level.enemies) {
      if (e.alive) drawEnemy(ctx, e, this.t);
    }
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
        flash: p.invuln > 0 && !p.dead
      });
    }

    for (const q of this.particles) {
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x, q.y, q.size, q.size);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    drawForeground(ctx, theme, this.camX, this.t);

    if (this.mode === 'play' || this.mode === 'pause' || this.mode === 'dying' || this.mode === 'clear') {
      drawHud(ctx, {
        lives: Math.max(0, this.lives),
        bananas: this.bananas,
        letters: this.gotLetters,
        levelName: level.def.title,
        scarf: p?.scarf,
        t: this.t
      });
    }

    if (this.toastT > 0) {
      ctx.fillStyle = 'rgba(12,20,10,0.7)';
      roundRect(ctx, VIEW_W / 2 - 90, 54, 180, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#f6d03a';
      ctx.font = '11px Titan One, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.toast, VIEW_W / 2, 65);
    }

    if (this.mode === 'pause') this.drawBanner(ctx, 'PAUSA', 'Enter para continuar');
    if (this.mode === 'clear') this.drawBanner(ctx, 'FASE CONCLUÍDA', 'Enter — próxima  ·  Esc — mapa');
    if (this.mode === 'gameover') this.drawBanner(ctx, 'FIM DE JOGO', 'Enter — título');
    if (this.mode === 'dying') {
      ctx.fillStyle = `rgba(80,0,0,${0.25 + (1 - this.overlayTimer) * 0.3})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawBanner(ctx, title, sub) {
    ctx.fillStyle = 'rgba(8,16,8,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#f6d03a';
    ctx.font = '28px Titan One, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 8);
    ctx.fillStyle = '#fff6ea';
    ctx.font = '11px Nunito, system-ui';
    ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 18);
  }

  tapMap(mx, my) {
    if (this.mode !== 'map') return;
    const nodes = [90, 150, 220, 290, 350, 410];
    const ys = [176, 148, 168, 140, 166, 132];
    for (let i = 0; i < nodes.length; i++) {
      if (i >= this.save.unlocked) continue;
      const dx = mx - nodes[i];
      const dy = my - ys[i];
      if (dx * dx + dy * dy < 22 * 22) {
        this.cursor = i;
        this.startLevel(i);
        return;
      }
    }
  }
}
