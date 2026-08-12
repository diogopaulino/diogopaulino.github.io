/**
 * Winamp 2.91 — recriação 100% vanilla (HTML + CSS + Web Audio API).
 *
 * Nada é baixado: a interface é CSS puro e as faixas demo são *chiptune*
 * sintetizado no navegador. Cada música é descrita como um mini "tracker"
 * (padrões de 16 passos por compasso) e renderizada para um AudioBuffer PCM
 * com osciladores calculados à mão (pulse / triangle / ruído + bateria).
 */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/* ==========================================================================
   1. TEORIA MUSICAL — notas, frequências e acordes
   ========================================================================== */

const PITCH_CLASS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "C#4" | "Eb3" | "a4" → número MIDI. */
function noteToMidi(name) {
    const match = /^([a-gA-G])([#b]?)(-?\d)$/.exec(name);
    if (!match) return null;
    const [, letter, accidental, octave] = match;
    const semitone = PITCH_CLASS[letter.toLowerCase()] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
    return (Number(octave) + 1) * 12 + semitone;
}

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const CHORD_SHAPES = {
    "": [0, 4, 7],
    m: [0, 3, 7],
    7: [0, 4, 7, 10],
    m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11],
    sus4: [0, 5, 7]
};

/** "Am" | "Fmaj7" → lista de notas MIDI na oitava pedida. */
function chordNotes(symbol, octave) {
    const match = /^([A-G][#b]?)(m7|maj7|sus4|m|7)?$/.exec(symbol);
    if (!match) return [];
    const root = noteToMidi(`${match[1]}${octave}`);
    return (CHORD_SHAPES[match[2] || ""] || CHORD_SHAPES[""]).map((interval) => root + interval);
}

/* ==========================================================================
   2. TRILHA — definição das músicas (tracker de 16 passos por compasso)
   ========================================================================== */

const SONGS = [
    {
        title: "Neon Boulevard",
        artist: "Chiptune Engine",
        bpm: 128,
        bars: 20,
        chords: ["Am", "Am", "F", "F", "C", "C", "G", "G"],
        lead: [
            "a4 . c5 . e5 - - . d5 . c5 - b4 - - .",
            "a4 . . . f4 - g4 - a4 - - - . . . .",
            "c5 . b4 . g4 - a4 . c5 - - - . . . .",
            "g4 . a4 . b4 - c5 - d5 - - - - . . ."
        ],
        arpOctave: 4,
        bassOctave: 2,
        drums: "four",
        introBars: 2,
        leadFrom: 4
    },
    {
        title: "Crystal Cave",
        artist: "Chiptune Engine",
        bpm: 96,
        bars: 16,
        chords: ["Dm", "Am", "Bb", "F"],
        lead: [
            "d5 - - . f5 - - . a5 - - - - . . .",
            "e5 - - . c5 - - . a4 - - - - . . .",
            "f5 . e5 . d5 - c5 - d5 - - - - . . .",
            ". . a4 . c5 - d5 - f5 - - - - - . ."
        ],
        arpOctave: 4,
        bassOctave: 2,
        drums: "soft",
        introBars: 2,
        leadFrom: 2
    },
    {
        title: "Turbo Circuit",
        artist: "Chiptune Engine",
        bpm: 152,
        bars: 24,
        chords: ["Em", "Em", "C", "C", "G", "G", "D", "D"],
        lead: [
            "e5 . e5 . g5 . e5 . d5 . b4 - - . . .",
            "e5 . g5 . b5 - a5 . g5 - e5 - - . . .",
            "c5 . d5 . e5 - g5 - a5 - - . g5 . e5 .",
            "d5 . e5 . f#5 - a5 - b5 - - - - . . ."
        ],
        arpOctave: 4,
        bassOctave: 2,
        drums: "break",
        introBars: 2,
        leadFrom: 4
    },
    {
        title: "Pixel Sunrise",
        artist: "Chiptune Engine",
        bpm: 112,
        bars: 18,
        chords: ["C", "G", "Am", "F"],
        lead: [
            "g4 . a4 . c5 - - . e5 - d5 - c5 - - .",
            "b4 . c5 . d5 - - . g5 - - - - . . .",
            "e5 . d5 . c5 - a4 - g4 - - - - . . .",
            "f4 . g4 . a4 - c5 - e5 - d5 - c5 - - ."
        ],
        arpOctave: 4,
        bassOctave: 2,
        drums: "rock",
        introBars: 2,
        leadFrom: 2
    },
    {
        title: "Midnight Modem",
        artist: "Chiptune Engine",
        bpm: 104,
        bars: 16,
        chords: ["Am7", "Dm7", "G7", "Cmaj7"],
        lead: [
            ". . e4 . g4 - a4 - c5 - - . b4 - - .",
            ". . d4 . f4 - a4 - d5 - - - - . . .",
            "b4 . d5 . f5 - e5 - d5 - - . b4 . g4 .",
            "e4 - - . g4 - b4 - e5 - - - - - . ."
        ],
        arpOctave: 4,
        bassOctave: 2,
        drums: "soft",
        introBars: 2,
        leadFrom: 2
    }
];

const songDuration = (song) => (song.bars * 16 * 60) / song.bpm / 4;

/* ==========================================================================
   3. SÍNTESE — renderiza a música para um AudioBuffer
   ========================================================================== */

const VOICES = {
    lead: { wave: "pulse", duty: 0.5, gain: 0.22, attack: 0.004, decay: 0.08, sustain: 0.68, release: 0.07, vibrato: 0.004, vibratoRate: 5.5, pan: 0.18, delay: 0.26 },
    arp: { wave: "pulse", duty: 0.25, gain: 0.1, attack: 0.002, decay: 0.05, sustain: 0.4, release: 0.05, vibrato: 0, vibratoRate: 0, pan: -0.3, delay: 0.18 },
    bass: { wave: "triangle", duty: 0.5, gain: 0.3, attack: 0.003, decay: 0.06, sustain: 0.8, release: 0.05, vibrato: 0, vibratoRate: 0, pan: 0, delay: 0 }
};

/** Gerador pseudoaleatório determinístico (xorshift32) para o ruído. */
function makeNoise(seed = 0x9e3779b9) {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return ((state >>> 0) / 0xffffffff) * 2 - 1;
    };
}

function waveSample(type, phase, duty) {
    const t = phase - Math.floor(phase);
    if (type === "pulse") return t < duty ? 1 : -1;
    if (type === "triangle") return 4 * Math.abs(t - 0.5) - 1;
    return 2 * t - 1; // saw
}

/** Converte um padrão de texto ("a4 . - .") em eventos {time, dur, midi}. */
function patternToEvents(tokens, startTime, stepDur, transpose = 0) {
    const events = [];
    let current = null;
    tokens.forEach((token, step) => {
        const time = startTime + step * stepDur;
        if (token === "-") {
            if (current) current.dur += stepDur;
            return;
        }
        current = null;
        if (token === "." || !token) return;
        const midi = noteToMidi(token);
        if (midi === null) return;
        current = { time, dur: stepDur, midi: midi + transpose };
        events.push(current);
    });
    return events;
}

function renderVoice(events, cfg, sampleRate, length) {
    const out = new Float32Array(length);
    for (const event of events) {
        const start = Math.floor(event.time * sampleRate);
        if (start >= length) continue;
        const total = Math.min(length - start, Math.ceil((event.dur + cfg.release) * sampleRate));
        const baseInc = midiToFreq(event.midi) / sampleRate;
        let phase = 0;
        for (let i = 0; i < total; i++) {
            const t = i / sampleRate;
            let env;
            if (t < cfg.attack) env = t / cfg.attack;
            else if (t < cfg.attack + cfg.decay) env = 1 - (1 - cfg.sustain) * ((t - cfg.attack) / cfg.decay);
            else if (t < event.dur) env = cfg.sustain;
            else env = cfg.sustain * Math.max(0, 1 - (t - event.dur) / cfg.release);

            let inc = baseInc;
            if (cfg.vibrato) {
                const ramp = Math.min(1, t / 0.15);
                inc *= 1 + cfg.vibrato * ramp * Math.sin(2 * Math.PI * cfg.vibratoRate * t);
            }
            phase += inc;
            out[start + i] += waveSample(cfg.wave, phase, cfg.duty) * env * cfg.gain;
        }
    }
    return out;
}

/** Eco por realimentação in-place: gera repetições naturais sem nós extras. */
function applyEcho(buffer, sampleRate, delaySeconds, feedback) {
    if (!delaySeconds) return buffer;
    const offset = Math.floor(delaySeconds * sampleRate);
    for (let i = offset; i < buffer.length; i++) {
        buffer[i] += buffer[i - offset] * feedback;
    }
    return buffer;
}

const DRUM_PATTERNS = {
    four: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], gain: 1 },
    rock: { kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], gain: 0.95 },
    break: { kick: [0, 3, 8, 10], snare: [4, 12, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14], gain: 1 },
    soft: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], gain: 0.62 }
};

function renderDrums(song, sampleRate, length, stepDur) {
    const out = new Float32Array(length);
    const kit = DRUM_PATTERNS[song.drums];
    if (!kit) return out;
    const noise = makeNoise(0x5f3759df);
    const hits = [];

    for (let bar = song.introBars; bar < song.bars; bar++) {
        for (const step of kit.kick) hits.push({ type: "kick", time: (bar * 16 + step) * stepDur });
        for (const step of kit.snare) hits.push({ type: "snare", time: (bar * 16 + step) * stepDur });
        for (const step of kit.hat) hits.push({ type: "hat", time: (bar * 16 + step) * stepDur });
    }

    let lastNoise = 0;
    for (const hit of hits) {
        const start = Math.floor(hit.time * sampleRate);
        if (start >= length) continue;
        const duration = hit.type === "kick" ? 0.3 : hit.type === "snare" ? 0.22 : 0.055;
        const total = Math.min(length - start, Math.ceil(duration * sampleRate));
        let phase = 0;
        for (let i = 0; i < total; i++) {
            const t = i / sampleRate;
            let sample = 0;
            if (hit.type === "kick") {
                // Varredura de 130 Hz para 48 Hz: o "thump" clássico de tracker.
                phase += (48 + 82 * Math.exp(-t * 26)) / sampleRate;
                sample = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 8) * 0.9;
            } else {
                const raw = noise();
                const highpassed = raw - lastNoise; // diferenciador = passa-alta simples
                lastNoise = raw;
                if (hit.type === "snare") {
                    phase += 190 / sampleRate;
                    sample = (highpassed * 0.5 + Math.sin(2 * Math.PI * phase) * 0.25) * Math.exp(-t * 20);
                } else {
                    sample = highpassed * 0.22 * Math.exp(-t * 65);
                }
            }
            out[start + i] += sample * kit.gain;
        }
    }
    return out;
}

/** Renderiza a música inteira em um AudioBuffer estéreo. */
function synthesizeSong(song, audioContext) {
    const sampleRate = audioContext.sampleRate;
    const stepDur = 60 / song.bpm / 4;
    const length = Math.ceil((song.bars * 16 * stepDur + 1.8) * sampleRate);

    const leadEvents = [];
    const arpEvents = [];
    const bassEvents = [];

    for (let bar = 0; bar < song.bars; bar++) {
        const barTime = bar * 16 * stepDur;
        const chord = song.chords[bar % song.chords.length];
        const tones = chordNotes(chord, song.arpOctave);
        const bassRoot = chordNotes(chord, song.bassOctave)[0];

        // Arpejo: sobe e desce os graus do acorde em colcheias.
        for (let step = 0; step < 16; step += 2) {
            const tone = tones[(step / 2) % tones.length];
            arpEvents.push({ time: barTime + step * stepDur, dur: stepDur * 1.7, midi: tone });
        }

        // Baixo: tônica nos tempos fortes, quinta nas respostas.
        const bassSteps = song.drums === "soft" ? [0, 8] : [0, 4, 8, 12];
        bassSteps.forEach((step, i) => {
            bassEvents.push({
                time: barTime + step * stepDur,
                dur: stepDur * 3.4,
                midi: bassRoot + (i % 2 === 1 ? 7 : 0)
            });
        });

        if (bar >= song.leadFrom) {
            const pattern = song.lead[(bar - song.leadFrom) % song.lead.length].split(/\s+/);
            leadEvents.push(...patternToEvents(pattern, barTime, stepDur));
        }
    }

    const lead = applyEcho(renderVoice(leadEvents, VOICES.lead, sampleRate, length), sampleRate, VOICES.lead.delay, 0.34);
    const arp = applyEcho(renderVoice(arpEvents, VOICES.arp, sampleRate, length), sampleRate, VOICES.arp.delay, 0.28);
    const bass = renderVoice(bassEvents, VOICES.bass, sampleRate, length);
    const drums = renderDrums(song, sampleRate, length, stepDur);

    const buffer = audioContext.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const gainFor = (pan, side) => (side === "l" ? 1 - Math.max(0, pan) * 0.8 : 1 + Math.min(0, pan) * 0.8);
    // Passa-baixa de um polo (~9 kHz) para suavizar o aliasing das ondas quadradas.
    const cutoff = 1 - Math.exp((-2 * Math.PI * 9000) / sampleRate);
    let lpL = 0;
    let lpR = 0;

    for (let i = 0; i < length; i++) {
        let l = lead[i] * gainFor(VOICES.lead.pan, "l") + arp[i] * gainFor(VOICES.arp.pan, "l") + bass[i] + drums[i];
        let r = lead[i] * gainFor(VOICES.lead.pan, "r") + arp[i] * gainFor(VOICES.arp.pan, "r") + bass[i] + drums[i];
        lpL += (l - lpL) * cutoff;
        lpR += (r - lpR) * cutoff;
        l = lpL * 0.9;
        r = lpR * 0.9;
        left[i] = l / (1 + Math.abs(l)); // soft clip barato
        right[i] = r / (1 + Math.abs(r));
    }

    return buffer;
}

/* ==========================================================================
   4. ÁUDIO — contexto criado só depois do primeiro gesto do usuário
   ========================================================================== */

const EQ_BANDS = [
    { freq: 60, label: "60" },
    { freq: 170, label: "170" },
    { freq: 310, label: "310" },
    { freq: 600, label: "600" },
    { freq: 1000, label: "1k" },
    { freq: 3000, label: "3k" },
    { freq: 6000, label: "6k" },
    { freq: 12000, label: "12k" },
    { freq: 14000, label: "14k" },
    { freq: 16000, label: "16k" }
];

const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rock: [5, 4, 3, 1, -1, -1, 2, 4, 5, 5],
    dance: [6, 5, 2, 0, 0, -2, -3, -3, 1, 2],
    bass: [8, 8, 7, 4, 1, -2, -5, -6, -6, -6],
    treble: [-6, -6, -6, -3, 0, 3, 6, 8, 8, 8],
    laptop: [4, 3, 0, -2, -1, 1, 3, 5, 6, 6]
};

const audio = {
    ctx: null,
    input: null,
    preamp: null,
    filters: [],
    panner: null,
    master: null,
    analyser: null,
    source: null
};

function ensureAudio() {
    if (audio.ctx) {
        if (audio.ctx.state === "suspended") audio.ctx.resume();
        return audio.ctx;
    }

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    audio.ctx = ctx;
    audio.preamp = ctx.createGain();
    audio.filters = EQ_BANDS.map((band, index) => {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = band.freq;
        filter.Q.value = 1.1;
        filter.gain.value = 0;
        if (index > 0) audio.filters[index - 1].connect(filter);
        return filter;
    });
    audio.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    audio.master = ctx.createGain();
    audio.analyser = ctx.createAnalyser();
    audio.analyser.fftSize = 512;
    audio.analyser.smoothingTimeConstant = 0.72;

    audio.input = audio.preamp;
    audio.preamp.connect(audio.filters[0]);
    audio.filters[audio.filters.length - 1].connect(audio.panner);
    audio.panner.connect(audio.master);
    audio.master.connect(audio.analyser);
    audio.analyser.connect(ctx.destination);

    applyVolume();
    applyBalance();
    applyEq();
    return ctx;
}

/* ==========================================================================
   5. ESTADO DO PLAYER
   ========================================================================== */

const state = {
    tracks: [],
    index: 0,
    selected: 0,
    playing: false,
    paused: false,
    position: 0,
    startedAt: 0,
    startOffset: 0,
    shuffle: false,
    repeat: true,
    eqOn: true,
    timeMode: "elapsed",
    visMode: "bars",
    seeking: false,
    busy: false
};

let trackSeq = 0;
const bufferOrder = [];
const MAX_CACHED_BUFFERS = 3;

function makeSongTrack(song) {
    return {
        id: `song-${++trackSeq}`,
        kind: "song",
        title: song.title,
        artist: song.artist,
        duration: songDuration(song),
        song,
        buffer: null
    };
}

function makeFileTrack(file) {
    return {
        id: `file-${++trackSeq}`,
        kind: "file",
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "Arquivo local",
        duration: 0,
        file,
        buffer: null
    };
}

const trackLabel = (track) => (track ? `${track.artist} — ${track.title}` : "Winamp 2.91");

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const total = Math.floor(seconds);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function rememberBuffer(track) {
    const existing = bufferOrder.indexOf(track);
    if (existing !== -1) bufferOrder.splice(existing, 1);
    bufferOrder.push(track);
    while (bufferOrder.length > MAX_CACHED_BUFFERS) {
        const evicted = bufferOrder.shift();
        if (evicted !== state.tracks[state.index]) evicted.buffer = null;
    }
}

async function getBuffer(track) {
    if (track.buffer) {
        rememberBuffer(track);
        return track.buffer;
    }
    const ctx = ensureAudio();
    if (!ctx) throw new Error("Web Audio indisponível");

    if (track.kind === "song") {
        setMarquee(`Sintetizando “${track.title}”…`);
        // Deixa o navegador pintar o aviso antes do trabalho pesado.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        track.buffer = synthesizeSong(track.song, ctx);
    } else {
        setMarquee(`Decodificando “${track.title}”…`);
        const data = await track.file.arrayBuffer();
        track.buffer = await ctx.decodeAudioData(data);
    }

    track.duration = track.buffer.duration;
    rememberBuffer(track);
    renderPlaylist();
    return track.buffer;
}

/* ==========================================================================
   6. ELEMENTOS DA INTERFACE
   ========================================================================== */

const ui = {
    stage: $("#winamp-stage"),
    desktop: $("#desktop"),
    tip: $("#desktop-tip"),
    clock: $("#system-clock"),
    fileInput: $("#audio-file-input"),
    dropOverlay: $("#drop-overlay"),
    taskButton: $("#winamp-task"),
    skinsDialog: $("#skins-dialog"),
    helpDialog: $("#help-dialog"),
    timeButton: $("#wa-time"),
    timeDigits: $("#wa-time-digits"),
    lamps: {
        play: $("#wa-lamp-play"),
        pause: $("#wa-lamp-pause"),
        stop: $("#wa-lamp-stop")
    },
    marqueeBox: $("#wa-marquee"),
    marquee: $("#wa-track-title"),
    kbps: $("#wa-kbps"),
    khz: $("#wa-khz"),
    channels: $("#wa-channels"),
    canvas: $("#wa-vis"),
    visButton: $("#wa-vis-btn"),
    volume: $("#wa-volume"),
    volumeOut: $("#wa-volume-out"),
    balance: $("#wa-balance"),
    balanceOut: $("#wa-balance-out"),
    seek: $("#wa-seek"),
    shuffle: $("#wa-shuffle"),
    repeat: $("#wa-repeat"),
    eqWindow: $("#wa-eq"),
    plWindow: $("#wa-pl"),
    eqOn: $("#wa-eq-on"),
    eqBands: $("#wa-eq-bands"),
    preamp: $("#wa-preamp"),
    eqPreset: $("#wa-eq-preset"),
    playlist: $("#wa-pl-list"),
    playlistEmpty: $("#wa-pl-empty"),
    playlistCount: $("#wa-pl-count"),
    playlistTotal: $("#wa-pl-total")
};

const canvasCtx = ui.canvas.getContext("2d");
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const isCompact = window.matchMedia("(max-width: 760px)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function showTip(message, duration = 4200) {
    ui.tip.textContent = message;
    ui.tip.classList.remove("is-hidden");
    window.clearTimeout(showTip.timeoutId);
    showTip.timeoutId = window.setTimeout(() => ui.tip.classList.add("is-hidden"), duration);
}

/* ==========================================================================
   7. DISPLAY — marquee, tempo, lâmpadas, metadados
   ========================================================================== */

function setMarquee(text) {
    const separator = "  •  ";
    const single = text + separator;
    ui.marquee.textContent = single;
    ui.marqueeBox.classList.remove("is-scrolling");
    ui.marquee.setAttribute("aria-label", text);

    if (reduceMotion.matches) return;
    if (ui.marquee.scrollWidth <= ui.marqueeBox.clientWidth) return;

    ui.marquee.textContent = single + single;
    ui.marqueeBox.style.setProperty("--wa-marquee-duration", `${Math.max(8, ui.marquee.scrollWidth / 2 / 34)}s`);
    ui.marqueeBox.classList.add("is-scrolling");
}

function currentPosition() {
    if (state.playing && audio.ctx) {
        return Math.min(currentTrack()?.duration || 0, state.startOffset + (audio.ctx.currentTime - state.startedAt));
    }
    return state.position;
}

const currentTrack = () => state.tracks[state.index] || null;

function updateTimeDisplay() {
    const track = currentTrack();
    const duration = track?.duration || 0;
    const position = state.seeking ? state.position : currentPosition();

    if (!track) {
        ui.timeDigits.textContent = "--:--";
        return;
    }

    const shown = state.timeMode === "remaining" ? Math.max(0, duration - position) : position;
    ui.timeDigits.textContent = `${state.timeMode === "remaining" ? "-" : ""}${formatTime(shown)}`;
    ui.timeButton.setAttribute(
        "title",
        `${formatTime(position)} de ${formatTime(duration)} — clique para alternar decorrido/restante`
    );

    if (!state.seeking && duration > 0) {
        ui.seek.value = String(Math.round((position / duration) * 1000));
        ui.seek.setAttribute("aria-valuetext", `${formatTime(position)} de ${formatTime(duration)}`);
    }
}

function updateTransportUi() {
    ui.lamps.play.classList.toggle("is-lit", state.playing);
    ui.lamps.pause.classList.toggle("is-lit", state.paused);
    ui.lamps.stop.classList.toggle("is-lit", !state.playing && !state.paused);
    ui.timeButton.classList.toggle("is-blinking", state.paused);
    $$(".wa-btn[data-cmd]").forEach((button) => {
        const active =
            (button.dataset.cmd === "play" && state.playing) ||
            (button.dataset.cmd === "pause" && state.paused) ||
            (button.dataset.cmd === "stop" && !state.playing && !state.paused);
        button.classList.toggle("is-active", active);
    });
}

function updateTrackMeta() {
    const track = currentTrack();
    if (!track) {
        ui.kbps.textContent = "--";
        ui.khz.textContent = "--";
        ui.channels.textContent = "stereo";
        return;
    }
    const rate = audio.ctx ? audio.ctx.sampleRate : 44100;
    const kbps =
        track.kind === "file" && track.file && track.duration
            ? Math.round((track.file.size * 8) / track.duration / 1000)
            : Math.round((rate * 16 * 2) / 1000);
    ui.kbps.textContent = String(kbps);
    ui.khz.textContent = String(Math.round(rate / 1000));
    ui.channels.textContent = track.buffer && track.buffer.numberOfChannels === 1 ? "mono" : "stereo";
}

/* ==========================================================================
   8. TRANSPORTE
   ========================================================================== */

function stopSource() {
    if (!audio.source) return;
    audio.source.__manual = true;
    try {
        audio.source.stop();
    } catch (error) {
        /* já parado */
    }
    audio.source.disconnect();
    audio.source = null;
}

async function play(offset = state.position) {
    const track = currentTrack();
    if (!track || state.busy) return;

    const ctx = ensureAudio();
    if (!ctx) {
        showTip("Seu navegador não suporta a Web Audio API.");
        return;
    }

    state.busy = true;
    try {
        const buffer = await getBuffer(track);
        if (ctx.state === "suspended") await ctx.resume();
        stopSource();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.input);
        source.onended = () => {
            if (source.__manual) return;
            handleTrackEnd();
        };
        const safeOffset = Math.max(0, Math.min(offset, Math.max(0, buffer.duration - 0.05)));
        source.start(0, safeOffset);

        audio.source = source;
        state.startOffset = safeOffset;
        state.startedAt = ctx.currentTime;
        state.position = safeOffset;
        state.playing = true;
        state.paused = false;

        setMarquee(`${trackLabel(track)} (${formatTime(track.duration)})`);
        updateTrackMeta();
        renderPlaylist();
        updateTransportUi();
        startVisualizer();
    } catch (error) {
        console.error("Não foi possível tocar a faixa.", error);
        setMarquee("Erro ao carregar esta faixa");
        showTip("Não foi possível tocar esta faixa. Tente outra ou recarregue a página.", 6000);
        state.playing = false;
        updateTransportUi();
    } finally {
        state.busy = false;
    }
}

function pause() {
    if (!state.playing) {
        if (state.paused) play(state.position);
        return;
    }
    state.position = currentPosition();
    stopSource();
    state.playing = false;
    state.paused = true;
    updateTransportUi();
    updateTimeDisplay();
    stopVisualizer();
}

function stop() {
    stopSource();
    state.playing = false;
    state.paused = false;
    state.position = 0;
    updateTransportUi();
    updateTimeDisplay();
    stopVisualizer();
    drawIdleVisualizer();
    const track = currentTrack();
    if (track) setMarquee(`${trackLabel(track)} (${formatTime(track.duration)})`);
}

function pickNextIndex(step) {
    if (!state.tracks.length) return 0;
    if (state.shuffle && state.tracks.length > 1) {
        let next = state.index;
        while (next === state.index) next = Math.floor(Math.random() * state.tracks.length);
        return next;
    }
    return (state.index + step + state.tracks.length) % state.tracks.length;
}

function skip(step) {
    if (!state.tracks.length) return;
    const wasPlaying = state.playing;
    state.index = pickNextIndex(step);
    state.selected = state.index;
    state.position = 0;
    stopSource();
    state.playing = false;
    state.paused = false;
    renderPlaylist();
    updateTransportUi();
    updateTimeDisplay();
    if (wasPlaying) play(0);
    else setMarquee(`${trackLabel(currentTrack())} (${formatTime(currentTrack().duration)})`);
}

function handleTrackEnd() {
    const isLast = state.index === state.tracks.length - 1;
    state.position = 0;
    if (!state.repeat && isLast && !state.shuffle) {
        state.playing = false;
        stop();
        showTip("Fim da playlist.");
        return;
    }
    state.index = pickNextIndex(1);
    state.selected = state.index;
    play(0);
}

function playIndex(index) {
    if (index < 0 || index >= state.tracks.length) return;
    state.index = index;
    state.selected = index;
    state.position = 0;
    play(0);
}

/* ==========================================================================
   9. VISUALIZADOR
   ========================================================================== */

const VIS_MODES = ["bars", "scope", "off"];
let visFrame = 0;
let freqData = null;
let timeData = null;

function resizeCanvas() {
    const rect = ui.canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ui.canvas.width = Math.round(rect.width * dpr);
    ui.canvas.height = Math.round(rect.height * dpr);
}

function visualizerColors() {
    const styles = getComputedStyle(ui.desktop);
    return {
        fg: styles.getPropertyValue("--wa-lcd-fg").trim() || "#21e654",
        bg: styles.getPropertyValue("--wa-lcd-bg").trim() || "#050a06"
    };
}

function drawIdleVisualizer() {
    const { fg, bg } = visualizerColors();
    const { width, height } = ui.canvas;
    canvasCtx.fillStyle = bg;
    canvasCtx.fillRect(0, 0, width, height);
    canvasCtx.strokeStyle = fg;
    canvasCtx.globalAlpha = 0.45;
    canvasCtx.lineWidth = Math.max(1, height / 40);
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, height / 2);
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
    canvasCtx.globalAlpha = 1;
}

function drawVisualizer() {
    visFrame = requestAnimationFrame(drawVisualizer);
    if (!audio.analyser) return;

    const { fg, bg } = visualizerColors();
    const { width, height } = ui.canvas;
    canvasCtx.fillStyle = bg;
    canvasCtx.fillRect(0, 0, width, height);

    if (state.visMode === "bars") {
        if (!freqData) freqData = new Uint8Array(audio.analyser.frequencyBinCount);
        audio.analyser.getByteFrequencyData(freqData);
        const bars = 24;
        const gap = Math.max(1, width / 160);
        const barWidth = (width - gap * (bars - 1)) / bars;
        for (let i = 0; i < bars; i++) {
            // Distribuição logarítmica: agudos ocupam menos espaço, como no Winamp.
            const from = Math.floor(Math.pow(i / bars, 1.7) * freqData.length);
            const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / bars, 1.7) * freqData.length));
            let sum = 0;
            for (let j = from; j < to; j++) sum += freqData[j];
            const level = sum / (to - from) / 255;
            const barHeight = Math.max(height * 0.04, level * height);
            canvasCtx.fillStyle = fg;
            canvasCtx.globalAlpha = 0.35 + level * 0.65;
            canvasCtx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
        }
        canvasCtx.globalAlpha = 1;
    } else if (state.visMode === "scope") {
        if (!timeData) timeData = new Uint8Array(audio.analyser.fftSize);
        audio.analyser.getByteTimeDomainData(timeData);
        canvasCtx.strokeStyle = fg;
        canvasCtx.lineWidth = Math.max(1.5, height / 30);
        canvasCtx.beginPath();
        for (let i = 0; i < timeData.length; i++) {
            const x = (i / (timeData.length - 1)) * width;
            const y = (1 - timeData[i] / 255) * height;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
        }
        canvasCtx.stroke();
    }
}

function startVisualizer() {
    if (visFrame || state.visMode === "off" || document.hidden || !state.playing) return;
    visFrame = requestAnimationFrame(drawVisualizer);
}

function stopVisualizer() {
    if (!visFrame) return;
    cancelAnimationFrame(visFrame);
    visFrame = 0;
    drawIdleVisualizer();
}

/* ==========================================================================
   10. PLAYLIST
   ========================================================================== */

function renderPlaylist() {
    const fragment = document.createDocumentFragment();
    let total = 0;

    state.tracks.forEach((track, index) => {
        total += track.duration || 0;
        const item = document.createElement("li");
        item.className = "wa-pl-item";
        item.dataset.index = String(index);
        item.setAttribute("role", "option");
        item.id = `wa-pl-item-${index}`;
        item.setAttribute("aria-selected", String(index === state.selected));
        item.classList.toggle("is-current", index === state.index);
        item.classList.toggle("is-selected", index === state.selected);

        const number = document.createElement("span");
        number.className = "wa-pl-index";
        number.textContent = `${index + 1}.`;

        const name = document.createElement("span");
        name.className = "wa-pl-name";
        name.textContent = trackLabel(track);

        const time = document.createElement("span");
        time.className = "wa-pl-time";
        time.textContent = formatTime(track.duration);

        item.append(number, name, time);
        fragment.appendChild(item);
    });

    ui.playlist.replaceChildren(fragment);
    ui.playlist.setAttribute("aria-activedescendant", state.tracks.length ? `wa-pl-item-${state.selected}` : "");
    ui.playlistEmpty.hidden = state.tracks.length > 0;
    ui.playlistCount.textContent = String(state.tracks.length);
    ui.playlistTotal.textContent = formatTime(total);
}

function loadFiles(fileList) {
    const files = Array.from(fileList).filter(
        (file) => file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(file.name)
    );
    if (!files.length) {
        showTip("Nenhum arquivo de áudio compatível foi encontrado.");
        return;
    }
    const firstNew = state.tracks.length;
    state.tracks.push(...files.map(makeFileTrack));
    renderPlaylist();
    showTip(`${files.length} ${files.length === 1 ? "música carregada" : "músicas carregadas"} do seu computador.`);
    playIndex(firstNew);
}

function restoreDemoPlaylist(announce = true) {
    stopSource();
    state.tracks = SONGS.map(makeSongTrack);
    bufferOrder.length = 0;
    state.index = 0;
    state.selected = 0;
    state.position = 0;
    state.playing = false;
    state.paused = false;
    renderPlaylist();
    updateTransportUi();
    updateTimeDisplay();
    setMarquee(`${trackLabel(currentTrack())} (${formatTime(currentTrack().duration)})`);
    if (announce) showTip("Playlist demo restaurada.");
}

function removeSelected() {
    if (!state.tracks.length) return;
    const removingCurrent = state.selected === state.index;
    state.tracks.splice(state.selected, 1);
    bufferOrder.length = 0;

    if (!state.tracks.length) {
        stop();
        state.index = 0;
        state.selected = 0;
        setMarquee("Playlist vazia — carregue músicas ou restaure as demos");
        renderPlaylist();
        return;
    }

    state.selected = Math.min(state.selected, state.tracks.length - 1);
    if (removingCurrent) {
        state.index = state.selected;
        state.position = 0;
        if (state.playing) play(0);
        else stop();
    } else if (state.index > state.selected) {
        state.index -= 1;
    }
    renderPlaylist();
}

/* ==========================================================================
   11. MIXER — volume, balanço e equalizador
   ========================================================================== */

function applyVolume() {
    if (!audio.master) return;
    const value = Number(ui.volume.value) / 100;
    audio.master.gain.value = value * value * 0.9; // curva perceptual
}

function applyBalance() {
    if (!audio.panner || !("pan" in audio.panner)) return;
    audio.panner.pan.value = Number(ui.balance.value) / 100;
}

function applyEq() {
    if (!audio.filters.length) return;
    const sliders = $$("input[data-band]", ui.eqBands);
    sliders.forEach((slider, index) => {
        audio.filters[index].gain.value = state.eqOn ? Number(slider.value) : 0;
    });
    const preamp = state.eqOn ? Number(ui.preamp.value) : 0;
    audio.preamp.gain.value = Math.pow(10, preamp / 40);
}

function buildEqBands() {
    const fragment = document.createDocumentFragment();
    EQ_BANDS.forEach((band, index) => {
        const label = document.createElement("label");
        label.className = "wa-eq-band";

        const input = document.createElement("input");
        input.type = "range";
        input.min = "-12";
        input.max = "12";
        input.step = "1";
        input.value = "0";
        input.dataset.band = String(index);
        input.setAttribute("aria-label", `Banda de ${band.freq >= 1000 ? `${band.freq / 1000} kHz` : `${band.freq} Hz`}`);

        const caption = document.createElement("span");
        caption.className = "wa-eq-band-label";
        caption.textContent = band.label;

        label.append(input, caption);
        fragment.appendChild(label);
    });
    ui.eqBands.replaceChildren(fragment);
}

function applyPreset(name) {
    const values = EQ_PRESETS[name] || EQ_PRESETS.flat;
    $$("input[data-band]", ui.eqBands).forEach((slider, index) => {
        slider.value = String(values[index]);
    });
    ui.preamp.value = "0";
    applyEq();
}

/* ==========================================================================
   12. JANELAS, SKINS E CHROME DO DESKTOP
   ========================================================================== */

function toggleWindow(key, force) {
    const target = key === "eq" ? ui.eqWindow : ui.plWindow;
    const button = $(`[data-window-toggle="${key}"]`);
    const visible = typeof force === "boolean" ? force : target.hidden;
    target.hidden = !visible;
    button.classList.toggle("is-on", visible);
    button.setAttribute("aria-pressed", String(visible));
}

function applySkin(key) {
    ui.desktop.dataset.skin = key;
    $$(".skin-choice").forEach((choice) => {
        const selected = choice.dataset.skin === key;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
    });
    try {
        localStorage.setItem("winamp-skin", key);
    } catch (error) {
        /* armazenamento indisponível */
    }
    if (!state.playing) drawIdleVisualizer();
}

function fitPlayer() {
    const stageWidth = isCompact ? 550 : 1100;
    const stageHeight = isCompact ? 783 : 464;
    const iconRail = isCompact ? 84 : 132;
    const horizontalRoom = Math.max(260, window.innerWidth - iconRail - 18);
    const verticalRoom = Math.max(250, window.innerHeight - 58);
    const scale = Math.min(1, horizontalRoom / stageWidth, verticalRoom / stageHeight);
    document.documentElement.style.setProperty("--player-scale", String(Math.max(0.36, scale)));
}

function updateClock() {
    ui.clock.textContent = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

/* ==========================================================================
   13. LIGAÇÃO DE EVENTOS
   ========================================================================== */

function bindTransport() {
    $$(".wa-btn[data-cmd]").forEach((button) => {
        button.addEventListener("click", () => {
            switch (button.dataset.cmd) {
                case "play":
                    play(state.paused ? state.position : 0);
                    break;
                case "pause":
                    pause();
                    break;
                case "stop":
                    stop();
                    break;
                case "next":
                    skip(1);
                    break;
                case "prev":
                    skip(-1);
                    break;
                case "eject":
                    ui.fileInput.click();
                    break;
                default:
                    break;
            }
        });
    });

    ui.timeButton.addEventListener("click", () => {
        state.timeMode = state.timeMode === "elapsed" ? "remaining" : "elapsed";
        updateTimeDisplay();
    });

    ui.visButton.addEventListener("click", () => {
        state.visMode = VIS_MODES[(VIS_MODES.indexOf(state.visMode) + 1) % VIS_MODES.length];
        ui.canvas.setAttribute(
            "aria-label",
            `Visualizador de áudio: ${state.visMode === "bars" ? "espectro" : state.visMode === "scope" ? "osciloscópio" : "desligado"}`
        );
        if (state.visMode === "off") stopVisualizer();
        else startVisualizer();
        if (!state.playing || state.visMode === "off") drawIdleVisualizer();
        showTip(`Visualizador: ${state.visMode === "bars" ? "espectro" : state.visMode === "scope" ? "osciloscópio" : "desligado"}.`, 2200);
    });

    ui.shuffle.addEventListener("click", () => {
        state.shuffle = !state.shuffle;
        ui.shuffle.classList.toggle("is-on", state.shuffle);
        ui.shuffle.setAttribute("aria-pressed", String(state.shuffle));
    });

    ui.repeat.addEventListener("click", () => {
        state.repeat = !state.repeat;
        ui.repeat.classList.toggle("is-on", state.repeat);
        ui.repeat.setAttribute("aria-pressed", String(state.repeat));
    });

    ui.volume.addEventListener("input", () => {
        ensureAudio();
        applyVolume();
        ui.volumeOut.textContent = `${ui.volume.value}%`;
    });

    ui.balance.addEventListener("input", () => {
        ensureAudio();
        applyBalance();
        const value = Number(ui.balance.value);
        ui.balanceOut.textContent = value === 0 ? "centro" : `${Math.abs(value)}% ${value < 0 ? "esq" : "dir"}`;
    });

    const beginSeek = () => {
        state.seeking = true;
    };
    const commitSeek = () => {
        const track = currentTrack();
        if (!track) return;
        const target = (Number(ui.seek.value) / 1000) * track.duration;
        state.seeking = false;
        state.position = target;
        if (state.playing) play(target);
        else updateTimeDisplay();
    };

    ui.seek.addEventListener("pointerdown", beginSeek);
    ui.seek.addEventListener("keydown", beginSeek);
    ui.seek.addEventListener("input", () => {
        const track = currentTrack();
        if (!track) return;
        state.seeking = true;
        state.position = (Number(ui.seek.value) / 1000) * track.duration;
        updateTimeDisplay();
    });
    ui.seek.addEventListener("change", commitSeek);
}

function bindEqualizer() {
    buildEqBands();
    ui.eqBands.addEventListener("input", () => {
        ensureAudio();
        applyEq();
    });
    ui.preamp.addEventListener("input", () => {
        ensureAudio();
        applyEq();
    });
    ui.eqPreset.addEventListener("change", () => {
        ensureAudio();
        applyPreset(ui.eqPreset.value);
    });
    ui.eqOn.addEventListener("click", () => {
        state.eqOn = !state.eqOn;
        ui.eqOn.classList.toggle("is-on", state.eqOn);
        ui.eqOn.setAttribute("aria-pressed", String(state.eqOn));
        ui.eqOn.textContent = state.eqOn ? "on" : "off";
        ensureAudio();
        applyEq();
    });
}

function bindPlaylist() {
    const selectIndex = (index) => {
        state.selected = index;
        renderPlaylist();
    };

    ui.playlist.addEventListener("click", (event) => {
        const item = event.target.closest(".wa-pl-item");
        if (!item) return;
        const index = Number(item.dataset.index);
        if (coarsePointer || index === state.selected) playIndex(index);
        else selectIndex(index);
    });

    ui.playlist.addEventListener("dblclick", (event) => {
        const item = event.target.closest(".wa-pl-item");
        if (item) playIndex(Number(item.dataset.index));
    });

    ui.playlist.addEventListener("keydown", (event) => {
        if (!state.tracks.length) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            selectIndex(Math.min(state.tracks.length - 1, state.selected + 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            selectIndex(Math.max(0, state.selected - 1));
        } else if (event.key === "Home") {
            event.preventDefault();
            selectIndex(0);
        } else if (event.key === "End") {
            event.preventDefault();
            selectIndex(state.tracks.length - 1);
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            playIndex(state.selected);
        } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            removeSelected();
        }
    });

    $$("[data-pl-action]").forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.plAction === "add") ui.fileInput.click();
            else if (button.dataset.plAction === "remove") removeSelected();
            else restoreDemoPlaylist();
        });
    });
}

function bindWindowChrome() {
    $$("[data-window-toggle]").forEach((button) => {
        button.addEventListener("click", () => toggleWindow(button.dataset.windowToggle));
    });
    $$("[data-window-close]").forEach((button) => {
        button.addEventListener("click", () => toggleWindow(button.dataset.windowClose, false));
    });
}

function bindDesktop() {
    $('[data-action="open-files"]').addEventListener("click", () => ui.fileInput.click());
    $('[data-action="open-skins"]').addEventListener("click", () => ui.skinsDialog.showModal());
    $('[data-action="open-help"]').addEventListener("click", () => ui.helpDialog.showModal());
    $("#start-button").addEventListener("click", () => ui.helpDialog.showModal());

    $$("[data-close-dialog]").forEach((button) => {
        button.addEventListener("click", () => button.closest("dialog")?.close());
    });

    $$(".skin-choice").forEach((button) => {
        button.addEventListener("click", () => {
            applySkin(button.dataset.skin);
            showTip(`Skin aplicada: ${button.querySelector("strong").textContent}.`);
        });
    });

    [ui.skinsDialog, ui.helpDialog].forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            const outside =
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom;
            if (outside) dialog.close();
        });
    });

    ui.fileInput.addEventListener("change", () => {
        loadFiles(ui.fileInput.files);
        ui.fileInput.value = "";
    });

    ui.taskButton.addEventListener("click", () => {
        ui.stage.focus({ preventScroll: true });
        showTip("Winamp ativo. Use Z X C V B para controlar a reprodução.");
    });
}

function bindFileDrop() {
    let dragDepth = 0;
    const hide = () => {
        dragDepth = 0;
        ui.dropOverlay.classList.remove("is-visible");
        ui.dropOverlay.setAttribute("aria-hidden", "true");
    };

    window.addEventListener("dragenter", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        dragDepth += 1;
        ui.dropOverlay.classList.add("is-visible");
        ui.dropOverlay.setAttribute("aria-hidden", "false");
    });

    window.addEventListener("dragover", (event) => {
        if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    });

    window.addEventListener("dragleave", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) hide();
    });

    window.addEventListener("drop", (event) => {
        if (!event.dataTransfer?.files.length) return;
        event.preventDefault();
        hide();
        loadFiles(event.dataTransfer.files);
    });
}

function bindHotkeys() {
    window.addEventListener("keydown", (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.matches("input, select, textarea, [contenteditable]")) return;
        if (document.querySelector("dialog[open]")) return;

        switch (event.key.toLowerCase()) {
            case "z":
                skip(-1);
                break;
            case "x":
                play(state.paused ? state.position : 0);
                break;
            case "c":
                pause();
                break;
            case "v":
                stop();
                break;
            case "b":
                skip(1);
                break;
            case "l":
                event.preventDefault();
                ui.fileInput.click();
                break;
            default:
                return;
        }
    });
}

/* ==========================================================================
   14. INICIALIZAÇÃO
   ========================================================================== */

function init() {
    fitPlayer();
    updateClock();
    resizeCanvas();

    bindTransport();
    bindEqualizer();
    bindPlaylist();
    bindWindowChrome();
    bindDesktop();
    bindFileDrop();
    bindHotkeys();

    let savedSkin = "classic";
    try {
        savedSkin = localStorage.getItem("winamp-skin") || "classic";
    } catch (error) {
        /* armazenamento indisponível */
    }
    applySkin(savedSkin);

    restoreDemoPlaylist(false);
    updateTrackMeta();
    drawIdleVisualizer();
    updateTransportUi();

    let resizeTimer = 0;
    window.addEventListener(
        "resize",
        () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                fitPlayer();
                resizeCanvas();
                if (!state.playing) drawIdleVisualizer();
            }, 150);
        },
        { passive: true }
    );

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopVisualizer();
        else startVisualizer();
    });

    window.setInterval(updateClock, 30000);
    window.setInterval(() => {
        if (state.playing || state.seeking) updateTimeDisplay();
    }, 250);

    showTip("Pronto! Pressione X (ou o botão Play) para ouvir a trilha chiptune.", 6500);
}

init();
