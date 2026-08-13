// art/songs.js — trilha em formato tracker (4 canais: 2 pulses, 1 triangle, 1 noise).
//
// Cada `pattern` é um compasso de 16 semicolcheias. Nos canais melódicos os tokens são:
//   "C4" toca a nota   |   "-" sustenta   |   "." corta o som
// No canal de ruído: "k" bumbo, "s" caixa, "h" chimbal, "." silêncio.
//
// Uma faixa por prova, com caráter próprio: o surfe respira, o bowl é punk, a altinha tem
// suingue de samba, a ciclovia corre, o frescobol é leve e a baía é remada cadenciada.

export const SONGS = {
    // --- tela de título: tema de orla em Am ---
    tema: {
        bpm: 104,
        rows: 16,
        order: [0, 0, 1, 2],
        patterns: [
            {
                p1: "A4 -  -  .  C5 -  E5 -  -  .  D5 -  C5 -  -  . ",
                p2: "A3 -  -  -  -  -  -  -  E3 -  -  -  -  -  -  - ",
                tri: "A1 -  -  -  A1 -  -  -  E1 -  -  -  A1 -  -  - ",
                nz: "k  h  .  h  s  h  .  h  k  h  .  h  s  h  h  h "
            },
            {
                p1: "F4 -  -  .  A4 -  C5 -  -  .  B4 -  A4 -  -  . ",
                p2: "F3 -  -  -  -  -  -  -  C4 -  -  -  -  -  -  - ",
                tri: "F1 -  -  -  F1 -  -  -  C2 -  -  -  F1 -  -  - ",
                nz: "k  h  .  h  s  h  .  h  k  h  .  h  s  h  h  h "
            },
            {
                p1: "G4 -  B4 -  D5 -  -  .  E5 -  D5 -  B4 -  G4 . ",
                p2: "G3 -  -  -  -  -  -  -  D4 -  -  -  -  -  -  - ",
                tri: "G1 -  -  -  G1 -  -  -  D2 -  -  -  G1 -  -  - ",
                nz: "k  h  .  h  s  h  h  h  k  h  .  h  s  h  s  h "
            }
        ]
    },

    // --- surfe: aberto, arpejos longos, quase parado no tempo ---
    mar: {
        bpm: 88,
        rows: 16,
        order: [0, 1, 0, 2],
        patterns: [
            {
                p1: "D4 -  -  -  F#4 -  -  -  A4 -  -  -  F#4 -  -  - ",
                p2: ".  .  .  .  D5 -  -  -  .  .  .  .  A4 -  -  - ",
                tri: "D1 -  -  -  -  -  -  -  A1 -  -  -  -  -  -  - ",
                nz: "k  .  .  h  .  .  s  .  k  .  .  h  .  .  s  . "
            },
            {
                p1: "B3 -  -  -  D4 -  -  -  F#4 -  -  -  E4 -  -  - ",
                p2: ".  .  .  .  B4 -  -  -  .  .  .  .  F#4 -  -  - ",
                tri: "B0 -  -  -  -  -  -  -  F#1 -  -  -  -  -  -  - ",
                nz: "k  .  .  h  .  .  s  .  k  .  .  h  .  .  s  . "
            },
            {
                p1: "G4 -  -  -  A4 -  -  -  D5 -  -  -  C#5 -  -  - ",
                p2: ".  .  .  .  D5 -  -  -  .  .  .  .  A4 -  -  - ",
                tri: "G1 -  -  -  -  -  -  -  A1 -  -  -  -  -  -  - ",
                nz: "k  .  h  h  .  .  s  .  k  .  h  h  .  s  s  . "
            }
        ]
    },

    // --- skate: punk de bowl, rápido e teimoso ---
    bowl: {
        bpm: 168,
        rows: 16,
        order: [0, 0, 1, 0, 2, 2],
        patterns: [
            {
                p1: "E4 E4 .  E4 G4 .  E4 .  A4 .  G4 .  E4 .  D4 . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "E1 -  E1 -  E1 -  E1 -  E1 -  E1 -  E1 -  E1 - ",
                nz: "k  h  s  h  k  h  s  h  k  h  s  h  k  h  s  s "
            },
            {
                p1: "C5 .  B4 .  A4 .  G4 .  A4 .  B4 .  C5 .  D5 . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "C2 -  C2 -  C2 -  C2 -  G1 -  G1 -  G1 -  G1 - ",
                nz: "k  h  s  h  k  h  s  h  k  h  s  h  k  s  s  s "
            },
            {
                p1: "A4 A4 .  C5 .  A4 .  E5 -  .  D5 .  C5 .  A4 . ",
                p2: "A3 .  .  .  .  .  .  A4 -  .  .  .  .  .  .  . ",
                tri: "A1 -  A1 -  A1 -  A1 -  A1 -  A1 -  A1 -  A1 - ",
                nz: "k  h  s  h  k  h  s  h  k  h  s  h  s  s  s  s "
            }
        ]
    },

    // --- altinha: suingue de samba na areia, tudo em síncope ---
    areia: {
        bpm: 122,
        rows: 16,
        order: [0, 1, 0, 2],
        patterns: [
            {
                p1: ".  C5 .  A4 .  .  G4 .  E4 .  .  G4 .  A4 .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "A1 -  .  A1 .  .  E1 -  .  E1 .  .  A1 -  .  . ",
                nz: "k  .  h  s  .  h  k  .  h  s  .  h  k  h  s  h "
            },
            {
                p1: ".  D5 .  C5 .  .  A4 .  G4 .  .  A4 .  C5 .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "F1 -  .  F1 .  .  C2 -  .  C2 .  .  F1 -  .  . ",
                nz: "k  .  h  s  .  h  k  .  h  s  .  h  k  h  s  h "
            },
            {
                p1: ".  E5 .  D5 .  C5 .  A4 .  .  G4 .  E4 .  .  . ",
                p2: ".  .  A4 .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "D2 -  .  D2 .  .  G1 -  .  G1 .  .  A1 -  .  . ",
                nz: "k  .  h  s  h  h  k  .  h  s  .  h  k  s  s  h "
            }
        ]
    },

    // --- BMX: corrida, semínimas martelando embaixo ---
    orla: {
        bpm: 156,
        rows: 16,
        order: [0, 0, 1, 2],
        patterns: [
            {
                p1: "E4 .  G4 .  B4 .  G4 .  A4 .  B4 .  E5 .  B4 . ",
                p2: ".  .  .  .  E5 -  .  .  .  .  .  .  B4 -  .  . ",
                tri: "E1 E1 E1 E1 E1 E1 E1 E1 A1 A1 A1 A1 A1 A1 A1 A1 ",
                nz: "k  h  h  h  s  h  h  h  k  h  h  h  s  h  s  h "
            },
            {
                p1: "D4 .  F#4 .  A4 .  F#4 .  G4 .  A4 .  D5 .  A4 . ",
                p2: ".  .  .  .  D5 -  .  .  .  .  .  .  A4 -  .  . ",
                tri: "D1 D1 D1 D1 D1 D1 D1 D1 G1 G1 G1 G1 G1 G1 G1 G1 ",
                nz: "k  h  h  h  s  h  h  h  k  h  h  h  s  h  s  h "
            },
            {
                p1: "B4 .  D5 .  E5 .  D5 .  B4 .  A4 .  G4 .  E4 . ",
                p2: "B3 .  .  .  .  .  .  .  E4 -  .  .  .  .  .  . ",
                tri: "B0 B0 B0 B0 B0 B0 B0 B0 E1 E1 E1 E1 E1 E1 E1 E1 ",
                nz: "k  h  s  h  s  h  h  h  k  h  s  h  s  s  s  s "
            }
        ]
    },

    // --- frescobol: leve, saltitante, sem tensão (não tem placar mesmo) ---
    peteca: {
        bpm: 132,
        rows: 16,
        order: [0, 1, 0, 1],
        patterns: [
            {
                p1: "C5 .  E5 .  G5 .  E5 .  D5 .  C5 .  E5 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "C2 -  -  .  G1 -  -  .  C2 -  -  .  G1 -  -  . ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h "
            },
            {
                p1: "A4 .  C5 .  F5 .  C5 .  B4 .  A4 .  G4 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "F1 -  -  .  C2 -  -  .  F1 -  -  .  G1 -  -  . ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h "
            }
        ]
    },

    // --- canoa: cadência de remada, dois tempos fortes por compasso ---
    baia: {
        bpm: 112,
        rows: 16,
        order: [0, 0, 1, 0],
        patterns: [
            {
                p1: "D4 -  -  .  .  .  A3 -  D4 -  -  .  .  .  F4 - ",
                p2: ".  .  .  .  D5 -  -  .  .  .  .  .  A4 -  -  . ",
                tri: "D1 -  -  -  -  -  -  -  D1 -  -  -  -  -  -  - ",
                nz: "k  .  .  s  .  .  k  .  k  .  .  s  .  .  k  h "
            },
            {
                p1: "C4 -  -  .  .  .  G3 -  C4 -  -  .  .  .  E4 - ",
                p2: ".  .  .  .  C5 -  -  .  .  .  .  .  G4 -  -  . ",
                tri: "C1 -  -  -  -  -  -  -  C1 -  -  -  -  -  -  - ",
                nz: "k  .  .  s  .  .  k  .  k  .  .  s  .  s  k  h "
            }
        ]
    },

    // --- pódio: hino curto e solene ---
    podio: {
        bpm: 96,
        rows: 16,
        order: [0, 1],
        patterns: [
            {
                p1: "C5 -  -  -  G4 -  C5 -  E5 -  -  -  -  -  -  - ",
                p2: "E4 -  -  -  C4 -  E4 -  G4 -  -  -  -  -  -  - ",
                tri: "C2 -  -  -  C2 -  -  -  C2 -  -  -  G1 -  -  - ",
                nz: "k  .  .  .  s  .  .  .  k  .  .  .  s  .  s  s "
            },
            {
                p1: "F5 -  -  -  E5 -  D5 -  C5 -  -  -  -  -  -  - ",
                p2: "A4 -  -  -  G4 -  F4 -  E4 -  -  -  -  -  -  - ",
                tri: "F1 -  -  -  F1 -  -  -  C2 -  -  -  C2 -  -  - ",
                nz: "k  .  .  .  s  .  .  .  k  .  .  .  s  s  s  s "
            }
        ]
    }
};

/** Stingers: clipes curtíssimos disparados em transições. */
export const STINGERS = {
    fanfarra_ouro: {
        bpm: 150, rows: 8, order: [0],
        patterns: [{
            p1: "C5 E5 G5 C6 -  -  -  . ",
            p2: "E4 G4 C5 E5 -  -  -  . ",
            tri: "C2 C2 C2 C2 -  -  -  . ",
            nz: "s  s  s  k  .  .  .  . "
        }]
    },
    fanfarra_menor: {
        bpm: 150, rows: 8, order: [0],
        patterns: [{
            p1: "G4 B4 D5 -  -  .  .  . ",
            p2: "D4 G4 B4 -  -  .  .  . ",
            tri: "G1 G1 G1 -  -  .  .  . ",
            nz: "s  s  k  .  .  .  .  . "
        }]
    },
    falha: {
        bpm: 110, rows: 8, order: [0],
        patterns: [{
            p1: "E4 D#4 D4 C#4 C4 -  -  . ",
            p2: ".  .  .  .  .  .  .  . ",
            tri: "C1 -  -  -  -  -  -  . ",
            nz: "k  .  s  .  k  .  .  . "
        }]
    },
    contagem: {
        bpm: 120, rows: 4, order: [0, 0, 0, 1],
        patterns: [
            { p1: "A4 .  .  . ", p2: ".  .  .  . ", tri: ".  .  .  . ", nz: "h  .  .  . " },
            { p1: "A5 -  -  . ", p2: "E5 -  -  . ", tri: "A2 -  -  . ", nz: "s  .  .  . " }
        ]
    }
};

/** SFX de uma nota — freq (Hz), duração (s), ganho e um sweep opcional em Hz. */
export const SFX_LIBRARY = {
    ui_move: { freq: 660, dur: 0.05, gain: 0.16, type: 'square' },
    ui_confirm: { freq: 880, dur: 0.10, gain: 0.22, type: 'square', sweep: 440 },
    ui_back: { freq: 440, dur: 0.08, gain: 0.18, type: 'square', sweep: -180 },
    ui_deny: { freq: 180, dur: 0.12, gain: 0.20, type: 'square' },

    splash: { freq: 320, dur: 0.22, gain: 0.26, type: 'sawtooth', sweep: -220 },
    carve: { freq: 520, dur: 0.10, gain: 0.14, type: 'sawtooth', sweep: 180 },
    tube: { freq: 240, dur: 0.30, gain: 0.20, type: 'sine', sweep: 160 },

    pump: { freq: 300, dur: 0.07, gain: 0.16, type: 'triangle', sweep: 120 },
    air: { freq: 720, dur: 0.14, gain: 0.20, type: 'square', sweep: 420 },
    land: { freq: 220, dur: 0.09, gain: 0.22, type: 'triangle' },
    grind: { freq: 900, dur: 0.18, gain: 0.14, type: 'sawtooth', sweep: -300 },

    touch: { freq: 620, dur: 0.06, gain: 0.20, type: 'square', sweep: 240 },
    header: { freq: 480, dur: 0.09, gain: 0.22, type: 'triangle', sweep: 200 },
    drop: { freq: 160, dur: 0.20, gain: 0.24, type: 'sine', sweep: -110 },

    jump: { freq: 480, dur: 0.09, gain: 0.20, type: 'square', sweep: 460 },
    trick: { freq: 1040, dur: 0.16, gain: 0.20, type: 'square', sweep: 520 },
    crash: { freq: 140, dur: 0.32, gain: 0.28, type: 'sawtooth', sweep: -100 },
    coin: { freq: 1180, dur: 0.10, gain: 0.20, type: 'square', sweep: 620 },

    hit: { freq: 760, dur: 0.07, gain: 0.22, type: 'square', sweep: 300 },
    miss: { freq: 200, dur: 0.24, gain: 0.24, type: 'sawtooth', sweep: -120 },

    stroke: { freq: 260, dur: 0.12, gain: 0.18, type: 'triangle', sweep: -90 },
    buoy: { freq: 380, dur: 0.14, gain: 0.20, type: 'sine', sweep: -160 },

    medal: { freq: 1046, dur: 0.20, gain: 0.24, type: 'square', sweep: 400 },
    record: { freq: 1320, dur: 0.26, gain: 0.26, type: 'square', sweep: 660 },
    pause: { freq: 560, dur: 0.07, gain: 0.18, type: 'square' },
    tick: { freq: 1400, dur: 0.04, gain: 0.14, type: 'square' }
};
