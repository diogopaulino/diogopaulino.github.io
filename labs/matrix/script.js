/**
 * Matrix - chuva digital.
 *
 * Renderização: os glifos são pré-desenhados uma única vez num atlas offscreen
 * (espelhados na horizontal, como a fonte usada no filme) e depois compostos
 * com drawImage, o que permite milhares de células por frame sem custo de texto.
 * Cada camada guarda os glifos numa grade fixa: os streams só controlam a
 * posição da cabeça, então glifos que já passaram continuam mutando no lugar.
 */
(function () {
    'use strict';

    const canvas = document.getElementById('matrix');
    const ctx = canvas.getContext('2d', { alpha: false });
    const bloomCanvas = document.createElement('canvas');
    const bloomCtx = bloomCanvas.getContext('2d');

    const STORAGE_KEY = 'labs:matrix:v1';
    const FONT_STACK = "'MS Gothic', 'Osaka-Mono', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Noto Sans JP', monospace";
    const ATLAS_COLS = 12;
    const CELL_RATIO = 1.12;

    const GLYPH_SETS = {
        matrix: 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍｦｲｸｺｿﾁﾄﾉﾌﾔﾖﾙﾚﾛﾝ0123456789:."=*+-<>¦｜ç',
        kana: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
        binary: '01',
        latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        terminal: '<>[]{}()/\\|=+-*#@$%&!?:;.,^~_'
    };

    const PRESETS = {
        matrix: { body: '#00ff41', head: '#d8ffe2', glow: '#00ff41', bg: '#000300' },
        reloaded: { body: '#8fff2b', head: '#f4ffd8', glow: '#b6ff3d', bg: '#010400' },
        nabucodonosor: { body: '#ffb000', head: '#fff2cf', glow: '#ff8a00', bg: '#070300' },
        sentinela: { body: '#ff2d2d', head: '#ffdbdb', glow: '#ff0033', bg: '#080000' },
        pilulaazul: { body: '#2ea8ff', head: '#dcefff', glow: '#0077ff', bg: '#000308' },
        fantasma: { body: '#c8f7ff', head: '#ffffff', glow: '#9fe8ff', bg: '#000203' }
    };

    // Camadas de profundidade: as de trás são menores, mais lentas e mais fracas.
    const DEPTH_LAYERS = {
        1: [{ scale: 1, alpha: 1, speed: 1 }],
        2: [
            { scale: 0.62, alpha: 0.32, speed: 0.7 },
            { scale: 1, alpha: 1, speed: 1 }
        ],
        3: [
            { scale: 0.44, alpha: 0.18, speed: 0.52 },
            { scale: 0.68, alpha: 0.4, speed: 0.76 },
            { scale: 1, alpha: 1, speed: 1 }
        ]
    };

    const DEFAULTS = {
        preset: 'matrix',
        glyphSet: 'matrix',
        depth: 2,
        speed: 1,
        fontSize: 16,
        trail: 1,
        density: 100,
        mutation: 1,
        glow: 1,
        mirror: true,
        flicker: true,
        scanlines: true,
        vignette: true,
        sound: false,
        message: ''
    };

    const settings = Object.assign({}, DEFAULTS, loadSettings());

    let dpr = 1;
    let width = 0;
    let height = 0;
    let glyphs = [];
    let layers = [];
    let pulses = [];
    let messageStreams = [];
    let messageTimer = 2;
    let paused = false;
    let rafId = 0;
    let lastTime = 0;
    let fpsAccum = 0;
    let fpsFrames = 0;
    let scanPattern = null;
    let vignetteGrad = null;

    const atlas = {
        body: document.createElement('canvas'),
        head: document.createElement('canvas'),
        tile: 0,
        advance: 0
    };
    const atlasBodyCtx = atlas.body.getContext('2d');
    const atlasHeadCtx = atlas.head.getContext('2d');

    // Queda do brilho ao longo do rastro, pré-calculada.
    const FALLOFF = new Float32Array(129);
    for (let i = 0; i <= 128; i++) {
        FALLOFF[i] = Math.pow(1 - i / 128, 1.55);
    }

    /* ------------------------------------------------------------------ */
    /* Persistência                                                        */
    /* ------------------------------------------------------------------ */

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (err) {
            return {};
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (err) {
            /* localStorage pode estar indisponível em navegação privada. */
        }
    }

    /* ------------------------------------------------------------------ */
    /* Atlas de glifos                                                     */
    /* ------------------------------------------------------------------ */

    function preset() {
        return PRESETS[settings.preset] || PRESETS.matrix;
    }

    function randGlyph() {
        return (Math.random() * glyphs.length) | 0;
    }

    function buildAtlas() {
        glyphs = Array.from(GLYPH_SETS[settings.glyphSet] || GLYPH_SETS.matrix);

        const fontPx = Math.round(settings.fontSize * dpr);
        const pad = Math.ceil(fontPx * 0.45);
        const tile = Math.ceil(fontPx * CELL_RATIO) + pad * 2;
        const rows = Math.ceil(glyphs.length / ATLAS_COLS);
        const colors = preset();

        atlas.tile = tile;

        // Katakana halfwidth ocupa metade de um em: medir o avanço real mantém as
        // colunas justas como no filme, em vez de espalhadas por um em cheio.
        atlasBodyCtx.font = fontPx + 'px ' + FONT_STACK;
        let advance = 0;
        for (let i = 0; i < glyphs.length; i++) {
            const w = atlasBodyCtx.measureText(glyphs[i]).width;
            if (w > advance) advance = w;
        }
        atlas.advance = Math.max(3, advance * 1.06);

        [
            [atlas.body, atlasBodyCtx, colors.body, fontPx * 0.16],
            [atlas.head, atlasHeadCtx, colors.head, fontPx * 0.42]
        ].forEach(function (entry) {
            const surface = entry[0];
            const c = entry[1];
            const color = entry[2];
            const blur = entry[3];

            surface.width = tile * ATLAS_COLS;
            surface.height = tile * rows;
            c.clearRect(0, 0, surface.width, surface.height);
            c.font = fontPx + 'px ' + FONT_STACK;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillStyle = color;
            c.shadowColor = colors.glow;
            c.shadowBlur = blur;

            for (let i = 0; i < glyphs.length; i++) {
                const cx = (i % ATLAS_COLS) * tile + tile / 2;
                const cy = ((i / ATLAS_COLS) | 0) * tile + tile / 2;
                c.save();
                c.translate(cx, cy);
                // A fonte do filme é katakana espelhado na horizontal.
                if (settings.mirror) c.scale(-1, 1);
                c.fillText(glyphs[i], 0, 0);
                c.restore();
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Camadas e streams                                                   */
    /* ------------------------------------------------------------------ */

    function newStream(layer, spread) {
        return {
            x: (Math.random() * layer.cols) | 0,
            y: spread ? Math.random() * layer.rows : -Math.random() * layer.rows * 0.4 - 4,
            speed: 6 + Math.random() * 13,
            len: Math.max(3, Math.round((7 + Math.random() * 22) * settings.trail)),
            bright: 0.68 + Math.random() * 0.32,
            lastRow: -9999
        };
    }

    function seedStreams(layer) {
        const count = Math.max(1, Math.round(layer.cols * (settings.density / 100) * 1.2));
        layer.streams = new Array(count);
        for (let i = 0; i < count; i++) {
            layer.streams[i] = newStream(layer, true);
        }
    }

    function buildLayers() {
        const configs = DEPTH_LAYERS[settings.depth] || DEPTH_LAYERS[2];

        layers = configs.map(function (cfg) {
            const cellW = Math.max(3, atlas.advance * cfg.scale);
            const cellH = Math.max(4, settings.fontSize * dpr * CELL_RATIO * cfg.scale);
            const cols = Math.max(1, Math.ceil(width / cellW));
            const rows = Math.max(1, Math.ceil(height / cellH) + 2);
            const grid = new Uint8Array(cols * rows);

            for (let i = 0; i < grid.length; i++) {
                grid[i] = randGlyph();
            }

            const layer = {
                scale: cfg.scale,
                alpha: cfg.alpha,
                speedMul: cfg.speed,
                cellW: cellW,
                cellH: cellH,
                cols: cols,
                rows: rows,
                grid: grid,
                streams: []
            };
            seedStreams(layer);
            return layer;
        });
    }

    function front() {
        return layers[layers.length - 1];
    }

    /* ------------------------------------------------------------------ */
    /* Dimensionamento                                                     */
    /* ------------------------------------------------------------------ */

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, Math.round(window.innerWidth * dpr));
        height = Math.max(1, Math.round(window.innerHeight * dpr));

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';

        bloomCanvas.width = Math.max(1, Math.round(width / 6));
        bloomCanvas.height = Math.max(1, Math.round(height / 6));

        buildAtlas();
        buildLayers();
        buildOverlays();
    }

    function buildOverlays() {
        const line = document.createElement('canvas');
        const lineCtx = line.getContext('2d');
        const unit = Math.max(2, Math.round(2 * dpr));
        line.width = 1;
        line.height = unit * 2;
        lineCtx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        lineCtx.fillRect(0, 0, 1, unit);
        scanPattern = ctx.createPattern(line, 'repeat');

        const radius = Math.max(width, height) * 0.75;
        vignetteGrad = ctx.createRadialGradient(
            width / 2, height / 2, radius * 0.32,
            width / 2, height / 2, radius
        );
        vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.35)');
        vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
    }

    /* ------------------------------------------------------------------ */
    /* Atualização                                                         */
    /* ------------------------------------------------------------------ */

    function update(dt) {
        for (let l = 0; l < layers.length; l++) {
            const layer = layers[l];
            const step = layer.speedMul * settings.speed * dt;

            for (let s = 0; s < layer.streams.length; s++) {
                const stream = layer.streams[s];
                stream.y += stream.speed * step;

                const head = Math.floor(stream.y);
                if (head !== stream.lastRow) {
                    // Cada nova célula alcançada pela cabeça recebe um glifo novo.
                    if (head >= 0 && head < layer.rows) {
                        layer.grid[head * layer.cols + stream.x] = randGlyph();
                    }
                    stream.lastRow = head;
                }

                if (stream.y - stream.len > layer.rows) {
                    layer.streams[s] = newStream(layer, false);
                }
            }

            // Mutação dos glifos já em tela — é o que faz o código "ferver".
            const mutations = Math.round(layer.grid.length * 0.3 * settings.mutation * dt);
            for (let i = 0; i < mutations; i++) {
                layer.grid[(Math.random() * layer.grid.length) | 0] = randGlyph();
            }
        }

        for (let i = pulses.length - 1; i >= 0; i--) {
            const pulse = pulses[i];
            pulse.r += pulse.speed * dt;
            pulse.life -= dt;
            if (pulse.life <= 0) pulses.splice(i, 1);
        }

        updateMessages(dt);
    }

    function updateMessages(dt) {
        const layer = front();

        if (settings.message) {
            messageTimer -= dt;
            if (messageTimer <= 0) {
                spawnMessage();
                messageTimer = 4 + Math.random() * 5;
            }
        }

        for (let i = messageStreams.length - 1; i >= 0; i--) {
            const stream = messageStreams[i];
            stream.y += stream.speed * settings.speed * dt;
            if (stream.y - stream.chars.length > layer.rows) {
                messageStreams.splice(i, 1);
            }
        }
    }

    function spawnMessage() {
        const text = settings.message.trim().toUpperCase();
        if (!text) return;

        const layer = front();
        messageStreams.push({
            x: (Math.random() * layer.cols) | 0,
            y: -text.length - 2,
            speed: 5 + Math.random() * 4,
            chars: Array.from(text)
        });

        if (messageStreams.length > 4) messageStreams.shift();
    }

    /* ------------------------------------------------------------------ */
    /* Desenho                                                             */
    /* ------------------------------------------------------------------ */

    function draw() {
        const colors = preset();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'lighter';

        for (let l = 0; l < layers.length; l++) {
            drawLayer(layers[l]);
        }

        drawMessages(colors);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        if (settings.glow > 0.05) applyBloom();
        if (settings.scanlines) drawScanlines();
        if (settings.vignette) drawVignette();
    }

    function drawLayer(layer) {
        const tile = atlas.tile;
        const dest = tile * layer.scale;
        const half = dest / 2;
        const cellW = layer.cellW;
        const cellH = layer.cellH;
        const cols = layer.cols;
        const rows = layer.rows;
        const grid = layer.grid;
        const hasPulses = pulses.length > 0;
        const flicker = settings.flicker;

        for (let s = 0; s < layer.streams.length; s++) {
            const stream = layer.streams[s];
            const headRow = Math.floor(stream.y);
            if (headRow < 0) continue;

            const cx = (stream.x + 0.5) * cellW;
            const base = stream.bright * layer.alpha;
            const len = stream.len;

            for (let i = 0; i <= len; i++) {
                const row = headRow - i;
                if (row < 0) break;
                if (row >= rows) continue;

                let a = FALLOFF[((i / len) * 128) | 0] * base;
                const cy = (row + 0.5) * cellH;

                if (hasPulses) a += pulseBoost(cx, cy, row * cols + stream.x, grid);
                if (flicker && Math.random() < 0.016) a *= 0.3;
                if (a <= 0.025) continue;
                if (a > 1) a = 1;

                const gi = grid[row * cols + stream.x];
                const sx = (gi % ATLAS_COLS) * tile;
                const sy = ((gi / ATLAS_COLS) | 0) * tile;

                ctx.globalAlpha = a;
                ctx.drawImage(
                    i === 0 ? atlas.head : atlas.body,
                    sx, sy, tile, tile,
                    cx - half, cy - half, dest, dest
                );
            }
        }
    }

    function pulseBoost(cx, cy, index, grid) {
        let boost = 0;
        for (let p = 0; p < pulses.length; p++) {
            const pulse = pulses[p];
            const dx = cx - pulse.x;
            const dy = cy - pulse.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const k = 1 - Math.abs(d - pulse.r) / pulse.band;
            if (k > 0) {
                boost += k * pulse.life * 0.9;
                if (k > 0.55 && Math.random() < 0.25) grid[index] = randGlyph();
            }
        }
        return boost;
    }

    function drawMessages(colors) {
        if (!messageStreams.length) return;

        const layer = front();
        const fontPx = Math.round(settings.fontSize * dpr);

        ctx.font = fontPx + 'px ' + FONT_STACK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = fontPx * 0.5;

        for (let m = 0; m < messageStreams.length; m++) {
            const stream = messageStreams[m];
            const headRow = Math.floor(stream.y);
            const cx = (stream.x + 0.5) * layer.cellW;
            const total = stream.chars.length;

            for (let i = 0; i < total; i++) {
                const row = headRow - i;
                if (row < 0) break;
                if (row >= layer.rows) continue;

                const a = Math.max(0, 1 - i / (total * 1.35));
                if (a <= 0.03) continue;

                ctx.globalAlpha = a;
                ctx.fillStyle = i === 0 ? colors.head : colors.body;
                // Invertido para a frase ser lida de cima para baixo.
                ctx.fillText(stream.chars[total - 1 - i], cx, (row + 0.5) * layer.cellH);
            }
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    function applyBloom() {
        // Bloom barato: reduz o frame para 1/6, devolve escalado e soma por cima.
        bloomCtx.globalCompositeOperation = 'copy';
        bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.75, 0.3 * settings.glow);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bloomCanvas, 0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawScanlines() {
        if (!scanPattern) return;
        ctx.fillStyle = scanPattern;
        ctx.fillRect(0, 0, width, height);
    }

    function drawVignette() {
        if (!vignetteGrad) return;
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, width, height);
    }

    /* ------------------------------------------------------------------ */
    /* Loop                                                                */
    /* ------------------------------------------------------------------ */

    function frame(now) {
        rafId = requestAnimationFrame(frame);

        if (!lastTime) lastTime = now;
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        fpsAccum += dt;
        fpsFrames++;
        if (fpsAccum >= 0.5) {
            ui.fps.textContent = Math.round(fpsFrames / fpsAccum);
            fpsAccum = 0;
            fpsFrames = 0;
        }

        if (!paused) update(dt);
        draw();
    }

    /* ------------------------------------------------------------------ */
    /* Áudio                                                               */
    /* ------------------------------------------------------------------ */

    const Sound = (function () {
        let actx = null;
        let master = null;
        let nodes = [];

        function ensure() {
            if (actx) return actx;
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            actx = new AC();
            master = actx.createGain();
            master.gain.value = 0;
            master.connect(actx.destination);
            return actx;
        }

        function start() {
            if (!ensure()) return;
            if (actx.state === 'suspended') actx.resume();
            if (nodes.length) {
                master.gain.setTargetAtTime(0.09, actx.currentTime, 0.6);
                return;
            }

            const filter = actx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 240;
            filter.Q.value = 0.7;
            filter.connect(master);

            [55, 82.5, 110].forEach(function (freq, i) {
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = i === 2 ? 'triangle' : 'sawtooth';
                osc.frequency.value = freq;
                osc.detune.value = (i - 1) * 7;
                gain.gain.value = 0.35 / (i + 1);
                osc.connect(gain);
                gain.connect(filter);
                osc.start();
                nodes.push(osc);
            });

            // Respiração lenta do zumbido, para não soar estático.
            const lfo = actx.createOscillator();
            const lfoGain = actx.createGain();
            lfo.frequency.value = 0.07;
            lfoGain.gain.value = 90;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start();
            nodes.push(lfo);

            master.gain.setTargetAtTime(0.09, actx.currentTime, 1.2);
        }

        function stop() {
            if (!actx || !master) return;
            master.gain.setTargetAtTime(0, actx.currentTime, 0.4);
        }

        function blip() {
            if (!actx || !settings.sound) return;
            const t = actx.currentTime;
            const osc = actx.createOscillator();
            const gain = actx.createGain();
            osc.type = 'square';
            osc.frequency.value = 620 + Math.random() * 900;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.04, t + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
            osc.connect(gain);
            gain.connect(master);
            osc.start(t);
            osc.stop(t + 0.07);
        }

        return { start: start, stop: stop, blip: blip };
    })();

    /* ------------------------------------------------------------------ */
    /* Sequência de abertura                                               */
    /* ------------------------------------------------------------------ */

    const BOOT_SEQUENCE = [
        { text: 'Call trans opt: received.', cps: 42, hold: 260 },
        { text: '2-19-98 13:24:18 REC:Log>', cps: 42, hold: 420 },
        { text: 'Trace program: running', cps: 34, hold: 900 },
        { text: 'Wake up, Neo...', cps: 11, hold: 1300 },
        { text: 'The Matrix has you...', cps: 11, hold: 1300 },
        { text: 'Follow the white rabbit.', cps: 12, hold: 1500 }
    ];

    const boot = {
        el: document.getElementById('boot'),
        text: document.getElementById('bootText'),
        skip: document.getElementById('bootSkip'),
        timers: [],
        active: false
    };

    function clearBootTimers() {
        boot.timers.forEach(clearTimeout);
        boot.timers = [];
    }

    function endBoot() {
        if (!boot.active) return;
        boot.active = false;
        clearBootTimers();
        boot.el.classList.add('fading');
        setTimeout(function () {
            boot.el.hidden = true;
            boot.el.classList.remove('fading');
        }, 900);
    }

    function runBoot() {
        clearBootTimers();
        boot.active = true;
        boot.el.hidden = false;
        boot.el.classList.remove('fading');
        boot.text.textContent = '';

        let delay = 500;

        BOOT_SEQUENCE.forEach(function (line, lineIndex) {
            const chars = Array.from(line.text);
            const step = 1000 / line.cps;

            boot.timers.push(setTimeout(function () {
                boot.text.textContent = '';
            }, delay));

            chars.forEach(function (char, i) {
                boot.timers.push(setTimeout(function () {
                    boot.text.textContent += char;
                    if (char !== ' ') Sound.blip();
                }, delay + step * (i + 1)));
            });

            delay += step * (chars.length + 1) + line.hold;

            if (lineIndex === BOOT_SEQUENCE.length - 1) {
                boot.timers.push(setTimeout(endBoot, delay));
            }
        });
    }

    boot.skip.addEventListener('click', endBoot);

    /* ------------------------------------------------------------------ */
    /* Interface                                                           */
    /* ------------------------------------------------------------------ */

    const ui = {
        fps: document.getElementById('fps'),
        streamCount: document.getElementById('streamCount'),
        controls: document.getElementById('controls'),
        toggleControls: document.getElementById('toggleControls'),
        closeControls: document.getElementById('closeControls'),
        cinema: document.getElementById('cinema'),
        cinemaExit: document.getElementById('cinemaExit'),
        fullscreen: document.getElementById('fullscreen'),
        message: document.getElementById('message')
    };

    const SLIDERS = {
        speed: function (v) { return v.toFixed(1) + 'x'; },
        fontSize: function (v) { return Math.round(v) + 'px'; },
        trail: function (v) { return v.toFixed(1) + 'x'; },
        density: function (v) { return Math.round(v) + '%'; },
        mutation: function (v) { return v.toFixed(1) + 'x'; },
        glow: function (v) { return v.toFixed(2) + 'x'; }
    };

    const SWITCHES = ['mirror', 'flicker', 'scanlines', 'vignette', 'sound'];

    function selectGroup(selector, attr, value) {
        document.querySelectorAll(selector).forEach(function (btn) {
            btn.classList.toggle('is-active', btn.dataset[attr] === String(value));
        });
    }

    function applyPresetColors() {
        const colors = preset();
        const root = document.documentElement.style;
        root.setProperty('--mx', colors.body);
        root.setProperty('--mx-glow', hexToRgba(colors.glow, 0.28));
        root.setProperty('--panel-border', hexToRgba(colors.body, 0.16));

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = colors.bg;
    }

    function hexToRgba(hex, alpha) {
        const value = parseInt(hex.slice(1), 16);
        const r = (value >> 16) & 255;
        const g = (value >> 8) & 255;
        const b = value & 255;
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    function syncUI() {
        selectGroup('.preset-btn', 'preset', settings.preset);
        selectGroup('.glyph-btn', 'glyphs', settings.glyphSet);
        selectGroup('.depth-btn', 'depth', settings.depth);

        Object.keys(SLIDERS).forEach(function (key) {
            const input = document.getElementById(key);
            const label = document.getElementById(key + 'Value');
            input.value = settings[key];
            label.textContent = SLIDERS[key](Number(settings[key]));
        });

        SWITCHES.forEach(function (key) {
            document.getElementById(key).checked = Boolean(settings[key]);
        });

        ui.message.value = settings.message;
        applyPresetColors();
    }

    document.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            settings.preset = btn.dataset.preset;
            selectGroup('.preset-btn', 'preset', settings.preset);
            applyPresetColors();
            buildAtlas();
            saveSettings();
        });
    });

    document.querySelectorAll('.glyph-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            settings.glyphSet = btn.dataset.glyphs;
            selectGroup('.glyph-btn', 'glyphs', settings.glyphSet);
            buildAtlas();
            // A largura da célula muda junto com o conjunto de glifos.
            buildLayers();
            saveSettings();
        });
    });

    document.querySelectorAll('.depth-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            settings.depth = Number(btn.dataset.depth);
            selectGroup('.depth-btn', 'depth', settings.depth);
            buildLayers();
            saveSettings();
        });
    });

    Object.keys(SLIDERS).forEach(function (key) {
        const input = document.getElementById(key);
        const label = document.getElementById(key + 'Value');

        input.addEventListener('input', function () {
            const value = Number(input.value);
            settings[key] = value;
            label.textContent = SLIDERS[key](value);

            if (key === 'fontSize') {
                buildAtlas();
                buildLayers();
            } else if (key === 'density' || key === 'trail') {
                layers.forEach(seedStreams);
            }

            saveSettings();
        });
    });

    SWITCHES.forEach(function (key) {
        const input = document.getElementById(key);
        input.addEventListener('change', function () {
            settings[key] = input.checked;

            if (key === 'mirror') buildAtlas();
            if (key === 'sound') {
                if (input.checked) Sound.start();
                else Sound.stop();
            }

            saveSettings();
        });
    });

    ui.message.addEventListener('input', function () {
        settings.message = ui.message.value;
        saveSettings();
    });

    ui.message.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') spawnMessage();
        event.stopPropagation();
    });

    document.getElementById('injectMessage').addEventListener('click', spawnMessage);
    document.getElementById('replayIntro').addEventListener('click', function () {
        setControls(false);
        runBoot();
    });

    document.getElementById('random').addEventListener('click', function () {
        const presetKeys = Object.keys(PRESETS);
        const glyphKeys = Object.keys(GLYPH_SETS);

        settings.preset = presetKeys[(Math.random() * presetKeys.length) | 0];
        settings.glyphSet = glyphKeys[(Math.random() * glyphKeys.length) | 0];
        settings.depth = 1 + ((Math.random() * 3) | 0);
        settings.speed = Number((0.4 + Math.random() * 2).toFixed(1));
        settings.fontSize = 10 + ((Math.random() * 20) | 0);
        settings.trail = Number((0.5 + Math.random() * 1.8).toFixed(1));
        settings.density = 40 + ((Math.random() * 140) | 0);
        settings.mutation = Number((Math.random() * 3).toFixed(1));
        settings.glow = Number((0.3 + Math.random() * 1.5).toFixed(2));

        rebuildAll();
    });

    document.getElementById('reset').addEventListener('click', function () {
        const message = settings.message;
        Object.assign(settings, DEFAULTS, { message: message });
        rebuildAll();
    });

    function rebuildAll() {
        syncUI();
        buildAtlas();
        buildLayers();
        saveSettings();
    }

    /* Painel */

    function setControls(open) {
        ui.controls.classList.toggle('visible', open);
        ui.toggleControls.classList.toggle('hidden', open);
        ui.toggleControls.setAttribute('aria-expanded', String(open));
    }

    ui.toggleControls.addEventListener('click', function () { setControls(true); });
    ui.closeControls.addEventListener('click', function () { setControls(false); });

    /* Modo cinema */

    function setCinema(on) {
        document.body.classList.toggle('cinema', on);
        ui.cinema.classList.toggle('is-active', on);
        if (on) {
            setControls(false);
            markPointerActive();
        }
    }

    ui.cinema.addEventListener('click', function () {
        setCinema(!document.body.classList.contains('cinema'));
    });

    ui.cinemaExit.addEventListener('click', leaveImmersive);

    /* Tela cheia */

    function isFullscreen() {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function exitFullscreen() {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) Promise.resolve(exit.call(document)).catch(function () { });
    }

    function leaveImmersive() {
        if (isFullscreen()) exitFullscreen();
        setCinema(false);
    }

    function toggleFullscreen() {
        if (isFullscreen()) {
            exitFullscreen();
            return;
        }

        const root = document.documentElement;
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        const attempt = request ? request.call(root) : Promise.reject();

        Promise.resolve(attempt).catch(function () {
            // Safari no iPhone e páginas embutidas bloqueiam a Fullscreen API;
            // o modo cinema entrega o mesmo resultado dentro da janela.
            setCinema(true);
        });
    }

    function onFullscreenChange() {
        syncFullscreenIcon();
        // Tela cheia aqui significa só o código na tela, sem cromo em volta.
        setCinema(isFullscreen());
        // Alguns navegadores só reportam o novo tamanho no frame seguinte.
        requestAnimationFrame(resize);
    }

    function syncFullscreenIcon() {
        const on = isFullscreen();
        ui.fullscreen.querySelector('.fs-enter').hidden = on;
        ui.fullscreen.querySelector('.fs-exit').hidden = !on;
        ui.fullscreen.classList.toggle('is-active', on);
    }

    ui.fullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    /* Pulso ao clicar */

    function addPulse(clientX, clientY) {
        pulses.push({
            x: clientX * dpr,
            y: clientY * dpr,
            r: 0,
            speed: Math.max(width, height) * 0.8,
            band: 90 * dpr,
            life: 1
        });
        if (pulses.length > 5) pulses.shift();
    }

    canvas.addEventListener('pointerdown', function (event) {
        addPulse(event.clientX, event.clientY);
    });

    /* Teclado */

    document.addEventListener('keydown', function (event) {
        if (event.target instanceof HTMLInputElement) return;

        const key = event.key.toLowerCase();

        if (key === 'escape') {
            if (boot.active) endBoot();
            else if (document.body.classList.contains('cinema')) leaveImmersive();
            else if (ui.controls.classList.contains('visible')) setControls(false);
            return;
        }

        if (boot.active && key === ' ') {
            endBoot();
            event.preventDefault();
            return;
        }

        switch (key) {
            case 'c':
                setControls(!ui.controls.classList.contains('visible'));
                break;
            case 'h':
                setCinema(!document.body.classList.contains('cinema'));
                break;
            case 'f':
                toggleFullscreen();
                break;
            case 'r':
                document.getElementById('random').click();
                break;
            case ' ':
                paused = !paused;
                event.preventDefault();
                break;
            default:
                break;
        }
    });

    /* Esconde o cursor e o botão de saída quando o mouse fica parado no cinema */

    let idleTimer = null;

    function markPointerActive() {
        document.body.classList.remove('pointer-idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            document.body.classList.add('pointer-idle');
        }, 2200);
    }

    document.addEventListener('pointermove', markPointerActive);

    /* Ciclo de vida */

    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        } else if (!rafId) {
            lastTime = 0;
            rafId = requestAnimationFrame(frame);
        }
    });

    // O contador de streams muda pouco; atualizar fora do loop evita layout a 60fps.
    setInterval(function () {
        const total = layers.reduce(function (sum, layer) { return sum + layer.streams.length; }, 0);
        ui.streamCount.textContent = total;
    }, 500);

    syncUI();
    resize();

    if (settings.sound) Sound.start();

    let introSeen = false;
    try {
        introSeen = sessionStorage.getItem('labs:matrix:intro') === '1';
        sessionStorage.setItem('labs:matrix:intro', '1');
    } catch (err) {
        /* sessionStorage pode estar indisponível. */
    }

    if (!introSeen) runBoot();

    rafId = requestAnimationFrame(frame);
})();
