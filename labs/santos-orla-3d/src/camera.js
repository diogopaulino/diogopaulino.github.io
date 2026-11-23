/**
 * Câmera: descida aérea → terceira pessoa, mapa e drone.
 *
 * Terceira pessoa ("braço de mola", como nos jogos de mundo aberto):
 *   pivô = cabeça do visitante, suavizado (λ = 14) para absorver o balanço do passo;
 *   yaw da câmera segue yaw do visitante + órbita, pelo menor ângulo (λ = 7, bike λ = 5);
 *   dir = (−sin ψ·cos p, sin p, −cos ψ·cos p);  pos = pivô + dir · braço
 *   braço = min(distância desejada, primeira colisão − 0,35 m):
 *     colisões em 2D (plano XZ) contra a fachada dos prédios (z = −29,6), e os
 *     obstáculos sólidos (círculos/retângulos, com altura opcional `h`);
 *   o braço encurta na hora (nunca atravessa parede) e volta a abrir devagar (λ = 3).
 *   A câmera nunca desce abaixo do chão (+0,35 m).
 * Troca de modo (mapa/drone → caminhada): mistura de 0,9 s entre a pose antiga e a nova.
 * Drone: spline Catmull-Rom fechada ao longo da orla, percorrida a ~13 m/s, olhando
 *   um ponto mais à frente na própria curva projetado no calçadão.
 * Mapa: vista alta inclinada; em telas estreitas acompanha o X do visitante.
 */
import * as THREE from 'three';
import { INTRO, ZONES, groundY } from './config.js';
import { clamp, damp, lerp, smoothstep } from '../../shared/gfx/core.js';

const DRONE_POINTS = [
    [-345, 34, 150], [-300, 16, 84], [-230, 11, 58], [-150, 20, 96], [-100, 9, 50], [-40, 26, 20],
    [10, 46, 112], [86, 15, 44], [150, 9, 60], [178, 7, 40], [240, 22, 96], [305, 14, 62],
    [344, 26, 110], [300, 70, 240], [120, 110, 330], [-120, 90, 300], [-320, 60, 230]
];
const FACADE_Z = ZONES.buildFront + 0.4;
const ARM_MARGIN = 0.35;
const ARM_MIN = 0.6;

/** Diferença angular no intervalo (−π, π]. */
function angleDelta(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

export class OrlaCamera {
    constructor(camera) {
        this.camera = camera;
        this.mode = 'tourist';
        this.phase = 'menu'; // menu | intro | walk | map | cinematic
        this.introT = 0;
        this.pitch = 0.2;
        this.orbit = 0;      // desvio de yaw em relação ao visitante (arrasto)
        this.dist = 4.6;
        this.zoom = 1;       // roda do mouse / pinça: 0,6–1,8 × distância
        this.camYaw = 0;
        this.arm = 4.6;
        this.pivot = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.pos = new THREE.Vector3();
        this.focus = new THREE.Vector3(); // centro da sombra / foco de DoF
        this.focusDist = 8;
        this.droneT = 0;
        this.curve = new THREE.CatmullRomCurve3(DRONE_POINTS.map((p) => new THREE.Vector3(...p)), true, 'catmullrom', 0.5);
        this.curveLen = this.curve.getLength();
        this._a = new THREE.Vector3();
        this._b = new THREE.Vector3();
        this._dir = new THREE.Vector3();
        this.fromPos = new THREE.Vector3();
        this.fromLook = new THREE.Vector3();
        this.blendT = 1;
        this.menuT = 0;
        this.blockers = [];
        this.walkReady = false;
    }

    startIntro() {
        this._skip = false;
        this.phase = 'intro';
        this.introT = 0;
        this.setFov(50);
    }

    /** Pula a descida aérea (toque/tecla): termina com uma mistura curta. */
    skipIntro() {
        if (this.phase === 'intro') this._skip = true;
    }

    setFov(fov) {
        if (Math.abs(this.camera.fov - fov) > 0.01) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    setMode(mode) {
        const wasWalk = this.phase === 'walk';
        this.mode = mode;
        if (mode === 'map') this.phase = 'map';
        else if (mode === 'cinematic') this.phase = 'cinematic';
        else {
            this.phase = 'walk';
            if (!wasWalk) this._beginBlend();
        }
    }

    _beginBlend() {
        this.fromPos.copy(this.camera.position);
        this.fromLook.copy(this.look);
        this.blendT = 0;
        this.walkReady = false;
    }

    drag(dx, dy) {
        if (this.phase !== 'walk') return;
        this.orbit -= dx * 0.005;
        this.pitch = clamp(this.pitch + dy * 0.004, -0.12, 1.1);
    }

    zoomBy(f) {
        this.zoom = clamp(this.zoom * f, 0.6, 1.8);
    }

    /** Distância livre (m, ao longo de dir) do pivô até a 1ª colisão, até `max`. */
    _clearance(px, py, pz, dir, max) {
        const ch = Math.hypot(dir.x, dir.z);
        if (ch < 1e-4) return max;
        const hx = dir.x / ch;
        const hz = dir.z / ch;
        let tH = max * ch; // distância horizontal
        // fachada contínua dos prédios
        if (hz < -1e-4 && pz + hz * tH < FACADE_Z) tH = Math.max(0, (pz - FACADE_Z) / -hz);
        for (let i = 0; i < this.blockers.length; i++) {
            const b = this.blockers[i];
            let t = Infinity;
            if (b.r) {
                const r = b.r + 0.2;
                const ox = px - b.x;
                const oz = pz - b.z;
                const bq = ox * hx + oz * hz;
                const c = ox * ox + oz * oz - r * r;
                if (c < 0) continue; // pivô dentro (visitante encostado): ignora
                const disc = bq * bq - c;
                if (disc < 0) continue;
                t = -bq - Math.sqrt(disc);
            } else {
                const x0 = b.x0 - 0.2;
                const x1 = b.x1 + 0.2;
                const z0 = b.z0 - 0.2;
                const z1 = b.z1 + 0.2;
                if (px > x0 && px < x1 && pz > z0 && pz < z1) continue;
                const ix = Math.abs(hx) > 1e-6 ? 1 / hx : 1e6;
                const iz = Math.abs(hz) > 1e-6 ? 1 / hz : 1e6;
                const tx0 = (x0 - px) * ix;
                const tx1 = (x1 - px) * ix;
                const tz0 = (z0 - pz) * iz;
                const tz1 = (z1 - pz) * iz;
                const tmin = Math.max(Math.min(tx0, tx1), Math.min(tz0, tz1));
                const tmax = Math.min(Math.max(tx0, tx1), Math.max(tz0, tz1));
                if (tmax < 0 || tmin > tmax) continue;
                t = tmin;
            }
            if (t < 0 || t >= tH) continue;
            // passa por cima de obstáculos baixos (fontes, bancos)
            if (b.h !== undefined && py + (dir.y / ch) * t > groundY(b.x ?? b.x0, b.z ?? b.z0) + b.h) continue;
            tH = t;
        }
        return tH / ch;
    }

    /**
     * Pose ideal de terceira pessoa (sem suavização). Escreve em out/lookOut e devolve o braço.
     * @param {boolean} smooth usa pivô/yaw suavizados (estado) em vez dos alvos
     */
    _walkPose(player, out, lookOut, smooth = false) {
        const tourist = this.mode !== 'resident';
        const riding = !!player.riding;
        const d = (tourist ? this.dist * (riding ? 1.2 : 1) : (riding ? 3.3 : 2.7)) * this.zoom;
        const yaw = smooth ? this.camYaw : player.yaw + this.orbit;
        const px = smooth ? this.pivot.x : player.x;
        const py = smooth ? this.pivot.y : player.y + (riding ? 1.78 : tourist ? 1.62 : 1.58);
        const pz = smooth ? this.pivot.z : player.z;
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const side = tourist ? 0 : 0.45;
        const ox = px + Math.cos(yaw) * side;
        const oz = pz - Math.sin(yaw) * side;
        this._dir.set(-Math.sin(yaw) * cp, sp + 0.25 / Math.max(d, 1), -Math.cos(yaw) * cp).normalize();
        const free = Math.max(ARM_MIN, this._clearance(ox, py, oz, this._dir, d + ARM_MARGIN) - ARM_MARGIN);
        const want = Math.min(d, free);
        let arm = want;
        if (smooth) {
            // encurta na hora; abre devagar
            this.arm = want < this.arm ? want : damp(this.arm, want, 3, this._dt || 0.016);
            arm = this.arm;
        }
        out.set(ox + this._dir.x * arm, py + this._dir.y * arm, oz + this._dir.z * arm);
        const floor = groundY(out.x, out.z) + 0.35;
        if (out.y < floor) out.y = floor;
        // olha um pouco à frente do visitante
        lookOut.set(ox + Math.sin(yaw) * 2.2, py + 0.1 - sp * 0.4, oz + Math.cos(yaw) * 2.2);
        return arm;
    }

    /** Compatível com a API antiga (intro e teleporte de depuração). */
    _walkTarget(player, out, lookOut) {
        return this._walkPose(player, out, lookOut, false);
    }

    /** Coloca a câmera de caminhada exatamente atrás do visitante (teleporte, fim da intro). */
    snap(player) {
        this.camYaw = player.yaw + this.orbit;
        this.pivot.set(player.x, player.y + (player.riding ? 1.78 : this.mode === 'resident' ? 1.58 : 1.62), player.z);
        this.arm = this._walkPose(player, this.pos, this.look, false);
        this.camera.position.copy(this.pos);
        this.camera.lookAt(this.look);
        this.walkReady = true;
        this.blendT = 1;
    }

    update(dt, player, aspect = 1.6) {
        const cam = this.camera;
        this._dt = dt;
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
            this.walkReady = false;
            return { introProgress: 0, landed: false };
        }

        if (this.phase === 'intro' && this._skip) {
            this._skip = false;
            this.phase = this.mode === 'map' ? 'map' : this.mode === 'cinematic' ? 'cinematic' : 'walk';
            if (this.phase === 'walk') this._beginBlend();
            return { introProgress: 1, landed: true };
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
            if (u >= 1) {
                this.phase = this.mode === 'map' ? 'map' : this.mode === 'cinematic' ? 'cinematic' : 'walk';
                if (this.phase === 'walk') this.snap(player);
            }
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
            this.walkReady = false;
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
            this.walkReady = false;
            return { introProgress: 1, landed: true };
        }

        // walk — braço de mola com colisão
        this.setFov(this.mode === 'resident' ? 62 : player.riding ? 60 : 58);
        if (!this.walkReady) {
            const keepFrom = this.blendT < 1;
            const fp = this._a.copy(this.fromPos);
            const fl = this._b.copy(this.fromLook);
            this.snap(player);
            if (keepFrom) {
                this.fromPos.copy(fp);
                this.fromLook.copy(fl);
                this.blendT = 0;
            }
        }
        const tYaw = player.yaw + this.orbit;
        this.camYaw += angleDelta(this.camYaw, tYaw) * (1 - Math.exp(-(player.riding ? 5 : 7) * dt));
        const head = player.y + (player.riding ? 1.78 : this.mode === 'resident' ? 1.58 : 1.62);
        const kp = 1 - Math.exp(-14 * dt);
        this.pivot.x += (player.x - this.pivot.x) * kp;
        this.pivot.y += (head - this.pivot.y) * (1 - Math.exp(-8 * dt));
        this.pivot.z += (player.z - this.pivot.z) * kp;
        this._walkPose(player, this.pos, this.look, true);

        if (this.blendT < 1) {
            this.blendT = Math.min(1, this.blendT + dt / 0.9);
            const e = this.blendT * this.blendT * (3 - 2 * this.blendT);
            cam.position.lerpVectors(this.fromPos, this.pos, e);
            this._b.lerpVectors(this.fromLook, this.look, e);
            cam.lookAt(this._b);
        } else {
            cam.position.copy(this.pos);
            cam.lookAt(this.look);
        }
        // ao andar, o desvio de órbita relaxa para trás do visitante
        if (player.speed > 0.4) this.orbit = damp(angleDelta(0, this.orbit), 0, player.riding ? 2.2 : 1.6, dt);
        this.focus.set(player.x, player.y, player.z);
        this.focusDist = cam.position.distanceTo(this.focus);
        return { introProgress: 1, landed: true };
    }
}
