/**
 * Honor Front — laço principal, desembarque cinematográfico e a missão.
 */

import * as THREE from 'three';
import {
    QUALITY, DIFFICULTY, OBJECTIVES, WORLD, PLAYER,
    loadSettings, saveSettings
} from './config.js';
import { clamp, detectMobile, detectSoftwareGL, rendererIsSoftware, formatTime } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, statsBlock } from './hud.js';
import { Player } from './player.js';
import { Loadout } from './weapons.js';
import { Enemies } from './enemies.js';
import { Effects } from './effects.js';
import { createSkyUniforms, createSky, createOcean, createLights } from './sky.js';
import { buildWorld } from './world.js';

const AIM = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
const HIT = new THREE.Vector3();
const DIR = new THREE.Vector3();

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.elapsed = 0;
        this.kills = 0;
        this.objIndex = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.shellT = 1.2;
        this.landingT = 0;
        this.pendingCharge = null;
        this.flareT = 0;
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    difficulty() {
        return DIFFICULTY[this.settings.difficulty] || DIFFICULTY.ranger;
    }

    async init() {
        this.hud.setLoading(0.1, 'Abrindo o canal de rádio…');
        this.quality = this.resolveQuality();
        this.mobile = detectMobile();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível criar o contexto WebGL.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0xc48a58);

        if (rendererIsSoftware(this.renderer) && this.quality.id !== 'low') {
            this.quality = QUALITY.low;
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
        }

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0xc49268, this.quality.fog);

        this.camera = new THREE.PerspectiveCamera(
            PLAYER.hipFov,
            window.innerWidth / window.innerHeight,
            0.08,
            this.quality.far
        );

        this.hud.setLoading(0.28, 'Pintando a alvorada sobre o Canal…');
        this.skyUniforms = createSkyUniforms();
        this.sky = createSky(this.skyUniforms);
        this.scene.add(this.sky);
        this.ocean = createOcean(this.skyUniforms, this.quality);
        this.scene.add(this.ocean);
        this.lights = createLights(this.scene, this.quality);

        this.hud.setLoading(0.52, 'Erguendo Sainte-Claire…');
        this.world = buildWorld(this.scene, this.quality);

        this.hud.setLoading(0.72, 'Distribuindo o armamento…');
        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player();
        this.loadout = new Loadout(this.camera);
        this.enemies = new Enemies(this.scene);
        this.effects = new Effects(this.scene, this.quality);

        this.clock = new THREE.Clock();
        this._bindUi();
        this.input.bindTouch(this.hud);
        window.addEventListener('resize', () => this._resize());

        this.hud.setLoading(1, 'Rampa pronta.');
        this.hud.hideLoading();
        this._showMenu();
        this.clock.start();
        this.renderer.setAnimationLoop(() => this._frame());
    }

    _bindUi() {
        const h = this.hud;
        h.el.qualitySelect.value = this.settings.quality;
        h.el.volumeSlider.value = this.settings.volume;
        h.setVolumeLabel(this.settings.volume);
        h.setMuted(this.settings.muted);
        h.setBest(this.settings.best);
        this._refreshDifficulty();

        h.el.startButton.addEventListener('click', () => this.start());
        h.el.resumeButton.addEventListener('click', () => this.resume());
        h.el.pauseMenuButton.addEventListener('click', () => this.toMenu());
        h.el.retryButton.addEventListener('click', () => this.start());
        h.el.defeatMenuButton.addEventListener('click', () => this.toMenu());
        h.el.replayButton.addEventListener('click', () => this.start());
        h.el.victoryMenuButton.addEventListener('click', () => this.toMenu());
        h.el.pauseButton.addEventListener('click', () => this.togglePause());
        h.el.soundButton.addEventListener('click', () => this.toggleMute());

        h.el.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.el.qualitySelect.value;
            saveSettings(this.settings);
        });
        h.el.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(h.el.volumeSlider.value);
            h.setVolumeLabel(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            saveSettings(this.settings);
        });

        this.input.on('pause', () => this.togglePause());
        this.input.on('mute', () => this.toggleMute());
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
        });

        this.canvas.addEventListener('click', () => {
            if (this.state === 'playing' || this.state === 'landing') this.input.requestLock();
        });
    }

    _showMenu() {
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.showHud(false);
        this.hud.showMenu(true);
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this._refreshDifficulty();
        this.input.exitLock();
        this.input.enabled = false;
        this.fade = 0.35;
        this._refreshDifficulty();
    }

    _refreshDifficulty() {
        this.hud.fillDifficulty(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            saveSettings(this.settings);
            this._refreshDifficulty();
        });
    }

    async start() {
        await this.audio.unlock();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMuted(this.settings.muted);

        const diff = this.difficulty();
        this.player.maxHealth = diff.health;
        this.player.spawn(0, WORLD.boatStartZ + 0.4, Math.PI, this.world.heightAt);
        this.player.onBoat = true;
        this.loadout.reset(diff.magBonus);
        this.enemies.reset();
        this.kills = 0;
        this.elapsed = 0;
        this.objIndex = 0;
        this.landingT = 0;
        this.pendingCharge = null;
        this.flareT = 0;
        this.world.boat.position.set(0, 0.08, WORLD.boatStartZ);
        for (const it of this.world.interactables) it.done = false;
        for (const p of this.world.pickups) {
            p.used = false;
            p.mesh.visible = true;
        }

        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.mobile);
        this.hud.setHealth(this.player.health, this.player.maxHealth);
        this.hud.setKills(0);
        this.hud.setTime(0);
        this.hud.setObjective(OBJECTIVES[0]);
        this.hud.showObjectiveCard(OBJECTIVES[0]);
        this.audio.radioBeep();
        this.hud.radio('06 JUN 1944 — SETOR CHARLIE. Ranger, a bateria silencia a praia. A rampa cai em instantes.');
        this.hud.say('Aguarde a rampa', 4);

        this.state = 'landing';
        this.hud.setState('landing');
        this.input.enabled = true;
        this.input.requestLock();
        this.fade = 1;
        this.fadeDir = -1;
    }

    togglePause() {
        if (this.state === 'playing' || this.state === 'landing') {
            this.state = 'pause';
            this.hud.setState('pause');
            this.hud.showPause(true);
            this.input.exitLock();
            this.input.enabled = false;
        } else if (this.state === 'pause') {
            this.resume();
        }
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = this.player.onBoat ? 'landing' : 'playing';
        this.hud.setState(this.state);
        this.hud.showPause(false);
        this.input.enabled = true;
        this.input.requestLock();
    }

    toMenu() {
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this._showMenu();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
    }

    _setObjective(i) {
        this.objIndex = i;
        const obj = OBJECTIVES[i];
        this.hud.setObjective(obj);
        this.hud.showObjectiveCard(obj);
        this.audio.radioBeep();
        this.hud.radio(obj.radio);
    }

    _completeObjective() {
        const next = this.objIndex + 1;
        if (next >= OBJECTIVES.length) {
            this._victory();
            return;
        }
        this._setObjective(next);
        if (OBJECTIVES[this.objIndex - 1]?.id === 'mg') {
            this.loadout.unlockThompson();
            this.hud.say('Thompson recuperado', 3);
        }
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        this.input.enabled = false;
        const score = this.kills * 120 + Math.max(0, 900 - Math.floor(this.elapsed)) + Math.round(this.player.health);
        if (score > this.settings.best) {
            this.settings.best = score;
            saveSettings(this.settings);
            this.hud.setBest(score);
        }
        this.hud.showHud(false);
        this.hud.showVictory(statsBlock([
            ['Baixas', String(this.kills)],
            ['Tempo', formatTime(this.elapsed)],
            ['Medalha', String(score)]
        ]));
    }

    _defeat(reason) {
        this.state = 'defeat';
        this.hud.setState('defeat');
        this.input.exitLock();
        this.input.enabled = false;
        this.hud.showHud(false);
        this.hud.showDefeat(reason, statsBlock([
            ['Baixas', String(this.kills)],
            ['Tempo', formatTime(this.elapsed)],
            ['Objetivo', OBJECTIVES[this.objIndex].title]
        ]));
    }

    _resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _frame() {
        const dt = Math.min(0.05, this.clock.getDelta());
        this.time += dt;
        this.skyUniforms.uTime.value = this.time;
        this.world.update(this.time);
        this.effects.update(dt);

        this.fade = clamp(this.fade + this.fadeDir * dt * 1.2, 0, 1);
        this.hud.setFade(this.fade);

        if (this.state === 'menu' || this.state === 'pause' || this.state === 'victory' || this.state === 'defeat') {
            this._orbitPreview(dt);
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (this.state === 'landing') this._updateLanding(dt);
        if (this.state === 'playing' || this.state === 'landing') this._updatePlay(dt);

        this.renderer.render(this.scene, this.camera);
    }

    _orbitPreview() {
        const t = this.time * 0.08;
        this.camera.position.set(Math.sin(t) * 18, 9, 40 + Math.cos(t) * 22);
        this.camera.lookAt(0, 3, 90);
        this.loadout.garandView.visible = false;
        this.loadout.thompsonView.visible = false;
    }

    _updateLanding(dt) {
        this.landingT += dt;
        const u = clamp(this.landingT / WORLD.boatDuration, 0, 1);
        const ease = 1 - (1 - u) * (1 - u);
        this.world.boat.position.z = THREE.MathUtils.lerp(WORLD.boatStartZ, WORLD.boatEndZ, ease);
        this.world.boat.position.y = 0.1 + Math.sin(this.time * 1.4) * 0.08;
        this.player.x = this.world.boat.position.x;
        this.player.z = this.world.boat.position.z + 0.6;
        this.player.y = this.world.boat.position.y + 0.55;

        this.shellT -= dt;
        if (this.shellT <= 0) {
            this.shellT = 0.7 + Math.random() * 1.4;
            const x = (Math.random() - 0.5) * 36;
            const z = 12 + Math.random() * 70;
            this.effects.explosion(x, this.world.heightAt(x, z) + 0.4, z, 0.85);
            this.audio.explosion();
        }

        if (u >= 1) {
            this.player.onBoat = false;
            this.player.z = WORLD.boatEndZ + 3.2;
            this.player.y = this.world.heightAt(this.player.x, this.player.z);
            this.state = 'playing';
            this.hud.setState('playing');
            this.hud.say('Move! Move! Move!', 2.4);
            this.hud.radio(OBJECTIVES[0].radio);
            this.loadout._syncView();
        }
    }

    _updatePlay(dt) {
        this.elapsed += dt;
        const locked = this.input.locked || this.mobile;
        this.input.enabled = this.state === 'playing' || this.state === 'landing';

        if (this.state === 'landing') {
            const look = this.input.consumeLook();
            this.player.yaw -= look.x * 0.0022;
            this.player.pitch = clamp(this.player.pitch - look.y * 0.002, -1.1, 1.1);
        }

        const movingInfo = this.state === 'playing'
            ? this.player.update(dt, this.input, this.world, locked)
            : { footstep: false, moving: false };

        if (movingInfo.footstep) this.audio.footstep(this.player.wet);

        this.player.applyToCamera(this.camera);
        const fov = THREE.MathUtils.lerp(PLAYER.hipFov, PLAYER.adsFov, this.player.ads);
        if (Math.abs(this.camera.fov - fov) > 0.05) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }

        const slot = this.input.consumeWeapon();
        if (slot) this.loadout.switchTo(slot);

        if (this.input.consumeReload()) {
            if (this.loadout.tryReload()) this.audio.reload();
        }

        if (this.state === 'playing') {
            const fire = this.loadout.tryFire(this.input.fireHeld);
            if (fire.empty && this.input.fireHeld) {
                if (this.loadout.tryReload()) this.audio.reload();
            }
            if (fire.shot) this._firePlayer();
            if (fire.ping) this.audio.ping();

            if (this.input.consumeGrenade()) {
                this.camera.getWorldDirection(DIR);
                ORIGIN.copy(this.camera.position).addScaledVector(DIR, 0.6);
                ORIGIN.y -= 0.1;
                const g = this.loadout.throwGrenade(ORIGIN, DIR);
                if (g) this.scene.add(g.mesh);
            }
        }

        this.loadout.update(dt, movingInfo.moving, this.player.ads, this.world.heightAt);

        for (const g of this.loadout.popExploded()) {
            const p = g.mesh.position;
            this.effects.explosion(p.x, p.y, p.z, 1.15);
            this.audio.explosion();
            this.scene.remove(g.mesh);
            const killed = this.enemies.explodeAt(p.x, p.y, p.z, 6.5, 90);
            this.kills += killed.length;
            if (Math.hypot(this.player.x - p.x, this.player.z - p.z) < 5.5) {
                if (this.player.hurt(28)) this.hud.flashHit();
            }
        }

        this.enemies.update(dt, this.player, this.world, this.difficulty(), (enemy, lead) => {
            ORIGIN.set(enemy.x, enemy.y + 1.35, enemy.z);
            if (lead) {
                HIT.set(this.player.x, this.player.y + PLAYER.eye, this.player.z);
            } else {
                HIT.set(
                    this.player.x + (Math.random() - 0.5) * 3.2,
                    this.player.y + PLAYER.eye + (Math.random() - 0.5) * 1.4,
                    this.player.z + (Math.random() - 0.5) * 3.2
                );
            }
            this.effects.tracer(ORIGIN, HIT);
            this.effects.muzzleFlash(ORIGIN.x, ORIGIN.y, ORIGIN.z);
            if (enemy.mg && Math.random() < 0.4) this.audio.shot('thompson');
            else if (Math.random() < 0.35) this.audio.shot('garand');
            if (lead && this.player.alive) {
                const dmg = this.difficulty().enemyDamage * (enemy.mg ? 1.15 : 1);
                if (this.player.hurt(dmg)) {
                    this.hud.flashHit();
                    this.audio.hit();
                    this.hud.setHealth(this.player.health, this.player.maxHealth);
                }
            }
        });

        this._interact(dt);
        this._pickups();
        this._checkObjective();
        this._ambientShells(dt);

        if (!this.player.alive) this._defeat('O fogo da muralha encontrou você na areia.');

        this.audio.update(dt, this.player.z < 40);
        this.hud.tick(dt);
        this.hud.setHealth(this.player.health, this.player.maxHealth);
        this.hud.setWeapon(
            this.loadout.spec.name,
            this.loadout.ammo.mag,
            this.loadout.ammo.reserve,
            this.loadout.grenades
        );
        this.hud.setKills(this.kills);
        this.hud.setTime(this.elapsed);
        let heading = Math.atan2(-Math.sin(this.player.yaw), -Math.cos(this.player.yaw)) * 180 / Math.PI;
        if (heading < 0) heading += 360;
        this.hud.setHeading(heading);

        this.fpsFrames += 1;
        this.fpsAccum += dt;
        if (this.fpsAccum >= 0.4) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsFrames = 0;
            this.fpsAccum = 0;
        }

        if (this.flareT > 0) {
            this.flareT -= dt;
            if (this.flareT <= 0 && this.objIndex === OBJECTIVES.length - 1) this._completeObjective();
        }
    }

    _firePlayer() {
        this.audio.shot(this.loadout.current);
        this.player.kick(this.loadout.spec.recoil);
        this.camera.getWorldDirection(DIR);
        const spread = this.loadout.spread(this.player.ads);
        DIR.x += (Math.random() - 0.5) * spread;
        DIR.y += (Math.random() - 0.5) * spread;
        DIR.z += (Math.random() - 0.5) * spread;
        DIR.normalize();
        ORIGIN.copy(this.camera.position);
        AIM.copy(ORIGIN).addScaledVector(DIR, 140);

        this.effects.muzzleFlash(
            ORIGIN.x + DIR.x * 0.8,
            ORIGIN.y + DIR.y * 0.8 - 0.05,
            ORIGIN.z + DIR.z * 0.8
        );

        const hit = this.enemies.hitTest(ORIGIN, DIR, 140);
        if (hit) {
            const e = hit.enemy;
            HIT.copy(ORIGIN).addScaledVector(DIR, hit.dist);
            this.effects.tracer(ORIGIN, HIT);
            this.effects.blood(HIT.x, HIT.y, HIT.z);
            this.hud.markHit();
            if (this.enemies.damage(e, this.loadout.spec.damage)) {
                this.kills += 1;
                this.hud.say('Baixa confirmada', 1.2);
            }
            return;
        }

        HIT.copy(AIM);
        this.effects.tracer(ORIGIN, HIT);
        const gx = ORIGIN.x + DIR.x * 40;
        const gz = ORIGIN.z + DIR.z * 40;
        this.effects.sparks(gx, this.world.heightAt(gx, gz) + 0.4, gz);
    }

    _interact(dt) {
        const obj = OBJECTIVES[this.objIndex];
        let prompt = '';
        let near = null;
        for (const it of this.world.interactables) {
            if (it.done) continue;
            const d = Math.hypot(this.player.x - it.x, this.player.z - it.z);
            if (d < it.radius) {
                near = it;
                prompt = it.label;
                break;
            }
        }
        this.hud.setPrompt(prompt);

        if (this.pendingCharge) {
            this.pendingCharge.t -= dt;
            if (this.pendingCharge.t <= 0) {
                const it = this.pendingCharge.it;
                it.done = true;
                this.effects.explosion(it.x, this.world.heightAt(it.x, it.z) + 1.2, it.z, 1.6);
                this.audio.explosion();
                this.hud.say('Carga detonada', 2);
                this.pendingCharge = null;
                if (obj.check === 'interact' && obj.interact === it.id) this._completeObjective();
            }
        }

        if (!near || !this.input.consumeInteract()) return;
        if (obj.check === 'interact' && obj.interact !== near.id) {
            this.hud.say('Ainda não. Siga o objetivo.', 2);
            return;
        }

        if (near.id === 'flare') {
            near.done = true;
            this.hud.setPrompt('');
            this.effects.flare(near.x, this.world.heightAt(near.x, near.z) + 2, near.z);
            this.audio.flare();
            this.hud.say('Sinalizador no ar', 3);
            this.flareT = 2.4;
            return;
        }

        this.pendingCharge = { it: near, t: 1.6 };
        this.hud.say('Carga armada — afaste-se', 2);
        this.hud.setPrompt('');
    }

    _pickups() {
        for (const p of this.world.pickups) {
            if (p.used) continue;
            const d = Math.hypot(this.player.x - p.x, this.player.z - p.z);
            if (d < p.radius) {
                p.used = true;
                p.mesh.visible = false;
                this.player.heal(40);
                this.hud.say('Kit médico', 1.6);
                this.audio.radioBeep();
            }
        }
    }

    _checkObjective() {
        const obj = OBJECTIVES[this.objIndex];
        if (obj.check === 'z' && this.player.z >= obj.z) this._completeObjective();
    }

    _ambientShells(dt) {
        if (this.player.z > 90) return;
        this.shellT -= dt;
        if (this.shellT > 0) return;
        this.shellT = 2.5 + Math.random() * 3.5;
        const x = this.player.x + (Math.random() - 0.5) * 28;
        const z = this.player.z + 8 + Math.random() * 22;
        if (Math.hypot(x - this.player.x, z - this.player.z) < 6) return;
        this.effects.explosion(x, this.world.heightAt(x, z) + 0.3, z, 0.7);
        if (Math.random() < 0.5) this.audio.explosion();
    }
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError('Falha ao iniciar a missão. Recarregue a página.');
});
