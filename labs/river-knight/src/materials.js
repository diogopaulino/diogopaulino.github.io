/**
 * Materiais PBR compartilhados do River Knight (texturas reais de
 * `labs/shared/assets`, via `pbrMaterial`).
 *
 * Convenção de UV: as geometrias usam UV em METROS (`applyWorldUV(geo, 1)` ou
 * UV gerada à mão em metros). O parâmetro `tile` de cada material é o lado, em
 * metros, coberto por uma repetição da textura — então `repeat = 1 / tile`.
 *
 * Todos os materiais são cacheados por chave: peça o mesmo material duas vezes
 * e receba a mesma instância (menos programas, menos trocas de estado). Quem
 * precisar alterar um material (emissivo, opacidade) deve clonar.
 */

import * as THREE from 'three';
import { pbrMaterial } from '../../shared/gfx/assets.js';

const cache = new Map();

function cached(key, factory) {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
}

const hex = (c) => (typeof c === 'number' ? c.toString(16) : String(c));

/**
 * Material PBR genérico cacheado.
 * @param {string} set   nome do conjunto em assets.js (ex.: 'oak_wood_planks')
 * @param {object} [o]   tile (m por repetição), color, normalScale, roughness, metal, side…
 */
export function pbr(set, { tile = 2, color = 0xffffff, ...rest } = {}) {
    const key = `${set}|${tile}|${hex(color)}|${JSON.stringify(rest)}`;
    return cached(key, () => pbrMaterial(set, { repeat: 1 / tile, color, ...rest }));
}

/** Tábuas envelhecidas (casco, cais, paliçadas). */
export const plankWood = (color = 0xffffff, tile = 2.4) => pbr('weathered_brown_planks', { tile, color });
/** Tábuas escuras (convés, navios inimigos, vigas). */
export const darkWood = (color = 0xffffff, tile = 2.2) => pbr('dark_wooden_planks', { tile, color });
/** Carvalho claro (mastro, remos, carretas). */
export const oakWood = (color = 0xffffff, tile = 2) => pbr('oak_wood_planks', { tile, color });
/** Casca (troncos de barricada, estacas). As cascas do kit são escuras: ganho > 1. */
export const barkWood = (gain = 1.7, tile = 1.5) => cached(`bark|${gain}|${tile}`, () => {
    const m = pbrMaterial('bark_brown_02', { repeat: 1 / tile });
    m.color.setScalar(gain);
    return m;
});

/** Alvenaria de castelo (muralhas, torres). */
export const castleStone = (color = 0xffffff, tile = 3.2) => pbr('castle_wall_slates', { tile, color });
/** Blocos medievais aparelhados (torres de vigia, cais). */
export const blockStone = (color = 0xffffff, tile = 2.6) => pbr('medieval_blocks_02', { tile, color });
/** Calçamento (cais, pátio). */
export const cobble = (color = 0xffffff, tile = 2.4) => pbr('cobblestone_floor_08', { tile, color });
/** Rocha de falésia. */
export const cliffRock = (color = 0xffffff, tile = 6) => pbr('cliff_side', { tile, color });
/** Rocha com musgo (pedras do leito). */
export const mossRock = (color = 0xffffff, tile = 4) => pbr('mossy_rock', { tile, color });

/** Telhado de ardósia / telha de barro / palha. */
export const slateRoof = (color = 0xffffff, tile = 2.2) => pbr('roof_slates_02', { tile, color });
export const clayRoof = (color = 0xffffff, tile = 2.2) => pbr('clay_roof_tiles_02', { tile, color });
export const thatchRoof = (color = 0xffffff, tile = 2.4) => pbr('thatch_roof_angled', { tile, color });

/** Ferro forjado/enferrujado (ferragens, grades, aros). */
export const iron = (color = 0x8a857c, tile = 1.2) => pbr('rusty_metal_02', { tile, color, metal: true, roughness: 0.85 });
/** Couro (alças, selas, foles). */
export const leather = (color = 0xffffff, tile = 1) => pbr('brown_leather', { tile, color });
/** Tecido grosso (velas, estandartes, toldos). `side` duplo por padrão. */
export const canvasCloth = (color = 0xffffff, tile = 1.2) =>
    pbr('fabric_pattern_07', { tile, color, side: THREE.DoubleSide, normalScale: 0.6 });

/**
 * Bronze de canhão: metal liso com o normal map de metal envelhecido para
 * quebrar o reflexo. F0 do bronze ≈ (0,71; 0,48; 0,24) em sRGB ~ 0xb5873f.
 */
export const bronze = (color = 0xb5873f, roughness = 0.34) => cached(`bronze|${hex(color)}|${roughness}`, () => {
    const m = pbrMaterial('rusty_metal_02', { repeat: 1.5, color, normalScale: 0.35 });
    m.map = null;
    m.roughnessMap = null;
    m.aoMap = null;
    m.metalnessMap = null;
    m.metalness = 1;
    m.roughness = roughness;
    m.envMapIntensity = 1.25;
    m.name = 'bronze';
    return m;
});

/** Aço polido (elmos, lâminas, pregos). */
export const steel = (color = 0xb9bec6, roughness = 0.3) => cached(`steel|${hex(color)}|${roughness}`, () =>
    new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.2, name: 'steel' }));

/** Material liso sem textura (cordas, detalhes pintados). Use com parcimônia. */
export const plain = (color, roughness = 0.75, metalness = 0, extra = null) =>
    cached(`plain|${hex(color)}|${roughness}|${metalness}|${JSON.stringify(extra)}`, () =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...(extra || {}) }));

/**
 * Emissivo para fogo, brasa e vidro iluminado. A cena é HDR com bloom contido:
 * intensidades de 2–6 já "acendem" sem estourar.
 */
export const glow = (color = 0xff9a3c, intensity = 3) => cached(`glow|${hex(color)}|${intensity}`, () =>
    new THREE.MeshStandardMaterial({
        color: 0x1a0d05, emissive: color, emissiveIntensity: intensity, roughness: 0.6, toneMapped: true, name: 'glow'
    }));
