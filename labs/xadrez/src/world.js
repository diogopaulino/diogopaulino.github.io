/**
 * Atelier — tabuleiro laqueado, mesa de mogno, piso de mármore com reflexo.
 *
 * Casa = 1 u. Origem no centro. Brancas em z positivo (câmera inicial).
 * Destaques: disco de lance legal, anel de captura, brilho de seleção e xeque.
 */

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { fileOf, rankOf } from './engine.js';

export const SQUARE = 1;
const ORIGIN = 3.5;

export function squareToWorld(index, flip = false) {
    let f = fileOf(index);
    let r = rankOf(index);
    if (flip) {
        f = 7 - f;
        r = 7 - r;
    }
    return {
        x: f - ORIGIN,
        z: ORIGIN - r
    };
}

export function worldToSquare(x, z, flip = false) {
    let f = Math.round(x + ORIGIN);
    let r = Math.round(ORIGIN - z);
    if (flip) {
        f = 7 - f;
        r = 7 - r;
    }
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return r * 8 + f;
}

function phys(tex, extra = {}) {
    return new THREE.MeshPhysicalMaterial({
        map: tex.map,
        normalMap: tex.normalMap,
        roughnessMap: tex.roughnessMap,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.7,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.1,
        ...extra
    });
}

export function buildWorld(tex, quality) {
    const root = new THREE.Group();
    const board = new THREE.Group();
    board.name = 'board';
    root.add(board);

    const lightMat = phys(tex.maple, {
        color: 0xf4deba, clearcoat: 0.28, roughness: 0.42, envMapIntensity: 0.45
    });
    const darkMat = phys(tex.walnut, {
        color: 0x4a2410, clearcoat: 0.32, roughness: 0.48, envMapIntensity: 0.4
    });
    const squares = [];
    const squareGeo = new THREE.BoxGeometry(SQUARE * 0.985, 0.07, SQUARE * 0.985);

    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const dark = (f + r) % 2 === 0;
            const mesh = new THREE.Mesh(squareGeo, dark ? darkMat : lightMat);
            mesh.position.set(f - ORIGIN, 0.035, ORIGIN - r);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            mesh.userData.index = r * 8 + f;
            mesh.userData.kind = 'square';
            board.add(mesh);
            squares.push(mesh);
        }
    }

    const frameMat = phys(tex.mahogany, { color: 0x4a2212, clearcoat: 0.8, roughness: 0.3 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.15, 0.22, 9.15), frameMat);
    frame.position.y = -0.04;
    frame.receiveShadow = true;
    frame.castShadow = true;
    board.add(frame);

    const felt = new THREE.Mesh(
        new THREE.BoxGeometry(8.02, 0.02, 8.02),
        new THREE.MeshStandardMaterial({
            map: tex.felt.map,
            roughness: 0.95,
            metalness: 0,
            color: 0x1a5a38
        })
    );
    felt.position.y = 0.0;
    felt.receiveShadow = true;
    board.add(felt);

    const labels = makeCoordLabels(tex);
    board.add(labels);

    const table = new THREE.Mesh(new THREE.BoxGeometry(16, 0.28, 12), phys(tex.mahogany, {
        color: 0x3d1a0e, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08
    }));
    table.position.y = -0.28;
    table.receiveShadow = true;
    table.castShadow = true;
    root.add(table);

    const legGeo = new THREE.CylinderGeometry(0.22, 0.28, 2.4, 12);
    const legMat = phys(tex.mahogany, { color: 0x2a120a });
    for (const [x, z] of [[-6.8, -4.6], [6.8, -4.6], [-6.8, 4.6], [6.8, 4.6]]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, -1.62, z);
        leg.castShadow = true;
        root.add(leg);
    }

    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(18, 64),
        phys(tex.marble, { color: 0xc8c0b4, roughness: 0.12, clearcoat: 1, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.85;
    floor.receiveShadow = true;
    root.add(floor);

    let mirror = null;
    if (quality.reflect > 0) {
        mirror = new Reflector(new THREE.CircleGeometry(10, 48), {
            clipBias: 0.003,
            textureWidth: quality.reflect,
            textureHeight: quality.reflect,
            color: 0x6a5a48
        });
        mirror.rotation.x = -Math.PI / 2;
        mirror.position.y = -2.84;
        root.add(mirror);
    }

    const rug = new THREE.Mesh(
        new THREE.CircleGeometry(7.5, 48),
        new THREE.MeshStandardMaterial({
            map: tex.felt.map,
            color: 0x6a1c1c,
            roughness: 0.9
        })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = -2.83;
    rug.receiveShadow = true;
    root.add(rug);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(28, 12), wallMat);
    back.position.set(0, 2.2, -14);
    root.add(back);
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(28, 12), wallMat);
    sideL.rotation.y = Math.PI / 2;
    sideL.position.set(-14, 2.2, 0);
    root.add(sideL);
    const sideR = sideL.clone();
    sideR.position.x = 14;
    sideR.rotation.y = -Math.PI / 2;
    root.add(sideR);

    const lamp = makeLamp();
    lamp.position.set(6.2, 0.1, -3.4);
    root.add(lamp);

    const marks = buildMarks();
    root.add(marks.group);

    return { root, board, squares, marks, mirror, lamp };
}

function makeCoordLabels() {
    const g = new THREE.Group();
    const files = 'abcdefgh';
    const make = (text) => {
        const el = document.createElement('canvas');
        el.width = 128;
        el.height = 128;
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e6d2a8';
        ctx.font = '700 78px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 68);
        const tex = new THREE.CanvasTexture(el);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat);
        m.rotation.x = -Math.PI / 2;
        return m;
    };
    for (let i = 0; i < 8; i++) {
        const f = make(files[i]);
        f.position.set(i - ORIGIN, 0.12, ORIGIN + 0.62);
        g.add(f);
        const f2 = make(files[i]);
        f2.position.set(i - ORIGIN, 0.12, -ORIGIN - 0.62);
        f2.rotation.z = Math.PI;
        g.add(f2);
        const r = make(String(i + 1));
        r.position.set(-ORIGIN - 0.62, 0.12, ORIGIN - i);
        g.add(r);
        const r2 = make(String(i + 1));
        r2.position.set(ORIGIN + 0.62, 0.12, ORIGIN - i);
        g.add(r2);
    }
    return g;
}

function makeLamp() {
    const g = new THREE.Group();
    const brass = new THREE.MeshPhysicalMaterial({
        color: 0xb8863a, metalness: 1, roughness: 0.22, envMapIntensity: 1.4
    });
    const shade = new THREE.MeshPhysicalMaterial({
        color: 0xf0d8a8, roughness: 0.6, transmission: 0.35, thickness: 0.2, emissive: 0x6a4010, emissiveIntensity: 0.25
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.12, 20), brass);
    g.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 12), brass);
    stem.position.y = 0.86;
    g.add(stem);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.38, 20, 1, true), shade);
    hat.position.y = 1.72;
    g.add(hat);
    const bulb = new THREE.PointLight(0xffcc88, 3.2, 9, 1.6);
    bulb.position.y = 1.55;
    bulb.castShadow = false;
    g.add(bulb);
    return g;
}

export function buildMarks() {
    const group = new THREE.Group();
    group.name = 'marks';

    const dots = [];
    const dotGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20);
    const dotMat = new THREE.MeshBasicMaterial({
        color: 0xd4b06a, transparent: true, opacity: 0.72, depthWrite: false
    });
    const capGeo = new THREE.RingGeometry(0.28, 0.40, 28);
    const capMat = new THREE.MeshBasicMaterial({
        color: 0xc45c48, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false
    });
    const caps = [];
    for (let i = 0; i < 32; i++) {
        const d = new THREE.Mesh(dotGeo, dotMat.clone());
        d.visible = false;
        d.position.y = 0.09;
        group.add(d);
        dots.push(d);
        const c = new THREE.Mesh(capGeo, capMat.clone());
        c.rotation.x = -Math.PI / 2;
        c.visible = false;
        c.position.y = 0.09;
        group.add(c);
        caps.push(c);
    }

    const selectGeo = new THREE.RingGeometry(0.42, 0.50, 32);
    const select = new THREE.Mesh(selectGeo, new THREE.MeshBasicMaterial({
        color: 0xf0d48a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false
    }));
    select.rotation.x = -Math.PI / 2;
    select.position.y = 0.1;
    select.visible = false;
    group.add(select);

    const lastFrom = select.clone();
    lastFrom.material = new THREE.MeshBasicMaterial({
        color: 0x7aa0d4, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
    });
    const lastTo = lastFrom.clone();
    lastTo.material = lastFrom.material.clone();
    group.add(lastFrom, lastTo);

    const check = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.52, 32),
        new THREE.MeshBasicMaterial({
            color: 0xe05040, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false
        })
    );
    check.rotation.x = -Math.PI / 2;
    check.position.y = 0.11;
    check.visible = false;
    group.add(check);

    const hint = select.clone();
    hint.material = new THREE.MeshBasicMaterial({
        color: 0x6ad4a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false
    });
    group.add(hint);

    return { group, dots, caps, select, lastFrom, lastTo, check, hint };
}

export function placeMark(mesh, index, flip) {
    const p = squareToWorld(index, flip);
    mesh.position.x = p.x;
    mesh.position.z = p.z;
    mesh.visible = true;
}

export function setupLights(scene, quality) {
    RectAreaLightUniformsLib.init();

    const hemi = new THREE.HemisphereLight(0x9eb4d4, 0x3a2214, 0.45);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffe6c4, 1.65);
    key.position.set(4.5, 10, 6.5);
    key.castShadow = quality.shadows;
    if (quality.shadows) {
        key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
        key.shadow.camera.near = 1;
        key.shadow.camera.far = 28;
        key.shadow.camera.left = -10;
        key.shadow.camera.right = 10;
        key.shadow.camera.top = 10;
        key.shadow.camera.bottom = -10;
        key.shadow.bias = -0.0002;
        key.shadow.normalBias = 0.03;
    }
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x88a4cc, 0.55);
    fill.position.set(-6, 5, -4);
    scene.add(fill);

    const windowLight = new THREE.RectAreaLight(0xc8dcff, 8, 6, 4);
    windowLight.position.set(0, 4.2, -13.2);
    windowLight.lookAt(0, 0.5, 0);
    scene.add(windowLight);

    const chandelier = new THREE.SpotLight(0xffd9a8, 3.2, 22, 0.55, 0.45, 1.1);
    chandelier.position.set(0, 7.4, 0.4);
    chandelier.target.position.set(0, 0, 0);
    chandelier.castShadow = quality.shadows;
    if (quality.shadows) {
        chandelier.shadow.mapSize.set(Math.min(quality.shadowMap, 2048), Math.min(quality.shadowMap, 2048));
        chandelier.shadow.bias = -0.00015;
    }
    scene.add(chandelier, chandelier.target);

    return { key, chandelier, hemi };
}
