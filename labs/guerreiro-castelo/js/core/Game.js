/**
 * Engine principal do jogo (three.js r185 sobre o palco compartilhado labs/shared/gfx/stage.js).
 * Orquestra ciclo de renderização, física, IA, áudio, HUD e transições de fases.
 *
 * Tempo: o palco já limita dt a 1/20 s (sem salto de física depois de um engasgo) e para
 * de desenhar com a aba oculta. Hitstop: `hitstop(s)` desacelera a simulação a 6 % por
 * alguns centésimos no impacto de um golpe — a câmera segue no tempo real (o tremor continua).
 *
 * Nunca preso:
 *   aba oculta / janela sem foco → pausa e solta todas as teclas
 *   chão seguro: a cada 0,4 s com Dico no chão guarda a posição (referencial do nível);
 *   caiu 20 m abaixo dela, saiu do mapa (y < −30) ou ficou 4 s em queda livre → volta
 *   para o último chão seguro, sem perder vida (modo gentil)
 *   vida zerou → reinicia do último checkpoint com a vida cheia
 */

import * as THREE from 'three';
import { createStage } from '../../../shared/gfx/stage.js?v=18';
import { preload } from '../../../shared/gfx/assets.js';
import { pickTier } from '../../../shared/gfx/core.js';
import { QUALITY } from './QualitySettings.js?v=50';
import { AudioManager } from './AudioManager.js?v=51';
import { InputManager } from './InputManager.js?v=51';
import { CollisionWorld } from '../world/CollisionWorld.js?v=50';
import { WeatherSystem } from '../world/WeatherSystem.js?v=51';
import { Ocean } from '../world/Sea.js?v=50';
import { StormController } from '../world/StormController.js?v=50';
import { ArrowSystem } from '../world/ArrowSystem.js?v=50';
import { InteractionSystem } from '../game/InteractionSystem.js?v=50';
import { CutsceneManager } from '../game/CutsceneManager.js?v=50';
import { DialogueManager } from '../game/DialogueManager.js?v=50';
import { QuestManager } from '../game/QuestManager.js?v=50';
import { CombatSystem } from '../game/CombatSystem.js?v=50';
import { CheckpointManager } from '../game/CheckpointManager.js?v=50';
import { StoryDirector } from '../game/StoryDirector.js?v=50';
import { SceneManager, CHECKPOINT_STAGE } from './SceneManager.js?v=50';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js?v=50';
import { Player } from '../player/Player.js?v=50';
import { Teco } from '../characters/Teco.js?v=50';
import { Camila } from '../characters/Camila.js?v=50';
import { HUD } from '../ui/HUD.js?v=50';
import { Menu } from '../ui/Menu.js?v=50';
import { PauseMenu } from '../ui/PauseMenu.js?v=50';
import { ObjectiveMarker } from '../ui/ObjectiveMarker.js?v=50';
import { SETTINGS_KEY } from './assets.js?v=50';

/** Tudo que os cenários usam, baixado atrás da tela de carregamento. */
const MODELS = [
    'dutch_ship_medium', 'GothicBed_01', 'wooden_bookshelf_worn', 'WoodenTable_01', 'WoodenChair_01', 'wine_barrel_01',
    'wooden_crate_01', 'wooden_bucket_01', 'brass_goblets', 'marble_bust_01', 'treasure_chest', 'vintage_oil_lamp',
    'large_castle_door', 'large_iron_gate', 'horse_statue_01', 'Chandelier_01', 'antique_estoc', 'kite_shield',
    'wooden_lantern_01'
];
const TEXTURES = [
    'castle_wall_slates', 'medieval_blocks_02', 'castle_brick_02_white', 'slate_floor_02', 'cobblestone_floor_08',
    'rough_plaster_03', 'oak_wood_planks', 'dark_wooden_planks', 'weathered_brown_planks', 'rusty_metal_02', 'cliff_side',
    'mossy_rock', 'roof_slates_02', 'brown_leather', 'fabric_pattern_07', 'thatch_roof_angled'
];

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.stage = null;
        this.scene = null;
        this.camera = null;
        this.cameraRig = null;
        this.quality = QUALITY.high;
        this.paused = false;
        this.running = false;
        this.loading = false;
        this.inventory = { keys: 0, cellKey: false };
        this.stageId = null;
        this.time = 0;
        this._hitstop = 0;
        this._safe = new THREE.Vector3();
        this._safeParent = null;
        this._safeT = 0;
    }

    /** Congela a simulação por `t` s (impacto de golpe). */
    hitstop(t) {
        this._hitstop = Math.max(this._hitstop, t);
    }

    async init() {
        this._loadSettings();

        const manager = new THREE.LoadingManager();
        manager.onProgress = (_u, done, total) => this.menu?.setProgress(Math.min(0.98, done / Math.max(total, 40)));
        this.stage = createStage({
            canvas: this.canvas, tier: this.quality.tier, preset: 'noite-lua', fov: 54.4, near: 0.12, loadingManager: manager
        });
        if (!this.stage) throw new Error('WebGL 2 indisponível');
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;
        this.camera.position.set(0, 2, 6);
        this.stage.focus = new THREE.Vector3();

        /* Atores persistentes ficam aqui (invisíveis) entre um nível e outro. */
        this.limbo = new THREE.Group();
        this.limbo.visible = false;
        this.scene.add(this.limbo);

        this.cameraRig = new ThirdPersonCamera(this.camera);

        // Sistemas centrais
        this.audio = new AudioManager();
        this.input = new InputManager(this.canvas);
        this.collision = new CollisionWorld();
        this.weather = new WeatherSystem(this);
        this.ocean = new Ocean(this);
        this.storm = new StormController(this, this.quality);
        this.arrows = new ArrowSystem(this.scene);
        this.interact = new InteractionSystem(this.camera);
        this.cutscenes = new CutsceneManager(this.cameraRig);
        this.dialogue = new DialogueManager(this);
        this.quests = new QuestManager(this);
        this.combat = new CombatSystem();
        this.checkpoints = new CheckpointManager();
        this.story = new StoryDirector(this);
        this.sceneMgr = new SceneManager(this);

        // UI
        this.hud = new HUD(this);
        this.menu = new Menu(this);
        this.pauseMenu = new PauseMenu(this);
        this.marker = new ObjectiveMarker(this);

        /* Aba escondida (ou app em segundo plano) no meio da aventura: abre a pausa.
           O palco já para de desenhar; sem isto o jogo voltava andando sozinho. */
        this._onVisibility = () => {
            if (document.hidden && this.running && !this.paused && !this.loading) this.pauseMenu.toggle(true);
        };
        document.addEventListener('visibilitychange', this._onVisibility);
        /* Janela perdeu o foco (alt-tab, notificação, ligação): também pausa. */
        this._onBlur = () => {
            if (this.running && !this.paused && !this.loading && !this._failing) this.pauseMenu.toggle(true);
        };
        window.addEventListener('blur', this._onBlur);

        // Atores principais
        this.player = new Player(this.collision);
        this.teco = new Teco();
        this.camila = new Camila();
        this.limbo.add(this.player.root, this.teco.root, this.camila.root);

        await Promise.all([preload({ models: MODELS, textures: TEXTURES }), this.player.equip(), this.stage.ready]);
        this.menu.setProgress(1);

        /* O fundo do menu é a própria sala da lareira, com a câmera passeando devagar. */
        await this.sceneMgr.load('home', 'menu');
        this.menu.show();
    }

    _loadSettings() {
        /* sem escolha salva: celular e máquinas modestas começam no Baixo/Médio */
        this.quality = QUALITY[pickTier('auto')] || QUALITY.high;
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                if (s.quality && QUALITY[s.quality]) this.quality = QUALITY[s.quality];
                this._volume = s.volume;
            }
        } catch { /* privado */ }
    }

    setQuality(q) {
        this.quality = q;
        this.stage.setTier(q.tier);
    }

    startNewGame() {
        this.audio.unlock();
        this.story.resetFlags();
        this.inventory = { keys: 0, cellKey: false };
        this.checkpoints.clear();
        this.menu.hide();
        this.hud.show();
        this.running = true;
        this.paused = false;
        this.loadStage('home', 'home_intro');
    }

    continueGame() {
        this.audio.unlock();
        const data = this.checkpoints.load();
        this.menu.hide();
        this.hud.show();
        this.running = true;
        this.paused = false;
        if (data && data.checkpoint) {
            this.story.applySave(data);
            this.checkpoints.current = data.checkpoint;
            const stage = CHECKPOINT_STAGE[data.checkpoint] || data.level || 'home';
            this.loadStage(stage, data.checkpoint);
        } else {
            this.loadStage('home', 'home_intro');
        }
    }

    /** Volta ao menu (pausa → sair). */
    quitToMenu() {
        this.running = false;
        this.hud.hide();
        this.loadStage('home', 'menu').then(() => this.menu.show());
    }

    /**
     * Troca de estágio atrás do véu preto: a cena só reaparece quando o nível novo
     * terminou de montar (modelos, terreno, shaders).
     */
    async loadStage(stageId, checkpoint = null) {
        const token = (this._loadToken = (this._loadToken || 0) + 1);
        const overlay = document.getElementById('fade');
        this.loading = true;
        if (overlay) {
            overlay.style.transition = 'opacity 0.25s ease';
            overlay.classList.add('is-active');
        }
        this.dialogue.clear();
        this.input.lockLost = false;
        this.stageId = stageId;
        try {
            await this.sceneMgr.load(stageId, checkpoint);
        } catch (err) {
            console.error('[Guerreiro] falha ao montar o estágio', stageId, err);
        }
        if (token !== this._loadToken) return;
        this.loading = false;
        this._failing = false;
        this._safeParent = null;
        this._airT = 0;
        this.input.release();
        if (checkpoint !== 'menu') this.hud.showLevelName(stageId);
        if (overlay) {
            overlay.style.transition = 'opacity 0.9s ease';
            requestAnimationFrame(() => overlay.classList.remove('is-active'));
        }
    }

    fadeTo(duration, onMid, outDuration) {
        const overlay = document.getElementById('fade');
        if (!overlay) {
            onMid?.();
            return;
        }
        overlay.style.transition = `opacity ${duration}s ease`;
        overlay.classList.add('is-active');
        setTimeout(() => {
            onMid?.();
            setTimeout(() => {
                if (this.loading) return; // loadStage devolve a imagem quando terminar
                overlay.style.transition = `opacity ${outDuration || duration}s ease`;
                overlay.classList.remove('is-active');
            }, 60);
        }, duration * 1000);
    }

    failCheckpoint(reason) {
        if (this._failing) return;
        this._failing = true;
        this.audio.play('fail');
        /* Derrota sem castigo: volta ao último ponto salvo com a vida cheia. */
        this.hud.showToast(`${reason || 'Ops!'} Vamos tentar de novo.`, 3);
        this.fadeTo(1.2, () => {
            this.player.heal();
            const cp = this.checkpoints.current || 'home_intro';
            const stage = CHECKPOINT_STAGE[cp] || 'home';
            const data = this.checkpoints.load();
            if (data) this.story.applySave(data);
            this.loadStage(stage, cp);
        });
    }

    showEnding() {
        this.running = false;
        this.input.exitLock();
        this.hud.hide();
        this.checkpoints.clear();
        const end = document.getElementById('endOverlay');
        if (end) end.hidden = false;
    }

    tick(dt) {
        this.time += dt;
        const p = this.player;
        if (this.loading) return;

        if (!this.running) {
            // menu: só o cenário de fundo respira
            this.sceneMgr.update(dt);
            this.cutscenes.update(dt);
            p.hero.update(dt, p.anim);
            return;
        }
        if (this.paused) {
            /* Esc também tira da pausa. Antes o retorno vinha antes de ler a tecla: Esc
               não despausava e o toque ficava guardado, pausando de novo ao continuar. */
            this.input.consume('lockLost');
            this.input.consume('advance'); // Espaço na pausa não pula a próxima fala
            if (this.input.consume('pause')) this.pauseMenu.toggle(false);
            return;
        }

        this.input.update();

        /* Esc com o cursor travado: o navegador solta a trava e engole a tecla. */
        if (this.input.consume('pause') || this.input.consume('lockLost')) {
            this.pauseMenu.toggle(true);
            return;
        }

        if (this.input.consume('advance')) {
            if (this.dialogue.active) {
                /* fala de cena (bloqueante): Espaço só avança; fala solta no meio da ação
                   avança E pula, como antes — não rouba o pulo do jogador */
                if (this.dialogue.blocking) this.input.move.jump = false;
                this.dialogue.advance();
            } else if (this.cutscenes.blocking) {
                /* Espaço / Enter / botão ⤴ pulam a câmera cinematográfica. */
                this.cutscenes.skip();
                this.input.move.jump = false;
            }
        }

        const lookDelta = this.input.consumeLook();
        const zoomDelta = this.input.consumeZoom();

        /* hitstop: a simulação anda a 6 % por alguns centésimos; câmera e HUD no tempo real */
        const sdt = this._hitstop > 0 ? dt * 0.06 : dt;
        this._hitstop = Math.max(0, this._hitstop - dt);

        // Passo e movimento do jogador
        const step = p.update(sdt, this.input, this.cameraRig.yaw);
        if (step) {
            this.audio.footstep(p.crouching);
        }

        // Companheiros
        this.teco.update(sdt, this);
        this.camila.update(sdt, this);

        // Fases (movem navio/plataformas antes da câmera)
        this.sceneMgr.update(sdt);

        // Câmera
        this.cameraRig.update(dt, p, lookDelta, zoomDelta, p.sprinting);
        this.marker.update();

        // Interação
        const prompt = this.interact.update(p, this);
        this.hud.setInteractPrompt(prompt);

        if (this.input.consume('interact')) {
            this.interact.tryInteract(p, this);
        }

        // Combate & Projéteis
        this.combat.update(sdt, this);
        this.arrows.update(sdt, this);

        // Clima & Ambiente
        this.storm.update(dt, this);
        this.weather.update(dt);
        this.collision.update(sdt);
        this.cutscenes.update(dt);
        this.dialogue.update(dt);
        this.audio.update(dt);
        this.hud.update(dt);

        /* Derrota fora das flechas (guarda, tigre): reinicia do checkpoint. */
        if (!p.alive && !this._failing) this.failCheckpoint('Dico caiu…');
        else if (!this._failing) this._safetyNet(dt);
    }

    /**
     * Rede de segurança contra fresta de colisão e queda no vazio: devolve Dico ao último
     * chão seguro do mesmo nível (ou ao checkpoint, se não houver um).
     */
    _safetyNet(dt) {
        const p = this.player;
        const parent = p.root.parent;
        if (p.controller.mode !== 'walk') return;
        this._airT = p.grounded ? 0 : (this._airT || 0) + dt;
        if (p.grounded) {
            this._safeT += dt;
            if (this._safeT > 0.4 || this._safeParent !== parent) {
                this._safeT = 0;
                this._safe.copy(p.position);
                this._safeParent = parent;
            }
            return;
        }
        const lost = p.position.y < -30 || (this._safeParent === parent && p.position.y < this._safe.y - 20) || this._airT > 4;
        if (!lost) return;
        if (this._safeParent === parent) {
            p.position.copy(this._safe);
            p.controller.vx = p.controller.vz = p.controller.vy = 0;
            p.sync();
            this._airT = 0;
            this.cameraRig.snapToPlayer(p);
            this.hud.showToast('De volta ao chão firme.', 2.2);
        } else {
            this.failCheckpoint('Ops!');
        }
    }

    start() {
        this.stage.start((dt) => {
            this.tick(dt);
            this.ocean.update(dt, this.time);
            // a sombra do sol acompanha o jogador
            this.player.root.getWorldPosition(this.stage.focus);
        });
    }
}
