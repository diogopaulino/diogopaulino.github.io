(() => {
    'use strict';

    // --- DOM & CANVAS REFERENCES ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');

    // Static track canvas buffer
    const staticCanvas = document.createElement('canvas');
    const staticCtx = staticCanvas.getContext('2d');

    // Persistent skid marks canvas buffer
    const skidCanvas = document.createElement('canvas');
    const skidCtx = skidCanvas.getContext('2d');

    const ui = {
        startScreen: document.getElementById('startScreen'),
        optionsModal: document.getElementById('optionsModal'),
        countdownOverlay: document.getElementById('countdownOverlay'),
        countdownText: document.getElementById('countdownText'),
        finishScreen: document.getElementById('finishScreen'),
        pauseScreen: document.getElementById('pauseScreen'),
        rainOverlay: document.getElementById('rainOverlay'),
        startBtn: document.getElementById('startBtn'),
        startOptionsBtn: document.getElementById('startOptionsBtn'),
        pauseOptionsBtn: document.getElementById('pauseOptionsBtn'),
        optionsBtn: document.getElementById('optionsBtn'),
        cameraToggleBtn: document.getElementById('cameraToggleBtn'),
        closeOptionsBtn: document.getElementById('closeOptionsBtn'),
        resetRecordsBtn: document.getElementById('resetRecordsBtn'),
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
        announcement: document.getElementById('raceAnnouncement'),
        drsBadge: document.getElementById('drsBadge'),
        ersBadge: document.getElementById('ersBadge'),
        ersFill: document.getElementById('ersFill'),
        hudTireLabel: document.getElementById('hudTireLabel'),
        minimapTrackName: document.getElementById('minimapTrackName'),
        sfxVolumeSlider: document.getElementById('sfxVolumeSlider'),
        engineAudioToggle: document.getElementById('engineAudioToggle'),
        cameraModeSelect: document.getElementById('cameraModeSelect'),
        difficultySelect: document.getElementById('difficultySelect')
    };

    // --- GAME CONSTANTS ---
    const TOTAL_LAPS = 3;
    const BASE_MAX_SPEED = 340;
    const MAX_RPM = 15000;
    const STORAGE_KEY_SETTINGS = 'f1_racing_pro_settings_v1';
    const STORAGE_KEY_BESTS = 'f1_racing_pro_bests_v1';

    const teams = [
        { color: '#ff2b24', name: 'Ferrari', number: '16' },
        { color: '#27f4d2', name: 'Mercedes', number: '63' },
        { color: '#3671C6', name: 'Red Bull', number: '01' },
        { color: '#ff8700', name: 'McLaren', number: '04' },
        { color: '#229971', name: 'Aston Martin', number: '14' },
        { color: '#0093cc', name: 'Alpine', number: '10' }
    ];

    const tires = {
        soft: { name: 'SOFT', color: '#ff3333', grip: 1.12, wear: 1.0 },
        medium: { name: 'MEDIUM', color: '#ffcc00', grip: 1.0, wear: 1.0 },
        hard: { name: 'HARD', color: '#ffffff', grip: 0.92, wear: 1.0 },
        wet: { name: 'WET', color: '#3399ff', grip: 1.05, wear: 1.0 }
    };

    // --- LOCALSTORAGE & OPTIONS SYSTEM ---
    let settings = loadSettings();
    let personalBests = loadPersonalBests();

    function getDefaultSettings() {
        return {
            sfxVolume: 80,
            engineAudio: true,
            cameraMode: 'chase',
            difficulty: 'pro',
            selectedTeamName: 'Ferrari',
            selectedTeamColor: '#ff2b24',
            selectedTrack: 'monza',
            selectedTire: 'soft',
            weather: 'dry'
        };
    }

    function loadSettings() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
            return data ? { ...getDefaultSettings(), ...JSON.parse(data) } : getDefaultSettings();
        } catch (e) {
            return getDefaultSettings();
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
        } catch (e) { }
    }

    function loadPersonalBests() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_BESTS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    function getPersonalBest(trackKey) {
        return personalBests[trackKey] || Infinity;
    }

    function savePersonalBest(trackKey, time) {
        if (!Number.isFinite(time) || time <= 0) return;
        const current = getPersonalBest(trackKey);
        if (time < current) {
            personalBests[trackKey] = time;
            try {
                localStorage.setItem(STORAGE_KEY_BESTS, JSON.stringify(personalBests));
            } catch (e) { }
        }
    }

    // --- PROCEDURAL WEB AUDIO API SYNTHESIZER ---
    let audioCtx = null;
    let engineOsc = null;
    let engineOsc2 = null;
    let engineFilter = null;
    let engineGain = null;
    let screechNoise = null;
    let screechGain = null;
    let masterGain = null;
    let audioInitialized = false;

    function initAudio() {
        if (audioInitialized) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();

            masterGain = audioCtx.createGain();
            masterGain.gain.value = (settings.sfxVolume / 100) * 0.35;
            masterGain.connect(audioCtx.destination);

            // Engine synthesis oscillators
            engineOsc = audioCtx.createOscillator();
            engineOsc2 = audioCtx.createOscillator();
            engineFilter = audioCtx.createBiquadFilter();
            engineGain = audioCtx.createGain();

            engineOsc.type = 'sawtooth';
            engineOsc2.type = 'square';

            engineFilter.type = 'lowpass';
            engineFilter.frequency.value = 400;

            engineOsc.connect(engineFilter);
            engineOsc2.connect(engineFilter);
            engineFilter.connect(engineGain);
            engineGain.connect(masterGain);

            engineGain.gain.value = 0;
            engineOsc.start();
            engineOsc2.start();

            // Tire screech noise generator
            const bufferSize = audioCtx.sampleRate * 1;
            const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            screechNoise = audioCtx.createBufferSource();
            screechNoise.buffer = noiseBuffer;
            screechNoise.loop = true;

            const screechFilter = audioCtx.createBiquadFilter();
            screechFilter.type = 'bandpass';
            screechFilter.frequency.value = 1200;
            screechFilter.Q.value = 3;

            screechGain = audioCtx.createGain();
            screechGain.gain.value = 0;

            screechNoise.connect(screechFilter);
            screechFilter.connect(screechGain);
            screechGain.connect(masterGain);

            screechNoise.start();
            audioInitialized = true;
        } catch (e) {
            console.warn('Web Audio not supported or blocked:', e);
        }
    }

    function updateAudio(rpm, isAccelerating, isBraking, isDrifting) {
        if (!audioInitialized || !audioCtx || audioCtx.state === 'suspended') return;
        if (!settings.engineAudio) {
            if (engineGain) engineGain.gain.value = 0;
            if (screechGain) screechGain.gain.value = 0;
            return;
        }

        masterGain.gain.value = (settings.sfxVolume / 100) * 0.35;

        // Base RPM frequency synthesis (100Hz to 950Hz)
        const baseFreq = 80 + (rpm / MAX_RPM) * 750;
        engineOsc.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.05);
        engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, audioCtx.currentTime, 0.05);

        const filterFreq = 300 + (rpm / MAX_RPM) * 3500;
        engineFilter.frequency.setTargetAtTime(filterFreq, audioCtx.currentTime, 0.05);

        const targetGain = isAccelerating ? 0.45 : 0.18;
        engineGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.08);

        // Screech audio control
        const targetScreech = (isDrifting || (isBraking && rpm > 4000)) ? 0.35 : 0;
        screechGain.gain.setTargetAtTime(targetScreech, audioCtx.currentTime, 0.05);
    }

    function playShiftSound() {
        if (!audioInitialized || !audioCtx || !settings.engineAudio) return;
        try {
            const popOsc = audioCtx.createOscillator();
            const popGain = audioCtx.createGain();
            popOsc.type = 'square';
            popOsc.frequency.setValueAtTime(150, audioCtx.currentTime);
            popOsc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.08);

            popGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            popGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

            popOsc.connect(popGain);
            popGain.connect(masterGain);
            popOsc.start();
            popOsc.stop(audioCtx.currentTime + 0.09);
        } catch (e) { }
    }

    function playCrashSound() {
        if (!audioInitialized || !audioCtx || !settings.engineAudio) return;
        try {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.25);
            g.gain.setValueAtTime(0.5, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
            osc.connect(g);
            g.connect(masterGain);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.26);
        } catch (e) { }
    }

    // --- STATE VARIABLES ---
    const keys = { up: false, down: false, left: false, right: false, drs: false, boost: false };
    const displayCache = {};

    let gameState = 'menu';
    let player = null;
    let aiCars = [];
    let trackPoints = [];
    let drsZones = [];
    let trackWidth = 80;
    let stageWidth = window.innerWidth;
    let stageHeight = window.innerHeight;
    let pixelRatio = 1;
    let raceTime = 0;
    let lapTimes = [];
    let bestLap = Infinity;
    let lastLapTime = 0;
    let lastFrameTime = performance.now();
    let countdownRun = 0;
    let animationFrame = 0;

    // Camera State for Dynamic Chase Cam
    const camera = {
        x: 0,
        y: 0,
        zoom: 1,
        targetZoom: 1
    };

    // Particle System
    let particles = [];

    // --- TRACK DEFINITION ENGINE ---
    const trackDefinitions = {
        monza: {
            name: 'GP MONZA',
            pointCount: 200,
            generator: (centerX, centerY, rx, ry) => {
                const points = [];
                const n = 200;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2;
                    // Monza style: long main straight, chicane, Curva Grande, Lesmos, Ascari, Parabolica
                    const xShape = 1 + Math.sin(a * 2) * 0.18 + Math.sin(a * 4) * 0.08;
                    const yShape = 1 + Math.cos(a * 1.5) * 0.15 + Math.sin(a * 3) * 0.05;
                    points.push({
                        x: centerX + Math.cos(a) * rx * 1.2 * xShape,
                        y: centerY + Math.sin(a) * ry * 0.85 * yShape
                    });
                }
                return points;
            },
            drsZones: [{ start: 0.95, end: 0.15 }, { start: 0.42, end: 0.62 }]
        },
        spa: {
            name: 'SPA-FRANCORCHAMPS',
            pointCount: 220,
            generator: (centerX, centerY, rx, ry) => {
                const points = [];
                const n = 220;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2;
                    // Spa style: La Source hairpin, Kemmel straight, Pouhon, Stavelot, Bus Stop
                    const xShape = 1 + Math.sin(a * 3) * 0.22 + Math.cos(a * 5) * 0.07;
                    const yShape = 1 + Math.cos(a * 2) * 0.25 + Math.sin(a * 4) * 0.09;
                    points.push({
                        x: centerX + Math.cos(a) * rx * 1.1 * xShape,
                        y: centerY + Math.sin(a) * ry * 0.9 * yShape
                    });
                }
                return points;
            },
            drsZones: [{ start: 0.05, end: 0.28 }]
        },
        monaco: {
            name: 'MONACO GP',
            pointCount: 180,
            generator: (centerX, centerY, rx, ry) => {
                const points = [];
                const n = 180;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2;
                    // Monaco style: Tight street circuit, twisty turns, tunnel straight
                    const xShape = 1 + Math.sin(a * 4) * 0.28 + Math.sin(a * 2) * 0.12;
                    const yShape = 1 + Math.cos(a * 3) * 0.28 + Math.sin(a * 6) * 0.08;
                    points.push({
                        x: centerX + Math.cos(a) * rx * 0.95 * xShape,
                        y: centerY + Math.sin(a) * ry * 0.82 * yShape
                    });
                }
                return points;
            },
            drsZones: [{ start: 0.72, end: 0.88 }]
        }
    };

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
        setCanvasSize(skidCanvas, skidCtx, stageWidth, stageHeight, pixelRatio);

        const mapRect = minimapCanvas.getBoundingClientRect();
        setCanvasSize(
            minimapCanvas,
            minimapCtx,
            Math.max(70, mapRect.width || 120),
            Math.max(70, mapRect.height || 120),
            pixelRatio
        );

        generateTrack();

        if (player) {
            repositionCarsToTrack([player, ...aiCars]);
        }
    }

    function generateTrack() {
        const trackDef = trackDefinitions[settings.selectedTrack] || trackDefinitions.monza;
        ui.minimapTrackName.textContent = trackDef.name;

        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2 + 10;
        const radiusX = Math.min(stageWidth * 0.38, 520);
        const radiusY = Math.min(stageHeight * 0.33, 310);

        trackPoints = trackDef.generator(centerX, centerY, radiusX, radiusY);
        drsZones = trackDef.drsZones;
        trackWidth = Math.max(58, Math.min(108, Math.min(stageWidth, stageHeight) * 0.095));

        renderStaticScene();
        skidCtx.clearRect(0, 0, stageWidth, stageHeight);
    }

    function createTrackPath(context) {
        if (!trackPoints.length) return;
        context.beginPath();
        context.moveTo(trackPoints[0].x, trackPoints[0].y);
        for (let i = 1; i <= trackPoints.length; i++) {
            const p = trackPoints[i % trackPoints.length];
            context.lineTo(p.x, p.y);
        }
        context.closePath();
    }

    function renderStaticScene() {
        const grass = settings.weather === 'wet' ? '#0d1510' : '#101812';
        const track = settings.weather === 'wet' ? '#22252c' : '#2d3038';
        const trackHighlight = settings.weather === 'wet' ? '#2c3039' : '#383b44';

        staticCtx.clearRect(0, 0, stageWidth, stageHeight);
        staticCtx.fillStyle = grass;
        staticCtx.fillRect(0, 0, stageWidth, stageHeight);

        // Ambient grass texture gradient
        const grassGlow = staticCtx.createRadialGradient(
            stageWidth * 0.5,
            stageHeight * 0.5,
            20,
            stageWidth * 0.5,
            stageHeight * 0.5,
            Math.max(stageWidth, stageHeight) * 0.7
        );
        grassGlow.addColorStop(0, settings.weather === 'wet' ? 'rgba(30, 50, 40, 0.25)' : 'rgba(50, 82, 52, 0.16)');
        grassGlow.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        staticCtx.fillStyle = grassGlow;
        staticCtx.fillRect(0, 0, stageWidth, stageHeight);

        // Grid lines
        staticCtx.save();
        staticCtx.globalAlpha = 0.05;
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

        // Track outer shadow & gravel runoff
        staticCtx.save();
        staticCtx.lineCap = 'round';
        staticCtx.lineJoin = 'round';

        createTrackPath(staticCtx);
        staticCtx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        staticCtx.lineWidth = trackWidth + 32;
        staticCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        staticCtx.shadowBlur = 24;
        staticCtx.stroke();
        staticCtx.shadowBlur = 0;

        // Red/White Curb Rumble Strips
        createTrackPath(staticCtx);
        staticCtx.strokeStyle = '#e62e2e';
        staticCtx.lineWidth = trackWidth + 14;
        staticCtx.stroke();

        createTrackPath(staticCtx);
        staticCtx.setLineDash([18, 18]);
        staticCtx.strokeStyle = '#ffffff';
        staticCtx.lineWidth = trackWidth + 14;
        staticCtx.stroke();
        staticCtx.setLineDash([]);

        // Main Asphalt Road
        createTrackPath(staticCtx);
        staticCtx.strokeStyle = track;
        staticCtx.lineWidth = trackWidth;
        staticCtx.stroke();

        // Racing Line rubber buildup overlay
        createTrackPath(staticCtx);
        staticCtx.strokeStyle = trackHighlight;
        staticCtx.lineWidth = Math.max(1, trackWidth - 12);
        staticCtx.globalAlpha = 0.75;
        staticCtx.stroke();

        // DRS Zone visual markers on track
        drsZones.forEach((zone) => {
            const startIdx = Math.floor(zone.start * trackPoints.length);
            const endIdx = Math.floor(zone.end * trackPoints.length);
            staticCtx.beginPath();
            for (let i = startIdx; i !== endIdx; i = (i + 1) % trackPoints.length) {
                const pt = trackPoints[i];
                if (i === startIdx) staticCtx.moveTo(pt.x, pt.y);
                else staticCtx.lineTo(pt.x, pt.y);
            }
            staticCtx.strokeStyle = 'rgba(0, 230, 118, 0.35)';
            staticCtx.lineWidth = trackWidth - 4;
            staticCtx.stroke();
        });

        // Track centerline
        createTrackPath(staticCtx);
        staticCtx.setLineDash([4, 22]);
        staticCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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
        for (let r = 0; r < rows; r++) {
            for (let c = -Math.floor(columns / 2); c < Math.ceil(columns / 2); c++) {
                context.fillStyle = (r + c) % 2 === 0 ? '#f7f7f8' : '#111216';
                context.fillRect(c * square, (r - 1.5) * square, square + 0.5, square + 0.5);
            }
        }
        context.restore();
    }

    function drawTracksideDetails(context) {
        context.save();
        context.font = `700 ${Math.max(9, trackWidth * 0.12)}px Orbitron, sans-serif`;
        context.letterSpacing = '2px';
        context.fillStyle = 'rgba(255, 255, 255, 0.22)';
        context.textAlign = 'center';
        const trackDef = trackDefinitions[settings.selectedTrack] || trackDefinitions.monza;
        context.fillText(trackDef.name, stageWidth / 2, stageHeight / 2 + 4);
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

    function isProgressInDrsZone(progress) {
        const norm = normalizeProgress(progress);
        return drsZones.some(z => {
            if (z.start <= z.end) return norm >= z.start && norm <= z.end;
            return norm >= z.start || norm <= z.end;
        });
    }

    function createCar(team, progress, isPlayer = false, gridPosition = 0) {
        const position = getTrackPosition(progress);
        const angle = getTrackAngle(position.index);
        const laneOffset = (gridPosition % 2 === 0 ? -1 : 1) * Math.min(trackWidth * 0.19, 14);

        const difficultyMult = settings.difficulty === 'legend' ? 1.05 : (settings.difficulty === 'rookie' ? 0.88 : 0.96);

        return {
            x: position.x + Math.cos(angle + Math.PI / 2) * laneOffset,
            y: position.y + Math.sin(angle + Math.PI / 2) * laneOffset,
            angle,
            speed: 0,
            gear: 1,
            rpm: 1000,
            progress,
            lap: Math.floor(progress),
            color: team.color,
            name: team.name,
            number: team.number || '00',
            isPlayer,
            trackIndex: position.index,
            targetSpeed: isPlayer ? 0 : (245 + Math.random() * 40) * difficultyMult,
            skillFactor: (0.92 + Math.random() * 0.08) * difficultyMult,
            finished: false,
            // Systems & Dynamics
            drsAvailable: false,
            drsActive: false,
            ersBattery: 100,
            ersActive: false,
            slipstream: 0,
            isBraking: false,
            isDrifting: false
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
        Object.keys(keys).forEach((k) => { keys[k] = false; });
        document.querySelectorAll('.control-pad.active').forEach((btn) => btn.classList.remove('active'));
    }

    function initRace({ preview = false } = {}) {
        generateTrack();
        resetInputs();
        particles = [];

        const playerTeam = teams.find(t => t.name === settings.selectedTeamName) || teams[0];
        player = createCar(playerTeam, 0, true, 0);

        const rivals = teams
            .filter((team) => team.name !== playerTeam.name)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);

        aiCars = rivals.map((team, index) => createCar(team, -0.026 * (index + 1), false, index + 1));

        raceTime = 0;
        lapTimes = [];
        bestLap = Infinity;
        lastLapTime = 0;
        clearDisplayCache();

        ui.hudTireLabel.textContent = tires[settings.selectedTire].name;
        ui.hudTireLabel.className = `tire-value ${settings.selectedTire}`;
        ui.rainOverlay.classList.toggle('hidden', settings.weather !== 'wet');

        if (preview) {
            [player, ...aiCars].forEach((car, index) => {
                car.speed = 0;
                if (index > 0) car.progress = -0.026 * index;
            });
        }
    }

    function clearDisplayCache() {
        Object.keys(displayCache).forEach((k) => delete displayCache[k]);
    }

    function delay(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function startCountdown() {
        initAudio();
        const run = ++countdownRun;
        gameState = 'countdown';
        document.body.classList.remove('race-active', 'race-paused');
        ui.startScreen.classList.add('hidden');
        ui.finishScreen.classList.add('hidden');
        ui.pauseScreen.classList.add('hidden');
        ui.optionsModal.classList.add('hidden');
        ui.countdownOverlay.classList.remove('hidden');

        const lights = [...document.querySelectorAll('.countdown-light')];
        lights.forEach((l) => l.classList.remove('active', 'go'));
        ui.countdownText.textContent = '';

        for (let i = 0; i < lights.length; i++) {
            if (run !== countdownRun) return;
            lights[i].classList.add('active');
            ui.countdownText.textContent = String(lights.length - i);
            await delay(480);
        }

        if (run !== countdownRun) return;
        await delay(280);
        lights.forEach((l) => {
            l.classList.remove('active');
            l.classList.add('go');
        });
        ui.countdownText.textContent = 'VAI!';
        ui.announcement.textContent = 'Largada!';
        await delay(620);

        if (run !== countdownRun) return;
        ui.countdownOverlay.classList.add('hidden');
        lights.forEach((l) => l.classList.remove('go'));
        gameState = 'racing';
        lastFrameTime = performance.now();
        document.body.classList.add('race-active');
    }

    // --- PHYSICS & VEHICLE DYNAMICS ---
    function updatePlayer(deltaTime) {
        if (!player || player.finished) return;
        const dt = deltaTime / 16.667;
        const tireGrip = tires[settings.selectedTire].grip * (settings.weather === 'wet' ? 0.68 : 1.0);

        // DRS Zone Logic
        player.drsAvailable = isProgressInDrsZone(player.progress);
        if (keys.drs && player.drsAvailable) {
            player.drsActive = true;
        } else if (!player.drsAvailable) {
            player.drsActive = false;
        }

        // ERS Boost System
        if (keys.boost && player.ersBattery > 5) {
            player.ersActive = true;
            player.ersBattery = Math.max(0, player.ersBattery - 0.7 * dt);
        } else {
            player.ersActive = false;
            // Recharge battery when braking/coasting
            if (keys.down || (!keys.up && player.speed > 50)) {
                player.ersBattery = Math.min(100, player.ersBattery + 0.35 * dt);
            }
        }

        // Slipstream / Drafting
        let maxSlipstream = 0;
        aiCars.forEach(rival => {
            const dx = rival.x - player.x;
            const dy = rival.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 15 && dist < 140) {
                const angleToRival = Math.atan2(dy, dx);
                if (Math.abs(angleToRival - player.angle) < 0.35) {
                    maxSlipstream = Math.max(maxSlipstream, (140 - dist) / 140);
                }
            }
        });
        player.slipstream = maxSlipstream;

        // Acceleration & Speed Calculation
        let topSpeed = BASE_MAX_SPEED;
        if (player.drsActive) topSpeed += 28;
        if (player.ersActive) topSpeed += 32;
        topSpeed += player.slipstream * 18;

        const accelRate = (1.25 + (player.ersActive ? 0.75 : 0)) * dt;
        const brakeRate = 2.1 * dt;

        player.isBraking = keys.down && player.speed > 0;

        if (keys.up) player.speed += accelRate;
        if (keys.down) {
            if (player.speed > 0) {
                player.speed -= brakeRate;
            } else {
                player.speed -= accelRate * 0.4;
            }
        }

        if (!keys.up && !keys.down) {
            const drag = 0.35 * dt * Math.sign(player.speed);
            player.speed = Math.abs(player.speed) <= Math.abs(drag) ? 0 : player.speed - drag;
        }

        player.speed = Math.max(-42, Math.min(topSpeed, player.speed));

        // Transmission & RPM calculation
        const oldGear = player.gear;
        player.gear = player.speed < -1 ? 'R' : (player.speed < 3 ? 'N' : Math.max(1, Math.min(8, Math.ceil(player.speed / (topSpeed / 8)))));
        if (oldGear !== player.gear && player.gear !== 'N' && player.gear !== 'R') {
            playShiftSound();
        }
        player.rpm = Math.min(MAX_RPM, 1000 + (Math.abs(player.speed) % (topSpeed / 8)) / (topSpeed / 8) * 14000);

        // Steering & Lateral Grip Drift physics
        const speedRatio = Math.min(1, Math.abs(player.speed) / 90);
        const turnRate = 0.044 * (0.35 + speedRatio * 0.65) * tireGrip * dt;
        const direction = player.speed >= 0 ? 1 : -1;

        const prevAngle = player.angle;
        if (keys.left) player.angle -= turnRate * direction;
        if (keys.right) player.angle += turnRate * direction;

        player.isDrifting = Math.abs(player.angle - prevAngle) > 0.03 && player.speed > 160;

        // Position update
        const moveScale = 0.032;
        const move = player.speed * moveScale * dt;
        player.x += Math.cos(player.angle) * move;
        player.y += Math.sin(player.angle) * move;

        keepOnTrack(player);
        updateCarProgress(player);

        // Emit particles
        spawnCarParticles(player);
        updateAudio(player.rpm, keys.up, player.isBraking, player.isDrifting);
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

        car.drsActive = isProgressInDrsZone(car.progress);
        const speedBoost = car.drsActive ? 22 : 0;
        const desiredSpeed = (car.targetSpeed + speedBoost) * (1 - cornerPenalty) * car.skillFactor;

        if (car.speed < desiredSpeed) {
            car.speed += 0.95 * dt;
        } else {
            car.speed -= 1.15 * dt;
        }

        car.speed = Math.max(120, Math.min(BASE_MAX_SPEED * 0.92, car.speed));
        const move = car.speed * 0.032 * dt;
        car.x += Math.cos(car.angle) * move;
        car.y += Math.sin(car.angle) * move;

        keepOnTrack(car);
        updateCarProgress(car);
        spawnCarParticles(car);
    }

    function findClosestTrackPoint(car) {
        let closestIndex = car.trackIndex || 0;
        let minimumDistanceSquared = Infinity;

        for (let offset = -16; offset <= 24; offset++) {
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
            const correction = Math.min(closest.distance - softLimit, trackWidth * 0.18);

            car.x -= Math.cos(correctionAngle) * correction * 0.22;
            car.y -= Math.sin(correctionAngle) * correction * 0.22;
            car.speed *= closest.distance > hardLimit ? 0.92 : 0.975;

            // Chassis scraping sparks when riding curb/grass boundary
            if (car.speed > 180 && Math.random() < 0.4) {
                spawnSparks(car.x, car.y, car.angle);
            }
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
                savePersonalBest(settings.selectedTrack, lapTime);
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

    // --- PARTICLE FX & SKID MARKS ENGINE ---
    function spawnCarParticles(car) {
        // Heavy braking or drifting -> Tire smoke & Skid marks
        if (car.isBraking || car.isDrifting) {
            // Burn skid marks onto static skid canvas
            skidCtx.save();
            skidCtx.strokeStyle = 'rgba(15, 15, 15, 0.25)';
            skidCtx.lineWidth = 4;
            skidCtx.beginPath();
            skidCtx.arc(car.x, car.y, 4, 0, Math.PI * 2);
            skidCtx.stroke();
            skidCtx.restore();

            // Tire smoke particles
            particles.push({
                x: car.x + (Math.random() - 0.5) * 6,
                y: car.y + (Math.random() - 0.5) * 6,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: 3 + Math.random() * 4,
                alpha: 0.6,
                color: '#dddddd',
                life: 1.0,
                decay: 0.03
            });
        }

        // Exhaust backfire / Nitro flames
        if (car.ersActive || (car.isPlayer && keys.up && car.rpm > 13500 && Math.random() < 0.3)) {
            const rearX = car.x - Math.cos(car.angle) * 16;
            const rearY = car.y - Math.sin(car.angle) * 16;
            particles.push({
                x: rearX,
                y: rearY,
                vx: -Math.cos(car.angle) * 3 + (Math.random() - 0.5) * 1,
                vy: -Math.sin(car.angle) * 3 + (Math.random() - 0.5) * 1,
                radius: 2 + Math.random() * 3,
                alpha: 0.9,
                color: car.ersActive ? '#00f2fe' : (Math.random() < 0.5 ? '#ffaa00' : '#ff3300'),
                life: 1.0,
                decay: 0.1
            });
        }

        // Wet weather tire water spray
        if (settings.weather === 'wet' && car.speed > 100 && Math.random() < 0.5) {
            const rearX = car.x - Math.cos(car.angle) * 14;
            const rearY = car.y - Math.sin(car.angle) * 14;
            particles.push({
                x: rearX + (Math.random() - 0.5) * 10,
                y: rearY + (Math.random() - 0.5) * 10,
                vx: -Math.cos(car.angle) * 2,
                vy: -Math.sin(car.angle) * 2,
                radius: 4 + Math.random() * 5,
                alpha: 0.3,
                color: 'rgba(200, 225, 255, 0.4)',
                life: 1.0,
                decay: 0.04
            });
        }
    }

    function spawnSparks(x, y, angle) {
        for (let i = 0; i < 4; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 4 - Math.cos(angle) * 2,
                vy: (Math.random() - 0.5) * 4 - Math.sin(angle) * 2,
                radius: 1 + Math.random() * 2,
                alpha: 1.0,
                color: '#ffee33',
                life: 1.0,
                decay: 0.08
            });
        }
    }

    function updateAndDrawParticles() {
        ctx.save();
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.alpha = Math.max(0, p.life);

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }
        ctx.restore();
    }

    // --- ULTRA-HIGH-DEFINITION PHOTOREALISTIC F1 CAR SPRITE RENDERER ---
    function drawCar(car) {
        const carLength = car.isPlayer ? 42 : 36;
        const carWidth = car.isPlayer ? 18 : 15;

        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        // 1. DYNAMIC REALISTIC AMBIENT & DIRECTIONAL SHADOW
        ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
        ctx.beginPath();
        ctx.ellipse(-2, 4, carLength * 0.65, carWidth * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. SUSPENSION WISHBONES (Double Wishbone Arms)
        ctx.strokeStyle = '#22252c';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        // Front suspension arms
        ctx.moveTo(carLength * 0.28, 0);
        ctx.lineTo(carLength * 0.22, -carWidth * 0.75);
        ctx.moveTo(carLength * 0.18, 0);
        ctx.lineTo(carLength * 0.22, -carWidth * 0.75);
        ctx.moveTo(carLength * 0.28, 0);
        ctx.lineTo(carLength * 0.22, carWidth * 0.75);
        ctx.moveTo(carLength * 0.18, 0);
        ctx.lineTo(carLength * 0.22, carWidth * 0.75);
        // Rear suspension arms
        ctx.moveTo(-carLength * 0.32, 0);
        ctx.lineTo(-carLength * 0.46, -carWidth * 0.8);
        ctx.moveTo(-carLength * 0.32, 0);
        ctx.lineTo(-carLength * 0.46, carWidth * 0.8);
        ctx.stroke();

        // 3. TIRES & ALLOY RIMS (Pirelli Performance Slicks with Tread & Disc Brake Glow)
        const tireColor = tires[settings.selectedTire].color;
        const drawTire = (x, y, w, h, isRear = false) => {
            // Rubber tire body
            ctx.fillStyle = '#0f1014';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 2);
            ctx.fill();

            // Tire sidewall Pirelli color band
            ctx.strokeStyle = tireColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Tread / Center rubber groove details
            ctx.strokeStyle = '#1d2028';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + 2, y + h * 0.5);
            ctx.lineTo(x + w - 2, y + h * 0.5);
            ctx.stroke();

            // Metallic Alloy Rim Center
            const rimGradient = ctx.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, w / 2);
            rimGradient.addColorStop(0, '#888d9a');
            rimGradient.addColorStop(0.5, '#3a3e49');
            rimGradient.addColorStop(1, '#15171d');
            ctx.fillStyle = rimGradient;
            ctx.fillRect(x + 2, y + 1, w - 4, h - 2);

            // Glowing Brake Disc & Red Hot Caliper under hard braking
            if (car.isBraking) {
                ctx.fillStyle = '#ff3300';
                ctx.shadowColor = '#ff3300';
                ctx.shadowBlur = 8;
                ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
                ctx.shadowBlur = 0;
            }
        };

        // Front Tires
        drawTire(carLength * 0.20, -carWidth * 0.82, 9, 6);
        drawTire(carLength * 0.20, carWidth * 0.48, 9, 6);

        // Rear Tires (Wider Performance Rubber)
        drawTire(-carLength * 0.50, -carWidth * 0.88, 11, 7, true);
        drawTire(-carLength * 0.50, carWidth * 0.46, 11, 7, true);

        // 4. CARBON FIBER UNDERFLOOR & REAR DIFFUSER
        ctx.fillStyle = '#0a0b0e';
        ctx.beginPath();
        ctx.roundRect(-carLength * 0.56, -carWidth * 0.62, carLength * 1.05, carWidth * 1.24, 4);
        ctx.fill();

        // 5. MAIN CHASSIS LIVERY & METALLIC GLOSS PAINT SHADER
        if (car.isPlayer) {
            ctx.shadowColor = car.color;
            ctx.shadowBlur = 18;
        }

        const bodyGradient = ctx.createLinearGradient(-carLength / 2, -carWidth / 2, carLength / 2, carWidth / 2);
        bodyGradient.addColorStop(0, shadeColor(car.color, -40));
        bodyGradient.addColorStop(0.35, car.color);
        bodyGradient.addColorStop(0.70, shadeColor(car.color, 35));
        bodyGradient.addColorStop(1, '#111216');

        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.moveTo(carLength * 0.68, 0); // Sharp aerodynamic nose tip
        ctx.lineTo(carLength * 0.34, -carWidth * 0.44);
        ctx.lineTo(carLength * 0.05, -carWidth * 0.52);
        ctx.lineTo(-carLength * 0.32, -carWidth * 0.50);
        ctx.lineTo(-carLength * 0.55, -carWidth * 0.32);
        ctx.lineTo(-carLength * 0.62, 0); // Engine tail end
        ctx.lineTo(-carLength * 0.55, carWidth * 0.32);
        ctx.lineTo(-carLength * 0.32, carWidth * 0.50);
        ctx.lineTo(carLength * 0.05, carWidth * 0.52);
        ctx.lineTo(carLength * 0.34, carWidth * 0.44);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular Sun Reflection Highlight Line along Body Spine
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(carLength * 0.62, 0);
        ctx.lineTo(-carLength * 0.40, 0);
        ctx.stroke();

        // Sidepod Air Intake Scoops & Aerodynamic Vanes
        ctx.fillStyle = '#06070a';
        ctx.beginPath();
        ctx.ellipse(carLength * 0.06, -carWidth * 0.34, 6, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(carLength * 0.06, carWidth * 0.34, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 6. MULTI-ELEMENT FRONT WING & CARBON ENDPLATES
        ctx.fillStyle = '#0d0e12';
        ctx.fillRect(carLength * 0.44, -carWidth * 0.78, 5, carWidth * 1.56);
        ctx.fillStyle = car.color;
        ctx.fillRect(carLength * 0.47, -carWidth * 0.80, 2, carWidth * 1.60);
        // Winglet Endplates
        ctx.fillStyle = '#fff';
        ctx.fillRect(carLength * 0.44, -carWidth * 0.82, 6, 2);
        ctx.fillRect(carLength * 0.44, carWidth * 0.80, 6, 2);

        // 7. COCKPIT, HALO SAFETY SYSTEM & DRIVER HELMET
        ctx.fillStyle = '#050608';
        ctx.beginPath();
        ctx.ellipse(4, 0, 7.5, carWidth * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        // Driver Helmet & Visor
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.arc(2, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00f2fe';
        ctx.fillRect(3, -1.8, 2.2, 3.6);

        // Halo Safety Ring Pillar Frame
        ctx.strokeStyle = '#1e212b';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(4, 0, 6, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
        ctx.fillStyle = '#1e212b';
        ctx.fillRect(9, -1, 3, 2); // Center halo mounting stalk

        // 8. ACTIVE DRS REAR WING & FLAP MECHANISM
        const drsGap = car.drsActive ? 5 : 0;
        ctx.fillStyle = '#0a0b0e';
        ctx.fillRect(-carLength * 0.60 - drsGap, -carWidth * 0.68, 3.5, carWidth * 1.36);
        ctx.fillStyle = car.color;
        ctx.fillRect(-carLength * 0.57, -carWidth * 0.68, 2.5, carWidth * 1.36);

        // Rear Wing Endplates
        ctx.fillStyle = '#111';
        ctx.fillRect(-carLength * 0.63 - drsGap, -carWidth * 0.72, 6, 2.5);
        ctx.fillRect(-carLength * 0.63 - drsGap, carWidth * 0.69, 6, 2.5);

        // 9. REAR LED RAIN / BRAKE / ERS SAFETY LIGHT
        const flash = Math.floor(performance.now() / 140) % 2 === 0;
        if (settings.weather === 'wet' || car.isBraking || car.ersActive || flash) {
            ctx.fillStyle = car.ersActive ? '#00f2fe' : '#ff0000';
            ctx.shadowColor = car.ersActive ? '#00f2fe' : '#ff0000';
            ctx.shadowBlur = 12;
            ctx.fillRect(-carLength * 0.63, -1.8, 3, 3.6);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    function shadeColor(hex, amount) {
        const normalized = (hex || '#ff2b24').replace('#', '');
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
        const bounds = trackPoints.reduce((acc, pt) => ({
            minX: Math.min(acc.minX, pt.x),
            maxX: Math.max(acc.maxX, pt.x),
            minY: Math.min(acc.minY, pt.y),
            maxY: Math.max(acc.maxY, pt.y)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

        const sourceWidth = bounds.maxX - bounds.minX;
        const sourceHeight = bounds.maxY - bounds.minY;
        const scale = Math.min((mapWidth - padding * 2) / sourceWidth, (mapHeight - padding * 2) / sourceHeight);
        const offsetX = (mapWidth - sourceWidth * scale) / 2 - bounds.minX * scale;
        const offsetY = (mapHeight - sourceHeight * scale) / 2 - bounds.minY * scale;

        minimapCtx.lineCap = 'round';
        minimapCtx.lineJoin = 'round';
        minimapCtx.beginPath();
        trackPoints.forEach((pt, i) => {
            const x = offsetX + pt.x * scale;
            const y = offsetY + pt.y * scale;
            if (i === 0) minimapCtx.moveTo(x, y);
            else minimapCtx.lineTo(x, y);
        });
        minimapCtx.closePath();
        minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        minimapCtx.lineWidth = 5;
        minimapCtx.stroke();
        minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        minimapCtx.lineWidth = 1.4;
        minimapCtx.stroke();

        [player, ...aiCars].forEach((car) => {
            const x = offsetX + car.x * scale;
            const y = offsetY + car.y * scale;
            minimapCtx.beginPath();
            minimapCtx.arc(x, y, car.isPlayer ? 3.8 : 2.5, 0, Math.PI * 2);
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
        const playerPosition = positions.findIndex((c) => c.isPlayer) + 1;
        const displaySpeed = Math.round(Math.abs(player.speed));
        const lapNumber = Math.max(1, Math.min(TOTAL_LAPS, player.lap + 1));
        const currentBest = Math.min(bestLap, getPersonalBest(settings.selectedTrack));

        updateText(ui.position, 'position', String(playerPosition));
        updateText(ui.lap, 'lap', String(lapNumber));
        updateText(ui.speed, 'speed', String(displaySpeed));
        updateText(ui.gear, 'gear', String(player.gear));
        updateText(ui.time, 'time', formatTime(raceTime));
        updateText(ui.bestLap, 'bestLap', Number.isFinite(currentBest) ? formatTime(currentBest) : '--:--.--');

        const speedPercent = Math.min(1, displaySpeed / (BASE_MAX_SPEED + 60));
        ui.speedArc.style.strokeDasharray = `${245 * speedPercent} 327`;
        ui.rpmBar.style.width = `${(player.rpm / MAX_RPM) * 100}%`;
        ui.raceProgress.style.width = `${Math.max(0, Math.min(100, (player.progress / TOTAL_LAPS) * 100))}%`;

        // Telemetry lights
        const litLights = Math.round((player.rpm / MAX_RPM) * ui.rpmLights.length);
        ui.rpmLights.forEach((light, index) => {
            light.classList.toggle('active', index < litLights);
            light.classList.toggle('hot', index >= 5 && index < litLights);
            light.classList.toggle('limit', index >= 7 && index < litLights);
        });

        // ERS Battery gauge & Systems status
        ui.ersFill.style.width = `${player.ersBattery}%`;

        if (player.drsActive) {
            ui.drsBadge.className = 'system-badge drs-active';
            ui.drsBadge.textContent = 'DRS ATIVO';
        } else if (player.drsAvailable) {
            ui.drsBadge.className = 'system-badge drs-available';
            ui.drsBadge.textContent = 'DRS DISPONÍVEL (E)';
        } else {
            ui.drsBadge.className = 'system-badge drs-disabled';
            ui.drsBadge.textContent = 'DRS INDISPONÍVEL';
        }

        if (player.ersActive) {
            ui.ersBadge.className = 'system-badge ers-active';
            ui.ersBadge.textContent = 'BOOST ATIVO';
        } else {
            ui.ersBadge.className = 'system-badge ers-ready';
            ui.ersBadge.textContent = 'ERS PRONTO';
        }
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
        const title = playerPosition === 1 ? 'Vitória Extraordinária!' : (playerPosition <= 3 ? 'Pódio Garantido!' : 'Bandeirada');

        gameState = 'finished';
        resetInputs();
        document.body.classList.remove('race-active', 'race-paused');
        ui.finishTitle.textContent = title;
        ui.finishTeam.textContent = `${settings.selectedTeamName} · ${trackDefinitions[settings.selectedTrack].name}`;
        ui.finalPosition.textContent = `${playerPosition}º`;
        ui.finalBestLap.textContent = Number.isFinite(bestLap) ? formatTime(bestLap) : '--:--.--';
        ui.finalTime.textContent = formatTime(raceTime);
        ui.finishScreen.classList.remove('hidden');
        ui.announcement.textContent = `${title}. Posição final: ${playerPosition} de 5.`;
    }

    // --- MAIN RENDER FRAME & CAMERA LOGIC ---
    function drawFrame() {
        ctx.clearRect(0, 0, stageWidth, stageHeight);

        ctx.save();

        // Dynamic Chase Camera vs Full Circuit View
        if (settings.cameraMode === 'chase' && player) {
            const targetX = player.x + Math.cos(player.angle) * player.speed * 0.15;
            const targetY = player.y + Math.sin(player.angle) * player.speed * 0.15;

            camera.x += (targetX - camera.x) * 0.08;
            camera.y += (targetY - camera.y) * 0.08;

            const speedRatio = Math.abs(player.speed) / BASE_MAX_SPEED;
            camera.targetZoom = 1.0 - speedRatio * 0.22;
            camera.zoom += (camera.targetZoom - camera.zoom) * 0.05;

            ctx.translate(stageWidth / 2, stageHeight / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-camera.x, -camera.y);
        }

        // 1. Draw static asphalt track
        ctx.drawImage(staticCanvas, 0, 0, stageWidth, stageHeight);

        // 2. Draw persistent rubber skid marks
        ctx.drawImage(skidCanvas, 0, 0, stageWidth, stageHeight);

        // 3. Draw particles (tire smoke, sparks, exhaust flames, spray)
        updateAndDrawParticles();

        // 4. Draw Cars
        if (player) {
            [...aiCars, player]
                .sort((first, second) => first.y - second.y)
                .forEach(drawCar);
        }

        ctx.restore();

        // 5. Minimap
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
        countdownRun++;
        gameState = 'menu';
        resetInputs();
        document.body.classList.remove('race-active', 'race-paused');
        ui.countdownOverlay.classList.add('hidden');
        ui.pauseScreen.classList.add('hidden');
        ui.finishScreen.classList.add('hidden');
        ui.optionsModal.classList.add('hidden');
        ui.startScreen.classList.remove('hidden');
        initRace({ preview: true });
    }

    function toggleOptionsModal(show) {
        if (typeof show !== 'boolean') show = ui.optionsModal.classList.contains('hidden');

        if (show) {
            ui.sfxVolumeSlider.value = settings.sfxVolume;
            ui.engineAudioToggle.checked = settings.engineAudio;
            ui.cameraModeSelect.value = settings.cameraMode;
            ui.difficultySelect.value = settings.difficulty;
            ui.optionsModal.classList.remove('hidden');
        } else {
            settings.sfxVolume = Number(ui.sfxVolumeSlider.value);
            settings.engineAudio = ui.engineAudioToggle.checked;
            settings.cameraMode = ui.cameraModeSelect.value;
            settings.difficulty = ui.difficultySelect.value;
            saveSettings();
            ui.optionsModal.classList.add('hidden');
        }
    }

    function keyToControl(key) {
        const normalized = key.toLowerCase();
        if (normalized === 'arrowup' || normalized === 'w') return 'up';
        if (normalized === 'arrowdown' || normalized === 's') return 'down';
        if (normalized === 'arrowleft' || normalized === 'a') return 'left';
        if (normalized === 'arrowright' || normalized === 'd') return 'right';
        if (normalized === 'e') return 'drs';
        if (normalized === ' ' || normalized === 'shift') return 'boost';
        return null;
    }

    function handleKeyDown(event) {
        const control = keyToControl(event.key);
        if (control) {
            event.preventDefault();
            if (gameState === 'racing') keys[control] = true;
            return;
        }

        if (event.key.toLowerCase() === 'c' && !event.repeat) {
            settings.cameraMode = settings.cameraMode === 'chase' ? 'full' : 'chase';
            saveSettings();
            return;
        }

        if (event.key.toLowerCase() === 'o' && !event.repeat) {
            toggleOptionsModal();
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
                initAudio();
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

    function bindStartScreenControls() {
        // Track selection
        document.querySelectorAll('.track-btn').forEach((btn) => {
            if (btn.dataset.track === settings.selectedTrack) btn.classList.add('selected');
            else btn.classList.remove('selected');

            btn.addEventListener('click', () => {
                document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                settings.selectedTrack = btn.dataset.track;
                saveSettings();
                initRace({ preview: true });
            });
        });

        // Team selection
        document.querySelectorAll('.team-btn').forEach((btn) => {
            const isSelected = btn.dataset.name === settings.selectedTeamName;
            btn.classList.toggle('selected', isSelected);
            btn.setAttribute('aria-pressed', String(isSelected));

            btn.addEventListener('click', () => {
                document.querySelectorAll('.team-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('selected');
                btn.setAttribute('aria-pressed', 'true');
                settings.selectedTeamName = btn.dataset.name;
                settings.selectedTeamColor = btn.dataset.color;
                saveSettings();
                initRace({ preview: true });
            });
        });

        // Tire selection
        document.querySelectorAll('.tire-btn').forEach((btn) => {
            btn.classList.toggle('selected', btn.dataset.tire === settings.selectedTire);
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tire-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                settings.selectedTire = btn.dataset.tire;
                saveSettings();
            });
        });

        // Weather selection
        document.querySelectorAll('.weather-btn').forEach((btn) => {
            btn.classList.toggle('selected', btn.dataset.weather === settings.weather);
            btn.addEventListener('click', () => {
                document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                settings.weather = btn.dataset.weather;
                saveSettings();
                initRace({ preview: true });
            });
        });
    }

    function bindEvents() {
        bindStartScreenControls();
        bindMobileControls();

        ui.startBtn.addEventListener('click', () => {
            initRace();
            startCountdown();
        });

        ui.startOptionsBtn.addEventListener('click', () => toggleOptionsModal(true));
        ui.optionsBtn.addEventListener('click', () => toggleOptionsModal(true));
        ui.pauseOptionsBtn.addEventListener('click', () => toggleOptionsModal(true));
        ui.closeOptionsBtn.addEventListener('click', () => toggleOptionsModal(false));

        ui.cameraToggleBtn.addEventListener('click', () => {
            settings.cameraMode = settings.cameraMode === 'chase' ? 'full' : 'chase';
            saveSettings();
        });

        ui.resetRecordsBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente apagar todos os tempos e recordes salvos?')) {
                personalBests = {};
                localStorage.removeItem(STORAGE_KEY_BESTS);
                alert('Recordes restaurados!');
            }
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
