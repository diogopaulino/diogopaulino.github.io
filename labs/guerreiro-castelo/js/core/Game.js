/**
 * Orquestrador: renderer, loop, estágios, fade, pause, checkpoints.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { QUALITY } from './QualitySettings.js';
import { SETTINGS_KEY } from './assets.js';
import { AssetManager } from './AssetManager.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { SceneManager, CHECKPOINT_STAGE } from './SceneManager.js';
import { Player } from '../player/Player.js';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js';
import { Teco } from '../characters/Teco.js';
import { Camila } from '../characters/Camila.js';
import { QuestManager } from '../game/QuestManager.js';
import { InteractionSystem } from '../game/InteractionSystem.js';
import { CombatSystem } from '../game/CombatSystem.js';
import { CheckpointManager } from '../game/CheckpointManager.js';
import { DialogueManager } from '../game/DialogueManager.js';
import { CutsceneManager } from '../game/CutsceneManager.js';
import { StoryDirector } from '../game/StoryDirector.js';
import { CollisionWorld } from '../world/CollisionWorld.js';
import { Ocean } from '../world/Ocean.js';
import { StormController } from '../world/StormController.js';
import { WeatherSystem } from '../world/WeatherSystem.js';
import { ArrowSystem } from '../world/ArrowSystem.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { clamp, detectMobile, detectSoftwareGL } from '../utils/math.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new HUD();
        this.checkpoints = new CheckpointManager();
        this.quests = new QuestManager();
        this.dialogue = new DialogueManager();
        this.combat = new CombatSystem();
        this.collision = new CollisionWorld();
        this.assets = new AssetManager();
        this.audio = new AudioManager();
        this.input = new InputManager(this.canvas);
        this.story = new StoryDirector(this);
        this.inventory = { keys: 0, cellKey: false };
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.paused = false;
        this.fade = 1;
        this.fadeTarget = 1;
        this.fadeCb = null;
        this.clockTime = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.stageId = null;
        this.levels = [];
        this.level = null;
        this._failing = false;
    }

    loadSettings() {
        const fallback = { quality: 'high', master: 0.75, music: 0.55, muted: false };
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        } catch { /* privado */ }
    }

    resolveQuality() {
        let id = this.settings.quality;
        if (id === 'auto') {
            if (detectMobile() || detectSoftwareGL()) id = 'low';
            else id = 'high';
        }
        return QUALITY[id] || QUALITY.high;
    }

    async init() {
        this.hud.setLoading(0.08, 'Preparando o mar…');
        this.quality = this.resolveQuality();

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.quality.aa,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87b8d0, 1);
        this.renderer.shadowMap.enabled = this.quality.id !== 'low';
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.12, this.quality.far);
        this.cameraRig = new ThirdPersonCamera(this.camera, this.scene);
        this.cutscenes = new CutsceneManager(this.cameraRig);
        this.interact = new InteractionSystem(this.camera);
        this.audio.attach(this.camera);

        this.weather = new WeatherSystem(this.scene, this.renderer);
        this.weather.setShadowSize(this.quality.shadows);
        this.hud.setLoading(0.28, 'Ondas e céu…');

        const essential = await this.assets.preloadEssential((p) => this.hud.setLoading(0.28 + p * 0.4, 'Carregando…'));
        this.ocean = new Ocean(this.scene, essential.waterNormals, this.quality);
        this.storm = new StormController(this.scene, this.quality);
        this.arrows = new ArrowSystem(this.scene);

        this.player = new Player(this.scene, this.collision);
        this.teco = new Teco(this.scene);
        this.camila = new Camila(this.scene);
        this.player.root.visible = false;
        this.teco.root.visible = false;
        this.camila.root.visible = false;
        this.scenes = new SceneManager(this);

        this._setupComposer();
        this.menu = new Menu(this);
        this.pauseMenu = new PauseMenu(this);
        this._bindSettings();
        window.addEventListener('resize', () => this.onResize());
        this.quests.onChange = (q) => this.hud.showObjective(q.text, q.id === 'flee');

        this.hud.setLoading(1, 'Pronto');
        this.hud.hideLoading();
        this.state = 'menu';
        this.menu.show(true);
        this.hud.showHud(false);
        this.renderMenuPreview();
    }

    _setupComposer() {
        try {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            this.bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                this.quality.bloom ? 0.18 : 0,
                0.4,
                0.85
            );
            this.composer.addPass(this.bloom);
            this.composer.addPass(new OutputPass());
        } catch (err) {
            console.warn('[Game] pós-processamento indisponível', err);
            this.composer = null;
            this.quality.bloom = false;
        }
    }

    _bindSettings() {
        const q = document.getElementById('qualitySelect');
        const vol = document.getElementById('volumeSlider');
        q.value = this.settings.quality;
        vol.value = Math.round(this.settings.master * 100);
        document.getElementById('volumeValue').textContent = vol.value;
        q.addEventListener('change', () => {
            this.settings.quality = q.value;
            this.saveSettings();
            this.quality = this.resolveQuality();
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
            this.bloom.strength = this.quality.bloom ? 0.18 : 0;
            this.weather.setShadowSize(this.quality.shadows);
        });
        vol.addEventListener('input', () => {
            this.settings.master = vol.value / 100;
            document.getElementById('volumeValue').textContent = vol.value;
            this.audio.setBusVolume('master', this.settings.master);
            this.saveSettings();
        });
        document.getElementById('btnPlayAgain')?.addEventListener('click', () => this.newGame());
        document.getElementById('btnEndMenu')?.addEventListener('click', () => this.quitToMenu());
    }

    renderMenuPreview() {
        this.weather.apply('dawn');
        this.camera.position.set(8, 6, 16);
        this.camera.lookAt(0, 2, 0);
        this.fade = 0;
        this.hud.setFade(0);
    }

    async newGame() {
        await this.audio.unlock();
        this.checkpoints.clear();
        this.story.resetFlags();
        this.inventory = { keys: 0, cellKey: false };
        this.player.heal();
        this.menu.show(false);
        this.hud.showHud(true);
        this.state = 'playing';
        this.paused = false;
        await this.loadStage('home', 'home_intro');
        this.input.requestLock();
    }

    async continueGame() {
        await this.audio.unlock();
        const data = this.checkpoints.load();
        if (!data) return this.newGame();
        this.story.applySave(data);
        this.menu.show(false);
        this.hud.showHud(true);
        this.state = 'playing';
        const stage = CHECKPOINT_STAGE[data.checkpoint] || 'home';
        await this.loadStage(stage, data.checkpoint);
        this.input.requestLock();
    }

    async loadStage(stageId, checkpoint) {
        this.hud.setLoading(0.4, 'Atravessando…');
        document.getElementById('loadingOverlay').hidden = false;
        this.stageId = stageId;
        this.fade = 1;
        this.hud.setFade(1);
        try {
            this.player.root.visible = true;
            this.teco.root.visible = true;
            await this.scenes.load(stageId, checkpoint);
        } catch (err) {
            console.error('[Game] falha ao carregar estágio', stageId, err);
            this.hud.showToast('Algo deu errado. Tentando de novo…');
        }
        this.hud.hideLoading();
        this.hud.setHealth(this.player.health, this.player.maxHealth);
        if (this.quests.current) this.hud.showObjective(this.quests.current.text);
        this.fadeTo(0);
        this._failing = false;
    }

    fadeTo(target, cb, speed = 1.2) {
        if (target > 1) {
            this.fadeTarget = 1;
            this.fadeSpeed = 1 / target;
            this.fadeCb = cb || null;
            return;
        }
        this.fadeTarget = target;
        this.fadeSpeed = speed;
        this.fadeCb = cb || null;
    }

    failCheckpoint(reason) {
        if (this._failing) return;
        this._failing = true;
        this.audio.play('fail');
        this.hud.showToast(reason || 'Tente novamente');
        this.fadeTo(1, () => this.reloadCheckpoint(), 2.2);
    }

    async reloadCheckpoint() {
        const cp = this.checkpoints.current || this.checkpoints.data.checkpoint || 'ship_start';
        const stage = CHECKPOINT_STAGE[cp] || this.stageId;
        this.player.heal();
        await this.loadStage(stage, cp);
    }

    setPaused(v) {
        this.paused = v;
        this.pauseMenu.show(v);
        this.input.enabled = !v && this.state === 'playing';
        if (v) this.input.exitLock();
        else this.input.requestLock();
    }

    quitToMenu() {
        this.setPaused(false);
        this.state = 'menu';
        this.hud.showHud(false);
        this.pauseMenu.show(false);
        document.getElementById('endOverlay').hidden = true;
        this.menu.show(true);
        this.input.exitLock();
        this.scenes.unload();
        this.renderMenuPreview();
    }

    showEnding() {
        this.state = 'ending';
        this.input.enabled = false;
        this.input.exitLock();
        const end = document.getElementById('endOverlay');
        end.hidden = false;
        this.hud.showHud(false);
        this.audio.setTheme('ending');
    }

    update(dt) {
        this.clockTime += dt;
        this.input.update();

        if (this.input.consume('pause') && this.state === 'playing') {
            this.setPaused(!this.paused);
        }
        if (this.paused) {
            this.audio.update(dt * 0.2);
            return;
        }

        if (this.fade !== this.fadeTarget) {
            const dir = Math.sign(this.fadeTarget - this.fade);
            this.fade = clamp(this.fade + dir * dt * (this.fadeSpeed || 1.2), 0, 1);
            this.hud.setFade(this.fade);
            if (Math.abs(this.fade - this.fadeTarget) < 0.02) {
                this.fade = this.fadeTarget;
                this.hud.setFade(this.fade);
                const cb = this.fadeCb;
                this.fadeCb = null;
                cb?.();
            }
        }

        if (this.state !== 'playing' && this.state !== 'ending') {
            this.ocean.update(dt, this.clockTime);
            return;
        }

        this.cutscenes.update(dt);
        this.dialogue.update(dt);
        if (this.input.consume('advance')) {
            this.dialogue.skip();
            if (this.cutscenes.blocking) this.cutscenes.skip();
        }

        this.collision.update(dt);
        this.storm.update(dt, this);
        this.ocean.update(dt, this.clockTime);

        const look = this.input.consumeLook();
        const zoom = this.input.consumeZoom();

        if (!this.cutscenes.blocking && this.player.controller.mode !== 'locked') {
            const foot = this.player.update(dt, this.input, this.cameraRig.yaw);
            if (foot) this.audio.footstep(this.player.crouching);
            this.teco.update(dt, this);
            this.camila.update(dt, this);
            this.combat.update(dt, this);
            this.arrows.update(dt, this);
            const item = this.interact.update(this.player, this);
            this.hud.setPrompt(item);
            if (this.input.consume('interact')) {
                if (item) {
                    this.player.interactT = 0.4;
                    this.audio.play('interact');
                    this.interact.tryInteract(this.player, this);
                }
            }
        } else if (this.player.controller.mode === 'helm') {
            this.player.update(dt, this.input, this.cameraRig.yaw);
            this.teco.update(dt, this);
            this.camila.update(dt, this);
            this.arrows.update(dt, this);
        } else {
            this.player.animator.update(dt);
            this.teco.animator.update(dt);
        }

        this.cameraRig.update(dt, this.player, look, zoom, this.player.sprinting);
        this.scenes.update(dt);
        this.quests.update(dt);
        this.audio.update(dt);
        this.hud.setDialogue(this.dialogue.current);
        this.hud.setHealth(this.player.health, this.player.maxHealth);
        this.hud.update(dt);

        if (this.input.consume('tab') && this.quests.current) {
            this.hud.showObjective(this.quests.current.text);
        }

        if (!this.player.alive && this.state === 'playing') {
            this.failCheckpoint('Dico caiu…');
        }

        this.fpsAccum += dt;
        this.fpsFrames++;
        if (this.fpsAccum > 0.5) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }

    render() {
        this.renderer.toneMappingExposure = this.weather.exposure ?? 1;
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
        this.bloom?.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
    }
}
