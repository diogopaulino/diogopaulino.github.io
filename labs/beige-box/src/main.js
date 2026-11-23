import { detectSoftwareGL } from '../../shared/gfx/capabilities.js';
/**
 * Beige Box — diorama 3D retrô.
 * Câmera orbital, raycast de interação, luzes PBR e pós-processamento.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import { createTextures } from './textures.js?v=3';
import { buildWorld } from './models.js?v=5';
import { CrtOs } from './crt.js?v=3';
import { DeskAudio } from './audio.js?v=3';

const HOME_CAM = new THREE.Vector3(1.35, 1.22, 1.85);
const HOME_TARGET = new THREE.Vector3(0.02, 0.96, -0.04);
// Pontos de partida da câmera na abertura (reaproveitados: nada é alocado por quadro).
const INTRO_CAM = new THREE.Vector3(1.8, 1.42, 2.05);
const INTRO_TARGET = new THREE.Vector3(0.02, 0.88, 0.05);
const TZ_OFFSET_MS = new Date().getTimezoneOffset() * 60000;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 720;
}

function detectQuality() {
    const mobile = isMobile();
    const soft = detectSoftwareGL();
    if (soft) {
        return { pixelRatio: 1, shadow: 0, bloom: false, aniso: 1, dust: 40, antialias: false, shadows: false };
    }
    if (mobile) {
        return { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.25), shadow: 512, bloom: false, aniso: 2, dust: 70, antialias: false, shadows: true };
    }
    return { pixelRatio: Math.min(window.devicePixelRatio || 1, 2), shadow: 2048, bloom: true, aniso: 8, dust: 240, antialias: true, shadows: true };
}

class BeigeBox {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.dom = {
            hud: document.getElementById('hud'),
            status: document.getElementById('statusLine'),
            tooltip: document.getElementById('tooltip'),
            tipTitle: document.getElementById('tooltipTitle'),
            tipHint: document.getElementById('tooltipHint'),
            loading: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            loadingFill: document.getElementById('loadingFill'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            sound: document.getElementById('soundButton'),
            reset: document.getElementById('resetCamera'),
            keyboard: document.getElementById('keyboardButton'),
            dosInput: document.getElementById('dosInput'),
            hint: document.getElementById('hintBar')
        };
        this.audio = new DeskAudio();
        this.crt = new CrtOs();
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.hover = null;
        this.dragging = false;
        this.intro = 1;
        this.time = 0;
        this.floppyIn = false;
        this.chairSpin = 0;
        this.phoneT = 0;
        this.focus = null;
        this.muted = false;
        this._last = 0; // relógio próprio (THREE.Clock está depreciado)
        this._v = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this.screenDrag = false;
    }

    setLoad(p, text) {
        this.dom.loadingFill.style.width = `${Math.round(p * 100)}%`;
        if (text) this.dom.loadingText.textContent = text;
    }

    fail(msg) {
        this.dom.error.hidden = false;
        this.dom.errorText.textContent = msg;
        this.dom.loading.hidden = true;
    }

    async init() {
        this.setLoad(0.08, 'POST — checando memória…');
        const quality = detectQuality();
        this.quality = quality;

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: !!quality.antialias,
                powerPreference: quality.antialias ? 'high-performance' : 'low-power',
                stencil: false
            });
        } catch {
            this.fail('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        this.renderer.setPixelRatio(quality.pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = quality.shadows !== false && quality.shadow > 0;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x120e0c);
        this.scene.fog = new THREE.FogExp2(0x120e0c, 0.022);

        this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.08, 30);
        this.camera.position.set(1.8, 1.42, 2.05);

        this.setLoad(0.22, 'Gerando texturas PBR…');
        const tex = createTextures(quality.aniso);

        this.setLoad(0.42, 'Montando o 486…');
        this.screenTex = new THREE.CanvasTexture(this.crt.canvas);
        this.screenTex.colorSpace = THREE.SRGBColorSpace;
        this.screenTex.minFilter = THREE.LinearFilter;
        this.screenTex.magFilter = THREE.LinearFilter;
        this.screenTex.generateMipmaps = false;

        const world = buildWorld(tex, this.screenTex, quality.aniso);
        this.scene.add(world.root);
        this.refs = world.refs;
        this.interactives = world.interactives;

        this.setLoad(0.62, 'Acendendo a lua…');
        this.setupLights();
        this.setupParticles();

        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.34;
        pmrem.dispose();

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.07;
        this.controls.target.copy(HOME_TARGET);
        this.controls.minDistance = 0.85;
        this.controls.maxDistance = 3.2;
        this.controls.minPolarAngle = 0.22;
        this.controls.maxPolarAngle = 1.42;
        this.controls.maxAzimuthAngle = Math.PI * 0.92;
        this.controls.minAzimuthAngle = -Math.PI * 0.92;
        this.controls.enablePan = false;

        this.setLoad(0.78, 'Calibrando o fósforo…');
        await this.setupBloom();

        this.bind();
        this.syncBlinds(this.refs.blindsOpen);
        this.syncLamp(true);

        this.renderer.compile(this.scene, this.camera);
        this.setLoad(1, 'CMOS checksum good');
        setTimeout(() => {
            this.dom.loading.hidden = true;
            this.dom.hud.hidden = false;
        }, 420);

        this._last = performance.now();
        this._renderLoop = () => this.frame();
        if (window.LabRuntime) LabRuntime.bindThreeLoop(this.renderer, this._renderLoop);
        else this.renderer.setAnimationLoop(this._renderLoop);
        if (window.LabRuntime) LabRuntime.debounceResize(() => this.resize());
        else window.addEventListener('resize', () => this.resize());
    }

    setupLights() {
        RectAreaLightUniformsLib.init();

        this.hemi = new THREE.HemisphereLight(0x9aaccc, 0x3a2818, 0.48);
        this.scene.add(this.hemi);

        this.moon = new THREE.DirectionalLight(0xb8c8ff, 1.15);
        this.moon.position.set(-4.2, 3.4, 0.6);
        this.moon.castShadow = true;
        this.moon.shadow.mapSize.set(this.quality.shadow, this.quality.shadow);
        this.moon.shadow.camera.near = 0.5;
        this.moon.shadow.camera.far = 12;
        this.moon.shadow.camera.left = -3;
        this.moon.shadow.camera.right = 3;
        this.moon.shadow.camera.top = 3;
        this.moon.shadow.camera.bottom = -3;
        this.moon.shadow.bias = -0.00025;
        this.moon.shadow.normalBias = 0.02;
        this.scene.add(this.moon);

        this.lampLight = new THREE.SpotLight(0xffd8a0, 3.4, 4.2, 0.55, 0.45, 1.1);
        this.lampLight.castShadow = true;
        this.lampLight.shadow.mapSize.set(1024, 1024);
        this.lampLight.shadow.bias = -0.0002;
        this.lampTarget = new THREE.Object3D();
        this.lampTarget.position.set(0.1, 0.74, 0.05);
        this.scene.add(this.lampLight, this.lampTarget);
        this.lampLight.target = this.lampTarget;

        this.crtLight = new THREE.PointLight(0x44ff88, 0, 1.8, 1.6);
        this.scene.add(this.crtLight);

        this.fill = new THREE.PointLight(0xffc8a0, 0.32, 6, 1.2);
        this.fill.position.set(0.4, 1.6, 1.1);
        this.scene.add(this.fill);
        const fill2 = new THREE.PointLight(0xa8b8d8, 0.16, 5, 1.3);
        fill2.position.set(-0.6, 1.8, -0.8);
        this.scene.add(fill2);

        const windowGlow = new THREE.RectAreaLight(0x8899cc, 2.4, 1.3, 1.05);
        windowGlow.position.set(-2.55, 1.45, -0.35);
        windowGlow.lookAt(0, 1.1, -0.2);
        this.scene.add(windowGlow);
        this.windowGlow = windowGlow;
    }

    setupParticles() {
        const n = this.quality.dust;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 3.2;
            pos[i * 3 + 1] = 0.4 + Math.random() * 1.6;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xffe6c4,
            size: 0.007,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        this.scene.add(this.dust);

        const sn = 28;
        const steamPos = new Float32Array(sn * 3);
        this.steamLife = new Float32Array(sn);
        for (let i = 0; i < sn; i++) {
            steamPos[i * 3] = 0.62 + (Math.random() - 0.5) * 0.03;
            steamPos[i * 3 + 1] = 0.84 + Math.random() * 0.12;
            steamPos[i * 3 + 2] = 0.28 + (Math.random() - 0.5) * 0.03;
            this.steamLife[i] = Math.random();
        }
        const sgeo = new THREE.BufferGeometry();
        sgeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
        this.steam = new THREE.Points(sgeo, new THREE.PointsMaterial({
            color: 0xeeddcc,
            size: 0.018,
            transparent: true,
            opacity: 0.22,
            depthWrite: false
        }));
        this.scene.add(this.steam);
    }

    async setupBloom() {
        if (!this.quality.bloom) return;
        try {
            // Bloom é opcional: se os módulos demorarem, segue sem ele (loading nunca trava).
            const modules = Promise.all([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js'),
                import('three/addons/postprocessing/OutputPass.js')
            ]);
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('bloom timeout')), 6000));
            const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.race([modules, timeout]);
            const composer = new EffectComposer(this.renderer);
            composer.setPixelRatio(this.renderer.getPixelRatio());
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.55, 0.9);
            composer.addPass(bloom);
            composer.addPass(new OutputPass());
            this.composer = composer;
        } catch {
            this.composer = null;
        }
    }

    /** Raycast só contra a tela do CRT; devolve uv ou null. */
    screenUv(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObject(this.refs.screenMesh, false)[0];
        return hit && hit.uv ? hit.uv : null;
    }

    endScreenDrag() {
        if (!this.screenDrag) return;
        this.screenDrag = false;
        this.crt.pointerUp();
        this.canvas.classList.remove('is-drag');
    }

    bind() {
        const canvas = this.canvas;

        /* Arrastar janelas do Nexus 95: ouvinte em captura roda ANTES do
           OrbitControls no mesmo elemento, então dá para desligar a órbita
           antes que ela comece a girar a câmera. */
        canvas.addEventListener('pointerdown', (e) => {
            // Safari/iOS: toque pode chegar com button === -1.
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !this.crt.power || this.crt.mode !== 'win') return;
            const uv = this.screenUv(e);
            if (!uv || !this.crt.pointerDown(uv.x, uv.y)) return;
            this.screenDrag = true;
            this.controls.enabled = false;
            this.audio.click();
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch {
                /* segue sem captura */
            }
        }, true);
        canvas.addEventListener('pointermove', (e) => {
            if (!this.screenDrag) return;
            const uv = this.screenUv(e);
            if (uv) this.crt.pointerMove(uv.x, uv.y);
        });
        canvas.addEventListener('pointercancel', () => this.endScreenDrag());
        canvas.addEventListener('lostpointercapture', () => this.endScreenDrag());
        window.addEventListener('blur', () => this.endScreenDrag());

        canvas.addEventListener('pointermove', (e) => {
            if (e.buttons > 0 && this._downX !== undefined) {
                const dx = e.clientX - this._downX;
                const dy = e.clientY - this._downY;
                if (Math.hypot(dx, dy) >= 6) this.dragging = true;
            }
            this.onMove(e);
        });
        canvas.addEventListener('pointerdown', (e) => {
            this.dragging = false;
            this._downX = e.clientX;
            this._downY = e.clientY;
            canvas.classList.add('is-drag');
        });
        canvas.addEventListener('pointerup', (e) => {
            canvas.classList.remove('is-drag');
            if (this.screenDrag) {
                this.endScreenDrag();
                this.dragging = false;
                return;
            }
            const dx = e.clientX - (this._downX ?? e.clientX);
            const dy = e.clientY - (this._downY ?? e.clientY);
            if (!this.dragging && Math.hypot(dx, dy) < 6) this.onClick(e);
            this.dragging = false;
        });
        canvas.addEventListener('pointerleave', () => {
            this.setHover(null);
            this.crt.hover(null);
        });

        this.controls.addEventListener('change', () => {
            if (this._downX !== undefined && this.canvas.classList.contains('is-drag')) {
                this.dragging = true;
            }
        });

        window.addEventListener('keydown', (e) => this.onKey(e));

        document.querySelectorAll('.dos-chip[data-cmd]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.runQuickCommand(btn.dataset.cmd);
            });
        });

        this.dom.sound.addEventListener('click', () => {
            this.audio.init();
            this.muted = !this.muted;
            this.audio.setEnabled(!this.muted);
            this.dom.sound.setAttribute('aria-pressed', this.muted ? 'false' : 'true');
        });
        this.dom.reset.addEventListener('click', () => this.resetCamera());
        this.bindMobileKeyboard();
        if (window.matchMedia('(pointer: coarse)').matches && this.dom.hint) {
            this.dom.hint.textContent = 'Arraste para orbitar · pinça para zoom · toque para mexer';
        }

        const unlock = () => {
            this.audio.init();
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('touchstart', unlock, { passive: true });
        this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    }

    /**
     * Celular não tem teclado físico: o botão ⌨ liga o PC (se preciso), pula a
     * BIOS e foca um <input> invisível. O que for digitado vai para o DOS ou
     * para o Bloco de Notas, igual ao teclado de mesa.
     */
    bindMobileKeyboard() {
        const input = this.dom.dosInput;
        const btn = this.dom.keyboard;
        if (!input || !btn) return;
        const send = (ch) => {
            this.crt.type(ch);
            this.audio.key();
            this.pressKey(Math.floor(Math.random() * (this.refs.keyPositions.length || 1)));
        };
        btn.addEventListener('click', () => {
            this.audio.init();
            if (!this.crt.power) this.togglePower();
            this.crt.skipBoot();
            if (this.crt.mode === 'saver') this.crt.mode = 'win';
            input.value = '';
            input.focus({ preventScroll: true });
            this.say(this.crt.mode === 'win'
                ? 'Teclado ligado ao Bloco de Notas. Iniciar → Prompt do MS-DOS volta ao DOS.'
                : 'Teclado pronto. Experimente HELP, DIR ou WIN.');
        });
        input.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'deleteContentBackward') {
                e.preventDefault();
                send('Backspace');
            } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
                e.preventDefault();
                send('Enter');
            }
        });
        input.addEventListener('input', () => {
            const text = input.value;
            input.value = '';
            for (const ch of text) send(ch);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                send('Enter');
            } else if (e.key === 'Backspace' && !input.value) {
                e.preventDefault();
                send('Backspace');
            } else if (e.key === 'Escape') {
                input.blur();
            }
        });
    }

    runQuickCommand(cmd) {
        if (!cmd) return;
        this.audio.init();
        if (!this.crt.power) {
            this.togglePower();
        }
        if (cmd.toUpperCase() === 'SECRET' && !this.floppyIn) {
            this.insertFloppy();
        }
        this.crt.skipBoot();
        if (this.crt.mode === 'win' || this.crt.mode === 'saver') {
            this.crt.mode = 'dos';
        }
        this.crt.input = '';
        for (const ch of cmd) {
            this.crt.type(ch);
        }
        this.crt.type('Enter');
        this.audio.key();
        this.pressKey(Math.floor(Math.random() * (this.refs.keyPositions.length || 1)));
        this.say(`Comando ${cmd} enviado ao CRT.`);
    }

    onMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(this.interactives, true);
        const hit = hits.find((h) => h.object.userData.iid);
        this.setHover(hit ? hit.object.userData.iid : null);
        this.canvas.classList.toggle('is-hover', Boolean(hit));
        if (e.pointerType === 'mouse') {
            const onScreen = hit && hit.object === this.refs.screenMesh && hit.uv;
            this.crt.hover(onScreen ? hit.uv.x : null, onScreen ? hit.uv.y : 0);
        }
    }

    setHover(id) {
        if (this.hover === id) return;
        this.hover = id;
        if (!id) {
            this.dom.tooltip.hidden = true;
            return;
        }
        const obj = this.interactives.find((o) => o.userData.interactive?.id === id);
        const info = obj?.userData.interactive;
        if (!info) return;
        this.dom.tipTitle.textContent = info.label;
        this.dom.tipHint.textContent = info.hint;
        this.dom.tooltip.hidden = false;
    }

    onClick(e) {
        this.audio.init();
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(this.interactives, true);
        const hit = hits.find((h) => h.object.userData.iid);
        if (!hit) return;
        this.interact(hit.object.userData.iid, hit);
    }

    say(text) {
        this.dom.status.textContent = text;
    }

    interact(id, hit) {
        const refs = this.refs;

        if (id === 'crt' || id === 'tower') {
            if (hit.object === refs.screenMesh && this.crt.power) {
                const uv = hit.uv;
                if (uv) this.crt.click(uv.x, uv.y);
                this.audio.click();
                this.say(this.crt.mode === 'win' ? 'Nexus 95 — clique nos ícones da área de trabalho.' : 'O fósforo escuta o mouse.');
                return;
            }
            if (hit.object === refs.cdTray || hit.object === refs.cdBay) {
                this.toggleTray();
                return;
            }
            if (hit.object === refs.driveSlot) {
                if (this.floppyIn) this.ejectFloppy();
                else this.say('Pegue o disquete SECRET na mesa e clique nele.');
                return;
            }
            if (hit.object === refs.towerPower || hit.object === refs.crtPower) {
                this.togglePower();
                return;
            }
            this.togglePower();
            return;
        }

        if (id === 'floppy') {
            if (this.floppyIn) this.ejectFloppy();
            else this.insertFloppy();
            return;
        }
        if (id === 'lamp') {
            this.syncLamp(!refs.lampOn);
            this.audio.lamp();
            this.say(refs.lampOn ? 'A luminária aquece o plástico bege.' : 'Só a lua resta. O quarto muda de humor.');
            return;
        }
        if (id === 'blinds') {
            refs.blindsOpen = refs.blindsOpen > 0.5 ? 0.08 : 0.85;
            this.audio.blinds();
            this.say(refs.blindsOpen > 0.5 ? 'A lua entra inteira.' : 'Persianas quase fechadas.');
            return;
        }
        if (id === 'walkman') {
            const on = this.audio.toggleWalkman();
            refs.walkmanPlay.material.emissive = new THREE.Color(on ? 0xff2222 : 0x000000);
            refs.walkmanPlay.material.emissiveIntensity = on ? 0.8 : 0;
            this.say(on ? 'Fita A — chiptune vazando pelos fones.' : 'Walkman pausado. Clique para play.');
            this.audio.click();
            return;
        }
        if (id === 'phone') {
            this.audio.phone();
            this.phoneT = 2.2;
            this.say('Trriim-trriim. Ninguém do outro lado — só o eco de 1994.');
            return;
        }
        if (id === 'chair') {
            this.chairSpin += Math.PI * 1.4;
            this.audio.chair();
            this.say('A cadeira gira. O gás ainda segura.');
            return;
        }
        if (id === 'fan') {
            refs.fanOn = !refs.fanOn;
            this.audio.click();
            this.say(refs.fanOn ? 'O ventilador volta a varrer o quarto.' : 'Pás paradas. O pó dança mais devagar.');
            return;
        }
        if (id === 'joystick') {
            refs.joystick.rotation.z = (Math.random() - 0.5) * 0.6;
            refs.joystick.rotation.x = (Math.random() - 0.5) * 0.5;
            this.audio.click();
            this.say('Wiggle. Se DOOM estivesse no disquete…');
            return;
        }
        if (id === 'keyboard') {
            this.audio.key();
            this.pressKey(Math.floor(Math.random() * (refs.keyPositions.length || 1)));
            if (this.crt.power && this.crt.mode === 'dos') this.say('O teclado físico também fala com o DOS. Experimente HELP.');
            else this.say('Teclas amarelas de tanto café.');
            return;
        }
        if (id === 'mouse') {
            this.audio.click();
            if (this.crt.power) this.crt.click(0.2, 0.85);
            this.say('A bolinha arrasta poeira e pixels.');
            return;
        }
        if (id === 'gameboy') {
            refs.gbOn = !refs.gbOn;
            refs.gbLcd.material.emissiveIntensity = refs.gbOn ? 1.1 : 0.2;
            refs.gbLcd.material.color.set(refs.gbOn ? 0xc8e878 : 0x8aa878);
            this.audio.click();
            this.say(refs.gbOn ? 'Tetris. O bloco J não cabe. Nunca cabe.' : 'Game Boy dormindo.');
            return;
        }
        if (id === 'clock') {
            this.say(`São ${new Date().toLocaleTimeString('pt-BR')} — o relógio ainda é pontual.`);
            this.focusObject(hit.object);
            return;
        }
        if (id === 'mug') {
            this.say('Café de 1994. O vapor insiste em existir.');
            return;
        }
        if (id === 'sticky') {
            this.say('senha: hunter2. O post-it nunca mente.');
            return;
        }
        if (id === 'calendar') {
            this.say('14 de agosto de 1994 está circulado. Alguma coisa ia acontecer.');
            this.focusObject(hit.object);
            return;
        }
        if (id === 'poster-band') {
            this.say('Static Hearts, turnê 94. A senha do SECRET está no refrão.');
            this.focusObject(hit.object);
            return;
        }
        if (id === 'poster-os') {
            this.say('Where do you want to go today?  —  Ligar o CRT e digitar WIN.');
            this.focusObject(hit.object);
            return;
        }
        if (id === 'poster-disk') {
            this.say('Diskette Fest 94. Disquetes na mesa, memórias na unidade A.');
            this.focusObject(hit.object);
            return;
        }
        if (id === 'books') {
            this.say('MS-DOS 6.22 User\'s Guide. HIMEM.SYS ainda é lei.');
            return;
        }
        if (id === 'floppy-stack') {
            this.say('SYSTEM, WORK, DOOM. O SECRET está solto na mesa.');
            return;
        }
        if (id === 'tapes') {
            this.say('K7s gravadas do rádio, com a introdução cortada.');
            return;
        }
        if (id === 'plant') {
            this.say('Regada uma vez por década. Imortal.');
            return;
        }
        if (id === 'speaker') {
            this.say('1 watt RMS de glória. O Walkman usa o mesmo universo sonoro.');
            return;
        }
        this.audio.click();
    }

    togglePower() {
        const on = this.crt.togglePower();
        if (on) {
            this.audio.crtOn();
            this.say('POST. 640K OK. O fósforo acende em verde.');
        } else {
            this.audio.crtOff();
            this.say('O CRT apaga. Ainda dá para ouvir o capacitor.');
        }
        this.refs.powerLed.material.emissiveIntensity = on ? 1.2 : 0;
        this.refs.crtLed.material.emissiveIntensity = on ? 1.4 : 0;
    }

    insertFloppy() {
        if (this.floppyIn) return;
        this.floppyIn = true;
        this.floppyAnim = 1;
        this.audio.floppySeek();
        this.crt.insertFloppy(this.refs.floppy.userData.label || 'SECRET');
        this.say('Disquete SECRET na unidade A:. No DOS, digite SECRET.');
    }

    ejectFloppy() {
        if (!this.floppyIn) return;
        this.floppyIn = false;
        this.floppyAnim = 1;
        this.audio.floppyEject();
        this.crt.ejectFloppy();
        this.say('Eject. O metal da portinhola ainda faz aquele clique.');
    }

    toggleTray() {
        this.refs.cdOpen = !this.refs.cdOpen;
        this.audio.tray();
        this.say(this.refs.cdOpen ? 'Bandeja do CD. Não há disco — só o vazio de 1994.' : 'Bandeja recolhida.');
    }

    syncLamp(on) {
        this.refs.lampOn = on;
        this.lampLight.intensity = on ? 3.4 : 0;
        this.refs.lampBulb.material.emissiveIntensity = on ? 1.8 : 0.05;
        this.renderer.toneMappingExposure = on ? 1.05 : 0.82;
    }

    syncBlinds(open) {
        this.refs.blindsOpen = open;
    }

    pressKey(i) {
        this.refs.keyPress = i;
        this.refs.keyPressT = 0.12;
    }

    focusObject(obj) {
        obj.getWorldPosition(this._v);
        this.focus = {
            target: this._v.clone(),
            t: 0
        };
    }

    resetCamera() {
        this.focus = {
            target: HOME_TARGET.clone(),
            cam: HOME_CAM.clone(),
            t: 0
        };
        this.say('Câmera de volta à mesa.');
    }

    onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
        if (['Enter', ' '].includes(e.key) && e.target.closest?.('button, a')) return;
        if (e.repeat && e.key !== 'Backspace') return;
        if (e.key === 'm' || e.key === 'M') {
            if (this.crt.mode === 'dos' && this.crt.power) {
                /* deixa o DOS receber M */
            } else {
                this.dom.sound.click();
                return;
            }
        }
        if (e.key === 'r' || e.key === 'R') {
            if (!(this.crt.power && this.crt.mode === 'dos')) {
                this.resetCamera();
                return;
            }
        }
        if (e.key === 'Escape' && this.crt.mode === 'win') {
            this.crt.mode = 'dos';
            this.say('Alt+F4 emocional. De volta ao prompt.');
            return;
        }
        if (!this.crt.power) return;
        if (e.key === 'Enter' || e.key === 'Backspace' || e.key.length === 1) {
            e.preventDefault();
            this.crt.type(e.key);
            this.audio.key();
            this.pressKey(Math.floor(Math.random() * (this.refs.keyPositions.length || 1)));
        }
    }

    frame() {
        if (document.hidden) return;
        const tNow = performance.now();
        // dt limitado a 50 ms: voltar de outra aba não dá um “salto” na animação.
        const dt = Math.min(0.05, Math.max(0, (tNow - this._last) / 1000));
        this._last = tNow;
        this.time += dt;

        this.controls.enabled = this.intro <= 0 && !this.focus && !this.screenDrag;
        if (this.intro > 0) {
            this.intro = Math.max(0, this.intro - dt * 0.35);
            const k = 1 - Math.pow(this.intro, 2);
            this.camera.position.lerpVectors(INTRO_CAM, HOME_CAM, k);
            this.controls.target.lerpVectors(INTRO_TARGET, HOME_TARGET, k);
        }

        if (this.focus) {
            this.focus.t += dt;
            const k = 1 - Math.exp(-dt * 4.2);
            this.controls.target.lerp(this.focus.target, k);
            if (this.focus.cam) this.camera.position.lerp(this.focus.cam, k);
            if (this.focus.t > 1.4) this.focus = null;
        }

        this.controls.update();
        this.crt.update(dt);
        // Só sobe a textura 640×480 quando o CRT realmente repintou.
        if (this.crt.draw()) this.screenTex.needsUpdate = true;
        // Cintilação do fósforo feita na cor do material (grátis, sem upload).
        if (this.refs.screenMat && !REDUCED_MOTION) {
            const flick = this.crt.power
                ? 0.97 + Math.sin(this.time * 7.3) * 0.015 + (Math.random() < 0.02 ? -0.04 : 0)
                : 1;
            this.refs.screenMat.color.setScalar(flick);
        }
        if (this.refs.screenTime) this.refs.screenTime.value = this.time;

        const col = this.crt.averageColor();
        this.crtLight.color.setRGB(col.r, col.g, col.b);
        this.crtLight.intensity = this.crt.power ? 1.35 : 0;
        this.refs.screenMesh.getWorldPosition(this._v);
        this.crtLight.position.copy(this._v);
        this.crtLight.position.z += 0.12;

        this.refs.lampHead.getWorldPosition(this._v);
        this.lampLight.position.copy(this._v);

        const open = this.refs.blindsOpen;
        this.refs.blindSlats.forEach((s) => {
            s.rotation.x += (open * 0.95 - s.rotation.x) * Math.min(1, dt * 4);
        });
        this.moon.intensity = 0.35 + open * 0.9;
        this.windowGlow.intensity = 1.2 + open * 1.4;

        this.refs.cdTray.position.z += ((this.refs.cdOpen ? 0.22 : 0.12) - this.refs.cdTray.position.z) * Math.min(1, dt * 5);

        if (this.floppyAnim > 0) {
            this.floppyAnim -= dt;
            const f = this.refs.floppy;
            if (this.floppyIn) {
                this.refs.driveSlot.getWorldPosition(this._v);
                this._v.z += 0.02;
                f.position.lerp(f.parent.worldToLocal(this._v2.copy(this._v)), Math.min(1, dt * 6));
                f.rotation.x += (0 - f.rotation.x) * dt * 6;
                f.rotation.y += (0 - f.rotation.y) * dt * 6;
                if (this.floppyAnim <= 0) f.visible = false;
            } else {
                f.visible = true;
                f.position.lerp(this.refs.floppyHome, Math.min(1, dt * 6));
                f.rotation.y += (this.refs.floppyHomeRot.y - f.rotation.y) * dt * 6;
            }
        }

        if (this.chairSpin > 0) {
            const step = Math.min(this.chairSpin, dt * 4.5);
            this.refs.chair.rotation.y += step;
            this.chairSpin -= step;
        }

        if (this.phoneT > 0) {
            this.phoneT -= dt;
            this.refs.handset.position.y = 0.03 + Math.min(1, this.phoneT) * 0.08;
            this.refs.handset.rotation.z = Math.min(1, this.phoneT) * 0.4;
            if (this.phoneT <= 0) {
                this.refs.handset.position.y = 0.03;
                this.refs.handset.rotation.z = 0;
            }
        }

        this.refs.joystick.rotation.x += (0 - this.refs.joystick.rotation.x) * dt * 3;
        this.refs.joystick.rotation.z += (0 - this.refs.joystick.rotation.z) * dt * 3;

        if (this.refs.fanOn) {
            this.refs.fanBlades.rotation.z += dt * 14;
            this.refs.fanHead.rotation.y = Math.sin(this.time * 0.5) * 0.7;
        }

        // Hora local sem alocar Date por quadro: segundos desde a meia-noite local.
        const local = ((Date.now() - TZ_OFFSET_MS) / 1000) % 86400;
        const s = local % 60;
        const m = (local / 60) % 60;
        const h = (local / 3600) % 12;
        const { hour, minute, second } = this.refs.clockHands;
        hour.rotation.z = -h / 12 * Math.PI * 2;
        minute.rotation.z = -m / 60 * Math.PI * 2;
        second.rotation.z = -s / 60 * Math.PI * 2;

        if (this.refs.keyPress >= 0 && this.refs.keys) {
            this.refs.keyPressT -= dt;
            const dummy = this.refs.keyDummy;
            const p = this.refs.keyPositions[this.refs.keyPress];
            dummy.position.copy(p);
            dummy.position.y = p.y - (this.refs.keyPressT > 0 ? 0.004 : 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.refs.keys.setMatrixAt(this.refs.keyPress, dummy.matrix);
            this.refs.keys.instanceMatrix.needsUpdate = true;
            if (this.refs.keyPressT <= 0) this.refs.keyPress = -1;
        }

        if (this.crt.power) {
            this.refs.hddLed.material.emissiveIntensity = Math.random() > 0.72 ? 1.4 : 0.15;
            if (Math.random() > 0.97) this.audio.hdd();
        } else {
            this.refs.hddLed.material.emissiveIntensity = 0;
        }

        const dpos = this.dust.geometry.attributes.position;
        for (let i = 0; i < dpos.count; i++) {
            let y = dpos.getY(i) + dt * 0.03 * (0.4 + (i % 5) * 0.1);
            if (y > 2.1) y = 0.35;
            dpos.setY(i, y);
            dpos.setX(i, dpos.getX(i) + Math.sin(this.time * 0.4 + i) * dt * 0.01);
        }
        dpos.needsUpdate = true;
        this.dust.material.opacity = 0.12 + (this.refs.lampOn ? 0.18 : 0.06);

        const spos = this.steam.geometry.attributes.position;
        for (let i = 0; i < spos.count; i++) {
            this.steamLife[i] += dt * 0.35;
            if (this.steamLife[i] > 1) {
                this.steamLife[i] = 0;
                spos.setXYZ(i, 0.62 + (Math.random() - 0.5) * 0.02, 0.84, 0.28 + (Math.random() - 0.5) * 0.02);
            } else {
                spos.setY(i, 0.84 + this.steamLife[i] * 0.16);
                spos.setX(i, spos.getX(i) + Math.sin(this.time * 2 + i) * dt * 0.02);
            }
        }
        spos.needsUpdate = true;

        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        if (this.composer) this.composer.setSize(w, h);
    }
}

const app = new BeigeBox();
app.init().catch((err) => {
    console.error(err);
    app.fail(err?.message || 'Falha ao montar o quarto.');
});
