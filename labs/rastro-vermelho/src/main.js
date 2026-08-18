/**
 * Rastro Vermelho — Babylon.js edition.
 * The terrain uses layered value noise; its height is sampled by the rider,
 * the terrain mesh, and the streamed scenery so the world remains continuous.
 */

const B = window.BABYLON;
const canvas = document.querySelector('#scene');
const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const ASSETS = {
    horse: 'assets/horse.gltf',
    ground: 'assets/ground-albedo.jpg',
    groundNormal: 'assets/ground-normal.jpg',
    groundRoughness: 'assets/ground-roughness.jpg',
    rock: 'assets/rock-albedo.jpg',
    rockNormal: 'assets/rock-normal.jpg'
};

if (!B) throw new Error('Babylon.js não foi carregado.');

const qualityProfiles = {
    low: { id: 'low', scale: 1, radius: 1, segments: 32, shadows: false, grass: 240 },
    medium: { id: 'medium', scale: 1.25, radius: 2, segments: 42, shadows: true, grass: 620 },
    high: { id: 'high', scale: 1.5, radius: 2, segments: 58, shadows: true, grass: 1100 }
};

function hash(x, z) {
    return (Math.sin(x * 127.1 + z * 311.7) * 43758.5453123) % 1;
}

function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const n00 = hash(ix, iz);
    const n10 = hash(ix + 1, iz);
    const n01 = hash(ix, iz + 1);
    const n11 = hash(ix + 1, iz + 1);
    return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sz) * 2 - 1;
}

function fbm(x, z) {
    let sum = 0;
    let amp = 0.5;
    for (let octave = 0; octave < 5; octave += 1) {
        sum += noise(x, z) * amp;
        x *= 2.03;
        z *= 2.03;
        amp *= 0.5;
    }
    return sum;
}

function terrainHeight(x, z) {
    const continent = fbm(x * 0.0032, z * 0.0032) * 17;
    const ridges = Math.pow(Math.abs(fbm(x * 0.009, z * 0.009)), 2.3) * 25;
    const rolling = fbm(x * 0.031, z * 0.031) * 5;
    const river = Math.abs(Math.sin((x + fbm(x * 0.012, z * 0.012) * 38) * 0.021));
    const valley = Math.pow(1 - clamp(river * 3.8, 0, 1), 3) * 10;
    return continent + ridges + rolling - valley;
}

function biomeAt(x, z, height = terrainHeight(x, z)) {
    const dryness = fbm(x * 0.004, z * 0.004);
    if (height > 28) return 'serra';
    if (height < -3) return 'rio';
    if (dryness > 0.32) return 'cânion';
    if (dryness < -0.2) return 'pradaria';
    return 'vale';
}

function makeTerrainMaterial(scene) {
    const material = new B.PBRMaterial('terra-pbr', scene);
    material.albedoColor = B.Color3.FromHexString('#d7a26c');
    material.albedoTexture = new B.Texture(ASSETS.ground, scene, true, false);
    material.albedoTexture.uScale = 16;
    material.albedoTexture.vScale = 16;
    material.bumpTexture = new B.Texture(ASSETS.groundNormal, scene, true, false);
    material.bumpTexture.uScale = 16;
    material.bumpTexture.vScale = 16;
    material.metallicTexture = new B.Texture(ASSETS.groundRoughness, scene, true, false);
    material.metallicTexture.uScale = 16;
    material.metallicTexture.vScale = 16;
    material.metallicTexture.useRoughnessFromMetallicTextureGreen = true;
    material.roughness = 0.78;
    material.metallic = 0;
    material.useVertexColors = false;
    material.environmentIntensity = 0.5;
    return material;
}

function createTerrain(scene, cx, cz, profile, material) {
    const size = 82;
    const subdivisions = profile.segments;
    const ground = B.MeshBuilder.CreateGround(`chunk-${cx}-${cz}`, { width: size, height: size, subdivisions, updatable: true }, scene);
    ground.position.set(cx * size, 0, cz * size);
    const positions = ground.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i] + ground.position.x;
        const z = positions[i + 2] + ground.position.z;
        const y = terrainHeight(x, z);
        positions[i + 1] = y;
    }
    ground.updateVerticesData(B.VertexBuffer.PositionKind, positions);
    ground.createNormals(true);
    ground.material = material;
    ground.receiveShadows = true;
    ground.freezeWorldMatrix();
    return ground;
}

function createRock(scene, position, scale, material) {
    const rock = B.MeshBuilder.CreateIcoSphere('arenito', { radius: 1, subdivisions: 2 }, scene);
    rock.position.copyFrom(position);
    rock.scaling.set(scale * 1.25, scale * (1.5 + Math.random()), scale);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.material = material;
    return rock;
}

function createTree(scene, x, z, height) {
    const tree = new B.TransformNode('pinheiro', scene);
    const trunk = B.MeshBuilder.CreateCylinder('tronco', { height, diameterTop: 0.22, diameterBottom: 0.5, tessellation: 8 }, scene);
    trunk.parent = tree;
    trunk.position.y = height / 2;
    const bark = new B.PBRMaterial('casca', scene);
    bark.albedoColor = B.Color3.FromHexString('#24150d');
    bark.roughness = 1;
    trunk.material = bark;
    const needles = new B.PBRMaterial('folhagem', scene);
    needles.albedoColor = B.Color3.FromHexString('#1b3019');
    needles.roughness = 0.9;
    for (let level = 0; level < 3; level += 1) {
        const crown = B.MeshBuilder.CreateCylinder('copa', {
            height: height * 0.72,
            diameterTop: 0,
            diameterBottom: height * (0.75 - level * 0.13),
            tessellation: 10
        }, scene);
        crown.parent = tree;
        crown.position.y = height * (0.62 + level * 0.19);
        crown.material = needles;
    }
    tree.position.set(x, terrainHeight(x, z), z);
    return tree;
}

async function loadHorse(scene, shadow) {
    const result = await B.SceneLoader.ImportMeshAsync('', '', ASSETS.horse, scene, undefined, '.gltf');
    const root = result.meshes[0];
    root.name = 'cavalo-realista';
    root.scaling.setAll(0.85);
    root.rotationQuaternion = null;
    root.rotation.y = Math.PI;
    result.meshes.forEach((mesh) => {
        mesh.receiveShadows = true;
        shadow?.addShadowCaster(mesh);
    });
    result.animationGroups.forEach((group) => group.start(true, 1, group.from, group.to, false));
    return { root, animations: result.animationGroups };
}

class RastroVermelho {
    constructor() {
        this.canvas = canvas;
        this.settings = JSON.parse(localStorage.getItem('rastro-vermelho:babylon') || '{"quality":"auto","volume":70,"muted":false,"best":0}');
        this.profile = this.pickQuality();
        this.engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: false });
        this.engine.setHardwareScalingLevel(1 / this.profile.scale);
        this.scene = new B.Scene(this.engine);
        this.scene.clearColor = new B.Color4(0.18, 0.07, 0.025, 1);
        this.scene.fogMode = B.Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.0017;
        this.scene.fogColor = B.Color3.FromHexString('#b25b2b');
        this.chunks = new Map();
        this.keys = {};
        this.look = { yaw: 0, pitch: 0.13 };
        this.player = { x: 12, z: 18, yaw: -0.5, speed: 12, distance: 0, spur: 0, phase: 0, cruise: true };
        this.state = 'loading';
        this.elapsed = 0;
        this.lastHud = 0;
        this.lastRegion = '';
        this.marks = new Set();
        this.init().catch((error) => {
            console.error(error);
            $('#errorText').textContent = 'Os assets realistas não puderam ser carregados. Verifique sua conexão e tente novamente.';
            $('#loadingOverlay').hidden = true;
            $('#errorOverlay').hidden = false;
        });
    }

    pickQuality() {
        const desired = this.settings.quality;
        if (desired !== 'auto') return qualityProfiles[desired];
        return matchMedia('(pointer: coarse)').matches ? qualityProfiles.low : qualityProfiles.high;
    }

    async init() {
        const scene = this.scene;
        this.camera = new B.UniversalCamera('câmera', new B.Vector3(0, 4, -8), scene);
        this.camera.minZ = 0.1; this.camera.maxZ = 800; this.camera.fov = 0.92;
        this.camera.inputs.clear();
        this.sky = B.MeshBuilder.CreateSphere('céu', { diameter: 1400, sideOrientation: B.Mesh.BACKSIDE, segments: 24 }, scene);
        this.skyMaterial = new B.SkyMaterial('atmosfera', scene);
        this.skyMaterial.backFaceCulling = false;
        this.skyMaterial.luminance = 1.0;
        this.skyMaterial.turbidity = 4;
        this.skyMaterial.rayleigh = 1.2;
        this.skyMaterial.mieCoefficient = 0.005;
        this.skyMaterial.mieDirectionalG = 0.8;
        this.sky.material = this.skyMaterial;

        this.clouds = B.MeshBuilder.CreateSphere('nuvens', { diameter: 1350, sideOrientation: B.Mesh.BACKSIDE, segments: 32 }, scene);
        const cloudMat = new B.StandardMaterial('nuvensMat', scene);
        const noiseTex = new B.NoiseProceduralTexture("perlin", 512, scene);
        noiseTex.octaves = 6;
        noiseTex.persistence = 1.2;
        noiseTex.animationSpeedFactor = 1.5;
        cloudMat.emissiveTexture = noiseTex;
        cloudMat.opacityTexture = noiseTex;
        cloudMat.disableLighting = true;
        cloudMat.alpha = 0.45;
        this.clouds.material = cloudMat;

        this.sun = new B.DirectionalLight('sol', new B.Vector3(-0.45, -0.7, 0.35), scene);
        this.sun.position.set(90, 130, -90); this.sun.intensity = 4.1;
        const hemi = new B.HemisphericLight('céu-ambiente', new B.Vector3(0, 1, 0), scene);
        hemi.intensity = 1.05; hemi.groundColor = B.Color3.FromHexString('#2b120a');
        this.shadow = this.profile.shadows ? new B.ShadowGenerator(2048, this.sun) : null;
        if (this.shadow) { this.shadow.usePercentageCloserFiltering = true; this.shadow.bias = 0.0008; }
        scene.environmentTexture = B.CubeTexture.CreateFromPrefilteredData('https://assets.babylonjs.com/environments/environmentSpecular.env', scene);
        scene.environmentIntensity = 0.55;
        const pipeline = new B.DefaultRenderingPipeline('cinema', true, scene, [this.camera]);
        pipeline.samples = this.profile.shadows ? 4 : 1;
        pipeline.bloomEnabled = this.profile.id !== 'low';
        pipeline.bloomThreshold = 0.78;
        pipeline.bloomWeight = 0.24;
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.contrast = 1.2;
        pipeline.imageProcessing.exposure = 1.08;
        this.terrainMaterial = makeTerrainMaterial(scene);
        this.rockMaterial = new B.PBRMaterial('arenito-pbr', scene);
        this.rockMaterial.albedoTexture = new B.Texture(ASSETS.rock, scene, true, false);
        this.rockMaterial.bumpTexture = new B.Texture(ASSETS.rockNormal, scene, true, false);
        this.rockMaterial.albedoTexture.uScale = this.rockMaterial.albedoTexture.vScale = 2.5;
        this.rockMaterial.bumpTexture.uScale = this.rockMaterial.bumpTexture.vScale = 2.5;
        this.rockMaterial.roughness = 0.72;
        this.water = B.MeshBuilder.CreateGround('rio-reflexivo', { width: 520, height: 520 }, scene);
        this.water.position.y = -3.4;
        const waterMaterial = new B.PBRMaterial('água', scene);
        waterMaterial.albedoColor = B.Color3.FromHexString('#173c42'); waterMaterial.metallic = 0.46; waterMaterial.roughness = 0.12; waterMaterial.alpha = 0.76;
        this.water.material = waterMaterial;
        this.setLoading(0.45, 'Selando um cavalo de verdade…');
        this.horse = await loadHorse(scene, this.shadow);
        this.setLoading(0.78, 'Texturizando o território…');
        this.bindInput();
        this.bindUi();
        this.updateChunks();
        this.setLoading(1, 'O oeste está pronto.');
        setTimeout(() => { $('#loadingOverlay').hidden = true; $('#menuOverlay').hidden = false; this.state = 'menu'; document.body.dataset.state = 'menu'; }, 450);
        this.engine.runRenderLoop(() => this.frame());
        addEventListener('resize', () => this.engine.resize());
    }

    updateChunks() {
        const size = 82;
        const centerX = Math.floor(this.player.x / size);
        const centerZ = Math.floor(this.player.z / size);
        const needed = new Set();
        for (let z = -this.profile.radius; z <= this.profile.radius; z += 1) for (let x = -this.profile.radius; x <= this.profile.radius; x += 1) {
            const key = `${centerX + x}:${centerZ + z}`; needed.add(key);
            if (!this.chunks.has(key)) this.chunks.set(key, this.createChunk(centerX + x, centerZ + z));
        }
        this.chunks.forEach((chunk, key) => { if (!needed.has(key)) { chunk.dispose(); this.chunks.delete(key); } });
    }

    createChunk(cx, cz) {
        const root = new B.TransformNode(`cenário-${cx}-${cz}`, this.scene);
        createTerrain(this.scene, cx, cz, this.profile, this.terrainMaterial).parent = root;
        const random = (i) => Math.abs(hash(cx * 37 + i * 2.7, cz * 19 + i * 1.3));
        for (let i = 0; i < 11; i += 1) {
            const x = cx * 82 + (random(i) - 0.5) * 70;
            const z = cz * 82 + (random(i + 22) - 0.5) * 70;
            const biome = biomeAt(x, z);
            if (biome === 'serra' || (biome === 'vale' && i % 2)) createTree(this.scene, x, z, 4 + random(i + 9) * 6).parent = root;
            else if (biome !== 'rio') createRock(this.scene, new B.Vector3(x, terrainHeight(x, z) + 1, z), 0.7 + random(i + 5) * 2.3, this.rockMaterial).parent = root;
        }
        return root;
    }

    bindInput() {
        addEventListener('keydown', (event) => { this.keys[event.code] = true; if (event.code === 'KeyP') this.togglePause(); if (event.code === 'KeyG') this.player.cruise = !this.player.cruise; if (event.code === 'KeyC') this.camera.fov = this.camera.fov < 0.85 ? 0.98 : 0.78; });
        addEventListener('keyup', (event) => { this.keys[event.code] = false; });
        canvas.addEventListener('click', () => { if (this.state === 'play') canvas.requestPointerLock?.(); });
        addEventListener('mousemove', (event) => { if (document.pointerLockElement === canvas && this.state === 'play') { this.look.yaw -= event.movementX * 0.0021; this.look.pitch = clamp(this.look.pitch - event.movementY * 0.0016, -0.22, 0.52); } });
        const stick = $('#moveStick');
        stick.addEventListener('pointermove', (event) => { if (!event.buttons) return; const rect = stick.getBoundingClientRect(); this.keys.touchX = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1); this.keys.touchZ = clamp((rect.height / 2 - (event.clientY - rect.top)) / (rect.height / 2), -1, 1); });
        stick.addEventListener('pointerup', () => { this.keys.touchX = 0; this.keys.touchZ = 0; });
        $('#btnSpur').addEventListener('click', () => { this.player.spur = 1.4; });
    }

    bindUi() {
        $('#startButton').addEventListener('click', () => this.start());
        $('#resumeButton').addEventListener('click', () => this.togglePause());
        $('#pauseMenuButton').addEventListener('click', () => this.menu());
        $('#pauseButton').addEventListener('click', () => this.togglePause());
        $('#soundButton').addEventListener('click', () => { this.settings.muted = !this.settings.muted; $('#soundButton').setAttribute('aria-pressed', String(!this.settings.muted)); this.persist(); });
        $('#qualitySelect').value = this.settings.quality || 'auto';
        $('#qualitySelect').addEventListener('change', (event) => { this.settings.quality = event.target.value; this.persist(); this.say('Qualidade será aplicada ao reiniciar a trilha.', 3); });
        $('#volumeSlider').value = this.settings.volume || 70;
        $('#volumeSlider').addEventListener('input', (event) => { this.settings.volume = Number(event.target.value); $('#volumeValue').textContent = event.target.value; this.persist(); });
        $('#bestScore').textContent = `${Math.round(this.settings.best || 0)} m`;
        $('#touchControls').hidden = !matchMedia('(pointer: coarse)').matches;
    }

    start() {
        $('#menuOverlay').hidden = true; $('#pauseOverlay').hidden = true; $('#hud').hidden = false;
        this.state = 'play'; document.body.dataset.state = 'play'; this.elapsed = 0; this.marks.clear();
        this.say('Pradaria Dourada. O cavalo já galopa — o oeste não acaba.', 4);
    }

    menu() {
        $('#pauseOverlay').hidden = true; $('#hud').hidden = true; $('#menuOverlay').hidden = false;
        this.state = 'menu'; document.body.dataset.state = 'menu'; document.exitPointerLock?.();
        this.settings.best = Math.max(this.settings.best || 0, this.player.distance); this.persist(); $('#bestScore').textContent = `${Math.round(this.settings.best)} m`;
    }

    togglePause() {
        if (this.state === 'play') { this.state = 'pause'; $('#pauseOverlay').hidden = false; document.exitPointerLock?.(); }
        else if (this.state === 'pause') { this.state = 'play'; $('#pauseOverlay').hidden = true; canvas.requestPointerLock?.(); }
    }

    setLoading(progress, text) { $('#loadingFill').style.width = `${progress * 100}%`; $('#loadingText').textContent = text; }
    persist() { localStorage.setItem('rastro-vermelho:babylon', JSON.stringify(this.settings)); }
    say(text, duration = 2.8) { const message = $('#message'); message.textContent = text; message.dataset.show = 'true'; clearTimeout(this.messageTimer); this.messageTimer = setTimeout(() => { message.dataset.show = 'false'; }, duration * 1000); }

    frame() {
        const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
        this.elapsed += dt;
        if (this.state === 'play') this.update(dt);
        else this.menuCamera(dt);
        this.sky.position.copyFrom(this.camera.position);
        if (this.water) {
            this.water.position.x = this.camera.position.x;
            this.water.position.z = this.camera.position.z;
        }
        if (this.clouds) {
            this.clouds.position.copyFrom(this.camera.position);
        }
        this.scene.render();
    }

    update(dt) {
        const steer = (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0) - (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) + (this.keys.touchX || 0);
        const throttle = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) + (this.keys.touchZ || 0);
        if (this.keys.Space) this.player.spur = 1.4;
        this.player.spur = Math.max(0, this.player.spur - dt);
        const target = this.player.spur > 0 || this.keys.ShiftLeft ? 24 : throttle > 0.1 ? 19 : throttle < -0.1 ? 5 : (this.player.cruise ? 12 : 2.5);
        this.player.speed = lerp(this.player.speed, target, 1 - Math.exp(-dt * 3.6));
        this.player.yaw -= steer * dt * clamp(this.player.speed / 12, 0.35, 1.35);
        const forward = new B.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
        this.player.x += forward.x * this.player.speed * dt; this.player.z += forward.z * this.player.speed * dt;
        this.player.distance += this.player.speed * dt; this.player.phase += this.player.speed * dt * 2.3;
        const y = terrainHeight(this.player.x, this.player.z);
        this.horse.root.position.set(this.player.x, y, this.player.z);
        this.horse.root.rotation.set((terrainHeight(this.player.x + forward.x * 2, this.player.z + forward.z * 2) - y) * -0.15, this.player.yaw, steer * -0.08);
        this.horse.animations.forEach((animation) => {
            animation.speedRatio = clamp(this.player.speed / 12, 0.45, 2.1);
        });
        const wanted = new B.Vector3(this.player.x - forward.x * 8.4, y + 3.4 + Math.sin(this.look.pitch) * 3.2, this.player.z - forward.z * 8.4);
        this.camera.position = B.Vector3.Lerp(this.camera.position, wanted, 1 - Math.exp(-dt * 5));
        const look = new B.Vector3(this.player.x + Math.sin(this.look.yaw) * 12, y + 1.7 + Math.sin(this.look.pitch) * 5, this.player.z + Math.cos(this.look.yaw) * 12);
        this.camera.setTarget(look);
        this.updateChunks(); this.updateAtmosphere();
        this.lastHud += dt;
        if (this.lastHud > 0.12) { this.lastHud = 0; this.updateHud(); }
    }

    menuCamera(dt) {
        const t = performance.now() * 0.00012;
        const y = terrainHeight(this.player.x, this.player.z);
        this.camera.position = B.Vector3.Lerp(this.camera.position, new B.Vector3(this.player.x + Math.cos(t) * 18, y + 9, this.player.z + Math.sin(t) * 18), dt);
        this.camera.setTarget(new B.Vector3(this.player.x, y + 1.4, this.player.z));
        this.updateAtmosphere();
    }

    updateAtmosphere() {
        const sun = (Math.sin(this.elapsed / 90) + 1) * 0.5;
        this.sun.intensity = 0.6 + sun * 3.8;
        this.sun.direction = new B.Vector3(-0.55, -0.22 - sun * 0.75, 0.35);

        if (this.skyMaterial) {
            this.skyMaterial.sunPosition = this.sun.direction.scale(-100);
            this.skyMaterial.rayleigh = lerp(2.5, 1.2, sun);
        }

        this.scene.fogColor = B.Color3.Lerp(B.Color3.FromHexString('#1b0b18'), B.Color3.FromHexString('#c77342'), sun);

        if (this.clouds && this.clouds.material) {
            const cloudTint = B.Color3.Lerp(B.Color3.FromHexString('#110a19'), B.Color3.FromHexString('#ffffff'), sun);
            this.clouds.material.emissiveColor = cloudTint;
        }
    }

    updateHud() {
        const region = biomeAt(this.player.x, this.player.z);
        const names = { pradaria: 'Pradaria Dourada', vale: 'Vale da Poeira', cânion: 'Cânion Encarnado', serra: 'Serra do Corvo', rio: 'Riacho dos Ventos' };
        $('#regionName').textContent = names[region]; $('#biomeLabel').textContent = region;
        $('#speedValue').textContent = String(Math.round(this.player.speed * 2.45));
        $('#gaitValue').textContent = this.player.speed > 19 ? 'disparada' : this.player.speed > 10 ? 'galope' : 'trote';
        $('#distanceValue').textContent = `${Math.round(this.player.distance)} m`;
        const hours = 4 + Math.floor((this.elapsed / 480) * 24) % 24;
        $('#clockValue').textContent = `${String(hours).padStart(2, '0')}:00`;
        $('#hourLabel').textContent = hours < 7 ? 'amanhecer' : hours < 17 ? 'dia' : 'entardecer';
        $('#compassRose').style.transform = `rotate(${-this.player.yaw}rad)`;
        $('#fpsCounter').textContent = `${this.engine.getFps().toFixed(0)} fps`;
        if (names[region] !== this.lastRegion) { this.lastRegion = names[region]; this.say(this.lastRegion, 2.4); }
    }
}

new RastroVermelho();
