/**
 * Honor Front — FPS 3D em Babylon.js inspirado em Medal of Honor.
 * Desembarque na praia, travessia da muralha e bateria costeira.
 */

import { Player } from './player.js';
import { Loadout } from './weapons.js';
import { Enemies } from './enemies.js';
import { CombatEffects } from './effects.js';
import { CombatAudio } from './audio.js';
import { heightAt, buildCombatWorld } from './world.js';
import { setupAtmosphere } from './sky.js';
import { clamp } from './utils.js';
import { loadAssets } from './models.js';

class HonorFront {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.state = 'boot';

        this.player = new Player();
        this.audio = new CombatAudio();
        this.keys = {};
        this.input = {
            move: { x: 0, z: 0, sprint: false },
            look: { x: 0, y: 0 },
            adsHeld: false,
            consumeLook: () => {
                const l = { ...this.input.look };
                this.input.look.x = 0;
                this.input.look.y = 0;
                return l;
            }
        };

        this.locked = false;
        this.fireHeld = false;
        this.kills = 0;

        this.bindUi();
        this.boot();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('btnFire')?.addEventListener('pointerdown', () => this.fireHeld = true);
        document.getElementById('btnFire')?.addEventListener('pointerup', () => this.fireHeld = false);
        document.getElementById('btnReload')?.addEventListener('click', () => this.tryReload());
        document.getElementById('btnSprint')?.addEventListener('pointerdown', () => this.input.move.sprint = true);
        document.getElementById('btnSprint')?.addEventListener('pointerup', () => this.input.move.sprint = false);

        // Pointer Lock no canvas
        this.canvas.addEventListener('click', () => {
            if (this.state === 'play' && document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === this.canvas;
        });

        window.addEventListener('mousemove', (e) => {
            if (this.locked) {
                this.input.look.x += e.movementX;
                this.input.look.y += e.movementY;
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (this.locked) {
                if (e.button === 0) this.fireHeld = true;
                if (e.button === 2) this.input.adsHeld = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.fireHeld = false;
                this.loadout?.releaseTrigger();
            }
            if (e.button === 2) this.input.adsHeld = false;
        });

        window.addEventListener('contextmenu', (e) => {
            if (this.locked) e.preventDefault();
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyR') this.tryReload();
            if (e.code === 'Digit1') this.loadout?.switchTo(1);
            if (e.code === 'Digit2') this.loadout?.switchTo(2);
            if (e.code === 'KeyM') this.toggleMute();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Touch joystick rédea/movimento
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        if (stick && knob) {
            let active = false;
            let startX = 0, startY = 0;

            const onMove = (clientX, clientY) => {
                if (!active) return;
                const dx = clientX - startX;
                const dy = clientY - startY;
                const max = 44;
                const dist = Math.hypot(dx, dy);
                const k = dist > 0 ? Math.min(dist, max) / dist : 0;
                knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
                this.input.move.x = clamp((dx * k) / max, -1, 1);
                this.input.move.z = -clamp((dy * k) / max, -1, 1);
            };

            stick.addEventListener('pointerdown', (e) => {
                active = true;
                startX = e.clientX;
                startY = e.clientY;
                stick.setPointerCapture(e.pointerId);
            });

            stick.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));

            const onEnd = () => {
                active = false;
                knob.style.transform = 'translate(0px, 0px)';
                this.input.move.x = 0;
                this.input.move.z = 0;
            };

            stick.addEventListener('pointerup', onEnd);
            stick.addEventListener('pointercancel', onEnd);
        }
    }

    tryReload() {
        if (this.loadout?.tryReload()) {
            this.audio.reload(this.loadout.current);
        }
    }

    async boot() {
        const BABYLON = window.BABYLON;
        if (!BABYLON) return;

        try {
            this.engine = new BABYLON.Engine(this.canvas, true, {
                preserveDrawingBuffer: false,
                stencil: true,
                adaptToDeviceRatio: true
            });
            this.scene = new BABYLON.Scene(this.engine);
            this.scene.clearColor = new BABYLON.Color4(0.45, 0.52, 0.6, 1.0);
        } catch (err) {
            console.error(err);
            return;
        }

        // Carregar assets hiper-realistas
        this.assets = await loadAssets(BABYLON, this.scene);

        // Iluminação & Atmosfera
        this.lights = setupAtmosphere(BABYLON, this.scene);

        // Cenário da Praia e Bunkers
        this.world = buildCombatWorld(BABYLON, this.scene, this.assets);

        // Câmera do Jogador
        this.camera = new BABYLON.FreeCamera('fpsCam', new BABYLON.Vector3(0, 1.6, -70), this.scene);
        this.camera.minZ = 0.05;
        this.camera.maxZ = 800;

        // Armas
        this.loadout = new Loadout(BABYLON, this.camera, this.scene, this.assets);

        // Efeitos
        this.effects = new CombatEffects(BABYLON, this.scene);

        // Inimigos
        this.enemies = new Enemies(BABYLON, this.scene, heightAt, this.assets);

        // Pipeline PBR
        const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.camera]);
        pipe.fxaaEnabled = true;
        pipe.bloomEnabled = true;
        pipe.bloomThreshold = 0.82;
        pipe.bloomWeight = 0.22;
        pipe.imageProcessing.toneMappingEnabled = true;
        pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipe.imageProcessing.contrast = 1.18;

        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('menuOverlay').hidden = false;
        document.body.dataset.state = 'intro';

        this._renderLoop = () => {
            this.frame();
            this.scene.render();
        };
        if (window.LabRuntime) LabRuntime.bindBabylonLoop(this.engine, this._renderLoop);
        else this.engine.runRenderLoop(this._renderLoop);

        window.addEventListener('resize', () => this.engine.resize());
    }

    start() {
        this.state = 'play';
        document.getElementById('menuOverlay').hidden = true;
        document.getElementById('hud').hidden = false;
        document.getElementById('crosshair').hidden = false;
        document.getElementById('touchControls').hidden = !('ontouchstart' in window);
        document.body.dataset.state = 'play';

        this.player.spawn(0, -60, Math.PI, heightAt);
        this.loadout.reset();
        this.enemies.reset(heightAt);
        this.kills = 0;

        this.audio.init();
        this.canvas.requestPointerLock?.();
    }

    toggleMute() {
        const muted = this.audio.toggleMute();
        const btn = document.getElementById('soundButton');
        if (btn) {
            btn.setAttribute('aria-pressed', String(!muted));
        }
    }

    frame() {
        const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);

        if (this.state === 'play') {
            // Teclado
            if (this.keys['KeyW'] || this.keys['ArrowUp']) this.input.move.z = 1;
            else if (this.keys['KeyS'] || this.keys['ArrowDown']) this.input.move.z = -1;
            else if (!('ontouchstart' in window)) this.input.move.z = 0;

            if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.input.move.x = -1;
            else if (this.keys['KeyD'] || this.keys['ArrowRight']) this.input.move.x = 1;
            else if (!('ontouchstart' in window)) this.input.move.x = 0;

            this.input.move.sprint = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

            // Jogador
            const pRes = this.player.update(dt, this.input, heightAt);
            if (pRes.footstep) this.audio.footstep(this.player.wet ? 'water' : 'sand');

            // Atualização da câmera
            this.camera.position.set(this.player.x, this.player.y + this.player.bob, this.player.z);
            this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);

            // Disparo de armas
            if (this.fireHeld) {
                const res = this.loadout.tryFire(true);
                if (res.shot) {
                    this.audio.shoot(this.loadout.current);
                    const tipPos = this.camera.position.add(this.camera.getDirection(new window.BABYLON.Vector3(0.18, -0.12, 0.75)));
                    this.effects.muzzleFlash(tipPos);

                    // Raycast de tiro
                    const camRay = this.camera.getForwardRay(180);
                    const hit = this.enemies.hitTest(this.camera.position, camRay.direction);
                    if (hit) {
                        const died = this.enemies.damage(hit.enemy, this.loadout.spec.damage || 45);
                        this.effects.impactSparks(new window.BABYLON.Vector3(hit.enemy.x, hit.enemy.y + 1.2, hit.enemy.z));
                        this.audio.hit();
                        this.flashHitmarker();
                        if (died) {
                            this.kills++;
                            this.checkObjectives();
                        }
                    }
                }
                if (res.ping) {
                    this.audio.ping();
                }
                if (res.empty) {
                    this.audio.empty();
                }
            }

            this.loadout.update(dt);

            // Inimigos AI
            this.enemies.update(dt, this.player, (e, dist) => {
                this.audio.enemyShoot();
                if (Math.random() < 0.28) {
                    this.player.hurt(12);
                    this.audio.playerHurt();
                    this.flashDamage();
                }
            });

            // HUD
            this.updateHud();
        }
    }

    flashHitmarker() {
        const hm = document.getElementById('hitMarker');
        if (hm) {
            hm.style.opacity = '1';
            setTimeout(() => { hm.style.opacity = '0'; }, 90);
        }
    }

    flashDamage() {
        const hf = document.getElementById('hitFlash');
        if (hf) {
            hf.style.opacity = '0.5';
            setTimeout(() => { hf.style.opacity = '0'; }, 150);
        }
    }

    checkObjectives() {
        const aliveCount = this.enemies.list.filter(e => e.alive).length;
        if (aliveCount <= 8 && !this.loadout.unlocked.thompson) {
            this.loadout.unlockThompson();
        }
    }

    updateHud() {
        const hpEl = document.getElementById('healthValue');
        const magEl = document.getElementById('magValue');
        const resEl = document.getElementById('reserveValue');
        const wNameEl = document.getElementById('weaponName');
        const killsEl = document.getElementById('killsValue');
        const objEl = document.getElementById('objective');

        if (hpEl) hpEl.textContent = `${Math.round(this.player.health)}`;
        if (magEl) magEl.textContent = String(this.loadout.ammo.mag).padStart(2, '0');
        if (resEl) resEl.textContent = String(this.loadout.ammo.reserve).padStart(2, '0');
        if (wNameEl) wNameEl.textContent = this.loadout.current === 'garand' ? 'M1 GARAND' : 'THOMPSON SMG';
        if (killsEl) killsEl.textContent = String(this.kills).padStart(2, '0');

        const alive = this.enemies.list.filter(e => e.alive).length;
        if (objEl) {
            if (this.player.z < 40) objEl.textContent = 'Alcance a muralha da praia.';
            else if (this.player.z < 180) objEl.textContent = `Limpe os defensores da muralha (${alive} restantes).`;
            else objEl.textContent = 'Silencie a bateria costeira no penhasco.';
        }
    }
}

try {
    new HonorFront();
} catch (err) {
    console.error(err);
}
