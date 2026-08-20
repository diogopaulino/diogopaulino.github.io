/**
 * Engine principal do jogo em Babylon.js.
 * Orquestra ciclo de renderização, física, IA, áudio, HUD e transições de fases.
 */

import { QUALITY } from './QualitySettings.js';
import { AssetManager } from './AssetManager.js';
import { AudioManager } from './AudioManager.js';
import { InputManager } from './InputManager.js';
import { CollisionWorld } from '../world/CollisionWorld.js';
import { WeatherSystem } from '../world/WeatherSystem.js';
import { Ocean } from '../world/Ocean.js';
import { StormController } from '../world/StormController.js';
import { ArrowSystem } from '../world/ArrowSystem.js';
import { InteractionSystem } from '../game/InteractionSystem.js';
import { CutsceneManager } from '../game/CutsceneManager.js';
import { DialogueManager } from '../game/DialogueManager.js';
import { QuestManager } from '../game/QuestManager.js';
import { CombatSystem } from '../game/CombatSystem.js';
import { CheckpointManager } from '../game/CheckpointManager.js';
import { StoryDirector } from '../game/StoryDirector.js';
import { SceneManager, CHECKPOINT_STAGE } from './SceneManager.js';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js';
import { Player } from '../player/Player.js';
import { Teco } from '../characters/Teco.js';
import { Camila } from '../characters/Camila.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { SETTINGS_KEY } from './assets.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.cameraRig = null;
        this.quality = QUALITY.high;
        this.paused = false;
        this.running = false;
        this.inventory = { keys: 0, cellKey: false };
        this.stageId = null;
        this.lastTime = 0;
    }

    async init() {
        this._loadSettings();

        // Inicializar Babylon.js Engine e Scene
        const antialias = this.quality.aa !== false;
        this.engine = new BABYLON.Engine(this.canvas, antialias, {
            preserveDrawingBuffer: true,
            stencil: true,
            adaptToDeviceRatio: true
        });

        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.05, 1);

        // Câmera Universal controlada manualmente pelo ThirdPersonCamera rig
        this.camera = new BABYLON.UniversalCamera('mainCamera', new BABYLON.Vector3(0, 2, 6), this.scene);
        this.camera.minZ = 0.1;
        this.camera.maxZ = this.quality.far || 500;
        this.camera.fov = 0.95;
        this.scene.activeCamera = this.camera;

        this.cameraRig = new ThirdPersonCamera(this.camera, this.scene);

        // Sistemas centrais
        this.assets = new AssetManager();
        this.audio = new AudioManager();
        this.input = new InputManager(this.canvas);
        this.collision = new CollisionWorld();
        this.weather = new WeatherSystem(this.scene, this.quality);
        this.ocean = new Ocean(this.scene, this.quality);
        this.storm = new StormController(this.scene, this.quality);
        this.arrows = new ArrowSystem(this.scene);
        this.interact = new InteractionSystem(this.camera);
        this.cutscenes = new CutsceneManager(this.cameraRig);
        this.dialogue = new DialogueManager(this);
        this.quests = new QuestManager(this);
        this.combat = new CombatSystem();
        this.checkpoints = new CheckpointManager();
        this.story = new StoryDirector(this);
        this.sceneMgr = new SceneManager(this);

        // Atores principais
        this.player = new Player(this.scene, this.collision);
        this.teco = new Teco(this.scene);
        this.camila = new Camila(this.scene);

        // UI
        this.hud = new HUD(this);
        this.menu = new Menu(this);
        this.pauseMenu = new PauseMenu(this);

        // Redimensionamento
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        await this.assets.preloadEssential((p) => {
            this.menu.setProgress(p);
        });

        this.menu.show();
    }

    _loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                if (s.quality && QUALITY[s.quality]) this.quality = QUALITY[s.quality];
            }
        } catch { /* privado */ }
    }

    startNewGame() {
        this.audio.unlock();
        this.story.resetFlags();
        this.checkpoints.clear();
        this.menu.hide();
        this.hud.show();
        this.loadStage('home', 'home_intro');
        this.running = true;
    }

    continueGame() {
        this.audio.unlock();
        const data = this.checkpoints.load();
        this.menu.hide();
        this.hud.show();
        if (data && data.checkpoint) {
            this.story.applySave(data);
            const stage = data.level || CHECKPOINT_STAGE[data.checkpoint] || 'home';
            this.loadStage(stage, data.checkpoint);
        } else {
            this.loadStage('home', 'home_intro');
        }
        this.running = true;
    }

    async loadStage(stageId, checkpoint = null) {
        this.stageId = stageId;
        await this.sceneMgr.load(stageId, checkpoint);
        this.hud.showLevelName(stageId);
    }

    fadeTo(duration, onMid, outDuration) {
        const overlay = document.getElementById('fadeOverlay');
        if (!overlay) {
            onMid?.();
            return;
        }
        overlay.style.transition = `opacity ${duration}s ease`;
        overlay.classList.add('is-active');
        setTimeout(() => {
            onMid?.();
            setTimeout(() => {
                overlay.style.transition = `opacity ${outDuration || duration}s ease`;
                overlay.classList.remove('is-active');
            }, 60);
        }, duration * 1000);
    }

    failCheckpoint(reason) {
        this.audio.play('fail');
        this.hud.showToast(reason || 'Tente novamente');
        this.fadeTo(1.2, () => {
            this.player.heal();
            const cp = this.checkpoints.current || 'home_intro';
            const stage = CHECKPOINT_STAGE[cp] || 'home';
            this.loadStage(stage, cp);
        });
    }

    showEnding() {
        this.running = false;
        this.input.exitLock();
        this.hud.hide();
        const endScreen = document.getElementById('endScreen');
        if (endScreen) {
            endScreen.classList.remove('is-hidden');
            endScreen.focus();
        }
    }

    tick() {
        if (!this.running || this.paused) return;

        const now = performance.now();
        const rawDt = this.lastTime ? (now - this.lastTime) / 1000 : 0.016;
        this.lastTime = now;
        const dt = Math.min(0.08, rawDt);

        this.input.update();

        if (this.input.consume('pause')) {
            this.pauseMenu.toggle();
        }

        if (this.input.consume('advance')) {
            if (this.dialogue.active) {
                this.dialogue.advance();
            }
        }

        const lookDelta = this.input.consumeLook();
        const zoomDelta = this.input.consumeZoom();

        // Passo e movimento do jogador
        const step = this.player.update(dt, this.input, this.cameraRig.yaw);
        if (step) {
            this.audio.footstep(this.player.crouching);
        }

        // Câmera
        this.cameraRig.update(dt, this.player, lookDelta, zoomDelta, this.player.sprinting);

        // Companheiros
        this.teco.update(dt, this);
        this.camila.update(dt, this);

        // Interação
        const prompt = this.interact.update(this.player, this);
        this.hud.setInteractPrompt(prompt);

        if (this.input.consume('interact')) {
            this.interact.tryInteract(this.player, this);
        }

        // Combate & Projéteis
        this.combat.update(dt, this);
        this.arrows.update(dt, this);

        // Clima & Ambiente
        this.ocean.update(dt, now * 0.001);
        this.storm.update(dt, this);
        this.collision.update(dt);
        this.sceneMgr.update(dt);
        this.cutscenes.update(dt);
        this.dialogue.update(dt);
        this.audio.update(dt);
        this.hud.update(dt);
    }

    start() {
        this._renderLoop = () => {
            this.tick();
            this.scene.render();
        };
        if (window.LabRuntime) LabRuntime.bindBabylonLoop(this.engine, this._renderLoop);
        else this.engine.runRenderLoop(this._renderLoop);
    }
}
