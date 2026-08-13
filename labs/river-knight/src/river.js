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
import { CASTLE_Z } from './config.js';

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

    bankRamp: 30,
    bankHeight: 21,
    bedDepth: 5.4,

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

/** Altura do terreno — negativa dentro do leito, positiva nas margens. */
export function terrainHeight(x, z) {
    const d = Math.abs(x - centerX(z));
    const w = halfWidth(z);
    const s = smoothstep01((d - w) / RIVER.bankRamp);

    let h = -RIVER.bedDepth + (RIVER.bedDepth + RIVER.bankHeight) * s;

    // Relevo das margens: some suavemente dentro d'água (fator `s`).
    h += s * RIVER.ridgeAmp * (
        0.62 * Math.sin(z * RIVER.ridgeFreqA + x * 0.013) +
        0.38 * Math.sin(x * RIVER.ridgeFreqB - z * 0.011)
    );

    // Montanhas distantes fechando o vale.
    const hill = smoothstep01((d - w - RIVER.hillStart) / RIVER.hillRamp);
    h += hill * hill * RIVER.hillHeight * (
        0.62 + 0.38 * Math.sin(z * 0.0041 + x * 0.0029)
    );

    // Esplanada do castelo: o vale se abre num terreno plano para que muralhas
    // e torres tenham onde se apoiar.
    const flat = 1 - smoothstep01((Math.abs(z - CASTLE_Z) - RIVER.esplanadeInner) / RIVER.esplanadeFade);
    if (flat > 0) {
        const plateau = -RIVER.bedDepth + (RIVER.bedDepth + RIVER.esplanadeHeight) * s;
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
    return abs(x - rkCenterX(z)) - rkHalfWidth(z);
}

float rkHeight(float x, float z) {
    float d = abs(x - rkCenterX(z));
    float w = rkHalfWidth(z);
    float s = smoothstep(0.0, 1.0, (d - w) / ${f(RIVER.bankRamp)});

    float h = -${f(RIVER.bedDepth)} + (${f(RIVER.bedDepth)} + ${f(RIVER.bankHeight)}) * s;

    h += s * ${f(RIVER.ridgeAmp)} * (
        0.62 * sin(z * ${f(RIVER.ridgeFreqA)} + x * 0.013) +
        0.38 * sin(x * ${f(RIVER.ridgeFreqB)} - z * 0.011)
    );

    float hill = smoothstep(0.0, 1.0, (d - w - ${f(RIVER.hillStart)}) / ${f(RIVER.hillRamp)});
    h += hill * hill * ${f(RIVER.hillHeight)} * (0.62 + 0.38 * sin(z * 0.0041 + x * 0.0029));

    // Esplanada do castelo. (\`flat\` é palavra reservada em GLSL ES 3.0.)
    float rkFlat = 1.0 - smoothstep(0.0, 1.0,
        (abs(z - ${f(CASTLE_Z)}) - ${f(RIVER.esplanadeInner)}) / ${f(RIVER.esplanadeFade)});
    float plateau = -${f(RIVER.bedDepth)} + (${f(RIVER.bedDepth)} + ${f(RIVER.esplanadeHeight)}) * s;
    h = mix(h, plateau, clamp(rkFlat, 0.0, 1.0));

    return h;
}
`;
