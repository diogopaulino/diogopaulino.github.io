/**
 * Xadrez — atelier 3D.
 * Cena PBR, seleção por raycast, animações em arco e o mestre comentando.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Chess, START_FEN, PIECE_NAME, PIECE_HOW, alg, parseAlg } from './engine.js';
import { pickMove, hintMove } from './ai.js';
import {
    LESSONS, PUZZLES, commentOnMove, loadProgress, saveProgress
} from './coach.js';
import { createTextures } from './textures.js';
import { PieceFactory } from './pieces.js';
import {
    buildWorld, setupLights, squareToWorld, worldToSquare, placeMark
} from './world.js';
import { SalonAudio } from './audio.js';

const STORAGE = 'xadrez-settings';
const GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const QUALITY = {
    low: { id: 'low', pr: 1, seg: 24, shadows: true, shadowMap: 1024, reflect: 0, aniso: 4 },
    medium: { id: 'medium', pr: 1.35, seg: 40, shadows: true, shadowMap: 2048, reflect: 512, aniso: 8 },
    high: { id: 'high', pr: 1.75, seg: 56, shadows: true, shadowMap: 2048, reflect: 1024, aniso: 8 }
};

function isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 720;
}

function detectSoftwareGL(renderer) {
    try {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const r = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
        return /SwiftShader|llvmpipe|Soft/i.test(String(r));
    } catch {
        return false;
    }
}

function pickQuality(mode, renderer) {
    if (QUALITY[mode]) return QUALITY[mode];
    if (detectSoftwareGL(renderer) || isMobile()) return QUALITY.low;
    if ((window.devicePixelRatio || 1) >= 2 && innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

class Atelier {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.audio = new SalonAudio();
        this.game = new Chess();
        this.mode = 'cpu';
        this.level = 'praticante';
        this.player = 'w';
        this.flip = false;
        this.selected = -1;
        this.legal = [];
        this.history = [];
        this.busy = false;
        this.anims = [];
        this.pieces = new Map();
        this.pieceRoot = new THREE.Group();
        this.progress = loadProgress();
        this.lessonIndex = 0;
        this.puzzleIndex = 0;
        this.expect = null;
        this.pendingPromo = null;
        this.clock = new THREE.Clock();
        this.pointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.drag = { x: 0, y: 0, active: false };
        this.bindUi();
        this.boot();
    }

    loadSettings() {
        try {
            return {
                quality: 'auto', theme: 'classic', level: 'praticante',
                muted: false, ...JSON.parse(localStorage.getItem(STORAGE) || '{}')
            };
        } catch {
            return { quality: 'auto', theme: 'classic', level: 'praticante', muted: false };
        }
    }

    saveSettings() {
        try { localStorage.setItem(STORAGE, JSON.stringify(this.settings)); } catch { /* privado */ }
    }

    setLoad(p, text) {
        const fill = document.getElementById('loadingFill');
        const line = document.getElementById('loadingText');
        if (fill) fill.style.width = `${Math.round(p * 100)}%`;
        if (text && line) line.textContent = text;
    }

    fail(err) {
        console.error(err);
        document.getElementById('loadingOverlay').hidden = true;
        const overlay = document.getElementById('errorOverlay');
        overlay.hidden = false;
        const t = document.getElementById('errorText');
        if (t && err) t.textContent = String(err.message || err);
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.start();
        });
        document.getElementById('intro')?.addEventListener('pointerup', (e) => {
            if (e.target.closest('#startButton')) {
                e.preventDefault();
                this.start();
            }
        });
        document.getElementById('modePlay')?.addEventListener('click', () => this.setMode('cpu'));
        document.getElementById('modeAcademy')?.addEventListener('click', () => this.setMode('academy'));
        document.getElementById('modePuzzles')?.addEventListener('click', () => this.setMode('puzzles'));
        document.getElementById('hintBtn')?.addEventListener('click', () => this.hint());
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('flipBtn')?.addEventListener('click', () => this.toggleFlip());
        document.getElementById('newBtn')?.addEventListener('click', () => this.fresh());
        document.getElementById('muteBtn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('prevLesson')?.addEventListener('click', () => this.shiftLesson(-1));
        document.getElementById('nextLesson')?.addEventListener('click', () => this.shiftLesson(1));
        document.getElementById('coachToggle')?.addEventListener('click', () => {
            document.getElementById('coach')?.classList.toggle('is-collapsed');
        });
        document.getElementById('resultAgain')?.addEventListener('click', () => {
            document.getElementById('resultOverlay').hidden = true;
            this.fresh();
        });
        document.getElementById('resultClose')?.addEventListener('click', () => {
            document.getElementById('resultOverlay').hidden = true;
        });
        document.querySelectorAll('.promo-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.finishPromo(btn.dataset.promo));
        });
        ['qualitySelect', 'themeSelect', 'levelSelect', 'modeSelect'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === 'qualitySelect') el.value = this.settings.quality;
            if (id === 'themeSelect') el.value = this.settings.theme;
            if (id === 'levelSelect') el.value = this.settings.level;
            el.addEventListener('change', () => {
                if (id === 'qualitySelect') this.settings.quality = el.value;
                if (id === 'themeSelect') this.settings.theme = el.value;
                if (id === 'levelSelect') this.settings.level = el.value;
                this.saveSettings();
            });
        });
        window.addEventListener('keydown', (e) => {
            if (document.body.dataset.state === 'intro' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) {
                e.preventDefault();
                this.start();
                return;
            }
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyH') this.hint();
            if (e.code === 'KeyU' || ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ')) this.undo();
            if (e.code === 'KeyF') this.toggleFlip();
        });
    }

    async boot() {
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            this.fail(err);
            return;
        }
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.92;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x120c0a, 1);

        this.quality = pickQuality(this.settings.quality, this.renderer);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pr));
        this.resize();

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x120c0a, 16, 32);
        this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 80);
        this.camera.position.set(0, 8.4, 10.6);

        this.setLoad(0.2, 'Talhando o marfim…');
        const tex = createTextures(this.quality.aniso);
        this.setLoad(0.45, 'Montando o tabuleiro…');
        this.world = buildWorld(tex, this.quality);
        this.scene.add(this.world.root);
        this.scene.add(this.pieceRoot);
        this.factory = new PieceFactory(tex, this.quality);
        if (this.settings.theme === 'crystal') this.factory.setTheme('crystal');

        this.setLoad(0.7, 'Acendendo o lustre…');
        setupLights(this.scene, this.quality);
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.85;
        pmrem.dispose();

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.07;
        this.controls.target.set(0, 0.35, 0);
        this.controls.minDistance = 6;
        this.controls.maxDistance = 18;
        this.controls.minPolarAngle = 0.35;
        this.controls.maxPolarAngle = 1.25;
        this.controls.enablePan = false;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.55;

        this.rebuildPieces();
        this.renderer.compile(this.scene, this.camera);
        this.renderer.render(this.scene, this.camera);

        this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
        this.canvas.addEventListener('pointerup', (e) => this.onUp(e));

        this.fillLists();
        this.setLoad(1, 'O atelier está pronto.');
        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('intro').hidden = false;
        document.body.dataset.state = 'intro';
        requestAnimationFrame(() => this.resize());

        this.clock.start();
        this.renderer.setAnimationLoop(() => this.frame());
        window.addEventListener('resize', () => this.resize());
        window.visualViewport?.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.renderer) return;
        const w = innerWidth;
        const h = innerHeight;
        this.renderer.setSize(w, h, false);
        if (this.camera) {
            this.camera.aspect = w / Math.max(1, h);
            this.camera.updateProjectionMatrix();
        }
    }

    start() {
        if (document.body.dataset.state !== 'intro') return;
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.syncMute();
        this.level = document.getElementById('levelSelect')?.value || 'praticante';
        this.settings.level = this.level;
        const theme = document.getElementById('themeSelect')?.value || 'classic';
        if (theme !== this.factory.mats.theme) {
            this.factory.setTheme(theme);
            this.settings.theme = theme;
        }
        this.saveSettings();
        document.getElementById('intro').hidden = true;
        document.getElementById('hud').hidden = false;
        document.body.dataset.state = 'play';
        if (this.controls) this.controls.autoRotate = false;
        const mode = document.getElementById('modeSelect')?.value || 'cpu';
        this.setMode(mode);
    }

    setMode(mode) {
        this.mode = mode;
        document.getElementById('modePlay')?.setAttribute('aria-pressed', String(mode === 'cpu' || mode === 'local' || mode === 'free'));
        document.getElementById('modeAcademy')?.setAttribute('aria-pressed', String(mode === 'academy'));
        document.getElementById('modePuzzles')?.setAttribute('aria-pressed', String(mode === 'puzzles'));
        const lessonNav = document.getElementById('lessonNav');
        const lessonList = document.getElementById('lessonList');
        const puzzleList = document.getElementById('puzzleList');
        const coach = document.getElementById('coach');
        lessonNav.hidden = mode !== 'academy' && mode !== 'puzzles';
        lessonList.hidden = mode !== 'academy';
        puzzleList.hidden = mode !== 'puzzles';
        if (isMobile()) {
            coach?.classList.add('is-collapsed');
        }
        if (mode === 'academy') this.loadLesson(this.lessonIndex);
        else if (mode === 'puzzles') this.loadPuzzle(this.puzzleIndex);
        else this.loadGame(START_FEN);
        this.speakMode();
    }

    speakMode() {
        if (this.mode === 'cpu') {
            this.coach('Contra a máquina', 'Você joga de brancas. Toque uma peça e depois a casa de destino. O mestre comenta cada lance.', 'Dica destaca um bom lance. Desfazer volta o último par.');
        } else if (this.mode === 'local') {
            this.coach('Dois jogadores', 'Passem o aparelho. As brancas começam. Casas legais acendem ao selecionar.', 'Vire o tabuleiro depois do lance, se quiser.');
        } else if (this.mode === 'free') {
            this.coach('Tabuleiro livre', 'Os dois lados se movem. Experimente peças, roque e en passant sem o relógio da partida.', 'Nada é cobrado — só o que o mestre explica.');
        }
    }

    fillLists() {
        const lessonList = document.getElementById('lessonList');
        const puzzleList = document.getElementById('puzzleList');
        lessonList.innerHTML = '';
        puzzleList.innerHTML = '';
        LESSONS.forEach((ls, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = `${i + 1}. ${ls.title}`;
            if (this.progress.lessons.includes(ls.id)) b.classList.add('is-done');
            b.addEventListener('click', () => this.loadLesson(i));
            lessonList.appendChild(b);
        });
        PUZZLES.forEach((pz, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = pz.title;
            if (this.progress.puzzles.includes(pz.id)) b.classList.add('is-done');
            b.addEventListener('click', () => this.loadPuzzle(i));
            puzzleList.appendChild(b);
        });
    }

    loadGame(fen) {
        this.game.load(fen);
        this.history = [];
        this.selected = -1;
        this.expect = null;
        this.busy = false;
        this.pendingPromo = null;
        this.clearMarks();
        this.rebuildPieces();
        this.renderHud();
    }

    loadLesson(i) {
        this.lessonIndex = (i + LESSONS.length) % LESSONS.length;
        const ls = LESSONS[this.lessonIndex];
        this.mode = 'academy';
        this.loadGame(ls.fen);
        this.expect = ls.expect;
        this.coach(ls.title, ls.text, ls.tip);
        this.markList('lessonList', this.lessonIndex);
        document.getElementById('lessonNav').hidden = false;
        document.getElementById('lessonList').hidden = false;
        document.getElementById('puzzleList').hidden = true;
    }

    loadPuzzle(i) {
        this.puzzleIndex = (i + PUZZLES.length) % PUZZLES.length;
        const pz = PUZZLES[this.puzzleIndex];
        this.mode = 'puzzles';
        this.loadGame(pz.fen);
        this.expect = pz.expect;
        this.coach(pz.title, pz.text, 'Encontre o lance. Dica acende a peça certa.');
        this.markList('puzzleList', this.puzzleIndex);
        document.getElementById('lessonNav').hidden = false;
        document.getElementById('lessonList').hidden = true;
        document.getElementById('puzzleList').hidden = false;
    }

    markList(id, index) {
        const list = document.getElementById(id);
        [...list.children].forEach((el, i) => el.setAttribute('aria-current', String(i === index)));
    }

    shiftLesson(dir) {
        if (this.mode === 'puzzles') this.loadPuzzle(this.puzzleIndex + dir);
        else this.loadLesson(this.lessonIndex + dir);
    }

    coach(title, text, tip = '') {
        document.getElementById('coachTitle').textContent = title;
        document.getElementById('coachText').textContent = text;
        document.getElementById('coachTip').textContent = tip;
    }

    rebuildPieces() {
        while (this.pieceRoot.children.length) {
            this.pieceRoot.remove(this.pieceRoot.children[0]);
        }
        this.pieces.clear();
        for (let i = 0; i < 64; i++) {
            const p = this.game.board[i];
            if (!p) continue;
            const mesh = this.factory.spawn(p.t, p.c);
            const pos = squareToWorld(i, this.flip);
            mesh.position.set(pos.x, 0.07, pos.z);
            mesh.userData.index = i;
            this.pieceRoot.add(mesh);
            this.pieces.set(i, mesh);
        }
        this.refreshMarks();
    }

    pieceAt(index) {
        return this.pieces.get(index) || null;
    }

    onDown(e) {
        this.drag = { x: e.clientX, y: e.clientY, active: true };
    }

    onUp(e) {
        if (!this.drag.active) return;
        this.drag.active = false;
        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 8) return;
        if (this.busy || this.pendingPromo) return;
        const hit = this.hit(e);
        if (hit < 0) {
            this.selected = -1;
            this.refreshMarks();
            return;
        }
        this.onSquare(hit);
    }

    hit(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const objs = [...this.world.squares, ...this.pieceRoot.children];
        const hits = this.raycaster.intersectObjects(objs, true);
        for (const h of hits) {
            let o = h.object;
            while (o && o.userData.index === undefined) o = o.parent;
            if (o && o.userData.index !== undefined) return o.userData.index;
        }
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const p = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, p);
        if (p) return worldToSquare(p.x, p.z, this.flip);
        return -1;
    }

    onSquare(index) {
        const piece = this.game.board[index];
        if (this.selected >= 0) {
            const move = this.game.findMove(this.selected, index, this.expect?.promo || 'q');
            if (move) {
                this.tryMove(move);
                return;
            }
        }
        const side = this.game.side;
        const canSelect = this.mode !== 'cpu' || side === this.player;
        if (piece && piece.c === side && canSelect) {
            this.selected = index;
            this.legal = this.game.legalMovesFrom(index);
            this.refreshMarks();
            this.explainPiece(piece, index);
            return;
        }
        this.selected = -1;
        this.legal = [];
        this.refreshMarks();
    }

    explainPiece(piece, index) {
        const moves = this.game.legalMovesFrom(index);
        const name = PIECE_NAME[piece.t];
        const how = PIECE_HOW[piece.t];
        const n = moves.length;
        const hang = this.game.hanging(index) ? ' Esta peça está desprotegida.' : '';
        this.coach(name, `${how}${hang}`, n ? `${n} lance${n > 1 ? 's' : ''} legal${n > 1 ? 'is' : ''} a partir de ${alg(index)}.` : `Nenhum lance legal em ${alg(index)} — talvez esteja cravada.`);
    }

    tryMove(move) {
        if (this.expect) {
            const okFrom = alg(move.from) === this.expect.from;
            const okTo = alg(move.to) === this.expect.to;
            const okPromo = !this.expect.promo || move.promo === this.expect.promo;
            if (!(okFrom && okTo && okPromo)) {
                this.audio.illegal();
                this.coach('Quase', 'Esse não é o lance da lição. Olhe o destaque do mestre — a peça certa e a casa certa.', this.currentTip());
                this.flashHint();
                return;
            }
        }
        if (this.needsPromoChoice(move)) {
            this.pendingPromo = move;
            document.getElementById('promoOverlay').hidden = false;
            return;
        }
        this.commit(move);
    }

    needsPromoChoice(move) {
        return !!move.promo && this.isHumanTurn() && !this.expect?.promo;
    }

    isHumanTurn() {
        if (this.mode === 'cpu') return this.game.side === this.player;
        return true;
    }

    finishPromo(promo) {
        document.getElementById('promoOverlay').hidden = true;
        if (!this.pendingPromo) return;
        const move = this.game.findMove(this.pendingPromo.from, this.pendingPromo.to, promo);
        this.pendingPromo = null;
        if (move) this.commit(move);
    }

    currentTip() {
        if (this.mode === 'academy') return LESSONS[this.lessonIndex].tip;
        if (this.mode === 'puzzles') return PUZZLES[this.puzzleIndex].text;
        return '';
    }

    commit(move) {
        const san = this.game.san(move);
        const captured = move.captured;
        const from = move.from;
        const to = move.to;
        const mesh = this.pieceAt(from);
        const capMesh = move.flag === 'e' && move.epCap >= 0
            ? this.pieceAt(move.epCap)
            : this.pieceAt(to);
        const rookDest = move.flag === 'k' ? (from === 4 ? 5 : 61) : move.flag === 'q' ? (from === 4 ? 3 : 59) : -1;
        const rookSrc = move.flag === 'k' ? (from === 4 ? 7 : 63) : move.flag === 'q' ? (from === 4 ? 0 : 56) : -1;
        const rookMesh = rookSrc >= 0 ? this.pieceAt(rookSrc) : null;

        this.game.play(move);
        const mover = this.game.side === 'w' ? 'b' : 'w';
        this.history.push({ san, color: mover });

        this.selected = -1;
        this.legal = [];
        this.busy = true;

        if (move.flag === 'k' || move.flag === 'q') this.audio.castle();
        else if (captured) this.audio.capture();
        else if (move.promo) this.audio.promote();
        else this.audio.move();

        const hops = [];
        if (mesh) hops.push(this.hop(mesh, from, to));
        if (rookMesh && rookDest >= 0) hops.push(this.hop(rookMesh, rookSrc, rookDest));
        if (capMesh) hops.push(this.fadeOut(capMesh));

        Promise.all(hops).then(() => {
            this.rebuildPieces();
            this.busy = false;
            this.afterMove(san, move, captured);
        });
    }

    hop(mesh, from, to) {
        const a = squareToWorld(from, this.flip);
        const b = squareToWorld(to, this.flip);
        return this.tween(0.38, (t) => {
            const k = easeInOut(t);
            mesh.position.x = a.x + (b.x - a.x) * k;
            mesh.position.z = a.z + (b.z - a.z) * k;
            mesh.position.y = 0.07 + Math.sin(k * Math.PI) * 0.55;
        });
    }

    fadeOut(mesh) {
        const start = mesh.position.clone();
        return this.tween(0.32, (t) => {
            mesh.position.y = start.y - t * 0.4;
            mesh.scale.setScalar(1 - t * 0.85);
        }).then(() => {
            mesh.visible = false;
        });
    }

    tween(dur, fn) {
        return new Promise((resolve) => {
            this.anims.push({ t: 0, dur, fn, resolve });
        });
    }

    afterMove(san, move, captured) {
        const st = this.game.status();
        if (st.check) this.audio.check();
        if (st.over && st.reason === 'xeque-mate') this.audio.win();

        const hangingAfter = move && this.game.board[move.to] && this.game.hanging(move.to);
        const text = commentOnMove(san, {
            check: st.check,
            mate: st.reason === 'xeque-mate',
            captured,
            hangingAfter,
            castle: move.flag === 'k' || move.flag === 'q',
            promo: !!move.promo,
            opening: this.history.length <= 6
        });

        if (this.expect) {
            this.completeTask(text);
        } else {
            this.coach(st.check ? 'Xeque' : 'Lance', text, st.over ? this.endLine(st) : '');
        }

        this.renderHud();
        this.refreshMarks();

        if (st.over && this.mode !== 'academy' && this.mode !== 'puzzles') {
            this.showResult(st);
            return;
        }
        if (this.mode === 'cpu' && !st.over && this.game.side !== this.player) {
            this.queueAi();
        }
    }

    completeTask(text) {
        const pack = this.mode === 'puzzles' ? PUZZLES[this.puzzleIndex] : LESSONS[this.lessonIndex];
        const success = pack.success || text;
        this.coach('Isso.', success, this.mode === 'academy' ? 'Toque em Próxima para continuar.' : 'Toque em Próxima para o próximo puzzle.');
        this.expect = null;
        if (this.mode === 'academy') {
            if (!this.progress.lessons.includes(pack.id)) this.progress.lessons.push(pack.id);
        } else if (!this.progress.puzzles.includes(pack.id)) this.progress.puzzles.push(pack.id);
        saveProgress(this.progress);
        this.fillLists();
        if (this.mode === 'academy') this.markList('lessonList', this.lessonIndex);
        else this.markList('puzzleList', this.puzzleIndex);
    }

    queueAi() {
        this.busy = true;
        this.coach('A máquina pensa', 'Calculando um lance no atelier…', '');
        const delay = this.level === 'clube' ? 380 : 220;
        setTimeout(() => {
            const mv = pickMove(this.game, this.level);
            this.busy = false;
            if (mv) this.commit(mv);
            else this.renderHud();
        }, delay);
    }

    hint() {
        if (this.busy) return;
        if (this.expect) {
            this.flashHint();
            return;
        }
        const mv = hintMove(this.game);
        if (!mv) return;
        this.selected = mv.from;
        this.legal = this.game.legalMovesFrom(mv.from);
        this.refreshMarks();
        placeMark(this.world.marks.hint, mv.to, this.flip);
        const p = this.game.board[mv.from];
        this.coach('Dica', `Considere ${this.game.san(mv)}. ${p ? PIECE_HOW[p.t] : ''}`, 'Toque a peça destacada e a casa verde.');
    }

    flashHint() {
        if (!this.expect) return;
        const from = parseAlg(this.expect.from);
        const to = parseAlg(this.expect.to);
        this.selected = from;
        this.legal = this.game.legalMovesFrom(from);
        this.refreshMarks();
        placeMark(this.world.marks.hint, to, this.flip);
    }

    undo() {
        if (this.busy || this.game.stack.length === 0) return;
        this.game.undo();
        this.history.pop();
        if (this.mode === 'cpu' && this.game.side !== this.player && this.game.stack.length) {
            this.game.undo();
            this.history.pop();
        }
        this.selected = -1;
        this.rebuildPieces();
        this.renderHud();
        this.coach('Desfeito', 'O último lance voltou. O tabuleiro não guarda rancor.', '');
    }

    toggleFlip() {
        this.flip = !this.flip;
        this.rebuildPieces();
        const az = this.flip ? Math.PI : 0;
        this.camera.position.set(Math.sin(az) * 10.6, 8.4, Math.cos(az) * 10.6);
        this.controls.target.set(0, 0.35, 0);
    }

    fresh() {
        document.getElementById('resultOverlay').hidden = true;
        if (this.mode === 'academy') this.loadLesson(this.lessonIndex);
        else if (this.mode === 'puzzles') this.loadPuzzle(this.puzzleIndex);
        else this.loadGame(START_FEN);
        this.speakMode();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.saveSettings();
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.syncMute();
    }

    syncMute() {
        const btn = document.getElementById('muteBtn');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(!this.settings.muted));
        btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
    }

    clearMarks() {
        const m = this.world.marks;
        m.dots.forEach((d) => { d.visible = false; });
        m.caps.forEach((c) => { c.visible = false; });
        m.select.visible = false;
        m.lastFrom.visible = false;
        m.lastTo.visible = false;
        m.check.visible = false;
        m.hint.visible = false;
    }

    refreshMarks() {
        this.clearMarks();
        const m = this.world.marks;
        if (this.selected >= 0) placeMark(m.select, this.selected, this.flip);
        let di = 0;
        let ci = 0;
        for (const mv of this.legal) {
            if (mv.captured || mv.flag === 'e') {
                if (ci < m.caps.length) placeMark(m.caps[ci++], mv.to, this.flip);
            } else if (di < m.dots.length) {
                placeMark(m.dots[di++], mv.to, this.flip);
            }
        }
        const last = this.game.stack[this.game.stack.length - 1];
        if (last) {
            placeMark(m.lastFrom, last.from, this.flip);
            placeMark(m.lastTo, last.to, this.flip);
        }
        if (this.game.inCheck()) {
            const k = this.game.kingIndex(this.game.side);
            if (k >= 0) placeMark(m.check, k, this.flip);
        }
    }

    renderHud() {
        const st = this.game.status();
        const line = document.getElementById('statusLine');
        if (st.over) {
            line.textContent = st.reason === 'xeque-mate'
                ? `Xeque-mate · ${st.result}`
                : `Empate · ${st.reason}`;
            line.classList.toggle('is-check', st.reason === 'xeque-mate');
        } else {
            line.textContent = st.check
                ? `Xeque · ${this.game.side === 'w' ? 'brancas' : 'pretas'}`
                : `${this.game.side === 'w' ? 'Brancas' : 'Pretas'} jogam`;
            line.classList.toggle('is-check', st.check);
        }
        this.renderCaptured();
        this.renderMoves();
    }

    renderCaptured() {
        const taken = { w: { q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { q: 0, r: 0, b: 0, n: 0, p: 0 } };
        for (const u of this.game.stack) {
            if (u.captured) taken[u.captured.c][u.captured.t] += 1;
        }
        let html = '';
        for (const c of ['w', 'b']) {
            for (const t of ['q', 'r', 'b', 'n', 'p']) {
                for (let i = 0; i < taken[c][t]; i++) html += GLYPH[c][t];
            }
            if (c === 'w') html += '  ';
        }
        document.getElementById('captured').textContent = html.trim() || '—';
    }

    renderMoves() {
        const ol = document.getElementById('moves');
        ol.innerHTML = '';
        for (let i = 0; i < this.history.length; i += 2) {
            const li = document.createElement('li');
            const n = document.createElement('span');
            n.className = 'n';
            n.textContent = `${(i / 2) + 1}.`;
            const a = document.createElement('span');
            a.textContent = this.history[i].san;
            const b = document.createElement('span');
            b.textContent = this.history[i + 1]?.san || '';
            li.append(n, a, b);
            ol.appendChild(li);
        }
        ol.scrollTop = ol.scrollHeight;
    }

    endLine(st) {
        if (st.reason === 'xeque-mate') {
            return this.game.side === 'b' ? 'As brancas venceram.' : 'As pretas venceram.';
        }
        return `Empate por ${st.reason}.`;
    }

    showResult(st) {
        document.getElementById('resultOverlay').hidden = false;
        document.getElementById('resultKicker').innerHTML = '<i></i> Fim';
        document.getElementById('resultTitle').textContent = st.reason === 'xeque-mate' ? 'Xeque-mate' : 'Empate';
        document.getElementById('resultText').textContent = this.endLine(st);
    }

    frame() {
        const dt = Math.min(0.05, this.clock.getDelta());
        for (let i = this.anims.length - 1; i >= 0; i--) {
            const a = this.anims[i];
            a.t += dt;
            const k = Math.min(1, a.t / a.dur);
            a.fn(k);
            if (k >= 1) {
                a.resolve();
                this.anims.splice(i, 1);
            }
        }
        if (this.world?.marks?.select?.visible) {
            this.world.marks.select.rotation.z += dt * 0.6;
        }
        if (this.world?.marks?.check?.visible) {
            this.world.marks.check.material.opacity = 0.55 + Math.sin(this.clock.elapsedTime * 4) * 0.3;
        }
        this.controls?.update();
        this.renderer.render(this.scene, this.camera);
    }
}

try {
    new Atelier();
} catch (err) {
    console.error(err);
    const overlay = document.getElementById('errorOverlay');
    const load = document.getElementById('loadingOverlay');
    if (load) load.hidden = true;
    if (overlay) overlay.hidden = false;
}
