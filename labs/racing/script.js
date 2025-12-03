const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameRunning = false;
let score = 0;
let speed = 0;
let animationId;

// Car settings
const CAR_WIDTH = 50;
const CAR_HEIGHT = 90;
const LANE_COUNT = 4;
let LANE_WIDTH = 100;

const player = {
    x: 0,
    y: 0,
    lane: 1, // 0 to 3
    color: '#ff3333'
};

let traffic = [];
let roadOffset = 0;
let roadSpeed = 5;

// Resize handling
function resize() {
    canvas.width = Math.min(600, canvas.parentElement.clientWidth);
    canvas.height = canvas.parentElement.clientHeight;
    LANE_WIDTH = canvas.width / LANE_COUNT;
    player.y = canvas.height - CAR_HEIGHT - 50;
    updatePlayerX();
}

function updatePlayerX() {
    // Smooth transition could be added here
    player.x = (player.lane * LANE_WIDTH) + (LANE_WIDTH / 2) - (CAR_WIDTH / 2);
}

// Input
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;

    if (e.key === 'ArrowLeft') {
        if (player.lane > 0) {
            player.lane--;
            updatePlayerX();
        }
    } else if (e.key === 'ArrowRight') {
        if (player.lane < LANE_COUNT - 1) {
            player.lane++;
            updatePlayerX();
        }
    }
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    if (!gameRunning) return;
    const touchX = e.touches[0].clientX;
    const centerX = window.innerWidth / 2;

    if (touchX < centerX) {
        if (player.lane > 0) player.lane--;
    } else {
        if (player.lane < LANE_COUNT - 1) player.lane++;
    }
    updatePlayerX();
});

function spawnCar() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    // Don't spawn on top of another car
    const tooClose = traffic.some(car => car.lane === lane && car.y < 200);

    if (!tooClose) {
        traffic.push({
            x: (lane * LANE_WIDTH) + (LANE_WIDTH / 2) - (CAR_WIDTH / 2),
            y: -CAR_HEIGHT - 50,
            lane: lane,
            speed: Math.random() * 2 + 2, // Relative speed
            color: getRandomColor()
        });
    }
}

function getRandomColor() {
    const colors = ['#3366ff', '#33ff33', '#ffff33', '#ff33ff', '#ffffff'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function drawCar(x, y, color, isPlayer = false) {
    ctx.fillStyle = color;
    // Body
    ctx.fillRect(x, y, CAR_WIDTH, CAR_HEIGHT);

    // Roof
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 5, y + 20, CAR_WIDTH - 10, CAR_HEIGHT - 35);

    // Lights
    if (isPlayer) {
        ctx.fillStyle = '#ffcc00'; // Headlights
        ctx.fillRect(x + 5, y, 10, 5);
        ctx.fillRect(x + CAR_WIDTH - 15, y, 10, 5);

        ctx.fillStyle = '#ff0000'; // Taillights
        ctx.fillRect(x + 5, y + CAR_HEIGHT - 5, 10, 5);
        ctx.fillRect(x + CAR_WIDTH - 15, y + CAR_HEIGHT - 5, 10, 5);
    } else {
        ctx.fillStyle = '#ff0000'; // Taillights (facing player)
        ctx.fillRect(x + 5, y + CAR_HEIGHT - 5, 10, 5);
        ctx.fillRect(x + CAR_WIDTH - 15, y + CAR_HEIGHT - 5, 10, 5);
    }
}

function update() {
    if (!gameRunning) return;

    // Road movement
    roadOffset += roadSpeed;
    if (roadOffset >= 40) roadOffset = 0;

    // Traffic
    if (Math.random() < 0.02 + (score / 50000)) {
        spawnCar();
    }

    // Update traffic
    for (let i = traffic.length - 1; i >= 0; i--) {
        traffic[i].y += roadSpeed - traffic[i].speed; // They move slower than road (appear to move down)

        // Collision
        if (
            player.x < traffic[i].x + CAR_WIDTH &&
            player.x + CAR_WIDTH > traffic[i].x &&
            player.y < traffic[i].y + CAR_HEIGHT &&
            player.y + CAR_HEIGHT > traffic[i].y
        ) {
            gameOver();
        }

        // Remove off-screen
        if (traffic[i].y > canvas.height) {
            traffic.splice(i, 1);
            score += 100;
            document.getElementById('score').innerText = score;
        }
    }

    // Speed up
    if (score % 1000 === 0 && roadSpeed < 20) {
        roadSpeed += 0.01;
    }
    document.getElementById('speed').innerText = Math.floor(roadSpeed * 20);

    draw();
    animationId = requestAnimationFrame(update);
}

function draw() {
    // Clear
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Lanes
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.lineDashOffset = -roadOffset;

    for (let i = 1; i < LANE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * LANE_WIDTH, 0);
        ctx.lineTo(i * LANE_WIDTH, canvas.height);
        ctx.stroke();
    }

    // Draw Traffic
    traffic.forEach(car => {
        drawCar(car.x, car.y, car.color);
    });

    // Draw Player
    drawCar(player.x, player.y, player.color, true);
}

function startGame() {
    gameRunning = true;
    score = 0;
    roadSpeed = 10;
    traffic = [];
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    resize();
    update();
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    document.getElementById('finalScore').innerText = score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

window.addEventListener('resize', resize);
resize();
draw(); // Initial draw
