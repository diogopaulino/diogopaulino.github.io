// main.js - Claude Bros
// Jogo de plataforma simples com PixiJS

const TILE_SIZE = 40;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const MAX_FALL_SPEED = 12;

// SVG Textures encoded in base64
const SVGS = {
  claude: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="%23d97757"/><circle cx="12" cy="16" r="4" fill="%23fff"/><circle cx="28" cy="16" r="4" fill="%23fff"/><rect x="14" y="26" width="12" height="4" rx="2" fill="%23fff"/><path d="M 8 8 L 12 4 M 32 8 L 28 4" stroke="%239c4a30" stroke-width="3" stroke-linecap="round"/></svg>`,
  gemini: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 2 L23 16 L38 20 L23 24 L20 38 L17 24 L2 20 L17 16 Z" fill="%234285F4"/><circle cx="20" cy="20" r="6" fill="%23fff"/></svg>`,
  chatgpt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="%2310a37f"/><circle cx="14" cy="18" r="3" fill="%23fff"/><circle cx="26" cy="18" r="3" fill="%23fff"/><path d="M 12 28 Q 20 32 28 28" fill="none" stroke="%23fff" stroke-width="3" stroke-linecap="round"/></svg>`,
  block: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23b86038"/><rect width="38" height="38" fill="%23d67f56"/><path d="M0 10 L40 10 M0 20 L40 20 M0 30 L40 30 M10 0 L10 10 M30 10 L30 20 M15 20 L15 30 M25 30 L25 40" stroke="%239c4a30" stroke-width="2"/></svg>`,
  ground: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%2353a847"/><rect y="10" width="40" height="30" fill="%238c5b3e"/></svg>`,
};

// Nível: 1 = chao, 2 = bloco, 3 = gemini (moeda), 4 = chatgpt (inimigo)
const LEVEL = [
  "                                                  ",
  "                                                  ",
  "                                                  ",
  "                                        3         ",
  "           2222                        222        ",
  "                                                  ",
  "                   33                             ",
  "                  2222                            ",
  "        3                   4                     ",
  "       22                  2222     22            ",
  "                                                  ",
  "                                            4     ",
  "11111111111111  1111111111111111111111111111111111"
];

const GAME_WIDTH = 800;
const GAME_HEIGHT = LEVEL.length * TILE_SIZE; // 13 * 40 = 520

class Game {
  constructor() {
    this.app = new PIXI.Application({
      background: '#87CEEB', // Sky blue
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    document.getElementById('pixi-container').appendChild(this.app.view);
    
    // Scale container appropriately
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);

    this.textures = {};
    this.entities = [];
    this.tiles = [];
    this.coins = [];
    this.enemies = [];
    
    this.score = 0;
    this.isGameOver = false;

    this.keys = { left: false, right: false, up: false };
    
    this.loadAssets().then(() => {
      this.buildLevel();
      this.setupInput();
      this.app.ticker.add((delta) => this.update(delta));
    });
  }

  resize() {
    const parent = this.app.view.parentNode;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;

    const scale = Math.min(parentWidth / GAME_WIDTH, parentHeight / GAME_HEIGHT);
    this.app.view.style.width = `${GAME_WIDTH * scale}px`;
    this.app.view.style.height = `${GAME_HEIGHT * scale}px`;
  }

  async loadAssets() {
    for (const [key, b64] of Object.entries(SVGS)) {
      this.textures[key] = await PIXI.Texture.fromURL(b64);
    }
  }

  buildLevel() {
    for (let y = 0; y < LEVEL.length; y++) {
      const row = LEVEL[y];
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (char === '1') {
          this.createTile(px, py, this.textures.ground);
        } else if (char === '2') {
          this.createTile(px, py, this.textures.block);
        } else if (char === '3') {
          this.createCoin(px, py);
        } else if (char === '4') {
          this.createEnemy(px, py);
        }
      }
    }

    // Create player
    this.player = new PIXI.Sprite(this.textures.claude);
    this.player.x = 100;
    this.player.y = 100;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.width = 36;
    this.player.height = 36;
    // Centering anchor for flipping
    this.player.anchor.set(0.5, 0.5); 
    // Adjust position because of anchor
    this.player.x += 18;
    this.player.y += 18;
    
    this.container.addChild(this.player);
  }

  createTile(x, y, texture) {
    const tile = new PIXI.Sprite(texture);
    tile.x = x;
    tile.y = y;
    tile.width = TILE_SIZE;
    tile.height = TILE_SIZE;
    this.container.addChild(tile);
    this.tiles.push(tile);
  }

  createCoin(x, y) {
    const coin = new PIXI.Sprite(this.textures.gemini);
    coin.x = x + 4;
    coin.y = y + 4;
    coin.width = 32;
    coin.height = 32;
    this.container.addChild(coin);
    this.coins.push({ sprite: coin, active: true, startY: coin.y, time: Math.random() * 100 });
  }

  createEnemy(x, y) {
    const enemy = new PIXI.Sprite(this.textures.chatgpt);
    enemy.x = x;
    enemy.y = y;
    enemy.width = 36;
    enemy.height = 36;
    enemy.vx = -1.5; // Starts moving left
    this.container.addChild(enemy);
    this.enemies.push({ sprite: enemy, vx: -1.5, active: true });
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'ArrowRight') this.keys.right = true;
      if (e.code === 'Space' || e.code === 'ArrowUp') this.keys.up = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'ArrowRight') this.keys.right = false;
      if (e.code === 'Space' || e.code === 'ArrowUp') this.keys.up = false;
    });

    // Touch controls
    const bindTouch = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys[key] = true; el.classList.add('active'); });
      el.addEventListener('touchend', (e) => { e.preventDefault(); this.keys[key] = false; el.classList.remove('active'); });
    };

    bindTouch('btn-left', 'left');
    bindTouch('btn-right', 'right');
    bindTouch('btn-jump', 'up');

    document.getElementById('btn-restart').addEventListener('click', () => {
      location.reload();
    });
  }

  checkAABB(a, b) {
    // a is player (centered anchor), b is tile (top-left anchor)
    const ax = a.x - a.width/2;
    const ay = a.y - a.height/2;
    const aw = a.width;
    const ah = a.height;

    const bx = b.x;
    const by = b.y;
    const bw = b.width;
    const bh = b.height;

    return ax < bx + bw &&
           ax + aw > bx &&
           ay < by + bh &&
           ay + ah > by;
  }

  update(delta) {
    if (this.isGameOver) return;

    // Player input
    if (this.keys.left) {
      this.player.vx = -MOVE_SPEED;
      this.player.scale.x = -1; // Flip left
    } else if (this.keys.right) {
      this.player.vx = MOVE_SPEED;
      this.player.scale.x = 1; // Flip right
    } else {
      this.player.vx = 0;
    }

    // Apply gravity
    this.player.vy += GRAVITY * delta;
    if (this.player.vy > MAX_FALL_SPEED) this.player.vy = MAX_FALL_SPEED;

    // Horizontal Movement & Collision
    this.player.x += this.player.vx * delta;
    for (const tile of this.tiles) {
      if (this.checkAABB(this.player, tile)) {
        if (this.player.vx > 0) {
          this.player.x = tile.x - this.player.width/2;
        } else if (this.player.vx < 0) {
          this.player.x = tile.x + tile.width + this.player.width/2;
        }
        this.player.vx = 0;
      }
    }

    // Vertical Movement & Collision
    this.player.y += this.player.vy * delta;
    let grounded = false;
    for (const tile of this.tiles) {
      if (this.checkAABB(this.player, tile)) {
        if (this.player.vy > 0) {
          this.player.y = tile.y - this.player.height/2;
          grounded = true;
        } else if (this.player.vy < 0) {
          this.player.y = tile.y + tile.height + this.player.height/2;
        }
        this.player.vy = 0;
      }
    }

    // Jumping
    if (this.keys.up && grounded) {
      this.player.vy = JUMP_FORCE;
    }

    // Death by falling
    if (this.player.y > GAME_HEIGHT + 100) {
      this.gameOver(false);
    }

    // Update Enemies
    for (const enemyData of this.enemies) {
      if (!enemyData.active) continue;
      const enemy = enemyData.sprite;
      
      // Basic gravity for enemies
      let enemyVy = 4; // constant fall
      enemy.y += enemyVy * delta;
      for (const tile of this.tiles) {
        if (this.checkAABB({x: enemy.x + enemy.width/2, y: enemy.y + enemy.height/2, width: enemy.width, height: enemy.height}, tile)) {
           enemy.y = tile.y - enemy.height;
           break;
        }
      }

      enemy.x += enemyData.vx * delta;
      
      // Simple enemy wall collision
      let hitWall = false;
      for (const tile of this.tiles) {
        if (this.checkAABB({x: enemy.x + enemy.width/2, y: enemy.y + enemy.height/2, width: enemy.width, height: enemy.height}, tile)) {
          hitWall = true;
          break;
        }
      }
      
      // If going to fall off edge, turn around (simple AI)
      let holeAhead = true;
      const probeX = enemyData.vx > 0 ? enemy.x + enemy.width + 5 : enemy.x - 5;
      for (const tile of this.tiles) {
        if (this.checkAABB({x: probeX + enemy.width/2, y: enemy.y + enemy.height + 5 + enemy.height/2, width: enemy.width, height: enemy.height}, tile)) {
          holeAhead = false;
          break;
        }
      }

      if (hitWall || holeAhead) {
        enemyData.vx *= -1;
      }

      // Enemy Player Collision
      if (this.checkAABB(this.player, {x: enemy.x + enemy.width/2, y: enemy.y + enemy.height/2, width: enemy.width, height: enemy.height})) {
        // Did we jump on top?
        if (this.player.vy > 0 && this.player.y < enemy.y) {
          enemyData.active = false;
          enemy.visible = false;
          this.player.vy = JUMP_FORCE * 0.8; // Bounce
          this.addScore(100);
        } else {
          this.gameOver(false);
        }
      }
    }

    // Update Coins
    for (const coin of this.coins) {
      if (!coin.active) continue;
      
      // Hover animation
      coin.time += delta * 0.1;
      coin.sprite.y = coin.startY + Math.sin(coin.time) * 5;

      if (this.checkAABB(this.player, {x: coin.sprite.x + coin.sprite.width/2, y: coin.sprite.y + coin.sprite.height/2, width: coin.sprite.width, height: coin.sprite.height})) {
        coin.active = false;
        coin.sprite.visible = false;
        this.addScore(50);
      }
    }

    // Camera follow (center player on X axis)
    const targetX = GAME_WIDTH / 2 - this.player.x;
    // Clamp camera so it doesn't show left of the map
    const clampedX = Math.min(0, targetX);
    this.container.x = clampedX;
    
    // Win condition (reaching far right)
    if (this.player.x > LEVEL[0].length * TILE_SIZE - 200) {
      this.gameOver(true);
    }
  }

  addScore(points) {
    this.score += points;
    document.getElementById('score-display').innerText = this.score;
  }

  gameOver(win) {
    this.isGameOver = true;
    const screen = document.getElementById('game-over-screen');
    const title = document.getElementById('end-title');
    
    screen.classList.remove('hidden');
    if (win) {
      title.innerText = "Você Venceu!";
      title.style.color = "#53a847";
    } else {
      title.innerText = "Game Over";
      title.style.color = "#d97757";
    }
  }
}

// Ensure PIXI is available before starting
window.onload = () => {
  new Game();
};
