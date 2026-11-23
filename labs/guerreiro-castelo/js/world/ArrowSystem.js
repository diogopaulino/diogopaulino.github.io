/**
 * Flechas dos arqueiros: balística simples com rastro luminoso.
 *
 *   v ← v + g·dt (g = 9,81 m/s² para baixo),  p ← p + v·dt,  a flecha aponta para v
 * Arco longo de guerra: 40–50 m/s na saída. `aim()` resolve o ângulo de tiro baixo que
 * acerta um alvo (balística sem arrasto):
 *   tan θ = (v² − √(v⁴ − g·(g·d² + 2·h·v²))) / (g·d)
 * (d = distância horizontal, h = desnível). Fora de alcance → 45° (alcance máximo).
 * Acerta o jogador se o trecho voado no quadro passar a menos de 0,65 m do centro do corpo
 * (0,9 m acima dos pés) — teste varrido, sem "atravessar" o alvo em quadros lentos.
 * Crava no chão (`groundFn(x, z)`, padrão: nível do mar) ou onde `blockFn(p)` disser (casco
 * do navio, muralha) e some depois de 2 s. Tudo em coordenadas de mundo.
 *
 * Rastro: duas fitas cruzadas de 1,7 m atrás da flecha, aditivas, com alfa caindo ao longo
 * do comprimento — custa 2 triângulos por fita e deixa o tiro legível contra o céu.
 * As flechas vêm de um pool fixo: nada é alocado durante o voo.
 */

import * as THREE from 'three';

const POOL = 28;
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _pl = new THREE.Vector3();

export class ArrowSystem {
    constructor(scene) {
        this.scene = scene;
        this.gravity = 9.81;
        this.onHitPlayer = null;
        this.groundFn = null;
        this.blockFn = null;
        this.active = [];
        this.free = [];

        const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.8 });
        const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.9 });
        const feather = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9, side: THREE.DoubleSide });
        const trailMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `varying vec2 vUv; void main(){
                float a = pow(vUv.y, 2.2) * (1.0 - abs(vUv.x - 0.5) * 2.0);
                gl_FragColor = vec4(vec3(1.6, 1.25, 0.8) * a, a * 0.55); }`
        });
        // flecha modelada ao longo de +Z (ponta em +Z)
        const shaftGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.78, 6).rotateX(Math.PI / 2);
        const headGeo = new THREE.ConeGeometry(0.02, 0.07, 6).rotateX(Math.PI / 2).translate(0, 0, 0.42);
        const vane = new THREE.Shape();
        vane.moveTo(0, 0); vane.lineTo(0.03, 0.02); vane.lineTo(0.035, 0.11); vane.lineTo(0, 0.13);
        const vaneGeo = new THREE.ShapeGeometry(vane).rotateX(-Math.PI / 2).translate(0, 0, -0.26);
        const trailGeo = new THREE.PlaneGeometry(0.07, 1.7).rotateX(-Math.PI / 2).translate(0, 0, -1.25);

        for (let i = 0; i < POOL; i++) {
            const root = new THREE.Group();
            root.add(new THREE.Mesh(shaftGeo, wood), new THREE.Mesh(headGeo, steel));
            for (let k = 0; k < 3; k++) {
                const f = new THREE.Mesh(vaneGeo, feather);
                f.rotation.z = (k / 3) * Math.PI * 2;
                root.add(f);
            }
            const trail = new THREE.Group();
            const t1 = new THREE.Mesh(trailGeo, trailMat);
            const t2 = new THREE.Mesh(trailGeo, trailMat);
            t2.rotation.z = Math.PI / 2;
            trail.add(t1, t2);
            root.add(trail);
            root.visible = false;
            root.userData.keep = true;
            root.children[0].castShadow = true;
            scene.add(root);
            this.free.push({ root, trail, vel: new THREE.Vector3(), stuck: 0 });
        }
    }

    /** Mantido por compatibilidade com os níveis antigos. */
    setColliders() {}

    /**
     * Direção de tiro (em `out`, unitária) para acertar `target` saindo de `origin` a
     * `speed` m/s, pelo arco baixo. Não aloca.
     */
    aim(origin, target, speed, out) {
        const dx = target.x - origin.x;
        const dz = target.z - origin.z;
        const h = target.y - origin.y;
        const d = Math.hypot(dx, dz) || 0.001;
        const g = this.gravity;
        const v2 = speed * speed;
        const disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
        const tan = disc >= 0 ? (v2 - Math.sqrt(disc)) / (g * d) : 1;
        const cos = 1 / Math.sqrt(1 + tan * tan);
        out.set((dx / d) * cos, tan * cos, (dz / d) * cos);
        return out;
    }

    fire(origin, direction, speed = 28) {
        const a = this.free.pop();
        if (!a) return null;
        a.root.position.copy(origin);
        a.vel.copy(direction).normalize().multiplyScalar(speed);
        a.stuck = 0;
        a.trail.visible = true;
        a.root.visible = true;
        a.root.lookAt(_p.copy(origin).add(a.vel));
        this.active.push(a);
        return a;
    }

    _release(i) {
        const a = this.active[i];
        a.root.visible = false;
        this.active.splice(i, 1);
        this.free.push(a);
    }

    update(dt, game) {
        if (!this.active.length) return;
        game.player.worldPosition(_pl);
        _pl.y += 0.9;
        for (let i = this.active.length - 1; i >= 0; i--) {
            const a = this.active[i];
            if (a.stuck > 0) {
                a.stuck -= dt;
                if (a.stuck <= 0) this._release(i);
                continue;
            }

            a.vel.y -= this.gravity * dt;
            const pos = a.root.position;
            _p.copy(pos);
            pos.addScaledVector(a.vel, dt);

            /* teste varrido: a 45 m/s a flecha anda 0,75 m por quadro — mais que o raio de
               acerto. Distância do jogador ao SEGMENTO percorrido neste quadro. */
            _v.subVectors(pos, _p);
            const segL2 = _v.lengthSq() || 1e-6;
            const u = Math.max(0, Math.min(1, ((_pl.x - _p.x) * _v.x + (_pl.y - _p.y) * _v.y + (_pl.z - _p.z) * _v.z) / segL2));
            _p.addScaledVector(_v, u);
            if (_p.distanceToSquared(_pl) < 0.65 * 0.65) {
                this.onHitPlayer?.(1);
                this._release(i);
                continue;
            }

            const ground = this.groundFn ? this.groundFn(pos.x, pos.z) : -0.3;
            if (pos.y < ground + 0.02 || (this.blockFn && this.blockFn(pos))) {
                if (pos.y < ground) pos.y = ground + 0.05;
                a.stuck = 2.0;
                a.trail.visible = false;
                game.audio?.play('impact');
                continue;
            }

            a.root.lookAt(_v.copy(pos).add(a.vel));
            if (pos.distanceToSquared(_pl) > 400 * 400) this._release(i);
        }
    }

    clear() {
        for (let i = this.active.length - 1; i >= 0; i--) this._release(i);
        this.groundFn = null;
        this.blockFn = null;
    }
}
