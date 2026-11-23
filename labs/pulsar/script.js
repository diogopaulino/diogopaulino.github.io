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
     *
     * Remaster — timing de verdade ("A Tale of Two Clocks", C. Wilson):
     *   O relógio musical é o do áudio (AudioContext.currentTime), não o rAF.
     *   Um agendador roda a cada 25 ms e marca notas até 120 ms à frente com
     *   precisão de amostra; o desenho só reage quando o áudio chega lá.
     *     tempo(beat) = âncora_t + (beat − âncora_beat) · 60/BPM
     *   Sem som liberado, o mesmo agendador usa performance.now() e o campo
     *   continua pulsando — em silêncio, com um aviso de como ligar o som.
     *   Mudar BPM/preset reancora a grade no beat atual (sem salto).
     *
     * Desempenho: brilhos são sprites pré-renderizados por faixa de cor
     * (24 por tema), o fundo (nebulosa) é cacheado num canvas e só as
     * estrelas piscam por frame — nada de createRadialGradient no laço.
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
    const MAX_VOICES = window.matchMedia('(pointer: coarse)').matches ? 14 : 22;
    const MAX_STARS = 160;
    const STORAGE_KEY = 'pulsar-state-v3';
    const DPR_CAP = 2;
    const LOOKAHEAD = 0.12;      // s de antecedência no agendamento
    const SCHED_EVERY = 25;      // ms entre rodadas do agendador
    const COLOR_BUCKETS = 24;

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

    const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = reduceMotionMq.matches;

    let width = 0;
    let height = 0;
    let reachBase = 0;
    let orbs = [];
    const orbsById = new Map();
    let idCounter = 1;
    let echoes = [];   // ecos aguardando agendamento: { id, at, hops }
    let visuals = [];  // eventos visuais aguardando o áudio: { kind, id, at, ... }
    let ripples = [];
    let sparks = [];
    let stars = [];
    let connectionsDirty = true;
    let cachedReach = 140;
    let downbeatFlash = 0;
    let ghost = null;
    let dragState = null;
    let lastTap = { id: null, time: 0 };
    let saveTimer = 0;
    let finePointer = true;
    let bgLayer = null;
    let bgDirty = true;
    let sprites = null;

    const hudPreset = document.getElementById('hudPreset');
    const hudMeta = document.getElementById('hudMeta');
    const presetNameEl = document.getElementById('presetName');

    function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function perfNow() { return performance.now() * 0.001; }
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
    function bucketForY(y) { return Math.min(COLOR_BUCKETS - 1, (tForY(y) * COLOR_BUCKETS) | 0); }

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

    // ---------------------------------------------------------------------
    // Sprites de brilho (um por faixa de cor) — trocados com tema/preset
    // ---------------------------------------------------------------------

    function makeSprite(size, draw) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        draw(c.getContext('2d'), size);
        return c;
    }

    function buildSprites() {
        const dark = isDark();
        const glow = [];
        const body = [];
        const css = [];
        for (let i = 0; i < COLOR_BUCKETS; i++) {
            const col = colorForT((i + 0.5) / COLOR_BUCKETS);
            css.push('rgb(' + col.r + ',' + col.g + ',' + col.b + ')');
            glow.push(makeSprite(128, function (g, s) {
                const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
                gr.addColorStop(0, rgba(col, dark ? 0.75 : 0.55));
                gr.addColorStop(0.35, rgba(col, dark ? 0.3 : 0.2));
                gr.addColorStop(1, rgba(col, 0));
                g.fillStyle = gr;
                g.fillRect(0, 0, s, s);
            }));
            body.push(makeSprite(64, function (g, s) {
                const r = s / 2;
                const gr = g.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
                gr.addColorStop(0, dark ? '#fff' : 'rgba(255,255,255,0.95)');
                gr.addColorStop(0.35, rgba(col, 1));
                gr.addColorStop(1, rgba(col, 0.75));
                g.fillStyle = gr;
                g.beginPath();
                g.arc(r, r, r - 0.5, 0, Math.PI * 2);
                g.fill();
            }));
        }
        sprites = { glow: glow, body: body, css: css };
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
        buildSprites();
        bgDirty = true;
    }

    function retuneOrb(o) {
        o.freq = freqForY(o.y);
        o.bucket = bucketForY(o.y);
        o.period = periodForY(o.y);
        o.phase = phaseForX(o.x, o.period);
        o.r = radiusForPeriod(o.period);
    }

    function retuneAll() {
        for (let i = 0; i < orbs.length; i++) retuneOrb(orbs[i]);
        connectionsDirty = true;
    }

    // ---------------------------------------------------------------------
    // Áudio
    // ---------------------------------------------------------------------

    const AudioEngine = (function () {
        let actx = null;
        let master = null;
        let wet = null;
        let muted = false;
        let unsupported = false;
        let everRan = false;
        let drone = null;
        const voices = [];
        let onState = function () {};

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
            if (actx || unsupported) return actx;
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { unsupported = true; onState(); return null; }
            try {
                actx = new AC({ latencyHint: 'interactive' });
            } catch (err) {
                try { actx = new AC(); } catch (err2) { unsupported = true; onState(); return null; }
            }
            try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (err) { /* opcional */ }
            master = actx.createGain();
            master.gain.value = muted ? 0 : state.volume;
            const dry = actx.createGain();
            dry.gain.value = 1;
            wet = actx.createGain();
            wet.gain.value = getPreset().reverbMix;
            const conv = actx.createConvolver();
            try { conv.buffer = impulse(1.7, 2.6); } catch (err) { /* sem reverb */ }
            const comp = actx.createDynamicsCompressor();
            comp.threshold.value = -18;
            comp.knee.value = 10;
            comp.ratio.value = 5;
            comp.attack.value = 0.004;
            comp.release.value = 0.16;
            // Teto final: impede clipping quando muitos ecos coincidem.
            const limiter = actx.createDynamicsCompressor();
            limiter.threshold.value = -2;
            limiter.knee.value = 0;
            limiter.ratio.value = 20;
            limiter.attack.value = 0.001;
            limiter.release.value = 0.08;
            master.connect(dry);
            dry.connect(comp);
            master.connect(wet);
            wet.connect(conv);
            conv.connect(comp);
            comp.connect(limiter);
            limiter.connect(actx.destination);
            actx.onstatechange = function () {
                if (actx.state === 'running') everRan = true;
                onState();
            };
            return actx;
        }

        function resume() {
            if (!ensure()) return;
            if (actx.state !== 'running') {
                try {
                    const s = actx.createBufferSource();
                    s.buffer = actx.createBuffer(1, 1, actx.sampleRate);
                    s.connect(actx.destination);
                    s.start(0);
                } catch (err) { /* noop */ }
                const p = actx.resume();
                if (p && p.then) p.then(onState, onState);
            }
        }

        function running() { return !!actx && actx.state === 'running'; }
        function time() { return actx ? actx.currentTime : 0; }

        function status() {
            if (unsupported) return 'unsupported';
            if (!actx) return 'idle';
            if (actx.state === 'running') return 'running';
            return everRan ? 'paused' : 'idle';
        }

        function setMute(m) {
            muted = m;
            if (master && actx) master.gain.setTargetAtTime(m ? 0 : state.volume, actx.currentTime, 0.05);
        }

        function setReverb(v) {
            if (wet && actx) wet.gain.setTargetAtTime(v, actx.currentTime, 0.12);
        }

        // Polifonia: acima do teto, ecos são descartados e, para notas
        // principais, a voz mais antiga é roubada com fade de 15 ms.
        function playNote(freq, opts) {
            opts = opts || {};
            if (!running()) return;
            const hops = opts.hops || 0;
            const t0 = Math.max(actx.currentTime, opts.when || 0);
            for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= actx.currentTime) voices.splice(i, 1);
            if (voices.length >= MAX_VOICES) {
                if (hops > 0) return;
                const old = voices.shift();
                try {
                    old.g.gain.cancelScheduledValues(t0);
                    old.g.gain.setTargetAtTime(0.0001, t0, 0.005);
                    old.o1.stop(t0 + 0.05);
                    old.o2.stop(t0 + 0.05);
                } catch (err) { /* já parou */ }
            }

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
            filter.frequency.setValueAtTime(Math.min(16000, cutoff), t0);
            filter.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.35), t0 + 0.7);

            // Envelope: ataque exponencial de 12 ms (sem clique), decaimento em
            // dois estágios e cauda até -80 dB antes do stop.
            const peak = (hops ? 0.16 : 0.22) * vel;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
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

            osc1.start(t0);
            osc2.start(t0);
            osc1.stop(t0 + 1.75);
            osc2.stop(t0 + 1.75);
            const voice = { g: g, o1: osc1, o2: osc2, end: t0 + 1.75 };
            voices.push(voice);
            osc1.onended = function () {
                const i = voices.indexOf(voice);
                if (i !== -1) voices.splice(i, 1);
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
            if (!running() || drone) return;
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
            g.gain.setTargetAtTime(0.13, t0, 0.7);
            drone = { g: g, oscs: oscs, lfo: lfo };
        }

        function stopDrone() {
            if (!actx || !drone) return;
            const t0 = actx.currentTime;
            const nodes = drone;
            drone = null;
            nodes.g.gain.cancelScheduledValues(t0);
            nodes.g.gain.setTargetAtTime(0.0001, t0, 0.3);
            nodes.oscs.forEach(function (n) { try { n.o.stop(t0 + 1.6); } catch (err) { /* noop */ } });
            try { nodes.lfo.stop(t0 + 1.6); } catch (err) { /* noop */ }
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

        function suspend() {
            if (actx && actx.state === 'running') actx.suspend().then(onState, onState);
        }

        return {
            resume: resume,
            running: running,
            time: time,
            status: status,
            hasDrone: function () { return !!drone; },
            setMute: setMute,
            isMuted: function () { return muted; },
            setReverb: setReverb,
            playNote: playNote,
            startDrone: startDrone,
            stopDrone: stopDrone,
            refreshDrone: refreshDrone,
            suspend: suspend,
            onStateChange: function (fn) { onState = fn; }
        };
    })();

    // ---------------------------------------------------------------------
    // Relógio musical + agendador com lookahead
    // ---------------------------------------------------------------------

    const Clock = (function () {
        let source = 'perf';
        let anchorTime = 0;
        let anchorBeat = 0;
        let nextBeat = 0;
        let timer = 0;

        function now() { return source === 'audio' ? AudioEngine.time() : perfNow(); }
        function beatAt(t) { return anchorBeat + (t - anchorTime) / beatDuration(); }
        function timeOfBeat(b) { return anchorTime + (b - anchorBeat) * beatDuration(); }
        function currentBeat() { return beatAt(now()); }

        // Reancora preservando a posição no compasso (troca de BPM ou de
        // relógio não "pula" nem dispara rajadas atrasadas).
        function reanchor() {
            const wanted = AudioEngine.running() ? 'audio' : 'perf';
            const beat = anchorTime ? currentBeat() : 0;
            source = wanted;
            anchorTime = now();
            anchorBeat = beat;
            nextBeat = Math.ceil(beat - 1e-6);
            echoes = [];
        }

        function tick() {
            if (!state.playing || document.hidden) return;
            const wanted = AudioEngine.running() ? 'audio' : 'perf';
            if (wanted !== source) reanchor();
            const horizon = now() + LOOKAHEAD;
            let guard = 0;
            while (timeOfBeat(nextBeat) < horizon && guard++ < 16) {
                const b = nextBeat;
                const at = timeOfBeat(b);
                if (b % 4 === 0) visuals.push({ kind: 'downbeat', at: at });
                for (let i = 0; i < orbs.length; i++) {
                    const o = orbs[i];
                    if (((b % o.period) + o.period) % o.period === o.phase) scheduleTrigger(o, at, 0, b);
                }
                nextBeat++;
            }
            if (echoes.length) {
                echoes.sort(function (a, b) { return a.at - b.at; });
                while (echoes.length && echoes[0].at < horizon) {
                    const e = echoes.shift();
                    const orb = orbsById.get(e.id);
                    if (orb) scheduleTrigger(orb, e.at, e.hops, null);
                }
            }
        }

        function start() {
            if (timer) return;
            reanchor();
            timer = setInterval(tick, SCHED_EVERY);
            tick();
        }

        function stop() {
            clearInterval(timer);
            timer = 0;
            echoes = [];
        }

        return { now: now, currentBeat: currentBeat, start: start, stop: stop, reanchor: reanchor, tick: tick, source: function () { return source; } };
    })();

    // clockBeat: número do beat quando o disparo vem da grade (senão null).
    function scheduleTrigger(orb, at, hops, clockBeat) {
        if (at - orb.lastScheduled < 0.08) return false;
        orb.lastScheduled = at;
        AudioEngine.playNote(orb.freq, {
            when: at,
            velocity: Math.pow(HOP_DECAY, hops),
            pan: (orb.x / Math.max(1, width)) * 2 - 1,
            waveform: getPreset().waveform,
            hops: hops
        });
        visuals.push({ kind: 'trigger', id: orb.id, at: at, hops: hops });

        if (hops < MAX_HOPS) {
            const beatHalf = beatDuration() * 0.5;
            for (let i = 0; i < orb.connections.length; i++) {
                const nb = orb.connections[i];
                if (at - nb.lastScheduled < 0.12) continue;
                // Vizinho que já dispara sozinho neste beat não ganha eco duplicado.
                if (clockBeat != null && (((clockBeat % nb.period) + nb.period) % nb.period === nb.phase)) continue;
                const d = dist(orb, nb);
                const delay = Math.max(beatHalf, Math.round(d / RIPPLE_SPEED / beatHalf) * beatHalf);
                echoes.push({ id: nb.id, at: at + delay, hops: hops + 1 });
                visuals.push({ kind: 'spark', id: orb.id, to: nb.id, at: at, dur: delay });
            }
        }
        return true;
    }

    // Toque direto do usuário: soa já (não espera o próximo beat).
    function triggerNow(orb) {
        Clock.tick();
        scheduleTrigger(orb, Clock.now() + 0.005, 0, null);
    }

    // Dispara efeitos visuais quando o relógio (áudio) alcança o evento.
    function flushVisuals(tPerf) {
        if (!visuals.length) return;
        const clockNow = Clock.now();
        let w = 0;
        for (let i = 0; i < visuals.length; i++) {
            const v = visuals[i];
            if (v.at > clockNow) { visuals[w++] = v; continue; }
            if (v.kind === 'downbeat') {
                downbeatFlash = 1;
            } else if (v.kind === 'trigger') {
                const orb = orbsById.get(v.id);
                if (orb) {
                    orb.lastTrigger = tPerf;
                    if (ripples.length < 60) {
                        ripples.push({ x: orb.x, y: orb.y, born: tPerf, bucket: orb.bucket, maxR: cachedReach * 0.95 || 120 });
                    }
                }
            } else if (v.kind === 'spark' && !reduceMotion) {
                const a = orbsById.get(v.id);
                const b = orbsById.get(v.to);
                if (a && b && sparks.length < 80) {
                    sparks.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, born: tPerf, dur: v.dur, bucket: a.bucket });
                }
            }
        }
        visuals.length = w;
    }

    // ---------------------------------------------------------------------
    // Orbes
    // ---------------------------------------------------------------------

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
            bucket: 0,
            period: 4,
            phase: 0,
            lastTrigger: -10,
            lastScheduled: -10,
            connections: []
        };
        retuneOrb(orb);
        orbs.push(orb);
        orbsById.set(orb.id, orb);
        markConnectionsDirty();
        if (!opts.silent) {
            if (connectionsDirty) computeConnections();
            triggerNow(orb);
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
        echoes = echoes.filter(function (p) { return p.id !== orb.id; });
        markConnectionsDirty();
        updateHud();
    }

    function clearOrbs() {
        orbs = [];
        orbsById.clear();
        echoes = [];
        visuals = [];
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

    // ---------------------------------------------------------------------
    // Desenho
    // ---------------------------------------------------------------------

    function initField() {
        const count = Math.min(MAX_STARS, Math.max(48, ((width * height) / 14000) | 0));
        stars = new Array(count);
        for (let i = 0; i < count; i++) {
            stars[i] = {
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.25 + 0.4,
                a: 0.25 + Math.random() * 0.55,
                s: 0.35 + Math.random() * 1.4,
                p: Math.random() * Math.PI * 2
            };
        }
        bgDirty = true;
    }

    // Nebulosa pré-renderizada: 3 gradientes pagos uma vez por resize/tema.
    function renderBackgroundLayer() {
        const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1) * 0.5; // nebulosa é borrada: meia resolução basta
        if (!bgLayer) bgLayer = document.createElement('canvas');
        bgLayer.width = Math.max(1, (width * dpr) | 0);
        bgLayer.height = Math.max(1, (height * dpr) | 0);
        const g = bgLayer.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const dark = isDark();
        g.clearRect(0, 0, width, height);
        const stops = THEMES[getPreset().themeKey];
        const nebula = [
            { x: width * 0.22, y: height * 0.28, r: Math.min(width, height) * 0.55 },
            { x: width * 0.78, y: height * 0.62, r: Math.min(width, height) * 0.6 },
            { x: width * 0.5, y: height * 0.42, r: Math.min(width, height) * 0.42 }
        ];
        g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        for (let i = 0; i < nebula.length; i++) {
            const n = nebula[i];
            const col = hexToRgb(stops[i]);
            const gr = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            gr.addColorStop(0, rgba(col, dark ? 0.24 : 0.14));
            gr.addColorStop(1, rgba(col, 0));
            g.fillStyle = gr;
            g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
        }
        bgDirty = false;
    }

    function drawBackground(t) {
        const dark = isDark();
        if (bgDirty) renderBackgroundLayer();
        ctx.fillStyle = dark ? '#05060d' : '#e7ebf8';
        ctx.fillRect(0, 0, width, height);

        // A nebulosa "respira" no tempo forte do compasso.
        const pulse = 0.85 + downbeatFlash * (reduceMotion ? 0.05 : 0.2);
        const wob = reduceMotion ? 0 : Math.sin(t * 0.12) * 10;
        ctx.globalAlpha = clamp(pulse, 0, 1);
        ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
        ctx.drawImage(bgLayer, wob - 12, -6, width + 24, height + 12);

        ctx.globalCompositeOperation = dark ? 'screen' : 'source-over';
        ctx.fillStyle = dark ? '#ffffff' : '#28325a';
        const k = dark ? 0.7 : 0.35;
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const tw = reduceMotion ? 0.75 : 0.45 + 0.55 * Math.sin(t * s.s + s.p);
            ctx.globalAlpha = s.a * tw * k;
            ctx.fillRect(s.x - s.r * 0.5, s.y - s.r * 0.5, s.r, s.r);
        }
        ctx.globalAlpha = 1;
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
                ctx.strokeStyle = sprites.css[a.bucket];
                ctx.globalAlpha = Math.min(1, base + live * 0.45);
                ctx.lineWidth = 1 + live * 1.8;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawSparks(t) {
        if (!sparks.length) return;
        ctx.globalCompositeOperation = isDark() ? 'screen' : 'source-over';
        let w = 0;
        for (let i = 0; i < sparks.length; i++) {
            const s = sparks[i];
            const u = (t - s.born) / s.dur;
            if (u >= 1) continue;
            sparks[w++] = s;
            const x = s.ax + (s.bx - s.ax) * u;
            const y = s.ay + (s.by - s.ay) * u;
            ctx.globalAlpha = 0.95;
            ctx.drawImage(sprites.glow[s.bucket], x - 12, y - 12, 24, 24);
        }
        sparks.length = w;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawRipples(t) {
        if (!ripples.length) return;
        ctx.globalCompositeOperation = isDark() ? 'screen' : 'source-over';
        let w = 0;
        for (let i = 0; i < ripples.length; i++) {
            const rp = ripples[i];
            const age = Math.max(0, t - rp.born);
            // Movimento reduzido: anel curto e fixo em vez da onda que se expande.
            const r = reduceMotion ? 18 + age * 20 : age * RIPPLE_SPEED;
            const life = reduceMotion ? 1 - age / 0.5 : 1 - r / rp.maxR;
            const alpha = clamp(life, 0, 1) * 0.55;
            if (alpha < 0.02) continue;
            ripples[w++] = rp;
            ctx.strokeStyle = sprites.css[rp.bucket];
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
            ctx.lineWidth = 2.8 - clamp(r / rp.maxR, 0, 1) * 1.6;
            ctx.globalAlpha = Math.min(1, alpha * 1.15);
            ctx.stroke();
            if (alpha > 0.2 && !reduceMotion) {
                ctx.beginPath();
                ctx.arc(rp.x, rp.y, r * 0.72, 0, Math.PI * 2);
                ctx.lineWidth = 1.2;
                ctx.globalAlpha = alpha * 0.45;
                ctx.stroke();
            }
        }
        ripples.length = w;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawOrb(o, t, beats, ghosted) {
        const local = ((beats % o.period) + o.period) % o.period;
        const until = (o.phase - local + o.period) % o.period;
        const approach = until < 0.55 ? 1 - until / 0.55 : 0;
        const burst = clamp(1 - (t - o.lastTrigger) / 0.55, 0, 1);
        const breath = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(beats * Math.PI * 2 / Math.max(1, o.period) + o.phase);
        const r = o.r + approach * 2.6 + burst * (reduceMotion ? 3 : 7.5) + breath * 0.8;
        const glowR = r + 16 + burst * 34 + approach * 8;
        const base = ghosted ? 0.38 : 1;

        ctx.globalAlpha = base * Math.min(1, 0.75 + burst * 0.5);
        ctx.drawImage(sprites.glow[o.bucket], o.x - glowR, o.y - glowR, glowR * 2, glowR * 2);

        if (burst > 0.05 && !ghosted) {
            ctx.strokeStyle = sprites.css[o.bucket];
            ctx.globalAlpha = burst * 0.55;
            ctx.lineWidth = 2 + burst * 2;
            ctx.beginPath();
            ctx.arc(o.x, o.y, r + 10 + (1 - burst) * 28, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = base;
        ctx.drawImage(sprites.body[o.bucket], o.x - r, o.y - r, r * 2, r * 2);

        if (approach > 0.05 && !ghosted) {
            ctx.strokeStyle = sprites.css[o.bucket];
            ctx.globalAlpha = approach * 0.6;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(o.x, o.y, r + 6 + (1 - approach) * 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawOrbs(t) {
        const beats = Clock.currentBeat();
        ctx.globalCompositeOperation = isDark() ? 'screen' : 'source-over';
        for (let i = 0; i < orbs.length; i++) drawOrb(orbs[i], t, beats, false);
        if (ghost) drawOrb(ghost, t, beats, true);
        ctx.globalCompositeOperation = 'source-over';
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
        const t = perfNow();
        downbeatFlash *= 0.9;
        if (connectionsDirty) computeConnections();
        if (state.playing) Clock.tick();
        flushVisuals(t);
        drawBackground(t);
        drawConnections(t);
        drawRipples(t);
        drawSparks(t);
        drawOrbs(t);
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

    // ---------------------------------------------------------------------
    // Entrada
    // ---------------------------------------------------------------------

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
            bucket: bucketForY(y),
            period: period,
            phase: phaseForX(x, period),
            lastTrigger: -10
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (dragState) return; // um orbe por vez (multitoque não duplica)
        AudioEngine.resume();
        const pos = getPos(e);
        ghost = null;
        const hit = findOrbAt(pos.x, pos.y);
        if (hit) {
            dragState = { orb: hit, isNew: false, moved: false, startX: pos.x, startY: pos.y, pointerId: e.pointerId };
        } else {
            const orb = addOrb(pos.x, pos.y);
            dragState = { orb: orb, isNew: true, moved: false, startX: pos.x, startY: pos.y, pointerId: e.pointerId };
        }
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already up */ }
        hideHint();
    });

    canvas.addEventListener('pointermove', function (e) {
        const pos = getPos(e);
        if (dragState) {
            if (e.pointerId !== dragState.pointerId) return;
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

    function endDrag(e) {
        if (!dragState || (e && e.pointerId !== dragState.pointerId)) return;
        const orb = dragState.orb;
        const isNew = dragState.isNew;
        const moved = dragState.moved;
        dragState = null;
        if (!isNew && !moved) {
            const t = perfNow();
            if (lastTap.id === orb.id && (t - lastTap.time) < 0.42) {
                removeOrb(orb);
                lastTap = { id: null, time: 0 };
            } else {
                triggerNow(orb);
                lastTap = { id: orb.id, time: t };
            }
        } else if (moved && orbsById.has(orb.id)) {
            // Soltar depois de afinar: ouve a nova altura.
            if (connectionsDirty) computeConnections();
            triggerNow(orb);
        }
        scheduleSave();
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', function (e) {
        if (dragState && e.pointerId === dragState.pointerId) dragState = null;
    });

    let hintHidden = false;
    function hideHint() {
        if (hintHidden) return;
        hintHidden = true;
        const hint = document.getElementById('hint');
        if (hint) hint.classList.add('is-gone');
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveState, 500);
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                v: 3,
                presetIndex: state.presetIndex,
                muted: AudioEngine.isMuted(),
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
            if (data.muted) setMuted(true);
            data.orbs.slice(0, MAX_ORBS).forEach(function (o) {
                if (typeof o.rx === 'number' && typeof o.ry === 'number') {
                    addOrb(clamp(o.rx, 0, 1) * width, clamp(o.ry, 0, 1) * height, { silent: true });
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

    function applyPreset(index) {
        AudioEngine.resume();
        state.presetIndex = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
        applyThemeVars();
        retuneAll();
        AudioEngine.setReverb(getPreset().reverbMix);
        AudioEngine.refreshDrone();
        Clock.reanchor(); // novo BPM continua do beat atual
        updateHud();
        scheduleSave();
    }

    function setPlaying(on) {
        state.playing = on;
        const btn = document.getElementById('playPause');
        if (on) Clock.reanchor();
        else { echoes = []; }
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? 'Pausar' : 'Tocar');
        btn.setAttribute('title', on ? 'Pausar (Espaço)' : 'Tocar (Espaço)');
        const pauseIcon = btn.querySelector('.icon-pause');
        const playIcon = btn.querySelector('.icon-play');
        if (pauseIcon) pauseIcon.hidden = !on;
        if (playIcon) playIcon.hidden = on;
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
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? 'Ligar som' : 'Mudo');
        const sound = btn.querySelector('.icon-sound');
        const mute = btn.querySelector('.icon-mute');
        if (sound) sound.hidden = on;
        if (mute) mute.hidden = !on;
        renderAudioStatus();
    }

    // ---------------------------------------------------------------------
    // Aviso de áudio: nunca mudo sem explicação
    // ---------------------------------------------------------------------

    const audioChip = document.getElementById('audioStatus');
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let chipTimer = 0;
    let lastStatus = 'idle';

    function renderAudioStatus() {
        if (!audioChip) return;
        const st = AudioEngine.status();
        const text = audioChip.querySelector('.audio-status-text');
        audioChip.dataset.state = st;
        clearTimeout(chipTimer);
        if (st === 'running') {
            if (AudioEngine.isMuted()) {
                audioChip.hidden = false;
                text.textContent = 'Mudo ligado — toque no alto-falante (M) para ouvir.';
            } else {
                text.textContent = 'Som ativo';
                audioChip.hidden = lastStatus === 'running';
                if (!audioChip.hidden) chipTimer = setTimeout(function () { audioChip.hidden = true; }, 1300);
            }
        } else if (st === 'unsupported') {
            audioChip.hidden = false;
            text.textContent = 'Sem Web Audio neste navegador — o campo pulsa em silêncio.';
        } else {
            audioChip.hidden = false;
            const base = st === 'paused' ? 'Som pausado — toque para retomar.' : 'Os orbes estão pulsando em silêncio — toque para ligar o som.';
            text.textContent = isIOS ? base + ' No iPhone, suba o volume e confira o modo silencioso.' : base;
        }
        lastStatus = st;
    }

    AudioEngine.onStateChange(function () {
        renderAudioStatus();
        if (AudioEngine.running()) {
            if (state.droneOn) AudioEngine.startDrone();
            Clock.reanchor();
        }
    });

    if (audioChip) {
        audioChip.addEventListener('click', function () {
            AudioEngine.resume();
            if (AudioEngine.isMuted()) setMuted(false);
        });
    }

    // ---------------------------------------------------------------------
    // Botões e teclado
    // ---------------------------------------------------------------------

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
            scheduleSave();
        });
    }

    const fullscreenBtn = document.getElementById('fullscreen');
    if (fullscreenBtn) {
        if (!document.fullscreenEnabled) fullscreenBtn.hidden = true;
        fullscreenBtn.addEventListener('click', function () {
            if (!document.fullscreenElement) {
                const req = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
                if (req && req.catch) req.catch(function () { /* noop */ });
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
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.code === 'Space') {
            if (tag === 'BUTTON') return; // o botão focado já trata o Espaço
            e.preventDefault();
            AudioEngine.resume();
            setPlaying(!state.playing);
        } else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
            applyPreset(Number(e.key) - 1);
        } else if (e.key === 'd' || e.key === 'D') {
            AudioEngine.resume();
            setDrone(!state.droneOn);
        } else if (e.key === 'c' || e.key === 'C') {
            clearOrbs();
            scheduleSave();
        } else if (e.key === 'm' || e.key === 'M') {
            AudioEngine.resume();
            setMuted(!AudioEngine.isMuted());
            scheduleSave();
        } else if (e.key === 'f' || e.key === 'F') {
            if (fullscreenBtn && !fullscreenBtn.hidden) fullscreenBtn.click();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            if (orbs.length) {
                removeOrb(orbs[orbs.length - 1]);
                scheduleSave();
            }
        }
    });

    if (window.LabTheme) {
        LabTheme.onChange(function () {
            applyThemeVars();
        });
    } else {
        const themeObs = new MutationObserver(function () {
            applyThemeVars();
        });
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    const onMotionChange = function () { reduceMotion = reduceMotionMq.matches; };
    if (reduceMotionMq.addEventListener) reduceMotionMq.addEventListener('change', onMotionChange);
    else if (reduceMotionMq.addListener) reduceMotionMq.addListener(onMotionChange);

    // Aba oculta: para o agendador, solta o drone e suspende o áudio depois
    // da cauda (economia de bateria). Na volta, reancora a grade.
    let suspendTimer = 0;
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            Clock.stop();
            visuals = [];
            suspendTimer = setTimeout(function () { if (document.hidden) AudioEngine.suspend(); }, 1800);
        } else {
            clearTimeout(suspendTimer);
            if (AudioEngine.status() === 'paused') AudioEngine.resume();
            Clock.start();
            renderAudioStatus();
        }
    });
    const wake = function () { if (AudioEngine.status() === 'paused') AudioEngine.resume(); };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);

    finePointer = window.matchMedia('(pointer: fine)').matches;
    applyThemeVars();
    resize();
    if (window.LabRuntime) LabRuntime.debounceResize(resize);
    else window.addEventListener('resize', resize);

    if (!loadState()) seedDefault();
    applyThemeVars();
    retuneAll();
    updateHud();
    renderAudioStatus();
    Clock.start();
    if (window.LabRuntime) {
        LabRuntime.createLoop(frame).start();
    } else {
        const fallbackLoop = () => {
            if (document.hidden) return;
            frame();
            requestAnimationFrame(fallbackLoop);
        };
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) requestAnimationFrame(fallbackLoop);
        });
        requestAnimationFrame(fallbackLoop);
    }
})();
