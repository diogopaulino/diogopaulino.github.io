const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');

const CONFIG = {
    TOTAL_LAPS: 3,
    MAX_SPEED: 340,
    ACCELERATION: 0.65,
    BRAKE_FORCE: 1.3,
    FRICTION: 0.12,
    TURN_RATE: 0.06,
    SPEED_TURN_FACTOR: 0.35,
    WALL_BOUNCE: 0.6,
    AI_COUNT: 4,
    GEAR_SPEEDS: [0, 50, 95, 145, 195, 245, 295, 320, 340],
    RPM_MIN: 5000,
    RPM_MAX: 15000
};

let gameState = 'menu';
let playerCar = null;
let aiCars = [];
let track = null;
let currentLap = 0;
let raceTime = 0;
let bestLapTime = null;
let lapStartTime = 0;
let lastFrameTime = 0;
let selectedTeamColor = '#e10600';

const keys = { up: false, down: false, left: false, right: false };
const AI_COLORS = ['#00d2be', '#3671c6', '#ff8000', '#0090ff', '#b6babd'];

class Track {
    constructor() {
        this.points = [];
        this.width = 95;
        this.innerPoints = [];
        this.outerPoints = [];
        this.generateTrack();
    }

    generateTrack() {
        const padding = 70;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxRadiusX = (canvas.width / 2) - padding - this.width / 2;
        const maxRadiusY = (canvas.height / 2) - padding - this.width / 2;
        const segments = 100;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const noiseX = Math.sin(angle * 2) * 0.18 + Math.cos(angle * 3) * 0.1;
            const noiseY = Math.cos(angle * 2) * 0.18 + Math.sin(angle * 4) * 0.08;
            
            const radiusX = maxRadiusX * (0.78 + noiseX * 0.22);
            const radiusY = maxRadiusY * (0.78 + noiseY * 0.22);
            
            this.points.push({
                x: cx + Math.cos(angle) * radiusX,
                y: cy + Math.sin(angle) * radiusY
            });
        }

        this.smoothTrack(2);
        this.calculateBoundaries();
        
        this.startLine = {
            x: this.points[0].x,
            y: this.points[0].y,
            angle: Math.atan2(
                this.points[1].y - this.points[segments - 1].y,
                this.points[1].x - this.points[segments - 1].x
            )
        };

        this.totalLength = this.calculateTotalLength();
    }

    smoothTrack(iterations) {
        for (let iter = 0; iter < iterations; iter++) {
            const newPoints = [];
            for (let i = 0; i < this.points.length; i++) {
                const prev = this.points[(i - 1 + this.points.length) % this.points.length];
                const curr = this.points[i];
                const next = this.points[(i + 1) % this.points.length];
                newPoints.push({
                    x: curr.x * 0.5 + (prev.x + next.x) * 0.25,
                    y: curr.y * 0.5 + (prev.y + next.y) * 0.25
                });
            }
            this.points = newPoints;
        }
    }

    calculateBoundaries() {
        this.innerPoints = [];
        this.outerPoints = [];
        const halfWidth = this.width / 2 - 5;

        for (let i = 0; i < this.points.length; i++) {
            const prev = this.points[(i - 1 + this.points.length) % this.points.length];
            const next = this.points[(i + 1) % this.points.length];
            const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
            const perpAngle = angle + Math.PI / 2;

            this.innerPoints.push({
                x: this.points[i].x + Math.cos(perpAngle) * halfWidth,
                y: this.points[i].y + Math.sin(perpAngle) * halfWidth
            });
            this.outerPoints.push({
                x: this.points[i].x - Math.cos(perpAngle) * halfWidth,
                y: this.points[i].y - Math.sin(perpAngle) * halfWidth
            });
        }
    }

    calculateTotalLength() {
        let total = 0;
        for (let i = 0; i < this.points.length; i++) {
            const next = (i + 1) % this.points.length;
            total += Math.hypot(this.points[next].x - this.points[i].x, this.points[next].y - this.points[i].y);
        }
        return total;
    }

    getPointAtDistance(distance) {
        distance = ((distance % this.totalLength) + this.totalLength) % this.totalLength;
        let accumulated = 0;
        
        for (let i = 0; i < this.points.length; i++) {
            const next = (i + 1) % this.points.length;
            const segLen = Math.hypot(this.points[next].x - this.points[i].x, this.points[next].y - this.points[i].y);
            
            if (accumulated + segLen >= distance) {
                const t = (distance - accumulated) / segLen;
                return {
                    x: this.points[i].x + (this.points[next].x - this.points[i].x) * t,
                    y: this.points[i].y + (this.points[next].y - this.points[i].y) * t,
                    angle: Math.atan2(this.points[next].y - this.points[i].y, this.points[next].x - this.points[i].x)
                };
            }
            accumulated += segLen;
        }
        return { ...this.points[0], angle: 0 };
    }

    getClosestTrackPoint(x, y) {
        let minDist = Infinity;
        let closestPoint = { x: this.points[0].x, y: this.points[0].y };
        let closestIndex = 0;
        
        for (let i = 0; i < this.points.length; i++) {
            const next = (i + 1) % this.points.length;
            const result = this.closestPointOnSegment(x, y, this.points[i], this.points[next]);
            if (result.dist < minDist) {
                minDist = result.dist;
                closestPoint = result.point;
                closestIndex = i;
            }
        }
        
        const prev = this.points[(closestIndex - 1 + this.points.length) % this.points.length];
        const next = this.points[(closestIndex + 1) % this.points.length];
        const trackAngle = Math.atan2(next.y - prev.y, next.x - prev.x);
        
        return { point: closestPoint, dist: minDist, angle: trackAngle };
    }

    closestPointOnSegment(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        
        if (lenSq === 0) return { point: { x: p1.x, y: p1.y }, dist: Math.hypot(px - p1.x, py - p1.y) };
        
        const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        
        return { 
            point: { x: closestX, y: closestY }, 
            dist: Math.hypot(px - closestX, py - closestY) 
        };
    }

    constrainToTrack(x, y) {
        const closest = this.getClosestTrackPoint(x, y);
        const halfWidth = this.width / 2 - 8;
        
        if (closest.dist > halfWidth) {
            const dx = x - closest.point.x;
            const dy = y - closest.point.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 0) {
                const pushX = closest.point.x + (dx / dist) * halfWidth;
                const pushY = closest.point.y + (dy / dist) * halfWidth;
                return { x: pushX, y: pushY, hit: true, angle: closest.angle };
            }
        }
        return { x, y, hit: false, angle: closest.angle };
    }

    isOnTrack(x, y) {
        const closest = this.getClosestTrackPoint(x, y);
        return closest.dist < this.width / 2;
    }

    getProgressAtPoint(x, y) {
        let minDist = Infinity;
        let closestIndex = 0;
        
        for (let i = 0; i < this.points.length; i++) {
            const dist = Math.hypot(x - this.points[i].x, y - this.points[i].y);
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }
        return closestIndex / this.points.length;
    }

    draw(ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = '#0a0a0d';
        ctx.lineWidth = this.width + 20;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.stroke();

        this.drawKerbs(ctx);

        ctx.strokeStyle = '#2a2a32';
        ctx.lineWidth = this.width;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 18]);
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        this.drawStartLine(ctx);
    }

    drawKerbs(ctx) {
        const kerbWidth = 10;
        
        for (let i = 0; i < this.innerPoints.length; i++) {
            const next = (i + 1) % this.innerPoints.length;
            const isRed = Math.floor(i / 2) % 2 === 0;
            ctx.fillStyle = isRed ? '#e10600' : '#ffffff';
            
            const angle = Math.atan2(this.innerPoints[next].y - this.innerPoints[i].y, this.innerPoints[next].x - this.innerPoints[i].x);
            const perpAngle = angle + Math.PI / 2;
            
            ctx.beginPath();
            ctx.moveTo(this.innerPoints[i].x, this.innerPoints[i].y);
            ctx.lineTo(this.innerPoints[next].x, this.innerPoints[next].y);
            ctx.lineTo(this.innerPoints[next].x + Math.cos(perpAngle) * kerbWidth, this.innerPoints[next].y + Math.sin(perpAngle) * kerbWidth);
            ctx.lineTo(this.innerPoints[i].x + Math.cos(perpAngle) * kerbWidth, this.innerPoints[i].y + Math.sin(perpAngle) * kerbWidth);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.outerPoints[i].x, this.outerPoints[i].y);
            ctx.lineTo(this.outerPoints[next].x, this.outerPoints[next].y);
            ctx.lineTo(this.outerPoints[next].x - Math.cos(perpAngle) * kerbWidth, this.outerPoints[next].y - Math.sin(perpAngle) * kerbWidth);
            ctx.lineTo(this.outerPoints[i].x - Math.cos(perpAngle) * kerbWidth, this.outerPoints[i].y - Math.sin(perpAngle) * kerbWidth);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawStartLine(ctx) {
        const start = this.startLine;
        const perpAngle = start.angle + Math.PI / 2;
        const halfWidth = this.width / 2;
        const squareSize = 7;
        
        const x1 = start.x + Math.cos(perpAngle) * halfWidth;
        const y1 = start.y + Math.sin(perpAngle) * halfWidth;
        const x2 = start.x - Math.cos(perpAngle) * halfWidth;
        const y2 = start.y - Math.sin(perpAngle) * halfWidth;
        
        const lineLength = Math.hypot(x2 - x1, y2 - y1);
        const numSquares = Math.floor(lineLength / squareSize);
        
        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < numSquares; i++) {
                const t = i / numSquares;
                const px = x1 + (x2 - x1) * t + Math.cos(start.angle) * row * squareSize;
                const py = y1 + (y2 - y1) * t + Math.sin(start.angle) * row * squareSize;
                
                ctx.fillStyle = (i + row) % 2 === 0 ? '#ffffff' : '#000000';
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(perpAngle);
                ctx.fillRect(-squareSize / 2, -squareSize / 2, squareSize, squareSize);
                ctx.restore();
            }
        }
    }

    drawMinimap(ctx, width, height) {
        const scale = Math.min(width, height) / (Math.max(canvas.width, canvas.height) * 1.05);
        const offsetX = (width - canvas.width * scale) / 2;
        const offsetY = (height - canvas.height * scale) / 2;
        
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#3a3a42';
        ctx.lineWidth = 5 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.points[0].x * scale + offsetX, this.points[0].y * scale + offsetY);
        for (const point of this.points) ctx.lineTo(point.x * scale + offsetX, point.y * scale + offsetY);
        ctx.closePath();
        ctx.stroke();
        
        return { scale, offsetX, offsetY };
    }
}

class Car {
    constructor(x, y, angle, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 0;
        this.color = color;
        this.isPlayer = isPlayer;
        this.width = 16;
        this.height = 34;
        
        this.gear = 1;
        this.rpm = CONFIG.RPM_MIN;
        
        this.trackProgress = 0;
        this.totalProgress = 0;
        this.lastCheckpoint = 0;
        this.lap = 0;
        this.finished = false;
        
        this.aiAggression = 0.85 + Math.random() * 0.15;
        this.aiLineOffset = (Math.random() - 0.5) * 15;
    }

    update(dt, track) {
        if (this.finished) return;
        
        if (this.isPlayer) {
            this.handleInput(dt);
        } else {
            this.updateAI(dt, track);
        }

        this.move(dt);
        
        const constrained = track.constrainToTrack(this.x, this.y);
        if (constrained.hit) {
            this.x = constrained.x;
            this.y = constrained.y;
            this.speed *= CONFIG.WALL_BOUNCE;
            
            const wallNormal = Math.atan2(this.y - constrained.y, this.x - constrained.x);
            let angleDiff = this.angle - constrained.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (Math.abs(angleDiff) > Math.PI / 4) {
                this.angle = constrained.angle + Math.sign(angleDiff) * Math.PI / 6;
            }
        }
        
        this.updateGear();
        this.updateProgress(track);
    }

    handleInput(dt) {
        if (keys.up) {
            this.speed += CONFIG.ACCELERATION * dt;
        }
        if (keys.down) {
            this.speed -= CONFIG.BRAKE_FORCE * dt;
        }
        
        this.speed -= CONFIG.FRICTION * dt * this.speed * 0.008;
        this.speed = Math.max(0, Math.min(CONFIG.MAX_SPEED, this.speed));
        
        const turnAmount = CONFIG.TURN_RATE * dt * (1 - this.speed / CONFIG.MAX_SPEED * CONFIG.SPEED_TURN_FACTOR);
        
        if (keys.left) this.angle -= turnAmount;
        if (keys.right) this.angle += turnAmount;
    }

    updateAI(dt, track) {
        const lookAhead = 50 + this.speed * 1.0;
        const currentProgress = track.getProgressAtPoint(this.x, this.y);
        const targetDist = currentProgress * track.totalLength + lookAhead;
        const targetPoint = track.getPointAtDistance(targetDist);
        
        const offsetAngle = targetPoint.angle + Math.PI / 2;
        const targetX = targetPoint.x + Math.cos(offsetAngle) * this.aiLineOffset;
        const targetY = targetPoint.y + Math.sin(offsetAngle) * this.aiLineOffset;
        
        const targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const turnAmount = CONFIG.TURN_RATE * dt * (1 - this.speed / CONFIG.MAX_SPEED * CONFIG.SPEED_TURN_FACTOR);
        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnAmount * 1.2) * this.aiAggression;
        
        const cornerFactor = 1 - Math.abs(angleDiff) * 0.7;
        const targetSpeed = CONFIG.MAX_SPEED * cornerFactor * this.aiAggression;
        
        if (this.speed < targetSpeed) {
            this.speed += CONFIG.ACCELERATION * dt * this.aiAggression;
        } else {
            this.speed -= CONFIG.BRAKE_FORCE * dt * 0.6;
        }
        
        this.speed -= CONFIG.FRICTION * dt * this.speed * 0.008;
        this.speed = Math.max(0, Math.min(CONFIG.MAX_SPEED, this.speed));
        
        for (const car of [playerCar, ...aiCars]) {
            if (car === this || !car) continue;
            const dist = Math.hypot(car.x - this.x, car.y - this.y);
            if (dist < 35 && dist > 0) {
                const avoidAngle = Math.atan2(car.y - this.y, car.x - this.x);
                let avoidDiff = avoidAngle - this.angle;
                while (avoidDiff > Math.PI) avoidDiff -= Math.PI * 2;
                while (avoidDiff < -Math.PI) avoidDiff += Math.PI * 2;
                if (Math.abs(avoidDiff) < Math.PI / 2) {
                    this.angle -= Math.sign(avoidDiff) * 0.04 * dt;
                }
            }
        }
    }

    move(dt) {
        const moveSpeed = this.speed * 0.14 * dt;
        this.x += Math.cos(this.angle) * moveSpeed;
        this.y += Math.sin(this.angle) * moveSpeed;
    }

    updateGear() {
        const speeds = CONFIG.GEAR_SPEEDS;
        let newGear = 1;
        for (let i = speeds.length - 1; i >= 0; i--) {
            if (this.speed >= speeds[i]) {
                newGear = Math.min(i + 1, 8);
                break;
            }
        }
        this.gear = newGear;
        
        const gearMin = speeds[this.gear - 1] || 0;
        const gearMax = speeds[this.gear] || CONFIG.MAX_SPEED;
        const gearProgress = (this.speed - gearMin) / (gearMax - gearMin);
        this.rpm = CONFIG.RPM_MIN + (CONFIG.RPM_MAX - CONFIG.RPM_MIN) * Math.min(1, Math.max(0, gearProgress));
    }

    updateProgress(track) {
        const newProgress = track.getProgressAtPoint(this.x, this.y);
        
        if (this.lastCheckpoint > 0.9 && newProgress < 0.1) {
            this.lap++;
            if (this.isPlayer) {
                currentLap = this.lap;
                if (this.lap > 0) {
                    const lapTime = raceTime - lapStartTime;
                    if (!bestLapTime || lapTime < bestLapTime) {
                        bestLapTime = lapTime;
                        document.getElementById('bestLap').textContent = formatTime(bestLapTime);
                    }
                }
                lapStartTime = raceTime;
                if (this.lap >= CONFIG.TOTAL_LAPS) {
                    this.finished = true;
                    finishRace();
                }
            } else if (this.lap >= CONFIG.TOTAL_LAPS) {
                this.finished = true;
            }
        } else if (this.lastCheckpoint < 0.1 && newProgress > 0.9) {
            this.lap = Math.max(0, this.lap - 1);
            if (this.isPlayer) currentLap = this.lap;
        }
        
        this.lastCheckpoint = newProgress;
        this.trackProgress = newProgress;
        this.totalProgress = this.lap + newProgress;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(-this.width / 2 - 1, this.height * 0.26, 3, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(this.width / 2 + 1, this.height * 0.26, 3, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(-this.width / 2 - 1, -this.height * 0.28, 4, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(this.width / 2 + 1, -this.height * 0.28, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(-this.width / 2 + 1, this.height / 4);
        ctx.quadraticCurveTo(-this.width / 3, this.height / 2, 0, this.height / 2);
        ctx.quadraticCurveTo(this.width / 3, this.height / 2, this.width / 2 - 1, this.height / 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, -this.height * 0.04, this.width * 0.22, this.height * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const wingWidth = this.width * 0.8;
        ctx.fillStyle = this.color;
        ctx.fillRect(-wingWidth / 2, -this.height / 2 - 3, wingWidth, 4);
        ctx.fillRect(-wingWidth / 2, this.height / 2 - 1, wingWidth, 3);
        
        ctx.restore();
    }

    drawOnMinimap(ctx, scale, offsetX, offsetY) {
        const mx = this.x * scale + offsetX;
        const my = this.y * scale + offsetY;
        
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(this.angle + Math.PI / 2);
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(-2, 2);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();
        
        if (this.isPlayer) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    
    const mmRect = minimapCanvas.parentElement.getBoundingClientRect();
    minimapCanvas.width = mmRect.width * dpr;
    minimapCanvas.height = mmRect.height * dpr;
    minimapCanvas.style.width = mmRect.width + 'px';
    minimapCanvas.style.height = mmRect.height + 'px';
    minimapCtx.scale(dpr, dpr);
    
    canvas.displayWidth = rect.width;
    canvas.displayHeight = rect.height;
    minimapCanvas.displayWidth = mmRect.width;
    minimapCanvas.displayHeight = mmRect.height;
    
    if (gameState === 'menu') {
        track = new Track();
        drawMenuBackground();
    }
}

function drawMenuBackground() {
    const w = canvas.displayWidth || canvas.width;
    const h = canvas.displayHeight || canvas.height;
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(0, 0, w, h);
    if (track) {
        track.draw(ctx);
        track.drawMinimap(minimapCtx, minimapCanvas.displayWidth || minimapCanvas.width, minimapCanvas.displayHeight || minimapCanvas.height);
    }
}

function initGame() {
    track = new Track();
    
    const startPos = track.getPointAtDistance(0);
    const perpAngle = startPos.angle + Math.PI / 2;
    
    playerCar = new Car(
        startPos.x + Math.cos(perpAngle) * 15,
        startPos.y + Math.sin(perpAngle) * 15,
        startPos.angle,
        selectedTeamColor,
        true
    );
    
    aiCars = [];
    const availableColors = AI_COLORS.filter(c => c !== selectedTeamColor);
    
    for (let i = 0; i < CONFIG.AI_COUNT; i++) {
        const offset = -(i + 1) * 40;
        const rowOffset = i % 2 === 0 ? -18 : 18;
        const pos = track.getPointAtDistance(track.totalLength + offset);
        const perpAngle = pos.angle + Math.PI / 2;
        
        aiCars.push(new Car(
            pos.x + Math.cos(perpAngle) * rowOffset,
            pos.y + Math.sin(perpAngle) * rowOffset,
            pos.angle,
            availableColors[i % availableColors.length],
            false
        ));
    }
    
    currentLap = 0;
    raceTime = 0;
    bestLapTime = null;
    lapStartTime = 0;
    
    updateHUD();
}

function startCountdown() {
    gameState = 'countdown';
    const overlay = document.getElementById('countdownOverlay');
    const lights = overlay.querySelectorAll('.countdown-light');
    const text = document.getElementById('countdownText');
    
    document.getElementById('startScreen').classList.add('hidden');
    overlay.classList.remove('hidden');
    
    initGame();
    draw();
    
    let count = 0;
    const countInterval = setInterval(() => {
        if (count < 3) {
            lights[count].classList.add('active');
            text.textContent = 3 - count;
            count++;
        } else {
            clearInterval(countInterval);
            lights.forEach(l => { l.classList.remove('active'); l.classList.add('go'); });
            text.textContent = 'GO!';
            
            setTimeout(() => {
                overlay.classList.add('hidden');
                lights.forEach(l => l.classList.remove('go'));
                gameState = 'racing';
                lastFrameTime = performance.now();
                requestAnimationFrame(gameLoop);
            }, 350);
        }
    }, 600);
}

function gameLoop(timestamp) {
    if (gameState !== 'racing') return;
    
    const deltaTime = Math.min(timestamp - lastFrameTime, 32);
    lastFrameTime = timestamp;
    const dt = deltaTime / 16.67;
    
    raceTime += deltaTime;
    
    playerCar.update(dt, track);
    aiCars.forEach(car => car.update(dt, track));
    
    updateHUD();
    draw();
    
    requestAnimationFrame(gameLoop);
}

function draw() {
    const w = canvas.displayWidth || canvas.width;
    const h = canvas.displayHeight || canvas.height;
    
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(0, 0, w, h);
    
    track.draw(ctx);
    
    const allCars = [playerCar, ...aiCars].filter(c => c).sort((a, b) => a.y - b.y);
    allCars.forEach(car => car.draw(ctx));
    
    const mmW = minimapCanvas.displayWidth || minimapCanvas.width;
    const mmH = minimapCanvas.displayHeight || minimapCanvas.height;
    const minimapInfo = track.drawMinimap(minimapCtx, mmW, mmH);
    allCars.forEach(car => car.drawOnMinimap(minimapCtx, minimapInfo.scale, minimapInfo.offsetX, minimapInfo.offsetY));
}

function updateHUD() {
    if (!playerCar) return;
    
    const allCars = [playerCar, ...aiCars].sort((a, b) => b.totalProgress - a.totalProgress);
    const position = allCars.findIndex(c => c === playerCar) + 1;
    
    document.getElementById('position').textContent = position;
    document.getElementById('lap').textContent = Math.min(currentLap + 1, CONFIG.TOTAL_LAPS);
    document.getElementById('speed').textContent = Math.round(playerCar.speed);
    document.getElementById('time').textContent = formatTime(raceTime);
    
    const gearEl = document.getElementById('gear');
    if (gearEl) gearEl.textContent = playerCar.gear;
    
    const rpmEl = document.getElementById('rpmBar');
    if (rpmEl) {
        const rpmPercent = (playerCar.rpm - CONFIG.RPM_MIN) / (CONFIG.RPM_MAX - CONFIG.RPM_MIN);
        rpmEl.style.width = (rpmPercent * 100) + '%';
    }
    
    const speedPercent = playerCar.speed / CONFIG.MAX_SPEED;
    document.getElementById('speedArc').style.strokeDashoffset = 339.292 * (1 - speedPercent);
}

function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((totalSeconds % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function finishRace() {
    gameState = 'finished';
    
    const allCars = [playerCar, ...aiCars].sort((a, b) => b.totalProgress - a.totalProgress);
    const position = allCars.findIndex(c => c === playerCar) + 1;
    
    document.getElementById('finishTitle').textContent = position === 1 ? 'VITÓRIA!' : 'CORRIDA FINALIZADA!';
    document.getElementById('finalPosition').textContent = position + 'º';
    document.getElementById('finalBestLap').textContent = bestLapTime ? formatTime(bestLapTime) : '--:--.--';
    document.getElementById('finalTime').textContent = formatTime(raceTime);
    
    document.getElementById('finishScreen').classList.remove('hidden');
}

function resetGame() {
    document.getElementById('finishScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    gameState = 'menu';
    drawMenuBackground();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { keys.up = true; e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { keys.down = true; e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

let isTouching = false;
let touchStartX = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouching = true;
    touchStartX = e.touches[0].clientX;
    keys.up = true;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    keys.left = deltaX < -15;
    keys.right = deltaX > 15;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouching = false;
    keys.up = false;
    keys.left = false;
    keys.right = false;
}, { passive: false });

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTeamColor = btn.dataset.color;
    });
});

document.getElementById('startBtn').addEventListener('click', startCountdown);
document.getElementById('restartBtn').addEventListener('click', resetGame);

window.addEventListener('resize', resize);
resize();
