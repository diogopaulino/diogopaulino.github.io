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

/** Renderiza a música inteira em dois canais PCM. */
function synthesizeSong(song, sampleRate) {
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

    const left = new Float32Array(length);
    const right = new Float32Array(length);

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

    return [left, right];
}

self.onmessage = ({ data }) => {
    const channels = synthesizeSong(data.song, data.sampleRate);
    self.postMessage(channels, channels.map(channel => channel.buffer));
};
