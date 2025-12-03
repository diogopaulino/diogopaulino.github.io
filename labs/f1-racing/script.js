const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');

const CONFIG = {
    TOTAL_LAPS: 3,
    MAX_SPEED: 340,
    ENGINE_POWER: 12000,
    BRAKE_POWER: 18000,
    DRAG_COEFFICIENT: 0.4,
    ROLLING_RESISTANCE: 30,
    TIRE_GRIP: 2.8,
    SLIP_THRESHOLD: 1.2,
    STEERING_SENSITIVITY: 0.028,
    STEERING_RETURN_SPEED: 0.06,
    MAX_STEERING_ANGLE: 0.5,
    WEIGHT_TRANSFER: 0.15,
    OFF_TRACK_GRIP_MULT: 0.35,
    OFF_TRACK_SPEED_MULT: 0.5,
    AI_COUNT: 4,
    GEAR_RATIOS: [2.8, 1.9, 1.4, 1.1, 0.9, 0.75, 0.65, 0.58],
    GEAR_SPEEDS: [0, 45, 85, 130, 175, 220, 270, 310, 340],
    RPM_MIN: 4000,
    RPM_MAX: 15000,
    MASS: 800
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
let fixedDeltaTime = 1000 / 60;

const keys = { up: false, down: false, left: false, right: false };
const AI_COLORS = ['#00d2be', '#3671c6', '#ff8000', '#0090ff', '#b6babd'];

class Track {
    constructor() {
        this.points = [];
        this.width = 100;
        this.innerPoints = [];
        this.outerPoints = [];
        this.generateTrack();
    }

    generateTrack() {
        const padding = 60;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxRadiusX = (canvas.width / 2) - padding - this.width / 2;
        const maxRadiusY = (canvas.height / 2) - padding - this.width / 2;
        const segments = 120;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const noiseX = Math.sin(angle * 2) * 0.2 + Math.cos(angle * 3) * 0.15 + Math.sin(angle * 5) * 0.08;
            const noiseY = Math.cos(angle * 2) * 0.2 + Math.sin(angle * 4) * 0.12 + Math.cos(angle * 6) * 0.06;
            
            const radiusX = maxRadiusX * (0.7 + noiseX * 0.3);
            const radiusY = maxRadiusY * (0.7 + noiseY * 0.3);
            
            this.points.push({
                x: cx + Math.cos(angle) * radiusX,
                y: cy + Math.sin(angle) * radiusY
            });
        }

        this.smoothTrack(3);
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
        const halfWidth = this.width / 2;

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
            total += this.getDistance(this.points[i], this.points[next]);
        }
        return total;
    }

    getPointAtDistance(distance) {
        distance = ((distance % this.totalLength) + this.totalLength) % this.totalLength;
        let accumulated = 0;
        
        for (let i = 0; i < this.points.length; i++) {
            const next = (i + 1) % this.points.length;
            const segmentLength = this.getDistance(this.points[i], this.points[next]);
            
            if (accumulated + segmentLength >= distance) {
                const t = (distance - accumulated) / segmentLength;
                const prev = this.points[(i - 1 + this.points.length) % this.points.length];
                const nextNext = this.points[(next + 1) % this.points.length];
                
                return {
                    x: this.points[i].x + (this.points[next].x - this.points[i].x) * t,
                    y: this.points[i].y + (this.points[next].y - this.points[i].y) * t,
                    angle: Math.atan2(this.points[next].y - this.points[i].y, this.points[next].x - this.points[i].x)
                };
            }
            accumulated += segmentLength;
        }
        return { ...this.points[0], angle: 0 };
    }

    getDistance(p1, p2) {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    isOnTrack(x, y) {
        let minDist = Infinity;
        for (let i = 0; i < this.points.length; i++) {
            const next = (i + 1) % this.points.length;
            const dist = this.pointToSegmentDistance(x, y, this.points[i].x, this.points[i].y, this.points[next].x, this.points[next].y);
            if (dist < minDist) minDist = dist;
        }
        return minDist < this.width / 2;
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
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

    getTrackAngleAt(x, y) {
        let minDist = Infinity;
        let closestIndex = 0;
        
        for (let i = 0; i < this.points.length; i++) {
            const dist = Math.hypot(x - this.points[i].x, y - this.points[i].y);
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }
        
        const prev = this.points[(closestIndex - 1 + this.points.length) % this.points.length];
        const next = this.points[(closestIndex + 1) % this.points.length];
        return Math.atan2(next.y - prev.y, next.x - prev.x);
    }

    draw(ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = '#0f0f12';
        ctx.lineWidth = this.width + 30;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.stroke();

        this.drawKerbs(ctx);

        ctx.strokeStyle = '#2d2d35';
        ctx.lineWidth = this.width;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 25]);
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        this.drawStartLine(ctx);
    }

    drawKerbs(ctx) {
        const kerbWidth = 12;
        const segmentLength = 8;
        
        for (let i = 0; i < this.innerPoints.length; i++) {
            const next = (i + 1) % this.innerPoints.length;
            const isRed = Math.floor(i / 2) % 2 === 0;
            
            ctx.fillStyle = isRed ? '#e10600' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(this.innerPoints[i].x, this.innerPoints[i].y);
            ctx.lineTo(this.innerPoints[next].x, this.innerPoints[next].y);
            
            const angle = Math.atan2(this.innerPoints[next].y - this.innerPoints[i].y, this.innerPoints[next].x - this.innerPoints[i].x);
            const perpAngle = angle + Math.PI / 2;
            
            ctx.lineTo(this.innerPoints[next].x + Math.cos(perpAngle) * kerbWidth, this.innerPoints[next].y + Math.sin(perpAngle) * kerbWidth);
            ctx.lineTo(this.innerPoints[i].x + Math.cos(perpAngle) * kerbWidth, this.innerPoints[i].y + Math.sin(perpAngle) * kerbWidth);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = isRed ? '#e10600' : '#ffffff';
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
        const squareSize = 8;
        
        const x1 = start.x + Math.cos(perpAngle) * halfWidth;
        const y1 = start.y + Math.sin(perpAngle) * halfWidth;
        const x2 = start.x - Math.cos(perpAngle) * halfWidth;
        const y2 = start.y - Math.sin(perpAngle) * halfWidth;
        
        const lineLength = Math.hypot(x2 - x1, y2 - y1);
        const numSquares = Math.floor(lineLength / squareSize);
        
        ctx.save();
        for (let row = 0; row < 4; row++) {
            for (let i = 0; i < numSquares; i++) {
                const t = i / numSquares;
                const px = x1 + (x2 - x1) * t;
                const py = y1 + (y2 - y1) * t;
                const offsetX = Math.cos(start.angle) * row * squareSize;
                const offsetY = Math.sin(start.angle) * row * squareSize;
                
                ctx.fillStyle = (i + row) % 2 === 0 ? '#ffffff' : '#000000';
                ctx.save();
                ctx.translate(px + offsetX, py + offsetY);
                ctx.rotate(perpAngle);
                ctx.fillRect(-squareSize / 2, -squareSize / 2, squareSize, squareSize);
                ctx.restore();
            }
        }
        ctx.restore();
    }

    drawMinimap(ctx, width, height) {
        const scale = Math.min(width, height) / (Math.max(canvas.width, canvas.height) * 1.05);
        const offsetX = (width - canvas.width * scale) / 2;
        const offsetY = (height - canvas.height * scale) / 2;
        
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#3a3a42';
        ctx.lineWidth = 6 * scale;
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
        this.velocity = { x: 0, y: 0 };
        this.angularVelocity = 0;
        this.steeringAngle = 0;
        this.speed = 0;
        this.color = color;
        this.isPlayer = isPlayer;
        this.width = 18;
        this.height = 38;
        this.wheelBase = 30;
        
        this.gear = 1;
        this.rpm = CONFIG.RPM_MIN;
        this.throttle = 0;
        this.brake = 0;
        
        this.trackProgress = 0;
        this.totalProgress = 0;
        this.lastCheckpoint = 0;
        this.lap = 0;
        this.finished = false;
        
        this.slip = 0;
        this.driftAngle = 0;
        
        this.aiAggression = 0.75 + Math.random() * 0.25;
        this.aiLineOffset = (Math.random() - 0.5) * 25;
        this.aiTargetAngle = angle;
    }

    update(deltaTime, track) {
        if (this.finished) return;
        
        const dt = deltaTime / 1000;
        const dtNorm = dt * 60;
        
        const onTrack = track.isOnTrack(this.x, this.y);
        const gripMult = onTrack ? 1 : CONFIG.OFF_TRACK_GRIP_MULT;
        const speedMult = onTrack ? 1 : CONFIG.OFF_TRACK_SPEED_MULT;
        
        if (this.isPlayer) {
            this.handlePlayerInput(dtNorm);
        } else {
            this.updateAI(track, dtNorm);
        }

        this.updatePhysics(dt, dtNorm, gripMult, speedMult);
        this.updateGear();
        this.updateProgress(track);
    }

    handlePlayerInput(dtNorm) {
        const targetThrottle = keys.up ? 1 : 0;
        const targetBrake = keys.down ? 1 : 0;
        
        this.throttle += (targetThrottle - this.throttle) * 0.15 * dtNorm;
        this.brake += (targetBrake - this.brake) * 0.2 * dtNorm;
        
        let targetSteering = 0;
        if (keys.left) targetSteering = -CONFIG.MAX_STEERING_ANGLE;
        if (keys.right) targetSteering = CONFIG.MAX_STEERING_ANGLE;
        
        const steerSpeed = this.speed > 50 ? CONFIG.STEERING_SENSITIVITY * (1 - this.speed / CONFIG.MAX_SPEED * 0.5) : CONFIG.STEERING_SENSITIVITY;
        
        if (targetSteering !== 0) {
            this.steeringAngle += (targetSteering - this.steeringAngle) * steerSpeed * dtNorm * 3;
        } else {
            this.steeringAngle *= (1 - CONFIG.STEERING_RETURN_SPEED * dtNorm * 2);
        }
        
        this.steeringAngle = Math.max(-CONFIG.MAX_STEERING_ANGLE, Math.min(CONFIG.MAX_STEERING_ANGLE, this.steeringAngle));
    }

    updateAI(track, dtNorm) {
        const lookAhead = 80 + this.speed * 1.5;
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
        
        this.aiTargetAngle += (angleDiff - this.aiTargetAngle) * 0.1 * dtNorm;
        this.steeringAngle = Math.max(-CONFIG.MAX_STEERING_ANGLE, Math.min(CONFIG.MAX_STEERING_ANGLE, this.aiTargetAngle * 2));
        
        const cornerSharpness = Math.abs(angleDiff);
        const targetSpeed = CONFIG.MAX_SPEED * (1 - cornerSharpness * 0.6) * this.aiAggression;
        
        if (this.speed < targetSpeed * 0.95) {
            this.throttle = Math.min(1, this.throttle + 0.08 * dtNorm * this.aiAggression);
            this.brake = Math.max(0, this.brake - 0.15 * dtNorm);
        } else if (this.speed > targetSpeed) {
            this.throttle = Math.max(0, this.throttle - 0.1 * dtNorm);
            this.brake = Math.min(0.5, this.brake + 0.05 * dtNorm);
        }
        
        for (const car of [playerCar, ...aiCars]) {
            if (car === this) continue;
            const dx = car.x - this.x;
            const dy = car.y - this.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist < 50 && dist > 0) {
                const avoidAngle = Math.atan2(dy, dx);
                let avoidDiff = avoidAngle - this.angle;
                while (avoidDiff > Math.PI) avoidDiff -= Math.PI * 2;
                while (avoidDiff < -Math.PI) avoidDiff += Math.PI * 2;
                
                if (Math.abs(avoidDiff) < Math.PI / 2) {
                    this.steeringAngle -= Math.sign(avoidDiff) * 0.05 * dtNorm;
                    if (dist < 35) this.brake = Math.min(1, this.brake + 0.1);
                }
            }
        }
    }

    updatePhysics(dt, dtNorm, gripMult, speedMult) {
        const gearRatio = CONFIG.GEAR_RATIOS[this.gear - 1] || 1;
        const engineForce = this.throttle * CONFIG.ENGINE_POWER * gearRatio / (1 + this.speed / 100);
        const brakeForce = this.brake * CONFIG.BRAKE_POWER;
        
        const dragForce = CONFIG.DRAG_COEFFICIENT * this.speed * this.speed * Math.sign(this.speed);
        const rollingResistance = CONFIG.ROLLING_RESISTANCE * this.speed;
        
        let netForce = engineForce - brakeForce - dragForce - rollingResistance;
        const acceleration = netForce / CONFIG.MASS;
        
        this.speed += acceleration * dt * 60 * speedMult;
        this.speed = Math.max(0, Math.min(CONFIG.MAX_SPEED, this.speed));
        
        if (Math.abs(this.speed) > 1) {
            const turnRadius = this.wheelBase / Math.tan(Math.abs(this.steeringAngle) + 0.001);
            const angularVel = (this.speed / turnRadius) * Math.sign(this.steeringAngle);
            
            const gripFactor = CONFIG.TIRE_GRIP * gripMult;
            const lateralAccel = (this.speed * this.speed) / turnRadius;
            const maxLateralAccel = gripFactor * 9.81;
            
            this.slip = Math.min(1, lateralAccel / maxLateralAccel);
            const effectiveAngularVel = angularVel * (1 - this.slip * 0.3);
            
            this.angularVelocity += (effectiveAngularVel - this.angularVelocity) * 0.2 * dtNorm;
        } else {
            this.angularVelocity *= 0.9;
            this.slip = 0;
        }
        
        this.angularVelocity *= (1 - 0.05 * dtNorm);
        this.angle += this.angularVelocity * dt;
        
        const vx = Math.cos(this.angle) * this.speed * 0.12;
        const vy = Math.sin(this.angle) * this.speed * 0.12;
        
        this.velocity.x += (vx - this.velocity.x) * 0.15 * dtNorm;
        this.velocity.y += (vy - this.velocity.y) * 0.15 * dtNorm;
        
        this.x += this.velocity.x * dtNorm;
        this.y += this.velocity.y * dtNorm;
        
        this.x = Math.max(10, Math.min(canvas.width - 10, this.x));
        this.y = Math.max(10, Math.min(canvas.height - 10, this.y));
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
        
        if (this.throttle < 0.3 && this.speed > speeds[this.gear - 1] + 10) {
            newGear = Math.max(1, this.gear);
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
        
        if (this.speed > 150) {
            const intensity = Math.min(1, (this.speed - 150) / 150);
            ctx.fillStyle = `rgba(255, 100, 50, ${intensity * 0.3})`;
            ctx.beginPath();
            ctx.moveTo(-4, this.height / 2);
            ctx.lineTo(4, this.height / 2);
            ctx.lineTo(2, this.height / 2 + 15 + intensity * 10);
            ctx.lineTo(-2, this.height / 2 + 15 + intensity * 10);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(-this.width / 2 - 2, this.height * 0.3, 5, 7, 0, 0, Math.PI * 2);
        ctx.ellipse(this.width / 2 + 2, this.height * 0.3, 5, 7, 0, 0, Math.PI * 2);
        ctx.ellipse(-this.width / 2 - 2, -this.height * 0.32, 6, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(this.width / 2 + 2, -this.height * 0.32, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2 - 2);
        ctx.lineTo(-this.width / 2 + 2, this.height / 4);
        ctx.quadraticCurveTo(-this.width / 3, this.height / 2, 0, this.height / 2);
        ctx.quadraticCurveTo(this.width / 3, this.height / 2, this.width / 2 - 2, this.height / 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, -this.height * 0.08, this.width * 0.28, this.height * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(100,200,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, -this.height * 0.12, this.width * 0.2, this.height * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const wingWidth = this.width * 0.9;
        ctx.fillStyle = this.color;
        ctx.fillRect(-wingWidth / 2, -this.height / 2 - 6, wingWidth, 6);
        ctx.fillRect(-wingWidth / 2, this.height / 2 - 2, wingWidth, 5);
        
        if (this.isPlayer) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 6px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('1', 0, 3);
        }
        
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
        ctx.moveTo(0, -4);
        ctx.lineTo(-2.5, 3);
        ctx.lineTo(2.5, 3);
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
        startPos.x + Math.cos(perpAngle) * 18,
        startPos.y + Math.sin(perpAngle) * 18,
        startPos.angle,
        selectedTeamColor,
        true
    );
    
    aiCars = [];
    const availableColors = AI_COLORS.filter(c => c !== selectedTeamColor);
    
    for (let i = 0; i < CONFIG.AI_COUNT; i++) {
        const offset = -(i + 1) * 50;
        const rowOffset = i % 2 === 0 ? -22 : 22;
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
        if (count < 5) {
            lights[count].classList.add('active');
            text.textContent = 5 - count;
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
            }, 500);
        }
    }, 1000);
}

function gameLoop(timestamp) {
    if (gameState !== 'racing') return;
    
    const deltaTime = Math.min(timestamp - lastFrameTime, 50);
    lastFrameTime = timestamp;
    
    raceTime += deltaTime;
    
    playerCar.update(deltaTime, track);
    aiCars.forEach(car => car.update(deltaTime, track));
    
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
        rpmEl.style.background = rpmPercent > 0.85 ? '#e10600' : rpmPercent > 0.7 ? '#ff8000' : '#00d2be';
    }
    
    const speedPercent = playerCar.speed / CONFIG.MAX_SPEED;
    const circumference = 339.292;
    document.getElementById('speedArc').style.strokeDashoffset = circumference * (1 - speedPercent);
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

let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouching = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    keys.up = true;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    
    keys.left = deltaX < -15;
    keys.right = deltaX > 15;
    keys.down = (touchY - touchStartY) > 40;
    keys.up = !keys.down;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouching = false;
    keys.up = false;
    keys.down = false;
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
