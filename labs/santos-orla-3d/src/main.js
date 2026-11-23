/**
 * Santos Orla 3D — laço principal.
 * Digital twin procedural navegável: descida aérea → passeio José Menino → Ponta da Praia.
 *
 * Pipeline: cena HDR (MSAA) → AO → neblina atmosférica → bloom → raios de sol → ACES.
 * Resolução adaptativa (qualidade "auto"): mede fps a cada 0,5 s e ajusta o pixel ratio
 *   fps < 42 → −0,1 (mín. 0,6)   ·   fps > 57 → +0,05 (máx. do tier; ≤ 1,5 no celular, ≤ 2 sempre)
 *
 * Objetivo (roteiro): descobrir os 8 marcos da orla. O alvo é o marco não visitado mais
 *   próximo (com histerese de 25 % para não alternar); seta no HUD (gfx/guide), farol de luz
 *   no mundo e toast + sino ao chegar a ≤ DISCOVER_RADIUS m. Progresso salvo no localStorage.
 *
 * Zero travas: loading com timeout (35 s) e erro com "tentar de novo"; perda de contexto
 *   WebGL vira aviso; aba oculta/foco perdido pausam e soltam teclas; pausa tem "voltar ao
 *   Gonzaga" (sai de qualquer enrosco) e "recomeçar roteiro"; a intro pode ser pulada.
 * dt do quadro limitado a 1/20 s (sem saltos de física após travadas).
 */

import * as THREE from 'three';
import { createPipeline } from '../../shared/gfx/post.js';
import { configureTextures } from '../../shared/gfx/textures.js';
import { pickTier, detectSoftwareGL, detectMobile } from '../../shared/gfx/core.js';
import { Guide } from '../../shared/gfx/guide.js';

import { STORAGE_KEY, QUALITY, VIEW_MODES, LANDMARKS, DAY_STOPS, DISCOVER_RADIUS, WALK, groundY } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { OrlaCamera } from './camera.js';
import { Input } from './input.js';
import { OrlaAudio } from './audio.js';
import { UI } from './ui.js';

const MAX_DT = 1 / 20;
const LOAD_TIMEOUT = 35000;
const SPAWN = { x: -100, z: WALK.spawnZ, yaw: Math.PI / 2 };

const coarsePointer = () => matchMedia('(pointer: coarse)').matches;

function withTimeout(promise, ms, message) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
    ]);
}

/** Farol de luz sobre o próximo ponto do roteiro: coluna aditiva + anel pulsante no chão. */
function createBeacon() {
    const group = new THREE.Group();
    group.name = 'beacon';
    const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.15, 0.62, 0.16) } };
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.3, 90, 24, 1, true).translate(0, 45, 0),
        new THREE.ShaderMaterial({
            uniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                varying float vRim;
                void main() {
                    vUv = uv;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vec3 n = normalize(normalMatrix * normal);
                    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                uniform float uTime;
                uniform vec3 uColor;
                varying vec2 vUv;
                varying float vRim;
                void main() {
                    float h = vUv.y;
                    float a = pow(1.0 - h, 2.4) * 0.5 + 0.03;
                    a *= 0.78 + 0.22 * sin(h * 46.0 - uTime * 2.6);
                    a *= 0.55 + 0.45 * (1.0 - vRim);
                    gl_FragColor = vec4(uColor, a);
                }`
        })
    );
    beam.frustumCulled = false;
    const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.6, 0.9, 0.25), transparent: true, opacity: 0.6, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.75, 48).rotateX(-Math.PI / 2), ringMat);
    ring.position.y = 0.06;
    group.add(beam, ring);
    group.visible = false;
    return {
        group,
        update(t) {
            uniforms.uTime.value = t;
            const p = (t * 0.6) % 1;
            ring.scale.setScalar(0.6 + p * 1.6);
            ringMat.opacity = 0.7 * (1 - p);
        }
    };
}

class App {
    constructor() {
        this.ui = new UI();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.visited = new Set((this.settings.visited || []).filter((id) => LANDMARKS.some((l) => l.id === id)));
        this.state = 'loading';
        this.time = 0;
        this.mode = VIEW_MODES[this.settings.mode] ? this.settings.mode : 'tourist';
        this.paused = false;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.input = new Input();
        this.audio = new OrlaAudio();
        this.player = null;
        this.pixelRatio = 1;
        this._landedOnce = false;
        this.target = null;
        this.coachT = -1;
        this.guide = new Guide(document.getElementById('guide'));
        this.ui.setTour(this.visited);
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 65, muted: false, mode: 'tourist', day: 1, visited: [], onboarded: false };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
        } catch {
            return fallback;
        }
    }

    saveSettings() {
        try {
            this.settings.visited = [...this.visited];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* modo privado */ }
    }

    async init() {
        const t0 = performance.now();
        this.timing = {};
        this.ui.setLoading(0.03, 'Preparando a orla…');
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: false, // o AA vem do MSAA do alvo HDR
                powerPreference: 'high-performance',
                alpha: false,
                stencil: false
            });
        } catch {
            this.ui.showError('WebGL indisponível. Ative a aceleração de hardware ou tente outro navegador.');
            return;
        }
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            this.state = 'error';
            this.ui.showError('A placa de vídeo reiniciou a cena (memória ou economia de energia). Toque em tentar de novo.');
        });

        const software = detectSoftwareGL(this.renderer);
        const tier = software ? 'low' : pickTier(this.settings.quality);
        this.quality = QUALITY[tier];
        const deviceCap = detectMobile() || coarsePointer() ? 1.5 : 2;
        this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio, deviceCap);
        this.pixelRatio = this.maxPixelRatio;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.info.autoReset = false;
        configureTextures(this.renderer);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, this.quality.far);

        this.world = new World(this.scene, this.renderer, this.quality);
        this.world.dayIndex = Number.isInteger(this.settings.day) && DAY_STOPS[this.settings.day] ? this.settings.day : 1;
        this.world.hour = DAY_STOPS[this.world.dayIndex].hour;
        await withTimeout(
            this.world.build((p, text) => this.ui.setLoading(p * 0.9, text)),
            LOAD_TIMEOUT,
            'A orla demorou demais para montar neste aparelho. Tente de novo ou escolha a qualidade Performance.'
        );

        this.timing.build = Math.round(performance.now() - t0);
        this.post = createPipeline(this.renderer, { tier, sky: this.world.sky, software });
        Object.assign(this.post.params, {
            bloom: 0.085, ao: 0.9, aoRadius: 1.4, fogFalloff: 0.05, fogBase: 0, rays: 0.5, fogSunGlow: 0.45,
            saturation: 1.08, contrast: 1.06, vignette: 0.26, grain: 0.012
        });

        this.player = new Player(this.scene, this.world.parts.terrain.openings);
        this.player.blockers = this.world.playerSolids();
        this.rig = new OrlaCamera(this.camera);
        this.rig.blockers = this.world.blockers();
        this.rig.update(0.016, this.player, window.innerWidth / window.innerHeight);
        this.beacon = createBeacon();
        this.scene.add(this.beacon.group);
        if (this.world.parts.traffic) {
            this.world.parts.traffic.onHonk = (x, z) => this.audio.honk(Math.hypot(x - this.player.x, z - this.player.z));
        }
        this.dayStop = DAY_STOPS[this.world.dayIndex];
        this.ui.setDay(this.dayStop);

        this.ui.setLoading(0.94, 'Compilando shaders…');
        this.world.update(0, 0.016, this.camera, this.rig.focus, this.quality.shadowRadius, this.player);
        try {
            await withTimeout(this.renderer.compileAsync(this.scene, this.camera), 8000, 'compile');
        } catch { /* compila sob demanda */ }
        this.timing.compiled = Math.round(performance.now() - t0);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // aquece o pós-processamento e as sombras atrás do loading (evita travada no 1º frame)
        this.post.render(this.scene, this.camera, 0.016);

        this.timing.ready = Math.round(performance.now() - t0);
        this.bindUI();
        this.input.bind();
        window.addEventListener('resize', this.onResize);
        this.onResize();

        this.ui.hideLoading();
        this.ui.showMenu(true);
        this.state = 'menu';
        requestAnimationFrame(this.loop);
    }

    hintText() {
        if (this.mode === 'map') return 'Mapa · toque ou clique num ponto para ir até lá';
        if (this.mode === 'cinematic') return 'Voo de drone · T ou Turista para voltar a andar';
        return coarsePointer()
            ? 'Stick para andar · arraste à direita para olhar · Correr e Bike nos botões'
            : 'WASD andar · Shift correr · B bike · arraste o mouse para olhar · roda: zoom';
    }

    applyMode(mode) {
        if (!VIEW_MODES[mode]) return;
        this.mode = mode;
        this.settings.mode = mode;
        this.saveSettings();
        this.ui.setMode(mode);
        if (this.state === 'playing') {
            if (this.rig.phase !== 'intro') this.rig.setMode(mode);
            else this.rig.mode = mode;
            this.ui.setHint(this.hintText());
        }
    }

    cycleDay() {
        this.dayStop = this.world.cycleDay();
        this.settings.day = this.world.dayIndex;
        this.saveSettings();
        this.ui.setDay(this.dayStop);
    }

    toggleBike() {
        if (this.state !== 'playing' || this.paused) return;
        const msg = this.player.toggleBike();
        this.ui.setHint(msg, 3500);
        this.syncBikeUi();
    }

    syncBikeUi() {
        const on = String(!!this.player?.riding);
        document.getElementById('bikeButton')?.setAttribute('aria-pressed', on);
        document.getElementById('bikeTouchButton')?.setAttribute('aria-pressed', on);
    }

    /** Teleporte para um marco (menu "Roteiro", rótulo no mapa) ou para o início. */
    goTo(x, z, yaw) {
        if (this.state === 'menu') this.start({ skipIntro: true });
        this.player.reset(x, z, yaw);
        if (this.player.riding && !this.player.canRide()) {
            this.player.toggleBike();
            this.syncBikeUi();
        }
        this.rig.orbit = 0;
        this.rig.pitch = 0.2;
        if (this.mode === 'map' || this.mode === 'cinematic') this.applyMode('tourist');
        else if (this.rig.phase === 'walk') this.rig._beginBlend();
        this.target = null;
    }

    goToLandmark(id) {
        const lm = LANDMARKS.find((l) => l.id === id);
        if (lm) this.goTo(lm.x, lm.z, lm.face ?? 0);
    }

    bindUI() {
        const $ = (id) => document.getElementById(id);
        $('startButton')?.addEventListener('click', () => this.start());
        $('resumeButton')?.addEventListener('click', () => this.setPaused(false));
        $('pauseMenuButton')?.addEventListener('click', () => {
            this.setPaused(false);
            this.backToMenu();
        });
        $('respawnButton')?.addEventListener('click', () => {
            this.setPaused(false);
            this.goTo(SPAWN.x, SPAWN.z, SPAWN.yaw);
        });
        $('resetTourButton')?.addEventListener('click', () => {
            this.visited.clear();
            this.saveSettings();
            this.ui.setTour(this.visited);
            this.target = null;
            this.ui.toast('Roteiro zerado — 8 pontos para descobrir');
        });
        $('retryButton')?.addEventListener('click', () => location.reload());
        $('pauseButton')?.addEventListener('click', () => this.setPaused(!this.paused));
        $('soundButton')?.addEventListener('click', () => this.toggleMute());
        $('dayButton')?.addEventListener('click', () => this.cycleDay());
        $('bikeButton')?.addEventListener('click', () => this.toggleBike());
        $('bikeTouchButton')?.addEventListener('click', () => this.toggleBike());
        $('runButton')?.addEventListener('click', (e) => {
            this.input.runToggle = !this.input.runToggle;
            e.currentTarget.setAttribute('aria-pressed', String(this.input.runToggle));
        });
        $('skipIntroButton')?.addEventListener('click', () => this.rig.skipIntro());
        $('coachButton')?.addEventListener('click', () => this.dismissCoach());

        $('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            // o tier define geometria e alvos de render: recarrega para aplicar
            location.reload();
        });
        $('volumeSlider')?.addEventListener('input', (e) => {
            this.settings.volume = Number(e.target.value);
            this.audio.setVolume(this.settings.volume / 100);
            const label = $('volumeValue');
            if (label) label.textContent = String(this.settings.volume);
            this.saveSettings();
        });

        // Delegação no shell — chips do menu e do HUD
        document.querySelector('.game-shell')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-mode]');
            if (!btn || !btn.classList.contains('chip')) return;
            e.preventDefault();
            this.applyMode(btn.dataset.mode);
        });

        const touch = $('touchControls');
        if (touch) {
            const coarse = coarsePointer();
            touch.hidden = !coarse;
            touch.style.display = coarse ? '' : 'none';
            document.documentElement.classList.toggle('is-touch', coarse);
        }

        $('landmarkList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-goto]');
            if (btn) this.goToLandmark(btn.dataset.goto);
        });
        // rótulos do mapa: toque/clique leva até o ponto
        $('worldLabels')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-id]');
            if (btn && this.mode === 'map' && this.state === 'playing' && !this.paused) this.goToLandmark(btn.dataset.id);
        });

        // Stick virtual
        const stick = $('moveStick');
        const knob = $('moveKnob');
        if (stick) {
            let pid = null;
            const move = (ev) => {
                const rect = stick.getBoundingClientRect();
                let dx = (ev.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.45);
                let dy = (ev.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.45);
                const mag = Math.hypot(dx, dy);
                if (mag > 1) { dx /= mag; dy /= mag; }
                this.input.setTouchMove(dx, dy);
                if (knob) knob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
                ev.preventDefault();
            };
            const end = (e) => {
                if (pid !== null && e && e.pointerId !== pid) return;
                pid = null;
                this.input.setTouchMove(0, 0);
                if (knob) knob.style.transform = 'translate(0,0)';
            };
            stick.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                pid = e.pointerId;
                try { stick.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto */ }
                move(e);
            }, { passive: false });
            stick.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); }, { passive: false });
            stick.addEventListener('pointerup', end);
            stick.addEventListener('pointercancel', end);
            stick.addEventListener('lostpointercapture', end);
        }

        // Olhar: arrasto no pad (toque) ou direto no canvas (mouse)
        const bindLook = (el) => {
            if (!el) return;
            let active = null;
            let lx = 0;
            let ly = 0;
            el.addEventListener('pointerdown', (e) => {
                if (this.rig?.phase === 'intro' && el === this.canvas) {
                    this.rig.skipIntro();
                    return;
                }
                e.preventDefault();
                active = e.pointerId;
                lx = e.clientX;
                ly = e.clientY;
                try { el.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto */ }
            }, { passive: false });
            el.addEventListener('pointermove', (e) => {
                if (active !== e.pointerId || this.state !== 'playing' || this.paused) return;
                const dx = e.clientX - lx;
                const dy = e.clientY - ly;
                lx = e.clientX;
                ly = e.clientY;
                if (this.rig.phase !== 'walk') return;
                // arrasto horizontal vira o visitante (na bike, gira só a câmera); vertical inclina
                if (this.player.riding) this.rig.drag(dx, 0);
                else this.player.yaw -= dx * 0.0052;
                this.rig.drag(0, dy);
            });
            const stop = (e) => { if (!e || e.pointerId === active) active = null; };
            el.addEventListener('pointerup', stop);
            el.addEventListener('pointercancel', stop);
            el.addEventListener('lostpointercapture', stop);
        };
        bindLook($('lookPad'));
        bindLook(this.canvas);
        this.canvas.addEventListener('wheel', (e) => {
            if (this.state !== 'playing' || this.rig.phase !== 'walk') return;
            e.preventDefault();
            this.rig.zoomBy(e.deltaY > 0 ? 1.08 : 1 / 1.08);
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.repeat) return;
            if (this.state !== 'playing') {
                if (e.code === 'KeyM') this.toggleMute();
                return;
            }
            if (this.rig.phase === 'intro' && (e.code === 'Space' || e.code === 'Enter')) {
                e.preventDefault();
                this.rig.skipIntro();
                return;
            }
            if (e.code === 'KeyP' || e.code === 'Escape') this.setPaused(!this.paused);
            if (e.code === 'KeyM') this.toggleMute();
            if (this.paused) return;
            if (e.code === 'KeyT') {
                const ids = Object.keys(VIEW_MODES);
                this.applyMode(ids[(ids.indexOf(this.mode) + 1) % ids.length]);
            }
            if (e.code === 'KeyL') this.cycleDay();
            if (e.code === 'KeyB') this.toggleBike();
            if (e.code === 'Enter' && !this.ui.els.coach?.hidden) this.dismissCoach();
        });

        // aba oculta / janela sem foco: pausa (e o Input já soltou as teclas)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === 'playing') this.setPaused(true);
                this.audio.suspend();
            } else if (!this.paused) this.audio.resume();
        });
        window.addEventListener('blur', () => {
            if (this.state === 'playing' && this.rig.phase === 'walk') this.setPaused(true);
        });

        const qs = $('qualitySelect');
        if (qs) qs.value = this.settings.quality;
        const vs = $('volumeSlider');
        if (vs) vs.value = String(this.settings.volume);
        const vv = $('volumeValue');
        if (vv) vv.textContent = String(this.settings.volume);
        this.ui.setMode(this.mode);
        this.updateMuteUi();
    }

    start({ skipIntro = false } = {}) {
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);

        this.ui.showMenu(false);
        this.ui.showHud(true);
        this.state = 'playing';
        this.paused = false;
        this.input.clear();
        this.rig.mode = this.mode;
        if (skipIntro) {
            this.rig.setMode(this.mode);
            this._landedOnce = true;
            this.onLanded();
        } else {
            this.rig.startIntro();
            this._landedOnce = false;
        }
        this.ui.setMode(this.mode);
        this.ui.setHint(this.hintText());
        this.syncBikeUi();
    }

    /** Primeira chegada ao chão: onboarding curto (uma vez por aparelho). */
    onLanded() {
        if (!this.settings.onboarded && this.coachT < 0) {
            this.coachT = 0;
            this.coachStart = this.player.travelled;
            this.ui.showCoach(true);
        }
    }

    dismissCoach() {
        if (this.coachT < 0) return;
        this.coachT = -1;
        this.ui.showCoach(false);
        this.settings.onboarded = true;
        this.saveSettings();
        this.canvas.focus?.({ preventScroll: true });
    }

    backToMenu() {
        this.state = 'menu';
        this.rig.phase = 'menu';
        this.input.clear();
        if (this.coachT >= 0) this.dismissCoach();
        this.guide.hide();
        this.beacon.group.visible = false;
        this.ui.showHud(false);
        this.ui.showMenu(true);
        this.ui.setStartLabel(this.visited.size ? 'Sobrevoar e continuar' : 'Sobrevoar a orla');
    }

    setPaused(p) {
        if (p && this.state !== 'playing') return;
        this.paused = p;
        this.input.clear();
        this.ui.showPause(p);
        if (p) this.audio.suspend();
        else this.audio.resume();
        const btn = document.getElementById('pauseButton');
        btn?.setAttribute('aria-label', p ? 'Continuar' : 'Pausar');
    }

    updateMuteUi() {
        const btn = document.getElementById('soundButton');
        if (!btn) return;
        btn.setAttribute('aria-pressed', this.settings.muted ? 'false' : 'true');
        btn.setAttribute('aria-label', this.settings.muted ? 'Ligar som' : 'Desligar som');
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.updateMuteUi();
    }

    onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(w, h, false);
        this.post?.setSize();
    };

    adaptResolution(fps) {
        if (this.settings.quality !== 'auto') return;
        let next = this.pixelRatio;
        if (fps < 42) next = Math.max(0.6, next - 0.1);
        else if (fps > 57) next = Math.min(this.maxPixelRatio, next + 0.05);
        if (Math.abs(next - this.pixelRatio) < 0.04) return;
        this.pixelRatio = next;
        // aplica no início do próximo quadro: redimensionar depois do render limpa o canvas
        // e o navegador mostraria um quadro preto
        this._pendingResize = true;
    }

    /** Teleporte de depuração: posiciona visitante e câmera sem transição. */
    tp(x, z, yaw = Math.PI / 2, pitch = 0.2) {
        if (this.state === 'menu') this.start({ skipIntro: true });
        this.player.reset(x, z, yaw);
        this.rig.pitch = pitch;
        this.rig.orbit = 0;
        this.rig.snap(this.player);
        for (let i = 0; i < 3; i++) this.frame(0.016);
        return `${Math.round(this.fps || 0)} fps · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} tris · pr ${this.pixelRatio.toFixed(2)}`;
    }

    /** Custo médio por quadro (ms), independente de rAF: renderiza n vezes e espera a GPU. */
    bench(n = 30) {
        const gl = this.renderer.getContext();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
            this.time += 0.016;
            this.world.update(this.time, 0.016, this.camera, this.rig.focus, this.quality.shadowRadius, this.player);
            this.renderer.info.reset();
            this.post.render(this.scene, this.camera, 0.016);
        }
        gl.finish();
        const ms = (performance.now() - t0) / n;
        return `${ms.toFixed(2)} ms/quadro (${Math.round(1000 / ms)} fps) · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} tris · pr ${this.pixelRatio.toFixed(2)} · ${this.quality.id}`;
    }

    /** Marco mais próximo do visitante (sem alocar). */
    nearestLandmark() {
        let best = null;
        let dist = Infinity;
        for (const lm of LANDMARKS) {
            const d = Math.hypot(lm.x - this.player.x, lm.z - this.player.z);
            if (d < dist) {
                dist = d;
                best = lm;
            }
        }
        this._nearDist = dist;
        return best;
    }

    /** Roteiro: descobre marcos por proximidade e escolhe o próximo alvo. */
    updateTour() {
        const px = this.player.x;
        const pz = this.player.z;
        let best = null;
        let bestD = Infinity;
        for (const lm of LANDMARKS) {
            const d = Math.hypot(lm.x - px, lm.z - pz);
            if (!this.visited.has(lm.id) && d <= DISCOVER_RADIUS) this.discover(lm);
            if (this.visited.has(lm.id)) continue;
            if (d < bestD) { bestD = d; best = lm; }
        }
        // histerese: só troca de alvo se o novo estiver 25 % mais perto
        if (this.target && !this.visited.has(this.target.id) && best && best !== this.target) {
            const cur = Math.hypot(this.target.x - px, this.target.z - pz);
            if (bestD > cur * 0.75) best = this.target;
        }
        this.target = best;
    }

    discover(lm) {
        this.visited.add(lm.id);
        this.saveSettings();
        this.ui.setTour(this.visited);
        const n = this.visited.size;
        const total = LANDMARKS.length;
        if (n >= total) {
            this.ui.toast(`Roteiro completo! Os ${total} pontos da orla de Santos. Explore à vontade.`, 6000);
            this.audio.chime(true);
        } else {
            this.ui.toast(`Descoberto · ${lm.name} (${n}/${total})`, 4200);
            this.audio.chime(false);
        }
        // vibração curta só em toque e após gesto (evita aviso do navegador)
        if (coarsePointer() && navigator.userActivation?.hasBeenActive) {
            try { navigator.vibrate?.(30); } catch { /* sem vibração */ }
        }
    }

    loop = (now) => {
        requestAnimationFrame(this.loop);
        if (document.hidden || this.state === 'error') {
            this._last = now;
            return;
        }
        const dt = Math.min(MAX_DT, Math.max(0, (now - (this._last || now)) / 1000));
        this._last = now;
        if (this.state === 'loading') return;
        try {
            this.frame(dt);
        } catch (err) {
            // um quadro ruim não derruba o lab: registra uma vez e segue
            if (!this._frameErr) console.error(err);
            this._frameErr = true;
        }
    };

    /** Um passo de simulação + render. */
    frame(dt) {
        if (this._pendingResize) {
            this._pendingResize = false;
            this.onResize();
        }
        const frozen = this.state === 'playing' && this.paused;
        const step = frozen ? 0 : dt;
        this.time += step;

        const aspect = this.camera.aspect;
        let cam = { introProgress: 0, landed: false };
        if (this.state === 'menu') {
            this.rig.phase = 'menu';
            this.player.update(step, this.input, true);
            cam = this.rig.update(step, this.player, aspect);
            this.ui.syncLabels(this.camera, LANDMARKS, false);
        } else if (!frozen) {
            const input = this.input.poll();
            const locked = this.rig.phase !== 'walk';
            this.player.update(step, input, locked);
            if (!locked) this.rig.drag(0, -input.lookY * 260 * step);
            cam = this.rig.update(step, this.player, aspect);
            this.ui.setIntro(cam.introProgress, cam.landed);
            if (cam.landed && !this._landedOnce) {
                this._landedOnce = true;
                this.rig.setMode(this.mode);
                this.onLanded();
            }
            const near = this.nearestLandmark();
            this.ui.updatePlace(this.player.x, near, this._nearDist);
            this.ui.syncLabels(this.camera, LANDMARKS, this.ui.showLabels && cam.landed, this.rig.phase === 'walk' ? 240 : Infinity);
            if (cam.landed) this.updateTour();
            if (this.coachT >= 0) {
                this.coachT += step;
                if (this.coachT > 16 || this.player.travelled - this.coachStart > 25) this.dismissCoach();
            }
        }

        // objetivo: seta + farol
        const showGuide = this.state === 'playing' && cam.landed && this.rig.phase === 'walk' && this.target;
        if (showGuide) {
            const t = this.target;
            this.guide.update(this.camera, this.player.x, this.player.z, { x: t.x, z: t.z, name: t.name, near: DISCOVER_RADIUS * 0.6 });
        } else this.guide.hide();
        const beaconOn = this.state === 'playing' && cam.landed && this.target && (this.rig.phase === 'walk' || this.rig.phase === 'map');
        this.beacon.group.visible = !!beaconOn;
        if (beaconOn) {
            this.beacon.group.position.set(this.target.x, groundY(this.target.x, this.target.z), this.target.z);
            this.beacon.update(this.time);
        }

        // HUD lento (4×/s): velocidade e áudio
        this.hudAccum += dt;
        if (this.hudAccum > 0.25 && this.state === 'playing') {
            this.hudAccum = 0;
            this.ui.setSpeed(this.player.gait, this.player.speed);
            if (!frozen) this.audio.update(this.player.z, this.player.speed, this.world.sky.night > 0.5);
        }

        // sombra: raio cresce com a altura da câmera (mapa/drone enxergam longe)
        const camH = this.camera.position.y - groundY(this.camera.position.x, this.camera.position.z);
        const radius = Math.min(420, Math.max(this.quality.shadowRadius, camH * 1.25));
        this.world.update(this.time, step, this.camera, this.rig.focus, radius, this.player);

        const p = this.post.params;
        const env = this.world.env;
        p.exposure = env.exposure;
        p.fogDensity = env.fog;
        p.haze = env.haze;
        const drone = this.rig.phase === 'cinematic' || this.rig.phase === 'menu';
        p.dofRange = drone ? Math.max(30, this.rig.focusDist * 0.9) : 0;
        p.dofFocus = this.rig.focusDist;
        p.dofMax = 0.55;

        this.renderer.info.reset();
        this.post.render(this.scene, this.camera, dt);

        this.fpsAccum += dt;
        this.fpsFrames++;
        if (this.fpsAccum >= 0.5) {
            const fps = this.fpsFrames / this.fpsAccum;
            this.fps = fps;
            this.ui.setFps(Math.round(fps));
            if (this.state === 'playing' && !frozen) this.adaptResolution(fps);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }
}

const app = new App();
// gancho de depuração/teste (sem efeito para o visitante)
window.__orla = app;
app.init().catch((err) => {
    console.error(err);
    app.state = 'error';
    app.ui.showError(err?.message || 'Falha ao iniciar o laboratório.');
});
