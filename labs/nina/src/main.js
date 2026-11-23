/**
 * Nina — laço principal: palco, pulo, amoras, fila de filhotes e a festa.
 *
 * Palco: gfx/stage (céu físico, sol com sombra, pós-processamento) no preset
 * 'dia-claro' às 8h40 — manhã de depois da chuva, sombras compridas, raios de
 * sol e arco-íris. A sombra do sol é centrada em Nina (raio 30 m) para ficar
 * nítida na grama.
 *
 * Profundidade de campo (tiers médio/alto): foco na distância câmera → Nina,
 * faixa nítida de 16 m; desfoca só o fundo distante e o capim colado na lente.
 *
 * Objetivo sempre visível: contador de filhotes + amoras no HUD, bússola (seta que
 * gira relativa à câmera + distância) e um marcador dourado 3D sobre o próximo alvo.
 * Próximo alvo (ver pickTarget):
 *   com fila: filhote perdido a < 8 m e amora na mão → ele; senão → ninho
 *   sem fila: sem amora → amora mais próxima; com amora → filhote perdido mais próximo
 *
 * Estados: boot → menu → play ⇄ pause → (vitória) → play/menu. Janela sem foco ou aba
 * oculta pausa e solta as teclas; nada de morte nem tempo-limite (público infantil).
 */

import * as THREE from 'three';
import { createStage } from '../../shared/gfx/stage.js?v=18';
import { pickTier } from '../../shared/gfx/core.js';
import { Valley } from './world.js?v=23';
import { Player } from './player.js?v=23';
import { Effects } from './effects.js?v=23';
import { Input } from './input.js?v=24';
import { Hud } from './hud.js?v=23';
import { NinaAudio } from './audio.js?v=23';
import { updateFriend } from './animals.js?v=23';
import {
    TOTAL_FRIENDS, BEFRIEND_R, HOME_R, BERRY_R, HOME
} from './config.js?v=23';

/** Filhote perdido a menos disto (m) desvia a bússola do ninho quando há amora na mão. */
const DETOUR_R = 8;
/** Marcador 3D some quando o alvo está a menos disto (m) — já dá para ver. */
const BEACON_NEAR = 2.4;

const STORAGE = 'nina-settings';
const DEBUG = new URLSearchParams(location.search).has('debug');
/** Fração das lâminas de grama por tier quando a qualidade muda com o jogo aberto. */
const GRASS_K = { low: 0.45, medium: 0.75, high: 1 };
/**
 * Modo família: encostar (AUTO_R m) num filhote com amora já faz amizade, e chegar ao ninho
 * (HOME_R) com a fila deixa todos lá — Espaço continua valendo, mas não é obrigatório.
 */
const AUTO_R = 1.7;

class Nina {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new NinaAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.playTime = 0;
        this.won = false;
        this.party = 0;
        this.settings = this.loadSettings();
        this.tramplers = Array.from({ length: 8 }, () => ({ x: 0, y: -999, z: 0, radius: 0 }));
        this.focus = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.guideDir = new THREE.Vector3();
        this.friendCtx = {
            valley: null, nina: null, ninaHead: null, ninaYaw: 0, ninaPitch: 0, ninaSpeed: 0,
            back: null, backV: new THREE.Vector3(), trail: null, index: 0, t: 0, party: false
        };
        this.prevBack = new THREE.Vector3();
        this.chain = [];
        this.walkers = [];
        this.target = { kind: '', ref: null, x: 0, y: 0, z: 0, dist: 0 };
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
                ...JSON.parse(localStorage.getItem(STORAGE) || '{}')
            };
        } catch {
            return { quality: 'auto', volume: 70, muted: false, best: null };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE, JSON.stringify(this.settings));
        } catch { /* modo privado: segue sem salvar */ }
    }

    bindUi() {
        const h = this.hud.el;
        h.qualitySelect.value = this.settings.quality;
        h.volumeSlider.value = this.settings.volume;
        h.volumeValue.textContent = this.settings.volume;
        this.hud.setBest(this.settings.best);
        this.hud.setSound(!this.settings.muted);

        // o vale monta de forma assíncrona: ignora o clique enquanto ainda está em 'boot'
        document.getElementById('startButton').addEventListener('click', () => {
            if (this.state !== 'boot') this.start();
        });
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('restartButton').addEventListener('click', () => this.start());
        document.getElementById('replayButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.qualitySelect.value;
            this.saveSettings();
            // palco e grama mudam na hora; relevo e árvores usam o novo nível na próxima visita
            if (this.stage) {
                this.stage.setTier(pickTier(this.settings.quality));
                this.valley?.grass.setDensity(GRASS_K[this.stage.tier] ?? 1);
            }
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
        // janela perdeu o foco: pausa (as teclas já foram soltas pelo Input)
        this.input.on('blur', () => this.pause());

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            jump: document.getElementById('btnJump'),
            run: document.getElementById('btnRun')
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });

        // Enter/Espaço começam no menu e na vitória e retomam a pausa (botão focado cuida de si)
        window.addEventListener('keydown', (e) => {
            if (e.repeat || (e.code !== 'Enter' && e.code !== 'Space')) return;
            if (e.target.closest?.('button, select, input, summary, a')) return;
            if (this.state === 'menu' || this.state === 'victory') {
                e.preventDefault();
                this.start();
            } else if (this.state === 'pause') {
                e.preventDefault();
                this.resume();
            }
        });
    }

    async boot() {
        this.hud.setLoading(0.06, 'Abrindo o vale…');
        // progresso real: texturas, HDR e modelos passam por este LoadingManager
        const manager = new THREE.LoadingManager();
        let phase = 0.1;
        manager.onProgress = (url, loaded, total) => {
            this.hud.setLoading(Math.min(0.92, phase + (loaded / Math.max(total, 1)) * (0.92 - phase)));
        };
        let stage = null;
        try {
            stage = createStage({
                canvas: this.canvas,
                tier: (DEBUG && new URLSearchParams(location.search).get('tier')) || this.settings.quality,
                preset: 'dia-claro',
                time: 8.65,
                fov: 50,
                near: 0.12,
                shadowRadius: 30,
                loadingManager: manager,
                post: {
                    bloom: 0.1, saturation: 1.12, contrast: 1.05, vignette: 0.24, rays: 0.6,
                    gain: new THREE.Color(1.05, 1.0, 0.93), lift: new THREE.Color(0.006, 0.004, 0.0),
                    fogDensity: 0.0022, haze: 0.00022
                }
            });
        } catch (err) {
            this.hud.fail(err?.message || 'Falha ao iniciar o WebGL.');
            return;
        }
        if (!stage) {
            this.hud.fail('Este laboratório precisa de WebGL 2. Tente um navegador atualizado ou reative a aceleração de hardware.');
            return;
        }
        this.stage = stage;
        this.scene = stage.scene;
        this.camera = stage.camera;
        stage.sky.setClouds?.(0.42);
        stage.onTier((tier) => this.valley?.grass.setDensity(GRASS_K[tier] ?? 1));

        try {
            this.hud.setLoading(0.1, 'Plantando o gramado…');
            await this.nextFrame();
            this.valley = new Valley(stage);
            this.friendCtx.valley = this.valley;

            this.hud.setLoading(0.2, 'Chamando Nina…');
            await this.nextFrame();
            this.player = new Player(this.scene, this.camera, stage.tier === 'low' ? 1 : 2);
            this.player.reset(this.valley);
            this.friendCtx.trail = this.player.trailAt;
            this.friendCtx.back = this.player.back;
            this.beacon = this.makeBeacon();
            this.effects = new Effects(this.scene);
            phase = 0.24;

            this.hud.setLoading(0.24, 'Acordando os filhotes…');
            // um asset que não chega não trava o jogo: segue depois de 25 s com o que houver
            await Promise.race([this.valley.ready, new Promise((r) => setTimeout(r, 25000))]);

            this.hud.setLoading(0.94, 'Acendendo o sol…');
            this.menuCamera(0);
            // os impostores das árvores são assados um por quadro dentro de forest.update
            let baked = false;
            this.valley.forest.ready.then(() => { baked = true; });
            for (let i = 0; i < 240 && !baked; i++) {
                this.valley.forest.update(this.camera);
                await this.nextFrame();
            }
            stage.focus = this.focus.set(HOME.x, 0, HOME.z);
            this.step(1 / 60, false);
            await stage.warmup();
            stage.render(1 / 60);
        } catch (err) {
            console.error(err);
            this.hud.fail('O vale não conseguiu carregar. Recarregue a página para tentar de novo.');
            return;
        }

        this.hud.setLoading(1, 'Pronto');
        if (DEBUG) this.exposeDebug();
        setTimeout(() => {
            this.hud.hideLoading();
            this.enterMenu();
            stage.start((dt) => this.frame(dt));
        }, 200);
    }

    nextFrame() {
        return new Promise((r) => requestAnimationFrame(() => r()));
    }

    start() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.playTime = 0;
        this.won = false;
        this.party = 0;
        clearTimeout(this.winTimer);
        this.valley.reset();
        for (const f of this.valley.friends) f.asked = false;
        this.player.reset(this.valley);
        this.effects.clear();
        this.prevBack.copy(this.player.back);
        this.input.clear();
        this.target.kind = '';
        this.syncHud();
        this.hud.setTouchVisible(
            matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
        );
        this.hud.showPlay();
        this.hud.say('Siga a seta dourada ➤ até uma amora 🫐.', 3600);
        this.state = 'play';
        document.body.dataset.state = 'play';
    }

    enterMenu() {
        clearTimeout(this.winTimer);
        this.state = 'menu';
        document.body.dataset.state = 'menu';
        this.party = 0;
        this.hud.showMenu();
    }

    pause() {
        this.input.clear();
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.showPause();
    }

    resume() {
        if (this.state !== 'pause') return;
        this.input.clear();
        this.state = 'play';
        this.hud.hidePause();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSound(!this.settings.muted);
        this.saveSettings();
    }

    /** Seguidores (fila a pé + quem vai de carona), na ordem em que vieram (lista reutilizada). */
    followers() {
        const list = this.chain;
        list.length = 0;
        for (const f of this.valley.friends) if (f.state === 'follow' || f.state === 'ride') list.push(f);
        list.sort((a, b) => a.joined - b.joined);
        return list;
    }

    /** Só a fila a pé (define a posição de cada um na trilha). */
    walking() {
        const list = this.walkers;
        list.length = 0;
        for (const f of this.valley.friends) if (f.state === 'follow') list.push(f);
        list.sort((a, b) => a.joined - b.joined);
        return list;
    }

    homeCount() {
        let n = 0;
        for (const f of this.valley.friends) if (f.state === 'home') n++;
        return n;
    }

    nearestLost() {
        const p = this.player.pos;
        let best = null;
        let bestD = Infinity;
        for (const f of this.valley.friends) {
            if (f.state !== 'lost') continue;
            const d = Math.hypot(p.x - f.mesh.position.x, p.z - f.mesh.position.z);
            if (d < bestD) {
                bestD = d;
                best = f;
            }
        }
        this.nearestLostD = bestD;
        return best;
    }

    syncHud() {
        this.pickTarget();
        this.hud.setStatus({
            home: this.homeCount(),
            berries: this.player.berries,
            following: this.followers().length,
            target: this.target
        });
    }

    collectBerries() {
        const p = this.player.pos;
        for (const b of this.valley.berries) {
            if (b.taken) continue;
            if (Math.hypot(p.x - b.x, p.z - b.z) < BERRY_R && p.y - b.y < 2.2) {
                this.valley.takeBerry(b);
                this.player.berries++;
                this.effects.burst(this.tmp.set(b.x, b.y + 0.7, b.z), 0xd47bff, 14);
                this.audio.berry();
                this.hud.say(`Amora! Você tem ${this.player.berries}.`);
                this.syncHud();
            }
        }
    }

    tryAction() {
        const p = this.player.pos;
        let nearest = null;
        let nearestD = BEFRIEND_R;
        for (const f of this.valley.friends) {
            if (f.state !== 'lost') continue;
            const d = Math.hypot(p.x - f.mesh.position.x, p.z - f.mesh.position.z);
            if (d < nearestD) {
                nearestD = d;
                nearest = f;
            }
        }
        if (nearest) {
            if (this.player.berries < 1) {
                this.hud.say(`${nearest.name} quer uma amora. Pegue uma primeiro!`);
                this.player.requestJump();
                return;
            }
            this.befriend(nearest);
            return;
        }

        const homeDist = Math.hypot(p.x - HOME.x, p.z - HOME.z);
        if (homeDist < HOME_R && this.followers().length) {
            this.dropOff();
            return;
        }

        this.player.requestJump();
    }

    /** Gasta uma amora e o filhote entra na fila. */
    befriend(friend) {
        this.player.berries--;
        // a tartaruga é lenta demais para a fila: vai de carona no dorso (ver animals.js)
        const rides = friend.kind === 'turtle';
        friend.state = rides ? 'ride' : 'follow';
        friend.joined = performance.now();
        friend.hop = rides ? 0 : 1;
        friend.rideV.set(0, 3, 0);
        this.effects.heart(friend.mesh.position, 3);
        this.effects.burst(friend.mesh.position, 0xffe066, 12);
        this.audio.friend();
        this.buzz(18);
        this.hud.say(rides
            ? `${friend.name} é devagarinho… subiu nas suas costas! Leve ao ninho.`
            : `${friend.name} veio com você! Leve ao ninho.`, 3200);
        this.syncHud();
    }

    /** Vibração curta opcional (celulares que suportam). */
    buzz(ms) {
        try { navigator.vibrate?.(ms); } catch { /* sem vibração */ }
    }

    /** Modo família (ver AUTO_R): amizade por contato e entrega automática no ninho. */
    autoAct() {
        const p = this.player.pos;
        for (const f of this.valley.friends) {
            if (f.state !== 'lost') continue;
            const d = Math.hypot(p.x - f.mesh.position.x, p.z - f.mesh.position.z);
            if (d < AUTO_R) {
                if (this.player.berries >= 1) this.befriend(f);
                else if (!f.asked) {
                    f.asked = true;
                    this.hud.say(`${f.name} quer uma amora 🫐. Pegue uma e volte!`);
                }
            } else if (d > 5) f.asked = false;
        }
        if (Math.hypot(p.x - HOME.x, p.z - HOME.z) < HOME_R && this.followers().length) this.dropOff();
    }

    /**
     * Escolhe o próximo alvo (ver regra no topo do arquivo) em this.target, sem alocar.
     * Devolve true se o alvo mudou de identidade (o texto do objetivo precisa mudar).
     */
    pickTarget() {
        const p = this.player.pos;
        const T = this.target;
        const prevRef = T.ref;
        const prevKind = T.kind;
        const lost = this.nearestLost();
        const following = this.followers().length;
        let kind = 'done';
        let ref = null;
        if (following && !(lost && this.player.berries > 0 && this.nearestLostD < DETOUR_R)) {
            kind = 'home';
            T.x = HOME.x; T.z = HOME.z; T.y = this.valley.groundHeight(HOME.x, HOME.z) + 0.6;
        } else if (lost && this.player.berries < 1) {
            let best = Infinity;
            for (const b of this.valley.berries) {
                if (b.taken) continue;
                const d = Math.hypot(b.x - p.x, b.z - p.z);
                if (d < best) { best = d; ref = b; }
            }
            if (ref) {
                kind = 'berry';
                T.x = ref.x; T.z = ref.z; T.y = ref.y + 1.45;
            }
        } else if (lost) {
            kind = 'friend';
            ref = lost;
            T.x = lost.mesh.position.x; T.z = lost.mesh.position.z;
            T.y = lost.mesh.position.y + lost.creature.height;
        }
        T.kind = kind;
        T.ref = ref;
        T.following = following;
        T.dist = kind === 'done' ? 0 : Math.hypot(T.x - p.x, T.z - p.z);
        return kind !== prevKind || ref !== prevRef;
    }

    /**
     * Bússola + marcador 3D. Ângulo na tela = atan2(d·direita, d·frente),
     * direita = (−frente.z, frente.x).
     */
    guide(dt) {
        if (this.pickTarget()) this.syncHud();
        const T = this.target;
        const b = this.beacon;
        if (T.kind === 'done') {
            this.hud.setGuide(0, null);
            b.visible = false;
            return;
        }
        const p = this.player.pos;
        const f = this.camera.getWorldDirection(this.guideDir);
        const fl = Math.hypot(f.x, f.z) || 1;
        const fx = f.x / fl;
        const fz = f.z / fl;
        const dx = T.x - p.x;
        const dz = T.z - p.z;
        this.hud.setGuide(Math.atan2(-fz * dx + fx * dz, fx * dx + fz * dz) * 180 / Math.PI, T.dist);

        // marcador: seta dourada que quica sobre o alvo e cresce com a distância (lê-se de longe)
        b.visible = T.dist > BEACON_NEAR;
        if (b.visible) {
            this.beaconT = (this.beaconT || 0) + dt;
            const s = THREE.MathUtils.clamp(T.dist * 0.05, 0.9, 2.4);
            b.position.set(T.x, T.y + 0.75 * s + Math.abs(Math.sin(this.beaconT * 3.2)) * 0.22 * s, T.z);
            b.rotation.y = this.beaconT * 1.6;
            b.scale.setScalar(s);
        }
    }

    /** Seta dourada (cone invertido + anel) sem luz nem neblina: sempre legível. */
    makeBeacon() {
        const group = new THREE.Group();
        group.name = 'beacon';
        const mat = new THREE.MeshBasicMaterial({ color: 0xffd46a, transparent: true, opacity: 0.92, fog: false, toneMapped: false, depthWrite: false });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), mat);
        cone.rotation.x = Math.PI;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 20), mat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.26;
        group.add(cone, ring);
        group.renderOrder = 5;
        group.visible = false;
        this.scene.add(group);
        return group;
    }

    dropOff() {
        const waiting = this.followers().slice();
        const already = this.homeCount();
        waiting.forEach((f, i) => {
            if (f.state === 'ride') {
                // desce do dorso: cai da altura atual até o chão
                f.fallH = Math.max(0, f.mesh.position.y - this.valley.floorY(f.mesh.position.x, f.mesh.position.z, f.creature.height));
                f.fallV = 0;
            }
            f.state = 'home';
            f.homeSlot = already + i;
            f.seated = false;
            this.effects.heart(f.mesh.position, 1);
        });
        this.effects.burst(this.tmp.set(HOME.x, this.valley.groundHeight(HOME.x, HOME.z) + 0.8, HOME.z), 0xffe066, 18);
        this.audio.home();
        this.buzz(30);
        const n = this.homeCount();
        this.hud.say(n >= TOTAL_FRIENDS ? 'Todos no piquenique!' : `${waiting.length === 1 ? waiting[0].name + ' chegou' : waiting.length + ' filhotes chegaram'} ao ninho.`);
        this.syncHud();
        if (n >= TOTAL_FRIENDS && !this.won) this.win();
    }

    win() {
        this.won = true;
        this.party = 1;
        this.effects.party(this.tmp.set(HOME.x, this.valley.groundHeight(HOME.x, HOME.z) + 1.2, HOME.z));
        this.audio.victory();
        const seconds = this.playTime;
        const stamp = `${Math.floor(seconds)}s`;
        if (!this.settings.best || seconds < parseFloat(this.settings.best)) {
            this.settings.best = stamp;
            this.saveSettings();
            this.hud.setBest(stamp);
        }
        this.winTimer = setTimeout(() => {
            if (!this.won) return;
            this.state = 'victory';
            this.hud.showVictory({
                home: TOTAL_FRIENDS,
                berries: this.player.berries,
                seconds
            });
        }, 1800);
    }

    /** Câmera do menu e da vitória: órbita baixa em volta do ninho. */
    menuCamera(dt, radius = 12.5, height = 2.6, speed = 0.05) {
        this.orbit = (this.orbit ?? 2.2) + dt * speed;
        const cam = this.camera;
        const x = HOME.x + Math.cos(this.orbit) * radius;
        const z = HOME.z + Math.sin(this.orbit) * radius;
        const g = this.valley.groundHeight(x, z);
        cam.position.set(x, Math.max(g + 1.1, this.valley.groundHeight(HOME.x, HOME.z) + height + Math.sin(this.orbit * 0.7) * 0.5), z);
        cam.lookAt(HOME.x, this.valley.groundHeight(HOME.x, HOME.z) + 0.7, HOME.z);
    }

    /** Avança o mundo um passo. `playing` = Nina obedece aos controles. */
    step(dt, playing) {
        const valley = this.valley;
        const player = this.player;
        const ctx = this.friendCtx;
        const look = this.input.sample();

        if (playing) {
            this.playTime += dt;
            const lost = this.nearestLost();
            player.lookAt = lost && this.nearestLostD < 12 ? this.tmp.copy(lost.mesh.position).setY(lost.mesh.position.y + lost.creature.height * 0.7) : null;
            if (this.input.consumeJump()) this.tryAction();
            player.update(dt, this.input, look, valley);
            const ev = player.events;
            if (ev.jumped) this.audio.hop();
            if (ev.landed > 5) this.effects.burst(this.tmp.set(player.pos.x, player.pos.y + 0.1, player.pos.z), 0xcbb48c, Math.min(10, Math.round(ev.landed)));
            if (ev.rescued) this.onRescued();
            this.collectBerries();
            if (this.state === 'play') {
                this.autoAct();
                this.guide(dt);
            }
        } else {
            this.input.consumeJump();
            if (this.beacon) this.beacon.visible = false;
            player.idle(dt, valley);
            if (this.state === 'victory' || this.won) this.menuCamera(dt, 7.5, 2.2, 0.12);
            else this.menuCamera(dt);
        }

        const following = playing || this.won ? this.followers().length : 0;
        const chain = playing || this.won ? this.walking() : this.walkers;
        if (!playing && !this.won) chain.length = 0;
        ctx.nina = playing || this.won ? player.pos : null;
        ctx.ninaHead = player.head;
        ctx.ninaYaw = player.yaw;
        ctx.ninaPitch = player.pitch;
        ctx.ninaSpeed = player.speed;
        // velocidade do dorso (para a mola da carona), sem alocar
        ctx.backV.copy(player.back).sub(this.prevBack).divideScalar(Math.max(dt, 1e-4));
        if (ctx.backV.lengthSq() > 400) ctx.backV.set(0, 0, 0); // teleporte/respawn
        this.prevBack.copy(player.back);
        ctx.t = valley.clock;
        ctx.party = this.party > 0.5;
        const tr = this.tramplers;
        tr[0].x = player.pos.x;
        tr[0].y = player.pos.y;
        tr[0].z = player.pos.z;
        tr[0].radius = player.trample;
        let i = 1;
        for (const friend of valley.friends) {
            ctx.index = Math.max(0, chain.indexOf(friend));
            updateFriend(friend, dt, ctx);
            const t = tr[i++];
            t.x = friend.mesh.position.x;
            t.y = friend.mesh.position.y;
            t.z = friend.mesh.position.z;
            t.radius = friend.trample;
        }

        // foco da sombra e da profundidade de campo
        const cam = this.camera;
        if (playing) this.focus.copy(player.pos);
        else this.focus.set(HOME.x, 0, HOME.z);
        const params = this.stage.pipeline.params;
        params.dofFocus = cam.position.distanceTo(playing ? player.pos : this.tmp.set(HOME.x, cam.position.y, HOME.z));
        params.dofRange = 16;
        params.dofMax = 0.55;

        const pxScale = this.stage.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
        valley.update(dt, cam, this.party, playing ? following : 0, tr, pxScale);
        this.effects.update(dt, pxScale);
    }

    /** Respawn gentil: a fila vem junto (aparece logo atrás de Nina). */
    onRescued() {
        const p = this.player.pos;
        for (const f of this.walking()) {
            f.mesh.position.set(p.x, p.y, p.z);
        }
        this.hud.say('Opa! Nina voltou para um lugar seguro.', 2600);
    }

    /** dt limitado a 1/20 s (aba que volta, engasgo); a física de Nina subdivide em 1/120 s. */
    frame(dt) {
        if (this.state === 'pause') return;
        try {
            this.step(Math.min(dt, 0.05), this.state === 'play');
        } catch (err) {
            // um erro num frame não pode congelar o vale: registra uma vez e segue
            if (!this.frameErr) console.error(err);
            this.frameErr = true;
        }
    }

    /** Ganchos de teste/captura (só com ?debug=1). */
    exposeDebug() {
        const game = this;
        window.__lab = {
            game,
            stage: this.stage,
            start: () => game.start(),
            tp(x, z, yaw) {
                game.player.place(game.valley, x, z, yaw);
            },
            /**
             * Simula `seconds` de jogo em passos de `dt` com teclas seguradas (sem depender do
             * rAF, que é lento em navegador headless). keys: ['KeyW', 'ShiftLeft', 'Space'…].
             * Devolve amostras { t, x, y, z, v, vy, grounded }.
             */
            sim(seconds, keys = [], dt = 1 / 60, every = 0.25) {
                const inp = game.input;
                inp.clear();
                for (const k of keys) {
                    inp.keys.add(k);
                    if (k === 'Space') { inp.jumpPressed = true; inp.jumpHeld = true; }
                }
                const out = [];
                let acc = 0;
                for (let t = 0; t < seconds - 1e-9; t += dt) {
                    game.step(dt, game.state === 'play');
                    acc += dt;
                    if (acc >= every - 1e-9) {
                        acc = 0;
                        const p = game.player;
                        out.push({ t: +(t + dt).toFixed(2), x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), v: +p.speed.toFixed(2), vy: +p.vel.y.toFixed(2), g: p.grounded });
                    }
                }
                inp.clear();
                return out;
            },
            render: () => game.stage.render(1 / 60),
            cam(theta, phi, radius) {
                const p = game.player;
                if (theta !== undefined) p.desired.theta = p.spherical.theta = theta;
                if (phi !== undefined) p.desired.phi = p.spherical.phi = phi;
                if (radius !== undefined) p.desired.radius = p.spherical.radius = radius;
                game.camera.position.setFromSpherical(p.spherical).add(p.lookTarget);
            },
            give(n = 14) {
                game.player.berries += n;
                game.syncHud();
            },
            befriend(id) {
                for (const f of game.valley.friends) {
                    if (f.state === 'lost' && (!id || f.id === id)) {
                        f.state = 'follow';
                        f.joined = performance.now();
                        f.hop = 1;
                        game.effects.heart(f.mesh.position, 3);
                    }
                }
                game.syncHud();
            },
            friend: (id) => game.valley.friends.find((f) => f.id === id),
            action: () => game.tryAction(),
            stats: () => ({ ...game.stage.stats(), state: game.state, home: game.homeCount(), berries: game.player.berries, grass: game.valley.grass.stats(game.camera), forest: game.valley.forest.stats() }),
            fps(seconds = 2) {
                return new Promise((resolve) => {
                    let n = 0;
                    const t0 = performance.now();
                    const tick = () => {
                        n++;
                        if (performance.now() - t0 < seconds * 1000) requestAnimationFrame(tick);
                        else resolve(Math.round(n / ((performance.now() - t0) / 1000)));
                    };
                    requestAnimationFrame(tick);
                });
            }
        };
    }
}

new Nina();
