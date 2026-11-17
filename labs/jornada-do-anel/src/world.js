/**
 * A Jornada do Anel — base comum dos capítulos: colisão, alturas, luzes,
 * objetos de missão (Anel, página da crônica) e ciclo de vida do cenário.
 *
 * Cada capítulo (ch-*.js) devolve um `ChapterWorld` montado sobre os kits
 * compartilhados: `terrain.js` (relevo, grama, floresta, água), `assets.js`
 * (texturas PBR e modelos fotogramétricos), `hero.js`/`creature.js` (elenco).
 */

import * as THREE from 'three';
import { clamp, smoothstep } from '../../shared/gfx/core.js';
import { loadModel } from '../../shared/gfx/assets.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { QUALITY } from './config.js?v=30';

const _v = new THREE.Vector3();

export class ChapterWorld {
    /** @param {{ stage: object, tier: 'low'|'medium'|'high' }} ctx */
    constructor(ctx) {
        this.ctx = ctx;
        this.stage = ctx.stage;
        this.tier = ctx.tier;
        this.q = QUALITY[ctx.tier] || QUALITY.medium;
        this.low = ctx.tier === 'low';
        this.group = new THREE.Group();
        this.colliders = [];
        this.interactables = [];
        this.riders = [];
        this.goblins = [];
        this.extras = [];
        this.updateFns = [];
        this.decks = [];
        this.waters = [];
        this.scatters = [];
        this.tramplers = [];
        this.pending = [];
        this.disposers = [];
        this.lights = [];
        this.terrain = null;
        this.grass = null;
        this.forest = null;
        this.ground = () => 0;
        this.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
        this.spawn = { x: 0, z: 0, yaw: 0 };
        this.overview = new THREE.Vector3(18, 14, 22);
        this.overviewLook = new THREE.Vector3(0, 2.5, 0);
        this.fallY = -Infinity;
        this.page = null;
        this.shadowAwake = false;
        this.disposed = false;
        /** Altura de jogo: relevo + tabuleiros (pontes, terraços, degraus). */
        this.heightAt = (x, z) => {
            let h = this.ground(x, z);
            for (let i = 0; i < this.decks.length; i++) {
                const d = this.decks[i](x, z);
                if (d > h) h = d;
            }
            return h;
        };
    }

    /**
     * Colisor cilíndrico. `block` = também corta a visão dos cavaleiros;
     * `top` = altura até onde barra a câmera (m acima do chão).
     */
    addCollider(x, z, r, { block = false, top = 3 } = {}) {
        this.colliders.push({ x, z, r, block, top });
    }

    /** Parede = fila de cilindros ao longo do segmento. */
    addWall(x1, z1, x2, z2, r = 0.5, opts = {}) {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const n = Math.max(1, Math.ceil(len / (r * 1.4)));
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            this.addCollider(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, r, opts);
        }
    }

    blockedAt(x, z, r) {
        const cs = this.colliders;
        for (let i = 0; i < cs.length; i++) {
            const c = cs[i];
            const dx = x - c.x;
            const dz = z - c.z;
            const rr = r + c.r;
            if (dx * dx + dz * dz < rr * rr) return true;
        }
        return false;
    }

    /** Ponto (x, y, z) está dentro de algo sólido? (colisão da câmera) */
    solidAt(x, y, z, skin = 0.3) {
        if (y < this.heightAt(x, z) + skin) return true;
        const cs = this.colliders;
        for (let i = 0; i < cs.length; i++) {
            const c = cs[i];
            const dx = x - c.x;
            const dz = z - c.z;
            const rr = c.r + skin * 0.5;
            if (dx * dx + dz * dz < rr * rr && y < this.ground(c.x, c.z) + c.top) return true;
        }
        return false;
    }

    addInteract(it) {
        this.interactables.push(it);
        return it;
    }

    /** Luz pontual sem sombra, respeitando o orçamento do tier. Devolve null se estourou. */
    addLight(x, y, z, color = 0xffb060, intensity = 6, distance = 12) {
        if (this.lights.length >= this.q.lights) return null;
        const l = new THREE.PointLight(color, intensity, distance, 1.6);
        l.position.set(x, y, z);
        this.group.add(l);
        this.lights.push(l);
        return l;
    }

    /** Carrega um modelo de assets.js e põe no chão. Não bloqueia a montagem. */
    prop(name, x, z, { ry = 0, y = null, collider = 0, block = false, top = 2, shadow = true, parent = null, ...load } = {}) {
        const p = loadModel(name, load).then((m) => {
            if (!m || this.disposed) return null;
            m.position.set(x, y ?? this.heightAt(x, z), z);
            m.rotation.y = ry;
            m.traverse((o) => {
                if (o.isMesh) {
                    o.castShadow = shadow;
                    o.receiveShadow = true;
                }
            });
            (parent || this.group).add(m);
            return m;
        });
        if (collider) this.addCollider(x, z, collider, { block, top });
        this.pending.push(p);
        return p;
    }

    /** Por quadro. */
    tick(dt, t, camera, player) {
        this.terrain?.update(camera);
        this.grass?.update(camera, dt, this.tramplers);
        this.forest?.update(camera);
        for (let i = 0; i < this.waters.length; i++) this.waters[i].update(dt);
        for (let i = 0; i < this.extras.length; i++) this.extras[i].update(dt, player);
        for (let i = 0; i < this.updateFns.length; i++) this.updateFns[i](t, dt, player, camera);
    }

    ready() {
        const list = [...this.pending];
        if (this.terrain?.ready) list.push(this.terrain.ready);
        if (this.forest?.ready) list.push(this.forest.ready);
        return Promise.all(list.map((p) => Promise.resolve(p).catch(() => null)));
    }

    dispose() {
        this.disposed = true;
        this.group.removeFromParent();
        for (const fn of this.disposers) {
            try {
                fn();
            } catch { /* peça já liberada */ }
        }
        this.grass?.dispose?.();
        this.forest?.dispose?.();
        for (const w of this.waters) w.dispose?.();
        this.terrain?.dispose?.();
        this.group.traverse((o) => {
            // só o que o lab criou: geometrias de glTF e de heróis são cacheadas pelos kits
            if (o.userData.own && o.geometry) o.geometry.dispose();
            if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
        });
    }
}

/** Marca malhas criadas pelo lab para serem descartadas com o capítulo. */
export function own(obj) {
    obj.traverse((o) => {
        if (o.isMesh) o.userData.own = true;
    });
    return obj;
}

/* ------------------------------------------------------------------ */
/* Objetos de missão                                                    */
/* ------------------------------------------------------------------ */

let glowTex = null;
function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
}

/** Halo aditivo voltado para a câmera (brilho de lanterna, cristal, Anel). */
export function halo(color = 0xffc060, size = 1, opacity = 0.6) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    s.scale.setScalar(size);
    return s;
}

let ringGeo = null;
let ringMat = null;
/**
 * O Anel: aro de ouro liso (seção em "D" confortável). O material é metal puro
 * com rugosidade baixa, então o reflexo é o `scene.environment` real do capítulo
 * (céu do palco); um halo discreto e uma luz fraca dão o brilho sutil.
 */
export function makeRing(scale = 1) {
    if (!ringGeo) {
        ringGeo = new THREE.TorusGeometry(0.105, 0.024, 28, 96);
        ringGeo.scale(1, 1, 1.25);
        ringGeo.userData.shared = true;
        ringMat = new THREE.MeshPhysicalMaterial({
            color: 0xffc552, metalness: 1, roughness: 0.07, envMapIntensity: 1.9, clearcoat: 0.6, clearcoatRoughness: 0.08,
            emissive: 0x3a2204, emissiveIntensity: 0.35
        });
        ringMat.userData.shared = true;
    }
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.castShadow = true;
    mesh.rotation.x = Math.PI / 2;
    g.add(mesh);
    const h = halo(0xffc45a, 0.9, 0.32);
    g.add(h);
    g.scale.setScalar(scale);
    g.userData.halo = h;
    g.userData.mesh = mesh;
    return g;
}

/**
 * Facho de luz sobre um objetivo: cilindro aberto com transparência que some
 * para cima e nas bordas (aditivo, sem escrever profundidade).
 */
export function lightShaft(height = 7, radius = 0.5, color = 0xffcc66) {
    const geo = new THREE.CylinderGeometry(radius * 0.35, radius, height, 24, 1, true);
    geo.translate(0, height / 2, 0);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.22 }, uH: { value: height } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            varying float vY; varying vec3 vN; varying vec3 vV;
            void main() {
                vY = position.y;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor; uniform float uOpacity; uniform float uH;
            varying float vY; varying vec3 vN; varying vec3 vV;
            void main() {
                float up = 1.0 - smoothstep(0.0, uH, vY);
                float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
                gl_FragColor = vec4(uColor * 2.0, up * up * rim * uOpacity);
            }`
    });
    const m = new THREE.Mesh(geo, mat);
    m.userData.own = true;
    m.renderOrder = 5;
    return m;
}

/** Página solta da crônica: folha de pergaminho levemente enrolada, flutuando. */
export function makePage(world, x, z, id) {
    const geo = new THREE.PlaneGeometry(0.34, 0.46, 10, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / 0.17;
        // enrolado nas bordas: z = 0,05·u² + canto dobrado
        pos.setZ(i, 0.05 * u * u + (u > 0.6 && pos.getY(i) > 0 ? (u - 0.6) * 0.12 : 0));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0xf2e2b8, emissive: 0xc89a48, emissiveIntensity: 0.55, roughness: 0.8, side: THREE.DoubleSide
    }));
    mesh.userData.own = true;
    mesh.castShadow = true;
    const g = new THREE.Group();
    g.add(mesh, halo(0xffd88a, 1.1, 0.25));
    const y = world.heightAt(x, z) + 0.95;
    g.position.set(x, y, z);
    world.group.add(g);
    world.page = world.addInteract({ x, z, r: 1.4, id, mesh: g, kind: 'page', label: 'Recolher página da crônica', done: false });
    world.updateFns.push((t) => {
        if (world.page.done) return;
        g.position.y = y + Math.sin(t * 2.2) * 0.1;
        g.rotation.y = t * 0.8;
    });
}

/* ------------------------------------------------------------------ */
/* Efeitos                                                              */
/* ------------------------------------------------------------------ */

/** Emissor de `particles.js` preso ao ciclo de vida do capítulo. */
export function emitter(world, opts) {
    const p = createParticles(opts);
    world.group.add(p.mesh);
    world.disposers.push(() => p.dispose());
    return p;
}

/** Fogo de braseiro/tocha: chama aditiva + fagulhas + halo + luz que tremula. */
export function addFire(world, x, y, z, { size = 1, sparks = true, light = true, intensity = 14, distance = 16 } = {}) {
    const flame = emitter(world, {
        count: Math.max(6, Math.round(22 * world.q.particles)), life: 0.9, origin: new THREE.Vector3(x, y, z),
        spread: new THREE.Vector3(0.14 * size, 0.04, 0.14 * size), velocity: new THREE.Vector3(0, 1.3 * size, 0),
        velocitySpread: new THREE.Vector3(0.18, 0.4, 0.18), turbulence: 0.25, size: [0.55 * size, 0.12 * size],
        color: 0xff8a2a, opacity: 0.75, additive: true
    });
    const sp = sparks && !world.low ? emitter(world, {
        count: 10, life: 2.2, origin: new THREE.Vector3(x, y + 0.2, z), spread: new THREE.Vector3(0.1, 0.05, 0.1),
        velocity: new THREE.Vector3(0, 1.6, 0), velocitySpread: new THREE.Vector3(0.5, 0.6, 0.5), turbulence: 0.7,
        size: [0.05, 0.02], color: 0xffc070, opacity: 0.9, additive: true
    }) : null;
    const core = halo(0xff9a3a, 1.6 * size, 0.55);
    core.position.set(x, y + 0.25 * size, z);
    world.group.add(core);
    const l = light ? world.addLight(x, y + 0.5, z, 0xff8a3a, intensity, distance) : null;
    const seed = x * 3.1 + z * 1.7;
    world.updateFns.push((t) => {
        flame.update(t);
        sp?.update(t);
        // tremulação: soma de dois senos fora de fase (±18 %)
        const f = 1 + Math.sin(t * 11 + seed) * 0.1 + Math.sin(t * 23.7 + seed * 2) * 0.08;
        if (l) l.intensity = intensity * f;
        core.material.opacity = 0.5 * f;
    });
    return { flame, light: l };
}

/** Partículas de ambiente (vaga-lumes, poeira, folhas, bruma) que acompanham o portador. */
export function addAmbient(world, opts, { follow = true, y = 0 } = {}) {
    const p = emitter(world, { ...opts, count: Math.max(8, Math.round((opts.count || 60) * world.q.particles)) });
    world.updateFns.push((t, dt, player) => {
        p.update(t);
        if (follow && player) p.uniforms.uOrigin.value.set(player.x, player.y + y, player.z);
    });
    return p;
}

/** Colisores a partir de pontos de dispersão (árvores, rochas). */
export function collidersFrom(world, placements, radius, opts = {}) {
    for (const p of placements) world.addCollider(p.x, p.z, radius * (p.s ?? p.scale ?? 1), opts);
}

export { clamp, smoothstep, _v };
