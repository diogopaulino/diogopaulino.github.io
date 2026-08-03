(() => {
  'use strict';

  const W = 1280;
  const H = 720;
  const GROUND = 620;
  // Keep the widest 440px source poses fully inside the 1280px arena.
  const LEFT_WALL = 190;
  const RIGHT_WALL = 1090;
  const STEP = 1000 / 60;
  const INPUT_BUFFER = 9;
  const PARRY_WINDOW = 4;
  const SPECIAL_COST = 40;
  const METER_GAIN = Object.freeze({ commit: .2, hit: .8, block: .55, damage: .65, guard: .3 });
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const random = (min, max) => min + Math.random() * (max - min);

  const canvas = $('#game');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  function makeGlow(inner, middle, outer = '#0000') {
    const glow = document.createElement('canvas');
    glow.width = glow.height = 256;
    const glowContext = glow.getContext('2d');
    const gradient = glowContext.createRadialGradient(128, 128, 3, 128, 128, 128);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(.22, middle);
    gradient.addColorStop(1, outer);
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 256, 256);
    return glow;
  }

  const floorShade = ctx.createLinearGradient(0, 500, 0, H);
  floorShade.addColorStop(0, '#00000000');
  floorShade.addColorStop(1, '#00000082');
  const coliseumGlow = makeGlow('#e9a45b28', '#e9a45b12');
  const projectileGlows = new Map();

  const FIGHTERS = [
    {
      id: 'kurt', name: 'Kurt Cobain', short: 'KURT', era: 'GRUNGE / BALANCED',
      style: 'Controle de espaço e impacto', special: 'Feedback Wave', sheet: 'assets/fighter-kurt-sheet-v2.webp',
      color: '#c6b06a', speed: 6.1, jump: 13.1, power: 82, mobility: 72, defense: 75,
      quote: 'Sem bis. Só feedback.'
    },
    {
      id: 'axl', name: 'Axl Rose', short: 'AXL', era: 'HARD ROCK / RUSHDOWN',
      style: 'Pressão, avanço e velocidade', special: 'Paradise Rush', sheet: 'assets/fighter-axl-sheet-v2.webp',
      color: '#c84d3c', speed: 6.7, jump: 13.4, power: 76, mobility: 90, defense: 66,
      quote: 'O palco nunca espera.'
    },
    {
      id: 'lennon', name: 'John Lennon', short: 'LENNON', era: 'ROCK / CONTROL',
      style: 'Defesa, contra-ataque e alcance', special: 'Peace Pulse', sheet: 'assets/fighter-lennon-sheet-v2.webp',
      color: '#729788', speed: 5.7, jump: 12.7, power: 74, mobility: 68, defense: 88,
      quote: 'Dê uma chance ao contra-ataque.'
    }
  ];

  const STAGES = {
    seattle: { name: 'SEATTLE RAIN', image: 'assets/stage-seattle.webp', tint: '#6f8da1', accent: '#d6a45b' },
    coliseum: { name: 'RED COLOSSEUM', image: 'assets/stage-coliseum.webp', tint: '#b83d31', accent: '#e5a14b' },
    cellar: { name: 'ABBEY CELLAR', image: 'assets/stage-cellar.webp', tint: '#7c8c77', accent: '#c38b52' }
  };

  const MOVES = {
    punch: { startup: 5, active: 3, recovery: 10, damage: 6, hitstun: 15, blockstun: 9, reach: 96, top: 245, bottom: 105, push: 18, hitstop: 5, meter: 10, sprite: 5, level: 'mid', cancel: ['kick', 'special'] },
    kick: { startup: 10, active: 4, recovery: 17, damage: 10, hitstun: 20, blockstun: 12, reach: 145, top: 270, bottom: 70, push: 30, hitstop: 8, meter: 15, sprite: 6, level: 'mid', cancel: ['special'] },
    sweep: { startup: 12, active: 4, recovery: 24, damage: 9, hitstun: 14, blockstun: 14, reach: 154, top: 76, bottom: 5, push: 36, hitstop: 8, meter: 14, sprite: 7, level: 'low', knockdown: 42 },
    uppercut: { startup: 6, active: 5, recovery: 25, damage: 11, hitstun: 22, blockstun: 15, reach: 104, top: 320, bottom: 34, push: 26, hitstop: 9, meter: 16, sprite: 8, level: 'mid', launch: 12.5 },
    airkick: { startup: 5, active: 9, recovery: 10, damage: 9, hitstun: 18, blockstun: 12, reach: 125, top: 210, bottom: 30, push: 30, hitstop: 7, meter: 14, sprite: 6, level: 'overhead' }
  };

  const AI = {
    easy: { think: [16, 28], guard: .38, attack: .46, punish: .28 },
    normal: { think: [9, 18], guard: .62, attack: .68, punish: .58 },
    hard: { think: [4, 10], guard: .82, attack: .86, punish: .82 }
  };

  const FRAME = { idleA: 0, idleB: 1, forward: 2, back: 3, crouch: 4, punch: 5, kick: 6, sweep: 7, uppercut: 8, block: 9, hit: 10, victory: 11 };
  const images = new Map();
  let assetsReady = false;
  let selected = null;
  let selectedCpu = null;
  let stageId = 'seattle';
  let difficulty = localStorage.getItem('rk-difficulty') || 'normal';
  let match = null;
  let paused = false;
  let animationId = 0;
  let lastTime = performance.now();
  let accumulator = 0;
  let frameNumber = 0;
  let hudSignature = '';

  class InputBuffer {
    constructor() { this.held = new Set(); this.pressed = new Map(); }
    down(action) { if (!this.held.has(action)) this.pressed.set(action, frameNumber); this.held.add(action); }
    up(action) { this.held.delete(action); }
    tap(action) { this.pressed.set(action, frameNumber); }
    has(action) { return this.held.has(action); }
    fresh(action, window = 1) { return this.pressed.has(action) && frameNumber - this.pressed.get(action) <= window; }
    consume(action, window = INPUT_BUFFER) {
      if (!this.pressed.has(action) || frameNumber - this.pressed.get(action) > window) return false;
      this.pressed.delete(action); return true;
    }
    clearDirections() { ['left', 'right', 'down', 'jump'].forEach(key => this.held.delete(key)); }
    clear() { this.held.clear(); this.pressed.clear(); }
  }

  const playerInput = new InputBuffer();
  const cpuInput = new InputBuffer();

  function moveFor(fighter, name) {
    if (name !== 'special') return { name, ...MOVES[name] };
    const superMove = fighter.meter >= 100;
    if (fighter.data.id === 'axl') {
      return { name: superMove ? 'super' : 'special', startup: superMove ? 13 : 9, active: superMove ? 10 : 7, recovery: 24, damage: superMove ? 24 : 14, hitstun: 28, blockstun: 16, reach: superMove ? 270 : 215, top: 270, bottom: 35, push: 58, hitstop: superMove ? 14 : 10, meter: 0, sprite: 6, level: 'mid', rush: superMove ? 18 : 13, superMove };
    }
    return { name: superMove ? 'super' : 'special', startup: superMove ? 17 : 12, active: 1, recovery: superMove ? 34 : 27, damage: superMove ? 22 : 13, hitstun: 26, blockstun: 15, reach: 0, top: 260, bottom: 55, push: 48, hitstop: superMove ? 13 : 9, meter: 0, sprite: 8, level: 'mid', projectile: true, superMove };
  }

  class Fighter {
    constructor(data, input, isCpu = false) {
      this.data = data; this.input = input; this.isCpu = isCpu;
      this.image = images.get(data.sheet); this.wins = 0; this.reset(isCpu ? 910 : 370);
    }
    reset(x, preserveMeter = false) {
      const carriedMeter = preserveMeter ? this.meter : 0;
      this.x = x; this.y = GROUND; this.vx = 0; this.vy = 0; this.facing = this.isCpu ? -1 : 1;
      this.health = 100; this.whiteHealth = 100; this.meter = carriedMeter; this.state = 'idle'; this.stateFrame = 0;
      this.move = null; this.moveFrame = 0; this.moveConnected = false; this.moveHit = false; this.hitstun = 0;
      this.blockstun = 0; this.knockdown = 0; this.invuln = 0; this.combo = 0; this.comboClock = 0;
    }
    grounded() { return this.y >= GROUND - .1; }
    neutral() { return ['idle', 'walk', 'crouch', 'jump'].includes(this.state); }
    gainMeter(amount) { this.meter = clamp(this.meter + amount, 0, 100); }
    directionTo(opponent) { return opponent.x > this.x ? 1 : -1; }
    awayHeld(opponent) { return this.directionTo(opponent) === 1 ? this.input.has('left') : this.input.has('right'); }
    blocking(opponent, move) {
      if (!this.neutral() || !this.grounded() || !this.awayHeld(opponent)) return false;
      if (move.level === 'low') return this.input.has('down');
      if (move.level === 'overhead') return !this.input.has('down');
      return true;
    }
    parrying(opponent) {
      const away = this.directionTo(opponent) === 1 ? 'left' : 'right';
      return this.input.fresh(away, PARRY_WINDOW);
    }
    beginMove(name) {
      let next = moveFor(this, name);
      if (this.move) {
        const cancelable = this.moveConnected && this.move.cancel && this.move.cancel.includes(name);
        if (!cancelable) return false;
      } else if (!this.neutral()) return false;
      if (name === 'special') {
        if (this.meter < SPECIAL_COST) return false;
        this.meter = next.superMove ? 0 : this.meter - SPECIAL_COST;
      } else {
        this.gainMeter(next.meter * METER_GAIN.commit);
      }
      this.move = next; this.moveFrame = 0; this.moveConnected = false; this.moveHit = false; this.state = 'attack';
      RKAudio.sfx(next.superMove ? 'super' : name === 'special' ? 'special' : 'whiff', next.damage / 10);
      if (next.superMove) { match.freeze = 18; match.shake = 8; announce(`${this.data.short} SUPER`, 900); }
      return true;
    }
    chooseAction() {
      if (this.input.consume('special')) return this.beginMove('special');
      if (this.input.consume('kick')) return this.beginMove(!this.grounded() ? 'airkick' : this.input.has('down') ? 'sweep' : 'kick');
      if (this.input.consume('punch')) return this.beginMove(this.input.has('down') && this.grounded() ? 'uppercut' : 'punch');
      return false;
    }
    update(opponent) {
      this.stateFrame++; if (this.invuln > 0) this.invuln--; if (this.comboClock > 0) this.comboClock--; else this.combo = 0;
      this.whiteHealth += (this.health - this.whiteHealth) * .045;
      this.facing = this.directionTo(opponent);

      if (this.state === 'hitstun') {
        this.hitstun--; this.x += this.vx; this.vx *= .88;
        if (!this.grounded() || this.vy) { this.y += this.vy; this.vy += .72; if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; } }
        if (this.hitstun <= 0) this.state = this.grounded() ? 'idle' : 'jump';
        return;
      }
      if (this.state === 'blockstun') { if (--this.blockstun <= 0) this.state = 'idle'; return; }
      if (this.state === 'knockdown') { if (--this.knockdown <= 0) { this.state = 'idle'; this.invuln = 18; } return; }
      if (this.state === 'victory') return;

      if (this.move) {
        this.moveFrame++;
        if (this.move.rush && this.moveFrame <= this.move.startup + this.move.active) this.x += this.facing * this.move.rush;
        if (this.move.projectile && !this.move.spawned && this.moveFrame === this.move.startup) {
          this.move.spawned = true; spawnProjectile(this, this.move);
        }
        this.chooseAction();
        if (this.move && this.moveFrame >= this.move.startup + this.move.active + this.move.recovery) {
          this.move = null; this.state = this.grounded() ? 'idle' : 'jump';
        }
      } else {
        if (this.chooseAction()) return;
        if (this.input.consume('jump') && this.grounded()) { this.vy = -this.data.jump; this.state = 'jump'; }
        const direction = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
        if (this.grounded() && this.input.has('down')) this.state = 'crouch';
        else if (direction) { this.x += direction * this.data.speed; this.state = 'walk'; }
        else if (this.grounded()) this.state = 'idle';
      }

      if (!this.grounded() || this.vy) {
        this.y += this.vy; this.vy += .72; this.state = this.move ? 'attack' : 'jump';
        if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; if (!this.move) this.state = 'idle'; }
      }
      this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
    }
    activeBox() {
      if (!this.move || this.move.projectile || this.moveHit) return null;
      if (this.moveFrame < this.move.startup || this.moveFrame >= this.move.startup + this.move.active) return null;
      const near = this.x + this.facing * 28;
      const far = this.x + this.facing * this.move.reach;
      return { left: Math.min(near, far), right: Math.max(near, far), top: this.y - this.move.top, bottom: this.y - this.move.bottom };
    }
    hurtBox() {
      const crouching = this.state === 'crouch' || (this.move && this.move.name === 'sweep');
      return { left: this.x - 42, right: this.x + 42, top: this.y - (crouching ? 175 : 305), bottom: this.y - 10 };
    }
    spriteFrame() {
      if (this.state === 'victory') return FRAME.victory;
      if (this.state === 'hitstun' || this.state === 'knockdown') return FRAME.hit;
      if (this.state === 'blockstun' || (this.neutral() && this.awayHeld(this.isCpu ? match.p1 : match.p2))) return FRAME.block;
      if (this.move) return this.move.sprite;
      if (this.state === 'crouch') return FRAME.crouch;
      if (this.state === 'walk') return this.facing * ((this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0)) > 0 ? FRAME.forward : FRAME.back;
      if (this.state === 'jump') return FRAME.forward;
      return Math.floor(this.stateFrame / 18) % 2 ? FRAME.idleB : FRAME.idleA;
    }
  }

  function overlap(a, b) { return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }

  function addImpact(x, y, color, heavy = false) {
    const count = heavy ? 22 : 12;
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2), speed = random(2, heavy ? 11 : 7);
      match.effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(12, heavy ? 28 : 20), size: random(2, heavy ? 7 : 5), color });
    }
    match.rings.push({ x, y, life: heavy ? 16 : 11, max: heavy ? 16 : 11, color });
  }

  function applyHit(attacker, defender, move, projectile = null) {
    const blocked = defender.blocking(attacker, move);
    const parry = blocked && defender.parrying(attacker);
    const impactX = lerp(attacker.x, defender.x, .7);
    const impactY = defender.y - (move.level === 'low' ? 65 : 190);
    if (parry) {
      defender.gainMeter(24); attacker.state = 'hitstun'; attacker.hitstun = 13; attacker.vx = -attacker.facing * 3;
      match.hitStop = 9; match.shake = 3; addImpact(impactX, impactY, '#b9f2ff', true); RKAudio.sfx('parry');
    } else if (blocked) {
      const chip = Math.max(1, Math.floor(move.damage * .12)); defender.health = clamp(defender.health - chip, 0, 100);
      defender.state = 'blockstun'; defender.blockstun = move.blockstun; defender.x += attacker.facing * move.push * .45;
      attacker.gainMeter(move.meter * METER_GAIN.block); defender.gainMeter(Math.max(2, move.damage * METER_GAIN.guard));
      match.hitStop = Math.max(3, move.hitstop - 2); match.shake = 2;
      addImpact(impactX, impactY, '#a8c9ce'); RKAudio.sfx('block');
    } else {
      defender.health = clamp(defender.health - move.damage, 0, 100); defender.state = move.knockdown ? 'knockdown' : 'hitstun';
      defender.hitstun = move.hitstun; defender.knockdown = move.knockdown || 0; defender.vx = attacker.facing * move.push * .2;
      if (move.launch) defender.vy = -move.launch;
      attacker.gainMeter(move.meter * METER_GAIN.hit); defender.gainMeter(Math.max(4, move.damage * METER_GAIN.damage)); attacker.moveConnected = true;
      attacker.combo = attacker.comboClock > 0 ? attacker.combo + 1 : 1; attacker.comboClock = 55;
      match.hitStop = move.hitstop; match.shake = move.damage >= 10 ? 7 : 4;
      addImpact(impactX, impactY, attacker.data.color, move.damage >= 10); RKAudio.sfx(move.damage >= 10 ? 'heavy' : 'light', move.damage / 10);
      if (attacker.combo >= 2) showCombo(attacker);
    }
    if (projectile) projectile.dead = true; else attacker.moveHit = true;
  }

  function spawnProjectile(owner, move) {
    const superScale = move.superMove ? 1.8 : 1;
    match.projectiles.push({ owner, move, x: owner.x + owner.facing * 75, y: owner.y - 155, vx: owner.facing * (move.superMove ? 13 : owner.data.id === 'lennon' ? 9.5 : 10.5), radius: 30 * superScale, life: move.superMove ? 95 : 75, color: owner.data.color, dead: false });
    match.rings.push({ x: owner.x + owner.facing * 50, y: owner.y - 160, life: 22, max: 22, color: owner.data.color });
  }

  function updateProjectiles() {
    for (let index = match.projectiles.length - 1; index >= 0; index--) {
      const p = match.projectiles[index];
      p.x += p.vx; p.life--;
      const defender = p.owner === match.p1 ? match.p2 : match.p1;
      const box = { left: p.x - p.radius, right: p.x + p.radius, top: p.y - p.radius, bottom: p.y + p.radius };
      if (!p.dead && defender.invuln <= 0 && overlap(box, defender.hurtBox())) applyHit(p.owner, defender, p.move, p);
      if (p.life <= 0 || p.x < 0 || p.x > W) p.dead = true;
      if (p.dead) match.projectiles.splice(index, 1);
    }
  }

  function resolveCombat(attacker, defender) {
    if (defender.invuln > 0) return;
    if (overlap(attacker.activeBox(), defender.hurtBox())) applyHit(attacker, defender, attacker.move);
  }

  function bodyPush() {
    const a = match.p1, b = match.p2;
    if (!a.grounded() || !b.grounded()) return;
    const gap = b.x - a.x;
    if (Math.abs(gap) < 92) {
      const push = (92 - Math.abs(gap)) / 2, sign = gap >= 0 ? 1 : -1;
      a.x -= push * sign; b.x += push * sign;
      a.x = clamp(a.x, LEFT_WALL, RIGHT_WALL); b.x = clamp(b.x, LEFT_WALL, RIGHT_WALL);
    }
  }

  function updateCpu() {
    const cpu = match.p2, player = match.p1, config = AI[difficulty];
    if (--match.cpuThink > 0) return;
    match.cpuThink = Math.floor(random(config.think[0], config.think[1])); cpuInput.clearDirections();
    if (!cpu.neutral()) return;
    const distance = Math.abs(player.x - cpu.x);
    const toward = player.x < cpu.x ? 'left' : 'right';
    const away = toward === 'left' ? 'right' : 'left';
    const threat = player.move && player.moveFrame < player.move.startup + player.move.active + 2 && distance < player.move.reach + 95;
    if (threat && Math.random() < config.guard) {
      cpuInput.down(away); if (player.move.level === 'low' || Math.random() < .32) cpuInput.down('down'); return;
    }
    // Close into the actual normal-attack ranges before making a decision.
    // This avoids visually plausible but mechanically empty attacks.
    if (distance > 175) {
      if (cpu.meter >= SPECIAL_COST && Math.random() < config.attack * .35) cpuInput.tap('special');
      else cpuInput.down(toward);
      return;
    }
    if (distance < 125 && Math.random() > config.attack) { cpuInput.down(away); return; }
    if (Math.random() < config.attack) {
      const roll = Math.random();
      if (cpu.meter >= SPECIAL_COST && roll < .18) cpuInput.tap('special');
      else if (player.y < GROUND - 60 && roll < config.punish) { cpuInput.down('down'); cpuInput.tap('punch'); }
      else if (roll < .42) cpuInput.tap('punch');
      else if (roll < .82) cpuInput.tap('kick');
      else { cpuInput.down('down'); cpuInput.tap('kick'); }
    }
  }

  function updateEffects() {
    for (let index = match.effects.length - 1; index >= 0; index--) {
      const fx = match.effects[index]; fx.x += fx.vx; fx.y += fx.vy; fx.vx *= .94; fx.vy *= .94;
      if (--fx.life <= 0) match.effects.splice(index, 1);
    }
    for (let index = match.rings.length - 1; index >= 0; index--) if (--match.rings[index].life <= 0) match.rings.splice(index, 1);
    match.shake *= .78; if (match.shake < .15) match.shake = 0;
  }

  function fixedUpdate() {
    if (!match || paused) return;
    frameNumber++;
    if (match.freeze > 0) { match.freeze--; updateEffects(); return; }
    if (match.hitStop > 0) { match.hitStop--; updateEffects(); return; }

    if (match.phase === 'intro') {
      if (--match.phaseFrame === 70) { announce('FIGHT!', 850); RKAudio.sfx('round'); }
      if (match.phaseFrame <= 0) match.phase = 'fight';
      updateEffects(); return;
    }
    if (match.phase === 'roundEnd') {
      if (--match.phaseFrame <= 0) finishRound();
      updateEffects(); return;
    }
    if (match.phase !== 'fight') return;

    updateCpu(); match.p1.update(match.p2); match.p2.update(match.p1); bodyPush();
    resolveCombat(match.p1, match.p2); resolveCombat(match.p2, match.p1); updateProjectiles(); updateEffects();
    if (--match.timerFrames % 60 === 0) $('#timer').textContent = Math.max(0, Math.ceil(match.timerFrames / 60));
    if (match.p1.health <= 0 || match.p2.health <= 0 || match.timerFrames <= 0) endRound();
    if ((frameNumber & 1) === 0) updateHud();
  }

  function endRound() {
    if (match.phase !== 'fight') return;
    match.phase = 'roundEnd'; match.phaseFrame = 145; RKAudio.sfx('ko');
    const winner = match.p1.health === match.p2.health ? (match.p1.health >= match.p2.health ? match.p1 : match.p2) : match.p1.health > match.p2.health ? match.p1 : match.p2;
    match.roundWinner = winner; winner.wins++; winner.state = 'victory';
    announce(match.timerFrames <= 0 ? 'TIME!' : 'K.O.!', 1000); updateHud();
  }

  function finishRound() {
    if (match.roundWinner.wins >= 2) { finishMatch(match.roundWinner); return; }
    match.round++; match.p1.reset(370, true); match.p2.reset(910, true); startRound();
  }

  function startRound() {
    match.timerFrames = 99 * 60; match.phase = 'intro'; match.phaseFrame = 140; match.projectiles.length = 0; match.effects.length = 0; match.rings.length = 0; match.cpuThink = 30;
    $('#round-label').textContent = `ROUND ${match.round}`; $('#timer').textContent = '99'; updateHud();
    announce(`ROUND ${match.round}`, 900);
  }

  function startMatch() {
    if (!selected || !assetsReady) return;
    selectedCpu = selectedCpu || FIGHTERS.filter(f => f !== selected)[Math.floor(Math.random() * 2)];
    playerInput.clear(); cpuInput.clear();
    match = { p1: new Fighter(selected, playerInput), p2: new Fighter(selectedCpu, cpuInput, true), round: 1, timerFrames: 99 * 60, phase: 'intro', phaseFrame: 140, hitStop: 0, freeze: 0, shake: 0, effects: [], rings: [], projectiles: [], cpuThink: 30, stage: STAGES[stageId], stageId };
    showScreen('arena-screen'); RKAudio.startMusic(stageId); startRound();
  }

  function finishMatch(winner) {
    match.phase = 'complete'; RKAudio.stopMusic(); RKAudio.sfx('win');
    setTimeout(() => {
      const figure = $('#result-figure'); figure.style.setProperty('--sheet', `url("${winner.data.sheet}")`);
      $('#result-title').innerHTML = `${winner.data.short} <em>VENCEU</em>`; $('#result-copy').textContent = winner.data.quote;
      $('#result-overline').textContent = winner === match.p1 ? 'PLAYER 1 WINS' : 'CPU WINS'; showScreen('results-screen');
    }, 650);
  }

  function updateHud() {
    if (!match) return;
    const p1 = match.p1, p2 = match.p2;
    const nextSignature = [
      p1.data.id, p2.data.id,
      Math.round(p1.health * 10), Math.round(p2.health * 10),
      Math.round(p1.whiteHealth * 10), Math.round(p2.whiteHealth * 10),
      Math.round(p1.meter), Math.round(p2.meter), p1.wins, p2.wins
    ].join('|');
    if (nextSignature === hudSignature) return;
    hudSignature = nextSignature;
    $('#p1-name').textContent = p1.data.short; $('#p2-name').textContent = p2.data.short;
    $('#p1-life').style.transform = `scaleX(${p1.health / 100})`; $('#p2-life').style.transform = `scaleX(${p2.health / 100})`;
    $('#p1-chip').style.transform = `scaleX(${p1.whiteHealth / 100})`; $('#p2-chip').style.transform = `scaleX(${p2.whiteHealth / 100})`;
    $('#p1-meter').style.width = `${p1.meter}%`; $('#p2-meter').style.width = `${p2.meter}%`;
    $('#p1-meter-label').textContent = p1.meter >= 100 ? 'SUPER' : p1.meter >= SPECIAL_COST ? 'READY' : `${Math.floor(p1.meter)}%`;
    $('#p2-meter-label').textContent = p2.meter >= 100 ? 'SUPER' : p2.meter >= SPECIAL_COST ? 'READY' : `${Math.floor(p2.meter)}%`;
    [1, 2].forEach(n => { $(`#p1-win-${n}`).classList.toggle('won', p1.wins >= n); $(`#p2-win-${n}`).classList.toggle('won', p2.wins >= n); });
  }

  function drawStage() {
    const image = images.get(match.stage.image); ctx.drawImage(image, 0, 0, W, H);
    const frame = frameNumber;
    if (match.stageId === 'seattle') {
      ctx.save(); ctx.strokeStyle = '#b8d2e05c'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 75; i++) { const x = (i * 97 + frame * 7) % W, y = (i * 53 + frame * 13) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 22); ctx.stroke(); }
      ctx.restore();
    } else if (match.stageId === 'coliseum') {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) { const x = 180 + i * 230 + Math.sin(frame * .012 + i) * 65; ctx.drawImage(coliseumGlow, x - 100, 70, 200, 200); }
      ctx.restore();
    } else {
      ctx.save(); ctx.fillStyle = '#d9b77b22';
      for (let i = 0; i < 30; i++) { const x = (i * 137 + frame * .22) % W, y = 120 + ((i * 89 - frame * .12 + H) % 430); ctx.beginPath(); ctx.arc(x, y, 1.4 + i % 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = floorShade; ctx.fillRect(0, 500, W, 220);
  }

  function drawShadow(fighter) {
    const air = GROUND - fighter.y; ctx.save(); ctx.globalAlpha = clamp(.48 - air * .002, .12, .48); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(fighter.x, GROUND + 4, clamp(72 - air * .13, 22, 72), 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawFighter(fighter) {
    const image = fighter.image, index = fighter.spriteFrame();
    const cellW = image.naturalWidth / 4, cellH = image.naturalHeight / 3, col = index % 4, row = Math.floor(index / 4);
    const size = 405; ctx.save(); ctx.translate(fighter.x, fighter.y);
    if (fighter.facing < 0) ctx.scale(-1, 1);
    if (fighter.state === 'knockdown') ctx.translate(0, 8);
    if (fighter.invuln > 0 && Math.floor(fighter.invuln / 3) % 2 === 0) ctx.globalAlpha = .45;
    ctx.filter = fighter.hitstun > 0 && fighter.hitstun > (fighter.move ? 0 : 12) ? 'brightness(1.7) saturate(.55)' : 'none';
    ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -size / 2, -size, size, size);
    ctx.restore();
  }

  function drawProjectiles() {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const p of match.projectiles) {
      if (!projectileGlows.has(p.color)) projectileGlows.set(p.color, makeGlow('#fff', p.color));
      const glowSize = p.radius * 4.4;
      ctx.drawImage(projectileGlows.get(p.color), p.x - glowSize / 2, p.y - glowSize / 2, glowSize, glowSize);
      ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, frameNumber * .08, frameNumber * .08 + Math.PI * 1.45); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEffects() {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const fx of match.effects) { ctx.globalAlpha = clamp(fx.life / 18, 0, 1); ctx.fillStyle = fx.color; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2); ctx.fill(); }
    for (const ring of match.rings) { const progress = 1 - ring.life / ring.max; ctx.globalAlpha = 1 - progress; ctx.strokeStyle = ring.color; ctx.lineWidth = 5 * (1 - progress); ctx.beginPath(); ctx.arc(ring.x, ring.y, 16 + progress * 82, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, W, H);
    if (!match) return;
    ctx.save(); if (match.shake) ctx.translate(random(-match.shake, match.shake), random(-match.shake * .5, match.shake * .5));
    drawStage(); drawShadow(match.p1); drawShadow(match.p2); drawFighter(match.p1); drawFighter(match.p2); drawProjectiles(); drawEffects();
    if (match.freeze > 0) { ctx.fillStyle = `rgba(255,255,255,${match.freeze / 70})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function loop(now) {
    const delta = Math.min(50, now - lastTime); lastTime = now; accumulator += delta;
    while (accumulator >= STEP) { fixedUpdate(); accumulator -= STEP; }
    render(); animationId = requestAnimationFrame(loop);
  }

  function announce(text, duration = 850) {
    const el = $('#announce'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), duration);
  }
  function showCombo(fighter) {
    const el = fighter === match.p1 ? $('#p1-combo') : $('#p2-combo'); el.innerHTML = `${fighter.combo} <small>HITS</small>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function showScreen(id) { $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === id)); window.scrollTo(0, 0); }

  function renderRoster() {
    $('#roster').innerHTML = FIGHTERS.map(f => `
      <button class="fighter-card" role="listitem" data-fighter="${f.id}" style="--fighter:${f.color}" aria-label="Selecionar ${f.name}, ${f.era}">
        <div class="fighter-visual"><i class="fighter-sprite" style="--sheet:url('${f.sheet}')"></i></div>
        <footer><small>${f.era}</small><h3>${f.name}</h3><p>${f.style}<br>Especial: ${f.special}</p>
          <div class="stats"><span><b>POWER</b><i style="--value:${f.power}%"></i></span><span><b>MOBILITY</b><i style="--value:${f.mobility}%"></i></span><span><b>DEFENSE</b><i style="--value:${f.defense}%"></i></span></div>
        </footer>
      </button>`).join('');
    $$('.fighter-card').forEach(card => card.addEventListener('click', () => {
      selected = FIGHTERS.find(f => f.id === card.dataset.fighter);
      const others = FIGHTERS.filter(f => f.id !== selected.id); selectedCpu = others[Math.floor(Math.random() * others.length)];
      $$('.fighter-card').forEach(item => item.classList.toggle('is-selected', item === card));
      $('#p1-preview').textContent = selected.short; $('#cpu-preview').textContent = selectedCpu.short; $('#fight-button').disabled = false; RKAudio.sfx('ui');
    }));
  }

  function bindInputs() {
    const keyMap = {
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyS: 'down', ArrowDown: 'down',
      KeyW: 'jump', ArrowUp: 'jump', KeyJ: 'punch', KeyQ: 'punch', KeyK: 'kick', KeyE: 'kick', KeyL: 'special', KeyR: 'special', Space: 'special'
    };
    addEventListener('keydown', event => {
      const action = keyMap[event.code]; if (action) { event.preventDefault(); playerInput.down(action); RKAudio.ensure(); }
      if (event.code === 'Escape') togglePause();
    });
    addEventListener('keyup', event => { const action = keyMap[event.code]; if (action) playerInput.up(action); });
    $$('[data-input]').forEach(button => {
      const action = button.dataset.input;
      const down = event => { event.preventDefault(); playerInput.down(action); button.classList.add('is-down'); RKAudio.ensure(); };
      const up = event => { event.preventDefault(); playerInput.up(action); button.classList.remove('is-down'); };
      button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
    });
  }

  function togglePause(force) {
    if (!match || match.phase === 'complete') return;
    paused = typeof force === 'boolean' ? force : !paused; $('#pause-layer').hidden = !paused;
    if (paused) RKAudio.stopMusic(); else { lastTime = performance.now(); accumulator = 0; RKAudio.startMusic(stageId); }
  }

  async function loadAssets() {
    const paths = [...FIGHTERS.map(f => f.sheet), ...Object.values(STAGES).map(s => s.image)];
    await Promise.all(paths.map(path => new Promise((resolve, reject) => {
      const image = new Image(); image.decoding = 'async'; image.onload = () => { images.set(path, image); resolve(); }; image.onerror = () => reject(new Error(`Falha ao carregar ${path}`)); image.src = path;
    })));
    assetsReady = true; $('#loading').classList.add('is-ready');
  }

  $('#enter-button').addEventListener('click', () => { RKAudio.ensure(); RKAudio.sfx('ui'); showScreen('select-screen'); });
  $('#select-back').addEventListener('click', () => showScreen('hero-screen'));
  $('#fight-button').addEventListener('click', startMatch);
  $('#rematch-button').addEventListener('click', startMatch);
  $('#change-button').addEventListener('click', () => { match = null; selected = null; selectedCpu = null; $('#fight-button').disabled = true; $$('.fighter-card').forEach(card => card.classList.remove('is-selected')); showScreen('select-screen'); });
  $('#pause-button').addEventListener('click', () => togglePause()); $('#resume-button').addEventListener('click', () => togglePause(false));
  $('#quit-button').addEventListener('click', () => { paused = false; $('#pause-layer').hidden = true; RKAudio.stopMusic(); match = null; showScreen('select-screen'); });
  $('#help-button').addEventListener('click', () => $('#help-dialog').showModal()); $('#help-close').addEventListener('click', () => $('#help-dialog').close());
  $('#sound-button').addEventListener('click', event => { const muted = !RKAudio.muted; RKAudio.setMuted(muted); event.currentTarget.textContent = muted ? 'SOM OFF' : 'SOM ON'; if (!muted) RKAudio.ensure(); });
  $('#sound-button').textContent = RKAudio.muted ? 'SOM OFF' : 'SOM ON';
  $$('#stage-options .option').forEach(button => button.addEventListener('click', () => { stageId = button.dataset.stage; $$('#stage-options .option').forEach(item => item.classList.toggle('is-active', item === button)); RKAudio.sfx('ui'); }));
  $$('#difficulty-options button').forEach(button => { button.classList.toggle('is-active', button.dataset.difficulty === difficulty); button.addEventListener('click', () => { difficulty = button.dataset.difficulty; localStorage.setItem('rk-difficulty', difficulty); $$('#difficulty-options button').forEach(item => item.classList.toggle('is-active', item === button)); RKAudio.sfx('ui'); }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && match && !paused) togglePause(true); });

  renderRoster(); bindInputs(); loadAssets().catch(error => { $('#loading span').textContent = error.message; console.error(error); });
  animationId = requestAnimationFrame(loop);
})();
