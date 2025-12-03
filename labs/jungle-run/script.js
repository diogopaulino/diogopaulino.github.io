const CONFIG = {
    GRAVITY: 0.6,
    JUMP_FORCE: -14,
    PLAYER_SPEED: 5,
    VINE_SWING_SPEED: 0.03,
    GROUND_Y: 0.75,
    SCROLL_SPEED: 3,
    SEGMENT_WIDTH: 300,
    SPAWN_DISTANCE: 400
};

class JungleRun {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.app = null;
        this.gameRunning = false;
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.keys = {};
        this.touchControls = { left: false, right: false, jump: false };
        this.player = null;
        this.platforms = [];
        this.obstacles = [];
        this.collectibles = [];
        this.vines = [];
        this.backgroundLayers = [];
        this.groundLevel = 0;
        this.cameraX = 0;
        this.lastSpawnX = 0;
        this.worldContainer = null;
        this.invincible = false;
        this.init();
    }

    async init() {
        this.app = new PIXI.Application();
        await this.app.init({
            canvas: this.canvas,
            resizeTo: this.canvas.parentElement,
            backgroundColor: 0x0d1f0d,
            antialias: false,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        this.groundLevel = this.app.screen.height * CONFIG.GROUND_Y;
        this.setupEventListeners();
        this.createBackground();
        this.createWorld();
        this.showStartScreen();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());

        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const jumpBtn = document.getElementById('jumpBtn');

        const addTouchListener = (btn, control) => {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchControls[control] = true; });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); this.touchControls[control] = false; });
            btn.addEventListener('mousedown', () => this.touchControls[control] = true);
            btn.addEventListener('mouseup', () => this.touchControls[control] = false);
            btn.addEventListener('mouseleave', () => this.touchControls[control] = false);
        };

        addTouchListener(leftBtn, 'left');
        addTouchListener(rightBtn, 'right');
        addTouchListener(jumpBtn, 'jump');

        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        if (this.app) {
            this.groundLevel = this.app.screen.height * CONFIG.GROUND_Y;
        }
    }

    createBackground() {
        const colors = [
            { y: 0, color: 0x1a0a2e },
            { y: 0.15, color: 0x16213e },
            { y: 0.4, color: 0x1a3a1a },
            { y: 0.7, color: 0x0d1f0d },
            { y: 1, color: 0x050a05 }
        ];

        const bg = new PIXI.Graphics();
        const h = this.app.screen.height;
        const w = this.app.screen.width;

        for (let i = 0; i < colors.length - 1; i++) {
            const startY = colors[i].y * h;
            const endY = colors[i + 1].y * h;
            bg.rect(0, startY, w * 3, endY - startY);
            bg.fill(colors[i].color);
        }

        this.app.stage.addChild(bg);
        this.backgroundLayers.push({ sprite: bg, speed: 0 });

        for (let layer = 0; layer < 3; layer++) {
            const container = new PIXI.Container();
            const treeCount = 15 + layer * 5;
            const depth = 0.2 + layer * 0.3;
            const alpha = 0.3 + layer * 0.2;

            for (let i = 0; i < treeCount; i++) {
                const tree = this.createTree(depth, alpha);
                tree.x = (i / treeCount) * w * 3;
                tree.y = this.app.screen.height * (0.4 + layer * 0.1);
                container.addChild(tree);
            }

            this.app.stage.addChild(container);
            this.backgroundLayers.push({ sprite: container, speed: 0.2 + layer * 0.2 });
        }

        this.createStars();
    }

    createStars() {
        const stars = new PIXI.Graphics();
        const w = this.app.screen.width * 3;
        const h = this.app.screen.height * 0.4;

        for (let i = 0; i < 100; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const size = Math.random() * 2 + 1;
            const alpha = Math.random() * 0.5 + 0.3;

            stars.circle(x, y, size);
            stars.fill({ color: 0xffffff, alpha });
        }

        this.app.stage.addChildAt(stars, 1);
        this.backgroundLayers.push({ sprite: stars, speed: 0.05 });
    }

    createTree(scale, alpha) {
        const tree = new PIXI.Graphics();
        const baseHeight = 150 * scale;
        const baseWidth = 30 * scale;

        tree.rect(-baseWidth / 2, 0, baseWidth, baseHeight);
        tree.fill({ color: 0x3d2314, alpha });

        const foliageLevels = 4;
        for (let i = 0; i < foliageLevels; i++) {
            const y = -i * 30 * scale;
            const width = (80 - i * 15) * scale;
            const height = 50 * scale;

            tree.moveTo(0, y - height);
            tree.lineTo(width / 2, y);
            tree.lineTo(-width / 2, y);
            tree.closePath();
            tree.fill({ color: i % 2 === 0 ? 0x1a5a1a : 0x2d7a2d, alpha });
        }

        return tree;
    }

    createWorld() {
        this.worldContainer = new PIXI.Container();
        this.app.stage.addChild(this.worldContainer);

        this.createGround();
        this.createPlayer();
        this.spawnInitialContent();
    }

    createGround() {
        const ground = new PIXI.Graphics();
        const h = this.app.screen.height;
        const w = this.app.screen.width * 10;

        ground.rect(0, this.groundLevel, w, h - this.groundLevel);
        ground.fill(0x2d1810);

        ground.rect(0, this.groundLevel, w, 10);
        ground.fill(0x4a8f4a);

        for (let x = 0; x < w; x += 20) {
            const grassHeight = Math.random() * 15 + 5;
            ground.moveTo(x, this.groundLevel);
            ground.lineTo(x + 5, this.groundLevel - grassHeight);
            ground.lineTo(x + 10, this.groundLevel);
            ground.fill(0x3a7a3a);
        }

        this.worldContainer.addChild(ground);
        this.ground = ground;
    }

    createPlayer() {
        this.player = new PIXI.Container();

        const body = new PIXI.Graphics();
        body.roundRect(-15, -50, 30, 40, 5);
        body.fill(0xc9a66b);
        body.roundRect(-12, -55, 24, 15, 8);
        body.fill(0xf5d5b0);
        body.circle(-5, -50, 3);
        body.fill(0x000000);
        body.circle(5, -50, 3);
        body.fill(0x000000);
        body.rect(-18, -45, 6, 20);
        body.fill(0xc9a66b);
        body.rect(12, -45, 6, 20);
        body.fill(0xc9a66b);
        body.rect(-12, -10, 10, 25);
        body.fill(0x2d5a2d);
        body.rect(2, -10, 10, 25);
        body.fill(0x2d5a2d);
        body.roundRect(-8, -60, 16, 8, 2);
        body.fill(0x8b4513);

        this.player.addChild(body);
        this.player.x = 100;
        this.player.y = this.groundLevel;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onVine = null;
        this.player.facingRight = true;

        this.worldContainer.addChild(this.player);
    }

    spawnInitialContent() {
        for (let i = 0; i < 5; i++) {
            this.spawnCollectible(400 + i * 80);
        }
        for (let x = 800; x < 2000; x += CONFIG.SEGMENT_WIDTH) {
            this.spawnSegment(x);
        }
        this.lastSpawnX = 2000;
    }

    spawnSegment(x) {
        const segmentType = Math.random();

        if (segmentType < 0.25) {
            this.spawnPit(x);
        } else if (segmentType < 0.45) {
            this.spawnCrocodile(x);
        } else if (segmentType < 0.6) {
            this.spawnLog(x);
        } else if (segmentType < 0.75) {
            this.spawnVine(x);
        }

        if (Math.random() < 0.4) {
            this.spawnCollectible(x + Math.random() * 100);
        }
    }

    spawnPit(x) {
        const pitWidth = 80 + Math.random() * 60;
        const pit = new PIXI.Graphics();

        pit.rect(0, 0, pitWidth, 100);
        pit.fill(0x050505);

        for (let i = 0; i < pitWidth; i += 15) {
            pit.rect(i, -5, 8, 10);
            pit.fill(0x1a0a05);
        }

        pit.x = x;
        pit.y = this.groundLevel;
        pit.type = 'pit';
        pit.width = pitWidth;
        pit.height = 100;

        this.worldContainer.addChild(pit);
        this.obstacles.push(pit);

        const platformY = this.groundLevel - 60;
        for (let px = x; px < x + pitWidth; px += 40) {
            if (Math.random() < 0.5) {
                this.createPlatform(px, platformY, 30);
            }
        }
    }

    createPlatform(x, y, width) {
        const platform = new PIXI.Graphics();

        platform.roundRect(0, 0, width, 12, 3);
        platform.fill(0x5d3a1a);

        platform.rect(2, 2, width - 4, 4);
        platform.fill(0x8b5a2b);

        platform.x = x;
        platform.y = y;
        platform.platformWidth = width;
        platform.platformHeight = 12;

        this.worldContainer.addChild(platform);
        this.platforms.push(platform);
    }

    spawnCrocodile(x) {
        const croc = new PIXI.Container();

        const body = new PIXI.Graphics();
        body.ellipse(0, 0, 50, 15);
        body.fill(0x2d5a2d);
        body.moveTo(50, 0);
        body.lineTo(80, -5);
        body.lineTo(80, 5);
        body.closePath();
        body.fill(0x2d5a2d);
        body.moveTo(-50, -5);
        body.lineTo(-70, 0);
        body.lineTo(-50, 5);
        body.closePath();
        body.fill(0x3d6a3d);

        for (let i = -40; i < 50; i += 15) {
            body.moveTo(i, -15);
            body.lineTo(i + 5, -20);
            body.lineTo(i + 10, -15);
            body.fill(0x1a3a1a);
        }

        body.circle(-60, -3, 4);
        body.fill(0xff0000);

        const teeth = new PIXI.Graphics();
        for (let i = -65; i < -50; i += 5) {
            teeth.moveTo(i, 0);
            teeth.lineTo(i + 2, 5);
            teeth.lineTo(i + 4, 0);
            teeth.fill(0xffffff);
        }

        croc.addChild(body);
        croc.addChild(teeth);

        croc.x = x;
        croc.y = this.groundLevel - 15;
        croc.type = 'crocodile';
        croc.hitWidth = 100;
        croc.hitHeight = 30;
        croc.animTime = Math.random() * Math.PI * 2;
        croc.mouthOpen = false;

        this.worldContainer.addChild(croc);
        this.obstacles.push(croc);
    }

    spawnLog(x) {
        const log = new PIXI.Graphics();

        log.ellipse(0, 0, 40, 20);
        log.fill(0x5d3a1a);
        log.ellipse(0, 0, 35, 15);
        log.fill(0x8b5a2b);

        for (let r = 5; r < 30; r += 8) {
            log.circle(0, 0, r);
            log.stroke({ color: 0x4a3010, width: 1, alpha: 0.5 });
        }

        log.x = x;
        log.y = this.groundLevel - 20;
        log.vx = -2 - Math.random() * 2;
        log.type = 'log';
        log.hitWidth = 80;
        log.hitHeight = 40;
        log.rotation = 0;

        this.worldContainer.addChild(log);
        this.obstacles.push(log);
    }

    spawnVine(x) {
        const vine = new PIXI.Container();
        const ropeLength = 150 + Math.random() * 100;

        const rope = new PIXI.Graphics();
        rope.moveTo(0, 0);
        rope.lineTo(0, ropeLength);
        rope.stroke({ color: 0x2d5a2d, width: 6 });

        rope.moveTo(0, 0);
        rope.lineTo(0, ropeLength);
        rope.stroke({ color: 0x4a8f4a, width: 3 });

        for (let ly = 20; ly < ropeLength; ly += 30) {
            const leafSize = 10 + Math.random() * 5;
            rope.ellipse(5, ly, leafSize, leafSize / 2);
            rope.fill(0x3a7a3a);
        }

        vine.addChild(rope);
        vine.x = x;
        vine.y = 50;
        vine.ropeLength = ropeLength;
        vine.angle = -0.5;
        vine.angleVelocity = 0;
        vine.type = 'vine';

        this.worldContainer.addChild(vine);
        this.vines.push(vine);
    }

    spawnCollectible(x) {
        const collectible = new PIXI.Container();
        const type = Math.random() < 0.3 ? 'diamond' : 'gold';

        const gem = new PIXI.Graphics();

        if (type === 'diamond') {
            gem.moveTo(0, -15);
            gem.lineTo(12, 0);
            gem.lineTo(0, 15);
            gem.lineTo(-12, 0);
            gem.closePath();
            gem.fill(0x00ffff);

            gem.moveTo(0, -15);
            gem.lineTo(6, -5);
            gem.lineTo(0, 15);
            gem.lineTo(-6, -5);
            gem.closePath();
            gem.fill({ color: 0xffffff, alpha: 0.5 });

            collectible.value = 100;
        } else {
            gem.circle(0, 0, 12);
            gem.fill(0xffd700);

            gem.circle(-3, -3, 5);
            gem.fill({ color: 0xffff00, alpha: 0.6 });

            gem.rect(-6, -2, 12, 4);
            gem.fill(0xb8860b);

            collectible.value = 50;
        }

        const glow = new PIXI.Graphics();
        glow.circle(0, 0, 20);
        glow.fill({ color: type === 'diamond' ? 0x00ffff : 0xffd700, alpha: 0.2 });

        collectible.addChild(glow);
        collectible.addChild(gem);

        collectible.x = x;
        collectible.y = this.groundLevel - 50 - Math.random() * 80;
        collectible.type = type;
        collectible.animTime = Math.random() * Math.PI * 2;

        this.worldContainer.addChild(collectible);
        this.collectibles.push(collectible);
    }

    showStartScreen() {
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
    }

    startGame() {
        document.getElementById('startScreen').classList.add('hidden');
        this.gameRunning = true;
        this.invincible = true;
        setTimeout(() => { this.invincible = false; }, 2000);
        this.app.ticker.add(this.gameLoop, this);
    }

    restartGame() {
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.cameraX = 0;
        this.invincible = false;

        this.updateUI();

        [...this.obstacles, ...this.collectibles, ...this.vines, ...this.platforms].forEach(obj => {
            this.worldContainer.removeChild(obj);
        });

        this.obstacles = [];
        this.collectibles = [];
        this.vines = [];
        this.platforms = [];

        this.player.x = 100;
        this.player.y = this.groundLevel;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onVine = null;

        this.spawnInitialContent();
        this.lastSpawnX = 2000;

        document.getElementById('gameOverScreen').classList.add('hidden');
        this.gameRunning = true;
        this.app.ticker.add(this.gameLoop, this);
    }

    gameLoop(ticker) {
        if (!this.gameRunning) return;

        const delta = ticker.deltaTime;

        this.handleInput();
        this.updatePlayer(delta);
        this.updateObstacles(delta);
        this.updateCollectibles(delta);
        this.updateVines(delta);
        this.updateCamera();
        this.checkCollisions();
        this.spawnNewContent();
        this.cleanupOffscreen();
        this.updateBackground();
        this.updateUI();
    }

    handleInput() {
        const left = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchControls.left;
        const right = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchControls.right;
        const jump = this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchControls.jump;

        if (this.player.onVine) {
            if (jump && !this.player.jumpReleased) {
                return;
            }
            if (!jump) {
                this.player.jumpReleased = true;
            }
            if (jump && this.player.jumpReleased) {
                const vine = this.player.onVine;
                this.player.onVine = null;
                this.player.vy = -10;
                this.player.vx = Math.sin(vine.angle) * 15;
                this.player.jumpReleased = false;
            }
            return;
        }

        this.player.vx = 0;
        if (left) {
            this.player.vx = -CONFIG.PLAYER_SPEED;
            this.player.facingRight = false;
        }
        if (right) {
            this.player.vx = CONFIG.PLAYER_SPEED;
            this.player.facingRight = true;
        }

        if (jump && this.player.onGround && this.player.jumpReleased) {
            this.player.vy = CONFIG.JUMP_FORCE;
            this.player.onGround = false;
            this.player.jumpReleased = false;
        }

        if (!jump) {
            this.player.jumpReleased = true;
        }
    }

    updatePlayer(delta) {
        if (this.player.onVine) {
            const vine = this.player.onVine;
            const endX = vine.x + Math.sin(vine.angle) * vine.ropeLength;
            const endY = vine.y + Math.cos(vine.angle) * vine.ropeLength;
            this.player.x = endX;
            this.player.y = endY;
            return;
        }

        this.player.vy += CONFIG.GRAVITY * delta;
        this.player.x += this.player.vx * delta;
        this.player.y += this.player.vy * delta;

        this.player.x += CONFIG.SCROLL_SPEED * delta * 0.3;

        let onPlatform = false;
        for (const platform of this.platforms) {
            if (this.player.vy > 0 &&
                this.player.x > platform.x &&
                this.player.x < platform.x + platform.platformWidth &&
                this.player.y >= platform.y &&
                this.player.y - this.player.vy * delta <= platform.y + 5) {
                this.player.y = platform.y;
                this.player.vy = 0;
                this.player.onGround = true;
                onPlatform = true;
                break;
            }
        }

        if (!onPlatform && this.player.y >= this.groundLevel) {
            let inPit = false;
            for (const obs of this.obstacles) {
                if (obs.type === 'pit') {
                    if (this.player.x > obs.x + 10 && this.player.x < obs.x + obs.width - 10) {
                        inPit = true;
                        break;
                    }
                }
            }

            if (inPit) {
                if (this.player.y > this.groundLevel + 50) {
                    this.takeDamage();
                }
            } else {
                this.player.y = this.groundLevel;
                this.player.vy = 0;
                this.player.onGround = true;
            }
        } else if (!onPlatform) {
            this.player.onGround = false;
        }

        this.player.scale.x = this.player.facingRight ? 1 : -1;

        this.distance = Math.floor((this.player.x - 100) / 10);
    }

    updateObstacles(delta) {
        for (const obs of this.obstacles) {
            if (obs.type === 'crocodile') {
                obs.animTime += 0.05 * delta;
                obs.y = this.groundLevel - 15 + Math.sin(obs.animTime) * 3;

                if (Math.sin(obs.animTime * 2) > 0.8 !== obs.mouthOpen) {
                    obs.mouthOpen = !obs.mouthOpen;
                }
            } else if (obs.type === 'log') {
                obs.x += obs.vx * delta;
                obs.rotation += 0.02 * delta;
            }
        }
    }

    updateCollectibles(delta) {
        for (const col of this.collectibles) {
            col.animTime += 0.08 * delta;
            col.y += Math.sin(col.animTime) * 0.3;
            col.rotation = Math.sin(col.animTime * 0.5) * 0.1;

            const glow = col.children[0];
            if (glow) {
                glow.scale.set(1 + Math.sin(col.animTime * 2) * 0.2);
            }
        }
    }

    updateVines(delta) {
        for (const vine of this.vines) {
            if (vine === this.player.onVine) {
                vine.angleVelocity += Math.sin(vine.angle) * -0.001 * delta;
            } else {
                vine.angleVelocity += Math.sin(vine.angle) * -0.0005 * delta;
            }

            vine.angleVelocity *= 0.995;
            vine.angle += vine.angleVelocity * delta;

            vine.children[0].clear();
            const rope = vine.children[0];

            const endX = Math.sin(vine.angle) * vine.ropeLength;
            const endY = Math.cos(vine.angle) * vine.ropeLength;

            rope.moveTo(0, 0);
            rope.quadraticCurveTo(endX * 0.5, endY * 0.3, endX, endY);
            rope.stroke({ color: 0x2d5a2d, width: 6 });

            rope.moveTo(0, 0);
            rope.quadraticCurveTo(endX * 0.5, endY * 0.3, endX, endY);
            rope.stroke({ color: 0x4a8f4a, width: 3 });
        }
    }

    updateCamera() {
        const targetX = this.player.x - this.app.screen.width * 0.3;
        this.cameraX += (targetX - this.cameraX) * 0.1;
        this.worldContainer.x = -this.cameraX;
    }

    updateBackground() {
        for (const layer of this.backgroundLayers) {
            if (layer.speed > 0) {
                layer.sprite.x = -this.cameraX * layer.speed;
            }
        }
    }

    checkCollisions() {
        if (this.invincible) return;

        const playerBounds = {
            x: this.player.x - 12,
            y: this.player.y - 55,
            width: 24,
            height: 55
        };

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const col = this.collectibles[i];
            const dx = this.player.x - col.x;
            const dy = (this.player.y - 25) - col.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 30) {
                this.score += col.value;
                this.worldContainer.removeChild(col);
                this.collectibles.splice(i, 1);
                this.createCollectEffect(col.x, col.y, col.type);
            }
        }

        for (const obs of this.obstacles) {
            if (obs.type === 'crocodile' || obs.type === 'log') {
                const obsX = obs.x - obs.hitWidth / 2;
                const obsY = obs.y - obs.hitHeight / 2;

                if (this.rectIntersect(playerBounds, { x: obsX, y: obsY, width: obs.hitWidth, height: obs.hitHeight })) {
                    if (obs.type === 'log' && this.player.vy > 0 && this.player.y < obs.y) {
                        this.player.y = obs.y - obs.hitHeight / 2 - 55;
                        this.player.vy = CONFIG.JUMP_FORCE * 0.7;
                    } else {
                        this.takeDamage();
                    }
                }
            }
        }

        for (const vine of this.vines) {
            if (this.player.onVine) continue;

            const endX = vine.x + Math.sin(vine.angle) * vine.ropeLength;
            const endY = vine.y + Math.cos(vine.angle) * vine.ropeLength;

            const dx = this.player.x - endX;
            const dy = (this.player.y - 25) - endY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 40 && (this.keys['ArrowUp'] || this.keys['KeyW'])) {
                this.player.onVine = vine;
                this.player.jumpReleased = false;
                vine.angleVelocity += this.player.vx * 0.01;
            }
        }
    }

    rectIntersect(a, b) {
        return a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
    }

    createCollectEffect(x, y, type) {
        const particles = new PIXI.Container();

        for (let i = 0; i < 8; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 4);
            particle.fill(type === 'diamond' ? 0x00ffff : 0xffd700);
            particle.vx = (Math.random() - 0.5) * 8;
            particle.vy = (Math.random() - 0.5) * 8 - 3;
            particle.x = x;
            particle.y = y;
            particles.addChild(particle);
        }

        this.worldContainer.addChild(particles);

        let life = 30;
        const animate = () => {
            life--;
            for (const p of particles.children) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2;
                p.alpha = life / 30;
            }
            if (life > 0) {
                requestAnimationFrame(animate);
            } else {
                this.worldContainer.removeChild(particles);
            }
        };
        animate();
    }

    takeDamage() {
        if (this.invincible) return;

        this.lives--;
        this.invincible = true;

        let flashes = 0;
        const flashInterval = setInterval(() => {
            this.player.alpha = this.player.alpha === 1 ? 0.3 : 1;
            flashes++;
            if (flashes >= 10) {
                clearInterval(flashInterval);
                this.player.alpha = 1;
                this.invincible = false;
            }
        }, 100);

        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.respawnPlayer();
        }
    }

    respawnPlayer() {
        this.player.y = this.groundLevel - 100;
        this.player.vy = 0;
        this.player.onVine = null;
    }

    gameOver() {
        this.gameRunning = false;
        this.app.ticker.remove(this.gameLoop, this);

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalDistance').textContent = this.distance + 'm';
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    spawnNewContent() {
        while (this.lastSpawnX < this.player.x + CONFIG.SPAWN_DISTANCE * 3) {
            this.spawnSegment(this.lastSpawnX);
            this.lastSpawnX += CONFIG.SEGMENT_WIDTH;
        }
    }

    cleanupOffscreen() {
        const cleanup = (arr) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i].x < this.cameraX - 200) {
                    this.worldContainer.removeChild(arr[i]);
                    arr.splice(i, 1);
                }
            }
        };

        cleanup(this.obstacles);
        cleanup(this.collectibles);
        cleanup(this.vines);
        cleanup(this.platforms);
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('distance').textContent = this.distance + 'm';
    }
}

window.addEventListener('load', () => new JungleRun());

