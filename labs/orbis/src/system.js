/**
 * Monta e anima o sistema estelar: estrela, planetas, anéis, luas,
 * cinturão de asteroides, nébula e campo de estrelas.
 *
 * Movimento 100% kepleriano (ver kepler.js): cada planeta é posicionado pela
 * equação de Kepler a partir dos elementos reais J2000, no instante simulado
 * (dias desde J2000). Nada de `angle += speed·dt`: a posição é função da data,
 * então pausar, inverter ou saltar para outra data é exato e estável.
 *
 * ESCALA VISUAL (documentada também na interface):
 * - Tempos, períodos e FORMAS das órbitas são reais (e, i, Ω, ω exatos).
 * - Distâncias "Comprimida": cada órbita é a elipse real multiplicada por um
 *   fator uniforme s = a_vis / a, com semi-eixo visual a_vis = C₀ + C₁·√a
 *   (C₀ = 1,2 u, C₁ = 4,55 u/√UA → Mercúrio a 4,0 u, Terra 5,75 u, Netuno 26 u).
 *   Escala uniforme por órbita preserva a excentricidade e o Sol no foco; só
 *   "encolhe" o sistema externo. As órbitas não se cruzam (afélio de Mercúrio
 *   4,86 u < periélio de Vênus 5,04 u; idem para os demais pares).
 * - Distâncias "Real": linear, K_r = 2,6 u por UA para todos (Netuno a 78 u).
 * - Raios de planetas, do Sol e das luas, e as distâncias das luas, são
 *   ampliados (na escala real o Sol teria 0,012 u e a Terra 0,0001 u).
 */
import * as THREE from 'three';
import { createPlanetTexture } from './textures.js?v=5';
import {
    PLANET_VERT, PLANET_FRAG,
    CLOUD_VERT, CLOUD_FRAG,
    ATMOS_VERT, ATMOS_FRAG,
    RING_VERT, RING_FRAG,
    STAR_VERT, STAR_FRAG, CORONA_FRAG,
    NEBULA_VERT, NEBULA_FRAG,
    STARFIELD_VERT, STARFIELD_FRAG,
    MOON_FRAG
} from './shaders.js?v=5';
import {
    GM_SUN, G, makeOrbit, orbitPosition, orbitPointAtE, orbitSpeed,
    poleToEcliptic, primeNodeToEcliptic, axialTilt, wrapPi
} from './kepler.js?v=1';

const DEG = Math.PI / 180;

export const SCALE = {
    compA: 1.2,    // u — termo fixo do semi-eixo visual comprimido
    compK: 4.55,   // u·UA^-½ — semi-eixo visual comprimido = 1,2 + 4,55·√a
    realK: 2.6,    // u/UA — escala linear real
    realBody: 0.4, // corpos (planetas + luas) na escala real
    realSun: 0.3   // Sol na escala real
};

/* Limite de amostragem: a 60 quadros/s, girar mais que ~1,5 volta/s vira
   estroboscópio (efeito roda-de-carroça). Acima disso o ângulo EXIBIDO avança
   no limite e, quando o tempo desacelera, reencontra o ângulo real (decai em
   ~0,5 s). Posições heliocêntricas dos planetas nunca são limitadas. */
const MAX_SPIN = Math.PI * 2 * 1.5;   // rad/s reais (rotação própria)
const MAX_MOON = Math.PI * 2 * 0.75;  // rad/s reais (órbita das luas)

function color(rgb) {
    return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

function planetUniforms(p) {
    return {
        uTime: { value: 0 },
        uSeed: { value: p.seed },
        uKind: { value: p.kind },
        uWater: { value: p.water },
        uIce: { value: p.ice },
        uTemp: { value: p.temp },
        uMountain: { value: p.mountain },
        uWarp: { value: p.warp },
        uCities: { value: p.cities },
        uEmissive: { value: p.emissive },
        uBump: { value: 1 },
        uOceanDeep: { value: color(p.oceanDeep) },
        uOceanShallow: { value: color(p.oceanShallow) },
        uLandA: { value: color(p.landA) },
        uLandB: { value: color(p.landB) },
        uDesert: { value: color(p.desert) },
        uSnow: { value: color(p.snow) },
        uLava: { value: color(p.lava) },
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uMap: { value: null },
        uUseMap: { value: 0 },
        uPaint: { value: p.paint ?? 1 },
        uSpecGain: { value: p.spec ?? 0.15 }
    };
}

/** Fator visual (cena/UA) de uma órbita de semi-eixo aAU, misturando as escalas. */
function orbitFactor(aAU, mix) {
    const comp = (SCALE.compA + SCALE.compK * Math.sqrt(aAU)) / aAU;
    return comp + (SCALE.realK - comp) * mix;
}

/** Distância visual de uma lua, em unidades locais do planeta (raio visual R). */
function moonVisualDistance(R, aKm, planetKm) {
    // Logarítmica: preserva a ordem real (Fobos < Deimos, Io < Europa…) sem
    // jogar a Lua a 60 raios terrestres, onde cruzaria a órbita de Vênus.
    return R * (2.2 + 0.9 * Math.log(aKm / planetKm));
}

/**
 * Atraso visual por limite de amostragem (ver MAX_SPIN). `n` em rad/dia,
 * `dd` dias simulados neste quadro, `dt` segundos reais. Devolve o novo
 * deslocamento (dias) entre o relógio exibido e o real.
 */
function lagOffset(offset, n, dd, dt, max) {
    const adv = n * dd;
    const lim = max * dt;
    if (adv > lim || adv < -lim) {
        return offset + (adv > 0 ? lim : -lim) / n - dd;
    }
    if (offset === 0) return 0;
    const phase = wrapPi(n * offset) * Math.exp(-6 * dt);
    return Math.abs(phase) < 1e-4 ? 0 : phase / n;
}

/** Quaternion do referencial equatorial: X = nodo (origem de W), Y = polo norte. */
function equatorQuaternion(rot, q) {
    const pole = poleToEcliptic(rot.ra, rot.dec, {});
    const node = primeNodeToEcliptic(rot.ra, {});
    // eclíptica (x, y, z) → cena (x, z, −y)
    const Y = new THREE.Vector3(pole.x, pole.z, -pole.y).normalize();
    const X = new THREE.Vector3(node.x, node.z, -node.y).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
    const m = new THREE.Matrix4().makeBasis(X, Y, Z);
    return { q: q.setFromRotationMatrix(m), pole };
}

export class StarSystem {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.bodies = [];
        this.time = 0;
        this.days = 0;
        this.data = null;
        this.focusIndex = -2;

        this.scaleMix = 0;
        this.scaleTarget = 0;
        this._lastMix = -1;
        this._lastBeltDays = NaN;

        this.sunPos = new THREE.Vector3(0, 0, 0);
        this._planetWorld = new THREE.Vector3();
        this._k = { x: 0, y: 0, z: 0, r: 0, E: 0, M: 0, nu: 0 };
        this._p = { x: 0, y: 0, z: 0 };

        this._buildBackground();
        this.starGroup = new THREE.Group();
        this.group.add(this.starGroup);
        this.planetsGroup = new THREE.Group();
        this.group.add(this.planetsGroup);
        this.orbitLines = new THREE.Group();
        this.group.add(this.orbitLines);
        this._tex = new Map();
    }

    _map(id) {
        if (!this._tex.has(id)) {
            const map = new THREE.CanvasTexture(createPlanetTexture(id));
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = 8;
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.ClampToEdgeWrapping;
            this._tex.set(id, map);
        }
        return this._tex.get(id);
    }

    _buildBackground() {
        // Fundo "no infinito": acompanha a câmera (sem paralaxe) e é desenhado
        // antes de tudo, sem depth — nenhum planeta distante some atrás dele.
        this.background = new THREE.Group();
        this.background.scale.setScalar(1.6); // estrelas a 61–138 u: pontos finos, como no céu real
        this.scene.add(this.background);

        const nebGeo = new THREE.SphereGeometry(90, 32, 20);
        this.nebulaUniforms = {
            uA: { value: new THREE.Color(0.03, 0.05, 0.14) },
            uB: { value: new THREE.Color(0.1, 0.03, 0.07) },
            uSeed: { value: 1 },
            uTime: { value: 0 }
        };
        const nebMat = new THREE.ShaderMaterial({
            uniforms: this.nebulaUniforms,
            vertexShader: NEBULA_VERT,
            fragmentShader: NEBULA_FRAG,
            side: THREE.BackSide,
            transparent: false,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        this.nebula = new THREE.Mesh(nebGeo, nebMat);
        this.nebula.renderOrder = -20;
        this.nebula.frustumCulled = false;
        this.background.add(this.nebula);

        const count = this.quality.stars;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const twinkle = new Float32Array(count);
        const palettes = [
            [1, 0.95, 0.9],
            [0.75, 0.85, 1],
            [1, 0.8, 0.55],
            [0.85, 0.9, 1],
            [1, 0.6, 0.45]
        ];
        for (let i = 0; i < count; i++) {
            const r = 38 + Math.random() * 48;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi);
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            const c = palettes[i % palettes.length];
            const b = 0.45 + Math.random() * 0.55;
            colors[i * 3] = c[0] * b;
            colors[i * 3 + 1] = c[1] * b;
            colors[i * 3 + 2] = c[2] * b;
            sizes[i] = Math.random() < 0.08 ? 2.4 + Math.random() * 2.2 : 0.7 + Math.random() * 1.3;
            twinkle[i] = 0.4 + Math.random() * 3.5;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 1));
        this.starfieldUniforms = {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
        };
        const starMat = new THREE.ShaderMaterial({
            uniforms: this.starfieldUniforms,
            vertexShader: STARFIELD_VERT,
            fragmentShader: STARFIELD_FRAG,
            transparent: false,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        this.starfield = new THREE.Points(starGeo, starMat);
        this.starfield.renderOrder = -10;
        this.starfield.frustumCulled = false;
        this.background.add(this.starfield);
    }

    _clearGroup(group) {
        const disposeMat = (mat) => {
            if (!mat) return;
            if (Array.isArray(mat)) mat.forEach(disposeMat);
            else mat.dispose();
        };
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            child.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                disposeMat(obj.material);
            });
        }
    }

    rebuild(data) {
        this.data = data;
        this._clearGroup(this.starGroup);
        this._clearGroup(this.planetsGroup);
        this._clearGroup(this.orbitLines);
        this.bodies = [];
        this.belt = null;

        this.nebulaUniforms.uA.value.set(data.star.nebulaA[0], data.star.nebulaA[1], data.star.nebulaA[2]);
        this.nebulaUniforms.uB.value.set(data.star.nebulaB[0], data.star.nebulaB[1], data.star.nebulaB[2]);
        this.nebulaUniforms.uSeed.value = data.seed * 0.001;

        this._buildStar(data.star);
        data.planets.forEach((p, i) => this._buildPlanet(p, i));
        this._buildBelt(data);
        this._lastMix = -1;
        this._lastBeltDays = NaN;
    }

    _buildStar(star) {
        const seg = this.quality.starSeg;
        const geo = new THREE.SphereGeometry(star.radius, seg, Math.floor(seg * 0.7));
        this.starUniforms = {
            uTime: { value: 0 },
            uSeed: { value: star.seed },
            uLimb: { value: star.limb },
            uSpot: { value: star.spot },
            uColor: { value: color(star.color) }
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.starUniforms,
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG
        });
        // Eixo do Sol inclinado 7,25° em relação à eclíptica (polo IAU).
        this.starAxis = new THREE.Group();
        equatorQuaternion(star.rot, this.starAxis.quaternion);
        this.starGroup.add(this.starAxis);
        this.starMesh = new THREE.Mesh(geo, mat);
        this.starAxis.add(this.starMesh);

        const coronaUniforms = {
            uColor: { value: color(star.corona) },
            uDensity: { value: 0.55 }
        };
        const corona = new THREE.Mesh(
            new THREE.SphereGeometry(star.radius * 1.28, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: coronaUniforms,
                vertexShader: PLANET_VERT,
                fragmentShader: CORONA_FRAG,
                side: THREE.BackSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.starGroup.add(corona);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(star.radius * 1.08, 24, 16),
            new THREE.ShaderMaterial({
                uniforms: { uColor: { value: color(star.color) }, uDensity: { value: 0.35 } },
                vertexShader: PLANET_VERT,
                fragmentShader: CORONA_FRAG,
                side: THREE.FrontSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.starGroup.add(glow);

        this.pointLight = new THREE.PointLight(color(star.color), star.intensity, 0, 1.15);
        this.starGroup.add(this.pointLight);

        this.star = star;
        this.starSpinOffset = 0;
    }

    _buildBelt(data) {
        const belt = data.belt;
        if (!belt || !(belt.outer > belt.inner)) return;
        const jup = this.bodies.find((b) => b.params.name === 'Júpiter');

        const count = this.quality.asteroids;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const tw = new Float32Array(count);
        const orbits = new Array(count);
        const gaps = belt.gaps || [];
        const trojanCount = jup ? Math.round(count * (belt.trojans || 0)) : 0;
        const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
        for (let i = 0; i < count; i++) {
            let el;
            if (i < trojanCount) {
                // Troianos: mesmo semi-eixo de Júpiter, 60° à frente (L4) ou atrás (L5).
                const je = jup.params.elements;
                const side = i % 2 ? 60 : -60;
                el = {
                    a: je.a * (1 + gauss() * 0.012),
                    e: Math.random() * 0.12,
                    i: Math.abs(gauss()) * 12,
                    node: Math.random() * 360,
                    peri: Math.random() * 360,
                    L: je.L + side + gauss() * 14
                };
            } else {
                // Cinturão principal: rejeita amostras nas lacunas de Kirkwood.
                let a;
                let tries = 0;
                do {
                    a = belt.inner + Math.random() * (belt.outer - belt.inner);
                    tries++;
                } while (tries < 20 && gaps.some((g) => Math.abs(a - g) < (g > 3.2 ? 0.035 : 0.022)));
                el = {
                    a,
                    e: Math.min(0.3, Math.abs(gauss()) * 0.11),
                    i: Math.abs(gauss()) * 7.5,
                    node: Math.random() * 360,
                    peri: Math.random() * 360,
                    L: Math.random() * 360
                };
            }
            orbits[i] = makeOrbit(el);
            const g = 0.45 + Math.random() * 0.35;
            col[i * 3] = g;
            col[i * 3 + 1] = g * 0.92;
            col[i * 3 + 2] = g * 0.8;
            sizes[i] = 0.35 + Math.random() * 0.7;
            tw[i] = 0.2;
        }
        const geo = new THREE.BufferGeometry();
        const posAttr = new THREE.BufferAttribute(pos, 3);
        posAttr.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', posAttr);
        geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aTwinkle', new THREE.BufferAttribute(tw, 1));
        const mat = new THREE.ShaderMaterial({
            uniforms: this.starfieldUniforms,
            vertexShader: STARFIELD_VERT,
            fragmentShader: STARFIELD_FRAG,
            transparent: true,
            depthWrite: false
        });
        this.belt = new THREE.Points(geo, mat);
        this.belt.frustumCulled = false;
        this.beltOrbits = orbits;
        this.beltPos = pos;
        this.planetsGroup.add(this.belt);
    }

    _buildPlanet(p, index) {
        const segs = this.quality.planetSeg;
        const mu = GM_SUN + G * ((p.mass || 0) + (p.extraMass || 0));
        const orbit = makeOrbit(p.elements, { mu });

        // anchor: posição heliocêntrica. holder: equador do planeta (polo IAU).
        const anchor = new THREE.Group();
        this.planetsGroup.add(anchor);
        const holder = new THREE.Group();
        const { pole } = equatorQuaternion(p.rot, holder.quaternion);
        anchor.add(holder);
        // Referencial eclíptico local (a Lua orbita perto da eclíptica, não do equador).
        const eclFrame = new THREE.Group();
        anchor.add(eclFrame);

        const flat = 1 - (p.flattening || 0);
        const uniforms = planetUniforms(p);
        uniforms.uMap.value = this._map(p.texture || 'mercury');
        uniforms.uUseMap.value = 1;
        const planet = new THREE.Mesh(
            new THREE.SphereGeometry(p.radius, segs, Math.floor(segs * 0.7)),
            new THREE.ShaderMaterial({
                uniforms,
                vertexShader: PLANET_VERT,
                fragmentShader: PLANET_FRAG
            })
        );
        planet.scale.set(1, flat, 1); // achatamento polar real (Saturno 9,8%)
        planet.userData.planetIndex = index;
        holder.add(planet);

        const cloudUniforms = {
            uTime: { value: 0 },
            uSeed: { value: p.cloudSeed },
            uCover: { value: p.clouds },
            uSunPos: { value: this.sunPos },
            uColor: { value: new THREE.Color(0.92, 0.94, 0.98) }
        };
        const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(p.radius * 1.018, Math.floor(segs * 0.7), Math.floor(segs * 0.5)),
            new THREE.ShaderMaterial({
                uniforms: cloudUniforms,
                vertexShader: CLOUD_VERT,
                fragmentShader: CLOUD_FRAG,
                transparent: true,
                depthWrite: false
            })
        );
        clouds.scale.set(1, flat, 1);
        clouds.userData.planetIndex = index;
        holder.add(clouds);

        const atmosUniforms = {
            uTime: { value: 0 },
            uDensity: { value: p.atmos },
            uAurora: { value: p.aurora },
            uColor: { value: color(p.atmosColor) },
            uColor2: { value: color(p.atmosColor2) },
            uSunPos: { value: this.sunPos }
        };
        const atmos = new THREE.Mesh(
            new THREE.SphereGeometry(p.radius * 1.12, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: atmosUniforms,
                vertexShader: ATMOS_VERT,
                fragmentShader: ATMOS_FRAG,
                side: THREE.BackSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        atmos.scale.set(1, flat, 1);
        holder.add(atmos);

        const span = p.ringSpan || [1.45, 2.35];
        const gap = p.ringGap || [0.46, 0.56];
        const inner = p.radius * span[0];
        const outer = p.radius * span[1];
        const ringUniforms = {
            uInner: { value: inner },
            uOuter: { value: outer },
            uOpacity: { value: p.rings },
            uColor: { value: color(p.ringColor) },
            uSunPos: { value: this.sunPos },
            uPlanetPos: { value: new THREE.Vector3() },
            uPlanetRadius: { value: p.radius * 0.98 },
            uSeed: { value: p.seed },
            uGap: { value: new THREE.Vector2(gap[0], gap[1]) }
        };
        const rings = new THREE.Mesh(
            new THREE.RingGeometry(inner, outer, 128, 4),
            new THREE.ShaderMaterial({
                uniforms: ringUniforms,
                vertexShader: RING_VERT,
                fragmentShader: RING_FRAG,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: false
            })
        );
        rings.rotation.x = -Math.PI / 2; // plano equatorial
        rings.visible = p.rings > 0.04;
        holder.add(rings);

        const moons = [];
        const moonDefs = p.moonsNamed || [];
        for (let m = 0; m < moonDefs.length; m++) {
            const def = moonDefs[m];
            const frame = def.frame === 'ecliptic' ? eclFrame : holder;
            const moonRoot = new THREE.Group();
            frame.add(moonRoot);
            const moonR = p.radius * (def.scale || 0.16);
            const tint = def.tint || [1, 1, 1];
            const moon = new THREE.Mesh(
                new THREE.SphereGeometry(moonR, 24, 16),
                new THREE.ShaderMaterial({
                    uniforms: {
                        uSeed: { value: p.seed + 20 + m },
                        uColor: { value: new THREE.Color(tint[0], tint[1], tint[2]) },
                        uSunPos: { value: this.sunPos },
                        uMap: { value: this._map(def.texture || 'moon') }
                    },
                    vertexShader: PLANET_VERT,
                    fragmentShader: MOON_FRAG
                })
            );
            moonRoot.add(moon);

            // Fase inicial ilustrativa (determinística) para as luas sem efeméride.
            const seedAng = (p.seed * 47 + m * 131) % 360;
            const mOrbit = makeOrbit({
                a: def.aKm,
                e: def.e ?? 0,
                i: def.i ?? 0,
                node: def.node ?? seedAng,
                peri: def.peri ?? (seedAng + 73),
                L: def.L ?? ((seedAng * 2.3) % 360),
                period: def.period,
                nodeRate: def.nodeRate,
                periRate: def.periRate
            }, { unit: 1000 });
            const visDist = moonVisualDistance(p.radius, def.aKm, p.radiusKm);
            const factor = visDist / def.aKm;

            // Elipse da órbita da lua (visível só com o planeta em foco).
            const lineGeo = new THREE.BufferGeometry();
            const linePos = new Float32Array(97 * 3);
            lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
            const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
                color: 0xbfd8ff, transparent: true, opacity: 0.22, depthWrite: false
            }));
            line.visible = false;
            frame.add(line);

            moons.push({
                def, root: moonRoot, mesh: moon, orbit: mOrbit, factor,
                line, linePos, offset: 0, precess: !!(def.nodeRate || def.periRate)
            });
            this._fillMoonLine(moons[moons.length - 1], 0);
        }

        // Elipse real da órbita (em UA, cena), escalada por objeto.
        // Trecho acima da eclíptica mais claro, abaixo mais escuro.
        const N = 256;
        const pts = new Float32Array((N + 1) * 3);
        const cols = new Float32Array((N + 1) * 3);
        const tmp = this._p;
        for (let i = 0; i <= N; i++) {
            orbitPointAtE(orbit, (i / N) * Math.PI * 2, tmp);
            pts[i * 3] = tmp.x;
            pts[i * 3 + 1] = tmp.z;
            pts[i * 3 + 2] = -tmp.y;
            const k = tmp.z >= 0 ? 1 : 0.42;
            cols[i * 3] = k;
            cols[i * 3 + 1] = k;
            cols[i * 3 + 2] = k;
        }
        const orbitGeo = new THREE.BufferGeometry();
        orbitGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        orbitGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const orbitLine = new THREE.Line(
            orbitGeo,
            new THREE.LineBasicMaterial({
                color: 0x8ec8ff,
                vertexColors: true,
                transparent: true,
                opacity: 0.2,
                depthWrite: false
            })
        );
        orbitLine.frustumCulled = false;
        this.orbitLines.add(orbitLine);

        this.bodies.push({
            index,
            params: p,
            orbitData: orbit,
            pole,
            tilt: axialTilt(pole, orbit, p.rot.Wd),
            root: anchor,
            anchor,
            holder,
            eclFrame,
            planet,
            clouds,
            atmos,
            rings,
            moons,
            uniforms,
            cloudUniforms,
            atmosUniforms,
            ringUniforms,
            orbit: orbitLine,
            spinOffset: 0,
            r: orbit.a,
            ecl: { x: 0, y: 0, z: 0 }
        });
    }

    _fillMoonLine(m, days) {
        const o = m.orbit;
        const tmp = this._p;
        if (m.precess) orbitPosition(o, days, this._k); // atualiza Ω/ω da Lua
        for (let i = 0; i <= 96; i++) {
            orbitPointAtE(o, (i / 96) * Math.PI * 2, tmp);
            m.linePos[i * 3] = tmp.x * m.factor;
            m.linePos[i * 3 + 1] = tmp.z * m.factor;
            m.linePos[i * 3 + 2] = -tmp.y * m.factor;
        }
        m.line.geometry.attributes.position.needsUpdate = true;
    }

    applyParams(index, params) {
        const body = this.bodies[index];
        if (!body) return;
        body.params = params;
        const u = body.uniforms;
        u.uSeed.value = params.seed;
        u.uKind.value = params.kind;
        u.uWater.value = params.water;
        u.uIce.value = params.ice;
        u.uTemp.value = params.temp;
        u.uMountain.value = params.mountain;
        u.uWarp.value = params.warp;
        u.uCities.value = params.cities;
        u.uEmissive.value = params.emissive;
        u.uOceanDeep.value.set(params.oceanDeep[0], params.oceanDeep[1], params.oceanDeep[2]);
        u.uOceanShallow.value.set(params.oceanShallow[0], params.oceanShallow[1], params.oceanShallow[2]);
        u.uLandA.value.set(params.landA[0], params.landA[1], params.landA[2]);
        u.uLandB.value.set(params.landB[0], params.landB[1], params.landB[2]);
        u.uDesert.value.set(params.desert[0], params.desert[1], params.desert[2]);
        u.uSnow.value.set(params.snow[0], params.snow[1], params.snow[2]);
        u.uLava.value.set(params.lava[0], params.lava[1], params.lava[2]);
        u.uPaint.value = params.paint ?? 1;
        u.uSpecGain.value = params.spec ?? u.uSpecGain.value;

        body.cloudUniforms.uCover.value = params.clouds;
        body.atmosUniforms.uDensity.value = params.atmos;
        body.atmosUniforms.uAurora.value = params.aurora;
        body.atmosUniforms.uColor.value.set(params.atmosColor[0], params.atmosColor[1], params.atmosColor[2]);
        body.atmosUniforms.uColor2.value.set(params.atmosColor2[0], params.atmosColor2[1], params.atmosColor2[2]);
        body.ringUniforms.uOpacity.value = params.rings;
        body.ringUniforms.uColor.value.set(params.ringColor[0], params.ringColor[1], params.ringColor[2]);
        body.rings.visible = params.rings > 0.04;
        body.moons.forEach((m) => {
            m.root.visible = true;
        });
    }

    /** Posição de cena do corpo (−1 = Sol). Não aloca. */
    getPlanetWorldPos(index, target) {
        if (index < 0) return target.set(0, 0, 0);
        const body = this.bodies[index];
        if (!body) return target.set(0, 0, 0);
        return target.copy(body.anchor.position);
    }

    /** Raio visual atual (cena) do corpo (−1 = Sol). */
    getPlanetRadius(index) {
        if (index < 0) return (this.star?.radius ?? 1) * this.starGroup.scale.x;
        const b = this.bodies[index];
        return b ? b.params.radius * b.holder.scale.x : 0.25;
    }

    /** Estado heliocêntrico real: { x, y, z (UA, eclíptica), r (UA), v (km/s) }. */
    getHelio(index, out) {
        const b = this.bodies[index];
        if (!b) return null;
        out.x = b.ecl.x;
        out.y = b.ecl.y;
        out.z = b.ecl.z;
        out.r = b.r;
        out.v = orbitSpeed(b.orbitData, b.r) / 1000;
        return out;
    }

    pick(raycaster) {
        const meshes = [];
        this.bodies.forEach((b) => {
            meshes.push(b.planet, b.clouds);
        });
        const hits = raycaster.intersectObjects(meshes, false);
        if (!hits.length) return -1;
        return hits[0].object.userData.planetIndex ?? -1;
    }

    /** Foco: realça a órbita e mostra as órbitas das luas do planeta (−1 = sistema). */
    setSolo(index) {
        this.focusIndex = index;
        this.bodies.forEach((b, i) => {
            b.root.visible = true;
            b.moons.forEach((m) => { m.line.visible = i === index; });
        });
        this.highlight(index);
    }

    setOrbitVisible(visible) {
        this.orbitLines.visible = visible;
    }

    highlight(index) {
        this.bodies.forEach((b, i) => {
            b.orbit.material.opacity = i === index ? 0.55 : index >= 0 ? 0.1 : 0.22;
            b.orbit.material.color.set(i === index ? 0xc9f0ff : 0x8ec8ff);
        });
    }

    /** 0 = distâncias comprimidas, 1 = escala real; `instant` pula a transição. */
    setScaleMode(real, instant = false) {
        this.scaleTarget = real ? 1 : 0;
        if (instant) this.scaleMix = this.scaleTarget;
    }

    /** Fundo no infinito: segue a câmera. */
    followCamera(pos) {
        this.background.position.copy(pos);
    }

    /**
     * days: instante simulado (dias desde J2000).
     * dt:   segundos reais do quadro (animações ambientes e limite de amostragem).
     * dd:   dias simulados avançados neste quadro (com sinal).
     */
    update(days, dt, dd = 0) {
        this.time += dt;
        this.days = days;
        const t = this.time;

        // Transição suave entre escalas (~0,6 s), smoothstep exponencial.
        if (this.scaleMix !== this.scaleTarget) {
            const diff = this.scaleTarget - this.scaleMix;
            this.scaleMix = Math.abs(diff) < 1e-3 ? this.scaleTarget : this.scaleMix + diff * (1 - Math.exp(-7 * dt));
        }
        const mix = this.scaleMix;
        const mixChanged = mix !== this._lastMix;
        const bodyScale = 1 + (SCALE.realBody - 1) * mix;

        this.nebulaUniforms.uTime.value = t;
        this.starfieldUniforms.uTime.value = t;
        if (this.starUniforms) {
            this.starUniforms.uTime.value = t;
            const s = this.star;
            const n = Math.abs(s.rot.Wd) * DEG;
            this.starSpinOffset = lagOffset(this.starSpinOffset, n, dd, dt, MAX_SPIN);
            this.starMesh.rotation.y = wrapPi((s.rot.W0 + s.rot.Wd * (days + this.starSpinOffset)) * DEG);
            if (mixChanged) this.starGroup.scale.setScalar(1 + (SCALE.realSun - 1) * mix);
        }

        const k = this._k;
        for (let i = 0; i < this.bodies.length; i++) {
            const b = this.bodies[i];
            const p = b.params;
            orbitPosition(b.orbitData, days, k);
            b.ecl.x = k.x; b.ecl.y = k.y; b.ecl.z = k.z; b.r = k.r;
            const f = orbitFactor(b.orbitData.a, mix);
            // eclíptica (x, y, z) → cena (x, z, −y)
            b.anchor.position.set(k.x * f, k.z * f, -k.y * f);
            if (mixChanged) {
                b.orbit.scale.setScalar(f);
                b.holder.scale.setScalar(bodyScale);
                b.eclFrame.scale.setScalar(bodyScale);
                b.ringUniforms.uPlanetRadius.value = p.radius * 0.98 * bodyScale;
            }

            // Rotação sideral real: W = W0 + Ẇ·d (IAU), com limite de amostragem.
            const nSpin = Math.abs(p.rot.Wd) * DEG;
            b.spinOffset = lagOffset(b.spinOffset, nSpin, dd, dt, MAX_SPIN);
            const W = wrapPi((p.rot.W0 + p.rot.Wd * (days + b.spinOffset)) * DEG);
            b.planet.rotation.y = W;
            b.clouds.rotation.y = W + t * 0.004; // nuvens derivam devagar sobre a superfície
            b.uniforms.uTime.value = t;
            b.cloudUniforms.uTime.value = t;
            b.atmosUniforms.uTime.value = t;
            b.ringUniforms.uPlanetPos.value.copy(b.anchor.position);

            for (let m = 0; m < b.moons.length; m++) {
                const moon = b.moons[m];
                moon.offset = lagOffset(moon.offset, moon.orbit.n, dd, dt, MAX_MOON);
                orbitPosition(moon.orbit, days + moon.offset, k);
                const mf = moon.factor;
                const x = k.x * mf, y = k.z * mf, z = -k.y * mf;
                moon.mesh.position.set(x, y, z);
                // Rotação síncrona (travamento de maré): longitude 0 voltada ao planeta.
                moon.mesh.rotation.y = Math.atan2(z, -x);
                if (moon.precess && moon.line.visible) this._fillMoonLine(moon, days);
            }
        }

        this._updateBelt(days, mix);
        this._lastMix = mix;
    }

    _updateBelt(days, mix) {
        if (!this.belt) return;
        if (days === this._lastBeltDays && mix === this._lastMix) return;
        this._lastBeltDays = days;
        const pos = this.beltPos;
        const k = this._k;
        const orbits = this.beltOrbits;
        for (let i = 0; i < orbits.length; i++) {
            const o = orbits[i];
            orbitPosition(o, days, k);
            const f = orbitFactor(o.a, mix);
            pos[i * 3] = k.x * f;
            pos[i * 3 + 1] = k.z * f;
            pos[i * 3 + 2] = -k.y * f;
        }
        this.belt.geometry.attributes.position.needsUpdate = true;
    }

    setPixelRatio(pr) {
        this.starfieldUniforms.uPixelRatio.value = pr;
    }
}
