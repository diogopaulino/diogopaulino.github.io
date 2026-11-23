/**
 * Tempestade: chuva, vento e relâmpagos.
 *
 * Chuva "sem estado" na GPU — cada gota é um segmento de reta cuja posição é função do tempo:
 *   p = câmera + mod(semente·caixa + v·t − câmera, caixa) − caixa/2      (caixa de 36×22×36 m que
 *   cauda = p − v̂·comprimento                                             acompanha a câmera sem "nadar")
 *   v = (−2 − 9·vento, −30, −1,5 − 3·vento) m/s
 * Custo de CPU ≈ zero, 1 draw call. A opacidade segue a intensidade (0…1).
 *
 * Relâmpago: com intensidade > 0,45, um clarão a cada ~4 s em média (processo de Poisson,
 * P = 0,25·dt). O clarão dura 0,12–0,2 s (luz direcional fria sem sombra + exposição ×1,6);
 * o trovão chega 0,3–1,5 s depois e sacode a câmera.
 */

import * as THREE from 'three';
import { clamp, damp } from '../utils/math.js?v=50';

export class StormController {
    constructor(game, quality) {
        this.game = game;
        this.rainIntensity = 0;
        this.windIntensity = 0;
        this.waveIntensity = 0;
        this.lightning = 0;
        this.flash = 0;
        this.thunderDelay = -1;
        this.target = 0;
        this.time = 0;

        const count = quality?.rain || 1500;
        const pos = new Float32Array(count * 2 * 3);
        const seed = new Float32Array(count * 2 * 4);
        for (let i = 0; i < count; i++) {
            const a = Math.random();
            const b = Math.random();
            const c = Math.random();
            const d = Math.random();
            for (let k = 0; k < 2; k++) {
                const o = (i * 2 + k) * 4;
                seed[o] = a;
                seed[o + 1] = b;
                seed[o + 2] = c;
                seed[o + 3] = k + d * 0.5; // parte inteira: 0 = cabeça, 1 = cauda; fração = variação
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        this.uniforms = {
            uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: 0 }, uAlpha: { value: 0 },
            uColor: { value: new THREE.Color(0.75, 0.82, 0.92) }
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            transparent: true,
            depthWrite: false,
            vertexShader: /* glsl */ `
                attribute vec4 aSeed;
                uniform float uTime, uWind;
                uniform vec3 uCam;
                varying float vA;
                void main() {
                    vec3 box = vec3(36.0, 22.0, 36.0);
                    vec3 vel = vec3(-2.0 - 9.0 * uWind, -30.0, -1.5 - 3.0 * uWind) * (0.85 + 0.3 * fract(aSeed.w));
                    vec3 p = aSeed.xyz * box + vel * uTime;
                    p = uCam + mod(p - uCam, box) - box * 0.5;
                    float tail = floor(aSeed.w);
                    p -= normalize(vel) * tail * (0.5 + 0.5 * fract(aSeed.w));
                    vA = 1.0 - tail * 0.85;
                    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
                }`,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                uniform float uAlpha;
                varying float vA;
                void main() { gl_FragColor = vec4(uColor, uAlpha * vA); }`
        });
        this.rain = new THREE.LineSegments(geo, mat);
        this.rain.frustumCulled = false;
        this.rain.renderOrder = 30;
        this.rain.visible = false;
        this.rain.userData.keep = true;
        game.scene.add(this.rain);

        // luz do relâmpago
        this.flashLight = new THREE.DirectionalLight(0xcfe0ff, 0);
        this.flashLight.position.set(-30, 60, 20);
        this.flashLight.userData.keep = true;
        game.scene.add(this.flashLight);
    }

    setIntensity(v) {
        this.target = clamp(v, 0, 1);
    }

    /** Mantido por compatibilidade: a chuva já acompanha a câmera. */
    follow() {}

    update(dt, game) {
        this.time += dt;
        this.rainIntensity = damp(this.rainIntensity, this.target, 1.2, dt);
        this.windIntensity = this.rainIntensity;
        this.waveIntensity = this.rainIntensity;

        const on = this.rainIntensity > 0.02;
        this.rain.visible = on;
        if (on) {
            const u = this.uniforms;
            u.uTime.value = this.time;
            u.uWind.value = this.windIntensity;
            u.uAlpha.value = 0.34 * this.rainIntensity;
            u.uCam.value.copy(game.camera.position);
        }

        // Relâmpagos aleatórios durante tempestade intensa
        if (this.rainIntensity > 0.45 && this.lightning <= 0 && Math.random() < dt * 0.25) {
            this.lightning = 0.12 + Math.random() * 0.08;
            this.thunderDelay = 0.3 + Math.random() * 1.2;
            const a = Math.random() * 6.28;
            this.flashLight.position.set(Math.cos(a) * 40, 60, Math.sin(a) * 40).add(game.camera.position);
            this.flashLight.target.position.copy(game.camera.position);
            this.flashLight.target.updateMatrixWorld();
        }

        if (this.lightning > 0) {
            this.lightning -= dt;
            // clarão duplo: forte, um respiro, mais fraco
            this.flash = this.lightning > 0.07 ? 1 : this.lightning > 0.04 ? 0.15 : 0.6;
        } else {
            this.flash = 0;
        }
        this.flashLight.intensity = this.flash * 5;
        game.weather.flash = this.flash;

        if (this.thunderDelay >= 0) {
            this.thunderDelay -= dt;
            if (this.thunderDelay < 0) {
                game.audio.play('thunder');
                game.cameraRig?.addShake(0.12, 0.4);
            }
        }
    }
}
