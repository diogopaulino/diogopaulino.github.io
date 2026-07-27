(function () {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx2d = canvas.getContext('2d');

    const NOTE_MIDI = { C: 48, D: 50, E: 52, F: 53, G: 55, A: 57, B: 59 };
    const SCALES = {
        pentatonic: [0, 2, 4, 7, 9],
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        wholetone: [0, 2, 4, 6, 8, 10]
    };
    const OCTAVE_SPAN = 2.4;
    const RIPPLE_SPEED = 260; // px/s
    const ORB_COOLDOWN = 0.28; // s
    const MAX_HOPS = 4;
    const HOP_DECAY = 0.72;
    const MAX_ORBS = 60;
    const STORAGE_KEY = 'pulsar-state-v1';

    const THEMES = {
        nebula: ['#22d3ee', '#a855f7', '#f472b6'],
        aurora: ['#00ff88', '#00d4ff', '#8b5cf6'],
        sunset: ['#ff6b6b', '#feca57', '#ff9ff3'],
        deep: ['#0066ff', '#6366f1', '#22d3ee']
    };

    const state = {
        scale: 'pentatonic',
        root: 'E',
        themeKey: 'nebula',
        waveform: 'sine',
        tempo: 1,
        reverbMix: 0.45,
        reachPercent: 100,
        volume: 0.8,
        droneOn: false
    };

    let width = 0, height = 0, reachBase = 0;
    let orbs = [];
    const orbsById = new Map();
    let idCounter = 1;
    let pendingTriggers = [];
    let ripples = [];
    let stars = [];
    let noteCount = 0;
    let saveTimer = null;

    // ---------- helpers ----------
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function clock() { return performance.now() / 1000; }
    function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    function hexToRgb(hex) {
        const n = parseInt(hex.replace('#', ''), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function lerpColor(hexA, hexB, t) {
        const a = hexToRgb(hexA), b = hexToRgb(hexB);
        return {
            r: Math.round(a.r + (b.r - a.r) * t),
            g: Math.round(a.g + (b.g - a.g) * t),
            b: Math.round(a.b + (b.b - a.b) * t)
        };
    }

    function rgbStr(c) { return `rgb(${c.r}, ${c.g}, ${c.b})`; }
    function rgbaStr(c, a) { return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`; }

    function colorForT(t) {
        const stops = THEMES[state.themeKey] || THEMES.nebula;
        if (t <= 0.5) return lerpColor(stops[0], stops[1], t / 0.5);
        return lerpColor(stops[1], stops[2], (t - 0.5) / 0.5);
    }

    function tForY(y) { return 1 - clamp(y / Math.max(1, height), 0, 1); }
    function colorForY(y) { return colorForT(tForY(y)); }

    function freqForY(y) {
        const scaleArr = SCALES[state.scale] || SCALES.pentatonic;
        const t = tForY(y);
        const totalSteps = Math.max(1, Math.floor(scaleArr.length * OCTAVE_SPAN));
        const idx = Math.min(totalSteps - 1, Math.floor(t * totalSteps));
        const octave = Math.floor(idx / scaleArr.length);
        const semi = scaleArr[idx % scaleArr.length];
        const midi = (NOTE_MIDI[state.root] || 52) + octave * 12 + semi;
        return midiToFreq(midi);
    }

    function applyThemeVars() {
        const stops = THEMES[state.themeKey] || THEMES.nebula;
        document.documentElement.style.setProperty('--p-1', stops[0]);
        document.documentElement.style.setProperty('--p-2', stops[1]);
        document.documentElement.style.setProperty('--p-3', stops[2]);
        document.documentElement.style.setProperty('--glow-color', rgbaStr(hexToRgb(stops[1]), 0.32));
    }

    function retuneAll() {
        orbs.forEach((o) => {
            o.freq = freqForY(o.y);
            o.color = colorForY(o.y);
        });
    }

    // ---------- audio engine ----------
    const AudioEngine = (function () {
        let ctx = null, masterGain = null, dryGain = null, wetGain = null, convolver = null, compressor = null;
        let droneNodes = null;
        let muted = false;

        function buildImpulse(audioCtx, duration, decay) {
            const rate = audioCtx.sampleRate;
            const length = Math.max(1, Math.floor(rate * duration));
            const impulse = audioCtx.createBuffer(2, length, rate);
            for (let ch = 0; ch < 2; ch++) {
                const data = impulse.getChannelData(ch);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
                }
            }
            return impulse;
        }

        function ensureContext() {
            if (ctx) return ctx;
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            masterGain = ctx.createGain();
            masterGain.gain.value = muted ? 0 : state.volume;
            dryGain = ctx.createGain();
            dryGain.gain.value = 1;
            wetGain = ctx.createGain();
            wetGain.gain.value = state.reverbMix;
            convolver = ctx.createConvolver();
            convolver.buffer = buildImpulse(ctx, 3.2, 3.2);
            compressor = ctx.createDynamicsCompressor();

            masterGain.connect(dryGain);
            dryGain.connect(compressor);
            masterGain.connect(wetGain);
            wetGain.connect(convolver);
            convolver.connect(compressor);
            compressor.connect(ctx.destination);
            return ctx;
        }

        function resume() {
            ensureContext();
            if (ctx && ctx.state === 'suspended') ctx.resume();
        }

        function setVolume(v) {
            state.volume = v;
            if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : v, ctx.currentTime, 0.05);
        }

        function setMute(m) {
            muted = m;
            if (masterGain) masterGain.gain.setTargetAtTime(m ? 0 : state.volume, ctx.currentTime, 0.05);
        }

        function isMuted() { return muted; }

        function setReverbMix(v) {
            state.reverbMix = v;
            if (wetGain) wetGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
        }

        function playNote(freq, opts) {
            opts = opts || {};
            if (!ctx) return;
            const velocity = clamp(opts.velocity != null ? opts.velocity : 1, 0, 1.4);
            const pan = clamp(opts.pan || 0, -1, 1);
            const waveform = opts.waveform || 'sine';
            const t0 = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

            osc.type = waveform === 'soft-saw' ? 'sawtooth' : (waveform === 'triangle' ? 'triangle' : 'sine');
            osc.frequency.value = freq;
            osc.detune.value = Math.random() * 10 - 5;

            filter.type = 'lowpass';
            filter.Q.value = 0.6;
            if (waveform === 'soft-saw') {
                filter.frequency.setValueAtTime(freq * 5, t0);
                filter.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.4), t0 + 0.6);
            } else {
                filter.frequency.value = freq * 8;
            }

            const peak = 0.26 * velocity;
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.35), t0 + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);

            osc.connect(filter);
            if (panner) {
                filter.connect(panner);
                panner.pan.value = pan;
                panner.connect(gain);
            } else {
                filter.connect(gain);
            }
            gain.connect(masterGain);

            osc.start(t0);
            osc.stop(t0 + 2.1);
            osc.onended = function () {
                try { osc.disconnect(); gain.disconnect(); filter.disconnect(); if (panner) panner.disconnect(); } catch (e) { /* noop */ }
            };
        }

        function startDrone() {
            ensureContext();
            if (!ctx || droneNodes) return;
            const t0 = ctx.currentTime;
            const g = ctx.createGain();
            g.gain.value = 0.0001;
            g.connect(masterGain);

            const rootFreq = midiToFreq((NOTE_MIDI[state.root] || 52) - 12);
            const oscs = [];
            [0, 7, 12].forEach((semi, i) => {
                const o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = rootFreq * Math.pow(2, semi / 12);
                o.detune.value = Math.random() * 6 - 3;
                const og = ctx.createGain();
                og.gain.value = i === 0 ? 0.5 : 0.28;
                const filt = ctx.createBiquadFilter();
                filt.type = 'lowpass';
                filt.frequency.value = 700;
                o.connect(filt);
                filt.connect(og);
                og.connect(g);
                o.start(t0);
                oscs.push({ o: o, filt: filt });
            });

            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.045;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 260;
            lfo.connect(lfoGain);
            oscs.forEach(function (n) { lfoGain.connect(n.filt.frequency); });
            lfo.start(t0);

            g.gain.linearRampToValueAtTime(0.16, t0 + 2.5);
            droneNodes = { g: g, oscs: oscs, lfo: lfo };
        }

        function stopDrone() {
            if (!ctx || !droneNodes) return;
            const t0 = ctx.currentTime;
            const nodes = droneNodes;
            droneNodes = null;
            nodes.g.gain.cancelScheduledValues(t0);
            nodes.g.gain.setValueAtTime(nodes.g.gain.value, t0);
            nodes.g.gain.linearRampToValueAtTime(0.0001, t0 + 1.2);
            setTimeout(function () {
                nodes.oscs.forEach(function (n) { try { n.o.stop(); } catch (e) { /* noop */ } });
                try { nodes.lfo.stop(); } catch (e) { /* noop */ }
            }, 1400);
        }

        function refreshDroneTuning() {
            if (!droneNodes) return;
            const rootFreq = midiToFreq((NOTE_MIDI[state.root] || 52) - 12);
            [0, 7, 12].forEach((semi, i) => {
                if (droneNodes.oscs[i]) droneNodes.oscs[i].o.frequency.setTargetAtTime(rootFreq * Math.pow(2, semi / 12), ctx.currentTime, 0.4);
            });
        }

        return {
            resume: resume,
            setVolume: setVolume,
            setMute: setMute,
            isMuted: isMuted,
            setReverbMix: setReverbMix,
            playNote: playNote,
            startDrone: startDrone,
            stopDrone: stopDrone,
            refreshDroneTuning: refreshDroneTuning,
            hasContext: function () { return !!ctx; }
        };
    })();

    // ---------- orbs ----------
    function addOrb(x, y, skipTrigger) {
        if (orbs.length >= MAX_ORBS) removeOrb(orbs[0]);
        const orb = {
            id: idCounter++,
            x: x, y: y,
            rx: x / width, ry: y / height,
            r: 9 + Math.random() * 3,
            freq: freqForY(y),
            color: colorForY(y),
            baseInterval: 3.5 + Math.random() * 4.5,
            nextPulseTime: clock() + Math.random() * 3 + 1.2,
            cooldownUntil: 0,
            lastTriggerTime: -10,
            connections: []
        };
        orbs.push(orb);
        orbsById.set(orb.id, orb);
        updateOrbCountUI();
        if (!skipTrigger) {
            AudioEngine.resume();
        }
        return orb;
    }

    function removeOrb(orb) {
        if (!orb) return;
        const idx = orbs.indexOf(orb);
        if (idx === -1) return;
        orbs.splice(idx, 1);
        orbsById.delete(orb.id);
        pendingTriggers = pendingTriggers.filter(function (p) { return p.id !== orb.id; });
        updateOrbCountUI();
    }

    function clearOrbs() {
        orbs = [];
        orbsById.clear();
        pendingTriggers = [];
        ripples = [];
        updateOrbCountUI();
    }

    function findOrbAt(x, y) {
        let best = null, bestDist = Infinity;
        for (const o of orbs) {
            const d = Math.hypot(o.x - x, o.y - y);
            const hitR = Math.max(o.r + 14, 22);
            if (d <= hitR && d < bestDist) { best = o; bestDist = d; }
        }
        return best;
    }

    function computeConnections() {
        const reach = reachBase * (state.reachPercent / 100);
        for (const o of orbs) o.connections.length = 0;
        for (let i = 0; i < orbs.length; i++) {
            for (let j = i + 1; j < orbs.length; j++) {
                if (dist(orbs[i], orbs[j]) <= reach) {
                    orbs[i].connections.push(orbs[j]);
                    orbs[j].connections.push(orbs[i]);
                }
            }
        }
        return reach;
    }

    function triggerOrb(orb, opts) {
        opts = opts || {};
        const hops = opts.hops || 0;
        const now = clock();
        if (now < orb.cooldownUntil) return false;
        orb.cooldownUntil = now + ORB_COOLDOWN;
        orb.lastTriggerTime = now;
        orb.nextPulseTime = now + orb.baseInterval / state.tempo;

        const velocity = Math.pow(HOP_DECAY, hops);
        AudioEngine.playNote(orb.freq, {
            velocity: velocity,
            pan: (orb.x / Math.max(1, width)) * 2 - 1,
            waveform: state.waveform
        });

        ripples.push({
            x: orb.x, y: orb.y,
            born: now,
            color: orb.color,
            maxR: (reachBase * (state.reachPercent / 100)) * 1.05 || 140
        });

        noteCount++;
        updateNoteCountUI();

        if (hops < MAX_HOPS) {
            for (const nb of orb.connections) {
                if (now >= nb.cooldownUntil) {
                    const d = dist(orb, nb);
                    const delay = d / RIPPLE_SPEED;
                    pendingTriggers.push({ id: nb.id, fireAt: now + delay, hops: hops + 1 });
                }
            }
        }
        return true;
    }

    // ---------- starfield ----------
    function initStars() {
        stars = [];
        const count = Math.floor((width * height) / 9000);
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.3 + 0.3,
                speed: 0.4 + Math.random() * 1.2,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    // ---------- render ----------
    function isDark() {
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    function drawBackground(now) {
        const dark = isDark();
        ctx2d.fillStyle = dark ? '#05060d' : '#eef1fb';
        ctx2d.fillRect(0, 0, width, height);

        const stops = THEMES[state.themeKey] || THEMES.nebula;
        ctx2d.globalCompositeOperation = 'lighter';
        const blobs = [
            { cx: width * 0.25 + Math.sin(now * 0.05) * 60, cy: height * 0.3 + Math.cos(now * 0.04) * 40, color: stops[0] },
            { cx: width * 0.75 + Math.cos(now * 0.06) * 50, cy: height * 0.7 + Math.sin(now * 0.05) * 50, color: stops[1] },
            { cx: width * 0.5 + Math.sin(now * 0.03) * 80, cy: height * 0.5 + Math.cos(now * 0.07) * 60, color: stops[2] }
        ];
        blobs.forEach(function (b) {
            const grad = ctx2d.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, Math.max(width, height) * 0.4);
            const rgb = hexToRgb(b.color);
            grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${dark ? 0.08 : 0.05})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx2d.fillStyle = grad;
            ctx2d.fillRect(0, 0, width, height);
        });
        ctx2d.globalCompositeOperation = 'source-over';

        if (dark) {
            for (const s of stars) {
                const alpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(now * s.speed + s.phase));
                ctx2d.beginPath();
                ctx2d.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx2d.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
                ctx2d.fill();
            }
        }
    }

    function drawConnections(reach) {
        for (let i = 0; i < orbs.length; i++) {
            const a = orbs[i];
            for (const b of a.connections) {
                if (b.id < a.id) continue;
                const d = dist(a, b);
                const alpha = clamp(1 - d / reach, 0, 1) * 0.28;
                if (alpha <= 0.01) continue;
                const grad = ctx2d.createLinearGradient(a.x, a.y, b.x, b.y);
                grad.addColorStop(0, rgbaStr(a.color, alpha));
                grad.addColorStop(1, rgbaStr(b.color, alpha));
                ctx2d.strokeStyle = grad;
                ctx2d.lineWidth = 1;
                ctx2d.beginPath();
                ctx2d.moveTo(a.x, a.y);
                ctx2d.lineTo(b.x, b.y);
                ctx2d.stroke();
            }
        }
    }

    function drawOrbs(now) {
        for (const o of orbs) {
            const progress = clamp(1 - (o.nextPulseTime - now) / Math.max(0.1, o.baseInterval / state.tempo), 0, 1);
            const burst = clamp(1 - (now - o.lastTriggerTime) / 0.45, 0, 1);
            const r = o.r + progress * 2.5 + burst * 6;
            const glowR = r + 10 + burst * 22;

            const grad = ctx2d.createRadialGradient(o.x, o.y, 0, o.x, o.y, glowR);
            grad.addColorStop(0, rgbaStr(o.color, 0.55 + burst * 0.35));
            grad.addColorStop(1, rgbaStr(o.color, 0));
            ctx2d.fillStyle = grad;
            ctx2d.beginPath();
            ctx2d.arc(o.x, o.y, glowR, 0, Math.PI * 2);
            ctx2d.fill();

            ctx2d.beginPath();
            ctx2d.arc(o.x, o.y, r, 0, Math.PI * 2);
            ctx2d.fillStyle = rgbStr(o.color);
            ctx2d.fill();
            ctx2d.lineWidth = 1.5;
            ctx2d.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx2d.stroke();
        }
    }

    function drawRipples(now) {
        for (let i = ripples.length - 1; i >= 0; i--) {
            const rp = ripples[i];
            const age = Math.max(0, now - rp.born);
            const r = age * RIPPLE_SPEED;
            const alpha = clamp(1 - r / rp.maxR, 0, 1) * 0.5;
            if (alpha <= 0.01 || r > rp.maxR) { ripples.splice(i, 1); continue; }
            ctx2d.beginPath();
            ctx2d.arc(rp.x, rp.y, r, 0, Math.PI * 2);
            ctx2d.lineWidth = 1.5;
            ctx2d.strokeStyle = rgbaStr(rp.color, alpha);
            ctx2d.stroke();
        }
    }

    // ---------- main loop ----------
    function update(now) {
        const reach = computeConnections();

        for (const o of orbs) {
            if (now >= o.nextPulseTime) triggerOrb(o, { hops: 0 });
        }

        if (pendingTriggers.length) {
            const remaining = [];
            for (const p of pendingTriggers) {
                if (now >= p.fireAt) {
                    const orb = orbsById.get(p.id);
                    if (orb) triggerOrb(orb, { hops: p.hops });
                } else {
                    remaining.push(p);
                }
            }
            pendingTriggers = remaining;
        }

        drawBackground(now);
        drawConnections(reach);
        drawRipples(now);
        drawOrbs(now);
    }

    function loop() {
        update(clock());
        requestAnimationFrame(loop);
    }

    // ---------- resize ----------
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        reachBase = Math.min(width, height) * 0.22;
        for (const o of orbs) {
            o.x = o.rx * width;
            o.y = o.ry * height;
        }
        retuneAll();
        initStars();
    }

    // ---------- UI: stats ----------
    const orbCountEl = document.getElementById('orbCount');
    const noteCountEl = document.getElementById('noteCount');
    function updateOrbCountUI() { if (orbCountEl) orbCountEl.textContent = String(orbs.length); }
    function updateNoteCountUI() { if (noteCountEl) noteCountEl.textContent = String(noteCount); }

    // ---------- pointer interaction ----------
    let dragState = null;
    let lastTap = { id: null, time: 0 };

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: clamp(e.clientX - rect.left, 0, width), y: clamp(e.clientY - rect.top, 0, height) };
    }

    canvas.addEventListener('pointerdown', function (e) {
        AudioEngine.resume();
        const pos = getPos(e);
        const hit = findOrbAt(pos.x, pos.y);
        if (hit) {
            dragState = { orb: hit, isNew: false, moved: false, startX: pos.x, startY: pos.y };
        } else {
            const orb = addOrb(pos.x, pos.y, true);
            dragState = { orb: orb, isNew: true, moved: false, startX: pos.x, startY: pos.y };
        }
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!dragState) return;
        const pos = getPos(e);
        if (Math.hypot(pos.x - dragState.startX, pos.y - dragState.startY) > 6) dragState.moved = true;
        dragState.orb.x = pos.x;
        dragState.orb.y = pos.y;
        dragState.orb.rx = pos.x / width;
        dragState.orb.ry = pos.y / height;
        dragState.orb.freq = freqForY(pos.y);
        dragState.orb.color = colorForY(pos.y);
    });

    function endDrag(e) {
        if (!dragState) return;
        const orb = dragState.orb, isNew = dragState.isNew, moved = dragState.moved;
        dragState = null;

        if (!isNew && !moved) {
            const now = clock();
            if (lastTap.id === orb.id && (now - lastTap.time) < 0.35) {
                removeOrb(orb);
                lastTap = { id: null, time: 0 };
            } else {
                triggerOrb(orb, { hops: 0 });
                lastTap = { id: orb.id, time: now };
            }
        }
        scheduleSave();
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', function () { dragState = null; });

    // ---------- persistence ----------
    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveState, 700);
    }

    function saveState() {
        try {
            const data = {
                v: 1,
                scale: state.scale,
                root: state.root,
                themeKey: state.themeKey,
                waveform: state.waveform,
                tempo: state.tempo,
                reverbMix: state.reverbMix,
                reachPercent: state.reachPercent,
                volume: state.volume,
                orbs: orbs.map(function (o) { return { rx: o.rx, ry: o.ry }; })
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* private mode or storage disabled */ }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.orbs)) return false;

            state.scale = data.scale || state.scale;
            state.root = data.root || state.root;
            state.themeKey = data.themeKey || state.themeKey;
            state.waveform = data.waveform || state.waveform;
            state.tempo = typeof data.tempo === 'number' ? data.tempo : state.tempo;
            state.reverbMix = typeof data.reverbMix === 'number' ? data.reverbMix : state.reverbMix;
            state.reachPercent = typeof data.reachPercent === 'number' ? data.reachPercent : state.reachPercent;
            state.volume = typeof data.volume === 'number' ? data.volume : state.volume;

            data.orbs.forEach(function (o) {
                if (typeof o.rx === 'number' && typeof o.ry === 'number') {
                    addOrb(o.rx * width, o.ry * height, true);
                }
            });
            return orbs.length > 0;
        } catch (e) {
            return false;
        }
    }

    function seedDefaultConstellation() {
        const pts = [
            [0.28, 0.35], [0.4, 0.55], [0.55, 0.32], [0.68, 0.5], [0.5, 0.68]
        ];
        pts.forEach(function (p, i) {
            const orb = addOrb(p[0] * width, p[1] * height, true);
            orb.nextPulseTime = clock() + 1 + i * 0.6;
        });
    }

    // ---------- controls wiring ----------
    function bindPillGroup(selector, attr, onChange) {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                buttons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                onChange(btn.getAttribute(attr));
            });
        });
    }

    bindPillGroup('#scaleGrid .pill-btn', 'data-scale', function (val) {
        state.scale = val;
        retuneAll();
        scheduleSave();
    });

    bindPillGroup('#rootGrid .pill-btn', 'data-root', function (val) {
        state.root = val;
        retuneAll();
        AudioEngine.refreshDroneTuning();
        scheduleSave();
    });

    document.querySelectorAll('.color-swatch').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.color-swatch').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.themeKey = btn.getAttribute('data-theme');
            applyThemeVars();
            retuneAll();
            scheduleSave();
        });
    });

    const waveformSelect = document.getElementById('waveform');
    if (waveformSelect) {
        waveformSelect.addEventListener('change', function () {
            state.waveform = waveformSelect.value;
            scheduleSave();
        });
    }

    function bindSlider(id, valueId, format, onInput) {
        const input = document.getElementById(id);
        const label = document.getElementById(valueId);
        if (!input) return;
        input.addEventListener('input', function () {
            const v = parseFloat(input.value);
            if (label) label.textContent = format(v);
            onInput(v);
        });
    }

    bindSlider('tempo', 'tempoValue', function (v) { return v.toFixed(1) + '×'; }, function (v) {
        state.tempo = v;
        scheduleSave();
    });
    bindSlider('reverb', 'reverbValue', function (v) { return Math.round(v) + '%'; }, function (v) {
        AudioEngine.setReverbMix(v / 100);
        scheduleSave();
    });
    bindSlider('reach', 'reachValue', function (v) { return Math.round(v) + '%'; }, function (v) {
        state.reachPercent = v;
        scheduleSave();
    });
    bindSlider('volume', 'volumeValue', function (v) { return Math.round(v) + '%'; }, function (v) {
        AudioEngine.setVolume(v / 100);
        scheduleSave();
    });

    const droneBtn = document.getElementById('droneToggle');
    if (droneBtn) {
        droneBtn.addEventListener('click', function () {
            AudioEngine.resume();
            state.droneOn = !state.droneOn;
            droneBtn.setAttribute('aria-pressed', String(state.droneOn));
            const span = droneBtn.querySelector('span');
            if (span) span.textContent = state.droneOn ? 'Desligar camada de fundo' : 'Ligar camada de fundo';
            if (state.droneOn) AudioEngine.startDrone(); else AudioEngine.stopDrone();
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
            const next = !AudioEngine.isMuted();
            AudioEngine.setMute(next);
            muteBtn.classList.toggle('muted', next);
            const soundIcon = muteBtn.querySelector('.icon-sound');
            const muteIcon = muteBtn.querySelector('.icon-mute');
            if (soundIcon) soundIcon.style.display = next ? 'none' : 'block';
            if (muteIcon) muteIcon.style.display = next ? 'block' : 'none';
        });
    }

    // controls panel visibility
    const controlsPanel = document.querySelector('.controls');
    const toggleBtn = document.getElementById('toggleControls');
    const closeBtn = document.getElementById('closeControls');
    if (toggleBtn && closeBtn && controlsPanel) {
        toggleBtn.addEventListener('click', function () {
            controlsPanel.classList.add('visible');
            toggleBtn.classList.add('hidden');
        });
        closeBtn.addEventListener('click', function () {
            controlsPanel.classList.remove('visible');
            toggleBtn.classList.remove('hidden');
        });
    }

    // fullscreen
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
            const enter = document.querySelector('.fullscreen-enter');
            const exit = document.querySelector('.fullscreen-exit');
            const active = !!document.fullscreenElement;
            if (enter) enter.style.display = active ? 'none' : 'block';
            if (exit) exit.style.display = active ? 'block' : 'none';
        });
    }

    // ---------- init ----------
    applyThemeVars();
    resize();
    window.addEventListener('resize', resize);

    const hadSaved = loadState();
    if (!hadSaved) seedDefaultConstellation();

    // sync initial control UI to loaded state
    document.querySelectorAll('#scaleGrid .pill-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-scale') === state.scale);
    });
    document.querySelectorAll('#rootGrid .pill-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-root') === state.root);
    });
    document.querySelectorAll('.color-swatch').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-theme') === state.themeKey);
    });
    if (waveformSelect) waveformSelect.value = state.waveform;
    const tempoInput = document.getElementById('tempo');
    if (tempoInput) { tempoInput.value = String(state.tempo); document.getElementById('tempoValue').textContent = state.tempo.toFixed(1) + '×'; }
    const reverbInput = document.getElementById('reverb');
    if (reverbInput) { reverbInput.value = String(Math.round(state.reverbMix * 100)); document.getElementById('reverbValue').textContent = Math.round(state.reverbMix * 100) + '%'; }
    const reachInput = document.getElementById('reach');
    if (reachInput) { reachInput.value = String(state.reachPercent); document.getElementById('reachValue').textContent = Math.round(state.reachPercent) + '%'; }
    const volumeInput = document.getElementById('volume');
    if (volumeInput) { volumeInput.value = String(Math.round(state.volume * 100)); document.getElementById('volumeValue').textContent = Math.round(state.volume * 100) + '%'; }

    applyThemeVars();
    retuneAll();

    requestAnimationFrame(loop);
})();
