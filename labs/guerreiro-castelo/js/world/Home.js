/**
 * Sala rústica da casa inicial (Lareira, sofá, estante, brinquedos) em Babylon.js.
 */

import {
    woodTexture, darkWoodTexture, plasterTexture, rugTexture, clothTexture, stoneTexture
} from './Textures.js';
import { makeFire } from './Environment.js?v=5';
import { createMuscle } from '../../../shared/realism-bjs.js';

export function buildHomeInterior(scene) {
    const root = new BABYLON.TransformNode('homeRoot', scene);

    const plasterMat = new BABYLON.StandardMaterial('plasterMat', scene);
    plasterMat.diffuseTexture = plasterTexture(scene, 3, 3);
    plasterMat.diffuseColor = new BABYLON.Color3(0.9, 0.85, 0.75);

    const woodMat = new BABYLON.StandardMaterial('woodMat', scene);
    woodMat.diffuseTexture = woodTexture(scene, 4, 4);

    const darkWoodMat = new BABYLON.StandardMaterial('darkWoodMat', scene);
    darkWoodMat.diffuseTexture = darkWoodTexture(scene, 3, 3);

    // Piso
    const floor = BABYLON.MeshBuilder.CreateBox('homeFloor', { width: 10, height: 0.2, depth: 8 }, scene);
    floor.position.y = -0.1;
    floor.material = darkWoodMat;
    floor.parent = root;
    floor.receiveShadows = true;

    // Teto
    const ceil = BABYLON.MeshBuilder.CreateBox('homeCeil', { width: 10, height: 0.2, depth: 8 }, scene);
    ceil.position.y = 3.4;
    ceil.material = woodMat;
    ceil.parent = root;

    // Paredes
    const mkWall = (name, w, h, d, x, y, z) => {
        const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        m.position.set(x, y, z);
        m.material = plasterMat;
        m.parent = root;
        m.receiveShadows = true;
        return m;
    };

    mkWall('wallBack', 10, 3.6, 0.25, 0, 1.7, -4);
    mkWall('wallFront', 10, 3.6, 0.25, 0, 1.7, 4);
    mkWall('wallLeft', 0.25, 3.6, 8, -5, 1.7, 0);
    mkWall('wallRight', 0.25, 3.6, 8, 5, 1.7, 0);

    // Lareira de pedra: ombreiras, arco e soleira no volume do bloco antigo.
    // O colisor continua em addHomeColliders. +Z é a sala.
    const stoneMat = new BABYLON.StandardMaterial('hearthStoneMat', scene);
    stoneMat.diffuseTexture = stoneTexture(scene, 2, 2);
    stoneMat.diffuseColor = new BABYLON.Color3(0.78, 0.72, 0.64);
    const fireplace = new BABYLON.TransformNode('fireplace', scene);
    fireplace.position.set(0, 1.1, -3.55);
    fireplace.parent = root;
    const carve = (name, shape, path, mat) => {
        const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
            shape: shape.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
            path: path.map(([x, y, z]) => new BABYLON.Vector3(x, y, z || 0)),
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        mesh.material = mat || stoneMat;
        mesh.parent = fireplace;
        return mesh;
    };
    const archPoints = (halfW, springY, crownY, n = 10) => {
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const u = (i / n) * 2 - 1;
            const y = springY + (crownY - springY) * Math.sqrt(Math.max(0, 1 - u * u));
            pts.push([+(u * halfW).toFixed(4), +y.toFixed(4)]);
        }
        return pts;
    };
    const jamb = [
        [0.3, -0.24], [-0.4, -0.24], [-0.4, 0.16], [-0.28, 0.24], [0.3, 0.24]
    ];
    carve('jamb', jamb, [[-0.96, -0.9, 0], [-0.96, 0.22, 0]]);
    carve('jamb', jamb.map(([x, y]) => [x, -y]), [[0.96, -0.9, 0], [0.96, 0.22, 0]]);
    const innerArch = archPoints(0.72, 0.18, 0.62);
    const outerArch = archPoints(0.98, 0.06, 0.88);
    carve('arch', innerArch.concat(outerArch.slice().reverse()), [[0, 0, -0.22], [0, 0, 0.36]]);
    carve('breast', [
        [-1.2, 0.4], [-1.2, 1.02], [1.2, 1.02], [1.2, 0.4],
        [0.7, 0.72], [0, 0.94], [-0.7, 0.72]
    ], [[0, 0, -0.25], [0, 0, 0.32]]);
    carve('course', [
        [0.02, -0.045], [-0.1, -0.03], [-0.11, 0.03], [0.02, 0.045]
    ], [[-1.15, 0.62, 0.32], [1.15, 0.62, 0.32]]);
    carve('hearth', [
        [0.3, -0.02], [-0.62, -0.01], [-0.58, 0.06], [-0.18, 0.09], [0.32, 0.08]
    ], [[-1.35, -1, 0], [1.35, -1, 0]]);
    carve('mantel', [
        [0.16, -0.05], [-0.48, -0.06], [-0.5, 0], [-0.22, 0.07], [0.14, 0.06]
    ], [[-1.38, 1.02, 0], [1.38, 1.02, 0]], woodMat);
    const opening = BABYLON.MeshBuilder.CreateBox('fireplaceOpening', { width: 1.28, height: 1.05, depth: 0.1 }, scene);
    opening.position.set(0, -0.35, -0.12);
    const darkMat = new BABYLON.StandardMaterial('fpDarkMat', scene);
    darkMat.diffuseColor = new BABYLON.Color3(0.08, 0.05, 0.03);
    opening.material = darkMat;
    opening.parent = fireplace;

    const fire = makeFire(0.85, scene);
    fire.position.set(0, 0.15, -3.15);
    fire.parent = root;

    // Tapete
    const rug = BABYLON.MeshBuilder.CreateBox('rug', { width: 3.2, height: 0.04, depth: 2.4 }, scene);
    rug.position.set(0, 0.03, 0.3);
    const rugMat = new BABYLON.StandardMaterial('rugMat', scene);
    rugMat.diffuseTexture = rugTexture(scene, 1, 1);
    rug.material = rugMat;
    rug.parent = root;

    // Sofá: assento com borda enrolada, encosto curvo, braços e pés torneados.
    // O nó continua em (0, 0, 1.4). +Z é a frente, para a sala.
    const sofa = new BABYLON.TransformNode('sofa', scene);
    sofa.position.set(0, 0, 1.4);
    sofa.parent = root;
    const sofaClothMat = new BABYLON.StandardMaterial('sofaClothMat', scene);
    sofaClothMat.diffuseTexture = clothTexture(scene, 2, 2);
    sofaClothMat.diffuseColor = new BABYLON.Color3(0.55, 0.3, 0.2);
    const sofaCarve = (name, shape, path, mat) => {
        const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
            shape: shape.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
            path: path.map(([x, y, z]) => new BABYLON.Vector3(x, y, z || 0)),
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        mesh.material = mat;
        mesh.parent = sofa;
        return mesh;
    };
    sofaCarve('sofaSeat', [
        [0.32, -0.1], [-0.38, -0.08], [-0.5, 0], [-0.46, 0.1],
        [-0.08, 0.16], [0.3, 0.12], [0.34, 0]
    ], [[-1.05, 0.42, 0], [1.05, 0.42, 0]], sofaClothMat);
    sofaCarve('sofaBack', [
        [0.1, -0.42], [-0.04, -0.4], [-0.1, 0.1], [-0.16, 0.28],
        [-0.06, 0.4], [0.08, 0.34], [0.12, -0.36]
    ], [[-1.05, 0.9, -0.38], [1.05, 0.9, -0.38]], sofaClothMat);
    const arm = [
        [-0.1, 0.2], [0.1, 0.2], [0.14, 0.32], [0.08, 0.5],
        [0, 0.56], [-0.08, 0.5], [-0.14, 0.32]
    ];
    sofaCarve('sofaArm', arm, [[-1.18, 0, -0.32], [-1.18, 0, 0.42]], sofaClothMat);
    sofaCarve('sofaArm', arm, [[1.18, 0, -0.32], [1.18, 0, 0.42]], sofaClothMat);
    let legSrc = null;
    for (const x of [-1.05, 1.05]) {
        for (const z of [-0.32, 0.36]) {
            const leg = legSrc
                ? legSrc.clone('sofaLeg')
                : (legSrc = BABYLON.MeshBuilder.CreateLathe('sofaLeg', {
                    shape: [
                        new BABYLON.Vector3(0.055, 0, 0),
                        new BABYLON.Vector3(0.06, 0.04, 0),
                        new BABYLON.Vector3(0.034, 0.1, 0),
                        new BABYLON.Vector3(0.028, 0.24, 0),
                        new BABYLON.Vector3(0.042, 0.3, 0),
                        new BABYLON.Vector3(0.05, 0.36, 0)
                    ],
                    tessellation: 8,
                    cap: BABYLON.Mesh.CAP_ALL
                }, scene));
            leg.position.set(x, 0, z);
            leg.material = woodMat;
            leg.parent = sofa;
        }
    }

    // Estante aberta no lugar do bloco. Os livros continuam nas mesmas alturas.
    const bookcase = new BABYLON.TransformNode('bookshelf', scene);
    bookcase.position.set(-4.2, 1.2, -2.4);
    bookcase.parent = root;
    const caseCarve = (name, shape, path) => {
        const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
            shape: shape.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
            path: path.map(([x, y, z]) => new BABYLON.Vector3(x, y, z || 0)),
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        mesh.material = woodMat;
        mesh.parent = bookcase;
        return mesh;
    };
    const upright = [
        [0.16, -0.045], [-0.12, -0.05], [-0.16, -0.02],
        [-0.16, 0.02], [-0.12, 0.05], [0.16, 0.045]
    ];
    caseCarve('caseSide', upright, [[-0.62, -1.08, 0], [-0.62, 1.08, 0]]);
    caseCarve('caseSide', upright.map(([x, y]) => [x, -y]), [[0.62, -1.08, 0], [0.62, 1.08, 0]]);
    const shelfBoard = [
        [0.14, -0.02], [-0.18, -0.018], [-0.2, 0.02], [0.14, 0.022]
    ];
    for (const y of [-1.02, -0.82, -0.12, 1.02]) {
        caseCarve('caseShelf', shelfBoard, [[-0.56, y, 0], [0.56, y, 0]]);
    }

    const bookColors = [
        new BABYLON.Color3(0.5, 0.15, 0.15),
        new BABYLON.Color3(0.15, 0.25, 0.5),
        new BABYLON.Color3(0.2, 0.45, 0.15),
        new BABYLON.Color3(0.45, 0.3, 0.15)
    ];
    for (let i = 0; i < 12; i++) {
        const book = BABYLON.MeshBuilder.CreateBox(`book_${i}`, { width: 0.12, height: 0.28, depth: 0.22 }, scene);
        book.position.set(-4.2 + (i % 6) * 0.16 - 0.4, 0.55 + Math.floor(i / 6) * 0.7, -2.4);
        const bMat = new BABYLON.StandardMaterial(`bookMat_${i}`, scene);
        bMat.diffuseColor = bookColors[i % 4];
        book.material = bMat;
        book.parent = root;
    }

    // Mesinha: tampo com borda enrolada, saia e pés torneados.
    // O nó continua em (3.2, 0.28, 1.2). O topo fica em y local 0.25, onde a bola apoia.
    const table = new BABYLON.TransformNode('sideTable', scene);
    table.position.set(3.2, 0.28, 1.2);
    table.parent = root;
    const tableCarve = (name, shape, path) => {
        const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
            shape: shape.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
            path: path.map(([x, y, z]) => new BABYLON.Vector3(x, y, z || 0)),
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        mesh.material = woodMat;
        mesh.parent = table;
        return mesh;
    };
    tableCarve('tableTop', [
        [0.36, -0.02], [0.38, 0], [0.34, 0.028], [-0.32, 0.028],
        [-0.38, 0.012], [-0.42, -0.004], [-0.36, -0.022], [0.34, -0.02]
    ], [[-0.38, 0.22, 0], [0.38, 0.22, 0]]);
    const apron = [
        [0.02, -0.035], [-0.02, -0.032], [-0.028, 0.02], [0.018, 0.028]
    ];
    tableCarve('tableApron', apron, [[-0.28, 0.14, 0.3], [0.28, 0.14, 0.3]]);
    tableCarve('tableApron', apron, [[-0.28, 0.14, -0.3], [0.28, 0.14, -0.3]]);
    tableCarve('tableApron', apron, [[0.3, 0.14, -0.28], [0.3, 0.14, 0.28]]);
    tableCarve('tableApron', apron, [[-0.3, 0.14, -0.28], [-0.3, 0.14, 0.28]]);
    let tableLegSrc = null;
    for (const x of [-0.3, 0.3]) {
        for (const z of [-0.28, 0.28]) {
            const leg = tableLegSrc
                ? tableLegSrc.clone('tableLeg')
                : (tableLegSrc = BABYLON.MeshBuilder.CreateLathe('tableLeg', {
                    shape: [
                        new BABYLON.Vector3(0.045, 0, 0),
                        new BABYLON.Vector3(0.05, 0.03, 0),
                        new BABYLON.Vector3(0.028, 0.08, 0),
                        new BABYLON.Vector3(0.022, 0.3, 0),
                        new BABYLON.Vector3(0.034, 0.4, 0),
                        new BABYLON.Vector3(0.042, 0.46, 0)
                    ],
                    tessellation: 8,
                    cap: BABYLON.Mesh.CAP_ALL
                }, scene));
            leg.position.set(x, -0.25, z);
            leg.material = woodMat;
            leg.parent = table;
        }
    }

    const shiny = BABYLON.MeshBuilder.CreateSphere('shinyToy', { diameter: 0.18, segments: 10 }, scene);
    shiny.position.set(3.2, 0.62, 1.2);
    const shinyMat = new BABYLON.StandardMaterial('shinyMat', scene);
    shinyMat.diffuseColor = new BABYLON.Color3(0.9, 0.75, 0.3);
    shinyMat.specularColor = new BABYLON.Color3(1, 1, 0.8);
    shinyMat.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.05);
    shiny.material = shinyMat;
    shiny.parent = root;

    // Cavalo de madeira: corpo, pescoço, cabeça e quatro pernas. A bola continua esfera.
    addToyHorse(scene, root, woodMat);

    const ball = BABYLON.MeshBuilder.CreateSphere('toyBall', { diameter: 0.24, segments: 8 }, scene);
    ball.position.set(-3.1, 0.12, 2.5);
    const ballMat = new BABYLON.StandardMaterial('ballMat', scene);
    ballMat.diffuseColor = new BABYLON.Color3(0.7, 0.15, 0.15);
    ball.material = ballMat;
    ball.parent = root;

    root.userData = { fire, shiny };
    return root;
}

/** Cavalinho de brinquedo. createMuscle é centrado em Y; rotation.x = π/2 deita o corpo em +Z. */
function addToyHorse(scene, parent, mat) {
    const g = new BABYLON.TransformNode('toyHorse', scene);
    g.position.set(-3.4, 0.02, 2.2);
    g.parent = parent;
    const body = createMuscle(scene, 'toyBody', {
        length: 0.34,
        r0: 0.045,
        r1: 0.04,
        bulge: 0.035,
        bulgeAt: 0.42,
        pinch: 0.08,
        tessellation: 8,
        rings: 6
    });
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.16;
    body.material = mat;
    body.parent = g;
    const neck = createMuscle(scene, 'toyNeck', {
        length: 0.12,
        r0: 0.032,
        r1: 0.024,
        bulge: 0.008,
        bulgeAt: 0.4,
        pinch: 0.05,
        tessellation: 7,
        rings: 4
    });
    neck.rotation.x = 0.95;
    neck.position.set(0, 0.22, 0.14);
    neck.material = mat;
    neck.parent = g;
    const head = BABYLON.MeshBuilder.CreateLathe('toyHead', {
        shape: [
            new BABYLON.Vector3(0.012, 0, 0),
            new BABYLON.Vector3(0.038, 0.02, 0),
            new BABYLON.Vector3(0.042, 0.07, 0),
            new BABYLON.Vector3(0.018, 0.11, 0)
        ],
        tessellation: 8,
        cap: BABYLON.Mesh.CAP_ALL
    }, scene);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.28, 0.2);
    head.material = mat;
    head.parent = g;
    [[-0.055, 0.1], [0.055, 0.1], [-0.055, -0.08], [0.055, -0.08]].forEach(([x, z], i) => {
        const leg = createMuscle(scene, `toyLeg_${i}`, {
            length: 0.12,
            r0: 0.018,
            r1: 0.014,
            bulge: 0.004,
            bulgeAt: 0.35,
            pinch: 0.1,
            tessellation: 6,
            rings: 4
        });
        leg.position.set(x, 0.08, z);
        leg.material = mat;
        leg.parent = g;
    });
}

export function addHomeColliders(collision) {
    collision.addFloor(0, 0, 10, 8, 0);
    collision.addWall(0, -4, 10, 0.3, 3.6);
    collision.addWall(0, 4, 10, 0.3, 3.6);
    collision.addWall(-5, 0, 0.3, 8, 3.6);
    collision.addWall(5, 0, 0.3, 8, 3.6);
    collision.addWall(0, -3.55, 2.4, 0.7, 2.2);
}
