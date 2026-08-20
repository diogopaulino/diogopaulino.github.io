/**
 * Mimo — laço principal: casa, câmera orbital, criação do pet e ações de cuidado.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import { QUALITY, LIGHT, ACTIONS, breedById } from './config.js';
import { clamp, detectMobile, detectSoftwareGL, rendererIsSoftware } from './utils.js';
import { Pet } from './pet.js';
import { buildRoom, updateRoom } from './room.js';
import { Effects } from './effects.js';
import { MimoAudio } from './audio.js';
import { Hud } from './hud.js';
import {
    defaultProfile, loadProfile, saveProfile, clearProfile,
    tickNeeds, applyAction
} from './state.js';

const $ = (sel) => document.querySelector(sel);
const HOME_CAM = new THREE.Vector3(1.85, 1.28, 2.35);
const HOME_TARGET = new THREE.Vector3(0, 0.42, 0.1);
const TMP = new THREE.Vector3();

function resolveQuality(choice) {
    if (choice && choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
    if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
    const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
    return big ? QUALITY.high : QUALITY.medium;
}

class Mimo {
    constructor() {
        this.canvas = $('#scene');
        this.hud = new Hud();
        this.audio = new MimoAudio();
        this.profile = loadProfile() || defaultProfile();
        this.draft = { ...this.profile };
        this.mode = 'boot';
        this.paused = false;
        this.busy = false;
        this.time = 0;
        this.saveAcc = 0;
        this.hudAcc = 0;
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.settings = this.loadSettings();
        this._head = new THREE.Vector3();
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false };
        try {
            const raw = localStorage.getItem('mimo-settings');
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch {
            return fallback;
        }
    }

    saveSettings() {
        try { localStorage.setItem('mimo-settings', JSON.stringify(this.settings)); } catch { /* */ }
    }

    async init() {
        window.LabShell?.init();
        this.hud.setLoading(0.08, 'Abrindo as cortinas…');
        this.quality = resolveQuality(this.settings.quality);
        this.mobile = detectMobile();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.id !== 'low',
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch {
            this.hud.showError('Não foi possível criar o contexto WebGL.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = LIGHT.exposure;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(LIGHT.clear);

        if (rendererIsSoftware(this.renderer) && this.quality.id !== 'low') {
            this.quality = QUALITY.low;
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x241c18);
        this.scene.fog = new THREE.Fog(0x2a221c, 6.5, 14);

        this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 40);
        this.camera.position.copy(HOME_CAM);

        this.hud.setLoading(0.28, 'Ajeitando o tapete…');
        const room = buildRoom(this.quality);
        this.scene.add(room.root);
        this.refs = room.refs;

        this.hud.setLoading(0.48, 'Chamando o pet…');
        this.pet = new Pet(this.profile, this.quality);
        this.scene.add(this.pet.root);

        this.effects = new Effects(this.scene);
        this.setupLights();

        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
        this.scene.environmentIntensity = 0.42;
        pmrem.dispose();

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.target.copy(HOME_TARGET);
        this.controls.minDistance = 1.15;
        this.controls.maxDistance = 4.2;
        this.controls.minPolarAngle = 0.35;
        this.controls.maxPolarAngle = 1.38;
        this.controls.enablePan = false;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.55;

        this.hud.setLoading(0.72, 'Luz da janela…');
        await this.setupBloom();
        this.bind();

        const qSel = $('#qualitySelect');
        const vol = $('#volumeSlider');
        if (qSel) qSel.value = this.settings.quality;
        if (vol) {
            vol.value = this.settings.volume;
            $('#volumeValue').textContent = this.settings.volume;
        }
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);

        this.hud.fillBreeds(this.draft.species, this.draft.breed);
        this.hud.fillCoats(this.draft.coat);
        if (this.hud.els.nameInput) this.hud.els.nameInput.value = this.draft.name;

        this.renderer.compile(this.scene, this.camera);
        this.hud.setLoading(1, 'Tudo pronto.');
        setTimeout(() => {
            this.hud.hideLoading();
            const saved = loadProfile();
            if (saved) this.hud.showWelcome(saved);
            else this.enterCreate();
        }, 420);

        this.clock = new THREE.Clock();
        this._renderLoop = () => this.frame();
        if (window.LabRuntime) LabRuntime.bindThreeLoop(this.renderer, this._renderLoop);
        else this.renderer.setAnimationLoop(this._renderLoop);
        window.addEventListener('resize', () => this.resize());
    }

    setupLights() {
        RectAreaLightUniformsLib.init();
        this.scene.add(new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, 0.55));

        const sun = new THREE.DirectionalLight(LIGHT.sun, 2.15);
        sun.position.set(-0.4, 3.4, -4.2);
        sun.castShadow = this.quality.shadows;
        sun.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 14;
        sun.shadow.camera.left = -4;
        sun.shadow.camera.right = 4;
        sun.shadow.camera.top = 4;
        sun.shadow.camera.bottom = -4;
        sun.shadow.bias = -0.0003;
        sun.shadow.normalBias = 0.025;
        this.scene.add(sun);

        const windowLight = new THREE.RectAreaLight(0xffe0b8, 6.5, 2.0, 1.5);
        windowLight.position.set(0, 1.55, -2.45);
        windowLight.lookAt(0, 0.8, 0);
        this.scene.add(windowLight);

        const lamp = new THREE.PointLight(0xffd0a0, 1.15, 5.5, 1.4);
        lamp.position.set(2.4, 1.35, -1.7);
        this.scene.add(lamp);

        const fill = new THREE.PointLight(0xc8d8f0, 0.28, 7, 1.2);
        fill.position.set(-1.4, 2.1, 1.4);
        this.scene.add(fill);
    }

    async setupBloom() {
        if (!this.quality.bloom) return;
        try {
            const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js'),
                import('three/addons/postprocessing/OutputPass.js')
            ]);
            const composer = new EffectComposer(this.renderer);
            composer.setPixelRatio(this.renderer.getPixelRatio());
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.5, 0.86));
            composer.addPass(new OutputPass());
            this.composer = composer;
        } catch {
            this.composer = null;
        }
    }

    bind() {
        $('#continueButton')?.addEventListener('click', () => this.enterCare(true));
        $('#newPetButton')?.addEventListener('click', () => this.enterCreate());
        $('#arriveButton')?.addEventListener('click', () => this.commitCreate());
        $('#resumeButton')?.addEventListener('click', () => this.setPaused(false));
        $('#pauseMenuButton')?.addEventListener('click', () => {
            this.setPaused(false);
            this.hud.showWelcome(this.profile);
            this.mode = 'welcome';
            this.controls.autoRotate = true;
        });
        $('#resetPetButton')?.addEventListener('click', () => {
            clearProfile();
            this.enterCreate();
        });

        document.querySelectorAll('[data-create-step]').forEach((btn) => {
            btn.addEventListener('click', () => this.hud.setCreateStep(btn.dataset.createStep));
        });
        document.querySelectorAll('[data-species]').forEach((btn) => {
            btn.addEventListener('click', () => this.pickSpecies(btn.dataset.species));
        });
        this.hud.els.breedGrid?.addEventListener('click', (e) => {
            const card = e.target.closest('[data-breed]');
            if (card) this.pickBreed(card.dataset.breed);
        });
        this.hud.els.coatGrid?.addEventListener('click', (e) => {
            const sw = e.target.closest('[data-coat]');
            if (sw) this.pickCoat(sw.dataset.coat);
        });
        this.hud.els.nameInput?.addEventListener('input', (e) => {
            this.draft.name = e.target.value.slice(0, 16);
        });

        $('#actionDock')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (btn) this.doAction(btn.dataset.action);
        });

        this.hud.els.sound?.addEventListener('click', () => {
            this.settings.muted = !this.settings.muted;
            this.audio.setEnabled(!this.settings.muted);
            this.hud.setMuted(this.settings.muted);
            this.saveSettings();
        });
        this.hud.els.pauseBtn?.addEventListener('click', () => this.setPaused(true));

        $('#qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            this.hud.say('Qualidade na próxima visita.');
        });
        $('#volumeSlider')?.addEventListener('input', (e) => {
            this.settings.volume = Number(e.target.value);
            $('#volumeValue').textContent = this.settings.volume;
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });

        this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
        this.canvas.addEventListener('pointerup', (e) => this.onUp(e));

        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') this.setPaused(!this.paused);
            if (e.key === 'm' || e.key === 'M') this.hud.els.sound?.click();
            if (e.key === 'Escape' && this.mode === 'care') this.setPaused(true);
        });

        document.addEventListener('pointerdown', () => this.audio.resume(), { once: true });
    }

    pickSpecies(species) {
        this.draft.species = species;
        const list = species === 'cat'
            ? ['siamese', 'persian', 'mainecoon', 'orange', 'black', 'ragdoll', 'british', 'calico']
            : ['golden', 'labrador', 'shiba', 'poodle', 'bulldog', 'husky', 'dachshund', 'collie'];
        if (!list.includes(this.draft.breed)) this.draft.breed = list[0];
        const b = breedById(species, this.draft.breed);
        this.draft.coat = b.coat;
        this.draft.name = b.names[0];
        if (this.hud.els.nameInput) this.hud.els.nameInput.value = this.draft.name;
        this.hud.fillBreeds(species, this.draft.breed);
        this.hud.fillCoats(this.draft.coat);
        document.querySelectorAll('[data-species]').forEach((el) => {
            el.classList.toggle('is-on', el.dataset.species === species);
        });
        this.rebuildDraft();
        this.hud.setCreateStep('breed');
        this.audio.chirp(species);
    }

    pickBreed(id) {
        this.draft.breed = id;
        const b = breedById(this.draft.species, id);
        this.draft.coat = b.coat;
        if (!this.hud.els.nameInput?.value || b.names.includes(this.draft.name)) {
            this.draft.name = b.names[Math.floor(Math.random() * b.names.length)];
            if (this.hud.els.nameInput) this.hud.els.nameInput.value = this.draft.name;
        }
        this.hud.fillBreeds(this.draft.species, id);
        this.hud.fillCoats(this.draft.coat);
        this.rebuildDraft();
        this.audio.chime();
    }

    pickCoat(id) {
        this.draft.coat = id;
        this.hud.fillCoats(id);
        this.rebuildDraft();
    }

    rebuildDraft() {
        this.pet.rebuild({ ...this.draft, needs: this.profile.needs });
    }

    enterCreate() {
        this.mode = 'create';
        this.paused = false;
        this.hud.setPaused(false);
        this.draft = {
            species: 'dog',
            breed: 'golden',
            coat: 'gold',
            name: 'Mel',
            bornAt: Date.now(),
            needs: { hunger: 80, joy: 85, hygiene: 95, energy: 88, love: 80 }
        };
        this.hud.fillBreeds('dog', 'golden');
        this.hud.fillCoats('gold');
        if (this.hud.els.nameInput) this.hud.els.nameInput.value = 'Mel';
        document.querySelectorAll('[data-species]').forEach((el) => {
            el.classList.toggle('is-on', el.dataset.species === 'dog');
        });
        this.rebuildDraft();
        this.hud.showCreate();
        this.controls.autoRotate = true;
        this.pet.setAction('idle');
        if (this.refs.tub) this.refs.tub.visible = false;
    }

    commitCreate() {
        const name = (this.hud.els.nameInput?.value || this.draft.name || 'Mimo').trim().slice(0, 16);
        if (!name) {
            this.hud.els.nameInput?.focus();
            return;
        }
        this.draft.name = name;
        this.profile = {
            ...this.draft,
            bornAt: Date.now(),
            needs: { hunger: 80, joy: 88, hygiene: 95, energy: 90, love: 82 }
        };
        saveProfile(this.profile);
        this.pet.rebuild(this.profile);
        this.enterCare(false);
        this.hud.say(`${this.profile.name} chegou em casa.`);
        this.audio.chime();
        this.audio.chirp(this.profile.species);
    }

    enterCare(fromSave) {
        this.mode = 'care';
        this.paused = false;
        this.controls.autoRotate = false;
        this.hud.showCare();
        this.hud.syncProfile(this.profile);
        this.pet.setAction('idle');
        if (this.refs.tub) this.refs.tub.visible = false;
        this.audio.resume();
        if (fromSave) this.hud.say(`${this.profile.name} sentiu sua falta.`);
        document.body.dataset.state = 'care';
    }

    setPaused(on) {
        if (this.mode !== 'care' && on) return;
        this.paused = on;
        this.hud.setPaused(on);
        this.controls.enabled = !on;
    }

    hitPet(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        return this.raycaster.intersectObject(this.pet.root, true).length > 0;
    }

    onDown(e) {
        this._down = { x: e.clientX, y: e.clientY, pet: this.hitPet(e) };
    }

    onUp(e) {
        if (!this._down || this.mode !== 'care' || this.paused) return;
        const dx = e.clientX - this._down.x;
        const dy = e.clientY - this._down.y;
        if (Math.hypot(dx, dy) < 8 && this._down.pet) this.doAction('pet');
        this._down = null;
    }

    doAction(id) {
        if (this.mode !== 'care' || this.paused) return;
        if (this.busy && id !== 'pet') return;
        const spec = ACTIONS[id];
        if (!spec) return;

        if (id === 'pet') {
            this.profile.needs = applyAction(this.profile.needs, 'pet');
            this.pet.setAction('pet');
            this.pet.headWorld(this._head);
            this.effects.love(this._head.clone().add(TMP.set(0, 0.12, 0)));
            this.audio.chime();
            if (this.profile.species === 'cat') this.audio.startPurr();
            else this.audio.chirp('dog');
            this.hud.say(`Carinho em ${this.profile.name}.`);
            this.hud.syncProfile(this.profile);
            saveProfile(this.profile);
            setTimeout(() => {
                if (this.pet.action === 'pet') this.pet.setAction('idle');
                this.audio.stopPurr();
            }, 700);
            return;
        }

        this.busy = true;
        this.hud.setBusy(true);
        this.profile.needs = applyAction(this.profile.needs, id);
        saveProfile(this.profile);

        if (id === 'feed') {
            this.pet.setAction('eat');
            this.audio.eat();
            this.pet.headWorld(this._head);
            this.effects.eat(this._head.clone());
            this.hud.say(`${this.profile.name} está comendo.`);
            this.tweenCam(new THREE.Vector3(1.1, 0.85, 1.6), new THREE.Vector3(0, 0.3, 0.2), spec.duration);
        } else if (id === 'treat') {
            this.pet.setAction('eat');
            this.audio.eat();
            this.hud.say('Um petisco!');
        } else if (id === 'play') {
            this.pet.setAction('play');
            this.audio.chirp(this.profile.species);
            this.hud.say(this.profile.species === 'cat' ? 'Novelo voando!' : 'Pega a bolinha!');
        } else if (id === 'bath') {
            if (this.refs.tub) this.refs.tub.visible = true;
            this.pet.setAction('bath');
            this.pet.setWet(1);
            this.audio.water();
            this.pet.headWorld(this._head);
            this.effects.splash(this._head.clone());
            this.effects.foam(this._head.clone().add(TMP.set(0, 0.1, 0)));
            this.hud.say('Banho quentinho.');
            this.tweenCam(new THREE.Vector3(2.6, 1.1, 2.4), new THREE.Vector3(2.0, 0.3, 1.5), spec.duration * 0.6);
        } else if (id === 'sleep') {
            this.pet.setAction('sleep');
            this.hud.say(`${this.profile.name} cochilou no almofadão.`);
            this.tweenCam(new THREE.Vector3(-0.4, 0.95, 2.1), new THREE.Vector3(-1.1, 0.2, 1.1), 1.2);
        }

        const wait = id === 'sleep' ? Math.max(2.4, (100 - this.profile.needs.energy) / 8) : spec.duration;
        clearTimeout(this._actTimer);
        this._actTimer = setTimeout(() => this.endAction(id), wait * 1000);
        this.hud.syncProfile(this.profile);
    }

    endAction(id) {
        this.busy = false;
        this.hud.setBusy(false);
        if (id === 'bath') {
            this.pet.setAction('shake');
            this.audio.shake();
            this.pet.headWorld(this._head);
            this.effects.splash(this._head.clone());
            setTimeout(() => {
                this.pet.setWet(0);
                this.pet.setAction('idle');
                if (this.refs.tub) this.refs.tub.visible = false;
                this.resetCam();
            }, 900);
            return;
        }
        if (id === 'sleep') {
            this.profile.needs.energy = 100;
            saveProfile(this.profile);
            this.hud.syncProfile(this.profile);
        }
        this.pet.setAction('idle');
        this.resetCam();
        this.audio.chirp(this.profile.species);
    }

    tweenCam(pos, target, dur) {
        this._camFrom = this.camera.position.clone();
        this._tgtFrom = this.controls.target.clone();
        this._camTo = pos;
        this._tgtTo = target;
        this._camT = 0;
        this._camDur = Math.max(0.4, dur * 0.35);
        this.controls.autoRotate = false;
    }

    resetCam() {
        this.tweenCam(HOME_CAM, HOME_TARGET, 1.1);
    }

    frame() {
        const dt = Math.min(0.05, this.clock.getDelta());
        this.time += dt;

        if (this._camTo && this._camT < this._camDur) {
            this._camT += dt;
            const k = 1 - Math.pow(1 - clamp(this._camT / this._camDur, 0, 1), 3);
            this.camera.position.lerpVectors(this._camFrom, this._camTo, k);
            this.controls.target.lerpVectors(this._tgtFrom, this._tgtTo, k);
            if (k >= 1) this._camTo = null;
        }

        this.controls.update();
        updateRoom(this.refs, this.time);
        this.effects.update(dt);

        const playing = this.mode === 'care' && !this.paused;
        if (playing) {
            const sleeping = this.pet.action === 'sleep';
            this.profile.needs = tickNeeds(this.profile.needs, dt, sleeping);
            this.saveAcc += dt;
            if (this.saveAcc > 4) {
                saveProfile(this.profile);
                this.saveAcc = 0;
            }
            this.hudAcc += dt;
            if (this.hudAcc > 0.4) {
                this.hud.syncProfile(this.profile);
                this.hudAcc = 0;
            }
            if (this.pet.action === 'idle' && this.profile.needs.energy < 18) this.pet.setAction('sit');
            if (this.pet.action === 'sit' && this.profile.needs.energy > 30) this.pet.setAction('idle');
        }

        this.pet.update(dt, this.profile.needs);

        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.composer?.setSize(w, h);
    }
}

const game = new Mimo();
game.init();
