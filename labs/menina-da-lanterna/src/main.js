/**
 * A Menina da Lanterna — laço principal, capítulos e câmera.
 * Clara acende o que a noite esqueceu. Cinco cenas, uma historinha.
 *
 * Modo infantil (regras de perdão):
 *   vida          5 corações · Sombrio que encosta foge por 3 s, a Noite fica tonta 2,5 s (npcs.js)
 *   escuro        sem chama (fuel ≤ 4) e longe de lampião: −1 coração a cada 5 s
 *   derrota       "Acender de novo" devolve Clara ao último ponto de luz (lampião, raiz,
 *                 conversa…) com corações e chama cheios — o que já foi aceso continua aceso.
 *                 "Recomeçar capítulo" (pausa) volta ao começo do capítulo, com as
 *                 lembranças e a chama de quando Clara entrou nele
 *   bússola       seta no HUD aponta o próximo passo (guide.js, _guideTarget)
 *   rastro        fagulhas no chão correm de Clara até o próximo passo (trail.js)
 *   chama fraca   fuel < 25 longe de lampião: bússola e rastro trocam o alvo pelo abrigo
 *                 mais perto (vaga-lume ou lampião aceso, que reacende a chama); o modo só
 *                 sai quando a chama passa de 45 (histerese: a seta não pisca no limiar)
 *   dica          30 s sem se aproximar do alvo → repete a dica; 12 s → o rastro brilha mais
 *   "Pular"       encerra a abertura do capítulo e o nascer do sol final
 *   desencalhe    corpo dentro de colisor → ponto livre mais perto (player.js)
 *   robustez      exceção no quadro não derruba o laço; carregamento com aviso e botão de
 *                 recarregar após 40 s; áudio que não destrava não segura o "Jogar"
 *
 * Desempenho por tier (config.js → QUALITY): PointLights repartidas entre os lampiões
 * mais próximos (3/5/6) e sombra em cubo da lanterna (0/512/1024). Em aparelho de toque
 * a sombra da lanterna fica em no máximo 512 e o pixelRatio em no máximo 1,5.
 */

import * as THREE from 'three';
import { createStage, STAGE_TIERS } from '../../shared/gfx/stage.js?v=18';
import { CHAPTERS, QUALITY, STORAGE_KEY, PLAYER, STORY, ROOT_ORDER, ROOT_NAMES } from './config.js?v=22';
import { clamp, detectTouch, formatTime, lerp, damp, smoothstep } from './utils.js?v=22';
import { Input } from './input.js?v=22';
import { GameAudio } from './audio.js?v=22';
import { Hud, statsBlock } from './hud.js?v=22';
import { Player } from './player.js?v=22';
import { createValley } from './world.js?v=22';
import { nearestInteractable } from './npcs.js?v=22';
import { LightTrail } from './trail.js?v=22';
import { Guide } from '../../shared/gfx/guide.js?v=1';

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const TMP = new THREE.Vector3();
const FROM = new THREE.Vector3();

/* Um arrasto de dedo percorre bem menos pixels que o mouse na mesa: sem esse
   ganho a câmera do celular custa três deslizadas para dar meia volta. */
const TOUCH_LOOK_GAIN = 2.2;

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.chapterIndex = 0;
        this.time = 0;
        this.elapsed = 0;
        this.memories = 0;
        this.score = 0;
        this.caught = 0;
        this.lampsTotal = 0;
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.dialogue = null;
        this.fpsAccum = 0;
        this.hudAccum = 0;
        this.orbit = 0;
        this.pendingChapter = 0;
        this.darkHurtT = 0;
        this.warm = 0;
        this.dawn = 0;
        this.dawnT = 0;
        this.fadeEl = document.getElementById('fade');
        this.guide = new Guide(document.getElementById('guide'));
        this.skipEl = document.getElementById('skipButton');
        this.hintT = 0;
        this.bestGoalD = Infinity;
        /** Progresso ao entrar no capítulo ("Recomeçar capítulo" volta para cá). */
        this.checkpoint = { memories: 0, score: 0, caught: 0, lampsTotal: 0, elapsed: 0 };
        /** Último ponto de luz: onde "Acender de novo" devolve Clara depois de uma derrota. */
        this.respawnPoint = { x: 0, z: 0 };
        /** Próximo passo (bússola + rastro), recalculado a 10 Hz. */
        this.goalTarget = null;
        this.goalScratch = { x: 0, z: 0, name: '', near: 2 };
        this.lowFuel = false;
        this.frameErrors = 0;
        this.starting = false;
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false, best: 0, unlocked: 0 };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch (err) {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (err) { /* privado */ }
    }

    async init() {
        this.hud.setLoading(0.06, 'Acendendo o pavio…');
        // carregamento nunca infinito: aos 40 s o card mostra "conexão lenta" e um botão de recarregar
        const watchdog = setTimeout(() => this.hud.slowLoading(), 40000);
        this.touch = detectTouch();
        this.hud.setTouch(this.touch);
        // celular/tablet: tela densa já é nítida a 1,5×; acima disso só esquenta o aparelho.
        // (STAGE_TIERS é o orçamento do kit; mexemos só na cópia desta página, antes do palco nascer)
        if (this.touch) for (const t of Object.values(STAGE_TIERS)) t.pixelRatio = Math.min(t.pixelRatio, 1.5);
        const choice = ['low', 'medium', 'high'].includes(this.settings.quality) ? this.settings.quality : 'auto';
        // palco: renderer + céu físico + lua com sombra + pós (AO, bloom, névoa de altura, grade)
        this.stage = createStage({ canvas: this.canvas, tier: choice, preset: 'noite-lua', fov: 50, near: 0.2 });
        if (!this.stage) {
            clearTimeout(watchdog);
            this.hud.showError('Este laboratório precisa de WebGL 2. Tente um navegador atualizado ou reative a aceleração de hardware.');
            return;
        }
        const stage = this.stage;
        this.scene = stage.scene;
        this.camera = stage.camera;
        this.quality = QUALITY[stage.tier];
        stage.onTier((t) => {
            // o palco caiu de tier por fps: grama mais rala e a lanterna perde a sombra em cubo
            // (6 passadas por quadro) já no medium em aparelho de toque
            this.quality = QUALITY[t];
            this.valley?.grass.setDensity(t === 'low' ? 0.45 : 0.75);
            if (this.player) this.player.light.castShadow = this._lanternShadowSize() > 0;
        });

        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.hud.setLoading(0.14, 'Abrindo Vale-da-Bruma…');
        await new Promise((r) => requestAnimationFrame(() => r()));

        this.valley = await createValley(stage, this.quality, (p, text) => this.hud.setLoading(p, text));
        const shadowSize = this._lanternShadowSize();
        this.player = new Player(this.scene, this.valley, { shadow: shadowSize > 0, shadowSize: shadowSize || 512, detail: stage.tier === 'low' ? 1 : 2 });
        this.trail = new LightTrail(this.valley.glows, 10);
        await this.player.equip();
        this.player.root.visible = false;
        this._patchShadowPasses();

        this._bindUi();
        window.addEventListener('resize', () => this._resize());

        await this._loadChapter(0, { menu: true });
        // aquece: assa os impostores da floresta, gera as células de grama e compila os shaders
        this.hud.setLoading(0.9, 'A bruma se assenta…');
        let baked = false;
        this.valley.forest.ready.then(() => { baked = true; });
        for (let i = 0; i < 240 && !baked; i++) {
            this._updateMenuCam(0.016);
            this.valley.update(0.016, i * 0.016, this.player, this.camera);
            await new Promise((r) => requestAnimationFrame(() => r()));
        }
        this._applyAtmos(1);
        // compilar shaders pode travar em driver ruim: 10 s depois segue e compila sob demanda
        await Promise.race([stage.warmup(), wait(10000)]);
        clearTimeout(watchdog);
        this.hud.setLoading(1, 'A chama espera.');
        this.hud.hideLoading();
        this._refreshChapterList();

        this.hud.el.qualitySelect.value = this.settings.quality;
        this.hud.el.volumeSlider.value = String(this.settings.volume);
        this.hud.setVolumeLabel(this.settings.volume);
        this.hud.setBest(this.settings.best);
        this.hud.setMuted(this.settings.muted);
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        stage.start((dt) => this._frame(dt));
    }

    /** Lado do mapa de sombra em cubo da lanterna no tier atual (toque: no máximo 512). */
    _lanternShadowSize() {
        const s = this.quality.lanternShadow;
        return this.touch ? Math.min(s, 512) : s;
    }

    /**
     * A sombra em cubo da lanterna desenha a cena 6 vezes. Floresta, dispersão e o lote de
     * construções não têm descarte por peça, então sairiam inteiros em cada face.
     * Como o three consulta `shadow.getFrustum()` antes de cada face, usamos esse
     * gancho para desligar `castShadow` desses grupos só na passada da lanterna
     * (a sombra da lua continua com as árvores).
     */
    _patchShadowPasses() {
        const scene = this.scene;
        const list = [];
        let stamp = -1;
        // só personagens e a raposa projetam sombra da lanterna
        const keep = (o) => o.userData.lanternCaster;
        const collect = () => {
            let n = scene.children.length;
            for (const g of this.valley.heavy) n += g.children.length * 1000;
            if (n === stamp) return;
            stamp = n;
            list.length = 0;
            for (const root of scene.children) {
                if (keep(root)) continue;
                root.traverse((o) => {
                    if (o.isMesh && (o.castShadow || o.userData.moonShadow)) {
                        o.userData.moonShadow = true;
                        list.push(o);
                    }
                });
            }
        };
        const set = (v) => {
            collect();
            for (const o of list) o.castShadow = v;
        };
        const sun = this.stage.sun.shadow;
        const sunFr = sun.getFrustum.bind(sun);
        sun.getFrustum = () => { set(true); return sunFr(); };
        const lan = this.player.light.shadow;
        const lanFr = lan.getFrustum.bind(lan);
        lan.getFrustum = () => { set(false); return lanFr(); };
    }

    _refreshChapterList() {
        this.hud.fillChapters(this.settings.unlocked, CHAPTERS[this.pendingChapter].id, (i) => {
            this.pendingChapter = i;
            this._refreshChapterList();
        });
    }

    _bindUi() {
        this.hud.el.qualitySelect.addEventListener('change', () => {
            this.settings.quality = this.hud.el.qualitySelect.value;
            this.saveSettings();
            // pós, sombra e resolução mudam na hora; texturas e densidade do vale valem ao recarregar
            const q = this.settings.quality;
            if (q !== 'auto' && !this.stage.software) this.stage.setTier(q);
            this.quality = QUALITY[this.stage.tier];
            this.player.light.castShadow = this._lanternShadowSize() > 0;
        });
        this.hud.el.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(this.hud.el.volumeSlider.value);
            this.hud.setVolumeLabel(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        document.getElementById('startButton').addEventListener('click', () => this.start(this.pendingChapter));
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.retry());
        document.getElementById('restartButton')?.addEventListener('click', () => this.restartChapter());
        document.getElementById('reloadButton')?.addEventListener('click', () => location.reload());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start(0));
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('dialogueContinue').addEventListener('click', (e) => {
            e.stopPropagation();
            this._advanceDialogue();
        });
        // tocar em qualquer lugar do diálogo também avança
        this.hud.el.dialogue.addEventListener('click', () => this._advanceDialogue());
        // o aviso "E …" é um botão: tocar nele interage
        this.hud.el.prompt.addEventListener('click', () => {
            if (this.state === 'playing') this.input.interactPressed = true;
        });
        this.skipEl?.addEventListener('click', () => this._skip());
        // aba oculta: o palco para de desenhar e a noite pausa
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });
        // janela perdeu o foco (alt-tab, notificação): pausa — as teclas presas já são soltas
        // pelo teclado compartilhado; o stick e o "correr" do toque, em _bindTouch
        window.addEventListener('blur', () => {
            if (this.state === 'playing') this.pause();
        });
        // Esc solta o mouse sem chegar como tecla: soltar o mouse jogando abre a pausa
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && this.state === 'playing' && !this.touch) this.pause();
        });
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => this.pause());

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('camera', () => {
            const dists = [4.2, 5.8, 8.6];
            const i = dists.findIndex((d) => Math.abs(this.player.camDist - d) < 0.3);
            this.player.camDist = dists[(i + 1) % dists.length];
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('confirm', () => {
            if (this.state === 'dialogue') this._advanceDialogue();
        });
        this.input.on('pointerdown', () => {
            if (this.state === 'playing') this.input.requestLock();
            if (this.state === 'dialogue') this._advanceDialogue();
        });

        this._bindTouch();
    }

    _bindTouch() {
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        if (!stick) return;
        const setFrom = (clientX, clientY) => {
            const r = stick.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            let dx = (clientX - cx) / (r.width * 0.42);
            let dy = (clientY - cy) / (r.height * 0.42);
            const len = Math.hypot(dx, dy) || 1;
            if (len > 1) {
                dx /= len;
                dy /= len;
            }
            this.input.touchMove.x = dx;
            this.input.touchMove.y = -dy;
            /* O curso do knob acompanha o raio do stick, que muda com a
               media query de paisagem. */
            const travel = r.width * 0.2;
            knob.style.transform = `translate(${dx * travel}px, ${dy * travel}px)`;
        };
        const capturePointer = (el, pointerId) => {
            try {
                el.setPointerCapture(pointerId);
            } catch (err) {
                /* Ponteiro encerrado antes do handler: segue sem captura. */
            }
        };

        /* A captura de ponteiro é best-effort: setPointerCapture lança
           InvalidStateError quando o ponteiro já terminou, e a exceção
           derrubava o gesto. O id guardado mantém o arrasto funcionando. */
        let stickId = null;

        const end = () => {
            stickId = null;
            this.input.touchMove.x = 0;
            this.input.touchMove.y = 0;
            knob.style.transform = 'translate(0,0)';
        };
        stick.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            stickId = e.pointerId;
            capturePointer(stick, e.pointerId);
            setFrom(e.clientX, e.clientY);
        }, { passive: false });
        stick.addEventListener('pointermove', (e) => {
            if (stickId === e.pointerId) setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);

        const lookZone = document.getElementById('lookZone');
        let lookId = null;
        let lx = 0;
        let ly = 0;
        lookZone?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            lookId = e.pointerId;
            capturePointer(lookZone, e.pointerId);
            lx = e.clientX;
            ly = e.clientY;
        }, { passive: false });
        lookZone?.addEventListener('pointermove', (e) => {
            if (lookId !== e.pointerId) return;
            /* Sem o guarda, o arrasto durante a abertura do capítulo se
               acumulava e a câmera pulava assim que o jogo liberava o input. */
            if (this.input.enabled) {
                this.input.lookX += (e.clientX - lx) * TOUCH_LOOK_GAIN;
                this.input.lookY += (e.clientY - ly) * TOUCH_LOOK_GAIN;
            }
            lx = e.clientX;
            ly = e.clientY;
        });
        const endLook = () => {
            lookId = null;
        };
        lookZone?.addEventListener('pointerup', endLook);
        lookZone?.addEventListener('pointercancel', endLook);

        /* pointerdown em vez de click: responde no toque, sem o atraso e sem
           depender do dedo levantar em cima do botão. */
        const press = (id, fn) => {
            const el = document.getElementById(id);
            el?.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                capturePointer(el, e.pointerId);
                fn();
            }, { passive: false });
            return el;
        };

        press('btnInteract', () => {
            this.input.interactPressed = true;
        });
        press('btnFlash', () => {
            this.input.flashPressed = true;
        });

        const sprint = press('btnSprint', () => {
            this.input.touchSprint = true;
        });
        /* pointerup sozinho deixava o "correr" preso quando o dedo saía do
           botão antes de levantar. */
        const endSprint = () => {
            this.input.touchSprint = false;
        };
        sprint?.addEventListener('pointerup', endSprint);
        sprint?.addEventListener('pointercancel', endSprint);
        sprint?.addEventListener('pointerleave', endSprint);
        window.addEventListener('blur', () => {
            endSprint();
            end();
            endLook();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            endSprint();
            end();
            endLook();
        });
    }

    async _loadChapter(index, { menu = false } = {}) {
        const ch = CHAPTERS[index];
        this.chapterIndex = index;
        this.chapter = ch;
        this.world = this.valley.enter(index);
        if (menu) this.valley.calm();
        this.dawn = 0;
        this.dawnT = 0;
        this.warm = this.world.warmth();
        this.stage.sky.setClouds(ch.atmos.clouds);
        this.stage.setTimeOfDay(ch.atmos.hour);
        this._applyAtmos(1);
        this.audio.setTheme(ch.music);
        this.player.lanternOn = true;
        this.player.lightScale = 1;
        this.hero = this.player.hero;
        if (this.player.lantern && this.player.lantern.parent !== this.lanternHome && this.lanternHome) {
            this.lanternHome.add(this.player.lantern);
            this.player.lantern.position.copy(this.lanternLocal);
            this.player.lantern.scale.copy(this.lanternScale);
            this.player.lantern.quaternion.identity();
        }

        const s = menu ? { x: 2.2, z: 123.6, yaw: 0.9 } : this.world.spawn;
        this.player.spawn(s.x, s.z, s.yaw, this.world.heightAt);
        this.player.animate(0.016, 0);
    }

    /**
     * Atmosfera do capítulo, a cada quadro. w = progresso suavizado (lampiões acesos):
     *   névoa      = lerp(apagado, aceso, w)      saturação, ganho, exposição: idem
     *   vaga-lumes = fração w do enxame
     * No capítulo V, d = progresso do nascer do sol (0..1) substitui w e a hora solar
     * anda de `hour` até `dawn` com suavização:  hora = lerp(hour, dawn, d²·(3 − 2d)).
     */
    _applyAtmos(dt) {
        const a = this.chapter.atmos;
        const P = this.stage.pipeline.params;
        const target = this.chapter.id === 'alvorecer' ? this.dawn : this.world.warmth();
        this.warm = dt >= 1 ? target : damp(this.warm, target, 1.2, dt);
        const w = this.warm;
        P.fogDensity = lerp(a.fog[0], a.fog[1], w);
        P.fogFalloff = a.falloff;
        P.haze = lerp(a.haze[0], a.haze[1], w);
        P.saturation = lerp(a.sat[0], a.sat[1], w);
        P.exposure = lerp(a.exposure[0], a.exposure[1], w) / (this.stage.ldr ? 0.5 : 1);
        P.gain.setRGB(lerp(a.gain[0][0], a.gain[1][0], w), lerp(a.gain[0][1], a.gain[1][1], w), lerp(a.gain[0][2], a.gain[1][2], w));
        P.vignette = lerp(0.46, 0.3, w);
        P.bloom = lerp(0.15, 0.12, w) - this.dawn * 0.06;
        // de dia a névoa já herda o céu claro: o reforço leitoso da noite sai com o sol
        const tk = 1 - this.dawn;
        const dt3 = a.dawnTint || [1, 1, 1];
        P.fogTint.setRGB(lerp(dt3[0], a.tint[0], tk), lerp(dt3[1], a.tint[1], tk), lerp(dt3[2], a.tint[2], tk));
        P.contrast = 1.08 + this.dawn * 0.08;
        P.fogSunGlow = 0.4 - this.dawn * 0.28;
        P.rays = 0.25 + this.dawn * 0.75;
        this.stage.fill.intensity = lerp(a.fill[0], a.fill[1], w) * (this.stage.ldr ? 0.5 : 1);
        this.valley.motes.uniforms.uAmount.value = this.chapter.id === 'alvorecer' ? 0.6 * (1 - this.dawn) : 0.12 + 0.88 * w;
    }

    async start(index = 0) {
        if (this.starting) return; // clique duplo no "Jogar" não carrega o capítulo duas vezes
        this.starting = true;
        try {
            await this._start(index);
        } finally {
            this.starting = false;
        }
    }

    async _start(index) {
        // áudio só destrava com gesto e pode falhar/pendurar (iOS): nunca segura o jogo
        try {
            await Promise.race([this.audio.unlock(), wait(1200)]);
            this.audio.setVolume(this.settings.volume / 100);
            this.audio.setMuted(this.settings.muted);
        } catch (err) { /* segue sem som */ }

        this.pendingChapter = index;
        this.chapterIndex = index;
        this.elapsed = 0;
        this.memories = 0;
        this.score = 0;
        this.caught = 0;
        this.lampsTotal = 0;
        this.player.maxHealth = 5;
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.hideDialogue();
        this.hud.showPause(false);

        await this._loadChapter(index);
        this._beginIntro();
    }

    /**
     * Derrota → "Acender de novo": Clara reaparece no último ponto de luz, virada para o
     * próximo passo, com corações e chama cheios. O que já foi aceso continua aceso;
     * Sombrios e a Noite voltam para casa.
     */
    retry() {
        if (this.state !== 'defeat') return;
        this.hud.hideDefeat();
        const w = this.world;
        const rp = this.respawnPoint;
        this.lowFuel = false;
        this.player.fuel = PLAYER.fuelMax; // o rumo de volta é o próximo passo, não o abrigo
        const t = this._guideTarget();
        const yaw = t ? Math.atan2(t.x - rp.x, t.z - rp.z) : w.spawn.yaw;
        this.player.spawn(rp.x, rp.z, yaw, w.heightAt);
        if (w.blocked(rp.x, rp.z, PLAYER.radius)) this.player._unstick(w);
        for (const s of w.shadows) s.reset();
        w.night?.reset();
        this.darkHurtT = 0;
        this.hintT = 0;
        this.bestGoalD = Infinity;
        this.hud.setHearts(this.player.health, this.player.maxHealth);
        this.hud.setFuel(this.player.fuel);
        this.hud.setStealth(0);
        this.fade = 1;
        this.fadeDir = -1;
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.enabled = true;
        this.input.consumeInteract();
        this.input.consumeFlash();
        this.hud.say('A chama acendeu de novo, aqui onde ainda havia luz.', 3.4);
        if (!this.touch) this.input.requestLock();
    }

    /** Pausa → "Recomeçar capítulo": do começo, com o progresso de quando Clara entrou nele. */
    async restartChapter() {
        const cp = { ...this.checkpoint };
        await this.start(this.chapterIndex);
        Object.assign(this, cp);
        this.checkpoint = cp;
        this.hud.setMemories(this.memories, CHAPTERS.length);
    }

    /** Marca o ponto de luz atual (onde Clara está ao acender/falar/libertar) como volta segura. */
    _markRespawn() {
        this.respawnPoint.x = this.player.x;
        this.respawnPoint.z = this.player.z;
    }

    /** "Pular": encerra a abertura do capítulo ou adianta o nascer do sol final. */
    _skip() {
        if (this.state === 'intro') this.introT = 99;
        else if (this.state === 'dawn') this.dawnT = Math.max(this.dawnT, 15);
    }

    _beginIntro() {
        this.state = 'intro';
        this.hud.setState('intro');
        this.introT = 0;
        this.checkpoint = { memories: this.memories, score: this.score, caught: this.caught, lampsTotal: this.lampsTotal, elapsed: this.elapsed };
        this.hintT = 0;
        this.bestGoalD = Infinity;
        this.respawnPoint.x = this.world.spawn.x;
        this.respawnPoint.z = this.world.spawn.z;
        this.lowFuel = false;
        this.goalTarget = null;
        this.guide.hide();
        this.trail?.clear();
        if (this.skipEl) this.skipEl.hidden = false;
        this.player.root.visible = true;
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.touch);
        this.hud.setChapter(this.chapter);
        this.hud.setHearts(this.player.health, this.player.maxHealth);
        this.hud.setFuel(this.player.fuel);
        this.hud.setMemories(this.memories, CHAPTERS.length);
        this.hud.showChapterCard(this.chapter);
        this.hud.say(this.chapter.objective, 5.5);
        this.input.enabled = false;
        this.fade = 1;
        this.fadeDir = -1;
    }

    pause() {
        if (this.state !== 'playing') return;
        this.guide.hide();
        this.trail.clear();
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.input.exitLock();
        // o teclado segue ligado para P/Esc tirarem da pausa (o mundo não anda em 'pause')
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.input.enabled = true;
        this.input.consumeInteract();
        if (!this.touch) this.input.requestLock();
    }

    async toMenu() {
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.hideDialogue();
        this.hud.showHud(false);
        this.input.exitLock();
        this.input.enabled = true;
        await this._loadChapter(0, { menu: true });
        this._refreshChapterList();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    _frame(dt) {
        this.time += dt;
        // uma exceção num quadro não pode congelar a noite: registra (só as 3 primeiras) e segue
        try {
            this._update(dt);
            this.valley.update(dt, this.time, this.player, this.camera);
            this._applyAtmos(dt);
        } catch (err) {
            if (this.frameErrors++ < 3) console.error(err);
        }
        this.fpsAccum += dt;
        if (this.fpsAccum >= 0.5) {
            this.hud.setFps(Math.round(this.stage.fps));
            this.fpsAccum = 0;
        }
    }

    _update(dt) {
        this.hud.tick(dt);
        this.audio.update(dt);

        const fade = clamp(this.fade + this.fadeDir * dt * 0.85, 0, 1);
        if (fade !== this.fade) {
            this.fade = fade;
            this.fadeEl.style.opacity = String(fade);
        }

        if (this.state === 'menu') {
            this.player.animate(dt, 0);
            this._updateMenuCam(dt);
            return;
        }
        if (this.state === 'intro') {
            this.player.animate(dt, 0);
            this._updateIntro(dt);
            return;
        }
        if (this.state === 'dawn') {
            this._updateDawn(dt);
            return;
        }
        if (this.state === 'dialogue') {
            // E, Espaço ou clique avançam a fala
            if (this.input.consumeInteract() | this.input.consumeFlash()) this._advanceDialogue();
        }
        if (this.state === 'dialogue') {
            const talkTo = this.dialogue?.item?.npc;
            this.player.hero.lookAt(talkTo ? TMP.set(talkTo.x, this.player.y + 1.5, talkTo.z) : null);
            if (talkTo) talkTo.mode = 'talk';
            this.player.animate(dt, 0);
            this.world.fox?.update(dt, this.player, this.world.heightAt);
            this._followCamera(dt);
            return;
        }
        if (this.state === 'pause' || this.state === 'defeat' || this.state === 'victory' || this.state === 'transition') {
            this.player.animate(dt, 0, this.state === 'victory' ? { mode: 'cheer' } : null);
            if (this.state !== 'victory') this._followCamera(dt);
            else this._updateDawnCam(dt);
            return;
        }
        if (this.state !== 'playing') return;

        this.elapsed += dt;
        this.hudAccum += dt;
        if (this.hudAccum > 0.15) {
            this.hud.setTime(this.elapsed);
            this.hud.setFuel(this.player.fuel);
            this.hudAccum = 0;
        }

        this.player.hero.lookAt(null);
        const info = this.player.update(dt, this.input, this.world, this.chapter);
        if (info.footstep) this.audio.footstep();
        if (info.flash) {
            this.audio.flash();
            this._applyFlash();
        }

        this._updateNpcs(dt);
        this._pickupFireflies();
        this._updateInteract();
        this._checkDark(dt);
        this._refreshObjective();
        this._followCamera(dt);
        if (this.state === 'playing') this._updateGuide(dt);
        else {
            this.guide.hide();
            this.trail.clear();
        }
    }

    /**
     * Próximo passo do capítulo para a bússola e o rastro: { x, z, name, near } ou null.
     *   I   Tomás → carta → lampião apagado mais perto → saída
     *   II  lanterna apagada mais perto → moinho
     *   III bóia apagada mais perto → Pingo (sarças) → ponte
     *   IV  próxima raiz da canção (ouro, azul, rosa, verde) → copa
     *   V   Pedra da Aurora
     * Chama fraca (lowFuel: capítulo escuro, entrou < 25, sai > 45; longe de lampião): o alvo vira o abrigo mais
     * perto — vaga-lume aceso ou lampião aceso (que reacende +6/s) — se estiver a < 45 m.
     * Sem alocação: devolve sempre o mesmo objeto (goalScratch).
     */
    _guideTarget() {
        const w = this.world;
        const p = this.player;
        const out = this.goalScratch;
        const at = (it, name) => {
            if (!it) return null;
            out.x = it.x;
            out.z = it.z;
            out.name = name;
            out.near = (it.r || 1.6) + 0.3;
            return out;
        };
        const first = (kind, test = null) => {
            for (const it of w.interactables) if (it.kind === kind && !it.done && (!test || test(it))) return it;
            return null;
        };
        const nearest = (list, want) => {
            let best = null;
            let bd = Infinity;
            for (const it of list) {
                if (!want(it)) continue;
                const d = Math.hypot(it.x - p.x, it.z - p.z);
                if (d < bd) {
                    bd = d;
                    best = it;
                }
            }
            return best;
        };
        const id = this.chapter.id;

        if (this.lowFuel && !p.nearLit) {
            const fly = nearest(w.fireflies, (f) => !f.done);
            const lamp = nearest(w.lamps, (l) => l.lit);
            const df = fly ? Math.hypot(fly.x - p.x, fly.z - p.z) : Infinity;
            const dl = lamp ? Math.hypot(lamp.x - p.x, lamp.z - p.z) : Infinity;
            if (df < dl && df < 45) return at(fly, 'Vaga-lumes');
            if (dl < 45) {
                at(lamp, 'Abrigo de luz');
                out.near = PLAYER.lampRange * 0.8; // dentro do raio do abrigo a seta some
                return out;
            }
        }

        if (id === 'aldeia') {
            if (!w.progress.talked) return at(first('talk'), 'Tomás');
            const carta = first('memory', (m) => m.id === 'carta');
            if (carta) return at(carta, 'Carta');
        }
        if (id === 'arvore') {
            const next = ROOT_ORDER[w.progress.crystals.length];
            const c = next !== undefined ? first('crystal', (it) => it.index === next) : null;
            if (c) return at(c, `Raiz ${ROOT_NAMES[next]}`);
        }
        if (id === 'alvorecer') return at(first('place'), 'Pedra da Aurora');
        if (w.progress.lampsNeeded && w.lampsLit() < w.progress.lampsNeeded) {
            return at(nearest(w.lamps, (l) => !l.lit), id === 'rio' ? 'Bóia' : id === 'trilha' ? 'Lanterna' : 'Lampião');
        }
        if (id === 'rio' && !w.progress.foxFreed) return at(first('cage'), 'Pingo');
        if (w.goal && !w.goal.done && w.readyToExit()) return at(w.goal, id === 'trilha' ? 'Moinho' : id === 'rio' ? 'Ponte' : id === 'arvore' ? 'Copa' : 'Saída');
        return null;
    }

    _updateGuide(dt) {
        // alvo e seta a 10 Hz (a seta tem transição no CSS); o rastro anima a cada quadro
        this.guideAcc = (this.guideAcc || 0) + dt;
        if (this.guideAcc >= 0.1) {
            const step = this.guideAcc;
            this.guideAcc = 0;
            const p = this.player;
            const wasLow = this.lowFuel;
            if (!this.chapter.dark) this.lowFuel = false;
            else if (p.fuel < 25) this.lowFuel = true;
            else if (p.fuel > 45) this.lowFuel = false;
            if (this.lowFuel && !wasLow && !p.nearLit) {
                this.hud.say('A chama está fraca. Siga as fagulhas até a luz mais perto.', 4);
            }
            const t = this._guideTarget();
            this.goalTarget = t;
            this.guide.update(this.camera, this.player.x, this.player.z, t);
            if (t) {
                const d = Math.hypot(t.x - this.player.x, t.z - this.player.z);
                if (d < this.bestGoalD - 3) {
                    this.bestGoalD = d;
                    this.hintT = 0;
                }
                this.hintT += step;
                if (this.hintT > 30) {
                    this.hintT = 0;
                    this.bestGoalD = d;
                    this.hud.say(this.chapter.hint, 5);
                }
            }
        }
        // perdida há 12 s ou chama fraca: o rastro brilha mais
        const boost = 1 + 0.8 * smoothstep(12, 20, this.hintT) + (this.lowFuel ? 0.5 : 0);
        this.trail.update(dt, this.time, this.player, this.goalTarget, this.world, boost);
    }

    _updateMenuCam(dt) {
        // órbita lenta em torno de Clara, parada na praça com a lanterna
        this.orbit += dt * 0.07;
        const p = this.player;
        const r = 6.2;
        CAM.set(p.x + Math.sin(this.orbit + 0.6) * r, p.y + 1.9 + Math.sin(this.orbit * 0.7) * 0.35, p.z + Math.cos(this.orbit + 0.6) * r);
        const gy = this.world.heightAt(CAM.x, CAM.z) + 0.6;
        if (CAM.y < gy) CAM.y = gy;
        this.camera.position.copy(CAM);
        this.camera.lookAt(p.x + 1.2, p.y + 1.25, p.z);
    }

    _updateIntro(dt) {
        if (this.introT === 0) FROM.copy(this.world.overview);
        this.introT += dt;
        const t = clamp(this.introT / 3.2, 0, 1);
        const e = t * t * (3 - 2 * t);
        this.player.cameraPosition(CAM, this.world, dt);
        this.player.lookAt(LOOK);
        const c = this.world.center;
        this.camera.position.set(lerp(FROM.x, CAM.x, e), lerp(FROM.y, CAM.y, e), lerp(FROM.z, CAM.z, e));
        TMP.set(lerp(c.x, LOOK.x, e), lerp(c.y, LOOK.y, e), lerp(c.z, LOOK.z, e));
        this.camera.lookAt(TMP);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.input.consumeInteract();
            this.input.consumeFlash();
            if (this.skipEl) this.skipEl.hidden = true;
            this.hud.say(this.touch ? 'Siga a seta dourada. O botão ✦ pulsa a chama.' : 'Siga a seta dourada. Espaço pulsa a lanterna.', 3.6);
        }
    }

    _followCamera(dt) {
        this.player.cameraPosition(CAM, this.world, dt || 0.016);
        this.player.lookAt(LOOK);
        const k = 1 - Math.exp(-12 * (dt || 0.016));
        this.camera.position.lerp(CAM, k);
        this.camera.lookAt(LOOK);
    }

    /**
     * Clímax: a lanterna pousa na pedra e o sol nasce em DAWN_TIME s.
     *   d = t / DAWN_TIME;  hora = lerp(hour, dawn, smoothstep(d))
     * A câmera recua e gira para o leste-sudeste, onde o sol sobe sobre o vale aceso.
     */
    _updateDawn(dt) {
        const DAWN_TIME = 15;
        this.dawnT += dt;
        const d = clamp(this.dawnT / DAWN_TIME, 0, 1);
        this.dawn = d;
        const a = this.chapter.atmos;
        const e = d * d * (3 - 2 * d);
        this.hourAcc = (this.hourAcc || 0) + dt;
        if (this.hourAcc > 0.1 || d >= 1) {
            // reassar céu/IBL a cada quadro custa caro: 10 passos por segundo bastam
            this.hourAcc = 0;
            this.stage.setTimeOfDay(lerp(a.hour, a.dawn, e));
            this.stage.sky.setClouds(lerp(a.clouds, 0.36, e));
        }
        this.world.setStone(1 - e * 0.6);
        this.valley.setDawn(e);
        this.player.lightScale = 0;
        this.valley.embers.uniforms.uAmount.value = smoothstep(0.05, 0.5, d) * (1 - smoothstep(0.85, 1, d) * 0.5);
        this.player.animate(dt, 0, d > 0.55 ? { mode: 'cheer' } : { mode: 'idle' });
        this.world.fox?.update(dt, this.player, this.world.heightAt);
        this._updateDawnCam(dt);
        if (d >= 1 && this.state === 'dawn') this._completeChapter();
    }

    _updateDawnCam(dt) {
        const p = this.player;
        const sun = this.stage.sky.sunDir;
        // fica atrás de Clara, do lado oposto ao sol, subindo devagar
        const az = Math.atan2(sun.x, sun.z) + Math.PI + Math.sin(this.dawnT * 0.12) * 0.35;
        const r = 7.5 + this.dawn * 3.5;
        CAM.set(p.x + Math.sin(az) * r, p.y + 2.1 + this.dawn * 1.6, p.z + Math.cos(az) * r);
        const gy = this.world.heightAt(CAM.x, CAM.z) + 0.8;
        if (CAM.y < gy) CAM.y = gy;
        this.camera.position.lerp(CAM, 1 - Math.exp(-1.6 * dt));
        LOOK.set(p.x + sun.x * 6, p.y + 1.6 + this.dawn * 2.2, p.z + sun.z * 6);
        this.camera.lookAt(LOOK);
    }

    _applyFlash() {
        const px = this.player.x;
        const pz = this.player.z;
        const r = PLAYER.flashRadius;
        for (const lamp of this.world.lamps) {
            if (lamp.lit) continue;
            if (Math.hypot(lamp.x - px, lamp.z - pz) < r * 0.72) {
                this._lightLamp(lamp);
            }
        }
        for (const s of this.world.shadows) s.scare(px, pz, r);
        if (this.world.night) this.world.night.scare(px, pz, r);
        const cage = this.world.interactables.find((it) => it.kind === 'cage' && !it.done);
        if (cage && Math.hypot(cage.x - px, cage.z - pz) < 3.2) this._freeFox(cage);
    }

    _lightLamp(lamp) {
        if (lamp.lit) return;
        lamp.setLit(true);
        this._markRespawn();
        this.lampsTotal += 1;
        this.score += 40;
        this.audio.lamp();
        const n = this.world.lampsLit();
        const need = this.world.progress.lampsNeeded;
        this.hud.say(need ? `Chama ${n}/${need}.` : 'A chama pegou.', 2.2);
        if (this.chapter.id === 'rio' && n >= need) {
            this.world.revealBridge();
            this.hud.say('A ponte aparece sobre o rio.', 3);
        }
    }

    _freeFox(cage) {
        cage.burn();
        this._markRespawn();
        this.world.progress.foxFreed = true;
        this.world.fox?.free();
        this.score += 80;
        this.audio.chime();
        this._openDialogue('Pingo', STORY.pingo, null);
    }

    _updateNpcs(dt) {
        let maxAlert = 0;
        for (const s of this.world.shadows) {
            const ev = s.update(dt, this.player, this.world.heightAt, this.world.lamps);
            maxAlert = Math.max(maxAlert, s.alert, ev === 'chase' ? 0.8 : 0);
            if (ev === 'caught') this._shadowHit();
            else if (ev === 'chase' && Math.random() < dt * 0.35) this.audio.danger();
        }
        if (this.world.night) {
            const ev = this.world.night.update(dt, this.player, this.world.heightAt);
            maxAlert = Math.max(maxAlert, this.world.night.alert, ev === 'chase' ? 0.9 : 0);
            if (ev === 'caught') this._shadowHit('A Noite soprou a chama.');
        }
        this.world.fox?.update(dt, this.player, this.world.heightAt, this.world.goal && this.world.readyToExit() ? TMP.set(this.world.goal.x, this.player.y + 0.5, this.world.goal.z) : null);
        this.hud.setStealth(this.world.shadows.length || this.world.night ? maxAlert : 0);
    }

    _shadowHit(reason) {
        this.caught += 1;
        this.audio.hit();
        this.hud.flashHit();
        if (this.player.hurt(1)) {
            this.hud.setHearts(this.player.health, this.player.maxHealth);
            this.player.addFuel(-18);
            this.hud.say('A sombra tocou você. A chama tremeu.', 2.6);
            if (!this.player.alive) this._defeat(reason || 'A noite engoliu a última chama.');
        }
    }

    /** Colhe vaga-lumes (+16 de chama). Colhido volta a brilhar 45 s depois: a chama nunca morre de fome. */
    _pickupFireflies() {
        for (const f of this.world.fireflies) {
            if (f.done) {
                if (this.elapsed - (f.takenAt ?? -1e9) > PLAYER.fireflyRespawn) f.done = false;
                continue;
            }
            const d = Math.hypot(this.player.x - f.x, this.player.z - f.z);
            if (d > 1.15) continue;
            f.collect();
            f.takenAt = this.elapsed;
            this.player.addFuel(PLAYER.fireflyHeal);
            this.score += 12;
            this.audio.pickup();
        }
    }

    _updateInteract() {
        // 0,6 s depois de fechar um diálogo o E é ignorado (criança aperta E repetido)
        if (performance.now() - (this.dialogClosedAt ?? -1e4) < 600) this.input.consumeInteract();
        const near = nearestInteractable(this.player, this.world.interactables);
        let label = near ? near.label : '';
        if (near?.kind === 'goal' && !this.world.readyToExit()) {
            label = this.chapter.hint;
        }
        this.hud.setPrompt(label);
        if (!this.input.consumeInteract() || !near) return;

        if (near.kind === 'talk') {
            this._openDialogue(near.speaker || 'Alguém', near.lines, near);
            return;
        }
        if (near.kind === 'lamp') {
            this._lightLamp(near);
            return;
        }
        if (near.kind === 'memory') {
            near.collect();
            this.memories += 1;
            this.score += 90;
            this.audio.pickup();
            this.hud.setMemories(this.memories, CHAPTERS.length);
            if (near.id === 'carta') this.hud.say(STORY.carta, 6);
            else this.hud.say('Uma lembrança da Nara cabe no bolso.', 3);
            return;
        }
        if (near.kind === 'cage') {
            // E perto das sarças também solta a raposa (o pulso da lanterna continua valendo)
            this.audio.flash();
            this._freeFox(near);
            return;
        }
        if (near.kind === 'crystal') {
            this._tryCrystal(near);
            return;
        }
        if (near.kind === 'place') {
            near.done = true;
            this.world.progress.placed = true;
            this.audio.dawn();
            this._placeLantern();
            this.world.showNara();
            this._openDialogue('Nara', STORY.nara, { kind: 'nara-end' });
            return;
        }
        if (near.kind === 'goal') {
            if (!this.world.readyToExit()) {
                this.hud.say(this.chapter.hint, 3);
                return;
            }
            near.done = true;
            this.audio.chime();
            this.score += 120;
            this._completeChapter();
        }
    }

    _tryCrystal(it) {
        const next = ROOT_ORDER[this.world.progress.crystals.length];
        if (it.index !== next) {
            this.world.resetCrystals();
            this.audio.wrong();
            this.hud.say('A canção errou. Começa de novo: ouro, azul, rosa, verde.', 4);
            return;
        }
        this.world.lightCrystal(it);
        this.world.progress.crystals.push(it.index);
        this._markRespawn();
        this.audio.lamp();
        const n = this.world.progress.crystals.length;
        this.hud.say(`A raiz ${ROOT_NAMES[it.index]} acendeu (${n}/4).`, 2.4);
        if (n === 4) {
            this.score += 150;
            this.hud.say('O oco da árvore se abre. A Noite recua.', 4);
            if (this.world.night) {
                this.world.night.orbit = 16;
                this.world.night.stun = 8;
            }
        }
    }

    _refreshObjective() {
        const w = this.world;
        const ch = this.chapter;
        if (ch.id === 'aldeia') {
            const lamps = w.lampsLit();
            this.hud.setObjective(
                `${w.progress.talked ? 'Tomás ✓' : 'Fale com Tomás'}  ·  lampiões ${lamps}/4  ·  ${this.memories ? 'carta ✓' : 'carta na casa'}`
            );
        } else if (ch.id === 'trilha') {
            this.hud.setObjective(`Lanternas ${w.lampsLit()}/5  ·  chegue ao moinho`);
        } else if (ch.id === 'rio') {
            this.hud.setObjective(
                `Bóias ${w.lampsLit()}/3  ·  ${w.progress.foxFreed ? 'Pingo ✓' : 'liberte Pingo'}  ·  atravesse`
            );
        } else if (ch.id === 'arvore') {
            this.hud.setObjective(`Raízes ${w.progress.crystals.length}/4  ·  ouro, azul, rosa, verde`);
        } else {
            this.hud.setObjective(w.progress.placed ? 'O dia volta.' : 'Coloque a lanterna na pedra.');
        }
    }

    _checkDark(dt) {
        if (!this.chapter.dark) return;
        if (this.player.fuel > 4 || this.player.nearLit) {
            this.darkHurtT = 0;
            return;
        }
        this.darkHurtT += dt;
        if (this.darkHurtT > 5) {
            this.darkHurtT = 0;
            this._shadowHit('A chama apagou. A noite ficou grande demais.');
        }
    }

    /** Pousa a lanterna na Pedra da Aurora: sai da mão de Clara e vira a luz da pedra. */
    _placeLantern() {
        const lan = this.player.lantern;
        const top = this.world.stoneTop;
        if (lan) {
            this.lanternHome = lan.parent;
            this.lanternLocal = lan.position.clone();
            this.lanternScale = lan.scale.clone();
            this.scene.attach(lan);
            lan.position.set(top.x, top.y, top.z);
            lan.rotation.set(0, 0.6, 0);
        }
        this.player.lanternOn = false;
        this.player.lanternPos.set(top.x, top.y + 0.2, top.z);
        this.world.setStone(1);
    }

    _openDialogue(speaker, lines, item) {
        this.hud.setPrompt('');
        this.guide.hide();
        this.trail.clear();
        this.dialogue = { speaker, lines: [...lines], item };
        this.state = 'dialogue';
        this.hud.setState('dialogue');
        this.input.exitLock();
        this.input.enabled = true;
        this.hud.showDialogue(speaker, lines[0]);
        this.dialogue.lines.shift();
    }

    _advanceDialogue() {
        if (!this.dialogue) return;
        if (this.dialogue.lines.length) {
            this.hud.showDialogue(this.dialogue.speaker, this.dialogue.lines.shift());
            this.audio.chime();
            return;
        }
        const item = this.dialogue.item;
        if (item?.kind === 'talk') {
            item.done = true;
            this.world.progress.talked = true;
            this._markRespawn();
        }
        if (item?.npc) item.npc.mode = 'idle';
        const end = item?.kind === 'nara-end';
        this.dialogue = null;
        this.hud.hideDialogue();
        this.dialogClosedAt = performance.now(); // E apertado várias vezes não reabre a conversa
        if (end) {
            // "Vai. Acende o primeiro sol." — o dia nasce antes da tela de vitória
            this.state = 'dawn';
            this.hud.setState('transition');
            this.input.enabled = false;
            if (this.skipEl) this.skipEl.hidden = false;
            this.dawnT = 0;
            this.hud.setPrompt('');
            this.hud.say('O dia lembrou o caminho.', 5);
            return;
        }
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.consumeInteract();
        this.input.consumeFlash();
        this.hintT = 0;
        if (!this.touch) this.input.requestLock();
    }

    async _completeChapter() {
        if (this.state === 'transition') return;
        this.guide.hide();
        this.trail.clear();
        if (this.skipEl) this.skipEl.hidden = true;
        this.state = 'transition';
        this.hud.setState('transition');
        this.input.enabled = false;
        this.input.exitLock();
        this.score += 200;
        const last = this.chapterIndex === CHAPTERS.length - 1;
        if (!last) {
            this.fadeDir = 1;
            this.hud.say('A trilha continua.', 2.4);
            await wait(1400);
        }

        const next = this.chapterIndex + 1;
        this.settings.unlocked = Math.max(this.settings.unlocked, next);
        this.saveSettings();

        if (next >= CHAPTERS.length) {
            this._victory();
            return;
        }
        await this._loadChapter(next);
        this._beginIntro();
    }

    _defeat(reason) {
        if (this.state === 'defeat') return;
        this.guide.hide();
        this.trail.clear();
        this.state = 'defeat';
        this.hud.setState('defeat');
        this.input.exitLock();
        this.input.enabled = true;
        this.audio.danger();
        this.hud.showDefeat(statsBlock([
            ['Capítulo', this.chapter.title],
            ['Tempo', formatTime(this.elapsed)],
            ['Lembranças', `${this.memories}/${CHAPTERS.length}`]
        ]));
        const p = document.querySelector('#defeatReason');
        if (p) p.textContent = reason;
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        const total = this.score + this.memories * 50 + this.lampsTotal * 10 + Math.max(0, 700 - Math.floor(this.elapsed));
        if (total > this.settings.best) {
            this.settings.best = total;
            this.saveSettings();
        }
        this.hud.showVictory(statsBlock([
            ['Chama', String(total)],
            ['Tempo', formatTime(this.elapsed)],
            ['Lembranças', `${this.memories}/${CHAPTERS.length}`],
            ['Lampiões', String(this.lampsTotal)]
        ]));
        this.hud.setBest(this.settings.best);
    }

    _resize() {
        /* Girar o aparelho ou plugar um teclado troca o ponteiro: o HUD de
           toque acompanha em vez de ficar preso na decisão do carregamento. */
        const touch = detectTouch();
        if (touch === this.touch) return;
        this.touch = touch;
        if (this.state !== 'loading' && this.state !== 'menu') this.hud.setTouchVisible(touch);
    }

    /* ---------- depuração (?debug=1): window.__lab ---------- */
    debugApi() {
        const g = this;
        return {
            game: g,
            /** Começa um capítulo (0–4) pulando a abertura. */
            async goto(i) {
                await g.start(i);
                g.introT = 3.1;
                g.fade = 0;
                g.fadeDir = -1;
                g.fadeEl.style.opacity = '0';
            },
            tp(x, z, yaw) {
                g.player.x = x;
                g.player.z = z;
                g.player.y = g.world.heightAt(x, z);
                if (yaw != null) { g.player.yaw = g.player.facing = yaw; g.player.camYaw = yaw + Math.PI; }
                g.player.sync();
            },
            cam(yaw, pitch, dist) {
                g.player.camYaw = yaw;
                if (pitch != null) g.player.camPitch = pitch;
                if (dist != null) g.player.camDist = dist;
            },
            /** Teleporta para junto do n-ésimo interativo pendente de um tipo ('talk', 'memory', 'goal', 'crystal', 'place', 'cage', 'lamp'). */
            to(kind, n = 0) {
                const it = g.world.interactables.filter((i) => i.kind === kind && !i.done)[n];
                if (!it) return false;
                this.tp(it.x + 0.3, it.z + 0.6);
                return true;
            },
            next() { document.getElementById('dialogueContinue').click(); },
            lightAll() { for (const l of g.world.lamps) g._lightLamp(l); },
            use() { g.input.interactPressed = true; },
            flash() { g.input.flashPressed = true; },
            stats() {
                const s = g.stage.stats();
                return {
                    ...s, state: g.state, chapter: g.chapter.id, x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1),
                    v: +g.player.moveSpeed.toFixed(2), fuel: +g.player.fuel.toFixed(1), hp: g.player.health,
                    goal: g.goalTarget ? `${g.goalTarget.name} @ ${g.goalTarget.x.toFixed(1)},${g.goalTarget.z.toFixed(1)}` : null,
                    glows: g.valley.glows.mesh.geometry.instanceCount, lights: g.quality.lights, lanternShadow: g.player.light.castShadow,
                    forest: g.valley.forest.stats()
                };
            }
        };
    }
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function boot() {
    const game = new Game();
    window.__menina = game;
    if (new URLSearchParams(location.search).has('debug')) window.__lab = game.debugApi();
    game.init().catch((err) => {
        console.error(err);
        game.hud.showError(err?.message || 'Falha ao acender a lanterna.');
    });
}

boot();
