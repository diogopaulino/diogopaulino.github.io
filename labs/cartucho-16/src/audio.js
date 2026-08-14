/**
 * Chip 16-bit: 2 pulsos + triângulo + ruído, no espírito SNES/Mega Drive.
 * Melodias originais — só o sotaque dos anos 90, não as partituras oficiais.
 */

const A4 = 440;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FREQ = Object.create(null);
for (let oct = 1; oct <= 7; oct++) {
    for (let i = 0; i < 12; i++) {
        const midi = (oct + 1) * 12 + i;
        FREQ[NAMES[i] + oct] = A4 * 2 ** ((midi - 69) / 12);
    }
}

function parseTune(str) {
    if (!str) return [];
    return str.trim().split(/\s+/).map((tok) => {
        if (tok === '.' || tok === 'r' || tok === 'R') return { f: 0, d: 1 };
        const m = tok.match(/^([A-G]#?)(\d)([ehsqwt])?(\d)?$/i);
        if (!m) return { f: 0, d: 1 };
        const durMap = { s: 1, e: 2, q: 4, h: 8, w: 16, t: 3 };
        const letter = m[1].toUpperCase();
        const d = m[4] ? Number(m[4]) : (durMap[m[3] || 'e'] || 2);
        return { f: FREQ[letter + m[2]] || 0, d };
    });
}

const SONGS = {
    title: {
        bpm: 132,
        pulse: 'C5e E5e G5e C6e G5e E5e F5e A5e C6q A5e F5e E5e D5e G4e C5q r e G4e C5e E5e G5q E5e C5q',
        bass: 'C3q C3q F3q F3q G3q G3q C3q G3e C3e C3q C3q F3q F3q G3q G3q C3h',
        tri: 'E4h G4h A4h G4h E4h C4h D4h E4h',
        noise: '..s .s ..s .s ..s .s ..s e',
    },
    pradaria: {
        bpm: 140,
        pulse: 'E5e G5e C6e G5e E5e C5e D5e F5e A5e F5e D5e G4e C5q r e E5e G5e B5e C6q G5e E5q',
        bass: 'C3q G3q C3q G3q F3q C3q G3q D3q C3q G3q C3q G3q F3q C3q G3h',
        tri: 'G4h E4h A4h F4h G4h E4h D4h C4h',
        noise: '.s ..s .s ..s .s ..s e',
    },
    loop: {
        bpm: 168,
        pulse: 'A5s C6s E6e C6e A5e F5e G5e B5e D6e B5e G5e E5e A5q r s C6s E6s G6e E6e C6q',
        bass: 'A2e E3e A2e E3e F2e C3e G2e D3e A2e E3e A2e E3e F2e C3e E2e B2e',
        tri: 'C5e E5e A5e E5e D5e F5e G5e D5e',
        noise: 's .s s .s s .s s e',
    },
    templo: {
        bpm: 96,
        pulse: 'E5q G5e B5e E6h D6q B5e G5e E5h C5q E5e G5e B5h A5q F#5e D5e E5h',
        bass: 'E2h B2h C3h G2h E2h B2h A2h E2h',
        tri: 'G4h B4h E5h D5h G4h B4h C5h B4h',
        noise: '....e ..e',
    },
    cidadela: {
        bpm: 150,
        pulse: 'C5s D#5s G5e C6e G5e D#5e F5s G5s A#5e D6e A#5e F5e G5e B5e D6q C6e G5q',
        bass: 'C3e C3e G2e C3e D#3e D#3e A#2e D#3e F3e F3e C3e F3e G2e G2e D3e G2e',
        tri: 'G4e D#5e G4e F4e A#4e F4e G4e D5e',
        noise: 's s .s s s .s e',
    },
    castelo: {
        bpm: 108,
        pulse: 'A4q C5e E5e A5h G5q E5e C5e A4h F5q A5e C6e E6h D6q B5e G5e A5h',
        bass: 'A2h E3h F3h C3h A2h E3h D3h A2h',
        tri: 'C5h E5h F5h E5h C5h A4h B4h C5h',
        noise: '..e .e ..e',
    },
    boss: {
        bpm: 164,
        pulse: 'E5s E5s r s E5e G5e D#5e E5s r s B5e A5e G5e E5e D#5e E5q r e C6s B5s A5e G5e F#5e E5q',
        bass: 'E2e E2e B2e E2e F2e F2e C3e F2e E2e E2e B2e E2e D#2e D#2e B2e D#2e',
        tri: 'E4e G4e B4e G4e F4e A4e C5e A4e',
        noise: 's s s .s s s e',
    },
    ending: {
        bpm: 100,
        pulse: 'C5q E5e G5e C6h B5q G5e E5e A5h F5q A5e C6e E6h D6q G5e B5e C6h',
        bass: 'C3h G3h F3h C3h A2h E3h G3h C3h',
        tri: 'E4h G4h A4h G4h F4h E4h D4h C4h',
        noise: '....e',
    },
};

export function createAudio() {
    let ctx = null;
    let muted = false;
    let master = null;
    let playing = null;
    let timer = 0;
    let step = 0;
    let song = null;
    let tracks = null;
    let noiseBuf = null;

    function ensure() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.22;
            master.connect(ctx.destination);
            noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function beep(type, freq, dur, vol = 0.12, slide = 0) {
        if (muted || !ensure()) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    function noise(dur, vol = 0.1, freq = 1200) {
        if (muted || !ensure() || !noiseBuf) return;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f);
        f.connect(g);
        g.connect(master);
        src.start(t);
        src.stop(t + dur);
    }

    const sfx = {
        jump: () => beep('square', 520, 0.09, 0.08, -220),
        stomp: () => { beep('square', 180, 0.12, 0.1, -80); noise(0.08, 0.06, 800); },
        coin: () => { beep('square', 880, 0.08, 0.07); beep('square', 1320, 0.12, 0.06); },
        ring: () => beep('square', 1240, 0.07, 0.07, 400),
        rupee: () => { beep('triangle', 660, 0.1, 0.08); beep('triangle', 990, 0.14, 0.06); },
        hit: () => { beep('sawtooth', 140, 0.18, 0.1, -90); noise(0.12, 0.08, 400); },
        bump: () => beep('square', 200, 0.06, 0.07),
        break: () => noise(0.1, 0.1, 600),
        shoot: () => beep('square', 740, 0.08, 0.07, -500),
        charge: () => beep('square', 240, 0.05, 0.04, 80),
        spring: () => beep('square', 400, 0.14, 0.09, 600),
        dash: () => { noise(0.08, 0.07, 1800); beep('square', 300, 0.08, 0.05, 200); },
        power: () => { beep('square', 520, 0.1, 0.07); beep('square', 780, 0.16, 0.07); beep('square', 1040, 0.22, 0.07); },
        oneup: () => { beep('square', 523, 0.1, 0.08); beep('square', 659, 0.1, 0.08); beep('square', 784, 0.12, 0.08); beep('square', 1046, 0.2, 0.08); },
        crystal: () => { beep('triangle', 523, 0.15, 0.08); beep('triangle', 659, 0.18, 0.08); beep('triangle', 784, 0.22, 0.08); beep('triangle', 1046, 0.4, 0.09); },
        hurt: () => { beep('sawtooth', 220, 0.2, 0.12, -160); noise(0.16, 0.1, 300); },
        die: () => { beep('square', 440, 0.15, 0.1, -200); beep('square', 220, 0.4, 0.1, -180); },
        pause: () => beep('square', 660, 0.08, 0.06),
        select: () => beep('square', 880, 0.06, 0.06),
        start: () => { beep('square', 392, 0.12, 0.08); beep('square', 523, 0.18, 0.08); beep('square', 784, 0.28, 0.09); },
        insert: () => { noise(0.05, 0.08, 900); beep('square', 180, 0.1, 0.06); },
        boot: () => { beep('triangle', 262, 0.25, 0.08); beep('triangle', 330, 0.4, 0.08); },
        continue: () => beep('square', 440, 0.08, 0.07, 120),
        bossHit: () => { noise(0.14, 0.12, 250); beep('sawtooth', 90, 0.2, 0.1); },
    };

    function playSfx(name) {
        sfx[name]?.();
    }

    function compile(def) {
        return {
            bpm: def.bpm,
            pulse: parseTune(def.pulse),
            bass: parseTune(def.bass),
            tri: parseTune(def.tri),
            noise: parseTune(def.noise),
        };
    }

    function cursor(list) {
        return { list, i: 0, left: list[0]?.d || 1 };
    }

    function playSong(name) {
        ensure();
        const def = SONGS[name];
        if (!def) return;
        song = compile(def);
        tracks = {
            pulse: cursor(song.pulse),
            bass: cursor(song.bass),
            tri: cursor(song.tri),
            noise: cursor(song.noise),
        };
        playing = name;
        timer = 0;
        step = 0;
    }

    function stopSong() {
        playing = null;
        song = null;
    }

    function advance(track, kind) {
        if (!track.list.length) return;
        track.left -= 1;
        if (track.left > 0) return;
        track.i = (track.i + 1) % track.list.length;
        const n = track.list[track.i];
        track.left = n.d;
        if (!n.f) return;
        const sixteenth = 60 / song.bpm / 4;
        const dur = Math.max(0.04, n.d * sixteenth * 0.92);
        if (kind === 'noise') {
            noise(Math.min(0.08, dur), 0.045, 1800);
            return;
        }
        const type = kind === 'tri' ? 'triangle' : 'square';
        const vol = kind === 'bass' ? 0.07 : kind === 'tri' ? 0.05 : 0.055;
        beep(type, n.f, dur, vol);
    }

    function tick(dt) {
        if (muted || !playing || !song || !ensure()) return;
        const sixteenth = 60 / song.bpm / 4;
        timer += dt;
        while (timer >= sixteenth) {
            timer -= sixteenth;
            step += 1;
            advance(tracks.pulse, 'pulse');
            advance(tracks.bass, 'bass');
            advance(tracks.tri, 'tri');
            advance(tracks.noise, 'noise');
        }
    }

    function setMuted(v) {
        muted = v;
        if (master) master.gain.value = v ? 0 : 0.22;
    }

    function unlock() {
        ensure();
    }

    return { playSfx, playSong, stopSong, tick, setMuted, unlock, get muted() { return muted; } };
}
