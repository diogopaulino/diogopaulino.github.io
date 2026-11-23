/**
 * Montagem do digital twin: céu físico, sol/sombra, mar, terreno, cidade, cenário,
 * jardins, mobiliário, marcos, trânsito e vida — e a passagem das horas.
 *
 * Hora do dia: cada parada de DAY_STOPS tem uma hora solar; a troca anima a hora
 * (sempre para frente, ~3 s com easing), então o sol percorre o céu de verdade e
 * cor, neblina, exposição e luzes acompanham sem "cortes".
 */
import * as THREE from 'three';
import { createSky } from '../../shared/gfx/sky.js';
import { createOcean } from '../../shared/gfx/ocean.js';
import { createSunRig } from '../../shared/gfx/rig.js';
import { updateWind } from '../../shared/gfx/flora.js';
import { lerp } from '../../shared/gfx/core.js';
import { DAY_STOPS, SEA_DEPTH_GLSL, SUN_DECLINATION } from './config.js';
import { createTerrain } from './terrain.js';
import { createCity } from './city.js';
import { createScenery } from './scenery.js';
import { createGarden } from './garden.js';
import { createProps } from './props.js';
import { createLandmarks } from './landmarks.js';
import { createTraffic } from './traffic.js';
import { createLife } from './life.js';

// cede a vez ao navegador entre etapas (setTimeout: funciona mesmo com a aba em segundo plano)
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export class World {
    constructor(scene, renderer, quality) {
        this.scene = scene;
        this.renderer = renderer;
        this.quality = quality;
        this.parts = {};
        this.dayIndex = 1;
        this.hour = DAY_STOPS[1].hour;
        this.fromHour = this.hour;
        this.toHour = this.hour;
        this.fromStop = DAY_STOPS[1];
        this.toStop = DAY_STOPS[1];
        this.blend = 1;
        this.env = { exposure: 1, fog: 0.004, haze: 0.00016 };
        this.focus = new THREE.Vector3();
    }

    async build(onProgress) {
        const q = this.quality;
        this.timing = {};
        const step = async (p, text, fn) => {
            onProgress?.(p, text);
            await nextFrame();
            const t0 = performance.now();
            fn();
            this.timing[text] = Math.round(performance.now() - t0);
        };

        await step(0.06, 'Abrindo o céu de Santos…', () => {
            this.sky = createSky({
                renderer: this.renderer,
                scene: this.scene,
                declination: SUN_DECLINATION,
                cloudCover: 0.4,
                ground: 0x5a5a4e,
                glow: 0x2a1c10,
                envIntensity: 1.0
            });
            this.sky.setHour(this.hour);
            this.rig = createSunRig(this.scene, this.sky, {
                shadows: q.shadows, mapSize: q.shadowMap, radius: q.shadowRadius, depth: 420
            });
            // preenchimento mínimo: evita sombras 100 % pretas quando o IBL é fraco (noite)
            this.fill = new THREE.HemisphereLight(0xbfd4ff, 0x54483a, 0.18);
            this.scene.add(this.fill);
        });

        await step(0.16, 'Ondas na baía…', () => {
            this.ocean = createOcean({
                tier: q.id,
                depthGLSL: SEA_DEPTH_GLSL,
                surf: true,
                surfAmp: 0.34,
                // cristas a cada ~18 m: k = 2π / (18 m · declive 0,029); ω ≈ 0,8 → ~2,3 m/s rumo à areia
                surfK: 12,
                surfSpeed: 0.8,
                surfDepth: 1.25,
                swash: 0.1,
                waveScale: 0.62,
                deep: 0x0c3b42,
                shallow: 0x3f7a66,
                scatter: 0x3a9a84,
                deepDepth: 7,
                wakes: 1
            });
            this.scene.add(this.ocean.mesh);
        });

        await step(0.26, 'Calçadão, ciclovia e areia…', () => {
            this.parts.terrain = createTerrain(q);
            this.scene.add(this.parts.terrain.root);
        });

        await step(0.38, 'Erguendo a muralha de prédios…', () => {
            this.parts.city = createCity(q);
            this.scene.add(this.parts.city.root);
        });

        await step(0.5, 'Morros, Serra do Mar e navios na barra…', () => {
            this.parts.scenery = createScenery(q);
            this.scene.add(this.parts.scenery.root);
        });

        await step(0.6, 'Plantando os jardins…', () => {
            this.parts.garden = createGarden(q, this.parts.terrain);
            this.scene.add(this.parts.garden.root);
        });

        await step(0.7, 'Quiosques, postos e mobiliário…', () => {
            this.parts.props = createProps(q, this.parts.terrain);
            this.scene.add(this.parts.props.root);
        });

        await step(0.78, 'Marcos da cidade…', () => {
            this.parts.landmarks = createLandmarks(q);
            this.scene.add(this.parts.landmarks.root);
        });

        await step(0.86, 'Trânsito na avenida…', () => {
            this.parts.traffic = createTraffic(q, this.parts.terrain);
            this.scene.add(this.parts.traffic.root);
        });

        await step(0.92, 'Gente na orla…', () => {
            this.parts.life = createLife(q, this.parts.terrain, this.parts.props);
            this.scene.add(this.parts.life.root);
        });

        this.setDay(this.dayIndex, true);
        this.sky.flush();
        onProgress?.(0.96, 'Pronto.');
    }

    setDay(index, instant = false) {
        const stop = DAY_STOPS[index];
        this.dayIndex = index;
        this.fromStop = this.blend >= 1 ? this.toStop : { ...this.env, clouds: this.sky.uniforms.uCloudCover.value };
        this.toStop = stop;
        this.fromHour = this.hour;
        // sempre para frente no relógio
        let to = stop.hour;
        while (to < this.fromHour - 0.01) to += 24;
        this.toHour = to;
        this.blend = instant ? 1 : 0;
        if (instant) this.applyTime(1);
        return stop;
    }

    /** Obstáculos sólidos para o visitante (círculos {x,z,r} e retângulos {x0,x1,z0,z1}). */
    blockers() {
        const out = [...(this.parts.landmarks?.blockers || [])];
        for (const k of this.parts.props?.kiosks || []) out.push({ x: k.x, z: k.z, r: 2.75 });
        for (const p of this.parts.props?.postos || []) out.push({ x0: p.x - 3.9, x1: p.x + 3.9, z0: p.z - 2.4, z1: p.z + 2.4 });
        return out;
    }

    /**
     * Tudo que o visitante não atravessa: marcos/quiosques/postos + troncos de árvores
     * (r = 0,3 m) + carros estacionados e andando (retângulos atualizados pelo trânsito).
     * A câmera usa só blockers() — troncos e carros fariam o braço "piscar".
     */
    playerSolids() {
        const out = this.blockers();
        for (const t of this.parts.garden?.trees || []) out.push({ x: t.x, z: t.z, r: 0.3 });
        for (const f of this.parts.traffic?.footprints || []) out.push(f);
        return out;
    }

    cycleDay() {
        return this.setDay((this.dayIndex + 1) % DAY_STOPS.length);
    }

    applyTime(k) {
        const e = k * k * (3 - 2 * k);
        this.hour = lerp(this.fromHour, this.toHour, e);
        this.sky.setHour(this.hour);
        this.sky.setClouds(lerp(this.fromStop.clouds ?? 0.4, this.toStop.clouds, e));
        this.env.exposure = lerp(this.fromStop.exposure, this.toStop.exposure, e);
        this.env.fog = lerp(this.fromStop.fog, this.toStop.fog, e);
        this.env.haze = lerp(this.fromStop.haze, this.toStop.haze, e);
        const night = this.sky.night;
        for (const part of Object.values(this.parts)) part.setNight?.(night);
        this.fill.intensity = 0.1 + night * 0.6;
    }

    /**
     * @param {number} t tempo do mundo (s)
     * @param {THREE.Camera} camera
     * @param {THREE.Vector3} focus centro da sombra
     * @param {number} shadowRadius meio-lado da sombra (m)
     */
    update(t, dt, camera, focus, shadowRadius, player) {
        if (this.blend < 1) {
            this.blend = Math.min(1, this.blend + dt / 3.2);
            this.applyTime(this.blend);
            if (this.blend >= 1) this.hour %= 24;
        }
        this.sky.update(t, dt);
        this.rig.update(focus, shadowRadius);
        updateWind(t, 0.8 + Math.sin(t * 0.13) * 0.35);
        this.ocean.update(t, camera, this.sky.daylight);
        const ctx = { t, dt, camera, player, ocean: this.ocean, sky: this.sky, night: this.sky.night };
        const transit = this.parts.scenery?.update(t, dt, this.ocean, this.sky.night);
        if (transit) this.ocean.setWake(0, transit.x, transit.z - 115, Math.PI, 0.4, 17, 230);
        this.parts.terrain?.update(t);
        this.parts.garden?.update?.(t, dt, ctx);
        this.parts.props?.update?.(t, dt, ctx);
        this.parts.landmarks?.update?.(t, dt, ctx);
        this.parts.traffic?.update?.(t, dt, ctx);
        this.parts.life?.update?.(t, dt, ctx);
    }
}
