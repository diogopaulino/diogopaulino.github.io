(() => {
    'use strict';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');
    const staticCanvas = document.createElement('canvas');
    const staticCtx = staticCanvas.getContext('2d');

    const ui = {
        startScreen: document.getElementById('startScreen'),
        countdownOverlay: document.getElementById('countdownOverlay'),
        countdownText: document.getElementById('countdownText'),
        finishScreen: document.getElementById('finishScreen'),
        pauseScreen: document.getElementById('pauseScreen'),
        startBtn: document.getElementById('startBtn'),
        restartBtn: document.getElementById('restartBtn'),
        changeTeamBtn: document.getElementById('changeTeamBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        resumeBtn: document.getElementById('resumeBtn'),
        quitBtn: document.getElementById('quitBtn'),
        position: document.getElementById('position'),
        lap: document.getElementById('lap'),
        speed: document.getElementById('speed'),
        gear: document.getElementById('gear'),
        time: document.getElementById('time'),
        bestLap: document.getElementById('bestLap'),
        speedArc: document.getElementById('speedArc'),
        rpmBar: document.getElementById('rpmBar'),
        rpmLights: [...document.querySelectorAll('#rpmLights i')],
        raceProgress: document.getElementById('raceProgress'),
        finalPosition: document.getElementById('finalPosition'),
        finalBestLap: document.getElementById('finalBestLap'),
        finalTime: document.getElementById('finalTime'),
        finishTitle: document.getElementById('finishTitle'),
        finishTeam: document.getElementById('finishTeam'),
        announcement: document.getElementById('raceAnnouncement')
    };

    const TOTAL_LAPS = 3;
    const MAX_SPEED = 340;
    const MAX_RPM = 15000;
    const ACCELERATION = 1.15;
    const BRAKING = 1.8;
    const FRICTION = 0.32;
    const TURN_SPEED = 0.042;
    const MOVE_SCALE = 0.032;
    const STORAGE_KEY = 'f1-racing-personal-best';

    const teams = [
        { color: '#ff2b24', name: 'Ferrari' },
        { color: '#27f4d2', name: 'Mercedes' },
        { color: '#4f75ff', name: 'Red Bull' },
        { color: '#ff8700', name: 'McLaren' },
        { color: '#2d826d', name: 'Aston Martin' },
        { color: '#ff7da5', name: 'Alpine' }
    ];

    const keys = { up: false, down: false, left: false, right: false };
    const displayCache = {};

    let gameState = 'menu';
    let selectedTeamColor = teams[0].color;
    let selectedTeamName = teams[0].name;
    let player = null;
    let aiCars = [];
    let trackPoints = [];
    let trackWidth = 80;
    let stageWidth = window.innerWidth;
    let stageHeight = window.innerHeight;
    let pixelRatio = 1;
    let raceTime = 0;
    let lapTimes = [];
    let bestLap = Infinity;
    let personalBest = readPersonalBest();
    let lastLapTime = 0;
    let lastFrameTime = performance.now();
    let countdownRun = 0;
    let animationFrame = 0;

    function readPersonalBest() {
        try {
            const value = Number(localStorage.getItem(STORAGE_KEY));
            return Number.isFinite(value) && value > 0 ? value : Infinity;
        } catch (error) {
            return Infinity;
        }
    }

    function savePersonalBest(value) {
        if (!Number.isFinite(value) || value >= personalBest) return;
        personalBest = value;

        try {
            localStorage.setItem(STORAGE_KEY, String(value));
        } catch (error) {
            // The race remains fully playable if storage is unavailable.
        }
    }

    function setCanvasSize(target, context, width, height, ratio) {
        target.width = Math.round(width * ratio);
        target.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function resizeCanvas() {
        stageWidth = Math.max(320, window.innerWidth);
        stageHeight = Math.max(480, window.innerHeight);
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        setCanvasSize(canvas, ctx, stageWidth, stageHeight, pixelRatio);
        setCanvasSize(staticCanvas, staticCtx, stageWidth, stageHeight, pixelRatio);

        const mapRect = minimapCanvas.getBoundingClientRect();
        setCanvasSize(
            minimapCanvas,
            minimapCtx,
            Math.max(70, mapRect.width),
            Math.max(70, mapRect.height),
            pixelRatio
        );

        generateTrack();

        if (player) {
            repositionCarsToTrack([player, ...aiCars]);
        }
    }

    function generateTrack() {
        const oldPoints = trackPoints;
        trackPoints = [];

        const compactLandscape = stageHeight < 620 && stageWidth > stageHeight;
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2 + (compactLandscape ? 8 : 18);
        const radiusX = Math.min(stageWidth * 0.37, 510);
        const radiusY = Math.min(stageHeight * (compactLandscape ? 0.34 : 0.32), 305);
        const pointCount = 160;

        for (let i = 0; i < pointCount; i += 1) {
            const angle = (i / pointCount) * Math.PI * 2;
            const xShape = 1 + Math.sin(angle * 3 + 0.55) * 0.13 + Math.sin(angle * 5 - 0.4) * 0.055;
            const yShape = 1 + Math.cos(angle * 2 - 0.4) * 0.11 + Math.sin(angle * 4) * 0.035;

            trackPoints.push({
                x: centerX + Math.cos(angle) * radiusX * xShape,
                y: centerY + Math.sin(angle) * radiusY * yShape
            });
        }

        trackWidth = Math.max(58, Math.min(108, Math.min(stageWidth, stageHeight) * 0.095));

        if (oldPoints.length || trackPoints.length) {
            renderStaticScene();
        }
    }

    function createTrackPath(context) {
        if (!trackPoints.length) return;

        context.beginPath();
        context.moveTo(trackPoints[0].x, trackPoints[0].y);
        for (let i = 1; i <= trackPoints.length; i += 1) {
            const point = trackPoints[i % trackPoints.length];
            context.lineTo(point.x, point.y);
        }
        context.closePath();
    }

    function renderStaticScene() {
        const styles = getComputedStyle(document.documentElement);
        const grass = styles.getPropertyValue('--grass-color').trim() || '#101812';
        const track = styles.getPropertyValue('--track-color').trim() || '#2d3038';
        const trackHighlight = styles.getPropertyValue('--track-highlight').trim() || '#383b44';

        staticCtx.clearRect(0, 0, stageWidth, stageHeight);
        staticCtx.fillStyle = grass;
        staticCtx.fillRect(0, 0, stageWidth, stageHeight);

        const grassGlow = staticCtx.createRadialGradient(
            stageWidth * 0.52,
            stageHeight * 0.48,
            20,
            stageWidth * 0.52,
            stageHeight * 0.48,
            Math.max(stageWidth, stageHeight) * 0.7
        );
        grassGlow.addColorStop(0, 'rgba(50, 82, 52, 0.16)');
        grassGlow.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
        staticCtx.fillStyle = grassGlow;
        staticCtx.fillRect(0, 0, stageWidth, stageHeight);

        staticCtx.save();
        staticCtx.globalAlpha = 0.07;
        staticCtx.strokeStyle = '#b4d2b5';
        staticCtx.lineWidth = 1;
        const gridSize = 74;
        for (let x = -stageHeight; x < stageWidth + stageHeight; x += gridSize) {
            staticCtx.beginPath();
            staticCtx.moveTo(x, 0);
            staticCtx.lineTo(x - stageHeight, stageHeight);
            staticCtx.stroke();
        }
        staticCtx.restore();

        staticCtx.save();
        staticCtx.lineCap = 'round';
        staticCtx.lineJoin = 'round';

        createTrackPath(staticCtx);
        staticCtx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
        staticCtx.lineWidth = trackWidth + 30;
        staticCtx.shadowColor = 'rgba(0, 0, 0, 0.38)';
        staticCtx.shadowBlur = 24;
        staticCtx.stroke();
        staticCtx.shadowBlur = 0;

        createTrackPath(staticCtx);
        staticCtx.strokeStyle = '#d92b25';
        staticCtx.lineWidth = trackWidth + 14;
        staticCtx.stroke();

        createTrackPath(staticCtx);
        staticCtx.setLineDash([16, 16]);
        staticCtx.strokeStyle = '#ececf0';
        staticCtx.lineWidth = trackWidth + 14;
        staticCtx.stroke();
        staticCtx.setLineDash([]);

        createTrackPath(staticCtx);
        staticCtx.strokeStyle = track;
        staticCtx.lineWidth = trackWidth;
        staticCtx.stroke();

        createTrackPath(staticCtx);
        staticCtx.strokeStyle = trackHighlight;
        staticCtx.lineWidth = Math.max(1, trackWidth - 10);
        staticCtx.globalAlpha = 0.72;
        staticCtx.stroke();

        createTrackPath(staticCtx);
        staticCtx.setLineDash([4, 22]);
        staticCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        staticCtx.lineWidth = 2;
        staticCtx.stroke();
        staticCtx.setLineDash([]);
        staticCtx.globalAlpha = 1;
        staticCtx.restore();

        drawStartLine(staticCtx);
        drawTracksideDetails(staticCtx);
    }

    function drawStartLine(context) {
        const point = trackPoints[0];
        const next = trackPoints[1];
        const angle = Math.atan2(next.y - point.y, next.x - point.x) + Math.PI / 2;
        const square = Math.max(5, trackWidth / 11);
        const rows = 3;
        const columns = Math.ceil(trackWidth / square);

        context.save();
        context.translate(point.x, point.y);
        context.rotate(angle);
        for (let row = 0; row < rows; row += 1) {
            for (let column = -Math.floor(columns / 2); column < Math.ceil(columns / 2); column += 1) {
                context.fillStyle = (row + column) % 2 === 0 ? '#f7f7f8' : '#111216';
                context.fillRect(
                    column * square,
                    (row - 1.5) * square,
                    square + 0.5,
                    square + 0.5
                );
            }
        }
        context.restore();
    }

    function drawTracksideDetails(context) {
        context.save();
        context.font = `600 ${Math.max(8, trackWidth * 0.1)}px Orbitron, sans-serif`;
        context.letterSpacing = '2px';
        context.fillStyle = 'rgba(255, 255, 255, 0.22)';
        context.textAlign = 'center';
        context.fillText('GP LABS', stageWidth / 2, stageHeight / 2 + 3);

        for (let i = 9; i < trackPoints.length; i += 28) {
            const point = trackPoints[i];
            const next = trackPoints[(i + 1) % trackPoints.length];
            const tangent = Math.atan2(next.y - point.y, next.x - point.x);
            const side = i % 2 === 0 ? 1 : -1;
            const offset = trackWidth * 0.78 * side;
            const x = point.x + Math.cos(tangent + Math.PI / 2) * offset;
            const y = point.y + Math.sin(tangent + Math.PI / 2) * offset;

            context.fillStyle = i % 3 === 0 ? '#ff2b24' : 'rgba(255, 255, 255, 0.32)';
            context.fillRect(x - 7, y - 2, 14, 4);
        }
        context.restore();
    }

    function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
            (2 * p1)
            + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    function normalizeProgress(progress) {
        return ((progress % 1) + 1) % 1;
    }

    function getTrackPosition(progress) {
        const normalized = normalizeProgress(progress);
        const exactIndex = normalized * trackPoints.length;
        const index = Math.floor(exactIndex) % trackPoints.length;
        const t = exactIndex - Math.floor(exactIndex);
        const pointAt = (offset) => trackPoints[(index + offset + trackPoints.length) % trackPoints.length];
        const p0 = pointAt(-1);
        const p1 = pointAt(0);
        const p2 = pointAt(1);
        const p3 = pointAt(2);

        return {
            x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
            y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
            index
        };
    }

    function getTrackAngle(index) {
        const current = trackPoints[(index + trackPoints.length) % trackPoints.length];
        const next = trackPoints[(index + 2 + trackPoints.length) % trackPoints.length];
        return Math.atan2(next.y - current.y, next.x - current.x);
    }

    function createCar(team, progress, isPlayer = false, gridPosition = 0) {
        const position = getTrackPosition(progress);
        const angle = getTrackAngle(position.index);
        const laneOffset = (gridPosition % 2 === 0 ? -1 : 1) * Math.min(trackWidth * 0.19, 13);

        return {
            x: position.x + Math.cos(angle + Math.PI / 2) * laneOffset,
            y: position.y + Math.sin(angle + Math.PI / 2) * laneOffset,
            angle,
            speed: 0,
            progress,
            lap: Math.floor(progress),
            color: team.color,
            name: team.name,
            isPlayer,
            trackIndex: position.index,
            targetSpeed: isPlayer ? 0 : 238 + Math.random() * 38,
            skillFactor: 0.91 + Math.random() * 0.09,
            finished: false
        };
    }

    function repositionCarsToTrack(cars) {
        cars.forEach((car, index) => {
            const position = getTrackPosition(car.progress);
            const angle = getTrackAngle(position.index);
            const laneOffset = index === 0 ? 0 : (index % 2 === 0 ? -1 : 1) * Math.min(trackWidth * 0.14, 11);
            car.x = position.x + Math.cos(angle + Math.PI / 2) * laneOffset;
            car.y = position.y + Math.sin(angle + Math.PI / 2) * laneOffset;
            car.angle = angle;
            car.trackIndex = position.index;
        });
    }

    function resetInputs() {
        Object.keys(keys).forEach((key) => {
            keys[key] = false;
        });
        document.querySelectorAll('.control-pad.active').forEach((button) => {
            button.classList.remove('active');
        });
    }

    function initRace({ preview = false } = {}) {
        generateTrack();
        resetInputs();

        const playerTeam = { color: selectedTeamColor, name: selectedTeamName };
        player = createCar(playerTeam, 0, true, 0);

        const rivals = teams
            .filter((team) => team.name !== selectedTeamName)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);

        aiCars = rivals.map((team, index) => (
            createCar(team, -0.026 * (index + 1), false, index + 1)
        ));

        raceTime = 0;
        lapTimes = [];
        bestLap = Infinity;
        lastLapTime = 0;
        clearDisplayCache();

        if (preview) {
            [player, ...aiCars].forEach((car, index) => {
                car.speed = 0;
                if (index > 0) car.progress = -0.026 * index;
            });
        }
    }

    function clearDisplayCache() {
        Object.keys(displayCache).forEach((key) => {
            delete displayCache[key];
        });
    }

    function delay(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function startCountdown() {
        const run = ++countdownRun;
        gameState = 'countdown';
        document.body.classList.remove('race-active', 'race-paused');
        ui.startScreen.classList.add('hidden');
        ui.finishScreen.classList.add('hidden');
        ui.pauseScreen.classList.add('hidden');
        ui.countdownOverlay.classList.remove('hidden');

        const lights = [...document.querySelectorAll('.countdown-light')];
        lights.forEach((light) => light.classList.remove('active', 'go'));
        ui.countdownText.textContent = '';

        for (let index = 0; index < lights.length; index += 1) {
            if (run !== countdownRun) return;
            lights[index].classList.add('active');
            ui.countdownText.textContent = String(lights.length - index);
            await delay(480);
        }

        if (run !== countdownRun) return;
        await delay(280);
        lights.forEach((light) => {
            light.classList.remove('active');
            light.classList.add('go');
        });
        ui.countdownText.textContent = 'VAI!';
        ui.announcement.textContent = 'Largada!';
        await delay(620);

        if (run !== countdownRun) return;
        ui.countdownOverlay.classList.add('hidden');
        lights.forEach((light) => light.classList.remove('go'));
        gameState = 'racing';
        lastFrameTime = performance.now();
        document.body.classList.add('race-active');
    }

    function updatePlayer(deltaTime) {
        if (!player || player.finished) return;
        const dt = deltaTime / 16.667;

        if (keys.up) player.speed += ACCELERATION * dt;
        if (keys.down) {
            if (player.speed > 0) {
                player.speed -= BRAKING * dt;
            } else {
                player.speed -= ACCELERATION * 0.45 * dt;
            }
        }

        if (!keys.up && !keys.down) {
            const drag = FRICTION * dt * Math.sign(player.speed);
            player.speed = Math.abs(player.speed) <= Math.abs(drag) ? 0 : player.speed - drag;
        }

        player.speed = Math.max(-42, Math.min(MAX_SPEED, player.speed));

        const speedRatio = Math.min(1, Math.abs(player.speed) / 90);
        const turnAmount = TURN_SPEED * (0.3 + speedRatio * 0.7) * dt;
        const direction = player.speed >= 0 ? 1 : -1;
        if (keys.left) player.angle -= turnAmount * direction;
        if (keys.right) player.angle += turnAmount * direction;

        const move = player.speed * MOVE_SCALE * dt;
        player.x += Math.cos(player.angle) * move;
        player.y += Math.sin(player.angle) * move;

        keepOnTrack(player);
        updateCarProgress(player);
    }

    function updateAICar(car, deltaTime) {
        if (car.finished) return;
        const dt = deltaTime / 16.667;
        const lookAhead = 0.026 + Math.min(0.018, car.speed / 12000);
        const target = getTrackPosition(car.progress + lookAhead);
        const targetAngle = Math.atan2(target.y - car.y, target.x - car.x);
        let angleDifference = targetAngle - car.angle;

        while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
        while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

        car.angle += angleDifference * 0.09 * car.skillFactor * dt;
        const cornerPenalty = Math.min(0.32, Math.abs(angleDifference) * 0.58);
        const desiredSpeed = car.targetSpeed * (1 - cornerPenalty) * car.skillFactor;

        if (car.speed < desiredSpeed) {
            car.speed += 0.9 * dt;
        } else {
            car.speed -= 1.15 * dt;
        }

        car.speed = Math.max(120, Math.min(MAX_SPEED * 0.88, car.speed));
        const move = car.speed * MOVE_SCALE * dt;
        car.x += Math.cos(car.angle) * move;
        car.y += Math.sin(car.angle) * move;

        keepOnTrack(car);
        updateCarProgress(car);
    }

    function findClosestTrackPoint(car) {
        let closestIndex = car.trackIndex || 0;
        let minimumDistanceSquared = Infinity;

        for (let offset = -16; offset <= 24; offset += 1) {
            const index = (car.trackIndex + offset + trackPoints.length) % trackPoints.length;
            const dx = car.x - trackPoints[index].x;
            const dy = car.y - trackPoints[index].y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < minimumDistanceSquared) {
                minimumDistanceSquared = distanceSquared;
                closestIndex = index;
            }
        }

        return {
            index: closestIndex,
            distance: Math.sqrt(minimumDistanceSquared)
        };
    }

    function keepOnTrack(car) {
        const closest = findClosestTrackPoint(car);
        const softLimit = trackWidth * 0.47;
        const hardLimit = trackWidth * 0.72;

        if (closest.distance > softLimit) {
            const point = trackPoints[closest.index];
            const correctionAngle = Math.atan2(car.y - point.y, car.x - point.x);
            const correction = Math.min(
                closest.distance - softLimit,
                trackWidth * 0.18
            );

            car.x -= Math.cos(correctionAngle) * correction * 0.22;
            car.y -= Math.sin(correctionAngle) * correction * 0.22;
            car.speed *= closest.distance > hardLimit ? 0.92 : 0.975;
        }

        car.trackIndex = closest.index;
    }

    function updateCarProgress(car) {
        const oldNormalized = normalizeProgress(car.progress);
        const closest = findClosestTrackPoint(car);
        const newNormalized = closest.index / trackPoints.length;

        if (oldNormalized > 0.88 && newNormalized < 0.12) {
            car.lap += 1;

            if (car.isPlayer && car.lap > 0 && car.lap <= TOTAL_LAPS) {
                const lapTime = raceTime - lastLapTime;
                lapTimes.push(lapTime);
                bestLap = Math.min(bestLap, lapTime);
                savePersonalBest(lapTime);
                lastLapTime = raceTime;

                if (car.lap < TOTAL_LAPS) {
                    ui.announcement.textContent = `Volta ${car.lap + 1} de ${TOTAL_LAPS}.`;
                }
            }

            if (car.lap >= TOTAL_LAPS) {
                car.finished = true;
            }
        } else if (oldNormalized < 0.12 && newNormalized > 0.88) {
            car.lap = Math.max(car.isPlayer ? 0 : -1, car.lap - 1);
        }

        car.progress = car.lap + newNormalized;
        car.trackIndex = closest.index;
    }

    function drawCar(car) {
        const carLength = car.isPlayer ? 34 : 31;
        const carWidth = car.isPlayer ? 14 : 13;

        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
        ctx.beginPath();
        ctx.ellipse(-1, 3, carLength * 0.64, carWidth * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#07080b';
        ctx.fillRect(-carLength * 0.48, -carWidth * 0.72, 7, 4);
        ctx.fillRect(-carLength * 0.48, carWidth * 0.42, 7, 4);
        ctx.fillRect(carLength * 0.2, -carWidth * 0.76, 8, 4);
        ctx.fillRect(carLength * 0.2, carWidth * 0.46, 8, 4);

        if (car.isPlayer) {
            ctx.shadowColor = car.color;
            ctx.shadowBlur = 18;
        }

        const bodyGradient = ctx.createLinearGradient(-carLength / 2, 0, carLength / 2, 0);
        bodyGradient.addColorStop(0, shadeColor(car.color, -32));
        bodyGradient.addColorStop(0.55, car.color);
        bodyGradient.addColorStop(1, shadeColor(car.color, 24));
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.moveTo(carLength * 0.58, 0);
        ctx.lineTo(carLength * 0.29, -carWidth * 0.48);
        ctx.lineTo(-carLength * 0.23, -carWidth * 0.52);
        ctx.lineTo(-carLength * 0.5, -carWidth * 0.29);
        ctx.lineTo(-carLength * 0.57, 0);
        ctx.lineTo(-carLength * 0.5, carWidth * 0.29);
        ctx.lineTo(-carLength * 0.23, carWidth * 0.52);
        ctx.lineTo(carLength * 0.29, carWidth * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#161923';
        ctx.beginPath();
        ctx.ellipse(2, 0, 6, carWidth * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(carLength * 0.34, -carWidth * 0.26);
        ctx.lineTo(carLength * 0.48, 0);
        ctx.lineTo(carLength * 0.34, carWidth * 0.26);
        ctx.stroke();

        ctx.fillStyle = '#0a0b0e';
        ctx.fillRect(-carLength * 0.56, -carWidth * 0.62, 3, carWidth * 1.24);
        ctx.fillRect(carLength * 0.36, -carWidth * 0.69, 3, carWidth * 1.38);

        if (car.isPlayer) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.86;
            ctx.beginPath();
            ctx.arc(0, 0, carWidth * 0.68, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    function shadeColor(hex, amount) {
        const normalized = hex.replace('#', '');
        const value = Number.parseInt(normalized, 16);
        const red = Math.max(0, Math.min(255, (value >> 16) + amount));
        const green = Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount));
        const blue = Math.max(0, Math.min(255, (value & 0xff) + amount));
        return `rgb(${red}, ${green}, ${blue})`;
    }

    function drawMinimap() {
        const mapWidth = minimapCanvas.width / pixelRatio;
        const mapHeight = minimapCanvas.height / pixelRatio;
        minimapCtx.clearRect(0, 0, mapWidth, mapHeight);
        if (!trackPoints.length || !player) return;

        const padding = 8;
        const bounds = trackPoints.reduce((accumulator, point) => ({
            minX: Math.min(accumulator.minX, point.x),
            maxX: Math.max(accumulator.maxX, point.x),
            minY: Math.min(accumulator.minY, point.y),
            maxY: Math.max(accumulator.maxY, point.y)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

        const sourceWidth = bounds.maxX - bounds.minX;
        const sourceHeight = bounds.maxY - bounds.minY;
        const scale = Math.min(
            (mapWidth - padding * 2) / sourceWidth,
            (mapHeight - padding * 2) / sourceHeight
        );
        const offsetX = (mapWidth - sourceWidth * scale) / 2 - bounds.minX * scale;
        const offsetY = (mapHeight - sourceHeight * scale) / 2 - bounds.minY * scale;

        minimapCtx.lineCap = 'round';
        minimapCtx.lineJoin = 'round';
        minimapCtx.beginPath();
        trackPoints.forEach((point, index) => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
            if (index === 0) minimapCtx.moveTo(x, y);
            else minimapCtx.lineTo(x, y);
        });
        minimapCtx.closePath();
        minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        minimapCtx.lineWidth = 5;
        minimapCtx.stroke();
        minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
        minimapCtx.lineWidth = 1.4;
        minimapCtx.stroke();

        [player, ...aiCars].forEach((car) => {
            const x = offsetX + car.x * scale;
            const y = offsetY + car.y * scale;
            minimapCtx.beginPath();
            minimapCtx.arc(x, y, car.isPlayer ? 3.6 : 2.4, 0, Math.PI * 2);
            minimapCtx.fillStyle = car.color;
            if (car.isPlayer) {
                minimapCtx.shadowColor = car.color;
                minimapCtx.shadowBlur = 8;
            }
            minimapCtx.fill();
            minimapCtx.shadowBlur = 0;
        });
    }

    function getPositions() {
        return [player, ...aiCars].sort((first, second) => second.progress - first.progress);
    }

    function updateText(element, key, value) {
        if (displayCache[key] === value) return;
        element.textContent = value;
        displayCache[key] = value;
    }

    function updateHUD() {
        if (!player) return;

        const positions = getPositions();
        const playerPosition = positions.findIndex((car) => car.isPlayer) + 1;
        const displaySpeed = Math.round(Math.abs(player.speed));
        const gear = player.speed < -1
            ? 'R'
            : player.speed < 3
                ? 'N'
                : Math.max(1, Math.min(8, Math.ceil(player.speed / (MAX_SPEED / 8))));
        const lapNumber = Math.max(1, Math.min(TOTAL_LAPS, player.lap + 1));
        const currentBest = Math.min(bestLap, personalBest);

        updateText(ui.position, 'position', String(playerPosition));
        updateText(ui.lap, 'lap', String(lapNumber));
        updateText(ui.speed, 'speed', String(displaySpeed));
        updateText(ui.gear, 'gear', String(gear));
        updateText(ui.time, 'time', formatTime(raceTime));
        updateText(ui.bestLap, 'bestLap', Number.isFinite(currentBest) ? formatTime(currentBest) : '--:--.--');

        const speedPercent = Math.min(1, displaySpeed / MAX_SPEED);
        ui.speedArc.style.strokeDasharray = `${245 * speedPercent} 327`;
        ui.rpmBar.style.width = `${speedPercent * 100}%`;
        ui.raceProgress.style.width = `${Math.max(0, Math.min(100, (player.progress / TOTAL_LAPS) * 100))}%`;

        const litLights = Math.round(speedPercent * ui.rpmLights.length);
        ui.rpmLights.forEach((light, index) => {
            light.classList.toggle('active', index < litLights);
            light.classList.toggle('hot', index >= 5 && index < litLights);
            light.classList.toggle('limit', index >= 7 && index < litLights);
        });
    }

    function formatTime(milliseconds) {
        const safeMilliseconds = Math.max(0, milliseconds);
        const minutes = Math.floor(safeMilliseconds / 60000);
        const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
        const centiseconds = Math.floor((safeMilliseconds % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }

    function finishRace() {
        if (!player.finished || gameState !== 'racing') return;

        const positions = getPositions();
        const playerPosition = positions.findIndex((car) => car.isPlayer) + 1;
        const title = playerPosition === 1
            ? 'Vitória!'
            : playerPosition <= 3
                ? 'Pódio garantido'
                : 'Bandeirada';

        gameState = 'finished';
        resetInputs();
        document.body.classList.remove('race-active', 'race-paused');
        ui.finishTitle.textContent = title;
        ui.finishTeam.textContent = `${selectedTeamName} · GP Labs`;
        ui.finalPosition.textContent = `${playerPosition}º`;
        ui.finalBestLap.textContent = Number.isFinite(bestLap) ? formatTime(bestLap) : '--:--.--';
        ui.finalTime.textContent = formatTime(raceTime);
        ui.finishScreen.classList.remove('hidden');
        ui.announcement.textContent = `${title}. Posição final: ${playerPosition} de 5.`;
    }

    function drawFrame() {
        ctx.clearRect(0, 0, stageWidth, stageHeight);
        ctx.drawImage(staticCanvas, 0, 0, stageWidth, stageHeight);

        if (player) {
            [...aiCars, player]
                .sort((first, second) => first.y - second.y)
                .forEach(drawCar);
        }

        drawMinimap();
    }

    function gameLoop(currentTime) {
        const deltaTime = Math.min(Math.max(currentTime - lastFrameTime, 0), 50);
        lastFrameTime = currentTime;

        if (gameState === 'racing') {
            raceTime += deltaTime;
            updatePlayer(deltaTime);
            aiCars.forEach((car) => updateAICar(car, deltaTime));
            finishRace();
        }

        drawFrame();
        updateHUD();
        animationFrame = requestAnimationFrame(gameLoop);
    }

    function togglePause(forcePause) {
        const shouldPause = typeof forcePause === 'boolean' ? forcePause : gameState === 'racing';

        if (shouldPause && gameState === 'racing') {
            gameState = 'paused';
            resetInputs();
            document.body.classList.remove('race-active');
            document.body.classList.add('race-paused');
            ui.pauseScreen.classList.remove('hidden');
            ui.announcement.textContent = 'Corrida pausada.';
            return;
        }

        if (!shouldPause && gameState === 'paused') {
            gameState = 'racing';
            lastFrameTime = performance.now();
            document.body.classList.remove('race-paused');
            document.body.classList.add('race-active');
            ui.pauseScreen.classList.add('hidden');
            ui.announcement.textContent = 'Corrida retomada.';
        }
    }

    function returnToGrid() {
        countdownRun += 1;
        gameState = 'menu';
        resetInputs();
        document.body.classList.remove('race-active', 'race-paused');
        ui.countdownOverlay.classList.add('hidden');
        ui.pauseScreen.classList.add('hidden');
        ui.finishScreen.classList.add('hidden');
        ui.startScreen.classList.remove('hidden');
        initRace({ preview: true });
    }

    function keyToControl(key) {
        const normalized = key.toLowerCase();
        if (normalized === 'arrowup' || normalized === 'w') return 'up';
        if (normalized === 'arrowdown' || normalized === 's') return 'down';
        if (normalized === 'arrowleft' || normalized === 'a') return 'left';
        if (normalized === 'arrowright' || normalized === 'd') return 'right';
        return null;
    }

    function handleKeyDown(event) {
        const control = keyToControl(event.key);
        if (control) {
            event.preventDefault();
            if (gameState === 'racing') keys[control] = true;
            return;
        }

        if ((event.key.toLowerCase() === 'p' || event.key === 'Escape') && !event.repeat) {
            if (gameState === 'racing' || gameState === 'paused') {
                event.preventDefault();
                togglePause();
            }
        }
    }

    function handleKeyUp(event) {
        const control = keyToControl(event.key);
        if (control) {
            event.preventDefault();
            keys[control] = false;
        }
    }

    function bindMobileControls() {
        document.querySelectorAll('[data-control]').forEach((button) => {
            const control = button.dataset.control;
            const release = (event) => {
                event.preventDefault();
                keys[control] = false;
                button.classList.remove('active');
            };

            button.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                if (gameState !== 'racing') return;
                button.setPointerCapture?.(event.pointerId);
                keys[control] = true;
                button.classList.add('active');
            });
            button.addEventListener('pointerup', release);
            button.addEventListener('pointercancel', release);
            button.addEventListener('lostpointercapture', () => {
                keys[control] = false;
                button.classList.remove('active');
            });
        });
    }

    function bindTeamSelection() {
        document.querySelectorAll('.team-btn').forEach((button) => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.team-btn').forEach((candidate) => {
                    const selected = candidate === button;
                    candidate.classList.toggle('selected', selected);
                    candidate.setAttribute('aria-pressed', String(selected));
                });

                selectedTeamColor = button.dataset.color;
                selectedTeamName = button.dataset.name;
                initRace({ preview: true });
            });
        });
    }

    function bindEvents() {
        bindTeamSelection();
        bindMobileControls();

        ui.startBtn.addEventListener('click', () => {
            initRace();
            startCountdown();
        });

        ui.restartBtn.addEventListener('click', () => {
            ui.finishScreen.classList.add('hidden');
            initRace();
            startCountdown();
        });

        ui.changeTeamBtn.addEventListener('click', returnToGrid);
        ui.pauseBtn.addEventListener('click', () => togglePause(true));
        ui.resumeBtn.addEventListener('click', () => togglePause(false));
        ui.quitBtn.addEventListener('click', returnToGrid);

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleKeyUp, { passive: false });
        window.addEventListener('blur', () => {
            resetInputs();
            if (gameState === 'racing') togglePause(true);
        });
        window.addEventListener('resize', resizeCanvas, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                resetInputs();
                if (gameState === 'racing') togglePause(true);
            }
        });

        const themeObserver = new MutationObserver((mutations) => {
            if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
                renderStaticScene();
            }
        });
        themeObserver.observe(document.documentElement, { attributes: true });
    }

    function initialize() {
        resizeCanvas();
        initRace({ preview: true });
        bindEvents();
        updateHUD();
        lastFrameTime = performance.now();
        animationFrame = requestAnimationFrame(gameLoop);
    }

    initialize();

    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationFrame);
    });
})();
