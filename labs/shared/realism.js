/**
 * Personagens, animais e vegetação para labs three.js.
 * Geometria esculpida (não cápsula/caixa no lugar de corpo),
 * íris desenhada, cabelo em cards e materiais de pele/tecido.
 *
 * Importa `three` pelo import map da página do lab.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { headRadiusMul, limbRadius, sampleKeys, torsoKeys } from './anatomy.js';

const geoCache = new Map();
const texCache = new Map();
const matCache = new Map();

function cachedGeo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

function hexCss(hex) {
    return `#${(hex >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

function canvasTex(key, draw, { color = true, wrap = THREE.ClampToEdgeWrapping } = {}) {
    if (texCache.has(key)) return texCache.get(key);
    const canvas = document.createElement('canvas');
    draw(canvas);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = wrap;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    texCache.set(key, tex);
    return tex;
}

export function skinMaterial(color = 0xf0c4a0) {
    const key = `skin:${color}`;
    if (matCache.has(key)) return matCache.get(key);
    const pore = canvasTex(`pore:${color}`, (c) => {
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, 128, 128);
        const img = ctx.getImageData(0, 0, 128, 128);
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const i = (y * 128 + x) * 4;
                const n = Math.sin(x * 0.85) * Math.cos(y * 0.7) + Math.sin((x + y) * 0.35) * 0.4;
                const h = 128 + n * 18;
                img.data[i] = h;
                img.data[i + 1] = h;
                img.data[i + 2] = 255;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }, { color: false, wrap: THREE.RepeatWrapping });
    pore.repeat.set(3, 3);
    const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.46,
        metalness: 0.02,
        sheen: 0.42,
        sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffe4d4), 0.55),
        sheenRoughness: 0.62,
        clearcoat: 0.12,
        clearcoatRoughness: 0.55,
        normalMap: pore,
        normalScale: new THREE.Vector2(0.28, 0.28)
    });
    matCache.set(key, mat);
    return mat;
}

export function hairMaterial(color = 0x3a2414) {
    const key = `hair:${color}`;
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.62,
        metalness: 0.04,
        sheen: 0.85,
        sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xfff0e0), 0.35),
        sheenRoughness: 0.35
    });
    matCache.set(key, mat);
    return mat;
}

export function clothMaterial(color = 0x2a6a8c, { roughness = 0.78 } = {}) {
    const key = `cloth:${color}:${roughness}`;
    if (matCache.has(key)) return matCache.get(key);
    const weave = canvasTex(`weave:${color}`, (c) => {
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = hexCss(color);
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 64; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(64, i);
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 64);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        for (let i = 2; i < 64; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(64, i);
            ctx.stroke();
        }
    }, { wrap: THREE.RepeatWrapping });
    weave.repeat.set(4, 4);
    const mat = new THREE.MeshPhysicalMaterial({
        color,
        map: weave,
        roughness,
        metalness: 0.02,
        sheen: 0.25,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3)
    });
    matCache.set(key, mat);
    return mat;
}

export function leatherMaterial(color = 0x4a3020) {
    const key = `leather:${color}`;
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.58,
        metalness: 0.06,
        clearcoat: 0.28,
        clearcoatRoughness: 0.45
    });
    matCache.set(key, mat);
    return mat;
}

function irisMap(hex) {
    return canvasTex(`iris:${hex}`, (c) => {
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 48);
        g.addColorStop(0, '#d8e0c8');
        g.addColorStop(0.18, hexCss(hex));
        g.addColorStop(0.62, hexCss(hex));
        g.addColorStop(0.78, '#140e0a');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(64, 64, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 28; i++) {
            const a = (i / 28) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14);
            ctx.lineTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
            ctx.stroke();
        }
        ctx.fillStyle = '#070605';
        ctx.beginPath();
        ctx.arc(64, 64, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(80, 48, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(74, 54, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function hairCardMap(color) {
    return canvasTex(`hcard:${color}`, (c) => {
        c.width = 64;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 64, 128);
        const css = hexCss(color);
        for (let i = 0; i < 18; i++) {
            const x = 4 + (i * 3.2);
            ctx.strokeStyle = css;
            ctx.globalAlpha = 0.45 + (i % 3) * 0.18;
            ctx.lineWidth = 1.2 + (i % 2);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.bezierCurveTo(x + 3, 40, x - 4, 80, x + 1, 128);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    });
}

function hairCardMaterial(color) {
    const key = `hcardmat:${color}`;
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
        color,
        map: hairCardMap(color),
        alphaTest: 0.25,
        roughness: 0.7,
        metalness: 0.03,
        side: THREE.DoubleSide
    });
    matCache.set(key, mat);
    return mat;
}

export function limbGeometry({
    length = 0.4,
    r0 = 0.08,
    r1 = 0.06,
    bulge = 0.02,
    bulgeAt = 0.35,
    pinch = 0.35,
    seg = 16,
    rings = 12
} = {}) {
    const key = `limb:${length}:${r0}:${r1}:${bulge}:${bulgeAt}:${pinch}:${seg}`;
    return cachedGeo(key, () => {
        const pts = [new THREE.Vector2(0.001, 0.012)];
        for (let i = 0; i <= rings; i++) {
            const t = i / rings;
            const y = -t * length;
            pts.push(new THREE.Vector2(limbRadius(t, r0, r1, bulge, bulgeAt, pinch), y));
        }
        pts.push(new THREE.Vector2(0.001, -length - 0.01));
        const g = new THREE.LatheGeometry(pts, seg);
        g.computeVertexNormals();
        return g;
    });
}

export function torsoGeometry({
    height = 0.55,
    girth = 0.2,
    style = 'human',
    seg = 18
} = {}) {
    const key = `torso:${height}:${girth}:${style}:${seg}`;
    return cachedGeo(key, () => {
        const keys = torsoKeys(style);
        const pts = [];
        const steps = 16;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const r = Math.max(0.02, sampleKeys(keys, t) * girth);
            pts.push(new THREE.Vector2(r, t * height));
        }
        pts.unshift(new THREE.Vector2(0.001, -0.01));
        pts.push(new THREE.Vector2(0.001, height + 0.02));
        const g = new THREE.LatheGeometry(pts, seg);
        g.computeVertexNormals();
        return g;
    });
}

function displaceSphere(radius, style, segW = 36, segH = 28) {
    const key = `head:${radius}:${style}:${segW}`;
    return cachedGeo(key, () => {
        const g = new THREE.SphereGeometry(radius, segW, segH);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const len = Math.hypot(x, y, z) || 1;
            const m = headRadiusMul(x / len, y / len, z / len, style);
            pos.setXYZ(i, (x / len) * radius * m, (y / len) * radius * m, (z / len) * radius * m);
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
        return g;
    });
}

export function headGeometry(radius = 0.16, style = 'human') {
    return displaceSphere(radius, style);
}

function makeEye(radius, iris) {
    const g = new THREE.Group();
    const white = new THREE.Mesh(
        cachedGeo(`eyeW:${radius}`, () => new THREE.SphereGeometry(radius, 16, 12)),
        new THREE.MeshPhysicalMaterial({
            color: 0xf4f1ea,
            roughness: 0.18,
            metalness: 0.02,
            clearcoat: 0.85,
            clearcoatRoughness: 0.12
        })
    );
    white.castShadow = false;
    g.add(white);
    const disc = new THREE.Mesh(
        cachedGeo(`eyeD:${radius}`, () => new THREE.CircleGeometry(radius * 0.72, 20)),
        new THREE.MeshStandardMaterial({ map: irisMap(iris), roughness: 0.22, metalness: 0.04 })
    );
    disc.position.z = radius * 0.9;
    g.add(disc);
    return g;
}

function makeLid(radius, skin) {
    const lid = new THREE.Mesh(
        cachedGeo(`lid:${radius}`, () => new THREE.SphereGeometry(radius * 1.18, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.38)),
        skin
    );
    lid.rotation.x = -0.15;
    lid.castShadow = false;
    return lid;
}

function tubeCurve(points, tubular, radius) {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 8, radius, 5, false);
}

export function attachHumanHead(parent, {
    radius = 0.16,
    style = 'human',
    skin = 0xf0c4a0,
    hair = 0x3a2414,
    hairStyle = 'short',
    iris = 0x3d6b34,
    lips = 0xc46a62
} = {}) {
    const skinMat = skinMaterial(skin);
    const skull = new THREE.Mesh(headGeometry(radius, style), skinMat);
    skull.castShadow = true;
    skull.receiveShadow = true;
    skull.name = 'skull';
    parent.add(skull);

    const chibi = style === 'chibi';
    const eyeR = radius * (chibi ? 0.2 : style === 'child' ? 0.15 : 0.115);
    const eyeY = radius * (chibi ? 0.06 : 0.04);
    const eyeX = radius * (chibi ? 0.36 : 0.3);
    const eyeZ = radius * (chibi ? 0.72 : 0.68);
    for (const sx of [-1, 1]) {
        const eye = makeEye(eyeR, iris);
        eye.position.set(sx * eyeX, eyeY, eyeZ - eyeR * 0.25);
        parent.add(eye);
        const lid = makeLid(eyeR, skinMat);
        lid.position.set(sx * eyeX, eyeY + eyeR * 0.45, eyeZ - eyeR * 0.05);
        parent.add(lid);
    }

    const hairMat = hairMaterial(hair);
    const browMat = hairMaterial(hair);
    for (const sx of [-1, 1]) {
        const y = radius * (chibi ? 0.28 : 0.22);
        const z = radius * 0.8;
        const x0 = sx * radius * (chibi ? 0.18 : 0.16);
        const brow = new THREE.Mesh(tubeCurve([
            new THREE.Vector3(x0 - sx * radius * 0.1, y - radius * 0.02, z - radius * 0.05),
            new THREE.Vector3(x0, y, z),
            new THREE.Vector3(x0 + sx * radius * 0.12, y - radius * 0.015, z - radius * 0.04)
        ], 6, radius * 0.016), browMat);
        brow.castShadow = false;
        parent.add(brow);
    }

    const lipMat = new THREE.MeshPhysicalMaterial({
        color: lips,
        roughness: 0.38,
        metalness: 0.02,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
        sheen: 0.4,
        sheenColor: 0xffc8c0
    });
    const ly = -radius * (chibi ? 0.26 : 0.36);
    const lz = radius * (chibi ? 0.84 : 0.74);
    const lw = radius * (chibi ? 0.16 : 0.11);
    const smile = [
        new THREE.Vector3(-lw, ly, lz - radius * 0.05),
        new THREE.Vector3(-lw * 0.35, ly - radius * 0.025, lz + radius * 0.02),
        new THREE.Vector3(0, ly - radius * 0.01, lz + radius * 0.035),
        new THREE.Vector3(lw * 0.35, ly - radius * 0.025, lz + radius * 0.02),
        new THREE.Vector3(lw, ly, lz - radius * 0.05)
    ];
    parent.add(new THREE.Mesh(tubeCurve(smile, 10, radius * 0.018), lipMat));
    const lower = smile.map((p) => p.clone().add(new THREE.Vector3(0, -radius * 0.035, -radius * 0.01)));
    parent.add(new THREE.Mesh(tubeCurve(lower, 10, radius * 0.016), lipMat));

    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(earBladeGeometry({
            height: radius * (chibi ? 0.42 : 0.55),
            width: radius * 0.28,
            thickness: radius * 0.08
        }), skinMat);
        ear.position.set(sx * radius * 0.98, -radius * 0.02, 0);
        ear.rotation.y = sx * -0.4;
        ear.rotation.z = sx * 0.15;
        ear.castShadow = true;
        parent.add(ear);
    }

    if (hairStyle !== 'none' && hairStyle !== 'bald') addHair(parent, radius, hair, hairStyle);
    return { skull, skin: skinMat };
}

function addHair(parent, radius, color, style) {
    const mat = hairMaterial(color);
    const cover = style === 'bob' ? 0.68 : style === 'bangs' ? 0.58 : 0.5;
    const cap = new THREE.Mesh(
        cachedGeo(`hcap:${radius}:${cover}`, () => new THREE.SphereGeometry(radius * 1.04, 28, 16, 0, Math.PI * 2, 0, Math.PI * cover)),
        mat
    );
    cap.position.y = radius * 0.05;
    cap.castShadow = true;
    parent.add(cap);

    const cardMat = hairCardMaterial(color);
    const h = radius * (style === 'bob' ? 1.45 : style === 'short' ? 0.62 : 0.95);
    const plane = cachedGeo(`hplane:${radius}:${h}`, () => new THREE.PlaneGeometry(radius * 0.48, h));
    const count = style === 'short' ? 8 : 12;
    for (let i = 0; i < count; i++) {
        const a = -Math.PI * 0.85 + (i / (count - 1)) * Math.PI * 1.7;
        const card = new THREE.Mesh(plane, cardMat);
        card.position.set(Math.sin(a) * radius * 0.92, radius * 0.25, -Math.cos(a) * radius * 0.55);
        card.rotation.y = a;
        card.rotation.x = 0.25;
        parent.add(card);
    }
    if (style === 'bangs' || style === 'bob') {
        const bang = new THREE.Mesh(
            cachedGeo(`bang:${radius}`, () => new THREE.PlaneGeometry(radius * 1.15, radius * 0.48)),
            cardMat
        );
        bang.position.set(0, radius * 0.28, radius * 0.9);
        bang.rotation.x = 0.45;
        parent.add(bang);
    }
}

export function earBladeGeometry({ height = 0.28, width = 0.12, thickness = 0.035 } = {}) {
    const key = `ear:${height}:${width}:${thickness}`;
    return cachedGeo(key, () => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.quadraticCurveTo(width * 0.9, height * 0.25, width * 0.2, height);
        s.quadraticCurveTo(-width * 0.15, height * 0.72, -width * 0.45, height * 0.18);
        s.quadraticCurveTo(-width * 0.2, 0.01, 0, 0);
        const g = new THREE.ExtrudeGeometry(s, {
            depth: thickness,
            bevelEnabled: true,
            bevelThickness: thickness * 0.45,
            bevelSize: width * 0.08,
            bevelSegments: 2,
            curveSegments: 8
        });
        g.translate(0, 0, -thickness * 0.5);
        g.computeVertexNormals();
        return g;
    });
}

export function handGroup(material, { scale = 1 } = {}) {
    const g = new THREE.Group();
    const palm = new THREE.Mesh(limbGeometry({
        length: 0.09 * scale,
        r0: 0.034 * scale,
        r1: 0.042 * scale,
        bulge: 0.008 * scale,
        bulgeAt: 0.55,
        pinch: 0,
        seg: 12,
        rings: 6
    }), material);
    palm.castShadow = true;
    g.add(palm);
    for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(limbGeometry({
            length: (0.058 - Math.abs(i - 1.5) * 0.006) * scale,
            r0: 0.012 * scale,
            r1: 0.008 * scale,
            bulge: 0.002 * scale,
            bulgeAt: 0.4,
            pinch: 0.15,
            seg: 8,
            rings: 5
        }), material);
        f.position.set((i - 1.5) * 0.016 * scale, -0.07 * scale, 0.012 * scale);
        f.rotation.x = -0.2;
        g.add(f);
    }
    const thumb = new THREE.Mesh(limbGeometry({
        length: 0.042 * scale,
        r0: 0.013 * scale,
        r1: 0.009 * scale,
        bulge: 0.002 * scale,
        pinch: 0,
        seg: 8,
        rings: 4
    }), material);
    thumb.position.set(-0.04 * scale, -0.02 * scale, 0.015 * scale);
    thumb.rotation.z = 1.05;
    thumb.rotation.x = 0.35;
    g.add(thumb);
    return g;
}

export function shoeMesh(material, { length = 0.24, width = 0.1, height = 0.08 } = {}) {
    const key = `shoe:${length}:${width}:${height}`;
    const geo = cachedGeo(key, () => {
        const s = new THREE.Shape();
        s.moveTo(-length * 0.35, 0);
        s.lineTo(length * 0.28, 0);
        s.quadraticCurveTo(length * 0.52, height * 0.15, length * 0.46, height * 0.45);
        s.lineTo(length * 0.12, height * 0.85);
        s.lineTo(-length * 0.22, height);
        s.quadraticCurveTo(-length * 0.48, height * 0.7, -length * 0.42, height * 0.25);
        s.quadraticCurveTo(-length * 0.4, 0.01, -length * 0.35, 0);
        const g = new THREE.ExtrudeGeometry(s, {
            depth: width,
            bevelEnabled: true,
            bevelThickness: height * 0.12,
            bevelSize: length * 0.04,
            bevelSegments: 2,
            curveSegments: 6
        });
        g.translate(0, -height * 0.15, -width * 0.5);
        g.computeVertexNormals();
        return g;
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    return mesh;
}

function profileTube({ axis = 'z', length = 1, rings = 14, seg = 16, radius, squashY = 1, squashX = 1 }) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= rings; i++) {
        const t = i / rings;
        const r = radius(t);
        const along = (t - 0.5) * length;
        for (let j = 0; j <= seg; j++) {
            const a = (j / seg) * Math.PI * 2;
            const cx = Math.cos(a) * r * squashX;
            const cy = Math.sin(a) * r * squashY;
            if (axis === 'z') positions.push(cx, cy, along);
            else if (axis === 'y') positions.push(cx, along, cy);
            else positions.push(along, cy, cx);
            uvs.push(j / seg, t);
        }
    }
    const row = seg + 1;
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < seg; j++) {
            const a = i * row + j;
            const b = a + row;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    const start = positions.length / 3;
    positions.push(0, 0, axis === 'z' ? -length / 2 : 0);
    if (axis === 'y') positions[positions.length - 2] = -length / 2;
    uvs.push(0.5, 0);
    const end = positions.length / 3;
    if (axis === 'z') positions.push(0, 0, length / 2);
    else if (axis === 'y') positions.push(0, length / 2, 0);
    else positions.push(length / 2, 0, 0);
    uvs.push(0.5, 1);
    for (let j = 0; j < seg; j++) {
        indices.push(start, j, j + 1);
        indices.push(end, rings * row + j + 1, rings * row + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
}

/** Torso de quadrúpede, comprimento no eixo Z, peito em +Z. */
export function canineTorsoGeometry({ length = 1.05, girth = 0.34, chest = 0.16 } = {}) {
    const key = `canine:${length}:${girth}:${chest}`;
    return cachedGeo(key, () => profileTube({
        axis: 'z',
        length,
        rings: 16,
        seg: 18,
        squashY: 0.78,
        radius: (t) => {
            const haunch = Math.exp(-((t - 0.16) ** 2) / 0.02);
            const waist = Math.exp(-((t - 0.48) ** 2) / 0.025);
            const rib = Math.exp(-((t - 0.78) ** 2) / 0.018);
            return girth * (0.62 + 0.38 * haunch + 0.22 * rib) + chest * rib - girth * 0.12 * waist;
        }
    }));
}

export function canineHeadGeometry({ radius = 0.28, style = 'fox' } = {}) {
    return displaceSphere(radius, style, 32, 24);
}

export function tailGeometry({ length = 0.7, r0 = 0.12, r1 = 0.04, fluff = 0.08 } = {}) {
    const key = `tail:${length}:${r0}:${r1}:${fluff}`;
    return cachedGeo(key, () => profileTube({
        axis: 'z',
        length,
        rings: 12,
        seg: 12,
        squashY: 0.9,
        radius: (t) => {
            const base = r0 + (r1 - r0) * t;
            const tip = Math.exp(-((t - 0.92) ** 2) / 0.01) * fluff;
            return Math.max(0.02, base + tip);
        }
    }));
}

export function wingMembrane({ span = 1.4, chord = 0.7 } = {}) {
    const key = `wing:${span}:${chord}`;
    return cachedGeo(key, () => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.quadraticCurveTo(span * 0.45, chord * 0.15, span, chord * 0.05);
        s.quadraticCurveTo(span * 0.7, -chord * 0.15, span * 0.25, -chord * 0.55);
        s.quadraticCurveTo(span * 0.08, -chord * 0.35, 0, 0);
        const g = new THREE.ShapeGeometry(s, 12);
        g.computeVertexNormals();
        return g;
    });
}

function leafMap() {
    return canvasTex('leaf', (c) => {
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = '#2f8a32';
        ctx.beginPath();
        ctx.ellipse(64, 70, 28, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1c5a22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(64, 22);
        ctx.lineTo(64, 118);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(64, 40 + i * 14);
            ctx.lineTo(40, 32 + i * 14);
            ctx.moveTo(64, 40 + i * 14);
            ctx.lineTo(88, 32 + i * 14);
            ctx.stroke();
        }
    });
}

let treeTemplate = null;

/** Árvore com tronco irregular, copa deslocada e cards de folha. */
export function createOrganicTree({ tint = 0x2f9a38, scale = 1 } = {}) {
    if (!treeTemplate) {
        const g = new THREE.Group();
        const bark = new THREE.MeshPhysicalMaterial({ color: 0x6b4428, roughness: 0.92, metalness: 0.02 });
        const trunk = new THREE.Mesh(cachedGeo('trunk', () => profileTube({
            axis: 'y',
            length: 1.7,
            rings: 10,
            seg: 10,
            squashX: 1,
            radius: (t) => 0.22 - t * 0.1 + Math.sin(t * 18) * 0.015
        })), bark);
        trunk.position.y = 0.85;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        g.add(trunk);
        const leafMat = new THREE.MeshPhysicalMaterial({
            color: 0x2f9a38,
            roughness: 0.62,
            sheen: 0.45,
            sheenColor: 0xc6f0a0,
            sheenRoughness: 0.5
        });
        leafMat.userData.leaf = true;
        const puff = cachedGeo('puff', () => {
            const ico = new THREE.IcosahedronGeometry(1, 2);
            const pos = ico.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const n = Math.sin(x * 3.1 + y * 2.2) * Math.cos(z * 4.1);
                const s = 1 + n * 0.16;
                pos.setXYZ(i, x * s, y * s * 0.82, z * s);
            }
            ico.computeVertexNormals();
            return ico;
        });
        const spots = [[0, 2.15, 0, 1.05], [0.7, 1.75, 0.25, 0.72], [-0.62, 1.7, -0.2, 0.68], [0.15, 2.55, -0.1, 0.62]];
        for (const [x, y, z, s] of spots) {
            const m = new THREE.Mesh(puff, leafMat);
            m.position.set(x, y, z);
            m.scale.setScalar(s);
            m.castShadow = true;
            m.receiveShadow = true;
            m.userData.leaf = true;
            g.add(m);
        }
        const cardMat = new THREE.MeshStandardMaterial({
            color: tint,
            map: leafMap(),
            alphaTest: 0.4,
            roughness: 0.7,
            side: THREE.DoubleSide
        });
        const plane = cachedGeo('leafplane', () => new THREE.PlaneGeometry(0.45, 0.7));
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const card = new THREE.Mesh(plane, cardMat);
            card.position.set(Math.cos(a) * 0.85, 1.9 + (i % 3) * 0.35, Math.sin(a) * 0.85);
            card.rotation.y = a;
            card.userData.card = true;
            g.add(card);
        }
        treeTemplate = g;
    }
    const clone = treeTemplate.clone(true);
    let leafMat = null;
    let cardMat = null;
    clone.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        if (obj.userData.leaf) {
            if (!leafMat) {
                leafMat = obj.material.clone();
                leafMat.color.set(tint);
            }
            obj.material = leafMat;
        } else if (obj.userData.card) {
            if (!cardMat) {
                cardMat = obj.material.clone();
                cardMat.color.set(tint);
            }
            obj.material = cardMat;
        }
    });
    clone.scale.setScalar(scale);
    return clone;
}

/** Junta geometrias já transformadas. Usado por props compostos. */
export function fuse(geometries) {
    const merged = mergeGeometries(geometries, false);
    return merged || geometries[0];
}

export { profileTube };
