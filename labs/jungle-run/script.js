const CONFIG = Object.freeze({
    WIDTH: 960,
    HEIGHT: 600,
    GROUND_Y: 455,
    GRAVITY: 0.72,
    JUMP_FORCE: -14.2,
    MOVE_SPEED: 5.4,
    BASE_SCROLL_SPEED: 2.3,
    MAX_SCROLL_SPEED: 5.2,
    SEGMENT_WIDTH: 320,
    SPAWN_AHEAD: 1900,
    COYOTE_FRAMES: 7,
    JUMP_BUFFER_FRAMES: 8,
    CLIMB_SPEED: 0.018
});

const LEVELS = [
    {
        id: 1,
        name: 'Trilha do Alvorecer',
        distanceGoal: 250,
        baseSpeed: 2.3,
        maxSpeed: 3.5,
        allowedObstacles: ['log', 'pit'],
        bgColor: 0x07150f,
        description: 'Uma trilha inicial tranquila pela selva ao amanhecer. Desvie de troncos e buracos.'
    },
    {
        id: 2,
        name: 'Dossel Esmeralda',
        distanceGoal: 350,
        baseSpeed: 2.8,
        maxSpeed: 4.2,
        allowedObstacles: ['log', 'pit', 'vine', 'platform', 'tree'],
        bgColor: 0x051d12,
        description: 'Suba pelas árvores e copas. Use árvores escaláveis, cipós e plataformas para cruzar abismos.'
    },
    {
        id: 3,
        name: 'Ruínas Submersas',
        distanceGoal: 450,
        baseSpeed: 3.2,
        maxSpeed: 4.8,
        allowedObstacles: ['log', 'pit', 'vine', 'platform', 'crocodile', 'tree'],
        bgColor: 0x04191c,
        description: 'Antigas ruínas tomadas pelas águas. Escale árvores e cuidado com jacarés nos pântanos.'
    },
    {
        id: 4,
        name: 'Templo da Lua',
        distanceGoal: 550,
        baseSpeed: 3.6,
        maxSpeed: 5.4,
        allowedObstacles: ['log', 'pit', 'vine', 'platform', 'crocodile', 'ruin', 'tree'],
        bgColor: 0x0a1624,
        description: 'O templo sagrado. O desafio definitivo com velocidade extrema e perigos combinados.'
    },
    {
        id: 5,
        name: 'Modo Infinito',
        distanceGoal: Infinity,
        baseSpeed: 2.5,
        maxSpeed: 6.0,
        allowedObstacles: ['log', 'pit', 'vine', 'platform', 'crocodile', 'ruin', 'tree'],
        bgColor: 0x081015,
        description: 'A selva não tem fim. Corra o mais longe que conseguir neste desafio eterno.'
    }
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
        } catch {}
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
            land: [90, 55, 0.08, 'sine', 0.025],
            victory: [440, 880, 0.5, 'triangle', 0.06]
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
        this.touch = { left: false, right: false, jump: false, climbUp: false, climbDown: false };
        
        // Game stats
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.cameraX = 0;
        this.lastSpawnX = 0;
        this.invincibleFrames = 0;
        this.coyoteFrames = 0;
        this.jumpBufferFrames = 0;
        this.collectCount = 0;
        this.spawnedCollectiblesCount = 0;
        
        // Level management
        this.unlockedLevel = this.readNumber('jungleRunUnlockedLevel') || 1;
        this.selectedLevelIndex = 0;
        this.currentLevel = LEVELS[0];
        
        // Lists
        this.effects = [];
        this.obstacles = [];
        this.collectibles = [];
        this.vines = [];
        this.platforms = [];
        this.trees = [];
        this.parallaxLayers = [];
        this.uiCache = {};
        
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
        } catch {}
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

            // Load all textures (Realistic Assets + Dedicated Climbing Sprites & Tree Trunk)
            const textures = await Promise.all([
                PIXI.Assets.load('./assets/explorer-run.png'),
                PIXI.Assets.load('./assets/explorer-jump.png'),
                PIXI.Assets.load('./assets/explorer-run-contact.png'),
                PIXI.Assets.load('./assets/explorer-run-down.png'),
                PIXI.Assets.load('./assets/explorer-run-passing.png'),
                PIXI.Assets.load('./assets/obstacle-crocodile.png'),
                PIXI.Assets.load('./assets/obstacle-log.png'),
                PIXI.Assets.load('./assets/obstacle-ruin.png'),
                PIXI.Assets.load('./assets/collectible-relic.png'),
                PIXI.Assets.load('./assets/collectible-coin.png'),
                PIXI.Assets.load('./assets/platform.png'),
                PIXI.Assets.load('./assets/moon.png'),
                PIXI.Assets.load('./assets/background-layer1.png'),
                PIXI.Assets.load('./assets/background-layer2.png'),
                PIXI.Assets.load('./assets/background-layer3.png'),
                PIXI.Assets.load('./assets/explorer-climb-1.png'),
                PIXI.Assets.load('./assets/explorer-climb-2.png'),
                PIXI.Assets.load('./assets/tree-trunk.png')
            ]);

            this.playerTexture = textures[0];
            this.playerJumpTexture = textures[1];
            this.playerRunTextures = [textures[2], textures[3], textures[4], textures[0]];
            
            this.crocodileTexture = textures[5];
            this.logTexture = textures[6];
            this.ruinTexture = textures[7];
            this.relicTexture = textures[8];
            this.coinTexture = textures[9];
            this.platformTexture = textures[10];
            this.moonTexture = textures[11];
            
            this.bgLayer1 = textures[12];
            this.bgLayer2 = textures[13];
            this.bgLayer3 = textures[14];

            this.playerClimbTextures = [textures[15], textures[16]];
            this.treeTrunkTexture = textures[17];

            this.createBackdrop();
            this.createWorld();
            this.setupEventListeners();
            
            // Build the levels selector cards in startScreen
            this.renderLevelSelector();

            this.app.ticker.add(this.gameLoop, this);
            this.state = 'intro';
            this.syncHud(true);
            
            // Enabled start expedition
            document.getElementById('startBtn').disabled = false;
        } catch (error) {
            console.error('Jungle Run overhaul initialization failed:', error);
            const startBtn = document.getElementById('startBtn');
            // A causa mais comum aqui não é bug de código: é o PixiJS não ter chegado da CDN
            // (rede bloqueada, offline, extensão que corta scripts de terceiros). Distinguir os
            // dois casos evita o jogador ficar olhando uma tela preta sem saber o motivo.
            const missingEngine = typeof PIXI === 'undefined';
            if (startBtn) {
                startBtn.disabled = true;
                const label = startBtn.querySelector('span');
                if (label) {
                    label.textContent = missingEngine ? 'Motor gráfico indisponível' : 'Erro ao carregar texturas';
                }
            }
            const overlay = document.querySelector('#startScreen .overlay-content') ||
                document.getElementById('startScreen');
            if (overlay && !overlay.querySelector('.jr-load-error')) {
                const msg = document.createElement('p');
                msg.className = 'jr-load-error';
                msg.setAttribute('role', 'alert');
                msg.textContent = missingEngine
                    ? 'Não foi possível carregar o motor gráfico (PixiJS). Verifique sua conexão e recarregue a página.'
                    : 'Não foi possível carregar os recursos do jogo. Recarregue a página para tentar de novo.';
                overlay.appendChild(msg);
            }
        }
    }

    renderLevelSelector() {
        const grid = document.getElementById('levelGrid');
        grid.innerHTML = '';
        
        LEVELS.forEach((level, idx) => {
            const isLocked = idx > 0 && level.id > this.unlockedLevel && level.id !== 5;
            const isEndlessLocked = level.id === 5 && this.unlockedLevel < 4;
            
            const locked = isLocked || isEndlessLocked;
            const recordScore = this.readNumber(`jungleRunBestScore_lvl_${level.id}`);
            
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `level-card ${locked ? 'locked' : ''} ${idx === this.selectedLevelIndex ? 'selected' : ''}`;
            card.disabled = locked;
            
            card.innerHTML = `
                <span class="level-card-number">EXPEDIÇÃO 0${level.id}</span>
                <h4 class="level-card-title">${level.name}</h4>
                <p class="level-card-desc">${level.description}</p>
                <div class="level-card-meta">
                    <span>Meta: ${level.distanceGoal === Infinity ? 'Infinito' : level.distanceGoal + 'm'}</span>
                    <span>Recorde: ${recordScore > 0 ? recordScore : '---'}</span>
                </div>
                ${locked ? '<span class="level-card-lock-icon">🔒</span>' : ''}
            `;
            
            if (!locked) {
                card.addEventListener('click', () => {
                    this.audio.play('select');
                    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedLevelIndex = idx;
                    this.currentLevel = level;
                    
                    document.getElementById('startBtn').querySelector('span').textContent = `Iniciar: ${level.name}`;
                });
            }
            
            grid.appendChild(card);
        });

        this.currentLevel = LEVELS[this.selectedLevelIndex];
        document.getElementById('startBtn').querySelector('span').textContent = `Iniciar: ${this.currentLevel.name}`;
        
        const generalRecord = this.readNumber('jungleRunBestScore');
        document.getElementById('bestScore').textContent = this.pad(generalRecord, 4);
    }

    createBackdrop() {
        const sky = new PIXI.Graphics();
        sky.rect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT).fill(0x040c0b);
        this.app.stage.addChild(sky);

        const moon = new PIXI.Sprite(this.moonTexture);
        moon.anchor.set(0.5);
        moon.x = 760;
        moon.y = 110;
        moon.width = 100;
        moon.height = 100;
        this.app.stage.addChild(moon);

        const stars = new PIXI.Graphics();
        const random = this.seededRandom(42);
        for (let i = 0; i < 60; i++) {
            const x = random() * CONFIG.WIDTH;
            const y = 15 + random() * 220;
            const radius = random() > 0.88 ? 1.5 : 0.8;
            stars.circle(x, y, radius).fill({ color: 0xfffcd8, alpha: 0.2 + random() * 0.6 });
        }
        this.app.stage.addChild(stars);

        this.createParallaxLayer(this.bgLayer3, 0.08, 200, 400);
        this.createParallaxLayer(this.bgLayer2, 0.20, 150, 450);
        this.createParallaxLayer(this.bgLayer1, 0.45, 100, 500);
    }

    createParallaxLayer(texture, speed, y, height) {
        const tilingSprite = new PIXI.TilingSprite({
            texture: texture,
            width: CONFIG.WIDTH + 320,
            height: height
        });
        tilingSprite.y = y;
        tilingSprite.tileScale.set(1);
        tilingSprite.alpha = speed === 0.08 ? 0.35 : (speed === 0.20 ? 0.55 : 0.75);
        this.app.stage.addChild(tilingSprite);
        this.parallaxLayers.push({ sprite: tilingSprite, speed });
    }

    seededRandom(seed) {
        let value = seed >>> 0;
        return () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 4294967296;
        };
    }

    createWorld() {
        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);

        this.ground = new PIXI.Graphics();
        this.ground.rect(0, CONFIG.GROUND_Y, 100000, CONFIG.HEIGHT - CONFIG.GROUND_Y).fill(0x0e1713);
        this.ground.rect(0, CONFIG.GROUND_Y, 100000, 10).fill(0x386d3b);
        this.ground.rect(0, CONFIG.GROUND_Y + 10, 100000, 6).fill(0x1a3a22);
        
        for (let x = 0; x < 100000; x += 32) {
            const height = 4 + (x % 11);
            this.ground.moveTo(x, CONFIG.GROUND_Y);
            this.ground.lineTo(x + 5, CONFIG.GROUND_Y - height);
            this.ground.lineTo(x + 10, CONFIG.GROUND_Y);
            this.ground.fill(x % 64 ? 0x2e602f : 0x51914b);
        }
        this.world.addChild(this.ground);

        this.groundDecor = new PIXI.Container();
        this.world.addChild(this.groundDecor);
        for (let x = 60; x < 6000; x += 180) {
            this.createGroundFern(x);
        }

        this.playerShadow = new PIXI.Graphics();
        this.playerShadow.ellipse(0, 0, 32, 7).fill({ color: 0x000603, alpha: 0.4 });
        this.world.addChild(this.playerShadow);

        this.createPlayer();
        this.spawnInitialContent();
    }

    createGroundFern(x) {
        const plant = new PIXI.Graphics();
        const color = x % 360 ? 0x1f4c2c : 0x367c48;
        plant.moveTo(0, 0).quadraticCurveTo(-8, -20, -15, -26).stroke({ color, width: 3.5 });
        plant.moveTo(0, 0).quadraticCurveTo(6, -16, 15, -20).stroke({ color, width: 3 });
        plant.ellipse(-15, -26, 7, 3.5).fill(color);
        plant.ellipse(15, -20, 6.5, 3).fill(color);
        plant.x = x;
        plant.y = CONFIG.GROUND_Y + 4;
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
        this.player.onTree = null;
        this.player.climbProgress = 0.8;
        this.player.facing = 1;
        this.player.jumpHeld = false;

        const aura = new PIXI.Graphics();
        aura.ellipse(0, -48, 45, 55).fill({ color: 0x8bf2bd, alpha: 0.05 });
        aura.blendMode = 'add';
        this.player.addChild(aura);
        this.player.aura = aura;

        this.player.visual = new PIXI.Container();
        this.player.baseSpriteScale = 108 / this.playerTexture.height;
        this.player.pose = 'run-0';

        const rim = new PIXI.Sprite(this.playerTexture);
        rim.anchor.set(0.5, 0.98);
        rim.scale.set(this.player.baseSpriteScale * 1.03);
        rim.tint = 0x8df5c2;
        rim.alpha = 0.16;
        rim.blendMode = 'add';
        this.player.visual.addChild(rim);

        const sprite = new PIXI.Sprite(this.playerTexture);
        sprite.anchor.set(0.5, 0.98);
        sprite.scale.set(this.player.baseSpriteScale);
        this.player.visual.addChild(sprite);
        
        this.player.sprite = sprite;
        this.player.rim = rim;
        this.player.addChild(this.player.visual);

        this.playerTrails = [];
        for (let i = 0; i < 2; i++) {
            const trail = new PIXI.Sprite(this.playerTexture);
            trail.anchor.set(0.5, 0.98);
            trail.scale.set(this.player.baseSpriteScale);
            trail.tint = i === 0 ? 0x86e8b4 : 0xf0d080;
            trail.alpha = 0;
            trail.blendMode = 'add';
            this.world.addChild(trail);
            this.playerTrails.push(trail);
        }

        this.world.addChild(this.player);
    }

    setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS'].includes(event.code)) {
                event.preventDefault();
            }
            if (!event.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
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
        
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.advanceToNextLevel());
        document.getElementById('completeMenuBtn').addEventListener('click', () => this.backToMenu());

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

    spawnInitialContent() {
        this.spawnedCollectiblesCount = 0;
        for (let i = 0; i < 5; i++) {
            this.spawnCollectible(400 + i * 80, false);
        }
        for (let x = 800; x < CONFIG.SPAWN_AHEAD; x += CONFIG.SEGMENT_WIDTH) {
            this.spawnSegment(x);
        }
        this.lastSpawnX = CONFIG.SPAWN_AHEAD;
    }

    spawnSegment(x) {
        const allowed = this.currentLevel.allowedObstacles;
        const choices = [];
        
        if (allowed.includes('pit') && Math.random() < 0.22) choices.push('pit');
        if (allowed.includes('crocodile') && Math.random() < 0.25) choices.push('crocodile');
        if (allowed.includes('log') && Math.random() < 0.28) choices.push('log');
        if (allowed.includes('vine') && Math.random() < 0.24) choices.push('vine');
        if (allowed.includes('ruin') && Math.random() < 0.20) choices.push('ruin');
        if (allowed.includes('tree') && Math.random() < 0.26) choices.push('tree');

        if (choices.length > 0) {
            const select = choices[Math.floor(Math.random() * choices.length)];
            if (select === 'pit') this.spawnPit(x);
            else if (select === 'crocodile') this.spawnCrocodile(x + 50);
            else if (select === 'log') this.spawnLog(x + 80);
            else if (select === 'vine') this.spawnVine(x + 100);
            else if (select === 'ruin') this.spawnRuin(x + 60);
            else if (select === 'tree') this.spawnTree(x + 90);
        }

        if (allowed.includes('platform') && (choices.includes('pit') || choices.includes('tree')) && Math.random() < 0.6) {
            this.spawnPlatform(x + 40, CONFIG.GROUND_Y - 75, 110);
        }

        if (Math.random() < 0.65) {
            const count = Math.random() < 0.3 ? 3 : 1;
            const forceRelic = Math.random() < 0.15;
            for (let i = 0; i < count; i++) {
                this.spawnCollectible(x + 60 + i * 50, forceRelic && i === 0);
            }
        }
    }

    spawnTree(x) {
        const tree = new PIXI.Sprite(this.treeTrunkTexture);
        tree.anchor.set(0.5, 1.0);
        tree.x = x;
        tree.y = CONFIG.GROUND_Y + 5;
        tree.width = 65;
        tree.height = 320;
        tree.type = 'tree';
        tree.hitWidth = 50;
        tree.hitHeight = 310;
        
        this.world.addChild(tree);
        this.trees.push(tree);
    }

    spawnPlatform(x, y, width) {
        const platform = new PIXI.Sprite(this.platformTexture);
        platform.x = x;
        platform.y = y;
        platform.width = width;
        platform.height = 20;
        platform.type = 'platform';
        platform.platformWidth = width;
        this.world.addChild(platform);
        this.platforms.push(platform);
    }

    spawnPit(x) {
        const width = 110 + Math.random() * 50;
        const pit = new PIXI.Graphics();
        pit.rect(0, -2, width, 150).fill(0x020705);
        pit.rect(6, 12, width - 12, 126).fill({ color: 0x1b3528, alpha: 0.25 });
        
        for (let i = 6; i < width - 6; i += 16) {
            pit.moveTo(i, 8).lineTo(i + 5, -8).lineTo(i + 10, 8).fill(0x0e1a13);
        }
        
        pit.x = x;
        pit.y = CONFIG.GROUND_Y;
        pit.type = 'pit';
        pit.hitWidth = width;
        
        this.world.addChild(pit);
        this.obstacles.push(pit);
    }

    spawnCrocodile(x) {
        const croc = new PIXI.Sprite(this.crocodileTexture);
        croc.anchor.set(0.5, 1.0);
        croc.x = x;
        croc.y = CONFIG.GROUND_Y + 2;
        croc.width = 110;
        croc.height = 45;
        croc.type = 'crocodile';
        croc.hitWidth = 92;
        croc.hitHeight = 28;
        croc.phase = Math.random() * Math.PI * 2;
        croc.startY = croc.y;
        
        this.world.addChild(croc);
        this.obstacles.push(croc);
    }

    spawnLog(x) {
        const log = new PIXI.Sprite(this.logTexture);
        log.anchor.set(0.5);
        log.x = x;
        log.y = CONFIG.GROUND_Y - 17;
        log.width = 76;
        log.height = 38;
        log.type = 'log';
        log.hitWidth = 64;
        log.hitHeight = 30;
        log.vx = -(1.2 + Math.random() * 0.9 + (this.distance / 400));
        
        this.world.addChild(log);
        this.obstacles.push(log);
    }

    spawnRuin(x) {
        const ruin = new PIXI.Sprite(this.ruinTexture);
        ruin.anchor.set(0.5, 1.0);
        ruin.x = x;
        ruin.y = CONFIG.GROUND_Y + 3;
        ruin.width = 72;
        ruin.height = 108;
        ruin.type = 'ruin';
        ruin.hitWidth = 40;
        ruin.hitHeight = 85;
        
        this.world.addChild(ruin);
        this.obstacles.push(ruin);
    }

    spawnVine(x) {
        const vine = new PIXI.Container();
        const ropeLine = new PIXI.Graphics();
        const grip = new PIXI.Graphics();
        grip.circle(0, 0, 9).fill(0x386d3b).stroke({ color: 0x091c10, width: 2.5 });
        
        vine.addChild(ropeLine, grip);
        vine.x = x;
        vine.y = 40;
        vine.type = 'vine';
        vine.rope = ropeLine;
        vine.grip = grip;
        vine.ropeLength = 250 + Math.random() * 35;
        vine.angle = -0.36 + Math.random() * 0.25;
        vine.angularVelocity = 0.011 + Math.random() * 0.005;
        
        vine.leaves = [];
        const leafCount = 6;
        for (let i = 0; i < leafCount; i++) {
            const leaf = new PIXI.Graphics();
            const side = i % 2 === 0 ? 1 : -1;
            leaf.ellipse(0, 0, 8, 3.5).fill(0x51914b).stroke({ color: 0x1a3a22, width: 1.5 });
            leaf.pivot.set(side * 8, 0);
            leaf.rotation = side * (0.3 + Math.random() * 0.3);
            vine.addChild(leaf);
            vine.leaves.push({ leaf, ratio: 0.15 + (i / leafCount) * 0.75, side });
        }

        this.drawVine(vine);
        this.world.addChild(vine);
        this.vines.push(vine);
    }

    drawVine(vine) {
        const endX = Math.sin(vine.angle) * vine.ropeLength;
        const endY = Math.cos(vine.angle) * vine.ropeLength;
        
        vine.rope.clear();
        vine.rope.moveTo(0, 0).quadraticCurveTo(endX * 0.45 - 8, endY * 0.45, endX, endY)
            .stroke({ color: 0x0e2815, width: 8 });
        vine.rope.moveTo(0, 0).quadraticCurveTo(endX * 0.45 - 8, endY * 0.45, endX, endY)
            .stroke({ color: 0x3d7e48, width: 3.5 });
            
        vine.grip.x = endX;
        vine.grip.y = endY;

        vine.leaves.forEach(item => {
            const r = item.ratio;
            const curX = Math.sin(vine.angle) * (vine.ropeLength * r);
            const curY = Math.cos(vine.angle) * (vine.ropeLength * r);
            item.leaf.x = curX;
            item.leaf.y = curY;
            item.leaf.rotation = vine.angle + item.side * 0.4;
        });
    }

    spawnCollectible(x, isRelic = false) {
        const coll = new PIXI.Sprite(isRelic ? this.relicTexture : this.coinTexture);
        coll.anchor.set(0.5);
        coll.x = x;
        coll.baseY = CONFIG.GROUND_Y - 60 - Math.random() * 90;
        coll.y = coll.baseY;
        coll.width = isRelic ? 36 : 30;
        coll.height = isRelic ? 36 : 30;
        coll.type = isRelic ? 'relic' : 'coin';
        coll.value = isRelic ? 250 : 50;
        coll.phase = Math.random() * Math.PI * 2;
        
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, isRelic ? 24 : 18).fill({ color: isRelic ? 0x8bf2bd : 0xf0ce72, alpha: 0.15 });
        coll.addChild(glow);
        coll.glow = glow;

        this.world.addChild(coll);
        this.collectibles.push(coll);
        this.spawnedCollectiblesCount++;
    }

    async startExpedition() {
        if (this.state !== 'intro') return;
        this.audio.ensureContext();
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('mobileControls').classList.remove('is-hidden');
        this.state = 'countdown';
        await this.runCountdown();
        if (this.state !== 'countdown') return;
        
        this.score = 0;
        this.distance = 0;
        this.lives = 3;
        this.cameraX = 0;
        this.lastSpawnX = 0;
        this.collectCount = 0;
        
        this.player.x = 150;
        this.player.y = CONFIG.GROUND_Y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onVine = null;
        this.player.onTree = null;
        
        this.app.renderer.background.color = this.currentLevel.bgColor;

        this.state = 'playing';
        this.invincibleFrames = 90;
        this.syncHud(true);
        this.announce('Expedição iniciada');
    }

    async runCountdown() {
        const el = document.getElementById('countdown');
        el.classList.remove('hidden', 'go');
        for (const val of ['3', '2', '1']) {
            if (this.state !== 'countdown') break;
            el.textContent = val;
            this.audio.play('select');
            await new Promise(r => setTimeout(r, 450));
        }
        if (this.state === 'countdown') {
            el.textContent = 'VAI!';
            el.classList.add('go');
            this.audio.play('milestone');
            await new Promise(r => setTimeout(r, 350));
        }
        el.classList.add('hidden');
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
        this.invincibleFrames = 100;
        
        this.effects.forEach(e => this.world.removeChild(e.container));
        this.effects = [];
        
        [...this.obstacles, ...this.collectibles, ...this.vines, ...this.platforms, ...this.trees].forEach(obj => {
            if (obj.parent) obj.parent.removeChild(obj);
        });
        this.obstacles = [];
        this.collectibles = [];
        this.vines = [];
        this.platforms = [];
        this.trees = [];

        this.player.x = 150;
        this.player.y = CONFIG.GROUND_Y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onVine = null;
        this.player.onTree = null;
        this.player.alpha = 1;
        this.player.scale.set(1);
        this.world.x = 0;
        
        this.app.renderer.background.color = this.currentLevel.bgColor;
        
        this.spawnInitialContent();
        this.releaseInputs();

        ['pauseScreen', 'gameOverScreen', 'levelCompleteScreen', 'countdown'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
            document.getElementById(id).setAttribute('aria-hidden', 'true');
        });
        
        document.getElementById('hud').classList.remove('is-dimmed');
        document.getElementById('mobileControls').classList.remove('is-hidden');
        
        this.uiCache = {};
        this.syncHud(true);
        this.state = 'playing';
        this.audio.play('select');
        this.announce('Expedição reiniciada');
    }

    backToMenu() {
        ['pauseScreen', 'gameOverScreen', 'levelCompleteScreen'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
            document.getElementById(id).setAttribute('aria-hidden', 'true');
        });
        
        this.state = 'intro';
        this.renderLevelSelector();
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('hud').classList.remove('is-dimmed');
        document.getElementById('mobileControls').classList.add('is-hidden');
        this.announce('Menu principal');
    }

    advanceToNextLevel() {
        const currentIdx = LEVELS.findIndex(l => l.id === this.currentLevel.id);
        if (currentIdx >= 0 && currentIdx < LEVELS.length - 1) {
            this.selectedLevelIndex = currentIdx + 1;
            this.currentLevel = LEVELS[this.selectedLevelIndex];
            this.restartGame();
        } else {
            this.backToMenu();
        }
    }

    releaseInputs() {
        this.keys = Object.create(null);
        Object.keys(this.touch).forEach(k => { this.touch[k] = false; });
        document.querySelectorAll('.mobile-btn').forEach(b => b.classList.remove('is-active'));
    }

    gameLoop(ticker) {
        const delta = Math.min(ticker.deltaTime, 2);
        this.updateAmbient(delta);
        if (this.state !== 'playing') return;

        this.handleInput(delta);
        this.updatePlayer(delta);
        this.updateObstacles(delta);
        this.updateCollectibles(delta);
        this.updateVines(delta);
        this.updateEffects(delta);
        this.updateCamera();
        this.checkCollisions(delta);
        this.spawnNewContent();
        this.cleanupOffscreen();
        this.syncHud();
        this.checkVictoryCondition();
    }

    updateAmbient(delta) {}

    handleInput(delta) {
        const left = this.keys.ArrowLeft || this.keys.KeyA || this.touch.left;
        const right = this.keys.ArrowRight || this.keys.KeyD || this.touch.right;
        const jump = this.keys.Space || this.keys.ArrowUp || this.keys.KeyW || this.touch.jump;
        const climbUp = this.keys.KeyW || this.keys.ArrowUp || this.touch.climbUp;
        const climbDown = this.keys.KeyS || this.keys.ArrowDown || this.touch.climbDown;

        if (jump && !this.player.jumpHeld) this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
        this.player.jumpHeld = Boolean(jump);

        // Vine Climbing
        if (this.player.onVine) {
            const vine = this.player.onVine;
            if (climbUp) {
                this.player.climbProgress = Math.max(0.10, this.player.climbProgress - CONFIG.CLIMB_SPEED * delta);
            }
            if (climbDown) {
                this.player.climbProgress = Math.min(0.96, this.player.climbProgress + CONFIG.CLIMB_SPEED * delta);
            }

            if (left) vine.angularVelocity -= 0.0006 * delta;
            if (right) vine.angularVelocity += 0.0006 * delta;
            
            if (this.jumpBufferFrames > 0) {
                this.releaseVine();
            }
            return;
        }

        // Tree Trunk Climbing
        if (this.player.onTree) {
            const tree = this.player.onTree;
            if (climbUp) {
                this.player.climbProgress = Math.max(0.10, this.player.climbProgress - CONFIG.CLIMB_SPEED * delta);
            }
            if (climbDown) {
                this.player.climbProgress = Math.min(0.98, this.player.climbProgress + CONFIG.CLIMB_SPEED * delta);
            }

            if (this.jumpBufferFrames > 0) {
                this.releaseTree(left ? -1 : 1);
            }
            return;
        }

        // Running physics
        let inputVelocity = 0;
        if (left) inputVelocity -= CONFIG.MOVE_SPEED;
        if (right) inputVelocity += CONFIG.MOVE_SPEED;
        
        this.player.vx += (inputVelocity - this.player.vx) * 0.22;
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

        if (!jump && this.player.vy < -5.0) {
            this.player.vy *= 0.84;
        }
    }

    updatePlayer(delta) {
        // Vine climbing positioning
        if (this.player.onVine) {
            const vine = this.player.onVine;
            const climbDist = vine.ropeLength * this.player.climbProgress;
            
            this.player.x = vine.x + Math.sin(vine.angle) * climbDist;
            this.player.y = vine.y + Math.cos(vine.angle) * climbDist - 10;
            this.player.rotation = vine.angle;
            this.playerShadow.alpha = 0.08;
            
            this.updatePlayerAnimation(delta, 0);
            return;
        }

        // Tree trunk climbing positioning
        if (this.player.onTree) {
            const tree = this.player.onTree;
            const climbDist = tree.hitHeight * (1.0 - this.player.climbProgress);
            
            this.player.x = tree.x - 5;
            this.player.y = tree.y - climbDist;
            this.player.rotation = 0;
            this.playerShadow.alpha = 0.05;
            
            this.updatePlayerAnimation(delta, 0);
            return;
        }

        const wasOnGround = this.player.onGround;
        const autoSpeed = Math.min(
            this.currentLevel.maxSpeed,
            this.currentLevel.baseSpeed + this.distance / 500
        );

        this.player.vy += CONFIG.GRAVITY * delta;
        this.player.x += (autoSpeed + this.player.vx) * delta;
        this.player.y += this.player.vy * delta;
        
        this.player.x = Math.max(this.cameraX + 40, this.player.x);

        let onPlat = false;
        for (const plat of this.platforms) {
            const prevY = this.player.y - this.player.vy * delta;
            if (
                this.player.vy >= 0 &&
                this.player.x > plat.x - 12 &&
                this.player.x < plat.x + plat.platformWidth + 12 &&
                this.player.y >= plat.y &&
                prevY <= plat.y + 7
            ) {
                this.player.y = plat.y;
                this.player.vy = 0;
                this.player.onGround = true;
                onPlat = true;
                break;
            }
        }

        if (!onPlat && this.player.y >= CONFIG.GROUND_Y) {
            const pit = this.obstacles.find(o => 
                o.type === 'pit' &&
                this.player.x > o.x + 14 &&
                this.player.x < o.x + o.hitWidth - 14
            );
            
            if (pit) {
                this.player.onGround = false;
                if (this.player.y > CONFIG.GROUND_Y + 90) {
                    this.takeDamage(pit);
                }
            } else {
                this.player.y = CONFIG.GROUND_Y;
                this.player.vy = 0;
                this.player.onGround = true;
                if (!wasOnGround) {
                    this.audio.play('land');
                    this.emitDust(this.player.x, this.player.y, 6);
                }
            }
        } else if (!onPlat) {
            this.player.onGround = false;
        }

        this.player.rotation += (0 - this.player.rotation) * 0.20;
        this.player.scale.x = this.player.facing;
        this.player.scale.y += (1 - this.player.scale.y) * 0.2;

        this.playerShadow.x = this.player.x;
        this.playerShadow.y = CONFIG.GROUND_Y + 7;
        const h = Math.max(0, CONFIG.GROUND_Y - this.player.y);
        this.playerShadow.scale.x = Math.max(0.4, 1.0 - h / 240);
        this.playerShadow.alpha = Math.max(0.06, 0.35 - h / 550);

        this.distance = Math.max(0, Math.floor((this.player.x - 150) / 10));
        this.updatePlayerAnimation(delta, autoSpeed + Math.abs(this.player.vx));

        if (this.invincibleFrames > 0) {
            this.invincibleFrames -= delta;
            this.player.alpha = Math.floor(this.invincibleFrames / 4) % 2 ? 0.3 : 1.0;
        } else {
            this.player.alpha = 1.0;
        }
    }

    updatePlayerAnimation(delta, speed) {
        const time = this.app.ticker.lastTime / 1000;
        const visual = this.player.visual;
        const frameRate = 7.0 + Math.min(5.0, speed * 0.5);
        const runFrame = Math.floor(time * frameRate) % this.playerRunTextures.length;
        const climbFrame = Math.floor(time * 8.0) % 2;
        
        let nextPose = 'run-0';
        if (this.player.onVine || this.player.onTree) {
            nextPose = `climb-${climbFrame}`;
        } else if (!this.player.onGround) {
            nextPose = 'jump';
        } else {
            nextPose = `run-${runFrame}`;
        }

        if (this.player.pose !== nextPose) {
            this.player.pose = nextPose;
            let tex = this.playerTexture;
            if (nextPose.startsWith('climb')) {
                tex = this.playerClimbTextures[climbFrame];
            } else if (nextPose === 'jump') {
                tex = this.playerJumpTexture;
            } else {
                tex = this.playerRunTextures[runFrame];
            }
            
            this.player.sprite.texture = tex;
            this.player.rim.texture = tex;
        }

        let targetY = 0;
        let targetRot = 0;
        let targetScaleX = 1.0;
        let targetScaleY = 1.0;

        if (this.player.onVine || this.player.onTree) {
            const isClimbing = this.keys.KeyW || this.keys.ArrowUp || this.keys.KeyS || this.keys.ArrowDown;
            const bob = isClimbing ? Math.sin(time * 18) * 0.06 : 0;
            targetScaleX = 0.95 + bob;
            targetScaleY = 1.05 - bob;
            targetRot = 0;
        } else if (this.player.onGround && speed > 0.3) {
            const phase = time * frameRate * Math.PI * 0.5;
            const str = Math.sin(phase);
            targetY = Math.abs(str) * 2.0;
            targetRot = str * 0.02;
            targetScaleX = 1.0 + Math.abs(str) * 0.015;
            targetScaleY = 1.0 - Math.abs(str) * 0.015;
        } else {
            targetRot = Math.max(-0.12, Math.min(0.12, this.player.vy * 0.01));
            targetScaleX = 1.02;
            targetScaleY = 0.98;
        }

        visual.y += (targetY - visual.y) * 0.28 * delta;
        visual.rotation += (targetRot - visual.rotation) * 0.20 * delta;

        const base = this.player.baseSpriteScale;
        this.player.sprite.scale.x += (base * targetScaleX - this.player.sprite.scale.x) * 0.20 * delta;
        this.player.sprite.scale.y += (base * targetScaleY - this.player.sprite.scale.y) * 0.20 * delta;
        
        this.player.rim.scale.x = this.player.sprite.scale.x * 1.03;
        this.player.rim.scale.y = this.player.sprite.scale.y * 1.03;
        this.player.rim.alpha = 0.12 + Math.min(0.12, speed * 0.01);
        this.player.aura.alpha = 0.7 + Math.sin(time * 2.5) * 0.15;
        this.player.aura.scale.set(1.0 + Math.sin(time * 2.0) * 0.03);

        this.updatePlayerTrails(speed, delta);
    }

    updatePlayerTrails(speed, delta) {
        const show = !this.reducedMotion && (!this.player.onGround || speed > CONFIG.BASE_SCROLL_SPEED + 2.5);
        this.playerTrails.forEach((trail, idx) => {
            const targetAlpha = show ? 0.08 - idx * 0.03 : 0;
            trail.alpha += (targetAlpha - trail.alpha) * 0.20 * delta;
            trail.texture = this.player.sprite.texture;
            trail.x = this.player.x - this.player.facing * (10 + idx * 10);
            trail.y = this.player.y + this.player.visual.y + idx * 1.0;
            trail.rotation = this.player.rotation + this.player.visual.rotation;
            const tScale = this.player.baseSpriteScale * (1.0 - idx * 0.02);
            trail.scale.set(tScale * this.player.facing, tScale);
        });
    }

    updateObstacles(delta) {
        const time = this.app.ticker.lastTime / 1000;
        for (const obs of this.obstacles) {
            if (obs.type === 'crocodile') {
                obs.y = obs.startY + Math.sin(time * 3.0 + obs.phase) * 1.8;
                obs.rotation = Math.max(0, Math.sin(time * 2.0 + obs.phase)) * 0.06;
            } else if (obs.type === 'log') {
                obs.x += obs.vx * delta;
                obs.rotation += obs.vx * 0.012 * delta;
            }
        }
    }

    updateCollectibles(delta) {
        const time = this.app.ticker.lastTime / 1000;
        for (const col of this.collectibles) {
            col.y = col.baseY + Math.sin(time * 2.8 + col.phase) * 6;
            col.rotation = Math.sin(time * 1.5 + col.phase) * 0.1;
            const p = 1.0 + Math.sin(time * 4.0 + col.phase) * 0.12;
            col.glow.scale.set(p);
        }
    }

    updateVines(delta) {
        for (const vine of this.vines) {
            vine.angularVelocity += -Math.sin(vine.angle) * 0.0006 * delta;
            vine.angularVelocity *= 0.997;
            vine.angle += vine.angularVelocity * delta;
            this.drawVine(vine);
        }
    }

    updateCamera() {
        const target = Math.max(0, this.player.x - CONFIG.WIDTH * 0.3);
        this.cameraX += (target - this.cameraX) * 0.085;
        this.world.x = -this.cameraX;

        for (const layer of this.parallaxLayers) {
            layer.sprite.tilePosition.x = -this.cameraX * layer.speed;
        }
    }

    checkCollisions(delta) {
        const pBounds = {
            x: this.player.x - 16,
            y: this.player.y - 95,
            width: 32,
            height: 93
        };

        // Collectibles check
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const col = this.collectibles[i];
            const dx = this.player.x - col.x;
            const dy = this.player.y - 45 - col.y;
            if (dx * dx + dy * dy < 34 * 34) {
                this.score += col.value;
                this.collectCount++;
                this.createCollectEffect(col.x, col.y, col.type);
                this.audio.play(col.type === 'relic' ? 'relic' : 'coin');
                this.removeFromWorld(col, this.collectibles, i);
                
                if (this.collectCount % 8 === 0) {
                    this.score += 200;
                    this.showToast('Sequência de Relíquias +200');
                }
            }
        }

        // Damage obstacles check
        if (this.invincibleFrames <= 0) {
            for (const obs of this.obstacles) {
                if (!['crocodile', 'log', 'ruin'].includes(obs.type)) continue;
                const obsBounds = {
                    x: obs.x - obs.hitWidth / 2,
                    y: obs.y - obs.hitHeight,
                    width: obs.hitWidth,
                    height: obs.hitHeight
                };

                if (this.rectIntersect(pBounds, obsBounds)) {
                    if (obs.type === 'log' && this.player.vy > 3 && this.player.y < obs.y - 6) {
                        this.player.y = obs.y - obs.hitHeight;
                        this.player.vy = CONFIG.JUMP_FORCE * 0.70;
                        this.score += 50;
                        this.showToast('Salto Perfeito +50');
                        this.audio.play('jump');
                    } else {
                        this.takeDamage(obs);
                    }
                    break;
                }
            }
        }

        // Tree trunk climbing check
        if (!this.player.onTree && !this.player.onVine) {
            const grabRequested = this.keys.ArrowUp || this.keys.KeyW || this.keys.Space || this.touch.jump;
            if (grabRequested) {
                for (const tree of this.trees) {
                    const dx = Math.abs(this.player.x - tree.x);
                    const dy = this.player.y - (tree.y - tree.hitHeight / 2);
                    if (dx < 35 && Math.abs(dy) < tree.hitHeight / 2 + 20) {
                        this.player.onTree = tree;
                        this.player.climbProgress = Math.max(0.1, Math.min(0.9, 1.0 - (tree.y - this.player.y) / tree.hitHeight));
                        this.player.vy = 0;
                        this.player.vx = 0;
                        this.jumpBufferFrames = 0;
                        this.showToast('Árvore escalada · W/S para subir');
                        break;
                    }
                }
            }
        }

        // Vine grabbing check
        if (!this.player.onVine && !this.player.onTree) {
            const grabRequested = this.keys.ArrowUp || this.keys.KeyW || this.keys.Space || this.touch.jump;
            if (grabRequested) {
                for (const vine of this.vines) {
                    const endX = vine.x + vine.grip.x;
                    const endY = vine.y + vine.grip.y;
                    const dx = this.player.x - endX;
                    const dy = this.player.y - 45 - endY;
                    if (dx * dx + dy * dy < 48 * 48) {
                        this.player.onVine = vine;
                        this.player.climbProgress = 0.85;
                        this.player.vy = 0;
                        vine.angularVelocity += this.player.vx * 0.001;
                        this.jumpBufferFrames = 0;
                        this.showToast('Cipó agarrado · W/S para escalar');
                        break;
                    }
                }
            }
        }
    }

    releaseVine() {
        const vine = this.player.onVine;
        if (!vine) return;
        
        this.player.onVine = null;
        const climbDist = vine.ropeLength * this.player.climbProgress;
        this.player.vx = Math.cos(vine.angle) * vine.angularVelocity * climbDist * 3.1;
        this.player.vy = -8.0 + Math.sin(vine.angle) * 2;
        
        this.player.jumpHeld = false;
        this.audio.play('jump');
    }

    releaseTree(dir = 1) {
        const tree = this.player.onTree;
        if (!tree) return;
        
        this.player.onTree = null;
        this.player.vx = dir * 4.5;
        this.player.vy = -7.8;
        
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
        this.invincibleFrames = 110;
        
        this.player.onVine = null;
        this.player.onTree = null;
        this.player.vy = -8.5;
        this.player.vx = -4.5;
        this.player.scale.y = 0.8;
        
        this.emitImpact(this.player.x, this.player.y - 30);
        this.audio.play('hit');
        
        this.announce(`Dano sofrido. ${this.lives} vidas restantes.`);

        if (source?.type === 'pit') {
            this.player.x = Math.max(this.cameraX + 160, source.x - 65);
            this.player.y = CONFIG.GROUND_Y - 95;
        }

        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    createCollectEffect(x, y, type) {
        const container = new PIXI.Container();
        const color = type === 'relic' ? 0x8bf2bd : 0xf0ce72;
        const count = this.reducedMotion ? 4 : 10;
        
        for (let i = 0; i < count; i++) {
            const p = new PIXI.Graphics();
            p.circle(0, 0, 1.8 + Math.random() * 2.2).fill(color);
            p.x = x;
            p.y = y;
            p.vx = (Math.random() - 0.5) * 6;
            p.vy = (Math.random() - 0.5) * 6 - 2;
            container.addChild(p);
        }
        
        this.world.addChild(container);
        this.effects.push({ container, life: 28, maxLife: 28, gravity: 0.12 });
    }

    emitDust(x, y, amount) {
        if (this.reducedMotion) return;
        const container = new PIXI.Container();
        for (let i = 0; i < amount; i++) {
            const p = new PIXI.Graphics();
            p.circle(0, 0, 2 + Math.random() * 2.5).fill({ color: 0x486b45, alpha: 0.4 });
            p.x = x + (Math.random() - 0.5) * 20;
            p.y = y + Math.random() * 4;
            p.vx = -1.0 - Math.random() * 2.0;
            p.vy = -0.4 - Math.random() * 1.0;
            container.addChild(p);
        }
        this.world.addChild(container);
        this.effects.push({ container, life: 20, maxLife: 20, gravity: 0.02 });
    }

    emitImpact(x, y) {
        const container = new PIXI.Container();
        for (let i = 0; i < 8; i++) {
            const p = new PIXI.Graphics();
            p.rect(-2.5, -2.5, 5, 5).fill(i % 2 ? 0xf06b4f : 0xf0ce72);
            p.x = x;
            p.y = y;
            const a = (Math.PI * 2 * i) / 8;
            p.vx = Math.cos(a) * 4.5;
            p.vy = Math.sin(a) * 4.5;
            container.addChild(p);
        }
        this.world.addChild(container);
        this.effects.push({ container, life: 22, maxLife: 22, gravity: 0.09 });
    }

    updateEffects(delta) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const eff = this.effects[i];
            eff.life -= delta;
            eff.container.alpha = Math.max(0, eff.life / eff.maxLife);
            for (const p of eff.container.children) {
                p.x += p.vx * delta;
                p.y += p.vy * delta;
                p.vy += eff.gravity * delta;
            }
            if (eff.life <= 0) {
                this.world.removeChild(eff.container);
                this.effects.splice(i, 1);
            }
        }
    }

    checkVictoryCondition() {
        if (this.state !== 'playing') return;
        
        if (this.distance >= this.currentLevel.distanceGoal) {
            this.completeLevel();
        }
    }

    completeLevel() {
        this.state = 'won';
        this.releaseInputs();
        this.audio.play('victory');
        
        const currentIdx = LEVELS.findIndex(l => l.id === this.currentLevel.id);
        const nextLevelId = this.currentLevel.id + 1;
        
        if (this.unlockedLevel < nextLevelId && nextLevelId <= 4) {
            this.unlockedLevel = nextLevelId;
            this.saveNumber('jungleRunUnlockedLevel', this.unlockedLevel);
        }

        const lvlBest = this.readNumber(`jungleRunLevelBestScore_lvl_${this.currentLevel.id}`);
        if (this.score > lvlBest) {
            this.saveNumber(`jungleRunLevelBestScore_lvl_${this.currentLevel.id}`, this.score);
            this.saveNumber(`jungleRunLevelBestDistance_lvl_${this.currentLevel.id}`, this.distance);
        }
        
        const bestScore = this.readNumber('jungleRunBestScore');
        if (this.score > bestScore) {
            this.saveNumber('jungleRunBestScore', this.score);
            this.saveNumber('jungleRunBestDistance', this.distance);
        }

        let stars = 1;
        const totalCollectibles = this.spawnedCollectiblesCount || 1;
        const collectRatio = this.collectCount / totalCollectibles;
        
        if (collectRatio >= 0.70 && this.lives === 3) stars = 3;
        else if (collectRatio >= 0.40 || this.lives >= 2) stars = 2;
        
        document.getElementById('completeLevelName').textContent = this.currentLevel.name;
        document.getElementById('completeScore').textContent = this.pad(this.score, 4);
        document.getElementById('completeDistance').textContent = `${this.distance}m`;
        document.getElementById('completeLivesBonus').textContent = `${this.lives}/3 (${this.lives * 150} pts bônus)`;
        
        this.score += this.lives * 150;
        document.getElementById('completeScore').textContent = this.pad(this.score, 4);

        document.getElementById('star1').className = 'star active';
        document.getElementById('idStar2').className = stars >= 2 ? 'star active' : 'star';
        document.getElementById('idStar3').className = stars === 3 ? 'star active' : 'star';
        
        const nextBtn = document.getElementById('nextLevelBtn');
        if (nextLevelId > LEVELS.length) {
            nextBtn.classList.add('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            nextBtn.querySelector('span').textContent = currentIdx === 3 ? 'Jogar Infinito' : 'Avançar';
        }

        document.getElementById('levelCompleteScreen').classList.remove('hidden');
        document.getElementById('levelCompleteScreen').setAttribute('aria-hidden', 'false');
        document.getElementById('hud').classList.add('is-dimmed');
        document.getElementById('mobileControls').classList.add('is-hidden');
        nextBtn.focus();
        
        this.announce(`Fase concluída com sucesso! Pontuação final: ${this.score}.`);
    }

    gameOver() {
        this.state = 'over';
        this.releaseInputs();
        
        const lvlBest = this.readNumber(`jungleRunLevelBestScore_lvl_${this.currentLevel.id}`);
        const isRecord = this.score > lvlBest;
        
        if (isRecord) {
            this.saveNumber(`jungleRunLevelBestScore_lvl_${this.currentLevel.id}`, this.score);
            this.saveNumber(`jungleRunLevelBestDistance_lvl_${this.currentLevel.id}`, this.distance);
        }
        
        const bestScore = this.readNumber('jungleRunBestScore');
        if (this.score > bestScore) {
            this.saveNumber('jungleRunBestScore', this.score);
            this.saveNumber('jungleRunBestDistance', this.distance);
        }

        document.getElementById('finalScore').textContent = this.pad(this.score, 4);
        document.getElementById('finalDistance').textContent = `${this.pad(this.distance, 3)}m`;
        document.getElementById('finalBest').textContent = `${this.pad(lvlBest > this.score ? lvlBest : this.score, 4)}`;
        document.getElementById('resultEyebrow').textContent = isRecord ? 'NOVO RECORDE DA EXPEDIÇÃO!' : 'EXPEDIÇÃO FALHOU';
        
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('gameOverScreen').setAttribute('aria-hidden', 'false');
        document.getElementById('hud').classList.add('is-dimmed');
        document.getElementById('mobileControls').classList.add('is-hidden');
        document.getElementById('restartBtn').focus();
        
        this.announce(`Fim da expedição. Distância: ${this.distance}m, Pontuação: ${this.score}.`);
    }

    spawnNewContent() {
        while (this.lastSpawnX < this.player.x + CONFIG.SPAWN_AHEAD) {
            this.spawnSegment(this.lastSpawnX);
            this.lastSpawnX += CONFIG.SEGMENT_WIDTH;
        }
    }

    cleanupOffscreen() {
        const threshold = this.cameraX - 250;
        const cleanup = (array) => {
            for (let i = array.length - 1; i >= 0; i--) {
                const obj = array[i];
                const rightEdge = obj.x + (obj.hitWidth || obj.platformWidth || 32);
                if (rightEdge < threshold) {
                    this.removeFromWorld(obj, array, i);
                }
            }
        };
        cleanup(this.obstacles);
        cleanup(this.collectibles);
        cleanup(this.vines);
        cleanup(this.platforms);
        cleanup(this.trees);
    }

    removeFromWorld(obj, array, idx) {
        if (obj.parent) obj.parent.removeChild(obj);
        array.splice(idx, 1);
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
            const hearts = Array.from({ length: 3 }, (_, idx) => idx < this.lives ? '●' : '○').join(' ');
            const el = document.getElementById('lives');
            el.textContent = hearts;
            el.setAttribute('aria-label', `${this.lives} vidas`);
        }
        if (force || this.uiCache.distance !== next.distance) {
            document.getElementById('distance').textContent = next.distance;
        }

        const goal = this.currentLevel.distanceGoal;
        if (goal !== Infinity) {
            const pct = Math.min(100, (this.distance / goal) * 100);
            document.getElementById('progressFill').style.width = `${pct}%`;
        } else {
            const pct = (this.distance % 300) / 3.0;
            document.getElementById('progressFill').style.width = `${pct}%`;
        }

        document.getElementById('biomeLabel').textContent = this.currentLevel.name;
        this.uiCache = next;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2100);
    }

    announce(message) {
        document.getElementById('gameAnnouncer').textContent = message;
    }

    pad(val, size) {
        return String(Math.max(0, Math.floor(val))).padStart(size, '0');
    }
}

window.addEventListener('load', () => new JungleRun(), { once: true });
