(function () {
    'use strict';

    /**
     * Pulsar — instrumento generativo espacial.
     *
     * Composição pelo lugar:
     *   Y → grau da escala (topo = agudo). midi = root + oitava*12 + scale[i]
     *   X → pan estéreo e fase no compasso (esquerda = beat 0)
     *   Y em terços → período em beats: alto=2, meio=4, baixo=8
     *
     * Relógio:
     *   beat = t * BPM / 60
     *   o orbe dispara no flanco em que floor(beat) % period === phase
     *
     * Cânone:
     *   vizinho a ≤ alcance recebe um eco após delay = quantize(dist / 280px/s, ½ beat)
     *   velocity *= 0.58^hops, no máximo 3 hops
     */

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    const NOTE_MIDI = { C: 48, D: 50, E: 52, F: 53, G: 55, A: 57, B: 59 };
    const SCALES = {
        pentatonic: [0, 2, 4, 7, 9],
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        dorian: [0, 2, 3, 5, 7, 9, 10]
    };
    const OCTAVES = 2.2;
    const RIPPLE_SPEED = 280;
    const MAX_HOPS = 3;
    const HOP_DECAY = 0.58;
    const MAX_ORBS = 40;
    const MAX_VOICES = 16;
    const MAX_STARS = 160;
    const STORAGE_KEY = 'pulsar-state-v3';
    const DPR_CAP = 2;

    const THEMES = {
        nebula: ['#22d3ee', '#a855f7', '#f472b6'],
        aurora: ['#34d399', '#22d3ee', '#818cf8'],
        sunset: ['#fb7185', '#fbbf24', '#f472b6'],
        deep: ['#60a5fa', '#818cf8', '#22d3ee']
    };

    const PRESETS = [
        { name: 'Nebula', themeKey: 'nebula', scale: 'pentatonic', root: 'E', waveform: 'sine', bpm: 72, reachPercent: 100, reverbMix: 0.42 },
        { name: 'Aurora', themeKey: 'aurora', scale: 'major', root: 'C', waveform: 'triangle', bpm: 88, reachPercent: 108, reverbMix: 0.38 },
        { name: 'Sunset', themeKey: 'sunset', scale: 'dorian', root: 'D', waveform: 'warm', bpm: 64, reachPercent: 92, reverbMix: 0.5 },
        { name: 'Deep', themeKey: 'deep', scale: 'minor', root: 'A', waveform: 'sine', bpm: 52, reachPercent: 124, reverbMix: 0.58 }
    ];

    const state = {
        presetIndex: 0,
        volume: 0.82,
        droneOn: false,
        playing: true
    };

    let width = 0;
    let height = 0;
    let reachBase = 0;
    let orbs = [];
    const orbsById = new Map();
    let idCounter = 1;
    let pending = [];
    let ripples = [];
    let sparks = [];
    let stars = [];
    let nebula = [];
    let connectionsDirty = true;
    let cachedReach = 140;
    let lastBeat = -1;
    let downbeatFlash = 0;
    let ghost = null;
    let dragState = null;
    let lastTap = { id: null, time: 0 };
    let saveTimer = 0;
    let raf = 0;
    let running = true;
    let finePointer = true;

    const hudPreset = document.getElementById('hudPreset');
    const hudMeta = document.getElementById('hudMeta');
    const presetNameEl = document.getElementById('presetName');

    function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function now() { return performance.now() * 0.001; }
    function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function getPreset() { return PRESETS[state.presetIndex]; }
    function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
    function beatDuration() { return 60 / getPreset().bpm; }

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function lerpColor(a, b, t) {
        return {
            r: (a.r + (b.r - a.r) * t + 0.5) | 0,
            g: (a.g + (b.g - a.g) * t + 0.5) | 0,
            b: (a.b + (b.b - a.b) * t + 0.5) | 0
        };
    }

    function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }

    function colorForT(t) {
        const stops = THEMES[getPreset().themeKey];
        const a = hexToRgb(stops[0]);
        const b = hexToRgb(stops[1]);
        const c = hexToRgb(stops[2]);
        return t <= 0.5 ? lerpColor(a, b, t * 2) : lerpColor(b, c, (t - 0.5) * 2);
    }

    function tForY(y) { return 1 - clamp(y / Math.max(1, height), 0, 1); }

    function freqForY(y) {
        const preset = getPreset();
        const scale = SCALES[preset.scale];
        const t = tForY(y);
        const steps = Math.max(1, (scale.length * OCTAVES) | 0);
        const idx = Math.min(steps - 1, (t * steps) | 0);
        const midi = (NOTE_MIDI[preset.root] || 52) + ((idx / scale.length) | 0) * 12 + scale[idx % scale.length];
        return midiToFreq(midi);
    }

    function periodForY(y) {
        const t = clamp(y / Math.max(1, height), 0, 1);
        return t < 0.34 ? 2 : t < 0.67 ? 4 : 8;
    }

    function phaseForX(x, period) {
        return (clamp(x / Math.max(1, width), 0, 0.999) * period) | 0;
    }

    function radiusForPeriod(period) {
        return period === 8 ? 13 : period === 4 ? 10.5 : 8;
    }

    function applyThemeVars() {
        const stops = THEMES[getPreset().themeKey];
        const root = document.documentElement.style;
        root.setProperty('--p-1', stops[0]);
        root.setProperty('--p-2', stops[1]);
        root.setProperty('--p-3', stops[2]);
        const mid = hexToRgb(stops[1]);
        root.setProperty('--glow-color', rgba(mid, 0.36));
        const dark = isDark();
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.setAttribute('content', dark ? '#05060d' : '#e7ebf8');
    }

    function retuneOrb(o) {
        o.freq = freqForY(o.y);
        o.color = colorForT(tForY(o.y));
        o.period = periodForY(o.y);
        o.phase = phaseForX(o.x, o.period);
        o.r = radiusForPeriod(o.period);
    }

    function retuneAll() {
        for (let i = 0; i < orbs.length; i++) retuneOrb(orbs[i]);
        connectionsDirty = true;
    }

    const AudioEngine = (function () {
        let actx = null;
        let master = null;
        let wet = null;
        let muted = false;
        let activeVoices = 0;
        let drone = null;

        function impulse(seconds, decay) {
            const rate = actx.sampleRate;
            const len = Math.max(1, (rate * seconds) | 0);
            const buf = actx.createBuffer(2, len, rate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buf.getChannelData(ch);
                for (let i = 0; i < len; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
                }
            }
            return buf;
        }

        function ensure() {
            if (actx) return actx;
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            actx = new AC();
            master = actx.createGain();
            master.gain.value = muted ? 0 : state.volume;
            const dry = actx.createGain();
            dry.gain.value = 1;
            wet = actx.createGain();
            wet.gain.value = getPreset().reverbMix;
            const conv = actx.createConvolver();
            conv.buffer = impulse(1.7, 2.6);
            const comp = actx.createDynamicsCompressor();
            comp.threshold.value = -18;
            comp.knee.value = 10;
            comp.ratio.value = 5;
            comp.attack.value = 0.004;
            comp.release.value = 0.16;
            master.connect(dry);
            dry.connect(comp);
            master.connect(wet);
            wet.connect(conv);
            conv.connect(comp);
            comp.connect(actx.destination);
            return actx;
        }

        function resume() {
            ensure();
            if (actx && actx.state === 'suspended') actx.resume();
        }

        function setMute(m) {
            muted = m;
            if (master && actx) master.gain.setTargetAtTime(m ? 0 : state.volume, actx.currentTime, 0.05);
        }

        function setReverb(v) {
            if (wet && actx) wet.gain.setTargetAtTime(v, actx.currentTime, 0.12);
        }

        function playNote(freq, opts) {
            opts = opts || {};
            if (!actx) return;
            const hops = opts.hops || 0;
            if (activeVoices >= MAX_VOICES && hops > 0) return;
            if (activeVoices >= MAX_VOICES + 4) return;

            const t0 = actx.currentTime;
            const vel = clamp(opts.velocity != null ? opts.velocity : 1, 0, 1.2);
            const waveform = opts.waveform || 'sine';
            const osc1 = actx.createOscillator();
            const osc2 = actx.createOscillator();
            const g = actx.createGain();
            const filter = actx.createBiquadFilter();
            const panner = actx.createStereoPanner ? actx.createStereoPanner() : null;

            osc1.type = waveform === 'triangle' ? 'triangle' : 'sine';
            osc2.type = waveform === 'warm' ? 'sawtooth' : 'triangle';
            osc1.frequency.value = freq;
            osc2.frequency.value = freq;
            osc1.detune.value = Math.random() * 8 - 4;
            osc2.detune.value = (waveform === 'warm' ? 7 : 5) + Math.random() * 4;

            filter.type = 'lowpass';
            filter.Q.value = waveform === 'warm' ? 1.1 : 0.55;
            const cutoff = waveform === 'warm' ? freq * 4.2 : freq * 7.5;
            filter.frequency.setValueAtTime(cutoff, t0);
            filter.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.35), t0 + 0.7);

            const peak = (hops ? 0.16 : 0.22) * vel;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.32), t0 + 0.42);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);

            const mix2 = actx.createGain();
            mix2.gain.value = waveform === 'warm' ? 0.18 : 0.28;
            osc1.connect(filter);
            osc2.connect(mix2);
            mix2.connect(filter);
            if (panner) {
                filter.connect(panner);
                panner.pan.value = clamp(opts.pan || 0, -1, 1);
                panner.connect(g);
            } else {
                filter.connect(g);
            }
            g.connect(master);

            activeVoices++;
            osc1.start(t0);
            osc2.start(t0);
            osc1.stop(t0 + 1.75);
            osc2.stop(t0 + 1.75);
            osc1.onended = function () {
                activeVoices = Math.max(0, activeVoices - 1);
                try {
                    osc1.disconnect();
                    osc2.disconnect();
                    mix2.disconnect();
                    filter.disconnect();
                    g.disconnect();
                    if (panner) panner.disconnect();
                } catch (err) { /* already gone */ }
            };
        }

        function startDrone() {
            ensure();
            if (!actx || drone) return;
            const t0 = actx.currentTime;
            const g = actx.createGain();
            g.gain.value = 0.0001;
            g.connect(master);
            const rootFreq = midiToFreq((NOTE_MIDI[getPreset().root] || 52) - 12);
            const oscs = [0, 7, 12].map(function (semi, i) {
                const o = actx.createOscillator();
                const og = actx.createGain();
                const f = actx.createBiquadFilter();
                o.type = 'sine';
                o.frequency.value = rootFreq * Math.pow(2, semi / 12);
                o.detune.value = Math.random() * 5 - 2.5;
                og.gain.value = i === 0 ? 0.46 : 0.24;
                f.type = 'lowpass';
                f.frequency.value = 640;
                o.connect(f);
                f.connect(og);
                og.connect(g);
                o.start(t0);
                return { o: o, f: f };
            });
            const lfo = actx.createOscillator();
            const lfoG = actx.createGain();
            lfo.frequency.value = 0.04;
            lfoG.gain.value = 220;
            lfo.connect(lfoG);
            oscs.forEach(function (n) { lfoG.connect(n.f.frequency); });
            lfo.start(t0);
            g.gain.linearRampToValueAtTime(0.13, t0 + 2.2);
            drone = { g: g, oscs: oscs, lfo: lfo };
        }

        function stopDrone() {
            if (!actx || !drone) return;
            const t0 = actx.currentTime;
            const nodes = drone;
            drone = null;
            nodes.g.gain.cancelScheduledValues(t0);
            nodes.g.gain.setValueAtTime(Math.max(0.0001, nodes.g.gain.value), t0);
            nodes.g.gain.linearRampToValueAtTime(0.0001, t0 + 1.1);
            setTimeout(function () {
                nodes.oscs.forEach(function (n) { try { n.o.stop(); } catch (err) { /* noop */ } });
                try { nodes.lfo.stop(); } catch (err) { /* noop */ }
            }, 1200);
        }

        function refreshDrone() {
            if (!drone || !actx) return;
            const rootFreq = midiToFreq((NOTE_MIDI[getPreset().root] || 52) - 12);
            [0, 7, 12].forEach(function (semi, i) {
                if (drone.oscs[i]) {
                    drone.oscs[i].o.frequency.setTargetAtTime(rootFreq * Math.pow(2, semi / 12), actx.currentTime, 0.35);
                }
            });
        }

        return {
            resume: resume,
            setMute: setMute,
            isMuted: function () { return muted; },
            setReverb: setReverb,
            playNote: playNote,
            startDrone: startDrone,
            stopDrone: stopDrone,
            refreshDrone: refreshDrone
        };
    })();

    function markConnectionsDirty() { connectionsDirty = true; }

    function addOrb(x, y, opts) {
        opts = opts || {};
        if (orbs.length >= MAX_ORBS) removeOrb(orbs[0]);
        const orb = {
            id: idCounter++,
            x: x,
            y: y,
            rx: x / Math.max(1, width),
            ry: y / Math.max(1, height),
            r: 10,
            freq: 440,
            color: { r: 168, g: 85, b: 247 },
            period: 4,
            phase: 0,
            lastTrigger: -10,
            connections: []
        };
        retuneOrb(orb);
        orbs.push(orb);
        orbsById.set(orb.id, orb);
        markConnectionsDirty();
        if (!opts.silent) {
            AudioEngine.resume();
            triggerOrb(orb, { hops: 0, fromClock: false });
        }
        updateHud();
        return orb;
    }

    function removeOrb(orb) {
        if (!orb) return;
        const idx = orbs.indexOf(orb);
        if (idx === -1) return;
        orbs.splice(idx, 1);
        orbsById.delete(orb.id);
        pending = pending.filter(function (p) { return p.id !== orb.id; });
        markConnectionsDirty();
        updateHud();
    }

    function clearOrbs() {
        orbs = [];
        orbsById.clear();
        pending = [];
        ripples = [];
        sparks = [];
        markConnectionsDirty();
        updateHud();
    }

    function findOrbAt(x, y) {
        const hitPad = finePointer ? 18 : 26;
        let best = null;
        let bestD = Infinity;
        for (let i = 0; i < orbs.length; i++) {
            const o = orbs[i];
            const d = Math.hypot(o.x - x, o.y - y);
            if (d <= o.r + hitPad && d < bestD) {
                best = o;
                bestD = d;
            }
        }
        return best;
    }

    function computeConnections() {
        const reach = reachBase * (getPreset().reachPercent / 100);
        cachedReach = reach;
        for (let i = 0; i < orbs.length; i++) orbs[i].connections.length = 0;
        for (let i = 0; i < orbs.length; i++) {
            for (let j = i + 1; j < orbs.length; j++) {
                if (dist(orbs[i], orbs[j]) <= reach) {
                    orbs[i].connections.push(orbs[j]);
                    orbs[j].connections.push(orbs[i]);
                }
            }
        }
        connectionsDirty = false;
        return reach;
    }

    function triggerOrb(orb, opts) {
        opts = opts || {};
        const hops = opts.hops || 0;
        const t = now();
        if (t - orb.lastTrigger < 0.08) return false;
        orb.lastTrigger = t;

        AudioEngine.playNote(orb.freq, {
            velocity: Math.pow(HOP_DECAY, hops),
            pan: (orb.x / Math.max(1, width)) * 2 - 1,
            waveform: getPreset().waveform,
            hops: hops
        });

        ripples.push({
            x: orb.x,
            y: orb.y,
            born: t,
            color: orb.color,
            maxR: cachedReach * 0.95 || 120
        });

        if (hops < MAX_HOPS) {
            const beatHalf = beatDuration() * 0.5;
            for (let i = 0; i < orb.connections.length; i++) {
                const nb = orb.connections[i];
                if (t - nb.lastTrigger < 0.12) continue;
                if (opts.fromClock && (lastBeat % nb.period === nb.phase)) continue;
                const d = dist(orb, nb);
                const delay = Math.max(beatHalf, Math.round(d / RIPPLE_SPEED / beatHalf) * beatHalf);
                pending.push({ id: nb.id, fireAt: t + delay, hops: hops + 1 });
                sparks.push({
                    ax: orb.x, ay: orb.y,
                    bx: nb.x, by: nb.y,
                    born: t, dur: delay,
                    color: orb.color
                });
            }
        }
        return true;
    }

    function initField() {
        const count = Math.min(MAX_STARS, Math.max(48, ((width * height) / 14000) | 0));
        stars = new Array(count);
        for (let i = 0; i < count; i++) {
            stars[i] = {
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.25 + 0.25,
                a: 0.25 + Math.random() * 0.55,
                s: 0.35 + Math.random() * 1.4,
                p: Math.random() * Math.PI * 2
            };
        }
        nebula = [
            { x: width * 0.22, y: height * 0.28, r: Math.min(width, height) * 0.55 },
            { x: width * 0.78, y: height * 0.62, r: Math.min(width, height) * 0.6 },
            { x: width * 0.5, y: height * 0.42, r: Math.min(width, height) * 0.42 }
        ];
    }

    function drawBackground(t) {
        const dark = isDark();
        ctx.fillStyle = dark ? '#05060d' : '#e7ebf8';
        ctx.fillRect(0, 0, width, height);

        const stops = THEMES[getPreset().themeKey];
        const cols = [hexToRgb(stops[0]), hexToRgb(stops[1]), hexToRgb(stops[2])];
        const pulse = 0.85 + downbeatFlash * 0.2;
        ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
        for (let i = 0; i < nebula.length; i++) {
            const n = nebula[i];
            const wobble = Math.sin(t * 0.12 + i * 1.7) * 18;
            const g = ctx.createRadialGradient(n.x + wobble, n.y, 0, n.x, n.y, n.r);
            g.addColorStop(0, rgba(cols[i], (dark ? 0.22 : 0.16) * pulse));
            g.addColorStop(1, rgba(cols[i], 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = dark ? 'screen' : 'source-over';
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const tw = 0.45 + 0.55 * Math.sin(t * s.s + s.p);
            ctx.fillStyle = dark
                ? 'rgba(255,255,255,' + (s.a * tw * 0.7).toFixed(3) + ')'
                : 'rgba(40,50,90,' + (s.a * tw * 0.35).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawConnections(t) {
        const dark = isDark();
        ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
        for (let i = 0; i < orbs.length; i++) {
            const a = orbs[i];
            const burstA = clamp(1 - (t - a.lastTrigger) / 0.4, 0, 1);
            for (let k = 0; k < a.connections.length; k++) {
                const b = a.connections[k];
                if (b.id < a.id) continue;
                const d = dist(a, b);
                const base = clamp(1 - d / cachedReach, 0, 1) * (dark ? 0.46 : 0.3);
                if (base < 0.02) continue;
                const burstB = clamp(1 - (t - b.lastTrigger) / 0.4, 0, 1);
                const live = Math.max(burstA, burstB);
                ctx.strokeStyle = rgba(a.color, base + live * 0.45);
                ctx.lineWidth = 1 + live * 1.8;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawSparks(t) {
        ctx.globalCompositeOperation = isDark() ? 'screen' : 'source-over';
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            const u = (t - s.born) / s.dur;
            if (u >= 1) {
                sparks.splice(i, 1);
                continue;
            }
            const x = s.ax + (s.bx - s.ax) * u;
            const y = s.ay + (s.by - s.ay) * u;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
            g.addColorStop(0, rgba(s.color, 0.95));
            g.addColorStop(1, rgba(s.color, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawRipples(t) {
        ctx.globalCompositeOperation = isDark() ? 'screen' : 'source-over';
        for (let i = ripples.length - 1; i >= 0; i--) {
            const rp = ripples[i];
            const r = Math.max(0, t - rp.born) * RIPPLE_SPEED;
            const alpha = clamp(1 - r / rp.maxR, 0, 1) * 0.55;
            if (alpha < 0.02 || r > rp.maxR) {
                ripples.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
            ctx.lineWidth = 2.2 - (r / rp.maxR) * 1.4;
            ctx.strokeStyle = rgba(rp.color, alpha);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawOrb(o, t, ghosted) {
        const dark = isDark();
        const bpm = getPreset().bpm;
        const beats = t * bpm / 60;
        const local = ((beats % o.period) + o.period) % o.period;
        const until = (o.phase - local + o.period) % o.period;
        const approach = until < 0.55 ? 1 - until / 0.55 : 0;
        const burst = clamp(1 - (t - o.lastTrigger) / 0.42, 0, 1);
        const r = o.r + approach * 2.2 + burst * 6;
        const glowR = r + 14 + burst * 22;
        ctx.globalAlpha = ghosted ? 0.38 : 1;

        const bloom = ctx.createRadialGradient(o.x, o.y, r * 0.2, o.x, o.y, glowR);
        bloom.addColorStop(0, rgba(o.color, (dark ? 0.55 : 0.4) + burst * 0.3));
        bloom.addColorStop(1, rgba(o.color, 0));
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(o.x, o.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        const body = ctx.createRadialGradient(o.x - r * 0.25, o.y - r * 0.3, r * 0.1, o.x, o.y, r);
        body.addColorStop(0, dark ? '#fff' : 'rgba(255,255,255,0.95)');
        body.addColorStop(0.35, rgba(o.color, 1));
        body.addColorStop(1, rgba(o.color, 0.75));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (approach > 0.05 && !ghosted) {
            ctx.strokeStyle = rgba(o.color, approach * 0.55);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(o.x, o.y, r + 6 + (1 - approach) * 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawOrbs(t) {
        ctx.globalCompositeOperation = isDark() ? 'screen' : 'source-over';
        for (let i = 0; i < orbs.length; i++) drawOrb(orbs[i], t, false);
        if (ghost) drawOrb(ghost, t, true);
        ctx.globalCompositeOperation = 'source-over';
    }

    function tickClock(t) {
        if (!state.playing) return;
        const bpm = getPreset().bpm;
        const beat = (t * bpm / 60) | 0;
        if (beat === lastBeat) return;
        lastBeat = beat;
        if (beat % 4 === 0) downbeatFlash = 1;
        for (let i = 0; i < orbs.length; i++) {
            const o = orbs[i];
            if (beat % o.period === o.phase) triggerOrb(o, { hops: 0, fromClock: true });
        }
    }

    function flushPending(t) {
        if (!pending.length) return;
        const keep = [];
        for (let i = 0; i < pending.length; i++) {
            const p = pending[i];
            if (t >= p.fireAt) {
                const orb = orbsById.get(p.id);
                if (orb) triggerOrb(orb, { hops: p.hops });
            } else {
                keep.push(p);
            }
        }
        pending = keep;
    }

    function updateHud() {
        const p = getPreset();
        const count = orbs.length;
        const label = count === 1 ? '1 orbe' : count + ' orbes';
        if (hudPreset) hudPreset.textContent = p.name;
        if (hudMeta) hudMeta.textContent = p.bpm + ' BPM · ' + label;
        if (presetNameEl) presetNameEl.textContent = p.name;
    }

    function frame() {
        const t = now();
        downbeatFlash *= 0.9;
        if (connectionsDirty) computeConnections();
        tickClock(t);
        flushPending(t);
        drawBackground(t);
        drawConnections(t);
        drawRipples(t);
        drawSparks(t);
        drawOrbs(t);
        raf = requestAnimationFrame(frame);
    }

    function startLoop() {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
        running = false;
        cancelAnimationFrame(raf);
    }

    function resize() {
        const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        canvas.width = Math.max(1, (cssW * dpr) | 0);
        canvas.height = Math.max(1, (cssH * dpr) | 0);
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        width = cssW;
        height = cssH;
        reachBase = Math.min(width, height) * 0.22;
        for (let i = 0; i < orbs.length; i++) {
            const o = orbs[i];
            o.x = o.rx * width;
            o.y = o.ry * height;
        }
        retuneAll();
        initField();
    }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: clamp(e.clientX - rect.left, 0, width),
            y: clamp(e.clientY - rect.top, 0, height)
        };
    }

    function makeGhost(x, y) {
        const period = periodForY(y);
        return {
            x: x, y: y,
            r: radiusForPeriod(period),
            color: colorForT(tForY(y)),
            period: period,
            phase: phaseForX(x, period),
            lastTrigger: -10
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        AudioEngine.resume();
        const pos = getPos(e);
        ghost = null;
        const hit = findOrbAt(pos.x, pos.y);
        if (hit) {
            dragState = { orb: hit, isNew: false, moved: false, startX: pos.x, startY: pos.y };
        } else {
            const orb = addOrb(pos.x, pos.y);
            dragState = { orb: orb, isNew: true, moved: false, startX: pos.x, startY: pos.y };
        }
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already up */ }
    });

    canvas.addEventListener('pointermove', function (e) {
        const pos = getPos(e);
        if (dragState) {
            if (Math.hypot(pos.x - dragState.startX, pos.y - dragState.startY) > 6) dragState.moved = true;
            const o = dragState.orb;
            o.x = pos.x;
            o.y = pos.y;
            o.rx = pos.x / Math.max(1, width);
            o.ry = pos.y / Math.max(1, height);
            retuneOrb(o);
            markConnectionsDirty();
            return;
        }
        if (!finePointer) return;
        ghost = findOrbAt(pos.x, pos.y) ? null : makeGhost(pos.x, pos.y);
    });

    canvas.addEventListener('pointerleave', function () {
        if (!dragState) ghost = null;
    });

    function endDrag() {
        if (!dragState) return;
        const orb = dragState.orb;
        const isNew = dragState.isNew;
        const moved = dragState.moved;
        dragState = null;
        if (!isNew && !moved) {
            const t = now();
            if (lastTap.id === orb.id && (t - lastTap.time) < 0.42) {
                removeOrb(orb);
                lastTap = { id: null, time: 0 };
            } else {
                triggerOrb(orb, { hops: 0 });
                lastTap = { id: orb.id, time: t };
            }
        }
        scheduleSave();
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', function () { dragState = null; });

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveState, 500);
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                v: 3,
                presetIndex: state.presetIndex,
                orbs: orbs.map(function (o) { return { rx: o.rx, ry: o.ry }; })
            }));
        } catch (err) { /* private mode */ }
    }

    function loadState() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!data || !Array.isArray(data.orbs)) return false;
            if (typeof data.presetIndex === 'number') {
                state.presetIndex = clamp(data.presetIndex, 0, PRESETS.length - 1) | 0;
            }
            data.orbs.forEach(function (o) {
                if (typeof o.rx === 'number' && typeof o.ry === 'number') {
                    addOrb(o.rx * width, o.ry * height, { silent: true });
                }
            });
            return orbs.length > 0;
        } catch (err) {
            return false;
        }
    }

    function seedDefault() {
        const pts = [
            [0.24, 0.70],
            [0.38, 0.52],
            [0.50, 0.34],
            [0.64, 0.48],
            [0.78, 0.28]
        ];
        pts.forEach(function (p) {
            addOrb(p[0] * width, p[1] * height, { silent: true });
        });
    }

    function applyPreset(index, fromKey) {
        AudioEngine.resume();
        state.presetIndex = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
        applyThemeVars();
        retuneAll();
        AudioEngine.setReverb(getPreset().reverbMix);
        AudioEngine.refreshDrone();
        lastBeat = -1;
        updateHud();
        if (!fromKey) scheduleSave();
        else scheduleSave();
    }

    function setPlaying(on) {
        state.playing = on;
        const btn = document.getElementById('playPause');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? 'Pausar' : 'Tocar');
        btn.setAttribute('title', on ? 'Pausar (Espaço)' : 'Tocar (Espaço)');
        const pauseIcon = btn.querySelector('.icon-pause');
        const playIcon = btn.querySelector('.icon-play');
        if (pauseIcon) pauseIcon.hidden = !on;
        if (playIcon) playIcon.hidden = on;
        if (on) lastBeat = -1;
    }

    function setDrone(on) {
        state.droneOn = on;
        const btn = document.getElementById('droneToggle');
        if (btn) btn.setAttribute('aria-pressed', String(on));
        if (on) AudioEngine.startDrone();
        else AudioEngine.stopDrone();
    }

    function setMuted(on) {
        AudioEngine.setMute(on);
        const btn = document.getElementById('muteBtn');
        if (!btn) return;
        btn.classList.toggle('muted', on);
        const sound = btn.querySelector('.icon-sound');
        const mute = btn.querySelector('.icon-mute');
        if (sound) sound.hidden = on;
        if (mute) mute.hidden = !on;
    }

    const cycleBtn = document.getElementById('cyclePreset');
    if (cycleBtn) {
        cycleBtn.addEventListener('click', function () {
            applyPreset(state.presetIndex + 1);
        });
    }

    const playBtn = document.getElementById('playPause');
    if (playBtn) {
        playBtn.addEventListener('click', function () {
            AudioEngine.resume();
            setPlaying(!state.playing);
        });
    }

    const droneBtn = document.getElementById('droneToggle');
    if (droneBtn) {
        droneBtn.addEventListener('click', function () {
            AudioEngine.resume();
            setDrone(!state.droneOn);
        });
    }

    const clearBtn = document.getElementById('clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            clearOrbs();
            scheduleSave();
        });
    }

    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.addEventListener('click', function () {
            AudioEngine.resume();
            setMuted(!AudioEngine.isMuted());
        });
    }

    const fullscreenBtn = document.getElementById('fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function () {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(function () { /* noop */ });
            } else {
                document.exitFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', function () {
            const on = !!document.fullscreenElement;
            const enter = fullscreenBtn.querySelector('.fullscreen-enter');
            const exit = fullscreenBtn.querySelector('.fullscreen-exit');
            if (enter) enter.hidden = on;
            if (exit) exit.hidden = !on;
        });
    }

    window.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.code === 'Space') {
            e.preventDefault();
            AudioEngine.resume();
            setPlaying(!state.playing);
        } else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
            applyPreset(Number(e.key) - 1, true);
        } else if (e.key === 'd' || e.key === 'D') {
            AudioEngine.resume();
            setDrone(!state.droneOn);
        } else if (e.key === 'c' || e.key === 'C') {
            clearOrbs();
            scheduleSave();
        } else if (e.key === 'm' || e.key === 'M') {
            AudioEngine.resume();
            setMuted(!AudioEngine.isMuted());
        } else if (e.key === 'f' || e.key === 'F') {
            if (fullscreenBtn) fullscreenBtn.click();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            if (orbs.length) {
                removeOrb(orbs[orbs.length - 1]);
                scheduleSave();
            }
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopLoop();
        else startLoop();
    });

    const themeObs = new MutationObserver(function () {
        applyThemeVars();
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    finePointer = window.matchMedia('(pointer: fine)').matches;
    applyThemeVars();
    resize();
    window.addEventListener('resize', resize);

    if (!loadState()) seedDefault();
    applyThemeVars();
    retuneAll();
    updateHud();
    running = true;
    raf = requestAnimationFrame(frame);
})();
