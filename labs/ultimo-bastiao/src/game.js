import { PLAYER, ATTACKS, DIFFICULTY, WAVES, ENEMY_TYPES, QUALITY, STORAGE_KEY } from './config.js';
import { BattleAudio } from './audio.js';
import { BattleInput } from './input.js';
import { createWorld } from './world.js';
import { createKnight, animateKnight } from './characters.js';

const B = window.BABYLON;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, smoothing, dt) => B.Scalar.Lerp(current, target, 1 - Math.exp(-smoothing * dt));
const lerpAngle = (current, target, smoothing, dt) => {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-smoothing * dt));
};
const flatDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const forwardFrom = angle => new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
const roman = value => ['I', 'II', 'III', 'IV'][value] || String(value + 1);

class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.healthFill = document.getElementById('healthFill');
    this.staminaFill = document.getElementById('staminaFill');
    this.healthValue = document.getElementById('healthValue');
    this.staminaValue = document.getElementById('staminaValue');
    this.waveLabel = document.getElementById('waveLabel');
    this.objective = document.getElementById('objectiveLabel');
    this.enemyCount = document.getElementById('enemyCount');
    this.killCount = document.getElementById('killCount');
    this.comboLabel = document.getElementById('comboLabel');
    this.targetPanel = document.getElementById('targetPanel');
    this.targetName = document.getElementById('targetName');
    this.targetDistance = document.getElementById('targetDistance');
    this.targetFill = document.getElementById('targetFill');
    this.messageElement = document.getElementById('battleMessage');
    this.damageFlash = document.getElementById('damageFlash');
    this.messageTimeout = null;
    this.damageTimeout = null;
  }

  setVitals(player) {
    const healthRatio = clamp(player.health / player.maxHealth, 0, 1);
    const staminaRatio = clamp(player.stamina / PLAYER.maxStamina, 0, 1);
    this.healthFill.style.transform = `scaleX(${healthRatio})`;
    this.staminaFill.style.transform = `scaleX(${staminaRatio})`;
    this.healthValue.textContent = Math.ceil(player.health);
    this.staminaValue.textContent = Math.ceil(player.stamina);
  }

  setWave(index, title, alive) {
    this.waveLabel.textContent = `ONDA ${roman(index)}`;
    this.objective.textContent = title;
    this.enemyCount.textContent = alive === 1 ? '1 invasor' : `${alive} invasores`;
  }

  setTarget(target, distance) {
    if (!target || target.dead || distance > 13) {
      this.targetPanel.hidden = true;
      return;
    }
    this.targetPanel.hidden = false;
    this.targetName.textContent = target.data.name;
    this.targetDistance.textContent = `${Math.round(distance)} m`;
    this.targetFill.style.transform = `scaleX(${clamp(target.health / target.maxHealth, 0, 1)})`;
  }

  setKills(kills, unhurt) {
    this.killCount.textContent = String(kills);
    this.comboLabel.textContent = unhurt ? 'SEM FERIMENTOS' : 'A MURALHA RESISTE';
  }

  message(text, duration = 1900) {
    clearTimeout(this.messageTimeout);
    this.messageElement.textContent = text;
    this.messageElement.classList.add('show');
    this.messageTimeout = setTimeout(() => this.messageElement.classList.remove('show'), duration);
  }

  damage() {
    clearTimeout(this.damageTimeout);
    this.damageFlash.classList.add('active');
    this.damageTimeout = setTimeout(() => this.damageFlash.classList.remove('active'), 95);
  }
}

class PlayerController {
  constructor(game) {
    this.game = game;
    this.rig = createKnight(game.scene, game.world, { enemy: false, kind: 'player' });
    this.rig.root.position.copyFromFloats(0, 0, 17);
    this.yaw = Math.PI;
    this.rig.root.rotation.y = this.yaw;
    this.velocity = B.Vector3.Zero();
    this.maxHealth = PLAYER.maxHealth;
    this.health = this.maxHealth;
    this.stamina = PLAYER.maxStamina;
    this.attack = null;
    this.dodgeTimer = 0;
    this.dodgeDirection = new B.Vector3(0, 0, -1);
    this.invulnerable = 0;
    this.hurt = 0;
    this.blocking = false;
    this.blockStarted = 0;
    this.lastBlocking = false;
    this.dead = false;
    this.wasHit = false;
  }

  reset(difficulty) {
    this.maxHealth = DIFFICULTY[difficulty].playerHealth;
    this.health = this.maxHealth;
    this.stamina = PLAYER.maxStamina;
    this.attack = null;
    this.dodgeTimer = 0;
    this.invulnerable = 0;
    this.hurt = 0;
    this.blocking = false;
    this.dead = false;
    this.wasHit = false;
    this.velocity.setAll(0);
    this.rig.root.position.copyFromFloats(0, 0, 17);
    this.yaw = Math.PI;
    this.rig.root.rotation.y = this.yaw;
    this.rig.root.rotation.z = 0;
    this.rig.pose.dead = false;
  }

  startAttack(kind) {
    const data = ATTACKS[kind];
    const cost = kind === 'heavy' ? PLAYER.heavyCost : PLAYER.lightCost;
    if (this.dead || this.attack || this.dodgeTimer > 0 || this.stamina < cost) return false;
    this.stamina -= cost;
    this.attack = { kind, time: 0, hit: false, data };
    this.blocking = false;
    this.game.audio.swing(kind === 'heavy');
    return true;
  }

  startDodge(moveDirection) {
    if (this.dead || this.attack || this.dodgeTimer > 0 || this.stamina < PLAYER.dodgeCost) return false;
    this.stamina -= PLAYER.dodgeCost;
    this.dodgeTimer = PLAYER.dodgeTime;
    this.invulnerable = Math.max(this.invulnerable, .34);
    this.dodgeDirection = moveDirection.lengthSquared() > .05 ? moveDirection.normalize() : forwardFrom(this.yaw);
    this.game.audio.dodge();
    return true;
  }

  receiveDamage(amount, attacker) {
    if (this.dead || this.invulnerable > 0) return false;
    const directionAngle = angleTo(this.rig.root.position, attacker.rig.root.position);
    const facingDifference = Math.cos(directionAngle - this.yaw);
    if (this.blocking && facingDifference > -.1 && this.stamina > 0) {
      const perfect = performance.now() - this.blockStarted < 240;
      const staminaDamage = amount * (perfect ? .34 : .72);
      this.stamina = Math.max(0, this.stamina - staminaDamage);
      this.game.audio.block(perfect);
      this.game.world.burst(this.rig.root.position.add(new B.Vector3(0, 2, 0)), 'spark', perfect ? 13 : 7);
      this.game.shake = Math.max(this.game.shake, perfect ? .13 : .08);
      if (perfect) {
        attacker.stagger = Math.max(attacker.stagger, 1.05);
        attacker.attack = null;
        this.game.hud.message('APARO PERFEITO', 750);
      }
      if (this.stamina <= 1) {
        this.blocking = false;
        this.hurt = .55;
        this.game.hud.message('GUARDA QUEBRADA', 900);
      }
      return true;
    }

    this.health = Math.max(0, this.health - amount);
    this.hurt = .65;
    this.invulnerable = .52;
    this.wasHit = true;
    this.game.hud.damage();
    this.game.audio.hit(false);
    this.game.world.burst(this.rig.root.position.add(new B.Vector3(0, 1.45, 0)), 'blood', 8);
    this.game.shake = Math.max(this.game.shake, .24);
    const away = this.rig.root.position.subtract(attacker.rig.root.position); away.y = 0;
    if (away.lengthSquared() > .01) this.rig.root.position.addInPlace(away.normalize().scale(.55));
    if (this.health <= 0) {
      this.dead = true;
      this.rig.pose.dead = true;
      this.game.audio.death();
      this.game.finish(false);
    }
    return true;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurt = Math.max(0, this.hurt - dt * 1.8);
    if (this.dead) {
      this.rig.pose.hurt = this.hurt;
      animateKnight(this.rig, dt);
      return;
    }

    input.update();
    const cameraForward = forwardFrom(game.cameraYaw);
    const cameraRight = new B.Vector3(cameraForward.z, 0, -cameraForward.x);
    let moveDirection = cameraForward.scale(input.move.y).add(cameraRight.scale(input.move.x));
    if (moveDirection.lengthSquared() > 1) moveDirection.normalize();
    const hasMove = moveDirection.lengthSquared() > .025;

    if (input.consume('heavy')) this.startAttack('heavy');
    else if (input.consume('attack')) this.startAttack('light');
    if (input.consume('dodge')) this.startDodge(moveDirection);

    const wantsBlock = input.blocking && !this.attack && this.dodgeTimer <= 0 && this.stamina > 0;
    if (wantsBlock && !this.lastBlocking) this.blockStarted = performance.now();
    this.blocking = wantsBlock;
    this.lastBlocking = wantsBlock;

    let movingAmount = 0;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      const dodgeCurve = Math.sin((this.dodgeTimer / PLAYER.dodgeTime) * Math.PI);
      this.velocity.copyFrom(this.dodgeDirection.scale(PLAYER.dodgeSpeed * (.55 + dodgeCurve * .55)));
      this.rig.root.position.addInPlace(this.velocity.scale(dt));
      movingAmount = 1;
    } else {
      const sprinting = input.running && hasMove && !this.attack && !this.blocking && this.stamina > 2;
      const speed = sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;
      if (sprinting) this.stamina = Math.max(0, this.stamina - PLAYER.sprintCost * dt);
      const actionScale = this.attack ? .25 : (this.blocking ? .42 : 1);
      const desiredVelocity = hasMove ? moveDirection.scale(speed * actionScale) : B.Vector3.Zero();
      this.velocity = B.Vector3.Lerp(this.velocity, desiredVelocity, 1 - Math.exp(-12 * dt));
      this.rig.root.position.addInPlace(this.velocity.scale(dt));
      movingAmount = clamp(this.velocity.length() / PLAYER.walkSpeed, 0, 1);

      const combatTarget = game.nearestEnemy(5.5);
      if ((this.attack || this.blocking) && combatTarget) {
        this.yaw = lerpAngle(this.yaw, angleTo(this.rig.root.position, combatTarget.rig.root.position), 16, dt);
      } else if (hasMove) {
        this.yaw = lerpAngle(this.yaw, Math.atan2(moveDirection.x, moveDirection.z), PLAYER.turnSpeed, dt);
      }
    }

    if (this.attack) {
      this.attack.time += dt;
      const progress = clamp(this.attack.time / this.attack.data.duration, 0, 1);
      if (!this.attack.hit && this.attack.time >= this.attack.data.hitStart) {
        this.attack.hit = true;
        game.performPlayerHit(this.attack.kind);
      }
      if (this.attack.time >= this.attack.data.duration) this.attack = null;
      else this.rig.pose.attackProgress = progress;
    }

    const busy = this.attack || this.blocking || this.dodgeTimer > 0;
    if (!busy && !input.running) this.stamina = Math.min(PLAYER.maxStamina, this.stamina + PLAYER.staminaRecovery * dt);
    else if (!busy) this.stamina = Math.min(PLAYER.maxStamina, this.stamina + PLAYER.staminaRecovery * .35 * dt);

    // Colisão simples: o pátio útil termina antes das muralhas.
    this.rig.root.position.x = clamp(this.rig.root.position.x, -36.2, 36.2);
    this.rig.root.position.z = clamp(this.rig.root.position.z, -34.8, 36.2);
    this.rig.root.rotation.y = this.yaw;
    this.rig.pose.moving = movingAmount;
    this.rig.pose.attacking = this.attack?.kind || null;
    this.rig.pose.attackProgress = this.attack ? this.attack.time / this.attack.data.duration : 0;
    this.rig.pose.blocking = this.blocking;
    this.rig.pose.dodging = this.dodgeTimer > 0;
    this.rig.pose.hurt = this.hurt;
    this.rig.pose.dead = this.dead;
    animateKnight(this.rig, dt);
  }
}

class Enemy {
  constructor(game, type, position, index) {
    this.game = game;
    this.type = type;
    this.data = ENEMY_TYPES[type];
    this.rig = createKnight(game.scene, game.world, { enemy: true, kind: type, scale: this.data.scale });
    this.rig.root.position.copyFromFloats(position.x, 0, position.z);
    this.yaw = angleTo(position, game.player.rig.root.position);
    this.rig.root.rotation.y = this.yaw;
    const multiplier = DIFFICULTY[game.settings.difficulty].enemyHealth;
    this.maxHealth = Math.round(this.data.health * multiplier);
    this.health = this.maxHealth;
    this.attack = null;
    this.cooldown = .55 + index * .23 + Math.random() * .55;
    this.stagger = 0;
    this.hurt = 0;
    this.dead = false;
    this.deathTime = 0;
    this.strafeDirection = Math.random() > .5 ? 1 : -1;
    this.thinkTime = Math.random() * .4;
    this.guarding = false;
    this.id = `${type}-${performance.now()}-${index}`;
  }

  takeDamage(amount, kind, direction) {
    if (this.dead) return false;
    const canGuard = (this.type === 'guard' || this.type === 'warlord') && kind !== 'heavy';
    const playerInFront = Math.cos(angleTo(this.rig.root.position, this.game.player.rig.root.position) - this.yaw) > .1;
    if (canGuard && playerInFront && Math.random() < (this.type === 'warlord' ? .48 : .34)) {
      this.health = Math.max(0, this.health - amount * .16);
      this.guarding = true;
      this.stagger = .22;
      this.game.audio.block(false);
      this.game.world.burst(this.rig.root.position.add(new B.Vector3(0, 1.8, 0)), 'spark', 9);
      this.game.shake = Math.max(this.game.shake, .08);
      return true;
    }

    this.health = Math.max(0, this.health - amount);
    this.hurt = .65;
    this.stagger = kind === 'heavy' ? .8 : .34;
    this.attack = null;
    this.game.audio.hit(this.type === 'guard' || this.type === 'warlord');
    this.game.world.burst(this.rig.root.position.add(new B.Vector3(0, 1.45, 0)), this.type === 'guard' ? 'spark' : 'blood', kind === 'heavy' ? 13 : 8);
    this.rig.root.position.addInPlace(direction.scale(kind === 'heavy' ? ATTACKS.heavy.knockback : ATTACKS.light.knockback));
    this.game.shake = Math.max(this.game.shake, kind === 'heavy' ? .21 : .11);
    if (this.health <= 0) this.die();
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.attack = null;
    this.rig.pose.dead = true;
    this.game.kills += 1;
    this.game.score += Math.round((this.data.boss ? 1200 : 170 + this.maxHealth) * DIFFICULTY[this.game.settings.difficulty].score);
    this.game.hud.setKills(this.game.kills, !this.game.player.wasHit);
    this.game.audio.death();
    if (this.data.boss) this.game.hud.message('EIRIK CAIU', 1800);
  }

  tryAttack() {
    if (this.attack || this.cooldown > 0 || this.stagger > 0 || this.dead) return;
    const activeAttackers = this.game.enemies.filter(enemy => enemy.attack && !enemy.dead).length;
    const limit = this.game.settings.difficulty === 'legend' ? 3 : 2;
    if (activeAttackers >= limit) return;
    const heavy = this.type === 'brute' || (this.type === 'warlord' && Math.random() < .55);
    this.attack = { time: 0, hit: false, duration: heavy ? 1.22 : .96, hitAt: heavy ? .74 : .57, heavy };
    this.guarding = false;
  }

  update(dt) {
    this.hurt = Math.max(0, this.hurt - dt * 1.7);
    this.stagger = Math.max(0, this.stagger - dt);
    this.cooldown = Math.max(0, this.cooldown - dt * DIFFICULTY[this.game.settings.difficulty].aggression);
    if (this.dead) {
      this.deathTime += dt;
      this.rig.pose.dead = true;
      animateKnight(this.rig, dt);
      return;
    }

    const playerPosition = this.game.player.rig.root.position;
    const position = this.rig.root.position;
    const distance = flatDistance(position, playerPosition);
    const targetYaw = angleTo(position, playerPosition);
    this.yaw = lerpAngle(this.yaw, targetYaw, this.attack ? 15 : 8, dt);
    this.rig.root.rotation.y = this.yaw;
    let moving = 0;

    if (this.stagger <= 0) {
      if (this.attack) {
        this.attack.time += dt;
        const progress = clamp(this.attack.time / this.attack.duration, 0, 1);
        if (!this.attack.hit && this.attack.time >= this.attack.hitAt) {
          this.attack.hit = true;
          if (distance <= this.data.range + (this.attack.heavy ? .42 : 0)) {
            const damage = this.data.damage * (this.attack.heavy ? 1.32 : 1) * DIFFICULTY[this.game.settings.difficulty].enemyDamage;
            this.game.player.receiveDamage(damage, this);
          }
          this.game.audio.swing(this.attack.heavy);
        }
        this.rig.pose.attacking = this.attack.heavy ? 'heavy' : 'light';
        this.rig.pose.attackProgress = progress;
        if (this.attack.time >= this.attack.duration) {
          this.attack = null;
          this.cooldown = this.type === 'warlord' ? rand(.5, .82) : rand(.8, 1.35);
        }
      } else if (distance > this.data.range * .92) {
        const direction = forwardFrom(this.yaw);
        const separation = this.game.enemySeparation(this);
        const speed = this.data.speed * (distance > 10 ? 1.12 : 1);
        position.addInPlace(direction.scale(speed * dt));
        position.addInPlace(separation.scale(dt * 2.2));
        moving = clamp(speed / 4, .35, 1);
        this.guarding = false;
      } else {
        this.tryAttack();
        if (!this.attack) {
          const tangent = new B.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).scale(this.strafeDirection * dt * .72);
          position.addInPlace(tangent);
          moving = .18;
          if ((this.type === 'guard' || this.type === 'warlord') && this.game.player.attack) this.guarding = true;
        }
      }
    }

    position.x = clamp(position.x, -36, 36);
    position.z = clamp(position.z, -34.4, 36);
    this.rig.pose.moving = moving;
    if (!this.attack) { this.rig.pose.attacking = null; this.rig.pose.attackProgress = 0; }
    this.rig.pose.blocking = this.guarding;
    this.rig.pose.hurt = this.hurt;
    this.rig.pose.dead = false;
    animateKnight(this.rig, dt);
  }
}

function rand(min, max) { return min + Math.random() * (max - min); }

class Game {
  constructor() {
    this.canvas = document.getElementById('renderCanvas');
    this.hud = new Hud();
    this.audio = new BattleAudio();
    this.input = new BattleInput(this.canvas);
    this.settings = this.loadSettings();
    this.state = 'loading';
    this.enemies = [];
    this.waveIndex = 0;
    this.waveDelay = 0;
    this.kills = 0;
    this.score = 0;
    this.elapsed = 0;
    this.shake = 0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = .18;
    this.lastFrame = performance.now();
  }

  loadSettings() {
    const fallback = { difficulty: 'knight', quality: 'auto', muted: false, best: 0 };
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return fallback; }
  }

  saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* storage privado */ }
  }

  resolveQuality(choice = this.settings.quality) {
    if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
    if (mobile || (navigator.hardwareConcurrency || 4) <= 4) return QUALITY.performance;
    if (innerWidth >= 1350 && (navigator.deviceMemory || 8) >= 8) return QUALITY.cinematic;
    return QUALITY.balanced;
  }

  async init() {
    if (!B || !B.Engine?.isSupported()) {
      this.showError('Este navegador não oferece o WebGL necessário para abrir o campo de batalha.');
      return;
    }
    try {
      this.setLoading(.12, 'Preparando o campo…');
      this.quality = this.resolveQuality();
      this.engine = new B.Engine(this.canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance' });
      this.engine.setHardwareScalingLevel(this.quality.hardwareScale);
      this.scene = new B.Scene(this.engine);
      this.camera = new B.UniversalCamera('third person camera', new B.Vector3(0, 5, 25), this.scene);
      this.camera.minZ = .08;
      this.camera.maxZ = 380;
      this.camera.fov = .78;
      this.scene.activeCamera = this.camera;
      this.setLoading(.32, 'Erguendo as muralhas…');
      this.world = createWorld(this.scene, this.quality);
      this.setLoading(.68, 'Forjando as espadas…');
      this.player = new PlayerController(this);
      this.setCameraImmediate();
      this.bindUi();
      await this.scene.whenReadyAsync();
      this.setLoading(1, 'O inimigo se aproxima…');
      this.engine.runRenderLoop(() => this.frame());
      window.addEventListener('resize', () => this.engine.resize());
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'running') this.pause(); });
      setTimeout(() => this.showMenu(), 450);
    } catch (error) {
      console.error(error);
      this.showError(error?.message || 'Falha ao iniciar o motor 3D.');
    }
  }

  setLoading(progress, text) {
    document.getElementById('loadingFill').style.width = `${progress * 100}%`;
    document.getElementById('loadingText').textContent = text;
  }

  bindUi() {
    document.querySelectorAll('[data-difficulty]').forEach(button => {
      const active = button.dataset.difficulty === this.settings.difficulty;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
      button.addEventListener('click', () => {
        this.settings.difficulty = button.dataset.difficulty;
        document.querySelectorAll('[data-difficulty]').forEach(item => {
          const selected = item === button;
          item.classList.toggle('active', selected);
          item.setAttribute('aria-checked', String(selected));
        });
        this.saveSettings();
      });
    });
    const qualitySelect = document.getElementById('qualitySelect');
    qualitySelect.value = this.settings.quality;
    qualitySelect.addEventListener('change', () => {
      this.settings.quality = qualitySelect.value;
      this.quality = this.resolveQuality(qualitySelect.value);
      this.engine.setHardwareScalingLevel(this.quality.hardwareScale);
      this.saveSettings();
    });
    document.getElementById('bestScore').textContent = this.settings.best ? this.settings.best.toLocaleString('pt-BR') : '—';
    document.getElementById('startButton').addEventListener('click', () => this.start());
    document.getElementById('retryButton').addEventListener('click', () => this.start());
    document.getElementById('pauseButton').addEventListener('click', () => this.state === 'paused' ? this.resume() : this.pause());
    document.getElementById('resumeButton').addEventListener('click', () => this.resume());
    document.getElementById('pauseMenuButton').addEventListener('click', () => this.showMenu());
    const soundButton = document.getElementById('soundButton');
    this.audio.setMuted(this.settings.muted);
    soundButton.textContent = this.settings.muted ? '×' : '♪';
    soundButton.setAttribute('aria-pressed', String(!this.settings.muted));
    soundButton.addEventListener('click', async () => {
      await this.audio.start();
      this.settings.muted = this.audio.toggle();
      soundButton.textContent = this.settings.muted ? '×' : '♪';
      soundButton.setAttribute('aria-pressed', String(!this.settings.muted));
      this.saveSettings();
    });
    this.input.pauseHandler = () => this.state === 'paused' ? this.resume() : this.pause();
  }

  clearEnemies() {
    this.enemies.forEach(enemy => enemy.rig.dispose());
    this.enemies.length = 0;
  }

  async start() {
    await this.audio.start();
    this.audio.setMuted(this.settings.muted);
    this.clearEnemies();
    this.player.reset(this.settings.difficulty);
    this.waveIndex = 0;
    this.waveDelay = 0;
    this.kills = 0;
    this.score = 0;
    this.elapsed = 0;
    this.shake = 0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = .18;
    this.state = 'running';
    this.input.enabled = true;
    this.hud.root.hidden = false;
    document.getElementById('menuOverlay').hidden = true;
    document.getElementById('pauseOverlay').hidden = true;
    document.getElementById('endOverlay').hidden = true;
    document.getElementById('touchControls').hidden = !this.input.coarse;
    this.hud.setKills(0, true);
    this.setCameraImmediate();
    this.spawnWave(0);
    this.audio.horn();
  }

  showMenu() {
    this.state = 'menu';
    this.input.enabled = false;
    this.input.blocking = false;
    this.input.pointerBlocking = false;
    this.clearEnemies();
    this.player.reset(this.settings.difficulty);
    this.player.rig.root.position.copyFromFloats(0, 0, 15);
    document.exitPointerLock?.();
    document.getElementById('loadingOverlay').hidden = true;
    document.getElementById('menuOverlay').hidden = false;
    document.getElementById('pauseOverlay').hidden = true;
    document.getElementById('endOverlay').hidden = true;
    document.getElementById('touchControls').hidden = true;
    this.hud.root.hidden = true;
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.blocking = false;
    this.input.pointerBlocking = false;
    document.exitPointerLock?.();
    document.getElementById('pauseOverlay').hidden = false;
    document.getElementById('touchControls').hidden = true;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.input.enabled = true;
    document.getElementById('pauseOverlay').hidden = true;
    document.getElementById('touchControls').hidden = !this.input.coarse;
    this.lastFrame = performance.now();
  }

  spawnWave(index) {
    const wave = WAVES[index];
    if (!wave) return;
    this.waveIndex = index;
    const positions = [
      new B.Vector3(-7, 0, -30), new B.Vector3(7, 0, -31), new B.Vector3(-15, 0, -27),
      new B.Vector3(16, 0, -26), new B.Vector3(1, 0, -33), new B.Vector3(-24, 0, -18)
    ];
    wave.enemies.forEach((type, enemyIndex) => {
      const base = positions[enemyIndex % positions.length];
      const position = base.add(new B.Vector3(rand(-2, 2), 0, rand(-1, 2)));
      this.enemies.push(new Enemy(this, type, position, enemyIndex));
    });
    this.hud.setWave(index, wave.title, wave.enemies.length);
    this.hud.message(index === WAVES.length - 1 ? 'O COMANDANTE ENTROU NO PÁTIO' : wave.title.toUpperCase(), 1900);
    if (index > 0) this.audio.horn();
  }

  nearestEnemy(maxDistance = Infinity) {
    let nearest = null;
    let nearestDistance = maxDistance;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const distance = flatDistance(this.player.rig.root.position, enemy.rig.root.position);
      if (distance < nearestDistance) { nearest = enemy; nearestDistance = distance; }
    }
    return nearest;
  }

  enemySeparation(source) {
    const force = B.Vector3.Zero();
    for (const other of this.enemies) {
      if (other === source || other.dead) continue;
      const difference = source.rig.root.position.subtract(other.rig.root.position);
      difference.y = 0;
      const distance = difference.length();
      if (distance > .01 && distance < 1.55) force.addInPlace(difference.normalize().scale((1.55 - distance) / 1.55));
    }
    const fromPlayer = source.rig.root.position.subtract(this.player.rig.root.position); fromPlayer.y = 0;
    const playerDistance = fromPlayer.length();
    if (playerDistance > .01 && playerDistance < 1.22) force.addInPlace(fromPlayer.normalize().scale((1.22 - playerDistance) * 2));
    return force;
  }

  performPlayerHit(kind) {
    const data = ATTACKS[kind];
    const playerPosition = this.player.rig.root.position;
    const forward = forwardFrom(this.player.yaw);
    const candidates = this.enemies
      .filter(enemy => !enemy.dead)
      .map(enemy => ({ enemy, distance: flatDistance(playerPosition, enemy.rig.root.position) }))
      .filter(item => item.distance <= data.range)
      .sort((a, b) => a.distance - b.distance);
    let hits = 0;
    const maxHits = kind === 'heavy' ? 3 : 1;
    for (const item of candidates) {
      const direction = item.enemy.rig.root.position.subtract(playerPosition); direction.y = 0;
      if (direction.lengthSquared() < .01) continue;
      direction.normalize();
      if (B.Vector3.Dot(forward, direction) < data.arc) continue;
      item.enemy.takeDamage(data.damage, kind, direction);
      hits += 1;
      if (hits >= maxHits) break;
    }
    if (hits === 0) this.world.burst(playerPosition.add(forward.scale(1.7)).add(new B.Vector3(0, .2, 0)), 'dust', 3);
  }

  updateCamera(dt) {
    const cameraInput = this.input.consumeCamera();
    if (this.state === 'running') {
      this.cameraYaw += cameraInput.x;
      this.cameraPitch = clamp(this.cameraPitch + cameraInput.y, -.08, .52);
    } else if (this.state === 'menu') {
      this.cameraYaw += dt * .075;
      this.cameraPitch = .22;
    }
    const playerPosition = this.player.rig.root.position;
    const forward = forwardFrom(this.cameraYaw);
    const distance = this.input.coarse ? 8.7 : 7.9;
    const desired = playerPosition.subtract(forward.scale(distance));
    desired.y = 4.25 + this.cameraPitch * 4.1;
    const look = playerPosition.add(forward.scale(1.8));
    look.y = 1.9 + this.cameraPitch * .7;
    if (this.shake > .002) {
      desired.x += rand(-this.shake, this.shake);
      desired.y += rand(-this.shake, this.shake);
      desired.z += rand(-this.shake, this.shake);
      this.shake = Math.max(0, this.shake - dt * 1.7);
    }
    this.camera.position = B.Vector3.Lerp(this.camera.position, desired, 1 - Math.exp(-9 * dt));
    this.camera.setTarget(look);
  }

  setCameraImmediate() {
    if (!this.camera || !this.player) return;
    const forward = forwardFrom(this.cameraYaw);
    this.camera.position.copyFrom(this.player.rig.root.position.subtract(forward.scale(8)).add(new B.Vector3(0, 4.7, 0)));
    this.camera.setTarget(this.player.rig.root.position.add(new B.Vector3(0, 1.8, 0)));
  }

  finish(victory) {
    if (this.state !== 'running') return;
    this.state = victory ? 'victory' : 'defeat';
    this.input.enabled = false;
    this.input.blocking = false;
    this.input.pointerBlocking = false;
    document.exitPointerLock?.();
    document.getElementById('touchControls').hidden = true;
    if (victory) {
      this.audio.victory();
      this.score += Math.round(this.player.health * 12 + Math.max(0, 300 - this.elapsed) * 4);
      this.settings.best = Math.max(this.settings.best || 0, this.score);
      this.saveSettings();
    }
    const overlay = document.getElementById('endOverlay');
    document.getElementById('endEyebrow').textContent = victory ? 'A MURALHA RESISTIU' : 'O PORTÃO CAIU';
    document.getElementById('endEyebrow').classList.toggle('danger', !victory);
    document.getElementById('endTitle').innerHTML = victory ? 'Vardheim<br>amanhece.' : 'A noite tomou<br>Vardheim.';
    document.getElementById('endStats').innerHTML = `
      <div><span>Abates</span><b>${this.kills}</b></div>
      <div><span>Tempo</span><b>${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}</b></div>
      <div><span>Glória</span><b>${this.score.toLocaleString('pt-BR')}</b></div>`;
    setTimeout(() => { overlay.hidden = false; }, victory ? 1050 : 900);
  }

  update(dt) {
    const time = performance.now() / 1000;
    if (this.state === 'running') {
      this.elapsed += dt;
      this.player.update(dt);
      this.enemies.forEach(enemy => enemy.update(dt));

      const alive = this.enemies.filter(enemy => !enemy.dead);
      const nearest = this.nearestEnemy();
      const targetDistance = nearest ? flatDistance(this.player.rig.root.position, nearest.rig.root.position) : Infinity;
      this.hud.setVitals(this.player);
      this.hud.setTarget(nearest, targetDistance);
      this.hud.setWave(this.waveIndex, WAVES[this.waveIndex].title, alive.length);

      if (alive.length === 0) {
        this.waveDelay += dt;
        if (this.waveIndex >= WAVES.length - 1) {
          if (this.waveDelay > 1.4) this.finish(true);
        } else if (this.waveDelay > 2.6) {
          this.waveDelay = 0;
          this.spawnWave(this.waveIndex + 1);
        }
      } else this.waveDelay = 0;

      // Corpos saem apenas depois da animação para evitar acúmulo em sessões longas.
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.enemies[i];
        if (enemy.dead && enemy.deathTime > 5.5) { enemy.rig.dispose(); this.enemies.splice(i, 1); }
      }
    } else if (this.state === 'menu') {
      this.player.rig.pose.moving = 0;
      this.player.rig.pose.blocking = false;
      this.player.rig.pose.attacking = null;
      animateKnight(this.player.rig, dt);
    } else if (this.state === 'defeat' || this.state === 'victory') {
      this.player.update(dt);
      this.enemies.forEach(enemy => enemy.update(dt));
    }
    this.world.update(dt, time);
    this.updateCamera(dt);
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.state !== 'paused' && this.state !== 'loading') this.update(dt);
    this.scene.render();
  }

  showError(message) {
    this.state = 'error';
    document.getElementById('loadingOverlay').hidden = true;
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorOverlay').hidden = false;
  }
}

new Game().init();
