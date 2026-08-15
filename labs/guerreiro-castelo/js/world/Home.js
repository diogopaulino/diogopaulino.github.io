/**
 * Sala rústica da casa inicial (Lareira, sofá, estante, brinquedos) em Babylon.js.
 */

import {
    woodTexture, darkWoodTexture, plasterTexture, rugTexture, clothTexture
} from './Textures.js';
import { makeFire } from './Environment.js';

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

    // Lareira
    const fireplace = BABYLON.MeshBuilder.CreateBox('fireplace', { width: 2.4, height: 2.2, depth: 0.7 }, scene);
    fireplace.position.set(0, 1.1, -3.55);
    fireplace.material = darkWoodMat;
    fireplace.parent = root;

    const opening = BABYLON.MeshBuilder.CreateBox('fireplaceOpening', { width: 1.5, height: 1.2, depth: 0.4 }, scene);
    opening.position.set(0, 0.75, -3.2);
    const darkMat = new BABYLON.StandardMaterial('fpDarkMat', scene);
    darkMat.diffuseColor = new BABYLON.Color3(0.08, 0.05, 0.03);
    opening.material = darkMat;
    opening.parent = root;

    const fire = makeFire(0.85, scene);
    fire.position.set(0, 0.15, -3.15);
    fire.parent = root;

    const mantel = BABYLON.MeshBuilder.CreateBox('mantel', { width: 2.6, height: 0.12, depth: 0.5 }, scene);
    mantel.position.set(0, 2.15, -3.45);
    mantel.material = woodMat;
    mantel.parent = root;

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

    // Brinquedo de cavalo de madeira e bola
    const horse = BABYLON.MeshBuilder.CreateBox('toyHorse', { width: 0.35, height: 0.22, depth: 0.12 }, scene);
    horse.position.set(-3.4, 0.14, 2.2);
    horse.material = woodMat;
    horse.parent = root;

    const ball = BABYLON.MeshBuilder.CreateSphere('toyBall', { diameter: 0.24, segments: 8 }, scene);
    ball.position.set(-3.1, 0.12, 2.5);
    const ballMat = new BABYLON.StandardMaterial('ballMat', scene);
    ballMat.diffuseColor = new BABYLON.Color3(0.7, 0.15, 0.15);
    ball.material = ballMat;
    ball.parent = root;

    root.userData = { fire, shiny };
    return root;
}

export function addHomeColliders(collision) {
    collision.addFloor(0, 0, 10, 8, 0);
    collision.addWall(0, -4, 10, 0.3, 3.6);
    collision.addWall(0, 4, 10, 0.3, 3.6);
    collision.addWall(-5, 0, 0.3, 8, 3.6);
    collision.addWall(5, 0, 0.3, 8, 3.6);
    collision.addWall(0, -3.55, 2.4, 0.7, 2.2);
}
