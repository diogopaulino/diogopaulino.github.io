/**
 * Quarto 1994 construído só com primitivas e texturas de canvas.
 * Cada objeto interativo recebe `userData.iid` para o raycaster.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyMaps } from './textures.js?v=2';

const interactives = [];

function std(opts) {
    return new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.04, ...opts });
}

function phys(opts) {
    return new THREE.MeshPhysicalMaterial({ roughness: 0.45, metalness: 0.05, ...opts });
}

function add(parent, geo, material, {
    pos, rot, scale, cast = true, receive = true, name
} = {}) {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (name) m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
}

function tag(root, id, label, hint) {
    root.userData.interactive = { id, label, hint };
    root.traverse((c) => {
        c.userData.iid = id;
    });
    interactives.push(root);
    return root;
}

function plasticMat(tex, tint = 0xcfc0a6, extra = {}) {
    const m = phys({
        color: tint,
        roughness: 0.42,
        metalness: 0.06,
        clearcoat: 0.18,
        clearcoatRoughness: 0.55,
        ...extra
    });
    applyMaps(m, tex.plastic, 0.35);
    return m;
}

export function buildWorld(tex, screenTexture, aniso) {
    interactives.length = 0;
    const root = new THREE.Group();
    const refs = {};
    const mats = makeMaterials(tex);

    buildRoom(root, mats, tex, refs);
    buildDesk(root, mats, tex);
    buildCrt(root, mats, tex, screenTexture, refs);
    buildTower(root, mats, tex, refs);
    buildKeyboard(root, mats, refs);
    buildMouse(root, mats, tex, refs);
    buildLamp(root, mats, refs);
    buildFloppies(root, mats, tex, refs);
    buildSpeakers(root, mats, tex, refs);
    buildMug(root, mats, refs);
    buildWalkman(root, mats, refs);
    buildPhone(root, mats, refs);
    buildJoystick(root, mats, refs);
    buildClock(root, mats, refs);
    buildBooks(root, mats, tex);
    buildChair(root, mats, refs);
    buildPlant(root, mats, tex, refs);
    buildFan(root, mats, refs);
    buildGameBoy(root, mats, refs);
    buildCassettes(root, mats);
    buildSticky(root, tex);

    return { root, refs, interactives };
}

function makeMaterials(tex) {
    const wood = std({ color: 0xc49a6c, roughness: 0.7 });
    applyMaps(wood, tex.wood, 0.85);
    const wall = std({ color: 0xd2c4aa, roughness: 0.9, side: THREE.DoubleSide });
    applyMaps(wall, tex.wallpaper, 0.25);
    const carpet = std({ color: 0xffffff, roughness: 0.95 });
    applyMaps(carpet, tex.carpet, 1.1);
    const ceiling = std({ color: 0xe8dcc8, roughness: 0.92 });
    applyMaps(ceiling, tex.ceiling, 0.2);
    const beige = plasticMat(tex);
    const beigeDark = plasticMat(tex, 0xb8a888);
    const charcoal = phys({
        color: 0x2a2a28, roughness: 0.4, metalness: 0.12, clearcoat: 0.2
    });
    applyMaps(charcoal, tex.darkPlastic, 0.3);
    const metal = std({ color: 0x9aa0a6, roughness: 0.32, metalness: 0.85 });
    const blackMetal = std({ color: 0x222226, roughness: 0.38, metalness: 0.7 });
    const glass = phys({
        color: 0x0a120c,
        roughness: 0.08,
        metalness: 0.15,
        transmission: 0.0,
        transparent: true,
        opacity: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.05
    });
    return { wood, wall, carpet, ceiling, beige, beigeDark, charcoal, metal, blackMetal, glass };
}

function buildRoom(root, mats, tex, refs) {
    const room = new THREE.Group();
    add(room, new THREE.PlaneGeometry(5.4, 4.6), mats.carpet, {
        rot: [-Math.PI / 2, 0, 0], receive: true, cast: false
    });
    add(room, new THREE.PlaneGeometry(5.4, 2.6), mats.wall, {
        pos: [0, 1.3, -2.28], receive: true, cast: false
    });
    add(room, new THREE.PlaneGeometry(4.6, 2.6), mats.wall, {
        pos: [-2.68, 1.3, 0], rot: [0, Math.PI / 2, 0], receive: true, cast: false
    });
    add(room, new THREE.PlaneGeometry(4.6, 2.6), mats.wall, {
        pos: [2.68, 1.3, 0], rot: [0, -Math.PI / 2, 0], receive: true, cast: false
    });
    add(room, new THREE.PlaneGeometry(5.4, 4.6), mats.ceiling, {
        pos: [0, 2.58, 0], rot: [Math.PI / 2, 0, 0], receive: true, cast: false
    });

    const base = std({ color: 0x8a6a48, roughness: 0.7 });
    add(room, new THREE.BoxGeometry(5.4, 0.12, 0.08), base, { pos: [0, 0.06, -2.24] });
    add(room, new THREE.BoxGeometry(0.08, 0.12, 4.6), base, { pos: [-2.64, 0.06, 0] });
    add(room, new THREE.BoxGeometry(0.08, 0.12, 4.6), base, { pos: [2.64, 0.06, 0] });

    buildWindow(room, mats, tex, refs);
    buildPosters(room, tex);
    buildShelf(room, mats, tex);
    buildBasket(room, mats);
    buildCalendar(room, mats);

    const fixture = add(room, new THREE.BoxGeometry(0.9, 0.05, 0.22), mats.beige, {
        pos: [0.2, 2.54, 0.4], cast: false
    });
    fixture.material = mats.beige.clone();
    fixture.material.emissive = new THREE.Color(0xffe8c0);
    fixture.material.emissiveIntensity = 0.15;

    root.add(room);
}

function buildWindow(room, mats, tex, refs) {
    const win = new THREE.Group();
    win.position.set(-2.66, 1.45, -0.35);

    add(win, new THREE.BoxGeometry(0.08, 1.28, 1.52), mats.wood, { pos: [0.02, 0, 0] });
    const sky = add(win, new THREE.PlaneGeometry(1.36, 1.12), std({
        map: tex.nightSky, roughness: 1, metalness: 0, emissive: 0x1a2240, emissiveIntensity: 0.45
    }), { pos: [-0.04, 0.02, 0], rot: [0, Math.PI / 2, 0], cast: false });
    sky.material.map = tex.nightSky;

    const pane = add(win, new THREE.PlaneGeometry(1.32, 1.08), phys({
        color: 0x88aacc,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.18,
        clearcoat: 1
    }), { pos: [0.05, 0.02, 0], rot: [0, Math.PI / 2, 0], cast: false });

    const slats = new THREE.Group();
    const slatGeo = new THREE.BoxGeometry(0.04, 0.045, 1.38);
    const slatMat = std({ color: 0xe8dcc4, roughness: 0.7 });
    refs.blindSlats = [];
    for (let i = 0; i < 18; i++) {
        const s = add(slats, slatGeo, slatMat, {
            pos: [0.08, 0.52 - i * 0.058, 0], cast: true
        });
        refs.blindSlats.push(s);
    }
    win.add(slats);
    refs.blinds = slats;
    refs.blindsOpen = 0.35;
    tag(win, 'blinds', 'Persianas', 'Abrir / fechar a lua');
    room.add(win);
}

function buildPosters(room, tex) {
    const frame = (map, pos, rot, id, label) => {
        const g = new THREE.Group();
        g.position.set(...pos);
        g.rotation.set(...rot);
        add(g, new THREE.BoxGeometry(0.62, 0.86, 0.03), std({ color: 0x1a120c, roughness: 0.6 }), { pos: [0, 0, -0.01] });
        add(g, new THREE.PlaneGeometry(0.56, 0.8), std({ map, roughness: 0.55 }), { pos: [0, 0, 0.016], cast: false });
        tag(g, id, label, 'Olhar de perto');
        room.add(g);
        return g;
    };
    frame(tex.posterOs, [ -1.15, 1.55, -2.25 ], [0, 0, 0], 'poster-os', 'Pôster Nexus 95');
    frame(tex.posterBand, [ 0.55, 1.58, -2.25 ], [0, 0, 0], 'poster-band', 'Pôster Static Hearts');
    frame(tex.posterDisk, [ 1.85, 1.52, -2.25 ], [0, 0, 0], 'poster-disk', 'Pôster Diskette Fest');
}

function buildShelf(room, mats, tex) {
    const shelf = new THREE.Group();
    shelf.position.set(2.48, 0.9, 0.4);
    add(shelf, new THREE.BoxGeometry(0.32, 1.6, 1.1), mats.wood, { pos: [0, 0.2, 0] });
    for (let i = 0; i < 4; i++) {
        add(shelf, new THREE.BoxGeometry(0.3, 0.03, 1.08), mats.wood, { pos: [0.01, -0.45 + i * 0.38, 0] });
    }
    const hues = [12, 210, 40, 160, 320, 80];
    const titles = ['C++', 'DOS 6', 'UNIX', 'MIDI', 'VGA', 'BBS'];
    titles.forEach((t, i) => {
        const cover = tex.bookCover(t, hues[i]);
        const y = -0.28 + (i % 3) * 0.38;
        const z = -0.35 + Math.floor(i / 3) * 0.42;
        add(shelf, new THREE.BoxGeometry(0.16, 0.28, 0.05), std({ map: cover, roughness: 0.7 }), {
            pos: [-0.02, y, z], rot: [0, 0.1, 0]
        });
    });
    room.add(shelf);
}

function buildBasket(room, mats) {
    const g = new THREE.Group();
    g.position.set(1.35, 0.16, 0.95);
    add(g, new THREE.CylinderGeometry(0.14, 0.12, 0.28, 16, 1, true), mats.charcoal);
    add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), mats.charcoal, { pos: [0, -0.13, 0] });
    const paper = std({ color: 0xe8dcc0, roughness: 0.85 });
    add(g, new THREE.SphereGeometry(0.05, 8, 6), paper, { pos: [0.02, 0.08, 0.01], scale: [1.4, 0.5, 1.1] });
    room.add(g);
}

function buildCalendar(room, mats) {
    const g = new THREE.Group();
    g.position.set(-2.25, 1.55, 1.15);
    g.rotation.y = Math.PI / 2;
    add(g, new THREE.BoxGeometry(0.42, 0.52, 0.02), std({ color: 0xf2ead8, roughness: 0.8 }));
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4ead8';
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = '#b03030';
    ctx.fillRect(0, 0, 256, 70);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AGOSTO 94', 128, 46);
    ctx.fillStyle = '#222';
    ctx.font = '16px monospace';
    for (let d = 1; d <= 31; d++) {
        const x = 28 + ((d - 1) % 7) * 32;
        const y = 110 + Math.floor((d - 1) / 7) * 32;
        if (d === 14) {
            ctx.fillStyle = '#b03030';
            ctx.beginPath();
            ctx.arc(x, y - 6, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
        }
        ctx.fillText(String(d), x, y);
        ctx.fillStyle = '#222';
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    add(g, new THREE.PlaneGeometry(0.4, 0.5), std({ map: tex, roughness: 0.85 }), { pos: [0, 0, 0.012], cast: false });
    tag(g, 'calendar', 'Calendário 94', '14 de agosto está circulado');
    room.add(g);
}

function buildDesk(root, mats, tex) {
    const desk = new THREE.Group();
    const top = add(desk, new RoundedBoxGeometry(1.84, 0.045, 0.82, 3, 0.012), mats.wood, {
        pos: [0, 0.74, 0]
    });
    add(desk, new RoundedBoxGeometry(1.78, 0.08, 0.76, 2, 0.01), mats.wood, { pos: [0, 0.70, 0] });
    const leg = new RoundedBoxGeometry(0.07, 0.70, 0.07, 2, 0.01);
    [[-0.82, 0.35, -0.34], [0.82, 0.35, -0.34], [-0.82, 0.35, 0.34], [0.82, 0.35, 0.34]].forEach((p) => {
        add(desk, leg, mats.wood, { pos: p });
    });
    add(desk, new RoundedBoxGeometry(0.42, 0.38, 0.72, 2, 0.01), mats.wood, { pos: [0.68, 0.38, 0] });
    add(desk, new RoundedBoxGeometry(0.38, 0.04, 0.68, 2, 0.008), mats.beigeDark, { pos: [0.68, 0.28, 0.02] });
    root.add(desk);
}

function buildCrt(root, mats, tex, screenTexture, refs) {
    const crt = new THREE.Group();
    crt.position.set(0.06, 0.762, -0.18);

    add(crt, new RoundedBoxGeometry(0.42, 0.36, 0.34, 4, 0.028), mats.beige, { pos: [0, 0.21, -0.04] });
    add(crt, new RoundedBoxGeometry(0.38, 0.045, 0.32, 2, 0.01), mats.beigeDark, { pos: [0, 0.012, 0] });
    add(crt, new RoundedBoxGeometry(0.36, 0.28, 0.03, 2, 0.006), phys({
        color: 0x1a1c1a, roughness: 0.35, metalness: 0.08
    }), { pos: [0, 0.225, 0.125] });

    const screenGeo = new THREE.PlaneGeometry(0.30, 0.225, 32, 24);
    const pos = screenGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / 0.15;
        const y = pos.getY(i) / 0.112;
        pos.setZ(i, 0.012 * (1.0 - (x * x + y * y) * 0.55));
    }
    screenGeo.computeVertexNormals();

    const screenMat = new THREE.MeshBasicMaterial({
        map: screenTexture,
        toneMapped: false
    });
    const screen = add(crt, screenGeo, screenMat, { pos: [0, 0.225, 0.148], cast: false });
    refs.screenMesh = screen;
    refs.screenMat = screenMat;
    refs.screenTime = { value: 0 };

    add(crt, new THREE.PlaneGeometry(0.305, 0.228), phys({
        color: 0x88aa99,
        roughness: 0.06,
        metalness: 0.12,
        transparent: true,
        opacity: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.04
    }), { pos: [0, 0.225, 0.162], cast: false });

    refs.crtLed = add(crt, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), std({
        color: 0x111, roughness: 0.4, emissive: 0x22ff66, emissiveIntensity: 0
    }), { pos: [-0.16, 0.058, 0.145], rot: [Math.PI / 2, 0, 0] });

    const knobs = [-0.06, 0.02, 0.10];
    knobs.forEach((x) => {
        add(crt, new THREE.CylinderGeometry(0.012, 0.012, 0.016, 12), mats.charcoal, {
            pos: [x, 0.058, 0.145], rot: [Math.PI / 2, 0, 0]
        });
    });

    const badge = document.createElement('canvas');
    badge.width = 256;
    badge.height = 64;
    const bctx = badge.getContext('2d');
    bctx.fillStyle = '#cfc0a6';
    bctx.fillRect(0, 0, 256, 64);
    bctx.fillStyle = '#3a2a18';
    bctx.font = 'bold 28px sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText('AMBERTRON 14', 128, 42);
    const badgeTex = new THREE.CanvasTexture(badge);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    add(crt, new THREE.PlaneGeometry(0.16, 0.04), std({ map: badgeTex, roughness: 0.5 }), {
        pos: [0.12, 0.058, 0.148], cast: false
    });

    const power = add(crt, new THREE.BoxGeometry(0.028, 0.018, 0.012), mats.charcoal, {
        pos: [0.16, 0.058, 0.148]
    });
    refs.crtPower = power;

    tag(crt, 'crt', 'Monitor Ambertron 14"', 'Ligar / desligar o fósforo');
    refs.crt = crt;
    root.add(crt);
}

function buildTower(root, mats, tex, refs) {
    const tw = new THREE.Group();
    tw.position.set(-0.68, 0.762, -0.08);
    add(tw, new RoundedBoxGeometry(0.20, 0.42, 0.42, 3, 0.012), mats.beige, { pos: [0, 0.21, 0] });

    refs.cdBay = add(tw, new RoundedBoxGeometry(0.17, 0.048, 0.02, 2, 0.004), mats.charcoal, { pos: [0, 0.36, 0.202] });
    const tray = add(tw, new RoundedBoxGeometry(0.15, 0.012, 0.16, 2, 0.002), mats.charcoal, {
        pos: [0, 0.36, 0.12]
    });
    refs.cdTray = tray;
    refs.cdOpen = false;

    const drive = add(tw, new RoundedBoxGeometry(0.15, 0.028, 0.02, 2, 0.003), mats.charcoal, {
        pos: [0, 0.30, 0.202]
    });
    add(tw, new THREE.BoxGeometry(0.10, 0.004, 0.004), std({ color: 0x111 }), { pos: [0.01, 0.30, 0.214] });
    refs.driveSlot = drive;
    refs.drivePos = new THREE.Vector3();

    const btnMat = mats.charcoal;
    refs.towerPower = add(tw, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), btnMat, {
        pos: [-0.05, 0.12, 0.208], rot: [Math.PI / 2, 0, 0]
    });
    add(tw, new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), btnMat, {
        pos: [-0.02, 0.12, 0.208], rot: [Math.PI / 2, 0, 0]
    });
    add(tw, new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), btnMat, {
        pos: [0.01, 0.12, 0.208], rot: [Math.PI / 2, 0, 0]
    });

    const ledOn = std({ color: 0x111, emissive: 0xff2222, emissiveIntensity: 0 });
    const ledHdd = std({ color: 0x111, emissive: 0xffaa33, emissiveIntensity: 0 });
    refs.powerLed = add(tw, new THREE.BoxGeometry(0.01, 0.006, 0.004), ledOn, { pos: [0.05, 0.13, 0.212] });
    refs.hddLed = add(tw, new THREE.BoxGeometry(0.01, 0.006, 0.004), ledHdd, { pos: [0.05, 0.11, 0.212] });

    for (let i = 0; i < 8; i++) {
        add(tw, new THREE.BoxGeometry(0.16, 0.006, 0.004), mats.beigeDark, {
            pos: [0, 0.04 + i * 0.012, 0.208], cast: false
        });
    }

    const badge = document.createElement('canvas');
    badge.width = 256;
    badge.height = 80;
    const ctx = badge.getContext('2d');
    ctx.fillStyle = '#cfc0a6';
    ctx.fillRect(0, 0, 256, 80);
    ctx.fillStyle = '#3a2a18';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PACKET BELL', 128, 34);
    ctx.font = '14px sans-serif';
    ctx.fillText('486DX2 · 66MHz', 128, 58);
    const bt = new THREE.CanvasTexture(badge);
    bt.colorSpace = THREE.SRGBColorSpace;
    add(tw, new THREE.PlaneGeometry(0.14, 0.044), std({ map: bt, roughness: 0.5 }), {
        pos: [0, 0.22, 0.212], cast: false
    });

    tag(tw, 'tower', 'Torre Packet Bell 486', 'Botão power · bandeja do CD');
    refs.tower = tw;
    root.add(tw);
}

function buildKeyboard(root, mats, refs) {
    const kb = new THREE.Group();
    kb.position.set(0.08, 0.772, 0.20);
    kb.rotation.x = 0.06;
    add(kb, new RoundedBoxGeometry(0.46, 0.028, 0.168, 3, 0.008), mats.beige);

    const keyGeo = new RoundedBoxGeometry(0.016, 0.008, 0.016, 1, 0.002);
    const keyMat = phys({ color: 0xd8d0c4, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    const rows = [14, 14, 13, 12, 7];
    const widths = [0.016, 0.016, 0.016, 0.016, 0.03];
    let count = rows.reduce((a, b) => a + b, 0);
    const mesh = new THREE.InstancedMesh(keyGeo, keyMat, count);
    mesh.castShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    let n = 0;
    const positions = [];
    rows.forEach((cols, r) => {
        const z = -0.062 + r * 0.026;
        const total = cols * 0.019;
        const start = -total / 2;
        for (let c = 0; c < cols; c++) {
            dummy.position.set(start + c * 0.019, 0.016, z);
            dummy.scale.set(r === 4 && c === 3 ? 4.2 : 1, 1, 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(n, dummy.matrix);
            positions.push(dummy.position.clone());
            n++;
        }
    });
    kb.add(mesh);
    refs.keys = mesh;
    refs.keyDummy = dummy;
    refs.keyPositions = positions;
    refs.keyPress = -1;
    refs.keyPressT = 0;
    tag(kb, 'keyboard', 'Teclado 101 teclas', 'Digite — o DOS escuta');
    refs.keyboard = kb;
    root.add(kb);
}

function buildMouse(root, mats, tex, refs) {
    const g = new THREE.Group();
    g.position.set(0.52, 0.763, 0.20);
    add(g, new THREE.BoxGeometry(0.22, 0.004, 0.24), std({
        map: tex.mousepad.map, roughness: 0.88
    }), { pos: [0, 0, 0], cast: false });
    const body = add(g, new THREE.SphereGeometry(0.032, 18, 12), mats.beige, {
        pos: [0, 0.02, 0], scale: [1.35, 0.7, 1.7]
    });
    add(g, new THREE.BoxGeometry(0.028, 0.006, 0.03), mats.beigeDark, { pos: [-0.012, 0.032, -0.01] });
    add(g, new THREE.BoxGeometry(0.028, 0.006, 0.03), mats.beigeDark, { pos: [0.012, 0.032, -0.01] });
    add(g, new THREE.SphereGeometry(0.012, 10, 8), std({ color: 0x222, roughness: 0.5 }), {
        pos: [0, 0.004, 0.01]
    });
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.02, 0.02, -0.04),
        new THREE.Vector3(-0.08, 0.03, -0.12),
        new THREE.Vector3(-0.18, 0.04, -0.22),
        new THREE.Vector3(-0.28, 0.06, -0.28)
    ]);
    add(g, new THREE.TubeGeometry(curve, 16, 0.004, 6, false), std({ color: 0x1a1a18, roughness: 0.6 }));
    tag(g, 'mouse', 'Mouse de bolinha', 'Clique na tela do CRT');
    refs.mouse = g;
    root.add(g);
}

function buildLamp(root, mats, refs) {
    const lamp = new THREE.Group();
    lamp.position.set(0.70, 0.762, -0.12);
    const brass = std({ color: 0xb8a070, roughness: 0.28, metalness: 0.82 });
    add(lamp, new THREE.CylinderGeometry(0.06, 0.08, 0.025, 20), brass, { pos: [0, 0.012, 0] });
    add(lamp, new THREE.SphereGeometry(0.028, 12, 8), brass, { pos: [0, 0.04, 0] });

    const arm1 = new THREE.Group();
    arm1.position.set(0, 0.05, 0);
    arm1.rotation.set(0, 0, 0.55);
    add(arm1, new THREE.CylinderGeometry(0.01, 0.01, 0.38, 10), brass, { pos: [0, 0.19, 0] });
    lamp.add(arm1);

    const arm2 = new THREE.Group();
    arm2.position.set(0, 0.38, 0);
    arm2.rotation.set(0, 0, -1.35);
    add(arm2, new THREE.CylinderGeometry(0.009, 0.009, 0.32, 10), brass, { pos: [0, 0.16, 0] });
    arm1.add(arm2);

    const head = new THREE.Group();
    head.position.set(0, 0.32, 0);
    head.rotation.set(0.15, 0, 1.15);
    add(head, new THREE.ConeGeometry(0.09, 0.12, 22, 1, true), brass, { pos: [0, -0.02, 0] });
    add(head, new THREE.CircleGeometry(0.088, 22), std({
        color: 0xffe2a8, emissive: 0xffcc77, emissiveIntensity: 0.8, side: THREE.DoubleSide
    }), { pos: [0, -0.078, 0], rot: [Math.PI / 2, 0, 0], cast: false });
    const bulb = add(head, new THREE.SphereGeometry(0.024, 12, 8), std({
        color: 0xfff6d8, emissive: 0xffdd99, emissiveIntensity: 2.2, roughness: 0.25
    }), { pos: [0, -0.05, 0], cast: false });
    arm2.add(head);

    refs.lamp = lamp;
    refs.lampHead = head;
    refs.lampBulb = bulb;
    refs.lampOn = true;
    tag(lamp, 'lamp', 'Luminária de arquiteto', 'Acender / apagar');
    root.add(lamp);
}

function makeFloppy(mats, tex, title, color) {
    const g = new THREE.Group();
    add(g, new RoundedBoxGeometry(0.09, 0.004, 0.093, 1, 0.001), std({
        color: 0x2a2a32, roughness: 0.45, metalness: 0.15
    }));
    add(g, new THREE.BoxGeometry(0.07, 0.001, 0.05), std({
        map: tex.floppy(title, color), roughness: 0.7
    }), { pos: [0, 0.0026, -0.005] });
    add(g, new THREE.BoxGeometry(0.09, 0.003, 0.028), std({
        color: 0xc8ccd0, roughness: 0.28, metalness: 0.75
    }), { pos: [0, 0.001, 0.034] });
    add(g, new THREE.BoxGeometry(0.018, 0.005, 0.012), std({ color: 0x111 }), { pos: [0.028, 0.002, -0.032] });
    g.userData.label = title;
    return g;
}

function buildFloppies(root, mats, tex, refs) {
    const stack = new THREE.Group();
    stack.position.set(-0.32, 0.765, 0.24);
    const labels = [
        ['SYSTEM', '#3a6aaa'],
        ['WORK', '#3a8a5a'],
        ['DOOM', '#8a3030']
    ];
    labels.forEach((l, i) => {
        const f = makeFloppy(mats, tex, l[0], l[1]);
        f.position.set(0.01 * i, 0.005 * i, 0.008 * i);
        f.rotation.y = 0.08 * i;
        stack.add(f);
    });
    tag(stack, 'floppy-stack', 'Pilha de disquetes', 'Etiquetas de 1994');
    root.add(stack);

    const loose = makeFloppy(mats, tex, 'SECRET', '#8a50aa');
    loose.position.set(-0.12, 0.769, 0.30);
    loose.rotation.set(0, 0.55, 0);
    loose.scale.setScalar(1.15);
    const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.03, 0.12),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.01;
    loose.add(hit);
    tag(loose, 'floppy', 'Disquete SECRET', 'Inserir na unidade A:');
    refs.floppy = loose;
    refs.floppyHome = loose.position.clone();
    refs.floppyHomeRot = loose.rotation.clone();
    root.add(loose);
}

function buildSpeakers(root, mats, tex, refs) {
    const make = (x) => {
        const g = new THREE.Group();
        g.position.set(x, 0.762, -0.22);
        add(g, new RoundedBoxGeometry(0.10, 0.16, 0.12, 2, 0.008), mats.charcoal, { pos: [0, 0.08, 0] });
        add(g, new THREE.CircleGeometry(0.032, 20), std({
            map: tex.grille.map, roughness: 0.5, metalness: 0.2
        }), { pos: [0, 0.1, 0.062] });
        add(g, new THREE.CircleGeometry(0.016, 16), std({
            map: tex.grille.map, roughness: 0.5
        }), { pos: [0, 0.048, 0.062] });
        return g;
    };
    const L = make(-0.28);
    const R = make(0.40);
    tag(L, 'speaker', 'Caixa de som', 'O Walkman sai daqui');
    root.add(L, R);
    refs.speakers = [L, R];
}

function buildMug(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(0.62, 0.762, 0.28);
    const mugMat = phys({ color: 0xf2efe8, roughness: 0.35, clearcoat: 0.4 });
    add(g, new THREE.CylinderGeometry(0.032, 0.028, 0.07, 20, 1, true), mugMat, { pos: [0, 0.036, 0] });
    add(g, new THREE.CylinderGeometry(0.028, 0.028, 0.004, 20), mugMat, { pos: [0, 0.002, 0] });
    add(g, new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), mugMat, {
        pos: [0.032, 0.036, 0], rot: [0, 0, Math.PI / 2]
    });
    add(g, new THREE.CircleGeometry(0.027, 20), std({
        color: 0x3a2210, roughness: 0.7, emissive: 0x221408, emissiveIntensity: 0.15
    }), { pos: [0, 0.068, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
    tag(g, 'mug', 'Caneca de café', 'Vapor ainda sobe');
    refs.mug = g;
    root.add(g);
}

function buildWalkman(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(-0.48, 0.765, 0.26);
    g.rotation.y = 0.3;
    add(g, new RoundedBoxGeometry(0.11, 0.022, 0.08, 2, 0.004), mats.charcoal);
    add(g, new THREE.PlaneGeometry(0.05, 0.032), std({
        color: 0x111, emissive: 0x334466, emissiveIntensity: 0.2
    }), { pos: [0.015, 0.012, 0.0], rot: [-Math.PI / 2, 0, 0], cast: false });
    const play = add(g, new THREE.BoxGeometry(0.014, 0.006, 0.01), std({ color: 0xdd3333, roughness: 0.4 }), {
        pos: [-0.035, 0.012, 0.02]
    });
    const hp = new THREE.Group();
    add(hp, new THREE.TorusGeometry(0.055, 0.006, 8, 18, Math.PI), mats.charcoal, {
        pos: [-0.09, 0.07, 0.04], rot: [0, 0, Math.PI / 2]
    });
    add(hp, new THREE.SphereGeometry(0.022, 10, 8), mats.charcoal, { pos: [-0.09, 0.03, 0.04], scale: [0.7, 1, 1] });
    add(hp, new THREE.SphereGeometry(0.022, 10, 8), mats.charcoal, { pos: [-0.09, 0.11, 0.04], scale: [0.7, 1, 1] });
    g.add(hp);
    refs.walkman = g;
    refs.walkmanPlay = play;
    tag(g, 'walkman', 'Walkman cassete', 'Play na fita chiptune');
    root.add(g);
}

function buildPhone(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(0.78, 0.762, 0.08);
    g.rotation.y = -0.4;
    add(g, new RoundedBoxGeometry(0.16, 0.04, 0.12, 2, 0.01), std({ color: 0xd8d0c8, roughness: 0.45 }));
    const hand = new THREE.Group();
    hand.position.set(0, 0.03, 0);
    add(hand, new THREE.CapsuleGeometry(0.016, 0.12, 4, 8), std({ color: 0xd8d0c8, roughness: 0.45 }), {
        rot: [0, 0, Math.PI / 2]
    });
    g.add(hand);
    refs.phone = g;
    refs.handset = hand;
    tag(g, 'phone', 'Telefone de mesa', 'O toque dos anos 90');
    root.add(g);
}

function buildJoystick(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(0.38, 0.762, 0.30);
    add(g, new RoundedBoxGeometry(0.10, 0.03, 0.12, 2, 0.008), mats.charcoal, { pos: [0, 0.015, 0] });
    const stick = new THREE.Group();
    stick.position.set(0, 0.03, 0.01);
    add(stick, new THREE.CylinderGeometry(0.01, 0.01, 0.07, 10), mats.metal, { pos: [0, 0.035, 0] });
    add(stick, new THREE.SphereGeometry(0.022, 12, 8), std({ color: 0xcc2222, roughness: 0.4 }), { pos: [0, 0.078, 0] });
    g.add(stick);
    add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), std({ color: 0xcc2222 }), {
        pos: [0.032, 0.032, -0.03]
    });
    refs.joystick = stick;
    tag(g, 'joystick', 'Joystick', 'Wiggle — o CRT sente');
    root.add(g);
}

function buildClock(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(-0.55, 1.72, -2.24);
    add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.04, 32), mats.wood, { rot: [Math.PI / 2, 0, 0] });
    add(g, new THREE.CircleGeometry(0.095, 32), std({ color: 0xf4ead8, roughness: 0.8 }), { pos: [0, 0, 0.022] });
    const hour = new THREE.Group();
    const minute = new THREE.Group();
    const second = new THREE.Group();
    add(hour, new THREE.BoxGeometry(0.012, 0.045, 0.004), std({ color: 0x222 }), { pos: [0, 0.022, 0] });
    add(minute, new THREE.BoxGeometry(0.008, 0.07, 0.004), std({ color: 0x222 }), { pos: [0, 0.034, 0] });
    add(second, new THREE.BoxGeometry(0.004, 0.08, 0.003), std({ color: 0xaa2222 }), { pos: [0, 0.038, 0] });
    hour.position.z = minute.position.z = 0.026;
    second.position.z = 0.03;
    g.add(hour, minute, second);
    refs.clockHands = { hour, minute, second };
    tag(g, 'clock', 'Relógio de parede', 'Hora real');
    root.add(g);
}

function buildBooks(root, mats, tex) {
    const g = new THREE.Group();
    g.position.set(-0.38, 0.762, 0.08);
    const b1 = tex.bookCover('MS-DOS', 210);
    add(g, new THREE.BoxGeometry(0.16, 0.022, 0.22), std({ map: b1, roughness: 0.7 }), {
        pos: [0, 0.012, 0], rot: [0, 0.2, 0]
    });
    const b2 = tex.bookCover('VGA KIT', 20);
    add(g, new THREE.BoxGeometry(0.15, 0.018, 0.20), std({ map: b2, roughness: 0.7 }), {
        pos: [0.01, 0.032, 0.01], rot: [0, -0.1, 0]
    });
    add(g, new THREE.BoxGeometry(0.14, 0.006, 0.20), std({
        map: tex.paper.map, roughness: 0.82
    }), { pos: [0.02, 0.046, 0.02], rot: [0, 0.15, 0] });
    tag(g, 'books', 'Manuais MS-DOS', 'A bíblia do AUTOEXEC');
    root.add(g);
}

function buildChair(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(0.1, 0, 0.78);
    const metal = mats.metal;
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12), metal, { pos: [0, 0.32, 0] });
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(g, new THREE.BoxGeometry(0.28, 0.025, 0.04), metal, {
            pos: [Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14], rot: [0, -a, 0]
        });
        add(g, new THREE.SphereGeometry(0.03, 10, 8), mats.charcoal, {
            pos: [Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28]
        });
    }
    add(g, new RoundedBoxGeometry(0.42, 0.06, 0.42, 3, 0.02), std({ color: 0x3a2a22, roughness: 0.75 }), {
        pos: [0, 0.54, 0]
    });
    add(g, new RoundedBoxGeometry(0.42, 0.42, 0.06, 3, 0.02), std({ color: 0x3a2a22, roughness: 0.75 }), {
        pos: [0, 0.78, -0.18]
    });
    refs.chair = g;
    tag(g, 'chair', 'Cadeira giratória', 'Dar um giro');
    root.add(g);
}

function buildPlant(root, mats, tex, refs) {
    const g = new THREE.Group();
    g.position.set(1.55, 0, -1.55);
    add(g, new THREE.CylinderGeometry(0.09, 0.07, 0.16, 12), std({ color: 0x8a4030, roughness: 0.7 }), { pos: [0, 0.08, 0] });
    add(g, new THREE.CylinderGeometry(0.02, 0.03, 0.55, 8), std({ color: 0x2a5a22, roughness: 0.7 }), { pos: [0, 0.42, 0] });
    const leafMat = std({ map: tex.leaf.map, roughness: 0.65, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        add(g, new THREE.PlaneGeometry(0.16, 0.32), leafMat, {
            pos: [Math.cos(a) * 0.08, 0.55 + (i % 3) * 0.08, Math.sin(a) * 0.08],
            rot: [0.5, a, 0.2]
        });
    }
    tag(g, 'plant', 'Espada-de-são-jorge', 'Sobreviveu a 1994');
    refs.plant = g;
    root.add(g);
}

function buildFan(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(-1.85, 0, 0.9);
    add(g, new THREE.CylinderGeometry(0.12, 0.14, 0.04, 16), mats.charcoal, { pos: [0, 0.02, 0] });
    add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), mats.metal, { pos: [0, 0.37, 0] });
    const head = new THREE.Group();
    head.position.set(0, 0.78, 0);
    add(head, new THREE.TorusGeometry(0.16, 0.01, 8, 20), mats.metal);
    const blades = new THREE.Group();
    const bladeMat = std({ color: 0xc8d0d4, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
        add(blades, new THREE.BoxGeometry(0.28, 0.04, 0.004), bladeMat, {
            rot: [0, 0, (i / 3) * Math.PI * 2]
        });
    }
    head.add(blades);
    g.add(head);
    refs.fanHead = head;
    refs.fanBlades = blades;
    refs.fanOn = true;
    tag(g, 'fan', 'Ventilador', 'Ligar / desligar as pás');
    root.add(g);
}

function buildGameBoy(root, mats, refs) {
    const g = new THREE.Group();
    g.position.set(-0.22, 0.768, 0.34);
    g.rotation.set(-0.9, 0.2, 0.1);
    add(g, new RoundedBoxGeometry(0.07, 0.012, 0.12, 2, 0.006), std({ color: 0xd0d4c8, roughness: 0.45 }));
    const lcd = add(g, new THREE.PlaneGeometry(0.048, 0.044), std({
        color: 0x8aa878, emissive: 0x3a5a28, emissiveIntensity: 0.2
    }), { pos: [0, 0.007, -0.018], rot: [-Math.PI / 2, 0, 0], cast: false });
    refs.gbLcd = lcd;
    refs.gbOn = false;
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12), mats.charcoal, {
        pos: [-0.016, 0.008, 0.032], rot: [0, 0, 0]
    });
    tag(g, 'gameboy', 'Game Boy', 'Tetris no LCD verde');
    root.add(g);
}

function buildCassettes(root, mats) {
    const g = new THREE.Group();
    g.position.set(-0.58, 0.766, 0.32);
    const colors = [0xcc3344, 0x3344cc, 0x33aa66];
    colors.forEach((c, i) => {
        add(g, new RoundedBoxGeometry(0.07, 0.012, 0.044, 1, 0.002), std({ color: c, roughness: 0.5 }), {
            pos: [0.01 * i, 0.012 * i, 0.008 * i], rot: [0, 0.2 * i, 0]
        });
    });
    tag(g, 'tapes', 'Fitas K7', 'A trilha do Walkman');
    root.add(g);
}

function buildSticky(root, tex) {
    const g = new THREE.Group();
    g.position.set(0.22, 1.02, 0.01);
    g.rotation.set(-0.12, -0.2, 0.15);
    add(g, new THREE.PlaneGeometry(0.07, 0.07), std({
        map: tex.sticky, roughness: 0.75, side: THREE.DoubleSide
    }), { cast: false });
    tag(g, 'sticky', 'Post-it', 'hunter2 — clássico');
    root.add(g);
}
