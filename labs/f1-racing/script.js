const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const finishScreen = document.getElementById('finishScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const positionEl = document.getElementById('position');
const lapEl = document.getElementById('lap');
const speedEl = document.getElementById('speed');
const gearEl = document.getElementById('gear');
const timeEl = document.getElementById('time');
const bestLapEl = document.getElementById('bestLap');
const speedArc = document.getElementById('speedArc');
const rpmBar = document.getElementById('rpmBar');
const finalPosition = document.getElementById('finalPosition');
const finalBestLap = document.getElementById('finalBestLap');
const finalTime = document.getElementById('finalTime');

const TOTAL_LAPS = 3;
const MAX_SPEED = 340;
const ACCELERATION = 0.4;
const BRAKING = 0.8;
const FRICTION = 0.15;
const TURN_SPEED = 0.045;
const MAX_RPM = 15000;

let gameState = 'menu';
let selectedTeamColor = '#e10600';
let selectedTeamName = 'Ferrari';

let player = null;
let aiCars = [];
let trackPoints = [];
let trackWidth = 80;

let keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

let raceTime = 0;
let lapTimes = [];
let bestLap = Infinity;
let lastLapTime = 0;
let lastFrameTime = 0;
let lastDisplayedTime = '';
let lastDisplayedBest = '';

const aiTeams = [
    { color: '#00d2be', name: 'Mercedes' },
    { color: '#3671c6', name: 'Red Bull' },
    { color: '#ff8000', name: 'McLaren' },
    { color: '#27f4d2', name: 'Aston Martin' }
];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    minimapCanvas.width = minimapCanvas.offsetWidth * 2;
    minimapCanvas.height = minimapCanvas.offsetHeight * 2;
}

function generateTrack() {
    trackPoints = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadiusX = Math.min(canvas.width * 0.38, 450);
    const baseRadiusY = Math.min(canvas.height * 0.35, 300);
    
    const numPoints = 100;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        
        let radiusX = baseRadiusX;
        let radiusY = baseRadiusY;
        
        radiusX += Math.sin(angle * 3) * baseRadiusX * 0.15;
        radiusY += Math.cos(angle * 2) * baseRadiusY * 0.12;
        radiusX += Math.sin(angle * 5) * baseRadiusX * 0.08;
        
        const x = centerX + Math.cos(angle) * radiusX;
        const y = centerY + Math.sin(angle) * radiusY;
        
        trackPoints.push({ x, y });
    }
    
    trackWidth = Math.max(60, Math.min(canvas.width, canvas.height) * 0.08);
}

function getTrackAngle(index) {
    if (trackPoints.length === 0) return 0;
    const safeIndex = ((index % trackPoints.length) + trackPoints.length) % trackPoints.length;
    const p1 = trackPoints[safeIndex];
    const p2 = trackPoints[(safeIndex + 1) % trackPoints.length];
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function getTrackPosition(progress) {
    if (trackPoints.length === 0) {
        return { x: canvas.width / 2, y: canvas.height / 2, index: 0 };
    }
    
    const totalPoints = trackPoints.length;
    let normalizedProgress = progress;
    while (normalizedProgress < 0) normalizedProgress += 1;
    normalizedProgress = normalizedProgress % 1;
    
    const exactIndex = normalizedProgress * totalPoints;
    const index = Math.floor(exactIndex);
    const t = exactIndex - index;
    
    const safeIndex = (i) => trackPoints[((i % totalPoints) + totalPoints) % totalPoints];
    
    const p0 = safeIndex(index - 1);
    const p1 = safeIndex(index);
    const p2 = safeIndex(index + 1);
    const p3 = safeIndex(index + 2);
    
    const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
    const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
    
    return { x, y, index: ((index % totalPoints) + totalPoints) % totalPoints };
}

function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function createCar(color, name, progress, isPlayer = false) {
    const pos = getTrackPosition(progress);
    const angle = getTrackAngle(Math.floor(progress * trackPoints.length));
    
    return {
        x: pos.x,
        y: pos.y,
        angle: angle,
        speed: 0,
        progress: progress,
        lap: 0,
        color: color,
        name: name,
        isPlayer: isPlayer,
        trackIndex: pos.index,
        targetSpeed: isPlayer ? 0 : 180 + Math.random() * 60,
        skillFactor: 0.85 + Math.random() * 0.15,
        lastCheckpoint: 0,
        finished: false
    };
}

function initRace() {
    generateTrack();
    
    player = createCar(selectedTeamColor, selectedTeamName, 0, true);
    
    aiCars = [];
    const shuffledTeams = [...aiTeams].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < 4; i++) {
        const startProgress = -0.02 * (i + 1);
        aiCars.push(createCar(shuffledTeams[i].color, shuffledTeams[i].name, startProgress, false));
    }
    
    raceTime = 0;
    lapTimes = [];
    bestLap = Infinity;
    lastLapTime = 0;
    lastDisplayedTime = '';
    lastDisplayedBest = '';
}

function startCountdown() {
    gameState = 'countdown';
    startScreen.classList.add('hidden');
    countdownOverlay.classList.remove('hidden');
    
    const lights = document.querySelectorAll('.countdown-light');
    let count = 3;
    
    function updateCountdown() {
        if (count > 0) {
            lights[3 - count].classList.add('active');
            countdownText.textContent = count;
            count--;
            setTimeout(updateCountdown, 1000);
        } else {
            lights.forEach(l => {
                l.classList.remove('active');
                l.classList.add('go');
            });
            countdownText.textContent = 'GO!';
            setTimeout(() => {
                countdownOverlay.classList.add('hidden');
                lights.forEach(l => l.classList.remove('go'));
                gameState = 'racing';
                lastFrameTime = performance.now();
            }, 500);
        }
    }
    
    updateCountdown();
}

function updatePlayer(deltaTime) {
    if (player.finished) return;
    
    const dt = deltaTime / 16.67;
    
    if (keys.up) {
        player.speed += ACCELERATION * dt;
    }
    if (keys.down) {
        player.speed -= BRAKING * dt;
    }
    
    if (!keys.up && !keys.down) {
        player.speed -= FRICTION * dt * Math.sign(player.speed);
        if (Math.abs(player.speed) < 0.5) player.speed = 0;
    }
    
    player.speed = Math.max(-50, Math.min(MAX_SPEED, player.speed));
    
    const turnMultiplier = Math.min(1, player.speed / 100);
    if (keys.left) {
        player.angle -= TURN_SPEED * turnMultiplier * dt;
    }
    if (keys.right) {
        player.angle += TURN_SPEED * turnMultiplier * dt;
    }
    
    const moveSpeed = player.speed * 0.5 * dt;
    player.x += Math.cos(player.angle) * moveSpeed;
    player.y += Math.sin(player.angle) * moveSpeed;
    
    keepOnTrack(player);
    updateCarProgress(player);
}

function updateAICar(car, deltaTime) {
    if (car.finished) return;
    
    const dt = deltaTime / 16.67;
    
    const lookAhead = 0.03;
    const targetProgress = (car.progress + lookAhead) % 1;
    const targetPos = getTrackPosition(targetProgress < 0 ? targetProgress + 1 : targetProgress);
    
    const targetAngle = Math.atan2(targetPos.y - car.y, targetPos.x - car.x);
    let angleDiff = targetAngle - car.angle;
    
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    car.angle += angleDiff * 0.08 * car.skillFactor * dt;
    
    const cornerFactor = 1 - Math.abs(angleDiff) * 0.5;
    const targetSpeed = car.targetSpeed * cornerFactor * car.skillFactor;
    
    if (car.speed < targetSpeed) {
        car.speed += 0.3 * dt;
    } else {
        car.speed -= 0.2 * dt;
    }
    
    car.speed = Math.max(0, Math.min(MAX_SPEED * 0.85, car.speed));
    
    const moveSpeed = car.speed * 0.5 * dt;
    car.x += Math.cos(car.angle) * moveSpeed;
    car.y += Math.sin(car.angle) * moveSpeed;
    
    keepOnTrack(car);
    updateCarProgress(car);
}

function keepOnTrack(car) {
    if (trackPoints.length === 0) return;
    
    let minDist = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < trackPoints.length; i++) {
        const dx = car.x - trackPoints[i].x;
        const dy = car.y - trackPoints[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }
    
    if (minDist > trackWidth * 0.9) {
        const point = trackPoints[closestIndex];
        const pushBack = (minDist - trackWidth * 0.9) * 0.3;
        const angle = Math.atan2(car.y - point.y, car.x - point.x);
        car.x -= Math.cos(angle) * pushBack;
        car.y -= Math.sin(angle) * pushBack;
        car.speed *= 0.85;
    }
    
    car.trackIndex = closestIndex;
}

function updateCarProgress(car) {
    if (trackPoints.length === 0) return;
    
    let minDist = Infinity;
    let closestIndex = 0;
    
    const searchStart = Math.max(0, car.trackIndex - 10);
    const searchEnd = Math.min(trackPoints.length, car.trackIndex + 20);
    
    for (let i = searchStart; i < searchEnd; i++) {
        const idx = ((i % trackPoints.length) + trackPoints.length) % trackPoints.length;
        const dx = car.x - trackPoints[idx].x;
        const dy = car.y - trackPoints[idx].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            closestIndex = idx;
        }
    }
    
    const newProgress = closestIndex / trackPoints.length;
    let oldProgress = car.progress % 1;
    if (oldProgress < 0) oldProgress += 1;
    
    if (gameState === 'racing') {
        if (oldProgress > 0.9 && newProgress < 0.1) {
            car.lap++;
            if (car.isPlayer && car.lap > 0 && car.lap <= TOTAL_LAPS) {
                const lapTime = raceTime - lastLapTime;
                lapTimes.push(lapTime);
                if (lapTime < bestLap) {
                    bestLap = lapTime;
                }
                lastLapTime = raceTime;
            }
            if (car.lap >= TOTAL_LAPS) {
                car.finished = true;
            }
        } else if (oldProgress < 0.1 && newProgress > 0.9) {
            car.lap = Math.max(0, car.lap - 1);
        }
    }
    
    car.progress = car.lap + newProgress;
}

function getPositions() {
    const allCars = [player, ...aiCars];
    return allCars.sort((a, b) => b.progress - a.progress);
}

function drawTrack() {
    if (trackPoints.length === 0) return;
    
    ctx.strokeStyle = '#2d2d35';
    ctx.lineWidth = trackWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
    for (let i = 1; i <= trackPoints.length; i++) {
        const point = trackPoints[i % trackPoints.length];
        ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.stroke();
    
    ctx.strokeStyle = '#3a3a42';
    ctx.lineWidth = trackWidth - 6;
    ctx.stroke();
    
    ctx.setLineDash([20, 20]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    
    const startIndex = 0;
    const startPoint = trackPoints[startIndex];
    const nextPoint = trackPoints[(startIndex + 1) % trackPoints.length];
    const startAngle = Math.atan2(nextPoint.y - startPoint.y, nextPoint.x - startPoint.x);
    
    const perpAngle = startAngle + Math.PI / 2;
    const lineLength = trackWidth * 0.8;
    
    ctx.save();
    ctx.translate(startPoint.x, startPoint.y);
    ctx.rotate(perpAngle);
    
    const squareSize = 8;
    const numSquares = Math.floor(lineLength / squareSize);
    
    for (let i = -numSquares; i <= numSquares; i++) {
        for (let j = 0; j < 3; j++) {
            const isWhite = (i + j) % 2 === 0;
            ctx.fillStyle = isWhite ? '#fff' : '#000';
            ctx.fillRect(i * squareSize - squareSize / 2, j * squareSize - squareSize, squareSize, squareSize);
        }
    }
    
    ctx.restore();
}

function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    
    const carLength = 28;
    const carWidth = 12;
    
    ctx.fillStyle = '#111';
    ctx.fillRect(-carLength / 2 - 4, -carWidth / 2 - 3, 8, 3);
    ctx.fillRect(-carLength / 2 - 4, carWidth / 2, 8, 3);
    ctx.fillRect(carLength / 2 - 4, -carWidth / 2 - 5, 8, 5);
    ctx.fillRect(carLength / 2 - 4, carWidth / 2, 8, 5);
    
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.moveTo(carLength / 2 + 4, 0);
    ctx.lineTo(carLength / 2 - 8, -carWidth / 2);
    ctx.lineTo(-carLength / 2, -carWidth / 2 + 2);
    ctx.lineTo(-carLength / 2 - 2, 0);
    ctx.lineTo(-carLength / 2, carWidth / 2 - 2);
    ctx.lineTo(carLength / 2 - 8, carWidth / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(2, -carWidth / 2 + 2, 8, carWidth - 4);
    
    ctx.fillStyle = '#222';
    ctx.fillRect(-carLength / 2, -carWidth / 2 + 3, 6, carWidth - 6);
    
    if (car.isPlayer) {
        ctx.shadowColor = car.color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = car.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    ctx.restore();
}

function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    if (trackPoints.length === 0 || !player) return;
    
    const padding = 15;
    const scale = Math.min(
        (minimapCanvas.width - padding * 2) / canvas.width,
        (minimapCanvas.height - padding * 2) / canvas.height
    ) * 0.9;
    
    const offsetX = minimapCanvas.width / 2 - canvas.width * scale / 2;
    const offsetY = minimapCanvas.height / 2 - canvas.height * scale / 2;
    
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    minimapCtx.lineWidth = 4;
    minimapCtx.lineCap = 'round';
    minimapCtx.lineJoin = 'round';
    
    minimapCtx.beginPath();
    for (let i = 0; i <= trackPoints.length; i++) {
        const point = trackPoints[i % trackPoints.length];
        const x = offsetX + point.x * scale;
        const y = offsetY + point.y * scale;
        if (i === 0) {
            minimapCtx.moveTo(x, y);
        } else {
            minimapCtx.lineTo(x, y);
        }
    }
    minimapCtx.closePath();
    minimapCtx.stroke();
    
    aiCars.forEach(car => {
        minimapCtx.fillStyle = car.color;
        minimapCtx.beginPath();
        minimapCtx.arc(
            offsetX + car.x * scale,
            offsetY + car.y * scale,
            4,
            0,
            Math.PI * 2
        );
        minimapCtx.fill();
    });
    
    minimapCtx.fillStyle = player.color;
    minimapCtx.shadowColor = player.color;
    minimapCtx.shadowBlur = 8;
    minimapCtx.beginPath();
    minimapCtx.arc(
        offsetX + player.x * scale,
        offsetY + player.y * scale,
        5,
        0,
        Math.PI * 2
    );
    minimapCtx.fill();
    minimapCtx.shadowBlur = 0;
}

function updateHUD() {
    if (!player) return;
    
    const positions = getPositions();
    const playerPos = positions.findIndex(c => c.isPlayer) + 1;
    
    positionEl.textContent = playerPos;
    lapEl.textContent = Math.max(0, Math.min(TOTAL_LAPS, player.lap));
    
    const displaySpeed = Math.round(Math.abs(player.speed));
    speedEl.textContent = displaySpeed;
    
    const gear = Math.max(1, Math.min(8, Math.ceil(player.speed / (MAX_SPEED / 8))));
    gearEl.textContent = player.speed < 0 ? 'R' : gear;
    
    const speedPercent = displaySpeed / MAX_SPEED;
    const circumference = 339.292;
    speedArc.style.strokeDashoffset = circumference * (1 - speedPercent);
    
    const rpm = (Math.abs(player.speed) / MAX_SPEED) * MAX_RPM;
    const rpmPercent = Math.min(100, (rpm / MAX_RPM) * 100);
    rpmBar.style.width = rpmPercent + '%';
    
    const currentTime = formatTime(raceTime);
    if (currentTime !== lastDisplayedTime) {
        timeEl.textContent = currentTime;
        lastDisplayedTime = currentTime;
    }
    
    const currentBest = bestLap < Infinity ? formatTime(bestLap) : '--:--.--';
    if (currentBest !== lastDisplayedBest) {
        bestLapEl.textContent = currentBest;
        lastDisplayedBest = currentBest;
    }
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

function checkRaceFinish() {
    if (player.finished && gameState === 'racing') {
        const positions = getPositions();
        const playerPos = positions.findIndex(c => c.isPlayer) + 1;
        
        finishScreen.classList.remove('hidden');
        
        const positionSuffix = playerPos === 1 ? 'º' : 'º';
        finalPosition.textContent = playerPos + positionSuffix;
        finalBestLap.textContent = bestLap < Infinity ? formatTime(bestLap) : '--:--.--';
        finalTime.textContent = formatTime(raceTime);
        
        if (playerPos === 1) {
            document.getElementById('finishTitle').textContent = 'VITÓRIA!';
        } else if (playerPos <= 3) {
            document.getElementById('finishTitle').textContent = 'PÓDIO!';
        } else {
            document.getElementById('finishTitle').textContent = 'CORRIDA FINALIZADA';
        }
        
        gameState = 'finished';
    }
}

function gameLoop(currentTime) {
    const deltaTime = Math.min(currentTime - lastFrameTime, 100);
    lastFrameTime = currentTime;
    
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--grass-color') || '#0d1a0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawTrack();
    
    if (gameState === 'racing' && player) {
        raceTime += deltaTime;
        
        updatePlayer(deltaTime);
        aiCars.forEach(car => updateAICar(car, deltaTime));
        
        checkRaceFinish();
    }
    
    if (player) {
        const allCars = [player, ...aiCars].sort((a, b) => a.y - b.y);
        allCars.forEach(car => drawCar(car));
    }
    
    drawMinimap();
    updateHUD();
    
    requestAnimationFrame(gameLoop);
}

function handleKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        e.preventDefault();
    }
    
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
}

function handleKeyUp(e) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
}

let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
    if (gameState !== 'racing') return;
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    keys.up = true;
}

function handleTouchMove(e) {
    if (gameState !== 'racing') return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    
    keys.left = deltaX < -30;
    keys.right = deltaX > 30;
}

function handleTouchEnd() {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
}

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTeamColor = btn.dataset.color;
        selectedTeamName = btn.dataset.name;
    });
});

startBtn.addEventListener('click', () => {
    initRace();
    startCountdown();
});

restartBtn.addEventListener('click', () => {
    finishScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameState = 'menu';
    raceTime = 0;
    lapTimes = [];
    bestLap = Infinity;
    lastLapTime = 0;
    lastDisplayedTime = '';
    lastDisplayedBest = '';
});

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd);

window.addEventListener('resize', () => {
    resizeCanvas();
    if (trackPoints.length > 0) {
        generateTrack();
    }
});

finishScreen.classList.add('hidden');
countdownOverlay.classList.add('hidden');

resizeCanvas();
generateTrack();
player = createCar(selectedTeamColor, selectedTeamName, 0, true);
aiCars = [];
for (let i = 0; i < 4; i++) {
    const startProgress = -0.02 * (i + 1);
    aiCars.push(createCar(aiTeams[i].color, aiTeams[i].name, startProgress, false));
}

lastFrameTime = performance.now();
requestAnimationFrame(gameLoop);
