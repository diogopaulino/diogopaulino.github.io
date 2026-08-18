/**
 * Xadrez — atelier 3D em Babylon.js.
 * Cena PBR, seleção por raycast, animações em arco e o mestre comentando.
 */

import { Chess, START_FEN, PIECE_NAME, PIECE_HOW, alg, parseAlg } from './engine.js';
import { pickMove, hintMove } from './ai.js';
import { LESSONS, PUZZLES, commentOnMove, loadProgress, saveProgress } from './coach.js';
import { createTextures } from './textures.js';
import { PieceFactory } from './pieces.js';
import {
    buildWorld, setupLights, setupEnvironment, setupPostProcess, squareToWorld, worldToSquare, placeMark
} from './world.js';
import { SalonAudio } from './audio.js';

const STORAGE = 'xadrez-settings';
const GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const QUALITY = {
    low: { id: 'low', pr: 1, seg: 24, shadows: false, shadowMap: 1024 },
    medium: { id: 'medium', pr: 1.35, seg: 40, shadows: true, shadowMap: 2048 },
    high: { id: 'high', pr: 1.75, seg: 56, shadows: true, shadowMap: 2048 }
};

function isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 720;
}

function pickQuality(mode) {
    if (QUALITY[mode]) return QUALITY[mode];
    if (isMobile()) return QUALITY.low;
    if ((window.devicePixelRatio || 1) >= 2 && window.innerWidth >= 1400) return QUALITY.high;
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
        this.progress = loadProgress();
        this.lessonIndex = 0;
        this.puzzleIndex = 0;
        this.expect = null;
        this.pendingPromo = null;
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
        const overlay = document.getElementById('errorOverlay');
        const load = document.getElementById('loadingOverlay');
        if (load) load.hidden = true;
        if (overlay) overlay.hidden = false;
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
        const BABYLON = window.BABYLON;
        if (!BABYLON) {
            this.fail(new Error('Babylon.js não foi carregado.'));
            return;
        }

        try {
            this.engine = new BABYLON.Engine(this.canvas, true, {
                preserveDrawingBuffer: false,
                stencil: true,
                adaptToDeviceRatio: true
            });
            this.scene = new BABYLON.Scene(this.engine);
            this.scene.clearColor = new BABYLON.Color4(0.07, 0.05, 0.04, 1.0);
        } catch (err) {
            this.fail(err);
            return;
        }

        this.quality = pickQuality(this.settings.quality);

        // Câmera orbital elegante. Radius maior + FOV mais fechado do que o
        // padrão do Babylon (0.8) achatam a perspectiva: sem isso, a casa mais
        // próxima da câmera aparecia enorme e a última fileira, minúscula.
        this.camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3.9, 16.5, new BABYLON.Vector3(0, 0.35, 0), this.scene);
        this.camera.fov = 0.62;
        this.camera.lowerRadiusLimit = 9;
        this.camera.upperRadiusLimit = 24;
        this.camera.lowerBetaLimit = 0.35;
        this.camera.upperBetaLimit = Math.PI / 2.4;
        this.camera.wheelDeltaPercentage = 0.015;
        this.camera.pinchDeltaPercentage = 0.015;
        this.camera.inertia = 0.85;
        this.camera.useAutoRotationBehavior = true;
        if (this.camera.autoRotationBehavior) {
            this.camera.autoRotationBehavior.idleRotationSpeed = 0.15;
            this.camera.autoRotationBehavior.idleRotationWaitTime = 2000;
        }
        this.camera.attachControl(this.canvas, true);
        this.fitCameraFov();

        this.setLoad(0.2, 'Talhando o marfim em Babylon.js…');
        const tex = createTextures(this.scene);

        this.setLoad(0.45, 'Montando o atelier…');
        setupEnvironment(BABYLON, this.scene);
        this.world = buildWorld(BABYLON, this.scene, tex, this.quality);
        this.lights = setupLights(BABYLON, this.scene, this.quality);
        this.postProcess = setupPostProcess(BABYLON, this.scene, this.quality);

        this.factory = new PieceFactory(this.scene, tex, this.quality);
        if (this.settings.theme === 'crystal') this.factory.setTheme('crystal');

        this.setLoad(0.8, 'Posicionando as peças no tabuleiro…');
        this.rebuildPieces();

        this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
        this.canvas.addEventListener('pointerup', (e) => this.onUp(e));

        this.fillLists();
        this.setLoad(1, 'O atelier está pronto.');
        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('intro').hidden = false;
        document.body.dataset.state = 'intro';

        this.engine.runRenderLoop(() => {
            this.frame();
            this.scene.render();
        });

        window.addEventListener('resize', () => {
            this.engine.resize();
            this.fitCameraFov();
        });
        window.visualViewport?.addEventListener('resize', () => {
            this.engine.resize();
            this.fitCameraFov();
        });
    }

    // Em telas estreitas (retrato), FOV vertical fixo faz o campo de visão
    // horizontal encolher com o aspect ratio e corta as laterais do tabuleiro.
    // Travar o FOV horizontal garante a largura do tabuleiro em qualquer tela.
    fitCameraFov() {
        if (!this.camera || !this.engine) return;
        const aspect = this.engine.getRenderWidth() / this.engine.getRenderHeight();
        this.camera.fovMode = aspect < 1
            ? window.BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED
            : window.BABYLON.Camera.FOVMODE_VERTICAL_FIXED;
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
            this.rebuildPieces();
        }
        this.saveSettings();
        document.getElementById('intro').hidden = true;
        document.getElementById('hud').hidden = false;
        document.body.dataset.state = 'play';
        if (this.camera.autoRotationBehavior) {
            this.camera.autoRotationBehavior.idleRotationSpeed = 0;
        }
        this.engine.resize();
        this.fitCameraFov();
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
        for (const [idx, mesh] of this.pieces) {
            mesh.dispose();
        }
        this.pieces.clear();

        for (let i = 0; i < 64; i++) {
            const p = this.game.board[i];
            if (!p) continue;
            const mesh = this.factory.spawn(p.t, p.c);
            if (mesh) {
                const pos = squareToWorld(i);
                mesh.position.set(pos.x, 0.07, pos.z);
                mesh.metadata = { kind: p.t, color: p.c, index: i };
                if (this.lights?.shadowGen) {
                    this.lights.shadowGen.addShadowCaster(mesh, true);
                }
                this.pieces.set(i, mesh);
            }
        }
        this.refreshMarks();
    }

    pieceAt(index) {
        return this.pieces.get(index) || null;
    }

    onDown(e) {
        if (this.busy || this.pendingPromo) return;
        this.drag = { x: e.clientX, y: e.clientY, active: true, mesh: null, origin: null, square: -1 };
        
        const hit = this.hit();
        if (hit >= 0) {
            const piece = this.game.board[hit];
            const side = this.game.side;
            const canSelect = this.mode !== 'cpu' || side === this.player;
            if (piece && piece.c === side && canSelect) {
                this.drag.square = hit;
                this.drag.mesh = this.pieceAt(hit);
                if (this.drag.mesh) {
                    this.drag.origin = this.drag.mesh.position.clone();
                    if (this.camera) this.camera.detachControl();
                    this.canvas.classList.add('is-dragging');
                }
                if (this.selected !== hit) {
                    this.onSquare(hit);
                }
            }
        }
    }

    onMove(e) {
        if (!this.drag.active || !this.drag.mesh) return;
        const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, window.BABYLON.Matrix.Identity(), this.camera);
        // Plane at y = 0.5 to lift the piece slightly
        const hit = ray.intersectsPlane(new window.BABYLON.Plane(0, 1, 0, -0.6));
        if (hit !== null && hit !== undefined) {
            const pt = ray.origin.add(ray.direction.scale(hit));
            this.drag.mesh.position.x = pt.x;
            this.drag.mesh.position.z = pt.z;
            this.drag.mesh.position.y = 0.6;
        }
    }

    onUp(e) {
        if (!this.drag.active) return;
        this.drag.active = false;
        if (this.camera) this.camera.attachControl(this.canvas, true);
        this.canvas.classList.remove('is-dragging');

        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        const dropped = this.drag.mesh && Math.hypot(dx, dy) > 8;

        if (dropped) {
            const hit = this.hit();
            if (hit >= 0 && hit !== this.drag.square) {
                const move = this.game.findMove(this.drag.square, hit, this.expect?.promo || 'q');
                if (move) {
                    // Reset position for hop animation
                    this.drag.mesh.position.copyFrom(this.drag.origin);
                    this.tryMove(move);
                    return;
                }
            }
            // Invalid drop
            this.hop(this.drag.mesh, this.drag.square, this.drag.square);
            return;
        }

        if (this.busy || this.pendingPromo) return;
        const hit = this.hit();
        if (hit < 0) {
            this.selected = -1;
            this.refreshMarks();
            return;
        }
        this.onSquare(hit);
    }

    hit() {
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
            if (this.drag && this.drag.mesh && mesh === this.drag.mesh) return false;
            return mesh.isPickable && (mesh.metadata?.index !== undefined || mesh.metadata?.kind === 'square');
        });
        if (pick && pick.hit && pick.pickedMesh) {
            let m = pick.pickedMesh;
            if (m.metadata && m.metadata.index !== undefined) {
                return m.metadata.index;
            }
        }
        const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, window.BABYLON.Matrix.Identity(), this.camera);
        const hit = ray.intersectsPlane(new window.BABYLON.Plane(0, 1, 0, 0));
        if (hit !== null && hit !== undefined) {
            const pt = ray.origin.add(ray.direction.scale(hit));
            return worldToSquare(pt.x, pt.z);
        }
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
        const a = squareToWorld(from);
        const b = squareToWorld(to);
        const dist = Math.hypot(b.x - a.x, b.z - a.z);
        const h = mesh.metadata?.kind === 'n' ? Math.max(0.6, dist * 0.2) : Math.min(1.2, Math.max(0.2, dist * 0.15));
        return this.tween(0.38, (t) => {
            const k = easeInOut(t);
            mesh.position.x = a.x + (b.x - a.x) * k;
            mesh.position.z = a.z + (b.z - a.z) * k;
            mesh.position.y = 0.07 + Math.sin(k * Math.PI) * h;
        });
    }

    fadeOut(mesh) {
        const startY = mesh.position.y;
        return this.tween(0.32, (t) => {
            mesh.position.y = startY - t * 0.4;
            mesh.scaling.setAll(1 - t * 0.85);
        }).then(() => {
            mesh.isVisible = false;
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
        placeMark(this.world.marks.hint, mv.to);
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
        placeMark(this.world.marks.hint, to);
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
        // O tabuleiro e as peças ficam parados — só a câmera anda até o outro
        // lado da mesa, como alguém dando a volta para ver da perspectiva das
        // pretas. Gira sempre por um delta relativo (nunca um alvo absoluto),
        // senão o sentido do giro depende de onde a órbita livre deixou a
        // câmera e o resultado parece errático.
        this.flip = !this.flip;
        const targetAlpha = this.camera.alpha + Math.PI;
        window.BABYLON.Animation.CreateAndStartAnimation(
            'flipCam', this.camera, 'alpha', 60, 36,
            this.camera.alpha, targetAlpha, window.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
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
        m.dots.forEach((d) => { d.isVisible = false; });
        m.caps.forEach((c) => { c.isVisible = false; });
        m.select.isVisible = false;
        m.lastFrom.isVisible = false;
        m.lastTo.isVisible = false;
        m.check.isVisible = false;
        m.hint.isVisible = false;
    }

    refreshMarks() {
        this.clearMarks();
        const m = this.world.marks;
        if (this.selected >= 0) placeMark(m.select, this.selected);
        let di = 0;
        let ci = 0;
        for (const mv of this.legal) {
            if (mv.captured || mv.flag === 'e') {
                if (ci < m.caps.length) placeMark(m.caps[ci++], mv.to);
            } else if (di < m.dots.length) {
                placeMark(m.dots[di++], mv.to);
            }
        }
        const last = this.game.stack[this.game.stack.length - 1];
        if (last) {
            placeMark(m.lastFrom, last.from);
            placeMark(m.lastTo, last.to);
        }
        if (this.game.inCheck()) {
            const k = this.game.kingIndex(this.game.side);
            if (k >= 0) placeMark(m.check, k);
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
        const dt = this.engine.getDeltaTime() / 1000;
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
        if (this.world?.marks?.select?.isVisible) {
            this.world.marks.select.rotation.y += dt * 0.8;
        }
        if (this.world?.marks?.check?.isVisible) {
            const mat = this.world.marks.check.material;
            if (mat) mat.alpha = 0.55 + Math.sin(Date.now() * 0.006) * 0.35;
        }
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
