/** Fundo panorâmico local: um desenho, sem luzes ou centenas de meshes por quadro. */
export function buildRoom(B, scene, tex, floorMeshes) {
    const dome = new B.PhotoDome('reading_room', new URL('../assets/reading-room.webp', import.meta.url).href, {
        resolution: 32, size: 80, useDirectMapping: true, faceForward: false,
        generateMipMaps: true
    }, scene);
    dome.position.y = -4;
    dome.rotation.y = Math.PI * 0.65;
    dome.mesh.isPickable = false;
    dome.material.imageProcessingConfiguration = new B.ImageProcessingConfiguration();
    dome.material.imageProcessingConfiguration.exposure = 0.86;
    dome.onLoadObservable.addOnce(() => floorMeshes.forEach(mesh => mesh.setEnabled(false)));
    dome.onLoadErrorObservable.addOnce(() => {
        dome.setEnabled(false);
        buildFallbackRoom(B, scene, tex);
    });
    return dome;
}

/** A sala é geometria estática agrupada por material; nenhuma luz extra por objeto. */
function buildFallbackRoom(B, scene, tex) {
    const groups = new Map();
    const material = (name, hex, roughness = 0.85, metallic = 0) => {
        const m = new B.PBRMaterial(name, scene);
        m.albedoColor = B.Color3.FromHexString(hex);
        m.roughness = roughness;
        m.metallic = metallic;
        m.environmentIntensity = 0.35;
        return m;
    };
    const wall = material('room_plaster', '#52615b');
    const oak = material('room_walnut', '#685344', 0.76);
    oak.albedoTexture = tex.mahogany.map;
    const darkWood = material('room_dark_wood', '#302c27');
    const linen = material('room_linen', '#b4aa91');
    linen.albedoTexture = tex.felt.map;
    const leather = material('room_leather', '#414c43', 0.68);
    leather.bumpTexture = tex.felt.normalMap;
    const brass = material('room_brass', '#8c7951', 0.45, 0.65);
    const paper = material('room_paper', '#acaa91');
    const windowMat = material('window_daylight', '#aac3cc');
    windowMat.unlit = true;
    const lampMat = material('lamp_silk', '#d6b981');
    lampMat.emissiveColor = new B.Color3(0.35, 0.23, 0.1);
    const bookMats = ['#454b45', '#63544b', '#34464d', '#8b7960', '#614744'].map((c, i) => material(`book_${i}`, c));
    const add = (mesh, mat) => {
        mesh.material = mat;
        mesh.isPickable = false;
        if (!groups.has(mat)) groups.set(mat, []);
        groups.get(mat).push(mesh);
        return mesh;
    };
    const box = (name, x, y, z, w, h, d, mat) => {
        const mesh = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        mesh.position.set(x, y, z);
        return add(mesh, mat);
    };
    const cylinder = (name, x, y, z, h, bottom, top, mat, segments = 24) => {
        const mesh = B.MeshBuilder.CreateCylinder(name, { height: h, diameterBottom: bottom, diameterTop: top, tessellation: segments }, scene);
        mesh.position.set(x, y, z);
        return add(mesh, mat);
    };

    // Uma casa equivale aproximadamente a 5 cm: mesa de 70 cm, sala de 2,8 m.
    box('back_wall', 0, 7, -23, 48, 42, 0.4, wall);
    box('left_wall', -24, 7, 0, 0.4, 42, 46, wall);
    box('right_wall', 24, 7, 0, 0.4, 42, 46, wall);
    box('front_wall', 0, 7, 23, 48, 42, 0.4, wall);
    for (const z of [-22.6, 22.6]) {
        box('wainscot', 0, -8.5, z, 48, 10, 0.2, darkWood);
        box('dado', 0, -3.4, z, 48, 0.25, 0.5, oak);
        box('skirting', 0, -13.1, z, 48, 0.6, 0.4, oak);
        for (let x = -21; x <= 21; x += 6) {
            box('panel_stile', x, -8.2, z + (z < 0 ? 0.16 : -0.16), 0.18, 8, 0.16, oak);
        }
    }

    // Janelas reais na geometria: montantes, peitoril, cortinas e vegetação distante.
    for (const x of [-14, 14]) {
        box('window_reveal', x, 7.5, -22.5, 10.4, 19, 0.6, darkWood);
        box('window_glass', x, 7.5, -22.1, 9.5, 18, 0.06, windowMat);
        for (const dx of [-4.9, 0, 4.9]) box('window_mullion', x + dx, 7.5, -21.9, 0.2, 18.8, 0.3, oak);
        for (const y of [-1.8, 4.4, 10.5, 16.8]) box('window_crossbar', x, y, -21.85, 10, 0.2, 0.34, oak);
        box('window_sill', x, -2.1, -21.6, 11, 0.45, 1.5, paper);
        for (const dx of [-6, 6]) for (let fold = 0; fold < 6; fold++) {
            const curtain = cylinder('curtain_fold', x + dx + fold * 0.22 - 0.6, 5, -21.3, 24, 0.55, 0.46, linen, 12);
            curtain.scaling.z = 0.55;
        }
    }

    // Biblioteca central com livros de dimensões e lombadas variadas.
    box('shelf_back', 0, 0.2, -21.9, 12.5, 25, 0.4, darkWood);
    for (const x of [-6.25, 0, 6.25]) box('shelf_side', x, 0.2, -20.9, 0.25, 25.3, 2.5, oak);
    for (let row = 0; row < 6; row++) {
        const y = -11.8 + row * 4.8;
        box('shelf', 0, y, -20.9, 12.8, 0.26, 2.6, oak);
        if (row === 5) continue;
        for (let i = 0; i < 20; i++) {
            const h = 2.4 + ((i * 7 + row * 3) % 9) * 0.14;
            const x = -5.8 + i * 0.59;
            if (Math.abs(x) < 0.42) continue;
            const book = box('book', x, y + h / 2 + 0.15, -20.55, 0.42 + i % 3 * 0.03, h, 1.75, bookMats[(i + row) % 5]);
            book.rotation.z = i % 9 === 0 ? 0.08 : 0;
            for (const band of [0.28, h - 0.3]) box('book_spine_band', x, y + band, -19.66, 0.32, 0.035, 0.018, brass);
        }
    }

    // Poltronas de couro em ambos os lados da mesa; encostos acolchoados.
    for (const z of [-9, 9]) {
        const sign = Math.sign(z);
        box('chair_seat', 0, -5.1, z, 6.2, 1.1, 5.2, leather);
        box('chair_back', 0, -0.9, z + sign * 2.3, 6.4, 8, 0.7, leather);
        for (const x of [-2.8, 2.8]) {
            box('chair_arm', x, -3.1, z, 0.55, 0.5, 5.8, oak);
            for (const dz of [-1.9, 1.9]) cylinder('chair_leg', x, -9.5, z + dz, 7.3, 0.28, 0.42, darkWood, 12);
        }
        for (const x of [-1.65, 0, 1.65]) for (const y of [-2.8, -0.5, 1.8]) {
            const button = B.MeshBuilder.CreateSphere('leather_button', { diameter: 0.16, segments: 8 }, scene);
            button.position.set(x, y, z + sign * 1.91);
            add(button, darkWood);
        }
    }

    // Luminárias com difusor de tecido; a fonte difusa da sala faz a iluminação.
    for (const [x, z] of [[10, -14], [-13, 12]]) {
        cylinder('lamp_base', x, -13.35, z, 0.3, 2.6, 2.5, brass);
        cylinder('lamp_stem', x, -4.4, z, 18, 0.14, 0.14, brass, 12);
        cylinder('lamp_shade', x, 4, z, 3.5, 4.4, 2.8, lampMat, 48);
        cylinder('lamp_shade_rim', x, 2.25, z, 0.07, 4.4, 4.4, brass, 48);
    }

    // Mesa lateral: livros, vaso cerâmico e folhas discretas.
    cylinder('side_table', -12, -4, -12, 0.4, 5, 5, oak, 40);
    cylinder('side_pedestal', -12, -8.7, -12, 9, 0.8, 0.7, darkWood);
    box('closed_book', -12.5, -3.65, -12, 2.4, 0.3, 3, bookMats[2]);
    cylinder('vase', -10.6, -2.4, -12.6, 2.8, 1.3, 0.65, paper);
    for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const leaf = B.MeshBuilder.CreateSphere('leaf', { diameter: 1, segments: 8 }, scene);
        leaf.scaling.set(0.32, 1.5, 0.1);
        leaf.position.set(-10.6 + Math.cos(a) * 1.1, i * 0.22 - 0.4, -12.6 + Math.sin(a) * 1.1);
        leaf.rotation.set(0.5, a, Math.cos(a) * 0.7);
        add(leaf, leather);
    }

    // Um desenho por material, inclusive centenas de detalhes de livros.
    const meshes = [];
    for (const [mat, list] of groups) {
        const batch = B.Mesh.MergeMeshes(list, true, true, undefined, false, false);
        if (!batch) continue;
        batch.name = mat.name;
        batch.material = mat;
        batch.isPickable = false;
        batch.receiveShadows = false;
        batch.freezeWorldMatrix();
        meshes.push(batch);
    }
    return meshes;
}
