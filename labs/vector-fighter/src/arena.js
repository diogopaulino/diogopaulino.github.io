/**
 * Palcos octogonais. O ring usa CylinderGeometry de 8 lados — a silhueta
 * do Virtua Fighter — com textura em canvas (madeira, pedra ou néon).
 */

import * as THREE from 'three';
import { RING_RADIUS } from './config.js';

const geoCache = new Map();
function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

function lambert(color, map = null, extras = {}) {
    return new THREE.MeshLambertMaterial({
        color,
        map,
        flatShading: true,
        ...extras
    });
}

function mesh(geometry, material, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

export function createSky(top, bot) {
    const geometry = new THREE.SphereGeometry(90, 20, 12);
    const colors = [];
    const pos = geometry.attributes.position;
    const tCol = new THREE.Color(top);
    const bCol = new THREE.Color(bot);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y + 30) / 70;
        c.copy(bCol).lerp(tCol, THREE.MathUtils.clamp(t, 0, 1));
        colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false
    });
    return new THREE.Mesh(geometry, mat);
}

function floorTexture(kind, accent) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    const cx = 256;
    const cy = 256;

    if (kind === 'wood') {
        g.fillStyle = '#6b4428';
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 28) {
            g.fillStyle = y % 56 === 0 ? '#7a4e2e' : '#5c3a22';
            g.fillRect(0, y, 512, 26);
            g.strokeStyle = 'rgba(20,10,6,0.35)';
            g.beginPath();
            g.moveTo(0, y + 26);
            g.lineTo(512, y + 26);
            g.stroke();
        }
        g.strokeStyle = 'rgba(196,30,58,0.85)';
        g.lineWidth = 10;
        octagonPath(g, cx, cy, 210);
        g.stroke();
        g.strokeStyle = 'rgba(240,220,180,0.35)';
        g.lineWidth = 3;
        octagonPath(g, cx, cy, 80);
        g.stroke();
    } else if (kind === 'stone') {
        g.fillStyle = '#c4a078';
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 18; i++) {
            for (let j = 0; j < 18; j++) {
                const shade = 160 + ((i * 13 + j * 7) % 40);
                g.fillStyle = `rgb(${shade},${shade - 30},${shade - 70})`;
                g.fillRect(i * 30, j * 30, 28, 28);
            }
        }
        g.strokeStyle = '#d06030';
        g.lineWidth = 12;
        octagonPath(g, cx, cy, 208);
        g.stroke();
        g.fillStyle = 'rgba(255,140,60,0.18)';
        octagonPath(g, cx, cy, 70);
        g.fill();
    } else {
        g.fillStyle = '#071018';
        g.fillRect(0, 0, 512, 512);
        g.strokeStyle = '#123048';
        g.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
            g.beginPath();
            g.moveTo(i * 32, 0);
            g.lineTo(i * 32, 512);
            g.stroke();
            g.beginPath();
            g.moveTo(0, i * 32);
            g.lineTo(512, i * 32);
            g.stroke();
        }
        const hex = `#${accent.toString(16).padStart(6, '0')}`;
        g.strokeStyle = hex;
        g.lineWidth = 14;
        octagonPath(g, cx, cy, 210);
        g.stroke();
        g.strokeStyle = '#ff2a6a';
        g.lineWidth = 4;
        octagonPath(g, cx, cy, 150);
        g.stroke();
        g.strokeStyle = hex;
        g.lineWidth = 3;
        octagonPath(g, cx, cy, 64);
        g.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
}

function octagonPath(g, cx, cy, r) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    g.closePath();
}

export function createArena(stage, extras = 1) {
    const root = new THREE.Group();
    root.name = 'arena';

    const map = floorTexture(stage.floor, stage.accent);
    const ringR = RING_RADIUS;
    const floor = mesh(
        geo('ring', () => new THREE.CylinderGeometry(ringR, ringR, 0.22, 8)),
        lambert(0xffffff, map),
        { pos: [0, -0.11, 0], receive: true, cast: false }
    );
    floor.rotation.y = Math.PI / 8;
    root.add(floor);

    const rimMat = lambert(stage.accent, null, {
        emissive: stage.accent,
        emissiveIntensity: stage.floor === 'neon' ? 0.55 : 0.12
    });
    const rim = mesh(
        geo('rim', () => new THREE.CylinderGeometry(ringR + 0.22, ringR + 0.22, 0.42, 8, 1, true)),
        rimMat,
        { pos: [0, 0.12, 0], receive: true }
    );
    rim.rotation.y = Math.PI / 8;
    root.add(rim);

    const lip = mesh(
        geo('lip', () => new THREE.TorusGeometry(ringR + 0.12, 0.08, 6, 8)),
        lambert(0xf0e8d8),
        { pos: [0, 0.28, 0], rot: [Math.PI / 2, 0, Math.PI / 8] }
    );
    root.add(lip);

    const plinth = mesh(
        geo('plinth', () => new THREE.CylinderGeometry(ringR + 1.4, ringR + 2.2, 1.4, 8)),
        lambert(0x1a1214),
        { pos: [0, -0.92, 0], receive: true, cast: false }
    );
    plinth.rotation.y = Math.PI / 8;
    root.add(plinth);

    if (stage.floor === 'wood') addDojo(root, extras, stage);
    else if (stage.floor === 'stone') addMarina(root, extras, stage);
    else addColiseum(root, extras, stage);

    return root;
}

function addDojo(root, extras, stage) {
    const wood = lambert(0x4a2c1c);
    const paper = lambert(0xf2e6c8);
    const red = lambert(stage.accent, null, { emissive: stage.accent, emissiveIntensity: 0.35 });

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const d = RING_RADIUS + 3.4;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        root.add(mesh(geo('pillar', () => new THREE.BoxGeometry(0.55, 5.2, 0.55)), wood, {
            pos: [x, 2.4, z]
        }));
        if (extras > 0.5) {
            const lamp = mesh(geo('lamp', () => new THREE.BoxGeometry(0.5, 0.7, 0.5)), red, {
                pos: [x * 0.72, 3.4, z * 0.72]
            });
            root.add(lamp);
        }
    }

    const back = mesh(geo('wall', () => new THREE.BoxGeometry(14, 5, 0.25)), paper, {
        pos: [0, 2.4, -RING_RADIUS - 4.2],
        cast: false
    });
    root.add(back);
    const kanji = lambert(0xc41e3a);
    root.add(mesh(geo('kanji', () => new THREE.BoxGeometry(1.6, 1.6, 0.08)), kanji, {
        pos: [0, 3.1, -RING_RADIUS - 4.05],
        cast: false
    }));
    root.add(mesh(geo('kanji2', () => new THREE.BoxGeometry(0.5, 2.4, 0.08)), kanji, {
        pos: [0, 2.6, -RING_RADIUS - 4.05],
        cast: false
    }));

    if (extras > 0.6) {
        const moon = mesh(
            geo('moon', () => new THREE.SphereGeometry(2.4, 8, 6)),
            lambert(0xffe8c4, null, { emissive: 0xffd0a0, emissiveIntensity: 0.4 }),
            { pos: [-18, 16, -28], cast: false }
        );
        root.add(moon);
    }
}

function addMarina(root, extras, stage) {
    const waterMat = new THREE.MeshLambertMaterial({
        color: 0x1a4a68,
        transparent: true,
        opacity: 0.72,
        flatShading: true
    });
    const water = mesh(
        geo('water', () => new THREE.CircleGeometry(48, 24)),
        waterMat,
        { pos: [0, -0.85, 0], rot: [-Math.PI / 2, 0, 0], cast: false }
    );
    root.add(water);

    const sand = lambert(0xc4a070);
    root.add(mesh(geo('sand', () => new THREE.CylinderGeometry(12, 14, 0.6, 8)), sand, {
        pos: [0, -0.55, 0],
        receive: true,
        cast: false
    }));

    const hull = lambert(0x5a2c18);
    const sail = lambert(0xf0e0c8);
    if (extras > 0.4) {
        for (const [x, z, s] of [[-16, -10, 1.2], [18, -14, 0.9], [14, 16, 1]]) {
            const boat = new THREE.Group();
            boat.add(mesh(geo('hull', () => new THREE.BoxGeometry(3.2, 0.7, 1.1)), hull, { scale: [s, s, s] }));
            boat.add(mesh(geo('mast', () => new THREE.BoxGeometry(0.1, 3.4, 0.1)), lambert(0x3a2418), {
                pos: [0, 1.8, 0],
                scale: [s, s, s]
            }));
            boat.add(mesh(geo('sail', () => new THREE.BoxGeometry(0.08, 2.2, 1.6)), sail, {
                pos: [0.4, 1.8, 0],
                scale: [s, s, s]
            }));
            boat.position.set(x, -0.4, z);
            root.add(boat);
        }
    }

    const sun = mesh(
        geo('sun', () => new THREE.SphereGeometry(3.2, 8, 6)),
        lambert(stage.sun, null, { emissive: stage.sun, emissiveIntensity: 0.8 }),
        { pos: [-22, 10, -30], cast: false }
    );
    root.add(sun);
}

function addColiseum(root, extras, stage) {
    const concrete = lambert(0x1a2430);
    const neonA = lambert(stage.accent, null, { emissive: stage.accent, emissiveIntensity: 0.7 });
    const neonB = lambert(0xff2a6a, null, { emissive: 0xff2a6a, emissiveIntensity: 0.55 });

    const stands = mesh(
        geo('stands', () => new THREE.CylinderGeometry(16, 18, 6, 12, 1, true)),
        concrete,
        { pos: [0, 2.4, 0], cast: false, receive: true }
    );
    root.add(stands);

    const count = Math.round(18 * extras);
    const body = geo('crowd', () => new THREE.BoxGeometry(0.35, 0.7, 0.28));
    const head = geo('crowdH', () => new THREE.BoxGeometry(0.22, 0.22, 0.22));
    const skins = [0x1a2030, 0x243044, 0x121820, 0x2a1a28].map((c) => lambert(c));
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const d = 14.5 + (i % 3) * 0.6;
        const g = new THREE.Group();
        g.add(new THREE.Mesh(body, skins[i % skins.length]));
        const h = new THREE.Mesh(head, skins[(i + 1) % skins.length]);
        h.position.y = 0.48;
        g.add(h);
        g.position.set(Math.cos(a) * d, 1.6 + (i % 4) * 0.55, Math.sin(a) * d);
        g.lookAt(0, g.position.y, 0);
        root.add(g);
    }

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const d = RING_RADIUS + 5.5;
        const pole = mesh(geo('npole', () => new THREE.BoxGeometry(0.18, 4.8, 0.18)), neonA, {
            pos: [Math.cos(a) * d, 2.4, Math.sin(a) * d]
        });
        root.add(pole);
        root.add(mesh(geo('nbar', () => new THREE.BoxGeometry(2.4, 0.12, 0.12)), i % 2 ? neonA : neonB, {
            pos: [Math.cos(a) * d, 4.6, Math.sin(a) * d],
            rot: [0, -a, 0]
        }));
    }

    const sign = mesh(geo('sign', () => new THREE.BoxGeometry(8, 1.1, 0.2)), neonB, {
        pos: [0, 7.2, -15],
        cast: false
    });
    root.add(sign);
}

export function applyStageLights(scene, stage, quality) {
    scene.fog = new THREE.Fog(stage.fog, 18, 62);
    scene.background = new THREE.Color(stage.skyBot);

    const ambient = new THREE.AmbientLight(stage.ambient, 0.55);
    const hemi = new THREE.HemisphereLight(stage.hemiSky, stage.hemiGround, 0.7);
    const sun = new THREE.DirectionalLight(stage.sun, 1.35);
    sun.position.set(...stage.sunDir);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 40;
        sun.shadow.camera.left = -14;
        sun.shadow.camera.right = 14;
        sun.shadow.camera.top = 14;
        sun.shadow.camera.bottom = -14;
        sun.shadow.bias = -0.0008;
    }
    const fill = new THREE.DirectionalLight(stage.fill, 0.45);
    fill.position.set(-stage.sunDir[0], 6, -stage.sunDir[2]);

    const spot = new THREE.SpotLight(0xffffff, 1.1, 28, 0.55, 0.45, 1);
    spot.position.set(0, 12, 0);
    spot.target.position.set(0, 0, 0);

    scene.add(ambient, hemi, sun, fill, spot, spot.target);
    return { ambient, hemi, sun, fill, spot };
}
