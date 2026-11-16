/**
 * gfx/textures — conjuntos PBR procedurais (albedo + normal + rugosidade), tileáveis.
 *
 * Cada receita descreve um campo de altura h(u,v) ∈ [0,1] periódico em [0,1)²;
 * a normal sai do gradiente de h (diferenças centrais com wrap):
 *   n = normalize(−∂h/∂u · s, −∂h/∂v · s, 1)
 * Albedo e rugosidade derivam de h + ruído, então relevo, cor e brilho concordam.
 * Nada é baixado: tudo nasce em CPU no boot (cache por nome) e sobe com mipmaps.
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise2, fbm2, fbm2a, ridged2, worley2, seeded } from './core.js';

const cache = new Map();
let maxAniso = 4;

export function configureTextures(renderer) {
    maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

function hashCell(i, j, s = 0) {
    let h = (i * 374761393 + j * 668265263 + s * 974711) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function finish(tex, srgb) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = maxAniso;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
}

/**
 * @param {number} size
 * @param {(u:number,v:number)=>number} heightFn
 * @param {(u:number,v:number,h:number,out:number[])=>void} shadeFn  escreve [r,g,b,rough] (0..1, cor em sRGB)
 * @param {number} strength intensidade do relevo
 */
function bake(size, heightFn, shadeFn, strength = 2) {
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) h[y * size + x] = heightFn(x / size, y / size);
    }
    const albedo = new Uint8Array(size * size * 4);
    const normal = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    const out = [0, 0, 0, 1];
    const m = size - 1;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            const hx = h[y * size + ((x + 1) & m)] - h[y * size + ((x - 1) & m)];
            const hy = h[((y + 1) & m) * size + x] - h[((y - 1) & m) * size + x];
            let nx = -hx * strength * size / 256;
            let ny = -hy * strength * size / 256;
            const il = 1 / Math.hypot(nx, ny, 1);
            nx *= il;
            ny *= il;
            const o = i * 4;
            normal[o] = (nx * 0.5 + 0.5) * 255;
            normal[o + 1] = (ny * 0.5 + 0.5) * 255;
            normal[o + 2] = (il * 0.5 + 0.5) * 255;
            normal[o + 3] = 255;
            shadeFn(x / size, y / size, h[i], out);
            albedo[o] = clamp(out[0], 0, 1) * 255;
            albedo[o + 1] = clamp(out[1], 0, 1) * 255;
            albedo[o + 2] = clamp(out[2], 0, 1) * 255;
            albedo[o + 3] = 255;
            const r = clamp(out[3], 0.02, 1) * 255;
            rough[o] = 255;
            rough[o + 1] = r;
            rough[o + 2] = 0;
            rough[o + 3] = 255;
        }
    }
    return {
        map: finish(new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat), true),
        normalMap: finish(new THREE.DataTexture(normal, size, size, THREE.RGBAFormat), false),
        roughnessMap: finish(new THREE.DataTexture(rough, size, size, THREE.RGBAFormat), false)
    };
}

const shadeRGB = (out, r, g, b, k, rough) => {
    out[0] = r * k;
    out[1] = g * k;
    out[2] = b * k;
    out[3] = rough;
};

/** Padrão de blocos em fiada (tijolo, paralelepípedo, cantaria). Retorna [borda 0..1, id]. */
function bond(u, v, cols, rows, jitter = 0) {
    const row = Math.floor(v * rows);
    const shift = (row % 2) * 0.5 + (jitter ? (hashCell(row, 0, 5) - 0.5) * jitter : 0);
    const cu = u * cols + shift;
    const col = Math.floor(cu);
    const fu = cu - col;
    const fv = v * rows - row;
    const edge = Math.min(fu, 1 - fu) * (rows / cols) * 2.2;
    const e = Math.min(edge, Math.min(fv, 1 - fv));
    const colW = ((col % cols) + cols) % cols;
    return [e, hashCell(colW, row, 9)];
}

const RECIPES = {
    /** Areia fina e batida de Santos: grão + ondulações suaves + pegadas. */
    sand(size = 512) {
        const rnd = seeded(77);
        const dents = Array.from({ length: 46 }, () => [rnd(), rnd(), 0.012 + rnd() * 0.016, rnd() * Math.PI]);
        return bake(size, (u, v) => {
            let h = fbm2(u * 6, v * 6, 4, 6, 3) * 0.55;
            h += noise2(u * 96, v * 96, 96, 21) * 0.12 + noise2(u * 200, v * 200, 200, 4) * 0.08;
            for (const d of dents) {
                let dx = Math.abs(u - d[0]);
                let dy = Math.abs(v - d[1]);
                dx = Math.min(dx, 1 - dx);
                dy = Math.min(dy, 1 - dy);
                const c = Math.cos(d[3]);
                const s = Math.sin(d[3]);
                const ex = (dx * c + dy * s) / d[2];
                const ey = (-dx * s + dy * c) / (d[2] * 0.45);
                const r = ex * ex + ey * ey;
                if (r < 1) h -= (1 - r) * 0.22;
            }
            return h;
        }, (u, v, h, out) => {
            const g = noise2(u * 220, v * 220, 220, 2);
            const k = 0.84 + h * 0.26 + (g - 0.5) * 0.1;
            const warm = fbm2(u * 4, v * 4, 3, 4, 31);
            shadeRGB(out, lerp(0.80, 0.86, warm), lerp(0.72, 0.76, warm), lerp(0.58, 0.60, warm), k, 0.94 - g * 0.06);
        }, 1.6);
    },

    asphalt(size = 512) {
        return bake(size, (u, v) => {
            const grain = noise2(u * 160, v * 160, 160, 3) * 0.5 + noise2(u * 320, v * 320, 320, 8) * 0.3;
            const [d] = worley2(u * 9, v * 9, 9, 4);
            const crack = smoothstep(0.045, 0.0, Math.abs(d - 0.52) ) * smoothstep(0.55, 0.75, fbm2(u * 3, v * 3, 2, 3, 12));
            return grain * 0.6 + fbm2(u * 5, v * 5, 3, 5, 6) * 0.3 - crack * 0.6;
        }, (u, v, h, out) => {
            const patch = fbm2(u * 3, v * 3, 3, 3, 40);
            const sp = noise2(u * 300, v * 300, 300, 17);
            const k = 0.5 + h * 0.5 + (sp > 0.82 ? 0.25 : 0);
            const base = lerp(0.16, 0.24, patch);
            shadeRGB(out, base, base, base * 1.04, k, 0.82 + sp * 0.14);
        }, 2.2);
    },

    concrete(size = 256) {
        return bake(size, (u, v) => {
            const pores = noise2(u * 120, v * 120, 120, 3);
            return fbm2(u * 6, v * 6, 4, 6, 2) * 0.7 - (pores > 0.86 ? 0.4 : 0) + noise2(u * 60, v * 60, 60, 9) * 0.1;
        }, (u, v, h, out) => {
            const stain = fbm2(u * 3, v * 3, 4, 3, 14);
            const k = 0.72 + h * 0.3 + (stain - 0.5) * 0.2;
            shadeRGB(out, 0.78, 0.77, 0.74, k, 0.86 - h * 0.1);
        }, 1.4);
    },

    /** Reboco pintado — mapa quase branco para ser tingido por cor de material/vértice. */
    plaster(size = 256) {
        return bake(size, (u, v) => fbm2(u * 10, v * 10, 4, 10, 5) * 0.6 + noise2(u * 90, v * 90, 90, 6) * 0.25,
            (u, v, h, out) => {
                const stain = fbm2a(u, v, 2, 5, 4, 77);
                const k = 0.86 + h * 0.12 + (stain - 0.5) * 0.14;
                shadeRGB(out, 1, 0.99, 0.97, k, 0.82 + h * 0.12);
            }, 0.9);
    },

    /** Reboco envelhecido (1908): manchas de umidade e descascados. */
    plasterOld(size = 512) {
        return bake(size, (u, v) => {
            const chip = smoothstep(0.74, 0.8, fbm2(u * 7, v * 7, 4, 7, 23));
            return fbm2(u * 12, v * 12, 4, 12, 5) * 0.5 + noise2(u * 110, v * 110, 110, 6) * 0.2 - chip * 0.35;
        }, (u, v, h, out) => {
            const chip = smoothstep(0.74, 0.8, fbm2(u * 7, v * 7, 4, 7, 23));
            const damp = smoothstep(0.35, 0.9, fbm2a(u, v, 3, 2, 4, 41) * (1.25 - v * 0.5));
            const k = 0.9 + h * 0.14 - damp * 0.28;
            const r = lerp(1, 0.78, chip);
            const g = lerp(0.98, 0.66, chip);
            const b = lerp(0.94, 0.55, chip);
            shadeRGB(out, r, g * (1 + damp * 0.03), b, k, 0.86);
        }, 1.3);
    },

    brick(size = 512) {
        return bake(size, (u, v) => {
            const [e, id] = bond(u, v, 8, 16);
            const face = smoothstep(0.03, 0.09, e);
            return face * (0.72 + id * 0.12 + fbm2(u * 40, v * 40, 2, 40, 3) * 0.16) + (1 - face) * 0.15;
        }, (u, v, h, out) => {
            const [e, id] = bond(u, v, 8, 16);
            const face = smoothstep(0.03, 0.07, e);
            const n = fbm2(u * 30, v * 30, 3, 30, 9);
            const soot = fbm2(u * 3, v * 3, 3, 3, 55);
            const br = lerp(0.50, 0.70, id);
            const k = (0.8 + n * 0.35) * (0.82 + soot * 0.3);
            const r = lerp(0.70, br * 1.0, face);
            const g = lerp(0.66, br * 0.52, face);
            const b = lerp(0.58, br * 0.40, face);
            shadeRGB(out, r, g, b, k, lerp(0.95, 0.84, face));
        }, 2.6);
    },

    /** Paralelepípedo de granito — pavimento do cais e das ruas em 1908. */
    cobble(size = 512) {
        return bake(size, (u, v) => {
            const [e, id] = bond(u, v, 8, 12, 0.35);
            const dome = smoothstep(0.0, 0.22, e);
            return dome * (0.7 + id * 0.25) + fbm2(u * 50, v * 50, 2, 50, 4) * 0.1;
        }, (u, v, h, out) => {
            const [e, id] = bond(u, v, 8, 12, 0.35);
            const face = smoothstep(0.02, 0.08, e);
            const n = noise2(u * 140, v * 140, 140, 7);
            const k = (0.55 + id * 0.35 + n * 0.16) * lerp(0.32, 1, face);
            const warm = hashCell(Math.floor(u * 8), Math.floor(v * 12), 3);
            shadeRGB(out, 0.62 + warm * 0.08, 0.60 + warm * 0.04, 0.57, k, lerp(0.95, 0.62 + n * 0.2, face));
        }, 3.2);
    },

    /** Cantaria — blocos grandes de granito (muralha do cais, mureta da orla). */
    ashlar(size = 512) {
        return bake(size, (u, v) => {
            const [e, id] = bond(u, v, 4, 8);
            const face = smoothstep(0.012, 0.05, e);
            return face * (0.7 + id * 0.15 + fbm2(u * 24, v * 24, 3, 24, 2) * 0.22);
        }, (u, v, h, out) => {
            const [e, id] = bond(u, v, 4, 8);
            const face = smoothstep(0.012, 0.04, e);
            const n = fbm2(u * 36, v * 36, 3, 36, 8);
            const streak = fbm2a(u, v, 12, 2, 3, 31);
            const k = (0.62 + id * 0.22 + n * 0.22) * lerp(0.4, 1, face) * (0.8 + streak * 0.3);
            shadeRGB(out, 0.68, 0.66, 0.62, k, 0.88);
        }, 2.4);
    },

    woodPlanks(size = 512) {
        return bake(size, (u, v) => {
            const p = u * 8;
            const pi = Math.floor(p);
            const fp = p - pi;
            const gap = smoothstep(0.0, 0.05, Math.min(fp, 1 - fp));
            const grain = fbm2a(u, v, 64, 5, 3, 40) ;
            return gap * (0.6 + grain * 0.35 + hashCell(pi, 3) * 0.08);
        }, (u, v, h, out) => {
            const p = u * 8;
            const pi = Math.floor(p);
            const fp = p - pi;
            const gap = smoothstep(0.0, 0.04, Math.min(fp, 1 - fp));
            const tone = hashCell(pi, 1);
            const grain = fbm2a(u, v, 96, 4, 3, 45);
            const k = (0.62 + grain * 0.5 + tone * 0.18) * lerp(0.25, 1, gap);
            shadeRGB(out, 0.62, 0.47, 0.32, k, 0.72 + grain * 0.2);
        }, 2.0);
    },

    /** Telha cerâmica capa-canal (colonial). */
    roofTile(size = 512) {
        return bake(size, (u, v) => {
            const cols = 10;
            const rows = 8;
            const cu = u * cols;
            const fu = cu - Math.floor(cu);
            const fv = v * rows - Math.floor(v * rows);
            const arch = Math.sin(fu * Math.PI);
            return Math.pow(arch, 0.7) * 0.75 + (1 - fv) * 0.25;
        }, (u, v, h, out) => {
            const cols = 10;
            const rows = 8;
            const ci = Math.floor(u * cols);
            const ri = Math.floor(v * rows);
            const id = hashCell(ci, ri, 2);
            const fv = v * rows - ri;
            const moss = smoothstep(0.55, 0.85, fbm2(u * 5, v * 5, 4, 5, 60));
            const k = (0.62 + h * 0.5) * (0.8 + id * 0.35) * lerp(1, 0.7, smoothstep(0.85, 1, fv));
            shadeRGB(out, lerp(0.74, 0.36, moss), lerp(0.36, 0.34, moss), lerp(0.24, 0.22, moss), k, 0.78);
        }, 3.0);
    },

    /** Gramado aparado. */
    grass(size = 512) {
        return bake(size, (u, v) => {
            const blades = noise2(u * 180, v * 60, 180, 5) * 0.5 + noise2(u * 70, v * 190, 70, 6) * 0.5;
            return blades * 0.7 + fbm2(u * 8, v * 8, 3, 8, 2) * 0.3;
        }, (u, v, h, out) => {
            const patch = fbm2(u * 9, v * 9, 4, 9, 88);
            const dry = smoothstep(0.66, 0.95, fbm2(u * 7, v * 7, 3, 7, 12)) * 0.45;
            const k = 0.66 + h * 0.5;
            shadeRGB(out, lerp(0.20, 0.36, dry) + patch * 0.05, lerp(0.40, 0.42, dry) + patch * 0.1, lerp(0.12, 0.15, dry), k, 0.9);
        }, 1.6);
    },

    /** Pedra portuguesa em ondas preto/branco — calçadão da orla. */
    mosaic(size = 512) {
        const wave = (u, v) => Math.sin(v * Math.PI * 2 * 4 + Math.sin(u * Math.PI * 2 * 2) * 1.9);
        return bake(size, (u, v) => {
            const [d] = worley2(u * 44, v * 44, 44, 6);
            return smoothstep(0.62, 0.2, d) * 0.9 + noise2(u * 90, v * 90, 90, 1) * 0.1;
        }, (u, v, h, out) => {
            const [d, id] = worley2(u * 44, v * 44, 44, 6);
            const w = wave(u, v);
            const dark = smoothstep(-0.12, 0.12, w);
            const joint = smoothstep(0.58, 0.7, d);
            const tone = lerp(0.9, 0.11, dark) * (0.86 + id * 0.2);
            const k = lerp(1, 0.45, joint);
            shadeRGB(out, tone, tone * 0.985, tone * 0.95, k, lerp(0.5 + id * 0.2, 0.9, joint));
        }, 2.4);
    },

    /** Estipe de palmeira: anéis das cicatrizes foliares. */
    barkPalm(size = 256) {
        return bake(size, (u, v) => {
            const ring = Math.abs(Math.sin(v * Math.PI * 14 + fbm2a(u, v, 6, 3, 2, 3) * 1.4));
            return Math.pow(ring, 0.5) * 0.7 + fbm2(u * 30, v * 30, 3, 30, 4) * 0.3;
        }, (u, v, h, out) => {
            const k = 0.5 + h * 0.6;
            const n = fbm2(u * 8, v * 8, 3, 8, 7);
            shadeRGB(out, 0.58 + n * 0.1, 0.52 + n * 0.08, 0.44, k, 0.9);
        }, 2.6);
    },

    /** Casca de árvore latifoliada: fissuras verticais. */
    barkTree(size = 256) {
        return bake(size, (u, v) => (1 - Math.abs(fbm2a(u, v, 10, 3, 4, 6) * 2 - 1)) * 0.8 + fbm2(u * 40, v * 40, 2, 40, 2) * 0.2,
            (u, v, h, out) => {
                const k = 0.4 + h * 0.75;
                const moss = smoothstep(0.6, 0.9, fbm2(u * 4, v * 4, 3, 4, 19));
                shadeRGB(out, lerp(0.44, 0.34, moss), lerp(0.37, 0.4, moss), lerp(0.29, 0.24, moss), k, 0.92);
            }, 3.0);
    },

    /** Chapas de aço rebitadas (casco e superestrutura) — mapa claro, tingível. */
    hull(size = 512) {
        return bake(size, (u, v) => {
            const cols = 4;
            const rows = 6;
            const [e] = bond(u, v, cols, rows);
            const seam = smoothstep(0.0, 0.018, e);
            // rebites ao longo das costuras
            const rv = (v * rows) % 1;
            const ru = (u * cols * 12) % 1;
            const rivetRow = Math.min(rv, 1 - rv) < 0.07 ? 1 : 0;
            const rivet = rivetRow * smoothstep(0.34, 0.12, Math.hypot(ru - 0.5, (Math.min(rv, 1 - rv) - 0.035) * 6));
            return seam * 0.5 + rivet * 0.5 + fbm2(u * 20, v * 20, 3, 20, 2) * 0.08;
        }, (u, v, h, out) => {
            const rust = smoothstep(0.52, 0.85, fbm2a(u, v, 6, 2, 4, 71) * (0.7 + fbm2a(u, v, 30, 4, 2, 5) * 0.6));
            const grime = fbm2(u * 3, v * 3, 3, 3, 13);
            const k = 0.82 + h * 0.14 + (grime - 0.5) * 0.18;
            shadeRGB(out, lerp(1, 0.62, rust), lerp(1, 0.36, rust), lerp(1, 0.22, rust), k, lerp(0.5, 0.92, rust));
        }, 2.0);
    },

    rock(size = 256) {
        return bake(size, (u, v) => ridged2(u * 5, v * 5, 5, 5, 4) * 0.7 + fbm2(u * 22, v * 22, 3, 22, 9) * 0.3,
            (u, v, h, out) => {
                const k = 0.45 + h * 0.75;
                const lichen = smoothstep(0.6, 0.85, fbm2(u * 6, v * 6, 3, 6, 33));
                shadeRGB(out, lerp(0.52, 0.5, lichen), lerp(0.48, 0.52, lichen), lerp(0.43, 0.38, lichen), k, 0.92);
            }, 3.2);
    },

    /** Trama de juta/lona. */
    burlap(size = 256) {
        return bake(size, (u, v) => {
            const a = Math.abs(Math.sin(u * Math.PI * 48));
            const b = Math.abs(Math.sin(v * Math.PI * 48));
            return (a * 0.5 + b * 0.5) * 0.8 + noise2(u * 80, v * 80, 80, 3) * 0.2;
        }, (u, v, h, out) => {
            const k = 0.62 + h * 0.5 + (fbm2(u * 5, v * 5, 3, 5, 8) - 0.5) * 0.2;
            shadeRGB(out, 0.80, 0.68, 0.48, k, 0.95);
        }, 2.0);
    },

    /** Tecido de roupa — trama fina + dobras suaves; quase branco (tingível). */
    cloth(size = 256) {
        return bake(size, (u, v) => {
            const weave = (Math.abs(Math.sin(u * Math.PI * 90)) + Math.abs(Math.sin(v * Math.PI * 90))) * 0.12;
            return fbm2a(u, v, 4, 6, 4, 15) * 0.8 + weave;
        }, (u, v, h, out) => shadeRGB(out, 1, 1, 1, 0.82 + h * 0.2, 0.86), 1.5);
    },

    earth(size = 256) {
        return bake(size, (u, v) => fbm2(u * 9, v * 9, 5, 9, 12) * 0.7 + noise2(u * 100, v * 100, 100, 4) * 0.3,
            (u, v, h, out) => shadeRGB(out, 0.52, 0.40, 0.29, 0.6 + h * 0.6, 0.95), 2.0);
    },

    /** Dossel de Mata Atlântica visto de longe (Serra do Mar). */
    canopy(size = 512) {
        return bake(size, (u, v) => {
            const [d, id] = worley2(u * 22, v * 22, 22, 3);
            return smoothstep(0.75, 0.0, d) * (0.6 + id * 0.4) + fbm2(u * 60, v * 60, 2, 60, 5) * 0.12;
        }, (u, v, h, out) => {
            const [, id] = worley2(u * 22, v * 22, 22, 3);
            // contraste contido + manchas largas: de longe lê como mata contínua, não como grão
            const patch = fbm2(u * 4, v * 4, 3, 4, 71);
            const k = 0.58 + h * 0.46 + (patch - 0.5) * 0.22;
            const y = id > 0.985 ? 0.6 : 0; // ipês/quaresmeiras salpicados
            shadeRGB(out, lerp(0.15 + id * 0.07, 0.62, y), lerp(0.34 + id * 0.09, 0.42, y), lerp(0.11, 0.5, y * 0.6), k, 0.9);
        }, 3.4);
    },

    /** Chapa ondulada de zinco. */
    corrugated(size = 256) {
        return bake(size, (u) => Math.sin(u * Math.PI * 2 * 16) * 0.5 + 0.5,
            (u, v, h, out) => {
                const rust = smoothstep(0.55, 0.9, fbm2(u * 4, v * 4, 4, 4, 91));
                const k = 0.7 + h * 0.3;
                shadeRGB(out, lerp(0.66, 0.5, rust), lerp(0.68, 0.32, rust), lerp(0.7, 0.2, rust), k, lerp(0.45, 0.9, rust));
            }, 3.0);
    },

    /** Ondulações capilares para o mar (apenas normal). */
    waterNormal(size = 256) {
        const rnd = seeded(404);
        const waves = Array.from({ length: 14 }, (_, i) => {
            const a = rnd() * Math.PI * 2;
            const f = 2 + Math.floor(rnd() * 9) + (i > 8 ? 8 : 0);
            return [Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), rnd() * 6.28, 1 / (1 + f * 0.35)];
        });
        return bake(size, (u, v) => {
            let h = 0;
            for (const w of waves) h += Math.sin((u * w[0] + v * w[1]) * Math.PI * 2 + w[2]) * w[3];
            return h * 0.12 + 0.5 + fbm2(u * 16, v * 16, 3, 16, 2) * 0.25;
        }, (u, v, h, out) => shadeRGB(out, 1, 1, 1, h, 0.1), 3.5);
    }
};

/** Retorna { map, normalMap, roughnessMap } (cache global por nome). */
export function textureSet(name) {
    if (!cache.has(name)) {
        const recipe = RECIPES[name];
        if (!recipe) throw new Error(`gfx/textures: receita desconhecida "${name}"`);
        cache.set(name, recipe());
    }
    return cache.get(name);
}

/**
 * Material PBR pronto a partir de uma receita.
 * `repeat` não é aplicado aqui — os labs geram UVs em metros (applyWorldUV / strips).
 */
export function pbr(name, {
    color = 0xffffff,
    roughness = 1,
    metalness = 0,
    normalScale = 1,
    envMapIntensity = 1,
    vertexColors = false,
    side = THREE.FrontSide,
    physical = false,
    ...rest
} = {}) {
    const set = textureSet(name);
    const Ctor = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Ctor({
        color,
        map: set.map,
        normalMap: set.normalMap,
        roughnessMap: set.roughnessMap,
        roughness,
        metalness,
        envMapIntensity,
        vertexColors,
        side,
        ...rest
    });
    m.normalScale.set(normalScale, normalScale);
    return m;
}

export function disposeTextures() {
    for (const set of cache.values()) {
        set.map.dispose();
        set.normalMap.dispose();
        set.roughnessMap.dispose();
    }
    cache.clear();
}
