/**
 * Fogo, tochas e brasas. As chamas são partículas "sem estado" de gfx/particles
 * (posição = função do tempo, custo de CPU ~zero) em mistura aditiva com cor HDR,
 * então o bloom do palco acende sozinho. A luz pontual tremula por soma de senos:
 *   I(t) = I0 · (0,86 + 0,09·sin(9,1t + φ) + 0,05·sin(23,7t + 1,7φ))
 */
import * as THREE from 'three';
import { createParticles } from '../../../shared/gfx/particles.js';
import { Kit, mat, block } from './Build.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Chama em (x,y,z) do grupo pai. `size` ≈ largura da base em metros.
 * @returns {{ light: THREE.PointLight|null, base: number, phase: number, parts: Array, setLit(bool) }}
 */
export function makeFire(parent, x, y, z, { size = 0.5, light = true, intensity = 9, distance = 9, shadow = false, shadowMap = 512, color = 0xffd4a8, smoke = false } = {}) {
    const parts = [];
    const flame = createParticles({
        count: Math.round(22 + size * 26), life: 0.75,
        origin: V(x, y, z), spread: V(size * 0.32, size * 0.05, size * 0.32),
        velocity: V(0, 0.9 + size * 0.9, 0), velocitySpread: V(0.1, 0.25, 0.1),
        turbulence: 0.06 + size * 0.05, size: [size * 0.95, size * 0.2], color: 0xffffff, opacity: 0.55, additive: true
    });
    flame.uniforms.uColor.value.setRGB(2.6, 0.95, 0.22);
    const core = createParticles({
        count: Math.round(10 + size * 12), life: 0.45,
        origin: V(x, y + size * 0.05, z), spread: V(size * 0.16, size * 0.03, size * 0.16),
        velocity: V(0, 0.7 + size * 0.6, 0), velocitySpread: V(0.05, 0.15, 0.05),
        turbulence: 0.03, size: [size * 0.55, size * 0.12], color: 0xffffff, opacity: 0.6, additive: true
    });
    core.uniforms.uColor.value.setRGB(3.2, 2.2, 0.9);
    const sparks = createParticles({
        count: Math.round(8 + size * 10), life: 1.6,
        origin: V(x, y + size * 0.2, z), spread: V(size * 0.25, 0.05, size * 0.25),
        velocity: V(0, 1.1 + size, 0), velocitySpread: V(0.35, 0.5, 0.35),
        turbulence: 0.35, size: [0.035, 0.012], color: 0xffffff, opacity: 1, additive: true
    });
    sparks.uniforms.uColor.value.setRGB(4, 1.6, 0.4);
    parts.push(flame, core, sparks);
    if (smoke) {
        const sm = createParticles({
            count: 14, life: 3.2, origin: V(x, y + size * 0.8, z), spread: V(size * 0.2, 0.05, size * 0.2),
            velocity: V(0, 0.8, 0), velocitySpread: V(0.1, 0.15, 0.1), turbulence: 0.25,
            size: [size * 0.6, size * 2.2], color: 0x2a2622, opacity: 0.16
        });
        parts.push(sm);
    }
    for (const p of parts) {
        p.mesh.userData.ownGeo = true;
        parent.add(p.mesh);
    }
    let lamp = null;
    if (light) {
        lamp = new THREE.PointLight(color, intensity, distance, 1.6);
        lamp.position.set(x, y + size * 0.6, z);
        if (shadow) {
            lamp.castShadow = true;
            lamp.shadow.mapSize.set(shadowMap, shadowMap);
            lamp.shadow.bias = -0.004;
            lamp.shadow.normalBias = 0.03;
            lamp.shadow.camera.near = 0.15;
            lamp.shadow.camera.far = distance;
        }
        parent.add(lamp);
    }
    return {
        light: lamp, base: intensity, phase: (x * 3.1 + z * 1.7 + y) % 6.28, parts,
        setLit(on) {
            for (const p of parts) p.mesh.visible = on;
            if (lamp) lamp.visible = on;
        }
    };
}

/**
 * Tocha de parede: arandela de ferro (haste dobrada + copo torneado), cabo de madeira
 * e cabeça enrolada em pano. `ry` aponta a tocha para fora da parede.
 * A geometria vai para o Kit do nível; a chama devolvida entra no EnvironmentFX.
 */
export function addTorch(kit, parent, x, y, z, ry = 0, opts = {}) {
    // peças modeladas no referencial da tocha (z = para fora da parede) e levadas ao nível por M = T·Ry
    const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    const L = new THREE.Matrix4();
    const at = (g, lx, ly, lz, rx = 0) => g.applyMatrix4(L.makeRotationX(rx).setPosition(lx, ly, lz)).applyMatrix4(M);
    // placa na parede, braço e copo (ferro)
    kit.add('iron', at(block(0.12, 0.3, 0.03, 0.01), 0, 0, 0.02));
    kit.add('iron', at(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 8), 0, -0.02, 0.14, Math.PI / 2 - 0.5));
    const cup = new THREE.LatheGeometry([[0.03, 0], [0.05, 0.02], [0.058, 0.09], [0.05, 0.1], [0.04, 0.02]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
    kit.add('iron', at(cup, 0, 0.02, 0.25, -0.32));
    // cabo e cabeça
    kit.add('darkwood', at(new THREE.CylinderGeometry(0.024, 0.02, 0.5, 8), 0, 0.2, 0.31, -0.32));
    kit.add('cloth', at(new THREE.CylinderGeometry(0.05, 0.036, 0.16, 10), 0, 0.46, 0.39, -0.32));
    const fx = x + 0.42 * Math.sin(ry);
    const fz = z + 0.42 * Math.cos(ry);
    return makeFire(parent, fx, y + 0.54, fz, { size: 0.3, intensity: 5, distance: 10, ...opts });
}

/** Mantém as chamas vivas: relógio das partículas e tremor das luzes. */
export class EnvironmentFX {
    constructor() {
        this.fires = [];
    }

    addFire(fire) {
        if (fire) this.fires.push(fire);
        return fire;
    }

    update(time) {
        for (const f of this.fires) {
            for (const p of f.parts) p.update(time);
            if (f.light) {
                f.light.intensity = f.base * (0.86 + 0.09 * Math.sin(time * 9.1 + f.phase) + 0.05 * Math.sin(time * 23.7 + f.phase * 1.7));
            }
        }
    }
}

export { Kit, mat };
