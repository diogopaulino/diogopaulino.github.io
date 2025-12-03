const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.6;
const GROUND_Y_START = 300; // Horizon line where walkable area starts
const GROUND_Y_END = 430;   // Bottom of screen
const SCROLL_SPEED = 4;

// Game State
let gameState = 'PLAYING';
let score = 0;
let cameraX = 0;

// Inputs
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    z: false, // Punch
    x: false  // Jump
};

// Assets
const assets = {
    background: new Image(),
    player: new Image(),
    enemy: new Image()
};

assets.background.src = 'assets/background.png';
assets.player.src = 'assets/player.png';
assets.enemy.src = 'assets/enemy.png';

// Sprite Class
class Sprite {
    constructor({ position, image, frames = { max: 1, rows: 1 }, scale = 1, offset = { x: 0, y: 0 } }) {
        this.position = position; // x, y (depth), z (height)
        this.image = image;
        this.frames = { ...frames, val: 0, elapsed: 0, row: 0 };
        this.image.onload = () => {
            this.width = (this.image.width / this.frames.max) * scale;
            this.height = (this.image.height / this.frames.rows) * scale;
        };
        this.scale = scale;
        this.offset = offset;
        this.moving = false;
    }

    draw() {
        if (!this.image) return;

        const frameWidth = this.image.width / this.frames.max;
        const frameHeight = this.image.height / this.frames.rows;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(
            this.position.x - cameraX,
            this.position.y,
            30, 10, 0, 0, Math.PI * 2
        );
        ctx.fill();

        // Character
        ctx.drawImage(
            this.image,
            this.frames.val * frameWidth,
            this.frames.row * frameHeight,
            frameWidth,
            frameHeight,
            this.position.x - this.offset.x - cameraX,
            this.position.y - this.position.z - this.offset.y, // Apply Z (jump height)
            frameWidth * this.scale,
            frameHeight * this.scale
        );
    }

    update() {
        this.draw();
        this.frames.elapsed++;

        if (this.frames.elapsed % 8 === 0) {
            if (this.moving) {
                if (this.frames.val < this.frames.max - 1) {
                    this.frames.val++;
                } else {
                    this.frames.val = 0;
                }
            } else {
                this.frames.val = 0;
            }
        }
    }
}

// Fighter Class
class Fighter extends Sprite {
    constructor({ position, velocity, color = 'red', image, frames = { max: 1, rows: 1 }, scale = 1, offset = { x: 0, y: 0 }, isPlayer = false }) {
        super({ position, image, frames, scale, offset });
        this.velocity = velocity; // x, y (depth), z (vertical)
        this.width = 50;
        this.height = 120;
        this.isPlayer = isPlayer;

        this.attackBox = {
            position: { x: this.position.x, y: this.position.y },
            offset: { x: 40, y: 0 }, // Hitbox slightly in front
            width: 80,
            height: 50
        };

        this.color = color;
        this.isAttacking = false;
        this.health = 100;
        this.maxHealth = 100;
        this.isHurt = false;
        this.dead = false;

        // Animation States
        this.animations = {
            idle: 0,
            walk: 1,
            attack: 2,
            hurt: 0 // Reuse idle or specific frame if available
        };
        this.currentAnimation = 'idle';
        this.facingRight = true;
    }

    update() {
        if (this.dead) return;

        this.draw();
        this.drawHealthBar();

        // Animation Logic
        this.frames.elapsed++;
        if (this.frames.elapsed % 8 === 0) {
            if (this.frames.val < this.frames.max - 1) {
                this.frames.val++;
            } else {
                if (this.isAttacking) {
                    this.isAttacking = false;
                    this.switchSprite('idle');
                } else if (this.isHurt) {
                    this.isHurt = false;
                    this.switchSprite('idle');
                } else {
                    this.frames.val = 0;
                }
            }
        }

        // Update Hitbox
        this.attackBox.position.x = this.position.x + (this.facingRight ? this.attackBox.offset.x : -this.attackBox.offset.x - this.attackBox.width);
        this.attackBox.position.y = this.position.y - 80; // Hitbox height relative to ground

        // Physics
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.position.z += this.velocity.z;

        // Gravity
        if (this.position.z + this.velocity.z > 0) {
            this.velocity.z -= GRAVITY;
        } else {
            this.velocity.z = 0;
            this.position.z = 0;
        }

        // Friction
        this.velocity.x *= 0.9;
        this.velocity.y *= 0.9;

        // Boundaries
        if (this.position.y < GROUND_Y_START) this.position.y = GROUND_Y_START;
        if (this.position.y > GROUND_Y_END) this.position.y = GROUND_Y_END;

        // Determine Animation State
        if (this.isHurt) {
            // Flash or shake
        } else if (this.isAttacking) {
            this.switchSprite('attack');
        } else if (Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.y) > 0.5) {
            this.switchSprite('walk');
        } else {
            this.switchSprite('idle');
        }

        // Facing Direction
        if (this.velocity.x > 0) this.facingRight = true;
        if (this.velocity.x < 0) this.facingRight = false;
    }

    drawHealthBar() {
        const barWidth = 50;
        const barHeight = 5;
        const x = this.position.x - cameraX - barWidth / 2 + 20; // Centered above sprite
        const y = this.position.y - this.position.z - 130; // Above head

        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#0f0';
        ctx.fillRect(x, y, barWidth * (this.health / this.maxHealth), barHeight);
    }

    switchSprite(name) {
        if (this.currentAnimation === name) return;

        // Override for attack/hurt to finish
        if ((this.currentAnimation === 'attack' || this.currentAnimation === 'hurt') && this.frames.val < this.frames.max - 1) return;

        this.currentAnimation = name;
        this.frames.row = this.animations[name];
        this.frames.val = 0;
    }

    attack() {
        if (this.isAttacking || this.isHurt || this.position.z > 0) return;
        this.isAttacking = true;
        this.switchSprite('attack');
        this.frames.val = 0;
    }

    takeHit(damage) {
        this.health -= damage;
        this.isHurt = true;
        this.velocity.x = this.facingRight ? -5 : 5; // Knockback
        this.velocity.z = 5; // Pop up

        // Visual hit effect (flash)
        // TODO: Add particle effect

        if (this.health <= 0) {
            this.dead = true;
            // Death animation or remove
        }
    }
}

// Create Player
const player = new Fighter({
    position: { x: 100, y: 350, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    image: assets.player,
    frames: { max: 4, rows: 3 },
    scale: 2.5,
    offset: { x: 0, y: 130 }, // Adjust to align feet with shadow
    isPlayer: true
});

// Create Enemies
let enemies = [];
function spawnEnemy() {
    const x = cameraX + canvas.width + 50 + Math.random() * 100;
    const y = GROUND_Y_START + Math.random() * (GROUND_Y_END - GROUND_Y_START);
    enemies.push(new Fighter({
        position: { x: x, y: y, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        color: 'blue',
        image: assets.enemy,
        frames: { max: 4, rows: 3 },
        scale: 2.5,
        offset: { x: 0, y: 130 }
    }));
}

// Input Event Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;

    if (e.key === 'z') {
        player.attack();
        checkCollisions();
    }
    if (e.key === 'x' && player.position.z === 0) {
        player.velocity.z = 12;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function checkCollisions() {
    // Only check on the specific frame of the attack for "impact" feel
    // For simplicity, we check immediately when 'z' is pressed for now

    enemies.forEach((enemy) => {
        // 2.5D Collision Detection
        // Check X overlap
        const xOverlap =
            player.attackBox.position.x + player.attackBox.width >= enemy.position.x - 20 &&
            player.attackBox.position.x <= enemy.position.x + 20;

        // Check Y (Depth) overlap - crucial for beat 'em ups
        const yOverlap = Math.abs(player.position.y - enemy.position.y) < 30;

        if (xOverlap && yOverlap && !enemy.isHurt && !enemy.dead) {
            enemy.takeHit(20);
            score += 100;
        }
    });
}

function update() {
    // Player Movement
    // Reset velocity handled by friction, just add acceleration here
    if (keys.ArrowLeft) {
        player.velocity.x = -SCROLL_SPEED;
    } else if (keys.ArrowRight) {
        player.velocity.x = SCROLL_SPEED;
    }

    if (keys.ArrowUp) {
        player.velocity.y = -SCROLL_SPEED * 0.7; // Slower vertical movement
    } else if (keys.ArrowDown) {
        player.velocity.y = SCROLL_SPEED * 0.7;
    }

    // Camera Scroll
    // Camera follows player but locks at left edge
    if (player.position.x > cameraX + 300) {
        cameraX = player.position.x - 300;
    }
    if (cameraX < 0) cameraX = 0;

    // Enemy AI
    enemies.forEach(enemy => {
        if (enemy.dead) return;

        const dx = player.position.x - enemy.position.x;
        const dy = player.position.y - enemy.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Simple state machine
        if (!enemy.isHurt && dist < 400) {
            // Move towards player
            if (Math.abs(dx) > 60) {
                enemy.velocity.x += dx > 0 ? 0.2 : -0.2;
            }
            if (Math.abs(dy) > 10) {
                enemy.velocity.y += dy > 0 ? 0.1 : -0.1;
            }

            // Attack if close
            if (dist < 80 && Math.random() < 0.02) {
                enemy.attack();
                // Check if player hit
                if (
                    Math.abs(player.position.y - enemy.position.y) < 30 &&
                    Math.abs(player.position.x - enemy.position.x) < 80 &&
                    !player.isHurt
                ) {
                    player.takeHit(10);
                }
            }
        }
    });

    // Cleanup dead enemies
    enemies = enemies.filter(e => !e.dead);

    // Spawn enemies
    if (enemies.length < 3 && Math.random() < 0.01) {
        spawnEnemy();
    }
}

function draw() {
    // Clear Screen
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    if (assets.background.complete) {
        // Parallax effect
        const bgX = -cameraX * 0.5;
        // Tile background if needed or just clamp
        ctx.drawImage(assets.background, bgX, 0, canvas.width * 2, canvas.height);
    }

    // Depth Sorting
    // Create a list of all renderable entities
    const allEntities = [player, ...enemies];

    // Sort by Y position (painter's algorithm for 2.5D)
    allEntities.sort((a, b) => a.position.y - b.position.y);

    // Draw all
    allEntities.forEach(entity => entity.update());

    // UI
    // Health Bar for Player
    ctx.fillStyle = 'black';
    ctx.fillRect(20, 20, 200, 20);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(20, 20, 200 * (player.health / player.maxHealth), 20);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(20, 20, 200, 20);

    ctx.fillStyle = 'white';
    ctx.font = '16px "Press Start 2P"';
    ctx.fillText(`SCORE: ${score}`, 20, 60);

    if (player.health <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '40px "Press Start 2P"';
        ctx.fillText('GAME OVER', canvas.width / 2 - 140, canvas.height / 2);
        ctx.font = '20px "Press Start 2P"';
        ctx.fillText('Press R to Restart', canvas.width / 2 - 120, canvas.height / 2 + 50);
    }
}

// Restart Handler
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && player.health <= 0) {
        player.health = 100;
        player.position = { x: 100, y: 350, z: 0 };
        score = 0;
        enemies = [];
        cameraX = 0;
    }
});

function gameLoop() {
    window.requestAnimationFrame(gameLoop);
    update();
    draw();
}

// Start
gameLoop();
