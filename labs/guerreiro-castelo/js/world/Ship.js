/**
 * Navio medieval de madeira em Babylon.js (Convés, mastros, velas, leme, cordas, barris).
 */

import { woodTexture, clothTexture, darkWoodTexture } from './Textures.js';

/**
 * Casco de coca: seções em U da popa à roda de proa.
 * A boca fica cheia sob o convés e fecha na proa; as fiadas
 * sobressaem umas das outras (clinker). A quilha é y ≈ −0.9.
 */
function shipHullMesh(scene) {
    const stations = 28;
    const bands = 7;
    const n = bands * 2 + 1;
    const zStern = 8.7;
    const zBow = -11.5;
    const positions = [];
    const uvs = [];

    for (let s = 0; s < stations; s++) {
        const t = s / (stations - 1);
        const z = zStern + (zBow - zStern) * t;
        const beam = t < 0.83
            ? 3.55 * (t < 0.05 ? 0.94 + 0.06 * (t / 0.05) : 1)
            : 3.55 * Math.max(0, 1 - (t - 0.83) / 0.17) ** 0.7;
        const lift = t > 0.8 ? ((t - 0.8) / 0.2) ** 1.35 * 0.7 : (t < 0.06 ? (1 - t / 0.06) * 0.12 : 0);
        const keelY = -0.9;
        const deckY = 1.24 + lift;
        const rake = t > 0.83 ? ((t - 0.83) / 0.17) ** 1.5 * 1.05 : 0;

        for (let i = 0; i < n; i++) {
            const u = i / (n - 1);
            const side = u < 0.5 ? -1 : 1;
            const v = u < 0.5 ? (0.5 - u) * 2 : (u - 0.5) * 2;
            const y = keelY + (deckY - keelY) * v ** 0.62;
            const flare = v ** 0.72;
            const band = Math.min(bands - 1, Math.floor(v * bands));
            const lap = band * 0.05 * Math.min(1, beam / 3.2);
            const x = side * (beam * flare + lap);
            positions.push(x, y, z - rake * (1 - v));
            uvs.push(s / (stations - 1), v);
        }
    }

    const indices = [];
    for (let s = 0; s < stations - 1; s++) {
        for (let i = 0; i < n - 1; i++) {
            const a = s * n + i;
            const c = (s + 1) * n + i;
            indices.push(a, c, a + 1, a + 1, c, c + 1);
        }
    }
    const keel = (n - 1) >> 1;
    for (let i = 0; i < n - 1; i++) indices.push(keel, i + 1, i);

    const mesh = new BABYLON.Mesh('shipHull', scene);
    const data = new BABYLON.VertexData();
    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.uvs = uvs;
    data.applyToMesh(mesh);
    mesh.sideOrientation = BABYLON.Mesh.DOUBLESIDE;
    return mesh;
}

export function buildShip(scene) {
    const root = new BABYLON.TransformNode('shipRoot', scene);

    const woodMat = new BABYLON.StandardMaterial('shipWoodMat', scene);
    woodMat.diffuseTexture = woodTexture(scene, 4, 4);
    woodMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.5);

    const darkWoodMat = new BABYLON.StandardMaterial('shipDarkWoodMat', scene);
    darkWoodMat.diffuseTexture = darkWoodTexture(scene, 3, 3);

    const hull = shipHullMesh(scene);
    hull.material = woodMat;
    hull.parent = root;
    hull.receiveShadows = true;

    // Convés principal
    const deck = BABYLON.MeshBuilder.CreateBox('shipDeck', { width: 6.6, height: 0.18, depth: 16.5 }, scene);
    deck.position.y = 1.35;
    deck.material = darkWoodMat;
    deck.parent = root;
    deck.receiveShadows = true;

    // Guarda-corpo: corrimão abaulado, travessa e balaústres. O colisor continua a parede.
    // O nó fica em x=±3.2, y=1.7. No bombordo a face externa é −X.
    const railCap = [
        [0.035, -0.045], [0.04, 0.01], [0.012, 0.06], [-0.02, 0.075],
        [-0.055, 0.04], [-0.048, -0.02], [-0.015, -0.045], [0.03, -0.05]
    ];
    const railMid = [
        [0.022, -0.028], [-0.028, -0.024], [-0.032, 0.022], [0.02, 0.026]
    ];
    let railPostSrc = null;
    const buildRail = (name, x, outward) => {
        const rail = new BABYLON.TransformNode(name, scene);
        rail.position.set(x, 1.7, 0);
        rail.parent = root;
        const flip = (shape) => shape.map(([sx, sy]) => [sx * outward, sy]);
        const carve = (meshName, shape, y, z0, z1) => {
            const mesh = BABYLON.MeshBuilder.ExtrudeShape(meshName, {
                shape: flip(shape).map(([sx, sy]) => new BABYLON.Vector3(sx, sy, 0)),
                path: [new BABYLON.Vector3(0, y, z0), new BABYLON.Vector3(0, y, z1)],
                cap: BABYLON.Mesh.CAP_ALL,
                closeShape: true,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, scene);
            mesh.material = woodMat;
            mesh.parent = rail;
        };
        carve('railCap', railCap, 0.2, -7.85, 7.85);
        carve('railMid', railMid, -0.06, -7.7, 7.7);
        for (let i = 0; i < 13; i++) {
            const post = railPostSrc
                ? railPostSrc.clone('railPost')
                : (railPostSrc = BABYLON.MeshBuilder.CreateLathe('railPost', {
                    shape: [
                        new BABYLON.Vector3(0.042, 0, 0),
                        new BABYLON.Vector3(0.048, 0.03, 0),
                        new BABYLON.Vector3(0.026, 0.08, 0),
                        new BABYLON.Vector3(0.022, 0.32, 0),
                        new BABYLON.Vector3(0.034, 0.4, 0),
                        new BABYLON.Vector3(0.04, 0.46, 0)
                    ],
                    tessellation: 7,
                    cap: BABYLON.Mesh.CAP_ALL
                }, scene));
            post.position.set(0, -0.275, -7.5 + i * 1.25);
            post.material = woodMat;
            post.parent = rail;
        }
    };
    buildRail('shipRailL', -3.2, 1);
    buildRail('shipRailR', 3.2, -1);

    // Tompadilho traseiro (Quarter deck)
    const qdeck = BABYLON.MeshBuilder.CreateBox('shipQDeck', { width: 6.4, height: 0.16, depth: 4.2 }, scene);
    qdeck.position.set(0, 2.15, 6.2);
    qdeck.material = darkWoodMat;
    qdeck.parent = root;
    qdeck.receiveShadows = true;

    // Frente do tombadilho: tábuas em shipla e cimalha. O colisor continua a parede sólida.
    // O nó fica em (0, 1.8, 4.1). +Z é a popa; a face vista do convés é −Z (shape.x positivo).
    const qwall = new BABYLON.TransformNode('shipQWall', scene);
    qwall.position.set(0, 1.8, 4.1);
    qwall.parent = root;
    const qCarve = (name, shape, path) => {
        const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
            shape: shape.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
            path: path.map(([x, y, z]) => new BABYLON.Vector3(x, y, z || 0)),
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        mesh.material = woodMat;
        mesh.parent = qwall;
        return mesh;
    };
    const plank = [
        [-0.06, -0.3], [0, -0.3], [0, -0.22], [0.1, -0.18],
        [0.1, 0.22], [0, 0.26], [0, 0.3], [-0.06, 0.3]
    ];
    const plankN = 12;
    const plankSpan = 5.8;
    for (let i = 0; i < plankN; i++) {
        const x = -2.9 + (i * plankSpan) / (plankN - 1);
        qCarve('qPlank', plank, [[x, -0.36, 0], [x, 0.32, 0]]);
    }
    qCarve('qCap', [
        [-0.04, -0.06], [0.14, -0.04], [0.18, 0.01], [0.1, 0.07], [-0.02, 0.05]
    ], [[-3.2, 0.38, 0], [3.2, 0.38, 0]]);
    qCarve('qWale', [
        [0.06, -0.04], [0.18, -0.025], [0.2, 0.03], [0.06, 0.04]
    ], [[-3.05, -0.04, 0], [3.05, -0.04, 0]]);
    qCarve('qSill', [
        [-0.04, -0.05], [0.14, -0.03], [0.16, 0.04], [-0.02, 0.05]
    ], [[-3.2, -0.4, 0], [3.2, -0.4, 0]]);

    // Mastro principal
    const mast = BABYLON.MeshBuilder.CreateCylinder('shipMast', {
        diameterTop: 0.32,
        diameterBottom: 0.4,
        height: 11,
        tessellation: 8
    }, scene);
    mast.position.set(0, 6.8, -0.5);
    mast.material = darkWoodMat;
    mast.parent = root;

    // Verga da vela
    const yard = BABYLON.MeshBuilder.CreateCylinder('shipYard', {
        diameter: 0.16,
        height: 8,
        tessellation: 6
    }, scene);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 10.2, -0.5);
    yard.material = darkWoodMat;
    yard.parent = root;

    // Vela de tecido
    const sail = BABYLON.MeshBuilder.CreatePlane('shipSail', { width: 7.2, height: 6.5 }, scene);
    sail.position.set(0, 7.4, -0.7);
    const sailMat = new BABYLON.StandardMaterial('sailMat', scene);
    sailMat.diffuseTexture = clothTexture(scene, 3, 3);
    sailMat.diffuseColor = new BABYLON.Color3(0.95, 0.9, 0.82);
    sailMat.backFaceCulling = false;
    sail.material = sailMat;
    sail.parent = root;

    // Leme
    const helmRoot = new BABYLON.TransformNode('shipHelm', scene);
    helmRoot.position.set(0, 2.7, 7.4);
    helmRoot.parent = root;

    const wheelMat = new BABYLON.StandardMaterial('helmWheelMat', scene);
    wheelMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);

    // Aro no plano XY, de frente para o timoneiro. O leme gira em Z.
    const wheel = BABYLON.MeshBuilder.CreateTorus('wheelTorus', {
        diameter: 0.84,
        thickness: 0.1,
        tessellation: 16
    }, scene);
    wheel.rotation.x = Math.PI / 2;
    wheel.material = wheelMat;
    wheel.parent = helmRoot;

    let spokeSrc = null;
    for (let i = 0; i < 8; i++) {
        const spoke = spokeSrc
            ? spokeSrc.clone(`spoke_${i}`)
            : (spokeSrc = BABYLON.MeshBuilder.CreateLathe('spoke_0', {
                shape: [
                    new BABYLON.Vector3(0.016, -0.5, 0),
                    new BABYLON.Vector3(0.04, -0.46, 0),
                    new BABYLON.Vector3(0.022, -0.4, 0),
                    new BABYLON.Vector3(0.014, -0.12, 0),
                    new BABYLON.Vector3(0.032, 0, 0),
                    new BABYLON.Vector3(0.014, 0.12, 0),
                    new BABYLON.Vector3(0.022, 0.4, 0),
                    new BABYLON.Vector3(0.04, 0.46, 0),
                    new BABYLON.Vector3(0.016, 0.5, 0)
                ],
                tessellation: 7,
                cap: BABYLON.Mesh.CAP_ALL
            }, scene));
        spoke.rotation.z = (i / 8) * Math.PI;
        spoke.material = wheelMat;
        spoke.parent = helmRoot;
    }

    const post = BABYLON.MeshBuilder.CreateCylinder('helmPost', { diameter: 0.16, height: 1.1 }, scene);
    post.position.set(0, 2.2, 7.4);
    post.material = darkWoodMat;
    post.parent = root;

    // Barris: aduelas com bojo e arcos. O centro continua em y=1.72, altura 0,7.
    const hoopMat = new BABYLON.StandardMaterial('barrelHoopMat', scene);
    hoopMat.diffuseColor = new BABYLON.Color3(0.32, 0.33, 0.36);
    hoopMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.52);
    let barrelSrc = null;
    const hoopSrc = {};
    for (const x of [-2.2, 2.2]) {
        for (const z of [-4, -1, 2]) {
            const barrel = new BABYLON.TransformNode(`barrel_${x}_${z}`, scene);
            barrel.position.set(x, 1.72, z);
            barrel.parent = root;
            const stave = barrelSrc
                ? barrelSrc.clone('barrelStave')
                : (barrelSrc = BABYLON.MeshBuilder.CreateLathe('barrelStave', {
                    shape: [
                        new BABYLON.Vector3(0.28, -0.35, 0),
                        new BABYLON.Vector3(0.32, -0.3, 0),
                        new BABYLON.Vector3(0.36, -0.16, 0),
                        new BABYLON.Vector3(0.39, 0, 0),
                        new BABYLON.Vector3(0.36, 0.16, 0),
                        new BABYLON.Vector3(0.32, 0.3, 0),
                        new BABYLON.Vector3(0.28, 0.35, 0)
                    ],
                    tessellation: 10,
                    cap: BABYLON.Mesh.CAP_ALL
                }, scene));
            stave.material = woodMat;
            stave.parent = barrel;
            for (const [hy, dia] of [[-0.26, 0.66], [-0.1, 0.76], [0.1, 0.76], [0.26, 0.66]]) {
                const key = `${hy}`;
                const hoop = hoopSrc[key]
                    ? hoopSrc[key].clone('barrelHoop')
                    : (hoopSrc[key] = BABYLON.MeshBuilder.CreateTorus('barrelHoop', {
                        diameter: dia,
                        thickness: 0.028,
                        tessellation: 10
                    }, scene));
                hoop.position.y = hy;
                hoop.material = hoopMat;
                hoop.parent = barrel;
            }
        }
    }

    // Baú de mantimentos: tábuas e tampa abaulada no lugar do cubo.
    // O centro continua em (1.8, 1.72, 5.2), com o mesmo vão de 0,8 × 0,6 × 0,8.
    const crate = new BABYLON.TransformNode('shipCrate', scene);
    crate.position.set(1.8, 1.72, 5.2);
    crate.parent = root;
    const crateBoard = (name, w, h, d, x, y, z) => {
        const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        m.position.set(x, y, z);
        m.material = woodMat;
        m.parent = crate;
        return m;
    };
    for (const x of [-0.345, 0.345]) {
        for (const z of [-0.345, 0.345]) {
            crateBoard('cratePost', 0.07, 0.42, 0.07, x, -0.09, z);
        }
    }
    for (const y of [-0.22, -0.08, 0.06]) {
        crateBoard('crateSlat', 0.62, 0.12, 0.05, 0, y, 0.365);
        crateBoard('crateSlat', 0.62, 0.12, 0.05, 0, y, -0.365);
        crateBoard('crateSlat', 0.05, 0.12, 0.62, 0.365, y, 0);
        crateBoard('crateSlat', 0.05, 0.12, 0.62, -0.365, y, 0);
    }
    const lidShape = [
        [-0.4, 0], [-0.36, 0.06], [-0.18, 0.12], [0, 0.14],
        [0.18, 0.12], [0.36, 0.06], [0.4, 0], [0.36, -0.04], [-0.36, -0.04]
    ].map(([x, y]) => new BABYLON.Vector3(x, y, 0));
    const lid = BABYLON.MeshBuilder.ExtrudeShape('crateLid', {
        shape: lidShape,
        path: [new BABYLON.Vector3(0, 0, -0.38), new BABYLON.Vector3(0, 0, 0.38)],
        cap: BABYLON.Mesh.CAP_ALL,
        closeShape: true,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    lid.position.y = 0.16;
    lid.material = darkWoodMat;
    lid.parent = crate;
    const ironMat = new BABYLON.StandardMaterial('crateIronMat', scene);
    ironMat.diffuseColor = new BABYLON.Color3(0.28, 0.3, 0.33);
    ironMat.specularColor = new BABYLON.Color3(0.45, 0.45, 0.48);
    const strapShape = [
        [0.01, -0.018], [-0.045, -0.014], [-0.05, 0.014], [0.01, 0.018]
    ].map(([x, y]) => new BABYLON.Vector3(x, y, 0));
    for (const y of [-0.16, 0.02]) {
        const strap = BABYLON.MeshBuilder.ExtrudeShape('crateStrap', {
            shape: strapShape,
            path: [new BABYLON.Vector3(-0.32, y, 0.36), new BABYLON.Vector3(0.32, y, 0.36)],
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        strap.material = ironMat;
        strap.parent = crate;
    }

    // Corda de tempestade que Teco precisa desatar
    const ropePoints = [
        new BABYLON.Vector3(-2.4, 1.5, 3),
        new BABYLON.Vector3(-1.2, 2.4, 4.5),
        new BABYLON.Vector3(0.2, 2.2, 6.8),
        new BABYLON.Vector3(0.4, 2.6, 7.5)
    ];
    const rope = BABYLON.MeshBuilder.CreateTube('stormRope', {
        path: ropePoints,
        radius: 0.04,
        tessellation: 5
    }, scene);
    const ropeMat = new BABYLON.StandardMaterial('ropeMat', scene);
    ropeMat.diffuseColor = new BABYLON.Color3(0.55, 0.42, 0.25);
    rope.material = ropeMat;
    rope.parent = root;
    rope.setEnabled(false);

    // Amarra do navio na praia
    const mooring = BABYLON.MeshBuilder.CreateCylinder('mooring', { diameter: 0.08, height: 2.4 }, scene);
    mooring.rotation.z = 0.7;
    mooring.position.set(2.6, 1.4, 8.2);
    mooring.material = ropeMat;
    mooring.parent = root;

    // Cabine na proa: esteios e tábuas com vão de porta na face de ré.
    // O colisor continua sendo a parede sólida em addShipColliders.
    const cabin = new BABYLON.TransformNode('shipCabin', scene);
    cabin.position.set(0, 1.925, -5.4);
    cabin.parent = root;
    const cabinBoard = (name, w, h, d, x, y, z) => {
        const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        m.position.set(x, y, z);
        m.material = woodMat;
        m.parent = cabin;
        return m;
    };
    for (const x of [-1.945, 1.945]) {
        for (const z of [-1.445, 1.445]) {
            cabinBoard('cabinPost', 0.16, 1.15, 0.16, x, 0, z);
        }
    }
    for (const y of [-0.45, -0.15, 0.15, 0.45]) {
        for (const x of [-1.945, 1.945]) {
            cabinBoard('cabinSide', 0.09, 0.24, 2.78, x, y, 0);
        }
        cabinBoard('cabinBow', 3.78, 0.24, 0.09, 0, y, -1.445);
        if (y > 0.3) {
            cabinBoard('cabinLintel', 3.78, 0.24, 0.09, 0, y, 1.445);
        } else {
            for (const x of [-1.16, 1.16]) {
                cabinBoard('cabinDoor', 1.42, 0.24, 0.09, x, y, 1.445);
            }
        }
    }

    // Duas águas em fiadas: cada telha avança sobre a de baixo. O beiral passa da parede.
    const courses = 4;
    const eave = 2.6;
    const rise = 0.84;
    const nose = 0.24;
    const thick = 0.16;
    const step = eave / courses;
    const dy = rise / courses;
    const asc = [];
    for (let i = 0; i < courses; i++) {
        const x0 = -eave + i * step;
        const y0 = i * dy;
        asc.push([x0 - nose, y0]);
        asc.push([x0 - nose, y0 + thick]);
        asc.push([x0 + step - nose * 0.15, y0 + thick]);
    }
    const profile = asc
        .concat([[0.05, rise + thick]])
        .concat(asc.map(([x, y]) => [-x, y]).reverse())
        .concat([[eave - 0.18, -0.16], [0, rise * 0.62], [-(eave - 0.18), -0.16]]);
    const cabinRoof = BABYLON.MeshBuilder.ExtrudeShape('shipCabinRoof', {
        shape: profile.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
        path: [
            new BABYLON.Vector3(0, 0, -1.95),
            new BABYLON.Vector3(0, 0, 1.95)
        ],
        cap: BABYLON.Mesh.CAP_ALL,
        closeShape: true,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    cabinRoof.position.set(0, 2.5, -5.4);
    cabinRoof.material = darkWoodMat;
    cabinRoof.parent = root;

    root.userData = {
        sail,
        helm: helmRoot,
        rope,
        mooring,
        mast
    };

    return root;
}

export function addShipColliders(collision, ox = 0, oy = 0, oz = 0) {
    collision.addFloor(ox, oz, 6.4, 16, oy + 1.44);
    collision.addFloor(ox, oz + 6.2, 6.2, 4.2, oy + 2.23);
    collision.addWall(ox - 3.25, oz, 0.25, 16, 1.2, oy + 1.44);
    collision.addWall(ox + 3.25, oz, 0.25, 16, 1.2, oy + 1.44);
    collision.addWall(ox, oz + 4.1, 6.4, 0.25, 0.9, oy + 1.44);
    collision.addWall(ox, oz - 5.4, 4.2, 3.2, 1.6, oy + 1.44);
}
