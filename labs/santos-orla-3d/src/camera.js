/**
 * Câmera: descida aérea → terceira pessoa, mapa e drone.
 *
 * Terceira pessoa: órbita atrás do visitante (distância d, pitch p):
 *   alvo = cabeça;  pos = alvo − frente·d·cos p + cima·d·sin p   (suavizado, λ = 10)
 *   a câmera nunca desce abaixo do chão (+0,35 m).
 * Drone: spline Catmull-Rom fechada ao longo da orla, percorrida a ~13 m/s, olhando
 *   um ponto mais à frente na própria curva projetado no calçadão.
 * Mapa: vista alta inclinada; em telas estreitas acompanha o X do visitante.
 */
import * as THREE from 'three';
import { INTRO, ORLA_HALF, groundY } from './config.js';
import { clamp, damp, lerp, smoothstep } from '../../shared/gfx/core.js';

const DRONE_POINTS = [
    [-345, 34, 150], [-300, 16, 84], [-230, 11, 58], [-150, 20, 96], [-100, 9, 50], [-40, 26, 20],
    [10, 46, 112], [86, 15, 44], [150, 9, 60], [178, 7, 40], [240, 22, 96], [305, 14, 62],
    [344, 26, 110], [300, 70, 240], [120, 110, 330], [-120, 90, 300], [-320, 60, 230]
];

export class OrlaCamera {
    constructor(camera) {
        this.camera = camera;
        this.mode = 'tourist';
        this.phase = 'menu'; // menu | intro | walk | map | cinematic
        this.introT = 0;
        this.pitch = 0.2;
        this.orbit = 0;      // desvio de yaw em relação ao visitante (arrasto)
        this.dist = 4.6;
        this.look = new THREE.Vector3();
        this.pos = new THREE.Vector3();
        this.focus = new THREE.Vector3(); // centro da sombra / foco de DoF
        this.focusDist = 8;
        this.droneT = 0;
        this.curve = new THREE.CatmullRomCurve3(DRONE_POINTS.map((p) => new THREE.Vector3(...p)), true, 'catmullrom', 0.5);
        this.curveLen = this.curve.getLength();
        this._a = new THREE.Vector3();
        this._b = new THREE.Vector3();
        this.menuT = 0;
    }

    startIntro() {
        this.phase = 'intro';
        this.introT = 0;
        this.setFov(50);
    }

    setFov(fov) {
        if (Math.abs(this.camera.fov - fov) > 0.01) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'map') this.phase = 'map';
        else if (mode === 'cinematic') this.phase = 'cinematic';
        else this.phase = 'walk';
    }

    drag(dx, dy) {
        if (this.phase !== 'walk') return;
        this.orbit -= dx * 0.005;
        this.pitch = clamp(this.pitch + dy * 0.004, -0.12, 1.1);
    }

    _walkTarget(player, out, lookOut) {
        const tourist = this.mode !== 'resident';
        const d = tourist ? this.dist : 2.7;
        const yaw = player.yaw + this.orbit;
        const head = player.y + (tourist ? 1.62 : 1.58);
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const side = tourist ? 0 : 0.45;
        lookOut.set(player.x + Math.cos(yaw) * side, head, player.z - Math.sin(yaw) * side);
        out.set(
            lookOut.x - Math.sin(yaw) * d * cp,
            head + d * sp + 0.25,
            lookOut.z - Math.cos(yaw) * d * cp
        );
        const floor = groundY(out.x, out.z) + 0.35;
        if (out.y < floor) out.y = floor;
        // olha um pouco à frente do visitante
        lookOut.x += Math.sin(yaw) * 2.2;
        lookOut.z += Math.cos(yaw) * 2.2;
        lookOut.y += 0.1 - sp * 0.4;
    }

    update(dt, player, aspect = 1.6) {
        const cam = this.camera;
        if (this.phase === 'menu') {
            this.menuT += dt;
            const t = this.menuT * 0.045;
            this.setFov(46);
            this.pos.set(-70 + Math.sin(t) * 150, 34 + Math.sin(t * 0.7) * 10, 150 + Math.cos(t * 0.8) * 26);
            this.look.set(this.pos.x * 0.55 + 30, 16, -10);
            cam.position.copy(this.pos);
            cam.lookAt(this.look);
            this.focus.set(this.pos.x * 0.7, 2, 40);
            this.focusDist = 150;
            return { introProgress: 0, landed: false };
        }

        if (this.phase === 'intro') {
            this.introT += dt;
            const u = clamp(this.introT / INTRO.duration, 0, 1);
            const e = u * u * (3 - 2 * u);
            this._walkTarget(player, this._a, this._b);
            // começa alto sobre a baía, de frente para a cidade
            const sx = player.x * 0.4;
            const k = Math.pow(e, 1.25);
            this.pos.set(lerp(sx, this._a.x, k), lerp(430, this._a.y, Math.pow(e, 0.82)), lerp(560, this._a.z, k));
            this.look.set(lerp(sx * 0.6, this._b.x, e), lerp(20, this._b.y, e), lerp(-20, this._b.z, e));
            cam.position.copy(this.pos);
            cam.lookAt(this.look);
            this.setFov(lerp(46, 58, e));
            this.focus.set(lerp(sx, player.x, e), 2, lerp(40, player.z, e));
            this.focusDist = this.pos.distanceTo(this.look);
            if (u >= 1) this.phase = this.mode === 'map' ? 'map' : this.mode === 'cinematic' ? 'cinematic' : 'walk';
            return { introProgress: u, landed: u >= 1 };
        }

        if (this.phase === 'map') {
            this.setFov(40);
            const narrow = aspect < 1.2;
            const tx = narrow ? player.x * 0.92 : clamp(player.x * 0.35, -120, 120);
            const h = narrow ? 330 : 610;
            this.pos.set(damp(cam.position.x, tx, 4, dt), damp(cam.position.y, h, 4, dt), damp(cam.position.z, h * 0.42 + 20, 4, dt));
            cam.position.copy(this.pos);
            this.look.set(damp(this.look.x, tx, 4, dt), 0, damp(this.look.z, 28, 4, dt));
            cam.lookAt(this.look);
            this.focus.set(tx, 2, 30);
            this.focusDist = h;
            return { introProgress: 1, landed: true };
        }

        if (this.phase === 'cinematic') {
            this.setFov(48);
            this.droneT = (this.droneT + (dt * 13) / this.curveLen) % 1;
            this.curve.getPointAt(this.droneT, this._a);
            this.curve.getPointAt((this.droneT + 0.035) % 1, this._b);
            this._b.y = 6 + smoothstep(60, 320, this._a.z) * 16;
            this._b.z = lerp(this._b.z, 14, 0.62);
            const k = 1 - Math.exp(-2.2 * dt);
            this.pos.lerp(this._a, k);
            this.look.lerp(this._b, k);
            cam.position.copy(this.pos);
            cam.lookAt(this.look);
            this.focus.copy(this.look).setY(2);
            this.focusDist = this.pos.distanceTo(this.look);
            return { introProgress: 1, landed: true };
        }

        // walk
        this.setFov(this.mode === 'resident' ? 62 : 58);
        this._walkTarget(player, this._a, this._b);
        const k = 1 - Math.exp(-10 * dt);
        this.pos.lerp(this._a, k);
        this.look.lerp(this._b, 1 - Math.exp(-14 * dt));
        cam.position.copy(this.pos);
        cam.lookAt(this.look);
        // ao andar, o desvio de órbita relaxa para trás do visitante
        if (player.speed > 0.4) this.orbit = damp(this.orbit, 0, 1.6, dt);
        this.focus.set(player.x, player.y, player.z);
        this.focusDist = this.pos.distanceTo(this.focus);
        void ORLA_HALF;
        return { introProgress: 1, landed: true };
    }
}
