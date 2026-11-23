/**
 * Cúpola 64 — laço principal: renderer HDR, câmera orbital, estrelas e o vitral.
 *
 * Quadro: cena em RGBA16F + MSAA → AO → neblina atmosférica → bloom → DoF/raios →
 * ACES + gradação (pipeline de labs/shared/gfx/post.js). O céu físico alimenta o IBL
 * e a luz do sol; a sombra do sol segue o Nico.
 *
 * Resolução adaptativa: a cada 0,6 s mede o fps; abaixo de 50 reduz o pixel ratio em
 * 10 % (piso de 62 % do teto do tier), acima de 58 devolve 5 % até o teto.
 */

import * as THREE from 'three';
import { createPipeline } from '../../shared/gfx/post.js';
import { configureTextures } from '../../shared/gfx/textures.js';
import { detectSoftwareGL as softwareGL } from '../../shared/gfx/core.js';
import { STORAGE_KEY, QUALITY, QUEST, QUOTES, STAR_META } from './config.js?v=14';
import { detectMobile, pick, formatTime } from './utils.js?v=13';
import { Input } from './input.js?v=3';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js?v=14';
import { World } from './world.js?v=18';
import { Player } from './player.js?v=15';
import { Entities } from './entities.js?v=16';
import { Effects } from './effects.js?v=13';

class Game {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new GameAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.elapsed = 0;
        this.mobile = detectMobile();
        this.settings = this.loadSettings();
        this.bindUi();
        this.boot();
    }

    loadSettings() {
        try {
            return {
                quality: 'auto',
                volume: 70,
                muted: false,
                best: null,
                ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
            };
        } catch {
            return { quality: 'auto', volume: 70, muted: false, best: null };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* ignore */ }
    }

    qualityPreset() {
        // SoftGL/SwiftShader: sempre low, mesmo com preset salvo em "high".
        if (this.software) return QUALITY.low;
        let key = this.settings.quality;
        if (key === 'auto') {
            const cores = navigator.hardwareConcurrency || 8;
            const memory = navigator.deviceMemory || 4;
            if (this.mobile || cores <= 4 || memory <= 4) key = 'low';
            else key = cores >= 8 && Math.min(innerWidth, innerHeight) >= 700 ? 'high' : 'medium';
        }
        return QUALITY[key] || QUALITY.medium;
    }

    bindUi() {
        const h = this.hud.el;
        h.qualitySelect.value = this.settings.quality;
        h.volumeSlider.value = this.settings.volume;
        h.volumeValue.textContent = this.settings.volume;
        this.hud.setBest(this.settings.best);
        this.hud.setSound(!this.settings.muted);

        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start());
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.enterMenu());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.qualitySelect.value;
            this.saveSettings();
            // o tier muda malha do terreno, grama, sombras e pós: reconstruir tudo é mais seguro
            // do que remendar a cena — a ilha recarrega em ~1 s já no novo tier
            if (this.renderer && this.qualityPreset() !== this.quality) location.reload();
        });
        h.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(h.volumeSlider.value);
            h.volumeValue.textContent = this.settings.volume;
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });

        this.input.on('pause', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            jump: document.getElementById('btnJump'),
            crouch: document.getElementById('btnCrouch'),
            camL: document.getElementById('btnCamL'),
            camR: document.getElementById('btnCamR')
        });

        // Enter/Espaço começam (menu) ou recomeçam (fim de jogo/vitória) sem caçar o botão;
        // Enter/Espaço com foco num botão ficam com o próprio botão.
        window.addEventListener('keydown', (e) => {
            if (e.repeat || (e.code !== 'Enter' && e.code !== 'Space')) return;
            if (e.target.closest?.('button, select, input, summary, a')) return;
            if (this.state === 'menu' || this.state === 'over' || this.state === 'win') {
                e.preventDefault();
                this.start();
            } else if (this.state === 'pause') {
                e.preventDefault();
                this.resume();
            }
        });

        if (window.LabRuntime) LabRuntime.debounceResize(() => this.resize());
        else window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });
    }

    async boot() {
        this.hud.setLoading(0.05, 'Preparando a ilha…');
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: false, // o AA vem do MSAA do alvo HDR
                powerPreference: 'high-performance',
                alpha: false,
                stencil: false
            });
        } catch (err) {
            this.hud.fail(err?.message || 'WebGL indisponível neste navegador.');
            return;
        }

        this.software = softwareGL(this.renderer);
        this.quality = this.qualityPreset();
        // iPhone DPR 3 + pós: começa no máximo 1,5 em ponteiro grosso.
        const touchCap = this.mobile || matchMedia('(pointer: coarse)').matches ? 1.5 : this.quality.pr;
        this.maxPr = Math.min(window.devicePixelRatio || 1, this.quality.pr, touchCap);
        this.pr = this.maxPr;
        this.renderer.setPixelRatio(this.pr);
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            if (this.state === 'play') this.pause();
        });
        this.canvas.addEventListener('webglcontextrestored', () => {
            this.pr = this.maxPr;
            this.renderer.setPixelRatio(this.pr);
            this.resize?.();
        });
        this.renderer.shadowMap.enabled = !!this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.info.autoReset = false;
        configureTextures(this.renderer);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(56, 1, 0.15, this.quality.far);
        this._last = performance.now();
        this.focus = new THREE.Vector3(0, 2, 14);
        this.worldTime = 0;

        try {
            this.world = new World(this.scene, this.renderer, this.quality);
            await this.world.build((p, text) => this.hud.setLoading(p, text));

            this.post = createPipeline(this.renderer, { tier: this.quality.id, sky: this.world.sky, software: this.software });
            Object.assign(this.post.params, {
                exposure: 1.0, bloom: 0.1, ao: 0.9, aoRadius: 0.9,
                // neblina rasteira leve + bruma de distância: o horizonte do mar dissolve no céu
                fogDensity: 0.0035, fogFalloff: 0.07, fogBase: 0, haze: 0.0011, fogSunGlow: 0.5,
                rays: 0.4, saturation: 1.14, contrast: 1.05, vignette: 0.2, grain: 0.008
            });

            this.hud.setLoading(0.84, 'Chamando Nico…');
            await new Promise((r) => setTimeout(r, 0));
            this.player = new Player(this.scene);
            this.effects = new Effects(this.scene, this.camera);
            this.entities = new Entities(this.scene, this.world);
            window.__cupola = this;

            this.hud.setLoading(0.92, 'Afinando o vitral…');
            this.resize();
            this.menuCamera(0);
            this.world.update(0.016, 0, this.camera, this.focus);
            try {
                await this.renderer.compileAsync(this.scene, this.camera);
            } catch { /* compila sob demanda */ }
            this.render(0.016);
        } catch (err) {
            console.error(err);
            this.hud.fail(err?.message || 'Não foi possível montar a ilha.');
            return;
        }
        this.hud.setLoading(1, 'Pronto');
        setTimeout(() => {
            this.hud.hideLoading();
            this.enterMenu();
            this.loop();
        }, 200);
    }

    /** Fora da partida a câmera sobrevoa a ilha em órbita lenta, de olho no castelo. */
    menuCamera(t) {
        const a = 3.4 + t * 0.05;
        const r = 30 + Math.sin(t * 0.07) * 4;
        this.camera.position.set(Math.sin(a) * r, 9.5 + Math.sin(t * 0.11) * 2.5, 16 + Math.cos(a) * r);
        this.camera.lookAt(0, 6.5, 20);
        this.focus.set(0, 2, 18);
    }

    enterMenu() {
        this.state = 'menu';
        this.audio.setMode('menu');
        this.hud.showMenu();
        this.hud.setTouchVisible(false);
        document.body.dataset.state = 'menu';
    }

    start() {
        if (this.state === 'boot' || !this.player || !this.world) return;
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMode('play');
        this.elapsed = 0;
        this.player.lives = QUEST.lives;
        this.player.spawn(this.world);
        this.entities.reset();
        this.state = 'play';
        this.post.params.dofRange = 0;
        this.hud.showPlay();
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        this.hud.setTouchVisible(coarse || this.mobile);
        this.hud.setStats({
            stars: 0,
            coins: 0,
            reds: 0,
            lives: this.player.lives
        });
        this.hud.say('Bem-vindo à Ilha da Cúpola!');
        document.body.dataset.state = 'play';
        this.delta();
    }

    pause() {
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.showPause();
        document.body.dataset.state = 'pause';
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'play';
        this.hud.hidePause();
        this.hud.showPlay();
        this.delta();
        document.body.dataset.state = 'play';
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSound(!this.settings.muted);
        this.saveSettings();
        if (!this.settings.muted) this.audio.init();
    }

    /** Segundos desde a última chamada (zera o relógio ao retomar a partida). */
    delta() {
        const now = performance.now();
        const dt = Math.max(0, (now - this._last) / 1000);
        this._last = now;
        return dt;
    }

    loop = () => {
        const tick = () => {
            const dt = Math.min(0.033, this.delta());
            if (this.state === 'play') {
                this.update(dt);
            } else if (this.world) {
                // menu, pausa e telas finais: o mundo continua vivo em câmera lenta
                const slow = this.state === 'pause' ? 0 : dt;
                this.worldTime += slow;
                if (this.state === 'menu') {
                    this.menuT = (this.menuT || 0) + dt;
                    this.menuCamera(this.menuT);
                }
                this.world.update(slow, this.worldTime, this.camera, this.focus);
                this.effects.update(slow);
            }
            this.render(dt);
            this.measure(dt);
        };
        if (window.LabRuntime) {
            this._raf = LabRuntime.createLoop(() => tick());
            this._raf.start();
        } else {
            const run = () => {
                requestAnimationFrame(run);
                if (!document.hidden) tick();
            };
            requestAnimationFrame(run);
        }
    };

    update(dt) {
        this.elapsed += dt;
        this.worldTime += dt;
        const flags = this.player.update(dt, this.input, this.world, this.camera);
        this.focus.copy(this.player.position);
        this.world.update(dt, this.worldTime, this.camera, this.focus);

        // a poeira e a água recebem a cor do sol do momento
        const sky = this.world.sky;
        this.effects.light.copy(sky.lightColor).multiplyScalar(0.55 + sky.lightIntensity * 0.16);
        this.effects.update(dt);

        if (flags.jumped) this.audio.jump(this.player.jumpCombo || 1);
        if (flags.pounded && this.player.grounded) {
            this.audio.pound();
            this.effects.dust(this.player.position, 1.7);
        }
        if (flags.cannon) this.audio.cannon();
        if (flags.splash) {
            this.audio.splash();
            this.effects.splash(this.player.position, this.world.ocean.mesh.position.y);
        }
        if (flags.landed && !flags.pounded && !this.player.swimming) this.effects.dust(this.player.position, 0.8);
        if (flags.step) this.effects.step(this.player.position, Math.sin(this.player.yaw), Math.cos(this.player.yaw));
        if (flags.fell) this.hud.say('Ops! Nico voltou para o chão firme.');

        const events = this.entities.update(dt, this.player);
        for (const ev of events) {
            if (ev.type === 'coin') {
                this.audio.coin();
                this.effects.sparkle(ev.pos, 9);
            } else if (ev.type === 'red') {
                this.audio.red();
                this.effects.sparkle(ev.pos, 14, [1.0, 0.25, 0.2]);
                this.hud.say(ev.left > 0 ? `${ev.left} vermelhas restantes` : pick(QUOTES.red));
            } else if (ev.type === 'star') {
                this.audio.star();
                this.effects.burst(ev.pos, 26);
                this.player.celebrate();
                // como no clássico: cada estrela devolve as vidas cheias (modo família)
                this.player.lives = Math.max(this.player.lives, QUEST.lives);
                this.hud.showStarGet(ev.meta.title);
                this.hud.say(pick(QUOTES.star), 3200);
                if (this.entities.starCount >= QUEST.stars) {
                    this.win();
                }
            } else if (ev.type === 'stomp') {
                this.audio.stomp();
                this.effects.dust(ev.pos);
            } else if (ev.type === 'king') {
                this.audio.stomp();
                this.effects.burst(ev.pos, 10);
                this.hud.say(ev.hits >= QUEST.kingHits ? 'A bomba-rei caiu!' : pick(QUOTES.king));
            } else if (ev.type === 'kingDown') {
                this.effects.burst(ev.pos, 24);
                this.hud.say('A estrela do rei apareceu!');
            } else if (ev.type === 'hurt') {
                if (this.player.hurt()) {
                    // empurrão para longe de quem bateu (sem ele, a bomba-rei acertava de novo
                    // assim que a invulnerabilidade acabava)
                    const p = this.player;
                    const ax = p.x - ev.pos.x;
                    const az = p.z - ev.pos.z;
                    const al = Math.hypot(ax, az) || 1;
                    p.vx = (ax / al) * 7;
                    p.vz = (az / al) * 7;
                    this.audio.hurt();
                    this.effects.dust(this.player.position);
                    this.hud.say(pick(QUOTES.hurt));
                    if (!this.player.alive) this.lose();
                }
            }
        }

        // cintilação em volta das estrelas visíveis (até 60 m do Nico)
        this._twinkle = (this._twinkle || 0) - dt;
        if (this._twinkle <= 0) {
            this._twinkle = 0.09;
            for (const s of this.entities.stars) {
                if (!s.taken && s.mesh.visible && s.mesh.position.distanceToSquared(this.player.position) < 3600) {
                    this.effects.twinkle(s.mesh.position);
                }
            }
        }

        this.hud.setStats({
            stars: this.entities.starCount,
            coins: this.entities.coinCount,
            reds: this.entities.redCount,
            lives: this.player.lives
        });
        this.guide();
        this.effects.applyShake();
    }

    /**
     * Bússola (modo família): escolhe o alvo mais próximo entre as estrelas visíveis;
     * sem nenhuma visível, aponta para o que destrava a próxima (moeda vermelha, bomba-rei,
     * moeda dourada). A estrela do céu aponta para o canhão enquanto Nico está embaixo.
     *   ângulo na tela = atan2(d·direita, d·frente),  frente = (−sin yaw, −cos yaw), direita = (cos yaw, −sin yaw)
     */
    guide() {
        const p = this.player;
        const E = this.entities;
        if (E.starCount >= QUEST.stars) return;
        let tx = 0;
        let tz = 0;
        let best = Infinity;
        let title = '';
        let hint = '';
        const consider = (x, z, t, h) => {
            const d = Math.hypot(x - p.x, z - p.z);
            if (d < best) {
                best = d;
                tx = x;
                tz = z;
                title = t;
                hint = h;
            }
        };
        for (const s of E.stars) {
            if (s.taken || !s.mesh.visible) continue;
            if (s.id === 'sky' && p.y < 12 && !p.inCannon) {
                const c = this.world.cannonPos;
                consider(c.x, c.z, s.meta.title, 'Entre no canhão e aperte pular.');
            } else consider(s.x, s.z, s.meta.title, s.meta.hint);
        }
        if (best === Infinity) {
            if (E.redCount < QUEST.redCoins) {
                for (const c of E.reds) if (!c.taken) consider(c.x, c.z, STAR_META[2].title, `Moedas vermelhas: ${E.redCount}/${QUEST.redCoins}`);
            }
            if (E.king.alive) consider(E.king.x, E.king.z, STAR_META[5].title, `Pule na cabeça dela: ${E.kingHits}/${QUEST.kingHits}`);
            if (best === Infinity && E.coinCount < QUEST.coinStar) {
                for (const c of E.coins) if (!c.taken) consider(c.x, c.z, STAR_META[6].title, `Moedas: ${E.coinCount}/${QUEST.coinStar}`);
            }
        }
        if (best === Infinity) return;
        const dx = tx - p.x;
        const dz = tz - p.z;
        const s = Math.sin(p.camYaw);
        const c = Math.cos(p.camYaw);
        const deg = Math.atan2(c * dx - s * dz, -s * dx - c * dz) * 180 / Math.PI;
        this.hud.setGuide(deg, best, title, hint);
    }

    /** Mede fps e ajusta o pixel ratio (ver cabeçalho). */
    measure(dt) {
        this._acc = (this._acc || 0) + dt;
        this._frames = (this._frames || 0) + 1;
        if (this._acc < 0.6) return;
        this.fps = this._frames / this._acc;
        this._acc = 0;
        this._frames = 0;
        if (this.state !== 'play' || this.software) return;
        let next = this.pr;
        if (this.fps < 50) next = Math.max(this.maxPr * 0.62, this.pr * 0.9);
        else if (this.fps > 58) next = Math.min(this.maxPr, this.pr * 1.05);
        if (Math.abs(next - this.pr) < 0.03) return;
        this.pr = next;
        this.resize();
    }

    win() {
        this.state = 'win';
        this.audio.setMode('star');
        this.audio.win();
        const time = formatTime(this.elapsed);
        if (!this.settings.best || this.elapsed < this._bestSeconds(this.settings.best)) {
            this.settings.best = time;
            this.saveSettings();
            this.hud.setBest(time);
        }
        this.hud.showVictory({
            stars: this.entities.starCount,
            coins: this.entities.coinCount,
            seconds: this.elapsed
        });
        document.body.dataset.state = 'win';
    }

    _bestSeconds(stamp) {
        const [m, s] = String(stamp).split(':').map(Number);
        return (m || 0) * 60 + (s || 0);
    }

    lose() {
        this.state = 'over';
        this.audio.lose();
        this.hud.showOver({
            stars: this.entities.starCount,
            coins: this.entities.coinCount,
            seconds: this.elapsed
        });
        document.body.dataset.state = 'over';
    }

    resize() {
        const w = this.canvas.clientWidth || innerWidth;
        const h = this.canvas.clientHeight || innerHeight;
        this.renderer.setPixelRatio(this.pr);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / Math.max(1, h);
        // retrato estreito: abre o campo de visão para o Nico não sumir atrás do HUD
        this.camera.fov = this.camera.aspect < 0.8 ? 68 : 56;
        this.camera.updateProjectionMatrix();
        this.camera.userData.bufferHeight = h * this.pr;
        this.post?.setSize();
    }

    render(dt = 0.016) {
        this.renderer.info.reset();
        this.post.render(this.scene, this.camera, dt);
    }

    /** Diagnóstico para testes: fps medido e carga de desenho do último quadro. */
    stats() {
        const i = this.renderer.info.render;
        return { fps: Math.round(this.fps || 0), calls: i.calls, triangles: i.triangles, pr: +this.pr.toFixed(2), tier: this.quality.id };
    }
}

// Alça de inspeção para testes no console (não usada pelo jogo).
globalThis.__cupola64 = new Game();
