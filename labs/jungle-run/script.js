const CONFIG = Object.freeze({
    WIDTH: 960,
    HEIGHT: 600,
    GROUND_Y: 455,
    GRAVITY: 0.72,
    JUMP_FORCE: -14.2,
    MOVE_SPEED: 5.4,
    BASE_SCROLL_SPEED: 2.3,
    MAX_SCROLL_SPEED: 4.8,
    SEGMENT_WIDTH: 320,
    SPAWN_AHEAD: 1900,
    COYOTE_FRAMES: 7,
    JUMP_BUFFER_FRAMES: 8
});

const BIOMES = [
    { at: 0, name: 'Trilha do Alvorecer' },
    { at: 240, name: 'Dossel Esmeralda' },
    { at: 520, name: 'Ruínas Submersas' },
    { at: 850, name: 'Templo da Lua' }
];

class JungleAudio {
    constructor(button) {
        this.button = button;
        this.context = null;
        this.muted = this.readMuted();
        this.syncButton();
    }

    readMuted() {
        try {
            return localStorage.getItem('jungleRunMuted') === 'true';
        } catch {
            return false;
        }
    }

    toggle() {
        this.muted = !this.muted;
        try {
            localStorage.setItem('jungleRunMuted', String(this.muted));
        } catch {
            // Local storage can be unavailable in private browsing.
        }
        this.syncButton();
        if (!this.muted) this.play('select');
    }

    syncButton() {
        this.button.setAttribute('aria-pressed', String(this.muted));
        this.button.setAttribute('aria-label', this.muted ? 'Ativar som' : 'Desativar som');
        this.button.querySelector('span').textContent = this.muted ? '×' : '♪';
    }

    ensureContext() {
        if (!this.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.context = new AudioContext();
        }
        if (this.context?.state === 'suspended') this.context.resume();
        return this.context;
    }

    play(type) {
        if (this.muted) return;
        const context = this.ensureContext();
        if (!context) return;

        const presets = {
            jump: [180, 330, 0.12, 'square', 0.035],
            coin: [520, 900, 0.1, 'sine', 0.045],
            relic: [420, 1100, 0.22, 'triangle', 0.05],
            hit: [150, 55, 0.3, 'sawtooth', 0.06],
            select: [300, 440, 0.08, 'sine', 0.025],
            milestone: [330, 760, 0.38, 'triangle', 0.045],
            land: [90, 55, 0.08, 'sine', 0.025]
        };
        const [from, to, duration, wave, volume] = presets[type] || presets.select;
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }
}

class JungleRun {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.container = document.getElementById('gameContainer');
        this.app = null;
        this.state = 'loading';
        this.keys = Object.create(null);
        this.touch = { left: false, right: false, jump: false };
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.bestDistance = this.readNumber('jungleRunBestDistance');
        this.bestScore = this.readNumber('jungleRunBestScore');
        this.collectCount = 0;
        this.cameraX = 0;
        this.lastSpawnX = 0;
        this.invincibleFrames = 0;
        this.coyoteFrames = 0;
        this.jumpBufferFrames = 0;
        this.effects = [];
        this.obstacles = [];
        this.collectibles = [];
        this.vines = [];
        this.platforms = [];
        this.parallaxLayers = [];
        this.uiCache = {};
        this.currentBiome = -1;
        this.toastTimer = null;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.audio = new JungleAudio(document.getElementById('soundBtn'));
        this.init();
    }

    readNumber(key) {
        try {
            return Number(localStorage.getItem(key)) || 0;
        } catch {
            return 0;
        }
    }

    saveNumber(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch {
            // Scores still work for the current session.
        }
    }

    async init() {
        try {
            this.app = new PIXI.Application();
            await this.app.init({
                canvas: this.canvas,
                width: CONFIG.WIDTH,
                height: CONFIG.HEIGHT,
                backgroundColor: 0x07150f,
                antialias: true,
                autoDensity: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                preference: 'webgl'
            });

            const playerTextures = await Promise.all([
                PIXI.Assets.load('./assets/explorer-run.png?v=2'),
                PIXI.Assets.load('./assets/explorer-jump.png?v=2'),
                PIXI.Assets.load('./assets/explorer-run-contact.png?v=2'),
                PIXI.Assets.load('./assets/explorer-run-down.png?v=2'),
                PIXI.Assets.load('./assets/explorer-run-passing.png?v=2')
            ]);
            this.playerTexture = playerTextures[0];
            this.playerJumpTexture = playerTextures[1];
            this.playerRunTextures = [
                playerTextures[2],
                playerTextures[3],
                playerTextures[4],
                playerTextures[0]
            ];
            this.createBackdrop();
            this.createWorld();
            this.setupEventListeners();
            this.app.ticker.add(this.gameLoop, this);
            this.state = 'intro';
            this.syncHud(true);
            document.getElementById('bestScore').textContent = this.pad(this.bestScore, 4);
            document.getElementById('startBtn').disabled = false;
        } catch (error) {
            console.error('Jungle Run could not initialize:', error);
            const startButton = document.getElementById('startBtn');
            startButton.disabled = true;
            startButton.querySelector('span').textContent = 'Não foi possível iniciar';
        }
    }

    setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
                event.preventDefault();
            }
            if (
                !event.repeat &&
                ['Space', 'ArrowUp', 'KeyW'].includes(event.code)
            ) {
                this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
            }

            if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
                this.togglePause();
            }

            if (event.code === 'Enter' && !event.repeat) {
                if (this.state === 'intro') this.startExpedition();
                else if (this.state === 'over') this.restartGame();
            }
        });

        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        window.addEventListener('blur', () => {
            if (this.state === 'playing') this.pauseGame();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pauseGame();
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startExpedition());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('pauseRestartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('soundBtn').addEventListener('click', () => this.audio.toggle());

        this.bindHoldButton('leftBtn', 'left');
        this.bindHoldButton('rightBtn', 'right');
        this.bindHoldButton('jumpBtn', 'jump');
    }

    bindHoldButton(id, control) {
        const button = document.getElementById(id);
        const activate = (event) => {
            event.preventDefault();
            this.touch[control] = true;
            if (control === 'jump') this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
            button.classList.add('is-active');
            if (button.setPointerCapture && event.pointerId !== undefined) {
                button.setPointerCapture(event.pointerId);
            }
        };
        const release = (event) => {
            if (event) event.preventDefault();
            this.touch[control] = false;
            button.classList.remove('is-active');
        };

        button.addEventListener('pointerdown', activate);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
        button.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    createBackdrop() {
        const sky = new PIXI.Graphics();
        const bands = [
            [0, 125, 0x081329],
            [125, 125, 0x102a39],
            [250, 135, 0x174638],
            [385, 215, 0x0a2518]
        ];
        for (const [y, height, color] of bands) {
            sky.rect(0, y, CONFIG.WIDTH, height).fill(color);
        }
        this.app.stage.addChild(sky);

        const moonGlow = new PIXI.Graphics();
        moonGlow.circle(760, 108, 76).fill({ color: 0xe8e3a9, alpha: 0.04 });
        moonGlow.circle(760, 108, 48).fill({ color: 0xf0e9b3, alpha: 0.08 });
        moonGlow.circle(760, 108, 28).fill({ color: 0xfff4c7, alpha: 0.72 });
        moonGlow.circle(750, 101, 5).fill({ color: 0xd7d19c, alpha: 0.36 });
        moonGlow.circle(770, 116, 4).fill({ color: 0xd7d19c, alpha: 0.28 });
        this.app.stage.addChild(moonGlow);

        const stars = new PIXI.Graphics();
        const random = this.seededRandom(17);
        for (let i = 0; i < 80; i++) {
            const x = random() * CONFIG.WIDTH;
            const y = 28 + random() * 205;
            const radius = random() > 0.86 ? 1.6 : 0.8;
            stars.circle(x, y, radius).fill({ color: 0xf8f0c9, alpha: 0.25 + random() * 0.55 });
        }
        this.app.stage.addChild(stars);

        this.createParallaxLayer(0.1, 0x112e31, 325, 0.72, 22, 81);
        this.createParallaxLayer(0.22, 0x153d32, 366, 0.82, 28, 123);
        this.createParallaxLayer(0.42, 0x164d31, 408, 0.96, 34, 241);

        this.fireflies = new PIXI.Container();
        for (let i = 0; i < 20; i++) {
            const fly = new PIXI.Graphics();
            fly.circle(0, 0, i % 4 === 0 ? 2.1 : 1.2).fill({ color: 0xd8ef74, alpha: 0.78 });
            fly.x = random() * CONFIG.WIDTH;
            fly.y = 210 + random() * 240;
            fly.baseY = fly.y;
            fly.phase = random() * Math.PI * 2;
            this.fireflies.addChild(fly);
        }
        this.app.stage.addChild(this.fireflies);
    }

    seededRandom(seed) {
        let value = seed >>> 0;
        return () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 4294967296;
        };
    }

    createParallaxLayer(speed, color, baseline, alpha, count, seed) {
        const layer = new PIXI.Container();
        const width = 2400;
        const random = this.seededRandom(seed);

        for (let repeat = 0; repeat < 2; repeat++) {
            for (let i = 0; i < count; i++) {
                const x = repeat * width + (i / count) * width + random() * 38;
                const scale = 0.55 + random() * 0.75;
                const tree = this.createJungleTree(color, alpha, scale);
                tree.x = x;
                tree.y = baseline + random() * 32;
                layer.addChild(tree);
            }
        }

        this.app.stage.addChild(layer);
        this.parallaxLayers.push({ container: layer, speed, width });
    }

    createJungleTree(color, alpha, scale) {
        const tree = new PIXI.Graphics();
        const trunkHeight = 82 * scale;
        const trunkWidth = 13 * scale;
        tree.roundRect(-trunkWidth / 2, -trunkHeight, trunkWidth, trunkHeight + 30, trunkWidth / 2)
            .fill({ color: 0x2c2a1c, alpha: alpha * 0.72 });

        const crownY = -trunkHeight;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const x = Math.cos(angle) * 24 * scale;
            const y = crownY + Math.sin(angle) * 18 * scale;
            tree.ellipse(x, y, 42 * scale, 23 * scale).fill({ color, alpha });
        }
        tree.circle(0, crownY, 31 * scale).fill({ color, alpha });
        return tree;
    }

    createWorld() {
        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);

        this.ground = new PIXI.Graphics();
        this.ground.rect(0, CONFIG.GROUND_Y, 100000, CONFIG.HEIGHT - CONFIG.GROUND_Y)
            .fill(0x1c2115);
        this.ground.rect(0, CONFIG.GROUND_Y, 100000, 13)
            .fill(0x3f7f3e);
        this.ground.rect(0, CONFIG.GROUND_Y + 13, 100000, 7)
            .fill(0x254f2b);
        for (let x = 0; x < 100000; x += 42) {
            const height = 5 + (x % 17);
            this.ground.moveTo(x, CONFIG.GROUND_Y);
            this.ground.lineTo(x + 7, CONFIG.GROUND_Y - height);
            this.ground.lineTo(x + 13, CONFIG.GROUND_Y);
            this.ground.fill(x % 84 ? 0x4a9147 : 0x65a858);
        }
        this.world.addChild(this.ground);

        this.groundDecor = new PIXI.Container();
        this.world.addChild(this.groundDecor);
        for (let x = 60; x < 5000; x += 140) this.createGroundPlant(x);

        this.playerShadow = new PIXI.Graphics();
        this.playerShadow.ellipse(0, 0, 33, 8).fill({ color: 0x020905, alpha: 0.34 });
        this.world.addChild(this.playerShadow);

        this.createPlayer();
        this.spawnInitialContent();
    }

    createGroundPlant(x) {
        const plant = new PIXI.Graphics();
        const color = x % 280 ? 0x255f35 : 0x367944;
        plant.moveTo(0, 0).quadraticCurveTo(-10, -22, -18, -29).stroke({ color, width: 4 });
        plant.moveTo(0, 0).quadraticCurveTo(8, -18, 19, -23).stroke({ color, width: 3 });
        plant.ellipse(-18, -29, 9, 4).fill(color);
        plant.ellipse(19, -23, 8, 4).fill(color);
        plant.x = x;
        plant.y = CONFIG.GROUND_Y + 7;
        this.groundDecor.addChild(plant);
    }

    createPlayer() {
        this.player = new PIXI.Container();
        this.player.x = 150;
        this.player.y = CONFIG.GROUND_Y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onVine = null;
        this.player.facing = 1;
        this.player.jumpHeld = false;

        const aura = new PIXI.Graphics();
        aura.ellipse(0, -49, 43, 55).fill({ color: 0x8bf2bd, alpha: 0.055 });
        aura.blendMode = 'add';
        this.player.addChild(aura);
        this.player.aura = aura;

        this.player.visual = new PIXI.Container();
        this.player.baseSpriteScale = 116 / this.playerTexture.height;
        this.player.pose = 'run-0';

        const rim = new PIXI.Sprite(this.playerTexture);
        rim.anchor.set(0.53, 0.985);
        rim.scale.set(this.player.baseSpriteScale * 1.045);
        rim.tint = 0x72dca5;
        rim.alpha = 0.2;
        rim.blendMode = 'add';
        this.player.visual.addChild(rim);

        const sprite = new PIXI.Sprite(this.playerTexture);
        sprite.anchor.set(0.53, 0.985);
        sprite.scale.set(this.player.baseSpriteScale);
        this.player.visual.addChild(sprite);
        this.player.sprite = sprite;
        this.player.rim = rim;
        this.player.addChild(this.player.visual);

        this.playerTrails = [];
        for (let i = 0; i < 2; i++) {
            const trail = new PIXI.Sprite(this.playerTexture);
            trail.anchor.set(0.53, 0.985);
            trail.scale.set(this.player.baseSpriteScale);
            trail.tint = i === 0 ? 0x70dba4 : 0xf0ce72;
            trail.alpha = 0;
            trail.blendMode = 'add';
            this.world.addChild(trail);
            this.playerTrails.push(trail);
        }

        this.world.addChild(this.player);
    }

    spawnInitialContent() {
        for (let i = 0; i < 6; i++) this.spawnCollectible(420 + i * 72, i === 5);
        for (let x = 840; x < CONFIG.SPAWN_AHEAD; x += CONFIG.SEGMENT_WIDTH) {
            this.spawnSegment(x);
        }
        this.lastSpawnX = CONFIG.SPAWN_AHEAD;
    }

    spawnSegment(x) {
        const difficulty = Math.min(1, this.distance / 900);
        const roll = Math.random();

        if (roll < 0.22 + difficulty * 0.04) {
            this.spawnPit(x);
        } else if (roll < 0.43 + difficulty * 0.05) {
            this.spawnCrocodile(x + 70);
        } else if (roll < 0.61 + difficulty * 0.05) {
            this.spawnLog(x + 90, difficulty);
        } else if (roll < 0.77) {
            this.spawnVine(x + 120);
        } else {
            this.spawnRuin(x + 75);
        }

        if (Math.random() < 0.7) {
            const count = Math.random() < 0.35 ? 3 : 1;
            for (let i = 0; i < count; i++) {
                this.spawnCollectible(x + 55 + i * 46, count === 1 && Math.random() < 0.22);
            }
        }
    }

    spawnPit(x) {
        const width = 104 + Math.random() * 54;
        const pit = new PIXI.Graphics();
        pit.rect(0, -2, width, 148).fill(0x030907);
        pit.rect(8, 15, width - 16, 120).fill({ color: 0x214b38, alpha: 0.35 });
        pit.ellipse(width / 2, 26, width * 0.43, 18).fill({ color: 0x51b56a, alpha: 0.11 });
        for (let i = 8; i < width - 8; i += 17) {
            pit.moveTo(i, 9).lineTo(i + 6, -9).lineTo(i + 12, 9).fill(0x13251a);
        }
        pit.x = x;
        pit.y = CONFIG.GROUND_Y;
        pit.type = 'pit';
        pit.hitWidth = width;
        this.world.addChild(pit);
        this.obstacles.push(pit);

        if (width > 135 && Math.random() < 0.55) {
            this.createPlatform(x + width * 0.35, CONFIG.GROUND_Y - 66, width * 0.32);
        }
    }

    createPlatform(x, y, width) {
        const platform = new PIXI.Graphics();
        platform.roundRect(0, 0, width, 14, 4).fill(0x75512c).stroke({ color: 0x241b10, width: 3 });
        platform.rect(5, 3, width - 10, 4).fill(0xb17b3a);
        platform.x = x;
        platform.y = y;
        platform.type = 'platform';
        platform.platformWidth = width;
        this.world.addChild(platform);
        this.platforms.push(platform);
    }

    spawnCrocodile(x) {
        const croc = new PIXI.Container();
        const body = new PIXI.Graphics();
        body.ellipse(0, 0, 49, 15).fill(0x3f7f44).stroke({ color: 0x07150f, width: 4 });
        body.moveTo(43, -2).lineTo(72, -8).lineTo(68, 7).closePath().fill(0x2f6639)
            .stroke({ color: 0x07150f, width: 3 });
        for (let i = -35; i < 35; i += 15) {
            body.moveTo(i, -13).lineTo(i + 6, -22).lineTo(i + 12, -13).fill(0x25532f);
        }
        body.circle(-40, -10, 4).fill(0xf3cf63);
        body.circle(-41, -10, 1.5).fill(0x07150f);

        const jaw = new PIXI.Graphics();
        jaw.moveTo(-48, 0).lineTo(-78, 7).lineTo(-43, 11).closePath().fill(0x5e9c50)
            .stroke({ color: 0x07150f, width: 3 });
        for (let xPos = -70; xPos < -48; xPos += 7) {
            jaw.moveTo(xPos, 4).lineTo(xPos + 3, -2).lineTo(xPos + 6, 4).fill(0xf3efd2);
        }
        croc.addChild(body, jaw);
        croc.jaw = jaw;
        croc.x = x;
        croc.y = CONFIG.GROUND_Y - 15;
        croc.type = 'crocodile';
        croc.hitWidth = 104;
        croc.hitHeight = 34;
        croc.phase = Math.random() * Math.PI * 2;
        this.world.addChild(croc);
        this.obstacles.push(croc);
    }

    spawnLog(x, difficulty) {
        const log = new PIXI.Container();
        const body = new PIXI.Graphics();
        body.roundRect(-40, -17, 80, 34, 13).fill(0x754325).stroke({ color: 0x21160e, width: 4 });
        body.rect(-27, -12, 52, 5).fill({ color: 0xb8793f, alpha: 0.5 });
        body.circle(-34, 0, 14).fill(0xa16d3d).stroke({ color: 0x402817, width: 3 });
        body.circle(-34, 0, 7).stroke({ color: 0x62401f, width: 2 });
        log.addChild(body);
        log.x = x;
        log.y = CONFIG.GROUND_Y - 18;
        log.type = 'log';
        log.hitWidth = 72;
        log.hitHeight = 34;
        log.vx = -(1.15 + Math.random() * 0.75 + difficulty);
        this.world.addChild(log);
        this.obstacles.push(log);
    }

    spawnVine(x) {
        const vine = new PIXI.Container();
        const rope = new PIXI.Graphics();
        const grip = new PIXI.Graphics();
        grip.circle(0, 0, 10).fill(0x6b9f46).stroke({ color: 0x17371e, width: 3 });
        vine.addChild(rope, grip);
        vine.x = x;
        vine.y = 50;
        vine.type = 'vine';
        vine.rope = rope;
        vine.grip = grip;
        vine.ropeLength = 245 + Math.random() * 40;
        vine.angle = -0.35 + Math.random() * 0.25;
        vine.angularVelocity = 0.012 + Math.random() * 0.004;
        this.drawVine(vine);
        this.world.addChild(vine);
        this.vines.push(vine);
    }

    drawVine(vine) {
        const endX = Math.sin(vine.angle) * vine.ropeLength;
        const endY = Math.cos(vine.angle) * vine.ropeLength;
        vine.rope.clear();
        vine.rope.moveTo(0, 0).quadraticCurveTo(endX * 0.45 - 12, endY * 0.45, endX, endY)
            .stroke({ color: 0x173b26, width: 9 });
        vine.rope.moveTo(0, 0).quadraticCurveTo(endX * 0.45 - 12, endY * 0.45, endX, endY)
            .stroke({ color: 0x4a8f48, width: 4 });
        vine.grip.x = endX;
        vine.grip.y = endY;
    }

    spawnRuin(x) {
        const ruin = new PIXI.Graphics();
        ruin.roundRect(-23, -72, 46, 72, 4).fill(0x526854).stroke({ color: 0x1a2b20, width: 4 });
        ruin.rect(-30, -74, 60, 12).fill(0x71806a).stroke({ color: 0x1a2b20, width: 3 });
        ruin.rect(-13, -49, 26, 31).fill(0x17241c);
        ruin.circle(0, -48, 13).fill(0x17241c);
        ruin.moveTo(-23, -23).lineTo(23, -36).stroke({ color: 0x37473b, width: 4 });
        ruin.x = x;
        ruin.y = CONFIG.GROUND_Y;
        ruin.type = 'ruin';
        ruin.hitWidth = 44;
        ruin.hitHeight = 64;
        this.world.addChild(ruin);
        this.obstacles.push(ruin);
    }

    spawnCollectible(x, forceRelic = false) {
        const collectible = new PIXI.Container();
        const isRelic = forceRelic || Math.random() < 0.18;
        const glow = new PIXI.Graphics();
        const gem = new PIXI.Graphics();

        if (isRelic) {
            glow.circle(0, 0, 25).fill({ color: 0x58e4b0, alpha: 0.16 });
            gem.moveTo(0, -16).lineTo(13, -4).lineTo(8, 13).lineTo(-8, 13).lineTo(-13, -4)
                .closePath().fill(0x55e5b2).stroke({ color: 0xd2ffec, width: 2 });
            gem.moveTo(-12, -4).lineTo(12, -4).lineTo(0, 13).closePath()
                .stroke({ color: 0x147654, width: 2 });
            collectible.value = 125;
            collectible.type = 'relic';
        } else {
            glow.circle(0, 0, 22).fill({ color: 0xf6cf69, alpha: 0.14 });
            gem.circle(0, 0, 12).fill(0xf2c75e).stroke({ color: 0xffefaa, width: 2 });
            gem.circle(0, 0, 6).stroke({ color: 0xb5772d, width: 2 });
            gem.moveTo(-5, 0).lineTo(5, 0).stroke({ color: 0xb5772d, width: 2 });
            collectible.value = 50;
            collectible.type = 'coin';
        }

        collectible.addChild(glow, gem);
        collectible.glow = glow;
        collectible.baseY = CONFIG.GROUND_Y - 68 - Math.random() * 82;
        collectible.x = x;
        collectible.y = collectible.baseY;
        collectible.phase = Math.random() * Math.PI * 2;
        this.world.addChild(collectible);
        this.collectibles.push(collectible);
    }

    async startExpedition() {
        if (this.state !== 'intro') return;
        this.audio.ensureContext();
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('mobileControls').classList.remove('is-hidden');
        this.state = 'countdown';
        await this.runCountdown();
        if (this.state !== 'countdown') return;
        this.state = 'playing';
        this.invincibleFrames = 100;
        this.announce('Expedição iniciada');
    }

    async runCountdown() {
        const element = document.getElementById('countdown');
        element.classList.remove('hidden', 'go');
        for (const value of ['3', '2', '1']) {
            if (this.state !== 'countdown') break;
            element.textContent = value;
            this.audio.play('select');
            await new Promise((resolve) => setTimeout(resolve, 480));
        }
        if (this.state === 'countdown') {
            element.textContent = 'VAI!';
            element.classList.add('go');
            this.audio.play('milestone');
            await new Promise((resolve) => setTimeout(resolve, 380));
        }
        element.classList.add('hidden');
    }

    pauseGame() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.releaseInputs();
        document.getElementById('pauseScreen').classList.remove('hidden');
        document.getElementById('pauseScreen').setAttribute('aria-hidden', 'false');
        document.getElementById('hud').classList.add('is-dimmed');
        document.getElementById('mobileControls').classList.add('is-hidden');
        document.getElementById('resumeBtn').focus();
        this.announce('Jogo pausado');
    }

    resumeGame() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        document.getElementById('pauseScreen').classList.add('hidden');
        document.getElementById('pauseScreen').setAttribute('aria-hidden', 'true');
        document.getElementById('hud').classList.remove('is-dimmed');
        document.getElementById('mobileControls').classList.remove('is-hidden');
        this.audio.play('select');
        this.announce('Expedição retomada');
    }

    togglePause() {
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused') this.resumeGame();
    }

    restartGame() {
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.collectCount = 0;
        this.cameraX = 0;
        this.lastSpawnX = 0;
        this.invincibleFrames = 120;
        this.currentBiome = -1;
        this.effects.forEach((effect) => this.world.removeChild(effect.container));
        this.effects = [];

        [...this.obstacles, ...this.collectibles, ...this.vines, ...this.platforms].forEach((object) => {
            if (object.parent) object.parent.removeChild(object);
        });
        this.obstacles = [];
        this.collectibles = [];
        this.vines = [];
        this.platforms = [];

        this.player.x = 150;
        this.player.y = CONFIG.GROUND_Y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onVine = null;
        this.player.alpha = 1;
        this.player.scale.set(1);
        this.world.x = 0;
        this.spawnInitialContent();
        this.releaseInputs();

        ['pauseScreen', 'gameOverScreen', 'countdown'].forEach((id) => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById('pauseScreen').setAttribute('aria-hidden', 'true');
        document.getElementById('gameOverScreen').setAttribute('aria-hidden', 'true');
        document.getElementById('hud').classList.remove('is-dimmed');
        document.getElementById('mobileControls').classList.remove('is-hidden');
        this.uiCache = {};
        this.syncHud(true);
        this.state = 'playing';
        this.audio.play('select');
        this.announce('Nova expedição iniciada');
    }

    releaseInputs() {
        this.keys = Object.create(null);
        Object.keys(this.touch).forEach((key) => {
            this.touch[key] = false;
        });
        document.querySelectorAll('.mobile-btn').forEach((button) => button.classList.remove('is-active'));
    }

    gameLoop(ticker) {
        const delta = Math.min(ticker.deltaTime, 2);
        this.updateAmbient(delta);
        if (this.state !== 'playing') return;

        this.handleInput();
        this.updatePlayer(delta);
        this.updateObstacles(delta);
        this.updateCollectibles(delta);
        this.updateVines(delta);
        this.updateEffects(delta);
        this.updateCamera();
        this.checkCollisions();
        this.spawnNewContent();
        this.cleanupOffscreen();
        this.syncHud();
    }

    updateAmbient(delta) {
        const time = this.app.ticker.lastTime / 1000;
        for (let i = 0; i < this.fireflies.children.length; i++) {
            const fly = this.fireflies.children[i];
            fly.y = fly.baseY + Math.sin(time * 1.25 + fly.phase) * 10;
            fly.x += 0.07 * delta;
            if (fly.x > CONFIG.WIDTH + 10) fly.x = -10;
            fly.alpha = 0.25 + (Math.sin(time * 2 + fly.phase) + 1) * 0.32;
        }
    }

    handleInput() {
        const left = this.keys.ArrowLeft || this.keys.KeyA || this.touch.left;
        const right = this.keys.ArrowRight || this.keys.KeyD || this.touch.right;
        const jump = this.keys.Space || this.keys.ArrowUp || this.keys.KeyW || this.touch.jump;

        if (jump && !this.player.jumpHeld) this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
        this.player.jumpHeld = Boolean(jump);

        if (this.player.onVine) {
            if (!jump && this.jumpBufferFrames > 0) this.releaseVine();
            if (left) this.player.onVine.angularVelocity -= 0.0005;
            if (right) this.player.onVine.angularVelocity += 0.0005;
            return;
        }

        let inputVelocity = 0;
        if (left) inputVelocity -= CONFIG.MOVE_SPEED;
        if (right) inputVelocity += CONFIG.MOVE_SPEED;
        this.player.vx += (inputVelocity - this.player.vx) * 0.24;

        if (inputVelocity !== 0) this.player.facing = Math.sign(inputVelocity);
        if (this.player.onGround) this.coyoteFrames = CONFIG.COYOTE_FRAMES;
        else this.coyoteFrames = Math.max(0, this.coyoteFrames - 1);

        if (this.jumpBufferFrames > 0) this.jumpBufferFrames--;
        if (this.jumpBufferFrames > 0 && this.coyoteFrames > 0) {
            this.player.vy = CONFIG.JUMP_FORCE;
            this.player.onGround = false;
            this.coyoteFrames = 0;
            this.jumpBufferFrames = 0;
            this.audio.play('jump');
            this.emitDust(this.player.x, this.player.y, 5);
        }

        if (!jump && this.player.vy < -5.6) this.player.vy *= 0.86;
    }

    updatePlayer(delta) {
        if (this.player.onVine) {
            const vine = this.player.onVine;
            this.player.x = vine.x + vine.grip.x;
            this.player.y = vine.y + vine.grip.y + 8;
            this.player.rotation = -vine.angle * 0.3;
            this.playerShadow.alpha = 0.12;
            this.updatePlayerAnimation(delta, 0);
            return;
        }

        const wasOnGround = this.player.onGround;
        const autoSpeed = Math.min(
            CONFIG.MAX_SCROLL_SPEED,
            CONFIG.BASE_SCROLL_SPEED + this.distance / 520
        );
        this.player.vy += CONFIG.GRAVITY * delta;
        this.player.x += (autoSpeed + this.player.vx) * delta;
        this.player.y += this.player.vy * delta;
        this.player.x = Math.max(this.cameraX + 44, this.player.x);

        let onPlatform = false;
        for (const platform of this.platforms) {
            const previousY = this.player.y - this.player.vy * delta;
            if (
                this.player.vy >= 0 &&
                this.player.x > platform.x - 8 &&
                this.player.x < platform.x + platform.platformWidth + 8 &&
                this.player.y >= platform.y &&
                previousY <= platform.y + 6
            ) {
                this.player.y = platform.y;
                this.player.vy = 0;
                this.player.onGround = true;
                onPlatform = true;
                break;
            }
        }

        if (!onPlatform && this.player.y >= CONFIG.GROUND_Y) {
            const pit = this.obstacles.find((obstacle) => (
                obstacle.type === 'pit' &&
                this.player.x > obstacle.x + 12 &&
                this.player.x < obstacle.x + obstacle.hitWidth - 12
            ));
            if (pit) {
                this.player.onGround = false;
                if (this.player.y > CONFIG.GROUND_Y + 95) this.takeDamage(pit);
            } else {
                this.player.y = CONFIG.GROUND_Y;
                this.player.vy = 0;
                this.player.onGround = true;
                if (!wasOnGround) {
                    this.audio.play('land');
                    this.emitDust(this.player.x, this.player.y, 7);
                }
            }
        } else if (!onPlatform) {
            this.player.onGround = false;
        }

        this.player.rotation += (0 - this.player.rotation) * 0.18;
        this.player.scale.x = this.player.facing;
        this.player.scale.y += (1 - this.player.scale.y) * 0.2;
        this.playerShadow.x = this.player.x;
        this.playerShadow.y = CONFIG.GROUND_Y + 8;
        const height = Math.max(0, CONFIG.GROUND_Y - this.player.y);
        this.playerShadow.scale.x = Math.max(0.45, 1 - height / 260);
        this.playerShadow.alpha = Math.max(0.08, 0.28 - height / 600);

        this.distance = Math.max(0, Math.floor((this.player.x - 150) / 10));
        this.updatePlayerAnimation(delta, autoSpeed + Math.abs(this.player.vx));
        if (this.invincibleFrames > 0) {
            this.invincibleFrames -= delta;
            this.player.alpha = Math.floor(this.invincibleFrames / 5) % 2 ? 0.35 : 1;
        } else {
            this.player.alpha = 1;
        }
    }

    updatePlayerAnimation(delta, speed) {
        const time = this.app.ticker.lastTime / 1000;
        const visual = this.player.visual;
        const frameRate = 7.5 + Math.min(4.5, speed * 0.52);
        const runFrame = Math.floor(time * frameRate) % this.playerRunTextures.length;
        const nextPose = this.player.onGround ? `run-${runFrame}` : 'jump';
        if (this.player.pose !== nextPose) {
            this.player.pose = nextPose;
            const texture = nextPose === 'jump'
                ? this.playerJumpTexture
                : this.playerRunTextures[runFrame];
            this.player.sprite.texture = texture;
            this.player.rim.texture = texture;
        }
        let targetY = 0;
        let targetRotation = 0;
        let targetScaleX = 1;
        let targetScaleY = 1;

        if (this.player.onGround && speed > 0.4) {
            const gaitPhase = time * frameRate * Math.PI * 0.5;
            const stride = Math.sin(gaitPhase);
            targetY = Math.abs(stride) * 2.2;
            targetRotation = stride * 0.022;
            targetScaleX = 1 + Math.abs(stride) * 0.018;
            targetScaleY = 1 - Math.abs(stride) * 0.015;
        } else if (this.player.onVine) {
            targetY = -2;
            targetRotation = -0.1;
            targetScaleX = 0.96;
            targetScaleY = 1.04;
        } else {
            targetRotation = Math.max(-0.14, Math.min(0.12, this.player.vy * 0.012));
            targetScaleX = 1.035;
            targetScaleY = 0.97;
        }

        visual.y += (targetY - visual.y) * 0.3 * delta;
        visual.rotation += (targetRotation - visual.rotation) * 0.22 * delta;

        const base = this.player.baseSpriteScale;
        this.player.sprite.scale.x += (base * targetScaleX - this.player.sprite.scale.x) * 0.22 * delta;
        this.player.sprite.scale.y += (base * targetScaleY - this.player.sprite.scale.y) * 0.22 * delta;
        this.player.rim.scale.x = this.player.sprite.scale.x * 1.045;
        this.player.rim.scale.y = this.player.sprite.scale.y * 1.045;
        this.player.rim.alpha = 0.14 + Math.min(0.12, speed * 0.012);
        this.player.aura.alpha = 0.72 + Math.sin(time * 2.4) * 0.16;
        this.player.aura.scale.set(1 + Math.sin(time * 1.8) * 0.035);
        this.updatePlayerTrails(speed, delta);
    }

    updatePlayerTrails(speed, delta) {
        const shouldShow = !this.reducedMotion && (
            !this.player.onGround || speed > CONFIG.BASE_SCROLL_SPEED + 2.7
        );
        this.playerTrails.forEach((trail, index) => {
            const targetAlpha = shouldShow ? 0.1 - index * 0.032 : 0;
            trail.alpha += (targetAlpha - trail.alpha) * 0.18 * delta;
            trail.texture = this.player.sprite.texture;
            trail.x = this.player.x - this.player.facing * (12 + index * 11);
            trail.y = this.player.y + this.player.visual.y + index * 1.5;
            trail.rotation = this.player.rotation + this.player.visual.rotation;
            const trailScale = this.player.baseSpriteScale * (1 - index * 0.025);
            trail.scale.set(trailScale * this.player.facing, trailScale);
        });
    }

    updateObstacles(delta) {
        const time = this.app.ticker.lastTime / 1000;
        for (const obstacle of this.obstacles) {
            if (obstacle.type === 'crocodile') {
                obstacle.y = CONFIG.GROUND_Y - 15 + Math.sin(time * 2.2 + obstacle.phase) * 2;
                obstacle.jaw.rotation = 0.08 + Math.max(0, Math.sin(time * 3 + obstacle.phase)) * 0.35;
            } else if (obstacle.type === 'log') {
                obstacle.x += obstacle.vx * delta;
                obstacle.rotation += obstacle.vx * 0.012 * delta;
            }
        }
    }

    updateCollectibles(delta) {
        const time = this.app.ticker.lastTime / 1000;
        for (const collectible of this.collectibles) {
            collectible.y = collectible.baseY + Math.sin(time * 2.6 + collectible.phase) * 7;
            collectible.rotation = Math.sin(time * 1.8 + collectible.phase) * 0.12;
            const pulse = 1 + Math.sin(time * 4 + collectible.phase) * 0.12;
            collectible.glow.scale.set(pulse);
        }
    }

    updateVines(delta) {
        for (const vine of this.vines) {
            vine.angularVelocity += -Math.sin(vine.angle) * 0.00055 * delta;
            vine.angularVelocity *= 0.997;
            vine.angle += vine.angularVelocity * delta;
            this.drawVine(vine);
        }
    }

    updateCamera() {
        const target = Math.max(0, this.player.x - CONFIG.WIDTH * 0.31);
        this.cameraX += (target - this.cameraX) * 0.085;
        this.world.x = -this.cameraX;
        for (const layer of this.parallaxLayers) {
            layer.container.x = -((this.cameraX * layer.speed) % layer.width);
        }
    }

    checkCollisions() {
        const bounds = {
            x: this.player.x - 17,
            y: this.player.y - 97,
            width: 34,
            height: 95
        };

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            const dx = this.player.x - collectible.x;
            const dy = this.player.y - 48 - collectible.y;
            if (dx * dx + dy * dy < 33 * 33) {
                this.score += collectible.value;
                this.collectCount++;
                this.createCollectEffect(collectible.x, collectible.y, collectible.type);
                this.audio.play(collectible.type === 'relic' ? 'relic' : 'coin');
                this.removeFromWorld(collectible, this.collectibles, i);
                if (this.collectCount % 8 === 0) this.showToast('Sequência de exploração +250');
            }
        }

        if (this.invincibleFrames <= 0) {
            for (const obstacle of this.obstacles) {
                if (!['crocodile', 'log', 'ruin'].includes(obstacle.type)) continue;
                const obstacleBounds = {
                    x: obstacle.x - obstacle.hitWidth / 2,
                    y: obstacle.y - obstacle.hitHeight,
                    width: obstacle.hitWidth,
                    height: obstacle.hitHeight
                };
                if (this.rectIntersect(bounds, obstacleBounds)) {
                    if (obstacle.type === 'log' && this.player.vy > 3 && this.player.y < obstacle.y - 8) {
                        this.player.y = obstacle.y - obstacle.hitHeight;
                        this.player.vy = CONFIG.JUMP_FORCE * 0.72;
                        this.score += 25;
                        this.showToast('Salto perfeito +25');
                    } else {
                        this.takeDamage(obstacle);
                    }
                    break;
                }
            }
        }

        if (!this.player.onVine) {
            const grabRequested = this.keys.ArrowUp || this.keys.KeyW || this.keys.Space || this.touch.jump;
            if (grabRequested) {
                for (const vine of this.vines) {
                    const endX = vine.x + vine.grip.x;
                    const endY = vine.y + vine.grip.y;
                    const dx = this.player.x - endX;
                    const dy = this.player.y - 48 - endY;
                    if (dx * dx + dy * dy < 47 * 47) {
                        this.player.onVine = vine;
                        this.player.vy = 0;
                        vine.angularVelocity += this.player.vx * 0.001;
                        this.jumpBufferFrames = 0;
                        this.showToast('Cipó agarrado · solte para saltar');
                        break;
                    }
                }
            }
        } else if (!this.player.jumpHeld) {
            this.releaseVine();
        }
    }

    releaseVine() {
        const vine = this.player.onVine;
        if (!vine) return;
        this.player.onVine = null;
        this.player.vx = Math.cos(vine.angle) * vine.angularVelocity * vine.ropeLength * 3.2;
        this.player.vy = -8.5 + Math.sin(vine.angle) * 2;
        this.player.jumpHeld = false;
        this.audio.play('jump');
    }

    rectIntersect(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    takeDamage(source) {
        if (this.invincibleFrames > 0 || this.state !== 'playing') return;
        this.lives--;
        this.invincibleFrames = 115;
        this.player.onVine = null;
        this.player.vy = -9;
        this.player.vx = -5;
        this.player.scale.y = 0.82;
        this.emitImpact(this.player.x, this.player.y - 28);
        this.audio.play('hit');
        this.announce(`Você perdeu uma vida. ${this.lives} restantes.`);

        if (source?.type === 'pit') {
            this.player.x = Math.max(this.cameraX + 170, source.x - 70);
            this.player.y = CONFIG.GROUND_Y - 95;
        }

        if (this.lives <= 0) this.gameOver();
    }

    createCollectEffect(x, y, type) {
        const container = new PIXI.Container();
        const color = type === 'relic' ? 0x65efbc : 0xf6cf69;
        const count = this.reducedMotion ? 5 : 11;
        for (let i = 0; i < count; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 2 + Math.random() * 2.5).fill(color);
            particle.x = x;
            particle.y = y;
            particle.vx = (Math.random() - 0.5) * 7;
            particle.vy = (Math.random() - 0.5) * 7 - 2;
            container.addChild(particle);
        }
        this.world.addChild(container);
        this.effects.push({ container, life: 30, maxLife: 30, gravity: 0.13 });
    }

    emitDust(x, y, amount) {
        if (this.reducedMotion) return;
        const container = new PIXI.Container();
        for (let i = 0; i < amount; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 2 + Math.random() * 3).fill({ color: 0xa3bd78, alpha: 0.48 });
            particle.x = x + (Math.random() - 0.5) * 24;
            particle.y = y + Math.random() * 5;
            particle.vx = -1.2 - Math.random() * 2.2;
            particle.vy = -0.5 - Math.random() * 1.4;
            container.addChild(particle);
        }
        this.world.addChild(container);
        this.effects.push({ container, life: 22, maxLife: 22, gravity: 0.02 });
    }

    emitImpact(x, y) {
        const container = new PIXI.Container();
        for (let i = 0; i < 9; i++) {
            const particle = new PIXI.Graphics();
            particle.rect(-3, -3, 6, 6).fill(i % 2 ? 0xf06b4f : 0xf6cf69);
            particle.x = x;
            particle.y = y;
            const angle = (Math.PI * 2 * i) / 9;
            particle.vx = Math.cos(angle) * 5;
            particle.vy = Math.sin(angle) * 5;
            container.addChild(particle);
        }
        this.world.addChild(container);
        this.effects.push({ container, life: 24, maxLife: 24, gravity: 0.1 });
    }

    updateEffects(delta) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life -= delta;
            effect.container.alpha = Math.max(0, effect.life / effect.maxLife);
            for (const particle of effect.container.children) {
                particle.x += particle.vx * delta;
                particle.y += particle.vy * delta;
                particle.vy += effect.gravity * delta;
                particle.rotation += 0.08 * delta;
            }
            if (effect.life <= 0) {
                this.world.removeChild(effect.container);
                this.effects.splice(i, 1);
            }
        }
    }

    gameOver() {
        this.state = 'over';
        this.releaseInputs();
        const isRecord = this.distance > this.bestDistance;
        this.bestDistance = Math.max(this.bestDistance, this.distance);
        this.bestScore = Math.max(this.bestScore, this.score);
        this.saveNumber('jungleRunBestDistance', this.bestDistance);
        this.saveNumber('jungleRunBestScore', this.bestScore);

        document.getElementById('finalScore').textContent = this.pad(this.score, 4);
        document.getElementById('finalDistance').textContent = `${this.pad(this.distance, 3)}m`;
        document.getElementById('finalBest').textContent = `${this.pad(this.bestDistance, 3)}m`;
        document.getElementById('resultEyebrow').textContent = isRecord ? 'NOVO RECORDE DE EXPEDIÇÃO' : 'FIM DA EXPEDIÇÃO';
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('gameOverScreen').setAttribute('aria-hidden', 'false');
        document.getElementById('hud').classList.add('is-dimmed');
        document.getElementById('mobileControls').classList.add('is-hidden');
        document.getElementById('restartBtn').focus();
        this.announce(`Fim da expedição. ${this.distance} metros e ${this.score} pontos.`);
    }

    spawnNewContent() {
        while (this.lastSpawnX < this.player.x + CONFIG.SPAWN_AHEAD) {
            this.spawnSegment(this.lastSpawnX);
            this.lastSpawnX += CONFIG.SEGMENT_WIDTH;
            if (this.lastSpawnX % 2240 === 0) {
                for (let i = 0; i < 5; i++) this.spawnCollectible(this.lastSpawnX + i * 48, i === 4);
            }
        }
    }

    cleanupOffscreen() {
        const threshold = this.cameraX - 260;
        const cleanup = (array) => {
            for (let i = array.length - 1; i >= 0; i--) {
                const object = array[i];
                const rightEdge = object.x + (object.hitWidth || object.platformWidth || 0);
                if (rightEdge < threshold) this.removeFromWorld(object, array, i);
            }
        };
        cleanup(this.obstacles);
        cleanup(this.collectibles);
        cleanup(this.vines);
        cleanup(this.platforms);
    }

    removeFromWorld(object, array, index) {
        if (object.parent) object.parent.removeChild(object);
        array.splice(index, 1);
    }

    syncHud(force = false) {
        const next = {
            score: this.pad(this.score, 4),
            lives: this.lives,
            distance: `${this.pad(this.distance, 3)}m`
        };

        if (force || this.uiCache.score !== next.score) {
            document.getElementById('score').textContent = next.score;
        }
        if (force || this.uiCache.lives !== next.lives) {
            const hearts = Array.from({ length: 3 }, (_, index) => index < this.lives ? '●' : '○').join(' ');
            const livesElement = document.getElementById('lives');
            livesElement.textContent = hearts;
            livesElement.setAttribute('aria-label', `${this.lives} ${this.lives === 1 ? 'vida' : 'vidas'}`);
        }
        if (force || this.uiCache.distance !== next.distance) {
            document.getElementById('distance').textContent = next.distance;
        }

        const biomeIndex = BIOMES.reduce((index, biome, candidate) => (
            this.distance >= biome.at ? candidate : index
        ), 0);
        if (force || biomeIndex !== this.currentBiome) {
            this.currentBiome = biomeIndex;
            document.getElementById('biomeLabel').textContent = BIOMES[biomeIndex].name;
            if (!force && biomeIndex > 0) {
                this.showToast(`Nova área · ${BIOMES[biomeIndex].name}`);
                this.audio.play('milestone');
            }
        }

        const biome = BIOMES[biomeIndex];
        const nextBiome = BIOMES[biomeIndex + 1];
        const progress = nextBiome
            ? ((this.distance - biome.at) / (nextBiome.at - biome.at)) * 100
            : Math.min(100, 60 + ((this.distance - biome.at) % 400) / 10);
        document.getElementById('progressFill').style.width = `${Math.max(0, Math.min(100, progress))}%`;
        this.uiCache = next;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
    }

    announce(message) {
        document.getElementById('gameAnnouncer').textContent = message;
    }

    pad(value, size) {
        return String(Math.max(0, Math.floor(value))).padStart(size, '0');
    }
}

window.addEventListener('load', () => new JungleRun(), { once: true });
