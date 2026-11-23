/**
 * Quimera — ateliê 3D de mix-and-match.
 * Loop, câmera, HUD e persistência (hash + localStorage).
 *
 * Enquadramento: a câmera mira o personagem e a projeção é deslocada (setViewOffset) para
 * o centro da área livre da tela — o que sobra entre o cabeçalho/cartão e o painel de peças.
 *   distância = (altura enquadrada / 2) / tan(fov/2) / (altura livre / altura da tela)
 * Corpo inteiro: da base da plataforma ao topo do chapéu. Busto (tecla C): ombros e cabeça.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    KITS, KIT_BY_ID, COMBO_TOTAL, STORAGE_KEY,
    wrapIndex, kitIndex, randomIds, mixTitle, parseHash, toHash
} from './config.js?v=3';
import { Character } from './character.js?v=82';
import { createStudio, PLINTH_TOP } from './studio.js?v=81';
import { setSculptTier } from './sculpt.js';
import { preload } from '../../shared/gfx/assets.js';
import { StudioAudio } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const QUERY = new URLSearchParams(location.search);
const DEBUG = QUERY.has('debug');   // ?debug=1 expõe window.__lab; ?tier=low|medium|high força a qualidade

class Quimera {
    constructor() {
        this.canvas = $('#scene');
        this.audio = new StudioAudio();
        this.ids = { head: 'pirate', body: 'sailor', accessory: 'astronaut' };
        this.autoRotate = true;
        this.uiHidden = false;
        this.frame = 'full';
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.pointerDown = null;
        this.pointerSeen = -10;
        this.yawTarget = 0;
        this.yawHold = 0;
        this.fit = { dist: 6, y: 1.1, dx: 0, dy: 0 };
        this.userZoom = 1;
        this.lookPoint = new THREE.Vector3();
    }

    async init() {
        window.LabShell?.init();
        this._restore();
        const theme = window.LabTheme?.current() || 'dark';
        this.studio = createStudio({ canvas: this.canvas, theme, tier: QUERY.get('tier') || 'auto' });
        if (!this.studio) {
            $('#loading')?.classList.add('is-done');
            return;
        }
        const stage = this.studio.stage;
        this.stage = stage;
        setSculptTier(stage.tier);
        window.LabTheme?.onChange((t) => this.studio.setTheme(t));

        this.camera = stage.camera;
        this.camera.position.set(2.2, 1.6, 5.4);
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.minPolarAngle = 0.75;
        this.controls.maxPolarAngle = 1.6;
        this.controls.target.set(0, 1.1, 0);

        this.character = new Character({
            parent: this.studio.turntable, detail: stage.tier === 'low' ? 1 : 2,
            onBurst: (x, y, z, r, n) => this.studio.burst(x, y, z, r, n)
        });
        this.character.root.position.y = PLINTH_TOP;

        this._hud();
        this._events();
        // texturas e modelos usados pelas peças chegam atrás da tela de carregamento
        await Promise.race([
            Promise.all([stage.ready, preload({ textures: ['rusty_metal_02', 'brown_leather', 'fabric_pattern_07', 'denim_fabric', 'oak_wood_planks', 'dark_wooden_planks'] })]),
            new Promise((r) => setTimeout(r, 6000))
        ]);
        this.applyMix(this.ids, { instant: true, silent: true });
        this._layout(true);
        await stage.warmup();
        $('#loading')?.classList.add('is-done');
        stage.start((dt, t) => this.update(dt, t));
        if (DEBUG) window.__lab = this;
    }

    _restore() {
        const fromHash = parseHash(location.hash);
        if (fromHash) {
            this.ids = fromHash;
            return;
        }
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (KIT_BY_ID[saved.head] && KIT_BY_ID[saved.body] && KIT_BY_ID[saved.accessory]) {
                    this.ids = saved;
                }
            }
        } catch { /* ignore */ }
    }

    _persist() {
        const hash = toHash(this.ids);
        history.replaceState(null, '', `#${hash}`);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ids));
        } catch { /* ignore */ }
    }

    _hud() {
        this._fillSelect('head');
        this._fillSelect('body');
        this._fillSelect('accessory');
        this._syncHud();

        $('#randomBtn').addEventListener('click', () => this.surprise());
        $('#themeBtn').addEventListener('click', () => this.fullSet());
        $('#muteBtn').addEventListener('click', () => this.toggleMute());
        $('#rotateBtn').addEventListener('click', () => this.toggleRotate());
        $('#frameBtn')?.addEventListener('click', () => this.toggleFrame());
        $('#fullscreen').addEventListener('click', () => this.toggleFullscreen());
        $('#photoBtn')?.addEventListener('click', () => this.photo());
        $('#shareBtn')?.addEventListener('click', () => this.share());

        document.querySelectorAll('[data-step]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const slot = btn.dataset.slot;
                const dir = Number(btn.dataset.step);
                this.step(slot, dir);
            });
        });

        document.querySelectorAll('[data-slot-select]').forEach((sel) => {
            sel.addEventListener('change', () => {
                const slot = sel.dataset.slotSelect;
                this.ids[slot] = sel.value;
                this.applyMix(this.ids);
            });
        });
    }

    _fillSelect(slot) {
        const sel = document.querySelector(`[data-slot-select="${slot}"]`);
        sel.innerHTML = KITS.map((k) => `<option value="${k.id}">${k.emoji} ${k.name}</option>`).join('');
    }

    _syncHud() {
        const title = mixTitle(this.ids);
        $('#mixKicker').textContent = title.kicker;
        $('#mixTitle').textContent = title.title;
        $('#comboRead').textContent = COMBO_TOTAL.toLocaleString('pt-BR');
        ['head', 'body', 'accessory'].forEach((slot) => {
            const kit = KIT_BY_ID[this.ids[slot]];
            const sel = document.querySelector(`[data-slot-select="${slot}"]`);
            if (sel) sel.value = kit.id;
            const label = document.querySelector(`[data-slot-label="${slot}"]`);
            if (label) label.textContent = `${kit.emoji} ${kit.name}`;
        });
        $('#rotateBtn')?.setAttribute('aria-pressed', String(this.autoRotate));
        $('#muteBtn')?.setAttribute('aria-pressed', String(!this.audio.enabled));
        $('#frameBtn')?.setAttribute('aria-pressed', String(this.frame === 'bust'));
    }

    applyMix(ids, { instant = false, silent = false } = {}) {
        const accChanged = ids.accessory !== this.character.fig?.ids.accessory;
        this.ids = { ...ids };
        this.character.setMix(this.ids, { instant });
        if (accChanged) this._present(instant);
        this._persist();
        this._syncHud();
        this._layout(instant);
        if (!silent) this.audio.pluck(1);
    }

    step(slot, dir) {
        const i = wrapIndex(kitIndex(this.ids[slot]) + dir);
        this.ids[slot] = KITS[i].id;
        this.character.setMix(this.ids);
        if (slot === 'accessory') this._present(false);
        this._persist();
        this._syncHud();
        this._layout(false);
        this.audio.pluck(slot === 'head' ? 0 : slot === 'body' ? 1 : 2);
        this.audio.resume();
    }

    surprise() {
        this.audio.resume();
        this.applyMix(randomIds(true));
        this.audio.pluck(0);
    }

    fullSet() {
        this.audio.resume();
        const kit = KITS[Math.floor(Math.random() * KITS.length)];
        this.applyMix({ head: kit.id, body: kit.id, accessory: kit.id });
    }

    /**
     * Gira a plataforma para um 3/4 que mostre o acessório novo: 0,45 rad à frente da câmera para
     * itens de mão/ombro; 2,35 rad (3/4 de costas) para mochila, jato e katana embainhada.
     */
    _present(snap) {
        const cam = this.camera.position;
        const back = this.character.fig?.view === 'back';
        this.yawTarget = Math.atan2(cam.x, cam.z) + (back ? 2.35 : -0.45);
        this.yawHold = snap ? 0 : 2.4;
        if (snap) this.studio.turntable.rotation.y = this.yawTarget;
    }

    toggleMute() {
        this.audio.resume();
        this.audio.setEnabled(!this.audio.enabled);
        this._syncHud();
    }

    toggleRotate() {
        this.autoRotate = !this.autoRotate;
        this._syncHud();
    }

    /** Alterna corpo inteiro ↔ close no busto. */
    toggleFrame() {
        this.frame = this.frame === 'full' ? 'bust' : 'full';
        this.userZoom = 1;
        this._syncHud();
        this._layout(false);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    /** Aviso curto no rodapé (link copiado, foto salva…). */
    toast(text, ms = 2200) {
        const el = $('#toast');
        if (!el) return;
        el.textContent = text;
        el.dataset.show = 'true';
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => { el.dataset.show = 'false'; }, ms);
    }

    /**
     * Foto: desenha um quadro e copia o canvas na mesma tarefa — o buffer do WebGL ainda
     * está intacto (sem preserveDrawingBuffer), e toBlob tira a cópia na hora da chamada.
     */
    photo() {
        if (!this.stage) return;
        this.audio.resume();
        this.stage.render(0);
        const name = `quimera-${toHash(this.ids)}.png`;
        this.canvas.toBlob((blob) => {
            if (!blob) {
                this.toast('Não deu para salvar a foto');
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            this.toast('📸 Foto salva!');
        }, 'image/png');
        this.audio.pluck(2);
    }

    /** Link da combinação (o hash remonta as três peças): compartilhamento nativo ou cópia. */
    async share() {
        this.audio.resume();
        const url = `${location.origin}${location.pathname}#${toHash(this.ids)}`;
        const title = `Quimera: ${mixTitle(this.ids).title}`;
        try {
            if (navigator.share && matchMedia('(pointer: coarse)').matches) {
                await navigator.share({ title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            this.toast('🔗 Link copiado!');
        } catch (err) {
            if (err?.name === 'AbortError') return;
            // sem permissão de área de transferência: mostra o link para copiar à mão
            this.toast(url, 5000);
        }
    }

    /**
     * Área livre da tela (px CSS) e enquadramento. A área livre exclui o cabeçalho, o painel de
     * peças e — no retrato — o cartão do título; no paisagem curto o cartão é excluído pela lateral.
     */
    _layout(snap) {
        if (!this.camera) return;
        const W = window.innerWidth;
        const H = window.innerHeight;
        let top = 0;
        let bottom = H;
        let left = 0;
        const hidden = this.uiHidden;
        const rect = (sel) => (hidden ? null : $(sel)?.getBoundingClientRect());
        const head = rect('header[data-lab-header]');
        const dock = rect('.dock');
        const hud = rect('.hud-left');
        if (head) top = Math.max(top, head.bottom - 30);
        if (dock) bottom = Math.min(bottom, dock.top);
        if (hud && hud.width > 0) {
            if (H < 520 && W > H) left = hud.right;
            else if (hud.width > W * 0.55) top = Math.max(top, hud.bottom);
        }
        const fw = Math.max(80, W - left);
        const fh = Math.max(80, bottom - top);
        const h = this.character.height;
        const lo = this.frame === 'full' ? PLINTH_TOP - 0.02 : PLINTH_TOP + this.character.eyeHeight - 0.42;
        const hi = PLINTH_TOP + h + (this.frame === 'full' ? 0.2 : 0.26);
        const span = hi - lo;
        const wide = this.frame === 'full' ? 1.5 : 0.9;
        const tan = Math.tan((this.camera.fov * Math.PI) / 360);
        this.fit.dist = Math.max(span / 2 / tan / (fh / H), wide / 2 / tan / (fw / H)) * 1.0;
        this.fit.y = (lo + hi) / 2;
        this.fit.dx = left + fw / 2 - W / 2;
        this.fit.dy = top + fh / 2 - H / 2;
        this.controls.minDistance = this.fit.dist * 0.45;
        this.controls.maxDistance = this.fit.dist * 1.5;
        this.camera.setViewOffset(W, H, -this.fit.dx, -this.fit.dy, W, H);
        this.refit = snap ? 0 : 1.2;
        if (snap) {
            this.controls.target.set(0, this.fit.y, 0);
            const d = this.camera.position.clone().sub(this.controls.target).setLength(this.fit.dist);
            this.camera.position.copy(this.controls.target).add(d);
        }
    }

    _events() {
        window.addEventListener('resize', () => this._layout(true));
        window.addEventListener('hashchange', () => {
            const ids = parseHash(location.hash);
            if (ids) this.applyMix(ids, { silent: true });
        });

        const wake = () => this.audio.resume();
        window.addEventListener('pointerdown', wake, { once: true });
        window.addEventListener('keydown', wake, { once: true });

        this.canvas.addEventListener('pointerdown', (e) => {
            this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
            this.refit = 0;
        });
        this.canvas.addEventListener('wheel', () => {
            this.refit = 0;
        }, { passive: true });
        this.canvas.addEventListener('pointerup', (e) => {
            if (!this.pointerDown) return;
            const dx = e.clientX - this.pointerDown.x;
            const dy = e.clientY - this.pointerDown.y;
            const dt = performance.now() - this.pointerDown.t;
            this.pointerDown = null;
            if (dt > 400 || dx * dx + dy * dy > 64) return;
            this._pick(e);
        });
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;
            this._ndc(e);
            this.pointerSeen = performance.now() / 1000;
        });

        window.addEventListener('keydown', (e) => {
            if (e.target.closest?.('input, select, textarea')) return;
            const k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') this.step('head', -1);
            else if (k === 'arrowright' || k === 'd') this.step('head', 1);
            else if (k === 'arrowup' || k === 'w') this.step('body', -1);
            else if (k === 'arrowdown' || k === 's') this.step('body', 1);
            else if (k === 'q') this.step('accessory', -1);
            else if (k === 'e') this.step('accessory', 1);
            else if (k === 'r') this.surprise();
            else if (k === 't') this.fullSet();
            else if (k === 'm') this.toggleMute();
            else if (k === 'h') this._toggleUi();
            else if (k === 'f') this.toggleFullscreen();
            else if (k === 'c') this.toggleFrame();
            else if (k === 'p') this.photo();
            else if (k === 'l') this.share();
        });
    }

    _toggleUi() {
        this.uiHidden = !this.uiHidden;
        document.body.classList.toggle('ui-hidden', this.uiHidden);
        this._layout(false);
    }

    _ndc(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    _pick(e) {
        this._ndc(e);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObject(this.character.root, true);
        for (const h of hits) {
            const slot = this.character.slotOf(h);
            if (slot) {
                this.step(slot, 1);
                return;
            }
        }
    }

    update(dt, t) {
        const c = this.character;
        // plataforma: autorrotação lenta + impulso de giro da troca de peça
        const tt = this.studio.turntable;
        if (this.yawHold > 0) {
            // apresentação do acessório: vai ao 3/4 pelo caminho mais curto e segura 2,4 s antes de voltar a girar
            this.yawHold -= dt;
            const d = Math.atan2(Math.sin(this.yawTarget - tt.rotation.y), Math.cos(this.yawTarget - tt.rotation.y));
            tt.rotation.y += d * (1 - Math.exp(-5 * dt));
        } else tt.rotation.y += ((this.autoRotate ? 0.28 : 0) + c.spin) * dt;

        // reenquadra com suavidade depois de troca/redimensionamento (até o usuário mexer)
        if (this.refit > 0) {
            this.refit -= dt;
            const k = 1 - Math.exp(-5 * dt);
            this.controls.target.y += (this.fit.y - this.controls.target.y) * k;
            const off = this.camera.position.clone().sub(this.controls.target);
            off.setLength(off.length() + (this.fit.dist - off.length()) * k);
            this.camera.position.copy(this.controls.target).add(off);
        }
        this.controls.update();

        // olhar: segue o cursor por 4 s depois do último movimento; senão, a câmera
        const now = performance.now() / 1000;
        if (now - this.pointerSeen < 4) {
            this.raycaster.setFromCamera(this.pointer, this.camera);
            this.lookPoint.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, this.fit.dist * 0.72);
        } else this.lookPoint.copy(this.camera.position);
        c.lookAt(this.lookPoint);
        c.update(dt, t);
        this.studio.update(dt, t);
        this.studio.setFocus(this.camera.position.distanceTo(this.controls.target));
    }
}

const app = new Quimera();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init(), { once: true });
} else {
    app.init();
}
