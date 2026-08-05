// art/songs.js — tracker de música simples: 4 canais, formato row-based, seeds.
// Teto: ~220 linhas.

export const SONGS = {
    tema: {
        bpm: 110,
        rows: 16,
        order: [0, 0, 1, 1],
        patterns: [
            {
                p1: "C3 .  E3 .  G3 .  B3 .  A3 .  .  .  . ",
                p2: ".  .  C4 .  .  .  .  .  .  .  .  . ",
                tri: "C1 -  -  -  G1 -  -  -  A1 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            },
            {
                p1: "G3 .  B3 .  D4 .  E4 .  C4 .  .  . ",
                p2: ".  .  G4 .  .  .  .  .  .  .  .  . ",
                tri: "G0 -  -  -  C1 -  -  -  E1 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            }
        ]
    },

    corrida: {
        bpm: 150,
        rows: 16,
        order: [0, 0, 1, 2],
        patterns: [
            {
                p1: "E3 .  G3 .  B3 .  G3 .  A3 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "E1 -  -  -  E1 -  -  -  A0 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            },
            {
                p1: "B3 .  C4 .  E4 .  C4 .  B3 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "G1 -  -  -  G1 -  -  -  G1 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            },
            {
                p1: "D4 .  E4 .  G4 .  E4 .  D4 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "D2 -  -  -  D2 -  -  -  D2 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            }
        ]
    },

    agua: {
        bpm: 96,
        rows: 16,
        order: [0, 0, 1],
        patterns: [
            {
                p1: "C3 -  .  -  E3 -  .  -  D3 -  .  - ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "C1 -  -  -  C1 -  -  -  C1 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            },
            {
                p1: "A2 -  .  -  B2 -  .  -  C3 -  .  - ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "A0 -  -  -  A0 -  -  -  A0 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            }
        ]
    },

    subida: {
        bpm: 128,
        rows: 16,
        order: [0, 0, 1, 1, 2],
        patterns: [
            {
                p1: "D3 .  F3 .  A3 .  F3 .  E3 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "D1 -  -  -  D1 -  -  -  D1 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            },
            {
                p1: "A3 .  C4 .  E4 .  C4 .  A3 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "A1 -  -  -  A1 -  -  -  A1 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            },
            {
                p1: "E4 .  G4 .  B4 .  G4 .  E4 .  .  . ",
                p2: ".  .  .  .  .  .  .  .  .  .  .  . ",
                tri: "E2 -  -  -  E2 -  -  -  E2 -  -  - ",
                nz: "k  .  h  .  s  .  h  .  k  .  h  h "
            }
        ]
    }
};

// Stingers (curtíssimos clips de 1-2 notas)
export const STINGERS = {
    fanfarra_ouro: {
        bpm: 140,
        rows: 8,
        order: [0],
        patterns: [
            {
                p1: ".  .  .  . ",
                p2: "A4 -  E4 - ",
                tri: ".  .  .  . ",
                nz: ".  .  .  . "
            }
        ]
    },
    fanfarra_menor: {
        bpm: 120,
        rows: 4,
        order: [0],
        patterns: [
            {
                p1: ".  . ",
                p2: "C4 G3 ",
                tri: ".  . ",
                nz: ".  . "
            }
        ]
    },
    contagem: {
        bpm: 160,
        rows: 4,
        order: [0, 1, 2, 3],
        patterns: [
            { p1: "C4 ", p2: ".  ", tri: ".  ", nz: ".  " },
            { p1: "D4 ", p2: ".  ", tri: ".  ", nz: ".  " },
            { p1: "E4 ", p2: ".  ", tri: ".  ", nz: ".  " },
            { p1: "G4 ", p2: ".  ", tri: ".  ", nz: ".  " }
        ]
    },
    falha: {
        bpm: 100,
        rows: 4,
        order: [0],
        patterns: [
            {
                p1: ".  . ",
                p2: "G2 .  ",
                tri: ".  . ",
                nz: ".  . "
            }
        ]
    }
};

// SFX em formato de tupla [freq, duration, gain, type] —
// serão gerados/tocados por core/audio.js via um executor simples de síntese.
export const SFX_LIBRARY = {
    ui_move: { freq: 800, dur: 0.08, gain: 0.2 },
    ui_confirm: { freq: 1000, dur: 0.12, gain: 0.25 },
    ui_back: { freq: 600, dur: 0.08, gain: 0.2 },
    splash: { freq: 400, dur: 0.15, gain: 0.3 },
    trick: { freq: 1200, dur: 0.2, gain: 0.25 },
    land: { freq: 300, dur: 0.1, gain: 0.25 },
    wipeout: { freq: 200, dur: 0.25, gain: 0.3 },
    jump: { freq: 900, dur: 0.08, gain: 0.2 },
    pickup: { freq: 1100, dur: 0.12, gain: 0.22 },
    hit_soft: { freq: 500, dur: 0.1, gain: 0.25 },
    delivery_ok: { freq: 1000, dur: 0.15, gain: 0.3 },
    medal: { freq: 1200, dur: 0.18, gain: 0.28 },
    record: { freq: 1400, dur: 0.22, gain: 0.3 },
    pause: { freq: 700, dur: 0.08, gain: 0.2 }
};
