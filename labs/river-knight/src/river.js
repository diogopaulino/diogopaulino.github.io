/**
 * Geometria analítica do rio.
 *
 * O mundo inteiro (terreno, colocação de árvores, limites de navegação e IA)
 * deriva de três funções puras de `z`:
 *
 *   centerX(z)   → deslocamento lateral do leito (as curvas do rio)
 *   halfWidth(z) → metade da largura navegável
 *   height(x, z) → altura do terreno
 *
 * As mesmas fórmulas existem em GLSL (`RIVER_GLSL`) para que o terreno possa
 * ser deslocado inteiramente na GPU — sem isso, atualizar ~65k vértices por
 * quadro na CPU custaria caro. Constantes são injetadas no shader a partir
 * deste arquivo, então JS e GLSL nunca saem de sincronia.
 */

/** Z do castelo — precisa ser conhecido aqui para aplainar a esplanada. */
import { CASTLE_Z } from './config.js?v=50';

export const RIVER = {
    bendAmp1: 38,
    bendFreq1: 0.0059,
    bendAmp2: 14,
    bendFreq2: 0.0171,
    bendPhase2: 2.1,

    halfWidth: 27,
    widthAmp: 6,
    widthFreq: 0.0089,
    widthPhase: 0.7,

    bedDepth: 5.4,

    /** Praia: o leito sobe de −bedDepth (14 m dentro d'água) a beachTop (10 m margem adentro). */
    beachIn: 14,
    beachSpan: 24,
    beachTop: 2.6,

    /** Barranco: começa a `bankStart` m da borda; altura e largura variam com `cliff(z)`. */
    bankStart: 9,
    bankHeightSoft: 15,
    bankHeightCliff: 38,
    bankRampSoft: 36,
    bankRampCliff: 10,

    /** Desfiladeiro de Morvain (paredões contínuos) — entre estes dois Z. */
    gorgeStart: -2750,
    gorgeEnd: -3650,
    gorgeFade: 180,

    ridgeAmp: 5.5,
    ridgeFreqA: 0.019,
    ridgeFreqB: 0.041,

    hillStart: 78,
    hillRamp: 150,
    hillHeight: 96,

    esplanadeInner: 60,
    esplanadeFade: 90,
    esplanadeHeight: 3.4
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep01 = (v) => {
    const t = clamp01(v);
    return t * t * (3 - 2 * t);
};

/** Deslocamento lateral do centro do rio na posição `z`. */
export function centerX(z) {
    return (
        RIVER.bendAmp1 * Math.sin(z * RIVER.bendFreq1) +
        RIVER.bendAmp2 * Math.sin(z * RIVER.bendFreq2 + RIVER.bendPhase2)
    );
}

/** Derivada de `centerX` — usada para alinhar objetos à direção do rio. */
export function centerSlope(z) {
    return (
        RIVER.bendAmp1 * RIVER.bendFreq1 * Math.cos(z * RIVER.bendFreq1) +
        RIVER.bendAmp2 * RIVER.bendFreq2 * Math.cos(z * RIVER.bendFreq2 + RIVER.bendPhase2)
    );
}

/** Metade da largura navegável na posição `z`. */
export function halfWidth(z) {
    return RIVER.halfWidth + RIVER.widthAmp * Math.sin(z * RIVER.widthFreq + RIVER.widthPhase);
}

/**
 * Quanto a margem é falésia em `z` (0 = encosta suave, 1 = paredão):
 *   c = 0,75 · smoothstep(0,3; 0,8; ½ + ½·sin(0,0031·z + 0,6))      trechos alternados
 *   g = smoothstep(gorgeStart → −fade) · (1 − smoothstep(gorgeEnd → −fade))   o desfiladeiro
 *   cliff = max(c, g)
 */
export function cliffAmount(z) {
    const wave = 0.5 + 0.5 * Math.sin(z * 0.0031 + 0.6);
    const c = 0.75 * smoothstep01((wave - 0.3) / 0.5);
    const g = smoothstep01((RIVER.gorgeStart - z) / RIVER.gorgeFade)
        * (1 - smoothstep01((RIVER.gorgeEnd - z) / RIVER.gorgeFade));
    return Math.max(c, g);
}

/**
 * Altura do terreno — negativa dentro do leito, positiva nas margens.
 * Com e = |x − centro| − meiaLargura (metros além da borda navegável):
 *   praia    = lerp(−bedDepth, beachTop, smoothstep((e + beachIn) / beachSpan))   (linha d'água em e ≈ 1 m)
 *   barranco = H(z) · smoothstep((e − bankStart) / W(z)),  H e W interpolados por cliff(z)
 *   relevo   = barranco⁰ · (senoides de média e alta frequência)
 *   morros   = como antes, fechando o vale
 */
export function terrainHeight(x, z) {
    const e = Math.abs(x - centerX(z)) - halfWidth(z);
    const beach = smoothstep01((e + RIVER.beachIn) / RIVER.beachSpan);
    const cliff = cliffAmount(z);
    const bankH = RIVER.bankHeightSoft + (RIVER.bankHeightCliff - RIVER.bankHeightSoft) * cliff;
    const bankW = RIVER.bankRampSoft + (RIVER.bankRampCliff - RIVER.bankRampSoft) * cliff;
    const s = smoothstep01((e - RIVER.bankStart) / bankW);

    let h = -RIVER.bedDepth + (RIVER.bedDepth + RIVER.beachTop) * beach + bankH * s;

    // Relevo das margens: some na praia (fator `s`).
    h += s * RIVER.ridgeAmp * (
        0.62 * Math.sin(z * RIVER.ridgeFreqA + x * 0.013) +
        0.38 * Math.sin(x * RIVER.ridgeFreqB - z * 0.011) +
        0.34 * Math.sin(x * 0.09 + z * 0.05) * Math.sin(z * 0.07 - x * 0.03) +
        0.14 * Math.sin(x * 0.23 - z * 0.19)
    );
    // Ondulação miúda da praia (bancos de seixo).
    h += beach * (1 - s) * 0.28 * Math.sin(x * 0.31 + z * 0.17) * Math.sin(z * 0.21 - x * 0.11);

    // Montanhas distantes fechando o vale.
    const hill = smoothstep01((e - RIVER.hillStart) / RIVER.hillRamp);
    h += hill * hill * RIVER.hillHeight * (
        0.62 + 0.38 * Math.sin(z * 0.0041 + x * 0.0029)
    );

    // Esplanada do castelo: o vale se abre num terreno plano para que muralhas
    // e torres tenham onde se apoiar.
    const flat = 1 - smoothstep01((Math.abs(z - CASTLE_Z) - RIVER.esplanadeInner) / RIVER.esplanadeFade);
    if (flat > 0) {
        const plateau = -RIVER.bedDepth + (RIVER.bedDepth + RIVER.esplanadeHeight) * beach;
        h = h + (plateau - h) * flat;
    }

    return h;
}

/** Posição navegável mais próxima, dado um alvo lateral em [-1, 1]. */
export function lanePosition(z, lane) {
    return centerX(z) + lane * halfWidth(z);
}

const f = (v) => {
    const s = v.toFixed(6);
    return s.includes('.') ? s : `${s}.0`;
};

/**
 * Versão GLSL das funções acima (nomes prefixados com `rk` para evitar
 * colisão com o código gerado pelo three.js).
 */
export const RIVER_GLSL = /* glsl */ `
float rkCenterX(float z) {
    return ${f(RIVER.bendAmp1)} * sin(z * ${f(RIVER.bendFreq1)})
         + ${f(RIVER.bendAmp2)} * sin(z * ${f(RIVER.bendFreq2)} + ${f(RIVER.bendPhase2)});
}

float rkHalfWidth(float z) {
    return ${f(RIVER.halfWidth)} + ${f(RIVER.widthAmp)} * sin(z * ${f(RIVER.widthFreq)} + ${f(RIVER.widthPhase)});
}

float rkShoreDist(float x, float z) {
    // distância à linha d'água (a praia cruza y = 0 em e ≈ 1 m)
    return abs(x - rkCenterX(z)) - rkHalfWidth(z) - 1.0;
}

float rkCliff(float z) {
    float wave = 0.5 + 0.5 * sin(z * 0.0031 + 0.6);
    float c = 0.75 * smoothstep(0.0, 1.0, (wave - 0.3) / 0.5);
    float g = smoothstep(0.0, 1.0, (${f(RIVER.gorgeStart)} - z) / ${f(RIVER.gorgeFade)})
        * (1.0 - smoothstep(0.0, 1.0, (${f(RIVER.gorgeEnd)} - z) / ${f(RIVER.gorgeFade)}));
    return max(c, g);
}

float rkHeight(float x, float z) {
    float e = abs(x - rkCenterX(z)) - rkHalfWidth(z);
    float beach = smoothstep(0.0, 1.0, (e + ${f(RIVER.beachIn)}) / ${f(RIVER.beachSpan)});
    float cliff = rkCliff(z);
    float bankH = mix(${f(RIVER.bankHeightSoft)}, ${f(RIVER.bankHeightCliff)}, cliff);
    float bankW = mix(${f(RIVER.bankRampSoft)}, ${f(RIVER.bankRampCliff)}, cliff);
    float s = smoothstep(0.0, 1.0, (e - ${f(RIVER.bankStart)}) / bankW);

    float h = -${f(RIVER.bedDepth)} + ${f(RIVER.bedDepth + RIVER.beachTop)} * beach + bankH * s;

    h += s * ${f(RIVER.ridgeAmp)} * (
        0.62 * sin(z * ${f(RIVER.ridgeFreqA)} + x * 0.013) +
        0.38 * sin(x * ${f(RIVER.ridgeFreqB)} - z * 0.011) +
        0.34 * sin(x * 0.09 + z * 0.05) * sin(z * 0.07 - x * 0.03) +
        0.14 * sin(x * 0.23 - z * 0.19)
    );
    h += beach * (1.0 - s) * 0.28 * sin(x * 0.31 + z * 0.17) * sin(z * 0.21 - x * 0.11);

    float hill = smoothstep(0.0, 1.0, (e - ${f(RIVER.hillStart)}) / ${f(RIVER.hillRamp)});
    h += hill * hill * ${f(RIVER.hillHeight)} * (0.62 + 0.38 * sin(z * 0.0041 + x * 0.0029));

    // Esplanada do castelo. (\`flat\` é palavra reservada em GLSL ES 3.0.)
    float rkFlat = 1.0 - smoothstep(0.0, 1.0,
        (abs(z - ${f(CASTLE_Z)}) - ${f(RIVER.esplanadeInner)}) / ${f(RIVER.esplanadeFade)});
    float plateau = -${f(RIVER.bedDepth)} + ${f(RIVER.bedDepth + RIVER.esplanadeHeight)} * beach;
    h = mix(h, plateau, clamp(rkFlat, 0.0, 1.0));

    return h;
}
`;
