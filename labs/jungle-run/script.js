/* ==========================================================================
   JUNGLE RUN — regras
   --------------------------------------------------------------------------
   • O explorador corre sozinho para a direita (autoSpeed). ←/→ (ou A/D, ◀ ▶)
     acelera ou freia; ESPAÇO/↑/W (ou PULAR) salta. Segurar o salto pula mais
     alto (soltar cedo corta a subida: vy *= 0.84 enquanto vy < -5).
   • Física em "frames de 60 Hz": delta = ticker.deltaTime limitado a 2, então
     um quadro longo (aba lenta, GC) nunca teleporta o jogador através de nada.
     Tudo que é "por quadro" escala com delta, para a física ser a mesma em
     tela de 60, 90, 120 ou 144 Hz:
       – somas: x += v·delta; timers (coyote, buffer) −= delta
       – amortecimentos/aproximações: fator^delta (ex.: vy *= 0.84^delta;
         v += (alvo − v)·(1 − 0.78^delta)), não fator fixo por quadro.
     Antes, num iPhone/Mac de 120 Hz o coyote time e o buffer de pulo duravam
     metade e o corte do pulo variável era duas vezes mais forte.
   • Cipó = pêndulo de verdade: α = −(g / L)·sen θ, com a MESMA gravidade do
     jogador (0,72 px/quadro²) e L = distância até a mão do explorador (ou
     ⅔ do cipó vazio, pêndulo físico de corda). Período ≈ 2π·√(L/g) ≈ 2 s.
     Ao soltar, o explorador sai com a velocidade tangencial do balanço
     (v = ω·L, perpendicular à corda) + o impulso das pernas (2 px →, 6,5 px ↑):
     soltar na subida da frente lança mais longe, como num balanço real.
     autoSpeed = min(maxSpeed, baseSpeed + distância/500) × speedMul(dificuldade)
     Pulo: vy = JUMP_FORCE (-14.2), gravidade 0.72/frame → altura máx ≈ 140 px.
   • Perigos: tronco rolando, jacaré e ruína tiram 1 vida ao encostar. Cair do
     alto em cima de um tronco é "Salto Perfeito" (+50 e quica). Buraco: cair
     tira 1 vida e o explorador reaparece no chão firme DEPOIS do buraco (nunca
     cai duas vezes no mesmo buraco). Após dano há invencibilidade (~1,8 s).
   • Cipós e árvores são opcionais: segure pular/↑ perto da ponta do cipó ou do
     tronco para se agarrar; ↑/↓ sobe e desce; pular solta (o balanço dá impulso).
   • Anti-trava: parado na árvore (~2,5 s) ou no cipó (~5 s) sem ↑/↓/←/→, o
     explorador salta sozinho — segurar PULAR não prende mais ninguém.
   • Pontos: moeda 50, relíquia 250, a cada 8 coletas +200, ao vencer +150 por
     vida restante. Estrelas: 3 = ≥70% das coletas sem perder vida; 2 = ≥40%
     das coletas ou perdeu no máximo 1 vida; 1 = chegou.
   • Vitória: distância (m = px/10) ≥ distanceGoal da fase → bandeira de chegada.
     Derrota: vidas = 0. Modo Infinito não tem meta (só recorde).
   • Alcance do pulo: tempo no ar ≈ 2×14.2/0.72 ≈ 39 frames; distância ≈
     39 × (autoSpeed + vx). Sem "air assist" um pulo parado mal passava um
     jacaré (hitbox 76+32 px) — a criança precisava descobrir que tinha de
     segurar →. Agora, no ar e sem ← apertado, vx tende a airAssist.
   • Dificuldade (localStorage 'jungleRunMode'): Fácil (padrão) = 5 vidas,
     velocidade ×0.82, troncos ×0.7, buracos 64–90 px, airAssist 1.6;
     Normal = 3 vidas, buracos 110–160 px, airAssist 0.6.
   ========================================================================== */
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
    CLIMB_SPEED: 0.018,
    GRIP_IDLE_TREE: 150, // ~2,5 s parado na árvore → salta sozinho
    GRIP_IDLE_VINE: 300  // ~5 s parado no cipó → solta sozinho
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

/* Dificuldade. Fácil é o padrão para que crianças consigam chegar ao fim. */
const DIFFICULTY = Object.freeze({
    easy: { lives: 5, speedMul: 0.82, logMul: 0.7, pitMin: 64, pitVar: 26, airAssist: 1.6 },
    normal: { lives: 3, speedMul: 1, logMul: 1, pitMin: 110, pitVar: 50, airAssist: 0.6 }
});

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

/* Áudio via LabAudio: mudo persistido + tons sintéticos. O botão #soundBtn
   continua no chrome do lab; só a engine muda. */
class JungleAudio {
    constructor(button) {
        this.button = button;
        this.lab = window.LabAudio || null;
        if (this.lab) {
            this.lab.configure({ storageKey: 'jungleRunMuted', volume: 0.45 });
            // Formato antigo gravava 'true'/'false'; LabAudio usa '1'/'0'.
            try {
                const legacy = localStorage.getItem('jungleRunMuted');
                if (legacy === 'true') this.lab.setMuted(true);
                else if (legacy === 'false') this.lab.setMuted(false);
            } catch {}
            this.lab.onChange(() => this.syncButton());
        }
        this.syncButton();
    }

    get muted() {
        return this.lab ? this.lab.isMuted() : false;
    }

    toggle() {
        if (!this.lab) return;
        this.lab.setMuted(!this.lab.isMuted());
        if (!this.lab.isMuted()) this.play('select');
    }

    syncButton() {
        if (!this.button) return;
        const muted = this.muted;
        this.button.setAttribute('aria-pressed', String(muted));
        this.button.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
        const icon = this.button.querySelector('span');
        if (icon) icon.textContent = muted ? '×' : '♪';
    }

    ensureContext() {
        /* LabAudio cria o AudioContext no primeiro tone após um gesto. */
    }

    play(type) {
        if (!this.lab || this.lab.isMuted()) return;

        const presets = {
            jump: { freq: 180, slideTo: 330, duration: 0.12, type: 'square', gain: 0.035 },
            coin: { freq: 520, slideTo: 900, duration: 0.1, type: 'sine', gain: 0.045 },
            relic: { freq: 420, slideTo: 1100, duration: 0.22, type: 'triangle', gain: 0.05 },
            hit: { freq: 150, slideTo: 55, duration: 0.3, type: 'sawtooth', gain: 0.06 },
            select: { freq: 300, slideTo: 440, duration: 0.08, type: 'sine', gain: 0.025 },
            milestone: { freq: 330, slideTo: 760, duration: 0.38, type: 'triangle', gain: 0.045 },
            land: { freq: 90, slideTo: 55, duration: 0.08, type: 'sine', gain: 0.025 },
            victory: { freq: 440, slideTo: 880, duration: 0.5, type: 'triangle', gain: 0.06 }
        };
        this.lab.tone(presets[type] || presets.select);
    }
}

class JungleRun {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.container = document.getElementById('gameContainer');
        this.app = null;
        this.state = 'loading';
        this.keys = Object.create(null);
        this.touch = { left: false, right: false, jump: false, climbUp: false, climbDown: false, tap: false };
        
        // Game stats
        this.score = 0;
        this.lives = this.maxLives;
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
        // Abre já na fase mais avançada liberada (Infinito nunca é o padrão).
        this.selectedLevelIndex = Math.max(0, Math.min(this.unlockedLevel, 4) - 1);
        this.currentLevel = LEVELS[this.selectedLevelIndex];
        this.mode = this.readMode();
        this.maxLives = DIFFICULTY[this.mode].lives;
        this.lives = this.maxLives;
        this.uiProgress = -1;
        this.uiBiome = '';
        
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

    readMode() {
        try {
            return localStorage.getItem('jungleRunMode') === 'normal' ? 'normal' : 'easy';
        } catch {
            return 'easy';
        }
    }

    setMode(mode) {
        this.mode = DIFFICULTY[mode] ? mode : 'easy';
        this.maxLives = DIFFICULTY[this.mode].lives;
        try { localStorage.setItem('jungleRunMode', this.mode); } catch {}
        document.querySelectorAll('.mode-btn').forEach((btn) => {
            btn.setAttribute('aria-checked', String(btn.dataset.mode === this.mode));
        });
    }

    get diff() {
        return DIFFICULTY[this.mode];
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
            // Teto de 20 s: rede travada vira mensagem de erro, nunca loading infinito.
            const withTimeout = (promise) => Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado ao carregar as imagens')), 20000))
            ]);
            const textures = await withTimeout(Promise.all([
                PIXI.Assets.load('./assets/explorer-run.webp'),
                PIXI.Assets.load('./assets/explorer-jump.webp'),
                PIXI.Assets.load('./assets/explorer-run-contact.webp'),
                PIXI.Assets.load('./assets/explorer-run-down.png'),
                PIXI.Assets.load('./assets/explorer-run-passing.webp'),
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
                PIXI.Assets.load('./assets/explorer-climb-1.webp'),
                PIXI.Assets.load('./assets/explorer-climb-2.webp'),
                PIXI.Assets.load('./assets/tree-trunk.png')
            ]));

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
            if (window.LabRuntime) LabRuntime.bindPixiTicker(this.app);
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

    readLevelBestScore(levelId) {
        return Math.max(
            this.readNumber(`jungleRunLevelBestScore_lvl_${levelId}`),
            this.readNumber(`jungleRunBestScore_lvl_${levelId}`)
        );
    }

    saveLevelBestScore(levelId, score, distance) {
        this.saveNumber(`jungleRunLevelBestScore_lvl_${levelId}`, score);
        this.saveNumber(`jungleRunBestScore_lvl_${levelId}`, score);
        this.saveNumber(`jungleRunLevelBestDistance_lvl_${levelId}`, distance);
    }

    renderLevelSelector() {
        const grid = document.getElementById('levelGrid');
        grid.innerHTML = '';
        
        LEVELS.forEach((level, idx) => {
            const isLocked = idx > 0 && level.id > this.unlockedLevel && level.id !== 5;
            const isEndlessLocked = level.id === 5 && this.unlockedLevel < 4;
            
            const locked = isLocked || isEndlessLocked;
            const recordScore = this.readLevelBestScore(level.id);
            
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `level-card ${locked ? 'locked' : ''} ${idx === this.selectedLevelIndex ? 'selected' : ''}`;
            card.disabled = locked;
            card.setAttribute('aria-pressed', String(idx === this.selectedLevelIndex));
            card.setAttribute('aria-label', locked
                ? `${level.name} (bloqueada: vença a fase anterior)`
                : `${level.name}. ${level.description}`);
            
            card.innerHTML = `
                <span class="level-card-number">${level.id === 5 ? '∞' : level.id}<small>${level.id === 5 ? 'INFINITO' : 'FASE ' + level.id}</small></span>
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
                    document.querySelectorAll('.level-card').forEach(c => {
                        c.classList.remove('selected');
                        c.setAttribute('aria-pressed', 'false');
                    });
                    card.classList.add('selected');
                    card.setAttribute('aria-pressed', 'true');
                    this.selectedLevelIndex = idx;
                    this.currentLevel = level;
                    
                    this.updateStartLabel();
                });
            }
            
            grid.appendChild(card);
        });

        this.currentLevel = LEVELS[this.selectedLevelIndex];
        this.updateStartLabel();
        
        const generalRecord = this.readNumber('jungleRunBestScore');
        document.getElementById('bestScore').textContent = this.pad(generalRecord, 4);
    }

    updateStartLabel() {
        const label = document.getElementById('startBtn').querySelector('span');
        label.textContent = this.currentLevel.id === 5 ? 'Jogar: Infinito' : `Jogar fase ${this.currentLevel.id}`;
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

    createGroundTexture() {
        const tileW = 256;
        const topPad = 24;
        const groundH = CONFIG.HEIGHT - CONFIG.GROUND_Y + topPad;
        const canvas = document.createElement('canvas');
        canvas.width = tileW;
        canvas.height = groundH;
        const ctx = canvas.getContext('2d');

        // Subsolo com gradiente de profundidade
        const soilGrad = ctx.createLinearGradient(0, topPad, 0, groundH);
        soilGrad.addColorStop(0, '#1e3a24');
        soilGrad.addColorStop(0.12, '#14261a');
        soilGrad.addColorStop(0.45, '#0d1912');
        soilGrad.addColorStop(1, '#050b08');
        ctx.fillStyle = soilGrad;
        ctx.fillRect(0, topPad, tileW, groundH - topPad);

        // Estratificação de terra, pedras e raízes entrelaçadas
        const rng = this.seededRandom(1337);
        for (let i = 0; i < 28; i++) {
            const rx = rng() * tileW;
            const ry = topPad + 16 + rng() * (groundH - topPad - 24);
            const rw = 6 + rng() * 18;
            const rh = 4 + rng() * 8;
            ctx.fillStyle = rng() > 0.5 ? 'rgba(42, 68, 48, 0.35)' : 'rgba(8, 16, 11, 0.55)';
            ctx.beginPath();
            ctx.ellipse(rx, ry, rw, rh, (rng() - 0.5) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Raízes orgânicas no subsolo
        ctx.strokeStyle = 'rgba(38, 26, 16, 0.55)';
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
            const sx = (i * 38) + rng() * 14;
            ctx.lineWidth = 2 + rng() * 2.5;
            ctx.beginPath();
            ctx.moveTo(sx, topPad + 8);
            ctx.quadraticCurveTo(
                sx + (rng() - 0.5) * 34,
                topPad + 36 + rng() * 30,
                sx + (rng() - 0.5) * 48,
                topPad + 70 + rng() * 55
            );
            ctx.stroke();
        }

        // Faixa de musgo e grama iluminada no topo
        const mossGrad = ctx.createLinearGradient(0, topPad - 2, 0, topPad + 16);
        mossGrad.addColorStop(0, '#68b85e');
        mossGrad.addColorStop(0.45, '#386d3b');
        mossGrad.addColorStop(1, '#1a3a22');
        ctx.fillStyle = mossGrad;
        ctx.fillRect(0, topPad, tileW, 15);

        //Fios de brilho superior na borda do solo
        ctx.fillStyle = 'rgba(165, 239, 144, 0.45)';
        ctx.fillRect(0, topPad, tileW, 2);

        // Folhas de grama e samambaias na superfície (seamless em 256px)
        for (let x = 0; x < tileW; x += 8) {
            const bladeH = 5 + ((x * 7) % 11);
            const lean = ((x % 16) - 8) * 0.35;
            ctx.fillStyle = (x % 16 === 0) ? '#63ab59' : ((x % 24 === 0) ? '#84d475' : '#2e602f');
            ctx.beginPath();
            ctx.moveTo(x, topPad + 2);
            ctx.quadraticCurveTo(x + lean * 0.5, topPad - bladeH * 0.6, x + lean + 3, topPad - bladeH);
            ctx.lineTo(x + 6, topPad + 2);
            ctx.closePath();
            ctx.fill();
        }

        return PIXI.Texture.from(canvas);
    }

    createGround() {
        const topPad = 24;
        this.groundTexture = this.createGroundTexture();
        this.ground = new PIXI.TilingSprite({
            texture: this.groundTexture,
            width: CONFIG.WIDTH + 640,
            height: CONFIG.HEIGHT - CONFIG.GROUND_Y + topPad
        });
        this.ground.x = -160;
        this.ground.y = CONFIG.GROUND_Y - topPad;
        this.world.addChild(this.ground);

        this.groundDecor = new PIXI.Container();
        this.world.addChild(this.groundDecor);
        this.groundFerns = [];
        for (let i = 0; i < 12; i++) {
            this.createGroundFern(60 + i * 180);
        }
    }

    createWorld() {
        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);

        this.createGround();

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
        if (this.groundFerns) this.groundFerns.push(plant);
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
            if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,select,textarea')) return;
            if (['Enter', 'Space'].includes(event.code) && event.target.closest?.('button,a')) return;
            if (this.state !== 'playing' && !['Escape','KeyP','Enter'].includes(event.code)) return;
            this.keys[event.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
                event.preventDefault();
            }
            if (!event.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
                this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
            }
            if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
                this.togglePause();
            }
            if (event.code === 'Enter' && !event.repeat && performance.now() >= this.overlayLockUntil) {
                if (this.state === 'intro') this.startExpedition();
                else if (this.state === 'over') this.restartGame();
                else if (this.state === 'won') this.advanceToNextLevel();
            }
        });

        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        window.addEventListener('blur', () => {
            if (this.state === 'playing') this.pauseGame();
            else this.releaseInputs();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.releaseInputs();
                if (this.state === 'playing') this.pauseGame();
            }
            // LabRuntime.bindPixiTicker reinicia o ticker ao voltar; se ainda
            // estamos pausados, mantém parado até o resume explícito.
            else if (!document.hidden && this.state === 'paused' && this.app?.ticker) {
                this.app.ticker.stop();
            }
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startExpedition());
        // Telas de resultado ignoram cliques nos primeiros 600 ms: quem morre
        // segurando ESPAÇO soltaria a tecla em cima do botão focado e pularia a tela.
        const guarded = (fn) => () => {
            if (performance.now() < this.overlayLockUntil) return;
            fn();
        };
        this.overlayLockUntil = 0;
        document.getElementById('restartBtn').addEventListener('click', guarded(() => this.restartGame()));
        document.getElementById('pauseRestartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('soundBtn').addEventListener('click', () => this.audio.toggle());
        
        document.getElementById('nextLevelBtn').addEventListener('click', guarded(() => this.advanceToNextLevel()));
        document.getElementById('completeMenuBtn').addEventListener('click', guarded(() => this.backToMenu()));
        document.getElementById('completeReplayBtn').addEventListener('click', guarded(() => this.restartGame()));
        document.getElementById('pauseMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('overMenuBtn').addEventListener('click', guarded(() => this.backToMenu()));

        document.querySelectorAll('.mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
                this.audio.play('select');
            });
        });
        this.setMode(this.mode);

        // Toque em qualquer ponto livre da cena = pular (segurar = pulo alto).
        // Os botões do pad ficam por cima e continuam com a própria função.
        const tapJumpRelease = (event) => {
            if (event && this._tapPointerId != null && event.pointerId !== this._tapPointerId) return;
            this._tapPointerId = null;
            this.touch.tap = false;
        };
        this.canvas.addEventListener('pointerdown', (event) => {
            if (this.state !== 'playing' || event.pointerType === 'mouse') return;
            event.preventDefault();
            this.audio?.lab?.unlock?.();
            this._tapPointerId = event.pointerId;
            try { this.canvas.setPointerCapture(event.pointerId); } catch { /* ponteiro já solto */ }
            this.touch.tap = true;
            this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
        }, { passive: false });
        this.canvas.addEventListener('pointerup', tapJumpRelease);
        this.canvas.addEventListener('pointercancel', tapJumpRelease);
        this.canvas.addEventListener('lostpointercapture', tapJumpRelease);

        this.bindHoldButton('leftBtn', 'left');
        this.bindHoldButton('rightBtn', 'right');
        this.bindHoldButton('climbUpBtn', 'climbUp');
        this.bindHoldButton('climbDownBtn', 'climbDown');
        this.bindHoldButton('jumpBtn', 'jump');
    }

    bindHoldButton(id, control) {
        const button = document.getElementById(id);
        const activate = (event) => {
            // Safari/iOS: toque pode chegar com button === -1.
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            this.audio?.lab?.unlock?.();
            this.touch[control] = true;
            if (control === 'jump') this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
            button.classList.add('is-active');
            if (button.setPointerCapture && event.pointerId !== undefined) {
                // Best-effort: lança InvalidStateError se o ponteiro já terminou.
                try {
                    button.setPointerCapture(event.pointerId);
                } catch (err) {
                    /* segue sem captura */
                }
            }
        };
        const release = (event) => {
            if (event) event.preventDefault();
            this.touch[control] = false;
            button.classList.remove('is-active');
        };

        button.addEventListener('pointerdown', activate, { passive: false });
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

        // Pista livre perto da bandeira: a chegada nunca fica atrás de um buraco.
        if (this.finishX && x > this.finishX - 420) {
            if (x < this.finishX + 200 && Math.random() < 0.5) this.spawnCollectible(x + 120, true);
            return;
        }
        
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
        const width = this.diff.pitMin + Math.random() * this.diff.pitVar;
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
        croc.hitWidth = 76;
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
        log.vx = -(1.2 + Math.random() * 0.9 + (this.distance / 400)) * this.diff.logMul;
        
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
        vine.baseX = x;
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
        // Monta a fase escolhida ANTES da contagem, para o 3-2-1 já mostrar a pista certa.
        this.resetRun();
        this.state = 'countdown';
        this.app.ticker.start();
        document.getElementById('mobileControls').classList.remove('is-hidden');
        await this.runCountdown();
        if (this.state !== 'countdown') return;

        this.state = 'playing';
        // Aba escondida durante o 3-2-1: começa já pausado em vez de correr sozinho.
        if (document.hidden) { this.pauseGame(); return; }
        this.announce('Expedição iniciada');
        this.showToast(IS_TOUCH ? 'Toque em PULAR para saltar!' : 'Aperte ESPAÇO para pular!');
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
        if (this.app?.ticker) this.app.ticker.stop();
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
        if (this.app?.ticker) this.app.ticker.start();
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
        this.resetRun();
        this.state = 'playing';
        this.app.ticker.start();
        this.audio.play('select');
        this.announce('Expedição reiniciada');
    }

    /* Zera a corrida e reconstrói o mundo da fase atual. Não muda o estado. */
    resetRun() {
        this.score = 0;
        this.lives = this.maxLives;
        this.distance = 0;
        this.collectCount = 0;
        this.cameraX = 0;
        this.lastSpawnX = 0;
        this.invincibleFrames = 100;
        
        // destroy() (e não só removeChild) libera a geometria na GPU; as texturas
        // compartilhadas ficam intactas porque não passamos { texture: true }.
        this.effects.forEach(e => e.container.destroy({ children: true }));
        this.effects = [];
        
        [...this.obstacles, ...this.collectibles, ...this.vines, ...this.platforms, ...this.trees].forEach(obj => {
            obj.destroy({ children: true });
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
        this.createFinishLine();
        
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
    }

    /* Bandeira quadriculada na meta da fase (x = 150 + meta × 10, pois 1 m = 10 px). */
    createFinishLine() {
        if (this.finishFlag) {
            this.finishFlag.destroy({ children: true });
            this.finishFlag = null;
        }
        const goal = this.currentLevel.distanceGoal;
        this.finishX = goal === Infinity ? 0 : 150 + goal * 10;
        if (!this.finishX) return;

        const flag = new PIXI.Container();
        const glow = new PIXI.Graphics();
        glow.ellipse(0, -6, 90, 18).fill({ color: 0xf6cf69, alpha: 0.18 });
        flag.addChild(glow);

        const posts = new PIXI.Graphics();
        // Arco de chegada: dois postes de bambu e uma faixa.
        posts.roundRect(-70, -210, 12, 214, 5).fill(0x8a6a2c).stroke({ color: 0x3b2a0d, width: 2 });
        posts.roundRect(58, -210, 12, 214, 5).fill(0x8a6a2c).stroke({ color: 0x3b2a0d, width: 2 });
        posts.roundRect(-80, -222, 160, 30, 8).fill(0x1d5a35).stroke({ color: 0xf6cf69, width: 3 });
        flag.addChild(posts);

        const cloth = new PIXI.Graphics();
        const cell = 12;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 12; col++) {
                cloth.rect(-72 + col * cell, -188 + row * cell, cell, cell)
                    .fill((row + col) % 2 ? 0x0b130e : 0xfff6d8);
            }
        }
        flag.addChild(cloth);
        flag.cloth = cloth;

        const label = new PIXI.Text({
            text: 'CHEGADA',
            style: { fontFamily: 'monospace', fontSize: 16, fontWeight: '900', fill: 0xf6cf69, letterSpacing: 3 }
        });
        label.anchor.set(0.5);
        label.y = -207;
        flag.addChild(label);

        flag.x = this.finishX;
        flag.y = CONFIG.GROUND_Y + 4;
        // Atrás do jogador, na frente do chão.
        this.world.addChildAt(flag, this.world.getChildIndex(this.playerShadow));
        this.finishFlag = flag;
    }

    backToMenu() {
        if (this.state === 'paused' && this.app?.ticker) this.app.ticker.start();
        this.releaseInputs();
        ['pauseScreen', 'gameOverScreen', 'levelCompleteScreen'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
            document.getElementById(id).setAttribute('aria-hidden', 'true');
        });
        
        this.state = 'intro';
        this.renderLevelSelector();
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('startBtn').focus({ preventScroll: true });
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
        this.releasedGrip = null;
        this.jumpBufferFrames = 0;
        this.player.jumpHeld = false;
        this.keys = Object.create(null);
        Object.keys(this.touch).forEach(k => { this.touch[k] = false; });
        document.querySelectorAll('.mobile-btn').forEach(b => b.classList.remove('is-active'));
    }

    gameLoop(ticker) {
        const delta = Math.min(ticker.deltaTime, 2);
        this.frameDelta = delta;
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
        const jump = this.keys.Space || this.keys.ArrowUp || this.keys.KeyW || this.touch.jump || this.touch.tap;
        const climbUp = this.keys.KeyW || this.keys.ArrowUp || this.touch.climbUp;
        const climbDown = this.keys.KeyS || this.keys.ArrowDown || this.touch.climbDown;

        if (jump && !this.player.jumpHeld) this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
        this.player.jumpHeld = Boolean(jump);

        // Anti-trava: quem segura PULAR sem parar se agarra numa árvore/cipó e
        // nunca solta (o pulo só dispara ao apertar de novo). Sem ↑/↓ por
        // GRIP_IDLE frames, o explorador salta sozinho para a frente.
        if (this.player.onVine || this.player.onTree) {
            if (climbUp || climbDown || left || right) this.gripIdle = 0;
            else this.gripIdle = (this.gripIdle || 0) + delta;
            const limit = this.player.onTree ? CONFIG.GRIP_IDLE_TREE : CONFIG.GRIP_IDLE_VINE;
            if (this.gripIdle > limit * 0.5 && !this.gripHintShown) {
                this.gripHintShown = true;
                this.showToast(IS_TOUCH ? 'Toque em PULAR para soltar!' : 'Aperte ESPAÇO para soltar!');
            }
            if (this.gripIdle > limit) {
                this.jumpBufferFrames = CONFIG.JUMP_BUFFER_FRAMES;
            }
        } else {
            this.gripIdle = 0;
            this.gripHintShown = false;
        }

        // Vine Climbing
        if (this.player.onVine) {
            const vine = this.player.onVine;
            if (climbUp) {
                this.player.climbProgress = Math.max(0.10, this.player.climbProgress - CONFIG.CLIMB_SPEED * delta);
            }
            if (climbDown) {
                this.player.climbProgress = Math.min(0.96, this.player.climbProgress + CONFIG.CLIMB_SPEED * delta);
            }

            // "Pedalar" o balanço: o corpo empurra o pêndulo (mais forte que a
            // antiga gravidade fraca, para continuar dando controle com g real).
            if (left) vine.angularVelocity -= 0.0011 * delta;
            if (right) vine.angularVelocity += 0.0011 * delta;
            
            if (this.jumpBufferFrames > 0) {
                this.gripIdle = 0;
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
                this.gripIdle = 0;
                this.releaseTree(left ? -1 : 1);
            }
            return;
        }

        // Running physics
        let inputVelocity = 0;
        if (left) inputVelocity -= CONFIG.MOVE_SPEED;
        if (right) inputVelocity += CONFIG.MOVE_SPEED;
        if (!this.player.onGround && !left && !right) inputVelocity = this.diff.airAssist;
        
        this.player.vx += (inputVelocity - this.player.vx) * (1 - Math.pow(0.78, delta));
        if (left || right) this.player.facing = Math.sign(inputVelocity) || this.player.facing;
        
        if (this.player.onGround) this.coyoteFrames = CONFIG.COYOTE_FRAMES;
        else this.coyoteFrames = Math.max(0, this.coyoteFrames - delta);

        if (this.jumpBufferFrames > 0) this.jumpBufferFrames = Math.max(0, this.jumpBufferFrames - delta);
        
        if (this.jumpBufferFrames > 0 && this.coyoteFrames > 0) {
            this.player.vy = CONFIG.JUMP_FORCE;
            this.player.onGround = false;
            this.coyoteFrames = 0;
            this.jumpBufferFrames = 0;
            this.audio.play('jump');
            this.emitDust(this.player.x, this.player.y, 5);
        }

        if (!jump && this.player.vy < -5.0) {
            this.player.vy *= Math.pow(0.84, delta);
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
        ) * this.diff.speedMul;

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
                    // Já invencível (ex.: empurrado para o buraco por um tronco):
                    // só reaparece, sem perder outra vida e sem cair para sempre.
                    if (this.invincibleFrames > 0) this.respawnAfterPit(pit);
                    else this.takeDamage(pit);
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

        const settle = 1 - Math.pow(0.8, delta);
        this.player.rotation += (0 - this.player.rotation) * settle;
        this.player.scale.x = this.player.facing;
        this.player.scale.y += (1 - this.player.scale.y) * settle;

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
            const isClimbing = this.keys.KeyW || this.keys.ArrowUp || this.keys.KeyS || this.keys.ArrowDown ||
                this.touch.climbUp || this.touch.climbDown;
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
            const targetAlpha = show ? 0.22 - idx * 0.07 : 0;
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
        const drag = Math.pow(0.997, delta);
        for (const vine of this.vines) {
            // Pêndulo: α = −(g/L)·sen θ. Com o explorador pendurado, L é a
            // distância até ele; vazio, a corda oscila como pêndulo físico (⅔ L).
            const hanging = this.player.onVine === vine;
            const length = hanging
                ? Math.max(60, vine.ropeLength * this.player.climbProgress)
                : vine.ropeLength * 0.67;
            vine.angularVelocity += -(CONFIG.GRAVITY / length) * Math.sin(vine.angle) * delta;
            vine.angularVelocity *= drag;
            vine.angle += vine.angularVelocity * delta;
            if (Math.abs((vine.baseX ?? vine.x) - this.player.x) > 1200) continue;
            this.drawVine(vine);
        }
    }

    updateCamera() {
        const target = Math.max(0, this.player.x - CONFIG.WIDTH * 0.3);
        this.cameraX += (target - this.cameraX) * (1 - Math.pow(0.915, this.frameDelta || 1));
        this.world.x = -this.cameraX;

        if (this.ground) {
            this.ground.x = this.cameraX - 160;
            this.ground.tilePosition.x = -(this.cameraX - 160);
        }

        if (this.groundFerns) {
            const span = this.groundFerns.length * 180;
            for (const fern of this.groundFerns) {
                while (fern.x < this.cameraX - 180) fern.x += span;
                while (fern.x > this.cameraX + span - 180) fern.x -= span;
            }
        }

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
                    this.showToast('Coleção! +200');
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

        const grabRequested = this.keys.ArrowUp || this.keys.KeyW || this.keys.Space || this.touch.jump || this.touch.tap || this.touch.climbUp;
        if (!grabRequested) this.releasedGrip = null;

        // Tree trunk climbing check
        if (!this.player.onTree && !this.player.onVine) {
            if (grabRequested) {
                for (const tree of this.trees) {
                    if (tree === this.releasedGrip) continue;
                    const dx = Math.abs(this.player.x - tree.x);
                    const dy = this.player.y - (tree.y - tree.hitHeight / 2);
                    if (dx < 35 && Math.abs(dy) < tree.hitHeight / 2 + 20) {
                        this.player.onTree = tree;
                        this.player.climbProgress = Math.max(0.1, Math.min(0.9, 1.0 - (tree.y - this.player.y) / tree.hitHeight));
                        this.player.vy = 0;
                        this.player.vx = 0;
                        this.jumpBufferFrames = 0;
                        this.showToast(IS_TOUCH ? 'Na árvore! ▲ ▼ sobe e desce' : 'Na árvore! ↑ ↓ sobe e desce');
                        break;
                    }
                }
            }
        }

        // Vine grabbing check
        if (!this.player.onVine && !this.player.onTree) {
            if (grabRequested) {
                for (const vine of this.vines) {
                    if (vine === this.releasedGrip) continue;
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
                        this.showToast(IS_TOUCH ? 'No cipó! PULAR para soltar' : 'No cipó! ESPAÇO para soltar');
                        break;
                    }
                }
            }
        }
    }

    releaseVine() {
        const vine = this.player.onVine;
        if (!vine) return;
        
        this.releasedGrip = vine;
        this.jumpBufferFrames = 0;
        this.player.onVine = null;
        const climbDist = vine.ropeLength * this.player.climbProgress;
        // Velocidade tangencial do balanço (v = ω·L, perpendicular à corda)
        // + impulso das pernas ao soltar.
        const swing = vine.angularVelocity * climbDist;
        this.player.vx = Math.cos(vine.angle) * swing + 2.0;
        this.player.vy = Math.max(-14, -Math.sin(vine.angle) * swing - 6.5);
        
        this.player.jumpHeld = false;
        this.audio.play('jump');
    }

    releaseTree(dir = 1) {
        const tree = this.player.onTree;
        if (!tree) return;
        
        this.releasedGrip = tree;
        this.jumpBufferFrames = 0;
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

        if (source?.type === 'pit') this.respawnAfterPit(source);

        if (this.lives <= 0) {
            this.gameOver();
        } else if (this.lives === 1) {
            this.showToast('Cuidado: última vida!');
        }
    }

    /* Antes o jogador voltava ANTES do buraco, no ar e com recuo; com a corrida
       automática ele caía de novo no mesmo buraco e perdia todas as vidas em
       sequência. Agora reaparece no chão firme logo depois do buraco. */
    respawnAfterPit(pit) {
        this.player.x = pit.x + pit.hitWidth + 36;
        this.player.y = CONFIG.GROUND_Y - 60;
        this.player.vx = 0;
        this.player.vy = -4;
        this.player.onGround = false;
        this.invincibleFrames = Math.max(this.invincibleFrames, 110);
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
            p.circle(0, 0, 3 + Math.random() * 3.5).fill({ color: Math.random() > 0.5 ? 0x6a8f52 : 0xc4b07a, alpha: 0.65 });
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
                eff.container.destroy({ children: true });
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
        this.overlayLockUntil = performance.now() + 600;
        this.releaseInputs();
        this.audio.play('victory');
        
        const currentIdx = LEVELS.findIndex(l => l.id === this.currentLevel.id);
        const nextLevelId = this.currentLevel.id + 1;
        
        if (this.unlockedLevel < nextLevelId && nextLevelId <= 4) {
            this.unlockedLevel = nextLevelId;
            this.saveNumber('jungleRunUnlockedLevel', this.unlockedLevel);
        }

        const lvlBest = this.readLevelBestScore(this.currentLevel.id);
        if (this.score > lvlBest) {
            this.saveLevelBestScore(this.currentLevel.id, this.score, this.distance);
        }
        
        const bestScore = this.readNumber('jungleRunBestScore');
        if (this.score > bestScore) {
            this.saveNumber('jungleRunBestScore', this.score);
            this.saveNumber('jungleRunBestDistance', this.distance);
        }

        let stars = 1;
        const totalCollectibles = this.spawnedCollectiblesCount || 1;
        const collectRatio = this.collectCount / totalCollectibles;
        
        if (collectRatio >= 0.70 && this.lives === this.maxLives) stars = 3;
        else if (collectRatio >= 0.40 || this.lives >= this.maxLives - 1) stars = 2;
        
        document.getElementById('completeLevelName').textContent = this.currentLevel.name;
        document.getElementById('completeScore').textContent = this.pad(this.score, 4);
        document.getElementById('completeDistance').textContent = `${this.distance}m`;
        document.getElementById('completeLivesBonus').textContent = `${this.lives}/${this.maxLives} (+${this.lives * 150})`;
        
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
            nextBtn.querySelector('span').textContent = currentIdx === 3 ? 'Modo Infinito' : 'Próxima fase';
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
        this.overlayLockUntil = performance.now() + 600;
        this.releaseInputs();
        
        const lvlBest = this.readLevelBestScore(this.currentLevel.id);
        const isRecord = this.score > lvlBest;
        
        if (isRecord) {
            this.saveLevelBestScore(this.currentLevel.id, this.score, this.distance);
        }
        
        const bestScore = this.readNumber('jungleRunBestScore');
        if (this.score > bestScore) {
            this.saveNumber('jungleRunBestScore', this.score);
            this.saveNumber('jungleRunBestDistance', this.distance);
        }

        document.getElementById('finalScore').textContent = this.pad(this.score, 4);
        document.getElementById('finalDistance').textContent = `${this.pad(this.distance, 3)}m`;
        document.getElementById('finalBest').textContent = `${this.pad(lvlBest > this.score ? lvlBest : this.score, 4)}`;
        document.getElementById('resultEyebrow').textContent = isRecord ? 'NOVO RECORDE!' : 'FIM DA EXPEDIÇÃO';
        const goal = this.currentLevel.distanceGoal;
        document.getElementById('resultTip').textContent = goal === Infinity
            ? `Você correu ${this.distance} m. Consegue ir mais longe?`
            : (this.mode === 'normal'
                ? `Você chegou a ${this.distance} de ${goal} m. Dica: experimente o modo Fácil, com 5 vidas.`
                : `Você chegou a ${this.distance} de ${goal} m. Dica: aperte pular um pouco antes do obstáculo.`);
        
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
        obj.destroy({ children: true });
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
            const hearts = Array.from({ length: this.maxLives }, (_, idx) => idx < this.lives ? '♥' : '♡').join('');
            const el = document.getElementById('lives');
            el.textContent = hearts;
            el.setAttribute('aria-label', `${this.lives} de ${this.maxLives} vidas`);
            if (!force) {
                // Microinteração: o contador "treme" ao perder vida.
                el.classList.remove('is-hit');
                void el.offsetWidth;
                el.classList.add('is-hit');
            }
        }
        if (force || this.uiCache.distance !== next.distance) {
            document.getElementById('distance').textContent = next.distance;
        }

        // Só toca no DOM quando o valor muda (antes: style e texto a cada frame).
        const goal = this.currentLevel.distanceGoal;
        const pct = goal !== Infinity
            ? Math.round(Math.min(100, (this.distance / goal) * 100))
            : Math.round((this.distance % 300) / 3.0);
        if (force || pct !== this.uiProgress) {
            this.uiProgress = pct;
            document.getElementById('progressFill').style.width = `${pct}%`;
        }

        if (force || this.uiBiome !== this.currentLevel.name) {
            this.uiBiome = this.currentLevel.name;
            document.getElementById('biomeLabel').textContent = this.currentLevel.name;
        }
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

window.addEventListener('load', () => {
    const game = new JungleRun();
    if (new URLSearchParams(location.search).has('debug')) window.__lab = { game };
}, { once: true });
