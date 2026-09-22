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

    // Sofá
    const sofa = new BABYLON.TransformNode('sofa', scene);
    sofa.position.set(0, 0, 1.4);
    sofa.parent = root;

    const sofaClothMat = new BABYLON.StandardMaterial('sofaClothMat', scene);
    sofaClothMat.diffuseTexture = clothTexture(scene, 2, 2);
    sofaClothMat.diffuseColor = new BABYLON.Color3(0.55, 0.3, 0.2);

    const seat = BABYLON.MeshBuilder.CreateBox('sofaSeat', { width: 2.4, height: 0.4, depth: 0.9 }, scene);
    seat.position.y = 0.4;
    seat.material = sofaClothMat;
    seat.parent = sofa;

    const back = BABYLON.MeshBuilder.CreateBox('sofaBack', { width: 2.4, height: 0.9, depth: 0.2 }, scene);
    back.position.set(0, 0.85, -0.4);
    back.material = sofaClothMat;
    back.parent = sofa;

    const sofaFrame = BABYLON.MeshBuilder.CreateBox('sofaFrame', { width: 2.5, height: 0.18, depth: 1.0 }, scene);
    sofaFrame.position.y = 0.18;
    sofaFrame.material = woodMat;
    sofaFrame.parent = sofa;

    // Estante com livros
    const shelf = BABYLON.MeshBuilder.CreateBox('bookshelf', { width: 1.4, height: 2.2, depth: 0.35 }, scene);
    shelf.position.set(-4.2, 1.2, -2.4);
    shelf.material = woodMat;
    shelf.parent = root;

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

    // Mesinha lateral com o brinquedo brilhante
    const table = BABYLON.MeshBuilder.CreateBox('sideTable', { width: 0.8, height: 0.5, depth: 0.8 }, scene);
    table.position.set(3.2, 0.28, 1.2);
    table.material = woodMat;
    table.parent = root;

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
