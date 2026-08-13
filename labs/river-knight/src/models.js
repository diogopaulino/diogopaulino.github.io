/**
 * Modelos 3D construídos por código — nenhum arquivo .glb/.obj envolvido.
 *
 * O casco do drakkar é gerado por "loft": seções transversais em U ao longo
 * do comprimento, com as bordas subindo em direção à proa e à popa (a linha
 * de sheer típica dos barcos nórdicos).
 */

import * as THREE from 'three';
import { COLORS } from './config.js';
import { woodTexture, sailTexture, shieldTexture, stoneTexture, bannerTexture } from './textures.js';

/* ------------------------------------------------------------------ */
/* Materiais                                                           */
/* ------------------------------------------------------------------ */

const materialCache = new Map();

function cachedMaterial(key, factory) {
    if (!materialCache.has(key)) materialCache.set(key, factory());
    return materialCache.get(key);
}

export function woodMaterial(dark = false, color = COLORS.hull) {
    return cachedMaterial(`wood:${dark}:${color}`, () => new THREE.MeshStandardMaterial({
        map: woodTexture(dark),
        color,
        roughness: 0.82,
        metalness: 0.04
    }));
}

export function metalMaterial(color = 0xa9adb4, roughness = 0.34) {
    return cachedMaterial(`metal:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.88
    }));
}

export function plainMaterial(color, roughness = 0.7, metalness = 0.05, emissive = 0x000000, emissiveIntensity = 1) {
    return cachedMaterial(`plain:${color}:${roughness}:${metalness}:${emissive}:${emissiveIntensity}`, () =>
        new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness,
            emissive,
            emissiveIntensity
        }));
}

export function stoneMaterial(tint = '#8f8d87') {
    return cachedMaterial(`stone:${tint}`, () => new THREE.MeshStandardMaterial({
        map: stoneTexture(tint),
        roughness: 0.95,
        metalness: 0.02
    }));
}

/**
 * Material de tecido: injeta ondulação no vertex shader (vela, capa e
 * estandartes usam o mesmo shader, com ventos diferentes).
 * `uv.x` define o quanto cada ponto está livre para tremular.
 */
export function clothMaterial({ map = null, color = 0xffffff, side = THREE.DoubleSide, wind = 1 } = {}) {
    const material = new THREE.MeshStandardMaterial({
        map,
        color,
        side,
        roughness: 0.86,
        metalness: 0,
        transparent: Boolean(map),
        alphaTest: map ? 0.35 : 0
    });

    material.userData.uniforms = {
        uTime: { value: 0 },
        uWind: { value: wind }
    };

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = material.userData.uniforms.uTime;
        shader.uniforms.uWind = material.userData.uniforms.uWind;

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `
                #include <common>
                uniform float uTime;
                uniform float uWind;
                `
            )
            .replace(
                '#include <begin_vertex>',
                /* glsl */ `
                #include <begin_vertex>
                float rkFree = uv.x;
                float rkFlap = sin(uv.x * 6.2 + uTime * 3.1) * 0.55
                             + sin(uv.y * 4.1 - uTime * 2.2) * 0.32
                             + sin((uv.x + uv.y) * 9.0 + uTime * 5.0) * 0.13;
                transformed.z += rkFlap * rkFree * rkFree * uWind;
                transformed.x += rkFlap * rkFree * 0.12 * uWind;
                `
            )
            .replace(
                '#include <beginnormal_vertex>',
                /* glsl */ `
                #include <beginnormal_vertex>
                float rkN = cos(uv.x * 6.2 + uTime * 3.1) * 0.5;
                objectNormal = normalize(objectNormal + vec3(0.0, 0.0, 0.0) + vec3(rkN * uv.x * 0.35, 0.0, 0.0));
                `
            );
    };

    material.customProgramCacheKey = () => 'river-knight-cloth';
    return material;
}

/** Avança a animação de todos os tecidos criados. */
const clothMaterials = new Set();
export function registerCloth(material) {
    clothMaterials.add(material);
    return material;
}
export function updateCloth(time) {
    clothMaterials.forEach((m) => {
        m.userData.uniforms.uTime.value = time;
    });
}

/* ------------------------------------------------------------------ */
/* Casco                                                               */
/* ------------------------------------------------------------------ */

/** Perfil do casco em t ∈ [-1, 1] (−1 popa, +1 proa). */
function hullShapeAt(t, { length = 15, beam = 3.6, depth = 1.6, rise = 1.9 } = {}) {
    const taper = Math.pow(Math.max(0, 1 - t * t), 0.42);
    return {
        hw: Math.max(0.09, (beam / 2) * taper),
        dep: depth * (0.55 + 0.45 * taper),
        sheer: rise * Math.pow(Math.abs(t), 2.6),
        z: (t * length) / 2
    };
}

/**
 * Gera só a casca do casco (loft em U). O convés é mesh separada —
 * ver `buildDeckGeometry`.
 */
export function buildHullGeometry({
    length = 15,
    beam = 3.6,
    depth = 1.6,
    rise = 1.9,
    rings = 30,
    arcSteps = 12
} = {}) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const dims = { length, beam, depth, rise };

    for (let r = 0; r <= rings; r++) {
        const t = (r / rings) * 2 - 1;
        const { hw, dep, sheer, z } = hullShapeAt(t, dims);
        for (let a = 0; a <= arcSteps; a++) {
            const s = a / arcSteps;
            const ang = -Math.PI / 2 + s * Math.PI;
            const x = hw * Math.sin(ang);
            const y = sheer - dep * Math.pow(Math.cos(ang), 1.25);
            positions.push(x, y, z);
            uvs.push(s * 1.6, (r / rings) * 3.2);
        }
    }

    const perRing = arcSteps + 1;
    for (let r = 0; r < rings; r++) {
        for (let a = 0; a < arcSteps; a++) {
            const i0 = r * perRing + a;
            const i1 = i0 + 1;
            const i2 = i0 + perRing;
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }

    // Tampas da proa e da popa — fecham o U para a câmera não ver a água
    // através do túnel do casco.
    const midArc = Math.floor(arcSteps / 2);
    for (const end of [0, rings]) {
        const base = end * perRing;
        const keel = base + midArc;
        // Fan a partir da quilha cobrindo o arco (normals para fora do barco).
        for (let a = 0; a < arcSteps; a++) {
            const iA = base + a;
            const iB = base + a + 1;
            if (end === 0) indices.push(keel, iB, iA); // popa (−Z): normal −Z
            else indices.push(keel, iA, iB); // proa (+Z): normal +Z
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
}

/**
 * Convés com espessura e normals para cima (visível da câmera de perseguição).
 * Topo em sheer − drop; fundo em topo − thickness.
 */
export function buildDeckGeometry({
    length = 15,
    beam = 3.6,
    rise = 1.9,
    rings = 28,
    drop = 0.28,
    thickness = 0.14,
    inset = 0.995
} = {}) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const dims = { length, beam, rise };

    // Ordem por anel: L-top, R-top, L-bot, R-bot.
    for (let r = 0; r <= rings; r++) {
        const t = (r / rings) * 2 - 1;
        const { hw, sheer, z } = hullShapeAt(t, dims);
        const x = Math.max(0.08, hw * inset);
        const yTop = sheer - drop;
        const yBot = yTop - thickness;
        const v = (r / rings) * 3.2;
        positions.push(-x, yTop, z, x, yTop, z, -x, yBot, z, x, yBot, z);
        uvs.push(0, v, 1, v, 0, v, 1, v);
    }

    for (let r = 0; r < rings; r++) {
        const b = r * 4;
        const n = b + 4;
        // Topo: winding CCW visto de cima → normal +Y.
        indices.push(b, n, b + 1, b + 1, n, n + 1);
        // Fundo: normal −Y.
        indices.push(b + 2, b + 3, n + 2, b + 3, n + 3, n + 2);
        // Bordas laterais (fecha a espessura).
        indices.push(b, b + 2, n, n, b + 2, n + 2);
        indices.push(b + 1, n + 1, b + 3, b + 3, n + 1, n + 3);
    }

    // Tampas do convés nas pontas.
    const last = rings * 4;
    indices.push(0, 1, 3, 0, 3, 2);
    indices.push(last, last + 3, last + 1, last, last + 2, last + 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
}

/** Cabeça de dragão da proa. */
function buildDragonHead(color) {
    const group = new THREE.Group();
    const mat = woodMaterial(true, color);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.5, 10), mat);
    neck.rotation.x = -0.35;
    neck.position.y = 0.7;
    group.add(neck);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.95), mat);
    skull.position.set(0, 1.42, 0.42);
    skull.rotation.x = 0.25;
    group.add(skull);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.55), mat);
    snout.position.set(0, 1.3, 1.0);
    snout.rotation.x = 0.25;
    group.add(snout);

    // Crista de espinhos.
    for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), mat);
        spike.position.set(0, 1.6 - i * 0.06, 0.1 - i * 0.28);
        spike.rotation.x = -0.5;
        group.add(spike);
    }

    // Olhos brilhantes.
    const eyeMat = plainMaterial(0xffb347, 0.3, 0, 0xff7a1a, 2.4);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
        eye.position.set(sx * 0.17, 1.46, 0.72);
        group.add(eye);
    }

    return group;
}

/**
 * Drakkar completo. Retorna o grupo e as partes animáveis.
 */
export function buildLongship({
    length = 15,
    beam = 3.6,
    hullColor = COLORS.hull,
    sailBase = '#ded1b0',
    sailStripe = '#a02f2f',
    emblem = 'cross',
    shields = true,
    oars = true,
    dragon = true,
    lantern = true,
    lanternLight = true,
    cannons = false
} = {}) {
    const group = new THREE.Group();
    const parts = { oars: [], shields: [], lights: [], cannons: [] };
    const deckDrop = 0.22;
    const deckThickness = 0.18;

    const hull = new THREE.Mesh(buildHullGeometry({ length, beam }), woodMaterial(false, hullColor).clone());
    hull.castShadow = true;
    hull.receiveShadow = true;
    hull.material.side = THREE.DoubleSide;
    hull.material.color.multiplyScalar(0.88);
    group.add(hull);
    parts.hull = hull;

    // Porão sólido que segue o afilamento do casco — a água nunca “entra”.
    const bilgeMat = new THREE.MeshStandardMaterial({
        color: 0x120d09,
        roughness: 1,
        metalness: 0,
        flatShading: false
    });
    const bilgeRoot = new THREE.Group();
    bilgeRoot.raycast = () => {};
    const bilgeSegs = 14;
    for (let i = 0; i < bilgeSegs; i++) {
        const t0 = -0.98 + (i / bilgeSegs) * 1.96;
        const t1 = -0.98 + ((i + 1) / bilgeSegs) * 1.96;
        const t = (t0 + t1) * 0.5;
        const { hw, dep, sheer, z } = hullShapeAt(t, { length, beam });
        const topY = sheer - deckDrop + 0.06;
        const botY = sheer - dep * 0.98 - 0.08;
        const h = Math.max(0.55, topY - botY);
        const segLen = Math.abs(((t1 - t0) * length) / 2) * 1.08;
        const plug = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.28, hw * 2.08), h, segLen),
            bilgeMat
        );
        plug.position.set(0, (topY + botY) * 0.5, z);
        plug.raycast = () => {};
        bilgeRoot.add(plug);
    }
    group.add(bilgeRoot);
    parts.bilge = bilgeRoot;

    // Convés separado: madeira escura, espesso, normals para cima.
    const deckMat = woodMaterial(true, 0x6a4a32).clone();
    deckMat.polygonOffset = true;
    deckMat.polygonOffsetFactor = 1;
    deckMat.polygonOffsetUnits = 1;
    const deck = new THREE.Mesh(
        buildDeckGeometry({
            length,
            beam,
            drop: deckDrop,
            thickness: Math.max(deckThickness, 0.26),
            inset: 0.992
        }),
        deckMat
    );
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    parts.deck = deck;

    // Ripas do piso — leitura de prancha, fecha visualmente o vão residual.
    const plankMat = woodMaterial(true, 0x4a3222);
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, length * 0.82), plankMat);
        plank.position.set(i * beam * 0.14, -deckDrop + 0.02, 0);
        group.add(plank);
    }

    // Anteparas na proa/popa (bem nas pontas) — bloqueiam o túnel para a água.
    const bulkMat = woodMaterial(true, 0x2e1c12);
    for (const t of [-0.94, -0.55, 0.55, 0.94]) {
        const { hw, sheer, dep, z } = hullShapeAt(t, { length, beam });
        const deckY = sheer - deckDrop;
        const bilge = sheer - dep * 0.85;
        const h = Math.max(0.55, deckY - bilge + 0.35);
        const bulk = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.85, h, 0.11), bulkMat);
        bulk.position.set(0, bilge + h * 0.5, z);
        bulk.castShadow = true;
        group.add(bulk);
    }

    // Espelho de popa/proa — a câmera de perseguição olha para dentro do U;
    // sem painel sólido a água atravessa o casco.
    for (const t of [-0.995, 0.995]) {
        const { hw, sheer, dep, z } = hullShapeAt(t, { length, beam });
        const bilge = sheer - dep;
        const h = Math.max(1.15, sheer - bilge + 0.6);
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.65, hw * 2.15), h, 0.2),
            bulkMat
        );
        panel.position.set(0, bilge + h * 0.52, z);
        panel.castShadow = true;
        group.add(panel);
    }

    // Plataforma de popa (guerreiro) — fecha o túnel que a câmera vê.
    {
        const sternMat = woodMaterial(true, 0x4a3222);
        const sternDark = woodMaterial(true, 0x2a1a12);

        // Bloco único da quilha ao peitoril, da popa até midships.
        // Centro alto o bastante para o topo ficar acima da linha d'água.
        const sternPlug = new THREE.Mesh(
            new THREE.BoxGeometry(beam * 0.98, 2.4, length * 0.52),
            sternDark
        );
        sternPlug.position.set(0, 0.05, -length * 0.24);
        sternPlug.raycast = () => {};
        group.add(sternPlug);

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(beam * 0.98, 0.32, length * 0.52),
            sternMat
        );
        platform.position.set(0, -deckDrop + 0.55, -length * 0.2);
        platform.castShadow = true;
        platform.receiveShadow = true;
        group.add(platform);
        parts.sternPlatform = platform;

        // Convés elevado contínuo (leitura de madeira, não de vazio).
        const aftDeck = new THREE.Mesh(
            new THREE.BoxGeometry(beam * 1.0, 0.18, length * 0.54),
            woodMaterial(true, 0x5c3d28)
        );
        aftDeck.position.set(0, -deckDrop + 0.7, -length * 0.18);
        aftDeck.receiveShadow = true;
        group.add(aftDeck);

        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(beam * 0.96, 0.48, 0.18),
            woodMaterial(true, 0x3a2618)
        );
        rail.position.set(0, -deckDrop + 0.98, -length * 0.44);
        group.add(rail);

        for (const side of [-1, 1]) {
            const cheek = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 1.35, length * 0.5),
                woodMaterial(true, 0x3a2618)
            );
            cheek.position.set(side * beam * 0.46, -deckDrop + 0.35, -length * 0.2);
            group.add(cheek);
        }

        // Tampa de popa alta — silhueta fechada vista da câmera de perseguição.
        const transom = new THREE.Mesh(
            new THREE.BoxGeometry(beam * 0.98, 1.75, 0.32),
            woodMaterial(true, 0x2e1c12)
        );
        transom.position.set(0, 0.15, -length * 0.48);
        transom.castShadow = true;
        group.add(transom);
    }

    // Sombra de contato na superfície da água (o corpo d'água é opaco).
    // root.y ≈ water + 0.42 → y local ≈ −0.36 fica logo acima da água.
    const contact = new THREE.Mesh(
        new THREE.CircleGeometry(beam * 0.42, 20),
        new THREE.MeshBasicMaterial({
            color: 0x030a12,
            transparent: true,
            opacity: 0.38,
            depthWrite: false
        })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = -0.36;
    contact.scale.set(1.2, 3.1, 1);
    contact.renderOrder = 3;
    group.add(contact);
    parts.contactShadow = contact;

    // Amurada (borda superior) — dois "trilhos" curvos de madeira escura.
    const railMat = woodMaterial(true, hullColor);
    const railSteps = 24;
    for (const side of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= railSteps; i++) {
            const t = (i / railSteps) * 2 - 1;
            const { hw, sheer, z } = hullShapeAt(t, { length, beam });
            pts.push(new THREE.Vector3(side * hw, sheer + 0.03, z));
        }
        const rail = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), railSteps, 0.11, 6, false),
            railMat
        );
        rail.castShadow = true;
        group.add(rail);
    }

    // Quilha e cadastes.
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, length * 0.98), railMat);
    keel.position.y = -1.35;
    group.add(keel);

    // Faixa molhada na linha d'água (leitura do casco contra a água).
    const waterlineMat = woodMaterial(true, 0x2a1a12);
    for (const side of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
            const t = (i / 20) * 2 - 1;
            const { hw, z } = hullShapeAt(t, { length, beam });
            pts.push(new THREE.Vector3(side * hw * 1.01, -0.95, z));
        }
        const band = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.07, 5, false),
            waterlineMat
        );
        group.add(band);
    }

    // Costelas internas (poucas, só para volume).
    const ribMat = woodMaterial(true, 0x2e1d14);
    const ribCount = 5;
    for (let i = 0; i < ribCount; i++) {
        const t = -0.55 + (i / (ribCount - 1)) * 1.1;
        const { hw, sheer, z } = hullShapeAt(t, { length, beam });
        const deckY = sheer - deckDrop;
        const rib = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.7, 0.08, 0.1), ribMat);
        rib.position.set(0, deckY - 0.04, z);
        group.add(rib);
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.07, Math.max(0.2, sheer - deckY + 0.15), 0.07), ribMat);
        postL.position.set(-hw * 0.88, (sheer + deckY) * 0.5, z);
        group.add(postL);
        const postR = postL.clone();
        postR.position.x = hw * 0.88;
        group.add(postR);
    }

    if (dragon) {
        const head = buildDragonHead(hullColor);
        head.position.set(0, 0.9, length / 2 - 0.35);
        head.castShadow = true;
        group.add(head);
        parts.dragon = head;

        const tail = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.11, 6, 12, Math.PI * 1.2), railMat);
        tail.position.set(0, 1.5, -length / 2 + 0.2);
        tail.rotation.set(Math.PI / 2, 0, Math.PI * 0.1);
        tail.rotation.y = Math.PI / 2;
        group.add(tail);
    }

    // Bancos de remo assentados no convés.
    const benchMat = woodMaterial(true, hullColor);
    const benchCount = 4;
    for (let i = 0; i < benchCount; i++) {
        const t = -0.5 + (i / (benchCount - 1)) * 1.0;
        const { sheer, z } = hullShapeAt(t, { length, beam });
        const deckY = sheer - deckDrop;
        const bench = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.78, 0.12, 0.42), benchMat);
        bench.position.set(0, deckY + 0.06, z);
        bench.castShadow = true;
        group.add(bench);
    }

    // Mastro + verga + vela. O mastro fica à frente do centro para que a vela
    // não tape o guerreiro na câmera de perseguição.
    const mastZ = length * 0.16;
    const mastHeight = beam * 1.85;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, mastHeight, 10), railMat);
    mast.position.set(0, mastHeight / 2 - 0.4, mastZ);
    mast.castShadow = true;
    group.add(mast);
    parts.mast = mast;

    const yardY = mastHeight - 0.85;
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, beam * 1.55, 8), railMat);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, yardY, mastZ);
    group.add(yard);

    const sailMat = registerCloth(clothMaterial({
        map: sailTexture({ base: sailBase, stripe: sailStripe, emblem }),
        side: THREE.DoubleSide,
        wind: 0.5
    }));
    sailMat.transparent = false;
    sailMat.alphaTest = 0;

    const sailHeight = beam * 0.95;
    const sailGeo = new THREE.PlaneGeometry(beam * 1.45, sailHeight, 14, 10);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, yardY - sailHeight / 2 - 0.1, mastZ);
    sail.castShadow = true;
    group.add(sail);
    parts.sail = sail;

    // Cordame.
    const ropes = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-beam * 0.75, yardY, mastZ),
        new THREE.Vector3(0, 0.5, length / 2 - 1.4),
        new THREE.Vector3(beam * 0.75, yardY, mastZ),
        new THREE.Vector3(0, 0.5, length / 2 - 1.4),
        new THREE.Vector3(-beam * 0.75, yardY, mastZ),
        new THREE.Vector3(0, 0.7, -length / 2 + 1.2),
        new THREE.Vector3(beam * 0.75, yardY, mastZ),
        new THREE.Vector3(0, 0.7, -length / 2 + 1.2)
    ]);
    group.add(new THREE.LineSegments(ropes, new THREE.LineBasicMaterial({ color: 0x2a2118 })));

    if (shields) {
        const shieldGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.1, 16);
        const shieldMats = [
            new THREE.MeshStandardMaterial({ map: shieldTexture('#b23a3a', '#e5d6ae'), roughness: 0.7 }),
            new THREE.MeshStandardMaterial({ map: shieldTexture('#2f5d7c', '#e5d6ae'), roughness: 0.7 }),
            new THREE.MeshStandardMaterial({ map: shieldTexture('#2f6b45', '#efe3bf'), roughness: 0.7 })
        ];
        const count = 5;
        for (const side of [-1, 1]) {
            for (let i = 0; i < count; i++) {
                const t = -0.62 + (i / (count - 1)) * 1.24;
                const taper = Math.pow(Math.max(0, 1 - t * t), 0.42);
                const hw = Math.max(0.09, (beam / 2) * taper);
                const sheer = 1.9 * Math.pow(Math.abs(t), 2.6);
                const shield = new THREE.Mesh(shieldGeo, shieldMats[(i + (side > 0 ? 1 : 0)) % shieldMats.length]);
                shield.rotation.z = Math.PI / 2;
                shield.position.set(side * (hw + 0.06), sheer - 0.28, (t * length) / 2);
                shield.castShadow = true;
                group.add(shield);
                parts.shields.push(shield);
            }
        }
    }

    if (oars) {
        const oarGeo = new THREE.BoxGeometry(0.09, 0.09, 3.6);
        const bladeGeo = new THREE.BoxGeometry(0.22, 0.05, 0.9);
        const oarMat = woodMaterial(true, hullColor);
        const perSide = 3;
        for (const side of [-1, 1]) {
            for (let i = 0; i < perSide; i++) {
                const pivot = new THREE.Group();
                const t = -0.42 + (i / (perSide - 1)) * 0.84;
                const taper = Math.pow(Math.max(0, 1 - t * t), 0.42);
                const hw = Math.max(0.09, (beam / 2) * taper);
                pivot.position.set(side * hw, 0.35, (t * length) / 2);

                const shaft = new THREE.Mesh(oarGeo, oarMat);
                shaft.position.set(side * 1.5, -0.2, 0);
                shaft.rotation.y = side * Math.PI * 0.5;
                shaft.castShadow = true;
                pivot.add(shaft);

                const blade = new THREE.Mesh(bladeGeo, oarMat);
                blade.position.set(side * 3.1, -0.5, 0);
                blade.rotation.y = side * Math.PI * 0.5;
                pivot.add(blade);

                pivot.userData.side = side;
                pivot.userData.phase = i * 0.35;
                // Remos apontam para baixo, tocando a água.
                pivot.userData.baseRoll = -side * 0.34;
                pivot.rotation.z = pivot.userData.baseRoll;
                group.add(pivot);
                parts.oars.push(pivot);
            }
        }
    }

    if (cannons) {
        const bronze = metalMaterial(0x8f7340, 0.48);
        const dark = metalMaterial(0x2e2924, 0.58);
        const wood = woodMaterial(true, 0x4a3220);

        const makeGun = (side, aim = 'broadside') => {
            const gun = new THREE.Group();
            const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.48), wood);
            carriage.position.y = -0.02;
            gun.add(carriage);

            const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10);
            for (const wx of [-0.22, 0.22]) {
                const wheel = new THREE.Mesh(wheelGeo, dark);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(wx, -0.18, 0.18);
                gun.add(wheel);
            }

            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.145, 1.7, 12), bronze);
            barrel.castShadow = true;
            if (aim === 'bow') {
                barrel.rotation.x = Math.PI / 2;
                barrel.position.set(0, 0.18, 0.55);
            } else {
                barrel.rotation.z = Math.PI / 2;
                barrel.rotation.y = side > 0 ? -0.08 : 0.08;
                barrel.position.set(side * 0.42, 0.16, 0);
            }
            gun.add(barrel);

            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.028, 6, 14), dark);
            if (aim === 'bow') {
                ring.position.set(0, 0.18, 1.35);
            } else {
                ring.rotation.y = Math.PI / 2;
                ring.position.set(side * 1.22, 0.16, 0);
            }
            gun.add(ring);

            gun.userData.side = side;
            gun.userData.aim = aim;
            gun.userData.muzzleLocal =
                aim === 'bow'
                    ? new THREE.Vector3(0, 0.2, 1.45)
                    : new THREE.Vector3(side * 1.28, 0.18, 0);
            return gun;
        };

        for (const side of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                const t = -0.34 + (i / 2) * 0.66;
                const { hw, sheer, z } = hullShapeAt(t, { length, beam });
                const gun = makeGun(side, 'broadside');
                gun.position.set(side * (hw * 0.62), sheer - deckDrop + 0.22, z);
                group.add(gun);
                parts.cannons.push(gun);
            }
        }

        // Canhão de proa — alvos à frente do rio.
        {
            const { sheer, z } = hullShapeAt(0.72, { length, beam });
            const bowGun = makeGun(0, 'bow');
            bowGun.position.set(0, sheer - deckDrop + 0.12, z);
            group.add(bowGun);
            parts.cannons.push(bowGun);
        }
    }

    if (lantern) {
        const lanternGroup = new THREE.Group();
        const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 8), metalMaterial(0x6b6257, 0.5));
        lanternGroup.add(cage);
        const flame = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            plainMaterial(0xffd08a, 0.3, 0, 0xff9a3c, 1.4)
        );
        lanternGroup.add(flame);
        if (lanternLight) {
            const light = new THREE.PointLight(0xffa54a, 2.2, 9, 2);
            light.position.y = 0.1;
            lanternGroup.add(light);
            parts.lights.push(light);
        }
        lanternGroup.position.set(0, 1.85, -length / 2 + 0.9);
        group.add(lanternGroup);
        parts.lantern = lanternGroup;
        parts.lanternFlame = flame;
    }

    group.userData.parts = parts;
    return { group, parts };
}

/* ------------------------------------------------------------------ */
/* Guerreiro                                                           */
/* ------------------------------------------------------------------ */

export function buildWarrior({ tunic = 0x8c2f3a, cape = 0x7a1f2b } = {}) {
    const group = new THREE.Group();
    const steel = metalMaterial(0xb6bcc4, 0.3);
    const darkSteel = metalMaterial(0x5c6169, 0.45);
    const leather = plainMaterial(0x4a3524, 0.85, 0.02);
    const skin = plainMaterial(0xd9a77c, 0.75, 0);
    const cloth = plainMaterial(tunic, 0.85, 0);

    // Pernas.
    for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.1, 0.78, 8), leather);
        leg.position.set(sx * 0.15, 0.39, 0);
        leg.castShadow = true;
        group.add(leg);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.34), plainMaterial(0x2e2116, 0.9, 0));
        boot.position.set(sx * 0.15, 0.07, 0.04);
        group.add(boot);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.78;
    group.add(torso);

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.24, 0.62, 10), cloth);
    chest.position.y = 0.3;
    chest.castShadow = true;
    torso.add(chest);

    // Cota de malha / peitoral.
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.36, 10), steel);
    plate.position.y = 0.42;
    plate.castShadow = true;
    torso.add(plate);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), leather);
    belt.position.y = 0.04;
    torso.add(belt);

    // Ombreiras.
    for (const sx of [-1, 1]) {
        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel);
        pauldron.position.set(sx * 0.3, 0.56, 0);
        pauldron.rotation.z = sx * 0.35;
        pauldron.castShadow = true;
        torso.add(pauldron);
    }

    // Cabeça + elmo.
    const head = new THREE.Group();
    head.position.y = 0.74;
    torso.add(head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
    head.add(skull);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), steel);
    helm.position.y = 0.02;
    helm.castShadow = true;
    head.add(helm);

    const nasal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), steel);
    nasal.position.set(0, -0.03, 0.17);
    head.add(nasal);

    for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 7), plainMaterial(0xe8dfc8, 0.6, 0));
        horn.position.set(sx * 0.19, 0.12, -0.02);
        horn.rotation.z = sx * -0.85;
        horn.rotation.x = -0.15;
        head.add(horn);
    }

    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 8), plainMaterial(0x8a5b2f, 0.9, 0));
    beard.position.set(0, -0.14, 0.06);
    beard.rotation.x = Math.PI;
    head.add(beard);

    // Braços (pivô no ombro).
    const armGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.56, 8);
    const armR = new THREE.Group();
    armR.position.set(0.3, 0.52, 0);
    torso.add(armR);
    const armRMesh = new THREE.Mesh(armGeo, cloth);
    armRMesh.position.y = -0.28;
    armRMesh.castShadow = true;
    armR.add(armRMesh);
    const bracerR = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.18, 8), darkSteel);
    bracerR.position.y = -0.5;
    armR.add(bracerR);

    const armL = new THREE.Group();
    armL.position.set(-0.3, 0.52, 0);
    torso.add(armL);
    const armLMesh = new THREE.Mesh(armGeo, cloth);
    armLMesh.position.y = -0.28;
    armLMesh.castShadow = true;
    armL.add(armLMesh);

    // Escudo no braço esquerdo.
    const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16),
        new THREE.MeshStandardMaterial({ map: shieldTexture('#2f5d7c', '#e8dcb8'), roughness: 0.68 })
    );
    shield.rotation.z = Math.PI / 2;
    shield.rotation.y = 0.2;
    shield.position.set(-0.16, -0.5, 0.06);
    shield.castShadow = true;
    armL.add(shield);

    // Machado na mão direita.
    const axe = buildAxeMesh(0.85);
    axe.position.set(0.02, -0.62, 0.06);
    axe.rotation.set(-0.4, 0, 0.3);
    armR.add(axe);

    // Capa.
    const capeMat = registerCloth(clothMaterial({ color: cape, side: THREE.DoubleSide, wind: 0.4 }));
    capeMat.transparent = false;
    capeMat.alphaTest = 0;
    const capeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.95, 8, 8), capeMat);
    capeMesh.position.set(0, 0.18, -0.26);
    capeMesh.rotation.x = 0.12;
    capeMesh.castShadow = true;
    torso.add(capeMesh);

    group.userData.parts = { torso, head, armR, armL, axe, cape: capeMesh };
    return { group, parts: group.userData.parts };
}

/** Machado de arremesso (também usado como projétil). */
export function buildAxeMesh(scale = 1) {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.045, 0.8, 7),
        woodMaterial(true, 0x6b4a2a)
    );
    group.add(handle);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.1), metalMaterial(0xc9ced6, 0.28));
    head.position.set(0, 0.3, 0.06);
    group.add(head);

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, -0.14);
    bladeShape.quadraticCurveTo(0.34, -0.24, 0.4, 0.02);
    bladeShape.quadraticCurveTo(0.34, 0.24, 0, 0.16);
    bladeShape.lineTo(0, -0.14);
    const blade = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bladeShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 }),
        metalMaterial(0xd7dce3, 0.22)
    );
    blade.position.set(0.03, 0.3, -0.025);
    group.add(blade);

    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 7), plainMaterial(0x3b2a19, 0.9, 0));
    wrap.position.y = -0.3;
    group.add(wrap);

    group.scale.setScalar(scale);
    group.traverse((c) => {
        c.castShadow = true;
    });
    return group;
}

/** Bala de canhão — projétil principal do jogador. */
export function buildCannonballMesh(scale = 1) {
    const mat = metalMaterial(0x2a2c30, 0.55);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 12, 10), mat);
    ball.castShadow = true;
    return ball;
}

/** Flecha incendiária dos inimigos. */
export function buildArrowMesh() {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6),
        woodMaterial(true, 0x6b4a2a)
    );
    shaft.rotation.x = Math.PI / 2;
    group.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 7), metalMaterial(0xb9bec6, 0.3));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.85;
    group.add(tip);

    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        plainMaterial(0xffb765, 0.4, 0, 0xff6a1a, 3.5)
    );
    flame.position.z = 0.6;
    flame.scale.set(1, 1, 1.8);
    group.add(flame);
    group.userData.flame = flame;

    for (let i = 0; i < 3; i++) {
        const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.26), plainMaterial(0x8a2b2b, 0.9, 0));
        fletch.position.z = -0.6;
        fletch.rotation.z = (i * Math.PI * 2) / 3;
        group.add(fletch);
    }
    return group;
}

/* ------------------------------------------------------------------ */
/* Cenário: árvores, rochas, torres, barricadas, itens                 */
/* ------------------------------------------------------------------ */

/** Pinheiro em camadas — geometria única para uso em InstancedMesh. */
export function buildPineGeometry() {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.22, 0.34, 3.4, 7);
    trunk.translate(0, 1.7, 0);
    parts.push({ geo: trunk, color: new THREE.Color(0x4a3423) });

    for (let i = 0; i < 4; i++) {
        const r = 2.3 - i * 0.45;
        const h = 2.4 - i * 0.28;
        const cone = new THREE.ConeGeometry(r, h, 8);
        cone.translate(0, 2.9 + i * 1.35, 0);
        parts.push({ geo: cone, color: new THREE.Color().setHSL(0.31, 0.42, 0.16 + i * 0.035) });
    }
    return mergeWithColors(parts);
}

/** Árvore folhosa (copa em aglomerado de esferas achatadas). */
export function buildOakGeometry() {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.28, 0.42, 2.8, 7);
    trunk.translate(0, 1.4, 0);
    parts.push({ geo: trunk, color: new THREE.Color(0x53381f) });

    const blobs = [
        [0, 3.9, 0, 1.9],
        [1.3, 3.4, 0.4, 1.35],
        [-1.2, 3.5, -0.5, 1.4],
        [0.2, 4.6, -1.1, 1.15]
    ];
    for (const [x, y, z, r] of blobs) {
        const s = new THREE.SphereGeometry(r, 9, 7);
        s.scale(1, 0.82, 1);
        s.translate(x, y, z);
        parts.push({ geo: s, color: new THREE.Color().setHSL(0.26, 0.38, 0.19 + Math.random() * 0.06) });
    }
    return mergeWithColors(parts);
}

/** Rocha facetada. */
export function buildRockGeometry(seed = 1) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed) * 0.22 + Math.sin(y * 4.3) * 0.12;
        pos.setXYZ(i, x * (1 + n), y * (0.72 + n * 0.6), z * (1 + n * 0.8));
    }
    geo.computeVertexNormals();
    return geo;
}

/**
 * Concatena geometrias aplicando uma cor por parte no atributo `color`.
 * Evita depender do BufferGeometryUtils e mantém tudo em um único draw call.
 */
export function mergeWithColors(parts) {
    let vertexCount = 0;
    let indexCount = 0;
    for (const { geo } of parts) {
        vertexCount += geo.attributes.position.count;
        indexCount += geo.index ? geo.index.count : geo.attributes.position.count;
    }

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);

    let vOffset = 0;
    let iOffset = 0;
    for (const { geo, color } of parts) {
        const p = geo.attributes.position;
        if (!geo.attributes.normal) geo.computeVertexNormals();
        const n = geo.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            positions[(vOffset + i) * 3] = p.getX(i);
            positions[(vOffset + i) * 3 + 1] = p.getY(i);
            positions[(vOffset + i) * 3 + 2] = p.getZ(i);
            normals[(vOffset + i) * 3] = n.getX(i);
            normals[(vOffset + i) * 3 + 1] = n.getY(i);
            normals[(vOffset + i) * 3 + 2] = n.getZ(i);
            colors[(vOffset + i) * 3] = color.r;
            colors[(vOffset + i) * 3 + 1] = color.g;
            colors[(vOffset + i) * 3 + 2] = color.b;
        }
        if (geo.index) {
            for (let i = 0; i < geo.index.count; i++) indices[iOffset + i] = geo.index.getX(i) + vOffset;
            iOffset += geo.index.count;
        } else {
            for (let i = 0; i < p.count; i++) indices[iOffset + i] = i + vOffset;
            iOffset += p.count;
        }
        vOffset += p.count;
        geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingSphere();
    return merged;
}

/** Torre de vigia inimiga fincada na margem. */
export function buildWatchtower() {
    const group = new THREE.Group();
    const stone = stoneMaterial('#7d7a72');

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.6, 9, 10), stone);
    base.position.y = 4.5;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.2, 1.2, 10), stone);
    crown.position.y = 9.4;
    crown.castShadow = true;
    group.add(crown);

    // Ameias.
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.6), stone);
        merlon.position.set(Math.cos(a) * 2.2, 10.4, Math.sin(a) * 2.2);
        merlon.rotation.y = -a;
        merlon.castShadow = true;
        group.add(merlon);
    }

    // Braseiro no topo.
    const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.5, 8), metalMaterial(0x4b4038, 0.6));
    brazier.position.y = 10.4;
    group.add(brazier);
    const fire = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 8),
        plainMaterial(0xffc477, 0.4, 0, 0xff7a20, 3)
    );
    fire.position.y = 10.9;
    group.add(fire);
    const light = new THREE.PointLight(0xff8c3a, 14, 32, 2);
    light.position.y = 11;
    group.add(light);

    group.userData.fire = fire;
    group.userData.light = light;
    return group;
}

/** Barricada flutuante de troncos acorrentados. */
export function buildBarricade() {
    const group = new THREE.Group();
    const wood = woodMaterial(true, 0x53381f);
    for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 7.5, 8), wood);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.2 + i * 0.1, -0.9 + i * 0.9);
        log.rotation.y = (i - 1) * 0.08;
        log.castShadow = true;
        group.add(log);
    }
    for (const sx of [-1, 1]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 7), wood);
        spike.position.set(sx * 2.6, 1.0, 0);
        spike.rotation.z = sx * -0.5;
        group.add(spike);
    }
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 5, 10), metalMaterial(0x6d6a63, 0.5));
    chain.position.set(0, 0.6, 0);
    chain.rotation.y = Math.PI / 2;
    group.add(chain);
    return group;
}

/** Itens coletáveis. */
export function buildPickup(kind) {
    const group = new THREE.Group();

    if (kind === 'coin') {
        const coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18),
            plainMaterial(COLORS.gold, 0.25, 0.95, 0x6b4a10, 0.9)
        );
        coin.rotation.x = Math.PI / 2;
        group.add(coin);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), plainMaterial(0xffe9a8, 0.2, 0.9));
        group.add(rim);
    } else if (kind === 'heart') {
        const mat = plainMaterial(0xe0455f, 0.4, 0.1, 0x7a0f22, 1.4);
        for (const sx of [-1, 1]) {
            const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat);
            lobe.position.set(sx * 0.19, 0.16, 0);
            group.add(lobe);
        }
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.55, 12), mat);
        tip.position.y = -0.2;
        tip.rotation.x = Math.PI;
        group.add(tip);
    } else if (kind === 'shield') {
        const shield = new THREE.Mesh(
            new THREE.CylinderGeometry(0.46, 0.46, 0.1, 18),
            new THREE.MeshStandardMaterial({
                map: shieldTexture('#2f5d7c', '#eee3c0'),
                roughness: 0.5,
                emissive: new THREE.Color(0x1a4a6b),
                emissiveIntensity: 0.7
            })
        );
        shield.rotation.x = Math.PI / 2;
        group.add(shield);
    } else if (kind === 'fury') {
        const mat = plainMaterial(0xff7a2f, 0.3, 0.4, 0xff4d00, 2.2);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat);
        group.add(core);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 22), mat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
    }

    group.traverse((c) => {
        c.castShadow = true;
    });
    return group;
}

/** Estandarte tremulando (usado no castelo e nas torres). */
export function buildBanner(colorA = '#8a1f2d', colorB = '#f3c96b', width = 1.1, height = 2.2) {
    const mat = registerCloth(clothMaterial({
        map: bannerTexture(colorA, colorB),
        side: THREE.DoubleSide,
        wind: 0.85
    }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 8, 10), mat);
    mesh.castShadow = true;
    return mesh;
}

export function disposeMaterials() {
    materialCache.forEach((m) => m.dispose());
    materialCache.clear();
    clothMaterials.clear();
}
